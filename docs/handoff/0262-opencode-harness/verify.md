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
