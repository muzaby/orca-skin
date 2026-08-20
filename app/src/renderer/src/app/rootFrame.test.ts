import { describe, expect, it } from 'vitest'
import type { ProviderGateState } from '../../../shared/ipc'
import { rootFrame } from './rootFrame'

const gate = (patch?: Partial<ProviderGateState>): ProviderGateState => ({
  required: true,
  passed: true,
  bypassed: false,
  ...patch
})

describe('rootFrame', () => {
  it('부팅 실패가 게이트보다 먼저다 — main 이 죽었으면 로그인할 상대가 없다', () => {
    expect(rootFrame({ bootPhase: 'failed', gate: gate(), resuming: false })).toBe('boot-failure')
    // 게이트 미판정이어도 실패가 이긴다.
    expect(rootFrame({ bootPhase: 'failed', gate: null, resuming: true })).toBe('boot-failure')
  })

  it('게이트 미판정이면 통과시키지 않는다 — fail-closed', () => {
    // main 이 잠깐 응답하지 못하는 사이 로그인 강제 빌드가 무인증으로 열리면 안 된다.
    expect(rootFrame({ bootPhase: 'ready', gate: null, resuming: false })).toBe('waiting')
  })

  it('부팅이 끝나지 않았으면 대기한다', () => {
    expect(rootFrame({ bootPhase: 'loading', gate: gate(), resuming: false })).toBe('waiting')
  })

  it('게이트를 통과하지 못했으면 로그인 화면이다', () => {
    expect(rootFrame({ bootPhase: 'ready', gate: gate({ passed: false }), resuming: false })).toBe(
      'gate'
    )
  })

  // 0194 의 요구: 복원은 대기 화면이 떠 있는 동안 돌아야 한다. 여기서 'app' 을 내주면 나머지
  // Auth 의 재로그인 창이 **메인 UI 뒤에서** 뜬다.
  it('복원이 진행 중이면 통과 후에도 대기한다', () => {
    expect(rootFrame({ bootPhase: 'ready', gate: gate(), resuming: true })).toBe('waiting')
  })

  it('통과했고 복원이 끝났으면 메인 UI 다', () => {
    expect(rootFrame({ bootPhase: 'ready', gate: gate(), resuming: false })).toBe('app')
  })

  it('우회로 통과한 경우도 복원이 끝나면 들어간다', () => {
    const bypassed = gate({ bypassed: true })
    expect(rootFrame({ bootPhase: 'ready', gate: bypassed, resuming: false })).toBe('app')
  })
})
