// 0231 VP-213 · VP-214 (R-107 · AR-103 ↔ AT-112·AT-113 · §10 EP-206)
//
// 백그라운드 실행 줄이 **마지막 어시스턴트 턴 아래에** 서고 스피너와 **배타**인가.
//
// **`Exchange` 를 마운트한다** — `BackgroundRunRow` 만 렌더하면 그것을 transcript 에 꽂은 배선이
// 잠기지 않는다. 0230 D1 이 같은 축이었다: 단위는 전부 초록인데 호출부 두 줄을 지워도 통과했다.
// 시드는 `getInitialState()` 제자리 변형이다(`shellNoticeRow.render.test.ts` 와 같은 이유).

import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Exchange } from './Exchange'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { useChatStore } from '../../store/chatStore'
import { groupExchanges } from '../../lib/turns'
import type { ChatState, Message } from '../../reducer/chatReducer'
import type { SubagentMetaState } from '../../store/chatStore'

const entry = (): { session: ChatState; subagentMeta: Record<string, SubagentMetaState> } => {
  const init = useChatStore.getInitialState()
  return init.sessions[init.activeKey]! as never
}

const pristine = {
  messages: entry().session.messages,
  listening: entry().session.listening,
  transport: entry().session.activityTransport,
  count: entry().session.activityBackgroundTaskCount,
  startedAt: entry().session.listenStartedAt,
  meta: entry().subagentMeta
}

afterEach(() => {
  const e = entry()
  e.session.messages = pristine.messages
  e.session.listening = pristine.listening
  e.session.activityTransport = pristine.transport
  e.session.activityBackgroundTaskCount = pristine.count
  e.session.listenStartedAt = pristine.startedAt
  e.subagentMeta = pristine.meta
})

const messages = (): Message[] => [
  { role: 'user', createdAt: 1_700_000_000_000, parts: [{ type: 'text', text: '조사해줘' }] },
  { role: 'assistant', createdAt: 1_700_000_000_001, parts: [{ type: 'text', text: '시작합니다' }] }
]

// 세션 상태를 시드하고 마지막 교환을 렌더한다. `last` 가 이 줄을 어디에 한 번 세울지 정한다.
function render(opts: {
  transport: 'idle' | 'ready' | 'listening'
  backgroundTaskCount: number
  meta?: Record<string, SubagentMetaState>
  last?: boolean
}): string {
  const e = entry()
  e.session.messages = messages()
  e.session.listening = opts.transport !== 'idle'
  e.session.activityTransport = opts.transport
  e.session.activityBackgroundTaskCount = opts.backgroundTaskCount
  e.session.listenStartedAt = Date.now() - 90_000
  e.subagentMeta = opts.meta ?? {}
  const groups = groupExchanges(e.session.messages)
  return renderToStaticMarkup(
    createElement(Exchange, {
      exchange: groups[groups.length - 1]!,
      transcriptPolicy: agentUiPolicy('code').transcript,
      reserve: false,
      pending: false,
      last: opts.last ?? true
    })
  )
}

describe('0231 — 백그라운드 실행 줄', () => {
  it('AT-112 — ready + 백그라운드 잔여면 마지막 턴 아래에 선다', () => {
    const html = render({ transport: 'ready', backgroundTaskCount: 2 })
    expect(html).toContain('백그라운드 작업 2건')
    // 마지막 어시스턴트 턴 **뒤**다 — 위가 아니다.
    expect(html.indexOf('시작합니다')).toBeLessThan(html.indexOf('백그라운드 작업 2건'))
    // 목록으로 들어가는 어포던스가 있다(D-105).
    expect(html).toContain('role="button"')
  })

  it('AT-113 — 잔여가 없으면 서지 않는다', () => {
    expect(render({ transport: 'ready', backgroundTaskCount: 0 })).not.toContain('백그라운드 작업')
  })

  it('AT-113 — 어시스턴트가 실제 스트리밍 중(listening)이면 서지 않는다 — 스피너 자리다', () => {
    const html = render({ transport: 'listening', backgroundTaskCount: 2 })
    expect(html).not.toContain('백그라운드 작업 2건')
  })

  it('요약이 있으면 꼬리에 한 줄로 붙는다', () => {
    const html = render({
      transport: 'ready',
      backgroundTaskCount: 1,
      meta: { t1: { startedAtMs: 1, summary: '테스트를 돌리는 중' } }
    })
    expect(html).toContain('테스트를 돌리는 중')
  })

  it('재시도 중이면 요약 대신 재시도를 말한다', () => {
    const html = render({
      transport: 'ready',
      backgroundTaskCount: 1,
      meta: {
        t1: {
          startedAtMs: 1,
          summary: '테스트를 돌리는 중',
          retry: { attempt: 2, maxRetries: 5, errorCategory: 'overloaded' }
        }
      }
    })
    expect(html).toContain('재시도 대기 중 2/5')
    expect(html).not.toContain('테스트를 돌리는 중')
  })

  it('**배선** — 마지막 교환이 아니면 세우지 않는다(가상화된 head 에 중복 금지)', () => {
    const html = render({ transport: 'ready', backgroundTaskCount: 2, last: false })
    expect(html).not.toContain('백그라운드 작업 2건')
  })
})
