import { describe, expect, it } from 'vitest'
import { buildTurnContent } from './claude'
import type { ExtractedAttachmentImage, ExtractedAttachmentText } from '../files/attachments'

const textAtt = (overrides: Partial<ExtractedAttachmentText> = {}): ExtractedAttachmentText => ({
  id: 'att_text',
  name: 'spec.md',
  mimeType: 'text/markdown',
  sizeBytes: 12,
  text: 'hello attachment',
  charsOriginal: 16,
  charsIncluded: 16,
  truncated: false,
  sourceKind: 'dialog',
  ...overrides
})

const imageAtt = (overrides: Partial<ExtractedAttachmentImage> = {}): ExtractedAttachmentImage => ({
  id: 'att_img',
  name: 'pic.png',
  mimeType: 'image/png',
  sizeBytes: 100,
  data: 'QUJD',
  sourceKind: 'clipboard',
  ...overrides
})

describe('buildTurnContent', () => {
  it('첨부가 없으면 본문 text 를 string 그대로 반환한다(검증된 무첨부 경로)', () => {
    expect(buildTurnContent('hi', [], [])).toBe('hi')
  })

  it('텍스트 첨부만 있으면 wrapper 를 본문에 병합한 string 을 반환한다(배열 아님)', () => {
    const content = buildTurnContent('질문 본문', [textAtt()], [])
    expect(typeof content).toBe('string')
    expect(content).toContain('질문 본문')
    expect(content).toContain('<<<ORCA_ATTACHMENT_START id="att_text"')
  })

  it('이미지 첨부가 있으면 content-block 배열을 반환하고 첫 블록에 병합 text 를 둔다', () => {
    const content = buildTurnContent('보세요', [textAtt()], [imageAtt()])
    expect(Array.isArray(content)).toBe(true)
    const blocks = content as unknown as Array<Record<string, unknown>>
    expect(blocks[0]).toMatchObject({ type: 'text' })
    expect(blocks[0]!.text as string).toContain('보세요')
    expect(blocks[0]!.text as string).toContain('<<<ORCA_ATTACHMENT_START id="att_text"')
    expect(blocks[1]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'QUJD' }
    })
  })

  it('이미지만 있으면 본문 text 블록 + image 블록 배열', () => {
    const content = buildTurnContent('cap', [], [imageAtt(), imageAtt({ id: 'att_img2' })])
    const blocks = content as unknown as Array<Record<string, unknown>>
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ type: 'text', text: 'cap' })
    expect(blocks[1]).toMatchObject({ type: 'image' })
    expect(blocks[2]).toMatchObject({ type: 'image' })
  })
})
