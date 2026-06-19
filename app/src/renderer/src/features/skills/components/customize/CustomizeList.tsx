import { useMemo, useState, type RefObject } from 'react'
import type { McpServer, SkillInfo } from '../../../../../../shared/ipc'
import { Icon } from '../../../../shared/ui/Icon'
import { Dot } from '../../../../shared/ui/Status'
import type { CustomizeTab } from './CustomizeRail'

function ListHeader({
  title,
  addRef,
  onAdd
}: {
  title: string
  addRef: RefObject<HTMLButtonElement | null>
  onAdd: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-3.5 pb-2 pt-3.5">
      <span className="font-serif text-[16px] font-semibold text-ink">{title}</span>
      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          aria-label="검색"
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
        >
          <Icon name="search" size={14} />
        </button>
        <button
          ref={addRef}
          type="button"
          onClick={onAdd}
          aria-label="추가"
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
        >
          <Icon name="plus" size={15} />
        </button>
      </div>
    </div>
  )
}

function GroupHead({
  label,
  open,
  onToggle
}: {
  label: string
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center px-3.5 pb-1 pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[11.5px] font-medium uppercase tracking-wide text-ink3"
      >
        <Icon name={open ? 'chevD' : 'chevR'} size={12} />
        {label}
      </button>
    </div>
  )
}

function SkillRow({
  s,
  selected,
  onClick
}: {
  s: SkillInfo
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-r4 border-0 px-2.5 py-2 text-left transition-colors ${selected ? 'bg-fill-uncontained-active' : 'bg-transparent hover:bg-fill-uncontained-hover'}`}
    >
      <span
        className={`truncate font-mono text-[12.5px] ${s.enabled ? 'font-semibold text-ink' : 'text-ink3'}`}
      >
        {s.name}
      </span>
      {!s.enabled && <span className="ml-auto text-[10.5px] text-ink3">꺼짐</span>}
    </button>
  )
}

function McpRow({
  server,
  selected,
  onClick
}: {
  server: McpServer
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 px-2.5 py-2 text-left transition-colors ${selected ? 'bg-fill-uncontained-active' : 'bg-transparent hover:bg-fill-uncontained-hover'}`}
    >
      <span className="grid h-6 w-6 flex-none place-items-center rounded-r3 bg-cream-50 text-ink2">
        <Icon name={server.transport === 'http' ? 'link' : 'cpu'} size={13} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{server.name}</span>
      {!server.enabled && <Dot tone="slate" />}
    </button>
  )
}

export function CustomizeList({
  tab,
  skills,
  mcpServers,
  selectedId,
  onSelect,
  addRef,
  onAdd
}: {
  tab: CustomizeTab
  skills: SkillInfo[]
  mcpServers: McpServer[]
  selectedId: string | null
  onSelect: (id: string) => void
  addRef: RefObject<HTMLButtonElement | null>
  onAdd: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState<Record<string, boolean>>({
    'Orca 스킬': true,
    active: true,
    inactive: true
  })
  const skillGroups = useMemo(() => {
    const map = new Map<string, SkillInfo[]>()
    for (const skill of skills)
      map.set(skill.sourceLabel, [...(map.get(skill.sourceLabel) ?? []), skill])
    return [...map.entries()]
  }, [skills])
  const mcpGroups: [string, McpServer[]][] = [
    ['활성 MCP', mcpServers.filter((s) => s.enabled)],
    ['비활성 MCP', mcpServers.filter((s) => !s.enabled)]
  ]
  return (
    <div className="flex w-[280px] flex-none flex-col overflow-y-auto border-r border-border">
      <ListHeader title={tab === 'skills' ? '스킬' : 'MCP'} addRef={addRef} onAdd={onAdd} />
      <div className="px-1.5 pb-3">
        {tab === 'skills'
          ? skillGroups.map(([label, items]) => (
              <div key={label}>
                <GroupHead
                  label={label}
                  open={open[label] ?? true}
                  onToggle={() => setOpen((p) => ({ ...p, [label]: !(p[label] ?? true) }))}
                />
                {(open[label] ?? true) &&
                  items.map((s) => (
                    <SkillRow
                      key={`${s.sourceId}/${s.name}`}
                      s={s}
                      selected={`${s.sourceId}/${s.name}` === selectedId}
                      onClick={() => onSelect(`${s.sourceId}/${s.name}`)}
                    />
                  ))}
              </div>
            ))
          : mcpGroups.map(([label, items]) =>
              items.length === 0 ? null : (
                <div key={label}>
                  <GroupHead
                    label={label}
                    open={open[label] ?? true}
                    onToggle={() => setOpen((p) => ({ ...p, [label]: !(p[label] ?? true) }))}
                  />
                  {(open[label] ?? true) &&
                    items.map((s) => (
                      <McpRow
                        key={s.id}
                        server={s}
                        selected={s.id === selectedId}
                        onClick={() => onSelect(s.id)}
                      />
                    ))}
                </div>
              )
            )}
      </div>
    </div>
  )
}
