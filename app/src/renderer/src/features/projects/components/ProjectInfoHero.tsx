import { useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import { useProjectsState } from '../store/projectsStore'

interface ProjectInfoHeroProps {
  projectId: string
}

const ACTION_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink'
const MENU_ITEM =
  'flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px]'

// LEFT 컬럼 상단 hero — 프로젝트 제목 + 지침 preview(line-clamp-2) + 업데이트
// 메타. 제목 라인 우측에 핀 + 케밥 메뉴(세부사항 수정 / 삭제). 케밥 메뉴 동작은
// 아직 미배선(시각만) — 추후 라운드. ProjectsContext 직접 구독 (intra-feature OK).
export function ProjectInfoHero({ projectId }: ProjectInfoHeroProps): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const project = list.find((p) => p.id === projectId) ?? null
  const [menuOpen, setMenuOpen] = useState(false)
  const kebabRef = useRef<HTMLButtonElement>(null)

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
      <div className="flex items-start gap-2">
        <h1
          id="project-hero-title"
          className="m-0 min-w-0 flex-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink"
        >
          {project.name}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button className={ACTION_BTN} title="고정" aria-label="프로젝트 고정">
            <Icon name="pin" size={15} />
          </button>
          <button
            ref={kebabRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={ACTION_BTN}
            title="더 보기"
            aria-label="프로젝트 메뉴"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="kebab" size={15} />
          </button>
          <Popover
            open={menuOpen}
            anchorRef={kebabRef}
            onClose={() => setMenuOpen(false)}
            placement="bottom"
            align="end"
          >
            <div role="menu" className="flex w-[180px] flex-col py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className={`${MENU_ITEM} text-ink hover:bg-fill-uncontained-hover`}
              >
                <Icon name="edit" size={13} />
                <span>세부사항 수정</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className={`${MENU_ITEM} text-rust hover:bg-rust-soft`}
              >
                <Icon name="trash" size={13} />
                <span>삭제</span>
              </button>
            </div>
          </Popover>
        </div>
      </div>
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
