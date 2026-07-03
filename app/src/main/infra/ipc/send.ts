// main→renderer push 헬퍼. 특정 owner 없는 브로드캐스트(concurrency·sessionTitle)와 turn owner
// 타깃 전송(chatEvent·installStatus)을 한 곳에 모은다. 버스 팬아웃 이득이 없는 renderer push 는
// 여기 직접 호출을 유지한다(bus-events.ts 주석 참조 — 과도한 버스화 금지).

import { webContents, type WebContents } from 'electron'
import {
  CHANNELS,
  type ConcurrencyEvent,
  type InstallStatus,
  type NormalizedEvent,
  type SessionTitleEvent
} from '../../../shared/ipc'

// 디버그 패널의 "Wire 메시지" 토글 상태(dev 전용). sendChatEvent 는 자유 함수라
// ctx 접근이 없어 모듈 스코프 플래그로 둔다 — debugSetMock 핸들러가 동기화한다.
// 기본 false + 토글 핸들러가 DEV 전용이라 프로덕션 경로는 항상 무출력.
let wireLogEnabled = false

export function setWireLog(on: boolean): void {
  wireLogEnabled = on
}

export function sendChatEvent(wc: WebContents, ev: NormalizedEvent): void {
  if (wireLogEnabled) console.log('[wire]', ev.type, ev)
  if (!wc.isDestroyed()) wc.send(CHANNELS.chatEvent, ev)
}

export function broadcastConcurrency(ev: ConcurrencyEvent): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) wc.send(CHANNELS.concurrencyEvent, ev)
  }
}

export function sendInstallStatus(wc: WebContents, st: InstallStatus): void {
  if (!wc.isDestroyed()) wc.send(CHANNELS.installStatus, st)
}

export function broadcastSessionTitle(ev: SessionTitleEvent): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) wc.send(CHANNELS.sessionTitleEvent, ev)
  }
}
