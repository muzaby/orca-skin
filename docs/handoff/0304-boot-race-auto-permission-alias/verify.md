# Verify — 0304-boot-race-auto-permission-alias

> 판정(r2): **PASS** (verify 2회째, 창 안). 막는 발견 0 · REQUIRED 14·REGRESSION 2 pair PASS · 현재 변경 gate PASS. 남은 것은 AC13 사람 실기(Windows 설치본·실제 SDK)뿐이다.

## r2 메타

| 항목 | 값 |
|---|---|
| 검증자 · 일자 | Claude Code · 2026-11-10 |
| 대상 range | `a0a95f7..8cf0d223` — 테스트 2파일만(`git diff --stat`: `send.permission-mode.test.ts`·`chatReducer.model.test.ts`), production 변경 0 |
| 기준선 | `fb2155e3`(ΔV2 설계) ↔ `8cf0d223`(r2 구현) — 설계·구현 별도 커밋. 구현이 바꾼 plan.md는 `[구현자 기입]` 절뿐, Decision·AC·V·§10 규범 행 변경 없음 |
| V / 확장 창 | `V1 rev.2 + ΔV1 + ΔV2` · verify 2회째 — 창 안. 새로 열린 ΔV 노드: VP-12(EP-3 ⑥)·VP-17(EP-8 ②) |
| 독립 축(⑥) | 6건 — J1~J5(spec에 없던 변이) + 셔플 순서 실행 |
| 열거 sweep(⑦) | 구현자 spec 73행 전수 재실행 — red 73/73, 원복 확인 "모든 파일 원문 그대로", 이후 `git status` 깨끗 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(S1, 아래) |

## r2 §1 D1·D2 닫힘 재확인 (하한 ②)

| ID | 변이 | r1 결과 | r2 결과 | 잡은 테스트 |
|---|---|---|---|---|
| I1-record-time | `send.ts:297` `Date.now()` → `0` | 못 잡음 | **잡음** | `send.permission-mode.test.ts` 1 failed · 13 passed — 3번째 인자 정확값 `1794326400123`(스텁은 `afterEach`에서 `restoreAllMocks`) |
| I2-stale-evidence | `chatReducer.ts:1672` `?? null` → `?? state.modelResolved` | 못 잡음 | **잡음** | `chatReducer.model.test.ts` 2 failed · 17 passed — `it.each` 2 kind(Work→`default`·Code→`accept_edits`) |
| I3-send-priority (하한 ④) | `send.ts:556` `permissionModel ?? model` 뒤집기 | 잡음 | **잡음** | `send.permission-mode.test.ts` 1 failed |

D1·D2 모두 닫혔다. I1·I2 둘 다 `green → red`이고, 덮개 회귀(`red → green`)는 없다 — 이번 diff가 닿은 두 oracle을 쓰는 기존 70행이 전부 red.

## r2 §2 독립 축 고장 이력 (⑥ — 구현자 spec 밖)

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| J1-time-plus1 | `send.ts:297` | 다른 값 | `Date.now()` → `Date.now() + 1` | 잡음 | send 스위트 1 failed — 정확값 단언이 `expect.any(Number)`로는 못 보던 오프셋을 잡음 | — |
| J2-setmodel-coerce-stale | `chatReducer.ts:1681` | 뒤집기 | SET_MODEL 권한 보정 증거 `action.modelResolved` → `state.modelResolved ?? action.modelResolved` | 잡음 | reducer 스위트 2 failed | — |
| J3-agentkind-evidence-drop | `chatReducer.ts:861` | 제거 | SET_AGENT_KIND 증거 → `undefined` | 잡음 | reducer 1 failed | — |
| J4-setperm-evidence-drop | `chatReducer.ts:1629` | 제거 | SET_PERMISSION_MODE 증거 → `undefined` | 잡음 | reducer 3 failed | — |
| J5-setmodel-null-vs-undefined | `chatReducer.ts:1672` | 다른 값 | `?? null` → 무폴백(증거 부재 시 `undefined`) | 잡음 | reducer 2 failed — 단언이 `null`을 구별 | — |

시도 78(구현자 73 + 검증자 5) · 잡음 78 · 못 잡음 0 · 동치 0 · 경계 0. 소거 변이 잔여물: 변이는 값 치환이라 해당 없음. 동작 보존 추출 라운드 아님(③ r1의 `못 잡음` I1·I2는 위 표로 소진).

**셔플 순서(⑥)**: `vitest run --sequence.shuffle --sequence.seed=N send.permission-mode.test.ts` — seed 3에서 `0304 resolved send > records resolved model before runtime and carries separate alias evidence`가 `expected undefined to match object { model: 'haiku', … }`로 실패(seeds 1·2·4~8 통과). 같은 시드가 r1 버전 파일(`fb2155e3`의 테스트)에서도 실패하고, 0304 이전 파일(`c7c9e9d`, 10케이스)은 seeds 1~8 전부 통과 — **r2 diff가 만든 것이 아니라 r1이 더한 0304 테스트의 순서 의존**이다. reducer 파일은 seeds 1~6 통과.

## r2 §3 V-pair closeout

| Pair | 결과 | 직접 oracle 좌표 · 근거 |
|---|---|---|
| VP-12 | PASS | `chatReducer.model.test.ts` 신규 `it.each` 케이스(2 kind) — 규칙 (a) 증거 있음·(b) 부재=`null` 둘 다 입력 보유, 실행 구간은 `chatReducer` 순수 호출이라 mock 0. 변이 I2·J2~J5 red |
| VP-17 | PASS | `send.permission-mode.test.ts:422-` `records resolved model before runtime…` — 4인자 `session-1`/`pk-b`/시각/`haiku`가 서로·기본값과 구별. mock은 db 포트뿐이고 기록 호출은 구간 안. 변이 I1·J1·EP8 6행 red |
| 나머지 REQUIRED 12 · REGRESSION VP-14·15 | PASS | r1 PASS 좌표 그대로 — production 변경 0, 구현자 spec 70행 전부 red 재현, 전체 vitest에서 좌표 파일 실패 0 |

§10 자리 목록: production 파일 변경 집합이 ∅(`git diff a0a95f7..8cf0d223 -- app/src`는 테스트 2파일)라 자리·검색 결과가 r1과 같다. r1 검색 5종 중 EP-8(`rg "sessionModelRecordFor|updateSessionProviderKey\("`)을 다시 돌려 `turn-context.ts:19` helper 1 · `send.ts:294` 호출 1 · `writer.ts:187·354` 2 · `queries.ts:579` 정의 1 — 차집합 ∅.

### AC · 합계

| AC | 결과 |
|---|---|
| AC1~AC12·AC14·AC15·AC17 | ✅ (r1 PASS 좌표 유지, 위 sweep 재현) |
| AC16 | ✅ — 4인자 시각 항 정확값, I1·J1 red |
| AC13 | ⚠️ — Windows 설치본·실제 SDK 실기 대기(사람) |

합계 재측정: ✅16 · ⚠️1 · ❌0 = 총 17 (AC ID `{1,2,3,3b,4,5,6,7,8,9,10,12,14,15,16,17,13}`, AC11 폐기 제외). 본문·`Criteria-Met: 16/17`·INDEX 비고 사본이 일치한다.

## r2 §4 gate (환경: `npm ci --ignore-scripts` → `npm rebuild better-sqlite3`(Node ABI) → `node node_modules/electron/install.js`)

| 명령 | 관측 |
|---|---|
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-test-budgets` | 3종 exit 0 — "20 real-git suites ok · all budget sites scaled" |
| `npm run typecheck` | node·web·test 모두 exit 0 |
| `npx eslint ./src ./scripts` (`--fix` 없음) | 0 error · 2 warning(기존 `react-hooks/incompatible-library`) |
| `./node_modules/.bin/vitest run` (필터 없음) | 945파일 — **9 failed · 932 passed · 4 skipped**, 22 케이스 실패 · 8,913 passed. 구현자 보고(8,890 passed·46 failed)와 건수가 다르다 — 환경(Electron 바이너리 유무)·집계 단위 차이로 추정하며 원인은 확인하지 않았다 |
| `node --test scripts/*.test.mjs` | tests 827 · pass 827 · fail 0 |

- 실패 9파일은 모두 이번 diff가 만진 파일이 아니다: `opencode/v1/adapter.{instances,persistent}.test.ts`·`adapter.test.ts`(Windows 경로 `C:/…` 단언) · `app/composer-catalog.test.ts`·`composer-preparation-service.test.ts`(절대경로 판정) · `claude/{adapter.native-plugins,native-resources,project-reconciliation}.test.ts`·`handlers/session-resources.claude-assembly.test.ts`(`restart-required` — 다른 OS 경로). r1이 같은 베이스라인에서 잰 "9파일·22케이스"와 파일 수·케이스 수가 같고 원인은 환경(다른 OS 전용 경로)이다. 케이스 이름 단위 대조는 하지 않았다.
- `[test-pools]` 가드·예산 가드 실패 0. 수정한 두 테스트 파일은 unit 풀 가드를 통과했다(전체 실행에서 두 파일 33케이스 green).
- 작업 트리: gate가 만든 변화 없음(`git status` 깨끗). 잔여물 `app/node_modules`.

## r2 §5 repository operation checks

- 커밋 `8cf0d223` trailer 파싱: `Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 16/17`·`Criteria-Pending`·`Verified-By: pending` — 허용값 ✓, 6키 그대로 반환.
- `[구현자 기입]` r2 7필드(설계 리뷰·강제 지점 전수·잠금·Product/UX·잠재 문제·구현 보고·Review Signals) 존재. 강제 지점 표는 7행으로 EP 32자리 전부를 담는다.
- 좌표: `402c23a`·`e87d9bc`·`eb5ecdb`·`758309f`·`ec77831`·`c7c9e9d`·`a0a95f7`·`41bb8d6` — `git cat-file -t` commit, `origin/main` 조상. `fb2155e3`(ΔV2 설계)·`8cf0d223`(r2 구현)은 commit이지만 **`origin/main`에 아직 없다**(PR 브랜치 해시 — rebase 병합 시 바뀐다).
- INDEX 비고 5줄 이내 ✓. AGENTS 변경 없음.

## r2 §6 Finding disposition

| # | finding | 분류 · 근거 | disposition |
|---|---|---|---|
| S1 | `send.permission-mode.test.ts`의 0304 케이스가 `--sequence.shuffle --sequence.seed=3`에서 실패(순서 의존) | **비귀속** — 기본 순서·`ci.yml`은 셔플을 쓰지 않아 어떤 gate·AC·§10 oracle도 이 순서를 요구하지 않고, 불변식 잠금 공백이 아니라 테스트 격리 위생이다. r1에서 도입됐고 r2 diff와 무관 | NON_BLOCKING → INDEX 후보 표 1행(`NEXT_HANDOFF` 독립) |
| S2 | 전체 vitest 22 실패 케이스(9파일) | 비귀속 — 환경(다른 OS 경로), r1 베이스라인과 파일·케이스 수 동일 | NON_BLOCKING |

## r2 Review Signals — 사실만

- 이전 라운드와 같은 증상: 없음. r1의 두 발견(D1 이행·D2 확장)은 이번에 `green → red`로 닫혔다.
- 사용자 결정 변경 근거: 없음(ΔV2는 verify r1 D2 채택·D1 입력 명시).
- 환경 한계: Electron 바이너리·better-sqlite3 바인딩 부재(`--ignore-scripts`)를 설치 뒤 복구, 다른 OS 경로 9파일 잔존.
- 독립 축(⑥): J1~J5 + 셔플 → 발견 1(S1, 비귀속).
- 판단 호출: S1을 확장 후보가 아니라 비귀속으로 분류했다 — 셔플 독립성을 요구하는 계약이 없어서다. 반대로 읽으면 창 안 `PLAN_GAP`이 되므로 사용자가 다른 분류를 원하면 알려 달라.

## r2 결론

- 상태: **PASS** · verify 2회째(창 안) · 후보 표로 간 항목 1(S1) · BLOCKED_BY 0 · PLAN_GAP 0
- Product/UX·ACTIVE Decision 충족. AC ✅16 · ⚠️1(AC13 사람 실기)
- 남은 사람 확인: AC13 — Windows 설치본 콜드 부팅 로그, 실제 SDK `status`, 다음 턴 자동 승인 실행

---

## 이전 라운드

> r1 판정: **RETURN_TO_PLAN** (verify 1회째, 창 안). 이행 결함 1(`BLOCKING`, VP-17) · 확장 후보 1(`PLAN_GAP`, VP-12). 나머지 REQUIRED·REGRESSION pair와 현재 변경 gate는 PASS.

### 메타

| 항목 | 값 |
|---|---|
| slug | `0304-boot-race-auto-permission-alias` |
| 검증자 | Claude Code |
| 일자 | 2026-11-10 |
| 대상 커밋/range | `c7c9e9d..a0a95f7` (`a0a95f7` = r1 구현, `origin/main` 조상 확인) |
| 구현 전 plan 기준 | `c7c9e9d` (설계와 구현이 별도 커밋 — 기준선이 diff로 성립) |
| V mode / 유효 V | `Delta V` / `V1 rev.2 + ΔV1` |
| 검증 기준 plan revision | `c7c9e9d:V1 rev.2` · `c7c9e9d:ΔV1` |
| 라운드 | 1 |
| 상태 | RETURN_TO_PLAN |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV로 다시 열린 노드: 없음 |
| 독립 축(⑥) | 4건 — `updated_at` 값 · `SET_MODEL` stale 증거 · send 증거 우선순위 · 부팅 대기 중 cwd 사용자 선택 가드 (구현 보고·spec에 없음) |
| 열거 sweep(⑦) | 1회째 전수 — spec 70건 전부 재실행, 못 잡음 0 |
| 발견 분류 | 이행 1 · 현재 0 · 확장 1(막음 1 / 후보 표 0) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현 Codex. 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 |

### 0. 기준선 / plan validity

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — `[구현자 기입]` 절만 추가(`git show --stat a0a95f7`: plan.md +194/−38). Decision·AC·V·§10 규범 행 변경 없음.
- Decision Ledger / Product·UX / AC / V·§10·oracle 변경: 없음. 채점 원 기준 = `c7c9e9d`의 plan.
- 창 밖 ΔV: 해당 없음.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 상속 기준 | 유효 | `eb5ecdb`(V1 rev.2) `origin/main` 조상 확인 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | VP-01~13·16·17 |
| INHERITED ↔ REGRESSION | 유효 | VP-14·15 |
| §10 자리 목록 차집합 | 유효 | 아래 검색 5개 재실행, 차집합 ∅ |
| 적대 증거 선택 | 유효 | VP-03·06·07·17 |
| SUPERSEDED pair 이관 | 유효 | VP-11 폐기 근거 §7-A |
| 운영 gate 열거 | 유효 | §7-A 표 4행 |

재실행한 자리 검색(`app/`): EP-1 `rg -Un "(sessionApi\s*\.cwd|updateApi\s*\.state)\("` → `chatStore.ts:2220-2221`·`updateStore.ts:161` 2자리 · EP-8 `rg "sessionModelRecordFor|updateSessionProviderKey\("` → helper 1·send 1·writer 2·queries 1 · EP-6 `rg 'ANTHROPIC_DEFAULT_\$\{'` → 1 · EP-7 `rg preserveLocalState` → 4 · EP-4 `rg "setMode\(sessionId|setPermissionMode\(|spawnedPermissionModel"` → 목록 3자리 포함 · EP-2 `rg -l resolvedModel` → 12파일, ΔV1 13자리 + EP-3 파일 집합과 차집합 ∅.

### 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| false success | 없음 | cwd/update ready reject → 조회 0·보고 0(`chatStore.ts:2245`, `updateStore.ts:154-160`) |
| partial failure | 유지 | coordinator SDK 실패 → 저장 0(`coordinator.ts:114-123`) |
| A 대신 B 구현 | 없음 | 저장·응답 = 선택, live는 그대로 받을 때만(D-008) |
| 선영속 뒤 실패 | 수용 | D-011·plan §17 |
| `updated_at` 값 | **결함** | D1 — 시각 인자가 고정값으로 바뀌어도 green |
| 출력/요청 상한 | 해당 없음 | 부팅 invoke +2 고정 |

### 3. 역방향 탐색

`scan-surface.sh c7c9e9d..a0a95f7` 후보 중 `defaultSelection`·`resolveCliModel`·`classifyContextModel`은 테스트 전용 참조로 보이나 같은 파일 내부 호출이 실제 경로다(`modelSelection.ts`, `context-policy.ts`) — 정상. 형제 정책 비대칭 0. `toAgentEnvironment`의 `...model` spread가 `resolvedModel`을 통과시키고 IPC에서 모델을 재조립하는 자리 없음(`rg oneMillionContext`, 비테스트 6자리 확인) — 무영향.

### 4. 고장 이력

구현자 spec 70건(`mutation-spec.jsonl`)을 `mutate.py`로 전수 재실행: **70/70 red**, 원복 확인 출력 "모든 파일 원문 그대로", 이후 `git status` 깨끗. 행별 결과는 구현자 표(`plan.md [구현자 기입] 잠금`)와 일치한다. 직전 이력이 없어 ③④ 해당 없음. 형제 슬롯 맞바꿈(⑤): `EP3-send-*`·`EP8-helper-session/model`(providerKey↔payload 계열)이 포함된다.

독립 축(⑥) — spec에 없던 변이:

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|---|
| I1-record-time | `send.ts:297` | 고정값 | `Date.now()` → `0` | **못 잡음**(44 passed) | `send.permission-mode.test.ts:432`가 `expect.any(Number)` | 이행(D1) |
| I2-stale-evidence | `chatReducer.ts:1672` SET_MODEL | 뒤집기 | `action.modelResolved ?? null` → `?? state.modelResolved` | **못 잡음**(306 passed) | 증거 없는 모델로 바꾸는 입력이 어떤 테스트에도 없음 | 확장(D2) |
| I3-send-priority | `send.ts:556` | 뒤집기 | `permissionModel ?? model` → `model ?? permissionModel` | 잡음 | `send.permission-mode.test.ts` 1 failed | — |
| I4-cwd-revision-guard | `chatStore.ts:2223` | 제거 | `cwdRevision` 비교 제거 | 잡음 | `chatStore` 스위트 1 failed | — |

검산: 시도 74 = 잡음 72 · 못 잡음 2 · 동치 0 · 경계 0. 소거 변이 잔여물 해당 없음. 동작 보존 추출 라운드 아님.

### 5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거(좌표 실재 확인) | §10 |
|---|---|---|---|---|
| VP-01·04·13 | R·SD·MD | PASS | `chatStore.bootGate.test.ts:37·48·57`, `updateStore.bootGate.test.ts` — spec 7행 red | 2/2 |
| VP-02·06 | R·AR | PASS | `model-parser.test.ts`·`models.test.ts`·`modelSelection.test.ts:98`·`Composer.selection.test.ts:303·349`·`chatStore.modelPermission.test.ts:43` — spec 21행 red, typecheck 변이 2행 red | 13/13 |
| VP-03·10 | R·MD | PASS | `coordinator.permission.test.ts:145` 외 — spec 7행 red(호출 대체·맞바꿈 포함) | 3/3 |
| VP-05·07·09 | SD·AR·MD | PASS | `send.permission-mode.test.ts`·`continuation.test.ts:235`·`chat-turn-continuation.test.ts`·`permission-mode.test.ts`·`session-runtime.test.ts` — spec 20행 red, I3 red | 8/8 |
| VP-08 | MD | PASS | `model-identity.test.ts` — spec EP6 6행 red | 2/2 |
| VP-12 | MD | **PASS, D2 확장 후보** | `chatReducer.model.test.ts:192·228` — spec 5행 red, I2 green | 8 중 ⑥ |
| VP-16 | R | PASS | `chatReducer.model.test.ts:192` — spec EP7 2행 red | 2/2 |
| VP-17 | AR | **PAIR_FAIL** | `turn-context.test.ts`·`send.permission-mode.test.ts:429-485`·`send.busy.test.ts` — spec 8행 red, **I1 green** | 2/2 중 시각 인자 미잠금 |
| VP-14·15 | SD | PASS(REGRESSION) | 전체 vitest에 포함(`steps.test.ts`·`bootstrap.settings-early.test.ts`) | 0 |

- root `PAIR_FAIL`: VP-17(D1). 종속 `BLOCKED_BY` 없음.
- 좌표 실행 구간: `send.permission-mode.test.ts`는 `handleChatSend` 조립으로 들어가 `ctx.db.updateSessionProviderKey` mock 인자를 관측한다 — mock한 것은 db 포트뿐이고 기록 호출 자리는 구간 안이다. 3번째 인자만 `expect.any(Number)`라 그 항은 기본·형제 구별이 없다(plan §공통 V "운반 항별 구별 입력").

### AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·2·3·3b | ✅ | bootGate 2파일, spec EP1 7행 red |
| AC4~AC8 | ✅ | parser·modes·store·send·model-identity |
| AC9·AC10·AC12 | ✅ | coordinator 5행+resolved alias·context-policy |
| AC14·AC15 | ✅ | `chatReducer.model.test.ts:192` |
| AC16 | ⚠️ | 인자 4개 중 시각 미구별(D1) — 나머지 3항은 red |
| AC17 | ✅ | helper null 입력·`send.busy.test.ts` busy 0 |
| AC13 | ⚠️ | Windows 설치본·실제 SDK 실기 대기 |

- **합계 재측정**: ✅15 · ⚠️2 · ❌0 = 총 17 (AC ID `{1,2,3,3b,4,5,6,7,8,9,10,12,14,15,16,17,13}`, AC11 폐기 제외) · 구현자 보고 `16/17` ↔ 이번 재측정 15/17 · **불일치(AC16)**.
- 합계 사본: plan 본문 16 · 커밋 trailer `Criteria-Met: 16/17` · INDEX 비고 `AC 16/17` — 서로 일치(구현자 기준).

### 7. 숫자 재측정

`updateSessionProviderKey` 비테스트 호출 4(정의 1 + writer 2 + send 1) — AC15 정정과 일치. EP 분모 합 32 = 구현자 표 32.

### 8. 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC13 | 순서·live 호출·선택 유지·전송 기록 전부 vitest | Windows 설치본 콜드 부팅 로그·실제 SDK `status`·다음 턴 자동 승인 실행 |

### 9. 게이트 재실행

환경: `npm ci --ignore-scripts` 뒤 `npm rebuild better-sqlite3`(Node ABI, 성공) · `node node_modules/electron/install.js`(Electron 바이너리).

| 명령 | 관측 |
|---|---|
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-test-budgets` | 모두 exit 0 (20 real-git suites ok) |
| `npm run typecheck` | node·web·test exit 0 |
| `npx eslint ./src ./scripts` (`--fix` 없음) | 0 error · 2 warning(기존), 작업 트리 변화 없음 |
| `vitest run` 전체(바인딩 복구 후) | 945파일 중 29 failed · 22 케이스. Electron 설치 뒤 29→9파일 · 22케이스 |
| 기준선 `c7c9e9d` 같은 9파일 | 동일 9 failed · 22 케이스(Windows 경로 단언·`restart-required` 등 다른 OS 전용) — 파일 집합·건수 동일, 케이스 이름 단위 대조는 하지 않음 |

- 이번 변경이 추가·수정한 파일의 실패: 0(실패 9파일은 모두 미수정). `[test-pools]` 가드 실패 0.
- `node --test scripts/*.test.mjs`는 이번 턴 미실행(구현자 보고 827/827은 참조 값).
- 게이트가 작업 트리를 바꿨는가: 없음. 잔여물: `app/node_modules`·검증 worktree(제거함).

### 11. Repository operation checks

- INDEX: 상태 IMPL_DONE·다음 주체 Claude 하나 — 실제와 일치. 대상 커밋 자리표시자를 검증자가 채움: r1 구현 `a0a95f7`, 설계 `402c23a`·`e87d9bc`·`eb5ecdb`·`758309f`·`ec77831`·`c7c9e9d` — 전부 `git cat-file -t` commit · `origin/main` 조상.
- trailer: `git log -1 --format='%(trailers:only=true)' a0a95f7` → Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By 6키 파싱 ✓, 허용값 ✓.
- `[구현자 기입]` 7필드(설계 리뷰·강제 지점 전수·잠금(sweep 포함)·Product/UX·잠재 문제·구현 보고·Review Signals) 존재.
- AGENTS 변경 없음.

### 13. Finding disposition

| # | finding | 분류 · 근거 | 귀속 | disposition | root / 영향 | 후속 |
|---|---|---|---|---|---|---|
| D1 | send 선영속의 `updated_at` 인자를 `0`으로 바꿔도 green | **이행** — AC16 검증 수단 "인자 4개 구별 값"(`plan.md` §7 AC16 행)을 어김: 4번째가 `expect.any(Number)`(`send.permission-mode.test.ts:432`), I1 재현 | VP-17·AC16·EP-8 | BLOCKING (`PAIR_FAIL`) | root VP-17 | 구현: 시각을 고정(fake timer 또는 `Date.now` 스텁)하고 정확값 단언 |
| D2 | `SET_MODEL`이 증거 없는 모델로 바꿀 때 이전 `modelResolved`를 지워야 하는 분기가 무잠금 | **확장** — §10 "선택적 필드 의미: `resolvedModel` 부재 = … `model`로 폴백"은 표 밖 문장이라 규칙 칸 분기 인용으로 보기 어렵다(해석 필요). 트리에는 현재 결함 없음(코드는 `?? null`) | VP-12·EP-3 ⑥ | PLAN_GAP (창 안) | VP-12 | planner: UT 입력 채택(증거 모델 → 증거 없는 모델 전환) 또는 경계 선언 |
| D3 | `node --test scripts/*.test.mjs` 미실행 | 비귀속 | 운영 gate | NON_BLOCKING | — | 구현자 보고 827/827 참조, CI 몫 |

> D2가 `PLAN_GAP`이라 판정은 `RETURN_TO_PLAN`이고 다음 주체는 설계자다. D1은 창과 무관하게 막으므로 설계 정정 뒤 구현 턴이 고친다.

### 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(1회째). 다만 "기록 인자 중 한 항이 `expect.any`로만 단언"은 0265 r2(운반 값 구별) 형태.
- 관련 plan 지침: AC16 "인자 4개 구별 값" · §공통 V 운반 항 구별 — 있었음.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: Electron 바이너리·better-sqlite3 바인딩 부재(`--ignore-scripts`), 복구 뒤에도 Windows 경로 단언 9파일.
- 독립 축(⑥) 발견: 4건 시도 → 못 잡음 2 (이행 1 · 확장 1).

### 15. 결론

- 상태: **RETURN_TO_PLAN**
- verify 횟수: 1회째 — 확장 창 안
- 후보 표로 간 확장 후보: 0 (D2는 창 안이라 `PLAN_GAP`)
- pair 결과: REQUIRED/REGRESSION PASS 15(VP-01~10·12~16 중 VP-12는 D2 확장 후보 동반) · root PAIR_FAIL 1(VP-17) · BLOCKED_BY 0
- PLAN_GAP: D2 → 영향 pair VP-12
- Product/UX 및 ACTIVE Decision 충족: 충족(D-001~D-004·D-007~D-009·D-011 코드·테스트 대조)
- AC 충족: ✅15 · ⚠️2(AC13 사람 실기, AC16 D1) · ❌0
- 현재 변경 운영 gate: PASS (기준선 9파일·22케이스 동일, `node --test`는 미실행)
- 남은 사람 확인: AC13
- 다음 단계: 설계자가 D2를 채택(UT 입력 행)하거나 경계로 선언하고 AC16 시각 항 입력을 §10 EP-8에 고정 → 구현자가 D1을 고치고 재검증.
