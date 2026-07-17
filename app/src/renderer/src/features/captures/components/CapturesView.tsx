import { Icon } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'

export function CapturesView(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3.5 bg-bg p-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-[14px] bg-rust-soft text-rust">
        <Icon name="flask" size={26} />
      </div>
      <h1 className="m-0 font-serif text-[24px] font-semibold tracking-tight text-ink">
        {tr('captures.title')}
      </h1>
      <p className="m-0 max-w-[460px] text-[13.5px] leading-[1.55] text-ink2">
        {tr('captures.body')}
      </p>
      {/* PRD 절 참조 배지 — 문서 좌표라 번역하지 않는다. */}
      <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-ink3">
        PRD §9 · Future Scope
      </div>
    </section>
  )
}
