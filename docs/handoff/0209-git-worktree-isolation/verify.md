# Verify — 0209-git-worktree-isolation

> 절차 정본은 [`.agents/skills/handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md).
> 설계 기준은 [`plan.md`](plan.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0209-git-worktree-isolation` |
| 검증자 | Claude Code |
| 일자 | 2026-08-29 |
| 대상 커밋/range | `a9641813..372803ce` (r10 구현 `372803ce`) — 이전 라운드는 `ac622203..be982785` |
| 구현 전 plan 기준 | `04ab7ad` (r10에서도 규범 행 변경 없음) |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `04ab7ad:V1` |
| 라운드 | 10 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계 Claude, 구현 Codex, 검증 Claude |

> 이 문서는 라운드별로 누적한다. **아래 「라운드 10」이 현재 판정**이고, 「라운드 9」 이하는 원문 보존이며 재서술하지 않는다.

# 라운드 10 — 현재 판정 **FAIL**

r10은 `send.worktree.test.ts`로 **실제 `handleChatSend`에 진입하는 첫 oracle**을 만들었다. r9에서 green이던
배선 삭제(M-A′)와 준비 결과 폐기(M-Q′)가 이번에 red이고, `leaderTurn` 조기 대입 제거(M-S)도 red다 —
**D18·D22·D23이 닫혔고 덮개 회귀가 복구됐다.** VP-05가 다섯 라운드 만에 root에서 풀렸다.

그러나 그 oracle의 관측점은 **runtime 확보 경계에서 멈춘다.** 한 홉 뒤 `send.ts:319`의 TurnRequest 조립이
`turn.cwd` 대신 source cwd를 써도 lint 0 error · typecheck 0 · 전 스위트 2598 green이다(M-T) —
worktree는 만들어지고 Agent는 원본 checkout에서 돈다. D18이 말한 제품 실패가 좌표만 옮겨 남아 있다.

## 0. 기준선 / plan 변경 확인 (r10)

- 대상 range: `a9641813..372803ce` — 구현 커밋 1개(`372803ce`). 직전 검증 `a9641813`과 review 커밋 `f8238410` 위에 fast-forward로 얹혔다.
- 기준선이 diff로 성립하는가: **예**. `git diff a9641813..372803ce -- plan.md`의 hunk 2개가 `§19` 뒤 `### r10` 절 10줄과 `[검증자 기입]` 표의 D18·D22·D23 상태 칸이다.
- Decision Ledger·Product/UX·AC·V node/pair·§10·oracle 변경: **없음**. 위 두 hunk 밖의 plan 변경이 0줄이다.
- 채점 기준: r3~r9와 같은 `04ab7ad:V1` — §3 Decision · §7 AC1~AC20 · §7-A pair 17 · §10 EP-01~EP-12.
- plan validity: r3 판정 유지. 규범 행 무변경이므로 재감사 대상이 없다. root `PLAN_GAP` **없음**.
- `[구현자 기입]` 7필드: **7/7**. `### r10` 절이 일곱 필드를 이름 그대로 갖는다(기계 추출).
- **선행 `handoff-review`(review round 24, `f8238410`)를 수행한 뒤의 첫 라운드**다. 그 review가 신설한 `잠금 표 분모 검산`을 r10이 처음 적용했다 — `선택 증거 1 · 인용 변이 1 · 신규 oracle 1 = 표 행 3`.

## 1. ACTIVE Decision — r9 대비 변화만

| Decision | r9 | r10 | 관측 |
|---|---|---|---|
| AC6 축(실행 구조 불변) | ❌ | ✅ | `send.ts:194`가 `startNew/startResume` 직후 `leaderTurn`을 공개한다. 되돌리면 red 2(M-S) |
| D-011 이번 호출 산출물만 rollback | ⚠️ | ⚠️ | 변화 없음. add 실패 경로 잠금 유지(M-R1·M-R2, r9 좌표), DB insert 경로 빈 bucket 잔존(D21) |
| D-001 Agent/Runtime은 worktree를 모른다 | ✅ | ✅ | `rg -in worktree app/src/main/adapters app/src/main/features/sessions` 차집합 1줄(주석) |

- 나머지 D-002~D-010·D-012~D-015는 r4·r5 판정 그대로다.

## 2. 구현 결과 비판적 검토 (r10 변경분)

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 oracle이 production handler에 진입하는가 | **예** | `handleChatSend`를 직접 부르고 `buildTurnContext`·`acquireTurnRuntime`을 module mock으로 **관측**한다 — 동명 로컬 재구현이 아니라 send.ts가 그 자리에 넣는 값을 단언한다 |
| 그 oracle이 어디까지 보는가 | **runtime 확보 경계까지** | 마지막 단언이 `acquireTurnRuntime` 호출 인자다. 그 뒤의 `TurnRequest` 조립(`send.ts:319`)은 두 케이스 모두 도달하지 않는다(1번은 `entry.ok:false`, 2번은 reject) |
| false success 가능성 | **있다, 좌표가 옮겨졌다** | `cwd: turn.cwd` → `payload.cwd`로 바꿔도 전 스위트 2598 green(M-T). `extraDirs: turn.extraDirs`도 같은 줄 아래 같은 홉이다 |
| D22 수정이 새 문제를 만드는가 | 아니다 | `leaderTurn`이 두 곳에서 대입되지만 같은 객체이고 `supervisor.release`는 멱등이다(`released.has(turn)`). 실패 경로 release 1회를 테스트가 단언한다 |
| 형제 축이 함께 닫혔는가 | **아니다** | `leaderRuntime`은 여전히 `await` 뒤(`send.ts:221`)에만 대입된다 — acquire가 throw하면 생성된 runtime 핸들이 닫히지 않는다(§13 D25). r5(`ac622203:213`)에도 같았던 선재 결함이다 |
| 잃은 것 | 없음 | 단계 주석 `── 6.`·`── 7.`과 `0188 D-019` 근거가 복원됐다(`send.ts:154·161·183`) |

## 3. 역방향 탐색 (r10)

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh a9641813..372803ce   # 1 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export · test-only symbol · 형제 파일 비대칭 | 전부 0건 | 스크립트 1a·1b·2·3 모두 빈 목록 |
| `send.ts` 안의 형제 홉 비대칭 | **있다** | 같은 파일에서 `cwd`가 두 번 흐른다 — `payload.cwd`(167, 잠김) ↔ `turn.cwd`(319, 잠금 0). 스크립트는 파일 단위라 놓친다 |
| `leaderTurn` ↔ `leaderRuntime` 형제 축 | **있다** | 하나는 등록 직후(194), 다른 하나는 `await` 뒤(221)에만 대입된다(§13 D25) |
| `send.ts`를 보는 단언 | **1건** | `send.worktree.test.ts`. r9의 0건에서 회복 |

## 4. 등록 적대 증거 / 소거 변이 재측정 (검증자 실행)

모두 이번 라운드에 직접 실행했다. 각 변이는 잔여물을 치워 **lint 0 error · typecheck 0 error**가 된 상태에서 판정했다.

| 변이 | 범위 | **r9** | **r10** | 귀속 |
|---|---|---|---|---|
| M-A′ 격리 배선 전체 삭제(`prepareTurnExecution` 호출·import 제거 + 직접 조립 복원 + 미사용 import 정리) | typecheck · lint · 전 스위트 | green 2595 | **red 1** | VP-05 등록 변이 — **덮개 회귀 복구** |
| M-Q′ `send.ts`의 `buildTurn` 콜백이 준비된 `executionCwd` 대신 source cwd를 쓴다 | 전 스위트 | green 2595 | **red 1** | D18 인용 변이 — 닫힘 |
| M-S D22 수정 되돌림(콜백 안 `leaderTurn` 조기 대입 제거) | 전 스위트 | 미실행(신규) | **red 2** | D22 잠금 — new·resume 두 경로 각각 |
| **M-T TurnRequest 조립이 `turn.cwd` 대신 source cwd**(`send.ts:319`) | typecheck 0 · lint 0 error · 전 스위트 | 미실행(신규) | **green 2598** | **VP-11 · AC5 · EP-08 마지막 좌표 — 잠금 0** |
| M-L′ 등록 변이 "repo name을 path에 쓴다"(+프롬프트 slug) | 전 스위트 | green 2595 | **green 2598** | VP-14 등록 변이 미검출 — r4·r5·r9와 동일 |
| M-F `base: baseOid` → `'HEAD'` | 전 스위트 | green 2595 | **green 2598** | AC9 미검출 — r3~r9와 동일 |
| M-R1 D1 canonical candidate 되돌림 · M-R2 빈 bucket `rmdir` 제거 | worktrees | red 1 · red 1 | 미재실행 | `service.ts`·`service.test.ts`가 이 range에 없다. 「라운드 9」 §4 좌표 승계 |
| M-O queue 우회 · M-I 칩 삭제 | — | green | 미재실행 | 해당 production/테스트 파일이 이 range에 없다. 「라운드 5」 §4 좌표 승계(둘 다 green) |

- **이전 라운드 대조**: r9에 red였다가 이번에 green인 변이 **0건**(덮개 회귀 없음). 반대로 green → red가 **2건**(M-A′·M-Q′)이다.
- 소거 변이 잔여물 수렴: M-A′는 `makeClassifiedError`·`prepareTurnExecution` 미사용 import까지 치운 상태에서 **lint 0 error · typecheck 0**이고 red다 — 잔여물에 걸린 red가 아니다.
- M-T 잔여물: 없음(`payload`·`ctx`·`boundProjectId` 모두 그 스코프에서 이미 쓰인다). typecheck 0 · lint 0 error 상태의 green이다.
- 구조적 proxy 엄격화: `rg -n "createWorktree|addWorktree|removeWorktree" adapters sessions` 0줄을 `rg -in "worktree"`로 넓혀 재측정 → 차집합 **1줄**(`adapters/hooks.ts:8` 주석). 0건은 전수다.
- **VP-09 등록 변이의 장치 부재 확인**: pair가 등록한 "raw command를 feature에 심으면 architecture sweep red"를 강제하는 장치가 저장소에 없다. `rg -n "runGit" src/main/features --glob '!*.test.ts'` = **0줄**은 현재 사실이지만, 그것을 지키는 테스트는 `infra/net/no-node-fetch.test.ts` 같은 형태로 존재하지 않는다(§13 D26).

## 5. V-pair closeout (r10) — `UT → IT → ST → AT`

| Pair | 레벨 | req. | r9 | **r10** | 근거 |
|---|---|---|---|---|---|
| VP-17 | UT | REQUIRED | PASS | **PASS** | 변경 무관. 이번 전 스위트 실행 전건 green |
| VP-16 | UT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — managed/external 분류기 없음 |
| VP-15 | UT | REQUIRED | PASS | **PASS** | 변경 무관 |
| VP-14 | UT | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | M-L′ green — repo 이름·프롬프트가 경로 세그먼트가 돼도 침묵 |
| VP-13 | IT | REQUIRED | PASS | **PASS** | 변경 무관 |
| VP-12 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 「라운드 5」 M-O green 승계 |
| VP-11 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL**(root) | 오라클이 요구한 `최종 query cwd`가 미관측 — M-T green. buildTurnContext·runtime 경계까지는 잠겼다 |
| VP-10 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — EP-06 3번째 지점 없음 |
| VP-09 | IT | REQUIRED | BLOCKED_BY:VP-05 | **PAIR_FAIL** | VP-05가 풀려 독립 판정했다 — payload→schema→service→runner 통합 테스트 부재, 등록 변이의 장치도 없다(§4) |
| VP-08 | ST | REGRESSION | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 짝인 양성 resume 관측 0 |
| VP-07 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 4상태 중 2 |
| VP-06 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — reopen/resume 관측 0 |
| VP-05 | ST | REQUIRED | PAIR_FAIL(root) | **PASS** | production path `chat:send → prepare → buildTurnContext → runtime`을 실제로 지나고, 직접 oracle(deferred order log)과 등록 변이(M-A′ red)를 모두 만족한다. EP-03 2/2 잠김 |
| VP-04 | AT | REGRESSION | PASS | **PASS** | 변경 무관 |
| VP-03 | AT | REQUIRED | BLOCKED_BY:VP-07 | **BLOCKED_BY:VP-07** | handler 경로·결과 union 관측 0 |
| VP-02 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | ENOENT/non-repo fixture 없음. 오류 분류 `schema_validation_error` 그대로 |
| VP-01 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 「라운드 5」 M-I green 승계 |

- root `PAIR_FAIL`: **VP-11**(신규 root) · **VP-14**. VP-05는 다섯 라운드 만에 root에서 풀렸다.
- 종속 `BLOCKED_BY`: VP-03 → VP-07. VP-09는 VP-05 해제로 독립 판정했다.
- 합계: **PASS 5 · PAIR_FAIL 11 · BLOCKED_BY 1 = 17** (r9: 4 · 11 · 2).
- **VP-05 PASS의 범위를 좁혀 적는다**: 닫은 것은 pair가 등록한 oracle과 변이다. AC4가 별도로 요구하는 "add/DB insert/abort 각 실패 주입 후 runtime 0회"는 여전히 관측 0이며 §13 D27로 남긴다 — pair를 통과시키되 그 사실을 지우지 않는다.
- 구현자 자기보고 `SELF_PASS 6`(VP-04·05·11·13·15·17) 대조: **5/6 성립**, **VP-11 미성립**.
- 실행 범위: root 실패 pair(VP-11·VP-14)·이번 변경이 닿은 pair(VP-05·VP-09·VP-11)와 §15 gate 전건을 실행했다. 등록 변이가 싼 VP-14·AC9도 재실행했다. 변경이 닿지 않은 VP-01·VP-12·D1·D12는 「라운드 5」·「라운드 9」 좌표를 참조한다.

### AC 재측정

| AC | r9 | **r10** | 이번 라운드 관측 |
|---|---|---|---|
| AC3 | ⚠️ | ✅ | 실제 `handleChatSend`에서 준비 resolve 전 `buildTurnContext`·`acquireTurnRuntime` 0회, resolve 후 각 1회. M-A′ red |
| AC5 | ⚠️ | ⚠️ | 정적 0건 유지. AC5가 명시한 `TurnRequest cwd 직접 단언`은 여전히 없다 — M-T green |
| AC6 | ❌ | ✅ | 등록↔반납 짝 복구, M-S red 2. 단계·근거 주석 3개 복원 |
| AC18 | ⚠️ | ✅ | AC18의 오라클(`buildTurnContext 입력에서 cwd changed / extraDirs identical`)을 그 지점에서 직접 단언한다. M-Q′ red |
| AC4 | ⚠️ | ⚠️ | rollback 대상은 잠겼으나(M-R1·M-R2 승계) 실패 주입 후 runtime 0회는 관측 0(§13 D27) |

- 나머지 AC1·2·7·8·9·10·11·12·13·14·15·16·17·19·20은 r9 판정 그대로다.
- **합계 재측정**: **✅ 12 · ⚠️ 8 · ❌ 0 = 20**.
  ✅ = AC1·2·3·6·7·8·11·12·16·17·18·19 / ⚠️ = AC4·5·9·10·13·14·15·20 / ❌ = 없음.
- **자기보고 대조**: plan §19 r10 `✅13 · ⚠️7 · ❌0` ↔ 커밋 trailer `Criteria-Met: 13/20` · `Criteria-Pending: AC4, AC9, AC10, AC13, AC14, AC15, AC20`(7항목, 13+7=20) ↔ INDEX 비고(AC 수치 없음). 자기보고 둘은 일치하고 **재측정과 1행 불일치**(AC5를 ✅로 셌다). r9의 4행에서 좁혀졌다.

### §10 강제 지점 재열거

| EP | 지점 수 | 잠금 | 근거 |
|---|---|---|---|
| EP-03 준비 순서 2곳 | 2/2 | **성립** | `send.ts:141` + `prepare-worktree.ts`. M-A′ red |
| EP-08 cwd 종단 4좌표 | 4/4 | **부분** | 1~3(`prepared.executionCwd` → `buildTurn` → `payload.cwd`, `send.ts:167`)은 M-Q′ red로 잠겼다. 4번째(`TurnRequest.cwd`, `send.ts:319` → `claude.ts:264`)는 M-T green |
| EP-09 path SSOT 2곳 | 2/2 | 부분 | 저장소 밖 배치 red(M-L, r9 승계) · 문자열 identity green(M-L′) |
| EP-01·02·04·05·06·07·10·11·12 | 변화 없음 | — | 「라운드 4」·「라운드 5」 재열거 승계 |

- 재열거 합계 **10군 일치 · 2군 부분**(EP-06 2/3 · EP-11 2/3). **잠금 0인 군은 0개**다 — r9의 EP-03·EP-08 둘에서 해소됐고, EP-08은 부분 잠금으로 올라왔다.
- 구현자 자기보고 "EP-03 2/2와 EP-08 4/4를 실제 `handleChatSend` 진입 테스트가 지난다"는 **지점 수 성립**, **EP-08 4번째 좌표는 그 테스트가 지나지 않는다**.

### 현재 변경의 운영 gate (plan §15)

| Gate | 결과 | 관측한 실행 산출 |
|---|---|---|
| 1 `npm run typecheck` | PASS | exit 0 · `error TS` 0줄 · node·web·test 3구성 |
| 2 `npm run lint` + 트리 확인 | PASS | 0 error · warning 1(기존 `useTranscriptVirtualizer`) · 실행 후 `git status --short` 빈 출력 |
| 3 관련 순수 suite | PASS | `vitest run src/main/app/chat-turn` 포함, 아래 전 스위트에 포함 |
| 4 DB suite | PASS(조건부) | 전 스위트 **260/261 파일 · 2598/2598 케이스** |
| 5 `check-migrations-appendonly.mjs` | PASS | `sync ok: 18 migrations` · `no-copies ok: 813 files` · `append-only ok since v0.3.1` |
| 6 `check-doc-inventory.mjs --check` | PASS | `generated doc ok (9 items, 79 channels)` · prose ok · links ok |
| 7 `git diff --check` | PASS | 출력 0줄 |
| 8 architecture sweep | PASS | 0줄, 엄격화 후 차집합 1줄(주석) |
| 9 dependency sweep | PASS | `git diff 04ab7ad..372803ce -- app/package*.json` 0줄 |
| 10 Windows 사람 실기 | 미수행 | 이 환경에 Electron 바이너리·Windows 없음 |
| (추가) `node --test scripts/*.test.mjs` | PASS | 59/59 |

- 환경 기인 실패 분리: **1파일 0건 수집** — `app/chat-turn.continuity.test.ts`가 `Electron failed to install correctly`. r1부터 동일한 알려진 서명이다. **M-T를 잡을 수 있었을 유일한 후보 스위트**이기도 하다.
- 게이트가 작업 트리를 바꿨는가: **없음**. `lint --fix` 실행 후 `git status --short` 빈 출력.
- 검증 중 실행한 명령의 잔여물: `app/node_modules`(`.gitignore` 대상)뿐. 변이는 전부 원본 사본으로 복원했다.
- **구현자가 게이트 산출을 보고하지 않았다** — `### r10` 구현 보고와 INDEX 비고 어디에도 테스트 파일/케이스 수·error 수가 없다. 거짓 주장은 없지만 impl §7이 요구한 관측값도 없다(§13 D28).

## 6. 외부 포트 / 문서 계약

| 계약 | r10 변화 | 결과 |
|---|---|---|
| `prepareTurnExecution` | 변화 없음 | 형상 성립. 제네릭이라 어떤 콜백을 넣었는지는 타입이 잠그지 않는다 — 이제 `send.worktree.test.ts`가 그 자리를 본다 |
| `orca:chat:send.worktreeIsolation` | 변화 없음 | PASS |
| `orca:session:delete` → `DeleteSessionResult` | 변화 없음 | 부분(D13 그대로) |
| `0018_managed_worktrees` | 변화 없음 | PASS |

## 7. 숫자 / 상한 재측정

- 케이스 수: 2595 → **2598**(+3). 파일 260 → **261**(+1, `send.worktree.test.ts`).
- `send.worktree.test.ts`: `it` 1 + `it.each` 2 = **3케이스**. 자기보고 "대상 3케이스"와 일치.
- `send.ts`를 보는 단언: 0건 → **1파일 3케이스**.
- `send.ts` 길이 419줄. `cwd`가 흐르는 지점 3곳(`144` source · `167` managed · `319` TurnRequest) 중 잠긴 곳 **2**.
- 상한 재계산: naming 충돌 루프 `naming.ts:40` 상한 9999회 × Git read 2회 — r3~r9와 같다(D9).

## 8. 남은 사람 실기

r3~r9 판정 유지 — **AC20의 Windows Electron 배치·포커스 시각 확인 하나뿐**이다. M-T가 드러낸 마지막 홉도 이 환경에서 관측 가능하다 — `send.worktree.test.ts`의 harness가 `acquireTurnRuntime`을 `{ok:true, runtime, extensions}`로 돌려주면 그 뒤 TurnRequest 조립까지 진행한다.

## 9. 게이트 재실행

실행 명령과 관측 산출은 §5 「현재 변경의 운영 gate」 표에 있다. 요약: typecheck exit 0 · error 0 · lint 0 error · vitest 260/261파일 2598케이스 · scripts 59/59 · 문서·마이그레이션·diff gate green.

## 10. 검증 책임 분리 — 사람 vs 에이전트

r3~r9의 분담과 같다. 이번 라운드에 새로 사람에게 넘긴 항목은 없다.

## 11. Repository operation checks (r10)

- `AGENTS.md` 변경 없음(이번 range 기준) — 위생 검사 대상 아님. 선행 review 커밋 `f8238410`의 지침 변경은 그 커밋의 Tier 1 회귀 기록이 갖는다.
- INDEX: 단계 `impl`·상태 `IMPL_DONE (V1 r10)`·다음 주체 `Claude (r10 검증)`가 실제 상태와 맞았다. 비고 4줄(≤5). **대상 커밋 좌표는 이번 검증에서 `372803ce`로 기입**했다(`git cat-file -t` = commit).
- trailer 허용값·파싱: ✅ `git log -1 --format='%(trailers:only=true)' 372803ce`가 6키를 그대로 돌려준다. `Criteria-Met 13` + `Criteria-Pending` 7항목 = 20으로 분모가 맞는다.
- 커밋 언어: 제목·본문 한국어, `<type>(<scope>)` 형식 준수.
- 인용 해시 실재: `372803ce`·`be982785`·`a9641813`·`f8238410` 전부 commit.
- plan 절 소유: `### r10`이 `§19` 아래에 붙었다. `### r4` 절은 여전히 `## [검증자 기입]` 안이다(D16 그대로).
- 구현자가 `[검증자 기입]` 표의 D18·D22·D23 상태 칸을 직접 고쳤다. 재측정 결과 **셋 다 유지**한다.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 대조

| 구현자 r10 기술 | 검증자 판단 | 근거 |
|---|---|---|
| "`send.worktree.test.ts`가 실제 handler의 production callback을 통과해 managed cwd·extraDirs를 runtime 경계에서 관측한다" | **성립** | M-A′·M-Q′ red. `runtime 경계에서`라고 스스로 범위를 적었다 |
| "EP-03 2/2와 EP-08 4/4를 실제 `handleChatSend` 진입 테스트가 지난다" | **EP-03 성립 · EP-08 부분** | 4번째 좌표(`send.ts:319`)를 그 테스트가 지나지 않는다 — M-T green |
| "startNew/startResume 직후 `leaderTurn`을 공개해 acquire reject 두 경로에서 release 1회를 관측했다" | **성립** | M-S red 2(new·resume) |
| "6·7단계와 0188 D-019 주석을 복원했다" | **성립** | `send.ts:154·161·183` |
| "선택 증거 M-A′ 1 · 인용 변이 M-Q′ 1 · 신규 D22 oracle 1 = 표 행 3" | **성립** | 세 갈래 모두 재현했고 셋 다 red다. 분모 검산 규칙의 첫 적용이다 |
| "VP-04·05·11·13·15·17 `SELF_PASS`" | **5/6 성립** | VP-11 미성립 |
| "AC 자기보고 ✅13 · ⚠️7 · ❌0" | **1행 불일치** | 재측정 ✅12 · ⚠️8 · ❌0 (AC5) |
| 게이트 산출 | **미보고** | `### r10`·INDEX 어디에도 파일/케이스/error 수가 없다(§13 D28) |

## 13. Finding disposition / 파생 이슈 (r10)

r9 이슈의 상태 변화와 신규만 적는다. 표 정본은 [`plan.md`](plan.md) `[검증자 기입] 파생 이슈`다.

| # | 상태 | 근거 |
|---|---|---|
| D18 | **closed** | 인용 변이 M-Q′ red + 배선 삭제 M-A′ red. 덮개 회귀 복구 |
| D22 | **closed** | M-S red 2(new·resume 각 1회 release) |
| D23 | **closed** | 주석 3개 복원(`send.ts:154·161·183`) |
| D1·D12·D17·D19·D20 | closed 유지 | 이번 range가 닿지 않았다 |
| D5·D9·D11·D13·D14·D21 | open | 변화 없음 |
| D6·D10 | open (NEXT_HANDOFF) | 변화 없음 |
| D8·D16 | open (기록) | 변화 없음 |
| D24 | **신규 BLOCKING** | TurnRequest 조립(`send.ts:319`)이 `turn.cwd` 대신 source cwd를 써도 lint 0 · typecheck 0 · 전 스위트 2598 green — worktree는 만들어지고 Agent는 원본 checkout에서 돈다. EP-08 4번째 좌표 · VP-11 · AC5 |
| D25 | **신규 NON_BLOCKING** | `leaderRuntime`이 `await` 뒤(`send.ts:221`)에만 대입돼 acquire가 throw하면 생성된 runtime 핸들이 닫히지 않는다 — D22의 형제 축이고 `ac622203:213`에도 같았던 선재 결함이다 |
| D26 | **신규 NON_BLOCKING** | VP-09 등록 변이("raw command를 feature에 심으면 sweep red")를 강제하는 장치가 없다. `rg -n "runGit" src/main/features` = 0줄은 사실이나 그것을 지키는 테스트가 없다 |
| D27 | **신규 NON_BLOCKING** | AC4의 "add/DB insert/abort 각 실패 주입 후 runtime 0회"가 관측 0이다 — VP-05는 자기 oracle로 통과했으나 이 행은 열려 있다 |
| D28 | **신규 기록** | `### r10` 구현 보고와 INDEX 비고에 게이트 산출(파일/케이스/error 수)이 없다 — 거짓 주장은 없으나 impl §7이 요구한 관측값도 없다 |

- `PLAN_GAP`: **없음**. BLOCKING 1건과 pair 미달 11건은 전부 plan이 이미 지정한 계약·oracle을 구현이 만들지 않은 것이다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다, 좌표가 한 홉 옮겨졌다.** D18은 `send.ts`의 `buildTurn` 입력에서 닫혔고, 같은 제품 실패가 같은 파일 `319`행의 TurnRequest 조립에서 그대로 성립한다(D24). r5→r9→r10 세 라운드가 같은 불변식("격리한 cwd가 Agent까지 간다")의 서로 다른 지점을 순서대로 열었다.
- 관련 plan 지침/AC의 존재: **있었다.** AC5가 `TurnRequest cwd 직접 단언`을, VP-11이 `최종 query cwd`를 명시한다. 열 라운드 동안 그 좌표를 본 단언이 0이다.
- 덮개 회귀: **0건.** r9에 red였다가 green이 된 변이가 없다 — 선행 review가 신설한 `이전 라운드 대조`의 첫 적용이다.
- 새 규칙의 첫 적용: `잠금 표 분모 검산`을 구현자가 수행했고(`선택 증거 1 · 인용 변이 1 · 신규 oracle 1 = 표 행 3`) 세 행 모두 재현에서 red였다 — 자기보고와 재측정이 이 축에서 처음 일치했다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)이 r1부터 동일하다. 다만 **M-T는 그 스위트 없이도 잡을 수 있다** — 이번 harness가 `acquireTurnRuntime`을 성공으로 돌려주면 TurnRequest 조립까지 진행한다.
- 라운드 수: **10**. r10 앞에 `handoff-review` round 24를 수행했고(`f8238410`), 그 라운드가 신설한 두 규칙이 이번 라운드에 실제로 발동했다.

## 15. 결론 (r10)

- 상태: **FAIL**
- pair: PASS 5(VP-04·05·13·15·17) · root PAIR_FAIL 2(VP-11·VP-14) · PAIR_FAIL 9 · BLOCKED_BY 1
- PLAN_GAP: 없음 — 다음 주체는 **구현자**
- ACTIVE Decision: AC6 축 충족으로 복귀. D-011 부분 충족 유지
- AC: **✅12 · ⚠️8 · ❌0 = 20** (자기보고 `13/20`과 1행 불일치 — AC5)
- 강제 지점: 10군 일치 · 2군 부분. **잠금 0인 군 0개**(r9의 EP-03·EP-08 둘에서 해소). EP-08은 4좌표 중 3 잠김
- 운영 gate: 10건 중 **9 PASS · 1 미수행(Windows 사람 실기)**. 환경 기인 red 1파일은 변경 무관
- 닫힘: **D18·D22·D23** / BLOCKING: **D24** / NON_BLOCKING: D5·D9·D11·D12(부분)·D13·D14·D21·D25·D26·D27 / NEXT_HANDOFF: D6·D10 / 기록: D8·D16·D28
- 남은 사람 확인: AC20의 Windows Electron 배치·포커스 하나
- 다음 단계: 라운드 11이다. 구현자는 (1) 같은 harness를 `acquireTurnRuntime` 성공으로 이어 **TurnRequest의 `cwd`·`extraDirs`를 단언**해 D24를 닫고(M-T가 red여야 한다), (2) `leaderRuntime`을 `leaderTurn`과 같은 축으로 맞추고(D25), (3) VP-14의 UUID identity 축(M-L′)과 VP-12의 queue 진입 배선(M-O), VP-01의 칩 관측(M-I)을 잠그고, (4) 게이트 산출을 관측값으로 적는다(D28)


# 라운드 9 — 원문 보존

r6~r9는 게이트를 되살렸다 — `npm run typecheck`가 exit 0이고 D17·D19·D20이 닫혔다. 그러나 D18을
닫았다는 oracle 교체가 **덮개를 줄였다**: r5의 소스 텍스트 단언이 사라지고 그 자리에 자기 fake를
넣는 seam 테스트가 왔다. `send.ts`를 보는 단언이 0이 되어 **격리 배선을 통째로 지워도**(M-A′)
**준비 결과만 버려도**(M-Q′) lint 0 error · typecheck 0 error · 전 스위트 2595 green이다. r5에서
red였던 M-A가 이번에 green으로 돌아갔다. 추가로 r6 재배치가 `leaderTurn` 대입을 runtime 확보
뒤로 옮겨 실패 경로의 supervisor 반납이 사라졌다(§13 D22).

## 0. 기준선 / plan 변경 확인 (r9)

- 대상 range: `ac622203..be982785` — 구현 커밋 4개(`ab5a05b3` r6 · `a26b35a8` r7 · `38dd60df` r8 · `be982785` r9). 직전 검증 커밋 `ac622203` 위에 fast-forward로 얹혔다.
- 기준선이 diff로 성립하는가: **예**. `git diff ac622203..be982785 -- plan.md`의 hunk 2개가 `§19` 뒤 `### r6`~`### r9` 40줄과 `[검증자 기입]` 표의 D17~D20 상태 칸이다.
- Decision Ledger·Product/UX·AC·V node/pair·§10·oracle 변경: **없음**. 위 두 hunk 밖의 plan 변경이 0줄이다.
- 채점 기준: r3~r5와 같은 `04ab7ad:V1` — §3 Decision · §7 AC1~AC20 · §7-A pair 17 · §10 EP-01~EP-12.
- plan validity: r3 판정 유지(「라운드 3」 「Plan validity」). 규범 행 무변경이므로 재감사 대상이 없다. root `PLAN_GAP` **없음**.
- `[구현자 기입]` 7필드: **7/7 × 4라운드**. r6·r7·r8·r9 각 절이 `설계 리뷰`·`강제 지점 전수와 V-pair 자기확인`·`이번 라운드 수정의 잠금`·`Product/UX 파생 검토`·`놓친 잠재 문제 + 대응`·`구현 보고`·`Review Signals`를 이름 그대로 갖는다 — **D19 해소**.
- 라운드 번호: 보드가 r9다. r7·r8·r9는 외부 CI/사용자 보고를 입력으로 받은 라운드이고 그 사이 verify 턴은 없었다(`docs/handoff/AGENTS.md §외부 리뷰는 verify를 대체하지 않는다`).

## 1. ACTIVE Decision — r5 대비 변화만

| Decision | r5 | r9 | 관측 |
|---|---|---|---|
| D-011 이번 호출 산출물만 rollback | ⚠️ | ⚠️ | 변화 없음. add 실패 경로 잠금 유지(M-R1·M-R2 red), DB insert 경로 빈 bucket 잔존(D21) |
| D-001 Agent/Runtime은 worktree를 모른다 | ✅ | ✅ | `rg -in worktree app/src/main/adapters app/src/main/features/sessions` 차집합 1줄(주석) |
| — 신규 관측 | — | ⚠️ | `send.ts`의 turn 등록↔반납 짝이 깨졌다(§13 D22). Decision 문면이 아니라 AC6이 지키던 축이다 |

- 나머지 D-002~D-010·D-012~D-015는 r4·r5 판정 그대로다.

## 2. 구현 결과 비판적 검토 (r6~r9 변경분)

| 질문 | 판정 | 근거 |
|---|---|---|
| D18의 새 oracle이 production 계약을 잠그는가 | **아니다** | `prepare-worktree.test.ts` 3번 케이스가 `buildTurn`·`acquireRuntime`을 **자기 fake로 주입**한다. `send.ts`가 그 자리에 무엇을 넣는지는 단언 밖이다 |
| false success 가능성 | **있다, r5보다 넓다** | M-Q′(결과 폐기) green + **M-A′(배선 전체 삭제) green**. r5에서 M-A는 red였다 |
| 실행 구조 변경의 부작용 | **있다** | `supervisor.startNew/startResume(turn)`은 `acquireRuntime` 콜백 안(`send.ts:182·187`)인데 `leaderTurn = turn`은 콜백 밖(`send.ts:213`)이다. 그 사이 `await acquireTurnRuntime`(189)이 reject하면 finally의 `supervisor.release(leaderTurn)`(408)이 건너뛴다 |
| 잃은 것이 있는가 | 있다 | 단계 주석 `── 6. TurnContext 조립` · `── 7. 런타임 확보`와 `0188 D-019` titleSettings 근거 주석이 삭제됐다. `src/main/AGENTS.md`는 `send.ts`를 "이름 붙은 12단계 시퀀스"로 서술한다(§13 D23) |
| extraDirs 계약 | 값 동일, 참조 변경 | `extraDirs: [...extraDirs]`로 복사본을 넘긴다. AC18의 "원값 유지"는 값 기준으로 성립한다 |
| 케이스 총량 | 증가 0 | 전 스위트 2595 → **2595**. `prepare-worktree.test.ts`는 3케이스 그대로 — 소스 텍스트 케이스가 seam 케이스로 **교체**됐다 |

## 3. 역방향 탐색 (r9)

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh ac622203..be982785   # 2 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| `prepareTurnWorktree` — "테스트 참조 5회, 프로덕션 0" | 오탐이되 신호다 | 같은 파일의 `prepareTurnExecution`이 호출하므로 죽은 코드는 아니다. 다만 3케이스 중 2개가 **cross-file 소비자가 없는 심볼**을 직접 부른다 |
| `PrepareTurnWorktreeResult` 타입 export | 정상 | 정의 파일 시그니처용 |
| 형제 파일 정책 비대칭 | 스크립트 0건 | r5에 적은 `service.ts` 분기 비대칭(D21)은 파일 단위 스캔이 놓치는 자리이며 그대로다 |
| `send.ts`를 보는 단언 | **0건** | `rg -n "send\.ts" app/src/main/app/chat-turn/*.test.ts` = 0줄. r5에는 1건 있었다 |

## 4. 등록 적대 증거 / 소거 변이 재측정 (검증자 실행)

모두 이번 라운드에 직접 실행했다. 각 변이는 잔여물을 치워 **lint 0 error**가 된 상태에서 판정했다.

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M-Q′ `send.ts`의 `buildTurn` 콜백이 준비된 `executionCwd` 대신 `payload.cwd ?? ctx.getCwd(...)`를 쓴다 | typecheck · lint · 전 스위트 | **green 2595** | D18 인용 변이 미검출 — VP-05·VP-11 · AC3·AC5·AC18 · EP-08 |
| M-A′ 격리 배선 전체 삭제(`prepareTurnExecution` 호출·import 제거, 직접 `buildTurnContext`+`acquireTurnRuntime` 복원, `makeClassifiedError` import 정리) | typecheck 0 · lint 0 error · 전 스위트 | **green 2595** | VP-05 등록 변이 — **r5의 red에서 green으로 회귀** |
| M-R1 D1 canonical candidate를 r4 형태로 되돌림 | worktrees | **red 1** | D1 잠금 유지 |
| M-R2 빈 bucket `rmdir` 제거 | worktrees | **red 1** | D12(add 경로) 잠금 유지 |
| M-L worktree를 저장소 **안**에 배치 | 전 스위트 | **red 1** | AC10 "repository 밖" — 잠금 유지(잔여 typecheck 1은 미사용 `rootDir`) |
| M-L′ 등록 변이 "repo name을 path에 쓴다"(+프롬프트 slug) | typecheck 0 · lint 0 error · 전 스위트 | **green 2595** | VP-14 등록 변이 미검출 — r4·r5와 동일 |
| M-F `base: baseOid` → `'HEAD'` | typecheck 0 · lint 0 error · 전 스위트 | **green 2595** | AC9 미검출 — r3·r4·r5와 동일 |
| M-O queue 우회 · M-I 칩 삭제 | — | 미재실행 | 해당 production/테스트 파일이 이 range에 없다. 「라운드 5」 §4 좌표 승계(둘 다 green) |

- 소거 변이 잔여물 수렴: M-A′는 1단계에서 `makeClassifiedError` 미사용으로 `TS6133` 1건·lint 1 error가 났고, 그 import를 지우자 **typecheck 0 · lint 0 error · 전 스위트 green**이다. 잔여물에 걸린 red가 아니라 진짜 침묵이다.
- 구현자가 인용한 변이("managed cwd를 source cwd로 되돌린 변이는 신규 suite 1 red")는 **`prepareTurnExecution` 내부**를 바꾼 것이다. 그 변이는 검출되지만, 같은 계약을 **`send.ts` 쪽에서** 깨는 M-Q′는 검출되지 않는다.
- 구조적 proxy 엄격화: `rg -n "createWorktree|addWorktree|removeWorktree" adapters sessions` 0줄을 `rg -in "worktree"`로 넓혀 재측정 → 차집합 **1줄**(`adapters/hooks.ts:8` 주석). 0건은 전수다.
- INDEX 비고의 "관련 raw path 비교 차집합은 0줄" 재측정: `rg -n 'toBe\(repo\)|toBe\(managed\)|startsWith\(|path: repo|path: managed' service.test.ts` = **0줄**. 주장 성립.
- **`leaderTurn` 반납 probe**(임시 스위트, 실행 후 삭제): `send.ts`와 같은 형상 — 콜백이 turn을 등록한 뒤 던지게 하면 `prepareTurnExecution`이 reject하고 호출자는 turn을 **받지 못한다**(`PROBE_REGISTERED_TURNS=1`, 반환값 없음). 따라서 `leaderTurn`은 `null`로 남고 finally의 `supervisor.release`가 실행되지 않는다.

## 5. V-pair closeout (r9) — `UT → IT → ST → AT`

| Pair | 레벨 | req. | r5 | **r9** | 근거 |
|---|---|---|---|---|---|
| VP-17 | UT | REQUIRED | PASS | **PASS** | 변경 무관. 이번 전 스위트 실행 전건 green |
| VP-16 | UT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — managed/external 분류기 없음 |
| VP-15 | UT | REQUIRED | PASS | **PASS** | 변경 무관 |
| VP-14 | UT | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | M-L red · 등록 변이 M-L′ green |
| VP-13 | IT | REQUIRED | PASS | **PASS** | 변경 무관 |
| VP-12 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 「라운드 5」 M-O green 승계 |
| VP-11 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 최종 query cwd·extraDirs 단언이 fake 대상이다. M-Q′ green. 추가로 AC6 축에 D22 |
| VP-10 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 |
| VP-09 | IT | REQUIRED | BLOCKED_BY:VP-05 | **BLOCKED_BY:VP-05** | IPC→service 통합 요청/args 테스트 부재 |
| VP-08 | ST | REGRESSION | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 |
| VP-07 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 |
| VP-06 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 |
| VP-05 | ST | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | seam의 순서 성질은 잠겼으나 production 배선 관측 0 — M-A′·M-Q′ 둘 다 green |
| VP-04 | AT | REGRESSION | PASS | **PASS** | 변경 무관 |
| VP-03 | AT | REQUIRED | BLOCKED_BY:VP-07 | **BLOCKED_BY:VP-07** | 변경 무관 |
| VP-02 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | ENOENT/non-repo fixture 없음. 오류 분류 `schema_validation_error` 그대로 |
| VP-01 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 「라운드 5」 M-I green 승계 |

- root `PAIR_FAIL`: **VP-05** · **VP-14**. r4·r5와 같다.
- 종속 `BLOCKED_BY`: VP-09 → VP-05 · VP-03 → VP-07.
- 합계: **PASS 4 · PAIR_FAIL 11 · BLOCKED_BY 2 = 17**. 네 라운드 연속 동수다.
- 구현자 자기보고 `SELF_PASS 6`(VP-04·05·11·13·15·17) 대조: **4/6 성립**, **VP-05·VP-11 미성립**.
- 실행 범위: root 실패 pair(VP-05·VP-14)·종속 pair·이번 변경이 닿은 pair(VP-05·VP-11)와 §15 gate 전건을 실행했다. 등록 변이가 싼 VP-14·AC9도 재실행했다. 변경이 닿지 않은 VP-01·VP-12는 「라운드 5」 좌표를 참조한다.

### AC 재측정

| AC | r5 | **r9** | 이번 라운드 관측 |
|---|---|---|---|
| AC3 | ⚠️ | ⚠️ | `prepareTurnExecution`의 "resolve 전 0회 · 후 1회"는 잠겼다. 그 호출자가 실제 `acquireTurnRuntime`인지는 단언 밖(M-A′ green) |
| AC5 | ⚠️ | ⚠️ | 정적 0건 유지. plan §7이 요구한 짝(직접 cwd oracle)이 M-Q′에서 green |
| AC6 | ✅ | **❌** | 실행 구조가 바뀌었다 — turn 등록은 콜백 안, 반납 조건 대입은 콜백 밖이라 실패 경로에서 `supervisor.release`가 사라진다(§13 D22) |
| AC18 | ⚠️ | ⚠️ | 값은 동일하되 사본을 넘긴다. `cwd changed` 짝은 여전히 M-Q′ green |

- 나머지 AC1·2·4·7·8·9·10·11·12·13·14·15·16·17·19·20은 r5 판정 그대로다.
- **합계 재측정**: **✅ 9 · ⚠️ 10 · ❌ 1 = 20**.
  ✅ = AC1·2·7·8·11·12·16·17·19 / ⚠️ = AC3·4·5·9·10·13·14·15·18·20 / ❌ = AC6.
- **자기보고 대조**: plan §19 r9 `✅13 · ⚠️7 · ❌0` ↔ 커밋 trailer 4건 모두 `Criteria-Met: 13/20` · `Criteria-Pending: AC4, AC9, AC10, AC13, AC14, AC15, AC20`(7항목, 13+7=20) ↔ INDEX 비고(AC 수치 없음). 자기보고 둘은 서로 일치하고 **재측정과 4행 불일치**(AC3·AC5·AC6·AC18을 ✅로 셌다).

### §10 강제 지점 재열거

| EP | 지점 수 | 잠금 | 근거 |
|---|---|---|---|
| EP-03 준비 순서 2곳 | 2/2 | **0** | `send.ts:141` + `prepare-worktree.ts`. 두 지점 다 M-A′에서 침묵 |
| EP-08 cwd 종단 4좌표 | 4/4 | **0** | `prepared.executionCwd` → `buildTurn(executionCwd,…)` → `payload.cwd`(`send.ts:172`) → `turn-context.ts:177` → `claude.ts:264`. M-Q′ green |
| EP-09 path SSOT 2곳 | 2/2 | 부분 | 저장소 밖 배치 red(M-L) · 문자열 identity green(M-L′) |
| EP-01·02·04·05·06·07·10·11·12 | 변화 없음 | — | 「라운드 4」·「라운드 5」 재열거 승계 |

- 재열거 합계 **10군 일치 · 2군 부분**(EP-06 2/3 · EP-11 2/3). 잠금 0인 군이 EP-03·EP-08 **둘**로 늘었다 — r5는 EP-08 하나였다.
- 구현자 자기보고 "EP-03 2/2와 EP-08 4/4를 `prepareTurnExecution`의 production 배선으로 묶었다"는 **지점 수는 성립**, **잠금 축은 미성립**이다.

### 현재 변경의 운영 gate (plan §15)

| Gate | 결과 | 관측한 실행 산출 |
|---|---|---|
| 1 `npm run typecheck` | **PASS** | exit 0 · `error TS` 0줄 · node·web·test 3구성 — r5의 exit 2에서 회복(**D17 해소**) |
| 2 `npm run lint` + 트리 확인 | PASS | 0 error · warning 1(기존 `useTranscriptVirtualizer`) · 실행 후 `git status --short` 빈 출력 |
| 3 관련 순수 suite | PASS | `vitest run src/main/features/worktrees` 2파일 8케이스 |
| 4 DB suite | PASS(조건부) | 전 스위트 **259/260 파일 · 2595/2595 케이스** |
| 5 `check-migrations-appendonly.mjs` | PASS | `sync ok: 18 migrations` · `no-copies ok: 812 files` · `append-only ok since v0.3.1` |
| 6 `check-doc-inventory.mjs --check` | PASS | `generated doc ok (9 items, 79 channels)` · prose ok · links ok |
| 7 `git diff --check` | PASS | 출력 0줄 |
| 8 architecture sweep | PASS | 0줄, 엄격화 후 차집합 1줄(주석) |
| 9 dependency sweep | PASS | `git diff 04ab7ad..be982785 -- app/package*.json` 0줄 |
| 10 Windows 사람 실기 | 미수행 | 이 환경에 Electron 바이너리·Windows 없음 |
| (추가) `node --test scripts/*.test.mjs` | PASS | 59/59 |

- 환경 기인 실패 분리: **1파일 0건 수집** — `app/chat-turn.continuity.test.ts`가 `Electron failed to install correctly`. r1부터 동일한 알려진 서명이다. 이 스위트가 바로 `handleChatSend`를 지나는 유일한 스위트이기도 하다.
- 게이트가 작업 트리를 바꿨는가: **없음**. `lint --fix` 실행 후 `git status --short` 빈 출력.
- 검증 중 실행한 명령의 잔여물: `app/node_modules`(`.gitignore` 대상)뿐. 임시 probe 1개는 실행 후 삭제했고 변이는 전부 원본 사본으로 복원했다.

## 6. 외부 포트 / 문서 계약

| 계약 | r9 변화 | 결과 |
|---|---|---|
| `prepareTurnExecution` 신규 export | `worktree`·`extraDirs`·`buildTurn`·`acquireRuntime` 4입력, 제네릭 `TTurn`/`TEntry` | 형상 성립. 제네릭이라 **어떤 buildTurn/acquireRuntime을 넣었는지는 타입이 잠그지 않는다** |
| `orca:chat:send.worktreeIsolation` | 변화 없음 | PASS |
| `orca:session:delete` → `DeleteSessionResult` | 변화 없음 | 부분(D13 그대로) |
| `0018_managed_worktrees` | 변화 없음 | PASS |

## 7. 숫자 / 상한 재측정

- 케이스 수: 2595 → **2595**(+0). 파일 260 유지.
- `prepare-worktree.test.ts`: 3케이스 → **3케이스**. 소스 텍스트 케이스 1개가 seam 케이스 1개로 교체됐다.
- `send.ts`를 읽는 단언: 1건 → **0건**.
- `send.ts` 길이: 411줄. 단계 주석 `── 6.`·`── 7.` 2개 삭제.
- 상한 재계산: naming 충돌 루프 `naming.ts:40` 상한 9999회 × Git read 2회 — r3~r5와 같다(D9).

## 8. 남은 사람 실기

r3~r5 판정 유지 — **AC20의 Windows Electron 배치·포커스 시각 확인 하나뿐**이다. `send.ts`의 준비 배선·실패 경로 반납은 이 환경에서 순수 seam으로 관측 가능하다 — 실제로 `prepare-worktree.ts`가 그 seam이며, 지금은 그 seam에 **production 콜백 대신 fake를 넣어** 관측하고 있다.

## 9. 게이트 재실행

실행 명령과 관측 산출은 §5 「현재 변경의 운영 gate」 표에 있다. 요약: typecheck exit 0 · error 0 · lint 0 error · vitest 259/260파일 2595케이스 · scripts 59/59 · 문서·마이그레이션·diff gate green.

## 10. 검증 책임 분리 — 사람 vs 에이전트

r3~r5의 분담과 같다. 이번 라운드에 새로 사람에게 넘긴 항목은 없다.

## 11. Repository operation checks (r9)

- `AGENTS.md` 변경 없음 — 위생 검사 대상 아님.
- INDEX: 단계 `impl`·상태 `IMPL_DONE (V1 r9)`·다음 주체 `Claude (r9 검증)`가 실제 상태와 맞았다. 비고 4줄(≤5). **대상 커밋 좌표는 이번 검증에서 `ab5a05b3`·`a26b35a8`·`38dd60df`·`be982785`로 기입**했다(`git cat-file -t` 전건 commit).
- 비고 주장 재측정: "관련 raw path 비교 차집합은 0줄" = **성립**(§4). 게이트 green 주장은 이번 비고에 없다 — **D20 해소**.
- trailer 허용값·파싱: ✅ 4커밋 모두 `git log -1 --format='%(trailers:only=true)'`가 `Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met`·`Criteria-Pending`·`Verified-By: pending` **6키를 그대로** 돌려준다.
- 커밋 언어: 4건 모두 제목·본문 한국어. `<type>(<scope>)` 형식 준수.
- 인용 해시 실재: `ac622203`·`ab5a05b3`·`a26b35a8`·`38dd60df`·`be982785` 전부 commit.
- plan 절 소유: `### r6`~`### r9`가 `§19` 아래에 붙었다. `### r4` 절은 여전히 `## [검증자 기입]` 안이다(D16 그대로).
- 구현자가 `[검증자 기입]` 표의 D17~D20 상태 칸을 직접 고쳤다. 재측정 결과 D17·D19·D20은 유지하고 **D18은 되돌린다**(§13).
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 대조

| 구현자 기술 | 검증자 판단 | 근거 |
|---|---|---|
| r7 "`typecheck:test`와 전체 typecheck 3구성은 진단 0" | **성립** | exit 0 · `error TS` 0줄 |
| r6 "source 읽기 oracle을 제거하고 준비→TurnContext→runtime acquire를 실행하는 seam으로 바꿨다" | **성립하되 축소** | seam은 fake를 실행한다. `send.ts`가 그 자리에 넣는 것은 관측 밖 — M-A′·M-Q′ green |
| r6 "managed cwd와 원래 extraDirs가 runtime 관측 request까지 도달함을 검증했다" | **미성립** | 도달을 본 것은 테스트가 만든 `acquireRuntime` fake의 `request`다. production `TurnRequest`는 이 스위트를 지나지 않는다 |
| r6 "EP-03 2/2와 EP-08 4/4를 production 배선으로 묶었다" | **지점 수만 성립** | 두 군 모두 잠금 0 |
| r8·r9 "raw path 비교를 filesystem identity로 교체, 차집합 0줄" | **성립** | 재측정 0줄, M-R1·M-R2 여전히 red |
| "VP-04·05·11·13·15·17 `SELF_PASS`" | **4/6 성립** | VP-05·VP-11 미성립 |
| "AC 자기보고 ✅13 · ⚠️7 · ❌0" | **불일치** | 재측정 ✅9 · ⚠️10 · ❌1 |
| r6 "runtime과 TurnContext를 만들지 않는 기존 상태 전이도 유지한다" | **부분** | 준비 *거부* 경로는 유지된다. runtime 확보가 **예외로** 끝나는 경로에서 turn 반납이 사라졌다(D22) |

## 13. Finding disposition / 파생 이슈 (r9)

r5 이슈의 상태 변화와 신규만 적는다. 표 정본은 [`plan.md`](plan.md) `[검증자 기입] 파생 이슈`다.

| # | 상태 | 근거 |
|---|---|---|
| D17 | **closed** | `npm run typecheck` exit 0 · error 0 |
| D18 | **되돌림 — open (BLOCKING)** | 인용 변이 M-Q′가 green. 새 oracle이 `send.ts`를 보지 않아 M-A′까지 green으로 회귀 |
| D19 | **closed** | r6~r9 각 절이 7필드를 이름 그대로 갖는다 |
| D20 | **closed** | 이번 INDEX 비고에 게이트 green 주장이 없고, 있는 주장("차집합 0줄")은 재측정으로 성립 |
| D1·D12 | 유지 | M-R1·M-R2 red 재확인. D12는 add 경로 부분 closed 그대로 |
| D5·D9·D11·D13·D14·D21 | open | 변화 없음 |
| D6·D10 | open (NEXT_HANDOFF) | 변화 없음 |
| D8·D16 | open (기록) | 변화 없음 |
| D22 | **신규 BLOCKING** | `supervisor.startNew/startResume(turn)`은 `acquireRuntime` 콜백 안(`send.ts:182·187`), `leaderTurn = turn`은 콜백 밖(213). 사이의 `await acquireTurnRuntime`(189)이 reject하면 finally의 `supervisor.release(leaderTurn)`(408)이 실행되지 않는다. `ac622203:send.ts:189`에서는 대입이 확보보다 앞이었다 |
| D23 | **신규 기록** | `send.ts`의 단계 주석 `── 6. TurnContext 조립`·`── 7. 런타임 확보`와 `0188 D-019` 근거 주석이 삭제됐다. `src/main/AGENTS.md`는 `send.ts`를 "이름 붙은 12단계 시퀀스"로 서술한다 |

- `PLAN_GAP`: **없음**. BLOCKING 2건과 pair 미달 13건은 전부 plan이 이미 지정한 계약·oracle을 구현이 만들지 않았거나 이번 재배치가 깬 것이다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** 같은 계약(EP-08 cwd 종단)의 oracle이 r5에서 소스 텍스트, r9에서 fake seam으로 두 번 바뀌었고 두 번 다 `send.ts`의 실제 값 흐름을 관측하지 않는다. 인용 변이는 매번 **그 라운드가 만든 장치가 보는 자리**에서 선택됐다.
- 관련 plan 지침/AC의 존재: **있었다.** AC3이 "runtime acquire 미호출/1회", plan §7 「AC 검증 주의사항」이 "직접 cwd oracle이 red여야 한다"를 명시한다. 아홉 라운드 동안 production 경로에서 그 둘을 본 단언이 0이다.
- 덮개가 줄어든 라운드: **있다.** r5에 red였던 M-A가 r9에 green이다 — 새 장치가 이전 장치를 대체하며 관측 범위를 좁혔다.
- 재배치가 만든 신규 결함: **있다.** r6이 `leaderTurn` 대입을 runtime 확보 뒤로 옮겼다(D22). "동작 보존 재배치"로 보고됐다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)이 r1부터 동일하다. **그 스위트가 `handleChatSend`를 지나는 유일한 스위트**이므로, `send.ts` 배선을 이 환경에서 닫으려면 electron 비의존 seam이 필요하다.
- 라운드 수: **9**(3 초과). r6~r9 사이 verify 턴은 없었고 r7·r8·r9는 외부 CI 보고를 입력으로 받은 라운드다.

## 15. 결론 (r9)

- 상태: **FAIL**
- pair: PASS 4(VP-04·13·15·17) · root PAIR_FAIL 2(VP-05·VP-14) · PAIR_FAIL 9 · BLOCKED_BY 2
- PLAN_GAP: 없음 — 다음 주체는 **구현자**
- ACTIVE Decision: D-011 부분 충족 유지. AC6 축에 신규 위반 1건(D22)
- AC: **✅9 · ⚠️10 · ❌1 = 20** (자기보고 `✅13 · ⚠️7 · ❌0`과 4행 불일치)
- 강제 지점: 10군 일치 · 2군 부분. **잠금 0인 군이 EP-08 하나에서 EP-03·EP-08 둘로 늘었다**
- 운영 gate: 10건 중 **9 PASS · 1 미수행(Windows 사람 실기)**. r5의 typecheck 실패는 해소됐다
- BLOCKING: D18(되돌림) · D22(신규) / NON_BLOCKING: D5·D9·D11·D12(부분)·D13·D14·D21 / NEXT_HANDOFF: D6·D10 / 기록: D8·D16·D23. **closed: D17·D19·D20**
- 남은 사람 확인: AC20의 Windows Electron 배치·포커스 하나
- 다음 단계: 라운드 10이다. 라운드가 3을 크게 초과하므로 **재구현 전 `handoff-review`를 수행한다**. 그 뒤 구현자는 (1) `send.ts`가 넣는 실제 `buildTurnContext`·`acquireTurnRuntime`을 지나는 oracle로 VP-05·VP-11을 닫고(M-A′·M-Q′가 red여야 한다), (2) turn 등록과 `leaderTurn` 대입을 다시 한 지점에 두어 실패 경로 반납을 복구하고(D22), (3) VP-14의 UUID identity 축(M-L′)과 VP-12의 queue 진입 배선(M-O), VP-01의 칩 관측(M-I)을 잠근다


# 라운드 5 — 원문 보존

r5는 네 라운드 미생성이던 `prepare-worktree.ts` seam을 만들고 BLOCKING D1(별칭 rollback 미식별)을
닫았다. 그러나 **이번 라운드 산출물 자체가 필수 gate 하나를 깬다** — `npm run typecheck`가 exit 2 ·
신규 `prepare-worktree.test.ts` 3 error다. 새 seam의 잠금은 `send.ts`를 **텍스트로 읽는** 단언이라
준비 결과를 버려도(M-Q) 전 게이트가 초록이고, EP-08 잠금은 여전히 0이다.

## 0. 기준선 / plan 변경 확인 (r5)

- 기준선이 diff로 성립하는가: **예**. `git show 318d87d -- plan.md` hunk 2개 — `§19` 뒤 `### r5` 절 8줄과 `[검증자 기입]` 표의 D1·D12 상태 칸이다.
- Decision Ledger·Product/UX·AC·V node/pair·§10·oracle 변경: **없음**. 위 두 hunk 밖의 plan 변경이 0줄이다.
- 채점 기준: r3·r4와 같은 `04ab7ad:V1` — §3 Decision · §7 AC1~AC20 · §7-A pair 17 · §10 EP-01~EP-12.
- plan validity: r3 판정 유지(「라운드 3」 「Plan validity」). r5가 규범 행을 바꾸지 않았으므로 재감사 대상이 없다. root `PLAN_GAP` **없음**.
- `[구현자 기입]` 7필드: **4/7**. `이번 라운드 수정의 잠금`·`구현 보고`·`Review Signals`가 없고 §7 게이트 산출 보고도 없다(§13 D19). r4의 7/7에서 후퇴했다.

## 1. ACTIVE Decision — r4 대비 변화만

| Decision | r4 | r5 | 관측 |
|---|---|---|---|
| D-011 이번 호출 산출물만 rollback | ❌ | ⚠️ | add 실패 경로는 canonical candidate로 대상을 찾고 빈 bucket까지 지운다 — 되돌리면 red(M-R1·M-R2). **DB insert 실패 경로는 빈 bucket을 그대로 남긴다**(§4 probe, 3회 → 3개) |
| D-001 Agent/Runtime은 worktree를 모른다 | ✅ | ✅ | `rg -in worktree app/src/main/adapters app/src/main/features/sessions` 차집합 1줄(주석) |
| D-004 격리는 신규 일반 세션만 | ✅ | ✅ | `protocol.ts:113` superRefine 유지 + seam이 `sessionId` 있으면 passthrough |

- 나머지 D-002·D-003·D-005~D-010·D-012~D-015는 r4 판정 그대로다(「라운드 4」 §1).

## 2. 구현 결과 비판적 검토 (r5 변경분)

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | **있다** | 준비 seam을 부르고 그 `executionCwd`만 버리면 worktree는 만들어지고 Agent는 원본 checkout에서 돈다 — 잔여물 0까지 밀어 lint 0 error, 전 스위트 2595 green(M-Q) |
| 새 seam이 무엇을 잠갔는가 | 존재와 순서만 | `prepare-worktree.test.ts` 1번 케이스가 `send.ts`를 `readFile`로 읽어 문자열 인덱스를 비교한다. production 호출이 아니라 소스 텍스트다 |
| AC3이 요구한 관측이 있는가 | 없다 | AC3은 "add resolve 전 runtime acquire 미호출, resolve 후 1회"다. 새 3번 케이스는 `prepareTurnWorktree`가 스스로 await하는지만 본다 — runtime acquire를 부르는 주체가 없다 |
| partial failure 잔여물 | 경로별로 다르다 | `!added.ok` 분기는 `rmdir(dirname)`로 bucket을 지우고, `catch` 분기는 지우지 않는다(§13 D21) |
| 오류 분류 | 변화 없음 | `send.ts:156`이 준비 거부를 `schema_validation_error`로 보낸다. seam이 service의 `reason`을 버려 후속 분류가 더 멀어졌다(D5) |

## 3. 역방향 탐색 (r5)

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh e798f27..318d87d   # 3 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 1a 빈 목록 |
| `PrepareTurnWorktreeResult` 등 타입 export 3종 | 정상 | 정의 파일 시그니처용 |
| 테스트에만 등장하는 심볼 | 없음 | 2번 항목 빈 목록 |
| 형제 분기 정책 비대칭 | **있다** | 스크립트는 파일 단위라 놓친다 — 같은 함수의 `!added.ok` 분기에만 `rmdir(dirname(worktreeRoot))`가 있고 `catch` 분기에는 없다(`service.ts:113` ↔ `134`) |
| 새 seam이 버리는 필드 | 있다 | `PrepareWorktreeResult.reason`(5종)이 `PrepareTurnWorktreeResult.rejected`에서 사라진다 — D5 해소를 더 멀게 한다 |

## 4. 등록 적대 증거 / 소거 변이 재측정 (검증자 실행)

모두 이번 라운드에 직접 실행했다. 각 변이는 잔여물(unused import·`prefer-const`)을 치워 **lint 0 error**가 된 상태에서 판정했다.

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M-Q **준비 결과 폐기** — `executionCwd = preparedWorktree.executionCwd` 한 줄 제거(+`let`→`const`) | typecheck · lint · 전 스위트 | **green 2595** | VP-05·VP-11 · AC3·AC5·AC18 · EP-08 잠금 0 |
| M-A 격리 배선 전체 삭제(호출 블록 + import + `const` 복귀) | 전 스위트 | **red 1** | VP-05 등록 변이 — r4의 green 2591에서 **검출로 전환** |
| M-R1 D1 canonical candidate를 r4 형태로 되돌림 | worktrees | **red 1** | D1 잠금 성립 |
| M-R2 빈 bucket `rmdir` 제거 | worktrees | **red 1** | D12 잠금 성립(add 실패 경로) |
| M-L worktree를 저장소 **안**(`<repoRoot>/.orca-wt/…`)에 배치 | worktrees+infra/git | **red 1** | AC10 "repository 밖" — r4의 green 7에서 **검출로 전환**(별칭 rollback 케이스가 잡는다) |
| M-L' 등록 변이 "repo name을 path에 쓴다"(+ 프롬프트 slug 세그먼트) | typecheck · lint · 전 스위트 | **green 2595** | VP-14 등록 변이 미검출 — r4와 동일 |
| M-F `base: baseOid` → `'HEAD'` | 전 스위트 | **green 2595** | AC9 미검출 — r3·r4와 동일 |
| M-O `addWorktree`에서 queue 우회 | 전 스위트 | **green 2595** | VP-12 등록 변이(queue bypass) 미검출 — r4와 동일 |
| M-I 격리 칩을 `CwdPanel`에서 삭제 | 전 스위트 | **green 2595** | VP-01 등록 변이 "chip 제거 시 red" 미성립 — r4와 동일 |

- 소거 변이 잔여물 수렴: M-Q는 1단계에서 `prefer-const` 1 error가 났고 그 정리까지 밀자 **lint 0 error · 전 스위트 green**이었다. M-A·M-L'·M-F·M-O·M-I도 잔여물 0 상태의 결과다.
- typecheck는 모든 변이에서 **error 3으로 불변**이다 — 세 error가 전부 신규 `prepare-worktree.test.ts`의 기존 결함이라 변이 민감도가 없다.
- 구조적 proxy 엄격화: 게이트 8의 `rg -n "createWorktree|addWorktree|removeWorktree"` 0줄을 `rg -in "worktree"`로 넓혀 재측정 → 차집합 **1줄**(`adapters/hooks.ts:8` 주석). 0건은 전수다.
- **DB insert 실패 rollback probe**(임시 스위트, 실행 후 삭제): `insertManagedWorktree`가 throw하도록 주입해 3회 준비 실패시켰다. worktree 목록은 main 1개로 원복하고 branch도 `master`만 남지만, managed root에는 **빈 repoId bucket 3개**가 남았다(`["8f65dde8…","c0df9b0d…","d7db7ead…"]`).
- **D11 간헐 red 재관측**: `mutation-queue.test.ts`의 별칭 직렬화 단언은 이번 라운드 **전 스위트 9회 실행에서 0회 red**였다(클린 트리 1 + 변이 트리 8). r4의 4회 중 2회 red는 재현되지 않았다 — D11의 비원자적 등록 자체는 코드에 그대로다.

## 5. V-pair closeout (r5) — `UT → IT → ST → AT`

| Pair | 레벨 | req. | r4 | **r5** | 근거 |
|---|---|---|---|---|---|
| VP-17 | UT | REQUIRED | PASS | **PASS** | 변경 무관. 이번 9회 실행 전건 green(§4) |
| VP-16 | UT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — managed/external 분류기 없음. 증거는 「라운드 4」 §5 |
| VP-15 | UT | REQUIRED | PASS | **PASS** | 변경 무관. `naming.test.ts` 좌표 승계 |
| VP-14 | UT | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | `<userData>` 밖 배치는 잠겼다(M-L red). 등록 변이 M-L'는 여전히 green — repo 이름·프롬프트 문자열이 경로 세그먼트가 돼도 침묵 |
| VP-13 | IT | REQUIRED | PASS | **PASS** | 변경 무관 |
| VP-12 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — queue bypass 변이 green(M-O) |
| VP-11 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 최종 query cwd·unchanged extraDirs 단언이 소스 텍스트뿐. M-Q green |
| VP-10 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — EP-06 3번째 지점 없음 |
| VP-09 | IT | REQUIRED | BLOCKED_BY:VP-05 | **BLOCKED_BY:VP-05** | IPC→service 통합 요청/args 테스트 부재 |
| VP-08 | ST | REGRESSION | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 짝인 양성 resume 관측 0 |
| VP-07 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — 4상태 중 2 |
| VP-06 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 변경 무관 — reopen/resume 관측 0 |
| VP-05 | ST | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | seam은 생겼고 등록 변이는 검출한다(M-A red). 그러나 직접 oracle "add resolve 전 runtime acquire 0회·후 1회"가 없고, 준비 결과 폐기는 미검출(M-Q) |
| VP-04 | AT | REGRESSION | PASS | **PASS** | 변경 무관 — M-C 좌표 승계 |
| VP-03 | AT | REQUIRED | BLOCKED_BY:VP-07 | **BLOCKED_BY:VP-07** | handler 경로·결과 union 관측 0 |
| VP-02 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | ENOENT/non-repo fixture 없음. 오류 분류도 `schema_validation_error` 그대로 |
| VP-01 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 등록 변이 미성립(M-I green) |

- root `PAIR_FAIL`: **VP-05** · **VP-14**. r4와 같다.
- 종속 `BLOCKED_BY`: VP-09 → VP-05 · VP-03 → VP-07.
- 합계: **PASS 4 · PAIR_FAIL 11 · BLOCKED_BY 2 = 17**. r4와 동수다 — D1·D12가 닫혔지만 그 둘은 pair를 넘기는 조건의 일부였을 뿐이다.
- 구현자 자기보고 `SELF_PASS 5`(VP-04·05·13·15·17) 대조: **4/5 성립**, **VP-05는 미성립**이다.
- 실행 범위: r5는 재검증이므로 root 실패 pair(VP-05·VP-14)·종속 pair·이번 변경이 닿은 pair(VP-05·VP-11·VP-02)와 §15 gate 전건을 실행했다. 변경이 닿지 않은 이전 판정(VP-01·03·04·06·07·08·09·10·12·13·15·16·17)은 「라운드 4」의 증거 좌표를 참조해 상태만 승계하되, 등록 변이가 싼 VP-01·VP-12·VP-14는 재실행했다.

### AC 재측정

| AC | r4 | **r5** | 이번 라운드 관측 |
|---|---|---|---|
| AC3 | ⚠️ | ⚠️ | seam 2곳 성립, 순서는 소스 텍스트 단언. runtime acquire 0/1 관측 없음 |
| AC4 | ❌ | ⚠️ | add 실패 rollback이 별칭에서 대상을 찾고 bucket까지 지운다(M-R1·M-R2 red). DB insert 실패·abort 주입과 "runtime 0회"는 여전히 관측 0 |
| AC5 | ✅ | ⚠️ | 정적 0건은 유지되나 plan §7 주의사항이 요구한 짝 — "worktree import를 지워도 직접 cwd oracle이 red" — 이 M-Q에서 green |
| AC10 | ⚠️ | ⚠️ | 저장소 밖 배치는 잠겼다(M-L red). UUID identity 축은 여전히 열려 있다(M-L' green) |
| AC18 | ✅ | ⚠️ | `extraDirs identical`은 소스 텍스트로만 단언한다. 짝인 `cwd changed`는 M-Q에서 green |

- 나머지 AC1·2·6·7·8·9·11·12·13·14·15·16·17·19·20은 r4 판정 그대로다(「라운드 4」 「AC 재측정」과 「라운드 3」 「AT / AC 세부와 합계」).
- **합계 재측정**: **✅ 10 · ⚠️ 10 · ❌ 0 = 20**.
  ✅ = AC1·2·6·7·8·11·12·16·17·19 / ⚠️ = AC3·4·5·9·10·13·14·15·18·20 / ❌ = 없음.
- r4 합계(✅12·⚠️7·❌1)와의 차: AC4가 ❌→⚠️로 올라가고, AC5·AC18이 ✅→⚠️로 내려갔다. **내려간 두 행은 r5가 만든 새 증거(M-Q)로 재측정한 결과**이며 r4가 실행하지 않은 변이다.
- **자기보고 대조**: plan §19 r5 `✅14 · ⚠️6 · ❌0` ↔ 커밋 trailer `Criteria-Met: 14/20` · `Criteria-Pending: AC9, AC10, AC13, AC14, AC15, AC20` ↔ INDEX 비고(AC 수치 없음). 자기보고 둘은 서로 일치하고 **재측정과 4행 불일치**(AC3·AC4·AC5·AC18을 ✅로 셌다).

### §10 강제 지점 재열거

| EP | 지점 수 | 잠금 | 근거 |
|---|---|---|---|
| EP-03 준비 순서 2곳 | **2/2** | 부분 | `send.ts:141` + `prepare-worktree.ts` 신설. 존재·순서는 red(M-A), 효과는 green(M-Q) |
| EP-08 cwd 종단 4좌표 | 4/4 | **0** | `send.ts:158` → `payload.cwd: executionCwd`(`send.ts:173`) → `turn-context.ts:177` → `claude.ts:264`. M-Q green |
| EP-09 path SSOT 2곳 | 2/2 | 부분 | 저장소 밖 배치 red(M-L) · 문자열 identity green(M-L') |
| EP-01·02·04·05·06·07·10·11·12 | 변화 없음 | — | 「라운드 4」 §「§10 강제 지점 재열거」 승계 |

- 재열거 합계 **10군 지점 수 일치 · 2군 부분**(EP-06 2/3 · EP-11 2/3). EP-03은 r4의 1/2에서 **2/2로 닫혔다**. 잠금 0인 군은 EP-08 하나다.
- 구현자 자기보고 "EP-03을 2/2로 닫았다"는 **지점 수는 성립**하고, 같은 문장의 "send의 준비 순서와 cwd·extraDirs 배선을 source oracle로 잠갔다"는 **효과 축에서 미성립**이다.

### 현재 변경의 운영 gate (plan §15)

| Gate | 결과 | 관측한 실행 산출 |
|---|---|---|
| 1 `npm run typecheck` | **FAIL** | **exit 2 · `error TS` 3줄** — 전부 `src/main/app/chat-turn/prepare-worktree.test.ts`(32·37·57행, `providerSettings: {}`·`{model:'test'}`가 `ResolvedHarnessSettings` 불만족). `typecheck:node`·`typecheck:web`은 진단 0줄 |
| 2 `npm run lint` + 트리 확인 | PASS | 0 error · warning 1(기존 `useTranscriptVirtualizer`) · 실행 후 `git status --short` 빈 출력 |
| 3 관련 순수 suite | PASS | `vitest run src/main/features/worktrees src/main/infra/git src/main/infra/db` 11파일 81케이스 |
| 4 DB suite | PASS(조건부) | `npm rebuild better-sqlite3`(Node ABI) 후 전 스위트 **259/260 파일 · 2595/2595 케이스** |
| 5 `check-migrations-appendonly.mjs` | PASS | `sync ok: 18 migrations` · `no-copies ok: 812 files` |
| 6 `check-doc-inventory.mjs --check` | PASS | `generated doc ok (9 items, 79 channels)` · prose ok · links ok |
| 7 `git diff --check` | PASS | 출력 0줄 |
| 8 architecture sweep | PASS | 엄격화 후 차집합 1줄(주석), 호출 0 |
| 9 dependency sweep | PASS | `git diff 04ab7ad..318d87d -- app/package*.json` 빈 diff · shell Git 0(`runner.ts:31`의 `exec`는 주입 `execFile` 지역 별칭) |
| 10 Windows 사람 실기 | 미수행 | 이 환경에 Electron 바이너리·Windows 없음 |
| (추가) `node --test scripts/*.test.mjs` | PASS | 59/59 |

- **gate 1은 이번 변경 산출물의 실패다.** 세 error가 모두 r5가 신설한 파일에 있고, `app/AGENTS.md`가 코드 수정 루프의 기본 게이트로 지정한 `lint + typecheck` 중 하나이며 `.github/workflows/ci.yml`의 windows gate도 `npm run typecheck`를 돈다. 환경 기인이 아니다.
- 환경 기인 실패 분리: **1파일 0건 수집** — `app/chat-turn.continuity.test.ts`가 `Electron failed to install correctly`. `app/AGENTS.md §제약 환경`의 알려진 서명이며 r1부터 동일하다.
- 게이트가 작업 트리를 바꿨는가: **없음**. `lint --fix` 실행 후 `git status --short` 빈 출력.
- 검증 중 실행한 명령의 잔여물: `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`가 만든 `app/node_modules`(`.gitignore` 대상)뿐. 임시 probe 스위트 1개는 실행 후 삭제했고 변이는 전부 원본 사본으로 복원해 최종 `git status --short`는 verify 산출물만 보여준다.

## 6. 외부 포트 / 문서 계약

| 계약 | r5 변화 | 결과 |
|---|---|---|
| `orca:chat:send.worktreeIsolation` | 변화 없음 — `protocol.ts:96·113` superRefine 유지 | PASS |
| `orca:session:delete` → `DeleteSessionResult` | 변화 없음 | 부분(D13 그대로) |
| `WorktreeService` 생성자 | 3번째 인자 `WorktreeOperations` 추가(기본값 있음) | 호환 — `bootstrap.ts:835` 2인자 호출 그대로 |
| service → seam 결과 계약 | `reason` 5종이 seam에서 소실 | 축소 — D5 해소 경로가 멀어졌다 |
| `0018_managed_worktrees` | 변화 없음 | PASS |

## 7. 숫자 / 상한 재측정

- 신규 테스트 파일: r5가 **1개**(`prepare-worktree.test.ts`) 추가 + 1개 보강(`service.test.ts`). 누적 신규 10개다.
- plan §14 신규 파일 중 **미생성 0종**. r4의 1종(`prepare-worktree.ts`+test)이 해소됐다.
- 케이스 수: 전 스위트 2591 → **2595**(+4). 파일 259 → 260.
- `service.ts` 길이 재측정: 186줄. rollback 분기 2개 중 bucket 정리는 **1개**에만 있다.
- 상한 재계산: naming 충돌 루프 `naming.ts:40` 상한 9999회 × Git read 2회 — r3·r4와 같다(D9).

## 8. 남은 사람 실기

r3·r4 판정 유지 — **AC20의 Windows Electron 배치·포커스 시각 확인 하나뿐**이다. runtime acquire 순서, 준비 결과의 종단 cwd, 칩 상태, ENOENT/non-repo 오류 분기는 모두 이 환경에서 순수 seam으로 관측 가능하며, 이번 라운드도 그 seam들이 만들어지지 않아 미관측으로 남았다.

## 9. 게이트 재실행

실행 명령과 관측 산출은 §5 「현재 변경의 운영 gate」 표에 있다. 요약: **typecheck exit 2 · error 3** · lint 0 error · vitest 259/260파일 2595케이스 · scripts 59/59 · 문서·마이그레이션·diff gate green.

## 10. 검증 책임 분리 — 사람 vs 에이전트

r3·r4의 분담과 같다. 이번 라운드에 새로 사람에게 넘긴 항목은 없다.

## 11. Repository operation checks (r5)

- `AGENTS.md` 변경 없음 — 위생 검사 대상 아님.
- INDEX: 단계 `impl`·상태 `IMPL_DONE (V1 r5)`·다음 주체 `Claude (재검증)`가 실제 상태와 맞았다. 비고 5줄(≤5). **대상 커밋 좌표는 이번 검증에서 `318d87d`로 기입**했다(`git cat-file -t 318d87d` = commit). 비고의 "typecheck … gate green" 문장은 사실과 다르다(§13 D20).
- trailer 허용값·파싱: ✅ `git log -1 --format='%(trailers:only=true)' 318d87d`가 `Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met`·`Criteria-Pending`·`Verified-By: pending` **6키를 그대로** 돌려준다. `Criteria-Met 14` + `Criteria-Pending` 6항목 = 20으로 분모가 맞는다.
- 커밋 언어: 제목·본문 모두 한국어다 — **D15 해소**.
- 인용 해시 실재: `04ab7ad`·`aec9fe9`·`dd9f47c`·`418dc1e`·`e798f27`·`318d87d` 전부 commit.
- plan 절 소유: `### r5`는 `§19 [구현자 기입]` 아래에 붙었다. `### r4` 절은 여전히 `## [검증자 기입] 파생 이슈` 안에 있다(D16 그대로).
- 구현자가 `[검증자 기입]` 표의 D1·D12 상태 칸을 직접 고쳤다. 이번 검증이 재측정으로 확인했으므로 D1은 유지하고 D12는 범위를 좁힌다(§13).
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 대조

| 구현자 r5 기술 | 검증자 판단 | 근거 |
|---|---|---|
| "`prepare-worktree.ts`를 신설해 EP-03을 2/2로 닫고" | **성립** | 지점 2곳 실재, M-A red |
| "send의 `prepare await → TurnContext` 순서와 cwd·extraDirs 배선을 source oracle로 잠갔다" | **부분** | 잠근 것은 소스 텍스트다. 값이 실제로 흐르는지는 M-Q에서 green |
| "구성 경로의 부모를 `realpath`한 canonical candidate로 porcelain path와 대조" | **성립** | 별칭 fixture red(M-R1) |
| "rollback 뒤 빈 repo bucket은 `rmdir`로만 제거한다" | **부분** | add 실패 경로만이다. DB insert 실패 경로는 bucket 3개 잔존(§4 probe) |
| "VP-04·05·13·15·17은 SELF_PASS" | **4/5 성립** | VP-05는 직접 oracle 부재 + M-Q green |
| "AC 자기보고 ✅14 · ⚠️6 · ❌0" | **불일치** | 재측정 ✅10 · ⚠️10 · ❌0 |
| "신규 의존성·PLAN_GAP은 없다" | 성립 | package diff 빈 출력, plan 규범 행 무변경 |
| 게이트 결과 | **미보고** | plan §19 r5에 게이트 산출 문장이 없다. INDEX 비고의 "typecheck green"은 재측정과 반대다 |

## 13. Finding disposition / 파생 이슈 (r5)

r4 이슈의 상태 변화와 신규만 적는다. 표 정본은 [`plan.md`](plan.md) `[검증자 기입] 파생 이슈`다.

| # | 상태 | 근거 |
|---|---|---|
| D1 | **closed** | M-R1 red + 별칭 fixture가 canonical 대상 remove 1회·목록 원복을 단언 |
| D12 | **부분 closed** | add 실패 경로만. DB insert 실패 경로는 D21로 분리 |
| D5 | open | `send.ts:156` 그대로. seam이 `reason`을 버려 범위가 넓어졌다 |
| D6·D10 | open (NEXT_HANDOFF) | 변화 없음 |
| D8·D9·D13·D14·D16 | open | 변화 없음 |
| D11 | open (NON_BLOCKING) | 코드 그대로. 이번 9회 실행에서 간헐 red는 재현되지 않았다 |
| D15 | **closed** | r5 커밋 제목·본문 한국어 |
| D17 | **신규 BLOCKING** | `npm run typecheck` exit 2 · error 3 — 전부 신규 `prepare-worktree.test.ts` |
| D18 | **신규 BLOCKING** | 준비 결과 폐기(M-Q)가 전 게이트 green — EP-08 잠금 0, VP-05·VP-11 직접 oracle 부재 |
| D19 | **신규 기록** | `[구현자 기입]` r5 절이 impl §8 7필드 중 4개만 갖는다 — `이번 라운드 수정의 잠금`·`구현 보고`·`Review Signals`와 게이트 산출 보고가 없다 |
| D20 | **신규 기록** | INDEX 비고가 "lint·typecheck … gate green"이라고 적었으나 typecheck는 exit 2다 |
| D21 | **신규 NON_BLOCKING** | DB insert 실패 rollback이 `<managed>/<repoId>` 빈 bucket을 남긴다(3회 → 3개). 같은 함수의 형제 분기와 정책이 다르다 |

- `PLAN_GAP`: **없음**. BLOCKING 2건과 pair 미달 13건은 전부 plan이 이미 지정한 계약·oracle을 구현이 만들지 않았거나 게이트를 깬 것이다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** r3·r4가 "격리 배선을 지워도 green"(M-A)으로 적은 축을 r5가 텍스트 단언으로 막았고, 같은 축의 한 칸 약한 변이(결과만 폐기, M-Q)가 그대로 통과한다. 잠금이 계약이 아니라 **변이 문장**을 향해 만들어졌다.
- 관련 plan 지침/AC의 존재: **있었다.** AC3이 "add resolve 전 runtime acquire 미호출, resolve 후 1회"를, plan §7 「AC 검증 주의사항」이 "AC5의 0건 정적 가드는 양성 TurnRequest cwd assertion과 쌍"을 명시한다. 둘 다 다섯 라운드 내내 만들어지지 않았다.
- 자기 게이트 보고와 실측의 어긋남: **있다.** 구현자가 게이트를 green으로 보고한 라운드에 `npm run typecheck`가 exit 2다. plan §19에는 게이트 산출 문장 자체가 없다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)과 렌더 하네스 부재가 r1부터 동일하다.
- 라운드 수: **5**(3 초과). r4 앞의 review는 `APPLY`, r5 앞의 review는 `DIAGNOSE_ONLY`로 수행됐고 두 번 모두 지침을 유지했다. 그 뒤 라운드에서도 root VP-05·VP-14는 닫히지 않았다.

## 15. 결론 (r5)

- 상태: **FAIL**
- pair: PASS 4(VP-04·13·15·17) · root PAIR_FAIL 2(VP-05·VP-14) · PAIR_FAIL 9 · BLOCKED_BY 2
- PLAN_GAP: 없음 — 다음 주체는 **구현자**
- ACTIVE Decision: D-011 부분 충족(add 경로 ✅ · DB insert 경로 ⚠️). 나머지 r4 판정 유지
- AC: **✅10 · ⚠️10 · ❌0 = 20** (자기보고 `✅14 · ⚠️6 · ❌0`과 4행 불일치)
- 강제 지점: 10군 일치 · 2군 부분(EP-06·EP-11). EP-03이 2/2로 닫혔고 EP-08 잠금은 0
- 운영 gate: 10건 중 **8 PASS · 1 FAIL(typecheck) · 1 미수행(Windows 사람 실기)**. 환경 기인 red 1파일은 변경 무관
- BLOCKING: D17(typecheck) · D18(준비 결과 폐기 미검출) / NON_BLOCKING: D5·D9·D11·D12(부분)·D13·D14·D21 / NEXT_HANDOFF: D6·D10 / 기록: D8·D16·D19·D20. **closed: D1·D15**
- 남은 사람 확인: AC20의 Windows Electron 배치·포커스 하나
- 다음 단계: 라운드 6이다. 라운드가 3을 계속 초과하므로 **재구현 전 `handoff-review`를 수행한다**. 그 뒤 구현자는 (1) `prepare-worktree.test.ts`의 타입을 고쳐 gate 1을 되살리고, (2) 소스 텍스트가 아니라 **runtime acquire와 최종 `TurnRequest.cwd`를 관측하는** 오라클로 VP-05·VP-11을 닫고(M-Q가 red여야 한다), (3) VP-14의 UUID identity 축(M-L')과 VP-12의 queue 진입 배선(M-O), VP-01의 칩 관측(M-I)을 잠그고, (4) DB insert 실패 경로의 bucket 정리를 형제 분기와 맞춘다


# 라운드 4 — 원문 보존

r4는 BLOCKING 3건 중 2건(D2·D3)을 닫고 4개 pair를 PASS로 올렸다. root `VP-05`는 손대지 않았고
(구현자도 "닫지 않았다"고 적었다) `VP-14`는 등록 변이가 여전히 통과한다. D1 rollback은 코드가
생겼으나 잠금이 없고 별칭 managed root에서 대상 식별에 실패한다.

## 0. 기준선 / plan 변경 확인 (r4)

- 기준선이 diff로 성립하는가: **예**. `git show e798f27 -- plan.md` hunk 1개가 파일 끝에 붙인 `### r4` 절 10줄뿐이다(붙인 위치는 §13 D16).
- Decision Ledger·Product/UX·AC·V node/pair·§10·oracle 변경: **없음**. `git diff 04ab7ad..e798f27 -- plan.md`의 hunk가 `§19` 이후에만 있다.
- 채점 기준: r3과 같은 `04ab7ad:V1` — §3 Decision · §7 AC1~AC20 · §7-A pair 17 · §10 EP-01~EP-12.
- plan validity: r3 판정 유지(§라운드 3 「Plan validity」). r4가 규범 행을 바꾸지 않았으므로 재감사 대상이 없다. root `PLAN_GAP` **없음**.
- `[구현자 기입]` 7필드: **7/7 존재**(설계 리뷰·강제 지점 전수와 V-pair 자기확인·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals). r2·r3의 필드 소실은 회복됐다.

## 1. ACTIVE Decision — r3 대비 변화만

| Decision | r3 | r4 | 관측 |
|---|---|---|---|
| D-010 nullable row → bind | ❌ 유일성 없음 | ✅ | `queries.ts:787` `matches.length === 1`만 bind, 초과는 `managed-worktree.bind.ambiguous` 경고 후 보존. 되돌리면 red(M-E) |
| D-011 이번 호출 산출물만 rollback | ❌ | ❌ | `service.ts:91-97`이 생겼으나 잠금 0(M-H)이고 별칭 root에서 대상 미식별(§4 probe) |
| D-014 repo 단위 mutation queue | ❌ key 불일치 | ✅ | 정규화가 `withRepoMutation` 내부 한 곳(`mutation-queue.ts:125`)으로 모였다. checkout(`git-cli.ts:127`)·add/remove/branch 4진입이 같은 함수를 지난다. 되돌리면 red(M-D) |
| D-008/D-009 naming 강등 | ⚠️ 잠금 0 | ✅ | `naming.test.ts` 2케이스 — sanitize+충돌 `work/fix-auth-2`, throw → `work/12345678`. catch 제거 시 red(M-G) |
| D-006 base = 최초 full OID | ⚠️ 잠금 0 | ⚠️ | 변화 없음. `base: baseOid` → `'HEAD'` 변이가 **전 스위트 2591 green**(M-F) |
| D-002 execFile 배열·shell 미경유 | ✅ 정적만 | ✅ 직접 | `runner.test.ts`가 주입 `execFile`로 file·args·env·`shell` 부재를 관측. `shell:true` 변이 red(M-N) |

- 나머지 D-001·D-003~D-005·D-007·D-012·D-013·D-015는 r3 판정 그대로다(§라운드 3 §1).

## 2. 구현 결과 비판적 검토 (r4 변경분)

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | rollback이 대상을 못 찾는 경우가 남는다 | 별칭 managed root에서 git 보고 경로와 구성 경로가 다른 식별자다(§4 probe) |
| false success 가능성 | 있다 | 격리 배선을 통째로 지워도 typecheck·lint·전 스위트가 green(M-A) — r3와 동일 |
| partial failure/rollback | 잔여물이 남는다 | 취소 3회 후 `<managed>/<repoId>` 빈 버킷 3개 잔존(§13 D12) |
| 새 표면의 동시성 | 등록 순서가 호출 순서가 아니다 | key 해석이 `await`라 등록이 비원자적 — 200회 중 18회 후행 호출이 먼저 진입(§13 D11). 상호배제 자체는 유지(150라운드×5동시, 최대 겹침 1) |
| 출력/요청 worst-case 상한 | 변화 없음 | naming 충돌 루프 상한 `naming.ts:40` `suffix < 10_000` 그대로(§13 D9) |

## 3. 역방향 탐색 (r4)

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 418dc1e..e798f27   # 8 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| `mutation-queue.ts::canonicalRepoKey` | 테스트 전용 export | 프로덕션 외부 참조 0 — 내부에서 `withRepoMutation`이 호출한다. 테스트가 정규화 값을 직접 단언하려고 연 문 |
| `infra/git/worktree.ts::listWorktrees` | **배선됨(잠금 0)** | r3의 "프로덕션 0"이 해소됐다 — `service.ts:91` 1곳. 그러나 그 블록을 통째로 지워도 전 스위트 green(M-H) |
| `service.ts::PrepareWorktreeResult`·`DeleteManagedWorktreeResult`·`runner.ts::GitRunOptions` | 정상 | 정의 파일 시그니처용 타입 export |
| 형제 파일 정책 비대칭 | 없음 | r3 결함(`repoRoot` raw ↔ `canonicalPath`)이 queue 내부 정규화로 해소 |

## 4. 등록 적대 증거 / 소거 변이 재측정 (검증자 실행)

모두 이번 라운드에 직접 실행했다. 구현자 보고와 무관하게 다시 셌다.

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M-A 격리 배선 전체 삭제(`send.ts` 블록 + `const` 복귀 + 미사용 import 정리) | typecheck 3구성 0 error · lint 0 error · 전 스위트 | **green 2591** | VP-05 root — r3와 동일 |
| M-B `executionCwd = resolve(actualRoot, subpath)` → `actualRoot` | worktrees | **red 1** | AC10 하위 cwd 보존 — 잠김 |
| M-L worktree 경로를 저장소 **안**(`<repoRoot>/.orca-wt/...`)으로 | worktrees | **green 7** | AC10 "repository 밖" — 잠금 0 |
| M-L' 등록 변이 "repo name을 path에 쓴다"(잔여물 0까지 밀어 typecheck 0·lint 0 error) | worktrees+infra | **green 219 / 28파일** | VP-14 등록 변이 미검출 |
| M-C `GIT_OPTIONAL_LOCKS` 제거 | infra/git+handlers | **red 1** | VP-04 등록 변이 — 검출 |
| M-N `shell: true` 추가 | infra/git | **red 3** | VP-12 등록 변이(shell) — 검출 |
| M-O `addWorktree`에서 queue 우회 | infra/git+worktrees | **green 39** | VP-12 등록 변이(queue bypass) — 미검출 |
| M-D queue key를 `resolve()`만으로 | infra/git | **red 1** | D2 잠금 — 검출 |
| M-E bind를 first-match로 되돌림 | infra/db | **red 1** | D3 잠금 — 검출 |
| M-P session insert ↔ bind 순서 swap | infra/db | **red 1** | VP-10 등록 변이 — 검출 |
| M-G naming try/catch 제거 | worktrees | **red 1** | VP-15 등록 변이 — 검출 |
| M2 `--untracked-files=all` → `=no` | worktrees+infra/git | **red 2** | AC8 — 검출 |
| M-F `base: baseOid` → `'HEAD'` | 전 스위트 | **green 2591** | AC9 — 미검출(r3와 동일) |
| M-H D1 rollback 3줄 제거(미사용 import까지 치워 typecheck 0·lint 0 error) | 전 스위트 | **green 2591** | D1 잠금 0 |
| M-I 격리 칩을 `CwdPanel`에서 삭제 | renderer 81파일 | **green 671** | VP-01 등록 변이 "chip 제거 시 red" 미성립 |
| M-J `ariaPressed` → r3의 `className` 형태로 복귀 | renderer | **green 671** | D4 수정 잠금 0 |
| M-K `fallback: undefined` 복귀 | app 23파일 | **green 209** | D7 수정 잠금 0 |

- 소거 변이 잔여물 수렴: M-A·M-H·M-L'는 미사용 import/변수까지 치운 상태에서 **typecheck 0 error · lint 0 error**다. 잔여물에 걸린 red가 아니라 진짜 침묵이다.
- 구조적 proxy 엄격화: `rg -n "createWorktree|addWorktree|removeWorktree" adapters sessions` = 0줄을 `rg -in "worktree"`로 넓혀 재측정 → 차집합 **1줄**(`adapters/hooks.ts:8`, SDK 훅 이름 주석). 0건은 전수다.
- **D1 rollback 대상 식별 probe**(임시 스위트, 실행 후 삭제): 별칭 managed root(`<link>/managed` → `<real>`)에서 `worktree add` 후 git이 보고한 경로는 `/tmp/orca-id-real-…/repoid/wtid`, 서비스가 구성한 `worktreeRoot`는 `/tmp/orca-id-link-…/managed/repoid/wtid`다. `isWithinDir` 양방향 술어 결과 **NOT FOUND** — r2·r3가 두 라운드에 걸쳐 테스트에서 고친 canonical identity 축이 프로덕션 rollback에 그대로 남았다.
- **취소 rollback 잔여물 probe**: `AbortController`로 add를 3회 취소한 뒤 managed root에 빈 버킷 3개(`[[],[],[]]`)가 남았다. `rm`이 `<repoId>/<worktreeId>`만 지우고 `mkdir(dirname(...))`이 만든 버킷은 남긴다.
- **queue 등록 순서 probe**: 별칭 2개를 연달아 호출한 200라운드 중 **18회**에서 후행 호출이 먼저 큐에 진입했다. 상호배제 probe(별칭 5개 동시, 150라운드)의 최대 동시 실행은 **1**이다.

## 5. V-pair closeout (r4) — `UT → IT → ST → AT`

| Pair | 레벨 | req. | r3 | **r4** | 근거 |
|---|---|---|---|---|---|
| VP-17 | UT | REQUIRED | PASS | **PASS** | 별칭 직렬화 + 다른 repo 병렬 2케이스, M-D red. 상호배제 probe 최대 겹침 1 |
| VP-16 | UT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | untracked만 닫힘(M2 red). managed/external 분류기 여전히 없음 — EP-11 2/3 |
| VP-15 | UT | REQUIRED | PAIR_FAIL(root) | **PASS** | `naming.test.ts`가 normalize·collision·fallback을 최종 branch로 관측, M-G red. EP-10 4분기 |
| VP-14 | UT | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | 하위 cwd는 잠겼으나(M-B) 등록 변이 M-L'가 잔여물 0에서 green. `<userData>` 밖 배치 잠금 0(M-L) |
| VP-13 | IT | REQUIRED | PASS | **PASS** | 실 SQLite insert(null)→bind→`ON DELETE SET NULL` + 모호 보존 케이스 |
| VP-12 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | exec seam 생겨 shell 변이 red(M-N). 등록 변이 둘 중 queue bypass는 green(M-O) |
| VP-11 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 최종 query cwd·unchanged extraDirs 단언 0. M-A green |
| VP-10 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 등록 변이(순서 swap)는 red(M-P). EP-06 3번째 지점(HistoryWriter/app callback) 없음 — bind가 `insertSession` 내부로 접혀 writer 층 관측 0 |
| VP-09 | IT | REQUIRED | BLOCKED_BY:VP-05 | **BLOCKED_BY:VP-05** | IPC→service 통합 요청/args 테스트 부재 |
| VP-08 | ST | REGRESSION | PAIR_FAIL | **PAIR_FAIL** | 음성 절반 전수 성립. 짝인 양성 resume 관측 0 |
| VP-07 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 4상태 중 2(clean·dirty). has-commits·check-failed·호출 순서 관측 0 |
| VP-06 | ST | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | bind 유일성은 닫혔다(M-E). reopen/resume 관측 여전히 0 |
| VP-05 | ST | REQUIRED | PAIR_FAIL(root) | **PAIR_FAIL**(root) | `prepare-worktree.ts` 미생성, M-A green, AC4 rollback 미잠금·별칭 미식별 |
| VP-04 | AT | REGRESSION | PAIR_FAIL | **PASS** | 등록 변이(read env 상실) 검출(M-C red) + `git-cli.test.ts` 포함 회귀 green |
| VP-03 | AT | REQUIRED | BLOCKED_BY:VP-07 | **BLOCKED_BY:VP-07** | handler 경로·결과 union 관측 0 |
| VP-02 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | ENOENT/non-repo fixture 없음. 오류 분류도 여전히 `schema_validation_error` |
| VP-01 | AT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** | 등록 변이 "chip 제거 시 red" 미성립(M-I green) |

- root `PAIR_FAIL`: **VP-05** · **VP-14**. VP-15는 root에서 해제됐다.
- 종속 `BLOCKED_BY`: VP-09 → VP-05 · VP-03 → VP-07.
- 합계: **PASS 4 · PAIR_FAIL 11 · BLOCKED_BY 2 = 17** (r3: PASS 2 · 13 · 2). 구현자 자기보고 `SELF_PASS 3 / SELF_BLOCKED 14`와 대조하면 SELF_PASS 3(VP-14·VP-15·VP-17) 중 **VP-14는 미성립**이다.
- 실행 범위: r4는 재검증이므로 root 실패 pair·종속 pair·이번 변경이 닿은 pair(VP-01·04·10·12·13·14·15·17)와 §15 gate 전건을 실행했다. 변경이 닿지 않은 이전 PAIR_FAIL(VP-02·06·07·08·09·11·16)은 증거 좌표를 참조해 상태만 승계한다.

### AC 재측정

r3에서 바뀐 행만 적는다. 나머지는 §라운드 3 「AT / AC 세부와 합계」가 정본이다.

| AC | r3 | **r4** | 이번 라운드 관측 |
|---|---|---|---|
| AC1 | ✅ | ✅ | 정적 + `runner.test.ts` 직접 관측으로 승격. M-N red |
| AC4 | ❌ | ❌ | 코드는 생겼으나 M-H green, 별칭 root NOT FOUND |
| AC8 | ✅ | ✅ | M2 red 재확인 |
| AC10 | ⚠️ | ⚠️ | 하위 cwd 보존 잠김(M-B red) · `<userData>` 밖 배치 잠금 0(M-L green) |
| AC11 | ⚠️ | ✅ | `naming.test.ts` 2케이스 + M-G red. timeout·invalid 행과 `check-ref` 호출 단언은 여전히 없다(§13 D14) |
| AC12 | ⚠️ | ✅ | 유일 조상만 bind, 모호는 보존 — M-E·M-P red |
| AC17 | ❌ | ✅ | key 정규화 1곳 통합 + 별칭 직렬화 red(M-D). 등록 순서 비결정성은 §13 D11 |
| AC20 | ⚠️ | ⚠️ | `aria-pressed` 배선되고 tone을 `chipSurface`가 소유한다. 칩 관측 0(M-I·M-J green) + Windows 실기 미수행 |

- **합계 재측정**: **✅ 12 · ⚠️ 7 · ❌ 1 = 20**.
  ✅ = AC1·2·5·6·7·8·11·12·16·17·18·19 / ⚠️ = AC3·9·10·13·14·15·20 / ❌ = AC4.
- **자기보고 대조**: plan §19 r4 `✅16 · ⚠️3 · ❌1` ↔ 커밋 trailer `Criteria-Met: 16/20`·`Criteria-Pending: AC3, AC13, AC14, AC15` ↔ INDEX 비고 `✅16 · ⚠️3 · ❌1`. 자기보고 셋은 서로 일치하고 **재측정과 4행 불일치**(AC4는 pending 목록에 없는데 ❌, AC9·AC10·AC20이 ✅로 올라가 있다).

### §10 강제 지점 재열거

| EP | 지점 수 | 잠금 | 근거 |
|---|---|---|---|
| EP-01 renderer 3축 | 3/3 | 부분 | reducer만 red. 칩 삭제는 green(M-I) |
| EP-02 IPC 4축 | 4/4 | — | r3 재열거 승계 |
| EP-03 준비 순서 2곳 | **1/2** | 0 | `prepare-worktree.ts` 여전히 없음 |
| EP-04 Git process 5곳 | 5/5 | 성립 | M-N·M-C red |
| EP-05 migration 2곳 | 2/2 | 성립 | `sync ok: 18 migrations` |
| EP-06 metadata 3곳 | **2/3** | 부분 | bind가 `queries.ts:479` 내부. writer 층 지점 없음 |
| EP-07 lifecycle | 2/2 | 성립 | `removeWorktree` 프로덕션 참조 2건 전부 `service.ts` |
| EP-08 cwd 종단 4좌표 | 4/4 | **0** | M-A green |
| EP-09 path SSOT 2곳 | 2/2 | 부분 | subpath red(M-B) · 배치 green(M-L) |
| EP-10 naming 4분기 | 4/4 | 성립 | M-G red + 충돌/정규화 단언 |
| EP-11 분류 3종 | **2/3** | 부분 | managed/external 분류기 없음 |
| EP-12 mutation 4진입 | 4/4 | 부분 | queue 헬퍼는 red(M-D) · 진입 배선은 green(M-O) |

- 재열거 합계 **9군 지점 수 일치 · 3군 부분**(EP-03 1/2 · EP-06 2/3 · EP-11 2/3). 잠금 0인 군은 EP-08 하나, 부분 잠금 4군(EP-01·EP-09·EP-11·EP-12)이다.
- 구현자 자기보고는 이번 라운드에 총계를 적지 않고 "EP-09·EP-10·EP-12를 신규 test로 관측"만 적었다 — 그 세 군은 재측정과 일치하고, EP-12는 **헬퍼만** 잠겼다.

### 현재 변경의 운영 gate (plan §15)

| Gate | 결과 | 관측한 실행 산출 |
|---|---|---|
| 1 `npm run typecheck` | PASS | node·web·test 3구성, 진단 0줄 |
| 2 `npm run lint` + 트리 확인 | PASS | 0 error · warning 1(기존 `useTranscriptVirtualizer`) · 실행 후 `git status --short` 빈 출력 |
| 3 관련 순수 suite | PASS | `vitest run src/main/features/worktrees src/main/infra/git src/main/infra/db` 등 — 아래 전 스위트에 포함 |
| 4 DB suite | PASS(조건부) | `npm rebuild better-sqlite3`(Node ABI) 후 전 스위트 **258/259 파일 · 2591/2591 케이스**, 클린 트리 8회 반복 전건 green |
| 5 `check-migrations-appendonly.mjs` | PASS | `sync ok: 18 migrations` · `no-copies ok: 810 files` |
| 6 `check-doc-inventory.mjs --check` | PASS | `generated doc ok (9 items, 79 channels)` · prose ok · links ok |
| 7 `git diff --check` | PASS | 출력 0줄 |
| 8 architecture sweep | PASS | 엄격화 후 차집합 1줄(주석), 호출 0 |
| 9 dependency sweep | PASS | `git diff 04ab7ad..e798f27 -- app/package*.json` 빈 diff · shell git 0 |
| 10 Windows 사람 실기 | 미수행 | 이 환경에 Electron 바이너리·Windows 없음 |
| (추가) `node --test scripts/*.test.mjs` | PASS | 59/59 |

- 환경 기인 실패 분리: **1파일 0건 수집** — `app/chat-turn.continuity.test.ts`가 `Electron failed to install correctly`. `app/AGENTS.md §제약 환경`의 알려진 서명이며 이번 변경 무관(격리 코드 참조 0). r1부터 동일하다.
- 게이트가 작업 트리를 바꿨는가: **없음**. `lint --fix` 실행 후 `git status --short` 빈 출력.
- 검증 중 실행한 명령의 잔여물: `npm ci --ignore-scripts`+`npm rebuild better-sqlite3`가 만든 `app/node_modules`(`.gitignore` 대상) 뿐. 임시 probe 스위트 3개는 실행 후 삭제했고 최종 `git status --short`는 verify 산출물만 보여준다.
- **변이 실행 중 관측한 간헐 red 1건**: `mutation-queue.test.ts > serializes filesystem aliases…`가 전 스위트 4회 중 2회 red였다(둘 다 queue와 무관한 파일을 변이한 트리). 클린 트리 8회·단독 22회는 green. 원인은 §13 D11.

## 6. 외부 포트 / 문서 계약

| 계약 | r4 변화 | 결과 |
|---|---|---|
| `orca:session:delete` → `DeleteSessionResult` | zod 실패 fallback이 union 값으로 바뀌었다(`session.ts:103-109`) | 부분 — 잠금 0(M-K), 이유가 `worktree-check-failed`다(§13 D13) |
| `orca:chat:send.worktreeIsolation` | 변화 없음 | PASS |
| `0018_managed_worktrees` | 변화 없음 | PASS |

## 7. 숫자 / 상한 재측정

- 신규 테스트 파일 재측정: r4가 **3개**(`naming.test.ts`·`repository.test.ts`·`runner.test.ts`) 추가 + 3개 보강(`service.test.ts`·`managed-worktrees.test.ts`·`mutation-queue.test.ts`). 누적 신규 9개다.
- plan §14 신규 파일 중 **미생성 1종**: `app/chat-turn/prepare-worktree.ts`(+test). r3의 4종에서 3종이 해소됐다.
- 케이스 수: 전 스위트 2584 → **2591**(+7).
- 상한 재계산: naming 충돌 루프 `naming.ts:40` 상한 9999회 × Git read 2회 — r3와 같다.

## 8. 남은 사람 실기

r3 판정 유지 — **AC20의 Windows Electron 배치·포커스 시각 확인 하나뿐**이다. 나머지 표면(준비 순서·rollback·resume·오류 분류·칩 상태)은 이 환경에서 순수 seam으로 관측 가능하며, 이번 라운드도 그 seam들이 만들어지지 않아 미관측으로 남았다.

## 9. 게이트 재실행

실행 명령과 관측 산출은 §5 「현재 변경의 운영 gate」 표에 있다. 요약: lint 0 error · typecheck 진단 0줄 · vitest 258/259파일 2591케이스 · scripts 59/59 · 문서·마이그레이션·diff gate 전건 green.

## 10. 검증 책임 분리 — 사람 vs 에이전트

r3의 분담과 같다. 이번 라운드에 새로 사람에게 넘긴 항목은 없다.

## 11. Repository operation checks (r4)

- `AGENTS.md` 변경 없음 — 위생 검사 대상 아님.
- INDEX: 단계 `impl`·상태 `IMPL_DONE (V1 r4)`·다음 주체 `Claude (r4 검증)`가 실제 상태와 맞았다. 비고 4줄(≤5). **대상 커밋 좌표는 이번 검증에서 `e798f27`로 기입**했다(`git cat-file -t e798f27` = commit).
- trailer 허용값·파싱: ✅ `git log -1 --format='%(trailers:only=true)' e798f27`가 `Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met`·`Criteria-Pending`·`Verified-By: pending` **6키를 그대로** 돌려준다.
- 인용 해시 실재: `04ab7ad`·`aec9fe9`·`dd9f47c`·`418dc1e`·`a869613`·`e798f27` 전부 commit.
- 이동/삭제한 reference·script: 없음.
- 위반 2건은 §13 D15·D16에 적는다(커밋 언어 · plan 절 소유).

## 12. 구현자 코멘트 대조

| 구현자 r4 기술 | 검증자 판단 | 근거 |
|---|---|---|
| "D1은 porcelain 목록에서 이번 경로를 exact containment로 찾아 remove" | **미성립** | 별칭 managed root에서 NOT FOUND(§4 probe). 잠금도 0(M-H green) |
| "D2는 모든 mutation key를 realpath+normalize" | 성립 | 4진입 전부 `withRepoMutation` 경유, M-D red |
| "D3는 조상 후보가 정확히 하나일 때만 bind" | 성립 | M-E·M-P red |
| "VP-14·VP-15·VP-17 `SELF_PASS`" | **2/3 성립** | VP-14는 등록 변이 M-L'가 green |
| "containment 소거는 `executionCwd != worktreeRoot`와 정확 subpath 단언이 red로 만든다" | 성립 | M-B red |
| "runner는 fake `execFile`로 executable·args·env·shell 부재를 직접 관측" | 성립 | M-C·M-N red |
| "queue alias swap은 두 번째 mutation의 조기 시작을 검출" | 성립하되 비결정 | 등록 순서가 호출 순서가 아니라 같은 단언이 간헐 red다(§13 D11) |
| "D5·D9·send 준비 순서 deferred seam은 닫지 않았다" | 성립 | 코드에서 그대로 확인 |

## 13. Finding disposition / 파생 이슈 (r4)

r3 이슈의 상태 변화와 신규만 적는다. 표 정본은 [`plan.md`](plan.md) `[검증자 기입] 파생 이슈`다.

| # | 상태 | 근거 |
|---|---|---|
| D1 | **open (BLOCKING)** | 잠금 0(M-H) + 별칭 root 미식별(§4 probe) |
| D2 | **closed** | M-D red |
| D3 | **closed** | M-E·M-P red |
| D4 | **closed (잠금 0)** | `aria-pressed` 배선·tone을 `chipSurface`가 소유. M-J green |
| D5 | open | `send.ts:157` 그대로 |
| D6 | open (NEXT_HANDOFF) | `listWorktrees`는 배선됐으나 부팅 reconciliation은 없음 |
| D7 | **closed (잠금 0)** | union fallback 존재. 이유 값 문제는 D13 |
| D8 | open (planner 기록) | 변화 없음 |
| D9 | open | 변화 없음 |
| D10 | open (NEXT_HANDOFF) | 변화 없음 |
| D11 | **신규 NON_BLOCKING** | queue 등록이 비원자적 — 200회 중 18회 순서 역전, 새 단언이 간헐 red |
| D12 | **신규 NON_BLOCKING** | 실패 rollback이 `<managed>/<repoId>` 빈 버킷을 남긴다(취소 3회 → 3개) |
| D13 | **신규 NON_BLOCKING** | 스키마 실패 fallback 이유가 `worktree-check-failed` |
| D14 | **신규 NON_BLOCKING** | AT-11이 열거한 timeout·invalid fixture와 `check-ref` 호출 단언이 없다 |
| D15 | **신규 기록** | 구현 커밋 4건의 제목·본문이 영어다 — `docs/handoff/AGENTS.md §커밋·git 규약`은 한국어 메시지를 규정한다 |
| D16 | **신규 기록** | plan의 `### r4` 구현자 절이 `## [검증자 기입] 파생 이슈` 안에 있다 — 절 소유가 섞였다 |

- `PLAN_GAP`: **없음**. BLOCKING 1건과 pair 미달 13건은 전부 plan이 이미 지정한 계약·oracle을 구현이 만들지 않은 것이다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** r2·r3가 테스트에서 두 라운드에 걸쳐 고친 canonical identity 축이 r4의 프로덕션 rollback(`service.ts:92-94`)에 같은 형태로 나타났다 — 한쪽만 canonical인 두 경로를 비교한다.
- 관련 plan 지침/AC의 존재: **있었다.** `prepare-worktree.ts` seam(§9·§14·EP-03)은 r1부터 네 라운드 연속 미생성이고, r4 구현자는 "이번 수정에서 닫지 않았다"고 명시했다. root VP-05는 검증 두 라운드(r3·r4) 연속 같은 이유로 열려 있고, seam은 구현 r1부터 네 라운드 내내 없다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)과 렌더 하네스 부재(`@testing-library` 0건)가 r1부터 동일하다.
- 라운드 수: **4**(3 초과). r4 앞의 review는 `APPLY` 모드로 B/F 분류 후 지침을 유지했고, 그 뒤 라운드에서도 같은 root pair가 닫히지 않았다.

## 15. 결론 (r4)

- 상태: **FAIL**
- pair: PASS 4(VP-04·13·15·17) · root PAIR_FAIL 2(VP-05·VP-14) · PAIR_FAIL 9 · BLOCKED_BY 2
- PLAN_GAP: 없음 — 다음 주체는 **구현자**
- ACTIVE Decision: D-011 미충족 1건(§13 D1). D-010·D-014는 이번 라운드에 충족됐다
- AC: **✅12 · ⚠️7 · ❌1 = 20** (자기보고 `✅16 · ⚠️3 · ❌1`과 불일치)
- 강제 지점: 9군 일치 · 3군 부분(EP-03·EP-06·EP-11)
- 운영 gate: 10건 중 9건 PASS · 1건(Windows 사람 실기) 미수행. 환경 기인 red 1파일은 변경 무관
- NON_BLOCKING: D5·D9·D11·D12·D13·D14 / NEXT_HANDOFF: D6·D10 / 기록: D8·D15·D16
- 남은 사람 확인: AC20의 Windows Electron 배치·포커스 하나
- 다음 단계: 라운드 5다. 라운드가 다시 3을 초과하므로 **재구현 전 `handoff-review`를 수행한다**. 그 뒤 구현자는 (1) `prepare-worktree.ts` seam으로 VP-05의 준비 순서·rollback oracle을 세우고, (2) D1의 rollback 대상 식별을 canonical 한 축으로 맞추고, (3) VP-14의 `<userData>` 밖 배치와 VP-12의 queue 진입 배선을 잠그고, (4) VP-11의 최종 query cwd·extraDirs 단언과 VP-01의 칩 관측을 만든다


# 라운드 3 — 원문 보존

## 0. 기준선 / plan 변경 확인

- 기준선이 diff로 성립하는가: **예**. 설계 커밋 `04ab7ad`와 구현 커밋 3개가 갈려 있다.
- 구현 커밋의 `plan.md` 변경: `§19 [구현자 기입]` 8필드와 r2·r3 절만. `git show aec9fe9 -- docs/handoff/0209-git-worktree-isolation/plan.md` = §19 한 hunk.
- Decision Ledger 변경: 없음. D-001~D-015 전부 `04ab7ad` 원문 그대로다.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. §7 20행이 `04ab7ad`와 byte-identical(`git diff 04ab7ad..418dc1e -- plan.md`의 hunk가 §19 이후에만 있다).
- V node/pair·requiredness·§10·oracle 변경: 없음. node 17 · pair 17 · EP 12군 불변.
- 채점에 사용할 원 기준: `04ab7ad:V1`의 §3 Decision · §7 AC1~AC20 · §7-A pair 17 · §10 EP-01~EP-12.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 신규 capability, 기준 V `none`, 상속 재구성 불필요 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R/SD/AR/MD NEW·CHANGED 13노드 전부 동레벨 REQUIRED pair 보유 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-04→VP-04, SD-04→VP-08 |
| pair별 path·§10 전수·직접 oracle | 유효 | 17행 모두 production path·oracle·EP 열이 채워져 있다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 구조적 proxy를 쓰는 VP-04·VP-09·VP-11에 변이가 등록돼 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §15에 10개 gate가 열거돼 있고 전부 이번 산출물에 적용된다 |

- root PLAN_GAP: **없음**. 아래 FAIL은 모두 plan이 이미 명시한 oracle을 구현이 만들지 않은 것이지, 구현자가 새 계약을 발명해야 하는 자리가 아니다.
- 다만 plan §16의 "AC 전건 pair 매핑" 주장과 §7-A registry가 어긋난다 — **AC9·AC20을 인용하는 pair 행이 없다**(pair 17행의 AC 인용 집합에 9·20 부재). AC9는 §7 AT-09 행이 oracle을 직접 지정하므로 구현자의 선택 여지는 없다. 다음 revision의 기록 사항으로 §13 D8에 남긴다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path | 충족 |
|---|---|---|---|
| D-001 Git은 Main Host 기능 | Adapter/Runtime이 worktree를 모른다 | `features/worktrees` → `infra/git` | ✅ `rg -in worktree app/src/main/adapters app/src/main/features/sessions` = 1줄, 전부 주석(`hooks.ts:8`) |
| D-002 PATH `git` + `execFile` | shell 미경유·Git 라이브러리 없음 | `infra/git/runner.ts:runGit` 단일 호출부 | ✅ 신규 dependency 0(`git diff aec9fe9^..418dc1e -- app/package*.json` 빈 diff) |
| D-005 tracked+untracked dirty 거부 | mutation 전 종료 | `repository.ts:isClean` `--untracked-files=all` | ✅ M2 변이 red |
| D-006 base = 준비 초기 full OID | branch 이동에 불변 | `service.ts:65 resolveHead` → `addWorktree(base)` | ⚠️ 코드로 성립, 잠금 0(§4 M3) |
| D-008/D-009 naming 실패 강등 | 격리는 계속 성공 | `naming.ts:chooseBranchName` | ⚠️ 코드로 성립, 잠금 0(§4 M5) |
| D-010 nullable row → bind | 동일 row가 세션에 결합 | `queries.ts:insertSession` 내부 `bindManagedWorktreeForCwd` | ⚠️ 결합은 하지만 **유일성 판정이 없다**(§13 D3) |
| D-011 이번 호출 산출물만 rollback | 반쯤 준비된 경로로 Agent 미실행 | `service.ts:90-93` / `service.ts:108-111` | ❌ add 실패 경로가 worktree를 지우지 않는다(§13 D1) |
| D-012 clean+HEAD==base만 자동 제거 | 그 외 전부 보존 | `service.ts:removeForSession` → `handlers/session.ts:105` | ✅ 코드·2상태 테스트 |
| D-013 종료·LRU에 worktree 무명령 | resume cwd 보존 | 소비처 전수 | ✅ `removeWorktree` 프로덕션 참조 3건 전부 `service.ts` |
| D-014 repo 단위 mutation queue | 같은 repo write 직렬 | `mutation-queue.ts` ← checkout·add·remove·branch | ❌ 두 생산자의 key 정규화가 다르다(§13 D2) |
| D-015 extraDirs 원값 유지 | executionCwd만 치환 | `send.ts` payload 통과 | ✅ 코드, 잠금 0 |

### end-to-end 흐름 (실측)

```text
CwdPanel 칩 → chatReducer.SET_WORKTREE_ISOLATION → chatStore.send(worktreeIsolation:true)
  → SendChatMessageSchema.superRefine → send.ts:139 prepare
      → canonicalPath → resolveRepoRoot → isClean → resolveHead
      → chooseBranchName → addWorktree(queue) → insertManagedWorktree
  → buildTurnContext(cwd=executionCwd) → turn.cwd → TurnRequest.cwd → claude.ts query cwd
  → HistoryWriter.persist(session.updated) → insertSession(cwd) → bindManagedWorktreeForCwd
  → session:delete → removeForSession → isClean/HEAD 비교 → removeWorktree → deleteBranch → DB
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 부분 실패가 남는다 | `worktree add` 실패·취소 시 `deleteBranch`만 실행 — 등록된 worktree와 디렉터리가 남는다(§13 D1) |
| false success 가능성 | 있다 | 서비스 성공 여부와 무관하게 `executionCwd`가 worktree 안임을 보는 유일 단언이 항등식이다(§4) |
| partial failure/rollback | 비대칭 | DB insert 실패 경로(`service.ts:108-111`)는 remove+branch+rm 3단, add 실패 경로는 branch 1단 |
| Product/UX의 A가 아닌 B를 구현했는가 | 두 곳 | plan §9의 `prepare-worktree.ts` seam 미생성 · plan §10 DB표의 "유일 row·모호하면 보존"이 first-match로 대체 |
| 증상만 제거하고 상태가 남았는가 | 해당 없음 | — |
| 최적화가 잃은 관측 | 해당 없음 | — |
| 출력/요청 worst-case 상한 | 유계 | naming completion 1회·10초, 충돌 루프 상한 9999(실측 도달 불가), Git read 4~6 + write 1 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 04ab7ad..418dc1e   # 26 파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `infra/git/worktree.ts::listWorktrees` | **미배선** | 프로덕션 0 · 테스트 0. plan §13(취소 후 실제 상태 확인)과 §5(외부 worktree 비교 관측)의 유일한 메커니즘이다 → §13 D1·D6 |
| `infra/git/worktree.ts::parseWorktreeList` | 테스트 전용 | 프로덕션 참조 1건이 `listWorktrees` 자신뿐 — 죽은 가지 안의 잎 |
| `service.ts::PrepareWorktreeResult`·`DeleteManagedWorktreeResult` | 정상 | 정의 파일 시그니처용 타입 export |
| `queries.ts::listUnboundManagedWorktrees*` | 정상 | private stmt, `bindManagedWorktreeForCwd`가 소비 |
| 형제 정책 비대칭 | **결함 1** | `git-cli.ts:repoRoot`는 raw `--show-toplevel`, `repository.ts:resolveRepoRoot`는 `canonicalPath` — 같은 queue key를 다른 정규화로 만든다(§13 D2) |
| producer ↔ consumer 파생 불일치 | 없음 | `DeleteSessionResult`가 main·preload·renderer facade·store 4좌표에서 같은 union |
| 동일 규칙 중복 구현 | SSOT 유지 | branch 문자셋은 `GitBranchNameSchema`(사용자 입력)와 `check-ref-format`(내부 생성)로 역할이 갈린다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 실제 존재: ✅ `git-cli.test.ts`·`handlers/git.test.ts`·`migrate.test.ts` 전건 green.
- structural proxy만으로 통과시킨 AC: **AC3·AC5(cwd 절반)·AC10·AC18** — 아래 소거 변이가 전부 침묵했다.
- **선택된 적대 증거 재측정** — plan §12 등록 변이 7건 중 **검출 3 · 미검출 3 · 실행 불가 1**:

| 변이 | 재현 | 결과 | 판정 |
|---|---|---|---|
| M1 prepare await 제거 | 관측 가능한 스위트 없음 | 실행 불가 | 아래 소거 변이로 대체 |
| M2 untracked 무시 | `--untracked-files=all` → `=no` | **red 2건** | 검출 |
| M2(구현자 보고형) | 플래그 자체를 제거 | **green 4/4** | 보고된 형태는 동작 보존 변이다 — `--porcelain` 기본값이 이미 `??`를 낸다 |
| M3 base OID → `'HEAD'` | `service.ts:87` | **전 스위트 green 2584** | 미검출 |
| M4 Adapter가 worktree 생성 | 정적 sweep | 0줄 | 검출(구조) |
| M5 naming catch 제거 | `naming.ts` try/catch | **전 스위트 green 2584** | 미검출 |
| M6 dirty를 clean 취급 | `removeForSession` dirty 분기 삭제 | **red 1건** | 검출 |
| M7 global queue key | `tails` key 상수화 | **red 1건** | 검출 |

- **추가 소거 변이(검증자 실행)** — 세 건 모두 침묵했다:

| 변이 | 범위 | 결과 |
|---|---|---|
| `send.ts`의 격리 배선 **전체 삭제**(블록 + `cwd: payload.cwd ?? null` 복귀 + 미사용 import 정리) | typecheck 3구성 · lint · 전 스위트 | **전부 green**(0 error, 255/256 파일, 2584/2584) |
| `executionCwd = resolve(actualRoot, subpath)` → `actualRoot`(하위 cwd 보존 제거) | 전 스위트 | **green 2584** |
| VP-04 등록 변이 `runner가 read env를 잃는다`(`GIT_OPTIONAL_LOCKS` 제거) | `infra/git` + `app/handlers` 9파일 | **green 47** |

- 소거 변이의 잔여물 수렴: 배선 삭제 변이는 미사용 import까지 치운 2단계 상태에서 lint 0 error·typecheck 0줄이다. 잔여물에 걸린 red가 아니라 **진짜 침묵**이다.
- 구조적 proxy 엄격화: 구현자의 `rg "createWorktree|addWorktree|removeWorktree"` 0건을 `rg -in "worktree"`로 넓혀 재측정 → 차집합 1줄, `adapters/hooks.ts:8`의 SDK 훅 이름 주석이며 호출이 아니다. **0건은 전수다.**
- `N회`/순서 기준의 관측 주체: 없다. AC3의 "add resolve 전 runtime acquire 미호출"을 관측하는 훅·로그·주입 경계가 코드에 없다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | req. | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-17 | MD-04 ↔ UT-04 / UT | REQUIRED | **PASS** | `mutation-queue.test.ts` 1케이스 + M7 red | canonical root → chain → mutation / EP-12 4/4 진입 |
| VP-16 | MD-03 ↔ UT-03 / UT | REQUIRED | **PAIR_FAIL** | untracked만 닫힘(M2 red). managed/external 분류가 코드에 없다 | EP-11 2/3 |
| VP-15 | MD-02 ↔ UT-02 / UT | REQUIRED | **PAIR_FAIL** (root) | `naming.test.ts` 부재. M5 미검출 | EP-10 4분기 구현·0 잠금 |
| VP-14 | MD-01 ↔ UT-01 / UT | REQUIRED | **PAIR_FAIL** (root) | 유일 단언이 항등식(§4). path table·`<userData>` containment·AC18 단언 부재 | EP-09 2/2 구현·0 잠금 |
| VP-12 | AR-04 ↔ IT-04 / IT | REQUIRED | **PAIR_FAIL** | exec seam 미구현(plan §7 "AC 검증 주의사항"이 요구). 생산자 2개의 key 정규화 상이 | EP-04 5/5 · EP-12 key 불일치 |
| VP-13 | AR-05 ↔ IT-05 / IT | REQUIRED | **PASS** | `managed-worktrees.test.ts` 실 SQLite: insert(null) → bind → `ON DELETE SET NULL` | migration → queries → service / EP-05 2/2 |
| VP-11 | AR-03 ↔ IT-03 / IT | REQUIRED | **PAIR_FAIL** | 정적 절반만(adapter import 0). 최종 query cwd·extraDirs 단언 0 | EP-08 4좌표 구현·0 잠금 |
| VP-10 | AR-02 ↔ IT-02 / IT | REQUIRED | **PAIR_FAIL** | DbQueries 원자성만. HistoryWriter 이벤트 순서 관측 0, 등록 변이(순서 swap) 미실행 | EP-06 2/3 |
| VP-09 | AR-01 ↔ IT-01 / IT | REQUIRED | **BLOCKED_BY:VP-05** | IPC→service 통합 요청/args 테스트 부재 | EP-01~04 |
| VP-08 | SD-04 ↔ ST-04 / ST | REGRESSION | **PAIR_FAIL** | 음성 절반은 전수로 성립(`removeWorktree` 호출부 3건 전부 service). 짝인 양성 resume 관측 0 | EP-07 2/2 |
| VP-07 | SD-03 ↔ ST-03 / ST | REQUIRED | **PAIR_FAIL** | 4상태 중 2(clean·dirty). has-commits·check-failed 관측 0, 호출 순서 단언 0 | EP-06·EP-07 |
| VP-06 | SD-02 ↔ ST-02 / ST | REQUIRED | **PAIR_FAIL** | reopen/resume 미관측. bind가 유일성 판정 없이 first-match(§13 D3) | EP-05 2/2 · EP-06 2/3 |
| VP-05 | SD-01 ↔ ST-01 / ST | REQUIRED | **PAIR_FAIL** (root) | 배선 전체 삭제가 green(§4). AC4 rollback 자체도 불완전(§13 D1) | EP-03 1/2 — `prepare-worktree.ts` 미생성 |
| VP-04 | R-04 ↔ AT-19 / AT | REGRESSION | **PAIR_FAIL** | 양성 회귀는 green(전 스위트 2584). 등록 변이(read env 상실) 미검출 | EP-04 5/5 |
| VP-03 | R-03 ↔ AT-15 / AT | REQUIRED | **BLOCKED_BY:VP-07** | handler 경로·결과 union 관측 0 | EP-06·EP-07 |
| VP-02 | R-02 ↔ AT-14 / AT | REQUIRED | **PAIR_FAIL** | ENOENT/non-repo fixture 없음. 후속 send 생존 관측 0 | EP-03·EP-08 |
| VP-01 | R-01 ↔ AT-02 / AT | REQUIRED | **PAIR_FAIL** | reducer 절반만(`chatReducer.worktree.test.ts`). 칩 관측 0 — 등록 변이 "chip 제거 시 red"가 성립하지 않는다 | EP-01 3/3 구현 |

- root `PAIR_FAIL`: **VP-05**(송신 경로 seam·oracle 부재) · **VP-14**(항등 단언) · **VP-15**(naming oracle 부재).
- 종속 `BLOCKED_BY`: VP-09 → VP-05 · VP-03 → VP-07.
- 합계: **PASS 2 · PAIR_FAIL 13 · BLOCKED_BY 2 = 17**. 자기보고 `SELF_PASS 17/17`과 불일치.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V의 REQUIRED/REGRESSION 17건 전건 + §15 gate 10건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 execFile 배열·shell=false | ✅ | `runner.ts:29` 단일 execFile 호출부 · shell git 0건 · 신규 dep 0 |
| AC2 신규 세션만·기본 off | ✅ | `chatReducer.worktree.test.ts` 3단언 재실행 green |
| AC3 Agent 실행 전 생성 | ⚠️ | `send.ts:139-160` prepare await가 `startNew`·`acquireTurnRuntime`보다 앞. 관측 oracle 0 |
| AC4 실패·취소 시 이번 산출물만 rollback | ❌ | add 실패 경로가 worktree를 제거하지 않는다(`service.ts:90-93`) |
| AC5 Adapter는 executionCwd만 | ✅ | 정적 sweep 0(엄격화 후에도) · typecheck 3구성 green |
| AC6 Runtime 구조 불변 | ✅ | `session-runtime.ts`·`turn-coordinator.ts` diff 0 · 전 스위트 green |
| AC7 신규 일반 세션 전용 | ✅ | `protocol.worktree.test.ts` 4조합 재실행 green |
| AC8 tracked+untracked dirty 거부 | ✅ | `service.test.ts` untracked 케이스 + M2 red |
| AC9 base = 최초 HEAD OID | ⚠️ | 코드로 성립. M3 미검출 — 잠금 0, 인용 pair 0 |
| AC10 repo 밖 UUID 경로 + 하위 cwd 보존 | ⚠️ | 경로 구성은 코드로 성립. **하위 cwd 보존은 잠금 0**(소거 변이 green) |
| AC11 naming 실패가 격리를 실패시키지 않음 | ⚠️ | 코드로 성립. M5 미검출, 테스트 파일 없음 |
| AC12 null row → 동일 row bind | ⚠️ | bind는 성립(`managed-worktrees.test.ts`). 동일성 보장이 cwd 포함 first-match |
| AC13 resume 동일 cwd · 종료 시 미제거 | ⚠️ | 미제거는 전수로 성립. resume은 `turn-context.ts:63` 독해뿐 |
| AC14 Git 오류가 해당 send 오류 | ⚠️ | 코드로 성립. 테스트 0. 사유가 `schema_validation_error`로 분류된다(§13 D5) |
| AC15 clean+HEAD==base만 제거 | ⚠️ | 4상태 중 2 관측 |
| AC16 external 무mutation | ✅ | 삭제 대상이 managed row에서만 나온다 — 구조로 성립(설계한 분류기는 미배선) |
| AC17 같은 repo 직렬·다른 repo 병렬 | ❌ | queue 단위는 green. **두 생산자의 key 정규화가 달라 Windows에서 갈린다**(§13 D2) |
| AC18 extraDirs 원값 | ✅ | `send.ts:179` payload 통과 — 코드로 성립, 잠금 0 |
| AC19 기존 Git 의미 유지 | ✅ | `git-cli.test.ts` 포함 전 스위트 2584 green |
| AC20 한국어·키보드 접근 | ⚠️ | ko/en 키 2쌍 존재 · `<button>` 실체. 토글 상태가 `aria-pressed` 없이 색으로만 표현된다(§13 D4) |

- **합계 재측정**: **✅ 9 · ⚠️ 9 · ❌ 2 = 20**. 자기보고 `✅19 · ⚠️1 · ❌0` — **불일치**.
- **합계 사본 대조**: plan §19 `19/20` ↔ 커밋 trailer 3개 `Criteria-Met: 19/20` ↔ INDEX 비고 `19/20` — 자기보고끼리는 일치, 재측정과 불일치.

### pair별 plan §10 강제 지점 분모 (검증자 재열거)

| EP | plan이 적은 지점 | 코드에서 확인 | 결과 |
|---|---|---|---|
| EP-01 renderer 3축 | reducer·store·CwdPanel | 3/3 | PASS |
| EP-02 shared/preload 4축 | ipc·protocol·preload type·renderer api | 4/4 (`index.d.ts`가 `OrcaApi` 파생) | PASS |
| EP-03 준비 순서 2곳 | `send.ts` + `prepare-worktree.ts` | **1/2** — seam 모듈 미생성 | PAIR_FAIL(VP-05) |
| EP-04 Git process 5곳 | runner·repository·worktree·git-cli·handler | 5/5 | PASS |
| EP-05 migration 2곳 | 0018 SQL + migrate.ts | 2/2 (`check-migrations-appendonly` sync ok: 18) | PASS |
| EP-06 metadata 3곳 | DbQueries + HistoryWriter/app callback + service | **2/3** — bind가 `insertSession` 내부로 접혔다 | PAIR_FAIL(VP-06·VP-10) |
| EP-07 lifecycle | session handler + shutdown/supervisor 전수 | 2/2 | PASS |
| EP-08 cwd 종단 4좌표 | prepare→context→request→query | 4/4 | PASS(잠금 없음) |
| EP-09 path SSOT 2곳 | paths + service mapping | 2/2 | PASS(잠금 없음) |
| EP-10 naming 4분기 | prompt·normalize·collision·fallback | 4/4 | PASS(잠금 0 → VP-15) |
| EP-11 분류 3종 | porcelain · HEAD/base · managed/external | **2/3** — 세 번째 분류기 미배선 | PAIR_FAIL(VP-16) |
| EP-12 mutation 4진입 | checkout·add·remove·deleteBranch | 4/4 진입, **key 정규화 1/2 생산자** | PAIR_FAIL(VP-12) |

- 재열거 합계 **9군 일치 · 3군 부분**(EP-03 1/2 · EP-06 2/3 · EP-11 2/3). 자기보고 `12/12군`과 불일치.
- 표 밖인데 같은 불변식이 필요한 지점: 없음.

### 현재 변경의 운영 gate (plan §15)

| Gate | 결과 | 관측한 실행 산출 |
|---|---|---|
| 1 `npm run typecheck` | PASS | node·web·test 3구성, 출력 0줄 |
| 2 `npm run lint` + 트리 확인 | PASS | 0 error · warning 1(기존 `useTranscriptVirtualizer`) · `git status` 변화 없음 |
| 3 관련 순수 suite | PASS | `vitest run src/main/features/worktrees src/main/infra/git src/main/infra/db …` = **10파일 75케이스** |
| 4 DB suite | PASS(조건부) | `npm rebuild better-sqlite3`(Node ABI) 후 전 스위트 **255/256 파일 · 2584/2584 케이스** |
| 5 `check-migrations-appendonly.mjs` | PASS | `sync ok: 18 migrations` · `no-copies ok: 807 files` |
| 6 `check-doc-inventory.mjs --check` | PASS | `generated doc ok (9 items, 79 channels)` · prose ok · links ok |
| 7 `git diff --check` | PASS | 출력 0줄 |
| 8 architecture sweep | PASS | 엄격화 후 차집합 1줄(주석), 호출 0 |
| 9 dependency sweep | PASS | package/lock diff 0 · shell git 0 |
| 10 Windows 사람 실기 | 미수행 | 이 환경에 Electron 바이너리·Windows 없음 |
| (추가) `node --test scripts/*.test.mjs` | PASS | 59/59 |

- 환경 기인 실패 분리: **1파일 0건 수집** — `app/chat-turn.continuity.test.ts`가 `Electron failed to install correctly`. `app/AGENTS.md §제약 환경` 의 알려진 서명이며 변경 무관이다. 이 스위트는 이번 변경의 어떤 pair도 인용하지 않는다(격리 코드 참조 0).
- 게이트가 작업 트리를 바꿨는가: **없음**. `lint --fix` 실행 후 `git status --short` 빈 출력.
- 검증 중 실행한 명령의 잔여물: `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`가 `app/node_modules`를 만들었다. 추적 대상이 아니며(`.gitignore`) 커밋에 섞이지 않았다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `orca:session:delete` → `DeleteSessionResult` | ✅ main·preload·facade·store 동일 union | ⚠️ `handle(..., {fallback: undefined})`가 zod 실패 때 `undefined`를 돌려준다 — 타입은 union이다(§13 D7) | 부분 |
| `orca:chat:send.worktreeIsolation` | ✅ `IPC_CONTRACT.md` 갱신됨 | ✅ superRefine 4조합 test | PASS |
| `0018_managed_worktrees` | ✅ `persistence.md` 갱신됨 | ✅ 실 SQLite FK 동작 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 신규 테스트 파일 재측정: **6개**(service·mutation-queue·worktree·managed-worktrees·protocol.worktree·chatReducer.worktree) + `migrate.test.ts` 기대값 1행. plan §14가 예고한 신규 test는 9종이다.
- plan §14 신규 파일 중 미생성: `runner.test.ts` · `repository.test.ts` · `naming.test.ts` · `mutation-queue` 외 `prepare-worktree.ts`+test — **4종**.
- 0건 게이트의 정당한 예외 보존: `rg -in worktree` 차집합 1줄이 SDK 훅 이름 주석이다. 지워야 할 항목이 아니다.
- 상한 재계산: naming 충돌 루프는 최대 9999회 × Git read 2회. 실제 도달 조건(같은 slug 9999 branch)은 없지만 상한이 시간으로 유계가 아니다 — §13 D9.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 가능 범위(미구현) | 남은 사람 실기 |
|---|---|---|
| 준비 순서 AC3/AC4 | `prepare-worktree.ts` seam을 만들면 deferred promise로 순서·rollback 전부 UT | 없음 |
| naming AC11 | `complete`/`validate`/`exists` 주입 포트가 이미 인자다 — fixture만 있으면 전건 UT | 없음 |
| path AC10 | `subpath != ''` fixture 한 줄이면 잠긴다 | 없음 |
| Git 인자/env AC1·AC17 | `runGit`에 `execFile` 주입 인자를 두면 args·env·queue 순서 전부 관측(plan이 이미 요구) | 없음 |
| 칩 AC2/AC20 | 렌더 하네스는 없지만 `CwdPanel.landing.test.ts`의 소스 스윕 선례가 있다 | Windows 포커스·배치 시각 확인 |

- "UI/electron이라 불가"로 남길 항목은 **AC20의 시각·포커스 실기 하나뿐**이다. 나머지는 전부 순수 seam이다.

## 9. 게이트 재실행

실행 명령과 관측 산출은 §5 「현재 변경의 운영 gate」 표에 있다. 요약: lint 0 error · typecheck 0줄 · vitest 255/256 파일 2584 케이스 · scripts 59/59 · 문서·마이그레이션·diff gate 전건 green.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 실행 — 위 산출 |
| AC ↔ production path 1:1 | 에이전트 — 20행 재대조, 재측정 합계 §5 |
| 레이어/계약/문서 링크 | 에이전트 — boundaries lint 0 error, doc-inventory links ok |
| 제품 의도 / Open Question | 없음 — 이번 라운드에 사용자 결정 필요 항목 0 |
| UI 시각 품질 | 사람 — AC20 Windows 실기 |
| 신규 의존성 | 해당 없음 — 0건 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 변경에 `AGENTS.md` 수정 없음 — 위생 검사 대상 아님.

### INDEX 보드 정합성

- 상태·다음 주체·라운드: 이번 커밋에서 `verify/FAIL` · `Codex` · 라운드 4로 갱신했다.
- 대상 커밋 좌표: 검증자가 기입 — `aec9fe9`(r1) · `dd9f47c`(r2) · `418dc1e`(r3). 넷 다 `git cat-file -t` = commit.
- 비고 5줄 이내: 갱신한 0209 행을 5줄 이내로 적었다.

### Commit / reference 정합성

- trailer 허용값: ✅ 세 구현 커밋 모두 `Agent: codex` · `Status: implemented` · `Criteria-Met/Pending` · `Verified-By: pending`.
- trailer 파싱: ✅ `git log -1 --format='%(trailers:only=true)' <각 커밋>`이 적힌 5키를 그대로 돌려준다.
- 인용 해시 실재: ✅ `04ab7ad`·`aec9fe9`·`dd9f47c`·`418dc1e` 전부 commit.
- 재구현 라운드 `[구현자 기입]` 7필드: **r2·r3 절이 4~5줄 산문 5항목**이다 — 강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제가 개별 필드로 없다. r3의 "AC/V/EP 분모는 r2와 같다" 한 줄이 세 필드를 대신한다.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "M2는 service test dirty case red" | **미성립** | 보고된 형태(`--untracked-files=all` 제거)는 동작 보존 변이다 — 재현 시 4/4 green. 충실한 형태(`=no`)는 red |
| r2 "문자열 prefix proxy를 path containment 술어로 교체" | 타당하나 무효 | 술어는 옳아졌지만 fixture의 `subpath`가 `''`이라 단언이 `isWithinDir(x, x)` 항등식이다 |
| r3 "child와 parent 모두 canonical identity" | 타당하나 무효 | identity 단계는 맞춰졌다. 같은 항등식이 남아 잠그는 것이 없다 — 소거 변이 green |
| "V pair SELF_PASS 17/17" | **미성립** | 재측정 PASS 2 |
| "강제 지점 12/12군" | **부분 미성립** | 재열거 9군 일치 · 3군 부분 |
| NON_BLOCKING D1/D2(외부 worktree·branch 정리 후속) | 타당 | §13에 승계 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `worktree add` 실패·취소 시 worktree를 제거하지 않는다 — `deleteBranch`만 실행하고 등록 entry·디렉터리가 남는다(`service.ts:90-93`). plan §13의 `listWorktrees`로 실제 상태 확인 후 조건부 rollback이 미배선 | D-011 · AC4 · VP-05 | **BLOCKING** | 구현 |
| D2 | 같은 repo의 두 mutation 생산자가 다른 queue key를 만든다 — `git-cli.ts:repoRoot`는 raw `--show-toplevel`, `repository.ts:resolveRepoRoot`는 `canonicalPath`. POSIX에서는 두 값이 일치(실측)하지만 Windows의 `C:/…` ↔ `path.win32.normalize` `C:\…`는 다른 Map key다 | D-014 · AC17 · VP-12 · EP-12 | **BLOCKING** | 구현 |
| D3 | bind가 `worktree_root`가 cwd의 조상인 **첫** unbound row를 잡는다(`queries.ts:bindManagedWorktreeForCwd`). plan §10 DB표는 "유일 row … 모호하면 보존+로그"를 요구한다. 미bind orphan이 남은 뒤 사용자가 그 디렉터리를 cwd로 고르면 무관한 세션이 그 row를 가져가고, 그 세션 삭제가 남의 worktree를 지운다 | D-010 · AC12 · VP-06 | **BLOCKING** | 구현 |
| D4 | 토글 칩이 상태를 색으로만 알린다 — `aria-pressed` 없음. 또한 `ComposerChip`의 `className` 계약("색·테두리·높이는 chipSurface가 소유, 여기서 덮지 않는다")을 `border-accent text-accent`로 위반한다 | AC20 · VP-01 | NON_BLOCKING | 구현(다음 라운드에 함께) |
| D5 | Git/dirty 거부가 `makeClassifiedError('schema_validation_error', …)`로 나간다(`send.ts:157`). 스키마 오류가 아니다 | AC14 · VP-02 | NON_BLOCKING | 구현 |
| D6 | `listWorktrees`·`parseWorktreeList`가 프로덕션 미배선(참조 0). D-013의 부팅 reconciliation과 §5의 external 비교 관측이 코드에 없다 | D-013 · AC16 | NEXT_HANDOFF | 후속 handoff |
| D7 | `session:delete` 핸들러가 `{fallback: undefined}`인 채 `DeleteSessionResult`를 반환 타입으로 선언한다 — zod 실패 시 renderer가 `undefined.ok`를 읽는다 | AC15 | NON_BLOCKING | 구현 |
| D8 | plan §16은 AC 전건 pair 매핑을 주장하지만 §7-A registry에 AC9·AC20을 인용하는 pair 행이 없다 | plan §7-A | 기록 | planner(다음 revision) |
| D9 | naming 충돌 루프 상한이 9999회 × Git read 2회다. 도달 조건은 비현실적이나 시간으로 유계가 아니다 | 성능 | NON_BLOCKING | 구현 |
| D10(승계) | 외부 worktree UI·orphan 관리 · add 실패 후 branch 잔여 | 구현자 D1·D2 | NEXT_HANDOFF | 후속 |

- `PLAN_GAP`: **없음**. 위 BLOCKING 3건과 pair 미달 13건은 전부 plan이 이미 지정한 계약·oracle을 구현이 만들지 않은 것이다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** r2·r3 두 라운드가 같은 한 단언(`service.test.ts`의 containment)만 고쳤고, 그 단언은 이번 재측정에서 항등식으로 확인됐다. 세 라운드에 걸쳐 잠금이 늘지 않았다.
- 관련 plan 지침/AC의 존재 여부: **있었다.** `prepare-worktree.ts` seam(§9·§14·EP-03)과 `execFile` 주입 seam(§7 "AC 검증 주의사항")은 plan이 명시했고, 둘 다 미구현이다. 이 두 seam의 부재가 VP-05·VP-09·VP-11·VP-12의 oracle 부재와 같은 원인이다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)이 r1부터 이번 라운드까지 동일하다. 렌더 하네스 부재(`@testing-library` 0건)도 반복 조건이다.

## 15. 결론

- 상태: **FAIL**
- pair 결과: PASS 2(VP-13·VP-17) · root PAIR_FAIL 3(VP-05·VP-14·VP-15) · PAIR_FAIL 10 · BLOCKED_BY 2
- PLAN_GAP: 없음 — 다음 주체는 구현자다
- Product/UX 및 ACTIVE Decision: D-011·D-014·D-010 세 건 미충족(§13 D1·D2·D3). 나머지 12건은 코드로 성립
- AC: ✅ 9 · ⚠️ 9 · ❌ 2 = 20 (자기보고 19/20과 불일치)
- 현재 변경 운영 gate: 10건 중 9건 PASS · 1건(Windows 사람 실기) 미수행. 환경 기인 red 1파일은 변경 무관
- NON_BLOCKING: D4·D5·D7·D9 / NEXT_HANDOFF: D6·D10 / 기록: D8
- repository operation checks: trailer·해시·INDEX는 정합. `[구현자 기입]` r2·r3 절이 impl §8의 7필드를 갖추지 못했다
- 남은 사람 확인: AC20의 Windows Electron 배치·포커스 시각 확인 하나뿐
- 다음 단계: 라운드 4다. **재구현 전에 `handoff-review`를 수행한다**(라운드 3 초과). 그 뒤 구현자는 (1) `prepare-worktree.ts`와 `runGit`의 주입 seam을 만들어 VP-05·VP-09·VP-11·VP-12의 oracle을 세우고, (2) D1·D2·D3를 고치고, (3) VP-14·VP-15·VP-16의 fixture를 `subpath != ''`·naming failure matrix·managed/external로 채운다
