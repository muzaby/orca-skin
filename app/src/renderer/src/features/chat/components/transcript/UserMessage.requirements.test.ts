import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DiffRequirementAnchor } from '../../../../../../shared/ipc'
import type { Message } from '../../reducer/chatReducer'
import { UserMessage } from './UserMessage'
import { PendingSteerTurn } from './PendingSteerTurn'

const requirement: DiffRequirementAnchor = {
  sessionId: 's1',
  baselineCommit: 'abc',
  filePath: 'src/a.ts',
  oldLine: null,
  newLine: 7,
  hunkHeader: '@@ -1 +1,7 @@',
  contextBefore: ['before'],
  contextAfter: [],
  comment: '줄바꿈을 보존해 주세요\n두 번째 줄 <tag>',
  createdAt: 1
}

describe('sent diff requirement attachments', () => {
  it('shows the submitted file, line and full comment alongside a real file attachment', () => {
    const message: Message = {
      role: 'user',
      createdAt: 1,
      parts: [
        { type: 'text', text: '수정해 주세요' },
        {
          type: 'attachment',
          attachments: [{ id: 'file', kind: 'file', name: 'spec.md', mimeType: 'text/plain' }]
        },
        {
          type: 'diff_requirements',
          requirements: [
            requirement,
            { ...requirement, oldLine: 9, newLine: null, filePath: 'deleted.ts' }
          ]
        }
      ]
    }
    const html = renderToStaticMarkup(createElement(UserMessage, { message }))
    expect(html).toContain('src/a.ts:+7')
    expect(html).toContain('deleted.ts:-9')
    expect(html).toContain('두 번째 줄 &lt;tag&gt;')
    expect(html).toContain('spec.md')
    expect(html).toContain('수정해 주세요')
    expect(html.match(/data-sent-diff-requirement=/g)).toHaveLength(2)
    expect(html).not.toContain('Diff 요구사항 제거')
  })

  it('preserves the attachment while the message waits for provider consumption', () => {
    const html = renderToStaticMarkup(
      createElement(PendingSteerTurn, {
        items: [{ id: 'pending', text: '대기 중', createdAt: 1, requirements: [requirement] }]
      })
    )
    expect(html).toContain('data-state="pending-steer"')
    expect(html).toContain('src/a.ts:+7')
    expect(html).toContain('두 번째 줄 &lt;tag&gt;')
  })

  it('does not add an attachment surface to ordinary messages', () => {
    const html = renderToStaticMarkup(
      createElement(UserMessage, {
        message: { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'ordinary' }] }
      })
    )
    expect(html).toContain('ordinary')
    expect(html).not.toContain('data-sent-diff-requirement')
  })
})
