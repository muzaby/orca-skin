# Plan — 0188 providers 슬라이스 분리 (경량화 Phase A)

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0188-providers-slice-split` |
| 작성자 | Claude Code |
| 일자 | 2026-08-14 |
| 매핑 | 「인증·Harness·Plugin 경량화 리팩터링 제안」 **Phase A** |
| 후속 | [`0189-auth-runtime-inversion`](../0189-auth-runtime-inversion/plan.md)(Phase B) · [`0190-provider-compat-teardown`](../0190-provider-compat-teardown/plan.md)(Phase C) |
| 구현 주체 | **Claude** (비기능 리팩터링 — root `AGENTS.md` 협업 워크플로우) |
| 상태 | DRAFT → **READY** |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: `app/src/main/features/providers/` 한 디렉터리(56 파일 · 10,426 줄)에 네 책임이
  섞여 있다 — ⓐ 인증 lifecycle ⓑ Harness + ModelProvider 설정·모델 해석 ⓒ Confluence Plugin 기능
  ⓓ 그 셋을 한 facade 로 묶는 `ProviderPlatform`. 같은 `provider` 라는 이름이 *ModelProvider 설정*과
  *인증 대상*을 동시에 가리켜, 읽는 사람이 매번 셋을 구분해야 한다.
- **완료 후 달라지는 것**: 네 책임이 물리적으로 다른 디렉터리에 있고, 각 디렉터리가 자기
  `eslint-plugin-boundaries` 슬라이스가 된다. **관측 가능한 동작·성능·UI·IPC·DB 는 하나도 바뀌지
  않는다.**
- **성공을 사용자 관점에서 한 문장으로**: *사용자는 아무 차이도 느끼지 못하고, 다음 두 단계(소비
  방향 역전·호환층 제거)가 계약을 깨지 않고 진행될 물리 경계가 생긴다.*

이 핸드오프는 **뼈대만 옮긴다.** 계약 형상 변경·`AuthRuntime` 신설·동적 runtime config·카탈로그
view 분리는 전부 0189/0190 소관이다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 「인증·Harness·Plugin 경량화 리팩터링 제안」을 **분석·검토하고 문서를 작성**하라 | 2026-08-14 라이브 세션 (제안서 업로드) |
| 명시 요구 | 3단계 중 Phase A 를 이 핸드오프로 가른다 | 라이브 세션 결정 (D-001) |
| 명시 요구 | 검증 대기 6건은 완료로 취급, 착수 의존 없음 | 라이브 세션 결정 (D-002) |
| 명시 요구 | 용어·ADR 을 같은 범위에서 supersede | 라이브 세션 결정 (D-003) |
| 명시 요구 (리뷰) | transitional ownership 명시 · Usage 정본 전환 금지 · 새 seam 금지 · AC 교정 | 라이브 세션 리뷰 피드백 (D-004~D-006) |
| 추론 의도 | 제안서 Phase A 서술("이동 단계에서 실행 로직을 재작성하지 않는다")을 **검증 가능한 계약**으로 승격 — diff 가 rename+import 로 수렴해야 verify 가 "순수 이동" 을 기계 판정할 수 있다 | 설계자 해석 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 제안서를 **0188/0189/0190 3분할**. 0188 = Phase A | AC 약 40건 > SKILL 의 25건 임계. 각 단계가 독립 green 커밋이라는 제안서 요구와 1:1 | 사용자 턴 | ACTIVE | — |
| D-002 | INDEX 의 검증 대기 6건(0178·0180·0181·0182·0183·0187)은 완료로 취급 | 사용자 명시 "모두 완료됐다. 무시하라" | 사용자 턴 | ACTIVE | — |
| D-003 | 용어(Harness/ModelProvider/Auth/Plugin)와 ADR-004 를 **같은 범위에서 supersede** — ADR-006 신설 + GLOSSARY/arch/guide 갱신 | `docs/AGENTS.md` 가 채택 결정 변경에 사용자 확인을 요구 → 승인됨. **실행은 0190** | 사용자 턴 | ACTIVE | — |
| D-004 | Phase A 이동표는 **최종 소유 / 임시 compat / 무변경 보존** 세 유형을 구분한다 | `platform.ts` 가 `./gate` 와 `./auth/*` 를 동시에 import → 교차 feature 금지로 어느 슬라이스에도 못 들어간다 | 사용자 리뷰 | ACTIVE | — |
| D-005 | `registerUsageJobs.providerKeys` 의 **정본을 0188 에서 바꾸지 않는다** | 선언 집합 → settings entry 집합은 이동이 아니라 *사용량 대상 집합의 의미 변경*. 기본 빌드에 fetcher 가 없다는 사실이 변경을 정당화하지 않는다 | 사용자 리뷰 | ACTIVE | — |
| D-006 | Phase A 는 **새 production seam 을 만들지 않는다** | 순서 검증을 위해 seam 을 넣으면 "실행 로직 재작성 금지" 와 충돌 | 사용자 리뷰 | ACTIVE | — |
| D-007 | `contracts/provider.ts` 는 Phase A 에서 **파일도 심볼도 그대로** 둔다 | `Provider.llm`/`tools` 슬롯을 안은 채 `auth.ts` 가 되면 이름이 내용과 어긋나고 0189 가 같은 파일을 다시 만진다 | 설계자 (D-004 파생) | ACTIVE | — |
| D-008 | exported contract type 개명(`Provider`·`ProviderApi`·`ProviderKind`) 금지. symbol rename 은 **`renderClaudePluginPackage` → `renderClaudeHarnessPlugin` 1건만** 허용 | 제안서는 `builtInHarnessPluginRoot` 도 예시했으나 **대응 심볼이 실재하지 않는다**(실측: `orcaPluginRoot`·`userClaudePluginRoot`) — 없는 심볼을 만들지 않는다 | 제안서 + 사용자 리뷰 + 실측 | ACTIVE | — |
| D-009 | `AuthId` = 기존 `Provider.id` 그대로 승계, vault key prefix `provider:<id>:<authKind>` 유지 | vault 네임스페이스이자 `${BINDING:<id>}` 참조 대상 — 바꾸면 저장된 grant 를 못 읽는다 | 제안서 §보안 불변식 · ADR-004 invariant | ACTIVE | — |
| D-010 | 신규 DB migration 0. shared `ProviderKind`·`ProviderInfo`·`ProviderPlatformState`·`AgentEnvironment` 와 IPC schema/channel 은 compatibility boundary 로 유지 | 이번 변경은 책임 재배치이며 데이터 의미·wire 를 바꾸지 않는다 | 제안서 §금지 표 | ACTIVE | — |
| D-011 | 런타임 동적 TypeScript/JavaScript 로딩을 추가하지 않는다. `app/deployment/` 는 build-time code | ADR-004 invariant 승계 | 제안서 §보안 불변식 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-011 (신규 핸드오프).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 유지되는 결정: ADR-004 의 invariant 5종 중 **`Provider.id` 유지 · vault 키 형식 ·
  게이트 선언 0 → 통과 · 미인증 `null`/드롭 · 런타임 동적 로딩 금지**는 이번 범위에서 전부
  유지된다. ADR-004 가 **바뀌는 부분**(`kind` 1급 축, 배포 수정 파일은 `declarations/` 뿐)은
  0190 이 ADR-006 으로 supersede 한다 — 0188 은 둘 다 건드리지 않는다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당** | 문제는 파일 수가 아니라 *한 디렉터리·한 계약에 네 책임이 교차*하는 것이다. ADR-004 가 같은 실패("축의 교차")를 이미 한 번 진단했고, 이번 진단은 그 위에 얹힌 두 번째 교차(인증 ↔ Harness 설정)를 가리킨다 |
| 이미 기존 코드가 충족하는가 | **부분적으로 — 3건은 이미 충족** | 아래 ⓐ |
| 더 작은 해법이 있는가 / 이동은 제거가 아니다 | **이번 단계는 명시적으로 "이동"이다** | 제거(계약 축소)는 0189/0190 이 한다. 0188 을 "제거" 로 포장하지 않는다 — 0183 r1 이 *이동을 제거로 보고*했다가 FAIL 한 선례가 있다 |
| 선행 자료(제안서)의 주장을 코드와 대조했는가 | **대조했고 5건 정정** | 아래 ⓐ·ⓑ·ⓒ |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **ADR-004 와 부분 충돌 — 단 0188 범위에서는 충돌 없음** | 갱신 메모 참조 |

### ⓐ 제안서가 "신설" 로 쓰지만 **이미 충족된** 것 — 보존 AC 로 다룬다 (3건)

| 제안서 서술 | 실제 | 이번 처리 |
|---|---|---|
| "Gate 는 `status==='valid'` 만 보지 않고 `verified===true` 까지 요구한다" | 이미 그렇다 — `gate/index.ts:63` 이 `m.status === 'valid' && m.verified`, `verified` 는 `auth/store.ts:48` 의 **비영속** Set | AC11 (보존) |
| "Runtime Tool 은 한 번만 만들고 동일 인스턴스를 재사용한다" | 이미 그렇다 — `service/index.ts:34` 의 `built` Map 이 handler identity 안정을 위해 캐시한다 | AC10·AC13 (보존) |
| "같은 turn 의 title generation 과 chat 이 같은 snapshot 을 쓴다" | 이미 그렇다 — `turn-context.ts:104-107` 이 `titleSettings`/`titleEnv` 를 turn 과 같은 객체로 고정 | 0189 범위 (여기서는 무변경) |

세 건 모두 **신설로 적으면 구현자가 있는 것을 다시 만든다.** AS-IS 로 명시한다.

### ⓑ 제안서 이동표의 소유권 공백 (D-004 의 근거)

제안서는 `platform.ts` → `features/auth/runtime.ts` + `app/connection-views.ts` 로 적지만 그것은
**0189 의 최종 형태**다. Phase A 는 계약을 바꾸지 않으므로 `ProviderPlatform` 이 그대로 살아
있어야 하고, 그것은 `./gate` 와 `./auth/{login,registry,store}` 를 **동시에** 문다
(`platform.ts:14-18`) → 교차 feature 금지(`eslint.config.mjs:161-164`)로 두 슬라이스 어디에도 못
들어간다. 같은 이유가 generic `ServiceToolRegistrar`(`service/index.ts:32`)와 `llm/index.ts` 에도
적용된다. → §11 이동표가 세 유형을 구분한다.

### ⓒ Phase A 에서 의미를 바꾸면 안 되는 것 (D-005)

`bootstrap.ts:437-445` 의 `providerKeys: () => providers.declarations('llm').map(llmProviderKey)…`
는 "**LLM Provider 선언에 등록된 것**" 이라는 집합이다. 이를 settings entry 열거로 바꾸면 사용량
대상 집합의 정본이 달라진다. 기본 빌드에서 `usageFetcher === undefined`(`bootstrap.ts:408`)라
외부 관측이 없다는 사실은 변경을 정당화하지 않는다 — 폐쇄망 concrete 배포에서는 결과가 갈린다.
0188 은 배선을 그대로 유지하고, 전환은 0189/0190 의 명시적 계약 변경으로 기록한다.

`app/settings-reactions.ts` 도 "이동 누락" 이 아니다 — **이미 `app/` 에 있는**
feature-neutral composition reaction 이다(`settings-reactions.ts:1-13`). 0188 은 손대지 않고,
`ProviderPlatform` 이 사라지는 0189/0190 의 **필수 재배선 대상**으로만 기록한다.

### ⓓ 검증 가능성의 구조적 제약

기본 빌드의 Auth 선언이 **0개**다(`declarations/sso.ts:68`·`llm.ts:61`·`service.ts:49` 가 전부
`= []`). 따라서 "gate·카탈로그 UI flow 가 변경 전과 같다" 류를 **사람 실기로 확인할 수 없다** —
화면에 행이 하나도 없다. 0181 AC13·0183 AC15 가 정확히 이 이유로 미충족으로 남았다. → 상태
동등성은 **합성 배포 fixture + 순수 테스트**(AC13)로 내리고, 사람 실기(AC14)는 실제로 관측
가능한 것만 남긴다.

- **사용자에게 올릴 결정**: 없음 (D-001~D-006 으로 이미 닫힘).
- **코드 조사로 닫은 사실**: §8.

## 5. 동작 / 사용자 흐름

이 작업은 UI 변경이 없다. 관측 주체는 **① 앱 사용자 ② 폐쇄망 배포 구현자 ③ 다음 단계 구현자**다.

```text
[앱 기동]
  → 게이트 판정(선언 0 → 통과 / DEV alwaysRequired → 로그인 화면)
  → 카탈로그·모델 선택·턴 실행·사용량
  → **변경 전과 완전히 동일한 결과**

[배포 구현자가 선언을 채운다]
  → 고치는 파일이 `features/providers/declarations/` 에서 `app/deployment/` 로 이동
  → 배열 이름(GATE_PROVIDERS·LLM_PROVIDERS·SERVICE_PROVIDERS)과 필드는 그대로
  → 절차 문서 갱신은 0190 (0188 은 경로 주석만 정정)

[다음 단계 구현자]
  → `app/provider-compat/` 3파일이 0189/0190 삭제 대상임을 위치와 주석으로 안다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 소비자에게 보이는 결과 |
|---|---|---|
| 기본 빌드 기동 (선언 0) | `evaluateGate` → `required:false, passed:true` | 로그인 없이 열린다 (변경 전과 동일) |
| DEV 기동 (선언 0) | `alwaysRequired` → `required:true, passed:false` | 로그인 화면 + 디버그 우회 토글 (동일) |
| gate Auth 로그인 성공 | `LoginService.resume`/`settleGrant` → `sweepPlugins` → `onChange` 1회 | 상태 push 1회 + tool sync (동일) |
| 401/403 | `markExpired` → `onChange` | Plugin tool 회수 + 상태 갱신 (동일) |
| settings 파일 외부 편집 | 다음 `resolve` 의 mtime 검사 | 다음 턴에 새 settings (동일) |

### 파생 UX / 엣지케이스

- loading / empty / error: 전부 변경 없음. renderer 코드는 **한 줄도 건드리지 않는다**
  (`src/renderer/src/features/providers/` 는 *renderer 슬라이스*로, main 의 동명 디렉터리와 다른
  것이다 — 이번 이동 대상이 아니다).
- concurrency: `sweepPlugins` 의 병렬 probe 와 전체 방송 상한 `1 + K` 를 그대로 유지한다.
- 폐쇄망: 배포가 고치는 파일 경로가 바뀌므로 §11 이동표를 0190 문서 갱신의 입력으로 남긴다.

## 6. 범위 / 비범위

- **범위**: §11 이동표의 ①최종 소유 · ②임시 compat 배치, import path 전환, 테스트 동반 이동,
  D-008 이 허용하는 symbol rename 1건, 이동으로 필요해진 주석 경로 정정,
  `docs/generated/inventory.md` 재생성.
- **비범위** (전부 0189/0190):
  - `contracts/provider.ts` → `contracts/auth.ts` 개명 및 `Provider.llm`/`tools` 제거 (D-007)
  - `AuthRuntime`·`BoundAuth`·`AuthSecretReader` 신설, `materialize()` 제거
  - `HarnessRuntimeConfigService`·`RuntimeConfigAugmenter`·generation fence·single-flight·
    `runtimeConfigFingerprint`·continuation 재resolve
  - `ConnectionViewSource` 카탈로그 view 조립 분리, `registerConnectionHandlers`
  - Usage `providerKeys` 정본 전환 (D-005)
  - ADR-006 신설 및 GLOSSARY/arch/guide 재작성 (D-003)
  - `features/providers/` 디렉터리의 **최종** 삭제 확인은 0188 이 하되, 그 뒤 남는 compat 3파일
    제거는 0190

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `contracts/provider.ts` 개명 | 아니오 — 계약이 실제로 바뀌는 턴에 한 번에 하는 편이 싸다 | 0189 |
| `AuthId` 값 자체 | **예 — vault 네임스페이스·`${BINDING:}` 참조** | **지금 확정**: 기존 `Provider.id` 를 무조건 승계 (D-009) |
| IPC 채널·DTO 형상 | **예 — preload/renderer 계약** | **지금 확정**: 무변경 (D-010) |
| 배포가 고치는 파일 위치 | **예 — 폐쇄망 배포 절차 문서의 진입점** | **지금 확정**: `app/deployment/` (§11 ①) |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | `app/src/main/features/providers/` 가 더 이상 존재하지 않는다 | `test -d` 실패 + `rg "features/providers" app/src` = 0 (술어는 **라이브 코드 `app/src` 로 한정** — `docs/handoff/**`·`docs/archive/**` 의 이력 서술은 제외한다. P30 함정 회피) | 모든 main 소비자가 새 경로를 쓴다 |
| AC2 | 최종 소유 슬라이스 4종(`auth`·`gate`·`harnesses`·`plugins`)이 생기고, 임시 compat 은 `app/provider-compat/` 3파일에만 있다 | 디렉터리 존재 + `rg "provider-compat" app/src/main` 의 import 가 `app/` 안에서만 발생 | eslint boundaries 가 위치를 강제 |
| AC3 | `app/provider-compat/` 각 파일이 머리 주석에 **0189/0190 삭제 대상임 + 현재 소비자**를 명시한다 | 세 파일 각각에 `0189` 또는 `0190` 문자열과 소비자 파일명이 존재 | 다음 단계 구현자가 위치만 보고도 임시임을 안다 |
| AC4 | `npm run lint` — boundaries 위반 0 · `import/no-cycle` 0 | ESLint exit 0, error 0 (warn 1 = 0102 베이스라인) | CI 게이트 |
| AC5 | `npm run typecheck` 3/3 통과 | exit 0 | CI 게이트 |
| AC6 | **착수 전 존재하던 테스트가 삭제·skip 되지 않고 전부 계속 통과하고, 신규 red 가 0이다** | ⓐ `git diff --stat` 에서 기존 test 파일 삭제 0 · `rg "\.skip\(\|\.todo\(" ` 증가 0 ⓑ 이동 전 baseline(파일 수·통과 수)을 착수 시 실측해 기록하고 이동 후 `passed ≥ baseline` ⓒ 실패 파일 집합이 착수 전 DB ABI 5파일과 동일. **숫자만으로는 "3개 삭제 + 5개 추가"를 못 잡으므로 ⓐ 를 함께 둔다** | 회귀 안전망이 이동 중 소실되지 않음 |
| AC7 | IPC 채널 76 · 도메인 22 무변경 | `ipc-documentation.test.ts` (코드 ↔ `docs/generated/inventory.md` 양방향 대조) | preload/renderer 계약 |
| AC8 | `misc-split.test.ts` 의 25채널 등록 집합 무변경 | 해당 스위트 green | 핸들러 등록 |
| AC9 | DB migration diff 0 | `node scripts/check-migrations-appendonly.mjs` + `git diff --stat -- src/main/infra/db/migrations` = 0 파일 | 사용자 디스크의 기존 세션 |
| AC10 | `runtimeToolFullName(providerToolServerId(providerId), toolName)` 의 결과가 이동 전후 동일하다 | 순수 단위 테스트 — 같은 `providerId`/`toolName` 에서 `mcp__<id>-tools__<tool>` 문자열 동일. (`providerToolServerId` 는 `<id>-tools` 까지만 만들고 완전 이름은 `runtimeToolFullName`(`adapters/runtime-tool-policy.ts:6-8`)과 결합해 생긴다) | 모델이 보는 도구 이름 + GUI `ProviderInfo.tools` |
| AC11 | **`evaluateGate` 진리표 전체**가 새 경로에서 그대로 성립한다 — ⓐ prod·선언 0 → 통과 ⓑ DEV `alwaysRequired`·선언 0 → 차단 ⓒ `bypass` → 통과(`bypassed:true`) ⓓ 전원 `valid`+`verified` → 통과 ⓔ **일부만 `valid`+`verified` → 차단** ⓕ **복원돼 `valid` 지만 이번 실행에서 `verified:false` → 차단** | 기존 `gate/gate.test.ts` 를 새 경로로 옮겨 **케이스를 줄이지 않고** 전부 통과. 대표 4행으로 축소해 기존 보장 범위를 좁히지 않는다 | 앱 진입 게이트 |
| AC12 | 부팅 순서가 보존된다 — `createProviderPlatform`(초기 `serviceTools.sync` 포함) → `registerProviderHandlers` → `void providers.resume()` → `attachTokenSource` → DB init, 그리고 `providerSettings` 생성 → scaffold → extension deploy → `invalidateAll()` | **새 seam 을 만들지 않는다**(D-006). `git diff` 에서 `bootstrap.ts` 의 해당 statement 들이 **import 경로만 바뀌고 순서·위치가 변하지 않았음**을 확인 + 기존 `boot-report`/`settings-reactions` characterization 유지 | renderer 가 부팅 완료 전 `orca:provider:state` 를 invoke 한다 |
| AC13 | 합성 배포 fixture(gate 1 + service 1)로 `ProviderPlatformState` 전 필드가 이동 전후 동일하다 | `gate`·`providers[]`(`id`·`label`·`kind`·`origin`·`auth`·`status`·`activeAuthKind`·`principal`·`expiresAt`·`tools`)·`step` 을 순수 테스트로 스냅샷 비교. **기본 빌드는 선언 0이라 실기로 확인 불가**(ⓓ) | `orca:provider:list` / `orca:provider:state` |
| AC14 | 사람 실기 — 기본 빌드가 기동하고 게이트 없이 열리며 카탈로그 탭이 이동 전과 같다 | `npm run dev` 후 육안 | Electron 실행 |
| AC15 | `docs/generated/inventory.md` 재생성 차이 0 (슬라이스 9 → 12 반영) | `node scripts/check-doc-inventory.mjs --check` exit 0 | CI 게이트 |

### AC 검증 주의사항

- **기존 테스트 재사용**: 인용한 스위트의 실재를 확인했다 — `gate/gate.test.ts`(134줄, AC11),
  `ipc-documentation.test.ts`(48줄, AC7), `misc-split.test.ts`(85줄, `EXPECTED` 25항목 배열, AC8),
  `no-node-fetch.test.ts`(76줄), `check-migrations-appendonly.mjs`(138줄).
  ⚠️ `platform.ts`·`model-resolve.ts`·`env-merge.ts`·`provider-registry.ts`·`auth/store.ts`·
  `auth/store-file.ts`·`auth/present.ts`·`auth/oauth-runner.ts`·`auth/specs/credential.ts` 에는
  **테스트가 없다**(실측). AC13 이 `platform.ts` 를 덮는 유일한 새 안전망이다.
- **사람 실기 항목**: AC14 뿐이며, 순수 로직을 사람에게 넘긴 것이 아니다 — Electron 창이 실제로
  뜨는지가 유일한 대상이고, 상태 동등성은 AC13 이 순수 테스트로 가져갔다.
- **총량/0건 기준**: AC1 의 `rg` 술어는 `app/src` 로 한정한다. 저장소 전체로 잡으면 이번 plan 과
  과거 handoff 문서의 이력 서술까지 잡혀 **게이트 통과가 문서 손상을 유인**한다(0180 AC7 선례).
- **N회/순서 기준**: AC12 는 실행 횟수를 세지 않고 **diff 에서 statement 순서 불변**을 본다 —
  Phase A 가 관측 seam 을 새로 만들지 않기 때문이다(D-006).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `features/providers/` = 56 파일 / **10,426 줄** | `wc -l` 실측 |
| `platform.ts` 가 `./gate` + `./auth/{login,registry,store}` + `adapters/runtime-tool-policy` 를 동시 참조 | `app/src/main/features/providers/platform.ts:14-18` |
| `createProviderPlatform` 은 자유 함수가 아니라 **`Bootstrap` 의 private 메서드** (제안서 서술 정정) | `app/src/main/app/bootstrap.ts:213`, `new ProviderPlatform({...})` 은 `:283-328` |
| `ServiceToolRegistrar` 는 Confluence 전용이 아니라 **모든 `Provider.tools` 를 처리하는 generic registrar** | `features/providers/service/index.ts:32-58` |
| `providerToolServerId(id) = \`${id}-tools\`` 는 서버 id 의 **유일한 조립 지점**; 완전 이름은 `runtimeToolFullName` 이 만든다 | `service/index.ts:28-30` · `adapters/runtime-tool-policy.ts:6-8` |
| 배포 선언 3배열이 **전부 빈 배열** | `declarations/sso.ts:68` · `llm.ts:61` · `service.ts:49` |
| `confluenceTools` 의 살아 있는 소비자 **0** (자기 테스트 + 주석 예제뿐) | `declarations/service.ts:42` |
| `gate/index.ts` 는 electron-free 순수 함수 모듈이고 `status==='valid' && verified` 를 이미 요구 | `gate/index.ts:52-65` |
| `verified` 는 프로세스 수명 한정 비영속 Set | `auth/store.ts:41-48` |
| `settings-reactions.ts` 는 **이미 `app/`** 에 있다 (0187) | `app/settings-reactions.ts:1-13` · `bootstrap.ts:430` |
| `usageFetcher = undefined` (기본 빌드) → `usage-fetch` job 미등록 | `bootstrap.ts:408` · `features/usage/jobs.ts:67` |
| 교차 feature import 금지 + `import/no-cycle` | `app/eslint.config.mjs:161-164` · `:134` |
| `src/main` 최상위는 `{app, contracts, adapters, features, infra}` 로 제한, `mode:'folder'` | `app/eslint.config.mjs:118-128` |
| ABI-중립 기본 게이트 = `lint`+`typecheck`; 비-DB 는 `./node_modules/.bin/vitest run` | `app/AGENTS.md:124`·`:137` |
| 알려진 red 5파일(DB ABI) | `app/AGENTS.md:134` |
| `app/node_modules` 부재 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 선행 | 실측 · `app/AGENTS.md:136` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `features/providers` 를 **실제로 import** 하는 파일 | `rg "from '[^']*features/providers"` | **15** | 전환 대상 |
| 그중 main 프로세스 | 같은 검색 | **11** | `bootstrap`·`chat-turn-continuation`·`chat-turn/{admission,runtime-entry,turn-setup}`·`context`·`handlers/{engine,misc,providers,providers.test}`·`service-tools.test` |
| 그중 renderer | 같은 검색 | **4** | 전부 `renderer/src/features/providers`(**renderer 슬라이스**) 를 가리킨다 — main 의 동명 디렉터리와 무관, **이동 대상 아님** |
| main 소비자 중 `app/` 밖에 있는 것 | 위 목록 검사 | **0** | 🔑 **교차 feature import 가 하나도 없다** — 이동이 `app/` 안의 import 재작성으로 닫힌다 |
| 문자열만 언급(주석) | `rg "features/providers"` − 위 | 6 | `contracts/provider.ts:218` · `adapters/provider-config.ts:2` · `infra/browser-session.ts:123` · `infra/net/transport.ts:3,6` · `features/usage/fetcher.ts:4` · `features/sessions/session-runtime.ts:169` — **주석 경로 정정 대상** |
| `features/providers` 내 테스트 파일 | `rg --files -g '*.test.ts'` | **19** | 대상 모듈과 함께 이동 |
| 테스트가 없는 이동 대상 모듈 | 파일 대조 | 9 | AC 검증 주의사항 참조 |

### 수치 / 전칭 표현 검산

- 재측정: 56 파일 / 10,426 줄 = auth 4,193 + service 4,417 + 루트 1,320 + declarations 195 +
  gate 199 + llm 102 → **합 10,426 ✓**.
- "유일한" 반례 검색: `providerToolServerId` 가 서버 id 의 유일 조립 지점이라는 주석
  (`service/index.ts:26-27`)을 `rg "\-tools\`"` 로 확인 — 다른 조립 지점 0.
- 문서 앵커 확인: `app/AGENTS.md:112` `better-sqlite3 ABI · 제약 환경 게이트 가이드` 실재 ✓,
  `docs/decisions/004-provider-single-axis.md` 실재 ✓, `docs/generated/inventory.md:17` 슬라이스
  행 실재 ✓.
- 기존 테스트 케이스 존재 확인: 위 AC 검증 주의사항.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- **현재 책임 소유자**: `features/providers/` 하나가 인증·Harness 설정·Plugin·facade 를 모두 갖는다.
- **현재 entry → flow → consumer**:

```text
Bootstrap.createProviderPlatform (bootstrap.ts:213-332)
  ├─ ProviderRegistry(declaredProviders())      ← declarations/{sso,llm,service}
  ├─ ProviderStore(persistence, vault)          ← auth/store, auth/store-file
  ├─ ProviderApiImpl(registry, store, netFetch) ← auth/api
  ├─ ServiceToolRegistrar(runtimeTools, api)    ← service/index          (generic)
  └─ ProviderPlatform({registry, store, login, api, bypass, toolsOf})
                                                 ← platform.ts  (gate + auth 동시 참조)

registerProviderHandlers(platform)   → orca:provider:* 6채널
void providers.resume()              → LoginService.resume → sweepPlugins → onChange 1회
mcp.attachTokenSource(api.token)     → ${BINDING:<id>}  (동기)

[DB init]

ProviderSettingsService(loadClaudeProviderSettings)   ← provider-settings.ts (배럴)
  scaffold → extension deploy → invalidateAll()

chat turn: resolveTurnProvider → providerSettings.resolve()   ← provider-settings
           buildTurnEnv        → llmEnvFor(api.materialize)   ← llm/index
```

- **문제의 구조적 제약**: 위 그림에서 *인증*(왼쪽 축)과 *Harness 설정*(아래 축)은 서로를 호출하지
  않는데도 같은 디렉터리에 산다. 그래서 `features/providers` 를 읽는 사람이 매 파일마다 어느
  축인지 판정해야 하고 — 실제로 `closed-network-extensions.md:64` 가 "**이 디렉터리에는 세입자가
  둘이다**" 라는 경고를 따로 두고 있다.

### TO-BE — 변경 후 목표 구조와 동작 경로

- **변경 후 책임 소유자**: 네 축이 각자 슬라이스를 갖고, 아직 가를 수 없는 facade 만 컴포지션
  루트의 명시적 임시 구역에 남는다.

```text
app/src/main/
├─ contracts/provider.ts               (D-007 — 무변경)
├─ adapters/harness-config.ts          ← adapters/provider-config.ts
├─ features/
│  ├─ auth/          registry·store·store-file·login·api·oauth·oauth-runner·
│  │                 policy·present·session-policies·specs/{credential,browser-session}
│  ├─ gate/          index.ts (순수)
│  ├─ harnesses/     settings-entries·settings·models·env·runtime-boundary·
│  │                 settings-write·claude/model-parser
│  ├─ plugins/confluence/   rest·connector·tools·storage-to-markdown·
│  │                        search-render·download-store·limit·base-path
│  ├─ extensions/harness-plugins/  claude.ts · claude-user-skills.ts
│  └─ usage/        (무변경)
└─ app/
   ├─ deployment/          ← declarations/{index,sso,llm,service}
   ├─ provider-compat/     platform.ts · service-tools.ts · llm-join.ts   [0189/0190 삭제]
   ├─ settings-reactions.ts (무변경 · 0189/0190 재배선 대상)
   └─ bootstrap.ts          (import 경로만 변경)
```

- **변경 후 flow**: 위 AS-IS 그림과 **화살표가 동일하다.** 바뀌는 것은 각 화살표 왼쪽 모듈이 어느
  디렉터리에서 오는가 뿐이다.
- **오류/취소/정리 경로**: 전부 무변경 — `PROBE_TIMEOUT_MS`(15초), `MAX_REDIRECTS`(5),
  `AUTHORIZATION_TTL_MS`(10분), 401/403 강등, `sweepPlugins` 의 `1 + K` 방송 상한.
- **유지 / 대체**: 유지 = 모든 실행 메커니즘. 대체 = 없음. 삭제 = 없음(디렉터리 껍데기 제외).

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `features/providers/` 1슬라이스에 4책임 | 4슬라이스 + `app/provider-compat/` 3파일 + `app/deployment/` | 교차를 물리적으로 가른다 | §11 이동표 · AC1·AC2 |
| 소유 불가 코드 | `platform.ts`·`service/index.ts`·`llm/index.ts` 가 슬라이스 안에 있으나 여러 축을 문다 | `app/provider-compat/` (임시, 주석으로 명시) | 계약을 안 바꾸면 이 셋은 슬라이스에 못 들어간다 | §11 ② · AC2·AC3 |
| 배포 seam | `features/providers/declarations/` | `app/deployment/` (배열 이름·필드 무변경) | 배포가 고치는 파일은 컴포지션 루트에 속한다 | §11 ① · AC1 |
| data/control flow | (그림 참조) | **동일** | Phase A 는 흐름을 바꾸지 않는다 | AC12·AC13 |
| state/contract | `contracts/provider.ts` + shared DTO | **동일** (D-007·D-010) | 계약 변경은 0189/0190 | AC7·AC8 |
| Usage 대상 집합 | `providers.declarations('llm').map(llmProviderKey)` | **동일** (compat 경유) | 정본 전환은 의미 변경 (D-005) | §12 |
| error/lifecycle | probe/redirect/401 정책 | **동일** | — | AC6 (기존 스위트 유지) |
| test seam/관측점 | 19 테스트 파일이 `features/providers/` 안 | 같은 테스트가 새 경로에 | 대상 모듈과 함께 이동 | AC6 |
| 신설 관측점 | 없음 | AC10·AC11·AC13 순수 테스트 (**production seam 신설 0**) | 테스트 없는 9모듈 중 `platform.ts` 를 덮는다 | D-006 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/auth/` | 인증 lifecycle·Grant·vault·인증된 요청 | AuthSpec/입력 → Grant, `ProviderRequest` → `ProviderResponse` | `app/bootstrap`·`app/provider-compat` |
| `features/gate/` | 순수 게이트 판정 | `GateInput` → `ProviderGateState` | `app/provider-compat/platform.ts` |
| `features/harnesses/` | settings 열거·해석·모델 파싱·respawn 술어·CRUD | 디렉터리/파일 → `ResolvedProviderSettings`·`ParsedModel[]` | `app/bootstrap`·`app/chat-turn/*`·`app/handlers/{engine,misc}` |
| `features/plugins/confluence/` | Confluence REST·Markdown·첨부 | `ProviderToolContext` → `RuntimeToolServer` | `app/deployment/service.ts`(주석 예제) |
| `features/extensions/harness-plugins/` | Claude 가 로드하는 package 렌더 | 입력 → dist 경로 | `features/extensions/deployer.ts` |
| `app/deployment/` | 배포별 build-time 선언 | — → `Provider[]` | `app/provider-compat/platform.ts` 조립 |
| `app/provider-compat/` | **임시** facade·generic registrar·LLM 조인 | 위 조각들 → `ProviderPlatformState`·env | `app/bootstrap`·`app/handlers/providers`·`app/chat-turn/turn-setup` |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| `Provider`·`ProviderApi`·`Grant`·`AuthSpec` | `contracts/provider.ts` (**무변경**) | tsc | typecheck | AC5 실패 |
| `ProviderKind`·`ProviderInfo`·`ProviderPlatformState` | `shared/ipc.ts` (**무변경**) | zod schema + `ipc-documentation.test.ts` | 등록/호출 시점 | AC7 실패 |
| 레이어 DAG · 교차 feature 금지 | `app/eslint.config.mjs:118-174` | eslint-plugin-boundaries | lint | AC4 실패 |
| `src/main` 최상위 디렉터리 화이트리스트 | 같은 파일 `:120-121` | boundaries "no element" | lint | 새 최상위 디렉터리 만들면 즉시 error |
| 서버 id `<id>-tools` | `service/index.ts:28` → `app/provider-compat/service-tools.ts` | 순수 테스트 | 조립 시점 | AC10 실패 |
| 게이트 진리표 | `features/gate/index.ts` | `gate.test.ts` | 판정 시점 | AC11 실패 |
| migration append-only | `scripts/check-migrations-appendonly.mjs` | CI | 릴리스 | AC9 실패 |
| inventory 수치 | `docs/generated/inventory.md` (생성물) | `check-doc-inventory --check` | CI | AC15 실패 |

- **같은 규칙이 여러 레이어에 있는가**: 없다. 이동만 하므로 규칙 복제가 발생하지 않는다.
  단 `app/provider-compat/` 가 임시라는 사실은 **위치 + 주석 두 곳**에 있는데, 이는 의도적
  중복이다(위치는 기계가, 주석은 사람이 읽는다) — AC3 이 주석 쪽을 강제한다.
- **선택적 필드**: 이번 범위에서 새 optional 필드를 만들지 않는다. `ctx.providers?` 의
  "미주입 = 미인증, fail-closed" 현재 정책을 그대로 유지한다(`app/context.ts:49-52`).

## 11. 구현 설계 — 이동표 (D-004: 세 유형)

### ① 최종 소유 — 0189/0190 에서도 유지

| AS-IS | TO-BE | 처리 |
|---|---|---|
| `features/providers/auth/**` (19 파일) | `features/auth/**` | 동작 유지 이동. 파일명 그대로 |
| `features/providers/gate/**` (2 파일) | `features/gate/**` | 동작 유지 이동 |
| `features/providers/provider-registry.ts` | `features/harnesses/settings-entries.ts` | settings 디렉터리 entry 열거 |
| `features/providers/provider-settings.ts` (+test) | `features/harnesses/settings.ts` | 배럴 re-export 구성 유지 |
| `features/providers/model-resolve.ts` | `features/harnesses/models.ts` | Model 선택 책임 유지 |
| `features/providers/env-merge.ts` | `features/harnesses/env.ts` | subprocess env 조립 |
| `features/providers/provider-boundary.ts` (+test) | `features/harnesses/runtime-boundary.ts` | respawn 술어 |
| `features/providers/engine-write.ts` (+test) | `features/harnesses/settings-write.ts` | Engine 어휘 제거 (파일명) |
| `features/providers/claude-model-parser.ts` (+test) | `features/harnesses/claude/model-parser.ts` | Claude 전용임을 위치로 |
| `features/providers/service/confluence/**` (15 파일) | `features/plugins/confluence/**` | 구체 Plugin 소유권 |
| `features/extensions/claude-plugin-package.ts` | `features/extensions/harness-plugins/claude.ts` | + symbol `renderClaudePluginPackage` → **`renderClaudeHarnessPlugin`** (D-008) |
| `features/extensions/claude-user-skills-plugin.ts` (+test) | `features/extensions/harness-plugins/claude-user-skills.ts` | 같은 축의 두 번째 HarnessPlugin 렌더러 (**제안서 이동표 누락분**). symbol `renderClaudeUserSkillsPlugin` 은 이미 책임을 드러내므로 **개명하지 않는다** |
| `adapters/provider-config.ts` | `adapters/harness-config.ts` | import 0 유지 |
| `features/providers/declarations/**` (4 파일) | `app/deployment/{index,sso,llm,service}.ts` | 배열 이름·필드 무변경. 배포 seam 의 **최종** 위치 |

**symbol rename 은 `renderClaudePluginPackage` → `renderClaudeHarnessPlugin` 1건뿐이다.** 제안서가
함께 예시한 `builtInHarnessPluginRoot` 는 **대응하는 현재 심볼이 없다** — 실측 결과 두 렌더러가
내보내는 root 함수는 `orcaPluginRoot`(`claude-plugin-package.ts:27`)와
`userClaudePluginRoot`(`claude-user-skills-plugin.ts:29`)이고, 둘 다 `builtIn*` 이 아니다. **없는
심볼을 새로 만들지 않는다**(D-008 의 취지는 범위 고정이다). 두 root 함수의 개명 여부는 어휘 정본을
재작성하는 0190 이 판단한다.

### ② 임시 compatibility — 0189/0190 이 삭제 (위치가 그 사실을 드러낸다)

| AS-IS | TO-BE | 왜 슬라이스에 못 들어가는가 | 삭제 예정 |
|---|---|---|---|
| `features/providers/platform.ts` | `app/provider-compat/platform.ts` | `./gate` + `./auth/*` 동시 참조 → 교차 feature 금지 | 0189 (`AuthRuntime` + `connection-views` 로 분해) |
| `features/providers/service/index.ts` (+ `app/service-tools.test.ts` 유지) | `app/provider-compat/service-tools.ts` | **모든 `Provider.tools` 를 처리하는 generic registrar** — Confluence 소유가 아니다 | 0189 (Plugin별 작은 visibility helper) |
| `features/providers/llm/**` (2 파일) | `app/provider-compat/llm-join.ts` | `Provider.llm` 을 읽는 선언↔settings 조인 | 0190 (`Provider.llm` 삭제와 함께) |

각 파일 머리에 다음 형식의 주석을 둔다(AC3):

```text
// [임시 · 0189 삭제 예정] Phase A 가 features/providers 를 가르면서 어느 슬라이스에도
// 넣을 수 없어 컴포지션 루트에 남긴 집적 코드다. …
// 현재 소비자: app/bootstrap.ts · app/handlers/providers.ts
// 삭제 조건: 0189 가 AuthRuntime/BoundAuth 를 세우고 connection view 조립을 분리하면 사라진다.
```

### ③ 무변경 보존 — 0189/0190 의 필수 재배선 대상

| 대상 | 0188 처리 | 0189/0190 에서 반드시 |
|---|---|---|
| `app/settings-reactions.ts` | 손대지 않는다 (이미 `app/`) | `ProviderPlatform` 제거 시 `providers.state()` 주입을 교체 |
| `bootstrap.ts:437-445` `registerUsageJobs.providerKeys` | 배선 유지, compat 경유 (D-005) | 정본을 선언 → ModelProvider settings entry 로 **명시적 계약 변경** |
| `contracts/provider.ts` | 파일·심볼 그대로 (D-007) | 0189 가 `contracts/auth.ts` 로 개명하며 `llm`/`tools` 제거 |
| `src/renderer/src/features/providers/**` | **대상 아님** (renderer 슬라이스) | 별도 UI migration 전까지 유지 |

### 변경 파일 요약

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/{auth,gate,harnesses,plugins}/**` | 최종 소유 | 이동 + import 경로 | 기존 19 테스트 동반 이동 |
| `app/src/main/app/deployment/**` | 배포 선언 | 이동, 내용 무변경 | — (빈 배열) |
| `app/src/main/app/provider-compat/**` (신규 3) | 임시 집적 | 이동 + 삭제 예정 주석 | AC10·AC13 순수 테스트 신설 |
| `app/src/main/app/bootstrap.ts` | 컴포지션 | **import 경로만** — statement 순서 불변 | AC12 (diff 검사) |
| `app/src/main/app/{context,chat-turn/*,chat-turn-continuation,handlers/*}.ts` | 소비자 | import 경로만 | 기존 스위트 |
| `app/src/main/adapters/harness-config.ts` | adapter port | 파일 개명 | — |
| `app/src/main/features/extensions/harness-plugins/*.ts` | HarnessPlugin 렌더 | 이동 + symbol 1건 개명 | 기존 `claude-user-skills-plugin.test.ts` 동반 |
| 주석 경로 정정 6곳 | — | `contracts/provider.ts:218` · `adapters/harness-config.ts:2` · `infra/browser-session.ts:123` · `infra/net/transport.ts:3,6` · `features/usage/fetcher.ts:4` · `features/sessions/session-runtime.ts:169` | — |
| `docs/generated/inventory.md` | 생성물 | 재생성 (슬라이스 9→12) | AC15 |

### 테스트 가능성

- **electron/DB 의존 분리**: 새로 필요한 순수 seam 은 없다. `gate/index.ts`·`policy.ts`·`oauth.ts`·
  `oauth-runner.ts`·`specs/browser-session.ts`·`api.ts`·`session-policies.ts` 는 이미 electron-free
  이고 주입 포트로 결합이 끊겨 있다 — 이동해도 그대로다.
- **AC13 의 seam**: `ProviderPlatform` 은 생성자 주입만 받으므로(`platform.ts:29-46`) 합성
  fixture 를 넣어 `state()` 를 호출하는 것으로 충분하다. **production 코드 변경 0**.
- **AC12 의 관측**: 새 훅을 만들지 않고 `git diff` 로 statement 순서를 본다 (D-006).

## 12. End-to-end 영향

### producer → consumer

```text
app/deployment (선언)
  → app/provider-compat/platform.ts (조립)
  → features/auth (Grant·request) · features/gate (판정) · app/provider-compat/service-tools (도구)
  → ProviderPlatformState → orca:provider:state → renderer (무변경)

features/harnesses (settings·models)
  → app/chat-turn/turn-setup (resolve) + app/provider-compat/llm-join (env)
  → TurnRequest.{providerSettings, env} → SessionAdapter (무변경)
```

- producer 기준·consumer 파생 규칙 모두 **무변경**. 파생 가능한 합성값으로 소비자가 정본을
  우회하는 새 경로를 만들지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

부팅에서 **새 값을 늘리지 않는다.** 아래는 이동으로 import 가 바뀌는 전수 목록이다(§8 전수 조사).

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `app/bootstrap.ts` (14 import) | 경로만 변경, 순서 불변 | AC12 |
| `app/context.ts` | `ProviderPlatform`·`ProviderSettingsService` 경로 | AC5 |
| `app/chat-turn/{turn-setup,admission,runtime-entry}.ts` · `app/chat-turn-continuation.ts` | `provider-settings` 배럴 → `features/harnesses/settings`, `llm` → `provider-compat/llm-join` | AC5·AC6 |
| `app/handlers/{providers,engine,misc}.ts` (+ `providers.test.ts`) | 경로만 | AC6·AC8 |
| `app/service-tools.test.ts` | `provider-compat/service-tools` | AC6 |
| renderer 4파일 | **영향 없음** (renderer 슬라이스) | — |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `Bootstrap.createProviderPlatform` 의 조립 순서 그대로.
- 취소/중단: `AbortSignal` 전파 경로 무변경(redirect·browser-session 전송 끝까지).
- 종료/quit/crash: 무변경.
- retry/timeout/partial failure: `PROBE_TIMEOUT_MS` 15초, redirect 5홉, OAuth pending TTL 10분 —
  전부 상수 그대로 이동.
- cleanup/rollback: 각 이동 그룹이 **독립 green 커밋**이어야 한다(§19). 중간에 멈춰도
  `features/providers` 와 새 디렉터리가 동시에 살아 있는 상태가 오래 남지 않도록, 커밋 단위를
  ①auth+gate ②harnesses ③plugins+harness-plugins ④deployment+provider-compat+bootstrap 넷으로
  가른다. 마지막 커밋에서 `features/providers` 가 비고 삭제된다.

## 14. 성능 / 상한 / 최적화

- 새 출력·새 요청 없음. 원천 상한 × 배치 상한 계산이 필요한 신규 경로가 없다.
- **구조적 목표의 달성 가능성**: "`features/providers` = 0" 은 56 파일의 목적지를 §11 이 전수
  지정했으므로 달성 가능하다. 목적지 미정 파일 0개 — 이것이 D-004 를 세운 이유다.
- 캐시/최적화로 잃는 부수 효과: 없다(캐시를 건드리지 않는다). `ProviderSettingsService` 의
  mtime 캐시와 `resolve` 가 같은 `settings` 참조를 돌려주는 성질(`provider-settings.ts:110-114`)은
  `providerSettingsChangedSinceSpawn` 의 fast path 전제이므로 **그대로 옮긴다** — 이 성질을 깨면
  턴마다 `JSON.stringify` 비교가 돌아 hot path 가 느려진다.

## 15. 외부 구현 포트 / 문서 계약

폐쇄망 배포가 고치는 파일 경로가 `features/providers/declarations/` → `app/deployment/` 로 바뀐다.
**절차 문서 전면 갱신은 0190**(D-003)이지만, 그 사이 정본이 없는 경로를 가리키면 안 되므로 0188 은
최소 정정만 한다.

- **shape**: `app/deployment/{sso,llm,service}.ts` 의 주석 예제가 실제 타입에 대입되어 typecheck
  되는지 — 0181 5단계-e·0182 AC11 선례대로 **예제를 실제 배열에 채워 typecheck 3/3 을 통과시킨 뒤
  되돌려** 확인한다.
- **semantics**: 이번 범위에서 성공/실패/null 의미가 바뀌지 않는다.
- 0188 이 손대는 문서: `docs/guides/closed-network-extensions.md` 의 **경로 문자열만**
  (`§1.1 고치는 파일은 declarations/ 셋뿐이다` 의 경로, `§1.2 features/providers 세입자 둘` 경고).
  §1.2 는 이번 작업이 그 경고를 **해소**하므로 해당 절을 제거하거나 "0188 에서 분리됨" 으로
  갱신한다. 나머지 구조 서술은 0190.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| `Provider.id` 는 한 번 정하면 유지 | ADR-004 invariant · `providers.md §10` | D-009 | **유지** |
| vault 키 형식 `provider:<id>:<authKind>` | 동일 | D-009 | **유지** |
| 게이트 선언 0 → 통과 | 동일 | AC11 ⓐ | **유지** |
| 미인증 → `null`/드롭 (빈 문자열 금지) | 동일 | §9 무변경 | **유지** |
| 런타임 동적 로딩 금지 | 동일 | D-011 | **유지** |
| **배포가 고치는 파일은 `declarations/` 묶음뿐** | ADR-004 invariant | §11 ① — `app/deployment/` 로 이동 | **변경** — 파일 *집합*은 같고 *위치*만 바뀐다. ADR 문안 갱신은 0190(ADR-006) |
| **`kind` 가 1급 축** | ADR-004 선택 | 0188 에서 건드리지 않음 | **유지** (폐기는 0189/0190) |
| `채널명 6개` 고정 | `providers.md §10` | AC7 | **유지** |
| main 은 feature 수직 슬라이스, 교차 import 금지 | ADR-002 | §11 전체 설계 근거 | **유지 · 강화** |
| main 원격 요청은 Chromium `net` 스택 | ADR-003 | AC (no-node-fetch) | **유지** |
| 0028 "LLM settings 토큰 주입 폐지" — settings.json 은 verbatim | `llm/index.ts:8-13` | 무변경 | **유지** |
| 0187 `Carrier` + grant fence | `auth/api.ts` | 파일 이동만 | **유지** |
| GLOSSARY §2 `Engine` · §3 `Provider` 금지어 예외 | GLOSSARY | 0188 은 파일명 1건(`engine-write`→`settings-write`)만 | **부분 변경** — 어휘 정본 재작성은 0190 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 이동 중 테스트가 조용히 사라져 green 이 된다 | AC6 ⓐ 가 diff 술어로 삭제·skip 0을 강제한다 (숫자 비교만으로는 못 잡는다) |
| `platform.ts` 에 테스트가 없어 이동 실수를 못 잡는다 | AC13 이 합성 fixture 로 `ProviderPlatformState` 전 필드를 덮는다 — 이번에 유일하게 늘리는 안전망 |
| `app/provider-compat/` 가 영구화된다 | AC3(주석) + INDEX 의 0189/0190 행이 삭제 조건을 명시. 0190 verify 가 잔존 여부를 판정한다 |
| Phase A 와 B 사이에 두 구조가 오래 공존한다 | 제안서 경고 승계 — 0188 은 임시 re-export 를 **만들지 않고**(경로를 직접 바꾼다) 커밋 4개로 끝낸다 |
| 슬라이스 9→12 로 `check-doc-inventory` prose 검사가 다른 문서를 깨뜨린다 | AC15 를 게이트에 포함. prose 패턴은 `docs/handoff`·`docs/archive` 를 제외하므로 이 plan 자체는 안전 |
| `npm ci` 가 egress 차단으로 실패한다 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` + postinstall 실패 무시 (`app/AGENTS.md:136`). 그래도 안 되면 lint/typecheck 를 못 도는 것이므로 **환경 실패로 분리 보고**하고 green 을 주장하지 않는다 |
| symbol rename 이 예상보다 번진다 | `renderClaudePluginPackage` 의 소비자는 실측 **2곳**(`deployer.ts:33`·`:193`)뿐이다. 그 이상으로 번지면 rename 을 0190 으로 미룬다 (D-008 의 취지는 범위 고정) |

- **되돌리기 어려운 결정**: `app/deployment/` 를 배포 seam 의 최종 위치로 고정하는 것(폐쇄망 배포
  절차의 진입점). D-003 승인 범위 안이다.
- **신규 의존성**: **0건.**

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/{auth,gate,harnesses,plugins}/**` (신규 · 이동)
- `app/src/main/features/extensions/harness-plugins/**` (신규 · 이동)
- `app/src/main/app/{deployment,provider-compat}/**` (신규 · 이동)
- `app/src/main/app/{bootstrap,context,chat-turn-continuation}.ts` · `app/chat-turn/**` · `app/handlers/{providers,engine,misc}.ts`
- `app/src/main/adapters/harness-config.ts`
- 주석 경로 정정 6곳 (§11)
- `docs/generated/inventory.md` (재생성)
- `docs/guides/closed-network-extensions.md` §1.1·§1.2 (경로·세입자 경고만)
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` (`:112-147`).
- 환경 제약: `app/node_modules` 부재 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 선행(postinstall
  실패 무시). DB ABI red 5파일은 베이스라인.
- **착수 직후 baseline 실측을 먼저 기록한다** (AC6 의 기준선): 테스트 파일 수 · 통과 수 · 실패
  파일 집합.

```bash
cd app
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci        # postinstall 실패는 무시
npm run lint                                   # error 0 (warn 1 = 0102 베이스라인)
npm run typecheck                              # 3/3
./node_modules/.bin/vitest run                 # pretest 우회 (ABI 유지)
node scripts/check-doc-inventory.mjs --check
node scripts/check-migrations-appendonly.mjs
git diff --stat -- src/main/infra/db/migrations   # 0 파일
```

- 커밋 단위: ①auth+gate ②harnesses ③plugins+harness-plugins ④deployment+provider-compat+bootstrap.
  **각 커밋이 독립적으로 lint/typecheck/test green** 이어야 한다.
- 사람 실기: AC14 (`npm run dev` 기동 + 카탈로그 육안).

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 (D-001~D-011).
- [x] Part I 만 읽어도 완료 상태가 이해된다 ("사용자는 아무 차이도 느끼지 못한다").
- [x] 조건절·이유절·제거/유지 요구를 재해석하지 않았다 — **이동을 제거로 포장하지 않았다**(§4).
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다.
- [x] AS-IS 와 TO-BE 가 같은 축·같은 구체성으로 있다 (§9 두 그림이 같은 화살표).
- [x] Delta 각 행이 §11 이동표 또는 AC 로 추적된다.
- [x] AS-IS 에서 사라진 책임은 없다 — 전부 이동이며, 삭제는 0189/0190 으로 명시했다.
- [x] 수치(56/10,426 · 15 importer · 19 test)·전칭 표현·문서 앵커·기존 테스트 케이스를 실측했다.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 상태 동등성은 AC13 이 순수 테스트로 가져갔다.
- [x] semantic 목표를 structural proxy 만으로 검증하지 않는다 — AC6 이 숫자 비교의 맹점을 diff
      술어로 보완한다 (P37 회피).
- [x] 신규 계약 없음 → SSOT·강제 지점은 기존 것을 §10 에 나열했다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 (§8 전수 조사 · §12).
- [x] producer/consumer 양쪽 의미를 확인했다 (§12).
- [x] 상한·총량·one-way door 를 계산했다 (§6 미룬 항목 표 · §14).
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다 (§19).
- [x] 본문 완성 후 Decision Ledger 와 기존 결정을 교차검증했다 (§16).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision 과 충돌하는 설계 발견: …

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현 세부 보완 / ⚠️ 제품·AC 변경이라 보고만 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 게이트 결과 | … |
| baseline 실측 (착수 시) | 테스트 파일 수 … / 통과 … / 실패 파일 … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | verify r&lt;N&gt; / 구현자 코멘트 / 사용자 | … | open |
