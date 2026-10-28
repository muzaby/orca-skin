import type { RouterContext } from './context'
import { resolveComposerPreparation } from './composer-catalog'
import { ComposerPreparationService } from './composer-preparation-service'
import { preparedMcpScope, PreparedMcpResources } from './prepared-mcp-resources'
import { registerComposerCatalogHandlers } from './handlers/composer-catalog'

/** Production assembly is shared by bootstrap and handler integration tests. */
export function createComposerPreparation(ctx: RouterContext): {
  service: ComposerPreparationService
  resources: PreparedMcpResources
  close: (() => void) & { invalidate(): void }
} {
  const service = new ComposerPreparationService((scope, signal) =>
    resolveComposerPreparation(ctx, scope, signal)
  )
  const prepare = service.acquire.bind(service)
  const catalog = registerComposerCatalogHandlers(prepare, service.owners('catalog'))
  const resources = new PreparedMcpResources(
    { prepare, scope: (request) => preparedMcpScope(ctx.db, request) },
    service.owners('resources')
  )
  return {
    service,
    resources,
    close: Object.assign(
      () => {
        catalog()
        resources.close()
        service.close()
      },
      { invalidate: () => service.invalidate() }
    )
  }
}
