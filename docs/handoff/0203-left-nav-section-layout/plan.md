# Plan — left-nav-section-layout

> 좌측 nav 를 **메뉴 · 프로젝트 · 고정됨 · 최근 대화** 4구획으로 가르고, 한 대화가 정확히 한 구획에만 보이게 한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0203-left-nav-section-layout` |
| 작성자 | Claude Code |
| 일자 | 2026-08-27 |
| 매핑 | 브랜치 `claude/handoff-left-nav-layout-qhek9m` |
| 상태 | DRAFT → READY |
| V mode | `Baseline V + ΔV1` |
| 기준 V | `none` — 선행 0129 는 구 템플릿이라 상속할 V node/pair 가 없다 |
| 이번 V revision | `ΔV1` — verify r1 의 `PLAN_GAP` G1·G2·G3 정정. 구 행은 덮어쓰지 않고 supersede |
| 유효 V | `V1 + ΔV1` |

### 기준선 잠금의 한계 (사후 작성)

**판정: 이 plan 은 구현 도착 *후* 작성된 기준선이다.** 구현 5커밋(`4bb0948`·`b88ea27`·`33ec6ef`·`c700595`·`e3395ea`)이 모두 `Handoff: none` 으로 먼저 도착했고 사용자가 "수정 후 핸드오프 문서를 작성하겠다"고 지정했다.

- 카브아웃 오적용이다 — `docs/handoff/AGENTS.md §카브아웃` 은 트리비얼·handoff 메타 수정만 `Handoff: none` 을 허용하고 "애매하면 handoff 를 생성한다"고 적는다. 5커밋은 nav 구조 변경이라 어느 쪽도 아니다.
- 따라서 `handoff-verify §0` 의 "구현 전 plan 을 diff 로 꺼낸다"는 수행할 수 없다. 대신 **위 5개 커밋 해시가 기준선**이고, 검증자는 이 plan 커밋 이후의 `app/**` 변경을 재구현으로 센다.
- 이 plan 은 규범 행(Decision·AC·V node/pair·§10)만 담는 **설계 커밋**이다. 구현 산출과 같은 커밋에 담지 않는다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 좌측 nav 가 **메뉴 · 고정됨 · 최근 대화** 3구획이라 고정 프로젝트와 고정 대화가 "고정됨" 한 곳에 섞였고, 고정한 대화가 "최근 대화"에도 그대로 남아 같은 대화가 두 번 보였다.
- 완료 후 달라지는 것: 구획이 4개로 갈리고, 고정 프로젝트는 전용 "프로젝트" 구획이 갖고, 대화 고정은 **복제가 아니라 이동**이 된다.
- 성공을 사용자 관점 한 문장으로: 대화 하나를 nav 에서 찾을 때 볼 곳이 항상 한 군데다.

## 2. 사용자 의도 / 요구 출처

> 조건절·강조는 원문 그대로 인용한다(요구 5 의 `**이동**` 포함).

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | "메뉴, 프로젝트, 고정됨, 최근 대화 4개로 구분한다." | 라이브 세션 (2026-08-27) |
| 명시 요구 2 | "프로젝트는 고정된 프로젝트를 나열한다." | 〃 |
| 명시 요구 3 | "우측에 + 버튼을 설치하지 말 것." | 〃 |
| 명시 요구 4 | "프로젝트를 고정할 시, 고정됨 메뉴가 아닌 프로젝트 메뉴의 항목으로 추가된다." | 〃 |
| 명시 요구 5 | "일반대화, 프로젝트 하위 대화는 고정 버튼 클릭 시 고정됨 메뉴의 하위로 **이동**한다. 다른 메뉴의 하위로 보이면 안된다." | 〃 |
| 명시 요구 6 | "고정된 프로젝트 항목을 클릭시, nav 상단의 프로젝트가 클릭된 효과가 보이면 안된다." | 〃 |
| 추론 의도 A | 배치 우선순위 = 고정 대화 > 고정 프로젝트의 대화 > 최근 대화 | 추론 — 요구 5 의 "다른 메뉴의 하위로 보이면 안된다"가 상호배타를 요구하므로 전순서가 필요하다 |
| 추론 의도 B | 프로젝트·고정됨 구획은 접기/펼치기 가능하고 **비어 있어도 헤더를 유지**한다 | 추론 — 요구 1 의 "4개로 구분한다"가 항상 4구획을 뜻한다고 읽었다. 0129 의 "고정 항목 0 → 섹션 미렌더"를 대체한다 |
| 추론 의도 C | 고정 프로젝트 하위 대화 행도 최근 대화 행과 같은 kebab(고정·이름변경·삭제)을 갖는다 | 추론 — 요구 5 가 "프로젝트 하위 대화"의 고정 버튼 클릭을 전제하므로 그 행에 고정 버튼이 있어야 한다 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 좌측 nav 는 메뉴 · 프로젝트 · 고정됨 · 최근 대화 4구획이다 | 요구 1 | 사용자 턴 | ACTIVE | — |
| D-002 | "프로젝트" 구획은 **고정된** 프로젝트만 나열한다 (전체 프로젝트 목록이 아니다) | 요구 2 | 사용자 턴 | ACTIVE | — |
| D-003 | "프로젝트" 구획 헤더 우측에 추가(+) 버튼을 두지 않는다 | 요구 3 — "설치하지 말 것" | 사용자 턴 | ACTIVE | — |
| D-004 | 프로젝트 고정의 목적지는 "프로젝트" 구획이다. "고정됨"은 프로젝트를 담지 않는다 | 요구 4 | 사용자 턴 | ACTIVE | — |
| D-005 | 대화 고정은 **이동**이다 — 원래 구획에서 사라지고 "고정됨" 하위에만 남는다 | 요구 5. "이동"을 "복제"나 "강조"로 재해석하지 않는다 | 사용자 턴 | ACTIVE | — |
| D-006 | 배치 우선순위는 고정 대화 > 고정 프로젝트의 대화 > 최근 대화이고, 판정은 단일 함수가 갖는다 | 추론 A — 세 구획이 각자 필터를 가지면 상호배타를 아무도 보장하지 않는다 | 추론 | ACTIVE | — |
| D-007 | 상단 "프로젝트" 메뉴의 활성 판정은 `/projects` **정확 일치**다 | 요구 6 — `/projects/:id` 에서 상단 메뉴가 켜지면 안 된다 | 사용자 턴 | ACTIVE | — |
| D-008 | 프로젝트·고정됨 구획은 접히고, 항목이 0개여도 헤더는 남는다 | "nav 가 항상 4구획으로 일정하고, 고정 기능이 있다는 것을 사용자가 발견할 수 있다" | **사용자 결정 (2026-08-27)** — ΔV1 에서 추론 → 승인으로 승격 | ACTIVE | 0129 "고정 항목 0 → 섹션 미렌더" 대체 |
| D-009 | 고정 프로젝트 하위 대화 행도 고정·이름변경·삭제 kebab 을 갖는다 | 추론 C — 요구 5 가 그 행의 고정 버튼을 전제한다 | 추론 | ACTIVE | 0129 "하위 행은 선택 전용" 대체 |
| D-010 | 프로젝트 랜딩(`/projects/:id`)의 "이 프로젝트의 대화" 패널은 배치 규칙 밖이다 | 요구 5 는 nav 의 "메뉴 하위"를 말한다. 랜딩 패널은 nav 가 아니다 | 추론 | ACTIVE | — |
| D-011 | renderer 세션 엔티티의 정본은 `sessionsStore.byId` 하나이고 각 목록은 ID membership 만 갖는다 | 네 목록이 같은 대화를 그리므로 사본이 갈라지면 구획마다 다른 제목·고정 상태가 보인다 | 추론(구현 전제) | ACTIVE | — |
| D-012 | 세 구획의 배치 파생을 **순수 파티션 함수 하나**가 소유하고, 구획 컴포넌트는 **props 로 받은 목록만 렌더**한다 | 구획이 각자 필터를 들고 있으면 그 필터를 지웠을 때 실패하는 장치를 만들 수 없다 — verify r1 M1 이 실측(필터 소거 후 renderer 478케이스 초록) | **사용자 결정 (2026-08-27, 선택지 A)** | ACTIVE | — |
| D-013 | 구획 렌더 단언은 `react-dom/server`의 `renderToStaticMarkup` 으로 하고 **렌더 하네스(jsdom·testing-library)는 도입하지 않는다** | 신규 devDependency 0. 스파이크로 `environment: 'node'` 에서 동작 확인 | **사용자 결정 (2026-08-27, 선택지 A)** | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-011 전부 (Baseline — 선행 handoff 의 ACTIVE ledger 없음).
- 변경된 결정: 없음. 다만 D-008·D-009 는 **0129 plan 의 문장을 대체**한다 — `docs/handoff/0129-sidebar-pin-title-autosize/plan.md:144`("고정 항목 0 → \"고정됨\" 섹션 자체 미렌더")와 같은 문서의 "하위 행은 선택 전용(고정/이름변경/삭제 없음)". 0129 는 archive 이력이라 이 plan 이 현재 정본이다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 없음.
- **ΔV1 갱신(2026-08-27)**: 신규 D-012·D-013(사용자 선택지 A) · D-008 provenance 추론 → **사용자 결정**. SUPERSEDED 결정 **0** — 요구 6개와 D-001~D-011 의 문장은 하나도 바뀌지 않았다. ΔV1 은 *증거*만 바꾼다.
- **ΔV1 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-012↔AT-13(구획이 props 를 재파생하지 않는다)·AT-06a(파티션이 배치를 소유) · D-013↔AT-05a·AT-13 의 oracle 이 `renderToStaticMarkup` 이고 신규 의존성 0 · D-008↔AT-09(빈 헤더 유지, 이제 사용자 승인) · **D-005 ↔ AT-05a 방향 일치**(둘 다 "이동", 복제 아님) · D-006 ↔ EP-1a(단일 소유) — **반대를 요구하는 AC 0건**.
- **`ACTIVE 결정 ↔ AC` 대조**(V1): 충돌 0. D-001↔AC1(4구획 순서) · D-002↔AC2 · D-003↔AC3 · D-004↔AC4 · D-005↔AC5·AC6 · D-006↔AC6·AC7 · D-007↔AC8 · D-008↔AC9 · D-009↔AC10 · D-010↔§6 비범위(AC 없음, 의도적) · D-011↔AC11·AC12. **반대를 요구하는 AC 0건** — 특히 AC5 는 "이동"을, AC3 은 "+ 버튼 0건"을 각각 D-005·D-003 과 같은 방향으로 단언한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 중복 노출의 직접 원인은 `git show cc4cde5:…/SessionList.tsx` 가 `list` 를 필터 없이 전부 렌더한 것 — 고정 세션이 "고정됨"과 "최근 대화" 양쪽에 나온다 |
| 이미 기존 코드가 충족하는가 | 아니오 | 같은 커밋의 `PinnedSection.tsx:58` 이 `pinnedProjects` 와 `pinnedSessions` 를 한 섹션에 함께 렌더한다 |
| 더 작은 해법이 있는가 | 없음 | 요구 1 이 구획 수를 지정한다. 필터만 고쳐서는 D-001·D-002·D-004 를 만족할 수 없다 |
| 제거 요구인가 — 능력 자체가 없어도 되는가 | 요구 3(+ 버튼)은 **신설 금지**지 기존 능력 제거가 아니다 | 좌측 nav 에는 애초에 + 버튼이 없었다(§8 전수 조사) — "프로젝트 추가"는 `/projects` 화면이 계속 갖는다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 | 0129 plan §C 가 설계한 단일 "고정됨" 섹션이 실제 `cc4cde5` 코드와 일치했다 — 이 plan 이 그 설계를 대체한다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 부분 충돌 → D-008·D-009 로 명시 대체 | 0129 의 "빈 섹션 미렌더"·"하위 행 선택 전용" 두 문장 |

- 사용자에게 올릴 결정: **D-008 하나** — 고정 항목이 0개일 때 "프로젝트"·"고정됨" 헤더가 빈 채로 보인다. 요구 1("4개로 구분한다")을 항상-4구획으로 읽은 추론이고, 0129 는 반대(빈 섹션 숨김)였다. 시각 확인 시 어느 쪽인지 확정해 주면 D-008 을 갱신한다.
- 코드 조사로 닫은 사실: 좌측 nav 의 + 버튼 유무 · 배치 판정 지점 수 · 상단 메뉴 활성 술어 · 프로젝트 membership 갱신 트리거(§8).

## 5. 동작 / 사용자 흐름

```text
[대화 행 kebab → 고정]
  → sessionApi.setPinned → sessionsStore.byId 패치(pinnedAt=now)
  → 배치 판정이 'pinned' 로 바뀜
  → "고정됨" 하위에 나타나고 원래 구획(최근 대화 / 프로젝트 하위)에서 사라짐
  ↘ IPC 실패 → 엔티티 패치 없음 → 행이 원래 자리에 남음

[고정 프로젝트 행 클릭]
  → navigate('/projects/<id>')
  → 프로젝트 랜딩 표시, 상단 "프로젝트" 메뉴는 비활성 유지
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 최근 대화 행 고정 | `pinnedAt=now` 패치 | "최근 대화"에서 사라지고 "고정됨" 최상단에 나타난다 |
| 고정 프로젝트 하위 대화 고정 | 〃 | 프로젝트 하위에서 사라지고 "고정됨"으로 옮겨간다 |
| 고정 대화 해제 | `pinnedAt=null` 패치 | 소속이 고정 프로젝트면 그 프로젝트 하위로, 아니면 "최근 대화"의 `updatedAt` 순 위치로 복귀 |
| 프로젝트 고정 | `projectApi.setPinned` | "프로젝트" 구획에 최근 고정 순 최상단으로 추가. "고정됨"은 변화 없음 |
| 프로젝트 고정 해제 | 〃 | "프로젝트" 구획에서 빠지고, 그 프로젝트의 비고정 대화가 "최근 대화"로 복귀 |
| 고정 프로젝트 행 클릭 | `/projects/:id` 이동 | 랜딩 표시. 상단 "프로젝트" 메뉴에 활성 표시 없음 |
| 구획 헤더 클릭 | 로컬 `expanded` 토글 | 본문이 접히고 헤더만 남는다 |

### 파생 UX / 엣지케이스

- empty: 고정 항목 0 → 헤더만 남는다(D-008). 프로젝트 하위 대화 0 → `sessions.empty` 문구. 조회 중 → `common.loading`.
- error: 프로젝트 하위 조회 실패는 빈 membership 으로 확정해 로딩 표시가 영원히 걸리지 않는다.
- 접힌 사이드바: 도메인 슬롯을 노출하지 않고 상단 메뉴 아이콘만 그린다 — 4구획 규칙은 확장 상태에만 적용된다.
- a11y: 구획 헤더는 `aria-expanded`/`aria-controls` 를 갖는 버튼, 상단 메뉴는 활성 시 `aria-current="page"`.
- concurrency: 같은 대화가 여러 구획의 memo 된 행으로 존재하지 않는다 — 엔티티 1개를 구획 하나가 그린다.

## 6. 범위 / 비범위

- **범위**: 좌측 nav 확장 상태의 구획 구성·배치 규칙·상단 메뉴 활성 술어·구획별 행 액션, 그리고 이를 가능하게 하는 renderer 세션 엔티티 정본 통합.
- **비범위**: 프로젝트 랜딩의 "이 프로젝트의 대화" 패널의 배치 규칙(D-010 — 그 화면은 프로젝트 컨텍스트가 이미 명확해 고정 대화를 숨기면 오히려 목록이 비어 보인다) · 접힌 사이드바 · 프로젝트 생성 UI · main 프로세스·DB·IPC 계약.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 고정 프로젝트 파생(`pinnedProjects`)의 순수 seam 추출 | 아니오 — 2줄 파생이고 `pinnedProjectIds` 경유로 `placementOf` 테스트가 같은 술어를 간접 고정한다 | 후속(§17 R-3) |
| 프로젝트 membership 의 turn-end 갱신 | 아니오 — 화면 재진입/재펼침으로 회복된다 | 후속(§17 R-1) |
| 렌더 하네스 도입(구획 순서·빈 상태 자동 검증) | 아니오 — 신규 devDependency 는 사용자 승인 사항(0201 AC16 선례) | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 확장 사이드바가 메뉴 → 프로젝트 → 고정됨 → 최근 대화 순으로 4구획을 보인다 | 사람 실기 — DOM 마커 `app-frame-sidebar-nav` → `-projects` → `-pinned` → `-sessions` 가 이 순서로 존재 | `App → AppLayout → Sidebar` 확장 렌더 |
| R-02 | ~~AT-02 / AC2~~ → **AT-02a (§7-B)** | "프로젝트" 구획은 고정된 프로젝트만, 최근 고정 순으로 나열한다 | 사람 실기 — 프로젝트 2개를 순서대로 고정하면 나중 고정이 위 | `useSessionHandlers.pinnedProjects → useSidebarSlots.projectsSlot → PinnedProjectsSection` |
| R-03 | AT-03 / AC3 | "프로젝트" 구획 헤더에 추가(+) 버튼이 없고, 헤더의 컨트롤은 접기 토글 하나다 | 음성+양성 쌍 — nav subtree 에 `Icon name="plus"` 0건(§8 전수) **이면서** 헤더 버튼이 `aria-expanded` 를 갖는 1개 | 위와 같음 |
| R-04 | AT-04 / AC4 | 프로젝트를 고정하면 "프로젝트" 구획에 나타나고 "고정됨"에는 나타나지 않는다 | 사람 실기 + 구조 단언 — `PinnedSection` 이 `Project` 타입을 import 하지 않는다(세션 전용 props) | `ProjectsScreen/ProjectInfoHero 고정 → projectsStore → pinnedProjects` |
| R-05 | ~~AT-05 / AC5~~ → **AT-05a (§7-B)** | 대화 고정 시 그 대화가 "고정됨" 하위로 **이동**한다 — 최근 대화·프로젝트 하위에서 사라진다 | 순수 — `sessionPlacement.test.ts` "고정 대화는 프로젝트 소속과 무관하게 고정됨이 가져간다"(2단언) | `SessionRow kebab → setPinned → byId 패치 → 세 구획 재판정` |
| R-05 | ~~AT-06 / AC6~~ → **AT-06a (§7-B)** | 어떤 대화도 두 구획에 동시에 나타나지 않고, 모든 (고정×소속) 조합이 정확히 한 구획에 배치된다 | 순수 — 같은 파일 "모든 조합이 정확히 한 섹션에 배치된다"(6조합 전수 배열 비교) | 위와 같음 |
| R-05 | ~~AT-07 / AC7~~ → **AT-07a (§7-B)** | 고정 해제 시 소속이 고정 프로젝트면 그 하위로, 아니면 최근 대화의 `updatedAt` 위치로 복귀한다 | 순수 — 같은 파일 "고정 프로젝트의 비고정 대화는 그 프로젝트 하위가 가져간다" + "고정되지 않은 프로젝트의 대화는 최근 대화로 복귀한다" | 위와 같음 |
| R-06 | AT-08 / AC8 | `/projects/:id` 에서 상단 "프로젝트" 메뉴가 활성이 아니고, `/projects` 에서는 활성이다 | 순수 — `navItems.test.ts` 신규 케이스: `SIDEBAR_NAV[1].isActive('/projects/abc') === false` **및** `isActive('/projects') === true` | `PinnedProjectsSection 행 클릭 → handleOpenProject → navigate → Sidebar aria-current` |
| R-01 | AT-09 / AC9 | 프로젝트·고정됨 구획은 헤더 클릭으로 접히고, 항목 0개여도 헤더가 남는다 | 사람 실기 — 고정 0 상태에서 두 헤더가 보이고 클릭 시 본문만 접힌다 | `CollapsibleSection` |
| R-05 | AT-10 / AC10 | 고정 프로젝트 하위 대화 행의 kebab 에 고정·이름변경·삭제가 모두 있다 | 사람 실기 — 하위 행 hover → kebab → 3항목 | `PinnedProjectsSection → SessionRow(onTogglePin·onRename·onDelete)` |
| R-07 | AT-11 / AC11 | 한 대화의 이름변경·고정·삭제가 모든 목록에 즉시 같은 값으로 반영된다 | 순수 — `sessionsStore.test.ts` "recent와 project membership이 동일한 세션 객체를 가리킨다" + "rename은 프로젝트 전용 세션도 공용 엔티티에서 즉시 갱신한다" | `sessionsActions.rename/setPinned/remove → patchSession → 모든 구독자` |
| R-07 | AT-12 / AC12 | 프로젝트 랜딩에서 대화를 삭제·이름변경하면 DB 에 반영되어 재부팅 후에도 유지된다 | 사람 실기 — 랜딩에서 삭제 후 앱 재시작 시 목록에 없음 | `ProjectLandingPage → useSessionActions → sessionsActions → IPC` |

### AC 검증 주의사항

- 기존 테스트 재사용 — 실재 확인: `sessionPlacement.test.ts` 는 `describe` 2 · `it` **5**, `sessionsStore.test.ts` 는 `it` 2 로 인용한 케이스명이 모두 존재한다. `navItems.test.ts` 는 **1케이스(플러그인 항목)뿐이고 `/projects` 술어 케이스가 없다** — AC8 은 신규 케이스를 요구한다.
- 사람 실기로 남긴 항목과 이유: AC1·AC9(구획 순서·빈 상태 = 시각) · AC2·AC4·AC10(React hook/컴포넌트 렌더 결과, 렌더 하네스 없음 — 신규 devDependency 는 사용자 승인 사항) · AC12(electron IPC + DB 영속). **로직은 사람에게 넘기지 않았다** — 배치 판정 전체(AC5·AC6·AC7)와 엔티티 정본(AC11), 활성 술어(AC8)는 순수 테스트가 갖는다.
- 총량/0건 기준의 분해: AC3 의 `plus` 0건은 **좌측 nav subtree 한정**이다. 허용 대상으로 먼저 빼는 것 — 상단 메뉴 "새 대화"(`navItems.ts:6`)와 프로젝트 상세 우측 패널 카드(`SidebarCard.tsx:36`)는 이 구획이 아니다. 제거 대상은 "프로젝트 구획 헤더의 추가 액션"이고 현재 0건이다.
- 음성 게이트 방향: AC3 은 0건만 잠그므로 **양성 짝**(헤더 컨트롤 = `aria-expanded` 버튼 1개)과 함께 센다. 접기 토글을 지우면 양성 단언이 깨진다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 선행 0129 는 구 템플릿(V node/pair 없음)이라 상속할 명시 V 가 없다.
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: R (사용자 관측 결과부터 바뀐다).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 구획 구성 | NEW | — |
| R-02 | R | §7 고정 프로젝트 나열 | NEW | — |
| R-03 | R | §7 + 버튼 금지 | NEW | — |
| R-04 | R | §7 프로젝트 고정 목적지 | NEW | — |
| R-05 | R | §7 대화 고정 = 이동 | NEW | — |
| R-06 | R | §7 상단 메뉴 활성 술어 | NEW | — |
| R-07 | R | §7 엔티티 정본·영속 | NEW | — |
| AT-01…AT-12 | AT | §7 | NEW | — |
| SD-01 | SD | §5 상태 전이표 · §9 TO-BE | NEW | — |
| ST-01 | ST | §7 AC5·AC7 실기/순수 조합 | NEW | — |
| AR-01 | AR | §9 셸 슬롯 조립 · §10 EP-4·EP-5 | NEW | — |
| IT-01 | IT | §7 AC1·AC4·AC8 | NEW | — |
| AR-02 | AR | §9 엔티티 정본 ↔ 4소비자 · §10 EP-6·EP-7 | NEW | — |
| IT-02 | IT | §7 AC11·AC12 | NEW | — |
| MD-01 | MD | §10 EP-1~EP-3 · §11 `sessionPlacement.ts` | NEW | — |
| UT-01 | UT | `sessionPlacement.test.ts` | NEW | — |
| MD-02 | MD | §11 `navItems.ts` 술어 | NEW | — |
| UT-02 | UT | `navItems.test.ts` 신규 케이스 | NEW | — |
| MD-03 | MD | §11 `sessionsStore` byId/membership | NEW | — |
| UT-03 | UT | `sessionsStore.test.ts` | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `AppLayout → useSidebarSlots → Sidebar 확장 렌더` | 사람 실기 — DOM 마커 4개 순서 | not selected — 직접 시각 관측 | 0 + 시각 순서에는 강제 지점이 없다 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `projectsStore → useSessionHandlers.pinnedProjects → PinnedProjectsSection` | 사람 실기 — 고정 2건의 순서 | not selected — 직접 실기 | 0 + 파생이 단일 지점(§8) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 위와 같음 | 음성 전수(`plus` 0건) + 양성(접기 토글 1개) | **required** — 접기 토글을 지우면 양성 단언이 실패해야 한다(방향 확인) | EP-8 (1) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `프로젝트 고정 → projectsStore → 두 구획 각각의 소비` | 구조 단언 — `PinnedSection` 의 `Project` import 0건 + 사람 실기 | **required** — `PinnedSection` 에 프로젝트 행을 되돌리면 실패해야 한다 | EP-5 (1) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | `SessionRow kebab → setPinned → patchSession → placementOf` | 순수 `placementOf` 2단언 | not selected — 직접 행동 결과 관측 | EP-1·EP-2·EP-3 (3) |
| VP-06 | R-05 ↔ AT-06 | REQUIRED | 위와 같음 | 순수 6조합 전수 배열 비교 | not selected — 전수 열거가 직접 oracle | EP-1·EP-2·EP-3 (3) |
| VP-07 | R-05 ↔ AT-07 | REQUIRED | `해제 → pinnedAt=null → placementOf` | 순수 2단언 | not selected — 직접 관측 | EP-1·EP-2·EP-3 (3) |
| VP-08 | R-06 ↔ AT-08 | REQUIRED | `행 클릭 → handleOpenProject → navigate → SIDEBAR_NAV[1].isActive` | 순수 술어 2단언(참·거짓 양방향) | not selected — 술어를 직접 호출한다 | EP-4 (1) |
| VP-09 | SD-01 ↔ ST-01 | REQUIRED | §5 전이표 7행의 종단 경로 | AC5·AC7 순수 + AC2·AC10 실기 조합 | not selected — 각 전이의 결과를 직접 본다 | EP-1~EP-3 (3) |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | `Sidebar props 4슬롯 ← useSidebarSlots ← useSessionHandlers` | AC1·AC4·AC8 | not selected | EP-4·EP-5·EP-8 (3) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | `IPC → sessionsStore.byId ← 4개 nav 렌더 지점 + 랜딩 패널` | AC11 순수 2케이스 + AC12 실기 | not selected — 상태 결과를 직접 읽는다 | EP-6·EP-7 (2) |
| VP-12 | MD-03 ↔ UT-03 | REQUIRED | `loadProject/rename → mergeItems/patchSession → byId` | `sessionsStore.test.ts` 2케이스 | not selected | EP-6·EP-7 (2) |

> `NOT_REQUIRED` 행 없음 — Baseline V 라 상속한 비영향 pair 가 존재하지 않는다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| renderer subtree 정적 게이트 | `app/src/renderer/**` 를 수정한다 (`app/src/renderer/AGENTS.md §테스트`) | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| 관련 순수 테스트 | AC5~AC8·AC11 의 oracle | `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/sessions src/renderer/src/app/navItems.test.ts` | 인용 케이스 실패만 blocking |
| 문서 링크 게이트 | `docs/handoff/INDEX.md` 에 이 plan 링크를 추가한다 (`check-doc-inventory.mjs:346` — 보드는 링크 검사 대상) | `cd app && node scripts/check-doc-inventory.mjs --check` | 이번에 추가한 링크의 파손만 blocking |
| 커밋 trailer 파싱 | 설계 커밋이 메시지 버스다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

- 환경 한계: 이 설계 턴의 컨테이너에 `app/node_modules` 가 없어(`ls app/node_modules` → 부재) 게이트를 실행하지 않았다. 실행은 구현/검증 턴 몫이다.


## 7-B. ΔV1 — verify r1 `PLAN_GAP` 정정

> **적용 순서: `V1` → `ΔV1`.** verify r1(`b661236`)이 `RETURN_TO_PLAN` 으로 돌린 G1·G2·G3 을 여기서 닫는다. 구 행은 §7·§7-A·§10 에 그대로 두고 `SUPERSEDED` 로 가리킨다 — 무엇이 왜 바뀌었는지 되짚을 수 있어야 한다.

### 무엇이 왜 바뀌는가

| gap | 진단 | ΔV1 의 답 |
|---|---|---|
| **G2** (root) | `NEW` 왼쪽 노드 `MD-01`·`MD-02`·`R-07` 에 같은 레벨 `REQUIRED` pair 가 없었다 | pair 3개(VP-13·VP-14·VP-15) 신설 |
| **G1** | AC5~07 의 oracle 이 `placementOf` 반환값만 봐서, 세 구획의 필터를 지워도 renderer 478케이스가 초록이었다 | **강제 지점을 3곳 → 1곳으로 접는다** — 배치 파생을 순수 파티션 함수 하나가 갖고 구획은 props 만 렌더한다(D-012). 필터를 지우면 파티션 UT 가 실패한다 |
| **G3** | AT-02 가 순수 파생(`filter + sort`)인데 oracle 이 사람 실기뿐이었다 | 파생을 `lib/` 순수 seam 으로 내리고 AT-02a 로 정정 |

### 설계 근거 — 이번 턴에 측정한 스파이크

| 관측 | 결과 | 설계에 미친 영향 |
|---|---|---|
| `renderToStaticMarkup` 이 현재 `environment: 'node'` 에서 도는가 | **된다** — `PinnedSection` 이 헤더·i18n·SVG 까지 렌더됐다. 신규 의존성 0(`react-dom` 은 이미 devDependency) | D-013 의 근거 |
| store 를 직접 구독하는 컴포넌트를 SSR 렌더하면 | **목록이 빈 채로 렌더된다** — zustand 가 SSR 에서 초기 스냅샷을 돌려준다(`setState` 로 넣은 2건이 출력에 없었다) | store 구독 컴포넌트는 렌더 단언 대상이 될 수 없다 → **props 전환이 필요조건** |
| props 로 목록을 받는 컴포넌트를 SSR 렌더하면 | **정상 렌더** — `SessionRow` 2건이 제목까지 출력됐다 | AT-05a~07a·AT-14 의 oracle 성립 |
| `vitest.config.ts` 의 `include` | `['src/**/*.test.ts']` — **`.tsx` 미포함** | 렌더 테스트는 `React.createElement` 로 `.test.ts` 에 쓴다(JSX 불필요). config 변경 없음 |

### ΔV1 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| MD-01a | MD | §10 EP-1a · §11 `navSections.ts` 파티션 함수 | **CHANGED** | `V1:MD-01` 대체 |
| UT-01a | UT | 파티션 전수·상호배타 단위 테스트 | **CHANGED** | `V1:UT-01` 대체 |
| MD-02 | MD | §11 `navItems.ts` 술어 | INHERITED | `V1:MD-02` — 내용 무변경, pair 만 신설 |
| AR-03 | AR | §10 EP-9 · 구획 컴포넌트의 props 계약 | **NEW** | — |
| IT-03 | IT | SSR 렌더 단언 | **NEW** | — |
| MD-04 | MD | §11 `pinnedProjectsOf` 순수 파생 | **NEW** | — |
| UT-04 | UT | 고정 프로젝트 필터·정렬 단위 테스트 | **NEW** | — |
| R-01·R-02·R-05·R-07 | R | §7 | INHERITED | `V1` — 요구 문장 무변경, 증거만 바뀐다 |

### ΔV1 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-13 | MD-01a ↔ UT-01a / UT | REQUIRED | `splitNavSections(입력) → {pinned, recent, childrenOf}` | 전수 파티션 단언 — 임의 (고정×소속) 조합 집합에 대해 세 출력이 **서로소이고 합집합 = 입력** | not selected — 전수 열거가 직접 oracle | EP-1a (1) |
| VP-14 | MD-02 ↔ UT-02 / UT | REQUIRED | `SIDEBAR_NAV[1].isActive(pathname)` | `navItems.test.ts` 술어 2단언(참·거짓 양방향) | **required** — `startsWith` 복귀 변이. r1 에서 이미 검출 확인 | EP-4 (1) |
| VP-15 | R-07 ↔ AT-11·AT-12 / AT | REQUIRED | `sessionsActions.* → patchSession → 모든 구독자` | AT-11 순수 2케이스 + AT-12 실기 | not selected | EP-6·EP-7 (2) |
| VP-16 | AR-03 ↔ IT-03 / IT | REQUIRED | `props 목록 → 구획 컴포넌트 → renderToStaticMarkup 출력` | 구획에 목록 N건을 주면 **그 N건만** 출력에 나타난다 | **required** — 컴포넌트 안에서 목록을 재파생하는 변이(props 무시)를 심어 실패를 확인 | EP-9 (3) |
| VP-17 | MD-04 ↔ UT-04 / UT | REQUIRED | `pinnedProjectsOf(projects) → Project[]` | 비고정 제외 + `pinnedAt` 내림차순을 한 단언에서 본다 | not selected — 직접 반환값 관측 | EP-10 (1) |
| VP-02a | R-02 ↔ AT-02a / AT | REQUIRED | `projects → pinnedProjectsOf → PinnedProjectsSection props` | 순수 — 고정 2건의 순서와 비고정 제외 | not selected | EP-10 (1) |
| VP-05a | R-05 ↔ AT-05a / AT | REQUIRED | `kebab → setPinned → byId → splitNavSections → props → 렌더` | 파티션 UT(VP-13) + 렌더 단언(VP-16) 결합 — 고정 세션이 pinned 출력에만 나타난다 | not selected — 두 직접 oracle 의 결합 | EP-1a·EP-9 |
| VP-06a | R-05 ↔ AT-06a / AT | REQUIRED | 위와 같음 | 서로소·합집합 단언이 중복/누락을 동시에 잠근다 | not selected | EP-1a |
| VP-07a | R-05 ↔ AT-07a / AT | REQUIRED | `해제 → pinnedAt=null → splitNavSections` | 해제 후 원 구획 출력에 다시 나타난다 | not selected | EP-1a |
| VP-05·VP-06·VP-07 | — | **SUPERSEDED** | — | VP-05a·06a·07a 로 대체 | — | — |
| VP-02 | — | **SUPERSEDED** | — | VP-02a 로 대체 | — | — |

> `V1` 의 VP-01·03·04·08~12 는 ΔV1 이 건드리지 않는다 — 그 pair 의 계약·oracle·강제 지점이 그대로 유효하고 r1 에서 PASS 3건(VP-03·08·12)·사람 실기 대기 5건으로 판정됐다.

### ΔV1 Acceptance — 정정·신설

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-02 | **AT-02a** / AC2a (AT-02 대체) | "프로젝트" 구획은 고정된 프로젝트만, 최근 고정 순으로 나열한다 | 순수 — `pinnedProjectsOf([비고정, 고정t=1, 고정t=2])` → `[t=2, t=1]`. 비고정 제외와 내림차순을 한 단언에서 본다 | `projectsStore → pinnedProjectsOf → props → PinnedProjectsSection` |
| R-05 | **AT-05a** / AC5a (AT-05 대체) | 대화 고정 시 그 대화가 "고정됨" 출력에만 나타나고 최근·프로젝트 하위 출력에서는 사라진다 | 순수+렌더 — `splitNavSections` 출력에서 해당 id 가 `pinned` 에만 있고, 그 목록으로 렌더한 구획 HTML 에 그 제목이 나타나며 다른 두 구획 HTML 에는 없다 | `kebab → setPinned → byId → splitNavSections → props → 렌더` |
| R-05 | **AT-06a** / AC6a (AT-06 대체) | 어떤 대화도 두 구획에 동시에 나타나지 않고, 모든 (고정×소속) 조합이 정확히 한 구획에 배치된다 | 순수 — 조합 전수 입력에 대해 세 출력이 **pairwise 서로소**이고 **합집합이 입력과 같다**(차집합 양방향 0) | 위와 같음 |
| R-05 | **AT-07a** / AC7a (AT-07 대체) | 고정 해제 시 소속이 고정 프로젝트면 그 하위 출력으로, 아니면 최근 출력으로 돌아온다 | 순수 — 같은 입력에서 `pinnedAt` 만 `null` 로 바꾼 두 호출의 출력 차이가 정확히 그 id 의 이동이다 | `해제 → pinnedAt=null → splitNavSections` |
| R-01 | **AT-13** / AC13 (신설) | 구획 컴포넌트는 받은 목록을 **재파생하지 않는다** — props 에 없는 대화는 어떤 경로로도 출력되지 않는다 | 렌더 — 세 구획에 각각 1건짜리 목록을 주고, store 에 넣어 둔 다른 대화의 제목이 출력에 **없음**을 단언. 양성 짝: 준 1건은 **있음** | `props → 구획 → renderToStaticMarkup` |
| R-01 | **AT-14** / AC14 (신설) | 무관한 세션 변경이 다른 구획의 목록 내용을 바꾸지 않는다 | 순수 — `splitNavSections` 를 두 번 부르되 한 구획에만 영향 주는 입력 변경을 가하고, 나머지 두 출력이 **내용상 동일**함을 단언 | `byId 패치 → splitNavSections` |

**AC 게이트 재통과**(§5) — 정정·신설한 6행에 대해:

- 행동 단언·검증 수단·도달 경로: 6행 모두 세 칸을 갖는다.
- **방향**: AT-05a·AT-06a·AT-13 은 "X 가 쓰인다"를 잠근다 — 파티션 필터를 지우면 서로소 단언이 깨지고, 구획이 props 를 무시하면 AT-13 의 음성 단언이 깨진다. **여분의 사본이나 잔여물에 반응하는 장치가 아니다.**
- **음성 게이트의 양성 짝**: AT-13 의 "없음"은 같은 행의 "준 1건은 있음"과 짝지어 있다.
- structural proxy 없음 — 여섯 행 모두 행동(출력 내용)을 단언한다.
- 사람 실기로 남긴 순수 로직 없음 — AT-02a 가 G3 을 닫으며 마지막 순수 파생을 내렸다.
- 전수/차집합: AT-06a 의 완결성 주장은 **양방향 차집합 0** 으로 적었다(합계가 아니다).
- AC 총수: `V1` 12 + 신설 2 = **14**(정정 4행은 번호를 승계해 분모를 늘리지 않는다).

**G2 재발 방지 자기검사** — ΔV1 자신의 `NEW`·`CHANGED` 왼쪽 노드에 같은 레벨 pair 가 있는가: `MD-01a`→VP-13 · `AR-03`→VP-16 · `MD-04`→**VP-17**. 초안에는 `MD-04` 가 `AT` 레벨 VP-02a 만 갖고 UT pair 가 없어 G2 와 같은 형태였다 — 이 검사에서 잡아 VP-17 을 신설했다. **차집합 0.**

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 좌측 nav 는 한 스크롤 컨테이너에 `projectsSlot` → `pinnedSlot` → 최근 대화 헤더 → `sessionsSlot` 을 담는다 | `app/Sidebar.tsx:154-158` |
| 상단 메뉴는 4항목이고 활성 판정을 항목마다 갖는다 | `app/navItems.ts` — `isActive:` 4건(5번째는 `satisfies` 타입 선언) |
| 섹션 헤더 클래스는 `shared/ui/SidebarSection.tsx:7` 한 곳이 갖고 app/features 양쪽이 쓴다 | `Sidebar.tsx:8` import · `CollapsibleSection` 내부 `TOGGLE_HEAD` |
| 배치 규칙은 순수 함수 1개(`placementOf`)와 그 최우선 분기(`isPinnedSession`) | `features/sessions/lib/sessionPlacement.ts:9`·`:20` |
| 세션 엔티티 정본은 `byId`, 목록은 `recentIds`·`projectSessionIds` membership | `features/sessions/store/sessionsStore.ts:10-17` |
| `initSessions` 의 GC 루트에 `projectSessionIds` 가 포함된다 — 새 membership 을 추가하면 여기도 갱신해야 한다 | `sessionsStore.ts:69-80` (주석이 규칙을 명시) |
| 프로젝트 membership 갱신 트리거는 2곳뿐이다 | `useProjectSessions.ts:19`(마운트) · `ProjectSessionsPanel.tsx:36`(턴 종료) — `sessionsActions.refresh` 는 `recentIds`/`byId` 만 갱신 |
| renderer 4-layer 경계상 cross-feature 는 props 로만 내린다 | `app/src/renderer/AGENTS.md §4-layer DAG` — `pinnedProjects`·`pinnedProjectIds` 를 셸이 주입하는 이유 |
| 렌더 하네스가 없다 — UI 는 시각 검증으로 갈음한다 | `app/src/renderer/AGENTS.md §테스트` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `SessionRow` 렌더 지점 | `rg "<SessionRow" app/src/renderer/src` | 5 | nav 4 + 프로젝트 랜딩 1 |
| 그중 DB 세션을 담는 nav 지점 | 위 5건에서 draft 행(`SessionList.tsx:75`, `draftAsListItem` 이 `pinnedAt:null` 로 합성)과 랜딩(`ProjectSessionsPanel.tsx:59`) 제외 | 3 | §10 EP-1~EP-3 의 분모 |
| 배치 술어 사용 | `rg "placementOf\|isPinnedSession" app/src/renderer/src` | 22 (프로덕션 11 · 테스트 11) | 프로덕션 11 = 정의 3줄 · import 3 · 주석 1 · **호출 4**(배치 3 = EP-1~EP-3, `SessionList.tsx:95` kebab 표시 상태 1) |
| 좌측 nav subtree 의 `plus` 아이콘 | `rg "name=\"plus\"\|'plus'" app/src/renderer/src` → 4건 중 nav 구획 소속 | 0 | 허용 대상 2건(상단 메뉴 `navItems.ts:6` · 우측 패널 `SidebarCard.tsx:36`), 아이콘 타입 선언 1건, 채팅 타이틀바 1건 |
| `SidebarCard`(+ 버튼 보유) 소비 파일 | `rg "SidebarCard" app/src/renderer/src` | 2 | `ProjectFilesCard`·`ProjectInstructionsCard` — 둘 다 프로젝트 상세 **우측** 패널 |
| `sessionsActions.loadProject` 호출부 | `rg "loadProject" app/src/renderer/src` | 프로덕션 2 | `useProjectSessions.ts:19` · `ProjectSessionsPanel.tsx:36` |
| 세션 엔티티 패치 지점 | `rg "patchSession" app/src/renderer/src` | 1 정의 + 3 호출 | rename·setPinned·title 이벤트가 한 함수를 공유 |

### 수치 / 전칭 표현 검산

- 재측정 수치: nav 구획 4(메뉴 · 프로젝트 · 고정됨 · 최근 대화) = `Sidebar.tsx:131`(nav) + `:155`(projectsSlot) + `:156`(pinnedSlot) + `:157-158`(recents). 내역 합 4 = 총계 4.
- "배치 판정은 단일 함수가 갖는다"의 반례 검색: `rg "pinnedAt" app/src/renderer/src` → 프로덕션 9건. 그중 **세션 배치**에 쓰이는 것은 `sessionPlacement.ts:21` 하나다 — 나머지는 프로젝트 고정 판정 3건(`useSessionHandlers.ts:73`·`ProjectsScreen.tsx:81`·`ProjectInfoHero.tsx:27`), 정렬 2건, 쓰기 1건, draft 합성 1건, 활성 세션 고정 상태 1건. 반례 0.
- 문서 앵커 확인: `docs/handoff/AGENTS.md §공통 V 추적 프로토콜`·`§산출물 문장 규칙`·`§카브아웃` 실재. `app/src/renderer/AGENTS.md §4-layer DAG`·`§테스트` 실재.
- 기존 테스트 케이스 실재: `sessionPlacement.test.ts` `it` 5건 · `sessionsStore.test.ts` `it` 2건 · `navItems.test.ts` `it` 1건(인용한 `/projects` 케이스는 **없음** — AC8 이 신설을 요구한다).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: 없음(Baseline 이전 상태).
- 현재 책임 소유자: `PinnedSection` 하나가 고정 프로젝트와 고정 대화를 **함께** 그렸다(`cc4cde5:PinnedSection.tsx:58-80`).
- 현재 entry → flow → state → consumer: `sessionApi.list()` → `sessionsStore.list`(배열 1개) → `SessionList` 가 필터 없이 전부 렌더 + `PinnedSection` 이 `pinnedAt != null` 만 다시 렌더.
- 현재 오류/정리 경로: rename·삭제·고정이 매번 `initSessions()` 전체 재조회를 돌려 목록 배열 identity 를 통째로 갈았다(`cc4cde5:sessionsStore.ts:31-45`).
- 문제의 직접 원인: 배치 규칙이 없다. "고정됨"은 자기 필터를 갖고 "최근 대화"는 아무 필터가 없어 고정 대화가 두 곳에 나온다.

```text
sessionApi.list → sessionsStore.list ─┬→ PinnedSection (pinnedAt≠null + 고정 프로젝트)
                                      └→ SessionList   (전체 — 고정 대화 중복)
projectApi.listSessions → useProjectSessions (자체 사본) → PinnedProjectChildren (선택 전용)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`·`AR-01`·`AR-02`·`MD-01`~`MD-03`.
- 변경 후 책임 소유자: 구획마다 컴포넌트 하나 — `PinnedProjectsSection`(프로젝트) · `PinnedSection`(고정 대화) · `SessionList`(최근). 배치 판정은 `lib/sessionPlacement` 가 단독으로 갖고, 각 구획은 "이 대화가 내 몫인가"만 묻는다.
- 변경 후 entry → flow → state → consumer: 두 조회(`sessionApi.list`·`projectApi.listSessions`)가 엔티티를 `byId` 에 병합하고 membership 만 따로 기록 → 세 구획이 같은 엔티티를 읽는다.
- 변경 후 오류/정리 경로: mutation 은 전체 재조회 대신 `patchSession` 제자리 패치 — 비변경 행의 참조가 보존돼 `SessionRow` memo 가 산다. 프로젝트 조회 실패는 빈 membership 으로 확정한다.
- 유지하는 기존 메커니즘: `SessionRow` kebab/rename/삭제 UX · `useDragResize` · 접힌 사이드바 경로. 대체하는 것: 단일 "고정됨" 섹션 → 두 구획, 목록 배열 정본 → 엔티티 정본 + membership.

```text
sessionApi.list ─┐
                 ├→ sessionsStore.byId ─┬→ PinnedProjectsSection (프로젝트 + 하위: !isPinnedSession)
projectApi.list ─┘   + recentIds        ├→ PinnedSection        (isPinnedSession)
                     + projectSessionIds└→ SessionList          (placementOf === 'recent')
navItems.SIDEBAR_NAV[1].isActive(p) = (p === '/projects')  → 상단 메뉴 활성
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 구획 소유권 | `PinnedSection` 이 프로젝트+대화 겸임 | 프로젝트는 `PinnedProjectsSection` 으로 **이동**, `PinnedSection` 은 대화 전용 | D-001·D-004 | AR-01 / VP-04·VP-10 |
| 배치 규칙 | 없음(구획별 임의 필터) | `placementOf` 단일 정의 + 세 소비 지점 | D-005·D-006 | MD-01 / VP-05~VP-07 |
| state/contract | `list: SessionListItem[]` 단일 배열 | `byId` 엔티티 + `recentIds`·`projectSessionIds` membership | D-011 | AR-02·MD-03 / VP-11·VP-12 |
| 상단 메뉴 활성 | `p.startsWith('/projects')` | `p === '/projects'` | D-007 | MD-02 / VP-08 |
| 섹션 헤더 | app 과 features 가 클래스 문자열을 각자 복제 | `shared/ui/SidebarSection` 이 상수+접기 컴포넌트를 소유 | D-008, 복제본이 이미 한쪽만 바뀌어 있었다 | AR-01 / VP-03 |
| 하위 행 액션 | 선택 전용(`renameable={false}`) | 고정·이름변경·삭제 kebab | D-009 | AR-01 / AC10 |
| error/lifecycle | mutation 마다 전체 재조회 | `patchSession` 제자리 패치, 프로젝트 조회 실패는 빈 membership 확정 | 리렌더 폭발·무한 로딩 방지 | AR-02 / VP-11 |
| test seam | 순수 seam 없음 | `lib/sessionPlacement.ts`(순수) + `sessionsStore`(IPC mock) + `navItems.ts`(순수) | 로직을 사람 실기에서 내린다 | MD-01~03 / UT-01~03 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/Sidebar.tsx` | 4구획 골격과 렌더 순서 | 4개 slot ReactNode → aside | `AppLayout` |
| `app/navItems.ts` | 상단 메뉴 항목과 활성 술어 | `pathname` → boolean | `Sidebar` |
| `app/hooks/useSidebarSlots.tsx` | slot 합성(안정 identity) | `SessionHandlers` → 4 slot | `AppLayout` |
| `app/hooks/useSessionHandlers.ts` | cross-feature 배선 — 고정 프로젝트 파생·핸들러 | projects/chat store → props | `useSidebarSlots` |
| `features/sessions/lib/sessionPlacement.ts` | 배치 규칙 단일 정의 | `(session, pinnedProjectIds)` → 3값 | 세 구획 컴포넌트 |
| `features/sessions/store/sessionsStore.ts` | 엔티티 정본 + membership + 패치 | IPC → `byId`/`recentIds`/`projectSessionIds` | 구획·훅·페이지 |
| `shared/ui/SidebarSection.tsx` | 섹션 헤더 시각·접근성 단일 소스 | label/children → 접히는 섹션 | app + features 양쪽 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| ~~MD-01 / VP-05·06·07·09~~ **SUPERSEDED by ΔV1** | 한 대화는 nav 에서 정확히 한 구획에만 보인다 | `lib/sessionPlacement.ts` | 세 구획 컴포넌트 | ~~**EP-1**·**EP-2**·**EP-3** — 세 컴포넌트의 각자 필터~~ | **이 행이 G1 이었다** — 세 지점에 흩어진 필터를 지웠을 때 실패하는 장치를 만들 수 없었다(verify r1 M1). EP-1a 가 대체한다 |
| MD-02 / VP-08 | 상단 "프로젝트" 메뉴는 `/projects` 정확 일치에서만 활성 | `app/navItems.ts` | `Sidebar` 확장·접힘 두 렌더 경로 | **EP-4** `navItems.ts:17` `isActive` | `/projects/:id` 에서 상단 메뉴가 켜져 요구 6 위반 |
| AR-01 / VP-04 | "고정됨"은 프로젝트를 담지 않는다 | `PinnedSection` props 타입 | 컴파일러 + 셸 배선 | **EP-5** `PinnedSection.tsx:8-15` props 에 `Project` 없음 | 프로젝트가 두 구획에 겹쳐 D-004 위반 |
| AR-02 / VP-11·12 | 이름·고정·삭제는 엔티티 1개를 패치한다 | `sessionsStore.patchSession` | store | **EP-6** `sessionsStore.ts:57` 단일 패치 함수 | 목록마다 사본이 갈라져 구획별로 다른 제목·고정 상태가 보인다 |
| AR-02 / VP-11 | 새 membership 목록은 `initSessions` GC 루트에 포함된다 | 같은 파일 주석 | `initSessions` | **EP-7** `sessionsStore.ts:69-80` retained 루트 | 턴 종료 refresh 마다 프로젝트 하위 엔티티가 조용히 쓸려나간다 |
| AR-01 / VP-03·10 | 구획 헤더의 컨트롤은 접기 토글 하나다 | `shared/ui/SidebarSection.tsx` | 두 구획이 공유 | **EP-8** `SidebarSection.tsx:32` 헤더 버튼 | 추가 액션이 헤더로 새어 들어가면 D-003 위반 |
| **ΔV1** MD-01a / VP-13·05a·06a·07a | 한 대화는 nav 에서 정확히 한 구획에만 보인다 | `lib/navSections.ts` 의 `splitNavSections` | 파티션 함수 **단독** | **EP-1a** — 배치 분기가 존재하는 유일한 지점(1). 구획 컴포넌트에는 필터가 없다 | 분기를 지우면 서로소·합집합 단언이 즉시 깨진다. **지점이 1이라 전수와 단언이 같은 자리다** |
| **ΔV1** AR-03 / VP-16·05a | 구획 컴포넌트는 props 목록을 재파생하지 않는다 | 세 구획의 props 타입 | 컴파일러 + 렌더 단언 | **EP-9** — `PinnedSection` · `PinnedProjectsSection`(하위 목록) · `SessionList`(최근) 세 컴포넌트의 props 경계 (3) | 한 곳이라도 store 를 다시 구독하면 그 구획이 파티션을 우회한다 — AT-13 의 음성 단언이 그것을 본다 |
| **ΔV1** MD-04 / VP-02a | 고정 프로젝트 파생은 순수 함수가 갖는다 | `lib/navSections.ts` 의 `pinnedProjectsOf` | `useSessionHandlers` | **EP-10** — 고정 프로젝트 필터·정렬이 존재하는 유일한 지점(1) | hook 안에 남으면 순수 테스트가 닿지 못한다(G3 의 자리) |

- 같은 규칙이 여러 레이어에 있는 경우와 SSOT: 섹션 헤더 클래스는 `SIDEBAR_SECTION_HEAD` 상수 하나를 `app/Sidebar.tsx:8` 과 `CollapsibleSection` 이 함께 import 한다 — 레이어별 복제를 금지한다(복제 시절 이미 한쪽만 바뀌어 있었다).
- `실패 의미` 에 "다른 게이트가 막는다"를 적은 행: **없음.** `V1` 은 EP-1~EP-3 의 한계를 적기만 하고 장치를 만들지 않았다 — verify r1 이 그것을 G1 으로 되돌렸고 ΔV1 의 EP-1a 가 지점을 1로 접어 닫는다.
- **ΔV1 강제 지점 전수: EP-1a(1) · EP-9(3) · EP-10(1) = 5.** `V1` 의 EP-4~EP-8(5)은 그대로 유효하고 EP-1~EP-3 은 EP-1a 로 대체된다 — 유효 전수 **10**.
- 선택적 필드의 의미: `SessionListItem.pinnedAt` 은 `number` = 고정 시각, `null` = 비고정. `undefined` 는 계약에 없다 — `placementOf` 는 `!= null` 로 판정해 `0` 을 고정으로 센다(`sessionPlacement.test.ts` `isPinnedSession` 케이스가 `0` 을 포함해 고정한다).
- 외부 SDK 경계: 해당 없음(renderer 내부 변경).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/app/Sidebar.tsx` | 4구획 골격 | `projectsSlot` prop 추가, 헤더 클래스를 `shared` 상수로 | 사람 실기 |
| `app/src/renderer/src/app/navItems.ts` | 메뉴 활성 술어 | `/projects` 정확 일치로 좁힘 | 순수 |
| `app/src/renderer/src/app/navItems.test.ts` | 술어 잠금 | **신규 케이스** — `/projects` true · `/projects/abc` false | 순수 |
| `app/src/renderer/src/app/hooks/useSidebarSlots.tsx` | slot 합성 | `projectsSlot` 추가, 두 구획에 핸들러 배선 | — |
| `app/src/renderer/src/app/hooks/useSessionHandlers.ts` | cross-feature 배선 | `pinnedProjects`·`pinnedProjectIds` 파생 제공 | 사람 실기(§17 R-3) |
| `…/features/sessions/components/PinnedProjectsSection.tsx` | 프로젝트 구획 | **신규** — 고정 프로젝트 행 + 하위 대화(비고정만) | 사람 실기 |
| `…/features/sessions/components/PinnedSection.tsx` | 고정 대화 구획 | 프로젝트 책임 제거, 대화 전용으로 축소 | 사람 실기 |
| `…/features/sessions/components/SessionList.tsx` | 최근 대화 구획 | `placementOf === 'recent'` 만 렌더 | 순수(규칙) |
| `…/features/sessions/lib/sessionPlacement.ts` | 배치 규칙 | **신규** — `placementOf`·`isPinnedSession` | 순수 |
| `…/features/sessions/lib/sessionPlacement.test.ts` | 규칙 잠금 | **신규** — 5케이스(6조합 전수 포함) | 순수 |
| `…/features/sessions/store/sessionsStore.ts` | 엔티티 정본 | `byId` + membership 전환, `patchSession`, GC 루트 | IPC mock |
| `…/features/sessions/store/sessionsStore.test.ts` | 정본 잠금 | **신규** — 2케이스 | IPC mock |
| `…/features/sessions/hooks/useProjectSessions.ts` | 프로젝트 membership 조회 | 자체 사본 제거, 공용 store 사용 | IPC mock |
| `…/features/sessions/components/ProjectSessionsPanel.tsx` | 랜딩 패널 | 삭제·이름변경을 page 핸들러에 위임 | 사람 실기 |
| `…/pages/ProjectLandingPage.tsx` | 랜딩 조립 | `useSessionActions` 로 DB 경로 연결(회귀 수정) | 사람 실기 |
| `…/pages/useSessionActions.ts` | 두 store 동기화 | 고정 상태를 `byId` 에서 파생 | — |
| `…/app/hooks/useChatRouteSync.ts` | 라우트 싱크 | `byId` 전체 대신 URL 세션 하나만 구독 | — |
| `…/shared/ui/SidebarSection.tsx` | 섹션 헤더 | **신규** — 헤더 상수 + `CollapsibleSection` | 사람 실기 |
| `…/shared/i18n/resources/{ko,en}.ts` | 라벨 | `sidebar.pinnedProjects` 추가 | `resources.test.ts` |
| **ΔV1** `…/features/sessions/lib/navSections.ts` | 배치 파티션 + 고정 프로젝트 파생 | **신규** — `splitNavSections` · `pinnedProjectsOf`. `sessionPlacement.ts` 의 `placementOf` 를 내부에서 쓴다 | 순수 |
| **ΔV1** `…/features/sessions/lib/navSections.test.ts` | EP-1a·EP-10 잠금 | **신규** — 서로소·합집합 차집합 0 · 이동/복귀 · 고정 프로젝트 정렬 | 순수 |
| **ΔV1** `…/features/sessions/hooks/useNavSections.ts` | store 구독 1회 + 파티션 호출 | **신규** — 구획별 `useMemo` 로 목록 identity 를 분리 유지 | (hook — 잠금은 순수/렌더가 갖는다) |
| **ΔV1** `…/features/sessions/components/{PinnedSection,PinnedProjectsSection,SessionList}.tsx` | 구획 렌더 | **props 전환** — `useSessionsState` 구독과 자체 필터를 제거하고 목록을 props 로 받는다 | 렌더(SSR) |
| **ΔV1** `…/features/sessions/components/navSections.render.test.ts` | EP-9 잠금 | **신규** — `React.createElement` + `renderToStaticMarkup`(JSX 없이 `.test.ts`) | 렌더 |
| **ΔV1** `…/app/hooks/useSidebarSlots.tsx` · `useSessionHandlers.ts` | 배선 | `useNavSections` 결과와 `pinnedProjectsOf` 를 구획에 내린다 | — |

### 테스트 가능성

- electron/DB 의존과 분리한 **별도 순수 파일**: `lib/sessionPlacement.ts` — `SessionListItem` 타입만 의존하고 store·React 를 import 하지 않는다. `app/navItems.ts` 도 같은 성질(i18n 키 타입만 참조).
- 기존 메커니즘 재사용의 형상 적합성: `SessionRow` 는 `onTogglePin` 이 있을 때만 kebab 에 고정 항목을 낸다 — 프로젝트 하위 행에 핸들러를 넘기는 것만으로 D-009 를 만족한다(새 prop 불필요).
- 순서를 관측할 훅: 필요 없음 — 이 작업의 순서 요구는 렌더 순서(시각)뿐이다.
- **ΔV1 렌더 seam**: `renderToStaticMarkup` 은 `environment: 'node'` 에서 동작하고 `react-dom` 은 이미 devDependency 다 — 신규 의존성 0. `vitest.config.ts` 의 `include` 가 `src/**/*.test.ts` 라 **JSX 를 쓰지 않고 `React.createElement` 로 작성**해 config 를 건드리지 않는다.
- **ΔV1 이 props 전환을 요구하는 이유**: store 구독 컴포넌트는 SSR 에서 zustand 초기 스냅샷을 받아 목록이 빈 채로 렌더된다(§7-B 스파이크) — 구독을 컴포넌트에 두면 렌더 단언 자체가 성립하지 않는다.

## 12. End-to-end 영향

### producer → consumer

```text
sessionApi.list / projectApi.listSessions
  → sessionsStore.byId (엔티티 정본) + recentIds·projectSessionIds (membership)
  → placementOf(session, pinnedProjectIds)
  → PinnedSection · PinnedProjectsSection · SessionList
```

- producer 기준: main 의 `sessions` 테이블이 SSOT 이고 `pinnedAt` 은 시각 또는 `null`.
- consumer 파생 규칙: 구획 선택은 `placementOf` 만 쓴다. 구획이 자체 `pinnedAt` 비교를 다시 쓰면 SSOT 를 우회한다(§8 반례 검색으로 현재 0건 확인).
- 파생 가능한 합성값이 정본을 우회하지 않는가: `pinnedProjectIds` 는 `pinnedProjects` 와 같은 `useMemo` 사슬에서 나와 두 값이 갈라지지 않는다(`useSessionHandlers.ts:70-78`).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `initSessions` GC 루트 | membership 목록이 2종(`recentIds`·`projectSessionIds`)으로 늘었다 — 루트에 넣지 않으면 턴 종료 refresh 가 프로젝트 엔티티를 버린다 | AC11 |
| `useChatRouteSync` | `byId` 전체 구독은 무관한 제목·고정 이벤트로 effect 를 재실행시킨다 → URL 세션 하나만 구독 | AC12(랜딩 회귀와 같은 커밋) |
| `useSessionActions` | 활성 세션 고정 상태를 `byId` 에서 파생 — 목록 배열 제거의 소비처 | AC11 |
| `ProjectSessionsPanel` | 자체 사본 제거 후 공용 엔티티 사용 | AC11 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 시 `initSessions` 1회. 프로젝트 하위는 구획을 펼칠 때 마운트되어 조회한다(지연).
- 취소/중단: 해당 없음(사용자 취소 가능한 장기 작업 없음).
- 종료/crash: renderer 상태는 휘발이고 정본은 DB — 재부팅 시 `initSessions` 로 복원된다.
- retry/timeout/partial failure: 프로젝트 조회 실패는 **첫 조회에 한해** 빈 membership 으로 확정해 무한 로딩을 막고, 이미 목록이 있으면 그대로 둔다(재검증 실패).
- cleanup/rollback: 삭제는 담고 있던 membership 버킷만 새 배열로 교체해 무관한 프로젝트 뷰의 memo 를 깨지 않는다.
- **다중 저장소 쓰기**: 런타임에는 해당 없음 — 모든 mutation 이 main 의 DB 한 곳을 쓰고 renderer store 는 그 결과의 캐시다. **문서 산출물에는 해당한다** — 이 작업의 상태·판정이 `plan.md`(본 문서)와 `docs/handoff/INDEX.md` 보드 두 곳에 산다. 보드만 갱신하고 plan 을 안 고치면 두 사본이 다른 말을 하므로, 상태 전이마다 두 곳을 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력/요청의 원천 상한 × 배치 상한: 프로젝트 조회는 `고정 프로젝트 수 × 1회`이고 **펼친 구획에만** 발생한다(기본 접힘, `PinnedProjectRow` 의 `useState(false)`). 고정 프로젝트 수는 사용자가 정하고 상한이 없으나, 접힌 행은 조회하지 않으므로 부팅 시 추가 요청은 0이다.
- 구조적 목표(줄/파일 수): 없음.
- 캐시/호출 축소로 잃는 부수 효과: 전체 재조회를 제자리 패치로 바꾸면서 "재조회가 곁들여 주던 최신화"를 잃는다 — 그 손실이 §17 R-1(프로젝트 membership 이 turn-end refresh 에서 갱신되지 않음)이다. `mergeItems` 의 동일값 bail-out 은 반대 방향(불필요 리렌더 제거)이고 `sessionsStore.test.ts` 1케이스가 엔티티 공유를 잠근다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — renderer 내부 변경이고 외부 구현자가 채우는 port/schema/config 가 없다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "고정 항목 0 → 고정됨 섹션 자체 미렌더" | `docs/handoff/0129-…/plan.md:144` | §2 추론 B · D-008 · AC9 | **변경** — 항상 4구획(요구 1). 사용자 확인 대상(§4) |
| "하위 행은 선택 전용(고정/이름변경/삭제 없음)" | `0129` 같은 문서 `PinnedProjectChildren` 주석 | D-009 · AC10 | **변경** — 요구 5 가 하위 행의 고정 클릭을 전제한다 |
| "고정됨 섹션은 프로젝트+대화를 함께 나열" | `0129 plan §C` | §9 Delta 구획 소유권 | **변경** — 요구 1·4 |
| feature 끼리 직접 import 금지, cross-feature 는 props | `app/src/renderer/AGENTS.md §4-layer DAG` | §11 `useSessionHandlers` 가 `pinnedProjects` 주입 | **유지** — `PinnedProjectsSection` 은 `projects` feature 를 import 하지 않고 `Project` 타입만 shared ipc 에서 받는다 |
| 그룹 스코프 격리(`group/<이름>`) | 같은 문서 §스타일 | `PinnedProjectsSection.tsx:94` `group/pinproj` | **유지** |
| 400줄 초과 시 분해 검토 | 같은 문서 §단일 파일 분해 가이드 | §11 파일 목록 | **유지** — 최대 `PinnedProjectsSection.tsx` 203줄 |
| 시맨틱 토큰 우선, raw hex 금지 | 같은 문서 §스타일 | 신규 컴포넌트 클래스 | **유지** — `text-t7`·`bg-fill-uncontained-hover` 등 |
| UI 라벨은 한국어 i18n | root `AGENTS.md §8` | `sidebar.pinnedProjects` ko/en 동시 추가 | **유지** |
| 카브아웃은 트리비얼·handoff 메타 수정만 | `docs/handoff/AGENTS.md §카브아웃` | §메타 기준선 잠금의 한계 | **위반이 있었음을 기록** — 5커밋이 `Handoff: none` 으로 도착 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| **R-1** 고정 프로젝트에 새 대화가 생겨도 그 구획이 이미 펼쳐져 있으면 목록이 갱신되지 않는다 — `useProjectSessions` 의 effect deps 가 `[projectId]` 이고(`:20`) 턴 종료 `sessionsActions.refresh` 는 `projectSessionIds` 를 건드리지 않는다(`sessionsStore.ts:81-85`). 그 대화는 배치상 `pinnedProject` 라 "최근 대화"에서도 빠져 **어느 구획에도 안 보인다** | 접었다 펴거나 프로젝트 랜딩을 방문하면 회복된다. 이번 범위 밖 — 검증자가 재현되면 `NEXT_HANDOFF` 로 이관하고, 고칠 때는 `initSessions` 가 이미 조회된 버킷의 membership 도 함께 갱신하는 쪽이 최소 해법이다 |
| **R-2** 고정 항목 0일 때 빈 헤더 2개가 보인다 | D-008 의 추론 결과. 사용자 시각 확인으로 확정(§4) |
| **R-3** 고정 프로젝트 파생에 순수 seam 이 없다 | `pinnedProjectIds` 경유로 `placementOf` 테스트가 같은 술어를 간접 고정한다. 추출은 후속(§6) |
| **R-5** (ΔV1) props 전환으로 `useSidebarSlots` 가 세션 상태에 의존해 `Sidebar` memo 가 약해질 수 있다 | `useNavSections` 가 구획별 `useMemo` 로 세 배열의 identity 를 분리 유지하고, 엔티티 참조는 store 가 이미 보존한다(`patchSession`·`mergeItems` 동일값 bail-out) — 행 단위 `SessionRow` memo 는 그대로 산다. 구현 턴이 실측해 `[구현자 기입]` 에 적는다 |
| **R-4** 이 plan 이 구현 뒤에 왔다 | 기준선을 커밋 해시로 고정하고 한계를 §메타에 명시했다. 검증자는 구현자 보고 없이 코드에서 직접 판정한다 |

- 되돌리기 어려운 결정: 없음 — 공개 계약·스키마·저장 형식 변경이 없고 renderer 내부 구조만 바뀐다.
- 신규 의존성: 없음. 렌더 하네스는 도입하지 않았다(사용자 승인 필요 사항).

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/app/` — `Sidebar.tsx` · `navItems.ts` · `navItems.test.ts` · `hooks/useSidebarSlots.tsx` · `hooks/useSessionHandlers.ts` · `hooks/useChatRouteSync.ts`
- `app/src/renderer/src/features/sessions/` — `components/{PinnedProjectsSection,PinnedSection,SessionList,SessionRow,ProjectSessionsPanel}.tsx` · `lib/sessionPlacement{,.test}.ts` · `store/sessionsStore{,.test}.ts` · `hooks/useProjectSessions.ts` · `index.ts`
- **ΔV1 신규** — `features/sessions/lib/navSections{,.test}.ts` · `features/sessions/hooks/useNavSections.ts` · `features/sessions/components/navSections.render.test.ts`
- `app/src/renderer/src/pages/` — `ProjectLandingPage.tsx` · `useSessionActions.ts`
- `app/src/renderer/src/shared/` — `ui/SidebarSection.tsx` · `i18n/resources/{ko,en}.ts`
- `docs/handoff/INDEX.md` · 본 문서
- `docs/arch/frontend/state.md:105` — slot 목록이 `pinnedSlot`/`sessionsSlot`/`footerSlot` 3개로 적혀 있어 `projectsSlot` 이 빠졌다. 이번 범위 밖이나 검증자가 문서 동기화 후보로 다룬다

## 19. 게이트

- 적용할 하위 가이드: `app/src/renderer/AGENTS.md §테스트` · `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- ABI/네트워크 제약: renderer 순수 변경이라 DB 동작 검증이 필요 없다 — `npm test`(DB 포함)를 기본 게이트로 쓰지 않는다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/sessions src/renderer/src/app/navItems.test.ts` (`pretest` 우회). **ΔV1 이후 이 경로에 `navSections.test.ts` 와 `navSections.render.test.ts` 가 포함된다.**
- ΔV1 회귀 범위: `./node_modules/.bin/vitest run src/renderer` — props 전환이 renderer 전체(r1 기준 61파일·478케이스)를 깨지 않는지 본다.
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check` — 보드에 추가한 링크가 해석되는지.
- 사람 실기: AC1 · AC4 · AC9 · AC10 · AC12 (§7 사유). **ΔV1 에서 AC2 가 빠졌다** — AT-02a 로 순수 seam 에 내렸다(G3).

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 결정을 보존한다 — Baseline 이라 ACTIVE 11건, SUPERSEDED 0건, OPEN 0건(D-008 은 ACTIVE 이되 §4 에서 사용자 확인 대상으로 올렸다).
- [x] Part I 만 읽어도 완료 상태를 이해할 수 있다 — §5 전이표 7행이 구현 언급 없이 결과를 적는다.
- [x] 조건절·"이동"·"설치하지 말 것"을 재해석하지 않았다 — §2 에 원문 인용, D-003·D-005 가 같은 어휘를 쓴다.
- [x] Product/UX 의 각 동작이 AC 와 Technical Design 에 연결된다 — §5 전이표 7행 ↔ AC2·AC4·AC5·AC7·AC8·AC9.
- [x] AS-IS 와 TO-BE 가 같은 축으로 있다 — §9 Delta 8행이 두 절을 축별로 대조한다.
- [x] Delta 의 각 변경이 §11 파일 또는 AC 로 추적된다 — 8행 전부 V node + 파일/AC 연결.
- [x] AS-IS 에서 사라진 책임을 명시했다 — "프로젝트 책임은 `PinnedSection` → `PinnedProjectsSection` **이동**"(삭제 아님).
- [x] 수치·전칭·앵커·기존 테스트 인용을 실측했다 — §8 검산 4항목. `navItems.test.ts` 에 `/projects` 케이스가 **없음**을 확인해 AC8 을 신설 요구로 적었다.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 가진다 — §7 표 3열.
- [x] 상속 기준이 없어 Baseline V 를 썼고 유효 V = V1 로 재구성된다.
- [x] 변경 효과에 필요한 레벨을 골랐다 — R(사용자 결과)·SD(전이)·AR(경계·저장소)·MD(규칙·술어) 전부, 모든 NEW node 에 같은 레벨 REQUIRED pair 12건.
- [x] 영향받은 INHERITED node 없음 — Baseline 이라 REGRESSION·NOT_REQUIRED 행이 존재하지 않는다.
- [x] 각 pair 가 경로·§10 전수·직접 oracle 을 갖고, 적대 증거는 VP-03·VP-04 둘만 이유와 함께 선택했다.
- [x] 현재 변경 산출물의 gate 4종을 열거했고 무관한 기존 실패를 blocking 으로 만들지 않았다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 배치·술어·엔티티는 전부 순수 테스트, 실기는 시각·IPC 영속뿐(§7 주의사항).
- [x] semantic 목표를 structural proxy 만으로 검증하는 AC 가 없다 — AC3·AC4 의 구조 단언에 적대 증거를 붙였다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §10 EP-1~EP-8, §11 seam 열.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 4건 + `loadProject` 호출부 2건.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·one-way door 를 계산했다 — §14, §17(되돌리기 어려운 결정 없음).
- [x] 게이트 명령이 대상 subtree 의 현재 `AGENTS.md` 와 충돌하지 않는다 — `npm test` 를 기본으로 쓰지 않는다.
- [x] 본문 완성 후 Decision Ledger 와 교차검증했고 결과를 §3 갱신 메모에 관측으로 적었다(충돌 0, 11건 대조).
- [x] 산출물 문장 규칙 — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄.

---

> **[구현자 기입]** — r1. 구현 코드 5커밋은 handoff 밖에서 먼저 도착했고, 이 보고는 그 산출물을
> plan 계약으로 되돌려 측정한 결과다. 이번 턴이 만든 코드 변경은 **AC8 오라클 1건**뿐이다.
> `Criteria-Met` 은 자기보고이며 검증자는 증거로 받지 않는다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Part I 요구 6개와 §10 강제 지점 8곳이 코드에서 전부 실재한다(아래 전수표). Part II 의 AS-IS→TO-BE Delta 8행도 실제 diff 와 어긋나는 행이 없다.
- 이견 / 현실성 문제: **없음.** 다만 §7 이 AC8 을 "신규 케이스 요구"로 적어 둔 대로 오라클이 없었다 — 이번 턴에 신설했다(선조치 #2).
- ACTIVE Decision 과 충돌하는 설계 발견: 없음. D-001~D-011 중 코드가 반대로 구현한 것 0건.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-05·06·07·09 | 한 대화는 nav 에서 정확히 한 구획 | `EP-1`·`EP-2`·`EP-3` (3) | 3/3 | `sed -n '34p' PinnedSection.tsx` → `.filter(isPinnedSession)` · `sed -n '179p' PinnedProjectsSection.tsx` → `!isPinnedSession(session)` · `sed -n '62p' SessionList.tsx` → `placementOf(...) !== 'recent'` | — |
| VP-08 | 상단 메뉴는 `/projects` 정확 일치 | `EP-4` (1) | 1/1 | `sed -n '17p' navItems.ts` → `(p: string) => p === '/projects'` | — |
| VP-04 | "고정됨"은 프로젝트를 담지 않는다 | `EP-5` (1) | 1/1 | `grep -c 'Project' PinnedSection.tsx` → **0** | — |
| VP-11·12 | 이름·고정·삭제는 엔티티 1개를 패치 | `EP-6` (1) | 1/1 | `grep -n patchSession sessionsStore.ts` → 정의 1(`:57`) · 호출 3(`:116`·`:122`·`:158`) | — |
| VP-11 | 새 membership 은 GC 루트에 포함 | `EP-7` (1) | 1/1 | `sed -n '73,79p' sessionsStore.ts` → `for (const ids of Object.values(state.projectSessionIds))` | — |
| VP-03·10 | 구획 헤더의 컨트롤은 접기 토글 하나 | `EP-8` (1) | 1/1 | `grep -c 'aria-expanded={' SidebarSection.tsx` → **1** | — |

**전수 = 8/8.** 완결성 관측은 차집합이다 — nav 에서 `SessionRow` 를 렌더하는 소스 배열 **5**개(`PinnedSection:45 pinnedSessions` · `PinnedProjectsSection:189 visibleSessions` · `SessionList:74 drafts` · `SessionList:85 recentSessions` · `ProjectSessionsPanel:58 sessions.list`) 중 배치 술어를 통과한 것 **3**개(EP-1~EP-3). **차집합 2**: `drafts`(DB 세션 아님 — `byId` 미등록, `draftAsListItem` 이 `pinnedAt: null` 합성) · `ProjectSessionsPanel`(프로젝트 랜딩 = nav 아님, D-010 비범위). 술어 밖으로 새어나간 nav 지점 **0**.

- §10 에 없는데 같은 불변식이 필요했던 지점: 없음.

**V-pair 자기확인** — `SELF_PASS 6 / SELF_BLOCKED 6`.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | 사람 실기 — 이 컨테이너에 Electron GUI 없음. 구조만 확인: `Sidebar.tsx:131`·`:155`·`:156`·`:157` 순서 | not selected |
| VP-02 | REQUIRED | SELF_BLOCKED | 사람 실기. 구조만: `useSessionHandlers.ts:70-78` 필터 + `pinnedAt` 내림차순 | not selected |
| VP-03 | REQUIRED | SELF_PASS | 음성 0 · 양성 1 (스윕 스크립트) | **M2 양성 1→0 · M3 음성 0→1 — 양방향 검출** |
| VP-04 | REQUIRED | SELF_BLOCKED | 구조 절반 닫힘(`EP-5` 0건), 시각 절반은 실기 대기 | **M4 EP-5 0→2 — 검출** |
| VP-05 | REQUIRED | SELF_PASS | `고정 대화는 프로젝트 소속과 무관하게 고정됨이 가져간다` 통과 | not selected — 직접 행동 결과 관측 |
| VP-06 | REQUIRED | SELF_PASS | `모든 조합이 정확히 한 섹션에 배치된다` 6조합 전수 통과 | not selected — 전수 열거가 직접 oracle |
| VP-07 | REQUIRED | SELF_PASS | `고정 프로젝트의 비고정 대화는…` + `고정되지 않은 프로젝트의 대화는…` 통과 | not selected |
| VP-08 | REQUIRED | SELF_PASS | 신설 `프로젝트 메뉴는 목록 경로에서만 활성이다` 통과 | **M5 `startsWith` 복귀 → 1건 실패 — 검출** |
| VP-09 | REQUIRED | SELF_BLOCKED | §5 전이표 7행 중 배치 4행은 순수로 닫힘, 3행(프로젝트 고정·해제·행 클릭)은 실기 | not selected |
| VP-10 | REQUIRED | SELF_BLOCKED | AC1·AC4 시각 절반이 실기 대기 | 위 M2~M4 로 구조 절반 확인 |
| VP-11 | REQUIRED | SELF_BLOCKED | AC11 순수 2케이스 통과, AC12(IPC+DB 영속)는 실기 | not selected |
| VP-12 | REQUIRED | SELF_PASS | `sessionsStore.test.ts` 2케이스 통과 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| **M1** `PinnedSection.tsx:34` `.filter(isPinnedSession)` 삭제 → 잔여 import 까지 삭제 | 이번 턴 §3 자기검사 — EP-1 배선 | **0건** — vitest 8/8 pass · `typecheck:web` 진단 0 · eslint 0 error(prettier warning 1) | **잠금 없음 — 배선을 자동 게이트가 못 본다**(§10 `실패 의미` 가 예고한 그대로. 잔여물만 남기면 `TS6133` 이 걸리지만 그것까지 지우면 전부 침묵) |
| **M2** `SidebarSection.tsx:32-41` 접기 토글 → 정적 `<div>` | VP-03 선택 증거 | 양성 스윕 `1 → 0` | 잠김 |
| **M3** `PinnedProjectsSection` 헤더에 `<Icon name="plus">` 버튼 추가 | VP-03 선택 증거 | 음성 스윕 `0 → 1` | 잠김 |
| **M4** `PinnedSection` 에 `import type { Project }` + `pinnedProjects` prop 복귀 | VP-04 선택 증거 | EP-5 스윕 `0 → 2` | 잠김 |
| **M5** `navItems.ts:17` → `p.startsWith('/projects')` | 이번 턴 신설 oracle 민감도 | **1건** — `프로젝트 메뉴는 목록 경로에서만 활성이다` (`expected true to be false`) | 잠김 |

- 다섯 변이 모두 되돌렸다: `git status --short` → `M app/src/renderer/src/app/navItems.test.ts` 한 줄(이번 턴 신설 오라클)뿐이고, 스윕 3값이 기준선 `0 / 1 / 0` 으로 복귀했다.
- 신설 oracle 의 production 경로 진입: `navItems.test.ts` 가 import 하는 `SIDEBAR_NAV` 는 `Sidebar.tsx:90`·`:133` 이 `it.isActive(pathname)` 로 부르는 같은 상수다(동명 재구현 아님).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ | `sidebar.pinnedProjects` 가 ko(`:751` '프로젝트')·en(`:747` 'Projects') 양쪽에 있고 `PinnedProjectsSection.tsx:41` 이 소비한다 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | **표에 없음** | 프로젝트 하위 조회 실패는 §5 *파생 UX* 에만 있고 상태 전이표 7행 중 어느 행도 아니다 → 잠재 문제 #3 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ⚠️ | 조회 실패가 빈 membership 으로 확정돼(`sessionsStore.ts:144-148`) 화면에는 `sessions.empty`("대화 없음")로 보인다 — 진짜 빈 프로젝트와 구분되지 않는다 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ⚠️ | `loadProject` 에 세대·취소 토큰이 없다(`sessionsStore.ts:128-140`) — 같은 projectId 의 두 조회가 겹치면 나중 응답이 이긴다. 창은 좁다(마운트 + 턴 종료 두 트리거뿐) |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **EP-1~EP-3 배선을 어떤 자동 게이트도 잠그지 않는다.** 세 필터 중 하나를 지워도 lint·typecheck·vitest 가 전부 초록이다 — 순수 테스트는 `placementOf` 규칙만 잠그고 그것을 *부르는 줄* 은 보지 않는다 | ⚠️ **보고만** — 닫으려면 렌더 하네스(신규 devDependency, 사용자 승인 사항) 또는 세 구획의 파생을 순수 셀렉터로 뽑아 store 조합 테스트를 만들어야 한다. 둘 다 설계 결정 | M1 실측: vitest 8/8 pass · typecheck 진단 0 · eslint 0 error |
| 2 | AC8 의 오라클이 없었다 — `navItems.test.ts` 에 `/projects` 술어 케이스 부재 | ✅ **선조치** — 케이스 1건 신설(`navItems.test.ts:9-14`). plan §11 이 이미 "**신규 케이스**"로 요구한 행이라 설계 변경이 아니다 | M5 로 민감도 확인 |
| 3 | 프로젝트 하위 조회 실패가 "대화 없음"으로 위장한다 | ⚠️ **보고만** — 실패 표시를 넣으면 §5 상태 전이표에 행이 하나 늘고, 그것은 Product 결정이다 | `useProjectSessions.ts:19` `.catch(() => undefined)` + `sessionsStore.ts:144-148` 빈 membership 확정 |
| 4 | AC3 양성 스윕의 첫 정의(`grep -c 'aria-expanded'`)가 **주석 줄까지 세어 2** 를 돌려줬다 | ✅ **선조치** — 술어를 `aria-expanded={` 로 좁혀 1로 정정한 뒤 M2 를 돌렸다 | `grep -n 'aria-expanded' SidebarSection.tsx` → `:20`(주석)·`:36`(속성) |
| 5 | §17 R-1(고정 프로젝트의 새 대화가 어느 구획에도 안 보일 수 있음)을 코드에서 재확인했다 | ⚠️ **보고만** — 설계자가 이미 리스크로 등록. 최소 해법은 `initSessions` 가 이미 조회된 버킷 membership 도 갱신하는 것 | `useProjectSessions.ts:20` deps `[projectId]` · `sessionsStore.ts:81-85` 반환에 `projectSessionIds` 없음 |

### 설계 대비 명시적 차이

- plan 이 지정한 것과 다르게 구현한 것: **없음** — plan 이 구현 뒤에 쓰인 기준선이라 설계 대비 차이가 구조적으로 생길 수 없다. 이번 턴의 유일한 코드 변경(AC8 오라클)은 plan §11 이 지정한 파일·역할 그대로다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체한 메커니즘이 없다 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 대체 없음. 다만 기존 설계의 공유 축은 확인했다: `byId` 를 네 소비자가 함께 읽고 비우는 곳은 `initSessions` GC 하나다 | EP-7 관측(`sessionsStore.ts:73-79`) |
| 재진입 | 해당 없음 — 대체 없음 | — |
| 다른 무효화 축 | 해당 없음 — 대체 없음 | — |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 이번 턴 **1개** — `app/src/renderer/src/app/navItems.test.ts`(AC8 오라클 신설). 앞선 5커밋의 파일 목록은 §18 |
| 실행 명령 | `npm ci` · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `./node_modules/.bin/vitest run src/renderer` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출**(exit code 아님) | lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library` — nav 무관, 기존) · typecheck **3구성 진단 0건** · vitest 전체 **229파일 2328케이스 중 5파일 48케이스 실패** · vitest renderer **61파일 478케이스 전부 통과** · doc gate **generated ok · prose ok · links ok** |
| 환경 기인 실패 분리 | 실패 48건은 전부 `src/main/**` 5파일(`migrate`·`queries`·`fork`·`builder`·`chat-turn.continuity`)이고 서명은 `NODE_MODULE_VERSION 127` vs `140` · `Module did not self-register: better_sqlite3.node` — `app/AGENTS.md` 의 알려진 ABI 마찰이다. renderer 478건 전건 통과로 이번 변경과 분리된다 |
| V-pair 자기확인 | `SELF_PASS 6 / SELF_BLOCKED 6`; pair 별 상세는 위 표. SELF_BLOCKED 6건은 전부 **사람 실기**(Electron GUI 부재)이고 구현 결함이 아니다 |
| 강제 지점 전수 | **8/8** (차집합 0 — 위 전수표) |
| **AC 자기보고**(`Criteria-Met`) | **6/12.** ✅ AC3(스윕 0/1 + M2·M3) · AC5(2단언) · AC6(6조합) · AC7(2단언) · AC8(신설 케이스 + M5) · AC11(2케이스). ⚠️ AC1·AC2·AC4·AC9·AC10·AC12 — 전부 plan 이 사람 실기로 지정한 항목이라 이 환경에서 닫을 수 없다(AC4 는 구조 절반만 닫힘) |
| **합계 검산** | `✅ 6 · ⚠️ 6 · ❌ 0 = 총 12`. 분모는 §7 표의 AT-01~AT-12 를 다시 세어 12. 이전 라운드 없음 |
| 블로커 / 역질문 | **D-008**(고정 0일 때 빈 헤더 유지)은 §4 가 사용자에게 올린 결정이라 실기 확인 때 함께 답이 필요하다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 라운드 1 — 이전 라운드 없음.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **있었다.** `docs/handoff/AGENTS.md §진입 트리거` 의 find-or-create 가 구현 요청에 handoff 생성을 요구하는데 5커밋이 `Handoff: none` 으로 우회했다. 그래서 설계·구현 순서가 뒤집혔고 `handoff-verify §0` 의 기준선 diff 를 쓸 수 없다.
- 반복해서 부딪히는 환경 한계: **3건.** ① better-sqlite3 ABI(`src/main/**` DB 48케이스) ② Electron GUI 부재 → 사람 실기 6 AC ③ 렌더 하네스 부재(0201 AC16 과 같은 축) — 잠재 문제 #1 이 여기서 막힌다.
- 현재 라운드 수: **1**.

---

## [검증자 기입] 파생 이슈

> r1 판정 원문은 [`verify.md`](verify.md). `PLAN_GAP` 3건이 있으므로 다음 주체는 **설계자**다 — 구현 코드는 이번 라운드에 고칠 것이 없다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| G2 | `NEW` 왼쪽 노드 3개(`MD-01`·`MD-02`·`R-07`)에 같은 레벨 `REQUIRED` pair 가 없다 — NEW 13 − paired 10 = 차집합 3 | verify r1 · §7-A pair registry / `docs/handoff/AGENTS.md §Baseline V · Delta V · pair` | 세 pair 행을 ΔV1 로 신설 | **PLAN_GAP** (root) | **closed (ΔV1)** — VP-13·14·15 신설 |
| G1 | VP-05·06·07 의 oracle 이 `placementOf` 반환값만 본다 — AC5~AC7 의 "구획에서 사라진다"를 닫지 못한다. M1: EP-1 소거 후 renderer 478케이스·typecheck·eslint 전부 초록 | verify r1 · VP-05·06·07 · AT-05~07 · §10 EP-1~EP-3 | MD-01↔UT-01 pair 를 세우고, 세 구획 파생을 순수 셀렉터로 내리거나 렌더 하네스를 결정 | **PLAN_GAP** (root=G2) | **closed (ΔV1)** — EP-1a 로 지점 1 축약 + AT-05a·06a·13 |
| G3 | AT-02 의 유일한 oracle 이 사람 실기인데 대상은 `filter + sort` 순수 파생이다 | verify r1 · VP-02 · AT-02 / `handoff-verify §5` | §11 에 순수 seam 을 지정하거나 실기 유지 근거를 명시 | **PLAN_GAP** (root=G2) | **closed (ΔV1)** — AT-02a · EP-10 |
| D1 | INDEX 0203 비고가 9줄로 5줄 상한 초과 | verify r1 · 현재 산출물 gate(`§산출물 문장 규칙 3`) | 5줄 이내로 축약, 상세는 문서 링크 | NON_BLOCKING | **closed** — 검증 커밋에서 정정 |
| D2 | 프로젝트 하위 조회 실패가 `sessions.empty` 로 보여 빈 프로젝트와 구분되지 않는다 | verify r1 · Part I §5 — 상태 전이표에 행 없음 | 실패 표시 추가 여부는 제품 결정(전이표 행이 하나 는다) | NON_BLOCKING | open |
| D3 | 고정 프로젝트의 새 대화가 어느 구획에도 안 보일 수 있다 | verify r1 · plan §17 R-1 | `initSessions` 가 이미 조회된 버킷 membership 도 갱신 | NEXT_HANDOFF | open |
| D4 | 모든 대화가 고정된 프로젝트는 하위가 "대화 없음"으로 보인다 | verify r1 · D-005 의 부수 결과 | 문구 분기 또는 고정 대화 요약 | NEXT_HANDOFF | open |
| D5 | `listSessions(limit = 50)` 밖의 고정 대화는 재부팅 후 "고정됨"에 안 나타난다 | verify r1 · 비귀속(`cc4cde5` 에서도 동일, 회귀 아님) | main 쿼리가 고정 세션을 LIMIT 밖에서도 반환 | NEXT_HANDOFF | open |
| D6 | `SIDEBAR_DEFAULT_WIDTH` 미참조 | verify r1 · 비귀속(이번 변경 이전부터) | 기록만 | NON_BLOCKING | open |
