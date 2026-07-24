import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  buildDashboardActiveProjects,
  buildDashboardChartProjects,
  buildDashboardRecentSettlements,
  buildDashboardStats,
  buildTrendPeriods,
  buildTrendReceipts,
  buildTrendSettlements,
  createEmptyBusinessSnapshot,
  getProjectNameMap,
  type BusinessSnapshot,
  type TrendGranularity,
} from '@/services/analytics.service'
import {
  buildTrendDisplayLabels,
  getCurrentPeriodAmount,
  getCurrentPeriodTitle,
  getTrendSummaryLabel,
  sumTrendAmounts,
  trendSpanOptionMap,
} from './dashboard.helpers'
import {
  getDashboardProjectDetailRoute,
  getDashboardProjectsRoute,
  getDashboardSettlementDetailRoute,
  getDashboardSettlementsRoute,
  loadDashboardPage,
} from './dashboard.controller'

const SettlementProgressChart = defineAsyncComponent(() => import('@/components/SettlementProgressChart.vue'))
const PaymentTrendChart = defineAsyncComponent(() => import('@/components/PaymentTrendChart.vue'))

export function useDashboard() {
  const router = useRouter()
  const snapshot = ref<BusinessSnapshot>(createEmptyBusinessSnapshot())

  const trendGranularity = ref<TrendGranularity>('month')
  const selectedTrendSpan = ref(12)

  const stats = computed(() => buildDashboardStats(snapshot.value))
  const activeProjects = computed(() => buildDashboardActiveProjects(snapshot.value))
  const recentSettlements = computed(() => buildDashboardRecentSettlements(snapshot.value))
  const chartProjectData = computed(() => buildDashboardChartProjects(snapshot.value))
  const trendSpanOptions = computed(() => trendSpanOptionMap[trendGranularity.value])
  const trendPeriods = computed(() => buildTrendPeriods(selectedTrendSpan.value, trendGranularity.value))
  const trendDisplayLabels = computed(() => buildTrendDisplayLabels(trendPeriods.value, trendGranularity.value))
  const trendSettlementAmounts = computed(() => buildTrendSettlements(snapshot.value, trendPeriods.value, trendGranularity.value))
  const trendReceivedAmounts = computed(() => buildTrendReceipts(snapshot.value, trendPeriods.value, trendGranularity.value))
  const trendSettlementTotal = computed(() => sumTrendAmounts(trendSettlementAmounts.value))
  const trendReceivedTotal = computed(() => sumTrendAmounts(trendReceivedAmounts.value))
  const currentPeriodSettlement = computed(() => getCurrentPeriodAmount(trendSettlementAmounts.value))
  const currentPeriodTitle = computed(() => getCurrentPeriodTitle(trendGranularity.value))
  const trendSummaryLabel = computed(() => getTrendSummaryLabel(trendGranularity.value, selectedTrendSpan.value))
  const projectNameMap = computed(() => getProjectNameMap(snapshot.value))

  watch(trendGranularity, value => {
    selectedTrendSpan.value = trendSpanOptionMap[value][0]
  })

  function getProjectName(projectId: number) {
    return projectNameMap.value.get(projectId) || '-'
  }

  function goToProjects() {
    void router.push(getDashboardProjectsRoute())
  }

  function goToSettlements() {
    void router.push(getDashboardSettlementsRoute())
  }

  function viewProject(id: number) {
    void router.push(getDashboardProjectDetailRoute(id))
  }

  function viewSettlement(id: number) {
    void router.push(getDashboardSettlementDetailRoute(id))
  }

  async function loadPageData() {
    snapshot.value = await loadDashboardPage()
  }

  onMounted(() => {
    void loadPageData()
  })

  return {
    SettlementProgressChart,
    PaymentTrendChart,
    stats,
    activeProjects,
    recentSettlements,
    chartProjectData,
    trendGranularity,
    selectedTrendSpan,
    trendSpanOptions,
    trendDisplayLabels,
    trendSettlementAmounts,
    trendReceivedAmounts,
    trendSettlementTotal,
    trendReceivedTotal,
    currentPeriodSettlement,
    currentPeriodTitle,
    trendSummaryLabel,
    getProjectName,
    goToProjects,
    goToSettlements,
    viewProject,
    viewSettlement,
  }
}
