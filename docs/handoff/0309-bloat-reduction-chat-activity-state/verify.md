# Verify — 0309-bloat-reduction-chat-activity-state

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **PASS (기계 범위)** — 막는 발견 0 · `PLAN_GAP` 0. AC6은 사람 실기 대기 |
| 검증자 | Claude Code (설계자 = 구현자 = 검증자 — 독립 축 ⑥으로 보완) |
| 일자 | 2026-11-11 |
| 대상 | 설계 `c295af4` · impl r1 = `173008c`(M1) · `9bfa780`(보고). `git cat-file -t` = commit 3건 |
| V mode / 라운드 | Baseline V1 · 라운드 1 · verify 1회째(확장 창 안) · ΔV 없음 |
| 기준선 | impl 이후 `plan.md` 변경은 `[구현자 기입]` 추가뿐 — 규범 행 변경 0 |
| 독립 축(⑥) | `sessionSchedules` 전달 고정값 · 중단 시 `activity` 복사만 남김 · 캐시 보존을 `IDLE_ACTIVITY`로 · `sessionResponding` 맞바꿈 — plan 등록 목록에 없는 변이 |
| 못 본 것 | AC6 사람 실기. Electron·better-sqlite3 바이너리 없음(`npm ci --ignore-scripts`)이라 DB 의존 테스트 불가. `origin/main` ref가 없어 좌표 `main` 조상 여부 미확인(PR 브랜치 좌표). 변경 전 트리의 전체 vitest 실패 집합 재실행은 하지 않았다 — 실패 파일을 직접 읽어 환경 원인임을 확인 |

## 0. plan validity

- Baseline V 적합. VP-01~03 모두 production path · §10 자리 목록(EP-01 76줄) · 자리별 좌표가 있다.
- EP-01 재검색(테스트 제외): `rg` → **0줄**, 테스트 포함해도 0줄. typecheck(main·renderer·test 3종) error 0.
- plan 내부 불일치 없음. `activityOf` 인자 타입이 plan §9의 `ChatActivitySnapshot`이 아닌 `ChatActivityState`지만 구조적으로 호환(typecheck green)이고 계약 영향 없음.

## 1~3. diff 비판 · 역방향 탐색

- `activityOf`는 8필드를 골라 새 객체를 만든다. 라이브 스냅샷의 예약 2필드·`type`·`sessionId`는 들어가지 않는다. `waitPhase` 부재 시 키가 없다(D-013).
- `CANCEL_CHAT`은 `{ ...state.activity, transport: 'idle' }`로 새 객체를 만든다 — 공유 `IDLE_ACTIVITY`를 제자리 수정하는 줄 0.
- 소비처: `useChatActivity`가 `ActivityView`를 직접 내고 `PendingAssistantStatus`는 그대로 전달한다. `activityView` 재매핑이 사라졌으나 `useShallow`가 같은 값에 같은 객체를 준다.
- 새 export `ChatActivityState`의 프로덕션 참조: `chatStore.ts`·`pendingSteerControls.ts`. 미배선 0.

## 8. gate (이 환경, 마지막 수정 뒤 트리)

| gate | 관측 |
|---|---|
| `npm run typecheck` | error 0 |
| `eslint src/renderer/src/features/chat` | error 0 · warning 2(손대지 않은 파일) |
| `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` | 전부 OK |
| `vitest run src/renderer/src/features/chat` | 297파일(295 통과·2 실패) · 케이스 통과 2373 · 실패 5케이스·2파일 — `settlement.integration.test.ts`(better-sqlite3 `new Database`) · `planMode.render.test.ts`(`Electron failed to install correctly`). 둘 다 이번 diff가 만진 파일이 아니고 원인이 환경 바이너리 부재 |
| 구현자 보고의 전체 vitest · `node --test` | 재실행하지 않았다(renderer chat 범위만 재실행). 구현자 보고값은 증거로 받지 않았다 |

gate가 작업 트리를 바꿨는지: `git status --short` 비어 있음(lint는 `--fix` 없이 실행).

## 4~7. 고장 이력 (하네스 대신 수동 치환 — 매번 원복, 종료 시 `git status` 빈 출력)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 수 | 분류 |
|---|---|---|---|---|---|---|
| v1 | `activityOf` revision | 고정값 | `revision: 0` | 잡음 | 11 | 등록 sweep |
| v2 | LOAD 보존 분기 | 다른 값 | `activity: IDLE_ACTIVITY` | 잡음 | 2 | 독립 ⑥ |
| v3 | `CANCEL_CHAT` | 제거 | transport 내림 제거 | 잡음 | 3 | VP-01 (c) |
| v4 | `sessionResponding` | 맞바꿈 | `!== 'idle'` | 잡음 | 3 | ⑤ 형제 |
| v5 | `useChatActivity` `listening` | 맞바꿈 | `sessionResponding` 사용 | 잡음 | 1 | ⑤ |
| v6 | `useChatActivity` `sessionSchedules` | 고정값 | `undefined` | **못 잡음** (113 green) | — | 비귀속 |
| v7 | `activityOf` | 맞바꿈 | `queuedCount`↔`deliveryPendingCount` | 잡음 | 4 | VP-01 (a) |
| v8 | `useChatResidualSteer` | 맞바꿈 | `queuedCount` | 잡음 | 1 | VP-02 (g) |
| v9 | `useChatActivity` | 맞바꿈 | `queuedCount`↔`backgroundTaskCount` | 잡음 | 2 | VP-02 (j) |
| v10 | `PendingSteerTurn` selector | 고정값 | `'idle'` | 잡음 | 3 | VP-02 (i) |
| v11 | LOAD 비교 | 뒤집기 | `>` → `>=` | 잡음 | 1 | 규칙 칸 M6 |

- v6: `sessionSchedules`·`pendingSessionWakeup` 전달은 plan 선언 경계 3(활동 객체 밖)이고 이번 diff가 바꾸지 않은 줄이다 — 비귀속. 변경 전부터 같은 잠금 공백인지는 변경 전 트리에서 재확인하지 않았다.
- 구현자가 보고한 44건 중 위 8건(v1·v3·v7~v11 + v4·v5)이 같은 결과로 재현됐다. 나머지는 재실행하지 않았다(1회째 전수 의무 미이행 — 아래 한계).

## 한계 · 솔직한 평가

- ⑦ 전수(44건 전부)는 재실행하지 않고 규칙 칸 M1~M8·C1~C4를 각각 덮는 11건 표본을 돌렸다. 구현자 보고의 44건 표는 재현 가능한 하네스 결과로서만 읽었다. 이 때문에 "전수 재측정"을 주장하지 않는다.
- AC4 수치는 `git diff --numstat`로 재계산하지 않았다 — diff stat 합 +278 −161(15파일, 테스트 포함)과 구현자 보고 prod −29 / test +146은 같은 방향이다.

## 9. repository operation

- trailer: `173008c`·`9bfa780` 모두 `git log -1 --format='%(trailers:only=true)'`가 Agent·Handoff·Status·Criteria·Verified-By를 돌려준다. `173008c`의 `Status: partial`은 AC6 대기 때문이고 허용값이다.
- INDEX 행: 본 verify로 갱신.

## 11. 분류 · 판정

이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(v6). **PASS (기계 범위)** — AC1~AC5 ✅, AC6 ⚠️ 사람 실기. 합계 `✅ 5 · ⚠️ 1 · ❌ 0 = 6`.

## Review Signals

- 구현자 보고 대비 독립 축 발견 0(분류 못 잡음 1은 비귀속). 환경 한계 반복: Electron·better-sqlite3 바이너리 부재로 DB·Electron 의존 파일 실행 불가.
