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

