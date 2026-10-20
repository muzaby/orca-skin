import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { installExternalNavigation } from './external-navigation'

describe('main window external link routing', () => {
  it('sends HTTP(S) popup and same-frame navigation to the default browser and denies other schemes', async () => {
    let popup!: Parameters<WebContents['setWindowOpenHandler']>[0]
    let navigate!: (event: { preventDefault(): void }, url: string) => void
    const open = vi.fn(async () => undefined)
    const port = {
      setWindowOpenHandler: (handler: typeof popup) => {
        popup = handler
      },
      on: (name: string, handler: typeof navigate) => {
        if (name === 'will-navigate') navigate = handler
      }
    } as unknown as Pick<WebContents, 'setWindowOpenHandler' | 'on'>
    installExternalNavigation(port, open)
    for (const url of ['https://example.com/a?q=1', 'http://localhost:3000/page']) {
      expect(popup({ url } as Parameters<typeof popup>[0])).toEqual({ action: 'deny' })
      const event = { preventDefault: vi.fn() }
      navigate(event, url)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    for (const url of ['file:///C:/secret', 'javascript:alert(1)', 'app://index.html', 'bad']) {
      expect(popup({ url } as Parameters<typeof popup>[0])).toEqual({ action: 'deny' })
      const event = { preventDefault: vi.fn() }
      navigate(event, url)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    expect(open.mock.calls).toEqual([
      ['https://example.com/a?q=1'],
      ['https://example.com/a?q=1'],
      ['http://localhost:3000/page'],
      ['http://localhost:3000/page']
    ])
  })
})
