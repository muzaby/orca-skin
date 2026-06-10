import { randomUUID } from 'node:crypto'
import type { DebugMockState, InstallStatus, ProviderDescriptor } from '../../shared/ipc'
import type { TurnRequest } from '../extensions/types'
import { CLAUDE_DESCRIPTOR } from '../capabilities/claude-probe'
import type { LiveTurn, SessionAdapter } from './types'
import { runScenario, SCENARIOS } from './mock-scenarios'

export class MockAdapter implements SessionAdapter {
  readonly id = 'claude-code' as const

  constructor(private readonly getState: () => DebugMockState) {}

  describe(): ProviderDescriptor {
    return CLAUDE_DESCRIPTOR
  }

  async isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }> {
    return { installed: true, version: 'mock' }
  }

  async *install(): AsyncIterable<InstallStatus> {
    yield { step: 'mock-ready', done: true }
  }

  async complete(): Promise<string> {
    return 'Mock 자동 제목'
  }

  sendMessage(req: TurnRequest): LiveTurn {
    const state = this.getState()
    const internal = new AbortController()
    const signal = combineSignals(req.signal, internal.signal)
    const sessionId = req.sessionId ?? randomUUID()
    return {
      events: runScenario(SCENARIOS[state.scenarioId], {
        sessionId,
        cwd: req.cwd,
        contextUsageRatio: state.contextUsageRatio,
        signal,
        requestApproval: req.requestApproval
      }),
      setPermissionMode: async () => {},
      interrupt: async () => internal.abort(),
      setModel: async () => {}
    }
  }
}

function combineSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b
  if (a.aborted) {
    const controller = new AbortController()
    controller.abort()
    return controller.signal
  }
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  a.addEventListener('abort', abort, { once: true })
  b.addEventListener('abort', abort, { once: true })
  return controller.signal
}
