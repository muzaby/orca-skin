import { useMemo, useRef } from 'react'
import { basenameForDisplay } from '../../../../../../shared/path-basename'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { CascadeBody } from '../../../../shared/ui/CascadeMenu'
import { Icon } from '../../../../shared/ui/Icon'
import { ClaudeLogo } from '../../../../shared/ui/ClaudeLogo'
import { OpenCodeLogo } from '../../../../shared/ui/OpenCodeLogo'
import type { CascadeItem } from '../../../../shared/ui/cascadeMenuState'
import { useNativeResources } from '../../hooks/useNativeResources'
import { nativeResourcesMenu, type NativeResourcesAction } from '../../lib/nativeResourcesMenu'
import { rightPanelTileLabel, type RightPanelHeaderProps } from '../../lib/rightPanelTiles'
import { chatActions, useChatSession } from '../../store/chatStore'

export function NativeResourcesTileHeader({
  projectName,
  projectPath
}: RightPanelHeaderProps): React.JSX.Element {
  const { tr } = useI18n()
  const backend = useChatSession((state) => state.backend)
  const cwd = useChatSession((state) => state.cwd)
  const Logo = backend === 'opencode' ? OpenCodeLogo : ClaudeLogo
  const project = projectName?.trim() || basenameForDisplay(cwd, '')
  const label = [rightPanelTileLabel('nativeStatus', backend, tr), project]
    .filter(Boolean)
    .join(' · ')
  return (
    <div
      data-native-status-title
      className="flex min-w-0 flex-1 items-center gap-2"
      title={projectPath?.trim() || cwd || undefined}
    >
      <Logo
        className={`size-3.5 shrink-0 ${backend === 'opencode' ? 'text-oc-ink' : 'text-spinner'}`}
      />
      <span className="min-w-0 truncate text-footnote font-normal text-ink2">{label}</span>
    </div>
  )
}

export function NativeResourcesTileContent(): React.JSX.Element {
  const sessionId = useChatSession((state) => state.sessionId)
  const backend = useChatSession((state) => state.backend)
  const cwd = useChatSession((state) => state.cwd)
  const projectId = useChatSession((state) => state.pendingProjectId ?? state.projectId)
  const resources = useNativeResources(
    sessionId,
    true,
    backend,
    sessionId ? undefined : { backend: backend ?? 'claude', cwd, projectId }
  )
  return <NativeResourcesTileView resources={resources} />
}

export function NativeResourcesTileView({
  resources,
  refreshable = false
}: {
  resources: ReturnType<typeof useNativeResources>
  refreshable?: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const backend = useChatSession((state) => state.backend)
  const anchorRef = useRef<HTMLDivElement>(null)
  const { view, pending, toggle, openPlugin, refresh } = resources
  const items = useMemo(
    () =>
      nativeResourcesMenu(view, pending, tr).flatMap(
        (group): CascadeItem<NativeResourcesAction>[] =>
          group.kind === 'submenu'
            ? [
                {
                  kind: 'heading',
                  id: group.id,
                  label: group.label,
                  leading: group.icon ? <Icon name={group.icon} size={13} /> : undefined
                },
                ...group.items
              ]
            : []
      ),
    [view, pending, tr]
  )
  return (
    <div
      ref={anchorRef}
      data-native-status={backend ?? 'claude'}
      className="min-h-0 flex-1 overflow-y-auto p-2 [&_[data-menu-heading]:not(:first-child)]:mt-5"
    >
      {refreshable && (
        <div className="flex justify-end">
          <Button size="small" iconOnly aria-label={tr('harness.catalogRefresh')} onClick={refresh}>
            <Icon name="refresh" size={13} />
          </Button>
        </div>
      )}
      {view.status === 'loading' && (
        <span
          role="status"
          aria-label={tr('chat.nativeResources.loading')}
          className="inline-flex p-2 text-ink3"
        >
          <Icon name="refresh" size={14} className="animate-spin motion-reduce:animate-none" />
        </span>
      )}
      {view.status === 'error' && !refreshable && (
        <Button size="small" leadingIcon="refresh" onClick={refresh}>
          {tr('chat.nativeResources.retry')}
        </Button>
      )}
      <CascadeBody
        items={items}
        onSelect={({ type, resource }) =>
          type === 'open' ? openPlugin(resource) : toggle(resource)
        }
        onClose={() => chatActions.removeRightPanelTile('nativeStatus')}
        anchorRef={anchorRef}
        ariaLabel={rightPanelTileLabel('nativeStatus', backend, tr)}
        autoFocus={false}
        closeOnSelect={false}
      />
    </div>
  )
}
