import { computed, onMounted, ref } from 'vue'
import { systemSettingsService } from '@/services/system-settings.service'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { createEmptyBusinessSnapshot, type BusinessSnapshot } from '@/services/analytics.service'
import { getErrorMessage } from '@/utils/error'
import { withLoading } from '../with-loading'
import {
  buildProjectListRows,
  buildProjectListSummary,
  createProjectForm,
  filterProjectRows,
  projectRules,
  projectStatusOptions,
  projectStatusTextMap,
  projectStatusTypeMap,
  projectTypeOptions,
  projectTypeTextMap,
  suggestNextProjectCode,
  type ProjectFormState,
  type ProjectListRow,
} from './project-list.helpers'
import {
  deleteProjectListProject,
  getProjectListDetailRoute,
  loadProjectListPage,
  saveProjectListProject,
} from './project-list.controller'

export function useProjectList() {
  const router = useRouter()

  const snapshot = ref<BusinessSnapshot>(createEmptyBusinessSnapshot())
  const searchQuery = ref('')
  const filterStatus = ref<'' | ProjectListRow['status']>('')
  const filterType = ref<'' | ProjectListRow['projectType']>('')

  const showDialog = ref(false)
  const saving = ref(false)
  const editingId = ref<number | null>(null)
  const projectFormRef = ref<FormInstance>()
  const projectForm = ref<ProjectFormState>(createProjectForm())

  const projectRows = computed(() => buildProjectListRows(snapshot.value))
  const filteredProjectRows = computed(() => filterProjectRows(projectRows.value, {
    searchQuery: searchQuery.value,
    status: filterStatus.value,
    projectType: filterType.value,
  }))
  const projectSummary = computed(() => buildProjectListSummary(filteredProjectRows.value))
  const hasActiveFilters = computed(() =>
    searchQuery.value.trim().length > 0
    || filterStatus.value !== ''
    || filterType.value !== '',
  )
  const dialogTitle = computed(() => (editingId.value !== null ? '编辑项目' : '新建项目'))

  const scaleThresholds = ref({ small: 5000000, large: 20000000 })

  async function loadPageData() {
    snapshot.value = await loadProjectListPage()
    try {
      scaleThresholds.value = await systemSettingsService.getProjectScaleThresholds()
    } catch (e) {
      console.warn('Failed to load project scale thresholds', e)
    }
  }

  function resetFilters() {
    searchQuery.value = ''
    filterStatus.value = ''
    filterType.value = ''
  }

  function resetForm() {
    editingId.value = null
    projectForm.value = createProjectForm()
    projectFormRef.value?.clearValidate()
  }

  function openCreateDialog() {
    resetForm()
    projectForm.value.code = suggestNextProjectCode(snapshot.value.projects)
    showDialog.value = true
  }

  function openEditDialog(project: ProjectListRow) {
    editingId.value = project.id
    projectForm.value = createProjectForm(project)
    showDialog.value = true
  }

  async function handleSave() {
    if (!projectFormRef.value) return
    const valid = await projectFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
      await withLoading(saving, async () => {
        const result = await saveProjectListProject(projectForm.value, editingId.value)
        snapshot.value = result.snapshot
        ElMessage.success(result.successMessage)
        showDialog.value = false
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '淇濆瓨澶辫触'))
    }
  }

  async function handleDelete(id: number) {
    try {
      const result = await deleteProjectListProject(id)
      snapshot.value = result.snapshot
      ElMessage.success(result.successMessage)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '鍒犻櫎澶辫触'))
    }
  }

  function viewProject(id: number) {
    void router.push(getProjectListDetailRoute(id))
  }

  onMounted(() => {
    void loadPageData()
  })

  return {
    searchQuery,
    filterStatus,
    filterType,
    showDialog,
    saving,
    projectFormRef,
    projectForm,
    projectRules,
    dialogTitle,
    projectStatusOptions,
    projectStatusTextMap,
    projectStatusTypeMap,
    projectTypeOptions,
    projectTypeTextMap,
    filteredProjectRows,
    projectSummary,
    hasActiveFilters,
    resetFilters,
    resetForm,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
    viewProject,
    scaleThresholds,
  }
}
