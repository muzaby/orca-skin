# Verify — 0324-execution-contexts-ui-responsiveness

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0324-execution-contexts-ui-responsiveness` |
| 검증자 | Claude Code |
| 일자 | 2026-11-17 |
| 대상 커밋/range | `9692a27..f721452` (브랜치 `ccr-0a6bce24-ydkmn4`, 53커밋 · `app/` 427파일 +24,041 −6,904) |
| 구현 전 plan 기준 | `57dc0f8`(첫 plan) · 채점 기준 revision `a352543`(rev 4.5) |
| V mode / 유효 V | `Baseline V: V1` rev 4.5(rev 3 ~ 4.5 정정은 같은 V1 의 revision) |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** — 이행 결함 0 · 현재 결함 0 · `PLAN_GAP` 2(확장 1 · plan 내부 정합 1) |
| 확장 창 | verify 1회째 — 창 안 |
| 독립 축(⑥) | 구현자 sweep 이 한 번도 건드리지 않은 production 파일 4개(`shell/orphans.ts` · `shell/lifecycle-state.ts` · `preload/host-port.ts` · 감독자 옛 child·종료 분기)에 변이 17 → 17 잡음. 별도로 EP-6 규칙 칸을 구현한 diff 자리 7 → 못 잡음 1(D1) |
| 열거 sweep(⑦) | 1회째 전수 — 구현자 spec 224(r1.16~r1.18 evidence 합본, 같은 ID 는 마지막 판) + 구현자 spec 이 없는 EP-2″·EP-21′·EP-22·EP-6 규칙 칸 31 + EP-1″ 가드 규칙 표 21 = 276 · 못 잡음 1(C1) · `동치` 3 · 좁은 oracle green 1(E9-1 — 넓힌 E9-1r 잡음) |
| 발견 분류 | 이행 0 · 현재 0 · 확장 1(막음 1 / 후보 표 0) · plan 내부 정합 1 · 비귀속 2(NON_BLOCKING) |
| 구현 주체·문맥 | 구현 Claude(여러 세션) · 설계 Claude — 설계자 = 검증자라 plan validity 는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋(`Status: implemented|partial|blocked`) 21개의 `plan.md` hunk 를 전부 봤다 — 20개는 `[구현자 기입]` 절 추가뿐이다. 예외 `e0db58b` 은 Ledger 에 D-033 을 **OPEN** 으로 추가했다(사용자 턴 12 의 질문 기록). 다음 설계 커밋 `0177ca7` 이 확정했다. AC·완화는 없다.
- 기준선이 diff 로 성립한다 — 설계 정정은 모두 `Status: designed` 커밋(`aba5b2a`·`c07bc73`·`60b62fc`·`0e8894e`·`940742f`·`9bca8ac`·`5070995`·`3bba4c1`·`326731c`·`a352543`)이고 구현과 분리돼 있다.
- Decision Ledger: rev 4.5 의 D-049·D-055·D-056 은 사용자 승인(2026-11-17 "3건 승인")이다. 무단 변경 없음.
- 채점 기준: `a352543` 의 AC 50 · 유효 pair · §10(EP-1~EP-24, 각 rev 의 ′·″ 판).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V · revision 합성 | 유효 | rev 마다 "대체 범위" 절이 옛 행 → 새 행을 적는다(§7-B~§7-J) |
| NEW/CHANGED ↔ REQUIRED pair | 유효 | rev 4.5 NEW 3(R-13·AR-16·MD-11) ↔ VP-45~47 · 앞 rev 의 self-review 대조 줄과 일치 |
| INHERITED ↔ REGRESSION | 유효 | VP-20·VP-30·VP-31·VP-22″·VP-22 |
| §10 자리 목록 — 검색 재실행 | 유효(재실행한 행) | EP-4′ `6·4` · EP-17′ `5` · EP-23 `13` · EP-24 `12`(+ `boot-report.ts:118-122` 로그 이름 3줄, 자리 아님) — 목록과 차집합 0. EP-23 술어를 `sessionMeta??\.\w+` 로 넓혀도 더 나온 7줄은 지역 행 필드(`resolve-turn.ts:141` 등)다 |
| 적대 증거 선택 | 유효 | VP-02·12·21·32·46 등록 변이 재실행 red(§4) |
| `SUPERSEDED` 이관 | 유효 | VP-14 → AC19′·VP-39 · VP-06 → VP-06′(§7-B self-review 491행) |
| 운영 gate | 유효 | §7-A 표 + rev 4.3 스모크 |
| **ACTIVE Decision ↔ AC** | **PLAN_GAP (D2)** | D-007 의 "UI 스레드에 남는 반복 작업은 5ms 마다 양보" 에 AC·§10 이 없다. 대조 줄(§3 갱신 메모)은 D-007 ↔ AC5·6·7(50/160)만 잇는다. 코드의 `UI_YIELD_INTERVAL_MS`(`shared/perf-budget.ts:9`)는 참조 0 |
| oracle 좌표 실재 | 비귀속 1(D3) | AC16·VP-16·EP-6 규칙 칸이 `shared/data-host-chunks.test.ts` 를 가리키지만 실재 파일은 `shared/data-host.test.ts`(규칙 칸 4분기 케이스 있음) |

- §10 검색 명령 재실행은 위 4행만 했다. EP-1~EP-22 의 나머지 행은 구현자 r1.17 재실행 기록과 sweep red 로 갈음했다(못 본 것).

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path(관측) |
|---|---|---|
| D-034~D-042 (B) | 셸 = 창·OS·감독 · 에이전트 호스트 = 실행 · 데이터 호스트 = DB·설정·비밀 | `index.ts` → `createHostBoot` → 감독자 2(`index.ts:344-404`) · 가드 `check-ui-thread: OK` · 스모크 `OK — 데이터 → 에이전트 기동 · 피어 · 창 포트 요청 · 에이전트 → 데이터 종료` |
| D-055 (rev 4.5) | 끝나지 않는 기동은 90초 뒤 기동 실패 · DB 단계 동안은 세지 않음 | `host-supervisor.ts:104-118` 마감 · `data-host/bootstrap.ts:405-425` `boot.step` · `index.ts:358-363` 배선 |
| AC24′ | 채널마다 소유 프로세스 하나 · 호스트 채널은 포트로 | `preload/index.ts:142-231` `ownerOf` · 스모크 `agent oo:settings:get: error — No handler registered`(남의 채널 거부) |
| AC15~17 | 본문은 조각으로 · 취소면 다음 조각 없음 | `data-host/session-load.ts:65-95` · `preload/session-load.ts` |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실패 방식 — 기동 | 확인 | 조립 `start()` 거부 → `host.start.failed` + `exit(1)`(`host-process.ts:108-117`) — DB 단계 중 던져도 멈춤 상태로 남지 않는다 |
| 실패 방식 — 마감 | 확인 | 만료 → `kill` → exit → `handleExit` 기동 실패 수(`host-supervisor.ts:107-113,140-163`). 에이전트 호스트 `start()` 의 유일한 await 는 하네스 버전 확인이고 `timeout: 15000`(`opencode/v1/server.ts:166`) |
| false success | 없음 | 마감 만료는 기존 준비 전 exit 와 같은 경로 — 새 성공 경로가 없다 |
| A 가 아닌 B | 아니오 | 사용자 결정 3건이 그대로 반영됐다(D-049·D-055·D-056) |
| 최적화가 잃은 관측 | 없음 | 조각 전송은 조각 사이 양보 뒤 취소·창 닫힘을 다시 본다(`session-load.ts:79-80`) |
| worst-case 상한 | 확인 | 한 조각 ≤ 500 part, 넘는 메시지는 단독(`shared/data-host.ts:44-63`) · 마감 최악 대기 90초 × 3 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9692a27..HEAD` — 값 export 후보 25.

| 후보 | 판정 | 근거 |
|---|---|---|
| `UI_YIELD_INTERVAL_MS` | 죽은 상수 → D2 | `git grep` 참조 0(정의 1줄) |
| `HOST_ENVIRONMENT_ARG` · `ShellMirrorSchema` · `SessionLoadRequestIdSchema` · `serializeToolServer` · `STALL_SEVERE_MS` · `UI_TASK_BUDGET_MS` | 정상 | 같은 파일 안에서 쓰는 export(참조 3~4, 스모크가 `HOST_ENVIRONMENT_ARG` 를 대조) |
| 테스트 전용 · `sendChannel`(`test-transport.testfixture.ts`) | 정상 | 테스트 픽스처 |
| 나머지(`selectClaudePlugins`·`VAULT_PREFIX` 등) | 비귀속 | `origin/main` 에도 있는 export |

## 4. 증거 재측정

- **등록 변이(①)**: VP-02(등록 표 1행 삭제 G1b · 개수 초과 G1)·VP-12(`handlePlain` 계측 제거 P2)·VP-21(채널 소유 맞바꿈 E8 행)·VP-32(규칙 (h) 확장 G2)·VP-46(셸 배선 E24-9a·9b·9c) — 전부 red.
- **직전 못 잡음·동치(③)**: 이번이 첫 verify 라 직전 verify 이력이 없다. 구현자 기록의 `동치`·못 잡음 행은 ⑦에서 다시 돌렸다.
- **이전 잡음 대조(④)**: 구현자 r1.16~r1.18 spec 전부를 재실행 — red → green 0. r1.14 M01~M28 은 spec 이 남지 않아 같은 자리를 P1~P7·K1~K6·W3 으로 다시 심었다(전부 red).
- **독립 축(⑥)**: §메타 — 17/17 잡음. 구현자 spec 이 한 줄도 없는 production 파일 중 감독·수명·포트 클라이언트를 골랐다.
- **열거 sweep(⑦)**: 아래 표. 하네스 `mutate.py`, 원복은 실행마다 `# 원복 확인: 모든 파일 원문 그대로` + 마지막 `git status` 깨끗함.
- 실행 방식: 시간 때문에 E10-7 이후 vitest oracle 에 `--bail=1` 과 기준선 실패 9파일 `--exclude` 를 붙였다(기준선 red 파일은 변이를 구별하지 못한다). spec 원문은 `evidence/verify1/sweep-impl.jsonl`(수정 전 oracle), 결과는 `sweep-impl.tsv`.

**고장 이력(요약 — 행 전체는 `evidence/verify1/*.tsv`)**

| 묶음 | 자리 | 시도 | 결과 | 비고 · 분류 |
|---|---|---:|---|---|
| 구현자 spec 합본(EP-3·4′·7′·8·8′·9·10′·11·12·13·14·15·17·17′·18·19·23·24 · RG·LG · 회귀) | spec 의 `file` | 224 | 잡음 220 · green 2 · SKIP 2 | 아래 4행 |
| E9-1 | `shell/electron-hosts.ts` `trusted: () => true` | 1 | green | r1.16 첫 실행의 좁은 oracle 이다. 같은 변이를 넓힌 E9-1r 은 잡음(`host-assemblies.order.test.ts` 배선 검사) — 잡음으로 센다 |
| E24-r1 | `host-supervisor.ts:106` `!deps.isReady \|\|` 제거 | 1 | 동치 | 준비 판정이 없으면 같은 `ensureRunning` 안에서 `becomeReady` → `clearReady`(`:179·:195·:128`)가 타이머를 바로 지운다 |
| E24-8d·8e | 만료 콜백의 같은 child·멈춤 조건 | 2 | SKIP → 동치 | 구현자가 조건을 지웠다(r1.18 설계 리뷰). child 가 바뀌는 길(`handleExit` `:142`)과 멈춤(`:117`)이 모두 `clearReady` 를 먼저 부른다. 규칙 칸 8행 '재기동 뒤 옛 child' 케이스가 있다 |
| P1~P7 (EP-2″) | `infra/ipc/handle.ts` 계측 3 · 라벨 · source / `peer-link.ts` notify·request·source | 7 | 잡음 7 | 이행 대상 — 잠김 |
| R1~R8 · K1~K6 (EP-21′) | `data-host/agent-requests.ts` 확보↔비확보 맞바꿈 5 · 갱신·env·취소 배선 / `session-hooks.ts` 맞바꿈 4 · 잊기 · 미연결 기본값 | 14 | 잡음 14 | 형제 슬롯(⑤) 맞바꿈 포함 |
| W1~W3 (EP-22) | `send.ts:526` 창 감시 · `host-port-server.ts` `port.onClose(close)` · `chatStore.ts:1848` | 3 | 잡음 3 | |
| C2~C7 (EP-6 규칙 칸) | `shared/data-host.ts` 경계 `>=` · 마지막 조각 · part 초기화 · 조립 검사 3 | 6 | 잡음 6 | |
| **C1 · C1b** | `shared/data-host.ts:52` `current.length > 0 &&` 제거 | 2 | **못 잡음** | 첫 메시지가 500 part 를 넘으면 빈 조각 `[]` 이 앞에 생긴다. 넓힌 oracle(C1b 461케이스)도 green → **D1 확장** |
| G1~G20 · G1b (EP-1″ · VP-02/13/27″/32) | `scripts/ui-thread-rules.mjs` 금지 목록 제거 11 · 허용 목록 제거 9 · 등록 개수 | 21 | 잡음 21 | oracle `check-ui-thread.test.mjs` + 실제 트리 가드, 원본 트리에서 exit 0 확인 |
| V1~V17 (⑥) | `orphans.ts` 4 · `lifecycle-state.ts` 5 · `preload/host-port.ts` 6 · 감독자 2 | 17 | 잡음 17 | |

- 검산: 시도 294 = 구현자 224 + 보충 31 + 가드 21 + 독립 17 + C1b 1 → 잡음 288 · 못 잡음 2(C1·C1b — 같은 변이) · 동치 3(E24-r1·8d·8e) · 좁은 oracle green 1(E9-1, 같은 변이의 E9-1r 은 잡음 288 안). `못 잡음` 은 변이 하나, 발견 D1 하나다.
- 형제 슬롯 맞바꿈(⑤): EP-21′ 확보/비확보 9 · `source` ipc/peer 2 · 채널 소유(E8) — 전부 잡음.
- 동작 보존 추출 라운드 아님.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair 묶음 | 레벨 | 결과 | 직접 증거(이번 턴 관측) |
|---|---|---|---|
| MD: VP-15·16·17·18·19·28·29·36·47 | UT | PASS(VP-16 은 D1 확장 공백 별도) | `client.test.ts` · `shared/data-host.test.ts` · `stall-monitor.test.ts` · `check-ui-thread.test.mjs` · `inline.test.ts` · `lifecycle-state.test.ts`(V5~V9) · `orphans.test.ts`(V1~V4) · `host-supervisor.test.ts` '준비 마감'(E24-1~8c) |
| AR: VP-10·11′·12′·13·21′·23′·24·25·26·27″·33′·34·35′·37′·38·39·40·41·42·43·46 | IT | PASS | sweep 묶음별 red — EP-8·8′(E8)·9(E9-2~5·1r·3r)·10′(E10)·11(E11)·15(E15)·17·17′(E17·E17h)·18(E18)·21′(R·K)·23(E23)·24 ④⑤⑨~⑫ · `channel-registration.test.ts` · 스모크 |
| SD: VP-08·09′·22·22″·44·45 · REGRESSION VP-20·30′·31 | ST | PASS | `host-supervisor.test.ts` · `boot.test.ts`(E19·E12) · `preload/session-load.test.ts` · `data-host/session-load.test.ts`(E4) · `chatStore.busyGuards.test.ts`(W3) · RG-1·2 · 기준선과 같은 실패 외 전체 vitest green |
| R: VP-01·02·03′·04·05′·06′·21′·32·45 | AT | PASS(사람 실기 VP-07 제외) | `check-doc-inventory --check` OK · 가드 테스트 · AC 표 아래 |
| VP-07 (AC22·AC23) | AT | 사람 실기 대기 | Electron 바이너리 없음 — §8 |

- root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.
- 좌표 판정의 한계: 자리마다 "실행 구간 안 · 운반 값 구별 · 분기 입력" 을 테스트 본문으로 읽어 확인하지는 않았다. 근거는 그 자리에 심은 변이의 red 다. red 는 바뀐 항만 잠근다 — 운반 항이 여럿인 자리(예: EP-15 F1 필드)는 구현자 sweep 의 항별 변이가 있는 행만 닫힌 것으로 셌다.

### AC 합계

- `✅ 48 · ⚠️ 2 · ❌ 0 = 총 50` — ⚠️ 는 AC22·AC23(사람 실기). AC50 은 E24 sweep 28/28(동치 3 포함) + 스모크 `begin → end → ready` 판정.
- 사본 대조: plan r1.18 `48/50` = 커밋 `f721452` `Criteria-Met: 48/50` = INDEX 비고 `AC 48/50` — 일치.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| `npm run lint` | PASS | 오류 0 · 경고 3(React Compiler 기존) · 트리 변화 0(`git status` 깨끗) |
| `npm run typecheck` | PASS | node·web·test exit 0 |
| `vitest run`(필터 없음) | PASS(기준선 분리) | 1026파일 · 9749케이스 — 실패 22 · 오류 1. `origin/main`(9692a27) worktree 에서 같은 9파일 → 실패 22, `FAIL` 줄 차집합 양방향 ∅. 원인: `process.platform === 'win32'` 전용 플러그인 제어(`claude/native-resources.ts:38-39`) · `C:/` 절대 경로(Linux) — 다른 OS 전용 경로. 규칙 가드 실패 0 |
| `node --test scripts/*.test.mjs` | PASS | 72 suites · 1000 pass · 0 fail |
| 가드 5종 | PASS | migrations OK · doc-inventory prose·links OK · product-naming `2433파일` · test-budgets `18 real-git suites ok` · `check-ui-thread: OK` |
| `npx electron-vite build && node scripts/smoke-hosts.mjs` | PASS | 빌드 `✓ built` · 스모크 OK(피어 전 조기 요청 · 소유 채널 4 · 남의 채널 거부 1) |
| message-bus | PASS | 구현 커밋 trailer 파싱 확인(`f721452`·`07ea496`·`656662a`) |

## 7. 숫자 / 상한

- AC 분모 50 = rev 4.5 표의 AC 행 합(§7 35행 − ′ 대체 + §7-B~§7-J 추가) — 구현자 검산 줄과 같다.
- 구현자 sweep 누계 `168 + 15 + 28 + 6 + 25` ↔ evidence jsonl 고유 ID 224(같은 ID 재정의 제외) — 재실행 행을 별도 ID(`*r`)로 둔 것까지 합쳐 맞는다.

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC22 | 멈춤 기록 계측 경로(EP-2″ P1~P7 · `stall-monitor.test.ts`) | Windows 실기 8시나리오 `perf.stall` 집계 |
| AC23 | worker 스레드 스모크로 두 호스트 번들 기동·요청·종료 | `build:win` 설치본에서 강조 1 · 세션 열기 1 · 전송 1 |

## 11. Repository operation checks

- INDEX: 행 상태 `impl/IMPL_DONE` · 다음 주체 Claude 하나 — 실제와 일치. 이번 verify 로 `verify/RETURN_TO_PLAN` · 라운드 2 · 다음 주체 Claude(설계)로 바꾼다.
- 대상 커밋 좌표: 자리표시자 28개의 커밋은 모두 브랜치 `ccr-0a6bce24-ydkmn4` 에 있고(`git cat-file -t` commit) **`origin/main` 의 조상이 아니다**(미병합). 그래서 main 좌표로는 채울 수 없다. INDEX 칸은 범위와 미병합 표기로 바꾸고 라벨별 해시는 아래에 둔다 — 병합 뒤 main 해시로 교정한다.

| 라벨 | 브랜치 해시 |
|---|---|
| r1 · r1.2 | `bbb3953` · `4df2836` |
| rev 3 · r1.3 · D-033 | `aba5b2a` · `e0db58b` · `0177ca7` |
| r1.4 · rev 3.1 | `09408c0` `f7fc1bb` `ed7d762` `ef09352` · `c07bc73` |
| rev 3.2 · r1.5 | `60b62fc` · `42a354f` `e173861` |
| r1.6 · rev 3.3 | `a2621b3` `0a44431` · `0e8894e` |
| r1.7 · r1.8 | `c96c464` `ea9b4ab` `fcf0a33` · `a48df96` `612bf21` `35e3441` |
| rev 4 · rev 4.1 | `aaefa73` `940742f` · `9bca8ac` `f71c866` |
| r1.9~r1.13 | `d7cd39f` `0ed491c` `ce164c6` · `3b069d9` `4ff94bf` · `016823f` `25ddb92` `707dbb8` `6a76c61` `db1cbe4` · `e827005` · `6c2f01c` `91e24da` |
| rev 4.2 · r1.14 · rev 4.3 · r1.15 | `5070995` · `aab8008` `0a7aa83` · `3bba4c1` · `d0f7dda` `eba031a` `7090791` |
| r1.16 · rev 4.4 · r1.17 · rev 4.5 · r1.18 | `4de8784` `711797f` `656662a` · `326731c` · `07ea496` · `a352543` · `f721452` |

- `[구현자 기입]` r1.17·r1.18 7필드 전부 있음. r1.18 강제 지점 표는 EP-24 12자리 전부를 담는다.
- trailer: 허용값 · 파싱 OK. `e0db58b` 은 `Co-Authored-By` 모델명이 다른 세션이지만 형식 위반은 아니다.

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | `splitSessionMessages` 가 첫 메시지만으로 500 part 를 넘으면 빈 조각 `[]` 을 먼저 만든다. `shared/data-host.ts:52` 의 `current.length > 0 &&` 를 지워도 461케이스 green(C1·C1b). 조립 결과는 같지만 빈 조각 통지 1회와 `chunked.chunks` +1 이 생긴다 | 확장 — EP-6 규칙 칸은 700-part 메시지를 가운데에 둔 입력만 적는다("part 700 인 메시지 하나 → 단독 조각"). 첫 자리 분기는 열거 밖이다 | VP-16 · AC16 | PLAN_GAP | 설계자: 규칙 칸에 "첫 메시지가 상한 초과 → 조각 1(빈 조각 없음)" 채택, 또는 경계 선언 |
| D2 | D-007 의 "UI 스레드에 남는 반복 작업은 5ms 마다 양보" 에 AC·§10 이 없다. 상수 `UI_YIELD_INTERVAL_MS` 는 참조 0 | plan 내부 정합 — ACTIVE Decision 조항에 대응 AC 가 없다(§3 대조 줄은 D-007 ↔ 50/160 만) | D-007 · VP-03′ | PLAN_GAP | 설계자: 이 조항이 덮는 반복 작업과 AC 를 정하거나, 범위 밖으로 선언하고 죽은 상수 처리를 정한다 |
| D3 | AC16·VP-16·EP-6 규칙 칸의 oracle 파일명 `shared/data-host-chunks.test.ts` ↔ 실재 `shared/data-host.test.ts` | 비귀속(문서 표류) — 케이스는 규칙 칸 4분기를 모두 갖는다 | AC16 | NON_BLOCKING | D1 정정 때 같이 고친다 |
| D4 | 첫 기동이 마감으로 끝난 에이전트 호스트는 스스로 다시 뜨지 않는다 — 다음 창 요청(`connectAgent`)이 띄운다(`boot.ts` `onExited`). renderer 부팅 단계 `main-ready` 는 10초 필수 마감(`app/boot/steps.ts:22-24`)이라 90초 마감보다 먼저 부팅 오류를 보인다 | 비귀속 — EP-19 기존 동작(구현자 r1.18 놓친 문제 1) · renderer 10초 마감은 0077 동작 | AC50 · AC31′ | NON_BLOCKING | 기록. 큰 DB 마이그레이션 동안 renderer 가 10초에 실패를 보이는지는 제품 판단 — 설계자 참고 |

## 14. Review Signals — 사실만

- verify 1회째. impl 턴 r1~r1.18(사용자 지시로 verify 3회까지 review 없음).
- 독립 축(⑥) 발견 0 · 규칙 칸 diff 자리 변이에서 확장 1(D1).
- 구현자 sweep 의 범위 밖이던 EP-2″·EP-21′·EP-22 는 r1.14 표에만 기록되고 spec 이 없어 재실행이 불가능했다 — 이번에 다시 심었다.
- 환경: Electron 바이너리 없음 · 기준선 실패 22케이스는 Windows 전용 경로.

## 15. 결론

- 상태: **RETURN_TO_PLAN** — `PLAN_GAP` 2(D1 확장 · D2 plan 내부 정합). 이행·현재 결함은 0 이라 구현 쪽 재작업 의무는 없다.
- verify 횟수: 1회째 — 확장 창 안.
- pair: REQUIRED·REGRESSION PASS(VP-07 사람 실기 제외) · root PAIR_FAIL 0.
- AC: 48/50(사람 실기 2).
- 운영 gate: 전부 PASS(vitest 22 는 기준선·다른 OS 경로).
- 다음 단계: 설계자가 D1·D2 를 rev 4.6 으로 정한다(채택이면 구현 턴, 경계 선언만이면 "규범 변경만 — 구현 없음"으로 verify 2회째).
- 남은 사람 확인: AC22·AC23.
