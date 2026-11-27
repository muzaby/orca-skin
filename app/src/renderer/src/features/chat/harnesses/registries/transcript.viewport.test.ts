import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { createElement } from 'react'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { transcriptHarness } from './transcript'
import type { Message } from '../../reducer/chatReducer'
import { newTranscriptChanges, recordChange } from '../../lib/transcript/changeLog'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../components/transcript/TranscriptViewport', async () => {
  const { createElement } = await import('react')
  return {
    TranscriptViewport: (props: { snapshot: { count: number }; isPinned?: () => boolean }) =>
      createElement('div', {
        'data-shared-transcript-viewport': 'true',
        'data-block-count': String(props.snapshot.count),
        'data-bottom-pinned': String(props.isPinned?.())
      }),
    writeScrollTop: vi.fn(),
    useTranscriptReveal: () => vi.fn()
  }
})
vi.mock('../../store/chatStore', () => ({
  useActiveSessionKey: () => 's1',
  useChatStore: (select: (state: { entryIntent: null }) => unknown) =>
    select({ entryIntent: null }),
  useTranscriptChanges: () =>
    recordChange(newTranscriptChanges(), { kind: 'reset', complete: true }),
  useHasLiveText: () => false,
  useHasLiveReasoning: () => false,
  useLiveTextKey: () => undefined,
  useLiveTextFor: () => '',
  useLiveReasoningFor: () => '',
  useTranscriptView: () => ({})
}))

function callsVirtualizer(path: string): boolean {
  const source = readFileSync(path, 'utf8')
  if (!source.includes('useVirtualizer')) return false
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest)
  const visit = (node: ts.Node): boolean => {
    if (ts.isCallExpression(node)) {
      const name = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name
        : node.expression
      if (ts.isIdentifier(name) && name.text === 'useVirtualizer') return true
    }
    return ts.forEachChild(node, visit) ?? false
  }
  return visit(file)
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walkTsFiles(full, acc)
    else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.includes('.test.') &&
      !entry.includes('.testfixture.')
    ) {
      acc.push(full)
    }
  }
  return acc
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
})

describe('harnesses/registries/transcript.viewport (VP-21 · EP-10)', () => {
  it('every transcript entry point renders through the shared viewport', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const messages: Message[] = [
      { id: 'u:1', role: 'user', createdAt: 1000, parts: [{ type: 'text', text: 'hi' }] },
      { id: 'a:1', role: 'assistant', createdAt: 2000, parts: [{ type: 'text', text: 'hello' }] }
    ]
    const scrollRef = { current: null }
    const contentRef = { current: null }
    const isPinned = vi.fn(() => true)

    // 1. Claude Code
    const ClaudeTimeline = transcriptHarness('claude').Timeline
    dom.render(
      createElement(ClaudeTimeline, {
        agentKind: 'code',
        backend: 'claude',
        messages,
        pendingSteer: [],
        inflight: false,
        loadingSession: false,
        error: undefined,
        textScaleClassName: '',
        showAutomaticFeeds: false,
        anchored: false,
        isPinned,
        scrollRef,
        contentRef,
        onScroll: () => {}
      })
    )
    expect(
      dom.query('[data-shared-transcript-viewport="true"][data-bottom-pinned="true"]')
    ).not.toBeNull()

    // 2. Claude Work
    dom.render(
      createElement(ClaudeTimeline, {
        agentKind: 'work',
        backend: 'claude',
        messages,
        pendingSteer: [],
        inflight: false,
        loadingSession: false,
        error: undefined,
        textScaleClassName: '',
        showAutomaticFeeds: false,
        anchored: false,
        isPinned,
        scrollRef,
        contentRef,
        onScroll: () => {}
      })
    )
    expect(
      dom.query('[data-shared-transcript-viewport="true"][data-bottom-pinned="true"]')
    ).not.toBeNull()

    // 3. OpenCode
    const OpenCodeTimeline = transcriptHarness('opencode').Timeline
    dom.render(
      createElement(OpenCodeTimeline, {
        agentKind: 'code',
        backend: 'opencode',
        messages,
        pendingSteer: [],
        inflight: false,
        loadingSession: false,
        error: undefined,
        textScaleClassName: '',
        showAutomaticFeeds: false,
        anchored: false,
        isPinned,
        scrollRef,
        contentRef,
        onScroll: () => {}
      })
    )
    expect(
      dom.query('[data-shared-transcript-viewport="true"][data-bottom-pinned="true"]')
    ).not.toBeNull()
  })

  it('EP-10 negative search: only TranscriptViewport.tsx calls useVirtualizer and writes .scrollTop in transcript folders', () => {
    const chatRoot = resolve(__dirname, '../..')
    const viewportFile = join(chatRoot, 'components', 'transcript', 'TranscriptViewport.tsx')
    const files = walkTsFiles(chatRoot)
    const virtualizerCallers = files.filter(callsVirtualizer)
    expect(virtualizerCallers).toEqual([viewportFile])

    const scrollTopWriters = files.filter((f) => {
      if (!f.includes(`${sep}transcript${sep}`)) return false
      return /\.scrollTop\s*=/.test(readFileSync(f, 'utf8'))
    })
    expect(scrollTopWriters).toEqual([viewportFile])
  })
})
