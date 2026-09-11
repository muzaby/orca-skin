import { describe, expect, it } from 'vitest'
import { NEW_CHAT_KEY, useChatStore } from './chatStore'

// 0228 D-002 — 시드 이전 모듈 초기 상태를 본다. 같은 파일의 다른 케이스가 랜딩 캐시를 먼저
// 건드리면 "첫 실행 고정값"이 아니라 그 케이스의 잔재를 재는 것이라, 이 단언만 따로 둔다.
describe('랜딩 종류 첫 실행 고정값', () => {
  it('시드 전 새-채팅 초안은 work 다', () => {
    expect(useChatStore.getState().sessions[NEW_CHAT_KEY].session.agentKind).toBe('work')
  })
})
