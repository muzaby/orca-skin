# features/sso/modules/ — 회사별 SSO 모듈 (외부 에이전트용 자족 가이드)

> **이 문서만 읽고 구현할 수 있도록 쓰여 있다.** Orca 내부 구조를 몰라도 된다.
> English summary at the bottom.

## 여기는 무엇인가

Orca(Electron 데스크톱 앱)의 **main 프로세스**(Node.js 환경 — `fetch`·파일·자식 프로세스 사용 가능)다. 이 디렉토리는 폐쇄망(사내) 배포에서 앱 시작 시 로그인 게이트를 담당하는 **회사 소유 SSO 모듈**이 사는 곳이다. "SSO" 는 이름일 뿐 — 사내 토큰, API 키, OAuth 변형, CLI 호출 등 어떤 로그인 체인이든 된다.

## 계약 (읽어야 할 유일한 파일)

**`app/src/main/contracts/sso.ts`** — 동결(생성 후 불변) 계약. 구현할 것은 `SsoProviderModule` 하나:

| 멤버 | 의미 |
|---|---|
| `key` | 모듈 식별자(비밀 네임스페이스에 쓰임) |
| `fields?` | 로그인 화면에 띄울 입력 필드 선언(사번/비밀번호 등) — 앱이 제네릭 렌더링 |
| `login(ctx)` | 로그인 체인 실행 → `{ ok:true, identity? }` 또는 `{ ok:false, message? }` |
| `restore?(ctx)` | 부팅 시 무입력 silent 복원(저장 토큰 검증). `null` = 로그인 화면으로 |
| `loginTimeoutMs?` | 타임아웃(기본 300초). 초과 시 프레임워크가 실패 처리 |

`ctx`(`SsoContext`)가 주는 것: `fetch`(+`signal` — 반드시 전파), `input`(필드 값), `secret`(모듈 전용 암호화 저장소), `providerSecrets(providerKey)`(usage provider 와 토큰 공유), `setProviderEnv(adapter, provider, env)`(LLM 백엔드 env 전달 — **디스크 평문 주의**), `exec`(CLI 호출, shell 미경유), `openAuthWindow`(격리 브라우저 창), `store`(비-비밀 KV), `logger`, `clock`.

## 구현 절차

1. `_example/` 을 `modules/<회사명>/` 으로 복사해 체인을 회사 로그인 플로우로 교체한다.
2. `modules/index.ts` 배럴에 **한 줄** 등록한다:
   ```ts
   import { acmeSsoModule } from './acme'
   export const SSO_MODULE_REGISTRATION: SsoProviderModule | null = acmeSsoModule
   ```
3. 게이트 확인: `cd app && npm run lint && npm run typecheck` (둘 다 0 error 여야 한다).
4. 검증은 회사 빌드로 한다: `npm run build:win` 등 — 등록 모듈이 있으면 프로덕션 앱이 로그인 게이트를 켠다.

## 지켜야 할 것 / 하지 말 것

- **이 디렉토리(`modules/**`)와 배럴 한 줄 외에는 아무것도 수정하지 마라.** 코어 서비스·IPC·게이트 코드는 모듈 등록만으로 동작한다. 그 밖의 수정은 upstream(main 브랜치) 추적 시 병합 충돌을 만든다.
- **비밀(토큰/비밀번호)을 저장소(git)에 커밋하지 마라.** 런타임 비밀은 `ctx.secret`(OS safeStorage 암호화)으로만 저장한다. 엔드포인트 URL 같은 비-비밀 설정은 코드 상수로 둬도 된다.
- **런타임 동적 로딩 금지** — 모듈은 컴파일 타임 코드다. 임의 경로 `require()`/`import()` 로 외부 코드를 불러오지 마라.
- 실패 메시지(`{ ok:false, message }`)는 로그인 화면에 그대로 표기된다 — 사용자 언어로 쓴다.
- `restore()` 를 구현하면 매 실행마다 로그인하지 않아도 된다(캐시 토큰 검증). 오프라인 저하 모드(캐시 신뢰 `ok:true`)를 허용할지는 회사 정책 재량이다.

## 토큰을 다른 곳에 넘기는 3가지 경로

| 경로 | 대상 | 방법 |
|---|---|---|
| 모듈 전용 캐시 | `restore()` | `ctx.secret.set('session-token', …)` |
| 사용량 provider | `features/providers/static/modules/` 의 usage 모듈 | `ctx.providerSecrets('<adapter>-<provider>').set('usage-report-token', …)` → usage 쪽에서 `${SECRET:usage-report-token}` |
| LLM 백엔드 | provider `settings.json` env 블록 | `ctx.setProviderEnv('claude', '<provider>', { ANTHROPIC_AUTH_TOKEN: … })` — 리터럴 기록(평문). 다음 턴부터 자동 반영 |

## English summary

This directory hosts the **company-owned SSO module** for closed-network Orca deployments. Implement `SsoProviderModule` from the frozen contract `app/src/main/contracts/sso.ts` (single `login(ctx)` hook — your chain may use `ctx.fetch`, `ctx.exec` (CLI), `ctx.openAuthWindow` (isolated browser window), and hand tokens to the usage provider via `ctx.providerSecrets()` or to the LLM backend via `ctx.setProviderEnv()`). Copy `_example/`, register it with one line in `modules/index.ts`, and touch nothing else. Never commit secrets; runtime secrets go through `ctx.secret` (OS-encrypted). Gate: `cd app && npm run lint && npm run typecheck`.
