const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const viewsDir = path.resolve(__dirname, '../../package/data/www/views');
fs.mkdirSync(viewsDir, { recursive: true });

const styles = `
.fanctrl-wrapper{padding:20px 0;color:var(--text-regular)}
.fanctrl-wrapper *{box-sizing:border-box}
.fanctrl-card{margin-bottom:20px}
.fanctrl-card .container{overflow:visible}
.fanctrl-overview{display:grid;grid-template-columns:280px minmax(0,1fr);gap:24px;align-items:center}
.fanctrl-visual{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:214px;padding:12px;border-right:1px solid var(--divider)}
.fanctrl-fanbox{width:128px;height:128px;display:grid;place-items:center;border-radius:64px;background:var(--background-main);border:1px solid var(--divider);margin-bottom:14px}
.fanctrl-fan{position:relative;width:82px;height:82px;border-radius:50%;border:1px solid var(--divider);background:var(--background-card)}
.fanctrl-fan:after{content:"";position:absolute;inset:31px;border-radius:50%;background:var(--primary)}
.fanctrl-fan i{position:absolute;left:40px;top:35px;width:30px;height:10px;border-radius:10px;background:var(--primary);transform-origin:0 50%;opacity:.48}
.fanctrl-fan i:nth-child(1){transform:rotate(0deg)}.fanctrl-fan i:nth-child(2){transform:rotate(90deg)}.fanctrl-fan i:nth-child(3){transform:rotate(180deg)}.fanctrl-fan i:nth-child(4){transform:rotate(270deg)}
.fanctrl-fan.spin{animation:fanctrl-spin 1.2s linear infinite}
.fanctrl-mode-chip{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:13px;background:var(--background-main);border:1px solid var(--divider);font-size:12px;color:var(--text-weak)}
.fanctrl-mode-chip.is-on{color:var(--success);background:var(--success-background);border-color:transparent}
.fanctrl-mode-chip.is-warn{color:var(--error);background:var(--error-background);border-color:transparent}
.fanctrl-mode-chip.is-idle{color:var(--primary);background:var(--background-card);border-color:var(--primary)}
.fanctrl-summary{display:flex;flex-direction:column;gap:16px;min-width:0}
.fanctrl-status-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--divider)}
.fanctrl-status-row h2{margin:0 0 4px;font-size:18px;line-height:26px;font-weight:600;color:var(--text-regular)}
.fanctrl-status-row p{margin:0;font-size:12px;line-height:18px;color:var(--text-weak);word-break:break-word}
.fanctrl-status-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto;white-space:nowrap}
.fanctrl-status-action-label{font-size:12px;line-height:18px;color:var(--text-weak)}
.fanctrl-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.fanctrl-quick-item{min-height:78px;padding:12px 14px;border-radius:5px;background:var(--background-main);border:1px solid var(--divider)}
.fanctrl-quick-item span{display:block;font-size:12px;line-height:18px;color:var(--text-weak)}
.fanctrl-quick-item strong{display:block;margin-top:8px;font-size:22px;line-height:28px;font-weight:600;color:var(--text-regular);white-space:nowrap}
.fanctrl-services{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.fanctrl-service{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-radius:5px;background:var(--background-main);border:1px solid var(--divider)}
.fanctrl-service span{font-size:13px;color:var(--text-regular)}.fanctrl-dot{width:8px;height:8px;border-radius:50%;background:var(--text-weak);flex:0 0 auto}.fanctrl-dot.on{background:var(--success)}.fanctrl-dot.warn{background:var(--error)}.fanctrl-dot.idle{background:var(--primary);opacity:.55}
.fanctrl-settings{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}
.fanctrl-panel{min-width:0}
.fanctrl-section{border:1px solid var(--divider);border-radius:5px;background:var(--background-main);margin-bottom:16px;overflow:hidden}
.fanctrl-section-head{height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;border-bottom:1px solid var(--divider);background:var(--background-card)}
.fanctrl-section-head h3{margin:0;font-size:14px;line-height:20px;font-weight:600;color:var(--text-regular)}
.fanctrl-section-head span{font-size:12px;color:var(--text-weak)}
.fanctrl-list{list-style:none;margin:0;padding:0}
.fanctrl-list li{min-height:58px;display:grid;grid-template-columns:minmax(150px,1fr) minmax(180px,240px);gap:16px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--divider)}
.fanctrl-list li:last-child{border-bottom:0}
.fanctrl-label{min-width:0}.fanctrl-label strong{display:block;font-size:13px;font-weight:500;line-height:20px;color:var(--text-regular)}.fanctrl-label span{display:block;margin-top:2px;font-size:12px;line-height:17px;color:var(--text-weak)}
.fanctrl-control{display:flex;align-items:center;justify-content:flex-end;min-width:0}
.fanctrl-stepper{width:178px;height:34px;display:grid;grid-template-columns:34px minmax(0,1fr) 34px 30px;align-items:center;border:1px solid var(--divider);border-radius:4px;background:var(--background-card);overflow:hidden}
.fanctrl-stepper button{width:34px;height:34px;border:0;background:transparent;color:var(--text-regular);font-size:18px;line-height:1;cursor:pointer}
.fanctrl-stepper button:hover{background:var(--background-main);color:var(--primary)}
.fanctrl-stepper button:disabled{opacity:.45;cursor:not-allowed}
.fanctrl-stepper input{width:100%;height:34px;border:0;border-left:1px solid var(--divider);border-right:1px solid var(--divider);background:transparent;color:var(--text-regular);font-size:13px;text-align:center;outline:0;appearance:textfield;-moz-appearance:textfield}
.fanctrl-stepper input::-webkit-outer-spin-button,.fanctrl-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.fanctrl-stepper span{font-size:12px;color:var(--text-weak);text-align:center}
.fanctrl-stepper:focus-within{border-color:var(--primary)}
.fanctrl-toggle{display:inline-flex;gap:0;border:1px solid var(--divider);border-radius:4px;overflow:hidden;background:var(--background-card)}
.fanctrl-toggle button{height:34px;min-width:82px;border:0;border-right:1px solid var(--divider);padding:0 14px;background:transparent;color:var(--text-regular);cursor:pointer}
.fanctrl-toggle button:last-child{border-right:0}.fanctrl-toggle button.active{background:var(--primary);color:#fff}.fanctrl-toggle button:disabled{opacity:.55;cursor:not-allowed}
.fanctrl-side{min-width:0}
.fanctrl-output{padding:16px;border-radius:5px;border:1px solid var(--divider);background:var(--background-main);margin-bottom:16px}
.fanctrl-output-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.fanctrl-output-head strong{font-size:14px;color:var(--text-regular)}.fanctrl-output-head span{font-size:24px;font-weight:600;color:var(--primary)}
.fanctrl-slider-note{margin-top:8px;font-size:12px;line-height:18px;color:var(--text-weak)}
.fanctrl-curve{padding:16px;border-radius:5px;border:1px solid var(--divider);background:var(--background-main)}
.fanctrl-curve-line{position:relative;height:8px;border-radius:99px;background:var(--divider);overflow:hidden;margin:16px 0 12px}
.fanctrl-curve-line:after{content:"";position:absolute;inset:0;width:62%;border-radius:inherit;background:var(--primary);opacity:.85}
.fanctrl-curve-legend{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fanctrl-curve-legend span{font-size:12px;color:var(--text-weak)}.fanctrl-curve-legend strong{display:block;margin-top:3px;color:var(--text-regular);font-size:13px}
.fanctrl-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:2px}
.fanctrl-native-button{height:36px;border-radius:4px;border:1px solid var(--divider);background:var(--background-card);color:var(--text-regular);padding:0 16px;cursor:pointer}.fanctrl-native-button.primary{border-color:var(--primary);background:var(--primary);color:#fff}.fanctrl-native-button:disabled{opacity:.55;cursor:not-allowed}
.fanctrl-alert{margin-bottom:20px;padding:12px 14px;border-radius:5px;background:var(--error-background);color:var(--error);border:1px solid var(--error)}
.fanctrl-wrapper .el-slider{width:100%}.fanctrl-wrapper .el-switch{vertical-align:middle}
@media (max-width:1100px){.fanctrl-overview{grid-template-columns:1fr}.fanctrl-visual{border-right:0;border-bottom:1px solid var(--divider);min-height:176px}.fanctrl-settings{grid-template-columns:1fr}.fanctrl-side{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fanctrl-output,.fanctrl-curve{margin-bottom:0}}
@media (max-width:760px){.fanctrl-wrapper{padding:14px 0}.fanctrl-quick,.fanctrl-services,.fanctrl-side{grid-template-columns:1fr}.fanctrl-list li{grid-template-columns:1fr;gap:8px}.fanctrl-control{justify-content:flex-start}.fanctrl-actions{flex-direction:column}.fanctrl-native-button{width:100%}.fanctrl-status-row{align-items:flex-start;flex-direction:column}.fanctrl-status-actions{width:100%;justify-content:space-between}}
@keyframes fanctrl-spin{to{transform:rotate(360deg)}}
`;

const componentBody = `
var FANCTRL_STYLE_ID = "gl-fanctrl-style";
var FANCTRL_STYLE = ${JSON.stringify(styles)};
function installStyle() {
  if (document.getElementById(FANCTRL_STYLE_ID)) return;
  var style = document.createElement("style");
  style.id = FANCTRL_STYLE_ID;
  style.textContent = FANCTRL_STYLE;
  document.head.appendChild(style);
}
function num(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}
function clamp(value, min, max) {
  var n = num(value, min);
  if (n < min) return min;
  if (n > max) return max;
  return Math.floor(n);
}
function normalizeConfig(cfg) {
  var next = Object.assign({}, cfg || {});
  next.enabled = next.enabled === true || next.enabled === 1 ? 1 : 0;
  next.mode = next.mode === "manual" ? "manual" : "auto";
  next.start_temp = clamp(next.start_temp, 35, 85);
  next.wall_temp = clamp(next.wall_temp, 40, 95);
  if (next.wall_temp < next.start_temp + 5) next.wall_temp = next.start_temp + 5;
  if (next.wall_temp > 95) next.wall_temp = 95;
  next.critical_temp = clamp(next.critical_temp, 43, 105);
  if (next.critical_temp < next.wall_temp + 3) next.critical_temp = next.wall_temp + 3;
  if (next.critical_temp > 105) next.critical_temp = 105;
  next.hysteresis = clamp(next.hysteresis, 1, 10);
  next.start_percent = clamp(next.start_percent, 0, 100);
  next.max_percent = clamp(next.max_percent, 0, 100);
  if (next.max_percent < next.start_percent) next.max_percent = next.start_percent;
  next.manual_percent = clamp(next.manual_percent, 0, 100);
  next.poll_interval = clamp(next.poll_interval, 1, 30);
  return next;
}
return {
  name: "FanctrlView",
  data: function () {
    return {
      state: {
        supported: true,
        official_running: false,
        plugin_running: false,
        takeover: false,
        pwm: 0,
        rpm: 0,
        temperature: null,
        state: "unknown",
        config: {
          enabled: 0,
          mode: "auto",
          start_temp: 70,
          wall_temp: 76,
          critical_temp: 88,
          hysteresis: 3,
          start_percent: 35,
          max_percent: 100,
          manual_percent: 0,
          poll_interval: 2
        }
      },
      draft: null,
      loading: false,
      saving: false,
      dirty: false,
      manualBusy: false,
      manualDraft: 0,
      numberDrafts: {},
      manualSeq: 0,
      manualTimer: null,
      timer: null
    };
  },
  created: function () {
    installStyle();
    this.refresh();
    var self = this;
    this.timer = setInterval(function () { self.refresh(); }, 4000);
  },
  beforeDestroy: function () {
    if (this.timer) clearInterval(this.timer);
    if (this.manualTimer) clearTimeout(this.manualTimer);
  },
  methods: {
    t: function (key) {
      return this.$t("fanctrl." + key);
    },
    rpc: function (method, params) {
      var token = window.$getCookie ? window.$getCookie("Admin-Token") : "";
      return this.$request("call", [token || "sid", "fanctrl", method, params || {}]);
    },
    messageOk: function () {
      if (this.$message && this.$message.success) this.$message.success(this.t("saved"));
    },
    normalize: function (res) {
      var next = res && res.result ? res.result : res;
      if (!next) return;
      next.config = Object.assign({}, this.state.config, next.config || {});
      next.config = normalizeConfig(next.config);
      this.state = Object.assign({}, this.state, next);
      if (!this.saving && !this.dirty) {
        this.draft = Object.assign({}, next.config);
        this.numberDrafts = {};
      }
      if (!this.manualBusy) {
        this.manualDraft = num(next.config.manual_percent, 0);
      }
    },
    currentConfig: function () {
      return normalizeConfig(Object.assign({}, this.state.config, this.draft || {}));
    },
    refresh: async function () {
      if (this.saving || this.manualBusy) return;
      this.loading = true;
      try {
        this.normalize(await this.rpc("get_status", {}));
      } finally {
        this.loading = false;
      }
    },
    updateConfig: function (key, value) {
      if (!this.draft) this.draft = Object.assign({}, this.state.config);
      this.draft[key] = value;
      this.draft = normalizeConfig(this.draft);
      this.dirty = true;
    },
    setConfig: async function (patch, showMessage) {
      this.saving = true;
      try {
        var cfg = normalizeConfig(Object.assign({}, this.currentConfig(), patch || {}));
        this.draft = cfg;
        this.normalize(await this.rpc("set_config", cfg));
        this.dirty = false;
        this.draft = Object.assign({}, this.state.config);
        this.numberDrafts = {};
        this.manualDraft = num(this.state.config.manual_percent, this.manualDraft);
        if (showMessage) this.messageOk();
      } finally {
        this.saving = false;
      }
    },
    toggleMode: async function (mode) {
      await this.setConfig({ mode: mode }, false);
    },
    toggleEnabled: async function (enabled) {
      await this.setConfig({ enabled: enabled ? 1 : 0 }, true);
    },
    apply: async function () {
      await this.setConfig({}, true);
    },
    restore: async function () {
      try {
        if (this.$glConfirm) await this.$glConfirm(this.t("restore_confirm"));
        this.saving = true;
        this.normalize(await this.rpc("restore_defaults", {}));
        this.dirty = false;
        this.numberDrafts = {};
        this.messageOk();
      } catch (e) {
      } finally {
        this.saving = false;
      }
    },
    setManual: async function (persist, value) {
      var nextValue = clamp(value == null ? this.manualDraft : value, 0, 100);
      var seq = ++this.manualSeq;
      this.manualDraft = nextValue;
      this.manualBusy = true;
      try {
        this.draft = normalizeConfig(Object.assign({}, this.currentConfig(), { enabled: 1, mode: "manual", manual_percent: nextValue }));
        this.dirty = false;
        var res = await this.rpc("set_manual", { percent: nextValue, persist: persist === true });
        if (seq === this.manualSeq) {
          this.normalize(res);
          this.draft = Object.assign({}, this.state.config);
          this.manualDraft = nextValue;
        }
      } finally {
        if (seq === this.manualSeq) this.manualBusy = false;
      }
    },
    scheduleManual: function (persist, value) {
      var self = this;
      var nextValue = clamp(value == null ? this.manualDraft : value, 0, 100);
      this.manualDraft = nextValue;
      if (this.manualTimer) clearTimeout(this.manualTimer);
      if (persist === true) {
        this.setManual(true, nextValue);
        return;
      }
      this.manualTimer = setTimeout(function () {
        self.setManual(false, nextValue);
      }, 120);
    },
    numberControl: function (h, key, min, max, unit) {
      var self = this;
      var cfg = this.currentConfig();
      var value = num(cfg[key], min);
      var raw = Object.prototype.hasOwnProperty.call(this.numberDrafts, key) ? this.numberDrafts[key] : String(value);
      var setRaw = function (next) {
        var copy = Object.assign({}, self.numberDrafts);
        copy[key] = next;
        self.numberDrafts = copy;
        self.dirty = true;
      };
      var commit = function (next) {
        var copy = Object.assign({}, self.numberDrafts);
        delete copy[key];
        self.numberDrafts = copy;
        self.updateConfig(key, clamp(next, min, max));
      };
      return h("div", { class: "fanctrl-stepper" }, [
        h("button", {
          attrs: { type: "button", disabled: this.saving || value <= min },
          on: { click: function () { commit(value - 1); } }
        }, "-"),
        h("input", {
          attrs: {
            type: "number",
            min: min,
            max: max,
            step: 1,
            inputmode: "numeric",
            disabled: this.saving
          },
          domProps: { value: raw },
          on: {
            input: function (event) { setRaw(event.target.value); },
            change: function (event) { commit(event.target.value); },
            blur: function (event) { commit(event.target.value); },
            keydown: function (event) {
              if (event.key === "Enter") {
                commit(event.target.value);
                event.target.blur();
              }
            }
          }
        }),
        h("button", {
          attrs: { type: "button", disabled: this.saving || value >= max },
          on: { click: function () { commit(value + 1); } }
        }, "+"),
        h("span", unit || "")
      ]);
    },
    nativeButton: function (h, text, type, click, disabled) {
      return h("button", {
        class: { "fanctrl-native-button": true, primary: type === "primary" },
        attrs: { disabled: !!disabled },
        on: { click: click }
      }, text);
    },
    serviceRow: function (h, label, active, warn, idle) {
      return h("div", { class: "fanctrl-service" }, [
        h("span", label),
        h("i", { class: { "fanctrl-dot": true, on: !!active, warn: !!warn, idle: !!idle } })
      ]);
    },
    settingItem: function (h, title, desc, control) {
      return h("li", [
        h("div", { class: "fanctrl-label" }, [h("strong", title), desc ? h("span", desc) : null]),
        h("div", { class: "fanctrl-control" }, [control])
      ]);
    }
  },
  render: function (h) {
    var self = this;
    var cfg = this.currentConfig();
    var enabled = cfg.enabled === 1 || cfg.enabled === true;
    var statusText = this.state.takeover ? this.t("running") : (enabled ? this.t("starting") : this.t("not_running"));
    var statusClass = this.state.takeover ? "is-on" : (enabled ? "is-warn" : "is-idle");
    var fan = h("div", { class: "fanctrl-fanbox" }, [
      h("div", {
        class: { "fanctrl-fan": true, spin: this.state.pwm > 0 },
        style: { animationDuration: Math.max(0.35, 2.2 - (this.state.pwm || 0) / 60) + "s" }
      }, [h("i"), h("i"), h("i"), h("i")])
    ]);
    var quickItems = [
      ["temperature", this.state.temperature == null ? "--" : this.state.temperature + " C"],
      ["fan_speed", (this.state.rpm || 0) + " RPM"],
      ["pwm", (this.state.pwm || 0) + "%"],
      ["mode", cfg.mode === "manual" ? this.t("manual") : this.t("auto")]
    ].map(function (item) {
      return h("div", { class: "fanctrl-quick-item" }, [h("span", self.t(item[0])), h("strong", item[1])]);
    });
    var enableSwitch = h("el-switch", {
      props: { value: enabled, disabled: this.saving },
      on: { input: function (value) { self.toggleEnabled(!!value); } }
    });
    var takeoverToggle = h("div", { class: "fanctrl-status-actions" }, [
      h("span", { class: "fanctrl-status-action-label" }, this.t("takeover")),
      enableSwitch
    ]);
    var modeToggle = h("div", { class: "fanctrl-toggle" }, [
      h("button", { class: { active: cfg.mode === "auto" }, attrs: { disabled: this.saving }, on: { click: function () { self.toggleMode("auto"); } } }, this.t("auto")),
      h("button", { class: { active: cfg.mode === "manual" }, attrs: { disabled: this.saving }, on: { click: function () { self.toggleMode("manual"); } } }, this.t("manual"))
    ]);
    var manualSlider = h("el-slider", {
      props: {
        value: this.manualDraft,
        min: 0,
        max: 100,
        disabled: cfg.mode !== "manual" || this.saving,
        showInput: false,
        showTooltip: true,
        formatTooltip: function (value) { return value + "%"; }
      },
      on: {
        input: function (value) { self.scheduleManual(false, value); },
        change: function (value) { self.scheduleManual(true, value); }
      }
    });
    var wallMin = Math.min(95, cfg.start_temp + 5);
    var criticalMin = Math.min(105, cfg.wall_temp + 3);
    var autoItems = [
      this.settingItem(h, this.t("start_temp"), "35 - 85 C", this.numberControl(h, "start_temp", 35, 85, "C")),
      this.settingItem(h, this.t("wall_temp"), wallMin + " - 95 C", this.numberControl(h, "wall_temp", wallMin, 95, "C")),
      this.settingItem(h, this.t("critical_temp"), criticalMin + " - 105 C", this.numberControl(h, "critical_temp", criticalMin, 105, "C")),
      this.settingItem(h, this.t("hysteresis"), "1 - 10 C", this.numberControl(h, "hysteresis", 1, 10, "C"))
    ];
    var pwmItems = [
      this.settingItem(h, this.t("start_percent"), "0 - 100%", this.numberControl(h, "start_percent", 0, 100, "%")),
      this.settingItem(h, this.t("max_percent"), "0 - 100%", this.numberControl(h, "max_percent", 0, 100, "%")),
      this.settingItem(h, this.t("poll_interval"), "1 - 30 s", this.numberControl(h, "poll_interval", 1, 30, "s"))
    ];
    return h("div", { class: "fanctrl-wrapper" }, [
      h("gl-title", { attrs: { title: this.$t("menu_fanctrl") } }),
      this.state.supported ? null : h("div", { class: "fanctrl-alert" }, this.t("unsupported")),
      h("gl-card", { class: "fanctrl-card fanctrl-overview-card" }, [
        h("div", { class: "fanctrl-overview" }, [
          h("div", { class: "fanctrl-visual" }, [fan, h("div", { class: "fanctrl-mode-chip " + statusClass }, statusText)]),
          h("div", { class: "fanctrl-summary" }, [
            h("div", { class: "fanctrl-status-row" }, [
              h("div", [h("h2", this.t("status")), h("p", this.state.state || "")]),
              takeoverToggle
            ]),
            h("div", { class: "fanctrl-quick" }, quickItems),
            h("div", { class: "fanctrl-services" }, [
              this.serviceRow(h, this.t("plugin"), enabled && this.state.plugin_running, enabled !== this.state.plugin_running, !enabled && !this.state.plugin_running),
              this.serviceRow(h, this.t("official"), !enabled && this.state.official_running, enabled === this.state.official_running, enabled && !this.state.official_running)
            ])
          ])
        ])
      ]),
      h("gl-card", { class: "fanctrl-card fanctrl-config-card" }, [
        h("div", { class: "fanctrl-settings" }, [
          h("div", { class: "fanctrl-panel" }, [
            h("div", { class: "fanctrl-section" }, [
              h("div", { class: "fanctrl-section-head" }, [h("h3", this.t("mode")), modeToggle]),
              h("ul", { class: "fanctrl-list" }, autoItems)
            ]),
            h("div", { class: "fanctrl-section" }, [
              h("div", { class: "fanctrl-section-head" }, [h("h3", this.t("pwm")), h("span", this.t("manual_percent"))]),
              h("ul", { class: "fanctrl-list" }, pwmItems)
            ])
          ]),
          h("div", { class: "fanctrl-side" }, [
            h("div", { class: "fanctrl-output" }, [
              h("div", { class: "fanctrl-output-head" }, [h("strong", this.t("manual_percent")), h("span", this.manualDraft + "%")]),
              manualSlider,
              h("div", { class: "fanctrl-slider-note" }, this.t("manual_hint"))
            ]),
            h("div", { class: "fanctrl-curve" }, [
              h("div", { class: "fanctrl-section-head" }, [h("h3", this.t("auto")), h("span", this.t("wall_temp"))]),
              h("div", { class: "fanctrl-curve-line" }),
              h("div", { class: "fanctrl-curve-legend" }, [
                h("span", [this.t("start_temp"), h("strong", cfg.start_temp + " C")]),
                h("span", [this.t("wall_temp"), h("strong", cfg.wall_temp + " C")]),
                h("span", [this.t("critical_temp"), h("strong", cfg.critical_temp + " C")])
              ])
            ])
          ])
        ]),
        h("div", { class: "fanctrl-actions" }, [
          this.nativeButton(h, this.t("refresh"), "secondary", this.refresh, this.loading || this.saving),
          this.nativeButton(h, this.t("restore"), "secondary", this.restore, this.saving),
          this.nativeButton(h, this.t("save"), "primary", this.apply, this.saving)
        ])
      ])
    ]);
  }
};
`;

const bundle = `(function(){${componentBody}\n})()`;

fs.writeFileSync(path.join(viewsDir, 'gl-sdk4-ui-fanctrl.common.js.gz'), zlib.gzipSync(Buffer.from(bundle, 'utf8')));
console.log('built package/data/www/views/gl-sdk4-ui-fanctrl.common.js.gz');
