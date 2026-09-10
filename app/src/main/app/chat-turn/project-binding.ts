import { randomUUID } from 'node:crypto'
import type { DbQueries } from '../../infra/db/queries'
import { projectPath } from '../../infra/config/project-path'

/** Called only after execution preparation, with the selected source path (before isolation). */
export function bindStartingProject(
  db: Pick<DbQueries, 'getProject' | 'ensurePathProject'>,
  sourceCwd: string,
  preferredProjectId: string | null,
  defaultCwd: string
): { projectId: string; created: boolean } {
  const path = projectPath(sourceCwd)
  const preferred = preferredProjectId ? db.getProject(preferredProjectId) : null
  // An explicitly opened legacy project retains its instructions and identity at its default.
  if (preferred && projectPath(preferred.cwd ?? defaultCwd).key === path.key)
    return { projectId: preferred.id, created: false }
  const candidateId = randomUUID()
  const project = db.ensurePathProject({
    id: candidateId,
    name: path.name,
    instructions: '',
    cwd: path.cwd,
    cwdKey: path.key,
    createdAt: Date.now()
  })
  // The transaction returns the pre-existing row or the row inserted with this candidate ID.
  return { projectId: project.id, created: project.id === candidateId }
}
