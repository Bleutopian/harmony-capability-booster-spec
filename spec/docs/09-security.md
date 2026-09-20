# 09 安全、隐私与供应链边界

## 9.1 源码处理

默认：

- 本地扫描。
- 本地生成。
- 不上传源代码、证书、密钥、配置文件。

若未来引入云端 AI：

- 必须 opt-in。
- 必须支持脱敏/片段化。
- 必须明确列出上传内容。
- 企业版必须支持完全离线模式。

## 9.2 Secret Handling

Analyzer/Generator 必须默认忽略：

- signing configs
- keystore
- `.env`
- token/password/secret
- private key

日志中禁止打印这些内容。

## 9.3 最小权限

Generator 不得因为某个 Kit“可能需要”就批量加权限。权限只能由已批准的 Plan Item 触发。

## 9.4 宿主代码安全

Patch 必须：

- 生成 diff。
- 可回滚。
- 不修改业务逻辑。
- 不在未知位置注入反射/动态执行代码。

## 9.5 供应链

Runtime HAR：

- 版本必须固定。
- 发布物生成 SBOM。
- 依赖有 allowlist。
- Release 需 hash/checksum。

## 9.6 数据最小化

Live View 等系统展示能力只接收实现目标所需字段；不把整个业务对象或敏感字段直接塞入系统展示 payload。

