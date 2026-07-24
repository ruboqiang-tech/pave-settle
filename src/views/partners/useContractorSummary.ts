import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  buildContractorOverallSummary,
  buildContractorSummary,
  createEmptyBusinessSnapshot,
  type BusinessSnapshot,
  type ContractorSummaryRow,
} from '@/services/analytics.service'
import {
  exportContractorSummary,
  getContractorProjectRoute,
  loadContractorSummaryPage,
} from './contractor-summary.controller'
import { buildSaveFileSuccessMessage } from '@/utils/file-download'
import { getErrorMessage } from '@/utils/error'

export function useContractorSummary() {
  const router = useRouter()

  const snapshot = ref<BusinessSnapshot>(createEmptyBusinessSnapshot())
  const expandedRows = ref<string[]>([])
  const exporting = ref(false)

  const contractorRows = computed(() => buildContractorSummary(snapshot.value))
  const overall = computed(() => buildContractorOverallSummary(contractorRows.value))

  function handleExpandChange(_row: ContractorSummaryRow, expanded: ContractorSummaryRow[]) {
    expandedRows.value = expanded.map(row => row.contractorName)
  }

  function goProject(projectId: number) {
    void router.push(getContractorProjectRoute(projectId))
  }

  async function handleExport() {
    exporting.value = true
    try {
      const result = await exportContractorSummary(contractorRows.value)
      if (result.canceled) {
        ElMessage.warning('已取消导出')
        return
      }
      ElMessage.success(buildSaveFileSuccessMessage(result))
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出失败'))
    } finally {
      exporting.value = false
    }
  }

  async function loadPageData() {
    snapshot.value = await loadContractorSummaryPage()
  }

  onMounted(() => {
    void loadPageData()
  })

  return {
    expandedRows,
    exporting,
    contractorRows,
    overall,
    handleExpandChange,
    goProject,
    handleExport,
  }
}
