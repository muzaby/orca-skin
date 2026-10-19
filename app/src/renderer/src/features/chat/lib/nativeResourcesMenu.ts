import type { NativeResource } from '../../../../../shared/native-resources'
import type { CascadeItem } from '../../../shared/ui/cascadeMenuState'
import type { NativeResourcesView } from '../hooks/useNativeResources'
import type { MessageKey } from '../../../shared/i18n'

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
  busy: boolean,
  tr: (key: MessageKey) => string
): CascadeItem<NativeResource>[] {
  const content = (kind: NativeResource['kind']): CascadeItem<NativeResource>[] => {
    if (view.status !== 'ready')
      return [
        {
          kind: 'empty',
          id: view.status,
          label: tr(
            view.status === 'error' ? 'chat.nativeResources.error' : 'chat.nativeResources.loading'
          )
        }
      ]
    const resources = view.value.items.filter((resource) => resource.kind === kind)
    if (resources.length === 0) {
      if (view.value.state !== 'connected')
        return [
          { kind: 'empty', id: 'disconnected', label: tr('chat.nativeResources.disconnected') }
        ]
      return [{ kind: 'empty', id: 'empty', label: tr('chat.nativeResources.empty') }]
    }
    return resources.map((resource) =>
      kind === 'plugin'
        ? {
            kind: 'action',
            id: `${kind}:${resource.id}`,
            label: resource.name,
            description: tr(`chat.nativeResources.${resource.status}`),
            title: [resource.description, tr('chat.nativeResources.openFolder')]
              .filter(Boolean)
              .join('\n'),
            action: resource
          }
        : {
            kind: 'action',
            id: `${kind}:${resource.id}`,
            label: resource.name,
            description: tr(`chat.nativeResources.${resource.status}`),
            title: !resource.canToggle
              ? tr('chat.nativeResources.unsupported')
              : tr(
                  resource.enabled ? 'chat.nativeResources.disable' : 'chat.nativeResources.enable'
                ),
            checked: resource.enabled,
            disabled: busy || !!view.refreshing || !resource.canToggle,
            action: resource
          }
    )
  }
  return [
    {
      kind: 'submenu',
      id: 'native-mcp',
      label: 'MCP',
      icon: 'electricalServices',
      items: content('mcp')
    },
    {
      kind: 'submenu',
      id: 'native-plugin',
      label: tr('chat.nativeResources.plugins'),
      icon: 'electricalServices',
      items: content('plugin')
    }
  ]
}
