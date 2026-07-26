// 0149 — 백그라운드 런치 영수증 술어를 shared 로 올리며 이관한 테스트(구 background-tasks.test
// 의 isAsyncLaunchResult 블록). main tracker · renderer parts 가 같은 판별을 쓰므로 여기서 고정한다.

import { describe, expect, it } from 'vitest'
import { isAsyncLaunchedPayload } from './subagent'

describe('isAsyncLaunchedPayload (0136 → 0149 shared)', () => {
  it('async_launched 상태 객체를 인식한다', () => {
    expect(isAsyncLaunchedPayload({ status: 'async_launched', agentId: 'a1' })).toBe(true)
  })

  it('완료/실패/원시값은 false', () => {
    expect(isAsyncLaunchedPayload({ status: 'completed' })).toBe(false)
    expect(isAsyncLaunchedPayload('최종 보고')).toBe(false)
    expect(isAsyncLaunchedPayload(null)).toBe(false)
    expect(isAsyncLaunchedPayload(undefined)).toBe(false)
  })

  it('배열은 plain object 가 아니므로 false (isRecord 재사용)', () => {
    expect(isAsyncLaunchedPayload([{ status: 'async_launched' }])).toBe(false)
  })
})
