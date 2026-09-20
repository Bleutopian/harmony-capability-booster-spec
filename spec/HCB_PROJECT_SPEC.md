# Harmony Capability Booster — Consolidated Project Specification


---

<!-- BEGIN README.md -->

# Harmony Capability Booster (HCB)

> 面向 Android/iOS 与 ARM/x86/x86_64/C86 等存量桌面软件业务的 HarmonyOS 特色能力增强工具链。
>
> **核心原则：只增强已存在的业务功能，不迁移 UI、不重写业务逻辑、不创造新业务。**

## 1. 项目一句话定义

HCB 读取 Android/iOS 及 Windows/Linux/macOS/国产桌面软件中的已有功能线索和开发者确认的 Feature Manifest，将已存在的业务能力映射为 HarmonyOS 的系统级增强能力，并生成必要的 HarmonyOS 代码、配置和运行时适配层。

V0.1 只支持三类增强：

1. **Action Enhancement → Intents Kit**
2. **State Enhancement → Live View Kit（Phone/Tablet，且必须通过准入校验）**
3. **Resource Enhancement → Service Collaboration Kit（以 PC/Tablet 调用手机相机/扫描/图库等协同能力为主）**

## 2. 明确不做

- 不迁移 Activity / Fragment / UIView / SwiftUI / Compose / XML / ArkUI 页面。
- 不转换按钮、布局、控件、样式、动画、交互结构。
- 不重写数据库、核心业务流程、后端 API、领域模型。
- 不承诺 APK/IPA 黑盒“一键自动增强”。
- 不在 V0.1 支持 Form、Payment、Wallet、NearLink、NFC、自定义卡片、复杂跨端接续。
- 不直接修改宿主工程而不给开发者 Diff/确认。

## 3. 产品形态

HCB 不是单一 HAR SDK，而是一个工具链：

```text
Existing mobile / desktop project
(Android/iOS/Windows/Linux/macOS)
          │
          ▼
   Feature Analyzer
          │
          ▼
   Feature Manifest
          │
     Developer Review
          │
          ▼
 Enhancement Planner
          │
          ▼
 Code/Config Generator
          │
          ├── Runtime HAR
          ├── Host project patches
          └── Generated adapters
          │
          ▼
       Validator
```

## 4. 文档阅读顺序（Codex 必须按此顺序）

1. `AGENTS.md` — 开发硬约束与工作方式
2. `docs/01-product-scope.md` — 产品范围与用户价值
3. `docs/02-architecture.md` — 总体架构
4. `docs/03-feature-manifest.md` — 核心数据模型
5. `docs/04-capability-matrix.md` — HarmonyOS 能力矩阵
6. `docs/05-analyzer.md` — 移动端与桌面端 Analyzer 设计
7. `docs/05b-desktop-native-scope.md` — ARM/x86/x86_64/C86 桌面程序边界
8. `docs/06-planner.md` — 增强规划器
9. `docs/07-generator-runtime.md` — 生成器和 Runtime HAR
10. `docs/08-validator.md` — 校验器
11. `docs/09-security.md` — 安全、隐私和代码修改边界
12. `docs/10-testing-acceptance.md` — 测试与验收
13. `docs/11-roadmap.md` — 里程碑与 Backlog
14. `docs/12-codex-execution-prompt.md` — Codex 启动提示词
15. `acceptance/ACCEPTANCE_CHECKLIST.md` — 最终交付验收清单

## 5. 当前技术基线

- HarmonyOS：Stage 模型。
- 开发语言：ArkTS / TypeScript。
- 工具形态：CLI 优先；DevEco Studio 插件作为 V0.2+。
- 运行时复用：HAR 作为公共 Runtime；Ability/ExtensionAbility 等必须由宿主 HAP 按生成器指引声明。
- 目标设备：Phone / Tablet / PC/2in1，按能力分别启用，禁止假设三端 API 一致。
- 源应用范围：Android、iOS、Windows、Linux、macOS/国产桌面环境；源 CPU 架构与目标 HarmonyOS ABI 必须分开建模。
- HCB 不做机器码翻译或 Windows/Linux 兼容层；x86/C86 二进制不能因“被分析”就视为可在 HarmonyOS PC 原生运行。
- API 版本：通过 Capability Registry 管理；严禁把版本/设备支持散落硬编码到业务代码。

## 6. 成功指标

MVP 是否成立只看一个核心指标：

> 对同一组已存在业务功能，使用 HCB 完成 HarmonyOS 特色能力接入的人时，相比官方文档手工接入降低 **≥60%**。

同时必须满足：

- 原业务 UI 零修改。
- 原业务功能关闭 Enhancer 后仍可独立运行。
- 生成代码可审查、可重复生成、可回滚。
- 不支持的设备/API 必须自动降级，而不是崩溃。



<!-- END README.md -->


---

<!-- BEGIN AGENTS.md -->

# AGENTS.md — Codex 开发约束

本文件优先级高于仓库中其他普通开发说明。Codex 在实现任何功能前必须先阅读本文件与 `docs/04-capability-matrix.md`。

## A. 不可违反的产品边界

1. **只增强已存在功能。** Android/iOS 与桌面程序一视同仁；桌面来源可以是 Windows/Linux/macOS/国产桌面环境。 不得设计、补齐或新增宿主业务本来不存在的业务功能。
2. **禁止 UI 迁移。** 不解析或重写页面布局，不生成用于替代原页面的 ArkUI 页面。
3. **禁止业务重写。** 不修改宿主核心业务规则、数据库和后端协议。
4. **增强必须可拆卸。** 移除 HCB Runtime/生成代码后，原 HarmonyOS 业务应仍能正常运行。
5. **所有宿主修改必须可预览。** Generator 必须先生成 Patch Plan / Diff；默认不得静默直接改工程。
6. **不得臆造 HarmonyOS API。** 任何新增 Kit/API 调用必须先在华为官方开发文档中确认设备支持、起始 API、权限、Stage 模型约束和区域/权益限制。
7. **不支持就显式降级。** 不允许通过 `any`、catch-all 或假实现掩盖平台不支持。
8. **V0.1 只允许三个 Capability Adapter：** Intents、Live View、Service Collaboration。
9. **V0.1 不实现 Form/Wallet/Payment/NearLink/NFC/复杂任务接续。** 如需要，只能写 ADR/Backlog，不得偷跑实现。
10. **不上传客户源代码。** 默认本地分析、本地生成；任何联网模型能力必须显式可关闭。
11. **禁止把 HCB 做成 CPU/OS 兼容层。** 不实现 x86/x86_64/C86 → ARM 的二进制翻译，不承诺 Windows PE/Linux ELF/macOS Mach-O 可直接在 HarmonyOS 上运行。
12. **源架构与目标 ABI 分离。** 源架构可记录 arm/arm64/x86/x86_64/c86；目标 HarmonyOS Native ABI 只能使用官方当前支持值，并由 Capability/Toolchain Registry 校验。
13. **只有源码可重编译路径才允许生成 Native 适配建议。** Binary-only 输入只能做 inventory / evidence extraction / manual-manifest 辅助，不得自动声称已完成迁移。

## B. Codex 的工作方式

每个任务必须按顺序完成：

1. 阅读对应 spec。
2. 输出/更新实施计划。
3. 实现最小改动。
4. 增加单元测试和必要的 fixture。
5. 运行静态检查、测试、生成器幂等性检查。
6. 对照 Acceptance Criteria 自检。
7. 更新 `CHANGELOG.md` 或任务说明。

## C. 代码修改红线

Generator 只允许修改或新增：

- HCB 自己的目录/模块。
- 明确标记的 generated 文件。
- 宿主 `oh-package.json5` 中 HCB 依赖项。
- 宿主 `module.json5` 中经 Patch Plan 明示、用户确认的必要 Ability/Extension/权限/metadata 声明。
- HCB integration 文件（例如 `hcb.integration.ets`）。

Generator 禁止修改：

- 现有 `pages/` 业务页面。
- 现有 ArkUI 组件源文件。
- 现有业务 Service/Repository/Domain 类。
- 后端 URL、密钥、签名证书配置。

## D. API 事实校验

新增/变更 HarmonyOS 适配器前，必须记录：

```yaml
capability: <name>
source_url: <official Huawei URL>
verified_at: YYYY-MM-DD
api_min: <value>
devices: [phone, tablet, pc]
permissions: []
constraints: []
```

未经官方文档确认的能力状态只能标记为 `experimental`，不得进入默认生成路径。

## E. Definition of Done

一个 Capability Adapter 只有同时满足以下条件才算完成：

- Schema 已定义。
- Capability Registry 已登记。
- Planner 有推荐/拒绝规则。
- Generator 可生成代码与必要配置。
- Runtime 有统一接口和 graceful fallback。
- Validator 可检测关键错误。
- 单元测试覆盖成功、拒绝、版本不支持三类路径。
- 至少一个 sample fixture 可编译或通过 mock compile check。
- 文档包含人工接入等价步骤，用于计算节省人时。



<!-- END AGENTS.md -->


---

<!-- BEGIN docs/01-product-scope.md -->

# 01 产品范围与价值

## 1.1 背景

大量 ISV 的 Android/iOS 应用以及 Windows/Linux/macOS/国产桌面软件在迁移到 HarmonyOS 后首先解决“能运行”，但 HarmonyOS 的系统级能力（例如 Intents、Live View、跨设备服务协同）往往需要开发者重新阅读多套 Kit 文档、判断设备/API 兼容、补配置、写适配代码并联调。

HCB 的目标不是取代迁移工具，也不是做 CPU/OS 二进制兼容层，而是解决迁移后阶段：

> **把已存在的业务功能低成本升级成 HarmonyOS 特色能力。**

## 1.2 目标用户

主要用户：

- 正在进行 Android/iOS → HarmonyOS 迁移的 ISV。
- 正在进行 Windows/Linux/macOS/国产桌面程序 → HarmonyOS PC 适配的 ISV。
- 拥有 ARM、x86/x86_64、海光 C86 等不同源架构版本的政企/行业软件厂商。
- 为政务、教育、物业、养老、公共服务等民生行业交付 HarmonyOS 项目的 SI/软件厂商。
- 需要快速产出“鸿蒙特色能力增强方案”的解决方案/售前团队。

## 1.3 用户价值

### 对 ISV

- 减少逐 Kit 学习成本。
- 将平台版本/设备能力判断集中管理。
- 自动生成重复配置和适配样板代码。
- 降低 Phone/Tablet/PC 不同能力边界导致的踩坑。
- 对移动端和桌面端使用同一套 Feature Manifest / Enhancement Plan，避免按原 OS 重做增强设计。

### 对桌面软件 ISV

HCB 只提取“已有功能语义”，不要求原程序 UI 框架一致：

```text
Windows / Linux / macOS / 国产桌面
Win32 / .NET / Qt / GTK / Electron / Java / C/C++ ...
ARM / ARM64 / x86 / x86_64 / C86
                 │
                 ▼
          Existing Features
                 │
                 ▼
           Feature Manifest
                 │
                 ▼
       HarmonyOS Capability Boost
```

源 CPU 架构仅用于溯源、Native 依赖风险和构建建议，不直接决定 HarmonyOS 能否运行该二进制。

### 对 SI/解决方案团队

- 快速形成“存量业务 + 鸿蒙特色能力”的标准方案。
- 提供可重复的 POC 工具链。
- 将行业增强经验沉淀为 Feature Pattern / Profile，而不是每项目手工开发。

## 1.4 V0.1 范围

### Source 类别

- Mobile：Android、iOS。
- Desktop：Windows、Linux、macOS，以及 Linux 系国产桌面环境。
- Source Architecture：`arm`、`arm64`、`x86`、`x86_64`、`c86`，只作为源环境元数据。
- Source Availability：`source` / `binary_only`。

### Feature 类别

- `ACTION`：已存在的可执行业务动作。
- `STATE`：已存在的持续性业务状态。
- `RESOURCE`：已存在的摄像头/扫描/图库类资源需求。

### HarmonyOS 目标能力

- `INTENTS`
- `LIVE_VIEW`
- `SERVICE_COLLABORATION`

### 非目标

- 不做 Windows/Linux/macOS UI 自动迁移。
- 不做 x86/x86_64/C86 → ARM 动态二进制翻译。
- 不做 Windows API/Win32/COM/Wine 类兼容运行时。
- 不把仅有 PE/ELF/Mach-O 二进制的程序宣称为可自动迁移。
- 其他非目标见根目录 `README.md` 和 `AGENTS.md`。

## 1.5 核心产品原则

### 原则一：Enhancement Overlay

HCB 是 Overlay，不是 Migration Runtime。

```text
Business Core ───────────────> 正常业务
      │
      └── HCB Hook/Adapter ──> HarmonyOS 增强
```

### 原则二：Feature First

分析对象是“功能”，不是页面，也不是 CPU 指令。

### 原则三：Architecture-Neutral Feature Model

Feature Manifest 不关心原功能运行在 ARM、x86 还是 C86；架构信息只存在于 Source Environment / SourceRef 中。

### 原则四：Human-in-the-loop

V0.1 不追求全自动语义理解。Analyzer 发现候选 Feature，开发者确认后才进入生成。

### 原则五：Capability Eligibility

不是所有功能都适合所有 HarmonyOS Kit。Planner 必须先判断资格，再推荐。

## 1.6 商业验证指标

POC 必须至少包含：

1. 一个 Android/iOS 存量项目。
2. 一个桌面存量项目（优先 Qt/C++ 或 .NET/Win32，源架构来自 ARM/x86_64/C86 任一环境）。
3. 同一 Feature Manifest 模型能覆盖两类来源，不新增 UI 模型。

Go/No-Go：

- 人时降低 ≥60%。
- 首次生成后，因 HCB 自身问题导致的手工修改 ≤20%。
- 不修改原业务 UI。
- Desktop source architecture 不得污染目标 HarmonyOS capability decision。


<!-- END docs/01-product-scope.md -->


---

<!-- BEGIN docs/02-architecture.md -->

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


<!-- END docs/02-architecture.md -->


---

<!-- BEGIN docs/03-feature-manifest.md -->

# 03 Feature Manifest 规范

## 3.1 目的

Feature Manifest 是所有“既有业务功能”与 HarmonyOS 增强能力之间的稳定中间层。来源可以是移动应用，也可以是 ARM/x86/x86_64/C86 等架构上的桌面软件。

它不描述 UI，不描述 CPU 指令，只描述功能语义和来源证据。

## 3.2 V0.1 顶层结构

```yaml
schemaVersion: "0.1"
application:
  id: com.example.app
  sourcePlatforms: [android, windows, linux]
  sourceArchitectures: [arm64, x86_64, c86]
  sourceAvailability: source

features:
  - id: queryAppointment
    kind: ACTION
    title: 查询预约
    sourceRefs: []
    contract: {}
    hints: {}
```

### sourcePlatforms

允许：

- `android`
- `ios`
- `windows`
- `linux`
- `macos`

### sourceArchitectures

允许作为来源标识：

- `arm`
- `arm64`
- `x86`
- `x86_64`
- `c86`
- `unknown`

注意：这里不是 HarmonyOS Target ABI。

### sourceAvailability

- `source`：有源码，可进行规则/AST/Build 分析。
- `binary_only`：只有 PE/ELF/Mach-O 等二进制，仅支持有限 inventory / evidence，不允许自动声称完成迁移。

## 3.3 ACTION

（与原规范一致）用于描述已存在的用户/系统可执行动作。

## 3.4 STATE

（与原规范一致）用于描述具有生命周期和动态变化的既有业务状态。

## 3.5 RESOURCE

V0.1 Resource：`camera_capture`、`document_scan`、`gallery_pick` 等已存在资源获取需求。

## 3.6 SourceRef

SourceRef 必须同时表达“来源平台”和“来源架构”，但 Planner 不得用源架构直接决定 HarmonyOS 能力：

```yaml
sourceRefs:
  - platform: linux
    architecture: c86
    language: cpp
    framework: qt
    buildSystem: cmake
    file: src/order/OrderService.cpp
    lineStart: 120
    lineEnd: 148
    evidence: "ORDER_WAITING -> ORDER_FINISHED state transition"
    confidence: 0.91
```

Binary-only 可写：

```yaml
sourceRefs:
  - platform: windows
    architecture: x86_64
    binary: app.exe
    evidenceKind: import_or_string
    confidence: 0.35
```

此类低置信度 evidence 默认不能自动进入 Generator。

## 3.7 置信度

- `>=0.90`：high
- `0.70~0.89`：medium
- `<0.70`：advanced view only
- `binary_only` 自动发现默认最高置信度不得超过 0.69，除非开发者人工确认契约。

## 3.8 不允许出现的字段

禁止任何 UI hierarchy / style / layout 字段，也禁止 target machine-code translation 字段。


<!-- END docs/03-feature-manifest.md -->


---

<!-- BEGIN docs/04-capability-matrix.md -->

# 04 HarmonyOS Capability Matrix

> 本文件是实现前置事实表。所有 API/设备支持最终以华为官方文档为准。Generator 不得凭经验猜设备支持。

## 4.1 V0.1 能力矩阵

| Capability | Phone | Tablet | PC/2in1 | V0.1用途 | 备注 |
|---|---:|---:|---:|---|---|
| Intents Kit | ✅ | ✅ | ✅（相关 API/Extension 有明确支持） | ACTION 增强 | 不要求替代原页面 |
| Live View Kit | ✅ | ✅ | ❌/不作为 PC 默认目标 | STATE 增强 | 必须经过场景准入判断 |
| Service Collaboration | 作为远端/双向图库等角色 | ✅ | ✅ | RESOURCE 增强 | PC/Tablet 调手机相机/扫描是核心场景 |

## 4.2 Intents

目标：把已存在的业务 Action 暴露给 HarmonyOS 系统意图入口。

实现规则：

- Feature 必须是既有业务能力。
- 业务函数由宿主提供；HCB 不创建新业务逻辑。
- 若某 Intent 需要 UIExtension，Generator 只能创建系统调用所需扩展壳，不得迁移/替代宿主现有业务页。
- PC/2in1、Tablet、Phone 支持情况必须从 Registry 获取。

## 4.3 Live View

只适用于符合以下特征的 STATE：

- 有明确开始和结束。
- 在持续时间内信息对用户有价值。
- 状态会动态变化。
- 属于官方允许/适配的业务场景。

不适用于：

- 单点通知。
- 长期静态状态。
- 权限/后台驻留等系统状态。
- 不满足权益/准入要求的场景。

推荐优先通过 Push Kit 由服务端业务状态更新实况窗；Generator 只生成映射层和接入骨架，不改后端业务含义。

## 4.4 Service Collaboration

V0.1 支持的抽象 Resource：

- `camera_capture`
- `document_scan`
- `gallery_pick`

目标场景：

- Tablet/PC 文本/表单类业务已经存在“上传图片/扫描材料”功能。
- HCB 增强为可调用附近手机的相机、扫描、图库能力。

必须处理：

- 设备/系统版本判断。
- 账号/Wi-Fi/蓝牙等前置条件（按官方文档）。
- 远端不可用时 fallback 到原有本地实现。

## 4.5 Capability Registry 格式

```yaml
id: service_collaboration.document_scan
status: stable
verifiedAt: 2026-09-20
sourceUrl: https://developer.huawei.com/consumer/cn/sdk/service-collaboration-kit/
targets:
  tablet:
    supported: true
  pc:
    supported: true
  phone:
    supported: conditional
constraints:
  - "按官方文档检查系统版本和设备条件"
fallback: original_local_implementation
```

## 4.6 当前官方参考

- HarmonyOS 应用能力总览 / Intents / Live View 等：
  https://developer.huawei.com/consumer/cn/app
- Intents `InsightIntentUIExtensionAbility`（含 Phone/Tablet/PC/2in1 支持标识）：
  https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/intents-arkts-api-insightintent-uiextension
- Intents 执行上下文：
  https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/js-apis-app-ability-insightintentcontext
- Live View 简介：
  https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/liveview-introduction-V13
- Push 更新 Live View：
  https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/liveview-update-by-push
- Service Collaboration Kit：
  https://developer.huawei.com/consumer/cn/sdk/service-collaboration-kit/
- HarmonyOS 应用包术语（HAP/HAR/HSP）：
  https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/application-package-glossary



## 4.7 Native Toolchain Registry（源桌面程序相关）

Feature Planner 与 Native Toolchain 必须解耦。当前官方 OHOS 构建配置公开的 Native ABI 为 `arm64-v8a`、`x86_64`；源程序的 `x86`/`C86` 不能直接作为目标 ABI 写入 build-profile。

建议 registry：

```yaml
id: ohos.native.abi
verifiedAt: 2026-09-20
supported: [arm64-v8a, x86_64]
sourceArchitecturesAcceptedForAnalysis: [arm, arm64, x86, x86_64, c86, unknown]
notes:
  - sourceArchitecture != targetABI
  - binary compatibility is never inferred
```

官方参考：
- NDK/CMake `abiFilters`：https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V5/build-with-ndk-ide-V5
- build-profile Native ABI：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-hvigor-build-profile-V5


<!-- END docs/04-capability-matrix.md -->


---

<!-- BEGIN docs/05-analyzer.md -->

# 05 Feature Analyzer 设计

## 5.1 目标

Analyzer 的任务不是理解完整 App，也不是迁移 UI/机器码，而是发现“可能值得增强的已存在功能”。

输出永远是 **Candidate**。

## 5.2 V0.1 输入

```text
--android <source-root>
--ios <source-root>
--windows <source-root|binary>
--linux <source-root|binary>
--macos <source-root|binary>
--source-arch <arm|arm64|x86|x86_64|c86|unknown>
--feature-hints <optional yaml/json>
```

多个输入允许并存，用于一个 ISV 同时维护移动端/桌面端版本。

若只有 APK/IPA/PE/ELF/Mach-O 且无源码，必须提示能力受限，不承诺完整语义分析。

## 5.3 Android / iOS

保持原有规则：Intent/Deep Link、Notification、业务 API、状态、Camera/Document/Gallery 等功能证据；禁止 UI hierarchy 迁移。

## 5.4 Windows 桌面扫描重点

- C/C++/Win32、.NET、Qt、Electron 中的业务 Action/Command/Service。
- protocol handler / URL scheme / command-line action。
- 通知与长期状态更新线索。
- Camera/Scanner/File/Image picker 类 Resource。
- 状态枚举、event bus、state machine。
- Native 库与架构 inventory。

不解析控件树用于页面迁移。

## 5.5 Linux/国产桌面扫描重点

- C/C++/Qt/GTK/Electron/Java 业务方法。
- D-Bus/IPC 仅作为功能入口证据。
- desktop notification / protocol handler。
- camera/scan/file/image resource flow。
- 状态 enum / event stream。
- ELF/native dependency inventory。

## 5.6 macOS 桌面扫描重点

- App Intents/Handoff/Notification 等功能证据。
- Swift/Objective-C/C++/Qt/Electron 业务接口。
- camera/photo/document resources。
- 禁止 UI 迁移。

## 5.7 Native Analyzer

Native Analyzer 是“证据与风险扫描器”，不是迁移器：

```ts
interface NativeInventory {
  sourceArchitectures: Array<'arm'|'arm64'|'x86'|'x86_64'|'c86'|'unknown'>;
  buildSystems: string[];
  languages: string[];
  libraries: NativeDependency[];
}
```

仅当源码存在时，可进一步分析 CMake/qmake/meson 等并给出 OHOS NDK 重编译检查项。

## 5.8 Candidate

```ts
interface Candidate {
  id: string;
  kind: 'ACTION' | 'STATE' | 'RESOURCE';
  titleGuess: string;
  confidence: number;
  sourceRefs: SourceRef[];
  extractedContract?: unknown;
  reasons: string[];
}
```

Candidate 不包含 page/button/layout/machine-code translation。

## 5.9 Binary-only 限制

- 允许架构识别、imports、metadata、URI/字符串弱 evidence。
- 自动 candidate 置信度上限 0.69。
- 必须人工确认才能进入 Manifest。
- 不做反保护、解密、授权绕过。

## 5.10 Developer Review

移动端和桌面端使用同一 review 流程，开发者可 accept/reject/rename/补 contract/标敏感性。


<!-- END docs/05-analyzer.md -->


---

<!-- BEGIN docs/05b-desktop-native-scope.md -->

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


<!-- END docs/05b-desktop-native-scope.md -->


---

<!-- BEGIN docs/06-planner.md -->

# 06 Enhancement Planner

## 6.1 输入/输出

输入：

- Feature Manifest
- target HarmonyOS project metadata
- Capability Registry
- target devices
- API version / targetSDKVersion

输出：`EnhancementPlan`。

## 6.2 Plan 示例

```yaml
planVersion: "0.1"
items:
  - featureId: queryAppointment
    capability: intents
    decision: recommend
    confidence: 0.96
    reasons:
      - "Existing user-invokable ACTION"
      - "Structured input/output available"
    generatedArtifacts:
      - generated/intents/QueryAppointmentIntent.ets

  - featureId: appointmentState
    capability: live_view
    decision: conditional
    reasons:
      - "Lifecycle is ongoing and dynamic"
      - "Requires Live View eligibility confirmation"
    requiredChecks:
      - liveViewEntitlement
      - targetDeviceIn[phone,tablet]
```

## 6.3 规则优先级

1. Hard platform constraints
2. Eligibility / entitlement constraints
3. Feature semantic fit
4. Device fit
5. Confidence

任何上层 AI 推荐不得绕过 1/2。

## 6.4 Intents 推荐条件

推荐：

- Feature.kind == ACTION
- 已有业务函数/服务可调用
- 输入可结构化
- 输出可结构化或可明确返回结果
- 不是仅存在于 UI 内的临时交互

拒绝：

- 纯视觉动作
- 无独立业务语义
- 必须重做页面才能成立

## 6.5 Live View 推荐条件

必须全部满足：

- Feature.kind == STATE
- lifecycle ongoing
- start/end 明确
- 状态有变化
- 用户对进行中状态有持续关注价值
- target device 支持
- 权益/场景准入允许

不满足时 Planner 必须说明拒绝原因。

## 6.6 Service Collaboration 推荐条件

- Feature.kind == RESOURCE
- 业务已存在本地实现
- resourceType 属于 camera/document_scan/gallery
- target 包含 Tablet 或 PC/2in1，或 Registry 指明可用
- 必须存在 fallback

## 6.7 AI 的位置

AI 只能：

- 辅助 Feature 命名
- 解释推荐理由
- 辅助状态语义分类
- 生成候选映射

AI 不能：

- 覆盖 Capability Registry 的硬约束
- 自动修改业务逻辑
- 自动批准 Live View 等受限能力



## 6.8 Source Architecture Invariant

Planner 的 Capability 决策不得根据 `sourceArchitecture` 做业务推荐。ARM/x86/x86_64/C86 只用于：

- Analyzer provenance；
- Native migration risk；
- Toolchain validation。

例如：同一个 `scanDocument RESOURCE` 从 Android ARM64、Windows x86_64、Linux C86 发现后，进入 Planner 后应得到相同语义；是否推荐 Service Collaboration 取决于 HarmonyOS 目标设备和既有 fallback，而不是原 CPU。


<!-- END docs/06-planner.md -->


---

<!-- BEGIN docs/07-generator-runtime.md -->

# 07 Generator 与 Runtime HAR

## 7.1 Generator 目标

将已批准的 Enhancement Plan 转换为：

1. HCB Runtime 依赖。
2. Generated Adapter 源码。
3. 必要宿主配置 Patch。
4. 开发者待绑定点（binding TODO）。

## 7.2 生成目录

建议所有生成内容隔离：

```text
entry/src/main/ets/hcb_generated/
├── intents/
├── liveview/
├── collaboration/
└── bindings/
```

不得写入现有业务页面目录。

## 7.3 Binding Contract

HCB 不知道宿主业务实现，因此用接口绑定。

示例：

```ts
export interface ActionBinding<I, O> {
  execute(input: I): Promise<O>;
}

export interface StateBinding<S> {
  getCurrent(entityId: string): Promise<S>;
  subscribe?(entityId: string, cb: (state: S) => void): () => void;
}

export interface ResourceFallback<T> {
  requestLocal(): Promise<T>;
}
```

生成器只生成 binding stub，不实现业务。

## 7.4 Runtime API 草案

```ts
export namespace HcbRuntime {
  export function isCapabilityAvailable(id: CapabilityId): Promise<boolean>;

  export namespace intents {
    export function register(binding: ActionBinding<unknown, unknown>): void;
  }

  export namespace liveView {
    export function start(request: LiveStateRequest): Promise<LiveHandle>;
    export function update(handle: LiveHandle, state: unknown): Promise<void>;
    export function stop(handle: LiveHandle): Promise<void>;
  }

  export namespace collaboration {
    export function requestResource(
      request: ResourceRequest,
      fallback: ResourceFallback<unknown>
    ): Promise<unknown>;
  }
}
```

实际 ArkTS API 设计必须遵守 ArkTS 类型约束，不可机械照搬 TypeScript 泛型写法；本段为逻辑接口草案。

## 7.5 Graceful Fallback

任何 Runtime Adapter 必须：

```text
capability available?
   │
  yes ──> enhanced path
   │
   no
   ▼
original business implementation
```

禁止出现：

```text
not supported -> throw -> business unusable
```

## 7.6 Idempotency

重复执行：

```bash
hcb plan
hcb apply
hcb apply
```

第二次 apply 不得：

- 重复追加权限。
- 重复创建同名 ExtensionAbility。
- 重复安装依赖。
- 修改已生成但由开发者手工接管的文件而不提示冲突。

## 7.7 Generated File Ownership

每个 generated 文件必须包含头注释：

```text
// Generated by Harmony Capability Booster.
// Ownership: HCB_GENERATED
// Do not edit directly unless file is detached from HCB management.
```

支持 `hcb detach <artifact>` 将文件交给开发者维护。



## 7.8 Desktop/Native Source Handling

Generator 的输入永远是已确认 Feature Manifest + HarmonyOS 目标工程，而不是 Windows/Linux 二进制。

- 原桌面程序有源码但 HarmonyOS target 尚不存在：只输出 Enhancement Plan / binding contract，不生成伪 target。
- HarmonyOS target 已存在：正常生成 HCB adapter。
- 若 target 包含 C/C++ Native module：可校验 `abiFilters` 与 Toolchain Registry，但不得自动把原 PE/ELF 动态库复制进 HAP。
- 原 x86/C86 library 只有 binary、无 OHOS 编译产物：Validator 必须报 `HCB_NATIVE_BINARY_NOT_PORTABLE`。


<!-- END docs/07-generator-runtime.md -->


---

<!-- BEGIN docs/08-validator.md -->

# 08 Validator

## 8.1 目标

Validator 在生成后检测“代码看起来生成了，但实际无法正确集成”的问题。

## 8.2 静态校验

必须检查：

- Feature Manifest Schema。
- Enhancement Plan 完整性。
- Capability Registry 中的设备/API 条件。
- 宿主 Stage 模型。
- targetSDK/API 兼容。
- 必要权限/metadata/ExtensionAbility 声明。
- Runtime HAR 依赖是否存在。
- 生成文件是否与 plan 一致。
- 不允许修改 UI 目录的 invariant。

## 8.3 编译校验

若环境存在 DevEco/Hvigor：

- 运行对应构建命令。
- 收集 error/warning。
- 将错误映射到 HCB 生成 artifact。

若环境不存在：

- 明确标记 `compile_check: skipped`。
- 不得伪报通过。

## 8.4 Capability Smoke Check

每个 Adapter 必须暴露 runtime availability check。

示例：

```text
Intents:
- platform/version supported
- required declaration exists

LiveView:
- device supported
- entitlement/config present
- feature eligible

ServiceCollaboration:
- local device supported
- prerequisites available
- fallback registered
```

## 8.5 输出

```json
{
  "status": "pass_with_warnings",
  "errors": [],
  "warnings": [
    {
      "code": "HCB-LV-001",
      "message": "Live View entitlement not confirmed",
      "featureId": "appointmentState"
    }
  ]
}
```

## 8.6 错误码约定

- `HCB-MF-*` Manifest
- `HCB-PL-*` Planner
- `HCB-GN-*` Generator
- `HCB-IN-*` Intents
- `HCB-LV-*` Live View
- `HCB-SC-*` Service Collaboration
- `HCB-VA-*` Validator



<!-- END docs/08-validator.md -->


---

<!-- BEGIN docs/09-security.md -->

# 09 安全、隐私与供应链边界

## 9.1 源码处理

默认：

- 本地扫描。
- 本地生成。
- 不上传源代码、证书、密钥、配置文件。

若未来引入云端 AI：

- 必须 opt-in。
- 必须支持脱敏/片段化。
- 必须明确列出上传内容。
- 企业版必须支持完全离线模式。

## 9.2 Secret Handling

Analyzer/Generator 必须默认忽略：

- signing configs
- keystore
- `.env`
- token/password/secret
- private key

日志中禁止打印这些内容。

## 9.3 最小权限

Generator 不得因为某个 Kit“可能需要”就批量加权限。权限只能由已批准的 Plan Item 触发。

## 9.4 宿主代码安全

Patch 必须：

- 生成 diff。
- 可回滚。
- 不修改业务逻辑。
- 不在未知位置注入反射/动态执行代码。

## 9.5 供应链

Runtime HAR：

- 版本必须固定。
- 发布物生成 SBOM。
- 依赖有 allowlist。
- Release 需 hash/checksum。

## 9.6 数据最小化

Live View 等系统展示能力只接收实现目标所需字段；不把整个业务对象或敏感字段直接塞入系统展示 payload。



<!-- END docs/09-security.md -->


---

<!-- BEGIN docs/10-testing-acceptance.md -->

# 10 测试与验收规范

## 10.1 测试金字塔

### Unit

- Analyzer patterns
- Manifest schema
- Planner rules
- Generator templates
- Patch merge/idempotency
- Runtime availability/fallback

### Integration

- Android fixture -> Candidate -> Manifest
- iOS fixture -> Candidate -> Manifest
- Windows x86_64 source fixture -> Candidate -> Manifest
- Linux C86/ARM64 source fixture -> Candidate -> Manifest
- binary-only desktop fixture -> restricted candidate/manual-review
- Manifest -> Plan -> Generated HarmonyOS fixture
- repeated apply
- invalid API/device matrix

### Device / Manual

涉及真实 HarmonyOS 系统能力时，使用真实设备完成最小验收；模拟器无法证明真实跨设备协同效果。

## 10.2 必测 Fixture

### Fixture A：预约/排队

已有功能：

- `queryAppointment()` ACTION
- `WAITING/CALLED/PROCESSING/COMPLETED` STATE

预期：

- 推荐 Intents。
- STATE 只有通过 Live View eligibility 时推荐 Live View。

### Fixture B：PC/Tablet 上传材料

已有功能：

- `uploadImage()` RESOURCE
- `scanDocument()` RESOURCE
- local fallback 已存在

预期：

- 推荐 Service Collaboration。
- 无远端设备时自动回到 local fallback。

### Fixture C：纯 UI 动画

已有：

- `openAnimation()`

预期：

- 不应推荐 Intents。

## 10.3 关键验收指标

### Functional

- 100% 不修改原业务 UI 文件。
- Generator 重复运行幂等。
- 不支持设备有明确 fallback。
- Planner 每个推荐都给出 reason。
- 每个拒绝也给出 reason。

### Quality

- Schema/Planner/Generator 核心模块测试覆盖率目标 ≥80%。
- 所有生成 artifact 有 deterministic snapshot。
- 不允许 hardcoded absolute path。

### Productivity

基准实验：

1. A 组开发者按华为官方文档手工接入三项能力。
2. B 组使用 HCB。
3. 同一宿主项目、同一功能集合。

通过条件：

- B 组总人时较 A 组降低 ≥60%。
- B 组因 HCB 生成错误产生的修复时间 ≤总 HCB 接入时间 20%。

## 10.4 退出条件

若 POC 结果：

- 节省人时 <30%，或
- 大量增强必须深改 UI/业务，或
- 各 ISV 差异导致模板复用率过低，

则停止工具链产品化，降级为内部解决方案交付工具。



## 10.5 Desktop / Architecture 必测 Fixture

### Fixture D：x86_64 Qt/C++ 桌面程序

已有：`queryOrder()` ACTION、`selectImage()` RESOURCE。

预期：生成 ACTION/RESOURCE Candidate；不读取 Qt Widget 布局用于迁移。

### Fixture E：C86 Linux/国产桌面程序

已有：`scanDocument()` RESOURCE、CMake/native dependency。

预期：`sourceArchitecture=c86` 被保留；Planner 与 x86_64 同语义 Feature 结果一致；Native inventory 单独报告。

### Fixture F：x86 32位 binary-only

只有 PE/ELF，无源码。

预期：只允许 inventory/弱 evidence；不得生成自动迁移代码；若尝试把 binary 当 OHOS native lib，Validator 拒绝。


<!-- END docs/10-testing-acceptance.md -->


---

<!-- BEGIN docs/11-roadmap.md -->

# 11 路线图与 Codex 任务拆分

## M0 — Repo Scaffold

交付：

- monorepo
- lint/test
- CI
- schemas
- capability registry loader

验收：基础测试通过。

## M1 — Feature Manifest

交付：

- Type definitions
- JSON Schema
- schema validator
- sample manifests

验收：禁止 UI 字段；非法输入被拒绝。

## M2 — Manual-First CLI

命令：

```bash
hcb init
hcb manifest validate
hcb plan
hcb apply --dry-run
hcb validate
```

先允许开发者手填 Feature Manifest，证明 Planner/Generator 价值，不把 Analyzer 当关键路径。

## M3 — Planner + Registry

实现：

- Intents rules
- Live View eligibility rules
- Service Collaboration rules
- device/API registry

## M4 — Intents Adapter

交付：

- code template
- host config patch
- runtime wrapper
- fixture

## M5 — Live View Adapter

交付：

- state mapping
- lifecycle interface
- Push integration skeleton
- entitlement/eligibility validation

## M6 — Service Collaboration Adapter

交付：

- camera/gallery/scan resource contract
- capability availability
- fallback wrapper
- PC/Tablet fixture

## M7 — Analyzer Alpha

先规则扫描，不追求 AI 全理解。

交付：

- Android rules
- iOS rules
- Windows desktop rules
- Linux/国产桌面 rules
- macOS desktop rules（最小集）
- Native inventory（ARM/x86/x86_64/C86）
- binary-only restricted mode
- candidate report
- developer review flow

## M8 — Cross-Source Equivalence

验收同一 Feature 在 Android、Windows x86_64、Linux C86/ARM64 来源下能汇聚到同一种 Feature Manifest，Planner 不受源 CPU 架构影响。

## M9 — Productivity Benchmark

按 `docs/10-testing-acceptance.md` 执行 A/B 人时实验。

## V0.2 候选（只有 V0.1 达标后才能进入）

- DevEco Studio Plugin
- Form Kit（若产品边界允许新增系统展示）
- 任务接续
- Near-field/Scan 入口增强
- 行业 Feature Profiles
- AI 辅助 Analyzer



<!-- END docs/11-roadmap.md -->


---

<!-- BEGIN docs/12-codex-execution-prompt.md -->

# 12 给 Codex 的启动提示词

将以下内容作为 Codex 开始编码时的首个任务描述：

---

你正在实现 **Harmony Capability Booster (HCB)**。先完整阅读仓库根目录 `AGENTS.md`、`README.md` 和 `docs/` 下 01-11 文档，不得跳过。

目标：实现 V0.1 工具链，用于把 Android/iOS 以及 Windows/Linux/macOS/国产桌面程序中已经存在的业务功能增强为 HarmonyOS 系统能力。原桌面程序可来自 ARM/ARM64/x86/x86_64/C86 环境。严禁 UI 迁移、业务逻辑重写和新业务设计；严禁实现 x86/C86/ARM 机器码翻译、Windows/Linux 兼容运行层。

V0.1 只允许三种增强：

1. ACTION -> Intents Kit
2. STATE -> Live View Kit（仅符合准入且目标设备支持时）
3. RESOURCE -> Service Collaboration Kit（必须保留原本地 fallback）

第一阶段从 M0/M1/M2 开始，不要直接写三个 Harmony Adapter：

- 建立 monorepo
- 实现 Feature Manifest schema/types/validator
- 实现 capability registry loader
- 实现 CLI：`init`, `manifest validate`, `plan`, `apply --dry-run`, `validate`
- 先允许人工维护 Feature Manifest
- Manifest 从第一天支持 desktop source platform / source architecture 元数据
- M0/M1 为 Native Toolchain Registry 预留 `arm64-v8a` / `x86_64` 目标 ABI 校验
- 不把 sourceArchitecture 直接写入 HarmonyOS build-profile

任何 HarmonyOS API 在编码前必须核对官方 Huawei Developer 文档，并在 capability registry 中记录 sourceUrl、verifiedAt、设备支持、最低 API 和约束。不得凭记忆构造 API。

每完成一个 milestone：

- 运行 tests
- 运行 schema validation
- 运行 generator idempotency test
- 对照 `acceptance/ACCEPTANCE_CHECKLIST.md`
- 输出变更摘要、已知限制和下一步

如果文档与实际 API 冲突，以当前华为官方文档为准，但必须先更新 ADR/spec，再改代码。

---



<!-- END docs/12-codex-execution-prompt.md -->


---

<!-- BEGIN docs/13-adr-template.md -->

# ADR Template

## ADR-XXX: <Title>

- Status: Proposed / Accepted / Rejected / Superseded
- Date: YYYY-MM-DD
- Owner:

### Context

说明为什么需要决策。

### Decision

明确选择。

### Alternatives Considered

至少列出一个替代方案。

### Consequences

- Positive
- Negative
- Risks

### HarmonyOS Evidence

- Official URL:
- Verified date:
- API/device constraints:

### Acceptance Impact

是否需要更新：

- Feature Manifest
- Capability Registry
- Generator
- Validator
- Acceptance Checklist



<!-- END docs/13-adr-template.md -->


---

<!-- BEGIN acceptance/ACCEPTANCE_CHECKLIST.md -->

# HCB V0.1 最终验收清单

## A. 范围

- [ ] 只实现 Intents / Live View / Service Collaboration。
- [ ] 未实现 UI 迁移。
- [ ] 未实现业务逻辑迁移。
- [ ] 未偷偷加入 Form/Wallet/Payment/NFC/NearLink。

## A2. Desktop Source Scope

- [ ] 支持 sourcePlatforms: Windows/Linux/macOS。
- [ ] 支持 sourceArchitectures: ARM/ARM64/x86/x86_64/C86。
- [ ] sourceArchitecture 与 HarmonyOS target ABI 分离。
- [ ] 不实现 CPU 动态翻译/Windows兼容层。
- [ ] binary-only 输入不会自动生成可信业务契约。

## B. Manifest

- [ ] JSON Schema 可运行。
- [ ] ACTION/STATE/RESOURCE 均有有效 fixture。
- [ ] UI 字段无法进入规范模型。

## C. Planner

- [ ] Intents 推荐/拒绝规则有测试。
- [ ] Live View eligibility 有测试。
- [ ] PC 不会默认生成 Live View。
- [ ] Service Collaboration 有 fallback 强制校验。
- [ ] 每项 decision 都有 reasons。

## D. Generator

- [ ] `--dry-run` 输出完整 Patch Plan。
- [ ] Apply 前可审查 diff。
- [ ] 重复 Apply 幂等。
- [ ] 不修改业务 UI 文件。
- [ ] Runtime HAR 依赖可固定版本。
- [ ] 必要 module.json5/权限修改有明确来源。

## E. Runtime

- [ ] capability availability check。
- [ ] unsupported -> fallback，而非崩溃。
- [ ] 宿主业务可不依赖增强层独立运行。

## F. Validator

- [ ] Stage 模型检查。
- [ ] API/device compatibility 检查。
- [ ] 权限/config 检查。
- [ ] 编译环境不存在时明确 skipped。
- [ ] 错误码稳定。

## G. POC

- [ ] Desktop：至少一个 x86_64/C86/ARM 来源桌面项目 -> Feature Manifest -> HarmonyOS 增强。
- [ ] 同语义 Feature 跨移动/桌面来源得到一致 Planner 决策。

- [ ] ACTION：查询/预约等既有功能 -> Intents。
- [ ] STATE：进行中服务状态 -> Live View（Phone/Tablet）。
- [ ] RESOURCE：PC/Tablet 既有上传/扫描 -> 手机协同。
- [ ] 移除 HCB 后原功能仍可运行。

## H. 效率

- [ ] 完成手工接入基准记录。
- [ ] 完成 HCB 接入基准记录。
- [ ] 总人时降低 ≥60%。
- [ ] HCB 自身错误修复时间 ≤ HCB 接入时间 20%。

## I. 安全

- [ ] 默认无源代码上传。
- [ ] 日志无 secret/token/private key。
- [ ] 生成修改可回滚。
- [ ] Runtime 发布物有 checksum/SBOM 计划。

## J. Go / No-Go

只有 A-I 全部通过，且效率指标达标，V0.1 才允许进入 V0.2。



<!-- END acceptance/ACCEPTANCE_CHECKLIST.md -->
