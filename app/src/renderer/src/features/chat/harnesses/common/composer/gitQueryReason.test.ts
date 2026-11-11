// 0211 ΔV6 AT-71 — git 조회 계기의 **배선**과 요약 키 (D-115 · §10 EP-46).
//
// 계기 판정 자체(첫 조회·cwd 변경·세션 전환·턴 종료·수동·변화 없음)는 `planGitSnapshotQuery` 가
// 갖고 `gitSnapshotPlan.test.ts` 가 값으로 잰다. 여기서는 훅이 옛 계기(`busy`)를 읽지 않고
// 단일 effect 가 계기 입력을 모두 보는지를 소스에서 센다 — 배선의 존재만 보고 실행 순서는 보지 않는다.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gitSnapshotTriggerKey } from './useGitSnapshot'

describe('계기의 배선 (AT-71 · §10 EP-46)', () => {
  const source = readFileSync(new URL('./useGitSnapshot.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('`sessionBusy` 를 읽지 않는다 — 옛 계기가 파일에서 사라졌다', () => {
    expect(source).not.toContain('sessionBusy')
    expect(source).not.toContain('busy')
  })

  it('단일 effect 가 tick·refreshTick·상태 키·요약 키를 모두 본다', () => {
    expect(source.match(/useEffect\(/g)).toHaveLength(1)
    expect(source).toContain('[cwd, sessionId, owner, tick, refreshTick, statusKey, summaryKey]')
  })

  it('요약 키는 cwd 가 다르면 다르다', () => {
    expect(gitSnapshotTriggerKey('/repo-a', 's')).not.toBe(gitSnapshotTriggerKey('/repo-b', 's'))
  })
})
