import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { describe, expect, it } from 'vitest'
import { createArtifactSenderCheck } from './artifact-sender'

describe('artifact IPC sender trust', () => {
  it.each(['app://renderer/', 'http://localhost:5173/'])(
    'accepts only the current main frame at %s',
    (url) => {
      const frame = { url }
      const contents = { isDestroyed: () => false, mainFrame: frame } as unknown as WebContents
      const event = { sender: contents, senderFrame: frame } as IpcMainInvokeEvent
      const check = createArtifactSenderCheck(() => contents, url)
      expect(check(event)).toBe(true)
      expect(check({ ...event, sender: {} as WebContents })).toBe(false)
      expect(check({ ...event, senderFrame: { url } as Electron.WebFrameMain })).toBe(false)
      expect(check({ ...event, senderFrame: null })).toBe(false)
      for (const untrusted of [
        'https://example.com/',
        'app://other/',
        'http://localhost:5174/',
        'app://user@renderer/',
        'invalid'
      ]) {
        frame.url = untrusted
        expect(check(event)).toBe(false)
      }
    }
  )
  it('fails closed before a window exists and after it is destroyed', () => {
    const event = {} as IpcMainInvokeEvent
    expect(createArtifactSenderCheck(() => null, 'app://renderer/')(event)).toBe(false)
    const contents = { isDestroyed: () => true } as WebContents
    expect(createArtifactSenderCheck(() => contents, 'app://renderer/')(event)).toBe(false)
  })
})
