import { useState } from 'react'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'

// 작업 패널의 섹션 껍데기. 데이터는 각 본문이 소유하고 접힘은 로컬 표시 상태로 둔다.

export function TileSection({
  titleKey,
  count,
  children
}: {
  titleKey: MessageKey
  count?: number
  children: React.ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useState(true)
  const title = tr(titleKey)
  return (
    <section className="border-t border-t5 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group/section flex w-full items-center gap-g2 px-p2 py-2 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
      >
        <span className="text-footnote font-medium text-t9">{title}</span>
        {count !== undefined && <span className="text-footnote text-t6">{count}</span>}
        <Icon
          name="chevD"
          size={12}
          className={`text-t6 transition-transform ${open ? '' : '-rotate-90'} motion-reduce:transition-none`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
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
    <div className="flex flex-col items-start gap-g3 px-p2">
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-r5 border border-t5 bg-bg2 text-t6"
      >
        <Icon name={icon} size={18} />
      </span>
      <p className="text-caption text-ink3">{tr(descKey)}</p>
    </div>
  )
}
