import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Icon } from '../../../shared/ui/Icon'
import { MenuItem } from '../../../shared/ui/MenuItem'

import type { ProjectMenuItem } from '../lib/projectMenuItems'
export type { ProjectMenuItem } from '../lib/projectMenuItems'

interface ProjectMenuPanelProps {
  items: readonly ProjectMenuItem[]
  query: string
  onQueryChange: (query: string) => void
  isSelected: (item: ProjectMenuItem) => boolean
  onSelect: (item: ProjectMenuItem) => void
  onAdd: () => void
  // `focusAnchor` = 닫으면서 메뉴를 연 버튼으로 초점을 돌려준다.
  onClose: (focusAnchor: boolean) => void
  loading?: boolean
  disabled?: boolean
  // 행 오른쪽 체크 앞에 붙는 표식(예: 폴더 없음).
  rowTag?: (item: ProjectMenuItem) => ReactNode
}

// 프로젝트 고르기 메뉴의 본문 — 검색 · 프로젝트 행 · `프로젝트 추가`. 컴포저 프로젝트 버튼과
// 예약 작업 모달이 함께 쓴다. 열리면 검색에 초점이 가고 ↑↓ 로 행 사이를 옮긴다.
export function ProjectMenuPanel({
  items,
  query,
  onQueryChange,
  isSelected,
  onSelect,
  onAdd,
  onClose,
  loading = false,
  disabled = false,
  rowTag
}: ProjectMenuPanelProps): React.JSX.Element {
  const { tr } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return (
    <div
      ref={panelRef}
      className="flex w-[280px] max-w-[calc(100vw-24px)] flex-col"
      data-component="landing-project-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose(true)
          return
        }
        if (event.key === 'Tab') {
          onClose(true)
          return
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const rows = Array.from(
          panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-project-option]') ?? []
        ).filter((row) => !row.disabled)
        const index = rows.findIndex((row) => row === document.activeElement)
        const next =
          event.key === 'ArrowDown'
            ? (index + 1) % rows.length
            : index < 0
              ? rows.length - 1
              : (index - 1 + rows.length) % rows.length
        event.preventDefault()
        rows[next]?.focus()
      }}
    >
      <label className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <Icon name="search" size={16} className="shrink-0 text-ink3" />
        <input
          ref={searchRef}
          aria-label={tr('projects.search')}
          placeholder={tr('projects.search')}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink3"
        />
      </label>
      <div className="max-h-[240px] overflow-y-auto py-1" aria-busy={loading}>
        {items.map((item) => {
          const selected = isSelected(item)
          return (
            <MenuItem
              key={item.id}
              icon="folder"
              data-project-option
              role="menuitemradio"
              aria-checked={selected}
              className="aria-checked:bg-fill-uncontained-hover"
              title={item.cwd ?? undefined}
              disabled={disabled}
              onClick={() => onSelect(item)}
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {rowTag?.(item)}
              <span className="flex w-3 shrink-0 items-center">
                {selected && <Icon name="check" size={12} />}
              </span>
            </MenuItem>
          )
        })}
        {!items.length && (
          <div role="status" className="px-2.5 py-2 text-footnote text-ink3">
            {tr(
              loading
                ? 'projects.loading'
                : query.trim()
                  ? 'projects.noMatches'
                  : 'projects.emptyFolders'
            )}
          </div>
        )}
      </div>
      <div className="border-t border-border pt-1">
        <MenuItem
          icon="plus"
          data-project-option
          role="menuitem"
          disabled={disabled}
          onClick={onAdd}
        >
          {tr('projects.add')}
        </MenuItem>
      </div>
    </div>
  )
}
