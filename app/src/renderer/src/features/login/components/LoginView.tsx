import { useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/ui/Button'
import { loginActions, useLoginStore } from '../store'
import orca from '../assets/orca-login.png'

// 로그인 랜딩(이미지1 참고). 중앙 '로그인' 제목 자리를 오르카 이미지로 대체하고,
// 아래 카드에는 검정 'SSO로 로그인' 버튼 1개만 둔다. SSO 는 항상 실패(store.attemptSso)
// 이며, 실패 시 버튼 위에 빨간 메시지, 수행 중에는 버튼이 inflight(스피너+"로그인 중")로 바뀐다.
export function LoginView(): React.JSX.Element {
  const navigate = useNavigate()
  const status = useLoginStore((s) => s.status)
  const errorMessage = useLoginStore((s) => s.errorMessage)
  const inflight = status === 'inflight'

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-7 px-6">
      <img
        src={orca}
        alt="Orca"
        className="h-40 w-40 select-none object-contain"
        draggable={false}
      />
      <div className="w-full rounded-r6 border border-border bg-panel p-6 shadow-xl">
        {status === 'error' && errorMessage && (
          <p role="alert" className="mb-3 text-center text-[12.5px] text-bad">
            {errorMessage}
          </p>
        )}
        <Button
          variant="primary"
          size="large"
          className="h-12 w-full"
          busy={inflight}
          onClick={() => void loginActions.attemptSso(navigate)}
        >
          {inflight ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg/40 border-t-bg" />
              로그인 중
            </span>
          ) : (
            'SSO로 로그인'
          )}
        </Button>
      </div>
    </div>
  )
}
