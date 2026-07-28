import { randomUUID } from 'node:crypto'
import type {
  ClassifiedError,
  DebugMockState,
  InstallStatus,
  ProviderDescriptor
} from '../../shared/ipc'
import type { TurnRequest } from './turn'
import { CLAUDE_DESCRIPTOR } from './descriptor'
import { claudeErrorClassifier } from './error-classifier'
import type { LiveTurn, SessionAdapter } from './types'
import { runScenario, SCENARIOS } from './mock-scenarios'

export class MockAdapter implements SessionAdapter {
  readonly id = 'claude' as const

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

  classifyError(error: unknown, phase: string): ClassifiedError {
    return claudeErrorClassifier.classify(error, { provider: this.id, phase })
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
      close: () => internal.abort(),
      setPermissionMode: async () => {},
      // mock 은 큐 프로토콜이 없다 — 영수증 미보유(undefined = 잔여 미상)로 보고한다(0151 AC10).
      interrupt: async () => {
        internal.abort()
        return undefined
      },
      canSteer: false,
      setModel: async () => {},
      // mock 은 시나리오 스크립트가 subagent.task settled(stopped)를 직접 emit 해 중단을 시연한다.
      stopTask: async () => {},
      backgroundTask: async () => false
    }
  }
}

function combineSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  return a ? AbortSignal.any([a, b]) : b
}
