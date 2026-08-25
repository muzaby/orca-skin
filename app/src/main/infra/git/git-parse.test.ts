import { describe, expect, it } from 'vitest'
import { firstErrorLine, parseBranchList, parseShortstat } from './git-parse'

describe('parseShortstat', () => {
  it('삽입·삭제가 모두 있는 줄을 읽는다', () => {
    expect(parseShortstat(' 8 files changed, 104 insertions(+), 2 deletions(-)\n')).toEqual({
      files: 8,
      insertions: 104,
      deletions: 2
    })
  })

  it('한쪽만 있는 줄에서 나머지를 0 으로 채운다', () => {
    expect(parseShortstat(' 1 file changed, 3 insertions(+)')).toEqual({
      files: 1,
      insertions: 3,
      deletions: 0
    })
    expect(parseShortstat(' 2 files changed, 7 deletions(-)')).toEqual({
      files: 2,
      insertions: 0,
      deletions: 7
    })
  })

  it('변경이 없으면 null 이다', () => {
    expect(parseShortstat('')).toBeNull()
    expect(parseShortstat('\n')).toBeNull()
  })
})

describe('parseBranchList', () => {
  it('현재 브랜치를 앞에 고정하고 나머지를 이름순으로 둔다', () => {
    const out = 'main\nclaude/zeta\nclaude/alpha\n'
    expect(parseBranchList(out, 'main')).toEqual(['main', 'claude/alpha', 'claude/zeta'])
  })

  it('detached HEAD(현재 브랜치 없음)면 전부 이름순이다', () => {
    expect(parseBranchList('b\na\n', null)).toEqual(['a', 'b'])
  })

  it('현재 브랜치가 목록에 없으면 끼워 넣지 않는다', () => {
    expect(parseBranchList('a\nb\n', 'ghost')).toEqual(['a', 'b'])
  })

  it('빈 줄과 공백을 버린다', () => {
    expect(parseBranchList('\n  main  \n\n', 'main')).toEqual(['main'])
  })
})

describe('firstErrorLine', () => {
  it('hint 가 아닌 첫 줄을 고른다', () => {
    const stderr = "hint: use 'git switch'\nerror: Your local changes would be overwritten.\n"
    expect(firstErrorLine(stderr)).toBe('error: Your local changes would be overwritten.')
  })

  it('쓸 줄이 없으면 빈 문자열이다', () => {
    expect(firstErrorLine('\n  \nhint: x\n')).toBe('')
  })
})
