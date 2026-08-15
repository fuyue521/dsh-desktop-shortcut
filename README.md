# dsh-desktop-shortcut

DeepSeek Harness 插件：在 Windows 桌面创建/刷新一个 **DeepSeek Harness** 快捷方式，用来启动 `dsh web`。

## 特性

- 安装后，每次启动 `dsh web` 都会自动确保桌面快捷方式存在
- 使用 DeepSeek 风格图标（`.ico`，包含 256/128/64/48/32/16 多尺寸）
- 快捷方式指向 `cmd.exe /c "dsh.cmd" web`
- 仅 Windows 生效，其他平台自动跳过
- 无第三方运行时依赖，只使用 Node 内置模块和 PowerShell

## 安装

需要先安装 [pnpm](https://pnpm.io/)，然后在你自己的 DeepSeek Harness 环境中执行：

### 从 GitHub 安装（上传后）

```bash
dsh plugin --profile web add github:<你的用户名>/dsh-desktop-shortcut
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

双击快捷方式就会运行 `dsh web`。

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
    workingDirectory: C:\Users\me
```

`icon` 配置项也支持：填相对于插件包根目录的路径，或绝对路径。

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
└─ README.md
```

## License

MIT
