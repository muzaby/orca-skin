// main→renderer push 헬퍼. 특정 owner 없는 브로드캐스트(concurrency·sessionTitle)와 turn owner
// 타깃 전송(chatEvent·installStatus)을 한 곳에 모은다. 버스 팬아웃 이득이 없는 renderer push 는
// 여기 직접 호출을 유지한다(bus-events.ts 주석 참조 — 과도한 버스화 금지).

import { webContents, type WebContents } from 'electron'
import {
  CHANNELS,
  type ConcurrencyEvent,
  type InstallStatus,
  type NormalizedEvent,
  type SessionTitleEvent,
  type AuthPlatformState,
  type UpdateProgress,
  type UpdateState
} from '../../../shared/ipc'

import { wireLog } from './wire-log'

// wire 플래그 정본은 wire-log.ts(electron 비의존, 0068) — 기존 import 경로 무회귀 re-export.
export { setWireLog } from './wire-log'

export function sendChatEvent(wc: WebContents, ev: NormalizedEvent): void {
  wireLog(ev.type, ev)
  if (!wc.isDestroyed()) wc.send(CHANNELS.chatEvent, ev)
}

export function broadcastChatEvent(ev: NormalizedEvent): void {
  wireLog(ev.type, ev)
  broadcast(CHANNELS.chatEvent, ev)
}

// owner 무관 전-창 팬아웃 — 살아있는 webContents 전부에 push.
function broadcast(channel: string, payload: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) wc.send(channel, payload)
  }
}

export function broadcastConcurrency(ev: ConcurrencyEvent): void {
  broadcast(CHANNELS.concurrencyEvent, ev)
}

export function sendInstallStatus(wc: WebContents, st: InstallStatus): void {
  if (!wc.isDestroyed()) wc.send(CHANNELS.installStatus, st)
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

export function broadcastAuthState(state: AuthPlatformState): void {
  broadcast(CHANNELS.authStateEvent, state)
}
