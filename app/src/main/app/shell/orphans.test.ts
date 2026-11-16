// 고아 프로세스 선별 (0324 MD-07 · AC29).

import { describe, expect, it, vi } from 'vitest'
import { reapOrphans, selectOrphans, type ProcessInfo } from './orphans'

const HOST = 4200
const proc = (pid: number, parentPid: number): ProcessInfo => ({ pid, parentPid })

describe('selectOrphans', () => {
  it('부모가 죽은 호스트인 프로세스만 고른다 (자식 2 · 무관 1)', () => {
    expect(selectOrphans([proc(10, HOST), proc(11, HOST), proc(12, 1)], HOST)).toEqual([10, 11])
  })

  it('부모가 다른 프로세스는 고르지 않는다', () => {
    expect(selectOrphans([proc(10, HOST + 1), proc(11, 1)], HOST)).toEqual([])
  })

  it('손자는 고르지 않는다 — 자식의 트리 종료가 맡는다', () => {
    expect(selectOrphans([proc(10, HOST), proc(20, 10)], HOST)).toEqual([10])
  })

  it('빈 목록은 빈 결과다', () => {
    expect(selectOrphans([], HOST)).toEqual([])
  })

  it('호스트 자신·0 이하 pid·중복은 대상이 아니다', () => {
    expect(
      selectOrphans(
        [proc(HOST, HOST), proc(0, HOST), proc(-1, HOST), proc(10, HOST), proc(10, HOST)],
        HOST
      )
    ).toEqual([10])
  })

  it.each([0, -1, 1.5, Number.NaN])('호스트 pid 가 %s 이면 아무것도 고르지 않는다', (pid) => {
    expect(selectOrphans([proc(10, pid), proc(11, 0)], pid)).toEqual([])
  })
})

describe('reapOrphans', () => {
  it('고른 프로세스만 끝내고 끝낸 pid 를 돌려준다', async () => {
    const killTree = vi.fn(async () => {})
    const onError = vi.fn()
    const killed = await reapOrphans(
      {
        listProcesses: async () => [proc(10, HOST), proc(11, HOST), proc(12, 1)],
        killTree,
        onError
      },
      HOST
    )
    expect(killTree.mock.calls).toEqual([[10], [11]])
    expect(killed).toEqual([10, 11])
    expect(onError).not.toHaveBeenCalled()
  })

  it('하나를 끝내지 못해도 나머지를 끝내고 던지지 않는다', async () => {
    const failure = new Error('gone')
    const killTree = vi.fn(async (pid: number) => {
      if (pid === 10) throw failure
    })
    const onError = vi.fn()
    const killed = await reapOrphans(
      { listProcesses: async () => [proc(10, HOST), proc(11, HOST)], killTree, onError },
      HOST
    )
    expect(killed).toEqual([11])
    expect(onError.mock.calls).toEqual([['kill', failure, 10]])
  })

  it('프로세스 목록을 얻지 못하면 아무것도 끝내지 않고 던지지 않는다', async () => {
    const failure = new Error('ps failed')
    const killTree = vi.fn(async () => {})
    const onError = vi.fn()
    const killed = await reapOrphans(
      {
        listProcesses: async () => {
          throw failure
        },
        killTree,
        onError
      },
      HOST
    )
    expect(killed).toEqual([])
    expect(killTree).not.toHaveBeenCalled()
    expect(onError.mock.calls).toEqual([['list', failure]])
  })
})
