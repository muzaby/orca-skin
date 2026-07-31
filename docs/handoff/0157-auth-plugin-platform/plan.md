# Plan — 0157-auth-plugin-platform

## 메타

| 항목 | 값 |
|---|---|
| slug | `0157-auth-plugin-platform` |
| 작성자 | Claude Code |
| 일자 | 2026-07-31 |
| 매핑 | PHASES Phase 4 (신규 행) |
| 상태 | READY |
| 구현 주체 | **Claude** (사용자 지시로 설계→구현까지 직접 수행 — AGENTS.md 의 "기능 구현=Codex" 기본값을 이번 태스크 지시가 대체) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "인증 플러그인 플랫폼을 구축한다. 각종 서비스 연결을 위해 인증 단계가 필요하고, 인증 기반으로 내장 도구 구현 및 mcp 사용을 할 수 있도록 지원하려고 한다. 기존의 sso 인증 구현은 이러한 계획을 지원할 수 없고 구현자체가 빈약했다." | 라이브 세션 요청 (2026-07-31) |
| 명시 요구 | 범위 = **A + B** (요구명세 §구현 단계) | 라이브 세션 질의 응답 |
| 명시 요구 | 기존 SSO 는 **제거하고 새 계약으로 대체** | 라이브 세션 질의 응답 |
| 명시 요구 | 보고서가 지목한 위험 경로는 **보고서 내용을 따르도록** | 라이브 세션 질의 응답 |
| 명시 요구 | **"설치형"이란 MCP 를 말한 것.** 인증이 필요한 서비스의 내장 도구(코드 구현)는 **플러그인 형태로 빌드 타임에** 추가되고, 그 외에는 MCP 로 설치되도록 | 라이브 세션 정정 (2026-07-31) |
| 명시 요구 | ADFS/WIA 공유 partition 전제는 **참** — 기존 사내 앱이 그렇게 동작 | 라이브 세션 질의 응답 |
| 추론 의도 | 앱 로그인 게이트(현 SSO)는 폐지가 아니라 `AuthTarget.kind='application'` 으로 **흡수**한다 (추론 — 요구명세 AUTH-PLAT-003 이 근거) | `@docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` |
| 추론 의도 | MCP 통합이 이번 범위에 포함된다 (추론 — 사용자가 "mcp 사용을 할 수 있도록 지원" 을 목표로 적었고, 정정으로 MCP 가 런타임 확장의 정본 경로가 됐다) | 라이브 세션 요청 + 정정 |

## Context (왜)

각종 사내·외부 서비스 연결에 인증이 필요하고, 그 위에 내장 도구와 MCP 사용을 얹는 것이 목표다.
현행 SSO(`contracts/sso.ts` + `features/sso/`, 0130)는 이를 지탱하지 못한다:

- `SsoProviderModule | null` — **한 빌드 = 한 회사 로그인 모듈 1개**. 복수 provider 등록 불가.
- 인증 대상이 "앱 로그인" 하나뿐이라 **서비스 연결 개념이 없다**.
- 획득 토큰의 소비 경로가 `setProviderEnv`(settings.json 평문 병합) 사실상 하나뿐이다.

이를 `AuthProviderV1` 공통 lifecycle + `AuthTarget`(application/connector) + binding 모델로 대체한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **Orca 는 LLM·MCP 요청의 주체가 아니다.** claude CLI 서브프로세스가 요청하므로 credential 이 argv/파일로 반드시 나간다 → AUTH-PLAT-008 전역 달성 불가 | `app/src/main/adapters/claude-adapt.ts:79-84` (settings 를 argv 인라인 JSON 으로) · `app/src/main/app/bootstrap.ts:150-156` (해석된 MCP config 를 deploy 로) |
| `options.mcpServers` 는 `--mcp-config` **argv 인라인 JSON** 으로 전달된다 → 디스크→argv 이동일 뿐 개선이 아님 | `@docs/etc/study/claude/api/07-Options-표면과-실행파일-해석.md:79` |
| MCP 는 0058 이후 **plugin `.mcp.json` 파일**로 배포돼 로드된다 (`options.mcpServers` 는 레거시) | `app/src/main/adapters/registry.ts:16` · `app/src/main/adapters/turn.ts:85-86` |
| MCP `${VAR}` 해석이 **`process.env` 전체로 fallback** 한다 | `app/src/main/features/extensions/mcp/resolver.ts:7-9` |
| 미해결 `${VAR}` 는 **서버 전체 드롭**(fail-closed) — 이 동작은 보존 가치가 있다 | `app/src/main/features/extensions/mcp/expand.ts:38-48` |
| 배포 시 기존 `dist` 를 `.bak` 으로 rename → **해석된 비밀의 2차 사본**이 남는다 | `app/src/main/features/extensions/deployer.ts:155-170` |
| `safeStorage` 정책이 **비대칭** — 쓰기는 throw(fail-closed), 읽기는 `null` 강등 | `app/src/main/infra/config/crypto.ts:8-10, 19-24` |
| 로그 redaction 은 이미 key fragment 13종 + 값 패턴 8종(JWT·PEM·AWS·GitHub PAT·Slack)을 잡는다 → "확장" 이 아니라 **auth 이벤트를 파이프라인에 태우는 배선**만 필요 | `app/src/main/infra/log/redact.ts:12-40` |
| `RouterContext.secretStore` 는 **어떤 핸들러도 쓰지 않는 사문 필드** | `app/src/main/app/context.ts:26` (핸들러 grep 결과 0건) |
| 등록된 SSO 회사 모듈이 **0개**(`null`) → 제거의 실제 파괴 대상 없음 | `app/src/main/features/sso/modules/index.ts:15` |
| 앱 로그인 게이트는 **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다 | `@docs/guides/closed-network-extensions.md` §5 |
| 런타임 동적 로딩 금지 + 컴파일 타임 모듈 정책 (이번에도 **유지**) | `app/src/main/contracts/sso.ts:14-16` · `@docs/guides/closed-network-extensions.md` §1·§2·§4 |
| LLM auth key 의 argv 평문 노출은 handoff 0028 이 **명시 채택한 트레이드오프** | `app/src/main/adapters/claude-adapt.ts:76-78` (0028 주석) |
| SSO 채널 3개 / 총 73 채널 · 22 도메인 | `@docs/IPC_CONTRACT.md` §2.13-c |
| 비교 연구 3편은 전부 **LLM provider 인증**이며 서비스 커넥터 인증이 아니다 | `@docs/etc/study/{opencode,goose,hermes-agent}/auth-broker-analysis-ko.md` |

**선행 문서 비판적 검토 결과** — 요구명세·도입 보고서 초판의 3개 항목을 본 핸드오프 착수 전에
개정했다(같은 커밋). 상세는 개정된 두 문서의 "개정 요지" / "재개정" 블록:

1. AUTH-PLAT-008 **스코프 축소** (전역 → Orca 소유·중개 경로 한정 + 예외 표)
2. AUTH-PLAT-011 격리 plugin-host **폐기** (런타임 확장은 MCP 담당)
3. ADFS 전제를 "현행 구현" → **"사용자 확인된 전제"** 로 표기

## 인수 기준 (Acceptance Criteria)

1. 서로 다른 mechanism 의 auth provider **2개 이상이 동시 등록**되고, 각각 `application`·
   `connector` 양쪽 target 에 binding 을 만들 수 있다. (AUTH-PLAT-001 개정 기준)
2. 모든 provider 가 `begin`/`continue`/`status`/`refresh`/`logout` **5메서드를 전부 구현**하고,
   미지원 동작은 메서드 부재가 아니라 `not_supported` 표준 결과로 반환한다.
3. **동일 conformance suite** 가 built-in provider 전부(static-credential · corp-adfs-wia · 테스트
   fixture)에 예외 없이 재적용되어 통과한다.
4. `AuthBinding` 결과 타입에 raw secret·cookie·Electron `Session` 이 **타입상 표현 불가**하고,
   `auth` IPC 응답 DTO 직렬화 스냅샷에 raw secret 이 없다.
5. registry 가 중복 `(pluginId, contributionId, apiVersion)` 과 `apiVersion` 불일치를 **거부**하고,
   last-writer-wins override 를 허용하지 않는다.
6. 같은 session group 을 지정한 대상들이 **동일 Electron partition**(`persist:auth.<group>`)을
   사용하고, 다른 group 과는 격리된다.
7. app logout cascade 와 connector-only disconnect 가 구분되어, connector 하나의 연결 해제가
   공유 session group 전체를 삭제하지 않는다.
8. static credential 3종(`api_key`·`auth_token`·`personal_access_token`)이 **kind 를 보존**하면서
   `CredentialPresentation`(header/cookie/query + scheme)에 따라 서로 다르게 주입된다.
9. transaction 이 `(providerId, target)` 당 1건으로 제한되고, 같은 키 재진입 시 기존 transaction 을
   **명시적으로 취소**한 뒤 교체한다(조용한 덮어쓰기 없음).
10. MCP 설정에서 `${BINDING:<bindingId>}` 참조가 동작하고, broker 가 presentation 대로 값을 만든다.
11. MCP `${VAR}` 해석이 `process.env` **전체로 fallback 하지 않는다** — 명시 allowlist 만 허용하며,
    미해결 시 기존대로 서버 전체를 드롭한다.
12. 배포 시 `.bak` 에 **해석된 비밀의 2차 사본이 남지 않는다**.
13. `contracts/sso.ts`·`features/sso/`·`sso` 3채널이 제거되고, `auth` 8채널로 대체된다
    (총 73 → 78, 도메인 22 유지).
14. `Settings.ssoBypass` → `authBypass` 마이그레이션이 동작하고, 기존 `SecretStore` 키
    (`provider:<key>:*` · MCP env-var 이름)가 보존된다.
15. `RouterContext.secretStore` 가 제거되고, `McpStore`·`ExternalUsageService` 가 raw `SecretStore`
    대신 namespaced vault capability 를 주입받는다.
16. 게이트 통과: `npm run lint`(boundaries 위반 0) · `npm run typecheck` 3분할 0 · vitest 순수
    스위트 green.

## 범위 / 비범위

**범위**: 위 인수 기준 1~16. 요구명세 §구현 단계 A(계약과 경계) + B(기준 provider) + MCP 통합 1·2단계.

**비범위** (후속 핸드오프):

| 항목 | 사유 |
|---|---|
| connector 의 Agent/Skill **tool surface 노출** + 실제 내장 도구 구현체 | 인증 플랫폼이 안정된 뒤 |
| MCP **secret-free proxy descriptor** (§MCP 통합 3단계) | Orca 호스팅 MCP proxy = 별도 서브시스템 |
| LLM 백엔드 **argv 평문 제거** | handoff 0028 이 채택한 트레이드오프 — 뒤집으려면 별도 제품 결정 |
| OAuth browser/device-code · external secret source **provider 구현** | 계약(타입)에는 처음부터 포함, 구현만 이월 |
| ~~설치형 plugin loader / 격리 plugin-host~~ | **폐기** — 이월이 아니라 요구 자체가 없다(사용자 정정) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성 없음.** 기존 스택만 사용 — `zod`(manifest 검증), `electron`(safeStorage·session),
  `electron-store`(SecretStore), `vitest`.
- 재사용: `infra/config/secret-store.ts`(SecretStore) · `infra/config/secret-facade.ts`(네임스페이스
  강제 패턴) · `infra/config/crypto.ts`(safeStorage) · `infra/ipc/{handle,send,dto}` ·
  `infra/vars.ts`(`expandVars`) · `features/extensions/mcp/expand.ts`(fail-closed 드롭).
- **전제**: ADFS/WIA 공유 partition 구조 (사용자 확인 2026-07-31).
- **전제(미검증)**: Electron 39 에서 session group 별 WIA allowlist 분리 가능 여부 → 실기 확인 항목.

## 설계

### 확장 모델 (설계의 기준선)

```
인증 provider (corp-adfs-wia · static-credential · …)  ─┐
내장 도구 / connector (Confluence · Jira · …)           ─┴─ 빌드 타임 플러그인, 컴파일 타임 등록
                                                           ↑ authenticatedFetch — Orca 가 요청 주체
                                                             ⇒ AUTH-PLAT-008 완전 달성

그 외 모든 서비스 연동                                   ─── MCP 서버, 런타임 설치 (기존 mcp 4채널)
                                                           ↑ claude CLI 가 spawn — Orca 는 주체 아님
                                                             ⇒ 예외 경계로 문서화
```

**유지되는 금지 정책**: 런타임 임의 코드 로딩 금지. `contracts/sso.ts` 가 삭제돼도 근거는 유효하므로
새 `contracts/auth-plugin.ts` 헤더에 이유와 함께 다시 적는다.

### 모듈 배치 (main 레이어 DAG 준수)

```text
app/src/main/
├── contracts/
│   ├── auth-plugin.ts          # AuthProviderV1 · AuthTarget · AuthBinding · AuthStep
│   └── connector-plugin.ts     # ConnectorRuntimeV1 · CredentialPresentation · AuthenticatedFetch 포트
├── features/auth-platform/
│   ├── manifest.ts · registry.ts · transactions.ts · bindings.ts · policy.ts · broker.ts
│   ├── conformance.ts          # provider 계약 테스트 하네스
│   └── providers/{static-credential,corp-adfs-wia}.ts
├── features/connectors/{registry,runtime}.ts
├── infra/auth/
│   ├── credential-vault.ts · browser-session-store.ts · authenticated-fetch.ts · plugin-exec.ts
└── app/handlers/auth.ts
```

**경계 준수**:

- `features/connectors` 는 `features/auth-platform` 을 **직접 import 하지 않는다**(feature 교차 금지,
  `eslint-plugin-boundaries` 강제). `contracts/connector-plugin.ts` 의 `AuthenticatedFetch` 구조적
  포트를 `app/bootstrap.ts` 가 주입한다 (`src/main/AGENTS.md` §해소책 2+3).
- `infra/auth/*` 는 `infra`·`shared` 만 의존.
- 구체 provider 리터럴은 `features/auth-platform/providers/` 와 컴포지션 루트에만.

### 이식 (삭제가 아니라 이동)

| 원본 | 대상 | 변경 |
|---|---|---|
| `features/sso/auth-window.ts` | `infra/auth/browser-session-store.ts` | 전용 `'sso'` 파티션 하드코딩 → `persist:auth.<group>` 일반화. **쿠키 통째 반환 표면 제거**(handle 만) |
| `features/sso/service.ts` 의 timeout/throw 격리 실행기 | `features/auth-platform/transactions.ts` | `(providerId, target)` 당 1건 + 명시 취소 추가 |
| `features/sso/exec.ts` | `infra/auth/plugin-exec.ts` | 그대로 (shell 미경유 `execFile` 래퍼) |
| `infra/config/secret-facade.ts` 네임스페이스 패턴 | `infra/auth/credential-vault.ts` | kind metadata 보존 추가 |

### transaction 내구성·동시성 (초판 누락 보완)

| 항목 | 결정 |
|---|---|
| 저장 | 프로세스 메모리. 영속되는 것은 성공 결과인 binding 뿐 |
| 재시작 | 진행 중 transaction 소멸 → `begin` 부터 다시 |
| 동시성 | `(providerId, target)` 당 1건. 재진입 시 기존 것을 **명시 취소**하고 교체 |
| 다중 창 | main 소유이므로 창 무관. 상태는 `auth:stateEvent` 전 창 브로드캐스트 |

### IPC

`sso` 3채널 제거 → `auth` 8채널. 총 73 → 78, 도메인 22 유지.

| 채널 | 방향 | 용도 |
|---|---|---|
| `orca:auth:status` | invoke | 플랫폼 상태 + application 게이트 판정 |
| `orca:auth:providers` | invoke | 등록 provider descriptor 목록 |
| `orca:auth:bindings` | invoke | binding 목록 (secret 없음) |
| `orca:auth:begin` | invoke | `{ providerId, target }` → `AuthStep` |
| `orca:auth:continue` | invoke | `{ transactionId, input }` → `AuthStep` |
| `orca:auth:refresh` | invoke | `{ bindingId }` → `AuthRefreshResult` |
| `orca:auth:logout` | invoke | `{ bindingId, cascade? }` → `AuthLogoutResult` |
| `orca:auth:stateEvent` | send | 상태 변화 브로드캐스트 |

`status`/`begin` 은 현행 `sso` 와 동일하게 `Bootstrap.start()` 최상단 **조기 등록**(창이 start()
완료 전에 열림 — 0109).

### MCP ↔ 인증 플랫폼 통합

| 단계 | 내용 | 범위 |
|---|---|---|
| 1 | `${BINDING:<bindingId>}` 참조 문법. resolver 가 broker 에 위임해 presentation 대로 값 생성. 기존 `${VAR}` 하위호환 | 포함 |
| 2 | `process.env` 전체 fallback 제거 → `binding → vault → 명시 allowlist env`. 미해결 시 서버 전체 드롭 유지 | 포함 |
| 3 | secret-free proxy descriptor | 이월 |

1·2 의 이득은 secret 이 디스크에서 사라지는 것이 **아니라 소유권 일원화**다 — 회전·만료·logout 이
binding 하나로 일관되고, 2 단계 후 credential 출처가 broker 로 단일화돼 3단계를 코어 수정 없이 얹는다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: `begin`~`continue` 사이 inflight. 현행 `SsoState.inflight` 를 transaction 상태로 승계.
- **에러**: provider 원문 메시지 vs 앱 카탈로그 폴백 — 현행 SSO 동작 유지(회사 언어 재량).
- **빈 상태**: 등록 provider 0개 = 게이트 없음(현행 `required:false` 승계). 신규 설치 기본값.
- **동시성**: 같은 provider 로 두 창에서 동시 로그인 → transaction 1건 제한 + 명시 취소로 수렴.
- **부팅 순서**: 창이 `Bootstrap.start()` 완료 전에 열리므로 `status` 조기 등록 필수(0109).
- **safeStorage 잠김**: 읽기는 `null` 강등을 유지하되 **"비밀 없음" 과 "복호화 실패" 를 구분 로깅**
  하고 binding status 를 `unknown` 으로 둬 조용한 미인증 진행을 막는다.
- **접근성/테마**: renderer 는 기존 `LoginView` 제네릭 필드 렌더링을 `AuthStep` 렌더링으로 승계 —
  신규 시각 요소 없음.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **동결 계약 파기** — `contracts/sso.ts` 는 "생성 후 불변" 으로 선언됐다 | 등록 회사 모듈이 **0개**라 실제 파괴 대상이 없음을 확인. 사용자가 "제거하고 대체" 로 명시 결정. `closed-network-extensions.md` 를 같은 커밋에서 갱신해 외부 구현자 혼선 차단 |
| **AUTH-PLAT-008 을 스코프 축소** = 보안 기준 완화로 읽힐 수 있음 | 완화가 아니라 **달성 불가능한 기준의 정정**. 잔여 노출을 `security.md` 예외 표로 **명시 고정**하고, 표 밖의 신규 노출을 회귀 테스트로 차단 |
| MCP `${BINDING:}` 도입이 기존 `${VAR}` 사용자 설정을 깰 위험 | `${VAR}` **하위호환 유지**. binding 참조는 추가 문법 |
| `process.env` fallback 제거가 기존 동작을 깰 위험 | 미해결 시 동작은 기존과 동일(서버 드롭 + 사유 로그). allowlist 를 `orca.json` 으로 노출해 복구 경로 제공 |
| Electron per-session WIA allowlist 분리 불가 가능성 | 실기 확인 항목. 불가 시 `allowIntegratedAuthDomains` 를 전역 합집합 의미로 강등하고 `security.md` 에 기록 |
| 한 커밋의 변경 폭이 큼(계약+인프라+IPC+renderer+MCP) | 작업 순서를 A1→A2→A3→B1→B5 로 나누고 각 단계에서 typecheck 를 통과시킨다 |

- **되돌리기 어려운 결정**: SSO 계약·모듈 삭제 (git revert 로만 복구).
- **단독 결정 금지 항목**: 없음 — 3건(불변식 스코프·설치형 요구·ADFS 전제) 모두 사용자 확인 완료.

## 영향 받는 파일

- 신규: `app/src/main/contracts/{auth-plugin,connector-plugin}.ts` ·
  `app/src/main/features/auth-platform/**` · `app/src/main/features/connectors/**` ·
  `app/src/main/infra/auth/**` · `app/src/main/app/handlers/auth.ts` ·
  `app/src/renderer/src/features/auth/**`
- 삭제: `app/src/main/contracts/sso.ts` · `app/src/main/features/sso/**` ·
  `app/src/main/app/handlers/sso.ts` · `app/src/renderer/src/features/login/**`
- 수정: `app/src/shared/{ipc,protocol}.ts` · `app/src/main/app/{bootstrap,context}.ts` ·
  `app/src/main/features/extensions/mcp/{resolver,store}.ts` ·
  `app/src/main/features/extensions/deployer.ts` · `app/src/main/features/usage/external-usage*.ts` ·
  `app/src/main/infra/settings-migration.ts` · `app/src/renderer/src/app/{RootGate,LoginFrame}.tsx`

## 참고 문서

- `@docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` (개정본 — 계약·인수 기준 정본)
- `@docs/etc/study/orca/auth-broker-adoption-report-ko.md` (개정본 — 목표 구조)
- `@docs/IPC_CONTRACT.md` §2.13-c → §6 변경 절차 (**반드시 동시 갱신**)
- `@docs/arch/backend/security.md` · `@docs/GLOSSARY.md` · `@docs/guides/closed-network-extensions.md`
- `@app/src/main/AGENTS.md` (레이어 DAG · feature 교차 금지 해소책)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + vitest 순수 스위트.
  (`npm test` 는 DB 스위트 포함 — egress 차단 시 better-sqlite3 ABI 베이스라인으로 분리 보고.)
- 신규 테스트: conformance 하네스(provider 3종 재적용) · registry 중복/ABI 거부 ·
  policy origin/redirect/header-spoofing 거부 · bindings cascade vs connector-only disconnect ·
  vault 네임스페이스 이탈 차단 · transaction 동시성/취소 · MCP `${BINDING:}` 해석 ·
  `process.env` fallback 부재 · settings 마이그레이션 · secret 비노출 DTO 스냅샷.
- **사람 실기 필요**(본 환경 불가 — 분리 보고): Electron partition 공유 실동작 · per-session WIA
  allowlist 성립 여부 · `npm run dev` · DB 로드 스위트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 6건을 라이브 세션 출처로 인용, 추론 2건을 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인` 또는 `@docs/…` 레퍼런스를 붙였다.
- [x] 인수 기준 — 16개 번호, 자료조사 근거, 검증 가능.
- [x] 의존 기술 — 신규 의존성 0건 명시, 재사용 모듈 열거, 미검증 전제 1건 분리.
- [x] 파생 UX — 로딩/에러/빈상태/동시성/부팅순서/safeStorage 잠김/접근성 전개.
- [x] 리스크 — 6건 + 되돌리기 어려운 결정 명시. Open Question 3건은 착수 전 사용자 확인 완료.

---

## [구현자 기입] 설계 리뷰 (비판적)

구현 주체 = 설계자와 동일(Claude, 사용자 지시)이라 자기 설계를 다시 읽고 실무 관점에서 검토했다.

**동의 / 그대로 진행**

- §설계 §소비자 경계 — 구현하면서 재확인됐다. `authenticatedFetch` 를 붙일 곳이 실제로 connector
  뿐이고, MCP·LLM 은 값을 넘겨야만 한다. 스코프 축소가 맞았다.
- §확장 모델 — AUTH-PLAT-011 폐기로 사라진 공수가 컸다. plugin-host·RPC capability 표면·직렬화
  제약이 전부 불필요해졌고, provider context 에 함수(`fetch`/`exec`)를 그대로 넘길 수 있었다.

**이견 / 우려**

- §설계 §모듈 배치 의 `features/connectors/registry.ts` 는 이름이 오해를 부른다. connector **구현체**
  등록은 manifest 검증을 auth provider 와 한 경로로 묶어야 해서 `auth-platform/registry.ts` 가
  맡는 게 맞았다. 그래서 이 파일은 **연결(connection) 레지스트리**로 의미를 바꿔 구현했다
  (connector 1개 : connection N개 — 같은 connector 를 여러 사내 인스턴스에 연결). 파일 헤더에 명시.
- §설계 §transaction 의 "durable 하지 않음" 결정은 유지하되, `runGuarded` 가 **이미 abort 된 signal**
  에서도 provider 를 호출하는 구멍이 있었다(테스트로 발견). race 에 맡기면 즉시 resolve 하는
  provider 가 이겨서 취소·로그아웃 뒤에도 vault 쓰기 같은 부수효과가 난다 → 선행 체크로 수정.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `runGuarded` 가 abort 된 signal 에서도 provider 를 호출 — 취소 후 부수효과 가능 | ✅ 구현함 — `signal.aborted` 선행 체크로 단락. 회귀 테스트 고정 | `transactions.test.ts` "이미 abort 된 signal 이면 즉시 수렴한다" |
| 2 | 설계에 `CredentialMeta` 를 `contracts/` 에 두었는데 레이어 위반 — `infra/auth` 가 contracts 를 import 할 수 없다(infra → infra·shared 만) | ✅ 구현함 — `shared/ipc.ts` 로 이동. 이유를 타입 주석에 기록 | `src/main/AGENTS.md` DAG |
| 3 | 설계가 `${BINDING:}` 의 presentation 을 정하지 않음 — mcp.json 에는 connector manifest 가 없다 | ✅ 구현함 — **raw 값 치환**으로 결정. 사용자가 `"Bearer ${BINDING:x}"` 처럼 형식을 직접 쓴다(기존 `${VAR}` 와 동일 시맨틱, 새 문법 개념 0) | `resolver.test.ts` "Bearer 접두사 등 사용자가 쓴 형식을 그대로 보존한다" |
| 4 | `VAR_RE` 를 확장해 binding 을 담으면 `McpStore` 의 `authEnvKey` 추출이 binding 을 env-var 이름으로 오인 | ✅ 구현함 — `BINDING_RE` 를 **서로소 패턴**으로 분리. 회귀 테스트 고정 | `resolver.test.ts` "binding id 는 env-var 이름으로 오인되지 않느다" |
| 5 | `ExternalUsageService`·`McpStore` 가 raw `SecretStore` 를 보유 (위험 #4 잔재) | ✅ 구현함 — 각각 `secretFor` 팩토리 / `attachBindings` + allowlist 로 축소. `createSecretFacade` 시그니처도 concrete 클래스 → 구조적 포트로 | 보고서 §위험 경로 #4 |
| 6 | `pluginExec` 가 `process.env` 를 자식에 통째 상속 (구 `ssoExec` 동작) | ✅ 구현함 — PATH/HOME/locale allowlist + 호출자 명시분만 전달(Hermes `run_secret_cli` 선례) | `infra/auth/plugin-exec.ts` |
| 7 | Electron per-session WIA allowlist 성립 여부 | ⚠️ **보고만 — 실기 확인 필요.** 코드는 per-session `allowNTLMCredentialsForDomains` 만 쓰고, 분리 불가 시 전역 합집합 의미로 강등한다는 주석을 남겼다 | `browser-session-store.ts` 헤더 |

## [구현자 기입] 구현 체크리스트

- [x] A1 계약 3파일 (`auth-plugin`·`connector-plugin`·`manifest`)
- [x] A2 `infra/auth` 4파일 (vault·browser-session-store·authenticated-fetch·plugin-exec)
- [x] A3 플랫폼 5파일 + conformance 하네스
- [x] B1 기준 provider 2종 (static-credential·corp-adfs-wia) + `_example` 패키지
- [x] B2 connector 골격 (connection registry + host)
- [x] B3 `auth` 8채널 + renderer `features/auth` 재배선 + SSO 전량 제거
- [x] B4 MCP `${BINDING:}` + `process.env` fallback 제거 + `.bak` 스크럽
- [x] B5 migration(`ssoBypass`→`authBypass`) + `RouterContext.secretStore` 제거
- [x] 테스트 8파일 (conformance·registry·policy·bindings·transactions·broker·vault·resolver) + 기존 3파일 보강
- [x] 문서 7종 갱신

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 24 (main 17 · 테스트 8 · 가이드 2) · 삭제 7 (SSO 계약·feature·핸들러·renderer login) · 수정 20 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 `useVirtualizer` 베이스라인) / typecheck 3분할 **0** / vitest **154 파일 중 149 pass, 1314 tests pass** |
| 베이스라인 예외 | 5 파일 38 tests red = **better-sqlite3 네이티브 바인딩 미빌드**(egress 차단으로 electron ABI rebuild 403). 전부 `Module did not self-register: better_sqlite3.node` 서명이며 **변경 무관** — 비-ABI 실패 0건 확인 |
| 신규 의존성 | **0** |
| DB 마이그레이션 | **0** (binding 은 비영속) |
| IPC 채널 | 73 → **78** (`sso` 3 제거, `auth` 8 추가), 도메인 22 유지 |
| 블로커 / 역질문 | 없음 |
| 사람 실기 대기 | ① Electron per-session WIA allowlist 분리 성립 여부 ② ADFS 공유 partition 실동작 ③ `npm run dev` 기동 ④ DB 로드 스위트(네트워크 완전환경) |
