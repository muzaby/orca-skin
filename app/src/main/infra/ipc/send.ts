// main→renderer push 헬퍼. 특정 owner 없는 브로드캐스트(concurrency·sessionTitle)와 turn owner
// 타깃 전송(chatEvent·installStatus)을 한 곳에 모은다. 버스 팬아웃 이득이 없는 renderer push 는
// 여기 직접 호출을 유지한다(bus-events.ts 주석 참조 — 과도한 버스화 금지).

import {
  CHANNELS,
  type ConcurrencyEvent,
  type HarnessAvailability,
  type InstallStatus,
  type NormalizedEvent,
  type ProviderPlatformState,
  type SessionTitleEvent,
  type UpdateProgress,
  type UpdateState
} from '../../../shared/ipc'

import type { BackgroundEvent } from '../../../shared/background-task'
import type { ScheduledPromptStart } from '../../../shared/scheduled-tasks'
import type {
  ExtensionsChanged,
  NativeResourcesChanged,
  OpenCodePluginsChanged
} from '../../../shared/native-resources'
import type { UsageDelta } from '../../../shared/usage/limits'
import { ipcTransport, type ClientRef } from './transport'
import { wireLog } from './wire-log'

export function broadcastHarnessAvailability(state: HarnessAvailability): void {
  broadcast(CHANNELS.harnessAvailability, state)
}

export function broadcastExtensionsChanged(event: ExtensionsChanged): void {
  broadcast(CHANNELS.extensionsChanged, event)
}

export function broadcastOpenCodePluginsChanged(event: OpenCodePluginsChanged): void {
  broadcast(CHANNELS.extensionOpenCodePluginsChanged, event)
}

export function broadcastNativeResourcesChanged(event: NativeResourcesChanged): void {
  broadcast(CHANNELS.sessionNativeResourcesChanged, event)
}

// Canonical task facts use a separate channel; provider raw messages never enter wire logging.
export function broadcastBackgroundEvent(event: BackgroundEvent): void {
  broadcast(CHANNELS.chatBackgroundEvent, event)
}

// wire 플래그 정본은 wire-log.ts(electron 비의존, 0068) — 기존 import 경로 무회귀 re-export.
export { setWireLog } from './wire-log'

export function sendChatEvent(client: ClientRef, ev: NormalizedEvent): void {
  wireLog(ev.type, ev)
  client.send(CHANNELS.chatEvent, ev)
}

export function broadcastChatEvent(ev: NormalizedEvent): void {
  wireLog(ev.type, ev)
  broadcast(CHANNELS.chatEvent, ev)
}

// owner 무관 전-창 팬아웃 — 열려 있는 창 전부에 push.
export function broadcast(channel: string, payload: unknown): void {
  for (const client of ipcTransport().clients()) client.send(channel, payload)
}

// 예약 작업 — 작업·실행 상태가 바뀌었다는 신호만 보낸다(목록은 renderer 가 다시 읽는다).
export function broadcastScheduledTasksChanged(): void {
  broadcast(CHANNELS.scheduleChanged, null)
}

// 예약 프롬프트의 새 대화 시작 요청. 새 대화는 한 창이 맡아야 하므로 방송하지 않고 첫 창에만
// 보낸다. 보낼 창이 없으면 false.
export function sendScheduledPromptStart(payload: ScheduledPromptStart): boolean {
  const client = ipcTransport().primaryClient()
  if (!client || client.isClosed()) return false
  client.send(CHANNELS.schedulePromptStart, payload)
  return true
}

// 사용량 delta — 변경된 scope 만 나간다 (0186).
export function broadcastUsageDelta(delta: UsageDelta): void {
  broadcast(CHANNELS.costUsageEvent, delta)
}

export function broadcastManagedMcpChanged(revision: number): void {
  broadcast(CHANNELS.managedMcpChanged, { revision })
}

export function broadcastConcurrency(ev: ConcurrencyEvent): void {
  broadcast(CHANNELS.concurrencyEvent, ev)
}

export function sendInstallStatus(client: ClientRef, st: InstallStatus): void {
  client.send(CHANNELS.installStatus, st)
}

export function broadcastSessionTitle(ev: SessionTitleEvent): void {
  broadcast(CHANNELS.sessionTitleEvent, ev)
}

export function broadcastUpdateState(state: UpdateState): void {
  broadcast(CHANNELS.updateStateEvent, state)
}

export function broadcastUpdateProgress(progress: UpdateProgress): void {
  broadcast(CHANNELS.updateProgressEvent, progress)
}

// provider 플랫폼 상태 브로드캐스트(0181) — 로그인 진행·grant 변경. renderer store 가 구독해
// main 상태를 미러한다. **secret 은 이 페이로드에 없다**(상태·만료·principal 만).
export function broadcastProviderState(state: ProviderPlatformState): void {
  broadcast(CHANNELS.providerState, state)
}
