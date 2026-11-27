import { lstat, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

/** Called at single-instance boot before any runtime is created. The base can itself be a link. */
export async function cleanupLegacyPluginCopies(userData: string): Promise<void> {
  const base = join(userData, 'runtime-plugins')
  if (!(await lstat(base).catch(() => undefined))?.isDirectory()) return
  const entries = await readdir(base, { withFileTypes: true }).catch(() => [])
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.name.startsWith('generation-') && (entry.isDirectory() || entry.isSymbolicLink())
      )
      .map((entry) =>
        rm(join(base, entry.name), { recursive: true, force: true }).catch(() => undefined)
      )
  )
}
