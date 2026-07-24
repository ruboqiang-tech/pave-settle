import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import {
  buildInvoiceLedgerSummary,
  buildPaymentLedgerSummary,
  buildPaymentSummary,
  filterInvoices,
  filterReceivePayments,
} from '@/services/analytics.service'
import {
  deletePaymentListPayment,
  loadPaymentListSnapshot,
  savePaymentListInvoice,
  savePaymentListPayment,
  voidPaymentListInvoice,
} from './payment-list.controller'
import { calcFromNoTaxAmount, calcFromTotalAmount } from '@/utils/tax'
import { getErrorMessage } from '@/utils/error'
import { withLoading } from '../with-loading'
import { buildSaveFileSuccessMessage } from '@/utils/file-download'
import type { Invoice, Payment } from '@/types'
import {
  applyInvoiceAmountResult,
  buildInvoiceTableSummary,
  buildPaymentTableSummary,
  createInvoiceForm,
  createInvoiceFormFromRow,
  createPaymentForm,
  createPaymentFormFromRow,
  emptySnapshot,
  getFilterDateLabel,
  invoiceRules,
  invoiceTypeOptions,
  paymentMethodOptions,
  paymentRules,
  type ActiveDateRange,
  type InvoiceFormState,
  type PaymentFormState,
} from './payment-list.helpers'
import { downloadCsvFile } from '@/utils/csv'
import { getInvoiceTypeLabel, getPaymentMethodLabel } from '@/utils/format'

type InvoiceEditMode = 'no_tax' | 'tax_inclusive'

export function usePaymentList() {
  const snapshot = ref(emptySnapshot)

  const filterProject = ref<number | undefined>(undefined)
  const filterDateRange = ref<ActiveDateRange>(null)

  const showDialog = ref(false)
  const isEdit = ref(false)
  const editId = ref<number | null>(null)
  const saving = ref(false)
  const paymentExporting = ref(false)
  const formRef = ref<FormInstance>()
  const form = ref<PaymentFormState>(createPaymentForm())

  const showInvoiceForm = ref(false)
  const invoiceIsEdit = ref(false)
  const invoiceEditId = ref<number | null>(null)
  const invoiceSaving = ref(false)
  const invoiceExporting = ref(false)
  const invoiceFormRef = ref<FormInstance>()
  const invoiceEditMode = ref<InvoiceEditMode>('no_tax')
  const invoiceForm = ref<InvoiceFormState>(createInvoiceForm())

  const projectOptions = computed(() => snapshot.value.projects)
  const projectNameMap = computed(() => new Map(projectOptions.value.map(project => [project.id, project.name])))
  const ledgerFilters = computed(() => ({
    projectId: filterProject.value,
    dateRange: filterDateRange.value,
  }))

  const filteredPayments = computed(() => filterReceivePayments(snapshot.value, ledgerFilters.value))
  const filteredInvoices = computed(() => filterInvoices(snapshot.value, ledgerFilters.value))

  const projectSummary = computed(() => buildPaymentSummary(snapshot.value, filterProject.value))
  const paymentLedgerSummary = computed(() => buildPaymentLedgerSummary(filteredPayments.value))
  const invoiceLedgerSummary = computed(() => buildInvoiceLedgerSummary(filteredInvoices.value))

  const hasActiveFilters = computed(() =>
    filterProject.value !== undefined
    || (filterDateRange.value !== null && filterDateRange.value.length > 0),
  )
  const currentProjectScopeLabel = computed(() => projectNameMap.value.get(filterProject.value ?? 0) || '全部项目')
  const currentFilterDateLabel = computed(() => getFilterDateLabel(filterDateRange.value))

  const paymentDrawerTitle = computed(() => (isEdit.value ? '编辑收款' : '新增收款'))
  const invoiceDrawerTitle = computed(() => (invoiceIsEdit.value ? '编辑发票' : '新增发票'))

  function onInvoiceAmountChange(value: number | undefined) {
    invoiceEditMode.value = 'no_tax'
    applyInvoiceAmountResult(invoiceForm.value, calcFromNoTaxAmount(value ?? 0, invoiceForm.value.taxRate))
  }

  function onInvoiceTotalAmountChange(value: number | undefined) {
    invoiceEditMode.value = 'tax_inclusive'
    applyInvoiceAmountResult(invoiceForm.value, calcFromTotalAmount(value ?? 0, invoiceForm.value.taxRate))
  }

  function onInvoiceTaxRateChange() {
    if (invoiceEditMode.value === 'tax_inclusive') {
      applyInvoiceAmountResult(invoiceForm.value, calcFromTotalAmount(invoiceForm.value.totalAmount, invoiceForm.value.taxRate))
      return
    }
    applyInvoiceAmountResult(invoiceForm.value, calcFromNoTaxAmount(invoiceForm.value.invoiceAmount, invoiceForm.value.taxRate))
  }

  function getProjectName(projectId: number) {
    return projectNameMap.value.get(projectId) || '-'
  }

  function getPaymentSummary(param: Parameters<typeof buildPaymentTableSummary>[0]) {
    return buildPaymentTableSummary(param)
  }

  function getInvoiceSummary(param: Parameters<typeof buildInvoiceTableSummary>[0]) {
    return buildInvoiceTableSummary(param)
  }

  function resetFilters() {
    filterProject.value = undefined
    filterDateRange.value = null
  }

  function resetPaymentForm() {
    form.value = createPaymentForm(filterProject.value)
    isEdit.value = false
    editId.value = null
    formRef.value?.clearValidate()
  }

  function resetInvoiceForm() {
    invoiceForm.value = createInvoiceForm(filterProject.value)
    invoiceIsEdit.value = false
    invoiceEditId.value = null
    invoiceEditMode.value = 'no_tax'
    invoiceFormRef.value?.clearValidate()
  }

  function openCreate() {
    resetPaymentForm()
    showDialog.value = true
  }

  function openEdit(row: Payment) {
    isEdit.value = true
    editId.value = row.id
    form.value = createPaymentFormFromRow(row)
    showDialog.value = true
  }

  function openInvoiceCreate() {
    resetInvoiceForm()
    showInvoiceForm.value = true
  }

  function openInvoiceEdit(row: Invoice) {
    invoiceIsEdit.value = true
    invoiceEditId.value = row.id
    invoiceForm.value = createInvoiceFormFromRow(row)
    invoiceEditMode.value = 'tax_inclusive'
    showInvoiceForm.value = true
  }

  async function reloadPageData() {
    snapshot.value = await loadPaymentListSnapshot()
  }

  async function handleSave() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    try {
      await withLoading(saving, async () => {
        const result = await savePaymentListPayment(form.value, editId.value)
        snapshot.value = result.snapshot
        ElMessage.success(result.successMessage)
        showDialog.value = false
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '保存失败'))
    }
  }

  async function handleDelete(id: number) {
    try {
      const result = await deletePaymentListPayment(id)
      snapshot.value = result.snapshot
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '删除失败'))
    }
  }

  async function handleInvoiceSave() {
    if (!invoiceFormRef.value) return
    const valid = await invoiceFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
      await withLoading(invoiceSaving, async () => {
        const result = await savePaymentListInvoice(invoiceForm.value, invoiceEditId.value)
        snapshot.value = result.snapshot
        ElMessage.success(result.successMessage)
        showInvoiceForm.value = false
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '保存失败'))
    }
  }

  async function handleInvoiceVoid(id: number) {
    try {
      const result = await voidPaymentListInvoice(id)
      snapshot.value = result.snapshot
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '操作失败'))
    }
  }

  async function handleExportPayments() {
    const rows: (string | number)[][] = [
      ['序号', '项目名称', '收款日期', '收款金额', '收款方式', '凭证号', '备注'],
      ...filteredPayments.value.map((row, i) => [
        i + 1,
        getProjectName(row.projectId),
        row.paymentDate,
        row.amount,
        getPaymentMethodLabel(row.paymentMethod),
        row.referenceNo || '',
        row.description || '',
      ]),
    ]
    const dateStr = new Date().toISOString().slice(0, 10)
    try {
      await withLoading(paymentExporting, async () => {
        const result = await downloadCsvFile(`收款台账_${dateStr}`, rows)
        if (result.canceled) {
          ElMessage.warning('已取消导出')
          return
        }
        ElMessage.success(buildSaveFileSuccessMessage(result))
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出收款台账失败'))
    }
  }

  async function handleExportInvoices() {
    const rows: (string | number)[][] = [
      ['序号', '项目名称', '发票号码', '发票类型', '开票日期', '不含税金额', '税额', '价税合计', '备注'],
      ...filteredInvoices.value.map((row, i) => [
        i + 1,
        getProjectName(row.projectId),
        row.invoiceNo,
        getInvoiceTypeLabel(row.invoiceType),
        row.invoiceDate,
        row.invoiceAmount,
        row.taxAmount,
        row.totalAmount,
        row.remark || '',
      ]),
    ]
    const dateStr = new Date().toISOString().slice(0, 10)
    try {
      await withLoading(invoiceExporting, async () => {
        const result = await downloadCsvFile(`发票台账_${dateStr}`, rows)
        if (result.canceled) {
          ElMessage.warning('已取消导出')
          return
        }
        ElMessage.success(buildSaveFileSuccessMessage(result))
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出发票台账失败'))
    }
  }

  onMounted(() => {
    void reloadPageData()
  })

  return {
    filterProject,
    filterDateRange,
    showDialog,
    saving,
    paymentExporting,
    formRef,
    form,
    showInvoiceForm,
    invoiceSaving,
    invoiceExporting,
    invoiceFormRef,
    invoiceForm,
    paymentMethodOptions,
    invoiceTypeOptions,
    rules: paymentRules,
    invoiceRules,
    projectOptions,
    filteredPayments,
    filteredInvoices,
    projectSummary,
    paymentLedgerSummary,
    invoiceLedgerSummary,
    hasActiveFilters,
    currentProjectScopeLabel,
    currentFilterDateLabel,
    paymentDrawerTitle,
    invoiceDrawerTitle,
    onInvoiceAmountChange,
    onInvoiceTotalAmountChange,
    onInvoiceTaxRateChange,
    getProjectName,
    getPaymentSummary,
    getInvoiceSummary,
    resetFilters,
    resetPaymentForm,
    resetInvoiceForm,
    openCreate,
    openEdit,
    openInvoiceCreate,
    openInvoiceEdit,
    handleSave,
    handleDelete,
    handleInvoiceSave,
    handleInvoiceVoid,
    handleExportPayments,
    handleExportInvoices,
  }
}
