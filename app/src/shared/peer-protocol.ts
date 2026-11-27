// 데이터 호스트 ↔ 에이전트 호스트 피어 계약 (0324 AR-13 · EP-15 · EP-16 · EP-20 · F1~F4).
//
// 두 호스트는 셸이 중개한 포트 하나로 이야기한다. 한 포트의 도착 순서가 곧 처리 순서다 — 턴 저장
// 스트림(F1)의 순서가 저장 순서이고, 받는 쪽은 메시지를 도착한 차례대로 동기로 처리한다.
//
// 봉투는 셋이다: 응답이 있는 `request` · 응답 `result` · 응답 없는 `notify`. 메서드 이름은 아래 표에
// 있는 것만 받는다 — 모르는 이름·틀린 봉투는 스키마에서 거부한다. 메서드별 인자의 모양은 받는 쪽의
// 핸들러가 자기 스키마로 다시 본다(이 표는 방향과 봉투 종류만 고정한다).

import { z } from 'zod'
import type { AttachmentView, DiffRequirementAnchor } from './ipc'
import type { ReceivedMessageOrigin } from './session-schedules'

export interface UserCommitBatch {
  text: string
  createdAt: number
  messageKey?: string
  nativeMessageId?: string
  origin?: ReceivedMessageOrigin
  attachmentViews?: AttachmentView[]
  requirements?: DiffRequirementAnchor[]
}

export interface UserCommitResult {
  id: number
  created: boolean
}

export interface TurnAskAnswer {
  toolUseId: string
  output: unknown
  parentToolRunId?: string
  messageKey?: string
}

// 메서드 표. `from` 은 보내는 호스트, `kind` 는 봉투다.
export const PEER_METHODS = {
  // ── F1 턴 저장 스트림 (에이전트 → 데이터) ─────────────────────────────────────
  // 턴 시작 — 저장이 읽는 턴의 정적 필드.
  'turn.begin': { from: 'agent', kind: 'notify' },
  // 턴 이벤트 하나. 화면 중계는 이 응답을 기다리지 않는다(D-039).
  'turn.event': { from: 'agent', kind: 'notify' },
  // 산출물 참조를 싣는 턴 이벤트(도구 완료의 게시 영수증 · 출력 파일 담기) — DB 가 확인한 참조만 화면에
  // 실을 수 있어 응답(확인된 참조)을 기다린다. 같은 턴의 뒤 이벤트 중계는 그 뒤로 줄을 선다(구현 보고 PLAN_GAP).
  'turn.failureEvent': { from: 'agent', kind: 'request' },
  'turn.artifactEvent': { from: 'agent', kind: 'request' },
  // 질문 도구의 답.
  'turn.askAnswers': { from: 'agent', kind: 'notify' },
  // 사용자 메시지 커밋 — 응답은 DB 가 만든 메시지 id(없으면 null).
  'turn.commitUser': { from: 'agent', kind: 'request' },
  // 턴 끝 — 진행 중 어시스턴트 메시지를 마감한다.
  'turn.end': { from: 'agent', kind: 'notify' },
  // 백그라운드 작업 기록 — 응답 뒤에만 창에 공개한다.
  'provider.event': { from: 'agent', kind: 'request' },
  // 제공자 세션 잊기 — 이후 그 세션의 백그라운드 기록 0.
  'provider.forget': { from: 'agent', kind: 'notify' },
  // 데이터 호스트가 한 턴의 저장에 실패했다 — 에이전트 호스트가 그 턴을 오류로 끝낸다.
  'turn.persistFailed': { from: 'data', kind: 'notify' },

  // ── F2 턴 준비 조회 (에이전트 → 데이터) ───────────────────────────────────────
  // 실행 쪽 코드의 DB·비밀 조회는 모두 이 한 메서드로 간다. `op` 가 데이터 호스트의 조회 표 이름이다.
  'data.query': { from: 'agent', kind: 'request' },

  // ── F3 설정 사본 (데이터 → 에이전트) ─────────────────────────────────────────
  'settings.snapshot': { from: 'data', kind: 'notify' },
  'settings.patch': { from: 'data', kind: 'notify' },
  // 설정 쓰기 요청 — 사본은 패치 통지로만 바뀐다.
  'settings.write': { from: 'agent', kind: 'request' },

  // ── F4 교차 요청 ─────────────────────────────────────────────────────────────
  // 데이터 → 에이전트: 실행 쪽이 가진 것. `op` 가 에이전트 호스트의 실행 표 이름이다.
  'agent.call': { from: 'data', kind: 'request' },
  // 에이전트 → 데이터: 실행 쪽이 내는 쓰기(제목·작업 트리·분기 복사·확장 빌더 기록 등).
  'data.write': { from: 'agent', kind: 'request' },
  // 에이전트 호스트의 오류 보고·부팅 단계(D-042) — 데이터 호스트가 모아 창에 준다.
  'report.error': { from: 'agent', kind: 'notify' },
  'report.boot': { from: 'agent', kind: 'notify' },
  // 에이전트 호스트의 하네스 가용성 — 데이터 호스트의 모델 카탈로그·연결 상태가 읽는다.
  'harness.availability': { from: 'agent', kind: 'notify' },

  // ── 사본 (데이터 → 에이전트) — 함수는 경계를 넘지 못해 직렬화한 상태를 보낸다(구현 보고 G-A·G-D) ──
  // 런타임 도구(플러그인·산출물) 서술자 — 도구 호출은 `data.query` 의 `runtimeToolCall` 이다.
  'tools.snapshot': { from: 'data', kind: 'notify' },
  // 관리형 MCP 스냅샷 — 브리지 임대는 `data.query` 의 `managedMcpAcquire` 다.
  'mcp.snapshot': { from: 'data', kind: 'notify' },
  // 인증 게이트 상태 — OpenCode 웜업의 허용 조건.
  'auth.state': { from: 'data', kind: 'notify' },
  // 데이터 호스트가 낸 채팅 통지(산출물 게시) — 채팅 통지 채널은 에이전트 호스트 몫이라 중계한다.
  'chat.relay': { from: 'data', kind: 'notify' }
} as const satisfies Record<string, { from: PeerSide; kind: 'request' | 'notify' }>

export type PeerSide = 'agent' | 'data'
export type PeerMethod = keyof typeof PEER_METHODS
export type PeerRequestMethod<S extends PeerSide> = {
  [M in PeerMethod]: (typeof PEER_METHODS)[M] extends { from: S; kind: 'request' } ? M : never
}[PeerMethod]
export type PeerNotifyMethod<S extends PeerSide> = {
  [M in PeerMethod]: (typeof PEER_METHODS)[M] extends { from: S; kind: 'notify' } ? M : never
}[PeerMethod]

const METHOD_NAMES = Object.keys(PEER_METHODS) as [PeerMethod, ...PeerMethod[]]
const Method = z.enum(METHOD_NAMES)
const Id = z.number().int().nonnegative()

export const PeerMessageSchema = z.union([
  z.object({ kind: z.literal('request'), id: Id, method: Method, payload: z.unknown().optional() }),
  z.object({ kind: z.literal('notify'), method: Method, payload: z.unknown().optional() }),
  z.object({
    kind: z.literal('result'),
    id: Id,
    ok: z.literal(true),
    value: z.unknown().optional()
  }),
  z.object({ kind: z.literal('result'), id: Id, ok: z.literal(false), error: z.string() })
])
export type PeerMessage = z.infer<typeof PeerMessageSchema>

// 받은 메시지가 보낸 쪽의 방향·봉투와 맞는가. 맞지 않으면 받는 쪽이 거부한다.
export function peerMessageFits(message: PeerMessage, from: PeerSide): boolean {
  if (message.kind === 'result') return true
  const spec = PEER_METHODS[message.method]
  return spec.from === from && spec.kind === message.kind
}

// ── F1 턴 저장 스트림의 턴 필드 — 송신기(에이전트)가 고르고 수신기(데이터)가 저장 쪽 턴 상태 사본(MD-09)에
// 넣는다.
// 턴 시작 때 한 번 오는 필드(저장이 읽는 정적 값).
export const TURN_BEGIN_FIELDS = [
  'pendingUserText',
  'initialTitle',
  'pendingProjectId',
  'lineage',
  'sessionBaseline',
  'sessionBaselineRef',
  'agentKind',
  'cwd',
  'extraDirs'
] as const
// 턴 도중 실행 쪽이 바꿀 수 있는 필드 — 바뀌면 다음 입력에 실려 온다.
export const TURN_LIVE_FIELDS = [
  'dbSessionId',
  'providerKey',
  'modelFamily',
  'isNewSession',
  'retrying'
] as const

export interface TurnBegin {
  turnKey: string
  // 이 턴이 잠긴 하네스 — 세션 행의 backend 출처다.
  backend: string
  fields: Record<string, unknown>
}

// F2·F4 의 `op` 봉투 — 조회·실행 표의 이름과 인자.
export const PeerOpSchema = z.object({ op: z.string().min(1), args: z.array(z.unknown()) })
export type PeerOp = z.infer<typeof PeerOpSchema>
