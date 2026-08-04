import { randomUUID } from 'node:crypto'
import type { AttachmentView } from '../../../shared/ipc'
import type { SteerFlush, SteerFlushBatch } from '../../adapters/turn'
import type { ExtractedAttachmentImage, ExtractedAttachmentText } from '../../adapters/turn'

// 큐 아이템 페이로드 — 구조 페이로드(0067 AC5): 텍스트 + 추출 첨부(어댑터가 content 블록으로
// 굽는 입력) + 표시용 첨부 뷰(커밋 시 renderer/DB 로 흐른다).
export interface PendingMessagePayload {
  text: string
  attachmentTexts?: ExtractedAttachmentText[]
  attachmentImages?: ExtractedAttachmentImage[]
  attachmentViews?: AttachmentView[]
}

export interface PendingMessage extends PendingMessagePayload {
  id: string
  sessionId: string
  createdAt: number
}

// 배치 성격(0151 AC1) — **어느 신호가 이 배치를 확정할 수 있는가**를 데이터로 못박는다.
//   turn-open : 턴 프롬프트·프렐류드 → 첫 모델 출력(0069 기본 앵커) **또는** echo
//   steer     : mid-turn 게이트 flush → **echo 만**. 응답 진행은 mid-turn steer 의 소비 증거가
//               못 되므로(0060 D2) 모델 출력으로 확정하면 모델이 못 본 텍스트를 커밋하게 된다.
// 관계는 **비대칭**이다 — 막아야 하는 것은 "모델 출력 → steer" 한 방향뿐이고, echo 는 CLI 의
// drain 영수증이라 양쪽에 유효하다(r2 교정, 아래 confirm 주석 참조).
// 성격은 **메서드로 유도할 수 없다** — 같은 reserveHeld 가 게이트에서는 steer 를, 연속 턴
// 루프에서는 턴 프롬프트를 만든다(chat-turn). 그래서 호출자가 명시한다.
export type BatchOrigin = 'turn-open' | 'steer'

// 예약 배치의 수명(0151 AC2) — 구 `consumed: boolean` 을 대체한다. held 는 별도 맵이 소유하므로
// 여기 없다.
//   submitted : stdin 주입됨. 취소 불가(소유권 transport). push 실패 시에만 rollback 으로 복귀.
//   confirmed : origin 이 허용하는 신호를 관측. 커밋 대상.
//   orphaned  : 턴 체인이 끝나도록 확정 신호가 오지 않음. 재주입 후보이자 관측 지점 —
//               구 구조에는 이 상태가 없어 echo 유실이 **표현도 탐지도 불가**했다.
export type BatchState = 'submitting' | 'submitted' | 'confirmed' | 'orphaned'

export interface SubmissionAttempt {
  messageIds: string[]
  attemptId: string
  chainId: string
}

export type PendingQueueMutation =
  { kind: 'changed'; sessionId: string } | { kind: 'rekey'; oldKey: string; newKey: string }

// 확정 신호 — 큐가 kind 와 origin 의 (비대칭) 관계를 검증한다(AC5). 규약이 코드 4곳에 흩어져
// 있던 것을 큐 안의 검증 한 곳으로 내린다.
export type ConfirmSignal =
  { kind: 'echo'; uuid?: string; text?: string } | { kind: 'model-output'; uuids: string[] }

interface TrackedBatch extends SteerFlushBatch {
  attemptId: string
  chainId: string
  origin: BatchOrigin
  state: BatchState
  // 롤백 복원 원본 — push 가 거부되면 이 항목들이 held 로 되돌아간다(AC4).
  items: PendingMessage[]
}

function toBatch(items: PendingMessage[], attemptId: string, chainId: string): SteerFlushBatch {
  const attachmentTexts = items.flatMap((item) => item.attachmentTexts ?? [])
  const attachmentImages = items.flatMap((item) => item.attachmentImages ?? [])
  const attachmentViews = items.flatMap((item) => item.attachmentViews ?? [])
  return {
    uuid: attemptId,
    attemptId,
    chainId,
    ids: items.map((item) => item.id),
    text: items.map((item) => item.text).join('\n\n'),
    createdAt: items[0].createdAt,
    ...(attachmentTexts.length > 0 ? { attachmentTexts } : {}),
    ...(attachmentImages.length > 0 ? { attachmentImages } : {}),
    ...(attachmentViews.length > 0 ? { attachmentViews } : {})
  }
}

// 추적 필드(origin/state/items)를 벗긴 공개 배치 — 호출자는 계약 타입만 본다.
function toPublic(batch: TrackedBatch): SteerFlushBatch {
  return {
    uuid: batch.uuid,
    attemptId: batch.attemptId,
    chainId: batch.chainId,
    ids: batch.ids,
    text: batch.text,
    createdAt: batch.createdAt,
    ...(batch.attachmentTexts ? { attachmentTexts: batch.attachmentTexts } : {}),
    ...(batch.attachmentImages ? { attachmentImages: batch.attachmentImages } : {}),
    ...(batch.attachmentViews ? { attachmentViews: batch.attachmentViews } : {})
  }
}

// payload 스크럽(AC8) — 폐기 시 본문/첨부(base64 수 MB)를 즉시 덮어쓴다. 다른 곳이 같은 객체를
// 참조하고 있어도 내용이 남지 않는다(가이드 §7.4 "registry payload 를 덮어쓴 뒤 비운다").
function scrubItem(item: PendingMessage): void {
  item.text = ''
  item.attachmentTexts = []
  item.attachmentImages = []
  item.attachmentViews = []
}

function scrubBatch(batch: TrackedBatch): void {
  batch.text = ''
  batch.attachmentTexts = []
  batch.attachmentImages = []
  batch.attachmentViews = []
  for (const item of batch.items) scrubItem(item)
  batch.items = []
}

// 세션별 pending message queue — **모든 사용자 프롬프트**가 커밋(DB 영속) 전에 지나는 단일
// 스테이징 통로(0066 → 0067 완전 일원화). 0151 에서 암묵 상태 머신을 명시 데이터로 올렸다.
//
//   held ──reserve*──→ submitting ──adapter accepted──→ submitted
//     │                    │                              │
//     │←──rollback─────────┤                              ├─confirm─→ confirmed ─→ 제거+scrub
//   cancel                                                    └─체인 종료─→ orphaned ─→ 재주입
//                                                 └──지각 confirm──→ confirmed
//
// 세션 상태가 주입 경로를 가른다:
//   사용자 턴(세션 idle) — chat:send 가 enqueue 직후 reserveItem 으로 아이템 단위 배치를 떠서
//     턴 프롬프트로 주입한다(스폰 초기 메시지 또는 pushTurn). 채널이 죽어 있었다면
//     takeForRespawn 이 잔여를 프렐류드 배치로 앞세운다.
//   어시스턴트 턴(inflight) — chat:send 는 예약(held)만 한다. held 인 동안 취소 100% 가능.
//
// 소유권은 provider 로 넘기지 않는다(0151 설계 결정): SDK 0.3.220 공개 표면에 provider 큐의
// 개별 메시지를 취소하는 메서드가 없으므로(`cancel_async_message` 는 Query 메서드 아님), 로컬
// held 가 SDK 소비자가 가질 수 있는 유일한 확정적 취소 수단이다.
export class PendingMessageQueue {
  private readonly heldBySession = new Map<string, PendingMessage[]>()
  private readonly trackedBySession = new Map<string, TrackedBatch[]>()
  private frozen = false
  private readonly listeners = new Set<(mutation: PendingQueueMutation) => void>()
  private mutationDepth = 0
  private readonly dirtySessions = new Set<string>()

  subscribe(listener: (mutation: PendingQueueMutation) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  transaction<T>(fn: () => T): T {
    this.mutationDepth += 1
    try {
      return fn()
    } finally {
      this.mutationDepth -= 1
      if (this.mutationDepth === 0) this.flushMutations()
    }
  }

  // 종료 admission freeze(AC9) — 이후 신규 예약/적재를 거부한다. 종료 중 flush·continuation 이
  // 큐 제거와 경합해 steer 가 늦게 제출되는 것을 막는다. 멱등.
  freeze(): void {
    this.frozen = true
  }

  get isFrozen(): boolean {
    return this.frozen
  }

  enqueue(
    sessionId: string,
    payload: PendingMessagePayload,
    now = Date.now(),
    id: string = randomUUID()
  ): PendingMessage {
    if (this.frozen) throw new Error('app_closing')
    const duplicate = this.findMessage(sessionId, id)
    if (duplicate) return duplicate
    const trimmed = payload.text.trim()
    if (trimmed === '') throw new Error('empty pending message text')
    const item: PendingMessage = { ...payload, id, sessionId, text: trimmed, createdAt: now }
    const items = this.heldBySession.get(sessionId) ?? []
    items.push(item)
    this.heldBySession.set(sessionId, items)
    this.changed(sessionId)
    return item
  }

  // held 항목만 취소 가능 — 예약된(submitted) 항목은 undefined(거부). 호출자는 취소 거부를
  // 침묵하지 말고 소유권 이전을 UI 에 표시해야 한다(message.submitted, 0151 AC12).
  cancel(sessionId: string, id: string): PendingMessage | undefined {
    const items = this.heldBySession.get(sessionId)
    if (!items) return undefined
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return undefined
    const [removed] = items.splice(index, 1)
    if (items.length === 0) this.heldBySession.delete(sessionId)
    this.changed(sessionId)
    return removed
  }

  // 중단 버튼(0067 확정 5) — held 전량 취소. 반환 항목들의 텍스트를 renderer 가 composer draft
  // 로 복원한다. 예약분은 대상 아님(un-push 불가).
  cancelAllHeld(sessionId: string): PendingMessage[] {
    const items = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.delete(sessionId)
    if (items.length > 0) this.changed(sessionId)
    return items
  }

  pending(sessionId: string): PendingMessage[] {
    return [...(this.heldBySession.get(sessionId) ?? [])]
  }

  // 세션 키 재바인딩(0067 AC9) — 새 세션은 clientKey(draft UUID)로 적재됐다가 init 에서 실
  // session id 로 갈아탄다(coordinator 가 session.updated 에서 호출).
  rekey(oldKey: string, newKey: string): void {
    if (oldKey === newKey) return
    const held = this.heldBySession.get(oldKey)
    if (held) {
      this.heldBySession.delete(oldKey)
      for (const item of held) item.sessionId = newKey
      const target = this.heldBySession.get(newKey) ?? []
      this.heldBySession.set(newKey, [...target, ...held])
    }
    const tracked = this.trackedBySession.get(oldKey)
    if (tracked) {
      this.trackedBySession.delete(oldKey)
      for (const batch of tracked) {
        for (const item of batch.items) item.sessionId = newKey
      }
      const target = this.trackedBySession.get(newKey) ?? []
      this.trackedBySession.set(newKey, [...target, ...tracked])
    }
    if (held || tracked) {
      this.dirtySessions.delete(oldKey)
      for (const listener of this.listeners) listener({ kind: 'rekey', oldKey, newKey })
      this.changed(newKey)
    }
  }

  // held 전체를 병합 단일 배치로 **예약**한다(구 flushHeld). 이름이 계약을 말한다 — 이 시점의
  // 배치는 아직 되돌릴 수 있고(rollback), 호출자가 stdin 주입에 성공해야 소유권이 넘어간다.
  // 병합 단위를 유지하는 이유: CLI 자신이 큐를 배치로 coalesce 하고 coalesce 후 비대표 uuid
  // 취소는 no-op 이라(sdk.d.ts:3487), "대표 uuid 1개 = 배치 1개" 가 provider 모델과 정합이다.
  reserveHeld(
    sessionId: string,
    origin: BatchOrigin,
    attemptId: string = randomUUID(),
    chainId: string = randomUUID()
  ): SteerFlushBatch | undefined {
    if (this.frozen) return undefined
    const items = this.heldBySession.get(sessionId)
    if (!items || items.length === 0) return undefined
    this.heldBySession.delete(sessionId)
    const ordered = [...items].sort((a, b) => a.createdAt - b.createdAt)
    const batch = toBatch(ordered, attemptId, chainId)
    this.track(sessionId, batch, origin, ordered)
    return batch
  }

  // 턴 프롬프트 예약(0067 AC5, 구 flushItem) — 지정 아이템 1개를 자기 배치(uuid=item id)로
  // 전이한다. 사용자 턴의 일반 메시지는 병합 없이 자기 버블/row 로 커밋돼야 한다.
  reserveItem(
    sessionId: string,
    id: string,
    origin: BatchOrigin,
    chainId: string = randomUUID()
  ): SteerFlushBatch | undefined {
    return this.transaction(() => {
      if (this.frozen) return undefined
      const item = this.cancel(sessionId, id) // held 에서 제거(재사용 — 검증 동일)
      if (!item) return undefined
      const batch = toBatch([item], item.id, chainId)
      this.track(sessionId, batch, origin, [item])
      return batch
    })
  }

  // 예약 롤백(AC4) — stdin 수용이 거부되면(closed stream / push 예외) 항목을 held 로 되돌린다.
  // **submitting 만** 대상: submitted/confirmed 는 이미 transport/커밋 경로에 있고,
  // orphaned 는 CLI 가 나중에 실행할
  // 수 있어 되돌리면 이중 전달이 된다. 복원 항목은 그 사이 들어온 신규 held 와 createdAt 순으로
  // 다시 섞인다(사용자가 입력한 순서가 곧 전달 순서).
  rollback(sessionId: string, uuid: string): boolean {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return false
    const index = batches.findIndex((b) => b.uuid === uuid && b.state === 'submitting')
    if (index < 0) return false
    const [batch] = batches.splice(index, 1)
    if (batches.length === 0) this.trackedBySession.delete(sessionId)
    const held = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.set(
      sessionId,
      [...batch.items, ...held].sort((a, b) => a.createdAt - b.createdAt)
    )
    this.changed(sessionId)
    return true
  }

  commit(sessionId: string, attemptId: string, chainId?: string): boolean {
    const batch = (this.trackedBySession.get(sessionId) ?? []).find(
      (candidate) =>
        candidate.attemptId === attemptId &&
        candidate.state === 'submitting' &&
        (chainId === undefined || candidate.chainId === chainId)
    )
    if (!batch) return false
    batch.state = 'submitted'
    this.changed(sessionId)
    return true
  }

  commitMany(sessionId: string, attempts: readonly SubmissionAttempt[]): boolean {
    const batches = this.trackedBySession.get(sessionId) ?? []
    const selected = selectAttempts(batches, attempts, ['submitting', 'submitted'])
    if (selected.some((batch) => batch === undefined)) return false
    let changed = false
    for (const batch of selected as TrackedBatch[]) {
      if (batch.state !== 'submitting') continue
      batch.state = 'submitted'
      changed = true
    }
    if (changed) this.changed(sessionId)
    return true
  }

  canCommitMany(sessionId: string, attempts: readonly SubmissionAttempt[]): boolean {
    const batches = this.trackedBySession.get(sessionId) ?? []
    return !selectAttempts(batches, attempts, ['submitting']).some((batch) => batch === undefined)
  }

  // 소비 확정(구 markConsumed) — 신호와 origin 의 관계는 **비대칭**이다(AC5, r2 교정):
  //   · `model-output`(첫 모델 출력) → **turn-open 만**. 응답 진행은 mid-turn steer 의 소비
  //     증거가 못 되므로(0060 D2) steer 배치를 확정하면 모델이 못 본 텍스트를 커밋하게 된다.
  //   · `echo`(CLI drain 영수증) → **양쪽**. 배치 성격과 무관하게 "CLI 가 이 입력을 흡수했다" 는
  //     직접 증거다. 모델 출력이 없는 턴에서는 turn-open 의 유일한 신호이기도 하다.
  // (r1 은 echo 도 steer 로 한정했다가 CI 에서 회귀를 냈다 — 모델 출력 없는 handoff 도착 턴의
  //  사용자 메시지가 영영 커밋되지 않았다.)
  // uuid 가 실려 오면 uuid 로만 판정한다(AC6) — 텍스트가 같은 무관한 배치를 확정하던 폴백
  // 경로를 끊는다. text 폴백은 uuid 를 보존하지 않는 replay 에서만 살아난다.
  // orphaned 도 확정 대상이다 — 지각 신호로 커밋이 유실되지 않게(AC7).
  //
  // **uuid 로 지목된 신호는 `submitting` 도 확정한다**(0166 D9). uuid 는 우리가 만들어 push 한
  // 값이므로 그것이 되돌아왔다는 사실 자체가 **전송이 실제로 일어났다는 영수증**이다. 반면
  // `submitting`/`submitted` 구분은 **우리 장부**(commit fence)일 뿐이다 — 장부가 어긋났다고
  // 실물 영수증을 버리면, 모델은 답을 하는데 사용자 메시지만 영영 커밋되지 않는다(D7 실기 증상).
  // uuid 매칭은 오확정 위험이 구조적으로 0이다: push 전에는 그 uuid 가 CLI 에 존재하지 않는다.
  //
  // **텍스트 폴백만 좁게 유지**한다(uuid 를 보존하지 않는 replay 전용) — 본문이 같은 *아직 push
  // 되지 않은* 예약을 오확정할 수 있어, 여기서는 전송이 확정된 상태만 대상으로 둔다.
  confirm(sessionId: string, signal: ConfirmSignal): SteerFlushBatch[] {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return []
    if (signal.kind === 'model-output') {
      const confirmed: SteerFlushBatch[] = []
      for (const uuid of signal.uuids) {
        const batch = batches.find(
          (b) => b.origin === 'turn-open' && isOpen(b.state) && b.uuid === uuid
        )
        if (!batch) continue
        batch.state = 'confirmed'
        confirmed.push(toPublic(batch))
      }
      return confirmed
    }

    // echo 는 **양쪽 origin 을 확정할 수 있다** — CLI 가 입력을 drain 했다는 영수증이라 배치
    // 성격과 무관하게 유효하다. 모델 출력이 하나도 없는 턴(handoff 도착 턴 등)에서는 turn-open
    // 배치의 **유일한** 확정 신호이므로, 여기서 거부하면 사용자 메시지가 영영 커밋되지 않는다.
    const batch =
      signal.uuid !== undefined
        ? batches.find((b) => isOpen(b.state) && b.uuid === signal.uuid)
        : signal.text !== undefined
          ? batches.find((b) => receiptSettled(b.state) && b.text === signal.text!.trim())
          : undefined
    if (!batch) return []
    batch.state = 'confirmed'
    return [toPublic(batch)]
  }

  // 확정 배치를 **배치 단위로** drain — 각 배치가 자기 user row/버블로 커밋된다(0067: 턴
  // 프롬프트·프렐류드는 아이템 단위 배치라 병합하면 버블 구조가 깨진다). 미확정분은 남긴다.
  drainConfirmed(sessionId: string): SteerFlushBatch[] {
    return this.remove(sessionId, (b) => b.state === 'confirmed')
  }

  // 턴 체인 종료 시점(AC7) — 확정 신호가 오지 않은 예약을 orphaned 로 내린다. **표시일 뿐 폐기가
  // 아니다**(0154). 효과는 두 가지: ① takeForRespawn 대상 판정의 명시화 ② 미확정 유예를 1라운드로
  // 묶는 단조 전이(호출자가 listen 을 열며 강등 → 다음 평가에서 무한 대기 없이 종료).
  //
  // orphaned 는 **폐기 대상이 아니다.** `confirm` 의 open 술어가 orphaned 를 포함하므로 늦은 echo
  // 가 그대로 확정하고, 회수는 CLI 큐가 실제로 사라지는 시점(채널 사망 → takeForRespawn, 세션
  // 폐기 → dispose)이 맡는다.
  // **`submitting` 도 대상이다**(0166 D8). 체인이 끝나는 시점에 남아 있는 `submitting` 은 "아직
  // 안 보낸 것" 이 아니라 **"보냈는데 commit fence 가 어긋난 것"** 이다 — push 실패는 게이트 훅이
  // 이미 rollback 했고(`makeSteerGateHook`), 초기 배치는 outer finally 가 `rollbackInitialSubmission`
  // 을 먼저 태운다. 여기서 제외하면 그 배치는 confirm 대상도(open 술어가 제외) orphan 대상도 아니게
  // 되어 **영원히 갇히고**, 그러면서 open 카운트에는 계속 잡혀 세션이 영구히 busy 로 보인다.
  orphanUnconfirmed(sessionId: string, chainId?: string): SteerFlushBatch[] {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return []
    const orphaned: SteerFlushBatch[] = []
    for (const batch of batches) {
      if (!awaitsReceipt(batch.state)) continue
      if (chainId !== undefined && batch.chainId !== chainId) continue
      batch.state = 'orphaned'
      orphaned.push(toPublic(batch))
    }
    if (orphaned.length > 0) this.changed(sessionId)
    return orphaned
  }

  // (0154) `discardOrphaned` 제거 — 0151 OQ2 "폐기 후 draft 복원" 의 전제가 실측으로 반증됐다.
  // 그 결정은 미확정 상태를 "CLI 가 못 봤다" / "봤는데 echo 유실" 둘로만 봤으나, 실제로 흔한 것은
  // **제3의 상태 "아직 안 봤을 뿐, 곧 본다"** 다 — push 된 배치는 priority:'next' 로 CLI 큐에 남아
  // 다음 턴 프롬프트로 정상 픽업된다. 폐기하면 CLI 는 답변을 내놓는데 질문 버블만 사라진다(실기
  // 확인). 재주입(이중 전달)도 폐기(유실)도 아닌 **대기**가 옳으므로 이 경로 자체를 없앤다.

  // 지정 uuid 의 예약을 폐기한다(0151 r2 / OQ1 "세션 전체 중단") — 런타임을 폐기해 CLI 큐를
  // 서브프로세스와 함께 없앤 뒤, 그 배치들의 텍스트를 draft 로 되돌리는 데 쓴다.
  discardSubmitted(sessionId: string, uuids: readonly string[]): SteerFlushBatch[] {
    const target = new Set(uuids)
    // open 정본은 `isOpen()` 한 곳이다(0166 A31) — 여기서 술어를 재작성하면 상태가 하나 늘 때
    // 소비처마다 갱신을 놓친다.
    return this.remove(sessionId, (b) => isOpen(b.state) && target.has(b.uuid))
  }

  // "CLI 에 넘겨놓고 확정 신호를 기다리는 중" 인 예약이 있는가(0154 턴-후 유예 판정). 존재 여부만
  // 묻는 자리는 이 술어를 쓴다 — submittedUuids().length 는 uuid 배열을 만들어 길이만 보고 버린다.
  hasSubmitted(sessionId: string): boolean {
    return (this.trackedBySession.get(sessionId) ?? []).some((b) => b.state === 'submitted')
  }

  // interrupt 영수증의 still_queued 와 대조할 **우리 uuid** 집합(AC11). 영수증에는 클라이언트가
  // 보낸 적 없는 내부 uuid(cron 트리거·auto-resume continuation)가 섞이므로, 교집합만 우리 것이다.
  submittedUuids(sessionId: string): string[] {
    return (this.trackedBySession.get(sessionId) ?? [])
      .filter((b) => b.state === 'submitted')
      .map((b) => b.uuid)
  }

  openAttemptIds(sessionId: string): string[] {
    return (this.trackedBySession.get(sessionId) ?? [])
      .filter((batch) => isOpen(batch.state))
      .map((batch) => batch.attemptId)
  }

  counts(sessionId: string): { queuedCount: number; deliveryPendingCount: number } {
    return {
      queuedCount: (this.heldBySession.get(sessionId) ?? []).length,
      deliveryPendingCount: (this.trackedBySession.get(sessionId) ?? [])
        .filter((batch) => isOpen(batch.state))
        .reduce((sum, batch) => sum + batch.ids.length, 0)
    }
  }

  messageCountForAttempts(sessionId: string, attemptIds: ReadonlySet<string>): number {
    const ids = new Set<string>()
    for (const batch of this.trackedBySession.get(sessionId) ?? []) {
      if (!isOpen(batch.state) || !attemptIds.has(batch.attemptId)) continue
      for (const id of batch.ids) ids.add(id)
    }
    return ids.size
  }

  // 채널 사망 후 스폰 직전(0067) — 이월 잔여를 프렐류드 배치 목록으로 회수한다. 미확정 예약
  // (모델이 못 본 stdin 사본 — 서브프로세스 종료로 CLI 큐 소멸)은 **재주입**(uuid 보존 =
  // renderer pending id 정합), held 는 아이템 단위 배치로 전이. 전부 새 턴의 프렐류드/프롬프트가
  // 되므로 origin 을 turn-open 으로 **재스탬프**한다 — 확정 신호가 echo 에서 첫 모델 출력으로
  // 바뀌기 때문이다. confirmed 잔존분(경계 유실)은 폐기한다(이중 전달 방지).
  takeForRespawn(sessionId: string, chainId: string = randomUUID()): SteerFlushBatch[] {
    const carried = (this.trackedBySession.get(sessionId) ?? []).filter((b) => isOpen(b.state))
    const held = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.delete(sessionId)
    const next: TrackedBatch[] = carried.map((b) => {
      const attemptId = randomUUID()
      return {
        ...b,
        uuid: attemptId,
        attemptId,
        chainId,
        origin: 'turn-open' as const,
        state: 'submitting' as const
      }
    })
    for (const item of held) {
      const attemptId = randomUUID()
      next.push({
        ...toBatch([item], attemptId, chainId),
        attemptId,
        chainId,
        origin: 'turn-open',
        state: 'submitting',
        items: [item]
      })
    }
    if (next.length > 0) this.trackedBySession.set(sessionId, next)
    else this.trackedBySession.delete(sessionId)
    if (carried.length > 0 || held.length > 0) this.changed(sessionId)
    return next.map(toPublic).sort((a, b) => a.createdAt - b.createdAt)
  }

  // 세션 폐기(AC8) — 세션 삭제·프로그램 종료에서 호출한다. 구 구조에는 이 경로가 없어 삭제된
  // 세션의 입력 원문과 base64 첨부가 프로세스 메모리에 영구 잔존했다(GC 도 도달 불가 — 맵이
  // 참조를 붙들고 있었다). LRU idle 축출에는 **걸지 않는다** — 축출은 채널만 닫고 큐는 살아야
  // takeForRespawn 재주입이 성립한다.
  dispose(sessionId: string): void {
    for (const batch of this.trackedBySession.get(sessionId) ?? []) scrubBatch(batch)
    for (const item of this.heldBySession.get(sessionId) ?? []) scrubItem(item)
    this.trackedBySession.delete(sessionId)
    this.heldBySession.delete(sessionId)
    this.changed(sessionId)
  }

  // 프로그램 종료 최종 폐기 — 전 세션 스크럽 후 맵을 비운다. 두 맵에 동시에 있는 세션이 흔하므로
  // 키를 Set 으로 합쳐 세션당 dispose 를 1회만 태운다.
  disposeAll(): void {
    for (const sessionId of new Set([
      ...this.heldBySession.keys(),
      ...this.trackedBySession.keys()
    ])) {
      this.dispose(sessionId)
    }
  }

  // 조건에 맞는 추적 배치를 큐에서 빼 공개 형태로 돌려준다(폐기 경로 공통).
  private remove(sessionId: string, match: (batch: TrackedBatch) => boolean): SteerFlushBatch[] {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return []
    const hit = batches.filter(match)
    if (hit.length === 0) return []
    const remaining = batches.filter((b) => !match(b))
    if (remaining.length === 0) this.trackedBySession.delete(sessionId)
    else this.trackedBySession.set(sessionId, remaining)
    this.changed(sessionId)
    return hit.map(toPublic)
  }

  private track(
    sessionId: string,
    batch: SteerFlushBatch,
    origin: BatchOrigin,
    items: PendingMessage[]
  ): void {
    const batches = this.trackedBySession.get(sessionId) ?? []
    const attemptId = batch.attemptId ?? batch.uuid
    const chainId = batch.chainId ?? randomUUID()
    batches.push({ ...batch, attemptId, chainId, origin, state: 'submitting', items: [...items] })
    this.trackedBySession.set(sessionId, batches)
    this.changed(sessionId)
  }

  private findMessage(sessionId: string, id: string): PendingMessage | undefined {
    const held = this.heldBySession.get(sessionId)?.find((item) => item.id === id)
    if (held) return held
    for (const batch of this.trackedBySession.get(sessionId) ?? []) {
      const item = batch.items.find((candidate) => candidate.id === id)
      if (item) return item
    }
    return undefined
  }

  private changed(sessionId: string): void {
    this.dirtySessions.add(sessionId)
    if (this.mutationDepth === 0) this.flushMutations()
  }

  private flushMutations(): void {
    if (this.dirtySessions.size === 0) return
    const sessions = [...this.dirtySessions]
    this.dirtySessions.clear()
    for (const sessionId of sessions) {
      for (const listener of this.listeners) listener({ kind: 'changed', sessionId })
    }
  }
}

// 상태 어휘 — 이 파일의 모든 "어느 상태를 대상으로 하는가" 판정은 **여기 이름 중 하나**를 쓴다.
// 소비처마다 조건을 다시 쓰면 상태가 하나 늘 때 갱신을 놓친다(0166 D8 이 그 형태였다).
//   isOpen         : 아직 우리 것 — 커밋되지 않았다. uuid 영수증·폐기·표시 카운트의 대상.
//   awaitsReceipt  : stdin 으로 나갔고 확정 신호를 기다린다 — 체인 종료 시 orphaned 강등 대상.
//   receiptSettled : 전송이 확정된 것만 — uuid 없는 텍스트 폴백처럼 오확정 위험이 있는 경로용.
function isOpen(state: BatchState): boolean {
  return state !== 'confirmed'
}

function awaitsReceipt(state: BatchState): boolean {
  return state === 'submitting' || state === 'submitted'
}

function receiptSettled(state: BatchState): boolean {
  return state === 'submitted' || state === 'orphaned'
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function selectAttempts(
  batches: readonly TrackedBatch[],
  attempts: readonly SubmissionAttempt[],
  states: readonly BatchState[]
): Array<TrackedBatch | undefined> {
  return attempts.map((attempt) =>
    batches.find(
      (batch) =>
        batch.attemptId === attempt.attemptId &&
        batch.chainId === attempt.chainId &&
        states.includes(batch.state) &&
        sameIds(batch.ids, attempt.messageIds)
    )
  )
}

export type { SteerFlush, SteerFlushBatch }
