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
