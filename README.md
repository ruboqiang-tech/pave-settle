# 结算全流程管理

本目录是项目主应用：一个本地优先的 Web 工程结算管理系统。

| 项 | 当前口径 |
| --- | --- |
| 前端 | Vue 3 + Vite + TypeScript + Element Plus |
| 数据库 | SQL.js 运行 SQLite |
| 持久化 | 双数据库文件配置，浏览器文件句柄优先，`/api/db` 和 `/api/db/global` 作为开发桥 |
| 交付方向 | Web-only，不再以 Tauri 桌面端为当前目标 |
| 附件 | 写入 SQLite `file_data`，不再依赖物理 `attachments/` |
| 成本管理 | 已有独立说明，本轮不展开 |

## 快速开始

```bash
npm ci
npm run dev
```

验证命令：

```bash
npm run build
npm test
```

`npm run dev`、`npm run build`、`npm test` 都通过 `node-local.cmd` 调用本地 Node 工具链。

## 业务入口

| 入口 | 当前职责 |
| --- | --- |
| 首页 | 汇总项目、合同金额、结算、收款和趋势数据。 |
| 项目管理 | 项目列表、项目详情、合同、BOQ、合同附件和项目内结算入口。 |
| 结算管理 | 结算列表、新建结算单、结算详情、确认/审批状态和累计链重算。 |
| 收款管理 | 收款记录和发票台账。 |
| 报表中心 | 项目汇总、结算明细、应收款口径与导出。 |
| 总包汇总 | 按总包单位汇总项目、合同、结算、收款和开票口径。 |
| 数据中心 | 数据库位置、备份、业务指标和存储模式管理。 |

合同不再作为独立主路由交付；旧 `contracts` 路由只做兼容重定向。

## 代码地图

```text
src/
  router/                 路由、菜单、页面标题
  views/
    projects/             项目、合同、BOQ、项目详情
    settlements/          结算列表与结算详情
    payments/             收款与发票台账
    reports/              报表中心
    partners/             总包汇总
    data/                 数据中心
  services/
    db-core.ts            SQL.js 初始化、读写、开发桥 fallback
    db-schema.ts          SQLite schema 和迁移
    web-db-storage.*      浏览器文件夹存储
    web-db-backup.*       浏览器文件夹备份
    analytics-core.*      业务快照
    *-analytics.*         首页、报表、总包统计
    attachment.*          SQLite-only 附件
```

## 数据库结构

在开发桥模式下，配置文件（`db-config.json`）可分别指定以下两数据库的绝对物理路径。在浏览器模式下，直接配置 IndexedDB 持久化文件句柄：

- 项目事务主库：`pave.db` (存储业务数据)
- 企业全局资产库：`global-assets.db` (存储价格、定额等资产数据)

异地手工备份建议双库成对拷贝备份。

核心业务表：

| 表 | 用途 |
| --- | --- |
| `projects` | 项目主数据 |
| `contracts` | 项目合同 |
| `bill_of_quantities` | 合同 BOQ 清单 |
| `settlements` | 结算单 |
| `settlement_details` | 结算明细 |
| `contract_attachments` | 合同附件 |
| `settlement_attachments` | 结算附件 |
| `payments` | 收付款记录 |
| `invoices` | 发票记录 |

当前 schema 版本为 `13`。不要再按历史 `instanceRoot + attachments/ + backups/` 模型理解当前主链。

## 文档分工与接手顺序

本项目的文档按以下职责分工，以避免在多份说明中重复维护同类结论：

| 文档 | 定位 | 何时阅读 |
| --- | --- | --- |
| [README.md](./README.md) | 应用技术入口 | 了解当前架构、运行命令、业务入口和核心目录。 |
| [development_status.md](./development_status.md) | 最近状态 | 接手前确认最近扫描、测试结果、风险和排除范围。 |
| [TODO.md](./TODO.md) | 当前待办 | 只看接下来要做什么，不看历史过程。 |
| [Web+SQLite去Tauri改造交接文档.md](./Web+SQLite去Tauri改造交接文档.md) | 数据库管理交接 | 处理数据库位置、备份、浏览器文件夹模式、`/api/db` 开发桥时阅读。 |
| [数据库管理重构完整交接方案.md](./数据库管理重构完整交接方案.md) | 历史归档 | 追溯旧 `instanceRoot + attachments + backups` 模型来源时阅读。 |
| [multi_user_migration_plan.md](./multi_user_migration_plan.md) | 远期规划 | 讨论云端协同、认证、权限、审计前阅读。 |
| [AGENTS.md](./AGENTS.md) | 协作约束 | Codex、QQ 桥和本机命令偏好相关说明。 |
| [成本管理模块说明.md](./成本管理模块说明.md) | 成本管理专项说明 | 成本管理模块单独维护；本轮整理不改该文档内容。 |

### 建议接手顺序

1. 先读 [README.md](./README.md)。
2. 再读 [development_status.md](./development_status.md)。
3. 做具体开发任务前看 [TODO.md](./TODO.md)。
4. 仅在处理数据库底层管理、备份和存储逻辑时，阅读 [Web+SQLite去Tauri改造交接文档.md](./Web+SQLite去Tauri改造交接文档.md)。
5. 切勿从历史归档或远期规划反推当前实际的产品需求与实现。
