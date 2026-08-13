import { FullFrameShell } from './FullFrameShell'
import { Button } from '../shared/ui/Button'
import { useI18n } from '../shared/i18n'

// 부팅이 실패했을 때 AppLayout 을 대체하는 화면 — 실패 사유와 재시도 버튼. 창 크롬은
// `FullFrameShell` 이 갖는다.
//
// 0180 이전에는 이 파일이 `LoginFrame` 이었다 — 로그인 게이트와 부팅 실패 화면을 함께
// 맡고 있었다. 게이트가 사라지면서 남은 책임(부팅 실패)만 이름에 반영했다.
export function BootFailureFrame({
  bootError,
  onRetryBoot
}: {
  bootError: string | null
  onRetryBoot: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <FullFrameShell screenLabel={`Orca · ${tr('boot.errorTitle')}`}>
      <div className="flex w-full max-w-[360px] flex-col gap-4">
        <div
          role="alert"
          className="rounded-r4 border border-bad/30 bg-bad/10 p-3 text-center text-[12.5px] text-bad"
        >
          <p className="mb-2 font-semibold">{tr('boot.errorTitle')}</p>
          {bootError && <p className="mb-3 break-words text-ink2">{bootError}</p>}
          <Button variant="contained" size="small" onClick={onRetryBoot}>
            {tr('boot.retry')}
          </Button>
        </div>
      </div>
    </FullFrameShell>
  )
}
