# Plan — 0077-boot-orchestration

## 메타

| 항목 | 값 |
|---|---|
| slug | `0077-boot-orchestration` |
| 작성자 | Claude Code |
| 일자 | 2026-07-07 |
| 매핑 | PHASES "현재 작업 중" / PR (없음) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "앱 실행과정을 상세화한다. 목적은 plan 문서작성까지." — orca 앱 실행 후 랜딩 진입까지 **반드시 구현해야 하는 단계별 상태 및 동작 체크리스트 확인 등의 기능**을 지원해야 한다. | 라이브 세션 요청 (2026-07-07) |
| 명시 요구 (결정) | `/home` 라우트는 **신설하지 않고** 기존 랜딩(`/`→`/new`/`/chat/:id`)에 매핑한다. | 라이브 세션 AskUserQuestion 답변 "기존 랜딩에 매핑" |
| 명시 요구 (결정) | 체크리스트는 부트 중 **inflight 애니메이션만** UI 로 표시하고, **단계별 진행은 `console.log` 로 출력**한다. | 라이브 세션 답변 "부트단계를 ui 로 표시하되 정 중에 inflight 애니메이션만… 단계별 진행사항은 콘솔로그로 출력" |
| 명시 요구 (결정) | 필수 부트 단계 실패 시 **로그인 페이지로 복귀 + 에러 표시**. | 라이브 세션 답변 "실패시 로그인 페이지로 돌아가고 에러표시" |
| 추론 의도 | (해석) "동작 체크리스트"는 랜딩 전 반드시 준비돼야 하는 부트 단계들의 순서·상태(pending/running/ok/failed)를 추적·게이팅하는 **부트 오케스트레이터**를 뜻한다. 현재 병렬·비차단 provider 부트를 단계화한다. | 요구 문구 해석 (추론) |
| 추론 의도 | (해석) 비필수 단계 실패는 degrade & 계속(랜딩까지 진행). 사용자가 "필수 단계"를 전제로 물었으므로 필수/비필수 구분이 존재한다. | AskUserQuestion 3번 질문 문두 "필수 부트 단계가 실패하면" (추론) |

## Context (왜)

현재 Orca 는 앱 실행부터 랜딩 진입까지 **단계·상태·게이팅 개념이 없다**:

- 렌더러 부트는 각 `*Provider` 가 `useEffect` 에서 `bootstrap*()` 를 **병렬·비차단**으로 발사할 뿐, 순서·완료추적·실패게이팅이 없다 (`app/src/renderer/src/App.tsx`).
- `RootGate` 는 login `bypass|authenticated` 만 게이트하고, 이후 `BootRedirector` 가 `settingsApi.get().lastSessionId` 로 `/new` 또는 `/chat/:id` 로 replace 한다.
- main `Bootstrap.start()` 는 순차 실행되나 config/deploy/skills 단계가 **실패해도 부트를 막지 않게** wrap 돼 있다. 스플래시·부트 상태머신·헬스체크 게이트는 전무.

이 설계는 "앱 실행 → 랜딩" 사이에 **정의된 부트 단계의 순차 실행 + 단계별 상태 추적 + 콘솔 로깅 + 실패 시 로그인 복귀** 를 도입해, 부트 과정을 관측·제어 가능하게 만든다. 산출물은 본 `plan.md` 이며, 앱 코드 구현은 다음 턴(Codex)의 몫이다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| main 부트는 `Bootstrap.start()` 에서 db init→recover→config→deploy→skills→handlers 순차 실행되며, 창 생성 **전에 await** 된다. config/provider/deploy/skill 단계는 실패해도 부트를 막지 않게 개별 wrap. | `app/src/main/app/bootstrap.ts:131-203` (특히 160-176), `app/src/main/index.ts:143-162` |
| 창은 `show:false` 로 만들고 `ready-to-show` 에서만 표시 → 하이드레이트 전 `null` 렌더로 플래시가 없다(현 전략). | `app/src/main/index.ts:66-138`, `app/src/renderer/src/app/RootGate.tsx:18-19` |
| `RootGate`: `!hydrated`→null / `bypass\|authenticated`→`AppLayout` / else `LoginFrame`. 부트 게이트의 유일 지점. | `app/src/renderer/src/app/RootGate.tsx:9-22` |
| provider 합성 순서: `TweakProvider→BrowserRouter→BackendProvider→SessionsProvider→ProjectsProvider→CostProvider→ChatProvider→RootGate`. 각 provider 는 값 없는 bootstrap 호스트. | `app/src/renderer/src/App.tsx` |
| 랜딩 결정은 `BootRedirector` 가 `settingsApi.get()` 으로 `lastSessionId`→`/chat/:id`, 없으면 `/new` 로 `<Navigate replace>`. **`/home` 라우트는 없다.** | `app/src/renderer/src/app/BootRedirector.tsx:12`, `app/src/renderer/src/app/router.tsx` |
| `bootstrap*()` 는 **fire-and-forget 페치 + 구독 설정** 후 **unsubscribe(`()=>void`)를 반환**한다 — 페치 완료 promise 를 반환하지 않는다(완료는 store `loading:false` 로만 관측). ⇒ 오케스트레이터가 `await bootstrapX()` 로 단계 게이팅 불가. | `app/src/renderer/src/features/sessions/store/sessionsStore.ts:39-58`, 동형: `backend/store/backendStore.ts:38`, `projects/store/projectsStore.ts:44`, `cost/store/costStore.ts:14`, `chat/store/chatStore.ts:1071` |
| 상태관리는 Zustand. 앱 레벨 부트 상태의 적소는 셸 레이어 `app/src/renderer/src/app/`(RootGate 와 동거). | `app/src/renderer/src/features/login/store.ts`, `app/AGENTS.md` "모듈 레이아웃" |
| 렌더러 4-layer 경계는 ESLint `boundaries` v6 로 강제(`app/`→pages·features·shared 하향만). 부트 오케스트레이터는 여러 feature store 를 호출하므로 **`app/` 셸 레이어**에 둬야 경계 위반이 없다. | `app/AGENTS.md` "모듈 레이아웃", `docs/arch/frontend/layers.md` |
| login store: `loginActions.hydrateBypass()`(영속 bypass 로드), `runSso()` 는 현재 항상 실패. `authenticated` 는 인메모리. | `app/src/renderer/src/features/login/store.ts:36-59` |
| 시작 시간 SLA 는 **미정 Open Question**(N5 와 연결). 순차 부트의 지연 수치 목표를 단독 결정하면 안 된다. | `docs/PRD.md` §11 OQ6 / N5 |
| 신규 IPC 채널 추가 시 `docs/IPC_CONTRACT.md` §6 절차로 **동시 갱신 필수**. 현재 총 53 채널. | `docs/IPC_CONTRACT.md`, `docs/AGENTS.md` 원칙 5 |

## 인수 기준 (Acceptance Criteria)

1. 로그인 게이트(`bypass\|authenticated`) 통과 후, 랜딩(`AppLayout`) 진입 **전에** `BootScreen`(inflight 애니메이션)이 표시된다.
2. 각 부트 단계가 순서대로 콘솔에 출력된다: `[boot] <id> running` → `[boot] <id> ok (Nms)`(성공) / `console.error|warn`(실패), 소요시간 포함.
3. **필수** 단계 실패 시 `LoginFrame` 으로 복귀하고 실패 에러가 표시되며, 재시도 시 부트가 재실행된다.
4. **비필수** 단계 실패는 `console.warn` 후 degrade 하며 랜딩까지 진행을 막지 않는다.
5. 랜딩은 신규 라우트 없이 기존 `/new` 또는 `/chat/:lastSessionId` 로 도달한다(`/home` 신설 없음).
6. (선택) main 부트 리포트가 `bootApi.getReport()` IPC 로 조회되어 부트 체크리스트/콘솔 로그에 반영된다. IPC 추가 시 `docs/IPC_CONTRACT.md` 가 동시 갱신된다.
7. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`. 레이어 경계(`boundaries`) 위반 0, 신규 런타임 의존성 0.

## 범위 / 비범위

- **범위**: 렌더러 셸 레이어 부트 오케스트레이터(store + steps + BootScreen) 도입, `RootGate`/`LoginFrame` 게이트 로직 확장, provider 의 `bootstrap*()` 호출 이관/단계화, 단계별 콘솔 로깅, 필수 실패→로그인 복귀. (선택) main `BootReport` + 조회 IPC.
- **비범위**: 신규 `/home` 라우트(결정: 미신설). 단계 리스트 UI(결정: inflight 애니메이션만). 시작 시간 SLA 수치 목표(PRD §11 OQ6 — Open Question). 부트 텔레메트리 영속/원격 전송. main 치명 단계(db init) 실패 UX — 이는 창 미생성(렌더러 부재)이라 로그인 복귀 대상이 아니며 별도 소관.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `loginActions.hydrateBypass`, `bootstrapBackend/Sessions/Projects/Cost`(및 그 하부 `sessionApi.list`·`settingsApi.get` 등), `RootGate`/`LoginFrame`/`AppLayout`/`BootRedirector`, `shared/ui` 로딩·스피너 프리미티브(있으면), Zustand.
- 전제: 부트 오케스트레이터는 셸 레이어(`app/src/renderer/src/app/boot/`)에 둔다(경계 준수). 창 숨김→`ready-to-show` 전략은 유지한다.
- **신규 런타임 의존성 없음.** (선택 스코프의) 신규 **IPC 채널 `orca:boot:report`** 는 계약 변경이므로 `docs/IPC_CONTRACT.md` 동시 갱신이 전제.
- **핵심 전제 리스크**: `bootstrap*()` 가 완료 promise 를 반환하지 않음(자료조사 참조) → 단계 게이팅을 위해 각 부트 러너를 **awaitable init + 구독**으로 분리해야 한다(아래 설계 §).

## 설계

**접근**: 셸 레이어에 부트 오케스트레이터를 신설하고, `RootGate` 를 3-단계 게이트(하이드레이트 → 로그인 → 부트)로 확장한다.

- `app/src/renderer/src/app/boot/bootStore.ts` — Zustand: `phase: 'idle'|'running'|'ready'|'failed'`, `steps: BootStepState[]`, `error?`, 액션 `runBoot()`(idle 가드로 중복 방지)·`reset()`.
- `app/src/renderer/src/app/boot/steps.ts` — 순서화된 단계 정의 `{ id, label, mandatory, run(): Promise<void> }`. 각 `run` 은 재사용 러너를 호출하고 결과를 `console.log('[boot] …')` 로 남긴다. 필수 단계 실패는 throw(→ `phase='failed'`), 비필수 실패는 catch+`console.warn` 후 계속.
- `app/src/renderer/src/app/boot/BootScreen.tsx` — inflight 애니메이션만(단계 텍스트 노출 없음). `role="status"`·`aria-busy`·`prefers-reduced-motion` 대응. `shared/ui` 기존 스피너 재사용.
- `RootGate.tsx`(수정) — `!hydrated`→null / 미인증→`LoginFrame` / `phase∈{idle,running}`→`BootScreen`(mount 시 `runBoot()` 킥) / `failed`→`LoginFrame error` / `ready`→`AppLayout`.
- `LoginFrame.tsx`(수정) — optional `error` prop 로 실패 배너 표시. 재로그인/재시도 시 `bootStore.reset()` 호출로 부트 재진입.
- `App.tsx` + `features/{backend,sessions,projects,cost}/providers/*Provider.tsx`(수정) — 이중 fetch 회피: bootstrap 호출을 provider `useEffect` 에서 오케스트레이터로 이관.

**`bootstrap*()` awaitable 분리 (핵심)**: 현재 `bootstrap*()` 는 fire-and-forget + unsubscribe 반환이라 단계 게이팅 불가. 각 store 에서 **awaitable init(페치+setState, `Promise<void>`)** 과 **subscribe(구독 attach, `()=>void`)** 를 분리한다. 오케스트레이터는 init 를 `await` 해 단계 완료를 게이팅하고, 구독은 provider(또는 오케스트레이터)가 attach/teardown 한다. `bootstrap*()` 시그니처는 배럴로 하위호환 유지 검토.

**단계 순서·병렬**: 필수 단계(settings 하이드레이트 → 세션 목록 → 랜딩 타겟)는 순차. 독립 비필수(백엔드 감지·프로젝트·비용)는 한 스테이지 내 `Promise.allSettled` 병렬 허용. 랜딩 타겟은 `BootRedirector` 가 그대로 네비게이션하되, 부트가 캐시한 `lastSessionId` 를 재사용해 중복 IPC 를 줄인다.

**(선택) main 부트 리포트**: `Bootstrap.start()` 의 wrap 된 config/deploy/skills 단계 결과를 `BootReport{step, ok, error?}[]` 로 누적하고, 신규 IPC `orca:boot:report`(`app/src/shared/ipc.ts` `CHANNELS` + preload `bootApi.getReport()` + `registerMiscHandlers`/신규 핸들러)로 노출. 렌더러 단계 3 이 조회·로깅. 스코프 조이면 후속 핸드오프로 분리 가능(렌더러 오케스트레이터가 1차 산출).

**부트 단계 카탈로그**

| # | 단계 | 재사용 러너 | 필수 | 실패 시 |
|---|---|---|---|---|
| 1 | settings 하이드레이션(bypass·lastSessionId) | `loginActions.hydrateBypass()` + `settingsApi.get()` | ✅ | LoginFrame + 에러 |
| 2 | 로그인/인증 게이트 | login store (`bypass\|authenticated`) | ✅ | LoginFrame (기존) |
| 3 | main 부트 리포트 조회 (선택) | 신규 `bootApi.getReport()` | △ | LoginFrame + 에러 |
| 4 | 백엔드 설치 감지 | backend init(분리) | ❌ | warn + 계속 |
| 5 | 세션 목록 로드 | sessions init(분리) | ✅ | LoginFrame + 에러 |
| 6 | 프로젝트·비용 로드 | projects/cost init(분리) | ❌ | warn + 계속 |
| 7 | 랜딩 타겟 결정 | lastSessionId → `/chat/:id`\|`/new` | ✅ | `/new` 폴백 |

**레이어 경계**: 오케스트레이터는 `app/` 셸에서 feature store 를 하향 호출 → `boundaries` 준수. cross-feature 조합은 셸에서만.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: BootScreen inflight. 창은 `ready-to-show` 까지 숨김 → 플래시 없음(기존 유지).
- **에러**: 필수 실패 → LoginFrame 에러 배너 + 재시도 → `reset()` → 재-runBoot.
- **빈 상태**: `lastSessionId` 없음 → `/new`(정상 경로, 실패 아님).
- **동시성**: `runBoot` 는 `phase` 가드로 중복 실행 방지. StrictMode 이중 마운트(dev)에서 이중 킥 방지 포함.
- **접근성**: BootScreen `role="status"`/`aria-busy`, reduced-motion 대응.
- **테마**: BootScreen 은 시맨틱 토큰(`bg-bg`/`text-ink`)만 사용, 3-테마 대응.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 순차 부트 → 부트 지연 증가 vs 시작 SLA | 필수만 순차, 비필수 병렬. **SLA 수치는 PRD §11 OQ6 — 단독 결정 금지(사용자)**. |
| `bootstrap*()` awaitable 분리 리팩토링 → 구독 타이밍/이중 fetch 회귀 | init/subscribe 분리 + provider 호출 이관을 한 번에. Codex 구현 시 GUI 회귀(채팅·세션·비용) 확인 항목. |
| 신규 IPC `orca:boot:report` → 계약·배선 비용 | IPC_CONTRACT 동시 갱신. **선택 스코프** — 조이면 후속 핸드오프로 분리. |
| BootScreen 이 무한 표시(부트 hang) | 각 단계 타임아웃 가드 검토(구현 세부, 필수 단계 초과 시 failed 처리). |

- 되돌리기 어려운 결정: provider 의 bootstrap 호출 위치 이관(셸 오케스트레이터로). → 배럴 하위호환으로 완충.
- **단독 결정 금지(Open Question)** → 사용자에게: 시작 시간 SLA 수치(PRD §11 OQ6), main 부트 리포트(선택 스코프)를 본 핸드오프에 포함할지 후속으로 분리할지.

## 영향 받는 파일

- `app/src/renderer/src/app/boot/bootStore.ts` (신규)
- `app/src/renderer/src/app/boot/steps.ts` (신규)
- `app/src/renderer/src/app/boot/BootScreen.tsx` (신규)
- `app/src/renderer/src/app/RootGate.tsx` (수정)
- `app/src/renderer/src/app/LoginFrame.tsx` (수정)
- `app/src/renderer/src/App.tsx` + `features/{backend,sessions,projects,cost}/providers/*Provider.tsx` (수정 — bootstrap 호출 이관)
- `features/{backend,sessions,projects,cost}/store/*Store.ts` (수정 — init/subscribe 분리)
- (선택) `app/src/main/app/bootstrap.ts`, `app/src/shared/ipc.ts`, preload, main handlers, `docs/IPC_CONTRACT.md`

## 참고 문서

- `docs/PRD.md` §6.1(F5/F6), §11 OQ6 / N5 (시작 SLA)
- `docs/TRD.md` §7.3 (부트 시 백엔드 선택)
- `docs/arch/frontend/layers.md` (4-layer 경계)
- `app/AGENTS.md` (모듈 레이아웃·경계·스타일)
- IPC 변경 시: `docs/IPC_CONTRACT.md` (§6 변경 절차 — 반드시 동시 갱신)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: `bootStore` phase 전이(순수 reducer/액션), `steps` 실패 분기(필수→failed / 비필수→계속) 단위 테스트. (선택) `boot:report` IPC 스키마.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청/AskUserQuestion 답변으로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 IPC(계약 변경)·SLA 를 사용자 결정 항목으로 표기했다.
- [x] 파생 UX — 로딩/에러/빈상태/동시성/테마/접근성 엣지케이스를 펼쳤다.
- [x] 리스크 — 트레이드오프·되돌리기 어려운 결정을 적고, Open Question(SLA·선택 스코프)을 사용자로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (Codex=기능 / Claude=비기능). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

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
