import { useState, type RefObject } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { Dot } from '../../../../shared/ui/Status'
import type { CustomizeTab } from './CustomizeRail'
import {
  CONNECTOR_GROUP_LABEL,
  type ConnectorGroup,
  type ConnectorItem,
  type SkillItem
} from './data'

const CONNECTOR_GROUP_ORDER: ConnectorGroup[] = ['local', 'hardware', 'disconnected']

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
  onToggle,
  gear
}: {
  label: string
  open: boolean
  onToggle: () => void
  gear?: boolean
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
      {gear && (
        <button
          type="button"
          aria-label="그룹 설정"
          className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:text-ink2"
        >
          <Icon name="settings" size={13} />
        </button>
      )}
    </div>
  )
}

function SkillRow({
  s,
  selected,
  onClick
}: {
  s: SkillItem
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-r4 border-0 px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-fill-uncontained-active' : 'bg-transparent hover:bg-fill-uncontained-hover'
      }`}
    >
      <span
        className={`truncate font-mono text-[12.5px] ${
          s.enabled ? 'font-semibold text-ink' : 'text-ink3'
        }`}
      >
        {s.name}
      </span>
      {!s.enabled && <span className="ml-auto text-[10.5px] text-ink3">꺼짐</span>}
    </button>
  )
}

function ConnectorRow({
  c,
  selected,
  onClick
}: {
  c: ConnectorItem
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-fill-uncontained-active' : 'bg-transparent hover:bg-fill-uncontained-hover'
      }`}
    >
      <span className="grid h-6 w-6 flex-none place-items-center rounded-r3 bg-cream-50 text-ink2">
        <Icon name={c.icon} size={13} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{c.name}</span>
      {c.badge ? (
        <span className="rounded bg-cream-50 px-1.5 py-0.5 text-[10px] text-ink3">{c.badge}</span>
      ) : (
        c.group === 'disconnected' && <Dot tone="slate" />
      )}
    </button>
  )
}

// 맞춤설정 가운데 목록. 스킬 모드 = "개인 스킬" 접이식 그룹, 커넥터 모드 = 로컬/하드웨어/
// 연결되지 않음 3그룹. 추가(+) 버튼 ref 는 상위가 캐스케이딩 메뉴 앵커로 사용한다.
export function CustomizeList({
  tab,
  skills,
  connectors,
  selectedId,
  onSelect,
  addRef,
  onAdd
}: {
  tab: CustomizeTab
  skills: SkillItem[]
  connectors: ConnectorItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  addRef: RefObject<HTMLButtonElement | null>
  onAdd: () => void
}): React.JSX.Element {
  const [skillsOpen, setSkillsOpen] = useState(true)
  const [groupOpen, setGroupOpen] = useState<Record<ConnectorGroup, boolean>>({
    local: true,
    hardware: true,
    disconnected: true
  })

  return (
    <div className="flex w-[280px] flex-none flex-col overflow-y-auto border-r border-border">
      <ListHeader title={tab === 'skills' ? '스킬' : '커넥터'} addRef={addRef} onAdd={onAdd} />

      {tab === 'skills' ? (
        <div className="px-1.5 pb-3">
          <GroupHead
            label="개인 스킬"
            open={skillsOpen}
            onToggle={() => setSkillsOpen((v) => !v)}
          />
          {skillsOpen &&
            skills.map((s) => (
              <SkillRow
                key={s.id}
                s={s}
                selected={s.id === selectedId}
                onClick={() => onSelect(s.id)}
              />
            ))}
        </div>
      ) : (
        <div className="px-1.5 pb-3">
          {CONNECTOR_GROUP_ORDER.map((g) => {
            const items = connectors.filter((c) => c.group === g)
            if (items.length === 0) return null
            return (
              <div key={g}>
                <GroupHead
                  label={CONNECTOR_GROUP_LABEL[g]}
                  open={groupOpen[g]}
                  onToggle={() => setGroupOpen((prev) => ({ ...prev, [g]: !prev[g] }))}
                  gear={g === 'hardware'}
                />
                {groupOpen[g] &&
                  items.map((c) => (
                    <ConnectorRow
                      key={c.id}
                      c={c}
                      selected={c.id === selectedId}
                      onClick={() => onSelect(c.id)}
                    />
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
