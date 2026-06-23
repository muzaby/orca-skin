# Plan — 0041-ask-ui-refine

## 메타

| 항목 | 값 |
|---|---|
| slug | `0041-ask-ui-refine` |
| 작성자 | Claude Code |
| 일자 | 2026-06-23 |
| 매핑 | PHASES 후속(UI 정제) / PR (push 후) |
| 상태 | READY → IMPL_DONE (비기능 = **Claude 직접 구현**) |

## Context (왜)

`AskUserQuestion` 도구 호출 표면(컴포저 인터랙티브 카드 + transcript 의 질문/답변 인라인 + 요청됨 툴카드 본문)은 이미 구현되어 동작한다(0020·0022 계열). 사용자가 첨부한 5장의 참고 스크린샷(Claude Code 웹 UI, 이미지 1~5)을 기준으로 **컬러·톤·간격·항목 배치를 그 양식에 정렬**하는 시각 정제 작업이다. 기능/IPC/데이터모델 변경은 없고 렌더러 표현 계층 문제이므로, 협업 규약(`docs/handoff/AGENTS.md`)상 **Claude 가 핸드오프 문서를 만들고 plan → impl → verify 를 직접 수행**한다.

현행과 스크린샷의 주요 간극:

- 컴포저 Ask 카드(`AskUserQuestionCard`)의 옵션 선택 하이라이트가 `border-rust bg-rust-soft`(주황 강조)·헤더 chip 이 `bg-rust-soft text-rust uppercase` 로 과채도. 스크린샷은 더 **중립적인 선택 톤**(번호 배지 + 경계 위주)이다.
- transcript 의 완료 Q&A(`AskExchange`)는 질문(좌)·답변 버블(우)로 렌더되나, 스크린샷의 시스템 답변 메시지버블 톤/여백/`질문 · 선택값` 묶음 표기와 미세 차이가 있다.
- 컴포저 "패널 스택"의 펼침/접음·항목 배치(번호 배지, kbd 힌트, 이전/다음 화살표, 1/N 카운터)가 스크린샷 배열과 정합 필요.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

1. **옵션 선택 톤 중립화**: `AskUserQuestionCard` 옵션 버튼의 선택 상태가 주황(`bg-rust-soft`/`border-rust`) 대신 스크린샷 톤(중립 surface + 경계/번호 배지 강조)으로 바뀐다. 단일=원형, 다중=사각 체크 인디케이터 구분은 유지.
2. **헤더 chip 정제**: 질문 헤더 라벨 chip 의 채도/케이스(`uppercase tracking-wide` 주황)가 스크린샷 톤으로 조정된다(가독 우선, 과채도 제거).
3. **번호 배지·kbd 배치**: 각 옵션 우측 1~9 번호 배지(`kbd`)와 하단 단축키 힌트(`↑↓`·`Space`·`←→`·`Enter`·`Esc`)가 스크린샷 배치/정렬과 일치한다(기능·핸들러 무변경).
4. **이전/다음 네비 + 1/N 카운터**: 다중 질문 시 좌우 화살표 + `current+1/total` 카운터의 배치·간격이 스크린샷(이미지 5의 `1/3`)과 정합한다.
5. **transcript 메시지버블 정합**: `AskExchange` 의 질문(좌)·답변 버블(우) 톤·여백·`header · question` 표기가 스크린샷(이미지 1~3)의 시스템 답변 버블과 일치한다(`bg-bubble-user` 토큰 유지).
6. **컴포저 패널 스택 배치**: Ask 카드가 입력 패널 위에 스택될 때 간격/펼침·접음 경계가 스크린샷(이미지 4~5)과 정합한다(`Composer.tsx` 패널 스택 `flex flex-col gap-2`).
7. **무회귀**: 키보드(1~9 직접선택·↑↓ 옵션이동·←→ 질문이동·Space 선택·Enter 제출·Esc 건너뛰기)·단일선택 자동진행·"기타" 입력 상호배타·접근성(`role=listbox/option`·`aria-selected`) 동작이 모두 보존된다.
8. **테마 3종**: classic/dark/cool 세 테마 전부에서 시각이 깨지지 않는다(신규 토큰 도입 시 세 스코프 전부 채움).

## 범위 / 비범위

- **범위**: 위 8건 — `AskUserQuestionCard`·`AskExchange`·`AskBody`·(필요 시)`Composer.tsx` 패널 스택의 컬러·토큰·간격·배치 정제.
- **비범위**: AskUserQuestion 의 동작/키맵/제출 페이로드 변경, IPC/reducer/`lib/ask.ts` 파싱 로직 변경, 서브에이전트 관련 일체(→ 0042).

## 설계

### 대상 컴포넌트 (모두 기존)
- `features/chat/components/AskUserQuestionCard.tsx` — 컴포저 인라인 카드(AC1~4·6~8). 옵션 버튼 className 의 선택 분기(`selected ? 'border-rust bg-rust-soft' : …`, 현 252~254행)·인디케이터(257~260행)·헤더 chip(224행)·kbd 배치(269~273·306~313행)를 스크린샷 톤으로 교체.
- `features/chat/components/transcript/AskExchange.tsx` — 완료 Q&A 인라인(AC5). 질문 라인(21~24행)·답변 버블(26~32·35~40행) 톤/여백 정합. `bg-bubble-user` 토큰 유지.
- `features/chat/components/transcript/tool-bodies/AskBody.tsx` — 요청됨 툴카드 본문(JSON compact). 시각 변동 최소(필요 시 여백만).
- `features/chat/components/Composer.tsx` — 패널 스택 간격(AC6)만 미세조정(구조 변경 없음).

### 재사용 / 경계
- 색·간격은 Tailwind 시맨틱 토큰(`bg-bubble-user`·`text-ink`·`border-t5`·`text-t6`·`bg-t1/t2` 등)만 사용. raw hex 금지(`app/AGENTS.md` §스타일링).
- 중립 선택 톤에 신규 토큰이 필요하면 `styles/tokens.css` `@theme` 의 **classic/dark/cool 세 스코프 전부**에 추가(AC8).
- 그룹 스코프 격리 규약 유지(익명 `group-hover:` 금지). 기존 `Button`/`Icon` atom(`shared/ui`) 재사용.
- 변경은 `features/chat` 내부 + `shared/ui`·`styles` 한정 → 레이어 경계 위반 0.

## 영향 받는 파일

- `app/src/renderer/src/features/chat/components/AskUserQuestionCard.tsx` (AC1~4·6~8)
- `app/src/renderer/src/features/chat/components/transcript/AskExchange.tsx` (AC5)
- `app/src/renderer/src/features/chat/components/transcript/tool-bodies/AskBody.tsx` (미세, 필요 시)
- `app/src/renderer/src/features/chat/components/Composer.tsx` (AC6, 간격만)
- `app/src/renderer/src/styles/tokens.css` (신규 중립 톤 토큰 필요 시, 3 스코프)

## 참고 문서

- `docs/arch/frontend/dom-architecture.md` (`app-frame-*`·floating UI·패널 스택)
- `app/AGENTS.md` §스타일링(시맨틱 토큰·신규 CSS 금지·3 테마 스코프·그룹 스코프 격리)
- 선행 핸드오프: `0020-composer-cc-layout`(패널 스택 도입)·`0022-tool-approval-overlay`(additive 카드 스택 패턴)
- IPC 변경 없음 → `IPC_CONTRACT.md` 무관.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: 없음(순수 표현 계층 — 시각 검증으로 갈음). `lib/ask.ts` 파싱 무변경이므로 기존 `lib/ask.test.ts`·`chatReducer.ask.test.ts` 무회귀 확인.

---

## [구현 체크리스트] (Claude 직접 구현)

> 사용자 결정: 스크린샷 미공유 → **Claude 판단(Claude Code 중립 톤)** 으로 진행. 선택 시각 = accent-on-indicator-only.

- [x] AC1 옵션 선택 톤 중립화 — 컨테이너 `border-rust bg-rust-soft`→`border-border-strong bg-t3`(중립 면), 인디케이터에만 accent(`border-rust bg-rust`) 유지. 단일=원형/다중=사각 보존.
- [x] AC2 헤더 chip 정제 — `bg-rust-soft uppercase tracking-wide text-rust`→`bg-t3 text-t7`(중립·sentence-case).
- [x] AC3 번호 배지·kbd 힌트 (라운드2, 이미지1) — 번호 배지 수직 중앙정렬(`mt-0.5`→`self-center`), 하단 verbose 키보드 힌트 줄(`↑↓ 이동 · Space …`) 제거(스크린샷에 없음, Enter 힌트는 primary 버튼에).
- [x] AC4 이전/다음 화살표 + 1/N 카운터 (라운드2, 이미지1) — 별도 화살표 행 제거 → 1/N 카운터를 질문 헤더 선두 배지로 이동(`bg-t3 text-t7`); primary 버튼이 전진 겸함(비-마지막=`다음`/goNext·현재 질문 답하면 활성, 마지막=`제출`/submit·전체 답해야 활성), Enter 동일 분기; 우상단 `×`=건너뛰기. ←→ 키보드 질문이동·자동진행 보존.
- [x] AC5 `AskExchange` 버블 (라운드2, 이미지2) — 좌질문/우답변-항목별 분리 → **단일 우측 사용자 버블**에 줄마다 `질문(text-ink2) 답변(font-semibold)` 결합. `bg-bubble-user` 유지, header 표기 제거.
- [x] AC6 컴포저 패널 스택 간격 — 카드 루트 `mb-2` 제거(부모 `gap-2` 이중간격 해소).
- [x] AC7 키보드·자동진행·기타입력·접근성 무회귀 — 핸들러/파싱 무변경, className/토큰만 교체.
- [x] AC8 classic/dark/cool 3 테마 — 전부 themed 토큰(`t3`·`t7`·`border-strong`·`rust`)만 사용, 신규 토큰 0.
- [x] 게이트 lint/typecheck/test 통과.

## [구현 보고] (Claude 직접 구현)

| 항목 | 내용 |
|---|---|
| 변경 파일 | **라운드1**: `AskUserQuestionCard.tsx`(P1 선택 톤·P3 mb-2·P4 헤더 chip). **라운드2(스크린샷 재공유 후)**: `AskUserQuestionCard.tsx`(AC3·AC4 — 헤더 카운터·×·다음/제출 버튼·번호배지·힌트줄 제거) + `AskExchange.tsx`(AC5 단일 결합 버블). `AskBody.tsx`/`tokens.css` 무변경. |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅(node+web+test) / test ✅ **471/471**(better-sqlite3 Node ABI 재빌드 후 green) |
| 인수 기준 | **AC1~8 전부 코드 반영**(라운드1=1·2·6·7·8, 라운드2=3·4·5). 시각 최종 판정은 사람. |
| 블로커 / 역질문 | 없음 |
| 편차 (라운드2) | ① 헤더 우상단 collapse chevron(⌄)은 미추가(새 collapse 상태 회피 — `×`=건너뛰기만). ② 다중질문 시 per-question header 라벨 대신 1/N 카운터만 표시(스크린샷 일치). ③ 옵션 좌측 라디오/체크 인디케이터는 유지(AC1, 스크린샷엔 없으나 본 라운드 범위 밖). |
| 대상 커밋 | (push 후 기재) |

## [라운드3] 피드백 수정 (Claude 직접 구현)

사용자 피드백 3건(스크린샷):

1. **AskExchange 정렬 버그** — 라운드2에서 Q&A 버블이 우측(사용자 측)으로 갔다. 어시스턴트가 물은 것이므로 `justify-end`→`justify-start`(좌측). `bg-bubble-user` 유지(우측 사용자 답변과 구분).
2. **답변 미표시 버그** (Q1=기타입력 문자열 + Q2=복수선택 배열) — 정적 추적상 데이터 경로는 정상(기존 `ask.test.ts:13` 통과)이라 원인은 **질문 키 불일치**(answers 키=요청 정규화 경로 `q.question` ↔ `parseAsk` 의 질문원천=`call.input.questions` 원본 args). `parseAsk` 를 매칭 비의존으로 강화: questions 있으면 **키 매칭→인덱스 폴백**, questions 비면 **answers 엔트리로 직접 items 구성**. 단위테스트 2건 추가(키 불일치 폴백·questions 빈+answers).
3. **복수 질문 화살표** — 헤더 `1/N` 카운터 **좌측**에 `←`/`→` 아이콘 버튼(`multiQuestion` 한정, `goPrev`/`goNext`, 경계 `disabled`). 라운드2 다음/제출 버튼·×·자동진행·키보드 유지.

| 항목 | 내용 |
|---|---|
| 변경 파일 | `AskExchange.tsx`(정렬) · `lib/ask.ts`+`lib/ask.test.ts`(답변 폴백+테스트) · `AskUserQuestionCard.tsx`(화살표) |
| 게이트 결과 | lint ✅ / typecheck ✅(node+web+test) / test ✅ **473/473**(+2 parseAsk) |
| 편차 | 답변 미표시는 정적 재현 불가(경로 정상) → 키 불일치 가설에 견고한 폴백으로 대응. 런타임 재현 시 근본원인 추가 확인 가능. |

## [사람 확인 대기]

- UI 시각 검증(`npm run dev`): 옵션 선택 톤이 중립(회색 면 + 강한 경계, accent 는 라디오/체크 인디케이터에만)으로 바뀌었는지, 헤더 chip 무채도·sentence-case, ask 카드 아래 간격, **3 테마(특히 cool — `rust`=파랑) 선택 톤**.
- 스크린샷 픽셀 일치를 원하면 이미지 1~5 재공유 → 후속 정밀 정렬 라운드.
- PR 머지 승인.
