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

describe('rightPanel 열 구조 헬퍼', () => {
  it('addTileColumnMajor — column-major 로 채우고 중복은 무시', () => {
    expect(ROWS_PER_COL).toBe(2)
    let cols: RightPanelColumns = []
    cols = addTileColumnMajor(cols, 'plan')
    expect(cols).toEqual([['plan']])
    cols = addTileColumnMajor(cols, 'subagent')
    expect(cols).toEqual([['plan', 'subagent']])
    cols = addTileColumnMajor(cols, 'reserved1')
    expect(cols).toEqual([['plan', 'subagent'], ['reserved1']])
    cols = addTileColumnMajor(cols, 'reserved2')
    expect(cols).toEqual([
      ['plan', 'subagent'],
      ['reserved1', 'reserved2']
    ])
    // 중복 추가는 무변경(참조 동일)
    expect(addTileColumnMajor(cols, 'plan')).toBe(cols)
  })

  it('removeTileFromColumns — 같은 열 안에서만 제거하고 다른 열은 불변(리플로우 없음)', () => {
    // 사용자 사례: 0열[plan,subagent] / 1열[reserved1] 에서 subagent 제거
    expect(removeTileFromColumns([['plan', 'subagent'], ['reserved1']], 'subagent')).toEqual({
      columns: [['plan'], ['reserved1']],
      removedCol: null
    })
  })

  it('removeTileFromColumns — 열이 비면 그 열을 드롭하고 인덱스를 알린다', () => {
    expect(removeTileFromColumns([['plan'], ['reserved1']], 'plan')).toEqual({
      columns: [['reserved1']],
      removedCol: 0
    })
    // 없는 타일은 무변경(참조 동일)
    const cols: RightPanelColumns = [['plan']]
    expect(removeTileFromColumns(cols, 'subagent').columns).toBe(cols)
  })

  it('flattenColumns / columnsContain', () => {
    const cols: RightPanelColumns = [['plan', 'subagent'], ['reserved1']]
    expect(flattenColumns(cols)).toEqual(['plan', 'subagent', 'reserved1'])
    expect(columnsContain(cols, 'reserved1')).toBe(true)
    expect(columnsContain(cols, 'reserved2')).toBe(false)
  })

  it('deriveRightPanelLayout — 열/핸들을 열 구조에서 파생(빈 열 필터)', () => {
    expect(deriveRightPanelLayout([]).columns).toEqual([])
    expect(deriveRightPanelLayout([]).handles).toEqual([])

    expect(deriveRightPanelLayout([['plan']]).handles).toEqual([
      { kind: 'outer', axis: 'vertical' }
    ])
    expect(deriveRightPanelLayout([['plan', 'subagent']]).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'row', axis: 'horizontal', col: 0 }
    ])
    expect(deriveRightPanelLayout([['plan', 'subagent'], ['reserved1']]).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'column', axis: 'vertical', col: 1 },
      { kind: 'row', axis: 'horizontal', col: 0 }
    ])
    expect(
      deriveRightPanelLayout([
        ['plan', 'subagent'],
        ['reserved1', 'reserved2']
      ]).handles
    ).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'column', axis: 'vertical', col: 1 },
      { kind: 'row', axis: 'horizontal', col: 0 },
      { kind: 'row', axis: 'horizontal', col: 1 }
    ])
  })
})
