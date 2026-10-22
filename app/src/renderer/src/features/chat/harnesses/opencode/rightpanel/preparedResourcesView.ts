import type { NativeResourcesView } from '../../../hooks/useNativeResources'
import type { ComposerCatalogSnapshot } from '../composer/composerCatalogState'

export function preparedResourcesView(
  catalog: ComposerCatalogSnapshot,
  configured: NativeResourcesView
): NativeResourcesView {
  const slots = [catalog.mcp, catalog.plugins]
  if (!slots.some((slot) => slot?.value !== undefined)) return configured
  const fallback = configured.status === 'ready' ? configured.value.items : []
  const items = (['mcp', 'plugins'] as const).flatMap((part) => {
    const kind = part === 'mcp' ? 'mcp' : 'plugin'
    const slot = catalog[part]
    return (slot?.value ?? fallback.filter((item) => item.kind === kind)).map((item) => ({
      ...item,
      canToggle: false,
      // A dynamic server need not have a file; the draft plugin opener is unavailable.
      canOpen:
        kind === 'mcp' && fallback.some((value) => value.kind === kind && value.id === item.id)
    }))
  })
  return {
    status: 'ready',
    value: {
      state: 'connected',
      items,
      ...(slots.some((slot) => slot?.status !== 'ready') ? { partial: true } : {})
    }
  }
}
