import { Icon } from '../../../shared/ui/Icon'

export function CapturesView(): React.JSX.Element {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3.5 bg-bg p-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-[14px] bg-rust-soft text-rust">
        <Icon name="flask" size={26} />
      </div>
      <h1 className="m-0 font-serif text-[24px] font-semibold tracking-tight text-ink">
        캡처 히스토리 & AI 분석
      </h1>
      <p className="m-0 max-w-[460px] text-[13.5px] leading-[1.55] text-ink2">
        준비 중입니다. 캡처 RAW 보관, 채널별 메트릭, ColorChecker / SFR / ΔE 자동 분석, Claude의
        분석 코멘트는 다음 단계에서 제공됩니다.
      </p>
      <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-ink3">
        PRD §9 · Future Scope
      </div>
    </section>
  )
}
