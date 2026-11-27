import { promises as fs, watch, type FSWatcher } from 'node:fs'
import type { FileFolderChanged, ListFilesRequest } from '../../../shared/ipc'
import type { ClientRef } from '../../infra/ipc/transport'
import { folderPath, resolveFolder } from './scan'

const CHANGE_DELAY_MS = 40
const IDENTITY_CHECK_MS = 1_000
const RECOVERY_START_MS = 1_000
const RECOVERY_MAX_MS = 5_000

type Scope = Pick<ListFilesRequest, 'cwd' | 'relDir'>
interface Subscriber extends Scope {
  sender: ClientRef
}

interface WatchedFolder {
  key: string
  cwd: string
  path: string
  subscribers: Set<Subscriber>
  watcher?: FSWatcher
  opening?: Promise<void>
  identityTimer?: NodeJS.Timeout
  timer?: NodeJS.Timeout
  retryMs: number
  revision: number
  checkIdentity: boolean
}

async function readIdentity(cwd: string, path: string): Promise<string> {
  const resolved = await resolveFolder(cwd, path)
  const stat = await fs.stat(resolved, { bigint: true })
  if (!stat.isDirectory()) throw new Error('Folder is unavailable')
  return JSON.stringify([resolved, String(stat.dev), String(stat.ino)])
}

export function createFolderObservations(
  send: (sender: ClientRef, change: FileFolderChanged) => void,
  deps: { readIdentity: typeof readIdentity; watch: typeof watch; checkSilentMoves?: boolean } = {
    readIdentity,
    watch,
    checkSilentMoves: process.platform === 'win32'
  }
): (sender: ClientRef, request: ListFilesRequest) => Promise<void> {
  const folders = new Map<string, WatchedFolder>()
  const owners = new Map<
    ClientRef,
    Map<string, { folder: WatchedFolder; subscriber: Subscriber; off: () => void }>
  >()

  function schedule(folder: WatchedFolder, delay: number, action: () => void): void {
    if (folder.timer || !folder.subscribers.size) return
    folder.timer = setTimeout(() => {
      folder.timer = undefined
      if (folder.subscribers.size) action()
    }, delay)
    folder.timer.unref()
  }

  function notify(folder: WatchedFolder): void {
    const revision = ++folder.revision
    const sent = new Map<ClientRef, Set<string>>()
    for (const { sender, cwd, relDir } of folder.subscribers) {
      let scopes = sent.get(sender)
      if (!scopes) sent.set(sender, (scopes = new Set()))
      const key = JSON.stringify([cwd, relDir])
      if (scopes.has(key)) continue
      scopes.add(key)
      send(sender, { cwd, relDir, revision })
    }
  }

  function stopWatching(folder: WatchedFolder): void {
    clearTimeout(folder.identityTimer)
    folder.identityTimer = undefined
    const watcher = folder.watcher
    folder.watcher = undefined
    watcher?.close()
  }

  function recover(folder: WatchedFolder): void {
    stopWatching(folder)
    clearTimeout(folder.timer)
    folder.timer = undefined
    schedule(folder, folder.retryMs, () => {
      folder.retryMs = Math.min(2 * folder.retryMs, RECOVERY_MAX_MS)
      void open(folder).then(() => notify(folder))
    })
  }

  function open(folder: WatchedFolder): Promise<void> {
    if (folder.opening) return folder.opening
    if (folder.watcher || folder.timer || !folder.subscribers.size) return Promise.resolve()
    const opening = deps
      .readIdentity(folder.cwd, folder.path)
      .then((identity) => {
        if (!folder.subscribers.size) return
        const watcher = deps.watch(folder.path, { persistent: false }, (event) => {
          if (folder.watcher !== watcher) return
          folder.checkIdentity ||= event === 'rename'
          schedule(folder, CHANGE_DELAY_MS, () => {
            if (folder.checkIdentity) {
              folder.checkIdentity = false
              void verifyIdentity().then(() => {
                if (folder.watcher === watcher) notify(folder)
              })
            } else notify(folder)
          })
        })
        folder.watcher = watcher
        folder.retryMs = RECOVERY_START_MS
        const lost = (): void => {
          if (folder.watcher !== watcher) return
          recover(folder)
          notify(folder)
        }
        async function verifyIdentity(): Promise<void> {
          const current = await deps.readIdentity(folder.cwd, folder.path).catch(() => null)
          if (current !== identity) lost()
        }

        // Windows can keep watching the moved directory without reporting its rename.
        // Check only the subscribed path's identity. An unchanged path sends no IPC.
        function scheduleIdentityCheck(): void {
          folder.identityTimer = setTimeout(async () => {
            await verifyIdentity()
            if (folder.watcher === watcher) scheduleIdentityCheck()
          }, IDENTITY_CHECK_MS)
          folder.identityTimer.unref()
        }
        if (deps.checkSilentMoves) scheduleIdentityCheck()
        watcher.on('error', lost)
        watcher.on('close', lost)
      })
      .catch(() => recover(folder))
      .finally(() => {
        folder.opening = undefined
      })
    folder.opening = opening
    return opening
  }

  function release(sender: ClientRef, owner: string): void {
    const senderOwners = owners.get(sender)
    const entry = senderOwners?.get(owner)
    if (!entry) return
    senderOwners?.delete(owner)
    if (!senderOwners?.size) owners.delete(sender)
    entry.off()
    const { folder, subscriber } = entry
    folder.subscribers.delete(subscriber)
    if (folder.subscribers.size) return
    folders.delete(folder.key)
    clearTimeout(folder.timer)
    stopWatching(folder)
  }

  return async (sender, { cwd, relDir, observation }) => {
    if (!observation || sender.isClosed()) return
    const { owner, active } = observation
    const path = active ? folderPath(cwd, relDir) : null
    const previous = owners.get(sender)?.get(owner)
    if (
      previous &&
      path === previous.folder.path &&
      cwd === previous.subscriber.cwd &&
      relDir === previous.subscriber.relDir
    ) {
      await open(previous.folder)
      return
    }
    release(sender, owner)
    if (!path) return
    const key = JSON.stringify([cwd, path])
    let folder = folders.get(key)
    if (!folder) {
      folder = {
        key,
        cwd,
        path,
        subscribers: new Set(),
        retryMs: RECOVERY_START_MS,
        revision: 0,
        checkIdentity: false
      }
      folders.set(key, folder)
    }
    const subscriber = { sender, cwd, relDir }
    folder.subscribers.add(subscriber)
    let senderOwners = owners.get(sender)
    if (!senderOwners) owners.set(sender, (senderOwners = new Map()))
    const entry = { folder, subscriber, off: (): void => {} }
    senderOwners.set(owner, entry)
    entry.off = sender.onClosed(() => release(sender, owner))
    await open(folder)
  }
}
