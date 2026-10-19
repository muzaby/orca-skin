import { readFile } from 'node:fs/promises'
import { isRecord } from '../../../shared/obj'

/** Optional display metadata must not make the resource list unavailable. */
export async function pluginDescription(manifest: string): Promise<string | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(manifest, 'utf8'))
    if (isRecord(value) && typeof value.description === 'string')
      return value.description.trim().slice(0, 4000) || undefined
  } catch {
    // A missing/unreadable manifest has no description; never expose the filesystem error.
  }
  return undefined
}
