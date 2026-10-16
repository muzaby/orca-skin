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
| N-0262-5 | `docs/arch/backend/provider-runtime.md:130,154,457,474,478`이 OpenCode permission·응답·mapper·adapter를 여전히 "미구현"으로 서술 — 현재 코드와 모순(0260 drift 재점검에서 발견, 표식은 0260 유지 행이라 도구가 통과시킴) | `docs/AGENTS.md` arch는 현재 상태만 | NON_BLOCKING | 문서 정정 |

## 9. Review Signals — 사실만

- 라운드 1에서 verify 없이 impl 턴이 r1~r1.20으로 이어졌다. 그중 사용자 요구 변경이 아닌 결함/gate 보완 턴: r1.2(dev 부팅 복구)·r1.3(무응답 복구)·r1.10(공급자 오류·문구)·r1.15의 CI 후속(`5b7a64c3`) — `docs/handoff/AGENTS.md §라운드`의 "verify 없는 impl 턴 3 초과" 조건에 해당하므로 다음 재구현 전에 `handoff-review`를 수행해야 한다.
- 같은 CUA 의존 패턴이 0263 ΔV3~ΔV5에도 있다(0263 G-0263-1).
- 반복 환경 한계: Electron 바이너리 부재·CLI fixture `PWD` 상속.

## 10. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 1(G-0262-1) + BLOCKING 1(D-0262-1). 다음 주체는 설계자.
- pair: ΔV20 4 PASS · 표본 델타 PASS · G-0262-1 영향 pair 미닫힘 · PAIR_FAIL 0.
- 운영 gate: 로컬 PASS, PR CI red는 0265 귀속.
- 다음 단계: `handoff-review`(라운드 내 impl 턴 초과) → 설계자 Delta V 정정 → 구현자 D-0262-1 → 재검증. 사람 몫: AC11 실공급자·시각 인수.
