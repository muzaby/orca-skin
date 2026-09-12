# Verify — 0231-background-progress-and-turn-state

> 절차 정본은 [`.agents/skills/handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md).
> 문장 규칙은 [`docs/handoff/AGENTS.md §산출물 문장 규칙`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0231-background-progress-and-turn-state` |
| 검증자 | Claude Code |
| 일자 | 2026-09-12 |
| 대상 커밋/range | `171e609..684b766` |
| 구현 전 plan 기준 | `171e609`(plan/READY) |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `171e609:V1` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** (root `PAIR_FAIL` 2 + `PLAN_GAP` 1) |
| 자기 검증 여부 | **구현자 = 검증자(둘 다 `Agent: claude`)** — §4에 구현 보고가 이름을 대지 않은 적대 축 **9건**을 넣었다(A1~A9). 그중 A8이 root `PAIR_FAIL`(D2)을 냈다 |

---

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **예 — 추가만 160줄**. `git diff 171e609..684b766 -- .../plan.md | grep -c "^-[^-]"` → `0`.
- **기준선이 diff로 성립하는가**: **예**. 설계 커밋(`171e609`)과 구현 커밋(`684b766`)이 갈려 있다.
- Decision Ledger 변경: **없음**(삭제 0 · 추가분은 전부 `## [구현자 기입]` 이하).
- Product/UX Contract 변경: **없음**. 구현 보고가 "§5에 `listening` 행을 한 줄 더했다"고 적었으나 그 행은 `171e609`(설계 커밋)에 이미 있다 — 구현 커밋은 §5를 건드리지 않았다.
- AC 변경: **없음**. AT-101~AT-114 원문이 `171e609` 그대로다.
- V node/pair·requiredness·§10·oracle 변경: **없음**.
- 채점에 사용할 원 기준: `171e609`의 §7 AC 표 · §7-A pair 표 · §10 강제 지점 표.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | §4 "V를 0230에서 상속하는가 = 아니오". 기준 V `none`, 이번 revision `V1` |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | `NEW`·`CHANGED` 15개 전건에 같은 레벨 `REQUIRED` pair 존재(재검산 R 7 · SD 1 · AR 3 · MD 4) |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | `INHERITED`는 R-106 하나, VP-212가 `REGRESSION`으로 받는다 |
| pair별 path·§10 전수·직접 oracle | **PLAN_GAP 1** | AT-101의 도달 경로가 `→ 카드`인데 §11 구현 설계에 카드 파일이 없다(D3) |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 11 pair가 `required` 변이를 등록하고 9개가 그것을 덮는다. 나머지 8은 직접 oracle |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 0230과 같은 5종(subtree unit · typecheck · lint · build · doc inventory) |

- V 도입 전 plan이면 읽기 전용 합성 매핑: **해당 없음** — V1을 직접 선언한 plan이다.
- root PLAN_GAP과 영향 pair: **D3 → VP-201**.

---

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-001 | spark 라인 요약 + 클릭 진입 | 실행 줄 → `openBackgroundTaskList` → 타일 활성·선택 해제 | ✅ |
| D-002 | `ready` 전송은 정식 사용자 턴, 앞 어시스턴트 턴은 종료 | `chatStore.ts:910` → `sendAdmission.ts:35` → 말풍선 | ✅ |
| D-101 | 실행 줄은 transcript 안, 마지막 턴 아래 | `Exchange.tsx:77` — `PendingAssistant` 뒤 · `PendingSteerTurn` 앞 | ✅ 동작 / ⚠️ 배선 미잠금(D2) |
| D-102 | main의 held 큐 메커니즘 불변 | `post-turn.ts` production 무변경 — 변경은 `post-turn.schedules.test.ts` 한 파일뿐 | ✅ |
| D-103 | 진행률(%) 없음 | `backgroundRun.ts`·`BackgroundRunRow.tsx`·`mapToolProgress`에 백분율 토큰 0건 | ✅ |
| D-104 | 배지는 런치 영수증 관측분만 | `launchedCount` → 프로젝터 `:218`. 턴-후 루프는 `count` 유지 | ✅ |
| D-105 | 실행 줄 클릭은 목록 | `SELECT_SUBAGENT_TASK: null` + 타일 활성 | ✅ |
| D-106 | 통지 라벨을 `joined.kind` 하나가 가른다 | `SubagentNoticeRow.tsx:55-57` → `lineKey`·`hoverTint`·`hasDetail` | ✅ |

### end-to-end 흐름

```text
SDK tool_progress / task_progress
  → claude-map mapToolProgress (귀속 실패 시 드롭)
  → subagent.task phase:'progress' (transient — writer.ts:445 가 영속 차단)
  → chatStore.patchSubagentMeta (summary·elapsedSeconds·retry 교체)
  → deriveBackgroundRun → BackgroundRunRow → (클릭) 백그라운드 작업 타일 목록
                                     ↑ elapsedSeconds 는 여기 오지 않는다 (D1)
사용자 전송
  → shouldQueueAsPending(transportReady) → 정식 말풍선 / 예약 말풍선
```

---

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 진행 신호는 전부 스냅샷 교체다. 정착이 `retry`를 지운다(`chatStore.ts:348`) |
| false success 가능성 | **있다 — D1** | `elapsedSeconds`가 store까지 가고 멈춘다. 어댑터 테스트가 초록이라 "경과가 화면에 왔다"로 읽힌다 |
| partial failure/rollback | 해당 없음 | 외부 쓰기·마이그레이션 없음 |
| Product/UX의 A가 아닌 다른 B | **부분 — D1** | AT-101이 요구한 것은 카드의 경과이고 구현된 것은 store 한 칸이다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | `shouldQueueAsPending`이 `ready` 판정을 `sessionResponding`과 같은 신호에 묶었다 |
| 최적화가 잃은 재검증·취소·만료 관측 | 없음 | 실행 줄은 자기 틱을 만들지 않고 기존 `listenStartedAt` 앵커를 쓴다 |
| 출력/요청 worst-case 상한 | 무한 아님 | `tool_progress`는 파트를 만들지 않고 `subagentMeta[id]` 한 칸을 덮는다 |
| 미배선 가능성 | **있다 — D2** | `TranscriptView`의 `last`를 지워도 전 스위트 초록(4619 pass · 0 fail) |

---

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 171e609..684b766
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `BackgroundRunMetaLike`·`BackgroundRunModel` (타입 전용) | 정상 | 정의 파일 `deriveBackgroundRun` 시그니처가 쓴다 |
| `SubagentMetaState` 테스트 참조 3 · 프로덕션 0 | 정상(오탐) | 타입 심볼 — `useSubagentMeta` 반환 타입·`patchSubagentMeta` 지역 타입 |
| `buildTurnContent`·`NEW_CHAT_KEY`·`ingestChatEvent` | 범위 밖 | 이번 diff 무관, 기존 표면 |
| **`chat.backgroundRun.openHint` (ko·en)** | **죽은 키 — D4** | `grep -rn openHint src` → resources 2건뿐. 구현 보고는 "3키 전부 쓴다"고 적었다 |
| **`subagent.task.heartbeat` 필드** | **소비처 0 — D5** | 어댑터가 싣고 `patchSubagentMeta`가 읽지 않는다. `SubagentMetaState`에 필드 자체가 없다 |
| **`SubagentMetaState.elapsedSeconds`** | **미배선 — D1** | `useElapsed`/`formatElapsed` 3소비처(`StatusLine`·`AgentTaskRow`·`BackgroundRunRow`) 전부 로컬 앵커를 쓴다 |
| **`TranscriptView` → `Exchange last` 배선** | **미잠금 — D2** | A8 변이 green |
| 배지 의미 변경의 기존 소비처 영향 | 무영향 | `activityBackgroundTaskCount` 소비처 2(`activityLabel` 사실 · 실행 줄). `deriveStatus`는 foreground에서 `streaming`을 먼저 반환해 0167 AC21 유지 |
| 형제 파일 정책 비대칭 | 없음 | scan-surface §3 "(없음)" |
| SSOT drift | 없음 | `sessionAwaitingBackground`가 `sessionResponding(s)`를 직접 부른다 — 두 번째 술어를 만들지 않았다 |

---

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: **예**. `sendAdmission.test.ts`의 `턴-후 체인 진행 중(listening) → 예약 (0143)`이 두 케이스로 갈렸다(`listening+ready→false` · `listening+!ready→true`). `pendingCount` 케이스도 남았다.
- 핵심 입력/분기가 실제 실행됨: 0231 관련 10파일 **77케이스 전건 통과**(`vitest run <10 suites>`).
- structural proxy만으로 통과시킨 AC: **AT-101 — D1**. 어댑터 반환값 단언이 "카드가 경과를 보인다"를 대신했다.
- **선택된 적대 증거 재측정**: 등록 변이 **9건 전건 red**(M1~M9). 미검출 0. 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이라 이전 라운드 없음 — **덮개 회귀 0건**.
- **자기검증 분모**: 구현자 = 검증자. 구현 보고에 이름이 없는 축 **9건 신설**(A1~A9) — 형제 슬롯 위치 맞바꿈 1 · 같은 계약의 다른 지점 2 · 선조치 규칙 역검 3 · 분모 독립 재열거 1 · 덮개 회귀 후보 1 · **외곽 배선 1(A8 → D2)**.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — `claude-map.ts:466` 최상위 분기를 `false`로 | 전체 | 최초 | **red 5** (보고 5) | `VP-202 등록 변이` |
| M2 — 배지를 `count()`로 (형제 맞바꿈) | 전체 | 최초 | **red 3** (보고 2) | `VP-207 등록 변이` |
| M3 — `count()`를 `launchedCount()`로 (반대 방향) | 전체 | 최초 | **red 4** (보고 2) | `VP-207 등록 변이` |
| M4 — `ready` 탈출구 제거(0153 원형) | 전체 | 최초 | **red 2** (보고 2) | `VP-210 등록 변이` |
| M5 — 탈출구가 `pendingCount`를 삼킴 | 전체 | 최초 | **red 2** (보고 2) | `VP-210·212 등록 변이` |
| M6 — `Exchange.tsx:77` 배선 제거 | 전체 | 최초 | **red 3** (보고 3) | `VP-214 등록 변이` |
| M7 — `chatStore.ts:1812` 배타 조건 제거 | 전체 | 최초 | **red 1** (보고 1) | `VP-213·215 등록 변이` |
| M8 — 통지 두 라벨 맞바꿈 | 전체 | 최초 | **red 2** (보고 2) | `VP-216 등록 변이` |
| M9 — `summary` 흡수 제거 | 전체 | 최초 | **red 3** (보고 3) | `VP-204 등록 변이` |
| **A1 — 실행 줄을 턴 위로 이동(위치 맞바꿈)** | 전체 | 신설 | **red 1** — AT-112 순서 단언 | 검증자 신설 |
| **A2 — 호출부 `transportReady`를 `!== 'idle'`로** | 전체 | 신설 | **red 6** — 0153 케이스 3 포함 | 검증자 신설 · EP-205 두 번째 지점 |
| **A3 — 귀속 실패 드롭 가드 제거** | 전체 | 신설 | **red 1** | 검증자 신설 · 선조치 #1 역검 |
| **A4 — `lastToolName` 부모 가드 제거** | 전체 | 신설 | **red 1** | 검증자 신설 · 선조치 #2 역검 |
| **A5 — `launchedCount` 본문이 전량을 셈** | 전체 | 신설 | **red 3** | 검증자 신설 · EP-203 다른 지점 |
| **A6 — store의 `elapsedSeconds` 흡수 제거** | 전체 | 신설 | **red 3 — 전부 store 단언** | 검증자 신설 → **D1** |
| **A7 — `activityRevision` 단조 가드 제거** | 전체 | 신설 | **red 2** — `chatStore.schedules.test.ts` | 검증자 신설 · 덮개 회귀 **없음** |
| **A8 — `TranscriptView`의 `last` prop 제거** | 전체 | 신설 | **green — 0 fail / 4619 pass** | 검증자 신설 → **D2 root** |
| **A9 — 어댑터의 `elapsedSeconds` 방출 제거** | 전체 | 신설 | **red 3 — 전부 어댑터 단언** | 검증자 신설 → **D1** |

- 동작 보존 추출 라운드인가: **아니오** — 신규 파일 2개는 추가고 이동이 아니다. hunk 되돌림 판정 미적용.
- 소거 변이의 잔여물 수렴: **해당 없음** — A8은 typecheck·lint 잔여물 없이 green이다(`last?: boolean`이 선택 prop이라 제거해도 진단 0).
- 형제 슬롯 맞바꿈 변이: **3슬롯 맞바꿔 전건 검출** — M2/M3(두 세기) · M8(두 라벨) · A1(줄 위치).
- `N회` 기준의 실제 관측 주체: 해당 없음 — 이번 AC에 횟수 기준이 없다.
- 순서 기준의 관측 훅: AT-112가 `html.indexOf()` 두 값으로 순서를 관측한다.

---

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-204 | MD-103 ↔ UT / UT | REQUIRED | PASS | `subagentProgress.test.ts` 7케이스 · M9 red 3 | `patchSubagentMeta` 단독 / 2-2 |
| VP-210 | MD-102 ↔ UT / UT | REQUIRED | PASS | `sendAdmission.test.ts` 6케이스 · M4·M5 red | 술어 단독 / 2-2 |
| VP-215 | MD-101 ↔ UT / UT | REQUIRED | PASS | `backgroundRun.test.ts` 7케이스 · M7 red | 파생 단독 / 2-2 |
| VP-217 | MD-104 ↔ UT / UT | REQUIRED | PASS | M8이 렌더까지 red — 라벨 키 선택 공유 증거 | 라벨 선택 1 / 1-1 |
| VP-202 | AR-101 ↔ IT / IT | REQUIRED | PASS | `claude-map.toolProgress.test.ts` 6케이스(프로덕션 진입점) · M1 red 5 | 최상위 분기 → 이벤트 / 1-1 |
| VP-207 | AR-102 ↔ IT / IT | REQUIRED | PASS | `background-badge-count.test.ts` — 두 소비자가 **다른 값**(배지 0 · 루프 1) · M2·M3·A5 red | 트래커 → 두 소비자 / 2-2 |
| **VP-214** | **AR-103 ↔ IT / IT** | **REQUIRED** | **PAIR_FAIL** | **A8 green** — `TranscriptView`의 `last`를 지우면 실행 줄이 제품에서 사라지는데 전 스위트 초록 | 컨테이너 마운트가 `Exchange`에서 끊긴다 / D2 |
| VP-218 | SD-101 ↔ ST / ST | REQUIRED | `BLOCKED_BY:VP-214` | 구간 이음매 미관측 | VP-214의 배선이 이 구간 안에 있다 / §10 `0` |
| **VP-201** | **R-101 ↔ AT-101·AT-102 / AT** | **REQUIRED** | **PAIR_FAIL** | AT-102는 렌더까지 닫혔다(`재시도 대기 중 2/5`). **AT-101은 렌더 oracle 부재** — A6·A9 red가 전부 store·어댑터 단언 | 경로가 store에서 끝난다 / D1 |
| VP-203 | R-102 ↔ AT-103 / AT | REQUIRED | PASS | `요약이 있으면 꼬리에 한 줄로 붙는다` 렌더 | `task_progress` → 실행 줄 / 2-2 |
| VP-205 | R-102 ↔ AT-104 / AT | REGRESSION | PASS | `AT-104 — 두 번째 usage 스냅샷이…`(1500·5) · M9와 같은 지점 | 어댑터 누산부 + store / 2-2 |
| VP-206 | R-103 ↔ AT-105 / AT | REQUIRED | PASS | `AT-105 — foreground 만 추적 중이면 배지는 0이다` | 트래커 → 프로젝터 / 2-2 |
| VP-208 | R-104 ↔ AT-107 / AT | REQUIRED | PASS | `backgroundTaskList.test.ts` 3케이스(형제 대조 포함) | 클릭 → `chatActions` → 타일 / 1-1 |
| VP-209 | R-105 ↔ AT-109·AT-110 / AT | REQUIRED | PASS | `chatStore.listen.test.ts` AT-109·AT-110 · **A2 red 6** | `chatStore.ts:910` 호출부 / 2-2 |
| VP-211 | R-105 ↔ AT-108 / AT | REGRESSION | PASS | AT-109 케이스 안의 `sessionResponding(session())` false | `sessionResponding` → `pending` / 2-2 |
| VP-212 | R-106 ↔ AT-111 / AT | REGRESSION | PASS | M5 red 2 + `ready 구간에 미확정 예약이…` 케이스. **DB `idx` oracle은 미관측**(§8) | 낙관 커밋 ↔ main 커밋 / 2-2 |
| VP-213 | R-107 ↔ AT-112·AT-113 / AT | REQUIRED | PASS | `backgroundRunRow.render.test.ts` 6케이스 · M7·A1 red | store 파생 → `Exchange` → DOM / 2-2 |
| VP-216 | R-108 ↔ AT-114 / AT | REQUIRED | PASS | `shellNoticeRow.render.test.ts` 3케이스(형제 대조 포함) · M8 red 2 | `kind` → 통지 행 라벨 / 1-1 |
| VP-219 | 0208 D-002 / AT | REGRESSION | PASS | `SparkSpinner` 소비처 재열거 — import 1 + 렌더 1, **둘 다 `StatusLine.tsx`** | `StatusLine` 소비처 / 2-2 |
| VP-220 | 0230 R-03 / AT | REGRESSION | PASS | `0230 D8 — 비대화형이 된 셸 행은 hover 틴트도 갖지 않는다` | 통지 행 · 카드 / 1-1 |

- root `PAIR_FAIL`: **VP-201**(D1) · **VP-214**(D2). 원인이 서로 다르다 — 하나는 소비자 부재, 하나는 배선 미잠금.
- 종속 `BLOCKED_BY`: **VP-218 → VP-214**.
- 하나의 증거가 함께 닫은 pair: M7(VP-213·VP-215) · M8(VP-216·VP-217) · M9(VP-204·VP-205).
- 이번 라운드 실행 범위: **최초 검증** — 유효 V의 `REQUIRED` 15 · `REGRESSION` 5 전건 + 운영 gate 5종.

### AT / AC 세부와 합계

| AT | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AT-101 | `elapsed_time_seconds`를 실으면 **그 도구 카드가 경과를 보인다** | **❌** | 카드 소비처 0. A9·A6 red가 전부 어댑터·store 단언 — 렌더 단언 0. **D1** |
| AT-102 | `retry`가 이후 `heartbeat`로 해제되지 않는다 | ✅ | `AT-102 — retry 는 이후 heartbeat…` + 렌더 `재시도 대기 중 2/5` |
| AT-103 | `summary`가 실행 줄에 한 줄로 | ✅ | `AT-103 — summary 를 흡수한다` + 렌더 `테스트를 돌리는 중` |
| AT-104 | 두 번째 `usage` 스냅샷이 더해지지 않는다 | ✅ | `durationMs:1500 · toolUses:5`(누적이면 2500·8) |
| AT-105 | 배지가 런치 영수증 관측분만 센다 | ✅ | 배지 0 / 트래커 1 |
| AT-106 | 같은 변경이 턴-후 루프를 좁히지 않는다 | ✅ | `background.count('s')` = 1 유지 · M3 red 4 |
| AT-107 | 클릭 → 타일 활성 + 선택 해제 | ✅ | `subagentTileActive()` true · `selected()` null |
| AT-108 | `ready`+잔여에서 어시스턴트 턴이 종료로 | ✅ | `sessionResponding(session())` false |
| AT-109 | 같은 상태의 전송이 정식 말풍선 | ✅ | `pendingSteer` 0 · `messages` 1 · echo 합류 후에도 1 |
| AT-110 | 스트리밍 중이면 여전히 예약 | ✅ | `pendingSteer` 1 · `messages` 0 |
| AT-111 | 낙관 커밋과 main 커밋 순서가 갈리지 않는다 | ⚠️ | **IT 미수행**. 대체 관측 — 렌더러 가드(M5 red) + main 측 `ready ⇒ held 없음`(§8) |
| AT-112 | `ready`+잔여면 마지막 턴 **아래**에 선다 | ✅ | `indexOf('시작합니다') < indexOf('백그라운드 작업 2건')` · A1 red |
| AT-113 | `streaming`이면 실행 줄 대신 스피너 — 동시 금지 | ✅ | 잔여 0 · `listening` 두 음성 대조 |
| AT-114 | 셸 통지 행이 `Agent` 대신 셸 라벨 | ✅ | `Agent &quot;` 부재 · `셸 &quot;` 존재 + 형제 양성 짝 |

- **합계 재측정**: `✅ 12 · ⚠️ 1 · ❌ 1 = 총 14`. 자기보고 `✅13 · ⚠️1` — **AT-101에서 갈린다**.
- **합계 사본 대조**: 본문 `12/14` ↔ 커밋 trailer `Criteria-Met: 13/14` ↔ INDEX 비고 `✅13 · ⚠️1` — **자기보고 3곳은 서로 일치하고 재측정과 불일치**한다.

### pair별 plan §10 강제 지점 분모 (검증자 독립 재열거)

| EP | 계약 | plan 지점 수 | 코드 재열거 | 결과 |
|---|---|---|---|---|
| EP-201 | `tool_progress` transient | 1 | `claude-map.ts:466` 1건 · 영속 차단 `writer.ts:445` | **1/1** |
| EP-202 | `usage`·`summary` 스냅샷 교체 | 2 | `claude-map.ts:130-138` 대입 · `chatStore.ts:339-348` 대입 | **2/2** |
| EP-203 | 두 세기는 다른 질문 | 2 | `post-turn.ts:106` `count` · `session-activity-projector.ts:218` `launchedCount` | **2/2** · 값이 갈린다 |
| EP-204 | 클릭은 목록 | 1 | `BackgroundRunRow.tsx:61` 1건 | **1/1** |
| EP-205 | admission ↔ 답변 표면 같은 `ready` | 2 | `sendAdmission.ts:35` · `chatStore.ts:910`. `grep shouldQueueAsPending` 프로덕션 호출부 1 | **2/2** |
| EP-206 | 실행 줄·스피너 배타 | 2 | `chatStore.ts:1809` 파생 · `Exchange.tsx:77` 렌더 | **2/2** |
| EP-207 | 라벨을 `kind` 하나가 가른다 | 1 | `SubagentNoticeRow.tsx:55-57` 1건 | **1/1** |

- **합계 재측정 `11/11`** — 자기보고와 일치.
- 표에 없는데 같은 불변식이 필요한 지점: **1건 — `TranscriptView`의 `last` 게이트**. 구현자가 만든 새 표면이라 §10이 몰랐다. 현재 pair(VP-214)의 필수 배선이므로 `NON_BLOCKING`이 아니라 D2로 귀속한다.
- §10 표의 `pair` 열이 pair 표의 `§10` 열과 **EP-203부터 어긋난다**(D6) — 계약·지점 수는 불변이라 판정에 쓰지 않았다.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 결과 | 관측 산출 |
|---|---|---|---|
| subtree unit(`./node_modules/.bin/vitest run`) | `app/**` 변경 | **PASS** | **498파일 · 4622케이스 — 4619 passed · 3 skipped · 0 failed** |
| 수집 실패 6파일 | — | **환경 기인** | `Electron failed to install correctly`(`node_modules/electron/index.js:17`). 6파일 모두 diff 미포함이고 `app/AGENTS.md §제약 환경`의 알려진 서명이다 |
| typecheck | 타입 계약 확장 | **PASS** | `node`·`web`·`test` 3구성 **0 error** |
| lint | renderer/main 신규 파일 | **PASS** | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` TanStack Virtual(기존 베이스라인) |
| build(`./node_modules/.bin/electron-vite build`) | 번들 무결성 | **PASS** | `✓ built in 6.34s` — main·preload·renderer |
| doc inventory | `docs/` 2파일 변경 | **PASS** | `generated ok (9 items, 92 channels)` · `prose ok` · `links ok` |

---

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `IPC_CONTRACT.md` `subagent.task` 행 | `elapsedSeconds?`·`heartbeat?`·`retry?` 3필드 추가 | transient·`heartbeat`는 진척 미주장·`retry`는 정착/새 attempt로만 | ✅ 코드와 일치. 단 `heartbeat`는 문서에 있고 소비처가 없다(D5) |
| `claude-taskxxx-spec.md` §4.2-a | `tool_progress` 채택 표 신설 | 부모 1순위 귀속·미귀속 드롭 | ✅ A3가 드롭 규칙을 red로 잠근다 |
| SDK `agentProgressSummaries` | `claude.ts:415` Options | `summary` producer | ✅ 이 값이 없으면 요약 자리가 영구히 빈다 |

---

## 7. 숫자 / 음성 기준 / 상한 재측정

- pair 20 재검산: `REQUIRED 15 · REGRESSION 5 = 20`. 레벨 분포 `R↔AT 12 · AR↔IT 3 · MD↔UT 4 · SD↔ST 1 = 20` — **일치**.
- `NEW`/`CHANGED` 노드 15 ↔ 같은 레벨 `REQUIRED` pair 15 — **일치**.
- §10 내역 합 `1+2+2+1+2+2+1 = 11` = 총계 11 — **일치**.
- AC 분모 14(AT-101~AT-114) — **일치**. 분자는 §5에서 갈린다.
- 음성 대조 3건(AT-106·AT-110·AT-113) 전건 실행 확인.
- 상한: `tool_progress`는 파트를 만들지 않으므로 transcript 증가분 0. 실행 줄 순회는 O(태스크).

---

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AT-111 DB `idx` 순서 | 렌더러 가드(M5 red) + main `ready ⇒ held 없음` — `decidePostTurnStep`이 `havePending`에서 `flush`거나 `channelBusy`/`hasBacklog`와 함께 `listen`이고, `syncTransport`가 그 둘에서 `ready`를 내지 않는다(`post-turn.ts:56-60`·`:135`) | 자동 턴이 끼어드는 실제 세션에서 라이브 순서 ↔ DB `idx` | Windows 실기 또는 egress 열린 CI |
| VP-218 구간 이음매 | 하위 pair가 각 구간을 직접 본다 | 턴 종료 → listen → 정착 → 자동 턴 한 실행 | 같음 |
| **VP-214 배선** | **기계 검증 가능 — 사람 실기 아님** | — | `TranscriptView.workResults.test.ts`가 이미 `renderToStaticMarkup` + virtualizer mock 하네스를 갖는다. 같은 하네스로 tail `Exchange`가 실행 줄을 세우는지 단언하면 A8이 red가 된다 |
| 실행 줄 시각 품질 | 문자열·순서·배타는 기계 검증 | 줄 간격·트렁케이트·hover 틴트 | 앱 실행 |

---

## 9. 게이트 재실행

```text
$ ./node_modules/.bin/vitest run --reporter=dot      # 498파일 4622케이스 — 4619 pass · 3 skip · 0 fail
$ npm run typecheck                                   # node·web·test 3구성 0 error
$ npm run lint                                        # 0 error · 1 warning
$ ./node_modules/.bin/electron-vite build             # ✓ built in 6.34s
$ node scripts/check-doc-inventory.mjs --check        # generated·prose·links ok
```

- **관측한 실행 산출**(exit code 아님): 위 표의 파일 수·케이스 수·error/warning 수를 그대로 적었다.
- `npm test` 미사용 — DB 동작 검증이 필요 없고 `pretest`가 ABI를 Node로 뒤집는다(`app/AGENTS.md §ABI`).
- 환경 기인 실패 분리 근거: 6파일 전부 `Electron failed to install correctly` 서명이고 `git diff --name-only 171e609..684b766`에 없다. `src/main/app/` 변경은 `post-turn.schedules.test.ts` 한 파일뿐이고 그 파일은 통과한다.
- **게이트가 작업 트리를 바꿨는가**: **아니오**. `npm run lint`(`--fix`) 실행 전후 `git status --porcelain` 모두 빈 출력.
- **검증 중 실행한 명령이 남긴 잔여물**: `app/out/`(build 산출, gitignore 대상). 추적 파일 변화 0.

---

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트/build/doc | 실행·산출 관측 | — | 5종 PASS |
| AC ↔ production path | 1:1 대조 + 18변이 | — | AT-101에서 경로 단절 발견 |
| 레이어/계약/문서 링크 | 기계 검증 | — | PASS |
| AGENTS 위생 | 해당 없음 | — | `AGENTS.md` 변경 0 |
| **AT-101이 말하는 "경과"가 무엇인가** | 두 후보 제시 | **결정** | D3 — 설계자/사용자 |
| 실행 줄 시각 품질 | 로직만 | **시각 확인** | 대기 |
| PR merge | — | **승인** | 대기 |

---

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 diff에 `AGENTS.md` 변경 **0건** — 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 구현 턴 기준으로는 일치했다. 이번 검증 결과로 `verify/RETURN_TO_PLAN` · 다음 주체 `Claude`(설계)로 갱신한다.
- 「다음 주체」 칸: 주체 하나만 담는다 — ✅.
- 대상 커밋 좌표 기입(검증자 몫): `5db40b0`·`8b6bc70`·`171e609`(설계) · `684b766`(r1 구현) — `git cat-file -t` 전건 `commit` 확인.
- 비고 5줄 이내: 구현 턴 비고는 경계선이었다. 이번 갱신본은 5줄 이내로 줄인다.
- PASS 시 archive 이동: **해당 없음**.

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Status: implemented` · `Criteria-Met` · `Criteria-Pending` · `Verified-By: pending`, `Next-Action` 없음 — `docs/git-template.md:83`의 "비기능이면 `Agent: claude`로 동일 형식" 갈래에 맞다. ✅
- trailer 파싱: `git log -1 --format='%(trailers:only=true)' 684b766` → **7키 그대로 반환**. ✅
- **값 정확성**: `Criteria-Met: 13/14`는 재측정 `12/14`와 다르다 — AT-101(D1).
- 인용 커밋 해시 실재: `5db40b0`·`8b6bc70`·`171e609`·`684b766` 전건 `commit`. ✅
- `[구현자 기입]` 7필드: 설계 리뷰 · 강제 지점 전수 · V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals — **전건 표로 존재**(산문으로 접힌 필드 0). ✅
- 이동/삭제한 reference·script: 없음.

---

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `sessionSpeaking`을 새 파생으로 만들지 않고 `sessionResponding`을 직접 부른다 | **타당** — 대체물에만 있는 실패 모드를 찾지 못했다. `sessionResponding`을 바꾸면 실행 줄도 함께 바뀌는 것이 오히려 EP-206을 강제한다 | 유지 |
| 선조치 #1 — 미귀속 최상위 도구 진행 드롭 | **타당** · 잠김(A3 red 1) | 유지 |
| 선조치 #2 — 경계 도구 자신의 진행에 `lastToolName` 미부여 | **타당** · 잠김(A4 red 1). 다만 같은 논리가 `elapsedSeconds`에는 적용되지 않아 D3의 모호함이 남았다 | D3로 이관 |
| 선조치 #5 — 요약 선택 규칙(미정착 중 최신) | **타당** · `backgroundRun.test.ts` 7케이스 | 유지 |
| 보고만 #3 — 우측 패널이 접혀 있으면 클릭이 무반응 | **타당** · 0235/별도 범위 | NEXT_HANDOFF 후보로 기록 |
| "`backgroundRun.*` 3키 전부 소비자가 있다" | **거짓** — `openHint` 소비처 0 | D4 |
| 게이트 자기보고(4619 pass·lint 1 warning·typecheck 0·build ok) | **전건 재현** | — |

---

## 13. [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | `elapsedSeconds`가 store까지 가고 멈춘다 — **카드 소비처 0**. AT-101의 "그 도구 카드가 경과를 보인다"가 화면에 도달하지 않는다 | verify r1 · **VP-201** · AC AT-101 | 어느 카드의 어느 자리에 무엇을 보일지 확정(D3) 후 렌더까지 배선하고, 그 렌더를 단언하는 케이스를 둔다. 지금은 A9(어댑터 방출 제거)·A6(store 흡수 제거)가 red여도 **렌더 단언이 0건**이다 | **BLOCKING** | open |
| D2 | transcript 배선이 잠기지 않았다 — `TranscriptView`의 `last` prop을 지우면 실행 줄이 제품에서 사라지는데 4619케이스 green | verify r1 · **VP-214** · §10 표 밖 지점 | `TranscriptView.workResults.test.ts`와 같은 하네스(`renderToStaticMarkup` + virtualizer mock)로 tail `Exchange`가 실행 줄을 세우는지 단언한다. 0230 D1과 같은 축이다 | **BLOCKING** | open |
| D3 | AT-101이 카드를 요구하는데 §11 구현 설계에 카드 파일이 없고, 부모 1순위 귀속 규칙 때문에 `elapsed_time_seconds`가 **안쪽 도구**의 경과다 — Task 카드에 그대로 걸면 거짓 라벨이 된다(선조치 #2와 같은 문제) | verify r1 · **AC AT-101 ↔ §11 모순** | 설계자가 정한다: (a) 경계 도구 자기 진행에만 `elapsedSeconds`를 싣고 카드가 그것을 보인다 · (b) 안쪽 도구 경과를 별도 자리에 보인다 · (c) AT-101을 어댑터 계약으로 좁히고 카드 문구를 뺀다 | **PLAN_GAP** | open |
| D4 | `chat.backgroundRun.openHint`(ko·en) 소비처 0 | verify r1 · 역방향 | 소비처를 만들거나 키를 지운다. 구현 보고의 "3키 전부 쓴다"도 함께 정정 | NON_BLOCKING | open |
| D5 | `subagent.task.heartbeat` 소비처 0 — 어댑터가 싣고 store가 읽지 않는다 | verify r1 · 역방향 (plan §11이 요구한 필드라 구현 위반은 아니다) | `heartbeat`가 화면에서 무엇을 바꾸는지 정하거나 필드를 뺀다. AT-102는 "부재 = 무변경"으로 이미 성립한다 | NON_BLOCKING | open |
| D6 | plan §10 표의 `pair` 열이 pair 표의 `§10` 열과 EP-203부터 어긋난다(예: EP-204가 VP-207, pair 표는 VP-208) | verify r1 · plan 내부 정합 | `pair` 열을 pair 표 기준으로 정정한다. 계약·지점 수는 불변이라 이번 판정에 쓰지 않았다 | NON_BLOCKING | open |
| D7 | 등록 변이 실패 수 자기보고가 둘 어긋난다 — M2 보고 2/재측정 3 · M3 보고 2/재측정 4 | verify r1 · 자기보고 | 방향이 "더 강함"이라 잠금에는 영향이 없다. 다음 라운드 보고에서 수치를 재측정값으로 맞춘다 | NON_BLOCKING | open |
| D8 | 실행 줄 클릭이 타일을 활성화해도 우측 패널이 접혀 있으면 사용자에게 무반응 | verify r1 · 구현자 보고 #3 | 0235(제어·수명) 또는 별도 handoff | NEXT_HANDOFF | open |

---

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **없음**(r1). 다만 **D2는 0230 D1과 같은 축**이다 — 단위는 전부 초록인데 호출부를 지워도 통과한다. plan이 VP-214에 그 축을 미리 등록했고, 구현자는 자기가 만든 게이트(`Exchange`의 `last`) **안쪽**만 변이로 심었다.
- 관련 plan 지침/AC의 존재 여부: D1은 AT-101·VP-201이 명시했고, D2는 VP-214의 선택 증거가 명시했다. **둘 다 지침이 있었고 잠금이 한 단계 얕았다.**
- 사용자 결정 변경 근거: **없음** — Decision Ledger 무변경.
- 반복된 검증 환경 한계: electron 바이너리 미설치로 6파일 수집 실패(0230과 동일 계열). VP-218·AT-111의 IT가 이 환경에서 닫히지 않는다. **단 VP-214는 이 한계와 무관하다** — 하네스가 이미 저장소에 있다.
- 현재 라운드 수: **1**.

---

## 15. 결론

- 상태: **RETURN_TO_PLAN**
- pair 결과: `REQUIRED`·`REGRESSION` **PASS 17** · root `PAIR_FAIL` **2**(VP-201·VP-214) · `BLOCKED_BY` **1**(VP-218 → VP-214)
- PLAN_GAP: **D3** — AT-101 ↔ §11 모순 + 귀속 규칙이 만든 "누구의 경과인가" 미정. 영향 pair: VP-201
- Product/UX 및 ACTIVE Decision 충족: ACTIVE 8건 중 **8건 동작 충족**. D-101은 동작은 맞고 배선이 안 잠겼다(D2)
- AC 충족: **✅ 12 · ⚠️ 1(AT-111) · ❌ 1(AT-101) = 14**. 자기보고 `13/14`와 AT-101에서 갈린다
- 현재 변경 운영 gate: **5종 전건 PASS**. 수집 실패 6파일은 electron 환경 기인이고 diff 무관
- NON_BLOCKING: D4·D5·D6·D7 / NEXT_HANDOFF: D8
- repository operation checks: trailer 파싱 7키 ✅ · 인용 해시 4건 실재 ✅ · `[구현자 기입]` 7필드 전수 ✅ · `Criteria-Met` 값만 재측정과 불일치
- 남은 사람 확인: AT-111의 DB `idx` 실기 · 실행 줄 시각 품질
- 다음 단계: **설계자**가 D3을 Delta V revision으로 정정하고(AT-101·VP-201·§11·§10 `pair` 열) `plan/READY`로 되돌린다. 그 뒤 구현자가 D1·D2를 닫는다
