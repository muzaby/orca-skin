// 셸 ↔ 에이전트 호스트 메시지 계약 (0324 EP-11 · EP-14). 두 프로세스가 같은 스키마로 검증한다.
//
// 지금 있는 것은 호스트 → 셸 방향의 두 묶음이다: 수명 이벤트 다섯 가지(D-027)와 UI 언어 사본
// 알림(D-032 — 수명 이벤트가 아니다).

import { z } from 'zod'

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
  // DB 마이그레이션까지 끝나 요청을 받을 수 있다.
  z.object({ type: z.literal('ready'), mirror: ShellMirrorSchema }),
  z.object({ type: z.literal('lifecycle'), event: LifecycleEventSchema }),
  z.object({ type: z.literal('shell.mirror'), mirror: ShellMirrorSchema })
])
export type HostToShell = z.infer<typeof HostToShellSchema>
