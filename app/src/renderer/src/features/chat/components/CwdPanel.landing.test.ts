// 작업 컨텍스트 행은 **랜딩에서만** 뜬다 (AC16 · D-009).
//
// cwd·브랜치·참조 경로 셋은 세션 출생 시 고정되는 값이라 편집 가능한 창이 랜딩뿐이다. 세션이
// 붙은 뒤에도 이 행이 뜨면 사용자는 바꿀 수 없는 값을 바꿀 수 있는 것처럼 본다.
//
// **이것은 렌더 단언이 아니라 호출부 스윕이다.** 이 저장소에는 렌더 테스트 하네스가 없어
// (`@testing-library` 0건 · vitest 는 node 환경) DOM 부재를 직접 볼 수 없다. 대신 그 결과를
// 만드는 두 조건 — 기본값이 false 이고, 켜는 호출부가 랜딩 페이지뿐 — 을 소스에서 확인한다.
// 렌더 하네스가 도입되면 이 스윕은 실제 렌더 단언으로 교체한다.

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

  it('CwdPanel 렌더는 그 플래그 뒤에만 있다', () => {
    const renders = [...COMPOSER.matchAll(/<CwdPanel\b/g)]
    expect(renders).toHaveLength(1)
    expect(COMPOSER).toMatch(/\{showLandingCwdPanel && <CwdPanel\b/)
  })

  it('플래그를 켜는 호출부는 랜딩 페이지 둘뿐이다', () => {
    for (const [name, source] of Object.entries(PAGES)) {
      expect(source, `${name} 가 플래그를 켜지 않는다`).toMatch(/showLandingCwdPanel/)
    }
  })

  it('세션 뷰(ChatTile)는 플래그를 넘기지 않는다 — 세션이 붙으면 행이 없다', () => {
    expect(CHAT_TILE).toMatch(/<Composer\b/)
    expect(CHAT_TILE).not.toMatch(/showLandingCwdPanel/)
  })

  it('행 자신도 랜딩 표식을 달고 있다 — DOM 마커로도 구분된다', () => {
    expect(read('./CwdPanel.tsx')).toMatch(/data-state="landing"/)
  })
})
