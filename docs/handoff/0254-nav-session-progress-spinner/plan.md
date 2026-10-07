# Plan — 0254-nav-session-progress-spinner

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0254-nav-session-progress-spinner` |
| 작성자 | Claude Code 초안 · Codex 복원/설계 검토 |
| 일자 | 2026-10-07 |
| 매핑 | 기준 커밋 `origin/main@5e1e9209` · 브랜치 `claude/0254-0255-nav-progress-daily-login` |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none`. 0249 의 nav 주의 표시는 `INHERITED` 회귀 노드로만 참조한다 — 출처 `0249:plan@03bfcaed`(`git cat-file -t` = commit, `origin/main` 조상 확인) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Codex (기능 구현) |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: nav 세션 행은 답변이 끝났는지(파랑)·응답을 기다리는지(파랑)만 알리고, **지금 답변을 만들고 있는지**는 보이지 않는다.
- 완료 후 달라지는 것: 어시스턴트가 답변을 생성하는 동안 그 세션 행의 work/code 아이콘 자리에 노란(warning) three-dot 스피너가 돈다. 응답 대기 요청이 오면 기존 표시로 돌아간다.
- 성공을 한 문장으로: **nav 만 보고도 어느 대화가 지금 답변을 쓰는 중인지 안다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "모든 대화세션은 nav의 항목으로 구성되어 있음. 그리고 각 항목의 좌측에는 work, code 아이콘이 정렬돼있음. 어시스턴트 턴에서 답변을 생성중일때는(delta) in-progress 아이콘으로 표시하도록 하라. Three-dot spinner 로. 폰트는 노란색 계열(warning 컬러). 사용자 답변울 기다리는 케이스는 기존 정책 유지." | 라이브 세션 2026-10-07 |
| 명시 결정 ① | 노란색 적용 범위 = "스피너만 노란색" — 제목 글자색은 기존 그대로 | AskUserQuestion |
| 명시 결정 ② | 표시 범위 = "모든 세션" — 열람 중 세션 포함 | AskUserQuestion |
| 추론 의도 | "(delta)" = 메인 어시스턴트 턴의 응답 생성 구간. 턴이 끝난 뒤 백그라운드 작업을 기다리는 listen 구간은 생성 중이 아니다(D-002) | 기존 정책: 그 구간은 `turn.ended` 로 이미 완료 표시 대상(`chatStore.ts:789-795`) |
| 추론 의도 | "기존 정책 유지" = 0249 D-002~D-004 의 응답 대기 표시(비열람=파랑·열람=기본·열면 해제)를 그대로 둔다 | 0249 plan §3 |

원본 세션: `7e2f51f3-a3e3-5ebd-aa3a-1c5624bc3827` (`2026-10-07T05:06:27.751Z` 요청). `AskUserQuestion` 응답 `toolu_01DLhhmpSR5H6rFh58DWQr62`에서 결정 ①~④를 확인했다. 두 plan 작성 후 `2026-10-07T05:42:04.287Z` 사용 한도로 중단되어, 이번 턴에 코드 대조·추적표 정정·보드 등록을 마무리한다.

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | **생성 중** = 그 세션 chat 엔트리의 `inflight` 가 참이고 사용자 응답 요청(`pendingAsks`·`pendingPlanReview`·`pendingToolApprovals`, main·child 무관)이 0건 | "답변을 생성중일때는" + "사용자 답변을 기다리는 케이스는 기존 정책 유지". `inflight` 는 transcript 진행 표시의 정본이다(`chatReducer.ts:1181-1184`) | 요구 | ACTIVE | — |
| D-002 | listen 대기(`inflight=false` 이고 `activityTransport` 가 `listening`/`ready`)는 생성 중이 아니다 | "(delta)" — listen 구간의 child 스트림은 메인 턴을 열지 않는다(`chatStore.ts:392-405`). 그 구간은 기존 완료 표시가 담당한다 | 추론 | ACTIVE | — |
| D-003 | 표시 = work/code 아이콘 **자리에** three-dot 스피너. 색 = 시맨틱 `warn` 토큰(`text-warn`). 행 제목 글자색은 바꾸지 않는다 | 요구 + 결정① | 요구·결정① | ACTIVE | — |
| D-004 | 열람 중 세션을 포함한 모든 행에 표시한다 | 결정② | 결정② | ACTIVE | — |
| D-005 | 아이콘 상태 우선순위 = 생성 중 > 기존 비열람 표시(완료·응답대기) > 기본. 응답 요청이 있으면 D-001 로 생성 중이 아니므로 0249 정책이 그대로 정한다. 턴이 끝나면 기존 표시 규칙으로 돌아가며 표시를 지우지 않는다 | "기존 정책 유지". 이미 해소된 요청의 파랑이 남은 채 답변이 계속되면 현재 활동을 보여야 한다(추론) | 요구·추론 | ACTIVE | — |
| D-006 | 적용 범위 = 세션 행 아이콘을 쓰는 모든 목록 — nav 최근·고정·고정 프로젝트 하위·draft 행 + 프로젝트 패널(catalog, 20px) | 기존 완료·응답대기 표시와 같은 범위다(`navSections.render.test.ts:257-301` 5 렌더러) | 추론 | ACTIVE | — |
| D-007 | chat → sessions 연결은 app 계층(`subscribeSessionAttention`)에서만 한다. sessionsStore 는 chat 파생 집합을 보관만 하고 정본은 chat 엔트리다 | feature 교차 import 금지(`app/src/renderer/AGENTS.md` 4-layer). 0249 D-006 승계 | 저장소 규칙 | ACTIVE | — |
| D-008 | 생성 중 집합은 **구성원이 바뀔 때만** store 에 쓴다. 델타 프레임은 nav 를 다시 그리지 않는다 | `SessionRow` memo 계약(`SessionRow.tsx:40-42`) — 델타는 rAF 마다 chat store 를 갱신한다(`chatStore.ts:851-859`) | 설계 | ACTIVE | — |
| D-009 | 감속 모션이면 점 애니메이션만 멈추고 점 3개는 정지 상태로 남는다 | 저장소 관례 `motion-reduce:animate-none`(`ErrorToastHost.tsx:21` · `BootScreen.tsx:53`) | 설계 | ACTIVE | — |
| D-010 | 생성 중 아이콘의 `aria-label` = `{{agent}} · 답변 생성 중`. 다른 상태의 label 은 그대로다 | 아이콘이 종류를 더 이상 그리지 않으므로 label 이 종류와 상태를 함께 말한다 | 추론 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-010 (신규 handoff).
- 변경된 결정: 없음. 0249 D-002~D-006 은 ACTIVE 로 승계하며 이 plan 이 바꾸지 않는다(§16).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0249 D-004(열면 해제·삭제 정리·재시작 미복원) · 0249 D-005(한 Map·마지막 사유).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001 ↔ AC1(턴 시작 → 스피너)·AC4(요청 3종 → 스피너 없음) → 일치. D-002 ↔ AC5(listen·ready 스피너 없음) → 일치.
  - D-003 ↔ AC1(`text-warn` 은 아이콘 span 에만, 행·제목에는 없음) → 일치. D-004 ↔ AC2(열람 행) → 일치. D-005 ↔ AC4·AC6 → 일치.
  - D-006 ↔ AC3(5 렌더 사이트) → 일치. D-007 ↔ AC1 경로(app 구독 함수 경유)·VP-06 → 일치. D-008 ↔ AC8 → 일치. D-009 ↔ AC9 → 일치. D-010 ↔ AC10 → 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이미 기존 코드가 충족하는가 | **아니다** — 행 아이콘 상태는 `unseen-complete`·`awaiting-response`·`default` 셋뿐이다 | `SessionRow.tsx:66-68` |
| "생성 중" 을 무엇으로 아는가 | 세션별 chat 엔트리의 `inflight` 가 정본이다. main `activityForeground` 는 listen 구간도 `streaming` 이라 D-002 와 맞지 않는다 | `chatReducer.ts:339` · `session-activity-projector.ts:10-19` |
| 델타 이벤트를 직접 세면 되는가 | **아니다** — 도구 실행 중에는 델타가 없어 스피너가 깜빡인다. 턴 수명(`BEGIN_TURN`~`TURN_END_RESET`)이 맞는 단위다 | `chatStore.ts:384-405` · `chatReducer.ts:561-574` |
| sessions feature 가 chat 을 읽을 수 있는가 | **아니다** — boundaries 위반. 선례대로 app 계층이 잇는다 | `useSessionCompletion.ts:5-13` |
| 커버리지 한계 | chat 엔트리가 없는 세션은 표시할 근거가 없다. 기존 완료·응답대기 표시와 같은 범위다 | `chatStore.ts:618`(`if (!key) return`) · `chatStore.ts:789-795` |
| 더 작은 해법 | `SessionRow` 에 props 로 집합을 내리면 5 렌더 사이트와 3 어댑터를 모두 고쳐야 한다. store 필드 1개 + app 구독 1줄이 더 작다 | `rg "<SessionRow"` 5건 · `unseenAttention` 선례 |

- 사용자에게 올릴 결정: **없음**(결정①② 로 닫힘).
- 코드 조사로 닫은 사실: §8 F-01~F-16.

## 5. 동작 / 사용자 흐름

```text
[세션 S 에서 메시지 전송 또는 자동 연속 턴 시작]
  → S 행 아이콘 자리에 노란 점 3개 스피너 (S 를 보고 있어도)
  → 승인·질문·계획 승인 요청이 오면 스피너를 내리고 기존 표시 (비열람: 파랑 / 열람: 기본)
  → 요청이 해소되고 답변이 이어지면 다시 스피너
  → 답변 종료: 비열람이면 파랑(완료), 열람이면 원래 아이콘
  ↘ 중단·오류: 스피너만 내린다 (완료 표시 없음 — 기존 규칙)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| send(낙관 `BEGIN_TURN`) 또는 턴 활동 이벤트 | `inflight=true`, 요청 0 → 생성 중 집합에 S | S 아이콘 = 노란 스피너 |
| 생성 중 S 에 `permission.requested`(3종·child 포함) | 요청 1+ → 집합에서 S 제외 | 비열람: 파랑 굵게 / 열람: 기본 아이콘 |
| `permission.resolved` 로 요청 0, `inflight` 유지 | 집합에 S 재진입 | 스피너 |
| `telemetry`·`turn.aborted`·`error`·`CANCEL_CHAT` | `TURN_END_RESET` → `inflight=false` | 스피너 제거 |
| `turn.ended`(비열람) | 0249 `markCompleted`; `inflight`는 불변 | 생성 중이면 스피너 유지, 종료 리셋 뒤 파랑(완료) |
| listen 대기·ready | `inflight=false` | 스피너 없음 |
| 비열람 표시가 남은 S 가 다시 생성 중 | 우선순위 D-005 | 스피너 → 끝나면 파랑 |
| S 삭제 | chat 엔트리 제거 → 집합에서 제외 | 행 없음 |
| draft(승격 전) 첫 턴 진행 | draft 키가 집합에 | draft 행 스피너 → 승격 뒤 실제 행 스피너 |

### 파생 UX / 엣지케이스

- loading / empty / error: 오류 종료는 스피너만 내린다. 새 문구는 a11y label 1개.
- cancel / retry: 중단 버튼은 낙관적으로 `CANCEL_CHAT` → 즉시 스피너 제거. `turn.retrying` 동안은 턴이 열려 있어 스피너 유지.
- concurrency / multi-session: 여러 세션이 동시에 생성 중이면 각 행에 스피너. 집합은 세션 수와 무관하게 구성원 변화 때만 쓴다(D-008).
- keyboard / a11y / theme: `warn` 은 루트 스코프 단일 정의다(`tokens.css:88`) — dark 재정의 없음. light 사이드바 대비는 §17 리스크.
- 재시작: 스피너는 휘발 상태다. 앱 재시작 후 진행 중 턴은 없다.

## 6. 범위 / 비범위

- **범위**: 생성 중 판정(chat lib) · chat→sessions 투영(app) · sessions store 필드 · 행 아이콘 상태 우선순위 · three-dot 스피너 atom · 애니메이션 토큰 · i18n label 1키 · `docs/arch/frontend/state.md` 1문단.
- **비범위**: 행 제목 색 변경(결정①) · main `chat.activity` 스냅샷 계약 · listen 구간 표시(D-002) · chat 엔트리가 없는 세션 표시(§4 커버리지) · LOAD_SESSION hydrate 의 `inflight` 규칙(`chatReducer.ts:1439-1441`, §17) · 0249 응답대기·완료 표시 규칙.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `data-state="in-progress"` 값 이름 | 아니오 — renderer DOM 마커, 영속·IPC 없음 | 지금 확정 |
| `sessionsStore.generatingSessionIds` 형상 | 아니오 — 휘발 renderer 상태 | 지금 확정 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 비열람 S 의 턴이 시작되면 S 아이콘이 `data-state="in-progress"` 이고 `[data-spinner="dots"]` 1개(자식 점 3개)를 그리며 agent SVG 는 0개다. `text-warn` 은 아이콘 span 에만 있고 행 루트·제목 span 에는 없다 | IT: 실제 `subscribeSessionAttention()` + `ingestChatEvent`(`message.delta` 등 턴 활동 이벤트, 별도 케이스로 `chatActions.send` 낙관 경로) → `SessionRow` SSR | 이벤트 → `receive`/`receiveDeltaBatch` → `BEGIN_TURN` → `subscribeGeneratingSessions` → `setGeneratingSessions` → `SessionRow` |
| R-01 | AT-02 / AC2 | 열람 중(`isActive`·`viewedSessionId=S`) 행도 같은 스피너다 | IT: AC1 과 같은 state 에서 `isActive:true` 렌더 | 동일 |
| R-01 | AT-03 / AC3 | 5 렌더 사이트(최근·고정·고정 프로젝트 하위·프로젝트 패널·draft)에서 같은 스피너다. nav 는 14px 박스, 프로젝트 패널(catalog)은 20px 박스다 | SSR `it.each(renderers)` — 생성 중 집합 시드 후 각 사이트의 data-state·spinner·박스 class | `SessionListView`·`PinnedSectionView`·`PinnedProjectsSection`·`ProjectSessionsPanel` → `SessionRow` |
| R-02 | AT-04 / AC4 | 생성 중 S 에 `permission.requested` 가 오면(tool_approval·ask_question·plan_review **각각**, child 요청 포함) 스피너가 사라지고 비열람은 `awaiting-response`(기존 class 동일), 열람은 `default` 다. `permission.resolved` 로 요청 0 이 되고 턴이 열려 있으면 다시 `in-progress` 다 | IT `it.each` 3종 × {비열람, 열람} + child(`providerRequest.agentId`) 1건 + resolve 후 재진입 | `permission.requested` → reducer pending → 생성 중 판정 → store → 행 |
| R-03 | AT-05 / AC5 | `telemetry`·`turn.aborted`·`error`·`CANCEL_CHAT` 뒤 스피너가 없다. 종료 리셋 뒤 비열람 + `turn.ended` 는 `unseen-complete`, 열람은 `default` 다. `turn.ended` 단독은 `inflight`를 내리지 않으므로 생성 중이면 스피너를 유지한다. `inflight=false` 이고 `activityTransport` 가 `listening`/`ready` 인 세션에는 스피너가 없다 | IT 종료 경로 4종 it.each + listen 시드 케이스(`chat.activity` transport listening) | 종료 이벤트 → `TURN_END_RESET` → 집합 제외 |
| R-03 | AT-06 / AC6 | 비열람 표시(`completed` 또는 해소된 `awaiting-response`)가 남은 S 가 생성 중이면 `in-progress` 이고, 턴이 끝나면 기존 규칙 결과(`unseen-complete`)가 보인다 — 표시가 사라지지 않는다 | IT 시퀀스: `turn.ended`(비열람) → 새 턴 활동 → `telemetry` → `turn.ended` → data-state 열 | 동일 + `markCompleted` |
| R-03 | AT-07 / AC7 | 생성 중이 아닌 세션의 기존 결과는 그대로다 | 기존 케이스 green: `useSessionCompletion.test.ts` 'r5 normal completion' 5건 · '0249 response attention' 4건 · 'ΔV3.1' · `navSections.render.test.ts` 'r5 모든 채팅 구획' 3건 · `sessionsStore.completion.test.ts` | 기존 경로 |
| R-03 | AT-08 / AC8 | 델타 배치·같은 상태 반복은 `generatingSessionIds` 참조를 바꾸지 않는다 — 구성원 변화 때만 store 를 쓴다 | UT: 구독 직후 1회 emit, `message.delta` 10회 + `flushRaf` → 추가 emit 0 · store 참조 동일, 두 번째 세션 시작 → emit 1 | `useChatStore.subscribe` → 비교 → listener |
| R-01 | AT-09 / AC9 | 점 3개 모두 `animate-dot-wave` 와 `motion-reduce:animate-none` 을 갖고 지연이 서로 다르다. `tokens.css` 의 `@theme` 에 `--animate-dot-wave` 와 `@keyframes dot-wave` 가 각 1개다 | SSR class 단언 + CSS 원문 단언(`depthCss.test.ts` 방식) | `DotsSpinner` → Tailwind `@theme` |
| R-01 | AT-10 / AC10 | 생성 중 아이콘은 `role="img"` 이고 `aria-label` = `tr('sessions.generating', { agent: tr(<종류 label>) })` 다. ko·en 키 파리티와 placeholder 일치 | SSR label 단언(ko 값) + `resources.test.ts` | `SessionRow` → i18n |
| R-03 | AT-11 / AC11 | chat 엔트리 삭제(`handleSessionDeleted`) 뒤 S 가 집합에서 빠진다. 미지·`sessionId` 없는 이벤트는 집합을 바꾸지 않는다 | IT | `dropSession` → 구독 |
| R-01 | AT-12 / AC12 | 승격 전 continuity draft 키로 첫 턴이 진행 중이면 그 draft 행이 스피너이고, `session.updated` 승격 뒤에는 실제 세션 ID 행이 스피너다 | IT: draft 키 엔트리 + `pendingNewChatKey` 시드 → `session.updated` → 집합 키 변화 + draft 렌더러 | `promotePendingNewChat` → 구독 |
| 전체 | AT-13 / AC13 | 게이트: lint 0 error · typecheck 3종 0 · 관련 vitest green · doc inventory `--check` · trailer 파싱 | 명령 산출(파일/케이스 수) | §7-A 운영 gate |
| R-04 | AT-14 / AC14 | 실기: light·dark 에서 노란 점 3개 파도 · 생성 중 → 승인 요청(파랑) → 승인 → 스피너 → 완료(파랑/기본) 전이 · Windows 동작 줄이기 설정에서 정지 | 사람 실기 (§19) | Electron 실행 |

### AC 검증 주의사항

- 기존 테스트 재사용(실재 확인): `useSessionCompletion.test.ts` 의 `icon()` 헬퍼(SSR + `getInitialState` 시드, 101-118행)는 `isActive:false` 고정이다 — 인자를 늘려 재사용한다. `navSections.render.test.ts:257-301` 의 `renderers` 5개를 AC3 에 그대로 쓴다.
- 생성 중 집합의 SSR 시드: `SessionRow` 는 `useSessionsState` 로 읽으므로 기존 방식대로 `useSessionsStore.getInitialState()` 객체에 `generatingSessionIds` 를 넣는다.
- 순서 기준 없음. N회 기준 = AC8 의 listener 호출 수 — sink(`setGeneratingSessions`)의 production 호출부는 app 구독 1곳(§10 EP-02 자리 b)뿐이며 테스트는 그 함수 자체를 관측한다.
- 사람 실기 항목: 애니메이션 시각과 Windows 감속 모션 설정뿐이다. 판정·우선순위·배선은 전부 테스트로 내렸다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 가 없다(신규 동작). 0249 의 주의 표시는 바뀌지 않으므로 `INHERITED` 회귀 노드로만 둔다.
- 기준 V 상속 근거: 없음. INHERITED 출처 = `0249:plan@03bfcaed`.
- `SUPERSEDED` 로 분해한 pair 의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 생성 중 스피너(AC1·AC2·AC3·AC9·AC10·AC12) | NEW | — |
| R-02 | R | §7 응답 대기는 기존 정책(AC4) | NEW | — |
| R-03 | R | §7 비생성 상태·우선순위·불변(AC5·AC6·AC7·AC8·AC11) | NEW | — |
| R-04 | R | §7 실기(AC14) | NEW | — |
| R-0249 | R | 0249 R-02 응답대기·완료 표시 | INHERITED | `0249:plan@03bfcaed` §7 AT-02~AT-05 |
| AT-01~AT-14 | AT | §7 검증 수단 칸 | NEW | — |
| AT-0249 | AT | 0249 AT-02~AT-05 기존 케이스 | INHERITED | `useSessionCompletion.test.ts` '0249 response attention' |
| SD-01 | SD | §5 상태와 전이 — 턴 시작 → 요청 → 해소 → 종료 · 삭제 · draft 승격 | NEW | — |
| ST-01 | ST | §11 IT 시퀀스 | NEW | — |
| AR-01 | AR | §9·§10 투영 배선 chat → app → sessions → 행 | NEW | — |
| AR-02 | AR | §10 시각 atom·토큰·i18n | NEW | — |
| IT-01·IT-02 | IT | §11 | NEW | — |
| MD-01 | MD | §10 `isGeneratingResponse`·`generatingSessionKeys` | NEW | — |
| MD-02 | MD | §10 `navIconState` 우선순위 | NEW | — |
| MD-03 | MD | §10 구성원 변화 때만 emit·write | NEW | — |
| UT-01~UT-03 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·03·09·10·12 | REQUIRED | `ingestChatEvent`/`send` → `BEGIN_TURN` → `subscribeGeneratingSessions` → `subscribeSessionAttention` → `setGeneratingSessions` → `SessionRow` selector → `navIconState` → `DotsSpinner` | AC1·AC2·AC3·AC9·AC10·AC12 data-state·spinner·class·label | required — 배선·자리 불변식. M1: app 구독에서 투영 줄 제거 · M2: 스피너를 `!isActive` 일 때만 · M3: `text-warn` 을 행 루트로 이동 · M10: catalog/nav 박스 크기 맞바꿈 | EP-01 (1) · EP-02 (4) · EP-03 (3) · EP-04 (2) · EP-05 (2) · EP-06 (1) |
| VP-02 | R-02 ↔ AT-04 | REQUIRED | `permission.requested` → reducer pending → `isGeneratingResponse` → 집합 제외 → `navIconState` → 0249 표시 | AC4 3종 × 2 + child + 재진입 | required — M4a/b/c: pending 검사 3개를 하나씩 제거(자리마다) | EP-01 (1, 조건 4) · EP-02 (4) · EP-03 (3) |
| VP-03 | R-03 ↔ AT-05·06·07·08·11 | REQUIRED | 종료 이벤트 → `TURN_END_RESET` → 집합 제외 / listen 시드 / 우선순위 / 삭제 / 같은 구성원 반복 | AC5·AC6·AC7·AC8·AC11 | required — M5: `navIconState` 에서 주의 표시를 생성 중보다 먼저 판정 · M6: 판정을 `sessionResponding`(inflight ∨ listening)으로 교체 | EP-01 (1) · EP-02 (4) · EP-03 (3) |
| VP-04 | R-04 ↔ AT-14 | REQUIRED | Electron 실행 | §19 실기 결과 | not selected — 사람 실기 | 0 + 이유: 시각 |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | VP-01·VP-02·VP-03 경로를 한 시퀀스로: send → delta → requested → resolved → telemetry → turn.ended · 삭제 · draft 승격 | data-state 열 `[in-progress, awaiting-response, in-progress, awaiting-response, unseen-complete]`(비열람) · 열람 열 | VP-02·VP-03 변이 공유 | EP-01 · EP-02 · EP-03 |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | 실제 `subscribeSessionAttention()` 설치/해제/재설치 | 해제 뒤 턴 시작이 store 를 바꾸지 않음 · 재설치 즉시 현재 집합 동기화 | required — M1 공유 · M7: 구독 시 초기 emit 제거 → 재설치 케이스 red | EP-02 (4) · EP-07 (1) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | `DotsSpinner` → `@theme` 토큰 · i18n 리소스 | AC9 class·CSS 원문 · AC10 파리티 | required — CSS 배선 민감도 M11: `--animate-dot-wave` 제거, M12: `@keyframes dot-wave` 제거(각각 잔여 참조와 분리해 CSS oracle red 확인) | EP-04 (2) · EP-05 (2) · EP-06 (1) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | 순수 | 판정 표(inflight × 요청 3종 × child) · 키 정렬 | VP-02 M4 공유 | EP-01 |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | 순수 | 2 × 3 × 2 = 12 조합 표 | VP-03 M5 공유 | EP-03 |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | `useChatStore.subscribe` → 키 비교 → listener · `setGeneratingSessions` 동일 구성원 bail-out | AC8 호출 수·참조 동일 | required — 0건 성질(“다시 그리지 않는다”). M8: 키 비교 제거 · M9: store bail-out 제거 | EP-02 (자리 a·c) |
| VP-11 | R-0249 ↔ AT-0249 | REGRESSION | 0249 `permission.requested`/`turn.ended` → 리스너 → `markAttention` → 행 | 기존 케이스 green(AC7) | not selected — 기존 행동 테스트 | 0 + 이유: 0249 경로 무변경, 상태 계산만 우선순위 함수로 이동(EP-03) |

`§10 강제 지점 전수`의 N 은 자리 수다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/**` 수정(boundaries 포함) | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| 관련 vitest(비-DB) | 수정 모듈 | §19 목록, `./node_modules/.bin/vitest run <files>` | 같음 |
| doc inventory | `docs/arch/frontend/state.md` 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus | 설계·구현·검증 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| F-01 | 행 아이콘은 `modeIcon` 한 곳에서 만들고 3 분기(이름 변경·catalog·nav)가 재사용한다. 상태는 `unseenAttention`·`isActive` 로만 정한다 | `SessionRow.tsx:59-73` · 사용 `:112`·`:200`·`:224` |
| F-02 | 주의 표시는 `sessionsStore.unseenAttention`(세션→사유)이고 열람 세션에는 만들지 않는다 | `sessionsStore.ts:11-18` · `:242-256` |
| F-03 | chat→sessions 연결은 app 의 `subscribeSessionAttention` 하나이며 `AppLayout` 이 `useSessionCompletion` 으로 설치한다 | `useSessionCompletion.ts:6-21` · `AppLayout.tsx:32` |
| F-04 | 턴은 낙관 send(`BEGIN_TURN`)나 메인 턴 활동 이벤트로 열린다. child(`parentToolRunId`) 이벤트는 열지 않는다 | `chatStore.ts:384-405` · send 낙관 `BEGIN_TURN` `:934` |
| F-05 | 턴 종료 공통 리셋이 `inflight=false` 를 telemetry·turn.aborted·error·CANCEL_CHAT 에서 내린다 | `chatReducer.ts:561-574` · `CANCEL_CHAT` `:1333` |
| F-06 | 응답 요청은 배열 둘과 nullable 계획 승인 슬롯에 산다. child 요청도 같은 배열이며 `providerRequest.agentId` 로만 구별된다 | `chatReducer.ts:370`·`:378`·`:452` · `isChildApproval` `:576-578` |
| F-07 | transcript 표면은 `sessionResponding = inflight ∨ transport listening` 을 쓴다 — listen 포함이라 D-002 와 다르다 | `chatStore.ts:1947-1949` |
| F-08 | `inflight` 는 라이브 경로에서 renderer 소유다. LOAD_SESSION hydrate 만 `foreground !== 'idle'` 로 세운다 | `chatReducer.ts:1181-1184` · `:1439-1441` |
| F-09 | main foreground 는 listen(`transport='listening'`)에서도 `streaming` 이다 | `session-activity-projector.ts:10-19` |
| F-10 | draft 행은 chat store 키(`draft:<uuid>`·`__new__`)를 `session.id` 로 쓴다 | `chatStore.ts:2054-2091` · `SessionList.tsx:63-72`·`:106-118` |
| F-11 | 승격은 draft 엔트리를 실제 sessionId 키로 옮긴다 | `chatStore.ts:497-519` |
| F-12 | 삭제는 chat 엔트리를 제거한다 | `useSessionHandlers.ts:112` → `chatStore.ts:1536-1538` |
| F-13 | `warn` 토큰은 루트 `@theme` 단일 정의이고 dark 재정의가 없다 | `tokens.css:88` · dark 스코프 `:215-` |
| F-14 | 애니메이션 토큰 선례: `@theme` 안 `--animate-error-toast` + `@keyframes` → `animate-error-toast motion-reduce:animate-none` | `tokens.css:14-31` · `ErrorToastHost.tsx:21` |
| F-15 | 새 CSS 파일·규칙 금지, 시맨틱 토큰 우선, 그룹 스코프 격리 | `app/src/renderer/AGENTS.md §스타일` |
| F-16 | 델타는 rAF 코얼레서로 배치되어 chat store 를 프레임마다 갱신한다 | `chatStore.ts:851-859` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `SessionRow` 렌더 사이트 | `rg "<SessionRow" app/src/renderer/src --glob '!*.test.*'` | 5 | PinnedProjectsSection·PinnedSection·ProjectSessionsPanel(catalog)·SessionList 2(draft·recent) — AC3 분모 |
| `modeIcon` 사용 분기 | `SessionRow.tsx` 내 `{modeIcon}`·`icon={modeIcon}` | 3 | §10 EP-03 자리 |
| `inflight=false` 전이 지점 | `TURN_END_RESET` 사용처 `rg "TURN_END_RESET" chatReducer.ts` | 정의 1 + 종료 경로 | 종료 판정은 한 리셋을 따른다 — AC5 4종 |
| 응답 요청 슬롯 | `ChatState` 필드(배열 2 + nullable 객체 1) | 3 | EP-01 조건 |
| chat→sessions app 배선 | `rg "sessionsActions\." app/src/renderer/src/app --glob '!*.test.*'` | `useSessionCompletion.ts` 3 + 기타 | 이번 투영은 같은 함수에 1줄 |
| `--color-warn` 정의 | `rg -- "--color-warn" styles` | 1 | dark 재정의 없음 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 렌더 사이트 5 = SessionList 2 + PinnedSection 1 + PinnedProjectsSection 1 + ProjectSessionsPanel 1.
- "유일한" 반례 검색: chat→sessions 연결 함수 `subscribeSessionAttention` 외에 `sessionsActions.mark*` 를 부르는 production 파일 0(`rg "markCompleted|markAwaitingResponse" --glob '!*.test.*'` → `useSessionCompletion.ts`·`sessionsStore.ts` 만).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `useSessionCompletion.test.ts` describe 3개('r5 normal completion'·'0249 response attention'·'0249 ΔV3.1') · `navSections.render.test.ts:250` describe 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`
- 현재 책임 소유자: chat feature(턴 상태) · sessions feature(행 표시) · app(이벤트 연결).
- 흐름: `turn.ended`/`permission.requested` → chatStore 리스너 → app → `sessionsActions.mark*` → `unseenAttention` → `SessionRow`.
- 문제의 직접 원인: 행 아이콘 상태의 입력에 턴 진행 여부가 없다(F-01). 이벤트 리스너만 있고 **상태** 투영이 없다.

```text
chatStore.receive(turn.ended | permission.requested)
  → turnEndListeners / responseRequestListeners
  → app subscribeSessionAttention → sessionsActions.markCompleted | markAwaitingResponse
  → sessionsStore.unseenAttention
  → SessionRow modeIcon(data-state: unseen-complete | awaiting-response | default)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`
- 변경 후 책임 소유자: 생성 중 판정 = chat lib(순수) · 변화 감지 = chatStore 구독 함수 · 연결 = app · 보관 = sessionsStore · 우선순위 = sessions lib(순수) · 그리기 = `SessionRow` + shared `DotsSpinner`.
- 유지: 0249 이벤트 리스너·`unseenAttention` 수명 규칙 전부.

```text
useChatStore 변경 (BEGIN_TURN · TURN_END_RESET · pending 변화 · 엔트리 추가/삭제/승격)
  → subscribeGeneratingSessions: generatingSessionKeys(sessions) — isGeneratingResponse 적용
      → 이전 키 열과 같으면 종료 (D-008)
  → app subscribeSessionAttention → sessionsActions.setGeneratingSessions(Set)
      → 같은 구성원이면 bail-out
  → sessionsStore.generatingSessionIds
  → SessionRow: navIconState({ generating, attention, isActive })
      in-progress → <span text-warn><DotsSpinner size={14|20}/></span>
      그 외      → 기존 그대로
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 행 상태 = 주의 표시 + 열람 | + 생성 중 집합(chat 파생, sessions 보관) | 요구 | AR-01 / VP-06 · `sessionsStore.ts` |
| data/control flow | 이벤트 → mark | + 상태 구독 → 집합 투영 | 생성 중은 이벤트가 아니라 구간이다 | SD-01 / VP-05 · `chatStore.ts` |
| state/contract | `data-state` 3값 | 4값(`in-progress` 추가) · 우선순위 함수 | D-005 | MD-02 / VP-09 · `navIconState.ts` |
| error/lifecycle | 종료 이벤트가 표시를 만들지 않음(완료 제외) | 종료 리셋이 집합에서 제외 | D-001 | SD-01 / VP-03 |
| test seam/관측점 | `icon()` SSR 헬퍼 | + 구독 emit 횟수 · CSS 원문 | D-008·D-009 | MD-03 / VP-10 · VP-07 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/chat/lib/responseProgress.ts`(신규) | 생성 중 판정·키 열 | `ChatState` 부분 → boolean / 정렬 키 배열 | `chatStore.ts` |
| `features/chat/store/chatStore.ts` | `subscribeGeneratingSessions` | listener(Set) → unsubscribe | `features/chat/index.ts` export → app |
| `app/hooks/useSessionCompletion.ts` | 투영 연결 1줄 | — | `AppLayout` |
| `features/sessions/store/sessionsStore.ts` | `generatingSessionIds` + `setGeneratingSessions` | Set | app · `SessionRow` |
| `features/sessions/lib/navIconState.ts`(신규) | 우선순위 | `{generating, attention, isActive}` → 상태 | `SessionRow` |
| `shared/ui/DotsSpinner.tsx`(신규) | 점 3개 시각 | `size: 14 \| 20` | `SessionRow` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01 / VP-08·VP-02 | **EP-01** `isGeneratingResponse(s) = s.inflight ∧ pendingAsks.length=0 ∧ pendingPlanReview=null ∧ pendingToolApprovals.length=0` | `responseProgress.ts` | `generatingSessionKeys` — 자리 1(조건 4) | chat store 변경마다 | 조건 누락 시 응답 대기 중에도 스피너(AC4 red) |
| AR-01 / VP-06·VP-10 | **EP-02** 집합 운반 4자리: (a) `subscribeGeneratingSessions` 초기 emit + 변화 emit (b) app `subscribeSessionAttention` → `setGeneratingSessions` (c) sessionsStore 필드 쓰기(구성원 비교 bail-out) (d) `SessionRow` selector `generatingSessionIds.has(session.id)` | chatStore 구독 함수 | chat·app·sessions | 구독 설치·store 변경 | 한 자리라도 빠지면 스피너가 안 뜨거나(a·b·d) nav 가 델타마다 재렌더(c) |
| MD-02 / VP-09·VP-03 | **EP-03** `navIconState` 를 `modeIcon` 3 분기 모두가 쓴다 — 자리 3(이름 변경 행·catalog·nav) | `navIconState.ts` | `SessionRow` | 렌더 | 분기별로 다른 상태가 그려진다 |
| AR-02 / VP-01·VP-07 | **EP-04** 박스 크기 nav 14px · catalog 20px — 자리 2 | `DotsSpinner` `size` | `SessionRow` | 렌더 | 맞바꿈 시 행 높이·정렬 깨짐(M10) |
| AR-02 / VP-07 | **EP-05** i18n `sessions.generating` ko·en — 자리 2 | `resources/ko.ts`·`en.ts` | `SessionRow` | 렌더 | 파리티 테스트 red |
| AR-02 / VP-07 | **EP-06** `@theme` `--animate-dot-wave` + `@keyframes dot-wave` — 자리 1 | `styles/tokens.css` | `DotsSpinner` | 빌드 | 클래스가 무효(정지 점) |
| AR-01 / VP-06 | **EP-07** `docs/arch/frontend/state.md:44` 문단에 생성 중 투영 1문장 | 문서 | 구현자 | 커밋 | 문서 드리프트 |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: 생성 중 판정은 `isGeneratingResponse` 한 곳. sessions 는 판정하지 않고 집합만 읽는다. `sessionResponding` 은 transcript 전용으로 그대로 둔다(D-002 — 의미가 다르다).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 `true/false/undefined` 의미: `unseenAttention.get()` 의 `undefined` = 표시 없음(기존). `generatingSessionIds` 는 Set 이라 부재 = 생성 중 아님.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/lib/responseProgress.ts` (신규) | 판정 | `isGeneratingResponse(s: Pick<ChatState,'inflight'\|'pendingAsks'\|'pendingPlanReview'\|'pendingToolApprovals'>): boolean` · `generatingSessionKeys(sessions: Readonly<Record<string, { session: …}>>): string[]`(오름차순) · `sameKeys(a, b): boolean` | 순수 UT |
| `.../features/chat/store/chatStore.ts` | 변화 감지 | `export function subscribeGeneratingSessions(listener: (keys: ReadonlySet<string>) => void): () => void` — 설치 즉시 현재 집합 1회 emit, 이후 `useChatStore.subscribe((s, prev) => …)` 에서 `s.sessions === prev.sessions` 면 무시, 키 열이 같으면 무시 | harness UT |
| `.../features/chat/index.ts` | export | `subscribeGeneratingSessions` 추가 | — |
| `.../features/sessions/store/sessionsStore.ts` | 보관 | 상태 `generatingSessionIds: ReadonlySet<string>`(초기 빈 Set) · `setGeneratingSessions(ids)` — 구성원이 같으면 `return state` · `sessionsActions` 에 추가 | UT |
| `.../features/sessions/lib/navIconState.ts` (신규) | 우선순위 | `export type NavIconState = 'in-progress' \| 'awaiting-response' \| 'unseen-complete' \| 'default'` · `navIconState({ generating, attention, isActive })` — generating 이면 `in-progress`, 아니면 기존 규칙(`attention` 있고 `!isActive` 일 때 사유별) | 순수 UT |
| `.../features/sessions/components/SessionRow.tsx` | 그리기 | `generating` selector 추가 · `data-state={navIconState(...)}` · in-progress 면 `className` 에 `text-warn`, 자식 `<DotsSpinner size={variant==='catalog'?20:14}/>`, `aria-label={tr('sessions.generating', { agent: tr(appearance.label) })}` · 그 외 분기는 기존 class·Icon 그대로 | SSR |
| `.../shared/ui/DotsSpinner.tsx` (신규) | 시각 atom | `DotsSpinner({ size: 14 \| 20 })` — `data-spinner="dots"` · `aria-hidden` · 박스 `h-[14px] w-[14px] gap-[1.5px]`/`h-5 w-5 gap-[2px]` · 점 `h-[3px] w-[3px]`/`h-1 w-1 rounded-full bg-current animate-dot-wave motion-reduce:animate-none` + 정적 지연 클래스 `[animation-delay:0ms]`·`[animation-delay:160ms]`·`[animation-delay:320ms]`(문자열 리터럴 — Tailwind 스캔) | SSR |
| `.../styles/tokens.css` | 토큰 | `@theme` 안 `--animate-dot-wave: dot-wave 1.2s ease-in-out infinite;` + `@keyframes dot-wave { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8) } 40% { opacity: 1; transform: scale(1) } }`. 색이 아니므로 dark 스코프 재정의 없음(F-14 선례) | CSS 원문 테스트 |
| `.../app/hooks/useSessionCompletion.ts` | 연결 | `subscribeSessionAttention` 에 `const stopGenerating = subscribeGeneratingSessions(sessionsActions.setGeneratingSessions)` 추가, 반환 정리에 포함 | IT |
| `.../shared/i18n/resources/ko.ts`·`en.ts` | 문구 | `sessions.generating`: `'{{agent}} · 답변 생성 중'` / `'{{agent}} · Generating response'` | 파리티 |
| `docs/arch/frontend/state.md` | 현재 상태 | :44 문단에 "생성 중 집합(`generatingSessionIds`)은 chat 엔트리의 inflight·응답 요청에서 파생해 app 이 투영하며 행 아이콘에서 주의 표시보다 앞선다" 1문장 | inventory |

### 신규·변경 테스트

| 파일 | pair | 내용 |
|---|---|---|
| `features/chat/lib/responseProgress.test.ts` (신규) | VP-08 | inflight × 요청 3종 × child 표 · 키 정렬·draft 키 포함 |
| `features/chat/store/chatStore.generating.test.ts` (신규) | VP-10 | `installChatStoreHarness` — 초기 emit 1 · delta 10 + `flushRaf` → 추가 0 · 다른 세션 시작 → 1 · 삭제 → 1 |
| `features/sessions/lib/navIconState.test.ts` (신규) | VP-09 | 12 조합 표 |
| `features/sessions/store/sessionsStore.completion.test.ts` | VP-10 | `setGeneratingSessions` 같은 구성원 → 참조 동일 |
| `app/hooks/useSessionCompletion.test.ts` | VP-01·02·03·05·06 | describe '0254 생성 중 스피너' — `icon()` 에 `isActive` 인자 · AC1·2·4·5·6·11·12 시퀀스 · 해제/재설치 |
| `features/sessions/components/navSections.render.test.ts` | VP-01 | AC3 — 기존 `renderers` 5개에 생성 중 시드 · catalog 20px |
| `shared/ui/dotsSpinner.test.ts` (신규) | VP-07 | AC9 class·지연 서로 다름 · `tokens.css` 원문에 토큰·키프레임 각 1 |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `responseProgress.ts`·`navIconState.ts`(React·store 미의존).
- 기존 메커니즘 재사용 시 형상/시점 적합성: `useChatStore.subscribe` 는 zustand vanilla 구독 — 상태 변경 직후 동기 호출이라 `ingestChatEvent` 직후 단언이 성립한다(델타는 `flushRaf` 후).
- 순서를 관측할 훅/로그/주입 경계: AC5·AC6 은 이벤트 열 → data-state 열 비교로 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
chat events/send → chatStore entry(inflight, pending*) → generatingSessionKeys → app → sessionsStore → SessionRow
```

- producer 기준: chat 엔트리의 `inflight`·요청 배열(D-001).
- consumer 파생 규칙: `navIconState` 하나(D-005).
- 파생 가능한 합성값이 정본을 우회하지 않는가: sessions 는 판정하지 않는다 — 집합 소속만 읽는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `useSessionCompletion` 기존 리스너 2개 | 같은 함수에서 하나 더 설치·정리 | AC7 · VP-06 |
| `sessionsStore` SSR 시드 테스트 | 초기 상태 필드 1 증가 — 기존 테스트의 `Object.assign` 복원 대상에 포함 | AC7 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `AppLayout` 마운트 → `subscribeSessionAttention` → 초기 emit 으로 현재 집합 동기화.
- 취소/중단: `CANCEL_CHAT` 낙관 리셋 → 다음 store 변경에서 집합 제외.
- 종료/quit: 상태는 renderer 휘발이며, 설치한 구독은 React effect cleanup에서 해제한다.
- `AppLayout` 언마운트(게이트 표시 등): 구독 해제. 재마운트 시 초기 emit 이 현재 집합을 다시 쓴다(VP-06 M7).
- 다중 저장소 쓰기: 해당 없음 — store 1곳(sessionsStore)만 쓴다. 산출 문서 사본: `plan.md` + `INDEX.md` 행(§마무리에서 함께 갱신).

## 14. 성능 / 상한 / 최적화

- 새 계산: chat store 변경마다 `O(N log N)`(N = 이번 실행에서 연 세션 엔트리 수). 델타는 rAF 배치라 초당 최대 60회.
- 새 store 쓰기: 구성원 변화 때만 — 턴당 시작·요청·해소·종료로 상수 회.
- 최적화로 잃는 부수 효과: 없음 — 비교는 정렬 키 열 동치이고 집합 의미와 같다. 회귀는 AC8.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — IPC·영속·배포 포트 무변경.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0249 D-002·D-003 응답 대기 = 파랑 | 0249 §3 | §3 D-005 "응답 요청이 있으면 0249 정책이 그대로 정한다" | 유지 |
| 0249 D-004 열람 미생성·열면 해제 | 0249 §3 | §11 `navIconState` 기존 규칙 분기 | 유지 |
| 0249 D-006 app 계층 연결 | 0249 §3 | §3 D-007 | 유지(승계) |
| `inflight` 는 renderer 소유 | `chatReducer.ts:1181-1184` | §3 D-001 | 유지 — 읽기만 한다 |
| 시맨틱 토큰·새 CSS 규칙 금지 | renderer AGENTS §스타일 | §11 tokens.css `@theme` 토큰(선례 F-14) | 유지 |
| `SessionRow` memo — 바뀐 행만 재렌더 | `SessionRow.tsx:40-42` | §3 D-008 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| light 사이드바 위 `warn`(#c79431) 대비가 그래픽 대비 3:1 미만으로 추정 | 사용자 지정 색(결정①). label 이 상태를 말한다(D-010). 실기에서 시인성 확인(AC14) — 부족하면 새 handoff 로 토큰 값 조정 |
| hydrate 경로(`chatReducer.ts:1439-1441`)는 listen 중 세션을 `inflight=true` 로 세운다 | 상속 동작 — transcript 진행 표시와 같은 정본을 따른다. 범위 밖(§6) |
| chat 엔트리가 없는 세션(이번 실행에서 열지 않음)은 표시 불가 | main 스케줄러는 chat 턴을 시작하지 않는다(`bootstrap.ts:639-669` usage·update 잡만) — 실행 중 턴은 이 renderer 가 연 세션이다 |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/lib/responseProgress.ts`(신규) · `responseProgress.test.ts`(신규)
- `app/src/renderer/src/features/chat/store/chatStore.ts` · `chatStore.generating.test.ts`(신규) · `features/chat/index.ts`
- `app/src/renderer/src/features/sessions/store/sessionsStore.ts` · `sessionsStore.completion.test.ts`
- `app/src/renderer/src/features/sessions/lib/navIconState.ts`(신규) · `navIconState.test.ts`(신규)
- `app/src/renderer/src/features/sessions/components/SessionRow.tsx` · `navSections.render.test.ts`
- `app/src/renderer/src/shared/ui/DotsSpinner.tsx`(신규) · `dotsSpinner.test.ts`(신규)
- `app/src/renderer/src/styles/tokens.css`
- `app/src/renderer/src/app/hooks/useSessionCompletion.ts` · `useSessionCompletion.test.ts`
- `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts`
- `docs/arch/frontend/state.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`.
- ABI/네트워크 등 환경 제약: 변경 범위에 DB 스위트 없음 — `npm test` 불필요.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/renderer/src/features/chat/lib/responseProgress.test.ts src/renderer/src/features/chat/store/chatStore.generating.test.ts src/renderer/src/features/sessions src/renderer/src/app/hooks/useSessionCompletion.test.ts src/renderer/src/shared/ui/dotsSpinner.test.ts src/renderer/src/shared/i18n`.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(AC14): ① light·dark 각각 생성 중 행의 노란 점 3개 파도 ② 비열람 세션에서 승인 요청 → 파랑 → 열어 승인 → 스피너 → 완료 ③ Windows 설정 > 접근성 > 시각 효과 > 애니메이션 효과 끔 → 점 정지.

## 복원 턴 설계 검토 (2026-10-07)

- 원본 요구·결정 ①②와 D-001~D-010을 대조했다. 사용자 결정 변경은 없다.
- `sessionsStore.ts:242-270`은 요청 해소로 주의 표시를 지우지 않는다. VP-05의 telemetry 직후 기대값을 `awaiting-response`로 정정했고, `chatStore.ts:789-795`의 `turn.ended` 단독은 종료가 아님을 AC5에 명시했다.
- §7의 AT 식별자와 VP-01~VP-04를 일치시키고, CSS 배선 변이 M11·M12 및 문서 EP-07의 pair 귀속을 보완했다. 최초 커밋 전 V1 정정이며 새 라운드를 만들지 않는다.
- 렌더 사이트 `rg '<SessionRow' app/src/renderer/src/features/sessions --glob '!*.test.*'` = 5, `SessionRow.tsx`의 modeIcon 소비 = 3. 요청 슬롯은 배열 2 + nullable 객체 1이다.
- 문서 상태 사본은 이 plan 메타와 `INDEX.md`의 0254 행이다. 설계 마무리에서 두 곳의 `plan/READY`, 다음 주체 Codex를 함께 확인한다(운영 gate).

- 문서 gate: `cd app; node scripts/check-doc-inventory.mjs --check`에서 generated doc·prose·relative links 모두 통과. 두 plan 상대 링크 누락 0, 0254 AC 14·pair 11(REQUIRED 10/REGRESSION 1), §10에서 pair에 귀속되지 않은 EP 차집합 0.
- 기준선 관련 테스트: 아래 0255와 함께 실행한 비-DB 8파일 155케이스 PASS. 이 결과는 기존 동작의 확인이며 미구현 AC의 PASS가 아니다.

## READY self-review

- [x] Decision Ledger 가 결정 ①② 와 요구 문장을 보존한다 — D-003·D-004 가 질의 답을 원문 그대로 인용.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §5 상태표.
- [x] 조건절 "사용자 답변을 기다리는 케이스는 기존 정책 유지" 를 D-001·D-005 가 그대로 따른다.
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design 연결 — §5 각 행이 AC1~AC12 와 §9 TO-BE 경로에 대응.
- [x] AS-IS 와 TO-BE 가 같은 축 — §9 Delta 5축.
- [x] 사라진 책임 없음 — 0249 리스너·수명 규칙 유지(§16).
- [x] 수치 실측 — 렌더 사이트 5 · 분기 3 · 요청 슬롯 3 · `warn` 정의 1(§8).
- [x] 각 AC 에 행동 단언·검증 수단·도달 경로.
- [x] Baseline V, NEW 노드 전부 REQUIRED pair, 0249 영향 노드는 REGRESSION(VP-11).
- [x] pair 마다 경로·§10 자리 수·직접 oracle, 적대 증거는 배선·0건·자리 불변식에만(VP-01·02·03·06·07·10).
- [x] 운영 gate 열거 — 관련 없는 기존 실패는 blocking 아님.
- [x] 사람 실기로 미룬 순수 로직 없음 — 실기는 시각·OS 설정뿐.
- [x] semantic 목표를 proxy 로만 보지 않는다 — AC8 은 호출 수와 참조 동일을 직접 관측.
- [x] "X 가 쓰인다" 불변식(투영 배선)의 장치가 X 제거 시 실패 — M1·M7. 자리 불변식(아이콘 span vs 행 루트, nav vs catalog 크기)은 맞바꿈 변이 M3·M10.
- [x] 상호배타 상태는 `NavIconState` union 1개로 표현 — 불가능 조합 없음.
- [x] 신규 모듈마다 레이어·강제 지점·seam(§9 책임 표 · §10).
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙 — 표 위주, Part I/II 중복 없음.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
