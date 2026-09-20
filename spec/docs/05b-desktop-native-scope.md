# 05b 桌面程序与 Native 架构范围

## 1. 目的

让 HCB 同时覆盖原有 ARM/x86/x86_64/C86 桌面软件，但保持产品边界：**识别并增强既有功能，不负责 OS/ISA 迁移本身。**

## 2. 支持的原桌面环境

V0.1/Alpha 识别：

- Windows：Win32/C/C++、.NET、Qt、Electron（按 Feature evidence 能力递进）
- Linux/国产桌面：C/C++、Qt、GTK、Electron、Java 等
- macOS：Swift/Objective-C/C++/Qt/Electron

源 CPU 架构：ARM/ARM64/x86/x86_64/C86。

## 3. C86 定义

C86 作为 HCB 的 **sourceArchitecture** 标签，用于标记海光等 x86 兼容国产环境中的来源程序和依赖。HCB 不定义 `c86` HarmonyOS ABI，也不把 C86 二进制直接打包到 HarmonyOS。

## 4. HarmonyOS Native 约束

当前 OHOS NDK/build-profile 文档列出的 Native ABI 为：

- `arm64-v8a`
- `x86_64`

因此：

- 原 `x86` 32 位程序：必须有源码或可替换库才能走重新编译/迁移；HCB 不翻译 32 位机器码。
- 原 `x86_64` / `C86`：即便指令集兼容，也不能推断原 Windows/Linux 二进制可在 HarmonyOS 直接运行；OS ABI、系统调用、运行库均不同。
- 原 `ARM/ARM64`：同样不能因为 CPU 架构相同就假设二进制兼容。
- 有源码的 C/C++ 公共逻辑：可由独立迁移流程使用 OHOS NDK/CMake 重编译；HCB 只产出 dependency inventory、feature binding 和增强代码。

## 5. Desktop Analyzer 做什么

### Windows

只找 Feature evidence：

- 业务 Service/Controller/Command 方法
- URL scheme / protocol handler / command-line action
- Notification / background event
- camera/scanner/file/gallery 类资源调用
- 状态枚举 / state machine / event bus
- Win32/.NET/Qt/Electron 的功能边界

禁止把窗口、菜单、控件树转换成 ArkUI。

### Linux / 国产桌面

扫描：

- C/C++/Qt/GTK/Electron/Java 业务方法
- D-Bus / IPC 仅作为功能入口线索
- desktop notification / URL handler
- camera/scan/file/image resource flow
- state enum / event loop / backend API

### Native Inventory

输出：

```yaml
nativeInventory:
  sourceArchitectures: [c86, x86_64]
  languages: [cpp]
  buildSystems: [cmake]
  libraries:
    - name: libexample
      linkage: dynamic
      sourceAvailable: false
      migrationRisk: high
```

注意：此 inventory 给“迁移可行性”提供背景，不进入 Capability Planner 的业务推荐逻辑。

## 6. Binary-only

允许：

- PE/ELF/Mach-O metadata
- architecture detection
- imported library/symbol inventory
- strings/URI/protocol handler 等弱 evidence

不允许：

- 自动反编译业务逻辑并生成可信 Feature contract
- 绕过授权/保护机制
- 声称可直接运行到 HarmonyOS

默认要求开发者手填/确认 Feature Manifest。

## 7. 桌面场景的核心增强

### ACTION

桌面已有命令/查询/审批/提交等功能 → Intents（目标 API/设备支持时）。

### RESOURCE

桌面已有上传图片、拍照、扫描材料等需求 → Service Collaboration：HarmonyOS PC/Tablet 调手机相机、扫描、图库。

### STATE

桌面来源中发现 STATE 仍可进入统一 Manifest，但 Live View 仅根据**目标设备**判定；PC 目标不得因为源桌面程序有 STATE 就生成 Live View。

## 8. 验收原则

必须证明：同一个 `ACTION` 或 `RESOURCE` Feature，可分别从 Android 源码和 x86_64/C86 桌面源码产生相同类型的 Feature Manifest，并由同一个 Planner/Generator 处理。
