import { Icon } from '../../../shared/ui/Icon'
import { uiMessageText, useI18n, type MessageKey } from '../../../shared/i18n'
import { updateActions, useUpdateActionError, useUpdateState } from '../store/updateStore'

// 상태/액션 라벨은 카탈로그 키만 두고 렌더에서 tr() 해석한다(0096 패턴, 0097).
const STATUS_KEY: Record<string, MessageKey> = {
  idle: 'update.status.idle',
  checking: 'update.status.checking',
  available: 'update.status.available',
  downloading: 'update.status.downloading',
  ready: 'update.status.ready',
  installing: 'update.status.installing',
  error: 'update.status.error'
}
function primaryLabelKey(status: string): MessageKey {
  if (status === 'ready') return 'update.action.ready'
  if (status === 'downloading') return 'update.action.downloading'
  if (status === 'installing') return 'update.action.installing'
  return 'update.action.update'
}

export function UpdateDialog({ open }: { open: boolean }): React.JSX.Element | null {
  const { tr } = useI18n()
  const state = useUpdateState()
  const actionError = useUpdateActionError()
  const busy = state.status === 'downloading' || state.status === 'installing'
  const canAct = state.status === 'ready' ? state.canInstall : state.status === 'available'
  const primaryDisabled =
    busy ||
    state.status === 'checking' ||
    state.status === 'idle' ||
    state.status === 'error' ||
    !canAct
  const percent = state.progress?.percent ?? (state.status === 'ready' ? 100 : 0)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      data-context="overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        className="w-full max-w-[560px] rounded-r6 border border-border bg-panel p-5 text-ink shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-r5 border border-border bg-bg text-ink2">
            <Icon name="download" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="update-dialog-title" className="font-serif text-[18px] font-semibold text-ink">
              {tr('update.dialogTitle')}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              {STATUS_KEY[state.status]
                ? tr(STATUS_KEY[state.status])
                : tr('update.statusFallback')}
            </p>
          </div>
          {!busy && (
            <button
              type="button"
              onClick={updateActions.closeDialog}
              aria-label={tr('common.close')}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
            >
              <Icon name="x" size={15} />
            </button>
          )}
        </div>
        <div className="grid gap-3 rounded-r5 border border-border bg-bg p-3 text-[12.5px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink3">{tr('update.currentVersion')}</span>
            <span className="font-medium text-ink">v{state.currentVersion}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink3">{tr('update.newVersion')}</span>
            <span className="font-medium text-ink">
              {state.availableVersion ? `v${state.availableVersion}` : tr('update.checkingShort')}
            </span>
          </div>
        </div>
        {(state.status === 'downloading' || state.status === 'ready') && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-ink2">
              <span>{tr('update.progress')}</span>
              <span>{Math.round(percent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-fill-uncontained-active">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-150"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            </div>
          </div>
        )}
        {state.releaseNotes && (
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] font-medium text-ink2">
              {tr('update.releaseNotes')}
            </div>
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-r5 border border-border bg-bg p-3 text-[12.5px] leading-relaxed text-ink2">
              {state.releaseNotes}
            </div>
          </div>
        )}
        {!state.canInstall && state.status === 'ready' && (
          <div className="mt-4 flex gap-2 rounded-r5 border border-border bg-bg p-3 text-[12.5px] text-ink2">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            <span>{state.installBlockReason ?? tr('update.installBlockedFallback')}</span>
          </div>
        )}
        {(state.error || actionError) && (
          <div className="mt-4 rounded-r5 border border-border bg-bg p-3 text-[12.5px] text-ink2">
            {actionError ? uiMessageText(tr, actionError) : state.error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {!busy && (
            <button
              type="button"
              onClick={updateActions.closeDialog}
              className="cursor-pointer rounded-r4 border border-border bg-panel px-3.5 py-1.5 text-[12.5px] text-ink2 hover:bg-fill-uncontained-hover"
            >
              {tr('update.later')}
            </button>
          )}
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={() => {
              if (state.status === 'ready') void updateActions.quitAndInstall()
              else void updateActions.download()
            }}
            className="cursor-pointer rounded-r4 border-0 bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-t8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tr(primaryLabelKey(state.status))}
          </button>
        </div>
      </section>
    </div>
  )
}
