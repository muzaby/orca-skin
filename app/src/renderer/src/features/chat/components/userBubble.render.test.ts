// 0257 AC9·AC12 — 버블 렌더 구조와 4 소비처의 접기 키·title 제거.
import { createElement, type ReactNode } from 'react'
import { renderWithTranscript as renderToStaticMarkup } from '../harnesses/registries/transcript.testfixture'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ bubbles: [] as Record<string, unknown>[] }))

vi.mock('../harnesses/common/transcript/UserBubbleText', async (original) => {
  const actual = await original<typeof import('../harnesses/common/transcript/UserBubbleText')>()
  return {
    UserBubbleText: (props: Record<string, unknown> & { children: ReactNode }) => {
      h.bubbles.push(props)
      return actual.UserBubbleText(props as Parameters<typeof actual.UserBubbleText>[0])
    }
  }
})

import { UserMessage } from '../harnesses/common/transcript/UserMessage'
import { AskExchange } from '../harnesses/claude/transcript/AskExchange'
import type { Message, ToolCall } from '../reducer/chatReducer'

describe('UserBubbleText 구조', () => {
  it('측정 전(넘침 미확인)에는 접지 않고 버튼도 없다 — 본문은 표면 안 별도 div', () => {
    h.bubbles = []
    const message: Message = {
      role: 'user',
      createdAt: 42,
      parts: [{ type: 'text', text: '짧은 메시지' }]
    }
    const html = renderToStaticMarkup(createElement(UserMessage, { message }))
    expect(html).toContain('짧은 메시지')
    expect(html).not.toContain('max-h-[10lh]')
    expect(html).not.toContain('bubble:toggle')
    // AC12 — 버블 루트에 전체 문장 title 이 없고 접기 키가 있다.
    expect(html).not.toContain('title="짧은 메시지"')
    expect(h.bubbles.at(-1)?.collapseKey).toBe('user:42')
  })

  it('질문 답변 버블은 ask:<toolUseId> 키와 본문 배치 클래스를 넘긴다', () => {
    h.bubbles = []
    const call = {
      toolUseId: 't1',
      name: 'AskUserQuestion',
      input: { questions: [{ question: 'Q?', options: [{ label: 'A' }] }] },
      result: { output: { answers: { 'Q?': 'A' } } }
    } as unknown as ToolCall
    renderToStaticMarkup(createElement(AskExchange, { call }))
    expect(h.bubbles).toHaveLength(1)
    expect(h.bubbles[0]?.collapseKey).toBe('ask:t1')
    expect(h.bubbles[0]?.contentClassName).toBe('flex flex-col gap-1')
  })
})

describe('소비처 원문 — 키 전달 · 전체 문장 title 제거', () => {
  const read = (rel: string): string =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  it.each([
    [
      '../harnesses/common/transcript/UserMessage.tsx',
      'collapseKey={`user:${message.createdAt}`}',
      'title={text}'
    ],
    [
      '../harnesses/common/transcript/PendingSteerTurn.tsx',
      'collapseKey={`steer:${item.id}`}',
      'title={item.text}'
    ],
    [
      '../harnesses/claude/transcript/AskExchange.tsx',
      'collapseKey={`ask:${call.toolUseId}`}',
      null
    ],
    [
      '../harnesses/common/rightpanel/SubAgentTaskDetail.tsx',
      'collapseKey={`subagent:${selected.toolUseId}`}',
      'title={prompt}'
    ]
  ])('%s', (file, key, removedTitle) => {
    const src = read(file)
    expect(src).toContain(key)
    if (removedTitle) expect(src).not.toContain(removedTitle)
  })
})
