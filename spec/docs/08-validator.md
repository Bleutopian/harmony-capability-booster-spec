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

