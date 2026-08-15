# dsh-desktop-shortcut

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

> [English](README.md) | **中文**

![DeepSeek Harness Icon](assets/DeepSeek%20Harness.png?raw=true)

## 关于本项目

DeepSeek Harness 是一个可组合的 AI agent 运行框架。每次启动 `dsh web` 都要手动敲命令、找路径，多少有点麻烦。

这个插件解决的就是这件事：

- 安装后，`dsh web` 启动后会自动在 Windows 桌面创建/刷新 **DeepSeek Harness** 快捷方式
- 图标使用 DeepSeek 品牌风格的多尺寸 `.ico`
- 只依赖 Node 内置模块和 PowerShell，轻量、无第三方运行时依赖
- 其他平台自动跳过，不影响非 Windows 用户

## 特性

- 安装后，每次启动 `dsh web` 都会自动确保桌面快捷方式存在
- 双击快捷方式会自动启动 `dsh web`，并在 Web UI 就绪后自动打开浏览器
- 默认使用 Edge/Chrome 应用窗口模式，**关闭 Harness 窗口会自动停止服务**
- 使用 DeepSeek 风格图标（`.ico`，包含 256/128/64/48/32/16 多尺寸）
- 快捷方式指向 `cmd.exe /c "dsh.cmd" web`
- 仅 Windows 生效，其他平台自动跳过
- 无第三方运行时依赖，只使用 Node 内置模块和 PowerShell

## 安装

需要先安装 [pnpm](https://pnpm.io/)，然后在你自己的 DeepSeek Harness 环境中执行。

### 安装 pnpm

```bash
npm install -g pnpm
```

或者使用 Corepack：

```bash
corepack enable pnpm
```

### 从 npm 安装（推荐）

```bash
dsh plugin --profile web add dsh-desktop-shortcut
```

### 从 GitHub 安装

```bash
dsh plugin --profile web add github:fuyue521/dsh-desktop-shortcut
```

### 从本地目录安装

```bash
cd dsh-desktop-shortcut
dsh plugin --profile web add .
```

`dsh plugin` 会自动识别包里的 `dsh.bundle` 声明，并把它加入该 profile 的 `dsh.profile.bundles`。

## 使用

安装后正常启动：

```bash
dsh web
```

插件会在启动时自动创建或刷新：

```
C:\Users\<你>\Desktop\DeepSeek Harness.lnk
```

双击快捷方式会启动 `dsh web`，并自动打开浏览器访问 `http://127.0.0.1:3080`。默认情况下，**关闭这个 Harness 浏览器窗口，服务也会自动停止**。

## 配置

默认配置在 `cordis.patch.yml` 中：

```yaml
- id: desktop-shortcut
  name: dsh-desktop-shortcut
  config:
    shortcutName: DeepSeek Harness
    dshArgs: web
```

可在自己的 profile `cordis.patch.yml` 里按 `id: desktop-shortcut` 覆盖：

```yaml
- id: desktop-shortcut
  config:
    shortcutName: My Harness
    dshArgs: web --port 4000
    port: 4000
    workingDirectory: C:\Users\me
```

如果改了 `dshArgs` 里的端口，记得同步设置 `port`；也可以直接用 `url` 指定完整地址：

```yaml
- id: desktop-shortcut
  config:
    url: http://127.0.0.1:4000
```

如果你不想“关窗口即停服务”，可以关闭该模式：

```yaml
- id: desktop-shortcut
  config:
    closeBrowserStopsService: false
```

## 自定义图标

你可以把自己的图标换成默认图标。

### 方式一：手动改快捷方式图标（临时）

右键桌面上的 **DeepSeek Harness** 快捷方式 → **属性** → **更改图标** → 选择自己的 `.ico` 文件。

> 注意：下次启动 `dsh web` 时，插件刷新快捷方式可能会恢复成默认图标。

### 方式二：通过插件配置设置图标（推荐，可持久保存）

编辑你自己的 profile 配置：

`C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml`

```yaml
- id: desktop-shortcut
  config:
    icon: C:\Users\<你>\Pictures\my-icon.ico
```

也可以写相对于插件包根目录的路径：

```yaml
- id: desktop-shortcut
  config:
    icon: assets/MyIcon.ico
```

然后重新启动一次 `dsh web`，插件就会用这个图标刷新快捷方式。

### 方式三：修改插件默认图标（给所有用户）

替换本仓库里的：

```text
assets/DeepSeek Harness.ico
```

替换后重新提交推送。以后安装这个插件的新用户默认就会使用新图标。

> 小提示：推荐使用多尺寸 `.ico`（256 / 128 / 64 / 48 / 32 / 16），桌面、任务栏、小图标显示效果最好。

## 卸载

```bash
dsh plugin --profile web remove dsh-desktop-shortcut
```

卸载不会自动删除已创建的桌面快捷方式，可手动删除。

## 目录结构

```text
dsh-desktop-shortcut/
├─ assets/
│  ├─ DeepSeek Harness.ico
│  └─ DeepSeek Harness.png
├─ lib/
│  └─ index.js          # Cordis 插件本体
├─ scripts/
│  └─ build-icon.ps1    # 图标生成/重建脚本（可选）
├─ cordis.patch.yml     # dsh bundle patch
├─ package.json
├─ README.md            # English（默认）
└─ README.zh-CN.md      # 中文
```

## License

MIT
