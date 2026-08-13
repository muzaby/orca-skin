# Plan — 0187-simplify-176-186-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0187-simplify-176-186-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-08-13 |
| 매핑 | PHASES Phase 4 행 (0176~0186 계열 /simplify 정리) |
| 상태 | READY (설계=구현 동시 턴 — 비기능 작업은 Claude 가 직접 구현) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 176~186` — 0176~0186 이 도입한 코드를 4관점(재사용·단순화·효율·altitude)으로 정리한다 | 라이브 세션 요청 (2026-08-13) |
| 명시 제약 | **"uiux/db/성능 유지 혹은 개선. 절대 성능저하 안됨."** — UI/UX·DB·성능은 유지가 하한이고 개선이 목표다. 성능 저하는 **어떤 이유로도 수용하지 않는다** | 같은 요청 |
| 명시 절차 | `/simplify` 스킬 정의가 **4개 리뷰 에이전트 병렬 기동**을 지시한다 — 그 스킬 호출이 곧 서브에이전트 사용 요청이다 | `.agents/skills` `/simplify` 정의 |
| 추론 의도 | "정리" = **동작 보존** 품질 개선. 렌더 DOM·클래스·a11y 속성·IPC 채널/스키마·i18n 문구는 불변 (추론) | `/simplify` 정의 + `0131`·`0149`·`0155`·`0175` 선례 |
| 추론 의도 | 버그 사냥은 범위 밖(`/code-review` 몫). 다만 **규칙이 두 벌이라 갈릴 수 있는 지점**을 한 벌로 접는 것은 정리의 본체다 | `/simplify` 정의 |

## Context (왜)

리뷰 구간은 `f539326d..HEAD` 의 `app/src` 변경 — **345 파일 · +13,353/−19,686 · 커밋 50개**.
`f539326d` 는 직전 /simplify 핸드오프 **0175** 의 마지막 구현 커밋이라 그 이후 전체가
0176~0186 에 대응한다.

| 핸드오프 | 성격 |
|---|---|
| `0176-generic-usage-connector` | 사용량 조회를 인증된 connector 호출의 구독으로 |
| `0177-docs-agents-sync` | 문서·AGENTS 동기화 |
| `0178-auth-entry-collapse` | 인증 진입점 붕괴 — 표면 3종으로 |
| `0179-main-complexity-reduction` | **`app/chat-turn.ts`(892줄 한 클로저) → `app/chat-turn/*` 14 모듈** |
| `0180-auth-plugin-teardown` | **`auth-platform`·`connectors`·플러그인 전면 제거** |
| `0181-provider-platform` | **`features/providers` 에 provider 플랫폼 신설**(auth·gate·llm·service·declarations) |
| `0182`~`0184` | 세션 group 부팅 등록 · 사용량을 선언으로 · provider 인증 판정 교정 |
| `0185-docs-information-architecture` | 문서 정보구조 재편 |
| `0186-usage-main-authority` | **사용량 정본을 Main 으로** + optional fetcher |

**이 묶음의 성격.** 0175 구간이 *"같은 규칙이 두세 벌"* 이었다면, 이 구간은 **"큰 것을 지우고
새로 세운 자리에 남은 이음매"** 다. 한 플랫폼(`auth-platform`)을 통째로 걷어내고(0180) 다른
플랫폼(`providers`)을 세운(0181) 뒤 그 위에 사용량 정본을 얹었다(0186). 그래서 결함이 세 갈래로
모인다:

1. **지워진 쪽의 잔해** — 소비자가 전부 사라졌는데 남은 모듈(`shared/connector-address.ts`),
   존재 이유가 사라진 facade(`secret-facade.ts`), 아무도 안 읽는 필드(`globalUpdatedAt`).
2. **갈라 놓은 자리의 복사** — 한 파일이던 `LoginFrame` 을 `GateFrame`/`BootFailureFrame` 으로
   가르면서 창 크롬 45줄이 그대로 복제됐고, 같은 인증 칩 열이 두 화면에 각각 적혔다.
3. **새 플랫폼의 뜨거운 경로** — provider 자격증명이 **턴마다** 읽히기 시작했는데(0181 이
   `buildTurnEnv` 에 `llmEnvFor` 를 얹었다) 그 읽기가 `SecretStore` 를 한 번에 두세 번 친다.

세 번째가 이번 요구("절대 성능저하 안됨")와 정면으로 맞물린다. `conf`(electron-store)의
`store` getter 는 **호출마다 `readFileSync` + `JSON.parse` 를 다시 한다 — 메모리 캐시가 없다**
(`node_modules/conf/dist/source/index.js:274-280` 실측). 그 위에 `safeStorage` 복호화가 얹힌다.

## 자료조사 (Research)

`/simplify` 절차대로 **4관점 리뷰 에이전트를 병렬 기동**(재사용·단순화·효율·altitude)해
**37건**을 받았고, dedup 후 적용/기각을 갈랐다. 에이전트가 *깨끗함을 확인* 한 것도 근거로 남긴다:

- **턴 hot path 는 회귀가 없다.** `recordAndBroadcast(providerKey)` 는 `telemetry` 이벤트에
  걸려 **턴당 1회**지 스트림 청크당이 아니고(`adapters/claude-map.ts:467`), provider 쿼리는
  같은 스캔에 조건부 `SUM` 을 더할 뿐이라 `idx_turn_usage_created` 를 그대로 탄다.
- **renderer 사용량 경로는 순증 개선이다.** 제거된 `useProviderUsageLimits` 는 턴 종료마다
  페이지별 IPC + renderer 재계산을 했고, 새 `usageStore` 는 push-only + scope 별 delta 다.
- **1분 `usage-fetch` cron 은 이 빌드에 존재하지 않는다** (`fetcher` 미주입 → 등록 자체를
  건너뛴다). 주기 잡 총량은 오히려 **줄었다**(0183 이 5분 `provider-usage-report-refresh` 제거).
- **리스너·타이머 정리는 전부 짝이 맞는다** (`send.ts` 4쌍 · `jobs.ts` `finally clearTimeout` ·
  `loopback-callback.ts` 단일 `settle` · preload `onUsage`/`onState` 의 `off` 클로저).
- **DB 는 손대지 않는다** — 마이그레이션 0건, 쿼리 0건 변경.

## 인수 기준 (Acceptance Criteria)

| # | 기준 | 검증 수단 |
|---|---|---|
| AC1 | **턴당 provider secret 조회의 파일 읽기가 2~3회 → 1회**. `status()` 재호출로 vault 를 두 번 읽지 않는다 | `store.ts:secret()` 이 `vault.read` 1회만 호출 · 기존 `login/api/policy` 테스트 무회귀 |
| AC2 | **요청당 자격증명 해석 1회.** redirect 홉마다 secret·presentation 을 다시 풀지 않는다 | `api.ts` 에 `resolveCarrier` 1회 호출 + `transport(carrier, …)` 시그니처 · `api.test.ts` 무회귀 |
| AC3 | **부팅 plugin sweep 이 병렬**이고 통지가 루프 뒤 1회다 (순차 시 `PROBE_TIMEOUT_MS`×N) | `login.ts:sweepPlugins` 의 `Promise.all` + 단일 `onChange` · `login.test.ts` 무회귀 |
| AC4 | **OAuth pending 스토어가 지연 개방** — DB 앞으로 당겨 둔 provider 부팅 단계에서 동기 파일 열기가 사라진다 | `store-file.ts` 의 `open()` lazy + 실패 시 메모리 폴백(사유 콜백) |
| AC5 | 창 크롬이 **한 벌**이다 — `GateFrame`·`BootFailureFrame` 이 같은 셸을 쓰고 **DOM 은 불변** | `FullFrameShell.tsx` 신설 · 두 화면의 클래스·`data-*`·구조 문자열 동일 |
| AC6 | probe 의 origin 판정이 **`isAllowedOrigin` 한 구현**이다 (`policy.ts` 주석이 요구하는 바) | `login.ts` 의 로컬 `originOf` 제거 |
| AC7 | `SessionGroupPolicy` 선언이 **1개**다 (3개였다 — 하나는 `allowIntegratedAuthDomains` 누락) | `browser-session-policy.ts` 단일 선언 + 나머지 2곳 import |
| AC8 | `<id>-tools` 규칙이 **플랫폼**에 있다 (Confluence 모듈이 아니라) | `service/index.ts:providerToolServerId` · `ProviderToolContext.serverId` |
| AC9 | `mcp__<server>__<tool>` 조립이 **한 함수**다 (3벌이었다) | `runtimeToolFullName` 을 platform·approval 양쪽이 사용 |
| AC10 | `settings:set` 핸들러에 **feature 별 `if (key === …)` 가 없다** | `SettingsStore.onPatch` + `app/settings-reactions.ts`(테스트 대상) |
| AC11 | provider 한도 쓰기가 **사용량 authority 를 지난다** | `UsageTracker.setProviderLimit` · 핸들러는 1줄 |
| AC12 | 죽은 표면 제거: `shared/connector-address.ts` · `createNamespacedSecretFacade` · `clearAll` · `globalUpdatedAt` · `providerKind` i18n 키 · `composeGlobalUsage` | 전 트리 grep 0 |
| AC13 | **UI 개선 1건**: 정의되지 않은 `text-red`(토큰 없음 → 상속색으로 렌더)를 `text-bad` 로 | `tokens.css` 에 `--color-bad` 존재 · `text-red` grep 0 |
| AC14 | 게이트 선언 슬롯이 **배열**이다 (소비자 전부가 N 을 전제하는데 선언만 1개였다) | `GATE_PROVIDERS: Provider[]` + 가이드 동기화 |
| AC15 | **게이트**: lint 0 error · typecheck 3/3 · vitest 무회귀 | 아래 §게이트 |
| AC16 | **IPC 채널·zod 스키마·i18n 표시 문구·DB 스키마/쿼리 무변경** | `git diff` 로 `shared/ipc.ts`·`protocol.ts`·마이그레이션 0줄 |

## 범위 / 비범위

**범위**: 위 AC1~AC16.

**비범위 (기각·이월)** — 이유를 남긴다:

| 건 | 판단 |
|---|---|
| `UsageLimitBar.source` 제거 제안 | **기각.** "아무도 안 읽는다" 는 관측은 맞지만 IPC 로 나가는 뷰 모델의 필드이고 `usage-compose`·`limits`·`tracker` 테스트가 **의미를 고정**하고 있다. 필드를 빼면 계약 변경 + 테스트 대량 수정이라 정리 범위 밖 |
| `reauth` 채널을 `login` 으로 흡수 | **이월.** 관측(“`reauth`≡`login`, `input` 을 아무도 안 보낸다”)은 맞으나 **IPC 채널·zod 스키마 삭제**라 AC16 과 충돌한다. 별도 핸드오프 |
| `allowIntegratedAuthDomains` 를 쓰는 쪽이 없다 | **이월.** 지우면 WIA/ADFS 확장점이 사라지고, 살리려면 `BrowserSessionConfig` 에 필드를 더해야 한다 — **설계 결정**이라 사용자 확인 대상. 이번에는 타입 사본만 1개로 접었다(AC7) |
| `SessionRunner.login` 의 중복 `sessions.register` | **기각.** 부팅 등록(0182)과 겹치는 것은 맞지만, 부팅 등록이 실패해 로그로만 남은 경우 이 호출이 **회복 경로**다. 지우면 그때 `acquire` 가 raw throw 로 죽는다 |
| `GateLogin` 이 게이트 pending 을 renderer 에서 재파생 | **이월.** main 의 `verified` 가 DTO 에 없어 근사한다 — 고치려면 `ProviderGateState` 에 필드 추가(IPC 변경). 정합성 결함이라 `/code-review` 계열 |
| provider 상태 3중 구독을 `shared/stores/providerStore` 로 | **이월.** 옳은 방향이나(usageStore 선례) 훅 3개·컴포넌트 다수를 건드리는 상태관리 재편이라 "정리" 범위를 넘는다. **UX 무회귀 확인이 필요**해 별도 턴 |
| `authChoices` 제거 | **기각.** `[...provider.auth]` 사본이 무의미해 보이나 "선언 순서를 그대로 낸다" 규칙의 **문서화 지점**이고 테스트가 그 규칙을 고정한다 |

## 설계

**원칙: 성능은 한 방향으로만 움직인다.** 이번 변경 중 런타임 비용을 *더하는* 것은 없다.
`Promise.all` 병렬화·중복 파일 읽기 제거·지연 개방·브로드캐스트 N→1 은 전부 감소 방향이고,
나머지는 타입/배치 이동이라 런타임 중립이다.

1. **자격증명 읽기(AC1·AC2)** — `ProviderStore.secret()` 은 `status()` 를 부르지 않는다.
   값형 grant 의 `status==='valid'` 는 정의상 `read.state==='found' && !expired` 이므로 한 번
   읽어 둘 다 답한다(만료는 vault 를 읽기 **전에** 본다). `ProviderApiImpl` 은 `Carrier`
   (세션 = cookie jar / 값형 = secret+presentation)를 **요청당 1회** 풀어 홉에 넘긴다 — 체인
   도중 grant 는 바뀌지 않는다(401 강등은 체인이 끝난 뒤다).
2. **부팅(AC3·AC4)** — 게이트→플러그인 **순서만** 규칙이고 플러그인끼리는 독립이라 `Promise.all`.
   통지는 루프 뒤 1회(안에서 부르면 provider 마다 전체 상태를 다시 만들어 방송한다).
   `store-file.ts` 는 `createRecordPersistence<T>` 하나로 접고 스토어를 **첫 사용 시** 연다.
3. **한 벌로 접기(AC5~AC9)** — 창 크롬 → `FullFrameShell`, 인증 칩 → `shared/ui/AuthKindChoices`
   (클래스 문자열 그대로), origin 판정 → `isAllowedOrigin`, JSON 읽기 → `SessionRunner.getJson`
   (**실패 문장은 호출부가 정한다** — whoami 는 로그, exchange 는 사용자 문구라 `JsonReadFailure`
   사유로 넘긴다), `SessionGroupPolicy` → `browser-session-policy.ts`, `<id>-tools` →
   `providerToolServerId`, `mcp__…` → `runtimeToolFullName`.
4. **깊이 교정(AC10·AC11)** — 설정→파생상태 재방송은 `SettingsStore.onPatch` 통지 + 컴포지션
   루트의 `app/settings-reactions.ts`. **bootstrap 인라인이 아니다** — 그쪽은 electron 을 물어
   vitest 대상이 아니라, 옮기면 회귀 테스트를 잃는다(`features/usage/jobs.ts` 가 같은 이유로
   분리돼 있다). 한도 쓰기는 `UsageTracker.setProviderLimit` 으로 authority 안에 들인다.

## 게이트

| 게이트 | 결과 |
|---|---|
| `npm run lint` | **0 error** / warning 1 (`useTranscriptVirtualizer` — 0102 베이스라인) |
| `npm run typecheck` | **3/3 통과** |
| `npx vitest run` | **1780/1780 통과** (베이스라인과 동수 — 6건 이동, 6건 신설) |
| `node --test "scripts/*.test.mjs"` | **49/49 통과** |
| `node scripts/check-doc-inventory.mjs` | 재생성 결과 **차이 0** |

> `src/main/app/chat-turn.continuity.test.ts` 1 파일은 이 샌드박스에 **Electron 바이너리가
> 없어서**(의존성을 `--ignore-scripts` 로 설치) suite import 단계에서 실패한다. `git stash` 한
> 베이스 상태에서도 **동일하게 실패**함을 확인했다 — 본 변경과 무관하다.

## 리스크 / 롤백

- **리스크(낮음)**: `secret()` 이 `status()` 를 거치지 않으므로 만료·복호화 실패 판정이 그
  함수 안으로 인라인됐다. 두 판정이 어긋나면 만료된 값이 실릴 수 있다 — 기존 `login`·`api`·
  `policy` 테스트가 값형 grant 의 만료/미복호화 경로를 덮는다.
- **리스크(낮음)**: 병렬 sweep 은 provider 마다 독립 probe 라 상호 간섭이 없다. 게이트-플러그인
  **순서**는 `sweepPlugins` 진입 가드(`gates.every(isVerified)`)가 그대로 유지한다.
- **롤백**: 단일 커밋 `git revert`. 마이그레이션·IPC·설정 스키마를 건드리지 않아 되돌림에
  데이터 영향이 없다.
