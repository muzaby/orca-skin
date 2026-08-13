import type { ProviderAuthKind, ProviderAuthSpecInfo } from '../../../../shared/ipc'

// 인증 방식 선택 칩 열 (0181). 게이트 화면(`features/providers`)과 카탈로그 연결 탭
// (`features/skills`)이 **같은 컨트롤**을 쓴다 — 판정 규칙은 이미 `shared/config/providerAuth`
// 가 한 벌로 갖고 있는데 생김새만 두 벌이면 다음 디자인 수정에서 두 화면이 갈린다.
//
// 바깥 여백·정렬은 화면마다 달라서 `className` 으로 받는다(게이트는 가운데 정렬, 카탈로그는
// 좌측). 칩 자체의 클래스는 여기서만 정한다.
export function AuthKindChoices({
  choices,
  value,
  onChange,
  className
}: {
  choices: ProviderAuthSpecInfo[]
  value: ProviderAuthKind | null
  onChange: (kind: ProviderAuthKind) => void
  className?: string
}): React.JSX.Element {
  return (
    <div className={className}>
      {choices.map((spec) => (
        <button
          key={spec.kind}
          type="button"
          onClick={() => onChange(spec.kind)}
          aria-pressed={value === spec.kind}
          className={`cursor-pointer rounded-r4 border px-3.5 py-p3 text-footnote ${
            value === spec.kind
              ? 'border-0 bg-ink text-bg'
              : 'border-border bg-panel text-ink2 hover:bg-fill-uncontained-hover'
          }`}
        >
          {spec.label}
        </button>
      ))}
    </div>
  )
}
