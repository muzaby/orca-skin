import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { CatalogListRow } from '../../../shared/ui/CatalogListRow'
import { Icon } from '../../../shared/ui/Icon'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'

interface ProjectCatalogRowProps {
  project: Project
  onOpen: () => void
  onTogglePin: (id: string, pinned: boolean) => void
}

export function ProjectCatalogRow({
  project,
  onOpen,
  onTogglePin
}: ProjectCatalogRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const pinned = project.pinnedAt != null
  useEffect(() => {
    if (!menuOpen) return
    const frame = window.requestAnimationFrame(() =>
      actionRef.current?.focus({ preventScroll: true })
    )
    return () => window.cancelAnimationFrame(frame)
  }, [menuOpen])
  const closeMenu = (): void => {
    setMenuOpen(false)
    menuRef.current?.focus({ preventScroll: true })
  }
  return (
    <CatalogListRow
      data-project-catalog-row={project.id}
      openProps={{ onClick: onOpen }}
      icon={<Icon name="folder" size={20} className="shrink-0 text-ink3" />}
      title={
        <>
          <span className="truncate" title={project.name}>
            {project.name}
          </span>
          {pinned && <Icon name="pin" size={13} className="shrink-0 text-ink3" />}
        </>
      }
      detail={
        project.cwd ? (
          <span
            data-project-catalog-path=""
            className="truncate text-caption text-ink3"
            title={project.cwd}
          >
            {project.cwd}
          </span>
        ) : undefined
      }
      actions={
        <>
          <Button
            ref={menuRef}
            iconOnly
            size="small"
            leadingIcon="kebab"
            title={tr('common.more')}
            aria-label={tr('projects.itemMenu', { title: project.name })}
            aria-haspopup="menu"
            expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMenuOpen(true)
              }
            }}
          />
          <Popover
            open={menuOpen}
            anchorRef={menuRef}
            onClose={closeMenu}
            placement="bottom"
            align="end"
            className="min-w-36"
          >
            <MenuItem
              ref={actionRef}
              role="menuitem"
              icon="pin"
              onClick={() => {
                closeMenu()
                onTogglePin(project.id, !pinned)
              }}
            >
              {tr(pinned ? 'common.unpin' : 'common.pin')}
            </MenuItem>
          </Popover>
        </>
      }
    />
  )
}
