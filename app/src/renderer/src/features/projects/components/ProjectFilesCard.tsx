import { Icon } from '../../../shared/ui/Icon'
import { FileDropIllustration } from './FileDropIllustration'

// 우측 패널 "파일" 카드 — 테두리+라운드 카드 chrome + 헤더 "+" 버튼 + 점선 드롭존.
// 파일 첨부 동작은 미구현(placeholder) — "+" 버튼은 시각만 유지하고 disabled.
export function ProjectFilesCard(): React.JSX.Element {
  return (
    <section className="rounded-r6 border border-border bg-panel px-4 py-3.5">
      <div className="mb-2 flex items-center">
        <div className="font-serif text-[13px] font-semibold text-ink">파일</div>
        <button
          disabled
          className="ml-auto grid h-6 w-6 cursor-not-allowed place-items-center rounded-md border-0 bg-transparent text-ink3"
          title="파일 추가 (준비 중)"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="flex flex-col items-center gap-2.5 rounded-r5 border border-dashed border-border px-4 py-7 text-center text-ink3">
        <FileDropIllustration />
        <div className="text-[11.5px] leading-[1.55]">
          이 프로젝트에서 참조할 PDF, 문서 또는 기타 텍스트를 추가하세요.
        </div>
      </div>
    </section>
  )
}
