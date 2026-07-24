<template>
  <div class="am-panel">
    <h3 class="am-title">
      {{ title }}
      <el-badge :value="allAttachments.length" :hidden="allAttachments.length === 0" type="primary" class="am-title-badge" />
    </h3>
    <div class="am-stack">
      <!-- 上传区域 -->
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="10"
        accept=".pdf,.jpg,.jpeg,.png,.bmp,.webp"
        :on-change="handleFileChange"
        :on-exceed="() => ElMessage.warning('单次最多上传10个文件')"
        multiple
        drag
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将{{ title.replace('管理', '') }}拖到此处，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip am-upload-tip">
            支持 PDF、JPG、PNG 等格式，单个文件不超过 10MB
            <span v-if="pendingMode && !entityId" class="am-pending-note">（暂存中，保存后生效）</span>
          </div>
        </template>
      </el-upload>

      <!-- 附件列表 -->
      <div v-if="allAttachments.length > 0" class="am-table-wrap">
        <el-table :data="allAttachments" size="small" border>
          <el-table-column label="文件名" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <el-button link type="primary" size="small" class="am-file-link" @click="previewAttachment(row)">
                <el-icon class="am-file-icon"><Document /></el-icon>{{ row.fileName }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.fileType.startsWith('image') ? 'success' : 'warning'">
                {{ row.fileType.startsWith('image') ? '图片' : 'PDF' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="100" align="right">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row._pending" size="small" type="warning">暂存</el-tag>
              <span v-else-if="showUploadTime && row.uploadedAt" class="am-status-time">{{ row.uploadedAt }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="downloadAttachment(row)">下载</el-button>
              <el-popconfirm title="确认删除该附件？" @confirm="handleDelete(row)">
                <template #reference>
                  <el-button link type="danger" size="small">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无附件" :image-size="60" />
    </div>
  </div>

  <!-- 附件预览对话框 -->
  <el-dialog
    v-model="showPreviewDialog"
    :title="previewFile?.fileName || '附件预览'"
    width="80%"
    top="5vh"
    destroy-on-close
  >
    <div class="am-preview-stage">
      <img
        v-if="previewFile?.fileType?.startsWith('image')"
        :src="previewBlobUrl"
        class="am-preview-media am-preview-media--image"
      />
      <iframe
        v-else-if="previewFile?.fileType === 'application/pdf'"
        :src="previewBlobUrl"
        class="am-preview-media am-preview-media--pdf"
      />
      <el-empty v-else description="不支持预览该文件类型" />
    </div>
    <template #footer>
      <el-button type="primary" @click="downloadCurrentPreview">下载</el-button>
      <el-button @click="closePreview">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import './attachment-manager.css'
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document } from '@element-plus/icons-vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import { getErrorMessage } from '@/utils/error'

export interface AttachmentItem {
  id: number
  fileName: string
  fileType: string
  fileSize: number
  fileData?: string
  uploadedAt?: string
  _pending?: boolean
}

interface AttachmentService {
  getList(entityId: number): Promise<AttachmentItem[]>
  getById(id: number): Promise<AttachmentItem | null>
  create(data: { entityId: number; fileName: string; fileType: string; fileSize: number; fileData: string }): Promise<AttachmentItem>
  delete(id: number): Promise<void>
}

const props = withDefaults(defineProps<{
  title?: string
  entityId: number
  service: AttachmentService
  showUploadTime?: boolean
  /** 暂存模式：entityId为0时允许上传到内存，保存时通过getPendingFiles()获取 */
  pendingMode?: boolean
}>(), {
  title: '附件管理',
  showUploadTime: false,
  pendingMode: false
})

// 已持久化的附件
const attachments = ref<AttachmentItem[]>([])
// 暂存在内存中的附件
const pendingFiles = ref<AttachmentItem[]>([])

// 合并列表用于展示
const allAttachments = computed(() => [...attachments.value, ...pendingFiles.value])
const hasPersistedEntityId = computed(() => props.entityId > 0)

const uploadRef = ref<UploadInstance | null>(null)
const showPreviewDialog = ref(false)
const previewFile = ref<AttachmentItem | null>(null)
const previewBlobUrl = ref('')

const revokePreviewBlobUrl = () => {
  if (!previewBlobUrl.value) return
  URL.revokeObjectURL(previewBlobUrl.value)
  previewBlobUrl.value = ''
}

// 加载已持久化的附件列表
const loadAttachments = async () => {
  if (!hasPersistedEntityId.value) {
    attachments.value = []
    return
  }
  attachments.value = await props.service.getList(props.entityId)
}

// 监听entityId变化
watch(() => props.entityId, () => {
  void loadAttachments()
})

import { formatFileSize } from '@/utils/format'

onMounted(() => {
  void loadAttachments()
})

onBeforeUnmount(() => {
  revokePreviewBlobUrl()
})

// 文件转base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const normalizeBase64Data = (value: string): string => {
  const marker = ';base64,'
  const markerIndex = value.indexOf(marker)
  const rawBase64 = markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value
  const compact = rawBase64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (compact.length % 4)) % 4
  return compact + '='.repeat(paddingLength)
}

// base64转Blob URL
const base64ToBlobUrl = (base64: string, mimeType: string): string => {
  const binaryStr = atob(normalizeBase64Data(base64))
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

// 上传
const handleFileChange = (file: UploadFile) => {
  if (!file.raw) return
  if (file.raw.size > 10 * 1024 * 1024) {
    ElMessage.warning('单个文件不能超过 10MB')
    return
  }
  uploadFile(file.raw)
}

let pendingIdCounter = -1

const uploadFile = async (file: File) => {
  if (!hasPersistedEntityId.value && !props.pendingMode) {
    ElMessage.warning('请先保存后再上传附件')
    return
  }

  try {
    const base64 = await fileToBase64(file)

    if (hasPersistedEntityId.value) {
      // 已有entityId，直接持久化
      await props.service.create({
        entityId: props.entityId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64
      })
      await loadAttachments()
      ElMessage.success(`已上传：${file.name}`)
    } else if (props.pendingMode) {
      // 暂存模式：存内存
      pendingFiles.value.push({
        id: pendingIdCounter--,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64,
        _pending: true
      })
      ElMessage.success(`已暂存：${file.name}`)
    }
  } catch (error) {
    ElMessage.error(`上传失败：${getErrorMessage(error)}`)
  } finally {
    uploadRef.value?.clearFiles()
  }
}

// 删除
const handleDelete = async (row: AttachmentItem) => {
  if (row._pending) {
    // 删除暂存文件
    pendingFiles.value = pendingFiles.value.filter(f => f.id !== row.id)
    ElMessage.success('附件已移除')
    return
  }
  try {
    await props.service.delete(row.id)
    await loadAttachments()
    ElMessage.success('附件已删除')
  } catch (error) {
    ElMessage.error(`删除失败：${getErrorMessage(error)}`)
  }
}

// 预览
const previewAttachment = async (att: AttachmentItem) => {
  try {
    let fileData: string | undefined
    let fileType: string
    let previewTarget: AttachmentItem

    if (att._pending && att.fileData) {
      // 暂存文件直接用内存数据
      fileData = att.fileData
      fileType = att.fileType
      previewTarget = att
    } else {
      const full = await props.service.getById(att.id)
      if (!full || !full.fileData) return
      fileData = full.fileData
      fileType = full.fileType || 'application/octet-stream'
      previewTarget = full
    }

    previewFile.value = previewTarget
    revokePreviewBlobUrl()
    previewBlobUrl.value = base64ToBlobUrl(fileData, fileType)
    showPreviewDialog.value = true
  } catch (error) {
    ElMessage.error(`预览失败：${getErrorMessage(error)}`)
  }
}

// 下载
const downloadAttachment = async (att: AttachmentItem) => {
  try {
    let fileData: string | undefined
    let fileName: string
    let fileType: string

    if (att._pending && att.fileData) {
      fileData = att.fileData
      fileName = att.fileName
      fileType = att.fileType
    } else {
      const full = await props.service.getById(att.id)
      if (!full || !full.fileData) return
      fileData = full.fileData
      fileName = full.fileName
      fileType = full.fileType || 'application/octet-stream'
    }

    const blobUrl = base64ToBlobUrl(fileData, fileType)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    ElMessage.error(`下载失败：${getErrorMessage(error)}`)
  }
}

// 预览对话框下载
const downloadCurrentPreview = () => {
  if (previewFile.value && previewBlobUrl.value) {
    const a = document.createElement('a')
    a.href = previewBlobUrl.value
    a.download = previewFile.value.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

// 关闭预览
const closePreview = () => {
  showPreviewDialog.value = false
  previewFile.value = null
  revokePreviewBlobUrl()
}

/** 获取暂存文件列表，供父组件在保存时调用 */
const getPendingFiles = (): { fileName: string; fileType: string; fileSize: number; fileData: string }[] => {
  return pendingFiles.value.filter(f => f.fileData).map(f => ({
    fileName: f.fileName,
    fileType: f.fileType,
    fileSize: f.fileSize,
    fileData: f.fileData!
  }))
}

/** 清空暂存文件，保存成功后调用 */
const clearPendingFiles = () => {
  pendingFiles.value = []
}

defineExpose({ loadAttachments, getPendingFiles, clearPendingFiles })
</script>
