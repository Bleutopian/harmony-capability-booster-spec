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
