import type { WebContents } from 'electron'
import {
  CHANNELS,
  ComposerCatalogRequestSchema,
  ComposerCatalogReleaseSchema
} from '../../../shared/protocol'
import type { ComposerCatalogLease, ComposerCatalogScope } from '../../../shared/composer-catalog'
import { handle } from '../../infra/ipc/handle'
import { ComposerCatalogOwners, ComposerCatalogCancelled } from '../composer-catalog-owner'
import { ComposerCatalogError } from '../composer-catalog-error'
import { getLogger } from '../../infra/log'

export type ComposerCatalogRegistration = (() => void) & { revalidate(revision: number): void }

export function registerComposerCatalogHandlers(
  prepare: (scope: ComposerCatalogScope, signal: AbortSignal) => Promise<ComposerCatalogLease>
): ComposerCatalogRegistration {
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
      } catch (error) {
        if (error instanceof ComposerCatalogCancelled)
          return { part: request.part, status: 'cancelled' as const }
        const failure = (
          error instanceof ComposerCatalogError ? error : new ComposerCatalogError('owner', error)
        ).failure
        getLogger()
          .child('composer')
          .warn('opencode.catalog.failed', { part: request.part, ...failure })
        return { part: request.part, status: 'error' as const, failure }
      }
    }
  )
  handle(
    CHANNELS.composerCatalogRelease,
    ComposerCatalogReleaseSchema,
    'reject',
    (request, event) => owners.release(event.sender.id, request.owner)
  )
  const close = (): void => {
    owners.close()
    for (const dispose of windows.values()) dispose()
  }
  return Object.assign(close, { revalidate: (revision: number) => owners.revalidate(revision) })
}
