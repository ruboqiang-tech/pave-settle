# Web + SQLite 去 Tauri 改造交接文档

定位：这是数据库管理主线的专项交接文档。项目总览看 `README.md`，最近验证看 `development_status.md`。

## 当前结论

| 主题 | 当前口径 |
| --- | --- |
| 交付方向 | Web-only，不继续做 Tauri 桌面端回归。 |
| 本地数据库 | SQL.js 运行 SQLite。 |
| 主库文件 | `databaseRoot/pave.db`。 |
| 备份目录 | `databaseRoot/backups/`。 |
| 附件 | SQLite-only，写入附件表 `file_data` 字段。 |
| 运行路径 | 浏览器文件夹模式 `browser-directory` 与 Vite `/api/db` 开发桥。 |
| 历史模型 | `instanceRoot + attachments/ + backups/` 已归档，不再作为当前主契约。 |

## 数据库目录

```text
databaseRoot/
  pave.db
  backups/
    <backup-id>/
      pave.db
      backup.meta.json
```

## 数据中心能力

| 能力 | 当前实现 |
| --- | --- |
| 查看当前库 | 展示存储模式、数据库位置、主库文件、schema 版本和结构状态。 |
| 查看业务指标 | 展示项目、合同、结算、收款等业务数据摘要。 |
| 选择已有路径 | 通过 `/api/db/config` 接管已有 `databaseRoot`。 |
| 选择新路径 | 通过 `/api/db/config` 设置新 `databaseRoot`，刷新后初始化空库和备份目录。 |
| 使用现有文件夹 | 浏览器文件夹模式下接管包含 `pave.db` 的目录。 |
| 迁移当前库 | 将当前数据库写入用户选择 of 浏览器文件夹目录。 |
| 新建空库 | 在用户选择的浏览器文件夹目录准备空白主库结构。 |
| 创建备份 | 把当前主库写入 `backups/<backup-id>/`。 |
| 删除备份 | 删除指定备份目录。 |

页面内没有“直接恢复备份”按钮。需要使用备份数据时，按“选择已有路径”或“使用现有文件夹”接管备份目录。

## 代码对应关系

| 文件 | 职责 |
| --- | --- |
| `src/services/db-core.ts` | SQL.js 初始化、主库读写、开发桥 fallback、备份入口。 |
| `src/services/db-schema.ts` | schema 创建和迁移，当前版本 `13`。 |
| `src/services/database-storage.types.ts` | 数据库配置、备份元数据类型。 |
| `src/services/web-file-system.service.ts` | 浏览器文件夹文件读写基础能力。 |
| `src/services/web-db-storage.service.ts` | 浏览器文件夹模式下主库接管、迁移、新建空库。 |
| `src/services/web-db-backup.service.ts` | 浏览器文件夹模式下备份列表、创建、删除。 |
| `vite-plugin-db-api.ts` | Vite 开发环境 `/api/db` 与 `/api/db/config` 文件桥。 |
| `src/views/data/DataCenter.vue` | 数据中心页面组合。 |
| `src/views/data/useDataCenter.ts` | 数据中心交互编排。 |
| `src/services/attachment.service.ts` | SQLite-only 合同附件与结算附件。 |

## `/api/db/config` 注意项

| 项 | 要求 |
| --- | --- |
| 请求体 | 使用 UTF-8 JSON。 |
| 已有库 | `{ "databaseRoot": "...", "mode": "existing" }`。 |
| 新库 | `{ "databaseRoot": "...", "mode": "new" }`。 |
| 适用范围 | 当前按开发桥处理，不应直接扩展为多人共享写库入口。 |

## 接手建议

1. 先跑 `npm test`，确认基础服务仍通过。
2. 在真实浏览器里回归 `/data` 的已有路径、新路径、浏览器文件夹接管、迁移当前库。
3. 抽查合同附件和结算附件的预览/下载，而不是只看附件数量。
4. 明确 `/api/db` 最终边界：继续作为开发兜底，还是安排下线。

## 文档分工

| 文档 | 分工 |
| --- | --- |
| `README.md` | 仓库文档入口与应用技术入口。 |
| `development_status.md` | 最近扫描和验证结果。 |
| `TODO.md` | 当前待办。 |
| `数据库管理重构完整交接方案.md` | 历史归档。 |
