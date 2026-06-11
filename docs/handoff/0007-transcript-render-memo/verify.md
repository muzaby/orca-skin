# Verify — 0007-transcript-render-memo

## 메타

| 항목 | 값 |
|---|---|
| slug | `0007-transcript-render-memo` |
| 검증자 | Claude Code |
| 일자 | 2026-06-11 |
| 대상 커밋 | `a68e465` |
| 라운드 | 1 |
| 상태 | **PASS** |

> 비기능(성능) 작업 — plan/구현/검증 모두 Claude 수행. 구현·측정과 같은 세션에서 검증했으므로
> 측정 수치는 1차 증거(재현 절차 plan §Context + memory `orca-cdp-verification`)다.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `groupTurns` 를 `useMemo([state.messages])` 로 계산 | ✅ | `ChatTile.tsx` — `const turns = useMemo(() => groupTurns(state.messages), [state.messages])` + 렌더 본문 `turns.map(…)` |
| 2 | `turnEquals` 순수 비교자 + 단위 테스트 | ✅ | `lib/turns.ts` `turnEquals` (role·startIndex·길이·메시지 identity) / `lib/turns.test.ts` `describe('turnEquals')` 4 케이스 (동일 내용·다른 객체 / 마지막 메시지 교체 / 길이 변화 / role·startIndex) |
| 3 | `UserTurn` = `React.memo` + `turnEquals` | ✅ | `transcript/UserTurn.tsx` — `memo(…, (prev, next) => turnEquals(prev.turn, next.turn))` |
| 4 | `AssistantTurn` = `React.memo` + (`turnEquals` ∧ `pending`) | ✅ | `transcript/AssistantTurn.tsx` — `(prev, next) => prev.pending === next.pending && turnEquals(prev.turn, next.turn)` |
| 5 | `AssistantMessage` = `React.memo` (shallow) | ✅ | `transcript/AssistantMessage.tsx` — `export const AssistantMessage = memo(…)`. reducer `appendAssistantPart` 가 마지막 메시지만 교체하므로 identity 비교 정확 |
| 6 | `Markdown` = `React.memo` (source 값 비교) | ✅ | `markdown/Markdown.tsx` — string prop 이라 기본 shallow 로 동일 본문 재파싱 차단 |
| 7 | 동작 불변 (외형/스트리밍/세션 전환) | ✅ | 기존 renderer 테스트 전부 green + CDP 재현 경로에서 35턴 시드·스트리밍·세션 복원·삭제 정상 동작 확인. 라이브 영역(`PendingAssistant`)·`pending` 메타 전환은 memo 비교자가 통과시킴 |
| 8 | 게이트 lint/typecheck/test | ✅* | lint ✅ / typecheck ✅ / vitest 290 중 283 passed. 실패 7건 전부 `src/main/db/queries.test.ts` — better-sqlite3 네이티브가 Electron ABI(140)로 빌드된 환경에서 Node(127) vitest 가 로드 불가. 본 변경(renderer 순수)과 무관, PHASES "AppMessagePart persistence" 행의 동일 선례 있음. 사용자 지시로 Node-ABI 재빌드 후 재실행은 생략, `electron-builder install-app-deps` 로 Electron ABI 복원 완료 |
| 9 | 전/후 측정 수치 기록 | ✅ | 아래 §측정. plan §구현 보고와 동일 |

## 측정 (CDP rAF 샘플링 + CPU 프로파일, dev 모드)

동일 조건: mock `text_streaming`, 35턴 누적 트랜스크립트, 스트리밍 1턴 동안 4초 샘플링.

| 시점 | 최대 rAF 간격 | 50ms 초과 프레임 |
|---|---|---|
| BEFORE | **549.1 / 614.1 ms** (2회) | 366~614ms ×4 |
| transcript memo 적용 후 | 216.3 / 332.7 ms | 67~333ms ×4–5 |
| + Sidebar/Header 교정 후 | **133~166 ms** | 67~166ms |

CPU 프로파일: BEFORE 는 `beginWork` self 546ms(전 트랜스크립트 재조정 + react-markdown 재파싱),
AFTER 는 markdown/shiki·`beginWork` 모두 상위권 소멸 — 잔여는 dev 전용 오버헤드(jsxDEV·
StrictMode 경고·createTask)와 네이티브 레이아웃/페인트. 프로덕션 빌드에서 추가 축소 예상.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint·typecheck ✅, test 283/290 (7건 ABI 환경 — 매트릭스 #8) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 |
| 레이어 경계 위반 0 | ✅ | — | eslint(boundaries 포함) 통과 — 변경 전부 `features/chat` 내부 + `app/` 셸 자체 파일 |
| 문서 형식/링크/한국어 | ✅ | — | 통과 |
| AGENTS.md 위생 스캔 | — | — | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 성능 버그 수정 — 외형 무변경 의도. 동반된 Claude Code 룩 시각 조정(별도/동반 커밋)은 사용자 본인 작업 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** — 스트리밍 중 스크롤 부드러움 + 시각 조정 최종 검수 |
| 신규 의존성 승인 | — | — | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | PR 생성 — 머지는 사용자 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint ✅ / typecheck ✅
Test Files  1 failed | 41 passed (42)
Tests       7 failed | 283 passed (290)   # 실패 7건 = queries.test.ts better-sqlite3 ABI (환경, 변경 무관)
```

사용자 지시로 Node-ABI 재빌드 후 재실행은 생략. 측정 후 `npx electron-builder install-app-deps`
로 Electron ABI 원복(다음 `npm run dev` 정상).

## PHASES.md 정합성

- 페이즈 표에 0007 행 추가(대상 커밋 `a68e465`), INDEX 행 `verify/PASS` 갱신 — 형식 일치 확인.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격, PR 생성(사용자 요청).
- 후속(비차단): ① 컨텍스트 셀렉터/스토어 분리는 Phase 4 Zustand 전환에서 흡수(사전 마이그레이션 금지).
  ② transcript 가상화(`data-behavior="virtualizable"`)는 트랜스크립트가 수백 턴으로 커질 때 재평가.
  ③ DB 단위 테스트의 ABI 이중 빌드 문제(dev=Electron / vitest=Node)는 별도 정리 후보.
