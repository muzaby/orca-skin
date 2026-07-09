# Plan — 0087-cicd-release-pipeline

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0087-cicd-release-pipeline` |
| 작성자 | Claude Code |
| 일자 | 2026-07-09 |
| 매핑 | PHASES Phase 3++ 후속 (OQ3 release-ops 1차분) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① CI/CD 구성 (타겟: 윈도우, 설치파일) ② 서명 없음 — 개인용·사내용 unsigned NSIS installer ③ 앱 버전 0.1.0 으로 수정 ④ internal-release CI 가 installer·latest.yml·blockmap 을 업데이트 서버에 게시 ⑤ 버전 검증·DB 마이그레이션 검증·업데이트 시나리오 테스트·롤백 절차 포함 | 라이브 세션 요청 (2026-07-09): "cicd 구성 / 타겟: 윈도우, 설치파일 / 제약: 서명 없음 / 버전 0.1.0 / internal-release CI 에서 installer·latest.yml·blockmap 을 내부 업데이트 서버에 게시하고 버전 검증·DB 마이그레이션 검증·업데이트 시나리오 테스트·롤백 절차까지 구성" |
| 명시 요구 (AskUserQuestion 확정) | 게시 대상=**GitHub Releases 유지**(별도 내부 서버 대신), 트리거=**`v*` 태그 push**, 러너=**GitHub-hosted `windows-latest`**, 업데이트 시나리오 테스트=**CI 자동 검증 + 수동 체크리스트 문서**(실 설치 스모크 자동화는 비범위) | 라이브 세션 AskUserQuestion 답변 (2026-07-09) |
| 추론 의도 | "내부 업데이트 서버" = 사내 배포 채널의 의미 — GitHub Releases 선택으로 **draft release 를 수동 게이트로 쓰는 사내 릴리스 채널**로 해석. "업데이트 시나리오 테스트"는 사용자 선택에 따라 CI 파이프라인 자동 검증(버전·마이그레이션·산출물 정합) + 수동 시나리오 문서로 해석 (추론) | 사용자 선택지 답변 조합에서 유도 |

## Context (왜)

앱 쪽 자동 업데이트 클라이언트는 0084(하드닝)·0085(UX)·0086(디버그 하네스)로 완성됐지만, **배포-타임 release-ops 는 OQ3 로 명시 연기**되어 있었다(`0085-auto-update-ux/plan.md` 비범위: "CI·채널·staged rollout…"). 저장소에는 `.github/` 자체가 없어 CI 가 전무하다. 이번 작업은 그 공백을 채운다: unsigned NSIS installer 를 빌드·검증·게시하는 릴리스 파이프라인 + 상시 PR/push 게이트 + 릴리스 운영 문서(수동 시나리오·롤백).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| CI 전무 — `.github/` 디렉토리 자체가 저장소에 없음 | 저장소 루트 트리 (2026-07-09 조사) |
| `publish: github/muzaby/orca-skin/draft` 이미 구성 — electron-builder 가 draft release 에 자산 업로드. 저장소는 **public** 이라 electron-updater github provider 가 런타임 토큰 없이 동작 | `app/electron-builder.yml:45-49` · GitHub API `visibility: public` (2026-07-09 조회) |
| 런타임 피드 기본값 = GitHub Releases `muzaby/orca-skin`, `orca.json.update` 로 override 가능(github/generic) | `app/src/main/app/updater.ts` `configureFeed` · `app/src/main/infra/config/orca-file.ts:14-45` |
| NSIS 기본 타깃 — `artifactName: ${name}-${version}-setup.${ext}` → `orca-<ver>-setup.exe` + `latest.yml` + `.blockmap` 이 `app/dist/` 에 기본 산출 | `app/electron-builder.yml:20-24` · electron-builder 26 NSIS 기본 동작 (https://www.electron.build/nsis) |
| 서명 설정 없음(`win.certificateFile`/`signtoolOptions` 부재) = 이미 unsigned. electron-updater 는 `publisherName` 미설정 시 Authenticode 검증을 건너뛰고, 다운로드 무결성은 latest.yml 의 sha512 로 강제 | `app/electron-builder.yml:18-19` · electron-updater 소스 (https://github.com/electron-userland/electron-builder — NsisUpdater verifySignature) |
| 버전 단일 진실원 = `app/package.json` (현재 `1.0.0`) → 렌더러 `__APP_VERSION__` define + main `app.getVersion()` 모두 파생. 그 외 `1.0.0` 참조는 전부 독립 픽스처/별개 버전 체계(builtin skills manifest·plugin.json)라 무변경 | `app/package.json:3` · `app/electron.vite.config.ts` define · `app/resources/builtin/skills/manifest.json:2`(별개) · `app/src/main/features/extensions/claude-plugin-package.ts:15`(별개) |
| better-sqlite3 네이티브 ABI 이중성 — `postinstall`/`prebuild`=electron ABI, `pretest`=node ABI 를 `ensure-sqlite-abi.mjs`(멱등·fingerprint 캐시·Windows-aware) 가 보장. `npmRebuild: false` 라 electron-builder 자동 재빌드 없음 → CI 스텝 순서는 `npm ci → test → build:win` 이어야 함 | `app/scripts/ensure-sqlite-abi.mjs` · `app/package.json:19,25-27` · `app/electron-builder.yml:44` |
| `npm run build:win -- --publish always` 는 스크립트 문자열 끝(`electron-builder --win`)에 인자가 붙어 `prebuild` ABI 훅이 보존됨 — `npx electron-builder` 직접 호출은 ABI 훅 우회라 금지 | `app/package.json:21` · npm run 인자 전달 규칙 (https://docs.npmjs.com/cli/commands/npm-run-script) |
| DB 마이그레이션 러너 — 이름 기반 전진 전용, `DbSchemaTooNewError`(`DB_SCHEMA_TOO_NEW`) 다운그레이드 가드, 적용 전 `VACUUM INTO <userData>/orca.db.backup.before-<ver>.<ts>` 백업. vitest 가 순서·미래 스키마 거부·백업 무결성을 이미 검증 | `app/src/main/infra/db/migrate.ts` · `app/src/main/infra/db/migrate.test.ts` |
| migrate.test.ts 의 `EXPECTED_MIGRATIONS` 는 `MIGRATION_NAMES` 배열만 고정 — **디렉토리의 잉여 .sql(import 누락)은 어떤 테스트도 못 잡음** → 동기화 검사 스크립트로 보완 여지 | `app/src/main/infra/db/migrate.test.ts` · `app/src/main/infra/db/migrations/` (0001~0012, 12개) |
| "머지된 마이그레이션 파일 절대 수정 금지" 규약 — 기계 강제 없음 → 릴리스 태그 간 git diff 로 강제 가능 | `app/AGENTS.md` §DB · `docs/arch/backend/persistence.md` |
| 게이트 정본 = `cd app && npm run lint && npm run typecheck && npm test`. `lint` 는 `--fix` 포함(수정 불가 오류는 여전히 실패) | `docs/handoff/AGENTS.md` §2 · `app/package.json:10` |
| 스크립트 하우스 패턴 — 의존성 0 ESM + pure 함수 export + 얇은 CLI + `node --test` 테스트. `lint` 가 `./scripts` 포함 | `app/scripts/ensure-sqlite-abi.mjs` · `app/scripts/ensure-sqlite-abi.test.mjs` · `app/package.json:10,14` |
| `docs/guides/` 운영 가이드 선례 존재 | `docs/guides/workspace-isolation-permissions.md` (0074) |
| electron-updater 는 published release 만 피드로 봄(draft 미노출) + `allowDowngrade` 기본 false → 서버측 롤백은 전파 중단만 가능 | electron-updater GitHub provider 동작 (https://www.electron.build/auto-update) |
| `workflow_dispatch` 는 워크플로 파일이 기본 브랜치에 있어야 실행 가능 | GitHub Actions 문서 (https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch) |
| 릴리스 이력 0건 (v* 태그·release 없음) → 1.0.0→0.1.0 하향이 업데이트 피드에 무해 | `git tag --list 'v*'` 빈 결과 · GitHub releases 0건 (2026-07-09 조회) |

## 인수 기준 (Acceptance Criteria)

1. `app/package.json` version 이 `0.1.0` 이고 package-lock.json 이 동기화되어 있다.
2. `.github/workflows/ci.yml` — `push(main)`·`pull_request`(paths: `app/**`, `.github/workflows/**`)·`workflow_dispatch` 트리거, `windows-latest` + Node 22 + npm 캐시에서 `npm ci → 마이그레이션 가드 → lint → typecheck → test` 를 실행한다.
3. `.github/workflows/release.yml` — `push: tags ['v*']` + `workflow_dispatch`(항상 dry-run) 트리거, `windows-latest`, `permissions: contents: write` 단일 job.
4. **버전 검증**: 태그 릴리스 시 `vX.Y.Z` 태그가 strict semver 이고 `app/package.json` version 과 정확히 일치하지 않으면 빌드 전에 실패한다 (`app/scripts/validate-release-version.mjs`).
5. **DB 마이그레이션 검증**: (a) 기존 vitest 마이그레이션 테스트가 게이트에 포함되고, (b) `app/scripts/check-migrations-appendonly.mjs` 가 ①`migrations/*.sql` ↔ `migrate.ts` `?raw` import 집합 동기화(형식·연속 번호·중복·잉여/누락) ②직전 `v*` 태그 대비 기존 마이그레이션 파일의 수정/삭제/개명(append-only 위반) 을 검출한다. 이전 태그가 없으면 ②는 공지 후 스킵.
6. **빌드+게시**: 태그 트리거 시 `npm run build:win -- --publish always` 로 GitHub **draft** release 에 `orca-X.Y.Z-setup.exe`·`latest.yml`·`.blockmap` 이 업로드된다. dispatch(dry-run) 시 `--publish never` 로 게시 없이 빌드만 한다.
7. **산출물 검증**: 빌드 후 `app/scripts/validate-dist.mjs` 가 `dist/latest.yml` 의 version==기대 버전, 참조 setup.exe 존재+sha512 재계산 일치+size 일치, `.blockmap` 존재를 검증한다. dist 3종은 항상 workflow artifact 로도 업로드된다.
8. **unsigned 유지**: 워크플로·electron-builder 설정 어디에도 서명 설정/`CSC_*` env 가 없고, 그 사실이 워크플로 주석과 운영 문서에 명시된다.
9. 신규 스크립트 3종은 하우스 패턴(의존성 0, pure export + CLI)을 따르고 `node --test` 테스트를 동반하며, `npm test` 가 `scripts/` 의 모든 `*.test.mjs` 를 실행하도록 갱신된다.
10. `docs/guides/release-operations.md` (한국어) — 릴리스 절차(draft Publish=배포 시점), 업데이트 시나리오 수동 체크리스트(구버전 설치→신버전 publish→인앱 업데이트→버전·DB 마이그레이션·백업 확인), 롤백 절차(서버측 전파 중단 + 클라이언트측 구버전 재설치·`DB_SCHEMA_TOO_NEW`·백업 복원), unsigned/SmartScreen 주의·트러블슈팅을 담는다.
11. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test` (본 환경의 electron 바이너리 제약은 verify 에서 명시).

## 범위 / 비범위

- **범위**: 인수 기준 1~11 (CI 2종 워크플로 + 검증 스크립트 3종 + 버전 0.1.0 + 릴리스 운영 문서 + 핸드오프 산출물).
- **비범위**: 코드 서명(OV/EV 인증서·`verifyUpdateCodeSignature`) — 사용자 제약으로 명시 제외. 별도 내부 HTTPS 업데이트 서버(generic provider 전환) — GitHub Releases 유지 확정, `orca.json.update` override 경로는 문서 언급만. 채널(beta/latest)·staged rollout·텔레메트리(OQ4)·라이센스(OQ5) — OQ3 후속. 실 설치 e2e 스모크 자동화 — 사용자 선택으로 비범위. macOS/Linux 배포 — 타겟 윈도우 한정(N1).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `electron-builder ^26`(NSIS+publish), `electron-updater ^6.8.9`(0085 배선), `scripts/ensure-sqlite-abi.mjs`(ABI 훅), `migrate.test.ts`(마이그레이션 게이트), `publish: github/draft` 설정 그대로.
- GitHub Actions: `actions/checkout@v4`(fetch-depth 0 + fetch-tags), `actions/setup-node@v4`(Node 22 + npm 캐시), `actions/upload-artifact@v4`, 내장 `secrets.GITHUB_TOKEN`(`contents: write`).
- 전제: 저장소 public 유지(전환 시 클라이언트 피드에 토큰 필요 — 운영 문서에 주의 기재), Node 22 가 `@types/node ^22` 와 정합.
- **신규 npm 의존성: 0** (latest.yml 은 전용 미니 파서로 처리 — 신규 의존성 승인 절차 불필요).

## 설계

- **ci.yml (상시 게이트)**: docs 위주 저장소라 paths 필터(`app/**`, `.github/workflows/**`) 적용. `windows-latest` 채택 이유 = 배포 타깃과 동일 플랫폼에서 better-sqlite3 Windows prebuild + `ensure-sqlite-abi.mjs` 의 `npm.cmd` 분기가 실기됨. concurrency 로 중복 실행 취소. 마이그레이션 가드를 PR 시점에도 실행해 릴리스 전에 조기 검출.
- **release.yml (internal-release)**: fail-fast 순서 — 의존성 없는 버전 검증·마이그레이션 가드를 `npm ci` 앞에 배치 → 게이트 → 빌드+게시 → 산출물 검증 → artifact 업로드. 태그/dispatch 분기는 step-level `if: github.ref_type == 'tag'`. draft 유지로 **release Publish 가 수동 배포 게이트** (electron-updater 는 published 만 봄).
- **스크립트 3종** (`app/scripts/`, 하우스 패턴 = `ensure-sqlite-abi.mjs` 미러): pure 함수를 export 하고 CLI 셸에서만 fs/git 접근 → `node --test` 로 순수 로직 검증. `npm test` 를 `vitest run && node --test scripts/` 로 변경해 자동 포함.
  - `validate-release-version.mjs`: `validateReleaseVersion({ tag, packageVersion })` — strict semver(`X.Y.Z`) + `tag === 'v'+version`.
  - `check-migrations-appendonly.mjs`: `parseImportedMigrations(migrateSource)`(정규식으로 `?raw` import 추출) + `checkSync(files, imported)` + `checkAppendOnly(nameStatusLines)`.
  - `validate-dist.mjs`: `parseLatestYml(text)`(electron-builder flat 스키마 전용: version/files[]/path/sha512/size) + `validateDist(...)`(sha512 base64 재계산 대조 — latest.yml 의 값이 곧 electron-updater 가 다운로드 시 강제하는 무결성 앵커).
- **레이어 경계**: `app/src/**` 무변경(렌더러/main 코드 0) — 변경은 `app/package.json`·`app/scripts/`·`.github/`·`docs/` 한정이라 boundaries 영향 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 첫 릴리스(직전 `v*` 태그 없음) → append-only 검사는 동기화 검사만 수행하고 명시 공지 후 스킵.
- 같은 태그 재실행 → 기존 draft 에 동명 자산 충돌 가능 → 운영 문서에 "재실행 전 draft 삭제" 절차 기재.
- 태그 커밋의 package.json ≠ 태그 → 빌드 전 실패(의도된 동작, 에러 메시지에 두 값 명시).
- dispatch dry-run 은 태그 컨텍스트가 없으므로 버전 검증이 package.json semver 검사만 수행.
- 이미 신버전으로 업데이트한 클라이언트는 release 삭제로 다운그레이드되지 않음(`allowDowngrade` 기본 false) → 롤백 문서에서 클라이언트측 절차(구버전 재설치 + DB 백업 복원) 분리.
- 저장소가 private 으로 전환되면 클라이언트 피드가 깨짐 → 운영 문서 주의사항.
- UI/테마/a11y: N/A (렌더러 무변경).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `lint --fix` 가 CI 에서 auto-fixable 위반을 조용히 통과시킴 | 게이트 정본과의 parity 우선(수정 불가 오류는 여전히 실패). 필요 시 후속에서 `--no-fix` 검토 |
| windows 러너에서 네이티브 재빌드 2회(electron→node→electron) = 릴리스 job 소요 증가 | `setup-node` npm 캐시로 완화. electron 바이너리 캐시는 후속 최적화로 기록 |
| 미니 latest.yml 파서가 electron-builder 포맷 변화에 취약 | 모르는 형태면 시끄럽게 실패 + 단위 테스트로 현행 포맷 고정. js-yaml 의존 추가는 신규 의존성 규약상 회피 |
| unsigned → SmartScreen 경고·기업 정책 차단 가능 | 사용자 제약으로 수용(사내용). 운영 문서에 MOTW/SmartScreen 안내 + latest.yml sha512 무결성 논거 기재. 서명 도입 시 변경 지점(CSC secrets)만 문서화 |
| NSIS 빌드는 linux 개발 컨테이너에서 실기 불가 | 순수 로직은 `node --test` 로, 실빌드는 머지 후 dispatch dry-run 이 통합 테스트(verify 책임 분리표의 사람 확인 항목) |

- 되돌리기 어려운 결정: 없음 (워크플로·스크립트·문서는 전부 가역).
- **단독 결정 금지 항목(Open Question)** → 사용자: 없음 — 게시 대상·트리거·러너·테스트 수준·버전은 라이브 세션에서 확정됨. 잔여 OQ3 항목(서명·채널·staged rollout)은 비범위로 유지.

## 영향 받는 파일

- `app/package.json` · `app/package-lock.json` (version 0.1.0, test 스크립트)
- `.github/workflows/ci.yml` (신규) · `.github/workflows/release.yml` (신규)
- `app/scripts/validate-release-version.mjs` (+`.test.mjs`) · `app/scripts/check-migrations-appendonly.mjs` (+`.test.mjs`) · `app/scripts/validate-dist.mjs` (+`.test.mjs`) (신규)
- `docs/guides/release-operations.md` (신규)
- `docs/handoff/0087-cicd-release-pipeline/{plan,verify}.md` · `docs/handoff/INDEX.md` · `docs/PHASES.md`

## 참고 문서

- `docs/handoff/0084-app-distribution-auto-update/plan.md` (다운그레이드 가드·백업 설계)
- `docs/handoff/0085-auto-update-ux/plan.md` (updater 배선·OQ3 비범위 목록)
- `docs/arch/backend/persistence.md` (마이그레이션 규약)
- `docs/git-template.md` (커밋 trailer)
- IPC 변경: 없음 (IPC_CONTRACT 무관)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 스크립트 3종의 순수 로직 (`node --test`) — semver/태그 대조, `?raw` import 파싱·동기화·append-only 판정, latest.yml 파싱·sha512 대조.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청 인용으로 남겼고, AskUserQuestion 확정 사항과 추론을 분리 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`·웹 URL)를 붙였다.
- [x] 인수 기준 — 11개 번호 매김, 자료조사 근거, 검증 가능.
- [x] 의존 기술 — 재사용 모듈·Actions 의존·전제 식별, 신규 npm 의존성 0 확인.
- [x] 파생 UX — 첫 릴리스·태그 재실행·버전 불일치·dry-run·다운그레이드 불가·private 전환 엣지케이스를 펼쳤다 (렌더러 무변경이라 UI 계열 N/A).
- [x] 리스크 — lint --fix parity·빌드 시간·파서 취약성·unsigned·로컬 실빌드 불가를 완화책과 함께 적었고, Open Question 은 없음(전부 사용자 확정됨).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 전반(워크플로 2종 분리·fail-fast 순서·draft 수동 게이트·스크립트 하우스 패턴·신규 의존성 0). `npm run build:win -- --publish …` 인자 전달과 ABI 훅 보존은 npm 문서·로컬 확인으로 재검증했다.
- 이견 / 우려: 설계 §설계의 `npm test = vitest run && node --test scripts/` 는 **Node 22.22 에서 디렉토리 인자를 test entry 로 잘못 해석**해 실패한다(로컬 재현: `Cannot find module .../scripts`). glob 패턴 `node --test "scripts/*.test.mjs"` 로 조정 — node 러너가 자체 확장하므로 Windows cmd(글롭 비확장)에서도 동작. 설계 의도(스크립트 테스트 자동 포함)는 유지.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `node --test <dir>` 가 Node 22.22 에서 실패 (설계는 `scripts/` 디렉토리 인자 가정) | ✅ 구현함 — `"scripts/*.test.mjs"` 인용 glob 으로 변경 | 로컬 재현 + `node --test` glob 지원 (Node 21+) |
| 2 | latest.yml 의 `size` 가 문자열로 파싱되어 숫자 비교 시 불일치 가능 | ✅ 구현함 — `Number(entry.size) !== actualSize` 로 정규화 비교 | `validate-dist.mjs` · 테스트 고정 |
| 3 | 본 컨테이너에서 `npm ci` 의 electron postinstall 이 403 으로 실패 (알려진 환경 제약, 0019/0085 동일) | ✅ 대응 — `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 로 의존성 설치 후 게이트 실행. CI(windows-latest)에는 영향 없음(egress 정상) | npm 로그 · INDEX 0019/0085 비고 |

## [구현자 기입] 구현 체크리스트

- [x] `app/package.json` version 0.1.0 + lock 동기화 + test 스크립트 glob 화
- [x] `.github/workflows/ci.yml` · `.github/workflows/release.yml` (js-yaml 파스 확인)
- [x] 스크립트 3종 + `node --test` 테스트 3종 (24 tests)
- [x] `docs/guides/release-operations.md` (절차·수동 체크리스트·롤백·unsigned·트러블슈팅)
- [x] 게이트 실행 (아래 보고)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/package.json` · `app/package-lock.json` · `.github/workflows/{ci,release}.yml`(신규) · `app/scripts/validate-release-version.{mjs,test.mjs}` · `app/scripts/check-migrations-appendonly.{mjs,test.mjs}` · `app/scripts/validate-dist.{mjs,test.mjs}`(신규 6) · `docs/guides/release-operations.md`(신규) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `node --test "scripts/*.test.mjs"` / CLI 스모크(`validate-release-version` 일치·불일치, `check-migrations-appendonly` 실저장소 12개 sync ok + 첫 릴리스 스킵) |
| 게이트 결과 | lint ✅ / typecheck 3종 ✅ / test: vitest **773/773 passed** + node --test **24/24 passed** (vitest 3개 스위트는 electron 바이너리 403 환경 제약으로 로드 실패 — 0019/0085 와 동일 계열, 본 변경 무관·`src` 마이그레이션/업데이트 테스트는 전부 green) |
| 블로커 / 역질문 | 없음. 단 release.yml `workflow_dispatch` dry-run 과 실 NSIS 빌드는 main 머지 후에만 실기 가능(설계 §검증 방법 그대로) |
| 대상 커밋 | `fb72b1e` |
