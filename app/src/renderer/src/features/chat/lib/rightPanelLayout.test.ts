import { describe, expect, it } from 'vitest'
import { deriveRightPanelLayout, ROWS_PER_COL } from './rightPanelLayout'
import type { RightPanelTileId } from './rightPanelTiles'

describe('deriveRightPanelLayout', () => {
  it('한 열당 2행 상수로 column-major 레이아웃을 파생', () => {
    expect(ROWS_PER_COL).toBe(2)
    expect(deriveRightPanelLayout(['plan']).columns.map((c) => c.tiles)).toEqual([['plan']])
    expect(deriveRightPanelLayout(['plan', 'subagent']).columns.map((c) => c.tiles)).toEqual([
      ['plan', 'subagent']
    ])
    expect(
      deriveRightPanelLayout(['plan', 'subagent', 'reserved1']).columns.map((c) => c.tiles)
    ).toEqual([['plan', 'subagent'], ['reserved1']])
    expect(
      deriveRightPanelLayout(['plan', 'subagent', 'reserved1', 'reserved2']).columns.map(
        (c) => c.tiles
      )
    ).toEqual([
      ['plan', 'subagent'],
      ['reserved1', 'reserved2']
    ])
  })

  it('핸들 목록을 활성 배치에서 파생', () => {
    expect(deriveRightPanelLayout([]).handles).toEqual([])
    expect(deriveRightPanelLayout(['plan']).handles).toEqual([{ kind: 'outer', axis: 'vertical' }])
    expect(deriveRightPanelLayout(['plan', 'subagent']).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'row', axis: 'horizontal', col: 0 }
    ])
    expect(deriveRightPanelLayout(['plan', 'subagent', 'reserved1']).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'column', axis: 'vertical', col: 1 },
      { kind: 'row', axis: 'horizontal', col: 0 }
    ])
    expect(deriveRightPanelLayout(['plan', 'subagent', 'reserved1', 'reserved2']).handles).toEqual([
      { kind: 'outer', axis: 'vertical' },
      { kind: 'column', axis: 'vertical', col: 1 },
      { kind: 'row', axis: 'horizontal', col: 0 },
      { kind: 'row', axis: 'horizontal', col: 1 }
    ])
  })

  it('레지스트리 밖의 테스트 입력도 열 수를 하드코딩하지 않고 파생', () => {
    const synthetic = ['plan', 'subagent', 'reserved1', 'reserved2', 'plan'] as RightPanelTileId[]
    expect(deriveRightPanelLayout(synthetic).columns.map((c) => c.tiles)).toEqual([
      ['plan', 'subagent'],
      ['reserved1', 'reserved2'],
      ['plan']
    ])
  })
})
