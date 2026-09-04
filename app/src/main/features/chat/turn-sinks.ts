// TurnCoordinator(L1 가로축 구동체, 0052)의 협력자 인터페이스. §A 의 "persist ∥ forward 는
// 병렬 독립 sink" + "persist 는 main-side·renderer 비의존" 을 타입으로 고정한다.
//
// 의존 역전(src/main/AGENTS.md): 코디네이터는 L1 이므로 L3 구체 클래스(HistoryWriter·
// TitleGenerator·sendChatEvent)를 import 하지 못한다. 대신 아래 구조적 인터페이스만 받고,
// 컴포지션 루트(ipc/chat/send.ts)가 concrete 를 배선한다. 기존 L3 클래스들은 *무변경* 으로
// 이 인터페이스를 구조적으로 만족한다.
//
// ports.ts 가 아니라 별도 파일인 이유: turn-context.ts 가 ports.ts 를 import 하므로 ports.ts
// 에 TurnContext 를 들이면 import/no-cycle 이 차단한다. sink 들은 TurnContext 를 참조하므로
// 사이클 없는 별도 모듈에 둔다.

import type { AttachmentView, DiffRequirementAnchor, NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'

// 영속 sink — DB 기록(가로축 좌측). renderer 비의존. L3 HistoryWriter 가 만족.
export interface TurnPersistSink<W = unknown> {
  persist(turn: TurnContext<W>, ev: NormalizedEvent): void
  // echo 커밋 단일 경로(0067 AC6) — 턴 프롬프트·프렐류드·steer 배치의 user row 영속 +
  // preview/provider_key 갱신. 구 persistSteerUserMessage 일반화.
  commitUserMessage?(
    turn: TurnContext<W>,
    batch: {
      text: string
      createdAt: number
      attachmentViews?: AttachmentView[]
      requirements?: DiffRequirementAnchor[]
    }
  ): number | null
  // AskUserQuestion tool_result 합성도 영속 책임(persist.ts) — reduce 가 페어링 시 호출.
  flushAskAnswers(turn: TurnContext<W>, owner: W): void
}

// forward sink — renderer 로의 ChatEvent 전송(가로축 우측). electron WebContents 비의존이라
// 단위테스트에서 spy 로 대체 가능. 프로덕션은 sendChatEvent 를 래핑한다.
export interface TurnEventSink<W = unknown> {
  forward(owner: W, ev: NormalizedEvent): void
}
