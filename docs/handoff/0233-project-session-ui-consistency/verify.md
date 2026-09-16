# Verify — 0233-project-session-ui-consistency

## 메타

| 항목 | 값 |
|---|---|
| slug | `0233-project-session-ui-consistency` |
| 검증자 | Claude Code |
| 일자 | 2026-09-16 |
| 대상 커밋/range | `e837976..9de8dd3` |
| 구현 전 plan 기준 | `e837976` (설계 커밋) |
| V mode / 유효 V | `Baseline V: V1` / V1 |
| 검증 기준 plan revision | `e837976:V1` |
| 라운드 | 1 |
| 상태 | **PASS**(기계 범위) — 남은 사람 실기 1건 |
| 자기 검증 여부 | 아니오. 설계·구현 = Codex(`Agent: codex`), 검증 = Claude Code. §4 분모는 등록 변이 3 + 검증자 신설 20 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예. `git diff e837976 9de8dd3 -- .../plan.md`의 변경은 **전부 `[구현자 기입]` 6절**이다.
- 기준선이 diff로 성립하는가: **예**. 설계 `e837976`와 구현 `9de8dd3`가 갈려 있어 §0 장치가 작동한다.
- Decision Ledger 변경: 없음 (diff에 D-001~006 행 hunk 0).
- Product/UX Contract 변경: 없음 (§1~§7 hunk 0).
- AC 변경: 없음 (§7 R-01~09 / AC1~9 hunk 0).
- V node/pair·requiredness·§10·oracle 변경: 없음 (§7-A 16 pair·§10 EP-01~07 hunk 0).
- 채점에 사용할 원 기준: `e837976`의 §3 Decision·§7 AC1~9·§7-A VP-01~16·§10 EP-01~07.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 메타 `Baseline V / none`. 상속 기준 V 없음 — 새 UI 작업 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R 9·SD 2·AR 2·MD 3 = 16 node 전부 provenance `NEW`, 16 pair 전부 `REQUIRED` |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | `INHERITED` node 0. 기존 동작 회귀는 AC7·AC9가 직접 포함 |
| pair별 path·§10 전수·직접 oracle | 유효 | 16행 모두 production path·EP 분모·직접 oracle 보유. 분모 합산 검산: VP-04 `EP-03·04`=4+5=9, VP-11 `EP-02~05`=3+4+5+1=13, VP-12 `EP-02·03·05`=3+4+1=8 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-01·02만 선택(표시 순서·배선 존재는 직접 결과가 없다), 나머지 14행은 `미선택 + 이유` |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A gate 4종·§19가 `app/AGENTS.md` ABI 지침과 어긋나지 않음 |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음 — V1 템플릿으로 작성됨.
- root PLAN_GAP과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | 폴더 아이콘 버튼 → 제목, breadcrumb·폴더 라벨 제거 | `ChatTile` → `ChatTitleBar.tsx:126` → `CwdButton(iconOnly)` → `fileApi.openPath` |
| D-002 | Nav 일반/고정 공유 행 + 개별 페이지 케밥에 삭제 | `useSidebarSlots.tsx:33·:73` → `PinnedProjectRow`; `router.tsx:39` → `ProjectLandingPage.tsx:89` → `ProjectInfoHero` |
| D-003 | 최근 반영과 같은 갱신에서 프로젝트 membership 확정 | `initSessions` → `reconcileProjectMembership` → 한 `setState` |
| D-004 | 확정 과정에서 대화·입력·화면을 초기화하지 않음 | `useChatRouteSync` 방향 1 `entered` 가드 + 방향 2 `getActiveChatSession()` 재독 |
| D-005 | 작성자·설계 Agent = Codex | plan 메타 `작성자 Codex`, 두 커밋 trailer `Agent: codex` |
| D-006 | 삭제는 연결만 해제, 세션·파일 보존 | `project.ts:62-64` DB `ON DELETE SET NULL` + renderer 4 미러의 소속 필드만 patch |

### end-to-end 흐름

```text
프로젝트 landing 진입 → newChat(projectId, cwd) → send
  → main session.updated(projectId) → chatStore 승격 + recentsEpoch
  → sessionsActions.refresh → byId/recentIds/조회된 projectSessionIds 한 transaction
  → splitNavSections → Nav 최근·프로젝트 하위 동시 반영
  → 방향 2 armed → /chat/<확정 ID> replace (본문 배열 동일 참조 유지)

Nav 행/고정 행/Hero 케밥 → onDeleteProject → 공용 확인
  → projectApi.delete → projects·sessions·chat·projectNav 소속 해제
  → 완료 시 window.location.pathname 재독 → 삭제 대상 페이지면 /projects replace
  ↘ reject → alert + 4 미러·라우트 보존 + 재시도 허용
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ✅ | `projectApi.delete` reject 시 catch → alert → `return`. 4 미러 정리는 성공 경로에만 있다 (`useProjectDeletion.ts` try/catch/finally 이후 문) |
| false success 가능성 | ✅ 없음 | `remove`가 `await projectApi.delete(id)` 뒤에만 로컬 목록을 지운다. 후속 catalog 재조회 실패가 삭제 실패로 보고되지 않는다 |
| partial failure/rollback | ✅ | 영속 쓰기는 DB 1곳. renderer 4 캐시는 삭제 기록(`deletedProjectIds`)으로 지각 응답을 차단하고 재시작 뒤엔 DB가 정본 |
| Product/UX의 A가 아닌 B를 구현했는가 | ✅ 아니오 | D-001의 to-be(`<버튼:아이콘만> <타이틀>`)가 `ChatTitleBar.tsx:126`에서 제목보다 앞이고 `iconOnly` 기본값은 false로 남아 Composer 라벨이 유지된다 |
| 증상만 제거하고 상태 변화가 남았는가 | ✅ 아니오 | 가설(이름 없는 세션 삭제)이 아니라 원인(같은 pathname의 catalog 갱신이 `newChat` 재실행)을 `entered` 가드로 막았다. M8이 red |
| 최적화가 잃은 재검증/취소/만료 관측 | ⚠️ 검토 완료 | `remove`가 `initProjects()` 재조회를 지웠다. 대신 `initProjects`가 `deletedProjectIds` 필터를 갖고 이름·고정 변경 경로는 재조회를 그대로 쓴다 |
| 출력/요청 worst-case 상한 | ✅ | 신규 IPC·polling 0. `reconcileProjectMembership`은 조회된 버킷 수 × (버킷 + recent 50) 상한 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh e837976..9de8dd3
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 1a 절 `(없음)`. `reconcileProjectMembership`은 `sessionsStore.ts:9`가 프로덕션에서 import |
| 타입 전용 export 7건 | 정상 | 전부 정의 파일 내부 시그니처용(`SidebarSlots`·`SessionEntry` 등), 이번 변경 이전부터 동일 |
| 테스트 전용 참조 8건 | 정상 | `useSessionsStore`·`useProjectNavStore` 등 store 핸들. 프로덕션은 `useXxxState`/actions 배럴로 소비 — 기존 패턴 |
| 형제 정책 비대칭 | 없음 | 3절 `(없음)`. 실패 알림도 `sessionsStore.remove`와 같은 `window.alert` |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `projectSessionIds` 소비처는 `splitNavSections`·`useProjectSessions` 2곳. 둘 다 `updated_at DESC` 순서를 그대로 읽고 `listSessionsByProject`(`queries.ts:307`)와 정렬 규칙이 같다 |
| producer ↔ consumer 파생 불일치 | **1건** | `useSessionActions.onOpenProject`(`useSessionActions.ts:36`)의 소비처가 0이 됐다 → D1 |
| 동일 규칙 중복 구현 | SSOT 유지 | membership 병합 규칙은 `projectMembership.ts` 1곳이고 `initSessions`·`loadProject`가 같은 함수를 부른다 |

- 배선 ≠ 테스트 존재 대조: 신규 테스트 4파일은 전부 production symbol을 직접 부른다 — `projectDeletionWiring.test.ts`가 실제 `AppRouter`·`useSidebarSlots`·`useProjectDeletion`·실제 `useConfirmStore`를 쓰고, portal 경계(`Popover`/`MenuItem`)만 모의한다. M3·M4가 red인 것이 그 증거다.

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 실제 존재: `sessionsStore.test.ts`·`chatStore.project.test.ts`·`useProjectCatalogSync.test.ts` 3파일 모두 대상 실행에 포함돼 green.
- 핵심 입력/분기 실제 실행: `useChatRouteSync.test.ts`가 실제 hook을 multi-render로 돌리고 `chatActions.send`→`ingestChatEvent`까지 지난다.
- structural proxy만으로 통과한 AC: 없음. 이번 라운드는 0건/전수 스윕·정규식 게이트를 새로 만들지 않았으므로 §8의 판정 기준 엄격화 대상이 없다.
- **선택된 적대 증거 재측정**: 등록 변이 **3건 중 3건 red**, 미검출 0, 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이므로 이전 red 변이 없음 — 덮개 회귀 0건.
- **자기검증 분모**: 구현자(Codex) ≠ 검증자(Claude). 그럼에도 구현 보고가 이름을 대지 않은 축 **20건**을 신설해 16 red · 4 green.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — 제목 행 `CwdButton` 삭제 | 대상 18파일 | 미실행 | **red** 1건 | VP-01 등록 변이 |
| M2 — 폴더 버튼을 제목 뒤로 이동 | 대상 18파일 | 미실행 | **red** 1건 | VP-01 등록 변이 |
| M3 — 두 컴포넌트의 `onDeleteProject(project.id)` 삭제 | 대상 18파일 | 미실행 | **red** 3건(nav·pinned·hero) | VP-02 등록 변이 |
| M4 — 고정 슬롯 `onDeleteProject` ↔ `handleOpenProject` 맞바꿈 | 대상 18파일 | 미실행 | **red** 1건(pinned만) | 검증자 신설 — 형제 슬롯 맞바꿈 |
| M5 — 확인 다이얼로그 우회(즉시 삭제) | 대상 18파일 | 미실행 | **red** 12건 | 검증자 신설 — EP-03 진입 |
| M6 — 완료 시 현재 URL 무시하고 항상 이동 | 대상 18파일 | 미실행 | **red** 4건 | 검증자 신설 — EP-05 |
| M7 — `initSessions`의 membership 합류 제거 | 대상 18파일 | 미실행 | **red** 5건 | 검증자 신설 — EP-06 ① |
| M8 — 프로젝트 랜딩 `entered` 가드 제거(회귀 복원) | 대상 18파일 | 미실행 | **red** 2건 | 검증자 신설 — EP-07 ① |
| M9 — 삭제 시 `pendingProjectId` 미해제 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-03 |
| M10 — `projectsStore.initProjects` 삭제 기록 필터 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-04 ① |
| M11 — `dispatchTo`의 삭제 소속 차단 제거 | 대상 18파일 | 미실행 | **red** 2건 | 검증자 신설 — EP-04 ④⑤ |
| M12 — `freshEntry`의 삭제 소속 차단 제거 | 대상 18파일 | 미실행 | **green** | 검증자 신설 → D3 |
| M13 — `loadProject`의 지각 응답 보호 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-06 ② |
| M14 — `sessionsActions.detachProject` 호출 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-03 소유자 |
| M15 — `chatActions.detachProject` 호출 제거 | 대상 18파일 | 미실행 | **red** 6건 | 검증자 신설 — EP-03 소유자 |
| M16 — `projectNavActions.remove` 호출 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-03 소유자 |
| M17 — 삭제 프로젝트의 `announceCreated` 재진입 차단 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-03 재진입 |
| M18 — `initSessions` 최근 수신의 소속 차단 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-04 ② |
| M19 — `loadProject` 삭제 차단 3중 제거 | 대상 18파일 | 미실행 | **red** 1건 | 검증자 신설 — EP-04 ③ |
| M20 — 방향 2 승격을 경로에 묶지 않음 | 대상 18파일 | 미실행 | **green** | 검증자 신설 → D4 |
| M21 — 방향 2 armed 게이트 전체 제거 | renderer 240파일 | 미실행 | **green** | 검증자 신설 → D4 |
| M22 — 방향 2 render snapshot 일치 확인 제거 | 대상 18파일 | 미실행 | **green** | 검증자 신설 → D4 |
| M23 — 방향 2 `navigate` 자체 제거 | 대상 18파일 | 미실행 | **red** 5건 | 검증자 신설 — EP-07 ② |

- 동작 보존 추출 라운드인가: 아니오 — 동작을 바꾸는 구현이라 hunk 되돌림 문제는 해당 없음.
- 소거 변이의 잔여물 수렴: 해당 없음 — 23건 모두 테스트 단언 실패로 red/green이 갈렸고 lint·typecheck 진단을 red 근거로 쓰지 않았다.
- 형제 슬롯 맞바꿈 변이: **M4 1건 실행, red**. 일반 슬롯은 통과하고 고정 슬롯만 실패해 두 슬롯이 독립으로 잠긴다.
- `N회` 기준의 실제 관측 주체: `navigate.mock.calls`를 배열 전체로 단언한다(`toEqual([['/chat/new', { replace: true }]])`) — 호출 수와 인자를 같이 본다.
- 순서 기준의 관측 훅/로그: `ChatTitleBar.layout.test.ts`가 `renderToStaticMarkup` 산출의 문자열 인덱스로 폴더·제목 순서를 관측한다. M2가 red.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-14 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | `projectMembership.test.ts` 5케이스 + M7 red | 목록 입력 → 정렬된 membership / EP-06 2/2 |
| VP-15 | MD-02 ↔ UT-02 / UT | REQUIRED | **PASS** | `useChatRouteSync.test.ts` 실제 hook 8케이스 + M8·M23 red | route effect → newChat/navigate / EP-07 2/2 |
| VP-16 | MD-03 ↔ UT-03 / UT | REQUIRED | **PASS** | `projectsStore`·`projectNavStore`·`chatStore.projectDeletion` + M9·M10·M17 red | delete 성공 → 각 store / EP-03·04 9/9 |
| VP-12 | AR-01 ↔ IT-01 / IT | REQUIRED | **PASS** | `projectDeletionWiring.test.ts` 3표면 + M3·M4 red | app → Nav·router → Hero / EP-02·03·05 8/8 |
| VP-13 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | `sessionsStore.projectMembership.test.ts`가 같은 `byId` 참조를 양쪽에서 단언 + M13 red | 두 조회 경계 → membership → 소비자 / EP-06 2/2 |
| VP-10 | SD-01 ↔ ST-01 / ST | REQUIRED | **PASS** | `useChatRouteSync.test.ts`의 send→session.updated→recent/project→Nav→URL 연속 케이스 | 프로젝트 draft → 승격 → store/nav/URL / EP-06·07 4/4 |
| VP-11 | SD-02 ↔ ST-02 / ST | REQUIRED | **PASS** | `useProjectDeletion.test.ts` 8케이스(성공·실패·중복·4 이탈 경로) + M5·M6 red | 메뉴 → 확인 → IPC → 캐시/라우트 / EP-02~05 13/13 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **PASS** | `ChatTitleBar.layout.test.ts` 2케이스 + 등록 변이 M1·M2 red | ChatTitleBar → CwdButton → openPath / EP-01 2/2 |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | **PASS** | 3표면 `stopPropagation`·`openProject` 미호출·확인 전 IPC 0 단언 + M3 red | Nav/Hero → callback → confirm → delete / EP-02 3/3 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | **PASS** | `chatStore.projectDeletion`이 messages·live 참조 동일을 단언, file/session delete 호출 0 | delete 성공 → 모든 상태 미러 / EP-03 4/4 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | **PASS** | reject 보존·중복 coalesce·5 지각 경계 + M10·M11·M13·M18·M19 red | delete/reject/stale fetch → store / EP-03·04 9/9 |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | **PASS** | 4 이탈 경로에서 navigate 0, 대상 페이지에서만 replace + M6 red | 삭제 완료 → 현재 URL → navigate / EP-05 1/1 |
| VP-06 | R-06 ↔ AT-06 / AT | REQUIRED | **PASS** | 한 notification에서 `recentIds`·`projectSessionIds.a` 동시 반영, `splitNavSections` 결과가 같은 entity 참조 | refresh → store → Nav/panel / EP-06 2/2 |
| VP-07 | R-07 ↔ AT-07 / AT | REQUIRED | **PASS** | 양방향 deferred 순서 4케이스, 미조회 ≠ 빈 목록, 무변경 참조 보존 | 지각 loadProject → merge → Nav / EP-06 2/2 |
| VP-08 | R-08 ↔ AT-08 / AT | REQUIRED | **PASS** | 동일 catalog 교체 2회에도 `getActiveChatSession()` 참조 동일·navigate 1회 + M8 red | 승격 → catalog 변경 → route effects / EP-07 2/2 |
| VP-09 | R-09 ↔ AT-09 / AT | REQUIRED | **PASS** | A→B·`/new` 실제 진입, 지각 cwd 뒤 사용자 선택 유지, fork/handoff 원본 전환 | 실제 URL 이동/hydration → draft / EP-07 2/2 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair와 직접 판정 범위: `useProjectDeletion.test.ts`가 VP-05·VP-11을 함께 닫는다 — VP-05는 4 이탈 경로의 navigate 0, VP-11은 확인→IPC→4 미러 연속 수명주기로 범위가 다르다.
- 이번 라운드 실행 범위: **최초 검증** — 유효 V1의 REQUIRED 16 pair 전건 + 현재 변경 운영 gate 전건 실행.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 폴더 아이콘 → 제목, 라벨 없음, 클릭은 실제 cwd | ✅ | `ChatTitleBar.layout.test.ts` — folder index < title index, `>example</span>` 부재, `openPath({path, mode:'directory'})` | `ChatTitleBar.tsx:126` |
| AT-02 / AC2 | 3표면 확인창 → 정확한 ID 삭제, 열기 동반 없음 | ✅ | `projectDeletionWiring.test.ts` 3케이스 — `stopPropagation` 1회, `openProject` 0회, 확인 전 `delete` 0회 | `useSidebarSlots.tsx:33·:73`, `router.tsx:39` |
| AT-03 / AC3 | 프로젝트·membership 제거, 대화 보존 | ✅ | `chatStore.projectDeletion.test.ts` — `messages`·`live` 동일 참조, `activeKey` 유지 | 4 store 미러 |
| AT-04 / AC4 | 실패·중복·지각 응답에서 보존/복귀 차단 | ✅ | `useProjectDeletion.test.ts` reject 케이스 + `sessionsStore.projectMembership.test.ts` 지각 경계 | 5 수신 경계 |
| AT-05 / AC5 | 대상 페이지만 `/projects` replace | ✅ | 4 이탈 경로(`/chat/s1`·`/projects/p2`·`/new`·`/projects`) navigate 0 | `useProjectDeletion.ts` 완료 continuation |
| AT-06 / AC6 | 최근 반영 순간 프로젝트에도 반영 | ✅ | `projectSessionIds.a === ['new','old']` + `splitNavSections`가 `byId.new` 동일 참조 | `initSessions` |
| AT-07 / AC7 | 지각 프로젝트 조회가 새 대화를 제거하지 않음 | ✅ | `recentRevision` 보호 케이스 + 미조회/빈 목록 구분 케이스 | `loadProject` |
| AT-08 / AC8 | 승격·catalog 재조회 겹쳐도 본문 보존·replace 1회 | ✅ | 동일 세션 객체 참조 + `navigate` 1회 단언 | `useChatRouteSync` 양 방향 |
| AT-09 / AC9 | 실제 이동은 정상 초안, 지각 승격은 화면 유지 | ✅ | A→B·`/new`·`/projects`·`/chat/s` 4전이 + fork/handoff 2케이스 | `useChatRouteSync` 방향 1 |

- **합계 재측정**: `✅ 9 · ⚠️ 0 · ❌ 0 = 총 9`(§7 R-01~09를 직접 세었다) · 자기보고 `9/9` · **일치**.
- **합계 사본 대조**: 본문 9 ↔ 커밋 trailer `Criteria-Met: 9/9` ↔ INDEX 비고 `AC ✅9/9` — **일치**.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01 | `iconOnly` 기본 false·실제 cwd 클릭 | EP-01 (2) | `rg '<CwdButton'` → `ChatTitleBar.tsx:126`(iconOnly)·`CwdPanel.tsx:36`(라벨 유지) = **2/2** | PASS |
| VP-02·11·12 | 삭제 callback은 app 소유 | EP-02 (3) | `useSidebarSlots.tsx:33`·`:73`·`router.tsx:39→ProjectLandingPage.tsx:89` = **3/3** | PASS |
| VP-03·04·11·12·16 | 프로젝트 삭제 ≠ 세션 삭제 | EP-03 (4 소유자) | `useProjectDeletion.ts`의 `projectsActions.remove`·`sessionsActions.detachProject`·`chatActions.detachProject`·`projectNavActions.remove` = **4/4** | PASS |
| VP-04·11·16 | 성공 뒤 지각 응답이 삭제를 되돌리지 않음 | EP-04 (5) | `projectsStore.initProjects`(M10)·`sessionsStore.initSessions`(M18)·`loadProject`(M19)·chat load(M11)·chat `session.updated`(M11) = **5/5** | PASS |
| VP-05·11·12 | 완료 시 현재 URL 기준 | EP-05 (1) | `useProjectDeletion.ts` 완료 continuation의 `window.location.pathname` 재독 = **1/1** | PASS |
| VP-06·07·10·13·14 | 같은 membership 규칙 | EP-06 (2) | `initSessions`·`loadProject`가 같은 `reconcileProjectMembership`을 호출 = **2/2** | PASS |
| VP-08·09·10·15 | 실제 진입과 승격 구분 | EP-07 (2) | 방향 1 `entered` 가드(M8 red)·방향 2 `navigate`(M23 red) = **2/2** | PASS |
| — | 작업 상태의 사본 | OP-01 (2) | plan 메타(작성자 Codex·상태 V1)·INDEX 상태/다음 주체 = **2/2**. 대상 커밋 칸은 별건 → D2 | PASS |

- 제품 강제 지점 독립 재열거 **19/19**(2+3+4+5+1+2+2), 문서 사본 **2/2** — 자기보고와 일치.
- 표에 없는데 같은 불변식이 필요한 지점: `chatStore.freshEntry`의 삭제 소속 차단 1곳. EP-03·EP-04가 열거한 9지점 밖이고 AC3·AC4가 요구하지 않는다 → **NON_BLOCKING** (D3).
- `실패 의미`가 “다른 게이트가 막는다”고 적은 행: 없음 — 7개 EP 모두 자기 실패 의미를 갖는다.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| Renderer 정적 | `app/src/renderer/**` 수정 | **PASS** | `npm run typecheck` 3구성 실행·error 0; `npm run lint` error 0 · warning 1(`useTranscriptVirtualizer`, 이번 변경 밖) |
| 관련 시험 | state·routing·삭제 동작 | **PASS** | 대상 18파일 **115케이스** 전건 green |
| 전체 회귀 | 공유 store 변경 | **PASS** | `vitest run` 526파일 통과·1 skip, **4853케이스 통과·3 skip** |
| 스크립트 | 문서·마이그레이션 위생 | **PASS** | `node --test scripts/*.test.mjs` → **119 pass · 0 fail** |
| 문서 | `docs/arch/**` 3파일 수정 | **PASS** | `check-doc-inventory --check` generated/prose/links ok; `git diff --check e837976 9de8dd3` exit 0 |
| 메시지 버스 | 설계·구현 커밋 분리, INDEX | **PASS** | trailer 2건 실제 파싱(§11), 설계/구현 커밋 분리 확인 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| i18n `projects.delete*` 3키 | `en: typeof ko`가 typecheck로 강제 — 3키 양쪽 존재 | `deleteDialogMessage`가 `{{name}}` 보간을 받고 확인창 본문에 프로젝트 이름이 실제로 실린다(`request.message` 단언) | PASS |
| `project:delete` IPC | 기존 `DeleteProjectSchema` 재사용, 변경 0 | `ON DELETE SET NULL`(`project.ts:62-64`)로 세션 보존 — D-006과 일치 | PASS(무변경) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `<CwdButton` 실제 사용 재측정: **2**(plan §8 전수 조사와 일치).
- 삭제 배선 표면 재측정: **3**(`onDeleteProject` 주입 지점 grep).
- §10 내역 합 = 총계: 2+3+4+5+1+2+2 = **19** = plan이 적은 19 ✅.
- pair 분모 합산 검산: VP-04 9 · VP-11 13 · VP-12 8 — 참조 EP 합과 일치, 중복 EP 이중 계상 0.
- 0건 게이트: 이번 라운드에 신설된 0건/전수 스윕 **0개** — 판정 기준 엄격화 대상 없음.
- 상한: `reconcileProjectMembership`은 `Object.entries(current)`(조회된 버킷만) 순회라 미조회 프로젝트를 만들지 않는다. recent 상한은 `listSessions(limit = 50)`(`queries.ts:409`).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 제목 행 배치 | 실제 요소 트리 순서·aria-label·tooltip·클릭 핸들러 | 화이트/다크 두 테마의 시각 정합(간격·아이콘 크기) | 앱 실행 → `/chat/<id>` → 테마 토글 |
| 프로젝트 삭제 메뉴 | 3표면 callback·확인 문구·IPC·4 미러·라우팅 | 케밥 팝오버의 실제 열림/포커스 | Nav 프로젝트 행·`/projects/:id` 케밥 클릭 |
| 첫 전송 깜빡임(D-004) | store·hook 결정 — 본문 동일 참조·navigate 1회 | **Electron 실제 프레임에서 '뒤로가기' 현상 부재** | 프로젝트 landing → 첫 메시지 전송 관찰 |

- `app/src/renderer/AGENTS.md`가 “UI 자체는 시각 검증으로 갈음한다(자동화된 시각 회귀 없음)”로 정하고, 저장소에 playwright·시각 회귀 하네스가 없다(`package.json`에 playwright 0건).
- 그래서 넘긴 것은 **프레임·픽셀뿐**이다. 순수 상태·순서·라우팅·삭제 실패는 전부 기계 검증했다.

## 9. 게이트 재실행

- 실제 실행 명령:
  - `cd app && npm run typecheck` · `npm run lint`
  - `./node_modules/.bin/vitest run <18 대상 스위트>` · `./node_modules/.bin/vitest run`
  - `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check`
  - `git diff --check e837976 9de8dd3`
- **관측한 실행 산출**(exit code 아님): typecheck 3구성 각각 실행·error 0 · lint `1 problem (0 errors, 1 warning)` · 대상 18파일 115케이스 · 전체 526파일 4853케이스 · scripts `# pass 119 / # fail 0` · doc-inventory `generated/prose/links ok`.
  - 리포터 오류로 아무것도 실행되지 않는 경우를 먼저 배제했다 — `--reporter=basic`은 모듈 해석 실패로 종료했고 기본 리포터로 다시 돌려 파일·케이스 수를 관측했다.
- `npm test`를 썼는가: 아니오. DB 동작 검증이 필요 없는 renderer 전용 변경이라 `pretest`를 우회했다(`app/AGENTS.md` 지침).
- ABI/환경 기인 실패 분리: 첫 전체 실행에서 **29파일 red**, 전부 `src/main/**`의 DB 인스턴스화 스위트이고 서명은 `Module did not self-register: .../better_sqlite3.node`(npm ci `postinstall`이 Electron ABI로 맞춘 결과). `npm rebuild better-sqlite3`(Node ABI) 뒤 **동일 트리에서 0 red** — 변경 무관임이 재측정으로 확인됐다.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint`는 `--fix`지만 실행 후 `git status --porcelain`이 **빈 출력**이다 — 검증자 실행분이 대상에 섞이지 않았다.
- **검증 중 실행한 명령이 남긴 잔여물**: `app/node_modules`(세션 설치분)와 Node-ABI로 재빌드된 `better_sqlite3.node`. 둘 다 `.gitignore` 대상이라 추적 트리에 남지 않았다(`git status` 빈 출력 확인).
- 검증 시점 주의: 작업 트리 HEAD는 `66f73a4`(0234·0235 뒤)다. `git diff --name-only 9de8dd3 HEAD`와 0233 변경 파일의 교집합은 `docs/handoff/INDEX.md` 하나뿐이라 **0233의 app 파일은 구현 커밋과 바이트 동일**하며, 게이트·변이 측정이 그대로 이번 변경에 귀속된다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | PASS |
| AC ↔ production path | 9행 1:1 대조 | — | ✅9/9 |
| 레이어/계약/문서 링크 | boundaries lint·doc-inventory | — | PASS |
| AGENTS 위생 | 이번 변경에 AGENTS 수정 없음 | — | 해당 없음 |
| 제품 의도 / Open Question | 남은 결정 0(plan §4) | — | 해당 없음 |
| UI 시각 품질 | 요소 순서·속성까지 | **두 테마 시각·첫 전송 프레임** | 사람 대기 |
| 신규 의존성 / PR merge | 신규 의존성 0 | **승인** | 사람 몫 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 이번 변경에 `AGENTS.md` 수정 **0건**(`git diff --name-only e837976 9de8dd3 | grep AGENTS` 빈 출력) → 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: 검증 전 `impl/IMPL_DONE`·`Claude(검증)`가 실제 상태와 맞았다. 이번 턴에 `verify/PASS`로 갱신.
- 「다음 주체」 칸이 주체 하나만 담는가: 예 — 검증 전 `Claude (검증)`, 갱신 후 `사람 (실기 1건)`.
- 대상 커밋 좌표 기입: 설계 `b33ebf1d`는 **미실재**(`git cat-file -t` → `fatal: Not a valid object name`). 실제 설계 커밋 `e837976`, 구현 커밋 `9de8dd3`으로 교정했다(둘 다 `git cat-file -t` → `commit`) → D2.
- 비고 5줄 이내: 이번 턴 갱신분을 5줄 이내로 다시 썼다.
- PASS 시 archive 이동: **보류** — 남은 사람 실기 1건(§8) 뒤로 미룬다(0228·0229·0232 선례).

### Commit / reference 정합성

- trailer 허용값: `e837976` = `Agent: codex`·`Handoff`·`Status: designed` (설계 커밋에 `Criteria-*`·`Next-Action` 없음 ✅). `9de8dd3` = `Agent: codex`·`Status: implemented`·`Criteria-Met: 9/9`·`Verified-By: pending` ✅.
- trailer 실제 파싱: `git log -1 --format='%(trailers:only=true)'`가 두 커밋에서 적힌 키를 그대로 반환(3키·5키). 파싱 0건 아님.
- 인용된 커밋 해시 실재: `9de8dd3` ✅ · `b33ebf1d` ❌(D2).
- `[구현자 기입]` 필드 전수: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals = **7/7** 존재, 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script: 없음. `diagnose.mjs`는 plan §8이 계속 인용한다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| “render 중 ref 갱신이 hooks lint에 막혀 `window.location.pathname` 직독으로 대체” | **타당 + 대체물 실패 모드 재유도 완료** | 만료 축 = snapshot 없음 → M6으로 재측정(red). 공유 축 = `BrowserRouter`(`App.tsx:13`) 확인 — `HashRouter`였다면 pathname이 비게 되므로 실제로 확인이 필요한 축이었다 |
| “원인은 세션 삭제가 아니라 같은 pathname의 catalog 갱신” | 타당 | M8이 옛 동작을 복원하자 AC8 2케이스가 red — 진단이 원인을 짚었다 |
| “삭제 tombstone은 renderer 모듈 수명 동안 보관” | 타당 | 4 store 각자 module-level `Set`. 다른 UUID 신규 프로젝트는 통과함을 M10 대상 케이스가 단언 |
| “선택 증거 3 · 인용 변이 0 · 새 oracle 0 = 잠금 표 3” | 검산 일치 | 등록 변이 3건을 검증자가 독립 재현해 3/3 red |
| “범위 밖 세션 삭제의 선행 캐시 정리는 별도 후보” | 타당 | plan §6 ‘별도 발견’과 같은 항목. 이번 PASS 범위 밖으로 유지 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `useSessionActions.onOpenProject`(`useSessionActions.ts:13·36`)가 D-001의 breadcrumb 제거 뒤 소비처 0 — 두 page가 `{...sessionActions}`로 넘기지만 `ChatView`/`ChatTile` props에서 삭제됨 | 비귀속(AC·§10·Decision 어디도 제거를 요구하지 않음) | NON_BLOCKING | — | 다음 렌더러 정리 때 제거 |
| D2 | INDEX 설계 좌표 `b33ebf1d`가 공유 브랜치에 미실재 — 구현자/설계자 환경의 로컬 해시 | OP-01 문서 사본 | NON_BLOCKING | — | **이번 턴에 `e837976`로 교정 완료** |
| D3 | `chatStore.freshEntry`의 `withoutDeletedProject` 감싸기를 지워도 전 스위트 green(M12) | 비귀속 — §10 EP-03·04의 9지점 밖 방어 코드 | NON_BLOCKING | — | 기록만. 도달 경로(`/projects/<삭제된 id>`)는 `ProjectLandingPage.tsx:53`이 Composer를 막는다 |
| D4 | `useChatRouteSync` 방향 2의 armed 게이트를 경로 바인딩·snapshot 일치·게이트 전체 세 방향으로 지워도 renderer 240파일 1740케이스 green(M20·M21·M22) | 비귀속 — EP-07 ②의 계약(`navigate` 1회)은 M23으로 잠김 | NON_BLOCKING | — | 방향 1의 `entered` 정규화가 먼저 돌아 도달 상태에서 등가로 보인다. 단순화 후보 |
| D5 | `docs/arch/frontend/state.md:175` 오타 “멱든하게” → “멱등하게” | 문서 gate 밖(맞춤법은 doc-inventory가 보지 않음) | NON_BLOCKING | — | 다음 문서 수정 때 정정 |
| D6 | `docs/arch/frontend/layers.md:41`이 `useSessionHandlers`의 `projectNameById`를 적지만 코드에 그 심볼이 없다(`rg` 0건) | 이번 변경 밖 — 해당 줄은 diff 미변경 | NON_BLOCKING | — | 기존 드리프트. 별도 문서 정리 후보 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음 — r1 최초 검증이다.
- 관련 plan 지침/AC의 존재 여부: D1~D6 중 어느 것도 AC·§10·ACTIVE Decision이 요구한 계약을 건드리지 않는다. D3·D4는 plan이 열거하지 않은 방어 코드다.
- 사용자 결정 변경 근거: 없음 — SUPERSEDED 0건, ACTIVE 6건 전부 구현과 일치한다.
- 반복된 검증 환경 한계: better-sqlite3 ABI가 `npm ci` 뒤 Electron으로 맞춰져 첫 전체 실행에서 main DB 스위트 29파일이 red였다. `npm rebuild better-sqlite3` 1회로 해소돼 이번 라운드는 환경 한계로 남지 않았다.

## 15. 결론

- 상태: **PASS**(기계 범위). 남은 사람 실기 1건은 §8의 Electron 첫 전송 프레임·두 테마 시각이다.
- pair 결과: REQUIRED **16/16 PASS** · root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.
- PLAN_GAP: 없음.
- Product/UX 및 ACTIVE Decision 충족: D-001~006 전건 충족, SUPERSEDE 0.
- AC 충족: **✅9 · ⚠️0 · ❌0 = 총 9**. 본문·trailer·INDEX 세 사본 일치.
- 현재 변경 운영 gate: 6종 PASS. 변이 **23건 실행 — 19 red · 4 green**(등록 3건은 전건 red).
- NON_BLOCKING: 6건(D1~D6). NEXT_HANDOFF: 없음.
- repository operation checks: trailer 2건 파싱 확인, `[구현자 기입]` 7/7, INDEX 좌표 교정(D2).
- 다음 단계: 사람이 실제 앱에서 §8의 3행을 확인한 뒤 archive로 이동한다.
