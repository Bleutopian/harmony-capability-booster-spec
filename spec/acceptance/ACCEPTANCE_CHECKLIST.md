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

