// 참조 경로가 **`chat:send` 페이로드까지 실제로 나가는지** — AC10.
//
// 리듀서만 잠그면 상태는 옳은데 페이로드에 안 실리는 배선 회귀를 못 잡는다. 여기서는
// window.orca.chat.send 가 받은 인자를 본다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatActions, useChatStore, NEW_CHAT_KEY } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { initialChatState } from '../reducer/chatReducer'

let chatSend: ReturnType<typeof installChatStoreHarness>['chatSend']

beforeEach(() => {
  ;({ chatSend } = installChatStoreHarness())
  useChatStore.setState(
    {
      sessions: {
        [NEW_CHAT_KEY]: {
          session: { ...initialChatState, cwd: '/repo' },
          live: { text: '', reasoning: '' },
          subagentMeta: {}
        }
      },
      activeKey: NEW_CHAT_KEY,
      pendingNewChatKey: null,
      newChatQueue: [],
      recentsEpoch: 0,
      concurrencyByProjectId: {},
      draftRestore: null
    },
    true
  )
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => 'x' as `${string}-${string}-${string}-${string}-${string}`
  )
})

function sentPayload(): Record<string, unknown> {
  return chatSend.mock.calls[0]?.[0] as Record<string, unknown>
}

describe('chatStore — extraDirs 가 chat:send 페이로드로 나간다 (AC10)', () => {
  it('칩으로 추가한 참조 경로가 배열로 실린다', () => {
    chatActions.addExtraDir('/refs/a')
    chatActions.addExtraDir('/refs/b')

    expect(chatActions.send('안녕')).toBe(true)
    expect(sentPayload().extraDirs).toEqual(['/refs/a', '/refs/b'])
  })

  it('제거한 경로는 실리지 않는다', () => {
    chatActions.addExtraDir('/refs/a')
    chatActions.addExtraDir('/refs/b')
    chatActions.removeExtraDir('/refs/a')

    chatActions.send('안녕')
    expect(sentPayload().extraDirs).toEqual(['/refs/b'])
  })

  it('0개면 키 자체가 없다 — 빈 배열과 미지정을 DB 가 같은 NULL 로 접으므로 키를 만들지 않는다', () => {
    chatActions.send('안녕')

    expect(sentPayload()).not.toHaveProperty('extraDirs')
  })

  it('페이로드 배열은 스토어 상태의 사본이다 — 이후 칩 조작이 전송분을 바꾸지 않는다', () => {
    chatActions.addExtraDir('/refs/a')
    chatActions.send('안녕')
    const sent = sentPayload().extraDirs as string[]

    chatActions.addExtraDir('/refs/late')

    expect(sent).toEqual(['/refs/a'])
  })
})
