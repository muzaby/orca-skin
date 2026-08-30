// 0211 VP-16 · VP-14 — 파일 목록 → 평탄 트리 파생과 요약 상태 3분기.

import { describe, expect, it } from 'vitest'
import { buildDiffTreeRows, diffSummaryState, splitFilePath } from './diffTileData'
import type { GitDiffFileEntry } from '../../../../../../shared/ipc'

const file = (path: string, added = 1, removed = 0): GitDiffFileEntry => ({
  path,
  status: 'modified',
  added,
  removed,
  binary: false
})

describe('평탄 트리 파생 (VP-16)', () => {
  it('디렉토리와 파일이 depth 를 갖고 나온다', () => {
    const rows = buildDiffTreeRows([file('src/a.ts'), file('src/b.ts')])
    expect(rows.map((r) => [r.kind, r.key, r.depth])).toEqual([
      ['dir', 'src', 0],
      ['file', 'src/a.ts', 1],
      ['file', 'src/b.ts', 1]
    ])
  })

  it('단독 디렉토리 사슬은 한 노드로 압축된다 — 자식 하나짜리 줄로 트리가 차지 않게', () => {
    const rows = buildDiffTreeRows([file('a/b/c/d.ts'), file('a/b/c/e.ts')])
    expect(rows[0]).toMatchObject({ kind: 'dir', key: 'a/b/c', depth: 0 })
    expect(rows.slice(1).map((r) => r.key)).toEqual(['a/b/c/d.ts', 'a/b/c/e.ts'])
  })

  it('디렉토리가 파일보다 먼저 오고 각각 이름순이다 — git 순서가 아니라 찾는 순서다', () => {
    const rows = buildDiffTreeRows([file('z.ts'), file('a.ts'), file('m/x.ts')])
    expect(rows.map((r) => r.key)).toEqual(['m', 'm/x.ts', 'a.ts', 'z.ts'])
  })

  it('파일 행이 변경량을 싣는다', () => {
    const rows = buildDiffTreeRows([file('a.ts', 7, 2)])
    expect(rows[0]).toMatchObject({ kind: 'file', added: 7, removed: 2 })
  })

  it('빈 목록은 빈 트리다', () => {
    expect(buildDiffTreeRows([])).toEqual([])
  })
})

describe('파일 경로 분해', () => {
  it('이름과 디렉토리를 가른다', () => {
    expect(splitFilePath('src/a/b.ts')).toEqual({ name: 'b.ts', dir: 'src/a' })
  })

  it('루트 파일은 디렉토리가 빈 문자열이다', () => {
    expect(splitFilePath('README.md')).toEqual({ name: 'README.md', dir: '' })
  })
})

describe('요약 상태 3분기 (VP-14)', () => {
  it('요약 전은 loading 이다 — "변경 없음" 과 섞지 않는다', () => {
    expect(diffSummaryState(null)).toEqual({ kind: 'loading' })
  })

  it('저장소가 아니면 not-repo 다', () => {
    expect(diffSummaryState({ isRepo: false, files: [] })).toEqual({ kind: 'not-repo' })
  })

  it('저장소인데 파일이 0건이면 empty 다', () => {
    expect(diffSummaryState({ isRepo: true, files: [] })).toEqual({ kind: 'empty' })
  })

  it('파일이 있으면 ready 다', () => {
    expect(diffSummaryState({ isRepo: true, files: [file('a.ts')] })).toEqual({ kind: 'ready' })
  })
})
