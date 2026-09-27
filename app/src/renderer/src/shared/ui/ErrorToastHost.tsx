import { useStore } from 'zustand'
import { useI18n } from '../i18n'
import { errorToastStore } from '../errors/errorToastStore'
import { Icon } from './Icon'

export function ErrorToastHost(): React.JSX.Element {
  const toasts = useStore(errorToastStore, (state) => state.toasts)
  const dismiss = useStore(errorToastStore, (state) => state.dismiss)
  const { tr } = useI18n()
  return (
    <div className="pointer-events-none fixed right-[28px] top-[38px] z-[60] flex w-[min(480px,calc(100vw-56px))] flex-col gap-2 max-sm:right-[14px] max-sm:w-[calc(100vw-28px)]">
      {toasts.map(({ id, seq, title, detail }) => (
        <div
          key={`${id}:${seq}`}
          role="alert"
          className="pointer-events-auto grid grid-cols-[34px_1fr_24px] gap-[10px] rounded-[13px] border border-toast-border bg-toast-bg py-[13px] pl-[14px] pr-[13px] shadow-[var(--shadow-toast)] animate-error-toast motion-reduce:animate-none [font-family:var(--font-app)]"
        >
          <span
            aria-hidden="true"
            className="grid size-[30px] place-items-center rounded-[8px] border border-toast-icon-border text-rust"
          >
            <Icon name="alert" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-[620] leading-[1.35] text-toast-title">
              {tr(`errors.toast.${title}`)}
            </p>
            {detail && (
              <p className="mt-[3px] text-[12.5px] leading-[1.4] text-toast-desc [overflow-wrap:anywhere]">
                {detail}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={tr('common.close')}
            onClick={() => dismiss(id)}
            className="self-start text-[18px] leading-none text-toast-close hover:text-ink focus-visible:outline-2 focus-visible:outline-rust"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
