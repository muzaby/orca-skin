import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'

// `작업` 타일의 접히는 섹션 껍데기와, 아직 데이터가 붙지 않은 두 섹션의 빈 상태(0204 D-017·D-022).
//
// **이 파일은 `messages`/`parts` 를 읽지 않는다**(§10 EP-16). `출력`·`컨텍스트` 는 이번 라운드에
// 자리만 잡는다 — 채울 재료(`FILE_EDIT_TOOLS`·`toolDiffStat`·`orca:files:openPath`·0201 의 세션
// 고정값)는 이미 있으나 무엇을 어떻게 보일지는 다음 handoff 의 결정이다. 반쯤 만든 파생이
// 화면으로 새지 않도록 여기서는 import 자체를 두지 않는다.
//
// 접힘 상태는 로컬 `useState` 다(D-027) — 외부에서 섹션을 여닫는 소비자가 없고, 세션별
// `ChatState` 에 넣으면 표시 취향이 세션마다 갈라진다.

export function TileSection({
  titleKey,
  children
}: {
  titleKey: MessageKey
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
function SectionPlaceholder({
  icon,
  descKey
}: {
  icon: 'chart' | 'board'
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

export function OutputSectionEmpty(): React.JSX.Element {
  return <SectionPlaceholder icon="chart" descKey="chat.taskTile.sections.outputDesc" />
}

export function ContextSectionEmpty(): React.JSX.Element {
  return <SectionPlaceholder icon="board" descKey="chat.taskTile.sections.contextDesc" />
}
