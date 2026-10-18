# Verify — 0262-opencode-harness

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다 — 판정 먼저, 주장 한 줄에 관측 하나.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0262-opencode-harness` |
| 검증자 | Claude Code |
| 일자 | 2026-10-16 |
| 대상 커밋/range | `a09109bb..655fa0e0` (설계·구현 84커밋, app 변경 837파일 — 0264 이동분 포함) · 최신 ΔV20 = 설계 `9ed587c4`·`3bdae04d` → 구현 `655fa0e0` |
| 구현 전 plan 기준 | 델타마다 직전 설계 커밋(V1 `a09109bb` … ΔV20 `3bdae04d`) |
| V mode / 유효 V | V1 + ΔV1~ΔV20 (plan 메타는 `이번 V revision ΔV19` — N-0262-4) |
| 검증 HEAD | `655fa0e0` |
| 라운드 | 1 (첫 검증) |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 1 + BLOCKING 1 |
| 자기 검증 여부 | 설계·구현 Codex(사용자 지시, 일부 설계 Claude) · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity

- 기준선: 범위의 설계 커밋은 모두 `Status: designed`, 구현 커밋은 `implemented|partial`로 분리돼 있다(85커밋 trailer 파싱·허용값 전부 정상). 대표로 ΔV20 `3bdae04d..655fa0e0`의 plan 삭제 줄은 메타 상태 1행.
- 유효 V: 20개 델타가 각자 대체 범위를 적었다(예: ΔV17 D-036이 D-018/023의 reasoning 상시 표시를, ΔV19가 ΔV18의 import 메타데이터 보존을 대체). 대체 이관은 각 델타 본문에 있다.

| 검사 | 판정 | 근거 |
|---|---|---|
| §10 oracle의 좌표 가능성 | **PLAN_GAP** | 다수 델타가 geometry·시각 자리를 기계 자리 분모에 넣고 CUA 측정으로만 닫는다: ΔV12 EP36e(`resize-and-disclosure-anchor` top/offset px), EP36c의 다페이지 스크롤 왕복, ΔV13 EP37e의 실제 높이/overlap, ΔV17 VP-Δ17-03(AC48 "desktop에 가까운" 본문 밀도, CUA-17-01~03), ΔV7 EP-27b·28a의 두 테마/좁은 폭. `§공통 V`는 일회성 실측을 좌표로 세지 않고, 이 측정은 layout 엔진이 필요해 fake DOM으로도 대체되지 않는다(브라우저 runner는 TRD 채택·미설치 = 신규 의존성 승인 사안). 사람 시각 인수로 재분류하거나 runner 도입을 결정해야 한다 (G-0262-1) |
| 운영 gate 범위 | 유효 | 각 델타가 Vitest·lint·typecheck·SQLite·migration·inventory·build·CI를 열거 |

## 1. Product & UX / ACTIVE Decision (최신 델타 중심)

| Decision | 기대 | 실제 production path |
|---|---|---|
| D20-1 | 도넛 = 마지막 step input+cache / 엔진 `limit.context`(없으면 200000), 원장은 합산 | `opencode/v1/map.ts` `lastOpenCodeStep`·`openCodeStepContext`·`openCodeContextWindow` → `usage/tracker.ts` → `turn_usage.context_*`(0031) → `ipc/dto.ts:88-89` → `lib/telemetry.ts contextTokens` |
| D20-2 | 즉시 보내기 = 현재 실행 abort → 중단 경계 → held 입력 promptAsync 1회, 오류 재시도 아님 | `map.ts` `MessageAbortedError`→`aborted`·`turn.aborted(user_cancelled)` · `chat-turn/post-turn.ts` 설정 준비 중 idle 소진 시 listen 대신 flush |
| D20-3 | agent/effort 팝업 공용 메뉴, 카드 표시명 Claude/OpenCode | `opencode/composer/Controls.tsx` · `engine/harnesses/claude/configuration.ts` |
| ΔV14~ΔV19 | native 피드 지속 수신·native 저장 경로·lazy cursor·desktop 표현·엔진 폼·문서 소유 범위 | 각 델타 §10 경로(아래 §5 좌표) |

## 2. 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 공통 경로 변경의 Claude 영향 | 회귀 잠김 | `post-turn.ts` 전환 조건은 Claude도 지난다. `channelBusy` 검사 제거 변이 M0262-05가 Claude `post-turn.schedules.test.ts:… ST-02 — 즉시 보내기는 응답만 한 번 끊고 …`를 red로 만든다 |
| 중단 경계의 분류 | 미관측 | 중단 뒤 `turn.aborted` 대신 `turn.ended`를 내도 green(M0262-03) — "중단 확정"의 사용자 결과를 D20-2가 정하지 않음(N-0262-1) |
| D20-1 폴백 범위 | 문면보다 넓음 | D20-1은 "마지막 step이 없는 구자료만 합산 폴백". 구현은 마지막 step이 있어도 토큰 보고가 불완전하면 합산 폴백(`map.test.ts:retains valid aggregate usage as fallback when the latest step has no token report`). SDK 타입상 tokens는 필수라 비정상 보고에 한정(N-0262-2) |
| 델타 간 상호작용 | 공백 | ΔV19 `customProvider.ts serializeProviderDraft`는 모델을 `{ name }`만 저장한다 — 폼으로 만든 엔진에는 ΔV20이 읽는 `limit.context`가 없어 분모가 항상 200000(N-0262-3) |
| 대상 플랫폼 CI | 비귀속 red | PR CI #773~#779 실패는 0265 `adapters/claude/native-history.test.ts` 3케이스뿐(0265 D-0265-1). 0262 변경 테스트는 CI에서 통과 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 옛 경로 좌표 | 이력 | `opencode.test.ts`·`opencode-server.test.ts`·`HarnessSettingsTab.save.test.ts` 등 15파일명은 0264 이동·ΔV18 삭제 전 이름이다. 현재 델타 좌표는 개별 대조로 실재 확인 |
| `design-evidence.md`(267줄) | 기록 | CUA 측정의 커밋된 기록 — 재현 가능한 좌표는 아니다(G-0262-1) |
| native-input 세션 검사 | 중복 가드 | `part.sessionID` 검사 제거 M0262-11 green — `users.has(messageID)`가 같은 입력을 거부 |

## 4. 적대 증거 재측정

등록 적대 증거: ΔV20·ΔV14·ΔV19 모두 `not selected`. 아래는 구현 보고에 없던 독립 축 표본이다.

| 변이 | 결과 | 검출 |
|---|---|---|
| M0262-01·02 message/session `MessageAbortedError`를 일반 오류로 | **red** ×2 | `opencode-continuation.test.ts:… send-now interrupts unfinished work immediately … (message-error)/(session-error)` |
| M0262-04 설정 준비 중 idle 소진 시 flush 전환 제거 | **red** | 같은 테스트 `(idle-only)` |
| M0262-05 전환 조건의 `channelBusy` 제거 | **red** 3 | 위 2 + Claude `post-turn.schedules.test.ts` ST-02 |
| M0262-07 마지막 step 컨텍스트 누락 · 08 엔진 limit 무시 | **red** 5 · 2 | `context-usage.test.ts`·`adapter.persistent.test.ts:carries the selected engine model limit …`·`map.test.ts` |
| M0262-09·10 native 입력의 synthetic·ignored 판정 제거 | **red** 9 · 1 | `opencode-continuation.test.ts` 8·`native-input.test.ts` |
| M0262-12·13 provider 직렬화 whitelist·enabled_providers 누락 | **red** 3 · 2 | `ProviderForm.interaction.test.ts`·`customProvider.test.ts` |
| M0262-03 중단 뒤 `turn.ended` | green | N-0262-1 |
| M0262-06 준비된 continuation 재사용 대신 재준비 | green — 등가 | — |
| M0262-11 native 입력 세션 검사 제거 | green — 중복 가드 | §3 |

- 13건 중 10 red · 3 green(등가 2 · oracle 공백 1).

## 5. V-pair closeout

| 범위 | 결과 | 근거 |
|---|---|---|
| 전체 실행 | 7,390케이스 중 통과 7,383 · skip 7 · 실패 0 | Linux Node ABI · Electron 바이너리 설치 후 16파일 재실행 포함 |
| plan 좌표 기계 대조 | 102건 중 68 즉시 일치 · 34 불일치 → 개별 확인 | 불일치는 옛 경로·약어(`O/`·`A/`)·`%s` 접미 차이. 현재 델타(ΔV11~ΔV20) 좌표는 개별 대조로 전부 실재·통과(`… (idle-only)` 등). 예외: ΔV18 EP51c 이름은 ΔV19 계약 변경으로 `imports compatible provider fields and submits only the selected provider without hidden metadata`가 대체 |
| 인용 테스트 파일 | 125개 중 현재 이름 110 실재·통과 | 15개는 위 옛 이름 |
| 실제 OpenCode 1.19.0 CLI 통합 (ΔV15·ΔV16) | PASS | `native-storage.integration.test.ts` 1/1(38초, `env -u PWD`) — [0265 §5](../0265-harness-native-storage/verify.md) 참조. 상속 `PWD`에서는 timeout(0265 N-0265-1) |
| VP20-1 · VP20-2 · VP20-3 · VP20-R | PASS | 위 좌표 + M0262-01~08 |
| ΔV14·ΔV19 표본 pair | PASS | M0262-09·10·12·13 red |
| G-0262-1 영향 pair | **미닫힘** | ΔV12 VP-59(EP36c·e) · ΔV13 VP-63(EP37e geometry) · ΔV17 VP-Δ17-03(AC48) · ΔV7 시각 자리 |

- **못 본 것**: V1~ΔV13·ΔV15~ΔV18 pair의 자리별 실행 구간은 좌표 실재·통과까지 확인했고, 각 테스트 본문을 읽어 자리가 실행 구간 안에 있는지는 ΔV14·ΔV19·ΔV20 표본만 확인했다. 재검증 라운드에서 G-0262-1 정정과 함께 나머지 pair를 읽는다.
- AC11(실공급자·최종 시각 인수)은 사람 몫으로 계속 대기.

### AT / AC 합계

| 범위 | 결과 |
|---|---|
| ΔV20 AC20-1~3 | ✅3 (N-0262-1~3은 인접 공백) |
| 이전 델타 AC | 좌표 통과 범위는 ✅, G-0262-1 영향 AC(AC48 등)와 AC11은 판정 보류 |

- 자기보고 ΔV20 `3/3`, 커밋 `655fa0e0` `Criteria-Met: 9/9`(0262 3 포함) — 일치.

## 6. 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| readonly ESLint · typecheck · build · 문서 inventory | PASS | [0003 F-4](../0003-debug-panel-mock-adapter/verify.md) |
| migration append-only | PASS | `a09109bb..HEAD`에서 0029~0032 추가만 |
| `git diff --check` | PASS | 범위 전체 0줄 |
| PR CI (Windows) | FAIL — 비귀속 | 0265 테스트 3케이스(#773~#779) |

## 7. Repository operation

- INDEX 0262 행: 상태·다음 주체 일치. 대상 커밋을 검증자가 기입한다.
- trailer: 범위 85커밋 파싱·허용값 정상(`partial` 4건은 `Criteria-Pending` 사용).
- **`[구현자 기입] ΔV20`가 두 문단+표 1개+`운영 gate / Review Signals` 한 절로 접혔다** — `이번 라운드 수정의 잠금`·`Product/UX 파생 검토`·`놓친 잠재 문제` 필드가 없다(D-0262-1). ΔV14~ΔV19는 7필드 존재.
- plan 메타 `이번 V revision`이 ΔV19로 남음(N-0262-4).

## 8. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G-0262-1 | geometry·시각 자리(EP36c·e, EP37e geometry, AC48/VP-Δ17-03, ΔV7 두 테마/좁은 폭)가 기계 자리 분모에 있으나 CUA 측정으로만 닫힌다 | §10 / `§공통 V` 좌표 규약 | **PLAN_GAP** | planner: 사람 시각 인수로 재분류하거나 브라우저 runner 도입(신규 의존성 — 사용자 승인)을 결정 |
| D-0262-1 | `[구현자 기입] ΔV20` 필드 접힘 | 재구현 턴 7필드 계약 | **BLOCKING** | 구현: 7필드 재기입 |
| N-0262-1 | 중단 경계의 `turn.aborted`/`turn.ended` 분류를 관측하는 oracle 없음(M0262-03 green) | D20-2 인접 | NON_BLOCKING | 중단된 응답의 표시 결과를 정할 때 함께 |
| N-0262-2 | D20-1 폴백 범위가 문면보다 넓음(불완전 토큰 보고) | D20-1 | NON_BLOCKING | 문면 정정 또는 폴백 축소 |
| N-0262-3 | ΔV19 직렬화가 `limit.context`를 저장하지 않아 폼 엔진의 도넛 분모가 항상 200000 | ΔV19×ΔV20 | NEXT_HANDOFF | 모델 limit 입력/보존 여부 사용자 결정 |
| N-0262-4 | plan 메타 V revision이 ΔV19 | 상태 사본 | NON_BLOCKING | 설계 정정 때 갱신 |
| N-0262-5 | `docs/arch/backend/provider-runtime.md:130,154,457,474,478`이 OpenCode permission·응답·mapper·adapter를 여전히 "미구현"으로 서술 — 현재 코드와 모순(`grep -n '미구현' docs/arch/backend/provider-runtime.md` 5건) | `docs/AGENTS.md` arch는 현재 상태만 | NON_BLOCKING | 문서 정정 |

## 9. Review Signals — 사실만

- 라운드 1에서 verify 없이 impl 턴이 r1~r1.20으로 이어졌다. 그중 사용자 요구 변경이 아닌 결함/gate 보완 턴: r1.2(dev 부팅 복구)·r1.3(무응답 복구)·r1.10(공급자 오류·문구)·r1.15의 CI 후속(`5b7a64c3`) — `docs/handoff/AGENTS.md §라운드`의 "verify 없는 impl 턴 3 초과" 조건에 해당하므로 다음 재구현 전에 `handoff-review`를 수행해야 한다.
- 같은 CUA 의존 패턴이 0263 ΔV3~ΔV5에도 있다(0263 G-0263-1).
- 반복 환경 한계: Electron 바이너리 부재·CLI fixture `PWD` 상속.

## 10. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 1(G-0262-1) + BLOCKING 1(D-0262-1). 다음 주체는 설계자.
- pair: ΔV20 4 PASS · 표본 델타 PASS · G-0262-1 영향 pair 미닫힘 · PAIR_FAIL 0.
- 운영 gate: 로컬 PASS, PR CI red는 0265 귀속.
- 다음 단계: `handoff-review`(라운드 내 impl 턴 초과) → 설계자 Delta V 정정 → 구현자 D-0262-1 → 재검증. 사람 몫: AC11 실공급자·시각 인수.

---

# r2 검증

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `5d2b36a2..e024b87c` — ΔV21 설계 `12c81cfa` → r2 구현 `ce7aa102`, 기록 `7be5d723` → r2.1 `eb333bff`·`6492828c`·`3e9cbf86`·`e7645433`·`e024b87c` |
| 구현 전 plan 기준 | `12c81cfa`(ΔV21, 설계 단독 커밋 — 0263 ΔV7과 공동) |
| V mode / 유효 V | V1 + ΔV1~ΔV21 |
| 검증 HEAD | `e024b87c` |
| 라운드 | 2 |
| 상태 | **FAIL** — root PAIR_FAIL 4(V1 VP-08·VP-16·VP-17·VP-19) · BLOCKED_BY 5 · PLAN_GAP 0 |
| 자기 검증 여부 | 설계·구현 Codex(사용자 지시) · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity (r2)

- 구현 커밋의 `plan.md` 삭제 줄: 메타 상태 1 · ΔV20 기입 표제 1 · `### 운영 gate / Review Signals` 1(7필드 복원). Decision·AC·V·§10 변경 없음(`git diff 12c81cfa e024b87c -- …/plan.md`).

| 검사 | 판정 | 근거 |
|---|---|---|
| G-0262-1 geometry·시각 자리 | 해소 | ΔV21 D21-1 — 시각 하위 주장만 VP21-V(자동 자리 0, 사람 인수)로 SUPERSEDED, 행동 증거는 기존 pair REGRESSION으로 유지(이관 표 5행) |
| N-0262-2 D20-1 폴백 문면 | 해소 | D21-2가 "마지막 step 부재만" 한정을 SUPERSEDED · VP21-F 신설 |
| r1이 요구한 재구현 전 `handoff-review` | 수행 기록 있음 | ΔV21 "설계 전 handoff-review" — B(실행 누락)·D·F 분류, 지침 변경 없음. 모드를 `APPLY`로 적었으나 적용한 변경은 0 |
| 이관 표 좌표 실재 | 1건 오기 | ΔV21 표의 `ToolCard.render.test.ts`는 없다 — 실제 좌표는 `transcript/ToolCard.interaction.test.ts`(EP48b). N-0262-6 |
| V1 pair의 미닫힘 자리 | 계약·oracle 정의됨 | V1 §10 EP-01~12와 r1 구현 보고(plan "강제 지점 전수" 표)가 남긴 자리 16을 명시 — 구현자가 새 계약 없이 닫을 수 있으므로 PLAN_GAP 아님 |

## 2. 비판적 읽기 (r2)

| 질문 | 판정 | 근거 |
|---|---|---|
| r2/r2.1의 production 변경 | 없음(0262 몫) | 변경은 문서(`provider-runtime.md` 미구현 5건 정정)·테스트 fixture·`vitest.config.ts`뿐 |
| fixture를 `openFileDatabase`로 바꾼 것이 검증을 약화했는가 | 아니오 | production 코어 DB도 같은 함수(`infra/db/index.ts:21`)로 연다. 재개방·FTS·FK 단언 유지 |
| Windows CI 파일 worker 1 | CI 전용 | `maxWorkers: process.platform === 'win32' && process.env.CI === 'true' ? 1 : undefined` — 로컬 병렬 유지. CI Test 단계 #786 199.7초 → #788 332.2초 |
| r1이 이월한 V1 pair | **미닫힘 자리 잔존** | r1 구현 보고가 `SELF_BLOCKED 14`·남긴 자리 16으로 끝났고 이후 구현 기록 9곳(plan 1044·1084·1135·1192·1321·1388·1471·1554·1622행)이 "승격하지 않음/SELF_BLOCKED 유지"를 반복. 이번에 16자리 전부에 탐침 변이를 심었다(§4) |

## 4. 적대 증거 재측정 (r2)

범위: main 변이는 `src/main`(+`src/shared`), renderer 변이는 `features/chat`·`pages`·`app`(2,225케이스) 또는 `features/engine`. 모든 변이 후 원본 SHA256 일치·`git status` clean.

### r1 변이 재실행

| 변이 | r1 | r2 | 귀속 |
|---|---|---|---|
| M0262-01·02 message/session `MessageAbortedError`를 일반 오류로 | red | **red** 1 · 1 | 덮개 유지 |
| M0262-04 idle 소진 flush 전환 제거 · 05 `channelBusy` 제거 | red | **red** 1 · 3 | 덮개 유지 |
| M0262-07 마지막 step 컨텍스트 누락 · 08 엔진 limit 무시 | red | **red** 4 · 4 (`context-usage.test.ts` 재개방 case 포함) | 덮개 유지 — r2.1이 이 테스트를 바꿨다 |
| M0262-09·10 native 입력 synthetic·ignored 판정 제거 | red | **red** 9 · 1 | 덮개 유지 |
| M0262-12·13 provider whitelist·`enabled_providers` 누락 | red | **red** 3 · 2 (`features/engine` 52케이스) | 덮개 유지 |
| M0262-03 중단만 `turn.ended`로 | green | green | N-0262-1 유지 |
| D21-2 latest 누락을 명시적 0으로 | — | **red** 1 — `map.test.ts:retains valid aggregate usage as fallback when the latest step has no token report` | VP21-F |

- 덮개 회귀 0.

### V1 미닫힘 자리 탐침 — r1 구현 보고가 남긴 16자리 + 확인용

| 탐침 | V1 자리 | 결과 | 검출 좌표 / 귀속 |
|---|---|---|---|
| P01a `ModelMenu` onPick이 `adapter` 미전달(`ModelMenu.tsx:61`) | EP-01 ModelMenu onPick 연결 | **green** 0/2,225 | **VP-17 root** |
| P01c 입력 controller를 backend별 key로 remount | EP-01 Controller 인스턴스·첨부 유지 | red 1 | `NewChatLandingPage.harness.test.ts:renders the harness landing and preserves draft and attachment state` |
| P01b SET_MODEL이 선택 adapter 무시 | EP-01 store SET_MODEL | red 6 | `chatReducer.harness.test.ts` |
| P02d `SendChatMessageSchema.backend`가 임의 값 수용(`protocol.ts:146`) | EP-02 Send schema harness 값 거절 | **green** 0/4,877 | **VP-16 root** |
| P02a 기존 lease backend 비교 제거(`send.ts:179`) | EP-02 기존 lease 비교 | **green** 0/4,057 | **VP-16 root** |
| P02c source backend 재검사 제거 · P02b payload/세션 backend 불일치 검사 제거 | EP-02 source 비교 | red 1 · 1 | `send.harness.test.ts:rechecks backend after attachment normalization yields` · `rejects cross-harness and Work requests` |
| P04a Bootstrap이 Chromium fetch 미주입 · P04b shutdown에서 registry close 생략 | EP-04 Bootstrap 생성 배선 | red 1 · 1 | `bootstrap.harness.test.ts:initializes its actual adapter registry with user data, live preferences and Chromium fetch` · `bootstrap.shutdown.test.ts:closes the owned adapter registry during shutdown before full startup` |
| P08b engine IPC `EngineSchema`가 임의 문자열(`protocol.ts:569`) | EP-08 IPC schema | **green** 0/4,877 | **VP-08 root** |
| P08c `EngineCard` 편집 클릭 무동작(`EngineCard.tsx:45`) | EP-08 EngineCard 실제 클릭 | **green** 0/63 | **VP-08 root** |
| P08a engine add가 Claude namespace에 기록 | EP-08 engine handler CRUD 연결 | red 1 | `engine.opencode.integration.test.ts` |
| P09a 하네스 설정 patch 병합 대신 교체 · P09b adapter preferences 미전달 | EP-09 병합·adapter settings read | red 1 · 1 | `settings-store.test.ts` · `bootstrap.harness.test.ts` |
| P10a 타이틀 메뉴 토글 무동작 · P10b 패널 target이 하네스 지원 무시 · P10c OPEN_TASK 타일 미활성 · P10d RightPanel이 Claude panel policy 전달 | EP-10 title menu·OPEN_TASK·RightPanel 렌더 전달 | red 3 · 10 · 2 · 1 | `ChatTitleBar.render.test.ts` · `chatReducer.harness.test.ts` · `chatReducer.panelPolicy.test.ts` · `opencode/rightpanel/Panel.render.test.ts` |
| P12a 새 draft(`freshEntry`)가 기억한 하네스 대신 Claude(`chatStore.ts:238`) | EP-12 freshEntry 배선 | **green** 0/2,225 | **VP-19 root** |
| P12b 모델 선택이 `lastBackend` 미저장 | EP-12 lastBackend 저장 | red 1 | `chatStore.harness.test.ts:defaults to Claude, remembers model selection and sends native options` |

- 탐침 20건: green 6 · red 14. green 6건은 r1 구현 보고가 "자동 잠금 남음"으로 적은 자리와 정확히 겹친다. 나머지 남긴 자리(EP-01 Controller·EP-02 source·EP-04·EP-08 handler·EP-10 셋)는 이후 델타의 테스트로 닫혔다. EP-09 SettingsTab 저장 클릭은 0262 ΔV18이 탭을 제거해 SUPERSEDED, EP-11 두 자리는 시각(AC11 사람 인수).
- 변이의 결과(코드 읽기): P01a는 OpenCode 모델을 골라도 draft backend가 바뀌지 않는다 — SET_MODEL은 `action.adapter`로만 backend를 바꾼다(`chatReducer.ts:1613`). P12a는 `freshEntry`로 다시 만든 새 draft가 기억한 하네스 대신 Claude가 된다. P08c는 카드의 편집이 `onEdit`를 부르지 않는다. P02d·P08b는 하네스 밖 값이 schema를 지나 handler로 넘어간다. 이 결과들을 실행으로 관측한 테스트가 없다는 것이 finding이다.

## 5. V-pair closeout (r2)

| Pair | r2 결과 | 근거 |
|---|---|---|
| **VP-17 AR-03↔IT-03** | **PAIR_FAIL** | EP-01 `ModelMenu`→`Composer.onPick`→`setModel` adapter edge 좌표 없음(P01a green) |
| **VP-16 AR-02↔IT-02** | **PAIR_FAIL** | EP-02 Send schema 값 거절(P02d green)·기존 lease backend 비교(P02a green) 좌표 없음 |
| **VP-08 R-08↔AT-08** | **PAIR_FAIL** | EP-08 IPC schema(P08b green)·EngineCard 편집 클릭(P08c green) 좌표 없음 |
| **VP-19 MD-02↔UT-02** | **PAIR_FAIL** | EP-12 `freshEntry` 기억 하네스 배선 좌표 없음(P12a green) |
| VP-01 · VP-02 · VP-13 · VP-14 · VP-12 | BLOCKED_BY:VP-17 · VP-16 · VP-16 · VP-08 · VP-19 | 각 상위 pair가 위 root 자리를 경유 |
| VP-04 · VP-15 | PASS | r1 남긴 Bootstrap 배선 자리가 P04a·P04b red로 닫힘 · 나머지 `v1/server.test.ts` 좌표 |
| VP-09 | PASS | 설정 탭 자리 SUPERSEDED(ΔV18) · 병합/preferences P09a·P09b red |
| VP-10 | PASS | P10a~d red |
| VP-11 | PASS(기계) · 사람 인수 대기 | frame은 0264 M01~03 registry 맞바꿈 red · 두 테마 토큰은 AC11 |
| VP-03·05·06·07·18 | PASS | r1 자기확인 좌표의 현재 이름: `send.harness`·`chatReducer.harness`·`v1/adapter.test.ts`(`subscribes before sending, scopes the turn and leaves admission to the runtime` — r1 좌표 `subscribes before admission…`는 이름이 바뀜)·`features/history/opencode-history.test.ts`·`v1/map.test.ts` |
| VP21-F MD20-1↔UT20-1 | PASS | `map.test.ts:retains valid aggregate usage as fallback…` + D21-2 변이 red |
| VP21-V R21-V↔AT21-V | 사람 인수 대기 | 자동 자리 0 |
| VP20-1·2·3·R | PASS | r1 좌표 + 위 r1 변이 재실행 red(VP20-3 미관은 VP21-V) |
| ΔV21 이관 pair의 자동 행동 부분(VP-46·47·59·61·63·VP-Δ17-03) | PASS(REGRESSION) | `AssistantSegment.render`·`ScrollController.interaction`·`Timeline.selection`·`TodoDock.render`·`Timeline.render:renders live text without reasoning prose through the production timeline`·`ToolCard.interaction` 통과 — 주입 치수의 상태 전이까지만 |

- root PAIR_FAIL 4 · BLOCKED_BY 5. 같은 root를 상위 pair의 PAIR_FAIL로 다시 세지 않았다.
- **못 본 것**: ΔV1~ΔV19의 나머지 pair는 r1과 같이 좌표 실재·통과까지만 확인했다. 이번 라운드는 plan이 인용한 테스트 파일명 127개(정규식 추출, 현재 실재 110) 중 path 구성요소를 mock하는 파일(`ChatTile.*`가 `Composer`·`RightPanel`·`TranscriptView`를, `send.agent-profile`이 `resolve-turn`·`post-turn`·`enqueue`를, `NewChatLandingPage.harness`가 `chatStore`를 mock 등)을 기계 스캔으로 식별했고 pair별 실행 구간 대응은 하지 않았다. r3 재검증에서 수행한다.

### AT / AC 합계 (r2 판정 범위)

| AC | 결과 |
|---|---|
| AC3·4·5·6·7·9·10 · AC20-1·20-2 | ✅ 9 |
| AC1·2·8·12 | ⚠️ 4 — 동작은 현재 코드에서 성립하나 자리 미잠금(위 root) |
| AC11 · AC20-3 · AC26·27·33·34·48 | ⚠️ 7 — 자동 행동 ✅, 시각 사람 인수 대기 |

- 합계: `✅ 9 · ⚠️ 11 · ❌ 0 = 20`(이번에 판정한 AC). plan의 AC 식별자 57개 중 나머지 37개는 r1 좌표 통과 범위 그대로이며 다시 판정하지 않았다.
- 사본 대조: 구현 보고 ΔV21 r2 `✅2·⚠️1`(AC20-1~3) · r2.1 `✅1`(AC20-1) ↔ trailer `19/21`·`6/6` 중 0262 몫 — 사본끼리 일치. 검증 범위가 넓어 직접 비교하지 않는다.

## 9. 게이트 (r2)

[0264 r2 §9](../0264-harness-module-isolation/verify.md)의 HEAD `e024b87c` 공통 실행(typecheck exit 0 · readonly ESLint 1,734파일 error 0 · Vitest 754파일 7,404케이스 실패 0 · production build exit 0 · scripts 142/142 · inventory/migration/budget/diff check · 원격 Windows CI #788 success). `check-doc-inventory --check`의 prose 검사가 `provider-runtime.md` 정정 뒤에도 통과, `grep -n '미구현' docs/arch/backend/provider-runtime.md` 0건.

## 11. Repository operation checks (r2)

- INDEX 0262 행: 대상 커밋 `12c81cfa`(ΔV21 설계)·`ce7aa102`(r2)·`eb333bff`·`6492828c`·`e7645433`(r2.1) 기입 — 전부 commit, 공유 브랜치 ancestor.
- trailer: `12c81cfa` 4키 · `ce7aa102`·`7be5d723` 9키 · `eb333bff` 6 · `6492828c` 7 · `3e9cbf86` 6 · `e7645433` 6 · `e024b87c` 5키 파싱, 허용값 정상.
- `[구현자 기입]` ΔV20 복원·ΔV21 r2·r2.1 각 7필드 → D-0262-1 closed. plan 메타 revision ΔV21(N-0262-4 closed).
- r1 INDEX·r1 메타의 ΔV20 설계 해시 `3bdae04d`는 실재하지 않는다(`git cat-file -t` 실패) — 실재 `3bdae04a`로 INDEX를 정정했다.
- 보고 좌표 오기: r2 구현 보고의 `ScrollController.test.ts`(실제 `ScrollController.interaction.test.ts`) · ΔV21 표의 `ToolCard.render.test.ts`(N-0262-6).

## 13. Finding disposition (r2)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G-0262-1 · D-0262-1 · N-0262-2·4·5 | r1 finding | ΔV21 · 필드 · 문서 | closed | — |
| N-0262-1 | 중단 경계 `turn.aborted`/`turn.ended` 분류 oracle 없음(M0262-03 green) | D20-2 인접 | NON_BLOCKING 유지 | — |
| N-0262-3 | 폼 엔진의 `limit.context` 미보존 | ΔV19×ΔV20 | NEXT_HANDOFF 유지 | — |
| **D-0262-2** | EP-01 `ModelMenu.tsx:61` `adapter` 전달 edge 미잠금 — 제거해도 2,225케이스 green | VP-17 · AC1 · V1 §10 EP-01 | **BLOCKING** | `ModelMenu` 항목 클릭→`Composer`→store `setModel`→backend 전환을 실제 렌더로 단언. P01a red |
| **D-0262-3** | EP-02 Send schema backend 값 거절(`protocol.ts:146`)·기존 lease backend 비교(`send.ts:179`) 미잠금 | VP-16 · AC2 · EP-02 | **BLOCKING** | schema에 하네스 밖 값 거절 단언, 다른 backend의 기존 lease로 들어온 요청 거절 단언. P02d·P02a red |
| **D-0262-4** | EP-08 engine IPC `EngineSchema`(`protocol.ts:569`)·`EngineCard.tsx:45` 편집 클릭 미잠금 | VP-08 · AC8 · EP-08 | **BLOCKING** | 하네스 밖 engine 거절, 카드 편집 클릭→`onEdit(agent)` 단언. P08b·P08c red |
| **D-0262-5** | EP-12 `freshEntry`(`chatStore.ts:238`)의 기억 하네스 배선 미잠금 | VP-19 · AC12 · EP-12 | **BLOCKING** | OpenCode 기억 상태에서 새 draft 생성 경로(`freshEntry` 호출처) 결과 단언. P12a red |
| N-0262-6 | 보고 좌표 오기 2건(`ToolCard.render.test.ts`·`ScrollController.test.ts`) | 문서 | NON_BLOCKING | 좌표 정정 |

## 14. Review Signals (r2)

- r1과 다른 축이다: r1은 G-0262-1(시각 자리 분류)과 필드 접힘, r2는 r1이 이월한 V1 pair의 미닫힘 자리.
- 관련 plan 사실: V1 구현 보고 `SELF_PASS 5 · SELF_BLOCKED 14`, 이후 구현 기록 9곳이 "SELF_BLOCKED 유지·승격하지 않는다"를 반복했고 ΔV1~ΔV4의 REGRESSION 행은 "기존 미잠금 범위 승계; 전체 PASS로 승격하지 않음"으로 적었다.
- r1 검증은 같은 pair를 "못 본 것"으로 이월했다.
- handoff-review는 ΔV21 본문 안에서 수행됐고(B·D·F, 지침 변경 0) 별도 산출물은 없다.

## 15. 결론 (r2)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 4(VP-08·16·17·19) · BLOCKED_BY 5(VP-01·02·12·13·14) · 사람 인수 대기 VP21-V·VP-11 시각 · PLAN_GAP 0.
- AC(이번 판정 범위 20): ✅9 · ⚠️11 · ❌0. 운영 gate PASS.
- 다음 단계: 구현자 r3 — D-0262-2~5의 6자리 직접 oracle 추가 후 P01a·P02a·P02d·P08b·P08c·P12a red 보고. 검증자 r3는 ΔV1~ΔV19 pair 실행 구간 대응을 함께 닫는다.

---

# r3 검증

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `3c798ab5..8868097f` — r3 구현 `8868097f`(0262) · 같은 트리의 0265 r3 `0d2096c5` 포함 |
| 구현 전 plan 기준 | `12c81cfa`(ΔV21, 설계 단독 커밋) |
| V mode / 유효 V | V1 + ΔV1~ΔV21 |
| 검증 HEAD | `8868097f` (공유 브랜치 `origin/codex-opencode-harness`) |
| 라운드 | 3 |
| 상태 | **FAIL** — root PAIR_FAIL 1(V1 VP-08) · BLOCKED_BY 3 · PLAN_GAP 0 |
| 자기 검증 여부 | 구현 Codex · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity (r3)

- 구현 커밋의 `plan.md` 삭제 줄 3: 메타 `상태` · ΔV21 이관 표 좌표 `ToolCard.render.test.ts`→`ToolCard.interaction.test.ts` · r2 구현 보고 좌표 `ScrollController.test.ts`→`.interaction.test.ts`. 뒤 둘은 N-0262-6이 요청한 파일명 정정이고 의미 불변 — 무단 규범 변경 아님.
- Decision·AC·V node/pair·§10 변경 없음 → r2 plan validity 유지.
- 아래 D-0262-6의 자리는 V1 §10 EP-08 `engine form/card`·`schema`와 VP-08 path `engine CRUD → catalog → UI`가 이미 명시한다. 구현자가 새 계약 없이 닫을 수 있으므로 PLAN_GAP 아님.
- r3 범위의 `app/` 변경은 테스트 5파일뿐이다(non-test 0건).

## 2. 비판적 읽기 (r3) — 새 oracle의 실행 구간

| 새 좌표 | 들어간 곳 → 관측한 곳 | mock한 path 구성요소 | 판정 |
|---|---|---|---|
| `Composer.approvalQueue.test.ts:switches harnesses by clicking model menu rows…` | `Composer` 버튼 클릭 → `Popover` → `ModelMenu` 행 클릭 → `onPick` → `chatActions.setModel` → reducer → `data-harness` 표면·같은 textarea·첨부 | 없음 — react/react-dom/zustand 바인딩(실행 환경)·i18n·`useAgents`(catalog 입력)·`useSkills`만 | EP-01 세 자리 구간 안 |
| `send.harness.test.ts:rejects %s input on an existing %s lease before reservation` | 실제 `SessionChainLeaseRegistry`·`PendingMessageQueue` → `handleChatSend` → `send.ts:179` 비교 → `sendChatEvent` 인자·queue·lease 불변 | `resolveTurn`(비교 뒤 단계) | EP-02 lease 자리 구간 안 |
| `shared/protocol.harness.test.ts` | exported schema `safeParse` | — | schema 정의만. **IPC handler의 schema binding은 구간 밖** |
| `EngineCard.interaction.test.ts` | wrapper `EngineCard` → 공통 카드 → `Button` 클릭 → `onEdit`/`onDelete` prop | — | 카드 내부만. **부모 `AgentEnvironmentView`의 `onEdit`→`openEdit`→폼은 구간 밖** |
| `chatStore.harness.test.ts:creates a fresh draft using the boot-seeded %s harness` · `remembers model selection across repeated fresh draft creation` | `seedLandingBackend`/`setModel` → `newChat` → `freshEntry` → 활성 세션 | — | EP-12 draft 초기화 구간 안 |

## 4. 적대 증거 재측정 (r3)

범위: main 변이 `src/main`+`src/shared`(4,896케이스), renderer 변이 `src/renderer`(2,889케이스). 모든 변이 후 원본 SHA256 일치 · `git status` clean.

| 변이 | r2 | r3 | 귀속 |
|---|---|---|---|
| P01a `ModelMenu.tsx:61` `adapter` 미전달 | green | **red** 1 — `Composer.approvalQueue…switches harnesses…` | D-0262-2 인용 |
| X01 `Composer.tsx:410` `selection.adapter` 미전달 | — | **red** 2 — 위 + `composerWiring.test.ts:축③ setModel 호출 전건…` | 구현자 형제 대조 |
| P02a `send.ts:179` 기존 lease backend 비교 제거 | green | **red** 4 — lease 4경로 | D-0262-3 인용 |
| P02d `protocol.ts:146` Send backend를 `z.string()` | green | **red** 5 — `protocol.harness…rejects an unregistered harness …` | D-0262-3 인용 |
| P08b `protocol.ts:569` `EngineSchema = z.string()` | green | **red** 5 — 같은 테스트 | D-0262-4 인용 |
| P08c `EngineCard.tsx:45` 편집 클릭 무동작 | green | **red** 2 — `EngineCard.interaction…routes the %s card…` | D-0262-4 인용 |
| X02 편집→`onDelete` · X02s 편집/삭제 맞바꿈 | — | **red** 2 · 2 | 구현자 형제 대조 |
| P12a `chatStore.ts:238` `freshEntry` backend를 Claude 고정 | green | **red** 2 — `creates a fresh draft…(opencode)` · `remembers model selection across repeated…` | D-0262-5 인용 |
| P02b payload/세션 backend 불일치 검사 제거 · P02c source 재검사 제거 | red 1 · 1 | **red** 1 · 1 | 덮개 유지(검출 파일이 r3에서 바뀜) |
| P12b 모델 선택의 `lastBackend` 저장 제거 | red 1 | **red** 2 — 기존 + `remembers model selection across repeated…` | 덮개 유지(검출 파일 변경) |
| I4 `setModel`의 `landingBackend` 갱신 제거 | — | **red** 1 — `remembers model selection across repeated…` | 검증자 독립 축 |
| I7 `resolve-turn.ts:106` await 후 source backend 재검증 제거 | — | **red** 3 — `resolve-turn.agent…rejects a changed source harness…(sessionId/forkFrom/handoffFrom)` | 종속 pair closeout |
| I8 `chatReducer.ts:1498` LOAD_SESSION backend 미복원 | — | **red** 6 — `chatReducer.harness…restores the stored harness…` 외 5 | 종속 pair closeout |
| I9 `boot/steps.ts:68` `seedLandingBackend` 호출 제거 | — | **red** 1 — `steps.harness…applies the persisted harness through boot…` | 종속 pair closeout |
| I10 `session.updated`가 잠긴 세션 backend를 patch로 교체 | — | **red** 1 — `chatReducer.harness…restores the stored harness and ignores conflicting updates` | 종속 pair closeout |
| I11 `send.ts:417` runtime 진입 adapter를 `getActive()`로 | — | **red** 2 — `send.agent-profile…routes a saved OpenCode session through its runtime…(recovery: false/true)` | VP-13 이음매 |
| **I1** `engine.ts:59-60` `engineAdd`를 무검증 parser로 등록 | — | **green** 0/4,896 | **VP-08 root (D-0262-6)** |
| I1b `engineImportUserSettings`를 무검증 parser로 등록 | — | red 1 — `engine.import.test.ts:rejects an invalid harness payload null` | import 채널은 실제 `handle`로 부분 잠김 |
| **I2** `AgentEnvironmentView.tsx:121` 카드 `onEdit` 무동작 | — | **green** 0/2,889 | **VP-08 root (D-0262-6)** |
| **I3** 같은 자리 `onEdit`↔`onDelete` 배선 맞바꿈(편집 클릭이 삭제 확인) | — | **green** 0/2,889 | **VP-08 root (D-0262-6)** |
| **I5** `AgentEnvironmentView.tsx:149` 편집 저장 key를 첫 엔진으로 | — | **green** 0/2,889 | **VP-08 root (D-0262-6)** — "서로의 설정 덮어씀" |

- 인용 변이 6/6 검출(P01a·P02a·P02d·P08b·P08c·P12a) — 구현자 보고 수(1·4·5·5·2·2)와 일치. D-0262-2·3·5 closed. D-0262-4는 인용 변이가 닫혔으나 같은 계약(EP-08 `schema`·`engine form/card`)이 한 edge 위에서 미잠금이라 D-0262-6으로 이관.
- I1 첫 실행은 `loopback-callback.test.ts:타임아웃은 LoopbackCancelledError 로 끝난다` 1건 red였다 — 그 파일은 `engine.ts`를 import하지 않고 단독 재실행에서 0/4,896 green이라 타이밍 flake로 분리했다(I1b 첫 실행의 같은 1건도 동일).
- 이전 라운드 red 재실행: 검출 파일이 r3에서 바뀐 P02b·P02c·P12b 3/3 red — 덮개 회귀 0. 그 밖의 r2 red(P01b·P01c·P04a/b·P08a·P09a/b·P10a~d·D21-2)와 r1 red(M0262-01~13)는 검출 파일과 production이 `e024b87c..8868097f`에서 무변경이라 재실행하지 않았다.
- I1·I2·I3·I5가 green인 이유: 엔진 handler 테스트 4파일(`engine.deployment`·`engine.runtime-catalog`·`engine.opencode.integration`·`misc.runtime-catalog`)이 `infra/ipc/handle`을 `(channel, _schema, …) => callbacks.set(…)`로 mock해 schema를 버린다. `AgentEnvironmentView.{interaction,render}.test.ts`는 `useEngines`를 `agents: []`로 mock해 카드 목록·`openEdit`·편집 저장이 한 번도 실행되지 않는다.

## 5. V-pair closeout (r3)

| Pair | r3 결과 | 근거 |
|---|---|---|
| **VP-17 AR-03↔IT-03** | **PASS** | EP-01 ModelMenu adapter(P01a)·Composer 전달(X01)·SET_MODEL(r2 P01b)·controller(r2 P01c) · EP-10 r2 P10a~d · EP-11 frame 0264 M01~03(시각은 VP-11) |
| **VP-16 AR-02↔IT-02** | **PASS** | EP-02 Send schema(P02d)·adapter 선택(I11)·기존 lease(P02a)·source(P02c)·payload/세션(P02b)·await 후 재검증(I7)·load/reducer(I8·I10) · EP-07 r1/r2 좌표 |
| **VP-19 MD-02↔UT-02** | **PASS** | EP-12 lastBackend 저장(P12b)·draft 초기화(P12a)·기억값 갱신(I4)·session.updated(I10)·LOAD_SESSION(I8) · EP-03/10 r2 |
| VP-01 R-01↔AT-01 | **PASS** (r2 BLOCKED_BY:VP-17 해소) | 위 Composer 좌표가 path 전 edge를 한 구간에서 실행 — 같은 textarea 객체·초안·첨부 단언 |
| VP-02 R-02↔AT-02 | **PASS** (r2 BLOCKED_BY:VP-16 해소) | chat:send→DB→registry→adapter: P02a~d·I11 |
| VP-13 SD-01↔ST-01 | **PASS** (r2 BLOCKED_BY:VP-16 해소) | 이음매별: send→`acquireTurnRuntime` 인자(I11, `send.agent-profile`) → `runtime-entry.test.ts` → 실제 `SessionRuntime`+OpenCode adapter(`opencode-runtime.test.ts`) → history(VP-07 좌표) → reducer(I8) |
| VP-12 R-12↔AT-12 | **PASS** (r2 BLOCKED_BY:VP-19 해소) | 부팅 seed(I9)·freshEntry(P12a)·lastBackend(P12b)·재열기(I8) |
| **VP-08 R-08↔AT-08** | **PAIR_FAIL** | EP-08 `schema`: 정의(P08b red) ↔ IPC binding(I1 green). `engine form/card`: 카드 내부(P08c red) ↔ 부모 카드→`openEdit`→편집 폼→`update(key)`(I2·I3·I5 green). D-0262-6 |
| VP-14 SD-02↔ST-02 | BLOCKED_BY:VP-08 | path `engine/settings → catalog → UI`가 위 편집 edge를 경유 |
| ΔV18 VP-Δ18-R1 · ΔV19 VP-Δ19-R1 | BLOCKED_BY:VP-08(편집 하위 edge) | 두 REGRESSION path가 "Claude add-edit"·"추가/편집·CRUD"를 명시. 나머지 부분은 r2 좌표 PASS |
| VP-03·04·05·06·07·09·10·15·18 · VP-11(기계) | PASS (r2 좌표) | r3 변경 무영향 |
| ΔV1~ΔV19 나머지 · ΔV20 · ΔV21 | PASS (아래 실행 구간 감사) · VP21-V·VP-11 시각은 사람 인수 대기 | — |

- root PAIR_FAIL 1(VP-08) · BLOCKED_BY 3(VP-14·VP-Δ18-R1·VP-Δ19-R1) · PLAN_GAP 0. 같은 root를 상위 pair의 PAIR_FAIL로 다시 세지 않았다.

### ΔV1~ΔV19 실행 구간 감사 — r2가 이월한 작업

방법: plan 전문에서 `*.test` 좌표 이름을 기계 추출(133개) → 현재 파일 해석 → 각 파일의 `vi.mock` 대상 중 실행 환경(react·react-dom·zustand·electron·node:·i18n·log·testfixture)을 뺀 목록을 pair path와 대조했다. 스크립트·결과는 검증자 scratchpad(`audit.py`·`audit.json`)에 있고 저장소에 남기지 않았다.

| 축 | 관측 | 판정 |
|---|---|---|
| 좌표 이름 해석 | 133개 중 113개가 현재 파일로 직접 해석. 20개 미해석 | 아래 행 |
| 미해석 20 | ΔV5 이동 전 이름 6(`opencode-{server,settings,catalog,map,sdk}.test`→`v1/{…}.test`, `opencode.test`→`v1/adapter.test`) · ΔV15 예정 좌표 4(`native-history.integration`·`opencode-native-storage.integration`·`legacy-storage-migration`·`legacy-schema` — 구현자 N1~N7 표가 실제 테스트로 대응) · 이동 1(`CwdPanel.harness`의 `selects workspace and branch from the footer`→`NewChatLandingPage.harness.test.ts:196`) · `claude.executable-option`→`adapter.executable-option.test.ts` · ΔV18 제거 탭 2(`HarnessSettingsTab.*`) · scripts `.mjs` 2 · N-0262-6 2 · 정규식 부산물 1 · `.tmp/native-load-repro` 1(ΔV16 AC43이 영구 회귀로 이관한다고 적은 임시 재현) | 전부 현재 대응 파일 존재 또는 SUPERSEDED — N-0262-7 |
| 비-환경 mock 보유 46파일 | 입력·출력 sink(`ipc/send`·`shared/api/ipc`·`useAgents`/`useSkills`·`error-report`·`orca-config`·`paths`·`Modal`/`Popover` chrome·`react-virtual`·`useDiffSyntax`·`./Text`·`./scrollContext`) | path 구성요소 아님 |
| 대상 보존 mock | `ChatTile.*Lifetime`이 `Composer`를 mock해 mount 횟수를 셈 · `SettingsModal.render`가 탭 본문 mock · `agentModeLanding.render` | 그 pair의 edge(부모의 mount·rail 선택)는 구간 안 |
| path 구성요소 mock + 이음매 증거 | `send.agent-profile`(runtime-entry·post-turn 등 mock) — I11 red로 인자 관측, `runtime-entry.test`·`opencode-runtime.test`가 다음 구간 · `NewChatLandingPage.harness`(`../features/chat`은 실제 `Landing`·`Composer` 재수출, `chatStore`는 fixture 상태를 실제 selector에 주입) | 이음매 닫힘 |
| **path 구성요소 mock + 이음매 없음** | 엔진 handler 4파일의 `handle` mock(schema 폐기) · `AgentEnvironmentView` 테스트의 `useEngines` 빈 목록 | **D-0262-6** |

- 못 본 것: 자리마다 좌표가 대응하는지(site→coordinate)는 r1/r2가 좌표 실재·통과로 본 범위를 그대로 따랐다. 이번 감사는 좌표의 실행 구간(mock) 축을 133개 이름 전부에 대해 본 것이다. CUA·browser fixture 좌표(VP-59·61·65 등)는 ΔV21이 VP21-V로 사람 인수에 이관했다.

### AT / AC 합계 (r3 판정 범위)

| AC | 결과 |
|---|---|
| AC1·2·12 | ✅ 3 — r2 ⚠️ 해소 |
| AC8 | ⚠️ 1 — 동작은 성립하나 편집 경로·IPC binding 자리 미잠금(D-0262-6) |
| AC3·4·5·6·7·9·10 · AC20-1·20-2 | ✅ 9 (r2 판정 유지) |
| AC11 · AC20-3 · AC26·27·33·34·48 | ⚠️ 7 — 자동 행동 ✅, 시각 사람 인수 대기 |

- 합계: `✅ 12 · ⚠️ 8 · ❌ 0 = 20`(r2와 같은 판정 범위). 나머지 37개는 r1 좌표 통과 범위이며 이번 실행 구간 감사에서 D-0262-6 외 결함 없음.
- 사본 대조: 구현 보고 `✅4 = 대상 4(AC1·2·8·12)` ↔ trailer `8868097f` `Criteria-Met: 4/4` ↔ INDEX `자기확인 4/4` — 사본끼리 일치. 검증 결과와 AC8에서 갈림.

## 9. 게이트 (r3)

[0265 r3 §9](../0265-harness-native-storage/verify.md)의 HEAD `8868097f` 공통 실행: Vitest 756파일 7,429케이스(7,422 pass·0 fail·7 skip) · typecheck exit 0 · readonly ESLint 1,736파일 error 0·warning 2 · scripts 142/142 · inventory/migration/budget ok · build exit 0 · `git diff --check` 0 · 원격 Windows CI #790 success. 운영 gate PASS — 이번 FAIL은 gate가 아니라 VP-08 pair 실패다.

## 11. Repository operation checks (r3)

- INDEX 0262 행: `(r3 구현 — 검증자 기입)`을 `8868097f`로 채웠다(`git cat-file -t` commit, 공유 브랜치 ancestor). 같은 행의 나머지 좌표는 `git cat-file -t` commit이고, `a09109bb`(V1 설계)만 이 shallow clone 밖이라 GitHub commit API로 실재를 확인했다.
- trailer: `8868097f` 5키(`Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 4/4`·`Verified-By: pending`) 파싱·허용값 정상.
- `[구현자 기입]` r3 7필드 전수 존재.
- 라운드: 이번 FAIL로 4가 된다 — `docs/handoff/AGENTS.md §라운드` "라운드가 3을 초과하면 다음 재구현 전에 handoff-review".

## 13. Finding disposition (r3)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D-0262-2 · 3 · 5 | EP-01 ModelMenu · EP-02 schema/lease · EP-12 freshEntry 미잠금 | VP-17·16·19 | **closed** — 인용 변이 red | — |
| D-0262-4 | EP-08 engine schema · EngineCard 편집 클릭 | VP-08 | **인용 변이 closed**(P08b·P08c red) · 계약 잔여는 D-0262-6 | — |
| **D-0262-6** | EP-08의 두 자리가 한 edge 위에서 미잠금. ① IPC binding: `engine.ts:59-60` `engineAdd`가 어떤 parser로 등록돼도 green(I1) — 엔진 handler 테스트 4파일이 `handle` mock에서 `_schema`를 버린다. ② 카드→폼: `AgentEnvironmentView.tsx:121-122` 편집 무동작(I2)·편집/삭제 맞바꿈(I3), `:149` 편집 저장 key 오배선(I5) 전부 green — 테스트가 `useEngines` 빈 목록만 렌더 | VP-08 · AC8 · V1 §10 EP-08 `schema`·`engine form/card` · D-0262-4 계약 | **BLOCKING** | 구현: 엔진 목록이 있는 `AgentEnvironmentView` 실제 조립에서 카드 편집 클릭→read(key)→편집 폼→저장 `update({ key })`·삭제 클릭→confirm→`remove(key)`를 단언, `engine.import.test.ts`처럼 실제 `handle`로 `engineAdd`의 하네스 밖 engine 거절을 단언. I1·I2·I3·I5 red로 닫힘 |
| N-0262-1 | 중단 경계 분류 oracle 없음 | D20-2 인접 | NON_BLOCKING 유지 | — |
| N-0262-3 | 폼 엔진의 `limit.context` 미보존 | ΔV19×ΔV20 | NEXT_HANDOFF 유지 | — |
| N-0262-6 | 좌표 오기 2건 | 문서 | **closed** — r3가 정정 | — |
| N-0262-7 | plan 좌표 이름 20개가 ΔV5 이동·ΔV18 제거·ΔV15 예정 좌표 등으로 현재 파일명과 다르다(전부 대응 파일 확인) | 문서 | NON_BLOCKING | 다음 설계 정정 때 현재 이름 병기 |

## 14. Review Signals (r3)

- r2와 같은 형태가 반복됐다: 검증자가 지목한 자리(카드 내부·schema 정의)를 구현자가 정확히 닫았고, 같은 계약의 한 edge 위(부모 배선·IPC binding)는 비었다.
- 관련 지침: `docs/handoff/AGENTS.md §공통 V` "계약 값을 운반하는 edge는 모두 자리" · "파생 이슈의 계약은 출처가 가리키는 V-pair·§10이고 대응 방향은 제안이다".
- 라운드 4(>3) — 다음 재구현 전 handoff-review 대상.
- 반복 환경 한계: 실제 OpenCode CLI 부재(native CLI 통합 skip 1).

## 15. 결론 (r3)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 1(VP-08) · BLOCKED_BY 3(VP-14·VP-Δ18-R1·VP-Δ19-R1) · r2 root 3(VP-16·17·19)과 종속 4(VP-01·02·12·13) PASS · PLAN_GAP 0 · 사람 인수 대기 VP21-V·VP-11 시각.
- AC(판정 범위 20): ✅12 · ⚠️8 · ❌0. 운영 gate PASS.
- 다음 단계: handoff-review(라운드 4) → 구현자 r4 — D-0262-6의 I1·I2·I3·I5 red 보고. 이 자리 외 ΔV1~ΔV19 실행 구간 감사는 이번 라운드로 닫혔다.

# r4 검증

## 메타 (r4)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `4f5679f2..a41a8d89` — r4 구현 `a41a8d89`(테스트 3파일 + plan·INDEX) |
| 구현 전 plan 기준 | `12c81cfa`(ΔV21, 설계 단독 커밋) |
| V mode / 유효 V | V1 + ΔV1~ΔV21 |
| 검증 HEAD | `a41a8d89` (공유 브랜치 `origin/codex-opencode-harness`) |
| 라운드 | 4 |
| 상태 | **FAIL** — root PAIR_FAIL 1(ΔV19 VP-Δ19-05) · BLOCKED_BY 4 · PLAN_GAP 0 |
| 자기 검증 여부 | 구현 Codex · 검증 Claude — 구현자 ≠ 검증자. 보고에 없는 축 13개를 함께 심었다(§4) |

## 0. 기준선 / plan validity (r4)

- 구현 커밋의 `plan.md` 삭제 줄 1: 메타 `상태` 문구뿐이다(`git show a41a8d89 -- …/plan.md`). Decision·AC·V node/pair·§10 변경 없음 → r3 plan validity 유지.
- r4의 `app/` 변경은 테스트 3파일 586줄 추가, 삭제 0줄, production 0파일(`git diff --stat 8868097f..a41a8d89 -- app/`).
- 아래 D-0262-7의 자리는 ΔV19 §10 EP55d `agent:list 실제 어댑터`와 V1 §10 EP-08 `agent list`가 이미 명시한다. 구현자가 새 계약 없이 닫을 수 있으므로 PLAN_GAP 아님.
- 라운드 4 선행 handoff-review: `4f5679f2`(round33, `Handoff: none`)가 r3 형태를 사례로 지침을 갱신했고 r4는 그 뒤에 구현됐다.

## 2. 비판적 읽기 (r4) — 새 oracle의 실행 구간

| 새 좌표 | 들어간 곳 → 관측한 곳 | 바꾼 path 구성요소 | 판정 |
|---|---|---|---|
| M `engine.ipc.test.ts` | `ipcMain.handle` 콜백 → 실제 `handle` → schema → 엔진 handler → settings-write(임시 home) → `agentList` → 실제 `ClaudeAdapter`·`OpenCodeAdapter` | electron 수신기·로그·`orca-config`(환경), `deployExtensions`(sink), `AdapterRegistry`(id→실제 adapter stub) | schema·CRUD·파일 격리는 구간 안. **`harnessRuntime`·`runtimeModelCatalog`를 주입하지 않아 `agentList`가 production이 타지 않는 fallback 분기를 실행** |
| U `AgentEnvironmentView.crud.test.ts` | public wrapper → View → 실제 Card/Form → `useEngines` → `agentStore` → `engineApi`/`agentApi` → `window.orca` fixture | react·zustand 바인딩·react-dom·i18n(환경), `Modal` chrome, preload(외부 경계) | form/card·hook/store 자리 구간 안 |
| P `preload/index.test.ts` 추가 케이스 | 실제 `engineApi`/`agentApi` → 노출된 preload → `ipcRenderer.invoke` 채널·payload | electron(환경) | U↔M 이음매: U는 `window.orca.engine.*` 인자, P는 그 인자→채널·payload, M은 같은 채널 콜백에서 시작 — 이음매 없음 |

- 운반 값: U의 편집·삭제 대상은 둘 다 첫 카드가 아니고 수정 JSON은 읽은 JSON·기본값과 다르다. M의 두 하네스는 provider `shared`가 같아 하네스 항만 구별 값이다 — J7(쓰기 경로의 하네스를 `claude`로 고정)이 M 2케이스 red라 그 항을 잰다.
- **M의 OpenCode 모델명은 settings parser·native catalog·catalog 실패 폴백 어느 경로로도 같은 값**(`openCodeCatalog`가 `parseOpenCodeModels`를 그대로 쓴다)이다. J14·J16·J18이 M에서 green이고 행에 함께 인용된 `misc.runtime-catalog`·`registry.test`만 red다 — parser·catalog 자리는 그 형제 좌표가 닫는다.

## 4. 적대 증거 재측정 (r4)

범위: main 변이 `src/main`+`src/shared`(4,909케이스), renderer 변이 `src/renderer`+`src/preload`(2,920케이스). 실행기는 변이마다 원본 SHA256 복원을 단언했고 종료 후 `git status` clean. 기준선은 같은 범위의 전체 실행에서 실패 0이다.

### 인용 변이 (D-0262-6)

| 변이 | r3 | r4 | 구현 보고 |
|---|---|---|---|
| I1 `engine.ts:59-60` `engineAdd` 무검증 parser | green 0 | **red 7** — M `rejects an unregistered engine %j…` 6 · `validates the registered orca:engine:add payload` | 7/13 일치 |
| I2 `AgentEnvironmentView.tsx:121` 카드 `onEdit` 무동작 | green 0 | **red 6** — U 편집 2·read 대기·busy·오류·재시도 | 6/10 일치 |
| I3 같은 자리 `onEdit`↔`onDelete` 맞바꿈 | green 0 | **red 8** — U 편집 2·삭제 2·busy·read 대기 외 | 8/10 일치 |
| I5 `:149` 편집 저장 key를 `agents[0].key`로 | green 0 | **red 3** — U 비첫 엔진 편집 2·재시도 | 3/10 일치 |

- 인용 4/4 red, 케이스 수까지 보고와 같다 → **D-0262-6 closed**.

### 이전 라운드 red 재실행 (VP-08)

| 변이 | r3 | r4 | 판정 |
|---|---|---|---|
| P08b `protocol.ts:569` `EngineSchema = z.string()` | red 5 | **red 10** — protocol 5 + M 5 | 덮개 유지·확장 |
| P08c `EngineCard.tsx:45` 편집 클릭 무동작 | red 2 | **red 8** — EngineCard 2 + U 6 | 덮개 유지·확장 |
| I1b `engineImportUserSettings` 무검증 parser | red 1 (`rejects an invalid harness payload null`) | **red 2** — `engine.import…reads the selected harness global file…` · M `validates the registered …importUserSettings payload` | red 유지. 검출 케이스 차이는 변이 형태 차이다 — 이번 형태에서 `null` 거절 케이스는 하위 TypeError로도 `rejects.toThrow()`를 만족한다. 검출 파일 무변경 |

- 그 밖의 r3 red(P01a·X01·P02a~d·P12a·P12b·X02·X02s·I4·I7~I11)는 production과 검출 파일이 `8868097f..a41a8d89`에서 무변경(삭제 0줄)이라 재실행하지 않았다 — 덮개 회귀 0.

### 보고에 없는 독립 축

| 변이 | 자리 | r4 | 판정 |
|---|---|---|---|
| J1 `engine.ts:45` `harnessRuntime.invalidate(key)` 제거 | write 후 runtime cache 무효화 | red 13 — `engine.deployment` 10·`engine.runtime-catalog` 3 | 잠김 |
| **J2** `misc.ts:63` `harnessRuntime.resolve(target)` → `cached(entry.key)` | `agent:list` production 분기 | **green 0/4,909** | **D-0262-7** |
| J7 `settings-write.ts:93` 쓰기 경로 하네스를 `claude`로 | canonical key/파일 격리 | red 4 — M 2·`settings-write` 1·`engine.opencode.integration` 1 | 잠김 |
| J14 `misc.ts:52` adapter를 `get('claude')`로 | agent list→adapter 선택 | red 1 — `misc.runtime-catalog…loads native OpenCode models…` | 잠김(M green) |
| J16 `misc.ts:68` catalog 호출 전에 throw | native catalog | red 1 — 같은 케이스 | 잠김(M green) |
| J18 `registry.ts:32` parser를 Claude 모듈로 고정 | 하네스별 parser | red 1 — `registry.test…runs registered parsers…` | 잠김(M green) |
| J3 `:144` 편집 폼 provider를 key로 | form provider | red 2 — U 편집 2 | 잠김 |
| J4 `:131` 추가 폼 engine을 `HARNESS_IDS[0]`로 | form add engine | red 2 — U OpenCode 추가·`interaction…selects Claude or OpenCode…` | 잠김 |
| J13 `:143` 편집 폼 engine을 형제 하네스로 맞바꿈 | form edit engine | red 2 — U 편집 claude·opencode | 잠김(형제 맞바꿈 양방향) |
| J10 `:40` 편집 modal의 agent를 `agents[0]`로 | read→modal 운반 | red 3 — U 편집 2·재시도 | 잠김 |
| J5 `useEngines.ts:37` mutation 뒤 `refreshAgents()` 제거 | hook→catalog 재조회 | red 10 — U 7·`useEngines` 3 | 잠김 |
| J12 `agentStore.ts:26` refresh가 기존 목록 유지 | store 갱신 | red 4 — U 편집 2·삭제 2 | 잠김 |
| J15 `:50` 삭제 확인 문구의 이름 인자를 고정값으로 | 확인 문구 | **green 0/2,920** | N-0262-8 |

- J2 probe(저장소에 남기지 않음): M의 조립에 실제 `createHarnessRuntimeConfigService({ settings })`를 주입한 임시 케이스가 원본에서 OpenCode 행 `catalogError` 없음·`agents` `['build','plan']`·편집 뒤 `shared/open-changed`로 green, J2에서 `expected '하네스 설정을 읽을 수 없습니다.' to be undefined`로 red였다.

## 6. 강제 지점 재열거 (EP-08 + 같은 edge의 ΔV19 EP55d)

| 구현 보고 행 | 보고 | 재측정 | 근거 |
|---|---|---|---|
| schema 정의5 + 실제 등록5 | 10/10 | 10/10 | I1·I1b·P08b red, M이 5채널 ZodError·거절 로그 관측 |
| canonical key / 파일 격리 | 7/7 | 7/7 | J7 red, M CRUD 양방향 |
| 하네스별 loader/parser | 6/6 | 6/6 | J18 red(`registry.test`) — M은 이 자리를 구별하지 못함 |
| parser→catalog / 재조회 | 6/6 | **5/6** | **`resolve` 자리: production은 `harnessRuntime.resolve`(`misc.ts:60-63`, `bootstrap.ts:787`이 항상 주입)인데 M은 fallback `harnessSettings.resolve`만 실행 — J2 green**. native catalog는 J14·J16 red(`misc.runtime-catalog`) |
| catalog→renderer 4 · renderer→IPC 8 | 12/12 | 12/12 | U·P, J5·J12 red |
| form/card 12 · hook/store 6 | 18/18 | 18/18 | I2·I3·I5·P08c·J3·J4·J10·J13 red |

- 합계: 보고 59/59 ↔ 재측정 **58/59**. 차집합 1 = `agent:list` production 분기의 config resolve.
- 같은 edge가 ΔV19 EP55d(`I19 — 실제 agent:list의 local/first`)다. 그 좌표 `engine.opencode.integration.test.ts`는 `harnessRuntime`을 주입하지만 모델명만 단언하고, catalog 실패 폴백도 같은 모델명을 내므로(운반 값 = 형제 값) J2에 침묵한다 — r1~r3의 ΔV19 PASS는 이 자리를 닫지 않았다.

## 5. V-pair closeout (r4)

| Pair | r4 결과 | 근거 |
|---|---|---|
| **VP-Δ19-05 AR19↔IT19** | **PAIR_FAIL** | path `settings→catalog→목록, 실제 handler/adapter 경계` · EP55d production 분기 미잠금(J2). D-0262-7 |
| VP-Δ19-04 SD19↔ST19 · VP-Δ19-03 R54↔AT54 | BLOCKED_BY:VP-Δ19-05 | 두 path가 EP55d `agent:list`를 지난다 |
| VP-08 R-08↔AT-08 | BLOCKED_BY:VP-Δ19-05 | D-0262-6 자리는 closed(위 표). EP-08 `agent list`가 같은 edge |
| VP-14 SD-02↔ST-02 | BLOCKED_BY:VP-Δ19-05 | path `engine/settings → catalog → UI` |
| VP-Δ18-R1 | **PASS** (r3 BLOCKED_BY 해소) | Claude add/edit·OpenCode JSON edit: U(I2·I3·I5·J3·J4·J13 red) · 저장 격리 J7 · `useEngines` J5. catalog 경로 미포함 |
| VP-Δ19-R1 | **PASS** (r3 BLOCKED_BY 해소) | 추가/편집 U · CRUD M(J7) · import(I1b) · OpenCode 실행/이력은 r2 좌표(검출 파일 무변경) |
| VP-01·02·12·13·16·17·19 | PASS (r3 좌표) | r4 변경 무영향 |
| 그 밖의 V1~ΔV21 | r3 판정 유지 · VP21-V·VP-11 시각은 사람 인수 대기 | — |

- root PAIR_FAIL 1 · BLOCKED_BY 4 · PLAN_GAP 0. 같은 root를 상위 pair의 PAIR_FAIL로 다시 세지 않았다.

### AT / AC 합계 (r4 판정 범위)

| AC | 결과 |
|---|---|
| AC8 | ⚠️ — D-0262-6 자리 닫힘. production `agent:list` catalog 분기는 동작(probe green)하나 미잠금 |
| AC54 (ΔV19) | ⚠️ — 같은 이유로 재판정(r1~r3 범위 밖 PASS) |
| AC1·2·3·4·5·6·7·9·10·12 · AC20-1·20-2 | ✅ 12 (r3 유지) |
| AC11 · AC20-3 · AC26·27·33·34·48 | ⚠️ 7 — 시각 사람 인수 대기 (r3 유지) |

- 합계: `✅ 12 · ⚠️ 9 · ❌ 0 = 21`(r3 범위 20 + AC54). 나머지 36개는 r3 판정 유지.
- 사본 대조: 구현 보고 `✅1 = 대상 1(AC8)` ↔ trailer `Criteria-Met: 1/1` ↔ INDEX `AC8 1/1` — 사본끼리 일치, 검증 결과와 AC8에서 갈림.

## 9. 게이트 (r4)

HEAD `a41a8d89`, `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 뒤 Electron 바이너리 설치, better-sqlite3 Node ABI.

| gate | 관측 |
|---|---|
| Vitest 전체 | 758파일 7,454케이스 — 7,447 pass · 0 fail · 7 skip. 새 3파일 44/44 |
| typecheck | node·web·test 3구성 exit 0, `error TS` 0 |
| readonly ESLint(`--fix` 없음) | 1,738파일 error 0 · warning 2(기존 `react-hooks/incompatible-library` 2) |
| `node --test scripts/*.test.mjs` | 142/142 |
| inventory · migrations · test-budgets | ok · sync ok · 16 real-git suites ok |
| `npm run build` | exit 0 (prebuild Electron ABI·typecheck·3 번들) |
| 원격 Windows CI | run #793(`a41a8d89`, PR #502) success |

- 첫 전체 실행은 Electron 바이너리 미설치로 16파일이 import 단계에서 실패했다 — 환경이며 설치 뒤 0 fail. 운영 gate PASS; 이번 FAIL은 gate가 아니라 pair 실패다.

## 11. Repository operation checks (r4)

- INDEX 0262 행: `(r4 구현 — 검증자 기입)`을 `a41a8d89`로 채웠다(`git cat-file -t` commit, `origin/codex-opencode-harness` 포함).
- trailer: `a41a8d89` 5키(`Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 1/1`·`Verified-By: pending`) 파싱·허용값 정상.
- `[구현자 기입]` r4 7필드 전수 존재. 강제 지점 표는 EP-08 여섯 범주 전부와 `남긴 곳` 열을 담는다(접힘 아님).
- INDEX 비고 3줄(≤5).
- 라운드: 이번 FAIL로 5가 된다 — `docs/handoff/AGENTS.md §라운드` "라운드가 3을 초과하면 다음 재구현 전에 handoff-review".

## 13. Finding disposition (r4)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D-0262-6 | `engineAdd` schema binding · 카드→편집 폼 배선 | VP-08 | **closed** — 인용 I1·I2·I3·I5 red 7·6·8·3 | — |
| **D-0262-7** | `agent:list` production 분기(`misc.ts:60-63`) 미잠금 — J2 green 0/4,909. production은 `harnessRuntime`을 항상 주입하는데(`bootstrap.ts:787`) M·`misc.runtime-catalog`는 미주입 fallback을 실행하고, `engine.opencode.integration`은 주입하지만 catalog 실패 폴백과 같은 모델명만 본다. 깨지면 OpenCode 카드에 `catalogError`가 붙고 `agents`가 사라진다(probe) | VP-Δ19-05 root · ΔV19 EP55d · V1 EP-08 `agent list` · AC8·AC54 | **BLOCKING** | 실제 `createHarnessRuntimeConfigService`를 주입한 `agent:list`에서 편집 전후 OpenCode 행의 catalog 고유 산출(`catalogError` 부재·`agents`)을 단언. J2 red로 닫힘 |
| N-0262-8 | 삭제 확인 문구의 엔진 이름 인자 미관측 — J15 green(U의 `tr` mock이 인자를 버림) | 문구 | NON_BLOCKING | 필요 시 `tr` 인자 단언 |
| N-0262-1 · 3 · 7 | 중단 분류 · 폼 `limit.context` · 좌표 이름 | — | 기존 disposition 유지 | — |

- 참고: 0265 EP11 `settings catalog env` 좌표(`misc.runtime-catalog`)도 같은 fallback 분기에서 실행된다. 0265 판정은 이 verify 범위 밖이며 D-0262-7 보완이 같은 분기를 실행하게 된다.

## 14. Review Signals (r4)

- r2·r3·r4에서 같은 형태가 반복됐다: 지목한 자리는 정확히 닫혔고 같은 경로의 인접 자리 하나가 비었다. 이번에는 mock이 아니라 **production이 항상 주입하는 선택 의존성(`harnessRuntime`)을 테스트가 생략해 다른 분기가 실행**된 형태다.
- 관련 지침: `docs/handoff/AGENTS.md §공통 V` 실행 구간(mock·stub한 구성요소 제외)·운반 값 비퇴화(round33). 선택 의존성 생략에 따른 분기 전환은 문면에 이름이 없다.
- 라운드 5(>3) — 다음 재구현 전 handoff-review 대상.
- 반복 환경 한계: Electron 바이너리 기본 미설치(설치 후 해소), 실제 OpenCode CLI 부재(skip).

## 15. 결론 (r4)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 1(VP-Δ19-05) · BLOCKED_BY 4(VP-Δ19-03·04·VP-08·VP-14) · VP-Δ18-R1·VP-Δ19-R1 PASS · PLAN_GAP 0 · 사람 인수 대기 VP21-V·VP-11 시각.
- AC(판정 범위 21): ✅12 · ⚠️9 · ❌0. 운영 gate PASS.
- 다음 단계: handoff-review(라운드 5) → 구현자 r5 — D-0262-7의 J2 red 보고.

# r5 검증

## 메타 (r5)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `d16a71e3..9760e0a5` — round 34 review `e848ff3b`(`Handoff: none`) + r5 구현 `9760e0a5`(테스트 2파일 + plan·INDEX) |
| 구현 전 plan 기준 | `12c81cfa`(ΔV21) — r4 검증 `d16a71e3` 이후 규범 행 변경 없음 |
| V mode / 유효 V | V1 + ΔV1~ΔV21 |
| 검증 HEAD | `9760e0a5` (`origin/ccr-f3743b30-7177zo`, PR #507 → base `codex-opencode-harness`) |
| 라운드 | 5 |
| 상태 | **FAIL** — root PAIR_FAIL 1(VP-Δ19-05) · BLOCKED_BY 1 · PLAN_GAP 0 |
| 자기 검증 여부 | **구현·검증·round 34 review가 같은 에이전트(같은 세션)다.** 보고에 없는 축 11개(K1~K10·K9b)를 심었고 그중 K9·K9b가 D-0262-8을 냈다(§4) |

## 0. 기준선 / plan validity (r5)

- `9760e0a5`의 `plan.md` 삭제 줄 1: 메타 `상태` 문구뿐이다. Decision·AC·V node/pair·§10 변경 없음 → r4 plan validity 유지.
- `app/` 변경: 테스트 2파일 +73/−3, production 0파일(`git diff --numstat d16a71e..9760e0a -- app/`). `scan-surface.sh`도 소스 변경 0.
- 아래 D-0262-8의 자리는 ΔV19 §10 `EP55e resolve-turn 모델 선택`이 이미 명시한다. 구현자가 새 계약 없이 닫을 수 있으므로 PLAN_GAP 아님.
- 라운드 5 선행 handoff-review: `e848ff3b`(round 34)가 실행 구간 정의에 "조립 루트가 주입하는 의존성을 빼서 실행되지 않은 production 분기"를 넣었고 r5는 그 뒤에 구현됐다.

## 2. 비판적 읽기 (r5) — 새 조립과 production 조립 루트 대조

| 좌표 | 테스트 조립 | production(`bootstrap.ts:557-590`·`:787-788`) | 판정 |
|---|---|---|---|
| M `agent:list`·엔진 CRUD | `harnessRuntime`(실제 서비스, augmenter `createRuntimeConfigAugmenters({auth:{},secrets:{}})`) · `runtimeModelCatalog`(contributions `[]`, 던지는 `snapshotOf`) | 같은 factory, 기본 배포 augmenter `{}`·contributions `[]`(`deployment/harness-runtime.ts`) | 동등. `snapshotOf`·`onChange`는 contribution이 있을 때만 호출(`runtime-catalog.ts:162-167`) |
| I19 `agent:list` | 위와 같음(augmenter `{}`) | 같음 | 동등 |
| **I19 `resolveTurnProvider`** | ctx에 `harnessRuntime`만 — **`runtimeModelCatalog` 없음** | `registerChatHandlers({ ctx })`(`bootstrap.ts:973`)의 ctx가 둘 다 가짐 → `resolve-turn.ts:93`·`send.ts:658` | **`resolve-turn.ts:228` merge가 `?? settings` fallback으로 실행 — production 분기 구간 밖** |

- 운반 값: M의 편집 전후 모델명이 다르고, `agents`는 catalog 성공에서만 나와 폴백과 구별된다(`catalog.ts:5-27`). 비퇴화 확인.
- I19의 턴 선택은 같은 `runtime`으로 먼저 `agent:list`를 돌려 cache를 데운다. 그래서 `resolve-turn.ts:266`을 `cached`로 바꾼 K4가 I19에서 green이고, 그 자리는 `native-history.test.ts`의 `uses stored %s backend…`(opencode 포함)가 닫는다.

## 4. 적대 증거 재측정 (r5)

범위: `src/main`+`src/shared` 425파일 4,909케이스(기준선 실패 0·skip 7). 실행기는 변이마다 원본 SHA256 복원을 단언했고 21회 모두 복원 확인, 종료 후 `git status` clean.

### 인용 변이 (D-0262-7)

| 변이 | r4 | r5 | 구현 보고 |
|---|---|---|---|
| J2 `misc.ts:63` `harnessRuntime.resolve(target)` → `cached(entry.key)` | green 0 | **red 3** — M `creates, reads, updates, lists and deletes only the selected claude/opencode engine` 2 · I19 1 | 3 일치 |

- 인용 1/1 red → **D-0262-7 closed**.

### 이전 라운드 red 재실행 (검출 파일 M이 바뀜)

| 변이 | r4 | r5 | 판정 |
|---|---|---|---|
| I1 `engineAdd` 무검증 parser | red 7 | red 7 (M 7) | 유지 |
| I1b `engineImportUserSettings` 무검증 parser | red 2 | red 2 (M 1 · `engine.import` 1) | 유지 |
| P08b `EngineSchema = z.string()` | red 10 | red 10 (protocol 5 · M 5) | 유지 |
| J7 쓰기 경로 하네스 `claude` 고정 | red 4 | red 4 (M 2 · I19 1 · settings-write 1) | 유지 |
| J14 adapter `get('claude')` | red 1 | red 3 (M 2 · misc.runtime-catalog 1) | 확장 |
| J16 catalog 호출 전 throw | red 1 | red 4 (M 2 · I19 1 · misc.runtime-catalog 1) | 확장 |
| J1 `engine.ts:45` runtime 무효화 제거 | red 13 | red 13 | 유지 |

- red → green 0 — 덮개 회귀 없음. renderer 쪽(I2·I3·I5·J3~J13)은 production·검출 파일이 `a41a8d89..9760e0a5`에서 무변경이라 재실행하지 않았다.
- 보고 추가 감도 J20 red 1(`misc.runtime-catalog`)·J21 red 3(`engine.runtime-catalog`)도 재현했다.

### 보고에 없는 독립 축

| 변이 | 자리 | r5 | 판정 |
|---|---|---|---|
| K1 `misc.ts` catalog에 `prepared.providerSettings?.settings` 대신 `{}` | settings→catalog 운반 | red 4 (M 2 · I19 · misc.runtime-catalog) | 잠김 |
| K2 `misc.ts` target `harnessId`를 `'claude'`로 | resolve target 하네스 | red 4 (같은 분포) | 잠김 |
| K3 `misc.ts` target `modelProviderId`를 `''`로 | resolve target provider | red 4 (같은 분포) | 잠김 |
| K8 `misc.ts:61` 읽기 전용 판정을 `true`로 | 분기 선택 | red 3 (M 2 · I19) | 잠김 |
| K10 `misc.ts:49` `merge(settings)` → `merge([])` | agent:list merge | red 4 (M 2 · I19 · misc.runtime-catalog) | 잠김 |
| K4 `resolve-turn.ts:266` `resolve(entry)` → `cached` | 턴 config | red 11 (native-history 9 · native-session 1 · resolve-turn.runtime-catalog 1) — **I19 green** | 잠김(다른 좌표) |
| K5 `resolve-turn.ts` catalog settings `{}` | 턴 catalog 운반 | red 2 (I19 · resolve-turn.runtime-catalog) | 잠김 |
| **K9** `resolve-turn.ts:228` `merge(settings, req.adapter.id)` → `merge(settings, 'claude')` | 턴 선택 merge(EP55e) | **green 0/4,909** | **D-0262-8** |
| **K9b** 같은 자리 `merge([], req.adapter.id)` | 같음 | **green 0/4,909** | D-0262-8 |
| K6 `misc.ts:63` production 분기를 fallback 계산(`harnessSettings.resolve`)으로 | runtime config vs settings | green 0 | N-0262-9 — 기본 배포에서 두 분기 산출이 같다 |
| K7 `misc.ts:65` config 가드 제거 | 가드 | green 0 | N-0262-10 — 기본 배포에서 도달 불가·하위 TypeError도 `catalogError` |

- K9 probe(저장소에 남기지 않음): I19 사본의 `resolveTurnProvider` ctx에 같은 `runtimeModelCatalog`를 넣으면 원본 green, K9에서 `expected undefined to be 'local/first'`로 red다. production에서는 OpenCode 턴이 provider·모델 없이 진행된다.

## 6. 강제 지점 재열거 (r5)

구현 보고의 분모 검색은 `engine.ts`·`misc.ts` 두 파일이다. 같은 술어를 `src/main` 비테스트 전체로 넓히면(`rg -n 'ctx\.(harnessRuntime|runtimeModelCatalog)' src/main --glob '!*.test.ts'`) 14줄이고, 차집합은 `resolve-turn.ts` 5줄 — ΔV19 EP55e 자리다.

| 자리 | 보고 | 재측정 | 근거 |
|---|---|---|---|
| `engine.ts:45-46` 무효화 | 닫힘 | 닫힘 | J1 red 13 |
| `engine.ts:53` 읽기 전용 가드 | 닫힘 | 닫힘 | J21 red 3 |
| `misc.ts:49` merge | 닫힘 | 닫힘 | J20 red 1 · K10 red 4 |
| `misc.ts:60-63` resolve | 닫힘 | 닫힘 | J2 red 3 · K1~K3·K8 red |
| `misc.ts:61-62` 읽기 전용 cached | 도달 불가 | 도달 불가 | 기본 배포 contributions `[]` |
| `misc.ts:65` config 가드 | 닫힘(J2) | **도달 불가·동치** | K7 green — J2에서만 인위로 도달하고 가드가 없어도 `catalogError`가 난다 |
| `resolve-turn.ts:228` merge | (분모 밖) | **열림** | K9·K9b green |
| `resolve-turn.ts:264-265` 읽기 전용 cached | (분모 밖) | 도달 불가 | 위와 같음 |
| `resolve-turn.ts:266` resolve | (분모 밖) | 닫힘 | K4 red 11(I19 아님) |

- 합계: 보고 `5/6` ↔ 재측정 9자리 중 닫힘 5 · 도달 불가/동치 3 · **열림 1**.
- EP-08(VP-08) 59자리: r4 차집합 1(`agent:list` resolve)이 J2 red로 닫혀 **59/59**. EP55d도 J2·K1~K3·K8·K10 red로 닫힘. EP55e는 config resolve(K4)·catalog 운반(K5) 닫힘, **merge 열림 → 2/3**.

## 5. V-pair closeout (r5)

| Pair | r5 결과 | 근거 |
|---|---|---|
| **VP-Δ19-05 AR19↔IT19** | **PAIR_FAIL** | EP55d 닫힘(D-0262-7 closed). EP55e `resolve-turn.ts:228` production merge 미잠금(K9·K9b green). D-0262-8 |
| VP-Δ19-03 R54↔AT54 | BLOCKED_BY:VP-Δ19-05 | path가 `→턴 선택`(EP55a~e)을 지난다 |
| VP-Δ19-04 SD19↔ST19 | **PASS** (r4 BLOCKED_BY 해소) | path EP54c/55b~d — EP54c I19(J7 red) · EP55b `catalog.test.ts:rebuilds from only the engine document…` · EP55c `engine.deployment`(J1 red 10) · EP55d 위 |
| VP-08 R-08↔AT-08 | **PASS** (r4 BLOCKED_BY 해소) | EP-08 59/59. 턴 선택은 EP-08 자리가 아니다 |
| VP-14 SD-02↔ST-02 | **PASS** (자동 행동) | path `engine/settings→catalog→UI` = VP-08/09/11 실행 집합. VP-11 시각은 사람 |
| VP-Δ18-R1 · VP-Δ19-R1 | PASS (r4 좌표) | M 검출 유지(J7 red 2·I1b red 1) |
| 그 밖의 V1~ΔV21 | r4 판정 유지 · VP21-V·VP-11 시각은 사람 인수 대기 | — |

- root PAIR_FAIL 1 · BLOCKED_BY 1 · PLAN_GAP 0.

### AT / AC 합계 (r5 판정 범위)

| AC | 결과 |
|---|---|
| AC8 | ✅ — production 조립의 CRUD 전후 catalog 산출(J2 red) |
| AC54 (ΔV19) | ⚠️ — 목록 경로는 닫힘. 턴 선택의 production merge 분기 미잠금(probe에서는 동작) |
| AC1·2·3·4·5·6·7·9·10·12 · AC20-1·20-2 | ✅ 12 (r4 유지) |
| AC11 · AC20-3 · AC26·27·33·34·48 | ⚠️ 7 — 시각 사람 인수 대기 (r4 유지) |

- 합계: `✅ 13 · ⚠️ 8 · ❌ 0 = 21`(r4 범위와 같음). 나머지 36개는 r3 판정 유지.
- 사본 대조: 구현 보고 `✅2` ↔ trailer `Criteria-Met: 2/2` ↔ INDEX `AC8·AC54 2/2` — 사본끼리 일치, 검증 결과와 AC54에서 갈림.

## 9. 게이트 (r5)

HEAD `9760e0a5`, better-sqlite3 Node ABI(이후 build가 Electron ABI로 전환).

| gate | 관측 |
|---|---|
| Vitest 전체 | 758파일 7,454케이스 — 7,447 pass · 0 fail · 7 skip. 변경 2파일 14/14 |
| typecheck | node·web·test 3구성 exit 0, `error TS` 0 |
| readonly ESLint(`--cache=false`, `--fix` 없음) | 1,738파일 error 0 · warning 2(기존 `react-hooks/incompatible-library` 2) |
| `node --test scripts/*.test.mjs` | 142/142 |
| inventory · migrations · test-budgets | prose·links ok · no-copies ok · 16 real-git suites ok |
| `npm run build` | exit 0 (`[sqlite-abi] electron: rebuilt`·3 번들) |
| 원격 Windows CI | PR #507 check `gate`(head `9760e0a5`) success |

- 운영 gate PASS. 이번 FAIL은 gate가 아니라 pair 실패다. 각 명령 뒤 `git status` clean.

## 11. Repository operation checks (r5)

- INDEX 0262 행: `(r5 구현 — 검증자 기입)`을 `9760e0a5`로 채웠다(`git cat-file -t` commit, `origin/ccr-f3743b30-7177zo` 포함). r5는 아직 base `codex-opencode-harness`에 없고 PR #507로 올라가 있다.
- trailer: `9760e0a5` 5키(`Agent: claude`·`Handoff`·`Status: implemented`·`Criteria-Met: 2/2`·`Verified-By: pending`), `e848ff3b` 3키(`Agent: claude`·`Handoff: none`·`Status: designed`) 파싱·허용값 정상.
- `[구현자 기입]` r5 7필드 전수 존재. 강제 지점 표는 pair별 §10 자리와 `남긴 곳` 열을 담는다. 다만 분모 검색 범위가 두 파일이라 EP55e의 조립 의존 자리가 표에 없다(§6).
- `e848ff3b`(handoff 지침) 위생: 비밀·이메일·IP 0. 지침 의미 검증은 round 34 review 자체의 책임이며 이 verify 범위 밖이다.
- INDEX 비고 3줄(≤5). 라운드: 이번 FAIL로 6이 된다 — 3 초과라 다음 재구현 전에 handoff-review.

## 13. Finding disposition (r5)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D-0262-7 | `agent:list` production 분기 | VP-Δ19-05 · EP55d · EP-08 | **closed** — 인용 J2 red 3 | — |
| **D-0262-8** | 턴 선택 `resolve-turn.ts:228` production merge 미잠금 — K9(`'claude'` 고정)·K9b(`[]`) green 0/4,909. EP55e 좌표 I19의 `resolveTurnProvider` ctx가 production이 주입하는 `runtimeModelCatalog`를 빼 `?? settings` fallback을 실행한다. 깨지면 OpenCode 턴의 `model`이 `undefined`(probe) | VP-Δ19-05 root · ΔV19 EP55e · AC54 | **BLOCKING** | I19 턴 선택 ctx에 bootstrap과 같은 `runtimeModelCatalog`를 주입해 K9 red로 닫는다. 같은 파일의 다른 조립 의존 자리도 함께 대조 |
| N-0262-9 | `misc.ts:63` production 분기를 settings fallback 계산으로 바꿔도 green(K6) — 기본 배포의 augmenter 산출(`runtimeEnv`·`availableModels`·`validUntil`)이 빈 값뿐이라 두 분기가 구별되지 않는다 | 0188 runtime config · 0265 EP11(구현자 보고) | NON_BLOCKING | 0262 계약(settings·key·실제 adapter)은 K1~K3로 잠김. augmenter 운반은 해당 핸드오프 몫 |
| N-0262-10 | 구현 보고가 `misc.ts:65` 가드를 J2로 닫았다고 셌다 — K7 green, 기본 배포에서 도달 불가·동치 | 보고 정확성 | NON_BLOCKING | 분모 표에서 도달 불가로 분류 |
| N-0262-1 · 3 · 7 · 8 | 중단 분류 · 폼 `limit.context` · 좌표 이름 · 확인 문구 인자 | — | 기존 disposition 유지 | — |

## 14. Review Signals (r5)

- r2·r3·r4·r5가 같은 형태다: 지목한 자리는 닫혔고 같은 계약의 인접 자리가 비었다. r5는 지목된 `agent:list`(handler) 대신 **형제 소비처 `resolve-turn`**(같은 조립 의존 분기, 같은 ΔV19 pair)이 비었다.
- 관련 지침은 있었다: 구현자는 round 34 정의를 적용했다고 적었으나 분모 검색을 D-0262-7이 인용한 두 파일로 한정했다. `docs/handoff/AGENTS.md` 구현 최소 계약 "그 검색의 술어는 불변식의 주어로 쓴다 — 네가 쓴 해법의 이름이 아니다"가 이 형태에 해당한다.
- 구현·검증·review가 같은 에이전트다. 이번 결함은 보고에 없는 형제 진입점 축(K9)에서만 나왔다.
- 라운드 6(>3) — 다음 재구현 전 handoff-review 대상.
- 반복 환경 한계: 실제 OpenCode CLI 부재(skip 7). Electron 바이너리는 이번 환경에 설치돼 있었다.

## 15. 결론 (r5)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 1(VP-Δ19-05) · BLOCKED_BY 1(VP-Δ19-03) · VP-08·VP-14·VP-Δ19-04 PASS(r4 BLOCKED_BY 해소) · PLAN_GAP 0 · 사람 인수 대기 VP21-V·VP-11 시각.
- AC(판정 범위 21): ✅13 · ⚠️8 · ❌0. 운영 gate PASS.
- 다음 단계: handoff-review(라운드 6) → 구현자 r6 — D-0262-8의 K9 red 보고.

# r6 검증

## 메타 (r6)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `9760e0a5..1df6a970` — r5 검증 `b9a75f9d` + round 35 review `8b259018`(`Handoff: none`) + r6 구현 `1df6a970`(테스트 1파일 + plan·INDEX) |
| 구현 전 plan 기준 | `12c81cfa`(ΔV21) — r5 검증 이후 규범 행 변경 없음 |
| V mode / 유효 V | V1 + ΔV1~ΔV21 |
| 검증 HEAD | `1df6a970` (`origin/ccr-f3743b30-7177zo`, PR #507 → base `codex-opencode-harness`) |
| 라운드 | 6 |
| 상태 | **FAIL** — root PAIR_FAIL 1(VP-16) · BLOCKED_BY 1 · PLAN_GAP 0 |
| 자기 검증 여부 | **구현·검증·round 35 review가 같은 에이전트다.** 보고에 없는 축 11개(X1~X5·X7~X12)와 조립 의존 분모의 독립 재열거(RouterContext 선택 필드 전수)를 넣었고 X8·X9·X11·X12가 D-0262-9를 냈다(§4·§6) |

## 0. 기준선 / plan validity (r6)

- `1df6a970`의 `plan.md` 삭제 줄은 1줄, 메타 `상태` 문구다(`git show 1df6a97 -- …/plan.md | grep '^-'`). Decision·AC·V node/pair·§10 변경 없음 → r5 plan validity 유지.
- `b9a75f9d`(r5 검증)·`8b259018`(round 35)는 plan 규범 행을 건드리지 않는다. round 35는 skill·`docs/handoff/AGENTS.md`만 바꿨다.
- `app/` 변경: `engine.opencode.integration.test.ts` +10/−5, production 0파일(`git show --numstat 1df6a97`). `scan-surface.sh 9760e0a..1df6a97` = "변경된 소스 파일이 없습니다".
- 라운드 6 선행 handoff-review: `8b259018`(round 35, 강제 지점 검색 범위 = pair path 소스 전체). r6은 그 뒤에 구현됐다.

## 2. 비판적 읽기 (r6) — 새 조립과 production 조립 루트 대조

| 좌표 | 테스트 조립 | production | 판정 |
|---|---|---|---|
| I19 `resolveTurnProvider` ctx | `harnessSettings`·`harnessRuntime`·**`runtimeModelCatalog`**(같은 `register()`가 만든 인스턴스)·`db`·`mcp` | `bootstrap.ts:762-789` 단일 `ctx` → `registerChatHandlers({ ctx })`(`:973`) → `resolve-turn.ts:93` | 동등(선택 분기) — 읽는 ctx 필드 5개 중 `harnessSettings`·`harnessRuntime`·`runtimeModelCatalog`는 production factory. `db`(세션 없음)·`mcp`(env 확장 `prepare-input.ts:15`)는 stub이고 provider·모델 선택 분기를 가르지 않는다 |
| 루프 2회차 | `settings`·`runtime`·`runtimeModelCatalog`를 함께 재생성 | 앱 재시작 | 동등 — 재생성 후 같은 모델(서비스 재생성 축 유지) |

- 운반 값: provider key `opencode-local` ↔ 형제 `opencode-other`, 모델 `local/first` ↔ `other/extra`가 구별된다. merge의 adapter 인자는 `'opencode'`이고 형제 하네스 `claude`와 구별된다(K9 red).
- `RouterContext`의 선택 필드는 `harnessRuntime`·`runtimeModelCatalog` 둘뿐이다(`context.ts:55-56`, `?:` 전수). nullable 필드는 `mockAdapter`(production `null`) 하나다.

## 4. 적대 증거 재측정 (r6)

범위: `src/main`+`src/shared` 425파일 4,909케이스(기준선 4,902 pass · 0 fail · 7 skip). 실행기(`mutate.mjs`, 검증자 scratchpad)는 변이마다 앵커 1회 출현을 확인하고 원본 SHA256 복원을 단언했다 — 23회 모두 복원, 종료 후 `git status` clean.

### 인용 변이 (D-0262-8)

| 변이 | r5 | r6 | 구현 보고 |
|---|---|---|---|
| K9 `resolve-turn.ts:228` `merge(settings, req.adapter.id)` → `merge(settings, 'claude')` | green 0 | **red 1** — I19 | 1 일치 |
| K9b 같은 자리 `merge([], req.adapter.id)` | green 0 | **red 1** — I19 | 1 일치 |

- 인용 2/2 red → **D-0262-8 closed**.

### 이전 라운드 red 재실행 — 검출 파일 I19가 바뀜

r6이 바꾼 파일은 I19 하나라, r5에서 I19가 검출 집합에 들었던 변이와 EP55e의 형제 자리(K4)를 다시 돌렸다.

| 변이 | r5 | r6 | 판정 |
|---|---|---|---|
| J2 `misc.ts:63` `resolve(target)` → `cached(entry.key)` | red 3 (M 2 · I19) | red 3 (M 2 · I19) | 유지 |
| J7 `settings-write.ts:93` 쓰기 하네스 `'claude'` | red 4 (M 2 · I19 · settings-write) | red 4 (같은 분포) | 유지 |
| J16 `misc.ts:67` prepare·catalog 호출 앞 throw | red 4 (M 2 · I19 · misc.runtime-catalog) | red 4 (같은 분포) | 유지 |
| K1 `misc.ts` catalog settings `{}` | red 4 (M 2 · I19 · misc.runtime-catalog) | red 4 (같은 분포) | 유지 |
| K2 `misc.ts` target `harnessId: 'claude'` | red 4 | red 4 (같은 분포) | 유지 |
| K3 `misc.ts` target `modelProviderId: ''` | red 4 | red 4 (같은 분포) | 유지 |
| K4 `resolve-turn.ts:266` `resolve(entry)` → `cached` | red 11 (native-history 9 · native-session 1 · resolve-turn.runtime-catalog 1) | red 11 (같은 분포) — I19 green 유지 | 유지 |
| K5 `resolve-turn.ts:275` catalog settings `{}` | red 2 (I19 · resolve-turn.runtime-catalog) | red 2 (같은 분포) | 유지 |
| K8 `misc.ts:61` 읽기 전용 판정 `true` | red 3 (M 2 · I19) | red 3 (같은 분포) | 유지 |
| K10 `misc.ts:49` `merge(settings)` → `merge([])` | red 4 (M 2 · I19 · misc.runtime-catalog) | red 4 (같은 분포) | 유지 |

- red → green 0 — 덮개 회귀 없음. 구현 보고가 대조한 J2·J7·J16 외 K1~K5·K8·K10도 r5와 같은 수·분포다. 검출 파일이 무변경인 변이(I1·I1b·P08b·J1·J14·J20·J21, renderer 쪽)는 재실행하지 않았다.

### 보고에 없는 독립 축

| 변이 | 자리 | r6 | 판정 |
|---|---|---|---|
| X1 `resolve-turn.ts:240` `byKey(req.providerKey)` → 요청 key가 **아닌** 형제 entry | 턴 선택 provider 운반(EP55e) | red 1 — I19 | 잠김 — 형제 provider `opencode-other`의 모델이 선택돼 `local/first` 단언이 깨진다 |
| X2 `misc.ts:49` `merge(settings)` → `merge(settings, 'claude')` | K9의 같은 변이를 형제 소비처(목록)에 | red 4 (M 2 · I19 · misc.runtime-catalog) | 잠김 |
| X3 `resolve-turn.ts:281` `req.modelFamily ?? defaultModelFamily(models)` → `defaultModelFamily(models)` | 사용자 선택 모델 운반 | red 4 (`chat-turn.runtime-tools` 3 · `native-session` 1) — I19 green | 잠김(다른 좌표). I19는 AC54대로 모델 1개 문서라 선택값=기본값이다 — ΔV19 운반 값이 아니다 |
| X4 `bootstrap.ts:788` ctx에서 `runtimeModelCatalog` 주입 제거 | 조립 루트 → 세 소비처(목록·턴·CRUD) | green 0/4,909 | 기본 배포 동치 — N-0262-11 |
| X5 `resolve-turn.ts:280` `catalog?.models ?? selected.models` → `selected.models` | adapter catalog → 턴 모델 목록 | green 0/4,909 | 동치 — catalog를 가진 adapter는 OpenCode 하나이고 그 모델은 settings와 같은 `parseOpenCodeModels`(`v1/catalog.ts:16`)다. D-044가 두 목록을 같은 목록으로 정의한다 |
| X7 `resolve-turn.ts:228` merge 호출 자체 제거(`settings`만) | 턴 merge의 runtime 행 | red 3 — `resolve-turn.runtime-catalog` 3 · I19 green | 잠김(runtime 행 배포). 기본 배포에서는 runtime 행 0·`isReadOnly` 항상 false라 merge ≡ fallback — K9·K9b가 red인 것은 merge가 opencode 행을 걸러 내기 때문이다 |
| X8 `resolve-turn.ts:259` 턴 실행 구성 target `harnessId: selected.harnessId` → `'claude'` | 선택 entry → runtime config resolve(R40 edge) | **green 0/4,909** | **D-0262-9** |
| X9 `resolve-turn.ts:260` target `modelProviderId` → `''` | 같음 | **green 0/4,909** | D-0262-9 |
| X11 `resolve-turn.ts:232` 설정 행 매핑 `entry.provider ?? entry.key` → `entry.key` | 같은 값의 상류 운반 | **green 0/4,909** | D-0262-9 |
| X12 `resolve-turn.ts:231` 설정 행 매핑 `harnessId: entry.adapter` → `'claude'` | 같음 | **green 0/4,909** | D-0262-9 |
| X10 `resolve-turn.ts:258` target `key`를 형제 entry key로 | runtime config cache identity | green 0/4,909 | 동치 — settings 해석은 `harnessId`·`modelProviderId`로 하고(`runtime-config.ts:167` → `settings.ts:79`) key는 cache 칸과 `providerSettings.providerKey` 라벨만 정한다 — settings 본문은 같고, 라벨의 비테스트 소비처는 `rg '\.providerSettings\??\.providerKey' src/main` 0건 |

- X8 probe(저장소에 남기지 않음): I19 사본에 `selected.prepared.providerSettings?.settings`를 저장 문서와 비교하는 단언 1줄을 넣으면 원본 pass, X8에서 `expected undefined to deeply equal {…}`로 red다. 같은 실행에서 `providerKey`는 `opencode-local`, `model`은 `local/first`로 그대로였다 — production에서 OpenCode 턴이 엔진 문서 오버라이드 없이 `local/first`를 요청한다. probe 파일 삭제 후 `resolve-turn.ts` SHA256이 HEAD와 같다.
- 실행기 복원: 1차 18 · 2차 3 · 3차 2 = 23회 모두 SHA256 일치, 각 배치 종료 후 `git status` clean.

## 6. 강제 지점 재열거 (r6) — 조립 의존 분모 + 턴 실행 구성 운반

구현 보고의 분모 검색(`rg -n 'ctx\.(harnessRuntime|runtimeModelCatalog)|deps\.(…)' app/src/main --glob '!*.test.ts'`)을 재실행하면 14줄이다 — `engine.ts` 3 · `misc.ts` 6 · `resolve-turn.ts` 5. 검증자는 술어를 바꿔 독립 재열거했다.

| 재열거 | 결과 | 차집합 |
|---|---|---|
| `RouterContext` 선택 필드 전수(`context.ts`의 `?:`) | `harnessRuntime`·`runtimeModelCatalog` 2개 | 0 — 구현 보고 술어가 덮는 의존성과 같다 |
| 두 이름의 모든 출현(`rg -c 'runtimeModelCatalog\|harnessRuntime' src/main --glob '!*.test.ts'`) | 32줄 = 위 14줄 + `bootstrap.ts` 12줄 + 타입 선언 6줄(`context.ts` 2 · `engine.ts:30-32` · `misc.ts:28`) | `bootstrap.ts:787-788` ctx 주입 edge 1 — X4 green(기본 배포 동치, N-0262-11) |
| `resolveTurnProvider(` 호출처 | `resolve-turn.ts:93`·`send.ts:658`·`native-history.ts:41` — 셋 다 같은 `ctx` | 0 — 주입 edge는 bootstrap 한 곳 |
| EP55e `:263-266 resolve` 자리의 **운반 값**(target `key`·`harnessId`·`modelProviderId`와 그 상류 `:231-232`) | 구현 보고는 K4(`resolve`↔`cached`)로 닫음 — 호출 여부만 잰다 | X8·X9·X11·X12 green — 운반 값 미잠금(아래) |

| 자리 | 보고 | 재측정 | 근거 |
|---|---|---|---|
| `engine.ts:45-46` 무효화 · `:53` 읽기 전용 가드 | 닫힘 | 닫힘 | r5 J1 red 13 · J21 red 3 (검출 파일 무변경) |
| `misc.ts:49` merge | 닫힘 | 닫힘 | K10 red 4 · X2 red 4 |
| `misc.ts:60-63` resolve(+target) | 닫힘 | 닫힘 | J2 red 3 · K2·K3 red 4 · K8 red 3 |
| `misc.ts:61-62` · `:65` | 도달 불가/동치 | 도달 불가/동치 | contributions `[]`(`deployment/harness-runtime.ts:120`) · r5 K7 |
| `resolve-turn.ts:228` merge | 닫힘 | **닫힘** | K9·K9b red 1 (I19) · X7 red 3(runtime 행) |
| `resolve-turn.ts:264-265` 읽기 전용 cached | 도달 불가 | 도달 불가 | contributions `[]` |
| `resolve-turn.ts:266` resolve 호출 | 닫힘(K4) | 닫힘(호출 축) | K4 red 11 |
| `resolve-turn.ts:256-260` target · `:231-232` 매핑 — 엔진 문서 → 턴 실행 구성 | (분모 밖) | **열림** | X8·X9·X11·X12 green 0/4,909 · probe: `providerSettings` null |

- 합계: 구현 보고 `9자리 — 닫힘 6 · 도달 불가 3` ↔ 재측정 10자리 — 닫힘 6 · 도달 불가/동치 3 · **열림 1**.
- ΔV19 관점에서 열린 자리는 모델 선택을 바꾸지 않는다 — target이 틀리면 턴 catalog가 건너뛰어지고 `selected.models`(같은 문서, X5 동치)로 폴백한다. 그래서 EP55e(모델 선택)는 닫혔고, 이 자리는 ΔV15 R40 path `engine/runtime→adapter config`의 자리다(§5).

## 5. V-pair closeout (r6)

| Pair | r6 결과 | 근거 |
|---|---|---|
| **VP-16 AR-02↔IT-02** | **PAIR_FAIL** (r3 PASS 재판정) | 노드 계약 `immutable backend·provider config·history`, path `backend/config → send/history`. 턴의 provider config edge(`resolve-turn.ts:231-232`·`:256-260`)가 r3 좌표(EP-02 `send.harness`·`resolve-turn.agent` 등) 어느 실행 구간에서도 운반 값이 구별되지 않는다 — X8·X9·X11·X12 green. D-0262-9 |
| VP-Δ15-02 R40↔AT40 | BLOCKED_BY:VP-16 | path `engine/runtime→adapter config/env→native config`가 같은 edge를 지난다. 직접 oracle `native-storage.integration`은 `providerSettings`를 손으로 만들어 adapter를 부르고(`native-storage.testfixture.ts:175`) `ORCA_TEST_OPENCODE_EXE` 없이 skip이다 |
| VP-Δ19-05 AR19↔IT19 | **PASS** (r5 PAIR_FAIL 해소) | EP53b·54a·54b r5 좌표(검출 파일 무변경) · EP55d J2 red 3·K1~K3·K8·K10·X2 red · EP55e merge K9·K9b red 1, provider 운반 X1 red 1, catalog 운반 K5 red 2, resolve 호출 K4 red 11 |
| VP-Δ19-03 R54↔AT54 | **PASS** (r5 BLOCKED_BY 해소) | EP55a·b `catalog.test.ts` 2케이스 · EP55c `engine.deployment`(r5 J1) · EP55d·e 위와 공유. I19가 저장→목록→턴 선택을 production 조립 한 구간에서 실행 |
| VP-Δ19-04 · VP-08 · VP-14 · VP-Δ18-R1 · VP-Δ19-R1 | PASS (r5 좌표) | I19·M 검출 수가 r5와 같다(§4) |
| 그 밖의 V1~ΔV21 | r5 판정 유지 · VP21-V·VP-11 시각은 사람 인수 대기 | — |

- root PAIR_FAIL 1(VP-16) · BLOCKED_BY 1(VP-Δ15-02) · PLAN_GAP 0.
- PLAN_GAP 아님: VP-16 path `backend/config → send`와 R40 path `engine/runtime→adapter config`가 이 edge를 명시한다. 구현자는 새 계약 없이 I19 조립에서 닫을 수 있다(probe 1줄이 X8을 red로 만든다). ΔV15 §10 EP42a~g와 V1 EP-02가 이 자리를 행으로 담지 않은 것은 설계 정정 때 함께 적을 사항이다.

### AT / AC 합계 (r6 판정 범위)

| AC | 결과 |
|---|---|
| AC54 (ΔV19) | ✅ — 저장→목록→턴 선택을 production 조립으로 관측, merge K9·K9b red |
| AC40 (ΔV15) | ⚠️ — 동작은 성립(probe 원본 pass)하나 엔진 문서 → 턴 실행 구성 edge 미잠금(D-0262-9) |
| AC1·2·3·4·5·6·7·8·9·10·12 · AC20-1·20-2 | ✅ 13 (r5 유지) |
| AC11 · AC20-3 · AC26·27·33·34·48 | ⚠️ 7 — 시각 사람 인수 대기 (r5 유지) |

- 합계: `✅ 14 · ⚠️ 8 · ❌ 0 = 22`(r5 범위 21 + AC40). 나머지 35개는 r5 판정 유지.
- 사본 대조: 구현 보고 `✅1` ↔ trailer `Criteria-Met: 1/1` ↔ INDEX `AC54 1/1` — 사본끼리 일치하고 검증 결과와도 AC54에서 일치한다.

## 9. 게이트 (r6)

HEAD `1df6a970`, 실행 순서 readonly lint → typecheck → Vitest(Node ABI) → scripts → build(Electron ABI). 명령은 `app/AGENTS.md`를 따랐고 `npm run lint`(`--fix`) 대신 `eslint --cache=false`를 썼다.

| gate | 관측 |
|---|---|
| readonly ESLint(`--cache=false`, `--fix` 없음) | 1,738파일 error 0 · warning 2(기존 `react-hooks/incompatible-library` 2) |
| typecheck | node·web·test 3구성 exit 0, `error TS` 0 |
| Vitest 전체 | 758파일 7,454케이스 — 7,447 pass · 0 fail · 7 skip. I19 단독 1/1 |
| `node --test scripts/*.test.mjs` | 142/142 |
| inventory · migrations · test-budgets | generated·prose·links ok · no-copies ok(1,709파일) · 16 real-git suites ok |
| `npm run build` | exit 0 (`[sqlite-abi] electron: rebuilt` · 3 번들) |
| `git diff --check` | 출력 0 |
| 원격 Windows CI | PR #507 check `gate`(head `1df6a970`) success |

- 운영 gate PASS. 이번 FAIL은 gate가 아니라 pair 실패다. 각 단계 뒤 `git status` clean(`app/out/`은 ignore).

## 11. Repository operation checks (r6)

- INDEX 0262 행: `(r6 구현 — 검증자 기입)`을 `1df6a970`으로 채웠다(`git cat-file -t` commit, `origin/ccr-f3743b30-7177zo` 포함, PR #507 head). r5 `9760e0a5`도 같은 브랜치에 있다.
- trailer: `1df6a970` 5키(`Agent: claude`·`Handoff`·`Status: implemented`·`Criteria-Met: 1/1`·`Verified-By: pending`) 파싱·허용값 정상. `b9a75f9d`(검증 5키)·`8b259018`(`Handoff: none`·`Status: designed`)도 파싱 정상.
- `[구현자 기입]` r6 7필드 전수 존재(설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX·놓친 잠재 문제·구현 보고·Review Signals). 강제 지점 표는 VP-Δ19-05·03·04의 §10 자리 전부와 `남긴 곳` 열을 담는다.
- 구현 보고의 분모 `9자리`는 술어가 조립 의존성이라 정확하다(§6 재열거 차집합 0). 열린 자리는 다른 술어(운반 값)로만 나온다.
- `8b259018`(handoff 지침) 위생: 비밀·이메일·IP 0. 지침 의미 검증은 round 35 review 자체 책임이다.
- INDEX 비고 갱신분 ≤5줄. 라운드: 이번 FAIL로 7이 된다 — 3 초과라 다음 재구현 전에 handoff-review.

## 13. Finding disposition (r6)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D-0262-8 | 턴 선택 `resolve-turn.ts:228` production merge | VP-Δ19-05 · EP55e · AC54 | **closed** — 인용 K9·K9b red 1 | — |
| **D-0262-9** | 엔진 문서 → 턴 실행 구성 edge 미잠금. `resolve-turn.ts:256-260` runtime config target(`harnessId`·`modelProviderId`)과 상류 매핑 `:231-232`를 바꿔도 `src/main`+`src/shared` 4,909케이스 green(X8·X9·X11·X12). 깨지면 OpenCode 턴의 `prepared.providerSettings`가 비어(probe) 엔진 오버라이드 없이 `local/first`를 요청하고, target 하네스가 바뀌면 다른 하네스 설정 디렉터리를 읽는다(`settings.ts:82-92`) | VP-16 root(AR-02 provider config) · VP-Δ15-02 · D-008 · D-030 · AC40 | **BLOCKING** | I19처럼 production 조립으로 `resolveTurnProvider`를 실행해 턴 `prepared.providerSettings.settings`가 선택 엔진 문서와 같고 형제 문서와 다름을 단언 — X8·X9·X11·X12 red로 닫는다. 같은 edge를 쓰는 `send.ts:658`·`native-history.ts:41`도 같은 함수를 지난다 |
| N-0262-11 | bootstrap ctx의 `runtimeModelCatalog` 주입 edge(`bootstrap.ts:788`)를 지워도 green(X4) — `bootstrap.harness.test`는 catalog 생성 직후 멈춘다 | 0188 runtime catalog | NON_BLOCKING | 기본 배포는 contributions `[]`라 merge ≡ fallback(X7 I19 green). runtime 행 배포의 조립 잠금은 0188 몫 |
| N-0262-1 · 3 · 7 · 8 · 9 · 10 | 기존 | — | 기존 disposition 유지 | — |

## 14. Review Signals (r6)

- r2~r6이 같은 형태다: 지목한 자리는 닫혔고 같은 경로의 인접 자리가 비었다. r6은 구현 보고와 r5 검증이 EP55e `resolve` 자리를 **호출 축 변이 K4**로 닫힌 것으로 셌고, 그 자리의 **운반 값**(target)은 아무도 재지 않았다.
- 관련 지침은 있었다: `docs/handoff/AGENTS.md §공통 V` 운반 값 비퇴화 — "그 항을 지우거나 맞바꿨을 때 관측이 달라지는가". native-history 좌표의 stub `resolve`는 입력을 무시하고, I19는 `model`만 단언한다.
- 구현·검증·review가 같은 에이전트다. 이번 결함은 보고에 없는 축(X8·X9·X11·X12)에서만 나왔다.
- 라운드 7(>3) — 다음 재구현 전 handoff-review 대상.
- 반복 환경 한계: 실제 OpenCode CLI 부재 — R40 직접 oracle(`native-storage.integration`)이 `ORCA_TEST_OPENCODE_EXE` 없이 skip.

## 15. 결론 (r6)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 1(VP-16) · BLOCKED_BY 1(VP-Δ15-02) · VP-Δ19-05·VP-Δ19-03 PASS(r5 FAIL 해소) · PLAN_GAP 0 · 사람 인수 대기 VP21-V·VP-11 시각.
- AC(판정 범위 22): ✅14 · ⚠️8 · ❌0. 운영 gate PASS.
- 다음 단계: handoff-review(라운드 7) → 구현자 r7 — D-0262-9의 X8·X9·X11·X12 red 보고.

## 메타 (r7)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-18 |
| 대상 커밋/range | `1df6a970..6ad2af2b` — r6 검증 `c22160d9` + round 36 review `fd7a66c4`(`Handoff: none`) + r7 구현 `6ad2af2b`(테스트 5파일 + plan·INDEX) |
| 구현 전 plan 기준 | `12c81cfa`(ΔV21) — 이후 규범 행 변경 없음 |
| V mode / 유효 V | V1 + ΔV1~ΔV21 |
| 검증 HEAD | `6ad2af2b` (`origin/ccr-f3743b30-7177zo`, PR #507 → base `codex-opencode-harness`) |
| 라운드 | 7 |
| 상태 | **FAIL** — root PAIR_FAIL 1(VP-16) · BLOCKED_BY 1(VP-Δ15-02) · PLAN_GAP 0 |
| 자기 검증 여부 | **구현·검증·round 36 review가 같은 에이전트다.** 보고에 없는 축 3가지를 넣었다 — q2 술어를 `src/main` 전체로 넓힌 분모 재열거(경로 위 10자리, W1~W11), 보고의 `동치` 판정 반증 probe(A6·D3), coordinator 전달 경로 대조. probe가 D-0262-10을 냈다(§4·§6) |

## 0. 기준선 / plan validity (r7)

- `6ad2af2b`의 `plan.md` hunk는 2개다 — `@@ -11 +11`(메타 `상태`)·`@@ -3508,0 +3509,134`(`[구현자 기입]` r7). Decision·AC·V node/pair·§10 변경 없음 → r6 plan validity 유지.
- `c22160d9`(r6 검증)·`fd7a66c4`(round 36 — skill·`docs/handoff/AGENTS.md`·template·reference)는 plan 규범 행을 건드리지 않는다.
- `app/` 변경은 테스트 5파일이고 production은 0파일이다. `scan-surface.sh fd7a66c..6ad2af2` = "변경된 소스 파일이 없습니다".
- 라운드 7 선행 handoff-review: `fd7a66c4`(round 36 — 변이는 바꾼 항만 잠근다, `운반 항` 열). r7은 그 뒤에 구현됐다.

## 2. 비판적 읽기 (r7) — 새 좌표와 production 조립 루트 대조

| 좌표 | 테스트 조립 | production | 판정 |
|---|---|---|---|
| N1 `app/chat-turn.execution-config.test.ts` | 설정 3서비스 = production factory(`createHarnessSettingsService(root)`·`createHarnessRuntimeConfigService({augmenters: {}})`·`createRuntimeModelCatalog`) · 실제 `registerChatHandlers`→`handleChatSend`→`resolveTurn`→요청 조립→`runTurnWithContinuations` · coordinator만 mock | `bootstrap.ts:556` 같은 factory · `registerChatHandlers({ctx})` | 동등(선택·조립 분기). coordinator는 받은 요청을 그대로 넘긴다(`turn-coordinator.ts:331` `runtime.send(request)`, `post-turn.ts:92·223·271`) — 관측 지점이 adapter 입력과 같다 |
| N1 저장 대화 | `peekRuntime` → 살아 있는 runtime | native 읽기 생략 분기 | 동등(살아 있는 runtime 상태) |
| N1 db fake | 저장 key = `storedProviderKey` 고정 | writer가 `session.updated`·커밋에서 갱신(`writer.ts:186·303·345-347`) | **고정 값이 턴 key와 같아** 저장 key와 턴 key가 갈리는 상태를 만들지 않는다 → §4 probe |
| I19 | 설정 서비스를 production factory로 교체 | `bootstrap.ts:556` | 동등 |
| `adapter.test.ts` 새 케이스 | 실제 SDK + 주입 transport, fake `acquire` | `servers.acquire(config, env, cwd)` | adapter → 서버 edge 직접 관측 |
| `writer.test.ts` 새 케이스 | 실제 `DbQueries`(:memory: + migrations) · `loadSession` | production DB | 동등 |
| `session-runtime.test.ts` 새 케이스 | fake adapter가 `sendMessage(request)` 캡처 | `adapter.sendMessage(this.wrapRequest(req))` | 동등 |

## 4. 적대 증거 재측정 (r7)

범위: `src/main`+`src/shared` 4,917케이스(기준선 7,462 중 해당 범위 — 4,910 pass · 0 fail · 7 skip). 실행기는 변이마다 앵커 1회 출현과 원본 SHA256 복원을 단언했다. 배치마다 종료 후 `git status`가 clean이었다. `infra/loopback-callback.test.ts`의 타임아웃 계열 케이스는 변이와 무관하게 부하 중 단독 red가 났다(N-0262-14) — 판정에서 뺐다.

### 인용 변이 (D-0262-9)

| 변이 | r6 | r7 | 구현 보고 |
|---|---|---|---|
| X8 `resolve-turn.ts:259` target `harnessId` → `'claude'` | green 0/4,909 | **red 6** — N1 5 · I19 1 | 6 일치 |
| X9 `:260` target `modelProviderId` → `''` | green 0/4,909 | **red 6** | 6 일치 |
| X11 `:232` 매핑 `entry.provider ?? entry.key` → `entry.key` | green 0/4,909 | **red 6** | 6 일치 |
| X12 `:231` 매핑 `harnessId` → `'claude'` | green 0/4,909 | **red 6** | 6 일치 |

- 인용 4/4 red → D-0262-9의 인용 변이 축 closed. 같은 이슈가 분모로 지정한 호출처 3곳 중 연속 턴 호출처는 아래 probe로 열려 있다 → D-0262-10.

### 새로 닫은 자리 재측정 (구현 보고 10행)

| 변이 | 자리 | 구현 보고 | 재측정 |
|---|---|---|---|
| A1 · A3 | `resolve-turn.ts:98` providerKey · `:96` sessionId 인자 → `null` | 2 · 1 | **2 · 1** — N1 |
| D1 · D11 | `send.ts:601` `providerSettings` 항 제거 · `turn-context.ts:164` `providerKey: null` | 5 · 5 | **5 · 5** — N1 |
| E3 · E5 · S2 | `writer.ts:186` 커밋 · `:347` 생성 갱신 key → `null` · `session-runtime.ts:850` spread 뒤 `providerSettings: undefined` | 1 · 1 · 1 | **1 · 1 · 1** — `writer.test.ts`·`session-runtime.test.ts` 새 케이스 |
| O1 · O2 · O3 | `adapter.ts:68`·`:111`·`:126` `client(undefined, …)` | 1 · 1 · 1 | **1 · 1 · 1** — `adapter.test.ts` 새 케이스 |

- 10/10 red, 수와 검출 파일이 보고와 일치한다.

### 이전 라운드 red 재실행 — 검출 파일 I19가 바뀜

| 변이 | r6 | r7 | 판정 |
|---|---|---|---|
| J2 `misc.ts:63` `resolve` → `cached` | red 3 | red 3 (M 2 · I19) | 유지 |
| J7 `settings-write.ts:93` 쓰기 하네스 `'claude'` | red 4 | red 4 (M 2 · I19 · settings-write) | 유지 |
| J16 `misc.ts:67` prepare·catalog 앞 throw | red 4 | red 4 (M 2 · I19 · misc.runtime-catalog) | 유지 |
| K1 · K2 · K3 `misc.ts` catalog settings `{}` · target `harnessId: 'claude'` · `modelProviderId: ''` | red 4 · 4 · 4 | red 4 · 4 · 4 (같은 분포) | 유지 |
| K8 `misc.ts:61` 읽기 전용 판정 `true` | red 3 | red 3 | 유지 |
| K10 · X2 `misc.ts:49` `merge([])` · `merge(settings, 'claude')` | red 4 · 4 | red 4 · 4 | 유지 |
| K5 `resolve-turn.ts:275` catalog settings `{}` | red 2 | red 7 (N1 5 · I19 · resolve-turn.runtime-catalog) | 유지(N1 추가) |
| K9 · K9b `resolve-turn.ts:228` merge | red 1 · 1 | red 6 · 6 (N1 5 · I19) | 유지(N1 추가) |
| X1 `resolve-turn.ts:240` 요청 key가 아닌 첫 entry | red 1 | red 6 (N1 5 · I19) | 유지(N1 추가) |

- red → green 0 — 덮개 회귀 없음. K·J·X 문자열은 r5·r6 표의 정의로 다시 만들었다(X1은 "요청 key가 아닌 첫 entry"). 검출 파일이 무변경인 K4·X3·X7은 재실행하지 않았다.
- 배치 하나가 백그라운드 시간 한도로 중단돼 `misc.ts`가 K8 변이 상태로 남았다. `git checkout`으로 되돌려 blob 해시가 `HEAD:app/src/main/app/handlers/misc.ts`와 같음(`496f16c5`)을 확인한 뒤 K8·K10·X1·X2를 다시 돌렸다. 27회 기록 모두 복원 단언이 통과했다.

### 보고에 없는 독립 축

| 축 | 변이 / 방법 | r7 | 판정 |
|---|---|---|---|
| 분모 재열거 | q2 술어(`providerKey\|provider_key`)를 디렉터리 제한 없이 `src/main` 전체로 — 170줄(보고 44 + 126). 126 = 사용량·비용 84 · DB 타입·스키마 19 · `queries.ts` 9 · `settings.ts` 5 · 엔진 CRUD 5 · `provider-key.ts` 2 · 타입 1 · bootstrap 1 | 경로 위 자리 10(아래 W) | 보고 분모 밖 — W 전부 red(N-0262-12) |
| W1 | `settings.ts:89` 문서 경로 `entry.modelProviderId` → `entry.key` | red 11 | 잠김 |
| W2·W3 | `settings.ts:110-111` miss 반환 `providerKey` ← `modelProviderId` · `provider` ← `key` | red 8 · 7 | 잠김 |
| W4 | `:100` hit 반환 `provider` → `harnessId` | red 1(`registry.test`) | 잠김 — production에서는 runtime-config cache가 먼저 응답해 hit 반환은 `sourceRevision`에만 쓰인다 |
| W5 | `:230` 목록 key `providerKeyOf(adapter, provider)` → `(adapter, '')` | red 9 | 잠김 |
| W6 | `runtime-config.ts:167` `settings.resolve(entry)` → `modelProviderId: entry.harnessId` | red 8 | 잠김 |
| W7 | `queries.ts:258` UPDATE → `COALESCE(provider_key, @providerKey)`(커밋 갱신 무시) | red 2 | 잠김 |
| W8 | `queries.ts:129` `getSessionById` SELECT에서 `provider_key` 제거 | red 3 | 잠김 |
| W9 | `queries.ts:103` INSERT `@providerKey` → `NULL` | red 3(`queries.test`·`session.load`) | 잠김 |
| W10 | OpenCode loader `settings.ts:26` `{ settings: parsed }` → `{ settings: {} }` | red 9 | 잠김 |
| W11 | `settings.ts:96-108` cache를 key 하나로 공유 + srcPath·mtime 검사 제거 | red 3 | 잠김 |
| 동치 반증 probe | N1 사본에 1케이스: 기존 대화(저장 key `opencode-local`)에서 `opencode-other`를 골라 보내고, 첫 턴이 채널 연결 전에 끝난 상태로 flush(coordinator mock이라 writer 갱신 없음) | 원본 pass · **A6(`send.ts:653` 연속 턴 입력 providerKey → `null`) red · D3(`:662` → `null`) red** — flush 요청이 `opencode-local`로 실행 | **D-0262-10** — 보고의 `동치`(A6·D3)가 틀렸다 |
| 전달 경로 대조 | coordinator·post-turn이 요청을 다시 만드는가(`turn-coordinator.ts:216-331`, `post-turn.ts:92·223·271`) | 참조 전달 · 재조립은 `continuation.ts` 두 builder뿐(D2·M1·M2 측정) | 표 밖 자리 0 |

- probe의 상태는 production에서 도달한다. `decidePostTurnStep`은 채널이 죽었고 보류 입력이 있으면 flush한다(`features/chat/post-turn.ts:51`). 엔진을 바꾼 턴이 서버 시작 실패·중단으로 `session.updated`(`channel.ts:194-199`) 전에 끝나면 writer는 그 턴 key를 저장하지 않는다(`writer.ts:303·345-347`·`186`). 그 사이 보낸 입력은 busy 예약을 통과한다(같은 선택 key).
- production은 원 턴 key(`getActiveTurn().providerKey`)로 고르므로 결과가 맞다. A6·D3에서는 `:248` 저장 key 폴백이 이전 엔진을 고르고, settings 변경 축으로 respawn해 보류 입력이 사용자가 고르지 않은 엔진으로 실행된다. probe 파일은 worktree(`git worktree add --detach … 6ad2af2`)에만 두었고 삭제했다.

## 6. 강제 지점 재열거 (r7) — 엔진 key·문서 운반

| 자리 | 보고 | 재측정 | 근거 |
|---|---|---|---|
| 행 1 선택 `resolve-turn.ts:226-290` 12자리 | 닫힘 10 · 도달 불가 1 · 동치 1 | 같음 | X8·X9·X11·X12 red 6 · 보고 행 재현(§4) · U5 도달 불가·U7 동치는 코드 대조로 확인(`list(req.adapter.id)` · 두 `defaultProvider` 같은 본문) |
| 행 2 호출처 `resolve-turn.ts:93-99` | 닫힘 | 닫힘 | A1 red 2 · A3 red 1 |
| 행 3 호출처 연속 턴 `send.ts:653-663` | 닫힘(providerKey·sessionId 항 동치) | **열림** | providerKey 항 A6·D3 green 0/4,917 · probe red. sessionId 항(A5)은 명시 key가 있어 동치 유지 |
| 행 4 호출처 native 이력 `native-history.ts:41-47` | 동치 | 동치 | 명시 key와 `:248` 폴백이 같은 행(`getSessionById(sessionId).provider_key`)을 읽는다 — 턴 key가 끼지 않아 행 3의 창이 없다 |
| 행 5~11 | 닫힘 21 · 동치 2 | 같음 | 보고 행 재현 · M2(flush `...input.base` 상속)·E4(`:345-347`이 덮음)·V2(env 항에 같은 config) 동치는 코드 대조로 확인 |
| 보고 분모 밖 10자리(`settings.ts` 5 · `runtime-config.ts:167` · loader · `queries.ts` 3) | — | 닫힘 10 | W1~W11 red |

- 합계: 구현 보고 41자리(닫힘 36 · 동치 4 · 도달 불가 1 · 열림 0) ↔ 재측정 **51자리 — 닫힘 45 · 동치 4 · 도달 불가 1 · 열림 1**.
- 보고의 `열림 0` 근거(q1·q2 미분류 0)는 q2 범위를 디렉터리로 좁힌 검색과 `동치` 판정에 기댔다. 범위 축소분 10자리는 모두 잠겨 있었고, 열린 1자리는 `동치` 칸에서 나왔다.

## 5. V-pair closeout (r7)

| Pair | r7 결과 | 근거 |
|---|---|---|
| **VP-16 AR-02↔IT-02** | **PAIR_FAIL** (root 유지) | path `backend/config → send/history`의 연속 턴 호출처 providerKey 운반이 잠기지 않았다 — A6·D3 green, probe에서 보류 입력이 이전 엔진으로 실행. D-0262-10 |
| VP-Δ15-02 R40↔AT40 | BLOCKED_BY:VP-16 | 연속 턴의 엔진 문서 → native config가 같은 edge를 지난다. 그 밖의 edge(행 9~11 adapter·서버·준비 입력, 프롬프트 모델 `adapter.test.ts:subscribes before sending…`)는 좌표가 있고 재측정 red다 |
| 그 밖의 V1~ΔV21 | r6 판정 유지 · VP21-V·VP-11 시각은 사람 인수 대기 | 검출 파일이 바뀐 변이 13개 red → green 0(§4) |

- root PAIR_FAIL 1(VP-16) · BLOCKED_BY 1(VP-Δ15-02) · PLAN_GAP 0.
- PLAN_GAP 아님: D-0262-9가 분모를 "호출처 3곳을 포함한 `src/main` 전체"로 지정했고 path도 이 edge를 지난다. 구현자는 N1 하네스에 위 probe 형태의 케이스를 더해 닫을 수 있다.

### AT / AC 합계 (r7 판정 범위)

| AC | 결과 |
|---|---|
| AC40 (ΔV15) | ⚠️ — 첫 턴·adapter·서버·대화 기록 edge는 잠겼으나 연속 턴 호출처의 엔진 key 운반 미잠금(D-0262-10) |
| AC54 · AC1·2·3·4·5·6·7·8·9·10·12 · AC20-1·20-2 | ✅ 14 (r6 유지) |
| AC11 · AC20-3 · AC26·27·33·34·48 | ⚠️ 7 — 시각 사람 인수 대기 (r6 유지) |

- 합계: `✅ 14 · ⚠️ 8 · ❌ 0 = 22`(r6과 같은 범위). 나머지 35개는 r5 판정 유지.
- 사본 대조: 구현 보고 `✅1` ↔ trailer `Criteria-Met: 1/1` ↔ INDEX 비고 — 사본끼리 일치하고, 검증 결과와는 AC40에서 갈린다(⚠️).

## 9. 게이트 (r7)

HEAD `6ad2af2b`, 실행 순서 readonly lint → typecheck → Vitest(Node ABI) → scripts → 가드 → build(Electron ABI). 명령은 `app/AGENTS.md`를 따랐고 `npm run lint`(`--fix`) 대신 `eslint --cache=false`를 썼다.

| gate | 관측 |
|---|---|
| readonly ESLint(`--cache=false`, `--fix` 없음) | 1,739파일 error 0 · warning 2(기존 `react-hooks/incompatible-library` 2) |
| typecheck | node·web·test 3구성 exit 0, `error TS` 0 |
| Vitest 전체 | 759파일 7,462케이스 — 7,455 pass · 0 fail · 7 skip |
| `node --test scripts/*.test.mjs` | 142/142 |
| inventory · migrations · test-budgets | generated·prose·links ok · no-copies ok(1,710파일) · 16 real-git suites ok |
| `npm run build` | exit 0 (`[sqlite-abi] electron: rebuilt` · 3 번들) |
| `git diff --check` | 출력 0 |
| 원격 Windows CI | PR #507 check `gate`(head `6ad2af2b`) success |

- 운영 gate PASS. 이번 FAIL은 gate가 아니라 pair 실패다. 각 단계 뒤 `git status` clean(`app/out/`은 ignore).

## 11. Repository operation checks (r7)

- INDEX 0262 행: `(r7 구현 — 검증자 기입)`을 `6ad2af2b`로 채웠다(`git cat-file -t` commit, `origin/ccr-f3743b30-7177zo` 포함, PR #507 head).
- trailer: `6ad2af2b` 7키(`Agent: claude`·`Handoff`·`Status: implemented`·`Criteria-Met: 1/1`·`Verified-By: pending`·attribution 2) 파싱·허용값 정상. `fd7a66c4`(`Handoff: none`·`Status: designed`)·`c22160d9`(검증 5키)도 파싱 정상.
- `[구현자 기입]` r7 7필드 전수 존재. 강제 지점 표는 round 36 7열(`운반 항 · 구별 값 · 관측` 포함)과 `남긴 곳`을 담는다. 분모 검색 q2의 디렉터리 축소는 N-0262-12.
- `fd7a66c4`(handoff 지침) 위생: 이메일·IP·토큰 패턴 0(`git show fd7a66c | grep -E …`, attribution 제외). 지침 의미 검증은 round 36 review 자체 책임이다.
- INDEX 비고 갱신분 ≤5줄. 라운드: 이번 FAIL로 8이 된다 — 3 초과라 다음 재구현 전에 handoff-review.

## 13. Finding disposition (r7)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D-0262-9 | 엔진 문서 → 턴 실행 구성 target·매핑 | VP-16 · AC40 | **closed** — 인용 X8·X9·X11·X12 red 6. 지정 분모의 남은 자리는 D-0262-10 | — |
| **D-0262-10** | 연속 턴 호출처의 엔진 key 운반 미잠금. `send.ts:653`(`providerKey: getActiveTurn().providerKey`)·`:662`(`resolveTurnProvider` 인자)를 `null`로 바꿔도 4,917케이스 green. 보고는 "writer가 같은 턴 key를 먼저 저장"으로 동치 판정했으나, 엔진을 바꾼 턴이 채널 연결 전에 끝나면 저장 key는 이전 엔진이고 보류 입력의 flush가 그 엔진으로 실행된다(probe) | VP-16 root(AR-02 provider config) · VP-Δ15-02 BLOCKED_BY · D-008 · D-030 · AC40 | **BLOCKING** | N1에 기존 대화(저장 key ≠ 고른 key)·첫 턴 후 flush·listen 케이스를 더해 두 요청이 고른 엔진 문서를 싣는지 단언 — A6·D3 red로 닫는다 |
| N-0262-12 | 구현 보고 분모 축소 — q2를 일부 디렉터리로 한정해 `settings.ts`·`runtime-config.ts`·loader·`queries.ts`의 운반 10자리가 분모 밖이었다 | 보고 정확도 | NON_BLOCKING | W1~W11 전부 red라 열린 자리는 없다. 분모 검색은 pair path 소스 전체로 |
| N-0262-13 | 다른 계약의 엔진 설정 운반 좌표 green — 제목 생성 `title-generation.ts:38·71`(0188 D-019) · worktree 이름 `send.ts:307`·`prepare-worktree.ts:112`(0211) · respawn 입력 `respawn-inputs.ts:61-63`·`runtime-entry.ts:60·85`·`chat-turn-continuation.ts:76`(0118/0125 — 같은 엔진 문서 제자리 수정 시 D9 단독으로 respawn 누락) | 0188·0211·0125(상속) | NEXT_HANDOFF | 구현 보고 r7-2~r7-4 변이 결과를 근거로 별도 handoff에서 좌표 보강 |
| N-0262-14 | `infra/loopback-callback.test.ts`의 2케이스(`타임아웃은 LoopbackCancelledError 로 끝난다` · `경로가 다른 요청(favicon 등)은 흘려보내고 계속 기다린다`)가 변이 배치 중 각 3회 단독 red — 변이 파일의 import 그래프 밖 | 테스트 안정성 | NON_BLOCKING | 전체 기준선 실행·CI에서는 pass. 타이머 의존 케이스의 부하 내성 점검 후보 |
| N-0262-1 · 3 · 7 · 8 · 9 · 10 · 11 | 기존 | — | 기존 disposition 유지 | — |

## 14. Review Signals (r7)

- r2~r7이 같은 형태다 — 지목한 자리는 닫혔고 같은 path의 인접 자리가 남았다. r7에서 남은 자리는 보고의 `동치` 칸에서 나왔다: "연속 턴 전에 writer가 같은 key를 저장한다"는 전제를 코드 읽기로만 세웠고, 그 전제가 깨지는 상태(채널 연결 전 종료 + 보류 입력)를 만들지 않았다.
- 관련 지침: `docs/handoff/AGENTS.md §공통 V`는 좌표 없는 자리를 닫힘으로 세지 않게 하지만 `동치`·`도달 불가` 판정의 증거 형식은 정하지 않는다. r6 검증의 X10 `동치`도 r7에서 key 라벨 단언이 생기며 red가 됐다.
- 구현·검증·review가 같은 에이전트다. 이번 결함은 보고에 없는 축(동치 반증 probe)에서만 나왔다.
- 라운드 8(>3) — 다음 재구현 전 handoff-review 대상.
- 반복 환경 한계: 실제 OpenCode CLI 부재(`native-storage.integration` skip) · 부하 중 loopback 타임아웃 플레이크.

## 15. 결론 (r7)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 1(VP-16) · BLOCKED_BY 1(VP-Δ15-02) · PLAN_GAP 0 · 사람 인수 대기 VP21-V·VP-11 시각.
- AC(판정 범위 22): ✅14 · ⚠️8 · ❌0. 운영 gate PASS.
- 다음 단계: handoff-review(라운드 8) → 구현자 r8 — D-0262-10의 A6·D3 red 보고.
