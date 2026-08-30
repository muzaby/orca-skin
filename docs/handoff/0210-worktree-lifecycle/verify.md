# Verify — 0210-worktree-lifecycle

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## Verify r2

## 메타

| 항목 | 값 |
|---|---|
| slug | `0210-worktree-lifecycle` |
| 검증자 | Claude Code |
| 일자 | 2026-08-30 |
| 대상 커밋/range | `74adf727..b7507197` (구현 `6111e5a3` r1 · `b7507197` r2) |
| 구현 전 plan 기준 | `74adf727` |
| V mode / 유효 V | `Delta V` / `0209-git-worktree-isolation:V1@6d8c67c6 + ΔV1` |
| 검증 기준 plan revision | `74adf727:ΔV1` |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude다** — 구현 커밋 두 개의 trailer가 `Agent: claude`. §4에 구현 보고가 이름을 대지 않은 적대 축 **6건**(M-A~M-F)을 넣었고, 그중 **5건이 green**이다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — `git diff 74adf727..b7507197 -- plan.md` = 165 insertions / 35 deletions.
- **기준선이 diff로 성립하는가**: 예. 설계 커밋 `74adf727`과 구현 커밋 `6111e5a3`·`b7507197`이 갈려 있다.
- Decision Ledger 변경: **없음** — plan diff의 변경 hunk가 전부 541행 이후(`[구현자 기입]` 이하)다.
- Product/UX Contract 변경: 없음(같은 근거).
- AC 변경: 없음 — §7의 AC1~AC21 21행이 `74adf727` 원문 그대로다.
- V node/pair·requiredness·§10·oracle 변경: 없음 — §7-A node 25행·pair 21행·§10 EP 8행이 원문 그대로다.
- 채점에 사용할 원 기준: `74adf727`의 §3 Decision Ledger(D-101~D-110) · §7 AC1~21 · §7-A WP-01~21 · §10 EP-01~EP-17.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 기준 `0209:V1@6d8c67c6` 실재(`git cat-file -t 6d8c67c6` = commit), 유효 V 재구성 가능 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | NEW/CHANGED 노드 21개 전건에 같은 레벨 REQUIRED pair 16 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | WP-09·10·11·14·15 = REGRESSION 5, `NOT_REQUIRED` 4건은 출처·비영향 근거 기재 |
| pair별 path·§10 전수·직접 oracle | 유효 | 21 pair 전건에 `start → edges → end`·EP 분모·oracle 기재 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 선택 10 pair · `not selected + 이유` 11 pair = 21 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A gate 표 4행(subtree·순수 테스트·DB·repository) |

- V 도입 전 plan인가: 아니오 — ΔV1이 이 템플릿으로 작성됐다.
- root PLAN_GAP과 영향 pair: **없음**. 이번 FAIL은 전부 plan이 이미 지정한 좌표·oracle을 구현이 만들지 않은 것이다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-101 유예 선택 | 격리 ON이면 브랜치 선택이 트리를 안 바꾼다 | `CwdPanel.tsx:50` → `BranchChip.tsx:99-104` → `chatActions.setWorktreeBaseRef` ✅ |
| D-102·D-103·D-104 경로 | `~/.config/orca/worktrees[-dev]/<repo>-<hash8>/<브랜치>` | `paths.ts:47` → `bootstrap.ts:836` → `service.ts:118`(`naming.ts:20·30`) ✅ |
| D-105 dirty 비거부 | 미커밋 변경이 있어도 격리가 생긴다 | `service.ts:83-95`에 `isClean` 게이트 부재 ✅ |
| D-106 툴팁 안내 | 미커밋 변경 미포함을 문구로 알린다 | `ko.ts:699`·`en.ts:694` → `CwdPanel.tsx:60` ✅ |
| D-107 폴백 영속 | `sessions.cwd` 갱신 + managed row 삭제 | `service.ts:193`·`:194` ✅ (DB 재조회로 확인, §5) |
| D-108 채널 teardown | 폴백이 살아 있는 채널을 내린다 | `runtime-entry.ts:88` → `:92` — **관측 없음**(D3) |
| D-109 `session.updated` 통지 | 새 wire 없이 `patch.cwd`로 알린다 | `send.ts:163-168` — **관측 없음**(D1) |
| D-110 마이그레이션 없음 | 기존 userData worktree가 공존 | 스키마 변경 0(`app/src/main/infra/db/migrations` diff 0) ✅ |

### end-to-end 흐름

```text
CwdPanel(격리 ON) → BranchChip(유예) → chatStore draft → send payload   ← D4: payload 홉 무관측
  → SendChatMessageSchema → prepareTurnExecution → WorktreeService.prepare(baseRef)
  → TurnContext.cwd → TurnRequest.cwd → adapter cwd

[resume] send.ts resolveTurnCwd → recoverMissingWorktree(stat)          ← D2: 이 입력 홉 무관측
  → updateSessionCwd + deleteManagedWorktree                            ✅ 관측됨
  → session.updated{patch.cwd}                                          ← D1: 방출 무관측
  → acquireRuntime(turn, recovered) → decideRespawn → teardownChannel    ← D3: 마지막 두 홉 무관측
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 양호 | `recoverMissingWorktree`는 `stat` 실패를 전부 부재로 접고 DB 두 쓰기를 동기 블록에 둔다(`service.ts:191-195`) |
| false success 가능성 | **있음** | `send.ts:163` 통지 삭제가 스위트 전건 초록(M-C) — 폴백이 화면에 도달했는지 아무도 안 본다 |
| partial failure/rollback | 설계대로 | ①→② 순서가 코드에 있고(`:193`→`:194`) ③은 그 뒤(`send.ts:163`). §13 판정과 일치 |
| Product/UX의 A가 아닌 다른 B | 아니오 | 유예·경로·폴백 셋 다 §5 전이표 행과 1:1 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | 폴백이 `sessions.cwd`를 실제로 옮긴다(DB 재조회 관측) |
| 최적화가 잃은 재검증 | 없음 | `pathExists`는 캐시하지 않는다(`service.ts:48-53`) |
| 출력/요청 worst-case 상한 | 증가 0 | resume 턴당 `stat` 1 · 격리 신규 턴당 `rev-parse` 1(기존 `resolveHead` 대체) |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 없음 | `gitAvailable`·`resolveBranchOid`·`repoDirSegment`·`branchDirSegment`·`updateSessionCwd`·`recoverMissingWorktree` 전건 비테스트 소비처 ≥1 |
| 테스트 전용 참조 | 없음 | 위 6개 모두 `service.ts`/`prepare-worktree.ts`가 부른다 |
| 형제 정책 비대칭 | 의도 | `isClean` 비테스트 소비처가 **1건**(`service.ts:201` 삭제 증명)으로 줄었다 — EP-11의 "준비 제거·삭제 유지"와 일치 |
| 신규 등록값의 기존 소비처 | 무영향 | `managedWorktreesDir` 비테스트 참조 2건뿐(`paths.ts:47`·`bootstrap.ts:836`), 시그니처 변경이 typecheck 3구성 0 error |
| producer ↔ consumer 파생 불일치 | **있음** | `SendChatMessage`에 `worktreeBaseRef`가 생겼는데 채널 SSOT 문서가 옛 필드 목록이다(D5) |
| 동일 규칙 중복 구현 | SSOT 유지 | 브랜치 문자셋은 `GitBranchNameSchema` 하나를 checkout·baseRef가 공유(`protocol.ts:69`) |

- `reason:'dirty'` union 제거의 소비처: 비테스트 0건 — 남은 `'dirty'` 6건은 전부 `GitCheckoutResult`(다른 타입)다.
- `<BranchChip` 렌더 지점: **1건**(`CwdPanel.tsx:47`) — EP-01의 두 지점 전제와 일치.

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 실재: `worktree-bind.test.ts`(3케이스)·`safe-delete.test.ts` 실재하고 이번 라운드에 green.
- **선택된 적대 증거 재측정** — 등록 변이 12건 중 **검출 12 · 미검출 0**. 일반 hunk 자동 확장 0.
- **이전 라운드 대조** — r1이 red로 적은 12변이가 이번에도 전부 red. `red → green` **0건**(덮개 회귀 없음).
- **자기검증 분모** — 구현자 = 검증자다. 구현 보고에 없던 축 **6건**을 만들었고 **M-A·M-B·M-C·M-D·M-E·M-F 중 5건이 green**이다(M-F는 이번 변경 밖 축까지 함께 드러낸다).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 `naming.ts:21` 해시 → `Math.random()` | worktrees | red | **red** 1/27 | WP-02·WP-20 등록 변이 |
| M2 `BranchChip.tsx:99` 유예 분기 삭제 | BranchChip.defer | red | **red** 1/3 | WP-03 등록 변이 |
| M3 `CwdPanel.tsx:50` `deferTo`→undefined | CwdPanel.isolation | red | **red** 1/8 | WP-19 등록 변이 |
| M4 `respawn-policy.ts:32` 폴백 항 삭제 | respawn-policy | red | **red** 1/8 | WP-06 등록 변이 |
| M5 `respawn-inputs.ts:63` 축 상수화 | respawn-inputs | red | **red** 1/1 | WP-18 새 oracle 민감도 |
| M6 `prepare-worktree.ts:41` recovered→passthrough | prepare-worktree | red | **red** 2/6 | WP-05·WP-16 등록 변이 |
| M7 `service.ts` dirty 거부 복원 | worktrees | red | **red** 1/27 | WP-01·WP-21 등록 변이 |
| M8 `service.ts:201` 삭제 증명이 dirty 무시 | worktrees | red | **red** 3/27 | WP-21 형제 변이 |
| M9 `service.ts:94` baseRef 무시 HEAD 사용 | worktrees | red | **red** 2/27 | WP-04·WP-13 등록 변이 |
| M10 `service.ts:118` repo↔브랜치 칸 맞바꿈 | worktrees | red | **red** 1/27 | WP-20 형제 슬롯 변이 |
| M11 `protocol.ts:135` 격리 없는 baseRef 통과 | protocol.worktree | red | **red** 1/4 | WP-04 형제 변이 |
| M12 `paths.ts:47` dev 분기 제거 | paths | red | **red** 1/18 | WP-02 등록 변이 |
| **M-A** `chatStore.ts:600` payload에서 `worktreeBaseRef` 삭제 | renderer chat 57파일 | 미실행 | **green 524/524** | **신규 축 → D4** |
| **M-B** `send.ts:145` resume 준비 입력을 `payload.cwd`로 되돌림 | chat-turn 13파일 | 미실행 | **green 85/85** | **신규 축 → D2** |
| **M-C** `send.ts:163` `session.updated` 방출 제거 | chat-turn 13파일 | 미실행 | **green 85/85** | **신규 축 → D1** |
| **M-D** `send.ts:197` `sessionMeta.cwd` 덮어쓰기 제거 | chat-turn 13파일 | 미실행 | **green 85/85** | **신규 축 → D2** |
| **M-E** `runtime-entry.ts:88` 축을 상수 `false`로 | src/main 168파일 | 미실행 | **green 1793/1793** | **신규 축 → D3** |
| **M-F** `runtime-entry.ts:92` `teardownChannel()` 삭제 | src/main 168파일 | 미실행 | **green 1793/1793** | **신규 축 → D3·D6** |

- 동작 보존 추출 라운드인가: 아니오 — 프로덕션 19파일이 동작을 바꾼다.
- 소거 변이의 잔여물 수렴: 해당 없음 — green 5건은 잔여물이 아니라 **단언 부재**다(스위트가 통째로 초록이고 진단 0).
- 형제 슬롯 맞바꿈 변이: M10(repo↔브랜치 칸) 실행, red 1건.
- `N회` 기준의 실제 관측 주체: `recoverMissingWorktree` 호출 1회는 `prepare-worktree.test.ts:71`이 인자까지 단언한다.
- 순서 기준의 관측 훅/로그: **없음** — 폴백→teardown→spawn 순서를 관측하는 훅이 코드에도 테스트에도 없다(D3).

### 자기검증 분모의 유도

- `SELF_PASS`로 올린 17 pair의 선택 증거 12 + `closed` 인용 변이 0 + 이번 라운드 새 oracle 3 = 표 상단 12행(구현자 분모).
- 검증자 추가 분모: §10 EP-01·09·11·13·14·15·16·17 **17지점 독립 재열거**(§5)에서 오라클 없는 좌표 4개를 찾아 M-A~M-F 6변이를 만들었다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| WP-20 | MD-01'·MD-06 ↔ UT-01' / UT | REQUIRED | **PASS** | `service.test.ts` 결정성·형제 칸 (M1·M10 red) | repoRoot/branch → 경로 / EP-09 2/2 |
| WP-21 | MD-03' ↔ UT-03' / UT | REQUIRED | **PASS** | `service.test.ts` + `safe-delete.test.ts` (M7·M8 red) | porcelain → 두 소비처 / EP-11 2/2 |
| WP-16 | AR-03' ↔ IT-03' / IT | REQUIRED | **PAIR_FAIL** | M6 red이나 **M-B·M-D green** — 경로 시작 홉이 무관측 | resolveTurnCwd → … / EP-16 1/2 |
| WP-17 | AR-05' ↔ IT-05' / IT | REQUIRED | **PASS** | `worktree-recover.test.ts` DB 2회 조회 4케이스 green | 폴백 → DbQueries → reopen / EP-17 2/3 |
| WP-18 | AR-08 ↔ IT-08 / IT | REQUIRED | **PASS** | `respawn-inputs.test.ts` 양방향 (M5 red) | 조립 → decideRespawn / EP-16 2/2 |
| WP-19 | AR-09 ↔ IT-09 / IT | REQUIRED | **PAIR_FAIL** | checkout 미호출 ✅(M3 red)이나 **payload 필드 반쪽이 M-A green** | CwdPanel → … → schema / EP-15 2/3 |
| WP-14 | SD-01 ↔ ST-01 / ST | REGRESSION | **PASS** | `prepare-worktree.test.ts` deferred order green | send → prepare → acquire |
| WP-15 | SD-02 ↔ ST-02 / ST | REGRESSION | **PASS** | `worktree-bind.test.ts` 3케이스 green(ABI 복구 후 실행) | create → bind → reopen |
| WP-12 | SD-06 ↔ ST-06 / ST | REQUIRED | **PAIR_FAIL** | 등록 적대 증거(teardown 제거)가 **M-F green** | 소실→폴백→teardown→스폰 / EP-16·17 |
| WP-13 | SD-07 ↔ ST-07 / ST | REQUIRED | **PASS** | `service.test.ts` 종단 OID 일치 (M9 red) | 칩 선택 → … → worktree HEAD |
| WP-01 | R-21 ↔ AT-21·21b / AT | REQUIRED | **PASS** | 준비 전후 porcelain 동일 (M7 red) | 격리 ON send → prepare / EP-11 2/2 |
| WP-02 | R-22 ↔ AT-22~22d / AT | REQUIRED | **PASS** | `paths.test.ts` 3케이스 + 세그먼트 (M1·M12 red) | bootstrap → path mapping / EP-09·13 3/3 |
| WP-03 | R-23 ↔ AT-23·23b / AT | REQUIRED | **PASS** | checkout 0회/1회 양방향 (M2 red) | onPick/onConfirm / EP-14 2/2 |
| WP-04 | R-24·R-09' ↔ AT-24·24b·09' / AT | REQUIRED | **PAIR_FAIL** | schema·service ✅(M9·M11 red)이나 **store 좌표가 M-A green** | store send → schema → prepare / EP-15 2/3 |
| WP-05 | R-25 ↔ AT-25·25b / AT | REQUIRED | **PASS** | `prepare-worktree.test.ts` recovered 갈래 (M6 red) | 삭제된 cwd → prepare → runtime |
| WP-06 | R-25 ↔ AT-25c / AT | REQUIRED | **PASS** | `respawn-policy.test.ts` 양방향 (M4 red) | 판정 규칙 / EP-16 |
| WP-07 | R-26 ↔ AT-26~26c / AT | REQUIRED | **PAIR_FAIL** | DB 두 쓰기 ✅이나 **③ 방출이 M-C green** | 폴백 → 3쓰기 / EP-17 2/3 |
| WP-08 | R-27 ↔ AT-27 / AT | REQUIRED | **PASS** | `CwdPanel.isolation.test.ts` title 키 + ko/en 본문 | ko.ts → CwdPanel / EP-01 2/2 |
| WP-09 | R-13' ↔ AT-13' / AT | REGRESSION | **PASS** | `worktree-recover.test.ts` `none` 케이스 + bind reopen | DB → resolveTurnCwd |
| WP-10 | R-02 ↔ AT-14 / AT | REGRESSION | **PASS** | `send.worktree.test.ts` 후속 send 성공 | 실패 → 다음 send |
| WP-11 | R-15 ↔ AT-15 / AT | REGRESSION | **PASS** | `safe-delete.test.ts` 전건 (M8 red) | delete → 안전 증명 / EP-11 2/2 |

- root `PAIR_FAIL`: **4개 서로 다른 root** — WP-16(D2) · WP-07(D1) · WP-12(D3) · WP-04(D4).
- 종속 `BLOCKED_BY`: WP-19는 WP-04와 **같은 root**(EP-15 좌표 1)라 별도 원인으로 세지 않는다.
- 하나의 증거가 함께 닫은 pair: `worktree-recover.test.ts` 4케이스가 WP-17 전건과 WP-09의 `none` 갈래를 함께 닫는다.
- 이번 라운드 실행 범위: **최초 검증 라운드**다 — 유효 V의 REQUIRED 16 · REGRESSION 5 전건과 §7-A gate 4종을 실행했다.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1·AC2 | dirty여도 managed · source 트리 불변 | ✅ | `service.test.ts` 준비 전후 porcelain 동일 | CwdPanel → send → prepare |
| AC3·AC4 | `orcaConfigDir()/worktrees[-dev]`, 루트 불변 | ✅ | `paths.test.ts` 3케이스 (M12 red) | bootstrap → rootDir |
| AC5·AC6 | `<repo>-<hash8>/<브랜치>` 결정성·파생 | ✅ | 저장소 2개 준비 3회의 칸 대조 (M1·M10 red) | prepare path mapping |
| AC7·AC8 | 격리 ON checkout 0회 / OFF 1회 | ✅ | `BranchChip.defer.test.ts` 양방향 (M2 red) | onPick → (유예\|checkout) |
| AC9 | 유예 브랜치가 payload로 실려 schema 통과 | ⚠️ | schema 3케이스 ✅ / **store 홉 M-A green** | store send → schema |
| AC10 | worktree HEAD == 선택 브랜치 OID | ✅ | `service.test.ts` 종단 OID (M9 red) | payload → prepare → add |
| AC11 | base OID를 준비 초기에 한 번 읽는다 | ⚠️ | 결과는 관측되나 **baseRef 갈래의 "1회" 축은 미재모사** | resolveBranchOid → add |
| AC12 | 소실 시 다음 턴 cwd = `source_cwd` | ⚠️ | 판정 ✅ / **send 조립 홉이 M-B·M-D green** | send → prepare → buildTurnContext |
| AC13 | 폴백 턴이 실제 실행, error 0회 | ⚠️ | acquire 1회 ✅ / **error 0회는 production에서 미관측** | 같은 경로 |
| AC14 | 소실 입력에서 `decideRespawn` true | ⚠️ | 정책·조립 ✅(M4·M5 red) / **호출부는 M-E green** | runtime-entry → decideRespawn |
| AC15 | `sessions.cwd` 갱신 + managed row 삭제 | ✅ | `worktree-recover.test.ts` DB 재조회 2값 | 폴백 → DbQueries |
| AC16 | 재시작 후 같은 세션이 source_cwd resume | ✅ | 같은 파일 reopen 케이스 | DB → resolveTurnCwd |
| AC17 | `session.updated{patch.cwd}` 방출 | ⚠️ | reducer 회귀 ✅ / **방출 payload는 M-C green** | main emit → chatReducer |
| AC18 | 툴팁이 미커밋 변경 미포함을 한국어로 알림 | ✅ | i18n 키 + ko/en 본문 문구 단언 | ko.ts → CwdPanel |
| AC19 | worktree 생존 시 resume이 같은 cwd | ✅ | `worktree-bind.test.ts` + `worktree-recover.test.ts` `none` | 기존 경로 |
| AC20 | 준비 실패가 그 send만 실패시킴 | ✅ | `send.worktree.test.ts` 후속 send 성공 | 기존 경로 |
| AC21 | 삭제 안전 증명 유지 | ✅ | `safe-delete.test.ts` 전건 (M8 red) | 기존 경로 |

- **합계 재측정**: `✅ 15 · ⚠️ 6 · ❌ 0 = 총 21`. 분모는 plan §7의 AC1~AC21을 직접 세어 21이다.
- **합계 사본 대조**: 자기보고 본문 `18/21` ↔ trailer `Criteria-Met: 18/21` ↔ INDEX 비고 `AC 18/21` — **세 사본은 서로 일치**하나 **재측정과 3건 갈린다**(AC9·AC13·AC14가 ⚠️로 내려감. AC15·AC16은 ⚠️→✅로 올라감).

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| WP-08·19 | EP-01 격리 상태 renderer 소비 | CwdPanel · BranchChip (2) | 2/2 — `CwdPanel.tsx:23·50`, `BranchChip.tsx:99` | PASS |
| WP-02·20 | EP-09 worktree 루트 파생 | 정의 · 부팅 호출 (2) | 2/2 — 비테스트 `rg` 2건 | PASS |
| WP-01·21 | EP-11 `isClean` 소비처 | 준비(제거) · 삭제(유지) (2) | 2/2 — 비테스트 `isClean(` 1건 = `service.ts:201` | PASS |
| WP-02 | EP-13 dev 분기 주입 | 부팅 (1) | 1/1 — `bootstrap.ts:836` | PASS |
| WP-03·19 | EP-14 트리를 바꾸는 진입 | onPick · dirty onConfirm (2) | 2/2 — `BranchChip.tsx:158`·`:188`이 같은 `checkout()`으로 | PASS |
| WP-04·13·19 | EP-15 base ref 좌표 | payload · schema · service (3) | **2/3** — payload 좌표의 적대 상태(M-A)가 무음 | **PAIR_FAIL** |
| WP-05·06·16·18 | EP-16 소실 감지 + respawn 축 | 진입 판정 · respawn 축 (2) | **1/2** — 진입 판정의 입력 출처(M-B)가 무음 | **PAIR_FAIL** |
| WP-07·12·15·17 | EP-17 폴백 3쓰기 | sessions.cwd · row 삭제 · 통지 (3) | **2/3** — 통지 좌표(M-C)가 무음 | **PAIR_FAIL** |

- 독립 재열거 합계: **17지점**(2+2+2+1+2+3+2+3) — 구현 보고와 같다. 갈리는 것은 개수가 아니라 **강제 여부**다: 17 중 **14가 적대 상태에서 red**, **3이 무음**이다.
- 표에 없는데 같은 불변식이 필요한 지점: **1건** — `send.ts:197`의 `sessionMeta.cwd` 덮어쓰기. AC12가 production에서 성립하려면 필수인데 §10 어느 행에도 없고 무관측(M-D)이다. EP-16에 귀속되는 결함으로 본다(`PLAN_GAP` 아님 — AC12가 이미 계약을 말한다).
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음(§10 원문 확인).

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| `npm run typecheck` 3구성 | `app/**` 수정 | **PASS** | node·web·test를 **각각** 실행, 세 구성 모두 진단 **0줄** |
| eslint(`--fix` 없이) | 같은 이유 | **PASS** | `0 errors, 1 warning` — warning은 `useTranscriptVirtualizer.ts:22`(변경 무관, 기존분) |
| 관련 순수 테스트 | worktree·chat-turn·composer·sessions·shared | **PASS** | **116파일 1031케이스 전건 green** |
| `src/main` 전체 | 폴백이 turn 파이프라인을 지난다 | **PASS** | **168파일 1793케이스 전건 green** |
| DB 스위트(AC15·16) | `sessions.cwd` UPDATE·row 삭제 | **PASS** | `npm rebuild better-sqlite3` 후 `worktree-recover`·`worktree-bind` **7케이스 green** |
| doc inventory | `docs/handoff/INDEX.md` 갱신 | PASS | `check-doc-inventory.mjs --check` 무출력·exit 0 |
| **IPC 채널 계약 문서** | `SendChatMessage` payload에 필드가 늘었다 | **FAIL** | `docs/IPC_CONTRACT.md:41`이 옛 필드 목록과 옛 정책 문장을 유지(D5) |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `SendChatMessage` wire | `protocol.worktree.test.ts` 4케이스(통과·거부·문자셋) | 격리 조합 강제 refine (M11 red) | 코드 PASS |
| `docs/IPC_CONTRACT.md §2.1` | — | 필드 목록·정책 문장이 코드와 불일치 | **FAIL** (D5) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `managedWorktreesDir` 비테스트 소비처: **2** (보고와 일치).
- `isClean` 비테스트 소비처: **1** — 보고의 "준비 0 + 삭제 1"과 일치(EP-11 계약대로 준비 경로 0건).
- `<BranchChip` 렌더 지점: **1**.
- `RespawnDecisionInput` 조립 지점: **5** — 팩토리 1(`respawn-inputs.ts:32`) · 팩토리 호출 2(`continuation.ts:69`·`runtime-entry.ts:81`) · 테스트 리터럴 2(`respawn-policy.test.ts:8`·`session-runtime.test.ts:1252`). r2 보고와 일치.
- §10 내역 합 = 총계: 2+2+2+1+2+3+2+3 = **17** = plan §8 검산값.
- 0건 게이트의 정당한 예외: `isClean` 준비 경로 0건은 D-105가 만든 의도된 0이다 — M7이 그 0을 복원하면 red다(정방향 확인).
- 출력/요청 상한: 새 요청 증가 0(resume `stat` 1회는 `rev-parse` 대체가 아니라 신규지만 로컬 FS 호출이다).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

> r1·r2는 AC15·AC16을 "better-sqlite3 ABI로 환경 불가"로 넘겼다. **그 판정은 성립하지 않는다** — `npm rebuild better-sqlite3` 한 번으로 두 AC가 실행됐고 green이다.

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 폴백 DB 두 쓰기 | 실제 SQLite 재조회 + 재오픈 4케이스 | 없음 | — |
| `session.updated` 방출 | 없음 | **불필요** — `send.worktree.test.ts` 하네스에 `sendChatEvent` spy가 이미 있다(D1은 사람 몫이 아니다) | — |
| teardown 순서 | 없음 | **불필요** — `acquireTurnRuntime`은 deps 주입형이라 fake runtime으로 관측 가능(D3) | — |
| 시각 확인 | 툴팁 문구·유예 라벨 문자열 단언 | 칩 배치·툴팁 렌더 모양 | 격리 ON → 브랜치 칩 선택 → 라벨/툴팁 육안 |

## 9. 게이트 재실행

- 실제 실행 명령:
  - `npx tsc --noEmit -p tsconfig.node.json --composite false` · `… tsconfig.web.json …` · `… -p tsconfig.test.json` (**각각**, `&&` 체인 아님)
  - `npx eslint ./src ./scripts` (**`--fix` 없이** — 검증자가 트리를 고치지 않기 위해)
  - `node node_modules/vitest/vitest.mjs run <suite>`
  - `node scripts/check-doc-inventory.mjs --check`
- **관측한 실행 산출**(exit code 아님): typecheck 3구성 **진단 0줄** · eslint **0 error / 1 warning** · vitest **116파일 1031케이스**(관련) 및 **168파일 1793케이스**(src/main) 전건 green · doc gate 무출력.
- `npm test`를 썼는가: **아니오**. `pretest`가 이 환경에서 무동작이라(아래) `npm rebuild better-sqlite3`로 ABI를 직접 맞추고 vitest를 직접 호출했다.
- ABI/egress 등 환경 기인 실패와 변경 관련 실패 분리: 이번 라운드에는 **환경 기인 실패 0건**이다. 최초 baseline에서 3파일 9케이스가 `NODE_MODULE_VERSION 140 vs 127`로 red였고, ABI 복구 후 전부 green이 됐다.
- **게이트가 작업 트리를 바꿨는가**: 없음 — eslint를 `--fix` 없이 돌렸고 각 변이 뒤 `git checkout --`로 되돌렸다. 최종 `git status --porcelain` 무출력.
- **검증 중 실행한 명령이 남긴 잔여물**: **있음** — `node_modules/better-sqlite3`의 네이티브 바이너리가 **Electron ABI → Node ABI**로 바뀐 채 남았다. 되돌리기를 4가지로 시도했고 전부 실패했다(D6):
  - `node scripts/ensure-sqlite-abi.mjs electron` · `npx electron-builder install-app-deps` · `npx electron-rebuild -f -w better-sqlite3`(`.forge-meta` 삭제 후 포함) · `npm rebuild better-sqlite3 --runtime=electron --target=39.8.10 …`
  - 결과: 모두 exit 0·"성공" 로그를 내지만 `require('better-sqlite3')`가 plain Node에서 계속 로드된다(= Node ABI).

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | 완료 |
| AC ↔ production path | 21행 1:1 대조 + 6신규 변이 | — | 완료(⚠️ 6) |
| 레이어/계약/문서 형식 | boundaries lint + 문서 대조 | — | 완료(D5 발견) |
| AGENTS 위생 | 이번 변경에 `AGENTS.md` 수정 없음 | — | 해당 없음 |
| 제품 의도 / Open Question | — | **결정** | 없음 |
| UI 시각 품질 | 문구·props 단언 | **시각 확인** | 칩 배치·툴팁 육안 1건 |
| 신규 의존성 / PR merge | 신규 의존성 0 확인 | **승인** | PR #413 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 해당 없음 — `git diff --stat 74adf727..b7507197`에 `AGENTS.md` 변경 0건.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: r2 시점 값은 실제와 일치했다(`impl/IMPL_DONE` · `Claude` · 자리표시자).
- 「다음 주체」 칸이 주체 하나만 담는가: 예 — `**Claude** (r2 검증)`.
- 대상 커밋 좌표 기입: **이번 턴에 검증자가 채운다** — `6111e5a3`(r1) · `b7507197`(r2), 둘 다 `git cat-file -t` = commit.
- 비고 5줄 이내: 이번 갱신분을 5줄로 다시 쓴다.
- PASS 시 archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff: docs/handoff/0210-worktree-lifecycle/` · `Status: implemented` · `Criteria-Met`/`Criteria-Pending` · `Verified-By: pending` — root `AGENTS.md` 표와 일치.
- trailer 실제 파싱: `git log -1 --format='%(trailers:only=true)' 6111e5a3`·`b7507197` 둘 다 **8키 전건 반환**.
- 인용 커밋 해시 실재: `74adf727`·`6111e5a3`·`b7507197`·`6d8c67c6` 전건 commit.
- 재구현 라운드 `[구현자 기입]` 7필드 전수: r2가 7필드를 모두 다시 채웠다(설계 리뷰·강제 지점·잠금·Product/UX·놓친 문제·구현 보고·Review Signals). 산문으로 접힌 필드 **0**.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 #1 resume 준비 입력을 `resolveTurnCwd`로 확정 | **타당하고 필수다** — 없으면 AC12가 깨진다. 다만 그 홉에 oracle이 없다 | D2 |
| 선조치 #2 `gitAvailable()`로 두 원인 분리 | 타당 — `reject-reasons.test.ts` 2케이스가 양방향을 본다 | 없음 |
| 선조치 #3 `dirty` union 제거 | 타당 — 비테스트 소비처 0건 재확인 | 없음 |
| 선조치 #4 `dirTaken` 충돌 조건 | 타당 — 브랜치가 항상 `work/<slug>` 1단이라 `branchDirSegment` 충돌이 새로 생기지 않는다 | 없음 |
| 선조치 #5 `GitBranchNameSchema` 선언 이동 | 타당 — TDZ 회피, 소비처 2곳이 같은 SSOT | 없음 |
| 보고만 #6 통지 실패 시 DB↔화면 갈림 | 타당 — §13이 이미 판정 | 없음 |
| 보고만 #7 작업 트리 잔여물이 게이트를 가림 | **이번 라운드에는 잔여물이 없다** — `git status --porcelain -uall` 무출력. r1·r2의 게이트 관측을 가리던 `a.ts`·`a.txt`가 사라져 세 typecheck 구성이 모두 실행됐다 | 없음 |
| 설계 대비 차이: `resolveRef` → `resolveBranchOid` | 타당 — 4축 표가 근거를 갖췄고, 좁힌 입력 집합이 `GitBranchNameSchema`·브랜치 칩과 일치함을 재확인했다 | 없음 |
| "AC15·16은 CI 판정 몫" | **성립하지 않는다** — `npm rebuild better-sqlite3` 한 번으로 이 환경에서 실행돼 green이다 | D6 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | 폴백 통지(`send.ts:163` `session.updated{patch.cwd}`) 방출을 아무 테스트도 보지 않는다 — 삭제해도 chat-turn 13파일 85케이스 전건 green(M-C) | EP-17 좌표 ③ · AC17 · WP-07 | **BLOCKING** | root WP-07 | 구현 — `send.worktree.test.ts`의 `sendChatEvent` spy로 recovered 턴의 방출 payload를 단언 |
| D2 | resume 준비 입력이 `payload.cwd`로 되돌아가도(M-B), `sessionMeta.cwd` 덮어쓰기를 지워도(M-D) 전건 green — AC12의 두 홉이 무관측 | EP-16 좌표 ① · AC12 · WP-16 | **BLOCKING** | root WP-16 | 구현 — `sessionMeta.cwd ≠ payload.cwd` 하네스에서 `recoverMissingWorktree` 인자와 최종 `turn.cwd`를 단언 |
| D3 | `runtime-entry.ts`의 축 전달(M-E)과 `teardownChannel()` 호출(M-F)을 지워도 `src/main` 168파일 1793케이스 전건 green | AC14 · WP-12 등록 적대 증거 | **BLOCKING** | root WP-12 | 구현 — fake runtime으로 `executionCwdRecovered:true`에서 teardown 1회를 관측 |
| D4 | `chatStore` send payload에서 `worktreeBaseRef`를 지워도 renderer chat 57파일 524케이스 전건 green(M-A) | EP-15 좌표 ① · AC9 · WP-04·WP-19 | **BLOCKING** | root WP-04 | 구현 — `chatStore.worktreeIsolation.test.ts` 방식으로 payload 필드를 단언 |
| D5 | `docs/IPC_CONTRACT.md:41`이 `worktreeBaseRef`를 빠뜨리고 "clean source HEAD에서 managed worktree를 만들고"를 유지 — D-105·D-101이 뒤집은 문장이다 | 채널 계약 SSOT gate(`docs/AGENTS.md §작성 규칙 6` · `IPC_CONTRACT.md §6-6`) · plan §18 | **BLOCKING** | 이번 변경 산출물 gate | 구현 — §2.1 행의 필드 목록과 설명 문장 갱신 |
| D6 | `scripts/ensure-sqlite-abi.mjs`의 CLI 가드가 Windows에서 항상 거짓이라 `pretest`·`predev`·`prebuild`·`postinstall`이 **무동작**이다 | 비귀속(0210 밖, 기존 결함) | **NEXT_HANDOFF** | — | 새 handoff 후보 — `import.meta.url === \`file://${process.argv[1]}\``가 `file:///C:/…` ≠ `C:\…`. 근거: 실행해도 `[sqlite-abi] …` 로그가 0줄이고 ABI가 안 바뀐다 |
| D7 | `teardownChannel()` 삭제가 respawn **여섯 축 전부**에서 무음이다 — 0210이 만든 축만의 문제가 아니다 | 비귀속(기존 축 5개는 0210 밖) | **NON_BLOCKING** | — | 기록 — `runtime-entry.ts`에 테스트 파일이 없다(`ls src/main/app/chat-turn/*.test.ts` 9건 중 부재) |
| D8 | AC11의 "base를 한 번만 읽는다"를 baseRef 갈래에서 재모사하지 않았다 | AC11 · WP-04 | **NON_BLOCKING** | — | 기록 — 코드가 단일 표현식이라 구조적으로는 1회다 |
| D9 | `docs/handoff/<NNNN-slug>/` 는 doc gate의 링크 검사 대상이 아니다(`check-doc-inventory.mjs:351`) — 깨진 상대 링크를 심어도 exit 0 | 비귀속 | **NON_BLOCKING** | — | 기록 — 의도된 제외다(같은 파일 229행 주석). 이 gate의 exit 0을 handoff 문서 링크의 증거로 읽지 않는다 |

> plan의 `[검증자 기입] 파생 이슈`로 이관한다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **예**. r2가 스스로 적은 원인("분모를 **해법 이름**으로 셌다")과 D1~D4가 같은 축이다 — §10의 좌표를 **코드에 그 줄이 있는가**로 세고 **적대 상태에서 red인가**로 세지 않았다. 17좌표 중 3좌표가 그렇게 통과했다.
- 관련 plan 지침/AC의 존재 여부: 있었다. EP-15·EP-16·EP-17이 좌표 수와 `실패 의미`를 모두 적었고, AC9·12·14·17이 검증 수단까지 적었다.
- 사용자 결정 변경 근거: 없음 — Decision Ledger 무변경.
- 반복된 검증 환경 한계: **이번 라운드에 재현되지 않았다.** 0208·0209·0210 r1이 공통으로 적은 better-sqlite3 ABI 한계가 `npm rebuild better-sqlite3` 한 번으로 풀렸고, 그 명령이 안 듣던 이유(D6)도 특정됐다.

## 15. 결론

- 상태: **FAIL**
- pair 결과: REQUIRED/REGRESSION **PASS 16 · root PAIR_FAIL 4**(WP-04·WP-07·WP-12·WP-16) **· 같은 root의 동반 실패 1**(WP-19) · `BLOCKED_BY` 0
- PLAN_GAP: **없음** — 실패한 4 root 전부가 plan이 이미 적은 좌표·oracle이다. 설계자가 고칠 규범 행이 없다.
- Product/UX 및 ACTIVE Decision 충족: D-101~D-107·D-110 충족. **D-108·D-109는 코드에 있으나 관측되지 않는다**.
- AC 충족: **✅ 15 · ⚠️ 6 · ❌ 0 / 21** (자기보고 18/21과 3건 갈림 — AC9·13·14 하향, AC15·16 상향)
- 현재 변경 운영 gate: typecheck 3구성 PASS · eslint PASS · vitest PASS · DB PASS · **IPC 채널 문서 FAIL**(D5)
- NON_BLOCKING / NEXT_HANDOFF: D7·D8·D9 기록 · D6은 새 handoff 후보
- repository operation checks: trailer 8키 파싱 확인 · 인용 해시 4건 실재 · `[구현자 기입]` 7필드 전수 · INDEX 좌표는 이번 턴에 기입
- 남은 사람 확인: 칩 배치·툴팁 시각 1건. **D1~D3을 사람 실기로 넘기지 않는다** — 셋 다 주입형 seam이 이미 있다.
- 다음 단계: **구현자가 r3에서 D1~D5를 닫는다.** 라운드 3을 넘지 않으므로 `handoff-review`는 아직 트리거되지 않는다.
