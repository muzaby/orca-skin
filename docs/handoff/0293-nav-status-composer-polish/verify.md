# Verify — 0293-nav-status-composer-polish

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **PASS (V1 r1 · 기계 범위)** — AC22 사람 실기만 남음 |
| 검증자 | Claude Code (구현자 Codex와 다른 에이전트) |
| 일자 | 2026-11-02 |
| 대상 range | `4a68c957`(V1 설계 정정) `..a61e8289`(r1 구현) — 브랜치 `claude/nav-session-items-ui-g26zhn` |
| 좌표 상태 | 세 해시 모두 `git cat-file -t` = commit. `origin/main` 미병합 — 병합 뒤 `main` 해시로 교정한다(`docs/handoff/AGENTS.md §INDEX.md 운영`) |
| 유효 V | `V1` (Baseline) |

## 0. 기준선 / plan 변경 확인

✅ 기준선이 diff로 성립한다 — 설계 커밋(`9db38355`·`4a68c957`)과 구현 커밋(`a61e8289`)이 분리돼 있다.

- 구현 커밋의 `plan.md` 삭제 행은 메타 `상태` 1행과 `[구현자 기입]` 자리표시자뿐이다 — Decision·AC·V·§10 행 변경 0(`git diff 4a68c957..a61e8289 -- …/plan.md | grep '^-'`).
- Plan validity: Baseline V, NEW node 19개 전부 같은 레벨 REQUIRED pair, INHERITED 6개는 REGRESSION. §10 자리 검색 Q-EP01~13을 HEAD에서 다시 돌려 목록과 차집합 0(§5 분모 표). `PLAN_GAP` 0.

## 1. Product & UX / ACTIVE Decision

✅ D-001~D-016 전부 구현과 일치한다.

| 흐름 | 관측 |
|---|---|
| A 세션 행 | 왼쪽 `modeIcon` = `inline-flex shrink-0` + `Icon navIcon` 고정(`SessionRow.tsx:71-80`). `statusSlot`이 세 분기 모두에 있다(`:145` rename · `:234` catalog · `:258` nav) |
| A 원호 | `ArcSpinner` = `Icon spinner 12 text-ink3 animate-spin motion-reduce:animate-none`, 소비 2(`SessionRow.tsx:99` · `Controls.tsx:159`) |
| B 팝업 | `ModelMenu.tsx:29` `orderAgentEnvironments(agents.filter(…))` — 필터 사본만 정렬, 기본 선택(`modelSelection.ts`) 무변경(D-012) |
| C 자동 수락 | `protocol.ts` opencode `.prefault({})`·`harnesses` `.prefault({})`·`.catch/.default(DEFAULT…)`, `channel.ts:394` `=== true` 무변경(포트 fail-closed 유지) |
| D 프로젝트 랜딩 | `ProjectLandingPage.tsx:120` `landingProjects` 공급 — `navigate` 추가 없음(D-016) |

## 2. 구현 결과 비판적 검토 — AC 전에

✅ 결함 없음.

- 메뉴 열림 중 상태 칸은 미렌더(`hasMenu && menuOpen`)라 케밥과 겹치지 않는다. 메뉴 없는 행은 `statusHide = ''`라 hover에도 남는다(D-005).
- `.prefault({})` 물질화는 최초 load 1회 디스크 쓰기(기존 load 경로)다. 저장된 `false`는 parse가 그대로 둔다(T-10).
- 정렬은 입력을 바꾸지 않는다(M-B3 red로 확인).

## 3. 역방향 탐색

✅ 미배선·죽은 코드 0.

- 삭제: `DotsSpinner`·`dot-wave`·`engine/common/lib/agentOrder.ts` — Q-EP07 0행, `orderAgentEnvironments` 정의 1(`harness.ts:77`)·호출 2.
- 신규 export(`ArcSpinner`·`DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS`·`Dot` `blue`) 모두 production 소비가 있다(Q-EP05·Q-EP10·Q-EP06).
- 테스트는 production symbol을 직접 렌더/호출한다 — 로컬 재구현 없음(T-01·T-03·T-08·T-12·T-14 읽음).

## 4. 고장 이력 (등록 변이 + 독립 축)

전부 `잡음`. 각 변이는 한 번 심고 테스트 후 원복했다(`git status` 깨끗). 실패 수에는 기준선 실패 1건(§9)이 adapter 스위트가 포함된 행에만 섞여 있다.

| ID | 자리 | 종류 | 바꾼 내용 | 결과 · 실패 수 |
|---|---|---|---|---|
| M-A1 | `SessionRow.tsx` modeIcon | 다른 값 | 상태 있으면 `text-selected` | 잡음 · 10 |
| M-A2 | 같은 곳 | 호출 대체 | 생성 중 왼쪽에 `ArcSpinner` | 잡음 · 7 |
| M-A3 | statusSlot 내용 | 맞바꿈 | 원호↔공 | 잡음 · 12 |
| M-A5 | `STATUS_LABEL` | 맞바꿈 | 완료↔대기 이름 | 잡음 · 8 |
| M-A6 | `statusHide` | 맞바꿈 | nav↔catalog 숨김 class | 잡음 · 4 |
| M-A7 | statusSlot 조건 | 제거 | `hasMenu && menuOpen` → `false` | 잡음 · 2 |
| M-A8 | `statusHide` | 고정값 | 메뉴 없어도 숨김 | 잡음 · 2 |
| M-A9 | `navIconState.ts` | 뒤집기 | 주의 표시를 생성 중보다 먼저 | 잡음 · 11 |
| M-A10a | rename 분기 | 제거 | 상태 칸 삭제 | 잡음 · 2 |
| M-A10b | catalog `actions` | 제거 | 상태 칸 삭제 | 잡음 · 2 |
| M-A11 | SessionRow 원호 | 호출 대체 | 인라인 `Icon spinner size 14` | 잡음 · 6 |
| M-A12 | `Controls.tsx:159` | 호출 대체 | 인라인 `Icon spinner size 14` | 잡음 · 1 |
| M-A4 | `ArcSpinner.tsx` | 제거 | `text-ink3` 삭제 | 잡음 · 3 |
| M-X1 | `Status.tsx` blue | 다른 값 | `bg-good` (독립 축) | 잡음 · 11 |
| M-B1 | `ModelMenu.tsx:29` | 제거 | 정렬 호출 제거 | 잡음 · 1 |
| M-B2 | `harness.ts` 순위 | 호출 대체 | adapter 문자열 정렬 | 잡음 · 3 |
| M-B3 | `harness.ts` | 다른 값 | 입력 배열 제자리 변경 | 잡음 · 2 |
| M-C1 | `protocol.ts` harnesses | 호출 대체 | `.default({})` | 잡음 · 3(+기준선 1) |
| M-C2 | `protocol.ts` opencode | 호출 대체 | `.optional()` | 잡음 · 3(+기준선 1) |
| M-C3 | 같은 곳 | 다른 값 | `.catch(false)` | 잡음 · 2 |
| M-C4 | `GeneralTab.tsx` 초기 state | 다른 값 | `false` | 잡음 · 2 |
| M-C5 | `GeneralTab.tsx` 로드 폴백 | 다른 값 | `?? false` | 잡음 · 1 |
| M-C6 | `GeneralTab.tsx` 저장 폴백 | 다른 값 | `?? false` (독립 축) | 잡음 · 1 |
| M-D1 | `ProjectLandingPage.tsx:120` | 제거 | `landingProjects` 삭제 | 잡음 · 7 |
| M-D2 | 같은 페이지 | 호출 대체 | 다른 프로젝트 선택 시 `navigate` | 잡음 · 3 |
| M-D3 | `useLandingProjectPicker.ts` | 다른 값 | 추가 결과를 첫 프로젝트로 고정 | 잡음 · 2 |

- 분모: pair 등록 변이 24 + 독립 축 2(M-X1·M-C6) = 26행, 못 잡음 0 · 동치 0.

## 5. V-pair closeout — `UT → IT → ST → AT`

✅ REQUIRED 19 · REGRESSION 6 = 25 PASS · PAIR_FAIL 0 · BLOCKED 0. VP-07(R-07)은 사람 실기 대기다.

| Pair | 판정 | 직접 oracle 좌표(실행·green) | 적대 증거 |
|---|---|---|---|
| VP-17·19·18·22 (UT) | PASS | `harness.test.ts:'0293 orderAgentEnvironments…'` · `arcSpinner.test.ts` · `settings-store.test.ts:'0293 turns OpenCode auto-approve on…'` · `navIconState.test.ts` | M-B2·B3 · M-A4 · M-C1~C3 · M-A9 |
| VP-11·12·13·14·15·16 (IT) | PASS | `navSections.render.test.ts:'0293 %s…'`(5 사이트) · `SessionRow.interaction.test.ts` 5케이스 · `Controls.interaction.test.ts` · `resources.test.ts` · `AgentEnvironmentView.render.test.ts:'orders engine cards…'` · `generalTab.*.test.ts` · `NewChatLandingPage.project-picker.test.ts` · doc gate | M-A6~A12 · M-X1 · M-B1 · M-C4~C6 · M-D1 |
| VP-08·09·10 (ST) | PASS | `useSessionCompletion.test.ts:'observes the full non-viewed state sequence'`·`'0293 keeps the agent icon identical…'` · `adapter.test.ts:'0293 auto-approves with a fresh settings store…'` · `registry.preferences.test.ts:'0293 passes the default…'` · `ProjectLandingPage.project-picker.test.ts:'0293 selecting another project…'` | M-A9 · M-C1·C2 · M-D2 |
| VP-01~06 (AT) | PASS | T-01·T-02·T-03·T-08·T-13·T-14 위 케이스 | M-A1~A3·A5 · M-B1 · M-C4 · M-D1·D3 |
| VP-07 (AT) | 사람 실기 대기 | plan §19 ①~⑦ | — |
| VP-20·21·23·24·25 (REGRESSION) | PASS | 0254·0249·0255 describe(마커 갱신 후 기대값 불변) · 엔진 카드 · `/new` picker · 0285 adapter 케이스 | 기존 |

### pair별 plan §10 강제 지점 분모

| EP | §10 자리 | HEAD 재측정 | 차집합 |
|---|---|---|---|
| EP-01 | 4 | Q-EP01 4행(`:75`·`:136`·`:225`·`:254`) | 0 |
| EP-02 | 3 | statusSlot 호출 `:145`·`:234`·`:258` | 0 |
| EP-04 | 4 | `:91`(menuOpen·hasMenu) · `:104`·`:105` literal · `statusHide=''` | 0 |
| EP-05 | 3 | `ArcSpinner.tsx:5` · `SessionRow.tsx:99` · `Controls.tsx:159` | 0 |
| EP-07 | 18 → 0 | Q-EP07 0행 | 0 |
| EP-08 | 10 | ko·en `status` 3키씩 · `STATUS_LABEL` 3 · `sessions.generating` 0 | 0 |
| EP-09 | 3 | 정의 `harness.ts:77` · 호출 `ModelMenu.tsx:29`·`AgentEnvironmentView.tsx:123` | 0 |
| EP-10·11 | 5·5 | `protocol.ts` catch·default·prefault 2 · `GeneralTab.tsx` 3자리 · 읽기 경로 무변경 | 0 |
| EP-12 | 7 | Q-EP12 운반 7행(신규 `ProjectLandingPage.tsx:120` 포함) | 0 |
| EP-13 | 12 | 12자리 새 문장 확인(IPC 1 · catalog 6 · overview 1 · rendering 1 · state 3) | 0 |

### AT / AC 합계

`✅ 21 · ⚠️ 1(AC22 실기) · ❌ 0 = 22`. 구현 trailer `Criteria-Met: 21/22`·INDEX 비고 `21/22`와 같다.

## 9. 게이트 재실행

| Gate | 관측 |
|---|---|
| typecheck 3종 | exit 0 · `error TS` 0 |
| eslint(`--fix` 없이 `npx eslint ./src ./scripts`) | 0 error · 2 warning — `opencode/transcript/Timeline.tsx`·`useTranscriptVirtualizer.ts`(이번 변경 밖) |
| vitest §19 집합 | 111 파일 · 697 케이스 중 696 pass · 1 fail |
| 기준선 분리 | 실패 1 = `adapter.test.ts:'subscribes before sending, scopes the turn…'` — `C:/work`가 Linux에서 상대 경로로 해석된다. `4a68c957` worktree에서도 같은 실패 → 플랫폼 기인, 변경 무관 |
| 환경 | `npm ci --ignore-scripts` 뒤 Electron 바이너리 미설치로 2파일이 로드 실패 → `node node_modules/electron/install.js`로 설치 후 green(T-11 포함). DB 스위트 미대상 |
| doc inventory `--check` | generated·prose·links ok |
| trailer | `a61e8289` 6키 파싱 · 이 검증 커밋도 파싱 확인 |

## 10. 사람 실기 (AC22)

남은 것은 plan §19 ①~⑦뿐이다 — 두 테마 시각·hover 교체 체감·Windows 애니메이션 끔·실제 플러그인 런타임 행·새 프로필 실제 OpenCode 권한 진행·프로젝트 팝업 실전송. 순수 판정·순서·기본값·배선은 위 테스트로 닫았다.

## 11. Repository operation checks

- INDEX: 0293 행 `impl/IMPL_DONE` → 이번 커밋에서 `verify/PASS`·다음 주체 사람(AC22)·대상 커밋 기입. 비고 5줄 이내.
- `[구현자 기입]` 7개 필드 전부 존재(설계 리뷰·강제 지점 전수·잠금·Product/UX·잠재 문제·구현 보고·Review Signals).
- AGENTS.md 변경 없음.

## 13. Finding disposition

| # | 발견 | 분류 |
|---|---|---|
| — | 없음 | — |

## 14. Review Signals — 사실만

- 최초 라운드. 반복 증상 없음.
- 반복 환경 한계: Linux에서 Windows 경로 fixture 1건 · 제약 설치 시 Electron 바이너리 수동 설치 필요.

## 15. 결론

**PASS (V1 r1 · 기계 범위).** pair 25/25 PASS, 고장 26/26 잡음, 운영 gate 통과. archive 이동은 AC22 실기 뒤.
