# Verify — 0167-session-activity-projection

> 검증 절차·역방향 탐색은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업 규칙·상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0167-session-activity-projection` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `03ff691` (base `bffa726`) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계=Claude / 구현=Codex / 검증=Claude.** 핵심 결함 1건은 **실제 모듈을 조립해 실행**으로 확정했다(추론 아님). |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **보고 증상 ②-a(inflight 애니메이션 지속)가 완화되지 않고 오히려 결정론적으로 고착된다** | 리듀서가 `listening` 에 `busy` 를 OR 로 섞는데(`chatReducer.ts:526`), projector 의 `busy` 는 **큐 카운트를 포함**한다(`session-activity-projector.ts:172-177`). 0154 가 **의도적으로 남기는** `orphaned` 배치가 그 카운트를 영구히 1 이상으로 만든다 → **F1(프로브 확정)** |
| **잘못된 성공(false success)** | 있음 — main 은 `transport:'idle'`(AC6 준수)로 **올바른 사실**을 보내는데 renderer 가 그것을 뒤집는다. 스냅샷만 보면 정상이라 로그·테스트로는 정상처럼 읽힌다 | `transport:'idle'` + `foreground:'idle'` 인데 `sessionBusy=true` — 두 계층의 진실이 어긋난다 |
| 되돌릴 수 있는가 | 예 — 순수 파생 상태. DB·IPC 채널 무변경(`chat:event` variant 교체만) | 채널 총계 **85 유지**(문서 헤더 85 = 도메인 합 85 = `CHANNELS` 실측 85, 직접 재측정) |
| 설계가 의도한 것을 구현이 실제로 했는가 | **projector 는 설계대로, 리듀서는 설계에 없는 것을 했다** | plan §A "**transport 는 lease/listen frame 에서만 파생**… 잔여와 **직교**(P1-14)" · "foreground 응답 중은 기존 `inflight` 가 담당(0143 유지)". 구현은 (1) `busy`(=잔여 포함)를 `listening` 에 OR 하고 (2) `inflight` 를 **main 파생값으로 전환**했다 |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **2건 넘었다** | ⓐ `inflight: ev.foreground !== 'idle'` — plan 이 명시적으로 renderer 소유로 남긴 값의 **소유권 이전**(AC13 의도 변경) ⓑ `listening` 에 `busy` OR — AC6 의 직교 규칙 우회. 둘 다 `⚠️ 보고만` 대상이었다 |

### F1 — 잔여가 애니메이션을 영구히 붙든다 (프로브로 확정)

```
snapshot: {"foreground":"idle","transport":"idle","busy":true,
           "queuedCount":0,"deliveryPendingCount":1,"residualCount":0,...}
listening: true   inflight: false   sessionBusy: true
```

실제 `PendingMessageQueue` + `SessionActivityProjector` + 실제 `chatReducer` 를 조립해 실행한 결과다.
경로: `enqueue → reserveItem → commit → orphanUnconfirmed(chain 종료)` → `deliveryPendingCount:1`
→ `busy:true` → 리듀서 `listening:true` → `sessionBusy` → `ChatTile.tsx:53` → `TranscriptView pending`
→ `PendingAssistant`(애니메이션).

- `orphaned` 는 **0154 가 의도적으로 유지**한다(`pending-message-queue.ts:394-398` — "재주입도 폐기도
  아닌 **대기**가 옳다"). 회수 시점은 늦은 echo·채널 사망·세션 폐기뿐이다.
- 따라서 **취소 후 사용자가 다음 메시지를 보낼 때까지 애니메이션이 계속 돈다.** 사용자가 자리를 비우면
  무한이다. 이것이 정확히 이번 작업이 받은 보고 ②-a 다.
- plan AC6 이 "**`residualCount>0` 이어도 체인이 없으면 `idle`**" 을 못박은 이유가 이것인데, projector 는
  지켰고 리듀서가 되돌렸다.

### F2 — `inflight` 의 소유권이 renderer → main 으로 넘어갔다

`chatReducer.ts:530` `inflight: ev.foreground !== 'idle'`. plan 은 "foreground 응답 중은 **기존
`inflight` 가 담당**(0143 유지 — 애니메이션 정책 불변)" 이라 썼고, AC13 은 "`sessionBusy` 정의가 그대로여서
중단 버튼·steer 라우팅·concurrency 가 **현행과 동일**" 을 요구했다. **정의는 불변이지만 입력이 바뀌었다** —
`BEGIN_TURN`/`TURN_END_RESET`/`CANCEL_CHAT` 의 낙관적 판정을 **더 높은 revision 스냅샷이 언제든 덮어쓴다.**

- 이번 코드에서 취소 직후 되살아나지 **않는** 이유는 `recompute` 의 `queueMicrotask` 배칭이
  `chat-turn.ts:1219`(orphan) ~ `:1224`(`releaseChain`) 를 한 tick 으로 묶어 **최종 상태만** 나가기
  때문이다(`session-activity-projector.ts:128-137`). 즉 **우연히 안전하다** — 그 사이에 `await` 가 하나만
  들어와도 `foreground:'streaming'` 스냅샷이 새 나가 취소 직후 애니메이션이 되살아난다.
- 이 취약성은 **테스트에 고정돼 있지 않다.**

## 역방향 탐색 (매트릭스 전 선행)

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export `chatStore.ts :: sessionBusy` | **오탐** | `:944`·`:1278` 에서 사용. AC13 의 "정의 불변" 은 **문자 그대로는 충족**(`:1281-1283`) |
| `session-activity-projector.ts :: ActivityLeaseSource` / `SessionActivityProjectorDeps` | **정상** | `bootstrap.ts:622-640` 이 구조적으로 만족·주입. 배선 확인됨 |
| `useChatActivity` 의 `s.sessions[s.activeKey].session` **옵셔널 체이닝 없음** | **정상(관례 일치)** | 같은 파일 `:142,1262,1267,1315,1321` 이 동일 패턴. 신규 위험 아님 |
| **스크립트 밖** — AC 동사가 테스트에 있는가 | **다수 부재** | `StatusLine.test.tsx`·`activity-broadcast.test.ts`·`handlers/session.test.ts`·`chat-turn.lease.test.ts` **전부 파일 부재** |
| **스크립트 밖** — 리듀서 테스트 헬퍼가 위험 분기를 덮는가 | **덮지 않는다** | `chatReducer.listen.test.ts:21` 헬퍼가 `busy: transport === 'listening'` 로 **고정** → `foreground idle && busy` 분기(F1)가 **한 번도 실행되지 않는다** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "additive legacy publisher 는 제거했다 — 호환보다 단일 권위" | **타당 ✅** | AC17 실측 0건으로 확인(`rg 'chat\.(listen\|residual)' app/src` → 히트 0) |
| "residual 이 deliveryPending 부분집합이라 UI 에서 차감" | **타당 ✅** | `StatusLine.tsx` `ordinaryDeliveryPending = max(0, delivery - residual)` — 중복 표기 방지 정확 |
| 선조치 #1 load/live revision 역전 보존 | **타당 ✅** | AC20 충족 |
| 선조치 #2 alias 흡수 · #4 tombstone | **타당 ✅** | AC18·19 대응 |
| (미기재) `inflight` 소유권 이전 · `busy` OR | **미보고 변경** | plan 에도 `[구현자 기입]` 에도 없다 → **F1·F2**, D4·D5 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 4소스 중 하나만 바뀌어도 재발행 | ✅ | `session-activity-projector.test.ts` (queue·tracker·lease·transport 구독 `:36-43`) |
| 2 | 동일 값 무재발행 | ✅ | `flushOne` 의 `sameActivity` 조기 반환(`:156`) + 테스트 |
| 3 | `revision` 세션별 단조 증가 | ✅ | `:157-159` + 테스트 |
| 4 | 리듀서가 낮은 revision 무시 | ✅ | `chatReducer.ts:519` + `listen.test.ts:40-42`(중복 revision 무시) |
| 5 | foreground·transport·busy·count 원자 적용 | ✅ | `chatReducer.ts:520-534` + `listen.test.ts` describe |
| 6 | **transport 는 lease/listen frame 에서만** — 잔여와 직교 | ⚠️ **main 준수 / renderer 위반** | projector `:165` 는 정확 ✅. 그러나 리듀서가 `busy` 로 우회 → **F1** |
| 7 | 잔여만 있고 lease 없으면 **새 체인** (main admission) | ❌ **미검증** | `chat-turn.lease.test.ts` 파일 부재 |
| 8 | 체인 종료 후 잔여 커밋 → `residualCount:0` 발행 | ✅ | 앱 수명 구독(`bootstrap.ts:622`) + projector 테스트 |
| 9 | 모든 renderer broadcast · 파괴 뷰어 제외 | ⚠️ 구현만 | `infra/ipc/send.ts` `broadcastChatEvent` 추가 확인. `activity-broadcast.test.ts` 파일 부재 |
| 10 | 세션 로드 응답에 스냅샷 포함 | ⚠️ 구현만 | `bootstrap.ts:666` `getActivity` 주입 + `handlers/session.ts` 배선 ✅. `handlers/session.test.ts` 파일 부재 |
| 11 | count 는 **메시지 수** | ✅ | `pending-message-queue.ts:437` `sum(batch.ids.length)` + projector 테스트 |
| 12 | StatusLine 사실 조합 + 애니메이션 유지 | ⚠️ 부분 | `StatusLine.tsx` facts 조합 구현 ✅. 리듀서 라벨 반영 단언 없음, `StatusLine.test.tsx` 부재 |
| 13 | `sessionBusy` 정의 불변 → **현행과 동일** | ❌ **의도 미충족** | 정의는 불변(`chatStore.ts:1281`)이나 `inflight` 입력이 main 파생으로 바뀌어 **동작 동일성이 깨졌다**(F1 이 그 귀결) |
| 14 | 무활동 시 **라벨만** 전환·프레임 유지 | ⚠️ 구현만 | `StatusLine.tsx` `LONG_WAIT_SECONDS=30` + `finishingSlow` ✅. 테스트 없음. **plan 상수명 `IDLE_HINT_MS=30_000` 과 이름·단위 불일치** → D6 |
| 15 | a11y 텍스트 + reduced-motion 대체 | ⚠️ 구현만 | `aria-live`·`aria-label`·`motion-reduce:hidden`/`inline` 구현 ✅. `StatusLine.test.tsx` 부재 |
| 16 | `IPC_CONTRACT.md` 가 단일 계약 + hydrate 반영 | ✅ | `IPC_CONTRACT.md:452` `chat.activity` 행 + `:40` discardSession 갱신. **채널 85 재측정 일치** |
| 17 | **legacy variant/producer 0건** | ✅ | `grep -rn "chat\.listen\|chat\.residual" app/src` → **히트 0** |
| 18 | `promoteProjection` revision 원자 이전 | ✅ | `session-activity-projector.ts:67-88` + 승격 테스트 |
| 19 | 세션 삭제·shutdown 시 캐시 제거 | ✅ | `:90-101` `clear` + tombstone + `bootstrap.ts:664` 배선 + 테스트 |
| 20 | hydrate 가 최신 live revision 을 되감지 않음 | ✅ | `chatReducer.ts:644-646` + `listen.test.ts:82` |
| 21 | 무활동 라벨은 임계 경과 + **foreground 아님** 일 때만 | ⚠️ 구현만 | `StatusLine.tsx` `waiting && foreground === 'idle'` 조건 ✅. 테스트 없음 |
| 22 | 실기 | ⏳ 사람 실기 대기 | GUI 필요 |

**집계 — ✅ 11 / ⚠️ 8 / ❌ 2 / ⏳ 1 (22건).**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | 전량 green (아래) |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거 | 이견 시 중재 | 위 매트릭스 |
| F1 재현 | ✅ **실모듈 조립 실행** | — | 확정 |
| IPC 채널 수 재측정 | ✅ | — | 문서 85 = 도메인 합 85 = 코드 85 ✅ |
| 레이어 경계 위반 0 | ✅ | — | lint 0 error — projector 가 lease 를 **구조적 source 로 주입**받아 feature 교차 회피 ✅ |
| **0143 결정(⑥) 재확인** — main 파생 `inflight` 가 사용자 결정과 충돌하는가 | ✖ 옵션 제시 | ✅ 결정 | **D4 — 사람 결정 대기** |
| 대기 라벨 문구·배치 시각 검증(AC12·15·22) | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          → ✖ 1 problem (0 errors, 1 warning)   # 0102 선재 베이스라인
$ npm run typecheck               → 3/3 통과
$ ./node_modules/.bin/vitest run  → Test Files 198 passed · Tests 1793 passed
$ node --test "scripts/*.test.mjs"→ # pass 28 · # fail 0
```

> DB 로드 스위트 포함 **전량 green** — "환경 기인 실패 제외" 없이 내린 판정이다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계(내 책임)**: 스냅샷 **필드 계약**(`busy` 를 넣는다)은 정의했으면서 **소비 규칙**(리듀서가
  `listening` 을 무엇으로 만드는가)은 산문으로만 뒀다. AC6 을 "projector 가 transport 를 어떻게 계산하는가"
  로만 쓰고 "**renderer 가 listening 을 무엇에서 파생하는가**" 를 기준으로 쓰지 않았다 — 그래서 main 이
  전부 맞는데도 화면이 틀릴 수 있는 공간이 남았다. `busy` 라는 편의 필드를 계약에 넣은 것 자체가
  유혹이었다: **파생 가능한 합성값을 계약에 넣으면 소비자가 규칙을 우회한다.**
- **구현 단계**: 미보고 변경 2건(F1·F2). 특히 `inflight` 소유권 이전은 plan 이 명시적으로 "0143 유지·
  정책 불변" 이라 못박은 지점이라 `⚠️ 보고만` 이 분명했다. 반면 legacy publisher 완전 제거·residual
  차감·revision 역전 보존은 설계보다 정확했다.
- **검증 단계 — 이번 verify 가 못 본 것**: ⓐ StatusLine 의 **실제 렌더 결과**(문구·2개+합계 규칙·
  reduced-motion)는 테스트도 실기도 없이 **코드 리딩으로만** 봤다. ⓑ 다중 창 broadcast(AC9)는 실행하지
  못했다. ⓒ `queueMicrotask` 배칭이 취소 경로를 우연히 지켜주는 구간(F2)의 **다른 진입 경로**를 전수
  탐색하지 못했다 — 한 곳만 확인했다.

> 새 패턴 1건 축적 — **"main 이 사실을 정확히 보내도 renderer 파생 규칙을 기준으로 고정하지 않으면
> 화면은 틀릴 수 있다. 표시 계약의 인수 기준은 *발행 측* 과 *소비 측* 을 각각 1건씩 둔다."**

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **F1 — `listening` 파생에서 `busy` 를 뺀다.** `listening = ev.transport === 'listening'` 으로
      좁힌다(AC6 의 직교 규칙). "기다릴 이유" 는 애니메이션이 아니라 **라벨/개수**로 표시한다 —
      그것이 결정 ⑥ 아래 0167 이 하려던 일이다. 회귀 테스트: *transport idle + deliveryPendingCount>0
      이면 `listening=false` 이고 잔여 라벨만 뜬다*.
- [ ] **F2 — `inflight` 를 renderer 소유로 되돌리거나, 이전을 사용자 결정으로 올린다.**
      되돌린다면 스냅샷의 `foreground` 는 **라벨 전용**으로만 쓴다.
- [ ] **AC13** — "현행과 동일" 을 **동작으로** 고정하는 테스트: `BEGIN_TURN` → 스냅샷 도착 →
      `CANCEL_CHAT` 순서에서 `sessionBusy` 궤적이 0143 과 같은지.
- [ ] **AC7** — main admission 테스트(잔여만 있고 lease 없으면 새 체인).
- [ ] **AC9·AC10** — broadcast 뷰어 필터 · 세션 로드 hydrate 테스트.
- [ ] **AC12·14·15·21** — `StatusLine` 단위 테스트(사실 조합 · 상위 2 + 합계 · 무활동 라벨 ·
      foreground 미적용 · a11y/reduced-motion).
- [ ] **D6** — 무활동 상수를 plan 의 `IDLE_HINT_MS = 30_000` 과 이름·단위를 맞춘다
      (`LONG_WAIT_SECONDS = 30` → 문서 또는 코드 한쪽으로 통일).

## 결론 / 다음 단계

**FAIL (r1).** projector 자체는 설계대로 정확히 들어왔다 — 앱 수명 구독, 단조 revision, microtask 병합,
key 승격, tombstone, 그리고 **legacy publisher 완전 제거(AC17 실측 0건)** 는 요구 이상이다. 문제는
**소비 측 한 줄**이다: `listening` 에 `busy` 를 섞으면서 이 작업이 고치려던 증상 ②-a 를 **결정론적으로
재현**하게 됐고(F1, 실행 확정), plan 이 renderer 소유로 남긴 `inflight` 가 말없이 main 파생으로 넘어갔다(F2).

다음 = **구현자**(라운드 2). F1 은 한 줄 수정 + 회귀 테스트로 닫힌다.
