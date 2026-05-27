import { Icon } from '../../../shared/ui/Icon'
import { useProjectsContext } from '../providers/ProjectsProvider'

interface ProjectLandingHeaderProps {
  projectId: string
  onBack: () => void
}

// 프로젝트 랜딩의 상단 영역 — 뒤로 가기 + 프로젝트 이름 + 지침 한 줄.
// ProjectsContext 직접 구독 (intra-feature OK). page 는 projectId 만 wiring.
export function ProjectLandingHeader({
  projectId,
  onBack
}: ProjectLandingHeaderProps): React.JSX.Element {
  const { list } = useProjectsContext()
  const project = list.find((p) => p.id === projectId) ?? null

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-bg/90 px-6 py-2.5 backdrop-blur">
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-[12px] text-ink2 hover:text-ink"
        >
          <Icon name="chevR" size={12} style={{ transform: 'rotate(180deg)' }} />
          모든 프로젝트
        </button>
      </div>
      <div className="border-b border-border px-6 pb-3 pt-4">
        <h1 className="m-0 font-serif text-[22px] font-semibold tracking-[-0.01em] text-ink">
          {project?.name ?? '…'}
        </h1>
        {project?.instructions.trim() ? (
          <div className="mt-1 line-clamp-1 text-[12px] text-ink3">{project.instructions}</div>
        ) : null}
      </div>
    </>
  )
}
