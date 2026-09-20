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

