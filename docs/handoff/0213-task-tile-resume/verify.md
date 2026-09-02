# Verify — 0213-task-tile-resume

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 설계·구현 원문은 [`plan.md`](plan.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0213-task-tile-resume` |
| 검증자 | Claude Code |
| 일자 | 2026-09-02 |
| 대상 커밋/range | `0d00156..a7cbff4` (구현 커밋 `a7cbff4` 단일) |
| 구현 전 plan 기준 | `0d00156` (설계 정정) · 원 설계 `46047ac` |
| V mode / 유효 V | `Baseline V` / `0213:V1` — 12 pair(REQUIRED 8 · REGRESSION 4) |
| 검증 기준 plan revision | `0d00156:V1` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude 다.** §4 에 따라 구현 보고가 이름을 대지 않은 적대 축 **5건**(N1·N2/N2b·N4·N5·N6)과 §10 분모 독립 재열거를 분모에 넣었다 — 그중 **2건이 미검출**이고 그것이 이번 FAIL 의 근거다 |

---

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **했다 — 삽입 146줄, 삭제 0줄.** 전부 `[구현자 기입]` 절 신설이다.
- **기준선이 diff 로 성립한다.** 설계(`46047ac`·`0d00156`)와 산출(`a7cbff4`)이 갈린 커밋이고, 구현 커밋의 `plan.md` diff 에 삭제 줄이 0 이라 규범 행이 손대지지 않았음을 diff 로 확인했다.
- Decision Ledger 변경: **없다.** D-001~D-010 이 `0d00156` 그대로다.
- Product/UX Contract 변경: 없다. §1·§5 무변경.
- AC 변경: 없다. AC1~AC21 원문 그대로 채점했다.
- V node/pair·requiredness·§10·oracle 변경: 없다. `0d00156` 이 VP-03 적대 증거를 교체한 것이 마지막이고 구현 커밋은 건드리지 않았다.
- 채점에 사용할 원 기준: `0d00156` 의 §7 AC 표 · §7-A pair registry · §10 EP 표.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 0205 V 의 3축을 **전부** 뒤집으므로 Delta V 가 성립하지 않는다는 §7-A 논거가 코드와 맞다 — 정지 배열 하나가 메뉴·활성화·배지를 함께 뒤집는다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01·02·03·04 · SD-01 · AR-01·02 · MD-01·02 전부 대응 pair 를 갖는다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-90·91·92 · MD-90 → VP-09~12 |
| pair별 path·§10 전수·직접 oracle | **1건 미흡** | VP-08 의 path 는 `TaskProgressList 안내 분기 → **카드**` 인데 직접 oracle 은 View 를 고립 렌더한다 — 마지막 홉(래퍼→View props)을 지나지 않는다(D2) |
| 필요한 pair의 선택적 적대 증거·선택 이유 | **1건 미흡** | VP-06 이 `not selected — AT-12·13 이 AT-11 의 음성 짝이다` 로 적대 증거를 면제했는데, 그 음성 짝이 실제로는 잠그지 않는다(D1) |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A 게이트 5종이 이번 산출물(renderer 소스·테스트·문서)에 정확히 대응한다. 무관한 기존 실패를 blocking 으로 올리지 않았다 |

- V 도입 전 plan 여부: 해당 없음 — `0213:V1` 은 V 규약을 갖춘 Baseline 이다.
- **root `PLAN_GAP`: 없다.** D1·D2 둘 다 계약(AC12 원문 · VP-08 path 원문)이 이미 있고 구현자가 **새 계약을 발명하지 않고** 단언을 보강해 닫을 수 있다 — §11 에 따라 gap 이 아니라 `PAIR_FAIL` 이다.

---

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 정지 해제 | 메뉴·활성화·배지 3소비처가 함께 복귀 | `SUSPENDED=[]`(`rightPanelTiles.ts:45`) → 메뉴 필터 `:61` · 활성화 게이트 `chatReducer.ts:1507` · 배지 `:79` — **3지점 전수 확인** |
| D-002·D-003 두 섹션 숨김·껍데기 제거 | 카드에 목록 하나 | `TaskTileContent.tsx:425-432` 이 `TaskProgressList` 를 직접 반환. `TileSection`·`SectionPlaceholder` 호출 **0건** |
| D-004 파일·키 보존 | `TaskTileSections.tsx` 와 `sections.*` 4키 잔존 | 파일 존재 · 헤더 주석에 복귀 조건 · i18n 키 무변경 ✅ |
| D-005·D-006 막힘 표시 | 막힌 미완료 행에만 `#2 완료 필요` | `blockedRowText`(`:125`) → `TaskRow` 둘째 줄(`:267`). 문구 리터럴은 `:120` **1곳** |
| D-007 안내 분모 | 할 일 0건 기준 · 목록 위에 선다 | `hasAgentItems`(`:301`) → `unsupported`(`:302`) → `:308` 블록이 목록 앞 |
| D-008 메뉴 SSOT 단일화 | `ChatTitleBar` 가 자기 필터를 안 갖는다 | `VISIBLE_TILE_REGISTRY`(`ChatTitleBar.tsx:30`)가 `visibleRightPanelTileDefinitions` 에서 파생. `MENU_HIDDEN_*` 직접 import 제거 ✅ |
| D-009 파생 불변 | `taskBoard.ts` 무변경 | 구현 커밋 파일 목록에 없다 ✅ |
| D-010 테스트 원복 | 0205 가 뒤집은 자리를 되돌린다 | 3파일에서 방향 반전 — 새로 쓰지 않고 같은 케이스를 되돌렸다 ✅ |

### end-to-end 흐름

```text
사용자가 kebab 을 연다
  → ChatTitleBar.VISIBLE_TILE_REGISTRY (4종, 정의 순서)      ← 잠김(AT-01) · 최종 .map() 홉만 미잠금
  → TOGGLE_RIGHT_PANEL_TILE('task') → activateTile           ← 잠김(AT-02·03), 우회 경로 0
  → RightPanel.tileById('task').Content = TaskTileContent    ← 렌더 배선 확인(구조 대조)
  → TaskProgressList(items, agentTools, cliVersion)          ← **이 홉의 props 전달이 무잠금(D2)**
     ├ 안내 | 빈 문구 | 목록                                  ← 분기 자체는 잠김(AT-15~18)
     └ TaskRow → 제목 · 둘째 줄(메타 | 막힘)                   ← 막힘 양성 잠김, **부재 방향 무잠금(D1)**
  → 완료 발생 → showsUnseenTaskBadge → 배지 span             ← 잠김(AT-05·06)
```

---

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 새 실패 경로 0 | 요청·구독·타이머·상태 변경을 만들지 않는다. 분기 제거와 순수 파생뿐이다 |
| false success 가능성 | **있다 — 검사 장치 쪽** | 프로덕션 동작은 옳으나 두 장치가 침묵한다(D1·D2). 코드가 아니라 잠금의 false success 다 |
| partial failure/rollback | 해당 없음 | 외부 쓰기·마이그레이션 0 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니다 | §5 상태 전이 12행을 코드와 1:1 대조 — 대응 없는 행 0, 코드에만 있는 분기 0 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | 정지 해제는 배열 하나이고 0205 D-006 이 예고한 배지 고착도 함께 풀린다(N6 로 가드 생존 확인) |
| 최적화가 잃은 관측 | 해당 없음 | 캐시·snapshot·호출 축소 0 |
| 출력/요청 worst-case 상한 | 무변경 | 막힘 줄은 행당 문자열 1 · `some()` 은 조기 종료 순회 1회. fan-out 0 |

---

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 0d00156..a7cbff4
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `TileSection`·`SectionPlaceholder` 미사용 export | **정상** | D-004 의 의도적 결과다. 헤더 주석이 복귀 조건을 적었고 죽은 export 린트가 없어 게이트를 깨지 않는다 |
| `VISIBLE_TILE_REGISTRY`·`TaskProgressList` 테스트 전용 | **오탐** | 둘 다 자기 정의 파일 안에서 프로덕션 소비된다(`ChatTitleBar.tsx:220` · `TaskTileContent.tsx:427`) — 스크립트가 동일 파일 참조를 세지 않는다 |
| `SUSPENDED_*`·`MENU_HIDDEN_*`·`rightPanelTileIds` 테스트 전용 | **오탐** | 같은 이유 — `rightPanelTiles.ts` 내부 소비(`:48`·`:61`·`:22`) |
| 형제 정책 비대칭 | 없음 | 스크립트 0건 · `ChatTitleBar` 의 자기 필터가 사라져 비대칭 원인이 오히려 제거됐다 |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `tileById` 소비처 2(`ChatTitleBar:31`·`RightPanel:169`) 재확인. `RightPanel` 은 자기 정지 필터가 없어 활성화된 타일을 그대로 그린다 |
| producer ↔ consumer 파생 불일치 | 없음 | `background` 필드가 `kind==='background'` 와 항상 동치다(`taskBoard.ts:268·276` vs `:227·236`) — 둘째 줄 삼항이 `item.background` 로 갈라도 kind 와 어긋나지 않는다 |
| 동일 규칙 중복 구현 | **SSOT 로 수렴** | 메뉴 필터가 두 벌 → 한 벌(D-008). 의존 문구 조립도 `blockedByText` 하나로 모였다 |

---

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 케이스 실제 존재: **7/7 확인.** `taskSurface0212.render.test.ts` 에서 `AT-05·AT-08`·`AT-06`·`AT-23`·`AT-24`·`AT-18`(2건)·`AT-19` 케이스명을 직접 열거했다.
- 핵심 입력/분기가 실제 실행됨: 확인. 신규 두 파일이 `taskBoardFromMessages → taskBoardOrdered → View` 프로덕션 파생을 그대로 통과시킨다.
- structural proxy 만으로 semantic 목표를 통과시킨 AC: **AC12 하나**(D1) — `#2 완료 필요` 문자열 개수라는 proxy 가 "그 줄이 없다" 를 대신했다.
- **선택된 적대 증거 재측정** — 등록·인용 변이 **8건 중 8건 재현**(방향 일치). 일반 hunk 자동 확장 0.
- **이전 라운드 대조** — 0213 의 첫 검증 라운드다. 대신 **0205 가 red 로 잠갔던 축이 D-010 반전 뒤에도 사는지**를 N6 로 측정했다 — **red 유지, 덮개 회귀 0건**.
- **자기검증 분모** — 구현자 = 검증자다. 구현 보고에 없던 축 **5건**을 만들었고 **2건이 미검출**이다(N1·N2b).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| **M1** `SUSPENDED` 를 `['task']` 로 되돌림 | 7스위트 116케이스 | red(구현 보고 5건) | **red 11건** — 보고 5건 전부 포함 | `VP-02 등록 변이` |
| **M2** SSOT 술어를 `tile.id !== 'task'` 로 좁힘 | 같음 | red(1) | **red 2** | `VP-03 등록 변이` |
| **M2b** 대조군 — 자기 필터 복귀 **단독** | 같음 | **green(불성립)** | **green** — 재현 | `C-01 근거`(불성립 확인) |
| **M2+M2b** 자기 필터 + SSOT 좁힘 | 같음 | red(1) | **red 2** | `VP-03 등록 변이(짝)` |
| **M3** `showTaskBadge` 를 `false` 고정 | 같음 | red(1) | **red 1** — 술어 스위트 10케이스는 green | `VP-04 등록 변이` |
| **M4** 둘째 줄 두 분기 산출 맞바꿈 | 같음 | red(4) | **red 6** — 보고 4건 포함 | `VP-07 등록 변이` |
| **M5** 안내 분모를 `items.length > 0` 로 되돌림 | 같음 | red(1) | **red 1** | `VP-08 등록 변이` |
| **M6** 래퍼에서 `TaskProgressList` 호출 제거 | 같음 | red(1) | **red 1** | `새 oracle 민감도`(구 AT-29 승계) |
| **N1** `blockedBy.length === 0` 가드 제거 | **전체 309파일 2997케이스** | 미실행 | **green — 미검출** | `VP-06 / AC12` → **D1** |
| **N2** 래퍼가 `agentTools`·`cliVersion` 을 안 넘김 | 7스위트 | 미실행 | 테스트 green · typecheck **red**(TS6133 잔여물) | 잔여물 — 아래로 민다 |
| **N2b** 위 + 잔여 `useChatSession` 두 줄 정리 | **전체 + typecheck + lint** | 미실행 | **전건 green — 미검출** | `VP-08 path 마지막 홉` → **D2** |
| **N4** 소비자가 SSOT 를 읽되 순서를 뒤집음 | 7스위트 | 미실행 | **red 2** | `VP-03 보강 축`(검출) |
| **N5** 공유 조립 함수의 구분자 `', #'` → `' / '` | 7스위트 | 미실행 | **green — 미검출** | 다중 id 문구를 단언하는 AC 가 현재 V 에 없다 → **D3 (NON_BLOCKING)** |
| **N6** 배지의 정지 가드 소거(0205 가 잠갔던 축) | 7스위트 | red(0205) | **red 1** | 덮개 회귀 없음 |

- 동작 보존 추출 라운드인가: **아니다** — 동작이 실제로 바뀌는 라운드라 hunk 되돌림 논점이 적용되지 않는다.
- **소거 변이의 잔여물 수렴**: N2 는 1단계에서 `TS6133` 두 건에 걸렸다. §4 대로 잔여물(미사용 `useChatSession` 두 줄)을 치워 **진단 0** 상태(N2b)까지 밀었고, 그 상태에서 typecheck 0 · lint 0 error · vitest 2997 전건 green 이었다. **판정은 N2b 상태로 한다.**
- 형제 슬롯 맞바꿈 변이: M4 로 수행 — 둘째 줄 두 분기를 맞바꿔 **red 6**. 존재만 보는 단언이 아님을 확인했다.
- `N회` 기준의 실제 관측 주체: 해당 없음 — 이번 AC 에 호출 횟수 기준이 없다.
- 순서 기준의 관측 훅: AT-01 이 프로덕션 상수 배열을 직접 읽는다. N4(순서 반전)가 red 라 순서가 실제로 잠겨 있다.

---

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-01 | AR-02 ↔ AT-07 / AR | REQUIRED | **PASS** | `SUSPENDED` `[]` · 4종 술어 false · seam 양성 짝 | 배열 → 3소비처 / EP-01 3/3 |
| VP-02 | R-01 ↔ AT-02·03·04 / R | REQUIRED | **PASS** | reducer 케이스 + **M1 red 11** | 액션 → `activateTile` → 열 / EP-01 3/3 |
| VP-03 | AR-01 ↔ AT-01 / AR | **PASS**(감도 제한 명시) | REQUIRED | **M2 red 2 · M4… 아니라 N4 red 2** · M2b green 은 설계 정정대로 | 메뉴 상수 / EP-02 2/2 |
| VP-04 | SD-01 ↔ AT-05·06 / SD | REQUIRED | **PASS** | 술어 2방향 + 렌더 3케이스 + **M3 red 1**(술어 스위트는 green) | store → 배지 span / EP-03 2/2 |
| VP-05 | R-02 ↔ AT-08·09·10 / R | REQUIRED | **PASS** | 껍데기 부재 + 목록 존재 + **M6 red 1** | 래퍼 → 목록 / EP-06 1/1 |
| VP-06 | MD-01 ↔ AT-11·12·13 / MD | REQUIRED | **PAIR_FAIL** | AT-11 양성·AT-13 은 잠김. **AT-12 의 부재 방향이 N1 에 침묵** | fold → 둘째 줄 / EP-04 2/2 |
| VP-07 | MD-01 ↔ AT-14 / MD | REQUIRED | **PASS** | **M4 red 6** — 형제 맞바꿈에 실패한다 | 같은 슬롯의 background 분기 / EP-04 2/2 |
| VP-08 | MD-02 ↔ AT-15·16·17·18 / MD·R | REQUIRED | **PAIR_FAIL** | 분기 자체는 **M5 red 1** 로 잠김. **path 가 적은 `→ 카드` 마지막 홉이 N2b 에 침묵** | 래퍼 → View → 카드 / EP-05 1/1 |
| VP-09 | R-90 ↔ AT-19 / R | REGRESSION | **PASS** | 0212 `AT-05·AT-08`·`AT-06` green | fold → 행 / EP-06 1/1 |
| VP-10 | R-91 ↔ AT-20 / R | REGRESSION | **PASS** | 0212 `AT-23`·`AT-24` green | `canBackgroundTask` → 두 타일 |
| VP-11 | R-92 ↔ AT-21 / R | REGRESSION | **PASS** | 0212 `AT-18`(2건)·`AT-19` green | `canStopTask` → 두 타일 |
| VP-12 | MD-90 ↔ AT-10 / MD | REGRESSION | **PASS** | 단일 목록 케이스(할 일 2 + background 1 동시) green | 같은 fold 경로 |

- **root `PAIR_FAIL`: VP-06 · VP-08 — 서로 독립이다.** 공통 원인이 아니라 서로 다른 계약의 서로 다른 홉이다.
- 종속 `BLOCKED_BY`: **0건.** 두 pair 모두 하위 root 실패가 없고, 나머지 10 pair 를 독립 판정할 수 있었다.
- 하나의 증거가 함께 닫은 pair: M4 가 VP-06 의 양성 방향과 VP-07 을 함께 red 로 만든다 — VP-07 의 판정 범위는 형제 맞바꿈까지이고, VP-06 의 부재 방향은 M4 가 닫지 않는다.
- 이번 라운드 실행 범위: **최초 검증 — 유효 V 12 pair 전건 + 운영 gate 5종 전건.**

### AT / AC 세부와 합계

| AT / AC | 결과 | 검증 증거 (검증자 재실행) |
|---|---|---|
| AC1 | ✅ | `메뉴가 정의 순서대로 4종을 담는다` green · M2·N4 에 red |
| AC2·AC3 | ✅ | `TOGGLE 이 …` · `SET_RIGHT_PANEL_TILE_ACTIVE(true) 도 …` green · M1 에 red |
| AC4 | ✅ | `background 완료 통지가 …`(`toContain('task')`) · `각 타일 열기는 …` green · M1 에 red |
| AC5·AC6 | ✅ | 술어 2방향 + 렌더 3케이스 green · M3 에 양성 케이스만 red |
| AC7 | ✅ | `프로덕션 정지 목록이 비어 …` green · M1 에 red |
| AC8·AC9 | ✅ | `껍데기 없이 목록 View 만 그린다` — 4문구·`진행 상황`·`aria-expanded` 부재 + `sectionBodies` `{}` |
| AC10 | ✅ | `목록에 상태 그룹 헤더가 없다 …` — 할 일 2 + background 1 동시 |
| AC11 | ✅ | `AT-11·AT-12` 양성 방향 green |
| **AC12** | **⚠️** | 동작은 옳다(가드 `:126` 실재). **장치가 잠그지 않는다** — 가드 제거 시 미막힘 행이 `# 완료 필요` 를 내는데 2997케이스 전건 green(D1) |
| AC13 | ✅ | `AT-13 — completed 행은 …` green · 양성 짝(`line-through`) 포함 |
| AC14 | ✅ | `AT-14 — background 행은 …` green · M4 에 red |
| AC15 | ✅ | `AT-15 — … 안내와 목록이 함께 선다` green · M5 에 red. **AC 원문 범위 안에서 닫힌다**(래퍼 홉은 VP-08 쪽 D2) |
| AC16·AC17·AC18 | ✅ | 신규 3케이스 + 0212 `안내는 할 일이 있으면 …`·`AT-03`·`AT-01` green |
| AC19·AC20·AC21 | ✅ | 0212 회귀 7케이스 green (§4 케이스명 확인) |

- **합계 재측정: `✅ 20 · ⚠️ 1 · ❌ 0 = 총 21`**(분모 21 을 §7 표에서 직접 세었다 — R-01 7 + R-02 3 + R-03 4 + R-04 4 + R-90·91·92 3).
- 자기보고 값: `✅ 21 / 21`. **1행 불일치** — AC12 를 ✅ 로 적었고 그 증거가 `#2 완료 필요` 1회 카운트다.
- **합계 사본 대조**: 본문 `21` ↔ 커밋 trailer `Criteria-Met: 21/21` ↔ INDEX 비고 `✅21/21` — **자기보고 3곳은 서로 일치**한다. 갈린 것은 자기보고와 재측정 사이다.

### pair별 plan §10 강제 지점 분모 (검증자 재열거)

| EP / Pair | 불변식의 주어 | plan 분모 | 검증자 재열거 | 결과 |
|---|---|---|---|---|
| EP-01 / VP-01·02 | 정지 정책을 읽는 프로덕션 지점 | 3 | **3** — `chatReducer.ts:1507` · `rightPanelTiles.ts:61` · `:79` | **3/3** |
| EP-01 차집합 | 게이트를 우회하는 활성화 경로 | 0 | **0** — `addTileColumnMajor` 프로덕션 호출은 `:1507` 하나. `activateTile` 호출 5곳 전부 그 게이트 경유 | 우회 0 |
| EP-02 / VP-03 | 메뉴 목록을 만드는 지점 | 2 | **2** — 정의 `:60` · 소비 `ChatTitleBar.tsx:30`. `:220` 최종 `.map()` 은 분모 밖(미잠금) | **2/2** |
| EP-03 / VP-04 | 배지 판정 결과를 쓰는 지점 | 2 | **2** — 호출 `:79` · 렌더 `:202` | **2/2** |
| EP-04 / VP-06·07 | 의존 문구를 화면에 내는 지점 | 2 | **2** — 행 `:268`(←`:184`←`:127`) · 상세 `:141`. 리터럴 `blockedByValue` 는 `:120` 1곳 | **2/2** |
| EP-05 / VP-08 | 기능 부재 안내를 판정하는 지점 | 1 | **1** — `:302`. `agentTools` 전수(ipc·claude-map·reducer·전달)에서 판정하는 곳은 여기뿐 | **1/1** |
| EP-06 / VP-05·09~12 | 섹션 껍데기를 두는 지점 | 1 | **1** — 호출 **0건**(남은 것은 주석과 정의 파일) | **1/1** |

- **합계 검산: 3+2+2+2+1+1 = 11 · 닫음 11 → `11/11`.** 자기보고와 일치한다.
- **라벨이 참인지 표본 확인**: 자기보고가 "함수 기본인자 seam 이지 소비가 아니다" 로 분모에서 뺀 `rightPanelTiles.ts:54`·`:77` 두 줄을 직접 읽었다 — 둘 다 `= SUSPENDED_RIGHT_PANEL_TILES` 기본인자 선언이 맞다. 라벨 참.
- 표에 없는데 같은 불변식이 필요한 지점: **1건 — 래퍼→View props(`TaskTileContent.tsx:427-432`).** EP-05 는 판정 지점만 세고 그 판정 입력이 어디서 오는지를 세지 않는다 → D2.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: **0건**(plan §10 이 그렇게 적었고 재확인했다).

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 결과 | 관측 산출 |
|---|---|---|---|
| subtree — `app/**` 타입 | renderer 소스 변경 | **PASS** | `npm run typecheck` 3구성 실행 · `error TS` **0건** |
| subtree — `app/**` lint | 같음 | **PASS** | `npm run lint` **0 error / 1 warning** — `useTranscriptVirtualizer.ts:22` 기존분. `--fix` 실행 후 `git status` **0줄**(트리 무변경) |
| subtree — 관련 스위트 | reducer·렌더·타일 SSOT 변경 | **PASS** | `./node_modules/.bin/vitest run`(필터 없음) — **309파일 2997케이스 전건 green** |
| repository — 문서 인벤토리 | 문서 링크 증가 | **PASS** | `generated ok (9 items, 82 channels)` · `prose ok` · `links ok` |
| repository — 스크립트 | 저장소 위생 | **PASS** | `node --test "scripts/*.test.mjs"` — **67 pass / 0 fail** (8 suites) |
| repository — IPC 계약 | 해당 없음 | — | 신규 채널·variant 0 |

> **gate 는 전부 PASS 다.** 이번 FAIL 은 gate 가 아니라 pair 두 건에서 나왔다.

---

## 6. 외부 포트 / 문서 계약

해당 없음 — 신규 IPC 채널·`NormalizedEvent` variant·설정 키·외부 구현 포트가 0이다. `docs/IPC_CONTRACT.md` 갱신 대상 없음을 `check-doc-inventory` 가 함께 확인한다(82 channels 불변).

---

## 7. 숫자 / 음성 기준 / 상한 재측정

- 정지 소비처 **3** · `addTileColumnMajor` 우회 **0** · 메뉴 SSOT **2** · 배지 **2** · 문구 **2** · 안내 판정 **1** · 껍데기 **0** — 전부 재측정 일치(§5 분모 표).
- 내역 합 = 총계: AC 21 = 7+3+4+4+3 ✅ · pair 12 = 8+4 ✅ · 강제 지점 11 = 3+2+2+2+1+1 ✅.
- 0건 게이트의 정당한 예외 보존: `TileSection` 호출 0건 판정이 **정의 파일과 주석을 지우지 않았다** — D-004 의 보존 대상이 살아 있다(파일 존재 확인).
- 음성 단언의 양성 짝: 부재 단언 6건(AC7·8·9·12·13·17) 전부 같은 케이스 또는 같은 파일에 양성 짝이 있다. **다만 AC12 의 짝은 형태가 약하다**(D1).
- 상한 재계산: 막힘 줄 = 행당 문자열 1 · `items.some()` = 조기 종료 1회 순회. worst-case 증가 0.

---

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 메뉴 `.map()` 최종 렌더 | 앞 홉(파생 상수 id·순서)까지 — M2·N4 red | **1홉** — `Popover` 를 열어 4항목이 실제 DOM 에 뜨는가 | 앱 실행 → kebab 클릭 → `작업` 항목 확인 |
| 안내/목록 간격(I-01) | 렌더 산출의 문구 동시 존재 | 시각 — `gap-px` 로 한 덩어리로 읽히는가 | `TaskCreate` 없는 CLI + 서브에이전트 1건 상태에서 타일 열기 |
| 래퍼→View props | **기계 검증 가능하다 — 아직 안 했다** | 없음 | `vi.mock('../../store/chatStore')` 로 `TaskTileContent` 를 시드 렌더(선례: `ChatTitleBar.render.test.ts`) → D2 |

> 사람 실기로 넘긴 항목은 **2건뿐**이고 둘 다 DOM 환경·시각 사안이다. D2 는 사람 실기가 아니라 **미작성 기계 검증**이라 여기 남기지 않고 blocking 으로 올린다.

---

## 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check`. `app/AGENTS.md` 대로 **`npm test` 를 쓰지 않았다**(DB 동작 검증 불필요, ABI 중립 유지).
- **관측한 실행 산출**(exit code 아님): typecheck `error TS` 0줄 / lint 0 error·1 warning / vitest **309파일 2997케이스** / scripts **67 pass·0 fail** / doc-inventory 3줄 ok.
- **exit 0 을 통과로 읽지 않은 실측 1건**: 저장소 루트에서 `node --test "scripts/*.test.mjs"` 를 돌리자 `# tests 0 / # pass 0` 에 **exit 0** 이 나왔다(glob 이 `app/scripts` 를 못 찾는다). 산출을 읽었기에 `app/` 에서 재실행해 67건을 얻었다 — exit code 만 봤으면 0건을 green 으로 옮길 뻔했다.
- ABI/egress 분리 근거: 이 베이스의 `better-sqlite3` 는 이미 Node ABI 라 DB 스위트 10파일이 green 이다. 환경 기인 red **0건**이라 분리할 실패가 없다.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint` 가 `--fix` 다. 실행 후 `git status --porcelain` **0줄** — autofix 산출 0, 검증 대상에 검증자 편집분이 섞이지 않았다.
- **검증 중 실행한 명령이 남긴 잔여물**: 변이 8+6회를 파일 백업/복원 방식으로 돌렸고 매 회차 뒤 `git status --porcelain` 0줄을 확인했다. 프로브 테스트 파일 1개는 실행 후 삭제했다. 최종 트리 = `a7cbff4` 그대로.

---

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 전건 PASS |
| AC ↔ production path | 21행 1:1 대조 + 변이 14회 | — | AC12 ⚠️ 외 ✅ |
| 레이어/링크/문서 형식 | boundaries·doc-inventory | — | PASS |
| AGENTS 위생 | 스캔 | — | 해당 없음(AGENTS 무변경) |
| 제품 의도 / Open Question | 보조 | **결정** | I-03·I-04 는 사람 몫 |
| UI 시각 품질 | 로직만 | **시각 확인** | I-01 간격 |
| 신규 의존성 / PR merge | — | **승인** | 신규 의존성 0 |

---

## 11. Repository operation checks

### AGENTS.md 위생

해당 없음 — 이번 구현이 `AGENTS.md` 를 건드리지 않았다.

### INDEX 보드 정합성

- 상태 / 다음 주체: 이번 턴에 `verify/FAIL` · 다음 주체 **구현자** · 라운드 **2** 로 갱신한다.
- 대상 커밋 좌표: 자리표시자 `(r1 구현 — 검증자 기입)` 를 **`a7cbff4`** 로 채웠다(`git cat-file -t` = `commit` 확인). 정본은 INDEX 한 곳이고 plan 구현 보고 행에는 해시를 두지 않았다 — 사본 갈림 없음.
- **비고 5줄 규칙 — r1 비고가 9문장이었다**(D4, NON_BLOCKING). 이번 턴 갱신분은 5줄 이내로 다시 쓴다.
- PASS 시 archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff: docs/handoff/0213-task-tile-resume/` · `Status: implemented` · `Criteria-Met: 21/21` · `Verified-By: pending` — root `AGENTS.md` 표와 일치한다. 구현 커밋에 `Next-Action` 이 없는 것도 규칙대로다.
- **trailer 실제 파싱**: `git log -1 --format='%(trailers:only=true)' a7cbff4` 가 **7키를 그대로 반환**한다(세션 URL 포함, 빈 줄 끊김 0). 설계 커밋 2건도 각 5키 정상.
- 인용 커밋 해시 실재: **확인 불가 — 환경 한계.** 이 클론은 shallow(`is-shallow-repository` = true, 84 커밋)라 `0212:ΔV1 @229a0e67`·`0204:ΔV2 @7b45fa3` 는 물론 INDEX 의 0212 좌표 5개도 전부 `Not a valid object name` 이다. plan §8 이 전자를 `commit ✅` 로 적었으나 **여기서는 재확인할 수 없다** — plan 결함으로 판정하지 않고 못 본 것으로 적는다.
- `[구현자 기입]` 7필드 전수: **7/7 존재**(설계 리뷰 · 강제 지점 전수+V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals). 산문으로 접힌 필드 0 — 전부 표를 갖는다.
- 이동/삭제한 reference·script: 없음.

---

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| C-01 VP-03 적대 증거 불성립 → 설계 커밋으로 교체 | **타당 · 실측으로 재확인** | M2b 를 다시 심어 green 을 재현했다. 규범 정정을 구현 커밋과 분리한 것도 규칙대로다 |
| C-02 3섹션 반대 단언 1케이스 누락 | **타당** | `rightPanelTiles.render.test.ts` 구 AT-29 가 실제로 AC8·AC9 의 정반대였다 |
| C-03~C-05 사실 정정(기준선·좌표·원복 분모) | **타당** | 기준선 307/2983 → 이번 구현 후 309/2997(+2파일 +14케이스 = 신규 두 파일) 로 정합 |
| 설계 대비 차이 — `blockedByText` 헬퍼 신설 | **타당** | 대체물의 새 실패 모드는 "두 요구가 갈리면 함수를 갈라야 한다" 하나이고 상태·만료·재진입 축이 없다. 다만 **다중 id 구분자는 어느 AC 도 단언하지 않는다**(N5 → D3) |
| 배치 차이 — AC8·AC9 를 형제 파일에서 닫음 | **타당** | 구 AT-29 가 잡던 *래퍼→본문 배선* 을 같은 자리에서 승계했고 M6 로 그 하한이 실측된다 |
| 미잠금 1지점(메뉴 `.map()`)을 `N/N` 에 넣지 않음 | **타당** | 분모 11 에서 제외한 것이 §10 지시대로다 |

---

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| **D1** | AC12 의 부재 방향이 잠기지 않는다 — `blockedRowText` 의 `blockedBy.length === 0` 가드를 지우면 미막힘 행마다 `# 완료 필요` 가 뜨는데 **2997케이스 전건 green** 이다. 카운트 정규식이 `/#2 완료 필요/g` 라 id 없는 같은 문구를 못 본다 | `VP-06` · AC12 | **BLOCKING** | root `PAIR_FAIL: VP-06` | 구현 — 카운트 술어를 문구 전체로 넓히거나 미막힘 행의 둘째 줄 부재를 직접 단언한다. **검증자 실측: `/완료 필요/g` 로 넓히면 그 변이가 red 가 된다** |
| **D2** | VP-08 이 적은 path 의 마지막 홉(`→ 카드`)이 잠기지 않는다 — `TaskTileContent` 가 `agentTools`·`cliVersion` 을 안 넘기면 안내가 **프로덕션에서 영영 안 뜨는데** typecheck 0 · lint 0 · 2997 전건 green 이다(잔여물까지 민 N2b) | `VP-08` · §12 producer→consumer · D-001 의 도달 목적 | **BLOCKING** | root `PAIR_FAIL: VP-08` | 구현 — `vi.mock('../../store/chatStore')` 로 `TaskTileContent` 를 시드 렌더해 props 통과를 단언한다(선례 `ChatTitleBar.render.test.ts`). 새 계약 불필요 |
| **D3** | 다중 `blockedBy` 의 구분자(`', #'`)를 단언하는 곳이 없다 — 공유 헬퍼의 구분자를 바꿔도 전건 green | EP-04 SSOT 유지 자체는 성립 · 현재 V 에 해당 AC 없음 | **NON_BLOCKING** | — | 기록. 다중 의존 표시가 제품 요구가 되면 그때 AC 를 만든다 |
| **D4** | INDEX r1 비고가 **9문장**이라 `AGENTS.md §산출물 문장 규칙 3`(5줄)을 넘는다 | repository operation | **NON_BLOCKING** | — | 이번 검증 턴 갱신분은 5줄 이내로 쓴다. 과거 행은 손대지 않는다 |
| **D5** | 인용 커밋 좌표를 이 환경에서 확인할 수 없다 — shallow clone(84 커밋)이라 0212·0204 좌표 7건이 전부 미해석 | 검증 환경 | **NON_BLOCKING** | — | 기록만. 다음 라운드도 같은 환경이면 좌표 확인은 계속 불가다 |

> plan `[검증자 기입] 파생 이슈` 로 이관했다. 구현자가 남긴 I-01~I-04 는 그대로 살아 있다.

---

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상인가**: 그렇다. D1·D2 는 plan §7 `관측 지점 규칙` 이 미리 이름 붙인 축 — **"oracle 이 프로덕션 경로의 한 홉 앞에 선다"** — 이고 0212 가 네 라운드를 쓴 축이다. plan 이 그 축을 셋(메뉴 상수·배지 술어·안내 조건) 찾아 잠갔는데, **찾지 못한 두 지점이 같은 형태로 남았다**.
- **관련 plan 지침/AC 가 있었는가**: 있었다. D1 은 `READY self-review` 의 "음성 단언에 양성 짝이 있다" 가 체크됐고 §7 주의사항이 짝을 열거했으나, **짝의 존재만 세고 짝이 실제로 잠그는지는 재지 않았다** — C-01 이 같은 이유(변이를 등록만 하고 성립성은 안 봄)로 나왔던 것과 같은 형태다. D2 는 VP-08 의 path 칸이 `→ 카드` 로 끝나는데 oracle 칸은 View 를 적었고, 그 어긋남을 검사하는 self-review 항목이 없었다.
- **사용자 결정 변경 근거**: 이번 라운드에 사용자 결정 변경 없음. D-001·D-002 의 SUPERSEDE 는 `46047ac` 시점 사용자 턴 원문이 근거다.
- **반복된 검증 환경 한계**: ① DOM 환경(`jsdom`·`happy-dom`) 부재 — 메뉴 `.map()` 최종 홉이 0212 P9 에 이어 또 미잠금. ② **shallow clone** 으로 과거 커밋 좌표 확인 불가(D5) — 0212 r2 §0 이 같은 한계를 기록했다.
- **자기 검증 라운드였다**: 설계·구현·검증이 같은 에이전트다. 구현 보고가 이름을 댄 8변이는 **8/8 재현**됐고, 그것만 보면 완결이었다. FAIL 의 근거 2건은 **전부 보고에 없던 축**에서 나왔다.

---

## 15. 결론

- 상태: **FAIL**
- pair 결과: **PASS 10 · root `PAIR_FAIL` 2(VP-06 · VP-08) · `BLOCKED_BY` 0.** 두 실패는 서로 독립이다.
- `PLAN_GAP`: **없다.** 두 건 다 기존 계약(AC12 원문 · VP-08 path 원문)으로 닫히고 새 계약이 필요 없다 — 다음 주체는 설계자가 아니라 **구현자**다.
- Product/UX 및 ACTIVE Decision 충족: **충족.** D-001~D-010 전부 코드에 대응하고 §5 상태 전이 12행에 대응 없는 행이 0이다. 이번 FAIL 은 동작이 아니라 **잠금**의 실패다.
- AC 충족: **✅ 20 · ⚠️ 1(AC12) · ❌ 0 = 21.** 자기보고 21/21 과 1행 갈린다.
- 현재 변경 운영 gate: **5종 전건 PASS** — typecheck 0 · lint 0 error/1 warning(기존분, 트리 무변경) · vitest 309파일 2997케이스 · scripts 67/67 · doc-inventory 3줄 ok.
- `NON_BLOCKING`: D3(구분자 무단언) · D4(INDEX 비고 9문장) · D5(shallow clone 좌표 확인 불가).
- repository operation checks: trailer 7키 파싱 정상 · `[구현자 기입]` 7필드 전수 · INDEX 좌표 기입 완료. 인용 커밋 실재만 **확인 불가**(D5).
- 남은 사람 확인: 메뉴 `.map()` 최종 렌더 1홉 · I-01 간격 시각 · I-03·I-04 설계 재확인.
- 다음 단계: **구현자가 D1·D2 를 닫고 r2 로 되돌린다.** 두 건 다 단언 추가이고 프로덕션 코드 변경이 필요하지 않다.

---

# Verify r2 (2026-09-02) — PASS

> r1 판정 원문은 위 §0~§15 에 그대로 둔다. 이번 절은 **r2 가 바꾼 것과 그것을 다시 잰 결과**만 적는다.

## 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `de93022..30c08f0` (구현 커밋 `30c08f0` 단일) |
| 구현 전 plan 기준 | `de93022` (r1 검증) · 규범 기준선은 `0d00156` 불변 |
| V mode / 유효 V | `Baseline V` / `0213:V1` — 12 pair(REQUIRED 8 · REGRESSION 4) |
| 검증 기준 plan revision | `0d00156:V1` (r1 과 동일 — r2 가 규범 행을 바꾸지 않았다) |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude 다.** §4 에 구현 보고가 이름을 대지 않은 적대 축 **6건**(X1·X2·X3·X5·X6·X7)과 §10 분모 독립 재열거를 넣었다 — **3건 미검출**이고 셋 다 현재 pair·AC·ACTIVE Decision 위반이 아니라 `NON_BLOCKING` 이다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **했다 — 삽입 88줄, 삭제 2줄.** 삭제 2줄은 `[검증자 기입] 파생 이슈` 의 D1·D2 상태 칸(`open (r2)` → `closed (r2)`)뿐이다.
- **기준선이 diff 로 성립한다.** 설계(`0d00156`)·r1 산출(`a7cbff4`)·r1 검증(`de93022`)·r2 산출(`30c08f0`)이 전부 갈린 커밋이다.
- Decision Ledger·Product/UX Contract·AC·V node/pair·§10·oracle 변경: **없다.** `git show 30c08f0 -- plan.md` 의 삭제 줄이 위 2줄이 전부라 규범 행이 손대지지 않았음을 diff 로 확인했다.
- 채점에 사용할 원 기준: `0d00156` 의 §7 AC 표 · §7-A pair registry · §10 EP 표 — r1 과 같다.
- plan validity: r1 §0 판정을 승계한다. r1 이 미흡으로 적은 두 행(VP-06 적대 증거 면제 · VP-08 path 마지막 홉)은 **계약이 아니라 증거의 문제**였고 이번 라운드가 증거를 채웠다 — 규범 정정이 없었으므로 `PLAN_GAP` 재검사 대상이 새로 생기지 않았다.
- **root `PLAN_GAP`: 없다.**

## 1. Product & UX / ACTIVE Decision

**프로덕션 파일 변경 0.** `git diff --name-only de93022..30c08f0` = 테스트 1 · `plan.md` · `INDEX.md` 셋뿐이다. D-001~D-010 의 production path 는 r1 §1 표 그대로이고 이번에 좌표만 재확인했다 — `blockedRowText:125` · `TaskRow` 렌더 `:267` · `unsupported:302` · 래퍼 props `:427-431` · `SUSPENDED=[]:45`.

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 실패 경로 | 0 | 테스트 파일만 바뀌었다. 프로덕션 분기·상태·요청 무변경 |
| false success 가능성 | **줄었다 — 다만 한 축에서 새로 생겼다** | r1 의 두 침묵이 닫혔다(§4). 대신 전체 카운트 단언이 사라져 **행 밖 산출**을 못 본다(D6) |
| Product/UX 의 A 가 아닌 B | 아니다 | 사용자가 관측하는 산출이 r1 과 동일하다 — 렌더 입력·출력 불변 |
| 최적화가 잃은 관측 | 해당 없음 | 캐시·호출 축소 0 |
| 출력/요청 worst-case | 무변경 | 렌더 경로 불변 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh de93022..30c08f0
# → 변경된 소스 파일이 없습니다 (범위: de93022..30c08f0, 루트: app/src)
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 프로덕션 표면 | **0건** | 스크립트가 비테스트 소스 변경 0을 낸다 — r2 는 잠금만 바꿨다 |
| 신규 테스트 장치의 프로덕션 진입 | **진입한다** | `TaskTileContent` 시드 렌더가 `useTaskBoard`(`:63`) → `taskBoardFromMessages` → `TaskProgressList` 프로덕션 fold 를 그대로 지난다 |
| 모킹이 가린 배선 | 없음 | 모킹 대상은 `store/chatStore` 하나이고 fold·View·행 조립은 전부 실물이다 |
| 동일 규칙 중복 구현 | SSOT 유지 | 막힘 문구 조립은 `blockedByText` 1곳(`:119-120`) 그대로 |

## 4. 적대 증거 재측정 — 24회

- **선택된 적대 증거 재측정**: 등록·인용·신규 oracle 변이 **9건 중 9건 검출**. 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1 이 red 로 본 8변이 **8/8 재현**(M2b 대조군 green 도 재현). 등록 변이 축의 `red → green` **0건**.
- **자기검증 분모**: 구현자 = 검증자다. 보고에 없던 축 **6건**을 만들었고 **3건 미검출**(X3·X5·X6)이다. X6 은 구 장치가 red 로 잡던 자리라 **덮개 회귀**로 판정한다(D6).
- 범위 표기: `7스위트` = `taskTile0213`·`taskSurface0212`·`rightPanelTiles.render`·`rightPanelTiles`·`ChatTitleBar.render`·`chatReducer.plan`·`chatReducer.task` = **120케이스**(r1 116 + 신규 4).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| **N1** `blockedBy.length === 0` 가드 제거 | 7스위트 | **green(미검출)** | **red 2** — `AT-11·AT-12` · `AT-13` | `D1 인용 변이` → 닫힘 |
| **N1b** `completed` 가드 제거 | 7스위트 | 미실행 | **red 1** — `AT-13` | `D1 형제 축` |
| **N2b** `agentTools`·`cliVersion` 미전달 + 잔여물 정리 | 7스위트 | **green(미검출)** | **red 1** — 래퍼 홉 케이스 | `D2 인용 변이` → 닫힘 |
| **P-agentTools** 단독 미전달 | 7스위트 | 미실행 | **red 1** | `D2 전수 ①` |
| **P-cliVersion** 단독 미전달 | 7스위트 | 미실행 | **red 1** | `D2 전수 ②` |
| **P-items** `items={[]}` | 7스위트 | 미실행 | **red 3** | `D2 전수 ③` |
| **P-stopErrors** 미전달 | 7스위트 | 미실행 | **red 1** | `D2 전수 ④` |
| **DEV** `rowsBySubject` 추출 무력화 | 7스위트 | 미실행 | **red 5** | `새 oracle 민감도` |
| **M6** 래퍼→목록 배선 소거 | 7스위트 | red 1 | **red 5** | `구 AT-29 승계` — 감도 증가 |
| **M1** `SUSPENDED` 를 `['task']` 로 | 7스위트 | red 11 | **red 11** | `VP-02 등록 변이` |
| **M2** SSOT 술어를 `tile.id !== 'task'` 로 | 7스위트 | red 2 | **red 2** | `VP-03 등록 변이` |
| **M2b** 대조군 — 자기 필터 복귀 단독 | 7스위트 | green(불성립) | **green** | `C-01 근거 재현` |
| **M2+M2b** 자기 필터 + SSOT 좁힘 | 7스위트 | red 2 | **red 2** | `VP-03 등록 변이(짝)` |
| **M3** `showTaskBadge` 를 `false` 고정 | 7스위트 | red 1 | **red 1** | `VP-04 등록 변이` |
| **M4** 둘째 줄 두 분기 맞바꿈 | 7스위트 | red 6 | **red 7** | `VP-07 등록 변이` — 감도 증가 |
| **M5** 안내 분모를 `items.length === 0` 로 | 7스위트 | red 1 | **red 2** | `VP-08 등록 변이` — 감도 증가 |
| **N4** 소비자가 SSOT 순서를 뒤집음 | 7스위트 | red 2 | **red 2** | `VP-03 보강 축` |
| **N6** 배지의 정지 가드 소거 | 7스위트 | red 1 | **red 1** | `0205 축 생존` |
| **X1** 행 `aria-label` 을 `subject`→`title` 로 | 7스위트 | 미실행 | **red 1** — 0212 `AT-05·AT-08` | **신규 축** · `VP-09` 회귀 잠김 |
| **X2** `TaskRow` 의 `stopError` 렌더 블록 소거 | 7스위트 | 미실행 | **red 1** | **신규 축** · P-stopErrors 의 형제 지점 |
| **X7** 목록에 `TileSection` 껍데기 재장착 | 7스위트 | 미실행 | **red 1** | **신규 축** · `VP-05` 부재 방향 |
| **X3** `blockedRowText` 가 `item.blockedBy` 무시하고 `['2']` 고정 | 7스위트 | 미실행 | **green — 미검출** | **신규 축** → **D7** (`NON_BLOCKING`) |
| **X5** 안내 블록을 목록 **아래로** 이동 | 7스위트 | 미실행 | **green — 미검출** | **신규 축** → **D8** (`NON_BLOCKING`) |
| **X6** 막힘 문구를 **행 밖**(목록 레벨)에 한 번 더 흘림 | 7스위트 | — | **green — 미검출** | **신규 축** → **D6** 덮개 회귀 |
| **X6′** 같은 변이를 **r1 테스트 파일**(`a7cbff4`)에 | `taskTile0213` | — | **red 2** — `AT-11·AT-12` · `AT-14` | 위 회귀의 대조 측정 |

- 동작 보존 추출 라운드인가: **아니다** — 프로덕션은 불변이고 잠금이 바뀌는 라운드다. hunk 되돌림 논점은 적용되지 않는다.
- 소거 변이의 잔여물 수렴: N2b·P-* 는 미사용 `const` 를 함께 치워 **진단 0** 상태로 밀었고, 그 상태에서 typecheck 0 · 7스위트 red 를 얻었다.
- 형제 슬롯 맞바꿈: M4 로 수행 — **red 7**. 존재만 보는 단언이 아니다.
- 순서 기준의 관측 훅: AT-01 은 N4(순서 반전)로 red. **안내↔목록의 순서는 관측 훅이 없다**(X5 → D8).

## 5. V-pair closeout

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-01 | AR-02 ↔ AT-07 / AR | REQUIRED | **PASS** | `SUSPENDED` `[]` · M1 red 11 에 정지 술어 케이스 포함 | EP-01 3/3 |
| VP-02 | R-01 ↔ AT-02·03·04 / R | REQUIRED | **PASS** | reducer 3케이스 + M1 red 11 | EP-01 3/3 |
| VP-03 | AR-01 ↔ AT-01 / AR | REQUIRED | **PASS** | M2 red 2 · M2+M2b red 2 · N4 red 2 · M2b green(설계 정정대로) | EP-02 2/2 |
| VP-04 | SD-01 ↔ AT-05·06 / SD | REQUIRED | **PASS** | 술어 2방향 + 렌더 3케이스 · M3 red 1 · N6 red 1 | EP-03 2/2 |
| VP-05 | R-02 ↔ AT-08·09·10 / R | REQUIRED | **PASS** | M6 red 5 · **X7 red 1**(껍데기 재장착이 red) | EP-06 1/1 |
| VP-06 | MD-01 ↔ AT-11·12·13 / MD | **PASS**(r1 `PAIR_FAIL` 닫힘) | **PASS** | N1 red 2 · N1b red 1 · DEV red 5 | EP-04 2/2 |
| VP-07 | MD-01 ↔ AT-14 / MD | REQUIRED | **PASS** | M4 red 7 | EP-04 2/2 |
| VP-08 | MD-02 ↔ AT-15·16·17·18 / MD·R | **PASS**(r1 `PAIR_FAIL` 닫힘) | **PASS** | N2b red 1 · props 전수 4변이 각 red · M5 red 2 · X2 red 1 | EP-05 1/1 |
| VP-09 | R-90 ↔ AT-19 / R | REGRESSION | **PASS** | 0212 `AT-05·AT-08`·`AT-06` green · **X1 red 1** | EP-06 1/1 |
| VP-10 | R-91 ↔ AT-20 / R | REGRESSION | **PASS** | 0212 `AT-23`·`AT-24` green | — |
| VP-11 | R-92 ↔ AT-21 / R | REGRESSION | **PASS** | 0212 `AT-18`(2건)·`AT-19` green | — |
| VP-12 | MD-90 ↔ AT-10 / MD | REGRESSION | **PASS** | `taskBoard.test.ts` `AT-10a` 2케이스 green · M4 가 그룹 헤더 케이스도 red | EP-06 1/1 |

- **root `PAIR_FAIL`: 0건. `BLOCKED_BY`: 0건.** r1 의 두 root(VP-06·VP-08)가 각자 인용 변이로 닫혔다.
- 이번 라운드 실행 범위: **재검증이지만 12 pair 전건을 다시 실행했다** — r2 가 바꾼 파일이 여러 pair 의 oracle 을 함께 담고 있어 영향 범위를 파일로 자를 수 없었다. 게이트도 5종 전건.
- 하나의 증거가 함께 닫은 pair: M4 는 VP-07 을, DEV 는 VP-06 의 세 케이스를 함께 red 로 만든다 — 각 행에 판정 범위를 적었다.

### AT / AC 세부와 합계

| AT / AC | r1 | r2 | 검증 증거 (검증자 재실행) |
|---|---|---|---|
| **AC12** | ⚠️ | **✅** | `rows['선행 작업']`·`rows['그냥 대기']` 가 `/완료 필요/` 에 not.toMatch. **N1 에 red 2** — r1 에 green 이던 자리다 |
| AC11·AC13 | ✅ | ✅ | 같은 케이스가 행 귀속으로 좁혀졌다. N1b red 1 |
| AC14 | ✅ | ✅ | M4 red 7 |
| AC15~AC18 | ✅ | ✅ | 신규 래퍼 홉 4케이스 추가. N2b·props 4변이 각 red · M5 red 2 |
| AC1~AC10 | ✅ | ✅ | 프로덕션 무변경 · M1 11 · M2 2 · M3 1 · N4 2 · M6 5 · X7 1 |
| AC19·AC20·AC21 | ✅ | ✅ | 0212 회귀 7케이스 green · X1 red 1 |

- **합계 재측정: `✅ 21 · ⚠️ 0 · ❌ 0 = 총 21`.** 분모 21 을 §7 표에서 다시 세었다 — R-01(7)+R-02(3)+R-03(4)+R-04(4)+R-90·91·92(3) = 21.
- 자기보고 값 `✅ 21/21` 과 **일치**한다. r1 의 1행 갈림(AC12)이 해소됐다.
- **합계 사본 대조**: 본문 `21` ↔ 커밋 trailer `Criteria-Met: 21/21` ↔ INDEX 비고 `✅21/21` — **3곳 일치**.

### pair별 plan §10 강제 지점 분모 (검증자 독립 재열거)

| EP / Pair | 불변식의 주어 | plan 분모 | 검증자 재열거 | 결과 |
|---|---|---|---|---|
| EP-01 / VP-01·02 | 정지 정책을 읽는 프로덕션 지점 | 3 | **3** — `chatReducer.ts:1507` · `rightPanelTiles.ts:61` · `:79` | **3/3** |
| EP-01 차집합 | 게이트를 우회하는 활성화 경로 | 0 | **0** — `addTileColumnMajor` 프로덕션 호출은 `activateTile:1507` 하나, `activateTile` 호출 5곳이 전부 그 게이트 경유 | 우회 0 |
| EP-02 / VP-03 | 메뉴 목록을 만드는 지점 | 2 | **2** — 정의 `rightPanelTiles.ts:60` · 소비 `ChatTitleBar.tsx:30`. `:220` 최종 `.map()` 은 분모 밖 | **2/2** |
| EP-03 / VP-04 | 배지 판정 결과를 쓰는 지점 | 2 | **2** — 호출 `ChatTitleBar.tsx:79` · 렌더 `:202` | **2/2** |
| EP-04 / VP-06·07 | 의존 문구를 화면에 내는 지점 | 2 | **2** — 행 `:184`→`:267` · 상세 `:141`. 리터럴은 `:120` 1곳 | **2/2** |
| EP-05 / VP-08 | 기능 부재 안내를 판정하는 지점 | 1 | **1** — `:302`. `agentTools` 전수 9줄 중 판정은 여기뿐(나머지는 선언·기본값·상태·전달) | **1/1** |
| EP-06 / VP-05·09~12 | 섹션 껍데기를 두는 지점 | 1 | **1** — 프로덕션 호출 **0건**(남은 것은 정의 파일과 주석) | **1/1** |

- **합계 검산: 3+2+2+2+1+1 = 11 · 닫음 11 → `11/11`.** 자기보고와 일치한다.
- **라벨이 참인지 표본 확인**: 분모에서 뺀 `rightPanelTiles.ts:54`·`:77` 두 줄을 직접 읽었다 — 둘 다 `= SUSPENDED_RIGHT_PANEL_TILES` 기본인자 선언이 맞다. 라벨 참.
- **표 밖에서 같은 불변식이 필요한 지점**: r1 이 지목한 **래퍼→View props** 하나. 이번 라운드가 4 props 전수로 잠갔다 — VP-08 의 path 칸이 이미 `→ 카드` 로 그 홉을 갖고 있으므로 **새 §10 행 없이 닫힌다**. `PLAN_GAP` 아님. 설계자가 분모에 얹고 싶으면 EP 신설은 선택이다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: **0건**.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 결과 | 관측 산출 |
|---|---|---|---|
| subtree — `app/**` 타입 | renderer 테스트 변경(`tsconfig.test.json` 포함) | **PASS** | `npm run typecheck` 3구성 · `error TS` **0건** |
| subtree — `app/**` lint | 같음 | **PASS** | `npm run lint` **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22` 기존분). `--fix` 후 `git status --porcelain` **0줄** |
| subtree — 관련 스위트 | 여러 pair 의 oracle 이 든 파일 | **PASS** | `./node_modules/.bin/vitest run`(필터 없음) — **309파일 3001케이스 전건 green**(exit 0) |
| repository — 문서 인벤토리 | 문서 변경 | **PASS** | `generated ok (9 items, 82 channels)` · `prose ok` · `links ok` |
| repository — 스크립트 | 저장소 위생 | **PASS** | `node --test "scripts/*.test.mjs"` — **67 pass / 0 fail** (8 suites) |
| repository — IPC 계약 | 해당 없음 | — | 신규 채널·variant 0 (82 channels 불변) |

## 6. 외부 포트 / 문서 계약

해당 없음 — 신규 IPC 채널·`NormalizedEvent` variant·설정 키·외부 포트 0. `check-doc-inventory` 가 82 channels 불변을 함께 확인한다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- 강제 지점 재측정: 3·2·2·2·1·1 → 합 11 = plan 총계 ✅ (위 표가 각 좌표를 갖는다).
- AC 21 = 7+3+4+4+3 ✅ · pair 12 = 8+4 ✅ · 케이스 3001 = r1 2997 + 신규 4 ✅.
- 0건 게이트의 정당한 예외 보존: `TileSection` 호출 0건 판정이 정의 파일·주석을 지우지 않았다(D-004 대상 생존 확인).
- **음성 단언의 양성 짝**: 부재 단언 6건(AC7·8·9·12·13·17) 전부 짝이 있고, r1 이 "형태가 약하다" 고 적은 AC12 의 짝이 이번에 실측으로 강해졌다(N1 red 2).
- 상한 재계산: 렌더 경로 무변경 — worst-case 증가 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 메뉴 `.map()` 최종 렌더 | 앞 홉(파생 상수 id·순서) — M2·N4 red | **1홉** — `Popover` 를 열어 4항목이 DOM 에 뜨는가 |
| 안내/목록 간격(I-01) | 문구 동시 존재 | 시각 — `gap-px` 로 한 덩어리로 읽히는가 |
| 래퍼→View props | **닫혔다** — props 4개 전수 red | 없음 |

> 사람 실기는 **2건**으로 r1 과 같고, r1 이 세 번째로 적었던 래퍼 홉은 이번에 기계 검증으로 내려왔다.

## 9. 게이트 재실행

- 실행 명령: `cd app && npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check`. `app/AGENTS.md` 대로 **`npm test` 를 쓰지 않았다**.
- **관측한 실행 산출**(exit code 아님): typecheck `error TS` 0줄 / lint 0 error·1 warning / vitest **309파일 3001케이스** / scripts **67 pass·0 fail** / doc-inventory 3줄 ok.
- ABI/egress 분리: 이 베이스의 `better-sqlite3` 는 이미 Node ABI 다(`require('better-sqlite3')` 성공) — DB 스위트 10파일이 green 이라 분리할 환경 실패가 **0건**이다.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint` 가 `--fix` 다. 실행 후 `git status --porcelain` **0줄**.
- **검증 중 실행한 명령이 남긴 잔여물**: 변이 24회를 `git checkout`/`git reset --hard` 로 되돌렸고 매 회차 뒤 트리 0줄을 확인했다. 최종 트리 = `30c08f0` 그대로(`git log --oneline -1` 확인). 변이 스크립트는 저장소 밖 스크래치패드에 두었다.

## 10. 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 5종 PASS |
| AC ↔ production path | 21행 대조 + 변이 24회 | — | ✅21/21 |
| 레이어/링크/문서 형식 | doc-inventory | — | PASS |
| 제품 의도 / Open Question | 보조 | **결정** | I-03·I-04 |
| UI 시각 품질 | 로직만 | **시각 확인** | I-01 간격 · 메뉴 최종 렌더 |
| 신규 의존성 / PR merge | — | **승인** | 신규 의존성 0 |

## 11. Repository operation checks

### AGENTS.md 위생

해당 없음 — 이번 구현이 `AGENTS.md` 를 건드리지 않았다.

### INDEX 보드 정합성

- 상태 / 다음 주체: 이번 턴에 `verify/PASS` · 다음 주체 **사람** 으로 갱신한다. 칸에 주체 하나만 둔다.
- 대상 커밋 좌표: 자리표시자 `(r2 구현 — 검증자 기입)` 를 **`30c08f0`** 로 채웠다(`git cat-file -t` = `commit`). 정본은 INDEX 한 곳이고 plan 구현 보고에는 해시를 두지 않았다.
- **비고 5줄 규칙 — r2 구현자 비고가 7문장이다**(D9, `NON_BLOCKING`). r1 D4 와 같은 축이라 이번 갱신분은 5줄 이내로 다시 쓴다.
- PASS 시 archive 이동: **보류.** 사람 몫 3건(I-01 시각 · I-03·I-04 설계 재확인)이 남아 0212·0204 와 같은 관례를 따른다.

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff: docs/handoff/0213-task-tile-resume/` · `Status: implemented` · `Criteria-Met: 21/21` · `Verified-By: pending` — root `AGENTS.md` 표와 일치. 구현 커밋에 `Next-Action` 이 없는 것도 규칙대로다.
- **trailer 실제 파싱**: `git log -1 --format='%(trailers:only=true)' 30c08f0` 이 **7키를 그대로 반환**한다(세션 URL 포함, 파싱 0건 아님).
- 인용 커밋 해시 실재: **확인 불가 — 환경 한계 지속**(D5). 이 클론은 shallow(86 커밋)라 `229a0e67`·`7b45fa3`·INDEX 의 0212 좌표가 전부 `Not a valid object name` 이다.
- `[구현자 기입]` r2 7필드 전수: **7/7 존재** — 설계 리뷰 · 강제 지점 전수+V-pair 자기확인 · 이번 라운드 수정의 잠금(9행 표 + 검산 줄) · Product/UX 파생 검토 · 놓친 잠재 문제(I-05 표) · 구현 보고(AC·게이트 2표) · Review Signals.
- 검산 줄 대조: 자기보고 `선택 증거 0 · 인용 변이 2 · 새 oracle 2 = 표 행 4 + 전수 5 = 9` ↔ 표 행 실측 **9** — 일치.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| D1 은 3자리 중 1자리, D2 는 4 props 중 2개였다 → 불변식으로 올려 전수 적용 | **타당 · 실측 일치** | 좁은 술어 잔여 `grep '#2 완료 필요/g'` **0줄** 재확인 · props 4변이 각 red |
| §10 분모는 불변, 래퍼 홉의 새 행 필요 여부는 검증자 판단에 남긴다 | **타당** | 신설 불필요로 판정했다(§5 분모 절) — VP-08 path 가 이미 그 홉을 갖는다 |
| I-05 — 0204 의 좁은 부재 술어(`'대기 중<'`·`'중단됨<'`)는 현재 계약 밖 | **타당 · 좌표 실재 확인** | `rightPanelTiles.render.test.ts:173-174`. `NEXT_HANDOFF` 로 이관 |
| **"덮개 회귀 0건"** | **정정한다** | 넓히기만 한 것이 아니라 AT-11·12·AT-14 의 전체 카운트 단언을 **삭제**했다 — X6/X6′ 가 r1 red ↔ r2 green 을 보인다(D6) |
| 주석 "전체 1회"(`:170`) · "목록 전체로도 문구는 한 번뿐"(`:207`) | **산출과 어긋난다** | 두 케이스에 그런 단언이 없다. 전체 카운트는 `AT-13`(`:189`)에만 남았다 — D6 에 함께 적는다 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| **D6** | **덮개 회귀** — AT-11·12·AT-14 에서 전체 카운트 단언이 사라져 **행 밖**으로 새는 막힘 문구를 못 본다. 같은 변이가 r1 장치에는 red 2 다 | 장치 감도 · AC11/12/14 위반 아님(부재 단언은 행 스코프) | **NON_BLOCKING** | 다음 라운드가 행 단언 옆에 `html.match(BLOCKED_ANY)` 총계를 되살리면 닫힌다. 주석 2곳(`:170`·`:207`)도 함께 정정 |
| **D7** | 막힘 문구가 **실제 `blockedBy` 를 반영하는지** 아무 데서도 단언되지 않는다 — `blockedByText(tr, ['2'])` 로 고정해도 전건 green | EP-04 SSOT 는 성립 · 현재 AC 에 id 충실도 조항 없음 | **NON_BLOCKING** | D3 과 같은 계열(문구 *내용* 무단언). 다중 의존 표시가 요구가 되면 AC 를 함께 만든다 |
| **D8** | D-007 의 "안내는 목록 **위에** 선다" 절에 오라클이 없다 — 안내를 목록 아래로 옮겨도 전건 green | ACTIVE Decision D-007 (구현은 **충족**) · AT-15 는 동시 존재만 요구 | **NON_BLOCKING** | 설계자가 순서를 계약으로 올리려면 AT-15 에 순서 단언 한 줄 |
| **D9** | INDEX r2 구현자 비고가 **7문장**이라 `AGENTS.md §산출물 문장 규칙 3`(5줄)을 넘는다 | repository operation | **NON_BLOCKING** | r1 D4 의 재발. 이번 검증 갱신분은 5줄 이내 |
| D3·D5 | r1 이관분 유지 — 구분자 무단언 · shallow clone 좌표 확인 불가 | — | **NON_BLOCKING** | 기록 |
| D4 | r1 비고 9문장 | repository operation | **NON_BLOCKING** | D9 로 재발 — 과거 행은 손대지 않는다 |
| I-05 | 0204 의 그룹 헤더 부재 술어가 같은 좁은 형태 | 현재 계약(AC10/VP-12) 밖 | **NEXT_HANDOFF** | 넓히면 상태 라벨과 충돌해 별도 설계가 필요하다 |

- **`BLOCKING` 0건 · `PLAN_GAP` 0건.** D1·D2 는 인용 변이가 각각 검출되므로 `closed` 를 유지한다.

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상**: 부분적으로 그렇다. 이번 미검출 3건 중 **D6 은 "장치를 바꾸며 구 장치가 잡던 자리를 잃는다"**, D7·D8 은 r1 D3 과 같은 **"문구/배치의 내용에 오라클이 없다"** 계열이다. r1 의 두 축("oracle 이 한 홉 앞에 선다")은 재발하지 않았다.
- **관련 plan 지침/AC 존재 여부**: D6 은 impl 계약(`구 장치가 red 로 만들던 변이를 새 장치도 red 로 만드는지 확인한다`)이 이미 명령하고 있었고, 구현자가 "넓히기만 했으므로 감도는 늘었다" 는 **추론으로 대체**해 실측하지 않았다. D8 은 D-007 본문에 "위에" 가 있으나 AC 로 내려오지 않았다.
- **사용자 결정 변경 근거**: 이번 라운드에 없음.
- **반복된 검증 환경 한계**: ① DOM 환경(`jsdom`·`happy-dom`) 부재 — 메뉴 `.map()` 최종 홉이 0212 P9 → 0213 r1 → r2 로 3연속 미잠금. ② shallow clone 좌표 확인 불가(0212 r2 → 0213 r1 → r2).
- **자기 검증 라운드였다**: 구현·검증이 같은 에이전트다. 보고가 이름을 댄 9변이는 **9/9 재현**됐고, 이번 finding 3건은 **전부 보고에 없던 축**에서 나왔다 — r1 과 같은 형태다.

## 15. 결론

- 상태: **PASS**
- pair 결과: **REQUIRED/REGRESSION 12 전건 PASS · root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.** r1 의 두 root(VP-06·VP-08)가 인용 변이로 닫혔다.
- `PLAN_GAP`: **없다.**
- Product/UX 및 ACTIVE Decision 충족: **충족.** 프로덕션 무변경이라 r1 §1 의 10행 대조가 그대로 서고 좌표를 재확인했다.
- AC 충족: **✅ 21 · ⚠️ 0 · ❌ 0 = 21.** 자기보고·trailer·INDEX 3사본과 일치.
- 현재 변경 운영 gate: **5종 전건 PASS** — typecheck 0 · lint 0 error/1 warning(기존분, 트리 무변경) · vitest 309파일 3001케이스 · scripts 67/67 · doc-inventory 3줄 ok.
- `NON_BLOCKING`: D6(덮개 회귀) · D7(id 충실도 무단언) · D8(안내 순서 무단언) · D9(INDEX 비고 7문장) · D3 · D4 · D5. `NEXT_HANDOFF`: I-05.
- repository operation checks: trailer 7키 파싱 정상 · `[구현자 기입]` r2 7필드 전수 · 검산 줄 일치 · INDEX 좌표 기입 완료. 인용 커밋 실재만 **확인 불가**(D5).
- 남은 사람 확인: 메뉴 `.map()` 최종 렌더 1홉 · I-01 간격 시각 · I-03·I-04 설계 재확인. **archive 이동은 그 셋까지 보류**한다.
- 다음 단계: 사람 몫 3건. D6~D9 는 PASS 를 막지 않으므로 다음 handoff 또는 후속 정리에서 처리한다.
