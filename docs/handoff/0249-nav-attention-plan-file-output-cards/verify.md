# Verify — 0249-nav-attention-plan-file-output-cards

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0249-nav-attention-plan-file-output-cards` |
| 검증자 | Claude Code |
| 일자 | 2026-10-04 |
| 대상 커밋/range | `954e6fff..478565b6` (구현 `61c12248` r1 · `645fe022` r1.2 · `478565b6` r1.3) |
| 구현 전 plan 기준 | `266bdbfe`(V1) · `c6e7b7e1`(ΔV1) · `f3198994`(ΔV2) |
| V mode / 유효 V | `Baseline V: V1` + `ΔV1` + `ΔV2` |
| 검증 기준 plan revision | `f3198994:ΔV2` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — §19 사람 실기 4건 대기(비차단) |
| 자기 검증 여부 | 아니오 — 설계·검증 Claude, 구현 Codex. 보고에 없던 독립 축 X1~X9 를 더했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` 1행과 `[구현자 기입]` 절, 그리고 `478565b6`이 `[검증자 기입] 파생 이슈` 자리표시 행을 CI-01·CI-02로 채웠다(§11 D3). `git diff -U0 <c>^ <c> -- plan.md`의 hunk가 규범 절(§1~§19·ΔV1·ΔV2)에 닿은 것은 메타 L14뿐이다.
- 기준선이 diff로 성립하는가: 예 — 설계 3커밋과 구현 3커밋이 분리.
- Decision Ledger · Product/UX · AC · V node/pair/§10/oracle 변경: 구현 커밋에서 없음. ΔV2는 사용자 결정⑯에 따른 별도 설계 커밋(`f3198994`).
- 채점에 사용할 원 기준: `f3198994` 의 D-001~D-031(ACTIVE) · 유효 AC 21 · 유효 pair 31(REQUIRED 23·REGRESSION 8) · EP-01~EP-10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline/Delta mode·상속 기준 | 유효 | V1 `none` → ΔV1 `266bdbfe` → ΔV2 `c6e7b7e1`, 셋 다 공유 브랜치 커밋 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | ΔV2 AT-19′·AT-23·SD-03·MD-07 → VP-23′·29·24′·30 |
| INHERITED ↔ REGRESSION | 유효 | R-0239-12·R-0231-06 → VP-31·32, V1·ΔV1 회귀 VP-18~22·21′·28 |
| path·§10 자리·oracle | 유효 | 31 pair 모두 기재, ΔV2 EP-09 6 · EP-10 6 |
| 적대 증거 선택 | 유효 | 배선·0건·등식·형제 슬롯 pair만 선택(VP-02·06′·09′·10·11′·15·23′·26) |
| SUPERSEDED 이관 | 유효 | VP-06/09/13/21/23/24 → ′판, VP-14 폐기 근거(D-027) |
| 운영 gate | 유효 | lint·typecheck·영향 vitest·doc inventory·trailer |

- root PLAN_GAP: 없음. r1 PG-01은 ΔV2(D-030·D-031·AC19′·AC23)로 닫혔다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | 로그인 프리 '연결됨'/'Connected' | `ko.ts`·`en.ts` `loginFree` → `providerRowMeta` → 목록·상세 |
| D-002~D-006 | 비열람 세션 응답 대기 = 완료와 같은 파랑, 열면 해제 | `chatStore.receive` `permission.requested`(정확 라우팅 가드) → `subscribeResponseRequest` → app `subscribeSessionAttention` → `markAwaitingResponse` → `unseenAttention` → `SessionRow` |
| D-021~D-024 | 패널 = 백그라운드 작업, 실행 중 = Spark 집합, 포그라운드 Agent는 인라인 '열기'로만 | `countedBackgroundTaskIds`(shared) → main `count` · renderer `isBackgroundWork` → `projectBackgroundPanel` · `openSubagentTask` → `selectBackgroundItem` |
| D-025~D-028 | 파일 출처가 정답, 다르면 `updatedInput` 보정, 같으면 참조 그대로 | PostToolUse 훅 → 셀 → `getPlanFiles` → `resolvePlanReview` → 요청 `plan` + allow `updatedInput` |
| D-018~D-020 | 같은 파일 카드 1장(최신·첫 자리), 카드 → 메타 | `partsArtifacts` → `AssistantTurn` 고정 슬롯 |
| D-029 | 엔진 개수 = 카드 수 | `AgentEnvironmentView` `agents.length` |
| D-030·D-031 | Spark 밖 미종료 = 완료 '종료 확인 불가', 기록 불변, `excluded` 삭제 | `backgroundTaskDisplay`·`backgroundCallDisplay` 정착 분기 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ✅ | 파일 읽기 실패·초과·링크는 `null` → 다음 출처(`plan-file.ts` 전 경로 `catch`), 핸들은 `finally close` |
| false success | ✅ 없음 | 파일 출처 없음 → `updatedInput = input`(서술 미반환, M-D10 red) |
| partial failure | 해당 없음 | Orca 쓰기 없음. CLI 저장은 CLI 동작(F-10) |
| A 대신 B | ✅ 아님 | Spark 등식을 shared 함수 하나로 강제(main·renderer 공용, M-S1 red) |
| 증상만 제거 | ✅ 아님 | `excluded` 상태·라벨·키를 함께 삭제, raw `liveMembership`는 보존(VP-32) |
| 상한 | ✅ | ExitPlanMode 1회당 최대 2파일 × 256 KiB(+1 probe 바이트) |
| 카드 재mount(D-020) | ✅ 코드 확인 | `AssistantTurn.tsx` 자식 배열에서 카드는 `{pending && …}` 자리표시 뒤 단일 위치 — pending 전환에도 인덱스 불변 |

## 3. 역방향 탐색

`scan-surface.sh`는 `rg` 부재로 실행 불가. 같은 질문을 `grep -rlF`(테스트 제외)로 대체했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export 16종 프로덕션 참조 | 정상 | 전부 정의 외 프로덕션 파일 ≥1(`PLAN_FILE_MAX_BYTES`·`planFileTarget`·`PlanReviewSources`는 같은 파일 내부 사용) |
| 퇴역 이름 `unseenCompletedIds`·`subscribeSessionCompletions`·`resolvePlanText`·`isBackgroundPanelItemVisible`·`background.excluded` | 정상 | 프로덕션 0건 |
| 형제 비대칭 — task/call 원격 정착 | 대칭 | `backgroundTaskDisplay`·`backgroundCallDisplay` 둘 다 원격 예외 제거, X1(call 쪽만 복원) red |
| 종료 배지 조건 변경(`CanonicalBackgroundContent.tsx:266`) | 정상 | live 제외 정착 카드에 '프로세스 종료'가 붙지 않도록 실제 연결 사실로 한정, X3 red |
| 조상 링크 거부(`plan-file.ts` 조상 `lstat` 루프) | 의도보다 엄격 | D-016은 파일 자체의 링크만 금지 → D1 NON_BLOCKING |

## 4. 기존 테스트 / semantic 검증 확인

- 선택된 적대 증거 재측정: 등록 27 ID + 새 oracle OF-1 = 28건 중 검출 28 · 미검출 0. 일반 hunk 자동 확장 0.
- 독립 축(보고에 없음) 9건: X1~X9 전부 red.
- 이전 라운드 대조: 이전 verify 없음. 구현자 r1.3 수치와 대조해 C·S·D·E 전 ID의 실패 수가 일치(M-D1만 구현자 14 ↔ 검증자 9 — 치환 형태 차이, 둘 다 red).
- 형제 슬롯 맞바꿈: 요청 `plan`/`updatedInput`/`planFilePath`(M-D2′·D3′·D4′·D10), 파일 버전/자리(M-E1·E2), 카드/메타 순서(X6) — 전부 red.
- 원복: 하네스가 원본 바이트를 되돌렸고 `git status` 잔여 0(하네스 파일만, 삭제함).

| 변이 | 범위 | 결과(실패/대상) | 귀속 |
|---|---|---|---|
| M-B1 effect 완료 전용 구독 | NAV 15파일 | red 1/109 | VP-02 |
| M-B2 요청 통지 제거 | NAV | red 4/109 | VP-02 |
| M-B3 열람 가드 제거 | NAV | red 4/109 | VP-02 |
| M-B4 인라인 선택 연결 제거 | BG 11파일 | red 2/178 | VP-26 |
| M-B5 선택 Agent 예외 제거 | BG | red 5/178 | VP-26 |
| M-C1′ `isBackgroundWork` 항상 true | BG | red 35/178 | VP-06′ |
| M-C2′ ambient 검사 제거 | BG | red 10/178 | VP-06′ |
| M-C3′/M-S3 비셸 작업 무조건 표시 | BG | red 16/178 | VP-06′·VP-23′ |
| M-C4′ call.mode 증거 제거 | BG | red 4/178 | VP-06′ |
| M-S1 main count ambient 포함 | BG | red 2/178 | VP-23′ |
| M-S2 Spark 항 + call.mode 제거 | BG | red 5/178 | VP-23′ |
| M-S4 live 제외 정착 제거 | BG | red 6/178 | VP-23′ |
| M-S5 task 원격 이전 세대 예외 복원 | BG | red 7/178 | VP-23′ |
| M-D1 서술을 파일보다 앞에 | PLAN 9파일 | red 9/164 | VP-09′ |
| M-D2′ 입력 plan을 파일보다 앞에 | PLAN | red 12/164 | VP-09′ |
| M-D3′ 일치 입력도 새 객체 | PLAN | red 10/164 | VP-09′ |
| M-D4′ updatedInput 경로 누락 | PLAN | red 18/164 | VP-09′ |
| M-D10 서술을 updatedInput에 동봉 | PLAN | red 4/164 | VP-09′ |
| M-D5 Stop 비움 제거 | PLAN | red 3/164 | VP-10 |
| M-D6 agent_id 가드 제거 | PLAN | red 3/164 | VP-10 |
| M-D7 계획 훅 병합 제거 | PLAN | red 18/164 | VP-11′ |
| M-D8 getter에 다른 셀 | PLAN | red 3/164 | VP-11′ |
| M-D9 getPlanFiles 배선 제거 | PLAN | red 5/164 | VP-11′ |
| OF-1 출력 파일 훅 무력화 | PLAN | red 6/164 | CI-02 oracle |
| M-E1 첫 버전 유지 | CARDS 3파일 | red 6/44 | VP-15 |
| M-E2 최신 버전을 마지막 자리로 | CARDS | red 5/44 | VP-15 |
| M-E3 category 무시 | CARDS | red 9/44 | VP-15 |
| X1 call 원격 이전 세대 예외 복원(EP-09⑥) | BG | red 4/178 | VP-23′·VP-30 |
| X2 Spark 항의 세대 검사 제거 | BG | red 1/178 | VP-23′ |
| X3 종료 배지를 옛 `unconfirmed` 조건으로 | BG | red 1/178 | VP-29 |
| X4 PostToolUse `isError` 가드 제거 | PLAN | red 2/164 | VP-10·AC11 |
| X5 선언 경로 D-016 판정 우회 | PLAN | red 1/164 | VP-12·EP-04′⑦ |
| X6 카드를 메타 뒤로(옛 순서) | CARDS | red 2/44 | VP-17 |
| X7 응답 대기 class를 완료와 다르게 | NAV | red 3/109 | VP-02·D-003 |
| X8 엔진 개수 settings 필터 복원 | engine 3파일 | red 2/12 | VP-27 |
| X9 en `loginFree` 옛 문구 | i18n+skills | red 1/84 | VP-01 |

- OR-1(EP-10 sweep): `grep -rlF "background.excluded"` 프로덕션 0건, locale `excluded:` 키 0건 — 재측정 일치.
- 스위트 키: NAV = `app/hooks`+`features/sessions` · BG = shared/main background 3 + renderer `canonicalBackground*`·`backgroundPresentation`·`backgroundStore.panel`·`chatStore.background-open`·`CanonicalBackgroundContent*` · PLAN = `main/adapters` plan-file·reader·plan-text·canusetool·plan-file·plan-narrative·turnEnd·output-files·extra-dirs · CARDS = `parts`·`TurnOutputCards`·`ArtifactCards.lifecycle`.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 증거 |
|---|---|---|---|---|
| VP-05 · VP-07′ · VP-12 · VP-13′ · VP-16 · VP-30 | UT | REQUIRED | PASS | store·진리표·reader·resolver·parts 단위 green, M-B3·C1′~C4′·X5·D2′~D4′·E1~E3·X1 red |
| VP-04 · VP-08′ · VP-11′ · VP-25 · VP-26 | IT | REQUIRED | PASS | lint boundaries 0 error, 투영 소비 4곳, SDK `query` 포획 배선(M-D7~D9 red), shared 집합 공용(M-S1 red), 인라인 선택(M-B4·B5 red) |
| VP-03 · VP-10 · VP-24′ | ST | REQUIRED | PASS | 표시→열람→재요청 시퀀스, Write→ExitPlanMode→Stop(M-D5·D6·X4 red), 시작→live→제외→unconfirmed→통지 |
| VP-01 · VP-02 · VP-06′ · VP-09′ · VP-15 · VP-17 · VP-23′ · VP-27 · VP-29 | AT | REQUIRED | PASS | SSR·요청/allow 인자·실제 Mapper 반례①②의 집합/길이 등식, 등록 변이 전부 red, X3·X6~X9 red |
| VP-18 · VP-19 · VP-20 · VP-21′ · VP-22 · VP-28 · VP-31 · VP-32 | AT | REGRESSION | PASS | 기존 의미 테스트 green(영향 2075케이스 내) |

- root PAIR_FAIL 0 · BLOCKED_BY 0. 최초 검증이라 유효 pair 31건 전부 실행.

### AT / AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | X9 red · 목록/상세 SSR '연결됨'·'기본 제공' |
| AC2·AC3·AC4·AC5 | ✅ | M-B1~B3·X7 red, `useSessionCompletion`·`sessionsStore` 단언 |
| AC6′·AC7′·AC8′ | ✅ | M-C1′~C4′ red, 같은 state 양성·음성 |
| AC9′·AC10′·AC21 | ✅ | M-D1~D4′·D10 red, 참조 동일 단언 |
| AC11 | ✅ | M-D6·X4·X5 red, reader 링크·상한·close 표 |
| AC14′ | ✅ | M-D7~D9 red(실제 `sendMessage` 포획) |
| AC15·AC16 | ✅ | M-E1~E3 red |
| AC17 | ✅ | X6 red(4조합 순서) |
| AC18 | ✅ | §9 gate 산출 |
| AC19′ | ✅ | M-S1~S5·X2 red, 반례①②(`CanonicalBackgroundContent.spark.test.ts`) |
| AC20 | ✅ | M-B4·B5 red |
| AC22 | ✅ | X8 red |
| AC23 | ✅ | X1·X3 red, `canonicalBackground.settlement.test.ts` 기록 `status` 불변 |

- 합계 재측정: ✅21 · ⚠️0 · ❌0 = 21. 자기보고 `Criteria-Met: 21/21`(645fe022·478565b6 trailer) · INDEX 비고 21/21 — 일치.

### §10 강제 지점 분모

| EP | plan 자리 | 코드 확인 | 결과 |
|---|---|---|---|
| EP-01 | 5 | ko·en 값, `providerRows.ts` 키, 목록·상세 렌더 5/5 | PASS |
| EP-02 | 8 | 요청 통지 가드·`turn.ended`·app 구독 합성·두 action·열람·삭제·`SessionRow` 8/8 | PASS |
| EP-03′ | 9 | shared 함수·main count·projector 운반·task/call 술어·소비 4곳 9/9 | PASS |
| EP-04′ | 7 | 기록·Stop·배선·resolver·요청 plan·allow·선언 판정 7/7 | PASS |
| EP-05·06·07·08 | 2·1·3·2 | 각 자리 확인 | PASS |
| EP-09 | 6 | task/call 표시 함수·그룹·카드 라벨/중단·지우기 가드·완료 지우기 6/6 | PASS |
| EP-10 | 6 | 반환 타입·분기·union·라벨 맵·ko·en 키 6/6 | PASS |

- 표 밖 같은 불변식: 종료 배지(`CanonicalBackgroundContent.tsx:266`) — 구현자가 조사·수정, X3로 잠김 확인.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | 0 error · 1 warning(기존 `useVirtualizer` react-hooks/incompatible-library) |
| typecheck | PASS | node·web·test 진단 0 |
| 영향 vitest | PASS | 251파일 2075케이스 중 2070 green + DB 1파일 5케이스는 Node ABI 서명(`NODE_MODULE_VERSION 140 vs 127`)으로 실패 → Electron Node 모드로 재실행 5/5 green |
| doc inventory | PASS | generated ok · prose ok · links ok |
| message-bus | PASS | 6커밋 trailer 파싱 확인(§11) |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| SDK `CanUseTool` allow `updatedInput` | typecheck 0 | 같으면 입력 참조·다르면 `{...입력, plan, planFilePath}`(M-D3′·D4′ red) | ✅ |
| SDK `HookCallback` PostToolUse/Stop | typecheck 0 | `{}`만 반환, 병합 훅 공존(OF-1·M-D7 red) | ✅ |
| CLI 실행 순서(F-11)·주입(F-09) | — | 바이너리 사실, 실환경 실기 §8 | 사람 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 투영 소비처: `projectBackgroundPanel(` 프로덕션 호출 4(`CanonicalBackgroundContent`·`SubAgentTileContent`·`backgroundStore` 2) — plan과 일치.
- `partsArtifacts` 프로덕션 소비 1(`AssistantTurn`).
- 음성 단언 AC7′은 같은 state의 양성과 짝(M-C1′ 35건 red로 방향 확인).
- 상한: 2파일 × (256 KiB + 1) 버퍼, 반환 ≤ 256 KiB.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| nav 파랑 | data-state·class 동일성(X7) | 다른 세션 승인 대기 시 실제 색·굵기 |
| 카드 위치 | 자식 순서 4조합(X6) | Work·Code 답변 끝 시각 |
| custom 모델 계획 | 출처 표·실제 query 포획 | LiteLLM/OpenRouter에서 계획 패널 본문·승인 후 모델 응답 |
| 백그라운드 패널 | 실제 Mapper 반례 | Spark N과 실행 중 카드 수 육안 일치 |

## 9. 게이트 재실행

- 명령: `cd app && npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run <plan §19 + ΔV1 Δ8 + claude.extra-dirs> --reporter=dot` · `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron ./node_modules/vitest/vitest.mjs run src/renderer/src/features/chat/lib/settlement.integration.test.ts` · `node scripts/check-doc-inventory.mjs --check`.
- `npm test` 미사용(ABI 전환 없음). DB 파일은 Electron ABI 그대로 실행해 변경 관련성을 분리했다.
- 게이트가 작업 트리를 바꿨는가: 아니오. 검증 잔여물: 변이 하네스 1파일 생성 후 삭제. 기존 `.ko.ts.swp`(미추적)는 검증 전부터 있었다.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트·AC↔경로·문서 링크 | 에이전트 완료 |
| 시각·실환경 custom 모델 | 사람(§8) |
| PR merge | 사람 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 Claude — 실제와 일치. 자리표시 3개를 `f3198994`(ΔV2) · `645fe022`(r1.2) · `478565b6`(r1.3)로 기입, 6커밋 `git cat-file -t` = commit, `origin/codex-0249-…` 포함.
- trailer: `266bdbfe`·`c6e7b7e1`·`f3198994` designed / `61c12248` partial 19/20 / `645fe022`·`478565b6` implemented 21/21 — 허용값·파싱 정상.
- `[구현자 기입]` 7필드: r1·r1.2·r1.3 각각 설계 리뷰·강제 지점·잠금·Product/UX·잠재 문제·구현 보고·Review Signals 7/7.
- 구현자가 `[검증자 기입] 파생 이슈`에 CI-01·CI-02를 직접 적었다 → D3. 검증자가 재분류해 상태를 덮어쓴다.

## 12. 구현자 코멘트 / 선조치 경계

| 코멘트 | 판단 | 반영 |
|---|---|---|
| reader를 `open`→handle `stat`→조상 `lstat`→bounded read로 교체 | 구현 세부 보완 — 성장·교체·close를 막는다 | 수용. 조상 링크 거부는 D1 |
| 종료 배지 조건을 실제 연결 사실로 한정(I-04) | 타당 — 현재 연결 카드의 '프로세스 종료' 오표시 방지 | 수용, X3 red |
| N-01 ino Number 정밀도 | 보고만 | D2 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| CI-01 | 8.3 일반 파일 realpath 오판 | VP-12·D-016·CI gate | 해결 확인 | reader 단위·영향 스위트 green |
| CI-02 | extraDirs 병합 훅 고정 가정 | CI gate | 해결 확인 | OF-1 red 6/164 |
| D1 | reader가 **조상** 디렉토리 링크도 거부 — `~/.claude`·`CLAUDE_CONFIG_DIR` 가 심볼릭 링크/junction이면 파일 출처가 조용히 서술 폴백으로 내려간다 | D-016은 파일 자체만 규정 | NON_BLOCKING | dotfile 링크 사용자 기능 손실 가능. 허용할지 사용자 결정 후 후속 |
| D2 | `ino`를 Number로 비교 — 안전정수 밖 inode는 반올림(N-01) | 비귀속 | NON_BLOCKING | `bigint: true` stat 후보 |
| D3 | 구현자가 `[검증자 기입]` 절을 작성 | `docs/handoff/AGENTS.md §충돌 최소화` | NON_BLOCKING | 이번 verify가 재분류·덮어씀 |
| D4 | `docs/arch/backend/auth.md` 문구 `` `연결됨`와 `` 조사 오류 | 비귀속 | NON_BLOCKING | `과`로 정정 후보 |

## 14. Review Signals — 사실만

- r1 PLAN_GAP(PG-01)은 구현자가 멈춰 올렸고 설계 정정 후 r1.2에서 닫혔다 — verify 없는 impl 턴 3회(r1·r1.2·r1.3), 상한 초과 아님.
- r1.3은 원격 CI red(8.3 TEMP 경로·병합 훅 가정)로 생긴 턴이다. 로컬 영향 명령에 `claude.extra-dirs.test.ts`가 빠져 있었다.
- 반복 환경 한계: 이 환경에 `rg` 없음(scan-surface 불가), DB 테스트 ABI 서명.

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair: REQUIRED 23 · REGRESSION 8 = 31 PASS · PAIR_FAIL 0 · BLOCKED_BY 0. PLAN_GAP 없음.
- AC ✅21 · ⚠️0 · ❌0. 적대 증거 28/28 + 독립 9/9 red.
- gate 전부 PASS(DB 1파일은 ABI 분리 후 green).
- NON_BLOCKING D1~D4.
- 다음: 사람 실기 §8 4건. archive 이동은 실기 뒤.

---

# r1.4 — ΔV3 독립 검증 (2026-10-06)

**FAIL.** 새 대화의 init 전 계획 승인 콜백이 실행되고 사용자가 기존 세션을 열면, 새 대화의 계획 승인 카드가 기존 세션에 표시된다. 실제 `createApprovalRequester` → IPC transport → `ingestChatEvent` → `chatStore` 경로의 독립 X1에서 D5를 재현했다. 이전 r1 판정은 위 원문으로 보존한다.

## 0. 기준선·독립성

| 항목 | 값 |
|---|---|
| 검증자 | Codex 독립 subagent — 구현 agent와 별도 |
| 대상 / plan | 로컬 `b110cca6..963464c8`; ΔV3 설계 `68c39bdd` + MD-08 정정 `b110cca6`; main `ceda5c5a` |
| 유효 V / 범위 | V1 + ΔV1 + ΔV2 + ΔV3; 37 pair 중 REQUIRED 7 + REGRESSION 5 =12 선택 |
| 상태 | r1.4 FAIL, 완료 주기1 → 보드 라운드2·다음 Codex |

네 ref 모두 `git cat-file -t`로 commit 실재를 확인했다. `git diff b110cca6 963464c8 -- plan.md`는 구현 보고151줄 추가만 보인다. Decision·AC·V·requiredness·§10의 무단 변경은 없다. ΔV3의 같은 수준 pair·영향 회귀·oracle·선택 변이·gate는 유효하다. **PLAN_GAP 0**: D-033·AC25가 소유 세션 격리를 이미 규정하므로 D5는 명시 계약의 구현 실패다.

## 1. D5 — 소유 세션 오배선

**BLOCKING**, root **VP-36 PAIR_FAIL**; **VP-35 BLOCKED_BY:VP-36**. 확정 세션의 파일 보정·카드/DB oracle이 성공해도 잘못된 세션에 표시되므로 AC24/25 종단은 닫히지 않는다.

- 조건: pending draft `draft`, `dbSessionId=null`, `pendingNewChatKey='draft'`; 사용자는 기존 세션 `s`를 열람한다.
- 실행: 실제 requester에 plan_review를 넣고 deferred broker의 승인 대기 중 실제 store를 관측한다.
- 기대: `other=null`, `owner='# Pending draft plan'`.
- 실제: `other='# Pending draft plan'`, `owner=null`.
- producer: `app/src/main/app/chat-turn/approval.ts:57`의 init 선행 가정과 `:67`의 sessionId 없는 requested 발행.
- consumer: `app/src/renderer/src/features/chat/store/chatStore.ts:580`; sessionId 없는 permission.requested는 pending 분기에 없어 activeKey로 간다.
- 재현: `app/src/renderer/src/features/chat/store/chatStore.planOwner.test.ts:14`(owner 비교 `:60`); report `app/.tmp-verify-0249-X1.json`.

설치 SDK의 control callback과 iterator는 독립 진행한다. 따라서 requester의 “권한 요청은 session.updated 이후” 주석을 순서 보장으로 인정하지 않는다. requested/resolved의 pending owner와 session.updated 승격을 함께 잠가야 한다. X1의 직접 실패 단언은 **대기 중 requested 라우팅**이며 resolved까지 재현했다고 주장하지 않는다.

역방향으로 writer·SQL·reducer의 owner guard를 거슬러 이 edge를 찾았다. 신규 helper/port의 production 소비처도 직접 확인했다. `scan-surface.sh b110cca6..963464c8`는 bash가 없어 미실행이며, `rg`로 `planReviewToolInput|fromClaudePermissionMode|createPermissionModeObserver|onPermissionModeChanged|updateToolCallInput|planToolInputs|pendingPlanToolCalls`의 production 참조를 추적했다. 제보된 승격 후 attention 통지는 후속 보정의 인접 소비처로 남기고 X1 실패 건수에 더하지 않는다.

## 2. 독립 테스트와 운영 gate

UT → IT → ST → AT 순으로 직접 실행했다. 설치 SQLite의 plain Node ABI를 사용했으며 ABI 전환·새 의존성 설치·autofix·production 수정은 없다.

| 단계 | 파일 | pass / fail | 직접 oracle |
|---|---:|---:|---|
| UT | 5 | 90 / 0 | input 식별·mode·파일 resolver/reader |
| IT | 7 | 149 / 0 | requester 저장 선행·실제 writer/SQLite·runtime·observer·fresh TurnContext |
| ST | 4 | 61 / 0 | 실제 adapter query의 입력/모드·두 순서·child·Stop |
| AT | 5 | 56 / 0 | Work/Code SSR·계획 패널·reducer·store |
| 합계 | 21 | 356 / 0 | 파일 중복 없음; X1은 별도 |
| X1 | 1 | 0 / 1 | init 전 요청 + 다른 열람 세션 |

| gate | 독립 관측 |
|---|---|
| scripts | JUnit testcase132·failure0 |
| lint | ESLint src/scripts no-fix: error0·기존 warning1(`useTranscriptVirtualizer.ts:22`, incompatible-library) |
| typecheck | node/web/test 3종 진단0 |
| doc-inventory | 생성값·본문 수치·링크 검사 정상 |
| test-budget / migration | git fixture 범위·schema 동기·no-copies·append-only 정상 |
| diff | `git diff --check` 정상 |

초기 sandbox UT는88pass/2fail(8.3 일반 파일·256KiB 경계)였다. 직접 `lstatSync('C:/Users/rlaeo')`에서 EPERM을 확인했고 **동일5파일 권한 승격 실행은90/90**이었다. sandbox scripts는124pass/8fail이며 모두 `ensure-sqlite-abi.test.mjs`의 require.resolve→fingerprint에서 같은 사용자 폴더 EPERM을 보였다. **동일 scripts 승격 실행132/132**로 환경 false fail을 분리했다.

재현 명령(app 기준); stage runner가 선택21파일 목록과 순서를 갖는다.

```text
node .tmp-verify-0249-stages.mjs
node --test --test-reporter=junit --test-reporter-destination=.tmp-verify-0249-scripts-elevated.xml scripts/*.test.mjs
node node_modules/vitest/vitest.mjs run src/renderer/src/features/chat/store/chatStore.planOwner.test.ts --reporter=json --outputFile=.tmp-verify-0249-X1.json
node node_modules/eslint/bin/eslint.js ./src ./scripts
npm run typecheck
node scripts/check-doc-inventory.mjs --check
node scripts/check-test-budgets.mjs
node scripts/check-migrations-appendonly.mjs
```

stage 산출은 `app/.tmp-verify-0249-{UT,IT,ST,AT}-elevated.json`이다. 등록 M-F1~10·M-D1~10 **20건은 모두 미실행**이다. 정의는 독립 대조했으나 실제 baseline X1 실패를 확인한 뒤 재구현으로 이관했다. 구현자가 보고한20red를 이번 증거로 받지 않았고 승계 변이 red→green도 판정하지 않았다. 검증자 변이 적용0건. 임시 runner/report는 구현 산출과 분리하며 **X1 fixture는 후속 재검증을 위해 보존**한다.

## 3. Pair 판정·AC·§10

| pair | 수준 / requiredness | 결과 | 직접 증거 |
|---|---|---|---|
| VP-38 | MD↔UT / REQUIRED | PASS | SDK mode6종/unknown·Enter 입력{}/message·Exit filePath 계약 |
| VP-12 | MD↔UT / REGRESSION | PASS | 실제 일반 파일·8.3·상한·링크·오류·close |
| VP-13′ | MD↔UT / REGRESSION | PASS | 파일/입력 출처·BOM/CRLF/공백·경로·정상 입력 reference |
| VP-36 | SD↔ST / REQUIRED | PAIR_FAIL | X1의 init 전 요청이 다른 세션 entry에 저장됨 |
| VP-35 | R↔AT / REQUIRED | BLOCKED_BY:VP-36 | owner draft의 승인 카드가 없어 해당 live 종단을 닫을 수 없음 |

나머지 선택7은 직접 oracle green이지만 등록 변이를 실행하지 않아 **closeout 미발행**이다. 종속 실패로 과장하지 않는다.

| pair | 직접 관측 | 남은 선택 변이 |
|---|---|---|
| VP-33 | main/id/tool 식별·동일 reference | F1·2·4·6 |
| VP-34 | persist 선행·실제 DB args/owner·decoder·오류 전파 | F3·4·5·7 |
| VP-37 | 실제 controller/renderer·latest delegates·old/child/replay | F8·9·10 |
| VP-09′ | 파일 정본·CLI 입력·추가 필드·child 음성 | D1·2′·3′·4′·10 |
| VP-10 | main Write/Edit·Stop·child 음성 | D5·6 |
| VP-11′ | query hook/getter 동일 셀·env | D7·8·9 |
| VP-20 | 입력→서술→empty·계획 패널 SSR | D10 |

완료 판정5 + 미발행7 + 비영향 NOT_REQUIRED25 = 유효37. 선택12 전체 PASS를 발행하지 않는다. 신규 AC4는 **AC24❌·AC25❌·AC26✅·AC27✅ = ✅2·❌2**다. 기존 유효21 + 신규4 =25를 재검산했지만 이번 검증이 기존21 전건의 새 PASS를 발행한 것은 아니다. 구현 본문/trailer의25/25와 기존 INDEX SELF_PASS는 서로 일치했으나 X1로 완결 성공 주장은 성립하지 않는다.

| §10 행 | 독립 재열거 | 관측 / 한계 |
|---|---:|---|
| EP-04′ | 8 | 기존7항목 중 ③ 배선은 hook 병합·동일 셀 getter 전달 두 edge; 파일/resolver 직접 실행 |
| EP-11 | 6 | started·action.input·persist·late started·SQL·reducer; F1~6 미실행 |
| EP-12 | 4 | helper·턴 Map·SQL scope·reducer id/name; requester→store owner 실패를 덮지 못함 |
| EP-13 | 6 | 마지막 controller set+renderer send는 두 sink; 직접 mode 실행, F8~10 미실행 |
| EP-14 | 4 | 설치 SDK 입력/결과·plan 메타/ΔV3·INDEX 재독 |

8+6+4+6+4 = **28 지정 자리**를 확인했으며 이를28/28 계약 통과로 해석하지 않는다. D5는 이미 명시된 소유 세션 계약을 requester→store edge에서 깨는 구현 실패다. 설치 SDK0.3.286 타입에서 Enter 입력{}/결과message와 Exit 결과plan/filePath를 재독하고 adapter oracle의 내부 입력planFilePath와 결과filePath 구분도 확인했다.

## 4. 운영 정합성·이관

INDEX는 verify/FAIL·다음Codex 한 명·라운드2·로컬 실재 ref로 갱신했다. 구현 trailer는 Agent:codex·Handoff·Status:implemented·Criteria-Met:25/25·Verified-By:pending **5행이 실제 파싱**된다. 구현 보고7필드가 모두 있고 AGENTS 변경은 없다. archive 이동은 하지 않는다.

로컬 main...origin/main은0/0이나 원격 최신 조회·공유 브랜치 게시·CI 통과를 증명하지 않는다. 원격 쓰기는 수행하지 않았다. 실제 외부 모델·Windows 앱 시각 실기도 미실행이며 기존 r1 §8의 외부 확인 범위를 유지한다. 구현자157파일1658·20변이red는 자기 보고이고 이번 독립 증거는21파일356와X1이다.

| ID | finding | 귀속 / disposition | 후속 |
|---|---|---|---|
| D5 | init 전 새 대화 계획 승인 요청의 다른 세션 표시 | BLOCKING; D-033·AC24/25; rootVP-36, 종속VP-35 | requested/resolved pending owner→승격 보존, X1 재실행 |

D5를 plan의 [검증자 기입]에 이관했다. 기존D1~D4는 위 비영향 판정을 참조한다. Review Signals: 이전 reader/extraDirs 증상과 다르며 D-033·AC25가 순서/owner를 명시했고 새 제품 결정 변경은 없다. 반복 lstat EPERM은 권한 대조로 해소됐다.

**다음: Codex 라운드2.** D5 수정 뒤 X1·영향 pair·등록 변이·적용 gate를 독립 재검증한다. 이번 판정은 PASS3·root PAIR_FAIL1·BLOCKED_BY1·미발행7, PLAN_GAP0이며 FAIL은 확정이다.

---

# Verify ΔV3.2 r2 (2026-10-06)

**FAIL.** 실제 하위 ExitPlanMode를 승인하면 renderer와 다음 메인 send payload가 `plan`에서 `accept_edits`로 바뀐다. 승인·수정·구조화 코멘트·거부 네 응답이 다른 요청 ID 또는 이미 해결된 ID에도 현재 승인 상태를 바꾸거나 IPC를 발행한다. 기존 D5는 독립 X1 재실행으로 닫았으며 새 승인 소비자 결함 D6를 이관한다.

## 0. 기준선·독립성·plan validity

| 항목 | 값 |
|---|---|
| 검증자 / 독립성 | Codex 독립 subagent; 구현 agent와 별도. 구현 보고를 실행 증거로 받지 않음 |
| 대상 | 로컬 구현 `463019d78c9690c345bbe006bd186a0ab15fe1c3`; main 기준 `ceda5c5a` |
| 설계 기준 | ΔV3 `68c39bdd`+`b110cca6` → ΔV3.1 `0a59d198` → ΔV3.2 `72e2d8eb`+`0552d740` → B6 ID 정정 `1576d485` |
| 별도 보고 정정 | `68f1a8c93ac694cf7075aab4eba50e0f9c974db0`; 제품 규범·production·tests 변경 없음 |
| 유효 V / 선택 | V1+ΔV1+ΔV2+ΔV3+ΔV3.1+ΔV3.2; 유효37, REQUIRED7+REGRESSION10=17, NOT_REQUIRED20 |
| 상태 / 후속 | r2 FAIL → 보드 라운드3·다음 Codex; 원격 공유 게시·CI는 미확인 |

모든 대상 ref를 `git cat-file -t`로 commit 실재 확인했다. `1576d485..463019d7`의 plan diff는 `[구현자 기입]` 108줄 추가이며 규범 행 변경0이다. 구현 보고의 AC18~23 등 설명 오매핑은 독립 지적 뒤 별도 `68f1a8c9`에서 보고17행만 정정됐다.

**PLAN_GAP0.** 같은 레벨 pair·영향 회귀·production path·§10·oracle·등록29변이·운영 gate가 유효하다. ΔV3 Product/UX 하위 호출 행은 “메인 도구 카드·계획 모드에도 영향을 주지 않는다”를 명시하며 D-033/AC25가 다른 호출의 소유권을 규정한다. 따라서 D6는 기존 계약의 구현 실패이며 신규 제품 선택이 필요하지 않다.

## 1. 역방향 발견 D6 — 승인 소비자 경계

**BLOCKING, root VP-36 PAIR_FAIL.** producer의 child guard와 실제 controller가 올바르게 동작해도 `chatStore.approvePlan` 소비자가 메인 mode를 무조건 바꾼다. `RESOLVE_PLAN` 전에 남아 있는 `providerRequest.agentId`·현재 `requestId`를 검사하지 않는다.

| X2 축 | 기대 | 직접 관측 |
|---|---|---|
| main 승인 양성 | renderer/controller/다음 payload 모두 `accept_edits` | PASS; SDK allow + `updatedPermissions` 있음 |
| 실제 child 승인 | renderer/controller/다음 payload 모두 `plan` | FAIL; `accept_edits`/`plan`/`accept_edits` |
| 다른 approvalId | 현재 request 유지·mode=`plan`·respond0 | FAIL; request=null·mode=`accept_edits`·respond1 |
| 이미 해결된 approvalId | request=null·mode=`plan`·respond0 | FAIL; request=null·mode=`accept_edits`·respond1 |
| revise/comments/reject × 다른 ID(3) | 현재 request/세션 reference 유지·respond0 | FAIL3; request=null·mode=`plan`·respond1 |
| revise/comments/reject × 해결된 ID(3) | 원래 세션 reference 유지·respond0 | FAIL3; request=null·mode=`plan`·respond1 |

새 정식 fixture는 `app/src/renderer/src/features/chat/store/chatStore.planModeIsolation.test.ts`다. 실제 `makeCanUseTool` → requester → ApprovalBroker → transport → `ingestChatEvent`/reducer → `approvePlan` → 다음 `send`를 연결했다. child allow 응답에 `updatedPermissions`가 없고 이웃 세션 reference가 유지됨을 실패 단언 전에 확인한다(`:90~99`).

production 원인은 `app/src/renderer/src/features/chat/store/chatStore.ts:1653~1663`의 무조건 respond·`RESOLVE_PLAN`·`SET_PERMISSION_MODE`다. 같은 파일 `:1666`·`:1679`·`:1689`의 revise/comments/reject도 ID 검사 없이 respond·`RESOLVE_PLAN`을 실행하며 X2 `:107`의8축에서 세션/request reference와 IPC 음성을 직접 비교했다. 다음 payload는 실제 `send`가 생산하며 main `send.ts:456~465`가 이를 controller/renderer에 게시한다; X2가 그 main handler를 재호출해 이후 controller까지 측정한 것은 아니다.

해결된 ID 축은 현재 요청 없음 상태를 임의 조립한 대조가 아니다. 실제 `permission.requested('stale')` → `permission.resolved('stale', deny)`를 production store에 전달해 pending=null을 확인한 뒤 네 stale 버튼 응답을 실행했다(X2 `:141~167`). SDK에 이전 요청을 보내 실제 모델의 해결까지 실행한 것은 아니다.

귀속은 plan의 ΔV3 Product/UX 하위 호출 행 + D-034/AC26, stale ID 축은 D-033/AC25다. requester `approval.ts:106`와 SDK adapter의 main-only 권한 변경 guard는 양성/음성 대조에서 정상이다. 파일 정본·모드 observer·채널 폐기 producer만 확인하면 이 낙관적 승인 consumer를 놓친다.

## 2. 직접 테스트·운영 gate

UT → IT → ST → AT를 직접 순차 실행했고 reporter의 파일/실행 assertion을 따로 합산했다. 실제 SQLite DB는 설치된 plain Node ABI127로 실행했으며 설치·ABI 전환·production 수정·autofix는 없다.

| 단계 | 파일 | pass / fail / skip | 관측 범위 |
|---|---:|---:|---|
| UT | 6 | 98 / 0 / 0 | 식별/mode·resolver/reader·순수 completion store |
| IT | 7 | 149 / 0 / 0 | requester·실제 DB writer·runtime81·observer·send/controller·fresh TurnContext |
| ST | 5 | 79 / 0 / 0 | 실제 adapter query 및 approval lifetime18 |
| AT | 7 | 85 / 0 / 0 | Work/Code SSR·reducer·store·owner10·app attention19 |
| baseline 합계 | 25 | 411 / 0 / 0 | 중복 파일 없음; 구현자178파일1842와 별개 측정 |
| 독립 X2 | 1 | 1 / 9 / 0 | main 양성·child·4응답×다른/해결된 ID |

| gate | 직접 관측 |
|---|---|
| scripts | 독립 JUnit testcase132·failure0·error0 |
| lint no-fix | 전체 src/scripts error0·기존 warning1(`useTranscriptVirtualizer.ts:22`); 새 X2 error0/warning0 |
| typecheck | node/web/test3종 진단0; X2 추가 뒤 test typecheck 진단0 재확인 |
| doc-inventory | generated inventory·본문 수치·상대 링크 검사 정상 |
| test-budget / migration | 실제 git fixture16 suites·schema28/mail1 sync·no-copies·append-only 정상 |
| diff / 소스 고정 | `git diff --check` 정상; 이번 검증의 production 변경0 |

실행 명령(app 기준); 단계별 선택25파일은 독립 runner `.tmp-verify-0249-r2-stages.mjs`에 고정했다.

```text
node .tmp-verify-0249-r2-stages.mjs
node --test --test-reporter=junit --test-reporter-destination=.tmp-verify-0249-r2-scripts.xml scripts/*.test.mjs
node node_modules/vitest/vitest.mjs run src/renderer/src/features/chat/store/chatStore.planModeIsolation.test.ts --reporter=json --outputFile=.tmp-verify-0249-r2-X2.json
node node_modules/vitest/vitest.mjs run src/renderer/src/features/chat/store/chatStore.planModeIsolation.test.ts --reporter=verbose
node node_modules/eslint/bin/eslint.js ./src ./scripts
npm run typecheck
node scripts/check-doc-inventory.mjs --check
node scripts/check-test-budgets.mjs
node scripts/check-migrations-appendonly.mjs
```

산출은 `app/.tmp-verify-0249-r2-{UT,IT,ST,AT}.json`·`stage-results.json`·`scripts.xml`·`X2.json`이다. 실제 파일 reader/DB/scripts는 이전 독립 r1.4에서 확인한 sandbox `lstat C:/Users/rlaeo EPERM`을 피하는 승인된 local-only 권한 승격으로 실행했다. X2의9실패는 assertion 차이이며 환경 실패가 아니다.

## 3. Pair 판정·§10·미실행

| pair | 수준 / requiredness | 결과 | 직접 증거 |
|---|---|---|---|
| VP-38 | MD↔UT / REQUIRED | PASS | SDK6종/unknown·Enter `{}`/message·Exit filePath |
| VP-12·13′ | MD↔UT / REGRESSION | PASS(각1) | 실제 파일 경계/링크/close·출처 표·정상 입력 reference |
| VP-05 | MD↔UT / REGRESSION | PASS | completion store8건: Map·마지막 사유·identity·열람/삭제 |
| VP-04 | AR↔IT / REGRESSION | PASS | 실제 app→chat→sessions 구독 통합과 전체 boundaries lint0 |
| VP-03 | SD↔ST / REGRESSION | PASS | app19건:3종 승격·해결·열람 해제·재방출·unsubscribe 수명 |
| VP-19 | R↔AT / REGRESSION | PASS | 실제 완료 Map/tick 보존·SessionRow의 완료/대기 동일 class SSR |
| VP-36 | SD↔ST / REQUIRED | PAIR_FAIL | X2: child 승인 후 메인 mode 오염 및 stale ID의 현재 요청 제거 |

나머지 선택9는 직접 baseline oracle green이나 해당 등록 변이 미실행으로 **closeout 미발행**이다. VP-35는 X1 때의 종속 판정을 복사하지 않는다: r2 카드 표시/값은 독립 관측됐으며 이번 결함과 같은 이유로 `BLOCKED_BY`를 추가하지 않는다.

| closeout 미발행 pair | 아직 실행하지 않은 선택 변이 |
|---|---|
| VP-33·34·35 | F1~7·owner F11·12 및 해당 취소 경로 F13·14 |
| VP-37 | F8~10·자연 retire F15 |
| VP-09′·10·11′·20 | D1~10의 해당 자리 |
| VP-02 | B1~3·신규 B6 승격 통지 |

**PASS7 + PAIR_FAIL1 + 미발행9 + NOT_REQUIRED20 = 유효37.** 이번 FAIL의 root는1개이며 종속 실패0, PLAN_GAP0이다. AC25/26과 Product/UX child 경계는 X2로 실패했고 AC24/27의 기존 baseline 양성은 관측했으나 유효 AC25개 전체의 완결 PASS를 발행하지 않는다. 구현 본문/trailer의25/25는 자기보고이며 독립 결과가 이를 지지하지 않는다.

§10 물리 자리의 재열거는 EP-04″8(기록·Stop·hook·getter·resolver·request·allow·reader), EP-11 6(started·action·persist·late started·SQL·reducer), EP-12″9(기존 owner4·noid requested/resolved2·early signal/wrapper/common retire3), EP-02′9(기존8·승격 통지1), EP-13′6(report·app callback·frame/adapter delegate·controller·renderer), EP-14 4(SDK 입력/결과·plan/ΔV3·INDEX)다. 지정 **42자리**를 소스에서 대조했으며42/42 계약 PASS로 해석하지 않는다. `approvePlan` 소비자는 이미 명시된 child/소유권 계약을 깨므로 지정 표 밖이라는 이유로 D6를 낮추지 않는다.

**등록29건 모두 독립 미실행**: F1~15·D1~10·B1~3·B6. 정의/필터를 독립 대조한 후 X2 baseline 결함을 확정해 이관했으며 mutation window를 시작하지 않았다. 제거 red·byte복원·동일 필터 green, F9/10/F13~15의 실제 실행/skip, 이전 red→green 민감도 비교는 모두 미측정이다.

## 4. 저장소 운영·보고 정합성

구현 trailer는 Agent:codex·Handoff·Status:implemented·Criteria-Met:25/25·Verified-By:pending **5행 실제 파싱**이다. 재구현 보고7필드(설계 리뷰·강제 지점·수정 잠금·Product/UX 파생·놓친 문제·구현 보고·Review Signals)가 있으며 AGENTS 변경0이다. INDEX는 verify/FAIL·다음Codex 한 명·라운드3·실재 로컬 구현/보고 좌표로 갱신하고 archive 이동하지 않았다.

`68f1a8c9`는 구현자가 유효 AC 의미와 다른 설명을 쓴 보고 문제의 정정이며 제품 기준 변경으로 받지 않았다. 로컬 main...origin/main0/0은 원격 최신/게시/CI를 증명하지 않는다. 자동 승인 검토가 목적지 권한 불명확으로 거부한 원격 push는 실행하지 않았으며 로컬 source 검증과 분리한다.

## 5. 파생 이슈 이관

| ID | 독립 판정 / 근거 | 후속 |
|---|---|---|
| D5 | closed: 보존된 X1 기대값 포함 owner10건 green; noid requested/resolved·FIFO·re-key 직접 관측 | 관련 등록 변이의 pair closeout은 미발행으로 유지 |
| D6 | open/BLOCKING: main 양성1 PASS·child1/4응답 stale8 FAIL; VP-36·D-033/AC25·D-034/AC26·Product/UX child 행 | 4소비자의 requestId/owner guard와 승인 전 child snapshot을 유지, X2 재실행 |
| D1·D2·D4 | 기존 NON_BLOCKING open 유지; 이번 검증에서 수정/재판정하지 않음 | 별도 잔여 보존 |

D6와 D5 판정을 plan의 `[검증자 기입]`에만 반영했으며 normative 행은 변경하지 않았다. 정식 X2는 후속 재검증을 위해 보존한다. 신규 fixture만 포맷했고 baseline production/tests bytes는 그대로다.

## 6. 외부 경계·Review Signals·다음 작업

실제 외부 모델·Windows 앱 시각 실기·공유 브랜치 게시/원격 CI는 미실행이며 기존 r1 §8의 실기 범위를 유지한다. 도구 카드/계획 패널/SessionRow의 SSR·상태는 기계 관측이고 앱 시각 실기를 대신하지 않는다. 새 dependency/owner cache/ABI 전환은 없다.

Review Signals: D5의 noid 라우팅 증상은 해소됐고 D6는 같은 소유권/child 경계의 기존 승인 소비자에서 발견됐다. 관련 D-033·AC25·Product/UX child 계약은 이미 있었고 사용자 결정 변경0이다. 반복 sandbox lstat 제한은 local-only 실행으로 분리했다.

**다음: Codex 라운드3.** D6 수정 후 X2·영향 pair·등록 변이·운영 gate를 독립 재검증한다. 이번 판정은 명시 계약 위반에 따른 FAIL이며 미실행29변이와 외부 경계는 성공 증거로 합산하지 않는다.

---

# r3 — ΔV3.3·ΔV3.4 독립 검증 (2026-10-07)

**PASS (기계 범위).** 선택 pair 17개(REQUIRED7·REGRESSION10)를 닫았다. 등록41개와 독립 구독 대조2개는 각각 assertion red → 원본 byte 동일 복원 → 동일 필터 green이다. D6는 closed, PLAN_GAP0·root PAIR_FAIL0·BLOCKED_BY0이다. 실 모델·Windows 시각·원격 게시/CI는 미실행이며 archive 이동은 보류한다.

| 메타 | 값 |
|---|---|
| 검증자 | 독립 위임 agent(handoff-verify 역할), 이번 production/정식 test 미작성 |
| 기준/대상 | INDEX의 ΔV3.3·3.4 설계 및 r3 로컬 frozen 구현 |
| 라운드/상태 | 3 / PASS(기계 범위); 기존 r1.4·r2 FAIL 원문 보존 |

## 0. 기준선·규범·보고 대조

실재 로컬 구현/설계 좌표는 [INDEX의 0249 행](../INDEX.md)에 기입했다. 고정 HEAD와 설계3건에 각각 `git cat-file -t`가 `commit`을 반환했다. 설계와 구현은 별도 커밋이며 구현의 plan diff는 `[구현자 기입] r3` 추가뿐이다. Decision·Product/UX·AC·V 규범 변경0, AGENTS 변경0이다. 구현자와 검증자는 별도 agent이며 구현자 측181파일1883·41변이 자기 결과는 이번 증거로 받지 않았다.

| 검사 | 직접 판정 |
|---|---|
| 유효 V | V1+ΔV1+ΔV2+ΔV3~3.4; 유효 AC25·pair37 |
| 선택/승계 | REQUIRED7+REGRESSION10=17, NOT_REQUIRED20; superseded pair의 기존 이관 유지 |
| path·직접 oracle | 파일/승인/DB/card·draft/attention·mode·main/child 수명·네 응답 소비자까지 확인 |
| §10 분모 | 지정54 → 실측56; EP02의 이미 명시된 구독 운반3자리 재측정(§4) |
| PLAN_GAP | 0; 필요한 계약·path가 명시돼 있어 새 제품 선택 없이 닫힘 |
| 구현 trailer | Agent/Handoff/Status/Criteria-Met/Verified-By 실제5행 파싱; Criteria-Met25/25는 자기보고 |
| 공유 상태 | 로컬 main/origin-main 동일·좌우0/0; 원격 최신/게시/CI의 증거로 확대하지 않음 |

구현 보고의 필수7필드도 독립 대조했다.

| 필드 | 확인 |
|---|---|
| 설계 리뷰 | D6 네 응답·child mode 및 await 전 main signal의 기존 계약을 설명 |
| 강제 지점 | 전수 표 존재; “54물리” 자기 수량은 이번 실측56으로 정정 |
| 수정 잠금 | 등록41 정의 존재, 이번에 모두 새 실행 |
| Product/UX 파생 | child 격리·취소·늦은 응답·surface 소비자 대조 |
| 놓친 문제 | main interrupt await 및 F25 false green을 숨기지 않고 기록 |
| 구현 보고 | AC25 의미와 gate/외부 한계를 구별; frozen source와 일치 |
| Review Signals | r3 유지, 사용자 결정 drift0·SDK/CLI 순서 미확인 명시 |

## 1. 결과의 비판적·역방향 검토

파일 정본은 승인 시점에 다시 읽는다. `started → callback`과 역순 모두 보정 입력이 requester persistence → writer/실제 SQL → reducer → Work/Code 라이브·재로드 카드에 전달된다. 다른 call/session/turn·child의 입력과 parent/result는 보존된다. 보정 Map은 기존 TurnContext 수명이고 새 owner cache·IPC·schema·의존성은 없다.

`currentPlanReview`는 resolve 전에 key/session/review를 캡처한다(`chatStore.ts:1653`). 네 응답 호출(:1668/1685/1700/1712)은 현재 미해결 ID가 아니면 IPC·state·mode를 바꾸지 않는다. 유효 child approve(:1673)는 SDK allow를 유지하면서 메인 mode를 보존한다. X1 정식 fixture의 변경0, X2 최초10개 기대값 변경0을 diff로 확인했고 실제 requester/broker를 통과하는 유효 응답3개 추가만 확인했다.

원 signal 생산3곳(`send.ts:503`, `continuation.ts:44,69`) → runAttempt/runListen adoption2곳(`session-runtime.ts:390,411`) → scalar 공표(:406) → captured-channel getter(:847) → actual query(`claude.ts:611`) → main 첫 await 전 단일 캡처(:194~199) → Exit await 후 동일 signal 인자(:245)를 대조했다. 두 타입 정의는 운반 계약으로 별도 확인했다. `signal`은 FRAME delegate 목록에 추가되지 않았고 listen/flush의 fresh signal이 유지된다. adopt→teardown→respawn에서도 새 scalar를 지우지 않는다.

이미 취소된 main은 파일·서술 getter/approval surface side effect0이다. 대기 중 main 취소는 기존 wrapper/requester가 막고, 살아 있는 child는 main getter를 읽지 않으며 자신의 SDK signal이 취소될 때까지 유지된다. 공통 retire는 observer/close보다 먼저 captured channel을 취소한다(`session-runtime.ts:747,752,755`). `init/status.permissionMode`만 실제 controller/renderer로 전달되며 child·unknown·retired 보고는 배제한다.

역방향 `scan-surface.sh 33c7c628..7b32d299`는 현재 고정 source4파일에서 미사용 runtime export·test-only symbol·형제 정책 비대칭 후보0이다. 처음 실행의 Git Bash utilities PATH 누락은 PATH를 `/usr/bin`으로 보완해 재실행했으며 불완전 첫 출력을 성공 증거로 쓰지 않았다. 코드의 실제 생산/소비자도 위 경로로 별도 읽었다.

설치 SDK0.3.286의 `sdk.mjs`는 control 요청마다 AbortController를 만들고 `control_cancel_request`에서 해당 signal을 취소한다. `interrupt()`는 interrupt control request를 발신하며 이 callback들을 직접 취소하지 않는다. `sdk.d.ts`는 callback signal의 취소 의미를 규정하지만 cancel-before-terminal 순서는 보장하지 않는다. 새 fixture는 production `claudeToNormalized(result/error_during_execution)`로 drain을 해소한다. 실제 CLI가 주입한 순서를 발생시키는지는 **미확인**이다. 앱 포트의 main owner 보존과 CLI 발생 빈도는 별개다.

## 2. 직접 단계 검사·운영 gate

UT → IT → ST → AT 순서로 독립 runner의 명시29파일을 실행했다. reporter의 실제 assertion status를 세었고 중복 파일0이다. real reader/DB는 설치된 plain Node22.15.1·ABI127로 실행했다.

| 단계 | 파일 | pass / fail / skip | 직접 범위 |
|---|---:|---:|---|
| UT | 7 | 144 / 0 / 0 | 입력 식별/mode·resolver/reader·canUseTool·completion store8 |
| IT | 10 | 169 / 0 / 0 | requester·실제 SQL15·runtime81·observer/controller·send·continuation·actual query |
| ST | 3 | 39 / 0 / 0 | narrative2·lifetime18·main-scope19 |
| AT | 9 | 116 / 0 / 0 | 카드/계획 SSR·reducer·Work응답·X1 owner10·X2 13·nav/app attention |
| 합계 | 29 | **468 / 0 / 0** | 구현자181/1883과 별개 직접 측정 |

| gate | 직접 산출 |
|---|---|
| full lint no-fix | src/scripts1416파일, error0·기존 warning1(`useTranscriptVirtualizer.ts:22`) |
| typecheck | node/web/test3종 각각 exit0·진단0 |
| scripts 기본 sandbox | testcase132 중 failure8/error0; 8건 모두 `lstat C:\Users\rlaeo EPERM` |
| scripts 동일 승격 대조 | testcase132·failure0·error0; 설치/실제 ABI 전환 없음 |
| doc-inventory | generated9항목·102채널 일치, prose/relative links 정상 |
| test-budget | 실제 git fixture16 suites 정상 |
| migration | schema28/mail1 sync·source1393 no-copies·v0.3.1 이후 append-only 정상 |
| diff/소스 보존 | 변이 종료 후 src/scripts/package diff0·tracked clean·diff --check0 |
| 메시지 버스 | 구현 trailer5행 파싱, 로컬 main/origin-main0/0·실재 commit 확인 |

scripts의8실패는 ensureSqliteAbi의 electron fast-path/rebuild/marker/check, node rebuild/check, shell 운반, spawn 실패 보존 사례다. 같은 명령을 local-only 권한 승격으로 재실행해132green을 확인했다. 실제 Electron ABI140로 전환하거나 의존성을 설치하지 않았다.

재현 명령(app 기준):

~~~text
node .tmp-verify-0249-r3-stages.mjs --execute
node .tmp-verify-0249-r3-mutations.mjs --execute
node .tmp-verify-0249-r3-subscription-mutations.mjs --execute
node --test --test-reporter=junit scripts/*.test.mjs > .tmp-verify-0249-r3-scripts-{sandbox|elevated}.xml
node node_modules/eslint/bin/eslint.js ./src ./scripts --format json --output-file .tmp-verify-0249-r3-eslint.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json --composite false
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.web.json --composite false
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.test.json
node scripts/check-doc-inventory.mjs --check
node scripts/check-test-budgets.mjs
node scripts/check-migrations-appendonly.mjs
~~~

새 결과는 `app/.tmp-verify-0249-r3-{UT,IT,ST,AT}.json`, `stage-results.json`, `mutation-results.json`, `subscription-mutation-results.json`, `mut-<ID>-{red,green}.json`, scripts XML, lint JSON에 직접 남겼다. 파일 목록/필터는 두 독립 runner에 고정했다. 임시 증거의 최종 정리는 root가 맡으며, 정식 fixture와 이 문서의 재현표는 보존한다.

## 3. V-pair closeout·AC

| pair | 레벨 / requiredness | 결과 | 직접 oracle·선택 변이 |
|---|---|---|---|
| VP-05 | MD↔UT / REGRESSION | PASS | completion Map8·마지막 사유·identity·삭제 |
| VP-12 | MD↔UT / REGRESSION | PASS | real reader 일반/8.3·상한·링크·오류·close |
| VP-13′ | MD↔UT / REGRESSION | PASS | 출처/정규화·정상 입력 reference, D1~4·10 |
| VP-33 | MD↔UT / REQUIRED | PASS | 같은 main call 식별·다른 ID/tool/child 음성, F1·2·4·6 |
| VP-38 | MD↔UT / REQUIRED | PASS | SDK mode6종/unknown·Enter `{}`/message·Exit filePath |
| VP-04 | AR↔IT / REGRESSION | PASS | app→chat/sessions 값·boundaries lint0, X3·X4 |
| VP-11′ | AR↔IT / REGRESSION | PASS | actual query hook/getter 동일 셀·env, D7~9 |
| VP-34 | AR↔IT / REQUIRED | PASS | persist-before-send·SQL owner/args, F3~5·7·13·14·22~27 |
| VP-37 | AR↔IT / REQUIRED | PASS | actual mode→controller/renderer·latest/retired delegates, F8~10·15·16 |
| VP-03 | SD↔ST / REGRESSION | PASS | 3종 승격·해결·열람·재방출·unsubscribe 수명 |
| VP-10 | SD↔ST / REGRESSION | PASS | Write/Edit 마지막 main·Stop·child 음성, D5·6 |
| VP-36 | SD↔ST / REQUIRED | PASS | 양방향 순서·X1·X2·자연 retire·main await/child, F4·11~27·D5·6 |
| VP-02 | R↔AT / REGRESSION | PASS | 요청/승격→app→주의 Map→같은 파랑 SSR, B1~3·B6·X3·X4 |
| VP-09′ | R↔AT / REQUIRED | PASS | 승인 시점 파일→request/action/CLI, D1~4·10 |
| VP-19 | R↔AT / REGRESSION | PASS | 완료 tick/표시 보존·SessionRow, X3 |
| VP-20 | R↔AT / REGRESSION | PASS | 파일 없는 입력/서술/empty·계획 SSR, D10 |
| VP-35 | R↔AT / REQUIRED | PASS | actual adapter/history/reducer→Work/Code live/reload, F1·2·6·11·12 |

**PASS17 + NOT_REQUIRED20 = 유효37.** root PAIR_FAIL0·종속 BLOCKED_BY0이다. NOT_REQUIRED는 VP-01·06′·07′·08′·15·16·17·18·21′·22·23′·24′·25·26·27·28·29·30·31·32이며, 이번에 다시 실행한 PASS로 합산하지 않는다.

| 유효 AC | 기계 판정·증거 |
|---|---|
| AC2·3·4·5 | ✅4 — 3종 요청·승격·열람·noid/unknown/해결·마지막 사유·삭제, app/nav/store 및 B/X3/X4 |
| AC9′·10′·11·14′·21 | ✅5 — 파일 정본/기존 fallback·reader 보안·actual query·정상 입력 reference, D1~10 |
| AC18 | ✅1 — 위 현재 변경 gate 직접 산출·실재 trailer |
| AC24·25·26·27 | ✅4 — 종단 입력/DB/card·X1/X2 owner·child·main 수명·actual mode, F1~27 |
| AC1·6′·7′·8′·15·16·17·19′·20·22·23 | ✅11 승계 — 기존 r1 PASS의 비영향 영역, 이번 변경 diff와 소비 경계 재독 |

유효 ID를 직접 다시 세면 **✅25·⚠️0·❌0=25(기계 범위)**다. 현재 직접 측정14와 기존 독립 PASS 승계11을 구별한다. 기존 시각/실 모델4항목은 이 기계 합계와 별도 대기다.

## 4. §10 전수·분모 정정

| 행 | plan 지정 | 독립 실측 | 재검색한 실제 자리 |
|---|---:|---:|---|
| EP-04″ | 8 | 8 | record·Stop·hook merge·동일 셀 getter·resolver·request.plan·allow.updatedInput·declared reader |
| EP-11 | 6 | 6 | started·action.input·requester persistence·late started·SQL·reducer |
| EP-12⁗ | 20 | 20 | 기존 owner/퇴역9 + 현재 review helper/호출5 + main 캡처/adopt/getter/query/entry abort/await 인자6 |
| EP-02′ | 9 | **11** | 원래8항목의 app 구독③을 실제3자리로 풀고 승격1 추가 |
| EP-13″ | 7 | 7 | adapter report·app callback·frame/adapter delegates·controller·renderer send·child mode guard |
| EP-14 | 4 | 4 | 설치 SDK 입력/결과·plan 메타·유효 ΔV3 규범·INDEX 상태 |
| 합계 | **54** | **56** | 동일 계약이 다른 EP에서 소비되면 해당 계약 자리로 각각 대조 |

EP02의 대응표는 다음과 같다.

| 지정 항목 | 실제 위치 | 실제 수 |
|---|---|---:|
| ① 요청 통지 | `chatStore.ts:797` | 1 |
| ② 완료 통지 | `chatStore.ts:789` | 1 |
| ③ app 구독 | `useSessionCompletion.ts:7` 완료 등록, `:8` 응답 등록, `:20` mount effect | **3** |
| ④ 응답 대기 mark | `sessionsStore.ts:254` | 1 |
| ⑤ 완료 mark | `sessionsStore.ts:250` | 1 |
| ⑥ 열람 해제 | `sessionsStore.ts:258` | 1 |
| ⑦ 삭제 해제 | `sessionsStore.ts:163` | 1 |
| ⑧ 행 표시 | `SessionRow.tsx:59` | 1 |
| ⑨ 승격 통지 | `chatStore.ts:830` | 1 |

plan의 원 EP02 및 구현 상세는 두 구독 합성과 effect 소비를 이미 명시한다. 기존 보고도 운반 세분10을 적었다. ΔV3.1이 기존8+승격1을9로 승계하고 최신 표가 이를 물리 분모에 합쳐, r3 자기보고의 “54물리”가 실제56과 달라졌다. 검증 skill §0의 “path에 명시된 계약 운반 edge는 PLAN_GAP 대신 분모 재측정”을 적용했다. 누락된 제품 계약/구현 선택은 없으며 normative 행을 수정하지 않았다. 독립 X3/X4는 추가 두 구독을 각각 제거해 semantic 통지가 실제 끊어짐을 잠갔다.

지정 항목과 검색 집합의 **미대조 차집합0**이다. 신호 생산3·adoption 호출2·타입 운반2는 §10 지정과 구별해 함께 읽고 실제 main-scope/continuation/query oracle로 관측했다. 동일 불변식의 화면 형제4곳은 각 ID 변이로 따로 대조했다.

## 5. 등록41·독립2 민감도

각 행은 한 생산 자리만 변조했다. 실제 failed assertions가 있는 exit1만 red로 받았고, finally에서 원본 Buffer byte 동일 복원 뒤 같은 파일/필터가 green인지 재실행했다. skip은 실행/성공 분모에서 제외했다. 초기 임시 집계가 `pending`만 세어 `skipped`를 로그에서0으로 표시했으므로, 최종 표/JSON은 원 reporter의 두 status와 `numPendingTests`를 대조해 교정했다. 실행/실패 수와 원 reporter는 변하지 않았다.

| ID | 실패 / 실제 실행 | skip | 원복 같은 필터 pass |
|---|---:|---:|---:|
| F6 | 2 / 4 | 0 | 4 |
| F9 | 2 / 2 | 79 | 2 |
| F10 | 2 / 2 | 79 | 2 |
| F1 | 1 / 92 | 0 | 92 |
| F2 | 4 / 92 | 0 | 92 |
| F3 | 4 / 5 | 0 | 5 |
| F4 | 2 / 15 | 0 | 15 |
| F5 | 5 / 15 | 0 | 15 |
| F7 | 1 / 15 | 0 | 15 |
| F8 | 1 / 92 | 0 | 92 |
| D1 | 9 / 92 | 0 | 92 |
| D2′ | 12 / 92 | 0 | 92 |
| D3′ | 10 / 92 | 0 | 92 |
| D4′ | 20 / 92 | 0 | 92 |
| D5 | 3 / 92 | 0 | 92 |
| D6 | 2 / 92 | 0 | 92 |
| D7 | 5 / 92 | 0 | 92 |
| D8 | 5 / 92 | 0 | 92 |
| D9 | 9 / 92 | 0 | 92 |
| D10 | 11 / 92 | 0 | 92 |
| F11 | 10 / 10 | 0 | 10 |
| F12 | 2 / 10 | 0 | 10 |
| B1 | 1 / 19 | 0 | 19 |
| B2 | 4 / 19 | 0 | 19 |
| B3 | 3 / 19 | 0 | 19 |
| B6 | 4 / 19 | 0 | 19 |
| F13 | 3 / 5 | 13 | 5 |
| F14 | 2 / 2 | 16 | 2 |
| F15 | 8 / 8 | 10 | 8 |
| F16 | 1 / 2 | 11 | 2 |
| F17 | 4 / 4 | 9 | 4 |
| F18 | 1 / 1 | 12 | 1 |
| F19 | 1 / 1 | 12 | 1 |
| F20 | 1 / 1 | 12 | 1 |
| F21 | 1 / 1 | 12 | 1 |
| F22 | 2 / 2 | 17 | 2 |
| F23 | 2 / 2 | 17 | 2 |
| F24 | 2 / 2 | 17 | 2 |
| F25 | 1 / 1 | 7 | 1 |
| F26 | 1 / 1 | 18 | 1 |
| F27 | 2 / 2 | 17 | 2 |

**등록41 unique·41 assertion red·41 byte 동일·41 동일필터green.** 표의 D2′~4′는 runner ID D2~4에 대응한다. F1/2/8·D1~10은 adapter4파일92, F3 requester5, F4/5/7 actual DB15, F6 카드4, F9/10 runtime 필터2, F11/12 owner10, B attention19, F13~15 lifetime 필터, F16~21 X2 필터, F22~24/26/27 main-scope 필터다.

F25는 `claude.plan-mode.test.ts -t 'main approval scope'`에서 actual `ClaudeAdapter.sendMessage → query`를 실행했다. getter 전달을 제거하자 consume 바깥 `:159`의 `error events=[]` assertion이 실패했다(1/1, skip7); 원복1green이다. 구현자 첫 self-run의 생존과 oracle 보강 사실은 그대로 보존한다. 이번 검증에서는 처음부터 보강된 oracle로 재측정했으며 iterator 내부 assertion만으로 PASS하지 않는다.

| 독립 축 | 한 자리 변조 | 실패 / 실행 / skip | 원복 대조 |
|---|---|---|---|
| X3 | 완료 구독을 no-op 해제 함수로 대체 | 6 / 19 / 0 | byte 동일·19green |
| X4 | 응답 요청 구독을 no-op 해제 함수로 대체 | 8 / 19 / 0 | byte 동일·19green |

독립2는 등록41 분모에 넣지 않았다. 이전 r2 등록29는 FAIL 조기 이관으로 **미실행**이므로 과거 red 성공으로 주장하지 않는다. 원 X1/X2 기대는 보존됐고 현재 green, 승계 D1~10을 포함한 등록41은 모두 이번 새 assertion red로 검출돼 이번 대조의 red→green 미검출0이다. static 진단만으로 받은 red0·원복 잔여 production diff0이다.

## 6. Finding disposition·외부 경계·다음 작업

| ID | 독립 판정·직접 근거 | 상태/후속 |
|---|---|---|
| D5 | 기존 X1 기대 보존·owner10green, F11 10/10·F12 2/10 red→10green | closed 유지; 관련 pair closeout 이번 발행 |
| D6 | X2 원10 기대 보존+유효 actual requester3 모두green; F16~21 각 소비자 red/원복green | **closed**; child mode 및 네 응답 ID/owner 소비자 확인 |
| D7 | EP02③의3실행자리를1항목으로 센 “54물리” 자기보고 오계산 | NON_BLOCKING/closed: 실측56·대응표 기록, INDEX 정정 |
| D1·D2·D4 | 기존 NON_BLOCKING 잔여 | open 유지, 이번 수정/재판정 없음 |

ΔV3.4의 별도 main await 소유권 축도 main-scope19green·F22~27 red/원복green으로 닫혔다. 실제 CLI cancel/terminal 순서는 미확인이며 이 사실을 제거하지 않는다. D6와 D7의 상태는 plan의 `[검증자 기입]`에만 반영했다.

실 모델·Windows 앱 시각·공유 브랜치 게시/원격 CI는 미실행이다. 이전 자동 승인 검토가 목적지 권한 불명확을 사유로 원격 push를 거부한 제한을 유지했고 이번 원격 쓰기0이다. 로컬 main/origin-main0/0과 `git cat-file`은 공개/CI 성공을 대신하지 않는다. 원격 목적지 승인/게시 후 CI, 기존 §8의 nav 파랑·Work/Code 카드 위치·custom 모델 계획·Spark/패널 시각을 별도 확인한다. 새 계획 파일 캡션은 D-027로 철회됐으므로 실기 요구로 되살리지 않는다.

Review Signals: D6는 기존 소유권/child 계약이 승인 화면 소비자에 빠진 문제였고, main await는 같은 계약의 신호 전달 edge였다. 기존 지침/AC가 있어 제품 선택0, normative 보강은 구현 전 별도 설계로 분리됐다. 이번 검증이 찾은 수량 불일치는 명시 path의 운반 세분 재측정으로 처리했으며 root PLAN_GAP을 발명하지 않았다. 반복 sandbox EPERM은 동일 local-only 승격 대조로 구별했다.

INDEX는 **verify/PASS(기계 범위), 다음 사람(외부 게시/CI·모델/시각), 라운드3**으로 갱신한다. 외부 확인 전 archive 이동을 보류한다. 검증 중 production/정식 test 변경0·autofix0·설치/ABI전환0·커밋0이다. 최종 문서 커밋과 trailer 파싱은 root의 후속 작업이다.

---

# r3 재검증 — 원격 브랜치 신규 커밋 독립 대조 (2026-10-07)

**PASS 유지 (기계 범위).** 사용자 요청으로 원격 `codex-0249-plan-mode-fallback`의 r1.4 ΔV3 이후 커밋(`68c39bdd..7b32d299`)을 r3 결론과 독립으로 다시 대조했다. 새 root PAIR_FAIL0·PLAN_GAP0이다. 구현 보고와 r3 검증이 이름을 대지 않은 적대 축13개 중 11개 red, 1개 등가 변이, 1개 생존(D8 NON_BLOCKING)이다.

| 메타 | 값 |
|---|---|
| 검증자 | claude(이번 세션), 0249 production/정식 test 미작성 — 구현자와 다른 agent |
| 대상 | 원격 tip `f5d11f98`(r3 검증 커밋)까지; 코드 범위는 `963464c8`·`463019d7`·`7b32d299` |
| 기준 | ΔV3~ΔV3.4 규범 행(`68c39bdd`·`b110cca6`·`0a59d198`·`72e2d8eb`·`0552d740`·`1576d485`·`d6b9ace8`·`3378c153`·`d5bb58c6`); 설계와 구현은 별도 커밋 |

## 1. 독립 적대 축 — 등록41·r3 독립 X3/X4 밖

한 자리씩 변조하고 원본 bytes를 복원했다. 실행 분모는 `src/main/adapters/claude*`·`src/main/features/sessions`·`src/main/app/chat-turn`·`src/main/app/permission`·`src/renderer/src/features/chat/store`의 1117 tests다. 기준선 실패6은 아래 §2의 ABI 서명뿐이며, 판정은 기준선 대비 **새 실패**만 센다. 복원 뒤 같은 분모가 기준선과 같은 1104 pass/6 fail로 돌아왔다.

| ID | 자리 | 변조 | 새 실패 | 판정 |
|---|---|---|---:|---|
| A1 | `claude.ts` main 캡처 | child도 main getter 조회 | 3 | red |
| A2 | `claude.ts` Ask 승인 | 합성 signal → SDK-only | 1 | red |
| A3 | `claude.ts` 위험/runtime 승인 | 합성 signal → SDK-only | 2 | red |
| A4 | `claude.ts` needsApproval | runtime 승인 도구 제외 | 1 | red |
| A5 | `session-runtime.ts` getter | 퇴역 channel 우선 분기 제거 | **0** | **생존 → D8** |
| A6 | `retireChannel` | main signal 삭제(설계 §2 금지) | 1 | red |
| A7 | `adoptDelegate` | 첫 signal만 유지(`??=`) | 4 | red |
| A8 | renderer `approvePlan` | child 판정을 RESOLVE 뒤 state에서 재조회 | 1 | red |
| A9 | renderer `approvePlan` | 목표 mode를 고정 `accept_edits` | 0 | 등가: Work `modes.accept_edits→default`, Code 목표=`accept_edits` |
| B1 | `approval.ts` regSignal | child에도 main 턴 신호 합성 | 2 | red |
| B2 | `approval.ts` | 진입 전 취소 deny 제거 | 3 | red |
| B3 | runtime wrapper | SDK signal 취소 진입 검사 생략 | 4 | red |
| B4 | runtime wrapper | 퇴역 채널 mode 통지 guard 제거 | 12 | red |

A5 생존은 임시 probe로 행동 차이를 확인했다. 실제 `SessionRuntime` 퇴역(`close`) 뒤 옛 채널 Exit 콜백을 SDK signal이 살아 있는 채로 넣으면, 원본은 진입에서 deny하고 `getPlanFiles`0이다. A5에서는 `getPlanFiles`1회 뒤 wrapper가 deny한다. persist0·IPC0·deny는 둘 다 같다. AC25의 다른 owner side effect0과 ΔV3.4 §4의 “이미 취소된 **main**” 계약은 유지된다. ΔV3.4 TD §2가 적은 channel 우선 분기에만 oracle이 없다(M-F24는 반대 방향만 잰다). 현재 코드는 설계대로이므로 PAIR_FAIL이 아니다. 이 분기 하나에만 기대는 AC도 없어 NON_BLOCKING이다.

## 2. Gate 재실행

| gate | 산출 |
|---|---|
| lint no-fix | 1416파일 error0·warning1(기존 `useTranscriptVirtualizer.ts:22`) |
| typecheck node/web/test | 3종 exit0 |
| 전체 vitest | 6420 tests: pass6082·skip87·fail251. 실패 37파일 전부 `NODE_MODULE_VERSION 140 vs 127` better-sqlite3 서명이고 비-ABI 실패0 |
| scripts | testcase132·failure0 |
| doc-inventory·test-budget·migration | 각각 exit0 |
| diff --check `33c7c628..7b32d299` | 0 |
| 구현 trailer `7b32d299` | Agent/Handoff/Status/Criteria-Met/Verified-By 5키 파싱 |

현재 `node_modules`의 better-sqlite3는 Electron ABI140이다. `app/AGENTS.md`에 따라 ABI를 뒤집지 않았다. 그래서 실제 SQL을 지나는 F3~5·F7과 writer/DB pair 증거는 **이번에 다시 실행하지 못했다**. 해당 경로의 production 파일은 `7b32d299`가 바꾸지 않았다. 그 판정은 r3 §2·§5의 ABI127 측정을 승계한다.

## 3. 판정·이관

- 선택 pair17의 r3 PASS를 뒤집는 관측0이다. 새 축은 VP-34·36·37의 적대 분모를 넓혔고 A5 외에는 모두 검출됐다.
- D8을 plan `[검증자 기입]`에 NON_BLOCKING/open으로 등록한다. 위 probe를 정식 회귀로 올리면 닫힌다.
- 원격 브랜치는 이제 공유 원격에 있다. `gh` 미인증이라 PR/CI 상태는 확인하지 못했다. 실 모델·Windows 시각·실제 CLI cancel/terminal 순서는 계속 미확인이다. archive는 외부 확인 뒤로 보류를 유지한다.
- Review Signals: 같은 r3 대상의 두 번째 독립 검증이다. 생존 축은 이전 FAIL 증상과 무관한 새 분기다. 반복된 환경 한계는 better-sqlite3 ABI 단일 슬롯이다.

임시 증거(`app/.tmp-verify-0249-r3b-*`)는 커밋하지 않고 정리했다.
