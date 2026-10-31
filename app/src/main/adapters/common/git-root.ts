import { statSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

function* ancestors(cwd: string): Generator<string> {
  for (let current = resolve(cwd); ; current = dirname(current)) {
    yield current
    if (dirname(current) === current) return
  }
}

export function gitRootSync(cwd: string): string {
  for (const directory of ancestors(cwd)) {
    try {
      statSync(join(directory, '.git'))
      return directory
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return resolve(cwd)
}

/** Includes every searched ancestor, even when the cwd has no Git boundary. */
export async function gitRootLineage(
  cwd: string,
  inspect: (file: string) => Promise<unknown> = stat
): Promise<{ root: string; directories: string[] }> {
  const directories: string[] = []
  for (const directory of ancestors(cwd)) {
    directories.push(directory)
    try {
      await inspect(join(directory, '.git'))
      return { root: directory, directories }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return { root: resolve(cwd), directories }
}
