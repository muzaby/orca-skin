import { useMemo, type RefObject } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'
import { CascadeBody } from '../../../shared/ui/CascadeMenu'
import { MenuItem, MenuTitle } from '../../../shared/ui/MenuItem'
import { useNativeResources } from '../hooks/useNativeResources'
import { nativeResourcesMenu, nativeResourcesNotice } from '../lib/nativeResourcesMenu'

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
  const { view, busy, toggle, refresh } = useNativeResources(sessionId, true, backend)
  const items = useMemo(() => nativeResourcesMenu(view, busy, tr), [view, busy, tr])
  const label = backend === 'opencode' ? 'OpenCode' : 'Claude'
  const notice = nativeResourcesNotice(view)
  return (
    <div data-native-resources={backend ?? 'claude'}>
      <MenuTitle>{label}</MenuTitle>
      {notice && (
        <p role="status" className="px-2.5 py-1 text-caption text-ink3">
          {tr(notice)}
        </p>
      )}
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
      <MenuItem
        onClick={refresh}
        disabled={
          busy || view.status === 'loading' || (view.status === 'ready' && !!view.refreshing)
        }
      >
        {tr('chat.nativeResources.refresh')}
      </MenuItem>
    </div>
  )
}
