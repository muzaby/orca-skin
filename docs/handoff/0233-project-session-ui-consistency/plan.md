# Plan — 0233-project-session-ui-consistency

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex — 사용자 지정 |
| 일자 | 2026-09-14 |
| 상태 | READY — V1 설계 확정 |
| V mode / 기준 V | Baseline V / none — 기존 V를 상속하지 않는 새 UI 작업 |
| 이번 revision / 유효 V | V1 / V1 |
| 구현자 / 다음 검증자 | Codex / Claude |

# Part I — Product & UX Contract

## 1. Context / 목표

프로젝트에서 대화를 시작하면 새 대화가 Nav와 Transcript에 끊김 없이 반영되어야 한다. 프로젝트 삭제는 Nav와 개별 프로젝트 페이지에서 실제 실행되어야 한다. Transcript 제목 행은 작업 폴더 아이콘과 대화 제목으로 간소화한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 | `as-is: <프로젝트> / <타이틀 텍스트> <버튼>` → `to-be: <버튼:아이콘만. 텍스트는 제거> <타이틀 텍스트>` | 최초 요청 1 |
| 명시 | “삭제를 배선하고 모든 케밥 버튼에 삭제 메뉴를 추가할 것” | 최초 요청 2 |
| 범위 확정 | “nav.프로젝트 그룹 하위의 프로젝트 항목, 그리고 해당 프로젝트 항목 클릭시 라우팅된 페이지” | 후속 범위 답변 |
| 명시 | “프로젝트 그룹 클릭시 그제서야 싱크된다. 최근대화그룹에 추가되능 시점과 싱크되도록 하라.” | 최초 요청 3, 원문 보존 |
| 증상·가설 | “세션이 초기화되는 과정에서 '뒤로가기' ux 현상이 발생한다.” 이름 없는 세션 제거에 따른 fallback으로 보인다는 가설을 진단하고 해결 | 최초 요청 4 |
| 명시 | “작성자는 codex로 하라” | 후속 작성자 지정 |
| 조사 해석 | 제목 뒤의 기존 버튼은 작업 폴더를 여는 CwdButton. 아이콘만 앞에 두고 동작은 유지 | ChatTitleBar:168, CwdButton:39–47 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | Transcript는 폴더 아이콘 버튼 → 제목 순서. 프로젝트 breadcrumb와 폴더 버튼의 표시 텍스트 제거 | 사용자 to-be 그대로 | 요청 1 | ACTIVE | — |
| D-002 | 삭제 배선 대상은 Nav 프로젝트 행과 그 개별 페이지의 케밥 | “모든”의 범위는 후속 답변이 확정 | 요청 2·범위 답변 | ACTIVE | — |
| D-003 | 새 대화의 프로젝트 membership은 최근 목록 반영과 같은 상태 갱신에서 확정 | 클릭·재진입을 요구하지 않음 | 요청 3 | ACTIVE | — |
| D-004 | 프로젝트 대화 확정 과정에서 대화·입력·현재 화면을 초기화하지 않음 | 원인을 조사해 '뒤로가기'처럼 보이는 현상 해결 | 요청 4 | ACTIVE | — |
| D-005 | 계획 작성자와 설계 커밋 Agent는 Codex | 사용자 지정이 기본 역할표보다 우선 | 후속 지정 | ACTIVE | — |
| D-006 | 프로젝트 삭제는 프로젝트 연결만 해제하며 세션·파일·실행 중 대화 보존 | 기존 삭제 계약 재사용 | IPC_CONTRACT §2.7-b·main handler | ACTIVE | — |

### 갱신 메모

- 최초 결정 D-001~006을 등록했다. D-002는 넓은 삭제 메뉴 해석을 후속 답변으로 좁혔다.
- 작성자 지정은 산출물 메타 규칙이며 제품 AC가 아니다. D-001↔AC1, D-002↔AC2, D-003↔AC6·7, D-004↔AC8·9, D-006↔AC3·4·5를 대조해 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 삭제 backend가 없는가 | 아니오. UI 진입 배선이 빠짐 | projectsActions.remove 호출자 0, ProjectInfoHero 삭제가 메뉴 닫기만 수행 |
| 세션 이름 변경이 세션을 삭제하는가 | 가설 정정. 동일 프로젝트 객체의 재조회가 route effect를 다시 실행해 newChat을 호출 | 실제 hook 입력 재현에서 `newChat(p)` 후 active session=null |
| 동기화는 추가 fetch만으로 충분한가 | 아니오. 서로 다른 fetch의 완료 시점과 늦은 프로젝트 응답을 함께 다뤄야 함 | recentIds와 projectSessionIds의 수신 경계가 별개 |
| 더 작은 해법 | 기존 store·라우터·확인 다이얼로그 재사용 | IPC·DB·의존성 변경 불필요 |
| 기존 결정과 충돌 | 없음. 프로젝트 삭제의 세션 보존, Nav 파티션, cwd 클릭 의미 유지 | §16 대조 |

사용자에게 남은 제품 결정은 없다. 삭제 성공 시 현재 삭제 대상의 개별 페이지에 있으면 프로젝트 목록으로 이동하고, 다른 화면이면 유지한다.

## 5. 동작 / 사용자 흐름

```text
프로젝트 landing → 입력·전송 → 같은 대화에서 준비/응답 표시
  → 실제 세션 확정 → 최근 목록 + 조회된 프로젝트 목록 동시 반영
  → /chat/<확정 ID> replace → 제목 갱신 중에도 같은 대화 유지

Nav 프로젝트 / 개별 페이지 케밥 → 삭제 → 프로젝트명·보존 범위 확인
  → 취소: 그대로
  → 확정: 삭제 성공 후 프로젝트 제거 + 대화 연결 해제
  ↘ 실패: 프로젝트·대화·라우트 유지 + 오류 안내
```

| 시작 상태/이벤트 | 동작 | 관측 결과 |
|---|---|---|
| 프로젝트 대화 목록 조회 완료 | 최근 목록에 새 소속 대화 도착 | 같은 store notification에서 두 membership 갱신 |
| 프로젝트 미조회 | 최근 대화 도착 | 부분 결과를 전체 조회 완료로 표시하지 않음; 펼치면 전체 조회 |
| 이전 프로젝트 조회가 지각 | 새 recent snapshot과 합류 | 새 대화와 최근 창 밖의 과거 대화 모두 유지 |
| 동일 프로젝트 catalog 객체 변경 | cwd 초기화 가능 여부만 확인 | 확정 세션·작성 중 초안 초기화 없음 |
| 실제 다른 landing으로 이동 | 해당 landing 초안 준비 | 이전 대화의 늦은 확정이 새 화면을 빼앗지 않음 |
| 프로젝트 삭제 성공 | 캐시 소속·membership·Nav 상태 해제 | 세션과 실행 상태는 남고 프로젝트만 사라짐 |
| 삭제 요청 중 다른 화면으로 이동 | 완료 시 현재 URL 재확인 | 이전 삭제 요청이 현재 화면을 이동시키지 않음 |

키보드 접근 이름과 실제 경로 tooltip은 아이콘 버튼에 유지한다. 한국어 확인·실패 문구와 기존 danger 메뉴·테마 토큰을 사용한다.

## 6. 범위 / 비범위

- 범위: Transcript 제목, Nav 프로젝트 행(고정됨의 동일 공유 행 포함), 개별 프로젝트 삭제, membership 동기화, 프로젝트 초안 승격 라우팅, 관련 회귀 검증.
- 비범위: `/projects` 카탈로그 행의 메뉴 추가, 앱 전체 메뉴 개편, 세션 삭제 정책 변경, DB·IPC·SDK 변경.
- 별도 발견: Nav 세션 삭제 handler가 API 성공 전 캐시/URL을 정리하는 문제는 별도 세션 삭제 작업 후보. 사용자 확정 D-002의 프로젝트 삭제와 분리하며 이번 작업에서 기존 결함을 PASS로 주장하지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 프로젝트 prefix·구분자·폴더 표시 텍스트 없이 폴더 아이콘→제목 순서. 클릭은 실제 cwd 열기, 이름 편집·우측 액션·Composer 폴더 라벨 유지 | 실제 컴포넌트 산출 순서·버튼 props/handler, 두 테마 실기 | ChatTile→ChatTitleBar→CwdButton→fileApi |
| R-02 | AT-02 / AC2 | Nav 일반/고정 프로젝트와 개별 페이지에서 삭제 확인이 열리고 올바른 프로젝트를 삭제. 메뉴 클릭으로 프로젝트 열기가 함께 발생하지 않음 | 메뉴 실제 onClick→확인 request→IPC 추적. 취소 시 IPC 없음 | Sidebar/ProjectLandingPage→삭제 callback |
| R-03 | AT-03 / AC3 | 성공 후 프로젝트와 그 membership 제거, 모든 캐시 대화의 projectId/pendingProjectId 해제. 세션 내용·cwd·실행 상태·파일 보존 | 실제 store integration에서 상태 전후 대조; project delete 외 파일/세션 delete 호출 없음 | projectApi.delete→projects/sessions/chat/Nav 상태 |
| R-04 | AT-04 / AC4 | 실패·중복 요청·늦은 조회에서도 실패 시 보존하고 성공 후 삭제된 프로젝트를 다시 표시하지 않음 | reject/deferred Promise·반복 확정·stale list 입력 | 삭제 조합→각 store 비동기 수신 경계 |
| R-05 | AT-05 / AC5 | 완료 시 현재 삭제 대상 페이지면 /projects replace. 다른 프로젝트/대화로 이미 이동했으면 그대로 | location을 완료 전에 변경하는 hook 시험 | 삭제 callback→현재 pathname→navigate |
| R-06 | AT-06 / AC6 | 최근 목록에 반영되는 순간 조회된 해당 프로젝트에도 새 대화 반영. 기존 과거 대화·정렬·동일 엔티티 유지 | 단일 store subscriber snapshot에서 recent/project 양쪽 포함 및 nav selector 결과 단언 | recentsEpoch→refresh→store→Nav/프로젝트 panel |
| R-07 | AT-07 / AC7 | 늦은 프로젝트 조회가 새 대화를 제거하지 않음. 미조회와 빈 목록 구분·고정 파티션·무변경 참조 유지 | deferred recent/project 응답 순서 양방향, 기존 순수 테스트 | loadProject/refresh→merge→splitNavSections |
| R-08 | AT-08 / AC8 | 프로젝트 초안 확정과 catalog 재조회가 겹쳐도 본문을 보존하고 실제 ID로 한 번 replace. 제목 부여로 새 초안 생성 없음 | 실제 route hook 다중 render/effect harness에서 active ID·messages·navigate 순서 단언 | promotePendingSession→catalog→useChatRouteSync |
| R-09 | AT-09 / AC9 | 실제 프로젝트 간/새 대화 이동은 정상 초안 준비. 같은 경로의 지각 cwd는 사용자 선택을 덮지 않고, 다른 화면의 늦은 승격은 화면을 빼앗지 않음 | route 전이 harness + chatStore.project 기존 동작 | URL→newChat/initializeProjectCwd→승격 guard |

기존 ChatTitleBar.render 테스트는 CwdButton을 null로 mock하므로 AC1의 증거로 단독 사용하지 않는다. 메뉴가 닫힌 SSR 결과도 AC2를 증명하지 못한다. native 시각 확인은 배치와 순간 깜빡임의 보조 증거이며, membership·라우팅·삭제 실패는 자동 검증한다.

## 7-A. V / Trace Matrix

Baseline V1이다. R-01~09와 AT-01~09는 §7의 각 행으로 등록하며 provenance=NEW, 기준선 없음이다.

| Node | 레벨 | 계약 / 절 | provenance | 출처 |
|---|---|---|---|---|
| SD-01 / ST-01 | SD / ST | 프로젝트 확정→두 목록→실제 라우트, §5 | NEW | 이번 조사·통합 시나리오 |
| SD-02 / ST-02 | SD / ST | 삭제 성공/실패/이탈, §5 | NEW | 기존 IPC 의미 유지 |
| AR-01 / IT-01 | AR / IT | app 소유 삭제 조합과 UI callback 전 구간, §9 | NEW | 이번 배선 |
| AR-02 / IT-02 | AR / IT | recent/project 응답→동일 store→소비자, §9 | NEW | 기존 store 확장 |
| MD-01 / UT-01 | MD / UT | membership 병합·순서·참조·지각 응답, §11 | NEW | 순수 함수·store 시험 |
| MD-02 / UT-02 | MD / UT | landing 진입과 동일 경로 hydration 구분, §11 | NEW | 실제 hook 시험 |
| MD-03 / UT-03 | MD / UT | 삭제 성공에만 소속 해제·지각 응답 억제, §11 | NEW | store 시험 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01↔AT-01 | REQUIRED | ChatTitleBar→CwdButton→openPath | AC1 | 아이콘 제거·아이콘/제목 순서 교환이 검사 실패해야 함 | EP-01 (2) |
| VP-02 | R-02↔AT-02 | REQUIRED | Nav/Hero→callback→confirm→delete | AC2 | callback 제거를 실제 이벤트 시험이 검출 | EP-02 (3) |
| VP-03 | R-03↔AT-03 | REQUIRED | delete 성공→모든 상태 미러 | AC3 | 미선택: 직접 상태·호출 결과 | EP-03 (4) |
| VP-04 | R-04↔AT-04 | REQUIRED | delete/reject/stale fetch→store | AC4 | 미선택: 직접 상태 결과 | EP-03·04 (9) |
| VP-05 | R-05↔AT-05 | REQUIRED | 삭제 완료→현재 URL→navigate | AC5 | 미선택: 직접 라우트 결과 | EP-05 (1) |
| VP-06 | R-06↔AT-06 | REQUIRED | refresh→store→Nav/panel | AC6 | 미선택: 같은 notification의 목록 의미 | EP-06 (2) |
| VP-07 | R-07↔AT-07 | REQUIRED | 지각 loadProject→merge→Nav | AC7 | 미선택: 응답 경쟁 결과 | EP-06 (2) |
| VP-08 | R-08↔AT-08 | REQUIRED | 승격→catalog 변경→route effects | AC8 | 미선택: 원인 재현 입력의 실제 hook 결과 | EP-07 (2) |
| VP-09 | R-09↔AT-09 | REQUIRED | 실제 URL 이동/hydration→draft | AC9 | 미선택: 실제 hook/store 결과 | EP-07 (2) |
| VP-10 | SD-01↔ST-01 | REQUIRED | 프로젝트 draft→승격→store/nav/URL | AC6~9 연속 시나리오 | 미선택: 종단 상태 관측 | EP-06·07 (4) |
| VP-11 | SD-02↔ST-02 | REQUIRED | 메뉴→확인→IPC→캐시/라우트 | AC2~5 연속 시나리오 | VP-02 변이 재사용 | EP-02~05 (13) |
| VP-12 | AR-01↔IT-01 | REQUIRED | app→Nav·router→Hero→삭제 조합 | 모든 조립 callback으로 정확한 ID 전달 | VP-02 변이 재사용 | EP-02·03·05 (8) |
| VP-13 | AR-02↔IT-02 | REQUIRED | 두 조회 경계→membership→소비자 | 동일 byId 항목·양쪽 membership | 미선택: 직접 결과 | EP-06 (2) |
| VP-14 | MD-01↔UT-01 | REQUIRED | 목록 병합 입력→정렬된 membership | 기존 과거/신규/이동/빈/미조회·참조 | 미선택: 직접 결과 | EP-06 (2) |
| VP-15 | MD-02↔UT-02 | REQUIRED | route effect 입력→newChat/navigate | 실제 hook의 refs/deps를 유지한 결정 | 미선택: 직접 결과 | EP-07 (2) |
| VP-16 | MD-03↔UT-03 | REQUIRED | delete 성공→각 store 변경 | 프로젝트만 해제, 다른 데이터 보존 | 미선택: 직접 결과 | EP-03·04 (9) |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 명령 / 증거 | 실패 범위 |
|---|---|---|---|
| Renderer | TS·경계·hooks·스타일 규칙 | app에서 npm run lint, npm run typecheck | 변경으로 발생한 실패 |
| 관련 시험 | state·routing·삭제 동작 | 직접 vitest run으로 §19 대상 실행 | 명시 AC 회귀 |
| 문서 | 코드와 현재 상태 설명 정합 | app에서 node scripts/check-doc-inventory.mjs --check, 루트 git diff --check | 이번 문서 변경 |
| 메시지 버스 | D-005·계획 기준선·상태 사본 | 별도 설계/구현 커밋, trailer 실제 파싱, INDEX | 이번 handoff |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 제목 뒤 버튼은 표시 cwd 이름과 실제 열기 경로를 구분 | CwdButton.tsx:33–47 |
| 최근 갱신은 프로젝트 membership을 쓰지 않음 | sessionsStore.ts initSessions/loadProject |
| 프로젝트 자동 펼침 신호는 신규 프로젝트 생성만 대상 | useProjectCatalogSync.ts projectCreated guard — 기존 프로젝트 활성화로 확장하지 않음 |
| 동일 프로젝트 객체 갱신이 sessionId!=null에서 newChat 실행 | useChatRouteSync.ts:89–95 |
| 확정 시 프로젝트 카탈로그 조회가 일어남 | useChatSessionsSync.ts projectId/recentsEpoch effects |
| DB delete는 세션 연결만 해제 | main/app/handlers/project.ts:62–64, IPC_CONTRACT §2.7-b |
| 페이지는 조립, feature 간 직접 import 금지 | renderer/AGENTS.md 4-layer DAG, eslint.config.mjs |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| CwdButton 실제 JSX 사용 | rg CwdButton renderer, 정의/import 제외 | 2 | ChatTitleBar·CwdPanel |
| 요청 범위 프로젝트 메뉴 | PinnedProjectRow·ProjectInfoHero와 useSidebarSlots 조립 대조 | 3 표면 | Nav 일반·고정 공유 행 + 개별 페이지 |
| membership 수신 | rg projectSessionIds sessionsStore, 조회 함수 추적 | 2 | initSessions·loadProject |
| route 동기화 effects | useChatRouteSync 전체 읽기 | 2 | URL→store·store→URL |
| 직접 삭제 API caller | rg projectsActions.remove renderer | 0 | UI 미배선 |

기존 시험은 sessionsStore.test의 공용 엔티티·동일 참조·GC·조회 실패, chatStore.project.test의 지각 cwd 보호, useProjectCatalogSync.test의 신규 영수증만 펼침을 확인했다. 실제 소스를 메모리에서 실행한 조사 결과는 [diagnose.mjs](diagnose.mjs)로 재현한다. 이는 store/hook 결정 재현이며 실제 Electron 프레임 타이밍을 측정한 것은 아니다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
session.updated → chatStore 승격/recentsEpoch
  → sessions.refresh → byId/recentIds만 변경
  → projects.refresh → urlProject 객체 변경
  → URL→store effect → 같은 프로젝트에서도 newChat → 본문 소실

Nav 메뉴: pin만 / Hero 삭제: 메뉴 닫기만
projects.remove: API 성공 → catalog 재조회 (호출자 없음)
```

### TO-BE

```text
session.updated → 기존 승격/recentsEpoch
  → sessions.refresh → byId/recentIds/조회된 projectSessionIds를 한 transaction에 갱신
  → project list 지각 응답도 최신 recent membership과 합류
  → catalog 재조회는 같은 route 초안을 reset하지 않음
  → armed 승격이 /chat/<ID> replace

Nav/Hero → app 삭제 callback → 공용 확인 → projectApi.delete
  → projects catalog·sessions 소속·chat 소속·Nav 펼침 상태 정리
  → 완료 시 현재 route가 삭제 대상일 때만 /projects replace
```

| 비교 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 제목 표시 | breadcrumb→제목→폴더 라벨 | 폴더 아이콘→제목 | VP-01 |
| 삭제 소유권 | UI no-op, store API 고립 | app 조합 callback, feature는 자기 상태만 변경 | VP-02~05·12 |
| membership | recent/project 따로 갱신 | 두 수신 경계에 같은 병합 규칙, recent 수신에서 원자적 갱신 | VP-06·07·13·14 |
| lifecycle | 같은 project 재조회도 reset | pathname 실제 진입만 reset, hydration 분리 | VP-08·09·15 |
| 실패 | 삭제 후 재조회 실패가 삭제 실패처럼 보일 수 있음 | API 성공 직후 로컬 제거, stale 조회가 복원 못함 | VP-04·16 |

## 10. 계약 / 타입 / 강제 지점

| EP / V pair | 계약·SSOT | 누가 / 언제 강제 (전수) | 실패 의미 |
|---|---|---|---|
| EP-01 / VP-01 | iconOnly 기본 false, 실제 cwd 클릭 유지 | ChatTitleBar 표시·CwdPanel 기존 표시 (2) | 제목 순서/라벨 계약 또는 Composer 회귀 |
| EP-02 / VP-02·11·12 | 삭제 callback은 app 소유 | useSidebarSlots 일반·고정, router→ProjectLandingPage→Hero (3) | 메뉴는 보여도 동작 없음/잘못된 ID |
| EP-03 / VP-03·04·11·12·16 | 프로젝트 삭제는 세션 삭제 아님 | projects catalog, sessions byId/membership, chat 캐시 전체, projectNav 상태와 announceCreated 재진입 (4 소유자) | 유령 프로젝트 또는 대화/실행 상태 소실 |
| EP-04 / VP-04·11·16 | 성공 뒤 지각 응답은 삭제를 되돌리지 않음 | projects list, sessions recent, project sessions 조회, chat session load, chat session.updated (5) | 삭제된 연결·목록 복귀 |
| EP-05 / VP-05·11·12 | 완료 시 현재 URL 기준 | app 삭제 callback 완료 continuation (1) | 사용자 이동을 오래된 요청이 덮음 |
| EP-06 / VP-06·07·10·13·14 | 같은 membership 규칙 | initSessions 수신, loadProject 수신 (2) | 순간 목록 불일치/새 항목 재소실/과거 잘림 |
| EP-07 / VP-08·09·10·15 | 실제 진입과 승격 구분 | URL→store effect, store→URL effect (2) | 새 초안 재생성/잘못된 승격 이동 |
| OP-01 / 문서 gate | 작업 상태의 사본 | plan 메타·INDEX (2) | 다음 차례가 모순됨 |

제품 강제 지점은 3+4+5+1+2+2+2=19곳, 문서 상태 사본은 별도 2곳이다. pair의 분모는 참조 EP의 합이며 중복 EP를 두 번 세지 않는다. `실패 의미`를 다른 gate의 추정 보호로 대체하지 않는다.

## 11. 구현 설계

| 파일/모듈 | 변경 책임 | 테스트 seam |
|---|---|---|
| chat/components/ChatTitleBar.tsx·CwdButton.tsx | 아이콘 전용 옵션(기본 false), 선행 배치, breadcrumb 제거 | 실제 요소 트리·handler·SSR 순서 |
| app/hooks/useProjectDeletion.ts (신규) | 확인·중복 방지·오류·성공 후 cross-feature 정리·현재 URL 이동 | 훅 효과/콜백과 실제 store, API만 주입 |
| AppLayout·router·useSessionHandlers·useSidebarSlots·ProjectLandingPage | 하나의 삭제 callback을 요청 표면에 전달 | 실제 JSX callback 전수 시험 |
| PinnedProjectsSection·ProjectInfoHero | danger 삭제 메뉴→callback, bubbling 방지 | 메뉴 onClick/confirm 실행 |
| projectsStore·projectNavStore | 성공 후 해당 프로젝트 로컬 제거·Nav 상태 정리, 오래된 list/생성 신호 억제 | deferred promise·실제 store |
| sessionsStore·sessions/lib의 독립 순수 병합 모듈 | recent/project 공통 reconcile, detachProject, 지각 응답 보호 | node Vitest; native import 없음 |
| chatStore | 삭제 프로젝트의 session.projectId/pendingProjectId만 null, cached live/body/cwd 보존. 지각 load/event 소속 재부착 방지 | 기존 chatStore fixture 확장 |
| useChatRouteSync | pathname 진입 시에만 project newChat, 같은 경로 hydration 유지. 승격 전 실제 active state와 현재 route 소유권 재확인 | refs/deps 유지 multi-render 실제 hook |
| shared/i18n/resources/{ko,en}.ts | 프로젝트 삭제 제목·보존 설명·실패 안내, 기본 한국어·기존 영문 리소스 정합 유지 | 현재 i18n 키/type gate |
| docs/arch/frontend/{state,layers,ux-domains}.md | 구현 후 현재 흐름·타이틀 설명 동기화 | 문서 inventory/link gate |

membership은 조회된 각 버킷에서 최신 recent 중 해당 projectId의 ID와 기존 창 밖 ID를 합치고 중복을 제거한다. 최신 byId의 updatedAt 기준 목록 의미를 유지하며 동일 결과에는 원래 참조를 반환한다. 미조회 버킷은 recent 부분 목록만으로 만들지 않는다.

loadProject가 오래된 응답을 주면 그 요청 이후 수신된 recent 정보가 최신 항목의 membership/엔티티를 덮어쓰지 못하게 한다. 삭제 성공을 기록한 ID/세대는 현재 renderer 프로세스 동안 보관해 각 store의 지각 응답 경계에서 확인하며, 다른 UUID의 신규 프로젝트 생성은 허용한다. 프로젝트 소속만 해제하며 이미 시작한 대화의 실행 경로·내용·상태는 건드리지 않는다.

## 12. End-to-end 영향

producer는 기존 main session.updated와 목록 IPC를 유지한다. 소비자는 useProjectSessions, useNavSections/splitNavSections, ChatTitleBar, useChatRouteSync이며 같은 엔티티·membership·프로젝트 연결을 읽는다. 프로젝트 생성 영수증의 자동 펼침은 신규 프로젝트에만 적용하는 기존 규칙을 보존한다.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 실제 project landing 진입은 초기화, 같은 route 재조회는 초기화하지 않는다.
- 삭제 취소/실패: mutation·라우트 변경 없음; 실패 메시지는 사용자에게 표시한다.
- 삭제 성공: DB가 먼저 확정한 뒤 renderer 미러를 동기적으로 정리한다. 뒤따른 catalog refresh 실패를 삭제 실패로 보고하지 않는다.
- 다중 저장소: 영속 쓰기는 기존 DB 하나다. renderer 캐시 여러 개는 재시작 시 DB 조회로 복원되고 지각 응답은 삭제 기록으로 차단한다.
- 늦은 이벤트/다른 화면: 소속만 해제하며 새 화면의 선택·본문을 유지한다. 동일 프로젝트 중복 확정은 한 요청으로 제한한다.
- 문서 상태 사본: plan·INDEX를 같은 단계 커밋에 갱신하고, 설계와 구현은 별도 커밋으로 남긴다.

## 14. 성능 / 상한 / 최적화

새 네트워크·IPC polling은 추가하지 않는다. 기존 recent 수신 때 조회된 membership을 병합하며 전체 프로젝트를 매번 재조회하지 않는다. 무변경 행/배열의 참조를 보존하고 미조회 프로젝트의 lazy loading을 유지한다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음. 기존 project:delete·session 목록·파일 열기 계약을 재사용하며 DB migration과 신규 의존성은 없다.

## 16. 기존 결정·규칙과의 관계

| 기존 계약 | 출처 | 본문 | 결과 |
|---|---|---|---|
| feature 교차 import 금지 | renderer/AGENTS.md | §9·11 app callback 합성 | 유지 |
| 프로젝트 삭제는 세션 보존 | IPC_CONTRACT §2.7-b | D-006·AC3 | 유지 |
| 미조회≠빈 목록·참조 보존 | state.md §1.6·sessionsStore tests | AC6·7 | 유지 |
| 고정/프로젝트/최근 파티션 | navSections·sessionPlacement | AC7 | 유지 |
| 실제 열기는 cwd, worktree label은 표시용 | CwdButton | AC1 | 유지 |
| 작성자 기본 Claude | handoff template | 메타·D-005 | 사용자 지시로 이번 작성자 Codex |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 목록 수신 순서로 새 행이 다시 소실 | recent와 project 응답 양쪽의 deferred 시험 |
| reset만 막다가 실제 페이지 전이가 깨짐 | 실제 pathname 전이와 stale 승격 회귀 AC9 |
| 프로젝트 삭제가 대화 제거로 확대 | 연결 필드만 patch, live/body/cwd 동일성 시험 |
| 닫힌 Popover 시험의 거짓 통과 | 실제 callback 호출·확인 실행·삭제 배선 제거 변이 |
| native 프레임 타이밍은 node harness가 모형 | 자동 상태 검증과 별도로 가능한 Electron/브라우저 시각 확인, 미실시는 명시 |

## 18. 영향 받는 파일 / 문서

변경 파일 소유와 경계는 §11이 정본이다. handoff 산출물은 본 plan, 진단 스크립트, INDEX이며 구현 보고는 아래에 누적한다.

## 19. 게이트

- 적용 가이드: app/AGENTS.md, app/src/renderer/AGENTS.md, docs/AGENTS.md, docs/handoff/AGENTS.md.
- 정적: app에서 npm run lint 및 npm run typecheck. lint의 자동 수정은 실제 diff를 검토한다.
- 비-DB: 직접 vitest run으로 신규 route/deletion/membership 시험과 sessionsStore·navSections·sessionPlacement·ChatTitleBar·chatStore.project·chatStore.sessionDirectory·useProjectCatalogSync·useSidebarSlots·프로젝트 landing render 회귀를 실행한다.
- ABI: DB·main contract 변경이 없으므로 pretest의 ABI 전환을 실행하지 않는다.
- 문서: app에서 node scripts/check-doc-inventory.mjs --check, 루트 git diff --check, 계획/INDEX/Agent trailer 대조.
- 시각: 두 테마에서 제목 행, Nav와 Hero 삭제 확인, 프로젝트 composer 첫 전송을 확인한다. 실행할 수 없는 경계는 구현 보고에서 자동 검증과 구분한다.

## READY self-review

- D-001~006을 AC 및 메타 gate와 대조해 충돌 0. 사용자 확정 삭제 범위는 카탈로그 메뉴까지 넓히지 않았다.
- Part I의 핵심 흐름을 §9 AS-IS/TO-BE와 §11 구현 파일에 연결했다.
- R/AT 9쌍과 SD 2·AR 2·MD 3쌍 모두 REQUIRED로 등록했다. 기존 V 상속 없이 이번 요구의 회귀 조건을 AC7·9에 직접 포함했다.
- §10은 제품 19곳과 문서 2곳을 구분했다. 실제 메뉴 배선·표시 순서에만 적대 변이를 선택했다.
- 관련 코드·테스트 이름·정본 문서 절을 조사했다. source harness는 native 실행으로 주장하지 않는다.
- 독립 설계 대조: pair 16개·EP 분모 19곳 일치. 리소스 경로·Nav 생성 신호 재진입·삭제 기록 수명 지적을 반영했으며 문서 inventory/link gate가 통과했다.

---

## [구현자 기입] 설계 리뷰

구현 전 기입 대기.

## [구현자 기입] 강제 지점 전수 (§10 대조)

구현 전 기입 대기. V-pair 자기 상태와 직접 증거를 함께 기록한다.

## [구현자 기입] 이번 라운드 수정의 잠금

구현 전 기입 대기. VP-01의 제거/순서 교환, VP-02의 callback 제거를 실행한다.

## [구현자 기입] Product/UX 파생 검토

구현 전 기입 대기.

## [구현자 기입] 놓친 잠재 문제 + 대응

구현 전 기입 대기. 설계 대비 명시적 차이와 대체물의 만료·공유·재진입·다른 무효화 축을 기록한다.

## [구현자 기입] 구현 보고

구현 전 기입 대기. 관측한 gate·V-pair·강제 지점·AC 합계·블로커·대상 커밋 좌표(INDEX)를 기록한다.

## [구현자 기입] Review Signals — 사실만

최초 설계. 재구현 라운드 없음.

## [검증자 기입] 파생 이슈

검증 전 기입 대기.
