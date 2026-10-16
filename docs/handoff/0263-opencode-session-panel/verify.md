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
