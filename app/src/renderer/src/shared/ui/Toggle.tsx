// 온/오프 스위치 atom. SkillsMcpView 에 인라인이던 Toggle 을 공용으로 추출 —
// 맞춤설정 화면의 스킬 활성 토글 · 상세 패널에서 공유한다. on 은 0099 제어 토큰
// 파랑(`toggle-on`), off 는 border-strong.
/** Menu switch surface; the async spinner stays inside its circular thumb. */
export function ToggleIndicator({
  on,
  busy = false
}: {
  on: boolean
  busy?: boolean
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-toggle-track
      className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 ${on ? 'justify-end bg-toggle-on' : 'justify-start bg-border-strong'}`}
    >
      <span
        data-toggle-thumb
        className="inline-flex size-3 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-toggle-on"
      >
        {busy && (
          <svg
            data-toggle-spinner
            viewBox="0 0 16 16"
            className="size-2 animate-spin motion-reduce:animate-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="8" cy="8" r="6" opacity="0.25" />
            <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </span>
  )
}

export function Toggle({
  on,
  onClick,
  label
}: {
  on: boolean
  onClick?: () => void
  label?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative h-[17px] w-[30px] flex-none cursor-pointer rounded-[9px] border-0 transition-colors ${
        on ? 'bg-toggle-on' : 'bg-border-strong'
      }`}
    >
      <span
        className="absolute top-[1.5px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-[left] duration-150"
        style={{ left: on ? 14.5 : 1.5 }}
      />
    </button>
  )
}
