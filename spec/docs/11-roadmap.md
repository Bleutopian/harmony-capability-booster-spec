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

