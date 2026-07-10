import { useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { CreateProjectModal } from './CreateProjectModal'
import { relativeTimeLabel } from '../../../../../shared/time/relative'
import type { Project } from '../../../../../shared/ipc'

interface ProjectsScreenProps {
  projects: Project[]
  loading: boolean
  onOpenProject: (id: string) => void
  onCreate: (name: string, instructions: string) => Promise<void>
}

// "방금", "12분 전", "3시간 전", "어제", "4일 전", "5월 13일" 형식.
// 하루 미만 구간은 shared relativeTimeLabel 사다리를 그대로 쓰고, 어제/날짜 tail 만 로컬.
function formatRelative(updatedAt: number): string {
  const day = Math.floor((Date.now() - updatedAt) / 86_400_000)
  if (day < 1) return relativeTimeLabel(updatedAt)
  if (day === 1) return '어제'
  if (day < 7) return `${day}일 전`
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(
    new Date(updatedAt)
  )
}

export function ProjectsScreen({
  projects,
  loading,
  onOpenProject,
  onCreate
}: ProjectsScreenProps): React.JSX.Element {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          프로젝트
        </h1>
        <span className="text-[13px] text-ink3">
          {loading ? '불러오는 중…' : `${projects.length}개`}
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-ink px-3.5 py-[7px] text-[12.5px] font-medium text-bg"
        >
          <Icon name="plus" size={13} /> 새 프로젝트
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        프로젝트는 대화를 카테고리로 묶고, 지정한 시스템 지침을 해당 프로젝트의 모든 새 대화에 자동
        주입합니다.
      </p>

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
        {instructionsPreview || <span className="italic text-ink3">지침 없음</span>}
      </div>
      <div className="flex items-center border-t border-border pt-2.5 text-[11.5px] text-ink3">
        <span className="ml-auto">{formatRelative(project.updatedAt)}</span>
      </div>
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="m-auto mt-12 max-w-[420px] rounded-xl border border-dashed border-border bg-panel/50 px-6 py-10 text-center">
      <Icon name="folder" size={32} />
      <div className="mt-3 font-serif text-[15px] font-semibold text-ink">
        아직 프로젝트가 없어요
      </div>
      <div className="mt-1.5 text-[12.5px] leading-[1.6] text-ink2">
        프로젝트를 만들면 관련된 대화를 한곳에 모으고, 지정한 지침이 모든 새 대화에 자동으로
        적용됩니다.
      </div>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-ink px-3.5 py-[7px] text-[12.5px] font-medium text-bg"
      >
        <Icon name="plus" size={13} /> 첫 프로젝트 만들기
      </button>
    </div>
  )
}
