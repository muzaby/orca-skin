// 배선 가드 (0229) — 실행 전 편집 미리보기가 **어댑터 이벤트 경로에 실제로 꽂혀 있는지** 본다.
//
// `buildEditPreview` 자체는 `edit-preview.test.ts` 가 전수로 잠근다. 그러나 `claude.ts` 는
// electron 을 import 해 vitest 가 직접 열 수 없어서, 그 순수 함수를 **부르는 줄**을 지워도 모든
// 테스트와 typecheck 가 초록이었다(구현 중 실측). 단위만 잠그고 배선을 놓치면 기능이 통째로
// 죽은 채 게이트가 통과한다.
//
// 이 테스트는 **소스를 문자열로 읽기만 한다** — `no-node-fetch.test.ts` 와 같은 방식이다.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(__dirname, 'claude.ts'), 'utf8')

/** started 이벤트 분기에서 미리보기를 만들어 이벤트에 싣는 배선. */
const WIRED = /tool\.call\.started'[\s\S]{0,400}?buildEditPreview\([\s\S]{0,400}?editPreview:/

describe('편집 미리보기 배선 (0229)', () => {
  it('claude.ts 가 미리보기 생성기와 실제 reader 를 들여온다', () => {
    expect(source).toContain('buildEditPreview')
    expect(source).toContain('nodeEditPreviewReader')
    expect(source).toContain('resolveGuardRoots')
  })

  it('started 이벤트 분기가 미리보기를 만들어 editPreview 로 싣는다', () => {
    expect(WIRED.test(source), 'claude.ts 의 tool.call.started 분기가 배선을 잃었다').toBe(true)
  })

  // 가드 자신의 감도 — 배선이 없는 소스에서는 반드시 실패해야 한다. 이게 없으면 정규식이
  // 아무것도 못 잡는 상태로 "통과" 할 수 있다(측정력 0인 위생 테스트가 가장 나쁘다).
  it('배선이 빠진 소스는 잡고 이름만 스친 소스는 통과시키지 않는다', () => {
    const wired = `if (event.type === 'tool.call.started') {
      const hunks = buildEditPreview(event.toolName, event.args, previewRoots, readForPreview)
      return [hunks ? { ...event, editPreview: { structuredPatch: hunks } } : event]
    }`
    expect(WIRED.test(wired)).toBe(true)
    expect(WIRED.test(wired.replace('buildEditPreview', 'noop'))).toBe(false)
    expect(WIRED.test(wired.replace('editPreview:', 'other:'))).toBe(false)
    expect(WIRED.test('const x = buildEditPreview(); const y = { editPreview: 1 }')).toBe(false)
  })
})
