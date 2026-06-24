# Verify — 0041-ask-ui-refine

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). plan 의 인수 기준 8건을 1:1 대조한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0041-ask-ui-refine` |
| 검증자 | Claude Code |
| 일자 | 2026-06-24 |
| 대상 커밋 | `96c8c5d` (0041 impl HEAD; 라운드 1~3 = `09e43e3`·`0346fe5`·`9f9bdc5`·`96c8c5d`) |
| 라운드 | 1 |
| 상태 | **PASS** |

> **검증 맥락(투명성).** 검증 시점 브랜치 HEAD 는 `0228c47`(별개 작업 "세션 라우팅 버그 3종")로 0041 impl(`96c8c5d`) **위에** 얹혀 있다. `0228c47` 은 0041 파일 2개를 **가산적으로만** 수정했다 — `AskExchange.tsx` 에 미해소 ask 를 숨기는 `if (!isAskResolved(call)) return null` 게이트 1줄 추가, `lib/ask.ts` 에 순수 헬퍼 `isAskResolved` 추가. **해소된 Q&A 의 렌더(AC5)는 무변경**이며 어떤 AC 도 회귀하지 않는다(오히려 "답변 전 버블 미노출"을 강화). 게이트는 이 가산 레이어 포함 HEAD 에서 실행했다.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 옵션 선택 톤 중립화 — 주황(`bg-rust-soft`/`border-rust`)→중립 면, accent 는 인디케이터에만. 단일=원형/다중=사각 유지 | ✅ | `AskUserQuestionCard.tsx:264-266` 선택=`border-border-strong bg-t3`·비선택=`border-t5 bg-t1 hover:bg-t2`; `:269-273` 인디케이터 `q.multiSelect ? rounded-[4px] : rounded-full` + 선택 시 `border-rust bg-rust text-white`(accent 인디케이터 한정) |
| 2 | 헤더 chip 정제 — 채도/케이스 무채도·sentence-case | ✅ | `:207-209` 선두 배지 `rounded bg-t3 … text-t7`(`uppercase tracking-wide text-rust` 제거) |
| 3 | 번호 배지·kbd 배치 — 우측 1~9 배지 + 단축키 힌트 정렬 | ✅ | `:281-285` 번호 `kbd` `shrink-0 self-center`(수직중앙); 하단 verbose 키보드 힌트줄 제거(부재); Enter 힌트는 primary 버튼 `:314 kbd="Enter"` |
| 4 | 이전/다음 네비 + `current+1/total` 카운터 | ✅ | `:207-209` 헤더 `1/N` 카운터 배지(`tabular-nums`); `:214-233` `multiQuestion` 한정 `arrowL`/`arrowR` 버튼(`goPrev`/`goNext`, 경계 `disabled`) |
| 5 | transcript 메시지버블 정합 — 톤·여백·`질문 답변` 표기, `bg-bubble-user` 유지 | ✅ | `AskExchange.tsx` 단일 결합 버블 `justify-start`(어시스턴트 측) + `bg-bubble-user`, 줄마다 `질문(text-ink2) 답변(font-semibold)`; 미해소는 `isAskResolved` 로 미노출(가산, AC5 해소 렌더 무변경) |
| 6 | 컴포저 패널 스택 배치 — 간격(`mb-2` 이중간격 제거) | ✅ | 카드 루트 className `:189` 에 `mb-2` 없음(09e43e3 제거); 부모 패널 스택 `flex flex-col gap-2` 단일 간격 |
| 7 | 무회귀 — 키보드/자동진행/기타 상호배타/접근성 보존 | ✅ | 1-9 `:154-162`·↑↓ `:132-143`·←→ `:175-183`·Space `:257-259`·Enter `:163-174`·Esc `:148-152`·단일 자동진행 `:104-109`·기타 상호배타 `:95-101,119-127`·`role=listbox/option`+`aria-selected` `:243,253-254`; 단위테스트 `lib/ask.test.ts`·`reducer/chatReducer.ask.test.ts` green |
| 8 | 테마 3종 무붕괴 — 신규 토큰 도입 시 3 스코프 채움 | ✅(시각=사람) | 전부 themed 토큰(`t1/t2/t3/t5/t6/t7/t9`·`border-strong`·`rust`·`bubble-user`·`surface-primary-elevated`); `styles/tokens.css` 무변경(신규 토큰 0) |

**판정: 8/8 코드 충족 → PASS.** AC8 및 픽셀 일치/톤 감각은 규약상 사람 시각 검증 영역(아래 책임분리표).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ · typecheck ✅(node+web+test) · test **476/476 실행분 green**(아래 §게이트) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 충족(증거 첨부) |
| 레이어 경계 위반 0 | ✅ | — | 변경=`features/chat` 내부(렌더러), boundaries 위반 0(lint green) |
| 문서 형식/링크/한국어 | ✅ | — | 본 문서 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | N/A — AGENTS.md 미변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기**(3 테마·cool=`rust`=파랑 선택 톤·픽셀 일치) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # eslint --cache --fix ./src
  → 통과(출력 없음, 위반 0)
$ npm run typecheck               # node + web + test
  → 통과(typecheck:node / typecheck:web / typecheck:test 전부)
$ npx vitest run
  → Test Files  2 failed | 66 passed (68)
    Tests  476 passed (476)
  · 0041 관련(렌더러): lib/ask.test.ts · reducer/chatReducer.ask.test.ts · store/chatStore.test.ts = 33/33 green
  · 실행된 476 테스트 전부 green
```

**환경 한계(과대 green 주장 금지).** `Test Files 2 failed` = `src/main/ipc/chat/persist.test.ts` · `src/main/ipc/chat/send.runtime-resilience.test.ts`. 둘 다 **main 프로세스** 테스트로, 이 샌드박스에서 **electron 바이너리 다운로드가 네트워크로 실패**(`Electron failed to install correctly`)해 import 단계에서 막힌 것(테스트 로직 실패 아님). **0041 은 렌더러 전용** 변경이라 두 파일과 무관하다. (impl 보고는 electron 설치 환경에서 473/473 green 을 기록 — 본 검증 환경에서도 better-sqlite3 Node ABI 재빌드 후 `db/queries.test.ts` 포함 모든 *실행 가능* 테스트가 green.)

## 위생 검토

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 N/A.
- 변동성/일회성/장문 코드설명 혼입: 없음(문서는 verify.md 1건).

## PHASES.md 정합성

- 0041 완료 행을 페이즈 표(0040 다음)에 승격 — 설명 + `완료 (커밋 96c8c5d)`. 형식 기존 행과 동일.

## 결론 / 다음 단계

- **상태: PASS** — 인수 8/8 코드 충족, 게이트(lint/typecheck/실행분 test) green, 레이어 경계 0, 신규 의존성 0, IPC/reducer/파싱 로직 무변경(순수 표현 계층).
- `INDEX.md` 0041 → `verify/PASS`, 다음=—. `PHASES.md` 승격.
- **사람 확인 대기**: UI 시각 검증(3 테마·cool 선택 톤·참고 스크린샷 픽셀 일치)·PR 머지 승인. 픽셀 정밀 정렬을 원하면 스크린샷 재공유 후 후속 라운드(plan §사람 확인 대기와 동일).
- **비고**: 검증 환경 HEAD 는 별개 작업 `0228c47` 을 가산 레이어로 포함(0041 AC 무회귀). 해당 작업의 핸드오프 문서화는 0041 범위 밖(별도 처리).
