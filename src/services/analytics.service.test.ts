import { describe, expect, it } from 'vitest'
import {
  buildContractorSummary,
  buildDashboardChartProjects,
  buildDashboardRecentSettlements,
  buildDashboardStats,
  buildInvoiceLedgerSummary,
  buildPaymentLedgerSummary,
  buildPaymentSummary,
  buildProjectSummary,
  buildSettlementReport,
  buildTrendPeriods,
  buildTrendReceipts,
  buildReceivableRows,
  buildTrendSettlements,
  filterInvoices,
  filterReceivePayments,
  type BusinessSnapshot,
} from './analytics.service'
import type { Contract, Invoice, Payment, Project, Settlement } from '@/types'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    code: 'XM-001',
    name: '测试项目',
    projectType: 'highway',
    location: '测试地点',
    ownerUnit: '测试甲方',
    generalContractor: '测试总包',
    startDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '',
    status: 'settling',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    projectId: 1,
    contractNo: 'HT-001-01',
    contractName: '测试合同',
    contractDate: '2026-01-01',
    noTaxAmount: 100.111,
    contractTaxRate: 9,
    taxAmount: 9.009,
    contractAmount: 109.12,
    amountSource: 'auto',
    summary: '',
    ...overrides,
  }
}

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 1,
    projectId: 1,
    contractIds: [1],
    settlementNo: 'JS-001-01',
    settlementType: 'interim',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    previousCumulative: 0,
    currentAmount: 10.111,
    currentCumulative: 10.111,
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
    createdAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  }
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    projectId: 1,
    paymentType: 'receive',
    paymentDate: '2026-01-31',
    amount: 5.555,
    paymentMethod: '转账',
    referenceNo: 'SK001',
    description: '',
    ...overrides,
  }
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    projectId: 1,
    invoiceNo: 'FP001',
    invoiceType: 'special',
    invoiceAmount: 10,
    taxRate: 9,
    taxAmount: 0.9,
    totalAmount: 10.9,
    invoiceDate: '2026-01-31',
    remark: '',
    createdAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<BusinessSnapshot> = {}): BusinessSnapshot {
  return {
    projects: [makeProject()],
    contracts: [makeContract()],
    settlements: [makeSettlement()],
    payments: [makePayment()],
    invoices: [makeInvoice()],
    ...overrides,
  }
}

describe('analytics.service', () => {
  it('buildDashboardStats only counts confirmed and approved settlements', () => {
    const now = new Date()
    const currentMonthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-08T00:00:00.000Z`

    const snapshot = makeSnapshot({
      settlements: [
        makeSettlement({ id: 1, status: 'draft', currentAmount: 1.111, createdAt: currentMonthDate }),
        makeSettlement({ id: 2, status: 'confirmed', currentAmount: 2.222, createdAt: currentMonthDate }),
        makeSettlement({ id: 3, status: 'approved', currentAmount: 3.333, createdAt: currentMonthDate }),
      ],
      payments: [
        makePayment({ id: 1, paymentType: 'receive', amount: 4.444 }),
        makePayment({ id: 2, paymentType: 'pay', amount: 9.999 }),
      ],
    })

    const stats = buildDashboardStats(snapshot)

    expect(stats.totalSettledAmount).toBe(5.555)
    expect(stats.currentMonthSettlement).toBe(5.555)
    expect(stats.totalSettlements).toBe(2)
    expect(stats.totalReceived).toBe(4.444)
    expect(stats.totalUnreceived).toBe(1.111)
  })


  it('buildDashboardChartProjects uses settled amount as base and received amount as progress source', () => {
    const snapshot = makeSnapshot({
      projects: [
        makeProject({ id: 1, name: '项目一' }),
        makeProject({ id: 2, name: '项目二', code: 'XM-002' }),
      ],
      settlements: [
        makeSettlement({ id: 1, projectId: 1, status: 'confirmed', currentAmount: 60 }),
        makeSettlement({ id: 2, projectId: 2, status: 'approved', currentAmount: 80 }),
      ],
      payments: [
        makePayment({ id: 1, projectId: 1, amount: 20 }),
        makePayment({ id: 2, projectId: 2, amount: 50 }),
      ],
      contracts: [],
      invoices: [],
    })

    expect(buildDashboardChartProjects(snapshot)).toEqual([
      { name: '项目一', settledAmount: 60, receivedAmount: 20 },
      { name: '项目二', settledAmount: 80, receivedAmount: 50 },
    ])
  })

  it('buildDashboardRecentSettlements keeps a stable order when createdAt ties', () => {
    const createdAt = '2026-04-10T10:00:00.000Z'
    const snapshot = makeSnapshot({
      settlements: [
        makeSettlement({ id: 1, settlementNo: 'JS-001-01', createdAt }),
        makeSettlement({ id: 3, settlementNo: 'JS-001-03', createdAt }),
        makeSettlement({ id: 2, settlementNo: 'JS-001-02', createdAt }),
      ],
    })

    expect(buildDashboardRecentSettlements(snapshot).map(item => item.settlementNo)).toEqual([
      'JS-001-03',
      'JS-001-02',
      'JS-001-01',
    ])
  })

  it('buildTrendSettlements uses the same settled-status rule', () => {
    const months = ['2026-01', '2026-02']
    const snapshot = makeSnapshot({
      settlements: [
        makeSettlement({ id: 1, status: 'draft', currentAmount: 1.111, createdAt: '2026-01-15T00:00:00.000Z' }),
        makeSettlement({ id: 2, status: 'confirmed', currentAmount: 2.222, createdAt: '2026-01-20T00:00:00.000Z' }),
        makeSettlement({ id: 3, status: 'approved', currentAmount: 3.333, createdAt: '2026-02-05T00:00:00.000Z' }),
      ],
    })

    expect(buildTrendSettlements(snapshot, months)).toEqual([2.222, 3.333])
  })

  it('buildTrendSettlements can aggregate by year', () => {
    const periods = buildTrendPeriods(2, 'year')
    const snapshot = makeSnapshot({
      settlements: [
        makeSettlement({ id: 1, status: 'confirmed', currentAmount: 10, createdAt: `${periods[0]}-03-15T00:00:00.000Z` }),
        makeSettlement({ id: 2, status: 'draft', currentAmount: 99, createdAt: `${periods[1]}-05-20T00:00:00.000Z` }),
        makeSettlement({ id: 3, status: 'approved', currentAmount: 20, createdAt: `${periods[1]}-08-05T00:00:00.000Z` }),
      ],
    })

    expect(buildTrendSettlements(snapshot, periods, 'year')).toEqual([10, 20])
  })

  it('buildTrendReceipts can aggregate by year while ignoring pay records', () => {
    const periods = buildTrendPeriods(2, 'year')
    const snapshot = makeSnapshot({
      payments: [
        makePayment({ id: 1, paymentType: 'receive', amount: 10, paymentDate: `${periods[0]}-01-10` }),
        makePayment({ id: 2, paymentType: 'pay', amount: 99, paymentDate: `${periods[0]}-04-10` }),
        makePayment({ id: 3, paymentType: 'receive', amount: 20, paymentDate: `${periods[1]}-06-18` }),
      ],
    })

    expect(buildTrendReceipts(snapshot, periods, 'year')).toEqual([10, 20])
  })

  it('buildPaymentSummary only aggregates receive payments', () => {
    const snapshot = makeSnapshot({
      settlements: [
        makeSettlement({ id: 1, status: 'confirmed', currentAmount: 10.111 }),
        makeSettlement({ id: 2, status: 'approved', currentAmount: 20.222 }),
      ],
      payments: [
        makePayment({ id: 1, paymentType: 'receive', amount: 5.555 }),
        makePayment({ id: 2, paymentType: 'receive', amount: 6.666 }),
        makePayment({ id: 3, paymentType: 'pay', amount: 99.999 }),
      ],
      invoices: [
        makeInvoice({ id: 1, totalAmount: 7.777 }),
        makeInvoice({ id: 2, totalAmount: 8.888 }),
      ],
    })

    const summary = buildPaymentSummary(snapshot)

    expect(summary.totalSettled).toBe(30.333)
    expect(summary.totalReceived).toBe(12.221)
    expect(summary.totalUnreceived).toBe(18.112)
    expect(summary.totalInvoiced).toBe(16.665)
  })

  it('filters payment ledger by project and date range while excluding pay records', () => {
    const snapshot = makeSnapshot({
      payments: [
        makePayment({ id: 1, projectId: 1, paymentType: 'receive', paymentDate: '2026-01-10', amount: 10 }),
        makePayment({ id: 2, projectId: 1, paymentType: 'receive', paymentDate: '2026-02-15', amount: 20 }),
        makePayment({ id: 3, projectId: 2, paymentType: 'receive', paymentDate: '2026-02-18', amount: 30 }),
        makePayment({ id: 4, projectId: 1, paymentType: 'pay', paymentDate: '2026-02-20', amount: 99 }),
      ],
    })

    const payments = filterReceivePayments(snapshot, {
      projectId: 1,
      dateRange: ['2026-02-01', '2026-02-28'],
    })

    expect(payments).toEqual([
      expect.objectContaining({
        id: 2,
        projectId: 1,
        paymentType: 'receive',
        amount: 20,
      }),
    ])
    expect(buildPaymentLedgerSummary(payments)).toEqual({
      count: 1,
      totalAmount: 20,
    })
  })

  it('filters invoice ledger by date range and keeps tax summaries aligned', () => {
    const snapshot = makeSnapshot({
      invoices: [
        makeInvoice({ id: 1, projectId: 1, invoiceDate: '2026-01-05', invoiceAmount: 10, taxAmount: 0.9, totalAmount: 10.9 }),
        makeInvoice({ id: 2, projectId: 1, invoiceDate: '2026-02-10', invoiceAmount: 20, taxAmount: 1.8, totalAmount: 21.8 }),
        makeInvoice({ id: 3, projectId: 2, invoiceDate: '2026-02-12', invoiceAmount: 30, taxAmount: 2.7, totalAmount: 32.7 }),
      ],
    })

    const invoices = filterInvoices(snapshot, {
      projectId: 1,
      dateRange: ['2026-02-01', '2026-02-28'],
    })

    expect(invoices).toEqual([
      expect.objectContaining({
        id: 2,
        projectId: 1,
        totalAmount: 21.8,
      }),
    ])
    expect(buildInvoiceLedgerSummary(invoices)).toEqual({
      count: 1,
      noTaxAmount: 20,
      taxAmount: 1.8,
      totalAmount: 21.8,
    })
  })

  it('keeps receivable and payment summaries on receive-only logic even when pay records exist', () => {
    const snapshot = makeSnapshot({
      projects: [
        makeProject({ id: 1, name: '项目一' }),
        makeProject({ id: 2, name: '项目二', code: 'XM-002' }),
      ],
      contracts: [
        makeContract({ id: 1, projectId: 1, contractAmount: 100, noTaxAmount: 100, taxAmount: 0 }),
        makeContract({ id: 2, projectId: 2, contractAmount: 200, noTaxAmount: 200, taxAmount: 0 }),
      ],
      settlements: [
        makeSettlement({ id: 1, projectId: 1, status: 'confirmed', currentAmount: 60 }),
        makeSettlement({ id: 2, projectId: 2, status: 'approved', currentAmount: 80 }),
      ],
      payments: [
        makePayment({ id: 1, projectId: 1, paymentType: 'receive', amount: 20 }),
        makePayment({ id: 2, projectId: 1, paymentType: 'pay', amount: 99 }),
        makePayment({ id: 3, projectId: 2, paymentType: 'receive', amount: 30 }),
        makePayment({ id: 4, projectId: 2, paymentType: 'pay', amount: 88 }),
      ],
      invoices: [
        makeInvoice({ id: 1, projectId: 1, totalAmount: 10 }),
        makeInvoice({ id: 2, projectId: 2, totalAmount: 15 }),
      ],
    })

    const projectOneSummary = buildPaymentSummary(snapshot, 1)
    const projectOneReceivable = buildReceivableRows(snapshot, 1)

    expect(projectOneSummary).toMatchObject({
      totalSettled: 60,
      totalReceived: 20,
      totalUnreceived: 40,
      totalInvoiced: 10,
    })

    expect(projectOneReceivable).toEqual([
      expect.objectContaining({
        projectId: 1,
        settledAmount: 60,
        receivedAmount: 20,
        unreceivedAmount: 40,
        invoicedAmount: 10,
        invoiceGap: 50,
      }),
    ])
  })

  it('buildReceivableRows keeps settled, received and invoice gap on the same project row', () => {
    const snapshot = makeSnapshot({
      projects: [
        makeProject({ id: 1, name: '项目一' }),
        makeProject({ id: 2, name: '项目二', code: 'XM-002' }),
      ],
      contracts: [
        makeContract({ id: 1, projectId: 1, noTaxAmount: 100, taxAmount: 0, contractAmount: 100 }),
        makeContract({ id: 2, projectId: 2, noTaxAmount: 200, taxAmount: 0, contractAmount: 200 }),
      ],
      settlements: [
        makeSettlement({ id: 1, projectId: 1, status: 'confirmed', currentAmount: 60 }),
        makeSettlement({ id: 2, projectId: 1, status: 'draft', currentAmount: 10 }),
        makeSettlement({ id: 3, projectId: 2, status: 'approved', currentAmount: 80 }),
      ],
      payments: [
        makePayment({ id: 1, projectId: 1, amount: 50 }),
        makePayment({ id: 2, projectId: 2, amount: 20 }),
      ],
      invoices: [
        makeInvoice({ id: 1, projectId: 1, totalAmount: 30 }),
        makeInvoice({ id: 2, projectId: 2, totalAmount: 10 }),
      ],
    })

    const rows = buildReceivableRows(snapshot)

    expect(rows).toEqual([
      expect.objectContaining({
        projectId: 1,
        settledAmount: 60,
        receivedAmount: 50,
        unreceivedAmount: 10,
        invoicedAmount: 30,
        invoiceGap: 30,
      }),
      expect.objectContaining({
        projectId: 2,
        settledAmount: 80,
        receivedAmount: 20,
        unreceivedAmount: 60,
        invoicedAmount: 10,
        invoiceGap: 70,
      }),
    ])
  })

  it('buildSettlementReport keeps base amount and adjustments aligned on report rows', () => {
    const snapshot = makeSnapshot({
      projects: [makeProject({ id: 1, name: '项目一' })],
      settlements: [
        makeSettlement({
          id: 1,
          projectId: 1,
          settlementNo: 'JS-001-01',
          materialAdjustment: 5,
          changeAmount: 3,
          surchargeAmount: 2,
          deductionAmount: 4,
          currentAmount: 24,
        }),
      ],
    })

    expect(buildSettlementReport(snapshot, 1)).toEqual([
      expect.objectContaining({
        settlementNo: 'JS-001-01',
        projectName: '项目一',
        baseAmount: 18,
        adjustment: 10,
        deductionAmount: 4,
        currentAmount: 24,
      }),
    ])
  })

  it('buildProjectSummary clamps unsettled amount to zero when settled exceeds contract reference', () => {
    const snapshot = makeSnapshot({
      projects: [makeProject({ id: 1, name: '项目一' })],
      contracts: [makeContract({ id: 1, projectId: 1, contractAmount: 100 })],
      settlements: [makeSettlement({ id: 1, projectId: 1, status: 'confirmed', currentAmount: 130 })],
      payments: [],
      invoices: [],
    })

    expect(buildProjectSummary(snapshot)).toEqual([
      expect.objectContaining({
        projectId: 1,
        contractAmount: 100,
        settledAmount: 130,
        unsettledAmount: 0,
        settlementRatio: '130.0',
      }),
    ])
  })

  it('clamps negative receivable gaps to zero when receipts or invoices exceed settled amount', () => {
    const snapshot = makeSnapshot({
      projects: [makeProject({ id: 1, name: '项目一', generalContractor: '总包A' })],
      contracts: [makeContract({ id: 1, projectId: 1, contractAmount: 100 })],
      settlements: [makeSettlement({ id: 1, projectId: 1, status: 'confirmed', currentAmount: 80 })],
      payments: [makePayment({ id: 1, projectId: 1, amount: 120 })],
      invoices: [makeInvoice({ id: 1, projectId: 1, totalAmount: 95 })],
    })

    expect(buildReceivableRows(snapshot)).toEqual([
      expect.objectContaining({
        projectId: 1,
        settledAmount: 80,
        receivedAmount: 120,
        unreceivedAmount: 0,
        invoicedAmount: 95,
        invoiceGap: 0,
      }),
    ])

    expect(buildPaymentSummary(snapshot)).toMatchObject({
      totalSettled: 80,
      totalReceived: 120,
      totalUnreceived: 0,
      totalInvoiced: 95,
    })

    expect(buildContractorSummary(snapshot)).toEqual([
      expect.objectContaining({
        contractorName: '总包A',
        settledAmount: 80,
        receivedAmount: 120,
        unreceivedAmount: 0,
        invoicedAmount: 95,
        invoiceGap: 0,
      }),
    ])
  })

  it('buildContractorSummary aggregates by general contractor', () => {
    const snapshot = makeSnapshot({
      projects: [
        makeProject({ id: 1, code: 'XM-001', ownerUnit: '业主A', generalContractor: '总包A' }),
        makeProject({ id: 2, code: 'XM-002', ownerUnit: '业主B', generalContractor: '总包A', name: '测试项目2' }),
      ],
      contracts: [
        makeContract({ id: 1, projectId: 1, contractAmount: 100.111 }),
        makeContract({ id: 2, projectId: 2, contractAmount: 200.222 }),
      ],
      settlements: [
        makeSettlement({ id: 1, projectId: 1, status: 'confirmed', currentAmount: 10.111 }),
        makeSettlement({ id: 2, projectId: 2, status: 'approved', currentAmount: 20.222 }),
      ],
      payments: [
        makePayment({ id: 1, projectId: 1, amount: 5.555 }),
        makePayment({ id: 2, projectId: 2, amount: 6.666 }),
      ],
      invoices: [
        makeInvoice({ id: 1, projectId: 1, totalAmount: 7.777 }),
        makeInvoice({ id: 2, projectId: 2, totalAmount: 8.888 }),
      ],
    })

    const rows = buildContractorSummary(snapshot)

    expect(rows).toHaveLength(1)
    expect(rows[0].contractorName).toBe('总包A')
    expect(rows[0].projectCount).toBe(2)
    expect(rows[0].contractAmount).toBe(300.333)
    expect(rows[0].settledAmount).toBe(30.333)
    expect(rows[0].receivedAmount).toBe(12.221)
  })
})
