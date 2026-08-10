# Plan — 0181-provider-platform

## 메타

| 항목 | 값 |
|---|---|
| slug | `0181-provider-platform` |
| 작성자 | Claude Code |
| 일자 | 2026-08-10 |
| 매핑 | PHASES 신규 행 (0181) · 선행 `0180-auth-plugin-teardown`(impl/IMPL_DONE, `762a525`) |
| 상태 | DRAFT → READY → **impl/IMPL_DONE** |
| 구현 주체 | **Claude** (환경에 Codex 부재 — 0160·0162·0163·0176 선례. 사용자 지시) |
| 복원 좌표 | `8965fa7` (0180 teardown 의 부모) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "auth 및 플러그인 기능을 모두 제거 후 **다시 재작성**할것이다." 본 핸드오프가 그 재작성이다 | 라이브 세션 (2026-08-10) |
| 명시 요구 (기능) | "llm provider, 일반 플러그인 provider(사내 서비스, 컨플루언스 등) 제공. 인증은 oauth(code→token) 혹은 id/passwd, PAT, api key" | 동일 |
| 명시 요구 (금지) | "**어설픈 재사용코드 플랫폼화 금지.**" | 동일 |
| 명시 요구 (GUI) | "모든 플러그인 서비스는 gui 노출 되어야 하며, **재인증 기능 가능**해야함." | 동일 |
| 명시 요구 (결정 1차) | LLM provider = **통합** · 로그인 게이트 = **강제** · GUI = **기존 skills 카탈로그 유지** | AskUserQuestion 응답 (2026-08-10) |
| **명시 요구 (결정 2차 — ADFS)** | **"둘 다 필요"** — 게이트는 브라우저 세션(WIA 쿠키)으로, 토큰이 필요한 곳은 그 세션으로 사내 API 를 불러 토큰을 받는다 | AskUserQuestion 응답 (2026-08-10) |
| **명시 요구 (결정 2차 — LLM 인증)** | **"둘다 쓰는데, 구현자(빌트인 구현시), 사용자 모두 골라서 선택하도록 한다"** — api key 와 SSO→토큰 발급을 둘 다 지원하되 **선택 주체가 둘**이다 | 동일 |
| 명시 요구 (진행) | "먼저 0181 plan 문서만" — 구현 전에 설계를 검토받는다 | 동일 |
| 명시 요구 (참조) | 아티팩트 4건(`c865512e`·`d801bbaf`·`c5b48b30`·`024a4677`). `docs/etc/study/` 는 근거 배제 | 라이브 세션 정정 (2026-08-10) |

## Context (왜)

0180 이 인증·플러그인 스택을 전면 제거했다(145파일, −16,971줄). 지금 저장소에는
**게이트도, 사내 서비스 도구도, LLM 인증 경로도 없다.** 이 핸드오프가 그것을 다시 세운다.

재작성의 축은 0180 plan §목표 구조에서 확정됐다 — 아티팩트 `d801bbaf` 의 관찰
("opencode 레포엔 `idp/`·`oauth/`·`sso/`·`saml/` 폴더가 하나도 없다. 폴더는 *관계* 로 갈린다")를
따라, **프로토콜 enum 이 아니라 관계**를 1급 축으로 둔다:

| 관계 | 신원(principal) | 상대 | `kind` |
|---|---|---|---|
| 게이트 — 사내 ADFS ↔ Orca | ✓ 있음 | 고정 (사내 IdP 1곳) | `gate` |
| LLM — Orca ↔ 모델 게이트웨이 | ✗ (토큰만) | 고정 | `llm` |
| 서비스 — Orca ↔ 사내 REST | ✗ (토큰만) | 고정 | `service` |

구 구조가 무너진 이유는 `mechanisms: ['adfs_browser_session'|'pat'|'basic'|…]` 라는 **프로토콜
enum 이 1급 축**이라 `AuthMechanism` × `AuthTargetKind` × `CredentialPresentation` 이 곱해진 것이다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당 — 단 0180 이후 "문제" 가 바뀌었다** | 0180 전의 문제는 "복잡도" 였고 지금은 "**기능 부재**" 다. 게이트·Confluence·사용량이 전부 죽어 있다. 따라서 이번 판정 기준은 "얼마나 단순한가" 가 아니라 "**실사용 4종이 실제로 도는가**" 여야 한다 — 0157~0178 이 3라운드를 태운 이유가 정확히 이 기준을 안 세운 것이다(0178 §R3~R8: 실사용 4종 중 3종 미동작). |
| 이미 있는 것 아닌가 | **배관은 있다(git 에). 축은 없다** | 복원 가능한 검증된 자산 — `browser-session-store.ts` 367 · `credential-vault.ts` 108 · `authenticated-fetch.ts` 188 · `session-policy.ts` 134 · `policy.ts` 105(+test 128) · `credential.ts` 178 · confluence 순수 3종 576. **합 약 1,900줄을 새로 쓰지 않는다**(§설계 복원 표). |
| 더 작은 해법이 있는가 | **있다 — 그리고 그것을 택한다** | "provider 목록 + 인증 + 재인증" 만으로 요구가 충족된다. 0157 이 얹었던 것(manifest·ABI·conformance·transaction store·loginChain·cascade)은 **요구에 없다**. 이번엔 그것들을 만들지 않는 것이 설계다. |
| 인용 자료가 요구를 부풀리지 않았나 | **배제 완료** | `docs/etc/study/orca/` 는 사용자 지시로 근거에서 뺐고 0180 이 인벤토리에 ⚠️ 폐기 표기했다. opencode 사실은 아티팩트 4건, Orca 사실은 이번 세션 `파일:라인` 실측만 쓴다. |
| 기존 채택 결정을 뒤집는가 | **예 — 2건 뒤집는다** | ⓐ **0180 plan 의 "한 provider = 한 인증 방법"** (사용자 2차 결정이 뒤집음) ⓑ **0028 의 "LLM settings 의 secret-store 토큰 주입 폐지"** (LLM 통합 결정이 뒤집음). 상세는 §기존 결정·규칙과의 관계. |

### 이견 — 적고, 요구대로 진행한다

**"사용자도 인증 방식을 고른다" 는 0180 이 없앤 교차를 일부 되살린다.** `acceptedMethods[]` 교차를
없앤 근거가 "한 provider = 한 방법" 이었다. 다만 **되살아나는 것은 교차가 아니라 배열**이다 —
구 구조의 폭발은 *방식이 별도 레지스트리에 있고 대상이 **id 로 참조***해서 생겼다
(`validateCrossReferences`·미존재 참조·등록 순서 의존). 이번에는 `AuthSpec` 을 **provider 선언 안에
인라인**으로 두므로 참조 무결성 검증 자체가 성립하지 않는다. 비용은 GUI 의 "방식 선택" 한 단계뿐이다.

**요구 범위는 줄이지 않는다.**

### 사용자에게 올릴 것 (단독 결정 불가) — §Open Questions 참조

**4건 전부 "설계는 파라미터화, 값은 실기에서 확정"** 으로 진행 가능하다. 구현 착수를 막지 않는다.

## 자료조사 (Research)

> **모든 수치는 이번 세션에서 직접 측정했다** (승계 0건).

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **0180 직후 베이스라인** — lint 0 error/1 warn · typecheck 3/3 · vitest **171 파일(166/5) · 1,417 테스트(1,378/39)**. red 5 = `better_sqlite3.node` ABI(환경 제약) | `npm run lint`·`typecheck`·`./node_modules/.bin/vitest run` |
| R2 | **현재 표면** — IPC **71 채널** · contracts **6모듈** · features **9슬라이스** · settings **18 키** | `grep -cE "^\s+[a-zA-Z]+: 'orca:" shared/ipc.ts` = 71 · `ls` |
| R3 | **⚠️ LLM settings 는 `${VAR}` 확장을 하지 않는다.** 로더가 `env` 포함 전체를 **verbatim** 으로 돌려준다. 0028 이 "Orca 고유의 `${VAR}` 확장·secret-store 토큰 주입(구 0010/0015)은 **폐지했다** — Claude 정책 그대로" 라고 명시 | `adapters/claude-settings.ts:1-10,87-89` |
| R4 | **그러나 LLM 로 가는 secret 경로는 따로 있다** — `buildTurnEnv(ctx)` 가 `appEnv()`(orca.json)를 **MCP resolver 로 `${VAR}` 확장**해 subprocess env 를 만든다. resolver 는 vault(safeStorage) + `secrets.envAllowlist` 를 읽는다. **여기가 `materialize` 의 주입 seam 이다** | `app/chat-turn/turn-setup.ts:79-87` · `features/providers/env-merge.ts:9-24` · `features/extensions/mcp/resolver.ts` |
| R5 | **`buildTurnEnv` 는 현재 선택된 provider 를 모른다** — `ctx` 만 받는다. provider 별 credential 을 주입하려면 **`providerKey` 를 인자로 받아야 한다** | `turn-setup.ts:79` (`buildTurnEnv(ctx: RouterContext)`) |
| R6 | **`${BINDING:<대상>}` 프리미티브는 살아 있다** — `BINDING_PREFIX`·`BINDING_RE` 가 `infra/vars.ts` 에 그대로 있고, 0180 은 **resolver 의 토큰 소스만** 끊었다(항상 미해결 → 서버 드롭) | `infra/vars.ts:14-19` · `features/extensions/mcp/resolver.ts` |
| R7 | **복원 가능한 검증된 자산 = 약 1,900줄** — `browser-session-store` 367 · `authenticated-fetch` 188 · `credential.ts` 178 · `browser-session.ts`(방식) 166 · `session-policy` 134 · `policy.test` 128 · `credential-vault` 108 · `policy` 105 · `binding-store-file` 38 + confluence 순수 3종 576 | `git show 8965fa7:<path> \| wc -l` (14경로 실측) |
| R8 | **runtime-tool 포트가 기여자 0 으로 살아 있다** — `RuntimeToolRegistry`·`adapters/runtime-tools.ts`·`claude-runtime-tools.ts` 배선 유지. `Provider.tools` 가 채우면 즉시 LLM 에 노출된다 | `app/bootstrap.ts`(`runtimeTools`) · `features/extensions/runtime-tool-registry.ts` |
| R9 | **`UsageSourcePort` 가 optional 로 살아 있다** — `sources?: UsageSourcePort`. 주입만 되살리면 usage connector 구독 경로가 복구된다 | `features/usage/external-usage-service.ts:26` |
| R10 | **safeStorage 프리미티브 유지** — `infra/config/secret-store.ts`(31) + `crypto.ts`(25). vault 는 이 위의 **네임스페이스 뷰**일 뿐 | `wc -l` |
| R11 | **PKCE 는 여전히 0건** — 0180 이 지운 것이 아니라 **원래 없었다** | `rg 'code_verifier\|code_challenge'` → 0 |
| R12 | **채널↔문서 교차 가드가 71 로 고정돼 있다** — 채널을 늘리면 `IPC_CONTRACT.md §2` 헤더·도메인 합계·`CHANNELS` 길이 **3곳을 동시에** 고쳐야 테스트가 통과한다 | `shared/ipc-documentation.test.ts:9-22` |
| R13 | **`Settings.authBypass` 는 스키마에 남아 있고 읽는 코드가 0** — 0181 이 게이트를 세우면 다시 소비자가 생긴다 | `shared/ipc.ts` `Settings` · `infra/settings-migration.ts` |
| R14 | **구 ADFS 설정 형상** — `BrowserSessionConfig{id,label,sessionGroup,loginUrl,doneUrlPrefix,authenticationProbeUrl,allowedOrigins}`. 즉 구 설계는 **OAuth code→token 이 아니라 쿠키 세션**이었다 | `git show 8965fa7:…/methods/sso.ts` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 등록이 **중복 `id` 와 경로 있는 `origin` 을 거부**하고, 거부된 provider만 목록에서 빠진다(나머지는 등록된다) | `features/providers/auth/registry.test.ts::"중복 id 와 비-origin 을 거부한다"` | `app/bootstrap.ts` → `ProviderRegistry.register(PROVIDERS)` → `orca:provider:list` |
| 2 | `api-key`·`password`·`pat` 3종이 입력 → vault 봉인 → 재시작 후 `status:'valid'` 로 복원된다 | `features/providers/auth/login.test.ts::"코어 3종이 vault 왕복 후 valid 로 복원된다"` (vault 는 fake) | `orca:provider:login` → `ProviderStore.put` → 부팅 `restore()` |
| 3 | `oauth` 의 **PKCE `code_challenge` 가 `verifier` 의 S256 이고**, `state` 불일치 콜백은 거부된다 | `features/providers/auth/oauth.test.ts::"S256 대응"` · `::"state 불일치 거부"` | `orca:provider:login`(kind:'oauth') → `oauth.begin()` → 콜백 |
| 4 | `state` 가 **파일에 보관되어** 앱 재시작 후 도착한 콜백도 대조에 성공한다 | `features/providers/auth/oauth.test.ts::"재시작 후에도 state 가 대조된다"` (store 를 새 인스턴스로 재생성) | 루프백 리스너 → `oauth.complete()` |
| 5 | **한 provider 가 여러 `AuthSpec` 을 선언하면** GUI 가 선택지를 그 순서대로 내고, 고른 방식으로 인증한 grant 가 저장된다 | `features/providers/auth/login.test.ts::"복수 AuthSpec 중 고른 방식으로 인증한다"` + `renderer/features/skills/lib/providerRows.test.ts::"방식 선택지를 선언 순서로 낸다"` | `orca:provider:list` → 카탈로그 provider 탭 → 방식 선택 → `orca:provider:login` |
| 6 | **재인증**이 기존 grant 를 유지한 채 새 인증을 시도하고, **성공 시에만 교체**한다 (실패하면 기존 grant 가 살아 있다) | `features/providers/auth/login.test.ts::"재인증 실패는 기존 grant 를 보존한다"` | 카탈로그 provider 행 → [재인증] → `orca:provider:reauth` |
| 7 | `ProviderApi.request` 가 **미선언 origin·절대 URL·예약 헤더**(`authorization`/`cookie`/`proxy-authorization`) 덮어쓰기를 거부한다 | `features/providers/auth/policy.test.ts` (0180 이 지운 `policy.test.ts` 128줄을 이식) | `features/providers/service/` 도구 → `ProviderApi.request` |
| 8 | 게이트 판정 진리표 — **선언 0 → 통과** / 선언 N·미인증 → 차단 / 부분 인증 → 차단 / 전부 유효 → 통과 / dev bypass → 통과 | `features/providers/gate/gate.test.ts::"게이트 진리표 5케이스"` | `orca:provider:state` → `renderer/app/RootGate` |
| 9 | LLM provider 의 `materialize()` 결과가 **subprocess env 에 실제로 병합**되고, 미인증이면 그 키가 **드롭**된다(빈 문자열 치환 아님) | `app/chat-turn/turn-setup.test.ts::"선택된 provider 의 credential 이 env 에 병합된다"` · `::"미인증 provider 의 키는 드롭된다"` | `chat:send` → `buildTurnEnv(ctx, providerKey)` → SDK `Options.env` |
| 10 | MCP `${BINDING:<대상>}` 이 **다시 해소**되고, 미인증 대상은 여전히 미해결로 남아 서버가 드롭된다 | `features/extensions/mcp/resolver.test.ts::"토큰 소스 주입 시 대상을 해소한다"` · `::"미인증 대상은 미해결"` | `ensureDeployed()` → `.mcp.json` |
| 11 | `service` provider 의 `tools` 가 `RuntimeToolRegistry` 에 등록되어 **스냅샷에 나타나고**, 연결 해제 시 사라진다 | `features/providers/service/service.test.ts::"tools 가 registry 에 왕복 등록된다"` | `app/bootstrap.ts` → `adapters/claude-runtime-tools.ts` → SDK `createSdkMcpServer` |
| 12 | IPC 채널이 **77개**(71 + provider 6)이고 `IPC_CONTRACT.md §2` 헤더·도메인 합계가 **셋 다 77** 로 일치한다 | `shared/ipc-documentation.test.ts::"…count at 77"` | preload bridge → `renderer/shared/api/ipc.ts` |
| 13 | 게이트 provider 를 선언한 빌드에서 **로그인 전에는 메인 UI 가 렌더되지 않고**, 로그인 성공 후 진입한다 | **사람 실기 — 네트워크 완전환경 + 폐쇄망**. 실행: `SSO 설정을 채운 빌드로 npm run dev` → 로그인 화면 확인 → ADFS 로그인 → 메인 UI 진입 | `RootGate` → `orca:provider:state.gate` |
| 14 | 게이트 provider **0개인 dev/OSS 빌드가 게이트 없이 열린다** (회귀 방지 — 0180 이 지적한 안전장치) | `features/providers/gate/gate.test.ts::"선언 0 이면 통과"` + AC13 실기의 음성 대조 | 동일 |
| 15 | lint 0 error · typecheck 3/3 · vitest 실패 파일이 **DB ABI 5종뿐** | `npm run lint && npm run typecheck && ./node_modules/.bin/vitest run` — R1 과 대조 | 개발자·CI |

> AC13 은 유일한 사람 실기다. 실행 경로(SSO 설정을 채운 빌드)는 **§Open Questions 1 의 실값에
> 의존**하므로, 값이 없으면 이 AC 만 미충족으로 남기고 나머지 14건으로 판정한다(0019·0102 선례).

## 범위 / 비범위

- **범위**: `contracts/provider.ts` · 레지스트리 · grant 스토어(safeStorage) · 인증 4종 · PKCE/state 코어 ·
  `ProviderApi`(request/materialize) · 게이트 · LLM 조인 · service 도구 노출 · MCP 토큰 소스 복구 ·
  카탈로그 provider 탭(상태·재인증·해제) · 게이트 화면 · IPC 6채널 · 문서 동기화.
- **비범위**:
  - **MCP 서버 구현** — 아티팩트 `024a4677` 결론(별도 프로젝트).
  - **RFC 8414 discovery · RFC 7591 동적 클라이언트 등록** — 상대가 전부 고정이라 불필요(아티팩트 `c5b48b30`).
  - **자동 토큰 refresh** — 만료는 `status:'expired'` 강등 + 재인증으로 다룬다. 구 구조에서 `refresh` 는 3/3 이 `not_supported` 였다(0178 R4).
  - **SSO → MCP 직접 전달** — 0178 사용자 결정(별도 프로세스라 토큰이 기동 시점에 고정). MCP 에는 PAT/ID·PW 를 쓴다. 단 **게이트 세션으로 발급한 토큰**은 `${BINDING:}` 로 나갈 수 있다(AC10) — 그 토큰이 `service` provider 의 것이면 정상 경로다.
  - Confluence 도구 **기능 확장** — 0180 이 지운 것을 그대로 되살리는 선까지.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 자동 refresh | **아니오** — grant 에 `expiresAt`·`refreshKey` 자리를 지금 만들어 두므로 나중에 로직만 얹는다 |
| **IPC 채널 이름 `orca:provider:*`** | **예 — 일방향.** 채널명은 preload·renderer 계약이다. → **지금 확정**: `list`·`login`·`continue`·`reauth`·`revoke`·`state`(push) 6개 |
| **`Provider.id` 문자열** | **예 — 일방향.** vault 네임스페이스 키이자 `${BINDING:<id>}` 참조 대상이다. 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다. → **지금 확정**: 케밥 소문자, 배포가 정하고 **한 번 정하면 유지**(구 `sso.ts` 헤더가 같은 경고를 했다) |
| **vault 키 형식** | **예 — 일방향.** → **지금 확정**: `provider:<providerId>:<specKind>`. 0180 의 구 형식(`authBinding:<bindingId>:secret`)은 읽지 않는다(재로그인 요구, 0180 에서 결정 완료) |
| ADFS 실값 | **아니오** — 선언 파일 1개(`providers/sso.ts`)만 채우면 된다. 그래서 §Open Questions 가 착수를 막지 않는다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 복원해 쓰는 기존 모듈(§설계 복원 표) + `infra/config/secret-store.ts`(safeStorage) + `infra/net/`(전송) +
  `RuntimeToolRegistry`(R8) + `UsageSourcePort`(R9) + `infra/vars.ts`(R6).
- 전제(실측 확인): LLM 주입 seam 은 `${VAR}` 확장이 아니라 **`buildTurnEnv`** 다(R3·R4).
- **신규 의존성: 없음.** PKCE 는 Node `crypto`(`createHash('sha256')` + `randomBytes`)로 충분하다.
  `cheerio`·`turndown`·`turndown-plugin-gfm` 은 0180 에서 소비자 0 이 됐다가 **여기서 복원**된다.

## 설계

### 1. 단일 축 — `Provider`

```ts
// contracts/provider.ts — 폐쇄망 배포가 채우는 유일한 선언
interface Provider {
  id: string                        // 케밥. vault 네임스페이스이자 ${BINDING:<id>} 참조 대상
  label: string
  kind: 'gate' | 'llm' | 'service'  // ★ 관계. 프로토콜이 아니다
  origin: string                    // 이 provider 가 나갈 수 있는 origin (경로 없음)
  auth: readonly AuthSpec[]         // ★ 복수 — 선언 순서가 GUI 선택지 순서
  tools?: readonly ToolSpec[]       // kind:'service'
  llm?: { adapter: string; provider: string }  // kind:'llm' — sources/settings 디렉토리 키
}
```

**`auth` 가 배열인 것이 이번 개정의 핵심**(사용자 2차 결정). 빌트인 구현자가 여러 방식을
선언하고, 사용자가 GUI 에서 고른다. `auth.length === 1` 이면 GUI 는 선택 단계를 건너뛴다.

**구 구조와 다른 점**: 방식이 **별도 레지스트리에 있고 id 로 참조**되던 것을(→ `acceptedMethods`·
`validateCrossReferences`·등록 순서 의존) **선언 안 인라인**으로 바꿨다. 참조가 없으므로
무결성 검증도 없다. 런타임 검사는 여전히 **둘뿐** — 중복 `id`, `origin` 형태(AC1).

### 2. `AuthSpec` — 요구된 4종 + ADFS 2분기

```ts
type AuthSpec =
  | { kind: 'api-key';  label: string; fields: readonly FieldSpec[]; present: Presentation }
  | { kind: 'password'; label: string; fields: readonly FieldSpec[]; present: Presentation }
  | { kind: 'pat';      label: string; fields: readonly FieldSpec[]; present: Presentation }
  | { kind: 'oauth';    label: string; authorize(ctx: AuthCtx): Promise<OAuthStart> }
  | { kind: 'browser-session'; label: string; config: BrowserSessionConfig }   // ADFS/WIA
```

앞 3종은 **코어 구현**(0180 이 지운 `methods/credential.ts` 178줄 복원). 배포가 쓰는 것은
`fields` 선언과 `present`(헤더에 어떻게 싣는지)뿐.

**`browser-session` 은 사용자 2차 결정("둘 다 필요")으로 되살린다.** 구 `BrowserSessionConfig`
(`loginUrl`·`doneUrlPrefix`·`authenticationProbeUrl`·`sessionGroup`·`allowedOrigins`, R14) 를 그대로
쓴다 — 구현체(`browser-session-store.ts` 367줄)가 검증돼 있다.

```ts
interface OAuthStart {
  url: string
  redirect:
    | { kind: 'window'; isDone(url: string): boolean }   // 앱 내부 창
    | { kind: 'loopback'; port: number }                 // 127.0.0.1 (RFC 8252)
    | { kind: 'manual' }                                 // 코드 붙여넣기
  exchange(code: string): Promise<TokenGrant>
}
```

**PKCE·`state` 는 코어가 제공한다** — `ctx.pkce()` · `state` 생성/**파일 보관**/대조(AC3·AC4).
provider 마다 달라질 여지가 없는 진짜 공통이고, 각자에게 맡기면 한 곳만 빼먹어도 조용히 취약해진다.
`state` 를 파일에 두는 것은 루프백 콜백 전 앱이 재시작돼도 대조가 성립해야 하기 때문이다.

### 3. 게이트 → 토큰 교환 (사용자 "둘 다" 의 구체 형태)

```
① 게이트 로그인 (kind:'gate', AuthSpec:'browser-session')
     Electron 창 → doneUrlPrefix 도달 → probe 로 판정 → Grant{kind:'session', sessionGroup}
② 토큰이 필요한 곳 (kind:'llm' 또는 'service', AuthSpec:'oauth' 또는 전용)
     그 sessionGroup 의 cookie jar 로 사내 API 호출 → 토큰 수령 → Grant{kind:'token'}
```

②의 호출은 `BrowserSessionStore.send`(0178 이 추가한 표면 — 이전엔 probe 판정만 돌아와
본문이 빈 문자열이었다)를 쓴다. **교환 endpoint·응답 형태는 §Open Questions 2** 이므로
`Provider` 선언에서 `{path, valuePath, expiresAtPath}` 로 **파라미터화**한다.

### 4. Grant · 소비 표면

```ts
type Grant =
  | { kind: 'secret';  vaultKey: string }
  | { kind: 'token';   vaultKey: string; expiresAt?: number; refreshKey?: string }
  | { kind: 'session'; sessionGroup: string }

interface ProviderApi {
  request(providerId: string, req: Req, signal?: AbortSignal): Promise<Res>
  materialize(providerId: string): { env?: Record<string,string>; headers?: Record<string,string> } | null
  token(providerId: string): string | null   // MCP ${BINDING:} 용 — 동기 계약 유지
}
```

`providerId → Grant` **단일 맵**. `bindingId`·`parentBindingId`·cascade·fingerprint 없음.

### 5. LLM 조인 — 실측으로 정정된 주입 지점

> **0180 plan 의 서술("`${...}` 확장 경로에 주입")은 틀렸다** — LLM settings 는 `${VAR}` 를
> 확장하지 않는다(R3). 실제 seam 은 아래다.

```
sources/settings/<adapter>/<provider>/  ──(디렉토리 = 열거 SSOT, 불변)──> ProviderEntry
                                                                            │ join by llm:{adapter,provider}
                                                                            ▼
chat:send → turn-setup.buildTurnEnv(ctx, providerKey)                  Provider{kind:'llm'}
              ├ appEnv() ${VAR} 확장 (기존)                                  │
              └ providerApi.materialize(providerId).env  ◀───────────────────┘  (신규)
                          │  미인증이면 null → 그 키를 **드롭**(빈 문자열 치환 금지)
                          ▼
                  mergeEnvLayers → SDK Options.env
```

**디렉토리 = 열거 SSOT 는 깨지 않는다** — 모델 목록·기본 provider 선택·`crossesProviderBoundary`
respawn 판정이 전부 여기 걸려 있다. 조인만 한다.

`buildTurnEnv` 는 현재 선택 provider 를 모르므로(R5) **`providerKey` 인자를 추가**한다.

### 6. 복원 표 (새로 쓰지 않는 것 — 약 1,900줄)

| 복원 대상 (`git show 8965fa7:app/src/main/…`) | 줄 | 새 위치 |
|---|---|---|
| `infra/auth/browser-session-store.ts` | 367 | `infra/browser-session.ts` |
| `infra/auth/authenticated-fetch.ts` | 188 | `features/providers/auth/present.ts` |
| `features/auth-platform/methods/credential.ts` | 178 | `features/providers/auth/specs/credential.ts` |
| `features/auth-platform/methods/browser-session.ts` | 166 | `features/providers/auth/specs/browser-session.ts` |
| `infra/auth/session-policy.ts` | 134 | `infra/browser-session-policy.ts` |
| `features/auth-platform/policy.test.ts` | 128 | `features/providers/auth/policy.test.ts` (AC7 이식 원본) |
| `infra/auth/credential-vault.ts` | 108 | `infra/vault.ts` |
| `features/auth-platform/policy.ts` | 105 | `features/providers/auth/policy.ts` |
| `infra/auth/binding-store-file.ts` | 38 | `features/providers/auth/store-file.ts` |
| `modules/confluence/{storage-to-markdown,search-render,limit}.ts` | 576 | `features/providers/service/confluence/` |
| `modules/confluence/{rest,tools}.ts` | 309 | 동일 (InternalApi → `ProviderApi` 로 시그니처만 교체) |

### 7. 신규 모듈

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `contracts/provider.ts` | `Provider`·`AuthSpec`·`OAuthStart`·`Grant`·`ProviderApi`·`ToolSpec` | contracts | 타입 전용 — `satisfies` 가 컴파일 타임에 강제 |
| `features/providers/registry.ts` | 등록 + 중복 id·origin 형태 검사 | features | 순수 단위 (AC1) |
| `features/providers/auth/store.ts` | `providerId → Grant` + vault + 파일 영속 | features | 순수 단위 — vault·파일은 **주입 포트**(fake) |
| `features/providers/auth/login.ts` | 4종 실행 · provider당 pending 1건 · 재인증 | features | 순수 단위 (AC2·5·6) |
| `features/providers/auth/oauth.ts` | PKCE·state 생성/보관/대조 · redirect 3분기 | features | **순수부**(PKCE·state 대조)와 **I/O부**(창·리스너) 분리. 순수부만 단위 (AC3·4) |
| `features/providers/auth/api.ts` | `request`/`materialize`/`token` · 정책 · 401→expired | features | 순수 단위 — `fetchImpl` 주입 (AC7) |
| `features/providers/gate/index.ts` | 게이트 판정 진리표 · principal 추출 | features | **순수 단위** (AC8·14) |
| `features/providers/llm/index.ts` | 디렉토리 열거 ↔ provider 조인 · env 물질화 | features | 순수 단위 (AC9) |
| `features/providers/service/index.ts` | 사내 REST 호출 + `tools` 노출 | features | 순수 단위 — `ProviderApi` 주입 (AC11) |
| `infra/vault.ts` (복원) | safeStorage 네임스페이스 뷰 | infra | electron 의존 → **`crypto.ts` 뒤 포트로 주입**받아 fake 로 테스트 |
| `infra/browser-session.ts` (복원) | Electron Session/partition/로그인창 | infra | electron 직접 의존 — **판정은 `browser-session-policy.ts` 순수부로 분리**(구조 유지) |
| `infra/loopback-callback.ts` | 1회성 127.0.0.1 리스너 | infra | node `http` 만 씀 → 실제 포트 바인딩으로 단위 테스트 가능 |
| `app/handlers/providers.ts` | IPC 6채널 | app | 핸들러 등록 전수 대조(0179 선례) |
| renderer `features/providers/` | 게이트 화면 + 카탈로그 provider 탭 | renderer feature | 순수 로직(`providerRows.ts`)만 단위 (AC5) |

레이어 경계: 신규 feature 는 전부 `features/providers/` **한 슬라이스 안**이다(교차 import 0).
`app/bootstrap.ts` 가 concrete 를 주입하고, 소비 슬라이스(`extensions/mcp`·`usage`·`chat-turn`)는
`Pick<ProviderApi, …>` 구조적 포트로 좁혀 받는다 — 0180 이 지운 `contracts/internal-api.test.ts`
가드는 **되살리지 않는다**(포트가 하나뿐이라 재선언 유인이 없다).

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **"한 provider = 한 인증 방법"** (0180 이 `acceptedMethods` 교차를 없앤 근거) | `docs/handoff/0180-auth-plugin-teardown/plan.md §목표 구조` · 승인된 계획서 | §설계 1 "`auth: readonly AuthSpec[]`" | **뒤집음** — 사용자 2차 결정("사용자도 골라서 선택"). 단 **id 참조가 아니라 인라인 선언**이라 cross-reference 검증은 되살아나지 않는다(§이견) |
| **LLM settings 의 `${VAR}` 확장·secret-store 토큰 주입 폐지** ("Claude 정책 그대로") | `adapters/claude-settings.ts:4-6` (코드 주석, 0028) | §설계 5 "`materialize(providerId).env` 를 `buildTurnEnv` 에 병합" | **뒤집음** — LLM 통합 결정. 단 **settings.json 은 여전히 verbatim** 이고, 주입은 `Options.env` 레이어에만 한다. 0028 이 없앤 것(설정 파일에 토큰을 써 넣는 것)은 되살리지 않는다 |
| 중복 id 는 거부한다 (opencode last-writer-wins 비채택) | `git show 8965fa7:…/registry.ts:10-12` | AC1 | **유지** |
| 런타임 동적 로딩 금지 · 빌드타임 등록만 | `git show 8965fa7:…/contracts/auth-method.ts:12-14` | §비범위 "RFC 7591 동적 등록 제외" | **유지** |
| `sources/settings/<adapter>/<provider>/` 디렉토리 = 열거 SSOT | `features/providers/provider-registry.ts:53-84` (0014/0118) | §설계 5 "디렉토리 = 열거 SSOT 는 깨지 않는다" | **유지** — 조인만 한다 |
| main 원격 요청은 Chromium 스택, 전역 `fetch(` 는 `net-fetch.ts` 하나 | `app/src/main/AGENTS.md §원격 요청` · `security.md §1.8` | §의존 "`infra/net/`(전송)" | **유지** — 복원되는 `browser-session.ts` 는 Chromium 파일 3번째가 되므로 §1.8 의 "2개" 를 **3개로 되돌린다** |
| 게이트는 **선언 0 이면 통과** (dev/OSS 빌드가 열리지 않는 것을 막는 안전장치) | 0180 plan §로그인 게이트 · `security.md §1.7` | AC8·AC14 | **유지 — 회귀 테스트로 고정** |
| SSO → MCP 미지원 (별도 프로세스라 토큰이 기동 시점 고정) | 0178 사용자 결정 | §비범위 | **유지** |
| raw secret 이 나가는 문서화된 예외 2곳(MCP `.mcp.json` · LLM `--settings` argv) | `security.md §1.4-b` (0180 에서 제거 표기됨) | §설계 5 · AC9·AC10 | **복원 + 개정** — `Options.env` 가 세 번째 경로가 된다. §1.4-b 를 새 3계층으로 다시 쓰고 경계표에 이 줄을 **명시 추가**한다 |
| 마이그레이션 append-only | `scripts/check-migrations-appendonly.mjs` | (SQL 마이그레이션 없음) | **유지** |
| ESLint `boundaries` DAG · `import/no-cycle` | `app/eslint.config.mjs` | §설계 7 "한 슬라이스 안" | **유지** |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **부팅 순서 역전**: 0180 이 DB 초기화를 첫 단계로 만들었는데, 게이트가 돌아오면 renderer 가 창
  오픈 직후 `provider:state` 를 invoke 한다(구 0109/0157 제약). → **핸들러 조기 등록**을 되살리되
  DB 앞으로 옮기지 않는다 — 게이트 판정에 DB 가 필요 없다(grant 는 파일+vault).
- **게이트 실패·취소**: ADFS 창을 사용자가 닫으면 `failed`. 게이트 화면에 사유와 재시도를 두고,
  **재시도 루프에 갇히지 않게** 앱 종료 경로(타이틀바 닫기)를 항상 살려둔다.
- **부분 인증**: 게이트 provider 가 여럿이면 선언 배열 순서로 순차. 중간에서 실패하면 그 지점부터
  재개(앞의 grant 는 유지).
- **재인증 중 만료**: `reauth` 진행 중 기존 grant 가 만료되면 UI 는 `expired` 로 보이되 pending 은
  유지한다 — 성공 시 교체, 실패 시 `expired` 그대로(AC6).
- **토큰 만료와 MCP**: `${BINDING:}` 은 배포 시점 스냅샷이라 대화 도중 만료돼도 갱신되지 않는다
  (0178 이 SSO→MCP 를 미지원으로 결정한 이유). 만료된 토큰이 실린 서버는 도구 호출이 401 로
  실패하며, 그때 grant 가 `expired` 로 강등돼 GUI 에 나타난다.
- **provider 선언 제거**: 배포가 provider 를 지웠는데 grant 가 남아 있으면 **고아 grant** 다.
  부팅 복원 시 선언에 없는 id 는 조용히 무시하고 로그만 남긴다(삭제하지 않는다 — 선언이
  일시적으로 빠진 빌드에서 재로그인을 강요하지 않기 위해).
- **다중 창**: 현재 Orca 는 단일 윈도우다. 로그인 창은 modal-like 로 뜨고 pending 은 provider당 1건.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **K1 — `auth` 배열이 "선택 UI" 를 요구해 GUI 복잡도가 오른다** | `auth.length === 1` 이면 선택 단계를 건너뛴다. 폐쇄망 배포의 게이트는 대개 1종이라 실제 사용자는 선택 화면을 보지 않는다 |
| **K2 — LLM `Options.env` 주입이 raw secret 경로를 하나 늘린다** | 0028 이 없앤 "설정 파일에 토큰 기록" 은 되살리지 않는다. env 는 subprocess 수명에만 존재하고 디스크에 남지 않는다. `security.md §1.4-b` 경계표에 **명시 추가**해 표 밖 확산을 막는다 |
| **K3 — ADFS 실값 미상**(§OQ1·2) | 선언 파일 1개로 파라미터화. AC13 만 미충족으로 남기고 나머지 14건으로 판정한다 |
| **K4 — 복원 코드가 새 축과 안 맞을 수 있다** | 복원 대상 11건 중 **순수 모듈 5건**(policy·session-policy·confluence 3종)은 시그니처가 무관하다. 결합 있는 6건은 `InternalApi`→`ProviderApi` 치환이 전부다 |
| **K5 — 채널 3곳 동시 갱신을 빠뜨리면 테스트가 막는다**(R12) | AC12 가 그것을 그대로 게이트로 쓴다(막히는 것이 의도) |
| **K6 — 게이트 강제가 개발 빌드를 잠글 수 있다** | AC14 가 "선언 0 → 통과" 를 회귀로 고정. `Settings.authBypass`(R13)도 dev 경로로 되살린다 |

- 되돌리기 어려운 결정: **채널명 6개 · `Provider.id` 규약 · vault 키 형식** — 전부 §범위의 유예 표에서 **지금 확정**했다.
- **단독 결정 금지 항목** → §Open Questions.

## Open Questions (사용자 결정 필요 — 착수는 막지 않음)

| # | 질문 | 없으면 어떻게 진행하나 |
|---|---|---|
| **OQ1** | **ADFS 게이트 실값** — `loginUrl` · `doneUrlPrefix` · `authenticationProbeUrl` · `sessionGroup` · `allowedOrigins` | `providers/sso.ts` 를 `null` 로 두고 게이트 미등록(= 통과). 값이 오면 그 파일만 채운다 |
| **OQ2** | **토큰 교환 endpoint** — 게이트 세션으로 부를 사내 API 의 경로 · 응답 JSON 의 토큰 필드 경로 · 만료 필드 경로 | `{path, valuePath, expiresAtPath}` 로 파라미터화. 예시 값으로 테스트하고 실값은 실기에서 |
| **OQ3** | **서비스 provider 인벤토리** — Confluence 의 origin·컨텍스트 경로(DC 라면 `/confluence` 등), 사용량 API 의 origin | 선언 배열을 비워 둔다(현재도 빈 배열이라 동작 변화 없음) |
| **OQ4** ✅ **해결** | **OAuth 를 실제로 쓰는 대상이 있는가** | **사용자 답변(2026-08-10): "추후 사용 예정. 구현하라".** 따라서 AC3·AC4 를 **이월하지 않고 구현**했다(2단계). 배포 선언은 `declarations/llm.ts` 에 파라미터화된 형태로 두고 실값은 실기에서 채운다 — 게이트의 `sso.ts` 와 같은 형상이다. **소비자 0 이 아니다**: `login.ts` 의 `AuthSpec` 분기와 GUI 방식 선택이 실제 호출자이며, 회귀 23건이 그 경로를 덮는다 |

> **OQ4 는 해결됐다** — 최초 요구 문구의 "oauth(code→token)" 은 ⓐ(실제 표준 OAuth 를 쓰는 대상이
> 따로 있다)였다. 게이트=쿠키 경로와 **별개로** 표준 OAuth 를 구현했고, 둘은 `AuthSpec` 의 서로
> 다른 분기로 공존한다. PKCE·`state`·루프백은 코어가 갖는다 — 배포 선언은 `authorize(ctx)` 만 채운다.

## 영향 받는 파일

- 신설: `app/src/main/contracts/provider.ts` · `features/providers/{registry.ts,auth/*,gate/*,llm/*,service/*}` ·
  `infra/{vault,browser-session,browser-session-policy,loopback-callback}.ts` · `app/handlers/providers.ts` ·
  `app/src/renderer/src/features/providers/**`
- 수정: `app/bootstrap.ts`(배선) · `app/context.ts`(`providers` 필드) · `app/chat-turn/turn-setup.ts`(R5 시그니처) ·
  `features/extensions/mcp/{resolver,store}.ts`(토큰 소스 복구) · `features/usage/external-usage-service.ts`(`sources` 주입) ·
  `shared/{ipc,protocol}.ts`(채널 6 + DTO) · `preload/index.ts` · `renderer/src/shared/api/ipc.ts` ·
  `renderer/src/app/{RootGate,OverlayLayer,SidebarUserButton}.tsx` · `features/skills/**`(provider 탭 복원) ·
  `shared/i18n/resources/{ko,en}.ts` · `shared/ipc-documentation.test.ts`
- 문서: `IPC_CONTRACT.md`(§2 71→77 + provider 절) · `GLOSSARY.md`(Provider 표제어 신설) ·
  `arch/backend/security.md`(§1.4-b 3계층 재작성 · §1.7 게이트 · §1.8 Chromium 3파일 · §1.9) ·
  `arch/backend/overview.md` · `arch/frontend/overview.md` · **`guides/closed-network-extensions.md` 전면 재작성** ·
  `PHASES.md` · `app/AGENTS.md` · `app/src/main/AGENTS.md` · `docs/AGENTS.md` · `handoff/INDEX.md`

## 참고 문서

- 아티팩트 4건 — `c865512e`(authorize→callback 2단) · `d801bbaf`(관계 기준 폴더링) · `c5b48b30`(고정/임의 상대) · `024a4677`(MCP 서버 = 범위 밖)
- `docs/handoff/0180-auth-plugin-teardown/plan.md` (제거 인벤토리 · 복원 좌표)
- `docs/IPC_CONTRACT.md` §2·§6 · `docs/arch/backend/security.md` §1.4-b·§1.7·§1.8

## 게이트

- `cd app && npm run lint && npm run typecheck`, 그리고 `./node_modules/.bin/vitest run`.
- **`npm test` 는 쓰지 않는다** — `pretest` 가 ABI 를 Node 로 뒤집어 이후 `dev`/`build` 를 깨뜨린다.
- DB 로드 스위트 5종 red 는 환경 베이스라인(R1)으로 분리 보고한다.
- 신규 테스트: AC1~AC12·AC14 (13건). AC13 만 사람 실기.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 1차 4건 + **2차 3건**(ADFS 둘 다 · LLM 선택 주체 둘 · plan 만) 을 출처와 함께 인용
- [x] 자료조사 — R1~R14 전부 `파일:라인` 또는 실행 명령 레퍼런스
- [x] 의존 기술 — 신규 의존성 0. 0180 에서 소비자 0 이던 3종이 여기서 복원됨을 명시
- [x] 파생 UX — 부팅 순서·게이트 실패·부분 인증·재인증 중 만료·MCP 토큰 만료·고아 grant·다중 창 7건
- [x] 리스크 — K1~K6 + 되돌리기 어려운 결정 3건을 §범위 유예 표에서 **지금 확정**
- [x] **요구 비판적 검토 5질문**에 답했고, 이견(§이견)을 적었으나 **요구 범위를 줄이지 않았다**
- [x] 인수 기준 15건의 `검증 수단` 칸이 하나도 비지 않았다 (AC13 만 "사람 실기 — 실행 경로" 명시)
- [x] 부정형/"불변" 기준 0개 — 전부 양성 단언
- [x] **AC 끼리 모순 없음** — 짝지어 확인: AC8(선언 N 이면 차단) ↔ AC14(선언 0 이면 통과)는 **같은 진리표의 다른 행**이라 충돌 아님. AC10(토큰 소스 복구) ↔ §비범위(SSO→MCP 미지원)는 대상이 다르다(전자는 `service` provider 토큰, 후자는 게이트 세션). AC9(env 병합) ↔ §기존결정(0028 폐지 유지)은 **주입 레이어가 다르다**(`Options.env` vs settings.json) |
- [x] 인용 수치를 이번 세션에서 직접 측정 (승계 0). 복원 14경로 `git show … | wc -l` 실측
- [x] 신규 모듈 14건 전부 테스트 방법 기재. electron 의존 3건(`vault`·`browser-session`·`oauth` I/O부)에 **순수부 seam** 명시
- [x] 전수 조사 N 수치 — 채널 71(→77) · contracts 6 · 슬라이스 9 · settings 18 · 복원 11건/약 1,900줄
- [x] 각 AC 에 프로덕션 도달 경로 있음. **유일한 호출자가 테스트인 AC 0개** — AC11 은 `bootstrap`→`claude-runtime-tools`→SDK 까지 이어진다
- [x] "사람 실기" AC(AC13)의 실행 경로가 자기 비범위에 막히지 않음 — 게이트·ADFS 는 범위 안. 단 **OQ1 실값에 의존**함을 명시
- [x] 선택적 필드 판정 — `auth.length === 1` 분기(K1) · `materialize` 가 `null` 인 미인증 케이스가 **AC9 후반부**
- [x] 소비 계약의 제약 필드 강제 지점 — `origin`(등록 시 AC1 + 요청 시 AC7) · `Provider.id` 중복(등록 시 AC1) · 예약 헤더(요청 시 AC7)
- [x] 참조 구현(아티팩트) 대비 커버리지 — `AuthSpec` **5분기**(api-key·password·pat·oauth·browser-session)와 `redirect` **3분기**(window·loopback·manual)를 AC2·3·5·13 이 나눠 덮는다. 단 **OQ4 미해결 시 oauth 분기의 실사용자가 0** 임을 명시
- [x] 미룬 항목마다 일방향 여부 답변 (§범위 유예 표 5행 — 일방향 3건은 지금 확정)
- [x] **관문 4 를 본문 완성 후 돌렸다** — §기존 결정 표 10행을 본문 문장과 대조해 채웠고, 인용 경로(`claude-settings.ts:4-6`·`turn-setup.ts:79-87`·`external-usage-service.ts:26`·`vars.ts:14-19`·`ipc-documentation.test.ts:9-22`)를 전부 열어 확인
- [x] "확정돼 있다" 류 인용의 앵커 grep — `security.md §1.4-b`·`§1.7`·`§1.8`·`§1.9` 는 0180 이 **제거 표기로 재작성**한 상태임을 확인하고, 이번 작업의 산출물로 **재작성**을 §영향 파일에 넣었다

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

**구현 주체 = Claude** (환경에 Codex 부재 — 0160·0162·0163·0176·0179·0180 선례. 사용자 지시).

- **동의 / 그대로 진행**
  - **관계를 1급 축으로** 둔 것(§설계 1)이 이 설계의 핵심이고, 구현하면서 그 값이 드러났다. 구
    구조에서 3중 교차를 만들던 `acceptedMethods`·`validateCrossReferences`·등록 순서 의존이
    **코드로 쓸 자리 자체가 없었다** — 방식이 선언 안에 있으니 참조할 것이 없다. §설계 1 의
    "런타임 검사는 둘뿐" 은 문자 그대로 지켜졌다(`registry.ts` 40줄).
  - **복원 표(§설계 6)의 판단이 정확했다.** 순수 모듈 5건(policy·session-policy·confluence 3종)은
    **한 글자도 안 고치고** 들어왔고, 결합 있는 6건도 `InternalApi`→`ProviderApi` 치환이 거의
    전부였다. Confluence 테스트 144건이 이식 직후 전량 green 인 것이 그 증거다.
  - **LLM seam 정정(R3·R4)이 없었으면 구현이 헛돌았다.** `${VAR}` 확장 경로에 주입했다면
    settings 로더가 verbatim 이라 아무 일도 일어나지 않았을 것이다.
- **이견 / 우려 (기록)**
  - **AC 검증 수단의 경로가 §7 표와 두 곳에서 어긋났다**(아래 D1·D2). 설계 문서 안에서 같은
    모듈을 두 경로로 적으면 구현자가 어느 쪽이 의도인지 판단해야 한다 — plan self-review 의
    "경로 인용 대조" 항목이 §7 표까지 훑지는 않았다.
  - **`ProviderRequest` 가 §설계 4 에서 `{path, method, headers, body}` 4필드로만 서술됐다.**
    복원 대상인 Confluence `rest.ts` 는 `query`·`responseType`·`maxBytes` 를 쓰므로 그대로는
    이식이 불가능했다. 계약을 넓혀 해결했다(D5) — 설계가 복원 표와 계약을 짝지어 보지 않은 자리다.
  - **"약 1,900줄을 새로 쓰지 않는다" 는 절반만 맞다.** 복원은 그대로였지만 **연결 코드**
    (`api.ts`·`platform.ts`·`login.ts`·`oauth-runner.ts`·`service/index.ts`)가 새로 필요했다.
    분량 추정이 아니라 "무엇이 새로 필요한가" 를 세는 편이 정확했을 것이다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| **D1** | **레지스트리 경로가 plan 안에서 둘로 갈렸다** — AC1 은 `features/providers/auth/registry.test.ts`, §7 표는 `features/providers/registry.ts` | ✅ **AC 를 따랐다** → `features/providers/auth/registry.ts`. 부수 이득으로 기존 `features/providers/provider-registry.ts`(sources/settings 열거, 0014)와 **이름 충돌을 피한다** — 둘 다 "registry" 지만 하나는 LLM settings 열거, 하나는 `Provider` 선언 등록이다 | AC 가 검증 수단을 지목하므로 AC 쪽이 더 구속력 있는 서술이다 |
| **D2** | **renderer 위치가 둘로 갈렸다** — §7 은 `renderer/features/providers/`, AC5 는 `renderer/features/skills/lib/providerRows.test.ts` | ✅ **둘 다 맞고 책임이 다르다.** 게이트 상태·액션 = `features/providers/hooks/useProviderGate` · 게이트 **화면** = `app/GateFrame.tsx` · 카탈로그 provider 행 = `features/skills/lib/providerRows.ts` | ESLint `boundaries` 가 강제한다: `GateFrame` 은 `WinControls`(app)를 쓰므로 feature 에 두면 features→app 역방향이 된다. 카탈로그는 skills feature 소유라 provider 행도 거기 산다 |
| **D3** | **0180 이 `IPC_CONTRACT.md` 의 auth/plugin 절을 지우지 않았다** — §1 도메인 목록(23개)에 `auth`·`plugin` 이 남고 §2.13-c(auth 7채널)·§2.13-d(plugin 4채널)가 **현재형으로** 살아 있었다. 채널 총계만 71 로 맞춰져 있어 테스트는 통과했다 | ✅ 두 절을 **provider 1절(§2.13-c)로 치환**하고 도메인 목록을 22개(`auth`·`plugin` 제거 + `provider` 추가)로 고쳤다 | 문서가 없는 채널을 서술하면 다음 작업자가 그것을 근거로 코드를 붙인다 |
| **D4** | **`ProviderApi.request` 에 `query`·`responseType`·`maxBytes` 가 없어 Confluence 복원이 막혔다** | ✅ `ProviderRequest`/`ProviderResponse` 를 넓혔다(`query`·`responseType`·`maxBytes`·`bodyBytes`). 쿼리는 origin 판정 **후에** 붙이므로 정책이 헐거워지지 않는다 | 첨부 다운로드는 바이트·상한이 필수고, CQL 검색은 쿼리 파라미터가 본질이다 |
| **D5** | **전송 조각이 infra↔feature 사이에 끼었다** — 복원 대상 `authenticated-fetch.ts` 는 `PreparedRequest`·상한 검사(infra 성격)와 `Presentation` 적용(contracts 의존)을 한 파일에 갖고 있었고, `browser-session.ts`(infra)가 앞의 절반을 쓴다 → infra→feature 역방향 | ✅ **둘로 갈랐다**: `infra/net/transport.ts`(전송·상한, 도메인 타입 모름) + `features/providers/auth/present.ts`(`Presentation` 적용) | DAG 위반은 lint error 라 회피가 아니라 분해가 필요했다 |
| **D6** | **`RuntimeToolRegistry` 의 동등성 검사가 handler identity 까지 본다** — `Provider.tools(api)` 를 sync 마다 다시 부르면 형상이 같아도 revision 이 올라 **다음 턴이 런타임을 재spawn** 한다 | ✅ `ServiceToolRegistrar` 가 providerId 별로 조립 결과를 **캐시**한다. 회귀로 고정("반복 호출은 멱등이다") | 테스트가 처음에 실패해서 발견했다 — 함수형 `syncServiceTools` 를 클래스로 바꾼 이유 |
| **D7** | **grant 만료가 `token` 종류에만 있었다** — 401 관측으로 `secret` grant 를 강등할 자리가 없다 | ✅ `expiresAt` 을 `GrantBase` 로 올리고 `markExpired()` 를 뒀다. UI·게이트가 "지금 못 쓴다" 를 **한 가지 방식**으로 읽는다 | AC7 의 401 강등이 secret 방식에서도 성립해야 한다 |
| **D8** | **`orca:provider:state` 를 push 전용으로 두면 renderer 가 초기 스냅샷을 못 받는다** — 채널 6개는 일방향 확정 결정이라 늘릴 수 없다 | ✅ **한 채널을 양방향으로** 썼다(invoke=스냅샷, send=변화). 구 auth 가 `status`+`stateEvent` 로 나눠 두 벌을 동기화하던 것을 접은 형태다 | Electron 은 `ipcMain.handle` 과 `wc.send` 가 같은 채널명에서 충돌하지 않는다 |
| **D9** | **`ProviderStore` 가 없는 `RouterContext` 경로가 있다**(테스트 하네스) | ✅ `providers?` 를 **optional** 로 두되 없으면 "인증 없음" 으로 동작한다 — 조용한 성공이 아니라 조용한 **미인증**(fail-closed) | 필수로 두면 기존 테스트 하네스가 전부 깨지고, 기본값을 두면 미인증이 인증으로 보인다 |
| **D10** | **게이트 판정 전(`gate=null`)의 화면이 설계에 없었다** | ✅ **통과시키지 않고 부팅 화면을 유지**한다. main 이 잠깐 응답하지 못하는 사이 로그인 강제 빌드가 무인증으로 열리면 안 된다 | 구 auth 문서(§2.13-c)가 같은 규칙을 적고 있었다 — "renderer 는 prod 에서 invoke 실패를 `required:false` 로 기본화하지 않는다" |
| **D11** | **AC8·AC14(게이트 진리표)를 3단계로 미뤘는데 1단계의 `state()` 가 게이트 값을 필요로 했다** | ✅ 게이트 순수 모듈을 **1단계로 앞당겨** 구현했다(플레이스홀더를 뒀다가 나중에 갈아엎는 것보다 낫다). 3단계는 browser-session·정책·화면을 맡았다 | 단계 경계는 커밋 위생을 위한 것이지 설계 제약이 아니다 |
| **D13** (사용자 보고 2026-08-10, D12 후속) | **우회 토글을 꺼도 로그인 페이지가 뜨지 않았다.** D12 로 토글은 되살렸지만 기본 빌드는 게이트 선언이 0개라 `evaluateGate` 가 항상 `required:false` 를 준다 — **우회할 게이트가 없어 토글이 아무 일도 하지 않았고, 로그인 화면에 도달할 방법 자체가 없었다.** 구 코드는 `import.meta.env.DEV ? bypass \|\| authenticated : !required \|\| authenticated` 로 **DEV 는 게이트가 항상 켜져** 있었는데(0089→0130), 0181 이 그 분기를 prod 규칙 하나로 접으면서 사라졌다 | ✅ ⓐ `evaluateGate` 에 `alwaysRequired` 추가(호출부가 `import.meta.env.DEV` 주입 — 순수 모듈이 빌드 모드를 읽지 않게) ⓑ **빈 멤버 배열이 "전부 valid" 로 접히지 않게** 멤버 수를 함께 본다(`[].every` 는 true) ⓒ **구 `AuthView` 를 `GateLogin` 으로 복원** — Orca 제목·오르카 이미지(`orca-login.webp`)·입력 카드·검정 로그인 버튼. 화면이 0180 이전과 같아졌다 ⓓ 방식 선택 규칙을 `shared/config/providerAuth.ts` 로 올려 게이트 화면과 카탈로그가 같은 구현을 쓰게 했다(feature 교차 금지) | **중간 산출물(dev 더미 게이트)은 폐기했다** — 사용자가 "dev-gate 를 원하는 게 아니라 원래 운영하던 로그인 페이지" 라고 정정. 더미를 세우는 대신 *원래 DEV 규칙*을 복원하는 것이 맞았다. 회귀 5건 추가 |
| **D12** (사용자 보고 2026-08-10) | **게이트 우회 토글이 사라진 채였다.** `Settings.authBypass` 는 스키마·main 판정에 다 있었지만 **UI 가 없어 켤 수 없었다** — 0180 이 `AuthDebugSection` 을 지웠고 0181 이 main 쪽만 되살렸다. K6("게이트 강제가 개발 빌드를 잠글 수 있다")의 완화책이 실제로는 작동하지 않는 상태였다 | ✅ 셋을 함께 고쳤다: ⓐ `ProviderDebugSection` 복원 + `DebugPanel` 의 `providerSection` 슬롯 ⓑ **`GateFrame` 에서도 디버그 패널을 마운트**(구 `LoginFrame` 과 같은 이유 — 메인 셸에만 두면 게이트에 막혔을 때 스위치에 도달할 수 없다) ⓒ `settings:set` 이 `authBypass` 변경 시 provider 상태를 **push**(안 하면 설정만 저장되고 화면은 옛 판정에 머문다) | 설계 self-review 가 **"토글의 도달 가능성"** 을 보지 않았다 — 값·판정·소비자는 다 확인했지만 *우회가 필요한 상황에서 우회 스위치가 화면에 있는가* 는 질문 목록에 없었다. 회귀 9건 신설(`settings.test.ts` 3 · `bypassStore.test.ts` 6) |

## [구현자 기입] 구현 체크리스트

- [x] **1단계** — `contracts/provider.ts` · `auth/{registry,store,store-file,login,specs/credential}` · `infra/vault.ts` ·
      `gate/index.ts` · `platform.ts` · `declarations/{index,sso,llm,service}` · IPC 6채널(shared/preload/renderer) ·
      `app/handlers/providers.ts` · bootstrap 조기 등록 · 카탈로그 연결 탭 · `IPC_CONTRACT` 71→77
- [x] **2단계** — `auth/oauth.ts`(PKCE S256·state 발급/파일보관/대조·콜백 파싱) · `auth/oauth-runner.ts`(redirect 3분기) ·
      `infra/loopback-callback.ts` · OAuth pending 영속 · bootstrap 배선(기본 브라우저 + 앱 내부 창)
- [x] **3단계** — `infra/browser-session{,-policy}.ts` 복원 · `auth/specs/browser-session.ts`(세션→토큰 교환 포함) ·
      `auth/{policy,present,api}.ts` · `app/GateFrame.tsx` + `features/providers/hooks/useProviderGate` · `RootGate` 게이트 층
- [x] **4단계** — `buildTurnEnv(ctx, providerKey)` · MCP resolver 토큰 소스 · `app/usage-source.ts` ·
      `service/{index,confluence/*}` 복원 + `ServiceToolRegistrar`
- [x] **5단계** — `security.md`(§1.4-b 3계층+노출 3곳 · §1.7 게이트 · §1.8/§1.9 인벤토리) ·
      `closed-network-extensions.md` 전면 재작성 · `GLOSSARY`(Provider 표제어 5종 + 어휘 충돌 명시) ·
      arch overview 2종 · `PHASES` · AGENTS 3종 · i18n(ko/en) · plan/INDEX
- [x] **5단계-b (범위 추가 — 사용자 요청 2026-08-10)** — **`docs/arch/backend/providers.md` 신설**.
      "auth·plugin 을 어떻게 제거·구현했고 어떻게 쓰고 어떻게 등록하는가" 를 한 문서로 요구받았는데,
      그 답이 6개 문서 + 핸드오프 plan 2건에 흩어져 있어 **읽는 순서가 없었다**. 구조 SSOT 를 만들고
      기존 문서는 링크만 하게 정리했다(§1 제거 진단·인벤토리 · §2 축 · §3 모듈 지도 · §4 라이프사이클 ·
      §5 등록 · §6 소비 표면 4종 · §7 게이트 · §10 뒤집으면 안 되는 결정 · §11 비범위).
      라우팅: `ARCHITECTURE.md` · `docs/AGENTS.md` · `docs/guides/AGENTS.md`(stale 행 정정) ·
      `guides/closed-network-extensions.md` · `app/src/main/AGENTS.md` · `declarations/index.ts` 헤더
- [x] **5단계-c (버그수정 — 사용자 보고)** — 게이트 우회 토글 복원(D12): `ProviderDebugSection` ·
      `bypassStore` · `DebugPanel.providerSection` 슬롯 · **`GateFrame` 마운트** · `settings:set` push ·
      i18n(ko/en) · 회귀 9건 · `providers.md §8`·`security.md §1.7` 반영
- [x] **5단계-d (버그수정 — 사용자 보고)** — **DEV 게이트 도달성 + 원래 로그인 페이지 복원**(D13):
      `evaluateGate.alwaysRequired` · `GateLogin`(구 `AuthView` 복원 + `orca-login.webp`) ·
      `shared/config/providerAuth.ts`(feature 교차 해소) · 회귀 5건 · 게이트 진리표 문서 3곳 개정
- [x] **5단계-e (범위 추가 — 사용자 요청 2026-08-10)** — **게이트·확장 추가 절차를 단계별 안내로
      재구성**. 5단계-c·d 가 *동작* 을 바꿨는데 문서 동기화가 `arch/` 3곳(`providers.md`·
      `security.md §1.7`·`frontend/overview.md`)에서 멈춰, **절차 정본인
      `guides/closed-network-extensions.md` 가 구 동작(선언 0 → 항상 통과)을 서술**하고 있었다.
      동시에 그 문서에는 *타 에이전트가 그대로 실행할 단계·검증 명령* 이 없었다(사용자 요청의 핵심).
      ⓐ 가이드 전면 재구성 — §0 라우팅("플러그인" 요청을 provider 선언/MCP 로 번역) · §1 공통
      (**`features/providers/` 두 세입자 경고 신설** — 구 LLM 설정 슬라이스와 0181 인증 플랫폼이
      같은 디렉토리에 공존한다) · **레시피 4종**(§2~§5, 각 "단계 표 → 예제 → 필드/실수 표") ·
      **§6 개발 중 확인 신설**(DEV `alwaysRequired` · 우회 토글 2곳 마운트 · `settings:set` push ·
      게이트 화면 파일 지도 8종) · §8 검증 명령(ABI 가이드에 맞춰 `npm test` 대신
      `./node_modules/.bin/vitest run`) · **§9 트러블슈팅 12행 신설**
      ⓑ 드리프트 정정 — `GLOSSARY`(로그인 게이트 행 · `Plugin` 행에 라우팅 포인터) ·
      `IPC_CONTRACT`(§2.13-c 도입부 · `provider:state` 행 · `Settings.authBypass` 주석 ·
      `settings:set` 부수효과)
      ⓒ **유실 콘텐츠 복원(§10)** — 5단계의 가이드 전면 재작성이 구 §4 **"폐쇄망 빌드/자동
      업데이트 피드"**(0130/0133 — 사내 npm 미러 빌드 · `orca.json` `update` 4분기 s3/MinIO·
      generic·GHE·비활성 · 익명 GET 주의)를 통째로 떨어뜨렸고, `release-operations.md:62` 가
      **없는 절을 가리키는 dangling 참조**로 남아 있었다. 스키마를 코드(`infra/config/orca-file.ts`
      `provider: z.enum(['github','generic','s3'])` · `app/updater-feed.ts`)와 대조해 여전히
      유효함을 확인하고 §10 으로 복원 + 참조를 §10 으로 교정했다.
      ⓓ 라우팅 — `providers.md`(§3 두 세입자 경고 · §5 레시피 앵커 표) · `docs/AGENTS.md` ·
      `guides/AGENTS.md`(키워드 "로그인 게이트 추가"·"플러그인 추가"·"개발 중 로그인 화면" 보강)
      ⓔ **선언 파일 주석 예제 2건 정정 (사용자 지시 — 보고 후 수정 요청)**. 가이드가 이 파일들을
      "여기서 시작하라" 고 가리키는데 **예제 자체가 구현자를 오도**하고 있었다:
      · `sso.ts` — `origin` 이 IdP(`adfs.example.corp`)로 잡혀 있었다. `config.exchange.path` 는
        `Provider.origin` 기준 상대 경로라(`auth/specs/browser-session.ts` 의
        `new URL(exchange.path, origin)`) 토큰 교환을 쓰는 배포는 probe·교환이 사는 호스트여야
        한다 → `portal.example.corp` 로 고치고 **왜 그런지**를 주석에 박았다.
      · `service.ts` — `createConfluenceToolServer(api, { providerId, contextPath })` 는
        **실재하지 않는 시그니처**였다(실제: `(providerId, connectorLabel, runtime, ctx)` +
        `createConfluenceRuntime` 선행). 그대로 따라 쓰면 컴파일되지 않는다.
      **검증 방법**: 두 예제를 주석에서 꺼내 실제 선언 파일에 채워 넣고 `npm run typecheck`(3/3) +
      `npm run lint`(boundaries 0) 를 통과시킨 뒤 되돌렸다 — import 경로까지 실측으로 확정해
      (`../auth/specs/credential` · `../service/confluence/{connector,tools}`) 주석과 가이드 §4 에
      함께 실었다. **예제를 눈으로 읽지 않고 컴파일해 본 것이 두 번째 결함을 잡았다.**

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **코드 신설 24 · 복원 11 · 수정 20 · 문서 10**(5단계-b 의 `arch/backend/providers.md` 포함)**.** 신설 핵심: `contracts/provider.ts` · `features/providers/{platform,auth/*,gate/*,llm/*,service/*,declarations/*}` · `infra/{vault,loopback-callback,net/transport}.ts` · `app/{handlers/providers,usage-source,GateFrame}.ts(x)` · renderer `features/{providers/hooks,skills/{lib/providerRows,hooks/useProviders,components/customize/ProviderDetail}}`. 복원(8965fa7): `browser-session{,-policy}` · `auth/{policy,present}` · `specs/credential` · confluence 7모듈 |
| 실행 명령 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` (단계마다 반복) |
| 게이트 결과 | lint **0 error / 1 warn**(기존 `react-hooks/incompatible-library`) · typecheck **3/3** · vitest **190 파일(185/5) · 1,670 테스트(1,631/39)**. 실패 파일이 착수 전과 **동일한 DB ABI 5종**이고 실패 테스트 수도 39 로 같아 **신규 red 0**. 테스트 **+253건**(1,417→1,670), 파일 **+19**(171→190) |
| 인수 기준 | **14/15 충족.** AC13(사람 실기)만 미충족 — OQ1 ADFS 실값이 없어 게이트 provider 를 등록할 수 없고, egress 차단 환경에서 `npm run dev` 는 Electron ABI 재빌드에 막힌다(0180 AC9 선례) |
| 블로커 / 역질문 | **없음.** OQ1·OQ2·OQ3 는 설계대로 선언 파일 파라미터화로 흡수했다(`sso.ts`=null · `exchange:{path,valuePath,expiresAtPath}` · 빈 배열). 실값이 오면 **선언 파일만** 채우면 된다 |
| 대상 커밋 | `8b66f90`(1단계) · `f3b8798`(2단계) · `da5865b`(3단계) · `be9887c`(4단계) · `1c2ac66`(5단계 문서) · `5247080`(5단계-b) · `80728d7`(5단계-c) · `f7ccce9`(5단계-d) · 5단계-e 문서 커밋 |

> **5단계-b 의 판단 근거(기록)**: 문서 요청이라 새 핸드오프(0182)를 열 수도 있었으나, ⓐ 대상이
> 0181 이 방금 만든 것이고 ⓑ 0181 §영향 파일이 이미 문서 동기화를 범위에 두고 있으며 ⓒ 산출이
> arch 문서 1건 + 라우팅 6곳이라, **0181 을 이어가는 편이 맞다고 판단**했다. 새 plan 을 여는 것은
> 절차를 지키는 것이 아니라 절차를 연기하는 것이 됐을 것이다.
>
> **5단계-e 도 같은 판단(사용자 결정 2026-08-10)**: 새 핸드오프(0182) 대신 0181 을 잇는다 —
> 고칠 대상이 **5단계-c·d 가 남긴 자기 문서 드리프트**이고, 단계별 안내는 그 드리프트를 닫는
> 과정에서 같은 문서에 함께 들어가야 갈리지 않기 때문이다. 사용자는 "새 howto 문서 신설 금지,
> 기존 `guides/closed-network-extensions.md` 를 단계별로 재구성" 도 함께 결정했다.

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (verify/FAIL 시 신설) | | | |
