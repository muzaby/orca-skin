// 브랜치 칩 판정부 — AC1(칩 부재 · detached 라벨) · AC8(실패 사유 노출) · AC9(부분 실패 문구).

import { describe, expect, it } from 'vitest'
import type { GitCheckoutResult, GitDirtyStat, GitStatus } from '../../../../../../shared/ipc'
import {
  APPLIED_NOTICE_KEY,
  branchChipView,
  checkoutOutcome,
  statusForCwd
} from './branchChipState'

const repo = (over: Partial<GitStatus> = {}): GitStatus => ({
  isRepo: true,
  branch: 'main',
  detached: false,
  dirty: null,
  ...over
})

const STAT: GitDirtyStat = { files: 2, insertions: 3, deletions: 1 }

describe('branchChipView — 저장소가 아니면 칩을 그리지 않는다 (AC1)', () => {
  it('isRepo:false 면 렌더하지 않는다 — 누를 것이 없는 버튼을 자리만 잡지 않는다', () => {
    expect(branchChipView('/repo', repo({ isRepo: false, branch: null }))).toEqual({
      visible: false
    })
  })

  it('작업 경로가 없거나 상태를 아직 못 받았으면 렌더하지 않는다', () => {
    expect(branchChipView(null, repo())).toEqual({ visible: false })
    expect(branchChipView('/repo', null)).toEqual({ visible: false })
  })

  it('detached HEAD 면 branch=null 로 그린다 — 칩은 detached 라벨을 읽는다', () => {
    expect(branchChipView('/repo', repo({ branch: null, detached: true }))).toEqual({
      visible: true,
      branch: null
    })
  })

  it('정상 저장소면 브랜치 이름을 준다', () => {
    expect(branchChipView('/repo', repo({ branch: 'feature' }))).toEqual({
      visible: true,
      branch: 'feature'
    })
  })
})

describe('statusForCwd — 늦게 도착한 응답은 새 경로를 덮지 않는다', () => {
  it('스냅샷의 경로가 현재 cwd 와 다르면 버린다', () => {
    const stale = { cwd: '/old', status: repo({ branch: 'old-branch' }) }

    expect(statusForCwd('/new', stale)).toBeNull()
    expect(statusForCwd('/old', stale)).toBe(stale.status)
  })

  it('둘 다 null 인 초기 상태에서도 성립한다', () => {
    expect(statusForCwd(null, { cwd: null, status: null })).toBeNull()
  })
})

describe('checkoutOutcome — 실패는 조용히 삼켜지지 않는다 (AC8)', () => {
  it('성공이면 switched 다', () => {
    expect(checkoutOutcome({ ok: true, branch: 'feature' }, 'feature')).toEqual({
      kind: 'switched'
    })
  })

  it('dirty 면 모달에 필요한 값을 그대로 넘긴다', () => {
    const result: GitCheckoutResult = { ok: false, reason: 'dirty', from: 'main', stat: STAT }

    expect(checkoutOutcome(result, 'feature')).toEqual({
      kind: 'ask',
      prompt: { target: 'feature', from: 'main', stat: STAT }
    })
  })

  it('error 면 사유 문구가 화면 상태로 올라간다', () => {
    const result: GitCheckoutResult = { ok: false, reason: 'error', message: 'boom' }

    expect(checkoutOutcome(result, 'feature')).toEqual({ kind: 'failed', message: 'boom' })
  })

  it('not-repo 도 사유를 남긴다 — 아무 일도 안 일어난 것처럼 보이지 않는다', () => {
    const result: GitCheckoutResult = {
      ok: false,
      reason: 'not-repo',
      message: 'git 저장소가 아닙니다.'
    }

    expect(checkoutOutcome(result, 'feature')).toMatchObject({ kind: 'failed' })
  })
})

describe('checkoutOutcome — 부분 실패는 적용된 해소를 식별한다 (AC9)', () => {
  it.each(['stash', 'commit-wip', 'discard'] as const)('%s 가 결과에 실려 온다', (applied) => {
    const result: GitCheckoutResult = { ok: false, reason: 'error', message: 'boom', applied }

    expect(checkoutOutcome(result, 'feature')).toEqual({
      kind: 'failed',
      message: 'boom',
      applied
    })
  })

  it('applied 가 없으면 키를 만들지 않는다', () => {
    const outcome = checkoutOutcome({ ok: false, reason: 'error', message: 'boom' }, 'feature')

    expect(outcome).not.toHaveProperty('applied')
  })

  it('해소 3종 전부에 서로 다른 안내 문구 키가 있다', () => {
    const keys = Object.values(APPLIED_NOTICE_KEY)

    expect(keys).toHaveLength(3)
    expect(new Set(keys).size).toBe(3)
  })
})
