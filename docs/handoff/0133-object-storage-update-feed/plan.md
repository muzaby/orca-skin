# Plan — 0133-object-storage-update-feed

## 메타

| 항목 | 값 |
|---|---|
| slug | `0133-object-storage-update-feed` |
| 작성자 | Claude Code |
| 일자 | 2026-07-21 |
| 매핑 | PHASES 행 / PR (구현 후 기재) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "object storage 로 업데이트 할 수 있도록 updater 및 관련 스키마를 구성하라. aws s3 로도 할 수 있겠지만, 폐쇄망 내에서 구현한 minio 같은 오픈소스로도 운영될 수 있으니 지원하라. 폐쇄망에서는 github 또한 base url 이 변경되는 것을 참고하라" | 라이브 세션 요청 |
| 추론 의도 | ① s3 는 first-class provider(수동 URL 조립이 아니라 bucket/endpoint 필드) ② MinIO 지원 = 커스텀 `endpoint` ③ "github base url 변경" = GitHub Enterprise `host` override | (해석 — 명시 요구에서 파생) |

## Context (왜)

폐쇄망 운영 시 업데이트 산출물(installer + `latest.yml` + blockmap)을 GitHub Releases 가 아니라 오브젝트 스토리지(AWS S3 또는 사내 자체호스팅 MinIO 등 S3-호환)에 두고 배포해야 한다. 폐쇄망의 GitHub 도 GitHub Enterprise 로 base URL(host)이 바뀐다. 현재 `orca.json` `update` 스키마는 `github`(owner/repo)·`generic`(url) 만 지원해 이 두 시나리오를 코드 수정 없이 표현할 수 없다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 현 스키마는 Disabled/Github/Generic 3-union. github=owner+repo, generic=url | `app/src/main/infra/config/orca-file.ts:12-46` |
| `configureFeed()` 가 `getOrcaConfig().update` 를 읽어 `setFeedURL` 로 넘김. 피드 미설정 시 noop | `app/src/main/app/updater.ts:202-220`, `:116-119` |
| `AutoUpdaterPort.setFeedURL?(options: unknown)` — 옵션 타입이 unknown 이라 포트 변경 불필요 | `app/src/main/app/updater.ts:24` |
| electron-updater@6 은 `setFeedURL` 의 s3/spaces 옵션을 런타임에 `getS3LikeProviderBaseUrl` 로 generic base URL 로 변환. `endpoint` 지정 시 `${endpoint}/${bucket}` → MinIO/S3-호환 | electron-updater `providerFactory` s3→GenericProvider + builder-util-runtime `getS3LikeProviderBaseUrl`/`s3Url` (electron-updater@^6.8.9, `app/package.json:41`) |
| github provider 는 `host`(+`protocol`) 로 GitHub Enterprise 지원 | electron-updater `GithubOptions.host` |
| electron 을 import 하는 모듈은 순수 vitest 로드 불가 → electron-free 분리 선례 | `INDEX.md` 0124 (`infra/log/registry.ts` 분리) |
| 폐쇄망 배포 정본 가이드가 이미 존재(generic 피드 언급) | `@docs/guides/closed-network-extensions.md §4` |

## 인수 기준 (Acceptance Criteria)

1. `orca.json` `update` 가 `provider: 's3'` 를 수용한다: `bucket`(필수) + `region?`·`endpoint?`(url)·`path?`·`channel?`.
2. `provider: 'github'` 가 `host?`·`protocol?`(GitHub Enterprise) 를 추가 수용한다.
3. 잘못된 s3 설정(bucket 누락, endpoint 비-URL)은 최상위 스키마 위반으로 기본값 처리된다.
4. `resolveUpdateFeed` 순수함수가 5분기(미설정/disabled/github/generic/s3)를 정확히 조립하고, 미설정 필드는 옵션에서 생략한다.
5. `configureFeed()` 가 `resolveUpdateFeed` 결과로 `setFeedURL`(feed 있을 때만) 호출 + disabled 반환. 기존 동작(피드 미설정=내장 publish, enabled:false=noop) 보존.
6. 신규 의존성 0. 레이어 경계 위반 0. 기존 update 테스트 무회귀.
7. 폐쇄망 가이드/릴리스 운영 문서에 s3(MinIO)·github host 예시가 반영된다.

## 범위 / 비범위

- **범위**: 런타임 업데이트 피드 스키마 + 피드 해석 + 문서.
- **비범위**: 빌드-타임 `electron-builder.yml` publish 타깃 전환, CI 대체, Google Fonts 번들링(별도 후속). 실 산출물 업로드 절차(운영).

## 의존 기술 / 전제

- electron-updater@6 의 s3→generic 변환 + github host. 기존 채택 의존성 — **신규 의존성 없음**.
- 전제: 폐쇄망 MinIO/S3 버킷·prefix 가 익명 GET 으로 `latest.yml`/installer 를 서빙(electron-updater 런타임은 AWS 서명 안 함).

## 설계

- **스키마**(`orca-file.ts`): github 에 `host`/`protocol` optional 추가, 신규 `S3UpdateConfigSchema`, Disabled 에 `'s3'`+신규 필드 optional 수용, union 확장.
- **피드 해석**(신규 `app/src/main/app/updater-feed.ts`, electron-free 순수): `resolveUpdateFeed(update) → { disabled, feed? }`. `import type { UpdateConfig }` 만 사용.
- **updater**(`updater.ts`): `configureFeed()` 를 `resolveUpdateFeed` 위임으로 축약. 포트/타입 무변경.
- 재사용: `getOrcaConfig().update`, zod union 패턴, `orca-file.test.ts` 패턴.
- 경계: `updater-feed.ts` 는 app 레이어(순수), infra 타입만 import — 하향 의존 준수.

## 파생 UX / 엣지케이스

- s3 endpoint 없음 = AWS S3 글로벌, 있음 = MinIO/사내. region 은 endpoint 있으면 URL 에 미반영(electron-updater 규약) — 문서 명시.
- github host 없음 = github.com(현행). 있음 = GHE.
- disabled 상태에서 provider 설정 보존(스키마 통과) — Disabled 필드 optional 수용.

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| electron-updater 의 s3 런타임 변환 동작을 이 환경에서 실측 불가(egress 차단) | 스키마·순수함수 단위테스트로 조립 검증. 실 피드 다운로드는 사람/CI 실기 대기로 명시 |
| s3 버킷 익명 접근 전제 | 문서에 접근권한 주의 기재 |

## 영향 받는 파일

- `app/src/main/infra/config/orca-file.ts` (+`orca-file.test.ts`)
- `app/src/main/app/updater-feed.ts` (신규) + `updater-feed.test.ts` (신규)
- `app/src/main/app/updater.ts`
- `docs/guides/closed-network-extensions.md`, `docs/guides/release-operations.md`

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립).
- 순수 스위트: `orca-file.test.ts` + `updater-feed.test.ts` (DB/electron 미로드).
- 실 피드/electron 패키징 = 사람/CI 실기 대기(electron egress 베이스라인).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론 표기.
- [x] 자료조사 — 발견에 `파일:라인`·라이브러리 근거 부착.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 0 확인.
- [x] 파생 UX — endpoint/region/host/disabled 엣지 펼침.
- [x] 리스크 — egress 실측 한계를 사람/CI 로 분리.

---

> **[구현자 기입]** — Claude 직접 구현(비기능 확장 = plan→impl→verify 전담).

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `orca-file.ts`·`orca-file.test.ts`·`updater.ts`·신규 `updater-feed.ts`+`updater-feed.test.ts`·`closed-network-extensions.md`·`release-operations.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run orca-file.test.ts updater-feed.test.ts` |
| 게이트 결과 | lint 0 error(1 pre-existing warning 무관) ✅ / typecheck 3분할 ✅ / 순수 vitest 20/20 ✅ |
| 블로커 / 역질문 | 없음 (실 피드/electron 패키징 = egress 차단으로 사람·CI 실기 대기) |
| 대상 커밋 | `7d8de3e` |
