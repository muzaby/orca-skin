// main 이벤트 버스의 이벤트 맵(아키텍처 스펙 §4.2). v1 은 turn.event 단일 이벤트 — NormalizedEvent
// 가 이미 discriminated union 이라 소비자가 `ev.type` 으로 필터한다. costSummary/sessionTitle/
// concurrency 브로드캐스트는 특정 owner 없는 renderer push 라 버스 팬아웃 이득이 없어 infra/ipc
// send 헬퍼 직접 호출을 유지한다(과도한 버스화 금지).
//
// bus/index.ts(TypedBus)는 순수 제네릭이라 이 맵을 모른다 — 소비 측(turn-coordinator·bootstrap)이
// 여기 정의를 타입 인자로 주입한다. TurnContext 를 참조하므로 turn-context 와 같은 레이어에 둔다.

import type { NormalizedEvent } from '../../shared/ipc'
import type { TypedBus } from '../infra/bus'
import type { TurnContext } from './turn'

export interface OrcaBusEvents<W = unknown> {
  // 어댑터 스트림 + 합성(telemetry·settle) 이벤트의 단일 팬아웃 지점.
  'turn.event': { turn: TurnContext<W>; ev: NormalizedEvent }
}

export type MainBus<W = unknown> = TypedBus<OrcaBusEvents<W>>

// turn.event 를 방출하는 얇은 콜백 — settle 등 버스를 직접 알 필요 없는 순수 함수에 주입한다.
export type TurnEmit<W = unknown> = (turn: TurnContext<W>, ev: NormalizedEvent) => void
