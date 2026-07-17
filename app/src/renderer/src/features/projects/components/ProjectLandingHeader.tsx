import { Icon } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'

interface ProjectLandingHeaderProps {
  onBack: () => void
}

// 프로젝트 랜딩 페이지 상단 풀-너비 navigation strip — "모든 프로젝트" 뒤로가기
// 링크 하나만 노출. 프로젝트 제목/지침/메타는 LEFT 컬럼의 ProjectInfoHero 가
// 담당한다 (목업 분리 결정).
export function ProjectLandingHeader({ onBack }: ProjectLandingHeaderProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <header
      role="navigation"
      aria-label={tr('projects.landingHeader.navAria')}
      className="flex items-center gap-2 bg-bg/90 px-6 py-2.5 backdrop-blur"
    >
      <button
        onClick={onBack}
        aria-label={tr('projects.landingHeader.backAria')}
        className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-[12px] text-ink2 transition-colors duration-150 hover:bg-panel/60 hover:text-ink outline-none hide-focus-ring ring-focus"
      >
        <Icon name="chevR" size={12} style={{ transform: 'rotate(180deg)' }} />
        {tr('projects.landingHeader.all')}
      </button>
    </header>
  )
}
