import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import type { Message } from '../../../reducer/chatReducer'
import { useChatStore } from '../../../store/chatStore'
import { OpenCodeSources } from './Sources'

// SSR consumes Zustand's initial snapshot. Each render is an independent fixture,
// not evidence of a mounted subscription or a picker interaction.
const snapshot = useChatStore.getInitialState()
const entry = snapshot.sessions[snapshot.activeKey]
const original = entry.session
const render = (full = false): ReturnType<typeof load> =>
  load(renderToStaticMarkup(createElement(OpenCodeSources, { full, onShowAll: () => {} })))

beforeEach(() => {
  entry.session = {
    ...original,
    backend: 'opencode',
    agentKind: 'code',
    sessionId: 's',
    cwd: 'C:/workspace',
    extraDirs: [],
    messages: [],
    inflight: false,
    listening: false
  }
})
afterEach(() => {
  entry.session = original
})

describe('OpenCode sources through the actual context hook and selector', () => {
  it('hides cwd-only summary sources but keeps the full directory and add control reachable', () => {
    expect(render()('[data-component="opencode-sources"]')).toHaveLength(0)
    const full = render(true)
    expect(full('[data-component="opencode-sources"]')).toHaveLength(1)
    expect(full('button[title="C:/workspace"]').text()).toBe('workspace')
    expect(full('button[aria-label="폴더 추가"]')).toHaveLength(1)
    expect(full('button[aria-label="폴더 추가"]').attr('disabled')).toBeUndefined()
    expect(full.text()).not.toContain('모두 보기')
  })

  const attachment: Message = {
    role: 'user',
    createdAt: 1,
    parts: [
      {
        type: 'attachment',
        attachments: [
          {
            id: 'source-attachment',
            name: 'reference.pdf',
            kind: 'file',
            mimeType: 'application/pdf',
            path: 'C:/attachments/reference.pdf'
          }
        ]
      }
    ]
  }
  const web: Message = {
    role: 'assistant',
    createdAt: 2,
    parts: [
      {
        type: 'tool_call',
        toolRunId: 'fetch',
        toolName: 'WebFetch',
        args: { url: 'https://docs.example/guide' }
      },
      { type: 'tool_result', toolRunId: 'fetch', result: 'Read guide', isError: false }
    ]
  }
  it.each([
    { name: 'extra directory', extraDirs: ['C:/refs'], messages: [], text: 'refs' },
    { name: 'attachment', extraDirs: [], messages: [attachment], text: 'reference.pdf' },
    { name: 'URL', extraDirs: [], messages: [web], text: 'docs.example/guide' }
  ])(
    'shows and removes the $name source without requiring another source kind',
    ({ extraDirs, messages, text }) => {
      expect(render()('[data-component="opencode-sources"]')).toHaveLength(0)
      entry.session = { ...entry.session, extraDirs, messages }
      const populated = render()
      expect(populated('[data-component="opencode-sources"]')).toHaveLength(1)
      expect(populated.text()).toContain(text)
      expect(populated('button[title="C:/workspace"]').text()).toBe('workspace')
      expect(populated('button').text()).toContain('모두 보기')
      if (messages[0] === web) {
        expect(populated('a').attr('href')).toBe('https://docs.example/guide')
        expect(populated('a').attr('rel')).toBe('noopener noreferrer')
      }
      entry.session = { ...entry.session, extraDirs: [], messages: [] }
      expect(render()('[data-component="opencode-sources"]')).toHaveLength(0)
      expect(render(true)('button[aria-label="폴더 추가"]').attr('disabled')).toBeUndefined()
    }
  )
})
