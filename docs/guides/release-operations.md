# 릴리스 운영 가이드 (Windows unsigned NSIS + GitHub Releases)

Orca 의 사내용 릴리스 절차 정본. 파이프라인 구성은 핸드오프 [`0087-cicd-release-pipeline`](../handoff/0087-cicd-release-pipeline/plan.md), 업데이트 클라이언트 설계는 0084/0085 참조.

## 구조 한눈에

| 구성 요소 | 값 |
|---|---|
| 배포 채널 | GitHub Releases (`muzaby/orca-skin`, public) — `v*` 태그 push 시 **즉시 게시** |
| 산출물 | `orca-<ver>-setup.exe` (NSIS installer) + `latest.yml` + `.blockmap` |
| 릴리스 CI | [`.github/workflows/release.yml`](../../.github/workflows/release.yml) — `v*` 태그 push 트리거, `windows-latest` |
| 상시 게이트 | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — main push + **모든 PR**(둘 다 `app/**`·`.github/workflows/**` 변경 시) + 수동 실행(`workflow_dispatch`) |
| 버전 진실원 | `app/package.json` `version` (렌더러 `__APP_VERSION__` · main `app.getVersion()` 모두 파생) |
| 서명 | **없음** (사내용) — 무결성은 HTTPS + `latest.yml` sha512 로 보장 (아래 §unsigned) |
| 업데이트 클라이언트 | electron-updater (0085 배선: `autoDownload=false` · idle-gated 설치 · published release 만 감지) |

## 릴리스 절차

1. **버전 bump**: 워킹트리를 clean 상태로 만든 뒤(먼저 다른 변경을 커밋), `app/` 에서 bump 스크립트 실행:
   ```bash
   cd app
   npm run release:minor    # = npm version minor: package.json + package-lock.json bump + "chore(release): vX.Y.Z" 커밋 + vX.Y.Z 태그를 원샷 생성
   ```
   - `release:patch` / `release:minor` / `release:major` 중 §버전 정책에 맞게 고른다. 태그 접두 `v` 는 release.yml 의 `v*` 트리거·`validate-release-version.mjs` 와 정합하며, package.json↔태그 일치가 자동 보장된다.
   - `npm version` 은 clean 트리를 요구한다(안전 가드) — dirty 면 실패하니 다른 변경을 먼저 커밋한다.
2. **push** (main 커밋 + 태그 함께):
   ```bash
   git push origin main --follow-tags
   ```
3. **CI 자동 수행** (release.yml, `v*` 태그 push 로 발동): 버전 검증(태그↔package.json) → 마이그레이션 가드(동기화+append-only) → lint/typecheck/test → NSIS 빌드 → **GitHub Release 즉시 게시** → 산출물 검증(sha512 대조) → workflow artifact 업로드.
4. **published release 확인**: GitHub Releases 에 자산 3종(`orca-<ver>-setup.exe`, `latest.yml`, `.blockmap`)이 있는지 확인한다. 게시 완료 시점부터 기존 설치본의 electron-updater가 새 버전을 감지한다.
5. **수동 시나리오 테스트** (아래 체크리스트) 수행. 문제가 있으면 아래 롤백 절차로 즉시 전파를 중단한다.

> **dry-run**: Actions 탭에서 release.yml 을 `workflow_dispatch` 로 수동 실행하면 게시 없이 빌드+검증만 수행하고 결과를 workflow artifact 로 남긴다 (파이프라인 자체 점검용).

## 버전 정책 (SemVer, pre-1.0)

`orca` 는 **0.1.0 에서 시작**한다. 1.0.0 GA 전까지 0.x 규약을 따른다:

| bump | 명령 | 예 | 언제 |
|---|---|---|---|
| patch | `npm run release:patch` | 0.1.0 → 0.1.1 | 버그·핫픽스 |
| minor | `npm run release:minor` | 0.1.0 → 0.2.0 | 기능·주목할 변경 (0.x 에서는 파괴적 변경도 minor 로 흡수) |
| major | `npm run release:major` | 0.x → 1.0.0 | 안정(GA) 마일스톤에서만 |

- **단조 증가만** — 다운그레이드 배포 금지. electron-updater `allowDowngrade` 기본 false + DB `DB_SCHEMA_TOO_NEW` 가드로 구버전은 새 스키마 위에서 기동 거부된다(롤백은 §롤백 절차).
- 새 DB 마이그레이션(`NNNN_*.sql` 추가)을 포함한 릴리스는 **최소 patch** 를 올린다.
- 삭제·재작업한 버전 번호는 재사용하지 않고 다음 번호로 전진한다.

## 업데이트 시나리오 수동 체크리스트

릴리스 태그를 push하기 **전** 로컬 또는 별도 테스트 산출물로 사전 점검하고, 게시 후에는 테스트 머신에서 구버전→신버전 흐름을 즉시 확인한다:

- [ ] **구버전 설치**: 직전 릴리스의 `orca-<old>-setup.exe` 설치 → 앱 실행 → 세션 생성·메시지 송수신으로 DB 데이터 생성.
- [ ] **신버전 공개**: 검증된 `v*` 태그를 push하여 release workflow가 published release를 생성하도록 한다.
- [ ] **감지**: 구버전 앱 재시작 → 헤더에 업데이트 버튼 노출 (0085 UX — 시작 시 1회 확인).
- [ ] **다운로드**: 버튼 클릭 → 안내 다이얼로그 → 다운로드 진행률 표시.
- [ ] **idle-gate 설치**: 턴 진행 중에는 설치가 거부되는지 확인 → idle 상태에서 설치 → 앱 재시작.
- [ ] **버전 확인**: 헤더에 `v<new>` 표시.
- [ ] **DB 마이그레이션**: 신버전에 새 마이그레이션이 있으면 `%APPDATA%/orca/orca.db.backup.before-<old>.<timestamp>` 백업 파일 생성 확인.
- [ ] **데이터 보존**: 기존 세션·메시지가 그대로 보이는지 확인.
- [ ] (선택) `orca.json` 의 `update` override 경로를 쓰는 경우 해당 피드로도 감지 확인. 지원 provider: `github`(옵션 `host`=GitHub Enterprise) · `generic`(정적 HTTPS `url`) · `s3`(오브젝트 스토리지 — `bucket`+옵션 `endpoint`=MinIO/S3-호환·`region`·`path`) · `{ enabled: false }`(비활성). 스키마·조립은 `infra/config/orca-file.ts`·`app/updater-feed.ts`, 폐쇄망 배포는 [`closed-network-extensions.md §10`](./closed-network-extensions.md).

## 롤백 절차

원칙: **롤백보다 수정 patch 버전 전진 배포를 권장** (예: v0.1.1 문제 → v0.1.2 로 수정 배포). 전진 배포가 불가능할 때만 아래를 사용한다.

### 서버측 (전파 중단)

1. 문제 release 를 **draft 로 되돌리거나 삭제** (GitHub Releases UI, 또는 `gh release edit v0.1.1 --draft`).
2. 이후 electron-updater 는 직전 published release 를 latest 로 본다 — **아직 업데이트하지 않은** 클라이언트는 더 이상 문제 버전을 받지 않는다.
3. 필요하면 태그도 삭제(`git push origin :refs/tags/v0.1.1`). 삭제한 버전 번호는 재사용하지 않는다(클라이언트 캐시·혼동 방지 — 다음 번호로 전진).

> **한계**: 이미 업데이트를 마친 클라이언트는 자동으로 되돌아가지 않는다 (electron-updater `allowDowngrade` 기본 false + semver 비교). 그 클라이언트는 아래 클라이언트측 절차 필요.

### 클라이언트측 (개별 머신 복구)

새 버전에서 DB 마이그레이션이 실행됐다면 구버전 앱은 부팅 시 `DB_SCHEMA_TOO_NEW` 로 **의도적으로 기동 거부**한다 (`migrate.ts` 다운그레이드 가드). 순서:

1. 앱 종료 → 제어판/설정에서 Orca 제거 (사용자 데이터 `%APPDATA%/orca` 는 유지됨).
2. 구버전 `orca-<old>-setup.exe` 설치 (GitHub release 자산 또는 CI workflow artifact 에서 확보).
3. **DB 복원**: `%APPDATA%/orca/` 에서
   - `orca.db` 를 다른 이름으로 보관(포렌식용),
   - 마이그레이션 직전 백업 `orca.db.backup.before-<old-ver>.<timestamp>` 를 `orca.db` 로 복사,
   - 남아 있는 `orca.db-wal` / `orca.db-shm` 파일 삭제 (백업은 `VACUUM INTO` 산출이라 WAL 불필요).
4. 구버전 앱 실행 → 데이터 확인. (백업 시점 이후에 쓴 데이터는 유실된다 — 마이그레이션 이후 발생분.)

## unsigned 배포 주의사항

- **서명이 없다** — 파이프라인·electron-builder 설정 어디에도 인증서/`CSC_*` 가 없으며 의도된 상태다(사내용). 추후 서명 도입 시 `win.certificateFile` 계열 설정 + CI secrets 추가만으로 전환 가능.
- **SmartScreen**: 브라우저로 setup.exe 를 처음 내려받아 실행하면 Mark-of-the-Web 때문에 "Windows의 PC 보호" 경고가 뜬다 → **추가 정보 → 실행**. 인앱 자동 업데이트가 받는 파일에는 MOTW 가 붙지 않아 통상 경고가 없다.
- **무결성 근거**: 다운로드는 HTTPS(GitHub) + `latest.yml` 의 sha512 를 electron-updater 가 다운로드 시 강제 대조한다. 이 sha512 는 release.yml 의 `validate-dist.mjs` 가 빌드 시점에 실파일과 대조해 고정한다.
- **저장소 public 전제**: 저장소를 private 으로 전환하면 클라이언트 피드가 깨진다(토큰 필요). 전환 전 배포 채널 재설계 필요.

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| release.yml 이 버전 검증에서 실패 | 태그 ≠ `app/package.json` version. 태그 삭제 → 버전 커밋 반영 → 재태그 |
| 마이그레이션 가드 실패 (append-only) | 머지된 `NNNN_*.sql` 이 수정/삭제됨 — 금지. 변경은 새 번호 파일로 |
| 마이그레이션 가드 실패 (sync) | `migrations/` 디렉토리와 `migrate.ts` import 불일치(잉여/누락 .sql). 둘을 정합화 |
| 앱이 업데이트를 감지 못함 | 1순위: tag workflow가 아닌 `workflow_dispatch` dry-run으로 실행했는지 확인. 그 외: release가 draft 상태, 버전이 semver로 더 낮음, `orca.json` `update.enabled=false` |
| 같은 태그 재실행 시 업로드 충돌 | 기존 release에 동명 자산이 남아 있음 — 실패 버전 번호를 재사용하지 말고 다음 patch 버전으로 전진 |
| 구버전 설치 후 앱이 안 뜸 | `DB_SCHEMA_TOO_NEW` 다운그레이드 가드 — 위 클라이언트측 롤백 3단계(DB 백업 복원) 수행 |
| CI 에서 better-sqlite3 로드 실패 | `ensure-sqlite-abi.mjs` 훅 순서 전제(`npm ci`→test→build) 위반 여부 확인 — `npx electron-builder` 직접 호출 금지 |
