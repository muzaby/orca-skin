import { describe, expect, it } from 'vitest'
import { partFromRow } from './dto'
import type { LoadedPartRow } from '../db/types'

const row = (over: Partial<LoadedPartRow>): LoadedPartRow => ({
  message_id: 1,
  role: 'user',
  created_at: 0,
  complete: 1,
  message_idx: 0,
  part_idx: 0,
  type: 'text',
  tool_run_id: null,
  payload_json: '{}',
  ...over
})

describe('partFromRow — attachment 파트', () => {
  it('attachment 파트를 payload_json 에서 그대로 복원한다(제네릭 로더)', () => {
    const attachments = [
      { id: 'a1', name: 'pic.png', mimeType: 'image/png', kind: 'image', previewDataUrl: 'd' },
      { id: 'a2', name: 'spec.md', mimeType: 'text/markdown', kind: 'file' }
    ]
    const part = partFromRow(
      row({ type: 'attachment', payload_json: JSON.stringify({ attachments }) })
    )
    expect(part).toEqual({ type: 'attachment', attachments })
  })
})
