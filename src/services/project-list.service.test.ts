import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types'

const {
  loadBusinessSnapshotMock,
  projectServiceMock,
} = vi.hoisted(() => ({
  loadBusinessSnapshotMock: vi.fn(),
  projectServiceMock: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('./analytics.service', () => ({
  loadBusinessSnapshot: loadBusinessSnapshotMock,
}))

vi.mock('./project.service', () => ({
  projectService: projectServiceMock,
}))

import {
  deleteProjectAndReloadList,
  loadProjectListSnapshot,
  saveProjectAndReloadList,
} from './project-list.service'

function makeProjectInput(): Omit<Project, 'id' | 'createdAt'> {
  return {
    code: 'XM-001',
    name: '测试项目',
    projectType: 'highway',
    location: '测试地点',
    ownerUnit: '业主单位',
    generalContractor: '总包单位',
    startDate: '2026-04-01',
    plannedEndDate: '2026-12-31',
    status: 'preparing',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('project-list.service', () => {
  it('loads project list snapshot from analytics snapshot service', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(loadProjectListSnapshot()).resolves.toBe(snapshot)
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('creates a project and reloads project list snapshot', async () => {
    const snapshot = { projects: [{ id: 1 }], contracts: [], settlements: [], payments: [], invoices: [] }
    const input = makeProjectInput()
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(saveProjectAndReloadList(input)).resolves.toBe(snapshot)

    expect(projectServiceMock.create).toHaveBeenCalledWith(input)
    expect(projectServiceMock.update).not.toHaveBeenCalled()
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('updates a project and reloads project list snapshot', async () => {
    const snapshot = { projects: [{ id: 2 }], contracts: [], settlements: [], payments: [], invoices: [] }
    const input = {
      ...makeProjectInput(),
      name: '测试项目-更新',
      status: 'settling' as const,
    }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(saveProjectAndReloadList(input, 2)).resolves.toBe(snapshot)

    expect(projectServiceMock.update).toHaveBeenCalledWith(2, input)
    expect(projectServiceMock.create).not.toHaveBeenCalled()
  })

  it('treats project id 0 as update path instead of create path', async () => {
    const snapshot = { projects: [{ id: 0 }], contracts: [], settlements: [], payments: [], invoices: [] }
    const input = makeProjectInput()
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(saveProjectAndReloadList(input, 0)).resolves.toBe(snapshot)

    expect(projectServiceMock.update).toHaveBeenCalledWith(0, input)
    expect(projectServiceMock.create).not.toHaveBeenCalled()
  })

  it('deletes a project and reloads project list snapshot', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(deleteProjectAndReloadList(3)).resolves.toBe(snapshot)

    expect(projectServiceMock.delete).toHaveBeenCalledWith(3)
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })
})
