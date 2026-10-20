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
  cwd = null,
  projectId = null,
  anchorRef,
  onClose
}: {
  sessionId: string | null
  backend: Backend | null
  cwd?: string | null
  projectId?: string | null
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const { view, busy, toggle, openPlugin } = useNativeResources(
    sessionId,
    true,
    backend,
    sessionId ? undefined : { backend: backend ?? 'claude', cwd, projectId }
  )
  const items = useMemo(() => nativeResourcesMenu(view, busy, tr), [view, busy, tr])
  const label = backend === 'opencode' ? 'OpenCode' : 'Claude'
  return (
    <div data-native-resources={backend ?? 'claude'}>
      <MenuTitle>{label}</MenuTitle>
      <CascadeBody
        items={items}
        onSelect={({ type, resource }) => {
          if (type === 'open') void openPlugin(resource)
          else void toggle(resource)
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
