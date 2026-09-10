import { useRef, useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { useI18n } from '../../../shared/i18n'
import { projectsActions, useProjectsState } from '../store/projectsStore'
import { EditInstructionsModal } from './EditInstructionsModal'

interface ProjectInfoHeroProps {
  projectId: string
}

// 프로젝트 제목과 고정·지침 편집 메뉴. 지침 본문은 편집 대화상자에서 표시한다.
export function ProjectInfoHero({ projectId }: ProjectInfoHeroProps): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const project = list.find((p) => p.id === projectId) ?? null
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const kebabRef = useRef<HTMLButtonElement>(null)
  const { tr } = useI18n()

  if (!project) {
    return <div className="h-[60px]" aria-hidden />
  }

  const pinned = project.pinnedAt != null

  return (
    <section aria-labelledby="project-hero-title">
      <div className="flex items-start gap-2">
        <h1
          id="project-hero-title"
          className="m-0 min-w-0 flex-1 font-serif text-[30px] font-medium tracking-[-0.02em] text-ink"
        >
          {project.name}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button
            iconOnly
            leadingIcon="pin"
            size="small"
            pressed={pinned}
            onClick={() => void projectsActions.setPinned(project.id, !pinned)}
            title={tr(pinned ? 'common.unpin' : 'projects.hero.pin')}
            aria-label={tr('projects.hero.pinAria')}
            aria-pressed={pinned}
          />
          <Button
            ref={kebabRef}
            iconOnly
            leadingIcon="kebab"
            size="small"
            onClick={() => setMenuOpen((v) => !v)}
            title={tr('common.more')}
            aria-label={tr('projects.hero.menuAria')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            pressed={menuOpen}
          />
          <Popover
            open={menuOpen}
            anchorRef={kebabRef}
            onClose={() => setMenuOpen(false)}
            placement="bottom"
            align="end"
          >
            <div role="menu" className="flex w-[180px] flex-col py-1">
              <MenuItem
                role="menuitem"
                icon="edit"
                iconSize={13}
                onClick={() => {
                  setMenuOpen(false)
                  setEditOpen(true)
                }}
              >
                <span>{tr('projects.hero.editInstructions')}</span>
              </MenuItem>
              <MenuItem
                role="menuitem"
                danger
                icon="trash"
                iconSize={13}
                onClick={() => setMenuOpen(false)}
              >
                <span>{tr('common.delete')}</span>
              </MenuItem>
            </div>
          </Popover>
        </div>
      </div>
      <EditInstructionsModal
        key={project.id}
        open={editOpen}
        initial={project.instructions}
        projectName={project.name}
        onClose={() => setEditOpen(false)}
        onSave={(instructions) => projectsActions.update(project.id, { instructions })}
      />
    </section>
  )
}
