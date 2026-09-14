import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../../../../../shared/ipc'

const api = vi.hoisted(() => ({ list: vi.fn(), delete: vi.fn(), create: vi.fn() }))
vi.mock('../../../shared/api/ipc', () => ({ projectApi: api }))

function project(id: string): Project {
  return { id, name: id, instructions: '', createdAt: 1, updatedAt: 1, cwd: null, pinnedAt: null }
}

describe('projectsStore deletion', () => {
  beforeEach(() => {
    vi.resetModules()
    api.list.mockReset()
    api.delete.mockReset().mockResolvedValue(undefined)
    api.create.mockReset()
  })

  it('successful delete removes locally without turning a later refresh failure into delete failure', async () => {
    const { projectsActions, useProjectsStore } = await import('./projectsStore')
    const other = project('other')
    useProjectsStore.setState({ list: [project('p'), other], loading: false })
    api.list.mockRejectedValue(new Error('list unavailable'))
    await expect(projectsActions.remove('p')).resolves.toBeUndefined()
    expect(api.delete).toHaveBeenCalledWith('p')
    expect(useProjectsStore.getState().list).toEqual([other])
    expect(useProjectsStore.getState().list[0]).toBe(other)
  })

  it('failed delete preserves catalog and does not prevent future refresh of the project', async () => {
    const { projectsActions, useProjectsStore } = await import('./projectsStore')
    const list = [project('p')]
    useProjectsStore.setState({ list, loading: false })
    api.delete.mockRejectedValue(new Error('delete unavailable'))
    await expect(projectsActions.remove('p')).rejects.toThrow('delete unavailable')
    expect(useProjectsStore.getState().list).toBe(list)
    api.list.mockResolvedValue(list)
    await projectsActions.refresh()
    expect(useProjectsStore.getState().list).toEqual(list)
  })

  it('a list started before deletion and later lists cannot resurrect that ID but allow a new UUID', async () => {
    const { projectsActions, useProjectsStore } = await import('./projectsStore')
    let resolve!: (items: Project[]) => void
    api.list.mockReturnValue(
      new Promise<Project[]>((done) => {
        resolve = done
      })
    )
    useProjectsStore.setState({ list: [project('p')], loading: false })
    const pending = projectsActions.refresh()
    await projectsActions.remove('p')
    resolve([project('p'), project('new-uuid')])
    await pending
    expect(useProjectsStore.getState().list.map((p) => p.id)).toEqual(['new-uuid'])
    api.list.mockResolvedValue([project('p'), project('new-uuid')])
    await projectsActions.refresh()
    expect(useProjectsStore.getState().list.map((p) => p.id)).toEqual(['new-uuid'])
  })
})
