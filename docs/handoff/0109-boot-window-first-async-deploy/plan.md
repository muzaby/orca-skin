# Plan — 0109-boot-window-first-async-deploy

## 메타

| 항목 | 값 |
|---|---|
| slug | `0109-boot-window-first-async-deploy` |
| 작성자 | Claude Code |
| 일자 | 2026-07-15 |
| 매핑 | 성능 시리즈 3/4 (0107~0110) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "응답없음, 동기대기 등의 앱 사용 경험을 저해하는 성능 저하 요소들을 찾아라. 수정 방안을 마련하라" + "전체 4유닛 순차" 확정 | 라이브 세션 요청 (2026-07-15) |
| 추론 의도 | "응답없음" 에 콜드스타트 흰 화면(창이 부트 완료 후에야 생성)과 스킬/MCP CRUD 클릭 프리즈가 포함된다는 판단은 조사 기반 해석 | 조사 결과 |

## Context (왜)

두 증상의 축이 같다 — **배포/시드의 동기 재귀 fs**:

1. **콜드스타트 (F4)**: `index.ts` 가 `await router.start()` **완료 후에야** `createWindow` — DB init/마이그레이션(스키마 변경 시 `VACUUM INTO` 백업)·복구·비용 재계산·스킬 시드(`rmSync`+`cpSync` 재귀)·확장 배포(매 부팅 `rmSync`/`renameSync`+`cpSync` 재귀+`writeFileSync`) 가 끝날 때까지 창이 없다(흰 화면/무반응 체감).
2. **CRUD 프리즈 (F5)**: 스킬 추가/업로드/삭제·MCP add/update/delete·engine add/update/delete invoke 핸들러가 `deployExtensions()`(동기 재귀 복사)를 본문에서 실행 — 스킬이 많으면 버튼 클릭마다 수백 ms 이벤트 루프 정지.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 창 생성이 start() 완료 이후 | `app/src/main/index.ts:163-167` (변경 전) |
| start() 순차 스텝(동기 fs 다수) | `app/src/main/app/bootstrap.ts:157-300` |
| deployer 동기 fs (rmSync/renameSync/cpSync/writeFileSync/readFileSync/readdirSync) | `features/extensions/deployer.ts:15-23,139-192`, `claude-plugin-package.ts:5,29-67` (변경 전) |
| seed 동기 재귀 복사 | `features/extensions/skills/seed.ts:80-81` (변경 전) |
| CRUD 핸들러 내 동기 배포 | `app/handlers/misc.ts:109,116,155`, `handlers/mcp.ts:13,19,25`, `handlers/engine.ts:24`(직접 `deploy`) |
| renderer 부트 오케스트레이터 존재 — 스텝 러너 + mandatory 10s 타임아웃/failed UX | `renderer/src/app/boot/steps.ts`, `bootStore.ts`, `BootScreen.tsx` |
| `Bootstrap.settings` 는 생성자 필드 → start() 전 `createWindow(router.settings)` 가능 | `bootstrap.ts:77` 계열(생성자), `index.ts:76` |
| bootReport 는 async step 지원(`step`/`stepSync` 병존) | `app/boot-report.ts` 사용부 `bootstrap.ts:206,212` |
| `ipcMain.handle` 은 Promise 반환 지원 — invoke 가 resolve 까지 자연 대기 | https://www.electronjs.org/docs/latest/api/ipc-main (handle) |
| dist 는 backup-then-write — **동시 배포 실행이 겹치면 서로의 산출물 파괴** → async 전환 시 직렬화 필수 | `deployer.ts:137-150` |

## 인수 기준 (Acceptance Criteria)

1. `index.ts` 가 `router.start()` 를 await 하기 **전에** `createWindow(router.settings)` 를 호출한다 (창 먼저).
2. 신규 IPC 채널 `orca:boot:whenReady` — `start()` 착수 직후(어떤 다른 핸들러 등록보다 먼저) 등록되고, `start()` promise 를 반환한다(resolve=준비 완료, reject=부트 실패). `docs/IPC_CONTRACT.md` 갱신(64→65).
3. renderer 부트 오케스트레이터의 **첫 mandatory 스텝** `main-ready` 가 `bootApi.whenReady()` 를 대기한다 — 이후 스텝(IPC invoke)이 미등록 핸들러에 닿는 창이 구조적으로 닫힌다. 성공 순서·실패(failed UX) 단위 테스트.
4. `deploy`/`renderClaudePluginPackage`/`seedBuiltinSkills` 가 `node:fs/promises` 기반 async 로 전환된다(대량 재귀 복사·삭제·쓰기 경로에서 동기 fs 0 — 저비용 `existsSync` 존재 확인은 예외 허용).
5. `ExtensionDeploymentService` 가 async 전환과 함께 **in-flight 직렬화**된다 — 진행 중 `deployNow` 는 "완주 후 1회 재실행"으로 코얼레스되고 모든 호출자는 최신 결과로 resolve (단위 테스트). `ensureDeployed` 의 "boot 성공 후 no-op / 실패 시 재시도" 의미는 유지 (단위 테스트).
6. 스킬/MCP/engine CRUD 핸들러와 턴 진입 게이트(`ensureExtensionsDeployedForTurn`)가 배포를 `await` 한다 (배포 완료 후 응답 — 동작 의미 유지, 블로킹만 제거).
7. `bootstrap.start()` 의 seed·extension-deploy 스텝이 async `step` 으로 전환된다.
8. 게이트: lint 0 error · typecheck 3종 0 · extensions/boot 스위트 green. (DB 로드 스위트·electron 실기는 환경 제약 분리 — app/AGENTS.md 규약.)

## 범위 / 비범위

- **범위**: 위 8항.
- **비범위**: DB init/마이그레이션의 async 화(better-sqlite3 는 동기 — 창이 먼저 떠 있으므로 마이그레이션 부팅의 지연은 BootScreen 뒤에서 흡수), `scaffoldProviderSettings`/`readUserClaudeSettings` async 화(소형 파일 — 이득 미미), prod `app://` 첫 HTML 응답이 start() 동기 구간(DB init)과 겹칠 가능성(평시 빠름 — 문서화 수용).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- `node:fs/promises`(표준), `ipcMain.handle` Promise 반환. **신규 의존성 없음**.
- 전제: renderer 의 모든 부트 IPC 는 boot 오케스트레이터 스텝 뒤에서만 발생(RootGate/BootScreen 구조) — `main-ready` 를 첫 스텝으로 두면 충분.

## 설계

1. **`index.ts`**: `routerRef = router` 선행 → `const started = router.start()` → `ipcMain.handle(CHANNELS.bootWhenReady, () => started)` → `createWindow(router.settings)` → `await started`(실패 시 로깅 후 return — 창은 떠 있고 renderer failed UX 가 표면화).
2. **채널**: `shared/ipc.ts` `bootWhenReady: 'orca:boot:whenReady'` + preload `boot.whenReady()` + renderer `bootApi.whenReady()`.
3. **steps.ts**: `BootStepId` 에 `main-ready` 추가, `BootDependencies.whenMainReady`, 스텝 0 mandatory. 기존 10s mandatory 타임아웃이 상한.
4. **deployer 계열 async**: 위 인수 기준 4·5 (동시성 보호는 서비스 직렬화 1곳 — deploy 함수 자체는 재진입 비보호, 호출은 서비스와 engine 핸들러뿐이며 engine 경로는 invoke 직렬이므로 수용, 리스크 참조).
5. **호출부**: `RouterContext.deployExtensions/ensureExtensionsDeployedForTurn` → `Promise<void>`, misc/mcp/engine 핸들러 `await`, `chat-turn` 턴 게이트 `await`.

레이어 경계: 변경 파일 전부 기존 소속 유지(app/features/infra/shared·preload·renderer app/), 교차 import 신설 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: 창이 즉시 뜨고 BootScreen 이 main-ready 대기 — 흰 화면 대신 부트 UI. 마이그레이션 부팅(VACUUM)은 그 화면 뒤에서 진행.
- **에러**: start() 실패 시 이전에는 창 자체가 안 떴다 → 이제 BootScreen failed UX 로 관측 가능(개선).
- **동시성**: CRUD 연타 → 배포 코얼레스(최신 소스 1회 재실행). 턴 진입 게이트와 CRUD 배포 경합도 같은 직렬화가 보호.
- **타임아웃**: 초대형 DB 마이그레이션이 10s 를 넘으면 main-ready mandatory timeout → failed UX. 드묾(업데이트 직후 1회성) — 수용하고 verify 에 기재. 필요 시 후속에서 이 스텝만 타임아웃 상향.
- dev HMR: dev 서버 URL 로드는 동일 — 게이트는 dev/prod 공통.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| async 배포 동시 실행 시 dist 파괴 | 서비스 in-flight 직렬화 + 코얼레스(테스트 고정) |
| `deploy()` 직접 호출(engine 핸들러)은 서비스 직렬화 밖 | invoke 핸들러는 채널당 직렬 + engine 배포는 스킬 미복사 대상과 동일 dist… 잔여 경합(스킬 CRUD 와 engine CRUD 동시)은 이론상 가능 — 파생 이슈 D1 로 기록(후속: engine 경로도 서비스 경유) |
| main-ready 10s 타임아웃 vs 장기 마이그레이션 | 파생 UX 기재 — 실측 후 필요 시 상향 |
| prod 첫 HTML 서빙이 start() 동기 구간과 인터리브 | 평시 DB init 은 빠름 — 문서화 수용, 실기 관찰 항목 |

- 되돌리기 어려운 결정: 없음 (채널 추가는 additive).
- Open Question: 없음.

## 영향 받는 파일

- `app/src/main/index.ts` · `app/bootstrap.ts` · `app/context.ts` · `app/handlers/{misc,mcp,engine}.ts` · `app/chat-turn.ts`
- `app/src/main/features/extensions/{deployer,claude-plugin-package,extension-deployment-service}.ts` · `skills/seed.ts` (+ 각 테스트)
- `app/src/shared/ipc.ts` · `app/src/preload/index.ts`
- `app/src/renderer/src/shared/api/ipc.ts` · `app/boot/steps{,.test}.ts`
- `docs/IPC_CONTRACT.md` (+ 총계 참조 문서 5건 동기화)

## 참고 문서

- `docs/IPC_CONTRACT.md` §2.1-b (변경 절차 §6 준수 — 코드와 동시 갱신)
- `docs/arch/backend/standardization.md` §5.1 (배포 계층)

## 게이트

- `cd app && npm run lint && npm run typecheck` + `vitest run src/main/features/extensions src/renderer/src/app/boot`.
- 신규 테스트: 배포 직렬화/코얼레스·ensureDeployed 재시도, main-ready 순서/실패.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 출처 인용, 추론 표기.
- [x] 자료조사 — 전 발견 레퍼런스(외부는 electron 공식 문서).
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 없음.
- [x] 파생 UX — 로딩/에러/동시성/타임아웃/dev.
- [x] 리스크 — 직렬화·타임아웃·잔여 경합(D1) 명시.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 창-먼저 + 게이트 + async 전환 축.
- 이견 / 우려: engine 핸들러의 `deploy('claude')` 직접 호출이 서비스 직렬화 밖에 남는다(리스크 표) — 이번 범위에서는 invoke 직렬성으로 실질 위험이 낮아 유지, D1 로 추적.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | deployer.test 의 기존 "재배포 백업" 테스트가 첫 deploy 를 미await → async 전환 후 두 배포가 경합(EEXIST) | ✅ await 추가 — 직렬화 필요성의 실증 사례 | `deployer.test.ts:122` |
| 2 | `handlePlain`(mcp add/update) 은 async 콜백 허용 여부 확인 필요했음 — invoke 핸들러라 Promise 반환 자연 지원 | ✅ async 화 적용 | `handlers/mcp.ts` |

## [구현자 기입] 구현 체크리스트

- [x] index.ts 창 먼저 + whenReady 게이트(등록 순서 보장)
- [x] 채널/preload/renderer api/steps(main-ready) + 테스트 2건
- [x] deployer·plugin-package·seed async + 서비스 직렬화 + 테스트 3건
- [x] context 타입·misc/mcp/engine/chat-turn await
- [x] IPC_CONTRACT §2.1-b + 총계(65) 참조 문서 동기화

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 전부 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run …extensions …app/boot` |
| 게이트 결과 | lint ✅ 0 error(경고 1=0102 기지) / typecheck 3종 ✅ / extensions·boot 31 tests ✅ (builder.test 3건 = better-sqlite3 ABI 환경 베이스라인, 변경 무관) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 기재) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | engine CRUD 의 `deploy('claude')` 직접 호출이 `ExtensionDeploymentService` 직렬화 밖 — 스킬/MCP CRUD 배포와 동시 실행 시 dist 경합 가능(이론상) | 구현자 코멘트 | engine 경로를 서비스 경유로 통합하는 후속 | open |
