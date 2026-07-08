# 0084 — 앱 설치 파일 배포 + 자동 업데이트 (설계 + 결정불요 하드닝)

> 앱 배포/자동 업데이트 구현 요청. 하드 요구 = **다중 버전 점프**(1.0.0 → 1.100.0)를 중간 버전 실행 없이 지원. 첨부 *Electron 업데이트 가이드* 의 Orca 환경 비판적 검토 포함.
> **범위 분할(사용자 확정)**: 이 핸드오프(0084)는 **외부 결정이 필요 없는 하드닝**(DB 다운그레이드 가드·WAL-안전 백업·settings 마이그레이션·안전 재시작 술어)만 다룬다 — **기능 구현 = Codex**. 서명/호스팅/updater provider/CI/UI 는 OQ3(PRD §11) 해소 후 **후속 핸드오프(0085)** 로 분리한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0084-app-distribution-auto-update` |
| 작성자 | Claude Code |
| 일자 | 2026-07-08 |
| 매핑 | PHASES "배포/자동 업데이트" (승격 시) / PR (draft) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 앱 설치 파일 배포 + 업데이트 구현 | 라이브 세션 요청: "앱 설치 파일 배포 및 업데이트 구현을 할 것이다" |
| 명시 요구 | 버전 다중 점프 지원 (1.0.0 → 1.100.0) | 라이브 세션 요청: "버전을 한 번에 여러개 올릴때도 지원되어야 한다" |
| 명시 요구 | 배포/업데이트 리스크 포인트 검토 + 첨부 가이드 비판적 검토 | 라이브 세션 요청: "리스크 포인트가 있다면 함께 검토하라", "비판적 검토하여 orca 환경 고려하라" |
| 명시 요구 | 전달 모델 = electron-updater 자동 업데이트 / 서명 = 우선 미서명→공개 전 서명 / 범위 = 결정불요 하드닝 우선 분리 | 라이브 세션 AskUserQuestion 3문항 확정 (2026-07-08) |
| 명시 요구 | uv/Python 런타임은 지난 핸드오프에서 제거됨 | 라이브 세션 사용자 정정 |
| 추론 의도 | "다중 버전 점프"의 실제 리스크는 앱 바이너리(비이슈)·DB(기존 러너로 이미 안전)가 아니라 *다운그레이드 시 구버전 앱↔새 DB* 와 *settings 무음 리셋* 이다 | 아래 자료조사 근거 (추론 → 인수 기준으로 승격) |

## Context (왜)

Orca 는 아직 어떤 배포/업데이트 경로도 없다. `electron-builder.yml` 은 electron-vite 스캐폴드 그대로(`publish` = placeholder), 서명·electron-updater·업데이트 코드 전무. 사용자는 Windows 설치형 자동 업데이트를 원하고, 특히 **오래된 사용자(1.0.0)가 최신(1.100.0)으로 한 번에 점프**해도 데이터·설정이 안전해야 한다.

핵심 통찰: **"다중 버전 점프" 는 대부분 이미 해결돼 있다.** (a) 앱 바이너리 점프는 NSIS full-installer full-replace 라 중간 버전이 불필요하고, (b) DB 마이그레이션 러너(`migrate.ts`)는 *이름 기반 전진 전용* 이라 적용 안 된 마이그레이션을 앱 버전 간격과 무관하게 전부 적용한다. 남는 **진짜 리스크**는 롤백/다운그레이드 시 구버전 앱이 새 스키마 DB 를 여는 경우와, settings 구조가 바뀌었을 때의 무음 리셋이다. 이 하드닝을 먼저 처리하면(0084), 이후 updater 배선(0085)은 OQ3 결정만 남는다.

## 자료조사 (Research)

### 코드/문서 현황

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `publish` = 스캐폴드 placeholder(`generic → https://example.com/auto-updates`), 코드 서명 없음, appId=`com.orca.app`, win NSIS(기본 oneClick=true·perMachine=false=per-user), `extraResources`=`resources/builtin` 만 | `app/electron-builder.yml:1,18-24,45-47` |
| electron-updater/autoUpdater 코드·IPC·UI 전무 | 코드 grep 0건 (`app/src/**`) |
| DB 마이그레이션 러너는 **이름 기반 전진 전용** — `_migrations(name PK, applied_at)` 에 없는 이름만 per-migration 트랜잭션으로 적용. `user_version` 미사용. 12개 마이그레이션 존재 | `app/src/main/infra/db/migrate.ts:42-56`, `migrations/0001..0012` |
| DB 오픈 = `<userData>/orca.db`, WAL + foreign_keys, 부팅 시 `applyMigrations` (critical 스텝) | `app/src/main/infra/db/index.ts:12`, `app/src/main/app/bootstrap.ts` (initDb critical) |
| 설정 = electron-store(`orca-settings.json`), zod(`SettingsSchema`) 검증 실패 시 **기본값 폴백**(무음 리셋) | `app/src/main/infra/settings-store.ts`, `app/src/shared/protocol.ts` (SettingsSchema) |
| 앱 버전 = `app.getVersion()`(main)·`__APP_VERSION__`(renderer, Header 표시) | `bootstrap.ts`, `electron.vite.config.ts`, `Header.tsx` |
| shutdown 이 open tool run settle·controller abort·idle runtime close 수행 (안전 재시작 결선 지점) | `app/src/main/app/bootstrap.ts` (`Bootstrap.shutdown`), `index.ts` (`will-quit`→`closeDb`) |
| **uv/Python 런타임 제거됨** — 현 `extraResources`=builtin 만. 코드의 `runtime` 은 전부 `SessionRuntime`(세션 수명), Python venv 무관 | `app/electron-builder.yml:15-17`, 코드 grep |
| 배포/서명/자동업데이트/채널/텔레메트리/라이센스 = **PRD OQ3/OQ4/OQ5 미정(단독 결정 금지)**. 제품 SemVer 정책 문서 없음 | `@docs/PRD.md §11 OQ3~OQ5`, `@docs/TRD.md §9.2`(OQ3), `@docs/arch/backend/runtime-ipc.md §3.1` |
| TRD §4 는 아직 uv `extraResources` 동봉·mac codesign 대상 포함을 서술 → **코드와 드리프트** | `@docs/TRD.md §4` (문서만, 코드엔 없음) |

### 첨부 가이드 비판적 검토 (Orca 환경 대조)

| 가이드 항목 | 주장 | Orca 실제 | 판정 |
|---|---|---|---|
| §4.2·§8 `PRAGMA user_version` + `TARGET_SCHEMA_VERSION` | 숫자 스키마 버전으로 마이그레이션 판별 | Orca 는 이미 **이름 기반 전진 전용** 러너로 점프-안전. user_version 도입은 이중 상태원 + 기존 12개 재작성 위험 | **비채택** — 이름 기반 유지 |
| §4.3 "1.0.0→1.100.0 직접 마이그레이션" | 최신 앱이 모든 과거 DB 를 직접 끌어올려야 | (a) 앱 바이너리=NSIS full-replace 라 비이슈 (b) DB=기존 러너로 이미 충족 (c) 진짜 갭 = **다운그레이드 시 구버전 앱↔새 DB**(가드 부재) + **settings 무음 리셋** | **수정·채택** — 리스크 재정의 |
| §8.1 "마이그레이션 전 app.db 백업(copy)" | 단순 파일 복사 | Orca 는 **WAL 모드** → `-wal`/`-shm` 누락으로 불일치 백업 위험 | **수정** — better-sqlite3 `.backup()` API 또는 checkpoint 후 `VACUUM INTO` + 디스크 여유 선검사 |
| §4.2 "문자열 비교 금지" | `"1.100.0">"1.9.0"` 문자열 비교 위험 강조 | electron-updater 는 내부적으로 semver 사용 → 기본 동작. 실제 갭은 *문서화된 제품 버전 정책 부재* | **스트로맨** — updater 사용 시 비이슈, 버전 정책만 OQ |
| §7 `release-policy.json`(별도 정책 매니페스트) | rollout/forced/critical 을 별도 JSON 으로 | electron-updater 는 `stagingPercentage`(latest.yml) 로 staged rollout 지원 | **축소** — MVP 과설계. forced/critical 도 후속 |
| §5.1 `verifyUpdateCodeSignature`/코드 서명 | "강력 권장" | 미서명 시 Windows 자동업데이트/SmartScreen 취약 → **하드 전제**. 사용자 방침=internal/beta 미서명·latest 전 서명 | **전제 명확화** — OQ3, 0085 |
| §5 electron-builder YAML 예시 | `com.yourcompany.orca`, `files: dist-app/**` | 실제 appId=`com.orca.app`, electron-vite 는 `out/` | **수정** — Orca `electron-builder.yml` 실체 기준 |
| §9 uv/Python 등 동봉 리소스 | (가이드 미언급) | Orca 는 uv 제거됨. builtin skills 만 동봉 | **비해당** — 배포/서명 설계는 실체 기준, TRD §4 정합 갱신을 0085 별건 제안 |
| §17 텔레메트리 지표 | 마이그레이션 지표 수집 | OQ4(옵트인 미정), 수집 파이프라인 부재 | **플래그** — 로컬 로그만, 수집 보류(OQ4) |
| §6·§10 안전 재시작(생성/tool/DB write 중 금지) | 재시작 조건 엄격화 | Orca 턴 오케스트레이션(isGenerating)·tool call·HistoryWriter DB write 와 정합. `shutdown()` settle 훅에 결선 가능 | **채택** — 0084 범위(술어), 소비는 0085 updater |

## 인수 기준 (Acceptance Criteria)

> 0084 하드닝만. verify 가 1:1 대조.

1. **DB 다운그레이드 가드**: 구버전 앱이 새 DB(`_migrations` 에 앱의 `MIGRATIONS` 가 모르는 이름 존재) open 시 `applyMigrations` 가 명확한 에러(`DB_SCHEMA_TOO_NEW`)로 throw 하고, 부팅이 일반 UI 로 진입하지 않는다(critical 스텝 실패로 전파). 이름 기반 유지·user_version 미도입.
2. **WAL-안전 백업**: 미적용 마이그레이션이 있을 때에만, 적용 전 WAL-일관 백업(`.backup()` 또는 checkpoint+`VACUUM INTO`)을 `<userData>/orca.db.backup.before-<version>.<timestamp>` 로 생성한다. 디스크 여유 부족·백업 실패 시 마이그레이션을 중단(적용 안 함)하고 부팅을 일반 UI 로 진입시키지 않는다. `-wal`/`-shm` 을 포함한 일관 스냅샷.
3. **점프-안전 회귀 고정**: 오래된 스키마 fixture(예: 마이그레이션 0개/일부만 적용)에서 최신까지 미적용분 전부 순차 적용 성공을 회귀 테스트로 고정한다(기존 러너의 점프-안전성이 리팩토링에 깨지지 않음을 보장).
4. **settings 버전 마이그레이션**: `settings` 구조 변경 시 zod-invalid→기본값 무음 리셋 대신 명시적 버전 마이그레이션으로 보존한다(최소 `windowBounds`·`lastSessionId`·`lastBackend` 등 사용자 상태). `lastAppVersion` 을 기록한다.
5. **안전 재시작 술어**: 순수 함수 `canRestartForUpdate(state)` 가 LLM 생성 중·tool call 중·DB write 트랜잭션 중·파일 인덱싱 중이면 `false`, idle 이면 `true` 를 반환한다. 런타임 상태 소스와 결선하되 UI/IPC 표면은 만들지 않는다(0085 updater 소비 seam). 단위 테스트 포함.
6. **게이트**: `cd app && npm run lint && npm run typecheck && npm test` 통과. 신규 테스트(마이그레이션 다운그레이드 가드·WAL 백업·점프-안전 회귀·settings 마이그레이션·재시작 술어).

## 범위 / 비범위

- **범위(0084 — main 프로세스 하드닝, IPC/렌더러 표면 없음)**: 위 인수 기준 1~6. DB 다운그레이드 가드 + WAL-안전 백업 + settings 버전 마이그레이션 + 안전 재시작 술어.
- **비범위(후속 핸드오프 0085 — OQ3 해소 후)**:
  - electron-updater 의존성 배선·`publish` provider/실 URL·`autoUpdater` 상태머신·업데이트/복구 UI·업데이트 IPC 채널(추가 시 `docs/IPC_CONTRACT.md` 갱신 필수).
  - 코드 서명 인증서(OV/EV)·`verifyUpdateCodeSignature`·mac notarize.
  - 호스팅 결정(generic HTTPS vs GitHub Releases)·CI 서명/업로드 파이프라인·채널(internal/beta/latest)·`stagingPercentage` staged rollout.
  - 텔레메트리(OQ4)·라이센스(OQ5)·제품 SemVer 버전 정책 확정.
  - TRD §4 uv 드리프트 정합 갱신(별건).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: `infra/db/migrate.ts`(`applyMigrations`)·`infra/db/index.ts`(`initDb`/`closeDb`)·`infra/settings-store.ts`(`SettingsStore`)·`app/bootstrap.ts`(critical initDb 스텝·`shutdown`), better-sqlite3 `.backup()` API.
- 전제: 단일 인스턴스 앱(백업/마이그레이션 중 동시 오픈 없음). electron-store 는 이미 채택 의존성.
- **신규 의존성 0 (0084 범위).** electron-updater 는 **0085 범위** — 전달 모델로는 사용자 승인 확정(라이브 세션), 실제 배선/설정은 후속.

## 설계

- **DB 다운그레이드 가드**: `applyMigrations` 진입부에서 `_migrations` 의 applied 이름 집합과 앱의 `MIGRATIONS` 이름 집합을 비교. applied 에 앱이 모르는 이름이 있으면 `DbSchemaTooNewError`(코드 `DB_SCHEMA_TOO_NEW`) throw. 이름 집합 비교만(순서 무관) — 오탐 방지.
- **WAL-안전 백업**: 미적용 마이그레이션 존재 시에만 적용 루프 *전* 1회. `db.backup(path)`(better-sqlite3 online backup — WAL 일관) 우선, 실패 경로는 checkpoint(`wal_checkpoint(TRUNCATE)`)+파일 복사 폴백 대신 명시적 중단. 백업 경로/시각 네이밍 규약 고정. 디스크 여유는 원본 크기 대비 선검사.
- **settings 버전 마이그레이션**: `settings-store.ts` 에 `settingsVersion` + `lastAppVersion` 필드 + 버전별 변환 파이프라인(electron-store `migrations` 또는 자체 순수 변환기). zod 검증 실패를 즉시 기본값으로 떨구지 않고, 알려진 이전 형태면 변환 후 검증.
- **안전 재시작 술어**: 순수 함수 `canRestartForUpdate(state: RestartGateState): boolean` 을 `shared`(또는 main `contracts`)에 두고, 런타임 상태(생성/활성 tool call 수/활성 DB 트랜잭션/인덱싱)를 취합하는 소스를 `app` 컴포지션 루트에서 결선. 0085 updater 가 `quitAndInstall` 전 이 술어를 확인.
- 레이어 경계: DB 가드/백업=`infra/db`, settings=`infra/settings-store`, 재시작 술어=순수(`shared`/`contracts`)+결선(`app`). feature 교차 import 0.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 백업 디스크 부족 → 마이그레이션 중단 + 명확한 에러(복구 화면 UX 는 0085, 0084 는 에러 전파/부팅 차단까지).
- 백업 파일 누적 GC → 지금은 남겨둠(`persistence.md §1.4` GC OQ 소관, 0084 비범위).
- 마이그레이션 실패 후 재부팅 → `_migrations` per-migration 트랜잭션이라 부분 적용 없음(재실행 안전).
- 동시 실행 → 단일 인스턴스 가정(멀티 인스턴스는 별도 OQ).
- 테마/접근성/렌더러 상태 → **N/A**(0084 는 렌더러 표면 없음).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 다운그레이드 가드 오탐(앱이 아는 이름인데 순서/누락 이슈) | 이름 **집합** 비교만(순서 무관), 앱 `MIGRATIONS` 의 superset 여부만 검사 |
| 대용량 DB 백업 성능 | 미적용 마이그레이션이 있을 때에만 백업(정상 부팅은 무비용) |
| `.backup()` API 세부(better-sqlite3 버전별) | 구현 시 실제 API 확인, 실패 시 명시적 중단(조용한 진행 금지) |
| settings 마이그레이션이 잘못 변환하면 데이터 손상 | 변환 전 원본 보존(이전 형태 파일 백업 or 인메모리), 알려진 형태만 변환·미지 형태는 기존 폴백 |

- 되돌리기 어려운 결정: 이름 기반 마이그레이션 유지(user_version 비도입) — 기존 12개 자산과 정합.
- **단독 결정 금지 항목(Open Question) → 사용자에게** (0085 로 이월): 코드 서명 인증서·업데이트 호스팅(generic vs GitHub Releases)·채널 구성·staged rollout 비율·텔레메트리 수집(OQ4)·라이센스(OQ5)·제품 SemVer 정책.

## 영향 받는 파일

- `app/src/main/infra/db/migrate.ts` (다운그레이드 가드 + 백업 훅)
- `app/src/main/infra/db/index.ts` (백업 경로/`initDb` 결선)
- `app/src/main/infra/settings-store.ts` + `app/src/shared/protocol.ts` (`settingsVersion`/`lastAppVersion`/마이그레이션)
- 신규 재시작 술어 파일 (`app/src/shared/` 또는 `app/src/main/contracts/`) + `app/src/main/app/bootstrap.ts` 결선
- 신규 테스트 파일(마이그레이션·백업·settings·재시작 술어)
- (문서) `docs/handoff/INDEX.md`, `docs/PHASES.md`(승격 시)

## 참고 문서

- `@docs/arch/backend/persistence.md §1.3` (마이그레이션·WAL·백업 OQ)
- `@app/AGENTS.md` "DB · 캐시 정책" (이름 기반 마이그레이션·머지 후 수정 금지)
- `@docs/PRD.md §11 OQ3/OQ4/OQ5` (배포·텔레메트리·라이센스 미정)
- `@docs/TRD.md §4, §9.2` (electron-builder·OQ3)
- 첨부 가이드 원문(라이브 세션 업로드)
- 0085(후속) 은 IPC 추가 예정 → 그때 `docs/IPC_CONTRACT.md` §6 절차로 동시 갱신(0084 는 IPC 무변경).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: 마이그레이션 다운그레이드 가드(순수), WAL 백업(파일 존재/일관), 점프-안전 회귀, settings 버전 마이그레이션(순수 변환기), `canRestartForUpdate`(순수).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청·AskUserQuestion 확정으로 인용했고, 추론(리스크 재정의)은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…§`)를 붙였고, 가이드 비판적 검토를 항목별 판정표로 정리했다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다(순수 함수·파일 존재·게이트).
- [x] 의존 기술 — 신규 의존성 0(0084), electron-updater 는 0085 로 분리 표기했다.
- [x] 파생 UX — 0084 가 렌더러 표면 없음을 명시하고 관련 엣지(디스크·재부팅·동시성)만 펼쳤다(무관한 테마/a11y 는 N/A).
- [x] 리스크 — 고유 리스크·완화책·되돌리기 어려운 결정을 적고, Open Question(서명/호스팅/채널/텔레메트리/라이센스/SemVer)은 0085·사용자로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (기능 구현 = Codex). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | 구현자 코멘트 §… / 사용자 / verify r<N> | … | open / 구현중 / 해결 |
