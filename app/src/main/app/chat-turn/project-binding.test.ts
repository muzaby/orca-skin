import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { toProject } from '../../infra/ipc/dto'
import { directDataPort } from '../data-host/data-port.testfixture'
import { bindStartingProject } from './project-binding'

const opened: Database.Database[] = []
afterEach(() => {
  for (const db of opened.splice(0)) db.close()
})
function setup(): DbQueries {
  const db = new Database(':memory:')
  opened.push(db)
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return new DbQueries(db)
}

describe('first session project binding through real SQLite', () => {
  it('reuses a normalized path, keeps same names at different paths and exposes cwd in DTO', async () => {
    const db = setup()
    const first = await bindStartingProject(
      directDataPort(db),
      'C:\\A\\Demo\\',
      null,
      'C:\\Users\\me\\Desktop'
    )
    const again = await bindStartingProject(
      directDataPort(db),
      'c:/a/demo',
      null,
      'C:\\Users\\me\\Desktop'
    )
    const other = await bindStartingProject(
      directDataPort(db),
      'C:\\B\\Demo',
      null,
      'C:\\Users\\me\\Desktop'
    )
    expect(first.created).toBe(true)
    expect(again).toEqual({ projectId: first.projectId, created: false })
    expect(other.created).toBe(true)
    expect(other.projectId).not.toBe(first.projectId)
    expect(db.listProjects().map((p) => p.name)).toEqual(['Demo', 'Demo'])
    expect(toProject(db.getProject(first.projectId)!)).toMatchObject({ cwd: 'C:\\A\\Demo' })
    db.updateProject(first.projectId, { name: 'Custom', instructions: 'Keep instructions' }, 10)
    expect(await bindStartingProject(directDataPort(db), 'c:/a/demo', null, 'C:\\Desktop')).toEqual(
      {
        projectId: first.projectId,
        created: false
      }
    )
    expect(db.getProject(first.projectId)).toMatchObject({
      name: 'Custom',
      instructions: 'Keep instructions'
    })
  })
  it('keeps an explicit legacy project at its default and uses a new path after cwd selection', async () => {
    const db = setup()
    db.insertProject({
      id: 'legacy',
      name: 'Old name',
      instructions: 'Original instructions',
      createdAt: 1
    })
    expect(
      await bindStartingProject(directDataPort(db), 'C:\\Desktop', 'legacy', 'C:\\Desktop')
    ).toEqual({
      projectId: 'legacy',
      created: false
    })
    const changed = await bindStartingProject(
      directDataPort(db),
      'C:\\Other',
      'legacy',
      'C:\\Desktop'
    )
    expect(changed.projectId).not.toBe('legacy')
    expect(changed.created).toBe(true)
    expect(db.getProject('legacy')).toMatchObject({
      cwd: null,
      instructions: 'Original instructions'
    })
    expect(db.getProject(changed.projectId)).toMatchObject({ cwd: 'C:\\Other', instructions: '' })
  })
  it('writes project membership separately from an isolated execution cwd and preserves it on reload', async () => {
    const db = setup()
    const { projectId } = await bindStartingProject(
      directDataPort(db),
      'C:\\Source\\Repo',
      null,
      'C:\\Desktop'
    )
    db.insertSession({
      id: 's1',
      backend: 'claude',
      projectId,
      title: 'Work',
      createdAt: 1,
      cwd: 'C:\\isolated\\w1',
      agentKind: 'code'
    })
    expect(db.getSessionById('s1')).toMatchObject({
      project_id: projectId,
      cwd: 'C:\\isolated\\w1'
    })
    expect(db.listSessionsByProject(projectId).map((s) => s.id)).toEqual(['s1'])
    expect(db.getProject(projectId)?.cwd).toBe('C:\\Source\\Repo')
  })
})
