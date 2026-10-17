# Verify — 0263-opencode-session-panel

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다 — 판정 먼저, 주장 한 줄에 관측 하나.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0263-opencode-session-panel` |
| 검증자 | Claude Code |
| 일자 | 2026-10-16 |
| 대상 커밋/range | `e928b34e..655fa0e0` — V1 `736a85da`·`73681f80` · ΔV3 `14d5fea0`·`48d9651a` · ΔV4 `fbc15aba`·`841dff06` · ΔV5 `a74bbba0`·`52207a59` · ΔV6 `655fa0e0` |
| 구현 전 plan 기준 | V1·ΔV2 `308e2078` · ΔV3 `56acfbfe` · ΔV4 `4b6f433c` · ΔV5 `52976413` · ΔV6 `350281c7` |
| V mode / 유효 V | Baseline V1 + ΔV2~ΔV6 (plan 메타는 ΔV5까지만 표기 — N-0263-2) |
| 검증 HEAD | `655fa0e0` |
| 라운드 | 1 (첫 검증) |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 1 + BLOCKING 1 |
| 자기 검증 여부 | 설계·구현 Codex(사용자 지시) · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity

- 기준선 성립: 예 — 9개 구현 커밋의 plan 삭제 줄은 메타 `상태`·자리표시자·구현 보고 행뿐이다(`git diff <설계> <구현> -- plan.md`). 규범 행 변경 없음.
- supersede 이관: ΔV3이 VP-01 AC1/2/6→VP-09, VP-02→VP-10, VP-04→VP-11을, ΔV4가 VP-13~15를, ΔV5가 VP-17~19를 명시 이관했다. 유효.

| 검사 | 판정 | 근거 |
|---|---|---|
| §10 oracle의 좌표 가능성 | **PLAN_GAP** | ΔV3 "실제 Chromium 조작 분리"·ΔV4 EP-16·ΔV5 "실제 클릭/구독/포커스는 CUA에서 닫는다"가 행동 자리의 유일 oracle을 Computer Use(CUA)로 지정한다. `§공통 V`는 일회성 실측을 좌표로 세지 않는다. 근거로 든 "Node 환경이라 DOM runner 없음"은 사실과 다르다 — click 가능한 fake DOM `shared/ui/renderHarness.testfixture.ts`가 2026-10-12(`280f7043`)부터 있고 ΔV6가 `Panel.interaction.test.ts`에서 실제 click으로 사용한다 (G-0263-1) |
| 시각 자리 분류 | **PLAN_GAP**(같은 root) | EP-20a~e(외곽 radius·border·hover padding)는 시각 품질이라 기계 좌표 대상이 아니다. 사람 시각 인수로 분리 표시되지 않고 기계 자리 분모에 섞여 있다 |
| 운영 gate 범위 | 유효 | ESLint·typecheck·관련 Vitest·renderer build·inventory·원격 CI 열거 |

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | 실제 production path |
|---|---|---|
| D-07~13 | OpenCode 작업 요약·평면 메뉴·조건부 그룹·버튼 제거 | `harnesses/opencode/rightpanel/{Panel,tiles,model}.tsx` · `lib/rightPanelTiles.ts` 정책 |
| D-14 | 요약 위 상세 overlay, 닫기 복귀 | `Panel.tsx` local reducer(`navigation.ts`) → `common/rightpanel/TilePanel` detail slot |
| D-15~19 | 외곽·여백·활성 셸만 요약·작업 전용 메뉴 | `model.ts activeProcesses` · `ChatTitleBar` 메뉴 |
| D6-1 | transcript Task pill → 같은 상위 상세, 타일 추가 없음 | `ToolCard.tsx:64` `openSubagentTask(id, currentTarget)` → `chatReducer.ts:1974` OpenCode=`task` → `Panel.tsx` reveal.detail |
| D6-2 | 상세 폭 = 부모 작업 열 폭, resize 공유 | `Panel.tsx` `parentWidth + 8` · `setRightPanelColWidth(parentColumn, width - 8)` |

## 2. 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 닫은 상세의 재등장 | 없음 | 닫기가 `chatActions.closePanelDetail()`로 store 요청까지 비운다. 제거 변이 M0263-02 red |
| 부모 열 선택 | 미잠금 | `columns.find(tiles.includes('task'))?.col ?? 0`을 `0`으로 고정해도 green(M0263-07) — task가 0열이 아닌 배치가 테스트에 없음(N-0263-1) |
| 요약 진입 배선 | 미잠금 | `tiles.tsx:46` diff 진입을 process로 바꾸거나 무동작으로 해도 chat renderer 2,073케이스 green(M0263-08·09) — CUA 외 oracle 없음(G-0263-1) |
| Claude 경로 | 유지 | `chatReducer.harness.test.ts` Claude subagent 단언 통과 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `.tmp/0263-v3-visual-evidence.md` 등 CUA 기록 | 검증 불가 | plan이 커밋 제외로 지정 — 검증자가 재현·열람할 수 없다 |
| ΔV6 `width - 8`·`+ 8` separator 상수 | 정상 | `Panel.interaction`이 420→500/428→508을 단언 |

## 4. 적대 증거 재측정

등록 적대 증거: V1~ΔV6 모두 없음(직접 oracle). 아래는 독립 축이다.

| 변이 | 결과 | 검출 |
|---|---|---|
| M0263-01 OpenCode Task 열기가 subagent 타일 추가(구 동작) | **red** 6 | `chatReducer.harness`·`chatStore.panelTiles` 4·`Panel.interaction` |
| M0263-02 닫기가 store 요청 미정리 · 03 상세 폭 고정 · 04 resize 미반영 · 06 reveal.detail 무시 | **red** ×4 | `Panel.interaction.test.ts:… opens one overlay with the selected task and parent width, resizes the parent, then closes without adding tiles` |
| M0263-05 Task pill origin 미전달 | **red** 2 | 위 + `ToolCard.interaction.test.ts:… opens the existing subagent detail from the agent pill` |
| M0263-07 부모 열 0 고정 | green | N-0263-1 |
| M0263-08·09 요약 '변경 사항' 진입 맞바꿈·무동작 | green ×2 (2,073케이스) | G-0263-1 |

## 5. V-pair closeout

plan이 인용한 테스트 파일 20개는 HEAD 전체 실행에서 전부 실재·통과한다. 좌표 형식(`파일:테스트명`)은 5건이며 전부 통과.

| Pair | 결과 | 근거 |
|---|---|---|
| VP-05·VP-06 MD↔UT · VP-03 AR-01↔IT-01 | PASS | `opencode/v1/activity.test.ts`·`adapter.test.ts`·`rightpanel/activity.integration.test.ts`·`model.test.ts` |
| VP-07 AR-03↔IT-03 · VP-08 MD-03↔UT-03 | PASS | `chatStore.sessionDirectory`·`session-directory`·`files.contextDirectory`·`agent-session-policy` |
| VP-12 MD-04↔UT-04 · VP-16 MD-05↔UT-05 · VP-20 MD-04↔UT-04 | PASS | `model.test.ts:selects only running processes without removing terminal history` · `rightPanelTiles.harness.test.ts:limits only the OpenCode menu while retaining every supported target` · `navigation.test.ts:opens and closes $id independently of the base tile layout` |
| VP-19 AR-02↔IT-02 | PASS | `ChatTitleBar.render.test.ts` 메뉴 handler→`toggleRightPanelTile` 인수 + `chatStore.panelTiles` store 결과 + `TilePanel.detail`·`panelFocus` |
| VP6-1 R6-1↔AT6-1·AR6-1↔IT6-1 | PASS | `Panel.interaction.test.ts`(실제 click→store→Panel→detail) · `TilePanel.detail.test.ts` · `panelFocus.test.ts` · M0263-01~06 red |
| VP6-2 R6-2↔AT6-2·MD6-2↔UT6-2 | PASS(폭) | 같은 interaction의 420→500·428→508 · M0263-03·04 red. 외곽 여백은 시각 인수, 부모 열 선택은 N-0263-1 |
| VP6-R · VP-01/02/04 잔여 · ΔV2~ΔV5 REGRESSION 행 | PASS | 인용 파일 20개 통과 |
| VP-15 AR-02↔IT-02(ΔV4) | **미닫힘 — G-0263-1** | EP-16a~d 요약 네 진입 click→navigation이 CUA-V4-01뿐. M0263-08·09 green |
| VP-09·VP-13·VP-17 R↔AT | **미닫힘 — G-0263-1** | 위 EP-16 + EP-20a~e 시각 자리가 CUA뿐 |
| VP-10·VP-14·VP-18 SD↔ST | **미닫힘 — G-0263-1** | EP-19c 확대/폭/스크롤 보존·EP-21b/c 실제 store 구독 갱신이 CUA로만 닫힘(T-V5-02는 정적 출력) |

- root PAIR_FAIL: 없음. PLAN_GAP 영향 pair: VP-09·10·13·14·15·17·18.
- 실행 구간: `Panel.interaction`은 fake DOM에서 실제 `OpenCodeToolCard` 클릭→실제 `chatActions`→실제 `OpenCodeRightPanel`·`TilePanel`까지 실행한다(가상화 훅만 대체).

### AT / AC 합계

| 범위 | 결과 |
|---|---|
| ΔV6 AC6-1·AC6-2 | ✅2 |
| V1~ΔV5 AC(데이터·컨텍스트·메뉴 정책·상세 수명) | 위 PASS pair 범위는 ✅, 요약 진입 클릭·시각 외곽·실제 구독 갱신은 G-0263-1로 판정 보류 |

- 자기보고 ΔV6 `AC6-1~2 2/2`, 커밋 `655fa0e0` trailer `Criteria-Met: 9/9`(0262 3 + 0263 2 + 0265 4) — ΔV6 몫은 일치.

## 6. 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| readonly ESLint · typecheck · build · 문서 | PASS | [0003 F-4](../0003-debug-panel-mock-adapter/verify.md) 공통 실행 |
| 관련 Vitest | PASS | 인용 20파일 통과 · chat renderer 2,073케이스 통과 |
| PR CI (Windows) | FAIL — 비귀속 | #773~#779 red는 `adapters/claude/native-history.test.ts`(0265 D-0265-1) 3케이스뿐. 0263 변경 파일 아님. 0263 단독 head였던 #767~#769는 success |

## 7. Repository operation

- INDEX 0263 행: 상태·다음 주체 일치. 대상 커밋을 검증자가 기입한다.
- trailer: 범위 15커밋 파싱·허용값 정상.
- **`[구현자 기입] ΔV6`가 두 문단+표 1개+`운영 gate / Review Signals` 한 절로 접혔다** — `설계 리뷰`·`이번 라운드 수정의 잠금`·`Product/UX 파생 검토`·`놓친 잠재 문제` 필드가 없다(D-0263-1). ΔV3~ΔV5는 7필드 존재.
- plan 메타 `V mode / revision`이 ΔV6를 포함하지 않는다(N-0263-2).

## 8. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G-0263-1 | ΔV3~ΔV5 §10이 행동 자리(요약 진입 click→navigation EP-16a~d, 확대/폭/스크롤 EP-19c, 실제 store 구독 EP-21b/c 등)의 유일 oracle을 CUA로 지정 — 좌표가 아니며 기록도 커밋 제외. 시각 자리 EP-20a~e는 기계 분모에서 분리되지 않음 | §10 oracle / `§공통 V` 좌표 규약 | **PLAN_GAP** | planner: 행동 자리는 fake DOM interaction 좌표로, 시각 자리는 사람 시각 인수로 재지정하는 Delta V |
| D-0263-1 | `[구현자 기입] ΔV6` 필드 접힘 | 재구현 턴 7필드 계약 | **BLOCKING** | 구현: 7필드 재기입 |
| N-0263-1 | 상세 폭의 부모 열 선택이 0열 배치에서만 관측된다(M0263-07 green) | VP6-2 하위 분기 | NON_BLOCKING | task가 다른 열에 있는 케이스 추가 후보 |
| N-0263-2 | plan 메타 V mode에 ΔV6 없음 | 상태 사본 | NON_BLOCKING | 설계 정정 때 갱신 |

## 9. Review Signals — 사실만

- 첫 검증이다. ΔV3부터 ΔV5까지 세 델타가 같은 "CUA로 닫는다" 문장을 반복했고 ΔV6에서 처음 fake DOM 클릭 테스트가 들어왔다.
- 관련 지침: `docs/handoff/AGENTS.md §공통 V`(좌표 규약)와 `handoff-verify §5`(UI라는 이유로 사람 실기로 넘기지 않는다).
- 사용자 결정 변경: ΔV3~ΔV6는 모두 사용자 추가 요구 델타(라운드 증가 없음).

## 10. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 1(G-0263-1, 영향 pair 7) + BLOCKING 1(D-0263-1). 다음 주체는 설계자.
- PASS pair: VP-03·05~08·12·16·19·20·VP6-1·VP6-2·VP6-R 및 REGRESSION 행. PAIR_FAIL 0.
- 운영 gate: 로컬 PASS, PR CI red는 0265 귀속.
- 다음 단계: 설계자 Delta V 정정(별도 설계 커밋) → 구현자가 interaction 좌표 추가·D-0263-1 반영 → 재검증. 사람 몫: 외곽·여백 시각 인수.

---

# r2 검증

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `c6d745c5..e024b87c` — ΔV7 설계 `12c81cfa` → r2 구현 `ce7aa102`, 기록 `7be5d723` |
| 구현 전 plan 기준 | `12c81cfa`(ΔV7, 설계 단독 커밋 — 0262 ΔV21과 공동) |
| V mode / 유효 V | Baseline V1 + ΔV2~ΔV7 |
| 검증 HEAD | `e024b87c` |
| 라운드 | 2 |
| 상태 | **PASS** (기계 범위) — PAIR_FAIL 0 · PLAN_GAP 0 · VP7-V 사람 시각 인수 대기 |
| 자기 검증 여부 | ΔV7 설계·구현 Codex(사용자 지시) · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity (r2)

- 구현 커밋의 `plan.md` 변경: 삭제 3줄(메타 상태 1 · ΔV6 기입 표제 1 · `### 운영 gate / Review Signals` 1 — 7필드 복원으로 표제 교체), 나머지는 `[구현자 기입]` 추가. Decision·AC·V·§10 변경 없음(`git diff 12c81cfa e024b87c -- …/plan.md`).
- G-0263-1 정정: ΔV7 D7-1이 ΔV3~ΔV5의 "실제 클릭/구독/포커스는 CUA에서 닫는다"를 SUPERSEDED하고 행동 16자리를 fake DOM 좌표로, 시각 EP-20a~e 5자리를 VP7-V 사람 인수로 분리했다.

| 검사 | 판정 | 근거 |
|---|---|---|
| SUPERSEDED 이관 | 유효 | 구 VP-09/13/17 → VP7-A, VP-10/14/18 → VP7-S, VP-15·VP-19 해당 증거 → VP7-I, EP-20a~e → VP7-V, VP6-1/2·VP-12/16/20 → VP7-R REGRESSION |
| 행동 자리 좌표 가능성 | 유효 | 16자리 모두 `Panel.lifecycle.test.ts`/`Panel.interaction.test.ts` 좌표로 지정 — fake DOM `renderHarness.testfixture.ts` 사용 |
| 시각 자리 분리 | 유효 | VP7-V 자동 자리 0, 기계 분모 밖. 과거 CUA는 참고 증거로만 남김 |
| oracle 배치 차이 | 타당 | ΔV7은 부모 열 좌표를 `Panel.interaction`으로 적었고 구현은 `Panel.lifecycle.test.ts:inherits the task column width and restores detail scroll after expansion`에 두었다 — 같은 production 경로, 구현자 보고에 명시 |

## 2. 비판적 읽기 (r2)

| 질문 | 판정 | 근거 |
|---|---|---|
| lifecycle 테스트의 실행 구간 | public `RightPanel` → OpenCode `Panel` → 공통 `TilePanel` → 실제 tiles/Sources | 대체는 `react`(fake hooks)·`react-dom`·Zustand React binding(실제 `createStore` 초기화·actions·구독 유지)·i18n뿐 — 실행 환경 대체이며 path 구성요소 mock 0 |
| 공유 fixture 변경의 회귀 위험 | 낮음 | `renderHarness.testfixture.ts`가 Context·`useReducer`·`useSyncExternalStore`·React key 기반 instance 식별·`hidden`/`inert`를 추가. 전체 renderer 스위트 통과, r1 red 변이 M01~06 전부 red 유지(§4) |
| 세션 전환 해제의 가드 | 이중 | `RightPanel.tsx:27` `key={module.resetBySession ? key : undefined}` remount와 `Panel.tsx` effect deps `[reveal, activeKey]`가 각각 단독으로 충분 — §4 M11·M11b green, 합성 M11c red |

## 4. 적대 증거 재측정 (r2)

범위: `src/renderer/src/features/chat`(2,081케이스). 모든 변이 후 원본 SHA256 일치.

| 변이 | r1 | r2 | 귀속 |
|---|---|---|---|
| M0263-07 부모 열 0 고정 | green | **red** 1 — `inherits the task column width…` `{ width: 320 }` ≠ 488 | N-0263-1 인용 |
| M0263-08 요약 '변경 사항' 진입 → process | green | **red** 2 — `opens diff from the summary…` | G-0263-1 인용 |
| M0263-09 '변경 사항' 진입 무동작 | green | **red** 2 — 같음 | G-0263-1 인용 |
| M0263-09b·09c·09d agent·셸·source 진입 무동작 | — | **red** 2·3·1 — `opens subagent/process/source …` | 인용 변이의 자리 미지정분을 EP-16 네 자리에 심음 |
| M0263-09e agent 진입 → source | — | **red** 2 | 형제 맞바꿈 |
| M0263-10 상세 안 agent 선택이 base 선택을 바꿈 | — | **red** 1 — `selects an agent inside the overlay…` | EP-18a 독립 |
| M0263-12 요약 model이 store 갱신 무시(`useMemo` deps `[]`) | — | **red** 1 — `updates active processes through store subscriptions…` | EP-21b 독립 |
| M0263-11 effect deps에서 `activeKey` 제거 · M11b remount key 제거 | — | green · green | 이중 가드 — 합성 M11c **red** 1(`clears it on session change`) |
| M0263-01 Task 열기가 subagent 타일 추가 | red | **red** 6 | 덮개 유지 |
| M0263-02 닫기가 store reveal 미정리 | red | **red** 1 | 덮개 유지 |
| M0263-03 상세 폭 고정 · 04 resize 무시 | red | **red** 2 · 2 (`Panel.interaction` + 새 lifecycle) | 덮개 유지 |
| M0263-05 Task pill origin 미전달 · 06 reveal.detail 무시 | red | **red** 2 · 1 | 덮개 유지 |

- 인용 변이 3/3 red → G-0263-1·N-0263-1 closed. 덮개 회귀 0.
- M11c의 실패 메시지는 `element.getAttributeNames is not a function`이다 — `expect(detail()).toBeNull()` 실패를 chai가 `HTMLElement`로 stub된 `FakeNode`를 출력하려다 낸 형식 오류이며 단언 자체는 실패했다(`node_modules/chai/index.js`만 이 API를 호출, `rg` app/src 0건).

## 5. V-pair closeout (r2)

| Pair | r2 결과 | 근거 / 자리 |
|---|---|---|
| VP7-I AR-02↔IT7-I | **PASS** | EP-16a~d `opens %s from the summary and closes back to the same overview`(4 case) + M08·09·09b~e red · EP-17a~c 같은 case의 `data-context`·`hidden`/`inert`·`[data-panel-close]` 1개 · EP-18 아래 |
| VP7-S SD-01↔ST7-S | **PASS** | EP-18a `selects an agent inside the overlay…`+M10 · EP-18b/c 닫기→같은 overview DOM·origin focus(위 4 case)·셸 완료 뒤 fallback focus(`updates active processes…`) · EP-19a/b `preserves detail state under an artifact and clears it on session change`(+M11c) · EP-19c `inherits the task column width…`(+M03·04·07) · EP-21b/c `updates active processes…`(+M12) |
| VP7-A R-02/06/08/11↔AT7-A | **PASS** | 위 16자리 공유 증거 — 네 진입→본문→갱신→복귀를 public `RightPanel`에서 관측 |
| VP7-R REGRESSION | **PASS** | VP6-1/2 `Panel.interaction.test.ts:opens one overlay…`(M01~06 red) · VP-12/16/20 r1 좌표 |
| VP7-V R-12/13↔AT7-V | **사람 인수 대기** | 자동 자리 0 — 두 테마 외곽·hover 여백·좁은 폭 |
| r1 PASS pair(VP-03·05~08·12·16·19·20·VP6-1·VP6-2) | PASS (r1 좌표) | r1 §5 좌표, HEAD 전체 실행 통과 |

- §10 분모: ΔV7 기계 16자리 = 코드 재열거 16(EP-16 4 · EP-17 3 · EP-18 3 · EP-19 3 · EP-21 2 · 부모 열 1) → 닫힘 16/16. 시각 5자리는 분모 밖.
- 좌표 실행 구간: 위 표의 모든 좌표가 `RightPanel`부터 관측 DOM까지 production 컴포넌트를 실행 — mock한 path 구성요소 0.

### AT / AC 합계 (r2)

| 범위 | 결과 |
|---|---|
| AC1′·AC2″·AC3·AC4·AC5·AC6‴·AC7·AC8′·AC9′·AC10′·AC11′·AC6-1 | ✅ 12 |
| AC12·AC13(EP-20 시각)·AC6-2(외곽 여백) | ⚠️ 3 — 사람 시각 인수(AC6-2의 폭·resize·부모 열은 ✅ 범위) |

- 합계: `✅ 12 · ⚠️ 3 · ❌ 0 = 15`(현재 유효 AC 15를 plan에서 직접 셈). AC4의 긴 로그 픽셀 스크롤은 fake DOM으로 주장하지 않는다.
- 사본 대조: 구현 보고 ΔV7 r2 `✅1·⚠️1`(AC6-1·AC6-2만 재확인) ↔ trailer `Criteria-Met: 19/21` 중 0263 몫 1/2 — 일치.

## 9. 게이트 (r2)

[0264 r2 §9](../0264-harness-module-isolation/verify.md)와 같은 HEAD `e024b87c` 공통 실행: typecheck exit 0 · readonly ESLint 1,734파일 error 0 · 전체 Vitest 754파일 7,404케이스(실패 0) · production build exit 0 · scripts 142/142 · inventory/migration/budget/diff check 통과 · 원격 Windows CI #788 success.

## 11. Repository operation checks (r2)

- INDEX 0263 행: 대상 커밋 `12c81cfa`(ΔV7 설계)·`ce7aa102`(r2)·`7be5d723`(기록) 기입 — 전부 `git cat-file -t` commit, 공유 브랜치 ancestor.
- trailer: `12c81cfa` 4키(`Agent: codex`·`Status: designed`) · `ce7aa102`·`7be5d723` 9키 파싱.
- `[구현자 기입]` ΔV6 복원 7필드 + ΔV7 r2 7필드 전수 존재 → D-0263-1 closed.
- plan 메타 V mode가 ΔV7까지 표기(N-0263-2 closed).

## 13. Finding disposition (r2)

| # | finding | disposition |
|---|---|---|
| G-0263-1 | 행동 자리 유일 oracle이 CUA | **closed** — ΔV7 좌표 16/16, 인용 변이 M08·M09 red |
| D-0263-1 | ΔV6 기입 필드 접힘 | **closed** — 7필드 복원 |
| N-0263-1 | 부모 열 선택 미잠금 | closed — M07 red |
| N-0263-2 | plan 메타 V mode | closed |
| N-0263-3 | 세션 전환 해제가 remount key와 effect deps 이중 가드라 단독 제거는 등가(M11·M11b green, M11c red) | NON_BLOCKING — 기록 |

## 14. Review Signals (r2)

- r1 G-0263-1과 같은 축을 ΔV7 설계 정정 → 구현으로 닫았다. 새 증상 없음.
- 반복 환경 한계: 실제 픽셀 layout은 fake DOM 밖 — VP7-V 사람 인수로 분리됨.

## 15. 결론 (r2)

- 상태: **PASS** (기계 범위).
- pair: REQUIRED/REGRESSION 기계 pair 전부 PASS · PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0 · VP7-V 사람 인수 대기.
- AC: ✅12 · ⚠️3(시각) · ❌0. 운영 gate PASS.
- 남은 사람 확인: 두 테마 외곽 radius·border·hover 여백·좁은 폭(EP-20a~e, AC12·AC13·AC6-2 외곽).
- 다음 단계: 사람 시각 인수 → archive 이동.
