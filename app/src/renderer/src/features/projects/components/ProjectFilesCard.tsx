import { DISABLED_HATCH_CLASS } from '../../../shared/ui/mock'
import { SidebarCard } from './SidebarCard'
import { FileDropIllustration } from './FileDropIllustration'
import { useI18n } from '../../../shared/i18n'

// 우측 패널 "파일" 카드 — 카드 셸 + 점선 드롭존. 파일 첨부 동작은 미구현(placeholder)
// 이라 헤더 "+" 버튼은 onAdd 미전달로 비활성(시각만).
export function ProjectFilesCard(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <SidebarCard
      title={tr('projects.filesCard.title')}
      addTitle={tr('projects.filesCard.addTitle')}
      bodyClassName={`rounded-r5 ${DISABLED_HATCH_CLASS}`}
    >
      <div className="flex flex-col items-center gap-2.5 rounded-r5 border border-dashed border-border bg-panel/70 px-4 py-7 text-center text-ink3">
        <FileDropIllustration />
        <div className="text-[11.5px] leading-[1.55]">
          이 프로젝트에서 참조할 PDF, 문서, 폴더 또는 기타 텍스트를 추가하세요.
        </div>
      </div>
    </SidebarCard>
  )
}
