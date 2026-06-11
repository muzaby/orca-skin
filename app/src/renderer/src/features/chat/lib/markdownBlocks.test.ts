import { describe, it, expect } from 'vitest'
import { splitStableBlocks } from './markdownBlocks'

describe('splitStableBlocks', () => {
  it('문단 사이 빈 줄에서 확정 블록을 자르고 마지막 블록은 꼬리로 남긴다', () => {
    const { stable, tail } = splitStableBlocks('첫 문단.\n\n둘째 문단.\n\n셋째 줄.\n작성 중')
    expect(stable).toEqual(['첫 문단.', '둘째 문단.'])
    expect(tail).toBe('셋째 줄.\n작성 중')
  })

  it('경계 없는 단일 문단은 전부 꼬리', () => {
    const { stable, tail } = splitStableBlocks('아직 한 문단')
    expect(stable).toEqual([])
    expect(tail).toBe('아직 한 문단')
  })

  it('펜스 코드블록 내부의 빈 줄에서는 자르지 않는다 (미닫힘 펜스 포함)', () => {
    const closed = splitStableBlocks(
      '소개.\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\n끝.\n\n남은 줄.\nx'
    )
    expect(closed.stable).toEqual(['소개.', '```ts\nconst a = 1\n\nconst b = 2\n```', '끝.'])
    expect(closed.tail).toBe('남은 줄.\nx')

    const open = splitStableBlocks('소개.\n\n```ts\nconst a = 1\n\n아직 펜스 안')
    expect(open.stable).toEqual(['소개.'])
    expect(open.tail).toBe('```ts\nconst a = 1\n\n아직 펜스 안')
  })

  it('loose list(항목 사이 빈 줄)는 자르지 않는다 — ol 번호/마진 보존', () => {
    const { stable, tail } = splitStableBlocks('1. one\n\n2. two\n\n3. three 작성중')
    expect(stable).toEqual([])
    expect(tail).toBe('1. one\n\n2. two\n\n3. three 작성중')
  })

  it('문단 → 리스트 경계도 자르지 않는다 (리스트는 꼬리에 붙어 자란다)', () => {
    const { stable, tail } = splitStableBlocks('머리말.\n\n- a\n- b\n진행')
    expect(stable).toEqual([])
    expect(tail).toBe('머리말.\n\n- a\n- b\n진행')
  })

  it('들여쓰기 코드블록 경계는 자르지 않는다', () => {
    const { stable } = splitStableBlocks(
      '설명.\n\n    indented code\n\n다음 문단.\n\n완결 줄.\n꼬리'
    )
    // 설명↔코드, 코드↔다음 문단 둘 다 보호 — "다음 문단." 뒤 경계만 유효.
    expect(stable).toEqual(['설명.\n\n    indented code\n\n다음 문단.'])
  })

  it('경계 뒤에 완결된 비공백 줄이 없으면 미확정(꼬리 유지) — append 로 뒤집히지 않는 경계만 확정', () => {
    // 빈 줄 다음에 아직 미종결(개행 없는) 텍스트만 있는 상태.
    const partial = splitStableBlocks('문단.\n\n다음 시작')
    expect(partial.stable).toEqual([])
    expect(partial.tail).toBe('문단.\n\n다음 시작')

    // 같은 소스가 자라 다음 줄이 완결되면 그때 확정 — 기존 확정 블록 집합은 불변(append-stable).
    const grown = splitStableBlocks('문단.\n\n다음 시작 완결.\n그리고')
    expect(grown.stable).toEqual(['문단.'])
    expect(grown.tail).toBe('다음 시작 완결.\n그리고')
  })

  it('stable 블록 문자열은 소스가 자라도 불변(prefix 결정적) — memo 영구 적중 보장', () => {
    const a = '첫.\n\n둘째.\n\n셋째 진행'
    const b = a + ' 중이고\n\n넷째 줄.\n\n다섯'
    const sa = splitStableBlocks(a)
    const sb = splitStableBlocks(b)
    expect(sb.stable.slice(0, sa.stable.length)).toEqual(sa.stable)
  })
})
