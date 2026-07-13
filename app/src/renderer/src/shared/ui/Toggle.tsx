// 온/오프 스위치 atom. SkillsMcpView 에 인라인이던 Toggle 을 공용으로 추출 —
// 맞춤설정 화면의 스킬 활성 토글 · 상세 패널에서 공유한다. on 은 0099 제어 토큰
// 파랑(`toggle-on`), off 는 border-strong.
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
