# 0085 — 인앱 자동 업데이트 UX (electron-updater 배선 + 헤더 버튼 + idle-gated 설치)

> 0084(하드닝) 후속. **인앱 업데이트 메커니즘 + UX** 를 구현한다 — 앱 시작 시 확인, 홈 진입 후 헤더에 업데이트 버튼(새 버전 있을 때만), 클릭 시 안내창 + 진행, 설치는 **모든 SessionRuntime idle(+DB)** 일 때만.
> **기능 구현 = Codex.** 실 배포 호스트/서명 인증서/CI 는 여전히 OQ3 배포-타임 설정으로 분리(후속).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0085-auto-update-ux` |
| 작성자 | Claude Code |
| 일자 | 2026-07-09 |
| 매핑 | PHASES "인앱 자동 업데이트 UX" (승격 시) / PR #213(브랜치 공유) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 앱 시작 시 업데이트 항목 확인 | 라이브 세션: "앱 시작시 업데이트 항목 확인" |
| 명시 요구 | login 후 home(new) 진입 시 헤더에 업데이트 버튼 노출 — **새 버전이 등록된 경우에만** | 라이브 세션: "login 후 home(new) 진입 하면 헤더에 업데이트 버튼 노출 (새 버전이 등록된 경우에만)" |
| 명시 요구 | 버튼 클릭 시 안내창과 함께 업데이트 진행 | 라이브 세션: "버튼 클릭시 안내창과 함께 업데이트 진행" |
| 명시 요구 | 설치는 **모든 세션런타임이 idle(+DB)** 일 때만 가능 | 라이브 세션: "단 모든 세션런타임이 idle 상태일 경우에만 가능 (+db 포함)" |
| 명시 요구 | 전달 모델 = electron-updater 자동 업데이트(신규 의존성 승인) | 0084 라이브 세션 AskUserQuestion 확정 |
| 추론 의도 | 확인은 시작 시 1회(autoDownload=false), 버튼 클릭이 다운로드→설치를 트리거 | "시작 시 확인" + "버튼 클릭 시 진행" 조합 해석 |
| 추론 의도 | idle 게이트는 0084 `canRestartForUpdate(restartGateState())` 를 그대로 소비(신규 판정 로직 불필요) | 아래 자료조사 근거 |

## Context (왜)

0084 가 배포/업데이트의 **결정불요 하드닝**(DB 다운그레이드 가드·WAL-안전 백업·settings 마이그레이션·안전 재시작 술어)을 끝냈다(verify PASS r1, 커밋 `71928c9`). 남은 것은 실제 **인앱 업데이트 메커니즘 + UX** 다: electron-updater 배선, 업데이트 IPC, 헤더 버튼, 안내 다이얼로그, 그리고 0084 가 심어둔 재시작 술어를 소비하는 **idle-gated 설치**. 실 배포 호스트/서명/CI 는 OQ3 배포-타임 설정이라 코드 메커니즘과 분리한다(플레이스홀더 provider 위에서 메커니즘을 완성하고, 실 URL/인증서는 배포 시 채운다).

## 자료조사 (Research)

### 0084 seam (소비 대상)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **재시작 술어** = 순수 `canRestartForUpdate(state)`, `RestartGateState{isGenerating, activeToolCallCount, activeDbWriteCount, isIndexing}` | `app/src/shared/update-restart.ts:1-15` |
| **게이트 상태 소스** = `Bootstrap.restartGateState()`: `isGenerating=supervisor.all().length>0`, `activeToolCallCount=Σ turn.openToolRuns.size`, `activeDbWriteCount`(백업 구간만), `isIndexing`(현재 상수 false) | `app/src/main/app/bootstrap.ts:259-267`, 필드 `:87-90` |
| **"모든 런타임 idle" 권위원** = `supervisor.all().length === 0`(in-progress 턴 0). `getRuntimePopulation().idle` 은 *parked 재사용 풀*이라 게이트에 쓰면 안 됨 | `features/sessions/supervisor.ts:89-101` |
| **better-sqlite3 = 동기** — 쓰기는 자기 콜스택 내 완결. `quitAndInstall`(메인 스레드)이 도는 순간 in-flight 쓰기 없음 → "DB idle"은 사실상 항상 참. `activeDbWriteCount` 는 백업/VACUUM(유일한 yield 구간)만 관측(0084 D1). **광역 write 계측 불필요**(정확성 무관) | `infra/db/queries.ts`, `features/history/writer.ts:136`, 0084 verify D1 |
| **shutdown 시퀀스** = `will-quit` → `shutdown()`(턴 settle+abort, idle 런타임 close) → `closeDb()`(WAL checkpoint). `quitAndInstall` 이 `will-quit` 발화 → 기존 핸들러 재사용 | `app/src/main/index.ts:175-178`, `bootstrap.ts:273-290` |

### 렌더러/메인 배선 표면

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **로그인 게이트 존재** — `RootGate`: !(bypass\|authenticated)→`LoginFrame`, ready→`AppLayout`. SSO 는 현재 항상 실패(`runSso`) → 실 진입은 `Settings.ssoBypass`. 이후 boot→`AppLayout`→router→`/`→`/new`(home) | `app/src/renderer/src/app/RootGate.tsx:27-33`, `features/login/store.ts:55-65` |
| **home(new)** = 라우트 `/new`→`NewChatLandingPage`. 라우트 판별 `useLocation().pathname` / `matchRouteInfo` | `app/router.tsx:23`, `app/AppLayout.tsx:19-20` |
| **헤더** — 좌측 5버튼 툴바(`Button iconOnly leadingIcon`) + 시스템 메뉴 팝오버("버전"→`HeaderVersionModal`). 버전=`v{__APP_VERSION__}` | `app/src/renderer/src/app/Header.tsx:47-91,107-157` |
| **아이콘** `download`·`refresh`·`alert` 등 존재 | `shared/ui/Icon.tsx` |
| **IPC 4계층** — `CHANNELS`(shared/ipc.ts) → preload `orca.<domain>`(cost 템플릿 `invoke`+`on…` 구독/해제) → 렌더러 `xxxApi`(shared/api/ipc.ts) → store(`costStore` = create + `init*` + `subscribe*`) | `ipc.ts:8-72`, `preload/index.ts:165-176`, `shared/api/ipc.ts:149-157`, `features/cost/store/costStore.ts` |
| **메인 IPC** — `handle(channel,schema,policy,fn)`/`handlePlain`; 핸들러 `handlers/*.ts`의 `registerXHandlers(ctx)` → `Bootstrap.register()` 말미 등록; push=`send.ts`(`sendInstallStatus`/`broadcastConcurrency` 패턴, `getAllWebContents`) | `infra/ipc/handle.ts:24-46`, `bootstrap.ts:342-347`, `infra/ipc/send.ts:19-38` |
| **모달 호스트** — `OverlayLayer`(z-stack, `InstallerDialog`/`AuthExpiredModal`/`SearchModal`/`ConfirmDialogHost`), store selector 로 open. `Modal`/`ModalActions` 프리미티브, 명령형 `openConfirmDialog` | `app/OverlayLayer.tsx:22-56`, `shared/ui/Modal.tsx`, `shared/ui/confirmDialogStore.ts` |
| **스토어 합성** — `App.tsx` Provider 중첩(Tweak>Router>Backend>Sessions>Projects>Cost>Chat>RootGate), 각 `*Provider` 가 `init/subscribe` 호출 | `App.tsx:10-28`, `features/cost/providers/CostProvider.tsx` |
| **electron-updater 미설치** — `package.json` deps 에 없음(신규 런타임 의존성). `electron-builder@^26` 는 devDep. publish=placeholder `generic → https://example.com/auto-updates`, appId `com.orca.app`, `dev-app-update.yml` 는 package 제외 glob(로컬 dev 용) | `app/package.json:26-39,52`, `app/electron-builder.yml:9,45-47` |

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 대조. 기능 = Codex.

1. **electron-updater 배선**: `electron-updater` 의존성 추가(전달 모델 사용자 승인 확정). autoUpdater 래퍼를 컴포지션 루트에 구성, `autoDownload=false`. 이벤트(`checking-for-update`/`update-available`/`update-not-available`/`download-progress`/`update-downloaded`/`error`)를 신규 push 채널로 렌더러에 브로드캐스트. 확인 실패는 **비치명**(로그만, 앱 부팅/UI 차단 없음, 버튼 미노출).
2. **앱 시작 확인**: 윈도우 생성 후(post-boot, 렌더러 존재) `checkForUpdates()` 1회 실행. 결과가 `update-available` 면 store status=`available`.
3. **업데이트 IPC**: invoke `updateCheck`/`updateDownload`/`updateQuitAndInstall` + push `updateStateEvent`/`updateProgressEvent` 추가(zod 스키마 `protocol.ts`), `handlers/update.ts`(`registerUpdateHandlers`) 를 `register()` 에 배선, push 는 `send.ts` broadcast. **`docs/IPC_CONTRACT.md` 동시 갱신**(§6 절차, 채널 수 반영).
4. **렌더러 배선**: `features/update` store(`updateStore`, 상태 `{status:'idle'|'checking'|'available'|'downloading'|'ready'|'error', version?, progress?, error?, canInstall}`) — costStore 미러(`initUpdate`+`subscribeUpdate`). `UpdateProvider` 를 `App.tsx` 에 합성. preload `orca.update` 네임스페이스 + 렌더러 `updateApi`.
5. **헤더 버튼(조건부)**: 헤더에 업데이트 어포던스(툴바 6번째 `Button iconOnly leadingIcon="download"` 또는 메뉴 항목)를 **store status 가 `available|downloading|ready` 일 때만** 노출(idle/최신/error 시 숨김). 로그인·부팅 후 home(`/new`)에서 처음 마주치는 위치.
6. **안내 다이얼로그**: 어포던스 클릭 시 `OverlayLayer` 에 업데이트 다이얼로그 오픈(현재/신규 버전, 릴리스 노트 있으면 표시, 진행률). "업데이트" 클릭 → `updateDownload`(진행률 표시) → 다운로드 완료 시 설치 단계.
7. **idle-gated 설치**: `updateQuitAndInstall` 핸들러는 `canRestartForUpdate(restartGateState())` 가 **true(모든 런타임 idle + tool call 0 + 활성 DB write 0 + 인덱싱 아님)** 일 때만 `quitAndInstall` 을 호출한다. **false 면 설치를 막고** 명확한 안내("작업이 진행 중입니다 — 끝난 뒤 다시 시도")를 반환. 렌더러 다이얼로그는 `canInstall`(게이트 상태)을 라이브 반영(설치 버튼 비활성/사유 표시). **레이스 가드**: `quitAndInstall` 직전 게이트 재확인 + 설치 개시 시 신규 턴 admission 차단(설치 락).
8. **클린 종료 보장**: `quitAndInstall` 이 기존 `will-quit` 시퀀스(`shutdown()` 턴 settle + `closeDb()` WAL checkpoint)를 거쳐 바이너리 교체 전에 DB 를 안전 종료. (재시작 후 새 버전이 0084 마이그레이션/백업을 수행.)
9. **게이트**: `cd app && npm run lint && npm run typecheck && npm test` 통과 + 신규 테스트(update reducer/store 순수 · IPC 스키마 · 설치 핸들러 게이트 분기).

## 범위 / 비범위

- **범위(0085 — 인앱 업데이트 메커니즘 + UX)**: 인수 기준 1~9. electron-updater 배선·시작 확인·IPC·store·헤더 버튼·안내 다이얼로그·idle-gated 설치·클린 종료.
- **비범위(OQ3 배포-타임 설정 / 후속 "release ops" 핸드오프)**:
  - **실 배포 호스트 결정**: `publish` 실 URL(generic HTTPS/R2/S3 vs GitHub Releases) — 0085 는 스캐폴드 `generic` placeholder 위에서 메커니즘을 완성(코드 변경 없이 URL 만 교체 가능).
  - 코드 서명 인증서(OV/EV) + `verifyUpdateCodeSignature` 정책(미서명→공개 전 서명) · mac notarize.
  - CI 서명/업로드 파이프라인 · 채널(internal/beta/latest) · `stagingPercentage` staged rollout.
  - 텔레메트리(OQ4) · 라이센스(OQ5) · 제품 SemVer 정책 · `package.json` author/homepage 정합 · TRD §4 uv 드리프트.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성**: `electron-updater`(런타임) — **전달 모델로 사용자 승인 확정**(0084 라이브 세션). `package.json` deps 추가.
- 재사용: `canRestartForUpdate`/`Bootstrap.restartGateState()`(0084) · `OverlayLayer`/`Modal`/`openConfirmDialog` · `costStore`/`CostProvider` 패턴 · `infra/ipc/handle`·`send`(`getAllWebContents` broadcast) · `handlers/*` 등록 패턴.
- 전제: 단일 인스턴스. 시작 확인은 렌더러 생성 후(브로드캐스트 대상 존재). 실 업데이트 검증은 dev `dev-app-update.yml`/스테이징 피드로(플레이스홀더 URL 은 확인 실패=비치명 경로로 처리).

## 설계

- **메인**: 컴포지션 루트에 `autoUpdater` 래퍼(어댑터 아님 — infra/app 경계) 구성, `autoDownload=false`·`autoInstallOnAppQuit` 는 기본 유지. 이벤트 → `broadcastUpdateState`/`broadcastUpdateProgress`(send.ts, `getAllWebContents` 루프). `handlers/update.ts`: `updateCheck`(재확인), `updateDownload`(`downloadUpdate`), `updateQuitAndInstall`(게이트 통과 시 `quitAndInstall`, 실패 시 사유 반환). 시작 확인은 `index.ts` `whenReady` 의 `createWindow` 뒤 1회.
- **idle 게이트**: 핸들러가 `ctx` 를 통해 `restartGateState()` 접근(컴포지션 루트 주입). `canRestartForUpdate` 재사용. 설치 개시 시 admission 락(신규 턴 거부) → 게이트 재확인 → `app.quit()`/`quitAndInstall`. 렌더러엔 `canInstall`(+사유)을 state 이벤트에 포함해 라이브 반영.
- **렌더러**: `features/update`(store+provider+hooks) 신설, 4-layer 준수(도메인 로직=feature, 헤더 버튼·다이얼로그 배치는 `app/` 셸에서 store selector 소비 — pages 아님, 헤더/OverlayLayer 는 `app/`). 다이얼로그는 `OverlayLayer` z-stack 에 추가. 헤더 버튼은 `Header.tsx` 툴바에 조건부.
- 레이어 경계: 메인 update 로직=`app`(컴포지션 루트)+`infra`(ipc), 재시작 술어=`shared`. 렌더러 update=`features/update`, 셸 배치=`app/`. feature 교차 0.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **확인 실패/오프라인/플레이스홀더 피드**: 조용히 idle 유지(버튼 미노출), 에러 토스트 없음(시작 시 소음 방지).
- **다운로드 중 진행률**: `download-progress` %; 취소는 MVP 비범위(창 닫기=백그라운드 지속).
- **설치 시 비-idle**: 다이얼로그 설치 버튼 비활성 + "작업 진행 중" 사유. 턴 종료 시 게이트 갱신되어 활성화. (옵션: "다음 종료 시 설치" = `autoInstallOnAppQuit` — 리스크표 참조, 기본 채택 여부는 Open Question.)
- **레이스**: 클릭 후 설치 전 새 턴 시작 → admission 락 + 직전 재확인으로 차단.
- **멀티 윈도우**: 상태 broadcast(전 webContents).
- **로그인 전**: 버튼은 `AppLayout`(post-boot)에서만 — 로그인/부팅 화면엔 헤더 자체가 없음.
- **테마/접근성**: 버튼 `aria-label`, 다이얼로그 포커스 트랩(`Modal` 프리미티브 준수), 3테마 토큰.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **미서명 Windows 자동업데이트 취약**(`verifyUpdateCodeSignature` 기본 true → 미서명 시 설치 거부·SmartScreen) | 사용자 방침=미서명→공개 전 서명. internal/beta 는 `verifyUpdateCodeSignature:false`(문서화), latest 전 서명 필수. **OQ3**(코드 아님·배포 설정) |
| **플레이스홀더 피드**(`example.com`)로 확인 실패 | 확인 실패=비치명(로그·버튼 미노출). dev 는 `dev-app-update.yml`/스테이징. 실 URL 은 배포 시 교체(코드 무변경) |
| **설치 레이스**(게이트 통과 후 새 턴) | 설치 개시 시 admission 락 + `quitAndInstall` 직전 게이트 재확인 |
| **동기 DB write 는 게이트로 관측 불가**(D1) | better-sqlite3 동기 모델상 `quitAndInstall`(메인 스레드) 시점에 in-flight write 없음 + 턴 중 write 는 `isGenerating` 으로 이미 차단 → **광역 계측 불필요**(정확성 확보). 이 근거를 plan/verify 에 명시 |
| **quitAndInstall 클린 종료 미보장 시 DB 손상** | 기존 `will-quit`→`shutdown()`+`closeDb()`(동기 WAL checkpoint) 재사용, 백업(`activeDbWriteCount`) 드레인 후 진행 |
| **신규 의존성 유지보수**(electron-updater) | 전달 모델 승인 확정. electron-builder 와 동일 벤더·표준 |

- 되돌리기 어려운 결정: electron-updater 채택(승인됨). `autoDownload=false`(사용자 클릭 트리거) — UX 요구 정합.
- **단독 결정 금지(Open Question) → 사용자에게**: ① 실 배포 호스트(generic vs GitHub Releases) ② `autoInstallOnAppQuit`("다음 종료 시 설치") 기본 채택 여부 ③ 헤더 버튼을 home(`/new`) 한정 vs 전 화면 노출(현 설계=available 이면 전 헤더 노출, home 이 최초 접점) — 모두 배포 정책/UX 취향 항목.

## 영향 받는 파일

- 메인: 신규 `app/src/main/app/updater.ts`(또는 `infra/updater/`) 래퍼 · `app/src/main/app/handlers/update.ts` · `bootstrap.ts`(register 배선·restartGateState 노출) · `index.ts`(시작 확인) · `infra/ipc/send.ts`(broadcast)
- 공유: `src/shared/ipc.ts`(CHANNELS) · `src/shared/protocol.ts`(zod)
- preload: `src/preload/index.ts`(`orca.update`)
- 렌더러: 신규 `features/update/{store,providers,hooks,components}` · `shared/api/ipc.ts`(`updateApi`) · `app/App.tsx`(Provider) · `app/Header.tsx`(버튼) · `app/OverlayLayer.tsx`(다이얼로그)
- 문서: `docs/IPC_CONTRACT.md`(채널 추가) · `docs/handoff/INDEX.md` · `docs/PHASES.md`(승격 시)

## 참고 문서

- 0084 `docs/handoff/0084-app-distribution-auto-update/{plan,verify}.md`(재시작 술어·D1)
- `@docs/IPC_CONTRACT.md §6`(채널 변경 절차 — **반드시 동시 갱신**)
- `@docs/arch/frontend/` (OverlayLayer/모달·4-layer), `@docs/arch/backend/runtime-ipc.md §3.1`(자동업데이트 OQ3)
- electron-updater 문서: https://www.electron.build/auto-update (autoDownload·이벤트·quitAndInstall)
- `@docs/PRD.md §11 OQ3/OQ4/OQ5`

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: update store/reducer 순수 변환 · IPC 스키마(zod safeParse) · 설치 핸들러의 게이트 분기(idle=quitAndInstall 호출/비-idle=거부 사유) — autoUpdater 는 주입 mock 으로.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 4개 명시 UX 요구를 라이브 세션 인용, 추론(autoDownload=false·게이트 재사용)은 추론으로 표기.
- [x] 자료조사 — 0084 seam + 렌더러/메인 배선 표면 전부 `파일:라인` 근거.
- [x] 인수 기준 — 번호·검증 가능(핸들러 분기·조건부 렌더·게이트 술어·테스트).
- [x] 의존 기술 — electron-updater 신규 의존성(승인 확정) 표기, 재사용 seam 명시.
- [x] 파생 UX — 확인 실패/비-idle/레이스/멀티윈도우/로그인 전/테마 펼침.
- [x] 리스크 — 미서명·플레이스홀더·레이스·동기 write(D1 근거)·클린 종료, Open Question(호스트·autoInstallOnAppQuit·버튼 범위)을 사용자로 분리.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다. 설계자(Claude)는 위쪽만.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행:
  - 앱 시작 후 silent update check.
  - main update state cache + renderer snapshot invoke.
  - update IPC / preload / renderer updateApi / store/provider 패턴.
  - Header 조건부 update affordance.
  - OverlayLayer blocking update dialog.
  - `canRestartForUpdate(restartGateState())` 기반 idle-gated install.
- 사용자 확정 정책 반영으로 원 설계에서 조정:
  - 원 plan의 `autoInstallOnAppQuit` 기본 유지 방향은 superseded 되었다. 구현은 `autoInstallOnAppQuit=false`로 고정했다.
  - 다운로드는 사용자 명시 액션으로만 수행하므로 `autoDownload=false`를 유지했다.
  - 원 plan의 generic placeholder 기본 feed 방향은 superseded 되었다. 기본 publish feed는 GitHub Releases `muzaby/orca-skin`으로 둔다.
  - 일반 앱 종료/창 닫기/OS shutdown에서는 업데이트를 자동 설치하지 않는다.
  - 설치는 update modal에서 사용자가 명시적으로 `updateQuitAndInstall`을 호출한 경우에만 시작한다.
  - 사내/폐쇄망 배포는 `orca.json.update`의 provider/owner/repo/url/enabled/channel override로 처리한다.
  - 모달 구현은 Orca 디자인 토큰(`bg-panel`, `bg-bg`, `text-ink`, `border-border`, `rounded-r*`)을 준수하고 ESC/backdrop close를 제공하지 않는 update 전용 blocking shell로 구현했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `autoInstallOnAppQuit` 기본값이 idle gate를 우회할 수 있음 | ✅ `autoInstallOnAppQuit=false` 명시 | 사용자 결정: 앱 종료 시 자동 설치 미제공 |
| 2 | startup update event가 renderer subscription 전에 유실될 수 있음 | ✅ main state cache + `updateState` snapshot invoke | init sync 필요 |
| 3 | `canInstall`이 session 상태 변화 후 stale일 수 있음 | ✅ active turn count 변화 시 `refreshGate()` broadcast | dialog live 반영 |
| 4 | gate 통과 후 신규 chat turn race | ✅ install lock + chat admission 초입 거부 + quit 직전 gate 재확인 | AC7 race guard |
| 5 | provider별 releaseNotes/progress DTO 불안정 | ✅ renderer-safe DTO로 정규화 | IPC 안정성 |
| 6 | public 개인 repo와 사내 org repo가 다름 | ✅ `orca.json.update.owner/repo` override | 폐쇄망/사내 운영 |
| 7 | GitHub 접근 불가 폐쇄망 | ✅ `provider:'generic'` + internal HTTPS mirror 지원 | 운영 유연성 |
| 8 | 기존 shared Modal은 ESC/backdrop close가 기본이라 blocking update UX와 충돌 | ✅ update 전용 dialog shell 구현 | 사용자 지시: modal 외 조작 금지 |

## [구현자 기입] 구현 체크리스트

- [x] electron-updater dependency 추가
- [x] electron-builder GitHub publish 기본값 설정
- [x] orca.json update override schema 추가
- [x] main UpdateController 추가
- [x] autoDownload=false, autoInstallOnAppQuit=false
- [x] update state cache + broadcast 구현
- [x] update IPC handlers 구현
- [x] preload window.orca.update 구현
- [x] renderer updateApi 구현
- [x] features/update store/provider/dialog 구현
- [x] Header update button 조건부 표시
- [x] OverlayLayer에 UpdateDialog 합성
- [x] install lock + chat admission guard
- [x] docs/IPC_CONTRACT.md 갱신
- [x] zod schema 및 tests 추가

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | package/builder, main updater/IPC/config/chat admission, shared IPC/protocol, preload, renderer update feature/Header/OverlayLayer/App, IPC contract, handoff plan |
| 실행 명령 | `npm install electron-updater@^6.6.2` / `npm run lint` / `npm run typecheck` / targeted tests |
| 게이트 결과 | 구현 턴 최종 보고 참조 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `<commit after implementation>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | AC9 신규 테스트 열거 2/3 미충족 — (a) `updateStore` 순수 전이 단위 테스트, (b) 설치 게이트 분기(`computeUpdateInstallGate` idle↔비-idle · `UpdateController.quitAndInstall` not-ready/not-idle/이중 재확인) 단위 테스트. `canRestartForUpdate` 는 0084 로 커버되나 0085 가 얹은 이중 게이트 재확인·installPending 락 분기는 무테스트(안전 크리티컬). | verify r1 §매트릭스 AC9 / §자기리뷰 | 게이트 판정부를 electron 비의존 순수 모듈로 분리하는 seam 선행 후 단위 테스트 추가(후속 라운드 또는 Claude 비기능 직접). | **open** |
