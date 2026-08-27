# Verify — left-nav-section-layout

> **판정: `RETURN_TO_PLAN`.** 코드는 요구 6개를 전부 만족하고 게이트도 통과한다. 막는 것은 구현이 아니라 **증거 계층** 이다 — 사용자 관측 요구(R)를 규칙 단위 테스트(UT)가 닫고 있고, `NEW` 왼쪽 노드 3개에 pair 가 없다. 구현자가 새 계약을 발명하지 않고는 닫을 수 없다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0203-left-nav-section-layout` |
| 검증자 | Claude Code |
| 일자 | 2026-08-27 |
| 대상 커밋/range | `cc4cde5..df35f2c` — 구현 `4bb0948`·`b88ea27`·`33ec6ef`·`c700595`·`e3395ea`, 설계 `108a5c4`, 구현 보고 `df35f2c` |
| 구현 전 plan 기준 | **없음** — plan(`108a5c4`)이 구현 5커밋보다 나중이다 |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `108a5c4:V1` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 모두 Claude.** 그래서 §0 의 diff 잠금과 §4 의 재측정을 실제로 다시 돌렸다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **예 — `df35f2c` 한 hunk(`@@ -472,51 +472,112 @@`)**. 전부 `[구현자 기입]`(475행~) 안이다.
- **기준선이 diff로 성립하는가**: **부분.** 설계 커밋과 구현 보고 커밋은 갈려 있어 `df35f2c` 의 규범 행 변경은 diff 로 확인 가능하다. 그러나 **코드 5커밋은 plan 보다 먼저 도착**해 그 구간의 기준선은 diff 로 성립하지 않는다 — 채점 기준은 `108a5c4:V1` 원문으로 고정했다.
- Decision Ledger 변경: **없음.** §3 은 53행, hunk 는 472행부터다.
- Product/UX Contract 변경: **없음.** 같은 근거.
- AC 변경: **없음.** §7 은 135행.
- V node/pair·§10·oracle 변경: **없음.** §7-A 159행 · §10 314행.
- 기계 대조: `108a5c4` 와 `HEAD` 의 plan.md **1~474행 diff 0줄** — 구현 커밋이 채점 기준을 건드리지 않았다.
- 채점에 사용할 원 기준: `108a5c4:V1` 의 D-001~D-011 · AT-01~AT-12 · VP-01~VP-12 · EP-1~EP-8.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 선행 0129 는 구 템플릿이라 상속할 V node 0 — Baseline 이 맞다 |
| **NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair** | **PLAN_GAP (G2)** | NEW 왼쪽 노드 13 ↔ pair 가 잠근 왼쪽 노드 10. **차집합 3: `MD-01` · `MD-02` · `R-07`** |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | Baseline 이라 INHERITED node 0 — 대상 없음 |
| **pair별 path·§10 전수·직접 oracle** | **PLAN_GAP (G1)** | VP-05·06·07 이 oracle 을 "직접 행동 결과 관측"으로 등록했으나 그 oracle 은 `placementOf` 의 반환값만 본다 — §4 M1 이 반증 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-03·VP-04 만 선택했고 둘 다 이유·변이가 적혀 있다 |
| **현재 변경 산출물의 운영 gate·범위** | **PLAN_GAP (G3)** | AT-02 의 유일한 oracle 이 사람 실기다. 대상은 `filter + sort` 순수 파생이라 `handoff-verify §5`("목록 포함 여부·상태 파생은 순수 테스트 대상")와 충돌 |

- root PLAN_GAP: **G2** — pair 누락이 뿌리다. G1 은 그 결과다(MD 레벨에 자기 행이 없으니 그 증거가 R 레벨 AC 를 닫는 데 승격됐다). G3 은 같은 축의 반대 방향(순수 로직이 아래로 안 내려갔다).
- 영향 pair: `VP-05` · `VP-06` · `VP-07` · `VP-08`(G1) · `VP-02` · `VP-04`(G3) · `VP-11`(R-07 무 pair, G2).

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path — 이번 라운드 관측 |
|---|---|---|
| D-001 4구획 | 메뉴·프로젝트·고정됨·최근 대화 | `Sidebar.tsx:131`(nav) → `:155`(projectsSlot) → `:156`(pinnedSlot) → `:157-158`(recents) ✔ |
| D-002 고정 프로젝트만 | 고정된 것만 최근 고정 순 | `useSessionHandlers.ts:73-74` `filter(pinnedAt != null)` + 내림차순 ✔ |
| D-003 + 버튼 금지 | 헤더에 추가 액션 0 | 엄격 전수(§7): 두 구획 헤더의 상호작용 요소 **1개 = 접기 토글** ✔ |
| D-004 프로젝트 고정 목적지 | "고정됨"에 안 들어간다 | `PinnedSection.tsx` 의 `Project` 참조 **0건** ✔ |
| D-005 대화 고정 = 이동 | 원래 구획에서 사라진다 | EP-1·EP-2·EP-3 세 필터 실재 ✔ — 다만 회귀 보호는 없다(G1) |
| D-006 배치 우선순위 단일 함수 | 세 구획이 한 술어를 공유 | `sessionPlacement.ts:13` if/else 사슬 · 소비 3지점 ✔ |
| D-007 `/projects` 정확 일치 | 상세에서 상단 메뉴 꺼짐 | `navItems.ts:17` `p === '/projects'` ✔ · 형제 술어 0건(§7) |
| D-008 빈 헤더 유지 | 항목 0에도 헤더 | `CollapsibleSection` 이 무조건 헤더 렌더 ✔ — 시각 확인은 사람 몫 |
| D-009 하위 행 kebab 3항목 | 고정·이름변경·삭제 | `PinnedProjectsSection.tsx:190-199` 세 핸들러 전달 ✔ |
| D-010 랜딩 패널 비범위 | 배치 규칙 미적용 | `ProjectSessionsPanel.tsx:58` 필터 없음 — 의도대로 ✔ |
| D-011 엔티티 단일 정본 | 모든 목록이 같은 엔티티 | `sessionsStore.ts:57` `patchSession` 단일 · 호출 3 ✔ |

### end-to-end 흐름

```text
SessionRow kebab 고정
  → sessionsActions.setPinned → sessionApi.setPinned(IPC) → main sessions.pinned_at
  → patchSession(byId[id].pinnedAt) — 엔티티 1건 제자리 패치
  → PinnedSection(isPinnedSession) ∪ PinnedProjectsSection(!isPinnedSession) ∪ SessionList(placementOf==='recent')
  → 정확히 한 구획에 렌더
  ↘ IPC 실패 → 패치 없음 → 행이 원래 자리 유지(무음)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ⚠️ | 프로젝트 하위 조회 실패가 빈 membership 으로 확정돼(`sessionsStore.ts:144-148`) 화면에 `sessions.empty` 로 보인다 → D2 |
| false success 가능성 | 없음 | `setPinned` 은 `await sessionApi.setPinned` 이후에만 패치한다(`:121-122`) — 삼키는 하위 호출 없음 |
| partial failure/rollback | 해당 없음 | 모든 mutation 이 main DB 한 곳을 쓴다. renderer store 는 캐시다 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 요구 6개 ↔ D-001~D-007 ↔ 코드가 1:1 (위 표) |
| 증상만 제거하고 상태가 남았는가 | 아니오 | 중복 노출의 원인(무필터 렌더)을 제거했고 배치 규칙이 그 자리를 대신한다 |
| 최적화가 잃은 재검증 관측 | ⚠️ **예** | 전체 재조회 → 제자리 패치로 바꾸며 `projectSessionIds` 재검증을 잃었다 → plan §17 R-1 재현 확인(D3) |
| 출력/요청 worst-case 상한 | 정상 | 프로젝트 조회는 **펼친 행에만** 발생(`PinnedProjectRow` `useState(false)`) — 부팅 시 추가 요청 0 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh cc4cde5..HEAD   # 19파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `SIDEBAR_DEFAULT_WIDTH`·`MIN`·`MAX` 미사용 export | **비귀속** | `cc4cde5` 시점에 이미 5회 등장 — 이번 변경이 만든 것이 아니다. MIN/MAX 는 파일 내부 `useDragResize` 가 쓴다 |
| `SessionPlacement` 타입 test-only | 정상 | `placementOf` 의 반환 타입 — 프로덕션은 이름을 부르지 않고 추론한다 |
| `useSessionsStore` 프로덕션 참조 0 | 정상 | 같은 파일 `:162` 가 `useSessionsState` 로 감싼다 — 스크립트가 파일 내부 참조를 세지 않는다 |
| 형제 파일 정책 비대칭 | 없음 | 스크립트 §3 `(없음)` |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `projectSessionIds` 가 `initSessions` GC 루트에 포함(`:74`) — 턴 종료 refresh 가 프로젝트 엔티티를 지우지 않는다 |
| producer ↔ consumer 파생 불일치 | 없음 | `pinnedProjects` 와 `pinnedProjectIds` 가 같은 `useMemo` 사슬(`:70-78`)에서 나온다 |
| 동일 규칙 중복 구현 | SSOT 유지 | `rg "pinnedAt"` 프로덕션 9건 중 **세션 배치는 `sessionPlacement.ts:21` 하나**. 나머지는 프로젝트 고정 3·정렬 2·쓰기 1·draft 합성 1·활성 세션 1 |
| `/projects` 활성 술어 형제 | 없음 | `rg "'/projects'"` → `navItems.ts` 2 · 테스트 2 · `routes.ts:20`(breadcrumb) · `ProjectLandingHeader` 뒤로가기 1. **활성 판정은 1곳** |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 케이스 실제 존재: **전건.** `sessionPlacement.test.ts` `it` 5 · `sessionsStore.test.ts` `it` 2 · `navItems.test.ts` `it` 2(구현자가 1건 신설).
- 핵심 입력/분기 실제 실행: `placementOf` 6조합 전수 배열 비교가 세 분기를 모두 지난다.
- **structural proxy 만으로 semantic 목표를 통과시킨 AC: 있다 — AC5·AC6·AC7.** 목표는 "구획에서 사라진다"(사용자 관측)인데 단언은 `placementOf(...) === 'pinned'`(규칙 반환값)다 → G1.
- **선택된 적대 증거 재측정** — 검증자가 구현자 보고와 무관하게 다시 실행: **5건 중 검출 4 · 미검출 1 · 일반 hunk 자동 확장 0.**

| 재측정 변이 | 구현자 보고 | 검증자 재측정 | 판정 |
|---|---|---|---|
| M1 `PinnedSection.tsx:34` 필터 + 잔여 import 소거 | 잠금 없음 | **renderer 61파일 478케이스 전건 통과 · typecheck `error TS` 0 · eslint 0 error** | 일치 — 더 밀어도 초록 |
| M2 섹션 헤더 토글 제거 | 양성 1→0 | 양성 `1 → 0` | 일치 |
| M3 헤더에 + 버튼 추가 | 음성 0→1 | 음성 `0 → 1` | 일치 |
| M4 `PinnedSection` 에 `Project` 복귀 | EP-5 0→2 | EP-5 `0 → 2` | 일치 |
| M5 `navItems.ts:17` → `startsWith` | 1건 실패 | `Tests 1 failed | 1 passed (2)` | 일치 |

- 동작 보존 추출 라운드인가: 아니오 — M1~M5 는 전부 동작을 바꾸는 변이라 초록/빨강이 판정 근거가 된다.
- **소거 변이의 잔여물 수렴**: M1 을 **2단계**까지 밀었다 — 1단계(필터만 제거)는 `TS6133`(unused import)이 걸리지만 그것은 잠금이 아니라 치우면 사라지는 부산물이고, 2단계(import 제거) 후 세 게이트가 전부 침묵한다. **그 상태로 판정한다.**
- `N회` 기준: 이 handoff 에 총량/횟수 AC 없음.
- 순서 기준: 렌더 순서(AC1)뿐이고 관측 훅이 없다 — §8 사람 실기.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-12 | MD-03 ↔ UT-03 / UT | REQUIRED | **PASS** | `sessionsStore.test.ts` 2케이스 통과, `vi.mock` 은 IPC 만 — store 는 실물 | `loadProject/rename → mergeItems/patchSession → byId` / EP-6·EP-7 (2/2) |
| — | MD-01 ↔ UT-01 / UT | **pair 없음** | **PLAN_GAP:G2** | 테스트는 존재(5케이스 통과)하나 잠글 pair 행이 없다 | — |
| — | MD-02 ↔ UT-02 / UT | **pair 없음** | **PLAN_GAP:G2** | 신설 케이스 통과 + M5 검출 | — |
| VP-10 | AR-01 ↔ IT-01 / IT | REQUIRED | **미판정 — 사람 실기** | 구조 절반: 4슬롯 배선 확인 | `useSessionHandlers → useSidebarSlots → Sidebar` / EP-4·EP-5·EP-8 (3/3) |
| VP-11 | AR-02 ↔ IT-02 / IT | REQUIRED | **미판정 — 사람 실기** | AC11 순수 2케이스 통과, AC12 는 IPC+DB | `IPC → byId ← 4 nav 렌더 + 랜딩` / EP-6·EP-7 (2/2) |
| VP-09 | SD-01 ↔ ST-01 / ST | REQUIRED | **미판정 — 사람 실기** | §5 전이표 7행 중 배치 4행은 규칙 수준으로 참, 3행은 실기 | EP-1~EP-3 (3/3) |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **미판정 — 사람 실기** | DOM 마커 4개 순서(구조) | / 0 |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | **PLAN_GAP:G3** | 순수 파생인데 oracle 이 실기뿐 | / 0 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | **PASS** | 음성 0 · 양성 1 · 엄격 전수 차집합 0 | / EP-8 (1/1) · M2·M3 양방향 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | **미판정 — 사람 실기** | "고정됨에 안 나온다" 절반은 M4 로 닫힘 | / EP-5 (1/1) |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | **PLAN_GAP:G1** | oracle 이 규칙 반환값만 본다 — M1 이 반증 | / EP-1~EP-3 (3/3, 직접 관측) |
| VP-06 | R-05 ↔ AT-06 / AT | REQUIRED | **PLAN_GAP:G1** | 동일 | / EP-1~EP-3 (3/3) |
| VP-07 | R-05 ↔ AT-07 / AT | REQUIRED | **PLAN_GAP:G1** | 동일 | / EP-1~EP-3 (3/3) |
| VP-08 | R-06 ↔ AT-08 / AT | REQUIRED | **PASS** | 신설 케이스 + M5 검출. 술어가 순수라 R 레벨에서도 직접 관측된다 | `행 클릭 → navigate → SIDEBAR_NAV[1].isActive` / EP-4 (1/1) |

- root `PAIR_FAIL`: **없음** — 구현 결함으로 실패한 pair 는 0건이다.
- 종속 `BLOCKED_BY`: 없음.
- **결과 어휘 주석**: `PASS`·`PAIR_FAIL`·`BLOCKED_BY`·`NOT_REQUIRED` 에는 "oracle 이 계약을 닫지 못한다"와 "사람 실기 미수행"에 해당하는 상태가 없다. 결함으로 부풀리지 않기 위해 전자는 `PLAN_GAP:<id>`, 후자는 `미판정 — 사람 실기`로 적었다.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED 12 pair 전건 + 운영 gate 4종.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 4구획이 이 순서로 | ⚠️ | 사람 실기 — 구조는 `Sidebar.tsx:131·155·156·157` | 확장 렌더 |
| AT-02 / AC2 | 고정 프로젝트만 최근 고정 순 | ⚠️ | **G3** — 순수 파생인데 oracle 이 실기뿐 | `useSessionHandlers:70-78` |
| AT-03 / AC3 | 헤더에 + 버튼 없음 | ✅ | 음성 0 · 양성 1 · **엄격 전수 차집합 0** · M2·M3 | 위와 같음 |
| AT-04 / AC4 | 프로젝트는 프로젝트 구획에만 | ⚠️ | 절반 ✅(`Project` 0건 + M4), 절반 실기 | `projectsStore → pinnedProjects` |
| AT-05 / AC5 | 고정 = 이동 | ⚠️ | **G1** — 규칙은 참, 배선 회귀 미보호 | `kebab → setPinned → 재판정` |
| AT-06 / AC6 | 중복 0 · 전수 배치 | ⚠️ | **G1** — 6조합 통과하나 같은 한계 | 위와 같음 |
| AT-07 / AC7 | 해제 시 원위치 복귀 | ⚠️ | **G1** — 동일 | 위와 같음 |
| AT-08 / AC8 | 상세에서 상단 메뉴 꺼짐 | ✅ | 신설 케이스 통과 + M5 검출 | `navigate → isActive` |
| AT-09 / AC9 | 접힘 · 빈 헤더 유지 | ⚠️ | 사람 실기 | `CollapsibleSection` |
| AT-10 / AC10 | 하위 행 kebab 3항목 | ⚠️ | 사람 실기 — 구조는 세 핸들러 전달 | `PinnedProjectsSection:190-199` |
| AT-11 / AC11 | mutation 이 모든 목록에 반영 | ✅ | `sessionsStore.test.ts` 2케이스 | `patchSession → 구독자` |
| AT-12 / AC12 | 랜딩 삭제/이름변경이 DB 에 | ⚠️ | 사람 실기 — 배선은 `ProjectLandingPage.tsx:86-87` | `useSessionActions → IPC` |

- **합계 재측정**: `✅ 4 · ⚠️ 8 · ❌ 0 = 총 12`. 분모는 §7 표의 AT 행을 다시 세어 12.
- **자기보고와 불일치**: 구현자는 `✅ 6 · ⚠️ 6`. 차이 2건은 **AC5·AC6**(구현자 ✅ ↔ 검증자 ⚠️) — 구현자는 순수 테스트 통과를 ✅ 로 셌고, 검증자는 그 oracle 이 AC 의 동작 기준을 닫지 않는다고 판정했다(G1). AC7 은 구현자도 ✅ 였으나 같은 이유로 ⚠️ 로 내렸다 — 실제 차이는 **3건**(AC5·AC6·AC7)이고 구현자가 ⚠️ 로 둔 AC4 를 검증자도 ⚠️ 로 유지해 순증은 2다.
- **합계 사본 대조**: 본문 `6/12` ↔ 커밋 trailer `Criteria-Met: 6/12` ↔ INDEX 비고 `✅6 · ⚠️6` — **자기보고 3사본은 일치**. 검증 결과 `4/12` 로 정정하며 INDEX 를 이번 커밋에서 갱신한다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-05·06·07·09 | 한 대화는 한 구획 | `EP-1`·`EP-2`·`EP-3` (3) | 3/3 — `PinnedSection.tsx:34` · `PinnedProjectsSection.tsx:179` · `SessionList.tsx:62` | 지점 PASS · oracle PLAN_GAP |
| VP-08 | `/projects` 정확 일치 | `EP-4` (1) | 1/1 — `navItems.ts:17`. 형제 술어 전수 0 | PASS |
| VP-04 | 고정됨은 프로젝트 미포함 | `EP-5` (1) | 1/1 — `Project` 0건 | PASS |
| VP-11·12 | 엔티티 1건 패치 | `EP-6` (1) | 1/1 — 정의 1 · 호출 3(`:116`·`:122`·`:158`) | PASS |
| VP-11 | GC 루트 포함 | `EP-7` (1) | 1/1 — `:74` | PASS |
| VP-03·10 | 헤더 컨트롤 1개 | `EP-8` (1) | 1/1 — `:36` | PASS |

- **전수 8/8 재측정 일치.** 완결성은 차집합으로 잰다 — nav 의 `SessionRow` 소스 배열 5(`PinnedSection:45`·`PinnedProjectsSection:189`·`SessionList:74`·`SessionList:85`·`ProjectSessionsPanel:58`) − 배치 술어 통과 3 = **2**, 그 2는 draft(DB 세션 아님)와 랜딩(D-010 비범위)으로 각각 근거가 있다. 술어 밖으로 샌 nav 지점 **0**.
- 표에 없는데 같은 불변식이 필요한 지점: **없음.**
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: **없음** — plan 이 반대로 "순수 테스트는 지점 누락을 잡지 못한다"고 적었고 M1 이 그것을 실측 확인했다.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| renderer 정적 | `app/src/renderer/**` 수정 | **PASS** | lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, nav 무관 기존) · typecheck `error TS` **0건** |
| 관련 순수 테스트 | AC5~AC8·AC11 의 oracle | **PASS** | `vitest run src/renderer` → **61파일 / 478케이스 전건 통과** |
| 문서 링크 | INDEX 에 plan 링크 추가 | **PASS** | `check-doc-inventory.mjs --check` → generated ok · prose ok · links ok |
| 커밋 trailer | 설계·구현 커밋이 메시지 버스 | **PASS** | `108a5c4` 5키 · `df35f2c` 8키 전부 파싱 |

## 6. 외부 포트 / 문서 계약

해당 없음 — renderer 내부 변경이고 외부 구현자가 채우는 port/schema/config 가 없다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- 재측정 수치: nav `SessionRow` 렌더 지점 **5** · 배치 술어 프로덕션 호출 **4**(배치 3 + `SessionList.tsx:95` kebab 표시 1) · `pinnedAt` 프로덕션 **9** · `patchSession` 정의 1 + 호출 3. **구현자 보고와 전건 일치.**
- 내역 합 = 총계: `pinnedAt` 9 = 프로젝트 고정 3 + 정렬 2 + 쓰기 1 + draft 합성 1 + 활성 세션 1 + 배치 1 ✔
- **0건 게이트의 엄격화(§8)**: 구현자의 음성 술어는 `name="plus"` 였다 — 텍스트 `+` 나 다른 아이콘으로 만든 추가 버튼은 못 본다. **술어를 "구획 subtree 의 모든 상호작용 요소"로 넓혀 재측정**했다: 헤더 1(접기 토글) · 본문 4(행 열기 `:93` · chevron `:98` · kebab `:114` · 고정해제 MenuItem `:126`). **추가 성격 액션 0 — 차집합 비었다.**
- 총량 임계의 형태 분해: 허용 대상 2건(상단 메뉴 `navItems.ts:6` · 우측 패널 `SidebarCard.tsx:36`)은 nav 구획 밖이다. `SidebarCard` 소비자 전수 **2**(`ProjectFilesCard`·`ProjectInstructionsCard`) — 둘 다 프로젝트 상세 우측 패널.
- 출력/요청 상한: 프로젝트 조회는 접힌 행에서 0. `listSessionsByProject(projectId)` 에는 **LIMIT 이 없다**(`queries.ts:797`) — 프로젝트 버킷은 완전하다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AC1 구획 순서 | DOM 마커 4개 실재·소스 순서 | 시각 순서 | 앱 실행 → 사이드바 확장 |
| AC2 고정 프로젝트 나열 | **없음 — 순수 파생이라 넘기면 안 된다(G3)** | (G3 해소 후 순수 테스트로) | 프로젝트 2개를 순서대로 고정 |
| AC4 프로젝트 고정 목적지 | "고정됨 미포함" 절반(M4) | "프로젝트 구획에 나타난다" 절반 | 프로젝트 고정 후 두 구획 확인 |
| AC9 접힘·빈 헤더 | 헤더 무조건 렌더(구조) | 시각 + **D-008 제품 결정** | 고정 0 상태로 관찰 |
| AC10 하위 행 kebab | 세 핸들러 전달(구조) | 메뉴 3항목 시각 | 하위 행 hover → kebab |
| AC12 랜딩 삭제/이름변경 | 배선(구조) | DB 영속 | 삭제 후 앱 재시작 |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run src/renderer` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**(exit code 아님): lint `✖ 1 problem (0 errors, 1 warning)` · typecheck `error TS` 0건 · renderer vitest `Test Files 61 passed / Tests 478 passed` · 전체 vitest `229파일 2328케이스 중 5파일 48케이스 실패`.
- `npm test` 사용 여부: **사용하지 않았다** — DB 동작 자체를 검증할 필요가 없고 `pretest` 가 ABI 를 바꾼다.
- 환경 기인 실패 분리: 48건은 **전부 `src/main/**` 5파일**(`migrate`·`queries`·`fork`·`builder`·`chat-turn.continuity`)이고 서명은 `NODE_MODULE_VERSION 127` vs `140` · `Module did not self-register: better_sqlite3.node` — `app/AGENTS.md` 의 알려진 ABI 마찰. renderer 478건 전건 통과로 이번 변경과 분리된다. **현재 제품 blocking 범위로 올리지 않는다.**
- **게이트가 작업 트리를 바꿨는가**: **없음.** `npm run lint` 는 `--fix` 가 붙어 있으나 실행 후 `git status --short` 빈 출력.
- **검증 중 실행한 명령이 남긴 잔여물**: `app/node_modules`(검증자가 `npm ci` 로 복구) — `.gitignore` 대상이라 `git status --porcelain` 에 나타나지 않는다. 구현 산출물이 아니다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | 완료 |
| AC ↔ production path | 12행 1:1 대조 | — | 완료 — ✅4 · ⚠️8 |
| 레이어/계약/문서 링크 | 정적 검증 | — | 완료 |
| AGENTS 위생 | 해당 없음(AGENTS 무변경) | — | — |
| **D-008 빈 헤더 유지** | 구조만 확인 | **결정** | 대기 |
| UI 시각 품질 | 로직은 기계 검증 | **시각 확인** | 6 AC 대기 |
| 신규 의존성 / PR merge | 없음 / 상태 확인 | **승인** | 대기 |

## 11. Repository operation checks

### AGENTS.md 위생

해당 없음 — 이번 변경에 `AGENTS.md` 수정 0건.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: **정정함** — `impl/IMPL_DONE` → `verify/RETURN_TO_PLAN`, 다음 주체 `Claude`(설계자).
- 「다음 주체」 칸이 주체 하나만 담는가: ✔ `Claude` 하나.
- 대상 커밋 좌표 기입: **검증자가 채웠다** — `(r1 보고 — 검증자 기입)` → `df35f2c`. `git cat-file -t` 로 7개 해시 전부 `commit` 확인.
- **비고 5줄 이내: 위반 → 정정함.** 구현 보고 시점의 비고가 110칸 기준 **9줄**이었다(`docs/handoff/AGENTS.md §산출물 문장 규칙 3` 상한 5). 이번 커밋에서 5줄 이내로 줄이고 상세는 이 문서로 링크한다 → D1.
- PASS 시 archive 이동: 해당 없음(PASS 아님).

### Commit / reference 정합성

- trailer 허용값 준수: ✔ `Agent: claude` · `Status: designed|implemented` · `Verified-By: pending`.
- trailer 실제 파싱: ✔ `108a5c4` 5키 · `df35f2c` 8키 그대로 반환.
- 인용 커밋 해시 실재: ✔ 7개 전부 `git cat-file -t` → `commit`.
- `[구현자 기입]` 7필드 전수: ✔ `grep -c "^## \[구현자 기입\]"` → **7**. 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script: 해당 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 EP-1~EP-3 배선을 자동 게이트가 못 본다 → 보고만 | **타당하나 범위 판정이 다르다.** 사실은 재측정으로 확인(더 밀어도 478건 초록). 그러나 이것은 "인접 개선"이 아니라 **AC5~AC7 의 oracle 이 계약을 닫지 못한다**는 뜻이다 | `NON_BLOCKING` → **`PLAN_GAP` (G1)** 로 승격 |
| #2 AC8 오라클 신설 → 선조치 | **타당.** plan §11 이 "신규 케이스"로 이미 지정한 행이라 설계 변경이 아니다. M5 로 민감도도 확인됐다 | 인정 — AC8 ✅ |
| #3 조회 실패가 "대화 없음"으로 위장 → 보고만 | **타당.** 코드에서 재현 확인 | `NON_BLOCKING` 유지 → D2 |
| #4 음성 스윕이 주석까지 세어 2 → 선조치로 술어 정정 | **타당하나 불충분.** 정정 후에도 술어가 `name="plus"` 한 형태만 본다 — §7 에서 상호작용 요소 전수로 넓혀 재측정했다 | 보완 후 AC3 ✅ |
| #5 §17 R-1 재확인 → 보고만 | **타당.** deps·반환값 관측 일치 | `NEXT_HANDOFF` → D3 |
| `Criteria-Met: 6/12` | **증거로 받지 않음.** 재측정 결과 `4/12` | §5 합계로 정정 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| **G1** | VP-05·06·07 의 oracle 이 `placementOf` 반환값만 본다 — AC5~AC7 의 동작 기준("구획에서 사라진다")을 닫지 못한다. M1: EP-1 소거 후 renderer 478건·typecheck·eslint 전부 초록 | VP-05·06·07 / AT-05~07 / §10 EP-1~EP-3 | **PLAN_GAP** | root=G2 · 영향 VP-05·06·07 | planner — MD-01↔UT-01 pair 를 세우고 세 구획 파생을 순수 셀렉터로 내리거나 렌더 하네스를 결정한다 |
| **G2** | `NEW` 왼쪽 노드 3개(`MD-01`·`MD-02`·`R-07`)에 같은 레벨 `REQUIRED` pair 가 없다 — `docs/handoff/AGENTS.md §Baseline V · Delta V · pair` 위반. 차집합: NEW 13 − paired 10 | plan §7-A pair registry | **PLAN_GAP** | **root** · 영향 VP-05~08·VP-11 | planner — 세 pair 행 신설 |
| **G3** | AT-02 의 유일한 oracle 이 사람 실기인데 대상은 `filter + sort` 순수 파생이다 | VP-02 / AT-02 / `handoff-verify §5` | **PLAN_GAP** | root=G2 · 영향 VP-02·VP-04 | planner — 순수 seam 을 §11 에 지정하거나 실기 유지 근거를 적는다 |
| **D1** | INDEX 0203 비고가 9줄로 5줄 상한 초과 | 현재 산출물 gate(`§산출물 문장 규칙 3`) | **NON_BLOCKING** | — | **검증자가 이번 커밋에서 정정** |
| **D2** | 프로젝트 하위 조회 실패가 `sessions.empty`("대화 없음")로 보여 진짜 빈 프로젝트와 구분되지 않는다 | Part I §5 파생 UX — 상태 전이표에 행 없음 | **NON_BLOCKING** | — | 실패 표시를 넣으면 전이표 행이 늘어난다 — 제품 결정 |
| **D3** | 고정 프로젝트에 새 대화가 생기고 그 구획이 이미 펼쳐져 있으면 어느 구획에도 안 보인다(`useProjectSessions.ts:20` deps `[projectId]` · `sessionsStore.ts:81-85` 반환에 `projectSessionIds` 없음) | plan §17 R-1 | **NEXT_HANDOFF** | — | 최소 해법: `initSessions` 가 이미 조회된 버킷 membership 도 갱신 |
| **D4** | 모든 대화가 고정된 프로젝트는 하위가 "대화 없음"으로 보인다(`PinnedProjectsSection.tsx:179` 필터 후 0) | D-005 의 부수 결과 | **NEXT_HANDOFF** | — | 문구 분기 또는 고정 대화 요약 표시 |
| **D5** | `listSessions(limit = 50)` 밖으로 밀려난 고정 대화는 재부팅 후 "고정됨"에 나타나지 않는다(`queries.ts:456`, `ORDER BY updated_at DESC`) | 비귀속 — `cc4cde5` 에서도 동일(회귀 아님) | **NEXT_HANDOFF** | — | main 쿼리가 고정 세션을 LIMIT 밖에서도 반환해야 한다 |
| **D6** | `SIDEBAR_DEFAULT_WIDTH` 가 어디서도 참조되지 않는다 | 비귀속 — 이번 변경 이전부터 | **NON_BLOCKING** | — | 기록만 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음 — r1 이다.
- 관련 plan 지침/AC 의 존재 여부: **있었다.** `handoff-plan/SKILL.md §5` 가 "불변식이 'X가 쓰인다'면 검사 장치는 X를 지웠을 때 실패해야 한다"를 적고 0198 D-010 을 사례로 든다. plan 은 §10 `실패 의미`에 한계를 **적기만** 하고 장치를 만들지 않았다 — G1 이 그 자리다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: **3건** — better-sqlite3 ABI(`src/main/**` 48케이스) · Electron GUI 부재(6 AC) · 렌더 하네스 부재(0201 AC16 과 같은 축).
- 절차 사실: 구현 5커밋이 `Handoff: none` 으로 handoff 밖에서 도착해 §0 의 구현 전 diff 잠금이 그 구간에 성립하지 않는다.

## 15. 결론

- 상태: **RETURN_TO_PLAN**
- pair 결과: REQUIRED 12 중 **PASS 3**(VP-03·VP-08·VP-12) · **root PAIR_FAIL 0** · **BLOCKED_BY 0** · PLAN_GAP 영향 4(VP-02·05·06·07) · 사람 실기 미판정 5(VP-01·04·09·10·11)
- PLAN_GAP: **root G2**(NEW node 3개 pair 누락) → 파생 **G1**(R 레벨 AC 를 UT 오라클이 닫는다) · **G3**(순수 파생이 실기로 남았다)
- Product/UX 및 ACTIVE Decision 충족: **D-001~D-011 전건 충족** — 코드에 요구 위반 0건
- AC 충족: `✅ 4 · ⚠️ 8 · ❌ 0 = 12`. ⚠️ 8 중 3은 oracle 계층(G1) · 1은 G3 · 4는 사람 실기
- 현재 변경 운영 gate: **4종 전부 PASS**
- NON_BLOCKING / NEXT_HANDOFF: D1(정정 완료) · D2 · D6 / D3 · D4 · D5
- repository operation checks: 좌표·trailer·7필드 PASS · **비고 5줄 초과 1건 정정**
- 남은 사람 확인: 6 AC 시각 실기 + **D-008 제품 결정**
- 다음 단계: **설계자**가 G2 → G1 → G3 순으로 규범 행을 새 Delta V(ΔV1)로 정정하고 별도 설계 커밋으로 `plan/READY` 에 돌린다. **구현 코드는 이번 라운드에 고칠 것이 없다.**

---

# Verify r2 — ΔV1 구현

> **판정: `RETURN_TO_PLAN`.** ΔV1 의 핵심은 성립했다 — r1 에서 초록이던 배치 배선 소거가 이제 red 다(G1 닫힘). 막는 것은 **렌더 oracle 이 자기가 덮는다고 적은 범위를 실제로는 덜 덮는다**는 것이다: EP-9 세 지점 중 프로젝트 하위 1지점의 단언이 공허하고(`PAIR_FAIL`), 파티션과 렌더 사이의 이음매가 무관측이다(`PLAN_GAP`).
> r1 판정 원문은 이 문서 위쪽에 그대로 둔다.

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `edb1545..1687c7b` — 설계 `edb1545`(ΔV1) · 구현 `1687c7b` |
| 구현 전 plan 기준 | **`edb1545`** — r1 과 달리 **diff 로 성립한다** |
| V mode / 유효 V | `Baseline V + ΔV1` |
| 라운드 | 2 |
| 상태 | **RETURN_TO_PLAN** |

## 0. 기준선 (r2)

- 구현 커밋의 `plan.md` hunk: **`@@ -676,6 +676,116 @@` 하나**. `[검증자 기입]`(679행) 직전이고 전부 `[구현자 기입] r2` 블록이다.
- 규범 구간 **1~569행**(§3 Ledger · §7 AC · §7-A · §7-B ΔV1 · §10 강제 지점 전부 포함) `edb1545` ↔ `1687c7b` **diff 0줄**.
- 삭제된 줄: diff 의 `-` 는 **1건**(파일 헤더). r1 검증자 판정·파생 이슈 표 훼손 0.
- **판정: 구현자가 채점 기준을 건드리지 않았다.** r1 의 "확인 불가"가 이번엔 확인됐다.

### Plan validity (r2)

| 검사 | 판정 | 근거 |
|---|---|---|
| ΔV1 의 `NEW`·`CHANGED` 왼쪽 node ↔ 같은 레벨 pair | 유효 | `MD-01a`→VP-13 · `AR-03`→VP-16 · `MD-04`→VP-17. 유효 V 전체 재계수: 왼쪽 node 15 ↔ pair 15, **차집합 0** |
| pair별 path·§10 전수·직접 oracle | **PLAN_GAP (G4)** | VP-05a 의 path 는 `… → splitNavSections → **props** → 렌더`인데 `slots → props` 구간에 oracle 이 없다 |
| 필요한 pair의 적대 증거·선택 이유 | 유효 | VP-14·VP-16 만 선택했고 둘 다 변이가 적혀 있다 |
| 현재 변경 산출물의 운영 gate | 유효 | 4종이 열거돼 있고 전부 실행 가능했다 |

## 1~2. 비판적 읽기 · 역방향 탐색 (r2)

| 질문/후보 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | 없음 | `loadProjectSessions` 의 삼킴은 r1 과 동일 경로(D2). 새 삼킴 0 |
| 조기 반환·순서 변경이 건너뛰는 것 | 없음 | 펼침 트리거가 `PinnedProjectChildren` 마운트 → `PinnedProjectRow` effect 로 옮겼고 deps `[expanded, project.id, onExpandProject]` 가 접기→펼치기를 다시 발화한다. `onExpandProject` 는 모듈 상수라 identity 안정 |
| 요청 fan-out 증가 | 없음 | 조회 트리거는 여전히 2곳. 파티션이 고정 프로젝트 전체를 도는 것은 **이미 조회된 버킷만**이라 fetch 0 증가 |
| 스캔 §2 — 세 `*View` "프로덕션 참조 0" | **오탐** | 스크립트가 파일 간 참조만 센다. 같은 파일에서 어댑터가 렌더한다: `PinnedSection.tsx:65` · `SessionList.tsx:99` · `PinnedProjectsSection.tsx:217` |
| 어댑터가 파티션의 올바른 칸을 넘기는가 | 코드상 맞다 | `:64 pinned` · `:98 recent` · `:215 projectChildren` — 다만 잠겨 있지 않다(G4) |
| 배럴 신규 export 의 소비처 | `splitNavSections` 는 feature 내부 1건뿐 | `useNavSections.ts:17`. `index.ts` 재수출의 외부 소비처 0 → D8 |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 `(없음)` |
| `useProjectSessions` 고아 여부 | 정상 | nav 에서 빠졌으나 `ProjectSessionsPanel.tsx:32` 가 계속 쓴다 |

## 4. 적대 증거 재측정 (r2) — 검증자가 다시 센다

**8건 중 검출 7 · 미검출 1.** 구현자 보고와 무관하게 재현했다.

| 재측정 변이 | 검증자 관측 | 판정 |
|---|---|---|
| EP-1a-A `navSections.ts:31` 고정 필터 제거 | **4 failed / 497** | 검출 |
| EP-1a-B `:36` 최근 배치 제외 제거 | **4 failed / 497** | 검출 |
| EP-1a-C `:48` 하위 고정 제외 제거 | **3 failed / 497** | 검출 |
| VP-16 `PinnedSectionView` 재파생 | **2 failed / 497** | 검출 |
| VP-16 `SessionListView` 재파생 | **2 failed / 497** | 검출 |
| **VP-16 `PinnedProjectsSectionView` 재파생** | **0 failed — 497 전건 통과** | **미검출 → D7** |
| VP-14 `navItems` → `startsWith` | **1 failed / 497** | 검출 |
| EP-10 `pinnedProjectsOf` 고정 필터 제거 | **2 failed / 497** | 검출 |

- 소거 변이의 잔여물 수렴: EP-1a 세 건 모두 심볼이 계속 쓰여 잔여 진단 0인 상태에서 red 다 — 잔여물에 기댄 red 가 아니다.
- 동작 보존 추출 라운드인가: **아니오.** 위 변이는 전부 동작을 바꾸므로 초록/빨강이 판정 근거가 된다.
- **구현자 수치와의 차이**: EP-1a-B·C 에서 구현자는 6·8건을 보고했고 나는 4·3건을 봤다. 변이 문구가 달라 실패 케이스 수가 다를 뿐 **검출 여부는 같다**.

## 5. V-pair closeout (r2) — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|
| VP-13 | MD-01a ↔ UT-01a / UT | **PASS** | 파티션 12케이스 · 세 분기 변이 전부 red | EP-1a (1/1, 분기 3/3) |
| VP-14 | MD-02 ↔ UT-02 / UT | **PASS** | 술어 2단언 · `startsWith` 변이 red | EP-4 (1/1) |
| VP-17 | MD-04 ↔ UT-04 / UT | **PASS** | `pinnedProjectsOf` 2케이스 · 변이 red | EP-10 (1/1) |
| VP-12 | MD-03 ↔ UT-03 / UT | **PASS** | `sessionsStore.test.ts` 2케이스(무변경 승계) | EP-6·EP-7 (2/2) |
| VP-16 | AR-03 ↔ IT-03 / IT | **PAIR_FAIL** | 세 지점 중 **2 만 잠긴다** — 프로젝트 하위 단언이 공허(D7) | EP-9 (**2/3**) |
| VP-10 | AR-01 ↔ IT-01 / IT | 미판정 — 사람 실기 | 구조: 4슬롯 배선 확인 | EP-4·5·8 (3/3) |
| VP-11·15 | AR-02·R-07 ↔ IT-02·AT-11·12 / IT·AT | 미판정 — 사람 실기 | AT-11 순수 2케이스 PASS, AT-12 는 IPC+DB | EP-6·7 (2/2) |
| VP-09 | SD-01 ↔ ST-01 / ST | **PASS** | §5 전이표의 배치 4행이 파티션 케이스로 닫힌다 | EP-1a (1/1) |
| VP-02a | R-02 ↔ AT-02a / AT | **PASS** | 비고정 제외 + 내림차순 1단언 · 변이 red | EP-10 (1/1) |
| VP-03 | R-03 ↔ AT-03 / AT | **PASS** | 렌더 단언 — 헤더 `<button` **1개** · `aria-expanded` 있음 | EP-8 (1/1) |
| VP-08 | R-06 ↔ AT-08 / AT | **PASS** | 술어 2단언 · 변이 red | EP-4 (1/1) |
| VP-05a | R-05 ↔ AT-05a / AT | **PLAN_GAP:G4** | 파티션·렌더 두 반쪽은 PASS. **이음매(`slots→props`)가 무관측** | EP-1a·EP-9 |
| VP-06a | R-05 ↔ AT-06a / AT | **PASS** | 서로소 + 양방향 차집합 0 + 중복 배치 0 | EP-1a (1/1) |
| VP-07a | R-05 ↔ AT-07a / AT | **PASS** | 해제 후 소속별 복귀 1케이스 | EP-1a (1/1) |
| VP-01·04 | R-01·R-04 ↔ AT-01·04 / AT | 미판정 — 사람 실기 | AC4 의 구조 절반은 EP-5 로 닫힘 | EP-5 (1/1) |

- root `PAIR_FAIL`: **VP-16**. 종속 `BLOCKED_BY`: 없음 — VP-05a 는 별도 원인(G4)이라 같은 root 로 접지 않았다.
- 이번 라운드 실행 범위: ΔV1 의 REQUIRED 9 pair 전건 + V1 승계 pair + 운영 gate 4종.

### AT / AC 재채점

**검증자 독립 재계수: `✅ 9 · ⚠️ 5 · ❌ 0 = 총 14`.** 분모를 §7+§7-B 에서 다시 세어 14.

- ✅ AC2a · AC3 · AC5a · AC6a · AC7a · AC8 · AC11 · AC13 · AC14
- ⚠️ AC1 · AC4 · AC9 · AC10 · AC12 — 전부 시각/IPC 실기
- **자기보고와 일치**(9/14). 다만 **AC13 의 ✅ 는 세 지점 중 둘에만 걸린다**(D7) — 값은 같고 근거 폭이 다르다.
- **합계 사본 3곳 대조**: 본문 `9/14` ↔ trailer `Criteria-Met: 9/14` ↔ INDEX `✅9 · ⚠️5 · ❌0 / 14` — **일치**.

### 강제 지점 분모 재측정

| 지점 | plan | 검증자 재측정 | 판정 |
|---|---|---|---|
| EP-1a | 1 | 배치 분기 **3개 전부 `splitNavSections` 안**. 술어를 심볼 + 원시 `pinnedAt` 비교 **둘 다**로 넓혀 재측정 — 함수 밖 목록 배치 분기 **차집합 0** | PASS |
| EP-9 | 3 | 세 View 본문의 store·파티션 심볼 **0건**(각 39·56·180줄). 그러나 렌더 oracle 은 **2지점만** 관측한다 | **PAIR_FAIL** |
| EP-10 | 1 | 프로젝트 목록 필터 **1건**(`navSections.ts:60`). 나머지 `pinnedAt != null` 4건은 단건 상태·세션 배치 | PASS |
| EP-4·5·6·7·8 | 5 | 승계 — `p === '/projects'` · `Project` 타입 참조 0 · `patchSession` 4 · `projectSessionIds` 8 · `aria-expanded={` 1 | PASS |

- **구현자가 만든 스윕의 엄격화(§8)**: EP-5 술어를 `Project`(부분 문자열, r1) → 타입 참조(구현자) → **`\bProject\b` 단어 경계**(검증자)로 좁혀 재측정했다. 3 → 0 → **0**. 두 엄격형 사이 **차집합 0** — 구현자의 정정이 옳다.

### 현재 변경의 운영 gate (r2)

| Gate | 결과 | 관측한 산출 |
|---|---|---|
| renderer 정적 | **PASS** | lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, nav 무관·기존) · typecheck `error TS` **0건** |
| 관련 순수·렌더 테스트 | **PASS** | `vitest run src/renderer` → **63파일 / 497케이스 전건 통과** |
| 전체 스위트 | 환경 한계 분리 | **231파일 2347케이스 중 5파일 48케이스 실패** — r1·r2 동일한 `src/main/**` 5파일, `NODE_MODULE_VERSION 127` vs `140` |
| 문서 링크 | **PASS** | `check-doc-inventory.mjs --check` → links ok |
| 게이트가 트리를 바꿨는가 | 없음 | `npm run lint`(`--fix`) 실행 후 `git status --short` 빈 출력 |
| 검증 중 남긴 잔여물 | 없음 | 스파이크 2개(`__probe.test.ts`·`nominal.ts`)는 삭제/scratchpad. 변이 8건 전부 복원 후 497 초록 |

## 8. 사람 실기 경계 (r2)

기계로 더 내릴 수 있는 것을 먼저 찾았다 — **AC9 의 "빈 헤더 유지" 절반은 이번 라운드에 기계로 내려갔다**(0129 방식 "빈 섹션 숨김"으로 되돌리면 **2건 red**). 남은 것:

| 항목 | 남은 사람 실기 | 이유 |
|---|---|---|
| AC1 | 4구획 시각 순서 | 시각 |
| AC4 | "프로젝트 구획에 나타난다" 절반 | 시각(반대 절반은 EP-5 로 닫힘) |
| AC9 | 헤더 **클릭**으로 접힘 | 상호작용 — SSR 로 관측 불가 |
| AC10 | kebab 3항목 | Popover 가 `menuOpen` 상태 뒤에 있어 SSR 출력에 없다 |
| AC12 | 랜딩 삭제의 DB 영속 | electron IPC + DB |

## 11. Repository operation checks (r2)

- 상태/다음 주체/좌표: **정정함** — `impl/IMPL_DONE` → `verify/RETURN_TO_PLAN`, 다음 주체 설계자. `(r2 구현 — 검증자 기입)` → `1687c7b`.
- 인용 좌표 실재: `e3395ea`·`df35f2c`·`b661236`·`edb1545`·`1687c7b` 전부 `git cat-file -t` → `commit`.
- 비고 5줄 이내: **5줄** — 위반 없음(r1 의 D1 재발 0).
- `[구현자 기입]` 7필드 × 2라운드: **14** 섹션. r2 의 7필드 전부 표 형태로 존재, 산문으로 접힌 필드 0.
- trailer 파싱: `1687c7b` **8키** 그대로 반환. 허용값 준수.
- `AGENTS.md` 변경: 없음.

## 12. 구현자 코멘트 / 선조치 경계 (r2)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 어댑터 한 줄 미잠금 → 보고만 | **타당하나 분류가 다르다.** M12 재현 확인(497 초록·typecheck 0). 다만 "jsdom 없이는 못 닫는다"는 **틀렸다** — 스파이크로 nominal type 이 `TS2322` 를 내는 것을 확인했다 | `NON_BLOCKING` → **`PLAN_GAP` (G4)** |
| #2 D3 를 전용 케이스로 관측 고정 → 선조치 | **타당.** 합집합 단언이 로딩 축까지 덮는 것처럼 읽히는 것을 막는다 | 인정 |
| #3 렌더 단언 초안이 본문을 셌다 → 선조치 | **타당.** 정정본은 헤더만 세어 `<button` 1개 | 인정 — AC3 ✅ |
| #4 EP-5 술어 위양성 → 선조치 | **타당.** 더 엄격한 술어로 재측정해도 차집합 0 | 인정 |
| #5 `useProjectSessions` 소비자 1건 | **타당.** `ProjectSessionsPanel.tsx:32` | 인정 |
| 강제 지점 **10/10** 자기보고 | **9/10 으로 정정.** EP-9 는 grep(구독 0건)으로는 3/3 이나 **렌더 oracle 로는 2/3** 이다 | D7 |
| `Criteria-Met: 9/14` | 독립 재계수 결과와 **일치** | 인정 |

## 13. Finding disposition (r2)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| **D7** | **AT-13 의 프로젝트 절반이 공허하다.** `PinnedProjectsSectionView` 의 하위 대화는 `expanded=false` 기본값 뒤에 있어 SSR 출력에 **0건** 렌더된다 — `not.toContain('안준-대화')` 가 무엇을 넣어도 참이다. 재파생 변이가 **미검출**(497 전건 통과) | VP-16 · AT-13 · §10 EP-9 (2/3) | **BLOCKING** | 구현 — `PinnedProjectChildren` 을 export 해 props 로 직접 렌더하면 의존성 0 으로 닫힌다 |
| **G4** | **파티션과 렌더 사이 이음매가 무관측이다.** 어댑터가 `pinned` 대신 `recent` 를 넘겨도 vitest 497 초록 · typecheck 0. VP-05a 의 등록 path 에 `slots → props` 구간이 있는데 oracle 이 없다 | VP-05a · AT-05a | **PLAN_GAP** | planner — 스파이크 확인: `NavSections` 의 세 칸에 **branded type** 을 주면 `TS2322` 로 잡힌다(신규 의존성 0). 계약 변경이라 설계자 몫 |
| D8 | `index.ts` 가 재수출한 `splitNavSections` 의 외부 소비처 0 — 실제 소비는 feature 내부 `useNavSections.ts:17` 하나 | 비귀속 | NON_BLOCKING | 배럴에서 내려도 무방 |
| D9 | `SessionList.tsx:80` `pinned={isPinnedSession(s)}` 는 항상 `false` — `pinned={false}` 로 치환해도 497 초록. View 에 남은 유일한 배치 심볼이다 | 비귀속 | NON_BLOCKING | 상수화하면 View 에서 배치 심볼이 0 이 된다 |
| D10 | 테스트명 `고정 항목이 0개여도…` 의 프로젝트 절반이 실제로는 **고정 프로젝트 1개**로 돈다(`renderProjects({})` 기본값) — 0개 케이스는 다음 테스트가 덮는다 | 비귀속 | NON_BLOCKING | 이름과 입력을 맞춘다 |
| D2·D3·D4·D5·D6 | r1 등록분 — 변화 없음 | r1 참조 | 유지 | r1 판정 그대로 |

## 14. Review Signals (r2) — 사실만

- 이전 라운드와 동일/유사 증상: **그렇다 — 세 번째 변주다.** r1 = 배치 규칙이 안 잠김 → ΔV1 이 닫음. r2 = **렌더 oracle 이 자기 범위를 덜 덮음**(D7) + **두 oracle 사이 이음매**(G4). 축은 매번 "장치가 주장하는 범위 ≠ 실제로 반응하는 범위".
- 관련 plan 지침/AC 의 존재 여부: `handoff-impl §3` 이 "이번 턴에 만든 oracle 이 주장하는 production 경로에 실제로 진입하는가" 를 요구한다. 구현자는 세 구획 중 둘에만 변이를 심었고 셋째는 심지 않았다 — 심었다면 이 라운드에서 잡혔다.
- 사용자 결정 변경 근거: 없음. **D-013(렌더 하네스 미도입)은 유지된다** — G4 의 해법이 타입이라 신규 의존성이 필요 없다.
- 반복된 검증 환경 한계: 3건 유지(ABI · Electron GUI · store 구독 컴포넌트의 SSR).
- 라운드 수: **2** — 3을 넘지 않았으므로 `handoff-review` 진입 조건은 아직 아니다.

## 15. 결론 (r2)

- 상태: **RETURN_TO_PLAN** (`PAIR_FAIL` D7 + `PLAN_GAP` G4 동시 → 다음 주체는 설계자)
- pair 결과: **PASS 10** · root `PAIR_FAIL` **1**(VP-16) · `PLAN_GAP` **1**(VP-05a) · 미판정(사람 실기) **4**
- **ΔV1 의 목표는 달성됐다** — G1·G2·G3 전부 닫혔고, r1 에서 초록이던 배치 배선 소거가 세 갈래 전부 red 다.
- Product/UX 및 ACTIVE Decision: **D-001~D-013 전건 충족**, 코드에 요구 위반 0
- AC: `✅ 9 · ⚠️ 5 · ❌ 0 = 14` (자기보고와 일치)
- 운영 gate: **4종 전부 PASS**, 트리 변화 0, 잔여물 0
- 다음 단계: 설계자가 **G4 만** ΔV2 로 정정한다(`NavSections` 칸에 branded type + VP-05a 의 이음매 oracle 행). **D7 은 규범 정정이 필요 없는 구현 항목**이므로 같은 라운드의 재구현으로 닫는다.

---

# Verify r3 — ΔV2 구현 + D7 재구현

> **판정: `PASS`.** r2 에서 무음이던 두 이음매가 이제 red 다 — 어댑터 칸 혼동은 `TS2322`, 프로젝트 하위 재파생은 1건 실패. 유효 V 의 `REQUIRED`·`REGRESSION` pair 와 운영 gate 4종이 전부 PASS 이고 `PLAN_GAP` 은 없다.
> 남은 이음매 1건(V1)은 `NON_BLOCKING` 이다 — **ACTIVE Decision 아래에서는 닫히지 않는다**(§13).
> r1·r2 판정 원문은 이 문서 위쪽에 그대로 둔다.

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `b3178a2..55130c1` — 설계 `b3178a2`(ΔV2) · 구현 `55130c1` |
| 구현 전 plan 기준 | **`b3178a2`** — diff 로 성립한다 |
| V mode / 유효 V | `V1 + ΔV1 + ΔV2` |
| 라운드 | 3 |
| 상태 | **PASS** |

## 0. 기준선 (r3)

- 규범 구간 **1~662행**(§3 Ledger · §7 AC · §7-A · §7-B ΔV1 · §7-C ΔV2 · §10 강제 지점 전부) `b3178a2` ↔ `55130c1` **diff 0줄**.
- 구현 커밋의 `plan.md` hunk 는 전부 663행 이후 — `[구현자 기입] r3` 블록이다. 삭제된 줄 **0**.
- **판정: 구현자가 채점 기준을 건드리지 않았다.** r1·r2 검증자 판정과 파생 이슈 표 훼손 0.

### Plan validity (r3)

| 검사 | 판정 | 근거 |
|---|---|---|
| ΔV2 의 `CHANGED` 왼쪽 node ↔ 같은 레벨 pair | 유효 | `AR-03a`→VP-18(IT). 유효 V 재계수: 대체되지 않은 `NEW`·`CHANGED` 왼쪽 node **15** ↔ pair 가 잠근 node **15**, 차집합 0 |
| pair별 path·§10 전수·직접 oracle | 유효 | VP-18 은 렌더(①)·타입(②) 두 oracle 이 `slots → props` 구간을 덮는다. VP-05b 는 그 둘 + VP-13 결합 |
| 필요한 pair의 적대 증거·선택 이유 | 유효 | VP-18 만 `required` 로 선택하고 변이(브랜드 제거 → `TS2578`)를 적었다 |
| §10 분모 정확성 | **부정확하나 비블로킹** | §7-C 는 EP-11 을 `3`(구획 수)으로 셌고 실측은 **5**다(§7). 구현자가 5/5 로 닫았다 — **닫힌 지점이 명명된 수보다 많다**. `PLAN_GAP` 아님(구현자가 새 계약을 발명하지 않고도 닫혔다) |
| 현재 변경 산출물의 운영 gate | 유효 | 4종 열거, 전부 실행 가능 |

## 1~3. 비판적 읽기 · 역방향 탐색 (r3)

| 질문/후보 | 판정 | 근거 |
|---|---|---|
| 브랜드가 런타임 산출을 바꾸는가 | 아니오 | `declare const slot: unique symbol` — 선언만이라 emit 0. 런타임 값은 r2 와 동일한 `SessionListItem[]` |
| `PinnedProjectChildren` export 가 새 표면을 만드는가 | 통제됨 | 프로덕션 렌더 **1건**(`PinnedProjectsSection.tsx:145`) + 테스트 1건. 배럴 재수출 없음 |
| 테스트 캐스트 헬퍼가 프로덕션 우회로를 여는가 | 아니오 | `asPinned`·`asRecent`·`asChildren` 의 프로덕션 참조 **0건** — 정의·사용 전부 `navSections.render.test.ts` 안 |
| 스캔 §2 — `*View` "프로덕션 참조 0" | **오탐**(r2 와 동일) | 스크립트가 파일 간 참조만 센다. 같은 파일 어댑터가 렌더한다 |
| false success 가능성 | 신규 0 | 새 삼킴·새 catch 0. D2 경로는 r1 과 동일 |
| 조기 반환·상태 뒤 은닉 | **줄었다** | r2 의 공허 단언 원인(접힘 뒤 0건 렌더)을 컴포넌트 직접 렌더로 우회했다 |

## 4. 적대 증거 재측정 (r3) — 검증자가 다시 센다

**구현자 보고와 무관하게 재현했다. 4건 검출 · 1건 미검출(V1).**

| 재측정 변이 | 검증자 관측 | 판정 |
|---|---|---|
| M14′ 브랜드 3개 제거(잔여물 0 상태까지 밀어) | **`TS2578` 3건** — `@ts-expect-error` 가 전부 "불필요"로 뒤집힌다 | 검출 |
| M15 `PinnedSection.tsx:66` 어댑터가 `recent` 를 넘김 | **`TS2322` 1건** | 검출 — r2 에 무음이던 원본 변이 |
| M16 `PinnedProjectChildren` 이 목록을 재파생 | **2 failed / 499** | 검출 |
| M17 프로젝트 하위 재파생(r2 의 미검출 변이) | **1 failed / 499** | 검출 — **D7 닫힘** |
| **V1** `PinnedProjectsSection.tsx:146` → `sessions={undefined}` | **499 전건 통과 · typecheck 0** | **미검출 → V1** |

- `@ts-expect-error` 3줄의 **이유 확인**: 셋을 동시에 지우면 정확히 `RecentSessions → PinnedSessions` · `PinnedSessions → ProjectChildSessions` · `ProjectChildSessions → RecentSessions` 세 오류가 남는다 — 지시자가 다른 이유로 서 있는 것이 아니다.
- 어댑터 슬롯 잠금 전수: V2(`SessionList` 어댑터가 `pinned`) → typecheck 1건 · V3(`PinnedProjectsSection` 어댑터가 `pinned`) → typecheck 1건. **세 어댑터 전부 잠긴다.**
- 소거 변이의 잔여물 수렴: M14′ 는 브랜드 타입·import·캐스트 잔여 진단이 0이 될 때까지 밀어 그 상태에서 `TS2578` 3건이다 — 잔여물에 기댄 red 가 아니다.
- 동작 보존 추출 라운드인가: **아니오.** 위 변이는 전부 관측 가능한 차이를 만든다.

## 5. V-pair closeout (r3) — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|
| VP-13 | MD-01a ↔ UT-01a / UT | **PASS**(승계) | 파티션 12케이스 · 세 분기 변이 red(r2 재측정) | EP-1a (1/1) |
| VP-14 | MD-02 ↔ UT-02 / UT | **PASS**(승계) | 술어 2단언 · `startsWith` 변이 red | EP-4 (1/1) |
| VP-17 | MD-04 ↔ UT-04 / UT | **PASS**(승계) | `pinnedProjectsOf` 2케이스 · 변이 red | EP-10 (1/1) |
| VP-12 | MD-03 ↔ UT-03 / UT | **PASS**(승계) | `sessionsStore.test.ts` 2케이스 | EP-6·7 (2/2) |
| **VP-18** | AR-03a ↔ IT-03a / IT | **PASS** | ① 세 구획의 양성+음성 쌍 전건 통과 · M16·M17 red ② `@ts-expect-error` 3줄 + M14′·M15·V2·V3 | **EP-11 (5/5)** · EP-12 (1/1) |
| VP-10 | AR-01 ↔ IT-01 / IT | 미판정 — 사람 실기 | 구조: 4슬롯 배선 확인 | EP-4·5·8 (3/3) |
| VP-11·15 | AR-02·R-07 ↔ IT-02·AT-11·12 | 미판정 — 사람 실기 | AT-11 순수 2케이스 PASS | EP-6·7 (2/2) |
| VP-09 | SD-01 ↔ ST-01 / ST | **PASS**(승계) | §5 전이표의 배치 4행이 파티션 케이스로 닫힌다 | EP-1a (1/1) |
| VP-02a | R-02 ↔ AT-02a / AT | **PASS**(승계) | 비고정 제외 + 내림차순 · 변이 red | EP-10 (1/1) |
| VP-03 | R-03 ↔ AT-03 / AT | **PASS** | 헤더 `<button` **1개** + `aria-expanded` 양성 | EP-8 (1/1) |
| VP-08 | R-06 ↔ AT-08 / AT | **PASS**(승계) | 술어 2단언 · 변이 red | EP-4 (1/1) |
| **VP-05b** | R-05 ↔ AT-05a / AT | **PASS** | 파티션 UT + 렌더 + 이음매 타입 셋이 `kebab → … → props → 렌더` 전 구간을 덮는다 | EP-1a·EP-9·EP-11 |
| VP-06a | R-05 ↔ AT-06a / AT | **PASS** | 서로소 + 양방향 차집합 0 | EP-1a (1/1) |
| VP-07a | R-05 ↔ AT-07a / AT | **PASS** | 해제 후 소속별 복귀 1케이스 | EP-1a (1/1) |
| VP-01·04 | R-01·R-04 ↔ AT-01·04 / AT | 미판정 — 사람 실기 | AC4 구조 절반은 EP-5 로 닫힘 | EP-5 (1/1) |
| VP-16·05a | — | **SUPERSEDED** | ΔV2 가 VP-18·05b 로 대체 | — |

- root `PAIR_FAIL` **0** · `BLOCKED_BY` **0** · `PLAN_GAP` **0**.
- 이번 라운드 실행 범위: ΔV2 의 REQUIRED 2 pair 전건 + 이번 변경이 닿는 승계 pair + 운영 gate 4종. 영향받지 않은 이전 PASS 는 좌표 참조로 둔다.

### AT / AC 재채점 (r3)

**검증자 독립 재계수: `✅ 10 · ⚠️ 5 · ❌ 0 = 총 15`.** 분모를 §7 + §7-B + §7-C 에서 다시 세어 15(AT-15 신설, AT-13→13a 는 번호 승계).

- ✅ AC2a · AC3 · AC5a · AC6a · AC7a · AC8 · AC11 · **AC13a** · AC14 · **AC15**
- ⚠️ AC1 · AC4 · AC9 · AC10 · AC12 — 전부 시각/IPC 실기
- **AC13a 의 ✅ 는 이제 세 지점 전부에 걸린다** — r2 의 "값은 같고 근거 폭이 다름"이 해소됐다(M17 검출).
- **합계 사본 3곳 대조**: 본문 `10/15` ↔ trailer `Criteria-Met: 10/15` ↔ INDEX `✅10 · ⚠️5 · ❌0 / 15` — **일치**.
- 분모가 14→15 로 바뀌었으므로 r2 의 `9/14` 와 직접 비교하지 않는다.

### 강제 지점 분모 재측정 (r3)

| 지점 | plan | 검증자 재측정 | 판정 |
|---|---|---|---|
| **EP-11** | 3 | **5** — 목록을 나르는 prop 선언: `PinnedSection.tsx:11` · `SessionList.tsx:22` · `PinnedProjectsSection.tsx:19·66·162`. 평범한 `SessionListItem[]` 목록 prop **0건**(차집합 0) | **5/5** — 설계자 분모보다 많다 |
| **EP-12** | 1 | 프로덕션 캐스트 **3건 전부 `navSections.ts:43·49·61`**(= `splitNavSections` 안). 함수 밖 **0**. 테스트 캐스트 3건은 `navSections.render.test.ts` 안 | 1/1 |
| EP-1a·EP-9·EP-10 | 5 | 승계 — r2 재측정과 동일. EP-9 는 이번 라운드에 **3/3** 이 됐다(r2 는 2/3) | PASS |
| EP-4·5·6·7·8 | 5 | 승계 — `p === '/projects'` · `\bProject\b` 타입 참조 0 · `patchSession` 4 · `projectSessionIds` 8 · `aria-expanded={` 1 | PASS |

- **구현자가 신설한 스윕의 엄격화(§8)**: EP-11 술어를 *구획 수*(설계자) → *목록을 나르는 prop 선언*(구현자) → **브랜드 타입 참조 ∪ 평범한 `SessionListItem[]` 목록 prop**(검증자)으로 넓혀 재측정했다. 브랜드 5 · 평범 0 — **차집합 0**. 구현자의 분모가 옳다.

### 현재 변경의 운영 gate (r3)

| Gate | 결과 | 관측한 산출 |
|---|---|---|
| renderer 정적 | **PASS** | lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, nav 무관·기존) · typecheck `error TS` **0건** |
| 관련 순수·렌더 테스트 | **PASS** | `vitest run src/renderer` → **63파일 / 499케이스 전건 통과**(r2 497 → +2) |
| 전체 스위트 | 환경 한계 분리 | **231파일 2349케이스 중 5파일 48케이스 실패** — r1·r2 와 같은 `src/main/**` 5파일, `NODE_MODULE_VERSION 127` vs `140` |
| 문서 링크 | **PASS** | `check-doc-inventory.mjs --check` → `links ok` · `prose ok` |
| 게이트가 트리를 바꿨는가 | 없음 | `npm run lint`(`--fix`) 실행 후 `git status --porcelain` 빈 출력 |
| 검증 중 남긴 잔여물 | 없음 | 변이 7건 전부 복원 후 499 초록 · typecheck 0 |

## 8. 사람 실기 경계 (r3)

r2 의 5건 중 하나도 새로 내려오지 않았다 — 이번 라운드가 닫은 것은 전부 타입·렌더 축이다.

| 항목 | 남은 사람 실기 | 이유 |
|---|---|---|
| AC1 | 4구획 시각 순서 | 시각 |
| AC4 | "프로젝트 구획에 나타난다" 절반 | 시각(반대 절반은 EP-5) |
| AC9 | 헤더 **클릭** 접힘 | 상호작용 — SSR 관측 불가 |
| AC10 | kebab 3항목 | Popover 가 `menuOpen` 뒤 |
| AC12 | 랜딩 삭제의 DB 영속 | electron IPC + DB |

## 11. Repository operation checks (r3)

- 상태/다음 주체/좌표: **정정함** — `impl/IMPL_DONE` → `verify/PASS`, 다음 주체 **사람**. `(r3 구현 — 검증자 기입)` → `55130c1`.
- 인용 좌표 실재: `e3395ea`·`df35f2c`·`b661236`·`edb1545`·`1687c7b`·`3f40221`·`b3178a2`·`55130c1` **8건 전부** `git cat-file -t` → `commit`.
- 비고 5줄 이내: **5줄** — 위반 없음.
- `[구현자 기입]` 7필드 × 3라운드: **21** 섹션, 그중 `(r3)` **7**. 산문으로 접힌 필드 0.
- trailer 파싱: `55130c1` 8키 그대로 반환. `Agent: claude`(비기능 구현은 Claude 담당) · `Criteria-Met: 10/15` 허용값.
- `AGENTS.md` 변경: 없음.
- **archive 이동은 보류한다** — ⚠️ 5 AC 가 사람 실기 대기이고 V1 이 사용자 결정을 기다린다. 0201·0202 와 같은 처리다.

## 12. 구현자 코멘트 / 선조치 경계 (r3)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 EP-11 분모 3 → 실측 5 로 재계수 → 선조치 | **타당.** 술어를 더 넓혀 재측정해도 차집합 0. 닫힌 지점이 명명된 수보다 많다 | 인정 — 설계자 분모 부정확은 `NON_BLOCKING` 기록 |
| #2 `PinnedProjectChildren` export → 선조치 | **타당.** D7 의 등록 변이(M17)가 이제 검출된다 | 인정 — D7 **closed** |
| #3 fixture `TS2769` 3건 → 캐스트 헬퍼 → 선조치 | **타당.** 프로덕션 참조 0건 확인 | 인정 |
| #4 `@ts-expect-error` 가 여러 줄 호출을 못 덮음 → props 호이스팅 | **타당.** 셋 다 지우면 브랜드 오류 3건이 정확히 남는 것을 확인 | 인정 — AC15 ✅ |
| 강제 지점 **16/16** 자기보고 | **재계수 결과와 일치** | 인정 |
| `Criteria-Met: 10/15` | 독립 재계수와 **일치** | 인정 |

## 13. Finding disposition (r3)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| **V1** | **어댑터가 프로젝트 하위 목록을 아예 넘기지 않아도 무관측이다.** `PinnedProjectsSection.tsx:146` 의 `sessions={projectChildren[project.id]}` 를 `sessions={undefined}` 로 바꿔도 **499 초록 · typecheck 0** | 비귀속 — VP-18 은 *잘못된 칸*을 잠그고 이 변이는 *칸 없음*이다 | **NON_BLOCKING** | **ACTIVE Decision 아래에서 닫히지 않는다**: `undefined` 는 "미조회"라는 정당한 값이라 타입이 가르지 못하고, 하위 목록은 `expanded` 상태 뒤라 SSR 이 닿지 못한다(D-013 이 렌더 하네스를 배제). 닫으려면 **D-013 재검토**가 필요하다 — 사용자 결정 |
| — | §7-C 의 EP-11 분모 `3` 이 실측 `5` 와 다르다 | plan §10 정확성 | **NON_BLOCKING** | 구현자가 5/5 로 닫았다. 다음 Delta V 가 열리면 분모를 5 로 정정한다 |
| D7 | AT-13 의 프로젝트 절반이 공허 | verify r2 · VP-16→18 | — | **closed (r3)** — M17 이 1 failed 로 검출 |
| G4 | 파티션↔렌더 이음매 무관측 | verify r2 · VP-05a→05b | — | **closed (ΔV2 + r3)** — M15 가 `TS2322`, 세 어댑터 전부 잠김 |
| D2·D3·D4·D5·D6·D8·D9·D10 | r1·r2 등록분 — 변화 없음 | 각 라운드 참조 | 유지 | 판정 그대로 |

## 14. Review Signals (r3) — 사실만

- 이전 라운드와 동일/유사 증상: **축은 같고 표면은 매 라운드 줄었다.** r1 = 배치 규칙 전체가 무관측 → r2 = 어댑터 3줄 → r3 = 접힌 subtree 안 배선 1줄(V1). "장치가 주장하는 범위 ≠ 실제로 반응하는 범위"가 네 번째 변주다.
- 관련 plan 지침/AC 의 존재 여부: `handoff-plan §5` 의 음성 게이트 양성 짝 규칙이 r1 시점부터 있었고, ΔV2 의 AT-13a 가 그것을 **구획마다** 요구하도록 문장을 좁힌 뒤 r3 에서 성립했다.
- 사용자 결정 변경 근거: 없음. D-013(렌더 하네스 미도입)은 이번 라운드에도 유지됐고, **V1 은 그 결정이 만든 관측 한계 안에 있다**.
- 반복된 검증 환경 한계: **3건 유지** — ① better-sqlite3 ABI(48케이스) ② Electron GUI 부재(시각 5 AC) ③ store 구독 컴포넌트·상태 뒤 subtree 의 SSR 한계(③ 의 일부를 이번에 타입으로 우회했다).
- 라운드 수: **3** — `docs/handoff/AGENTS.md §handoff-review 트리거` 의 "impl 라운드가 3을 **초과**"에 아직 못 미친다. r4 가 열리면 재구현 전에 `handoff-review` 를 수행한다.

## 15. 결론 (r3)

- 상태: **PASS**
- pair 결과: **PASS 12** · `PAIR_FAIL` **0** · `PLAN_GAP` **0** · 미판정(사람 실기) **4** · `SUPERSEDED` 2
- Product/UX 및 ACTIVE Decision: **D-001~D-014 전건 충족**, 코드에 요구 위반 0
- AC: `✅ 10 · ⚠️ 5 · ❌ 0 = 15` (자기보고와 일치)
- 운영 gate: **4종 전부 PASS**, 트리 변화 0, 잔여물 0
- 남은 것은 둘 다 **사람 몫**이다 — ⚠️ 5 AC 의 시각/IPC 실기, 그리고 V1 을 닫기 위한 **D-013 재검토 여부**. 둘 중 어느 것도 현재 구현의 결함이 아니다.
