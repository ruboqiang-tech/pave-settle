import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  deleteProjectAndReloadListMock,
  loadProjectListSnapshotMock,
  saveProjectAndReloadListMock,
} = vi.hoisted(() => ({
  deleteProjectAndReloadListMock: vi.fn(),
  loadProjectListSnapshotMock: vi.fn(),
  saveProjectAndReloadListMock: vi.fn(),
}))

vi.mock('@/services/project-list.service', () => ({
  deleteProjectAndReloadList: deleteProjectAndReloadListMock,
  loadProjectListSnapshot: loadProjectListSnapshotMock,
  saveProjectAndReloadList: saveProjectAndReloadListMock,
}))

import {
  deleteProjectListProject,
  getProjectListDetailRoute,
  loadProjectListPage,
  saveProjectListProject,
} from './project-list.controller'

const emptySnapshot = {
  projects: [],
  contracts: [],
  settlements: [],
  payments: [],
  invoices: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('project-list.controller', () => {
  it('loads the project list page snapshot through project list service', async () => {
    loadProjectListSnapshotMock.mockResolvedValue(emptySnapshot)

    await expect(loadProjectListPage()).resolves.toBe(emptySnapshot)
    expect(loadProjectListSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('saves a new project with create success message', async () => {
    saveProjectAndReloadListMock.mockResolvedValue(emptySnapshot)
    const form = {
      code: 'P-001',
      name: '测试项目',
      projectType: 'highway' as const,
      location: '测试区域',
      ownerUnit: '业主单位',
      generalContractor: '总包单位',
      startDate: '2026-04-10',
      plannedEndDate: '2026-10-10',
      status: 'preparing' as const,
    }

    await expect(saveProjectListProject(form)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '项目已创建',
    })

    expect(saveProjectAndReloadListMock).toHaveBeenCalledWith(form, undefined)
  })

  it('saves an existing project with update success message', async () => {
    saveProjectAndReloadListMock.mockResolvedValue(emptySnapshot)
    const form = {
      code: 'P-002',
      name: '更新项目',
      projectType: 'municipal' as const,
      location: '测试区域',
      ownerUnit: '业主单位',
      generalContractor: '总包单位',
      startDate: '2026-04-10',
      plannedEndDate: '2026-10-10',
      status: 'in_progress' as const,
    }

    await expect(saveProjectListProject(form, 8)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '项目已更新',
    })

    expect(saveProjectAndReloadListMock).toHaveBeenCalledWith(form, 8)
  })

  it('treats project id 0 as update success message', async () => {
    saveProjectAndReloadListMock.mockResolvedValue(emptySnapshot)
    const form = {
      code: 'P-000',
      name: '边界项目',
      projectType: 'municipal' as const,
      location: '测试区域',
      ownerUnit: '业主单位',
      generalContractor: '总包单位',
      startDate: '2026-04-10',
      plannedEndDate: '2026-10-10',
      status: 'in_progress' as const,
    }

    await expect(saveProjectListProject(form, 0)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '项目已更新',
    })

    expect(saveProjectAndReloadListMock).toHaveBeenCalledWith(form, 0)
  })

  it('deletes a project with unified success message', async () => {
    deleteProjectAndReloadListMock.mockResolvedValue(emptySnapshot)

    await expect(deleteProjectListProject(11)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '项目已删除',
    })

    expect(deleteProjectAndReloadListMock).toHaveBeenCalledWith(11)
  })

  it('builds project detail route', () => {
    expect(getProjectListDetailRoute(12)).toBe('/projects/12')
  })
})
