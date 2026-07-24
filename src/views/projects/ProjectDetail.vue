<template>
  <div v-if="project" class="page-theme project-detail-page pd-page">
    <ProjectHero :project="project" :project-scale="projectScale" @edit="openProjectEditor" />

    <ProjectContractsPanel
      :contracts="contracts"
      :boq-map="boqMap"
      :edit-forms="editForms"
      :expanded-ids="expandedIds"
      :saving-id="savingId"
      :show-new-contract="showNewContract"
      :new-saving="newSaving"
      :new-form="newForm"
      :new-boq-rows="newBoqRows"
      :attach-counts="attachCounts"
      :contract-rules="contractRules"
      :tax-rate-options="taxRateOptions"
      :label-width="PD_FORM_LABEL_WIDTH"
      :new-boq-table-max-height="PD_NEW_BOQ_TABLE_MAX_HEIGHT"
      :boq-table-max-height="PD_BOQ_TABLE_MAX_HEIGHT"
      :set-new-form-ref="setNewFormRef"
      :set-form-ref="setFormRef"
      :get-contract-total="getContractTotal"
      :get-contract-no-tax="getContractNoTax"
      :get-contract-tax="getContractTax"
      :boq-summary-method="getBoqSummary"
      @create-contract="createContract"
      @cancel-new-contract="cancelNewContract"
      @save-new-contract="saveNewContract"
      @toggle-contract="toggleContract"
      @delete-contract="deleteContract"
      @add-new-boq-row="addNewBoqRow"
      @remove-new-boq-row="removeNewBoqRow"
      @new-boq-quantity-change="onNewBoqQuantityChange"
      @new-boq-tax-rate-change="onNewBoqTaxRateChange"
      @new-boq-no-tax-price-change="onNewBoqNoTaxPriceChange"
      @new-boq-unit-price-change="onNewBoqUnitPriceChange"
      @open-attach-drawer="openAttachDrawer"
      @open-import-dialog="openImportDialog"
      @download-template="downloadTemplate"
      @add-boq-row="addBoqRow"
      @export-boq="exportBOQ"
      @save-contract="saveContract"
      @remove-boq-row="removeBoqRow"
      @boq-quantity-change="onQuantityChange"
      @boq-tax-rate-change="onTaxRateChange"
      @boq-no-tax-price-change="onNoTaxUnitPriceChange"
      @boq-unit-price-change="onUnitPriceChange"
    />

    <SettlementRecordTable
      :settlements="settlements"
      :summary-method="getSettlementSummary"
      @view="viewSettlement"
    />

    <ProjectEditDialog
      v-model="showEditDialog"
      :edit-form="editForm"
      :label-width="PD_FORM_LABEL_WIDTH"
      @save="saveProject"
    />

    <!-- 附件抽屉 -->
    <el-drawer v-model="showAttachDrawer" title="合同附件" size="500px" destroy-on-close>
      <AttachmentManager
        v-if="attachDrawerContractId"
        :key="attachDrawerContractId"
        :entity-id="attachDrawerContractId"
        :service="contractAttachmentAdapter"
        title="合同附件"
        @change="onAttachChange"
      />
    </el-drawer>

    <BoqImportDialog
      v-model="showImportDialog"
      :import-file="importFile"
      :import-headers="importHeaders"
      :set-upload-ref="setUploadRef"
      @file-change="handleFileChange"
      @import="handleImport"
    />
  </div>
  <div v-else class="pd-empty-state">
    <el-empty description="项目不存在或已被删除">
      <el-button type="primary" @click="goBackToProjects">返回项目列表</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import './project-detail.css'
import AttachmentManager from '@/components/AttachmentManager.vue'
import BoqImportDialog from './components/BoqImportDialog.vue'
import ProjectContractsPanel from './components/ProjectContractsPanel.vue'
import ProjectEditDialog from './components/ProjectEditDialog.vue'
import ProjectHero from './components/ProjectHero.vue'
import SettlementRecordTable from './components/SettlementRecordTable.vue'
import { useProjectDetail } from './useProjectDetail'

const PD_FORM_LABEL_WIDTH = '100px'
const PD_NEW_BOQ_TABLE_MAX_HEIGHT = 300
const PD_BOQ_TABLE_MAX_HEIGHT = 400


const {
  project,
  contracts,
  projectScale,
  settlements,
  boqMap,
  editForms,
  expandedIds,
  savingId,
  showEditDialog,
  editForm,
  showNewContract,
  newSaving,
  newForm,
  newBoqRows,
  showAttachDrawer,
  attachDrawerContractId,
  attachCounts,
  showImportDialog,
  importFile,
  contractRules,
  importHeaders,
  taxRateOptions,
  contractAttachmentAdapter,
  setNewFormRef,
  setUploadRef,
  setFormRef,
  toggleContract,
  getContractTotal,
  getContractNoTax,
  getContractTax,
  onNoTaxUnitPriceChange,
  onUnitPriceChange,
  onTaxRateChange,
  onQuantityChange,
  addBoqRow,
  removeBoqRow,
  getBoqSummary,
  getSettlementSummary,
  saveContract,
  createContract,
  cancelNewContract,
  saveNewContract,
  deleteContract,
  addNewBoqRow,
  removeNewBoqRow,
  onNewBoqQuantityChange,
  onNewBoqNoTaxPriceChange,
  onNewBoqUnitPriceChange,
  onNewBoqTaxRateChange,
  openAttachDrawer,
  onAttachChange,
  openImportDialog,
  handleFileChange,
  handleImport,
  downloadTemplate,
  exportBOQ,
  viewSettlement,
  openProjectEditor,
  saveProject,
  goBackToProjects,
} = useProjectDetail()
</script>
