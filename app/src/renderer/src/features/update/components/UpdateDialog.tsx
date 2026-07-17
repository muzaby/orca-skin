import { Icon } from '../../../shared/ui/Icon'
import { Button } from '../../../shared/ui/Button'
import { Modal } from '../../../shared/ui/Modal'
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

// 공용 Modal 셸(포털 + 단일 backdrop + Esc/백드롭 클릭) 위의 콘텐츠 (handoff 0121 —
// 구 자체 fixed backdrop 은 #app-frame-overlay 와 이중 적용되던 버그). busy(다운로드/
// 설치) 중에는 Modal 의 busy 가드가 모든 닫기 경로를 차단한다.
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
  return (
    <Modal
      open={open}
      onClose={updateActions.closeDialog}
      busy={busy}
      ariaLabel={tr('update.dialogTitle')}
      footer={
        <>
          {!busy && (
            <Button variant="contained" size="small" onClick={updateActions.closeDialog}>
              {tr('update.later')}
            </Button>
          )}
          <Button
            variant="primary"
            size="small"
            disabled={primaryDisabled}
            onClick={() => {
              if (state.status === 'ready') void updateActions.quitAndInstall()
              else void updateActions.download()
            }}
          >
            {tr(primaryLabelKey(state.status))}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-r5 border border-border bg-bg text-ink2">
          <Icon name="download" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[18px] font-semibold text-ink">
            {tr('update.dialogTitle')}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
            {STATUS_KEY[state.status] ? tr(STATUS_KEY[state.status]) : tr('update.statusFallback')}
          </p>
        </div>
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
    </Modal>
  )
}
