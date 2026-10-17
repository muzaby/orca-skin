# Verify — 0264-harness-module-isolation

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다 — 판정 먼저, 주장 한 줄에 관측 하나.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0264-harness-module-isolation` |
| 검증자 | Claude Code |
| 일자 | 2026-10-16 |
| 대상 커밋/range | `b8b7c30e..940bd44e` — 구현 `2b548cf0`·`c43bf948`, 기록 `940bd44e` |
| 구현 전 plan 기준 | `b8b7c30e`(plan READY, 설계 단독 커밋) |
| V mode / 유효 V | Baseline V: V1 (0262/0263 동작은 INHERITED 회귀 기준) |
| 검증 실행 위치 | 주장 재측정 = `940bd44e` worktree(같은 `package.json`, node_modules 공유) · 회귀 = HEAD `655fa0e0` |
| 라운드 | 1 |
| 상태 | **FAIL** — root PAIR_FAIL 1 (VP11) |
| 자기 검증 여부 | 설계·구현 Codex(사용자 직접 요청) · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity

- 기준선 성립: 예 — `git diff b8b7c30e 2b548cf0 -- …/plan.md` 삭제 줄은 `구현 착수 후 기입.` 자리표시자 6줄과 Review Signals 1줄, `c43bf948..940bd44e`는 CI 자리표시자 2줄뿐. Decision·AC·V·§10 변경 없음.
- plan 메타 `상태`는 여전히 `READY`다(INDEX는 IMPL_DONE) — 상태 사본 불일치(N-0264-4).
- V mode: Baseline V1 유효. NEW node(R01~06·R11, AR01·02, MD01·02)마다 같은 레벨 REQUIRED pair, INHERITED R07~10·SD01은 REGRESSION pair가 있다. §10 분모 6+6+4+7+3+2 = 28.
- 선택 적대 증거: VP01 registry 슬롯 맞바꿈, VP03/VP12 경계 fixture — 선택 이유 있음. 나머지는 직접 oracle.
- plan의 `harnesses/registry.test.tsx`·`RequestDock` 테스트를 표면별 기존 진입점 테스트로 바꾼 것은 구현자가 [implementation-evidence.md](implementation-evidence.md)에 대체 매핑을 적은 oracle 배치 차이다. 규범 변경 아님.
- PLAN_GAP 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | 실제 production path |
|---|---|---|
| D01·D03 | feature/레이어 DAG 안의 common/구체 분리, common은 구체·registry 비의존 | renderer `features/*/harnesses/{claude,opencode,common}` + `registries/*` · main `adapters/common`·`features/harnesses/*`·`app/harnesses/*` |
| D02 | 정적 typed registry, Backend·IPC·DB 형상 유지 | `satisfies Record<Backend, …>` 9개 registry · IPC/DB diff 0 |
| D04 | OpenCode SDK·native 해석은 v1 경계 | `harness/sdk-version`·`version-boundary` lint |
| D05 | 동작·화면·수명주기 유지 | 회귀 oracle 30파일(아래 §5) |
| D06 | 확인된 미사용 tracked 파일만 제거 | 삭제 `PlanTile.tsx`·`htmlRegion.testlib.ts` 2건 |
| D07 | 새 계층·중복 구현 없음 | 잔여 pass-through·중복 정책은 N-0264-1·2 |

## 2. 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 삭제(D) 8건의 성격 | 정상 | 6건은 내용 변경으로 rename 미검출된 이동(`adapters/registry.test.ts`→`adapters/common/registry.test.ts` 등), 확정 dead code 2건 |
| 암묵 Claude 기본값 | 의도 | `app/harnesses/registry.ts:25` `?? claudeMainModule`는 §11이 app 조립부에 명시한 호환 정책 |
| 조립 배선 누락이 보이는가 | **아니오 — 미잠금** | `createHarnessSettingsService`의 loader 맵에서 OpenCode를 빼도 main 4,051케이스 green(M0264-14b) |
| IPC/DB/패키지 | 불변 | `git diff --stat b8b7c30e 940bd44e -- app/package*.json` 0 · 마이그레이션 변경 0 |
| 작업 트리 | 깨끗함 | 모든 변이 후 원본 bytes·SHA256 복원, `git status` 확인 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh b8b7c30..940bd44` — 163줄. 1a/2절 후보 다수는 같은 파일 안에서 쓰이는 export의 오탐이다. 직접 확인한 것만 적는다.

| 후보 | 판정 | 근거 |
|---|---|---|
| `registries/composer.tsx`의 `approval` 맵 + `ToolApprovalBody` | test-only | production 소비자 0. `components/ApprovalCard.tsx:250` 재수출을 `ApprovalCard.harness.test.ts`만 import. 각 하네스 composer는 자기 ToolApproval을 직접 렌더 → 형제 슬롯 맞바꿈 M0264-07 green(N-0264-1) |
| `chat/lib/rightPanelTiles.ts:2` `RIGHT_PANEL_POLICY` 재수출 | 소비자 0 | `rg` 값 import 0건(N-0264-1) |
| `chat/lib/agentPresentation.ts:10` 재수출 | 정상(조립 소비) | 값 소비자는 `components/AgentModeToggle.tsx` 1곳 — 조립 계층. 0264 이전에는 두 하네스를 모두 import했다 |
| `features/harnesses/{claude,opencode}/model-policy.ts` | 중복 | 두 파일의 `resolveTitleModel`·`defaultProvider`가 동일 코드(N-0264-2). 그래서 맞바꿈 M0264-15·16은 등가 green |
| `parseHarnessSettingsModels`·`mainHarnessModules` | 정상 | 같은 파일 `registry.ts:17,44,47`에서 사용 |

## 4. 적대 증거 재측정

변이 실행기: scratchpad `mut.mjs`(1변이 적용 → vitest JSON → 원본 bytes·SHA256 복원). 940bd44 변이는 worktree에서 실행했다.

| 변이 | 위치 | 결과 | 귀속 |
|---|---|---|---|
| M0264-01 composer `modules` 맞바꿈 | 940bd44 | **red** 2/3 | VP01 등록 |
| M0264-02 transcript `registry` 맞바꿈 | 940bd44 | **red** 8/11 | VP01 등록 |
| M0264-03 rightpanel `panels` 맞바꿈 | 940bd44 | **red** 10/12 | VP01 등록 |
| M0264-04 engine `configurations` 맞바꿈 | 940bd44 | **red** 2/3 | VP01 등록 |
| M0264-05 settings `configurations` 맞바꿈 | 940bd44 | **red** 2/2 | VP01 등록 |
| M0264-06 landing `presentations` 맞바꿈 | 940bd44 | **red** 1/3 | VP01 등록 |
| M0264-07 composer `approval` 맞바꿈(형제 슬롯) | 940bd44 | green — production 미사용 경로 | N-0264-1 |
| M0264-08·09 `status`·`assistant` registry 맞바꿈 | 940bd44 | **red** 2/11 · 3/11 | 독립 |
| M0264-10 `harness/ownership` off | HEAD | **red** 경계 3/8 | VP03/12 새 oracle 민감도 |
| M0264-11·12 owner 판정에서 `app/harnesses`·`shared/harnesses` 제거 | HEAD | **red** 2/8 · 2/8 | VP03/12 엄격화 |
| 실제 소스 위반 7곳 심기(형제 import·common→concrete·common→registry·`@renderer` alias re-export, renderer·main 양쪽) | HEAD | **7/7** `harness/ownership` 진단 | VP03/12 독립 |
| landing registry에서 `opencode` 항목 제거 | HEAD | `tsc` **TS1360** `satisfies Record<Backend,…>` | AC6 exhaustiveness |
| M0264-13 app registry가 OpenCode adapter 미생성 | HEAD | **red** 2/8 | 독립 — VP13 |
| **M0264-14b settings 서비스 loader 맵에서 OpenCode 제외** | HEAD | **green — main 4,051/4,051** | **VP11 root PAIR_FAIL (D-0264-1)** |
| M0264-15·16 OpenCode 조립이 Claude title/default-provider 정책 사용 | HEAD | green — 두 정책 코드 동일(등가) | N-0264-2 |

- 등록 변이 6/6 검출(940bd44). 이전 라운드 없음 → 덮개 회귀 해당 없음.
- 자리 미지정 등록 변이: "registry 슬롯 맞바꿈"을 composer registry의 두 맵 모두에 심었다. `approval` 맵은 production 경로가 아니라 VP01 실패로 세지 않는다.

## 5. V-pair closeout — `UT → IT → ST → AT`

좌표는 [implementation-evidence.md](implementation-evidence.md)의 `파일:테스트명`이다. `940bd44` worktree에서 그 30파일을 실행해 **304/304 통과**, `scripts/harness-boundary.test.mjs` 8/8 통과. HEAD 전체 실행(753파일)에서도 통과하며 예외는 아래 표기.

| Pair | 결과 | 직접 증거 | 비고 |
|---|---|---|---|
| VP12 MD01↔UT01 | PASS | 경계 8테스트 + M0264-10~12 + 실제 소스 7곳 | — |
| VP13 MD02↔UT02 | PASS | EP01 표면 테스트 + M0264-01~06 · `app/harnesses/registry.test.ts:creates exactly the registered adapters, keeps Claude active, and closes each owner` + M0264-13 | — |
| VP10 AR01↔IT01 | PASS | EP01 6표면 실제 진입점 + EP03 | — |
| **VP11 AR02↔IT02** | **PAIR_FAIL** | adapter 등록·parser·user-settings·deploy·permission 좌표는 통과. **settings loader 주입 edge는 좌표 없음** — M0264-14b green | plan §11 `app/harnesses/** — adapter·loader/parser·user-settings·native 배포 조립` |
| VP09 SD01↔ST01 | PASS | VP04~07 좌표 | CUA 관측은 기계 검증 범위 밖 |
| VP01 R01~02↔AT01~02 | PASS | EP01 6표면 + 등록 변이 6/6 | HEAD에서 settings 표면은 0262 ΔV18이 제거(아래) |
| VP02 R03~05↔AT03~05 | BLOCKED_BY:VP11 | parser·등록·permission 좌표 통과, AC4 "하네스 parser/policy 주입"의 loader 정책 부분이 VP11 root에 묶임 | — |
| VP03 R06↔AT06 | PASS | VP12와 공유 증거 + exhaustiveness TS1360 | — |
| VP04 R07↔AT07 REGRESSION | PASS | `ChatTile.composerLifetime`·`NewChatLandingPage.harness`·`Composer.approvalQueue`·`EngineFormModal.import` | — |
| VP05 R08↔AT08 REGRESSION | PASS | `Composer.approvalQueue` 3케이스·`TodoDock.integration/render`·`ScrollController.interaction`·`Timeline.selection` | — |
| VP06 R09↔AT09 REGRESSION | PASS | `rightPanelTiles.render`·`opencode/rightpanel/Panel.render`·`navigation`·`TilePanel.detail` | — |
| VP07 R10↔AT10 REGRESSION | PASS | `bootstrap.shutdown` 4·`runtime-catalog` 3·`resolve-turn.runtime-catalog`·`opencode/v1/adapter` 3·`resolve-turn.agent` 3 | — |
| VP08 R11↔AT11 | PASS | `PlanTile.tsx`·`htmlRegion.testlib` 참조 0(`rg`) · `plan0215.render`·`diffTile.render` 통과 · build 통과 | — |

- HEAD 대조: `settings/common/components/HarnessSettingsTab.save.test.ts`와 settings registry는 이후 `7edd119c`(0262 ΔV18 — 설정의 하네스 탭 제거, 사용자 요구)에서 삭제됐다. 0264 주장은 940bd44에서 재측정해 PASS로 둔다. `EngineFormModal.import`의 stale 케이스는 HEAD에서 `…after the selected harness modal is replaced: %s`로 이름이 바뀌어 통과한다.
- §10 분모 재측정: 28자리 + VP11 경로의 loader 주입 edge 1 = 29. 닫힘 28/29.

### AT / AC 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1·AC2·AC3·AC5·AC6·AC7~AC11 | ✅ ×10 | 위 pair |
| AC4 | ⚠️ | parser 주입은 확인, loader 정책 주입은 oracle 없음(D-0264-1) |

- 합계: `✅ 10 · ⚠️ 1 · ❌ 0 = 11`. 자기보고 `11/11`, 커밋 `c43bf948`·`940bd44e` trailer `Criteria-Met: 11/11`, INDEX `AC11/11` — 사본은 서로 일치, 검증 결과와는 AC4에서 갈림.

## 6. 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| readonly ESLint (HEAD) | PASS | 1,731파일 · error 0 · warning 6 — react-refresh 4건(`claude/composer/Module.tsx:11`·`opencode/composer/Module.tsx:13`·`registries/composer.tsx:10`·`common/transcript/TranscriptRuntime.tsx:13`)은 0264가 만든 파일(N-0264-3) |
| typecheck 3구성 (HEAD) | PASS | exit 0 |
| production build (HEAD) | PASS | 기존 SubAgentTaskDetail 혼합 import 경고 1 |
| 관련 Vitest | PASS | 940bd44 30파일 304/304 · HEAD 전체 7,383 통과 · 실패 0 |
| scripts | PASS | 142/142 (boundary 8 포함) |
| 원격 Windows CI | PASS | GitHub Actions run 38766807963(#765, `c43bf948`) success · 38768177583(#766, `940bd44e`) success |
| 문서 inventory·링크·diff | PASS | `check-doc-inventory --check` ok · `git diff --check` 0 |

## 7. Repository operation

- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 Claude 일치. 대상 커밋을 검증자가 기입한다(전부 `git cat-file -t` = commit, 공유 브랜치 ancestor).
- trailer: `b8b7c30e`·`2b548cf0`·`c43bf948`·`940bd44e` 파싱·허용값 정상(`partial`+`Criteria-Pending` 포함).
- `[구현자 기입]` 7필드 전수 존재.
- plan 메타 `상태`가 `READY`로 남음(N-0264-4).

## 8. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D-0264-1 | `app/harnesses/registry.ts:41-49` `createHarnessSettingsService`의 하네스별 loader 주입이 어떤 oracle에도 없다. OpenCode loader를 빼면 OpenCode 실행 준비가 provider 설정 없이 진행되지만 main 4,051케이스 green | VP11 / plan §11 "loader/parser 조립" / AC4 | **BLOCKING** | 구현: 실제 `createHarnessSettingsService().resolve()`가 하네스별 loader 결과를 내는 직접 oracle 추가(HEAD 기준) |
| N-0264-1 | production 소비자 없는 pass-through: `registries/composer.tsx` `approval`+`ToolApprovalBody`(→`ApprovalCard` 재수출, 테스트만 사용) · `lib/rightPanelTiles.ts` `RIGHT_PANEL_POLICY` 재수출 | D07·§15 "소비자가 있을 때만 wrapper" | NON_BLOCKING | 제거 또는 사용처 명시 |
| N-0264-2 | `features/harnesses/{claude,opencode}/model-policy.ts` 정책 코드 동일 | D07 | NON_BLOCKING | 의도된 소유 분리면 기록 |
| N-0264-3 | 0264가 만든 파일의 react-refresh 경고 4건 | lint warning | NON_BLOCKING | 비컴포넌트 export 분리 후보 |
| N-0264-4 | plan 메타 `상태 | READY` | 상태 사본 | NON_BLOCKING | 다음 구현 턴에 갱신 |
| N-0264-5 | 이동 전 경로의 본문 인용 잔존: `docs/GLOSSARY.md`(`adapters/claude-map.ts`·`adapters/descriptor.ts`), `docs/IPC_CONTRACT.md`·`docs/claude-code-spec.md`·`docs/claude-taskxxx-spec.md`(`adapters/claude-map.ts`), `docs/guides/workspace-isolation-permissions.md`(`adapters/claude.ts`). 링크가 아니라 inventory 링크 검사는 통과 | §18 문서 영향 | NON_BLOCKING | 경로 정정 |

## 9. Review Signals — 사실만

- 첫 검증이다. 구현 보고는 EP02.2를 "settings parser"로만 세었고 같은 조립 호출의 loader 맵은 세지 않았다 — 0264 이전 bootstrap에서도 이 맵은 테스트가 없었다.
- 반복 환경 한계 없음(Electron 바이너리 부재로 16파일 1차 로딩 실패는 설치 후 해소, 0003 F-4 참조).

## 10. 결론

- 상태: **FAIL** — REQUIRED/REGRESSION 13 중 PASS 11 · root PAIR_FAIL 1(VP11) · BLOCKED_BY 1(VP02→VP11) · PLAN_GAP 0.
- AC: ✅10 · ⚠️1 · ❌0. 운영 gate PASS(원격 CI #765·#766 포함).
- 다음 단계: 구현자 r2 — D-0264-1 oracle 추가. 0264 코드는 이후 0262/0263/0265가 계속 변경했으므로 HEAD에서 보완한다.

---

# r2 검증

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `c37553b3..e024b87c` — r2 구현 `ce7aa102`, 기록 `7be5d723`. 같은 범위의 0262/0265 공통 커밋 `eb333bff`·`6492828c`·`3e9cbf86`·`e7645433`·`e024b87c`도 HEAD에 포함 |
| 구현 전 plan 기준 | `b8b7c301`(V1) — r1 기준 그대로, r2 설계 커밋 없음. r1 본문의 `b8b7c30e`는 오기(실재 `b8b7c301`) |
| V mode / 유효 V | Baseline V1 |
| 검증 HEAD | `e024b87c` (= `origin/codex-opencode-harness`) |
| 라운드 | 2 |
| 상태 | **PASS** — VP11 root 해소, PAIR_FAIL 0 · PLAN_GAP 0 |
| 자기 검증 여부 | 구현 Codex · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 (r2)

- 구현 커밋의 `plan.md` 변경: 삭제 1줄(메타 `상태`), 추가는 `[구현자 기입]` r2 7절뿐(`git diff c37553b3 e024b87c -- …/plan.md`). Decision·AC·V·§10 변경 없음.
- 채점 기준: r1 §0 그대로 + D-0264-1 대응 방향(실제 `createHarnessSettingsService().resolve()`의 하네스별 loader 결과 직접 oracle).

## 2. 비판적 읽기 (r2)

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 loader oracle이 production 경로에 진입하는가 | 예 | `app/harnesses/registry.test.ts:resolves each registered native loader without mixing harness policies` — `vi.mock` 0, 실제 `createHarnessSettingsService(root)`→`HarnessSettingsService.resolve`→하네스 loader→임시 `sources/settings/<h>/fixture/settings.json` |
| 두 loader를 구별하는가 | 예 | 같은 입력에서 Claude는 `permissions.defaultMode` 제거, OpenCode는 원문 유지 → 맞바꿈 양방향 red(§4) |
| r2 renderer 분해(`Requests.tsx`·`AboveInput.tsx` 분리, `composer.ts`·`TranscriptRuntime.ts` 확장자) | 동작 보존 | r1 red 등록 변이 M01~04·06·08·09가 전부 red 유지, 전체 Vitest 실패 0 |
| N-0264-1 미사용 wrapper 제거 | 정상 | `rg 'ToolApprovalBody|RIGHT_PANEL_POLICY' app/src/renderer` production 재수출 0 — 각 하네스 `Requests.tsx`/`RequestDock.tsx`가 자기 `ToolApproval`을 직접 렌더 |

## 4. 적대 증거 재측정 (r2)

실행기: scratchpad `mut.mjs` — 변이 1건 적용 → 지정 범위 `vitest --reporter=json` → 원본 bytes 복원·SHA256 일치 확인. 모든 변이 후 `restored=true`.

| 변이 | 범위 | r1 | r2 | 귀속 |
|---|---|---|---|---|
| M0264-14b settings loader 맵에서 OpenCode 제외 | `src/main` | **green**(4,051) | **red** 1/4,057 — 위 loader oracle `expected undefined to match object` | D-0264-1 인용 |
| M0264-14c 모든 하네스가 Claude loader | `src/main` | — | **red** 1/4,057 | 형제 맞바꿈(독립) |
| M0264-14d 모든 하네스가 OpenCode loader | `src/main` | — | **red** 1/4,057 — `not to have property "defaultMode"` | 형제 맞바꿈(독립) |
| M0264-13 adapter registry가 OpenCode 미생성 | `app/harnesses` | red | **red** 1/21 | 덮개 유지 |
| M0264-01 composer registry 맞바꿈 | chat·pages | red | **red** 18/2,092 | VP01 등록 |
| M0264-02 transcript 맞바꿈 | chat·pages | red | **red** 17/2,092 | VP01 등록 |
| M0264-03 rightpanel 맞바꿈 | chat·pages | red | **red** 25/2,092 | VP01 등록 |
| M0264-04 engine configuration 맞바꿈 | engine·pages | red | **red** 20/63 | VP01 등록 |
| M0264-06 landing 맞바꿈 | chat·pages | red | **red** 3/2,092 | VP01 등록 |
| M0264-08·09 status·assistant 맞바꿈 | chat | red | **red** 14·11/2,081 | 독립 |
| M0264-10 `harness/ownership` off | `scripts/harness-boundary.test.mjs` | red 3/8 | **red** 3/8 — 복원 후 8/8 | VP03/12 |
| M0264-05 settings registry · M0264-07 approval 맵 | — | red · green | 해당 없음 — settings registry는 0262 ΔV18이 삭제, approval 맵은 N-0264-1로 제거 | — |

- 덮개 회귀(r1 red → r2 green): 0건.
- 인용 변이 1/1 검출 → D-0264-1 closed.

## 5. V-pair closeout (r2)

| Pair | r2 결과 | 근거 |
|---|---|---|
| VP11 AR02↔IT02 | **PASS** | loader 주입 edge = 위 loader oracle + M14b·14c·14d red. parser·user-settings·deploy·permission 자리는 r1 좌표(`implementation-evidence.md`) 그대로 통과 |
| VP02 R03~05↔AT03~05 | **PASS** | r1 `BLOCKED_BY:VP11` 해소 — AC4 parser·loader 주입 모두 좌표 있음 |
| VP12·VP13·VP10·VP09·VP01·VP03·VP04~08 | PASS (r1 좌표) | r1 §5 좌표 실재·HEAD 전체 실행 통과 · 영향받은 VP01/04/05(composer 분해)는 §4 등록 변이 red로 재확인 |

- §10 분모: r1 재측정 29 = 28 + loader 주입 edge 1 → 닫힘 29/29.
- 실행 범위: 재검증 — root VP11·종속 VP02·r2 분해 영향 VP01/04/05 + 운영 gate. 나머지는 r1 좌표 참조(좌표 없이 난 PASS 없음).

### AC 합계 (r2)

- `✅ 11 · ⚠️ 0 · ❌ 0 = 11` — r1 ⚠️ AC4가 ✅로.
- 사본 대조: 본문 r2 `✅11` ↔ 커밋 `ce7aa102`·`7be5d723` trailer `Criteria-Met: 19/21`(0262 3 + 0263 2 + 0264 11 + 0265 5 합산) — 0264 몫 11/11 일치.

## 9. 게이트 (r2) — HEAD `e024b87c`

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck node/web/test | PASS | `npm run typecheck` exit 0, `error TS` 0 |
| readonly ESLint (`eslint ./src ./scripts`, `--fix` 없음) | PASS | 1,734파일 · error 0 · warning 2(TanStack `incompatible-library` — `opencode/transcript/Timeline.tsx:49`·`hooks/useTranscriptVirtualizer.ts:22`). r1의 react-refresh 4건 해소(N-0264-3) |
| production build (`npx electron-vite build`, ABI 훅 없이) | PASS | main 378 · preload 3 · renderer 1,820 modules, exit 0 — 기존 `SubAgentTaskDetail.tsx` 혼합 import 경고 1 |
| 전체 Vitest (Linux, Node ABI) | PASS | 754파일 · 7,404케이스 = 통과 7,397 · skip 7 · 실패 0 |
| scripts `node --test scripts/*.test.mjs` | PASS | 142/142 (harness-boundary 포함) |
| doc inventory·migration·test-budget·`git diff --check` | PASS | `check-doc-inventory --check` ok · migrations sync ok · 16 real-git suites ok · diff check 0줄 |
| 원격 Windows CI | PASS | run 38985768857(#788, `e024b87c`) success — Vitest 754파일 7,402 통과·2 skip, scripts 142/142 |

- 게이트가 작업 트리를 바꿨는가: 아니오 — ESLint는 `--fix` 없이 실행, 모든 변이 후 `git status` clean.

## 11. Repository operation checks (r2)

- INDEX 0264 행: `impl/IMPL_DONE`·다음 Claude·라운드 2 일치. 대상 커밋 `ce7aa102`(r2)·`7be5d723`(기록) 기입(`git cat-file -t` commit, 공유 브랜치 ancestor).
- r1 메타·INDEX의 V1 설계 해시 `b8b7c30e`는 실재하지 않는다 — 실재 `b8b7c301`로 archive 행을 적었다.
- trailer: `ce7aa102`·`7be5d723` 각 9키 파싱 · 허용값 정상(`partial`+`Criteria-Pending`, `implemented`).
- `[구현자 기입]` r2 7필드 전수 존재.
- plan 메타 `상태` 갱신(N-0264-4 closed).

## 13. Finding disposition (r2)

| # | finding | disposition |
|---|---|---|
| D-0264-1 | settings loader 주입 edge oracle 부재 | **closed** — 인용 변이 M14b red, 형제 맞바꿈 2건 red |
| N-0264-1 | 미사용 approval 맵·재수출 | closed — 제거, 재수출 0 |
| N-0264-2 | 두 `model-policy.ts` 동일 코드 | 유지 — 구현자가 하네스별 정책 소유로 기록(맞바꿈은 등가) |
| N-0264-3 | react-refresh 경고 4 | closed — 경고 2(TanStack, 0264 무관)만 남음 |
| N-0264-4 | plan 메타 상태 | closed |
| N-0264-5 | 이동 전 경로 인용 | 목록 5파일 closed. **형제 1건 잔존**: `docs/spec/AGENTS.md:34`의 `app/src/main/adapters/claude.ts`(실제 `adapters/claude/adapter.ts`) — 같은 파일을 `c43bf948`이 수정했으나 경로는 남김. NON_BLOCKING |

## 14. Review Signals (r2)

- 이전 라운드와 같은 축: D-0264-1 1건만 재구현, 새 증상 없음.
- 반복 환경 한계: 없음(검증 환경에서 Electron 바이너리·Node ABI SQLite 모두 설치됨).

## 15. 결론 (r2)

- 상태: **PASS**.
- pair: REQUIRED/REGRESSION 13 PASS · PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0.
- AC: ✅11 · ⚠️0 · ❌0. 운영 gate PASS(원격 CI #788 포함).
- NON_BLOCKING: N-0264-5 형제 1건(`docs/spec/AGENTS.md:34`).
- 다음 단계: INDEX 행을 archive로 이동.
