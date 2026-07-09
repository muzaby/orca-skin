# Verify — 0085-auto-update-ux

> 인앱 자동 업데이트 UX(electron-updater 배선 + 헤더 버튼 + idle-gated 설치) 검증. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0085-auto-update-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-07-09 |
| 대상 커밋 | `ef41e95` |
| 라운드 | 1 |
| 상태 | **PASS** (AC9 테스트 열거 부분충족 → D1 open) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> plan `[구현자 기입]` 설계 리뷰 · 놓친 잠재 문제(8건) · 구현 체크리스트를 먼저 읽고 반영.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 원 plan `autoInstallOnAppQuit` 기본 유지 → `false` 고정으로 supersede | 타당 — "앱 종료 시 자동 설치"는 idle 게이트를 우회하므로 UX 요구(모든 런타임 idle 시에만)와 충돌. `updater.ts:90` `autoInstallOnAppQuit=false` 확인 | AC7 근거 강화(우회 경로 차단). plan 리스크표 OQ② 해소 |
| 원 plan generic placeholder feed → GitHub Releases `muzaby/orca-skin` 기본 | 타당(사용자 확정) — plan OQ① 배포 호스트 결정. `electron-builder.yml:45-48` `provider: github` 확인 | AC1 배선. 실 서명/CI 는 여전히 OQ3 후속 |
| 놓친 문제 #2 startup event 유실 → main state cache + `updateState` snapshot invoke | 타당 — `handlers/update.ts:6` `updateState` + `UpdateProvider` mount 시 `initUpdate()`. AC4 event-loss 복구 정합 | 매트릭스 AC4 증거 |
| 놓친 문제 #3 `canInstall` stale → active turn 변화 시 `refreshGate()` broadcast | 타당 — `bootstrap.ts:370-373` ActiveTurnTracker 콜백이 `updateStateChanged()`→`refreshGate()`. AC7 라이브 반영 | 매트릭스 AC7 증거 |
| 놓친 문제 #4 gate 통과 후 신규 턴 race → install lock + chat admission 거부 + quit 직전 재확인 | 타당 — `updater.ts:157-172`(before/after 이중 게이트) + `chat-turn.ts:255-265`(`isUpdateInstallPending` 거부). AC7 레이스 가드 정합 | 매트릭스 AC7 증거 |
| 놓친 문제 #6/#7 사내/폐쇄망 → `orca.json.update` provider/owner/repo/url override | 타당 — `orca-file.ts:12-38` union 스키마 + 테스트. 비밀 미저장 주석 확인 | 위생 검토 반영 |
| 놓친 문제 #8 shared Modal ESC/backdrop close 충돌 → update 전용 blocking dialog | 타당 — `UpdateDialog.tsx` 는 backdrop `onClick` stopPropagation·ESC 핸들러 없음·busy 중 닫기 버튼 미노출. 사용자 지시("modal 외 조작 금지") 정합 | 매트릭스 AC6, UI 시각은 사람 확인 |

## 요구사항 충족 매트릭스

> plan 인수 기준 1~9 를 1:1 대조. 증거 = `파일:라인` / 게이트 출력.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | electron-updater 배선(`autoDownload=false`·6 이벤트 broadcast·확인 실패 비치명) | ✅ | `package.json:33` `electron-updater@^6.8.9`; `updater.ts:89-90` autoDownload/autoInstallOnAppQuit=false; `updater.ts:200-232` 6 이벤트(`checking/available/not-available/download-progress/downloaded/error`) 등록; `updater.ts:131-136` 시작 확인 실패=status `idle`(+lastError 로그)·버튼 미노출; `loadElectronAutoUpdater` 실패 시 `createNoopUpdater` 폴백 |
| 2 | 앱 시작 확인 1회(post-boot) | ✅ | `index.ts:158` `createWindow` 뒤 `void router.checkForUpdatesOnStartup()`; `bootstrap.ts:285-287`→`updates.check(true)`; `update-available` 시 status `available`(`updater.ts:204-212`) |
| 3 | 업데이트 IPC(invoke 3+snapshot 1 · push 2)+zod+핸들러 배선+IPC_CONTRACT 갱신 | ✅ | `ipc.ts:72-78` 6 채널; `protocol.ts:117-146` zod 스키마; `handlers/update.ts` `registerUpdateHandlers`; `bootstrap.ts:380` `register()` 배선; `send.ts:42-52` broadcast; `IPC_CONTRACT.md` 57→**63**(§2.3-b Update 6채널·도메인 18개) |
| 4 | 렌더러 store(costStore 미러)+Provider+preload+updateApi | ✅ | `features/update/store/updateStore.ts`(`useUpdateStore`+`initUpdate`+`subscribeUpdate`, status 7종 incl `installing`); `providers/UpdateProvider.tsx` mount 시 subscribe+init; `App.tsx:19` `<UpdateProvider>` 합성; `preload/index.ts:206-222` `orca.update`; `shared/api/ipc.ts:168-177` `updateApi` |
| 5 | 헤더 조건부 버튼(status available/downloading/ready[/installing]) | ✅ | `Header.tsx:35-37` `showUpdateButton=['available','downloading','ready','installing'].includes(status)`; `:96-105` `Button iconOnly leadingIcon="download" aria-label="업데이트"`. idle/error/checking 시 숨김 |
| 6 | 안내 다이얼로그(현재/신규 버전·릴리스 노트·진행률·다운로드→설치) | ✅ | `UpdateDialog.tsx` OverlayLayer z-stack(`OverlayLayer.tsx:57` `<UpdateDialog>`); 현재/새 버전(:70-78)·릴리스 노트(:94-101)·진행률(:80-93)·1차 버튼 available→`download`/ready→`quitAndInstall`(:128-131) |
| 7 | idle-gated 설치(`canRestartForUpdate(restartGateState())`·비-idle 거부+사유·canInstall 라이브·레이스 가드) | ✅ | `updater.ts:154-172` quitAndInstall: status≠ready→`not-ready`; before 게이트 false→`not-idle`+reason; `installPending=true`→`prepareForUpdateInstall`(idle 런타임 close)→after 재확인→`quitAndInstall(false,true)`; `computeUpdateInstallGate`=`canRestartForUpdate` 재사용(`shared/update-restart.ts`, 0084); `chat-turn.ts:255-265` 설치 락 중 신규 턴 거부; `bootstrap.ts:370-373` 턴 수 변화 시 `refreshGate` broadcast |
| 8 | 클린 종료(`will-quit`→`shutdown()`+`closeDb()`) | ✅ | `quitAndInstall(false,true)`→app quit→기존 `index.ts` `will-quit` 시퀀스 재사용(`bootstrap.shutdown()`+`closeDb()`, 0084 검증됨). 신규 종료 경로 없음(재사용) |
| 9 | 게이트 통과 + 신규 테스트(store/reducer 순수 · IPC 스키마 · 설치 핸들러 게이트 분기) | ⚠️ **부분** | **게이트 ✅**(lint 0·typecheck 3종 0·test 773 pass). **테스트 열거 1/3**: IPC 스키마 ✅(`update-protocol.test.ts` 3), orca.json update 파싱 ✅(`orca-file.test.ts` +4). **store 순수변환 ✗ · 설치 핸들러 게이트 분기(`computeUpdateInstallGate`/`UpdateController.quitAndInstall` idle↔비-idle) ✗** → **D1** |

**요약: 기능 AC1–AC8 = 8/8 충족. AC9 = 게이트 green + 테스트 열거 부분(1/3).**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint | ✅ | — | `eslint --cache --fix ./src` 통과(에러 0) |
| 게이트 typecheck | ✅ | — | node·web·test 3종 전부 통과 |
| 게이트 test | ✅ | — | **773 passed** / 3 suite 로드 실패=electron 바이너리 403 환경 제한(0050·0083 계열·코드 무관) |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 | 이견 시 중재 | AC1–8 ✅, AC9 부분(위 매트릭스) |
| 레이어 경계(boundaries) | ✅ | — | lint 위반 0(update 로직=`app`+`infra`+`shared`, 렌더러 update=`features/update`, 셸 배치=`app/`, feature 교차 0) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT §2.3-b 신설·채널 총계 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 미변경. `orca.json.update`=owner/repo/url 만(비밀 미저장, `orca-file.ts:42` 주석) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | `electron-updater` — 0084 라이브 세션 **승인 확정**(전달 모델) |
| 제품 의도 부합(4 UX 요구) | ✖ 보조 | ✅ 결정 | 시작 확인·home 헤더 버튼·안내창·idle 설치 모두 배선 — 실기 시각/거동은 사람 확인 대기 |
| Open Questions(호스트·autoInstallOnAppQuit·서명·CI) | ✖ | ✅ | 배포호스트=GitHub Releases·autoInstallOnAppQuit=false 사용자 확정. 서명/CI/채널/staged rollout=OQ3 후속 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기(헤더 버튼·다이얼로그 톤·진행바·릴리스 노트) |
| 실 패키지 업데이트 QA | ✖ | ✅ | 사람 확인 대기(패키지 빌드+실 피드로 check→download→install 전 경로·다중 창) |
| PR 머지 승인 | ✖ | ✅ | 사람 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
> eslint --cache --fix ./src          # 에러 0

$ npm run typecheck
> typecheck:node (tsc -p tsconfig.node.json) ✅
> typecheck:web  (tsc -p tsconfig.web.json)  ✅
> typecheck:test (tsc -p tsconfig.test.json) ✅

$ npm test
 Test Files  3 failed | 101 passed (104)
      Tests  773 passed (773)
# 실패 3 suite = chat-turn.continuity / chat-turn.runtime-resilience / history/writer
#  → "Electron failed to install correctly"(node_modules/electron/index.js) = 바이너리 403 환경 제한.
#    (0) 테스트로 표기 = 로드 단계 실패(어서션 실패 아님). 0050·0080·0083 verify 와 동일 계열·코드 무관.
# 신규/영향 테스트 단독 재실행: update-protocol(3) + orca-file(+4) = 14 passed.
```

> 게이트 전 `npm rebuild better-sqlite3`(Node ABI, 0019 계열)로 db 계열 red 해소 — 잔여 3 red 는 electron 바이너리(별개 자원, 이 환경 미해소).

## 위생 검토

- 키/토큰/이메일/IP 스캔: 신규 코드에 비밀 리터럴 0. `orca.json.update` 는 provider/owner/repo/url/channel/enabled 만(토큰·API 키 미저장, `orca-file.ts:42` 명시 주석). `electron-builder.yml` publish 는 owner/repo(public)만.
- 변동성/일회성/장문설명 혼입: AGENTS.md 미변경. IPC_CONTRACT 는 SSOT 정합 갱신(채널 총계·도메인·§2.3-b).

## PHASES.md 정합성

- 페이즈 표에 "인앱 자동 업데이트 UX (handoff `0085-auto-update-ux`)" 행 승격 — 상태 **완료 (커밋 `ef41e95`)**. INDEX 행 `verify/PASS`.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 이 AC9 에 "설치 핸들러 게이트 분기 테스트(autoUpdater 주입 mock)"를 명시했으나, `UpdateController`/`computeUpdateInstallGate` 가 모듈 최상위에서 `electron`(`app.getVersion`)·`send.ts`(webContents)를 import 하는 구조라 **순수 단위 테스트 seam 이 부재**하다. 설계가 "주입 mock" 을 요구했으면 게이트 판정부(`computeUpdateInstallGate`+상태 전이)를 electron 비의존 순수 모듈로 분리하는 seam 까지 지정했어야 했다. → D1.
- **구현 단계**: 기능 AC1–8 은 견고. 그러나 AC9 의 두 테스트 범주(store 순수변환·게이트 분기)를 생략했다. `canRestartForUpdate` 자체는 0084 `update-restart.test.ts` 로 커버되나, 0085 가 얹은 **이중 게이트 재확인·installPending 락·not-ready/not-idle 반환 분기**는 무테스트다(안전 크리티컬 경로).
- **검증 단계**: 이 환경(electron 403)에서는 `UpdateController` 를 직접 실행 검증할 수 없어 **코드 판독 + 게이트 grep**으로 갈음했다. 실 패키지 거동(quitAndInstall→will-quit→closeDb 실제 종료·다중 창 broadcast·진행바)은 사람 실기 몫으로 분리한다.

## 파생 이슈 등록 (plan "파생 이슈" 챕터와 동기)

- **D1 (open)**: AC9 테스트 열거 2/3 미충족 — (a) `updateStore` 순수 전이(open/close·check/download/quitAndInstall 결과 반영) 단위 테스트, (b) 설치 게이트 분기(`computeUpdateInstallGate` idle↔비-idle · `UpdateController.quitAndInstall` not-ready/not-idle/이중 재확인) 단위 테스트. 선행으로 게이트 판정부를 electron 비의존 순수 모듈로 분리하는 seam 이 필요할 수 있음. 안전 크리티컬 경로이므로 후속 라운드(또는 Claude 비기능 직접)로 조속 클로즈 권장.

## 결론 / 다음 단계

- **상태: PASS (r1)** — 기능 인수 AC1–AC8 = 8/8 충족(증거 첨부), 게이트 lint/typecheck/test 전부 green(773 runnable pass·3 suite=electron 403 환경 제한·코드 무관), 레이어 경계 0, 신규 의존성=승인된 `electron-updater` 1건, 비밀 미저장. **AC9 는 게이트 green + 테스트 열거 부분(1/3)** — 누락 2건을 **D1(open)** 로 이관(안전 크리티컬 게이트 분기 무테스트).
- PHASES 승격 + INDEX `verify/PASS`. **D1 을 open 으로 남겨** 후속에서 게이트/스토어 단위 테스트를 채운다.
- **사람 확인 대기**: `npm run dev`/패키지 빌드 실기 — 시작 확인→home 헤더 버튼 노출·안내 다이얼로그 시각/톤·다운로드 진행바·idle 비-idle 설치 게이트 거동·다중 창 broadcast·실 GitHub Releases 피드; 서명 인증서/CI/채널/staged rollout(OQ3); PR 머지.
