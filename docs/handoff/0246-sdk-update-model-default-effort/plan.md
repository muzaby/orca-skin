# Plan — 0246-sdk-update-model-default-effort

## 메타

| 항목 | 값 |
|---|---|
| slug | `0246-sdk-update-model-default-effort` |
| 작성자 | Claude Code |
| 일자 | 2026-10-01 |
| 매핑 | 사용자 라이브 세션 (`/handoff-plan`) — 브랜치 `claude/sdk-update-model-effort-v7c8lg` |
| 상태 | READY (V1 + ΔV1) |
| V mode | `Delta V` |
| 기준 V | `V1@b035a11` (공유 브랜치에서 확인) |
| 이번 V revision | `ΔV1` — effort 메뉴 기본 수준 태그 문구를 '추천'으로 |
| 유효 V | `V1 + ΔV1` (ΔV1 절의 대체 행 우선) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 동봉 SDK `0.3.267`(CLI 2.1.267)은 Opus 5.5·Sonnet 5.5를 모른다. `opus`·`sonnet` 별칭이 `claude-opus-5`·`claude-sonnet-5`로 해석되고, `claude-opus-5-5`는 모르는 모델로 처리된다(§8 probe). 또 effort는 모든 대화가 `high`로 시작해 모델과 무관하게 전송된다(`chatReducer.ts:483`).
- 완료 후 달라지는 것: SDK `0.3.286`(CLI 2.1.286)으로 `opus`·`sonnet`이 5.5로 해석된다. 모델을 고르면 effort 칩이 그 모델의 기본값으로 바뀌고, effort만 바꿔도 진행 중 세션의 다음 턴부터 적용된다. 기본 로그인 새 대화(기본 모델 `sonnet` = Sonnet 5.5)의 effort는 `high` → `medium`이 된다.
- 성공을 사용자 관점에서 한 문장으로: Opus/Sonnet 5.5를 고르면 effort가 '중간', 커스텀 모델은 '높음'으로 자동 설정되고, 바꾼 effort는 다음 턴에 바로 쓰인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "opus/sonnet 5.5 지원을 위해 claude-agent-sdk를 최신 버전으로 업데이트하라." | 사용자 턴 1 |
| 명시 요구 | "모델별 디폴드 effort 지정 기능을 넣고싶다. 클로드 모델인 경우, 모델별 하드코딩으로 effort를 지정하고, 그외 커스텀 모델은 디폴트로 high로 지정하도록 하라." | 사용자 턴 1 |
| 명시 요구 | "클로드 모델은 opus 5.5의 경우  'opus', '5.5', '5-5' 형태로 모델이름 및 버전을 확인할 수 있다." | 사용자 턴 1 |
| 명시 요구 | 기본값 표 = "Claude Code 기본값" · 버전 없는 별칭 = "번들 CLI 해석 버전으로 간주" · 수동 선택 = "새 모델 기본값으로 재설정" · 라이브 반영 = "포함" | 사용자 턴 2 (질의 4건 응답) |
| 추론 의도 | 표는 Orca가 소유한다 — CLI 기본값에 맡기지 않는다. 게이트웨이 이름(`gw-opus-4.7`)은 CLI가 인식하지 못해 `high`를 보낸다(§8 probe) | "모델별 하드코딩" + probe |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `@anthropic-ai/claude-agent-sdk` 를 `0.3.286`(2026-09-30 npm `latest`)으로 exact pin 한다 | "opus/sonnet 5.5 지원을 위해 … 최신 버전으로 업데이트하라" — Opus 5.5는 CLI 2.1.280, Sonnet 5.5는 2.1.284부터 지원 | 사용자 턴 1 | ACTIVE | — |
| D-002 | Claude 모델 기본 effort = Claude Code 내장값: Opus 5.5·Sonnet 5.5 = `medium`, Opus 4.7 = `xhigh`, 그 외 Claude = `high` | "클로드 모델인 경우, 모델별 하드코딩으로 effort를 지정" + 질의 응답 "Claude Code 기본값" | 사용자 턴 1·2 | ACTIVE | — |
| D-003 | Claude로 식별되지 않는 모델(커스텀)은 `high` | "그외 커스텀 모델은 디폴트로 high로 지정하도록 하라" | 사용자 턴 1 | ACTIVE | — |
| D-004 | Claude 식별은 이름의 계열·버전 토큰으로 한다(`opus` + `5.5`/`5-5`) | "'opus', '5.5', '5-5' 형태로 모델이름 및 버전을 확인할 수 있다" — 0245 D-007과 같은 규칙 | 사용자 턴 1 | ACTIVE | — |
| D-005 | 버전 없는 별칭(`opus`·`sonnet`·`fable`·`haiku`)은 번들 CLI의 Anthropic API 해석 버전으로 본다: Opus 5.5 · Sonnet 5.5 · Fable 5.1 · Haiku 4.5 | 질의 응답 "번들 CLI 해석 버전으로 간주" — Bedrock·Foundry 해석 차이는 수용 | 사용자 턴 2 | ACTIVE | — |
| D-006 | 사용자가 고른 effort는 같은 모델 동안 유지하고, 모델 선택이 바뀌면 새 모델 기본값으로 재설정한다 | 질의 응답 "새 모델 기본값으로 재설정" | 사용자 턴 2 | ACTIVE | — |
| D-007 | effort만 바꿔도 살아 있는 CLI 채널의 다음 턴부터 반영한다 — SDK `applyFlagSettings({ effortLevel })`, 채널 재시작 없이 | 질의 응답 "포함" — 백그라운드 작업 유지 | 사용자 턴 2 | ACTIVE | — |
| D-008 | 기본값은 renderer reducer `SET_MODEL` 이 shared 순수 함수로 정한다. main은 `payload.effort` 를 그대로 전달한다 | 0215 권한 강등(`coercePermissionMode`)과 같은 자리·형태 | 설계자 | ACTIVE | — |
| D-009 | 이름 파서를 `claude-context-policy.ts` 에서 `shared/model-identity.ts` 로 옮겨 effort·컨텍스트 분류가 함께 쓴다 | 같은 규칙(D-004 = 0245 D-007)을 renderer·main 두 레이어가 쓴다 — 복붙 정규식 금지 | 설계자 | ACTIVE | — |
| D-010 | effort 메뉴의 정적 "기본값" 문구를 지우고 현재 모델의 기본 수준에 '기본' 태그를 단다 | `high.desc` "기본값."(`ko.ts:954`)은 Opus 5.5에서 거짓이 된다 | 설계자 | SUPERSEDED | D-014·D-015 |
| D-011 | "모델 선택 변경" = `providerKey` 또는 `modelFamily` 변경. 같은 선택 재지정·어댑터 불일치로 거부된 `SET_MODEL` 은 effort를 바꾸지 않는다 | D-006의 판정 기준 | 설계자 | ACTIVE | — |
| D-012 | 표·별칭 대응을 번들 CLI와 대조하는 opt-in smoke 스크립트를 둔다(루프백 모델 픽스처, 외부 호출 0) | SDK를 올릴 때 하드코딩 표의 드리프트를 기계로 잡는다 | 설계자 | ACTIVE | — |
| D-013 | 비범위: 모델별 지원 수준 제한(메뉴 비활성), Haiku effort 칩 숨김, effort 영속화, 1-shot 보조 경로(제목·worktree 이름)의 effort | 요청 밖이고 CLI가 미지원 수준을 낮춰 실행한다 | 설계자 | ACTIVE | — |
| D-014 | effort 팝업 메뉴에서 현재 모델 기본 수준의 라벨 옆에 '추천'을 표시한다(en 'Recommended' — 설계자). 컴포저 effort 칩은 바꾸지 않는다 | "Effort level 팝업 메뉴에서 기본값에는 옆에 추천 이라고 표시해줘야한다" | 사용자 턴 3 (ΔV1) | ACTIVE | D-010 대체 |
| D-015 | `high` 설명의 정적 "기본값" 문구(ko·en)는 지운다 | 기본값이 모델마다 다르다 — V1 D-010 앞부분 승계 | 설계자 (ΔV1) | ACTIVE | D-010 대체 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-013 (신규 handoff).
- 변경된 결정: 없음.
- ΔV1(구현 전 사용자 결정 변경): D-010 → SUPERSEDED, D-014(사용자 — '추천' 태그)·D-015(설계자 — 정적 문구 제거 승계) 신설. 유효 AC 정정은 아래 ΔV1 절이 정한다.
- 기존 ACTIVE 중 언급되지 않았지만 유지되는 결정: 해당 없음(신규).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001 ↔ AC1·AC2 · D-002 ↔ AC3·AC4 · D-003 ↔ AC4 · D-004 ↔ AC4·AC5 · D-005 ↔ AC2·AC4 · D-006 ↔ AC6·AC7·AC8 · D-007 ↔ AC9·AC10·AC11 · D-008 ↔ AC6·AC9 · D-009 ↔ AC5 · D-010 ↔ AC12 · D-011 ↔ AC7 · D-012 ↔ AC2·AC3·AC11·AC14 · D-013 ↔ §6 비범위(AC 없음).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 5.5 미지원 원인은 번들 CLI 버전이다 | probe: 0.3.267 `opus`→`claude-opus-5`, `claude-opus-5-5` 무지정 → `high`(모르는 모델 취급) · 0.3.286 `opus`→`claude-opus-5-5`, 무지정 → `medium` |
| 이미 기존 코드가 충족하는가 | 부분 — effort 선택·전송은 있다(0020). 모델별 기본값·라이브 반영은 없다 | `chatReducer.ts:483` `high` 고정 · `session-runtime.ts:425-433` pushTurn 인자에 effort 없음 |
| 더 작은 해법이 있는가 | effort를 보내지 않으면 CLI가 모델별 기본값을 쓴다. 그러나 칩에 표시할 값이 없고 게이트웨이 이름은 CLI가 인식하지 못한다 | probe: `gw-opus-4.7` 무지정 → `high`(D-004 규칙으로는 Opus 4.7 = `xhigh`) |
| 선행 자료의 주장을 코드와 대조했는가 | `docs/claude-code-spec.md:413` "기본 high"는 이번 변경 후 틀린다 — 정정 대상. vendor 스냅샷 "TypeScript SDK 기본 high"(`docs/spec/claude/agent-sdk/agent-loop.md:171`)는 실측과 다르다 | SDK는 `options.effort` 가 있을 때만 `--effort` 를 붙인다(`sdk.mjs`) · probe 무지정 Opus 5.5 → `medium` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 0067 "effort 변경은 respawn 경계"(`turn.ts:118`·`claude.ts:749` 주석)를 D-007이 바꾼다 — 사용자 결정. 0245 D-007 파서 위치는 D-009로 옮기되 의미는 유지 | §16 |

- 사용자에게 올릴 결정: 없음(4건 질의 완료 — D-002·D-005·D-006·D-007).
- 코드 조사로 닫은 사실: 라이브 effort 결함 재현 — 실제 `ClaudeAdapter` + 번들 CLI에서 `pushTurn({effort:'low'})` 뒤 2턴 요청이 `high`(0.3.267·0.3.286 둘 다). `applyFlagSettings({effortLevel})` 는 spawn 때의 `effort` 를 다음 턴부터 덮는다(probe: high→low, max→medium).

## 5. 동작 / 사용자 흐름

```text
[모델 선택 — 새 대화 hydration 또는 ModelMenu]
  → 선택(providerKey·modelFamily)이 바뀌었으면 effort = 모델 기본값
  → 칩 = 기본값, 메뉴의 그 수준에 '기본' 태그
[effort 수동 선택] → 칩 = 선택값 (같은 모델 동안 유지)
[전송]
  → 채널 없음/재시작: spawn options.effort = 선택값
  → 살아 있는 채널: 다음 턴 전에 applyFlagSettings({effortLevel}) (값이 바뀐 경우만)
  ↘ 적용 실패 → 그 턴 오류(기존 라이브 setter 실패와 같은 경로) → 다음 전송에서 재시도
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 새 대화 · 기본 로그인(명시 모델 없는 별칭 4종 — 기본 `sonnet`) | hydration `SET_MODEL(sonnet)` → D-005 Sonnet 5.5 → `medium` | 칩 '중간' |
| 모델 변경(예: Opus 5.5 → Fable 5.1) | 선택 변경 → 기본값 재설정 | 칩 '중간' → '높음'(수동값 폐기) |
| 같은 모델 재선택 · 어댑터 불일치 거부 | effort 불변 | 칩 유지 |
| effort 수동 선택(유휴, 채널 생존) | 다음 전송 전 `applyFlagSettings` | 다음 턴부터 새 effort |
| 응답 중(busy) effort 변경 | 상태만 변경. 진행 턴·예약(steer) flush 턴은 원 요청 effort | 다음 사용자 전송부터 새 effort(0119 "선택은 다음 send 부터"와 같음) |
| 세션 다시 열기 | effort `high` → provider 기본 모델 hydration → 기본값 | 칩 = 그 모델 기본값(수동값 미저장 — 기존과 동일) |
| fork/handoff draft | 원 세션 effort 복사, hydration 없음 | 칩 = 원 세션 값 |
| 커스텀/식별 불가 모델 · 모델 미선택 | `high` | 칩 '높음' |
| `applyFlagSettings` 실패 | pushTurn reject → 입력 미전송 · 적용 기록 불변 | 그 턴 오류 표시 · 다음 전송에서 재적용 |

### 파생 UX / 엣지케이스

- Haiku: 칩은 '높음'이지만 CLI는 effort를 보내지 않는다(모델 미지원, probe) — D-013 비범위.
- 미지원 수준(예: Opus 4.6의 `xhigh`): CLI가 지원 최고 수준으로 낮춘다 — 메뉴 제한 없음(D-013).
- Bedrock·Foundry의 버전 없는 별칭: 실제 해석 버전과 기본값이 다를 수 있다(D-005 수용).
- 기본값과 CLI 내장값의 의도된 차이: 게이트웨이 이름(`gw-opus-4.7`)은 Orca가 `xhigh`, CLI 무지정은 `high`.
- 렌더러가 effort를 고른 뒤 카탈로그가 늦게 도착하면 hydration이 기본값으로 덮는다 — 부팅 시 카탈로그를 먼저 읽어 실사용 빈도 낮음(수용).

## 6. 범위 / 비범위

- **범위**: SDK `0.3.286` 업그레이드와 그에 따른 테스트 픽스처 적응 · 이름 파서 shared 이설 · 모델별 기본 effort 규칙(표·별칭·커스텀) · `SET_MODEL` effort 재설정 · effort 메뉴 기본 태그·문구 정정 · 라이브 effort 적용(`pushTurn` → `applyFlagSettings`) · opt-in smoke · 현재 상태 문서 정정.
- **비범위**: D-013 4항목 · 연속 listen 턴의 effort(입력 push 없음) · Engine 설정 화면.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 모델별 지원 수준 메뉴 제한 · Haiku 칩 숨김 | 아니오 — UI 표시만 | 후속 handoff 후보 |
| effort 영속화(세션별/모델별) | 아니오 — 저장 포맷 신설은 그때 결정 | 후속 handoff 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `app/package.json` 이 SDK를 정확히 `0.3.286` 으로 고정하고 lockfile이 같은 버전(플랫폼 패키지 포함)으로 해석된다. 어댑터가 읽는 설치 SDK 버전이 `0.3.286` 이다 | `npm ls @anthropic-ai/claude-agent-sdk` → `0.3.286` · `claude.background.test.ts` 식별 케이스가 `sdkVersion: '0.3.286'` 단언 | `sdkPackageVersion()`(`claude.ts:73-84`) → `background.connection` |
| R-01 | AT-02 / AC2 | 번들 CLI가 별칭을 D-005 버전으로 해석한다: `opus`→Opus 5.5 · `sonnet`→Sonnet 5.5 · `fable`→Fable 5.1 · `haiku`→Haiku 4.5. 그 대응은 `CLAUDE_ALIAS_VERSION` 과 같다 | smoke B: 별칭별 루프백 요청의 `model` 을 `parseClaudeModelName` 으로 읽어 맵과 비교 | SDK `query({model: alias})` → CLI → `/v1/messages` |
| R-02 | AT-03 / AC3 | 기본값 표의 모든 행에서 번들 CLI 내장 기본값(effort 미지정 시 요청값)이 행 값과 같다. Haiku 4.5는 effort를 받지 않는다 | smoke A(표 10행) · smoke D(Haiku 요청에 `output_config.effort` 없음) | `query({model: 정식 ID})` → 요청 `output_config.effort` |
| R-02 | AT-04 / AC4 | `defaultEffortForModel` 이 D-002~D-005대로 답한다 — 아래 §AC4 표 전부 | UT 표 구동(§11) + 변이 M1·M2 | reducer `SET_MODEL` · Composer 메뉴 |
| R-02 | AT-05 / AC5 | Claude 이름 파서는 `parseClaudeModelName` 하나다. `classifyContextModel` 이 위임하고 0245 AC1 표가 그대로 통과하며, `5.5`·`5-5` 형태를 읽는다 | UT(신규 케이스) + 0245 AC1(`claude-context-policy.test.ts`) + 변이 M3·M4가 **두 스위트를 함께** red | `parseClaudeModelName` → `defaultEffortForModel` · `classifyContextModel` → `modelForCli` |
| R-02 | AT-06 / AC6 | 모델 선택이 바뀌면 effort가 그 모델 기본값이 되고 다음 전송 payload가 그 값을 싣는다 | reducer UT + store IT: `setModel(…'claude-opus-5-5','opus')` → `send` → `chatSend` payload `effort:'medium'` · `custom` → `'high'` · 별칭 `opus` → `'medium'` | `Composer` → `chatActions.setModel` → `SET_MODEL` → `send` → `orca:chat:send` |
| R-03 | AT-07 / AC7 | 수동 effort는 같은 선택 재지정과 거부된 `SET_MODEL` 에서 유지되고, 선택이 바뀌면(`providerKey` 또는 `modelFamily`) 새 기본값으로 바뀐다 | reducer UT 4케이스 + 변이 M5·M6 | `SET_MODEL` |
| R-03 | AT-08 / AC8 | fork/handoff draft는 원 세션 effort를 그대로 갖는다 | store IT: effort `max` 세션에서 `startForkDraft` → 활성 draft effort `max` · `startHandoff`(사용자 턴 2회 시드, `chatStore.test.ts:787-803` 형태) → `chatSend` payload `effort:'max'`. draft는 `providerKey`·`modelFamily` 를 복사해 Composer hydration 조건(`Composer.tsx:190-203`)에 걸리지 않는다 — 코드 근거 | `continuityDraftSession`(`chatStore.ts:1265-1283`) · `startHandoff`(`:1335-1357`) |
| R-04 | AT-09 / AC9 | main이 `payload.effort` 를 `TurnRequest.effort` 로 싣고, 살아 있는 채널이면 `SessionRuntime` 이 그 값을 `pushTurn` 에 넘긴다 | IT: send 하네스 `buildTurnRequest` 인자 `effort` · session-runtime fake channel — 첫 send는 spawn, 두 번째 send(`effort:'low'`)가 `pushed[0].effort === 'low'` + 변이 M7 | `send.ts:508` → `runtime.send` → `runAttempt` → `live.pushTurn` |
| R-04 | AT-10 / AC10 | `ClaudeAdapter.pushTurn` 은 `next.effort` 가 정의되고 마지막 적용값(초기 = spawn effort)과 다를 때만 `applyFlagSettings({ effortLevel })` 를 입력 push **전에** 1회 부른다. 실패하면 입력을 push하지 않고 마지막 적용값을 바꾸지 않는다 | IT(SDK mock 호출 로그): 같은 값·`undefined` 0회 · 변경 1회 · 순서 `applyFlagSettings` < push · reject 후 재시도 시 다시 호출 + 변이 M8·M9·M10 | `claude.ts` `pushTurn` |
| R-04 | AT-11 / AC11 | 실제 `ClaudeAdapter` + 번들 CLI에서 spawn effort `high` 채널이 1턴 `high`, `pushTurn(effort:'low')` 후 2턴 `low`, 같은 값 재전송 3턴 `low` 를 보낸다 | smoke C(루프백 요청 `output_config.effort` 순서 `[high, low, low]`) · AS-IS는 `[high, high, …]`(§8 실측) | `sendMessage` → `pushTurn` → `applyFlagSettings` → CLI 요청 |
| R-05 | AT-12 / AC12 | effort 메뉴가 현재 모델 기본 수준에만 '기본' 태그를 단다. `high` 설명은 ko·en 모두 '기본값'을 주장하지 않는다 | render UT: `defaultEffort` `medium`·`xhigh`·`high` 각각 태그 1개·위치 단언(그중 하나는 `effort ≠ defaultEffort`) + 변이 M11 · i18n 패리티 테스트 | `Composer` → `EffortMenu` |
| R-06 | AT-13 / AC13 | 업그레이드 후 lint·typecheck 0 오류, vitest는 업그레이드 전 기준선 대비 새 실패 0 | gate 명령 + 기준선 대조(§19) | 전체 |
| R-06 | AT-14 / AC14 | 새 CLI에서도 0245 실행 문자열 `[1m]` 이 요청 `model` 에서 떨어지고 `context-1m-2025-08-07` 베타가 붙는다(`claude-opus-4-7[1m]`·`gw-opus-4.7[1m]`) | smoke E | `modelForCli` → CLI → 요청 |
| R-06 | AT-15 / AC15 | 현재 상태 문서·주석이 "effort = 모델별 기본값 · 라이브 적용"을 서술하고 "effort는 respawn 경계/기본 high"를 더 말하지 않는다 | EP-09 4자리. 음성: `rg -n "effort/providerSettings" app/src/main/adapters` → 0 · `rg -n "기본 high" docs/claude-code-spec.md` → 0. 양성: `rg -n "applyFlagSettings" docs/arch/backend/runtime-ipc.md` → 1 이상 | 문서 |
| R-01·R-02·R-04 | AT-16 / AC16 | 실제 계정으로 Opus 5.5·Sonnet 5.5 대화가 끝까지 되고, 칩이 Opus/Sonnet 5.5 '중간'·Fable '높음'을 보이며, 대화 중 effort를 바꾼 다음 턴이 오류 없이 진행된다 | 사람 실기(dev 또는 설치본) — 실 API 자격증명 필요 | 앱 실행 |

### AC4 표 (`defaultEffortForModel` 입력 → 기대)

| 입력 | 기대 | 근거 |
|---|---|---|
| `claude-opus-5-5` · `opus-5.5` · `Opus 5.5` · `us.anthropic.claude-opus-5-5-v1:0` · `claude-opus-5-5[1m]` | `medium` | D-002·D-004 |
| `claude-sonnet-5-5` · `sonnet-5.5` | `medium` | D-002 |
| `claude-opus-4-7` · `gw-opus-4.7` | `xhigh` | D-002·D-004 |
| `claude-fable-5-1` · `claude-fable-5` · `claude-opus-5` · `claude-sonnet-5` · `claude-opus-4-8` · `claude-opus-4-6` · `claude-sonnet-4-6` | `high` | D-002 표 행 |
| `opus` · `OPUS` · `opus[1m]` · `sonnet` | `medium` | D-005 |
| `fable` · `haiku` | `high` | D-005 → 표 행(Fable 5.1) / 표 밖(Haiku 4.5) |
| `claude-opus-4-1` · `claude-haiku-4-5` · `claude-mythos-5-1` · `gw-opus`(버전 없음, 별칭 아님) | `high` | 표 밖 Claude |
| `gpt-oss-120b` · `my-gateway-model` · `myopus-5.5` · `null` · `''` | `high` | D-003 |

### AC 검증 주의사항

- 기존 테스트 재사용: `claude-context-policy.test.ts` "0245 AC1" 21행 표·버전 순서 케이스가 존재한다(열람 확인) — 이설 후 회귀로 그대로 쓴다. `claude.effort.test.ts` 1케이스(spawn `options.effort`)는 유지한다. `chatReducer.permission.test.ts:112-117` 초기 `high` 단언은 그대로 참이다(초기값 유지).
- 사람 실기 항목: AC16만 — 실 API 자격증명이 필요하다. 표·별칭·라이브 적용은 smoke(루프백)로 기계 검증한다.
- smoke는 CI에 넣지 않는다(기존 `smoke-background-sdk.mjs` 선례, 240MB CLI spawn). 검증자는 `cd app && node scripts/smoke-effort-sdk.mjs` 로 실행한다.
- N회 기준(AC10): `applyFlagSettings` 를 부르는 프로덕션 호출부는 `claude.ts` `pushTurn` 1곳이다(신설). 관측 지점(SDK mock)이 그 1곳을 모형한다. `pushTurn` 프로덕션 호출부는 `session-runtime.ts:425` 1곳이다(`rg -n "\.pushTurn\(" app/src/main --glob '!*.test.*'` → 1).

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 Opus/Sonnet 5.5 지원(D-001·D-005) | NEW | — |
| R-02 | R | §5 모델별 기본 effort(D-002~D-005) | NEW | — |
| R-03 | R | §5 수동 선택 vs 모델 변경(D-006·D-011) | NEW | — |
| R-04 | R | §5 라이브 effort 적용(D-007) | NEW | — |
| R-05 | R | §5 메뉴 기본 표시(D-010) | NEW | — |
| R-06 | R | §6 업그레이드 무회귀·현재 상태 문서 | NEW | — |
| AT-01..AT-16 | AT | §7 | NEW | — |
| SD-01 | SD | §9 살아 있는 채널의 effort 수명(spawn 값 → 라이브 변경 → 같은 값 무동작) | NEW | — |
| ST-01 | ST | smoke C | NEW | — |
| AR-01 | AR | §10 EP-04 renderer 상태 → `orca:chat:send` payload | NEW | — |
| AR-02 | AR | §10 EP-05 ①② main `TurnRequest` → `SessionRuntime` → `pushTurn` | NEW | — |
| AR-03 | AR | §10 EP-05 ③④⑤ 어댑터 ↔ SDK `applyFlagSettings` | NEW | — |
| AR-04 | AR | §10 EP-06 SDK pin·타입 적응 | NEW | — |
| IT-01..IT-04 | IT | §11 | NEW | — |
| MD-01 | MD | §10 EP-02 `parseClaudeModelName` | NEW | — |
| MD-02 | MD | §10 EP-01·EP-08 `defaultEffortForModel` 표·별칭·상수 | NEW | — |
| MD-03 | MD | §10 EP-03 reducer `SET_MODEL` 재설정 | NEW | — |
| MD-04 | MD | §10 EP-07 `EffortMenu` 기본 태그 | NEW | — |
| UT-01..UT-04 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·AT-02 | REQUIRED | `package.json` pin → 설치 SDK → 번들 CLI → `query({model:alias})` → 요청 `model` | AC1 `npm ls`·식별 테스트 · AC2 smoke B | not selected — 버전·요청 모델을 직접 관측 | EP-06 (6) · EP-08 ② (4) |
| VP-02 | R-02 ↔ AT-03..AT-06 | REQUIRED | `setModel` → `SET_MODEL` → `defaultEffortForModel` → `state.effort` → payload → `options.effort` → 요청 | AC3 smoke A · AC4 UT · AC6 store IT | **required** — 하드코딩 데이터. M1 `opus 5.5` 행 삭제 · M2 `opus 4.7`↔`opus 4.8` 값 맞바꿈. 자리: `shared/model-effort.ts` 표 | EP-01 (2) · EP-04 ①②⑤⑥ (4) · EP-08 ① (10) |
| VP-03 | R-03 ↔ AT-07·AT-08 | REQUIRED | ModelMenu/hydration → `setModel` → `SET_MODEL`(선택 비교) → `effort` | AC7 reducer · AC8 store | **required** — 조건 분기. M5 항상 재설정 · M6 재설정 안 함. 자리: `chatReducer.ts` `SET_MODEL` | EP-03 (1) · EP-04 ③④ (2) |
| VP-04 | R-04 ↔ AT-09..AT-11 | REQUIRED | `send.ts:508` → `runtime.send` → `runAttempt` → `pushTurn({effort})` → `applyFlagSettings` → CLI 요청 | AC11 smoke C 요청 effort 순서 | **required** — 배선. M7 `session-runtime.ts` pushTurn 인자에서 effort 제거 · M8 `claude.ts` `applyFlagSettings` 호출 제거(= AS-IS, 설계 턴에 `[high, high]` 관측) | EP-05 (5) |
| VP-05 | R-05 ↔ AT-12 | REQUIRED | `Composer`(`defaultEffortForModel(modelFamily)`) → `EffortMenu` 태그 | AC12 render | **required** — 형제 슬롯. M11 태그를 `defaultEffort` 대신 `effort`(현재 선택) 자리에 렌더 | EP-07 (5) |
| VP-06 | R-06 ↔ AT-13..AT-15 | REQUIRED | 업그레이드 산출 전체 | AC13 gate 기준선 대조 · AC14 smoke E · AC15 `rg` | not selected — gate·요청 형상·문서를 직접 관측 | EP-06 (6) · EP-09 (4) |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | `ClaudeAdapter.sendMessage(effort:'high')` → 1턴 → `pushTurn(effort:'low')` → 2턴 → `pushTurn(effort:'low')` → 3턴 | smoke C `[high, low, low]` | **required** — M8 적용 시 `[high, high, high]` 로 red(검증 시 재실행) | EP-05 ③④⑤ (3) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | `state.effort` → `chatStore.send`(`:847` 새 대화 · `:979` 기존 세션) → `chatSend` payload | store IT payload `effort` | not selected — payload 직접 관측 | EP-04 ①② (2) |
| VP-09 | AR-02 ↔ IT-02 | REQUIRED | `payload.effort` → `buildTurnRequest` 인자 → `SessionRuntime.runAttempt` → `pushTurn` 인자 | send 하네스 인자 · fake channel `pushed[].effort` | **required** — M7(VP-04와 같은 변이, 이 IT도 red) | EP-04 ⑤ (1) · EP-05 ①② (2) |
| VP-10 | AR-03 ↔ IT-03 | REQUIRED | `pushTurn(next)` → `appliedEffort` 비교 → `handle.applyFlagSettings` → `pushInput` | SDK mock 호출 로그·순서 | **required** — M9 `appliedEffort` 를 await 전에 갱신 · M10 push 뒤에 호출 | EP-05 ③④⑤ (3) |
| VP-11 | AR-04 ↔ IT-04 | REQUIRED | `npm ci` → `@anthropic-ai/claude-agent-sdk/sdk-tools` 타입 → 테스트 픽스처 | typecheck 0 오류 · 식별 테스트 | not selected — 컴파일러·버전 직접 관측 | EP-06 (6) |
| VP-12 | MD-01 ↔ UT-01 | REQUIRED | `parseClaudeModelName` → (`defaultEffortForModel` · `classifyContextModel`) | UT 신규 케이스 + 0245 AC1 표 | **required** — SSOT 단일성. M3 "계열 앞 버전" 분기 제거 · M4 버전 구분자에서 `.` 제거 — 두 스위트가 **함께** red | EP-02 (2) |
| VP-13 | MD-02 ↔ UT-02 | REQUIRED | 입력 문자열 → 별칭 판정 → 파서 → 표 조회 → 상수 | AC4 표 전부 | **required** — M1·M2(VP-02) + M12 `CLAUDE_ALIAS_VERSION.opus` 를 5.0으로 | EP-01 (2) · EP-08 (14) |
| VP-14 | MD-03 ↔ UT-03 | REQUIRED | `SET_MODEL` reducer | AC6·AC7 reducer 케이스 | **required** — M5·M6(VP-03) | EP-03 (1) |
| VP-15 | MD-04 ↔ UT-04 | REQUIRED | `EffortMenu({effort, defaultEffort})` | AC12 render | **required** — M11(VP-05) | EP-07 ① (1) |
| VP-16 | R-01·R-02·R-04 ↔ AT-16 | REQUIRED | 앱 실행 → 실 API | 사람 실기 | not selected — 실기 직접 관측 | 0 — 기계 경로는 VP-01·VP-02·VP-04가 잠근다 |

`§10 강제 지점 전수`의 N은 자리 수다. 변이 M1~M12의 정의·심을 자리는 §10 아래 "등록 변이" 표가 정본이다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/**`·`app/scripts/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| vitest 전체(기준선 대조) | SDK 업그레이드는 전 범위에 닿는다 | 업그레이드 **전** `./node_modules/.bin/vitest run` 결과 기록 → 변경 후 같은 명령 → 새 실패 0 | 기준선에 없던 실패만 blocking |
| smoke | 번들 CLI 대조(AC2·AC3·AC11·AC14) | `cd app && node scripts/smoke-effort-sdk.mjs` → exit 0 | 불일치 1건이라도 blocking |
| 빌드 산출 | SDK 패키지 레이아웃 변화(`core.mjs` 신설) | `cd app && ./node_modules/.bin/electron-vite build` → 성공 · `out/main/index.js` 의 SDK `require` 유지 | 빌드 실패만 blocking |
| 문서 인벤토리 | `docs/**` 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 동일 |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| SDK `0.3.267` exact pin · npm `latest` = `0.3.286`(2026-09-30, `claudeCodeVersion` 2.1.286) | `app/package.json:35` · `npm view @anthropic-ai/claude-agent-sdk version` |
| Opus 5.5 = CLI 2.1.280, Sonnet 5.5 = 2.1.284에서 추가 | Claude Code CHANGELOG(2.1.280 "Added Claude Opus 5.5", 2.1.284 "Added Claude Sonnet 5.5") |
| 업그레이드 export 제거 0 · 추가 12. 타입 오류 3건 — `MonitorInput.persistent` 삭제(테스트 픽스처만) | `sdk.d.ts` export diff · `typecheck:test` → `background.monitor.test.ts(35,41,269)` |
| vitest 실패 1건 — 설치 SDK 버전 literal | `claude.background.test.ts:62` `sdkVersion: '0.3.267'` |
| `MonitorOutput.persistent?` 는 남는다 · 프로덕션의 Monitor `persistent` 참조 0 | `sdk-tools.d.ts` · `rg -n persistent app/src --glob '!*.test.*'` → 9건, 전부 `SessionRuntime` close 정책·주석 |
| 제거된 도구: `TaskOutput`(2.1.277)은 이름 술어로만 쓰이고 `REPL` 참조는 0 | `shared/task-tool.ts:24` · `rg -n "\bREPL\b" app/src --glob '!*.test.*'` → 0 |
| effort 상태: 초기 `high`, `SET_EFFORT` 만 바꾼다 · `SET_MODEL` 은 effort 미변경 | `chatReducer.ts:483` · `:1465-1489` |
| effort 전송: payload 4곳 · main 1곳 · spawn 1곳 | `chatStore.ts:847,979,1279,1357` · `send.ts:508` · `claude.ts:587` |
| 라이브 채널 후속 턴은 model·permissionMode만 setter로 적용 · effort는 "respawn 경계" 주석뿐이고 respawn 판정에 없다 | `claude.ts:746-768` · `turn.ts:118-120` · `respawn-policy.ts:27-38` |
| SDK `Query.applyFlagSettings({effortLevel})` — `EffortLevel \| null`, 스트리밍 입력 모드 전용. 두 버전 모두 존재 | `sdk.d.ts`(0.3.286 `:2949`, 0.3.267 `:2695`) |
| Claude 이름 파서(계열 토큰 + 버전 앞/뒤, 날짜 제외)는 0245가 `claude-context-policy.ts` 에 두었다 | `claude-context-policy.ts:9-58` · 0245 D-007 |
| 0215 권한 강등이 reducer `SET_MODEL` 에서 shared 순수 함수로 정착한다 — 같은 형태를 쓴다 | `chatReducer.ts:1465-1486` · `shared/permission-mode.ts` |
| 기본 카탈로그(별칭 4종)의 기본 모델은 `sonnet` | `model-parser.ts:25` `DEFAULT_FAMILY_ORDER` |
| ModelMenu 기본 태그 형태 `text-[11.5px] text-rust` | `ModelMenu.tsx:70-71` |
| 루프백 모델 픽스처로 실제 CLI를 띄우는 opt-in smoke 선례 | `app/scripts/smoke-background-sdk.mjs:1,82,221-257` |

### 번들 CLI probe (설계 턴 실측 — 루프백 픽스처, effort 미지정)

| 요청 모델 | 0.3.267 요청 `model` / effort | 0.3.286 요청 `model` / effort |
|---|---|---|
| `claude-opus-5-5` | 같음 / `high` | 같음 / `medium` |
| `claude-sonnet-5-5` | 같음 / `high` | 같음 / `medium` |
| `opus` | `claude-opus-5` / `high` | `claude-opus-5-5` / `medium` |
| `sonnet` | `claude-sonnet-5` / `high` | `claude-sonnet-5-5` / `medium` |
| `fable` · `haiku` | `claude-fable-5-1` / `high` · 미측정 | `claude-fable-5-1` / `high` · `claude-haiku-4-5-20251001` / 없음 |
| `claude-opus-4-7` · `claude-opus-4-8` | `xhigh` · 미측정 | `xhigh` · `high` |
| `claude-fable-5`·`claude-opus-5`·`claude-sonnet-5`·`claude-opus-4-6`·`claude-sonnet-4-6`·`claude-mythos-5-1` | 미측정 | 모두 `high` |
| `gw-opus-4.7` · `my-gateway-model` | `high` · 미측정 | `high` · `high` |
| spawn `high` → `applyFlagSettings(low)` · spawn `max` → `applyFlagSettings(medium)` | 미측정 | 1턴 `high` · 2턴 `low` / 1턴 `max` · 2턴 `medium` |
| `ClaudeAdapter` spawn `high` → `pushTurn({effort:'low'})` | 1턴 `high` · 2턴 `high` | 1턴 `high` · 2턴 `high` (AS-IS 결함) |
| `claude-opus-4-7[1m]` · `gw-opus-4.7[1m]` | `[1m]` 제거 + `context-1m-2025-08-07` | 같음 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `SET_MODEL` dispatch | `rg -n "type: 'SET_MODEL'" app/src/renderer --glob '!*.test.*'` | 1 | `chatStore.ts:1549` 하나 — reducer 한 자리로 재설정이 닫힌다 |
| `setModel(` 호출부 | `rg -n "setModel\(" app/src/renderer --glob '!*.test.*'` | 3 | `Composer.tsx:195,202`(hydration) · `:511`(ModelMenu) |
| effort 운반 자리 | `rg -n "effort: (cur\|src)\.effort\|payload\.effort" app/src` | 5 | `chatStore.ts:847,979,1279,1357` · `send.ts:508` (+ spawn `claude.ts:587`) |
| `pushTurn` 프로덕션 호출부 | `rg -n "\.pushTurn\(" app/src/main --glob '!*.test.*'` | 1 | `session-runtime.ts:425` |
| `classifyContextModel` 프로덕션 호출부 | `rg -n "classifyContextModel\(" app/src --glob '!*.test.*'` | 1 | `claude-context-policy.ts:101` |
| `CLAUDE_MODEL_FAMILIES` import | `rg -l CLAUDE_MODEL_FAMILIES app/src --glob '!*.test.*'` | 3 | 정의 · `model-parser.ts` · `claude-context-policy.ts` |
| SDK 버전 literal(관측 주석·픽스처) | `rg -n "0\.3\.267\|2\.1\.267" app/src` | 11 | 실패 1(`claude.background.test.ts:62` — 설치본을 실제로 읽는다) · 나머지 10은 버전을 적은 관측 주석·픽스처 값 — 유지 |

### 수치 / 전칭 표현 검산

- vitest 기준선(이 컨테이너, `0.3.267`): 파일 594 pass · 8 fail · 1 skip(603) / 테스트 5758 pass · 3 skip. 8 fail = electron 바이너리 미설치(`ELECTRON_SKIP_BINARY_DOWNLOAD`) — 환경 기인.
- 같은 환경 `0.3.286` 미적응: 파일 9 fail(+`claude.background.test.ts`) / 테스트 1 fail · typecheck 3 오류. 적응 대상 = 2파일.
- "CLI는 게이트웨이 이름을 인식하지 못한다" — 반례 검색: `us.anthropic.claude-opus-5-5-v1:0` 은 인식(`medium`). 인식 실패는 계열 앞 접두가 `claude-` 형태가 아닐 때(`gw-opus-4.7` → `high`)로 한정해 서술한다.
- 기존 테스트 케이스 존재: `claude-context-policy.test.ts` "0245 AC1" 21행 · `claude.effort.test.ts` 1케이스 · `model-identity.test.ts` 3 describe · `session-runtime.test.ts` `channelLive()`(`:125`) 열람 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-04`
- 현재 책임 소유자: effort = renderer 상태(초기 `high`) · 모델 = `SET_MODEL`(effort 무관) · 라이브 setter = model·permissionMode.
- 현재 entry → flow: `Composer` → `SET_MODEL` / `SET_EFFORT` → `send` payload → `send.ts:508` → spawn `options.effort` → CLI `--effort`. 후속 턴은 `pushTurn` 이 effort를 버린다.
- 현재 오류 경로: 해당 없음 — effort 변경이 조용히 무시된다.

```text
SET_MODEL ─→ providerKey·modelFamily (effort 그대로 'high')
SET_EFFORT ─→ effort ─→ payload ─→ TurnRequest.effort ─┬─ spawn: options.effort ✓
                                                         └─ live:  pushTurn({text,model,permissionMode}) ✗ effort 유실
SDK 0.3.267 ─→ CLI 2.1.267: opus→claude-opus-5 · claude-opus-5-5 = 모르는 모델
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-04`, `MD-01`~`MD-04`
- 변경 후 책임 소유자: 기본값 규칙 = `shared/model-effort.ts` · 이름 파서 = `shared/model-identity.ts` · 재설정 = reducer `SET_MODEL` · 라이브 적용 = `ClaudeAdapter.pushTurn`.
- 변경 후 entry → flow: `SET_MODEL`(선택 변경) → `defaultEffortForModel` → effort → payload → spawn 또는 `pushTurn({effort})` → `applyFlagSettings` → CLI.
- 변경 후 오류 경로: `applyFlagSettings` reject → `pushTurn` reject(입력 미전송) → `SessionRuntime` 기존 catch(`markError`, throw) → 턴 오류 표시.
- 유지: respawn 판정(effort는 경계가 아니다) · spawn `options.effort` · 0245 컨텍스트 분류 의미.

```text
SET_MODEL ─→ selectionChanged? ─→ effort = defaultEffortForModel(modelFamily)
                                     └─ parseClaudeModelName (shared) ←─ classifyContextModel (main, 위임)
SET_EFFORT ─→ effort ─→ payload ─→ TurnRequest.effort ─┬─ spawn: options.effort (appliedEffort 초기값)
                                                         └─ live:  pushTurn({…, effort}) → (≠ applied) applyFlagSettings → push
SDK 0.3.286 ─→ CLI 2.1.286: opus→claude-opus-5-5(medium) · sonnet→claude-sonnet-5-5(medium)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 이름 파서 = `claude-context-policy.ts` | `shared/model-identity.ts` `parseClaudeModelName`, 정책은 위임 | D-009 | MD-01 / VP-12 |
| state/contract | effort 기본 `high` 고정 | `SET_MODEL` 선택 변경 시 모델 기본값 | D-002~D-006 | MD-02·MD-03 / VP-13·VP-14 |
| data/control flow | `pushTurn` 이 effort 미운반 | `TurnContinuation.effort` → `applyFlagSettings` | D-007 | AR-02·AR-03 / VP-09·VP-10 |
| UI | `high.desc` "기본값." 정적 | 모델 기본 수준 '기본' 태그 | D-010 | MD-04 / VP-15 |
| 의존성 | SDK `0.3.267` | `0.3.286` + 픽스처 2파일 적응 | D-001 | AR-04 / VP-11 |
| test seam/관측점 | effort 순수 단위 1케이스 | UT·IT·opt-in smoke(실 CLI) | D-012 | ST-01 / VP-07 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/model-identity.ts` | Claude 계열·버전 파서 | `string` → `ClaudeModelName \| undefined` | `model-effort.ts` · `claude-context-policy.ts` |
| `shared/model-effort.ts`(신규) | 기본 effort 규칙(표·별칭·상수) | `string \| null \| undefined` → `EffortLevel` | `chatReducer.ts` · `Composer.tsx` · smoke |
| renderer `chatReducer` `SET_MODEL` | 선택 변경 시 재설정 | action → state | `chatStore.setModel` |
| renderer `EffortMenu` | 기본 태그 표시 | `effort`·`defaultEffort` → UI | `Composer.tsx` |
| main `SessionRuntime` | 후속 턴 인자 운반 | `TurnRequest.effort` → `TurnContinuation.effort` | chat-turn |
| main `ClaudeAdapter` | 라이브 적용 | `next.effort` → `applyFlagSettings` | `SessionRuntime` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-02 / VP-02·VP-13 | **EP-01** 기본값은 `defaultEffortForModel` 하나로 계산한다 — 자리 ① `chatReducer` `SET_MODEL` ② `Composer` → `EffortMenu.defaultEffort` (2) | `shared/model-effort.ts` | renderer | 모델 선택·렌더 | 칩과 '기본' 태그가 다른 값을 말한다 |
| MD-01 / VP-12 | **EP-02** Claude 계열·버전은 `parseClaudeModelName` 하나로 읽는다 — 자리 ① `defaultEffortForModel` ② `classifyContextModel` (2) | `shared/model-identity.ts` | renderer·main | 호출 시 | effort와 컨텍스트 정책이 같은 이름을 다르게 판정 |
| MD-03 / VP-03·VP-14 | **EP-03** 선택 변경(`providerKey` 또는 `modelFamily`)일 때만 effort 재설정 — 자리 ① `SET_MODEL` (1) | `chatReducer.ts` | reducer | `SET_MODEL` | 수동값이 같은 모델에서 사라지거나 모델 변경 후 남는다 |
| AR-01·AR-02 / VP-08·VP-09 | **EP-04** effort 운반(기존, 코드 불변) — ① `chatStore.ts:847` ② `:979` ③ `:1357` handoff ④ `:1279` draft seed ⑤ `send.ts:508` ⑥ `claude.ts:587` spawn (6) | 각 자리 | renderer·main | 전송·spawn | 기본값이 CLI에 닿지 않는다 |
| AR-02·AR-03 / VP-04·VP-07·VP-09·VP-10 | **EP-05** 라이브 적용 — ① `TurnContinuation.effort?: EffortLevel` ② `session-runtime.ts` `pushTurn` 인자 ③ `claude.ts` `appliedEffort` 초기값 = spawn `effort` ④ 값이 다를 때만 push **전** `applyFlagSettings` ⑤ 성공 후에만 `appliedEffort` 갱신 (5) | `turn.ts` · `session-runtime.ts` · `claude.ts` | main | 살아 있는 채널의 후속 턴 | effort 변경이 조용히 무시되거나 실패 후 재시도되지 않는다 |
| AR-04 / VP-01·VP-11 | **EP-06** SDK `0.3.286` — ① `package.json` exact ② `package-lock.json`(npm 생성) ③ `claude.background.test.ts:62` 버전 ④⑤⑥ `background.monitor.test.ts:35,41,269` `persistent` 제거 (6) | `app/package.json` | 구현자 | 설치·typecheck | 5.5 미지원 CLI가 남거나 게이트 red |
| MD-04 / VP-05·VP-15 | **EP-07** 메뉴 기본 표시 — ① `EffortMenu` 태그 ② ko `high.desc` ③ en `high.desc` ④ ko `effort.defaultTag` ⑤ en `effort.defaultTag` (5) | `EffortMenu.tsx` · i18n | renderer | 렌더 | 거짓 '기본값' 문구 · 태그 위치 오류 |
| MD-02 / VP-01·VP-02·VP-13 | **EP-08** 하드코딩 데이터 ↔ 번들 CLI — ① 표 10행 ② `CLAUDE_ALIAS_VERSION` 4항 (14) | `shared/model-effort.ts` | smoke | SDK 버전 변경 시 | 표가 CLI 내장값·별칭 해석과 갈라진다 |
| R-06 / VP-06 | **EP-09** 현재 상태 서술 — ① `docs/claude-code-spec.md:413` ② `docs/arch/backend/runtime-ipc.md` §1.3 ③ `turn.ts:118-119` 주석 ④ `claude.ts:746-750` 주석 (4) | 문서 | 구현자 | 커밋 | 문서가 "effort = respawn 경계/기본 high"를 계속 말한다 |

### 등록 변이 (선택 적대 증거 정본)

| ID | 심을 자리 | 결함 | red여야 하는 증거 |
|---|---|---|---|
| M1 | `shared/model-effort.ts` 표 | `opus 5.5` 행 삭제 | UT-02 `claude-opus-5-5`·`opus` → `medium` 케이스 |
| M2 | 같은 표 | `opus 4.7`(xhigh) ↔ `opus 4.8`(high) 값 맞바꿈 | UT-02 두 행 · smoke A 두 행 |
| M3 | `shared/model-identity.ts` 파서 | "계열 앞 버전" 분기(`claude-3-5-sonnet`) 제거 | UT-01 신규 케이스 **and** 0245 AC1 버전 순서 케이스 |
| M4 | 같은 파서 | 버전 구분자에서 `.` 제거 | UT-01 `opus-5.5` **and** 0245 AC1 `gw-opus-4.7` |
| M5 | `chatReducer.ts` `SET_MODEL` | 선택 비교 없이 항상 재설정 | UT-03 "같은 선택 재지정 시 수동값 유지" |
| M6 | 같은 자리 | 재설정 안 함 | UT-03 "선택 변경 시 기본값" · store IT payload |
| M7 | `session-runtime.ts` `pushTurn` 인자 | `effort` 제거 | IT-02 fake channel · smoke C |
| M8 | `claude.ts` `pushTurn` | `applyFlagSettings` 호출 제거(= AS-IS) | IT-03 · smoke C(`[high, high, high]`) |
| M9 | 같은 자리 | `appliedEffort` 를 await 전에 갱신 | IT-03 "reject 후 같은 값 재시도 시 다시 호출" |
| M10 | 같은 자리 | `applyFlagSettings` 를 push 뒤에 호출 | IT-03 호출 순서 |
| M11 | `EffortMenu.tsx` | 태그를 `effort`(현재 선택) 자리에 렌더 | UT-04 `effort ≠ defaultEffort` 케이스 |
| M12 | `shared/model-effort.ts` 별칭 맵 | `opus` 를 5.0으로 | UT-02 `opus` → `medium` · smoke B |

- 같은 규칙의 SSOT와 공유 방법: 이름 파서 = `shared/model-identity.ts`(D-009), 기본값 = `shared/model-effort.ts`. renderer·main·smoke 모두 import한다. 정규식 사본 0의 관측은 음성·양성 짝이다 — 이설 후 `rg -n "new RegExp" app/src/main/adapters/claude-context-policy.ts` → 0, `rg -n "parseClaudeModelName\(" app/src --glob '!*.test.*'` → 정의 외 2(EP-02 두 자리).
- `실패 의미`에 "다른 게이트가 막는다"를 적었는가: 해당 없음.
- 선택적 필드의 의미: `TurnContinuation.effort` `undefined` = 이번 턴 effort 지정 없음 → 적용하지 않는다(listen·구형 요청). `SendChatMessage.effort` 생략 = CLI 내장 기본값(기존 의미 유지).
- 외부 SDK 경계: `applyFlagSettings` 인자 `{ effortLevel: EffortLevel | null }` — `null` 은 "모델 기본값으로 리셋"이라 이번 설계는 `null` 을 보내지 않는다. Orca `EffortLevel`(`shared/ipc.ts:303`)과 SDK `EffortLevel` 은 같은 5종 union이다 — 캐스팅 없이 대입한다(`as` 금지).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/package.json` · `app/package-lock.json` | SDK pin | `npm install @anthropic-ai/claude-agent-sdk@0.3.286 --save-exact` — 손편집 금지 | `npm ls` |
| `app/src/main/app/chat-turn/background.monitor.test.ts` | 타입 적응 | `MonitorInput` 의 `persistent` 제거(`:35,41,269`). `MonitorOutput.persistent` 단언은 유지 · 1행 주석 버전 갱신 | typecheck |
| `app/src/main/adapters/claude.background.test.ts` | 설치 SDK 식별 | `sdkVersion: '0.3.286'`(`:62`) · 픽스처 CLI 버전 `2.1.286`(`:54,63`) | vitest |
| `app/src/shared/model-identity.ts` | 파서 SSOT | `CLAUDE_NAME_FAMILIES = [...CLAUDE_MODEL_FAMILIES, 'mythos']` · `parseClaudeModelName(model): { family; version?: { major; minor } } \| undefined` — `claude-context-policy.ts:9-46` 로직 이설(`[1m]` 제거·소문자·날짜 제외 그대로) | UT-01 |
| `app/src/shared/model-identity.test.ts` | UT-01 | `claude-opus-5-5`·`opus-5.5`·`Opus 5.5`·`us.anthropic.claude-opus-5-5-v1:0`·`claude-opus-5-5[1m]` → opus 5.5 · `claude-3-5-sonnet` → sonnet 3.5(계열 앞 버전, M3) · `claude-opus-4-20250514` → opus 4.0(날짜 제외) · `opus` → 버전 없음 · `myopus-5.5`·`gpt-5.5` → `undefined` | 순수 |
| `app/src/main/adapters/claude-context-policy.ts` | 위임 | `FAMILY`·버전 정규식 삭제, `classifyContextModel` 이 파서 결과를 `{family, major, minor}` 로 펼친다 — 출력 불변 | 0245 AC1 |
| `app/src/shared/model-effort.ts` (신규) | 기본값 규칙 | 아래 "규칙" 그대로 | UT-02 |
| `app/src/shared/model-effort.test.ts` (신규) | UT-02 | §AC4 표 전부 + 표 위생(행 중복 0 · 별칭 4항이 `CLAUDE_MODEL_FAMILIES` 와 일치) | 순수 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 재설정 | `SET_MODEL`: 어댑터 불일치 거부 뒤 `selectionChanged = action.providerKey !== state.providerKey \|\| action.modelFamily !== state.modelFamily` → `effort: selectionChanged ? defaultEffortForModel(action.modelFamily) : state.effort` | UT-03 |
| `…/reducer/chatReducer.effort.test.ts` (신규) | UT-03 | 초기→Opus 5.5 `medium` · 수동 `max` + 같은 선택 → `max` · 수동 `max` + Fable 5.1 → `high` · provider만 변경 → 기본값 · 어댑터 불일치 거부 → 불변 · `custom` → `high` · LOAD_SESSION 뒤 hydration → 기본값 | 순수 |
| `…/store/chatStore.effort.test.ts` (신규) | IT-01 | `installChatStoreHarness` → `setModel` → `send` → `chatSend` payload `effort` (새 대화·기존 세션 두 자리) · `startForkDraft` draft effort 유지 · `startHandoff` payload effort 유지 | 하네스 |
| `…/components/Composer.tsx` | 입력 | `defaultEffort={defaultEffortForModel(modelFamily)}` 를 `EffortMenu` 에 전달 | — |
| `…/components/composer/EffortMenu.tsx` | 기본 태그 | prop `defaultEffort: EffortLevel` · `level === defaultEffort` 행에 `tr('chat.composer.effort.defaultTag')` 를 ModelMenu와 같은 형태(`shrink-0 text-[11.5px] text-rust`)로 | UT-04 |
| `…/composer/effortMenu.render.test.ts` (신규) | UT-04 | `renderToStaticMarkup` — 3모델 태그 1개·위치 · `effort ≠ defaultEffort` 케이스 | 순수 |
| `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts` | 문구 | `effort.defaultTag` = '기본' / 'default' · `high.desc` 에서 '기본값. ' / 'Default. ' 제거 | `resources.test.ts` |
| `app/src/main/adapters/turn.ts` | 계약 | `TurnContinuation.effort?: EffortLevel` · `:118-119` 주석에서 effort를 spawn-바인딩 목록에서 빼고 라이브 적용으로 정정 | typecheck |
| `app/src/main/features/sessions/session-runtime.ts` | 운반 | `pushTurn` 인자에 `...(req.effort !== undefined ? { effort: req.effort } : {})` | IT-02 |
| `…/sessions/session-runtime.test.ts` | IT-02 | `channelLive().pushed` 에 `effort` 기록 · 두 번째 send `effort:'low'` → `pushed[0].effort === 'low'` | fake channel |
| `app/src/main/app/chat-turn/send.effort.test.ts` (신규 — 또는 `send.permission-mode.test.ts` 에 케이스 추가) | IT-02 | 같은 하네스 — `payload.effort:'medium'` → `buildTurnRequest` 둘째 인자 `effort === 'medium'` · effort 생략 → 키 없음 | 하네스 |
| `app/src/main/adapters/claude.ts` | 라이브 적용 | `sendMessage` 클로저 `let appliedEffort = effort` · `pushTurn` 의 setter 뒤·push 전: `if (next.effort !== undefined && next.effort !== appliedEffort) { await handle.applyFlagSettings({ effortLevel: next.effort }); appliedEffort = next.effort }` · `:746-750` 주석 정정 | IT-03 |
| `app/src/main/adapters/claude.effort.test.ts` | IT-03 | mock에 `applyFlagSettings` · 호출 로그(순서) · 같은 값/`undefined`/변경/reject 재시도 | SDK mock |
| `app/scripts/smoke-effort-sdk.mjs` (신규) | ST·AT | 아래 "smoke" 그대로 | opt-in |
| `docs/claude-code-spec.md` | 현재 상태 | `:413` "기본 high" → 모델별 기본값(0246)·라이브 적용 | `rg` |
| `docs/arch/backend/runtime-ipc.md` | 현재 상태 | §1.3에 "effort 라이브 적용(0246): `pushTurn` → `applyFlagSettings`, respawn 경계 아님" 1항 | `rg` |

### `shared/model-effort.ts` 규칙

```text
CLAUDE_MODEL_DEFAULT_EFFORT (Claude Code 2.1.286 내장값 — code.claude.com/docs/en/model-config, §8 probe):
  fable 5.1 high · fable 5.0 high · opus 5.5 medium · sonnet 5.5 medium · opus 5.0 high
  sonnet 5.0 high · opus 4.8 high · opus 4.7 xhigh · opus 4.6 high · sonnet 4.6 high
CLAUDE_ALIAS_VERSION (번들 CLI의 Anthropic API 해석): opus 5.5 · sonnet 5.5 · fable 5.1 · haiku 4.5
CLAUDE_UNLISTED_EFFORT = 'high'   // Claude로 식별됐지만 표 밖(버전 없음·미등재 버전)
CUSTOM_MODEL_EFFORT    = 'high'   // D-003 — 위와 값이 같아도 상수를 나눈다(한쪽 변경이 다른 쪽을 끌지 않게)

defaultEffortForModel(model):
  name = model?.replace(/\[1m\]/gi, '').trim() ; 비면 → CUSTOM_MODEL_EFFORT
  parsed = parseClaudeModelName(name) ; 없으면 → CUSTOM_MODEL_EFFORT
  version = parsed.version ?? (name 소문자가 CLAUDE_ALIAS_VERSION 키와 정확히 같으면 그 버전)
  version 없음 → CLAUDE_UNLISTED_EFFORT
  표에서 (family, major, minor) 일치 행 → 그 effort, 없으면 CLAUDE_UNLISTED_EFFORT
```

- 표 행 타입은 `{ family: ClaudeNameFamily; major: number; minor: number; effort: EffortLevel }` 의 `readonly` 배열 — `minor` 생략 형태를 허용하지 않는다(`claude-opus-5` 는 `minor: 0`).
- 별칭 맵 키 타입 = `(typeof CLAUDE_MODEL_FAMILIES)[number]` — 4항 누락은 컴파일 오류.

### smoke (`app/scripts/smoke-effort-sdk.mjs`)

- 형태: `smoke-background-sdk.mjs` 와 같다 — `node:http` 루프백 모델 픽스처(`/v1/messages` 요청 본문·`anthropic-beta` 헤더 기록, 스트리밍/비스트리밍 최소 응답) · vite `ssrLoadModule` 로 `/src/shared/model-effort.ts`·`/src/shared/model-identity.ts`·`/src/main/adapters/claude.ts` 로드 · env `HOME`=임시 폴더, `ANTHROPIC_BASE_URL`=루프백, `ANTHROPIC_API_KEY`=`local-fixture`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`.
- A: 표 행마다 정식 ID(`claude-<family>-<major>[-<minor>]`, `minor` 0이면 생략) · effort 미지정 `query` → 요청 effort = 행 값.
- B: 별칭 4종 · effort 미지정 → `parseClaudeModelName(요청 model).version` = 맵 값.
- C: `new ClaudeAdapter().sendMessage({ model:'claude-opus-5-5', effort:'high', … })` → result 뒤 `pushTurn({text, effort:'low'})` → result 뒤 `pushTurn({text, effort:'low'})` → 요청 effort 순서 `[high, low, low]`.
- D: `claude-haiku-4-5` effort `high` 지정 → 요청에 `output_config.effort` 없음.
- E: `claude-opus-4-7[1m]`·`gw-opus-4.7[1m]` → 요청 `model` 에 `[1m]` 없음 · `anthropic-beta` 에 `context-1m-2025-08-07`.
- 출력: 케이스별 JSON 1줄 · 불일치 1건이라도 exit 1. 외부 모델 호출 0. 실행 시간은 CLI spawn 약 17회.

### 테스트 가능성

- electron/DB/native 의존부와 분리할 순수 파일: `shared/model-identity.ts`·`shared/model-effort.ts`(런타임 의존 0) · `EffortMenu` 는 `renderToStaticMarkup`(`modelMenu0215.render.test.ts` 선례).
- 기존 메커니즘 재사용: 0215 `SET_MODEL` 강등 자리 · `installChatStoreHarness` · `send.permission-mode.test.ts` 하네스 · `session-runtime.test.ts` `channelLive()` · `smoke-background-sdk.mjs` 루프백 — 모두 형상·시점이 맞는다(같은 액션·같은 경계).
- 순서 관측: IT-03 SDK mock이 `applyFlagSettings`·`input.push` 호출을 한 로그 배열에 적는다. 입력 push는 `createSessionInputStream` mock 또는 `handle` 이터레이터가 받은 메시지로 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
카탈로그(main toAgentEnvironment) → Composer hydration/ModelMenu → SET_MODEL → defaultEffortForModel
  → state.effort → EffortMenu(칩·태그) / send payload → main TurnRequest → spawn options.effort | pushTurn → applyFlagSettings
  → CLI 요청 output_config.effort
```

- producer 기준: 모델 선택 식별자(`modelFamily` = `model.model ?? alias` + `[1m]`, 0215 D-007).
- consumer 파생 규칙: 칩 = `state.effort` · 태그 = `defaultEffortForModel(modelFamily)` — 둘 다 같은 함수에서 나오며 칩이 태그를 우회하지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: main은 effort를 다시 계산하지 않는다(D-008).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 0215 권한 강등(`SET_MODEL`) | 같은 case에 effort 한 줄 추가 — 강등 로직 불변 | 기존 `chatStore.modelPermission.test.ts` · AC7 |
| 0119 `turnProviderKey` 스냅샷 | `SET_MODEL` 이 스냅샷을 건드리지 않는 계약 불변 | 기존 `chatReducer.model.test.ts` |
| 0245 컨텍스트 분류 | 파서 이설 — 출력 불변 | AC5 · AC14 |
| 0231 백그라운드 lane 식별 | 설치 SDK 버전 literal 갱신 | AC1 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `appliedEffort` 는 채널(어댑터 `sendMessage` 클로저)마다 spawn effort로 시작한다.
- 취소/중단: 해당 없음 — 적용은 턴 시작 전 1회.
- 종료/respawn: 새 채널이 새 `appliedEffort` 를 갖는다. respawn spawn은 `req.effort` 를 `options.effort` 로 쓴다(기존).
- retry/timeout/partial failure: `applyFlagSettings` reject → 입력 미전송·`appliedEffort` 불변 → 다음 `pushTurn` 이 다시 적용한다.
- **다중 저장소 쓰기**: 해당 없음(영속 저장 없음). 상태 사본 두 곳(renderer `state.effort` · CLI 세션 effort)은 실패 시 일시적으로 다르다 — 그 턴은 오류로 끝나 다음 전송이 맞춘다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 사용자 턴당 control 요청 최대 1회(effort가 바뀐 턴만) — 바뀌지 않으면 0회.
- 프롬프트 캐시: effort 변경은 메시지 캐시를 무효화할 수 있다(Claude API 문서) — 사용자가 바꾼 턴에 한정.
- smoke: CLI spawn 약 17회 — CI 밖.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 해당 없음 — 배포 포트·IPC 채널·DB 스키마 불변. `SendChatMessage.effort` 형상 불변.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0020 effort per-turn 전달 · "기본 high" | `docs/claude-code-spec.md:413` | §10 EP-09 ① | 변경 — 사용자 결정 D-002·D-003 |
| 0067 "effort 변경은 respawn 경계" | `turn.ts:118` · `claude.ts:749` 주석 | §9 TO-BE · §11 | 변경 — 사용자 결정 D-007 |
| 0245 D-007 이름·버전 추출 규칙 | `docs/handoff/0245-…/plan.md:48` | §11 파서 이설 | 유지(의미) · 위치만 변경 D-009 |
| 0245 D-006 "CLI 2.1.267과 같은 분류" | 같은 plan `:47` | AC14 | 유지 — 2.1.286 요청 형상 동일(§8 probe) |
| 0215 D-007 선택 식별자 = SDK 모델 문자열 | `shared/model-identity.ts:16-27` | §12 producer | 유지 |
| 0215 D-009 `SET_MODEL` 에서 모델 종속 상태 정착 | `chatReducer.ts:1468-1486` | §11 reducer | 유지(같은 자리 확장) |
| 0119 "선택은 다음 사용자 send 부터" | `runtime-ipc.md` §1.3 | §5 busy 행 | 유지 |
| 0215 D-028 번들 CLI 단일 출처 | `claude-executable.ts:1-13` | D-001 | 유지 — 바이너리 이름·패키지 레이아웃 동일(`sdk.mjs` 해석 로직) |
| 의존성 정책(TRD 표 밖 신규 패키지 승인) | `app/AGENTS.md` §의존성 정책 | D-001 | 유지 — 기존 의존성 버전 갱신, 사용자 명시 요청 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 기본 로그인 새 대화 effort가 `high` → `medium` 으로 내려간다 | 사용자 결정(D-002·D-005) — §1에 명시. 칩으로 바로 보인다 |
| 다음 SDK 업그레이드에서 CLI 기본값·별칭이 바뀌어 표가 드리프트 | smoke A·B(D-012) — 업그레이드 gate로 실행 |
| `applyFlagSettings` 가 ultracode를 끈다(SDK 문서) | Orca는 ultracode를 쓰지 않는다(`rg -n ultracode app/src` → 0) |
| Bedrock·Foundry 별칭 해석 차이 | D-005 수용 · Part I §5 명시 |
| 게이트웨이 이름에서 Orca 기본값과 CLI 무지정값이 다르다 | 의도된 차이(D-004) — Orca가 effort를 명시 전송한다 |

- 되돌리기 어려운 결정: 없음 — 저장 포맷·공개 계약 불변. SDK 버전은 lockfile로 되돌릴 수 있다.
- 신규 의존성: 없음(기존 SDK 버전 갱신).

## 18. 영향 받는 파일 / 문서

- `app/package.json` · `app/package-lock.json`
- `app/src/shared/model-identity.ts`(+test) · `app/src/shared/model-effort.ts`(신규, +test)
- `app/src/main/adapters/claude-context-policy.ts` · `claude.ts` · `turn.ts` · `claude.effort.test.ts` · `claude.background.test.ts`
- `app/src/main/features/sessions/session-runtime.ts`(+test) · `app/src/main/app/chat-turn/send.effort.test.ts`(신규) · `background.monitor.test.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `chatReducer.effort.test.ts`(신규) · `store/chatStore.effort.test.ts`(신규) · `components/Composer.tsx` · `composer/EffortMenu.tsx` · `composer/effortMenu.render.test.ts`(신규)
- `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts`
- `app/scripts/smoke-effort-sdk.mjs`(신규)
- `docs/claude-code-spec.md` · `docs/arch/backend/runtime-ipc.md` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(shared는 shared만 import) · `app/src/renderer/AGENTS.md`(시맨틱 토큰).
- ABI/네트워크 등 환경 제약: `npm test` 는 ABI를 Node로 뒤집는다 — 전체 vitest는 `./node_modules/.bin/vitest run` 으로 돌리고 기준선과 대조한다. electron 바이너리 미설치 환경의 `Electron failed to install correctly` 8파일은 환경 기인으로 분리한다.
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/shared src/renderer/src/features/chat src/main/adapters src/main/features/sessions src/main/app/chat-turn` + 전체 기준선 대조.
- smoke: `node scripts/smoke-effort-sdk.mjs`(플랫폼 바이너리 설치 필요, 루프백만).
- 사람 실기: AC16.

## READY self-review

- [x] Decision Ledger가 결정을 보존한다 — 사용자 D-001~D-007(턴 1 원문 3건 + 질의 응답 4건), 설계자 D-008~D-013.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1 "기본 로그인 새 대화 high → medium" 명시.
- [x] 조건절·이유절을 재해석하지 않았다 — "'opus', '5.5', '5-5' 형태"를 D-004 원문 인용, "그외 커스텀 모델은 디폴트로 high"를 D-003 원문 인용.
- [x] 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태 표 9행 ↔ AC2·AC6·AC7·AC8·AC9~AC11·AC4 · §11 파일 표.
- [x] AS-IS와 TO-BE가 같은 축으로 있다 — §9 다이어그램 2개·Delta 6축.
- [x] AS-IS→TO-BE Delta 각 행이 파일·AC에 연결된다 — Delta "V / 구현·검증 연결" 칸.
- [x] AS-IS에서 사라진 책임: `claude-context-policy.ts` 의 파서 → shared로 **이동**(D-009), 정책은 위임으로 유지.
- [x] 수치·전칭 표현·외부 규약·앵커·기존 테스트를 실측했다 — §8 probe 표 · 전수 7행 · vitest 기준선 수치 · 0245 plan `:47-48` 앵커.
- [x] 각 AC가 행동 단언·검증 수단·도달 경로를 가진다 — §7 16행.
- [x] Baseline V를 썼다 — 상속 V 없음.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R 6 · SD 1 · AR 4 · MD 4 → VP-01~VP-16.
- [x] INHERITED node 없음 — `REGRESSION`·`NOT_REQUIRED` 해당 없음. 0245 계약 보존은 R-06/AC14로 NEW 노드에 귀속.
- [x] 각 pair가 경로·§10 자리 수·직접 oracle을 갖고, 적대 증거는 데이터·분기·배선·SSOT·형제 슬롯 pair만 선택(M1~M12, 자리 명시).
- [x] 현재 변경의 운영 gate 6행 · 관련 없는 기존 실패(electron 8파일)를 blocking으로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC16만(실 API).
- [x] semantic 목표를 structural proxy만으로 검증하지 않는다 — 라이브 적용은 호출 로그(IT)에 더해 실제 CLI 요청 effort(smoke C)로 관측.
- [x] "X가 쓰인다" 불변식의 장치가 X 삭제에 반응한다 — M7·M8(배선 삭제 → smoke C·IT red), M3·M4(파서 SSOT 삭제·변형 → 두 스위트 red). 자리 불변식(태그 위치)은 형제 맞바꿈 M11.
- [x] 정책 파라미터 단위·범위 — effort 5종 union, 표 행은 `minor` 필수(불가능 조합 차단), 별칭 맵은 키 타입으로 4항 강제.
- [x] 참조 구현 coverage — smoke 선례(`smoke-background-sdk.mjs`)의 픽스처 응답 형태(스트리밍/비스트리밍)를 그대로 쓴다.
- [x] 신규 모듈마다 레이어·강제 지점·seam — §9 책임 분리 · §10 EP-01~EP-09 · §11.
- [x] producer/consumer 양쪽 — §12.
- [x] 상한·총량 — §14 control 요청 턴당 ≤1.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다 — `npm test` 대신 `vitest run`, lint·typecheck 기본.
- [x] 본문 완성 후 `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙 — 판정 먼저, 관측 인용, 같은 사실을 Part I/II에 중복하지 않음(probe 수치는 §8에만).

## ΔV1 — effort 메뉴 기본 수준 표시를 '추천'으로

READY. 구현 전 사용자 결정 변경이다. V1의 '기본' 태그(D-010)를 사용자가 지정한 '추천'으로 바꾼다. 유효 범위는 V1 + 이 절이며, V1 §5·§7 AC12·AC16·§10 EP-07·§11(`EffortMenu`·i18n·render 테스트 행)의 태그 서술은 이 절이 대체한다.

### 근거와 결정 승계

| 사용자 문장 · 발견 | 관측 | 정정 |
|---|---|---|
| "Effort level 팝업 메뉴에서 기본값에는 옆에 추천 이라고 표시해줘야한다" | V1은 같은 자리에 '기본' 태그(D-010)를 설계했다 — 구현 전(앱 코드 변경 0) | D-010 → D-014(태그 문구 '추천') · D-015(정적 '기본값' 문구 제거 승계) |
| 표시 위치 | 사용자 문장은 팝업 메뉴를 지정한다. 컴포저 effort 칩(`Composer.tsx:412-419`)은 현재 effort 라벨만 보인다 | 칩 불변 |
| 영문 카탈로그 | ko/en 리프 키 패리티를 컴파일(`en.ts` `typeof ko`)과 `resources.test.ts` 가 강제한다 | en = 'Recommended'(설계자) |

- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-014 ↔ AC12′·AC16′ · D-015 ↔ AC12′ · 그 밖 ACTIVE 결정은 V1 대조 그대로(D-010만 SUPERSEDED).
- 폐기 근거: 없음 — V1 AC12의 증거(태그 1개·위치·M11)는 AC12′로 이관한다.

### AC 정정

| AC | 대체 관계 | 행동 · oracle | production path |
|---|---|---|---|
| AC12′ | V1 AC12 대체 | effort 메뉴는 현재 모델 기본 수준 행에만 라벨 옆 '추천'(en 'Recommended')을 단다. `high` 설명은 ko·en 모두 '기본값'을 주장하지 않는다. render UT: `defaultEffort` `medium`·`xhigh`·`high` 각각 '추천' 1개·그 행 위치 단언(그중 하나는 `effort ≠ defaultEffort`) + 변이 M11 · i18n 패리티 테스트 | `Composer` → `EffortMenu` |
| AC16′ | V1 AC16 대체 | V1 AC16 + effort 메뉴를 열면 현재 모델 기본 수준 옆에 '추천'이 보인다(Opus 5.5 → '중간' 행, Fable → '높음' 행) | 앱 실행 |
| 나머지 | 승계 | V1 AC1~AC11·AC13~AC15 그대로 | V1 |

유효 AC는 V1 AC1~AC11·AC13~AC15 + AC12′·AC16′의 16행이다. 사람 실기는 AC16′, 나머지는 기계 검증한다.

### Delta V 와 강제 지점

| Node | provenance | 변경 / 승계 |
|---|---|---|
| R-05 | CHANGED | 메뉴 기본 표시 = '추천' 태그(D-014) + 정적 문구 제거(D-015) |
| AT-12 · AT-16 | CHANGED | AC12′ · AC16′ |
| MD-04 · UT-04 | CHANGED | `EffortMenu` 태그 문구 키 `chat.composer.effort.recommendedTag` |
| 그 밖 V1 node | INHERITED | `V1@b035a11` 그대로 — 구현 전이므로 V1 REQUIRED pair는 모두 유효 |

| Pair | V1 대체 관계 / requiredness | path · 직접 oracle | 강제 지점 / 선택 적대 증거 |
|---|---|---|---|
| VP-05 | V1 VP-05 대체 / REQUIRED (R-05 ↔ AT-12) | `Composer`(`defaultEffortForModel(modelFamily)`) → `EffortMenu` 태그, AC12′ | EP-07′ (5) · **required** — M11 승계(태그를 `effort` 자리에 렌더) |
| VP-15 | V1 VP-15 대체 / REQUIRED (MD-04 ↔ UT-04) | `EffortMenu({effort, defaultEffort})`, AC12′ render | EP-07′ ① (1) · **required** — M11 승계 |
| VP-16 | V1 VP-16 대체 / REQUIRED (R-01·R-02·R-04·R-05 ↔ AT-16) | 앱 실행 → 실 API · 메뉴 표시, AC16′ | 0 — 실기. 기계 경로는 VP-01·VP-02·VP-04·VP-05가 잠근다 |
| VP-01~VP-04 · VP-06~VP-14 | 승계 / REQUIRED | V1 그대로 | V1 그대로 |

| EP | V1 대체 관계 | 자리 · 강제 의미 |
|---|---|---|
| EP-07′ | V1 EP-07 대체 | ① `EffortMenu` 가 `level === defaultEffort` 행에 `tr('chat.composer.effort.recommendedTag')` ② ko `high.desc` 정적 '기본값' 제거 ③ en `high.desc` 'Default.' 제거 ④ ko `effort.recommendedTag` = '추천' ⑤ en `effort.recommendedTag` = 'Recommended' (5) |

### 기술 보완

- V1 §11의 `EffortMenu.tsx`·i18n·`effortMenu.render.test.ts` 행은 키 `effort.defaultTag`·문구 '기본'/'default' 대신 키 `effort.recommendedTag`·문구 '추천'/'Recommended' 로 읽는다. 태그 형태(ModelMenu와 같은 `shrink-0 text-[11.5px] text-rust`)와 위치 규칙(`level === defaultEffort`)은 V1 그대로다.
- 컴포저 effort 칩은 바꾸지 않는다(D-014) — 칩 라벨은 V1과 같이 `EFFORT_LABEL_KEYS[effort]` 다.
- 운영 gate: V1 그대로.
- **READY 검산**: CHANGED node(R-05·AT-12·AT-16·MD-04·UT-04)는 모두 REQUIRED pair(VP-05·VP-15·VP-16)를 갖는다. 다른 상위 동작에 닿지 않는다 — 바뀌는 것은 태그 문구 키와 값뿐이고 `defaultEffort` 계산·칩 라벨은 불변이다. V1 M11은 VP-05·VP-15로 승계했고 폐기한 변이는 0이다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
