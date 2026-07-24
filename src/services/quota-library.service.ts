/**
 * 定额库持久化服务。
 * 管理 quota_items 和 quota_param_rules 两张表的 CRUD。
 */
import {
  execToObjects,
  getDb,
  getGlobalDb,
  getRowNumber,
  getRowString,
  saveGlobalToStorage as saveToStorage,
  withGlobalTransaction as withTransaction,
} from './db-core'
import type { QuotaItem, ParamRule, QuotaComponent } from '@/types/quota-library.types'
import {
  SEED_QUOTA_ITEMS,
  SEED_PARAM_RULES,
} from './seed-data'

export interface ActualConsumptionCostResource {
  category: string
  itemName: string
  spec: string
  unit: string
  quantity: number
  amount: number
  entryCount: number
}

export type ActualConsumptionOutputSource = 'settlement' | 'budget' | 'contract' | 'manual'

export interface ActualConsumptionProject {
  id: number
  code: string
  name: string
  status: string
  difficulty: string
  contractAmount: number
  designQuantity: number
  settledQuantity: number
  outputQuantity: number
  outputSource: ActualConsumptionOutputSource
  actualCostAmount: number
  actualCostCount: number
  actualCosts: ActualConsumptionCostResource[]
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

function mapQuotaItemRow(row: Record<string, unknown>): QuotaItem {
  let components: QuotaComponent[] = []
  try {
    const parsed = JSON.parse(getRowString(row, 'components_json', '[]'))
    components = Array.isArray(parsed) ? parsed : []
  } catch {
    components = []
  }

  let projectPoolJson: number[] | null = null
  try {
    const poolStr = getRowString(row, 'project_pool_json', '')
    if (poolStr) {
      projectPoolJson = JSON.parse(poolStr)
    }
  } catch {
    projectPoolJson = null
  }

  return {
    id: getRowString(row, 'id'),
    code: getRowString(row, 'code'),
    name: getRowString(row, 'name'),
    baseUnit: getRowString(row, 'base_unit', 'm3') as 'm3' | 'm2',
    defaultThicknessCm: getRowNumber(row, 'default_thickness_cm'),
    density: getRowNumber(row, 'density'),
    lossRate: getRowNumber(row, 'loss_rate'),
    caliber: getRowString(row, 'caliber'),
    components,
    projectPoolJson,
  }
}

function mapParamRuleRow(row: Record<string, unknown>): ParamRule & { quotaId: string; paramKey: string } {
  return {
    quotaId: getRowString(row, 'quota_id'),
    paramKey: getRowString(row, 'param_key'),
    defaultVal: getRowNumber(row, 'default_val'),
    minValid: getRowNumber(row, 'min_valid'),
    maxValid: getRowNumber(row, 'max_valid'),
    desc: getRowString(row, 'description'),
    warningMsg: getRowString(row, 'warning_msg'),
  }
}

function assertDb() {
  const db = getGlobalDb()
  if (!db) throw new Error('Database not initialized')
  return db
}

function readNumber(db: NonNullable<ReturnType<typeof getDb>>, sql: string, params: unknown[], column: string): number {
  const rows = execToObjects(db.exec(sql, params))
  return Number(rows[0]?.[column] || 0)
}

function sumBudgetFileQuantity(content: string): number {
  if (!content) return 0
  try {
    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed?.computedBOQItems) ? parsed.computedBOQItems : []
    return items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Exported service
// ---------------------------------------------------------------------------

export const quotaLibraryService = {
  /**
   * 加载所有定额条目。
   */
  async listQuotaItems(): Promise<QuotaItem[]> {
    const db = getGlobalDb()
    if (!db) return []

    return execToObjects(
      db.exec('SELECT * FROM quota_items ORDER BY code, id'),
    ).map(mapQuotaItemRow)
  },

  /**
   * 新增定额条目。
   */
  async createQuotaItem(item: QuotaItem): Promise<void> {
    const db = assertDb()
    db.run(
      `INSERT INTO quota_items (id, code, name, base_unit, default_thickness_cm, density, loss_rate, caliber, components_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.code,
        item.name,
        item.baseUnit,
        item.defaultThicknessCm,
        item.density,
        item.lossRate,
        item.caliber,
        JSON.stringify(item.components || []),
      ],
    )
    await saveToStorage()
  },

  /**
   * 更新定额条目。
   */
  async updateQuotaItem(item: QuotaItem): Promise<void> {
    const db = assertDb()
    db.run(
      `UPDATE quota_items SET code = ?, name = ?, base_unit = ?, default_thickness_cm = ?, density = ?, loss_rate = ?, caliber = ?, components_json = ?
       WHERE id = ?`,
      [
        item.code,
        item.name,
        item.baseUnit,
        item.defaultThicknessCm,
        item.density,
        item.lossRate,
        item.caliber,
        JSON.stringify(item.components || []),
        item.id,
      ],
    )
    await saveToStorage()
  },

  /**
   * 删除定额条目（级联删除关联的参数校验规则）。
   */
  async deleteQuotaItem(id: string): Promise<void> {
    const db = assertDb()
    await withTransaction(async () => {
      db.run('DELETE FROM quota_param_rules WHERE quota_id = ?', [id])
      db.run('DELETE FROM quota_items WHERE id = ?', [id])
    })
    await saveToStorage()
  },

  // -----------------------------------------------------------------------
  // 参数校验规则
  // -----------------------------------------------------------------------

  /**
   * 加载所有参数校验规则，按 quotaId → paramKey → ParamRule 组织。
   */
  async listParamRules(): Promise<Record<string, Record<string, ParamRule>>> {
    const db = getGlobalDb()
    if (!db) return {}

    const rows = execToObjects(
      db.exec('SELECT * FROM quota_param_rules ORDER BY quota_id, param_key'),
    ).map(mapParamRuleRow)

    const result: Record<string, Record<string, ParamRule>> = {}
    for (const row of rows) {
      if (!result[row.quotaId]) {
        result[row.quotaId] = {}
      }
      result[row.quotaId][row.paramKey] = {
        defaultVal: row.defaultVal,
        minValid: row.minValid,
        maxValid: row.maxValid,
        desc: row.desc,
        warningMsg: row.warningMsg,
      }
    }
    return result
  },

  /**
   * 获取某个定额的所有参数校验规则。
   */
  async getParamRulesForQuota(quotaId: string): Promise<Record<string, ParamRule>> {
    const db = getGlobalDb()
    if (!db) return {}

    const rows = execToObjects(
      db.exec('SELECT * FROM quota_param_rules WHERE quota_id = ? ORDER BY param_key', [quotaId]),
    ).map(mapParamRuleRow)

    const result: Record<string, ParamRule> = {}
    for (const row of rows) {
      result[row.paramKey] = {
        defaultVal: row.defaultVal,
        minValid: row.minValid,
        maxValid: row.maxValid,
        desc: row.desc,
        warningMsg: row.warningMsg,
      }
    }
    return result
  },

  /**
   * 插入或更新某个定额的某个参数规则。
   */
  async upsertParamRule(quotaId: string, paramKey: string, rule: ParamRule): Promise<void> {
    const db = assertDb()
    db.run(
      `INSERT INTO quota_param_rules (quota_id, param_key, default_val, min_valid, max_valid, description, warning_msg)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(quota_id, param_key)
       DO UPDATE SET default_val = ?, min_valid = ?, max_valid = ?, description = ?, warning_msg = ?`,
      [
        quotaId, paramKey,
        rule.defaultVal, rule.minValid, rule.maxValid, rule.desc, rule.warningMsg,
        rule.defaultVal, rule.minValid, rule.maxValid, rule.desc, rule.warningMsg,
      ],
    )
    await saveToStorage()
  },

  /**
   * 删除某个定额的某个参数规则。
   */
  async deleteParamRule(quotaId: string, paramKey: string): Promise<void> {
    const db = assertDb()
    db.run(
      'DELETE FROM quota_param_rules WHERE quota_id = ? AND param_key = ?',
      [quotaId, paramKey],
    )
    await saveToStorage()
  },

  /**
   * 获取套用了指定定额的所有项目，含难度、设计工程量、结算工程量及实际消耗流水。
   */
  async getProjectsUsingQuota(quotaId: string): Promise<any[]> {
    const db = getDb()
    if (!db) return []

    const projectRows = execToObjects(db.exec('SELECT * FROM projects'))
    const budgetFileRows = execToObjects(db.exec('SELECT id, content FROM budget_files'))
    const budgetFileMap = new Map<number, string>()
    for (const bf of budgetFileRows) {
      budgetFileMap.set(Number(bf.id), String(bf.content))
    }

    const matchedProjects: any[] = []
    for (const proj of projectRows) {
      const budgetFileId = Number(proj.budget_file_id)
      if (!budgetFileId || !budgetFileMap.has(budgetFileId)) continue

      try {
        const contentStr = budgetFileMap.get(budgetFileId)!
        const parsed = JSON.parse(contentStr)
        const boqItems = parsed.computedBOQItems || []
        
        const matchingBoq = boqItems.filter((item: any) => item.linkedQuotaId === quotaId)
        if (matchingBoq.length === 0) continue

        const designQuantity = matchingBoq.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
        const projId = Number(proj.id)
        
        // 合同总额
        const contractRows = execToObjects(db.exec('SELECT contract_amount FROM contracts WHERE project_id = ?', [projId]))
        const contractAmount = contractRows.reduce((sum: number, c: any) => sum + Number(c.contract_amount || 0), 0)

        // 结算工程量
        const itemNames = matchingBoq.map((item: any) => item.itemName)
        let settledQuantity = 0
        if (itemNames.length > 0) {
          const placeholders = itemNames.map(() => '?').join(',')
          const settleRows = execToObjects(db.exec(
            `SELECT SUM(sd.current_quantity) as qty
             FROM settlement_details sd
             JOIN settlements s ON sd.settlement_id = s.id
             WHERE s.project_id = ? AND (s.status = 'confirmed' OR s.status = 'approved')
               AND sd.item_name IN (${placeholders})`,
            [projId, ...itemNames]
          ))
          settledQuantity = Number(settleRows[0]?.qty || 0)
        }

        const outputQuantity = settledQuantity > 0 ? settledQuantity : designQuantity

        // 实际支出明细
        const costRows = execToObjects(db.exec(
          `SELECT category, item_name, spec, unit, SUM(quantity) as total_qty, SUM(amount) as total_amount
           FROM project_cost_entries
           WHERE project_id = ? AND phase = 'actual'
           GROUP BY category, item_name, spec, unit`,
          [projId]
        ))

        matchedProjects.push({
          id: projId,
          code: String(proj.code),
          name: String(proj.name),
          status: String(proj.status),
          difficulty: String(proj.difficulty || 'medium'),
          contractAmount,
          designQuantity,
          settledQuantity,
          outputQuantity,
          actualCosts: costRows.map((r: any) => ({
            category: String(r.category),
            itemName: String(r.item_name),
            spec: String(r.spec),
            unit: String(r.unit),
            quantity: Number(r.total_qty || 0),
            amount: Number(r.total_amount || 0)
          }))
        })
      } catch (e) {
        console.error(`Failed to parse budget file for project ${proj.id}`, e)
      }
    }

    return matchedProjects
  },

  /**
   * 获取有实际成本台账的项目池。
   * 项目选择由用户主动决定；这里不再按参考定额反查项目。
   */
  async getActualConsumptionProjectPool(): Promise<ActualConsumptionProject[]> {
    const db = getDb()
    if (!db) return []

    const projectRows = execToObjects(db.exec('SELECT * FROM projects ORDER BY created_at DESC'))
    const budgetFileRows = execToObjects(db.exec('SELECT id, content FROM budget_files'))
    const budgetFileMap = new Map<number, string>()
    for (const row of budgetFileRows) {
      budgetFileMap.set(Number(row.id), String(row.content || ''))
    }

    const projects: ActualConsumptionProject[] = []

    for (const proj of projectRows) {
      const projectId = Number(proj.id || 0)
      if (!projectId) continue

      const costRows = execToObjects(db.exec(
        `SELECT category, item_name, spec, unit, SUM(quantity) as total_qty, SUM(amount) as total_amount, COUNT(*) as entry_count
         FROM project_cost_entries
         WHERE project_id = ? AND phase = 'actual'
         GROUP BY category, item_name, spec, unit
         ORDER BY category, item_name, spec, unit`,
        [projectId],
      ))

      if (costRows.length === 0) continue

      const actualCosts = costRows.map((row: any) => ({
        category: String(row.category || 'other'),
        itemName: String(row.item_name || '未命名成本项'),
        spec: String(row.spec || ''),
        unit: String(row.unit || ''),
        quantity: Number(row.total_qty || 0),
        amount: Number(row.total_amount || 0),
        entryCount: Number(row.entry_count || 0),
      }))

      const contractAmount = readNumber(
        db,
        'SELECT SUM(contract_amount) as amount FROM contracts WHERE project_id = ?',
        [projectId],
        'amount',
      )

      const settledQuantity = readNumber(
        db,
        `SELECT SUM(sd.current_quantity) as qty
         FROM settlement_details sd
         JOIN settlements s ON sd.settlement_id = s.id
         WHERE s.project_id = ? AND (s.status = 'confirmed' OR s.status = 'approved')`,
        [projectId],
        'qty',
      )

      const budgetFileId = Number(proj.budget_file_id || 0)
      const budgetQuantity = budgetFileId ? sumBudgetFileQuantity(budgetFileMap.get(budgetFileId) || '') : 0
      const contractQuantity = readNumber(
        db,
        `SELECT SUM(bq.quantity) as qty
         FROM bill_of_quantities bq
         JOIN contracts c ON bq.contract_id = c.id
         WHERE c.project_id = ?`,
        [projectId],
        'qty',
      )

      const designQuantity = budgetQuantity > 0 ? budgetQuantity : contractQuantity
      const outputQuantity = settledQuantity > 0 ? settledQuantity : designQuantity
      const outputSource: ActualConsumptionOutputSource = settledQuantity > 0
        ? 'settlement'
        : budgetQuantity > 0
          ? 'budget'
          : contractQuantity > 0
            ? 'contract'
            : 'manual'

      projects.push({
        id: projectId,
        code: String(proj.code || ''),
        name: String(proj.name || ''),
        status: String(proj.status || ''),
        difficulty: String(proj.difficulty || 'medium'),
        contractAmount,
        designQuantity,
        settledQuantity,
        outputQuantity,
        outputSource,
        actualCostAmount: actualCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0),
        actualCostCount: actualCosts.reduce((sum, cost) => sum + Number(cost.entryCount || 0), 0),
        actualCosts,
      })
    }

    return projects
  },

  /**
   * 保存综合消耗生成的实际定额。
   */
  async saveSyntheticQuota(item: QuotaItem): Promise<void> {
    const db = assertDb()
    const rows = db.exec('SELECT 1 FROM quota_items WHERE id = ?', [item.id])
    const exists = rows.length > 0 && rows[0].values.length > 0
    if (exists) {
      db.run(
        `UPDATE quota_items SET
          code = ?, name = ?, base_unit = ?, default_thickness_cm = ?, density = ?, loss_rate = ?, caliber = ?, components_json = ?, project_pool_json = ?
         WHERE id = ?`,
        [
          item.code,
          item.name,
          item.baseUnit,
          item.defaultThicknessCm,
          item.density,
          item.lossRate,
          item.caliber,
          JSON.stringify(item.components || []),
          item.projectPoolJson ? JSON.stringify(item.projectPoolJson) : null,
          item.id
        ]
      )
    } else {
      db.run(
        `INSERT INTO quota_items (id, code, name, base_unit, default_thickness_cm, density, loss_rate, caliber, components_json, project_pool_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.code,
          item.name,
          item.baseUnit,
          item.defaultThicknessCm,
          item.density,
          item.lossRate,
          item.caliber,
          JSON.stringify(item.components || []),
          item.projectPoolJson ? JSON.stringify(item.projectPoolJson) : null,
        ]
      )
    }
    await saveToStorage()
  },

  // -----------------------------------------------------------------------
  // 种子数据
  // -----------------------------------------------------------------------

  /**
   * 若 quota_items 或 quota_param_rules 为空，灌入默认种子数据。
   */
  async seedIfEmpty(): Promise<void> {
    const db = getGlobalDb()
    if (!db) return

    const countResult = db.exec('SELECT count(*) FROM quota_items')
    const count = Number(countResult[0]?.values?.[0]?.[0] ?? 0)

    const ruleCountResult = db.exec('SELECT count(*) FROM quota_param_rules')
    const ruleCount = Number(ruleCountResult[0]?.values?.[0]?.[0] ?? 0)

    if (count === 0 || ruleCount === 0) {
      await withTransaction(async () => {
        if (count === 0) {
          // 插入定额条目
          for (const item of SEED_QUOTA_ITEMS) {
            db.run(
              `INSERT OR IGNORE INTO quota_items (id, code, name, base_unit, default_thickness_cm, density, loss_rate, caliber, components_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.id,
                item.code,
                item.name,
                item.baseUnit,
                item.defaultThicknessCm,
                item.density,
                item.lossRate,
                item.caliber,
                JSON.stringify(item.components || []),
              ],
            )
          }
        }

        if (ruleCount === 0) {
          // 插入参数校验规则
          for (const [quotaId, rules] of Object.entries(SEED_PARAM_RULES)) {
            for (const [paramKey, rule] of Object.entries(rules)) {
              db.run(
                `INSERT OR IGNORE INTO quota_param_rules (quota_id, param_key, default_val, min_valid, max_valid, description, warning_msg)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [quotaId, paramKey, rule.defaultVal, rule.minValid, rule.maxValid, rule.desc, rule.warningMsg],
              )
            }
          }
        }
      })

      await saveToStorage()
      console.log('[QuotaLibrary] 种子数据检查与补齐完成')
    }
  },
}
