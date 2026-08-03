import type { KeyboardEvent, ReactNode } from 'react'
import type { McpServer, SkillInfo } from '../../../../../../shared/ipc'
import { formatDateMedium, uiMessageText, useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import type { CatalogTab } from '../../lib/catalogSelection'
import { mcpRowMeta, skillRowMeta } from '../../lib/catalogRows'
import {
  groupKey,
  isGroupOpen,
  mcpGroups,
  pluginGroups,
  skillGroups,
  type CatalogGroup,
  type CollapsedGroups
} from '../../lib/catalogGroups'
import type { PluginRow } from '../../lib/pluginCatalog'

function activate(event: KeyboardEvent<HTMLTableRowElement>, action: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    action()
  }
}

// 그룹마다 독립 <table> 을 갖는다(0159 r4 결정). 독립 표는 각자 콘텐츠로 열 폭을 계산해
// 그룹끼리 열 경계가 어긋나므로, table-fixed + 탭 공용 colgroup 으로 폭을 고정한다.
const COL_WIDTHS = ['46%', '27%', '27%'] as const

function GroupTable<T>({
  group,
  tab,
  collapsed,
  onToggle,
  columns,
  children
}: {
  group: CatalogGroup<T>
  tab: CatalogTab
  collapsed: CollapsedGroups
  onToggle: (key: string) => void
  columns: readonly string[]
  children: ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const key = groupKey(tab, group.id)
  const open = isGroupOpen(collapsed, key)
  const bodyId = `catalog-group-body-${key}`
  return (
    <section>
      <button
        type="button"
        onClick={() => onToggle(key)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full cursor-pointer items-center gap-g3 rounded-r4 border-0 bg-transparent px-p2 py-p2 text-left transition-colors hover:bg-t2"
      >
        <Icon name={open ? 'chevD' : 'chevR'} size={14} color="var(--color-ink3)" />
        <span className="text-caption font-semibold text-ink2">
          {uiMessageText(tr, group.label)}
        </span>
        <span className="text-caption text-ink3">{group.rows.length}</span>
      </button>
      {open && (
        <table id={bodyId} className="mt-g2 w-full table-fixed border-collapse text-left">
          <colgroup>
            {COL_WIDTHS.map((width) => (
              <col key={width} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              {columns.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-p6 py-p3 text-caption font-medium text-ink3"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-footnote">{children}</tbody>
        </table>
      )}
    </section>
  )
}

const rowClass =
  'cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-t2'
const cellClass = 'truncate px-p6 py-p4'

export function CustomizeList({
  tab,
  skills,
  mcpServers,
  plugins,
  collapsed,
  onToggleGroup,
  onSelect
}: {
  tab: CatalogTab
  skills: SkillInfo[]
  mcpServers: McpServer[]
  plugins: PluginRow[]
  collapsed: CollapsedGroups
  onToggleGroup: (key: string) => void
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

  if (rows.length === 0)
    return <div className="grid h-48 place-items-center text-body text-ink3">{tr(emptyKey)}</div>

  // 그룹 간 세로 리듬(1.75rem)을 좌우 거터(px-7)와 같은 값으로 맞춘다. p*/g* 램프는
  // 1.25rem 에서 끝나므로 레이아웃 리듬은 base rem 스케일을 쓴다.
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-7 overflow-auto px-7 pb-6">
      {tab === 'skills' &&
        skillGroups(skills).map((group) => (
          <GroupTable
            key={group.id}
            group={group}
            tab={tab}
            collapsed={collapsed}
            onToggle={onToggleGroup}
            columns={[
              tr('skills.table.skill'),
              tr('skills.table.author'),
              tr('skills.table.lastUpdated')
            ]}
          >
            {group.rows.map((skill) => {
              const meta = skillRowMeta(skill)
              const id = `${skill.sourceId}/${skill.name}`
              return (
                <tr
                  key={id}
                  tabIndex={0}
                  aria-label={skill.name}
                  onClick={() => onSelect(id)}
                  onKeyDown={(event) => activate(event, () => onSelect(id))}
                  className={rowClass}
                >
                  <td
                    className={`${cellClass} font-mono ${skill.enabled ? 'text-ink' : 'text-ink3'}`}
                  >
                    {skill.name}
                  </td>
                  <td className={`${cellClass} text-ink2`}>
                    {meta.author === 'skills.table.user' ? tr(meta.author) : meta.author}
                  </td>
                  <td className={`${cellClass} text-ink3`}>
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
        mcpGroups(mcpServers).map((group) => (
          <GroupTable
            key={group.id}
            group={group}
            tab={tab}
            collapsed={collapsed}
            onToggle={onToggleGroup}
            columns={[
              tr('skills.table.mcp'),
              tr('skills.table.transport'),
              tr('skills.table.status')
            ]}
          >
            {group.rows.map((server) => {
              const meta = mcpRowMeta(server)
              return (
                <tr
                  key={server.id}
                  tabIndex={0}
                  aria-label={server.name}
                  onClick={() => onSelect(server.id)}
                  onKeyDown={(event) => activate(event, () => onSelect(server.id))}
                  className={rowClass}
                >
                  <td className={`${cellClass} text-ink`}>{server.name}</td>
                  <td className={`${cellClass} font-mono uppercase text-ink2`}>{meta.transport}</td>
                  <td className={`${cellClass} text-ink3`}>{tr(meta.statusKey)}</td>
                </tr>
              )
            })}
          </GroupTable>
        ))}
      {tab === 'plugins' &&
        pluginGroups(plugins).map((group) => (
          <GroupTable
            key={group.id}
            group={group}
            tab={tab}
            collapsed={collapsed}
            onToggle={onToggleGroup}
            columns={[
              tr('skills.table.plugin'),
              tr('skills.table.providers'),
              tr('skills.table.connectors')
            ]}
          >
            {group.rows.map((plugin) => (
              <tr
                key={plugin.pluginId}
                tabIndex={0}
                aria-label={plugin.pluginId}
                onClick={() => onSelect(plugin.pluginId)}
                onKeyDown={(event) => activate(event, () => onSelect(plugin.pluginId))}
                className={rowClass}
              >
                <td className={`${cellClass} font-mono text-ink`}>{plugin.pluginId}</td>
                <td className={`${cellClass} text-ink2`}>{plugin.providerCount}</td>
                <td className={`${cellClass} text-ink2`}>
                  {plugin.connectorCount} · {plugin.connectedCount} {tr('skills.table.connected')}
                </td>
              </tr>
            ))}
          </GroupTable>
        ))}
    </div>
  )
}
