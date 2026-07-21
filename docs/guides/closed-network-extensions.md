# 폐쇄망(사내) 배포 — 외부확장 구현 가이드 (0130)

회사 폐쇄망에 Orca 를 배포할 때, main 브랜치를 수정하지 않고 **커스텀 SSO 로그인 체인**과 **정적 사용량 provider** 를 붙이는 방법의 정본. 대상 독자는 Orca 내부 구조를 모르는 외부 에이전트/사내 개발자다.

## 1. 구조 — 불변 확장점 2파일 + opt-in 레지스트리

main 브랜치는 다음만 제공하고, 회사별 구현은 전부 회사 포크/브랜치의 모듈 디렉토리에 둔다:

| 확장점 | 동결 계약 파일 (생성 후 불변) | opt-in 레지스트리 (배럴 한 줄) | 자족 가이드 |
|---|---|---|---|
| A. SSO 로그인 체인 | `app/src/main/contracts/sso.ts` | `app/src/main/features/sso/modules/index.ts` | `features/sso/modules/AGENTS.md` |
| B. 정적 사용량 provider | `app/src/main/contracts/usage-report.ts` | `app/src/main/features/providers/static/modules/index.ts` | `features/providers/static/modules/AGENTS.md` |

- **불변 정책 (additive-optional-only)**: 두 계약 파일은 optional 멤버 *추가*만 허용된다(기존 회사 모듈이 계속 컴파일되도록). 제거·개명·required 화는 금지. 파괴적 변경은 `contracts/sso-v2.ts` 식의 병행 파일 신설로만.
- **명시적 배럴 등록**: 모듈은 컴파일 타임 코드다. 런타임 동적 로딩(임의 경로 require)은 보안·타입검증 양면에서 금지.
- **기본 = 비활성**: 신규 설치는 SSO 모듈 null + usage provider 0개. 게이트/사용량 연동은 등록해야만 켜진다.

## 2. 포크/브랜치 전략 — main 을 손상하지 않기

- 회사 브랜치는 upstream main 을 추적(rebase/merge)한다.
- **touch-only 목록** — 회사 브랜치가 수정해도 되는 곳은 아래 4곳뿐이다. 이 밖의 수정은 upstream 추적 시 병합 충돌·동작 회귀를 만든다:
  1. `app/src/main/features/sso/modules/<회사명>/**` (신규 디렉토리)
  2. `app/src/main/features/sso/modules/index.ts` (배럴 한 줄)
  3. `app/src/main/features/providers/static/modules/<회사명>/**` (신규 디렉토리)
  4. `app/src/main/features/providers/static/modules/index.ts` (배럴 한 줄)
- 게이트: `cd app && npm run lint && npm run typecheck` (+ 가능 환경에서 `npm test`).

## 3. SSO ↔ usage ↔ LLM 백엔드 토큰 흐름

SSO 모듈이 획득한 토큰은 세 경로로 전달된다 (`contracts/sso.ts` `SsoContext`):

```
login(ctx) ─┬─ ctx.secret.set(...)                       → 모듈 전용 캐시 (restore 복원용)
            ├─ ctx.providerSecrets(<adapter>-<provider>) → usage provider 가 ctx.secret /
            │                                              ${SECRET:name} 으로 읽음
            └─ ctx.setProviderEnv(adapter, provider, {…}) → provider settings.json env 병합
                                                            (LLM 백엔드 subprocess env — 다음 턴부터)
```

- 비밀 저장은 전부 OS `safeStorage` 암호화(SecretStore). **git 에 비밀 커밋 금지.**
- `setProviderEnv` 는 settings.json 에 **리터럴(평문)** 로 기록된다 — 사용자가 직접 쓰는 API 키와 동일 노출 등급. 원치 않으면 이 경로를 쓰지 않으면 된다.

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
- SSO 모듈의 `exec`/`openAuthWindow` 는 강력한 능력이다 — 회사 브랜치의 컴파일 타임 코드라서만 허용된다. 브라우저 창은 앱 세션과 격리된 `sso` 파티션 + sandbox 로 열린다(`docs/arch/backend/security.md`).
- prod 게이트에는 bypass 백도어가 없다(디버그 bypass 는 DEV 빌드 전용). 오프라인 저하 모드(캐시 세션 신뢰)는 모듈 `restore()` 재량이다.

## 6. 참고

- 핸드오프: `docs/handoff/0130-closed-network-extension-points/` (설계 근거·인수 기준)
- 선행 결정: `docs/arch/backend/standardization.md §5.1` (opt-in 정적 provider 계약, 0098/0099)
- IPC 채널: `docs/IPC_CONTRACT.md` sso 도메인
