import type { ClientRef } from '../../contracts/client'
import {
  CHANNELS,
  ComposerCatalogReleaseSchema,
  ComposerCatalogRequestSchema
} from '../../../shared/protocol'
import { handle } from '../../infra/ipc/handle'
import { getLogger } from '../../infra/log'
import { ComposerCatalogError } from '../composer-catalog-error'
import { ComposerCatalogCancelled, ComposerCatalogOwners } from '../composer-catalog-owner'

export type ComposerCatalogRegistration = (() => void) & { invalidate(): void }

export function registerComposerCatalogHandlers(
  owners: ComposerCatalogOwners
): ComposerCatalogRegistration {
  // 창이 닫히거나 문서가 새로 읽히면 그 창의 구독을 놓는다. 새 문서는 새 참조로 다시 등록된다.
  const windows = new Map<ClientRef, () => void>()
  const watch = (sender: ClientRef): void => {
    if (windows.has(sender)) return
    let unwatch = (): void => {}
    const dispose = (): void => {
      if (!windows.delete(sender)) return
      unwatch()
      owners.releaseSender(sender.id)
    }
    windows.set(sender, dispose)
    unwatch = sender.onClosed(dispose)
  }
  handle(
    CHANNELS.composerCatalog,
    ComposerCatalogRequestSchema,
    'reject',
    async (request, event) => {
      watch(event.sender)
      try {
        return await owners.read(event.sender.id, request, (value) => {
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
  return Object.assign(close, { invalidate: () => owners.invalidate() })
}
