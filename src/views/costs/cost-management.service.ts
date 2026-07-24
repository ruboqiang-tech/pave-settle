import type { Contract, Project, Settlement } from '@/types'
import type { ProjectCostEntry } from '@/services/costing.service'
import { contractService } from '@/services/contract.service'
import { projectCostService } from '@/services/project-cost.service'
import { projectService } from '@/services/project.service'
import { settlementService } from '@/services/settlement.service'

export interface CostManagementSnapshot {
  projects: Project[]
  project: Project | null
  contracts: Contract[]
  settlements: Settlement[]
  costEntries: ProjectCostEntry[]
}

export async function loadCostManagementSnapshot(projectId?: number): Promise<CostManagementSnapshot> {
  const projects = await projectService.getAll()

  if (projectId === 0) {
    return {
      projects,
      project: null,
      contracts: [],
      settlements: [],
      costEntries: [],
    }
  }

  const selectedProjectId = projectId && projects.some(project => project.id === projectId)
    ? projectId
    : projects.find(p => p.status !== 'preparing')?.id ?? 0

  if (selectedProjectId <= 0) {
    return {
      projects,
      project: null,
      contracts: [],
      settlements: [],
      costEntries: [],
    }
  }

  const [project, contracts, settlements, costEntries] = await Promise.all([
    projectService.getById(selectedProjectId),
    contractService.getAllByProjectId(selectedProjectId),
    settlementService.getByProjectId(selectedProjectId),
    projectCostService.listByProjectId(selectedProjectId),
  ])

  return {
    projects,
    project,
    contracts,
    settlements,
    costEntries,
  }
}
