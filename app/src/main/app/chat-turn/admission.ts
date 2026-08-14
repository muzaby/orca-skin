// chat:send 진입 판정 — **순수 함수만** 산다 (0179).
//
// 분해 전에는 이 판정들이 전부 `sendChatEvent` 호출과 한 스코프에 붙어 있어, "이 페이로드는
// 거부되는가" 를 확인하려면 IPC 와 WebContents 를 흉내내야 했다. 여기서는 판정 결과만
// 돌려주고 **발신은 호출부(`send.ts`)가** 한다 — 그래야 규칙 자체를 단위 테스트할 수 있다.
//
// 규칙: 이 파일의 함수는 electron·DB·네트워크·시계를 모르고, 부작용을 만들지 않는다.

import { randomUUID } from 'node:crypto'
import { SendChatMessageSchema } from '../../../shared/protocol'
import type { ClassifiedError } from '../../../shared/ipc'
import { makeClassifiedError } from '../../infra/errors'
import { clientLeaseKey, sessionLeaseKey } from '../../features/sessions/session-chain-lease'
import { crossesProviderBoundary } from '../../features/harnesses/runtime-boundary'

export type SendChatPayload = ReturnType<typeof SendChatMessageSchema.parse>

type Admission =
  { ok: true; data: SendChatPayload } | { ok: false; error: ClassifiedError; sessionId?: string }

// 턴 진입 게이트 3종. 순서가 계약이다 — 스키마가 먼저여야 이후 판정이 페이로드를 믿을 수 있고,
// 업데이트 게이트가 어댑터 조회보다 앞이어야 종료 중에 백엔드를 깨우지 않는다.
export function admitChatSend(input: {
  raw: unknown
  updateInstallPending: boolean
  hasActiveAdapter: boolean
}): Admission {
  const parsed = SendChatMessageSchema.safeParse(input.raw)
  if (!parsed.success) {
    // 세션-이전 에러(0016): 세션도 활성 어댑터도 없어 provider 를 파생할 수 없다 — 이벤트·
    // ClassifiedError 모두 provider 부재가 정상.
    return {
      ok: false,
      error: makeClassifiedError('schema_validation_error', 'invalid chat:send payload', {
        retryable: false
      })
    }
  }

  if (input.updateInstallPending) {
    return {
      ok: false,
      error: makeClassifiedError(
        'capability_unsupported',
        '업데이트 설치가 시작되어 새 작업을 시작할 수 없습니다.',
        { retryable: false }
      )
    }
  }

  if (!input.hasActiveAdapter) {
    return {
      ok: false,
      error: makeClassifiedError('provider_connection_error', '활성 백엔드가 없습니다.', {
        retryable: true
      })
    }
  }

  return { ok: true, data: parsed.data }
}

// 첨부 정규화 실패 — 홈 밖 경로·unsupported·binary·fs 오류. 턴 try/catch 밖에서 나므로
// invoke reject 로 흘리면 renderer 의 fire-and-forget send 가 콘솔 rejection 으로만 남는다.
export function attachmentFailure(cause: unknown): ClassifiedError {
  return makeClassifiedError('schema_validation_error', '첨부 파일을 처리할 수 없습니다.', {
    retryable: false,
    cause
  })
}

// 논리 세션 키 파생. 새 채팅은 sessionId 가 아직 없어 renderer 의 clientKey 가 wire identity 다 —
// 그래서 같은 키의 재호출·후속 입력이 새 체인을 열지 않고 준비 중 lease 의 held 로 합류한다.
export function leaseKeyFor(payload: {
  sessionId: string | null
  clientKey?: string | undefined
  clientRequestId?: string | undefined
}): { provisionalKey: string; logicalKey: string } {
  const provisionalKey =
    payload.sessionId ?? payload.clientKey ?? payload.clientRequestId ?? randomUUID()
  return {
    provisionalKey,
    logicalKey: payload.sessionId
      ? sessionLeaseKey(payload.sessionId)
      : clientLeaseKey(provisionalKey)
  }
}

// 준비 중 lease 를 다른 창이 쥐고 있을 때. sessionId 가 없는(=새 채팅) 경로에서만 나온다.
export function foreignPreparingLease(): ClassifiedError {
  return makeClassifiedError(
    'provider_connection_error',
    '이 대화 준비 작업은 다른 창에서 진행 중입니다.',
    { retryable: true }
  )
}

// continuity(fork/handoff) 출발 세션 검증.
//
// **fork 와 handoff 의 판정이 다르다**: handoff 는 출발 세션의 턴이 진행 중이면 거부한다(원본을
// 옮겨오므로 mid-turn 물질화가 어긋난다). fork 는 원본이 불변이라 진행 중이어도 허용한다 —
// plan 파생 UX 가 이 차이에 기대고 있다.
export function checkContinuitySource(input: {
  source: string | undefined
  sourceExists: boolean
  isHandoff: boolean
  sourceHasLiveTurn: boolean
}): ClassifiedError | null {
  if (!input.source) return null
  if (!input.sourceExists) {
    return makeClassifiedError('schema_validation_error', '분기할 원본 세션을 찾을 수 없습니다.', {
      retryable: false
    })
  }
  if (input.isHandoff && input.sourceHasLiveTurn) {
    return makeClassifiedError(
      'provider_connection_error',
      '원본 세션의 턴이 진행 중입니다. 완료 후 핸드오프하세요.',
      { retryable: true }
    )
  }
  return null
}

// busy 세션의 send 를 held 예약으로 받아도 되는지.
//
// `closing`(discard/shutdown 진행 중)은 **백엔드 능력이 아니라 세션 수명** 문제다 — "끼어들기
// 미지원" 으로 띄우면 사용자가 '세션 전체 중단' 직후 타이핑했을 때 백엔드 탓으로 오인한다.
// provider 경계 교차는 main 측 백스톱이다(렌더러 0119 가드를 우회한 레이스만 여기 온다):
// held 는 진행 턴 채널(spawn-바운드 env)로 flush 되므로 경계를 넘는 예약은 성립하지 않는다.
// **미지정(null)은 보수적으로 허용**한다 — 모르는 것을 거부로 접으면 정상 흐름이 막힌다.
export function checkBusyReservation(input: {
  leaseKind: 'preparing' | 'active' | 'closing'
  leasedProviderKey: string | null
  requestedProviderKey: string | null
}): ClassifiedError | null {
  if (input.leaseKind === 'closing') {
    return makeClassifiedError(
      'provider_connection_error',
      '세션을 정리하는 중입니다. 잠시 후 다시 전송하세요.',
      { retryable: true }
    )
  }
  if (crossesProviderBoundary(input.leasedProviderKey, input.requestedProviderKey)) {
    return makeClassifiedError(
      'provider_connection_error',
      '다른 공급자 모델이 선택되어 있습니다. 응답 완료 후 다시 전송하세요.',
      { retryable: true }
    )
  }
  return null
}
