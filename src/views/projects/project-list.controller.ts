import type { BusinessSnapshot } from '@/services/analytics.service'
import {
  deleteProjectAndReloadList,
  loadProjectListSnapshot,
  saveProjectAndReloadList,
} from '@/services/project-list.service'
import type { ProjectFormState } from './project-list.helpers'

export interface ProjectListMutationResult {
  snapshot: BusinessSnapshot
  successMessage: string
}

export async function loadProjectListPage(): Promise<BusinessSnapshot> {
  return loadProjectListSnapshot()
}

export async function saveProjectListProject(
  form: ProjectFormState,
  projectId?: number | null,
): Promise<ProjectListMutationResult> {
  const snapshot = await saveProjectAndReloadList({ ...form }, projectId ?? undefined)
  return {
    snapshot,
    successMessage: projectId != null ? '项目已更新' : '项目已创建',
  }
}

export async function deleteProjectListProject(projectId: number): Promise<ProjectListMutationResult> {
  const snapshot = await deleteProjectAndReloadList(projectId)
  return {
    snapshot,
    successMessage: '项目已删除',
  }
}

export function getProjectListDetailRoute(projectId: number): string {
  return `/projects/${projectId}`
}
