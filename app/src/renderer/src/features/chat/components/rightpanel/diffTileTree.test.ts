import { describe, expect, it } from 'vitest'
import { FIXTURE_TREE } from './diffTileFixtures.testlib'
import { visibleTreeRows } from './diffTileTree'

const keys = (collapsed: string[]): string[] =>
  visibleTreeRows(FIXTURE_TREE, new Set(collapsed)).map((r) => r.key)

describe('트리 접힘 파생 (AT-16)', () => {
  it('아무것도 접지 않으면 전건이 보인다 — 양성 기준선', () => {
    expect(keys([])).toEqual(FIXTURE_TREE.map((r) => r.key))
  })

  it('디렉토리를 접으면 그 하위만 사라지고 형제 최상위는 남는다', () => {
    const visible = keys(['docs'])
    expect(visible).toContain('docs')
    expect(visible.filter((k) => k.startsWith('docs/'))).toEqual([])
    // 형제 최상위와 그 하위는 그대로다 — 접힘이 아래로만 번진다.
    expect(visible).toContain('src/renderer/src/features/sample')
    expect(visible).toContain('src/renderer/src/features/sample/components/SampleView.tsx')
  })

  it('중간 깊이를 접으면 그 아래만 사라진다 — 더 얕은 형제는 남는다', () => {
    const visible = keys(['src/renderer/src/features/sample/components'])
    expect(visible).toContain('src/renderer/src/features/sample/components')
    expect(visible).not.toContain('src/renderer/src/features/sample/components/SampleView.tsx')
    expect(visible).toContain('src/renderer/src/features/sample/lib')
    expect(visible).toContain('src/renderer/src/features/sample/lib/sampleState.ts')
  })

  it('바깥을 접으면 안쪽 접힘 여부와 무관하게 전부 사라진다', () => {
    const visible = keys(['src/renderer/src/features/sample'])
    expect(visible.filter((k) => k.startsWith('src/renderer/src/features/sample/'))).toEqual([])
    expect(visible).toContain('docs/SAMPLE.md')
  })
})
