# Plan — 0321-catalog-detail-selection-hook

## 메타

| 항목 | 값 |
|---|---|
| slug | `0321-catalog-detail-selection-hook` |
| 작성자 | Claude Code |
| 일자 | 2026-11-16 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0320 ΔV3의 VP-26·VP-27은 REGRESSION으로만 참조 |
| 이번 V revision | `ΔV1` — 사용자 요구 추가(성능 동등 이상, D-005), §20 |
| 유효 V | `V1` + `ΔV1` |
| 기준 트리 | 0320 r1.4 구현(`feat/0320-scheduled-tasks`, `main` 미병합) — 좌표는 검증자 기입 |

# Part I — Product & UX Contract

## 1. Context / 목표

- 문제: 상세 패널의 선택 수명 규칙(열기·닫기·탭 전환·삭제 뒤 닫기·초점 복귀)이 `ExtensionsCatalogView` 안에만 있다. `SchedulesScreen`은 셸(`DetailSidePane`)만 공유하고 규칙은 일부만 다시 짰다.
- 그래서 예약 작업 화면은 삭제 뒤 선택·펼침이 남고 초점이 body로 떨어지며, 탭을 바꿔도 선택이 풀리지 않는다.
- 완료 후: 규칙은 `shared/hooks/useCatalogDetail` 한 곳에 있고 두 화면이 그것을 쓴다.
- 한 문장: 두 카탈로그의 상세 패널이 같은 hook으로 같은 수명 규칙을 따른다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "선택 수명 규칙을 공용 hook으로 올리는 핸드오프 만들어줘. 단 간결하고 먕확하게. 코드비대화 금지. 모듈화/재사용성. 어설픈 프레임워크/자동화 금지" | 이번 세션 턴 3 |
| 명시 요구(선행) | "플러그인 페이지의 스킬 탭 -> 항목 참조"(0320 D-015) · 목록 규칙은 "`ExtensionsCatalogView`와 같은 규칙"(0320 §22) | 0320 plan |
| 추론 의도 | "선택 수명 규칙" = 직전 검토의 벗어난 부분 1~3(삭제 뒤 닫기 · 탭 전환 해제 · 초점 복귀 경합·대안). 사용자가 그 답의 용어를 그대로 썼다 | 이번 세션 턴 1~2 |
| 추론 의도 | "어설픈 프레임워크/자동화 금지" = 옵션 객체·reducer·상태 머신·사용 강제용 스캔 테스트·lint 규칙을 만들지 않는다 | 턴 3 |
| 명시 요구 | "성능은 현재와 비교해 최소 등등 이상이어야 한다." | 이번 세션 턴 4 |
| 추론 의도 | "성능" = 상세 패널 상호작용이 만드는 런타임 작업량(렌더·예약 프레임·DOM 조회·마운트 작업). 코드 크기는 턴 3의 "코드비대화 금지"가 따로 맡는다(AC7) | 턴 3·4 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 선택 수명 규칙을 공용 hook 하나로 올리고 `ExtensionsCatalogView`·`SchedulesScreen`이 함께 쓴다 | "간결하고 먕확하게. 코드비대화 금지. 모듈화/재사용성" | 턴 3 | ACTIVE | — |
| D-002 | hook은 옵션 인자 없는 함수 하나다. 사용 강제용 스캔 테스트·lint 규칙·codegen을 만들지 않는다 | "어설픈 프레임워크/자동화 금지" | 턴 3 | ACTIVE | — |
| D-003 | 규칙의 정본은 스킬 탭의 현재 동작이다. 예약 작업 화면이 그에 맞춰진다 | 0320 D-015 · §22 | 0320 | ACTIVE(상속) | — |
| D-004 | 범위는 검토 1~3이다. 4(본문 여백·명령 상자 스타일)·5(`Meta` 복제)는 선택 수명이 아니라 제외한다 | 검토 "벗어난 부분" 표 | 턴 1~2 | ACTIVE | — |
| D-005 | 성능은 현재 이상 — 상호작용마다 런타임 작업량이 기준 트리 이하다 | "성능은 현재와 비교해 최소 등등 이상이어야 한다." | 턴 4 | ACTIVE | — |

### 갱신 메모

- V1(턴 3): D-001~D-004.
- ΔV1(턴 4): D-005 추가(보완 — 기존 결정 변경 없음). §20.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001↔AC1~AC6 · D-002↔§11(옵션·effect 없음)·AC7·AC11 · D-003↔AC1~AC4 · D-004↔§6 비범위 · D-005↔AC10·AC11.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 — 결함 1~3은 규칙이 화면 코드에만 있어 옮길 때 빠졌다 | `SchedulesScreen.tsx:84-95`(select·closeDetail) vs `ExtensionsCatalogView.tsx:70-89`(closeDetail·removeDetail) |
| 이미 충족되는가 | 아니오 — `shared/`에 선택 상태 hook이 없다 | `rg -l -e originRef -e selectionEpoch app/src/renderer/src/shared` → 0 |
| 더 작은 해법 | 예약 작업에 세 규칙을 또 복사하면 셋째 소비처에서 다시 갈라진다. hook은 두 화면의 사본을 지워 hook 크기를 상쇄한다(§14 실측 순증 +7) | §14 |
| 선행 자료 대조 | 검토의 "스킬 탭은 삭제가 끝나면 닫고, 탭을 바꾸면 비우고, 연 행이 사라지면 선택된 탭으로 초점"을 코드로 재확인 | `ExtensionsCatalogView.tsx:70-89·111-117` · `catalogSelection.ts:24-27` |
| 기존 결정 충돌 | 없음 — 0320 AC32(같은 행 재클릭·닫기·Esc로 닫힘)는 화면에 남는다 | 0320 §22 |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: 스킬 탭에는 검색이 없어 "검색어 변경" 규칙이 없다 → 옮길 규칙이 없어 비범위(§6). 아티팩트 카탈로그는 선택을 chat 뷰어 store가 가진다(`app/hooks/useArtifactCatalogViewer.tsx:18-30`) → 비범위.

## 5. 동작 / 사용자 흐름

```text
행 클릭 → 패널 열림(펼침 접힘 · 연 행 기억)
  → 닫기·Esc·같은 행 → 패널 닫힘 → 다음 프레임 초점: 연 행 (사라졌으면 목록의 선택된 탭)
  → 탭 클릭        → 패널 닫힘 · 초점은 누른 탭
  → 삭제 확인      → 삭제 완료 → 그 항목이 아직 열려 있으면 닫힘 + 초점 복귀
  ↘ 확인 전·취소·실패 → 패널 유지
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 열림 + 닫기/Esc/같은 행 | `close` | 패널 없음 · 다음 프레임 초점 = 연 행(연결됨) 또는 선택된 탭 |
| 열림 + 탭 클릭 | `reset` | 패널 없음 · 초점은 누른 탭 그대로 |
| 열림 + 다른 행 | `open` | 그 항목 패널 · 펼침 접힘 |
| 열림 + 그 항목 삭제 완료 | `closeIf(id)` | `close`와 같다 |
| 열림 + 다른 항목 삭제 완료 / 닫은 뒤 완료 | `closeIf(id)` | 변화 없음 |
| 열림(MCP) + 이름 변경 저장 | `rename` | 새 id로 열린 채 · 펼침 유지 |
| 닫은 직후 같은 프레임에 열기·탭 | `open`/`reset` | 대기 중 초점 복귀 취소 |

### 파생 UX / 엣지케이스

- 행 메뉴 `지금 실행`은 그 작업 패널을 연다(현재 동작 유지).
- 새 작업 생성 뒤 탭 `전체` 복귀는 선택을 건드리지 않는다 — 사용자 탭 클릭이 아니다(현재 동작 유지).
- 키보드: 초점 복귀가 위 표대로다. 실제 창의 초점 링은 AC9.

## 6. 범위 / 비범위

- **범위**: hook 신설 · 두 화면 배선 교체 · 예약 작업 삭제 완료 신호(`onDeleted`) · `catalogSelection.ts`의 선택 reducer 제거 · 문서 2곳 한 줄.
- **비범위**: 검색어 변경 시 선택(스킬 탭에 규칙 없음 — 패널 유지 그대로) · 아티팩트 카탈로그(선택 소유가 chat store) · 검토 4·5 · 패널 폭 상태(규칙 없음, 화면 소유 유지) · `DetailSidePane` 셸.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 검색어 변경 시 선택 해제 | 아니오 — 화면 한 줄(`reset`)로 더할 수 있다 | 사용자 요청 시 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 예약 작업: 열린 작업을 행 메뉴나 패널 메뉴에서 지우고 확인하면, 삭제가 끝난 뒤 패널이 닫히고 다음 프레임에 초점이 목록의 선택된 탭으로 간다. 확인 전·실패면 열린 채다. 다른 작업을 지우면 열린 패널은 그대로다 | ST(EP-3) · IT(S5·S6) · UT(D2 실패) | 메뉴 `삭제` → `SchedulesScreen` → `SchedulesView` → `confirmTaskDeletion` → `schedulesActions.remove` → `onDeleted` → `closeIf` |
| R-01 | AT-02 / AC2 | 예약 작업: 탭을 누르면 열린 패널이 닫히고 펼침이 풀린다. 초점은 누른 탭에 남는다 | IT(S4) | `CatalogTabs.onChange` → `reset` |
| R-01 | AT-03 / AC3 | 예약 작업: 닫기·Esc·같은 행으로 닫으면 다음 프레임에 연 행 버튼에 초점이 간다. 펼친 채 닫고 다시 열면 접혀 있다. 행 메뉴 `지금 실행`은 그 작업 패널을 연다 | IT(S1~S3·S7) | 행·패널 → `open`·`close` |
| R-02 | AT-04 / AC4 | 플러그인 카탈로그: 열기(접힌 채) · 닫기(연 행 초점) · 탭 전환(선택 해제, 초점은 탭, 돌아와도 닫힘) · 스킬·MCP 삭제(닫힘, 초점은 선택된 탭) · MCP 이름 변경 저장(새 id로 열린 채, 펼침 유지)이 지금과 같다 | IT(E0~E8) | `CustomizeList`·`CustomizeTabs`·`SkillDetail`·`McpDetail`·`AddMcpServerModal` → hook |
| (MD-01) | UT-01 / AC5 | hook이 §10 EP-0 규칙 표(B1~B9)대로 동작한다 | UT | `useCatalogDetail` |
| (AR-03) | IT-03 / AC6 | 두 화면은 선택 수명을 `useCatalogDetail`에서만 가져온다 — 화면에 rAF 초점 복귀·epoch·origin ref 사본이 없고 `catalogSelection.ts`에 선택 reducer가 없다 | gate G1~G3 + AC1~AC4 행동 | — |
| (AR-03) | IT-03 / AC7 | prod 순증 ≤ +10줄 — `app/src` 테스트 제외, 새 hook 포함. hook을 지운 사본이 상쇄하고 남는 몫은 예약 작업에 없던 규칙 배선이다(§14 실측 +7, ΔV1에서 ≤ +8 → ≤ +10) | gate G4 | — |
| (AR-03) | IT-03 / AC8 | `rendering.md` 카탈로그 문단과 `design-components.md` `DetailSidePane` 행이 hook을 가리킨다 | gate G5 | — |
| R-03 | AT-05 / AC9 | 실제 창(white/dark)에서 두 화면의 닫기 뒤·삭제 뒤 초점 링 위치가 AC1·AC3·AC4와 같다 | 사람 실기 | `npm run dev` |

### AC 검증 주의사항

- 기존 테스트 재사용: `schedulesScreen.detail.test.ts` 4케이스(0320 VP-26) · `ExtensionsCatalogView.interaction.test.ts:'opens the selected skill in the shared detail side pane with its tab and item markers'`(VP-27) — 둘 다 존재 확인.
- `providerAuthWiring.render.test.ts:17-21`은 `useState` 값 모양(`tab`+`selectedId` 객체)을 보고 선택을 주입한다 → hook 모듈 mock으로 바꾸고 단언은 그대로 둔다.
- 사람 실기는 실제 Electron의 focus 적용만이다(`renderHarness.testfixture.ts:6` — 첫 커밋 숨김 중 focus 무시). 규칙 로직은 UT/IT다.
- 0건 기준(AC6): 음성 G1·G2는 사본이 없음만 잠근다 → 양성 G3과 AC1~AC4 행동으로 짝짓는다.

## 7-A. V / Trace Matrix

- V mode 판정: 명시적으로 상속할 V가 없다 → Baseline V.
- 기준 V 상속 근거: 없음. 0320 노드는 INHERITED REGRESSION으로만 둔다(`0320:ΔV3@(검증자 기입)`).
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1~AC3 — 예약 작업 선택 수명 | NEW | — |
| R-02 | R | §7 AC4 — 플러그인 카탈로그 동작 유지 | NEW | 현재 `ExtensionsCatalogView.tsx` |
| R-03 | R | §7 AC9 — 실기 | NEW | — |
| SD-01 | SD | §5 삭제 흐름 · §10 EP-3 | NEW | — |
| AR-01 | AR | §9 플러그인 카탈로그 → hook 배선 · §10 EP-1 | NEW | — |
| AR-02 | AR | §9 예약 작업 → hook 배선 · §10 EP-2 | NEW | — |
| AR-03 | AR | §10 EP-4 — 단일 출처·감량·문서 | NEW | — |
| MD-01 | MD | §10 EP-0 — hook 규칙 | NEW | — |
| R-0320-09 | R | 0320 §22 AC32 — 행 클릭 패널·같은 행/닫기로 닫힘 | INHERITED | 0320:ΔV3 VP-26 |
| R-0320-27 | R | 0320 §22 AC33 — 스킬 탭 패널 셸 | INHERITED | 0320:ΔV3 VP-27 |
| AR-D15 | AR | `ExtensionsCatalogView → ProviderDetail` 인증 callback 결속 | INHERITED | `providerAuthWiring.render.test.ts` describe `(D15)` |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01~03 | REQUIRED | 행·메뉴·탭·닫기 → `SchedulesScreen` → `useCatalogDetail` → `DetailSidePane`·초점 | EP-2·EP-3 좌표와 같다 | not selected — 하네스 렌더가 사용자 입력·초점을 직접 관측 | EP-2(9) · EP-3(3) |
| VP-02 | R-02 ↔ AT-04 | REQUIRED | 행·탭·삭제·저장 → `ExtensionsCatalogView` → `useCatalogDetail` → `ExtensionDetailPane`·초점 | EP-1 좌표와 같다 | not selected — 같은 이유 | EP-1(9) |
| VP-03 | R-03 ↔ AT-05 | REQUIRED | `npm run dev` → 두 화면 | 사람 실기 | not selected | 0 — 시각만 |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | 패널 메뉴 `삭제` → `SchedulesScreen` S6 → `SchedulesView` D1 → `confirmTaskDeletion` → 확인 → `remove` → D2 `onDeleted` → `closeIf` → 초점 | 신규 describe `SchedulesView — 삭제 뒤 패널`(`schedulesScreen.detail.test.ts`) · D2 → `taskActions.test.ts` | required — X4(D2 순서) | EP-3(3) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | 위 VP-02 | `ExtensionsCatalogView.interaction.test.ts` 신규 4케이스(§11) | required — X2(`close ↔ reset` 맞바꿈, E2·E3) | EP-1(9) |
| VP-06 | AR-02 ↔ IT-02 | REQUIRED | 위 VP-01 | `schedulesScreen.detail.test.ts` 신규 3케이스 + 기존 4케이스(§11) | required — X2(S3·S4) | EP-2(9) |
| VP-07 | AR-03 ↔ IT-03 | REQUIRED | 소스 트리 | `gate:G1~G5` | required — X1(G1·G3 민감도) | EP-4(5) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | `useCatalogDetail` 함수들 | 신규 `shared/hooks/useCatalogDetail.test.ts` B1~B9 | required — X3(B9 현재성) · X5(B3 선택자) | EP-0(9 분기) |
| VP-09 | R-0320-09 ↔ AT | REGRESSION | 0320 VP-26 | `schedulesScreen.detail.test.ts` 기존 4케이스 | not selected | EP-2 S1·S3·S8 공유 |
| VP-10 | R-0320-27 ↔ AT | REGRESSION | 0320 VP-27 | `ExtensionsCatalogView.interaction.test.ts:'opens the selected skill in the shared detail side pane…'` | not selected | EP-1 E1·E2·E8 공유 |
| VP-11 | AR-D15 ↔ IT | REGRESSION | `ExtensionsCatalogView` → `ProviderDetail` props | `providerAuthWiring.render.test.ts:'binds login/reauth/revoke to the selected provider id…'`(hook mock으로 주입) | not selected | EP-1 E8 공유 |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 로컬 게이트 | `app/src/**`·테스트 변경 | `app/AGENTS.md:157` 목록 전부(§19) | 이번 변경이 유발한 실패만 blocking |
| commit trailer | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 누락 = blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 스킬 탭 규칙 정본: 열기(epoch++·origin·clearStep·접기) · 닫기(epoch++·접기·비우기·rAF에서 origin 또는 선택된 탭) · 삭제(`await` 뒤 epoch 같으면 닫기) · 탭(epoch++·접기·`selectTab`) | `ExtensionsCatalogView.tsx:70-89·111-117·167-173` |
| 예약 작업 사본: 열기는 접지 않고 취소도 없다 · 닫기에 대안 초점·취소가 없다 · 삭제는 완료 신호가 없다 · 탭은 선택을 두고 바꾼다 | `SchedulesScreen.tsx:60-95·149·197·226` |
| 이름 변경 재키잉: MCP id = 서버 이름이라 저장 뒤 선택을 새 id로 옮긴다 | `ExtensionsCatalogView.tsx:278-286` |
| 삭제 확인은 콜백형이다(`onConfirm`) — 완료 시점을 화면이 모른다 | `taskActions.ts:20-35` · `confirmDialogStore.ts:7-16` |
| `remove`는 목록을 다시 읽은 뒤 resolve한다 | `schedulesStore.ts:59-62` · `useCustomizeSkills.ts:68-70` · `useMcpServers.ts:80-86` |
| 같은 모양 선례: `useCatalogSearch` — `close` = 초점 복귀, `reset` = 초점 유지 | `shared/hooks/useCatalogSearch.ts:21-28` |
| 하네스 선택자는 `[name="value"]`만 지원 — 인용 없는 `[role=tab]`은 throw. 그래서 스킬 탭의 현재 대안 초점 줄(`[role=tab][aria-selected=true]`)은 어떤 테스트도 실행하지 못했다(설계 턴 실측: `Error: unsupported selector`) | `renderHarness.testfixture.ts:153-158` · `ExtensionsCatalogView.tsx:81` |
| 하네스는 `window.requestAnimationFrame`·`cancelAnimationFrame`만 stub | `renderHarness.testfixture.ts:704-707` |
| lint: `eslint-plugin-react-hooks ^7` recommended — render 중 ref 접근·effect 안 setState 금지 | `app/package.json:77` · `eslint.config.mjs:30` |
| 레이어: `shared/hooks/`는 도메인 무관 hook 자리, features → shared만 | `docs/arch/frontend/layers.md:122` · `app/src/renderer/AGENTS.md` 4-layer |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 스킬 탭 규칙 사본 | `grep -c` `selectionEpoch`·`originRef`·`requestAnimationFrame`·`removeDetail` in `ExtensionsCatalogView.tsx` | 8·3·1·3 | hook으로 옮길 원문 |
| 예약 작업 규칙 사본 | 같은 식 in `SchedulesScreen.tsx` | 0·3·1·0 | 부분 사본 |
| `DetailSidePane` 소비처 | `rg -l "DetailSidePane" app/src/renderer/src --glob '!*.test.ts'` | 3(셸·`ExtensionDetailPane`·`SchedulesScreen`) | hook 소비 화면 = 2 |
| 다른 `data-side-pane-host` 화면 | `rg -l "data-side-pane-host" app/src/renderer/src/features --glob '!*.test.ts'` | 4(두 화면 · `ArtifactsView` · `ChatTile`) | `ArtifactsView`는 선택이 `useArtifactViewerStore`, `ChatTile`은 채팅 타일 — 비범위 |
| 선택 reducer 소비처 | `rg -l -e selectTab -e openDetail -e INITIAL_CATALOG_SELECTION -e 'CatalogSelection\b' app/src/renderer/src` | 3(`catalogSelection.ts`·`.test.ts`·`ExtensionsCatalogView.tsx`) | 제거 가능 |
| 삭제 경로 | `rg -n -e 'schedulesActions\.remove' -e 'skills\.remove' -e 'mcp\.remove' app/src/renderer/src --glob '!*.test.ts'` | 4 = IPC 래퍼 `ipc.ts:197` + UI 3(`taskActions.ts:26` · `ExtensionsCatalogView.tsx:216·225`) | 선언 경계 근거 |
| 선택 상태 모양 의존 테스트 | `providerAuthWiring.render.test.ts:17-21` | 1 | hook mock으로 교체 |

### 수치 / 전칭 표현 검산

- "스킬 탭에는 검색이 없다": `rg -n "CatalogSearch" ExtensionsCatalogView.tsx` → 0.
- 문서 앵커: `rendering.md:231`(카탈로그 문단) · `design-components.md:76`(`DetailSidePane` 행) 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
ExtensionsCatalogView: useState<CatalogSelection>{tab, selectedId} · expanded · originRef · selectionEpoch
  onSelect → epoch++ · origin · clearStep · 접기 · openDetail
  closeDetail → epoch++ · clearStep · 접기 · back · rAF(epoch 같으면) → origin | 선택된 탭
  removeDetail(remove) → await → epoch 같으면 closeDetail
SchedulesScreen: selectedId · expanded · originRef
  select → origin = activeElement · setSelectedId            (접기·취소 없음)
  closeDetail → 접기 · null · rAF → origin                    (대안·취소 없음)
  onDelete(task) → confirmTaskDeletion                       (완료 신호 없음)
  탭 → setTab                                                 (선택 유지)
```

### TO-BE

```text
shared/hooks/useCatalogDetail(listRef)
  → { selectedId, expanded, setExpanded, open, close, reset, closeIf, rename }
ExtensionsCatalogView: useState<CatalogTab> + hook — clearStep·메뉴 닫기만 화면에 남아 hook 호출을 감싼다
SchedulesScreen: hook — 삭제는 onDelete(task, () => closeIf(task.id)) · 탭은 reset
SchedulesView → confirmTaskDeletion(task, tr, onDeleted) → remove(id).then(onDeleted, reportTaskFailure)
catalogSelection.ts: CatalogTab · CATALOG_TABS · INITIAL_CATALOG_TAB만
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | V 연결 |
|---|---|---|---|
| 책임 | 규칙이 두 화면에 따로(하나는 부분 사본) | hook 하나 · 화면은 이벤트를 hook에 넘김 | AR-03 / VP-07 |
| 취소 | epoch 카운터(스킬 탭만) | 대기 프레임을 `cancelAnimationFrame` | MD-01 B5 |
| 삭제 판정 | epoch 같으면 닫기(스킬 탭만) | `closeIf(id)` — 그 항목이 아직 선택이면 닫기 | MD-01 B7·B9 / SD-01 |
| 상태 모양 | `{tab, selectedId}` 한 객체(스킬 탭) | 탭은 화면, 선택은 hook | AR-01 E8 / VP-11 |
| 삭제 신호 | 예약 작업 없음 | `onDeleted` 콜백 1개 | SD-01 D1·D2 |
| 사라지는 것 | `selectTab`·`openDetail`·`back`·`CatalogSelection`·`INITIAL_CATALOG_SELECTION`·`removeDetail`·`selectionEpoch`·두 화면의 `originRef` | 삭제(hook으로 이동) | G1·G2 |

### 핵심 책임 분리

| 모듈 | 책임 | 누가 호출 |
|---|---|---|
| `shared/hooks/useCatalogDetail.ts` | 선택 id · 펼침 · 연 자리 · 대기 초점 프레임 | 두 화면 |
| `ExtensionsCatalogView` | 탭 상태 · `providers.clearStep()` · 추가 메뉴 닫기 · 삭제·저장 완료 뒤 hook 호출 | 라우트 |
| `SchedulesScreen` | 탭·검색 상태 · 같은 행 재클릭 = 닫기 · 삭제 완료 콜백을 hook에 연결 | `SchedulesView` |
| `confirmTaskDeletion` | 확인 → 삭제 → 성공 뒤에만 `onDeleted` | `SchedulesView` |

## 10. 계약 / 타입 / 강제 지점

hook 계약(SSOT `app/src/renderer/src/shared/hooks/useCatalogDetail.ts`):

```ts
export interface CatalogDetailControls {
  selectedId: string | null
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  open: (id: string, origin?: HTMLElement | null) => void // origin 생략 = 지금 초점 요소
  close: () => void                          // 닫기·Esc·같은 행 — 초점 복귀
  reset: () => void                          // 탭 전환 — 초점 유지
  closeIf: (id: string) => void              // 삭제 완료 — 그 항목이 아직 선택일 때만 close
  rename: (from: string, to: string) => void // id가 바뀐 항목을 계속 연다
}
export function useCatalogDetail(listRef: RefObject<HTMLElement | null>): CatalogDetailControls
```

### EP-0 — hook 규칙 (MD-01 / VP-08) · 규칙 칸 ↔ UT 입력 칸 1:1

| B | 규칙 | UT 입력 → 관측 |
|---|---|---|
| B1 | `open(id, origin)` → `selectedId=id` · `expanded=false` | `setExpanded(true)` 뒤 `open('b', btnB)` → `'b'` · `false` |
| B2 | `close()` → `selectedId=null` · `expanded=false` · 다음 프레임에 연 자리로 초점(연결돼 있을 때) · 이때 목록을 조회하지 않는다. `origin`을 생략한 `open`은 그 순간 초점 요소가 연 자리다 | `btnA`에 초점 → `open('a')`(생략) → 다른 버튼 초점 → `close()` → 프레임 전 그대로 · 프레임 뒤 `btnA` · `querySelectorAll`·`closest` 0회 |
| B3 | 연 자리가 끊겼거나 `null`일 때만 `listRef` 안의 `[role="tab"][aria-selected="true"]`를 찾는다 | 탭 2개(하나만 선택) · `btnA` 제거 뒤 `close()` → 선택된 탭(선택 안 된 탭 아님) |
| B4 | 둘 다 없으면 초점 이동 없음 · 예외 없음 | 탭 없는 목록 · 연 자리 제거 → `close()` → 초점 그대로 |
| B5 | `open`·`reset`은 대기 중 초점 복귀를 취소한다 | `close()` 직후 같은 프레임 `open('b', btnB)` → 프레임 뒤 초점 ≠ `btnA` · `close()` 직후 `reset()` → 초점 그대로 |
| B6 | `reset()` → `selectedId=null` · `expanded=false` · 초점 이동 없음 | `open` → `setExpanded(true)` → 탭 초점 → `reset()` → 프레임 뒤 초점 = 탭 |
| B7 | `closeIf(id)` → `id`가 현재 선택이면 `close()`, 아니면 무시 | `open('a')` → `closeIf('b')` 그대로 · `closeIf('a')` 닫힘+복귀 · 닫힌 뒤 `closeIf('a')` 초점 이동 없음 |
| B8 | `rename(from, to)` → `from`이 현재 선택이면 `selectedId=to`, 펼침·연 자리 유지 · 아니면 무시 | `open('a', btnA)` → `setExpanded(true)` → `rename('a','z')` → `'z'`·`true` · `rename('x','y')` 그대로 · 이어 `close()` → `btnA` |
| B9 | 옛 렌더의 함수를 나중에 불러도 현재 선택으로 판정한다 | `open('a')` 렌더의 `closeIf`를 잡아 두고 `open('b')` 뒤 그것으로 `closeIf('a')` → `'b'` 그대로 |

검색: `rg -n -e Frame -e isConnected -e aria-selected -e '\.current' app/src/renderer/src/shared/hooks/useCatalogDetail.ts` — 자리 = 각 분기를 구현한 줄.

### EP-1 — 플러그인 카탈로그 배선 (AR-01 / VP-05·VP-02) · 9자리

| 자리 | 계약 | 직접 oracle(`ExtensionsCatalogView.interaction.test.ts`) |
|---|---|---|
| E0 | `useCatalogDetail(listRef)` — 대안 초점 컨테이너 | 스킬 삭제 → 선택된 탭 초점 |
| E1 | `CustomizeList.onSelect` → `clearStep()` · `open(id, origin)` | 수명 순서 케이스: 펼친 채 닫고 다시 열면 접힘 |
| E2 | `closeDetail` → `clearStep()` · `close()` (pane `onClose`) | 닫기 → 연 행 버튼 초점 · 같은 탭 유지 |
| E3 | `CustomizeTabs.onSelect` → `clearStep()` · 메뉴 닫기 · `reset()` · `setTab` | 탭 전환 → 패널 없음 · 초점 = 누른 탭 · 원래 탭으로 와도 닫힘 |
| E4 | `SkillDetail.onRemove` → `skills.remove` 뒤 `closeIf(스킬 키)` | 스킬 삭제 → 닫힘 |
| E5 | `McpDetail.onRemove` → `mcp.remove` 뒤 `closeIf(server.id)` | MCP 삭제 → 닫힘 |
| E6 | `AddMcpServerModal.onSave` → 이름이 바뀌면 `rename(옛 id, 새 이름)` | 이름 변경 → 새 id 패널 · 펼침 유지 |
| E7 | pane `expanded`·`onExpandedChange` · 목록 `inert` ← `expanded`·`setExpanded` | 펼침 → 목록 `inert` |
| E8 | 선택 조회 — `selectedSkill`·`selectedMcp`·`selectedProvider`·pane 표시 조건·`key`·`itemId`·목록 `selectedId`(행 강조) ← `tab`·`selectedId` | VP-10(스킬) · MCP 케이스 · VP-11(provider) · 수명 순서 케이스의 연 행 `aria-pressed` |

검색: `rg -n -e 'selection\.' -e 'useCatalogDetail\(' -e 'setTab\(' app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx` — 출력 줄마다 E0~E8 중 하나, 차집합 0(프로토타입에서 18줄 → 9자리).

### EP-2 — 예약 작업 배선 (AR-02 / VP-06·VP-01) · 9자리

| 자리 | 계약 | 직접 oracle(`schedulesScreen.detail.test.ts`) |
|---|---|---|
| S0 | `useCatalogDetail(listRef)` · 목록 div `ref={listRef}` | 삭제 → 선택된 탭 초점 |
| S1 | 행 `onSelect` → 같은 행이면 `close()`, 아니면 `open(id)`(연 자리 = 지금 초점) | 기존 '다른 행을 누르면…같은 행을 다시 누르면 닫힌다' + 초점 단언 |
| S2 | 행 `onRunNow` → `open(id)` · `onRunNow(id)` | 행 메뉴 `지금 실행` → 그 패널 · 호출 1 |
| S3 | pane `onClose` → `close` | 기존 '닫기 버튼으로 닫힌다' + 초점 단언 · Esc |
| S4 | `CatalogTabs.onChange` → `reset()` · `setTab` | 탭 전환 → 패널 없음 · 초점 = 탭 |
| S5 | 행 `onDelete` → `onDelete(task, () => closeIf(task.id))` | 행 삭제 콜백 → 닫힘 · 다른 작업 콜백 → 유지 |
| S6 | 패널 `onDelete` → `onDelete(selected, () => closeIf(selected.id))` | 패널 삭제 콜백 → 닫힘 · VP-04 |
| S7 | pane `expanded`·`onExpandedChange` · 목록 `inert` | 펼침 → `inert` · 다시 열면 접힘 |
| S8 | 선택 조회 — `selected`·행 `selected` ← `selectedId` | 기존 '행을 누르면…'(`aria-pressed`) |

검색: `rg -n -e 'selection\.' -e 'useCatalogDetail\(' -e listRef app/src/renderer/src/features/schedules/components/SchedulesScreen.tsx` — 출력 줄마다 S0~S8 중 하나, 차집합 0(프로토타입에서 14줄 → 9자리). 자리마다 hook을 직접 부른다 — 도우미 함수로 감싸면 호출부가 검색에서 빠진다.

### EP-3 — 예약 작업 삭제 수명 (SD-01 / VP-04) · 3자리

| 자리 | 계약 | 직접 oracle |
|---|---|---|
| D1 | `SchedulesScreenProps.onDelete: (task, onDeleted: () => void) => void` → `SchedulesView`가 `confirmTaskDeletion(task, tr, onDeleted)`로 넘긴다 | ST: `SchedulesView` 렌더 → 패널 메뉴 `삭제` → 잡은 요청 `onConfirm()` → 패널 없음 · 초점 = 선택된 탭 |
| D2 | `onConfirm` → `deps.remove(id).then(onDeleted, reportTaskFailure)` — 성공 뒤에만 | `taskActions.test.ts`: 확인 전 0회 · remove resolve 뒤 1회 · reject면 0회 |
| D3 | 확인 전에는 아무것도 닫지 않는다 | ST: 메뉴 `삭제` 클릭 뒤(확인 전) 패널 유지 |

검색: `rg -n "onDeleted" app/src/renderer/src/features/schedules --glob '!*.test.ts'`. ST는 `confirmDialogStore`(요청 포착)·`schedulesStore`(목록·`remove`)만 mock한다 — 다이얼로그 UI는 `ConfirmDialogHost.test.ts` 몫.

### EP-4 — 단일 출처·감량·문서 (AR-03 / VP-07) · 5자리

| 자리 | 판정 | 통과 |
|---|---|---|
| G1 음성 | 두 화면에 rAF 초점 복귀·epoch·origin ref 사본 | 0줄 |
| G2 음성 | `catalogSelection.ts`에 선택 reducer·타입 | 0줄 |
| G3 양성 | `useCatalogDetail(` 정의·호출(테스트 제외) | 3줄(정의 1 · 두 화면) |
| G4 감량 | prod 순증(테스트·testfixture 제외, 새 hook 포함) | ≤ +10 |
| G5 문서 | 두 문서의 hook 언급 | 각 1줄 |
| G6 마운트 작업 | hook의 effect·리스너(ΔV1) | 0줄 |

```bash
# G1~G3: app/src/renderer/src 에서
rg -n -e requestAnimationFrame -e selectionEpoch -e originRef \
  features/skills/components/customize/ExtensionsCatalogView.tsx features/schedules/components/SchedulesScreen.tsx
rg -n -e selectTab -e openDetail -e INITIAL_CATALOG_SELECTION -e 'CatalogSelection\b' -e '\bback\b' \
  features/skills/lib/catalogSelection.ts
rg -n 'useCatalogDetail\(' . --glob '!*.test.ts'
# G4·G5: 저장소 루트에서 — <READY> = 이 plan의 READY 커밋
git diff --numstat <READY> HEAD -- app/src ':(exclude)*.test.ts' ':(exclude)*.testfixture.ts' \
  | awk '{s += $1 - $2} END {print s}'
rg -n useCatalogDetail docs/arch/frontend/rendering.md docs/arch/frontend/design-components.md
# G6: app/src/renderer/src 에서
rg -n -e useEffect -e useLayoutEffect -e addEventListener shared/hooks/useCatalogDetail.ts
```

### 등록 변이

| ID | 자리 | 변이 | 기대 |
|---|---|---|---|
| X1 | G1·G3 | `SchedulesScreen`에 `window.requestAnimationFrame(() => undefined)` 한 줄 · 한 화면의 hook 호출을 지역 `useState`로 되돌림 | G1 = 1 · G3 = 2 |
| X2 | E2·E3·S3·S4 | `close ↔ reset` 맞바꿈(자리마다) | 해당 IT 초점 단언 red |
| X3 | B9 | `closeIf`가 ref 대신 렌더 시점 `selectedId`로 판정 | B9 red |
| X4 | D2 | `onDeleted`를 `remove` 전에 부름 · 실패에도 부름 | D2 UT red |
| X5 | B3 | 대안 선택자 `aria-selected="true"` → `"false"` | B3 red |

- 선언 경계: 검색어로 숨은 작업의 패널이 열린 채인 것(§6 비범위) · 실제 Electron의 focus 무시(AC9) · `onDeleted` 없이 항목이 사라지는 경로 — 현재 삭제 경로는 위 전수 조사 3곳뿐이다.
- 열린 입력 집합 판정: 해당 없음.
- 같은 규칙의 SSOT: hook 파일 하나. 화면은 규칙을 다시 쓰지 않는다(G1).
- 선택적 필드 의미: `open`의 `origin` — 생략(`undefined`) = 그 순간 `document.activeElement`(B2) · `null` = 연 자리 없음, 닫을 때 대안(B3)으로.

## 11. 구현 설계

| 변경/신규 파일 | 변경 내용 | 테스트 |
|---|---|---|
| `shared/hooks/useCatalogDetail.ts` (신규) | §10 계약. `useState` 2(선택·펼침) + `useRef` 3(현재 선택·연 자리·대기 프레임). ref는 콜백 안에서만 읽고 쓴다. `useEffect`·`useCallback`·옵션 인자 없음. 대안 탭은 연 자리가 끊겼을 때만 조회한다(ΔV1). 언마운트 뒤 남은 프레임은 `isConnected`·`listRef.current`가 비어 무해하다 | `shared/hooks/useCatalogDetail.test.ts` B1~B9 — `useReducedMotion.test.ts`처럼 Consumer 컴포넌트를 하네스로 렌더 |
| `features/skills/components/customize/ExtensionsCatalogView.tsx` | `selection`(객체) → `tab` 상태 + `selection = useCatalogDetail(listRef)`. E0~E8. `removeDetail`·`selectionEpoch`·`originRef`·`expanded` 상태 삭제. 삭제는 `remove(…).then(() => selection.closeIf(id))`. rename의 `tab === 'mcp'` 검사는 `rename`의 선택 검사로 대체(탭을 바꾸면 선택이 비므로 같은 결과) | `ExtensionsCatalogView.interaction.test.ts` 신규 4: ① 수명 순서(열기→펼침 `inert`→닫기 초점·같은 탭→다시 열면 접힘→탭 전환 해제·초점 탭) ② 스킬 삭제 ③ MCP 삭제 ④ MCP 이름 변경. `skillApi.remove`·`mcpApi.list/delete/update`를 hoisted mock으로 |
| `features/skills/lib/catalogSelection.ts` | `CatalogSelection`·`INITIAL_CATALOG_SELECTION`·`selectTab`·`openDetail`·`back` 삭제, `INITIAL_CATALOG_TAB: CatalogTab = 'providers'` 추가 | `catalogSelection.test.ts`: 탭 순서 케이스 유지 · '첫 진입은 플러그인 탭이다' → `INITIAL_CATALOG_TAB` · reducer 2케이스 삭제(규칙은 B1·B6·E3로 이동) |
| `features/schedules/components/SchedulesScreen.tsx` | `selectedId`·`expanded`·`originRef`·`select`·`closeDetail` 삭제 → hook. S0~S8을 자리마다 hook 직접 호출로(도우미 없음). `onDelete` prop 타입 변경 | `schedulesScreen.detail.test.ts` 신규 3: ① 수명 순서(펼침 `inert`→닫기·Esc 초점→다시 열면 접힘→탭 전환 해제) ② 지금 실행 ③ 삭제 콜백(행·패널·다른 작업) + describe `SchedulesView — 삭제 뒤 패널`(D1·D3) |
| `features/schedules/components/SchedulesView.tsx` | `onDelete={(task, onDeleted) => confirmTaskDeletion(task, tr, onDeleted)}` | ST(위) |
| `features/schedules/lib/taskActions.ts` | `confirmTaskDeletion(task, tr, onDeleted, deps)` · `onConfirm` → `.then(onDeleted, reportTaskFailure)` | `taskActions.test.ts` D2(성공·실패) |
| `features/skills/components/customize/providerAuthWiring.render.test.ts` | `useState` 모양 주입 → `vi.mock('…/shared/hooks/useCatalogDetail')`로 `selectedId` 주입 | VP-11 |
| `docs/arch/frontend/rendering.md:231` | "상세 패널은 `DetailSidePane`(셸)과 `useCatalogDetail`(선택 수명 — 열기·닫기·탭 전환·삭제 뒤 닫기·초점 복귀)을 함께 쓴다." 한 문장 | G5 |
| `docs/arch/frontend/design-components.md:76` | `DetailSidePane` 행 끝에 "선택 수명은 `shared/hooks/useCatalogDetail`." | G5 |

### 테스트 가능성

- 별도 순수 파일: 해당 없음 — hook이 React·DOM만 쓰고 하네스(`renderHarness.testfixture.ts`)가 둘 다 흉내 낸다.
- 하네스 제약: 선택자는 인용형(`[role="tab"]`), 프레임은 `dom.frame()`·`dom.click()`으로 진행(시간 리터럴 없이 — `check-test-budgets`).
- 순서 관측: 초점은 프레임 전·후 `dom.activeElement`로 본다(B2·B5).

## 12. End-to-end 영향

- producer → consumer: 행·탭·메뉴·저장 이벤트 → 화면 → hook 상태 → `DetailSidePane`(`expanded`·`onClose`) · 목록 `inert` · `data-state` · 초점.
- 파생 합성값: `selected`는 화면이 `selectedId`로 목록에서 찾는다 — hook은 항목을 모른다.

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `ExtensionDetailPane`·`DetailSidePane` props | 값 출처만 hook으로 | AC4 · VP-10 |
| `ProviderDetail` 결속 | 선택 id 출처만 hook으로 | VP-11 |
| `CustomizeTabs`·`CustomizeList`의 `CatalogTab` import | 그대로 | typecheck |

## 13. Lifecycle / 오류 / 정리

- 대기 초점 프레임: `open`·`reset`·다음 `close`가 취소한다(B5). 언마운트 뒤 남은 프레임은 대상이 끊겨 아무것도 하지 않는다(B4와 같은 분기).
- 삭제 실패: `reportTaskFailure` 토스트 · `onDeleted` 없음 → 패널 유지(D2).
- 다중 저장소 쓰기: 코드 해당 없음. 산출 문서는 `plan.md` + `INDEX.md` 행 두 곳에 상태가 산다 — 둘을 같은 커밋에서 바꾼다.

## 14. 성능 / 상한 / 최적화

- 구조 목표(AC7 ≤ +10) 지도 — 설계 턴에 scratchpad에서 TO-BE를 시제작해 prettier로 정렬한 뒤 `git diff --no-index --numstat`으로 쟀다(커밋하지 않음): hook +59 · `ExtensionsCatalogView` −29 · `catalogSelection.ts` −17 · `SchedulesScreen` −7 · `taskActions` +1 · `SchedulesView` 0 → Σ +7(ΔV1 지연 조회 반영).
- 같은 시제작에서 EP-1·EP-2 검색 출력은 18줄·14줄이고 줄마다 자리 하나로 갈렸다(차집합 0).
- 런타임 작업량(D-005)은 §20 표 — 상호작용마다 기준 트리 이하. 코드 크기는 AC7이 맡고, 참고로 바뀐 모듈의 minified 합은 11,118 → 11,256 B(+138 B, `esbuild --minify` 파일별)다.
- 요청·출력 상한: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문 문장 | 결과 |
|---|---|---|---|
| 스킬 탭 같은 우측 패널 · "같은 규칙" | 0320 D-015 · §22 | §1 · AC1~AC3 | 유지(이행) |
| 같은 행 재클릭·닫기·Esc로 닫힘 | 0320 AC32 | S1·S3 | 유지 |
| 첫 진입은 플러그인 탭 | `catalogSelection.ts` 0181 주석 · 테스트 | `INITIAL_CATALOG_TAB` | 유지 |
| MCP 이름 변경은 재키잉 | `ExtensionsCatalogView.tsx:278-279` 주석 | E6 · B8 | 유지 |
| `close`=초점 복귀 · `reset`=유지 관례 | `useCatalogSearch.ts` | §10 계약 | 유지 |
| 재사용 우선 · 같은 변경에서 문서 갱신 | `app/src/renderer/AGENTS.md` | §11 문서 2행 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 삭제 완료 판정이 epoch → 선택 id로 바뀐다 | 같은 항목을 닫았다 다시 연 뒤 삭제가 끝나도 이제 닫힌다. 지워진 항목은 어차피 그려지지 않으니 맞는 상태다(B7·B9) |
| 0320 verify와 같은 파일을 만진다 | 0320 verify 대상은 r1.4 커밋이다. 0321 커밋은 그 뒤에 쌓는다(INDEX 비고) |

- 되돌리기 어려운 결정: 없음(내부 hook·prop).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/hooks/useCatalogDetail.ts`(신규) · `useCatalogDetail.test.ts`(신규)
- `app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx` · `ExtensionsCatalogView.interaction.test.ts` · `providerAuthWiring.render.test.ts`
- `app/src/renderer/src/features/skills/lib/catalogSelection.ts` · `catalogSelection.test.ts`
- `app/src/renderer/src/features/schedules/components/SchedulesScreen.tsx` · `SchedulesView.tsx` · `schedulesScreen.detail.test.ts`
- `app/src/renderer/src/features/schedules/lib/taskActions.ts` · `taskActions.test.ts`
- `docs/arch/frontend/rendering.md` · `docs/arch/frontend/design-components.md`

## 19. 게이트

- 적용 가이드: `app/AGENTS.md:157`(테스트를 바꾼 변경의 로컬 확인) · `app/src/renderer/AGENTS.md`.
- 환경: 이 컨테이너에는 `app/node_modules`가 없다 — 구현 턴에서 `npm ci`(electron postinstall 403은 `app/AGENTS.md §ABI 제약 환경`대로 분리 보고).
- 명령(`app/`): `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`.
- EP-4 G1~G6 · EP-5 측정점 19 · 등록 변이 X1~X7 · 열거 sweep.
- 사람 실기: AC9.

## 20. ΔV1 — 성능 동등 이상 (D-005, 사용자 요구 추가)

- 판정: 상호작용마다 런타임 작업량이 기준 트리 이하여야 한다. 설계 턴 시제작은 19 측정점 중 18점이 같거나 적고, 예약 작업 삭제 완료 1점만 새 동작 몫으로 늘어 스킬 탭과 같은 값이 된다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-005↔AC10·AC11. D-003(스킬 탭 규칙)이 삭제 완료의 상한을 정한다.
- 바뀐 노드: R-04·AT-06(NEW) · MD-01(CHANGED — B2·B3 지연 조회) · AR-03(CHANGED — G4 ≤ +10, G6 신설). 나머지 V1 노드는 그대로다.

| R | AC | 동작 기준 | 검증 수단 | 경로 |
|---|---|---|---|---|
| R-04 | AC10 | 두 화면의 상호작용마다 화면 렌더·예약 프레임·DOM 조회가 아래 표의 기준값 이하다. 예약 작업 삭제 완료는 새 동작이라 같은 규칙을 가진 스킬 탭 삭제 완료 값(2·1·1)을 상한으로 쓴다 | IT 작업량 단언(EP-5) · X6 | 입력 → 화면 → `useCatalogDetail` → 렌더·rAF·조회 |
| R-04 | AC11 | hook은 effect·리스너를 만들지 않아 마운트 작업이 늘지 않는다(표 M0 같음) | G6 · EP-5 M0 · X7 | 마운트 |

### EP-5 — 작업량 측정점 (R-04 / VP-12) · 19점 · `렌더·프레임·조회`

| 측정점 | 예약 작업: 기준 → 시제작 | 스킬 탭: 기준 → 시제작 |
|---|---|---|
| M0 마운트 | 1·0·0 → 1·0·0 | 2·0·0 → 2·0·0 |
| 1 행 열기 | 3·0·1 → 3·0·1 | 2·0·1 → 2·0·1 |
| 2 다른 행 | 3·0·1 → 3·0·1 | 2·0·1 → 2·0·1 |
| 3 펼치기 | 1·0·0 → 1·0·0 | 1·0·0 → 1·0·0 |
| 4 닫기(펼친 채) | 1·1·0 → 1·1·0 | 1·1·0 → 1·1·0 |
| 5 같은 행 다시 | 1·1·0 → 1·1·0 (닫힘) | 1·0·0 → 0·0·0 (열린 채) |
| 6 탭 전환(열린 채) | 1·0·0 → 1·0·0 (이제 닫힘) | 1·0·0 → 1·0·0 |
| 7 같은 탭(닫힌 채) | 0·0·0 → 0·0·0 | 1·0·0 → 0·0·0 |
| 8 지금 실행(행 메뉴) | 3·0·1 → 3·0·1 | — |
| 9 삭제 완료 | 1·0·0 → 2·1·1 (새 동작 — 상한 2·1·1) | 2·1·1 → 2·1·1 |

- 측정 창: 대상 노드를 찾은 뒤 시작 → 동작 → 테스트 `flush()` → `dom.frame()` 1회 → 끝. 단언용 조회는 창 밖에서 한다.
- 렌더 = 화면을 감싼 카운터 컴포넌트 실행 수(하네스 렌더 패스) · 프레임 = `window.requestAnimationFrame` 호출 수 · 조회 = `FakeNode.prototype.querySelectorAll`·`closest` 호출 수.
- 삭제 완료 입력: 예약 = 잡아 둔 `onDeleted` 호출 + 그 작업을 뺀 목록으로 다시 렌더 · 스킬 탭 = 확인 모달 `제거` 클릭(`skillApi.remove`가 줄어든 목록을 돌려줌).
- 기준값 출처: V1 READY 트리를 scratchpad worktree에서 같은 창으로 잰 값. 스킬 탭 9번만 대안 선택자 한 줄을 인용 형태로 바꿔 쟀다(하네스 제약 — 실제 Chromium에서는 같은 선택자).
- 단언: 측정점마다 `≤ 기준값`(예약 9번은 `≤ 2·1·1`). 테스트에 표를 두고 출처(0321 기준 트리 실측)를 주석으로 단다. 공용 헬퍼는 만들지 않는다 — 두 IT 파일에 각자 스파이 3개와 카운터 래퍼.

| Pair | left ↔ right | req | 직접 oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|
| VP-12 | R-04 ↔ AT-06(AC10·AC11) | REQUIRED | `schedulesScreen.detail.test.ts` 작업량 단언(M0·1~9) · `ExtensionsCatalogView.interaction.test.ts` 작업량 단언(M0·1~7·9) · G6 | required — X6 · X7 | EP-5(19) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED(CHANGED) | B2 조회 0회 입력 추가 | X6 | EP-0 |
| VP-07 | AR-03 ↔ IT-03 | REQUIRED(CHANGED) | G4 ≤ +10 · G6 | X7 | EP-4(6) |

| ID | 자리 | 변이 | 기대(설계 턴 확인) |
|---|---|---|---|
| X6 | hook `close` | 연 자리를 확인하기 전에 대안 탭을 조회(즉시 조회) | 닫기 조회 0 → 1(예약 4·5, 스킬 탭 4) — 시제작에서 확인 |
| X7 | hook 본문 | `useEffect` 추가(예: 언마운트 때 프레임 취소) | G6 = 1 |

- 선언 경계: 렌더 안 함수 할당 수(hook이 렌더마다 함수 6개를 만든다 — 렌더 수가 같으면 측정 대상 아님) · 실제 React에서 비동기 완료가 같은 커밋으로 묶이는지(하네스는 flush 단위로 센다) · 번들 바이트(AC7이 코드 크기를 맡는다).

## READY self-review

> 관측은 §3 갱신 메모 · §8 · §10 · §16에 있다.

- [x] Decision Ledger가 이번 세션 결정과 0320 상속 결정을 보존한다(D-001~D-004).
- [x] Part I만으로 완료 상태가 보인다(§5 상태표 · §7).
- [x] 조건절 원문 인용 — "간결하고 먕확하게…자동화 금지"를 D-001·D-002에 그대로 두었다.
- [x] 사용자 결정 0 · 조사로 닫은 사실 2(검색 규칙 부재 · 아티팩트 소유).
- [x] 수치·앵커·기존 테스트 실측(§8 전수 조사 · AC 주의사항).
- [x] INDEX `## 새 handoff 후보`에 이번 파일과 겹치는 행 없음.
- [x] 모든 NEW 노드에 같은 레벨 REQUIRED pair · 영향받는 INHERITED 3개는 REGRESSION.
- [x] 각 pair에 path · 자리 검색 명령 · 자리별 oracle · 필요한 pair만 등록 변이.
- [x] EP-0 규칙 칸 B1~B9 ↔ UT 입력 1:1.
- [x] 선언 경계는 측정한 것만(삭제 경로 3곳 · 검색 비범위 · Electron focus).
- [x] 사람 실기로 미룬 순수 로직 없음(AC9는 실제 focus 적용만).
- [x] 음성 게이트 G1·G2는 양성 G3·행동 AC와 짝.
- [x] 게이트 명령이 `app/AGENTS.md:157`과 같다.
- [x] ΔV1: D-005 원문 인용 · NEW/CHANGED 노드마다 REQUIRED pair · 기준값은 실측(19점) · X6 방향을 시제작에서 확인(0 → 1).

---

> **[구현자 기입]** 이하는 구현 턴이 `handoff-impl` 형식으로 채운다.

## [구현자 기입] 설계 리뷰

## [구현자 기입] 강제 지점 전수 (§10 대조)

## [구현자 기입] 이번 라운드 수정의 잠금

## [구현자 기입] Product/UX 파생 검토

## [구현자 기입] 놓친 잠재 문제 + 대응

## [구현자 기입] 구현 보고

## [구현자 기입] Review Signals — 사실만

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
