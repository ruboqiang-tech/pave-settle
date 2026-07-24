import type { Project } from '@/types'
import { loadBusinessSnapshot, type BusinessSnapshot } from './analytics.service'
import { projectService } from './project.service'
import { mutateAndReloadSnapshot } from './snapshot-mutation'

export type ProjectListUpsertInput = Omit<Project, 'id' | 'createdAt'>

export async function loadProjectListSnapshot(): Promise<BusinessSnapshot> {
  return loadBusinessSnapshot()
}

export async function saveProjectAndReloadList(
  input: ProjectListUpsertInput,
  projectId?: number | null,
): Promise<BusinessSnapshot> {
  return mutateAndReloadSnapshot(
    () => (projectId != null ? projectService.update(projectId, input) : projectService.create(input)),
    loadProjectListSnapshot,
  )
}

export async function deleteProjectAndReloadList(
  projectId: number,
): Promise<BusinessSnapshot> {
  return mutateAndReloadSnapshot(
    () => projectService.delete(projectId),
    loadProjectListSnapshot,
  )
}
