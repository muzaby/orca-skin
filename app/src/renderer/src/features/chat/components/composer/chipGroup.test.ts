// 0211 ΔV4 r3 — 브랜치 + 워크트리를 **테두리 하나**가 감싸는 묶음 (참조 컴포저).
//
// 이 스위트가 잠그는 것은 두 축이다.
// ① 외형 SSOT — 묶음 안 칩은 자기 테두리·반경·높이를 갖지 않는다. 하나라도 남기면 테두리가
//    두 겹이 되거나(안쪽 1px + 바깥 1px) 형제 outlined 칩보다 2px 커진다.
// ② 구분선의 주인이 앞 칩임을 확인한다. 두 컨트롤의 묶음 귀속·segment 외형과
//    미확인 시 묶음 전체 숨김은 CwdPanel.visibility.test.ts의 실제 렌더에서 확인한다.
//
// ②는 렌더 단언이 아니라 호출부 스윕이다 — 이 저장소에는 렌더 하네스가 없다(vitest node 환경,
// `CwdPanel.landing.test.ts` 와 같은 형태).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { chipGroupDivider, chipGroupSurface, chipSurface } from './chipSurface'

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const CWD_PANEL = read('../CwdPanel.tsx')
const BRANCH_CHIP = read('./BranchChip.tsx')

describe('묶음 외형 (chipSurface)', () => {
  it('낱개 칩은 자기 높이·반경·테두리를 그대로 갖는다 — 회귀 짝', () => {
    for (const variant of ['flat', 'outlined'] as const) {
      const surface = chipSurface(variant)
      expect(surface, variant).toMatch(/\bh-7\b/)
      expect(surface, variant).toMatch(/\brounded-r4\b/)
      expect(surface, variant).toMatch(/\bborder\b/)
    }
    expect(chipSurface('outlined')).toMatch(/\bborder-border\b/)
    expect(chipSurface('flat')).toMatch(/\bborder-transparent\b/)
  })

  it('묶음 칩은 높이·반경·테두리를 갖지 않는다 — 묶음이 하나로 갖는다', () => {
    const surface = chipSurface('segment')
    expect(surface).not.toMatch(/\bh-7\b/)
    expect(surface).not.toMatch(/\brounded-/)
    expect(surface).not.toMatch(/\bborder\b/)
    // 대신 묶음 안쪽을 그대로 채운다 — 클릭 영역이 묶음 높이와 어긋나지 않는다.
    expect(surface).toMatch(/\bself-stretch\b/)
  })

  it('눌린 묶음 칩도 테두리를 만들지 않는다 — 눌림은 채움과 글자색이 말한다', () => {
    const pressed = chipSurface('segment', false, true)
    expect(pressed).not.toMatch(/\bborder\b/)
    expect(pressed).toMatch(/\btext-accent\b/)
  })

  it('묶음이 테두리·반경·높이를 **하나씩만** 갖는다', () => {
    // 두께 유틸리티(`border`)만 센다 — `\bborder\b` 는 `border-border` 안에서도 맞아 3 이 된다.
    expect(chipGroupSurface.match(/(?:^|\s)border(?=\s|$)/g)).toHaveLength(1)
    expect(chipGroupSurface).toMatch(/\bborder-border\b/)
    expect(chipGroupSurface).toMatch(/\brounded-r4\b/)
    // 형제 outlined 칩과 같은 높이다 — `border-box` 라 테두리를 포함한다.
    expect(chipGroupSurface).toMatch(/\bh-7\b/)
    // hover 채움을 묶음 반경으로 자른다 — 없으면 모서리에 네모난 자국이 남는다.
    expect(chipGroupSurface).toMatch(/\boverflow-hidden\b/)
  })

  it('구분선은 폭 1px 의 실선이다 — 버튼이 둘로 읽히게 하는 유일한 표시', () => {
    expect(chipGroupDivider).toMatch(/\bw-px\b/)
    expect(chipGroupDivider).toMatch(/\bbg-border\b/)
    expect(chipGroupDivider).toMatch(/\bself-stretch\b/)
  })
})

describe('묶음 배선 (CwdPanel)', () => {
  it('구분선의 주인은 앞 칩이다 — 묶음이 그리면 브랜치 칩이 사라졌을 때 줄만 남는다', () => {
    expect(CWD_PANEL).toMatch(/trailingDivider/)
    // 묶음 컨테이너 자신은 줄을 그리지 않는다.
    expect(CWD_PANEL).not.toMatch(/chipGroupDivider/)
    // 그리고 그 칩이 실제로 조건부로 그린다 — 무조건 그리면 예외 상황이 다시 열린다.
    expect(BRANCH_CHIP).toMatch(/\{trailingDivider && <span[^>]*className=\{chipGroupDivider\}/)
  })
})
