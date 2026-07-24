import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { getErrorMessage } from '@/utils/error'
import { downloadCsvFile } from '@/utils/csv'
import { buildSaveFileSuccessMessage } from '@/utils/file-download'
import { withLoading } from '../with-loading'
import type { Contract, Project, Settlement } from '@/types'
import {
  buildSettlementListRows,
  buildSettlementListSummary,
  createRules,
  createSettlementCreateForm,
  filterSettlementRows,
  settlementStatusOptions,
  settlementStatusTextMap,
  settlementStatusTypeMap,
  settlementTypeOptions,
  settlementTypeTextMap,
} from './settlement-list.helpers'
import {
  buildSettlementCreateRoute,
  deleteSettlementListSettlement,
  fetchSettlementDeletePreview,
  getSettlementListDetailRoute,
  loadSettlementListPage,
} from './settlement-list.controller'

export function useSettlementList() {
  const router = useRouter()

  const projects = ref<Project[]>([])
  const contracts = ref<Contract[]>([])
  const settlements = ref<Settlement[]>([])

  const searchQuery = ref('')
  const filterType = ref<'' | Settlement['settlementType']>('')
  const filterStatus = ref<'' | Settlement['status']>('')
  const filterProject = ref<number | undefined>(undefined)

  const showCreateDrawer = ref(false)
  const createFormRef = ref<FormInstance>()
  const createForm = ref(createSettlementCreateForm())
  const exporting = ref(false)

  const projectOptions = computed(() => projects.value)
  const contractOptions = computed(() => {
    if ((createForm.value.projectId ?? 0) <= 0) return []
    return contracts.value.filter(contract => contract.projectId === createForm.value.projectId)
  })

  const settlementRows = computed(() => buildSettlementListRows(settlements.value, projects.value, contracts.value))
  const filteredSettlementRows = computed(() => filterSettlementRows(settlementRows.value, {
    searchQuery: searchQuery.value,
    status: filterStatus.value,
    settlementType: filterType.value,
    projectId: filterProject.value,
  }))
  const settlementSummary = computed(() => buildSettlementListSummary(filteredSettlementRows.value))
  const hasActiveFilters = computed(() =>
    searchQuery.value.trim().length > 0
    || filterType.value !== ''
    || filterStatus.value !== ''
    || filterProject.value !== undefined,
  )

  function getSettlementTypeText(type: Settlement['settlementType']) {
    return settlementTypeTextMap[type]
  }

  function getSettlementStatusText(status: Settlement['status']) {
    return settlementStatusTextMap[status]
  }

  function getSettlementStatusType(status: Settlement['status']) {
    return settlementStatusTypeMap[status]
  }

  async function loadPageData() {
    const snapshot = await loadSettlementListPage()
    projects.value = snapshot.projects
    contracts.value = snapshot.contracts
    settlements.value = snapshot.settlements
  }

  function resetFilters() {
    searchQuery.value = ''
    filterType.value = ''
    filterStatus.value = ''
    filterProject.value = undefined
  }

  function resetCreateForm() {
    createForm.value = createSettlementCreateForm()
    createFormRef.value?.clearValidate()
  }

  function onProjectChange() {
    createForm.value.contractIds = []
  }

  function viewSettlement(id: number) {
    void router.push(getSettlementListDetailRoute(id))
  }

  async function handleCreate() {
    if (!createFormRef.value) return
    const valid = await createFormRef.value.validate().catch(() => false)
    if (!valid) return

    void router.push(buildSettlementCreateRoute(createForm.value))
  }

  async function handleExport() {
    const rows: (string | number)[][] = [
      ['结算单号', '项目名称', '关联合同', '类型', '开始日期', '结束日期', '本期结算(元)', '累计结算(元)', '状态'],
      ...filteredSettlementRows.value.map(row => [
        row.settlementNo,
        row.projectName || '',
        row.contractNamesText || '',
        getSettlementTypeText(row.settlementType),
        row.startDate,
        row.endDate,
        row.currentAmount,
        row.currentCumulative,
        getSettlementStatusText(row.status),
      ]),
    ]
    const dateStr = new Date().toISOString().slice(0, 10)
    try {
      await withLoading(exporting, async () => {
        const result = await downloadCsvFile(`结算单列表_${dateStr}`, rows)
        if (result.canceled) {
          ElMessage.warning('已取消导出')
          return
        }
        ElMessage.success(buildSaveFileSuccessMessage(result))
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出结算单列表失败'))
    }
  }

  async function handleDelete(id: number) {
    try {
      const preview = await fetchSettlementDeletePreview(id)
      const parts: string[] = [`共 ${preview.detailCount} 条明细`]
      if (preview.attachmentCount > 0) parts.push(`${preview.attachmentCount} 个附件`)
      await ElMessageBox.confirm(
        `删除后不可恢复，将同时删除${parts.join('、')}，且系统会自动回算同项目累计结算。确认删除？`,
        '确认删除结算单',
        { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
      )
      const result = await deleteSettlementListSettlement(id)
      const snapshot = result.snapshot
      projects.value = snapshot.projects
      contracts.value = snapshot.contracts
      settlements.value = snapshot.settlements
      ElMessage.success(result.successMessage)
    } catch (error: unknown) {
      if (error === 'cancel') return
      ElMessage.error(getErrorMessage(error, '删除失败'))
    }
  }

  onMounted(() => {
    void loadPageData()
  })

  return {
    searchQuery,
    filterType,
    filterStatus,
    filterProject,
    showCreateDrawer,
    createFormRef,
    createForm,
    exporting,
    createRules,
    projectOptions,
    contractOptions,
    settlementStatusOptions,
    settlementStatusTextMap,
    settlementStatusTypeMap,
    settlementTypeOptions,
    settlementTypeTextMap,
    filteredSettlementRows,
    settlementSummary,
    hasActiveFilters,
    getSettlementTypeText,
    getSettlementStatusText,
    getSettlementStatusType,
    resetFilters,
    resetCreateForm,
    onProjectChange,
    viewSettlement,
    handleCreate,
    handleExport,
    handleDelete,
  }
}
