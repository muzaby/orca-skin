import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../../shared/ipc'
import { formatDateMedium, useI18n } from '../../../../shared/i18n'
import { CatalogListRow } from '../../../../shared/ui/CatalogListRow'
import { Icon } from '../../../../shared/ui/Icon'
import type { CatalogTab } from '../../lib/catalogSelection'
import { mcpRowMeta, skillRowMeta } from '../../lib/catalogRows'
import { providerRowMeta } from '../../lib/providerRows'
import { orderMcpServers, orderProviders, orderSkills } from '../../lib/catalogOrder'
import { providerPresentation } from '../../lib/providerPresentation'
import { Fragment } from 'react'
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
  const visibleSkills = skills.filter(
    (skill) =>
      !isNativePluginSkillSource(skill.sourceId) &&
      (skillSourceAllowed(skill.sourceId, 'claude') ||
        skillSourceAllowed(skill.sourceId, 'opencode'))
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

  const nativeList =
    tab !== 'skills' &&
    nativeRows.map(({ backend, resource }, index) => (
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
      {tab === 'skills' &&
        orderSkills(visibleSkills).map((skill, index, ordered) => {
          const meta = skillRowMeta(skill)
          const id = `${skill.sourceId}/${skill.name}`
          return (
            <Fragment key={id}>
              {ordered[index - 1]?.sourceId !== skill.sourceId && (
                <SourceHeading
                  spaced={index > 0}
                  source={skill.sourceId}
                  label={extensionSourceLabels[skill.sourceId]}
                />
              )}
              <CatalogListRow
                key={id}
                data-extensions-row={id}
                selected={selectedId === id}
                openProps={{ onClick: (event) => onSelect(id, event.currentTarget) }}
                icon={<Icon name="doc" size={20} className="shrink-0 text-ink3" />}
                title={
                  <span className="truncate" title={skill.name}>
                    {skill.name}
                  </span>
                }
                trailing={
                  <span className="hidden shrink-0 text-caption text-ink3 @[560px]/catalog:block">
                    {meta.updatedAtMs === null
                      ? tr('common.unknown')
                      : formatDateMedium(meta.updatedAtMs, locale)}
                  </span>
                }
                actions={
                  skill.canToggle ? (
                    <CatalogToggle
                      name={skill.name}
                      enabled={skill.enabled}
                      canToggle={skill.canToggle}
                      onToggle={() => onSkillToggle?.(skill)}
                    />
                  ) : undefined
                }
              />
            </Fragment>
          )
        })}
      {tab === 'mcp' && mcpServers.length > 0 && (
        <SourceHeading source="orca" label={extensionSourceLabels.orca} />
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
        <SourceHeading source="orca" label={extensionSourceLabels.orca} />
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
