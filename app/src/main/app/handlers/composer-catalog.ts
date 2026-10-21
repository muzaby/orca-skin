import type { WebContents } from 'electron'
import {
  CHANNELS,
  ComposerCatalogRequestSchema,
  ComposerCatalogReleaseSchema
} from '../../../shared/protocol'
import type { ComposerCatalogLease, ComposerCatalogScope } from '../../../shared/composer-catalog'
import { handle } from '../../infra/ipc/handle'
import { ComposerCatalogOwners } from '../composer-catalog-owner'

export function registerComposerCatalogHandlers(
  prepare: (scope: ComposerCatalogScope, signal: AbortSignal) => Promise<ComposerCatalogLease>
): () => void {
  const owners = new ComposerCatalogOwners(prepare)
  const windows = new Map<WebContents, () => void>()
  const watch = (sender: WebContents): void => {
    if (windows.has(sender)) return
    const clear = (): void => owners.releaseSender(sender.id)
    const navigate = (_event: unknown, _url: string, inPlace: boolean, main: boolean): void => {
      if (main && !inPlace) clear()
    }
    const dispose = (): void => {
      clear()
      sender.removeListener('destroyed', dispose)
      sender.removeListener('render-process-gone', clear)
      sender.removeListener('did-start-navigation', navigate)
      windows.delete(sender)
    }
    windows.set(sender, dispose)
    sender.once('destroyed', dispose)
    sender.on('render-process-gone', clear)
    sender.on('did-start-navigation', navigate)
  }
  handle(
    CHANNELS.composerCatalog,
    ComposerCatalogRequestSchema,
    'reject',
    async (request, event) => {
      watch(event.sender)
      try {
        return await owners.read(event.sender.id, request, (value) => {
          if (!event.sender.isDestroyed())
            event.sender.send(CHANNELS.composerCatalogInvalidated, value)
        })
      } catch {
        // Native errors can contain configuration or credentials. UI owns the retry state.
        throw new Error('OpenCode 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
      }
    }
  )
  handle(
    CHANNELS.composerCatalogRelease,
    ComposerCatalogReleaseSchema,
    'reject',
    (request, event) => owners.release(event.sender.id, request.owner)
  )
  return () => {
    owners.close()
    for (const dispose of windows.values()) dispose()
  }
}
