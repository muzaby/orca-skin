import { lstat, realpath } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

// A Windows 8.3 alias can have another spelling without redirecting the file.
// Registered attachments may use either spelling, but no ancestor may be a junction.
export async function unredirectedFile(path: string): Promise<string> {
  const original = resolve(path)
  const before = await lstat(original)
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('unsafe-path')
  let parent = dirname(original)
  for (;;) {
    const info = await lstat(parent)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('unsafe-path')
    const next = dirname(parent)
    if (next === parent) break
    parent = next
  }
  const actual = await realpath(original)
  const after = await lstat(original)
  if (after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino)
    throw new Error('unsafe-path')
  return actual
}
