# Plan — 0137-composer-restore-dedup

## 메타

| 항목 | 값 |
|---|---|
| slug | `0137-composer-restore-dedup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-21 |
| 매핑 | PHASES 승격 예정 / PR 미정 |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "composer textarea 에 자꾸 취소했던 메시지버블의 텍스트로 채워진다. 대기 메시지버블을 취소하여 메시지를 지웠는데 턴이 지나가면서 자꾸 textarea 에 취소 텍스트를 복원한다." | 라이브 세션 요청 |
| 추론 의도 | 취소한 held 메시지 텍스트의 composer 복원은 최초 1회만 일어나야 하며, 이후 사용자가 지운 입력을 재렌더가 덮어써서는 안 된다(해석). | 위 증상 + 기존 `initialDraft` 시드 1회 적용 설계와의 대칭 |

## Context (왜)

중단 버튼으로 held(대기) 메시지 버블을 전량 취소하면 그 텍스트가 composer 로 복원된다
(0067 확정 5 — 편집 가능하게). 그런데 사용자가 그 텍스트를 지운 뒤에도 턴이 진행되며
(스트리밍/telemetry) 재렌더가 일어날 때마다 취소 텍스트가 textarea 에 다시 채워진다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 중단 버튼 전량 취소 경로가 store `draftRestore` 를 `{ key, seq, text }` 로 세팅 | `app/src/renderer/src/features/chat/store/chatStore.ts:408-425` |
| `draftRestore` 는 선언·초기화만 있고 소비 후 **null 로 clear 하는 코드가 없음** | `chatStore.ts:96`(선언)·`:126`(초기화). 전체 grep 결과 set 지점 1곳뿐 |
| ChatTile 이 매 렌더 `draftRestore` 에서 **새 객체 리터럴** `storeRestore` 를 만들어 Composer `restoredDraft` prop 으로 churn | `app/src/renderer/src/features/chat/components/ChatTile.tsx:60-67`·`:125` |
| Composer 복원 effect 가 `[restoredDraft]` 객체 참조에 의존하며 **중복 적용 가드 없음** | `app/src/renderer/src/features/chat/components/Composer.tsx:172-181`(수정 전) |
| 바로 위 `initialDraft` 시드 effect 는 `seededRef` 로 1회만 적용 — 대칭 가드가 restore 에 부재한 것이 결함 | `Composer.tsx:160-170` |
| ChatTile 이 `messages`/`inflight`/`pendingSteer` 를 구독 → 턴 진행마다 재렌더 발생(churn 유발) | `ChatTile.tsx:48-54` |
| hover 단건 취소 경로는 ChatTile 로컬 state(`setRestoredDraft`)로 1회 적용이라 이 버그 없음 | `ChatTile.tsx:105`·`chatStore.test.ts:857-868` |

## 인수 기준 (Acceptance Criteria)

1. held 메시지를 중단 버튼으로 전량 취소하면 취소 텍스트가 composer 에 **1회** 복원된다(회귀 없음).
2. 복원된 텍스트를 사용자가 지운 뒤 턴 진행(스트리밍/telemetry)으로 ChatTile 이 재렌더되어도 textarea 가 **다시 채워지지 않는다**.
3. 서로 다른 취소 신호(고유 `seq`/`id`)는 각각 1회씩 정상 적용된다.
4. 게이트 통과: lint 0 error · typecheck 3분할 0 · 관련 vitest green.

## 범위 / 비범위

- **범위**: Composer 복원 effect 의 중복-적용 가드 추가(단일 파일).
- **비범위**: store `draftRestore` 를 소비 후 clear 하도록 바꾸는 것(현 설계는 `initialDraft` 소스를 clear 하지 않고 `seededRef` 로 dedup 하는 것과 일관 — 이번 최소 수정에서 유지). 세션 전환 후 remount 재복원 엣지(둘 다 소스 미clear 이므로 `initialDraft` 와 동일 거동 — 별도 후속 소관).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 `useRef`(이미 import) 재사용. 신규 의존성 0.
- 전제: 각 취소 신호의 `seq`(= `Date.now()`)가 신호마다 고유. store·hover 양 경로 모두 `Date.now()` 사용.

## 설계

- Composer 복원 effect 에 `restoredRef = useRef<number | null>(null)` 가드를 추가해
  `restoredDraft.id`(= store `seq`) 단위로 정확히 1회만 적용. 객체 참조가 매 렌더 churn
  해도 같은 `id` 는 재적용되지 않는다.
- **재사용**: 같은 파일 `initialDraft` 의 `seededRef` 패턴(`Composer.tsx:160-170`)을 미러링.
- 레이어 경계: features 내부 컴포넌트 단일 파일 변경 — store·ChatTile 무변경, 경계 영향 0.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 동시성/멀티세션: `storeRestore` 는 `draftRestore.key === activeKey` 로 활성 세션 것만 적용 — 무변경.
- 접근성/테마: N/A(로직만).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 같은 ms 에 두 취소가 같은 `seq` 를 가져 두 번째가 스킵될 이론적 가능성 | store 전량 취소는 present 항목을 **join** 해 한 신호로 만들므로 실질 무관. 극히 드묾. |
| store `draftRestore` 미clear 유지 → 세션 remount 재복원 엣지 잔존 | `initialDraft` 와 동일 거동으로 수용. 필요 시 후속 핸드오프에서 소비-clear 도입. |

## 영향 받는 파일

- `app/src/renderer/src/features/chat/components/Composer.tsx`

## 참고 문서

- `docs/arch/frontend/` (Composer/ChatTile 렌더링), 0067(단일 send·held 취소 복원)

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI-중립 기본 게이트) + 관련 vitest.
- 신규 테스트: 순수 변환기/reducer 변경 아님(effect 가드) → UI 시각 검증으로 갈음. 기존 `chatStore.test.ts` 회귀 없음 확인.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 인용, 추론 표기.
- [x] 자료조사 — 발견마다 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 신규 의존성 0 명시.
- [x] 파생 UX — 멀티세션 활성키 가드 확인.
- [x] 리스크 — seq 충돌·remount 엣지 분리.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 근본 원인은 store `draftRestore` 미clear + ChatTile 객체 churn +
  effect 가드 부재의 3중 결합. 셋 중 **effect 가드**가 churn 소스와 무관하게 재발화를
  전부 막는 가장 좁은 수정점이라 채택. ChatTile `useMemo` 안정화나 store 소비-clear 는
  대안이나, 전자는 remount·미래 churn 을 못 막고 후자는 store 의미론 변경(범위 확대)이라
  최소 수정 원칙에 어긋난다.
- 이견 / 우려: 없음(범위 §의 remount 엣지는 의도적 수용).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | store `draftRestore` 미clear 로 세션 remount 시 재복원 가능 | ⚠️ 보고만 — `initialDraft` 와 동일 거동, 이번 범위 밖 | 범위 §·리스크 § |

## [구현자 기입] 구현 체크리스트

- [x] `restoredRef` 가드 추가(`restoredDraft.id` 단위 1회 적용)
- [x] lint 0 error
- [x] typecheck 3분할 0
- [x] `chatStore.test.ts` 회귀 없음(42/42)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/renderer/src/features/chat/components/Composer.tsx` (복원 effect 에 `restoredRef` id 가드) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run …/chatStore.test.ts` |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning 무관) / typecheck ✅ 3분할 / vitest ✅ 42/42 |
| 블로커 / 역질문 | 없음. (electron ABI egress 차단으로 `npm test` 전체·dev 실기는 CI/사람 몫 — 알려진 베이스라인) |
| 대상 커밋 | 커밋 시 기재 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

(없음 — 인수 4/4 기계 충족, 실기 시각 검증은 사람 몫.)
