// 셸 ↔ 호스트 메시지 계약 (0324 EP-11 · EP-14 · EP-19 · EP-21). 셸과 두 호스트가 같은 스키마로 검증한다.
//
// 호스트 → 셸: 준비 · 수명 이벤트 다섯 가지(에이전트 호스트, D-027) · UI 언어 사본(데이터 호스트,
// D-032·F5) · 셸 서비스 요청 · 반대편 호스트 확보 요청(데이터 호스트, D-044).
// 셸 → 호스트: 창 포트 · 피어 포트 · 종료 · 서비스 응답 · 깨어남 · 확보 실패.

import { z } from 'zod'
import { WAKE_REASONS } from './shell-services'

const SessionId = z.string().min(1)

// 수명 이벤트 — 셸은 이 다섯 가지로만 턴·세션 상태를 안다.
export const LifecycleEventSchema = z.discriminatedUnion('type', [
  // 턴의 첫 이벤트.
  z.object({ type: z.literal('turn.started'), sessionId: SessionId }),
  // 턴이 끝났다(완료·오류·취소).
  z.object({ type: z.literal('turn.ended'), sessionId: SessionId }),
  // 사용자의 승인을 기다린다. 그 세션의 `turn.ended` 가 지운다.
  z.object({ type: z.literal('approval.pending'), sessionId: SessionId }),
  // 세션이 폐기됐다.
  z.object({ type: z.literal('session.ended'), sessionId: SessionId }),
  // 하네스 스트림이 종료 없이 끊겼다.
  z.object({ type: z.literal('harness.exited'), sessionId: SessionId })
])
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>

// 호스트의 설정에서 셸이 사본으로 갖는 값.
export const ShellMirrorSchema = z.object({ uiLocale: z.enum(['ko', 'en']) })
export type ShellMirror = z.infer<typeof ShellMirrorSchema>

// 호스트 → 셸 메시지.
export const HostToShellSchema = z.discriminatedUnion('type', [
  // 요청을 받을 수 있다(데이터 호스트: 마이그레이션·복구 뒤). 언어 사본은 데이터 호스트만 싣는다.
  z.object({ type: z.literal('ready'), mirror: ShellMirrorSchema.optional() }),
  z.object({ type: z.literal('lifecycle'), event: LifecycleEventSchema }),
  z.object({ type: z.literal('shell.mirror'), mirror: ShellMirrorSchema }),
  // 셸 서비스 요청(EP-10). 이름·인자는 `shell-services.ts` 가 검증한다.
  z.object({
    type: z.literal('service.call'),
    id: z.number().int().nonnegative(),
    name: z.string().min(1),
    args: z.array(z.unknown())
  }),
  // 데이터 호스트 → 셸: 실행이 필요한 교차 요청이 왔는데 에이전트 호스트가 없다(D-044).
  z.object({ type: z.literal('peer.ensure') }),
  // 데이터 호스트 → 셸: 주기 업데이트 확인 잡이 돌았다 — 업데이트는 셸이 소유한다.
  z.object({ type: z.literal('update.check') }),
  // 기동 중 호스트 → 셸: 끊을 수 없는 긴 단계(데이터 호스트의 DB 열기·백업·마이그레이션·복구)의 시작·끝.
  // 그 사이 셸의 감독자는 준비 마감을 세지 않는다(D-055).
  z.object({ type: z.literal('boot.step'), state: z.enum(['begin', 'end']) })
])
export type HostToShell = z.infer<typeof HostToShellSchema>

// ── 창 ↔ 에이전트 호스트 포트 (EP-8 · EP-9) ─────────────────────────────────────────────────
// 창마다 포트 하나다. preload 가 요청·단방향 송신을 보내고, 호스트가 응답과 통지를 보낸다.

// 창 → 호스트.
export const ClientToHostSchema = z.discriminatedUnion('kind', [
  // 응답이 있는 요청. `id` 는 그 포트 안에서만 유일하면 된다.
  z.object({
    kind: z.literal('invoke'),
    id: z.number().int().nonnegative(),
    channel: z.string().min(1),
    payload: z.unknown().optional()
  }),
  // 응답 없는 단방향 송신.
  z.object({ kind: z.literal('send'), channel: z.string().min(1), payload: z.unknown().optional() })
])
export type ClientToHost = z.infer<typeof ClientToHostSchema>

// 호스트 → 창. `result` 가 성공·실패 두 모양이라 판별 유니온(같은 판별 값 금지)이 아니라 유니온이다.
export const HostToClientSchema = z.union([
  z.object({
    kind: z.literal('result'),
    id: z.number().int().nonnegative(),
    ok: z.literal(true),
    value: z.unknown().optional()
  }),
  z.object({
    kind: z.literal('result'),
    id: z.number().int().nonnegative(),
    ok: z.literal(false),
    error: z.string()
  }),
  z.object({
    kind: z.literal('event'),
    channel: z.string().min(1),
    payload: z.unknown().optional()
  })
])
export type HostToClient = z.infer<typeof HostToClientSchema>

// 셸 → 호스트 메시지.
export const ShellToHostSchema = z.discriminatedUnion('type', [
  // 창의 포트를 함께 넘긴다. `trusted` 는 셸이 넘기는 시점에 한 번 판정한 값이다 — 호스트는
  // 창과 URL 을 볼 수 없다.
  z.object({
    type: z.literal('client.connect'),
    clientId: z.number().int(),
    trusted: z.boolean()
  }),
  // 정상 종료 요청. 호스트는 정리한 뒤 스스로 끝난다.
  z.object({ type: z.literal('shutdown') }),
  // 업데이트 설치 직전 — 쉬는 런타임을 닫는다.
  z.object({ type: z.literal('update.prepare-install') }),
  // 셸 서비스 응답. 성공이면 `value`, 실패면 `error` 다(판별 값을 하나로 둔다).
  z.object({
    type: z.literal('service.result'),
    id: z.number().int().nonnegative(),
    ok: z.boolean(),
    value: z.unknown().optional(),
    error: z.string().optional()
  }),
  // 시스템이 깨어났다(절전 해제·화면 잠금 해제·창 포커스) — 호스트의 재확인 신호.
  z.object({ type: z.literal('wake'), reason: z.enum(WAKE_REASONS) }),
  // 반대편 호스트와의 피어 포트를 함께 넘긴다. 반대편이 다시 뜰 때마다 새로 온다.
  z.object({ type: z.literal('peer.connect') }),
  // 셸이 에이전트 호스트를 띄우지 못했다(기동 실패 상한) — `peer.ensure` 의 답.
  z.object({ type: z.literal('peer.unavailable') }),
  // 로그인 창이 이동했다 — 끝났는지 호스트가 `session.loginVerdict` 로 답한다(파티션 세션).
  z.object({
    type: z.literal('login.navigated'),
    loginId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    url: z.string()
  })
])
export type ShellToHost = z.infer<typeof ShellToHostSchema>

// ── 셸 ↔ preload — 호스트 포트 전달 (EP-9 · §7-E) ─────────────────────────────────────────────
// renderer 에는 나가지 않는 preload 전용 채널이다(`window.oo` 에 없다).
export type HostName = 'agent' | 'data'
// 셸 → preload: 그 호스트의 새 포트(메시지에 동봉). payload `{ host }`.
export const HOST_PORT_CHANNEL = 'oo:host:port'
// 셸 → preload: 그 호스트가 종료됐다 — 기다리던 요청을 실패시키고 다음 요청에서 다시 잇는다.
// payload `{ host }`.
export const HOST_EXITED_CHANNEL = 'oo:host:exited'
// preload → 셸: 포트를 달라. 문서가 새로 읽힐 때 두 호스트 모두(`'all'`), 에이전트 호스트가 죽은 뒤 첫
// 요청에서 `'agent'`.
export const HOST_CONNECT_CHANNEL = 'oo:host:connect'
export const HostConnectRequestSchema = z.object({ host: z.enum(['agent', 'data', 'all']) })
