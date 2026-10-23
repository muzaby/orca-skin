# Verify — 0276-opencode-composer-preparation

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0276-opencode-composer-preparation` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `ab20170..26ebee4`(r1) · 검증 HEAD `32b43cc`(이후 0277~0281이 같은 파일을 추가 수정) |
| 구현 전 plan 기준 | V1 `6eeed51` · ΔV1 `aa94696` · ΔV2 `ab20170` · 0281 이관 annotation `087543e` |
| V mode / 유효 V | Baseline V + ΔV1 + ΔV2, 표현 부분은 0281 ΔV1로 SUPERSEDED |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — §10 고정 자리 2곳에서 심은 고장이 green이었다.** 첫 입력 전 독립 준비·창 수명·refresh 교체·선택 agent/variant 전달은 잠겼지만, draft의 provider를 버리는 고장(AC9)과 retired 세대 결과 폐기 삭제(AC6)를 어떤 테스트도 잡지 못한다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `26ebee4`의 `plan.md` 변경: 메타 `구현 상태` 1행과 `[구현자 기입]` 7필드 채움(`git diff ab20170 26ebee4`의 `-` 줄은 `미착수.` 자리표시자뿐).
- 기준선 diff 성립: 예 — V1·ΔV1·ΔV2가 구현과 분리된 설계 커밋. ΔV1·ΔV2 본문이 `[구현자 기입]` 표제 아래에 있으나 설계 커밋(`Status: designed`)으로 들어왔다(관찰 — 설계·구현 연속 수행 지시).
- `087543e`(0278 설계)가 0276 plan의 D9·D10·R7·R10·§5 표현 행을 0281 ΔV1로 SUPERSEDED 표기 — 사용자 결정(0281 D1·D5·D6) 인용, 구현자 변경 아님.
- 채점 기준: `ab20170`의 AC1–10·VP1–7·§10 19자리 + ΔV1 D9 refresh 재해석 oracle. AC7·AC10의 팝업 표현(고정 새로고침·스피너 금지)은 0281로 이관돼 0281 verify가 채점했다 — 여기서는 준비·선택·초점 회귀만 본다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V + ΔV1·ΔV2 | 유효 | ΔV1(R9/AR1/SD1/MD2 CHANGED → VP1·2·3·6), ΔV2(R10/AR2/MD2 → VP1·4·6) REQUIRED 명시 |
| NEW node ↔ REQUIRED pair | 유효 | R1–R10·SD1·AR1–3·MD1–2 ↔ VP1–VP7 |
| SUPERSEDED 이관 | 유효 | 0281 이관 문장이 UI AC·선택 행 증거 → 0281 VP1·VP3·DV1-P1–P3, 준비·캐시·수명 증거 유지 명시 |
| §10 자리 목록 | 유효(관찰 1) | 19자리를 역할로 고정. 기록된 검색 재실행: EP1 `rg composerCatalog`는 `shared/protocol.ts`(schema 자리, 대문자 `ComposerCatalog…Schema`)를, EP2 `rg 'prepareComposer\|composerCatalog' app/src/main`은 `bootstrap.ts`(등록·종료 자리)를 반환하지 않는다. 목록이 역할로 고정돼 있고 검증자가 목록 밖 운반 자리를 찾지 못해 PLAN_GAP 아님. 반환된 추가 파일(`NativeResources.tsx`·`preparedResourcesView.ts`·`composer-catalog-error.ts`)은 0277·0280이 이후 추가한 panel 경로 |
| oracle 좌표 | 유효 | "구현할 테스트" 예정명 3개를 구현자가 실제 파일로 매핑(`composer-preparation`→`adapter.startup`, `Controls.integration`→`Module.integration`, `channel tests`→`adapter.startup/persistent`) — 의미 동일, 모두 실재 |
| 선택 적대 증거 | 유효 | "선택 mutation 없음 — 지연·구별 입력·해제/재진입 직접 단언" |
| 운영 gate | 유효 | lint·typecheck·관련 Vitest·build·문서·trailer |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D1 | OpenCode·작업폴더 확정 시 준비, 앱 선기동 없음 | `useComposerCatalog`가 OpenCode composer 마운트 시 `session.composerCatalog` 호출 → `registerComposerCatalogHandlers` → `prepareComposerCatalog` |
| D2·D3 | `/agent` visible primary가 정본, agent/provider 독립 | `composer-cache.ts` part별 flight, `session-context` agents가 config·commands·SSE 선행 없음 |
| D4 | 세대별 캐시·single-flight | `ComposerCatalogState` 같은 scope 구독 공유, main owner의 pending acquisition 합류 |
| D5 | 준비·세션이 directory 사용권 공유, 마지막 해제 정리 | `ComposerCatalogOwners.release` → lease.release → 0275 instance refs |
| D6 | 오류·취소·늦은 응답 격리, 빈 성공만 선택 정리 | handler `cancelled`/`error` 응답, state `retired` 집합, Controls stale agent 제거는 authoritative 빈 성공에서만 |
| D7·D9 | 재시도는 읽기 재검증, refresh는 resolver 재해석 후 새 lease→이전 반납 | `ComposerCatalogOwners.read` refresh 분기(`adopt` acquire-before-release) |
| D8 | agent만 고르면 agent만 대기, variant 명시 시 모델 검증 | `channel.ts` `next.modelVariant ? connection.models(signal) : undefined` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | ✅ | 실패를 빈 목록으로 바꾸지 않음 — handler가 `{status:'error', failure}`·`{status:'cancelled'}`로 구분(`handlers/composer-catalog.ts:47-56`) |
| pending lease 누수 | ✅ | 해제가 pending acquisition을 abort하고, 늦게 끝난 acquisition은 `adopt`가 즉시 반납(`composer-catalog-owner.ts:110-114`) |
| refresh 실패 | ✅ | 실패 시 `owned.task = previous`로 이전 lease 유지(`:75-79`) |
| 창 수명 | ✅ | `destroyed`·`render-process-gone`·main frame 이동에서 sender owner 일괄 해제(`handlers/composer-catalog.ts:18-35`) |
| 늦은 invalidation | ✅ | state가 retired generation 결과를 버림(`composerCatalogState.ts` `retired.has`) |
| 비밀 노출 | ✅ | renderer DTO는 scope·part·generation·안전 failure만(`shared/composer-catalog.ts`) |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `registerComposerCatalog`는 `bootstrap.ts`가 호출, `ComposerCatalogOwners`는 handler가 생성 |
| 동명 로컬 재구현 | 없음 | 잡은 테스트가 production handler·resolver·state를 직접 조립(§4) |
| 후속 handoff 표면 | 관찰 | `composer-catalog-error.ts`·panel 구독(`subscribeResources`)은 0280·0277이 추가 — 각 verify에서 채점 |

## 4. 고장 내 보기

- 등록 변이 0("선택 mutation 없음"). §10 자리별 재량 고장.
- 실행: main은 `src/main src/shared src/preload`(기준선 15 red = Windows 전용 fixture), renderer는 `features/chat`. `app/composer-catalog.test.ts` 4건은 `C:/` fixture라 Linux에서 기준선 red — 검증자 전용 win32 shim(경로 의미·platform·`homedir`)으로 그 파일과 `adapter.test.ts`를 다시 실행했고 shim 기준선은 22/22 green이다(`…w` 행).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| Q1 | `app/composer-catalog.ts:22` | 맞바꿈 | 저장 세션 cwd → draft scope cwd | 잡음(shim) | `composer-catalog.test: prepares draft and saved directory with the same production settings…` | EP2 resolver · AC9 |
| Q2 | 같은 파일 `:30` | 빈 값 | `providerKey: scope.providerKey` → `null` | **못 잡음**(Linux·shim) | — | EP2 resolver · AC9 · VP3 |
| Q3 | 같은 파일 `:50` | 빈 값 | `env: resolved.prepared.env` → `{}` | 잡음(shim) | 같음 | EP2 resolver · AC9 |
| N6b | 같은 파일 `:33` | 제거 | `ComposerCatalogError('configuration')` 래핑 삭제 | **못 잡음**(Linux·shim) | — | 0280 D1(단계 라벨) — 0276 계약 밖 |
| Q4 | `handlers/composer-catalog.ts:33` | 제거 | `render-process-gone` 해제 등록 삭제 | 잡음 | `handlers/composer-catalog.test: shares pending acquisition for parts, isolates windows, and releases on navigation/crash/shutdown` | EP2 window lifecycle |
| Q5 | 같은 파일 `:22` | 고정값 | main frame 이동 해제 → `false` | 잡음 | 같음 | EP2 window lifecycle |
| Q6 | `app/composer-catalog-owner.ts:125` | 제거 | refresh 후 이전 lease 반납 삭제 | 잡음 | `handlers/composer-catalog.test: refresh re-resolves and keeps old owner until replacement is ready` | EP2 owner · AC5·AC7 |
| Q7 | `shared/protocol.ts:400` | 다른 값 | release owner `z.uuid()` → `z.string()` | 잡음 | `handlers/composer-catalog.test: validates directory and owner before preparation…` | EP1 schema |
| Q8 | `composer/composerCatalogState.ts:98` | 제거 | retired 세대 결과 폐기 삭제 | **못 잡음** | — renderer 275파일/2198 green. 같은 epoch에서 새 세대 결과 뒤 옛 세대 결과가 오면 새 세대를 은퇴시키는 경로가 남는다 | EP4 state · AC6 · VP6 |
| Q9 | `composer/useComposerCatalog.ts:31` | 빈 값 | 요청 scope `projectId` → `null` | 잡음 | `Module.integration.test: prepares draft agents before providers…` | EP4 hook scope · AC1 |
| Q10 | `composer/Controls.tsx:37` | 맞바꿈 | runtime variants → 정적 catalog variants | 잡음 | 같음 | EP4 variant control · AC1 |
| Q11 | `opencode/v1/channel.ts:148` | 고정값 | variant 없어도 models 대기 | 잡음 | `adapter.persistent.test: carries the selected engine model limit…` 외 25건 | EP5 initial metadata · AC8 |
| Q12 | 같은 파일 `:237` | 제거 | prompt body의 `agent` 삭제 | 잡음 | `adapter.startup.test: reuses draft preparation for a selected-agent first prompt…`·`opencode-runtime.test: forwards changed agent and variant…` | EP5 submit agent |
| Q13 | 같은 파일 `:220` | 빈 값 | command body `agent` → `undefined` | 잡음 | `adapter.persistent.test: dispatches a real native slash command…` | EP5 submit agent |
| Q14 | 같은 파일 `:157` | 고정값 | 제거된 variant 검사 → `false` | 잡음 | `adapter.persistent.test: passes a live plugin agent and drops its removed variant…` | EP5 submit variant |

- 검산: 시도 15 = 잡음 12 · 못 잡음 3(Q2·Q8·N6b) · 동치 0. Q2·Q8은 §10 고정 자리 → `PAIR_FAIL`(§13 D1·D2). N6b는 0280이 도입한 단계 라벨이라 [0280 verify D1](../0280-opencode-prepared-status/verify.md)로 이관.
- 형제 슬롯 맞바꿈: Q1(session↔scope cwd)·Q10(runtime↔catalog variants) 잡음.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP5 | UT | REQUIRED | PASS | `session-context.test: returns agents without config, providers, commands or events…`·`isolates provider failure…`·`composer-cache.test` pass, 좌표 실재 |
| VP6 | UT | REQUIRED | **PAIR_FAIL** | `composerCatalogState.test` 4건 pass, **Q8** 못 잡음 |
| VP3 | IT | REQUIRED | **PAIR_FAIL** | Q1·Q3·Q4·Q5·Q6·Q7 잡음, **Q2** 못 잡음(provider 운반) |
| VP4 | IT | REQUIRED | PASS | Q9·Q10 잡음, preload `index.test` composer 채널 pass |
| VP7 | IT | REQUIRED | PASS | Q11–Q14 잡음 |
| VP2 | ST | REQUIRED | PASS | Q6 잡음, `adapter.startup.test` 7건 pass |
| VP1 | AT | REQUIRED | BLOCKED_BY:VP3·VP6 | AC1–5·7·8·10 관측 PASS, AC6·AC9는 위 root |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 세션 없는 composer 목록 | ✅ | Q9·Q10 잡음 |
| AC2 hidden/subagent 제외·plugin 반영 | ✅ | `composer-catalog.test: reads plugin-resolved primary agents…`, 0268 H9 잡음 |
| AC3 느린 provider가 agent를 막지 않음 | ✅ | Q12(`…while provider metadata is stalled`) 잡음 |
| AC4 중복·재개방·첫 제출 재사용 | ✅ | Q9·Q10(`…reuses cached agents and variants across menu reopenings`) |
| AC5 준비→첫 제출 재사용·최종 정리 | ✅ | Q4·Q5·Q6 잡음 |
| AC6 늦은 결과 폐기·오류≠빈 목록 | ❌ | Q8 green |
| AC7 내부 재조회 합류·회복(팝업 액션은 0281) | ✅ | Q6 잡음 |
| AC8 agent만 대기·variant 시 모델 검증 | ✅ | Q11·Q14 잡음 |
| AC9 턴과 같은 설정/env/cwd·창 격리 | ❌ | Q1·Q3 잡음, Q2(provider) green |
| AC10 준비·선택·초점 회귀(표현은 0281) | ✅ | 0281 verify V1 VP1 PASS |

- 합계 재측정: `✅ 8 · ❌ 2 = 10`. 자기보고 `Criteria-Met: 10/10`(`26ebee4`)과 불일치.

### §10 강제 지점 분모

| 목록 | 결과 |
|---|---|
| EP1 (4) schema·preload·renderer API·handler 등록 | 4/4 PASS (Q7·Q9, preload test) |
| EP2 (4) bootstrap·resolver·owner·window | 3/4 — resolver PAIR_FAIL(Q2) |
| EP3 (3) prepareComposer·agent/model·abort/release | 3/3 PASS (직접 oracle 좌표 실재·pass) |
| EP4 (4) state·hook·agent control·variant control | 3/4 — state PAIR_FAIL(Q8) |
| EP5 (4) submit agent·variant·initial·nativeResources | 4/4 PASS (Q11–Q14) |

- 17/19. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · renderer 374/3060 · main 465파일 중 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 실제 OpenCode CLI로 첫 입력 전 agent 표시·두 테마 | 설치 SDK transport·Module 통합 | 실제 창 확인 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → `verify/FAIL`·Codex·라운드 2.
- 대상 커밋: `6eeed51`·`aa94696`·`ab20170`·`26ebee4`·`087543e` 모두 `git cat-file -t` = commit. `26ebee4` trailer 5키 파싱.
- `[구현자 기입]` 7필드와 19자리 강제 지점 표 존재.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | Q2: prepare가 draft의 `providerKey`를 버려도 green | EP2 resolver · AC9 · VP3 | BLOCKING (PAIR_FAIL) | 기본값과 다른 providerKey의 draft 준비가 그 provider 설정으로 resolve됨을 단언 |
| D2 | Q8: retired 세대 결과 폐기 삭제 green | EP4 state · AC6 · VP6 | BLOCKING (PAIR_FAIL) | 같은 epoch에서 새 세대 part 뒤 옛 세대 part 응답이 무시되는 순서 단언 |
| N1 | N6b: configuration 단계 래핑 미잠금 | 0280 D1 | NON_BLOCKING(0276) | 0280 r2에서 함께 닫음 |
| N2 | ΔV1·ΔV2 설계 본문이 `[구현자 기입]` 표제 아래 위치(설계 커밋으로는 분리됨) | repository operation | NON_BLOCKING | 이후 Delta V는 Part I/II 절로 |

## 14. Review Signals

- 이전 라운드: 첫 verify. 관련 plan 지침: AC9가 "구별되는 env/provider/project/session 값"을 oracle 조건으로 명시.
- 사용자 결정 변경: 0281 D1·D5·D6(팝업 표현) — 최신 handoff 기준 채점.
- 반복 환경 한계: `C:/` fixture — 검증자 win32 shim.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 4(VP2·VP4·VP5·VP7) · root PAIR_FAIL 2(VP3·VP6) · BLOCKED_BY 1(VP1). PLAN_GAP 없음.
- AC: ✅8 · ❌2 / 10.
- 다음 단계: Codex r2 — D1·D2, 다음 verify는 Q2·Q8 재실행.

---

# r2 재검증 (2026-10-23)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `32b43cc..e42d1e2` 중 0276: `d135fa5`(r2 — 테스트 2파일) |
| 구현 전 plan 기준 | r1과 같음 — `d135fa5`의 `plan.md` `-` 줄은 메타 상태 1줄 |
| V mode / 유효 V | Baseline V + ΔV1 + ΔV2, 표현 부분은 0281 ΔV1로 SUPERSEDED |
| 라운드 | 2 (verify 2회째) |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude |

**PASS — r1 미검출 Q2(draft provider)·Q8(retired 세대 결과 폐기)가 모두 잡히고, r1에서 잡히던 고장도 유지된다.** production 무변경 테스트 보강 라운드다.

## r2-0. 기준선 / plan validity

- 앱 변경은 테스트 22파일뿐(production 0) — §10 19자리와 경로는 r1과 같다.
- 새 oracle 실행 구간: `composer-catalog.test: prepares draft and saved directory…`는 등록 handler → 실제 resolver(`resolve` mock은 기본 `one`과 요청 `two`를 구별) → prepare를 지난다. `composerCatalogState.test: keeps the new generation when an older part resolves in the same epoch`는 실제 state 클래스의 응답 순서를 조작한다.
- 운반 값 구별: draft providerKey `two`가 기본값 `one`과 달라 `providerKey: null`(Q2)이 관측을 바꾼다.

## r2-4. 고장 재실행

- main `src/main src/shared src/preload`(Linux 기준선 17 red). Windows 전용 `composer-catalog.test.ts`·`adapter.test.ts`는 검증자 win32 shim(`…w`)으로 쟀다. shim 기준선 25케이스 중 1건(`reads installed plugin metadata…`)은 shim의 tmpdir 경로 부산물이라 제외했다.

| ID | r1 | r2 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|
| Q1 | 잡음(shim) | 잡음(shim) | `composer-catalog.test: prepares draft and saved directory with the same production settings…` | EP2 resolver |
| Q2 | 못 잡음 | **잡음(shim)** | 같음 | EP2 resolver · D1 |
| Q3 | 잡음(shim) | 잡음(shim) | 같음 | EP2 resolver |
| Q4·Q5 | 잡음 | 잡음 | `handlers/composer-catalog.test: shares pending acquisition…releases on navigation/crash/shutdown` | EP2 window |
| Q6 | 잡음 | 잡음 | `handlers/composer-catalog.test: refresh re-resolves and keeps old owner until replacement is ready` | EP2 owner |
| Q7 | 잡음 | 잡음 | `handlers/composer-catalog.test: validates directory and owner before preparation…` | EP1 |
| Q8 | 못 잡음 | **잡음** | `composerCatalogState.test: keeps the new generation when an older part resolves in the same epoch` | EP4 state · D2 |
| Q9·Q10 | 잡음 | 잡음 | `Module.integration: prepares draft agents before providers…` | EP4 hook·variant |
| Q11–Q14 | 잡음 | 잡음 | `adapter.persistent.test`·`adapter.startup.test`·`opencode-runtime.test` (r1과 같은 축) | EP5 |

- 검산: 시도 14 = 잡음 14 · 못 잡음 0 · 동치 0. r1 못 잡음 2 → 잡음, r1 잡음 12 → 잡음(덮개 회귀 0).
- Linux Q2 실행은 기준선 밖 1건이 `infra/loopback-callback.test: 타임아웃은 LoopbackCancelledError 로 끝난다`였다 — 변이와 무관한 타이머 테스트가 병렬 부하에서 흔들린 것이라 증거로 세지 않았다(게이트 단독 실행에서는 green).
- 0280 D1의 형제 N6b(r1 이 handoff N1)는 0280 verify r2에서 잡음(shim)으로 닫혔다.

## r2-5. V-pair closeout

| Pair | 레벨 | r1 | r2 | 증거 |
|---|---|---|---|---|
| VP5 | UT | PASS | PASS | 좌표 실재·pass(r1과 같음), production 무변경 |
| VP6 | UT | PAIR_FAIL | **PASS** | Q8 잡음 |
| VP3 | IT | PAIR_FAIL | **PASS** | Q1–Q7 잡음 |
| VP4 | IT | PASS | PASS | Q9·Q10 잡음 |
| VP7 | IT | PASS | PASS | Q11–Q14 잡음 |
| VP2 | ST | PASS | PASS | Q6 잡음 |
| VP1 | AT | BLOCKED_BY:VP3·VP6 | **PASS** | 하위 root 해소, AC1–AC10 관측 |

| AC | 결과 | 근거 |
|---|---|---|
| AC1–AC5·AC7·AC8·AC10 | ✅ | r1과 같은 축 Q4–Q7·Q9–Q14 잡음 |
| AC6 늦은 결과 폐기·오류≠빈 목록 | ✅ | Q8 잡음 |
| AC9 턴과 같은 설정/env/cwd·창 격리 | ✅ | Q1·Q2·Q3 잡음(shim) |

- 합계 재측정: `✅ 10 · ❌ 0 = 10`. 자기보고 `Criteria-Met: 10/10`(`d135fa5`) 일치.
- §10: EP1 4/4 · EP2 4/4 · EP3 3/3 · EP4 4/4 · EP5 4/4 = 19/19.
- 운영 gate: [0281 verify r2](../0281-opencode-menu-cache/verify.md#r2-운영-gate-head-e42d1e2)와 같은 HEAD 실행 — typecheck 0 · lint 0 error · renderer 377/3078 · main 17 red 전부 Windows 전용 · CI #857 green.

## r2-11. Repository operation checks

- INDEX: `impl/IMPL_DONE`(r2) → PASS, archive 이동. `d135fa5` `git cat-file -t` = commit, trailer 5키 파싱.
- `[구현자 기입] r2` 7필드(표제 7개), 강제 지점 표가 EP1–EP5 19자리를 담는다.

## r2-13. Finding disposition

| # | r2 상태 | 근거 |
|---|---|---|
| D1 | closed | Q2 잡음(shim, Windows CI #857 green) |
| D2 | closed | Q8 잡음 |
| N1 | closed | 0280 r2 N6b 잡음 |
| N2 | NON_BLOCKING 유지 | 설계 본문 위치 — 기록 문제, 판정 무관 |

## r2-15. 결론

- 상태: **PASS** — verify 2회째. pair 7/7 PASS, PLAN_GAP 없음, AC ✅10/10.
- 남은 사람 확인: 실제 OpenCode CLI의 첫 입력 전 agent 표시·두 테마(AC 밖).
