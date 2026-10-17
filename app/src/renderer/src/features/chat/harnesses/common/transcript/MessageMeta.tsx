import { Button } from '../../../../../shared/ui/Button'
import { CopyIconButton } from '../../../../../shared/ui/CopyIconButton'
import { formatTimeFull, formatTimeShort, useI18n } from '../../../../../shared/i18n'
import { chatActions, useChatSession } from '../../../store/chatStore'
import { useTranscriptRuntime } from './TranscriptRuntime'

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
  const { appearance, canFork: supportsFork } = useTranscriptRuntime()
  const { tr, locale } = useI18n()
  return (
    <div
      className={`mt-1 flex items-center gap-1 ${appearance.meta} ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {text && <CopyIconButton text={text} />}
      {forkable && canFork && supportsFork && (
        <Button
          iconOnly
          variant="uncontained"
          size="small"
          leadingIcon="fork"
          onClick={() => chatActions.startForkDraft()}
          title={tr('chat.transcript.forkHere')}
          aria-label={tr('chat.transcript.forkHere')}
        />
      )}
      <span
        className="font-mono text-caption tabular-nums"
        title={formatTimeFull(createdAt, locale)}
      >
        {formatTimeShort(createdAt, locale)}
      </span>
    </div>
  )
}
