<template>
  <div class="actual-quota-analysis-panel">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="8" :lg="8" :xl="8">
        <el-card class="box-card mb-4" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="font-bold text-lg">1. 选择实际消耗项目</span>
            </div>
          </template>

          <div v-loading="loadingProjects" class="project-pool-section">
            <el-select
              v-model="selectedProjectIds"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择参与计算的项目"
              class="w-full mb-3"
            >
              <el-option
                v-for="proj in projectPool"
                :key="proj.id"
                :label="`${proj.code} ${proj.name}`"
                :value="proj.id"
              />
            </el-select>

            <div class="project-actions mb-3">
              <el-button size="small" @click="selectAllProjects">全选有效项目</el-button>
              <el-button size="small" @click="clearProjectSelection">清空</el-button>
            </div>

            <el-empty
              v-if="projectPool.length === 0 && !loadingProjects"
              description="暂无实际成本台账数据"
              :image-size="80"
            />

            <div v-else class="project-list">
              <div
                v-for="proj in projectPool"
                :key="proj.id"
                class="project-pool-item p-3 mb-2 border rounded-lg"
                :class="{ 'border-primary bg-primary-light': proj.selected }"
              >
                <div class="project-item-head">
                  <el-checkbox
                    :model-value="proj.selected"
                    @change="(val: any) => setProjectSelected(proj, Boolean(val))"
                  >
                    <span class="font-semibold text-gray-800">{{ proj.name }}</span>
                  </el-checkbox>

                  <el-tag :type="getScaleTagType(proj.contractAmount)" size="small">
                    {{ getScaleText(proj.contractAmount) }}
                  </el-tag>
                </div>

                <div class="project-meta-details mt-2 text-xs text-gray-600">
                  <div>合同金额: ¥{{ formatNumber(proj.contractAmount) }}</div>
                  <div>实际成本: ¥{{ formatNumber(proj.actualCostAmount) }}</div>
                  <div>结算产出: {{ formatQuantity(proj.settledQuantity) }}</div>
                  <div>设计产出: {{ formatQuantity(proj.designQuantity) }}</div>
                </div>

                <div class="project-output-row mt-2">
                  <span class="text-xs text-gray-600">计算面积/产出</span>
                  <el-input-number
                    v-model="proj.outputQuantity"
                    size="small"
                    :min="0"
                    :precision="3"
                    :controls="false"
                    class="output-input"
                    @change="handleAnalysisSettingChange"
                  />
                </div>

                <div class="project-output-meta mt-2 text-xs">
                  <span>来源: {{ getOutputSourceText(proj.outputSource) }}</span>
                  <span>台账: {{ proj.actualCostCount }} 条</span>
                  <span>难度:</span>
                  <el-select
                    v-model="proj.difficulty"
                    size="small"
                    class="difficulty-select"
                    @change="(val: any) => handleDifficultyChange(proj, val)"
                  >
                    <el-option label="简单" value="easy" />
                    <el-option label="中等" value="medium" />
                    <el-option label="困难" value="hard" />
                  </el-select>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="box-card mb-4" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="font-bold text-lg">2. 结构与工序模块</span>
            </div>
          </template>

          <el-form label-position="top">
            <el-form-item label="参考模板（可选）">
              <el-select
                v-model="selectedReferenceQuotaId"
                clearable
                filterable
                placeholder="仅继承单位、厚度、密度等模板信息"
                class="w-full"
                @change="handleReferenceQuotaChange"
              >
                <el-option
                  v-for="item in quotaItems"
                  :key="item.id"
                  :label="`[${item.code}] ${item.name} (${item.baseUnit})`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="分析计量单位">
              <el-radio-group v-model="measurementUnit" @change="handleAnalysisSettingChange">
                <el-radio-button label="m2">m2</el-radio-button>
                <el-radio-button label="m3">m3</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="沥青结构">
              <el-radio-group v-model="structureType" @change="handleStructureTypeChange">
                <el-radio-button label="single">单层</el-radio-button>
                <el-radio-button label="double">两层</el-radio-button>
                <el-radio-button label="triple">三层</el-radio-button>
                <el-radio-button label="custom">自定义</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>

          <div class="layer-config">
            <div class="section-line-head">
              <span>层结构权重</span>
              <el-button v-if="structureType === 'custom'" size="small" @click="addCustomLayer">添加层</el-button>
            </div>
            <div
              v-for="layer in activeLayers"
              :key="layer.id"
              class="layer-config-row"
            >
              <el-input
                v-model="layer.name"
                size="small"
                class="layer-name-input"
                :disabled="structureType !== 'custom'"
                @change="handleAnalysisSettingChange"
              />
              <el-input-number
                v-model="layer.weight"
                size="small"
                :min="0"
                :precision="1"
                :controls="false"
                class="layer-weight-input"
                @change="handleAnalysisSettingChange"
              />
              <span class="layer-weight-ratio">{{ formatPercent(getNormalizedLayerWeight(layer.id)) }}</span>
              <el-button
                v-if="structureType === 'custom' && activeLayers.length > 1"
                link
                type="danger"
                size="small"
                @click="removeLayer(layer.id)"
              >
                删除
              </el-button>
            </div>
          </div>

          <div class="process-module-picker mt-3">
            <div class="section-line-head">
              <span>本项目发生的工序</span>
            </div>
            <el-checkbox-group v-model="selectedModuleIds" class="process-module-list" @change="handleModuleSelectionChange">
              <el-checkbox
                v-for="module in PROCESS_MODULES"
                :key="module.id"
                :label="module.id"
              >
                {{ module.name }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </el-card>

        <el-card class="box-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="font-bold text-lg">分析概览</span>
            </div>
          </template>

          <el-descriptions :column="1" border size="small" class="analysis-summary">
            <el-descriptions-item label="参与项目">{{ selectedProjectsCount }} 个</el-descriptions-item>
            <el-descriptions-item label="总产出量">
              {{ formatQuantity(totalOutput) }} {{ measurementUnit }}
            </el-descriptions-item>
            <el-descriptions-item label="工序模块">
              {{ activeProcessModules.length }} 个
            </el-descriptions-item>
            <el-descriptions-item label="模板成分">
              {{ templateConsumptionResults.length }} 项
            </el-descriptions-item>
            <el-descriptions-item label="概算金额">
              ¥{{ formatNumber(totalActualCost) }}
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="categoryCostBreakdown.length > 0" class="rough-cost-reference mt-3">
            <div class="rough-cost-reference__title">金额概算参考</div>
            <div class="rough-cost-reference__note">按每100万元实际成本折算，不参与定额消耗计算。</div>
            <div class="rough-cost-reference__grid">
              <div
                v-for="item in categoryCostBreakdown"
                :key="item.category"
                class="rough-cost-reference__item"
              >
                <span>{{ item.label }}</span>
                <strong>{{ formatPercent(item.ratio) }}</strong>
                <small>约 {{ formatNumber(item.perMillion) }} 元 / 100万元</small>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="16" :lg="16" :xl="16">
        <el-card v-if="selectedProjectsCount === 0" class="box-card text-center py-20" shadow="hover">
          <el-empty description="请选择至少一个有实际台账的项目" />
        </el-card>

        <div v-else class="right-pane">
          <el-card class="box-card mb-4" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="font-bold text-lg">3. 资源归集与分摊规则</span>
              </div>
            </template>

            <el-alert
              v-if="invalidOutputProjects.length > 0"
              type="warning"
              show-icon
              :closable="false"
              class="mb-3"
              :title="`有 ${invalidOutputProjects.length} 个项目产出量为 0，保存前需要补齐。`"
            />

            <div v-if="totalOutput <= 0" class="py-10 text-center text-gray-500">
              已选项目缺少计算产出量，无法形成单位消耗。
            </div>

            <div v-else class="mapping-table-container">
              <el-table :data="calculationResults" style="width: 100%" border stripe>
                <el-table-column type="expand">
                  <template #default="props">
                    <div class="p-3 bg-gray-50">
                      <div class="font-bold text-xs text-gray-600 mb-2">
                        项目计算支撑明细
                      </div>
                      <el-table :data="props.row.details" size="small" border>
                        <el-table-column prop="projectName" label="项目名称" min-width="160" />
                        <el-table-column label="项目产出量" width="120" align="right">
                          <template #default="scope">
                            {{ formatQuantity(scope.row.projectOutput) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="消耗数量" width="120" align="right">
                          <template #default="scope">
                            {{ formatQuantity(scope.row.quantity) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="消耗金额" width="120" align="right">
                          <template #default="scope">
                            ¥{{ formatNumber(scope.row.amount) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="单产消耗" width="120" align="right">
                          <template #default="scope">
                            {{ formatRatioNumber(scope.row.consumption) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="实际单价" width="120" align="right">
                          <template #default="scope">
                            ¥{{ formatNumber(scope.row.price) }}
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                  </template>
                </el-table-column>

                <el-table-column label="成本资源" min-width="210">
                  <template #default="scope">
                    <div class="font-bold text-gray-800">{{ scope.row.name }}</div>
                    <div v-if="scope.row.spec" class="text-xs text-gray-500 mt-1">{{ scope.row.spec }}</div>
                    <el-tag :type="getCategoryTag(scope.row.category)" size="small" class="mt-1">
                      {{ getCategoryText(scope.row.category) }}
                    </el-tag>
                  </template>
                </el-table-column>

                <el-table-column label="归属工序" width="170">
                  <template #default="scope">
                    <el-select
                      v-if="resourceRules[scope.row.key]"
                      v-model="resourceRules[scope.row.key].moduleId"
                      size="small"
                      class="w-full"
                      @change="handleAnalysisSettingChange"
                    >
                      <el-option
                        v-for="module in activeProcessModules"
                        :key="module.id"
                        :label="module.name"
                        :value="module.id"
                      />
                    </el-select>
                    <span v-else class="text-xs text-gray-500">待匹配</span>
                  </template>
                </el-table-column>

                <el-table-column label="分摊方式" width="160">
                  <template #default="scope">
                    <el-select
                      v-if="resourceRules[scope.row.key]"
                      v-model="resourceRules[scope.row.key].allocationMode"
                      size="small"
                      class="w-full"
                      @change="handleAnalysisSettingChange"
                    >
                      <el-option label="工序综合" value="overall" />
                      <el-option label="按层权重拆分" value="layerWeight" />
                    </el-select>
                    <span v-else class="text-xs text-gray-500">待匹配</span>
                  </template>
                </el-table-column>

                <el-table-column prop="unit" label="单位" width="70" align="center" />

                <el-table-column label="总消耗量" width="110" align="right">
                  <template #default="scope">
                    {{ formatQuantity(scope.row.totalQuantity) }}
                  </template>
                </el-table-column>

                <el-table-column label="单位消耗" width="120" align="right">
                  <template #default="scope">
                    <div class="font-bold text-gray-800">
                      {{ formatRatioNumber(scope.row.actualConsumption) }}
                    </div>
                  </template>
                </el-table-column>

                <el-table-column label="实际单价" width="110" align="right">
                  <template #default="scope">
                    ¥{{ formatNumber(scope.row.actualPrice) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>

          <el-card v-if="totalOutput > 0" class="box-card mb-4" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="font-bold text-lg">4. 工序消耗模板预览</span>
              </div>
            </template>

            <el-table :data="templateConsumptionResults" style="width: 100%" border stripe>
              <el-table-column prop="moduleName" label="工序模块" min-width="150" />
              <el-table-column prop="layerName" label="结构层" width="120" />
              <el-table-column label="资源" min-width="190">
                <template #default="scope">
                  <div class="font-bold text-gray-800">{{ scope.row.resourceName }}</div>
                  <div v-if="scope.row.spec" class="text-xs text-gray-500 mt-1">{{ scope.row.spec }}</div>
                </template>
              </el-table-column>
              <el-table-column label="类别" width="80" align="center">
                <template #default="scope">
                  <el-tag :type="getCategoryTag(scope.row.category)" size="small">
                    {{ getCategoryText(scope.row.category) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="70" align="center" />
              <el-table-column label="模板消耗" width="130" align="right">
                <template #default="scope">
                  {{ formatRatioNumber(scope.row.consumption) }}
                </template>
              </el-table-column>
              <el-table-column label="依据" min-width="210">
                <template #default="scope">
                  {{ scope.row.sourceText }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card v-if="totalOutput > 0" class="box-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="font-bold text-lg">5. 保存工序消耗模板</span>
              </div>
            </template>

            <el-form :model="saveForm" :rules="saveRules" ref="saveFormRef" label-width="120px" class="max-w-xl">
              <el-form-item label="新模板编码" prop="code">
                <el-input v-model="saveForm.code" placeholder="例如: ACT-PAVE-20260703" />
              </el-form-item>
              <el-form-item label="新模板名称" prop="name">
                <el-input v-model="saveForm.name" placeholder="例如: 沥青路面三层结构工序消耗模板" />
              </el-form-item>
              <el-form-item label="口径描述" prop="caliber">
                <el-input v-model="saveForm.caliber" type="textarea" :rows="4" />
              </el-form-item>

              <div class="ml-28 mb-4 text-xs text-gray-500 bg-gray-50 p-3 rounded border">
                <strong>追溯信息：</strong>
                <ul class="support-list mt-1">
                  <li v-for="p in selectedProjects" :key="p.id">
                    {{ p.name }}（{{ getScaleText(p.contractAmount) }} | {{ getDifficultyText(p.difficulty) }} | 产出量:
                    {{ formatQuantity(p.outputQuantity) }} {{ measurementUnit }}）
                  </li>
                </ul>
              </div>

              <el-form-item>
                <el-button type="primary" :loading="savingQuota" @click="handleSaveSyntheticQuota">
                  保存并同步到定额库
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { quotaLibraryService } from '@/services/quota-library.service'
import { projectService } from '@/services/project.service'
import { systemSettingsService } from '@/services/system-settings.service'
import type {
  ActualConsumptionCostResource,
  ActualConsumptionOutputSource,
  ActualConsumptionProject,
} from '@/services/quota-library.service'
import type { Project } from '@/types'
import type { QuotaComponent, QuotaItem } from '@/types/quota-library.types'

type MeasurementUnit = QuotaItem['baseUnit']
type ProjectPoolItem = ActualConsumptionProject & { selected: boolean }
type StructureType = 'single' | 'double' | 'triple' | 'custom'
type ProcessModuleId = typeof PROCESS_MODULES[number]['id']
type AllocationMode = 'overall' | 'layerWeight'

interface LayerConfig {
  id: string
  name: string
  weight: number
}

interface ResourceRule {
  moduleId: ProcessModuleId
  allocationMode: AllocationMode
}

interface CalculationDetail {
  projectId: number
  projectName: string
  projectOutput: number
  quantity: number
  amount: number
  consumption: number
  price: number
}

interface CalculationResult {
  id: string
  key: string
  category: string
  name: string
  spec: string
  unit: string
  totalQuantity: number
  totalAmount: number
  actualConsumption: number
  actualPrice: number
  projectCount: number
  entryCount: number
  details: CalculationDetail[]
}

interface TemplateConsumptionResult {
  id: string
  sourceKey: string
  moduleId: ProcessModuleId
  moduleName: string
  layerId: string
  layerName: string
  category: QuotaComponent['category']
  resourceName: string
  spec: string
  unit: string
  consumption: number
  price: number
  totalQuantity: number
  allocationMode: AllocationMode
  sourceText: string
}

const PROCESS_MODULES = [
  { id: 'cleaning', name: '施工准备/清扫', keyword: /清扫|吹尘|清理|准备/ },
  { id: 'coat', name: '粘层/透层/封层', keyword: /粘层|透层|封层|洒布|乳化沥青/ },
  { id: 'paving', name: '沥青摊铺成型', keyword: /沥青|混合料|摊铺|碾压|压路|摊铺机/ },
  { id: 'milling', name: '铣刨/旧路处理', keyword: /铣刨|旧路|破除|挖除/ },
  { id: 'transport', name: '运输/倒运', keyword: /运输|倒运|运费|车辆|自卸/ },
  { id: 'support', name: '交通维护/零星配合', keyword: /交通|维护|零星|配合|安全/ },
] as const

const STRUCTURE_PRESETS: Record<Exclude<StructureType, 'custom'>, LayerConfig[]> = {
  single: [
    { id: 'surface', name: '沥青面层', weight: 100 },
  ],
  double: [
    { id: 'upper', name: '上面层', weight: 50 },
    { id: 'lower', name: '下面层', weight: 50 },
  ],
  triple: [
    { id: 'upper', name: '上面层', weight: 34 },
    { id: 'middle', name: '中面层', weight: 33 },
    { id: 'lower', name: '下面层', weight: 33 },
  ],
}

const props = defineProps<{
  quotaItems: QuotaItem[]
  projects: Project[]
}>()

const emit = defineEmits<{
  (e: 'refresh-quotas'): void
}>()

const projectPool = ref<ProjectPoolItem[]>([])
const loadingProjects = ref(false)
const savingQuota = ref(false)
const measurementUnit = ref<MeasurementUnit>('m2')
const selectedReferenceQuotaId = ref('')
const structureType = ref<StructureType>('triple')
const layerConfigs = ref<LayerConfig[]>(cloneLayers(STRUCTURE_PRESETS.triple))
const selectedModuleIds = ref<ProcessModuleId[]>(['paving'])
const resourceRules = reactive<Record<string, ResourceRule>>({})
const scaleThresholds = ref({ small: 5000000, large: 20000000 })

const saveFormRef = ref<FormInstance | null>(null)
const saveForm = reactive({
  code: '',
  name: '',
  caliber: '',
})

const lastAutoDefaults = reactive({
  code: '',
  name: '',
  caliber: '',
})

const saveRules = {
  code: [
    { required: true, message: '请输入模板编码', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]+$/, message: '模板编码只能包含字母、数字、下划线和连字符', trigger: 'blur' },
  ],
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
  ],
}

const selectedReferenceQuota = computed(() => {
  if (!selectedReferenceQuotaId.value) return null
  return props.quotaItems.find(item => item.id === selectedReferenceQuotaId.value) || null
})

const selectedProjectIds = computed<number[]>({
  get() {
    return projectPool.value.filter(project => project.selected).map(project => project.id)
  },
  set(ids) {
    const selected = new Set(ids.map(id => Number(id)))
    for (const project of projectPool.value) {
      project.selected = selected.has(project.id)
    }
    handleAnalysisSettingChange()
  },
})

const selectedProjects = computed(() => projectPool.value.filter(project => project.selected))
const validSelectedProjects = computed(() => selectedProjects.value.filter(project => Number(project.outputQuantity || 0) > 0))
const invalidOutputProjects = computed(() => selectedProjects.value.filter(project => Number(project.outputQuantity || 0) <= 0))

const selectedProjectsCount = computed(() => selectedProjects.value.length)
const totalOutput = computed(() => validSelectedProjects.value.reduce((sum, project) => sum + Number(project.outputQuantity || 0), 0))
const totalActualCost = computed(() => selectedProjects.value.reduce((sum, project) => sum + Number(project.actualCostAmount || 0), 0))
const activeLayers = computed(() => layerConfigs.value.filter(layer => layer.weight >= 0))
const activeProcessModules = computed(() => PROCESS_MODULES.filter(module => selectedModuleIds.value.includes(module.id)))
const normalizedLayerWeights = computed(() => {
  const total = activeLayers.value.reduce((sum, layer) => sum + Number(layer.weight || 0), 0)
  if (total <= 0) {
    const equal = activeLayers.value.length > 0 ? 1 / activeLayers.value.length : 0
    return new Map(activeLayers.value.map(layer => [layer.id, equal]))
  }
  return new Map(activeLayers.value.map(layer => [layer.id, Number(layer.weight || 0) / total]))
})

const categoryCostBreakdown = computed(() => {
  const total = totalActualCost.value
  if (total <= 0) return []

  const categoryAmounts = new Map<string, number>()
  for (const project of selectedProjects.value) {
    for (const cost of project.actualCosts) {
      const category = normalizeQuotaCategory(cost.category)
      categoryAmounts.set(category, (categoryAmounts.get(category) || 0) + Number(cost.amount || 0))
    }
  }

  return Array.from(categoryAmounts.entries())
    .map(([category, amount]) => {
      const ratio = amount / total
      return {
        category,
        label: getCategoryText(category),
        amount,
        ratio,
        perMillion: ratio * 1000000,
      }
    })
    .sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category))
})

const calculationResults = computed<CalculationResult[]>(() => {
  const output = totalOutput.value
  if (output <= 0) return []

  const groups = new Map<string, {
    key: string
    category: string
    name: string
    spec: string
    unit: string
    totalQuantity: number
    totalAmount: number
    entryCount: number
    projectIds: Set<number>
    details: CalculationDetail[]
  }>()

  for (const project of validSelectedProjects.value) {
    for (const cost of project.actualCosts) {
      const key = buildResourceKey(cost)
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          category: cost.category || 'other',
          name: cost.itemName || '未命名成本项',
          spec: cost.spec || '',
          unit: cost.unit || '',
          totalQuantity: 0,
          totalAmount: 0,
          entryCount: 0,
          projectIds: new Set<number>(),
          details: [],
        })
      }

      const group = groups.get(key)!
      const quantity = Number(cost.quantity || 0)
      const amount = Number(cost.amount || 0)
      const projectOutput = Number(project.outputQuantity || 0)

      group.totalQuantity += quantity
      group.totalAmount += amount
      group.entryCount += Number(cost.entryCount || 0)
      group.projectIds.add(project.id)
      group.details.push({
        projectId: project.id,
        projectName: project.name,
        projectOutput,
        quantity,
        amount,
        consumption: projectOutput > 0 ? quantity / projectOutput : 0,
        price: quantity > 0 ? amount / quantity : 0,
      })
    }
  }

  return Array.from(groups.values())
    .map((group, index) => ({
      id: `actual-${index + 1}`,
      key: group.key,
      category: group.category,
      name: group.name,
      spec: group.spec,
      unit: group.unit,
      totalQuantity: group.totalQuantity,
      totalAmount: group.totalAmount,
      actualConsumption: group.totalQuantity > 0 ? group.totalQuantity / output : 0,
      actualPrice: group.totalQuantity > 0 ? group.totalAmount / group.totalQuantity : 0,
      projectCount: group.projectIds.size,
      entryCount: group.entryCount,
      details: group.details,
    }))
    .sort((a, b) => {
      const categoryDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category)
      if (categoryDiff !== 0) return categoryDiff
      return `${a.name}${a.spec}`.localeCompare(`${b.name}${b.spec}`)
    })
})

const templateConsumptionResults = computed<TemplateConsumptionResult[]>(() => {
  const rows: TemplateConsumptionResult[] = []
  for (const result of calculationResults.value) {
    const rule = resourceRules[result.key] || buildDefaultRule(result)
    const module = getProcessModule(rule.moduleId)
    const category = normalizeQuotaCategory(result.category)
    const canSplitByLayer = rule.allocationMode === 'layerWeight' && activeLayers.value.length > 1

    if (canSplitByLayer) {
      for (const layer of activeLayers.value) {
        const weight = getNormalizedLayerWeight(layer.id)
        rows.push({
          id: `${result.key}-${layer.id}`,
          sourceKey: result.key,
          moduleId: module.id,
          moduleName: module.name,
          layerId: layer.id,
          layerName: layer.name,
          category,
          resourceName: result.name,
          spec: result.spec,
          unit: result.unit,
          consumption: result.actualConsumption * weight,
          price: result.actualPrice,
          totalQuantity: result.totalQuantity * weight,
          allocationMode: 'layerWeight',
          sourceText: `由总消耗按主管权重 ${formatPercent(weight)} 分摊`,
        })
      }
      continue
    }

    rows.push({
      id: `${result.key}-overall`,
      sourceKey: result.key,
      moduleId: module.id,
      moduleName: module.name,
      layerId: 'overall',
      layerName: '全结构',
      category,
      resourceName: result.name,
      spec: result.spec,
      unit: result.unit,
      consumption: result.actualConsumption,
      price: result.actualPrice,
      totalQuantity: result.totalQuantity,
      allocationMode: 'overall',
      sourceText: '项目真实总量形成工序综合消耗',
    })
  }

  return rows.sort((a, b) => {
    const moduleDiff = selectedModuleIds.value.indexOf(a.moduleId) - selectedModuleIds.value.indexOf(b.moduleId)
    if (moduleDiff !== 0) return moduleDiff
    const layerDiff = getLayerOrder(a.layerId) - getLayerOrder(b.layerId)
    if (layerDiff !== 0) return layerDiff
    return `${a.resourceName}${a.spec}`.localeCompare(`${b.resourceName}${b.spec}`)
  })
})

onMounted(async () => {
  await Promise.all([
    loadProjectPool(),
    loadScaleThresholds(),
  ])
})

watch(() => props.projects.length, () => {
  void loadProjectPool()
})

watch(calculationResults, (results) => {
  ensureResourceRules(results)
}, { immediate: true })

watch([selectedProjectsCount, totalOutput, measurementUnit, selectedReferenceQuotaId, structureType], () => {
  syncDefaultSaveForm()
})

async function loadScaleThresholds() {
  try {
    scaleThresholds.value = await systemSettingsService.getProjectScaleThresholds()
  } catch (error) {
    console.warn('[ActualQuota] Failed to load scale thresholds', error)
  }
}

async function loadProjectPool() {
  loadingProjects.value = true
  try {
    const selectedBefore = new Set(selectedProjectIds.value)
    const data = await quotaLibraryService.getActualConsumptionProjectPool()
    projectPool.value = data.map(project => ({
      ...project,
      selected: selectedBefore.has(project.id),
    }))
    syncDefaultSaveForm(true)
  } catch (error) {
    console.error(error)
    ElMessage.error('获取实际消耗项目池失败')
  } finally {
    loadingProjects.value = false
  }
}

function selectAllProjects() {
  for (const project of projectPool.value) {
    project.selected = Number(project.outputQuantity || 0) > 0
  }
  handleAnalysisSettingChange()
}

function clearProjectSelection() {
  for (const project of projectPool.value) {
    project.selected = false
  }
  handleAnalysisSettingChange()
}

function setProjectSelected(project: ProjectPoolItem, selected: boolean) {
  project.selected = selected
  handleAnalysisSettingChange()
}

function handleAnalysisSettingChange() {
  syncDefaultSaveForm()
}

function handleReferenceQuotaChange() {
  if (selectedReferenceQuota.value) {
    measurementUnit.value = selectedReferenceQuota.value.baseUnit
  }
  handleAnalysisSettingChange()
}

function handleStructureTypeChange(value: string | number | boolean | undefined) {
  if (value !== 'single' && value !== 'double' && value !== 'triple' && value !== 'custom') return
  if (value !== 'custom') {
    layerConfigs.value = cloneLayers(STRUCTURE_PRESETS[value])
  }
  handleAnalysisSettingChange()
}

function handleModuleSelectionChange() {
  if (selectedModuleIds.value.length === 0) {
    selectedModuleIds.value = ['paving']
  }

  for (const rule of Object.values(resourceRules)) {
    if (!selectedModuleIds.value.includes(rule.moduleId)) {
      rule.moduleId = selectedModuleIds.value[0]
    }
  }
  handleAnalysisSettingChange()
}

function addCustomLayer() {
  const nextIndex = layerConfigs.value.length + 1
  layerConfigs.value.push({
    id: `custom-${Date.now()}-${nextIndex}`,
    name: `自定义层${nextIndex}`,
    weight: 100,
  })
  handleAnalysisSettingChange()
}

function removeLayer(id: string) {
  layerConfigs.value = layerConfigs.value.filter(layer => layer.id !== id)
  handleAnalysisSettingChange()
}

async function handleDifficultyChange(project: ProjectPoolItem, value: 'easy' | 'medium' | 'hard') {
  try {
    await projectService.update(project.id, { difficulty: value })
    project.difficulty = value
    ElMessage.success(`项目「${project.name}」的难度已保存为: ${getDifficultyText(value)}`)
  } catch (error) {
    console.error(error)
    ElMessage.error('更新项目难度失败')
  }
}

async function handleSaveSyntheticQuota() {
  if (!saveFormRef.value) return
  const valid = await saveFormRef.value.validate().catch(() => false)
  if (!valid) return

  if (selectedProjectsCount.value === 0) {
    ElMessage.warning('请先选择至少一个项目参与计算')
    return
  }

  if (invalidOutputProjects.value.length > 0) {
    ElMessage.warning('已选项目存在产出量为 0 的记录，请补齐后再保存')
    return
  }

  const components = templateConsumptionResults.value
    .filter(result => result.consumption > 0)
    .map((result, index): QuotaComponent => ({
      id: buildComponentId(result, index),
      category: result.category,
      name: buildComponentName(result),
      unit: result.unit,
      basis: measurementUnit.value === 'm2' ? 'area' : 'baseUnit',
      consumption: Number(result.consumption.toFixed(6)),
      price: Number(result.price.toFixed(2)),
      formula: buildFormula(result),
    }))

  if (components.length === 0) {
    ElMessage.warning('已选项目缺少可计算数量的实际消耗明细')
    return
  }

  savingQuota.value = true
  try {
    const reference = selectedReferenceQuota.value
    const newQuotaItem: QuotaItem = {
      id: `ACT-${Date.now()}`,
      code: saveForm.code,
      name: saveForm.name,
      baseUnit: measurementUnit.value,
      defaultThicknessCm: reference?.defaultThicknessCm ?? 0,
      density: reference?.density ?? 0,
      lossRate: reference?.lossRate ?? 0,
      caliber: saveForm.caliber || buildDefaultCaliber(),
      components,
      projectPoolJson: selectedProjects.value.map(project => project.id),
    }

    await quotaLibraryService.saveSyntheticQuota(newQuotaItem)
    ElMessage.success('工序消耗模板已生成并同步至定额库')
    emit('refresh-quotas')
  } catch (error) {
    console.error(error)
    ElMessage.error('保存工序消耗模板失败')
  } finally {
    savingQuota.value = false
  }
}

function ensureResourceRules(results: CalculationResult[]) {
  const validKeys = new Set(results.map(result => result.key))
  for (const key of Object.keys(resourceRules)) {
    if (!validKeys.has(key)) delete resourceRules[key]
  }

  for (const result of results) {
    if (resourceRules[result.key]) continue
    const rule = buildDefaultRule(result)
    if (!selectedModuleIds.value.includes(rule.moduleId)) {
      selectedModuleIds.value.push(rule.moduleId)
    }
    resourceRules[result.key] = rule
  }
}

function buildDefaultRule(result: CalculationResult): ResourceRule {
  const moduleId = inferProcessModule(result)
  return {
    moduleId,
    allocationMode: 'overall',
  }
}

function inferProcessModule(result: Pick<CalculationResult, 'name' | 'spec' | 'category'>): ProcessModuleId {
  const text = `${result.name} ${result.spec} ${result.category}`
  const found = PROCESS_MODULES.find(module => module.keyword.test(text))
  return found?.id || 'paving'
}

function getProcessModule(id: ProcessModuleId) {
  return PROCESS_MODULES.find(module => module.id === id) || PROCESS_MODULES[2]
}

function cloneLayers(layers: LayerConfig[]): LayerConfig[] {
  return layers.map(layer => ({ ...layer }))
}

function getNormalizedLayerWeight(layerId: string): number {
  return normalizedLayerWeights.value.get(layerId) || 0
}

function getLayerOrder(layerId: string): number {
  if (layerId === 'overall') return 0
  const idx = activeLayers.value.findIndex(layer => layer.id === layerId)
  return idx === -1 ? 99 : idx + 1
}

function buildResourceKey(cost: ActualConsumptionCostResource): string {
  return [
    cost.category || 'other',
    cost.itemName || '',
    cost.spec || '',
    cost.unit || '',
  ].join('||')
}

function buildComponentId(result: TemplateConsumptionResult, index: number): string {
  const base = sanitizeCode(`${result.moduleName}-${result.layerName}-${result.resourceName}-${result.unit}`)
  return `${base || 'ACT-COMP'}-${index + 1}`
}

function buildComponentName(result: TemplateConsumptionResult): string {
  const layer = result.layerId === 'overall' ? '' : `${result.layerName}-`
  return `${result.moduleName}-${layer}${result.resourceName}`
}

function buildFormula(result: TemplateConsumptionResult): string {
  const splitText = result.allocationMode === 'layerWeight'
    ? `分摊方式: 按层权重; ${result.sourceText}`
    : '分摊方式: 工序综合'
  return `工序: ${result.moduleName}; 结构层: ${result.layerName}; ${splitText}; 实际总量: ${formatQuantity(result.totalQuantity)} ${result.unit}; 总产出: ${formatQuantity(totalOutput.value)} ${measurementUnit.value}。`
}

function normalizeQuotaCategory(category: string): QuotaComponent['category'] {
  if (category === 'labor' || category === 'material' || category === 'machine') return category
  return 'other'
}

function syncDefaultSaveForm(force = false) {
  const nextDefaults = {
    code: buildDefaultCode(),
    name: buildDefaultName(),
    caliber: buildDefaultCaliber(),
  }

  if (force || !saveForm.code || saveForm.code === lastAutoDefaults.code) saveForm.code = nextDefaults.code
  if (force || !saveForm.name || saveForm.name === lastAutoDefaults.name) saveForm.name = nextDefaults.name
  if (force || !saveForm.caliber || saveForm.caliber === lastAutoDefaults.caliber) saveForm.caliber = nextDefaults.caliber

  Object.assign(lastAutoDefaults, nextDefaults)
}

function buildDefaultCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (selectedProjects.value.length === 1) {
    return `ACT-${sanitizeCode(selectedProjects.value[0].code || selectedProjects.value[0].name) || 'PROJECT'}-${date}`
  }
  return `ACT-PAVE-${date}`
}

function buildDefaultName(): string {
  const structureText = getStructureText(structureType.value)
  if (selectedReferenceQuota.value) {
    return `${selectedReferenceQuota.value.name} 工序消耗模板`
  }
  return `沥青路面${structureText}工序消耗模板`
}

function buildDefaultCaliber(): string {
  if (selectedProjects.value.length === 0) {
    return '依据所选项目实际成本台账生成，按实际消耗数量除以工程量产出形成单位消耗。'
  }
  const names = selectedProjects.value.map(project => project.name).join('、')
  const modules = activeProcessModules.value.map(module => module.name).join('、')
  const layers = activeLayers.value.map(layer => `${layer.name}${formatPercent(getNormalizedLayerWeight(layer.id))}`).join('、')
  return `依据 ${names} 实际成本台账，结构口径为${getStructureText(structureType.value)}，工序模块为 ${modules}，层权重为 ${layers}。汇总产出量 ${formatQuantity(totalOutput.value)} ${measurementUnit.value}；材料以实际耗用进入工序，人机默认形成结构综合消耗，可按主管权重拆层。`
}

function sanitizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function getCategoryOrder(category: string): number {
  const order: Record<string, number> = {
    labor: 1,
    material: 2,
    machine: 3,
    other: 4,
  }
  return order[category] || 99
}

function getScale(contractAmount: number): 'small' | 'medium' | 'large' {
  const small = scaleThresholds.value.small
  const large = scaleThresholds.value.large
  if (contractAmount < small) return 'small'
  if (contractAmount > large) return 'large'
  return 'medium'
}

function getScaleText(contractAmount: number): string {
  const scale = getScale(contractAmount)
  if (scale === 'small') return '小型'
  if (scale === 'large') return '大型'
  return '中型'
}

function getScaleTagType(contractAmount: number): 'info' | 'primary' | 'success' {
  const scale = getScale(contractAmount)
  if (scale === 'small') return 'info'
  if (scale === 'large') return 'success'
  return 'primary'
}

function getDifficultyText(difficulty?: string): string {
  if (difficulty === 'easy') return '简单'
  if (difficulty === 'hard') return '困难'
  return '中等'
}

function getOutputSourceText(source: ActualConsumptionOutputSource): string {
  const map: Record<ActualConsumptionOutputSource, string> = {
    settlement: '结算工程量',
    budget: '预算测算',
    contract: '合同清单',
    manual: '手动补录',
  }
  return map[source]
}

function getStructureText(value: StructureType): string {
  const map: Record<StructureType, string> = {
    single: '单层结构',
    double: '两层结构',
    triple: '三层结构',
    custom: '自定义结构',
  }
  return map[value]
}

function getCategoryText(category: string): string {
  const map: Record<string, string> = {
    labor: '人工',
    material: '材料',
    machine: '机械',
    other: '其他',
  }
  return map[category] || category
}

function getCategoryTag(category: string): 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    labor: 'success',
    material: 'warning',
    machine: 'danger',
    other: 'info',
  }
  return map[category] || 'info'
}

function formatNumber(num: number): string {
  const value = Number(num || 0)
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatQuantity(num: number): string {
  const value = Number(num || 0)
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function formatRatioNumber(num: number): string {
  const value = Number(num || 0)
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
}

function formatPercent(num: number): string {
  const value = Number(num || 0) * 100
  return `${value.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
</script>

<style scoped>
.actual-quota-analysis-panel {
  padding: 10px 0;
}

.project-pool-section,
.right-pane {
  min-height: 120px;
}

.project-actions,
.project-item-head,
.project-output-row,
.project-output-meta,
.section-line-head,
.layer-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-actions {
  justify-content: flex-end;
}

.project-item-head,
.project-output-row,
.section-line-head {
  justify-content: space-between;
}

.project-output-meta {
  flex-wrap: wrap;
  color: #606266;
}

.project-meta-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
}

.output-input {
  width: 128px;
}

.difficulty-select {
  width: 78px;
}

.section-line-head {
  margin-bottom: 8px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #303133;
}

.layer-config {
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #f9fafb;
}

.layer-config-row {
  margin-top: 6px;
}

.layer-name-input {
  min-width: 0;
  flex: 1;
}

.layer-weight-input {
  width: 86px;
}

.layer-weight-ratio {
  width: 58px;
  color: #606266;
  font-size: 0.75rem;
  text-align: right;
}

.process-module-picker {
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
}

.process-module-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
}

.analysis-summary {
  margin-top: 8px;
}

.rough-cost-reference {
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #f9fafb;
}

.rough-cost-reference__title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #303133;
}

.rough-cost-reference__note {
  margin-top: 2px;
  font-size: 0.75rem;
  color: #909399;
}

.rough-cost-reference__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.rough-cost-reference__item {
  display: grid;
  gap: 2px;
}

.rough-cost-reference__item span,
.rough-cost-reference__item small {
  color: #606266;
  font-size: 0.75rem;
}

.rough-cost-reference__item strong {
  color: #303133;
}

.support-list {
  margin: 4px 0 0;
  padding-left: 16px;
}

.project-pool-item {
  border-color: #e4e7ed;
}

.border-primary {
  border-color: var(--el-color-primary) !important;
}

.bg-primary-light {
  background-color: var(--el-color-primary-light-9) !important;
}

.font-semibold {
  font-weight: 600;
}

.font-bold {
  font-weight: 700;
}

.text-lg {
  font-size: 1.125rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-gray-500 {
  color: #909399;
}

.text-gray-600 {
  color: #606266;
}

.text-gray-800 {
  color: #303133;
}

.mb-2 {
  margin-bottom: 8px;
}

.mb-3 {
  margin-bottom: 12px;
}

.mb-4 {
  margin-bottom: 16px;
}

.mt-1 {
  margin-top: 4px;
}

.mt-2 {
  margin-top: 8px;
}

.mt-3 {
  margin-top: 12px;
}

.ml-28 {
  margin-left: 112px;
}

.p-3 {
  padding: 12px;
}

.py-10 {
  padding-top: 40px;
  padding-bottom: 40px;
}

.py-20 {
  padding-top: 80px;
  padding-bottom: 80px;
}

.w-full {
  width: 100%;
}

.max-w-xl {
  max-width: 576px;
}

.rounded-lg {
  border-radius: 0.5rem;
}

.rounded {
  border-radius: 0.375rem;
}

.border {
  border-width: 1px;
  border-style: solid;
}

.bg-gray-50 {
  background: #f9fafb;
}

@media (max-width: 768px) {
  .ml-28 {
    margin-left: 0;
  }

  .project-meta-details,
  .rough-cost-reference__grid,
  .process-module-list {
    grid-template-columns: 1fr;
  }
}
</style>
