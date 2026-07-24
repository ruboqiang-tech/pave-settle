<template>
  <div v-loading="pageLoading" class="cost-management-page">
    <el-tabs v-model="activeWorkspace" class="cost-workspace-tabs">
      <el-tab-pane label="预算测算" name="budget-template">
        <CostBudgetTemplatePanel
          :price-resource-items="priceResourceItems"
          :selected-quote-map="selectedQuoteMap"
          :quota-items="quotaItems"
          :param-rules="paramRules"
          :budget-files="budgetFiles"
          :budget-files-loaded="budgetFilesLoaded"
          @create-file="createBudgetFile"
          @update-file="updateBudgetFile"
          @delete-file="deleteBudgetFile"
        />
      </el-tab-pane>
      <el-tab-pane label="价格库" name="price-library">
        <PriceLibrary
          :price-resource-items="priceResourceItems"
          @add-resource="addPriceResource"
          @delete-resource="removePriceResource"
          @add-quote="addResourceQuote"
          @delete-quote="removeResourceQuote"
        />
      </el-tab-pane>
      <el-tab-pane label="定额库维护" name="quota-library">
        <QuotaLibraryPanel
          :quota-items="quotaItems"
          :param-rules="paramRules"
          @add-quota="addQuotaItem"
          @update-quota="updateQuotaItem"
          @delete-quota="removeQuotaItem"
          @update-rule="updateParamRule"
          @add-rule="addParamRule"
          @delete-rule="removeParamRule"
        />
      </el-tab-pane>
      <el-tab-pane label="成本台账" name="cost-ledger">
        <ProjectCostManagementPanel
          :project="project"
          :signed-projects="signedProjects"
          :budget-files="budgetFiles"
          :associated-boq-items="associatedBoqItems"
          :actual-rows="actualRows"
          :summary="costSummary"
          :actual-saving="actualSaving"
          :quota-items="quotaItems"
          :price-resource-items="priceResourceItems"
          :selected-quote-map="selectedQuoteMap"
          @select-project="selectProject"
          @associate-budget="associateProjectBudget"
          @add-row="addCostRow"
          @remove-row="removeCostRow"
          @recalculate-row="recalculateCostRow"
          @save="saveCostPhase"
        />
      </el-tab-pane>
      <el-tab-pane label="实际消耗分析" name="actual-quota-analysis">
        <ActualQuotaAnalysisPanel
          :quota-items="quotaItems"
          :projects="projects"
          @refresh-quotas="refreshQuotas"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import './cost-management.css'
import { computed, ref } from 'vue'
import CostBudgetTemplatePanel from './components/CostBudgetTemplatePanel.vue'
import PriceLibrary from './PriceLibrary.vue'
import QuotaLibraryPanel from './components/QuotaLibraryPanel.vue'
import ProjectCostManagementPanel from '../projects/components/ProjectCostManagementPanel.vue'
import ActualQuotaAnalysisPanel from './components/ActualQuotaAnalysisPanel.vue'
import { useCostManagement } from './useCostManagement'
import { quotaLibraryService } from '@/services/quota-library.service'

const activeWorkspace = ref('budget-template')

const {
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
  budgetFiles,
  budgetFilesLoaded,
  createBudgetFile,
  updateBudgetFile,
  deleteBudgetFile,
  associateProjectBudget,
} = useCostManagement()

// Computed variables for project-budget decoupled ledger
const signedProjects = computed(() => {
  return projects.value.filter(p => p.status !== 'preparing')
})

const associatedBudgetFile = computed(() => {
  if (!project.value || !project.value.budgetFileId) return null
  return budgetFiles.value.find(f => f.id === project.value!.budgetFileId) || null
})

const associatedBoqItems = computed(() => {
  if (!associatedBudgetFile.value) return []
  try {
    const data = JSON.parse(associatedBudgetFile.value.content)
    return data.computedBOQItems || []
  } catch (e) {
    console.error(e)
    return []
  }
})

async function refreshQuotas() {
  try {
    const dbQuotaItems = await quotaLibraryService.listQuotaItems()
    quotaItems.splice(0, quotaItems.length, ...dbQuotaItems)
  } catch (e) {
    console.error('Failed to refresh quotas', e)
  }
}
</script>
