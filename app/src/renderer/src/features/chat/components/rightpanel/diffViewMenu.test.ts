// 0211 ΔV5 — `⋮` 메뉴의 항목과 체크 축 (VP-68 · AT-67 · D-106).
//
// **집합 동등으로 센다.** 항목을 하나씩 확인하면 하나를 지운 변이가 나머지 여섯으로 통과한다
// (AT-35 와 같은 축) — 배열 자체를 비교해야 누락과 순서 변경이 함께 red 다.
//
// ΔV4 의 여덟에서 `새로고침` 이 빠졌다 — D-099 가 수동 계기를 없앴다.

import { describe, expect, it } from 'vitest'
import { DEFAULT_DIFF_VIEW, type DiffViewOptions } from '../../reducer/chatReducer'
import { DIFF_VIEW_MENU_ITEMS, diffViewMenuChecked } from './diffViewMenuItems'

describe('메뉴 항목 목록', () => {
  it('일곱 항목이 그 순서 그대로다 — `새로고침` 이 없다', () => {
    expect(DIFF_VIEW_MENU_ITEMS.map((item) => item.id)).toEqual([
      'files',
      'collapse-all',
      'expand-all',
      'side-by-side',
      'wrap',
      'highlight',
      'whitespace'
    ])
  })

  it('Git 조작 항목이 없다 — 읽기 전용 review surface 다 (제안서 §18)', () => {
    const labels = DIFF_VIEW_MENU_ITEMS.map((item) => item.labelKey).join(' ')

    for (const forbidden of ['Stage', 'Commit', 'Push', 'Pull', 'Merge', 'Rebase'])
      expect(labels).not.toContain(forbidden)
  })

  it('체크가 붙는 항목은 켬/끔 상태를 가진 다섯뿐이다', () => {
    expect(DIFF_VIEW_MENU_ITEMS.filter((item) => item.checkable).map((item) => item.id)).toEqual([
      'files',
      'side-by-side',
      'wrap',
      'highlight',
      'whitespace'
    ])
  })
})

describe('체크 상태 파생', () => {
  const item = (id: string): (typeof DIFF_VIEW_MENU_ITEMS)[number] =>
    DIFF_VIEW_MENU_ITEMS.find((entry) => entry.id === id)!

  it('기본값은 자동 줄 바꿈·단어 강조 둘만 켜져 있다 (D-086)', () => {
    const on = DIFF_VIEW_MENU_ITEMS.filter((entry) =>
      diffViewMenuChecked(entry, DEFAULT_DIFF_VIEW, false)
    ).map((entry) => entry.id)

    expect(on).toEqual(['wrap', 'highlight'])
  })

  it('나란히는 레이아웃 유니온을 본다 — boolean 이 아니다', () => {
    const side: DiffViewOptions = { ...DEFAULT_DIFF_VIEW, layout: 'side-by-side' }

    expect(diffViewMenuChecked(item('side-by-side'), side, false)).toBe(true)
    expect(diffViewMenuChecked(item('side-by-side'), DEFAULT_DIFF_VIEW, false)).toBe(false)
  })

  it('파일 표시는 사이드바 상태를 본다 — 표시 옵션 넷과 다른 축이다', () => {
    expect(diffViewMenuChecked(item('files'), DEFAULT_DIFF_VIEW, true)).toBe(true)
    expect(diffViewMenuChecked(item('files'), DEFAULT_DIFF_VIEW, false)).toBe(false)
  })

  it('공백 변경 숨기기는 기본이 꺼짐이다', () => {
    expect(diffViewMenuChecked(item('whitespace'), DEFAULT_DIFF_VIEW, false)).toBe(false)
    expect(
      diffViewMenuChecked(
        item('whitespace'),
        { ...DEFAULT_DIFF_VIEW, ignoreWhitespace: true },
        false
      )
    ).toBe(true)
  })
})
