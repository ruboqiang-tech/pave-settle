<template>
  <div class="price-library-page">
    <div class="price-library-toolbar" style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: -10px; z-index: 10; flex-wrap: wrap;">
      <el-tag size="small" effect="plain" :type="defaultAiConfig ? 'success' : 'warning'">
        {{ aiConfigStatusText }}
      </el-tag>
      <el-button
        type="warning"
        size="small"
        :loading="batchAiLoading"
        @click="handleBatchAiQuoteForActiveCategory"
      >
        AI估价当前分类
      </el-button>

      <el-button type="primary" size="small" @click="openAddResourceDialog">
        <template #icon><Plus /></template>新增价格要素
      </el-button>
    </div>
    <el-tabs v-model="activeTab" class="price-library-tabs">
      <!-- 原材料 Tab -->
      <el-tab-pane label="原材料到场价" name="material">
        <section class="price-table-panel">
          <el-table
            :data="materialRows"
            row-key="id"
            :expand-row-keys="expandedRowKeys.material"
            border
            size="small"
            style="width: 100%"
            @expand-change="(row, expandedRows) => handleExpandChange('material', row, expandedRows)"
          >
            <!-- 展开列 -->
            <el-table-column type="expand">
              <template #header>
                <el-button
                  link
                  class="price-expand-toggle"
                  :class="{ 'is-expanded': isCategoryAllExpanded('material') }"
                  :title="isCategoryAllExpanded('material') ? '全部收起' : '全部展开'"
                  @click.stop="toggleCategoryExpansion('material')"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </template>
              <template #default="{ row }">
                <div class="price-nested-container">
                  <div class="price-nested-header">
                    <span>【{{ row.name }}】供应商报价与历史记录</span>
                    <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                      <template #icon><Plus /></template>新增供应商报价
                    </el-button>
                  </div>
                  <el-table :data="row.quotes" border size="small" style="width: 100%" class="price-nested-table">
                    <el-table-column label="供应商 / 报价来源" min-width="180">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                          <el-tag v-if="quote.remark && quote.remark.includes('[AI估价]')" type="warning" size="small" effect="dark" round>AI</el-tag>
                          <el-input v-model="quote.supplier" size="small" placeholder="请输入供应商" />
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="到场单价" width="160">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <el-input-number
                            v-model="quote.price"
                            size="small"
                            :controls="false"
                            :min="0.01"
                            :precision="2"
                            style="width: 80px;"
                          />
                          <span style="font-size: 11px; color: #909399; white-space: nowrap;">元/{{ row.unit }}</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="税价口径" width="120">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.taxCaliber" size="small" placeholder="税费口径" />
                      </template>
                    </el-table-column>
                    <el-table-column label="到场位置" min-width="160">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.deliveryPoint" size="small" placeholder="到场位置" />
                      </template>
                    </el-table-column>
                    <el-table-column label="获取时间" width="140">
                      <template #default="{ row: quote }">
                        <el-date-picker
                          v-model="quote.collectedAt"
                          type="date"
                          value-format="YYYY-MM-DD"
                          size="small"
                          placeholder="选择日期"
                          style="width: 100%;"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="说明" min-width="180">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.remark" size="small" placeholder="说明" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80" align="center">
                      <template #default="{ row: quote }">
                        <el-button
                          type="danger"
                          link
                          size="small"
                          @click="handleDeleteQuote(row.id, quote.id)"
                        >
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="材料名称" min-width="160" />
            <el-table-column prop="spec" label="规格型号" min-width="140" />
            <el-table-column prop="unit" label="单位" width="100" align="center" />
            <el-table-column label="报价记录数" width="130" align="center">
              <template #default="{ row }">
                <el-badge :value="row.quotes.length" :type="row.quotes.length > 1 ? 'primary' : 'warning'" />
              </template>
            </el-table-column>
            <el-table-column label="当前最低价" width="150" align="right">
              <template #default="{ row }">
                <span class="price-lowest">{{ formatAmount(getLowestPrice(row), 2) }}</span> 元
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                  添加报价
                </el-button>
                <el-popconfirm title="确定删除该价格要素及所有报价记录吗？" @confirm="handleDeleteResource(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger" link>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <!-- 成品料 Tab -->
      <el-tab-pane label="成品料价格" name="finished">
        <section class="price-table-panel">
          <el-table
            :data="finishedRows"
            row-key="id"
            :expand-row-keys="expandedRowKeys.finished"
            border
            size="small"
            style="width: 100%"
            @expand-change="(row, expandedRows) => handleExpandChange('finished', row, expandedRows)"
          >
            <el-table-column type="expand">
              <template #header>
                <el-button
                  link
                  class="price-expand-toggle"
                  :class="{ 'is-expanded': isCategoryAllExpanded('finished') }"
                  :title="isCategoryAllExpanded('finished') ? '全部收起' : '全部展开'"
                  @click.stop="toggleCategoryExpansion('finished')"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </template>
              <template #default="{ row }">
                <div class="price-nested-container">
                  <div class="price-nested-header">
                    <span>【{{ row.name }}】成品料报价与历史记录</span>
                    <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                      <template #icon><Plus /></template>新增成品料报价
                    </el-button>
                  </div>
                  <el-table :data="row.quotes" border size="small" style="width: 100%" class="price-nested-table">
                    <el-table-column label="供应商 / 拌合站" min-width="180">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                          <el-tag v-if="quote.remark && quote.remark.includes('[AI估价]')" type="warning" size="small" effect="dark" round>AI</el-tag>
                          <el-input v-model="quote.supplier" size="small" placeholder="请输入供应商或拌合站" />
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="成品料单价" width="160">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <el-input-number
                            v-model="quote.price"
                            size="small"
                            :controls="false"
                            :min="0.01"
                            :precision="2"
                            style="width: 80px;"
                          />
                          <span style="font-size: 11px; color: #909399; white-space: nowrap;">元/{{ row.unit }}</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="税价口径" width="120">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.taxCaliber" size="small" placeholder="含税到场/出厂" />
                      </template>
                    </el-table-column>
                    <el-table-column label="交货点" min-width="160">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.deliveryPoint" size="small" placeholder="项目卸料点/拌合站" />
                      </template>
                    </el-table-column>
                    <el-table-column label="获取时间" width="140">
                      <template #default="{ row: quote }">
                        <el-date-picker
                          v-model="quote.collectedAt"
                          type="date"
                          value-format="YYYY-MM-DD"
                          size="small"
                          placeholder="选择日期"
                          style="width: 100%;"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="说明" min-width="180">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.remark" size="small" placeholder="说明" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80" align="center">
                      <template #default="{ row: quote }">
                        <el-button
                          type="danger"
                          link
                          size="small"
                          @click="handleDeleteQuote(row.id, quote.id)"
                        >
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="成品料名称" min-width="180" />
            <el-table-column prop="spec" label="规格型号" min-width="140" />
            <el-table-column prop="unit" label="单位" width="100" align="center" />
            <el-table-column label="报价记录数" width="130" align="center">
              <template #default="{ row }">
                <el-badge :value="row.quotes.length" :type="row.quotes.length > 1 ? 'primary' : 'warning'" />
              </template>
            </el-table-column>
            <el-table-column label="当前最低价" width="150" align="right">
              <template #default="{ row }">
                <span class="price-lowest">{{ formatAmount(getLowestPrice(row), 2) }}</span> 元
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                  添加报价
                </el-button>
                <el-popconfirm title="确定删除该价格要素及所有报价记录吗？" @confirm="handleDeleteResource(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger" link>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <!-- 人工 Tab -->
      <el-tab-pane label="人工价格" name="labor">
        <section class="price-table-panel">
          <el-table
            :data="laborRows"
            row-key="id"
            :expand-row-keys="expandedRowKeys.labor"
            border
            size="small"
            style="width: 100%"
            @expand-change="(row, expandedRows) => handleExpandChange('labor', row, expandedRows)"
          >
            <el-table-column type="expand">
              <template #header>
                <el-button
                  link
                  class="price-expand-toggle"
                  :class="{ 'is-expanded': isCategoryAllExpanded('labor') }"
                  :title="isCategoryAllExpanded('labor') ? '全部收起' : '全部展开'"
                  @click.stop="toggleCategoryExpansion('labor')"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </template>
              <template #default="{ row }">
                <div class="price-nested-container">
                  <div class="price-nested-header">
                    <span>【{{ row.name }}】劳务单价与历史记录</span>
                    <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                      <template #icon><Plus /></template>新增劳务报价
                    </el-button>
                  </div>
                  <el-table :data="row.quotes" border size="small" style="width: 100%" class="price-nested-table">
                    <el-table-column label="劳务队伍 / 来源" min-width="180">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                          <el-tag v-if="quote.remark && quote.remark.includes('[AI估价]')" type="warning" size="small" effect="dark" round>AI</el-tag>
                          <el-input v-model="quote.supplier" size="small" placeholder="请输入劳务队伍" />
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="劳务单价" width="160">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <el-input-number
                            v-model="quote.price"
                            size="small"
                            :controls="false"
                            :min="0.01"
                            :precision="2"
                            style="width: 80px;"
                          />
                          <span style="font-size: 11px; color: #909399; white-space: nowrap;">元/{{ row.unit }}</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="税费口径" width="120">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.taxCaliber" size="small" placeholder="税费口径" />
                      </template>
                    </el-table-column>
                    <el-table-column label="适用区域" min-width="160">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.deliveryPoint" size="small" placeholder="适用区域" />
                      </template>
                    </el-table-column>
                    <el-table-column label="获取时间" width="140">
                      <template #default="{ row: quote }">
                        <el-date-picker
                          v-model="quote.collectedAt"
                          type="date"
                          value-format="YYYY-MM-DD"
                          size="small"
                          placeholder="选择日期"
                          style="width: 100%;"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="说明" min-width="180">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.remark" size="small" placeholder="说明" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80" align="center">
                      <template #default="{ row: quote }">
                        <el-button
                          type="danger"
                          link
                          size="small"
                          @click="handleDeleteQuote(row.id, quote.id)"
                        >
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="工种" min-width="160" />
            <el-table-column prop="spec" label="工作说明" min-width="160" />
            <el-table-column prop="unit" label="单位" width="100" align="center" />
            <el-table-column label="报价记录数" width="130" align="center">
              <template #default="{ row }">
                <el-badge :value="row.quotes.length" :type="row.quotes.length > 1 ? 'primary' : 'warning'" />
              </template>
            </el-table-column>
            <el-table-column label="参考均价" width="150" align="right">
              <template #default="{ row }">
                <span>{{ formatAmount(getAveragePrice(row), 2) }}</span> 元
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                  添加报价
                </el-button>
                <el-popconfirm title="确定删除该价格要素及所有报价记录吗？" @confirm="handleDeleteResource(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger" link>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <!-- 成品料运输费 Tab -->
      <el-tab-pane label="成品料运输费" name="transport">
        <section class="price-table-panel">
          <el-table
            :data="transportRows"
            row-key="id"
            :expand-row-keys="expandedRowKeys.transport"
            border
            size="small"
            style="width: 100%"
            @expand-change="(row, expandedRows) => handleExpandChange('transport', row, expandedRows)"
          >
            <el-table-column type="expand">
              <template #header>
                <el-button
                  link
                  class="price-expand-toggle"
                  :class="{ 'is-expanded': isCategoryAllExpanded('transport') }"
                  :title="isCategoryAllExpanded('transport') ? '全部收起' : '全部展开'"
                  @click.stop="toggleCategoryExpansion('transport')"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </template>
              <template #default="{ row }">
                <div class="price-nested-container">
                  <div class="price-nested-header">
                    <span>【{{ row.name }}】运输报价与历史记录</span>
                    <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                      <template #icon><Plus /></template>新增运输报价
                    </el-button>
                  </div>
                  <el-table :data="row.quotes" border size="small" style="width: 100%" class="price-nested-table">
                    <el-table-column label="运输车队 / 来源" min-width="180">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                          <el-tag v-if="quote.remark && quote.remark.includes('[AI估价]')" type="warning" size="small" effect="dark" round>AI</el-tag>
                          <el-input v-model="quote.supplier" size="small" placeholder="请输入运输车队" />
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="基准运价" width="160">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <el-input-number
                            v-model="quote.price"
                            size="small"
                            :controls="false"
                            :min="0.01"
                            :precision="2"
                            style="width: 80px;"
                          />
                          <span style="font-size: 11px; color: #909399; white-space: nowrap;">元/{{ row.unit }}</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="计价口径" width="120">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.taxCaliber" size="small" placeholder="计价口径" />
                      </template>
                    </el-table-column>
                    <el-table-column label="适用点" min-width="160">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.deliveryPoint" size="small" placeholder="适用点" />
                      </template>
                    </el-table-column>
                    <el-table-column label="获取时间" width="140">
                      <template #default="{ row: quote }">
                        <el-date-picker
                          v-model="quote.collectedAt"
                          type="date"
                          value-format="YYYY-MM-DD"
                          size="small"
                          placeholder="选择日期"
                          style="width: 100%;"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="说明" min-width="180">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.remark" size="small" placeholder="说明" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80" align="center">
                      <template #default="{ row: quote }">
                        <el-button
                          type="danger"
                          link
                          size="small"
                          @click="handleDeleteQuote(row.id, quote.id)"
                        >
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="运输服务" min-width="160" />
            <el-table-column prop="spec" label="服务规格/方式" min-width="160" />
            <el-table-column prop="unit" label="计价单位" width="110" align="center" />
            <el-table-column label="车队选择数" width="130" align="center">
              <template #default="{ row }">
                <el-badge :value="row.quotes.length" :type="row.quotes.length > 1 ? 'primary' : 'warning'" />
              </template>
            </el-table-column>
            <el-table-column label="基准运价(参考)" width="150" align="right">
              <template #default="{ row }">
                <span class="price-lowest">{{ formatAmount(getLowestPrice(row), 2) }}</span> 元
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                  添加运价
                </el-button>
                <el-popconfirm title="确定删除该价格要素及所有报价记录吗？" @confirm="handleDeleteResource(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger" link>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <!-- 机械 Tab -->
      <el-tab-pane label="机械价格" name="machine">
        <section class="price-table-panel">
          <el-table
            :data="machineRows"
            row-key="id"
            :expand-row-keys="expandedRowKeys.machine"
            border
            size="small"
            style="width: 100%"
            @expand-change="(row, expandedRows) => handleExpandChange('machine', row, expandedRows)"
          >
            <el-table-column type="expand">
              <template #header>
                <el-button
                  link
                  class="price-expand-toggle"
                  :class="{ 'is-expanded': isCategoryAllExpanded('machine') }"
                  :title="isCategoryAllExpanded('machine') ? '全部收起' : '全部展开'"
                  @click.stop="toggleCategoryExpansion('machine')"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </template>
              <template #default="{ row }">
                <div class="price-nested-container">
                  <div class="price-nested-header">
                    <span>【{{ row.name }}】机械租赁报价与历史记录</span>
                    <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                      <template #icon><Plus /></template>新增机械报价
                    </el-button>
                  </div>
                  <el-table :data="row.quotes" border size="small" style="width: 100%" class="price-nested-table">
                    <el-table-column label="租赁商 / 来源" min-width="180">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
                          <el-tag v-if="quote.remark && quote.remark.includes('[AI估价]')" type="warning" size="small" effect="dark" round>AI</el-tag>
                          <el-input v-model="quote.supplier" size="small" placeholder="请输入租赁商" />
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="台班单价" width="160">
                      <template #default="{ row: quote }">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <el-input-number
                            v-model="quote.price"
                            size="small"
                            :controls="false"
                            :min="0.01"
                            :precision="2"
                            style="width: 80px;"
                          />
                          <span style="font-size: 11px; color: #909399; white-space: nowrap;">元/{{ row.unit }}</span>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column label="包含口径" width="130">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.taxCaliber" size="small" placeholder="包含口径" />
                      </template>
                    </el-table-column>
                    <el-table-column label="适用点" min-width="160">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.deliveryPoint" size="small" placeholder="适用点" />
                      </template>
                    </el-table-column>
                    <el-table-column label="获取时间" width="140">
                      <template #default="{ row: quote }">
                        <el-date-picker
                          v-model="quote.collectedAt"
                          type="date"
                          value-format="YYYY-MM-DD"
                          size="small"
                          placeholder="选择日期"
                          style="width: 100%;"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="说明" min-width="180">
                      <template #default="{ row: quote }">
                        <el-input v-model="quote.remark" size="small" placeholder="说明" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80" align="center">
                      <template #default="{ row: quote }">
                        <el-button
                          type="danger"
                          link
                          size="small"
                          @click="handleDeleteQuote(row.id, quote.id)"
                        >
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="机械名称" min-width="160" />
            <el-table-column prop="spec" label="规格型号" min-width="160" />
            <el-table-column prop="unit" label="单位" width="100" align="center" />
            <el-table-column label="报价商数" width="130" align="center">
              <template #default="{ row }">
                <el-badge :value="row.quotes.length" :type="row.quotes.length > 1 ? 'primary' : 'warning'" />
              </template>
            </el-table-column>
            <el-table-column label="当前最低价" width="150" align="right">
              <template #default="{ row }">
                <span class="price-lowest">{{ formatAmount(getLowestPrice(row), 2) }}</span> 元
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="handleAddQuote(row)">
                  添加报价
                </el-button>
                <el-popconfirm title="确定删除该价格要素及所有报价记录吗？" @confirm="handleDeleteResource(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger" link>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>
    </el-tabs>
    <!-- 新增价格要素对话框 -->
    <el-dialog
      v-model="addResourceVisible"
      title="新增价格要素"
      width="480px"
      destroy-on-close
    >
      <el-form :model="addResourceForm" :rules="addResourceRules" ref="addResourceFormRef" label-width="100px" size="small">
        <el-form-item label="要素代码" prop="id" required>
          <el-input v-model="addResourceForm.id" placeholder="如: R-MAT-改性沥青" />
        </el-form-item>
        <el-form-item label="品类" prop="category" required>
          <el-select v-model="addResourceForm.category" style="width: 100%">
            <el-option label="原材料到场价" value="material" />
            <el-option label="成品料价格" value="finished" />
            <el-option label="人工价格" value="labor" />
            <el-option label="成品料运输费" value="transport" />
            <el-option label="机械价格" value="machine" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" prop="name" required>
          <el-input v-model="addResourceForm.name" placeholder="如: SBS改性沥青" />
        </el-form-item>
        <el-form-item label="规格型号" prop="spec">
          <el-input v-model="addResourceForm.spec" placeholder="如: I-D级 / 20mm" />
        </el-form-item>
        <el-form-item label="计量单位" prop="unit" required>
          <el-input v-model="addResourceForm.unit" placeholder="如: t / 工日 / 台班" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="addResourceVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitAddResource">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import './price-library.css'
import { computed, onMounted, ref, reactive } from 'vue'
import { ArrowRight, Plus } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { formatAmount } from '@/utils/calculations'
import type { PriceResourceItem, PriceQuote } from './useCostManagement'
import type { PriceResourceCategory } from '@/types/price-library.types'
import { aiQuoteService } from '@/services/ai-quote.service'
import { aiConfigService, type AiProviderConfig } from '@/services/ai-config.service'

const props = defineProps<{
  priceResourceItems: PriceResourceItem[]
}>()

const emit = defineEmits<{
  (e: 'add-resource', item: Omit<PriceResourceItem, 'quotes'>): void
  (e: 'delete-resource', id: string): void
  (e: 'add-quote', resourceId: string, quote: Omit<PriceQuote, 'id'>): void
  (e: 'delete-quote', resourceId: string, quoteId: string): void
}>()

const activeTab = ref('material')
const expandedRowKeys = reactive<Record<PriceResourceCategory, string[]>>({
  labor: [],
  material: [],
  finished: [],
  transport: [],
  machine: [],
})

// 过滤各类资源
const laborRows = computed(() => props.priceResourceItems.filter(r => r.category === 'labor'))
const materialRows = computed(() => props.priceResourceItems.filter(r => r.category === 'material'))
const finishedRows = computed(() => props.priceResourceItems.filter(r => r.category === 'finished'))
const transportRows = computed(() => props.priceResourceItems.filter(r => r.category === 'transport'))
const machineRows = computed(() => props.priceResourceItems.filter(r => r.category === 'machine'))
const categoryLabels: Record<PriceResourceCategory, string> = {
  material: '材料',
  finished: '成品料',
  labor: '人工',
  transport: '运输',
  machine: '机械',
}

const activeCategory = computed(() => activeTab.value as PriceResourceCategory)
const activeCategoryRows = computed(() => getRowsByCategory(activeCategory.value))

function getRowsByCategory(category: PriceResourceCategory): PriceResourceItem[] {
  if (category === 'material') return materialRows.value
  if (category === 'finished') return finishedRows.value
  if (category === 'labor') return laborRows.value
  if (category === 'transport') return transportRows.value
  return machineRows.value
}

function handleExpandChange(
  category: PriceResourceCategory,
  _row: PriceResourceItem,
  expandedRows: PriceResourceItem[],
) {
  expandedRowKeys[category] = expandedRows.map(row => row.id)
}

function keepRowExpanded(row: PriceResourceItem) {
  const keys = expandedRowKeys[row.category]
  if (!keys.includes(row.id)) {
    keys.push(row.id)
  }
}

function isCategoryAllExpanded(category: PriceResourceCategory): boolean {
  const rows = getRowsByCategory(category)
  if (rows.length === 0) return false
  const keys = expandedRowKeys[category]
  return rows.every(row => keys.includes(row.id))
}

function toggleCategoryExpansion(category: PriceResourceCategory) {
  expandedRowKeys[category] = isCategoryAllExpanded(category)
    ? []
    : getRowsByCategory(category).map(row => row.id)
}

// 辅助计算：获取资源中最低单价
function getLowestPrice(row: PriceResourceItem): number {
  if (row.quotes.length === 0) return 0
  return Math.min(...row.quotes.map(q => q.price))
}

// 辅助计算：获取参考均价
function getAveragePrice(row: PriceResourceItem): number {
  if (row.quotes.length === 0) return 0
  const sum = row.quotes.reduce((acc, q) => acc + q.price, 0)
  return sum / row.quotes.length
}

function handleAddQuote(row: PriceResourceItem) {
  keepRowExpanded(row)
  emit('add-quote', row.id, {
    supplier: '新报价来源',
    price: 100,
    taxCaliber: row.category === 'material' || row.category === 'finished' ? '含税到场' : '含税',
    deliveryPoint: row.category === 'labor' ? '项目所在地' : row.category === 'finished' ? '项目卸料点' : '工地现场',
    collectedAt: new Date().toISOString().substring(0, 10),
    remark: ''
  })
  ElMessage.success('报价已添加，请直接在行内表格中编辑修改！')
}

function handleDeleteQuote(resourceId: string, quoteId: string) {
  emit('delete-quote', resourceId, quoteId)
}

const addResourceVisible = ref(false)
const addResourceFormRef = ref<FormInstance>()
const addResourceForm = reactive({
  id: '',
  category: 'material' as PriceResourceCategory,
  name: '',
  spec: '',
  unit: ''
})

const addResourceRules = {
  id: [{ required: true, message: '请输入要素代码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入要素名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择要素品类', trigger: 'change' }],
  unit: [{ required: true, message: '请输入计量单位', trigger: 'blur' }]
}

function openAddResourceDialog() {
  addResourceForm.id = `R-${activeTab.value.toUpperCase()}-${Date.now().toString().slice(-4)}`
  addResourceForm.category = activeTab.value as any
  addResourceForm.name = ''
  addResourceForm.spec = ''
  addResourceForm.unit = activeTab.value === 'material' || activeTab.value === 'finished' ? 't' : activeTab.value === 'labor' ? '工日' : activeTab.value === 'machine' ? '台班' : 't·km'
  addResourceVisible.value = true
}

function submitAddResource() {
  if (!addResourceFormRef.value) return
  addResourceFormRef.value.validate((valid) => {
    if (valid) {
      emit('add-resource', {
        id: addResourceForm.id,
        category: addResourceForm.category,
        name: addResourceForm.name,
        spec: addResourceForm.spec,
        unit: addResourceForm.unit
      })
      addResourceVisible.value = false
    }
  })
}

function handleDeleteResource(id: string) {
  emit('delete-resource', id)
}

const aiConfigs = ref<AiProviderConfig[]>([])
const batchAiLoading = ref(false)
const defaultAiConfig = computed(() => {
  const runnable = aiConfigs.value.filter(config => config.enabled && config.apiKey.trim())
  return runnable.find(config => config.isDefault) ?? runnable[0] ?? null
})
const aiConfigStatusText = computed(() => {
  if (defaultAiConfig.value) return `默认AI：${defaultAiConfig.value.name}`
  return '未配置可用 AI Key'
})

async function refreshAiConfigs() {
  try {
    aiConfigs.value = await aiConfigService.list()
  } catch (error) {
    console.error(error)
    aiConfigs.value = []
  }
}

async function handleBatchAiQuoteForActiveCategory() {
  const config = defaultAiConfig.value
  if (!config) {
    ElMessage.warning('请先到数据中心配置并保存可用的 AI Key')
    return
  }

  const rows = activeCategoryRows.value
  if (rows.length === 0) {
    ElMessage.warning('当前分类没有可估价的价格要素')
    return
  }

  batchAiLoading.value = true
  let successCount = 0
  const failedNames: string[] = []

  for (const row of rows) {
    try {
      const result = await aiQuoteService.fetchAiQuote(
        {
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        },
        row.name,
        row.spec,
        row.category,
      )

      emit('add-quote', row.id, {
        supplier: result.supplier,
        price: result.price,
        taxCaliber: result.taxCaliber,
        deliveryPoint: result.deliveryPoint,
        collectedAt: new Date().toISOString().substring(0, 10),
        remark: `[AI估价] ${result.remark}`,
      })
      keepRowExpanded(row)
      successCount += 1
    } catch (error) {
      console.error(error)
      failedNames.push(`${categoryLabels[row.category]}-${row.name}`)
    }
  }

  batchAiLoading.value = false

  if (successCount > 0) {
    ElMessage.success(`${categoryLabels[activeCategory.value]}AI估价完成：已为 ${successCount} 个价格要素新增报价记录`)
  }
  if (failedNames.length > 0) {
    ElMessage.warning(`部分要素估价失败：${failedNames.slice(0, 3).join('、')}${failedNames.length > 3 ? '等' : ''}`)
  }
}

onMounted(() => {
  void refreshAiConfigs()
})
</script>

<style scoped>
.price-nested-container {
  padding: 12px 20px;
  background-color: var(--price-surface-panel-soft);
  border-radius: 4px;
}

.price-nested-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.price-nested-header span {
  font-weight: 700;
  color: var(--price-primary);
  font-size: 0.875rem;
}

.price-nested-table {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.price-amount-highlight {
  font-weight: 700;
  color: #d84315;
  font-size: 0.95rem;
}

.price-lowest {
  color: #2e7d32;
  font-weight: 700;
}

.price-expand-toggle {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  color: var(--price-text-body);
}

.price-expand-toggle .el-icon {
  transition: transform 0.18s ease;
}

.price-expand-toggle.is-expanded .el-icon {
  transform: rotate(90deg);
}
</style>
