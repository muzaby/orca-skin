import { Button } from '../../../../shared/ui/Button'
import { CopyIconButton } from '../../../../shared/ui/CopyIconButton'
import { formatTimeFull, formatTimeShort } from '../../format'
import { chatActions, useChatSession } from '../../store/chatStore'

interface MessageMetaProps {
  text: string
  createdAt: number
  align: 'left' | 'right'
  // 에이전트 턴에만 true — 분기(fork) 아이콘 노출(0064). 물질화된 세션에서만 실제 렌더된다.
  forkable?: boolean
}

export function MessageMeta({
  text,
  createdAt,
  align,
  forkable = false
}: MessageMetaProps): React.JSX.Element {
  // fork 는 확정 세션에서만 — 미전송 draft/새 채팅(sessionId=null)이나 로딩 중엔 숨긴다.
  const canFork = useChatSession((s) => s.sessionId != null && !s.loadingSession)
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-t6 opacity-0 transition-opacity duration-200 group-hover/msg:opacity-100 focus-within:opacity-100 ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {text && <CopyIconButton text={text} />}
      {forkable && canFork && (
        <Button
          iconOnly
          variant="uncontained"
          size="small"
          leadingIcon="fork"
          onClick={() => chatActions.startForkDraft()}
          title="여기서 분기"
          aria-label="여기서 분기"
        />
      )}
      <span className="font-mono text-caption tabular-nums" title={formatTimeFull(createdAt)}>
        {formatTimeShort(createdAt)}
      </span>
    </div>
  )
}
