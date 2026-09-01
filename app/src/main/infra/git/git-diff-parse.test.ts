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
  const record = (sha: string, subject: string, body = ''): string =>
    `\x00orca-commit\x00${sha}\x00${subject}\x00codex\x001756500000\x00${body}\x00`

  it('메타데이터 폴백은 본문을 보존하고 파일 값을 unavailable로 표현한다', () => {
    const { commits, truncated } = parseCommitLog(record('abc123', 'feat: 붙인다'))
    expect(truncated).toBe(false)
    expect(commits).toEqual([
      {
        sha: 'abc123',
        subject: 'feat: 붙인다',
        author: 'codex',
        committedAt: 1756500000000,
        files: [],
        filesTruncated: false,
        fileCount: null,
        totals: null
      }
    ])

    const withBody = parseCommitLog(record('def456', 'fix: 고친다', '실제 본문\n둘째 줄'))
      .commits[0]
    expect(withBody.body).toBe('실제 본문\n둘째 줄')
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

describe('raw + numstat 커밋 파싱 (VP-31 · EP-17)', () => {
  const header = (sha: string, subject: string, body = ''): string =>
    `\x00orca-commit\x00${sha}\x00${subject}\x00tester\x001756500000\x00${body}\x00\x00`

  it('두 커밋의 본문·순서를 유지하고 M/A/D/R/C·binary·NUL 경로를 함께 해석한다', () => {
    const first =
      header('newer', 'newer subject', '설명 \n둘째') +
      ':100644 100644 aaaaaaa bbbbbbb M\0strange\n name.ts\0' +
      ':000000 100644 0000000 ccccccc A\0added.ts\0' +
      ':100644 000000 ddddddd 0000000 D\0deleted.ts\0' +
      ':100644 100644 eeeeeee fffffff R100\0old.ts\0renamed.ts\0' +
      ':100644 100644 1111111 2222222 C100\0source.ts\0copied.ts\0' +
      ':100644 100644 3333333 4444444 M\0asset.bin\0' +
      '2\t1\tstrange\n name.ts\0' +
      '3\t0\tadded.ts\0' +
      '0\t4\tdeleted.ts\0' +
      '5\t6\t\0old.ts\0renamed.ts\0' +
      '7\t8\t\0source.ts\0copied.ts\0' +
      '-\t-\tasset.bin\0'
    const second =
      header('older', 'older subject') +
      ':100644 100644 5555555 6666666 M\0only-old.ts\0' +
      '1\t0\tonly-old.ts\0'

    const parsed = parseCommitLog(first + second, true)

    expect(parsed.commits.map((commit) => commit.sha)).toEqual(['newer', 'older'])
    expect(parsed.commits[0]).toMatchObject({
      body: '설명 \n둘째',
      fileCount: 6,
      totals: { added: 17, removed: 19 },
      filesTruncated: false
    })
    expect(parsed.commits[0].files).toEqual([
      { path: 'strange\n name.ts', status: 'modified', added: 2, removed: 1, binary: false },
      { path: 'added.ts', status: 'added', added: 3, removed: 0, binary: false },
      { path: 'deleted.ts', status: 'deleted', added: 0, removed: 4, binary: false },
      { path: 'renamed.ts', status: 'renamed', added: 5, removed: 6, binary: false },
      { path: 'copied.ts', status: 'renamed', added: 7, removed: 8, binary: false },
      { path: 'asset.bin', status: 'modified', added: 0, removed: 0, binary: true }
    ])
    expect(parsed.commits[1]).not.toHaveProperty('body')
    expect(parsed.commits[1]).toMatchObject({
      fileCount: 1,
      totals: { added: 1, removed: 0 },
      filesTruncated: false
    })
    expect(parsed.commits[1].files.map((file) => file.path)).toEqual(['only-old.ts'])
  })

  it('루트의 orca-commit 경로를 다음 commit header로 오인하지 않는다', () => {
    const output =
      header('root-path', 'root path') +
      ':000000 100644 0000000 aaaaaaa A\0orca-commit\0' +
      '2\t1\torca-commit\0'

    expect(parseCommitLog(output, true).commits).toEqual([
      expect.objectContaining({
        sha: 'root-path',
        fileCount: 1,
        totals: { added: 2, removed: 1 },
        files: [{ path: 'orca-commit', status: 'added', added: 2, removed: 1, binary: false }]
      })
    ])
  })

  it('50/51 경계에서 목록만 자르고 fileCount·totals는 절단 전 값을 유지한다', () => {
    const output = (count: number): string => {
      const raw = Array.from(
        { length: count },
        (_, i) => `:100644 100644 aaaaaaa bbbbbbb M\0f${i}.ts\0`
      ).join('')
      const numstat = Array.from({ length: count }, (_, i) => `${i + 1}\t1\tf${i}.ts\0`).join('')
      return header(`sha-${count}`, `files ${count}`) + raw + numstat
    }

    const fifty = parseCommitLog(output(50), true).commits[0]
    expect(fifty.files).toHaveLength(50)
    expect(fifty.filesTruncated).toBe(false)
    expect(fifty.fileCount).toBe(50)
    expect(fifty.totals).toEqual({ added: 1275, removed: 50 })

    const fiftyOne = parseCommitLog(output(51), true).commits[0]
    expect(fiftyOne.files).toHaveLength(50)
    expect(fiftyOne.filesTruncated).toBe(true)
    expect(fiftyOne.fileCount).toBe(51)
    expect(fiftyOne.totals).toEqual({ added: 1326, removed: 51 })
  })

  it('실제 0과 파일 데이터 unavailable의 null을 다른 상태로 보존한다', () => {
    const observedZero = parseCommitLog(header('zero', 'empty tree'), true).commits[0]
    const unavailable = parseCommitLog(
      `\x00orca-commit\x00fallback\x00metadata only\x00tester\x001756500000\x00\x00`
    ).commits[0]

    expect(observedZero).toMatchObject({ fileCount: 0, totals: { added: 0, removed: 0 } })
    expect(unavailable).toMatchObject({ fileCount: null, totals: null })
  })
})

describe('추적 파일 상한 (VP-15)', () => {
  it(`${MAX_DIFF_FILES}건까지는 자르지 않는다 — 음성 짝`, () => {
    const tracked = Array.from({ length: MAX_DIFF_FILES }, (_, i) => entry(`f${i}.ts`))
    const { files, truncated } = mergeDiffEntries(tracked)
    expect(files).toHaveLength(MAX_DIFF_FILES)
    expect(truncated).toBe(false)
  })

  it(`${MAX_DIFF_FILES + 1}건이면 자르고 잘렸다고 말한다`, () => {
    const tracked = Array.from({ length: MAX_DIFF_FILES + 1 }, (_, i) => entry(`f${i}.ts`))
    const { files, truncated } = mergeDiffEntries(tracked)
    expect(files).toHaveLength(MAX_DIFF_FILES)
    expect(truncated).toBe(true)
  })
})

// 0211 ΔV1 — 합계는 목록과 다른 축이다(D-025·D-026).
describe('변경량 합계 (VP-27 · EP-11)', () => {
  const tracked = (path: string, added: number, removed: number): GitDiffFileEntry => ({
    path,
    status: 'modified',
    added,
    removed,
    binary: false
  })

  it('합계는 **절단 전** 전체에서 센다 — 201번째 파일의 줄이 사라지지 않는다 (VP-27)', () => {
    const many = Array.from({ length: 201 }, (_, i) =>
      tracked(`f${String(i).padStart(3, '0')}.ts`, 1, 1)
    )
    const merged = mergeDiffEntries(many)
    expect(merged.files).toHaveLength(200)
    expect(merged.truncated).toBe(true)
    expect(merged.totals).toEqual({ added: 201, removed: 201 })
  })

  it('빈 입력의 합계는 0/0 이다 — 필드가 비지 않는다', () => {
    expect(mergeDiffEntries([]).totals).toEqual({ added: 0, removed: 0 })
  })
})
