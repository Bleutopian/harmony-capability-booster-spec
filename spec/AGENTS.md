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

