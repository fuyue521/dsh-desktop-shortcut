# dsh-desktop-shortcut 桌面快捷方式启动速度优化方案

> 文档版本：0.1  
> 日期：2026-08-18  
> 适用项目：`C:\Users\m1527\Desktop\dsh-desktop-shortcut-main`  
> 相关代码：`lib/index.js`、`cordis.patch.yml`

---

## 1. 背景与目标

当前双击桌面上的 `DeepSeek Harness` 快捷方式后，从点击到看到可交互的 Web UI，通常需要 8-15 秒。主要成本来自 PowerShell 冷启动、`dsh web` 冷启动、launcher 内的 HTTP 轮询，以及浏览器每次使用全新 profile 启动。

优化目标：

1. 常规模式（每次冷启动 dsh）：感知等待降到 5 秒以内。
2. 常驻服务模式（keepAlive）：快捷方式基本秒开。
3. 不改变既有行为：`closeBrowserStopsService`、`browser`、`port/url` 等配置语义保持兼容。
4. 所有优化默认可配置、可回退。

---

## 2. 当前启动链路

```text
双击 .lnk
  └─ powershell.exe -NoProfile -File start-dsh-web.ps1
       ├─ 探测 http://127.0.0.1:3080 是否已在运行
       ├─ 未运行：cmd /k dsh web（打开控制台窗口）
       ├─ 轮询 Web UI 就绪（最多 15 秒）
       ├─ 轮询插件 bundle 路由就绪（最多 5 秒）
       ├─ 清理旧的 app-mode 浏览器进程
       └─ 启动 Edge/Chrome app 模式窗口
```

其中每一步都是串行执行，任意一步慢都会直接累加到总等待时间。

---

## 3. 耗时构成分析

| 阶段 | 典型耗时 | 说明 |
|---|---|---|
| PowerShell 5.1 冷启动 | 1-2 秒 | 每个快捷方式都会重新拉起 |
| `dsh web` 冷启动 | 3-10 秒 | 插件树、profile 组合、服务初始化 |
| Web UI 轮询 | 最坏约 15 秒 | 每次失败探测最多 1.25 秒（250ms 等待 + 1s 请求超时） |
| 插件 bundle 轮询 | 最多 5 秒 | 硬编码检查 `/plugins/@deepseek-ai/dsh-session-log-export/client.js` |
| 浏览器全新 profile | 1-2 秒 | 每次启动都新建 `profile-{ticks}` 并删除旧目录 |

结论：真正的大头是 `dsh web` 冷启动，但轮询参数和浏览器 profile 策略也贡献了 5-7 秒，属于低风险可优化项。

---

## 4. 测量先行：启动计时日志

优化前先加计时，避免靠感觉调优。

### 4.1 方案

launcher 内每个阶段记录时间戳：

```text
launcher_start
probe_start / probe_result
dsh_spawn
ui_ready
plugin_ready
browser_launch
browser_exit
```

输出到：

```text
%LOCALAPPDATA%\DeepSeekHarness\logs\startup-timing.log
```

### 4.2 实现要点

- 用 `[System.Diagnostics.Stopwatch]` 计时，或记录 `Get-Date` 差值。
- 每次启动追加一行 TSV（制表符分隔），便于后续做统计。
- 失败阶段也记录，包括异常信息。

### 4.3 验收

- 每次双击后日志中能看到各阶段耗时。
- 对比优化前后同机器同 profile 的数据。

---

## 5. 快赢优化（改动小、风险低）

### 5.1 缩短 HTTP 探测开销

**现状**

```powershell
Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 1
Start-Sleep -Milliseconds 250
```

服务未就绪时，一次失败探测最长约 1.25 秒。

**改法**

- 探测超时从 `1s` 降到 `300ms`。
- 轮询间隔从 `250ms` 降到 `100ms`。
- 插件轮询间隔从 `200ms` 降到 `100ms`。

**收益**

最坏等待从约 15 秒降到约 5 秒，正确性不受影响。

**风险**

极低。慢网络或本机负载高时，探测可能更快返回失败，但只是多轮询几次。

### 5.2 插件就绪检查改为非阻塞

**现状**

```powershell
$pluginCheckUrl = $webUrl + '/plugins/@deepseek-ai/dsh-session-log-export/client.js'
```

该路由不属于本插件，profile 里没有对应插件时会空等最多 5 秒。

**改法**

- 方案 A：检查时间降到 1 秒，超时后直接打开浏览器。
- 方案 B：完全去掉该检查，改为浏览器打开后页面自动重试，或依赖已有的悬浮刷新按钮。

**收益**

每次启动减少 0-5 秒。

**风险**

极端情况下首屏可能出现"插件未加载"，需要刷新。可结合第 6.2 节的加载页自动重试缓解。

### 5.3 去掉 `cmd /k` 中转

**现状**

```powershell
Start-Process -FilePath $env:ComSpec -ArgumentList ('/k "' + $dshCmd + '" ' + $dshArgs)
```

多一层 `cmd.exe`，并且会弹出一个可见控制台窗口。

**改法**

- 直接 `Start-Process -FilePath $dshCmd -ArgumentList $dshArgs -WindowStyle Hidden`。
- 或解析 `dsh.cmd` 后直接调用 `node <dsh>/lib/bin.js web`，省掉 cmd 和 shim。

**收益**

- 少一个进程。
- 没有控制台窗口闪烁。
- 后台服务更干净。

**注意**

- `closeBrowserStopsService: true` 时，原来"等待控制台关闭"的路径需要改用 `Wait-Process` 或进程句柄，不能依赖窗口关闭。
- dsh 自身如果依赖交互式控制台，需要验证。

### 5.4 浏览器 profile 复用

**现状**

每次启动都创建全新 profile，启动后删除旧 profile，浏览器冷启动慢。

**改法**

- 方案 A：固定一个 `browser-profile` 目录，复用缓存与登录状态，定期清理。
- 方案 B：维护一个"模板 profile"，每次复制而不是从零初始化。

**收益**

浏览器首屏快 1-2 秒。

**风险**

- 旧状态残留：通过定期清理和 `--disable-sync` 缓解。
- 与"全新环境"的初衷冲突：可作为 `freshBrowserProfile: true/false` 配置项。

### 5.5 浏览器启动参数精简

评估 `--disable-extensions`、`--disable-background-networking`、`--disable-sync`、`--disable-background-mode` 等参数对首屏的影响。若收益不明显，保留默认即可。

---

## 6. 启动器轻量化

### 6.1 Node launcher 替代 PowerShell

**动机**

PowerShell 5.1 冷启动 1-2 秒，而 dsh 本身就是 Node 应用，用户机器必然有 Node。

**改法**

```text
DeepSeek Harness.lnk
  └─ node.exe start-dsh-web.mjs
```

launcher 逻辑不变，只是运行环境从 PowerShell 换成 Node：

- 启动 dsh web（`child_process.spawn`）
- HTTP 探测（`fetch` 或 `http`）
- 清理浏览器进程
- 启动浏览器

**收益**

launcher 冷启动从 1-2 秒降到 100-200ms。

**风险**

- 需要解析 `node.exe` 路径（`Get-Command node` 或固定 npm 全局路径）。
- PowerShell 版本保留作为回退，通过配置切换。

### 6.2 本地加载页 + 自动跳转

**动机**

让用户"双击后立刻看到反馈"，而不是盯着空白等待。

**方案**

launcher 启动一个小型本地加载服务：

```text
http://127.0.0.1:3090/loading
  └─ 页面显示 "正在启动 DeepSeek Harness..."
       └─ 页面轮询网关
            └─ 网关探测 dsh 3080
                 └─ 就绪后 location.href = http://127.0.0.1:3080
```

浏览器立即打开加载页，页面自己等待 dsh 就绪，launcher 不再阻塞轮询。

**为什么不用 file:// 页面**

`file://` 页面跨源访问 `http://127.0.0.1` 会受 CORS 限制，直接轮询不可靠。本地小网关（同源 `localhost`）最稳妥，且实现成本低。

**收益**

- 感知启动时间接近 0。
- 服务未就绪时也有明确进度提示。
- 可显示"正在加载插件/服务"等阶段信息。

**风险**

- 多一个本地端口（建议可配置）。
- 需要处理端口冲突与退出清理。

### 6.3 常驻服务模式（keepAlive）

**方案**

在登录时或首次启动后，后台常驻一个 `dsh web`：

```text
schtasks /Create /SC ONLOGON /TN "DeepSeek Harness" /TR "dsh web" /RL LIMITED
```

快捷方式只负责：

1. 探测 3080 端口。
2. 打开浏览器。

**收益**

启动速度基本等于浏览器打开速度，接近秒开。

**代价**

- 常驻内存占用。
- 端口长期占用。
- 多用户/多 profile 需要处理冲突。

**配置建议**

```yaml
keepAlive: true        # 登录后自动常驻
keepAliveMode: login   # login | manual
```

---

## 7. 收益预估与风险对比

| 方案 | 预估收益 | 风险 | 实施量 |
|---|---|---|---|
| 启动计时日志 | 数据支撑，无直接提速 | 低 | 小 |
| 探测参数优化 | 最坏减少约 10 秒 | 低 | 小 |
| 插件检查非阻塞 | 减少 0-5 秒 | 低 | 小 |
| 去掉 cmd 中转 | 少 1 个进程、无控制台闪烁 | 低-中 | 小 |
| 浏览器 profile 复用 | 快 1-2 秒 | 中 | 中 |
| Node launcher | 快 1-2 秒 | 中 | 中 |
| 本地加载页 + 自动跳转 | 感知等待趋近 0 | 中 | 中 |
| keepAlive 常驻 | 接近秒开 | 高 | 中 |
| dsh profile 瘦身 | 冷启动缩短 | 中 | 中 |

---

## 8. 推荐实施顺序

### Phase 1：快赢优化

1. 加启动计时日志。
2. 缩短 HTTP 探测参数。
3. 插件就绪检查非阻塞。
4. 去掉 `cmd /k` 中转。

目标：典型等待从 8-15 秒降到 5-8 秒。

### Phase 2：轻量化启动器

1. Node launcher 替代 PowerShell。
2. 本地加载页 + 自动跳转。
3. 浏览器 profile 复用（可配置）。

目标：感知等待降到 3 秒以内。

### Phase 3：结构性优化

1. keepAlive 常驻模式。
2. dsh profile 瘦身/按需加载。
3. 预预热浏览器缓存。

目标：常用场景接近秒开。

---

## 9. 验收标准

1. 常规模式下，双击到页面可交互的中位时间 ≤ 5 秒。
2. keepAlive 模式下，双击到页面打开 ≤ 2 秒。
3. 启动过程无可见控制台窗口闪烁。
4. 启动日志包含各阶段耗时，可对比优化前后数据。
5. `closeBrowserStopsService: false` 时关闭浏览器不停止 dsh 服务。
6. `closeBrowserStopsService: true` 时关闭浏览器能正常停止服务。
7. 无残留 `dsh web`、浏览器进程或临时 profile。
8. 所有新行为都可通过 `cordis.patch.yml` 配置或回退。

---

## 10. 附录

### 10.1 相关代码位置

```text
lib/index.js
├── buildPowerShell()    # launcher 生成逻辑
├── 探测/轮询参数         # uiReadyTimeout / pluginReadyTimeout
└── apply()              # 配置入口

cordis.patch.yml          # 默认配置与 loader 插入
```

### 10.2 现有相关配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `uiReadyTimeout` | 15000 | Web UI 就绪等待 |
| `pluginReadyTimeout` | 5000 | 插件 bundle 就绪等待 |
| `browser` | auto | auto / edge / chrome |
| `closeBrowserStopsService` | true | 关闭浏览器是否停止服务 |
| `port` / `url` | 3080 | Web UI 地址 |

### 10.3 建议新增配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `probeTimeoutMs` | 300 | 单次 HTTP 探测超时 |
| `probeIntervalMs` | 100 | 就绪轮询间隔 |
| `pluginCheckEnabled` | true | 是否检查插件路由 |
| `hiddenConsole` | 跟随 `closeBrowserStopsService` | 是否隐藏 dsh web 控制台 |
| `freshBrowserProfile` | true | 是否每次新建浏览器 profile |
| `launcherRuntime` | node / powershell | 启动器运行环境 |
| `keepAlive` | false | 常驻服务模式 |
| `loadingPort` | 3090 | 本地加载页端口 |

### 10.4 测量命令

```powershell
# 启动后查看计时日志
Get-Content "$env:LOCALAPPDATA\DeepSeekHarness\logs\startup-timing.log" -Tail 20
```
