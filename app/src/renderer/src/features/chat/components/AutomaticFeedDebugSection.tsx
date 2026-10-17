import { useI18n } from '../../../shared/i18n'
import { setAutomaticFeedVisibility, useAutomaticFeedVisibility } from '../store/automaticFeedDebug'

export function AutomaticFeedDebugSection(): React.JSX.Element | null {
  const { tr } = useI18n()
  const visible = useAutomaticFeedVisibility()
  if (!import.meta.env.DEV) return null
  return (
    <button
      type="button"
      data-debug-control="automatic-feed"
      aria-pressed={visible}
      onClick={() => setAutomaticFeedVisibility(!visible)}
      className="cursor-default rounded-md border-[0.5px] border-floating-panel-border bg-floating-panel-control px-2.5 py-1.5 text-left font-medium text-floating-panel-text transition-colors hover:bg-floating-panel-control-hover aria-pressed:bg-toggle-on aria-pressed:text-white"
    >
      {tr('debug.showAutomaticFeeds')}
    </button>
  )
}
