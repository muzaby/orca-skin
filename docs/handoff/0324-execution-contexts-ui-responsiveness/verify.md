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

---

# 라운드 2 — verify 2회째 (rev 4.6 · r2)

**판정: RETURN_TO_PLAN** — 이행 결함 0 · 현재 결함 0 · `PLAN_GAP` 3(plan 내부 정합 1 · 확장 2). V1-D1~D4 는 닫혔다. 구현 쪽 재작업 의무는 없다.

## R2-메타

| 항목 | 값 |
|---|---|
| 검증자 · 일자 | Claude Code · 2026-11-17 |
| 대상 커밋/range | `1c28e1f..c7a35d2` — `b5428c1`(rev 4.6 설계) · `c7a35d2`(r2 구현). 브랜치 `ccr-e635f216-7pe888`, `origin/main` 조상 아님 |
| 구현 전 plan 기준 | `b5428c1`(rev 4.6) — 구현 커밋의 `plan.md` hunk 는 `[구현자 기입] r2` 절 추가뿐(AC·Decision 변경 0) |
| V mode / 유효 V | `Baseline V: V1` rev 4.6 |
| 라운드 | 2 |
| 확장 창 | verify 2회째 — 창 안. 이번 판정 뒤의 설계 턴이 열거 원문을 늘릴 수 있는 마지막 턴이다 |
| 독립 축(⑥) | 구현자 spec 밖 변이 7(X1~X7) — 절 모양 4(이름 위치 · 절 분할 · 머리 수준 · 다른 문단 언급) · AC51 값 조항 1 · part 0 메시지 2 → 잡음 4 · 못 잡음 3(F1·F2) |
| 열거 sweep(⑦) | diff 범위 + 직전 실패 — 구현자 spec 22(C1~C10 · n1~n3 · m1~m5 · s1 · T1~T3) 재실행 · 직전 못 잡음/동치 4(C1b · E24-r1 · 8d · 8e) |
| 원본 | `evidence/verify2/`(`rerun-impl` · `rerun-guard` · `prev` · `indep` 의 `.jsonl`·`.tsv`) — 매 실행 `# 원복 확인: 모든 파일 원문 그대로` · 끝에 `git status` 깨끗함 |

## R2-0. Plan validity (rev 4.6)

| 검사 | 판정 | 근거 |
|---|---|---|
| CHANGED·NEW ↔ REQUIRED | 유효 | R-01′·AT-51 ↔ VP-01′ · AT-16′ ↔ VP-05″ · MD-02′ ↔ VP-16′. production 동작 변경 0 이라 INHERITED 회귀 0 |
| §10 자리 검색 재실행 | 유효 | EP-6′ `data-host.ts:44`·`:73` → 2 · EP-25 `perf-budget.ts:5`·`:7`·`:11`·`:13` → 4 + 문단 `execution-model.md:109` · EP-22′ 1·1·1 — 목록과 차집합 0 |
| EP-25 범위 | 유효 | `execution-model.md` 전체의 백틱 `*_MS` 는 4줄 — 절 밖 1줄(`:27` `HOST_READY_TIMEOUT_MS`)은 규칙 칸이 제외한다 |
| 선택 적대 증거 | 유효 | VP-16′ C1 · VP-01′ m1~m5 등록 |
| **AC51 동작 기준 ↔ 규칙 칸** | **PLAN_GAP (F1)** | 동작 기준의 "(값은 적지 않는다 — 정본은 그 파일이다)" 에 대응하는 규칙 칸 분기·검증 수단이 없다. 판정 술어(절 안 숫자는 지금도 `1건` · `0324` 2줄)를 구현자가 정할 수 없다 |
| 인용 좌표 실재 | 유효 | `preload/session-load.test.ts:53` · `host-port-server.test.ts:120`·`:151` — `rg` 로 확인 |

## R2-1. diff 비판 검토 · 역방향

| 질문 | 판정 | 근거 |
|---|---|---|
| production 동작 변경 | 없음 | `c7a35d2` 의 `app/src` prod diff 는 `perf-budget.ts` 주석 3줄 |
| 문서 규칙(`docs/AGENTS.md` 작성 규칙 2·4) | 지킴 | 값·개수 없음 — `check-doc-inventory --check` prose ok. `0324 D-057` 은 출처 표기 |
| 테스트가 production 을 읽는가 | 예 | EP-25 케이스는 `perf-budget.ts` · `execution-model.md` 실제 파일을 읽는다(합성 입력은 절 경계 1건만) |
| 새 export · 미배선 | 없음 | 새 export 0. `UI_YIELD_INTERVAL_MS` 참조 0 은 D-057 이 정한 상태(B37) |

## R2-2. 증거 재측정

| 하한 | 범위 | 결과 |
|---|---|---|
| ① 등록 변이 | VP-16′ C1 · VP-01′ m1~m5 | 6/6 red |
| ② 닫는 이슈 인용 변이 | V1-D1 의 C1 · C1b | 2/2 red — C1 은 새 케이스 1건 실패, C1b 는 462 중 1 실패 |
| ③ 직전 못 잡음·동치 | C1b · E24-r1 · E24-8d · E24-8e | C1b red · E24-r1 green → **동치 유지**(`host-supervisor.ts` 미접촉, 근거는 라운드 1 §4) · 8d·8e SKIP(원문 없음 — 라운드 1 동치 그대로) |
| ④ 이전 잡음 재실행 | diff 가 닿은 oracle 파일 — `check-ui-thread.test.mjs`(G1~G20 · G1b 21) · `data-host.test.ts`(C2~C7 6) | 27/27 red — red → green 0. 공용 설정·setup·헬퍼 변경 없음 |
| ⑤ 형제 맞바꿈 | EP-25 기준 뜻 문장(s1) | green → **F3** |
| ⑥ 독립 축 | X1~X7 | 아래 표 |
| ⑦ 열거 sweep | 구현자 spec 22 | 잡음 21 · green 1(s1) |

**고장 이력 (라운드 2)**

| ID | 자리 | 종류 | 바꾼 내용 | 직전 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|---|
| C1~C10 | `shared/data-host.ts` 분할·조립 | 제거·뒤집기·빈 값 | 구현자 spec 그대로 | C1 못 잡음 · C2~C7 잡음 · C8~C10 새 | 잡음 10 | `data-host.test.ts`(C1: '첫 메시지가 상한을 넘어도 빈 조각은 없다 …') | 이행 — 잠김 |
| n1~n3 · m1~m5 · T1~T3 | `execution-model.md` 절 · `perf-budget.ts` · 검사 경계 | 제거·다른 값 | 구현자 spec 그대로 | 새 | 잡음 11 | `check-ui-thread.test.mjs` EP-25 케이스 | 이행 — 잠김 |
| s1 | 기준 문단 뜻 문장 | 맞바꿈 | 두 기준의 뜻 맞바꿈(이름 집합 같음) | 새(구현자 `경계`) | **못 잡음** | — | **확장 → F3** |
| G1~G20 · G1b | `scripts/ui-thread-rules.mjs` | 제거·다른 값 | r2 `rerun-guard` 그대로 | 잡음 | 잡음 21 | 가드 테스트 + 실제 트리 가드 | 이행 — 잠김 |
| C1b | `data-host.ts:53` 가드 제거(넓은 oracle) | 제거 | — | 못 잡음 | 잡음 | 같은 새 케이스 | 이행 — 잠김 |
| E24-r1 | `host-supervisor.ts:106` `!deps.isReady \|\|` | 제거 | — | 동치 | green | — | 동치(코드 미접촉) |
| E24-8d·8e | 만료 콜백 조건 | 제거 | — | SKIP·동치 | SKIP | — | 동치(원문 없음) |
| X1 | 양보 문단 | 제거 | 이름 `UI_YIELD_INTERVAL_MS` → "일정 간격" | 새(⑥) | 잡음 | EP-25 | — |
| X2 | 절 | 다른 값 | 기준·양보 문단 사이에 `## 사이` | 새(⑥) | 잡음 | EP-25 | — |
| X3 | 절 머리 | 다른 값 | `##` → `###` | 새(⑥) | 잡음 | EP-25 | — |
| X5 | 기준 문단 | 다른 값 | 키워드 없는 문단에도 `UI_YIELD_INTERVAL_MS` | 새(⑥) | 잡음 | EP-25 | — |
| X4 | 기준 문단 | 다른 값 | `` `UI_TASK_BUDGET_MS`(50ms) `` — 값 기입 | 새(⑥) | **못 잡음** | — | **plan 내부 정합 → F1** |
| X6 | `data-host.ts:53` | 다른 값 | `current.length > 0` → `parts > 0` | 새(⑥) | **못 잡음**(3,699 green) | — | **확장 → F2** |
| X7 | `data-host.ts:61` | 다른 값 | 마지막 조각 `current.length > 0` → `parts > 0` | 새(⑥) | **못 잡음**(3,699 green) | — | **확장 → F2** |

- 검산: 시도 22 + 21 + 4 + 7 = 54 → 잡음 47(구현자 21 · 가드 21 · C1b 1 · 독립 4) · 못 잡음 4(s1 · X4 · X6 · X7) · 동치 3(E24-r1 · 8d · 8e).
- X6·X7 oracle 은 `data-host.test.ts` · `preload/session-load.test.ts` · `data-host/session-load.test.ts` · `src/renderer` 전체(3,699케이스).
- part 0 메시지는 production 에서 만들어진다 — `adapters/claude/native-history-map.ts:186`·`:215` `parts: []`. 다만 원본 코드의 분할은 맞다(현재 결함 아님) — 원본 동작으로 재현되는 결함이 없다.

## R2-3. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거(이번 턴) |
|---|---|---|---|
| VP-16′ | UT | PASS(F2 확장 공백 별도) | EP-6′ 규칙 칸 11분기 ↔ `data-host.test.ts` 케이스 7 + it.each 3 + 새 1 · C1~C10 red |
| VP-05″ | ST·AT | PASS | EP-6′ 위 + AC16′ preload 좌표 `:53` · AC20′·AC49 좌표 `host-port-server.test.ts:151`·`:120` — 전체 vitest green 집합 안 |
| VP-01′ | AT | PASS(F1 · F3 별도) | AT-01 `check-doc-inventory --check` exit 0 · AT-51 EP-25 자리 ①~⑤ — n1~n3 · m1 · m4 · m5 red |
| 나머지 REQUIRED·REGRESSION | — | PASS(좌표 참조) | production 동작 변경 0 · 라운드 1 §5 좌표 파일이 이번 전체 vitest·`node --test` 에서 통과 |
| VP-07 (AC22·AC23) | AT | 사람 실기 대기 | Electron 바이너리 없음 |

- root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.
- AC: ✅ 49 · ⚠️ 2(AC22·AC23) · ❌ 0 = 51. 사본 대조 — plan r2 `49/51` = `c7a35d2` `Criteria-Met: 49/51` = INDEX 비고 `✅49·⚠️2/51` 일치.

## R2-4. 운영 gate (마지막 트리 `c7a35d2`)

| Gate | 결과 | 증거 |
|---|---|---|
| 가드 5종 | PASS | migrations ok · doc-inventory `generated doc ok` · prose ok · links ok(exit 0, `app/` 에서) · product-naming `2433파일` · test-budgets `18 real-git suites ok` · `check-ui-thread: OK` |
| `npm run lint` | PASS | 0 error · 3 warning(기존 React Compiler) · 트리 변화 0 |
| `npm run typecheck` | PASS | exit 0 |
| `node --test scripts/*.test.mjs` | PASS | 72 suites · 1001 pass · 0 fail |
| `vitest run`(필터 없음) | PASS(기준선 분리) | 1026파일 · 9750케이스 — 실패 22(9파일) · 오류 1(`native-resources.ts:152`). 같은 9파일을 `b5428c1` worktree 에서 돌려 실패 22 · `FAIL` 줄 차집합 양방향 ∅. 원인은 라운드 1 과 같은 win32 전용 경로. 이번 변경 파일과 교집합 0 |
| `electron-vite build` + `smoke-hosts.mjs out/main` | PASS | `built in` 3 · `OK — 데이터 → 에이전트 기동 · 피어 · 창 포트 요청 · 에이전트 → 데이터 종료` |

## R2-5. Repository operation checks

- `[구현자 기입] r2` 7필드 전부 있음 — 강제 지점 표는 EP-6′ 2 · EP-25 5 · EP-22′ 3 을 담는다.
- trailer: `c7a35d2` · `b5428c1` 파싱 OK(`git log -1 --format='%(trailers:only=true)'` 가 적힌 키를 그대로 돌려준다).
- 대상 커밋: `1c28e1f`(verify 1) · `b5428c1`(rev 4.6) · `c7a35d2`(r2) — `git cat-file -t` commit · 브랜치 `ccr-e635f216-7pe888` 조상 · `origin/main` 조상 아님(미병합). INDEX 자리표시자를 이 해시로 채우고 미병합을 표기한다.
- 구현자의 s1 `경계` 판정이 인용한 실패 의미 칸은 "문단의 나머지 표현(React 지연 렌더 설명)" 이다 — 기준 문단까지 덮는다고 읽으려면 해석이 필요해 확장으로 바꿨다(F3).

## R2-13. Finding disposition

| # | finding | 분류 · 근거 | 귀속 | disposition |
|---|---|---|---|---|
| F1 | 절에 기준값을 적어도 green(X4) | plan 내부 정합 — AC51 동작 기준 "(값은 적지 않는다 — 정본은 그 파일이다)" 에 규칙 칸 분기·검증 수단이 없다(oracle 없는 AC 조항). 술어(무엇이 값인가)를 구현자가 정할 수 없다 | VP-01′ · AC51 | PLAN_GAP |
| F2 | part 0 메시지 입력이 없어 분할 가드 둘의 `parts > 0` 대체가 green(X6·X7) | 확장 — EP-6′ 규칙 칸의 입력은 모두 part ≥ 1 메시지다. 원본 동작은 맞다 | VP-16′ · EP-6′ | PLAN_GAP(창 안) |
| F3 | 기준 문단 뜻 맞바꿈이 green(s1) | 확장 — 규칙 칸은 이름 집합만 적는다. 실패 의미 칸의 경계 문장은 양보 문단의 React 설명을 예로 든다 | VP-01′ · EP-25 | PLAN_GAP(창 안) |

- 셋 모두 production 동작에는 영향이 없다. 설계자가 항목마다 채택(열거에 넣음) 또는 경계 선언을 정한다 — 경계 선언만이면 "규범 변경만 — 구현 없음"으로 verify 3회째에 갈 수 있다.

## R2-14. Review Signals — 사실만

- verify 2회째 · RETURN_TO_PLAN 2회 연속. 라운드 1 의 막은 발견(빈 첫 조각 · 5ms 조항)은 닫혔다.
- 이번 발견 3건 중 2건은 독립 축(⑥), 1건은 구현자가 `경계`로 적은 자기 sweep 행의 재분류다. 셋 다 rev 4.6 이 이번에 더한 규칙 칸(EP-6′·EP-25)의 잠금 공백이다.
- 다음 verify 는 3회째(창 밖) — PASS 가 아니면 `handoff-review` 진입 조건.
- 환경: Electron 바이너리 없음 · 기준선 실패 22 는 라운드 1 과 같다.

## R2-15. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 3(F1 plan 내부 정합 · F2·F3 확장). 이행·현재 결함 0.
- pair: REQUIRED·REGRESSION PASS(VP-07 사람 실기 제외) · AC 49/51.
- 다음: 설계자 rev 4.7 — F1~F3 를 채택하거나 경계로 선언한다. 열거 원문을 늘릴 수 있는 마지막 설계 턴이다.
- 남은 사람 확인: AC22·AC23.

---

# 라운드 3 — verify 3회째 (rev 4.7 · r3)

**판정: RETURN_TO_PLAN** — `PLAN_GAP` 4(확장 · §7-M 사용자 결정 ΔV 의 창 안) · 이행 결함 1(V3-F1, `BLOCKING`) · 현재 결함 0. 사용자 실측 결함(sandbox preload `require("zod")`)은 기계 범위에서 닫혔다. V2-F1·F2 는 잠겼고 F3 은 경계 B38 로 닫혔다.

## R3-메타

| 항목 | 값 |
|---|---|
| 검증자 · 일자 | Claude Code · 2026-11-17 |
| 대상 커밋/range | `e412f5f..7374af8` — `49d6bba`(rev 4.7 설계) · `2e5aee4`·`ccac6bd`·`9be2707`·`19297f4`·`6eb3bd3`·`7374af8`(r3 구현). 브랜치 `ccr-529aa736-wcu5s4`, `origin/main` 조상 아님 |
| 구현 전 plan 기준 | `49d6bba`(rev 4.7) — 구현 커밋의 `plan.md` hunk 는 `[구현자 기입] r3` 절 추가뿐(`git diff 49d6bba..7374af8 -- plan.md` 의 Part I/II 변경 0) |
| V mode / 유효 V | `Baseline V: V1` rev 4.7(§7-L · §7-M) |
| 라운드 | 3 |
| 확장 창 | verify 3회째 — §7-L 노드(AT-16″·AT-51′·MD-02″·UT-02″, 출처 verify 2 발견)는 **창 밖**. §7-M 은 사용자 결정 ΔV(얇은 preload · 실패 화면)라 NEW·CHANGED 노드(R-14·AT-52·R-15·AT-53·AR-17·IT-17·MD-12·UT-12·AR-06″·AT-24″) 범위는 그 ΔV 뒤 첫 verify — **창 안** |
| 창 밖 새 열거 항목의 출처 | §7-L = verify 2 F1(plan 내부 정합) · F2·F3(창 안 확장의 채택·경계) — rev 4.7 은 verify 2회째 뒤 첫 설계 턴이라 동결 전이다. §7-M = 사용자 실측 결함 + 사용자 결정 2건 |
| 독립 축(⑥) | 구현자 spec 밖 변이 8(Y1·Y2·Y5·Y7·Y9~Y12) — 잡음 2 · 못 잡음 6 |
| 열거 sweep(⑦) | 구현자 spec 148행(sweep 79 · 보강 9 · 재앵커 13 · verify 2 잡음 재실행 47)을 같은 명세로 재실행 + ③ 4행 |
| 원본 | `evidence/verify3/`(`axes` · `impl-all` 의 `.jsonl`·`.tsv`) — 매 실행 `# 원복 확인: 모든 파일 원문 그대로` · 끝에 `git status` 깨끗함 |

## R3-0. Plan validity (rev 4.7)

| 검사 | 판정 | 근거 |
|---|---|---|
| NEW·CHANGED ↔ REQUIRED | 유효 | §7-L CHANGED 4 ↔ VP-01″·VP-05‴·VP-16″ · §7-M NEW 8·CHANGED 2 ↔ VP-48~51·VP-21″·VP-23″ + VP-24′ · INHERITED 상위 VP-07(사람 실기) |
| §10 자리 검색 재실행 | 유효 | EP-26 13줄 → ①~⑦(`preload/index.ts:26`·`:32`·`:35`·`:40`·`:48`·`:50`·`:54`·`:56`·`:61`·`:69`·`:71`·`:76`·`:78`) · EP-27 코드 7줄(`install.ts:19`·`:36`·`:42`·`:44`·`:57`·`:70`·`:88`) · EP-29 9줄 · EP-8″ 정의 밖 2줄 + import 2 · EP-28 `:105`·`:119` · EP-25′ ⑥ 숫자 줄 1(`(0324 D-057)`) — 구현 보고와 차집합 0 |
| 선택 적대 증거 | 유효 | VP-16″ C1·X6·X7 · VP-01″ m1~m5·v1·v2·k1·k2 · VP-49 P1~P5 · VP-50 S1~S4 · VP-51 B1·B2 · VP-32 H1 · VP-21″ 소유 표 변이 |
| `SUPERSEDED` 이관 | 유효 | VP-21′·23′·24 → ″·′ — 옮긴 테스트의 케이스 이름 유지(`transport/*.test.ts` 에서 `rg -n` 로 확인) |
| 운영 gate 열거 | 유효 | §7-A + `smoke-preload` · `check-doc-inventory --check` |

## R3-1. diff 비판 검토 · 역방향

| 질문 | 판정 | 근거 |
|---|---|---|
| 실측 결함 해소 | 예(기계 범위) | 빌드 산출 `out/preload/index.js` 15.35 kB · `grep -oE 'require\("[^"]+"\)\|import\('` → `require("electron")` 1 · `zod` 0 · `smoke-preload` OK |
| 모듈 평가 시점의 `window.oo` | 안전 | 옛 구조는 preload 가 renderer 스크립트 전에 `window.oo` 를 뒀고, 지금은 `main.tsx` 의 `installOo()` 뒤다. renderer 비테스트 소스의 최상위 `window.oo`·`*Api.*(` 호출 0(괄호 깊이 0 줄 스캔) — 구독 22자리는 모두 함수 안(`subscribe*`·훅) |
| 설치 순서에 기대는 소비자 | **잠금 없음 → V3-F2** | `connectMainErrorReports(api = errorBridge())` 는 기본 인자를 호출 때 평가한다(`mainErrorBridge.ts:11`) — `installOo()` 를 그 뒤로 옮기면 main 오류 보고 구독이 조용히 0 이 된다(Y5, 522케이스 green) |
| 옛 포트 닫기의 새 이음매 | **잠금 없음 → V3-F3** | AC33′ "옛 포트를 닫는다" 는 `host-port.ts` 가 `ClientPort.close` 를 부르는 것까지만 잠긴다. 실제 `MessagePort.close` 로 잇는 `install.ts` `wrapPort.close` 를 비워도 green(Y2) |
| 새 export · 미배선 | 없음 | `installOo` → `main.tsx:14` · `rootElement` → `main.tsx:23` · `OoBridge` → `install.ts`·`window.d.ts` · `HOST_PORT_MESSAGE` 정의 1 · 다시 내보냄 1 · 송신 1 · 수신 1 |
| 보안 경계 | 선언대로 | 다리는 셸 채널만(`channelOwner !== 'shell'` → throw) · 페이지가 포트를 쥐는 것은 B41·B42 선언 경계 |

## R3-2. 증거 재측정

| 하한 | 범위 | 결과 |
|---|---|---|
| ① 등록 변이 | 위 선택 적대 증거 전부(구현자 spec 의 같은 ID) | 전부 red — `impl-all` 의 같은 ID(C1·X6·X7·m1~m5·v1·v2·k1·k2·P1~P5·S1~S4·B1·B2·H1·OWN) |
| ② 닫는 이슈 인용 변이 | V2-F1 X4(=v1) · V2-F2 X6 · X7 | 3/3 red — R3-X4 `node --test` fail 1 · R3-X6·X7 각 1 failed / 36 |
| ③ 직전 못 잡음·동치 | X4 · X6 · X7 · E24-r1 (s1 은 경계 B38 로 제외) | X4·X6·X7 red · E24-r1 green → 동치 유지(`host-supervisor.ts` 이번 diff 미접촉) |
| ④ 이전 잡음 재실행 | 구현자 `rerun-v2` 47행 + 재앵커 13행 | 60/60 red — red → green 0(공용 설정·setup 변경 없음) |
| ⑤ 형제 맞바꿈 | 구현자 spec E26-4c · 5c · E27-1c · 4e · 5a · 5b | 전부 red |
| ⑥ 독립 축 | Y1·Y2·Y5·Y7·Y9~Y12 | 아래 표 |
| ⑦ 열거 sweep | 구현자 spec 79 + 보강 9 | 88행 — red 87 · HC1 green(동치 — 구현자 근거 그대로: 표지 값과 채널 이름을 비교하는 코드 0) · E29-m 의 red 는 잔여물(TS6133)이라 잠금이 아니고 m1·m2 가 잠근다 · 구현자 첫 실행 green 7 은 보강 뒤 트리에서 모두 red |

**고장 이력 (라운드 3 — 독립 축 · ③)**

| ID | 자리 | 종류 | 바꾼 내용 | 직전 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|---|
| Y1 | `preload/index.ts:56` | 다른 값 | 해제가 다른 리스너(`handler`)를 뗀다 | 새 | 잡음 | `preload/index.test.ts` ② '셸 채널의 요청·송신·구독과 그 해제는 …'(1/17) | — |
| Y7 | `preload/index.ts:54` | 제거 | `on` 만 셸 채널 판정 생략 | 새 | 잡음 | `preload/index.test.ts` it.each '%s → 던진다'(1/17) | — |
| Y9 | `BridgeMissingScreen.tsx:22` | 제거 | 끌기 영역의 `style={DRAG_STYLE}` 제거(표지 `data-behavior` 는 남김) | 새 | **못 잡음**(157 green) | — | **이행 → V3-F1** |
| Y5 | `main.tsx:14` | 뒤집기 | `installOo()` 를 `connectMainErrorReports()` 뒤로 | 새 | **못 잡음**(522 green) | — | **확장(창 안) → V3-F2** |
| Y2 | `install.ts:30` | 제거 | `wrapPort.close` → 빈 함수 | 새 | **못 잡음**(73 green) | — | **확장(창 안) → V3-F3** |
| Y11 | `install.ts:63` | 다른 값 | `ports.length !== 1` → `< 1`(포트 2 수용) | 새 | **못 잡음**(73 green) | — | **확장(창 안) → V3-F4** |
| Y12 | `preload/index.ts:34` | 다른 값 | `ports.length !== 1` → `< 1` | 새 | **못 잡음**(17 green) | — | **확장(창 안) → V3-F4** |
| Y10 | `smoke-preload.mjs:91` | 다른 값 | `exposed.length !== 1` → `< 1`(노출 2회 수용) | 새 | **못 잡음**(`node --test` fail 0) | — | **확장(창 안) → V3-F5** |
| R3-X4 | `execution-model.md:105` | 다른 값 | `` `UI_TASK_BUDGET_MS`(50ms) `` | 못 잡음 | 잡음 | `check-ui-thread.test.mjs` '멈춤 계측 절의 숫자는 …' | 이행 — 잠김(V2-F1) |
| R3-X6 | `data-host.ts:53` | 다른 값 | `current.length > 0` → `parts > 0` | 못 잡음 | 잡음 | `data-host.test.ts` 'part 0 메시지 뒤에 …' | 이행 — 잠김(V2-F2) |
| R3-X7 | `data-host.ts:61` | 다른 값 | 끝 조각 `current.length > 0` → `parts > 0` | 못 잡음 | 잡음 | `data-host.test.ts` '상한을 넘는 메시지 뒤 끝의 part 0 …' | 이행 — 잠김(V2-F2) |
| R3-E24-r1 | `host-supervisor.ts:106` | 제거 | `!deps.isReady \|\|` | 동치 | green(114) | — | 동치(코드 미접촉) |

- 검산(독립·③): 시도 12 → 잡음 5 · 못 잡음 6 · 동치 1.
- 구현자 spec 재실행 148행 = red 147 · green 1(HC1 동치). 구현자 표와 결과가 같다.

## R3-3. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거(이번 턴) |
|---|---|---|---|
| VP-16″ | UT | PASS | EP-6″ 13분기 ↔ `data-host.test.ts` 10케이스 + it.each 3 · C1·X6·X7 red |
| VP-05‴ | ST·AT | PASS | VP-16″ 좌표 + 옮긴 조립 좌표 2(`transport/session-load.test.ts`) — 전체 vitest green 집합 안 |
| VP-01″ | AT | PASS | `check-doc-inventory --check` exit 0 · EP-25′ ⑥ 케이스 · v1(=X4) red |
| VP-48 | AT | PASS(기계 범위) | `gate:node scripts/smoke-preload.mjs out/preload` OK(이번 빌드) · 실창은 VP-07 과 함께 사람 실기 |
| VP-49 | IT | PASS(V3-F3·F4 확장 공백 별도) | EP-26 11행 ↔ `preload/index.test.ts` 17케이스 · EP-27 8행 ↔ `install.test.ts` 11케이스 · P1~P5 red |
| VP-50 | UT | PASS(V3-F5 확장 공백 별도) | EP-28 11행 ↔ `smoke-preload.test.mjs` 12 + CLI 2 · S1~S4 red |
| VP-51 | AT | **PAIR_FAIL (V3-F1)** | EP-29 ③ 자리의 "창 끌기 영역" 을 좌표가 표지 속성으로만 단언한다 — 운반 값(`WebkitAppRegion: 'drag'`)을 지워도 green(Y9). ①②④ 와 B1·B2 는 PASS |
| VP-21″ · VP-23″ · VP-24′ | AT · IT | PASS(V3-F3 확장 공백 별도) | `transport/oo.test.ts` 소유자별 전송 · 소유 표 변이(OWN) red · `channel-registration.test.ts` · `send.test.ts` green |
| VP-32 (h)′ | IT | PASS | `check-ui-thread.test.mjs` (h)′ 2케이스 · H1 red |
| 나머지 REQUIRED·REGRESSION | — | PASS(좌표 참조) | 라운드 1·2 좌표 파일이 이번 전체 vitest · `node --test` 에서 통과 |
| VP-07 (AC22·AC23·AC52 실창) | AT | 사람 실기 대기 | Electron 바이너리 없음 |

- root `PAIR_FAIL` 1(VP-51) · `BLOCKED_BY` 0.
- AC: ✅ 49 · ⚠️ 3(AC22·AC23·AC52 실창) · ❌ 1(AC53 — VP-51) = 53. 구현자 사본 `50/53`(plan r3 · `7374af8` trailer · INDEX)과 다른 1 은 AC53 이다.

## R3-4. 운영 gate (마지막 트리 `7374af8`)

| Gate | 결과 | 증거 |
|---|---|---|
| 가드 5종 | PASS | migrations `sync ok` · doc-inventory `generated doc ok (9 items, 125 channels)` · prose ok · links ok · product-naming `2444파일 · 허용 7항목` · test-budgets `18 real-git suites ok` · `check-ui-thread: OK` |
| `npm run lint` | PASS | 0 error · 3 warning(기존 React Compiler 2 · react-refresh 1) · 트리 변화 0 |
| `npm run typecheck` | PASS | node · web · test exit 0 |
| `node --test scripts/*.test.mjs` | PASS | 74 suites · 1019 pass · 0 fail |
| `vitest run`(필터 없음) | PASS(기준선 분리) | 1029파일 · 9786케이스 — 실패 22(9파일) · 오류 1. 같은 9파일을 `49d6bba` worktree 에서 돌려 실패 22 — `×` 케이스 줄 차집합 양방향 ∅. 원인은 라운드 1·2 와 같은 win32 전용 경로(`C:/` 절대 경로). 이번 diff 파일과 교집합 0 · `[test-pools]` 0 |
| `electron-vite build` · `smoke-hosts` · `smoke-preload` | PASS | `✓ built` 3 · `out/preload/index.js 15.35 kB` · smoke-hosts `OK — 데이터 → 에이전트 기동 · 피어 · 창 포트 요청 · 에이전트 → 데이터 종료` · smoke-preload `OK — require 는 electron 뿐 · 다리 \`ooBridge\` 노출(키 7)` |

## R3-5. Repository operation checks

- `[구현자 기입] r3` 7필드 전부 있음 — 강제 지점 표는 EP-6″ 2 · EP-25′ 6 · EP-26 7 · EP-27 5 · EP-28 5 · EP-29 4 · EP-8″ 5 · (h)′ 를 담는다.
- trailer: r3 6커밋 · `49d6bba` 파싱 OK(`git log -1 --format='%(trailers:only=true)'`). 구현 커밋 `Agent: claude` — 사용자 지시 구현(허용값).
- 대상 커밋: `e412f5f`(verify 2) · `49d6bba`(rev 4.7) · `7374af8`(r3 마지막) — `git cat-file -t` commit · 브랜치 `ccr-529aa736-wcu5s4` 조상 · `origin/main` 조상 아님(미병합). INDEX 자리표시자를 채운다.
- `[검증자 기입]` V2-F1~F3 상태가 `open` 으로 남아 있었다 — 이번 턴에 닫는다(F1·F2 잠김 확인 · F3 경계 B38).
- `app/AGENTS.md` 변경(스크립트·로컬 확인·CI 표): 비밀·개인정보·변동성 정보 0, 부모 규칙과 충돌 0.

## R3-13. Finding disposition

| # | 발견 | 분류 | 근거 | pair | disposition |
|---|---|---|---|---|---|
| V3-F1 | 실패 화면의 끌기 영역 스타일을 지워도 green(Y9) | 이행 | §10 EP-29 ③ 자리 "`BridgeMissingScreen`(… 창 끌기 영역 …)" — 좌표는 표지 `data-behavior` 만 단언(라벨) | VP-51 · AC53 | BLOCKING(`PAIR_FAIL`) — 구현자가 운반 값(`-webkit-app-region:drag`)을 단언한다 |
| V3-F2 | `installOo()` 를 오류 보고 연결 뒤로 옮겨도 green(Y5) — main 오류 보고가 조용히 끊긴다 | 확장(창 안 — AR-17·R-14) | 열거 원문은 설치 결과가 렌더 전이라는 것만 잠근다(`rootElement.test.ts` 구조 단언). §7-M 5c "`installOo()` 를 먼저 부르고" 는 구현 설계 칸이라 열거 원문이 아니다 | VP-48 · VP-51 | PLAN_GAP — 채택(설치가 `window.oo` 소비자보다 먼저라는 순서를 열거) 또는 경계 |
| V3-F3 | `wrapPort.close` 를 비워도 green(Y2) — 교체된 옛 `MessagePort` 가 열린 채 남는다 | 확장(창 안 — AR-17·AT-24″) | AC33′ 의 "옛 포트를 닫는다" 좌표는 `ClientPort` 추상까지다. 실제 포트로 잇는 이음매가 VP-21″ path edge 에 드는지는 해석이 필요하다 | VP-49 · VP-21″ | PLAN_GAP — 채택(EP-27 ② 에 포트 감싸기의 닫기 · 수신을 자리로) 또는 경계 |
| V3-F4 | 포트 2개를 받아 첫 포트를 붙여도 green — 설치(Y11)·다리(Y12) | 확장(창 안 — AR-17) | 규칙 칸 입력은 "포트 0" 뿐. 셸은 포트 1개만 보낸다(`electron-hosts.ts:58` `[port]`) — 트리에 없는 형태 | VP-49 | PLAN_GAP — 채택 또는 경계 |
| V3-F5 | 노출 2회를 통과시켜도 green(Y10) | 확장(창 안 — MD-12) | EP-28 ④ "`exposeInMainWorld` 1회" 의 규칙 칸 입력은 "노출 없음" 뿐. 지금 산출은 1회 — 트리에 없는 형태 | VP-50 | PLAN_GAP — 채택 또는 경계 |

- V3-F2~F5 는 production 동작에 영향이 없다(지금 코드는 맞다). 설계자가 항목마다 채택 또는 경계 선언을 정한다 — 이 ΔV 노드의 창은 verify 4회째까지 열려 있다.
- V3-F1 은 테스트 1줄 보강이라 설계 턴 뒤 같은 재구현에서 닫는다.

## R3-14. Review Signals — 사실만

- verify 3회째 · PASS 아님 → `handoff-review` 진입 조건(다음 재구현 전).
- 이번 발견 5건은 모두 §7-M(사용자 결정 ΔV) 새 표면에서 나왔고 독립 축(⑥) 산출이다 — 이행 1 · 확장 4. §7-L(창 밖) 발견 0.
- V3-F1 은 라벨 단언 꼴이다(0209 r11 과 같은 꼴 — 표지가 실제 기능을 대신함).
- 라운드 3 의 구현자 sweep 첫 실행 green 7 은 모두 보강으로 닫혔고, 이번 재실행 green 은 HC1(동치) 1 뿐.
- 환경: Electron 바이너리 없음 · 기준선 실패 22 는 라운드 1·2 와 같다.

## R3-15. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 4(V3-F2~F5 확장 · 창 안) + BLOCKING 1(V3-F1 이행).
- pair: VP-51 `PAIR_FAIL` · 나머지 REQUIRED·REGRESSION PASS(VP-07 사람 실기 제외) · AC ✅49 · ⚠️3 · ❌1 / 53.
- 다음: `handoff-review`(verify 3회째 PASS 아님) → 설계자 rev 4.8 — F2~F5 채택 또는 경계 → 구현자가 F1 과 채택분을 닫는다.
- 남은 사람 확인: AC22 · AC23 · AC52 실창.

---

# 라운드 4 — verify 4회째 (rev 4.8 · r4)

**판정: RETURN_TO_PLAN** — `PLAN_GAP` 1(V4-F1 확장 · §7-M 사용자 결정 ΔV 노드 범위의 창 안, 마지막 창) · 이행 결함 0 · 현재 결함 0. V3-F1~F5 는 모두 잠겼다(인용 변이 Y9·Y5·Y2·Y11·Y12·Y10 red). 추천: 설계자가 V4-F1 을 경계로 선언하면 새 구현 의무가 0 이라 구현 턴 없이 verify 5회째로 간다.

## R4-메타

| 항목 | 값 |
|---|---|
| 검증자 · 일자 | Claude Code · 2026-11-18 |
| 대상 커밋/range | `4398a44..7f88f84` — `655341f`(review round 45) · `5969e7c`(rev 4.8 설계) · `63c1e95`·`7f88f84`(r4 구현). 브랜치 `ccr-529aa736-wcu5s4`, `origin/main` 조상 아님 |
| 구현 전 plan 기준 | `5969e7c`(rev 4.8) — `git diff 5969e7c..7f88f84 -- plan.md` 의 삭제 줄 0 · 추가는 `[구현자 기입] r4` 절뿐 |
| V mode / 유효 V | `Baseline V: V1` rev 4.8(§7-N) |
| 라운드 | 4 |
| 확장 창 | verify 4회째 — §7-L 노드는 창 밖. §7-M NEW·CHANGED 노드(R-14·R-15·AR-17·MD-12 와 rev 4.8 의 ′ 노드) 범위는 그 ΔV 뒤 2회째라 **창 안(마지막)** |
| 창 밖 새 열거 항목의 출처 | rev 4.8 의 새 항목(EP-30 · EP-27′ ⑥ · 포트 2 · 노출 2회 · EP-29′ ③ 끌기)은 모두 verify 3 V3-F1~F5(창 안 확장 채택 · plan 내부 정합)가 출처다 |
| 독립 축(⑥) | Z1~Z9 — 잡음 7 · 동치 1(Z2) · 못 잡음 1(Z9) · 그리고 EP-30 구조 단언의 엄격화(AST) |
| 열거 sweep(⑦) | 구현자 spec `r4-sweep/new` 24행(중복 · 넓은 oracle 시간 초과 2행 제외, 좁힌 W1n·S27-6an 사용) + ④ `rerun` 104행을 같은 명세로 재실행 |
| 원본 | `evidence/verify4/`(`axes` · `impl-new` · `rerun` · `prev` 의 `.jsonl`·`.tsv` · `vitest-failures.txt`) — 매 실행 `# 원복 확인: 모든 파일 원문 그대로`. Z7n 실행 중 워커가 재시작돼 `install.ts` 에 변이가 남았다 — `git diff` 로 Z7 원문임을 확인하고 `git checkout` 으로 되돌린 뒤 수동 적용으로 다시 쟀다. 끝에 `git status` 는 `evidence/verify4/` 뿐 |

## R4-0. Plan validity (rev 4.8)

| 검사 | 판정 | 근거 |
|---|---|---|
| CHANGED ↔ REQUIRED | 유효 | CHANGED 4(AT-52′·AT-53′·IT-17′·UT-12′) ↔ VP-48′·VP-51′·VP-49′·VP-50′ · VP-21″ AC33′ 좌표 1 추가 · production 변경 0(`main.tsx` 주석 1줄)이라 영향받은 INHERITED 상위 0 |
| §10 자리 검색 재실행 | 유효 | EP-30 `grep -nvE` → 5줄 `main.tsx:15`·`:18`·`:19`·`:21`·`:23`(plan 의 `:14`~`:22` 에서 5o 주석 1줄만큼 밀림 — 문장 같음) · EP-27′ ⑥ `install.ts:25`·`:28`·`:30` · `ports.length` 2(`preload/index.ts:34` · `install.ts:63`) · `exposed.length` `smoke-preload.mjs:91`·`:92` · `DRAG_STYLE` 3 — 구현 보고와 차집합 0 |
| EP-30 술어 엄격화 | 유효 | TypeScript AST 로 `main.tsx` 최상위 비-import 문을 뽑으면 `:15`·`:18`·`:19`·`:21`·`:23` 5개 — 줄 필터 목록과 차집합 양방향 ∅ |
| 선택 적대 증거 | 유효 | Y5·O1·O2 · Y2·W1·Y11·Y12 · Y10 · Y9 — 자리와 잡아야 할 분기가 적혀 있다 |
| `SUPERSEDED` 이관 | 유효 | VP-48~51 → ′ — EP-26~29 좌표 · P1~P5 · S1~S4 · B1·B2 를 새 pair 가 넘겨받음(이번 ④ 재실행에서 red) |

## R4-1. diff 비판 검토 · 역방향

| 질문 | 판정 | 근거 |
|---|---|---|
| production 동작 변경 | 없음 | `git diff 5969e7c..7f88f84 -- app/src` 의 비테스트 파일은 `main.tsx` 주석 1줄뿐 · `4398a44..7f88f84` 의 `app/src/main`·`app/src/shared`·설정 변경 0 |
| 새 테스트의 실행 구간 | 실제 경로 | ⑥ 닫기는 Node `MessageChannel` 짝 끝의 `close` 이벤트로 본다(`hostPort().closed()`) — 흉내 `ClientPort` 가 아니다 · EP-30 ③ 은 인자 생략 호출로 production 기본 인자 `errorBridge()` 를 지난다 |
| 전역 오염 | 없음 | `mainErrorBridge.test.ts:6-8` `afterEach` 의 `vi.unstubAllGlobals()` · `install.test.ts:47` `afterEach` 가 열린 포트를 닫는다 |
| 새 export · 미배선 | 없음 | 새 production 심볼 0 |

## R4-2. 증거 재측정

| 하한 | 범위 | 결과 |
|---|---|---|
| ① 등록 변이 | Y5·O1·O2·Y2·W1n·Y11·Y12·Y10·Y9 | 9/9 red(`impl-new.tsv`) |
| ② 닫는 이슈 인용 변이 | V3-F1 Y9 · F2 Y5 · F3 Y2 · F4 Y11·Y12 · F5 Y10 | 6/6 red |
| ③ 직전 못 잡음·동치 | Y9·Y5·Y2·Y11·Y12·Y10(②와 같음) · R3-E24-r1(동치) · HC1(동치) | 못 잡음 6 → 잡음 · R4-E24-r1 green(114) — 동치 유지(`host-supervisor.ts` 미접촉) · R4-HC1 green(212) — 동치 유지 |
| ④ 이전 잡음 재실행 | 구현자 `rerun` 104행(이번 diff 가 닿은 oracle 파일의 verify 3 잡음 행 + Y1·Y7) | red 103 · HC1 green(동치) — red → green 0. R4-E27-2d 는 600초 시간 초과(응답 대기)로 끝나 red 로 셌다 |
| ⑤ 형제 맞바꿈 | S29-d(끌기 값 `drag` ↔ `no-drag`) · Z1(옛 포트 ↔ 새 포트 닫기) · Z3(`error` ↔ `log`) | 전부 red |
| ⑥ 독립 축 | Z1~Z9 | 아래 표 |
| ⑦ 열거 sweep | 구현자 spec S30-1~5 · S27-6an · S28-4 · S29-a~e + 서식 뒤 3 | 15/15 red |

**고장 이력 (라운드 4 — 독립 축 · ③)**

| ID | 자리 | 종류 | 바꾼 내용 | 직전 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|---|
| Z1 | `host-port.ts:141` | 맞바꿈 | 교체 때 `previous.close()` → `next.close()` | 새 | 잡음(2 failed / 75) | `install.test.ts` ⑥ '같은 호스트의 새 포트가 오면 옛 포트를 실제로 닫고 …' 외 1 | — |
| Z2 | `install.ts:64` | 다른 값 | `event.ports[0]` → `event.ports.at(-1)` | 새 | 동치(75 green) | — | 동치 — `:63` 이 길이 1 만 통과시켜 두 식이 같은 원소다 |
| Z3 | `bridge.ts:19` | 맞바꿈 | `errorBridge` 가 `oo()?.log` 를 돌려준다 | 새 | 잡음(1 failed / 544) | `mainErrorBridge.test.ts` '인자를 생략하면 호출 때의 `window.oo.error` 에 구독하고 …' | — |
| Z4 | `host-port.ts:158` | 제거 | 호스트 종료 때 `previous?.close()` | 새 | 잡음(1 failed / 75) | `host-port.test.ts` '종료 통지는 응답 대기와 대기열을 모두 거부하고 포트를 닫는다' | — |
| Z5 | `main.tsx:21` | 다른 값 | `startLongTaskReporter()` 를 두 번 | 새 | 잡음(1 failed / 544) | `rootElement.test.ts` EP-30 ①②④⑤ | — |
| Z6 | `main.tsx:19` | 빈 값 | `connectMainErrorReports(undefined)` | 새 | 잡음(1 failed / 544) | `rootElement.test.ts` EP-30 ①②④⑤ | — |
| Z7n | `install.ts:28` | 다른 값 | 수신이 `event.data` 대신 이벤트 통째로 넘긴다 | 새 | 잡음(7 failed / 13, `--testTimeout=3000`) | `install.test.ts` ② 줄 선 요청 5행 · ⑥ 닫기 외 | — |
| Z8 | `BridgeMissingScreen.tsx:22` | 제거 | `style={DRAG_STYLE}` 제거 | Y9 와 같은 자리 | 잡음(1 failed / 157) | `BridgeMissingScreen.render.test.ts` | — |
| Z9 | `BridgeMissingScreen.tsx:26` | 다른 값 | 본문 `<main>` 에도 `style={DRAG_STYLE}` — 화면 전체가 끌기 영역(오류 문구 선택 불가) | 새 | **못 잡음**(157 green) | — | **확장(창 안 — R-15) → V4-F1** |
| R4-E24-r1 | `host-supervisor.ts:106` | 제거 | `!deps.isReady \|\|` | 동치 | green(114) | — | 동치(코드 미접촉) |

- 검산(독립·③): 시도 10 → 잡음 7 · 동치 2(Z2 · R4-E24-r1) · 못 잡음 1.
- 구현자 spec 재실행 128행(new 24 + rerun 104) = red 127 · green 1(HC1 동치). 구현자 표(130행 — 넓은 oracle W1·S27-6a 2행 포함)와 같은 결과다.
- 엄격화(§8): EP-30 은 이번 라운드가 만든 구조적 proxy 다. 줄 필터를 AST 최상위 문으로 바꿔도 목록 차집합 ∅ — 방향은 Y5·O1·Z5·Z6 이 판정했다.

## R4-3. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거(이번 턴) |
|---|---|---|---|
| VP-50′ | UT | PASS | EP-28′ 12분기 ↔ `smoke-preload.test.mjs` — '노출 2회 — 실행이 잡는다' · Y10·S28-4 red · `node --test` 1020/1020 |
| VP-49′ | IT | PASS | EP-26′ ③ '포트 2 → 넘기지 않는다' · EP-27′ ② '포트가 둘이다 …' · ⑥ 닫기 케이스 · Y2·W1n·Y11·Y12·Z1·Z4·Z7n red · Z2 동치 |
| VP-21″ | AT | PASS | AC33′ 좌표 2(`host-port.test.ts` 흉내 포트 · `install.test.ts` ⑥ 실제 포트) · Y2 red |
| VP-48′ | AT | PASS(기계 범위) | EP-30 ①~⑤ ↔ `rootElement.test.ts` EP-30 케이스 · ③ ↔ `mainErrorBridge.test.ts` 2케이스(설치 뒤 · 설치 전) · Y5·O1·O2·Z3·Z5·Z6 red · `smoke-preload` OK · 실창은 AC23 실기(B47) |
| VP-51′ | AT | PASS(V4-F1 확장 공백 별도) | EP-29′ ③ 5항 ↔ `BridgeMissingScreen.render.test.ts` · Y9·S29-a~e·Z8 red. V3-F1 의 `PAIR_FAIL` 해소 |
| 나머지 REQUIRED·REGRESSION | — | PASS(좌표 참조) | 라운드 1~3 좌표 파일이 이번 전체 vitest · `node --test` 에서 통과 · 해당 production 미접촉 |
| VP-07 (AC22·AC23·AC52′ 실창) | AT | 사람 실기 대기 | Electron 바이너리 없음 |

- root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.
- AC: ✅ 50 · ⚠️ 3(AC22 · AC23 · AC52′ 실창) · ❌ 0 = 53. 구현자 사본(plan r4 · `7f88f84` trailer `50/53` · INDEX)과 같다.

## R4-4. 운영 gate (마지막 트리 `7f88f84`)

| Gate | 결과 | 증거 |
|---|---|---|
| 가드 5종 | PASS | migrations `sync ok` · doc-inventory `generated doc ok (9 items, 125 channels)` · prose ok · links ok · product-naming `2444파일 · 허용 7항목` · test-budgets `18 real-git suites ok` · `check-ui-thread: OK` |
| `npm run lint` | PASS | 0 error · 3 warning(기존) · 실행 뒤 `git status` 에 `app/` 변경 0 |
| `npm run typecheck` | PASS | node · web · test exit 0 |
| `node --test scripts/*.test.mjs` | PASS | 74 suites · 1020 pass · 0 fail |
| `vitest run`(필터 없음) | PASS(기준선 분리) | 1029파일 · 9791케이스 — 실패 22(9파일, 전부 `src/main`) · 처리 안 된 오류 1. verify 3 과 같은 22/9 이고, verify 3 이 `49d6bba` 와 대조한 트리 이후 `app/src/main`·`app/src/shared`·설정 변경 0(`git diff --stat 4398a44..7f88f84`) · win32 경로 서명 21줄 · `[test-pools]` 0 · 목록 `evidence/verify4/vitest-failures.txt` |
| `electron-vite build` · `smoke-hosts` · `smoke-preload` | PASS | `✓ built` 3 · `out/preload/index.js 15.35 kB` · smoke-hosts `OK — 데이터 → 에이전트 기동 · 피어 · 창 포트 요청 · 에이전트 → 데이터 종료` · smoke-preload `OK — require 는 electron 뿐 · 다리 \`ooBridge\` 노출(키 7)` |

## R4-5. Repository operation checks

- `[구현자 기입] r4` 7필드 전부 있음 — 강제 지점 표는 EP-30 5 · EP-27′ 6 · EP-26′ 7 · EP-28′ 5 · EP-29′ 4 전부를 담는다.
- trailer: `5969e7c`(designed) · `63c1e95`(partial) · `7f88f84`(implemented · `50/53`) — `git log -1 --format='%(trailers:only=true)'` 파싱 OK. 구현 커밋 `Agent: claude`(비기능 · 사용자 지시 구현).
- 대상 커밋: `655341f` · `5969e7c` · `63c1e95` · `7f88f84` — `git cat-file -t` commit · 브랜치 조상 · `origin/main` 조상 아님(미병합). INDEX 자리표시자를 채운다.
- `[검증자 기입]` V3-F1~F5 를 이번 턴에 닫는다(인용 변이 6/6 red). `655341f`(review round 45)의 지침 변경은 이 verify 의 대상이 아니다 — review 가 Tier 판정을 갖는다.

## R4-13. Finding disposition

| # | 발견 | 분류 | 근거 | pair | disposition |
|---|---|---|---|---|---|
| V4-F1 | 실패 화면의 본문 영역까지 끌기 스타일을 둬도 green(Z9) — 화면 전체가 끌기 영역이 되어 오류 문구를 선택·복사할 수 없다 | 확장(창 안 — R-15) | EP-29′ ③ 기대는 끌기 영역이 *있음*만 단언하고, AC53′ "위쪽에 끌기 영역" 의 *위쪽만*은 규칙 칸에 없다. B43 "형태는 사용자 거부 가능" 이 덮는다고 보려면 해석이 필요하다. 트리에 없는 형태(지금 `:26` 에 스타일 없음) | VP-51′ | PLAN_GAP — 채택(끌기 스타일이 `<header>` 하나뿐이라는 입력) 또는 경계(시각 형태 — 사람 실기 · B43) |

- 이번이 §7-M 노드 범위의 마지막 창이다. 다음 verify 부터 이 범위의 확장 후보는 후보 표로 간다.
- 설계자가 V4-F1 을 경계로 선언하면 새 의무 0 — 구현 턴 없이 verify 5회째(INDEX 비고 "규범 변경만 — 구현 없음").

## R4-14. Review Signals — 사실만

- verify 4회째 · PASS 아님 — review 진입 조건 아님(3·6회째만).
- 이번 발견 1건은 독립 축(⑥) 산출이고 §7-M 새 표면(D-059 실패 화면)의 가정 형태다 — 확장 1 · 이행 0 · 현재 0. §7-L 발견 0.
- V3-F1(라벨 단언)은 review round 45 의 "자리 문장의 항" 규칙 아래 구현자 sweep S29-a~e 로 닫혔다.
- 환경: Electron 바이너리 없음 · 기준선 실패 22 는 라운드 1~3 과 같다 · 워커 재시작 1회(Z7 변이 잔류 — 확인 뒤 원복).

## R4-15. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 1(V4-F1 확장 · 창 안) · BLOCKING 0.
- pair: root `PAIR_FAIL` 0 · REQUIRED·REGRESSION 전부 PASS(VP-07 사람 실기 제외) · AC ✅50 · ⚠️3 · ❌0 / 53.
- 다음: 설계자 rev 4.9 — V4-F1 채택 또는 경계 → 경계면 구현 없이 verify 5회째.
- 남은 사람 확인: AC22 · AC23 · AC52′ 실창.
