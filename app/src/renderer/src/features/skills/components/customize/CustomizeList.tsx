import { useMemo, useState, type RefObject } from 'react'
import type { McpServer, SkillInfo } from '../../../../../../shared/ipc'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { Dot } from '../../../../shared/ui/Status'
import type { CustomizeTab } from './CustomizeRail'
import { useI18n } from '../../../../shared/i18n'

function ListHeader({
  title,
  addRef,
  onAdd
}: {
  title: string
  addRef: RefObject<HTMLButtonElement | null>
  onAdd: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="flex items-center gap-1.5 px-3.5 pb-2 pt-3.5">
      <span className="font-serif text-[16px] font-semibold text-ink">{title}</span>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          ref={addRef}
          iconOnly
          leadingIcon="plus"
          size="small"
          onClick={onAdd}
          aria-label={tr('skills.list.addAria')}
        />
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
  const { tr } = useI18n()
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
      {s.canToggle && !s.enabled && (
        <span className="ml-auto text-[10.5px] text-ink3">{tr('skills.list.off')}</span>
      )}
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
      <span className="grid h-6 w-6 flex-none place-items-center rounded-r3 bg-bg2 text-ink2">
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
  const { tr } = useI18n()
  const [open, setOpen] = useState<Record<string, boolean>>({
    orca: true,
    active: true,
    inactive: true
  })
  // 그룹 키는 안정된 sourceId — 라벨은 카탈로그에서 해석해 UI 언어를 따른다(0121 r3).
  // 미지의 sourceId 는 main 이 준 sourceLabel 원문 폴백.
  const groupLabel = (sourceId: string, fallback: string): string => {
    if (sourceId === 'orca') return tr('skills.list.groupOrca')
    if (sourceId === 'adapter:claude') return tr('skills.list.groupClaude')
    return fallback
  }
  const skillGroups = useMemo(() => {
    const map = new Map<string, { fallbackLabel: string; items: SkillInfo[] }>()
    for (const skill of skills) {
      const group = map.get(skill.sourceId) ?? { fallbackLabel: skill.sourceLabel, items: [] }
      group.items.push(skill)
      map.set(skill.sourceId, group)
    }
    return [...map.entries()]
  }, [skills])
  const mcpGroups: { id: string; label: string; items: McpServer[] }[] = [
    {
      id: 'active',
      label: tr('skills.list.activeMcp'),
      items: mcpServers.filter((s) => s.enabled)
    },
    {
      id: 'inactive',
      label: tr('skills.list.inactiveMcp'),
      items: mcpServers.filter((s) => !s.enabled)
    }
  ]
  return (
    <div className="flex w-[280px] flex-none flex-col overflow-y-auto border-r border-border">
      <ListHeader
        title={tab === 'skills' ? tr('skills.listTitle') : tr('skills.rail.mcp')}
        addRef={addRef}
        onAdd={onAdd}
      />
      <div className="px-1.5 pb-3">
        {tab === 'skills'
          ? skillGroups.map(([sourceId, { fallbackLabel, items }]) => (
              <div key={sourceId}>
                <GroupHead
                  label={groupLabel(sourceId, fallbackLabel)}
                  open={open[sourceId] ?? true}
                  onToggle={() => setOpen((p) => ({ ...p, [sourceId]: !(p[sourceId] ?? true) }))}
                />
                {(open[sourceId] ?? true) &&
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
          : mcpGroups.map(({ id, label, items }) =>
              items.length === 0 ? null : (
                <div key={id}>
                  <GroupHead
                    label={label}
                    open={open[id] ?? true}
                    onToggle={() => setOpen((p) => ({ ...p, [id]: !(p[id] ?? true) }))}
                  />
                  {(open[id] ?? true) &&
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
