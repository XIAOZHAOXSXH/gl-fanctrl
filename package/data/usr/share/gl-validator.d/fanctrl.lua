local function percent(v)
    return type(v) == "number" and v >= 0 and v <= 100
end

local function temp_start(v)
    return type(v) == "number" and v >= 35 and v <= 85
end

local function temp_wall(v)
    return type(v) == "number" and v >= 40 and v <= 95
end

local function temp_critical(v)
    return type(v) == "number" and v >= 43 and v <= 105
end

local function hysteresis(v)
    return type(v) == "number" and v >= 1 and v <= 10
end

local function poll_interval(v)
    return type(v) == "number" and v >= 1 and v <= 30
end

return {
    get_status = true,
    restore_defaults = true,
    set_manual = {
        percent = percent,
        persist = function(v) return type(v) == "boolean" end
    },
    set_config = {
        enabled = function(v) return type(v) == "boolean" or v == 0 or v == 1 end,
        mode = function(v) return v == "auto" or v == "manual" end,
        start_temp = temp_start,
        wall_temp = temp_wall,
        critical_temp = temp_critical,
        hysteresis = hysteresis,
        start_percent = percent,
        max_percent = percent,
        manual_percent = percent,
        poll_interval = poll_interval
    }
}
