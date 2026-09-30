import { describe, expect, it } from 'vitest'
import { classifyArchiveBody, ARCHIVE_CLASSIFIER_REVISION } from './segment-classifier'

describe('conservative archive body segments', () => {
  it.each([
    '',
    '\r\n',
    '안녕하세요 😀\r\n> 원문 10대\r\n새 답변 20대\n> 미승인\n',
    'line\rnext\nlast'
  ])('covers each UTF-16 code unit once and reconstructs %j', (body) => {
    const segments = classifyArchiveBody(body)
    expect(segments.map(({ start, end }) => body.slice(start, end)).join('')).toBe(body)
    let end = 0
    segments.forEach((segment, ordinal) => {
      expect(segment).toMatchObject({
        ordinal,
        start: end,
        classifierRevision: ARCHIVE_CLASSIFIER_REVISION
      })
      expect(segment.end).toBeGreaterThan(segment.start)
      end = segment.end
    })
    expect(end).toBe(body.length)
  })
  it('keeps inline answers, single dashes and prose headers visible', () => {
    const body = '> 요청 10대\n승인 20대\n보낸 사람: 문장 일부\n--\n업무 면책 조건\n'
    const segments = classifyArchiveBody(body)
    expect(segments.map((segment) => segment.kind)).toEqual(['quote', 'unknown'])
    expect(body.slice(segments[1].start)).toBe(
      '승인 20대\n보낸 사람: 문장 일부\n--\n업무 면책 조건\n'
    )
  })
  it('requires a standard delimiter and multiple contact facts before classifying a signature', () => {
    const body = '결정 내용\n-- \n담당자\nqa@example.test\n전화: 02-1234-5678\n'
    const segments = classifyArchiveBody(body)
    expect(segments.map((segment) => segment.kind)).toEqual(['unknown', 'signature'])
    expect(body.slice(segments[1].start)).toBe('-- \n담당자\nqa@example.test\n전화: 02-1234-5678\n')
    expect(classifyArchiveBody('결정\n-- \n승인 조건은 유효합니다.\n').map((s) => s.kind)).toEqual([
      'unknown'
    ])
    expect(
      classifyArchiveBody('결정\n--\na@example.test\nhttps://example.test\n').map((s) => s.kind)
    ).toEqual(['unknown'])
  })
})
