import type {
  Backend,
  ClassifiedError,
  NormalizedEvent,
  ProviderDescriptor
} from '../../shared/ipc'
import type { ClaudePermissionMode } from '../../shared/permission-mode'
import type { TurnRequest } from './turn'
import type { ResolvedProviderSettings } from './provider-config'

export type { Backend, NormalizedEvent }

// 한 턴의 라이브 핸들 (provider-runtime.md §3, PR③ 옵션 A). 턴 진행 중에만 유효하다 —
// `events` 소비가 끝나면 핸들이 닫힌다. control 3종은 스트리밍 입력 모드에서만 동작하는 SDK
// Query 메서드(setPermissionMode/interrupt/setModel)에 위임된다. 라이브 미지원 백엔드는
// no-op 구현을 돌려줄 수 있다(다음-턴 모드로 폴백).
export interface LiveTurn {
  events: AsyncIterable<NormalizedEvent>
  // 멱등 cleanup 계약 — terminal 관측, consumer 조기 종료, abort path 에서 모두 안전해야 한다.
  close(): void
  setPermissionMode(mode: ClaudePermissionMode): Promise<void>
  interrupt(): Promise<void>
  // steer UX 수용 여부 — 전달은 어댑터 게이트 훅(TurnRequest.takeSteerFlush) 또는 다음 턴
  // carryover(0060 D2/D3). mid-turn stdin 직주입 경로(injectMessage)는 0060 D3 에서 제거됐다.
  readonly canSteer?: boolean
  setModel(model?: string): Promise<void>
  // 서브에이전트(Task) 단위 중단 — SDK task_id 로 stopTask. 백엔드 미지원 시 no-op 가능.
  stopTask(taskId: string): Promise<void>
  // foreground 서브에이전트를 백그라운드로 — stopTask 가 foreground 를 거부할 때의 fallback 경로.
  backgroundTask(toolUseId: string): Promise<boolean>
}

export interface CompleteRequest {
  prompt: string
  model?: string
  cwd?: string
  signal?: AbortSignal
  // 해석 완료 provider settings (handoff 0014). 자동 제목 생성 complete 경로도 sendMessage 와
  // 같은 provider settings/격리모드를 쓴다 (대칭 — 0005 의 "settingSources 미지정" 결정 폐기).
  providerSettings?: ResolvedProviderSettings
  // subprocess env (orca.json 앱 전역 env). sendMessage 경로와 동일 조립 결과를 받는다.
  env?: Record<string, string>
}

export interface SessionAdapter {
  readonly id: Backend
  // 이 백엔드가 *지원하는* 능력 서술자 (capabilities/types.ts). UI 의 사전 게이팅·지표 소비자가
  // 읽는다. computed-on-the-fly — DB 영속 없이 매 backend:list 응답에 부착된다(§4/§15).
  describe(): ProviderDescriptor
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  // 세션 resume 과 무관한 단발 completion. 자동 제목 생성처럼 대화 컨텍스트를 오염시키면
  // 안 되는 보조 호출에만 쓴다. router 는 provider 별 저가 모델을 알지 않는다.
  complete(req: CompleteRequest): Promise<string>
  // 한 턴 실행. 확장 리소스(mcp·skills·hooks·systemPrompt)는 req.extensions 로, orca.json 앱 env 는
  // req.env 로 전달된다 — 위치 인자 증식(구 7개) 대신 단일 TurnRequest 로 통합 (설계검토 §9).
  // 라이브 핸들(LiveTurn)을 돌려준다 — `events` 가 provider 중립 NormalizedEvent 스트림(§2),
  // control 메서드는 턴 진행 중 권한 모드 라이브 전환 등에 쓰인다.
  sendMessage(req: TurnRequest): LiveTurn
  // 이 백엔드의 임의 예외를 provider 중립 ClassifiedError 로 정규화한다(provider-runtime.md §6).
  // 오케스트레이션(ipc/chat)이 특정 엔진 분류기를 직접 import 하지 않도록 어댑터가 소유한다 —
  // 어댑터가 자기 id 를 provider 로 채운다. phase 는 발생 단계(예: 'sendMessage').
  classifyError(error: unknown, phase: string): ClassifiedError
}
