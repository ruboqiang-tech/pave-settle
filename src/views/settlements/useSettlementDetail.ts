import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  exportSettlementDetail,
  getSettlementDetailListRoute,
  loadSettlementDetailPage,
  saveSettlementDetail,
  settlementDetailAttachmentAdapter,
  undoSettlementDetailConfirm,
} from './settlement-detail.controller'
import type AttachmentManager from '@/components/AttachmentManager.vue'
import { calculateSettlementRatio, formatCurrency, roundAmount } from '@/utils/calculations'
import { formatQuantity } from '@/utils/format'
import { getErrorMessage } from '@/utils/error'
import { buildTableSummary, createSummaryFormatters, type TableSummaryParams } from '@/utils/table-summary'
import type { Contract, CostAdjustmentData, SettlementDetailRow, SettlementStatus, SettlementType } from '@/types'
import {
  applySettlementDateRange,
  applyCostAdjustmentToSettlement,
  buildContractCollections,
  buildGroupedDetails,
  createCostAdjustmentData,
  createSettlementDraft,
  getGroupCurrentAmount,
  getSettlementDateRange,
  recalculateSettlement,
  recalculateSettlementDetailRow,
  syncCostAdjustmentFromSettlement,
  validateSettlementDraftForSave,
} from './settlement-detail.helpers'
import { withLoading } from '../with-loading'

type AttachmentManagerInstance = InstanceType<typeof AttachmentManager>

function readQueryText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return String(value[0] || '')
  return ''
}

function parseRouteSettlementSeed(route: ReturnType<typeof useRoute>) {
  return {
    projectId: Number(readQueryText(route.query.projectId)) || 0,
    settlementType: (readQueryText(route.query.type) as SettlementType) || 'interim',
    startDate: readQueryText(route.query.start),
    endDate: readQueryText(route.query.end),
  }
}

function parseRouteContractIds(route: ReturnType<typeof useRoute>): number[] {
  return readQueryText(route.query.contractIds)
    .split(',')
    .map(value => Number(value))
    .filter(value => value > 0)
}

export function useSettlementDetail() {
  const route = useRoute()
  const router = useRouter()

  const saving = ref(false)
  const exporting = ref(false)
  const attachmentManagerRef = ref<AttachmentManagerInstance | null>(null)
  const showAttachmentDrawer = ref(false)
  const attachmentCount = ref(0)
  const activeDetailPanels = ref<string[]>([])
  const pageTitle = ref('新建结算单')
  const projectName = ref('')
  const contractNameList = ref<string[]>([])
  const contractAmount = ref(0)
  const selectedContractIds = ref<number[]>([])
  const contractAmountMap = ref<Record<number, number>>({})
  const loadedContracts = ref<Contract[]>([])
  const detailsLoadedFromFallback = ref(false)

  const settlement = reactive(createSettlementDraft(parseRouteSettlementSeed(route)))
  const details = ref<SettlementDetailRow[]>([])
  const costAdjustment = ref<CostAdjustmentData>(createCostAdjustmentData(settlement))

  watch(() => costAdjustment.value, value => {
    applyCostAdjustmentToSettlement(settlement, value)
    recalculateSettlement(settlement, details.value)
  }, { deep: true })

  const groupedDetails = computed(() => buildGroupedDetails(details.value, contractAmountMap.value))
  const settlementDateRange = computed<string[] | null>({
    get: () => getSettlementDateRange(settlement),
    set: value => {
      applySettlementDateRange(settlement, value)
    },
  })
  const settlementRatio = computed(() => calculateSettlementRatio(settlement.currentCumulative, contractAmount.value))
  const remainingContractAmount = computed(() => roundAmount(contractAmount.value - settlement.currentCumulative))
  const settlementProgress = computed(() => Math.min(Math.max(settlementRatio.value, 0), 100))

  function syncDetailPanels() {
    activeDetailPanels.value = groupedDetails.value.map(group => String(group.contractId))
  }

  function applyContracts(contracts: Contract[]) {
    const collections = buildContractCollections(contracts)
    loadedContracts.value = contracts
    contractNameList.value = collections.nameList
    contractAmount.value = collections.totalAmount
    contractAmountMap.value = collections.amountMap
  }

  async function refreshAttachmentCount() {
    attachmentCount.value = settlement.id > 0
      ? (await settlementDetailAttachmentAdapter.getList(settlement.id)).length
      : 0
  }

  function resetSettlementState() {
    pageTitle.value = '新建结算单'
    projectName.value = ''
    contractNameList.value = []
    contractAmount.value = 0
    selectedContractIds.value = []
    contractAmountMap.value = {}
    loadedContracts.value = []
    details.value = []
    detailsLoadedFromFallback.value = false
    attachmentCount.value = 0
    activeDetailPanels.value = []

    Object.assign(settlement, createSettlementDraft(parseRouteSettlementSeed(route)))
    syncCostAdjustmentFromSettlement(settlement, costAdjustment.value)
  }

  async function loadPageData() {
    resetSettlementState()

    const snapshot = await loadSettlementDetailPage({
      settlementId: Number(route.params.id) || 0,
      routeContractIds: parseRouteContractIds(route),
      seed: parseRouteSettlementSeed(route),
    })

    if (snapshot === null) {
      await router.push(getSettlementDetailListRoute())
      return
    }

    pageTitle.value = snapshot.pageTitle
    projectName.value = snapshot.projectName
    selectedContractIds.value = snapshot.selectedContractIds
    Object.assign(settlement, snapshot.settlement)
    applyContracts(snapshot.loadedContracts)
    details.value = snapshot.details
    detailsLoadedFromFallback.value = snapshot.detailsLoadedFromFallback
    syncCostAdjustmentFromSettlement(settlement, costAdjustment.value)
    await refreshAttachmentCount()
    syncDetailPanels()
  }

  function onQuantityChange(row: SettlementDetailRow) {
    recalculateSettlementDetailRow(row)
    recalculateSettlement(settlement, details.value)
  }

  function getGroupSummary(param: TableSummaryParams<SettlementDetailRow>) {
    return buildTableSummary(param, {
      label: '合计',
      formatters: {
        ...createSummaryFormatters<SettlementDetailRow>(['currentAmount'], formatCurrency),
      },
    })
  }

  function getPendingAttachments() {
    if (!attachmentManagerRef.value) return []
    return attachmentManagerRef.value.getPendingFiles()
  }

  function syncAttachmentManagerAfterPersist() {
    if (!attachmentManagerRef.value) return
    attachmentManagerRef.value.clearPendingFiles()
    void attachmentManagerRef.value.loadAttachments()
  }

  async function handleAttachmentDrawerClosed() {
    await refreshAttachmentCount()
  }

  async function handleUndoConfirm() {
    if (settlement.id <= 0) return
    try {
      await withLoading(saving, async () => {
        const result = await undoSettlementDetailConfirm(settlement.id)
        await loadPageData()
        ElMessage.success(result.successMessage)
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '撤销失败'))
    }
  }

  async function handleSave(status: SettlementStatus) {
    const validationError = validateSettlementDraftForSave({ ...settlement, status })
    if (validationError) {
      ElMessage.error(validationError)
      return
    }
    try {
      await withLoading(saving, async () => {
        const result = await saveSettlementDetail(
          settlement,
          details.value,
          status,
          getPendingAttachments(),
        )

        syncAttachmentManagerAfterPersist()

        if (result.isNewSettlement) {
          await router.replace(`/settlements/${result.savedSettlementId}`)
        } else {
          await loadPageData()
        }

        ElMessage.success(result.successMessage)
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '保存失败'))
    }
  }

  async function handleExportExcel() {
    try {
      await withLoading(exporting, async () => {
        const result = await exportSettlementDetail({
          settlement,
          projectName: projectName.value,
          contractNames: contractNameList.value,
          contractAmount: contractAmount.value,
          settlementRatio: settlementRatio.value,
          details: details.value,
        })
        if (result.type === 'warning') {
          ElMessage.warning(result.message)
          return
        }
        ElMessage.success(result.successMessage)
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出结算单失败'))
    }
  }

  function goBack() {
    void router.push(getSettlementDetailListRoute())
  }

  onMounted(() => {
    void loadPageData()
  })

  watch(
    () => route.fullPath,
    () => {
      void loadPageData()
    },
  )

  return {
    settlementAttachmentAdapter: settlementDetailAttachmentAdapter,
    saving,
    exporting,
    attachmentManagerRef,
    showAttachmentDrawer,
    attachmentCount,
    activeDetailPanels,
    pageTitle,
    projectName,
    contractNameList,
    contractAmount,
    loadedContracts,
    detailsLoadedFromFallback,
    settlement,
    details,
    costAdjustment,
    groupedDetails,
    settlementDateRange,
    settlementRatio,
    remainingContractAmount,
    settlementProgress,
    getGroupCurrentAmount,
    onQuantityChange,
    getGroupSummary,
    handleAttachmentDrawerClosed,
    handleUndoConfirm,
    handleSave,
    handleExportExcel,
    goBack,
  }
}
