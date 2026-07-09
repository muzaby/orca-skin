# Verify — 0084-app-distribution-auto-update

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0084-app-distribution-auto-update` |
| 검증자 | Claude Code |
| 일자 | 2026-07-09 |
| 대상 커밋 | `71928c9` (INDEX 기재 `fbee41a` 는 Codex 환경 phantom hash — 실 구현은 `71928c9` "docs(handoff): 0084 대상 커밋 갱신" 이 513 insertions 로 코드 전부 포함. 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> plan `[구현자 기입]` 의 설계 리뷰·놓친 잠재 문제·선조치를 먼저 검토했다.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: `.backup()` Promise 대신 동기 `VACUUM INTO` 채택(부팅 동기 경로 유지) | 타당 — `applyMigrations`/`initDb` 는 동기이므로 async `.backup()` 삽입은 부팅 async 전환·await 누락 리스크. `VACUUM INTO` 는 WAL 포함 일관 스냅샷 생성(AC2 충족) | AC2 매트릭스에 증거로 반영 |
| 놓친 문제 #2: settings 메타(`settingsVersion`/`lastAppVersion`)를 `SettingsPatchSchema` 에 넣으면 renderer 조작 가능 → 내부 raw 로만 기록 | 타당 — 공개 `Settings`/patch 미노출을 코드+테스트로 확인(`settings-migration.ts:35-40`, `settings-migration.test.ts:48-62`) | AC4 매트릭스 |
| 이견/우려: 일반 동기 DB write 는 event loop 특성상 updater predicate 가 중간 관측 곤란 → 0084 는 backup/migration section 만 `activeDbWriteCount` 로 관측 가능하게 결선, 광역 write instrumentation·파일 인덱싱 subsystem 은 후속(0085) | **타당·수용** — AC5 는 "0085 updater 소비 seam" 이 명시 목표이고 소비자가 0084 엔 없다. 순수 predicate 는 4 입력 전부 정확(단위 테스트 4/4). `activeDbWriteCount`(backup section)·`isIndexing`(subsystem 부재→false 상수)는 현 아키텍처에서 관측 가능한 최소 실소스로 결선됨. 광역 write tracking 은 0085 소비 시 확장 — **선조치 가능(구현 세부) 범위의 정직한 부분 공개**로 판정, AC5 충족을 막지 않음 | 파생 이슈 D1(0085 이월 메모)로 기록 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | DB 다운그레이드 가드 — 앱이 모르는 마이그레이션 이름이 적용된 DB open 시 `DB_SCHEMA_TOO_NEW` throw, 부팅 차단(critical), 이름 집합 비교·user_version 미도입 | ✅ | `migrate.ts:38-49`(`DbSchemaTooNewError` code `DB_SCHEMA_TOO_NEW`), `migrate.ts:126-131`(applied/known 집합 diff·순서 무관), `index.ts:19`→`bootstrap.ts:146`(`stepSync('db-init', {critical:true})` 로 throw 전파). 테스트 `migrate.test.ts:80-95` |
| 2 | WAL-안전 백업 — 미적용 마이그레이션 있을 때만 적용 *전* WAL-일관 백업, 디스크 선검사, 실패 시 마이그레이션 중단·부팅 차단 | ✅ | `migrate.ts:107-122`(`createMigrationBackup` = mkdir→`assertEnoughFreeSpace`→`VACUUM INTO`), `migrate.ts:133-141`(pending>0 && backup 일 때만·apply 루프 전), 파일명 `orca.db.backup.before-<ver>.<ts>`. 테스트: WAL row 포함 복구성(`migrate.test.ts:111-145` integrity_check=ok+데이터+적용전 `_migrations`), 백업 실패 시 미적용(`:147-166`), 미적용 없으면 백업 없음(`:168-186`) |
| 3 | 점프-안전 회귀 고정 — 부분 적용 fixture 에서 최신까지 순차 전진, 러너 점프-안전성 회귀 방지 | ✅ | `migrate.test.ts:97-109`(first-6 → 전 12개 + `provider_limits` 테이블 확인), `migrate.test.ts:76-78`(`MIGRATION_NAMES` 이름/순서 고정) |
| 4 | settings 버전 마이그레이션 — zod-invalid→기본값 무음 리셋 대신 명시 보존, `lastAppVersion` 기록 | ✅ | `settings-migration.ts:17-25`(`recoverKnownSettings` per-key 보존), `:32-41`(`migrateRawSettings` 메타 raw 기록·공개 미노출). 테스트 `settings-migration.test.ts:31-46`(density invalid 여도 windowBounds/lastSessionId/lastBackend 보존), `:48-62`(메타 비노출) |
| 5 | 안전 재시작 술어 — 순수 `canRestartForUpdate(state)`(생성/tool/DB write/인덱싱 중 false), 상태 소스 결선, UI/IPC 표면 없음, 단위 테스트 | ✅ | `update-restart.ts:1-15`(순수 함수·타입), `bootstrap.ts:259-268`(`restartGateState()` seam — supervisor 턴수·openToolRuns·activeDbWriteCount·isIndexing). IPC/preload 무변경(§ 아래). 테스트 `update-restart.test.ts`(idle true + 4 조건 각 false) |
| 6 | 게이트 — lint/typecheck/test 통과 + 신규 테스트 | ✅ | 아래 "게이트 재실행 결과" — typecheck 3종 ✅·lint 0·test **768 passed**(신규 15 포함) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — | typecheck 3종 ✅ · lint 0 · test 768 passed (신규 15) · 3 suite=electron 바이너리 403 환경 제한(무관) |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거 | 이견 시 중재 | 6/6 충족 |
| 레이어 경계 위반 0 | ✅ | — | `eslint --no-cache ./src` 0 위반(infra·shared·app 하향만) |
| 문서 형식/링크/한국어 | ✅ | — | verify/INDEX/PHASES 한국어·형식 준수 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 0(코드+handoff 문서만) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0(0084) — 승인 불요 |
| 안전 재시작 술어 실환경 소비(0085 updater) | ✖ | ✅ | 후속 0085(소비자 부재로 0084 는 seam 만) |
| DB 다운그레이드·백업 실환경 실기(다중 점프·롤백) | ✖ 보조 | ✅ | 사람 확인 대기 |
| Open Questions(서명/호스팅/채널/텔레메트리/라이센스/SemVer) | ✖ 단독 결정 금지 | ✅ | 0085 이월 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ npm rebuild better-sqlite3           # Node ABI 재빌드(0019 계열 — pretest ABI-ensure 인프라 미착수)
rebuilt dependencies successfully

$ npm run typecheck                     # typecheck:node && :web && :test
(3종 모두 에러 0)

$ npm run lint                          # eslint --cache --fix ./src → 무변경
(에러 0)
$ npx eslint --no-cache ./src           # 경계 재확인
(위반 0)

$ npm test                              # vitest run
 Test Files  3 failed | 100 passed (103)
      Tests  768 passed (768)

$ npm test -- src/main/infra/db/migrate.test.ts \
              src/main/infra/settings-migration.test.ts \
              src/shared/update-restart.test.ts
 Test Files  3 passed (3)
      Tests  15 passed (15)
```

- **3 suite 실패 = 환경 제한(0084 무관)**: `chat-turn.continuity`·`chat-turn.runtime-resilience`·`history/writer` 3개가 모듈 로드 시 `Error: Electron failed to install correctly` 로 0 test. 원인 = 프록시 403 으로 electron 바이너리 미설치(본 검증 환경만). 세 파일 모두 0084 변경 파일이 아니고 electron 을 전이 import(0050 계열 상시 패턴). Codex 정상 환경 보고 = full **779 passed**; 779−768=11 이 곧 이 3 suite 의 테스트 수와 일치.

## 위생 검토

- AGENTS.md 변경 없음(코드 9파일 + handoff 문서만) — 키/토큰/이메일/IP 스캔 대상 없음.
- 신규 의존성 0 · IPC 채널 0 · `package.json`/`package-lock`/`electron-builder.yml`/`ipc.ts`/`IPC_CONTRACT.md` 무변경(`git show 71928c9 --stat` 확인).

## PHASES.md 정합성

- `docs/PHASES.md` 페이즈 표에 0084 완료 행 승격(커밋 `71928c9`). 형식·handoff 링크 준수.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 리스크 재정의(다중 점프 진짜 갭 = 다운그레이드/settings)와 가이드 비판적 검토표가 탄탄했다. 다만 AC5 의 "DB write 트랜잭션 중" 입력이 현 동기 아키텍처에서 관측 곤란함을 설계가 예견하지 못해, 구현자가 seam 최소 결선으로 되먹였다(설계 예측 갭 — 구현자 공개로 보완).
- 구현 단계: 선조치 경계를 정확히 지켰다(관측 가능 seam 결선=✅ 구현, 광역 write tracking·인덱싱 subsystem=후속 보고). 테스트가 "파일 존재"가 아니라 `integrity_check`+WAL row+적용 전 `_migrations` 로 복구성을 검증해 백업 품질을 실질 담보.
- 검증 단계: 게이트를 실제 환경에서 재실행했으나 electron 바이너리 403 으로 3 suite 를 직접 green 확인하지 못하고 "환경 무관" 추론에 의존했다(0050 계열 상시 한계). DB 다운그레이드·롤백·다중 점프의 *실환경* 실기와 재시작 술어의 *0085 소비* 는 원리상 사람/후속 몫이다.

## 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 안전 재시작 술어 `activeDbWriteCount` 는 현재 backup/migration section 만 관측(광역 DB write tracking·파일 인덱싱 subsystem 부재). | 구현자 §이견/우려·놓친문제 #3 | 0085 updater 배선 시 소비처와 함께 광역 write 계측 확장(현 seam 은 정확·후속 확장 지점). | open(0085 이월) |

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 6/6 충족, 게이트 통과, 레이어 경계 0, 신규 의존성/IPC 0. PHASES 승격.
- **사람 확인 대기**: DB 다운그레이드 가드·WAL 백업 실환경 실기(다중 점프·롤백)·재시작 술어 0085 소비·PR 머지.
- **후속 0085(OQ3 해소 후)**: electron-updater 배선·서명·호스팅·CI·채널·staged rollout·업데이트/복구 UI·텔레메트리(OQ4)·라이센스(OQ5)·제품 SemVer·TRD §4 uv 드리프트 정합 + D1(광역 write 계측).
