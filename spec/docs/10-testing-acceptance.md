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
