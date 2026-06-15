# gl-fanctrl

GL.iNet SDK4 官方管理界面的 PWM 风扇控制插件，面向 GL-MT3000 等便携系列路由器。插件以 IPK 形式安装，提供原生 GL.iNet UI 页面、Lua RPC 接口和轻量级 procd 守护进程，用于安全接管风扇、配置自动温控曲线和手动调节 PWM 转速。

> 当前已在 GL.iNet GL-MT3000 上验证。其它同类设备会尝试通过 sysfs 自动探测风扇与温度路径，但尚未逐一验证。

## 功能特性

- 原生 GL.iNet SDK4 UI 集成，不依赖 LuCI。
- 安装后默认不接管风扇，官方 `gl_fan` 服务保持运行。
- 在 UI 中开启接管后，插件停止官方 `gl_fan`，由 `gl_fanctrl` 守护进程控制风扇。
- 自动模式支持起转温度、温度墙、保护温度、回差、起转 PWM、最大 PWM 和轮询间隔。
- 手动模式支持 0-100% 滑条调节，拖动时写运行态，松手后持久化，减少 flash 写入。
- 手动调速会立即应用到 PWM sysfs，避免等待下一次轮询。
- PWM 输出受 `max_percent` 和内核 `max_state` 双重限制，避免写出设备允许范围。
- 温度读取失败、达到保护温度或 PWM 写入失败时进入安全保护逻辑。
- 禁用或卸载插件后会恢复官方风扇服务。
- 提供 GitHub Actions 工作流，可自动构建并上传 IPK artifact。

## 项目状态

当前版本：`0.1.0`

已验证设备：

- GL.iNet GL-MT3000
- OpenWrt 21.02-SNAPSHOT
- GL.iNet SDK4 UI
- `kmod-gl-sdk4-fan`
- `kmod-hwmon-pwmfan`

主要 sysfs 路径由运行时自动探测：

- 温度：优先 `/proc/gl-hw-info/temperature`，再扫描 `/sys/class/thermal`
- 风扇：优先 `/proc/gl-hw-info/fan`，再扫描 `cooling_device*`
- PWM：优先 `/sys/class/thermal/cooling_device*/cur_state`
- RPM：通过 `/sys/class/hwmon/hwmon*/fan1_input` 尽力读取

## 安全设计

这个插件直接写入风扇 PWM sysfs，因此默认策略偏保守：

- 安装后 `enabled=0`，不会自动接管风扇。
- 接管失败时不会强行关闭官方风扇服务。
- 禁用插件时会停止插件守护进程并恢复官方 `gl_fan`。
- 手动模式下，`manual_percent=0` 表示停转；`1..100` 会按 `start_percent..max_percent` 约束输出，避免过低 PWM 起转失败。
- 所有最终 PWM 写入都会被限制在 `0..max_percent`。
- 写入 sysfs 前会根据内核暴露的 `max_state` 换算为合法 `cur_state`。
- 温度达到 `critical_temp` 时，自动模式和手动模式都会使用安全输出上限。
- 连续温度读取失败时进入保护状态。
- PWM 写入失败时，插件会停止自身并尝试恢复官方风扇服务。

建议首次使用时将 `max_percent` 设置为较低值，例如 `40..60`，确认风扇响应正常后再逐步调整。

## UI 说明

安装后进入 GL.iNet 官方管理界面，打开：

```text
/#/fanctrl
```

页面包含：

- 当前温度
- 风扇 RPM
- 当前 PWM
- 当前模式
- 接管状态开关
- 插件服务状态
- 官方风扇服务状态
- 自动温控曲线配置
- 手动 PWM 滑条

如果升级后页面仍显示旧样式，请强刷浏览器页面，或退出官方管理界面后重新登录。GL.iNet SDK4 UI 会缓存页面 bundle。

## 默认配置

安装后的默认 UCI 配置位于：

```text
/etc/config/gl_fanctrl
```

默认值：

```text
enabled=0
mode=auto
start_temp=70
wall_temp=76
critical_temp=88
hysteresis=3
start_percent=35
max_percent=100
manual_percent=0
poll_interval=2
```

字段说明：

| 字段 | 说明 | 范围 |
| --- | --- | --- |
| `enabled` | 是否接管风扇 | `0` 或 `1` |
| `mode` | 控制模式 | `auto` 或 `manual` |
| `start_temp` | 起转温度 | `35..85` |
| `wall_temp` | 温度墙，达到后使用最大 PWM | `start_temp + 5 .. 95` |
| `critical_temp` | 保护温度 | `wall_temp + 3 .. 105` |
| `hysteresis` | 回差，避免临界点频繁启停 | `1..10` |
| `start_percent` | 起转 PWM 下限 | `0..100` |
| `max_percent` | PWM 输出上限 | `0..100` |
| `manual_percent` | 手动模式 PWM 请求值 | `0..100` |
| `poll_interval` | 守护进程轮询间隔，单位秒 | `1..30` |

## 控制逻辑

自动模式：

```text
temperature < start_temp - hysteresis  => PWM 0%
start_temp <= temperature < wall_temp  => start_percent..max_percent 线性映射
temperature >= wall_temp               => max_percent
temperature >= critical_temp           => max_percent
```

手动模式：

```text
manual_percent = 0       => PWM 0%
manual_percent = 1..100  => clamp(manual_percent, start_percent, max_percent)
temperature >= critical_temp => max_percent
```

所有模式在最终写入前都会再执行一次：

```text
target_pwm = clamp(target_pwm, 0, max_percent)
cur_state = target_pwm * max_state / 100
```

## RPC 接口

插件安装 Lua RPC 对象：

```text
/usr/lib/oui-httpd/rpc/fanctrl
```

支持方法：

| 方法 | 说明 |
| --- | --- |
| `fanctrl.get_status({})` | 读取支持状态、温度、RPM、PWM、服务状态和当前配置 |
| `fanctrl.set_config({...})` | 保存启用状态、模式和自动曲线参数 |
| `fanctrl.set_manual({ percent, persist })` | 设置手动 PWM，`persist=false` 只写运行态，`persist=true` 同步写入 UCI |
| `fanctrl.restore_defaults({})` | 恢复默认配置 |

本机调试示例：

```sh
curl -s -H glinet:1 -X POST http://127.0.0.1/rpc \
  -d '{"jsonrpc":"2.0","method":"call","params":["","fanctrl","get_status",{}],"id":1}'
```

## 构建

需要 Node.js 20 或更高版本。

```sh
npm run build:ipk
```

输出文件：

```text
dist/gl-fanctrl_0.1.0_all.ipk
```

检查 IPK 内容：

```sh
npm run check:ipk
```

可选语法检查：

```sh
npm run lint:shell
npm run lint:lua
```

Windows 环境如果没有 `sh` 或 `lua5.1`，可以依赖 GitHub Actions 或在路由器上执行等价检查。

## GitHub Actions

仓库已包含工作流：

```text
.github/workflows/build-ipk.yml
```

每次 push 或 pull request 会执行：

1. 安装 Lua 5.1 校验器
2. 检查 shell 脚本语法
3. 检查 Lua 文件语法
4. 构建 IPK
5. 检查 IPK 内容
6. 上传 `dist/*.ipk` artifact

## 安装

将生成的 IPK 上传到路由器：

```sh
scp dist/gl-fanctrl_0.1.0_all.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 "opkg install /tmp/gl-fanctrl_0.1.0_all.ipk"
```

升级安装：

```sh
ssh root@192.168.1.1 "opkg install /tmp/gl-fanctrl_0.1.0_all.ipk"
```

卸载：

```sh
ssh root@192.168.1.1 "opkg remove gl-fanctrl"
```

卸载脚本会尝试恢复官方 `gl_fan` 服务。

## 路由器实机测试

不要把路由器密码写入仓库。使用环境变量运行 smoke test：

```powershell
$env:GL_ROUTER_HOST='192.168.1.1'
$env:GL_ROUTER_USER='root'
$env:GL_ROUTER_PASSWORD='your-password'
python scripts/router-smoke.py
```

测试脚本会：

- 上传当前 `dist/gl-fanctrl_0.1.0_all.ipk`
- 移除旧版本
- 安装新版本
- 打印 UCI 配置
- 检查官方风扇服务和插件服务进程
- 调用 `fanctrl.get_status`

## 发布前检查清单

建议每次发布前执行：

```sh
npm run build:ipk
npm run check:ipk
```

在路由器上额外检查：

```sh
ash -n /etc/init.d/gl_fanctrl /usr/sbin/gl-fanctrl-daemon /usr/share/fanctrl/fanctrl-common.sh
lua -e 'assert(loadfile("/usr/lib/oui-httpd/rpc/fanctrl")); assert(loadfile("/usr/share/gl-validator.d/fanctrl.lua")); print("lua-ok")'
```

建议实测流程：

1. 安装后确认 `enabled=0`，官方 `gl_fan` 仍运行。
2. 打开 `/#/fanctrl`，确认页面显示正常。
3. 调整起转温度、温度墙、保护温度、回差并应用，确认保存后不回滚。
4. 切换手动模式，拖动 PWM 到 `0%`、`50%`、`100%`，确认滑条不回弹。
5. 设置较低 `max_percent`，再拖到 `100%`，确认实际 PWM 不超过上限。
6. 禁用接管，确认官方 `gl_fan` 恢复运行。
7. 卸载插件，确认官方 `gl_fan` 仍可运行。

## 项目结构

```text
.
├── .github/workflows/build-ipk.yml
├── package/
│   ├── control/                  # IPK control、postinst、prerm、postrm
│   └── data/                     # 安装到路由器的文件树
│       ├── etc/config/gl_fanctrl
│       ├── etc/init.d/gl_fanctrl
│       ├── usr/lib/oui-httpd/rpc/fanctrl
│       ├── usr/sbin/gl-fanctrl-daemon
│       ├── usr/share/fanctrl/fanctrl-common.sh
│       ├── usr/share/gl-validator.d/fanctrl.lua
│       ├── usr/share/oui/menu.d/fanctrl.json
│       └── www/i18n/
├── scripts/
│   ├── build-ipk.js
│   ├── build-ipk.sh
│   ├── check-ipk.js
│   └── router-smoke.py
├── src/ui/build.js               # SDK4 UI bundle 生成脚本
├── package.json
└── README.md
```

## 故障排查

页面空白：

- 强刷浏览器页面。
- 退出官方管理界面并重新登录。
- 确认 `/www/views/gl-sdk4-ui-fanctrl.common.js.gz` 存在。
- 确认 `/usr/share/oui/menu.d/fanctrl.json` 存在。

RPC 无响应：

- 安装或升级后等待 nginx 重启完成。
- 执行 `/etc/init.d/nginx restart`。
- 检查 `/usr/lib/oui-httpd/rpc/fanctrl` 是否存在。

接管失败：

- 检查 `/etc/config/gl_fanctrl` 中 `enabled` 是否为 `1`。
- 检查 `/etc/init.d/gl_fanctrl start` 是否报错。
- 检查 `/sys/class/thermal/cooling_device*/cur_state` 是否存在且可写。

风扇不转：

- 确认手动模式 `manual_percent` 大于 `0`。
- 提高 `start_percent`，部分风扇低 PWM 无法起转。
- 查看状态中的 `rpm` 和 `pwm_state`。

升级后仍是旧逻辑：

- 插件安装脚本会重启 nginx 清理 RPC 缓存。
- 如果页面仍旧，强刷浏览器或重新登录官方 UI。

## 贡献

欢迎提交 issue 和 pull request。提交问题时请附上：

- 路由器型号
- 固件版本
- `/proc/gl-hw-info/fan`
- `/proc/gl-hw-info/temperature`
- `fanctrl.get_status` 输出
- 复现步骤

请不要提交路由器密码、私有 IP 以外的真实网络信息、浏览器登录 token 或其它敏感数据。
