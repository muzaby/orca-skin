import { describe, expect, it } from 'vitest'
import {
  CONCURRENCY_ORDER,
  concurrencyFixtureRefs,
  type ConcurrencyOrderScenario,
  type ConcurrencyRefTag
} from '../../../../../shared/concurrency-order.testfixture'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import {
  chatActions,
  ingestChatEvent,
  otherProjectTurnCount,
  sessionResponding,
  useChatStore
} from './chatStore'
import { installConcurrencyHarness } from './chatStore.concurrency.testfixture'

type Step = { column: 'L' | 'C' | 'K'; index: number }

// Preserve each channel's order, constrain Stop's aborted event to follow cancel.
function interleavings(scenario: ConcurrencyOrderScenario): Step[][] {
  const results: Step[][] = []
  function visit(l: number, c: number, k: number, prefix: Step[]): void {
    if (l === scenario.local.length && c === scenario.chat.length && k === scenario.lists.length) {
      results.push(prefix)
      return
    }
    if (l < scenario.local.length) visit(l + 1, c, k, [...prefix, { column: 'L', index: l }])
    if (l === 0) return
    if (
      c < scenario.chat.length &&
      !(
        scenario.chat[c] === 'aborted' &&
        scenario.local.includes('cancel') &&
        l < scenario.local.length
      )
    )
      visit(l, c + 1, k, [...prefix, { column: 'C', index: c }])
    if (k < scenario.lists.length) visit(l, c, k + 1, [...prefix, { column: 'K', index: k }])
  }
  visit(0, 0, 0, [])
  return results
}

function chatEvent(step: ConcurrencyOrderScenario['chat'][number]): NormalizedEvent {
  switch (step) {
    case 'confirm':
      return { type: 'session.updated', sessionId: 's1', patch: {} }
    case 'managed':
      return {
        type: 'session.updated',
        sessionId: 's1',
        patch: { worktree: { sourceCwd: '/repo', repoRoot: '/repo' } }
      }
    case 'recovered':
      return { type: 'session.updated', sessionId: 's1', patch: { worktree: null } }
    case 'telemetry':
      return { type: 'telemetry', sessionId: 's1' }
    case 'ended':
      return { type: 'turn.ended', sessionId: 's1' }
    case 'error':
      return {
        type: 'error',
        sessionId: 's1',
        error: { category: 'stream_error', message: 'failed', retryable: false }
      }
    case 'aborted':
      return { type: 'turn.aborted', sessionId: 's1', reason: 'user_cancelled' }
    case 'listening':
    case 'idle':
      return {
        type: 'chat.activity',
        sessionId: 's1',
        revision: step === 'listening' ? 1 : 2,
        foreground: 'idle',
        transport: step,
        queuedCount: 0,
        deliveryPendingCount: 0,
        residualCount: 0,
        backgroundTaskCount: 0
      }
  }
}

describe('SD-2 all channel interleavings and every prefix', () => {
  it.each(CONCURRENCY_ORDER)(
    '$id identity predicate is independent of local response state',
    (scenario) => {
      const traces = interleavings(scenario)
      expect(traces.length).toBeGreaterThan(0)
      let prefixes = 0
      let asIsFalsePositive = 0
      let asIsFalseNegative = 0
      for (const trace of traces) {
        const f = installConcurrencyHarness({
          newSession: scenario.newSession && scenario.local[0] !== 'handoff',
          isolation: scenario.isolation,
          handoffSource: scenario.local[0] === 'handoff'
        })
        let tags: readonly ConcurrencyRefTag[] = scenario.initialOther ? ['other'] : []
        let draft = 'unallocated-draft'
        let recovered = false
        try {
          f.emit({ projectId: 'p1', turns: concurrencyFixtureRefs(tags, draft) })
          const observe = (): void => {
            const state = useChatStore.getState()
            const expected = scenario.id.startsWith('O')
              ? tags.includes('other')
              : scenario.id === 'W4'
                ? recovered && tags.includes('other')
                : false
            expect(
              otherProjectTurnCount(state, 'p1') > 0,
              `${scenario.id} ${JSON.stringify(trace)} prefix=${prefixes}`
            ).toBe(expected)
            const old =
              (state.concurrencyByProjectId.p1?.length ?? 0) -
                (sessionResponding(state.sessions[state.activeKey].session) ? 1 : 0) >
              0
            if (old && !expected) asIsFalsePositive++
            if (!old && expected) asIsFalseNegative++
            prefixes++
          }
          observe()
          for (const step of trace) {
            if (step.column === 'L') {
              switch (scenario.local[step.index]) {
                case 'send':
                  expect(chatActions.send('work')).toBe(true)
                  break
                case 'handoff':
                  expect(chatActions.startHandoff()).toBe(true)
                  break
                case 'cancel':
                  chatActions.cancel()
                  break
              }
              draft =
                useChatStore.getState().sessions[useChatStore.getState().activeKey].clientKey ??
                draft
            } else if (step.column === 'C') {
              const kind = scenario.chat[step.index]
              ingestChatEvent(chatEvent(kind))
              if (kind === 'recovered') recovered = true
            } else {
              tags = scenario.lists[step.index]
              f.emit({ projectId: 'p1', turns: concurrencyFixtureRefs(tags, draft) })
            }
            observe()
          }
        } finally {
          f.cleanup()
        }
      }
      expect(prefixes).toBeGreaterThan(traces.length)
      if (scenario.id === 'P1' || scenario.id === 'W1') expect(asIsFalsePositive).toBeGreaterThan(0)
      if (scenario.id === 'O2') expect(asIsFalseNegative).toBeGreaterThan(0)
    }
  )
})
