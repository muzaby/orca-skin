import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Icon } from '../../../shared/ui/Icon'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { useChatSession } from '../store/chatStore'
import { cwdDisplayName } from '../lib/worktreeDisplay'
import {
  isSelectedProject,
  landingProjectOptions,
  type LandingProjects
} from '../lib/landingProjectOptions'
import { useLandingProjectPicker } from '../hooks/useLandingProjectPicker'
import {
  chipSurface,
  OUTLINED_ICON_SIZE,
  type ChipVariant
} from '../harnesses/common/composer/chipSurface'

export function LandingProjectPicker({
  cwd,
  inflight,
  projects,
  variant,
  className = ''
}: {
  cwd: string | null
  inflight: boolean
  projects: LandingProjects
  variant: ChipVariant
  className?: string
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const anchorRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const projectId = useChatSession((s) => s.pendingProjectId)
  const { select, add, picking } = useLandingProjectPicker(projects)
  const items = landingProjectOptions(projects.items, query)
  const selected = projects.items.find(
    (item) => item.cwd !== null && isSelectedProject({ ...item, cwd: item.cwd }, cwd, projectId)
  )
  const close = (focus = false): void => {
    setOpen(false)
    setQuery('')
    if (focus) anchorRef.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])
  if (inflight && open) {
    setOpen(false)
    setQuery('')
  }
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={inflight || picking}
        aria-label={tr('chat.composer.cwdSelectAria')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={cwd ?? undefined}
        data-component="landing-project-picker"
        className={`${chipSurface(variant, false)} focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <Icon
          name="folder"
          size={variant === 'outlined' ? OUTLINED_ICON_SIZE : 14}
          className="shrink-0"
        />
        <span className="min-w-0 truncate">{selected?.name ?? cwdDisplayName(cwd, null)}</span>
        <Icon name="chevD" size={12} className="shrink-0" />
      </button>
      <Popover open={open} anchorRef={anchorRef} onClose={() => close()}>
        <div
          ref={panelRef}
          className="flex w-[280px] max-w-[calc(100vw-24px)] flex-col"
          data-component="landing-project-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close(true)
              return
            }
            if (event.key === 'Tab') {
              close(true)
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
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink3"
            />
          </label>
          <div className="max-h-[240px] overflow-y-auto py-1" aria-busy={projects.loading}>
            {items.map((item) => (
              <MenuItem
                key={item.id}
                icon="folder"
                data-project-option
                role="menuitemradio"
                aria-checked={isSelectedProject(item, cwd, projectId)}
                className="aria-checked:bg-fill-uncontained-hover"
                title={item.cwd}
                disabled={inflight || picking}
                onClick={() => {
                  if (select(item.id)) close(true)
                }}
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="flex w-3 shrink-0 items-center">
                  {isSelectedProject(item, cwd, projectId) && <Icon name="check" size={12} />}
                </span>
              </MenuItem>
            ))}
            {!items.length && (
              <div role="status" className="px-2.5 py-2 text-footnote text-ink3">
                {tr(
                  projects.loading
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
              disabled={inflight || picking}
              onClick={() => {
                void add().then((applied) => {
                  if (applied) close(true)
                })
              }}
            >
              {tr('projects.add')}
            </MenuItem>
          </div>
        </div>
      </Popover>
    </>
  )
}
