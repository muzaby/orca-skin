import type { KeyboardEvent, ReactNode } from 'react'
import type { McpServer, SkillInfo } from '../../../../../../shared/ipc'
import { formatDateMedium, useI18n } from '../../../../shared/i18n'
import type { CatalogTab } from '../../lib/catalogSelection'
import { mcpRowMeta, skillRowMeta } from '../../lib/catalogRows'
import type { PluginRow } from '../../lib/pluginCatalog'

function activate(event: KeyboardEvent<HTMLTableRowElement>, action: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    action()
  }
}

function GroupTable({
  title,
  columns,
  children
}: {
  title: string
  columns: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={`catalog-group-${title}`}>
      <h2
        id={`catalog-group-${title}`}
        className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink3 first:mt-0"
      >
        {title}
      </h2>
      <div className="overflow-hidden rounded-r4 border border-border">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead className="border-b border-border bg-bg2 text-[11px] uppercase tracking-wide text-ink3">
            <tr>{columns}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

const rowClass =
  'cursor-pointer border-b border-border last:border-b-0 hover:bg-fill-uncontained-hover'

export function CustomizeList({
  tab,
  skills,
  mcpServers,
  plugins,
  onSelect
}: {
  tab: CatalogTab
  skills: SkillInfo[]
  mcpServers: McpServer[]
  plugins: PluginRow[]
  onSelect: (id: string) => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  const rows = tab === 'skills' ? skills : tab === 'mcp' ? mcpServers : plugins
  const emptyKey =
    tab === 'skills'
      ? 'skills.table.noSkills'
      : tab === 'mcp'
        ? 'skills.table.noMcp'
        : 'skills.table.noPlugins'
  const skillGroups = [
    ...new Map(skills.map((skill) => [skill.sourceId, skill.sourceLabel])).entries()
  ]
    .map(([id, title]) => ({ id, title, rows: skills.filter((skill) => skill.sourceId === id) }))
    .sort((a, b) => a.title.localeCompare(b.title))
  const mcpGroups = [
    {
      id: 'active',
      title: tr('skills.groups.activeMcp'),
      rows: mcpServers.filter((server) => server.enabled)
    },
    {
      id: 'inactive',
      title: tr('skills.groups.inactiveMcp'),
      rows: mcpServers.filter((server) => !server.enabled)
    }
  ].filter((group) => group.rows.length > 0)
  const pluginGroups = [
    {
      id: 'connected',
      title: tr('skills.groups.connectedPlugins'),
      rows: plugins.filter((plugin) => plugin.connectedCount > 0)
    },
    {
      id: 'disconnected',
      title: tr('skills.groups.disconnectedPlugins'),
      rows: plugins.filter((plugin) => plugin.connectedCount === 0)
    }
  ].filter((group) => group.rows.length > 0)

  if (rows.length === 0)
    return <div className="grid h-48 place-items-center text-[13px] text-ink3">{tr(emptyKey)}</div>
  return (
    <div className="min-w-0 flex-1 overflow-auto px-7 pb-6">
      {tab === 'skills' &&
        skillGroups.map((group) => (
          <GroupTable
            key={group.id}
            title={group.title}
            columns={
              <>
                <th className="px-3 py-2">{tr('skills.table.skill')}</th>
                <th>{tr('skills.table.author')}</th>
                <th>{tr('skills.table.lastUpdated')}</th>
              </>
            }
          >
            {group.rows.map((skill) => {
              const meta = skillRowMeta(skill)
              const id = `${skill.sourceId}/${skill.name}`
              return (
                <tr
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(id)}
                  onKeyDown={(event) => activate(event, () => onSelect(id))}
                  className={rowClass}
                >
                  <td className={`px-3 py-3 font-mono ${skill.enabled ? 'text-ink' : 'text-ink3'}`}>
                    {skill.name}
                  </td>
                  <td className="text-ink2">
                    {meta.author === 'skills.table.user' ? tr(meta.author) : meta.author}
                  </td>
                  <td className="text-ink3">
                    {meta.updatedAtMs === null
                      ? tr('common.unknown')
                      : formatDateMedium(meta.updatedAtMs, locale)}
                  </td>
                </tr>
              )
            })}
          </GroupTable>
        ))}
      {tab === 'mcp' &&
        mcpGroups.map((group) => (
          <GroupTable
            key={group.id}
            title={group.title}
            columns={
              <>
                <th className="px-3 py-2">{tr('skills.table.mcp')}</th>
                <th>{tr('skills.table.transport')}</th>
                <th>{tr('skills.table.status')}</th>
              </>
            }
          >
            {group.rows.map((server) => {
              const meta = mcpRowMeta(server)
              return (
                <tr
                  key={server.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(server.id)}
                  onKeyDown={(event) => activate(event, () => onSelect(server.id))}
                  className={rowClass}
                >
                  <td className="px-3 py-3 text-ink">{server.name}</td>
                  <td className="font-mono uppercase text-ink2">{meta.transport}</td>
                  <td className="text-ink3">{tr(meta.statusKey)}</td>
                </tr>
              )
            })}
          </GroupTable>
        ))}
      {tab === 'plugins' &&
        pluginGroups.map((group) => (
          <GroupTable
            key={group.id}
            title={group.title}
            columns={
              <>
                <th className="px-3 py-2">{tr('skills.table.plugin')}</th>
                <th>{tr('skills.table.providers')}</th>
                <th>{tr('skills.table.connectors')}</th>
              </>
            }
          >
            {group.rows.map((plugin) => (
              <tr
                key={plugin.pluginId}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(plugin.pluginId)}
                onKeyDown={(event) => activate(event, () => onSelect(plugin.pluginId))}
                className={rowClass}
              >
                <td className="px-3 py-3 font-mono text-ink">{plugin.pluginId}</td>
                <td className="text-ink2">{plugin.providerCount}</td>
                <td className="text-ink2">
                  {plugin.connectorCount} · {plugin.connectedCount} {tr('skills.table.connected')}
                </td>
              </tr>
            ))}
          </GroupTable>
        ))}
    </div>
  )
}
