import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  buildProjectSummary,
  buildReceivableRows,
  buildReceivableSummary,
  buildSettlementReport,
  createEmptyBusinessSnapshot,
  type BusinessSnapshot,
} from '@/services/analytics.service'
import {
  buildProjectSummaryTableSummary,
  buildReceivableTableSummary,
  buildReportHighlightCards,
  buildReportMeta,
  buildSettlementTableSummary,
  reportOptions,
  type ReportType,
} from './report-center.helpers'
import {
  exportReportCenter,
  loadReportCenterPage,
} from './report-center.controller'
import { buildSaveFileSuccessMessage } from '@/utils/file-download'
import { getErrorMessage } from '@/utils/error'

export function useReportCenter() {
  const reportType = ref<ReportType>('project_summary')
  const filterProjectId = ref<number | undefined>(undefined)
  const snapshot = ref<BusinessSnapshot>(createEmptyBusinessSnapshot())
  const exporting = ref(false)

  const projectSummary = computed(() => buildProjectSummary(snapshot.value, filterProjectId.value))
  const settlementDetails = computed(() => buildSettlementReport(snapshot.value, filterProjectId.value))
  const receivableList = computed(() => buildReceivableRows(snapshot.value, filterProjectId.value))
  const receivableSummary = computed(() => buildReceivableSummary(receivableList.value))

  const reportMeta = computed(() => buildReportMeta(reportType.value, {
    projectCount: projectSummary.value.length,
    settlementCount: settlementDetails.value.length,
    totalUnreceived: receivableSummary.value.totalUnreceived,
  }))

  const reportHighlightCards = computed(() => buildReportHighlightCards(reportType.value, {
    projectSummary: projectSummary.value,
    settlementDetails: settlementDetails.value,
    receivableList: receivableList.value,
    receivableSummary: receivableSummary.value,
  }))

  function getProjectSummary(param: Parameters<typeof buildProjectSummaryTableSummary>[0]) {
    return buildProjectSummaryTableSummary(param)
  }

  function getSettlementSummary(param: Parameters<typeof buildSettlementTableSummary>[0]) {
    return buildSettlementTableSummary(param)
  }

  function getReceivableSummary(param: Parameters<typeof buildReceivableTableSummary>[0]) {
    return buildReceivableTableSummary(param)
  }

  async function handleExport() {
    exporting.value = true
    try {
      const result = await exportReportCenter({
        reportType: reportType.value,
        projectSummary: projectSummary.value,
        settlementDetails: settlementDetails.value,
        receivableList: receivableList.value,
      })
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
    snapshot.value = await loadReportCenterPage()
  }

  onMounted(() => {
    void loadPageData()
  })

  return {
    reportType,
    filterProjectId,
    snapshot,
    exporting,
    projectSummary,
    settlementDetails,
    receivableList,
    receivableSummary,
    reportOptions,
    reportMeta,
    reportHighlightCards,
    getProjectSummary,
    getSettlementSummary,
    getReceivableSummary,
    handleExport,
  }
}
