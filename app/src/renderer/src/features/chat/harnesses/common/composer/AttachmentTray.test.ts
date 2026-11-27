import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { DraftAttachment } from '../../../lib/attachmentThumbs'
import { AttachmentTray } from './AttachmentTray'

it('renders only the prepared thumbnail as an image for inline attachment chips', () => {
  const preview = 'data:image/jpeg;base64,dGh1bWI='
  const states: DraftAttachment['thumbnail'][] = [
    { state: 'pending' },
    { state: 'unavailable' },
    { state: 'ready', dataUrl: preview }
  ]
  for (const thumbnail of states) {
    const attachment: DraftAttachment = {
      id: 'clip',
      thumbnail,
      source: {
        kind: 'inline',
        name: 'clip.png',
        data: 'b3JpZ2luYWw=',
        mimeType: 'image/png',
        sizeBytes: 8,
        sourceKind: 'clipboard'
      }
    }
    const html = renderToStaticMarkup(
      createElement(AttachmentTray, { attachments: [attachment], onRemove: vi.fn() })
    )
    expect(html).toContain('title="clip.png"')
    expect(html).not.toContain('b3JpZ2luYWw=')
    const images = Array.from(html.matchAll(/<img [^>]*src="([^"]+)"/g), (match) => match[1])
    expect(images).toEqual(thumbnail.state === 'ready' ? [preview] : [])
  }
})
