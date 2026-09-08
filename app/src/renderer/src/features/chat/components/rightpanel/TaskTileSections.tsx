import { useState } from 'react'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'

// 작업 패널의 섹션 껍데기. 데이터는 각 본문이 소유하고 접힘은 로컬 표시 상태로 둔다.

export function TileSection({
  titleKey,
  count,
  actions,
  status,
  children
}: {
  titleKey: MessageKey
  count?: number
  actions?: React.ReactNode
  status?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(true)
  const title = tr(titleKey)
  return (
    <section aria-label={title} className="border-t border-t5 first:border-t-0">
      <div
        className={`flex items-center px-4 ${titleKey === 'chat.taskTile.sections.progress' ? 'pr-12' : ''}`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group/section flex min-w-0 items-center gap-2 py-3 text-left transition-colors hover:text-ink focus:outline-none hide-focus-ring ring-focus"
        >
          <span className="text-[15px] font-medium text-ink">{title}</span>
          {count !== undefined && <span className="text-footnote text-t6">{count}</span>}
          <Icon
            name="chevD"
            size={12}
            className={`text-t6 transition-transform ${open ? '' : '-rotate-90'} motion-reduce:transition-none`}
          />
        </button>
        {actions && (
          <div className="ml-auto pl-2" onClickCapture={() => setOpen(true)}>
            {actions}
          </div>
        )}
      </div>
      {open && <div className="pb-4">{children}</div>}
      {status}
    </section>
  )
}

// 데이터가 붙기 전의 섹션 본문 — 일러스트 자리 + 한 줄 설명(첨부 cowork 양식).
export function SectionPlaceholder({
  icon,
  descKey
}: {
  icon: IconName
  descKey: MessageKey
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="flex flex-col items-start gap-5 px-4 pt-2">
      {icon === 'doc' ? (
        <div aria-hidden className="relative ml-1 flex h-[76px] w-[132px] items-end pb-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-r4 border border-border-strong bg-panel text-t5 shadow-sm">
            <Icon name="doc" size={22} />
          </span>
          <span className="ml-1 flex h-10 w-10 items-center justify-center rounded-r4 border border-border-strong bg-panel text-t5 shadow-sm">
            <Icon name="doc" size={22} />
          </span>
          <span className="absolute bottom-3 left-[72px] flex h-[54px] w-[43px] rotate-6 items-center justify-center rounded-r4 border border-border-strong bg-panel text-t5 shadow-sm">
            <Icon name="doc" size={26} />
          </span>
        </div>
      ) : (
        <span
          aria-hidden
          className="ml-1 flex h-11 w-[70px] items-center justify-center rounded-r4 border border-border-strong bg-panel text-t5 shadow-sm"
        >
          <Icon name={icon} size={30} />
        </span>
      )}
      <p className="text-footnote leading-relaxed text-ink3">{tr(descKey)}</p>
    </div>
  )
}
