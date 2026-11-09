import { describe, expect, it, vi } from 'vitest'
import { fastImportStream, parseMarks } from './fast-import-stream.testfixture'

describe('fast-import 스트림', () => {
  it('B6 — 날짜를 생략하면 실행 시각을 author·committer에 쓴다', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2002-01-01T00:00:00Z'))
    try {
      const stream = fastImportStream({ commits: [{ message: 'now' }] }).toString()
      expect(stream.match(/1009843200 \+0000/g)).toHaveLength(2)
    } finally {
      vi.restoreAllMocks()
    }
  })
  it('B4~B8 — 바이트·삭제·C 인용·메시지·날짜·신원·추가 브랜치', () => {
    const stream = fastImportStream(
      {
        branch: 'trunk',
        commits: [
          {
            message: 'first\nbody',
            date: '2000-01-01T00:00:00Z',
            files: {
              'a b': '한글',
              '"line\n': Buffer.from([0, 255]),
              old: null
            }
          },
          { message: 'empty' }
        ],
        branches: { topic: 0, other: 1 }
      },
      undefined,
      Date.parse('2001-01-01T00:00:00Z')
    )
    expect(stream).toEqual(
      Buffer.concat([
        Buffer.from(
          'commit refs/heads/trunk\nmark :1\nauthor orca test <test@orca.local> 946684800 +0000\ncommitter orca test <test@orca.local> 946684800 +0000\ndata 11\nfirst\nbody\n\nM 100644 inline "a b"\ndata 6\n한글\nM 100644 inline "\\042line\\012"\ndata 2\n'
        ),
        Buffer.from([0, 255]),
        Buffer.from(
          '\nD "old"\n\ncommit refs/heads/trunk\nmark :2\nauthor orca test <test@orca.local> 978307200 +0000\ncommitter orca test <test@orca.local> 978307200 +0000\ndata 6\nempty\n\n\nreset refs/heads/topic\nfrom :1\n\nreset refs/heads/other\nfrom :2\n\n'
        )
      ])
    )
  })
  it('B2·B12 — 빈 명세와 append의 부모', () => {
    expect(fastImportStream({})).toEqual(Buffer.alloc(0))
    expect(
      fastImportStream({ commits: [{ message: 'append' }] }, 'refs/heads/main^0').toString()
    ).toContain('from refs/heads/main^0\n')
  })
  it('B10 — marks 순서·검증', () => {
    const a = 'a'.repeat(40),
      b = 'b'.repeat(40)
    expect(parseMarks(`:2 ${b}\n:1 ${a}\n`)).toEqual([a, b])
    for (const marks of ['', ':1 invalid', `:2 ${b}`, `:1 ${a}\n:1 ${b}`])
      expect(() => parseMarks(marks)).toThrow()
  })
})
