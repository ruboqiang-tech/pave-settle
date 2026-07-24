<template>
  <section class="dc-panel dc-ai-panel">
    <div class="dc-panel__head">
      <div>
        <h2 class="dc-panel__title">AI 能力配置</h2>
        <p class="dc-panel__desc">统一管理各模块调用的 AI Key 与模型配置。</p>
      </div>
      <div class="dc-ai-panel__actions">
        <el-button size="small" @click="$emit('add-config', 'gemini')">添加 Key</el-button>
        <el-button type="primary" size="small" :loading="saving" @click="$emit('save-configs')">
          保存配置
        </el-button>
      </div>
    </div>

    <div class="dc-ai-config-list">
      <div
        v-for="config in configs"
        :key="config.id"
        class="dc-ai-config-item"
      >
        <!-- 第一行：配置名称 + 厂商选择 + 操作区 -->
        <div class="dc-ai-config-item__header">
          <div class="dc-ai-config-item__title-group">
            <el-input v-model="config.name" size="small" placeholder="配置名称" class="name-input" />
            <el-select v-model="config.provider" size="small" class="provider-select" @change="handleProviderChange(config)">
              <el-option label="Google Gemini" value="gemini" />
              <el-option label="OpenAI 中转" value="openai" />
            </el-select>
          </div>
          <div class="dc-ai-config-item__actions">
            <el-switch v-model="config.enabled" size="small" active-text="启用" inactive-text="停用" inline-prompt />
            <el-radio
              :model-value="defaultConfigId"
              :value="config.id"
              size="small"
              class="mr-0"
              @change="$emit('set-default-config', config.id)"
            >
              默认调用
            </el-radio>
            <el-button
              type="danger"
              size="small"
              link
              :disabled="configs.length <= 1"
              @click="$emit('delete-config', config.id)"
            >
              删除
            </el-button>
          </div>
        </div>

        <!-- 第二行：API Key + 中转地址 -->
        <div class="dc-ai-config-item__body">
          <el-input
            v-model="config.apiKey"
            type="password"
            size="small"
            placeholder="API Key"
            show-password
            class="key-input"
          />
          <el-input
            v-if="config.provider === 'openai'"
            v-model="config.baseUrl"
            size="small"
            placeholder="中转地址，例如: https://api.openai.com/v1"
            class="url-input"
          />
        </div>

        <!-- 第三行：模型选择 + 拉取按钮 + 状态 -->
        <div class="dc-ai-config-item__model-row">
          <el-select
            v-model="config.model"
            size="small"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入模型名称"
            class="model-select"
            :loading="getModelState(config.id).status === 'loading'"
          >
            <el-option
              v-for="m in getModelOptions(config)"
              :key="m.id"
              :label="m.name !== m.id ? `${m.name} (${m.id})` : m.id"
              :value="m.id"
            >
              <div class="model-option-item">
                <span class="model-option-name">{{ m.name !== m.id ? m.name : m.id }}</span>
                <span v-if="m.name !== m.id" class="model-option-id">{{ m.id }}</span>
              </div>
            </el-option>
          </el-select>
          <el-button
            size="small"
            :loading="getModelState(config.id).status === 'loading'"
            :disabled="!config.apiKey.trim()"
            @click="$emit('fetch-models', config.id)"
          >
            <template #icon><Refresh /></template>
            拉取模型
          </el-button>
          <span class="dc-ai-connection-status">
            <span
              v-if="getModelState(config.id).status === 'success'"
              class="pulse-lamp lamp-green"
              title="已验证"
            />
            <span
              v-else-if="getModelState(config.id).status === 'error'"
              class="pulse-lamp lamp-red"
              :title="getModelState(config.id).error || '连接失败'"
            />
            <span
              v-else
              class="pulse-lamp lamp-gray"
              title="未验证"
            />
            <span class="dc-ai-connection-label dc-muted">
              {{ getStatusLabel(config.id) }}
            </span>
          </span>
        </div>

        <!-- 错误提示 -->
        <div v-if="getModelState(config.id).status === 'error'" class="dc-ai-error-tip">
          <el-alert
            :title="getModelState(config.id).error || '获取模型失败'"
            type="error"
            :closable="false"
            show-icon
            size="small"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { AiProvider, AiProviderConfig } from '@/services/ai-config.service'
import type { AiModelInfo, FetchModelsStatus } from '@/services/ai-model-list.service'

export interface ModelFetchState {
  status: FetchModelsStatus
  models: AiModelInfo[]
  error?: string
}

const props = defineProps<{
  configs: AiProviderConfig[]
  saving: boolean
  modelStates: Record<string, ModelFetchState>
}>()

defineEmits<{
  (e: 'add-config', provider: AiProvider): void
  (e: 'delete-config', id: string): void
  (e: 'set-default-config', id: string): void
  (e: 'save-configs'): void
  (e: 'fetch-models', configId: string): void
}>()

const defaultConfigId = computed(() => props.configs.find(config => config.isDefault)?.id || '')

const defaultIdleState: ModelFetchState = { status: 'idle', models: [] }

function getModelState(configId: string): ModelFetchState {
  return props.modelStates[configId] ?? defaultIdleState
}

/** 合并远端拉取的模型列表 + 静态兜底列表 */
function getModelOptions(config: AiProviderConfig): AiModelInfo[] {
  const fetched = getModelState(config.id).models
  if (fetched.length > 0) return fetched

  // 兜底：提供常见模型供选择
  if (config.provider === 'gemini') {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ]
  }
  return [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
  ]
}

function getStatusLabel(configId: string): string {
  const state = getModelState(configId)
  switch (state.status) {
    case 'loading': return '验证中…'
    case 'success': return `已验证 (${state.models.length} 个模型)`
    case 'error': return '连接失败'
    default: return '未验证'
  }
}

function handleProviderChange(config: AiProviderConfig) {
  if (config.provider === 'openai') {
    config.baseUrl ||= 'https://api.openai.com/v1'
    config.model ||= 'gpt-4o-mini'
    return
  }

  config.baseUrl = ''
  config.model ||= 'gemini-2.5-flash'
}
</script>
