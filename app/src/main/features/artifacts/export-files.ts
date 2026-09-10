import { randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import { lstat, open, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { isWithinDir } from '../../infra/config/paths'

export async function assertExportDestination(path: string, root: string): Promise<void> {
  const parent = await realpath(dirname(path))
  let target = join(parent, basename(path))
  try {
    target = await realpath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  // 개발 DB도 production 보관 파일을 내보내기 대상으로 덮어쓰지 못한다.
  const storageRoot = basename(root) === '.dev' ? dirname(root) : root
  if (isWithinDir(target, await realpath(storageRoot))) throw new Error('unsafe-destination')
}

export async function saveWithoutOverwrite(
  directory: string,
  filename: string,
  bytes: Buffer
): Promise<void> {
  const extension = extname(filename)
  const stem = basename(filename, extension)
  for (let suffix = 0; suffix < 10_000; suffix++) {
    const name = suffix === 0 ? filename : `${stem} (${suffix})${extension}`
    try {
      await writeFile(join(directory, name), bytes, { flag: 'wx' })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('name-conflict')
}

export async function replaceExport(path: string, root: string, bytes: Buffer): Promise<void> {
  // Replace the directory entry rather than truncating a possibly shared hardlink inode.
  const parent = await realpath(dirname(path))
  const destination = join(parent, basename(path))
  const pending = join(parent, `.orca-artifact-${randomUUID()}.tmp`)
  await assertExportDestination(destination, root)
  await assertExportDestination(pending, root)
  let owned: Stats | undefined
  let renamed = false
  try {
    const file = await open(pending, 'wx')
    try {
      await file.writeFile(bytes)
      await file.sync()
    } finally {
      try {
        owned = await file.stat()
      } finally {
        await file.close()
      }
    }
    await assertExportDestination(destination, root)
    const current = await lstat(pending)
    if (
      !owned ||
      current.dev !== owned.dev ||
      current.ino !== owned.ino ||
      current.size !== owned.size ||
      current.mtimeMs !== owned.mtimeMs
    )
      throw new Error('unsafe-destination')
    await rename(pending, destination)
    renamed = true
  } finally {
    if (!renamed && owned) {
      try {
        const current = await lstat(pending)
        if (
          current.dev === owned.dev &&
          current.ino === owned.ino &&
          current.size === owned.size &&
          current.mtimeMs === owned.mtimeMs
        )
          await unlink(pending)
      } catch {
        /* only this request's unchanged temporary file may be cleaned up */
      }
    }
  }
}
