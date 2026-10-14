import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { TranscriptView } from './TranscriptView'
import { OpenCodeToolGroup } from './OpenCodeToolGroup'
import { transcriptPresentation } from '../../lib/agentPresentation'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'

describe('OpenCode transcript presentation', () => {
  it.each(['claude', 'opencode'] as const)('renders shared messages in the %s slice', (backend) => {
    installChatStoreHarness({ backend })
    const html = renderToStaticMarkup(
      createElement(TranscriptView, {
        backend,
        agentKind: 'code',
        messages: [
          { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'User prompt' }] },
          { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'Answer body' }] }
        ],
        pendingSteer: [],
        inflight: false,
        loadingSession: false,
        anchored: false,
        scrollRef: { current: null },
        contentRef: { current: null },
        onScroll: () => {}
      })
    )
    expect(load(html)(`[data-harness="${backend}"]`)).toHaveLength(1)
    expect(html).toContain('User prompt')
    expect(html).toContain('Answer body')
    expect(html.includes('bg-oc-background')).toBe(backend === 'opencode')
  })
  it('shows normalized edit detail and preserved provider input in an accessible disclosure', () => {
    const html = renderToStaticMarkup(
      createElement(OpenCodeToolGroup, {
        transcriptPolicy: transcriptPresentation('code', 'opencode'),
        calls: [
          {
            toolUseId: 'edit1',
            name: 'Edit',
            input: { file_path: 'a.ts', old_string: 'before', new_string: 'after' },
            providerTool: {
              name: 'edit',
              input: { filePath: 'a.ts', oldString: 'before', newString: 'after' }
            }
          }
        ]
      })
    )
    const $ = load(html)
    expect($('[data-slot="collapsible-trigger"]').attr('aria-expanded')).toBe('true')
    expect($('details pre').text()).toContain('filePath')
    expect($('details pre').text()).toContain('oldString')
    expect($('[data-component="tool-trigger"]').text()).toContain('edit')
  })
})
