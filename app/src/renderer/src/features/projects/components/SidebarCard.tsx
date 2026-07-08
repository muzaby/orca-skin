import { Icon } from '../../../shared/ui/Icon'

interface SidebarCardProps {
  title: string
  // 헤더 우측 "+" 버튼 핸들러. 미전달 시 버튼은 비활성 placeholder (파일 카드 준비 중).
  onAdd?: () => void
  addTitle: string
  children: React.ReactNode
  bodyClassName?: string
}

// 우측 패널 카드 셸 — 테두리+라운드 chrome + 헤더(serif 타이틀 + "+" 버튼). 본문은 children.
// 지침/파일 카드가 동일 chrome·헤더를 공유하므로 여기로 추출(중복 제거).
export function SidebarCard({
  title,
  onAdd,
  addTitle,
  children,
  bodyClassName = ''
}: SidebarCardProps): React.JSX.Element {
  const disabled = onAdd === undefined
  return (
    <section className="rounded-r6 border border-border bg-panel px-4 py-3.5">
      <div className="mb-2 flex items-center">
        <div className="font-serif text-[13px] font-semibold text-ink">{title}</div>
        <button
          onClick={onAdd}
          disabled={disabled}
          className={
            disabled
              ? 'ml-auto grid h-6 w-6 cursor-not-allowed place-items-center rounded-md border-0 bg-transparent text-ink3'
              : 'ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-fill-uncontained-hover hover:text-ink'
          }
          title={addTitle}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
