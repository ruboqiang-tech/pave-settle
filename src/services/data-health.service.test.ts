import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database } from 'sql.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

async function bootstrapDataHealthFlow() {
  vi.resetModules()
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

  const dbCore = await import('./db-core')
  const { projectService } = await import('./project.service')
  const { contractService } = await import('./contract.service')
  const { settlementService } = await import('./settlement.service')
  const { scanDataHealth } = await import('./data-health.service')

  const ready = await dbCore.initDatabase()
  expect(ready).toBe(true)

  const db = dbCore.getDb()
  if (!db) throw new Error('Database not initialized')

  clearBusinessTables(db)
  await dbCore.saveToStorage()

  return {
    projectService,
    contractService,
    settlementService,
    scanDataHealth,
  }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('data-health.service', () => {
  it('does not flag draft settlements without detail rows', async () => {
    const {
      projectService,
      contractService,
      settlementService,
      scanDataHealth,
    } = await bootstrapDataHealthFlow()

    const project = await projectService.create({
      code: 'XM-001',
      name: 'data-health-project',
      projectType: 'highway',
      location: 'test-location',
      ownerUnit: 'test-owner',
      generalContractor: 'test-contractor',
      startDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
      actualEndDate: '',
      status: 'settling',
    })
    const contract = await contractService.create({
      projectId: project.id,
      contractNo: 'HT-001-01',
      contractName: 'draft-contract',
      contractDate: '2026-01-01',
      noTaxAmount: 100,
      contractTaxRate: 0,
      taxAmount: 0,
      contractAmount: 100,
      amountSource: 'manual',
      summary: '',
    })

    await settlementService.create({
      projectId: project.id,
      contractIds: [contract.id],
      settlementNo: 'JS-001-01',
      settlementType: 'interim',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      previousCumulative: 0,
      currentAmount: 0,
      currentCumulative: 0,
      materialAdjustment: 0,
      changeAmount: 0,
      deductionAmount: 0,
      surchargeAmount: 0,
      changeRemark: '',
      materialRemark: '',
      surchargeRemark: '',
      deductionRemark: '',
      remark: '',
      status: 'draft',
    })

    const issues = await scanDataHealth()
    expect(issues.find(issue => issue.id === 'settlement_without_details')).toBeUndefined()
  })

  it('flags confirmed settlements without detail rows', async () => {
    const {
      projectService,
      contractService,
      settlementService,
      scanDataHealth,
    } = await bootstrapDataHealthFlow()

    const project = await projectService.create({
      code: 'XM-002',
      name: 'data-health-project-2',
      projectType: 'highway',
      location: 'test-location',
      ownerUnit: 'test-owner',
      generalContractor: 'test-contractor',
      startDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
      actualEndDate: '',
      status: 'settling',
    })
    const contract = await contractService.create({
      projectId: project.id,
      contractNo: 'HT-002-01',
      contractName: 'confirmed-contract',
      contractDate: '2026-01-01',
      noTaxAmount: 100,
      contractTaxRate: 0,
      taxAmount: 0,
      contractAmount: 100,
      amountSource: 'manual',
      summary: '',
    })

    const settlement = await settlementService.create({
      projectId: project.id,
      contractIds: [contract.id],
      settlementNo: 'JS-002-01',
      settlementType: 'interim',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      previousCumulative: 0,
      currentAmount: 0,
      currentCumulative: 0,
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

    const issues = await scanDataHealth()
    const issue = issues.find(item => item.id === 'settlement_without_details')

    expect(issue).toBeTruthy()
    expect(issue?.details).toEqual([
      expect.objectContaining({
        settlementId: settlement.id,
        projectId: project.id,
      }),
    ])
  })
})
