// 작업 컨텍스트 행은 **랜딩에서만** 뜬다 (AC16 · D-009).
//
// cwd·브랜치·참조 경로 셋은 세션 출생 시 고정되는 값이라 편집 가능한 창이 랜딩뿐이다. 세션이
// 붙은 뒤에도 이 행이 뜨면 사용자는 바꿀 수 없는 값을 바꿀 수 있는 것처럼 본다.
//
// 기본값과 호출부 범위는 정적 스윕이다. 실제 하네스별 앞/뒤 배치·전환·첫 송신 후 제거는
// NewChatLandingPage.harness.test.ts에서 production 페이지/컴포저 렌더로 확인한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const COMPOSER = read('./Composer.tsx')
const PAGES = {
  'NewChatLandingPage.tsx': read('../../../pages/NewChatLandingPage.tsx'),
  'ProjectLandingPage.tsx': read('../../../pages/ProjectLandingPage.tsx')
}
const CHAT_TILE = read('./ChatTile.tsx')

describe('CwdPanel — 랜딩 전용 (AC16)', () => {
  it('Composer 의 showLandingCwdPanel 기본값이 false 다', () => {
    expect(COMPOSER).toMatch(/showLandingCwdPanel\s*=\s*false/)
  })

  it('새 대화의 Landing 중계와 프로젝트 랜딩에서만 플래그를 켠다', () => {
    expect(PAGES['NewChatLandingPage.tsx']).toMatch(/if \(isEmpty\)[\s\S]*?<Landing\b/)
    expect(read('./Landing.tsx')).toMatch(
      /<Composer\s+\{\.\.\.composerProps\}\s+showLandingCwdPanel\s+\{\.\.\.presentation\.composer\}/
    )
    // 뒤쪽 spread가 플래그를 꺼버리는 경로도 잠근다.
    for (const harness of ['claude', 'opencode']) {
      expect(read(`../harnesses/${harness}/landing/presentation.ts`)).not.toMatch(
        /showLandingCwdPanel/
      )
    }
    expect(PAGES['ProjectLandingPage.tsx']).toMatch(
      /<Composer\b(?:(?!\/>).)*\bshowLandingCwdPanel/s
    )
  })

  it('세션 뷰(ChatTile)는 플래그를 넘기지 않는다 — 세션이 붙으면 행이 없다', () => {
    expect(CHAT_TILE).toMatch(/<Composer\b/)
    expect(CHAT_TILE).not.toMatch(/showLandingCwdPanel/)
  })

  it('행 자신도 랜딩 표식을 달고 있다 — DOM 마커로도 구분된다', () => {
    expect(read('./CwdPanel.tsx')).toMatch(/data-state="landing"/)
  })
})
