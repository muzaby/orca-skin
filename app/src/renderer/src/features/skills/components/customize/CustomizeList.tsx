import { catalogResourceKey } from '../../../../../../shared/native-resources'
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
import { ExtensionChoice, type CatalogEntry } from './ExtensionChoice'

export function CustomizeList({
  tab,
  owner,
  skills,
  mcpServers,
  providers,
  selectedId,
  nativeMcp = [],
  nativeLocked,
  failedWrites,
  onNativeToggle,
  onSkillToggle,

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
  failedWrites?: ReadonlyMap<string, boolean>
  onNativeToggle?: (
    backend: Backend,
    resource: NativeResource,
    desired?: boolean
  ) => void | Promise<void>
  onSkillToggle?: (skill: SkillInfo) => void | Promise<void>
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
        !resource.managedSource &&
        tab !== 'skills' &&
        resource.kind === (tab === 'providers' ? 'plugin' : 'mcp')
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

  const choice = (entry: CatalogEntry): React.JSX.Element => (
    <ExtensionChoice
      key={`${entry.backend}:${entry.resource.kind}:${entry.resource.id}`}
      entry={entry}
      locked={nativeLocked?.has(entry.backend)}
      failedTarget={failedWrites?.get(catalogResourceKey(entry.backend, entry.resource))}
      onToggle={onNativeToggle}
    />
  )
  const managed = (kind: 'builtin' | 'user', id: string): React.JSX.Element[] =>
    nativeMcp
      .filter(
        ({ resource }) =>
          resource.managedSource?.kind === kind && resource.managedSource.sourceId === id
      )
      .map(choice)
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
          onClick: (event) =>
            onSelect(`native:${backend}:${resource.kind}:${resource.id}`, event.currentTarget)
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
        actions={choice({ backend, resource })}
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
              actions={managed('user', server.id)}
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
              actions={managed('builtin', provider.id)}
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
