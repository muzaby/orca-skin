import { Icon, type IconName } from '../../../shared/ui/Icon'

interface NoticeProps {
  title?: string
  children?: React.ReactNode
  icon?: IconName
  onClose?: () => void
}

// 컴포저 패널스택의 범용 안내 메시지 패널. 내용은 props 로 주입한다 — 어떤 소스(동시 턴 가드 ·
// 향후 중앙서버 푸시 등)든 같은 패널 크롬으로 렌더한다. onClose 가 있으면 우측 × 닫기 노출.
export function Notice({
  title,
  children,
  icon = 'alert',
  onClose
}: NoticeProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-r6 border border-border bg-sidebar px-3 py-2 text-[12px] leading-relaxed text-ink">
      <Icon name={icon} size={14} />
      <div className="min-w-0">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className="text-ink2">{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto -mt-0.5 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}
