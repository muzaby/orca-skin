import type { NativeResource } from '../../../../../shared/native-resources'
import type { CascadeItem } from '../../../shared/ui/cascadeMenuState'
import type { NativeResourcesView } from '../hooks/useNativeResources'
import { nativeResourceKey } from './nativeResourceState'
import type { StatusTone } from '../../../shared/ui/Status'
import type { MessageKey } from '../../../shared/i18n'

export type NativeResourcesAction = { type: 'open' | 'toggle'; resource: NativeResource }

export function nativeResourcesNotice(view: NativeResourcesView): MessageKey | undefined {
  if (view.status !== 'ready') return
  if (view.issue === 'open') return 'chat.nativeResources.openError'
  if (view.issue === 'control') return 'chat.nativeResources.controlError'
  if (view.issue === 'refresh') return 'chat.nativeResources.error'
  if (view.refreshing) return 'chat.nativeResources.refreshing'
  if (view.value.partial) return 'chat.nativeResources.partial'
  if (view.stale) return 'chat.nativeResources.stale'
  return
}

export function nativeResourcesMenu(
  view: NativeResourcesView,
  pending: ReadonlySet<string>,
  tr: (key: MessageKey) => string
): CascadeItem<NativeResourcesAction>[] {
  const content = (kind: NativeResource['kind']): CascadeItem<NativeResourcesAction>[] => {
    if (view.status !== 'ready') return []
    const resources = view.value.items.filter((resource) => resource.kind === kind)
    return resources.map((resource) => ({
      kind: 'action' as const,
      id: nativeResourceKey(resource),
      label: resource.name,
      title:
        kind === 'plugin'
          ? [resource.description, tr('chat.nativeResources.openFolder')].filter(Boolean).join('\n')
          : tr(
              resource.canToggle
                ? resource.enabled
                  ? 'chat.nativeResources.disable'
                  : 'chat.nativeResources.enable'
                : 'chat.nativeResources.unsupported'
            ),
      disabled: kind === 'mcp' && !resource.canToggle,
      status: {
        tone: nativeResourceTone(resource.status),
        label: `${resource.name}: ${tr(`chat.nativeResources.${resource.status}`)}`,
        checked: resource.enabled,
        busy: pending.has(nativeResourceKey(resource)),
        ...(resource.canToggle ? { action: { type: 'toggle' as const, resource } } : {})
      },
      action: { type: kind === 'plugin' ? ('open' as const) : ('toggle' as const), resource }
    }))
  }
  return [
    {
      kind: 'submenu',
      id: 'native-mcp',
      label: 'MCP',
      icon: 'mcp',
      disabled: content('mcp').length === 0,
      items: content('mcp')
    },
    {
      kind: 'submenu',
      id: 'native-plugin',
      label: tr('chat.nativeResources.plugins'),
      icon: 'electricalServices',
      disabled: content('plugin').length === 0,
      items: content('plugin')
    }
  ]
}

export function nativeResourceTone(status: NativeResource['status']): StatusTone {
  if (status === 'connected' || status === 'enabled') return 'green'
  if (status === 'needs-auth' || status === 'pending') return 'amber'
  if (status === 'failed') return 'red'
  return 'slate'
}
