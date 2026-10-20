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
  skillSourceAllowed
} from '../../../../../../shared/extension-sources'
import { SourceHeading } from './SourceHeading'
import type { NativeResource } from '../../../../../../shared/native-resources'
import type { Backend } from '../../../../../../shared/ipc'

export function CustomizeList({
  tab,
  skills,
  mcpServers,
  providers,
  selectedId,
  nativeMcp = [],
  onNativeMcp,
  onSelect
}: {
  tab: CatalogTab
  skills: SkillInfo[]
  mcpServers: McpServer[]
  providers: ProviderInfo[]
  selectedId?: string | null
  nativeMcp?: { backend: Backend; resource: NativeResource }[]
  onNativeMcp?: (backend: Backend, resource: NativeResource) => void
  onSelect: (id: string, origin: HTMLButtonElement) => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  const visibleSkills = skills.filter(
    (skill) =>
      skillSourceAllowed(skill.sourceId, 'claude') || skillSourceAllowed(skill.sourceId, 'opencode')
  )
  const rows = tab === 'skills' ? visibleSkills : tab === 'mcp' ? mcpServers : providers
  const emptyKey =
    tab === 'skills'
      ? 'skills.table.noSkills'
      : tab === 'mcp'
        ? 'skills.table.noMcp'
        : 'skills.table.noProviders'

  if (rows.length === 0 && !(tab === 'mcp' && nativeMcp.length))
    return (
      <div role="status" className="grid h-48 place-items-center text-footnote text-ink3">
        {tr(emptyKey)}
      </div>
    )

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
                  <span
                    className={`truncate ${skill.enabled ? '' : 'text-ink3'}`}
                    title={skill.name}
                  >
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
              />
            </Fragment>
          )
        })}
      {tab === 'mcp' &&
        nativeMcp.map(({ backend, resource }, index) => (
          <Fragment key={`${backend}:${resource.id}`}>
            {nativeMcp[index - 1]?.backend !== backend && (
              <SourceHeading
                spaced={index > 0}
                source={backend}
                label={`${backend === 'claude' ? 'Claude' : 'OpenCode'} MCP`}
              />
            )}
            <CatalogListRow
              data-extensions-row={`${backend}:${resource.id}`}
              openProps={{ onClick: () => onNativeMcp?.(backend, resource) }}
              icon={<Icon name="mcp" size={20} className="text-ink3" />}
              title={resource.name}
            />
          </Fragment>
        ))}
      {tab === 'mcp' && mcpServers.length > 0 && (
        <SourceHeading spaced={nativeMcp.length > 0} source="orca" label="Orcinus orca MCP" />
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
              icon={
                <Icon
                  name={server.transport === 'http' ? 'link' : 'cpu'}
                  size={20}
                  className="shrink-0 text-ink3"
                />
              }
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
            />
          )
        })}
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
    </ul>
  )
}
