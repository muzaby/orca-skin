import { describe, expect, it } from 'vitest'
import {
  addTileColumnMajor,
  columnsContain,
  deriveRightPanelLayout,
  flattenColumns,
  removeTileFromColumns,
  ROWS_PER_COL,
  type RightPanelColumns
} from './rightPanelLayout'
import type { RightPanelTileId } from './rightPanelTiles'

// 열 id 는 비결정적(randomUUID)이라 입력은 고정 id 로 만들고, 비교는 tiles 만 본다.
const mk = (...groups: RightPanelTileId[][]): RightPanelColumns =>
  groups.map((tiles, i) => ({ id: `c${i}`, tiles }))
const tilesOf = (cols: RightPanelColumns): RightPanelTileId[][] => cols.map((c) => c.tiles)

describe('rightPanel 열 구조 헬퍼', () => {
  it('addTileColumnMajor — column-major 로 채우고 중복은 무시', () => {
    expect(ROWS_PER_COL).toBe(2)
    let cols: RightPanelColumns = []
    cols = addTileColumnMajor(cols, 'plan')
    expect(tilesOf(cols)).toEqual([['plan']])
    cols = addTileColumnMajor(cols, 'task')
    expect(tilesOf(cols)).toEqual([['plan', 'task']])
    cols = addTileColumnMajor(cols, 'reserved1')
    expect(tilesOf(cols)).toEqual([['plan', 'task'], ['reserved1']])
    cols = addTileColumnMajor(cols, 'subagent')
    expect(tilesOf(cols)).toEqual([
      ['plan', 'task'],
      ['reserved1', 'subagent']
    ])
    // 중복 추가는 무변경(참조 동일)
    expect(addTileColumnMajor(cols, 'plan')).toBe(cols)
  })

  it('addTileColumnMajor — 새 열은 안정 id 를 받고 기존 열 id 는 보존', () => {
    const first = addTileColumnMajor([], 'plan')
    const second = addTileColumnMajor(first, 'task') // 같은 열에 append
    expect(second[0].id).toBe(first[0].id)
    const third = addTileColumnMajor(second, 'reserved1') // 새 열
    expect(third[0].id).toBe(first[0].id)
    expect(third[1].id).not.toBe(third[0].id)
  })

  it('removeTileFromColumns — 같은 열 안에서만 제거하고 다른 열은 id 까지 불변', () => {
    // 사용자 사례: 0열[plan,subagent] / 1열[reserved1] 에서 subagent 제거
    const input = mk(['plan', 'task'], ['reserved1'])
    const { columns, removedCol } = removeTileFromColumns(input, 'task')
    expect(tilesOf(columns)).toEqual([['plan'], ['reserved1']])
    expect(removedCol).toBeNull()
    expect(columns[0].id).toBe(input[0].id)
    expect(columns[1].id).toBe(input[1].id) // 우측 열 id 보존 → React remount 없음
  })

  it('removeTileFromColumns — 열이 비면 그 열을 드롭하고 인덱스를 알린다', () => {
    const { columns, removedCol } = removeTileFromColumns(mk(['plan'], ['reserved1']), 'plan')
    expect(tilesOf(columns)).toEqual([['reserved1']])
    expect(removedCol).toBe(0)
    // 없는 타일은 무변경(참조 동일)
    const cols = mk(['plan'])
    expect(removeTileFromColumns(cols, 'task').columns).toBe(cols)
  })

  it('flattenColumns / columnsContain', () => {
    const cols = mk(['plan', 'task'], ['reserved1'])
    expect(flattenColumns(cols)).toEqual(['plan', 'task', 'reserved1'])
    expect(columnsContain(cols, 'reserved1')).toBe(true)
    expect(columnsContain(cols, 'subagent')).toBe(false)
  })

  it('deriveRightPanelLayout — 열/핸들을 열 구조에서 파생(빈 열 필터, id 전달)', () => {
    expect(deriveRightPanelLayout([]).columns).toEqual([])
    expect(deriveRightPanelLayout([]).handles).toEqual([])

    const derived = deriveRightPanelLayout(mk(['plan', 'task'], ['reserved1']))
    expect(derived.columns).toEqual([
      { col: 0, id: 'c0', tiles: ['plan', 'task'] },
      { col: 1, id: 'c1', tiles: ['reserved1'] }
    ])

    expect(deriveRightPanelLayout(mk(['plan'])).handles).toEqual([
      { kind: 'outer', axis: 'vertical' }
    ])
    expect(deriveRightPanelLayout(mk(['plan', 'task'])).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'row', axis: 'horizontal', col: 0 }
    ])
    expect(deriveRightPanelLayout(mk(['plan', 'task'], ['reserved1'])).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'column', axis: 'vertical', col: 1 },
      { kind: 'row', axis: 'horizontal', col: 0 }
    ])
    expect(deriveRightPanelLayout(mk(['plan', 'task'], ['reserved1', 'subagent'])).handles).toEqual(
      [
        { kind: 'outer', axis: 'vertical' },
        { kind: 'column', axis: 'vertical', col: 1 },
        { kind: 'row', axis: 'horizontal', col: 0 },
        { kind: 'row', axis: 'horizontal', col: 1 }
      ]
    )
  })
})
