# 03 Feature Manifest 规范

## 3.1 目的

Feature Manifest 是所有“既有业务功能”与 HarmonyOS 增强能力之间的稳定中间层。来源可以是移动应用，也可以是 ARM/x86/x86_64/C86 等架构上的桌面软件。

它不描述 UI，不描述 CPU 指令，只描述功能语义和来源证据。

## 3.2 V0.1 顶层结构

```yaml
schemaVersion: "0.1"
application:
  id: com.example.app
  sourcePlatforms: [android, windows, linux]
  sourceArchitectures: [arm64, x86_64, c86]
  sourceAvailability: source

features:
  - id: queryAppointment
    kind: ACTION
    title: 查询预约
    sourceRefs: []
    contract: {}
    hints: {}
```

### sourcePlatforms

允许：

- `android`
- `ios`
- `windows`
- `linux`
- `macos`

### sourceArchitectures

允许作为来源标识：

- `arm`
- `arm64`
- `x86`
- `x86_64`
- `c86`
- `unknown`

注意：这里不是 HarmonyOS Target ABI。

### sourceAvailability

- `source`：有源码，可进行规则/AST/Build 分析。
- `binary_only`：只有 PE/ELF/Mach-O 等二进制，仅支持有限 inventory / evidence，不允许自动声称完成迁移。

## 3.3 ACTION

（与原规范一致）用于描述已存在的用户/系统可执行动作。

## 3.4 STATE

（与原规范一致）用于描述具有生命周期和动态变化的既有业务状态。

## 3.5 RESOURCE

V0.1 Resource：`camera_capture`、`document_scan`、`gallery_pick` 等已存在资源获取需求。

## 3.6 SourceRef

SourceRef 必须同时表达“来源平台”和“来源架构”，但 Planner 不得用源架构直接决定 HarmonyOS 能力：

```yaml
sourceRefs:
  - platform: linux
    architecture: c86
    language: cpp
    framework: qt
    buildSystem: cmake
    file: src/order/OrderService.cpp
    lineStart: 120
    lineEnd: 148
    evidence: "ORDER_WAITING -> ORDER_FINISHED state transition"
    confidence: 0.91
```

Binary-only 可写：

```yaml
sourceRefs:
  - platform: windows
    architecture: x86_64
    binary: app.exe
    evidenceKind: import_or_string
    confidence: 0.35
```

此类低置信度 evidence 默认不能自动进入 Generator。

## 3.7 置信度

- `>=0.90`：high
- `0.70~0.89`：medium
- `<0.70`：advanced view only
- `binary_only` 自动发现默认最高置信度不得超过 0.69，除非开发者人工确认契约。

## 3.8 不允许出现的字段

禁止任何 UI hierarchy / style / layout 字段，也禁止 target machine-code translation 字段。
