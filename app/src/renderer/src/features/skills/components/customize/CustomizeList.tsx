import type { KeyboardEvent } from 'react'
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
  return (
    <div className="min-w-0 flex-1 overflow-auto px-6 pb-6">
      {rows.length === 0 ? (
        <div className="grid h-48 place-items-center text-[13px] text-ink3">{tr(emptyKey)}</div>
      ) : (
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead className="border-b border-border text-[11px] uppercase tracking-wide text-ink3">
            <tr>
              {tab === 'skills' ? (
                <>
                  <th className="px-3 py-2">{tr('skills.table.skill')}</th>
                  <th>{tr('skills.table.author')}</th>
                  <th>{tr('skills.table.lastUpdated')}</th>
                </>
              ) : tab === 'mcp' ? (
                <>
                  <th className="px-3 py-2">{tr('skills.table.mcp')}</th>
                  <th>{tr('skills.table.transport')}</th>
                  <th>{tr('skills.table.status')}</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2">{tr('skills.table.plugin')}</th>
                  <th>{tr('skills.table.providers')}</th>
                  <th>{tr('skills.table.connectors')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {tab === 'skills'
              ? skills.map((skill) => {
                  const meta = skillRowMeta(skill)
                  const id = `${skill.sourceId}/${skill.name}`
                  return (
                    <tr
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(id)}
                      onKeyDown={(e) => activate(e, () => onSelect(id))}
                      className="cursor-pointer border-b border-border hover:bg-fill-uncontained-hover"
                    >
                      <td
                        className={`px-3 py-3 font-mono ${skill.enabled ? 'text-ink' : 'text-ink3'}`}
                      >
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
                })
              : tab === 'mcp'
                ? mcpServers.map((server) => {
                    const meta = mcpRowMeta(server)
                    return (
                      <tr
                        key={server.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(server.id)}
                        onKeyDown={(e) => activate(e, () => onSelect(server.id))}
                        className="cursor-pointer border-b border-border hover:bg-fill-uncontained-hover"
                      >
                        <td className="px-3 py-3 text-ink">{server.name}</td>
                        <td className="font-mono uppercase text-ink2">{meta.transport}</td>
                        <td className="text-ink3">{tr(meta.statusKey)}</td>
                      </tr>
                    )
                  })
                : plugins.map((plugin) => (
                    <tr
                      key={plugin.pluginId}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(plugin.pluginId)}
                      onKeyDown={(e) => activate(e, () => onSelect(plugin.pluginId))}
                      className="cursor-pointer border-b border-border hover:bg-fill-uncontained-hover"
                    >
                      <td className="px-3 py-3 font-mono text-ink">{plugin.pluginId}</td>
                      <td className="text-ink2">{plugin.providerCount}</td>
                      <td className="text-ink2">
                        {plugin.connectorCount} · {plugin.connectedCount}{' '}
                        {tr('skills.table.connected')}
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
