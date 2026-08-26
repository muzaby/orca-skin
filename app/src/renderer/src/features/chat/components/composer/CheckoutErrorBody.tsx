import type { CheckoutErrorLine } from './branchChipState'

interface CheckoutErrorBodyProps {
  lines: CheckoutErrorLine[]
  // 문구 해석만 주입받는다 — 훅을 쓰지 않기 위해서다(아래 주석).
  translate: (key: Extract<CheckoutErrorLine, { kind: 'notice' }>['messageKey']) => string
}

// 전환 실패 모달의 본문. **훅을 쓰지 않는다** — 그래서 렌더 하네스 없이 이 함수를 그대로 불러
// 반환된 엘리먼트 트리에서 "안내 문단이 실제로 그려지는가" 를 확인할 수 있다.
//
// 왜 별도 컴포넌트인가: 조립(`checkoutErrorLines`)만 떼면 조립은 잠기지만 **그것을 그리는
// 분기**는 여전히 지울 수 있다 — r1 verify D2 재측정에서 `line.kind === 'notice'` 분기를
// 무력화해도 렌더러 365케이스가 전건 통과했다. 그리는 쪽까지 순수 함수로 내려야 그 홉이 잠긴다.
export function CheckoutErrorBody({ lines, translate }: CheckoutErrorBodyProps): React.JSX.Element {
  return (
    <>
      {lines.map((line) =>
        line.kind === 'notice' ? (
          <p
            key="notice"
            data-surface="checkout-error-notice"
            className="mt-2 text-[13px] leading-relaxed text-ink2"
          >
            {translate(line.messageKey)}
          </p>
        ) : (
          <p
            key="detail"
            data-surface="checkout-error-detail"
            className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] text-ink2"
          >
            {line.text}
          </p>
        )
      )}
    </>
  )
}
