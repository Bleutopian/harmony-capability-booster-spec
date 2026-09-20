# 05 Feature Analyzer 设计

## 5.1 目标

Analyzer 的任务不是理解完整 App，也不是迁移 UI/机器码，而是发现“可能值得增强的已存在功能”。

输出永远是 **Candidate**。

## 5.2 V0.1 输入

```text
--android <source-root>
--ios <source-root>
--windows <source-root|binary>
--linux <source-root|binary>
--macos <source-root|binary>
--source-arch <arm|arm64|x86|x86_64|c86|unknown>
--feature-hints <optional yaml/json>
```

多个输入允许并存，用于一个 ISV 同时维护移动端/桌面端版本。

若只有 APK/IPA/PE/ELF/Mach-O 且无源码，必须提示能力受限，不承诺完整语义分析。

## 5.3 Android / iOS

保持原有规则：Intent/Deep Link、Notification、业务 API、状态、Camera/Document/Gallery 等功能证据；禁止 UI hierarchy 迁移。

## 5.4 Windows 桌面扫描重点

- C/C++/Win32、.NET、Qt、Electron 中的业务 Action/Command/Service。
- protocol handler / URL scheme / command-line action。
- 通知与长期状态更新线索。
- Camera/Scanner/File/Image picker 类 Resource。
- 状态枚举、event bus、state machine。
- Native 库与架构 inventory。

不解析控件树用于页面迁移。

## 5.5 Linux/国产桌面扫描重点

- C/C++/Qt/GTK/Electron/Java 业务方法。
- D-Bus/IPC 仅作为功能入口证据。
- desktop notification / protocol handler。
- camera/scan/file/image resource flow。
- 状态 enum / event stream。
- ELF/native dependency inventory。

## 5.6 macOS 桌面扫描重点

- App Intents/Handoff/Notification 等功能证据。
- Swift/Objective-C/C++/Qt/Electron 业务接口。
- camera/photo/document resources。
- 禁止 UI 迁移。

## 5.7 Native Analyzer

Native Analyzer 是“证据与风险扫描器”，不是迁移器：

```ts
interface NativeInventory {
  sourceArchitectures: Array<'arm'|'arm64'|'x86'|'x86_64'|'c86'|'unknown'>;
  buildSystems: string[];
  languages: string[];
  libraries: NativeDependency[];
}
```

仅当源码存在时，可进一步分析 CMake/qmake/meson 等并给出 OHOS NDK 重编译检查项。

## 5.8 Candidate

```ts
interface Candidate {
  id: string;
  kind: 'ACTION' | 'STATE' | 'RESOURCE';
  titleGuess: string;
  confidence: number;
  sourceRefs: SourceRef[];
  extractedContract?: unknown;
  reasons: string[];
}
```

Candidate 不包含 page/button/layout/machine-code translation。

## 5.9 Binary-only 限制

- 允许架构识别、imports、metadata、URI/字符串弱 evidence。
- 自动 candidate 置信度上限 0.69。
- 必须人工确认才能进入 Manifest。
- 不做反保护、解密、授权绕过。

## 5.10 Developer Review

移动端和桌面端使用同一 review 流程，开发者可 accept/reject/rename/补 contract/标敏感性。
