import { describe, expect, it, vi } from 'vitest'
import type { Backend, ChatActivitySnapshot } from '../../shared/ipc'
import { createClaudeProcessReset, planClaudeProcesses } from './claude-processes'

const idle = (sessionId: string): ChatActivitySnapshot => ({
  type: 'chat.activity',
  sessionId,
  revision: 0,
  foreground: 'idle',
  transport: 'idle',
  queuedCount: 0,
  deliveryPendingCount: 0,
  residualCount: 0,
  backgroundTaskCount: 0
})

type Signal = 'lease' | 'responding' | Partial<ChatActivitySnapshot>
const signals: Array<[string, Signal]> = [
  ['lease', 'lease'],
  ['responding', 'responding'],
  ['foreground preparing', { foreground: 'preparing' }],
  ['foreground streaming', { foreground: 'streaming' }],
  ['transport listening', { transport: 'listening' }],
  ['queued', { queuedCount: 1 }],
  ['delivery pending', { deliveryPendingCount: 1 }],
  ['residual', { residualCount: 1 }],
  ['background task', { backgroundTaskCount: 1 }],
  ['pending session wakeup', { pendingSessionWakeup: true }],
  ['session schedules', { sessionSchedules: [{ id: 'job' }] as never }]
]

describe('planClaudeProcesses', () => {
  it.each(signals)('counts %s alone as one busy Claude session', (_name, signal) => {
    const plan = planClaudeProcesses({
      leases:
        signal === 'lease'
          ? [{ leaseId: 'L', sessionId: 'claude-A', backend: 'claude', kind: 'active' }]
          : [],
      runtimes: [{ sessionId: 'claude-A', runtime: { responding: signal === 'responding' } }],
      backendOf: () => 'claude',
      activity: (sessionId) => ({
        ...idle(sessionId),
        ...(typeof signal === 'object' ? signal : {})
      })
    })
    expect(plan).toEqual({ targets: [{ sessionId: 'claude-A', busy: true }], busy: 1 })
  })

  it('counts each busy signal once and ignores idle Claude, OpenCode and closing entries', () => {
    const backends: Record<string, Backend> = {
      'claude-busy': 'claude',
      'claude-idle': 'claude',
      'claude-unrecorded': 'claude',
      'claude-closing': 'claude',
      'open-busy': 'opencode',
      'open-idle': 'opencode'
    }
    const plan = planClaudeProcesses({
      leases: [
        // lease + responding + residual on one session is still one busy session.
        { leaseId: 'L1', sessionId: 'claude-busy', backend: 'claude', kind: 'active' },
        // backend missing on the lease → the session row decides.
        { leaseId: 'L2', sessionId: 'claude-unrecorded', kind: 'preparing' },
        { leaseId: 'L3', sessionId: null, backend: 'claude', kind: 'preparing' },
        { leaseId: 'L4', sessionId: 'claude-closing', backend: 'claude', kind: 'closing' },
        { leaseId: 'L5', sessionId: 'open-busy', backend: 'opencode', kind: 'active' },
        { leaseId: 'L6', sessionId: null, backend: 'opencode', kind: 'preparing' }
      ],
      runtimes: [
        { sessionId: 'claude-busy', runtime: { responding: true } },
        { sessionId: 'claude-idle', runtime: {} },
        { sessionId: 'claude-closing', runtime: { responding: true } },
        { sessionId: 'open-busy', runtime: { responding: true } },
        { sessionId: 'open-idle', runtime: {} }
      ],
      backendOf: (sessionId) => backends[sessionId],
      activity: (sessionId) => ({
        ...idle(sessionId),
        residualCount: sessionId === 'claude-busy' || sessionId === 'open-idle' ? 1 : 0
      })
    })
    expect(plan).toEqual({
      targets: [
        { sessionId: 'claude-busy', busy: true },
        { sessionId: 'claude-unrecorded', busy: true },
        { leaseId: 'L3', busy: true },
        { sessionId: 'claude-idle', busy: false }
      ],
      busy: 3
    })
  })
})

describe('createClaudeProcessReset', () => {
  it('dispatches session targets to session discard and session-less leases to lease discard and continues after a failure', () => {
    const order: string[] = []
    const failure = new Error('close failed')
    const deps = {
      supervisor: {
        allLeases: vi.fn(() => [
          { leaseId: 'L1', sessionId: null, backend: 'claude' as const, kind: 'preparing' }
        ]),
        runtimeEntries: vi.fn(() => [
          { sessionId: 'A', runtime: {} },
          { sessionId: 'B', runtime: { responding: true } }
        ]),
        discardLease: vi.fn((leaseId: string) => {
          order.push(`lease:${leaseId}`)
          return true
        })
      },
      backendOf: vi.fn((): Backend => 'claude'),
      activity: vi.fn(idle),
      discardSession: vi.fn((sessionId: string) => {
        order.push(`session:${sessionId}`)
        if (sessionId === 'A') throw failure
      }),
      failed: vi.fn()
    }
    const reset = createClaudeProcessReset(deps)
    const plan = reset.plan()
    expect(plan).toEqual({
      targets: [
        { leaseId: 'L1', busy: true },
        { sessionId: 'A', busy: false },
        { sessionId: 'B', busy: true }
      ],
      busy: 2
    })
    expect(deps.activity).toHaveBeenCalledWith('A')
    reset.close(plan.targets)
    expect(order).toEqual(['lease:L1', 'session:A', 'session:B'])
    expect(deps.failed).toHaveBeenCalledExactlyOnceWith(failure)
  })
})
