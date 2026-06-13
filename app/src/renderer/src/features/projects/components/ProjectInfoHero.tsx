import { useProjectsState } from '../store/projectsStore'

interface ProjectInfoHeroProps {
  projectId: string
}

// LEFT 컬럼 상단 hero — 프로젝트 제목 + 지침 preview(line-clamp-2) + 업데이트
// 메타. ProjectsContext 직접 구독 (intra-feature OK). page 는 projectId 만
// wiring. ProjectInstructionsSidebar 와 같은 ProjectsContext.list 를 구독하므로
// 지침 편집 시 양쪽이 자동 sync.
export function ProjectInfoHero({ projectId }: ProjectInfoHeroProps): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const project = list.find((p) => p.id === projectId) ?? null

  if (!project) {
    return <div className="h-[60px]" aria-hidden />
  }

  const updatedLabel = new Date(project.updatedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <section aria-labelledby="project-hero-title">
      <h1
        id="project-hero-title"
        className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink"
      >
        {project.name}
      </h1>
      {project.instructions.trim() ? (
        <p className="mt-2 line-clamp-2 text-[13px] leading-[1.55] text-ink2">
          {project.instructions}
        </p>
      ) : null}
      <div className="mt-2 text-[11.5px] text-ink3">
        업데이트 <time dateTime={new Date(project.updatedAt).toISOString()}>{updatedLabel}</time>
      </div>
    </section>
  )
}
