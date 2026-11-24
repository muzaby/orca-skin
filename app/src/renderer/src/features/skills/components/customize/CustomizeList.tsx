import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import { CatalogListRow } from '../../../../shared/ui/CatalogListRow'
import { Icon } from '../../../../shared/ui/Icon'
import type { CatalogTab } from '../../lib/catalogSelection'
import { mcpRowMeta } from '../../lib/catalogRows'
import { providerRowMeta } from '../../lib/providerRows'
import { orderMcpServers, orderProviders } from '../../lib/catalogOrder'
import { providerPresentation } from '../../lib/providerPresentation'
import { Fragment, useMemo, type RefObject } from 'react'
import { SkillCatalogList } from './SkillCatalogList'
import {
  extensionSourceLabels,
  harnessSourceTitle,
  isNativePluginSkillSource,
  skillSourceAllowed
} from '../../../../../../shared/extension-sources'
import { SourceHeading } from './SourceHeading'
import type { NativeResource } from '../../../../../../shared/native-resources'
import type { Backend } from '../../../../../../shared/ipc'
import { CatalogToggle } from './CatalogToggle'

export function CustomizeList({
  tab,
  owner,
  skills,
  mcpServers,
  providers,
  selectedId,
  nativeMcp = [],
  nativeLocked,
  onNativeMcp,
  onNativeToggle,
  onSkillToggle,
  onMcpToggle,
  suppressEmpty = false,
  onSelect
}: {
  tab: CatalogTab
  owner?: RefObject<HTMLDivElement | null>
  skills: SkillInfo[]
  mcpServers: McpServer[]
  providers: ProviderInfo[]
  selectedId?: string | null
  nativeMcp?: { backend: Backend; resource: NativeResource }[]
  /** Harnesses whose native toggle is in flight. */
  nativeLocked?: ReadonlySet<Backend>
  onNativeMcp?: (backend: Backend, resource: NativeResource) => void
  onNativeToggle?: (backend: Backend, resource: NativeResource) => void | Promise<void>
  onSkillToggle?: (skill: SkillInfo) => void | Promise<void>
  onMcpToggle?: (server: McpServer) => void | Promise<void>
  suppressEmpty?: boolean
  onSelect: (id: string, origin: HTMLButtonElement) => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  const visibleSkills = useMemo(
    () =>
      skills.filter(
        (skill) =>
          !isNativePluginSkillSource(skill.sourceId) &&
          (skillSourceAllowed(skill.sourceId, 'claude') ||
            skillSourceAllowed(skill.sourceId, 'opencode'))
      ),
    [skills]
  )
  const rows = tab === 'skills' ? visibleSkills : tab === 'mcp' ? mcpServers : providers
  const nativeRows = nativeMcp
    .filter(
      ({ resource }) =>
        tab !== 'skills' && resource.kind === (tab === 'providers' ? 'plugin' : 'mcp')
    )
    .sort((a, b) => Number(a.backend === 'opencode') - Number(b.backend === 'opencode'))
  const emptyKey =
    tab === 'skills'
      ? 'skills.table.noSkills'
      : tab === 'mcp'
        ? 'skills.table.noMcp'
        : 'skills.table.noProviders'

  if (rows.length === 0 && !nativeRows.length)
    return suppressEmpty ? (
      <></>
    ) : (
      <div role="status" className="grid h-48 place-items-center text-footnote text-ink3">
        {tr(emptyKey)}
      </div>
    )

  if (tab === 'skills')
    return (
      <SkillCatalogList
        owner={owner}
        skills={visibleSkills}
        selectedId={selectedId}
        onSelect={onSelect}
        onSkillToggle={onSkillToggle}
      />
    )

  const nativeList = nativeRows.map(({ backend, resource }, index) => (
    <Fragment key={`${backend}:${resource.id}`}>
      {nativeRows[index - 1]?.backend !== backend && (
        <SourceHeading
          spaced={index > 0 || rows.length > 0}
          source={backend}
          label={harnessSourceTitle(backend)}
        />
      )}
      <CatalogListRow
        data-extensions-row={`${backend}:${resource.id}`}
        openProps={{
          disabled: resource.canOpen === false,
          onClick: () => onNativeMcp?.(backend, resource)
        }}
        icon={
          <Icon name={resource.kind === 'mcp' ? 'mcp' : 'doc'} size={20} className="text-ink3" />
        }
        title={
          <span
            className={`truncate ${resource.canToggle ? '' : 'text-ink3'}`}
            title={resource.name}
          >
            {resource.name}
          </span>
        }
        trailing={
          <span className="text-caption text-ink3">
            {tr(`chat.nativeResources.${resource.status}`)}
          </span>
        }
        actions={
          <CatalogToggle
            name={resource.name}
            enabled={resource.enabled}
            canToggle={resource.canToggle}
            locked={nativeLocked?.has(backend) ?? false}
            onToggle={() => onNativeToggle?.(backend, resource)}
          />
        }
      />
    </Fragment>
  ))

  return (
    <ul className="@container/catalog m-0 list-none divide-y divide-border p-0">
      {tab === 'mcp' && mcpServers.length > 0 && (
        <SourceHeading source="orcinus-orca" label={extensionSourceLabels['orcinus-orca']} />
      )}
      {tab === 'mcp' &&
        orderMcpServers(mcpServers).map((server) => {
          const meta = mcpRowMeta(server)
          return (
            <CatalogListRow
              key={server.id}
              data-extensions-row={server.id}
              selected={selectedId === server.id}
              openProps={{ onClick: (event) => onSelect(server.id, event.currentTarget) }}
              icon={<Icon name="mcp" size={20} className="shrink-0 text-ink3" />}
              title={
                <span className="truncate" title={server.name}>
                  {server.name}
                </span>
              }
              detail={
                <span className="truncate text-caption uppercase text-ink3">{meta.transport}</span>
              }
              trailing={
                <span className="shrink-0 text-caption text-ink3">{tr(meta.statusKey)}</span>
              }
              actions={
                <CatalogToggle
                  name={server.name}
                  enabled={server.enabled}
                  canToggle
                  onToggle={() => onMcpToggle?.(server)}
                />
              }
            />
          )
        })}
      {tab === 'mcp' && nativeList}
      {tab === 'providers' && providers.length > 0 && (
        <SourceHeading source="orcinus-orca" label={extensionSourceLabels['orcinus-orca']} />
      )}
      {tab === 'providers' &&
        orderProviders(providers).map((provider) => {
          const meta = providerRowMeta(provider)
          const presentation = providerPresentation(provider, locale)
          const detail = meta.showsAuthMethod
            ? `${tr(meta.kindKey)} · ${meta.activeLabel ?? tr('common.unknown')}`
            : tr(meta.kindKey)
          return (
            <CatalogListRow
              key={provider.id}
              data-extensions-row={provider.id}
              selected={selectedId === provider.id}
              openProps={{ onClick: (event) => onSelect(provider.id, event.currentTarget) }}
              icon={<Icon name={presentation.icon} size={20} className="shrink-0 text-ink3" />}
              title={
                <span className="truncate" title={presentation.title}>
                  {presentation.title}
                </span>
              }
              detail={
                <span className="truncate text-caption text-ink3" title={detail}>
                  {detail}
                </span>
              }
              trailing={
                <span className="shrink-0 text-caption text-ink3">{tr(meta.statusKey)}</span>
              }
            />
          )
        })}
      {tab === 'providers' && nativeList}
    </ul>
  )
}
