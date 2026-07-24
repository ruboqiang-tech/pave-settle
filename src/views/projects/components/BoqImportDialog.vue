<template>
  <el-dialog :model-value="modelValue" title="导入工程量清单" width="600px" destroy-on-close @update:model-value="$emit('update:modelValue', $event)">
    <div class="pd-import-stack">
      <div>
        <p class="pd-import-note">支持导入 CSV 文件，表头需包含以下字段：</p>
        <el-table :data="importHeaders" size="small" border>
          <el-table-column prop="field" label="字段名" width="120" />
          <el-table-column prop="required" label="必须" width="60" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.required" type="danger" size="small">是</el-tag>
              <el-tag v-else type="info" size="small">否</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="desc" label="说明" />
        </el-table>
      </div>
      <el-upload
        :ref="(el: any) => setUploadRef(el)"
        :auto-upload="false"
        :limit="1"
        accept=".csv,text/csv"
        :on-change="(file: any) => $emit('file-change', file)"
        :on-exceed="() => ElMessage.warning('只能上传一个文件')"
        drag
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">只支持 .csv 格式</div>
        </template>
      </el-upload>
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!importFile" @click="$emit('import')">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadInstance } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

type ImportHeader = {
  field: string
  required: boolean
  desc: string
}

defineProps<{
  modelValue: boolean
  importFile: File | null
  importHeaders: ImportHeader[]
  setUploadRef: (el: UploadInstance | null | undefined) => void
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  'file-change': [file: UploadFile]
  import: []
}>()
</script>
