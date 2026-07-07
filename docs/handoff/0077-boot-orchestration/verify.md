# Verify — 0077-boot-orchestration

## 메타

| 항목 | 값 |
|---|---|
| slug | `0077-boot-orchestration` |
| 검증자 | Claude Code |
| 일자 | 2026-07-07 |
| 대상 커밋 | `dee1e5b` |
| 라운드 | 2 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 §이견 — `bypass` 하이드레이션은 로그인 게이트 선행조건이라 부트 단계가 될 수 없어 `RootGate` 에 유지, 부트는 `lastSessionId` 랜딩 타겟부터 시작 | **타당** | `RootGate.tsx:17-19`(hydrateBypass 유지) ↔ `steps.ts:92-98`(landing-target 이 첫 필수 단계). AC5 매트릭스에 증거로 반영 |
| 설계 리뷰 §이견 — 세션 목록 로드를 mandatory 로 두면 목록 장애가 `/new` 진입까지 막으므로 `sessions` 를 non-mandatory degrade 로 구현(plan 카탈로그는 ✅ 필수였음) | **타당 — 설계보다 안전한 정제** | plan §"부트 단계 카탈로그"(설계 세부, 번호 인수 아님)의 5번 `sessions` mandatory → 구현은 non-mandatory. "앱 진입 자체가 불가능한 단계만 mandatory"(=`landing-target` 단독) 최소필수 원칙. AC3/AC4 는 특정 단계가 아닌 필수/비필수 *동작* 을 규정하므로 미충돌. **결과: 유일 필수 단계 = `landing-target`(`settingsApi.get`)** — 아래 O1 로 사용자 확인 항목화 |
| 놓친 문제 #1~#6(선조치 ✅) — LoginFrame 부트에러/재시도 분리·`init*/subscribe*` 분리·landingTarget SSOT·timing policy·접근성·main BootReport | **모두 타당·구현 확인** | 매트릭스 AC1~6 증거로 개별 확인. 이중 fetch 회피(#2)·landingTarget SSOT(#3)는 코드 재검 완료 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 로그인 게이트 통과 후 랜딩 진입 **전** `BootScreen`(inflight 애니메이션) 표시 | ✅ | `RootGate.tsx:28-33` — 미인증→`LoginFrame` / `phase∈{idle,running}`→`BootScreen` / `ready`→`AppLayout`. `BootScreen.tsx:34-37` = spinner-only(`animate-spin`, 단계 텍스트 비노출), `motion-reduce:animate-none` |
| 2 | 각 단계 콘솔 출력 `[boot] <id> running` → `ok (Nms)`/실패, 소요시간 포함 | ✅ | `steps.ts:157-158`(running), `:166-168`(ok+durationMs), `:173-178`(mandatory→`console.error`+throw / optional→`console.warn`). bootStore.test/steps.test 이벤트 검증 |
| 3 | **필수** 단계 실패 → `LoginFrame` 복귀 + 에러 표시 + 재시도 재실행 | ✅ | `RootGate.tsx:29-31`(`failed`→`<LoginFrame bootError onRetryBoot=runBoot>`), `LoginFrame.tsx:55-67`(alert 배너 + "부트 다시 시도"), `bootStore.ts:52-53`(retry 가드 통과 후 재실행). `steps.test.ts:95-104`(필수 실패 throw+`landing-target:failed`) |
| 4 | **비필수** 단계 실패 → `console.warn` degrade 후 랜딩까지 진행 | ✅ | `steps.ts:172`(status `degraded`), `:178`(warn), for-loop 계속. `steps.test.ts:81-93`(backend degrade→`/new`), `:42-54`(main-report degrade) |
| 5 | 신규 라우트 없이 기존 `/new` 또는 `/chat/:lastSessionId` 도달 | ✅ | `BootRedirector.tsx:8-9`(`landingTarget` 소비, `?? '/new'`), `steps.ts:182`(`/chat/${id}`\|`/new`), `router.tsx:22`(`/`=BootRedirector, 신규 라우트 0). landingTarget SSOT 로 이중 IPC 제거 |
| 6 | (선택) main 부트 리포트 `bootApi` IPC 조회 + IPC_CONTRACT 동시 갱신 | ✅ | `boot-report.ts`(`BootReportRecorder` 스냅샷·불변복사), `bootstrap.ts:135-207`(전 단계 recorder wrap + critical/warning 분류), `handlers/boot.ts`, `ipc.ts:15`(`bootReport`)+타입, preload/renderer `bootApi.report`, `IPC_CONTRACT.md` 54→55 + §2.1-b 신설 |
| 7 | 게이트 통과 · 레이어 경계 0 · 신규 런타임 의존성 0 | ✅ | 아래 게이트 재실행. `git diff --stat` package.json 무변경(신규 dep 0), lint(boundaries) 0 |

**7/7 충족** (선택 6 포함).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 · typecheck 3종 0 · test 723/723(runnable) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 (위 매트릭스 `파일:라인`) |
| 레이어 경계 위반 0 | ✅ | — | lint pass — 오케스트레이터가 `app/` 셸에서 feature `init*` 하향 호출 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT §2.1-b + §6 경로 갱신 정합 |
| AGENTS.md 위생 스캔 | ✅ | ✅ | AGENTS.md 변경 없음 — 스캔 N/A |
| 제품 의도(게이팅 granularity·부트 지연) | ✖ 보조 | ✅ 결정 | **O1 — 사람 확인 대기** |
| 시작 SLA 수치(PRD §11 OQ6) | ✖ 단독 금지 | ✅ | 3s warning/10s timeout 은 named policy 로 분리하되 UI 비노출 — 수치 확정은 사용자 |
| UI/UX 시각 검증(BootScreen·에러 배너·재시도) | ✖ | ✅ | 사람 확인 대기(`npm run dev`) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 dep 0 — N/A |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
  (eslint --cache --fix ./src) — 위반 0 (boundaries 포함)

$ npm run typecheck        # node + web + test
  typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅ — 에러 0

$ npx vitest run  src/renderer/src/app/boot/{steps,bootStore}.test.ts  src/main/app/boot-report.test.ts
  Test Files 3 passed (3) · Tests 11 passed (11)

$ npm test   # 전체 (better-sqlite3 Node ABI 재빌드 후)
  Test Files 3 failed | 91 passed (94) · Tests 723 passed (723)
```

- **전체 723/723 통과.** 로드 실패한 3 스위트(`chat-turn.continuity`·`chat-turn.runtime-resilience`·`history/writer`)는 `import electron` 이 필요하나 **본 검증 환경에서 프록시가 electron 바이너리 다운로드를 차단**(403)해 패키지 미설치 → 로드 불가. 세 파일 모두 0077 diff 무관(변경 파일 아님)이며, 구현자 환경(바이너리 존재)에서 734 passed 로 보고됨. 환경 제한이지 코드 회귀 아님.
- 게이트 `npm test` 는 `pretest` ABI 훅이 없어 `better-sqlite3` 를 Node ABI 로 수동 재빌드(`npm rebuild better-sqlite3`) 후 실행함(0019 계열 dual-ABI 환경 제약).

## 위생 검토

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 N/A.
- IPC_CONTRACT §6 변경 절차 경로가 구 `ipc/handlers/`·`ipc/router.ts` → 신 `app/handlers/`·`Bootstrap.register()` 로 함께 정정됨(0062 구조와 정합) — 부수 위생 개선.

## PHASES.md 정합성

- `docs/PHASES.md` 페이즈 표에 0077 행 승격(범위·게이트·사람 확인 대기·커밋 `dee1e5b`). "현재 작업 중" 은 보드 링크만 유지.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 카탈로그가 `sessions` 를 mandatory 로 두었으나 최소필수 원칙과 배치됐다(구현자가 non-mandatory 로 교정). "필수만 순차, 비필수 병렬" 완화책도 **구현 형태(단일 for-loop 순차)** 를 충분히 특정하지 못해 O1(아래) 여지를 남겼다.
- **구현 단계**: 기능은 완결적이나 (a) 비필수 단계가 여전히 `ready` 를 게이팅(O1), (b) `bootstrap{Backend,Sessions,Projects,Cost}` 하위호환 래퍼가 무호출 dead code(O2)로 남았다.
- **검증 단계**: electron 바이너리 부재로 3 스위트를 직접 못 돌려 구현자 보고(734)에 의존했다. BootScreen·에러 배너의 **시각/모션 검증은 사람 몫**(에이전트 미수행).

---

## [검증자 기입] 파생 이슈 (Derived Issues)

> PASS 종료. 아래는 **차단 아님** — 사람 확인/후속 후보. 인수 기준 7/7 은 충족.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| O1 | **비필수 단계가 AppLayout 페인트를 게이팅.** `runBootSteps` 는 단일 순차 for-loop 라 `phase='ready'` 가 **모든** 단계(진단 `main-report` + 비필수 `backend`·`sessions`·`projects-cost`) 완료/타임아웃 뒤에만 세팅된다(`steps.ts:148-182`, `bootStore.ts:63-64`). 병렬화는 `projects-cost` 내부만 적용(`steps.ts:118-122`) — `main-report`(첫 단계·크리티컬패스)·`backend`·`sessions` 는 순차. ⇒ "degrade & 계속"이 **부트 실패는 안 막지만 랜딩 지연은 막지 못함**: 비필수 단계 hang 시 최대 10s(`optionalTimeoutMs`)까지 스피너 유지. 각 store 는 자체 `loading` 상태를 이미 가지므로(0013), 0077 이전 병렬-비차단 모델 대비 time-to-interactive 회귀 가능. | verify r2 (수석엔지니어 관점) / plan 완화책 "필수만 순차, 비필수 병렬" 부분 적용 | **사용자 결정(제품 UX·게이팅 granularity)**: (A) landing-target 확정 후 비필수 단계를 background(비게이팅) fire-and-forget 로, 또는 (B) 최소 비필수 단계 `Promise.allSettled` 병렬화. 사용자의 명시 의도("부트 게이팅")와의 균형은 사람 판단. | open (비차단) |
| O2 | `bootstrapBackend`/`bootstrapSessions`/`bootstrapProjects`/`bootstrapCost` 가 `init*`/`subscribe*` 분리 후 **무호출 dead code**(`backendStore.ts:51`·`sessionsStore.ts:57`·`projectsStore.ts:57`·`costStore.ts:23`). 주석은 "하위호환용"이나 내부 모듈이라 외부 소비자 없음(`grep` 확인, Provider 는 전부 `subscribe*` 만 호출). | verify r2 위생 | 후속 트리비얼 정리(4 export 제거) 또는 의도적 보존이면 주석 명시. | open (비차단) |
| O3 | `docs/AGENTS.md` 인벤토리 라인이 "IPC_CONTRACT … 총 53 채널"로 표기(SSOT 는 55). **0077 이전부터 드리프트**(변경 전 53 vs 54)라 본 핸드오프 소관 아님. IPC_CONTRACT §2 자체는 내부 정합(55·boot 1). | verify r2 위생(사전 드리프트) | 후속 문서 위생에서 docs/AGENTS.md 채널 수 동기화. | open (비차단·사전존재) |
