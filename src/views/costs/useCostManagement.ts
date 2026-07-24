import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { Contract, Project, Settlement } from '@/types'
import {
  buildProjectCostManagementSummary,
  type CostPhase,
  type ProjectCostEntry,
} from '@/services/costing.service'
import { roundAmount } from '@/utils/calculations'
import { getErrorMessage } from '@/utils/error'
import { withLoading } from '../with-loading'
import {
  loadCostManagementPage,
  saveCostManagementPhase,
} from './cost-management.controller'
import { projectService } from '@/services/project.service'
import { budgetFileService, type BudgetFile } from '@/services/budget-file.service'
import { priceLibraryService } from '@/services/price-library.service'
import { quotaLibraryService } from '@/services/quota-library.service'
import type { PriceResourceItem, PriceQuote } from '@/types/price-library.types'
import type { QuotaItem, ParamRule } from '@/types/quota-library.types'
import { SEED_QUOTA_ITEMS, SEED_PARAM_RULES, SEED_SELECTED_QUOTES } from '@/services/seed-data'

// 类型从共享模块重新导出，保持现有引用兼容
export type { PriceQuote, PriceResourceItem } from '@/types/price-library.types'
export type { QuotaItem, QuotaComponent, ParamRule } from '@/types/quota-library.types'

// ---------------------------------------------------------------------------
// Helper functions (unchanged)
// ---------------------------------------------------------------------------

function getRowsByPhase(
  rows: ProjectCostEntry[],
  projectId: number,
  phase: CostPhase,
): ProjectCostEntry[] {
  return rows
    .filter(row => row.phase === phase)
    .map(row => ({
      ...row,
      projectId,
      phase,
      itemName: row.itemName || '',
      spec: row.spec || '',
      unit: row.unit || '',
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unitCost || 0),
      amount: Number(row.amount || 0),
      occurredOn: row.occurredOn || '',
      note: row.note || '',
    }))
}

function createEmptyCostRow(projectId: number, phase: CostPhase): ProjectCostEntry {
  return {
    projectId,
    phase,
    category: 'material',
    itemName: '',
    spec: '',
    unit: '',
    quantity: 0,
    unitCost: 0,
    amount: 0,
    occurredOn: '',
    note: '',
  }
}

function getLatestSettledAmount(settlements: Settlement[]): number {
  if (settlements.length === 0) return 0
  return Number(settlements[settlements.length - 1]?.currentCumulative || 0)
}

function resolveProjectIdFromQuery(value: unknown): number {
  if (Array.isArray(value)) return Number(value[0] || 0)
  return Number(value || 0)
}

// ---------------------------------------------------------------------------
// Main composable
// ---------------------------------------------------------------------------

export function useCostManagement() {
  const route = useRoute()
  const router = useRouter()

  const projects = ref<Project[]>([])
  const project = ref<Project | null>(null)
  const contracts = ref<Contract[]>([])
  const settlements = ref<Settlement[]>([])
  const selectedProjectId = ref<number>(0)
  const pageLoading = ref(false)
  const budgetRows = reactive<ProjectCostEntry[]>([])
  const actualRows = reactive<ProjectCostEntry[]>([])
  const budgetSaving = ref(false)
  const actualSaving = ref(false)

  // 价格库共享响应式数据与选择映射
  // 初始值为空，由 loadPriceAndQuotaData() 从 DB 加载填充
  const priceResourceItems = reactive<PriceResourceItem[]>([])
  const selectedQuoteMap = reactive<Record<string, string>>({})

  // 定额与规则共享响应式数据
  // 初始值为空，由 loadPriceAndQuotaData() 从 DB 加载填充
  const quotaItems = reactive<QuotaItem[]>([])
  const paramRules = reactive<Record<string, Record<string, ParamRule>>>({})

  const budgetFiles = ref<BudgetFile[]>([])
  const budgetFilesLoaded = ref(false)

  // -----------------------------------------------------------------------
  // 价格库 & 定额库数据加载（从数据库）
  // -----------------------------------------------------------------------

  async function loadPriceAndQuotaData() {
    try {
      // 种子数据检查（首次使用时灌入默认数据）
      await priceLibraryService.seedIfEmpty()
      await quotaLibraryService.seedIfEmpty()

      // 从数据库加载
      const [resources, quotes, dbQuotaItems, dbParamRules] = await Promise.all([
        priceLibraryService.listResources(),
        priceLibraryService.getSelectedQuotes(),
        quotaLibraryService.listQuotaItems(),
        quotaLibraryService.listParamRules(),
      ])

      // 填充价格库响应式数据
      priceResourceItems.splice(0, priceResourceItems.length, ...resources)
      Object.keys(selectedQuoteMap).forEach(key => delete selectedQuoteMap[key])
      Object.assign(selectedQuoteMap, quotes)

      // 填充定额库响应式数据
      quotaItems.splice(0, quotaItems.length, ...dbQuotaItems)
      Object.keys(paramRules).forEach(key => delete paramRules[key])
      Object.assign(paramRules, dbParamRules)
    } catch (error) {
      console.error('[CostManagement] 价格库/定额库加载失败，使用内置默认数据', error)
      // 降级：使用种子数据作为内存兜底
      if (priceResourceItems.length === 0) {
        // 无法从 seed-data 直接恢复 PriceResourceItem（需要 quotes），留空即可
      }
      if (quotaItems.length === 0) {
        quotaItems.splice(0, quotaItems.length, ...SEED_QUOTA_ITEMS)
        Object.assign(paramRules, SEED_PARAM_RULES)
        Object.assign(selectedQuoteMap, SEED_SELECTED_QUOTES)
      }
    }
  }

  // -----------------------------------------------------------------------
  // 预算文件管理（已落库，无需改动）
  // -----------------------------------------------------------------------

  async function loadBudgetFiles() {
    budgetFiles.value = await budgetFileService.getAll()
    budgetFilesLoaded.value = true
  }

  async function createBudgetFile(name: string, content: string) {
    const existing = budgetFiles.value.find(f => f.name === name)
    if (existing) {
      ElMessage.warning(`已存在名为 "${name}" 的预算测算文件，请换用其他名称！`)
      throw new Error(`Duplicate name: ${name}`)
    }
    const file = await budgetFileService.create(name, content)
    await loadBudgetFiles()
    return file
  }

  async function updateBudgetFile(id: number, name: string, content: string) {
    const existing = budgetFiles.value.find(f => f.name === name && f.id !== id)
    if (existing) {
      ElMessage.warning(`已存在名为 "${name}" 的预算测算文件，请换用其他名称！`)
      throw new Error(`Duplicate name: ${name}`)
    }
    await budgetFileService.update(id, name, content)
    await loadBudgetFiles()
  }

  async function deleteBudgetFile(id: number) {
    await budgetFileService.delete(id)
    await loadBudgetFiles()
  }

  async function associateProjectBudget(projectId: number, budgetFileId: number | null) {
    await budgetFileService.associateWithProject(projectId, budgetFileId)
    if (project.value && project.value.id === projectId) {
      project.value.budgetFileId = budgetFileId
    }
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx !== -1) {
      projects.value[idx].budgetFileId = budgetFileId
    }
  }

  // -----------------------------------------------------------------------
  // 价格库操作（现在写入 DB）
  // -----------------------------------------------------------------------

  function addResourceQuote(resourceId: string, quote: Omit<PriceQuote, 'id'>) {
    const item = priceResourceItems.find(i => i.id === resourceId)
    if (!item) return
    const newId = `Q-${resourceId.replace('R-', '')}-${Date.now()}`
    const newQuote: PriceQuote = {
      id: newId,
      ...quote
    }
    item.quotes.push(newQuote)
    void priceLibraryService.addQuote(resourceId, newQuote).catch(err => {
      const rollbackIndex = item.quotes.findIndex(q => q.id === newQuote.id)
      if (rollbackIndex !== -1) item.quotes.splice(rollbackIndex, 1)
      console.error('[CostManagement] 报价保存失败', err)
      ElMessage.error(getErrorMessage(err, '报价保存失败，已撤销本次新增'))
    })
    return newQuote
  }

  function removeResourceQuote(resourceId: string, quoteId: string) {
    const item = priceResourceItems.find(i => i.id === resourceId)
    if (!item) return false
    if (item.quotes.length <= 1) {
      ElMessage.warning('每个要素必须保留至少一条报价记录！')
      return false
    }
    const idx = item.quotes.findIndex(q => q.id === quoteId)
    if (idx === -1) return false
    const [removedQuote] = item.quotes.splice(idx, 1)

    // 检查被删除的是否是当前选中的活动报价
    const previousSelectedQuoteId = selectedQuoteMap[resourceId]
    if (selectedQuoteMap[resourceId] === quoteId) {
      selectedQuoteMap[resourceId] = item.quotes[0].id
      void priceLibraryService.setSelectedQuote(resourceId, item.quotes[0].id).catch(err => {
        console.error('[CostManagement] 更新选中报价失败', err)
      })
    }
    // 持久化到数据库
    void priceLibraryService.deleteQuote(quoteId).catch(err => {
      item.quotes.splice(idx, 0, removedQuote)
      if (previousSelectedQuoteId) selectedQuoteMap[resourceId] = previousSelectedQuoteId
      console.error('[CostManagement] 删除报价失败', err)
      ElMessage.error(getErrorMessage(err, '报价删除失败，已恢复原报价'))
    })
    ElMessage.success('报价记录已成功删除')
    return true
  }

  function addPriceResource(item: Omit<PriceResourceItem, 'quotes'>) {
    const existing = priceResourceItems.find(r => r.id === item.id)
    if (existing) {
      ElMessage.warning(`要素代码 "${item.id}" 已存在！`)
      return null
    }
    const newItem: PriceResourceItem = {
      ...item,
      quotes: []
    }
    priceResourceItems.push(newItem)
    
    // 同时为其创建一个默认的空报价记录，以保证有报价行可编辑
    const defaultQuote: Omit<PriceQuote, 'id'> = {
      supplier: '默认供应商报价',
      price: 0,
      taxCaliber: item.category === 'material' || item.category === 'finished' ? '含税到场' : '含税',
      deliveryPoint: item.category === 'finished' ? '项目卸料点' : '本地',
      collectedAt: new Date().toISOString().substring(0, 10),
      remark: '默认初始价格'
    }
    void (async () => {
      try {
        await priceLibraryService.createResource(item)
        addResourceQuote(newItem.id, defaultQuote)
      } catch (err) {
        const rollbackIndex = priceResourceItems.findIndex(r => r.id === newItem.id)
        if (rollbackIndex !== -1) priceResourceItems.splice(rollbackIndex, 1)
        console.error('[CostManagement] 创建价格要素失败', err)
        ElMessage.error(getErrorMessage(err, '价格要素保存失败，已撤销本次新增'))
      }
    })()
    
    return newItem
  }

  function removePriceResource(resourceId: string) {
    const idx = priceResourceItems.findIndex(r => r.id === resourceId)
    if (idx === -1) return
    const [removedResource] = priceResourceItems.splice(idx, 1)
    
    // 如果该要素在选中报价映射里，清理它
    const previousSelectedQuoteId = selectedQuoteMap[resourceId]
    if (selectedQuoteMap[resourceId]) {
      delete selectedQuoteMap[resourceId]
    }
    
    // 持久化删除到数据库
    void priceLibraryService.deleteResource(resourceId)
      .then(() => {
        ElMessage.success('价格要素已删除')
      })
      .catch(err => {
        priceResourceItems.splice(idx, 0, removedResource)
        if (previousSelectedQuoteId) selectedQuoteMap[resourceId] = previousSelectedQuoteId
        console.error('[CostManagement] 删除价格要素失败', err)
        ElMessage.error(getErrorMessage(err, '价格要素删除失败，已恢复原数据'))
      })
  }

  // -----------------------------------------------------------------------
  // 定额库操作（现在写入 DB）
  // -----------------------------------------------------------------------

  function addQuotaItem(item: Omit<QuotaItem, 'id'>) {
    const newId = `LM-${item.code.replace('NB-', '')}-${Date.now()}`
    const newQuota: QuotaItem = {
      id: newId,
      ...item
    }
    quotaItems.push(newQuota)
    
    // 初始化默认校验参数
    const defaultRules: Record<string, ParamRule> = {
      thicknessCm: { defaultVal: item.defaultThicknessCm, minValid: Math.max(0, item.defaultThicknessCm - 2), maxValid: item.defaultThicknessCm + 4, desc: '设计厚度控制规范区间', warningMsg: '厚度超出合理范围！' },
      density: { defaultVal: item.density, minValid: item.density > 0 ? 2.2 : 0, maxValid: item.density > 0 ? 2.5 : 0, desc: '设计压实密度控制区间', warningMsg: '压实密度异常！' },
      lossRate: { defaultVal: item.lossRate, minValid: 0, maxValid: 10, desc: '施工合理损耗率区间', warningMsg: '损耗率设定偏高！' },
      haulDistanceKm: { defaultVal: 15, minValid: 1, maxValid: 50, desc: '成品料或废渣合理运距', warningMsg: '运距偏离常规范围！' },
      managementRate: { defaultVal: 5, minValid: 1, maxValid: 15, desc: '管理费计取比例区间', warningMsg: '管理费计取异常！' },
      profitRate: { defaultVal: 6, minValid: 1, maxValid: 15, desc: '利润计取比例区间', warningMsg: '利润计取异常！' },
      taxRate: { defaultVal: 9, minValid: 3, maxValid: 9, desc: '建筑增值税或简易征收率', warningMsg: '税率设定不合规！' },
    }
    paramRules[newId] = defaultRules

    // 持久化到数据库
    void (async () => {
      try {
        await quotaLibraryService.createQuotaItem(newQuota)
        for (const [paramKey, rule] of Object.entries(defaultRules)) {
          await quotaLibraryService.upsertParamRule(newId, paramKey, rule)
        }
      } catch (err) {
        console.error('[CostManagement] 定额保存失败', err)
      }
    })()

    return newQuota
  }

  function updateQuotaItem(updatedItem: QuotaItem) {
    const idx = quotaItems.findIndex(q => q.id === updatedItem.id)
    if (idx !== -1) {
      quotaItems[idx] = updatedItem
    }
    // 持久化到数据库
    void quotaLibraryService.updateQuotaItem(updatedItem).catch(err => {
      console.error('[CostManagement] 定额更新失败', err)
    })
  }

  function updateParamRule(quotaId: string, paramKey: string, rule: ParamRule) {
    if (!paramRules[quotaId]) {
      paramRules[quotaId] = {}
    }
    paramRules[quotaId][paramKey] = { ...rule }
    // 持久化到数据库
    void quotaLibraryService.upsertParamRule(quotaId, paramKey, rule).catch(err => {
      console.error('[CostManagement] 参数规则更新失败', err)
    })
  }

  function removeQuotaItem(quotaId: string) {
    const idx = quotaItems.findIndex(q => q.id === quotaId)
    if (idx === -1) return
    quotaItems.splice(idx, 1)
    delete paramRules[quotaId]
    // 持久化删除到数据库
    void quotaLibraryService.deleteQuotaItem(quotaId).catch(err => {
      console.error('[CostManagement] 删除定额失败', err)
    })
    ElMessage.success('定额模板已删除')
  }

  function addParamRule(quotaId: string, paramKey: string, rule: ParamRule) {
    if (!paramRules[quotaId]) {
      paramRules[quotaId] = {}
    }
    paramRules[quotaId][paramKey] = { ...rule }
    // 持久化到数据库
    void quotaLibraryService.upsertParamRule(quotaId, paramKey, rule).catch(err => {
      console.error('[CostManagement] 增加参数规则失败', err)
    })
  }

  function removeParamRule(quotaId: string, paramKey: string) {
    if (paramRules[quotaId] && paramRules[quotaId][paramKey]) {
      delete paramRules[quotaId][paramKey]
      // 持久化删除到数据库
      void quotaLibraryService.deleteParamRule(quotaId, paramKey).catch(err => {
        console.error('[CostManagement] 删除参数规则失败', err)
      })
      ElMessage.success('参数已删除')
    }
  }

  // -----------------------------------------------------------------------
  // 选中报价变更自动持久化
  // -----------------------------------------------------------------------

  // 注意：selectedQuoteMap 在 PriceLibrary.vue 和 CostBudgetTemplatePanel.vue 中通过
  // v-model 直接修改。这里通过 watch 捕获变化并持久化。
  watch(selectedQuoteMap, (newMap) => {
    for (const [resourceId, quoteId] of Object.entries(newMap)) {
      void priceLibraryService.setSelectedQuote(resourceId, quoteId).catch(err => {
        console.error('[CostManagement] 选中报价持久化失败', err)
        ElMessage.error(getErrorMessage(err, '选中报价保存失败'))
      })
    }
  }, { deep: true })

  // -----------------------------------------------------------------------
  // 计算属性
  // -----------------------------------------------------------------------

  const costSummary = computed(() => buildProjectCostManagementSummary({
    projectId: selectedProjectId.value,
    contractAmount: contracts.value.reduce((sum, contract) => sum + Number(contract.contractAmount || 0), 0),
    settledAmount: getLatestSettledAmount(settlements.value),
    budgetEntries: budgetRows,
    actualEntries: actualRows,
  }))

  function applyCostEntries(entries: ProjectCostEntry[]) {
    budgetRows.splice(0, budgetRows.length, ...getRowsByPhase(entries, selectedProjectId.value, 'budget'))
    actualRows.splice(0, actualRows.length, ...getRowsByPhase(entries, selectedProjectId.value, 'actual'))
  }

  function resetCurrentProjectData() {
    project.value = null
    contracts.value = []
    settlements.value = []
    budgetRows.splice(0, budgetRows.length)
    actualRows.splice(0, actualRows.length)
  }

  // -----------------------------------------------------------------------
  // 页面数据加载
  // -----------------------------------------------------------------------

  async function loadPageData() {
    const queryProjectId = resolveProjectIdFromQuery(route.query.projectId)

    try {
      await withLoading(pageLoading, async () => {
        // 并行加载：项目快照 + 价格库/定额库 + 预算文件
        const [snapshot] = await Promise.all([
          loadCostManagementPage(queryProjectId),
          loadPriceAndQuotaData(),
        ])
        projects.value = snapshot.projects
        project.value = snapshot.project
        contracts.value = snapshot.contracts
        settlements.value = snapshot.settlements
        selectedProjectId.value = snapshot.project?.id ?? 0
        applyCostEntries(snapshot.costEntries)
        await loadBudgetFiles()
      })
    } catch (error) {
      resetCurrentProjectData()
      ElMessage.error(getErrorMessage(error, '成本管理数据加载失败'))
    }
  }

  // -----------------------------------------------------------------------
  // 成本台账操作（已落库，无需改动）
  // -----------------------------------------------------------------------

  function getActiveRows(phase: CostPhase) {
    return phase === 'budget' ? budgetRows : actualRows
  }

  function addCostRow(phase: CostPhase) {
    if (selectedProjectId.value <= 0) return
    getActiveRows(phase).push(createEmptyCostRow(selectedProjectId.value, phase))
  }

  function removeCostRow(phase: CostPhase, index: number) {
    getActiveRows(phase).splice(index, 1)
  }

  function recalculateCostRow(row: ProjectCostEntry) {
    row.amount = roundAmount(Number(row.quantity || 0) * Number(row.unitCost || 0))
  }

  async function saveCostPhase(phase: CostPhase) {
    if (selectedProjectId.value <= 0) return
    const rows = getActiveRows(phase)
    const saving = phase === 'budget' ? budgetSaving : actualSaving

    try {
      await withLoading(saving, async () => {
        const result = await saveCostManagementPhase(selectedProjectId.value, phase, rows)
        if (result.type === 'warning') {
          ElMessage.warning(result.message)
          return
        }

        const targetRows = getActiveRows(phase)
        targetRows.splice(0, targetRows.length, ...getRowsByPhase(result.data, selectedProjectId.value, phase))
        ElMessage.success(result.successMessage)
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '成本保存失败'))
    }
  }

  function selectProject(projectId: number) {
    const nextProjectId = Number(projectId || 0)
    if (nextProjectId <= 0) return
    void router.replace({
      path: '/costs',
      query: { projectId: String(nextProjectId) },
    })
  }

  async function createDraftProject(code: string, name: string, location: string) {
    try {
      const newProj = await projectService.create({
        code,
        name,
        projectType: 'highway',
        location,
        ownerUnit: '',
        generalContractor: '',
        startDate: new Date().toISOString().substring(0, 10),
        plannedEndDate: new Date().toISOString().substring(0, 10),
        status: 'preparing'
      })
      projects.value.unshift(newProj)
      return newProj
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '新建意向项目失败'))
      throw error
    }
  }

  watch(
    () => route.query.projectId,
    () => {
      void loadPageData()
    },
    { immediate: true },
  )

  return {
    projects,
    project,
    selectedProjectId,
    pageLoading,
    budgetRows,
    actualRows,
    budgetSaving,
    actualSaving,
    costSummary,
    addCostRow,
    removeCostRow,
    recalculateCostRow,
    saveCostPhase,
    selectProject,
    createDraftProject,
    // 预算文件状态与方法
    budgetFiles,
    budgetFilesLoaded,
    loadBudgetFiles,
    createBudgetFile,
    updateBudgetFile,
    deleteBudgetFile,
    associateProjectBudget,
    // 价格库与定额库状态与方法
    priceResourceItems,
    selectedQuoteMap,
    addPriceResource,
    removePriceResource,
    addResourceQuote,
    removeResourceQuote,
    quotaItems,
    paramRules,
    addQuotaItem,
    updateQuotaItem,
    removeQuotaItem,
    updateParamRule,
    addParamRule,
    removeParamRule,
  }
}
