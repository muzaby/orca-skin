# Verify — 0279-claude-project-plugin-state

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0279-claude-project-plugin-state` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `b010d07..38e4b7a`(V1 r1) · `10f52f9..a082776`(ΔV2 r1.3, 0278 커밋에 동봉) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `b010d07` · ΔV1 `8137313` · ΔV2/READY `1700459`·`f7d268d`·`10f52f9` |
| V mode / 유효 V | Delta V / `V1@256ddd24 + ΔV1 + ΔV2`, 최종 구현 경계 = 0278 §27 FEP3–6·9–11 |
| 라운드 | 1 (이 handoff의 verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — 고정 자리 3곳에서 심은 고장이 Windows 분기를 포함한 전 실행에서 green이었다.** cwd 격리·plugin 저장 대기·MCP 거부·유휴 적용·종료 drain은 잠겼지만, 읽는 중 변경된 revision 결과 폐기(EP3)·commit 직전 외부 재편집 재확인(FEP9·AC8)·renderer push의 scope 비교 3항(EP7·AC5)을 어떤 테스트도 잡지 못한다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `38e4b7a`(r1)·`a082776`(r1.3) 모두 `[구현자 기입]` 절 추가·채움만. 규범 행 변경 없음.
- 기준선 diff 성립: 예 — V1 `b010d07`, ΔV1 `8137313`, ΔV2/READY `1700459`·`f7d268d`·`10f52f9`가 구현과 분리된 설계 커밋.
- Decision: D1·D3은 D5로, D10은 0278 D32로 정정(사용자 답변 인용). 정책 충돌은 **최신 handoff가 정본**이라는 사용자 지시(2026-10-22)에 따라 0278 §27·0281 D5를 기준으로 채점한다. 구현자 변경 없음.
- 채점 기준: V1 AC1–7 · ΔV2 AC8 · V1 VP1–5(ΔV1 아래 REGRESSION) · DV1-P1–4 · V1 §10 22자리 + 0278 §27 FEP3–6·9–11.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | V1 + ΔV1 + ΔV2, 최종 경계는 0278 §27 승계로 명시 |
| NEW node ↔ REQUIRED pair | 유효 | DV1-P1–4 REQUIRED, ΔV2는 0278 DV3-P1–4 승계 |
| 영향 INHERITED ↔ REGRESSION | 유효 | V1 VP1–5 REGRESSION(EP5 등록 no-op 변이 보존) |
| §10 자리 목록 | 유효(관찰 1) | V1 검색 술어(`nativeResources\|…\|nativeResourceScope`)는 EP1 reader/writer 파일(`project-settings.ts`·`plugin-state.ts`)과 EP3 `project-resource-sync.ts`를 반환하지 않는다. V1 표가 22자리를 역할로 고정했고 최종 경계가 0278 §27 FEP 행(이름 붙은 테스트 좌표)으로 다시 고정돼, 검증자가 두 목록 합집합 밖 운반 자리를 찾지 못했다 → PLAN_GAP 아님 |
| SUPERSEDED 이관 | 유효 | AC6 SDK MCP 쓰기 증거 → 0278 DV4-P1–3(관측·거부·무변경) 이관 명시 |
| 운영 gate | 유효 | Vitest·typecheck·lint·build·문서 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D2·D10 | 같은 현재 cwd만 공유, 다른 cwd 격리, 격리 불가 항목은 모니터링 | sharing scope `nativeResourceScope=pluginPathKey(cwd)`(`native-resource-sharing.ts:33`) · reader의 native entry는 `entry(cwd)`만(`project-settings.ts:79`) · Claude MCP `set`은 SDK 호출 전 거부(`native-resources.ts:186`) |
| D5 | `settings.local.json`의 `enabledPlugins`만 편집 | `persistClaudePluginState` → `FileMutationCoordinator.mutate`(`{root: cwd}`, `plugin-state.ts:26-32`) |
| D7→D32 | SDK native MCP 저장은 격리 가능한 제어에 한정 | MCP 행 `canToggle=false` + set 거부 |
| D8 | 외부 변경 즉시 표시·전체 cwd 유휴 적용·재시작 필요는 회수 대기 | `ProjectResourceSync` watcher → `decorate` → `apply`(모든 peer idle) → `ClaudeProjectReconciliation.reconcile` |
| D9 | 같은 파일 동시 편집은 대기·저장, 정상 경합 토스트 없음 | `nativeFileMutations` 파일별 FIFO(`file-mutation.ts:35`)·revision 재확인(`:134`)·bounded retry |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| F1(Git-root MCP 누출) | ✅ 해소 방식 확인 | 설치 SDK 0.3.296 probe를 Linux에서 재실행: `"disabledSavedAt": ["A Git root"], "firstB": "disabled"` — SDK 누출은 그대로. Orca는 MCP 제어를 SDK 호출 전에 거부(A12 red)하고 reader가 child cwd entry만 읽어(A1 red) Orca 경유 전파를 차단. `evidence/native-isolation.test.ts` Claude 반례 PASS |
| false success | ✅ | plugin 저장은 commit 이후 resolve(A13 Windows 경로 red), 실패 시 SDK flags 복원 후 throw |
| busy 적용 | ✅ | `apply`가 모든 peer idle 확인(A5 red), reconcile guard는 매 set 전 재확인 |
| 비Windows 동작 | 관찰 | plugin 제어는 `process.platform==='win32'`에서만 활성(`native-resources.ts:40`), local root도 Windows만 cwd(`project-path.ts:24`). 비Windows는 관측만 — READY 정책("확인되지 않은 OS 저장 범위는 관측만")과 일치 |
| 외부 재편집 재확인 | ⚠️ | `file-mutation.ts:134`의 commit 직전 재읽기를 지워도 유일한 oracle이 첫 rename EBUSY 재시도로 다시 읽어 green(A15) — §4 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `persistClaudePluginState`·`ProjectResourceSync`·`ClaudeProjectReconciliation`·`nativeFileMutations` 모두 `bootstrap.ts`/`adapter.ts` production 호출 |
| 형제 정책 비대칭 | 관찰 | OpenCode `project-settings.ts`는 MCP·plugin 선언을 revision에 넣지만 plugin 변경 oracle이 없다(A23, 0277·0278 귀속) |
| 동명 로컬 재구현 | 없음 | 잡은 테스트가 모두 production 모듈을 import(아래 §4 잡은 테스트 열) |

## 4. 고장 내 보기

- 등록 변이: V1 EP5 "관측 등록 no-op"(A10). 나머지는 §10·FEP 자리별 재량 고장. 0278 r2와 공유하는 실행이다(ID 동일).
- 실행: `src/main src/shared src/preload` 465파일 기준선 15 red(Windows 전용 fixture, `base-main.txt`). `CAUGHT[related]`는 `vitest related` 1단계에서 기준선 밖 실패를 관측한 것이다.
- **Windows 게이트 재측정**: plugin 제어·local root가 `win32`에서만 열려 Linux에서 실행되지 않는 테스트(`native-resources`·`adapter.native-plugins`·`project-reconciliation` 일부)는 검증자 전용 shim(두 `process.platform` 분기를 소스에서 연 상태, 각 실행 후 복원)으로 다시 쟀다. shim BASE는 이 테스트들이 전부 green이고 실패 5건은 shim·`C:/` fixture 부산물이다. 판정은 BASE와 실패 목록 차집합으로 한다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| A1 | `claude/project-settings.ts:79` | 다른 값 | native entry에 Git-root entry 병합 | 잡음 | `project-settings.test: fingerprints only project extension keys…excluding other cwd and Git-root state` | EP1 reader · FEP6 · DV1-P4 |
| A2 | `claude/plugin-state.ts:26` | 제거 | 형제 `enabledPlugins` 버림 | 잡음 | `plugin-state.test: merges sibling choices and preserves unrelated settings…` | EP1 writer · FEP9 |
| A3 | `claude/plugin-state.ts:32` | 빈 값 | coordinator `{ root: cwd }` → `{}` | 잡음 | `project-settings.test: writes only plugin choices in the platform-native local directory…` | EP1 writer · FEP9 |
| A4 | `app/native-resource-sharing.ts:33` | 제거 | `session.cwd ??` 삭제(project 경로로 묶음) | 잡음 | `bootstrap.native-history.test: groups runtimes by actual cwd…`·`keeps different current working directories…`·`native-resource-sharing.test` | EP2 · AC2 |
| A5 | `app/project-resource-sync.ts:44` | 제거 | background task idle 조건 삭제 | 잡음 | `project-resource-sync.test: counts foreground…background and wakeup activity as busy`·bootstrap 통합 | EP3 idle · AC4 |
| A6 | `app/project-resource-sync.ts:178` | 제거 | 읽는 중 version 변경 시 결과 폐기(`continue`) 삭제 | **못 잡음**(Linux·Windows shim) | — (읽는 중 변경이 오면 stale 구성이 한 번 emit된 뒤 재읽기 — 최종값은 같고 중간 push가 관측되지 않음) | EP3 revision · AC5 |
| A7 | `claude/project-reconciliation.ts:69` | 제거 | reconcile의 `!isIdle()` pending 조건 삭제 | 동치 | — 확인 실행: Linux·shim green. 근거: 유일한 호출 경로 `SessionRuntime.reconcileNativeResources`(`session-runtime.ts:928`)가 같은 `isIdle()`을 await 없이 먼저 판정하고 `adapter.ts:993`→`reconcile` 첫 문장까지 동기 진행, 이후 set마다 guard 재확인 | EP4 reconcile · AC4 |
| A8 | `claude/project-reconciliation.ts:98` | 뒤집기 | reconcile set `persist=false` → `true` | 잡음(Windows shim) | `project-reconciliation.test: …waits for idle, and never saves it back`·`adapter.native-plugins.test: …applies external project choices only after idle reconciliation` | EP4 · AC4 "never saves it back" |
| A9 | `sessions/session-runtime.ts:416` | 제거 | 다음 제출의 configuration flight 대기 삭제 | 잡음 | `session-runtime.test: serializes the next submission behind an idle configuration operation…` | EP4 SessionRuntime |
| A10 | `app/bootstrap.ts:1074` | 고정값 | `policy` → `() => undefined`(등록 변이) | 잡음 | `bootstrap.native-history.test: observes external project settings through real bootstrap…` | EP5 · VP3 |
| A11 | `handlers/session-resources.ts:256` | 제거 | 쓰기 전 `item.canToggle` 확인 삭제 | 잡음 | `session-resources.test: rejects stale generations, unknown entries and read-only resources…` 외 1 | EP6 · FEP10 |
| A12 | `claude/native-resources.ts:186` | 호출 대체 | MCP 거부 → `toggleMcpServer` 호출 | 잡음 | `native-resources.test: rejects both MCP toggle directions…`·`adapter.live-control.test` | FEP5 · D32 |
| A13 | `claude/native-resources.ts:168` | 호출 대체 | `await persistPluginState` → `void` | 잡음(Windows shim: A13p·A13s) | `native-resources.test: waits for durable persistence and serializes subsequent plugin mutations` | FEP5·FEP10 · AC8 |
| A14 | `infra/config/file-mutation.ts:35` | 제거 | 같은 파일 FIFO 직렬화 삭제 | 잡음 | `file-mutation.test: serializes canonical same-file aliases, merges latest bytes…` | FEP9 · AC8 |
| A15 | `infra/config/file-mutation.ts:134` | 고정값 | commit 직전 외부 변경 재확인 → `false` | **못 잡음**(Linux·Windows shim) | — 유일한 oracle `re-reads an external edit and retries a temporary rename lock…`이 첫 rename을 EBUSY로 실패시켜 루프가 다시 읽으므로 재확인 분기 없이도 같은 결과 | FEP9 · AC8 "외부 재편집" |
| A16 | `app/native-settings-lifecycle.ts:12` | 맞바꿈 | `drain()`↔`shutdown()` 순서 | 잡음 | `native-settings-lifecycle.test: freezes admission and drains saves once before stopping owners…` | FEP11 |
| A17 | `app/native-settings-lifecycle.ts:32` | 제거 | drain 중 before-quit 지연 삭제 | 잡음 | `native-settings-lifecycle.test: defers actual before-quit events once…` | FEP11 |
| A18 | `claude/adapter.ts:440` | 고정값 | snapshot 재사용 조건 → 항상 새 capture | 잡음 | `adapter.native-plugins.test: isolates global SDK choices and freezes them until the last project query closes` | FEP3 |
| A19 | `claude/adapter.ts:467` | 제거 | 배포 snapshot roots 대신 요청 pluginRoots | 잡음(Windows shim) | `adapter.native-plugins.test: pins deployed MCP files for same-cwd peers and reloads until the final owner closes` | FEP3·FEP4 |
| A24 | `claude/project-reconciliation.ts:94` | 제거 | MCP 변경의 restart-required 판정 삭제 | 잡음 | `project-reconciliation.test: isolates project approvals from user MCP and detects revision changes before any SDK call` | FEP6 · AC6 |
| PL1 | `claude/native-resources.ts:158` | 제거 | inline flag 갱신 시 형제 flags 버림 | 잡음(Windows shim) | `native-resources.test: applies session-only inline flags…preserving sibling flags`·`adapter.native-plugins.test: carries plugin controls…` | FEP5 · AC1 형제 보존 |
| P11 | `renderer/lib/nativeResourceState.ts` | 제거 | 늦은 응답 scope 비교에서 backend 항 삭제 | **못 잡음** | — renderer 288파일/2271 green | EP7 · AC5 |
| P12 | 같은 파일 | 제거 | scope 비교에서 cwd 항 삭제 | **못 잡음** | — 같음. `useNativeResources.test: …accepts only matching pushes…`의 `cwd: C:/B` push는 초기 read 대기 중이라 `status: loading` 단언이 수락 여부와 무관 | EP7 · AC5 |
| P13 | 같은 파일 | 제거 | scope 비교에서 projectId 항 삭제 | **못 잡음** | — 같음 | EP7 · AC5 |

- 검산: 시도 24 = 잡음 18 · 동치 1(A7) · 못 잡음 5(A6·A15·P11·P12·P13). 못 잡음 5건은 모두 §10/FEP 고정 자리 → `PAIR_FAIL`, §13 D1–D3.
- Windows shim 판정은 BASE 실패 목록(5건: shim의 local root 단언 1 + `C:/` composer fixture 4)과의 차집합: A8 +2 · A13 +2 · A19 +1 · PL1 +2 · A6/A7/A15 +0.
- 형제 슬롯 맞바꿈: A16(drain↔shutdown) 잡음. scope 3항(P11–P13)은 항마다 제거 — 모두 못 잡음.
- 소거 변이 잔여물 진단 없음(전부 typecheck 무관 자리).

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| DV1-P4 | UT | REQUIRED | PASS | A1·A2·A3 잡음(cwd 정규화·선택적 fingerprint·허용 키 merge/write) |
| V1 VP4 | UT | REGRESSION | PASS | A1·A24 잡음, A8 잡음(shim), A7 동치 |
| ΔV2 (0278 DV3-P1·3·4 승계) | IT | REQUIRED | **PAIR_FAIL** | A14·A13 잡음, **A15 못 잡음**(외부 재편집 재확인) |
| DV1-P3 | IT | REQUIRED | PASS | SDK 저장→reader→sync→reconcile: A1·A24·A5·A8 잡음 |
| V1 VP3 | IT | REGRESSION | **PAIR_FAIL** | A10(등록 변이)·A4·A5 잡음, **A6 못 잡음**(EP3 revision) |
| DV1-P2 | ST | REQUIRED | PASS | A1 잡음 + F1 반례 PASS(`evidence/native-isolation.test.ts`) |
| V1 VP2 | ST | REGRESSION | **PAIR_FAIL** | A11 잡음, **P11–P13 못 잡음**(owner push scope) |
| DV1-P1 | AT | REQUIRED | PASS | A12·A13·A2·A3·PL1 잡음 — 패널→SDK→native 파일→B Query |
| V1 VP1 | AT | REGRESSION | PASS | A2·A4·A8·A13·A18·A19 잡음 |
| V1 VP5 | AT | REGRESSION | BLOCKED_BY:V1 VP2 | plugin-state·sharing·session-resources 기존 케이스는 A2·A4·A11 잡음. renderer `nativeResourceState` 부분은 VP2 root |

- 실행 구간: 잡은 테스트는 production 모듈(`ClaudeProjectReconciliation`·`ProjectResourceSync`·`FileMutationCoordinator`·실제 bootstrap)을 직접 조립한다. Windows 분기는 소스 shim으로만 실행 — 실제 Windows CI #853 green이 대응 증거다.

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 plugin 변경·비대상 보존 | ✅ | A2·A3·PL1 잡음 |
| AC2 같은 cwd 공유·다른 경로 분리 | ✅ | A4·A1 잡음 |
| AC3 새 실행·재개·재시작 재적용 | ✅ | A13s: `persists both plugin states across follow-up turns, new adapters and cold resumes` |
| AC4 외부 변경 즉시 표시·유휴 적용 | ✅ | A5·A8·A10 잡음, A7 동치 |
| AC5 실패·stale을 성공으로 표시하지 않음 | ❌ | A6(stale revision emit)·P11–P13(다른 scope push 수락) green |
| AC6 MCP 승인·실행 구분, SDK 저장(→D32 거부) | ✅ | A12·A24 잡음 |
| AC7 경로 타이틀·Composer 안내(0281 D5 예외) | ✅ | renderer 374파일 green, Composer 표현은 0281 verify가 채점 |
| AC8 동시 편집 보존·무오류·순서 | ❌ | A14·A13 잡음, A15 green |

- 합계 재측정: `✅ 6 · ❌ 2 = 8`. 자기보고: r1 trailer `Criteria-Met: 7/7`(V1 범위), r1.3은 0278 커밋 trailer `21/21`에 합산 → 0279 단독 값 대조 불가.

### §10 강제 지점 분모

| 목록 | 자리 | 결과 |
|---|---|---|
| V1 EP1 (4) | project reader · plugin reader · writer · configured reader | 4/4 PASS (A1·A2·A3, reader/configured는 기존 회귀 pass) |
| V1 EP2 (1) | sharing scope | PASS (A4) |
| V1 EP3 (4) | 파일 변경 · owner 수명 · revision · idle | 3/4 — revision PAIR_FAIL(A6) |
| V1 EP4 (3) | reconcile · SDK mutation · SessionRuntime | 3/3 PASS (A8·A24·A12·A13·A9, A7 동치) |
| V1 EP5 (3) | bootstrap 생성 · 종료 · activity | 3/3 PASS (A10 등록 변이 + `bootstrap.shutdown.test` 순서) |
| V1 EP6 (3) | IPC observation · read overlay · 직렬화 | 3/3 PASS (A11) |
| V1 EP7 (4) | preload · renderer owner · session/draft push · nav | 3/4 — push scope PAIR_FAIL(P11–P13) |
| FEP3·4 | snapshot capture · deployment roots | PASS (A18·A19) |
| FEP5·10 | MCP 거부 · 저장 대기 · 형제 flag | PASS (A12·A13·PL1·A11) |
| FEP6 | Git-root 무변경 · restart-required | PASS (A1·A24) |
| FEP9 | FIFO · 형제 키 · 외부 재편집 | PAIR_FAIL (A15; A14·A2 잡음) |
| FEP11 | drain 순서 · quit 지연 | PASS (A16·A17) |

- V1 20/22 · FEP 5/6. 목록 밖 발견: 없음.

### 운영 gate (HEAD `32b43cc`)

typecheck 3구성 0 error · lint 0 error/2 기존 warning(범위 밖) · renderer 374파일/3060 green · main 465파일 중 15 red = 전부 Windows 전용 fixture(Windows CI #853 `84fe913` green) · doc inventory·links·budgets·scripts 142/142 통과. 실행 산출 정본은 [0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc). F1 증거: `evidence/native-isolation.test.ts`(0278) Claude 반례 PASS.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 실제 Windows Electron에서 plugin 토글→`settings.local.json`·두 테마 패널 | 소스 shim으로 Windows 분기 실행, Windows CI green | 실제 창 확인 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE`·다음 Claude 일치 → 이번 턴 갱신.
- 대상 커밋 좌표 기입: `b010d07`·`38e4b7a`·`8137313`·`1700459`·`f7d268d`·`10f52f9`·`a082776` 모두 `git cat-file -t` = commit.
- trailer: `38e4b7a` 5키 파싱. ΔV2 r1.3 구현은 `a082776` 한 커밋(`Handoff: …0278…`)에 동봉돼 0279 trailer로는 찾을 수 없다(N2).
- `[구현자 기입] ΔV2 r1.3` 7필드는 표제상 있으나 `2. 강제 지점·V pair`가 산문 한 단락이라 자리별 `N/M`·좌표·`남긴 곳`이 없다(N2).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | A6: 읽는 중 version이 바뀐 결과를 폐기하는 `continue`를 지워도 green — stale 구성이 한 번 push됨 | V1 EP3 revision · AC5 · V1 VP3 | BLOCKING (PAIR_FAIL) | 읽기 중 watcher 이벤트를 주입해 중간 emit에 이전 revision이 없음을 단언 |
| D2 | A15: commit 직전 외부 재편집 재확인을 꺼도 green — 유일한 oracle이 EBUSY 재시도로 우회 | FEP9 · AC8 · 0278 DV3 | BLOCKING (PAIR_FAIL) | rename 잠금 없이 `beforeCommit` 외부 편집만 주는 케이스 분리 |
| D3 | P11–P13: renderer push 수락의 backend·cwd·projectId 비교를 하나씩 지워도 green | V1 EP7 push · AC5 · V1 VP2 | BLOCKING (PAIR_FAIL) | 준비 완료 상태에서 한 항만 다른 scope push가 거부됨을 항마다 단언 |
| N1 | A7: reconcile 진입 `!isIdle()`은 호출 경로가 같은 판정을 동기로 선행해 동치 | V1 EP4 | NON_BLOCKING | 방어 중복으로 유지 가능 |
| N2 | ΔV2 r1.3 구현이 0278 trailer로만 커밋, `[구현자 기입]` 강제 지점 필드가 산문 | repository operation | NON_BLOCKING | 다음 구현 커밋에 0279 trailer·자리별 표 |

## 14. Review Signals

- 이전 라운드 동일 증상: 해당 없음(이 handoff 첫 verify). 0278 verify r1의 F1은 이번에 해소 방식 확인.
- 관련 plan 지침: ΔV2가 "외부 편집 재확인·재병합"을 명시했고 0278 FEP9 oracle이 `file-mutation.test.ts`의 "외부 재편집"을 지정했다.
- 사용자 결정 변경: D5·D10·D32(2026-10-22) — 최신 handoff(0278 §27) 기준 채점.
- 반복 환경 한계: Linux에서 Windows 전용 plugin gate·`C:/` fixture — 검증자 shim과 Windows CI로 대체.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 6(DV1-P1·P2·P3·P4, V1 VP1·VP4) · root PAIR_FAIL 3(ΔV2/DV3·V1 VP3·V1 VP2) · BLOCKED_BY 1(V1 VP5).
- PLAN_GAP: 없음.
- AC: ✅6 · ❌2 / 8.
- 운영 gate: PASS(main Linux 15건은 Windows 전용 fixture, CI #853 green).
- 다음 단계: Codex r2 — D1–D3 테스트 보강 후 고장 이력 A6·A15·P11·P12·P13(못 잡음)과 A7(동치) 재실행.

---

# r2 재검증 (2026-10-23)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `32b43cc..e42d1e2` 중 0279: `7675171`(r2 기록) — 테스트는 0278 r3 `3e452da`(FEP 공유)에 동봉 |
| 구현 전 plan 기준 | r1과 같음 — `7675171`의 `plan.md` `-` 줄은 메타 상태 1줄 |
| V mode / 유효 V | Delta V / V1 + ΔV1 + ΔV2(0278 §27 FEP3–6·9–11 승계) |
| 라운드 | 2 (verify 2회째) |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude |

**PASS — r1 미검출 5개(A6·A15·P11·P12·P13)가 모두 잡히고 r1 잡음 18개도 유지되며, A7은 동치 그대로다.** production 무변경 테스트 보강 라운드다.

## r2-0. 기준선 / plan validity

- 앱 변경은 테스트 22파일뿐(production 0). §10·FEP 자리와 경로는 r1과 같다.
- 새 oracle 실행 구간: `project-resource-sync.test: discards a revision invalidated during reading…`는 실제 `ProjectResourceSync`에 읽기 중 이벤트를 주입한다. `file-mutation.test: rebases an external edit before commit without relying on a rename failure`는 rename 성공 1회 경로에서 `beforeCommit` 외부 편집만 준다. `useNativeResources.test: rejects a ready draft push differing only in backend/cwd/projectId`는 준비 완료 상태에서 한 항만 다른 push를 준다.
- 약화 확인: `file-mutation.test`의 별칭 케이스는 대문자 alias 입력을 그대로 두고 첫 commit 전 patch 호출 0 단언을 더했다. Windows lock helper 대기만 5s→30s(fixture 준비 예산, production retry 예산 불변).

## r2-4. 고장 재실행

- 0278 r3와 공유한 실행(ID 동일). main은 `src/main src/shared src/preload`(Linux 기준선 17 red). Windows 분기는 r1과 같은 소스 shim(`…s`, 기준선 7 red = shim local-root 단언 1 + `C:/` composer fixture 6)으로 재측정하고 기준선 차집합으로 판정했다.

| ID | r1 | r2 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|
| A1 | 잡음 | 잡음 | `project-settings.test: fingerprints only project extension keys…Git-root state` | EP1 reader · FEP6 |
| A2 | 잡음 | 잡음 | `plugin-state.test: merges sibling choices…` | EP1 writer · FEP9 |
| A3 | 잡음 | 잡음 | `plugin-state.test: refuses a local settings junction outside the current working directory`(Linux·shim) | EP1 writer · FEP9 |
| A4 | 잡음 | 잡음 | `bootstrap.native-history.test: groups runtimes by actual cwd…` 외 2 | EP2 |
| A5 | 잡음 | 잡음 | `project-resource-sync.test: counts …activity as busy`·bootstrap 통합 | EP3 idle |
| A6 | 못 잡음 | **잡음** | `project-resource-sync.test: discards a revision invalidated during reading before any resource push`(Linux·shim) | EP3 revision · D1 |
| A7 | 동치 | 동치 | — Linux·shim green. r1 근거(호출 경로가 같은 `isIdle()`을 동기 선행) 유지, production 무변경 | EP4 · N1 |
| A8 | 잡음(shim) | 잡음(shim) | `project-reconciliation.test: …never saves it back`·`adapter.native-plugins.test: …only after idle reconciliation` | EP4 |
| A9 | 잡음 | 잡음 | `session-runtime.test: serializes the next submission behind an idle configuration operation…` | EP4 |
| A10 | 잡음 | 잡음 | `bootstrap.native-history.test: observes external project settings through real bootstrap…`(등록 변이) | EP5 · VP3 |
| A11 | 잡음 | 잡음 | `session-resources.test: rejects stale generations…` 외 1 | EP6 · FEP10 |
| A12 | 잡음 | 잡음 | `native-resources.test: rejects both MCP toggle directions…`·`adapter.live-control.test` | FEP5 |
| A13 | 잡음(shim) | 잡음(shim) | `native-resources.test: waits for durable persistence…`·`adapter.native-plugins.test: persists both plugin states…` | FEP5·10 |
| A14 | 잡음 | 잡음 | `file-mutation.test: serializes canonical same-file aliases…` | FEP9 |
| A15 | 못 잡음 | **잡음** | `file-mutation.test: rebases an external edit before commit without relying on a rename failure`(Linux·shim) | FEP9 · D2 |
| A16·A17 | 잡음 | 잡음 | `native-settings-lifecycle.test` 2건 | FEP11 |
| A18 | 잡음 | 잡음 | `adapter.native-plugins.test: isolates global SDK choices…`·bootstrap 1 | FEP3 |
| A19 | 잡음(shim) | 잡음(shim) | `adapter.native-plugins.test: pins deployed MCP files…` | FEP3·4 |
| A24 | 잡음 | 잡음 | `project-reconciliation.test: isolates project approvals…` | FEP6 |
| PL1 | 잡음(shim) | 잡음(shim) | `native-resources.test: …preserving sibling flags`·`adapter.native-plugins.test: carries plugin controls…` | FEP5 |
| P11 | 못 잡음 | **잡음** | `useNativeResources.test: rejects a ready draft push differing only in backend` | EP7 · D3 |
| P12 | 못 잡음 | **잡음** | `…differing only in cwd` | EP7 · D3 |
| P13 | 못 잡음 | **잡음** | `…differing only in projectId` | EP7 · D3 |

- 검산: 시도 24 = 잡음 23 · 동치 1(A7) · 못 잡음 0. r1 못 잡음 5 → 잡음, r1 잡음 18 → 잡음(덮개 회귀 0), r1 동치 1 → 동치.
- Linux A13 실행의 기준선 밖 1건은 `infra/loopback-callback.test: 타임아웃은 LoopbackCancelledError 로 끝난다` — 변이와 무관한 타이머 테스트가 병렬 부하에서 흔들린 것이라 세지 않았고 A13은 shim 결과로 판정했다.

## r2-5. V-pair closeout

| Pair | 레벨 | r1 | r2 | 증거 |
|---|---|---|---|---|
| DV1-P4 | UT | PASS | PASS | A1·A2·A3 잡음 |
| V1 VP4 | UT | PASS | PASS | A1·A24·A8 잡음, A7 동치 |
| ΔV2 (0278 DV3-P1·3·4 승계) | IT | PAIR_FAIL | **PASS** | A13·A14·A15 잡음 |
| DV1-P3 | IT | PASS | PASS | A1·A24·A5·A8 잡음 |
| V1 VP3 | IT | PAIR_FAIL | **PASS** | A10·A4·A5·A6 잡음 |
| DV1-P2 | ST | PASS | PASS | A1 잡음, F1 반례 PASS 유지(production 무변경) |
| V1 VP2 | ST | PAIR_FAIL | **PASS** | A11·P11–P13 잡음 |
| DV1-P1 | AT | PASS | PASS | A12·A13·A2·A3·PL1 잡음 |
| V1 VP1 | AT | PASS | PASS | A2·A4·A8·A13·A18·A19 잡음 |
| V1 VP5 | AT | BLOCKED_BY:V1 VP2 | **PASS** | VP2 root 해소, A2·A4·A11 잡음 |

| AC | 결과 | 근거 |
|---|---|---|
| AC1–AC4·AC6·AC7 | ✅ | r1과 같은 축 잡음(A2·A3·PL1·A4·A13·A5·A8·A10·A12·A24), renderer 377파일 green |
| AC5 실패·stale을 성공으로 표시하지 않음 | ✅ | A6·P11–P13 잡음 |
| AC8 동시 편집 보존·무오류·순서 | ✅ | A13·A14·A15 잡음 |

- 합계 재측정: `✅ 8 · ❌ 0 = 8`. 자기보고 `Criteria-Met: 8/8`(`7675171`) 일치.
- §10: V1 EP1–EP7 22/22 · FEP3·4·5·6·9·10·11 6/6 경계 PASS. 목록 밖 발견 없음.
- 운영 gate: [0281 verify r2](../0281-opencode-menu-cache/verify.md#r2-운영-gate-head-e42d1e2)와 같은 HEAD 실행 — typecheck 0 · lint 0 error · renderer 377/3078 · main 17 red 전부 Windows 전용 · CI #857(windows-latest) green.

## r2-11. Repository operation checks

- INDEX: `impl/IMPL_DONE`(r2) → PASS, archive 이동. `7675171`·`3e452da` `git cat-file -t` = commit, 각 trailer 5키 파싱. 테스트는 0278 trailer 커밋에 있으나 0279 r2 보고가 그 공유를 명시한다.
- `[구현자 기입] ΔV2 r2` 7필드, 강제 지점 표 존재.

## r2-13. Finding disposition

| # | r2 상태 | 근거 |
|---|---|---|
| D1 | closed | A6 잡음 |
| D2 | closed | A15 잡음 |
| D3 | closed | P11·P12·P13 잡음 |
| N1 | NON_BLOCKING 유지 | A7 동치 재확인 |
| N2 | closed | `7675171`이 0279 trailer와 자리별 표를 갖고 공유 테스트 커밋을 가리킨다 |

## r2-15. 결론

- 상태: **PASS** — verify 2회째. pair 10/10 PASS, PLAN_GAP 없음, AC ✅8/8.
- 남은 사람 확인: 실제 Windows Electron의 plugin 토글·두 테마 패널(AC 밖).
