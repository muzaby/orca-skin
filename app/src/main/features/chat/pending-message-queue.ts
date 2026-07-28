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

// 배치 성격(0151 AC1) — **어느 신호가 이 배치의 소비를 확정하는가**를 데이터로 못박는다.
//   turn-open : 턴 프롬프트·프렐류드 → 확정 = 첫 모델 출력(응답 시작이 곧 소비 증거, 0069)
//   steer     : mid-turn 게이트 flush → 확정 = CLI user echo(응답 진행은 증거가 못 된다, 0060 D2)
// 성격은 **메서드로 유도할 수 없다** — 같은 reserveHeld 가 게이트에서는 steer 를, 연속 턴
// 루프에서는 턴 프롬프트를 만든다(chat-turn). 그래서 호출자가 명시한다.
export type BatchOrigin = 'turn-open' | 'steer'

// 예약 배치의 수명(0151 AC2) — 구 `consumed: boolean` 을 대체한다. held 는 별도 맵이 소유하므로
// 여기 없다.
//   submitted : stdin 주입됨. 취소 불가(소유권 transport). push 실패 시에만 rollback 으로 복귀.
//   confirmed : origin 이 지정한 신호를 관측. 커밋 대상.
//   orphaned  : 턴 체인이 끝나도록 확정 신호가 오지 않음. 재주입 후보이자 관측 지점 —
//               구 구조에는 이 상태가 없어 echo 유실이 **표현도 탐지도 불가**했다.
export type BatchState = 'submitted' | 'confirmed' | 'orphaned'

// 확정 신호 — kind 가 origin 과 짝이 맞아야만 확정된다(AC5). 규약이 코드 4곳에 흩어져 있던 것을
// 큐 안의 검증 한 줄로 내린다.
export type ConfirmSignal =
  { kind: 'echo'; uuid?: string; text?: string } | { kind: 'model-output'; uuids: string[] }

interface TrackedBatch extends SteerFlushBatch {
  origin: BatchOrigin
  state: BatchState
  // 롤백 복원 원본 — push 가 거부되면 이 항목들이 held 로 되돌아간다(AC4).
  items: PendingMessage[]
}

function toBatch(items: PendingMessage[], uuid: string): SteerFlushBatch {
  const attachmentTexts = items.flatMap((item) => item.attachmentTexts ?? [])
  const attachmentImages = items.flatMap((item) => item.attachmentImages ?? [])
  const attachmentViews = items.flatMap((item) => item.attachmentViews ?? [])
  return {
    uuid,
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
//   held ──reserve*──→ submitted ──confirm(신호 일치)──→ confirmed ──drainConfirmed──→ 제거+scrub
//     │                    │
//     │←──rollback─────────┤ (push=false / 예외)
//   cancel                 └──턴 체인 종료──→ orphaned ──takeForRespawn──→ 재주입
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
    const trimmed = payload.text.trim()
    if (trimmed === '') throw new Error('empty pending message text')
    const item: PendingMessage = { ...payload, id, sessionId, text: trimmed, createdAt: now }
    const items = this.heldBySession.get(sessionId) ?? []
    items.push(item)
    this.heldBySession.set(sessionId, items)
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
    return removed
  }

  // 중단 버튼(0067 확정 5) — held 전량 취소. 반환 항목들의 텍스트를 renderer 가 composer draft
  // 로 복원한다. 예약분은 대상 아님(un-push 불가).
  cancelAllHeld(sessionId: string): PendingMessage[] {
    const items = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.delete(sessionId)
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
      const target = this.heldBySession.get(newKey) ?? []
      this.heldBySession.set(newKey, [...target, ...held])
    }
    const tracked = this.trackedBySession.get(oldKey)
    if (tracked) {
      this.trackedBySession.delete(oldKey)
      const target = this.trackedBySession.get(newKey) ?? []
      this.trackedBySession.set(newKey, [...target, ...tracked])
    }
  }

  // held 전체를 병합 단일 배치로 **예약**한다(구 flushHeld). 이름이 계약을 말한다 — 이 시점의
  // 배치는 아직 되돌릴 수 있고(rollback), 호출자가 stdin 주입에 성공해야 소유권이 넘어간다.
  // 병합 단위를 유지하는 이유: CLI 자신이 큐를 배치로 coalesce 하고 coalesce 후 비대표 uuid
  // 취소는 no-op 이라(sdk.d.ts:3487), "대표 uuid 1개 = 배치 1개" 가 provider 모델과 정합이다.
  reserveHeld(
    sessionId: string,
    origin: BatchOrigin,
    uuid: string = randomUUID()
  ): SteerFlushBatch | undefined {
    if (this.frozen) return undefined
    const items = this.heldBySession.get(sessionId)
    if (!items || items.length === 0) return undefined
    this.heldBySession.delete(sessionId)
    const batch = toBatch(items, uuid)
    this.track(sessionId, batch, origin, items)
    return batch
  }

  // 턴 프롬프트 예약(0067 AC5, 구 flushItem) — 지정 아이템 1개를 자기 배치(uuid=item id)로
  // 전이한다. 사용자 턴의 일반 메시지는 병합 없이 자기 버블/row 로 커밋돼야 한다.
  reserveItem(sessionId: string, id: string, origin: BatchOrigin): SteerFlushBatch | undefined {
    if (this.frozen) return undefined
    const item = this.cancel(sessionId, id) // held 에서 제거(재사용 — 검증 동일)
    if (!item) return undefined
    const batch = toBatch([item], item.id)
    this.track(sessionId, batch, origin, [item])
    return batch
  }

  // 예약 롤백(AC4) — stdin 수용이 거부되면(closed stream / push 예외) 항목을 held 로 되돌린다.
  // **submitted 만** 대상: confirmed 는 이미 커밋 경로에 있고, orphaned 는 CLI 가 나중에 실행할
  // 수 있어 되돌리면 이중 전달이 된다. 복원 항목은 그 사이 들어온 신규 held 와 createdAt 순으로
  // 다시 섞인다(사용자가 입력한 순서가 곧 전달 순서).
  rollback(sessionId: string, uuid: string): boolean {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return false
    const index = batches.findIndex((b) => b.uuid === uuid && b.state === 'submitted')
    if (index < 0) return false
    const [batch] = batches.splice(index, 1)
    if (batches.length === 0) this.trackedBySession.delete(sessionId)
    const held = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.set(
      sessionId,
      [...batch.items, ...held].sort((a, b) => a.createdAt - b.createdAt)
    )
    return true
  }

  // 소비 확정(구 markConsumed) — **origin 과 신호 종류가 짝이 맞아야만** 확정한다(AC5).
  // echo 는 steer 배치만, 첫 모델 출력은 turn-open 배치만 확정할 수 있다. 늦게 도착한 턴-시작
  // echo 가 무해한 이유가 이제 "우연히 매칭 실패" 가 아니라 **구조적 거부** 다.
  // uuid 가 실려 오면 uuid 로만 판정한다(AC6) — 텍스트가 같은 무관한 배치를 확정하던 폴백
  // 경로를 끊는다. text 폴백은 uuid 를 보존하지 않는 replay 에서만 살아난다.
  // orphaned 도 확정 대상이다 — 지각 신호로 커밋이 유실되지 않게(AC7).
  confirm(sessionId: string, signal: ConfirmSignal): SteerFlushBatch[] {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return []
    const open = (b: TrackedBatch): boolean => b.state === 'submitted' || b.state === 'orphaned'

    if (signal.kind === 'model-output') {
      const confirmed: SteerFlushBatch[] = []
      for (const uuid of signal.uuids) {
        const batch = batches.find((b) => b.origin === 'turn-open' && open(b) && b.uuid === uuid)
        if (!batch) continue
        batch.state = 'confirmed'
        confirmed.push(toPublic(batch))
      }
      return confirmed
    }

    const steerOpen = (b: TrackedBatch): boolean => b.origin === 'steer' && open(b)
    const batch =
      signal.uuid !== undefined
        ? batches.find((b) => steerOpen(b) && b.uuid === signal.uuid)
        : signal.text !== undefined
          ? batches.find((b) => steerOpen(b) && b.text === signal.text!.trim())
          : undefined
    if (!batch) return []
    batch.state = 'confirmed'
    return [toPublic(batch)]
  }

  // 확정 배치를 **배치 단위로** drain — 각 배치가 자기 user row/버블로 커밋된다(0067: 턴
  // 프롬프트·프렐류드는 아이템 단위 배치라 병합하면 버블 구조가 깨진다). 미확정분은 남긴다.
  drainConfirmed(sessionId: string): SteerFlushBatch[] {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return []
    const confirmed = batches.filter((b) => b.state === 'confirmed')
    if (confirmed.length === 0) return []
    const remaining = batches.filter((b) => b.state !== 'confirmed')
    if (remaining.length === 0) this.trackedBySession.delete(sessionId)
    else this.trackedBySession.set(sessionId, remaining)
    return confirmed.map(toPublic)
  }

  // 턴 체인 종료 시점(AC7) — 확정 신호가 오지 않은 예약을 orphaned 로 내린다. 기능적 효과는
  // takeForRespawn 대상 판정이 명시화되는 것뿐이지만, **echo 유실이 처음으로 관측 가능해진다**
  // (구 구조에서는 미확정 배치가 세션 런타임 수명 내내 조용히 잔존했다).
  orphanUnconfirmed(sessionId: string): SteerFlushBatch[] {
    const batches = this.trackedBySession.get(sessionId)
    if (!batches) return []
    const orphaned: SteerFlushBatch[] = []
    for (const batch of batches) {
      if (batch.state !== 'submitted') continue
      batch.state = 'orphaned'
      orphaned.push(toPublic(batch))
    }
    return orphaned
  }

  // interrupt 영수증의 still_queued 와 대조할 **우리 uuid** 집합(AC11). 영수증에는 클라이언트가
  // 보낸 적 없는 내부 uuid(cron 트리거·auto-resume continuation)가 섞이므로, 교집합만 우리 것이다.
  submittedUuids(sessionId: string): string[] {
    return (this.trackedBySession.get(sessionId) ?? [])
      .filter((b) => b.state === 'submitted')
      .map((b) => b.uuid)
  }

  // 채널 사망 후 스폰 직전(0067) — 이월 잔여를 프렐류드 배치 목록으로 회수한다. 미확정 예약
  // (모델이 못 본 stdin 사본 — 서브프로세스 종료로 CLI 큐 소멸)은 **재주입**(uuid 보존 =
  // renderer pending id 정합), held 는 아이템 단위 배치로 전이. 전부 새 턴의 프렐류드/프롬프트가
  // 되므로 origin 을 turn-open 으로 **재스탬프**한다 — 확정 신호가 echo 에서 첫 모델 출력으로
  // 바뀌기 때문이다. confirmed 잔존분(경계 유실)은 폐기한다(이중 전달 방지).
  takeForRespawn(sessionId: string): SteerFlushBatch[] {
    const carried = (this.trackedBySession.get(sessionId) ?? []).filter(
      (b) => b.state !== 'confirmed'
    )
    const held = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.delete(sessionId)
    const next: TrackedBatch[] = carried.map((b) => ({
      ...b,
      origin: 'turn-open' as const,
      state: 'submitted' as const
    }))
    for (const item of held) {
      next.push({
        ...toBatch([item], item.id),
        origin: 'turn-open',
        state: 'submitted',
        items: [item]
      })
    }
    if (next.length > 0) this.trackedBySession.set(sessionId, next)
    else this.trackedBySession.delete(sessionId)
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
  }

  // 프로그램 종료 최종 폐기 — 전 세션 스크럽 후 맵을 비운다.
  disposeAll(): void {
    for (const sessionId of [...this.heldBySession.keys(), ...this.trackedBySession.keys()]) {
      this.dispose(sessionId)
    }
  }

  private track(
    sessionId: string,
    batch: SteerFlushBatch,
    origin: BatchOrigin,
    items: PendingMessage[]
  ): void {
    const batches = this.trackedBySession.get(sessionId) ?? []
    batches.push({ ...batch, origin, state: 'submitted', items: [...items] })
    this.trackedBySession.set(sessionId, batches)
  }
}

export type { SteerFlush, SteerFlushBatch }
