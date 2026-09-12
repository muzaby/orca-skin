import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { childMessageForParentToolRunId, subagentTasksFromMessages } from '../../lib/parts'
import { useChatSession, useSubagentMeta } from '../../store/chatStore'
import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'

type DetailComponent = typeof import('../rightpanel/SubAgentTileContent').SubAgentTaskDetail

// 하위 대화는 같은 transcript renderer를 재사용하므로, 명시적 펼침 이후에만 구현을 읽는다.
// 정적 모듈 초기화 순환과 접힌 행의 불필요한 상세 구독을 함께 피한다.
export function InlineSubagentDetail({
  toolRunId,
  transcriptPolicy,
  framed = true
}: {
  toolRunId: string
  transcriptPolicy: AgentTranscriptPresentation
  framed?: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const [Detail, setDetail] = useState<DetailComponent | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const messages = useChatSession((s) => s.messages)
  const task = useMemo(
    () => subagentTasksFromMessages(messages, true).find((item) => item.toolUseId === toolRunId),
    [messages, toolRunId]
  )
  const childMessage = useMemo(
    () => childMessageForParentToolRunId(messages, toolRunId),
    [messages, toolRunId]
  )
  const meta = useSubagentMeta(toolRunId)
  useEffect(() => {
    let current = true
    void import('../rightpanel/SubAgentTileContent').then(
      (module) => {
        if (current) setDetail(() => module.SubAgentTaskDetail)
      },
      () => {
        if (current) setFailed(true)
      }
    )
    return () => {
      current = false
    }
  }, [attempt])

  return (
    <div
      className={`my-2 min-h-0${framed ? ' rounded-r5 border border-border bg-panel' : ''}`}
      data-subagent-inline={toolRunId}
    >
      {Detail && task ? (
        <Detail
          task={task}
          childMessage={childMessage}
          startedAtMs={meta?.startedAtMs ?? null}
          transcriptPolicy={transcriptPolicy}
        />
      ) : failed ? (
        <div className="flex items-center gap-2 p-3 text-footnote text-bad" role="alert">
          <span>{tr('chat.subagentTile.loadDetailFailed')}</span>
          <Button
            size="small"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            {tr('chat.subagentTile.retryDetail')}
          </Button>
        </div>
      ) : (
        <p className="p-3 text-footnote text-t6" role="status">
          {tr(Detail ? 'chat.subagentTile.noChildActivity' : 'chat.subagentTile.loadingDetail')}
        </p>
      )}
    </div>
  )
}
