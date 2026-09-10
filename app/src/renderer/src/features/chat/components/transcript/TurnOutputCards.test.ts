import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { AssistantTurn } from './AssistantTurn'
import { Exchange } from './Exchange'
import { TranscriptView } from './TranscriptView'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { groupExchanges, type Turn } from '../../lib/turns'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import { useChatStore } from '../../store/chatStore'
import { acquireArtifacts, refreshArtifactList, useArtifactStore } from '../../store/artifactStore'
import type { ArtifactRef } from '../../../../../../shared/artifacts'

vi.mock('../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
vi.mock('../markdown/StreamingMarkdown', () => ({
  StreamingMarkdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
vi.mock('../../hooks/useTranscriptVirtualizer', () => ({
  useTranscriptVirtualizer: () => ({
    getVirtualItems: () => [{ index: 0, start: 0 }],
    getTotalSize: () => 100,
    measureElement: vi.fn()
  })
}))

const file: ArtifactRef = {
  publicationId: 'ordinary',
  artifactFileId: 'file',
  title: 'Final report',
  filename: 'final.pptx',
  kind: 'file',
  category: 'file',
  sizeBytes: 123,
  publishedAt: 1
}
const artifact: ArtifactRef = {
  ...file,
  publicationId: 'published',
  artifactFileId: 'published-file',
  category: 'artifact',
  title: 'Published report'
}
const turn: Turn = {
  role: 'assistant',
  startIndex: 0,
  messages: [
    {
      role: 'assistant',
      createdAt: 1,
      parts: [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'response' } },
        { type: 'text', text: 'committed-body' },
        { type: 'artifact', artifact: file },
        { type: 'artifact', artifact },
        { type: 'artifact', artifact: file }
      ]
    }
  ]
}
const workTranscript = agentUiPolicy('work').transcript
const spark = 'viewBox="0 0 100 100"'
const card = (id: string): string => `data-artifact-preview="${id}"`

function render(element: ReactElement): string {
  Object.assign(useChatStore.getInitialState(), useChatStore.getState())
  Object.assign(useArtifactStore.getInitialState(), useArtifactStore.getState())
  return renderToStaticMarkup(element)
}

beforeEach(() => {
  installChatStoreHarness({ inflight: true, turnStartedAt: 1, activityForeground: 'streaming' })
  useChatStore.setState((state) => ({
    sessions: { s: { ...state.sessions.s, live: { text: 'live-body', reasoning: '' } } }
  }))
  useArtifactStore.setState({ sessions: {} })
})

it.each(['work', 'code'] as const)(
  '%s renders committed and live text, then one spark, then both categories at the turn end',
  (kind) => {
    const html = render(
      createElement(Exchange, {
        transcriptPolicy: agentUiPolicy(kind).transcript,
        exchange: { startIndex: 0, turns: [turn] },
        reserve: false,
        pending: true
      })
    )
    expect(html.indexOf('committed-body')).toBeLessThan(html.indexOf('live-body'))
    expect(html.indexOf('live-body')).toBeLessThan(html.indexOf(spark))
    expect(html.indexOf(spark)).toBeLessThan(html.indexOf(card('ordinary')))
    expect(html.indexOf(card('ordinary'))).toBeLessThan(html.indexOf(card('published')))
    expect(html.split(spark)).toHaveLength(2)
    expect(html.split(card('ordinary'))).toHaveLength(2)
    expect(html).not.toContain('group-hover/msg:opacity-100')
  }
)

it('puts completed metadata before cards and keeps idle history free of live text and spark', () => {
  const html = render(
    createElement(AssistantTurn, { turn, transcriptPolicy: workTranscript, pending: false })
  )
  expect(html.indexOf('committed-body')).toBeLessThan(html.indexOf('group-hover/msg:opacity-100'))
  expect(html.indexOf('group-hover/msg:opacity-100')).toBeLessThan(html.indexOf(card('ordinary')))
  expect(html).not.toContain('live-body')
  expect(html).not.toContain(spark)
})

it.each([
  { turns: [] },
  {
    turns: [
      {
        ...turn,
        role: 'user' as const,
        messages: [
          {
            role: 'user' as const,
            createdAt: 1,
            parts: [{ type: 'text' as const, text: 'first-user' }]
          }
        ]
      }
    ]
  }
])('keeps the pending fallback while no assistant turn exists (%j)', ({ turns }) => {
  const html = render(
    createElement(Exchange, {
      transcriptPolicy: workTranscript,
      exchange: { startIndex: 0, turns },
      reserve: false,
      pending: true
    })
  )
  expect(html).toContain('live-body')
  expect(html.split(spark)).toHaveLength(2)
})

it('preserves earlier turn refs after latest output replacement, and never places ownerless files at the session tail', async () => {
  const replacement = { ...file, publicationId: 'updated', artifactFileId: 'updated-file' }
  Object.assign(window.orca, { artifacts: { list: vi.fn().mockResolvedValue([replacement]) } })
  const release = acquireArtifacts('s', [], true)
  await refreshArtifactList('s')
  const messages = [
    ...turn.messages,
    {
      role: 'user' as const,
      createdAt: 2,
      parts: [{ type: 'text' as const, text: 'second-user' }]
    },
    {
      role: 'assistant' as const,
      createdAt: 3,
      parts: [{ type: 'text' as const, text: 'second-answer' }]
    }
  ]
  const html = render(
    createElement(TranscriptView, {
      agentKind: 'work',
      messages,
      pendingSteer: [],
      inflight: false,
      loadingSession: false,
      anchored: false,
      scrollRef: { current: null },
      contentRef: { current: null },
      onScroll: vi.fn()
    })
  )
  expect(html).toContain(card('ordinary'))
  expect(html.indexOf(card('ordinary'))).toBeLessThan(html.indexOf('second-user'))
  expect(html).not.toContain(card('updated'))
  const before = groupExchanges(messages)
  const next = groupExchanges(
    messages.map((message, index) =>
      index === 0
        ? {
            ...message,
            parts: [...message.parts, { type: 'artifact' as const, artifact: replacement }]
          }
        : message
    )
  )
  const compare = (Exchange as unknown as { compare: (a: unknown, b: unknown) => boolean }).compare
  expect(compare({ exchange: before[0] }, { exchange: next[0] })).toBe(false)
  expect(compare({ exchange: before[1] }, { exchange: next[1] })).toBe(true)
  release()
})

it('keeps the first pending response visible before any exchange is committed', () => {
  const html = render(
    createElement(TranscriptView, {
      agentKind: 'work',
      messages: [],
      pendingSteer: [],
      inflight: true,
      loadingSession: false,
      anchored: false,
      scrollRef: { current: null },
      contentRef: { current: null },
      onScroll: vi.fn()
    })
  )
  expect(html).toContain('live-body')
  expect(html.split(spark)).toHaveLength(2)
})
