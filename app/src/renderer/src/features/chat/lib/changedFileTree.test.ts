// 0211 ΔV4 — 변경 파일 트리 (VP-58 · AT-50 · D-084).
//
// 저장소 탐색기가 아니다: 입력은 변경 파일 경로뿐이고 파일 시스템을 읽지 않는다.

import { describe, expect, it } from 'vitest'
import { buildChangedFileTree, visibleTreeRows } from './changedFileTree'

const files = [
  { path: 'docs/handoff/0213-x/plan.md', added: 517, removed: 0 },
  { path: 'docs/handoff/INDEX.md', added: 1, removed: 0 },
  { path: 'README.md', added: 2, removed: 1 }
]

describe('buildChangedFileTree', () => {
  it('경로를 계층으로 접고 자식이 하나뿐인 폴더는 한 줄로 합친다', () => {
    const tree = buildChangedFileTree(files)
    const docs = tree.find((node) => node.kind === 'dir')

    expect(docs).toMatchObject({ kind: 'dir', label: 'docs/handoff', path: 'docs/handoff' })
  })

  it('변경 파일만 담는다 — 목록 밖의 형제 파일은 나타나지 않는다', () => {
    const rows = visibleTreeRows(buildChangedFileTree(files), new Set())
    const paths = rows.flatMap((row) => (row.node.kind === 'file' ? [row.node.path] : []))

    expect(paths.sort()).toEqual(
      ['README.md', 'docs/handoff/0213-x/plan.md', 'docs/handoff/INDEX.md'].sort()
    )
  })

  it('파일 행이 변경량을 함께 갖는다', () => {
    const rows = visibleTreeRows(buildChangedFileTree(files), new Set())
    const plan = rows.find((row) => row.node.kind === 'file' && row.node.label === 'plan.md')

    expect(plan?.node).toMatchObject({ added: 517, removed: 0 })
  })
})

describe('visibleTreeRows', () => {
  it('폴더를 접으면 그 자손이 목록에서 빠진다', () => {
    const tree = buildChangedFileTree(files)
    const open = visibleTreeRows(tree, new Set())
    const closed = visibleTreeRows(tree, new Set(['docs/handoff']))

    expect(open.length).toBeGreaterThan(closed.length)
    expect(closed.some((row) => row.node.kind === 'file' && row.node.label === 'INDEX.md')).toBe(
      false
    )
    // 접힌 폴더 자신은 남아 다시 펼칠 수 있다.
    expect(closed.some((row) => row.node.kind === 'dir')).toBe(true)
  })

  it('깊이가 들여쓰기 축이다', () => {
    const rows = visibleTreeRows(buildChangedFileTree(files), new Set())
    const nested = rows.find((row) => row.node.kind === 'file' && row.node.label === 'plan.md')

    expect(nested?.depth).toBeGreaterThan(0)
  })
})
