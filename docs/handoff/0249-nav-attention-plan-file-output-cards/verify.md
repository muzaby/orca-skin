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
