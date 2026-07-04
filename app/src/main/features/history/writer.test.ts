import { describe, expect, it, vi } from 'vitest'
import { HistoryWriter } from './writer'
import type { DbQueries } from '../../infra/db'
import type { AttachmentView } from '../../../shared/ipc'

// persistUserMessage 만 검증 — appendMessage/appendPart 만 모의한다.
function makePersistence(): {
  persistence: HistoryWriter
  appendMessage: ReturnType<typeof vi.fn>
  appendPart: ReturnType<typeof vi.fn>
} {
  const appendMessage = vi.fn(() => 7)
  const appendPart = vi.fn(() => 0)
  const db = { appendMessage, appendPart } as unknown as DbQueries
  const persistence = new HistoryWriter(db)
  return { persistence, appendMessage, appendPart }
}

const imageView: AttachmentView = {
  id: 'a1',
  name: 'pic.png',
  mimeType: 'image/png',
  kind: 'image',
  previewDataUrl: 'data:image/jpeg;base64,QUJD'
}
const fileView: AttachmentView = {
  id: 'a2',
  name: 'spec.md',
  mimeType: 'text/markdown',
  kind: 'file'
}

describe('HistoryWriter.persistUserMessage — 첨부 영속', () => {
  it('첨부가 있으면 text 파트 + attachment 파트를 같은 메시지에 append 한다', () => {
    const { persistence, appendMessage, appendPart } = makePersistence()
    persistence.persistUserMessage('s1', '이거 봐', 100, [imageView, fileView])

    expect(appendMessage).toHaveBeenCalledTimes(1)
    expect(appendPart).toHaveBeenCalledTimes(2)
    expect(appendPart.mock.calls[0]![0]).toMatchObject({ messageId: 7, type: 'text' })
    const attachmentCall = appendPart.mock.calls[1]![0] as { type: string; payloadJson: string }
    expect(attachmentCall.type).toBe('attachment')
    expect(JSON.parse(attachmentCall.payloadJson)).toEqual({ attachments: [imageView, fileView] })
  })

  it('첨부가 없으면 attachment 파트를 만들지 않는다', () => {
    const { persistence, appendPart } = makePersistence()
    persistence.persistUserMessage('s1', 'plain', 100)
    expect(appendPart).toHaveBeenCalledTimes(1)
    expect(appendPart.mock.calls[0]![0]).toMatchObject({ type: 'text' })

    persistence.persistUserMessage('s1', 'empty', 100, [])
    expect(appendPart).toHaveBeenCalledTimes(2) // text only, 여전히 attachment 없음
  })
})
