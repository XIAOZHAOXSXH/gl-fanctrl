#!/bin/sh

CONFIG_NAME="gl_fanctrl"
CONFIG_SECTION="globals"
RUN_DIR="/var/run/gl-fanctrl"
PID_FILE="$RUN_DIR/daemon.pid"
STATE_FILE="$RUN_DIR/state"
MANUAL_FILE="$RUN_DIR/manual_percent"
APPLY_FILE="$RUN_DIR/apply"
LOCK_DIR="$RUN_DIR/lock"

DEFAULT_ENABLED=0
DEFAULT_MODE="auto"
DEFAULT_START_TEMP=70
DEFAULT_WALL_TEMP=76
DEFAULT_CRITICAL_TEMP=88
DEFAULT_HYSTERESIS=3
DEFAULT_START_PERCENT=35
DEFAULT_MAX_PERCENT=100
DEFAULT_MANUAL_PERCENT=0
DEFAULT_POLL_INTERVAL=2

log_msg() {
	logger -t gl-fanctrl "$*"
}

ensure_run_dir() {
	mkdir -p "$RUN_DIR"
	chmod 0755 "$RUN_DIR" 2>/dev/null || true
}

read_first_line() {
	[ -r "$1" ] || return 1
	sed -n '1p' "$1" 2>/dev/null
}

is_uint() {
	case "$1" in
		''|*[!0-9]*) return 1 ;;
		*) return 0 ;;
	esac
}

clamp_int() {
	local value="$1" min="$2" max="$3"
	is_uint "$value" || value="$min"
	[ "$value" -lt "$min" ] && value="$min"
	[ "$value" -gt "$max" ] && value="$max"
	printf '%s\n' "$value"
}

load_config() {
	. /lib/functions.sh
	config_load "$CONFIG_NAME"
	config_get enabled "$CONFIG_SECTION" enabled "$DEFAULT_ENABLED"
	config_get mode "$CONFIG_SECTION" mode "$DEFAULT_MODE"
	config_get start_temp "$CONFIG_SECTION" start_temp "$DEFAULT_START_TEMP"
	config_get wall_temp "$CONFIG_SECTION" wall_temp "$DEFAULT_WALL_TEMP"
	config_get critical_temp "$CONFIG_SECTION" critical_temp "$DEFAULT_CRITICAL_TEMP"
	config_get hysteresis "$CONFIG_SECTION" hysteresis "$DEFAULT_HYSTERESIS"
	config_get start_percent "$CONFIG_SECTION" start_percent "$DEFAULT_START_PERCENT"
	config_get max_percent "$CONFIG_SECTION" max_percent "$DEFAULT_MAX_PERCENT"
	config_get manual_percent "$CONFIG_SECTION" manual_percent "$DEFAULT_MANUAL_PERCENT"
	config_get poll_interval "$CONFIG_SECTION" poll_interval "$DEFAULT_POLL_INTERVAL"

	enabled="$(clamp_int "$enabled" 0 1)"
	case "$mode" in auto|manual) ;; *) mode="$DEFAULT_MODE" ;; esac
	start_temp="$(clamp_int "$start_temp" 35 85)"
	wall_temp="$(clamp_int "$wall_temp" 40 95)"
	critical_temp="$(clamp_int "$critical_temp" 43 105)"
	hysteresis="$(clamp_int "$hysteresis" 1 10)"
	start_percent="$(clamp_int "$start_percent" 0 100)"
	max_percent="$(clamp_int "$max_percent" 0 100)"
	manual_percent="$(clamp_int "$manual_percent" 0 100)"
	poll_interval="$(clamp_int "$poll_interval" 1 30)"

	[ "$wall_temp" -lt $((start_temp + 5)) ] && wall_temp=$((start_temp + 5))
	[ "$critical_temp" -lt $((wall_temp + 3)) ] && critical_temp=$((wall_temp + 3))
	[ "$max_percent" -lt "$start_percent" ] && max_percent="$start_percent"
}

get_temp_path() {
	local p
	p="$(read_first_line /proc/gl-hw-info/temperature)"
	if [ -n "$p" ] && [ -r "$p" ]; then
		printf '%s\n' "$p"
		return 0
	fi

	for p in /sys/class/thermal/thermal_zone*/temp; do
		[ -r "$p" ] || continue
		case "$(read_first_line "${p%/temp}/type")" in
			cpu-thermal|soc-thermal|thermal_zone*) printf '%s\n' "$p"; return 0 ;;
		esac
	done

	for p in /sys/class/thermal/thermal_zone*/temp; do
		[ -r "$p" ] && { printf '%s\n' "$p"; return 0; }
	done
	return 1
}

get_cooling_device() {
	local hint dev typ
	hint="$(read_first_line /proc/gl-hw-info/fan)"
	for dev in $hint; do
		case "$dev" in
			cooling_device*)
				[ -w "/sys/class/thermal/$dev/cur_state" ] && {
					printf '%s\n' "/sys/class/thermal/$dev"
					return 0
				}
				;;
		esac
	done

	for dev in /sys/class/thermal/cooling_device*; do
		[ -d "$dev" ] || continue
		typ="$(read_first_line "$dev/type")"
		[ "$typ" = "pwm-fan" ] && [ -w "$dev/cur_state" ] && {
			printf '%s\n' "$dev"
			return 0
		}
	done
	return 1
}

get_hwmon_dir() {
	local hint dev d
	hint="$(read_first_line /proc/gl-hw-info/fan)"
	for dev in $hint; do
		case "$dev" in
			hwmon*)
				[ -d "/sys/class/hwmon/$dev" ] && {
					printf '%s\n' "/sys/class/hwmon/$dev"
					return 0
				}
				;;
		esac
	done

	for d in /sys/class/hwmon/hwmon*; do
		[ -d "$d" ] || continue
		[ "$(read_first_line "$d/name")" = "pwmfan" ] && {
			printf '%s\n' "$d"
			return 0
		}
	done
	return 1
}

get_hwmon_pwm_path() {
	local hwmon
	hwmon="$(get_hwmon_dir)" || return 1
	[ -w "$hwmon/pwm1" ] || return 1
	printf '%s\n' "$hwmon/pwm1"
}

read_temperature_c() {
	local path="$1" raw
	raw="$(read_first_line "$path")" || return 1
	is_uint "$raw" || return 1
	if [ "$raw" -ge 1000 ]; then
		printf '%s\n' $((raw / 1000))
	else
		printf '%s\n' "$raw"
	fi
}

read_pwm_state() {
	local cooling="$1" state max pwm_path
	if [ -n "$cooling" ] && [ -r "$cooling/cur_state" ]; then
		state="$(read_first_line "$cooling/cur_state")" || state=0
		max="$(read_first_line "$cooling/max_state")" || max=255
		is_uint "$state" || state=0
		is_uint "$max" || max=255
		[ "$max" -le 0 ] && max=255
		printf '%s\n' $((state * 100 / max))
		return 0
	fi

	pwm_path="$(get_hwmon_pwm_path || true)"
	state="$(read_first_line "$pwm_path")" || state=0
	is_uint "$state" || state=0
	printf '%s\n' $((state * 100 / 255))
}

read_rpm() {
	local hwmon="$1" rpm
	[ -n "$hwmon" ] || { printf '0\n'; return 0; }
	rpm="$(read_first_line "$hwmon/fan1_input")" || rpm=0
	is_uint "$rpm" || rpm=0
	printf '%s\n' "$rpm"
}

percent_to_state() {
	local percent="$1" max_state="$2"
	percent="$(clamp_int "$percent" 0 100)"
	is_uint "$max_state" || max_state=255
	[ "$max_state" -le 0 ] && max_state=255
	printf '%s\n' $((percent * max_state / 100))
}

write_sysfs_value() {
	local path="$1" value="$2"
	[ -n "$path" ] && [ -w "$path" ] || return 1
	printf '%s\n' "$value" | tee "$path" >/dev/null
}

write_pwm_percent() {
	local cooling="$1" percent="$2" max_state state pwm_path
	if [ -n "$cooling" ] && [ -w "$cooling/cur_state" ]; then
		max_state="$(read_first_line "$cooling/max_state")" || max_state=255
		state="$(percent_to_state "$percent" "$max_state")"
		write_sysfs_value "$cooling/cur_state" "$state" && return 0
		log_msg "cooling pwm write failed path=$cooling/cur_state state=$state percent=$percent"
	fi

	pwm_path="$(get_hwmon_pwm_path || true)"
	if [ -n "$pwm_path" ]; then
		state="$(percent_to_state "$percent" 255)"
		write_sysfs_value "$pwm_path" "$state" && return 0
		log_msg "hwmon pwm write failed path=$pwm_path state=$state percent=$percent"
	fi

	return 1
}

status_write() {
	local msg="$1"
	ensure_run_dir
	printf '%s\n' "$msg" > "$STATE_FILE"
}

stop_official_fan() {
	[ -x /etc/init.d/gl_fan ] && /etc/init.d/gl_fan stop >/dev/null 2>&1 || true
}

start_official_fan() {
	[ -x /etc/init.d/gl_fan ] && /etc/init.d/gl_fan restart >/dev/null 2>&1 || true
}
