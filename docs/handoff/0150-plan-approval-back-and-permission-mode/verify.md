# Verify — 0150-plan-approval-back-and-permission-mode

## 메타

| 항목 | 값 |
|---|---|
| slug | `0150-plan-approval-back-and-permission-mode` |
| 검증자 | Claude Code |
| 일자 | 2026-07-27 |
| 대상 커밋 | `38f8032` (본 구현) · `282a4e7` (사용자 추가 요구 A-5) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 ① — 설계 Context 의 "승인 후 SDK 모드는 계속 `plan`" 이 틀렸고 실제로는 `default` | **타당**. `let p=En(t);if(p.mode==="plan"){…m=p.prePlanMode??"default"…}` 로 확인. Orca 는 spawn 옵션으로 plan 진입이라 `prePlanMode` 부재 → `default`. 증상도 "편집 차단"이 아니라 "편집마다 승인 카드 재출현"(`Edit`/`Write` ∈ `RISKY_TOOLS`) | plan Context·자료조사 교정 완료. 인수 기준·설계는 불변(고칠 대상·방법 동일) — 재설계 불요 |
| 이견 ② — 설계 A-1 의 `useEffect`+`setState` 안이 lint error | **타당**. `react-hooks/set-state-in-effect` 는 error 레벨이고 구현 턴에 실제로 걸렸다 | 순수 파생 `collapsedAtCount` 로 대체. 설계 의도(코멘트가 확장을 강제하지 않음) 동일 충족 + effect 1개 감소 → 개선으로 인정 |
| 이견 ③ — "TS `PermissionUpdate` 철자 미확인" 이 `npm ci` 후 해소 | **타당**. `sdk.d.ts:2149-2151` 실물 확인 | 잔여 미확인은 *런타임 적용 순서* 하나로 축소 |
| 선조치 #1~#5 (전부 ✅ 구현·보고, ⚠️ 없음) | **경계 준수**. 5건 모두 "구현 세부·놓친 엣지케이스·명백한 누락" 범주로, Open Question·신규 의존성·제품 의도·인수 기준 변경을 단독 결정한 것이 없다 | 매트릭스에 반영. #3 의 잔여(런타임 실측)만 사람 실기로 이관 |

**검증자 추가 조사 (구현자가 못 본 것).** `updatedPermissions` 는 CLI 에서 무조건 통과하지 않는다 — 도구가 `suppressesAlwaysAllowRule` 을 선언하면 `pIe()` 필터를 탄다:

```js
L.behavior==="allow"){let P=t.tool.suppressesAlwaysAllowRule?.(o)===!0||n.suppressAlwaysAllowRule===!0
  ? pIe(L.updatedPermissions??[],t.tool,En(t.toolUseContext)) : L.updatedPermissions??[];
```

필터 본체 `bid()` 를 확인한 결과 **`setMode` 는 영향이 없다** — `addRules`/`replaceRules` + `behavior:'allow'` 인 항목만 규칙 필터링을 받고 나머지는 첫 분기에서 그대로 push 된다:

```js
for(let s of e){ if(!((s.type==="addRules"||s.type==="replaceRules")&&s.behavior==="allow")){i.push(s);continue} … }
```

⇒ ExitPlanMode 의 `suppressesAlwaysAllowRule` 선언 여부와 무관하게 우리 업데이트는 살아남는다. 구현 턴이 짚지 못한 경로였으나 **결론은 동일**해 재구현 불요.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 확장 상태 좌측 하단 `뒤로` 노출 + 클릭 시 3버튼 상태 복귀 | ✅ | `ApprovalCard.tsx:298-300`(좌측 슬롯 `뒤로`) · `:203` `collapseRevise = () => setCollapsedAtCount(comments.length)` · `:293` 푸터 `justify-between` 고정. **기계 테스트 없음 — 코드 대조** (repo 관례: UI=시각 검증, `app/AGENTS.md` 원칙 4) |
| 2 | 접어도 수정 텍스트·코멘트 보존, 재진입 시 복원 | ✅ | `collapseRevise` 가 `collapsedAtCount` 만 쓴다 — `feedback`(`:170` useState)·`planComments`(store) 미변경. `수정…` 재클릭 = `setCollapsedAtCount(null)`(`:195`) |
| 3 | 코멘트가 있어도 뒤로 동작 + 접힌 뒤 수락/거부 도달 | ✅ | `:177` `reviseExpanded = collapsedAtCount === null \|\| comments.length > collapsedAtCount` — 종전 `reviseOpen \|\| hasComments` 의 강제 확장 소멸. 접기 후 `collapsedAtCount === comments.length` 라 `>` 불성립 |
| 4 | 접힌 상태에서 코멘트 추가 시 재확장 + textarea 포커스 | ✅ | 재확장: `comments.length > collapsedAtCount` 가 다시 성립(`:177`). 포커스: `:180-184` effect, 키가 `comments.length` 라 2번째 코멘트에도 재발화 |
| 5 | 확장 시 `Escape` = 뒤로, 접힘 시 미소비 | ✅ | `:222-226` `if (e.key === 'Escape' && reviseExpanded) { preventDefault; collapseRevise(); return }` — 접힌 상태는 `preventDefault` 없이 통과 |
| 6 | allow 응답이 `updatedPermissions:[{setMode, acceptEdits, session}]` 포함 / deny 는 미포함 | ✅ | `claude.ts:155-168` · 테스트 3건 `claude.canusetool.test.ts:100-126`(기대값 갱신 1 + 신규 2) — **24/24 pass** |
| 7 | 승인 시 main `PermissionModeController` 가 `accept_edits` 기록 | ✅ | `chat-turn.ts:739-741` `if (action.kind === 'plan_review' && resolution.behavior === 'allow' && turn.dbSessionId) permissionModes.setMode(...)`. `turn` = `activeTurn`(`:673` 섀도잉) 이라 자동 연속 턴에서도 현재 턴을 읽는다. **기계 테스트 없음 — 코드 대조** (D3) |
| 8 | 규칙이 `shared/permission-mode.ts` 1곳 | ✅ | `permission-mode.ts:26` 정의 → 소비 3곳(`claude.ts:20,162` · `chat-turn.ts:38,740` · `chatStore.ts:29,1057`). `grep "'accept_edits'"` 잔존 6건은 전부 타입 union·zod enum·모드 카탈로그·레거시 브리지로 **다른 관심사** |
| 9 | lint 0 error · typecheck 3종 0 · vitest 회귀 0 | ✅ | 아래 게이트 절 |
| 10 | 좌측 세 버튼 `contained` 통일, 우측은 `primary` 유지 | ✅ | `:299`(뒤로) · `:304`(거부) · `:307`(수정…) 모두 `variant="contained"`. 우측 `:312-`·`:322-` `primary` 유지 |

**10/10 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (아래) |
| CI(windows-latest, egress 열림) | ✅ 확인 | — | **`gate` success** — 로컬에서 로드 못 한 스위트까지 포함 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 |
| 레이어 경계 위반 0 | ✅ | — | lint boundaries 0 error (adapters→shared · app→shared · renderer→shared 전부 하향) |
| SDK 계약 정합 | ✅ 타입+바이너리 대조 | — | `sdk.d.ts:2113-2118,2133-2162` · CLI 적용/필터 경로 3곳 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/PHASES 한국어, 상대 링크 유효 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | **AGENTS.md 무변경** — 스캔 대상 없음 |
| **런타임 실효**(수락 직후 같은 턴 편집이 카드 없이 진행) | ✖ 정적 근거만 | ✅ 실기 | **사람 확인 대기 (1순위)** |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 목표 모드·뒤로 동작·버튼 variant 모두 사용자 결정 획득 |
| Open Questions | ✖ | ✅ | 해당 없음 |
| 신규 의존성 승인 | ✖ | ✅ | **신규 의존성 0** — 승인 대상 없음 |
| PR 머지 승인 | ✖ | ✅ | 대기 (PR #291, draft) |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)
  └ warning = useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library (TanStack↔React Compiler, 0102 이래 베이스라인)

$ npm run typecheck
typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅   (3/3, 출력 0)

$ ./node_modules/.bin/vitest run
Test Files  1 failed | 146 passed (147)
Tests       1176 passed (1176)

$ node --test "scripts/*.test.mjs"
# tests 28  # pass 28  # fail 0
```

**베이스라인 분리.** vitest 실패는 **파일 1건 = 로드 실패**(`app/chat-turn.continuity`, `Electron failed to install correctly`)이고 **테스트 실패는 0건**이다. egress 403 환경 제약(`app/AGENTS.md` 게이트 가이드의 알려진 서명)이며 코드와 무관하다. DB 로드 스위트는 `npm rebuild better-sqlite3`(Node ABI)로 green 을 확보했다.

**결정적 보강 — CI.** PR #291 의 `gate`(windows-latest · Node 22 · egress 열림)가 **success**(run `30244026846`). 이 러너는 `npm ci` → 마이그레이션 가드 → lint → typecheck → `npm test` 전체를 돌리므로, 로컬에서 환경 제약으로 로드하지 못한 스위트까지 포함해 통과했다. 로컬 베이스라인이 환경 문제였음을 **독립적으로 확증**한다.

## 위생 검토 (AGENTS.md 변경 시)

- **AGENTS.md 무변경** — 본 작업은 `app/src/**` 7파일 + `docs/handoff/**` 만 건드렸다. 위생 스캔 대상 없음.
- 키/토큰/이메일/IP 패턴: 변경 diff 에 없음. `destination:'session'` 고정으로 사용자 `settings.json` 기록 경로를 차단했고(CLI persist 게이트 `jCs`/`LEe` 는 local/user/project 만 통과) 테스트로 못박았다 — 설정 파일 오염 위험 0.

## PHASES.md 정합성

- 페이즈 표 말미에 0150 행 추가. 커밋 `38f8032`·`282a4e7` 기재. PR #291 링크.
- "현재 작업 중" 절은 보드 링크만 유지하는 관례라 무변경.

## 검증 자기 리뷰 (무엇이 부족했나)

**설계 단계.**
1. **문제 서술이 틀렸다.** plan 초안이 "승인 후 SDK 모드는 계속 `plan`" 이라 단정했으나 실제는 `default` 였다. 원인은 조사를 SDK *타입*과 앱 코드에서 멈추고 **CLI 바이너리의 실제 동작**까지 내려가지 않은 것. `node_modules` 부재를 제약으로 받아들이고 `npm ci` 를 먼저 시도하지 않은 판단 착오다 — 구현 턴에 시도하니 바로 됐다. 다행히 고칠 대상과 방법이 동일해 설계가 무너지진 않았지만, **증상 서술이 틀린 채로 사람 실기 항목을 썼다면 검증이 헛돌 뻔했다**.
2. **인수 기준이 실효를 담지 못했다.** AC6 은 "allow 응답이 `updatedPermissions` 를 *포함한다*"까지만 요구한다. 정작 이 작업의 목적인 "그래서 편집이 카드 없이 진행되는가"는 인수 기준 밖으로 밀려 사람 실기 항목에만 있다. 기계 검증 가능한 형태로 못 쓸 사정(electron 실행 불가)은 있었으나, **그렇다면 인수 기준에 "런타임 실기로만 확인 가능"이라고 명시했어야** 한다.
3. A-1 의 `useEffect`+`setState` 안은 이 저장소의 lint 규칙(error 레벨)을 안 보고 쓴 것이다. 설계가 코딩 규약을 확인하지 않았다.

**구현 단계.**
- 선조치 5건 모두 경계 안이었고 ⚠️ 남용이 없었다. 특히 #1(문제 서술 교정)은 설계를 되먹인 모범 사례.
- 다만 `suppressesAlwaysAllowRule` → `pIe()` 필터 경로를 못 봤다. 결론은 같았지만 **"우리 업데이트가 무조건 전달된다"는 근거가 한 겹 부족**한 채로 IMPL_DONE 을 선언했다. 검증 턴에서 보강했다.
- A-5(버튼 variant)는 사용자가 지적하기 전까지 아무도 못 봤다. 좌측에 버튼을 하나 더 놓으면서 기존 이웃과의 외형 일관성을 점검하지 않은 것 — `Button.tsx:57-58` 에 같은 취지의 선례 주석(0121 r5)이 있었는데도 놓쳤다.

**검증 단계 (이번 verify 가 못 본 것).**
- **UI 인수 기준 5건(AC1~5)과 AC7 에 기계 검증이 없다.** 코드 대조로만 ✅ 를 줬다. AC3·AC4 는 시각이 아니라 **로직**(`collapsedAtCount` 파생)이라 순수 함수로 추출해 테스트할 수 있었다. 한 줄짜리 파생에 모듈을 새로 파는 게 과한지 저울질했고 repo 관례(UI=시각 검증)를 근거로 넘겼으나, **관례를 방패로 썼다는 자각은 있다** → D4 로 남긴다.
- **런타임 실효를 끝내 확인하지 못했다.** 정적 근거는 3중(적용 시점·context 동일성·필터 무영향)으로 촘촘하지만 전부 바이너리 문자열 분석이다. 이 작업의 성패는 사람 실기 1문항에 걸려 있고, 그건 검증자가 메울 수 없는 구멍이다.
- 검증자와 구현자가 동일 에이전트라 **자기 코드 리뷰의 한계**가 있다. 그래서 CI(독립 러너)를 별도 증거로 명시했고, 매트릭스 증거를 전부 `파일:라인`으로 못박아 사후 반증이 가능하게 했다.

## [FAIL 시] 미충족 요구사항

해당 없음 (10/10 충족).

## 결론 / 다음 단계

**PASS (r1)** → PHASES 표 승격 · INDEX `verify/PASS` · 다음 주체 `—`.

**사람 확인 대기**
1. **`수락` 직후 같은 턴에서 Edit/Write 가 도구 승인 카드 없이 진행되는가** — 이번 수정의 실효. 미적용이면 `chat-turn.ts:739-741` 지점에 `runtime.setPermissionMode` 폴백을 덧대면 된다(원인은 적용 순서일 것이므로 위치는 동일).
2. `수정…` → 좌측 하단 `뒤로` 노출·접힘·복원
3. 코멘트 1개 작성 → 자동 확장 → `뒤로` → `수락` 도달
4. 확장 상태 `Escape`
5. 라이트/다크 2테마 + 좌측 세 버튼 테두리·채움 동일성
6. PR #291 머지

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `PermissionModeController.getCurrentMode`/`forget` 프로덕션 호출처 0 — write-only 싱크 + 세션 삭제 시 Map 누수. 본 작업이 write 경로를 하나 더 늘렸다 | 조사(0150) | 세션 delete 경로에서 `forget` 호출 + 다음 턴이 controller 를 읽도록 배선, 또는 controller 폐기 | open |
| D2 | `shared/ipc.ts:800-806` 의 `PermissionMode`(2종)·`fromUiPermissionMode` 가 죽은 코드. 주석도 "현 Composer UI 2종"이라 낡음(실제 6종 노출) | 조사(0150) | 제거 + 주석 교정 | open |
| D3 | AC7(controller 동기화)에 기계 검증 부재 — `requestApproval` 후처리 경로는 단위 테스트가 없다 | verify r1 | `requestApproval` 을 주입 가능한 형태로 얇게 갈라 후처리 분기만 테스트 | open |
| D4 | AC1~5 UI 인수 기준 기계 검증 부재. 특히 AC3·4 는 시각이 아니라 로직(`collapsedAtCount` 파생)이라 순수 함수 추출 + 테스트가 가능했다 | verify r1 (자기 리뷰) | 파생식을 `features/chat/lib/` 순수 함수로 추출해 테이블 테스트, 또는 렌더 테스트 도입 여부를 제품 판단 | open |
| D5 | `ToolApprovalBody` 의 `세션 동안 허용` 이 `uncontained` 로 남아 계획 카드와 규칙이 갈린다 | 사용자 요구 ⑤ 의 인접 범위 | 같은 통일 규칙 적용 여부 = 사용자 결정 (이번 요청 범위는 계획 카드) | open |
