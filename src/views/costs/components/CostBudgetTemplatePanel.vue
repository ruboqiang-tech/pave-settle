<template>
  <section class="cost-budget-template">
    <div class="cost-template-full-width">
      <!-- 预算测算文件工具栏 -->
      <div class="budget-file-toolbar" style="margin-bottom: 15px; padding: 12px; background: var(--cost-surface-panel-soft); border-radius: 6px; border: 1px solid var(--cost-border-soft); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 0.8125rem; font-weight: bold; color: var(--cost-text-title);">预算测算文件：</span>
          <el-select
            v-model="activeFileId"
            placeholder="请选择或新建预算文件"
            size="small"
            style="width: 220px;"
            @change="handleFileChange"
          >
            <el-option
              v-for="file in budgetFiles"
              :key="file.id"
              :label="file.name"
              :value="file.id"
            />
          </el-select>
          <el-button type="primary" size="small" :icon="Plus" @click="handleCreateFile">新建文件</el-button>
          <el-button type="success" size="small" :disabled="!activeFileId" @click="handleSaveFile">保存文件</el-button>
          <el-button type="warning" size="small" :disabled="!activeFileId" @click="handleSaveAsFile">另存为</el-button>
          <el-button type="danger" size="small" :disabled="!activeFileId" @click="handleDeleteFile">删除文件</el-button>
        </div>
      </div>

      <!-- 项目清单预算总览 -->
      <section class="cost-template-panel">
        <div class="cost-template-panel__head">
          <h3>项目清单预算总览 (测算价格自动同步)</h3>
          <div class="cost-template-actions" style="display: flex; gap: 8px;">
            <el-button size="small" type="success" :disabled="!activeFileId" @click="showImportDialog = true">
              <template #icon><Download /></template>从项目导入清单
            </el-button>
            <el-button size="small" type="primary" :disabled="!activeFileId" @click="handleAddBOQItem">
              <template #icon><Plus /></template>添加清单项
            </el-button>
            <el-button size="small" type="danger" :disabled="!selectedBOQItemId" @click="handleDeleteBOQItem">
              <template #icon><Delete /></template>删除清单项
            </el-button>
          </div>
        </div>
        <el-table
          :data="budgetRows"
          border
          size="small"
          show-summary
          :summary-method="buildBudgetSummary"
          highlight-current-row
          style="width: 100%; cursor: pointer;"
          @row-click="handleBOQRowClick"
        >
          <el-table-column prop="itemName" label="清单名称" min-width="260">
            <template #default="{ row }">
              <el-input v-model="row.itemName" size="small" @change="syncBOQItemField(row.id, 'itemName', row.itemName)" />
            </template>
          </el-table-column>
          
          <el-table-column prop="pricingMode" label="组价模式" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.pricingMode === 'quota' ? 'primary' : 'success'" size="small">
                {{ row.pricingMode === 'quota' ? '定额测算' : '自由组价' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="linkedQuotaId" label="关联定额" min-width="240">
            <template #default="{ row }">
              <span v-if="row.pricingMode === 'quota'">
                {{ getQuotaNameById(row.linkedQuotaId) }}
              </span>
              <span v-else style="color: var(--el-text-color-secondary); font-style: italic;">无 (直接输入单价)</span>
            </template>
          </el-table-column>

          <el-table-column prop="unit" label="单位" width="80" align="center">
            <template #default="{ row }">
              <el-input v-model="row.unit" size="small" @change="syncBOQItemField(row.id, 'unit', row.unit)" />
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="工程量" width="120" align="right">
            <template #default="{ row }">
              <el-input-number v-model="row.quantity" size="small" :controls="false" :precision="2" style="width: 100%" @change="syncBOQItemField(row.id, 'quantity', row.quantity)" />
            </template>
          </el-table-column>
          <el-table-column prop="unitPrice" label="测算综合单价" width="140" align="right">
            <template #default="{ row }">
              <span style="font-weight: 700; color: var(--price-primary);">{{ formatAmount(row.unitPrice, 2) }}</span> 元
            </template>
          </el-table-column>
          <el-table-column prop="total" label="预算合价" width="150" align="right">
            <template #default="{ row }">{{ formatAmount(row.total, 2) }}</template>
          </el-table-column>
        </el-table>
      </section>

      <!-- 单价组成分析与测算参数 -->
      <section v-if="selectedBOQItem" class="cost-template-panel">
        <div class="cost-analysis-head" style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--cost-border-soft); padding-bottom: 8px;">
          <div class="cost-analysis-title" style="display: flex; align-items: center; gap: 8px;">
            <el-tag size="small" type="warning" effect="dark">正在测算</el-tag>
            <h3 style="margin: 0; font-size: 0.875rem; font-weight: bold; color: var(--cost-text-title);">
              [{{ selectedBOQItem.itemCode }}] {{ selectedBOQItem.itemName }}
            </h3>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.75rem; color: var(--cost-text-body);">组价模式：</span>
            <el-radio-group v-model="selectedBOQItem.pricingMode" size="small" @change="handlePricingModeChange">
              <el-radio-button value="quota">定额套用</el-radio-button>
              <el-radio-button value="manual">自由输入</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <!-- 模式 A：定额套用模式 -->
        <div v-if="selectedBOQItem.pricingMode === 'quota'">
          <div style="display: flex; align-items: center; justify-content: space-between; margin: 10px 0; background: var(--cost-surface-panel-soft); padding: 8px 12px; border-radius: 6px; border: 1px dashed var(--cost-border-soft);">
            <span style="font-size: 0.8125rem; color: var(--cost-text-title);">
              已套用定额：<strong>{{ getQuotaNameById(selectedBOQItem.linkedQuotaId) }}</strong>
            </span>
            <el-button type="primary" size="small" link @click="showQuotaDialog = true">
              <template #icon><Search /></template>更换定额模板
            </el-button>
          </div>

          <div v-if="selectedBOQItem.linkedQuotaId && quotaMeasures[activeQuotaId]">
            <div class="cost-analysis-head" style="margin-top: 10px; margin-bottom: 6px;">
              <div class="cost-analysis-title">
                <span class="cost-analysis-code">{{ activeQuota.code }}</span>
                <h3>{{ activeQuota.name }} 测算配置</h3>
              </div>
              <div class="cost-unit-switch">
                <span class="cost-measure-label">显示单位</span>
                <el-radio-group v-model="measurementUnit" size="small">
                  <el-radio-button value="m3">m3</el-radio-button>
                  <el-radio-button value="m2">m2</el-radio-button>
                </el-radio-group>
              </div>
            </div>

            <!-- 单行工程参数及税率配置（配有鼠标悬停行业规范说明 & 超出范围标红警告） -->
            <div class="compact-params-section">
              <div class="compact-params-row">
                <span class="compact-params-group-title">工程参数:</span>
                
                <!-- 厚度 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'thicknessCm')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'thicknessCm', quotaMeasures[activeQuotaId].thicknessCm) }"
                      >
                        厚度(cm)
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].thicknessCm"
                        :min="0"
                        :max="30"
                        :precision="2"
                        :controls="false"
                        :disabled="activeQuota.defaultThicknessCm === 0"
                        size="small"
                        style="width: 65px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'thicknessCm', quotaMeasures[activeQuotaId].thicknessCm) }"
                      />
                    </span>
                  </el-tooltip>
                </div>

                <!-- 压实密度 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'density')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'density', quotaMeasures[activeQuotaId].density) }"
                      >
                        压实密度(t/m³)
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].density"
                        :min="0"
                        :max="3"
                        :precision="3"
                        :controls="false"
                        :disabled="activeQuota.density === 0"
                        size="small"
                        style="width: 65px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'density', quotaMeasures[activeQuotaId].density) }"
                      />
                    </span>
                  </el-tooltip>
                </div>

                <!-- 损耗率 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'lossRate')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'lossRate', quotaMeasures[activeQuotaId].lossRate) }"
                      >
                        损耗率(%)
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].lossRate"
                        :min="0"
                        :max="10"
                        :precision="2"
                        :controls="false"
                        size="small"
                        style="width: 65px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'lossRate', quotaMeasures[activeQuotaId].lossRate) }"
                      />
                    </span>
                  </el-tooltip>
                </div>

                <!-- 成品料运距 / 弃渣运距 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'haulDistanceKm')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'haulDistanceKm', quotaMeasures[activeQuotaId].haulDistanceKm) }"
                      >
                        {{ activeQuotaId === 'LM-MILL-04' ? '弃渣运距(km)' : '成品运距(km)' }}
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].haulDistanceKm"
                        :min="0"
                        :max="100"
                        :precision="2"
                        :controls="false"
                        size="small"
                        style="width: 65px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'haulDistanceKm', quotaMeasures[activeQuotaId].haulDistanceKm) }"
                      />
                    </span>
                  </el-tooltip>
                </div>
                
                <span class="compact-params-group-title" style="margin-left: 15px; border-left: 1px solid var(--cost-border-soft); padding-left: 15px;">费率参数:</span>
                
                <!-- 管理费率 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'managementRate')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'managementRate', quotaMeasures[activeQuotaId].managementRate) }"
                      >
                        管理费(%)
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].managementRate"
                        :min="0"
                        :max="30"
                        :precision="2"
                        :controls="false"
                        size="small"
                        style="width: 60px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'managementRate', quotaMeasures[activeQuotaId].managementRate) }"
                      />
                    </span>
                  </el-tooltip>
                </div>

                <!-- 利润率 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'profitRate')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'profitRate', quotaMeasures[activeQuotaId].profitRate) }"
                      >
                        利润(%)
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].profitRate"
                        :min="0"
                        :max="30"
                        :precision="2"
                        :controls="false"
                        size="small"
                        style="width: 60px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'profitRate', quotaMeasures[activeQuotaId].profitRate) }"
                      />
                    </span>
                  </el-tooltip>
                </div>

                <!-- 税率 -->
                <div class="compact-param-item">
                  <el-tooltip :content="getParamTooltip(activeQuotaId, 'taxRate')" placement="top" raw-content>
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      <span 
                        class="compact-param-label"
                        :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'taxRate', quotaMeasures[activeQuotaId].taxRate) }"
                      >
                        税率(%)
                      </span>
                      <el-input-number
                        v-model="quotaMeasures[activeQuotaId].taxRate"
                        :min="0"
                        :max="20"
                        :precision="2"
                        :controls="false"
                        size="small"
                        style="width: 60px;"
                        :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'taxRate', quotaMeasures[activeQuotaId].taxRate) }"
                      />
                    </span>
                  </el-tooltip>
                </div>
              </div>
            </div>

            <!-- 单行指标汇总与迷你占比条 -->
            <div class="compact-results-bar">
              <div class="compact-result-item">
                <span class="result-label">直接成本:</span>
                <strong class="result-value">{{ formatAmount(displayDirectCost, 2) }}</strong>
              </div>
              <div class="compact-result-item">
                <span class="result-label">管理费:</span>
                <strong class="result-value">{{ formatAmount(displayManagementFee, 2) }}</strong>
              </div>
              <div class="compact-result-item">
                <span class="result-label">利润:</span>
                <strong class="result-value">{{ formatAmount(displayProfit, 2) }}</strong>
              </div>
              <div class="compact-result-item">
                <span class="result-label">税金:</span>
                <strong class="result-value">{{ formatAmount(displayTax, 2) }}</strong>
              </div>
              <div class="compact-result-item primary-result">
                <span class="result-label">综合单价:</span>
                <strong class="result-value">{{ formatAmount(displayComprehensiveUnitPrice, 2) }}</strong>
                <span class="result-unit">元/{{ measurementUnit }}</span>
              </div>

              <!-- 底部 4px 迷你占比展示条 (不占纵向高度) -->
              <div class="mini-proportion-bar">
                <div 
                  v-if="displayDirectCost > 0"
                  :style="{ width: `${(displayDirectCost / displayComprehensiveUnitPrice) * 100}%`, backgroundColor: '#3b82f6' }"
                  title="直接成本"
                />
                <div 
                  v-if="displayManagementFee > 0"
                  :style="{ width: `${(displayManagementFee / displayComprehensiveUnitPrice) * 100}%`, backgroundColor: '#10b981' }"
                  title="管理费"
                />
                <div 
                  v-if="displayProfit > 0"
                  :style="{ width: `${(displayProfit / displayComprehensiveUnitPrice) * 100}%`, backgroundColor: '#f59e0b' }"
                  title="利润"
                />
                <div 
                  v-if="displayTax > 0"
                  :style="{ width: `${(displayTax / displayComprehensiveUnitPrice) * 100}%`, backgroundColor: '#ef4444' }"
                  title="税金"
                />
              </div>
            </div>

            <!-- 单价组成分析表格（支持工效参数录入与警告） -->
            <el-table :data="analysisRows" border size="small" show-summary :summary-method="buildAnalysisSummary">
              <el-table-column prop="group" label="组成" width="90" />
              <el-table-column prop="name" label="资源/费用项" min-width="190" />
              <el-table-column prop="unit" label="单位" width="90" align="center" />
              <el-table-column prop="consumption" label="消耗量" width="120" align="right">
                <template #default="{ row }">{{ formatAmount(row.consumption, 4) }}</template>
              </el-table-column>
              
              <el-table-column label="单价" width="230" align="right">
                <template #default="{ row }">
                  <template v-if="row.resourceId">
                    <el-select
                      v-model="selectedQuoteMap[row.resourceId]"
                      size="small"
                      style="width: 100%"
                      placeholder="选择报价"
                    >
                      <el-option
                        v-for="quote in getQuotesForResource(row.resourceId)"
                        :key="quote.id"
                        :label="`${formatAmount(quote.price, 2)} (${quote.supplier})`"
                        :value="quote.id"
                      />
                    </el-select>
                  </template>
                  <template v-else-if="row.resourceIds">
                    <el-tooltip placement="top" effect="dark">
                      <template #content>
                        <div style="font-size: 0.8125rem; line-height: 1.5;">
                          双钢轮：{{ formatAmount(getQuotePrice('R-MACH-双钢轮'), 2) }} 元 ({{ getQuoteSupplier('R-MACH-双钢轮') }})<br/>
                          胶轮：{{ formatAmount(getQuotePrice('R-MACH-胶轮'), 2) }} 元 ({{ getQuoteSupplier('R-MACH-胶轮') }})
                        </div>
                      </template>
                      <span class="roller-price-tooltip">
                        {{ formatAmount(row.price, 2) }}
                      </span>
                    </el-tooltip>
                  </template>
                  <template v-else>
                    <span>{{ formatAmount(row.price, 2) }}</span>
                  </template>
                </template>
              </el-table-column>

              <el-table-column prop="amount" label="直接成本" width="120" align="right">
                <template #default="{ row }">{{ formatAmount(row.amount, 2) }}</template>
              </el-table-column>
              
              <!-- 计算口径列 -->
              <el-table-column prop="formula" label="计算口径（支持工效调整）" min-width="280">
                <template #default="{ row }">
                  <!-- 配合人工工效 -->
                  <template v-if="row.resourceId === 'R-LABOR-铺工'">
                    <span>工日价 {{ formatAmount(getQuotePrice('R-LABOR-铺工'), 0) }} 元 / </span>
                    <el-tooltip :content="getParamTooltip(activeQuotaId, 'laborProductivity')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].laborProductivity"
                          :controls="false"
                          size="small"
                          style="width: 50px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'laborProductivity', quotaMeasures[activeQuotaId].laborProductivity || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'laborProductivity', quotaMeasures[activeQuotaId].laborProductivity || 0) }"
                        >
                          m²/工日
                        </span>
                      </span>
                    </el-tooltip>
                  </template>
                  
                  <!-- 摊铺机工效 -->
                  <template v-else-if="row.resourceId === 'R-MACH-摊铺机'">
                    <span>台班价 {{ formatAmount(getQuotePrice('R-MACH-摊铺机'), 0) }} 元 / </span>
                    <el-tooltip :content="getParamTooltip(activeQuotaId, 'paverProductivity')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].paverProductivity"
                          :controls="false"
                          size="small"
                          style="width: 50px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'paverProductivity', quotaMeasures[activeQuotaId].paverProductivity || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'paverProductivity', quotaMeasures[activeQuotaId].paverProductivity || 0) }"
                        >
                          m²/台班
                        </span>
                      </span>
                    </el-tooltip>
                  </template>
                  
                  <!-- 压路机组合工效 -->
                  <template v-else-if="row.resourceIds && row.resourceIds.includes('R-MACH-双钢轮')">
                    <span>台班合 ({{ formatAmount(getQuotePrice('R-MACH-双钢轮') + getQuotePrice('R-MACH-胶轮'), 0) }}) 元 / </span>
                    <el-tooltip :content="getParamTooltip(activeQuotaId, 'rollerProductivity')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].rollerProductivity"
                          :controls="false"
                          size="small"
                          style="width: 50px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'rollerProductivity', quotaMeasures[activeQuotaId].rollerProductivity || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'rollerProductivity', quotaMeasures[activeQuotaId].rollerProductivity || 0) }"
                        >
                          m²/台班
                        </span>
                      </span>
                    </el-tooltip>
                  </template>
                  
                  <!-- 粘层油/透层油配比调整 -->
                  <template v-else-if="(activeQuotaId === 'LM-TACK' || activeQuotaId === 'LM-PRIME') && row.resourceId === 'R-MAT-沥青'">
                    <span>损耗系数 {{ formatAmount(lossFactor, 3) }} × 用量 </span>
                    <el-tooltip :content="getParamTooltip(activeQuotaId, 'tackApplicationRate')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].tackApplicationRate"
                          :controls="false"
                          :precision="4"
                          size="small"
                          style="width: 65px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'tackApplicationRate', quotaMeasures[activeQuotaId].tackApplicationRate || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'tackApplicationRate', quotaMeasures[activeQuotaId].tackApplicationRate || 0) }"
                        >
                          t/m²
                        </span>
                      </span>
                    </el-tooltip>
                  </template>
                  
                  <!-- 粘层油/透层油洒布机调整 -->
                  <template v-else-if="(activeQuotaId === 'LM-TACK' || activeQuotaId === 'LM-PRIME') && row.name === '沥青洒布车'">
                    <span>台班费 1600 元 / </span>
                    <el-tooltip :content="getParamTooltip(activeQuotaId, 'sprayProductivity')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].sprayProductivity"
                          :controls="false"
                          size="small"
                          style="width: 55px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'sprayProductivity', quotaMeasures[activeQuotaId].sprayProductivity || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid(activeQuotaId, 'sprayProductivity', quotaMeasures[activeQuotaId].sprayProductivity || 0) }"
                        >
                          m²/台班
                        </span>
                      </span>
                    </el-tooltip>
                  </template>
                  
                  <!-- 铣刨机工效调整 -->
                  <template v-else-if="activeQuotaId === 'LM-MILL-04' && row.name === '路面铣刨机'">
                    <span>台班费 8500 元 / </span>
                    <el-tooltip :content="getParamTooltip('LM-MILL-04', 'millProductivity')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures['LM-MILL-04'].millProductivity"
                          :controls="false"
                          size="small"
                          style="width: 55px;"
                          :class="{ 'input-warning-red': isParamInvalid('LM-MILL-04', 'millProductivity', quotaMeasures['LM-MILL-04'].millProductivity || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid('LM-MILL-04', 'millProductivity', quotaMeasures['LM-MILL-04'].millProductivity || 0) }"
                        >
                          m²/台班
                        </span>
                      </span>
                    </el-tooltip>
                  </template>
                  
                  <!-- 铣刨渣土外运系数调整 -->
                  <template v-else-if="activeQuotaId === 'LM-MILL-04' && row.name === '铣刨渣土运输弃置'">
                    <span>渣重 </span>
                    <el-tooltip :content="getParamTooltip('LM-MILL-04', 'slagFactor')" placement="top" raw-content>
                      <span style="display: inline-flex; align-items: center;">
                        <el-input-number
                          v-model="quotaMeasures['LM-MILL-04'].slagFactor"
                          :controls="false"
                          :precision="3"
                          size="small"
                          style="width: 55px;"
                          :class="{ 'input-warning-red': isParamInvalid('LM-MILL-04', 'slagFactor', quotaMeasures['LM-MILL-04'].slagFactor || 0) }"
                        />
                        <span 
                          style="font-size: 0.75rem; margin-left: 4px; cursor: help; border-bottom: 1px dashed;"
                          :class="{ 'warning-red': isParamInvalid('LM-MILL-04', 'slagFactor', quotaMeasures['LM-MILL-04'].slagFactor || 0) }"
                        >
                          t/m²
                        </span>
                      </span>
                    </el-tooltip>
                    <span> × 运距 </span>
                    <el-tooltip :content="getParamTooltip('LM-MILL-04', 'haulDistanceKm')" placement="top" raw-content>
                      <span 
                        style="cursor: help; border-bottom: 1px dashed;"
                        :class="{ 'warning-red': isParamInvalid('LM-MILL-04', 'haulDistanceKm', quotaMeasures['LM-MILL-04'].haulDistanceKm) }"
                      >
                        {{ quotaMeasures['LM-MILL-04'].haulDistanceKm }}km
                      </span>
                    </el-tooltip>
                    <span> × 运单价</span>
                  </template>

                  <!-- 静态说明 -->
                  <template v-else>
                    <span>{{ row.formula }}</span>
                  </template>
                </template>
              </el-table-column>
            </el-table>

            <!-- 材料配比与价格选择 -->
            <section v-if="isMixtureQuota(activeQuotaId)" style="margin-top: 15px;">
              <div class="cost-template-panel__head" style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; font-size: 0.8125rem; color: var(--cost-text-title);">材料配比与价格选择</h4>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 0.75rem; color: var(--cost-text-body);">供料口径</span>
                  <el-radio-group v-model="selectedBOQItem.supplyMode" size="small" @change="handleSupplyModeChange">
                    <el-radio-button value="finishedDelivered">成品到场</el-radio-button>
                    <el-radio-button value="finishedExFactory">成品出厂</el-radio-button>
                    <el-radio-button value="selfMixing">自供/委托拌合</el-radio-button>
                  </el-radio-group>
                </div>
                <span v-if="selectedBOQItem.supplyMode === 'selfMixing' && isMixRatioSumInvalid" class="mix-ratio-warning-text" style="color: #ef4444; font-size: 0.75rem; font-weight: bold;">
                  ⚠️ 警告：当前配比之和为 {{ ((quotaMeasures[activeQuotaId].asphaltRatio || 0) + (quotaMeasures[activeQuotaId].coarseRatio || 0) + (quotaMeasures[activeQuotaId].fineRatio || 0) + (quotaMeasures[activeQuotaId].powderRatio || 0)).toFixed(2) }}%，必须等于 100%！
                </span>
              </div>
              <el-table v-if="selectedBOQItem.supplyMode !== 'selfMixing'" :data="finishedMaterialRows" border size="small">
                <el-table-column label="成品料" min-width="220">
                  <template #default>
                    <el-select
                      v-model="selectedBOQItem.finishedResourceId"
                      size="small"
                      filterable
                      style="width: 100%"
                      placeholder="选择成品料"
                      @change="handleFinishedResourceChange"
                    >
                      <el-option
                        v-for="resource in finishedResourceOptions"
                        :key="resource.id"
                        :label="`${resource.name} ${resource.spec}`"
                        :value="resource.id"
                      />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column prop="unit" label="单位" width="80" align="center" />
                <el-table-column :label="selectedBOQItem.supplyMode === 'finishedDelivered' ? '到场报价选择' : '出厂报价选择'" min-width="240">
                  <template #default="{ row }">
                    <el-select
                      v-model="selectedBOQItem.finishedQuoteId"
                      size="small"
                      style="width: 100%"
                      placeholder="选择成品料报价"
                    >
                      <el-option
                        v-for="quote in getQuotesForResource(row.resourceId)"
                        :key="quote.id"
                        :label="`${formatAmount(quote.price, 2)} (${quote.supplier} / ${quote.taxCaliber})`"
                        :value="quote.id"
                      />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column prop="source" label="当前所选价格来源" min-width="180" />
                <el-table-column prop="collectedAt" label="获取时间" width="130" align="center" />
                <el-table-column prop="effectiveRegion" label="适用区域/交货点" width="150" align="center" />
              </el-table>
              <el-table v-else :data="materialRows" border size="small">
                <el-table-column prop="name" label="材料" min-width="160" />
                <el-table-column label="配比(%)" width="130" align="center">
                  <template #default="{ row }">
                    <template v-if="row.resourceId === 'R-MAT-沥青' || row.resourceId === 'R-MAT-水泥'">
                      <el-tooltip :content="getParamTooltip(activeQuotaId, 'asphaltRatio')" placement="top" raw-content>
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].asphaltRatio"
                          :min="0"
                          :max="100"
                          :precision="2"
                          :controls="false"
                          size="small"
                          style="width: 75px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'asphaltRatio', quotaMeasures[activeQuotaId].asphaltRatio || 0) || isMixRatioSumInvalid }"
                        />
                      </el-tooltip>
                    </template>
                    <template v-else-if="row.resourceId === 'R-MAT-粗集料'">
                      <el-tooltip :content="getParamTooltip(activeQuotaId, 'coarseRatio')" placement="top" raw-content>
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].coarseRatio"
                          :min="0"
                          :max="100"
                          :precision="2"
                          :controls="false"
                          size="small"
                          style="width: 75px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'coarseRatio', quotaMeasures[activeQuotaId].coarseRatio || 0) || isMixRatioSumInvalid }"
                        />
                      </el-tooltip>
                    </template>
                    <template v-else-if="row.resourceId === 'R-MAT-细集料'">
                      <el-tooltip :content="getParamTooltip(activeQuotaId, 'fineRatio')" placement="top" raw-content>
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].fineRatio"
                          :min="0"
                          :max="100"
                          :precision="2"
                          :controls="false"
                          size="small"
                          style="width: 75px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'fineRatio', quotaMeasures[activeQuotaId].fineRatio || 0) || isMixRatioSumInvalid }"
                        />
                      </el-tooltip>
                    </template>
                    <template v-else-if="row.resourceId === 'R-MAT-矿粉'">
                      <el-tooltip :content="getParamTooltip(activeQuotaId, 'powderRatio')" placement="top" raw-content>
                        <el-input-number
                          v-model="quotaMeasures[activeQuotaId].powderRatio"
                          :min="0"
                          :max="100"
                          :precision="2"
                          :controls="false"
                          size="small"
                          style="width: 75px;"
                          :class="{ 'input-warning-red': isParamInvalid(activeQuotaId, 'powderRatio', quotaMeasures[activeQuotaId].powderRatio || 0) || isMixRatioSumInvalid }"
                        />
                      </el-tooltip>
                    </template>
                  </template>
                </el-table-column>
                <el-table-column prop="unit" label="单位" width="80" align="center" />
                
                <el-table-column label="到场报价选择" min-width="230">
                  <template #default="{ row }">
                    <el-select
                      v-model="selectedQuoteMap[row.resourceId]"
                      size="small"
                      style="width: 100%"
                      placeholder="选择供应商报价"
                    >
                      <el-option
                        v-for="quote in getQuotesForResource(row.resourceId)"
                        :key="quote.id"
                        :label="`${formatAmount(quote.price, 2)} (${quote.supplier})`"
                        :value="quote.id"
                      />
                    </el-select>
                  </template>
                </el-table-column>

                <el-table-column prop="source" label="当前所选价格来源" min-width="180" />
                <el-table-column prop="collectedAt" label="获取时间" width="130" align="center" />
                <el-table-column prop="effectiveRegion" label="适用区域/交货点" width="140" align="center" />
              </el-table>
            </section>
          </div>
          <div v-else style="padding: 30px; text-align: center; background: var(--cost-surface-panel-soft); border-radius: 6px; border: 1px dashed var(--cost-border-soft);">
            <span style="font-size: 0.8125rem; color: var(--el-text-color-secondary);">当前定额未关联或已清空。请点击上方 “更换定额模板” 来套用测算定额。</span>
          </div>
        </div>

        <!-- 模式 B：自由输入模式 -->
        <div v-else class="manual-pricing-editor" style="padding: 8px 0;">
          <div style="display: flex; align-items: center; gap: 20px; background: var(--cost-surface-panel-soft); padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid var(--cost-border-soft);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.8125rem; font-weight: bold; color: var(--cost-text-title);">直接输入综合单价：</span>
              <el-input-number
                v-model="selectedBOQItem.manualUnitPrice"
                :min="0"
                :precision="2"
                :controls="false"
                :disabled="selectedBOQItem.manualBreakdown.length > 0"
                size="small"
                style="width: 100px;"
              />
              <span style="font-size: 0.75rem; color: var(--el-text-color-secondary);">元 / {{ selectedBOQItem.unit }}</span>
            </div>
            <div v-if="selectedBOQItem.manualBreakdown.length > 0" style="font-size: 0.75rem; color: #f59e0b; font-weight: bold;">
              ⚠️ 提示：下方已录入费用明细，综合单价已锁定为明细合价总和 ({{ formatAmount(selectedBOQItem.manualUnitPrice, 2) }}元)
            </div>
            <div v-else style="font-size: 0.75rem; color: var(--el-text-color-secondary);">
              直接输入最终单价，或者在下方添加明细费用进行自由组价。
            </div>
          </div>

          <!-- 自定义组价明细表格 -->
          <div class="custom-breakdown-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="margin: 0; font-size: 0.8125rem; color: var(--cost-text-title);">自定义费用明细项 (自由组价)</h4>
              <el-button type="primary" size="small" @click="addManualBreakdownRow">
                <template #icon><Plus /></template>添加费用明细项
              </el-button>
            </div>
            <el-table :data="selectedBOQItem.manualBreakdown" border size="small">
              <el-table-column label="费用类别" width="120">
                <template #default="{ row }">
                  <el-select v-model="row.category" size="small" style="width: 100%">
                    <el-option label="人工" value="labor" />
                    <el-option label="材料" value="material" />
                    <el-option label="机械" value="machine" />
                    <el-option label="运输" value="transport" />
                    <el-option label="其他费用" value="other" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="费用项名称" min-width="180">
                <template #default="{ row }">
                  <el-input v-model="row.name" size="small" placeholder="请输入费用项名称" />
                </template>
              </el-table-column>
              <el-table-column label="单位" width="90" align="center">
                <template #default="{ row }">
                  <el-input v-model="row.unit" size="small" placeholder="元/t/台班" style="text-align: center;" />
                </template>
              </el-table-column>
              <el-table-column label="消耗量" width="110" align="right">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.consumption"
                    :min="0"
                    :precision="4"
                    :controls="false"
                    size="small"
                    style="width: 100%"
                    @change="recalculateManualRow(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="单价" width="110" align="right">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.price"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    size="small"
                    style="width: 100%"
                    @change="recalculateManualRow(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="合价(元)" width="120" align="right">
                <template #default="{ row }">
                  <strong>{{ formatAmount(row.amount, 2) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" link size="small" @click="deleteManualBreakdownRow($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </section>

      <!-- 未选中清单项时的空状态 -->
      <section v-else class="cost-template-panel" style="padding: 40px; text-align: center;">
        <el-empty :description="activeFileId ? '请在上方项目清单预算总览中选择一个清单行进行测算' : '请选择或创建预算测算文件'">
          <el-button v-if="!activeFileId" type="primary" size="small" @click="handleCreateRoadTemplateFile">
            使用路面固定模板
          </el-button>
        </el-empty>
      </section>

      <!-- 定额模板套用选择弹窗 -->
      <el-dialog
        v-model="showQuotaDialog"
        title="套用定额模板"
        width="500px"
        destroy-on-close
      >
        <div style="font-size: 0.8125rem; color: var(--el-text-color-secondary); margin-bottom: 12px;">
          请选择适合当前清单项的内部定额模板，系统将载入相应的参数和工效计算逻辑。
        </div>
        <div class="quota-dialog-list" style="display: flex; flex-direction: column; gap: 8px;">
          <button
            v-for="item in quotaItems"
            :key="item.id"
            type="button"
            class="cost-quota-item"
            style="text-align: left; border: 1px solid var(--cost-border-soft); padding: 10px; border-radius: 6px; cursor: pointer; background: var(--cost-surface-panel-soft); transition: all 0.2s; display: flex; flex-direction: column; gap: 4px;"
            @click="applyQuotaTemplate(item)"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-weight: bold; color: var(--cost-text-title); font-size: 0.875rem;">{{ item.code }}</span>
              <el-tag size="small" type="info">{{ item.baseUnit }}基准</el-tag>
            </div>
            <div style="font-size: 0.8125rem; font-weight: bold; color: var(--cost-text-title);">{{ item.name }}</div>
            <div style="font-size: 0.75rem; color: var(--el-text-color-secondary);">{{ item.caliber }}</div>
          </button>
        </div>
      </el-dialog>

      <!-- 从项目导入清单项弹窗 -->
      <el-dialog
        v-model="showImportDialog"
        title="从项目导入清单项"
        width="600px"
        destroy-on-close
        @open="handleImportDialogOpen"
      >
        <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 0.8125rem;">选择来源项目：</span>
          <el-select
            v-model="importProjectId"
            placeholder="选择项目"
            size="small"
            filterable
            style="width: 250px;"
            @change="loadImportProjectBOQs"
          >
            <el-option
              v-for="p in allProjects"
              :key="p.id"
              :label="`${p.code} ${p.name}`"
              :value="p.id"
            />
          </el-select>
        </div>
        
        <el-table
          ref="importTableRef"
          :data="importBOQRows"
          border
          size="small"
          style="width: 100%; max-height: 300px;"
          @selection-change="handleImportSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="itemName" label="清单名称" min-width="200" />
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="quantity" label="工程量" width="100" align="right" />
        </el-table>

        <template #footer>
          <div class="dialog-footer">
            <el-button size="small" @click="showImportDialog = false">取消</el-button>
            <el-button
              size="small"
              type="primary"
              :disabled="selectedImportRows.length === 0"
              @click="confirmImport"
            >
              确认导入 ({{ selectedImportRows.length }}项)
            </el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </section>
</template>


<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Plus, Search, Delete, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type TableColumnCtx } from 'element-plus'
import { formatAmount, roundAmount } from '@/utils/calculations'
import {
  buildCostFeeSummary,
  estimateMixtureUnitPrice,
  estimatePavementDirectCostM3,
} from '@/services/cost-estimate.service'
import type { PriceResourceItem, PriceQuote, QuotaItem, ParamRule } from '../useCostManagement'
import type { BudgetFile } from '@/services/budget-file.service'
import { projectService } from '@/services/project.service'
import { contractService, boqService } from '@/services/contract.service'
import { boqCodeLibraryService, type BOQCodeOption, type BOQCodeStandard } from '@/services/boq-code-library.service'

type MeasurementUnit = 'm3' | 'm2'
type SupplyMode = 'finishedDelivered' | 'finishedExFactory' | 'selfMixing'

const DEFAULT_SUPPLY_MODE: SupplyMode = 'finishedDelivered'

interface BudgetRow {
  id: string
  codeStandard: BOQCodeStandard
  itemCode: string
  itemName: string
  pricingMode: 'quota' | 'manual'
  linkedQuotaId?: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
}

interface AnalysisRow {
  group: string
  name: string
  unit: string
  consumption: number
  price: number
  amount: number
  formula: string
  resourceId?: string
  resourceIds?: string[]
}

interface MaterialSourceRow {
  resourceId: string
  name: string
  ratio: number
  unit: string
  price: number
  source: string
  collectedAt: string
  effectiveRegion: string
}

interface MaterialDisplayRow extends MaterialSourceRow {
  mixRatioText: string
}

interface FinishedMaterialRow {
  resourceId: string
  name: string
  unit: string
  price: number
  source: string
  collectedAt: string
  effectiveRegion: string
}

interface BOQItem {
  id: string
  codeStandard?: BOQCodeStandard
  itemCode: string
  itemName: string
  unit: string
  quantity: number
  pricingMode: 'quota' | 'manual'
  linkedQuotaId?: string
  supplyMode?: SupplyMode
  finishedResourceId?: string
  finishedQuoteId?: string
  manualUnitPrice: number
  manualBreakdown: Array<{
    id: string
    category: 'labor' | 'material' | 'machine' | 'transport' | 'other'
    name: string
    unit: string
    consumption: number
    price: number
    amount: number
  }>
}

const props = defineProps<{
  priceResourceItems: PriceResourceItem[]
  selectedQuoteMap: Record<string, string>
  quotaItems?: QuotaItem[]
  paramRules?: Record<string, Record<string, ParamRule>>
  budgetFiles: BudgetFile[]
  budgetFilesLoaded?: boolean
}>()

const emit = defineEmits<{
  (e: 'create-file', name: string, content: string): void
  (e: 'update-file', id: number, name: string, content: string): void
  (e: 'delete-file', id: number): void
}>()

const ROAD_BUDGET_TEMPLATE_NAME = '路面成本测算固定模板'

function buildRoadBudgetTemplateContent(selectedQuoteMap: Record<string, string>): string {
  return JSON.stringify({
    projectBOQItems: [
      {
        id: 'boq-1',
        codeStandard: 'municipal',
        itemCode: '040203001',
        itemName: '中粒式沥青混凝土下面层 AC-20C',
        unit: 'm2',
        quantity: 12000,
        pricingMode: 'quota',
        linkedQuotaId: 'LM-AC20C',
        supplyMode: DEFAULT_SUPPLY_MODE,
        finishedResourceId: 'R-FIN-AC20C',
        finishedQuoteId: 'Q-FIN-AC20C-D',
        manualUnitPrice: 260,
        manualBreakdown: []
      },
      {
        id: 'boq-2',
        codeStandard: 'municipal',
        itemCode: '040203002',
        itemName: '细粒式沥青混凝土上面层 AC-13C',
        unit: 'm2',
        quantity: 12000,
        pricingMode: 'quota',
        linkedQuotaId: 'LM-AC13C',
        supplyMode: DEFAULT_SUPPLY_MODE,
        finishedResourceId: 'R-FIN-AC13C',
        finishedQuoteId: 'Q-FIN-AC13C-D',
        manualUnitPrice: 180,
        manualBreakdown: []
      }
    ],
    quotaMeasures: {
      'LM-AC20C': { thicknessCm: 6, density: 2.38, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 108, paverProductivity: 1333, rollerProductivity: 1258, asphaltRatio: 4.5, coarseRatio: 60.0, fineRatio: 32.5, powderRatio: 3.0 },
      'LM-AC13C': { thicknessCm: 4, density: 2.36, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 108, paverProductivity: 1333, rollerProductivity: 1258, asphaltRatio: 5.0, coarseRatio: 60.0, fineRatio: 32.0, powderRatio: 3.0 },
      'LM-SMA13': { thicknessCm: 4, density: 2.42, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 100, paverProductivity: 1200, rollerProductivity: 1100, asphaltRatio: 6.0, coarseRatio: 72.0, fineRatio: 16.0, powderRatio: 6.0 },
      'LM-AC25C': { thicknessCm: 8, density: 2.40, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 115, paverProductivity: 1400, rollerProductivity: 1300, asphaltRatio: 4.0, coarseRatio: 62.0, fineRatio: 31.0, powderRatio: 3.0 },
      'LM-TACK': { thicknessCm: 0, density: 0, lossRate: 3, haulDistanceKm: 18, managementRate: 3, profitRate: 4, taxRate: 9, tackApplicationRate: 0.0012, sprayProductivity: 3000 },
      'LM-PRIME': { thicknessCm: 0, density: 0, lossRate: 3, haulDistanceKm: 18, managementRate: 3, profitRate: 4, taxRate: 9, tackApplicationRate: 0.0012, sprayProductivity: 2500 },
      'LM-MILL-04': { thicknessCm: 4, density: 0, lossRate: 0, haulDistanceKm: 5, managementRate: 5, profitRate: 5, taxRate: 9, millProductivity: 2000, slagFactor: 0.1 },
      'LM-BASE-CSM': { thicknessCm: 20, density: 2.30, lossRate: 3, haulDistanceKm: 10, managementRate: 4, profitRate: 5, taxRate: 9, laborProductivity: 120, paverProductivity: 1500, rollerProductivity: 1400, asphaltRatio: 5.0, coarseRatio: 65.0, fineRatio: 30.0, powderRatio: 0.0 }
    },
    selectedQuoteMap
  })
}

const activeFileId = ref<number | null>(null)
const projectBOQItems = reactive<BOQItem[]>([])
const selectedBOQItemId = ref('')

// Import dialog states
const showImportDialog = ref(false)
const importProjectId = ref<number | null>(null)
const allProjects = ref<any[]>([])
const importBOQRows = ref<any[]>([])
const selectedImportRows = ref<any[]>([])
const importTableRef = ref<any>(null)

// Load projects when dialog opens
async function handleImportDialogOpen() {
  allProjects.value = await projectService.getAll()
  importProjectId.value = null
  importBOQRows.value = []
  selectedImportRows.value = []
}

// Load BOQs when project selected
async function loadImportProjectBOQs(projectId: number) {
  importBOQRows.value = []
  selectedImportRows.value = []
  if (!projectId) return
  
  try {
    const contracts = await contractService.getAllByProjectId(projectId)
    const allBOQs: any[] = []
    for (const c of contracts) {
      const boqs = await boqService.getByContractId(c.id)
      allBOQs.push(...boqs)
    }
    importBOQRows.value = allBOQs
  } catch (error) {
    console.error(error)
    ElMessage.error('加载项目清单项失败')
  }
}

function handleImportSelectionChange(selection: any[]) {
  selectedImportRows.value = selection
}

function confirmImport() {
  if (selectedImportRows.value.length === 0) return
  
  selectedImportRows.value.forEach(row => {
    // Map keywords to quota template or manual
    let pricingMode: 'quota' | 'manual' = 'manual'
    let linkedQuotaId: string | undefined = undefined
    
    const name = row.itemName || ''
    const matchedCode = inferBOQCodeOption(name)
    if (name.includes('AC-20') || name.includes('AC20')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-AC20C'
    } else if (name.includes('AC-13') || name.includes('AC13')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-AC13C'
    } else if (name.includes('SMA-13') || name.includes('SMA13')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-SMA13'
    } else if (name.includes('AC-25') || name.includes('AC25')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-AC25C'
    } else if (name.includes('粘层')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-TACK'
    } else if (name.includes('透层')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-PRIME'
    } else if (name.includes('铣刨')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-MILL-04'
    } else if (name.includes('水稳') || name.includes('水泥稳定碎石') || name.includes('基层')) {
      pricingMode = 'quota'
      linkedQuotaId = 'LM-BASE-CSM'
    }
    
    projectBOQItems.push({
      id: `boq-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      codeStandard: matchedCode?.standard || 'custom',
      itemCode: row.itemCode || matchedCode?.code || '',
      itemName: row.itemName || '',
      unit: row.unit || matchedCode?.unit || 'm2',
      quantity: Number(row.quantity || 0),
      pricingMode,
      linkedQuotaId,
      supplyMode: DEFAULT_SUPPLY_MODE,
      finishedResourceId: getDefaultFinishedResourceId(linkedQuotaId),
      manualUnitPrice: Number(row.unitPrice || 0) || 100,
      manualBreakdown: []
    })
  })
  
  showImportDialog.value = false
  ElMessage.success(`成功导入 ${selectedImportRows.value.length} 个清单项，请确认测算参数并点击"保存文件"！`)
  
  if (projectBOQItems.length > 0) {
    selectedBOQItemId.value = projectBOQItems[projectBOQItems.length - 1].id
  }
}

// Editable columns sync
function syncBOQItemField(id: string, field: keyof BOQItem, val: any) {
  const item = projectBOQItems.find(i => i.id === id)
  if (item) {
    (item as any)[field] = val
  }
}

function getBOQCodeOptions(standard?: BOQCodeStandard): BOQCodeOption[] {
  return boqCodeLibraryService.listByStandard(standard)
}

function inferBOQCodeOption(name: string): BOQCodeOption | undefined {
  return boqCodeLibraryService.inferByName(name)
}

function normalizeBOQItem(item: BOQItem): BOQItem {
  return {
    ...item,
    codeStandard: item.codeStandard || 'custom',
    supplyMode: item.supplyMode || DEFAULT_SUPPLY_MODE,
    finishedResourceId: item.finishedResourceId || getDefaultFinishedResourceId(item.linkedQuotaId),
    manualBreakdown: item.manualBreakdown || [],
  }
}

function handleBOQCodeChange(row: BudgetRow) {
  const option = getBOQCodeOptions(row.codeStandard).find(item => item.code === row.itemCode)
  syncBOQItemField(row.id, 'itemCode', row.itemCode)
  if (!option) return
  const item = projectBOQItems.find(i => i.id === row.id)
  if (!item) return
  if (!item.itemName || item.itemName === '自填/新增测算项目') {
    item.itemName = option.name
  }
  if (!item.unit) {
    item.unit = option.unit
  }
}

function handleAddBOQItem() {
  const newItem: BOQItem = {
    id: `boq-new-${Date.now()}`,
    codeStandard: 'custom',
    itemCode: `04020300${projectBOQItems.length + 1}`,
    itemName: '自填/新增测算项目',
    unit: 'm2',
    quantity: 1000,
    pricingMode: 'manual',
    linkedQuotaId: undefined,
    supplyMode: DEFAULT_SUPPLY_MODE,
    finishedResourceId: getDefaultFinishedResourceId(),
    manualUnitPrice: 100,
    manualBreakdown: []
  }
  projectBOQItems.push(newItem)
  selectedBOQItemId.value = newItem.id
}

function handleDeleteBOQItem() {
  if (!selectedBOQItemId.value) return
  const index = projectBOQItems.findIndex(item => item.id === selectedBOQItemId.value)
  if (index !== -1) {
    projectBOQItems.splice(index, 1)
    if (projectBOQItems.length > 0) {
      selectedBOQItemId.value = projectBOQItems[Math.max(0, index - 1)].id
    } else {
      selectedBOQItemId.value = ''
    }
  }
}

const showQuotaDialog = ref(false)

function getQuotesForResource(resourceId: string): PriceQuote[] {
  const resource = props.priceResourceItems.find(r => r.id === resourceId)
  return resource?.quotes || []
}

function getQuotePrice(resourceId: string): number {
  const quotes = getQuotesForResource(resourceId)
  const selectedQuoteId = props.selectedQuoteMap[resourceId]
  const quote = quotes.find(q => q.id === selectedQuoteId) || quotes[0]
  return quote?.price || 0
}

function getQuoteSupplier(resourceId: string): string {
  const quotes = getQuotesForResource(resourceId)
  const selectedQuoteId = props.selectedQuoteMap[resourceId]
  const quote = quotes.find(q => q.id === selectedQuoteId) || quotes[0]
  return quote?.supplier || '无价格来源'
}

// File CRUD operations
function handleFileChange(id: number | null) {
  if (!id) {
    projectBOQItems.splice(0, projectBOQItems.length)
    selectedBOQItemId.value = ''
    return
  }
  const file = props.budgetFiles.find(f => f.id === id)
  if (file && file.content) {
    try {
      const data = JSON.parse(file.content)
      if (data.projectBOQItems) {
        projectBOQItems.splice(0, projectBOQItems.length, ...data.projectBOQItems.map((item: BOQItem) => normalizeBOQItem(item)))
      }
      if (data.quotaMeasures) {
        Object.assign(quotaMeasures, data.quotaMeasures)
      }
      if (data.selectedQuoteMap) {
        Object.assign(props.selectedQuoteMap, data.selectedQuoteMap)
      }
      if (projectBOQItems.length > 0) {
        selectedBOQItemId.value = projectBOQItems[0].id
      } else {
        selectedBOQItemId.value = ''
      }
    } catch (e) {
      console.error(e)
      ElMessage.error('解析预算文件内容失败')
    }
  }
}

function handleSaveFile() {
  if (!activeFileId.value) return
  const file = props.budgetFiles.find(f => f.id === activeFileId.value)
  if (!file) return

  const content = JSON.stringify({
    projectBOQItems: projectBOQItems,
    quotaMeasures: quotaMeasures,
    selectedQuoteMap: props.selectedQuoteMap,
    computedBOQItems: budgetRows.value
  })

  emit('update-file', activeFileId.value, file.name, content)
  ElMessage.success(`预算测算文件 "${file.name}" 保存成功！`)
}

function handleSaveAsFile() {
  if (!activeFileId.value) return
  ElMessageBox.prompt('请输入新的测算文件名称', '另存为', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '文件名称不能为空'
  }).then(({ value }) => {
    const content = JSON.stringify({
      projectBOQItems: projectBOQItems,
      quotaMeasures: quotaMeasures,
      selectedQuoteMap: props.selectedQuoteMap,
      computedBOQItems: budgetRows.value
    })
    emit('create-file', value, content)
  }).catch(() => {})
}

function handleCreateFile() {
  ElMessageBox.prompt('请输入测算文件名称', '新建预算测算文件', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '文件名称不能为空'
  }).then(({ value }) => {
    const defaultContent = buildRoadBudgetTemplateContent(props.selectedQuoteMap)
    emit('create-file', value, defaultContent)
  }).catch(() => {})
}

function handleCreateRoadTemplateFile() {
  emit('create-file', ROAD_BUDGET_TEMPLATE_NAME, buildRoadBudgetTemplateContent(props.selectedQuoteMap))
}

function handleDeleteFile() {
  if (!activeFileId.value) return
  const file = props.budgetFiles.find(f => f.id === activeFileId.value)
  if (!file) return
  ElMessageBox.confirm(`确定要删除预算测算文件 "${file.name}" 吗？`, '删除提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    emit('delete-file', activeFileId.value!)
    activeFileId.value = null
  }).catch(() => {})
}

// Watch budget files to auto-select existing files. New files are created only by user action.
watch(
  () => props.budgetFiles,
  (newFiles) => {
    if (props.budgetFilesLoaded === false) return
    if (newFiles && newFiles.length > 0) {
      if (!activeFileId.value || !newFiles.some(f => f.id === activeFileId.value)) {
        activeFileId.value = newFiles[0].id
        handleFileChange(activeFileId.value)
      }
    }
  },
  { immediate: true, deep: true }
)

const selectedBOQItem = computed(() => projectBOQItems.find(item => item.id === selectedBOQItemId.value))

watch(
  () => [
    selectedBOQItem.value?.id,
    selectedBOQItem.value?.linkedQuotaId,
    selectedBOQItem.value?.supplyMode,
    props.priceResourceItems.length,
  ],
  () => {
    const item = selectedBOQItem.value
    if (!item || item.pricingMode !== 'quota' || !item.linkedQuotaId || !isMixtureQuota(item.linkedQuotaId)) return
    item.finishedResourceId = item.finishedResourceId || getDefaultFinishedResourceId(item.linkedQuotaId)
    if (getSupplyMode(item) === 'selfMixing') {
      ensureSelectedQuoteForResource(item.finishedResourceId, item)
    } else {
      chooseFinishedQuoteForSupplyMode(item, getSupplyMode(item))
    }
  },
  { immediate: true },
)

const activeQuotaId = computed(() => {
  if (selectedBOQItem.value && selectedBOQItem.value.pricingMode === 'quota') {
    return selectedBOQItem.value.linkedQuotaId || 'LM-AC20C'
  }
  return 'LM-AC20C'
})

const measurementUnit = ref<MeasurementUnit>('m3')

// 针对每个定额项独立保留的测算参数状态
const quotaMeasures = reactive<Record<string, {
  thicknessCm: number
  density: number
  lossRate: number
  haulDistanceKm: number
  managementRate: number
  profitRate: number
  taxRate: number
  
  // 工效/生产率参数
  laborProductivity?: number
  paverProductivity?: number
  rollerProductivity?: number
  tackApplicationRate?: number
  sprayProductivity?: number
  millProductivity?: number
  slagFactor?: number

  // 材料配比 (百分比值，如 4.5 代表 4.5%)
  asphaltRatio?: number
  coarseRatio?: number
  fineRatio?: number
  powderRatio?: number
}>>({
  'LM-AC20C': { thicknessCm: 6, density: 2.38, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 108, paverProductivity: 1333, rollerProductivity: 1258, asphaltRatio: 4.5, coarseRatio: 60.0, fineRatio: 32.5, powderRatio: 3.0 },
  'LM-AC13C': { thicknessCm: 4, density: 2.36, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 108, paverProductivity: 1333, rollerProductivity: 1258, asphaltRatio: 5.0, coarseRatio: 60.0, fineRatio: 32.0, powderRatio: 3.0 },
  'LM-SMA13': { thicknessCm: 4, density: 2.42, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 100, paverProductivity: 1200, rollerProductivity: 1100, asphaltRatio: 6.0, coarseRatio: 72.0, fineRatio: 16.0, powderRatio: 6.0 },
  'LM-AC25C': { thicknessCm: 8, density: 2.40, lossRate: 2, haulDistanceKm: 18, managementRate: 5, profitRate: 6, taxRate: 9, laborProductivity: 115, paverProductivity: 1400, rollerProductivity: 1300, asphaltRatio: 4.0, coarseRatio: 62.0, fineRatio: 31.0, powderRatio: 3.0 },
  'LM-TACK': { thicknessCm: 0, density: 0, lossRate: 3, haulDistanceKm: 18, managementRate: 3, profitRate: 4, taxRate: 9, tackApplicationRate: 0.0012, sprayProductivity: 3000 },
  'LM-PRIME': { thicknessCm: 0, density: 0, lossRate: 3, haulDistanceKm: 18, managementRate: 3, profitRate: 4, taxRate: 9, tackApplicationRate: 0.0012, sprayProductivity: 2500 },
  'LM-MILL-04': { thicknessCm: 4, density: 0, lossRate: 0, haulDistanceKm: 5, managementRate: 5, profitRate: 5, taxRate: 9, millProductivity: 2000, slagFactor: 0.1 },
  'LM-BASE-CSM': { thicknessCm: 20, density: 2.30, lossRate: 3, haulDistanceKm: 10, managementRate: 4, profitRate: 5, taxRate: 9, laborProductivity: 120, paverProductivity: 1500, rollerProductivity: 1400, asphaltRatio: 5.0, coarseRatio: 65.0, fineRatio: 30.0, powderRatio: 0.0 }
})

const defaultAsphaltMixingComponents = [
  {
    id: 'tpl-asphalt-mixing',
    category: 'mixing' as const,
    name: '沥青混合料拌合费',
    unit: 't',
    basis: 'tonnage' as const,
    consumption: 1,
    price: 12,
    formula: '按混合料吨耗计入拌合站加工费',
  },
]

const defaultCementStabilizedMixingComponents = [
  {
    id: 'tpl-csm-mixing',
    category: 'mixing' as const,
    name: '水泥稳定碎石拌合费',
    unit: 't',
    basis: 'tonnage' as const,
    consumption: 1,
    price: 8,
    formula: '按水稳混合料吨耗计入集中拌合费',
  },
]

const localDefaultQuotaItems: QuotaItem[] = [
  {
    id: 'LM-AC20C',
    code: 'NB-LM-001',
    name: 'AC-20C 沥青混凝土下面层',
    baseUnit: 'm3',
    defaultThicknessCm: 6,
    density: 2.38,
    lossRate: 2,
    caliber: '定额 m3 基准，清单厚度换算为 m2',
    components: defaultAsphaltMixingComponents,
  },
  {
    id: 'LM-AC13C',
    code: 'NB-LM-002',
    name: 'AC-13C 沥青混凝土上面层',
    baseUnit: 'm3',
    defaultThicknessCm: 4,
    density: 2.36,
    lossRate: 2,
    caliber: '定额 m3 基准，清单厚度换算为 m2',
    components: defaultAsphaltMixingComponents,
  },
  {
    id: 'LM-SMA13',
    code: 'NB-LM-003',
    name: 'SMA-13 沥青玛蹄脂碎石上面层',
    baseUnit: 'm3',
    defaultThicknessCm: 4,
    density: 2.42,
    lossRate: 2,
    caliber: 'SMA高等级面层，定额 m3 基准，清单厚度换算为 m2',
    components: defaultAsphaltMixingComponents,
  },
  {
    id: 'LM-AC25C',
    code: 'NB-LM-004',
    name: 'AC-25C 沥青混凝土下面层',
    baseUnit: 'm3',
    defaultThicknessCm: 8,
    density: 2.40,
    lossRate: 2,
    caliber: '粗粒式下面层，定额 m3 基准，清单厚度换算为 m2',
    components: defaultAsphaltMixingComponents,
  },
  {
    id: 'LM-TACK',
    code: 'NB-LM-011',
    name: '乳化沥青粘层油',
    baseUnit: 'm2',
    defaultThicknessCm: 0,
    density: 0,
    lossRate: 3,
    caliber: '油层按 m2 测算，无厚度换算',
    components: [],
  },
  {
    id: 'LM-PRIME',
    code: 'NB-LM-012',
    name: '乳化沥青/煤沥青透层油',
    baseUnit: 'm2',
    defaultThicknessCm: 0,
    density: 0,
    lossRate: 3,
    caliber: '透层按 m2 测算，无厚度换算',
    components: [],
  },
  {
    id: 'LM-MILL-04',
    code: 'NB-LM-021',
    name: '旧沥青路面铣刨',
    baseUnit: 'm2',
    defaultThicknessCm: 4,
    density: 0,
    lossRate: 0,
    caliber: '旧路铣刨按设计厚度直接测算 m2',
    components: [],
  },
  {
    id: 'LM-BASE-CSM',
    code: 'NB-LM-031',
    name: '水泥稳定碎石基层',
    baseUnit: 'm3',
    defaultThicknessCm: 20,
    density: 2.30,
    lossRate: 3,
    caliber: '水稳基层，定额 m3 基准，清单厚度换算为 m2',
    components: defaultCementStabilizedMixingComponents,
  },
]

// 行业规范或经验数据校验规则
const localDefaultParamRules: Record<string, Record<string, ParamRule>> = {
  'LM-AC20C': {
    thicknessCm: { defaultVal: 6.0, minValid: 5.0, maxValid: 10.0, desc: '规范推荐厚度 6~8cm，过薄易开裂，过厚难以压实。', warningMsg: '厚度超出合理范围(5~10cm)！' },
    density: { defaultVal: 2.38, minValid: 2.25, maxValid: 2.45, desc: 'AC-20C 设计压实密度通常在 2.35~2.42 t/m³ 之间。', warningMsg: '密度超出合理设计范围(2.25~2.45 t/m³)！' },
    lossRate: { defaultVal: 2.0, minValid: 1.0, maxValid: 4.0, desc: '路面施工经验损耗率 1.0%~4.0%。', warningMsg: '损耗率异常(合理范围: 1%~4%)！' },
    haulDistanceKm: { defaultVal: 18.0, minValid: 5.0, maxValid: 50.0, desc: '合理成品运输距离 5~50km。过长会导致沥青混合料严重温度离析。', warningMsg: '运距过短或有温度离析风险(5~50km)！' },
    managementRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '企业管理费计取率通常为 2.0%~10.0%。', warningMsg: '管理费率超出常规测算标准！' },
    profitRate: { defaultVal: 6.0, minValid: 2.0, maxValid: 12.0, desc: '测算利润计取率通常为 2.0%~12.0%。', warningMsg: '利润率超出常规测算标准！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '建筑业一般计税 VAT 增值税标准为 9%，简易征收为 3%。', warningMsg: '税率不符合标准规范(3% 或 9%)！' },
    laborProductivity: { defaultVal: 108, minValid: 90, maxValid: 130, desc: '规范配合人工工效一般为 90~130 m²/工日。', warningMsg: '人工工效偏离行业规范合理区间(90~130)！' },
    paverProductivity: { defaultVal: 1333, minValid: 1000, maxValid: 1600, desc: '9m摊铺机台班摊铺面积一般为 1000~1600 m²/台班。', warningMsg: '摊铺机工效偏离行业常规合理区间(1000~1600)！' },
    rollerProductivity: { defaultVal: 1258, minValid: 900, maxValid: 1500, desc: '压路机组合联合台班压实面积一般为 900~1500 m²/台班。', warningMsg: '压路机工效偏离行业常规合理区间(900~1500)！' },
    asphaltRatio: { defaultVal: 4.5, minValid: 3.5, maxValid: 6.5, desc: '沥青含量百分比（通常为 3.5%~6.5%）。', warningMsg: '沥青配比超出常规设计范围！' },
    coarseRatio: { defaultVal: 60.0, minValid: 45.0, maxValid: 75.0, desc: '粗集料比例（通常为 45%~75%）。', warningMsg: '粗集料配比超出常规设计范围！' },
    fineRatio: { defaultVal: 32.5, minValid: 20.0, maxValid: 45.0, desc: '细集料比例（通常为 20%~45%）。', warningMsg: '细集料配比超出常规设计范围！' },
    powderRatio: { defaultVal: 3.0, minValid: 1.5, maxValid: 6.0, desc: '矿粉比例（通常为 1.5%~6.0%）。', warningMsg: '矿粉配比超出常规设计范围！' }
  },
  'LM-AC13C': {
    thicknessCm: { defaultVal: 4.0, minValid: 3.0, maxValid: 6.0, desc: '上面层推荐厚度 3~5cm。厚度需与粗骨料最大粒径匹配，太薄易脱落。', warningMsg: '上面层厚度异常(3~6cm)！' },
    density: { defaultVal: 2.36, minValid: 2.25, maxValid: 2.45, desc: 'AC-13C 设计压实密度通常在 2.34~2.42 t/m³ 之间。', warningMsg: '密度超出合理设计范围(2.25~2.45 t/m³)！' },
    lossRate: { defaultVal: 2.0, minValid: 1.0, maxValid: 4.0, desc: '上面层施工经验损耗率 1.0%~4.0%。', warningMsg: '损耗率异常(合理范围: 1%~4%)！' },
    haulDistanceKm: { defaultVal: 18.0, minValid: 5.0, maxValid: 50.0, desc: '成品料合理运距 5~50km。运距过长会导致上面层摊铺温度过低。', warningMsg: '运距过长将导致摊铺离析(5~50km)！' },
    managementRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '企业管理费计取率通常为 2.0%~10.0%。', warningMsg: '管理费率超出常规测算标准！' },
    profitRate: { defaultVal: 6.0, minValid: 2.0, maxValid: 12.0, desc: '测算利润计取率通常为 2.0%~12.0%。', warningMsg: '利润率超出常规测算标准！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '增值税标准税率为 9% 或 3%。', warningMsg: '税率不符合标准规范(3% 或 9%)！' },
    laborProductivity: { defaultVal: 108, minValid: 90, maxValid: 130, desc: '规范配合人工工效一般为 90~130 m²/工日。', warningMsg: '人工工效偏离行业规范合理区间(90~130)！' },
    paverProductivity: { defaultVal: 1333, minValid: 1000, maxValid: 1600, desc: '9m摊铺机台班摊铺面积一般为 1000~1600 m²/台班.。', warningMsg: '摊铺机工效偏离行业常规合理区间(1000~1600)！' },
    rollerProductivity: { defaultVal: 1258, minValid: 900, maxValid: 1500, desc: '压路机组合联合台班压实面积一般为 900~1500 m²/台班。', warningMsg: '压路机工效偏离行业常规合理区间(900~1500)！' },
    asphaltRatio: { defaultVal: 5.0, minValid: 3.5, maxValid: 6.5, desc: '沥青含量百分比（通常为 3.5%~6.5%）。', warningMsg: '沥青配比超出常规设计范围！' },
    coarseRatio: { defaultVal: 60.0, minValid: 45.0, maxValid: 75.0, desc: '粗集料比例（通常为 45%~75%）。', warningMsg: '粗集料配比异常！' },
    fineRatio: { defaultVal: 32.0, minValid: 20.0, maxValid: 45.0, desc: '细集料比例（通常为 20%~45%）。', warningMsg: '细集料配比异常！' },
    powderRatio: { defaultVal: 3.0, minValid: 1.5, maxValid: 6.0, desc: '矿粉比例（通常为 1.5%~6.0%）。', warningMsg: '矿粉配比异常！' }
  },
  'LM-SMA13': {
    thicknessCm: { defaultVal: 4.0, minValid: 3.5, maxValid: 5.0, desc: '上面层推荐厚度 3.5~5cm。需配合改性沥青与木质素纤维铺筑。', warningMsg: 'SMA-13厚度建议在3.5~5cm区间！' },
    density: { defaultVal: 2.42, minValid: 2.38, maxValid: 2.46, desc: 'SMA-13 设计压实密度通常在 2.38~2.46 t/m³ 之间。', warningMsg: '密度超出合理设计范围！' },
    lossRate: { defaultVal: 2.0, minValid: 1.0, maxValid: 4.0, desc: '施工经验损耗率 1.0%~4.0%。', warningMsg: '损耗率异常(合理范围: 1%~4%)！' },
    haulDistanceKm: { defaultVal: 18.0, minValid: 5.0, maxValid: 50.0, desc: '合理成品运输距离 5~50km。', warningMsg: '运距异常！' },
    managementRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '企业管理费计取率通常为 2.0%~10.0%。', warningMsg: '管理费率超出常规！' },
    profitRate: { defaultVal: 6.0, minValid: 2.0, maxValid: 12.0, desc: '测算利润计取率通常为 2.0%~12.0%。', warningMsg: '利润率超出常规！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '建筑业一般计税 VAT 增值税标准为 9%，简易征收为 3%。', warningMsg: '税率不符合规范！' },
    laborProductivity: { defaultVal: 100, minValid: 80, maxValid: 120, desc: 'SMA配合人工工效一般为 80~120 m²/工日（工艺复杂速度稍缓）。', warningMsg: '人工工效偏离合理区间！' },
    paverProductivity: { defaultVal: 1200, minValid: 900, maxValid: 1500, desc: '9m摊铺机台班摊铺面积一般为 900~1500 m²/台班。', warningMsg: '摊铺机工效偏离合理区间！' },
    rollerProductivity: { defaultVal: 1100, minValid: 800, maxValid: 1400, desc: 'SMA压实工效一般为 800~1400 m²/台班（需紧跟慢压、防过度碾压）。', warningMsg: '压路机工效偏离合理区间！' },
    asphaltRatio: { defaultVal: 6.0, minValid: 5.5, maxValid: 6.8, desc: 'SMA改性沥青含量百分比（通常为 5.5%~6.8%）。', warningMsg: '沥青配比超出常规设计范围！' },
    coarseRatio: { defaultVal: 72.0, minValid: 65.0, maxValid: 80.0, desc: '粗集料比例较高（通常为 65%~80%）。', warningMsg: '粗集料配比超出范围！' },
    fineRatio: { defaultVal: 16.0, minValid: 10.0, maxValid: 22.0, desc: '细集料比例较低（通常为 10%~22%）。', warningMsg: '细集料配比超出范围！' },
    powderRatio: { defaultVal: 6.0, minValid: 4.5, maxValid: 8.5, desc: '矿粉比例（通常为 4.5%~8.5%）。', warningMsg: '矿粉配比超出范围！' }
  },
  'LM-AC25C': {
    thicknessCm: { defaultVal: 8.0, minValid: 6.0, maxValid: 12.0, desc: '粗粒式下面层推荐厚度 6~12cm。', warningMsg: '厚度超出合理范围！' },
    density: { defaultVal: 2.40, minValid: 2.30, maxValid: 2.48, desc: 'AC-25C 设计压实密度通常在 2.30~2.48 t/m³ 之间。', warningMsg: '密度超出合理设计范围！' },
    lossRate: { defaultVal: 2.0, minValid: 1.0, maxValid: 4.0, desc: '路面施工经验损耗率 1.0%~4.0%。', warningMsg: '损耗率异常！' },
    haulDistanceKm: { defaultVal: 18.0, minValid: 5.0, maxValid: 50.0, desc: '合理成品运输距离 5~50km。', warningMsg: '运距异常！' },
    managementRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '企业管理费计取率通常为 2.0%~10.0%。', warningMsg: '管理费率超出常规！' },
    profitRate: { defaultVal: 6.0, minValid: 2.0, maxValid: 12.0, desc: '测算利润计取率通常为 2.0%~12.0%。', warningMsg: '利润率超出常规！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '增值税标准税率为 9% 或 3%。', warningMsg: '税率不符合规范！' },
    laborProductivity: { defaultVal: 115, minValid: 90, maxValid: 135, desc: '下面层人工工效一般为 90~135 m²/工日。', warningMsg: '人工工效偏离合理区间！' },
    paverProductivity: { defaultVal: 1400, minValid: 1000, maxValid: 1700, desc: '9m摊铺机台班摊铺面积一般为 1000~1700 m²/台班。', warningMsg: '摊铺机工效偏离合理区间！' },
    rollerProductivity: { defaultVal: 1300, minValid: 900, maxValid: 1600, desc: '压路机组合联合台班压实面积一般为 900~1600 m²/台班。', warningMsg: '压路机工效偏离合理区间！' },
    asphaltRatio: { defaultVal: 4.0, minValid: 3.2, maxValid: 5.0, desc: '沥青含量百分比（通常为 3.2%~5.0%）。', warningMsg: '沥青配比超出常规设计范围！' },
    coarseRatio: { defaultVal: 62.0, minValid: 50.0, maxValid: 75.0, desc: '粗集料比例（通常为 50%~75%）。', warningMsg: '粗集料配比超出常规！' },
    fineRatio: { defaultVal: 31.0, minValid: 20.0, maxValid: 40.0, desc: '细集料比例（通常为 20%~40%）。', warningMsg: '细集料配比超出常规！' },
    powderRatio: { defaultVal: 3.0, minValid: 1.5, maxValid: 6.0, desc: '矿粉比例（通常为 1.5%~6.0%）。', warningMsg: '矿粉配比超出常规！' }
  },
  'LM-TACK': {
    lossRate: { defaultVal: 3.0, minValid: 1.0, maxValid: 5.0, desc: '粘层油洒布洒漏损耗率经验值为 1.0%~5.0%。', warningMsg: '洒布损耗率超出常理(1%~5%)！' },
    managementRate: { defaultVal: 3.0, minValid: 1.0, maxValid: 10.0, desc: '通常为 1.0%~10.0%。', warningMsg: '费率偏离常规！' },
    profitRate: { defaultVal: 4.0, minValid: 1.0, maxValid: 12.0, desc: '通常为 1.0%~12.0%。', warningMsg: '费率偏离常规！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '标准税率 9% 或 3%。', warningMsg: '税率异常！' },
    tackApplicationRate: { defaultVal: 0.0012, minValid: 0.0008, maxValid: 0.0018, desc: '粘层油洒布量规范要求通常在 0.0008~0.0018 t/m² (即 0.8~1.8 kg/m²)。', warningMsg: '洒布油量超出规范限制(0.8~1.8 kg/m²)！' },
    sprayProductivity: { defaultVal: 3000, minValid: 2000, maxValid: 4000, desc: '沥青洒布车日均洒布面积经验值为 2000~4000 m²/台班。', warningMsg: '洒布车工效异常(合理范围: 2000~4000)！' }
  },
  'LM-PRIME': {
    lossRate: { defaultVal: 3.0, minValid: 1.0, maxValid: 5.0, desc: '透层油洒布洒漏损耗率经验值为 1.0%~5.0%。', warningMsg: '洒布损耗率超出常理(1%~5%)！' },
    managementRate: { defaultVal: 3.0, minValid: 1.0, maxValid: 10.0, desc: '通常为 1.0%~10.0%。', warningMsg: '费率偏离常规！' },
    profitRate: { defaultVal: 4.0, minValid: 1.0, maxValid: 12.0, desc: '通常为 1.0%~12.0%。', warningMsg: '费率偏离常规！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '标准税率 9% 或 3%。', warningMsg: '税率异常！' },
    tackApplicationRate: { defaultVal: 0.0012, minValid: 0.0008, maxValid: 0.0018, desc: '透层油洒布量规范要求通常在 0.0008~0.0018 t/m² (即 0.8~1.8 kg/m²)。', warningMsg: '洒布油量超出规范限制(0.8~1.8 kg/m²)！' },
    sprayProductivity: { defaultVal: 2500, minValid: 1800, maxValid: 3500, desc: '透层油洒布车日均洒布面积经验值为 1800~3500 m²/台班。', warningMsg: '洒布车工效异常！' }
  },
  'LM-MILL-04': {
    thicknessCm: { defaultVal: 4.0, minValid: 2.0, maxValid: 10.0, desc: '旧路铣刨深度通常在 2.0~10.0 cm 之间。', warningMsg: '单次铣刨深度异常(2~10cm)！' },
    haulDistanceKm: { defaultVal: 5.0, minValid: 1.0, maxValid: 30.0, desc: '铣刨渣土运输弃渣运距通常为 1~30km。', warningMsg: '渣土运距超出合理运输范围(1~30km)！' },
    managementRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '管理费率通常为 2.0%~10.0%。', warningMsg: '管理费率超出常规！' },
    profitRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '利润率通常为 2.0%~10.0%。', warningMsg: '利润率超出常规！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '标准税率 9% 或 3%。', warningMsg: '税率异常！' },
    millProductivity: { defaultVal: 2000, minValid: 1200, maxValid: 3000, desc: '2m铣刨机台班铣刨面积经验值为 1200~3000 m²/台班。', warningMsg: '铣刨机工效偏离经验区间(1200~3000)！' },
    slagFactor: { defaultVal: 0.100, minValid: 0.050, maxValid: 0.200, desc: '铣刨废料渣土重量系数通常在 0.05~0.2 t/m² 之间（按 2.3t/m³ 松散折算）。', warningMsg: '渣土重量系数异常！' }
  },
  'LM-BASE-CSM': {
    thicknessCm: { defaultVal: 20.0, minValid: 15.0, maxValid: 25.0, desc: '水泥稳定碎石基层设计厚度通常在 15~25cm。', warningMsg: '基层厚度异常！' },
    density: { defaultVal: 2.30, minValid: 2.15, maxValid: 2.40, desc: '水稳碎石干压实密度通常在 2.15~2.40 t/m³ 之间。', warningMsg: '水稳密度超出规范！' },
    lossRate: { defaultVal: 3.0, minValid: 1.5, maxValid: 5.0, desc: '水稳材料拌合施工损耗率通常为 1.5%~5.0%。', warningMsg: '损耗率设定偏高！' },
    haulDistanceKm: { defaultVal: 10.0, minValid: 2.0, maxValid: 30.0, desc: '基层水稳混合料合理运距 2~30km。', warningMsg: '运距超出合理范围！' },
    managementRate: { defaultVal: 4.0, minValid: 2.0, maxValid: 8.0, desc: '基层企业管理费率通常为 2.0%~8.0%。', warningMsg: '管理费率超出常规！' },
    profitRate: { defaultVal: 5.0, minValid: 2.0, maxValid: 10.0, desc: '测算利润计取率通常为 2.0%~10.0%。', warningMsg: '利润率超出常规！' },
    taxRate: { defaultVal: 9.0, minValid: 3.0, maxValid: 9.0, desc: '标准增值税率 9% 或 3%。', warningMsg: '税率异常！' },
    laborProductivity: { defaultVal: 120, minValid: 90, maxValid: 150, desc: '水稳基层人工工效一般为 90~150 m²/工日。', warningMsg: '人工工效偏离合理区间！' },
    paverProductivity: { defaultVal: 1500, minValid: 1000, maxValid: 1800, desc: '水稳专用摊铺机台班工效一般为 1000~1800 m²/台班。', warningMsg: '摊铺机工效偏离合理区间！' },
    rollerProductivity: { defaultVal: 1400, minValid: 900, maxValid: 1700, desc: '大吨位压路机组合联合台班工效一般为 900~1700 m²/台班。', warningMsg: '压路机工效偏离合理区间！' },
    asphaltRatio: { defaultVal: 5.0, minValid: 3.5, maxValid: 6.5, desc: '水泥设计剂量（通常为 3.5%~6.5%，过高易产生收缩开裂）。', warningMsg: '水泥剂量配比超出设计范围！' },
    coarseRatio: { defaultVal: 65.0, minValid: 50.0, maxValid: 75.0, desc: '粗集料级配比例（通常为 50%~75%）。', warningMsg: '粗集料比例异常！' },
    fineRatio: { defaultVal: 30.0, minValid: 20.0, maxValid: 45.0, desc: '细砂及石屑级配比例（通常为 20%~45%）。', warningMsg: '细集料比例异常！' },
    powderRatio: { defaultVal: 0.0, minValid: 0.0, maxValid: 5.0, desc: '一般水稳不加或极少加矿粉。', warningMsg: '矿粉配比不建议过高！' }
  }
}

const quotaItems = computed(() => props.quotaItems || localDefaultQuotaItems)
const paramRules = computed(() => props.paramRules || localDefaultParamRules)

// 检查参数是否完全偏离规范值（标红判定）
function isParamInvalid(quotaId: string, paramKey: string, val: number): boolean {
  const rules = paramRules.value[quotaId]?.[paramKey]
  if (!rules) return false
  if (rules.minValid === 0 && rules.maxValid === 0) return false // 占位无校验
  return val < rules.minValid || val > rules.maxValid
}

// 获取参数的悬停信息说明，若不合规则在头部追加 【⚠️警告】
function getParamTooltip(quotaId: string, paramKey: string): string {
  const rules = paramRules.value[quotaId]?.[paramKey]
  if (!rules) return ''
  const val = quotaMeasures[quotaId]?.[paramKey as keyof typeof quotaMeasures[string]] || 0
  const isInvalid = rules.minValid !== 0 || rules.maxValid !== 0 ? (val < rules.minValid || val > rules.maxValid) : false
  
  const content: string[] = []
  if (isInvalid && rules.warningMsg) {
    content.push(`<span style="color:#ef4444; font-weight:bold;">⚠️ 警告：${rules.warningMsg}</span>`)
  }
  content.push(`<span><b>行业参考规范：</b>${rules.desc}</span>`)
  content.push(`<span><b>行业默认值：</b>${rules.defaultVal}</span>`)
  return content.join('<br/><br/>')
}

// 辅助检索方法
const activeQuota = computed(() => quotaItems.value.find(item => item.id === activeQuotaId.value) ?? quotaItems.value[0])
const thicknessM = computed(() => Math.max(Number(quotaMeasures[activeQuotaId.value]?.thicknessCm || 0) / 100, 0))
const lossFactor = computed(() => 1 + Number(quotaMeasures[activeQuotaId.value]?.lossRate || 0) / 100)
const tonnagePerM3 = computed(() => roundAmount(Number(quotaMeasures[activeQuotaId.value]?.density || 0) * lossFactor.value, 4))
const tonnagePerM2 = computed(() => roundAmount(tonnagePerM3.value * thicknessM.value, 4))

const isMixRatioSumInvalid = computed(() => {
  const qm = quotaMeasures[activeQuotaId.value]
  if (!qm || qm.asphaltRatio === undefined) return false
  const sum = (qm.asphaltRatio || 0) + (qm.coarseRatio || 0) + (qm.fineRatio || 0) + (qm.powderRatio || 0)
  return Math.abs(sum - 100) > 0.001
})

function calculateWeightedMixturePrice(quotaId: string): number {
  const qMeasure = quotaMeasures[quotaId]
  if (!qMeasure || qMeasure.asphaltRatio === undefined) return 0
  
  const binderPrice = quotaId === 'LM-BASE-CSM' ? getQuotePrice('R-MAT-水泥') : getQuotePrice('R-MAT-沥青')
  const coarsePrice = getQuotePrice('R-MAT-粗集料')
  const finePrice = getQuotePrice('R-MAT-细集料')
  const powderPrice = getQuotePrice('R-MAT-矿粉')
  
  const binder = (qMeasure.asphaltRatio || 0) / 100
  const coarse = (qMeasure.coarseRatio || 0) / 100
  const fine = (qMeasure.fineRatio || 0) / 100
  const powder = (qMeasure.powderRatio || 0) / 100
  
  return estimateMixtureUnitPrice({
    binderRatio: binder,
    coarseRatio: coarse,
    fineRatio: fine,
    powderRatio: powder,
    binderPrice,
    coarsePrice,
    finePrice,
    powderPrice,
  })
}

// 响应式计算原材料行数据
const activeMaterialSourceRows = computed<MaterialSourceRow[]>(() => {
  const quotaId = activeQuotaId.value
  const qMeasure = quotaMeasures[quotaId]
  if (!qMeasure) return []

  const binderRatio = qMeasure.asphaltRatio !== undefined ? qMeasure.asphaltRatio / 100 : 0.045
  const coarse = qMeasure.coarseRatio !== undefined ? qMeasure.coarseRatio / 100 : 0.600
  const fine = qMeasure.fineRatio !== undefined ? qMeasure.fineRatio / 100 : 0.325
  const powder = qMeasure.powderRatio !== undefined ? qMeasure.powderRatio / 100 : 0.030

  const binderResourceId = quotaId === 'LM-BASE-CSM' ? 'R-MAT-水泥' : 'R-MAT-沥青'

  const matRatios = [
    { resourceId: binderResourceId, ratio: binderRatio },
    { resourceId: 'R-MAT-粗集料', ratio: coarse },
    { resourceId: 'R-MAT-细集料', ratio: fine },
    { resourceId: 'R-MAT-矿粉', ratio: powder }
  ]
  return matRatios.map(mr => {
    const resource = props.priceResourceItems.find(r => r.id === mr.resourceId)
    const quoteId = props.selectedQuoteMap[mr.resourceId]
    const quote = resource?.quotes.find(q => q.id === quoteId) || resource?.quotes[0]
    return {
      resourceId: mr.resourceId,
      name: resource?.name || '',
      ratio: mr.ratio,
      unit: resource?.unit || 't',
      price: quote?.price || 0,
      source: quote?.supplier || '无价格来源',
      collectedAt: quote?.collectedAt || '',
      effectiveRegion: quote?.deliveryPoint || ''
    }
  })
})

const materialRows = computed<MaterialDisplayRow[]>(() => activeMaterialSourceRows.value.map(row => ({
  ...row,
  mixRatioText: `${formatAmount(row.ratio * 100, 1)}%`,
})))

const finishedResourceOptions = computed(() => props.priceResourceItems.filter(r => r.category === 'finished'))

const finishedMaterialRows = computed<FinishedMaterialRow[]>(() => {
  const item = selectedBOQItem.value
  const resourceId = getFinishedResourceIdForItem(item)
  const resource = props.priceResourceItems.find(r => r.id === resourceId)
  const quoteId = item?.finishedQuoteId || getMatchingFinishedQuoteId(resourceId, getSupplyMode(item))
  const quote = resource?.quotes.find(q => q.id === quoteId) || resource?.quotes[0]
  return [{
    resourceId,
    name: resource?.name || '未选择成品料',
    unit: resource?.unit || 't',
    price: quote?.price || 0,
    source: quote?.supplier || '无价格来源',
    collectedAt: quote?.collectedAt || '',
    effectiveRegion: quote?.deliveryPoint || '',
  }]
})

// 响应式成品运输运费率
const activeTransportRate = computed(() => {
  const resourceId = 'R-TRANS-混合料'
  const resource = props.priceResourceItems.find(r => r.id === resourceId)
  const quoteId = props.selectedQuoteMap[resourceId]
  const quote = resource?.quotes.find(q => q.id === quoteId) || resource?.quotes[0]
  return {
    resourceId,
    name: resource?.name || '成品沥青混合料运输',
    unit: resource?.unit || 't·km',
    price: quote?.price || 0,
    source: quote?.supplier || '无'
  }
})

function getQuotaThicknessM(quotaId: string): number {
  return Math.max(Number(quotaMeasures[quotaId]?.thicknessCm || 0) / 100, 0)
}

function getQuotaTonnage(quotaId: string, unit: MeasurementUnit): number {
  const qMeasure = quotaMeasures[quotaId]
  const quotaLossFactor = 1 + Number(qMeasure?.lossRate || 0) / 100
  const tonnageM3 = roundAmount(Number(qMeasure?.density || 0) * quotaLossFactor, 4)
  return unit === 'm3' ? tonnageM3 : roundAmount(tonnageM3 * getQuotaThicknessM(quotaId), 4)
}

function isMixtureQuota(quotaId: string): boolean {
  return quotaId === 'LM-AC20C' || quotaId === 'LM-AC13C' || quotaId === 'LM-SMA13' || quotaId === 'LM-AC25C' || quotaId === 'LM-BASE-CSM'
}

function getSupplyMode(item?: Pick<BOQItem, 'supplyMode'> | null): SupplyMode {
  return item?.supplyMode || DEFAULT_SUPPLY_MODE
}

function getDefaultFinishedResourceId(quotaId?: string): string {
  const mapping: Record<string, string> = {
    'LM-AC20C': 'R-FIN-AC20C',
    'LM-AC13C': 'R-FIN-AC13C',
    'LM-SMA13': 'R-FIN-SMA13',
    'LM-AC25C': 'R-FIN-AC25C',
    'LM-BASE-CSM': 'R-FIN-BASE-CSM',
  }
  return mapping[quotaId || ''] || 'R-FIN-AC20C'
}

function getFinishedResourceIdForItem(item?: Pick<BOQItem, 'linkedQuotaId' | 'finishedResourceId'> | null): string {
  return item?.finishedResourceId || getDefaultFinishedResourceId(item?.linkedQuotaId)
}

function getFinishedQuotePrice(resourceId: string, quoteId?: string): number {
  const resource = props.priceResourceItems.find(r => r.id === resourceId && r.category === 'finished')
  const quote = resource?.quotes.find(q => q.id === quoteId) || resource?.quotes[0]
  return quote?.price || 0
}

function getFinishedQuoteSupplier(resourceId: string, quoteId?: string): string {
  const resource = props.priceResourceItems.find(r => r.id === resourceId && r.category === 'finished')
  const quote = resource?.quotes.find(q => q.id === quoteId) || resource?.quotes[0]
  return quote?.supplier || '无价格来源'
}

function ensureSelectedQuoteForResource(resourceId: string, item?: BOQItem) {
  const quotes = getQuotesForResource(resourceId)
  if (quotes.length === 0) return
  if (item) {
    if (!item.finishedQuoteId || !quotes.some(q => q.id === item.finishedQuoteId)) {
      item.finishedQuoteId = quotes[0].id
    }
    return
  }
  if (!props.selectedQuoteMap[resourceId] || !quotes.some(q => q.id === props.selectedQuoteMap[resourceId])) {
    props.selectedQuoteMap[resourceId] = quotes[0].id
  }
}

function getMatchingFinishedQuoteId(resourceId: string, supplyMode: SupplyMode): string | undefined {
  const quotes = getQuotesForResource(resourceId)
  if (quotes.length === 0) return undefined
  const keyword = supplyMode === 'finishedExFactory' ? '出厂' : '到场'
  const matched = quotes.find(q => `${q.taxCaliber} ${q.deliveryPoint} ${q.remark || ''}`.includes(keyword))
  return (matched || quotes[0]).id
}

function chooseFinishedQuoteForSupplyMode(item: BOQItem, supplyMode: SupplyMode) {
  const resourceId = getFinishedResourceIdForItem(item)
  const quoteId = getMatchingFinishedQuoteId(resourceId, supplyMode)
  if (quoteId) item.finishedQuoteId = quoteId
}

function handleFinishedResourceChange(resourceId: string) {
  const item = selectedBOQItem.value
  if (!item) return
  item.finishedResourceId = resourceId
  chooseFinishedQuoteForSupplyMode(item, getSupplyMode(item))
}

function handleSupplyModeChange(mode: string | number | boolean | undefined) {
  const item = selectedBOQItem.value
  if (!item) return
  if (mode !== 'finishedDelivered' && mode !== 'finishedExFactory' && mode !== 'selfMixing') return
  item.supplyMode = mode
  if (mode === 'selfMixing') return
  item.finishedResourceId = item.finishedResourceId || getDefaultFinishedResourceId(item.linkedQuotaId)
  chooseFinishedQuoteForSupplyMode(item, mode)
}

function getComponentCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    labor: '人工',
    material: '材料',
    machine: '机械',
    transport: '运输',
    mixing: '拌合',
    fee: '取费',
    other: '其他',
  }
  return labels[category] || '其他'
}

function buildLaborMachineRates(quotaId: string) {
  const qMeasure = quotaMeasures[quotaId]
  const laborProd = qMeasure?.laborProductivity || 108
  const paverProd = qMeasure?.paverProductivity || 1333
  const rollerProd = qMeasure?.rollerProductivity || 1258

  const laborPrice = getQuotePrice('R-LABOR-铺工')
  const laborSupplier = getQuoteSupplier('R-LABOR-铺工')
  const laborM2Price = roundAmount(laborPrice / laborProd, 2)

  const paverPrice = getQuotePrice('R-MACH-摊铺机')
  const paverSupplier = getQuoteSupplier('R-MACH-摊铺机')
  const paverM2Price = roundAmount(paverPrice / paverProd, 2)

  const steelPrice = getQuotePrice('R-MACH-双钢轮')
  const rubberPrice = getQuotePrice('R-MACH-胶轮')
  const rollerM2Price = roundAmount((steelPrice + rubberPrice) / rollerProd, 2)

  return [
    {
      group: '人工',
      name: '摊铺配合人工',
      resourceId: 'R-LABOR-铺工',
      unit: 'm2',
      price: laborM2Price,
      formula: `工日价 ${laborPrice} 元 / ${laborProd} (${laborSupplier})`,
    },
    {
      group: '机械',
      name: '摊铺机',
      resourceId: 'R-MACH-摊铺机',
      unit: 'm2',
      price: paverM2Price,
      formula: `台班价 ${paverPrice} 元 / ${paverProd} (${paverSupplier})`,
    },
    {
      group: '机械',
      name: '双钢轮/胶轮压路机',
      resourceIds: ['R-MACH-双钢轮', 'R-MACH-胶轮'],
      unit: 'm2',
      price: rollerM2Price,
      formula: `台班合 (${steelPrice} + ${rubberPrice}) 元 / ${rollerProd}`,
    },
  ]
}

// 响应式人工与机械单价折算（融入自定义的工效因子）
const activeLaborMachineRates = computed(() => buildLaborMachineRates(activeQuotaId.value))

function buildTemplateComponentRows(
  quotaId: string,
  unit: MeasurementUnit,
  supplyMode: SupplyMode,
  categories?: string[],
): AnalysisRow[] {
  const quota = quotaItems.value.find(item => item.id === quotaId)
  if (!quota?.components?.length) return []

  const unitTonnage = getQuotaTonnage(quotaId, unit)
  const quotaThicknessM = getQuotaThicknessM(quotaId)
  const rows: AnalysisRow[] = []

  for (const component of quota.components) {
    if (categories && !categories.includes(component.category)) continue
    if (component.category === 'mixing' && supplyMode !== 'selfMixing') continue

    const price = component.resourceId ? getQuotePrice(component.resourceId) : Number(component.price || 0)
    let consumption = Number(component.consumption || 0)
    let formulaPrefix = ''

    if (component.basis === 'tonnage') {
      consumption = roundAmount(unitTonnage * consumption, 4)
      formulaPrefix = `${unit}吨耗 × `
    } else if (component.basis === 'area') {
      const areaFactor = unit === 'm3' && quotaThicknessM > 0 ? 1 / quotaThicknessM : 1
      consumption = roundAmount(areaFactor * consumption, 4)
      formulaPrefix = unit === 'm3' ? '折算面积 × ' : ''
    } else if (quota.baseUnit !== unit) {
      if (quota.baseUnit === 'm3' && unit === 'm2') {
        consumption = roundAmount(consumption * quotaThicknessM, 4)
        formulaPrefix = '定额m3基准 × 厚度换算 × '
      } else if (quota.baseUnit === 'm2' && unit === 'm3' && quotaThicknessM > 0) {
        consumption = roundAmount(consumption / quotaThicknessM, 4)
        formulaPrefix = '定额m2基准 ÷ 厚度换算 × '
      }
    }

    rows.push({
      group: getComponentCategoryLabel(component.category),
      name: component.name || '未命名组成项',
      unit: component.unit || quota.baseUnit,
      consumption,
      price,
      amount: roundAmount(consumption * price, 2),
      formula: `${formulaPrefix}${component.formula || '模板组成项'}`,
      resourceId: component.resourceId,
    })
  }

  return rows
}

function calculateMixingUnitPrice(quotaId: string): number {
  const quota = quotaItems.value.find(item => item.id === quotaId)
  if (!quota?.components?.length) return 0

  return roundAmount(
    quota.components
      .filter(component => component.category === 'mixing' && component.basis === 'tonnage')
      .reduce((sum, component) => {
        const price = component.resourceId ? getQuotePrice(component.resourceId) : Number(component.price || 0)
        return sum + Number(component.consumption || 0) * price
      }, 0),
    2,
  )
}

function buildMixtureFormula(unit: MeasurementUnit, supplyMode: SupplyMode, finishedSupplier: string): string {
  if (supplyMode === 'finishedDelivered') {
    return `${unit}吨耗 × 成品料到场价（${finishedSupplier}）`
  }
  if (supplyMode === 'finishedExFactory') {
    return `${unit}吨耗 × 成品料出厂价（${finishedSupplier}）`
  }
  return `${unit}吨耗 × 原材配比加权价（拌合费按模板单列）`
}

function buildDirectRowsForQuota(
  quotaId: string,
  unit: MeasurementUnit,
  supplyMode: SupplyMode = DEFAULT_SUPPLY_MODE,
  finishedResourceId: string = getDefaultFinishedResourceId(quotaId),
  finishedQuoteId?: string,
): AnalysisRow[] {
  const qMeasure = quotaMeasures[quotaId]
  if (!qMeasure) return []

  const unitTonnage = getQuotaTonnage(quotaId, unit)
  const rows: AnalysisRow[] = []

  // 1. 材料组成
  if (isMixtureQuota(quotaId)) {
    const mixturePrice = supplyMode === 'selfMixing'
      ? calculateWeightedMixturePrice(quotaId)
      : getFinishedQuotePrice(finishedResourceId, finishedQuoteId)
    const mixtureName = quotaId === 'LM-BASE-CSM' ? '水泥稳定碎石混合料' : '沥青混凝土混合料'
    rows.push({
      group: '材料',
      name: supplyMode === 'selfMixing' ? `${mixtureName}原材加权` : `${mixtureName}${supplyMode === 'finishedDelivered' ? '到场价' : '出厂价'}`,
      unit: 't',
      consumption: unitTonnage,
      price: mixturePrice,
      amount: roundAmount(unitTonnage * mixturePrice, 2),
      formula: buildMixtureFormula(unit, supplyMode, getFinishedQuoteSupplier(finishedResourceId, finishedQuoteId)),
      resourceId: supplyMode === 'selfMixing' ? undefined : finishedResourceId,
    })
  }

  // 2. 粘层油乳化沥青 / 透层油乳化沥青
  if (quotaId === 'LM-TACK' || quotaId === 'LM-PRIME') {
    const lossF = 1 + qMeasure.lossRate / 100
    const asphaltPrice = getQuotePrice('R-MAT-沥青') * 1.05
    const tackRateVal = qMeasure.tackApplicationRate || 0.0012
    const asphaltConsumption = roundAmount(tackRateVal * lossF, 4)
    const oilName = quotaId === 'LM-TACK' ? '乳化沥青 (70#加工)' : '透层油/乳化沥青 (70#加工)'
    rows.push({
      group: '材料',
      name: oilName,
      unit: 't',
      consumption: asphaltConsumption,
      price: asphaltPrice,
      amount: roundAmount(asphaltConsumption * asphaltPrice, 2),
      formula: `损耗系数 ${formatAmount(lossF, 3)} × 用量 ${tackRateVal} t/m²`,
      resourceId: 'R-MAT-沥青'
    })
  }

  // 3. 拌合费紧跟材料口径展示，仅自供/委托拌合时单列。
  rows.push(...buildTemplateComponentRows(quotaId, unit, supplyMode, ['mixing']))

  // 4. 成品运输费
  if (isMixtureQuota(quotaId) && supplyMode !== 'finishedDelivered') {
    const transRateVal = activeTransportRate.value.price
    const transportConsumption = roundAmount(unitTonnage * Number(qMeasure.haulDistanceKm || 0), 4)
    const transName = quotaId === 'LM-BASE-CSM' ? '水泥稳定碎石混合料运输' : activeTransportRate.value.name
    rows.push({
      group: '运输',
      name: transName,
      unit: activeTransportRate.value.unit,
      consumption: transportConsumption,
      price: transRateVal,
      amount: roundAmount(transportConsumption * transRateVal, 2),
      formula: `${unit}吨耗 × 项目运距 × t·km运价`,
      resourceId: activeTransportRate.value.resourceId
    })
  }

  // 5. 人工与设备
  if (isMixtureQuota(quotaId)) {
    const quotaThicknessM = getQuotaThicknessM(quotaId)
    const areaFactor = unit === 'm3' && quotaThicknessM > 0 ? 1 / quotaThicknessM : 1
    buildLaborMachineRates(quotaId).forEach(row => {
      rows.push({
        group: row.group,
        name: row.name,
        unit: 'm2',
        consumption: roundAmount(areaFactor, 4),
        price: row.price,
        amount: roundAmount(areaFactor * row.price, 2),
        formula: row.formula,
        resourceId: row.resourceId,
        resourceIds: row.resourceIds
      })
    })
  } else if (quotaId === 'LM-TACK' || quotaId === 'LM-PRIME') {
    rows.push({
      group: '人工',
      name: quotaId === 'LM-TACK' ? '粘层油洒布配合人工' : '透层油洒布配合人工',
      unit: 'm2',
      consumption: 1,
      price: 0.5,
      amount: 0.5,
      formula: '路面油层施工人工包干费',
    })
    const sprayProd = qMeasure.sprayProductivity || 3000
    const sprayPrice = 1600 / sprayProd
    rows.push({
      group: '机械',
      name: '沥青洒布车',
      unit: 'm2',
      consumption: 1,
      price: sprayPrice,
      amount: roundAmount(sprayPrice, 2),
      formula: `台班费 1600 元 / 洒布 ${sprayProd} m²`,
    })
  } else if (quotaId === 'LM-MILL-04') {
    const millProd = qMeasure.millProductivity || 2000
    const millPrice = 8500 / millProd
    rows.push({
      group: '机械',
      name: '路面铣刨机',
      unit: 'm2',
      consumption: 1,
      price: millPrice,
      amount: roundAmount(millPrice, 2),
      formula: `9m铣刨机台班 8500 元 / 铣刨 ${millProd} m²`,
    })
    
    const slagTonnage = qMeasure.slagFactor || 0.1
    const transportPrice = getQuotePrice('R-TRANS-混合料') * 0.8
    const slagTransPrice = slagTonnage * qMeasure.haulDistanceKm * transportPrice
    rows.push({
      group: '运输',
      name: '铣刨渣土运输弃置',
      unit: 't·km',
      consumption: slagTonnage * qMeasure.haulDistanceKm,
      price: transportPrice,
      amount: roundAmount(slagTransPrice, 2),
      formula: `渣重 ${slagTonnage}t × 运距 ${qMeasure.haulDistanceKm}km × 运单价`,
    })

    rows.push({
      group: '人工',
      name: '清扫配合人工',
      unit: 'm2',
      consumption: 1,
      price: 0.8,
      amount: 0.8,
      formula: '工作面清扫及交通配合',
    })
  }

  rows.push(...buildTemplateComponentRows(
    quotaId,
    unit,
    supplyMode,
    ['labor', 'material', 'machine', 'transport', 'fee', 'other'],
  ))

  return rows
}

function buildDirectRows(unit: MeasurementUnit): AnalysisRow[] {
  const finishedResourceId = getFinishedResourceIdForItem(selectedBOQItem.value)
  return buildDirectRowsForQuota(
    activeQuotaId.value,
    unit,
    getSupplyMode(selectedBOQItem.value),
    finishedResourceId,
    selectedBOQItem.value?.finishedQuoteId || getMatchingFinishedQuoteId(finishedResourceId, getSupplyMode(selectedBOQItem.value)),
  )
}

const analysisRows = computed<AnalysisRow[]>(() => buildDirectRows(measurementUnit.value))

function calculateQuotaComprehensiveM2(
  quotaId: string,
  supplyMode: SupplyMode = DEFAULT_SUPPLY_MODE,
  finishedResourceId: string = getDefaultFinishedResourceId(quotaId),
  finishedQuoteId?: string,
): number {
  const qMeasure = quotaMeasures[quotaId]
  if (!qMeasure) return 0

  const quota = quotaItems.value.find(q => q.id === quotaId) || quotaItems.value[0]
  const quotaThicknessM = Math.max(qMeasure.thicknessCm / 100, 0)
  const directBase = roundAmount(
    buildDirectRowsForQuota(quotaId, quota.baseUnit, supplyMode, finishedResourceId, finishedQuoteId).reduce((sum, row) => sum + row.amount, 0),
    2,
  )
  const feeSummary = buildCostFeeSummary(directBase, qMeasure)

  if (quota.baseUnit === 'm3') {
    return roundAmount(feeSummary.comprehensive * quotaThicknessM, 2)
  }
  return feeSummary.comprehensive
}

function calculateDirectCostM3ForQuota(quotaId: string, tonnageM3: number, haulDistanceKm: number): number {
  const qMeasure = quotaMeasures[quotaId]
  const laborProd = qMeasure?.laborProductivity || 108
  const paverProd = qMeasure?.paverProductivity || 1333
  const rollerProd = qMeasure?.rollerProductivity || 1258

  let mixturePrice = 0
  if (quotaId === 'LM-AC20C' || quotaId === 'LM-AC13C' || quotaId === 'LM-SMA13' || quotaId === 'LM-AC25C' || quotaId === 'LM-BASE-CSM') {
    mixturePrice = calculateWeightedMixturePrice(quotaId)
  }

  const transportPrice = getQuotePrice('R-TRANS-混合料')

  const thicknessCm = qMeasure?.thicknessCm || 6

  const laborPrice = getQuotePrice('R-LABOR-铺工')

  const paverPrice = getQuotePrice('R-MACH-摊铺机')

  const steelPrice = getQuotePrice('R-MACH-双钢轮')
  const rubberPrice = getQuotePrice('R-MACH-胶轮')

  return estimatePavementDirectCostM3({
    tonnageM3,
    mixturePrice,
    haulDistanceKm,
    transportPrice,
    thicknessCm,
    laborPrice,
    laborProductivity: laborProd,
    paverPrice,
    paverProductivity: paverProd,
    steelRollerPrice: steelPrice,
    rubberRollerPrice: rubberPrice,
    rollerProductivity: rollerProd,
  })
}

function calculateDirectCostM2ForQuota(quotaId: string, lossFactor: number, haulDistanceKm: number): number {
  const qMeasure = quotaMeasures[quotaId]
  if (quotaId === 'LM-TACK' || quotaId === 'LM-PRIME') {
    const asphaltPrice = getQuotePrice('R-MAT-沥青') * 1.05
    const tackRate = qMeasure?.tackApplicationRate || 0.0012
    const materialCost = tackRate * lossFactor * asphaltPrice
    const laborCost = 0.5
    const sprayProd = qMeasure?.sprayProductivity || (quotaId === 'LM-TACK' ? 3000 : 2500)
    const machineCost = 1600 / sprayProd
    return roundAmount(materialCost + laborCost + machineCost, 2)
  }

  if (quotaId === 'LM-MILL-04') {
    const millProd = qMeasure?.millProductivity || 2000
    const millMachineCost = 8500 / millProd
    const transportPrice = getQuotePrice('R-TRANS-混合料') * 0.8
    const slagFactor = qMeasure?.slagFactor || 0.1
    const transportCost = slagFactor * haulDistanceKm * transportPrice
    const laborCost = 0.8
    return roundAmount(millMachineCost + transportCost + laborCost, 2)
  }

  return 0
}

const summary = computed(() => {
  const directM3 = roundAmount(buildDirectRows('m3').reduce((sum, row) => sum + row.amount, 0), 2)
  const feeM3 = buildCostFeeSummary(directM3, quotaMeasures[activeQuotaId.value])

  let directM2 = 0
  if (activeQuota.value.baseUnit === 'm2' && activeQuota.value.defaultThicknessCm === 0) {
    directM2 = roundAmount(buildDirectRows('m2').reduce((sum, row) => sum + row.amount, 0), 2)
  } else {
    directM2 = roundAmount(directM3 * thicknessM.value, 2)
  }
  
  const feeM2 = buildCostFeeSummary(directM2, quotaMeasures[activeQuotaId.value])

  return {
    directM3,
    managementM3: feeM3.managementFee,
    profitM3: feeM3.profit,
    taxM3: feeM3.tax,
    comprehensiveM3: feeM3.comprehensive,
    directM2,
    managementM2: feeM2.managementFee,
    profitM2: feeM2.profit,
    taxM2: feeM2.tax,
    comprehensiveM2: feeM2.comprehensive,
  }
})

const displayDirectCost = computed(() => measurementUnit.value === 'm3' ? summary.value.directM3 : summary.value.directM2)
const displayManagementFee = computed(() => measurementUnit.value === 'm3' ? summary.value.managementM3 : summary.value.managementM2)
const displayProfit = computed(() => measurementUnit.value === 'm3' ? summary.value.profitM3 : summary.value.profitM2)
const displayTax = computed(() => measurementUnit.value === 'm3' ? summary.value.taxM3 : summary.value.taxM2)
const displayComprehensiveUnitPrice = computed(() => measurementUnit.value === 'm3' ? summary.value.comprehensiveM3 : summary.value.comprehensiveM2)

// 渲染总预算清单项目，关联各自定额的计算值
const budgetRows = computed<BudgetRow[]>(() => {
  return projectBOQItems.map(item => {
    let unitPrice = 0
    if (item.pricingMode === 'quota') {
      unitPrice = item.linkedQuotaId
        ? calculateQuotaComprehensiveM2(
          item.linkedQuotaId,
          getSupplyMode(item),
          getFinishedResourceIdForItem(item),
          item.finishedQuoteId || getMatchingFinishedQuoteId(getFinishedResourceIdForItem(item), getSupplyMode(item)),
        )
        : 0
    } else {
      if (item.manualBreakdown && item.manualBreakdown.length > 0) {
        unitPrice = roundAmount(item.manualBreakdown.reduce((sum, row) => sum + row.amount, 0), 2)
      } else {
        unitPrice = item.manualUnitPrice
      }
    }
    
    // 动态追加厚度后缀
    let itemName = item.itemName
    if (item.pricingMode === 'quota' && item.linkedQuotaId) {
      const qm = quotaMeasures[item.linkedQuotaId]
      if (qm && qm.thicknessCm !== undefined && qm.thicknessCm > 0) {
        itemName = `${item.itemName} 厚 ${qm.thicknessCm}cm`
      }
    }
    
    return {
      id: item.id,
      codeStandard: item.codeStandard || 'custom',
      itemCode: item.itemCode,
      itemName: itemName,
      pricingMode: item.pricingMode,
      linkedQuotaId: item.linkedQuotaId,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: unitPrice,
      total: roundAmount(item.quantity * unitPrice, 2)
    }
  })
})

function selectQuota(item: QuotaItem) {
  if (selectedBOQItem.value) {
    selectedBOQItem.value.linkedQuotaId = item.id
    selectedBOQItem.value.pricingMode = 'quota'
    selectedBOQItem.value.supplyMode = selectedBOQItem.value.supplyMode || DEFAULT_SUPPLY_MODE
    selectedBOQItem.value.finishedResourceId = getDefaultFinishedResourceId(item.id)
    chooseFinishedQuoteForSupplyMode(selectedBOQItem.value, getSupplyMode(selectedBOQItem.value))
    measurementUnit.value = item.baseUnit
  }
}

function handleBOQRowClick(row: any) {
  selectedBOQItemId.value = row.id
  if (row.pricingMode === 'quota' && row.linkedQuotaId) {
    const quota = quotaItems.value.find(q => q.id === row.linkedQuotaId)
    if (quota) {
      measurementUnit.value = quota.baseUnit
    }
  }
}

function handlePricingModeChange(mode: any) {
  const item = selectedBOQItem.value
  if (item) {
    if (mode === 'quota' && !item.linkedQuotaId) {
      item.linkedQuotaId = 'LM-AC20C'
    }
    if (mode === 'quota') {
      item.supplyMode = item.supplyMode || DEFAULT_SUPPLY_MODE
      item.finishedResourceId = item.finishedResourceId || getDefaultFinishedResourceId(item.linkedQuotaId)
      chooseFinishedQuoteForSupplyMode(item, getSupplyMode(item))
    }
    if (item.pricingMode === 'quota' && item.linkedQuotaId) {
      const quota = quotaItems.value.find(q => q.id === item.linkedQuotaId)
      if (quota) {
        measurementUnit.value = quota.baseUnit
      }
    } else {
      measurementUnit.value = (item.unit as MeasurementUnit) || 'm2'
    }
  }
}

function getQuotaNameById(id?: string): string {
  if (!id) return '未指定定额'
  const quota = quotaItems.value.find(q => q.id === id)
  return quota ? `${quota.code} ${quota.name}` : id
}

function applyQuotaTemplate(quota: QuotaItem) {
  const item = selectedBOQItem.value
  if (item) {
    item.linkedQuotaId = quota.id
    item.pricingMode = 'quota'
    item.supplyMode = item.supplyMode || DEFAULT_SUPPLY_MODE
    item.finishedResourceId = getDefaultFinishedResourceId(quota.id)
    chooseFinishedQuoteForSupplyMode(item, getSupplyMode(item))
    measurementUnit.value = quota.baseUnit
    ElMessage.success(`成功套用定额模板: ${quota.name}`)
  }
  showQuotaDialog.value = false
}

function addManualBreakdownRow() {
  const item = selectedBOQItem.value
  if (item && item.pricingMode === 'manual') {
    item.manualBreakdown.push({
      id: `breakdown-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      category: 'material',
      name: '',
      unit: '',
      consumption: 1,
      price: 0,
      amount: 0
    })
    syncManualTotalPrice()
  }
}

function deleteManualBreakdownRow(index: number) {
  const item = selectedBOQItem.value
  if (item && item.pricingMode === 'manual') {
    item.manualBreakdown.splice(index, 1)
    syncManualTotalPrice()
  }
}

function recalculateManualRow(row: any) {
  row.amount = roundAmount((row.consumption || 0) * (row.price || 0), 2)
  syncManualTotalPrice()
}

function syncManualTotalPrice() {
  const item = selectedBOQItem.value
  if (item && item.pricingMode === 'manual') {
    if (item.manualBreakdown && item.manualBreakdown.length > 0) {
      item.manualUnitPrice = roundAmount(item.manualBreakdown.reduce((sum, row) => sum + row.amount, 0), 2)
    }
  }
}



function buildQuotaItemMeta(item: QuotaItem): string {
  const compPrice = calculateQuotaComprehensiveM2(item.id)
  
  if (item.id === activeQuotaId.value) {
    return `基准单位 ${item.baseUnit} · 测算单价 ${formatAmount(displayComprehensiveUnitPrice.value, 2)} 元/${measurementUnit.value}`
  }

  const meta = [`基准单位 ${item.baseUnit}`]
  meta.push(`测算单价 ${formatAmount(compPrice, 2)} 元/m²`)
  return meta.join(' · ')
}

function buildBudgetSummary(param: {
  columns: Array<TableColumnCtx<BudgetRow>>
  data: BudgetRow[]
}): string[] {
  return param.columns.map((column, index) => {
    if (index === 0) return '合计'
    if (column.property === 'total') {
      return formatAmount(param.data.reduce((sum, row) => sum + row.total, 0), 2)
    }
    return ''
  })
}

function buildAnalysisSummary(param: {
  columns: Array<TableColumnCtx<AnalysisRow>>
  data: AnalysisRow[]
}): string[] {
  return param.columns.map((column, index) => {
    if (index === 0) return '直接成本合计'
    if (column.property === 'amount') {
      return formatAmount(param.data.reduce((sum, row) => sum + row.amount, 0), 2)
    }
    return ''
  })
}

function formatPercent(value: number): string {
  if (!displayComprehensiveUnitPrice.value) return '0.0'
  return ((value / displayComprehensiveUnitPrice.value) * 100).toFixed(1)
}
</script>

<style scoped>
.compact-params-section {
  padding: 8px 12px;
  border: 1px solid var(--cost-border-soft);
  border-radius: 6px;
  background: var(--cost-surface-panel-soft);
  margin-top: 8px;
}

.compact-params-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.compact-params-group-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--cost-text-title);
}

.compact-param-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.compact-param-label {
  font-size: 0.75rem;
  color: var(--cost-text-body);
  border-bottom: 1px dashed transparent;
  cursor: help;
}

.compact-param-label:hover {
  border-color: var(--cost-color-primary);
}

/* 结果汇总单行栏 */
.compact-results-bar {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  margin: 10px 0 12px;
  padding: 8px 12px 12px; /* 底部留空给迷你占比条 */
  border: 1px solid var(--cost-border-soft);
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}

html[data-theme='dark'] .compact-results-bar,
.dark .compact-results-bar {
  background: var(--card-bg);
}

.compact-result-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.8125rem;
}

.result-label {
  color: var(--cost-text-body);
}

.result-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--cost-text-title);
}

.primary-result {
  margin-left: auto; /* 推到最右侧 */
  background-color: rgba(37, 99, 235, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.primary-result .result-label {
  color: var(--cost-color-primary-text);
  font-weight: 700;
}

.primary-result .result-value {
  color: var(--cost-color-primary-text);
  font-size: 1.0625rem;
}

.result-unit {
  font-size: 0.75rem;
  color: var(--cost-text-muted);
}

/* 迷你进度条 */
.mini-proportion-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  height: 4px;
  background-color: var(--cost-border-soft);
}

.mini-proportion-bar > div {
  height: 100%;
}

.roller-price-tooltip {
  border-bottom: 1px dashed var(--cost-color-primary);
  cursor: help;
  font-weight: 700;
  color: var(--cost-color-primary);
  padding-bottom: 2px;
}

/* 警告标红样式 */
.warning-red {
  color: #ef4444 !important;
  font-weight: 700;
}

/* 警告输入框样式标红 */
:deep(.input-warning-red .el-input__inner) {
  color: #ef4444 !important;
  font-weight: 700 !important;
}

:deep(.input-warning-red .el-input__wrapper) {
  background-color: rgba(239, 68, 68, 0.05) !important;
  box-shadow: 0 0 0 1px #fca5a5 inset !important;
}

:deep(.input-warning-red .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #ef4444 inset !important;
}

:deep(.input-warning-red .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #ef4444 inset !important;
}
</style>
