// 0231 VP-206 · VP-207 (R-103 · AR-102 ↔ AT-105·AT-106 · §10 EP-203)
//
// 트래커의 세기를 쓰는 소비자는 **둘이고 서로 다른 질문에 답한다**:
//   · 배지(`session-activity-projector`) = "사용자에게 백그라운드 N건이라 말할 수 있는가"
//     → 런치 영수증을 본 것만.
//   · 턴-후 루프(`app/chat-turn/post-turn.ts` → `decidePostTurnStep`) = "세션이 더 기다려야
//     하는가" → foreground 태스크를 포함한 **전량**.
//
// 이 파일의 존재 이유는 **두 값이 갈린다**는 것 하나다. 한 값만 단언하면 두 소비자를 같은 세기로
// 합친 변이(형제 맞바꿈)가 통과하고, 그 변이는 foreground 태스크가 도는 중에 세션이 대기를
// 끊는 0136 회귀다.

import { describe, expect, it } from 'vitest'
import type { ChatActivitySnapshot } from '../../../shared/ipc'
import { BackgroundTaskTracker } from './background-tasks'
import { PendingMessageQueue } from './pending-message-queue'
import { SessionActivityProjector } from './session-activity-projector'
import { decidePostTurnStep } from './post-turn'

const S = 'sess-1'

function projectorFixture(background: BackgroundTaskTracker): {
  emitted: ChatActivitySnapshot[]
  projector: SessionActivityProjector
} {
  const emitted: ChatActivitySnapshot[] = []
  const projector = new SessionActivityProjector({
    queue: new PendingMessageQueue(),
    backgroundTasks: background,
    leases: { foreground: () => 'idle', subscribe: () => () => {} },
    emit: (snapshot) => emitted.push(snapshot)
  })
  return { emitted, projector }
}

const latestCount = (emitted: ChatActivitySnapshot[]): number | undefined =>
  emitted.at(-1)?.backgroundTaskCount

// 프로젝터는 방출을 microtask 로 모은다(`queueMicrotask` · flushScheduled).
const flush = async (): Promise<void> => {
  await Promise.resolve()
}

describe('0231 EP-203 — 배지 세기와 대기 세기는 다른 질문이다', () => {
  it('AT-105 — foreground 만 추적 중이면 배지는 0이다', async () => {
    const background = new BackgroundTaskTracker()
    const { emitted, projector } = projectorFixture(background)
    background.started(S, 'fg-1')
    projector.setTransport(S, 'listening')
    await flush()
    expect(latestCount(emitted)).toBe(0)
    projector.dispose()
  })

  it('AT-106 — 같은 상태에서 턴-후 루프는 여전히 기다린다', () => {
    const background = new BackgroundTaskTracker()
    background.started(S, 'fg-1')
    // 루프의 입력은 `count()` 다 — 이 값이 배지와 함께 좁아지면 대기가 끊긴다.
    expect(background.count(S)).toBe(1)
    expect(
      decidePostTurnStep({
        havePending: false,
        haveTasks: background.count(S) > 0,
        channelAlive: true,
        channelBusy: false,
        hasBacklog: false,
        haveUnconfirmed: false
      })
    ).toBe('listen')
  })

  it('**두 값이 갈린다** — 영수증 하나를 관측하면 배지만 오른다', async () => {
    const background = new BackgroundTaskTracker()
    const { emitted, projector } = projectorFixture(background)
    background.started(S, 'fg-1')
    background.started(S, 'bg-1')
    background.markAsyncLaunched(S, 'bg-1')
    projector.setTransport(S, 'listening')
    await flush()
    expect(background.count(S)).toBe(2)
    expect(background.launchedCount(S)).toBe(1)
    expect(latestCount(emitted)).toBe(1)
    projector.dispose()
  })

  it('정착하면 배지에서 빠진다', async () => {
    const background = new BackgroundTaskTracker()
    const { emitted, projector } = projectorFixture(background)
    background.started(S, 'bg-1')
    background.markAsyncLaunched(S, 'bg-1')
    projector.setTransport(S, 'listening')
    await flush()
    expect(latestCount(emitted)).toBe(1)
    background.settled(S, 'bg-1')
    await flush()
    expect(latestCount(emitted)).toBe(0)
    projector.dispose()
  })
})
