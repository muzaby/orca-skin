import { Icon } from '../../../shared/ui/Icon'
import { updateActions, useUpdateActionError, useUpdateState } from '../store/updateStore'

const STATUS_LABEL: Record<string, string> = {
  idle: '업데이트 대기 중',
  checking: '업데이트 확인 중…',
  available: '새 업데이트가 준비되었습니다.',
  downloading: '업데이트 다운로드 중…',
  ready: '다운로드 완료. 재시작하면 설치됩니다.',
  installing: '업데이트 설치를 시작합니다…',
  error: '업데이트 오류.'
}
function primaryLabel(status: string): string {
  if (status === 'ready') return '업데이트 후 재시작'
  if (status === 'downloading') return '다운로드 중…'
  if (status === 'installing') return '설치 시작 중…'
  return '업데이트'
}

export function UpdateDialog({ open }: { open: boolean }): React.JSX.Element | null {
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
              Orca 업데이트
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              {STATUS_LABEL[state.status] ?? '업데이트 상태를 확인합니다.'}
            </p>
          </div>
          {!busy && (
            <button
              type="button"
              onClick={updateActions.closeDialog}
              aria-label="닫기"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
            >
              <Icon name="x" size={15} />
            </button>
          )}
        </div>
        <div className="grid gap-3 rounded-r5 border border-border bg-bg p-3 text-[12.5px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink3">현재 버전</span>
            <span className="font-medium text-ink">v{state.currentVersion}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink3">새 버전</span>
            <span className="font-medium text-ink">
              {state.availableVersion ? `v${state.availableVersion}` : '확인 중'}
            </span>
          </div>
        </div>
        {(state.status === 'downloading' || state.status === 'ready') && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-ink2">
              <span>다운로드 진행률</span>
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
            <div className="mb-1.5 text-[12px] font-medium text-ink2">릴리스 노트</div>
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-r5 border border-border bg-bg p-3 text-[12.5px] leading-relaxed text-ink2">
              {state.releaseNotes}
            </div>
          </div>
        )}
        {!state.canInstall && state.status === 'ready' && (
          <div className="mt-4 flex gap-2 rounded-r5 border border-border bg-bg p-3 text-[12.5px] text-ink2">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            <span>
              {state.installBlockReason ?? '작업이 진행 중입니다 — 끝난 뒤 다시 시도하세요.'}
            </span>
          </div>
        )}
        {(state.error || actionError) && (
          <div className="mt-4 rounded-r5 border border-border bg-bg p-3 text-[12.5px] text-ink2">
            {actionError ?? state.error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {!busy && (
            <button
              type="button"
              onClick={updateActions.closeDialog}
              className="cursor-pointer rounded-r4 border border-border bg-panel px-3.5 py-1.5 text-[12.5px] text-ink2 hover:bg-fill-uncontained-hover"
            >
              나중에
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
            {primaryLabel(state.status)}
          </button>
        </div>
      </section>
    </div>
  )
}
