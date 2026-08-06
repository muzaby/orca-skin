# 폐쇄망(사내) 배포 — 외부확장 구현 가이드 (0130 → 0157 개정)

회사 폐쇄망에 Orca 를 배포할 때, main 브랜치를 수정하지 않고 **커스텀 인증 provider·connector** 와 **정적 사용량 provider** 를 붙이는 방법의 정본. 대상 독자는 Orca 내부 구조를 모르는 외부 에이전트/사내 개발자다.

## 0. 확장 모델 — 무엇을 어디에 붙이는가 (0157)

축은 "선언형이냐 코드냐" 가 아니라 **"빌드 타임 내장이냐 런타임 MCP 냐"** 다.

| 확장 대상 | 추가 방식 | 재빌드 | 요청 주체 |
|---|---|---|---|
| 인증 provider (ADFS/WIA · PAT · API key …) | **빌드 타임 플러그인** (아래 §1) | 필요 | — |
| 인증이 필요한 **내장 도구**(connector) | **빌드 타임 플러그인** | 필요 | **Orca** (`authenticatedFetch`) |
| 그 외 모든 서비스 연동 | **MCP 서버** (앱 UI 에서 런타임 추가) | **불필요** | claude CLI |

**"재빌드 없이 서비스를 추가하고 싶다" → MCP 를 쓴다.** 인증이 필요한 MCP 서버는 `mcp.json` 에서
`${BINDING:<bindingId>}` 로 인증 플랫폼의 binding 을 참조할 수 있다(값 소유는 Orca vault 가 유지).

**런타임 임의 코드 로딩은 금지한다** — Electron main 에서 임의 코드 실행은 filesystem·cookie·Vault
전권을 주는 것과 같고 타입 검증도 성립하지 않는다. 이 정책은 0157 에서도 유지된다.

## 1. 구조 — 확장점 2파일 + opt-in 레지스트리

main 브랜치는 다음만 제공하고, 회사별 구현은 전부 회사 포크/브랜치의 모듈 디렉토리에 둔다:

| 확장점 | 계약 파일 | opt-in 레지스트리 (배럴 한 줄) | 자족 가이드 |
|---|---|---|---|
| A. 인증 provider·connector | `app/src/main/contracts/auth-plugin.ts` · `connector-plugin.ts` | `app/src/main/features/auth-platform/modules/index.ts` | `features/auth-platform/modules/AGENTS.md` |
| B. 정적 사용량 provider | `app/src/main/contracts/usage-report.ts` | `app/src/main/features/providers/static/modules/index.ts` | `features/providers/static/modules/AGENTS.md` |

- **계약 동결·ABI 정책은 0178 에서 폐기했다.** 이전에는 계약 파일이 additive-optional-only 로 동결되고 `apiVersion` 불일치를 registry 가 등록 단계에서 거부했는데, 그 정책이 manifest·선언↔구현 전 필드 대조·conformance 하네스를 파생시켜 **확장점 1,603줄**을 만들었다. 지금은 배럴의 `satisfies readonly AuthPackage[]` 가 형태를 **컴파일 타임에** 강제하고, 계약이 바뀌면 회사 모듈은 컴파일 에러로 즉시 안다 — 조용히 어긋나지 않는다.
- **런타임에 남는 검증은 둘뿐이다** — 중복 id 거부, origin 형태 검사(`features/auth-platform/registry.ts` 헤더). 타입으로 표현할 수 없는 것만 남겼다.
- **명시적 배럴 등록**: 모듈은 컴파일 타임 코드다. 런타임 동적 로딩(임의 경로 require)은 보안·타입검증 양면에서 금지.
- **기본 = 비활성**: 신규 설치는 인증 패키지 0개 + usage provider 0개. 게이트/사용량 연동은 등록해야만 켜진다. 등록된 `application` provider 가 없으면 `required:false` 로 로그인 게이트가 자동 통과된다.
- **복수 등록 가능**: 0130 의 "한 빌드 = 회사 모듈 1개" 제약은 없어졌다. provider 를 몇 개든 등록할 수 있고, 하나의 provider 를 앱 로그인과 여러 connector 가 재사용한다.

## 2. 포크/브랜치 전략 — main 을 손상하지 않기

- 회사 브랜치는 upstream main 을 추적(rebase/merge)한다.
- **touch-only 목록** — 회사 브랜치가 수정해도 되는 곳은 아래 4곳뿐이다. 이 밖의 수정은 upstream 추적 시 병합 충돌·동작 회귀를 만든다:
  1. `app/src/main/features/auth-platform/modules/<회사명>/**` (신규 디렉토리)
  2. `app/src/main/features/auth-platform/modules/index.ts` (배럴 한 줄)
  3. `app/src/main/features/providers/static/modules/<회사명>/**` (신규 디렉토리)
  4. `app/src/main/features/providers/static/modules/index.ts` (배럴 한 줄)
- 게이트: `cd app && npm run lint && npm run typecheck` (+ 가능 환경에서 `npm test`).

## 3. 획득한 토큰은 어디로 가는가 (0157 개정)

provider 가 획득한 credential 은 **Orca vault 가 소유**하고, 소비자는 binding 을 통해서만 쓴다.

```
begin/continue(ctx) ── ctx.vault.set('secret', …, {kind})   → binding 네임스페이스에 봉인
                                                               (logout 시 한 번에 삭제)
                            │
      ┌─────────────────────┼─────────────────────────────┐
      ▼                     ▼                             ▼
 내장 도구/connector    MCP 서버                      앱 로그인 게이트
 authenticatedFetch    ${BINDING:<id>} 참조           binding.status 만 판정
 (broker 가 주입)      (mcp.json — 값은 broker 가 해석)  (값 접근 없음)
```

- 비밀 저장은 전부 OS `safeStorage` 암호화. **git 에 비밀 커밋 금지.**
- **0130 의 `ctx.setProviderEnv` 경로는 제거됐다.** 획득 토큰을 provider `settings.json` 의 env 블록에
  평문으로 병합 기록하던 경로다. LLM 백엔드에 키가 필요하면 사용자가 직접 settings.json 에 적는다
  (handoff 0028 정책 — 노출 등급·책임이 사용자 소유임이 명확해진다).
- MCP 로 나가는 값은 여전히 `dist/.../.mcp.json` 에 평문으로 렌더된다 — claude CLI 가 서버를 spawn
  하기 때문이다. 이는 문서화된 잔여 노출이며 경계표는 `docs/arch/backend/security.md §1.4-b`.

## 4. 폐쇄망 빌드/배포

- **빌드는 회사가 수행한다** (모듈이 컴파일 타임 코드이므로): 사내 npm 미러/오프라인 캐시로 `npm ci` → `npm run build:win` (electron-builder, publish 없음).
- **자동 업데이트**: 피드가 설정되지 않으면 updater 는 이미 noop 으로 저하된다(`feed-not-configured`, `app/src/main/app/updater.ts`). 외부 GitHub Releases 피드는 폐쇄망에서 자연히 불능이다. 사내 피드는 `orca.json` 의 `update` 로 **코드 수정 없이** 지정한다(스키마·조립: `infra/config/orca-file.ts`·`app/updater-feed.ts`):
  - **오브젝트 스토리지(권장, MinIO/S3-호환)** — `{ "update": { "provider": "s3", "bucket": "orca-updates", "endpoint": "http://minio.internal:9000", "path": "win" } }`. `endpoint` 를 주면 electron-updater 가 `${endpoint}/${bucket}[/${path}]` 를 base URL 로 삼는다(사내 MinIO). `endpoint` 를 생략하면 AWS S3(`region` 사용). 여기에 `latest.yml`·installer·`.blockmap` 을 올린다.
  - **임의 HTTPS 정적 호스트** — `{ "update": { "provider": "generic", "url": "https://updates.internal/orca/" } }`.
  - **GitHub Enterprise(사내 GHE)** — `{ "update": { "provider": "github", "owner": "infra", "repo": "orca", "host": "github.company.com" } }`. 폐쇄망에서 GitHub base URL 이 바뀌는 경우 `host`(필요 시 `protocol`)로 지정한다.
  - **비활성** — `{ "update": { "enabled": false } }`.
  - ⚠️ electron-updater 런타임은 s3 버킷을 **익명 GET(공개 읽기) 정적 HTTP** 로 취급한다(AWS 서명 안 함) — 버킷/prefix 를 사내에서 anonymous read 로 노출하거나 리버스 프록시로 서빙해야 한다. 비밀/토큰은 저장하지 않는다.
  - 빌드 산출물(`app/dist/*-setup.exe`·`latest.yml`·`.blockmap`)을 위 호스트에 업로드하는 것은 회사 배포 절차의 몫이다(electron-builder `publish` 를 사내 타깃으로 바꾸거나, `--publish never` 빌드 후 수동 업로드).
- 외부 네트워크 의존은 그 외에 없다 — LLM 백엔드는 provider settings.json 의 `ANTHROPIC_BASE_URL` 등으로 사내 게이트웨이를 가리킨다(TRD §6.8 레시피 표).

## 5. 보안 경계 (알고 시작할 것)

- renderer 로그인 게이트는 **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다(현행 아키텍처 동일). 실제 접근 통제는 사내 네트워크/서비스 인증이 담당한다.
- auth provider 의 `exec`/browser session 은 강력한 능력이다 — 회사 브랜치의 **컴파일 타임 코드**라서만 허용된다(런타임 로딩 금지의 이유). 브라우저 창은 앱 세션과 격리된 `persist:auth.<sessionGroup>` 파티션 + sandbox 로 열리고, **쿠키를 호출자에게 반환하지 않는다**.
- provider 에게 vault **전체**·cookie API·`process.env` 전체를 주지 않는다 — 자기 네임스페이스와 descriptor 의 `allowedOrigins` 안에서만 움직인다. 미선언 origin 요청·redirect 는 거부된다.
- `exec` 가 spawn 하는 자식은 `process.env` 를 통째로 상속하지 않는다(PATH/HOME/locale + 호출자 명시분만).
- prod 게이트에는 bypass 백도어가 없다(디버그 bypass 는 DEV 빌드 전용).
- binding 은 **영속하지 않는다** — 매 앱 실행마다 인증부터 시작한다. ADFS 처럼 브라우저 세션이 살아 있으면 창 없이 즉시 통과한다.

## 6. 참고

- 핸드오프: `docs/handoff/0130-closed-network-extension-points/` (설계 근거·인수 기준)
- 선행 결정: `docs/arch/backend/standardization.md §5.1` (opt-in 정적 provider 계약, 0098/0099)
- IPC 채널: `docs/IPC_CONTRACT.md` §2.13-c `auth` 도메인
- 인증 플랫폼 설계 정본: `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` · 핸드오프 `docs/handoff/0157-auth-plugin-platform/`
