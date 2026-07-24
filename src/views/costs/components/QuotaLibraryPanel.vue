<template>
  <section class="quota-library-panel">
    <div class="quota-layout">
      <!-- 左侧：定额列表与新增 -->
      <aside class="quota-sidebar">
        <div class="sidebar-header">
          <el-input
            v-model="searchQuery"
            placeholder="搜索定额编码/名称"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            size="small"
            class="add-btn"
            @click="openAddDialog"
          >
            <template #icon><Plus /></template>新增定额
          </el-button>
        </div>

        <div class="quota-list-wrapper">
          <div
            v-for="item in filteredQuotaItems"
            :key="item.id"
            class="quota-list-item"
            :class="{ active: selectedQuotaId === item.id }"
            @click="selectQuota(item.id)"
          >
            <div class="quota-item-code">{{ item.code }}</div>
            <div class="quota-item-name">{{ item.name }}</div>
            <div class="quota-item-meta">
              <el-tag size="small" type="info" effect="plain">{{ item.baseUnit }}基准</el-tag>
              <span class="caliber-tag">{{ item.caliber }}</span>
            </div>
          </div>
          <el-empty v-if="filteredQuotaItems.length === 0" description="没有符合的定额" :image-size="60" />
        </div>
      </aside>

      <!-- 右侧：详情与规则配置 -->
      <main class="quota-content">
        <div v-if="selectedQuota" class="quota-detail-card">
          <!-- 头部信息 -->
          <div class="detail-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="quota-title-row">
                <el-tag type="primary" size="large" effect="dark">{{ selectedQuota.code }}</el-tag>
                <h2>{{ selectedQuota.name }}</h2>
              </div>
              <span class="quota-desc">{{ selectedQuota.caliber }}</span>
            </div>
            <el-popconfirm title="确定删除当前定额模板（会连同它的参数规则一起删除）吗？" @confirm="handleDeleteQuota">
              <template #reference>
                <el-button type="danger" size="small" plain>删除当前定额</el-button>
              </template>
            </el-popconfirm>
          </div>

          <!-- 基础信息编辑 -->
          <section class="detail-section">
            <h3 class="section-title">定额基本信息</h3>
            <el-form :model="quotaForm" label-width="120px" size="small" class="quota-base-form">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="定额编码" required>
                    <el-input v-model="quotaForm.code" @change="saveBaseInfo" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="定额名称" required>
                    <el-input v-model="quotaForm.name" @change="saveBaseInfo" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="计算基准单位" required>
                    <el-select v-model="quotaForm.baseUnit" @change="saveBaseInfo" style="width: 100%">
                      <el-option label="立方米 (m3)" value="m3" />
                      <el-option label="平方米 (m2)" value="m2" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="设计口径描述">
                    <el-input v-model="quotaForm.caliber" placeholder="请输入计算口径描述" @change="saveBaseInfo" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="8">
                  <el-form-item label="默认厚度 (cm)">
                    <el-input-number v-model="quotaForm.defaultThicknessCm" :min="0" :controls="false" @change="saveBaseInfo" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="默认密度 (t/m³)">
                    <el-input-number v-model="quotaForm.density" :min="0" :precision="3" :controls="false" @change="saveBaseInfo" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="默认损耗率 (%)">
                    <el-input-number v-model="quotaForm.lossRate" :min="0" :precision="2" :controls="false" @change="saveBaseInfo" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </section>

          <!-- 定额单价组成项 -->
          <section class="detail-section">
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 class="section-title">定额单价组成项</h3>
                <span class="section-tips">这里维护模板本体的人工、材料、机械、运输、拌合和其他费用；预算测算套用模板时会同步参与计算。</span>
              </div>
              <el-button type="primary" size="small" @click="addComponentRow">
                <template #icon><Plus /></template>添加组成项
              </el-button>
            </div>

            <el-table :data="componentRows" border size="small" class="rules-table">
              <el-table-column label="类别" width="110">
                <template #default="{ row }">
                  <el-select v-model="row.category" size="small" @change="saveComponents">
                    <el-option label="人工" value="labor" />
                    <el-option label="材料" value="material" />
                    <el-option label="机械" value="machine" />
                    <el-option label="运输" value="transport" />
                    <el-option label="拌合" value="mixing" />
                    <el-option label="取费" value="fee" />
                    <el-option label="其他" value="other" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="费用项名称" min-width="180">
                <template #default="{ row }">
                  <el-input v-model="row.name" size="small" placeholder="如：拌合费" @change="saveComponents" />
                </template>
              </el-table-column>
              <el-table-column label="计量基准" width="130">
                <template #default="{ row }">
                  <el-select v-model="row.basis" size="small" @change="saveComponents">
                    <el-option label="定额基准单位" value="baseUnit" />
                    <el-option label="混合料吨耗" value="tonnage" />
                    <el-option label="清单面积" value="area" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="单位" width="90">
                <template #default="{ row }">
                  <el-input v-model="row.unit" size="small" @change="saveComponents" />
                </template>
              </el-table-column>
              <el-table-column label="消耗量" width="110" align="right">
                <template #default="{ row }">
                  <el-input-number v-model="row.consumption" :min="0" :precision="4" :controls="false" size="small" style="width: 100%" @change="saveComponents" />
                </template>
              </el-table-column>
              <el-table-column label="单价" width="110" align="right">
                <template #default="{ row }">
                  <el-input-number v-model="row.price" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" @change="saveComponents" />
                </template>
              </el-table-column>
              <el-table-column label="计算口径" min-width="220">
                <template #default="{ row }">
                  <el-input v-model="row.formula" size="small" placeholder="例如：按混合料吨耗计取" @change="saveComponents" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="deleteComponentRow($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <!-- 参数合理区间与校验规则配置 -->
          <section class="detail-section">
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 class="section-title">测算参数合理区间与校验规则 (红线提示)</h3>
                <span class="section-tips">此设置直接控制预算编辑器中参数越界时的标红警告和提示语。</span>
              </div>
              <el-button type="primary" size="small" @click="openAddRuleDialog">
                <template #icon><Plus /></template>添加自定义参数
              </el-button>
            </div>
            
            <el-table :data="paramRuleRows" border size="small" class="rules-table">
              <el-table-column label="参数名称 / 代码" width="220">
                <template #default="{ row }">
                  <div class="param-key-cell">
                    <span class="param-label">{{ getParamLabel(row.key) }}</span>
                    <code class="param-code">{{ row.key }}</code>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column label="规范推荐默认值" width="130" align="right">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.defaultVal"
                    size="small"
                    :controls="false"
                    :precision="row.key === 'tackApplicationRate' ? 4 : 2"
                    style="width: 100%;"
                    @change="saveRule(row)"
                  />
                </template>
              </el-table-column>

              <el-table-column label="合理区间 (下限 ~ 上限)" width="200" align="center">
                <template #default="{ row }">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <el-input-number
                      v-model="row.minValid"
                      size="small"
                      :controls="false"
                      :precision="row.key === 'tackApplicationRate' ? 4 : 2"
                      placeholder="最小"
                      style="flex: 1;"
                      @change="saveRule(row)"
                    />
                    <span>~</span>
                    <el-input-number
                      v-model="row.maxValid"
                      size="small"
                      :controls="false"
                      :precision="row.key === 'tackApplicationRate' ? 4 : 2"
                      placeholder="最大"
                      style="flex: 1;"
                      @change="saveRule(row)"
                    />
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="越界警告语">
                <template #default="{ row }">
                  <el-input
                    v-model="row.warningMsg"
                    size="small"
                    placeholder="例如：厚度超出规范区间！"
                    @change="saveRule(row)"
                  />
                </template>
              </el-table-column>

              <el-table-column label="行业规范/设计参考说明" min-width="260">
                <template #default="{ row }">
                  <el-input
                    v-model="row.desc"
                    type="textarea"
                    :rows="1"
                    autosize
                    size="small"
                    placeholder="请输入参考规范说明"
                    @change="saveRule(row)"
                  />
                </template>
              </el-table-column>

              <el-table-column label="操作" width="80" align="center">
                <template #default="{ row }">
                  <el-popconfirm title="确定删除该参数校验规则吗？" @confirm="handleDeleteRule(row.key)">
                    <template #reference>
                      <el-button type="danger" size="small" link>删除</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </div>
        
        <div v-else class="empty-detail">
          <el-empty description="请在左侧选择定额模板进行查看或配置" />
        </div>
      </main>
    </div>

    <!-- 新增定额弹窗 -->
    <el-dialog
      v-model="addDialogVisible"
      title="新增定额模板"
      width="500px"
      destroy-on-close
    >
      <el-form :model="addForm" :rules="addFormRules" ref="addFormRef" label-width="110px" size="small">
        <el-form-item label="定额编码" prop="code" required>
          <el-input v-model="addForm.code" placeholder="如: NB-LM-031" />
        </el-form-item>
        <el-form-item label="定额名称" prop="name" required>
          <el-input v-model="addForm.name" placeholder="如: 排水沥青上面层 OGFC-13" />
        </el-form-item>
        <el-form-item label="计算基准单位" prop="baseUnit" required>
          <el-select v-model="addForm.baseUnit" placeholder="请选择" style="width: 100%">
            <el-option label="立方米 (m3) 基准" value="m3" />
            <el-option label="平方米 (m2) 基准" value="m2" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认设计厚度" prop="defaultThicknessCm">
          <el-input-number v-model="addForm.defaultThicknessCm" :min="0" style="width: 100%" placeholder="无厚度转换可填0" />
        </el-form-item>
        <el-form-item label="默认压实密度" prop="density">
          <el-input-number v-model="addForm.density" :min="0" :precision="3" style="width: 100%" placeholder="非混料定额可填0" />
        </el-form-item>
        <el-form-item label="默认损耗率" prop="lossRate">
          <el-input-number v-model="addForm.lossRate" :min="0" :precision="2" style="width: 100%" placeholder="百分比值，如2%" />
        </el-form-item>
        <el-form-item label="口径描述" prop="caliber">
          <el-input v-model="addForm.caliber" placeholder="如：新型超薄磨耗层直接按 m2 计量测算" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="addDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitAddQuota">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 新增参数对话框 -->
    <el-dialog
      v-model="addRuleVisible"
      title="添加自定义参数"
      width="500px"
      destroy-on-close
    >
      <el-form :model="addRuleForm" :rules="addRuleRules" ref="addRuleFormRef" label-width="120px" size="small">
        <el-form-item label="参数代码/名称" prop="key" required>
          <el-input v-model="addRuleForm.key" placeholder="如: specialAdditiveRatio 或 改性剂掺量" />
        </el-form-item>
        <el-form-item label="推荐默认值" prop="defaultVal">
          <el-input-number v-model="addRuleForm.defaultVal" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="合理下限" prop="minValid">
          <el-input-number v-model="addRuleForm.minValid" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="合理上限" prop="maxValid">
          <el-input-number v-model="addRuleForm.maxValid" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="越界警告语" prop="warningMsg">
          <el-input v-model="addRuleForm.warningMsg" placeholder="如：掺量超出推荐规范范围！" />
        </el-form-item>
        <el-form-item label="规范/设计说明" prop="desc">
          <el-input v-model="addRuleForm.desc" type="textarea" :rows="2" placeholder="如：沥青混合料改性剂常规用量为3.0%~5.0%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="addRuleVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitAddRule">确认添加</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance } from 'element-plus'
import type { QuotaItem, QuotaComponent, ParamRule } from '../useCostManagement'

const props = defineProps<{
  quotaItems: QuotaItem[]
  paramRules: Record<string, Record<string, ParamRule>>
}>()

const emit = defineEmits<{
  (e: 'add-quota', item: Omit<QuotaItem, 'id'>): void
  (e: 'update-quota', item: QuotaItem): void
  (e: 'delete-quota', id: string): void
  (e: 'update-rule', quotaId: string, paramKey: string, rule: ParamRule): void
  (e: 'add-rule', quotaId: string, paramKey: string, rule: ParamRule): void
  (e: 'delete-rule', quotaId: string, paramKey: string): void
}>()

const searchQuery = ref('')
const selectedQuotaId = ref('')
const addDialogVisible = ref(false)

// 基础表单响应式状态
const quotaForm = reactive<QuotaItem>({
  id: '',
  code: '',
  name: '',
  baseUnit: 'm3',
  defaultThicknessCm: 0,
  density: 0,
  lossRate: 0,
  caliber: '',
  components: []
})

const selectedQuota = computed(() => {
  return props.quotaItems.find(q => q.id === selectedQuotaId.value) || null
})

// 定额过滤
const filteredQuotaItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.quotaItems
  return props.quotaItems.filter(
    item => item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
  )
})

// 默认选中第一条定额
watch(
  () => props.quotaItems,
  (newVal) => {
    if (newVal.length > 0 && !selectedQuotaId.value) {
      selectedQuotaId.value = newVal[0].id
    }
  },
  { immediate: true }
)

// 监设定额切换以更新表单
watch(selectedQuota, (newVal) => {
  if (newVal) {
    Object.assign(quotaForm, newVal)
  }
}, { immediate: true })

function selectQuota(id: string) {
  selectedQuotaId.value = id
}

// 收集当前定额的参数校验表行
const paramRuleRows = computed(() => {
  if (!selectedQuotaId.value) return []
  const rules = props.paramRules[selectedQuotaId.value] || {}
  return Object.keys(rules).map(key => {
    return {
      key,
      ...rules[key]
    }
  })
})

const componentRows = computed(() => selectedQuota.value?.components || [])

const paramKeyLabels: Record<string, string> = {
  thicknessCm: '厚度 (cm)',
  density: '压实密度 (t/m³)',
  lossRate: '施工损耗率 (%)',
  haulDistanceKm: '运输距离/弃土运距 (km)',
  managementRate: '企业管理费率 (%)',
  profitRate: '测算利润率 (%)',
  taxRate: '增值税率 (%)',
  laborProductivity: '人工配合铺筑工效 (m²/工日)',
  paverProductivity: '铺机摊铺工效 (m²/台班)',
  rollerProductivity: '压路机联合压实工效 (m²/台班)',
  tackApplicationRate: '粘层油洒布量 (t/m²)',
  sprayProductivity: '洒布车日工作面积 (m²/台班)',
  millProductivity: '铣刨机日作业面积 (m²/台班)',
  slagFactor: '铣刨渣料重量转换系数 (t/m²)',
  asphaltRatio: '沥青混合料配比比例 (%)',
  coarseRatio: '粗碎石集料配比比例 (%)',
  fineRatio: '细砂石屑机制砂配比 (%)',
  powderRatio: '矿粉填料配比比例 (%)',
}

function getParamLabel(key: string): string {
  return paramKeyLabels[key] || key
}

// 保存基础表单变更
function saveBaseInfo() {
  if (!selectedQuotaId.value) return
  emit('update-quota', { ...quotaForm, id: selectedQuotaId.value })
}

function saveComponents() {
  if (!selectedQuota.value) return
  emit('update-quota', {
    ...selectedQuota.value,
    components: componentRows.value.map(component => ({ ...component })),
  })
}

function addComponentRow() {
  if (!selectedQuota.value) return
  selectedQuota.value.components.push({
    id: `component-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: 'other',
    name: '',
    unit: selectedQuota.value.baseUnit,
    basis: 'baseUnit',
    consumption: 1,
    price: 0,
    formula: '按定额基准单位计取',
  })
  saveComponents()
}

function deleteComponentRow(index: number) {
  if (!selectedQuota.value) return
  selectedQuota.value.components.splice(index, 1)
  saveComponents()
}

// 保存具体规则变更
function saveRule(row: any) {
  if (!selectedQuotaId.value) return
  emit('update-rule', selectedQuotaId.value, row.key, {
    defaultVal: row.defaultVal,
    minValid: row.minValid,
    maxValid: row.maxValid,
    desc: row.desc,
    warningMsg: row.warningMsg
  })
}

// 新增定额逻辑
const addFormRef = ref<FormInstance>()
const addForm = reactive({
  code: '',
  name: '',
  baseUnit: 'm3' as 'm3' | 'm2',
  defaultThicknessCm: 4,
  density: 2.38,
  lossRate: 2,
  caliber: ''
})

const addFormRules = {
  code: [{ required: true, message: '请输入定额编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入定额名称', trigger: 'blur' }],
  baseUnit: [{ required: true, message: '请选择计算基准', trigger: 'change' }]
}

function openAddDialog() {
  addForm.code = ''
  addForm.name = ''
  addForm.baseUnit = 'm3'
  addForm.defaultThicknessCm = 4
  addForm.density = 2.38
  addForm.lossRate = 2
  addForm.caliber = ''
  addDialogVisible.value = true
}

function submitAddQuota() {
  if (!addFormRef.value) return
  addFormRef.value.validate((valid) => {
    if (valid) {
      emit('add-quota', {
        code: addForm.code,
        name: addForm.name,
        baseUnit: addForm.baseUnit,
        defaultThicknessCm: addForm.defaultThicknessCm,
        density: addForm.density,
        lossRate: addForm.lossRate,
        caliber: addForm.caliber || `${addForm.baseUnit} 基准内部消耗测算定额`,
        components: []
      })
      ElMessage.success('定额模板创建成功')
      addDialogVisible.value = false
      
      // 自动切换到新定额
      setTimeout(() => {
        const newest = props.quotaItems[props.quotaItems.length - 1]
        if (newest) {
          selectedQuotaId.value = newest.id
        }
      }, 50)
    }
  })
}

function handleDeleteQuota() {
  if (!selectedQuotaId.value) return
  emit('delete-quota', selectedQuotaId.value)
  
  // 自动切换到其它定额
  setTimeout(() => {
    if (props.quotaItems.length > 0) {
      selectedQuotaId.value = props.quotaItems[0].id
    } else {
      selectedQuotaId.value = ''
    }
  }, 50)
}

function handleDeleteRule(key: string) {
  if (!selectedQuotaId.value) return
  emit('delete-rule', selectedQuotaId.value, key)
}

const addRuleVisible = ref(false)
const addRuleFormRef = ref<FormInstance>()
const addRuleForm = reactive({
  key: '',
  defaultVal: 0,
  minValid: 0,
  maxValid: 100,
  warningMsg: '',
  desc: ''
})

const addRuleRules = {
  key: [
    { required: true, message: '请输入参数代码/名称', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (!value) return callback(new Error('请输入参数代码/名称'))
        // 检查是否重复
        const currentRules = props.paramRules[selectedQuotaId.value] || {}
        if (currentRules[value]) {
          return callback(new Error('该参数已存在于当前定额中！'))
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

function openAddRuleDialog() {
  addRuleForm.key = ''
  addRuleForm.defaultVal = 0
  addRuleForm.minValid = 0
  addRuleForm.maxValid = 100
  addRuleForm.warningMsg = ''
  addRuleForm.desc = ''
  addRuleVisible.value = true
}

function submitAddRule() {
  if (!addRuleFormRef.value) return
  addRuleFormRef.value.validate((valid) => {
    if (valid) {
      if (!selectedQuotaId.value) return
      emit('add-rule', selectedQuotaId.value, addRuleForm.key, {
        defaultVal: addRuleForm.defaultVal,
        minValid: addRuleForm.minValid,
        maxValid: addRuleForm.maxValid,
        warningMsg: addRuleForm.warningMsg || '参数值超出合理推荐范围！',
        desc: addRuleForm.desc
      })
      addRuleVisible.value = false
      ElMessage.success('自定义参数添加成功')
    }
  })
}
</script>

<style scoped>
.quota-library-panel {
  width: 100%;
  padding: 10px 0;
  background-color: transparent;
}

.quota-layout {
  display: flex;
  gap: 20px;
  min-height: 580px;
}

/* 左侧 Sidebar */
.quota-sidebar {
  width: 320px;
  flex-shrink: 0;
  border: 1px solid var(--cost-border-soft);
  border-radius: 8px;
  background-color: #fff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

html[data-theme='dark'] .quota-sidebar,
.dark .quota-sidebar {
  background-color: var(--card-bg);
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quota-list-wrapper {
  flex: 1;
  overflow-y: auto;
  max-height: 520px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quota-list-item {
  border: 1px solid var(--cost-border-soft);
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--cost-surface-panel-soft);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quota-list-item:hover {
  border-color: var(--cost-color-primary);
  background-color: rgba(37, 99, 235, 0.02);
}

.quota-list-item.active {
  border-color: var(--cost-color-primary);
  background-color: rgba(37, 99, 235, 0.06);
}

.quota-item-code {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--cost-color-primary-text);
}

.quota-item-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--cost-text-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quota-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.caliber-tag {
  font-size: 0.6875rem;
  color: var(--cost-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* 右侧 Content */
.quota-content {
  flex: 1;
  border: 1px solid var(--cost-border-soft);
  border-radius: 8px;
  background-color: #fff;
  padding: 16px 20px;
  overflow-x: hidden;
}

html[data-theme='dark'] .quota-content,
.dark .quota-content {
  background-color: var(--card-bg);
}

.quota-detail-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  border-bottom: 1px solid var(--cost-border-soft);
  padding-bottom: 12px;
}

.quota-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.quota-title-row h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--cost-text-title);
}

.quota-desc {
  font-size: 0.75rem;
  color: var(--cost-text-body);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--cost-text-title);
  border-left: 3px solid var(--cost-color-primary);
  padding-left: 8px;
  line-height: 1.2;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-tips {
  font-size: 0.75rem;
  color: var(--cost-text-muted);
}

.quota-base-form {
  background-color: var(--cost-surface-panel-soft);
  padding: 12px 15px;
  border-radius: 6px;
  border: 1px solid var(--cost-border-soft);
}

.param-key-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-label {
  font-size: 0.8125rem;
  font-weight: bold;
  color: var(--cost-text-title);
}

.param-code {
  font-size: 0.6875rem;
  color: var(--cost-text-muted);
  font-family: monospace;
}

.rules-table {
  margin-top: 4px;
}

.empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 500px;
}
</style>
