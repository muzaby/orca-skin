import { useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Icon } from '../../../shared/ui/Icon'
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
import { ProjectMenuPanel } from './ProjectMenuPanel'

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
        <ProjectMenuPanel
          items={items}
          query={query}
          onQueryChange={setQuery}
          loading={projects.loading}
          disabled={inflight || picking}
          isSelected={(item) =>
            item.cwd !== null && isSelectedProject({ ...item, cwd: item.cwd }, cwd, projectId)
          }
          onSelect={(item) => {
            if (select(item.id)) close(true)
          }}
          onAdd={() => {
            void add().then((applied) => {
              if (applied) close(true)
            })
          }}
          onClose={close}
        />
      </Popover>
    </>
  )
}
