import { useMemo, type RefObject } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'
import { CascadeBody } from '../../../shared/ui/CascadeMenu'
import { MenuTitle } from '../../../shared/ui/MenuItem'
import { useNativeResources } from '../hooks/useNativeResources'
import { nativeResourcesMenu } from '../lib/nativeResourcesMenu'

export function NativeResourcesMenu({
  sessionId,
  backend,
  anchorRef,
  onClose
}: {
  sessionId: string | null
  backend: Backend | null
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const { view, busy, toggle } = useNativeResources(sessionId, true)
  const items = useMemo(() => nativeResourcesMenu(view, busy, tr), [view, busy, tr])
  const label = backend === 'opencode' ? 'OpenCode' : 'Claude'
  return (
    <div data-native-resources={backend ?? 'claude'}>
      <MenuTitle>{label}</MenuTitle>
      <div className="px-2.5 pb-1 text-caption text-ink3" role="status">
        {tr(
          view.status === 'loading'
            ? 'chat.nativeResources.loading'
            : view.status === 'error'
              ? 'chat.nativeResources.error'
              : view.value.state === 'connected'
                ? 'chat.nativeResources.connected'
                : 'chat.nativeResources.disconnected'
        )}
      </div>
      <CascadeBody
        items={items}
        onSelect={(resource) => {
          void toggle(resource)
        }}
        onClose={onClose}
        anchorRef={anchorRef}
        ariaLabel={label}
        autoFocus={false}
        closeOnSelect={false}
      />
    </div>
  )
}
