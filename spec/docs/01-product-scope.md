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
