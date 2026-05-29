import { useEffect, useRef } from 'react'
import { useRuntimeContext } from '../providers/RuntimeProvider'

// Python 런타임 상태/진행 로그 모달. InstallerDialog 스트리밍 패턴을 따른다 —
// #app-frame-overlay 가 backdrop, 이 컴포넌트는 grid cell 중앙에 panel 만 놓는다.
// 실패 시 재시도 버튼을 노출한다.
export function RuntimeModal(): React.JSX.Element | null {
  const { status, log, prepare, modalOpen, setModalOpen } = useRuntimeContext()
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  if (!modalOpen) return null

  const running = status.stage === 'preparing'
  const ready = status.stage === 'ready'
  const failed = status.stage === 'error'

  return (
    <div className="grid h-full w-full place-items-center">
      <div className="w-[520px] max-w-[90vw] rounded-xl border border-border bg-panel p-5 shadow-xl">
        <div className="mb-2 font-serif text-[16px] font-semibold text-ink">Python 런타임</div>
        <div className="mb-3 text-[12.5px] text-ink2">
          앱이 제공하는 격리된 uv 환경입니다. Python 코드 실행·패키지 설치는 이 환경에서만
          이루어지며 시스템을 건드리지 않습니다.
        </div>
        <pre
          ref={logRef}
          className="mb-3 max-h-[220px] overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11.5px] text-ink2"
        >
          {log || (ready ? '준비 완료.' : '대기 중…')}
        </pre>
        {failed && status.error && (
          <div className="mb-3 rounded-md border border-rust bg-rust-soft px-2.5 py-1.5 text-[12px] text-ink">
            준비 실패: {status.error}
            <div className="mt-1 text-[11px] text-ink2">
              네트워크/방화벽을 확인하세요. 사내망이면 IT 에 미러/인덱스 설정을 문의하세요.
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setModalOpen(false)}
            className="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-[12.5px] text-ink2"
          >
            닫기
          </button>
          <button
            onClick={() => void prepare()}
            disabled={running}
            className="cursor-pointer rounded-md border-0 bg-rust px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
          >
            {running ? '준비 중…' : ready ? '재구성' : '다시 시도'}
          </button>
        </div>
      </div>
    </div>
  )
}
