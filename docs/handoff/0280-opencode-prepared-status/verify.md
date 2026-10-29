# Verify — 0280-opencode-prepared-status

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0280-opencode-prepared-status` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `faf39d5..cab3d1e` · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | `faf39d5` |
| V mode / 유효 V | Baseline V / V1 |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — §10 고정 13자리 중 EP2 prepare resolver(단계 라벨)·EP3 adapter plugin reader(실행 env 운반)·EP4 공통 view(draft 오류 버튼)에서 심은 고장이 green이었다.** 취소/오류 구분·비밀 차단·독립 MCP/plugin 캐시·첫 입력 전 패널 표시는 잠겼다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `cab3d1e`의 `plan.md` 변경: 메타 상태와 `[구현자 기입]`의 "대기." 자리 채움만(`git diff faf39d5 cab3d1e -- …/plan.md`의 `-` 줄은 상태 1줄·"대기." 7줄).
- 기준선 diff 성립: 예(`faf39d5`).
- 이후 `087543e`가 D3을 "팝업 안내 금지 · 스피너 예외는 0281 D5"로 정정 — 0281 사용자 annotation(2026-10-22) 인용, 구현자 변경 아님.
- 채점 기준: `faf39d5`의 AC1–5·VP1–5·§10 13자리 + `087543e`의 D3 정정.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V | 유효 | 모든 노드 NEW, pair REQUIRED |
| NEW node ↔ REQUIRED pair | 유효 | VP1–VP5 |
| §10 자리 목록 | 유효 | 기록된 4개 `rg` 재실행: EP1 shared type·protocol enum·preload(+renderer API) / EP2 `composer-catalog.ts:prepareComposerCatalog`·owner read·handler catch / EP3 native-resources reader·composer-cache·adapter readers / EP4 state·hook·tile 등록/wrapper·공통 view — 목록 밖 운반 자리 0 |
| 선택 적대 증거 | 유효 | "선택 mutation 없음 — 직접 결과" |
| 운영 gate | 유효 | Vitest·typecheck 3종·lint·build·문서 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path |
|---|---|---|
| D1 | 첫 입력 전 패널에 준비된 instance의 MCP/plugin | `tileRegistry.nativeStatus` → `OpenCodeNativeResourcesTile`(sessionId 없음) → `useComposerCatalog(providerKey, true)` → `subscribeResources` → IPC `mcp`/`plugins` part → `OpenCodeComposerCache.mcp/plugins` |
| D2 | 기존 lease·owner·독립 조회 유지 | `ComposerCatalogOwners.read` → `lease.read(part)` |
| D4 | 정상 취소 무로그, 실패는 stage·reason·httpStatus만 | `ComposerCatalogCancelled` / `ComposerCatalogError.failure` → handler `warn('opencode.catalog.failed', …)` |
| D6 | 읽기 전용·scope 전환 폐기·첫 전송 후 runtime 경로 | `preparedResourcesView` `canToggle:false` · scope key별 state · `sessionId ? NativeResourcesTileContent : Draft` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | ✅ | renderer는 `'status' in result`(cancelled/error)를 빈 성공으로 저장하지 않음(`composerCatalogState.ts:92-97`) |
| 비밀 노출 | ✅ | failure는 allowlist 3필드, 원문 message 미보존(`composer-catalog-error.ts`) |
| 부분 실패 | ✅ | 성공 slot 값 보존 + `partial:true` |
| 진단 정확성 | ⚠️ | `acquire`/`configuration` 단계 래핑을 지워도 `owner`로 떨어질 뿐 green(N6) — 원격 진단 레코드의 단계가 틀려도 잡히지 않음 |
| 실행 env | ⚠️ | plugin 설치 해석에 쓰는 `req.env` 운반을 지워도 green(N9) |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 |
|---|---|---|
| `ComposerCatalogData` 확장의 기존 소비처 | 정상 — `Controls`는 agents/models만, 패널만 mcp/plugins 구독(`subscribeResources`) | — |
| `openCodeNativeResources`의 throwOnError 변경 | 정상 — runtime 경로도 `data` 부재 시 throw 유지 | — |
| 계획 oracle `composer-preparation.test.ts`·`Controls.integration.test.ts` | 부재, 구현 보고가 `app/composer-catalog.test.ts`·`NativeResources.test.ts`로 대체를 명시 | 비귀속 |

## 4. 고장 내 보기

- 등록 변이 0. §10 자리별 재량 고장. main은 Linux에서 `C:/` fixture·win32 gate로 15건이 기준선 red라 그 이름을 제외하고 판정했고, 그중 `app/composer-catalog.test.ts`(4건)는 Windows 경로 의미 shim(검증자 전용 setup — `node:path`→`win32`, `process.platform='win32'`)으로 기준선 22/22 green을 만든 뒤 다시 실행했다(`…w` 행).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| N1 | `shared/protocol.ts:412` | 제거 | part enum에서 `'mcp'` 제거 | 잡음 | `handlers/composer-catalog.test.ts: returns read-stage HTTP diagnostics…` | EP1 |
| N3 | `app/composer-catalog-owner.ts:99` | 제거 | aborted→`ComposerCatalogCancelled` 분기 삭제 | 잡음 | `…releases acquisitions completing after close…`·`silently cancels an in-flight metadata read…` | EP2 owner |
| N5 | `app/composer-catalog-error.ts:29` | 다른 값 | failure에 `detail: String(value.message)` 추가 | 잡음 | `composer-catalog-error.test.ts`·handler 2건 | EP2 handler |
| N6 | `app/composer-catalog.ts:54` | 제거 | prepare 실패의 `ComposerCatalogError('acquire')` 래핑 → 원 오류 재throw(→`owner`) | **못 잡음** (main·shim 모두) | — | EP2 prepare resolver · VP5 |
| N7 | `opencode/v1/composer-cache.ts:36` | 맞바꿈 | `mcp()`가 `pluginSlot` 사용 | 잡음 | `session-context.test.ts: shares resource flights per directory…` · shim `composer-catalog.test.ts` | EP3 cache |
| N8 | `opencode/v1/adapter.ts:108` | 맞바꿈 | readers `mcp: lease.plugins` | 잡음(shim) | shim `composer-catalog.test.ts: returns prepared plugin and agent parts…` | EP3 adapter |
| N9 | `opencode/v1/adapter.ts:109` | 빈 값 | plugins reader env `{...process.env, ...req.env}` → `process.env` | **못 잡음** (main·shim 모두) | — | EP3 adapter readers · VP4 |

renderer(EP4) — 범위 `features/chat`+`features/skills` 288파일/2271케이스.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| R1 | `rightpanel/preparedResourcesView.ts:16` | 다른 값 | `canToggle: false` → `item.canToggle` | 잡음 | `preparedResourcesView.test.ts: keeps native status authoritative…` | EP4 wrapper |
| R2 | `preparedResourcesView.ts:19` | 고정값 | `canOpen` fallback 대조 제거 → `kind === 'mcp'` | 잡음 | 같은 테스트·`NativeResources.test.ts: renders prepared plugins…` | EP4 wrapper |
| R3 | `preparedResourcesView.ts:27` | 제거 | `partial` 표식 삭제 | 잡음 | `…replaces successful empty parts…` | EP4 wrapper |
| R4 | `rightpanel/NativeResources.tsx:12` | 호출 대체 | sessionId 있어도 draft 표시 | 잡음 | `NativeResources.test.ts: …delegates after the first message` | EP4 등록 |
| R5 | `composer/useComposerCatalog.ts:39` | 호출 대체 | resources 구독 대신 일반 subscribe | 잡음 | `NativeResources.test.ts` 2건 | EP4 hook |
| R6 | `NativeResources.tsx:34` | 제거 | refresh의 `retry('plugins')` 삭제 | 잡음 | `…supports retry without restart…` | EP4 wrapper |
| R7 | `composer/composerCatalogState.ts:94` | 다른 값 | cancelled/error 결과 → `{status:'ready', value:[]}` | 잡음 | `composerCatalogState.test.ts: does not turn a cancelled/error outcome into a successful empty catalog` | EP4 state |
| R8 | `components/rightpanel/NativeResourcesTile.tsx:106` | 제거 | `!refreshable` 조건 삭제 — draft 오류에 고정 새로고침과 별도 재시도 버튼이 함께 표시 | **못 잡음** | — | EP4 공통 view · VP1 |
| R9 | `lib/nativeResourcesMenu.ts:23` | 제거 | `canOpen===false`의 `disabled` 삭제 | 잡음 | `NativeResources.test.ts: renders prepared plugins…` | EP4 view |
| R10 | `composerCatalogState.ts:62` | 제거 | `subscribeResources`의 `read('mcp')` 삭제 | 잡음 | `composerCatalogState.test.ts`·`NativeResources.test.ts` 2건 | EP4 state |

- 검산: 시도 17(main 7 + renderer 10) = 잡음 14 · 못 잡음 3(N6·N9·R8) · 동치 0. 못 잡음 3건은 모두 §10 고정 자리 → §13 D1–D3.
- 형제 슬롯 맞바꿈: N7(mcp↔plugin slot)·N8(mcp↔plugins reader) — 둘 다 잡음.

## 5. V-pair closeout

| Pair | 레벨 | 결과 | 증거 |
|---|---|---|---|
| VP4 | UT | **PAIR_FAIL** | N7 잡음, N9 못 잡음(adapter plugin reader의 env 운반 미잠금) |
| VP5 | UT | **PAIR_FAIL** | N5 잡음, N6 못 잡음(acquire 단계 라벨 미잠금) |
| VP3 | IT | PASS | N1·N8 잡음, preload `index.test.ts` 왕복 |
| VP2 | ST | PASS | N3·N7 잡음 |
| VP1 | AT | **PAIR_FAIL** | EP4 공통 view의 draft 오류 버튼 조건이 R8로 미잠금. AC4의 "단계" 기록은 VP5 root |

- 실행 구간: `app/composer-catalog.test.ts`는 실제 `prepareComposerCatalog`·`registerComposerCatalogHandlers`·`OpenCodeAdapter`를 SDK transport fixture로 조립. Linux에서는 `C:/` 절대경로 검사 때문에 기준선 red → 검증자 shim으로만 관측(Windows CI #853에서는 green).

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 첫 입력 전 plugin·동적 MCP | ✅ | `NativeResources.test.ts: renders prepared plugins before MCP…`, N7·N8 |
| AC2 느린 MCP/model이 plugin/agent를 막지 않음 | ✅ | 같은 테스트의 pending `mcp` 동안 Superpowers 표시 |
| AC3 합류·정리·scope 격리 | ✅ | `discards the previous directory…`, N3 |
| AC4 취소/실패 구분·단계·비밀 | ❌ | 취소·비밀은 N3·N5로 잠김, "실제 오류는 단계/고정 분류"의 단계가 N6으로 미잠금 |
| AC5 팝업 무안내·draft 읽기 전용·첫 응답 후 기존 패널 | ✅ | `NativeResources.test.ts` `[role="switch"]` 없음·live-mcp 위임 |

- 합계 재측정: `✅ 4 · ❌ 1 = 5`. 자기보고 `Criteria-Met: 5/5`(trailer)·본문 `✅5` → 불일치(AC4).

### §10 분모

| EP | 자리 | 결과 |
|---|---|---|
| EP1 (3) | type·enum·preload/API | PASS (N1) |
| EP2 (3) | prepare resolver · owner · handler | 2/3 — prepare resolver PAIR_FAIL(N6) |
| EP3 (3) | SDK readers · cache · adapter readers | 2/3 — adapter readers의 env 항 PAIR_FAIL(N9) |
| EP4 (4) | state · hook · wrapper · view | 3/4 — 공통 view의 refreshable 오류 분기 PAIR_FAIL(R8). state(R7·R10)·hook(R5)·wrapper(R1–R4·R6) 잠김 |

### 운영 gate

[0281 verify §운영 gate](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 같은 HEAD 실행이다 — typecheck 0 error · lint 0 error/2 기존 warning · renderer 374/3060 green · main 15건 Windows 전용 red · Windows CI #853 success · 문서 gate green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 다른 PC의 원본 `orca:composer:catalog` 오류 원인 | 취소/오류 분리·진단 레코드 형식 | 재발 시 `opencode.catalog.failed` 레코드 확인 |
| 첫 입력 전 패널 시각 | DOM 내용·버튼 | 실제 창 두 테마 |

## 11. Repository operation checks

- 대상 커밋: `faf39d5`(설계)·`cab3d1e`(r1) — `git cat-file -t` = commit.
- trailer: `cab3d1e` 5키 파싱. 이 커밋의 Windows CI(run 39713649718)는 failure였고, 이후 `e4853cb`가 fixture를 보완해 HEAD 코드는 #853 green.
- `[구현자 기입]` 7필드 존재, 강제 지점 표 13자리 행 존재.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | N6: prepare 실패의 `acquire` 단계 래핑을 지워도 green(같은 형태의 `configuration` 래핑은 0276 검증에서 N6b로 측정) | EP2 prepare resolver · AC4 · VP5 | BLOCKING (PAIR_FAIL) | prepare/resolve 실패의 `failure.stage` 단언 |
| D2 | N9: plugin reader의 `req.env` 운반을 지워도 green | EP3 adapter readers · VP4 | BLOCKING (PAIR_FAIL) | process.env와 다른 provider env로 plugin 설치 해석을 관측 |
| D3 | R8: `NativeResourcesTileView`의 `!refreshable` 조건을 지워도 green(draft 오류에 버튼 2개) | EP4 공통 view · VP1 | BLOCKING (PAIR_FAIL) | refreshable 오류 상태의 버튼 구성 단언 |

## 14. Review Signals

- 이전 라운드 동일 증상: 해당 없음(첫 verify).
- 구현 커밋 당시 CI red(run 39713649718) → 후속 0278 커밋에서 fixture 보완.
- 반복 환경 한계: Linux에서 `C:/` 절대경로 fixture가 red — 검증자 shim으로 우회 관측.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 2(VP2·VP3) · root PAIR_FAIL 3(VP1·VP4·VP5) · BLOCKED_BY 0.
- PLAN_GAP: 없음. AC ✅4 · ❌1 / 5.
- 다음 단계: Codex r2 — D1–D3, 다음 verify는 고장 이력 N6·N9·R8 재실행.

---

# r2 재검증 (2026-10-23)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `32b43cc..e42d1e2` 중 0280: `ef43daf`(r2 — 테스트 2파일) |
| 구현 전 plan 기준 | r1과 같음 — `ef43daf`의 `plan.md` `-` 줄은 메타 상태 1줄 |
| V mode / 유효 V | Baseline V / V1 |
| 라운드 | 2 (verify 2회째) |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude |

**PASS — r1 미검출 3개(N6·N9·R8)가 모두 잡히고 r1 잡음 14개도 유지된다.** production 무변경 테스트 보강 라운드다.

## r2-0. 기준선 / plan validity

- 앱 변경은 테스트 22파일뿐(production 0) — §10 13자리와 경로는 r1과 같다.
- 새 oracle 실행 구간: `composer-catalog.test: preserves the %s failure stage…`는 등록 IPC handler → 실제 resolver → owner → handler를 지난다. `reads installed plugin metadata…`는 임시 provider cache에 설치한 `package.json`을 실제 SDK config → adapter plugin reader로 읽는다. `NativeResources.test: offers only the fixed refresh button…`은 등록 타일부터 렌더한다.
- 운반 값 구별: provider cache 경로가 `process.env`와 다르게 주어져 `req.env` 항 제거(N9)가 관측을 바꾼다.

## r2-4. 고장 재실행

- main은 `src/main src/shared src/preload`(Linux 기준선 17 red, Windows 전용). Windows 전용 `composer-catalog.test.ts`는 검증자 win32 shim(`…w`)으로 다시 쟀다. shim 기준선 7케이스 중 1건(`reads installed plugin metadata…`)은 shim의 tmpdir 경로 부산물로 red라 그 이름을 빼고 판정했다 — 같은 테스트는 Linux와 Windows CI #857에서 green이다.

| ID | r1 | r2 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|
| N1 | 잡음 | 잡음 | `handlers/composer-catalog.test: returns read-stage HTTP diagnostics…` | EP1 |
| N3 | 잡음 | 잡음 | `handlers/composer-catalog.test: releases acquisitions completing after close…` 외 1 | EP2 owner |
| N5 | 잡음 | 잡음 | `composer-catalog-error.test`·handler 2건 | EP2 handler |
| N6 | 못 잡음 | **잡음(shim)** | `composer-catalog.test: preserves the acquire failure stage through the registered catalog handler` | EP2 resolver · D1 |
| N6b | 못 잡음(0276 기록) | **잡음(shim)** | `…preserves the configuration failure stage…` | EP2 resolver 형제 |
| N7 | 잡음 | 잡음 | `session-context.test: shares resource flights per directory…` | EP3 cache |
| N8 | 잡음(shim) | 잡음(shim) | `composer-catalog.test: returns prepared plugin and agent parts…` | EP3 adapter |
| N9 | 못 잡음 | **잡음** | `composer-catalog.test: reads installed plugin metadata using the resolved provider cache environment`(Linux) | EP3 adapter readers · D2 |
| R1–R7·R9·R10 | 잡음 | 잡음 | `preparedResourcesView.test`·`NativeResources.test`·`composerCatalogState.test` (r1과 같은 축) | EP4 |
| R8 | 못 잡음 | **잡음** | `NativeResources.test: offers only the fixed refresh button when both prepared and configured draft reads fail` | EP4 view · D3 |

- 검산: 시도 18(main 8 + renderer 10) = 잡음 18 · 못 잡음 0 · 동치 0. r1 못 잡음 3(+0276의 N6b) → 잡음, r1 잡음 14 → 잡음(덮개 회귀 0).

## r2-5. V-pair closeout

| Pair | 레벨 | r1 | r2 | 증거 |
|---|---|---|---|---|
| VP4 | UT | PAIR_FAIL | **PASS** | N7·N9 잡음 |
| VP5 | UT | PAIR_FAIL | **PASS** | N5·N6·N6b 잡음 |
| VP3 | IT | PASS | PASS | N1·N8 잡음 |
| VP2 | ST | PASS | PASS | N3·N7 잡음 |
| VP1 | AT | PAIR_FAIL | **PASS** | R1–R10 잡음(R8 포함) |

| AC | 결과 | 근거 |
|---|---|---|
| AC1 첫 입력 전 plugin·동적 MCP | ✅ | R2·R4·R9 잡음 |
| AC2 느린 MCP/model 비차단 | ✅ | `NativeResources.test: renders prepared plugins before MCP…`, R5 잡음 |
| AC3 합류·정리·scope 격리 | ✅ | N3·R5·R10 잡음 |
| AC4 취소/실패 구분·단계·비밀 | ✅ | N3·N5·N6·N6b 잡음 |
| AC5 draft 읽기 전용·오류 버튼 하나·위임 | ✅ | R4·R6·R8 잡음 |

- 합계 재측정: `✅ 5 · ❌ 0 = 5`. 자기보고 `Criteria-Met: 5/5`(`ef43daf`) 일치.
- §10: EP1 3/3 · EP2 3/3 · EP3 3/3 · EP4 4/4 = 13/13.
- 운영 gate: [0281 verify r2](../0281-opencode-menu-cache/verify.md#r2-운영-gate-head-e42d1e2)와 같은 HEAD 실행 — typecheck 0 · lint 0 error · renderer 377/3078 · main 17 red 전부 Windows 전용 · CI #857 green.

## r2-11. Repository operation checks

- INDEX: `impl/IMPL_DONE`(r2) → PASS, archive 이동. `ef43daf` `git cat-file -t` = commit, trailer 5키 파싱.
- `[구현자 기입] r2` 7필드, 강제 지점 표가 EP1–EP4 13자리를 담는다.

## r2-13. Finding disposition

| # | r2 상태 | 근거 |
|---|---|---|
| D1 | closed | N6·N6b 잡음(shim, Windows CI #857 green) |
| D2 | closed | N9 잡음 |
| D3 | closed | R8 잡음 |

## r2-15. 결론

- 상태: **PASS** — verify 2회째. pair 5/5 PASS, PLAN_GAP 없음, AC ✅5/5.
- 남은 사람 확인: 다른 PC의 원본 오류 재발 시 진단 레코드, 첫 입력 전 패널 실제 창 시각(AC 밖).

## 후행 재확인 (2026-10-29, 0275~0289 일괄 검증)

- **PASS 유지 — 일부 후행 대체.** 첫 메시지 전 우측 패널 표시는 0286 D-002가 패널을 제거하며 대체했다. 정상 취소와 실패 구분은 0289 AC1~2가 다시 잠갔다(0289 VP01 PASS).
- HEAD `81153e2`에서 전체 vitest를 다시 돌렸다(865파일). Linux 전용 실패 21건은 `C:/` fixture와 `process.platform === 'win32'` 게이트뿐이며, POSIX 경로·win32 강제 미커밋 사본에서 green이고 Windows CI [run 40834862690](https://github.com/muzaby/orca-skin/actions/runs/40834862690)이 success다 — 근거는 [0289 verify §6](../0289-opencode-runtime-retention/verify.md).
