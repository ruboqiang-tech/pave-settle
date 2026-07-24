import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database } from 'sql.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BillOfQuantities, Contract, Project, Settlement, SettlementDetail } from '@/types'

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

async function bootstrapServiceFlow() {
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
  const { contractService, boqService } = await import('./contract.service')
  const { settlementService, settlementDetailService } = await import('./settlement.service')
  const { paymentService } = await import('./payment.service')
  const { invoiceService } = await import('./invoice.service')
  const { contractAttachmentService, settlementAttachmentService } = await import('./attachment.service')
  const analyticsService = await import('./analytics.service')

  const ready = await dbCore.initDatabase()
  expect(ready).toBe(true)

  const db = dbCore.getDb()
  if (!db) {
    throw new Error('Database not initialized')
  }

  clearBusinessTables(db)
  await dbCore.saveToStorage()

  return {
    db,
    dbCore,
    projectService,
    contractService,
    boqService,
    settlementService,
    settlementDetailService,
    paymentService,
    invoiceService,
    contractAttachmentService,
    settlementAttachmentService,
    analyticsService,
  }
}

function makeProject(projectCode: string): Omit<Project, 'id' | 'createdAt'> {
  return {
    code: projectCode,
    name: `测试项目-${projectCode}`,
    projectType: 'highway',
    location: '测试地点',
    ownerUnit: '测试业主',
    generalContractor: '测试总包',
    startDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '',
    status: 'settling',
  }
}

function makeContract(projectId: number, contractNo: string): Omit<Contract, 'id'> {
  return {
    projectId,
    contractNo,
    contractName: `合同-${contractNo}`,
    contractDate: '2026-01-01',
    noTaxAmount: 0,
    contractTaxRate: 9,
    taxAmount: 0,
    contractAmount: 0,
    amountSource: 'manual',
    summary: '',
  }
}

function makeBoqItem(overrides: Partial<BillOfQuantities> = {}): Partial<BillOfQuantities> {
  return {
    itemCode: 'A-01',
    itemName: '水稳基层',
    remark: '桥头搭接',
    unit: 'm2',
    quantity: 100,
    taxRate: 9,
    noTaxUnitPrice: 2,
    unitPrice: 2,
    noTaxTotalPrice: 200,
    taxAmount: 0,
    totalPrice: 200,
    category: 'road',
    chapterCode: '01',
    sortOrder: 1,
    ...overrides,
  }
}

function makeSettlement(
  projectId: number,
  contractIds: number[],
  settlementNo: string,
  startDate: string,
  endDate: string,
  overrides: Partial<Settlement> = {},
): Omit<Settlement, 'id' | 'createdAt'> {
  return {
    projectId,
    contractIds,
    settlementNo,
    settlementType: 'interim',
    startDate,
    endDate,
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
    ...overrides,
  }
}

function makeSettlementDetail(
  settlementId: number,
  boqId: number,
  contractId: number,
  overrides: Partial<SettlementDetail> = {},
): Omit<SettlementDetail, 'id'> {
  return {
    settlementId,
    boqId,
    contractId,
    itemCode: 'A-01',
    itemName: '测试清单项',
    unit: 'm2',
    contractQuantity: 100,
    previousCumulative: 0,
    currentQuantity: 1,
    currentCumulative: 1,
    unitPrice: 2,
    currentAmount: 2,
    ...overrides,
  }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('service flow regressions', () => {
  it('returns persisted ids from create services so follow-up queries can use them directly', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
      paymentService,
      invoiceService,
      contractAttachmentService,
      settlementAttachmentService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-ID'))
    expect(project.id).toBeGreaterThan(0)
    expect(await projectService.getById(project.id)).toMatchObject({
      id: project.id,
      code: 'XM-FLOW-ID',
    })

    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-ID'))
    expect(contract.id).toBeGreaterThan(0)
    expect(await contractService.getById(contract.id)).toMatchObject({
      id: contract.id,
      projectId: project.id,
      contractNo: 'HT-FLOW-ID',
    })

    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'ID-01',
        itemName: '测试清单项',
      }),
    ])
    expect(boqResult.items[0].contractId).toBe(contract.id)

    const settlement = await settlementService.create(
      makeSettlement(project.id, [contract.id], 'JS-FLOW-ID', '2026-01-01', '2026-01-31'),
    )

    expect(settlement.id).toBeGreaterThan(0)
    expect(await settlementService.getById(settlement.id)).toMatchObject({
      id: settlement.id,
      projectId: project.id,
      settlementNo: 'JS-FLOW-ID',
    })


    await settlementDetailService.createBatch([
      {
        settlementId: settlement.id,
        boqId: boqResult.items[0].id,
        contractId: contract.id,
        itemCode: 'ID-01',
        itemName: '测试清单项',
        unit: 'm2',
        contractQuantity: 100,
        previousCumulative: 0,
        currentQuantity: 1,
        currentCumulative: 1,
        unitPrice: 2,
        currentAmount: 2,
      },
    ])
    expect(await settlementDetailService.getBySettlementId(settlement.id)).toHaveLength(1)

    const payment = await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-02-01',
      amount: 2,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-ID',
      description: '测试收款',
    })
    expect(payment.id).toBeGreaterThan(0)
    expect(await paymentService.getById(payment.id)).toMatchObject({
      id: payment.id,
      projectId: project.id,
      referenceNo: 'SK-FLOW-ID',
    })

    const invoice = await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-ID',
      invoiceType: 'special',
      invoiceAmount: 2,
      taxRate: 9,
      taxAmount: 0.18,
      totalAmount: 2.18,
      invoiceDate: '2026-02-05',
      remark: '测试发票',
    })
    expect(invoice.id).toBeGreaterThan(0)
    expect(await invoiceService.getById(invoice.id)).toMatchObject({
      id: invoice.id,
      projectId: project.id,
      invoiceNo: 'FP-FLOW-ID',
    })

    const contractAttachment = await contractAttachmentService.create({
      contractId: contract.id,
      fileName: 'contract.txt',
      fileType: 'text/plain',
      fileSize: 4,
      fileData: btoa('demo'),
    })
    expect(contractAttachment.id).toBeGreaterThan(0)
    expect(await contractAttachmentService.getById(contractAttachment.id)).toMatchObject({
      id: contractAttachment.id,
      contractId: contract.id,
      fileName: 'contract.txt',
    })

    const settlementAttachment = await settlementAttachmentService.create({
      settlementId: settlement.id,
      fileName: 'settlement.txt',
      fileType: 'text/plain',
      fileSize: 4,
      fileData: btoa('demo'),
    })
    expect(settlementAttachment.id).toBeGreaterThan(0)
    expect(await settlementAttachmentService.getById(settlementAttachment.id)).toMatchObject({
      id: settlementAttachment.id,
      settlementId: settlement.id,
      fileName: 'settlement.txt',
    })
  })

  it('updates stored settlement detail snapshots and totals after a boq price change', async () => {
    const {
      db,
      dbCore,
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-01'))
    await contractService.create(makeContract(project.id, 'HT-FLOW-01'))
    await contractService.create(makeContract(project.id, 'HT-FLOW-02'))

    const projectContracts = await contractService.getAllByProjectId(project.id)
    const contractA = projectContracts.find(item => item.contractNo === 'HT-FLOW-01')
    const contractB = projectContracts.find(item => item.contractNo === 'HT-FLOW-02')

    expect(contractA).toBeTruthy()
    expect(contractB).toBeTruthy()

    const contractABoq = await boqService.saveByContractId(contractA!.id, [
      makeBoqItem({
        itemCode: 'A-01',
        itemName: '水稳基层',
        quantity: 100,
        unitPrice: 2,
        totalPrice: 200,
      }),
    ])
    const contractBBoq = await boqService.saveByContractId(contractB!.id, [
      makeBoqItem({
        itemCode: 'B-01',
        itemName: '沥青面层',
        quantity: 50,
        unitPrice: 5,
        noTaxUnitPrice: 5,
        noTaxTotalPrice: 250,
        totalPrice: 250,
      }),
    ])

    await settlementService.create(
      makeSettlement(project.id, [contractA!.id, contractB!.id], 'JS-FLOW-01', '2026-01-01', '2026-01-31'),
    )
    const settlement = (await settlementService.getByProjectId(project.id)).find(
      item => item.settlementNo === 'JS-FLOW-01',
    )
    expect(settlement).toBeTruthy()

    await settlementDetailService.createBatch([
      {
        settlementId: settlement!.id,
        boqId: contractABoq.items[0].id,
        contractId: contractA!.id,
        itemCode: 'A-01',
        itemName: '水稳基层',
        unit: 'm2',
        contractQuantity: 100,
        previousCumulative: 0,
        currentQuantity: 2,
        currentCumulative: 2,
        unitPrice: 2,
        currentAmount: 4,
      },
      {
        settlementId: settlement!.id,
        boqId: contractBBoq.items[0].id,
        contractId: contractB!.id,
        itemCode: 'B-01',
        itemName: '沥青面层',
        unit: 'm2',
        contractQuantity: 50,
        previousCumulative: 0,
        currentQuantity: 4,
        currentCumulative: 4,
        unitPrice: 5,
        currentAmount: 20,
      },
    ])
    await settlementService.recalculateProjectChain(project.id)

    await boqService.saveByContractId(contractA!.id, [
      makeBoqItem({
        id: contractABoq.items[0].id,
        itemCode: 'A-01-N',
        itemName: '水稳基层-调整',
        quantity: 120,
        unitPrice: 3,
        noTaxUnitPrice: 3,
        noTaxTotalPrice: 360,
        totalPrice: 360,
      }),
    ])

    const details = await settlementDetailService.getBySettlementId(settlement!.id)
    const updatedA = details.find(detail => detail.boqId === contractABoq.items[0].id)
    const untouchedB = details.find(detail => detail.boqId === contractBBoq.items[0].id)

    expect(updatedA).toMatchObject({
      contractId: contractA!.id,
      itemCode: 'A-01-N',
      itemName: '水稳基层-调整',
      contractQuantity: 120,
      unitPrice: 3,
      currentAmount: 6,
    })
    expect(untouchedB).toMatchObject({
      contractId: contractB!.id,
      itemCode: 'B-01',
      itemName: '沥青面层',
      contractQuantity: 50,
      unitPrice: 5,
      currentAmount: 20,
    })

    const storedDetailRows = dbCore.execToObjects(
      db.exec(
        `SELECT boq_id, contract_id, item_code, item_name, contract_quantity, unit_price, current_amount
         FROM settlement_details
         WHERE settlement_id = ?
         ORDER BY id`,
        [settlement!.id],
      ),
    )
    const storedA = storedDetailRows.find(row => Number(row.boq_id) === contractABoq.items[0].id)
    const storedB = storedDetailRows.find(row => Number(row.boq_id) === contractBBoq.items[0].id)

    expect(storedA).toMatchObject({
      contract_id: contractA!.id,
      item_code: 'A-01-N',
      item_name: '水稳基层-调整',
      contract_quantity: 120,
      unit_price: 3,
      current_amount: 6,
    })
    expect(storedB).toMatchObject({
      contract_id: contractB!.id,
      item_code: 'B-01',
      item_name: '沥青面层',
      contract_quantity: 50,
      unit_price: 5,
      current_amount: 20,
    })

    const refreshedSettlement = await settlementService.getById(settlement!.id)
    expect(refreshedSettlement).toMatchObject({
      previousCumulative: 0,
      currentAmount: 26,
      currentCumulative: 26,
    })
  })

  it('rewrites linked settlement prices and cumulative amounts when boq unit price changes', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-PRICE'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-PRICE'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'PRICE-01',
        itemName: '单价联动测试',
        quantity: 100,
        taxRate: 9,
        noTaxUnitPrice: 2,
        unitPrice: 2.18,
        noTaxTotalPrice: 200,
        taxAmount: 18,
        totalPrice: 218,
      }),
    ])

    const firstSave = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-PRICE-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'PRICE-01',
          itemName: '单价联动测试',
          currentQuantity: 10,
          currentCumulative: 10,
          unitPrice: 2.18,
          currentAmount: 21.8,
        }),
      ],
    })

    const secondSave = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-PRICE-02', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'PRICE-01',
          itemName: '单价联动测试',
          previousCumulative: 10,
          currentQuantity: 5,
          currentCumulative: 15,
          unitPrice: 2.18,
          currentAmount: 10.9,
        }),
      ],
    })

    await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        id: boqResult.items[0].id,
        itemCode: 'PRICE-01',
        itemName: '单价联动测试',
        quantity: 100,
        taxRate: 9,
        noTaxUnitPrice: 1.83,
        unitPrice: 2,
        noTaxTotalPrice: 183,
        taxAmount: 17,
        totalPrice: 200,
      }),
    ])

    const refreshedContract = await contractService.getById(contract.id)
    const firstSettlement = await settlementService.getById(firstSave.settlement.id)
    const secondSettlement = await settlementService.getById(secondSave.settlement.id)
    const firstDetails = await settlementDetailService.getBySettlementId(firstSave.settlement.id)
    const secondDetails = await settlementDetailService.getBySettlementId(secondSave.settlement.id)

    expect(refreshedContract).toMatchObject({
      contractTaxRate: 9.29,
      contractAmount: 200,
    })
    expect(firstSettlement).toMatchObject({
      previousCumulative: 0,
      currentAmount: 20,
      currentCumulative: 20,
    })
    expect(secondSettlement).toMatchObject({
      previousCumulative: 20,
      currentAmount: 10,
      currentCumulative: 30,
    })
    expect(firstDetails[0]).toMatchObject({
      unitPrice: 2,
      currentAmount: 20,
      previousCumulative: 0,
      currentCumulative: 10,
    })
    expect(secondDetails[0]).toMatchObject({
      unitPrice: 2,
      currentAmount: 10,
      previousCumulative: 10,
      currentCumulative: 15,
    })
  })

  it('keeps dashboard, report and contractor summary aligned after a boq price change', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      paymentService,
      invoiceService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-PRICE-SUMMARY'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-PRICE-SUMMARY'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'PRICE-SUMMARY-01',
        itemName: '改价摘要联动测试',
        quantity: 100,
        taxRate: 9,
        noTaxUnitPrice: 2,
        unitPrice: 2.18,
        noTaxTotalPrice: 200,
        taxAmount: 18,
        totalPrice: 218,
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-PRICE-SUMMARY-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'PRICE-SUMMARY-01',
          itemName: '改价摘要联动测试',
          currentQuantity: 10,
          currentCumulative: 10,
          unitPrice: 2.18,
          currentAmount: 21.8,
        }),
      ],
    })

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-PRICE-SUMMARY-02', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'PRICE-SUMMARY-01',
          itemName: '改价摘要联动测试',
          previousCumulative: 10,
          currentQuantity: 5,
          currentCumulative: 15,
          unitPrice: 2.18,
          currentAmount: 10.9,
        }),
      ],
    })

    await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-03-05',
      amount: 12,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-PRICE-SUMMARY-01',
      description: '改价后摘要联动收款测试',
    })
    await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-PRICE-SUMMARY-01',
      invoiceType: 'special',
      invoiceAmount: 9,
      taxRate: 9,
      taxAmount: 0.81,
      totalAmount: 9.81,
      invoiceDate: '2026-03-06',
      remark: '改价后摘要联动开票测试',
    })

    await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        id: boqResult.items[0].id,
        itemCode: 'PRICE-SUMMARY-01',
        itemName: '改价摘要联动测试',
        quantity: 100,
        taxRate: 9,
        noTaxUnitPrice: 1.83,
        unitPrice: 2,
        noTaxTotalPrice: 183,
        taxAmount: 17,
        totalPrice: 200,
      }),
    ])

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const dashboardStats = analyticsService.buildDashboardStats(snapshot)
    const dashboardActiveProjects = analyticsService.buildDashboardActiveProjects(snapshot)
    const dashboardChartProjects = analyticsService.buildDashboardChartProjects(snapshot)
    const projectSummary = analyticsService.buildProjectSummary(snapshot, project.id)
    const settlementReport = analyticsService.buildSettlementReport(snapshot, project.id)
    const receivableRows = analyticsService.buildReceivableRows(snapshot, project.id)
    const contractorSummary = analyticsService.buildContractorSummary(snapshot)

    expect(dashboardStats).toMatchObject({
      totalContractAmount: 200,
      totalSettledAmount: 30,
      totalSettlements: 2,
      totalReceived: 12,
      totalUnreceived: 18,
      currentMonthSettlement: 30,
    })

    expect(dashboardActiveProjects).toEqual([
      expect.objectContaining({
        id: project.id,
        settledAmount: 30,
        receivedAmount: 12,
        settlementRatio: '15.0',
      }),
    ])

    expect(dashboardChartProjects).toEqual([
      expect.objectContaining({
        name: project.name,
        settledAmount: 30,
        receivedAmount: 12,
      }),
    ])

    expect(projectSummary).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 30,
        unsettledAmount: 170,
        settlementRatio: '15.0',
      }),
    ])

    expect(settlementReport).toEqual([
      expect.objectContaining({
        settlementNo: 'JS-FLOW-PRICE-SUMMARY-01',
        currentAmount: 20,
      }),
      expect.objectContaining({
        settlementNo: 'JS-FLOW-PRICE-SUMMARY-02',
        currentAmount: 10,
      }),
    ])

    expect(receivableRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 30,
        receivedAmount: 12,
        unreceivedAmount: 18,
        invoicedAmount: 9.81,
        invoiceGap: 20.19,
        settleRatio: '15.0',
        receiveRatio: '40.0',
      }),
    ])

    expect(contractorSummary).toEqual([
      expect.objectContaining({
        contractorName: project.generalContractor,
        projectCount: 1,
        contractAmount: 200,
        settledAmount: 30,
        receivedAmount: 12,
        unreceivedAmount: 18,
        invoicedAmount: 9.81,
        invoiceGap: 20.19,
        settlementRatio: '15.0',
        receiveRatio: '40.0',
      }),
    ])
  })

  it('keeps settlement numbers stable when the project code changes and keeps boq remark on both contract and settlement sides', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-LINK-01'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-LINK-01'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'LINK-01',
        itemName: '编号联动测试',
        remark: '初始备注',
      }),
    ])

    const saved = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-LINK-01', '2026-04-01', '2026-04-30'),
      details: [

        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'LINK-01',
          itemName: '编号联动测试',
          remark: '初始备注',
          currentQuantity: 12,
          currentCumulative: 12,
          currentAmount: 24,
        }),
      ],
    })

    const secondSaved = await settlementService.saveWithDetails({
      settlement: makeSettlement(
        project.id,
        [contract.id],
        'JS-FLOW-LINK-02',

        '2026-05-01',
        '2026-05-31',
        {
          previousCumulative: 24,
          currentAmount: 16,
          currentCumulative: 40,
        },
      ),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'LINK-01',
          itemName: '编号联动测试',
          remark: '第二张结算',
          previousCumulative: 24,
          currentQuantity: 8,
          currentCumulative: 32,
          currentAmount: 16,
        }),
      ],
    })

    await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        id: boqResult.items[0].id,
        itemCode: 'LINK-01',
        itemName: '编号联动测试',
        remark: '更新后的备注',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await projectService.update(project.id, {
      code: 'XM-FLOW-LINK-02',
    })

    const refreshedProject = await projectService.getById(project.id)
    const refreshedSettlement = await settlementService.getById(saved.settlement.id)
    const refreshedSecondSettlement = await settlementService.getById(secondSaved.settlement.id)
    const refreshedDetails = await settlementDetailService.getBySettlementId(saved.settlement.id)
    const refreshedBoq = await boqService.getByContractId(contract.id)

    expect(refreshedProject).toMatchObject({
      code: 'XM-FLOW-LINK-02',
    })
    expect(refreshedSettlement).toMatchObject({
      settlementNo: 'JS-FLOW-LINK-01',
    })
    expect(refreshedSecondSettlement).toMatchObject({
      settlementNo: 'JS-FLOW-LINK-02',
    })

    expect(refreshedBoq[0]).toMatchObject({
      remark: '更新后的备注',
    })
    expect(refreshedDetails[0]).toMatchObject({
      remark: '更新后的备注',
    })
  })

  it('rebuilds later cumulative amounts when a confirmed settlement is deleted through the service', async () => {
    const {
      db,
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-02'))
    await contractService.create(makeContract(project.id, 'HT-FLOW-03'))

    const contract = (await contractService.getAllByProjectId(project.id)).find(item => item.contractNo === 'HT-FLOW-03')
    expect(contract).toBeTruthy()

    const boqResult = await boqService.saveByContractId(contract!.id, [
      makeBoqItem({
        itemCode: 'C-01',
        itemName: '透层',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await settlementService.create(
      makeSettlement(project.id, [contract!.id], 'JS-FLOW-02', '2026-01-01', '2026-01-31'),
    )
    const firstSettlement = (await settlementService.getByProjectId(project.id)).find(
      item => item.settlementNo === 'JS-FLOW-02',
    )
    expect(firstSettlement).toBeTruthy()
    await settlementDetailService.createBatch([
      {
        settlementId: firstSettlement!.id,
        boqId: boqResult.items[0].id,
        contractId: contract!.id,
        itemCode: 'C-01',
        itemName: '透层',
        unit: 'm2',
        contractQuantity: 100,
        previousCumulative: 0,
        currentQuantity: 10,
        currentCumulative: 10,
        unitPrice: 2,
        currentAmount: 20,
      },
    ])

    await settlementService.create(
      makeSettlement(project.id, [contract!.id], 'JS-FLOW-03', '2026-02-01', '2026-02-28'),
    )
    const secondSettlement = (await settlementService.getByProjectId(project.id)).find(
      item => item.settlementNo === 'JS-FLOW-03',
    )
    expect(secondSettlement).toBeTruthy()
    await settlementDetailService.createBatch([
      {
        settlementId: secondSettlement!.id,
        boqId: boqResult.items[0].id,
        contractId: contract!.id,
        itemCode: 'C-01',
        itemName: '透层',
        unit: 'm2',
        contractQuantity: 100,
        previousCumulative: 10,
        currentQuantity: 5,
        currentCumulative: 15,
        unitPrice: 2,
        currentAmount: 10,
      },
    ])

    await settlementService.recalculateProjectChain(project.id)
    await settlementService.delete(firstSettlement!.id)

    const deletedDetailRows = db.exec(
      'SELECT id FROM settlement_details WHERE settlement_id = ?',
      [firstSettlement!.id],
    )
    expect(deletedDetailRows[0]?.values ?? []).toHaveLength(0)

    const remainingSettlement = await settlementService.getById(secondSettlement!.id)
    const remainingDetails = await settlementDetailService.getBySettlementId(secondSettlement!.id)

    expect(remainingSettlement).toMatchObject({
      previousCumulative: 0,
      currentAmount: 10,
      currentCumulative: 10,
    })
    expect(remainingDetails[0]).toMatchObject({
      previousCumulative: 0,
      currentQuantity: 5,
      currentCumulative: 5,
      currentAmount: 10,
    })
  })

  it('rebuilds later cumulative amounts when a middle confirmed settlement is deleted', async () => {
    const {
      db,
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-DELETE-MID'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-DELETE-MID'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'DELETE-MID-01',
        itemName: '删除中间结算测试',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const first = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DELETE-MID-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DELETE-MID-01',
          itemName: '删除中间结算测试',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    const middle = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DELETE-MID-02', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DELETE-MID-01',
          itemName: '删除中间结算测试',
          previousCumulative: 10,
          currentQuantity: 3,
          currentCumulative: 13,
          currentAmount: 6,
        }),
      ],
    })

    const last = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DELETE-MID-03', '2026-03-01', '2026-03-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DELETE-MID-01',
          itemName: '删除中间结算测试',
          previousCumulative: 13,
          currentQuantity: 5,
          currentCumulative: 18,
          currentAmount: 10,
        }),
      ],
    })

    await settlementService.delete(middle.settlement.id)

    const deletedDetailRows = db.exec(
      'SELECT id FROM settlement_details WHERE settlement_id = ?',
      [middle.settlement.id],
    )
    const firstSettlement = await settlementService.getById(first.settlement.id)
    const lastSettlement = await settlementService.getById(last.settlement.id)
    const lastDetails = await settlementDetailService.getBySettlementId(last.settlement.id)

    expect(deletedDetailRows[0]?.values ?? []).toHaveLength(0)
    expect(firstSettlement).toMatchObject({
      previousCumulative: 0,
      currentAmount: 20,
      currentCumulative: 20,
    })
    expect(lastSettlement).toMatchObject({
      previousCumulative: 20,
      currentAmount: 10,
      currentCumulative: 30,
    })
    expect(lastDetails[0]).toMatchObject({
      previousCumulative: 10,
      currentQuantity: 5,
      currentCumulative: 15,
      currentAmount: 10,
    })
  })

  it('keeps dashboard, report and contractor summary amounts aligned after deleting a middle settlement', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      paymentService,
      invoiceService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-DELETE-MID-SUMMARY'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-DELETE-MID-SUMMARY'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'DELETE-MID-SUMMARY-01',
        itemName: '删除中间结算摘要联动测试',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const first = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DELETE-MID-SUMMARY-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DELETE-MID-SUMMARY-01',
          itemName: '删除中间结算摘要联动测试',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    const middle = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DELETE-MID-SUMMARY-02', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DELETE-MID-SUMMARY-01',
          itemName: '删除中间结算摘要联动测试',
          previousCumulative: 10,
          currentQuantity: 3,
          currentCumulative: 13,
          currentAmount: 6,
        }),
      ],
    })

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DELETE-MID-SUMMARY-03', '2026-03-01', '2026-03-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DELETE-MID-SUMMARY-01',
          itemName: '删除中间结算摘要联动测试',
          previousCumulative: 13,
          currentQuantity: 5,
          currentCumulative: 18,
          currentAmount: 10,
        }),
      ],
    })

    await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-04-01',
      amount: 12,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-DELETE-MID-SUMMARY-01',
      description: '删除中间结算后的收款口径测试',
    })
    await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-DELETE-MID-SUMMARY-01',
      invoiceType: 'special',
      invoiceAmount: 8,
      taxRate: 9,
      taxAmount: 0.72,
      totalAmount: 8.72,
      invoiceDate: '2026-04-02',
      remark: '删除中间结算后的开票口径测试',
    })

    await settlementService.delete(middle.settlement.id)

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const dashboardStats = analyticsService.buildDashboardStats(snapshot)
    const dashboardActiveProjects = analyticsService.buildDashboardActiveProjects(snapshot)
    const dashboardChartProjects = analyticsService.buildDashboardChartProjects(snapshot)
    const projectSummary = analyticsService.buildProjectSummary(snapshot, project.id)
    const receivableRows = analyticsService.buildReceivableRows(snapshot, project.id)
    const contractorSummary = analyticsService.buildContractorSummary(snapshot)

    expect(dashboardStats).toMatchObject({
      totalSettledAmount: 30,
      totalSettlements: 2,
      totalReceived: 12,
      totalUnreceived: 18,
      currentMonthSettlement: 30,
    })

    expect(dashboardActiveProjects).toEqual([
      expect.objectContaining({
        id: project.id,
        settledAmount: 30,
        receivedAmount: 12,
        settlementRatio: '15.0',
      }),
    ])

    expect(dashboardChartProjects).toEqual([
      expect.objectContaining({
        name: project.name,
        settledAmount: 30,
        receivedAmount: 12,
      }),
    ])

    expect(projectSummary).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 30,
        unsettledAmount: 170,
        settlementRatio: '15.0',
      }),
    ])

    expect(receivableRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 30,
        receivedAmount: 12,
        unreceivedAmount: 18,
        invoicedAmount: 8.72,
        invoiceGap: 21.28,
        settleRatio: '15.0',
        receiveRatio: '40.0',
      }),
    ])

    expect(contractorSummary).toEqual([
      expect.objectContaining({
        contractorName: project.generalContractor,
        projectCount: 1,
        contractAmount: 200,
        settledAmount: 30,
        receivedAmount: 12,
        unreceivedAmount: 18,
        invoicedAmount: 8.72,
        invoiceGap: 21.28,
        settlementRatio: '15.0',
        receiveRatio: '40.0',
      }),
    ])

    expect(snapshot.settlements.map(item => item.id)).toEqual(
      expect.arrayContaining([first.settlement.id]),
    )
    expect(snapshot.settlements).toHaveLength(2)
    expect(snapshot.settlements.find(item => item.id === middle.settlement.id)).toBeUndefined()
  })

  it('inserts a middle settlement through the service and rewrites later cumulative chain values', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-03'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-04'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'MID-01',
        itemName: '中插链路测试',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-04', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'MID-01',
          itemName: '中插链路测试',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-05', '2026-03-01', '2026-03-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'MID-01',
          itemName: '中插链路测试',
          previousCumulative: 10,
          currentQuantity: 5,
          currentCumulative: 15,
          currentAmount: 10,
        }),
      ],
    })

    const middleSave = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-06', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'MID-01',
          itemName: '中插链路测试',
          previousCumulative: 10,
          currentQuantity: 3,
          currentCumulative: 13,
          currentAmount: 6,
        }),
      ],
    })

    const settlements = await settlementService.getByProjectId(project.id)
    const first = settlements.find(item => item.settlementNo === 'JS-FLOW-04')
    const middle = settlements.find(item => item.settlementNo === 'JS-FLOW-06')
    const last = settlements.find(item => item.settlementNo === 'JS-FLOW-05')

    expect(first).toMatchObject({
      previousCumulative: 0,
      currentAmount: 20,
      currentCumulative: 20,
    })
    expect(middle).toMatchObject({
      previousCumulative: 20,
      currentAmount: 6,
      currentCumulative: 26,
    })
    expect(last).toMatchObject({
      previousCumulative: 26,
      currentAmount: 10,
      currentCumulative: 36,
    })

    const middleDetails = await settlementDetailService.getBySettlementId(middleSave.settlement.id)
    const lastDetails = await settlementDetailService.getBySettlementId(last!.id)

    expect(middleDetails[0]).toMatchObject({
      previousCumulative: 10,
      currentQuantity: 3,
      currentCumulative: 13,
      currentAmount: 6,
    })
    expect(lastDetails[0]).toMatchObject({
      previousCumulative: 13,
      currentQuantity: 5,
      currentCumulative: 18,
      currentAmount: 10,
    })
  })

  it('rewinds later confirmed settlements when a middle one is downgraded to draft', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-04'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-05'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'STATUS-01',
        itemName: '状态链路测试',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-07', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'STATUS-01',
          itemName: '状态链路测试',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    const middle = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-08', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'STATUS-01',
          itemName: '状态链路测试',
          previousCumulative: 10,
          currentQuantity: 3,
          currentCumulative: 13,
          currentAmount: 6,
        }),
      ],
    })

    const last = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-09', '2026-03-01', '2026-03-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'STATUS-01',
          itemName: '状态链路测试',
          previousCumulative: 13,
          currentQuantity: 5,
          currentCumulative: 18,
          currentAmount: 10,
        }),
      ],
    })

    const downgraded = await settlementService.updateStatus(middle.settlement.id, 'draft')
    const downgradedDetails = await settlementDetailService.getBySettlementId(middle.settlement.id)
    const lastSettlement = await settlementService.getById(last.settlement.id)
    const lastDetails = await settlementDetailService.getBySettlementId(last.settlement.id)

    expect(downgraded).toMatchObject({
      status: 'draft',
      previousCumulative: 20,
      currentAmount: 6,
      currentCumulative: 26,
    })
    expect(downgradedDetails[0]).toMatchObject({
      previousCumulative: 10,
      currentQuantity: 3,
      currentCumulative: 13,
      currentAmount: 6,
    })
    expect(lastSettlement).toMatchObject({
      previousCumulative: 20,
      currentAmount: 10,
      currentCumulative: 30,
    })
    expect(lastDetails[0]).toMatchObject({
      previousCumulative: 10,
      currentQuantity: 5,
      currentCumulative: 15,
      currentAmount: 10,
    })
  })

  it('rebuilds later chain values and analytics rows after editing an existing confirmed settlement', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create({
      ...makeProject('XM-FLOW-EDIT-01'),
      ownerUnit: 'OWNER-EDIT',
      generalContractor: 'GC-EDIT',
    })
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-EDIT-01'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'EDIT-01',
        itemName: 'Edit chain flow item',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const first = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-EDIT-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'EDIT-01',
          itemName: 'Edit chain flow item',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    const middle = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-EDIT-02', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'EDIT-01',
          itemName: 'Edit chain flow item',
          previousCumulative: 10,
          currentQuantity: 3,
          currentCumulative: 13,
          currentAmount: 6,
        }),
      ],
    })

    const last = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-EDIT-03', '2026-03-01', '2026-03-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'EDIT-01',
          itemName: 'Edit chain flow item',
          previousCumulative: 13,
          currentQuantity: 5,
          currentCumulative: 18,
          currentAmount: 10,
        }),
      ],
    })

    await settlementService.saveWithDetails({
      settlementId: middle.settlement.id,
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-EDIT-02', '2026-02-01', '2026-02-28', {
        materialAdjustment: 4,
        changeAmount: 1,
      }),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'EDIT-01',
          itemName: 'Edit chain flow item',
          previousCumulative: 10,
          currentQuantity: 4,
          currentCumulative: 14,
          currentAmount: 8,
        }),
      ],
    })

    const firstSettlement = await settlementService.getById(first.settlement.id)
    const editedSettlement = await settlementService.getById(middle.settlement.id)
    const lastSettlement = await settlementService.getById(last.settlement.id)
    const editedDetails = await settlementDetailService.getBySettlementId(middle.settlement.id)
    const lastDetails = await settlementDetailService.getBySettlementId(last.settlement.id)

    expect(firstSettlement).toMatchObject({
      previousCumulative: 0,
      currentAmount: 20,
      currentCumulative: 20,
    })
    expect(editedSettlement).toMatchObject({
      previousCumulative: 20,
      currentAmount: 13,
      currentCumulative: 33,
      materialAdjustment: 4,
      changeAmount: 1,
    })
    expect(lastSettlement).toMatchObject({
      previousCumulative: 33,
      currentAmount: 10,
      currentCumulative: 43,
    })
    expect(editedDetails[0]).toMatchObject({
      previousCumulative: 10,
      currentQuantity: 4,
      currentCumulative: 14,
      currentAmount: 8,
    })
    expect(lastDetails[0]).toMatchObject({
      previousCumulative: 14,
      currentQuantity: 5,
      currentCumulative: 19,
      currentAmount: 10,
    })

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const projectSummary = analyticsService.buildProjectSummary(snapshot, project.id)
    const settlementReport = analyticsService.buildSettlementReport(snapshot, project.id)
    const receivableRows = analyticsService.buildReceivableRows(snapshot, project.id)
    const contractorRows = analyticsService.buildContractorSummary(snapshot)

    expect(projectSummary).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 43,
        unsettledAmount: 157,
        settlementRatio: '21.5',
      }),
    ])
    expect(settlementReport).toEqual([
      expect.objectContaining({
        settlementNo: 'JS-FLOW-EDIT-01',
        baseAmount: 20,
        adjustment: 0,
        currentAmount: 20,
      }),
      expect.objectContaining({
        settlementNo: 'JS-FLOW-EDIT-02',
        baseAmount: 8,
        adjustment: 5,
        deductionAmount: 0,
        currentAmount: 13,
      }),
      expect.objectContaining({
        settlementNo: 'JS-FLOW-EDIT-03',
        baseAmount: 10,
        adjustment: 0,
        currentAmount: 10,
      }),
    ])
    expect(receivableRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 43,
        receivedAmount: 0,
        unreceivedAmount: 43,
        invoicedAmount: 0,
        invoiceGap: 43,
        settleRatio: '21.5',
        receiveRatio: '0.0',
      }),
    ])
    expect(contractorRows).toEqual([
      expect.objectContaining({
        contractorName: 'GC-EDIT',
        projectCount: 1,
        contractAmount: 200,
        settledAmount: 43,
        receivedAmount: 0,
        unreceivedAmount: 43,
        invoicedAmount: 0,
        invoiceGap: 43,
        settlementRatio: '21.5',
        receiveRatio: '0.0',
      }),
    ])
  })

  it('keeps receivable analytics aligned after payment and invoice create-update-delete flow', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      paymentService,
      invoiceService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-05'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-06'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'AR-01',
        itemName: '应收链路测试',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-10', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'AR-01',
          itemName: '应收链路测试',
          currentQuantity: 30,
          currentCumulative: 30,
          currentAmount: 60,
        }),
      ],
    })

    const receiveOne = await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-02-01',
      amount: 20,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-01',
      description: '第一次收款',
    })
    const receiveTwo = await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-02-10',
      amount: 5,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-02',
      description: '第二次收款',
    })
    await paymentService.create({
      projectId: project.id,
      paymentType: 'pay',
      paymentDate: '2026-02-15',
      amount: 99,
      paymentMethod: 'transfer',
      referenceNo: 'FK-FLOW-01',
      description: '付款不计入应收',
    })

    const invoiceOne = await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-01',
      invoiceType: 'special',
      invoiceAmount: 10,
      taxRate: 9,
      taxAmount: 0.9,
      totalAmount: 10.9,
      invoiceDate: '2026-02-05',
      remark: '第一次开票',
    })
    const invoiceTwo = await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-02',
      invoiceType: 'special',
      invoiceAmount: 8,
      taxRate: 9,
      taxAmount: 0.72,
      totalAmount: 8.72,
      invoiceDate: '2026-02-20',
      remark: '第二次开票',
    })

    await paymentService.update(receiveTwo.id, { amount: 15 })
    await invoiceService.update(invoiceTwo.id, {
      invoiceAmount: 12,
      taxAmount: 1.08,
      totalAmount: 13.08,
    })
    await paymentService.delete(receiveOne.id)
    await invoiceService.delete(invoiceOne.id)

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const paymentSummary = analyticsService.buildPaymentSummary(snapshot, project.id)
    const receivableRows = analyticsService.buildReceivableRows(snapshot, project.id)

    expect(paymentSummary).toMatchObject({
      totalSettled: 60,
      totalReceived: 15,
      totalUnreceived: 45,
      totalInvoiced: 13.08,
    })

    expect(receivableRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        settledAmount: 60,
        receivedAmount: 15,
        unreceivedAmount: 45,
        invoicedAmount: 13.08,
        invoiceGap: 46.92,
      }),
    ])
  })

  it('aggregates contractor summary strictly by general contractor instead of owner unit', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      paymentService,
      invoiceService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const projectA = await projectService.create({
      ...makeProject('XM-FLOW-GC-01'),
      ownerUnit: '同一业主',
      generalContractor: '总包甲',
    })
    const projectB = await projectService.create({
      ...makeProject('XM-FLOW-GC-02'),
      ownerUnit: '同一业主',
      generalContractor: '总包乙',
    })
    const projectC = await projectService.create({
      ...makeProject('XM-FLOW-GC-03'),
      ownerUnit: '另一业主',
      generalContractor: '总包甲',
    })

    const contractA = await contractService.create(makeContract(projectA.id, 'HT-FLOW-GC-01'))
    const contractB = await contractService.create(makeContract(projectB.id, 'HT-FLOW-GC-02'))
    const contractC = await contractService.create(makeContract(projectC.id, 'HT-FLOW-GC-03'))

    const boqA = await boqService.saveByContractId(contractA.id, [
      makeBoqItem({ itemCode: 'GC-01', itemName: '总包甲项目一', totalPrice: 200, noTaxTotalPrice: 200, unitPrice: 2, noTaxUnitPrice: 2 }),
    ])
    const boqB = await boqService.saveByContractId(contractB.id, [
      makeBoqItem({ itemCode: 'GC-02', itemName: '总包乙项目', totalPrice: 300, noTaxTotalPrice: 300, unitPrice: 3, noTaxUnitPrice: 3 }),
    ])
    const boqC = await boqService.saveByContractId(contractC.id, [
      makeBoqItem({ itemCode: 'GC-03', itemName: '总包甲项目二', totalPrice: 400, noTaxTotalPrice: 400, unitPrice: 4, noTaxUnitPrice: 4 }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(projectA.id, [contractA.id], 'JS-FLOW-GC-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqA.items[0].id, contractA.id, {
          itemCode: 'GC-01',
          itemName: '总包甲项目一',
          currentQuantity: 10,
          currentCumulative: 10,
          unitPrice: 2,
          currentAmount: 20,
        }),
      ],
    })
    await settlementService.saveWithDetails({
      settlement: makeSettlement(projectB.id, [contractB.id], 'JS-FLOW-GC-02', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqB.items[0].id, contractB.id, {
          itemCode: 'GC-02',
          itemName: '总包乙项目',
          currentQuantity: 10,
          currentCumulative: 10,
          unitPrice: 3,
          currentAmount: 30,
        }),
      ],
    })
    await settlementService.saveWithDetails({
      settlement: makeSettlement(projectC.id, [contractC.id], 'JS-FLOW-GC-03', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqC.items[0].id, contractC.id, {
          itemCode: 'GC-03',
          itemName: '总包甲项目二',
          currentQuantity: 10,
          currentCumulative: 10,
          unitPrice: 4,
          currentAmount: 40,
        }),
      ],
    })

    await paymentService.create({
      projectId: projectA.id,
      paymentType: 'receive',
      paymentDate: '2026-02-01',
      amount: 8,
      paymentMethod: 'transfer',
      referenceNo: 'SK-GC-01',
      description: '总包甲收款一',
    })
    await paymentService.create({
      projectId: projectB.id,
      paymentType: 'receive',
      paymentDate: '2026-02-01',
      amount: 12,
      paymentMethod: 'transfer',
      referenceNo: 'SK-GC-02',
      description: '总包乙收款',
    })
    await paymentService.create({
      projectId: projectC.id,
      paymentType: 'receive',
      paymentDate: '2026-02-01',
      amount: 14,
      paymentMethod: 'transfer',
      referenceNo: 'SK-GC-03',
      description: '总包甲收款二',
    })

    await invoiceService.create({
      projectId: projectA.id,
      invoiceNo: 'FP-GC-01',
      invoiceType: 'special',
      invoiceAmount: 5,
      taxRate: 9,
      taxAmount: 0.45,
      totalAmount: 5.45,
      invoiceDate: '2026-02-03',
      remark: '总包甲项目一开票',
    })
    await invoiceService.create({
      projectId: projectB.id,
      invoiceNo: 'FP-GC-02',
      invoiceType: 'special',
      invoiceAmount: 6,
      taxRate: 9,
      taxAmount: 0.54,
      totalAmount: 6.54,
      invoiceDate: '2026-02-03',
      remark: '总包乙开票',
    })
    await invoiceService.create({
      projectId: projectC.id,
      invoiceNo: 'FP-GC-03',
      invoiceType: 'special',
      invoiceAmount: 7,
      taxRate: 9,
      taxAmount: 0.63,
      totalAmount: 7.63,
      invoiceDate: '2026-02-03',
      remark: '总包甲项目二开票',
    })

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const rows = analyticsService.buildContractorSummary(snapshot)

    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.contractorName)).toEqual(['总包甲', '总包乙'])
    expect(rows.find(row => row.contractorName === '同一业主')).toBeUndefined()

    expect(rows.find(row => row.contractorName === '总包甲')).toMatchObject({
      projectCount: 2,
      contractAmount: 600,
      settledAmount: 60,
      receivedAmount: 22,
      unreceivedAmount: 38,
      invoicedAmount: 13.08,
      invoiceGap: 46.92,
    })
    expect(rows.find(row => row.contractorName === '总包乙')).toMatchObject({
      projectCount: 1,
      contractAmount: 300,
      settledAmount: 30,
      receivedAmount: 12,
      unreceivedAmount: 18,
      invoicedAmount: 6.54,
      invoiceGap: 23.46,
    })
  })

  it('keeps report center rows aligned after persisted settlement, payment and invoice changes', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      paymentService,
      invoiceService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-RPT-01'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-RPT-01'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'RPT-01',
        itemName: '报表联动测试',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-RPT-01', '2026-01-01', '2026-01-31', {
        materialAdjustment: 5,
        changeAmount: 3,
        surchargeAmount: 2,
        deductionAmount: 4,
      }),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'RPT-01',
          itemName: '报表联动测试',
          currentQuantity: 10,
          currentCumulative: 10,
          unitPrice: 2,
          currentAmount: 24,
        }),
      ],
    })

    await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-02-01',
      amount: 9,
      paymentMethod: 'transfer',
      referenceNo: 'SK-RPT-01',
      description: '报表收款一',
    })
    await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-02-10',
      amount: 3,
      paymentMethod: 'transfer',
      referenceNo: 'SK-RPT-02',
      description: '报表收款二',
    })
    await paymentService.create({
      projectId: project.id,
      paymentType: 'pay',
      paymentDate: '2026-02-12',
      amount: 99,
      paymentMethod: 'transfer',
      referenceNo: 'FK-RPT-01',
      description: '付款不应进入应收报表',
    })

    await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-RPT-01',
      invoiceType: 'special',
      invoiceAmount: 6,
      taxRate: 9,
      taxAmount: 0.54,
      totalAmount: 6.54,
      invoiceDate: '2026-02-05',
      remark: '报表开票一',
    })
    await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-RPT-02',
      invoiceType: 'special',
      invoiceAmount: 4,
      taxRate: 9,
      taxAmount: 0.36,
      totalAmount: 4.36,
      invoiceDate: '2026-02-20',
      remark: '报表开票二',
    })

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const projectSummary = analyticsService.buildProjectSummary(snapshot, project.id)
    const settlementReport = analyticsService.buildSettlementReport(snapshot, project.id)
    const receivableRows = analyticsService.buildReceivableRows(snapshot, project.id)
    const receivableSummary = analyticsService.buildReceivableSummary(receivableRows)

    expect(projectSummary).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 26,
        unsettledAmount: 174,
        settlementRatio: '13.0',
      }),
    ])

    expect(settlementReport).toEqual([
      expect.objectContaining({
        settlementNo: 'JS-FLOW-RPT-01',
        projectName: project.name,
        baseAmount: 20,
        adjustment: 10,
        deductionAmount: 4,
        currentAmount: 26,
      }),
    ])

    expect(receivableRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 26,
        receivedAmount: 12,
        unreceivedAmount: 14,
        invoicedAmount: 10.9,
        invoiceGap: 15.1,
        settleRatio: '13.0',
        receiveRatio: '46.2',
      }),
    ])

    expect(receivableSummary).toEqual({
      totalSettled: 26,
      totalReceived: 12,
      totalUnreceived: 14,
      totalInvoiced: 10.9,
      receiveRatio: '46.2',
    })
  })

  it('keeps dashboard summary, active project and trend data aligned after editing persisted settlements', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      paymentService,
      analyticsService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-DB-01'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-DB-01'))
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'DB-01',
        itemName: 'Dashboard flow item',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const first = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DB-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DB-01',
          itemName: 'Dashboard flow item',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DB-02', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DB-01',
          itemName: 'Dashboard flow item',
          previousCumulative: 10,
          currentQuantity: 5,
          currentCumulative: 15,
          currentAmount: 10,
        }),
      ],
    })

    await settlementService.saveWithDetails({
      settlementId: first.settlement.id,
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-DB-01', '2026-01-01', '2026-01-31', {
        materialAdjustment: 2,
        changeAmount: 1,
      }),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'DB-01',
          itemName: 'Dashboard flow item',
          currentQuantity: 6,
          currentCumulative: 6,
          currentAmount: 12,
        }),
      ],
    })

    await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: `${currentMonth}-05`,
      amount: 9,
      paymentMethod: 'transfer',
      referenceNo: 'SK-DB-01',
      description: 'Dashboard receive payment',
    })
    await paymentService.create({
      projectId: project.id,
      paymentType: 'pay',
      paymentDate: `${currentMonth}-06`,
      amount: 99,
      paymentMethod: 'transfer',
      referenceNo: 'FK-DB-01',
      description: 'Dashboard pay record should be ignored',
    })

    const snapshot = await analyticsService.loadBusinessSnapshot()
    const stats = analyticsService.buildDashboardStats(snapshot)
    const activeProjects = analyticsService.buildDashboardActiveProjects(snapshot)
    const chartProjects = analyticsService.buildDashboardChartProjects(snapshot)
    const recentSettlements = analyticsService.buildDashboardRecentSettlements(snapshot)
    const periods = analyticsService.buildTrendPeriods(1, 'month')
    const trendSettlements = analyticsService.buildTrendSettlements(snapshot, periods)
    const trendReceipts = analyticsService.buildTrendReceipts(snapshot, periods)

    expect(stats).toMatchObject({
      totalProjects: 1,
      inProgressProjects: 0,
      settlingProjects: 1,
      completedProjects: 0,
      totalContractAmount: 200,
      totalSettledAmount: 25,
      currentMonthSettlement: 25,
      totalSettlements: 2,
      totalReceived: 9,
      totalUnreceived: 16,
    })
    expect(activeProjects).toEqual([
      expect.objectContaining({
        id: project.id,
        settlementRatio: '12.5',
        settledAmount: 25,
        receivedAmount: 9,
      }),
    ])
    expect(chartProjects).toEqual([
      {
        name: project.name,
        settledAmount: 25,
        receivedAmount: 9,
      },
    ])
    expect(recentSettlements).toHaveLength(2)
    expect(recentSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementNo: 'JS-FLOW-DB-02',
          currentAmount: 10,
        }),
        expect.objectContaining({
          settlementNo: 'JS-FLOW-DB-01',
          currentAmount: 15,
        }),
      ]),
    )
    expect(trendSettlements).toEqual([25])
    expect(trendReceipts).toEqual([9])
  })

  it('creates a new settlement from settlement-list seed data and persists the generated details', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()
    const { loadSettlementEditorSnapshot, saveSettlementEditor } = await import('./settlement-editor.service')
    const { buildSettlementSavePayload } = await import('@/views/settlements/settlement-detail.helpers')

    const project = await projectService.create(makeProject('XM-FLOW-CREATE-01'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-CREATE-01'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'CREATE-01',
        itemName: 'Settlement create flow item',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const snapshot = await loadSettlementEditorSnapshot({
      routeContractIds: [contract.id],
      seed: {
        projectId: project.id,
        settlementType: 'final',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
    })

    expect(snapshot).toMatchObject({
      pageTitle: '新建结算单',
      projectName: project.name,
      selectedContractIds: [contract.id],
      detailsLoadedFromFallback: false,
    })
    expect(snapshot?.settlement).toMatchObject({
      id: 0,
      projectId: project.id,
      contractIds: [contract.id],
      settlementType: 'final',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      previousCumulative: 0,
      currentAmount: 0,
      currentCumulative: 0,
      status: 'draft',
    })
    expect(snapshot?.details).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        contractId: contract.id,
        contractName: contract.contractName,
        itemCode: 'CREATE-01',
        itemName: 'Settlement create flow item',
        previousCumulative: 0,
        currentQuantity: 0,
        currentCumulative: 0,
        unitPrice: 2,
        currentAmount: 0,
      }),
    ])

    snapshot!.details[0].currentQuantity = 12
    snapshot!.details[0].currentCumulative = 12
    snapshot!.details[0].currentAmount = 24
    snapshot!.settlement.currentAmount = 24
    snapshot!.settlement.currentCumulative = 24

    const saved = await saveSettlementEditor(
      buildSettlementSavePayload(snapshot!.settlement, snapshot!.details),
    )
    const persistedSettlement = await settlementService.getById(saved.settlement.id)
    const persistedDetails = await settlementDetailService.getBySettlementId(saved.settlement.id)

    expect(saved.settlement.id).toBeGreaterThan(0)
    expect(persistedSettlement).toMatchObject({
      projectId: project.id,
      contractIds: [contract.id],
      settlementType: 'final',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      currentAmount: 24,
      currentCumulative: 24,
      status: 'draft',
    })
    expect(persistedDetails).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        contractId: contract.id,
        itemCode: 'CREATE-01',
        itemName: 'Settlement create flow item',
        previousCumulative: 0,
        currentQuantity: 12,
        currentCumulative: 12,
        unitPrice: 2,
        currentAmount: 24,
      }),
    ])
  })

  it('keeps dashboard, report and contractor summary aligned after creating a confirmed settlement from settlement-list seed data', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      analyticsService,
    } = await bootstrapServiceFlow()
    const { loadSettlementEditorSnapshot, saveSettlementEditor } = await import('./settlement-editor.service')
    const { buildSettlementSavePayload } = await import('@/views/settlements/settlement-detail.helpers')

    const project = await projectService.create(makeProject('XM-FLOW-CREATE-SUMMARY-01'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-CREATE-SUMMARY-01'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'CREATE-SUMMARY-01',
        itemName: 'Settlement create summary item',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const snapshot = await loadSettlementEditorSnapshot({
      routeContractIds: [contract.id],
      seed: {
        projectId: project.id,
        settlementType: 'interim',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
    })

    expect(snapshot).toBeTruthy()
    snapshot!.details[0].currentQuantity = 15
    snapshot!.details[0].currentCumulative = 15
    snapshot!.details[0].currentAmount = 30
    snapshot!.settlement.status = 'confirmed'
    snapshot!.settlement.currentAmount = 30
    snapshot!.settlement.currentCumulative = 30

    const saved = await saveSettlementEditor(
      buildSettlementSavePayload(snapshot!.settlement, snapshot!.details),
    )

    expect(saved.settlement).toMatchObject({
      projectId: project.id,
      contractIds: [contract.id],
      status: 'confirmed',
      currentAmount: 30,
      currentCumulative: 30,
    })

    const persistedDetails = await settlementService.getById(saved.settlement.id)
    expect(persistedDetails).toMatchObject({
      status: 'confirmed',
      currentAmount: 30,
      currentCumulative: 30,
    })

    const businessSnapshot = await analyticsService.loadBusinessSnapshot()
    const dashboardStats = analyticsService.buildDashboardStats(businessSnapshot)
    const dashboardActiveProjects = analyticsService.buildDashboardActiveProjects(businessSnapshot)
    const dashboardChartProjects = analyticsService.buildDashboardChartProjects(businessSnapshot)
    const projectSummary = analyticsService.buildProjectSummary(businessSnapshot, project.id)
    const settlementReport = analyticsService.buildSettlementReport(businessSnapshot, project.id)
    const receivableRows = analyticsService.buildReceivableRows(businessSnapshot, project.id)
    const contractorSummary = analyticsService.buildContractorSummary(businessSnapshot)

    expect(dashboardStats).toMatchObject({
      totalContractAmount: 200,
      totalSettledAmount: 30,
      totalSettlements: 1,
      totalReceived: 0,
      totalUnreceived: 30,
      currentMonthSettlement: 30,
    })
    expect(dashboardActiveProjects).toEqual([
      expect.objectContaining({
        id: project.id,
        settledAmount: 30,
        receivedAmount: 0,
        settlementRatio: '15.0',
      }),
    ])
    expect(dashboardChartProjects).toEqual([
      expect.objectContaining({
        name: project.name,
        settledAmount: 30,
        receivedAmount: 0,
      }),
    ])
    expect(projectSummary).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 30,
        unsettledAmount: 170,
        settlementRatio: '15.0',
      }),
    ])
    expect(settlementReport).toEqual([
      expect.objectContaining({
        settlementNo: saved.settlement.settlementNo,
        projectName: project.name,
        currentAmount: 30,
        status: 'confirmed',
      }),
    ])
    expect(receivableRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        contractAmount: 200,
        settledAmount: 30,
        receivedAmount: 0,
        unreceivedAmount: 30,
        invoicedAmount: 0,
        invoiceGap: 30,
        settleRatio: '15.0',
        receiveRatio: '0.0',
      }),
    ])
    expect(contractorSummary).toEqual([
      expect.objectContaining({
        contractorName: project.generalContractor,
        projectCount: 1,
        contractAmount: 200,
        settledAmount: 30,
        receivedAmount: 0,
        unreceivedAmount: 30,
        invoicedAmount: 0,
        invoiceGap: 30,
        settlementRatio: '15.0',
        receiveRatio: '0.0',
      }),
    ])
    expect(snapshot?.details[0]).toMatchObject({
      boqId: boqResult.items[0].id,
      contractId: contract.id,
    })
  })

  it('rebuilds missing settlement details from fallback and refreshes later chain rows after save', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()
    const { loadSettlementEditorSnapshot, saveSettlementEditor } = await import('./settlement-editor.service')
    const { buildSettlementSavePayload } = await import('@/views/settlements/settlement-detail.helpers')

    const project = await projectService.create(makeProject('XM-FLOW-FALLBACK-01'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-FALLBACK-01'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'FALLBACK-01',
        itemName: 'Fallback restore item',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-FALLBACK-01', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'FALLBACK-01',
          itemName: 'Fallback restore item',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    const brokenSettlement = await settlementService.create(
      makeSettlement(project.id, [contract.id], 'JS-FLOW-FALLBACK-02', '2026-02-01', '2026-02-28', {
        previousCumulative: 20,
        currentAmount: 8,
        currentCumulative: 28,
        status: 'confirmed',
      }),
    )

    const laterSettlement = await settlementService.create(
      makeSettlement(project.id, [contract.id], 'JS-FLOW-FALLBACK-03', '2026-03-01', '2026-03-31', {
        previousCumulative: 28,
        currentAmount: 10,
        currentCumulative: 38,
        status: 'confirmed',
      }),
    )
    await settlementDetailService.createBatch([
      makeSettlementDetail(laterSettlement.id, boqResult.items[0].id, contract.id, {
        itemCode: 'FALLBACK-01',
        itemName: 'Fallback restore item',
        previousCumulative: 14,
        currentQuantity: 5,
        currentCumulative: 19,
        currentAmount: 10,
      }),
    ])

    const snapshot = await loadSettlementEditorSnapshot({
      settlementId: brokenSettlement.id,
      seed: { projectId: project.id },
    })

    expect(snapshot).toMatchObject({
      pageTitle: '编辑结算单',
      projectName: project.name,
      detailsLoadedFromFallback: true,
      selectedContractIds: [contract.id],
    })
    expect(snapshot?.settlement).toMatchObject({
      id: brokenSettlement.id,
      previousCumulative: 20,
      currentAmount: 0,
      currentCumulative: 20,
      status: 'confirmed',
    })
    expect(snapshot?.details).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        contractId: contract.id,
        itemCode: 'FALLBACK-01',
        itemName: 'Fallback restore item',
        previousCumulative: 10,
        currentQuantity: 0,
        currentCumulative: 10,
        currentAmount: 0,
      }),
    ])

    snapshot!.details[0].currentQuantity = 4
    snapshot!.details[0].currentCumulative = 14
    snapshot!.details[0].currentAmount = 8
    snapshot!.settlement.currentAmount = 8
    snapshot!.settlement.currentCumulative = 28

    await saveSettlementEditor(
      buildSettlementSavePayload(snapshot!.settlement, snapshot!.details),
    )

    const repairedSettlement = await settlementService.getById(brokenSettlement.id)
    const repairedDetails = await settlementDetailService.getBySettlementId(brokenSettlement.id)
    const refreshedLaterSettlement = await settlementService.getById(laterSettlement.id)
    const refreshedLaterDetails = await settlementDetailService.getBySettlementId(laterSettlement.id)

    expect(repairedSettlement).toMatchObject({
      previousCumulative: 20,
      currentAmount: 8,
      currentCumulative: 28,
      status: 'confirmed',
    })
    expect(repairedDetails).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        previousCumulative: 10,
        currentQuantity: 4,
        currentCumulative: 14,
        currentAmount: 8,
      }),
    ])
    expect(refreshedLaterSettlement).toMatchObject({
      previousCumulative: 28,
      currentAmount: 10,
      currentCumulative: 38,
    })
    expect(refreshedLaterDetails).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        previousCumulative: 14,
        currentQuantity: 5,
        currentCumulative: 19,
        currentAmount: 10,
      }),
    ])
  })

  it('blocks removing boq rows that are already referenced by settlement details', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
      settlementDetailService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-06'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-07'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'LOCK-01',
        itemName: '已结算清单项',
        quantity: 100,
        unitPrice: 2,
        noTaxUnitPrice: 2,
        noTaxTotalPrice: 200,
        totalPrice: 200,
      }),
    ])

    const saved = await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-11', '2026-01-01', '2026-01-31'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'LOCK-01',
          itemName: '已结算清单项',
          currentQuantity: 10,
          currentCumulative: 10,
          currentAmount: 20,
        }),
      ],
    })

    await expect(boqService.saveByContractId(contract.id, [])).rejects.toThrow('清单项不能为空')


    expect(await boqService.getByContractId(contract.id)).toHaveLength(1)
    expect(await settlementDetailService.getBySettlementId(saved.settlement.id)).toEqual([
      expect.objectContaining({
        boqId: boqResult.items[0].id,
        itemCode: 'LOCK-01',
        itemName: '已结算清单项',
        currentQuantity: 10,
        currentAmount: 20,
      }),
    ])
  })

  it('blocks deleting contracts that are already referenced by settlements', async () => {
    const {
      projectService,
      contractService,
      boqService,
      settlementService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-07'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-08'))
    const boqResult = await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'CONTRACT-01',
        itemName: '合同删除保护测试',
      }),
    ])

    await settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-12', '2026-02-01', '2026-02-28'),
      details: [
        makeSettlementDetail(0, boqResult.items[0].id, contract.id, {
          itemCode: 'CONTRACT-01',
          itemName: '合同删除保护测试',
          currentQuantity: 5,
          currentCumulative: 5,
          currentAmount: 10,
        }),
      ],
    })

    await expect(contractService.delete(contract.id)).rejects.toThrow('请先处理相关结算记录后再删除合同')
    expect(await contractService.getById(contract.id)).toMatchObject({
      id: contract.id,
      contractNo: 'HT-FLOW-08',
    })
    expect(await boqService.getByContractId(contract.id)).toHaveLength(1)
  })

  it('deletes clean contracts together with their boq rows and attachments', async () => {
    const {
      db,
      projectService,
      contractService,
      boqService,
      contractAttachmentService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-08'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-09'))

    await boqService.saveByContractId(contract.id, [
      makeBoqItem({
        itemCode: 'DELETE-01',
        itemName: '可删除清单项',
      }),
    ])
    db.run(
      `INSERT INTO contract_attachments (contract_id, file_name, file_type, file_size, file_data)
       VALUES (?, ?, ?, ?, ?)`,
      [contract.id, 'delete-me.txt', 'text/plain', 4, 'ZGVtbw=='],
    )


    await contractService.delete(contract.id)

    expect(await contractService.getById(contract.id)).toBeNull()
    expect(await boqService.getByContractId(contract.id)).toHaveLength(0)
    expect(await contractAttachmentService.getByContractId(contract.id)).toHaveLength(0)
  })

  it('deletes project attachment rows together with related contract and settlement data', async () => {

    const {
      db,
      projectService,
      contractService,
      settlementService,
      contractAttachmentService,
      settlementAttachmentService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-11'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-12'))
    const settlement = await settlementService.create(makeSettlement(
      project.id,
      [contract.id],
      'JS-FLOW-15',
      '2026-06-01',
      '2026-06-30',
      { status: 'draft' },
    ))

    db.run(
      `INSERT INTO contract_attachments (contract_id, file_name, file_type, file_size, file_data)
       VALUES (?, ?, ?, ?, ?)`,
      [contract.id, 'contract-inline.txt', 'text/plain', 4, 'ZGVtbw=='],
    )
    db.run(
      `INSERT INTO settlement_attachments (settlement_id, file_name, file_type, file_size, file_data)
       VALUES (?, ?, ?, ?, ?)`,
      [settlement.id, 'settlement-inline.txt', 'text/plain', 4, 'ZGVtbw=='],
    )


    await projectService.delete(project.id)

    expect(await projectService.getById(project.id)).toBeNull()
    expect(await contractAttachmentService.getByContractId(contract.id)).toHaveLength(0)
    expect(await settlementAttachmentService.getBySettlementId(settlement.id)).toHaveLength(0)
  })

  it('rejects saving confirmed settlements without detail rows', async () => {
    const {
      projectService,
      contractService,
      settlementService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-09'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-10'))

    await expect(settlementService.saveWithDetails({
      settlement: makeSettlement(project.id, [contract.id], 'JS-FLOW-13', '2026-04-01', '2026-04-30'),
      details: [],
    })).rejects.toThrow('必须至少包含一条结算明细')
  })

  it('rejects confirming an existing detail-less settlement through status update', async () => {
    const {
      projectService,
      contractService,
      settlementService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-10'))
    const contract = await contractService.create(makeContract(project.id, 'HT-FLOW-11'))
    const draftSettlement = await settlementService.create(makeSettlement(
      project.id,
      [contract.id],
      'JS-FLOW-14',
      '2026-05-01',
      '2026-05-31',
      { status: 'draft' },
    ))

    await expect(settlementService.updateStatus(draftSettlement.id, 'confirmed')).rejects.toThrow('必须至少包含一条结算明细')
    expect(await settlementService.getById(draftSettlement.id)).toMatchObject({
      id: draftSettlement.id,
      status: 'draft',
    })
  })

  it('validates payment payloads and refuses operations on missing payment records', async () => {
    const {
      projectService,
      paymentService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-12'))

    await expect(paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-07-01',
      amount: 0,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-INVALID',
      description: '无效收款',
    })).rejects.toThrow('收付款金额必须大于 0')

    const payment = await paymentService.create({
      projectId: project.id,
      paymentType: 'receive',
      paymentDate: '2026-07-02',
      amount: 10,
      paymentMethod: 'transfer',
      referenceNo: 'SK-FLOW-VALID',
      description: '有效收款',
    })

    await expect(paymentService.update(payment.id, { amount: 0 })).rejects.toThrow('收付款金额必须大于 0')

    await paymentService.delete(payment.id)
    await expect(paymentService.delete(payment.id)).rejects.toThrow('收付款记录不存在')
  })

  it('validates invoice payload consistency and refuses operations on missing invoice records', async () => {
    const {
      projectService,
      invoiceService,
    } = await bootstrapServiceFlow()

    const project = await projectService.create(makeProject('XM-FLOW-13'))

    await expect(invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-INVALID',
      invoiceType: 'special',
      invoiceAmount: 10,
      taxRate: 9,
      taxAmount: 0.9,
      totalAmount: 99,
      invoiceDate: '2026-07-05',
      remark: '无效发票',
    })).rejects.toThrow('发票金额、税额与价税合计不一致')

    const invoice = await invoiceService.create({
      projectId: project.id,
      invoiceNo: 'FP-FLOW-VALID',
      invoiceType: 'special',
      invoiceAmount: 10,
      taxRate: 9,
      taxAmount: 0.9,
      totalAmount: 10.9,
      invoiceDate: '2026-07-06',
      remark: '有效发票',
    })

    await expect(invoiceService.update(invoice.id, { totalAmount: 10.5 })).rejects.toThrow('发票金额、税额与价税合计不一致')

    await invoiceService.delete(invoice.id)
    await expect(invoiceService.delete(invoice.id)).rejects.toThrow('发票记录不存在')
  })
})
