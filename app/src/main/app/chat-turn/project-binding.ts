import { randomUUID } from 'node:crypto'
import type { DbQueries } from '../../infra/db/queries'
import { projectPath } from '../../infra/config/project-path'

/** Called only after execution preparation, with the selected source path (before isolation). */
export function bindStartingProject(
  db: Pick<DbQueries, 'getProject' | 'ensurePathProject'>,
  sourceCwd: string,
  preferredProjectId: string | null,
  defaultCwd: string
): string {
  const path = projectPath(sourceCwd)
  const preferred = preferredProjectId ? db.getProject(preferredProjectId) : null
  // An explicitly opened legacy project retains its instructions and identity at its default.
  if (preferred && projectPath(preferred.cwd ?? defaultCwd).key === path.key) return preferred.id
  return db.ensurePathProject({
    id: randomUUID(),
    name: path.name,
    instructions: '',
    cwd: path.cwd,
    cwdKey: path.key,
    createdAt: Date.now()
  }).id
}
