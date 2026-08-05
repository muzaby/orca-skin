# features/providers/static/modules/ — 회사별 정적 사용량 provider (외부 에이전트용 자족 가이드)

> **이 문서만 읽고 구현할 수 있도록 쓰여 있다.** Orca 내부 구조를 몰라도 된다.
> English summary at the bottom.

## 여기는 무엇인가

Orca(Electron 데스크톱 앱)의 **main 프로세스**(Node.js 환경)다. 이 디렉토리는 폐쇄망(사내) 배포에서 회사 사용량/quota 집계 API 를 Orca 사용량 UI(도넛·설정 탭)에 연결하는 **회사 소유 정적 usage provider 모듈**이 사는 곳이다. 기본 배포에는 활성 모듈이 0개다(opt-in).

## 계약 (읽어야 할 유일한 파일)

**`app/src/main/contracts/usage-report.ts`** — 동결(생성 후 불변) 계약. 구현할 것은 `StaticUsageProviderModule` 하나:

| 멤버 | 의미 |
|---|---|
| `adapter` / `provider` | provider 디렉토리 식별 — `sources/settings/<adapter>/<provider>/settings.json` 이 이 모듈로 생성된다 |
| `defaultSettings` | 첫 설치 시 그 settings.json 에 기록할 기본값(env 블록 포함 가능) |
| `usage.config` | **선언형 경로**: HTTP 1회 호출 + JSON 경로 매핑(`UsageReportConfig`). 헤더에 `${SECRET:name}`/`${ENV:name}` 확장 지원 |
| `usage.provider` | **훅 경로**: `fetchUsageReport(ctx)` 직접 구현 — 페이지네이션·응답 재구성 등 복잡한 계약용 |
| `usage.subscription` | **구독 경로 (0176, 인증이 필요하면 이것)**: usage connector 가 인증된 호출을 하고, 이 모듈은 그 결과 표본을 `map(sample, ctx)` 으로 자기 리포트로 바꾼다. 셋 중 **최우선** |

**어느 것을 쓰나** — 갈림은 하나다:

| 사용량 endpoint 가 | 쓸 것 |
|---|---|
| **인증을 요구한다**(ADFS/SSO·PAT·ID/비밀번호) | **`usage.subscription`** — `features/auth-platform/modules/usage/servers.ts` 에 서버를 선언하고 그 `id` 를 `sourceId` 로 구독한다 |
| 공개거나 env 토큰으로 충분하다 | `usage.config`(단순) 또는 `usage.provider`(복잡) |

> **0157 이후 `ctx.secret` 에 값을 넣어 주는 코드가 없다.** 자격증명은 인증 플랫폼 vault 에만
> 앉고 요청 주입은 broker 가 한다 — 인증이 필요한 endpoint 를 `${SECRET:}` 으로 부르려 하면
> 토큰이 빈 문자열로 확장된다. 그 자리가 구독 경로다.

`ctx`(`ExternalUsageContext`, config·provider 경로)가 주는 것: `fetch`(+`signal` — 반드시 전파), `secret`(이 provider 네임스페이스의 암호화 저장소), `env`, `settings`, `store`(비-비밀 KV), `logger`, `clock`.

`ctx`(`UsageMapContext`, subscription 경로)가 주는 것: `providerKey`, `settings`, `store`, `logger`, `clock`. **`fetch` 도 `secret` 도 없다** — 구독 모듈은 raw credential 을 보지 않는다(AUTH-PLAT-009).

프레임워크가 처리해주는 것(모듈이 신경 쓸 필요 없음): 1분 주기 스케줄, 타임아웃, 실패 시 마지막 성공 값 폴백(stale 표시), SQLite 캐시 영속, UI 반영.

## 구현 절차

1. `_example/index.ts`(선언형)·`_example/provider-hook.ts`(훅)·`_example/provider-subscription.ts`(구독) 중 하나를 `modules/<회사명>/` 으로 복사해 회사 계약으로 교체한다.
2. `modules/index.ts` 배럴에 **한 줄** 추가한다:
   ```ts
   import { acmeUsageModule } from './acme'
   export const STATIC_USAGE_PROVIDER_MODULES: StaticUsageProviderModule[] = [acmeUsageModule]
   ```
3. 게이트 확인: `cd app && npm run lint && npm run typecheck`.

## 지켜야 할 것 / 하지 말 것

- **이 디렉토리(`modules/**`)와 배럴 한 줄 외에는 아무것도 수정하지 마라.** 코어 서비스(스케줄러·IPC·트래커·머티리얼라이저)는 모듈 등록만으로 동작하며 provider 이름 분기를 갖지 않는다.
- **비밀을 git 에 커밋하지 마라.** 토큰은 런타임에 `ctx.secret` 으로만 — SSO 모듈이 공급하거나(`provider:<key>:` 네임스페이스 공유), 사용자가 설정한다.
- 리포트가 없으면 `null` 을 반환하라(throw 는 네트워크 오류용) — 프레임워크가 stale 폴백을 처리한다.
- 인증 갱신(401 재로그인 등)은 모듈 소유다 — 프레임워크는 모른다.

## English summary

This directory hosts **company-owned static usage provider modules** for closed-network Orca deployments (zero active by default). Implement `StaticUsageProviderModule` from the contract `app/src/main/contracts/usage-report.ts` — the declarative `usage.config` (single HTTP call + JSON path mapping, `${SECRET:}`/`${ENV:}` expansion), the hand-written `usage.provider` hook (`fetchUsageReport(ctx)`) for pagination/reshaping, or — **whenever the endpoint requires authentication** — `usage.subscription`, which maps the result of a usage connector's authenticated call (`map(sample, ctx)`; no `fetch`, no `secret`, since the auth platform owns credentials). The framework owns scheduling (1 min), timeout, stale fallback, persistence, and UI. Copy an `_example/` variant, register it with one line in `modules/index.ts`, touch nothing else, never commit secrets. Gate: `cd app && npm run lint && npm run typecheck`.
