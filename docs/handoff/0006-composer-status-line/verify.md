# Verify — 0006-composer-status-line

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0006-composer-status-line` |
| 검증자 | Claude Code |
| 일자 | 2026-06-10 |
| 대상 커밋 | `393c8c8` (INDEX 기재 `b94cc76` 은 히스토리 재작성으로 실 해시와 불일치 — 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

> 경로 약어: `composer/` = `app/src/renderer/src/features/chat/components/composer/`.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `safe` → `null` 반환(DOM 부재) + 토글 트리거 가드 | ✅ | `statusViewModel.ts:26` (`if (state === 'safe') return null`) → `ConversationStatusLine.tsx:19` (`if (!model) return null`); 토글 가드 `Composer.tsx:96-98` (`if (!conversationStatusModel) return`); Popover 자체도 `Composer.tsx:274` 에서 model 존재 시에만 마운트 |
| 2 | warn=호박(`--color-warn`)/danger=점토(`--color-bad`), raw hex 금지 | ✅ | `ConversationStatusLine.tsx:12-15` + `StatusPopover.tsx:13-16` — Tailwind 시맨틱 유틸(`text-warn`/`bg-warn`/`text-bad`/`bg-bad`)만 사용. 신규 5개 파일 raw hex grep 0건 |
| 3 | pill 클릭 → composer 위 Tier2 팝오버, 재클릭/바깥클릭/Esc 닫힘, `shared/ui/Popover` 재사용, 신규 click-outside 훅 금지 | ✅ | `Composer.tsx:275-289` — 기존 `Popover`(`placement="top"`, `anchorRef`, `onClose`) 재사용. 신규 훅 0개 (`useEffect`/이벤트 리스너 신설 없음). click-outside·Esc·portal 은 Popover 내장 |
| 4 | warn: "대화 가볍게 요약하기"(primary) + "정리하고 새 대화 시작"(보조) 둘 다 노출 | ✅ | `statusViewModel.ts:36,43-44` (warn → `compactButton` 포함·`recommend='compact'`·`showCompact=true`) + `StatusPopover.tsx:59-77` (compact=`variant='primary'`, newchat=`'contained'`). 테스트 `statusViewModel.test.ts` warn 케이스 |
| 5 | danger: 요약 버튼 숨김 + "정리하고 새 대화 시작" primary | ✅ | `statusViewModel.ts:43-44` (danger → `recommend='newchat'`·`showCompact=false`·`compactButton` 미정의) + `StatusPopover.tsx:59` 렌더 가드. 테스트 danger 케이스 (`compactButton` undefined 단언 포함) |
| 6 | 카피 = plan §카피 표 1:1, 기술용어 0 | ✅ | `statusCopy.ts` 전 항목을 plan 표와 자(字) 단위 대조 — 10항목 전부 일치(danger pill 의 `—` em-dash 포함). 토큰/컨텍스트/세션/모델/압축/위험/초과/실패 등 0건. 정보줄 접두("대화 길이"/"오늘 사용량"/"오늘 비용")도 plan 기본값 그대로 (`StatusPopover.tsx:42,46,52`) |
| 7 | disclaimer 항상 표시 | ✅ | `StatusPopover.tsx:79-81` — 조건 없이 항상 렌더 |
| 8 | 색 외 문구로 상태 구분 + pill `<button>` + `aria-expanded`/`aria-haspopup` | ✅ | warn/danger 카피가 전부 상이(`statusCopy.ts`); `ConversationStatusLine.tsx:22-30` — `<button type="button">` + `aria-haspopup`/`aria-expanded`/`aria-controls` |
| 9 | 새대화 → `useChat().newChat` 실배선 / 오늘비용 → `useCost()` 실배선(`null` 시 비용 줄만 생략) / 요약 → 스텁(`console.warn`+TODO, 미주입 시 no-op) | ✅ | `Composer.tsx:286` (`chat.newChat()`); 3개 page (`ChatPage.tsx:9-13`, `NewChatLandingPage.tsx:14-18`, `ProjectLandingPage.tsx:27-30`) 가 `useCost().summary?.day.totalCostUsd` → `formatApproxCost` → props 주입, `summary` null 시 `undefined` → `statusViewModel.ts:35`+`StatusPopover.tsx:50` 비용 줄만 생략; 스텁 `Composer.tsx:101-104` (`// TODO(후속 핸드오프): compact 실동작` + `console.warn`), `StatusPopover` 의 `onCompact?` optional → 미주입 시 no-op |
| 10 | 게이트 통과 + view-model 순수함수 단위테스트 3종 + boundaries 위반 0 | ✅ | 아래 게이트 재실행(286 passed); `statusViewModel.test.ts` — `safe→null` / `warn→compact 추천·둘 노출` / `danger→newchat 추천·compact 숨김` 3케이스 plan 요구와 1:1; lint(eslint-boundaries 포함) 통과 = 위반 0 |

## 정성 평가 (plan 의도 반영 + 코드 품질)

**총평: plan 의 의도를 정확하게 반영했고 코드 품질도 준수하다.** 특히 잘된 점:

- **레이어 경계 해법이 plan 의 보수적 옵션을 정확히 채택** — Composer(`features/chat`)는 `features/cost` 를 전혀 모르고, page 계층(조립 담당)이 `useCost`+`formatApproxCost` 로 문자열을 합성해 props 로 내려보낸다. cross-feature 결합 0, "pages = 조립만" 원칙(layers.md)과 정합. `formatApproxCost` 를 `features/cost/lib` 에 두고 배럴로 export 한 것도 포맷 SSOT 로 적절.
- **view-model 이 진짜 순수함수** — `conversationStatusModel(state, costToday?)` 는 입력만으로 출력이 결정되고, 표시 정책(recommend/showCompact/카피 선택)이 전부 이 한 곳에 모여 있다. UI 컴포넌트 2개는 model 을 그리기만 하는 presentational 셸 — plan 의 핵심 설계 그대로.
- **임시 근사의 격리가 깔끔** — 상태 판정(`Composer.tsx:80-94`)은 `useMemo` 한 블록에 TODO 주석과 함께 고립되어 있어 후속 핸드오프에서 그 블록만 교체하면 된다. 임계(warn ≥0.6, danger `nearCompaction()`∥≥0.85)도 plan 예시와 일치하고 기존 헬퍼(`contextTokens`/`contextWindowFor`/`nearCompaction`)를 재사용했다.
- **기존 패턴 준수** — Popover 토글은 기존 telemetry/modeMenu 패턴 복제, 카피 상수는 `modes.ts` 데이터-객체 패턴, 이름 충돌(`shared/ui/StatusLine`) 회피, 기존 도넛/TelemetryPanel 과 공존(제거 없음). `STATUS_COPY` 의 `as const` + danger 에 `compactButton` 키 자체가 없는 타입 설계로 "danger 에 요약 버튼 없음"이 타입 수준에서도 보장된다.

**경미한 관찰 (전부 비차단 — FAIL 사유 아님):**

1. **삽입 위치 미세 편차**: plan 은 "`ReadingColumn` *위*" 라 했으나 구현은 ReadingColumn *내부 첫 자식* (`Composer.tsx:266-273`). ReadingColumn 이 가운데 정렬 컬럼이므로 "composer surface 위 가운데 정렬" 이라는 의도는 동일하게 달성되고, AskCard/ApprovalCard 와 같은 컬럼에 정렬되는 부수 효과는 오히려 자연스럽다. 최종 판단은 사용자 시각 검증.
2. **a11y 시맨틱 불일치**: pill 은 `aria-haspopup="menu"` 인데 팝오버 콘텐츠는 `role="none"` (`StatusPopover.tsx:28`). 인수 기준(속성 존재)은 충족하나, 의미상 `aria-haspopup="dialog"`+`role="dialog"` 가 정확하다. 후속 핸드오프에서 같이 정리 권장.
3. **열림 상태 미초기화 엣지**: 팝오버 열린 채 상태가 warn→safe 로 바뀌면 모두 unmount 되지만 `conversationStatusOpen` 이 true 로 남아, 나중에 다시 warn 이 되면 클릭 없이 열린 채 나타난다. 현재 임시 근사에선 한 세션 내 ratio 가 다시 내려가는 일이 드물어 실영향 미미 — 정식 상태 판정 도입 시 함께 처리.
4. **구현 커밋 type 편차(위생 노트 ②)**: 코드+문서가 `docs(handoff): 0006 구현 보고` 단일 커밋 — 규약상 구현 커밋은 `feat(scope):` 가 맞다. trailer (`Agent: codex`·`Status: implemented`·`Criteria-Met: 10/10`·`Verified-By: pending`) 는 정확하므로 통신 자체는 성립. 다음 구현부터 type 준수 요청.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 통과 (286 tests) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | 신규 파일 전부 `features/chat` 내부, cost 는 page 주입 — lint(boundaries) 통과 |
| 카피 ↔ plan §카피 표 1:1 | ✅ | ✅ 최종 카피 검수 | 자 단위 일치 — 시각 맥락에서의 어감은 사람 확인 |
| 문서 형식/링크/한국어 | ✅ | — | 유지 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경. 신규 코드 키/토큰/비밀 패턴 0건 |
| **UI/UX 시각 검증 (pill 위치·팝오버 배치·3테마 색)** | ✖ | ✅ | **사람 확인 대기** — warn/danger 모의 상태에서 pill·팝오버 외관 확인 |
| 제품 의도 부합 (비기너 앰비언트 알림) | ✖ 보조 | ✅ 결정 | 보조 의견: 숫자 0 노출·행동 2개 구조가 의도와 정합 |
| 신규 의존성 승인 | — | — | 신규 의존성 0 (`package.json` 무변경) |
| PR 머지 승인 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint      : eslint --cache --fix ./src → 통과 (출력 0)
typecheck : tsc --noEmit (node + web) → 통과
test      : vitest run → Test Files 42 passed (42) / Tests 286 passed (286)
```

> 참고: 본 검증 환경에서도 better-sqlite3 ABI 불일치로 최초 실행 실패 → `npm rebuild better-sqlite3` 후 전체 통과 (0005 검증·Codex 구현 보고와 동일한 로컬 환경 사항, 저장소 코드와 무관).

## 위생 검토

- AGENTS.md 변경 없음. 신규/수정 파일에서 키/토큰/이메일/IP 패턴 0건, raw hex 0건.
- 위생 노트 ①: INDEX 기재 대상 커밋 `b94cc76` 이 현 히스토리에 부재 — 실 구현 커밋은 `393c8c8` (0002~0004 와 동일한 히스토리 재작성 패턴). INDEX 를 실 해시로 정정.
- 위생 노트 ②: 구현 커밋 type 이 `docs(handoff)` — 코드 포함 구현 커밋은 `feat(chat):` 가 규약. 비차단, 다음 라운드부터 준수 요청.

## PHASES.md 정합성

- plan 메타 "PHASES 행 (verify PASS 시 승격)" 에 따라 페이즈 표에 `0006` 행 승격. 형식(굵은 제목 + 요약 + 완료 커밋) 기존 행과 동일.

## 결론 / 다음 단계

- 상태: **PASS** (10/10). INDEX `verify/PASS` 갱신 + PHASES 승격.
- 사람 확인 항목: ① warn/danger 상태에서 pill·팝오버 시각 확인(3테마), ② 카피 어감 최종 검수, ③ "정리하고 새 대화 시작" 클릭 동작 확인.
- 후속 핸드오프 후보(비범위 이월): 정식 상태 판정 신호, compact 실동작 + 요약 승계, Tier3 드로어. + 경미 관찰 2(aria dialog 정리)·3(열림 상태 리셋) 동반 처리 권장.
