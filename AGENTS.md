# Project Notes

本文件记录协作和本机工作流约束，不描述业务架构。业务入口看 `README.md`，最近状态看 `development_status.md`。

## 文档入口

| 需要了解 | 读取 |
| --- | --- |
| 应用架构、命令、目录 | `README.md` |
| 最近扫描、测试、风险 | `development_status.md` |
| 当前待办 | `./TODO.md` |
| 数据库管理交接 | `./Web+SQLite去Tauri改造交接文档.md` |
| 历史数据库模型 | `./数据库管理重构完整交接方案.md` |

## 命令约束

| 项 | 要求 |
| --- | --- |
| PowerShell | 使用 `pwsh`，不要使用 Windows PowerShell 5.1 的 `powershell`。 |
| 测试 | 默认使用 `npm test`。 |
| 开发 | 默认使用 `npm run dev`。 |
| 输出 | 汇报保持紧凑，不要写占屏很大的卡片式总结。 |

## QQ 桥约束

| 配置 | 值 |
| --- | --- |
| `CTI_DISABLE_STREAMING` | `true` |
| `CTI_QQ_SMART_CHUNKING` | `true` |

原因：当前 relay/proxy API 有并发限制。启用 streaming 时，Codex desktop client 可能完全无响应。

## QQ 回复策略

| 行为 | 口径 |
| --- | --- |
| 长回复 | 依赖 smart chunking。 |
| 进度广播 | 已退役，不要恢复。 |
| 心跳式消息 | 不使用，避免产生低价值 QQ 消息。 |

## 本机启动设置

| 项 | 状态 |
| --- | --- |
| Codex | Windows 登录时由 Startup 文件夹启动。 |
| QQ bridge | Windows 登录时由 Startup 文件夹启动，重启后自动重连。 |
