# Plan — 0122-composer-status-popover-refresh

## 메타

| 항목 | 값 |
|---|---|
| slug | `0122-composer-status-popover-refresh` |
| 작성자 | Claude Code |
| 일자 | 2026-07-17 |
| 매핑 | PHASES 행 (PASS 시 승격) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | 대화 길이 행 — 안내 메시지와 함께 얼마나 긴지 수치 표시 (예: `138k/200k 69%`) | 라이브 세션 요청 (2026-07-17) |
| 명시 요구 2 | "오늘 사용량" 행 제거 | 라이브 세션 요청 |
| 명시 요구 3 | "오늘 비용" 행 제거 | 라이브 세션 요청 |
| 명시 요구 4 | "표시된 내용은 예상치예요…" 디스클레이머 제거 | 라이브 세션 요청 |
| 명시 요구 5 | Composer 안내(pill)에 노란색/빨간색 경고등 애니메이션 부여 | 라이브 세션 요청 |
| 명시 요구 6 | 팝오버 창 항상 중앙정렬, 창 크기 변경 시에도 유지 | 라이브 세션 요청 |
| 추론 의도 A | 요구 1 의 "안내 메시지와 함께" = 기존 정성 카피(`긴 편이에요`)를 유지하고 수치를 병기 (추론) | 요구 문구 해석 |
| 추론 의도 B | 요구 5 의 노랑/빨강 = 기존 warn/danger 톤 매핑(`--color-warn`/`--color-bad`) 그대로, "경고등" = 점멸/펄스 비콘 (추론) | 기존 톤 체계 `usageTone.ts` |
| 추론 의도 C | 요구 6 의 "중앙정렬" = 안내 pill(컴포저 컬럼 중앙, `mx-auto`) 기준 중앙 — 현재는 pill 좌측 정렬(`align='start'` 기본값) + resize 미추종이 어긋남의 원인 (추론) | `Popover.tsx:47-81` 리스너 부재 |
| 추론 의도 D | 오늘 사용량·비용 행 제거로 `costToday` 프롭 체인(pages→ChatTile/ChatView→Composer)의 유일 소비자가 사라짐 → 죽은 배선 동반 제거 (추론) | grep: 소비자 단일 |

## Context (왜)

컨텍스트가 길어지면 Composer 위에 `ConversationStatusLine` pill 이 뜨고 클릭 시 `StatusPopover` 가 열린다(0006/0064). 현재 팝오버는 정성 카피만 보여줘 *얼마나* 긴지 알 수 없고, 오늘 사용량/비용은 이 맥락(대화 길이 경고)과 무관한 정보라 소음이다. 또 팝오버가 pill 좌측 기준으로 열리고 창 리사이즈 시 열린 위치에 방치되는 배치 결함이 있다. pill 의 상태 점도 정적이라 경고 시급도가 전달되지 않는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 상태 판정: `lastTelemetry` 기반 `tokens=contextTokens()`, `window=contextWindowFor()`, ratio ≥0.6 warn / ≥0.85 또는 `nearCompaction` danger — 팝오버에 쓸 수치가 Composer 에 이미 존재 | `app/src/renderer/src/features/chat/components/Composer.tsx:212-226` |
| view model 은 순수 함수 `conversationStatusModel(state, costToday?)` — 카피는 i18n 키 테이블(`STATUS_COPY_KEYS`)로 노출(0097) | `composer/statusViewModel.ts:14-26` · `composer/statusCopy.ts:20-41` |
| 팝오버 3행(대화 길이·오늘 사용량·오늘 비용) + 디스클레이머 구조 | `composer/StatusPopover.tsx:47-62,79-81` |
| `costToday` 소비자는 StatusPopover 단일 — pages 3곳→ChatTile/ChatView→Composer 프롭 체인 전체가 이 행만을 위해 존재 | grep `costToday` (pages/ChatPage.tsx:18 외) |
| `formatApproxCost` 사용처는 pages 3곳의 costToday 계산뿐 | grep `formatApproxCost` · `features/cost/lib/formatCost.ts` |
| 공용 `Popover` 는 측정 기반 배치(`useLayoutEffect`, deps `[open, anchorRef, placement, align]`) — **resize/scroll 리스너 없음** → 열린 채 리사이즈하면 stale 좌표 방치. `align='center'` 지원 기존 | `app/src/renderer/src/shared/ui/Popover.tsx:47-81` |
| pill 의 상태 점은 정적 `ring-4 ring-current/15`, 톤은 `TONE_CLASS`(warn=`text-warn`, danger=`text-bad`) — currentColor 로 색 자동 전파 | `composer/ConversationStatusLine.tsx:13-16,34` |
| 애니메이션 관례: `@keyframes` + `@utility` + `prefers-reduced-motion` 해제 쌍 (`epitaxy-shine`·`tile-in`) | `app/src/renderer/src/styles/app.css:111-159` |
| 기존 토큰 표기 관례 `~{{used}}k / {{window}}k` (도넛 title) — k 단위 반올림 | `Composer.tsx:651-654` · `ko.ts:554` |
| 카피 키 카탈로그 ko/en 병행 (`chat.status.*`) | `shared/i18n/resources/ko.ts:568-595` · `en.ts:573-600` |

## 인수 기준 (Acceptance Criteria)

1. 팝오버 "대화 길이" 행이 기존 정성 카피와 함께 수치 `<used>k/<window>k <pct>%` 를 표시한다 (예: `138k/200k 69%`; 값은 도넛과 동일한 `contextTokens`/`contextWindowFor` 파생).
2. "오늘 사용량" 행이 제거된다 (i18n 키 `usageTodayLabel`·`warn/danger.usage` 포함 잔존 참조 0).
3. "오늘 비용" 행이 제거된다 (i18n 키 `costTodayLabel` 포함 잔존 참조 0).
4. 디스클레이머 문단이 제거된다 (i18n 키 `warn/danger.disclaimer` 잔존 참조 0).
5. `costToday` 프롭 체인(pages 3곳 → ChatTile/ChatView → Composer → view model)이 제거되고, 죽은 `formatApproxCost` 는 barrel·lib 에서 제거된다.
6. pill 상태 점에 경고등 펄스 애니메이션이 적용된다 — currentColor 기반(warn=노랑/danger=빨강 자동), `prefers-reduced-motion: reduce` 에서 정적 폴백.
7. 상태 팝오버가 pill 중앙 기준(`align="center"`)으로 열리고, 열린 동안 창 리사이즈 시 재계산되어 중앙정렬이 유지된다 (공용 Popover resize 재배치 — 전 팝오버 공통).
8. `statusViewModel.test.ts` 가 새 모델(수치 필드, costToday 부재)을 고정하고 green.
9. 게이트: lint 에러 0 · typecheck 3분할 green · vitest 순수 스위트 green (DB 로드 스위트 실패는 egress 403 환경 베이스라인으로 분리 보고).

## 범위 / 비범위

- **범위**: 렌더러 전용 — 상태 팝오버 내용·pill 애니메이션·Popover 배치. i18n ko/en 동기.
- **비범위**: 상태 판정 로직 자체(임시 근사 TODO, `Composer.tsx:213`)의 정식 신호 교체 — 별도 핸드오프. 텔레메트리 도넛/UsagePanel 은 무변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `contextTokens`·`contextWindowFor`(이미 Composer 에서 사용), 공용 `Popover`, Tailwind v4 `@utility` 관례.
- 신규 의존성: **없음**.
- 전제: `lastTelemetry` 가 있어야 상태 모델이 non-null (기존과 동일 — safe 면 pill 자체 미표시).

## 설계

- **A. 수치화**: `StatusLineModel` 에서 `costToday` 제거, `contextUsage: { usedK; windowK; pct }` 추가. `conversationStatusModel(state, usage?: { tokens; window })` 가 k 반올림·pct 계산. Composer 는 이미 계산한 tokens/window 를 전달. `StatusPopover` dd = `{length 카피} · {tr('chat.status.lengthValue', {used, window, pct})}`, 신규 키 `lengthValue: '{{used}}k/{{window}}k {{pct}}%'`.
- **B. 행 제거**: StatusPopover 에서 usage/cost 행 + 디스클레이머 삭제, `StatusCopyKeys` 에서 `usage`·`disclaimer` 제거, ko/en 키 삭제. costToday 체인 제거(추론 의도 D) + dead `formatApproxCost` 제거.
- **C. 경고등**: `app.css` 에 `@keyframes status-beacon`(currentColor halo 확장·소멸 펄스) + `@utility animate-status-beacon` + reduced-motion 해제. `ConversationStatusLine` 점에 적용(정적 ring 유지 = 폴백).
- **D. 중앙정렬**: Composer 상태 Popover 에 `align="center"`. 공용 `Popover` 의 배치 계산을 재실행 가능하게 만들고 open 동안 `window resize` 리스너로 재계산.
- **레이어 경계**: features/chat 내부 + shared/ui·shared/i18n·styles — 교차 feature import 없음. pages 는 프롭 제거만.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 1M 컨텍스트 모델(`contextWindowFor` = 1,000,000): `1000k` 로 표기 — 기존 도넛 title 관례(`window/1000`)와 동일.
- `prefers-reduced-motion`: 펄스 해제, 기존 정적 ring 점 유지.
- 좁은 창: Popover 의 기존 `EDGE_MARGIN` 클램프가 중앙정렬보다 우선(뷰포트 이탈 방지) — 유지.
- resize 재계산은 open 동안만 리스너 등록(비용 무시 가능), 닫히면 해제.
- 테마 3종: 톤 토큰(`--color-warn`/`--color-bad`)이 테마별 값을 이미 소유 — 추가 대응 불요.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| Popover resize 재배치는 **전 팝오버 공통** 동작 변경 (메뉴류 포함) | 기존 동작이 "stale 좌표 방치"라 순수 개선. flip·클램프 로직은 동일 함수 재사용이라 배치 규칙 자체는 불변 |
| 수치는 마지막 턴 텔레메트리 기반 근사 — 디스클레이머 제거로 "예상치" 고지가 사라짐 | 사용자가 명시 요구(제거). 판정 정식화는 기존 TODO(비범위)로 유지 |
| `formatApproxCost` 제거 — 추후 비용 표기 재도입 시 재작성 필요 | git 이력으로 복원 가능, 죽은 export 유지가 더 큰 부채 |

- 되돌리기 어려운 결정: 없음 (전부 렌더러 표면, git revert 가능).
- Open Question 해당 없음 (PRD §11 / TRD §15 무관).

## 영향 받는 파일

- `app/src/renderer/src/features/chat/components/composer/{StatusPopover,ConversationStatusLine}.tsx`
- `app/src/renderer/src/features/chat/components/composer/{statusViewModel,statusCopy}.ts` + `statusViewModel.test.ts`
- `app/src/renderer/src/features/chat/components/{Composer,ChatView,ChatTile}.tsx`
- `app/src/renderer/src/pages/{ChatPage,NewChatLandingPage,ProjectLandingPage}.tsx`
- `app/src/renderer/src/shared/ui/Popover.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `app/src/renderer/src/styles/app.css`
- `app/src/renderer/src/features/cost/{index.ts,lib/formatCost.ts}` (dead 제거)

## 참고 문서

- `docs/handoff/0006-composer-status-line/` (원 설계) · `0064` (단계별 단일 액션) · `0097` (카피 카탈로그 키)
- `docs/arch/frontend/layers.md` (4-layer 경계)

## 게이트

- `cd app && npm run lint && npm run typecheck` + vitest (제약 환경: 순수 스위트 — DB 로드 실패는 egress 403 베이스라인).
- 신규 테스트: `statusViewModel.test.ts` 갱신 (contextUsage 계산·반올림·costToday 부재).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 6건을 라이브 세션 요청으로 인용, 추론 4건(A~D) 분리 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호 9건, 조사 근거, 검증 가능.
- [x] 의존 기술 — 신규 의존성 없음 확인.
- [x] 파생 UX — 1M 윈도우·reduced-motion·좁은 창·테마 반영.
- [x] 리스크 — Popover 공통 변경·디스클레이머 제거 트레이드오프 기록, Open Question 해당 없음.

---

## r2 — 세션 비용 행 복구 (사용자 피드백, 2026-07-17)

### 명시 요구 (라이브 세션)

1. 비용 안내 복구 — 단 "오늘 비용"이 아니라 **"이 세션에서 사용한 비용"** 안내로, **해당 세션에서만 발생한 비용 총합** 표시.
2. 하단 "표시된 비용은 예상치" 안내문구 복구.

### 자료조사 (r2)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 비용 SSOT = main `turn_usage` 원장 — `total_cost_usd` 를 **턴 단위**로 적재(일/주/월 집계도 이 행들의 SUM). 세션 총합 = `SUM(total_cost_usd) WHERE session_id` | `infra/db/queries.ts:552` · reducer 주석 `chatReducer.ts:425` "비용은 main 의 turn_usage 원장(집계)이 SSOT" |
| SDK result 의 `costUsd` 는 "턴 누적이 맞아 유지"(한 턴 내부 스텝 누적 = 턴 단위) — 원장 행과 동일 단위 | `adapters/claude-map.ts:397-412` 주석 |
| 세션 로드 페이로드(`LoadedSession`)는 이미 `turn_usage` 최신 행에서 `lastTelemetry` 를 복원 — 같은 지점에서 세션 SUM 을 싣는 것이 자연스러운 확장 | `app/handlers/session.ts:56-58` · `shared/ipc.ts:1065` |
| fork/handoff 파생 draft 는 `continuityDraftSession` 이 `initialChatState` 에서 명시 필드만 복사 — 비용은 복사하지 않으면 자연히 0 에서 시작(새 세션 = 새 원장) | `store/chatStore.ts` `continuityDraftSession` |
| `session.compacted` 는 컨텍스트만 무효화 — 비용은 지출 누계라 압축과 무관하게 유지 | `chatReducer.ts:401-416` |

### 인수 기준 (r2 — 기존 3·4 를 supersede)

10. 팝오버에 "이 세션에서 사용한 비용" 행이 표시되고, 값 = 해당 세션에서만 발생한 비용 총합(`약 $X.XX`). 소스 = 세션 로드 시 `turn_usage` 세션 SUM(`LoadedSession.costUsd`) + 라이브 턴의 `telemetry.costUsd` 리듀서 누산.
11. 비용 데이터가 아직 없으면(누산·복원 모두 부재) 행을 표시하지 않는다.
12. 하단에 "표시된 비용은 예상치" 디스클레이머가 복구된다 (r1 의 일반 "표시된 내용은 예상치" 가 아니라 **비용 한정** 문구).
13. fork/handoff 파생 세션은 부모 비용을 승계하지 않는다 (새 세션 = 0 에서 시작).
14. `IPC_CONTRACT.md` `orca:session:load` 행에 `costUsd` 필드를 동기 갱신 (채널 수 불변 — payload 확장).
15. 테스트: reducer 비용 누산·세션 로드 시드, `sumSessionCostUsd` 쿼리, view model 패스스루 green.

### 설계 (r2)

- **main**: `queries.ts` 에 `sumSessionCostUsdStmt`(`SELECT COALESCE(SUM(total_cost_usd),0) FROM turn_usage WHERE session_id=@sessionId`) + `sumSessionCostUsd()`. `handlers/session.ts` sessionLoad 가 `costUsd`(>0 일 때만) 포함. `shared/ipc.ts` `LoadedSession.costUsd?: number`.
- **renderer**: reducer state `sessionCostUsd?: number` — `telemetry` 케이스에서 `costUsd` 존재 시 누산, `LOAD_SESSION` 에서 시드. Composer 가 selector 로 읽어 view model 에 전달(`StatusLineModel.sessionCostUsd?: number`), StatusPopover 가 행 + 디스클레이머 렌더.
- **i18n**: `chat.status.sessionCostLabel`(이 세션에서 사용한 비용) · `sessionCostValue`(`약 ${{usd}}`) · `costDisclaimer`(표시된 비용은 예상치예요…) — ko/en.

### 리스크 (r2)

| 리스크 | 완화책 |
|---|---|
| 세션 로드 직후 아직 원장 미적재된 직전 턴이 있으면 순간 과소 표시 | 디스클레이머(예상치)로 흡수 — 재로드 시 원장 SUM 이 권위 |
| 라이브 누산(시드+Σtelemetry)과 원장 SUM 의 이중 경로 | 같은 단위(턴)라 로드 시점 기준 서로소 — 로드 후 턴만 누산이 더해짐 |

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 A~D 전부. 사용자 직접 지시 UI 수정 라운드(0121 r2~r5 선례)로 Claude 직접 구현.
- 이견 없음. 단 설계 C 가 놓친 세부 1건 발견(아래 #1).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | Tailwind `ring-*` 유틸도 **box-shadow 기반**이라, 키프레임이 box-shadow 를 소유하는 동안 기존 정적 halo(`ring-4 ring-current/15`)가 사라진다 — 펄스 사이에 점이 벌거벗는 깜빡임 | ✅ 키프레임 각 스텝의 첫 레이어로 정적 halo 상당(`0 0 0 4px currentcolor 15%`)을 유지하고 그 위에 확장 펄스를 얹음. reduced-motion 은 animation:none → 원래 ring 폴백 | `styles/app.css` status-beacon 주석 |
| 2 | `formatApproxCost` 제거로 그것만 쓰던 i18n 키 `cost.approx`(ko/en)와 `features/cost/lib/` 디렉토리 자체가 죽음 | ✅ 키·파일·디렉토리·barrel export 동반 제거 (plan 인수 5 의 "죽은 배선" 범위로 판단) | grep 소비자 0 |
| 3 | `costToday` 제거로 pages 3곳의 `useCostSummary`·(ChatPage/ProjectLandingPage 의) `useI18n` import 도 죽음 | ✅ 동반 제거 (NewChatLandingPage 는 `tr` 을 인사말에 계속 사용 — 유지) | lint no-unused-vars |

## [구현자 기입] 구현 체크리스트

- [x] A. view model 수치화 + Composer 전달 + StatusPopover 표기 + i18n `lengthValue`
- [x] B. usage/cost 행·디스클레이머 제거 + i18n 키 삭제 + costToday 체인·formatApproxCost 제거
- [x] C. status-beacon 키프레임/유틸 + pill 점 적용
- [x] D. Popover resize 재배치 + `align="center"`
- [x] 테스트 갱신 + 게이트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `composer/{statusViewModel,statusCopy}.ts`·`statusViewModel.test.ts`·`composer/{StatusPopover,ConversationStatusLine}.tsx`·`{Composer,ChatView,ChatTile}.tsx`·pages 3곳·`shared/ui/Popover.tsx`·`i18n/resources/{ko,en}.ts`·`styles/app.css`·`features/cost/{index.ts,lib/formatCost.ts(삭제)}` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint 에러 0(경고 1=기존 TanStack Virtual 베이스라인) ✅ / typecheck 3분할 ✅ / vitest **937/937** (1스위트 로드 실패 = electron 바이너리 egress 403 베이스라인) + scripts 25/25 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `61c4d41` |

### [구현자 기입] r2 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `infra/db/queries.ts`(+`sumSessionCostUsd`)·`app/handlers/session.ts`·`shared/ipc.ts`(`LoadedSession.costUsd`) / renderer: `reducer/chatReducer.ts`(`sessionCostUsd` 시드+누산)·`Composer.tsx`·`statusViewModel.ts`·`StatusPopover.tsx`·i18n ko/en(`sessionCostLabel`/`sessionCostValue`/`costDisclaimer`) / docs: `IPC_CONTRACT.md` sessionLoad 행 |
| 게이트 결과 | lint 에러 0 ✅ / typecheck 3분할 ✅ / vitest **943/943**(+6 — reducer 누산 4·query 1·view model 1, electron 1스위트 로드 실패는 egress 403 베이스라인) + scripts 25/25 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (r2 구현 커밋 — verify r2 에서 기재) |
