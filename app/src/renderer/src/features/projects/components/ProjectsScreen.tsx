import { useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { CreateProjectModal } from './CreateProjectModal'
import { formatRelativeDay, useI18n } from '../../../shared/i18n'
import type { Project } from '../../../../../shared/ipc'

interface ProjectsScreenProps {
  projects: Project[]
  loading: boolean
  onOpenProject: (id: string) => void
  onCreate: (name: string, instructions: string) => Promise<void>
}

export function ProjectsScreen({
  projects,
  loading,
  onOpenProject,
  onCreate
}: ProjectsScreenProps): React.JSX.Element {
  const { tr } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          {tr('projects.title')}
        </h1>
        <span className="text-[13px] text-ink3">
          {loading ? tr('common.loading') : tr('common.count', { count: projects.length })}
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-ink px-3.5 py-[7px] text-[12.5px] font-medium text-bg"
        >
          <Icon name="plus" size={13} /> {tr('projects.newProject')}
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">{tr('projects.blurb')}</p>

      {!loading && projects.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject(p.id)} />
          ))}
        </div>
      )}

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreate}
      />
    </section>
  )
}

interface ProjectCardProps {
  project: Project
  onOpen: () => void
}

function ProjectCard({ project, onOpen }: ProjectCardProps): React.JSX.Element {
  const instructionsPreview = project.instructions.trim()
  // "방금"→"어제"→"N일 전"→"5월 13일" 사다리 — 로케일·OS 타임존 명시 공용 포맷터(0096).
  const { tr, locale } = useI18n()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/card cursor-pointer rounded-xl border border-border bg-panel p-4 text-left transition-colors hover:border-border-strong"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Icon name="folder" size={14} />
        <span className="font-mono text-[14px] font-semibold text-ink">{project.name}</span>
      </div>
      <div className="mb-3 line-clamp-2 min-h-[36px] text-[12.5px] leading-[1.5] text-ink2">
        {instructionsPreview || (
          <span className="italic text-ink3">{tr('projects.noInstructions')}</span>
        )}
      </div>
      <div className="flex items-center border-t border-border pt-2.5 text-[11.5px] text-ink3">
        <span className="ml-auto">{formatRelativeDay(project.updatedAt, locale)}</span>
      </div>
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="m-auto mt-12 max-w-[420px] rounded-xl border border-dashed border-border bg-panel/50 px-6 py-10 text-center">
      <Icon name="folder" size={32} />
      <div className="mt-3 font-serif text-[15px] font-semibold text-ink">
        {tr('projects.emptyTitle')}
      </div>
      <div className="mt-1.5 text-[12.5px] leading-[1.6] text-ink2">{tr('projects.emptyDesc')}</div>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-ink px-3.5 py-[7px] text-[12.5px] font-medium text-bg"
      >
        <Icon name="plus" size={13} /> {tr('projects.createFirst')}
      </button>
    </div>
  )
}
