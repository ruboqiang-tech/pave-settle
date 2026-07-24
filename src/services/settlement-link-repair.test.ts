import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database } from 'sql.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, initDatabase, saveToStorage } from './db-core'
import { boqService, contractService } from './contract.service'
import { projectService } from './project.service'
import { settlementDetailService, settlementService } from './settlement.service'
import {
  findBestMatchingBoqForSettlementDetail,
  repairLegacySettlementDetailLinks,
  scanLegacySettlementDetailLinkIssues,
  type SettlementDetailLinkBoqSnapshot,
} from './settlement-link-repair.service'

const wasmBinary = Uint8Array.from(
  readFileSync(resolve(process.cwd(), 'public', 'sql-wasm-browser.wasm')),
)

function clearBusinessTables(db: Database) {
  db.run('BEGIN TRANSACTION')
  try {
    db.run('DELETE FROM settlement_details')
    db.run('DELETE FROM settlement_attachments')
    db.run('DELETE FROM settlements')
    db.run('DELETE FROM bill_of_quantities')
    db.run('DELETE FROM contract_attachments')
    db.run('DELETE FROM contracts')
    db.run('DELETE FROM payments')
    db.run('DELETE FROM invoices')
    db.run('DELETE FROM projects')
    db.run('DELETE FROM sqlite_sequence')
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

async function bootstrapRepairFlow() {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('sql-wasm-browser.wasm')) {
        return new Response(wasmBinary, { status: 200 })
      }

      return new Response(null, { status: 404 })
    }),
  )

  const ready = await initDatabase()
  expect(ready).toBe(true)

  const db = getDb()
  if (!db) {
    throw new Error('Database not initialized')
  }

  clearBusinessTables(db)
  await saveToStorage()

  return {
    db,
    projectService,
    contractService,
    boqService,
    settlementService,
    settlementDetailService,
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const boqs: SettlementDetailLinkBoqSnapshot[] = [
  { id: 101, contractId: 1, itemCode: 'A-01', itemName: 'shared-boq-1', unit: 'm2', quantity: 100, unitPrice: 2 },
  { id: 102, contractId: 1, itemCode: 'A-02', itemName: 'contract-1-boq-2', unit: 'm2', quantity: 100, unitPrice: 3 },
  { id: 201, contractId: 2, itemCode: 'A-01', itemName: 'shared-boq-1', unit: 'm2', quantity: 100, unitPrice: 5 },
  { id: 202, contractId: 2, itemCode: '', itemName: 'contract-2-boq-2', unit: 'm2', quantity: 50, unitPrice: 1.5 },
]

describe('settlement link repair matching', () => {
  it('matches by item code within the same contract scope', () => {
    const matched = findBestMatchingBoqForSettlementDetail(
      {
        contractId: 1,
        settlementContractIds: [1, 2],
        itemCode: 'A-01',
        itemName: 'old-name',
        unit: 'm2',
        contractQuantity: 100,
      },
      boqs,
    )

    expect(matched?.id).toBe(101)
  })

  it('matches by item name and unit when item code is missing', () => {
    const matched = findBestMatchingBoqForSettlementDetail(
      {
        contractId: 2,
        settlementContractIds: [2],
        itemCode: '',
        itemName: 'contract-2-boq-2',
        unit: 'm2',
        contractQuantity: 50,
      },
      boqs,
    )

    expect(matched?.id).toBe(202)
  })

  it('falls back to settlement contract ids when detail contract id is missing', () => {
    const matched = findBestMatchingBoqForSettlementDetail(
      {
        contractId: 0,
        settlementContractIds: [2],
        itemCode: 'A-01',
        itemName: 'shared-boq-1',
        unit: 'm2',
        contractQuantity: 100,
      },
      boqs,
    )

    expect(matched?.id).toBe(201)
  })

  it('returns null when multiple candidates remain ambiguous', () => {
    const matched = findBestMatchingBoqForSettlementDetail(
      {
        contractId: 0,
        settlementContractIds: [1, 2],
        itemCode: 'A-01',
        itemName: 'shared-boq-1',
        unit: 'm2',
        contractQuantity: 100,
      },
      boqs,
    )

    expect(matched).toBeNull()
  })

  it('repairs orphan detail links with the same amount precision as chain calculations', async () => {
    const {
      db,
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapRepairFlow()

    const project = await projectService.create({
      code: 'XM-001',

      name: 'repair-project',
      projectType: 'highway',
      location: 'repair-location',
      ownerUnit: 'repair-owner',
      generalContractor: 'repair-contractor',
      startDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
      actualEndDate: '',
      status: 'settling',
    })
    const contract = await contractService.create({
      projectId: project.id,
      contractNo: 'HT-001-01',

      contractName: 'repair-contract',
      contractDate: '2026-01-01',
      noTaxAmount: 2.345,
      contractTaxRate: 0,
      taxAmount: 0,
      contractAmount: 2.345,
      amountSource: 'manual',
      summary: '',
    })

    const boqResult = await boqService.saveByContractId(contract.id, [{
      itemCode: 'RP-01',
      itemName: 'repair-test-boq',
      remark: 'repair-before-remark',
      unit: 'm2',
      quantity: 1,
      taxRate: 0,
      noTaxUnitPrice: 2.345,
      unitPrice: 2.345,
      noTaxTotalPrice: 2.345,
      taxAmount: 0,
      totalPrice: 2.345,
      category: '',
      chapterCode: '',
      sortOrder: 1,
    }])

    const savedSettlement = await settlementService.create({
      projectId: project.id,
      contractIds: [contract.id],
      settlementNo: 'JS-001-01',

      settlementType: 'interim',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      previousCumulative: 0,
      currentAmount: 2.35,
      currentCumulative: 2.35,
      materialAdjustment: 0,
      changeAmount: 0,
      deductionAmount: 0,
      surchargeAmount: 0,
      changeRemark: '',
      materialRemark: '',
      surchargeRemark: '',
      deductionRemark: '',
      remark: '',
      status: 'confirmed',
    })

    db.run('PRAGMA foreign_keys = OFF;')
    db.run(
      `INSERT INTO settlement_details (settlement_id, boq_id, contract_id, item_code, item_name, remark, unit, contract_quantity, previous_cumulative, current_quantity, current_cumulative, unit_price, current_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        savedSettlement.id,
        9999,
        contract.id,
        'RP-01',
        'repair-test-boq',
        'repair-before-note',
        'm2',
        1,
        0,
        1,
        1,
        2.35,
        2.35,
      ],
    )
    db.run('PRAGMA foreign_keys = ON;')
    await saveToStorage()

    expect(savedSettlement.currentAmount).toBe(2.35)
    expect((await scanLegacySettlementDetailLinkIssues())).toHaveLength(1)

    const repairResult = await repairLegacySettlementDetailLinks()
    expect(repairResult).toEqual({
      scannedCount: 1,
      repairedCount: 1,
      unresolvedCount: 0,
    })

    const refreshedSettlement = await settlementService.getById(savedSettlement.id)
    const storedDetails = await settlementDetailService.getStoredBySettlementId(savedSettlement.id)
    const displayDetails = await settlementDetailService.getBySettlementId(savedSettlement.id)

    expect(refreshedSettlement).toMatchObject({
      currentAmount: 2.345,
      currentCumulative: 2.345,
    })
    expect(storedDetails).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        currentAmount: 2.345,
      }),
    ])
    expect(displayDetails).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        currentAmount: 2.345,
      }),
    ])
  })
})
