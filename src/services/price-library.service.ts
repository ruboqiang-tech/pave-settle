/**
 * 价格库持久化服务。
 * 管理 price_resources、price_quotes、selected_quotes 三张表的 CRUD。
 */
import {
  execToObjects,
  getGlobalDb as getDb,
  getRowNumber,
  getRowString,
  saveGlobalToStorage as saveToStorage,
  withGlobalTransaction as withTransaction,
} from './db-core'
import type { PriceQuote, PriceResourceItem, PriceResourceCategory } from '@/types/price-library.types'
import {
  SEED_RESOURCE_ITEMS,
  SEED_QUOTES,
  SEED_SELECTED_QUOTES,
} from './seed-data'

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

function mapResourceRow(row: Record<string, unknown>): Omit<PriceResourceItem, 'quotes'> {
  return {
    id: getRowString(row, 'id'),
    category: getRowString(row, 'category', 'material') as PriceResourceCategory,
    name: getRowString(row, 'name'),
    spec: getRowString(row, 'spec'),
    unit: getRowString(row, 'unit'),
  }
}

function mapQuoteRow(row: Record<string, unknown>): PriceQuote & { resourceId: string } {
  return {
    id: getRowString(row, 'id'),
    resourceId: getRowString(row, 'resource_id'),
    supplier: getRowString(row, 'supplier'),
    price: getRowNumber(row, 'price'),
    taxCaliber: getRowString(row, 'tax_caliber'),
    deliveryPoint: getRowString(row, 'delivery_point'),
    collectedAt: getRowString(row, 'collected_at'),
    remark: getRowString(row, 'remark'),
  }
}

function assertDb() {
  const db = getDb()
  if (!db) throw new Error('Database not initialized')
  return db
}

// ---------------------------------------------------------------------------
// Exported service
// ---------------------------------------------------------------------------

export const priceLibraryService = {
  /**
   * 加载所有价格资源（含子报价列表）。
   */
  async listResources(): Promise<PriceResourceItem[]> {
    const db = getDb()
    if (!db) return []

    const resourceRows = execToObjects(
      db.exec('SELECT * FROM price_resources ORDER BY category, id'),
    ).map(mapResourceRow)

    const quoteRows = execToObjects(
      db.exec('SELECT * FROM price_quotes ORDER BY resource_id, collected_at DESC, id'),
    ).map(mapQuoteRow)

    // 按 resourceId 分组
    const quotesByResource = new Map<string, PriceQuote[]>()
    for (const q of quoteRows) {
      const { resourceId, ...quote } = q
      if (!quotesByResource.has(resourceId)) {
        quotesByResource.set(resourceId, [])
      }
      quotesByResource.get(resourceId)!.push(quote)
    }

    return resourceRows.map(r => ({
      ...r,
      quotes: quotesByResource.get(r.id) ?? [],
    }))
  },

  /**
   * 新增一个价格资源要素（不含报价，报价需单独添加）。
   */
  async createResource(item: Omit<PriceResourceItem, 'quotes'>): Promise<void> {
    const db = assertDb()
    db.run(
      'INSERT INTO price_resources (id, category, name, spec, unit) VALUES (?, ?, ?, ?, ?)',
      [item.id, item.category, item.name, item.spec, item.unit],
    )
    await saveToStorage()
  },

  /**
   * 更新价格资源要素的基础信息。
   */
  async updateResource(item: Omit<PriceResourceItem, 'quotes'>): Promise<void> {
    const db = assertDb()
    db.run(
      'UPDATE price_resources SET category = ?, name = ?, spec = ?, unit = ? WHERE id = ?',
      [item.category, item.name, item.spec, item.unit, item.id],
    )
    await saveToStorage()
  },

  /**
   * 删除一个价格资源要素（级联删除其报价和选中映射）。
   */
  async deleteResource(id: string): Promise<void> {
    const db = assertDb()
    await withTransaction(async () => {
      db.run('DELETE FROM selected_quotes WHERE resource_id = ?', [id])
      db.run('DELETE FROM price_quotes WHERE resource_id = ?', [id])
      db.run('DELETE FROM price_resources WHERE id = ?', [id])
    })
    await saveToStorage()
  },

  // -----------------------------------------------------------------------
  // 报价 CRUD
  // -----------------------------------------------------------------------

  /**
   * 添加一条报价。
   */
  async addQuote(resourceId: string, quote: PriceQuote): Promise<void> {
    const db = assertDb()
    db.run(
      `INSERT INTO price_quotes (id, resource_id, supplier, price, tax_caliber, delivery_point, collected_at, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quote.id,
        resourceId,
        quote.supplier,
        quote.price,
        quote.taxCaliber,
        quote.deliveryPoint,
        quote.collectedAt,
        quote.remark ?? '',
      ],
    )
    await saveToStorage()
  },

  /**
   * 更新一条报价。
   */
  async updateQuote(quote: PriceQuote): Promise<void> {
    const db = assertDb()
    db.run(
      `UPDATE price_quotes SET supplier = ?, price = ?, tax_caliber = ?, delivery_point = ?, collected_at = ?, remark = ?
       WHERE id = ?`,
      [
        quote.supplier,
        quote.price,
        quote.taxCaliber,
        quote.deliveryPoint,
        quote.collectedAt,
        quote.remark ?? '',
        quote.id,
      ],
    )
    await saveToStorage()
  },

  /**
   * 删除一条报价。
   */
  async deleteQuote(quoteId: string): Promise<void> {
    const db = assertDb()
    // 如果删除的报价正好是选中报价，也一并清理
    db.run('DELETE FROM selected_quotes WHERE quote_id = ?', [quoteId])
    db.run('DELETE FROM price_quotes WHERE id = ?', [quoteId])
    await saveToStorage()
  },

  // -----------------------------------------------------------------------
  // 选中报价
  // -----------------------------------------------------------------------

  /**
   * 获取全局选中报价映射。
   */
  async getSelectedQuotes(): Promise<Record<string, string>> {
    const db = getDb()
    if (!db) return {}

    const rows = execToObjects(db.exec('SELECT * FROM selected_quotes'))
    const result: Record<string, string> = {}
    for (const row of rows) {
      result[getRowString(row, 'resource_id')] = getRowString(row, 'quote_id')
    }
    return result
  },

  /**
   * 设置某个资源的选中报价。
   */
  async setSelectedQuote(resourceId: string, quoteId: string): Promise<void> {
    const db = assertDb()
    db.run(
      'INSERT OR REPLACE INTO selected_quotes (resource_id, quote_id) VALUES (?, ?)',
      [resourceId, quoteId],
    )
    await saveToStorage()
  },

  // -----------------------------------------------------------------------
  // 种子数据
  // -----------------------------------------------------------------------

  /**
   * 灌入默认种子数据，并为已有老库补齐后续新增的默认要素。
   */
  async seedIfEmpty(): Promise<void> {
    const db = getDb()
    if (!db) return

    await withTransaction(async () => {
      for (const item of SEED_RESOURCE_ITEMS) {
        db.run(
          'INSERT OR IGNORE INTO price_resources (id, category, name, spec, unit) VALUES (?, ?, ?, ?, ?)',
          [item.id, item.category, item.name, item.spec, item.unit],
        )
      }

      for (const q of SEED_QUOTES) {
        db.run(
          `INSERT OR IGNORE INTO price_quotes (id, resource_id, supplier, price, tax_caliber, delivery_point, collected_at, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.id, q.resourceId, q.supplier, q.price, q.taxCaliber, q.deliveryPoint, q.collectedAt, q.remark],
        )
      }

      for (const [resourceId, quoteId] of Object.entries(SEED_SELECTED_QUOTES)) {
        db.run(
          'INSERT OR IGNORE INTO selected_quotes (resource_id, quote_id) VALUES (?, ?)',
          [resourceId, quoteId],
        )
      }
    })

    await saveToStorage()
    console.log('[PriceLibrary] 默认价格库数据已校验')
  },
}
