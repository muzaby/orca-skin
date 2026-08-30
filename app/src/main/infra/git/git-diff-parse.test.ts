// 0211 VP-15 · VP-09(정규화 절) — 파서와 상한 절단.
//
// 상한은 **값으로 나가야** 한다: 조용히 자르면 사용자가 diff 를 전부 본 것으로 읽는다.
// 그래서 경계값(200/201·100/101)을 양쪽에서 본다 — `truncated:false` 쪽이 없으면
// 항상 true 를 돌려주는 구현도 통과한다.

import { describe, expect, it } from 'vitest'
import {
  MAX_DIFF_COMMITS,
  MAX_DIFF_FILES,
  mergeDiffEntries,
  parseCommitLog,
  parseNameStatusZ,
  parseNulPaths,
  parseNumstatZ
} from './git-diff-parse'
import type { GitDiffFileEntry } from '../../../shared/ipc'

const entry = (path: string, added = 1, removed = 0): GitDiffFileEntry => ({
  path,
  status: 'modified',
  added,
  removed,
  binary: false
})

describe('numstat -z 파싱', () => {
  it('일반 변경 행을 읽는다', () => {
    const out = '12\t3\tsrc/a.ts\x004\t1\tsrc/b.ts\x00'
    expect(parseNumstatZ(out)).toEqual([
      { path: 'src/a.ts', status: 'modified', added: 12, removed: 3, binary: false },
      { path: 'src/b.ts', status: 'modified', added: 4, removed: 1, binary: false }
    ])
  })

  it('binary 는 숫자 대신 `-` 라 0/0 + binary 로 접힌다', () => {
    expect(parseNumstatZ('-\t-\tassets/logo.png\x00')).toEqual([
      { path: 'assets/logo.png', status: 'modified', added: 0, removed: 0, binary: true }
    ])
  })

  it('rename 은 경로 자리가 비고 두 경로가 뒤따른다 — 새 경로를 쓴다', () => {
    const out = '2\t1\t\x00src/old.ts\x00src/new.ts\x00'
    expect(parseNumstatZ(out)).toEqual([
      { path: 'src/new.ts', status: 'renamed', added: 2, removed: 1, binary: false }
    ])
  })

  it('공백·한글이 든 경로가 깨지지 않는다 — `-z` 라 인용되지 않는다', () => {
    expect(parseNumstatZ('1\t0\tdocs/한글 문서.md\x00')[0].path).toBe('docs/한글 문서.md')
  })
})

describe('name-status -z 파싱', () => {
  it('추가·삭제·수정을 구분한다', () => {
    const map = parseNameStatusZ('A\x00new.ts\x00D\x00gone.ts\x00M\x00edit.ts\x00')
    expect(map.get('new.ts')).toBe('added')
    expect(map.get('gone.ts')).toBe('deleted')
    expect(map.get('edit.ts')).toBe('modified')
  })

  it('rename 은 유사도 숫자가 붙고 경로가 둘이다 — 새 경로에 표시한다', () => {
    const map = parseNameStatusZ('R100\x00old.ts\x00new.ts\x00')
    expect(map.get('new.ts')).toBe('renamed')
    expect(map.has('old.ts')).toBe(false)
  })
})

describe('커밋 로그 파싱', () => {
  const record = (sha: string, subject: string): string =>
    `${sha}\x1f${subject}\x1fcodex\x1f1756500000\x1e`

  it('레코드를 읽고 초를 ms 로 올린다', () => {
    const { commits, truncated } = parseCommitLog(record('abc123', 'feat: 붙인다'))
    expect(truncated).toBe(false)
    expect(commits).toEqual([
      { sha: 'abc123', subject: 'feat: 붙인다', author: 'codex', committedAt: 1756500000000 }
    ])
  })

  it('제목에 든 개행·탭·파이프가 목록을 어긋내지 않는다 — 구분자가 `\\x1f`/`\\x1e` 다', () => {
    const { commits } = parseCommitLog(record('abc123', 'fix: a|b\tc 를 고친다'))
    expect(commits).toHaveLength(1)
    expect(commits[0].subject).toBe('fix: a|b\tc 를 고친다')
  })

  it(`${MAX_DIFF_COMMITS}건까지는 자르지 않는다 — 음성 짝`, () => {
    const out = Array.from({ length: MAX_DIFF_COMMITS }, (_, i) => record(`s${i}`, 't')).join('')
    const { commits, truncated } = parseCommitLog(out)
    expect(commits).toHaveLength(MAX_DIFF_COMMITS)
    expect(truncated).toBe(false)
  })

  it(`${MAX_DIFF_COMMITS + 1}건이면 자르고 잘렸다고 말한다`, () => {
    const out = Array.from({ length: MAX_DIFF_COMMITS + 1 }, (_, i) => record(`s${i}`, 't')).join(
      ''
    )
    const { commits, truncated } = parseCommitLog(out)
    expect(commits).toHaveLength(MAX_DIFF_COMMITS)
    expect(truncated).toBe(true)
  })
})

describe('미추적 병합과 파일 상한 (VP-15)', () => {
  it('미추적 파일이 전량 추가로 목록에 들어온다 (D-011)', () => {
    const { files } = mergeDiffEntries(
      [entry('src/a.ts', 2, 1)],
      [{ path: 'src/new.ts', added: 7, binary: false }]
    )
    expect(files).toEqual([
      { path: 'src/a.ts', status: 'modified', added: 2, removed: 1, binary: false },
      { path: 'src/new.ts', status: 'added', added: 7, removed: 0, binary: false }
    ])
  })

  it('추적 목록에 이미 있는 경로는 중복으로 넣지 않는다 — 줄 수를 가진 쪽이 남는다', () => {
    const { files } = mergeDiffEntries(
      [entry('src/a.ts', 2, 1)],
      [{ path: 'src/a.ts', added: 999, binary: false }]
    )
    expect(files).toHaveLength(1)
    expect(files[0].added).toBe(2)
  })

  it(`${MAX_DIFF_FILES}건까지는 자르지 않는다 — 음성 짝`, () => {
    const tracked = Array.from({ length: MAX_DIFF_FILES }, (_, i) => entry(`f${i}.ts`))
    const { files, truncated } = mergeDiffEntries(tracked, [])
    expect(files).toHaveLength(MAX_DIFF_FILES)
    expect(truncated).toBe(false)
  })

  it(`${MAX_DIFF_FILES + 1}건이면 자르고 잘렸다고 말한다`, () => {
    const tracked = Array.from({ length: MAX_DIFF_FILES + 1 }, (_, i) => entry(`f${i}.ts`))
    const { files, truncated } = mergeDiffEntries(tracked, [])
    expect(files).toHaveLength(MAX_DIFF_FILES)
    expect(truncated).toBe(true)
  })
})

describe('NUL 경로 목록', () => {
  it('빈 조각을 버린다 — 마지막 NUL 뒤가 빈 항목이 되지 않는다', () => {
    expect(parseNulPaths('a.ts\x00b.ts\x00')).toEqual(['a.ts', 'b.ts'])
    expect(parseNulPaths('')).toEqual([])
  })
})
