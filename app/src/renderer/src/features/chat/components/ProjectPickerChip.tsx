import { useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import { chipSurface, OUTLINED_ICON_SIZE } from '../harnesses/common/composer/chipSurface'
import { filterProjectMenuItems, type ProjectMenuItem } from '../lib/projectMenuItems'
import { ProjectMenuPanel } from './ProjectMenuPanel'

interface ProjectPickerChipProps {
  projects: readonly ProjectMenuItem[]
  value: string | null
  onChange: (projectId: string) => void
  // 폴더를 골라 프로젝트를 더한다. 더한 프로젝트 id, 취소면 null.
  onAdd: () => Promise<string | null>
  placeholder: string
}

// 세션 밖에서 프로젝트를 고르는 칩 — 컴포저 프로젝트 버튼과 같은 칩·메뉴를 쓴다. 값은 호출자가
// 갖는다. 폴더 없는 프로젝트도 보이고 `폴더 없음` 태그를 단다.
export function ProjectPickerChip({
  projects,
  value,
  onChange,
  onAdd,
  placeholder
}: ProjectPickerChipProps): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const selected = projects.find((item) => item.id === value)
  const close = (focus = false): void => {
    setOpen(false)
    setQuery('')
    if (focus) anchorRef.current?.focus()
  }
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={tr('schedules.modal.project')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={selected?.cwd ?? tr('schedules.modal.project')}
        data-component="project-picker-chip"
        className={`${chipSurface('outlined', false)} max-w-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <Icon name="folder" size={OUTLINED_ICON_SIZE} className="shrink-0" />
        <span className={`min-w-0 truncate ${selected ? '' : 'text-ink3'}`}>
          {selected?.name ?? placeholder}
        </span>
        <Icon name="chevD" size={12} className="shrink-0" />
      </button>
      <Popover open={open} anchorRef={anchorRef} onClose={() => close()} placement="bottom">
        <ProjectMenuPanel
          items={filterProjectMenuItems(projects, query)}
          query={query}
          onQueryChange={setQuery}
          isSelected={(item) => item.id === value}
          onSelect={(item) => {
            onChange(item.id)
            close(true)
          }}
          onAdd={() => {
            setAdding(true)
            void onAdd()
              .then((id) => {
                if (!id) return
                onChange(id)
                close(true)
              })
              .finally(() => setAdding(false))
          }}
          onClose={close}
          disabled={adding}
          rowTag={(item) =>
            item.cwd ? null : (
              <span className="shrink-0 text-[11.5px] text-ink3">
                {tr('schedules.modal.noFolderTag')}
              </span>
            )
          }
        />
      </Popover>
    </>
  )
}
