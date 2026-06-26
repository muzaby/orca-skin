interface AuthExpiredModalProps {
  open: boolean
  onNewChat: () => void
  onDismiss: () => void
}

export function AuthExpiredModal({
  open,
  onNewChat,
  onDismiss
}: AuthExpiredModalProps): React.JSX.Element | null {
  if (!open) return null
  const cmd = 'claude /login'
  // backdrop 은 #app-frame-overlay 가 담당. panel 만 grid cell 중앙에.
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="w-[440px] max-w-[90vw] rounded-xl border border-border bg-panel p-5 shadow-xl">
        <div className="mb-2 font-serif text-[16px] font-semibold text-ink">
          Claude Code 인증 만료
        </div>
        <div className="mb-3 text-[12.5px] text-ink2">
          터미널에서 아래 명령을 실행한 뒤 새 대화를 시작하세요.
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5">
          <code className="flex-1 font-mono text-[12px] text-ink">{cmd}</code>
          <button
            onClick={() => void navigator.clipboard.writeText(cmd)}
            className="cursor-pointer rounded border border-border bg-panel px-2 py-0.5 text-[11px] text-ink2"
          >
            복사
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onDismiss}
            className="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-[12.5px] text-ink2"
          >
            닫기
          </button>
          <button
            onClick={onNewChat}
            className="cursor-pointer rounded-md border-0 bg-ink px-3 py-1.5 text-[12.5px] text-bg"
          >
            새 대화
          </button>
        </div>
      </div>
    </div>
  )
}
