import type { Backend, NormalizedEvent, ProviderDescriptor } from '../../shared/ipc'
import type { TurnRequest } from '../extensions/types'

export type { Backend, NormalizedEvent }

export interface SessionAdapter {
  readonly id: Backend
  // 이 백엔드가 *지원하는* 능력 서술자 (capabilities/types.ts). UI 의 사전 게이팅·지표 소비자가
  // 읽는다. computed-on-the-fly — DB 영속 없이 매 backend:list 응답에 부착된다(§4/§15).
  describe(): ProviderDescriptor
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  // 한 턴 실행. 확장 리소스(mcp·skills·hooks·systemPrompt)는 req.extensions 로, uv 런타임 env 는
  // req.env 로 전달된다 — 위치 인자 증식(구 7개) 대신 단일 TurnRequest 로 통합 (설계검토 §9).
  // provider 중립 NormalizedEvent 스트림(provider-runtime.md §2)을 yield 한다.
  sendMessage(req: TurnRequest): AsyncIterable<NormalizedEvent>
}
