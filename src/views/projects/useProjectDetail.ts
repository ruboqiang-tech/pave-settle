import { computed, reactive, ref, watch } from 'vue'
import { systemSettingsService } from '@/services/system-settings.service'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, UploadFile, UploadInstance } from 'element-plus'
import {
  createProjectDetailContract,
  deleteProjectDetailContract,
  downloadProjectDetailBoqTemplate,
  exportProjectDetailBoq,
  getProjectDetailListRoute,
  getProjectDetailSettlementRoute,
  importProjectDetailBoq,
  loadProjectDetailAttachmentCount,
  loadProjectDetailPage,
  projectDetailAttachmentAdapter,
  saveProjectDetailBasics,
  saveProjectDetailContract,
} from './project-detail.controller'
import { formatAmount } from '@/utils/calculations'
import { taxRateOptions } from '@/utils/format'
import { getErrorMessage } from '@/utils/error'
import { withLoading } from '../with-loading'
import {
  BASIC_BOQ_IMPORT_HEADERS,
  createEmptyBoqRow,
  recalculateBoqFromNoTaxPrice,
  recalculateBoqFromQuantity,
  recalculateBoqFromUnitPrice,
  recalculateBoqRow,
  summarizeBoqAmounts,
} from '@/utils/boq'
import { getNextContractNo } from '@/utils/numbering'
import type { BillOfQuantities, Contract, Project, Settlement } from '@/types'
import {
  buildBoqSummary,
  buildSettlementSummary,
  contractRules,
  createContractEditForm,
  createProjectEditForm,
  summarizeContractAmounts,
  type EditableBoqItem,
  type ProjectEditForm,
} from './project-detail.helpers'

function clearRecord<T>(record: Record<number, T>) {
  for (const key of Object.keys(record)) {
    delete record[Number(key)]
  }
}

async function withContractSaving<T>(savingId: { value: number | null }, contractId: number, task: () => Promise<T>): Promise<T> {
  savingId.value = contractId
  try {
    return await task()
  } finally {
    savingId.value = null
  }
}

export function useProjectDetail() {
  const route = useRoute()
  const router = useRouter()
  const pid = computed(() => Number(route.params.id))

  const project = ref<Project | null>(null)
  const contracts = ref<Contract[]>([])
  const settlements = ref<Settlement[]>([])
  const boqMap = reactive<Record<number, EditableBoqItem[]>>({})
  const editForms = reactive<Record<number, ReturnType<typeof createContractEditForm>>>({})
  const formRefs = reactive<Record<number, FormInstance>>({})
  const expandedIds = reactive(new Set<number>())
  const savingId = ref<number | null>(null)
  const showEditDialog = ref(false)
  const editForm = ref<ProjectEditForm>(createProjectEditForm(null))
  const nextContractNo = ref('')

  const showNewContract = ref(false)
  const newSaving = ref(false)
  const newForm = ref(createContractEditForm())
  const newFormRef = ref<FormInstance>()
  const newBoqRows = reactive<EditableBoqItem[]>([])

  const showAttachDrawer = ref(false)
  const attachDrawerContractId = ref<number | null>(null)
  const attachCounts = reactive<Record<number, number>>({})

  const showImportDialog = ref(false)
  const importContractId = ref<number | null>(null)
  const importFile = ref<File | null>(null)
  const uploadRef = ref<UploadInstance>()
  const importHeaders = BASIC_BOQ_IMPORT_HEADERS

  function setFormRef(id: number, el: FormInstance | null | undefined) {
    if (el) {
      formRefs[id] = el
      return
    }
    delete formRefs[id]
  }

  function setNewFormRef(el: FormInstance | null | undefined) {
    newFormRef.value = el || undefined
  }

  function setUploadRef(el: UploadInstance | null | undefined) {
    uploadRef.value = el || undefined
  }

  function resetNewContractState() {
    showNewContract.value = false
    newSaving.value = false
    newForm.value = createContractEditForm()
    newBoqRows.splice(0, newBoqRows.length)
    newFormRef.value?.clearValidate()
  }

  function resetImportState() {
    showImportDialog.value = false
    importContractId.value = null
    importFile.value = null
    uploadRef.value?.clearFiles()
  }

  function resetProjectState() {
    project.value = null
    contracts.value = []
    settlements.value = []
    clearRecord(boqMap)
    clearRecord(editForms)
    clearRecord(formRefs)
    clearRecord(attachCounts)
    expandedIds.clear()
    showEditDialog.value = false
    editForm.value = createProjectEditForm(null)
    nextContractNo.value = ''
    resetNewContractState()
    resetImportState()
    showAttachDrawer.value = false
    attachDrawerContractId.value = null
  }

  function refreshNextContractNo() {
    nextContractNo.value = getNextContractNo(
      contracts.value.map(contract => contract.contractNo),
      project.value?.code || '',
    )
  }

  function applyContractEntries(entries: Array<{
    contract: Contract
    items: BillOfQuantities[]
    attachmentCount: number
  }>) {
    clearRecord(boqMap)
    clearRecord(editForms)
    clearRecord(formRefs)
    clearRecord(attachCounts)
    expandedIds.clear()

    for (const entry of entries) {
      boqMap[entry.contract.id] = entry.items as EditableBoqItem[]
      editForms[entry.contract.id] = createContractEditForm(entry.contract)
      attachCounts[entry.contract.id] = entry.attachmentCount
      expandedIds.add(entry.contract.id)
    }
  }

  async function loadAttachCount(contractId: number) {
    attachCounts[contractId] = await loadProjectDetailAttachmentCount(contractId)
  }

  const scaleThresholds = ref({ small: 5000000, large: 20000000 })

  const projectScale = computed(() => {
    const totalAmount = contracts.value.reduce((sum, c) => sum + (c.contractAmount || 0), 0)
    if (totalAmount < scaleThresholds.value.small) return 'small'
    if (totalAmount > scaleThresholds.value.large) return 'large'
    return 'medium'
  })

  async function loadPageData() {
    resetProjectState()
    try {
      scaleThresholds.value = await systemSettingsService.getProjectScaleThresholds()
    } catch (e) {
      console.warn('Failed to load project scale thresholds', e)
    }

    const id = pid.value
    if (id <= 0) return

    const snapshot = await loadProjectDetailPage(id)
    if (snapshot === null) return

    project.value = snapshot.project
    editForm.value = createProjectEditForm(snapshot.project)
    contracts.value = snapshot.contracts
    settlements.value = snapshot.settlements
    nextContractNo.value = snapshot.nextContractNo
    applyContractEntries(snapshot.contractEntries)
  }

  function toggleContract(id: number) {
    if (expandedIds.has(id)) {
      expandedIds.delete(id)
      return
    }
    expandedIds.add(id)
  }

  function getContractTotal(cid: number) {
    return formatAmount(summarizeContractAmounts(boqMap[cid] || []).total)
  }

  function getContractNoTax(cid: number) {
    return formatAmount(summarizeContractAmounts(boqMap[cid] || []).noTax)
  }

  function getContractTax(cid: number) {
    return formatAmount(summarizeContractAmounts(boqMap[cid] || []).tax)
  }

  function onNoTaxUnitPriceChange(row: Partial<BillOfQuantities>) {
    recalculateBoqFromNoTaxPrice(row as EditableBoqItem)
  }

  function onUnitPriceChange(row: Partial<BillOfQuantities>) {
    recalculateBoqFromUnitPrice(row as EditableBoqItem)
  }

  function onTaxRateChange(row: Partial<BillOfQuantities>) {
    recalculateBoqRow(row as EditableBoqItem)
  }

  function onQuantityChange(row: Partial<BillOfQuantities>) {
    recalculateBoqFromQuantity(row as EditableBoqItem)
  }

  function addBoqRow(contractId: number) {
    const rows = boqMap[contractId] || (boqMap[contractId] = [])
    rows.push(createEmptyBoqRow(contractId, rows.length + 1) as EditableBoqItem)
  }

  function removeBoqRow(contractId: number, index: number) {
    const rows = boqMap[contractId]
    if (!rows) return
    rows.splice(index, 1)
  }

  function getBoqSummary(param: Parameters<typeof buildBoqSummary>[0]) {
    return buildBoqSummary(param)
  }

  function getSettlementSummary(param: Parameters<typeof buildSettlementSummary>[0]) {
    return buildSettlementSummary(param)
  }

  async function saveContract(contract: Contract) {
    const formEl = formRefs[contract.id]
    if (!formEl) return

    const valid = await formEl.validate().catch(() => false)
    if (!valid) return

    try {
      await withContractSaving(savingId, contract.id, async () => {
        const form = editForms[contract.id]
        const result = await saveProjectDetailContract(pid.value, contract.id, form, boqMap[contract.id] || [])
        if (result.type === 'warning') {
          ElMessage.warning(result.message)
          return
        }

        boqMap[contract.id] = result.data.boqItems as EditableBoqItem[]
        const index = contracts.value.findIndex(item => item.id === contract.id)
        if (index >= 0) {
          contracts.value[index] = result.data.contract
        }
        refreshNextContractNo()
        settlements.value = result.data.settlements
        ElMessage.success(result.successMessage)
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '保存失败'))
    }
  }
  function createContract() {
    showNewContract.value = true
    newForm.value = createContractEditForm({ contractNo: nextContractNo.value })
    newBoqRows.splice(0, newBoqRows.length)
    newFormRef.value?.clearValidate()
  }

  function cancelNewContract() {
    resetNewContractState()
  }

  function addNewBoqRow() {
    newBoqRows.push(createEmptyBoqRow(0, newBoqRows.length + 1) as EditableBoqItem)
  }

  function removeNewBoqRow(index: number) {
    newBoqRows.splice(index, 1)
  }

  function onNewBoqQuantityChange(row: EditableBoqItem) {
    recalculateBoqFromQuantity(row)
  }

  function onNewBoqNoTaxPriceChange(row: EditableBoqItem) {
    recalculateBoqFromNoTaxPrice(row)
  }

  function onNewBoqUnitPriceChange(row: EditableBoqItem) {
    recalculateBoqFromUnitPrice(row)
  }

  function onNewBoqTaxRateChange(row: EditableBoqItem) {
    recalculateBoqRow(row)
  }

  async function saveNewContract() {
    if (!newFormRef.value) return

    const valid = await newFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
      await withLoading(newSaving, async () => {
        const result = await createProjectDetailContract(pid.value, newForm.value, newBoqRows)
        if (result.type === 'warning') {
          ElMessage.warning(result.message)
          return
        }

        contracts.value.push(result.data.contract)
        refreshNextContractNo()
        boqMap[result.data.contract.id] = result.data.boqItems as EditableBoqItem[]
        editForms[result.data.contract.id] = createContractEditForm(result.data.contract)
        attachCounts[result.data.contract.id] = 0
        expandedIds.add(result.data.contract.id)
        settlements.value = result.data.settlements
        resetNewContractState()
        ElMessage.success(result.successMessage)
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '新建失败'))
    }
  }
  async function deleteContract(cid: number) {
    try {
      const result = await deleteProjectDetailContract(pid.value, cid)
      if (result.type === 'warning') {
        ElMessage.warning(result.message)
        return
      }

      settlements.value = result.data
      contracts.value = contracts.value.filter(contract => contract.id !== cid)
      refreshNextContractNo()
      delete boqMap[cid]
      delete editForms[cid]
      delete formRefs[cid]
      delete attachCounts[cid]
      expandedIds.delete(cid)
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '删除失败'))
    }
  }

  function openAttachDrawer(cid: number) {
    attachDrawerContractId.value = cid
    showAttachDrawer.value = true
  }

  function onAttachChange() {
    const cid = attachDrawerContractId.value ?? 0
    if (cid <= 0) return
    void loadAttachCount(cid)
  }

  function openImportDialog(cid: number) {
    importContractId.value = cid
    importFile.value = null
    uploadRef.value?.clearFiles()
    showImportDialog.value = true
  }

  function handleFileChange(file: UploadFile) {
    importFile.value = file.raw || null
  }

  async function handleImport() {
    const cid = importContractId.value ?? 0
    if (!importFile.value || cid <= 0) return

    try {
      const result = await importProjectDetailBoq(importFile.value, cid, boqMap[cid]?.length || 0)
      if (result.type === 'warning') {
        ElMessage.warning(result.message)
        return
      }

      if (!boqMap[cid]) boqMap[cid] = []
      boqMap[cid].push(...result.data)
      resetImportState()
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导入失败'))
    }
  }

  async function downloadTemplate() {
    try {
      const result = await downloadProjectDetailBoqTemplate()
      if (result.type === 'warning') {
        ElMessage.warning(result.message)
        return
      }
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '下载模板失败'))
    }
  }

  async function exportBOQ(contract: Contract) {
    try {
      const result = await exportProjectDetailBoq(project.value, contract, boqMap[contract.id] || [])
      if (result.type === 'warning') {
        ElMessage.warning(result.message)
        return
      }
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出清单失败'))
    }
  }

  function viewSettlement(id: number) {
    void router.push(getProjectDetailSettlementRoute(id))
  }

  function openProjectEditor() {
    editForm.value = createProjectEditForm(project.value)
    showEditDialog.value = true
  }

  async function saveProject() {
    if (!project.value) return

    try {
      const result = await saveProjectDetailBasics(project.value.id, {
        code: editForm.value.code,
        name: editForm.value.name,
        location: editForm.value.location,
        ownerUnit: editForm.value.ownerUnit,
        generalContractor: editForm.value.generalContractor,
        status: editForm.value.status,
        plannedEndDate: editForm.value.plannedEndDate,
        difficulty: editForm.value.difficulty,
      })
      if (result.type === 'warning') {
        ElMessage.warning(result.message)
        return
      }
      project.value = result.data
      showEditDialog.value = false
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '保存失败'))
    }
  }

  function goBackToProjects() {
    void router.push(getProjectDetailListRoute())
  }

  watch(
    [() => pid.value, () => route.fullPath],
    () => {
      void loadPageData()
    },
    { immediate: true },
  )

  return {
    router,
    project,
    contracts,
    projectScale,
    settlements,
    boqMap,
    editForms,
    expandedIds,
    savingId,
    showEditDialog,
    editForm,
    nextContractNo,
    showNewContract,
    newSaving,
    newForm,
    newFormRef,
    newBoqRows,
    showAttachDrawer,
    attachDrawerContractId,
    attachCounts,
    showImportDialog,
    importFile,
    uploadRef,
    contractRules,
    importHeaders,
    taxRateOptions,
    contractAttachmentAdapter: projectDetailAttachmentAdapter,
    setNewFormRef,
    setUploadRef,
    setFormRef,
    toggleContract,
    getContractTotal,
    getContractNoTax,
    getContractTax,
    onNoTaxUnitPriceChange,
    onUnitPriceChange,
    onTaxRateChange,
    onQuantityChange,
    addBoqRow,
    removeBoqRow,
    getBoqSummary,
    getSettlementSummary,
    saveContract,
    createContract,
    cancelNewContract,
    saveNewContract,
    deleteContract,
    addNewBoqRow,
    removeNewBoqRow,
    onNewBoqQuantityChange,
    onNewBoqNoTaxPriceChange,
    onNewBoqUnitPriceChange,
    onNewBoqTaxRateChange,
    openAttachDrawer,
    onAttachChange,
    openImportDialog,
    handleFileChange,
    handleImport,
    downloadTemplate,
    exportBOQ,
    viewSettlement,
    openProjectEditor,
    saveProject,
    goBackToProjects,
  }
}
