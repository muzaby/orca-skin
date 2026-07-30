import type { KeyboardEvent } from 'react'
import type { McpServer, SkillInfo } from '../../../../../../shared/ipc'
import { Icon } from '../../../../shared/ui/Icon'
import { formatDateMedium, useI18n } from '../../../../shared/i18n'
import type { CustomizeTab } from '../../store/extensionsModalStore'

function skillKey(skill: SkillInfo): string {
  return `${skill.sourceId}/${skill.name}`
}

function activateRow(event: KeyboardEvent<HTMLTableRowElement>, action: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  action()
}

function EmptyRow({ label }: { label: string }): React.JSX.Element {
  return (
    <tr>
      <td colSpan={3} className="px-4 py-12 text-center text-[12.5px] text-ink3">
        {label}
      </td>
    </tr>
  )
}

function SkillsTable({
  skills,
  plugin,
  onSelect
}: {
  skills: SkillInfo[]
  plugin: boolean
  onSelect: (id: string) => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  return (
    <table className="w-full min-w-[620px] border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-[11.5px] font-medium text-ink3">
          <th className="w-[52%] px-4 py-2 font-medium">
            {plugin ? tr('skills.table.plugin') : tr('skills.table.skill')}
          </th>
          <th className="w-[25%] px-4 py-2 font-medium">{tr('skills.table.lastUpdated')}</th>
          <th className="px-4 py-2 font-medium">{tr('skills.table.author')}</th>
        </tr>
      </thead>
      <tbody>
        {skills.length === 0 ? (
          <EmptyRow label={plugin ? tr('skills.table.noPlugins') : tr('skills.table.noSkills')} />
        ) : (
          skills.map((skill) => {
            const open = (): void => onSelect(skillKey(skill))
            const author =
              skill.isBuiltin || skill.sourceKind === 'orca'
                ? plugin
                  ? 'Orca'
                  : tr('skills.table.user')
                : skill.sourceLabel
            return (
              <tr
                key={skillKey(skill)}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(event) => activateRow(event, open)}
                className="group/table-row cursor-pointer border-b border-border/70 outline-none transition-colors last:border-b-0 hover:bg-fill-uncontained-hover focus-visible:bg-fill-uncontained-hover"
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-r3 bg-bg2 text-ink2">
                      <Icon name={plugin ? 'layers' : 'doc'} size={14} />
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`truncate text-[13px] ${skill.enabled ? 'font-medium text-ink' : 'text-ink3'}`}
                      >
                        {skill.name}
                      </div>
                      {skill.description && (
                        <div className="mt-0.5 truncate text-[11.5px] text-ink3">
                          {skill.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-ink2">
                  {skill.updatedAt
                    ? formatDateMedium(skill.updatedAt, locale)
                    : tr('common.unknown')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-[12.5px] text-ink2">
                    <span className="truncate">{author}</span>
                    <Icon
                      name="chevR"
                      size={14}
                      className="ml-auto flex-none text-ink3 opacity-0 transition-opacity group-hover/table-row:opacity-100"
                    />
                  </div>
                </td>
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )
}

function ConnectorsTable({
  servers,
  onSelect
}: {
  servers: McpServer[]
  onSelect: (id: string) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <table className="w-full min-w-[620px] border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-[11.5px] font-medium text-ink3">
          <th className="w-[52%] px-4 py-2 font-medium">{tr('skills.table.connector')}</th>
          <th className="w-[25%] px-4 py-2 font-medium">{tr('skills.table.status')}</th>
          <th className="px-4 py-2 font-medium">{tr('skills.table.transport')}</th>
        </tr>
      </thead>
      <tbody>
        {servers.length === 0 ? (
          <EmptyRow label={tr('skills.table.noConnectors')} />
        ) : (
          servers.map((server) => {
            const open = (): void => onSelect(server.id)
            return (
              <tr
                key={server.id}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(event) => activateRow(event, open)}
                className="group/table-row cursor-pointer border-b border-border/70 outline-none transition-colors last:border-b-0 hover:bg-fill-uncontained-hover focus-visible:bg-fill-uncontained-hover"
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-r3 bg-bg2 text-ink2">
                      <Icon name={server.transport === 'http' ? 'link' : 'cpu'} size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink">{server.name}</div>
                      {server.description && (
                        <div className="mt-0.5 truncate text-[11.5px] text-ink3">
                          {server.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-ink2">
                  {server.enabled ? tr('skills.mcpDetail.active') : tr('skills.mcpDetail.inactive')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-[12.5px] text-ink2">
                    <span className="font-mono uppercase">{server.transport}</span>
                    <Icon
                      name="chevR"
                      size={14}
                      className="ml-auto flex-none text-ink3 opacity-0 transition-opacity group-hover/table-row:opacity-100"
                    />
                  </div>
                </td>
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )
}

export function CustomizeList({
  tab,
  skills,
  plugins,
  mcpServers,
  onSelect
}: {
  tab: CustomizeTab
  skills: SkillInfo[]
  plugins: SkillInfo[]
  mcpServers: McpServer[]
  onSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 pb-6">
      {tab === 'connectors' ? (
        <ConnectorsTable servers={mcpServers} onSelect={onSelect} />
      ) : (
        <SkillsTable
          skills={tab === 'plugins' ? plugins : skills}
          plugin={tab === 'plugins'}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
