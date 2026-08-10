# Plan — 0180-auth-plugin-teardown

## 메타

| 항목 | 값 |
|---|---|
| slug | `0180-auth-plugin-teardown` |
| 작성자 | Claude Code |
| 일자 | 2026-08-10 |
| 매핑 | PHASES 신규 행 (0180) · 후속 `0181-provider-platform` |
| 상태 | DRAFT → READY |
| 구현 주체 | **Claude** (환경에 Codex 부재 — 0160·0162·0163·0176 선례. 사용자 지시) |
| 기준 HEAD | `8965fa7` (teardown 커밋의 부모 = Stage 2 복원 좌표) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "auth 및 플러그인 기능을 모두 제거 후 다시 재작성할것이다. opencode 사례를 확인하고 어떻게 구조화할지 우선 검토." | 라이브 세션 요청 (2026-08-10) |
| 명시 요구 (환경) | 윈도우 · 폐쇄망(사내망) · ADFS | 동일 |
| 명시 요구 (기능) | "llm provider, 일반 플러그인 provider(사내 서비스, 컨플루언스 등) 제공. 인증은 oauth(code→token) 혹은 id/passwd, PAT, api key 로 진행. 인증의 경우 로그인 게이트 용도로 사용할 수 있음." | 동일 |
| 명시 요구 (금지) | "**어설픈 재사용코드 플랫폼화 금지.**" | 동일 |
| 명시 요구 (GUI) | "모든 플러그인 서비스는 gui 노출 되어야 하며, 재인증 기능 가능해야함." | 동일 |
| 명시 요구 (참조) | 본 계정 아티팩트 4건 — `c865512e`(프로바이더 로그인 플로우) · `d801bbaf`(인증 디렉토리 지도) · `c5b48b30`(MCP OAuth IdP/SP) · `024a4677`(MCP 서버 구현체 없음) | Artifact 도구로 4건 전부 회수 |
| 명시 요구 (참조 정정) | "study 경로가 아니다. artifact 도구를 사용하라" — `docs/etc/study/` 를 근거로 쓰지 말 것 | 라이브 세션 정정 (2026-08-10) |
| 명시 요구 (결정) | 작업 분할 = **제거 → 재작성 2단계** · LLM provider = **통합** · 로그인 게이트 = **강제** · 플러그인 GUI = **기존 skills 카탈로그 유지** | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | 본 핸드오프(0180)는 그 2단계 중 **1단계(제거)만** 다룬다. 재작성 설계는 승인된 계획서에 있고 `0181` 이 받는다. | 위 "2단계" 결정에서 파생 |

## Context (왜)

인증/플러그인 계층은 `0157`(플랫폼화) → `0178`(축소, 1,603줄 제거)를 거쳤는데도 사용자가 같은 불만을
반복했다. 축소로 닫히지 않은 이유는 남은 복잡도가 **코드 양이 아니라 4개 축의 교차**이기 때문이다:

```
AuthMethod(id, groupId, targets[], mechanisms[], allowedOrigins[])
  × ConnectorRuntime(id, acceptedMethods[], baseUrl, presentation)
  × Binding(id, target, mechanism, artifact, parentBindingId)
  × PluginHost × ConnectionRegistry × TransactionStore × loginChain
```

`validateCrossReferences`(acceptedMethods 참조 무결성) · `loginChainFor`(groupId 순차) ·
`parentBindingId` cascade · connect fingerprint 가 **전부 이 교차에서 파생**됐다.

그 대가에 비해 실제로 동작하는 것이 거의 없다(§자료조사 R4~R8). 이 핸드오프는 그것을 걷어내
**앱이 빌드·구동되고 게이트가 통과하는 상태**로 만든다. 재작성(관계 축 재설계)은 `0181` 이 받는다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당 — 원인을 실측으로 확정** | 증상="어설픈 재사용 플랫폼화". 원인은 양이 아니라 축의 교차다. 0178 이 1,603줄을 지웠는데도 같은 불만이 나온 것이 증거다. 교차는 계약에 박혀 있어 뺄셈으로 안 닫힌다 — `InternalApi` 하나가 **17파일**(R11)에, `ConnectorRuntime` 이 **16파일**(R12)에 걸려 있다. |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **부분적으로 "있다" — 단 재사용 대상은 축이 아니라 배관** | PAT/basic 구현(`methods/credential.ts` 178) 과 ADFS 세션 배관(`infra/auth/browser-session-store.ts` 367)은 **동작하는 자산**이다. 버리는 것은 그 위의 *축 구조*지 배관이 아니다 — 0181 이 배관을 복원해 쓴다(§범위의 복원 좌표). |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **따져봤고, 이번엔 불충분** | 축을 그대로 두고 더 빼는 길 = 0178 이 이미 한 것이고 결과가 지금이다. 축을 in-place 로 바꾸는 길도 있으나 그것이 곧 0181 이며, **사용자가 2단계 분할을 명시 선택**했다. |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 자료를 근거에서 배제** | 0157 요구명세(`etc/study/orca/…`)는 0178 이 이미 3건(달성 불가 불변식·실재하지 않는 요구·미검증 전제)을 정정한 이력이 있다. 이번엔 **사용자 지시로 study 경로를 근거에서 뺐다** — opencode 사실은 아티팩트 4건, Orca 사실은 이번 세션 `파일:라인` 실측만 쓴다. |
| 기존 채택 결정을 뒤집는가 | **예 — 3건 뒤집고 2건 유지** | 상세는 §기존 결정·규칙과의 관계 (관문 4 에서 본문 대조 후 작성). |

- **이견 (적고, 요구대로 진행한다)**: Stage 1 종료 시점에 **로그인 게이트가 없고** Confluence·사내 usage 도구가
  중단된다. 폐쇄망 배포 관점에서 이 중간 상태는 릴리스 가능한 형상이 아니다. → **완화**: 0180 과 0181 사이에
  `v*` 태그를 만들지 않는다(§리스크 K1). 요구 범위는 줄이지 않는다.
- **사용자에게 올릴 것**(단독 결정 불가): **없음.** 4개 결정(분할·LLM 통합·게이트·GUI 위치)은 이미 받았고,
  0181 이 물을 항목(ADFS 실값·redirect 방식·루프백 포트)은 이 핸드오프 범위 밖이다.

## 자료조사 (Research)

> **모든 수치는 이번 세션에서 직접 측정했다** (승계 0건). 0178 의 R14(215파일/2045테스트)와 다르며,
> 그 차이 자체가 승계 금지의 근거다.

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **제거 대상 prod 규모** — `features/auth-platform/` 4,569 (최상위 2,065 + `methods/` 416 + `modules/` 2,088, **검산 2065+416+2088=4569 ✓**) · `features/connectors/` 768(테스트 포함) · `infra/auth/` 1,114 · `contracts/{auth-method,internal-api,connector}` 297 · `app/{handlers/auth,handlers/plugins,auth-restore,usage-source}` 262 | `find … \| xargs wc -l` |
| R2 | **renderer 규모** — `features/auth/` 445 · `features/skills/` 2,995(스킬·MCP 공용 셸 포함, 통째 삭제 불가) | 동일 |
| R3 | **IPC 채널 총 82** — 그중 auth 7 + plugin 4 = **11** 제거 대상 → 잔여 **71** | `shared/ipc.ts:100-113` · `grep -cE "^\s+[a-zA-Z]+: 'orca:"` = 82 |
| R4 | **SSO(ADFS) 는 등록조차 안 된다** — `SSO_CONFIG` 가 `null` 이면 방식 미등록 → 게이트가 동작한 적 없음 | `features/auth-platform/methods/sso.ts` |
| R5 | **OAuth code→token 교환이 코어에 없다** — `oauth_*` mechanism 은 0178 에서 삭제. 확장점(`ctx.fetch`)만 남음 | `contracts/auth-method.ts:99` |
| R6 | **PKCE 는 저장소 전체에 0건** | `rg 'code_verifier\|code_challenge'` → 0 |
| R7 | **자동 refresh 없음** — 401 → `expired` 강등 후 재로그인 | `features/auth-platform/api.ts` · `login.ts` |
| R8 | **등록되는 connector 서버 목록이 비어 실사용 0** | `modules/{confluence,usage}/servers.ts` |
| R9 | **`infra/auth/net-{fetch,request,response}.ts` 는 auth 가 아니라 main 전체의 원격 전송 스택** — auth 밖 소비자가 `app/bootstrap.ts:44,252,479` · `features/usage/external-usage-service.ts:22` | `rg` (auth 디렉토리 제외) |
| R10 | **가드 테스트는 파일명 기준이라 이설이 안전하다** — `ALLOWED = new Set(['net-fetch.ts'])`, 스캔 루트 `MAIN_ROOT = join(__dirname,'..','..')` = `src/main`. `infra/net/` 로 함께 옮겨도 루트가 그대로 `src/main` 이다 | `infra/auth/no-node-fetch.test.ts:18,21` |
| R11 | **`InternalApi` 참조 = 17파일** (전수) — 그중 auth 밖은 `features/extensions/mcp/resolver{,.test}.ts` · `features/connectors/runtime{,.test}.ts` · `app/bootstrap.ts` | `rg -l InternalApi --include=*.ts` |
| R12 | **`ConnectorRuntime`/`contracts/connector` 참조 = 16파일** (전수) | 동일 |
| R13 | **usage 의 `sources` 는 optional 이라 주입 제거가 안전** — `sources?: UsageSourcePort`(26행), 해소는 `module.usage.provider` → `module.usage.config` 폴백(121-123행). 게다가 `STATIC_USAGE_PROVIDER_MODULES = []` 라 정적 provider 도 0 | `features/usage/external-usage-service.ts:26,121-123` · `features/providers/static/modules/index.ts` |
| R14 | **runtime-tool 포트는 auth 밖 소비자가 있다** — `features/extensions/{builder,runtime-tool-registry}.ts` · `app/{bootstrap,context}.ts`. `infra/config/paths.ts:64` 매치는 **주석**이라 소비자 아님 | `rg -l` 후 개별 확인 |
| R15 | **Confluence 순수 변환기 3종은 외부 레이어 import 0건** — `storage-to-markdown.ts` 369 · `search-render.ts` 131 · `limit.ts` 76 = **576줄**. 반면 `connector.ts`·`rest.ts`·`tools.ts`·`download-store.ts`·`index.ts` 는 결합 있음 | 파일별 `grep -cE "^import .*(contracts/\|infra/auth\|InternalApi\|\.\./\.\./)"` |
| R16 | **renderer 소비자 = 13파일** (전수). 앞선 검토에 없던 **`features/debug/components/DebugPanel.tsx`** 포함 | `rg -l 'authApi\|pluginApi\|APPLICATION_TARGET\|features/auth\|useConnectorConnect\|usePluginCatalog' renderer/src` |
| R17 | **삭제 대상 테스트 = 35파일** — auth-platform+connectors 22 · `infra/auth` 4(`authenticated-fetch`·`binding-records`·`browser-session-store`·`credential-vault`) · `app` 3 · `contracts` 1 · renderer 4 · shared 1. **이설 2파일**(`net-response.test.ts`·`no-node-fetch.test.ts`) | `find … -name '*.test.ts'` |
| R18 | **채널 수 ↔ 문서 교차 가드가 이미 있다** — `CHANNELS` 길이와 `IPC_CONTRACT.md §2` 헤더·도메인 합계 3곳을 한 테스트가 대조한다 | `shared/ipc-documentation.test.ts:9-22` |
| R19 | **문서 stale 확정** — `IPC_CONTRACT.md:119-120` 이 `connectorInstances`·`pluginAddEnabled` 를 설명하는데 **코드 실재 0건**. `GLOSSARY.md` 는 죽은 심볼(`auth-plugin.ts`·`connector-plugin.ts`·`AuthProviderV1`·`ConnectorRuntimeV1`·`AUTH_PLUGIN_PACKAGES`·`connectorInstances`)을 **4행**에서 인용 | `rg` 결과 0건 · 해당 계약 파일 4종 `없음` 확인 |
| R20 | **게이트 베이스라인 (이번 세션 실측, 2회 재현)** — lint **0 error / 1 warning**(0102 known) · typecheck **exit 0** · vitest **206 파일(201 pass / 5 fail) · 1,914 테스트(1,875 / 39)**. red 5 = `app/chat-turn.continuity` · `features/extensions/builder` · `features/orchestration/fork` · `infra/db/migrate` · `infra/db/queries`, 전부 `better_sqlite3.node` **Module did not self-register** | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` |
| R21 | **`app/AGENTS.md` 의 "DB 로드 스위트 6파일" 은 실측 5파일** — 목록도 다르다(`features/history/writer`·`features/chat/recovery` 는 green). 0178 R15 가 같은 지적을 했으나 문서가 안 고쳐졌다 | R20 실측 vs `app/AGENTS.md §제약 환경` |
| R22 | **`node_modules` 부재는 조사 제약이 아니었다** — `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 가 exit 0 으로 완료돼 게이트 3종을 전부 실측할 수 있었다 (P12 선례 0150 과 동일) | 이번 세션 실행 |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `CHANNELS` 가 **71개**이고 `docs/IPC_CONTRACT.md §2` 의 헤더 총계·도메인 분포 합계가 **둘 다 71** 로 일치한다 | `src/shared/ipc-documentation.test.ts::"keeps the header, domain summary, and CHANNELS count at 71"` (기존 테스트의 82→71 갱신) | `preload/index.ts` bridge → `renderer/src/shared/api/ipc.ts` — 제거된 채널을 부르는 코드가 남으면 typecheck 가 실패한다 |
| 2 | 원격 전송 스택이 `src/main/infra/net/` 에 있고, 전역 `fetch(` 를 부르는 파일이 `net-fetch.ts` **하나**로 유지된다 | `src/main/infra/net/no-node-fetch.test.ts::"main 프로세스는 Node 전역 fetch 를 쓰지 않는다"` (이설, `ALLOWED`·스캔 루트 불변) | `app/bootstrap.ts` → `ExternalUsageService.fetchImpl` · `app/updater.ts` |
| 3 | `ExternalUsageService` 가 `sources` 주입 **없이** `provider`/`config` 경로로 사용량 리포트를 산출한다 | `src/main/features/usage/external-usage-service.test.ts::"sources 없이 provider·config 경로로 리포트를 만든다"` (신규 케이스) | `app/bootstrap.ts` → `UsageTracker` → `orca:cost:usage` → 설정 사용량 탭 |
| 4 | MCP 리졸버가 토큰 소스 주입 **없이** `${VAR}` 확장만으로 서버를 배포 대상에 포함시킨다 | `src/main/features/extensions/mcp/resolver.test.ts::"토큰 소스 없이 \${VAR} 서버를 해소한다"` | `app/bootstrap.ts` → `ExtensionDeploymentService.ensureDeployed()` → `~/.config/orca/dist/<engine>/plugins/orca/.mcp.json` |
| 5 | `RuntimeToolRegistry` 가 기여자 0 상태에서 **빈 스냅샷**을 반환하고 등록/해제 API 가 그대로 동작한다 | `src/main/features/extensions/runtime-tool-registry.test.ts::"기여자가 없으면 빈 스냅샷을 낸다"` | `app/bootstrap.ts` → `adapters/claude-runtime-tools.ts` → SDK `createSdkMcpServer` |
| 6 | 카탈로그 탭과 사이드바 nav 가 **skills·mcp 2종**으로 줄고, 두 목록 테스트가 그 구성을 단언한다 | `renderer/src/app/navItems.test.ts::"…"` + `renderer/src/features/skills/lib/catalogGroups.test.ts::"…"` | `app/Sidebar.tsx` → `ExtensionsCatalogView` (모달, `path:null`) |
| 7 | `rg 'connectorInstances\|pluginAddEnabled\|AuthProviderV1\|ConnectorRuntimeV1\|AUTH_PLUGIN_PACKAGES' docs/ app/src` 가 **0건**이다 (R19 의 stale 서술 제거 완료) | 에이전트 게이트 — verify 에서 위 명령 실행, 기대값 0 | `docs/GLOSSARY.md`·`docs/IPC_CONTRACT.md` 를 읽는 후속 에이전트 |
| 8 | vitest 실행에서 **실패 파일이 정확히 DB ABI 5종**(`chat-turn.continuity`·`extensions/builder`·`orchestration/fork`·`db/migrate`·`db/queries`)이고, lint 는 0 error, typecheck 는 exit 0 이다 | `cd app && npm run lint && npm run typecheck && ./node_modules/.bin/vitest run` — 실패 파일 목록을 R20 과 대조 | 개발자·CI(`.github/workflows/ci.yml`) |
| 9 | 앱이 로그인 게이트 없이 기동해 새 세션에서 채팅 1턴이 정상 완료된다 | **사람 실기 — 네트워크 완전환경**(0019·0102 선례). 실행: `cd app && npm run dev` → 앱 창 → 새 대화 → 메시지 전송 → 어시스턴트 응답 수신 | `index.ts` → `Bootstrap.start()` → `registerChatHandlers` → `chat:send` |

> AC9 의 실행 경로는 본 핸드오프 **범위 안**이다 — Stage 1 은 채팅 경로를 건드리지 않으므로 실기가 자기
> 비범위에 막히지 않는다. 다만 egress 차단 환경에서는 `npm run dev` 가 Electron ABI 재빌드에 막히므로
> **CI/사람 몫**으로 명시한다(R20·`app/AGENTS.md §제약 환경`).

## 범위 / 비범위

- **범위**: auth-platform·connectors 슬라이스 삭제 · 계약 3종 삭제 · `infra/auth` 의 auth 전용 6모듈 삭제 ·
  전송 스택 `infra/net/` 이설 · IPC 채널 11종과 preload/renderer 소비자 제거 · bootstrap 배선 제거 ·
  문서 동기화(IPC_CONTRACT·GLOSSARY·security·closed-network-extensions·AGENTS 3종·PHASES·INDEX).
- **비범위**: 새 `Provider` 계약·OAuth/PKCE·게이트 재구현·GUI 재작성 → **전부 `0181`**.
  MCP **서버** 구현(아티팩트 `024a4677` 결론 — 별도 프로젝트). RFC 8414 discovery·RFC 7591 동적 등록.

**Confluence 순수 로직은 이동하지 않고 삭제한다.** 0181 이 `git show` 로 복원한다 —
Stage 1 에서 옮겨두면 **소비자 0인 코드**가 남아, 이번 작업이 없애려는 바로 그 냄새를 만든다(관문 2 규칙 1-b).

복원 좌표 (0181 이 쓴다):

```
git show 8965fa7:app/src/main/features/auth-platform/modules/confluence/storage-to-markdown.ts   # 369줄
git show 8965fa7:app/src/main/features/auth-platform/modules/confluence/search-render.ts          # 131줄
git show 8965fa7:app/src/main/features/auth-platform/modules/confluence/limit.ts                  #  76줄
# 짝 테스트도 같은 커밋에서 (storage-to-markdown.test.ts · search-render.test.ts · limit.test.ts)
```

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 새 `Provider` 계약·채널 이름(`orca:provider:*`) | **아니오** — 0181 에서 처음 도입되는 이름이고, Stage 1 이 옛 채널을 이미 지우므로 저장된 소비자가 없다 |
| vault 키 네임스페이스 변경(`authBinding:<id>:secret` → 신규) | **예 — 일방향.** 기존 사용자의 봉인 비밀이 읽히지 않게 된다. → **지금 결정 기록**: 마이그레이션 없이 폐기하고 재로그인을 요구한다. 근거: SSO 미설정(R4) + 서버 목록 공백(R8)이라 실사용 grant 가 사실상 없다 |
| `Settings.authBypass` 키와 `ssoBypass→authBypass` 마이그레이션 규칙 | **아니오** — **유지한다.** 게이트가 없는 동안 무효 필드가 되지만, 구버전 설정 파일 호환을 깨면 되돌리기 어렵다. 0181 이 다시 소비한다 |
| Confluence 순수 변환기 576줄 | **아니오** — git 에 남고 복원 좌표를 위에 박았다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈에 기댄다: `shared/ipc-documentation.test.ts`(채널↔문서 가드, R18) · `infra/auth/no-node-fetch.test.ts`
  (이설 대상, R10) · `features/extensions/runtime-tool-registry.ts`(포트 존속, R14).
- 전제: `sources` 가 optional 이라 usage 가 살아남는다(R13). 가드가 파일명 기준이라 이설이 안전하다(R10).
- **신규 의존성**: **없음.** 오히려 `cheerio`·`turndown`·`turndown-plugin-gfm` 3종이 **소비자 0** 이 된다
  (`storage-to-markdown.ts` 전용, 0160 승인분) → 0181 이 되살리므로 `package.json` 에서 **제거하지 않는다**.

## 설계

접근: **의존 역순으로 잘라 내려간다.** 위(renderer)부터 끊어야 중간 단계마다 typecheck 가 의미 있는 신호를 준다.

| 단계 | 대상 | 근거 |
|---|---|---|
| 1 | renderer — `features/auth/` 전량 · `app/{RootGate,LoginFrame,SidebarUserButton,OverlayLayer}` 참조 · `features/debug/components/DebugPanel.tsx`(R16 신규 발견) · `features/skills` 커넥터 UI · `shared/api/ipc.ts` 의 `authApi`/`pluginApi` · i18n `login.*`·`pluginDetail.*` | 소비자가 가장 바깥 |
| 2 | `preload/index.ts:264-290`(auth 7 + plugins 4) · `shared/{ipc,protocol}.ts` 채널·zod·DTO | renderer 가 비어야 안전 |
| 3 | `app/handlers/{auth,plugins}.ts` · `app/{auth-restore,usage-source}.ts` · `app/context.ts` 필드 4종 | IPC 표면 제거 후 |
| 4 | `app/bootstrap.ts` — `createAuthPlatform`(199-292) · `restoreAuthConnections`(294-315) · `attachBindings`(338) · 소비 지점(409·483-485·525-526) | 컴포지션 루트 |
| 5 | `features/auth-platform/**` · `features/connectors/**` | 배선이 끊긴 뒤 |
| 6 | `contracts/{auth-method,internal-api,connector}.ts` + `internal-api.test.ts` | 참조 0 확인 후 |
| 7 | `infra/auth/` 의 auth 전용 6모듈 삭제 + **`net-{fetch,request,response}.ts` 와 `no-node-fetch.test.ts` 를 `infra/net/` 으로 이설** | R9·R10 |

**절대 지우지 말 것** (근거는 R9·R13·R14):

- `infra/auth/net-{fetch,request,response}.ts` + `no-node-fetch.test.ts` → **이설**. updater·usage 가 여기 걸려 있다.
- `adapters/{runtime-tools,claude-runtime-tools,runtime-tool-policy}.ts` + `features/extensions/runtime-tool-registry.ts`
  → 포트 유지, 기여자만 0. 0181 의 `Provider.tools` 가 다시 채운다.
- `contracts/usage-source.ts` + `features/usage/**` → `sources` **주입만** 끊는다(R13).
- `adapters/error-classifier.ts` 의 `auth_error` → `AuthExpiredModal` 경로. 이름만 auth 이고 코드 경로가 겹치지 않는다.
- `features/extensions/**`(Claude Code plugin 배포) — `GLOSSARY.md:31` 의 "plugin 3레지스터" 중 다른 축.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `src/main/infra/net/{net-fetch,net-request,net-response}.ts` | 원격 전송 스택 (이설 — 신규 로직 0) | `infra` | `net-response.test.ts` 순수 단위(이설). `net-fetch`·`net-request` 는 electron 직접 의존이라 **떼어낼 순수부가 이미 `net-response.ts` 로 분리돼 있다**(0174) — 추가 seam 불필요 |
| `src/main/infra/net/no-node-fetch.test.ts` | 전역 `fetch(` 위생 가드 (이설) | `infra` | 소스를 문자열로 읽기만 한다 — electron 미import 라 vitest 에서 그대로 돈다(R10) |

레이어 경계: 이설은 `infra/auth/` → `infra/net/` 로 **같은 레이어 내 이동**이라 `boundaries` DAG 에 영향이 없다.
`import/no-cycle` 도 새 순환을 만들지 않는다(전송 스택은 `shared` 외 의존이 없다).

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| 폐쇄망 확장점 = `contracts/auth-plugin.ts`·`connector-plugin.ts`·`usage-report.ts` + opt-in 레지스트리 2곳 | `docs/guides/closed-network-extensions.md` §0·§1 | §설계 단계 5·6 "`features/auth-platform/**` 삭제" · "`contracts/{auth-method,internal-api,connector}.ts` 삭제" | **뒤집음** — 확장점이 사라진다. 0181 이 `Provider` 선언 하나로 대체하므로 이 가이드는 **0181 에서 재작성**한다. 0180 은 "0180 에서 확장점 제거, 0181 대기" 문구만 남긴다 |
| 인증 방식 진입점 = 3함수(`authenticate`·`status`·`revoke`), 형태 강제는 `satisfies` | `contracts/auth-method.ts:1-28` (계약 헤더) | §설계 단계 6 | **뒤집음** — 계약 자체를 지운다 |
| 런타임 동적 로딩 금지 · 빌드타임 등록만 | `contracts/auth-method.ts:12-14` | §비범위 "RFC 7591 동적 등록" 제외 | **유지** — 0181 도 빌드타임 등록만 한다 |
| 중복 id 는 거부한다 (opencode 의 last-writer-wins 비채택) | `features/auth-platform/registry.ts:10-12` (코드 주석) | §비범위 (0181 로 이월) | **유지** — 0181 의 `registry.ts` 가 같은 규칙을 잇는다 |
| main 원격 요청은 Chromium `net.fetch` 단일 스택, 전역 `fetch(` 허용 파일 1개 | `app/src/main/AGENTS.md §원격 요청` · `docs/arch/backend/security.md §1.8·§1.9` | §설계 단계 7 "`infra/net/` 으로 이설" · AC2 | **유지 (경로만 변경)** — 규칙은 그대로, 문서의 경로 표기를 `infra/auth/` → `infra/net/` 로 갱신 |
| main feature 수직 슬라이스 11종 | `app/AGENTS.md §모듈 레이아웃` | §설계 단계 5 | **갱신** — `auth-platform`·`connectors` 제거로 **9종** |
| `infra/` 인벤토리에 `auth`(vault·browser session·net 스택) 포함 | `app/AGENTS.md §모듈 레이아웃` · `docs/arch/backend/security.md §1.9` | §설계 단계 7 | **갱신** — `auth` 항목 제거, `net` 항목 신설 |
| contracts 8모듈 | `app/AGENTS.md` · `app/src/main/AGENTS.md` | §설계 단계 6 | **갱신** — 3종 삭제로 **5모듈** |
| 마이그레이션 append-only | `scripts/check-migrations-appendonly.mjs` | (해당 없음 — 이번 변경은 SQL 마이그레이션을 만들지 않는다) | **유지** |
| ESLint `boundaries` DAG + `import/no-cycle` | `app/eslint.config.mjs` | §설계의 "같은 레이어 내 이동이라 DAG 영향 없음" | **유지** |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **부팅 순서**: 현재 `createAuthPlatform` 이 `Bootstrap.start()` 최상단(DB 초기화보다 앞)에 있다 —
  renderer 게이트가 창 오픈 직후 `auth:status` 를 invoke 하기 때문(0109/0157). 제거하면 그 선행 제약이
  사라지므로 **DB 초기화가 첫 단계**가 된다. 부팅 진단(`boot-report.ts`)의 단계 목록에서 auth 항목을 뺀다.
- **첫 실행(신규 설치)**: 게이트가 없으므로 앱이 바로 메인 UI 로 연다. `authBypass` 는 무효 필드가 되지만
  설정 파일에 남아도 `recoverKnownSettings` 화이트리스트가 그대로 통과시킨다(스키마에 키가 남으므로).
- **기존 설치 업그레이드**: `orca-auth-bindings.json` 과 `authBinding:*` secret 이 디스크에 남는다.
  **읽는 코드가 사라지므로 무해**하다 — 파일 삭제는 하지 않는다(0181 이 새 형식을 쓰고, 잔재 정리는 그때 판단).
- **MCP 서버 드롭**: `${BINDING:…}` 을 쓰던 서버가 있으면 토큰 소스가 사라져 계속 드롭된다.
  현재 binding 이 0개(R8)라 **실동작 변화 없음** — 드롭 사유 문구만 "토큰 소스 없음" 으로 단순해진다.
- **진행 중 로그인**: `TransactionStore` 가 메모리 전용이라 앱 재시작으로 자연 소멸한다. 잔재 없음.
- **취소·창 닫힘**: ADFS 로그인 창 경로가 통째로 사라지므로 해당 취소 처리도 함께 사라진다 —
  남는 창 라이프사이클은 메인 윈도우 하나다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **K1** — Stage 1 종료 시점에 로그인 게이트가 없고 Confluence·사내 usage 도구가 중단된다. 폐쇄망 배포 형상이 아니다 | **0180 과 0181 사이에 `v*` 태그를 만들지 않는다.** 릴리스는 0181 완료 후 (`release.yml` 은 태그 push 로만 발화하므로 태그를 안 만들면 배포가 안 나간다) |
| **K2** — 전송 스택 이설이 updater·usage 를 조용히 깨뜨릴 수 있다 | AC2 가 가드로 잡고, AC3 이 usage 경로를, AC8 이 전체 스위트를 잡는다. 이설은 **순수 이동**(내용 무변경)으로 제한한다 |
| **K3** — `features/skills/` 는 스킬·MCP 공용 셸이라 통째 삭제가 불가하고, 부분 수정에서 탭 구성이 깨지기 쉽다 | AC6 이 탭·nav 구성을 테스트로 고정한다 (`catalogGroups.test.ts`·`navItems.test.ts`) |
| **K4** — 35개 테스트 파일이 사라져 스위트 규모가 줄면, 이후 회귀 탐지력이 낮아진다 | 0181 이 정책 테스트(origin 거부·예약 헤더 거부·게이트 진리표)를 **이식**한다. `policy.ts`(105줄, 순수)의 테스트가 이식 원본 — 삭제 전 좌표를 기록: `git show 8965fa7:app/src/main/features/auth-platform/policy.test.ts` |
| **K5** — `cheerio`·`turndown`·`turndown-plugin-gfm` 이 일시적으로 소비자 0 이 되어, 다음 사람이 "미사용 의존성"으로 지울 수 있다 | `package.json` 에서 **제거하지 않고**, `app/AGENTS.md §의존성 정책` 의 해당 항목에 "0180 에서 일시 미사용, 0181 이 복원" 을 명시한다 |

- 되돌리기 어려운 결정: **vault 키 네임스페이스 폐기**(§범위의 유예 표에서 결정 기록 — 재로그인 요구).
- **단독 결정 금지 항목(Open Question)** → 사용자에게: **없음** (0181 소관 3건은 이 핸드오프 범위 밖).

## 영향 받는 파일

- 삭제: `app/src/main/features/auth-platform/**` · `app/src/main/features/connectors/**` ·
  `app/src/main/contracts/{auth-method,internal-api,connector}.ts`(+`internal-api.test.ts`) ·
  `app/src/main/app/handlers/{auth,plugins}.ts`(+`plugins.test.ts`) · `app/src/main/app/{auth-restore,usage-source}.ts`(+테스트) ·
  `app/src/main/infra/auth/{credential-vault,binding-records,binding-store-file,browser-session-store,session-policy,authenticated-fetch}.ts`(+테스트) ·
  `app/src/renderer/src/features/auth/**` · `app/src/renderer/src/features/skills/{components/customize/{PluginDetail,ConnectorConnectModal,PluginDiagnosticsBanner}.tsx,hooks/{usePluginCatalog,useConnectorConnect}.ts,lib/{pluginCatalog,connectorConnect,connectorActions}.ts}`(+테스트) ·
  `app/src/shared/protocol.plugins.test.ts`
- 이설: `app/src/main/infra/auth/{net-fetch,net-request,net-response}.ts` + `no-node-fetch.test.ts` → `app/src/main/infra/net/`
- 수정: `app/src/main/app/{bootstrap,context}.ts` · `app/src/shared/{ipc,protocol}.ts` · `app/src/preload/index.ts` ·
  `app/src/main/features/extensions/mcp/{resolver,store}.ts` · `app/src/main/features/usage/external-usage-service.ts` ·
  `app/src/renderer/src/app/{RootGate,LoginFrame,SidebarUserButton,OverlayLayer,AppLayout,Sidebar,navItems}.tsx|ts` ·
  `app/src/renderer/src/features/debug/components/DebugPanel.tsx` ·
  `app/src/renderer/src/features/skills/{components/customize/{ExtensionsCatalogView,CustomizeList,CustomizeRail}.tsx,lib/{catalogGroups,catalogSelection}.ts}` ·
  `app/src/renderer/src/shared/{api/ipc.ts,i18n/resources/{ko,en}.ts,navigation/routes.ts}` ·
  `app/src/shared/ipc-documentation.test.ts`
- 문서: `docs/IPC_CONTRACT.md` · `docs/GLOSSARY.md` · `docs/arch/backend/{security,overview}.md` ·
  `docs/arch/frontend/overview.md` · `docs/guides/closed-network-extensions.md` · `docs/PHASES.md` ·
  `app/AGENTS.md` · `app/src/main/AGENTS.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/IPC_CONTRACT.md` §2 (채널 카탈로그) · §6 (변경 절차 — **반드시 동시 갱신**)
- `docs/arch/backend/security.md` §1.4-b (credential 경계표) · §1.7 (게이트) · §1.8·§1.9 (net 스택)
- `docs/guides/closed-network-extensions.md` (0181 에서 재작성)
- `app/src/main/AGENTS.md` §원격 요청은 Chromium 스택으로만
- 아티팩트 4건 (opencode 구조 근거) — `c865512e` · `d801bbaf` · `c5b48b30` · `024a4677`

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck`, 그리고 `./node_modules/.bin/vitest run`.
- **`npm test` 는 쓰지 않는다** — `pretest` 가 ABI 를 Node 로 뒤집어 이후 `dev`/`build` 를 깨뜨린다
  (`app/AGENTS.md §better-sqlite3 ABI`). DB 로드 스위트 5종 red 는 **환경 베이스라인**(R20)으로 분리 보고한다.
- 신규 테스트 요구: AC3(usage `sources` 부재 경로) · AC4(MCP 토큰 소스 부재 경로) ·
  AC5(runtime tool 빈 스냅샷) — 셋 다 순수 단위. AC1·AC6 은 기존 테스트의 기대값 갱신.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 8건을 라이브 세션 인용으로 적고, 추론 1건을 추론으로 표기했다.
- [x] 자료조사 — R1~R22 전부 `파일:라인` 또는 실행 명령 레퍼런스를 붙였다.
- [x] 의존 기술 — 신규 의존성 0. 오히려 3종이 일시 미사용이 됨을 K5 로 표기했다.
- [x] 파생 UX — 부팅 순서·첫 실행·업그레이드 잔재·MCP 드롭·진행 중 로그인·창 취소 6건을 펼쳤다.
- [x] 리스크 — K1~K5 + 되돌리기 어려운 결정(vault 네임스페이스)을 적었고 Open Question 은 0건임을 밝혔다.

**기계적으로 확인 가능한 것**:

- [x] 요구 비판적 검토 5질문에 답했고, 이견(K1)을 적었으나 **요구 범위를 줄이지 않았다**
- [x] 인수 기준 9개의 `검증 수단` 칸이 하나도 비어 있지 않다 (AC9 는 "사람 실기 — 실행 경로" 로 명시)
- [x] 부정형/"불변" 기준 0개 — AC1·2·3·4·5·6·8 은 "…이다/…한다" 양성 단언, AC7 은 "0건이다" 라는 측정 결과 단언
- [x] AC 끼리 모순 없음 — AC8(스위트 red 5종)과 AC5(runtime-tool 테스트)를 짝지어 확인:
      `extensions/builder.test.ts` 는 red 5종에 포함되므로 **AC5 의 검증 수단에서 제외**하고
      `runtime-tool-registry.test.ts` 만 썼다. AC1(채널 71)과 AC6(탭 2종)은 서로 다른 표면이라 충돌 없음
- [x] 인용 수치를 이번 세션에서 직접 측정했다 — 승계 0개. 검산: auth-platform 2065+416+2088=4569 ✓,
      채널 82−11=71 ✓, 테스트 삭제 22+4+3+1+4+1=35 ✓
- [x] 신규 모듈(이설 2건)에 테스트 방법이 있고, electron 의존부의 순수 seam(`net-response.ts`)이 **이미 존재**함을 밝혔다
- [x] 전수 조사에 N 수치가 있다 — R11(17) · R12(16) · R16(13) · R17(35) · R3(82→71) · R19(4행)
- [x] 각 AC 에 프로덕션 도달 경로가 있다. **유일한 호출자가 테스트인 AC 0개** — 그래서 Confluence 순수
      로직을 "이동"이 아니라 "삭제 후 0181 이 git 복원"으로 바꿨다(§범위)
- [x] 사람 실기 AC(AC9)에 실행 경로가 있고, 그 경로(채팅)는 자기 비범위에 막혀 있지 않다
- [x] 선택적 필드 판정 — `sources?: UsageSourcePort` 의 **미지정 케이스가 AC3** 이다
- [x] 소비 계약의 제약 필드 강제 지점 — 이번 작업은 계약을 **삭제**하므로 신규 강제 지점 없음.
      제거로 사라지는 강제(origin allowlist·예약 헤더)는 K4 로 0181 이식 대상에 좌표와 함께 등록했다
- [x] 참조 구현(아티팩트 4건) 대비 커버리지 — 0180 은 *제거*라 계약 union 커버리지가 해당 없음.
      union 전수 대조는 0181 의 `AuthSpec` 4분기·`redirect` 3분기에서 수행한다
- [x] 미룬 항목마다 일방향 여부에 답했다 (§범위의 유예 표 4행)
- [x] 관문 4 를 본문 완성 후 돌렸다 — §기존 결정 표 9행을 본문 문장과 대조해 채웠고, 인용 경로
      (`contracts/auth-method.ts:12-14`·`registry.ts:10-12`·`no-node-fetch.test.ts:18,21`·
      `external-usage-service.ts:26,121-123`·`ipc-documentation.test.ts:9-22`)를 전부 열어 확인했다
- [x] "확정돼 있다" 류 인용의 앵커를 grep 했다 — `GLOSSARY.md:31` 의 **Plugin** 표제어(3레지스터)는
      **실재 확인**. 반면 같은 문서 4행이 죽은 심볼을 인용함을 확인해 **AC7 로 정리 대상에 넣었다**

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: 삭제 순서(§설계, renderer → preload/shared → handlers → bootstrap → 슬라이스 → 계약 → infra)가
  실제로 유효했다. 단계마다 typecheck 가 다음 절단면을 정확히 가리켜, 마지막 bootstrap 단계에서만 손으로 판단했다.
  "절대 지우지 말 것" 4종도 전부 실제 함정이었다 — 특히 `infra/auth/net-*` 는 디렉토리 이름만 보고 지웠으면
  updater·usage 가 조용히 깨졌을 것이다.
- **이견 / 우려 (설계가 틀린 곳)**:
  1. **§설계 1단계가 `LoginFrame` 을 "삭제" 로 분류한 것은 틀렸다.** 이 컴포넌트는 로그인 게이트 **와 부팅 실패
     화면**을 겸하고 있었다(`RootGate:35-37` 의 `bootPhase === 'failed'` 분기). 통째로 지우면 부팅 실패 시
     렌더할 화면이 사라진다. → `BootFailureFrame.tsx` 로 이름을 바꿔 auth 부분만 걷어냈다(아래 D1).
  2. **AC6 의 술어가 두 가지를 섞었다.** "카탈로그 탭과 사이드바 nav 가 skills·mcp 2종으로 줄고" 라고 썼는데,
     사이드바 nav 는 4항목(새 대화·프로젝트·엔진·플러그인)이고 그중 4번째가 **카탈로그 모달을 여는 유일한 입구**다
     (`navItems.ts` 의 `path: null` → `Sidebar.tsx:91` `onOpenPlugins()`). nav 를 줄이면 카탈로그가 도달 불가가 된다.
     → AC6 은 **카탈로그 탭에만** 해당하도록 좁혔다(아래 D2).
  3. **AC7 의 grep 술어가 P30 함정에 걸린다.** 범위를 `docs/ app/src` 로 잡았는데, 여기엔 `docs/PHASES.md`·
     `docs/handoff/`·`docs/etc/study/`(이력)와 **"이 키가 0180 에서 사라졌다" 는 변경 이력 문장 자체**가 포함된다.
     게이트를 그대로 통과시키려면 자기 설명을 지워야 하는 자기모순이다. → 술어를 좁혔다(아래 D3).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| D1 | `LoginFrame` 이 **부팅 실패 화면을 겸한다** — 설계의 "삭제" 대로 하면 `bootPhase === 'failed'` 에 렌더할 것이 없다 | ✅ 구현함 — `app/BootFailureFrame.tsx` 로 개명하고 `AuthView`·`AuthDebugSection`·`bootError` optional 을 걷어냈다. `RootGate` 는 부팅 단계만 판정한다 | `RootGate.tsx:35-37`(구) · `LoginFrame.tsx:59-73`(구) |
| D2 | AC6 이 **사이드바 nav 까지** 2종으로 줄이라고 읽힌다. nav 4번째가 카탈로그 모달의 유일한 입구라 지우면 도달 불가 | ✅ 구현함(범위 축소) — nav 는 **그대로 두고** 카탈로그 탭만 3→2 로 줄였다. 라벨(`sidebar.nav.plugins`)도 유지: 0181 이 **같은 카탈로그에** provider 목록을 되돌리므로(사용자 결정) 사용자에게 보이는 어휘를 두 번 뒤집지 않는다 | `navItems.ts` · `Sidebar.tsx:91,135` · `catalogSelection.ts` |
| D3 | AC7 의 grep 범위가 이력 문서와 **자기 변경 이력 문장**을 잡는다 (P30) | ✅ 구현함(술어 정정) — 판정을 **"라이브 스키마·타입·현재형 서술에 없을 것"** 으로 좁혔다. 기계 검사 2개: ⓐ `rg <심볼> app/src` = **0건** ⓑ 스키마 표 행/타입 선언 형태(`^\| \`connectorInstances\`` · `^  pluginAddEnabled:`) = **0건**. 변경 이력 서술("0180 에서 제거됨")은 허용 | P30(0177) · `docs/PHASES.md:202,214` |
| D4 | 설계가 `docs/` 문서 수를 세지 않았다 — 실제로 **`Settings` 키 수치가 20 이 아니라 18** 이었다(`connectorInstances`·`pluginAddEnabled` 는 0178 에 코드가 사라졌는데 문서 4곳이 살아 있는 키로 서술) | ✅ 구현함 — `IPC_CONTRACT`·`TRD`·`persistence`·`docs/AGENTS` 4곳을 18 로 정정 | `shared/ipc.ts` 의 `Settings` 실측 18 |
| D5 | `GLOSSARY.md` 의 **Connector 인스턴스** 표제어는 0178 에서 *기능*이, 0180 에서 *개념*이 사라져 갈 곳이 없다 | ✅ 구현함 — 행 삭제. `Auth provider`·`Connector`·`Plugin` 3행은 "0180 제거" 로 개정(표제어는 남겨야 과거 문서의 링크가 죽지 않는다) | `GLOSSARY.md:29-32` |
| D6 | `docs/etc/study/orca/` 가 여전히 `docs/AGENTS.md` 인벤토리에 **현행 참고자료**로 올라 있다 — 사용자가 근거 배제를 지시한 문서다 | ✅ 구현함 — 인벤토리 행에 **⚠️ 폐기** 표기 + 배제 지시 출처 명시 | 라이브 세션 정정 (2026-08-10) |
| D7 | `cheerio`·`turndown`·`turndown-plugin-gfm` 이 **소비자 0** 이 됐다 — 다음 사람이 "미사용 의존성" 으로 지울 수 있다 | ✅ 구현함 — `package.json` 은 그대로 두고 `app/AGENTS.md §의존성 정책` 에 "0180 기준 소비자 0, 0181 이 복원하므로 지우지 마라" 를 박았다 | 계획 §리스크 K5 |

## [구현자 기입] 구현 체크리스트

- [x] renderer — `features/auth/` 전량 · `LoginFrame`→`BootFailureFrame` · `RootGate`·`OverlayLayer`·`SidebarUserButton`·`DebugPanel` 참조 · skills 커넥터 UI 11파일 · `shared/api/ipc.ts` · i18n 고아 키
- [x] preload bridge(auth 7 + plugins 4) · `shared/ipc.ts` 채널 11 + DTO 블록 · `shared/protocol.ts` 스키마 + re-export 20종
- [x] `app/handlers/{auth,plugins}.ts` · `app/{auth-restore,usage-source}.ts` · `RouterContext` 필드 4종
- [x] `app/bootstrap.ts` — `createAuthPlatform`·`restoreAuthConnections`·`attachBindings`·`sources` 주입
- [x] `features/auth-platform/**` · `features/connectors/**` · 계약 3종
- [x] `infra/auth` 6모듈 삭제 + 전송 스택 3모듈 + 가드 → `infra/net/` **git mv 이설**
- [x] 신규 회귀 3건(AC3 usage `sources` 부재 · AC4 MCP 토큰 소스 부재 · AC5 runtime-tool 빈 스냅샷) + 기존 기대값 갱신(AC1 채널 71 · AC6 탭 2종)
- [x] 문서 12건 — `IPC_CONTRACT`·`GLOSSARY`·`TRD`·`persistence`·`security`·`overview`(back/front)·`ARCHITECTURE`·`closed-network-extensions`·`docs/AGENTS`·`app/AGENTS`·`app/src/main/AGENTS`·`PHASES`

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 삭제 **약 90파일**(main 슬라이스 2 + 계약 3 + handlers/app 6 + infra 6 + renderer 12 + 테스트 35 …) · 이설 5(`infra/auth`→`infra/net`, git mv) · 수정 약 30 · 신설 1(`BootFailureFrame.tsx`) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` (`npm test` 는 ABI 를 뒤집으므로 미사용) |
| 게이트 결과 | lint **0 error / 1 warning**(0102 known, boundaries 위반 0) · typecheck **3/3 exit 0** · vitest **171 파일(166 pass / 5 fail) · 1,417 테스트(1,378 / 39)** |
| 베이스라인 대조 | 착수 전 206 파일(201/5) · 1,914 테스트(1,875/39). **실패 파일이 착수 전과 동일한 DB ABI 5종**(`chat-turn.continuity`·`extensions/builder`·`orchestration/fork`·`db/migrate`·`db/queries`)이고 실패 테스트 수도 39 로 동일 → 신규 red 0. 파일 −35 는 R17 의 삭제 예정 수와 정확히 일치 |
| 블로커 / 역질문 | **없음.** AC9(앱 기동 실기)만 사람 몫 — egress 차단 환경에서 `npm run dev` 는 Electron ABI 재빌드에 막힌다(0019·0102 선례) |
| 대상 커밋 | (이 커밋) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (verify/FAIL 시 신설) | | | |
