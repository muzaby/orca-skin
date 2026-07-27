// chatStore 단위 테스트 공용 하네스(0149) — rAF 스텁 + window.orca 스텁 + 스토어 시드.
//
// chatStore.test.ts 와 chatStore.listen.test.ts 가 같은 ~45줄을 복제하고 있었다(후자 파일 주석이
// "동일 하네스" 라고 자인). ChatStoreState 에 필드가 하나 늘 때마다(listening/listenStartedAt 이
// 그랬다) 두 시드가 따로 갱신돼야 해서 드리프트한다.

import { vi } from 'vitest'
import { initialChatState, type ChatState } from '../reducer/chatReducer'
import { useChatStore } from './chatStore'

// 코얼레서가 rAF 로 델타를 배칭한다 — 테스트에선 큐에 모았다가 flushRaf() 로 프레임을 흉내낸다.
// (등록 즉시 실행하는 스텁은 코얼레서의 handle 대입 전에 콜백이 돌아 재예약이 막힌다.)
let rafQueue: FrameRequestCallback[] = []
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
  rafQueue.push(cb)
  return rafQueue.length
})
vi.stubGlobal('cancelAnimationFrame', () => {})

export function flushRaf(): void {
  const q = rafQueue
  rafQueue = []
  for (const cb of q) cb(0)
}

export interface ChatStoreHarness {
  chatSend: ReturnType<typeof vi.fn>
  settingsSet: ReturnType<typeof vi.fn>
  permissionRespond: ReturnType<typeof vi.fn>
}

// beforeEach 에서 호출한다. 활성 키 's' 에 세션 엔트리 1개로 초기화하며, 턴 진행 여부 등
// 테스트별 차이는 sessionOverrides 로 준다(예: { inflight: true, turnStartedAt: 1 }).
export function installChatStoreHarness(
  sessionOverrides: Partial<ChatState> = {}
): ChatStoreHarness {
  rafQueue = []
  const chatSend = vi.fn().mockResolvedValue(undefined)
  const settingsSet = vi.fn().mockResolvedValue({})
  const permissionRespond = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('window', {
    orca: {
      chat: {
        send: chatSend,
        cancel: vi.fn(),
        cancelSteer: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn()
      },
      settings: { set: settingsSet },
      permission: { respond: permissionRespond, setMode: vi.fn() }
    }
  })
  useChatStore.setState(
    {
      sessions: {
        s: {
          session: { ...initialChatState, sessionId: 's', ...sessionOverrides },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: 's',
      pendingNewChatKey: null,
      newChatQueue: [],
      recentsEpoch: 0,
      concurrencyByProjectId: {},
      draftRestore: null
    },
    true
  )
  return { chatSend, settingsSet, permissionRespond }
}

// 활성 세션의 커밋 슬라이스 — 두 스위트가 같은 접근자를 쓴다.
export function harnessSession(): ChatState {
  return useChatStore.getState().sessions.s.session
}
