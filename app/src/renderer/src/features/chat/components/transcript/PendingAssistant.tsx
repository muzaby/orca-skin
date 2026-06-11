import { StreamingMarkdown } from '../markdown/StreamingMarkdown'
import { ReasoningBlock } from './ReasoningBlock'
import { StatusLine } from '../../../../shared/ui/StatusLine'
import { useChatSession, useLiveReasoning, useLiveText } from '../../store/chatStore'

// 진행 중 턴의 라이브 표면 — 셸은 정적이고, 스트림 종류별 리프가 store 의 live 슬라이스를
// 직접 구독해 델타 프레임의 재렌더를 자기 자신으로 한정한다 (0008):
//   · text 델타      → LiveText(꼬리 블록만 재파스) + LiveStatus(토큰 근사)
//   · reasoning 델타 → LiveReasoning (본문 Markdown 은 깨어나지 않음)
// transcript(커밋 메시지)·Composer·셸은 어느 델타에도 재렌더되지 않는다.
export function PendingAssistant(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
      <LiveReasoning />
      <LiveText />
      <LiveStatus />
    </div>
  )
}

function LiveReasoning(): React.JSX.Element | null {
  const reasoning = useLiveReasoning()
  if (reasoning === '') return null
  return <ReasoningBlock items={[{ text: reasoning }]} defaultOpen />
}

function LiveText(): React.JSX.Element | null {
  const text = useLiveText()
  if (text === '') return null
  return <StreamingMarkdown source={text} />
}

function LiveStatus(): React.JSX.Element {
  const turnStartedAt = useChatSession((s) => s.turnStartedAt)
  const text = useLiveText()
  return <StatusLine turnStartedAt={turnStartedAt} outputApproxFromText={text} />
}
