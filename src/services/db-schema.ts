import type { Database, QueryExecResult } from 'sql.js'

export const CURRENT_DB_VERSION = '16'

type DbRow = Record<string, unknown>

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  project_type TEXT DEFAULT 'highway',
  location TEXT DEFAULT '',
  owner_unit TEXT DEFAULT '',
  general_contractor TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  planned_end_date TEXT DEFAULT '',
  actual_end_date TEXT DEFAULT '',
  status TEXT DEFAULT 'preparing',
  difficulty TEXT DEFAULT 'medium',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  contract_no TEXT UNIQUE NOT NULL,
  contract_name TEXT DEFAULT '',
  contract_date TEXT DEFAULT '',
  no_tax_amount REAL DEFAULT 0,
  contract_tax_rate REAL DEFAULT 9,
  tax_amount REAL DEFAULT 0,
  contract_amount REAL DEFAULT 0,
  amount_source TEXT DEFAULT 'manual',
  summary TEXT DEFAULT '',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bill_of_quantities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  item_code TEXT DEFAULT '',
  item_name TEXT NOT NULL,
  remark TEXT DEFAULT '',
  note TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  quantity REAL DEFAULT 0,
  tax_rate REAL DEFAULT 9,
  no_tax_unit_price REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  no_tax_total_price REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  category TEXT DEFAULT '',
  chapter_code TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  settlement_no TEXT UNIQUE NOT NULL,
  settlement_type TEXT DEFAULT 'interim',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  previous_cumulative REAL DEFAULT 0,
  current_amount REAL DEFAULT 0,
  current_cumulative REAL DEFAULT 0,
  material_adjustment REAL DEFAULT 0,
  change_amount REAL DEFAULT 0,
  deduction_amount REAL DEFAULT 0,
  surcharge_amount REAL DEFAULT 0,
  change_remark TEXT DEFAULT '',
  material_remark TEXT DEFAULT '',
  surcharge_remark TEXT DEFAULT '',
  deduction_remark TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlement_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  boq_id INTEGER NOT NULL,
  item_code TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  contract_quantity REAL DEFAULT 0,
  previous_cumulative REAL DEFAULT 0,
  current_quantity REAL DEFAULT 0,
  current_cumulative REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  current_amount REAL DEFAULT 0,
  note TEXT DEFAULT '',
  FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE,
  FOREIGN KEY (boq_id) REFERENCES bill_of_quantities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contract_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  file_data TEXT DEFAULT '',
  uploaded_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlement_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  file_data TEXT DEFAULT '',
  uploaded_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  payment_type TEXT DEFAULT 'receive',
  payment_date TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  payment_method TEXT DEFAULT '',
  reference_no TEXT DEFAULT '',
  description TEXT DEFAULT '',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_cost_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  phase TEXT DEFAULT 'actual',
  category TEXT DEFAULT 'material',
  item_name TEXT DEFAULT '',
  spec TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  occurred_on TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_cost_entries_project_phase
  ON project_cost_entries(project_id, phase);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  invoice_no TEXT DEFAULT '',
  invoice_type TEXT DEFAULT 'special',
  invoice_amount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  invoice_date TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budget_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS price_resources (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'material',
  name TEXT NOT NULL DEFAULT '',
  spec TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS price_quotes (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  supplier TEXT DEFAULT '',
  price REAL DEFAULT 0,
  tax_caliber TEXT DEFAULT '',
  delivery_point TEXT DEFAULT '',
  collected_at TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (resource_id) REFERENCES price_resources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quota_items (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  base_unit TEXT DEFAULT 'm3',
  default_thickness_cm REAL DEFAULT 0,
  density REAL DEFAULT 0,
  loss_rate REAL DEFAULT 0,
  caliber TEXT DEFAULT '',
  components_json TEXT DEFAULT '[]',
  project_pool_json TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS quota_param_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quota_id TEXT NOT NULL,
  param_key TEXT NOT NULL,
  default_val REAL DEFAULT 0,
  min_valid REAL DEFAULT 0,
  max_valid REAL DEFAULT 0,
  description TEXT DEFAULT '',
  warning_msg TEXT DEFAULT '',
  UNIQUE(quota_id, param_key),
  FOREIGN KEY (quota_id) REFERENCES quota_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selected_quotes (
  resource_id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES price_resources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT DEFAULT '',
  base_url TEXT DEFAULT '',
  model TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

function execToRows(result: QueryExecResult[]): DbRow[] {
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row => {
    const mapped: DbRow = {}
    columns.forEach((column, index) => {
      mapped[column] = row[index]
    })
    return mapped
  })
}

function tableHasColumn(db: Database, tableName: string, columnName: string): boolean {
  const result = db.exec(`PRAGMA table_info(${tableName})`)
  return execToRows(result).some(row => String(row.name) === columnName)
}

function ensureInvoiceNoUniqueIndex(db: Database): void {
  const duplicateRows = execToRows(db.exec(`
    SELECT invoice_no, COUNT(*) AS duplicate_count
    FROM invoices
    WHERE invoice_no <> ''
    GROUP BY invoice_no
    HAVING COUNT(*) > 1
    LIMIT 1
  `))

  if (duplicateRows.length > 0) {
    const duplicateNo = String(duplicateRows[0].invoice_no ?? '')
    const duplicateCount = Number(duplicateRows[0].duplicate_count ?? 0)
    throw new Error(`检测到重复发票号码：${duplicateNo}（共 ${duplicateCount} 条），请先清理历史数据后再启动。`)
  }

  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no) WHERE invoice_no <> ''")
}

function runSchema(db: Database): void {
  const statements = SCHEMA_SQL.split(';').map(stmt => stmt.trim()).filter(Boolean)
  for (const statement of statements) {
    db.run(statement)
  }
}

function runMigrations(db: Database): void {
  if (!tableHasColumn(db, 'projects', 'budget_file_id')) {
    db.run("ALTER TABLE projects ADD COLUMN budget_file_id INTEGER DEFAULT NULL")
  }

  if (!tableHasColumn(db, 'contracts', 'no_tax_amount')) {
    db.run("ALTER TABLE contracts ADD COLUMN no_tax_amount REAL DEFAULT 0")
  }

  if (!tableHasColumn(db, 'contracts', 'contract_tax_rate')) {
    db.run("ALTER TABLE contracts ADD COLUMN contract_tax_rate REAL DEFAULT 9")
  }

  if (!tableHasColumn(db, 'contracts', 'tax_amount')) {
    db.run("ALTER TABLE contracts ADD COLUMN tax_amount REAL DEFAULT 0")
  }

  if (!tableHasColumn(db, 'bill_of_quantities', 'tax_rate')) {
    db.run("ALTER TABLE bill_of_quantities ADD COLUMN tax_rate REAL DEFAULT 9")
  }

  if (!tableHasColumn(db, 'bill_of_quantities', 'remark')) {
    db.run("ALTER TABLE bill_of_quantities ADD COLUMN remark TEXT DEFAULT ''")
  }

  if (!tableHasColumn(db, 'bill_of_quantities', 'note')) {
    db.run("ALTER TABLE bill_of_quantities ADD COLUMN note TEXT DEFAULT ''")
  }

  if (!tableHasColumn(db, 'bill_of_quantities', 'no_tax_unit_price')) {
    db.run("ALTER TABLE bill_of_quantities ADD COLUMN no_tax_unit_price REAL DEFAULT 0")
  }

  if (!tableHasColumn(db, 'bill_of_quantities', 'no_tax_total_price')) {
    db.run("ALTER TABLE bill_of_quantities ADD COLUMN no_tax_total_price REAL DEFAULT 0")
  }

  if (!tableHasColumn(db, 'bill_of_quantities', 'tax_amount')) {
    db.run("ALTER TABLE bill_of_quantities ADD COLUMN tax_amount REAL DEFAULT 0")
  }

  if (!tableHasColumn(db, 'settlement_details', 'item_code')) {
    db.run("ALTER TABLE settlement_details ADD COLUMN item_code TEXT DEFAULT ''")
  }

  if (!tableHasColumn(db, 'settlements', 'remark')) {
    db.run("ALTER TABLE settlements ADD COLUMN remark TEXT DEFAULT ''")
  }
  if (!tableHasColumn(db, 'settlement_details', 'item_name')) {
    db.run("ALTER TABLE settlement_details ADD COLUMN item_name TEXT DEFAULT ''")
  }
  if (!tableHasColumn(db, 'settlement_details', 'remark')) {
    db.run("ALTER TABLE settlement_details ADD COLUMN remark TEXT DEFAULT ''")
  }
  if (!tableHasColumn(db, 'settlement_details', 'unit')) {
    db.run("ALTER TABLE settlement_details ADD COLUMN unit TEXT DEFAULT ''")
  }

  if (!tableHasColumn(db, 'settlements', 'contract_ids')) {
    db.run("ALTER TABLE settlements ADD COLUMN contract_ids TEXT DEFAULT '[]'")
  }
  if (!tableHasColumn(db, 'settlement_details', 'contract_id')) {
    db.run("ALTER TABLE settlement_details ADD COLUMN contract_id INTEGER DEFAULT 0")
  }
  if (!tableHasColumn(db, 'settlement_details', 'note')) {
    db.run("ALTER TABLE settlement_details ADD COLUMN note TEXT DEFAULT ''")
  }

  try {
    db.run(`
      UPDATE settlement_details
      SET
        item_code = COALESCE((SELECT item_code FROM bill_of_quantities WHERE id = settlement_details.boq_id), ''),
        item_name = COALESCE((SELECT item_name FROM bill_of_quantities WHERE id = settlement_details.boq_id), ''),
        remark    = COALESCE((SELECT remark    FROM bill_of_quantities WHERE id = settlement_details.boq_id), ''),
        unit      = COALESCE((SELECT unit      FROM bill_of_quantities WHERE id = settlement_details.boq_id), '')
      WHERE item_name = '' OR item_name IS NULL OR remark = '' OR remark IS NULL
    `)
  } catch (e) {
    console.warn('Migration: failed to backfill settlement_details item fields', e)
  }

  try {
    db.run(`
      UPDATE contracts
      SET
        no_tax_amount = CASE
          WHEN no_tax_amount = 0 AND contract_amount > 0 THEN ROUND(contract_amount / (1 + contract_tax_rate / 100.0), 2)
          ELSE no_tax_amount
        END,
        tax_amount = CASE
          WHEN tax_amount = 0 AND contract_amount > 0 THEN ROUND(contract_amount - (contract_amount / (1 + contract_tax_rate / 100.0)), 2)
          ELSE tax_amount
        END
    `)
  } catch (e) {
    console.warn('Migration: failed to backfill contracts tax fields', e)
  }

  try {
    db.run(`
      UPDATE bill_of_quantities
      SET
        no_tax_unit_price = CASE
          WHEN no_tax_unit_price = 0 AND unit_price > 0 THEN ROUND(unit_price / (1 + tax_rate / 100.0), 2)
          ELSE no_tax_unit_price
        END,
        no_tax_total_price = CASE
          WHEN no_tax_total_price = 0 AND total_price > 0 THEN ROUND(total_price / (1 + tax_rate / 100.0), 2)
          ELSE no_tax_total_price
        END,
        tax_amount = CASE
          WHEN tax_amount = 0 AND total_price > 0 THEN ROUND(total_price - (total_price / (1 + tax_rate / 100.0)), 2)
          ELSE tax_amount
        END
    `)
  } catch (e) {
    console.warn('Migration: failed to backfill BOQ tax fields', e)
  }

  ensureInvoiceNoUniqueIndex(db)

  // v13 → v14: 成本管理 - 价格库 & 定额库落库
  // CREATE TABLE IF NOT EXISTS 是幂等的，上面 SCHEMA_SQL 已经包含了这些表的定义。
  // 这里只需要确保索引存在即可。
  try {
    if (!tableHasColumn(db, 'quota_items', 'components_json')) {
      db.run("ALTER TABLE quota_items ADD COLUMN components_json TEXT DEFAULT '[]'")
    }
    db.run('CREATE INDEX IF NOT EXISTS idx_price_quotes_resource ON price_quotes(resource_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_quota_param_rules_quota ON quota_param_rules(quota_id)')
    db.run(`
      UPDATE quota_items
      SET components_json = '[{"id":"tpl-asphalt-mixing","category":"mixing","name":"沥青混合料拌合费","unit":"t","basis":"tonnage","consumption":1,"price":12,"formula":"按混合料吨耗计入拌合站加工费"}]'
      WHERE id IN ('LM-AC20C', 'LM-AC13C', 'LM-SMA13', 'LM-AC25C')
        AND (components_json IS NULL OR components_json = '' OR components_json = '[]')
    `)
    db.run(`
      UPDATE quota_items
      SET components_json = '[{"id":"tpl-csm-mixing","category":"mixing","name":"水泥稳定碎石拌合费","unit":"t","basis":"tonnage","consumption":1,"price":8,"formula":"按水稳混合料吨耗计入集中拌合费"}]'
      WHERE id = 'LM-BASE-CSM'
        AND (components_json IS NULL OR components_json = '' OR components_json = '[]')
    `)
  } catch (e) {
    console.warn('Migration v14: failed to create cost management indexes', e)
  }

  // v14 -> v15: AI 能力统一配置，供成本、报表等模块复用。
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_default ON ai_provider_configs(is_default)')
  } catch (e) {
    console.warn('Migration v15: failed to create AI config indexes', e)
  }

  // v15 -> v16: 项目难度、规模阈值、系统设置、项目池
  if (!tableHasColumn(db, 'projects', 'difficulty')) {
    try {
      db.run("ALTER TABLE projects ADD COLUMN difficulty TEXT DEFAULT 'medium'")
    } catch (e) {
      console.warn('Migration v16: failed to add difficulty to projects', e)
    }
  }

  if (!tableHasColumn(db, 'quota_items', 'project_pool_json')) {
    try {
      db.run("ALTER TABLE quota_items ADD COLUMN project_pool_json TEXT DEFAULT NULL")
    } catch (e) {
      console.warn('Migration v16: failed to add project_pool_json to quota_items', e)
    }
  }

  try {
    db.run("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('project_scale_small', '5000000')")
    db.run("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('project_scale_large', '20000000')")
  } catch (e) {
    console.warn('Migration v16: failed to seed system settings', e)
  }
}

export function applyDatabaseSchema(db: Database): void {
  runSchema(db)
  runMigrations(db)
}
