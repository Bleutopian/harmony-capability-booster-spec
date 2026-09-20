# 02 总体架构

## 2.1 逻辑架构

```text
┌─────────────────────────────────────────┐
│ Existing Sources                        │
│ Android / iOS                           │
│ Windows / Linux / macOS / 国产桌面      │
│ ARM / x86 / x86_64 / C86               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ Source Adapters                         │
│ mobile / desktop / native inventory     │
└──────────────────┬──────────────────────┘
                   ▼
┌──────────────────────────┐
│ Feature Analyzer         │
│ - pattern scan           │
│ - API/event/state scan   │
│ - candidate scoring      │
│ - native dependency risk │
└─────────────┬────────────┘
              │ candidates
              ▼
┌──────────────────────────┐
│ Developer Review         │
│ accept / reject / edit   │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Feature Manifest         │
│ platform/arch-neutral    │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Enhancement Planner      │
│ + Capability Registry    │
│ + eligibility rules      │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Generator                │
│ - runtime binding        │
│ - source generation      │
│ - module/package patches │
└─────────────┬────────────┘
              │
              ├──────────────┐
              ▼              ▼
┌──────────────────┐  ┌──────────────────┐
│ Runtime HAR      │  │ Host HAP changes │
│ safe wrappers    │  │ Ability/config   │
└─────────┬────────┘  └─────────┬────────┘
          └──────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │ Validator       │
            └─────────────────┘
```

## 2.2 重要分层：Source Architecture != Target ABI

```text
Source Environment
ARM / ARM64 / x86 / x86_64 / C86
Windows / Linux / macOS
          │
          │ feature evidence only
          ▼
Feature Manifest
          │
          │ enhancement decision
          ▼
HarmonyOS Target Project
          │
          ├─ ArkTS/HAR/HAP
          └─ Native module (when source exists)
                 └─ official OHOS ABI only
```

HCB 不实现 ISA 翻译。`c86` 作为源架构标签存在；目标 ABI 必须由 Toolchain Registry 根据当前官方 OHOS NDK 文档校验。

## 2.3 物理仓库建议

```text
hcb/
├── packages/
│   ├── hcb-cli/
│   ├── hcb-analyzer-core/
│   ├── hcb-analyzer-android/
│   ├── hcb-analyzer-ios/
│   ├── hcb-analyzer-windows/       # Win32/.NET/Qt/Electron/native evidence
│   ├── hcb-analyzer-linux/         # Qt/GTK/Electron/native evidence
│   ├── hcb-analyzer-macos/
│   ├── hcb-analyzer-native/        # C/C++/build/native dependency inventory
│   ├── hcb-manifest/
│   ├── hcb-planner/
│   ├── hcb-generator/
│   ├── hcb-validator/
│   └── hcb-runtime-har/
├── capability-registry/
│   ├── intents.yaml
│   ├── live-view.yaml
│   ├── service-collaboration.yaml
│   └── ohos-native-abi.yaml
├── templates/
├── fixtures/
│   ├── android/
│   ├── ios/
│   ├── windows-x86_64/
│   ├── linux-arm64/
│   ├── linux-c86/
│   └── harmony/
├── docs/
├── tests/
└── AGENTS.md
```

## 2.4 依赖方向

```text
Source Adapter -> Analyzer -> Manifest -> Planner -> Generator -> Validator
                                         -> Runtime API contracts
```

`Runtime HAR` 不得依赖任何原平台 Analyzer。

## 2.5 Generator 设计

Generator 必须采用 **Plan → Preview → Apply**。

## 2.6 Desktop Native 边界

HCB 只允许：

- 识别 C/C++/Qt/.NET/Win32/Electron/Java 等代码中已有 Feature 证据。
- 盘点 Native 库、构建系统、源架构和可能的目标 ABI 风险。
- 当 HarmonyOS 目标工程已经存在时，生成 Enhancement binding。
- 对“有源码”的 C/C++ 模块给出 OHOS NDK 重编译检查项。

HCB 禁止：

- 执行 Windows/Linux/macOS 二进制兼容运行。
- 做 CPU 动态翻译。
- 把 binary-only 逆向结果当成可靠业务契约。

## 2.7 Feature Flag

所有增强能力必须可独立关闭。
