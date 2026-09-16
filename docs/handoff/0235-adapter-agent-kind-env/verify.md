# Verify — 0235-adapter-agent-kind-env

## 메타

| 항목 | 값 |
|---|---|
| slug | `0235-adapter-agent-kind-env` |
| 검증자 | Claude Code |
| 일자 | 2026-09-16 |
| 대상 커밋/range | `34f3b10..66f73a4` |
| 구현 전 plan 기준 | `34f3b10` (plan/READY) |
| V mode / 유효 V | Baseline V: V1 |
| 검증 기준 plan revision | `34f3b10`:V1 |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다 — 설계·구현은 Codex(`Agent: codex` 두 커밋), 검증은 Claude Code. §4 추가 축은 그럼에도 4건 수행했다. |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — `git diff 34f3b10..66f73a4 -- .../plan.md` 삭제줄 34개가 전부 `구현 턴에서 작성` 자리표시자와 메타 3행(`상태`·`다음 주체`·`이번 턴 경계`)이다.
- **기준선이 diff로 성립하는가**: 예 — 설계 `34f3b10`(`Status: designed`)과 구현 `66f73a4`(`Status: implemented`)가 분리돼 있다.
- Decision Ledger 변경: 없음 — D-001~D-010 행에 `+`/`-` 0줄.
- Product/UX Contract 변경: 없음 — §1~§7 본문 삭제줄 0.
- AC 변경: 없음 — §7 표 7행 전부 원문 유지.
- V node/pair·requiredness·§10·oracle 변경: 없음 — §7-A pair 13행·§10 EP 14행 삭제줄 0.
- 채점에 사용할 원 기준: `34f3b10`의 AC1~AC7 · D-001~D-009 · VP-01~VP-13 · EP-01~EP-14.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 신규 port·신규 정책 모듈이라 상속할 기존 V 없음. `기준 V: none`이 §7-A 판정과 일치. |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | NEW node 7쌍(R/AT·SD-01/ST-01·AR-01·02·MD-01·02) 전부 REQUIRED pair 보유. |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | SD-02/ST-02(0188·0190 snapshot·respawn)만 INHERITED이고 VP-09가 REGRESSION. |
| pair별 path·§10 전수·직접 oracle | 유효 | 13 pair 전부 `start → edges → end`·EP 목록·oracle 칸이 채워져 있다. |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 배선(M1·M2·M5)·순서(M3)·삭제(M4)만 선택하고 순수 표(VP-12)·기존 종단(VP-06·09)·gate(VP-07)는 `not selected` 사유를 적었다. |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | lint·typecheck·관련 vitest·doc-inventory·trailer가 §7-A/§19에 열거됐고 무관한 기존 실패를 blocking으로 올리지 않았다. |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음 — V1이 plan에 명시돼 있다.
- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 adapter가 정책 소유 | `harness-config`에 adapter id 분기 0 | `harness-config.ts:379-382`은 patch만 순회한다; `rg 'claude'` 조립부 0건 |
| D-002 입력은 `AgentKind` 하나 | port 시그니처가 kind 단일 인자 | `types.ts:75` `agentSpawnEnv(agentKind: AgentKind)` |
| D-003 set + 명시 제거 | `string \| null` patch | `harness-config.ts:176` `Readonly<Record<string, string \| null>>` |
| D-004 모든 레이어 뒤 적용 | legacy spread 후 set/delete | `harness-config.ts:367-383` — spread 5층 뒤 루프 |
| D-005 Work=3키 `1`, Code=3키 제거 | 정책 SSOT 1곳 | `claude-agent-kind-env.ts:4-18`; 저장소 전체 키 검색에서 production 정의는 이 파일뿐 |
| D-006 harness는 범용만 | patch·hoist·fingerprint만 소유 | `prepareHarnessConfig` 인자에 adapter id 없음 |
| D-007 전 경로 동일 정책 | 두 호출부·두 조립 갈래 | `resolve-turn.ts:89`·`send.ts:561`; `:219`·`:246` |
| D-008 `Backend` 미확장 | union 변경 0 | `git diff -- src/shared/ipc.ts` 0줄 |
| D-009 runtime port 유지 | `contracts/ports.ts` 불변 | `git diff --numstat -- src/main/contracts/ports.ts` 출력 없음 |

### end-to-end 흐름

```text
send(payload.agentKind) → resolveAgentKind + DB/lease 검증(send.ts:122-137)
  → resolveTurn(..., {...payload, agentKind})(send.ts:188)
  → resolveTurnProvider({adapter, agentKind: identity.kind})(resolve-turn.ts:89)
  → adapter.agentSpawnEnv(kind) 1회(resolve-turn.ts:176)
  → prepareHarnessConfig / prepareUnresolvedHarnessConfig(:219 / :246)
  → legacy 5층 spread → patch set/delete → envFingerprint(harness-config.ts:379-386)
  → prepared.env 를 worktree(send.ts:232) · title(:279) · chat TurnRequest(:499) · continuation(continuation.ts:94) 이 공유
  → adaptExecutionConfig(claude.ts:330 complete / :501 sendMessage) → SDK Options.env
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 새 실패 모드 0 | 정책은 동기·순수이고 동결 literal을 반환한다(`claude-agent-kind-env.ts:4,10`). 새 await·throw·리소스 0. |
| false success 가능성 | 없음 | `buildsEnv`에 `hasAdapterEnvPatch`가 들어가 patch가 있으면 env를 반드시 만든다(`:364`). 이 항을 지우면 조용한 no-op이 되는데 M-D가 red로 잡는다. |
| partial failure/rollback | 해당 없음 | 외부 상태 쓰기 0 — 요청별 객체만 변형한다. |
| Product/UX의 A가 아닌 다른 B를 구현했는가 | 아니다 | 요구 3키·두 kind·adapter 소유가 코드에 1:1로 있다. |
| 증상만 제거하고 상태 변화가 남았는가 | 해당 없음 | 삭제는 요청별 `env` 사본에서만 일어나고 `process.env`·디스크 settings는 불변(`auth.md:558` 재확인). |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | patch는 캐시가 아니라 턴마다 1회 계산이고, fingerprint는 patch **후** env로 계산한다(`:386`). |
| 출력/요청 worst-case 상한 | 유한 | patch key 3개, 새 네트워크/디스크 호출 0. `O(E+P)`, `P=3`. |
| 항상-env 조립으로 바뀐 부작용 | 회귀 없음 | `providerSettingsChangedSinceSpawn`이 참조 비교 실패 시 `JSON.stringify` 비교로 떨어져(`runtime-boundary.ts:24-25`) 매 턴 새 hoist 사본이 respawn을 유발하지 않는다. |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 34f3b10..66f73a4
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export `PrepareHarnessConfigInput` | 정상 | 타입 전용, 같은 파일 `prepareHarnessConfig` 시그니처가 쓴다. 이번 diff 이전부터 존재. |
| 테스트 전용 `buildTurnContent`·`SpawnEnvTarget` | 비귀속 | 둘 다 이번 diff가 만들지 않았다(`git diff`에 해당 심볼 추가 0). 이번 pair·Decision과 무관. |
| 형제 정책 비대칭 | 없음 | 스크립트 0건. `ClaudeAdapter`·`MockAdapter` 둘 다 같은 SSOT로 delegate(`claude.ts:272`·`mock.ts:22`). |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `AdapterSpawnEnvPatch` 소비처는 `types.ts`·`claude.ts`·`mock.ts`·`claude-agent-kind-env.ts`·`resolve-turn.ts` 5곳 전부 이번 diff. |
| producer ↔ consumer 파생 불일치 | 없음 | SDK 경계에 null 도달 0 — `prepared.env` 값 전수 string 단언이 harness 테스트에 있다. |
| 동일 규칙 중복 구현 | SSOT 유지 | 3키 literal의 production 정의는 `claude-agent-kind-env.ts` 1곳. 테스트는 독립 literal 기대표를 쓴다. |
| 신규 export 프로덕션 참조 0건 | 없음 | `claudeAgentKindEnv`는 production 2곳(`claude.ts:273`·`mock.ts:23`)에서 호출된다 — 미배선 아님. |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: `env 우선순위 (AC15)`·`host-managed provider spawn env (0200)`·`chat turn automatic continuation` 세 describe 모두 실재.
- 핵심 입력/분기가 실제 실행됨: resolved/unresolved 두 갈래를 `applies one adapter policy snapshot to the %s branch` 2케이스가 실제 `resolveTurnProvider`로 통과한다 — 동명 로컬 재구현이 아니다.
- structural proxy만으로 semantic 목표를 통과시킨 AC: 없음. AC3의 "중앙 switch 부재"는 음성 grep 단독이 아니라 adapter double 반환값 소비(`result.prepared.env?.SESSION_KIND`)로 양성 단언된다.
- **선택된 적대 증거 재측정**: 등록 변이 5건 중 검출 5 · 미검출 0 · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이 최초 라운드라 비교 대상 없음 — 덮개 회귀 판정 불가.
- **자기검증 분모**: 구현자(Codex) ≠ 검증자(Claude). 그럼에도 구현 보고가 이름을 대지 않은 축 4건을 추가로 심었고 4건 전부 red였다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — `resolve-turn.ts:91`의 `identity.kind`를 `'code'` 리터럴로 | `resolve-turn.agent.test.ts` | 미실행 | **red** 1파일·5케이스 | VP-04·08·10 등록 변이 |
| M2 — `send.ts:561`의 `agentKind,` 줄 삭제 | `send.agent-profile.test.ts` | 미실행 | **red** 1파일·4케이스(2 pass) | VP-04·08·10 등록 변이 |
| M3 — patch를 `customEnv`보다 먼저 적용 | `harness-config.test.ts` | 미실행 | **red** 1파일·2케이스 | VP-01·05·11·13 등록 변이 |
| M4 — `null`을 `continue`로 바꿔 삭제 생략 | `harness-config.test.ts` | 미실행 | **red** 1파일·3케이스 | VP-02·05·11·13 등록 변이 |
| M5 — resolver가 adapter 호출 대신 `{}` 사용 | resolve-turn 2파일 | 미실행 | **red** 2파일·7케이스 | VP-03·10 등록 변이 |
| M-A — 정책표 형제 슬롯 맞바꿈(`code`에 Work 값) | `claude-agent-kind-env.test.ts` | 미실행 | **red** 1케이스 | 검증자 추가 축 — EP-03 |
| M-B — `ClaudeAdapter.agentSpawnEnv`만 `{}` 반환 | `claude-agent-kind-env.test.ts` | 미실행 | **red** 1케이스 | 검증자 추가 축 — EP-04(형제 지점) |
| M-C — `prepareUnresolvedHarnessConfig` 전달 인자 삭제 | `resolve-turn.runtime-catalog.test.ts` | 미실행 | **red** 1케이스 | 검증자 추가 축 — EP-11 |
| M-D — `buildsEnv`에서 `hasAdapterEnvPatch` 제거 | `harness-config.test.ts` | 미실행 | **red** 2케이스 | 검증자 추가 축 — EP-12 seam 안쪽 |

- 동작 보존 추출 라운드인가: 아니오 — 신규 계약과 신규 배선이라 hunk 되돌림 초록 문제는 발생하지 않는다.
- 소거 변이의 잔여물 수렴: M-B·M-C는 잔여 unused import 0으로 1단계에서 진단이 이미 0이고 그 상태의 스위트가 red였다.
- 형제 슬롯 맞바꿈 변이: 수행 — `code`↔`work` 두 슬롯을 한쪽으로 접은 M-A가 red. 존재만 보는 단언이 아니라 literal 기대표라 침묵하지 않는다.
- `N회` 기준의 실제 관측 주체: `agentSpawnEnv` 1회 호출을 `toHaveBeenCalledOnce()`로 **adapter double 자신**에서 센다(resolved·unresolved 각 1케이스).
- 순서 기준의 관측 훅/로그: 5층 전부 `0`, patch `1`인 fixture의 최종값으로 순서를 관측한다 — 호출 순서 mock이 아니라 결과값이다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-12 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | `returns the literal work/code policy table` 2케이스 + 동결 단언 | `AgentKind`→patch / EP-03 1/1 |
| VP-13 | MD-02 ↔ UT-02 / UT | REQUIRED | **PASS** | set·delete·empty·host-managed 4케이스; M3·M4 red | legacy env+patch→final / EP-10·12 2/2 |
| VP-03 | AR-01 ↔ IT-01 / IT | REQUIRED | **PASS** | 필수 port typecheck 3구성 + adapter double 반환 소비; M5 7 red | registry→port→resolver / EP-01·02·04·05·09 5/5 |
| VP-10 | AR-01 ↔ IT-01 / IT | REQUIRED | **PASS** | 구현체 2/2·호출부 2/2·조립 갈래 2/2 재측정; M1·M2·M5 red | contract→Claude/Mock→resolver / EP-01…09 9/9 |
| VP-11 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | resolved/unresolved 각 `SESSION_KIND: 'work'`; M-C red | patch→두 조립→prepared / EP-09·10·11·12 4/4 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **PASS** | 5층 `0` 충돌에서 세 값 `1`; M3 red | Work send→policy→final env→SDK / EP-03·04·06·09·10·12 6/6 |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | **PASS** | 5층 `1`에서 세 키 부재 + 값 전수 string; M4 red | Code send→null→delete→SDK / 같은 6/6 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | **PASS** | 최초·resume·fork/handoff 3케이스가 `agentSpawnEnv('work')` 관측; continuation 2호출 `agentKind` 일치 | DB/lease kind→두 갈래 / EP-06…11 6/6 |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | **PASS** | post-patch fingerprint 안정 + kind 민감; settings 원본 참조 보존 | merged→patch→HMAC→respawn / EP-10·11·12·13 4/4 |
| VP-06 | R-06 ↔ AT-06 / AT | REQUIRED | **PASS** | 전체 Vitest 526파일 4,853통과에 legacy ladder·title·listen/flush 회귀 포함 | prepared→chat/title/listen/flush / EP-10·12·13 3/3 |
| VP-07 | R-07 ↔ AT-07 / AT | REQUIRED | **PASS** | lint 0 error·typecheck 3구성·`ports.ts` diff 0·신규 의존성 0 | 기존 composition→runtime / EP-01·02·06·07·08·14 6/6 |
| VP-08 | SD-01 ↔ ST-01 / ST | REQUIRED | **PASS** | 출생 kind가 initial·continuation 양쪽에서 같은 정책에 도달; M1·M2 red | session birth→all re-resolution / EP-06…12 7/7 |
| VP-09 | SD-02 ↔ ST-02 / ST | REGRESSION | **PASS** | `chat-turn-continuation.test.ts`·`respawn-policy.test.ts` 포함 7파일 91케이스 green | prepared→SessionRuntime reuse/respawn / EP-12·13 2/2 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair와 직접 판정 범위: `harness-config.test.ts`의 forced-set/remove 2케이스가 VP-01·02·13을 함께 지지한다 — VP-13은 알고리즘 층, VP-01·02는 5층 fixture 층으로 각각 판정했다.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V의 REQUIRED 12 · REGRESSION 1 전건 + 현재 변경 운영 gate 전건.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | Work 최종 env 세 키 `1` | ✅ | `applies forced values after process, app, settings, runtime, and custom env` | send→policy→prepared.env→SDK |
| AT-02 / AC2 | Code 최종 env에 세 키 없음·null 미전달 | ✅ | `removes forced-null keys from every lower layer without leaking null to SDK env` | send→null patch→delete→SDK |
| AT-03 / AC3 | 필수 port·미래 adapter 동일 계약 | ✅ | `types.ts:75` 필수 선언 + `implements SessionAdapter` 2/2 + typecheck 3구성 | registry→port→resolver |
| AT-04 / AC4 | 전 수명 경로가 검증 kind 사용 | ✅ | resolve-turn agent 5케이스 + continuation 2호출 `agentKind` 일치 | resolveTurn + prepareContinuation |
| AT-05 / AC5 | patch 후 env가 hoist·fingerprint 단일 입력 | ✅ | `uses the post-patch env for stable and kind-sensitive fingerprints` | prepared→respawnInputs |
| AT-06 / AC6 | 비예약 키 순서·snapshot 공유 유지 | ✅ | 전체 Vitest 4,853통과·3스킵, 신규 실패 0 | prepared→TurnContext/Request/continuation |
| AT-07 / AC7 | UI·DB·IPC·권한·workspace 불변, 신규 의존성 0 | ✅ | diff 19파일에 renderer/ipc/migration 0; `package.json` diff 0 | 기존 SessionRuntime/SDK |

- **합계 재측정**: ✅ 7 · ⚠️ 0 · ❌ 0 = 총 7 (분모 = §7의 AC 행 7개를 직접 셈) · 자기보고 `7/7` · **일치**.
- **합계 사본 대조**: 본문 7/7 ↔ 커밋 trailer `Criteria-Met: 7/7` ↔ INDEX 비고 `AC 7/7` — **일치**.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-03·10 | 필수 port | EP-01 `types.ts` (1) | `types.ts:75` 필수 메서드; `implements SessionAdapter` 2/2가 구현 | PASS 1/1 |
| VP-03·10 | 좁은 준비 port | EP-02 `resolve-turn.ts` (1) | `resolve-turn.ts:39` `Pick<SessionAdapter,'id'\|'agentSpawnEnv'>`; `ports.ts` diff 0 | PASS 1/1 |
| VP-01·02·12 | Claude 정책표 | EP-03 SSOT (1) | `claude-agent-kind-env.ts:4-18`; 저장소 production 정의 1곳 | PASS 1/1 |
| VP-01…03·10 | adapter delegate | EP-04·05 (2) | `claude.ts:272`·`mock.ts:22` 둘 다 `claudeAgentKindEnv` 호출 | PASS 2/2 |
| VP-04·08·10 | kind 배선 | EP-06·07·08 (3) | `resolve-turn.ts:91`·`send.ts:561`·req 타입 필수 필드 `:170` | PASS 3/3 |
| VP-01…05·10·11 | patch 조립 | EP-09·10·11·12 (4) | `resolve-turn.ts:176` 1회 계산 · `harness-config.ts:176` 타입 · `resolve-turn.ts:246` unresolved · `harness-config.ts:379-382` 최종화 | PASS 4/4 |
| VP-05·06·09 | fingerprint 공유 | EP-13 (1) | `harness-config.ts:386` 1회 계산; 소비 `send.ts:232`(worktree)·`:279`(title)·`:499`(chat); `continuation.ts:97` | PASS 1/1 |
| VP-07 | 운영 문서 | EP-14 (1) | `auth.md:544-577`·`closed-network-extensions.md:457-463` 두 묶음 | PASS 1/1 |

- 전수 재측정: **EP 14/14**. 검증자 독립 재열거로 `implements SessionAdapter` 2 · `resolveTurnProvider(` production 호출 2 · `prepareHarnessConfig(`/`prepareUnresolvedHarnessConfig(` production 호출 2 — 구현 보고와 일치.
- 표에 없는데 같은 불변식이 필요한 지점: `settingSources: ['project','local']`로 읽히는 workspace `.claude/settings.json`의 `env` 블록(D2). AC2는 "최종 spawn env" 기준이라 위반이 아니며, 0234 D-005가 workspace `.claude` 비수정을 유지한다 → NEXT_HANDOFF.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행의 재측정: 해당 없음 — 모든 행이 자기 oracle을 갖는다.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| lint (`app/AGENTS.md` 기본 게이트) | `app/**` production 7파일 변경 | **PASS** | `0 errors, 1 warning` — warning은 `useTranscriptVirtualizer.ts:22` renderer 기존 건, 이번 diff 무관 |
| typecheck | 필수 port 추가로 구현체 전수 컴파일 | **PASS** | `typecheck:node`·`:web`·`:test` 3구성 무출력 종료 |
| 관련 vitest | plan §19가 지정 | **PASS** | 7파일 **91케이스** 통과 (자기보고 91/91과 일치) |
| 전체 vitest | branch 통합 게이트 | **PASS** | 527파일 중 526통과·1스킵 · 4,856케이스 중 4,853통과·3스킵 · 실패 0 |
| scripts 위생 | `node --test scripts/*.test.mjs` | **PASS** | `# pass 119 / # fail 0` |
| doc inventory | 현재 문서 2개 변경 | **PASS** | `generated doc ok (9 items, 98 channels)` · prose ok · links ok |
| message bus | 설계/구현 커밋 분리 | **PASS** | `34f3b10`·`66f73a4` 분리, trailer 파싱 5키/3키 정상 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `SessionAdapter.agentSpawnEnv` | 구현체 2/2가 typecheck 통과, `RuntimeSessionAdapter` doubles는 변경 없이 통과 | string=set · null=delete · empty=no-op · patch가 legacy를 이김 4의미 전부 케이스 보유 | **PASS** |
| SDK `Options.env` | `Record<string,string>`만 도달 | `Object.values(prepared.env).every(typeof === 'string')` 단언 | **PASS** |
| `auth.md` / closed-network guide | 상대 링크 전건 해석 | 우선순위 문장이 `harness-config.ts:367-383` 순서와 일치 | **PASS** |

## 7. 숫자 / 음성 기준 / 상한 재측정

- N개 소비처/파일/테스트 재측정: adapter 구현체 2 · resolver production 호출 2 · 조립 갈래 2 · 변경 파일 19(production 7 · tests 8 · current docs 2 · handoff 2) — 자기보고와 일치.
- 내역 합 = 총계: 7+8+2+2 = 19 ✓; EP 2+1+2+3+4+1+1 = 14 ✓; AC ✅7+⚠️0+❌0 = 7 ✓.
- 0건 게이트의 정당한 예외 보존: "중앙 adapter-id switch 0건"은 단독 PASS로 쓰이지 않고 M5(red)와 짝지어 판정했다.
- 총량 임계의 제거/허용 형태 분해: 해당 없음 — 임계 기반 게이트 없음.
- 출력/요청 상한 실측/계산: patch key 3 · 신규 네트워크/디스크 호출 0 · 턴당 정책 계산 1회(`toHaveBeenCalledOnce`).
- 자기보고와 갈린 수치: 전체 스위트 스킵 수(자기보고 1 ↔ 재측정 3). 원인은 `process.platform === 'win32'` 조건 2케이스(`features/artifacts/files.test.ts:25`·`input-files.test.ts:103`)이며 총 케이스 4,856은 양쪽이 같다 — 환경 차이지 회귀가 아니다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| SDK `Options.env` 실제 전달 | `adaptExecutionConfig` 경계까지 값 전수 string·키 부재를 단언 | 없음 | — |
| Claude CLI가 세 키를 실제로 해석하는지 | 해당 없음 — Orca 계약 밖 | 실기 1회 권장(비-blocking) | Work 세션에서 Task/Todo 도구 노출, Code 세션에서 미노출 확인 |

- 사람 실기로 미룬 순수 로직: 없음.

## 9. 게이트 재실행

- 실제 실행 명령:
  - `cd app && npm run typecheck`
  - `cd app && npm run lint`
  - `./node_modules/.bin/vitest run <plan §19 7-suite>`
  - `./node_modules/.bin/vitest run` (전체)
  - `node --test scripts/*.test.mjs`
  - `node scripts/check-doc-inventory.mjs --check`
- **관측한 실행 산출**(exit code 아님): 전체 527파일/4,856케이스 · 관련 7파일/91케이스 · scripts 119케이스 · lint `0 errors, 1 warning` · typecheck 3구성 무출력 · doc-inventory 9항목·98채널.
- `npm test`를 썼다면 DB 검증 필요성: 쓰지 않았다. `pretest` 대신 `npm rebuild better-sqlite3`로 Node ABI를 맞춘 뒤 `vitest run`을 직접 호출했다.
- ABI 전환/egress 403 등 환경 기인 실패와 변경 관련 실패 분리 근거: rebuild **전** 실행은 29파일·179케이스 red였고 오류 문자열이 전부 better-sqlite3 ABI 계열(`The module ... was compiled against a different Node.js version` 27건 · `Module did not self-register` 26건 · 그 정리 단계 파생 `Cannot read properties of undefined (reading 'close')` 5건)이었다. rebuild **후** 같은 명령이 실패 0 — 환경 기인이 확정됐고 코드 회귀가 아니다.
- **게이트가 작업 트리를 바꿨는가**: 바꾸지 않았다 — `npm run lint`(`--fix`) 실행 후 `git status --short` 무출력.
- **exit code 오신뢰 1건 자기 기록**: 첫 전체 실행에서 `--reporter=basic`이 vitest 4에 없어 `Startup Error`로 **0케이스 실행**됐다. 산출을 읽어 알아냈고 기본 리포터로 재실행했다. 그 exit 값을 통과로 쓰지 않았다.
- **검증 중 실행한 명령이 남긴 잔여물**: `app/node_modules`(신규 설치)·`node_modules/electron/dist`(바이너리)·`.eslintcache`·better-sqlite3 Node-ABI 바이너리. 전부 `.gitignore` 범위라 `git status --short` 무출력이며 추적 파일 변경 0. 이 컨테이너는 휘발성이고 Electron ABI가 필요한 `dev`/`build`는 재설치가 필요하다 — D3에 기록.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/관련 자동 테스트 | 6개 명령 실행·산출 기록 | — | PASS |
| AC ↔ 코드/production path | AC 7행 1:1 대조 | — | 7/7 |
| 레이어/계약/문서 형식·링크 | boundaries lint·doc-inventory | — | PASS |
| AGENTS 위생/부모-자식 모순 | 해당 없음 — `AGENTS.md` 변경 0 | — | 해당 없음 |
| 제품 의도 / Open Question | 없음 — PRD §11·TRD §15 미접촉 | — | 해당 없음 |
| UI/UX 시각 품질 | renderer diff 0 | — | 해당 없음 |
| 신규 의존성 / PR merge | `package.json` diff 0 확인 | **merge 승인** | 사람 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 해당 없음 — 이번 diff에 `AGENTS.md`·`CLAUDE.md` 변경 0파일.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: 검증 후 `verify/PASS` · 다음 주체 `—` · 대상 커밋 `34f3b10..66f73a4`로 갱신한다.
- 「다음 주체」 칸이 주체 하나만 담는가: 예.
- 대상 커밋 좌표 기입(검증자 몫): `git cat-file -t 34f3b10` = commit, `git cat-file -t 66f73a4` = commit. 구현자가 남긴 자리표시자 `(r1 구현 — 검증자 기입)`를 이 좌표로 교체한다.
- 비고 5줄 이내: 예 — 갱신 비고는 3줄.
- PASS 시 archive 이동: 수행 — `docs/archive/handoffs/INDEX-history.md`로 행 이동.

### Commit / reference 정합성

- trailer가 허용값을 따름: `Agent: codex`·`Handoff: docs/handoff/0235-adapter-agent-kind-env/`·`Status: designed|implemented`·`Criteria-Met: 7/7`·`Verified-By: pending` 전부 root `AGENTS.md` 표의 허용값. 설계 커밋의 `Agent: codex`는 사용자가 Codex에게 plan을 맡긴 결과이며 허용값 범위 안이다.
- trailer가 실제로 파싱됨: `git log -1 --format='%(trailers:only=true)' 66f73a4` → 5키 반환; 같은 명령 `34f3b10` → 3키 반환. 0건 없음.
- 인용된 커밋 해시 실재: plan이 인용한 조사 기준 `d8cc4054` → `git cat-file -t` = commit.
- 재구현 라운드 `[구현자 기입]` 7필드 전수 존재: 7/7 — 설계 리뷰 · 강제 지점 전수(표 14행) · 이번 라운드 수정의 잠금(표 5행) · Product/UX 파생 검토(표 5행) · 놓친 잠재 문제(D1·D2) · 구현 보고(표 + AC 7행) · Review Signals. 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script의 살아 있는 소비처: 해당 없음 — 이동·삭제 0.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| D1 — 구조적 test adapter fixture 3곳이 필수 port 누락, 선조치로 빈 정책 추가 | 타당 | 계획 밖 3파일이지만 필수 port 확장의 불가피한 귀결이고 제품 동작 변경 0. `chat-turn.runtime-tools`·`send.permission-mode`·`send.worktree` 세 fixture만 `agentSpawnEnv: vi.fn(() => ({}))` 추가 — 확인함 |
| D2 — sandbox temp/config EPERM으로 I/O suite 114건 연쇄 실패, 권한 재실행으로 분리 | 타당 | 본 검증 환경(Linux)에서는 재현되지 않았고 전체 스위트 실패 0 — 환경 기인 판정과 모순 없음 |
| 설계 대비 명시적 차이 "제품 설계 차이 0" | 타당 | diff 전수 대조 결과 대체 메커니즘 도입 0 — 만료·공유·재진입 축에 새 실패 모드가 생기지 않았다 |
| 자기보고 "전체 4,855통과·1스킵" | 부분 불일치 | 총계 4,856은 일치하나 스킵 분해가 다르다(§7) — Windows 조건부 2케이스, 회귀 아님 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | production에서 `buildsEnv`가 항상 true가 돼 "lazy env 생략" 경로와 settings 채널 경로가 Claude/Mock에 대해 사실상 죽었다. `keeps lazy env omission ... for an empty patch` 케이스는 production adapter가 만들지 않는 형상만 덮는다 | 비귀속 — plan §17이 명시 수용, AC2가 요구 | NON_BLOCKING | — | 미래 adapter가 빈 정책을 반환하면 되살아나는 generic 계약이라 그대로 둔다 |
| D2 | `settingSources: ['project','local']`(`claude-adapt.ts:99`)로 workspace `.claude/settings.json`의 `env`가 CLI 초기 env 뒤에 적용될 수 있어, Code 세션에서 그 파일이 세 키를 다시 켜면 adapter 강제가 최종적으로 보장되지 않는다 | 비귀속 — AC2는 spawn env 기준이고 0234 D-005가 workspace 비수정을 유지 | NEXT_HANDOFF | — | "adapter 예약 키를 project/local settings보다 늦게 강제할 것인가"는 제품 결정 — 새 handoff 후보 |
| D3 | 검증 환경에서 `npm rebuild better-sqlite3`로 ABI를 Node로 맞췄다. 같은 컨테이너에서 `dev`/`build`를 하려면 Electron ABI 재빌드가 필요하다 | 검증 환경 | NON_BLOCKING | — | 기록만 — 추적 파일 변경 0, 컨테이너 휘발성 |
| D4 | `auth.md:557`의 "adapter patch가 생략됐거나 비어 있고 legacy 동적 레이어도 없는 턴" 서술은 generic 조립기 기준으로 정확하지만 현재 두 adapter 모두 비지 않은 patch를 반환한다는 사실은 적지 않았다 | 비귀속 — EP-14는 우선순위·책임 일치만 요구 | NON_BLOCKING | — | 다음 문서 turn에서 한 줄 보강 후보 |

- BLOCKING: 0건. PLAN_GAP: 0건.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음 — r1이 최초 라운드다.
- 관련 plan 지침/AC의 존재 여부: 검출된 모든 축에 대응 AC·EP가 이미 있었다. 검증자 추가 축 4건도 EP-03·04·11·12에 귀속됐고 새 계약을 요구하지 않았다.
- 사용자 결정 변경 근거: 없음 — Decision Ledger 무변경, `SUPERSEDED` 신규 0.
- 반복된 검증 환경 한계: better-sqlite3 ABI가 이번에도 기본 실패원이었다. `app/AGENTS.md §better-sqlite3`의 "실측 5파일"(0180)은 현재 **29파일·179케이스**로 커졌다 — 그 문서의 수치가 오래됐다는 사실만 기록한다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED PASS 12 · REGRESSION PASS 1 · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-001~D-009 전건 충족, D-010은 작업 경계라 채점 대상 아님
- AC 충족: ✅ 7 · ⚠️ 0 · ❌ 0 = 총 7 (본문·trailer·INDEX 세 사본 일치)
- 현재 변경 운영 gate: lint·typecheck·관련 vitest·전체 vitest·scripts·doc-inventory·message bus 7건 전부 PASS
- NON_BLOCKING / NEXT_HANDOFF: D1·D3·D4 기록, D2는 새 handoff 후보
- repository operation checks: `AGENTS.md` 변경 0 · trailer 파싱 정상 · 인용 해시 실재 · `[구현자 기입]` 7/7
- 남은 사람 확인: PR merge 승인. Claude CLI가 세 키를 실제로 해석하는지는 Orca 계약 밖 실기(비-blocking)
- 다음 단계: INDEX를 `verify/PASS`로 갱신하고 완료 행을 `docs/archive/handoffs/INDEX-history.md`로 옮긴다
