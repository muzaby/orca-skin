# Plan — 0130-closed-network-extension-points

## 메타

| 항목 | 값 |
|---|---|
| slug | `0130-closed-network-extension-points` |
| 작성자 | Claude Code |
| 일자 | 2026-07-20 |
| 매핑 | PHASES "현재 작업 중" / PR 미정 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | Orca 를 폐쇄망(사내)에서 구현할 때 회사마다 사내 서비스·로그인 방식이 제각각이므로, main 브랜치를 손상하지 않고 외부 에이전트가 (A) 커스텀 SSO 로그인 체인 — 표준 SSO 가 아닐 수 있음(사내 토큰·API 키·OAuth 변형·CLI 호출), (B) 정적 사용량 provider 를 구현할 수 있도록 **확장점 2개 파일(생성 후 불변)** 을 main 이 미리 만들어 둔다. 외부 에이전트는 Orca 내부 구조를 모른다. | 라이브 세션 요청(외부확장 구현가이드) |
| 명시 요구(확정 결정) | ① SSO 획득 토큰은 **게이트 + 토큰 공유**(SecretStore 경유로 usage provider·백엔드 env 소비 허용), ② 산출물은 **검토 + 스캐폴딩 구현까지**, ③ 등록은 **명시적 배럴**(0099 패턴, 런타임 동적 로딩 거부) | 라이브 세션 사용자 질의 응답 3건 |
| 추론 의도 | "확장점 2개 파일"의 usage 쪽은 기존 `contracts/usage-report.ts` 를 그대로 지시하는 것으로 해석(신규 파일 아님) — 이미 요구 구조(불변 계약 + opt-in 모듈)와 일치하므로 재발명하지 않는다. (추론) | 아래 자료조사 |
| 추론 의도 | "main 브랜치를 손상하지 않도록 최대한의 자유도" = 회사 포크/브랜치가 main 을 추적하며 병합 충돌 표면을 최소화하는 구조(모듈 디렉토리 + 배럴 한 줄). (추론) | 요구 문맥 |

## Context (왜)

폐쇄망 배포에서는 (1) 사내 게이트 통과용 로그인(형태 임의), (2) 사내 사용량/quota 집계 조회가 회사마다 다르다. Orca 본체가 모든 인터페이스를 지원할 수 없으므로, main 은 **동결된 최소 계약 표면**만 제공하고 구현은 회사 소유 모듈로 위임한다. 사용량 쪽은 0098/0099 로 이미 그 구조가 있고, SSO 쪽은 0072 의 DEV 스텁뿐이라 대응물이 없다 — 이번 작업이 SSO 확장점을 신설하고 외부 에이전트용 자족 가이드를 정비한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 정적 사용량 provider 확장 프레임워크가 이미 존재: 계약 `ExternalUsageContext`/`ExternalUsageProvider`/`StaticUsageProviderModule`, opt-in 배럴, 기본 활성 0개, 코어는 provider 분기 금지 | `app/src/main/contracts/usage-report.ts:1-24`, `app/src/main/features/providers/static/index.ts:8-25`, `@docs/arch/backend/standardization.md §5.1` |
| hook 이 1급 확장 단위 — OAuth/SigV4/페이지네이션 등 인증 내부는 프레임워크 개념이 아니라 모듈 소유 | `app/src/main/features/providers/static/index.ts:20-23` (0099), `@docs/handoff/0098-static-provider-usage-correction/` |
| SSO 는 renderer 전용 DEV 스텁: `runSso()` 항상 throw, 게이트는 `!import.meta.env.DEV || bypass || authenticated` 로 prod 컴파일 아웃 | `app/src/renderer/src/features/login/sso.ts:16`, `app/src/renderer/src/app/RootGate.tsx:20` (0072/0089) |
| LLM 백엔드 인증은 CLI 서브프로세스 위임 — 앱은 LLM 자격증명 미저장, provider settings.json env 블록을 사용자가 직접 작성(`${VAR}` 확장 폐지) | `app/src/main/adapters/claude-settings.ts:3-6`, `@docs/arch/backend/security.md §1.4` |
| 유일한 자격증명 저장소 = SecretStore(electron-store+safeStorage); usage provider 는 `provider:<key>:` 네임스페이스 facade 로 접근 | `app/src/main/infra/config/secret-store.ts`, `app/src/main/features/usage/external-usage.ts` (`createSecretFacade`) |
| main 레이어 DAG: feature 교차 import 금지 — sso 슬라이스가 usage 의 facade 를 쓰려면 infra 로 승격 필요. 신규 feature 디렉토리는 eslint boundaries 제네릭 캡처(설정 변경 불필요) | `app/src/main/AGENTS.md`, `app/eslint.config.mjs` |
| 창은 `Bootstrap.start()` 완료 전에 열릴 수 있음 → 게이트용 IPC 핸들러는 조기 등록 필요 | `app/src/main/app/bootstrap.ts` (0109 창 오픈 순서) |
| 자동 업데이트는 feed 미설정 시 noop — 폐쇄망에서 별도 차단 코드 불필요, 가이드 문서화로 충분 | `app/src/main/app/updater.ts` |
| 폐쇄망/air-gap 설계 문서는 저장소에 전무 — 본 핸드오프가 첫 정의 | repo 전역 grep(폐쇄망/air-gap 0건) |

## 인수 기준 (Acceptance Criteria)

1. `app/src/main/contracts/sso.ts` 가 신설되고, 헤더에 **불변 정책(additive-optional-only, 파괴 변경은 v2 파일 신설)** 과 **런타임 동적 로딩 금지**가 명문화된다. `SsoContext`(fetch/signal/input/secret/providerSecrets/setProviderEnv/exec/openAuthWindow/env/store/logger/clock), `SsoLoginOutcome`, `SsoProviderModule`(key/fields?/loginTimeoutMs?/login/restore?) 를 export 한다.
2. `features/sso/modules/index.ts` 의 기본 등록은 `null` 이며(신규 설치 = SSO 게이트 없음), `modules/_example/` 는 typecheck 대상이지만 미등록이다. 활성화 절차는 usage 정적 모듈과 동일(모듈 디렉토리 + 배럴 한 줄).
3. `SsoService` 는 모듈 미등록 시 `required:false` 를 보고하고 login 을 거부하며, 등록 시 login/restore 를 timeout(AbortController)·단일 inflight·throw→`{ok:false}` 격리로 실행하고 상태를 `orca:sso:stateEvent` 로 브로드캐스트한다. 프레임워크는 provider/회사명 분기를 갖지 않는다.
4. IPC 3채널(`orca:sso:status`·`orca:sso:login`·`orca:sso:stateEvent`)이 zod 스키마와 함께 추가되고 `docs/IPC_CONTRACT.md` 가 동기화된다. `ssoStatus`/`ssoLogin` 핸들러는 부팅 초기에 등록되어 창 오픈 직후 invoke 가 성립한다.
5. RootGate: prod 에서 모듈 미등록이면 현행처럼 게이트 자동 통과, 등록이면 게이트 활성(인증 전 `LoginFrame`). DEV 게이트 + `ssoBypass` 동작은 불변. prod 에서 `ssoStatus` invoke 실패를 `required:false` 로 조용히 기본화하지 않는다(재시도).
6. renderer `features/login/sso.ts` 스텁이 제거되고 store 가 main 상태 미러(IPC status/login/onState)로 전환되며, LoginView 가 모듈 선언 `fields` 를 제네릭 렌더링하고 모듈 제공 오류 메시지를 표기한다.
7. SSO 토큰 공유 경로가 동작한다: `ctx.providerSecrets(providerKey)` 는 usage provider 와 동일한 `provider:<key>:` 네임스페이스에 기록(공용 facade 는 `infra/config` 로 승격, 기존 `features/usage` re-export 무회귀), `ctx.setProviderEnv` 는 provider settings.json env 블록에 병합 기록 + 캐시 무효화한다.
8. 정적 usage 확장점은 계약 무변경으로 유지되고, `_example` 에 수기 `usage.provider` 훅 변형 예제가 추가된다(미등록).
9. 외부 에이전트 자족 가이드: `features/sso/modules/AGENTS.md` 와 `features/providers/static/modules/AGENTS.md`(+`CLAUDE.md` stub) — Orca 지식 0 가정, 계약 파일 포인터·복사 절차·게이트 명령 포함. `docs/guides/closed-network-extensions.md` — 포크 전략(touch-only 목록), 폐쇄망 빌드, 비밀 규칙, 불변 정책.
10. 신규 테스트: `SsoService` 단위(모듈 무/성공/실패/throw/timeout/inflight/identity/restore/providerSecrets 프리픽스/setProviderEnv), 배럴 기본 null, zod 스키마 — 전부 비-DB 순수 스위트. 게이트: lint(경계 위반 0) + typecheck 3분할 + 순수 vitest green, 기존 usage 테스트 무수정 green.

## 범위 / 비범위

- **범위**: SSO 확장점 신설(계약+레지스트리+서비스+IPC+게이트 실전화), usage 확장점 문서/예제 보강, 외부 에이전트 가이드, 폐쇄망 배포 가이드 문서.
- **비범위**: 특정 회사 SSO 실구현(외부 에이전트 몫), opencode 어댑터 SSO 대응(`adapter:'claude'` 유지 — rule of three), 인증 전 main IPC 잠금(renderer 게이트는 UX — 보안 경계 아님, security.md 에 명문화), 자동 업데이트 사내 feed 서버 구축, `${VAR}` 확장 재도입.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `SecretStore`(infra/config), `createSecretFacade`(usage→infra 승격), `writeJsonAtomic`/`orcaConfigDir`(infra/config), `handle`/`handlePlain`/`broadcast`(infra/ipc), `ProviderSettingsService.invalidateAll`, 0099 정적 모듈 패턴, `update.onState` preload 리스너 패턴.
- 전제: 모듈은 회사 브랜치의 컴파일 타임 코드(빌드 = 회사가 수행). 한 빌드 = 한 회사(단일 모듈).
- **신규 의존성**: 없음 (Node 내장 `child_process.execFile`, Electron `BrowserWindow`/`session` 만 사용).

## 설계

- **계약 파일 2개 = 동결 표면**: `contracts/usage-report.ts`(기존, 무변경) + `contracts/sso.ts`(신설). 불변은 "소비자에 대한 불변"(additive-optional-only)로 정의 — TS 구조적 타이핑으로 optional 추가는 회사 모듈을 깨지 않는다.
- **SSO 는 단일 `login(ctx)` 훅** — 체인(다단계 사내 서비스 패스스루)은 모듈 내부에서 조합. 순서형 스텝 프레임워크는 소비자 0 추상화(rule of three 위반)라 배제. `ctx.exec`(CLI 체인)·`ctx.openAuthWindow`(브라우저 변형, 격리 `sso` 파티션·preload 없음)가 "표준 SSO 가 아닐 수 있음" 요구를 커버.
- **모듈 단일**: `SSO_MODULE: SsoProviderModule | null`. usage 배열과 비대칭이지만 "한 빌드 = 한 회사 로그인"이라 의도적.
- **토큰 공유 3경로**: ① 모듈 전용 `sso:<key>:` secret(세션 캐시 등), ② `providerSecrets('claude-<provider>')` → usage provider 의 `${SECRET:}`/`ctx.secret` 과 동일 저장소, ③ `setProviderEnv` → settings.json env 리터럴 병합(주입은 기존 spawn 경로 그대로 — 0125 respawn 판정이 변경을 자동 감지).
- **부팅 순서**: SecretStore 호이스트 → `SsoService` 생성 + `registerSsoHandlers` 조기 등록 → 비-critical `sso-restore` 부트 스텝. `providerEnvWriter` 는 lazy thunk(providerSettings 생성 후 바인딩).
- 레이어 준수: sso 슬라이스는 contracts/infra/shared 만 하향 의존, usage 와의 공유물(secret facade)은 infra 로 승격, renderer 는 features/login 내부 + preload API 만.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 로딩: login inflight 동안 LoginView 버튼 비활성 + 스피너(기존 status='inflight' 재사용). restore 는 부트 스텝이라 게이트 표시 전 완료/실패.
- 에러: 모듈 메시지 우선, 없으면 기존 `errors.loginFailed` 카탈로그 폴백. 재시도는 같은 화면에서 무제한.
- 빈 상태: 모듈 미등록 prod = 게이트 자체가 없음(현행 동일). fields 미선언 모듈 = 버튼만 렌더.
- 오프라인/사내망 단절: 프레임워크는 timeout 후 실패 반환 — 저하 모드(캐시 세션 `ok:true`)는 모듈 재량. prod 백도어(bypass) 없음(의도적).
- 동시성: login 단일 inflight(중복 클릭 무시). 멀티윈도우는 stateEvent 브로드캐스트로 동기.
- 테마/접근성: LoginView 기존 시맨틱 토큰·폼 컨벤션 준수, fields 라벨은 모듈 제공 문자열(회사 언어 재량).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| "생성 후 불변" vs 미래 진화 | additive-optional-only + 파괴 변경 시 `sso-v2.ts` 병행 신설. 계약 헤더에 명문화 — **되돌리기 어려운 결정** |
| `setProviderEnv` 가 단수명 토큰을 settings.json 평문으로 기록 | `${VAR}` 확장 재도입(폐지 결정 역행) 대신 현행 "env 는 리터럴" 유지 — 노출 등급은 오늘날 사용자 수기 API 키와 동일, login/restore 마다 갱신. 대안 원하면 모듈이 ②경로(secret)만 쓰면 됨 |
| prod 에서 모듈 고장 = 사용자 잠금 | restore 캐시 세션 + 에러/재시도 UI + 저하 정책 모듈 재량. 프레임워크 백도어 없음 |
| 창 오픈 시 `ssoStatus` 레이스 | 핸들러 조기 등록 + renderer 재시도, prod 실패 시 `required:false` 기본화 금지 |
| renderer 게이트는 UX 이지 보안 경계 아님(인증 전 main IPC 열림 — 현행 동일) | security.md 문서화. 실 접근 통제는 회사 네트워크/서비스 몫 |
| `exec`/`openAuthWindow` = 강력한 능력 | 컴파일 타임 회사 코드 한정으로 허용. 동적 로딩 금지 명문화. auth 창은 격리 파티션·preload 없음·sandbox |
| 한국어 정본 vs 비한국어 외부 에이전트 | 두 modules/AGENTS.md 에 영어 요약 병기 |

- 되돌리기 어려운 결정: 계약 파일 2개의 public 형태(위 불변 정책), IPC 채널명 3종.
- **단독 결정 금지 항목** → 사용자 확정 완료: 토큰 공유 범위(게이트+공유)·산출물 범위(검토+스캐폴딩)·등록 방식(명시적 배럴). 잔여 Open Question 없음.

## 영향 받는 파일

- 신규: `app/src/main/contracts/sso.ts`, `app/src/main/features/sso/**`(index/service/auth-window/exec/modules/**), `app/src/main/app/handlers/sso.ts`, `app/src/main/infra/config/secret-facade.ts`, `docs/guides/closed-network-extensions.md`, `app/src/main/features/providers/static/modules/AGENTS.md`(+stub), `_example/provider-hook.ts`
- 수정: `app/src/shared/{ipc,protocol}.ts`, `app/src/main/app/{bootstrap,context}.ts`, `app/src/preload/index.{ts,d.ts}`, `app/src/renderer/src/features/login/{store.ts,components/LoginView.tsx,index.ts}`, `app/src/renderer/src/app/{RootGate,LoginFrame}.tsx`, `docs/IPC_CONTRACT.md`, `app/src/main/AGENTS.md`, `docs/arch/backend/security.md`, `docs/handoff/INDEX.md`
- 삭제: `app/src/renderer/src/features/login/sso.ts`

## 참고 문서

- `docs/arch/backend/standardization.md §5.1` (정적 provider opt-in 계약)
- `docs/arch/backend/security.md §1.4` (credential 모델) · `docs/arch/backend/provider-runtime.md §9` (AuthStore 방향)
- `docs/IPC_CONTRACT.md` §6 변경 절차 — 동시 갱신
- `docs/handoff/0072-login-sso-gate/` · `0098`/`0099`(정적 provider) · `0125`(settings 변경 respawn)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + 순수 vitest(`./node_modules/.bin/vitest run` — 본 환경 egress 차단으로 `npm test` 의 DB 스위트는 알려진 베이스라인 분리 보고).
- 신규 테스트 요구: `features/sso/service.test.ts` · `features/sso/modules/index.test.ts` · `shared/protocol` sso 스키마 테스트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션)와 확정 결정 3건을 인용했고, 추론(기존 usage 계약 재사용·포크 전략)은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인`/`@docs` 레퍼런스를 붙였다.
- [x] 인수 기준 — 10항 번호, 자료조사 근거, 검증 가능.
- [x] 의존 기술 — 재사용 모듈 열거, 신규 의존성 0 확인.
- [x] 파생 UX — 로딩/에러/빈상태/오프라인/동시성/테마 전개.
- [x] 리스크 — 불변 정책·평문 env·잠금·레이스·보안 경계 명시, Open Question 은 사용자 확정 완료.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 건은 사용자 확정에 따라 Claude 가 plan→impl→verify 를 직접 수행한다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 전반(§설계) 그대로 구현. 단일 `login(ctx)` 훅·단일 모듈·조기 핸들러 등록·lazy env sink 모두 실코드와 정합.
- 이견 없음. 미세 조정 2건은 아래 표.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 모듈이 `signal` 을 무시하면 timeout 후에도 login Promise 가 영원히 pending — inflight 가 안 풀림 | ✅ `SsoService.run` 이 `Promise.race([fn(ctx), timedOut])` 로 타임아웃 시점에 `{ok:false}` 로 강제 수렴 (`service.ts`, timeout 테스트 고정) | 설계 §3 "timeout" 을 abort 신호 전파만으로 두면 미협조 모듈에 무력 |
| 2 | usage `_example` 훅 예제에서 `ctx.secret.delete` 사용 — `ExternalUsageContext.secret` 은 get/set 만 (동결 계약이라 확장 안 함) | ✅ 예제를 `ctx.store` 만료 기록으로 교체 — 계약 무변경(AC8) 유지. `delete?` optional 추가는 additive 정책상 가능하나 소비자 없는 확장이라 보류 | rule of three |
| 3 | `env-merge.ts`(기존 파일명)와 신규 `mergeProviderEnv`(engine-write.ts) 이름 근접 — 혼동 여지 | ⚠️ 보고만 — env-merge.ts 는 스폰 시 env 병합(읽기), mergeProviderEnv 는 settings.json 기록(쓰기)으로 책임이 다름. 개명은 비범위 | 파일 역할 상이 |

## [구현자 기입] 구현 체크리스트

- [x] shared 타입/채널/zod + 스키마 테스트
- [x] contracts/sso.ts (불변 헤더)
- [x] secret facade infra 승격 (usage re-export 무회귀)
- [x] features/sso 슬라이스 + _example + 테스트
- [x] handlers/sso + bootstrap 조기 등록 + context + preload
- [x] renderer 게이트 실전화 (스텁 삭제)
- [x] usage _example provider-hook + 두 modules/AGENTS.md
- [x] docs (guides/closed-network-extensions.md · IPC_CONTRACT · main AGENTS.md · security.md)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규: `contracts/sso.ts` · `features/sso/**`(index/service/exec/auth-window/modules) · `app/handlers/sso.ts` · `infra/config/secret-facade.ts` · `providers/static/modules/_example/provider-hook.ts` · 두 `modules/AGENTS.md`(+stub) · `docs/guides/closed-network-extensions.md` / 수정: `shared/{ipc,protocol}.ts` · `app/{bootstrap,context}.ts` · `providers/engine-write.ts`(mergeProviderEnv) · `infra/ipc/send.ts` · preload · renderer login store/View/RootGate/LoginFrame · IPC_CONTRACT · main/app AGENTS.md · security.md / 삭제: `renderer features/login/sso.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅ 0 error(기존 warning 1 — react-hooks/incompatible-library, 무관) / typecheck ✅ 3분할 / vitest ✅ **1059/1059**(신규 sso 12 + 스키마 4; `chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) / scripts 25 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `99c2a24` |
