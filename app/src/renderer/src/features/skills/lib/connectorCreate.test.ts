import { describe, expect, it, vi } from 'vitest'
import { handleCreated, pickCreatedConnector } from './connectorCreate'

const A = { connectorId: 'confluence-a' }
const B = { connectorId: 'confluence-b' }

describe('pickCreatedConnector', () => {
  it('이전 목록에 없던 커넥터를 새것으로 고른다', () => {
    expect(pickCreatedConnector([A], [A, B])).toEqual(B)
  })

  it('빈 목록에서 처음 만든 것도 고른다', () => {
    expect(pickCreatedConnector([], [A])).toEqual(A)
  })

  // 0162 회귀: origin 문자열 동등 비교로 찾다가 main 의 정규화와 어긋나면 못 찾았다.
  // 차집합은 ID 로만 판정하므로 주소 표기와 무관하다.
  it('주소 표기가 달라도 ID 로 찾는다', () => {
    const before = [{ connectorId: 'confluence-a', origin: 'https://a.corp' }]
    const after = [
      { connectorId: 'confluence-a', origin: 'https://a.corp' },
      { connectorId: 'confluence-b', origin: 'HTTPS://B.CORP/' }
    ]
    expect(pickCreatedConnector(before, after)?.connectorId).toBe('confluence-b')
  })

  it('새것이 없으면 null 이다', () => {
    expect(pickCreatedConnector([A], [A])).toBeNull()
  })
})

describe('handleCreated', () => {
  it('생성 응답을 받으면 항상 갱신을 부른다', () => {
    const refresh = vi.fn()
    handleCreated({ before: [A], after: [A, B], refresh, connect: vi.fn() })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('갱신을 인증보다 먼저 부른다', () => {
    const calls: string[] = []
    handleCreated({
      before: [],
      after: [A],
      refresh: () => calls.push('refresh'),
      connect: () => calls.push('connect')
    })
    expect(calls).toEqual(['refresh', 'connect'])
  })

  it('새로 생긴 커넥터로 인증을 잇는다', () => {
    const connect = vi.fn()
    handleCreated({ before: [A], after: [A, B], refresh: vi.fn(), connect })
    expect(connect).toHaveBeenCalledWith(B)
  })

  // 사용자 보고("추가 시 실제 추가로 이어지지 않고있다")의 직접 원인 — 특정에 실패하면
  // 갱신까지 건너뛰어 화면이 그대로였다. 이제 갱신은 무조건이고 인증만 건너뛴다.
  it('새것을 못 찾아도 갱신은 한다', () => {
    const refresh = vi.fn()
    const connect = vi.fn()
    const created = handleCreated({ before: [A], after: [A], refresh, connect })
    expect(created).toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(connect).not.toHaveBeenCalled()
  })
})
