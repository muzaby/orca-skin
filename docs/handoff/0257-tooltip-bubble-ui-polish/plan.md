# Plan — 0257-tooltip-bubble-ui-polish

## 메타

| 항목 | 값 |
|---|---|
| slug | `0257-tooltip-bubble-ui-polish` |
| 작성자 | Claude Code |
| 일자 | 2026-10-12 |
| 매핑 | 사용자 라이브 세션 (`/handoff-plan`) — 9개 요청 중 4·5·6·8번. 나머지는 0256·0258·0259 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: ① 아티팩트 뷰어가 다운로드·복사 중 툴바 아래에 '저장 중' 같은 문구 줄을 띄운다(`ArtifactViewer.tsx:125-138`). ② 툴팁 대부분이 OS 기본(흰 배경) `title` 이고 커스텀 툴팁은 다크 테마에서 밝은 배경이 된다(`Popover.tsx:128` `bg-ink text-bg`). ③ 긴 사용자 메시지가 버블에 전부 펼쳐진다. ④ effort 메뉴가 수준마다 설명 문장을 붙인다(`EffortMenu.tsx:41-43`).
- 완료 후 달라지는 것: 뷰어에는 동작 문구가 없다. 모든 툴팁은 검은 배경·흰 글자다. 10줄을 넘는 사용자 메시지는 접히고 '더 보기'·'간략히 보기'로 오간다. effort 메뉴는 라벨만 보인다.
- 성공을 사용자 관점에서 한 문장으로: 첨부 7·8·9처럼 보이고, 아티팩트를 내려받아도 뷰어 안에 아무 문구가 생기지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "아티팩트 다운로드 시도시 아티팩트 본문에 '저장 중' 같은 메시지가 출력되고 있다. 본문에는 어떠한 메시지도 출력하지 않는다." | 사용자 턴 1 |
| 명시 요구 | "툴팁은 모두 bg 검은색으로 한다. 글자폰트는 흰색계열이다. 7번째 첨부 이미지를 참고하라" | 사용자 턴 1 |
| 명시 요구 | "메시지 버블에 일정이상 표현될때 모두 출력하지 말고 생략할 것. 더보기 버튼 클릭시 모두 표시하고, 간략히 보기 버튼 클릭시 다시 원래대로 되돌릴 것. 8번째 첨부 이미지를 참고하라. 첨부 이미지는 더보기 버튼위에 마우스를 호버한 장면이다." | 사용자 턴 1 |
| 명시 요구 | "컴포저의 effort 팝업메뉴에서 노력에 대한 상세설명을 제거하라. 9번째 첨부이미지 참고." | 사용자 턴 1 |
| 추론 의도 | "모두" 는 OS가 그리는 `title` 툴팁을 포함한다 — 화면 툴팁 대부분이 그것이다 | `title=` JSX 135회/69파일(§8) |
| 추론 의도 | '메시지 버블' = 사용자 버블(`UserBubbleText`). 어시스턴트 응답은 버블이 아니다 | `UserBubbleText.tsx` 소비 4곳 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 아티팩트 뷰어는 복사·다운로드의 진행·성공·취소 문구를 어디에도 쓰지 않는다 — 툴바 아래 status 줄을 없앤다. 복사 성공은 복사 아이콘의 체크 전환만 남는다 | "본문에는 어떠한 메시지도 출력하지 않는다." | 사용자 턴 1 | ACTIVE | — |
| D-002 | 동작 실패는 지금처럼 토스트로 알린다 | 0242 ΔV2 D-011(`useArtifactViewerActions.ts:35-36`) — 실패는 사용자가 요청한 동작의 결과 | 기존 결정 | ACTIVE | — |
| D-003 | 본문의 미리보기 상태 안내(불러오는 중·형식 미지원)는 유지한다 | 다운로드가 낸 문구가 아니라 파일 상태다 — "다운로드 시도시 … 메시지" 의 범위 밖 | 설계자 해석 | ACTIVE | — |
| D-004 | 툴팁 = 배경 `#0b0b0b` · 글자 `#ffffff`, 라이트·다크 동일 | "bg 검은색 … 글자폰트는 흰색계열" + 첨부 7 실측 (11,11,11)·(255,255,255) | 사용자 턴 1 / 실측 | ACTIVE | — |
| D-005 | "모두" 를 앱 루트의 `TooltipHost` 1개로 지킨다 — 마우스가 `title` 요소에 올라가면 `title` 을 잠시 떼어 OS 툴팁을 막고 검은 툴팁을 그린 뒤, 떠나면 되돌린다. 기존 `title=` 자리는 고치지 않는다 | 135개 자리를 바꾸면 새 코드가 `title=` 을 쓸 때마다 다시 흰 툴팁이 된다 | 설계자 | ACTIVE | — |
| D-006 | 표시 지연 500ms(OS 기본 체감). 직전 툴팁이 300ms 안에 닫혔으면 즉시. 위치는 대상 아래 가운데, 공간이 없으면 위 | 동작 체감은 바꾸지 않고 색만 바꾼다 | 설계자 | ACTIVE | — |
| D-007 | 기존 커스텀 툴팁(`Popover role="tooltip"` · 사용량 차트)도 같은 표면 클래스를 쓴다 | "모두" | 사용자 턴 1 | ACTIVE | — |
| D-008 | 사용자 버블 본문이 10줄을 넘으면 10줄만 보이고 마지막 줄이 흐려지며, 버블 안 왼쪽 아래에 '더 보기'. 펼치면 '간략히 보기' | 원문 + 첨부 8 실측(보이는 줄 10 · 마지막 줄 회색 154 · 버튼 hover 배경 (229,229,228)) | 사용자 턴 1 / 실측 | ACTIVE | — |
| D-009 | 접기 대상 = `UserBubbleText` 소비 4곳(트랜스크립트 사용자 메시지 · 대기 메시지 · 질문 답변 버블 · 서브에이전트 프롬프트 버블) | "메시지 버블" — 같은 컴포넌트가 정책을 갖는다(`UserBubbleText.tsx:10-12`) | 설계자 | ACTIVE | — |
| D-010 | 버블 전체 문장을 담은 `title` 3자리를 없앤다 | 전체 보기는 '더 보기'가 맡고, D-005 이후에는 메시지 전체가 검은 툴팁으로 뜬다 | 설계자 | ACTIVE | — |
| D-011 | 펼침 상태는 버블 키별로 앱 메모리에 둔다(디스크 저장 없음) — 가상화로 화면 밖에 나갔다 돌아와도 유지 | `TranscriptView` head 가상화가 항목을 언마운트한다(`TranscriptView.tsx:100-127`) | 설계자 | ACTIVE | — |
| D-012 | '간략히 보기' 후 버블 위쪽이 화면 위로 벗어나 있으면 버블이 보이도록 스크롤한다 | 접으면 아래 내용이 끌려 올라와 읽던 자리를 잃는다 | 설계자 | ACTIVE | — |
| D-013 | effort 메뉴의 수준별 설명 문구와 그 번역 키(ko·en 5개씩)를 지운다. '노력' 제목 · '추천' 태그 · 체크는 유지. 첨부 9 상단 안내 문장은 추가하지 않는다 | "노력에 대한 상세설명을 제거하라" — 제거 요구에 새 설명을 붙이지 않는다 | 사용자 턴 1 / 설계자 | ACTIVE | — |
| D-014 | 비범위: 아티팩트 HTML iframe 안의 툴팁 · 키보드 포커스 툴팁(OS 기본도 없음) · 어시스턴트 응답 접기 · 0259 메뉴 항목 툴팁 문구 | 요청 밖 / 0259 소관 | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 언급되지 않았지만 유지되는 결정: 0242 ΔV2 D-011(D-002로 승계), 0246 D-014 '추천' 태그(D-013에서 유지).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001 ↔ AC1 · D-002 ↔ AC1(토스트 단언) · D-003 ↔ AC2 · D-004 ↔ AC3·AC7 · D-005 ↔ AC3·AC4·AC5 · D-006 ↔ AC3·AC4 · D-007 ↔ AC6 · D-008 ↔ AC9·AC10 · D-009 ↔ AC12 · D-010 ↔ AC12 · D-011 ↔ AC11 · D-012 ↔ AC10 · D-013 ↔ AC13 · D-014 ↔ AC8(범위 경계)·§6.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 문구는 뷰어 status 줄 한 곳에서만 나온다 | `ArtifactViewer.tsx:125-138` · 카드(`ArtifactCard.tsx`)는 문구 없이 버튼만 비활성 |
| 이미 기존 코드가 충족하는가 | 툴팁: 커스텀은 `Popover role="tooltip"` 1곳뿐, 나머지는 OS `title` | `rg role=\"tooltip\"` → 1 (`TaskProgressList.tsx:171`) |
| 더 작은 해법이 있는가 | 툴팁 색은 CSS로 못 바꾼다(OS 창). `title` 을 가로채는 호스트가 최소 변경이다 | Chromium `title` 툴팁은 OS 렌더 |
| 선행 자료의 주장을 코드와 대조했는가 | 0242 ΔV2 D-011 "status 줄은 진행·성공만" — 이번에 그 줄 자체가 사라진다 | `useArtifactViewerActions.ts:35-36` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 0083의 버블 전체 `title`(오버플로 보조)을 D-010이 대체 — 접기가 같은 목적을 맡는다 | `git log -S"title={text}"` → `22cdb774`(0083) |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: Chromium은 비활성 폼 컨트롤에도 click 계열을 뺀 마우스 이벤트를 보낸다(blink-dev Intent to Ship 2022-10, Edge 정책 기준 109~120에 정착) — Electron 39(Chromium 142)에서 `disabled` 버튼의 `title` 도 호스트가 받는다.

## 5. 동작 / 사용자 흐름

```text
[툴팁] 마우스가 title 요소에 들어감 → 500ms → 검은 툴팁(아래 가운데)
        → 떠남/누름/키/휠/스크롤/창 비활성/요소 사라짐 → 닫힘, title 원복
[버블] 렌더 → 본문 > 10줄? → 접힘(마지막 줄 흐림) + '더 보기'
        → '더 보기' → 전체 + '간략히 보기' → '간략히 보기' → 접힘(+ 필요 시 스크롤)
[뷰어] 복사/다운로드 → 버튼 비활성(진행) → 끝: 복사면 체크 아이콘, 저장·취소는 무표시
        ↘ 실패 → 토스트
[effort] 칩 클릭 → '노력' 제목 + 낮음·중간(추천)·높음·엑스트라·최대, 줄마다 라벨만
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `title` 요소 hover 500ms | `title` → `data-orca-tooltip` 로 옮기고 툴팁 표시 | 검은 툴팁. OS 툴팁 없음 |
| hover 중 컴포넌트가 `title` 값을 바꿈 | 새 값을 다시 옮기고 문구 갱신 | 툴팁 문구만 바뀜 |
| 떠남 · pointerdown · keydown · wheel · scroll · 창 blur · 대상 DOM 제거 | 숨김 + `title` 원복 | 툴팁 사라짐 |
| 버블 본문 ≤ 10줄 | 접기 없음 | 버튼 없음 |
| 버블 본문 > 10줄 · 처음 | 접힘 | 10줄 + 흐린 마지막 줄 + '더 보기' |
| '더 보기' | 키 저장 → 펼침 | 전체 + '간략히 보기' |
| 펼친 버블이 가상화로 언마운트 후 복귀 | 저장된 키로 펼침 유지 | 펼친 그대로 |
| '간략히 보기' · 버블 위쪽이 화면 위 | 접힘 + 버블이 보이게 스크롤 | 버블이 화면에 남는다 |
| 창 폭 변경 | 줄 수 재측정 | 10줄 경계에 따라 버튼 생김/사라짐 |
| 뷰어 다운로드 진행 | 버튼 비활성 | 문구 없음 |
| 뷰어 다운로드 성공·취소 | 상태만 정리 | 문구 없음 |
| 뷰어 복사 성공 | `copied` | 복사 아이콘 체크 |
| 뷰어 복사·다운로드 실패 | `reportError`/`reportArtifactIssue` | 토스트(현행) |

### 파생 UX / 엣지케이스

- 툴팁 문구에 줄바꿈이 있으면 줄을 지키고(예: 아티팩트 카드 `title`·0259 스킬 설명) 최대 폭 28rem에서 감는다.
- 포털 팝오버 안의 `title` 도 같은 호스트가 처리한다(document 단위 위임).
- 텍스트 선택: 접힌 버블도 전체 텍스트가 DOM에 있다 — 복사 버튼(`MessageMeta`)은 전체를 복사한다(현행).
- keyboard/a11y: '더 보기' 는 `button` + `aria-expanded`·`aria-controls`. 툴팁 호스트는 마우스 hover만 다룬다 — 키보드 포커스 경로의 `title` 의미는 그대로다.
- theme: 툴팁 색은 두 테마 동일(D-004).

## 6. 범위 / 비범위

- **범위**: 뷰어 status 줄·관련 문구 키 제거 · `TooltipHost` + 툴팁 토큰·표면 SSOT + 기존 커스텀 툴팁 재도색 + SVG `<title>` 경로 제거 · `UserBubbleText` 접기와 4 소비처 · 버블 `title` 3자리 제거 · effort 설명 제거.
- **비범위**: D-014 4항목.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 키보드 포커스 툴팁 | 아니오 — 호스트에 `focusin` 추가로 확장 | 후속 후보 |
| 어시스턴트 응답 접기 | 아니오 | 요청 시 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 뷰어에서 복사·다운로드가 진행 중일 때와 성공·취소 뒤에 뷰어 트리에 동작 문구(`copyBusy`·`downloadBusy`·`copied`·`saved`·`cancelled` 키 또는 그 한국어 문장)와 툴바 아래 `role="status"` 줄이 없다. 복사 성공 뒤 복사 버튼 아이콘은 `check` 다. 실패는 토스트 1건(현행 문구) | `ArtifactViewer.actions.test.ts` 개정: 진행 중(pending promise)·완료 후 렌더 트리 전체 문자열에 다섯 키 0건 · 미리보기 ready 상태에서 `role="status"` 0건 · 복사 후 `leadingIcon === 'check'` · 실패 토스트 단언 유지 | `ArtifactViewer` 툴바 → `useArtifactViewerActions` |
| R-01 | AT-02 / AC2 | 미리보기 불러오는 중·형식 미지원 안내는 본문에 그대로 보인다 | 기존 케이스 유지(형식 미지원 바이너리 다운로드 가능 케이스 `:158-176`) + loading 렌더 단언 | `ArtifactViewer` 본문 |
| R-02 | AT-03 / AC3 | `title` 이 있는 요소에 마우스가 500ms 머물면 그 요소의 `title` 이 비워지고(`data-orca-tooltip` 로 이동) 검은 툴팁이 그 문구로 뜬다. 툴팁 표면은 `bg-tooltip`·`text-tooltip-ink`·`whitespace-pre-line`·최대 폭 28rem | `TooltipHost` UT(stub document + 가짜 요소 + fake timers): 499ms 미표시 · 500ms 표시 · 문구 일치 · 대상 `title` 부재 · Popover 표면 클래스 단언 | `App` → `TooltipHost` → `Popover role="tooltip"` |
| R-02 | AT-04 / AC4 | 떠남·pointerdown·keydown·wheel·scroll·window blur·대상 DOM 제거 각각에서 툴팁이 닫히고 `title` 이 원래 값으로 돌아온다. 300ms 안에 다른 `title` 요소로 옮기면 즉시 뜬다 | 같은 UT: 7 트리거 표 구동 · 원복 값 일치 · warm 이동 0ms 표시 | 같음 |
| R-02 | AT-05 / AC5 | hover 중 컴포넌트가 `title` 을 새 값으로 다시 달면 즉시 다시 떼어 OS 툴팁을 막고 툴팁 문구를 새 값으로 바꾼다. 떠나면 새 값으로 원복한다 | 같은 UT: MutationObserver 콜백 모사 | 같음 |
| R-02 | AT-06 / AC6 | 기존 커스텀 툴팁(작업 진행 목록의 `Popover role="tooltip"` · 사용량 차트 툴팁)이 같은 검은 표면과 흰 글자(보조 줄은 `text-tooltip-ink-muted`)를 쓴다 | `Popover` render UT(role=tooltip 클래스 = 표면 SSOT) · `usageTooltip.render.test.ts` 개정 | `TaskProgressList` · `TokensPerDayChart` |
| R-02 | AT-07 / AC7 | 툴팁 색 토큰 3종은 `@theme` 에만 있고 `[data-theme='dark']` 에서 재정의되지 않는다 | CSS 원문 UT | `tokens.css` |
| R-02 | AT-08 / AC8 | 프로덕션 renderer에 SVG `<title>` 툴팁 경로가 없다(`UsageCircle` 의 미사용 `title` prop 제거) | `rg -n "<title>" app/src/renderer/src --glob '*.tsx' --glob '!*.test.*'` → 0 | — |
| R-03 | AT-09 / AC9 | 버블 본문의 높이가 10줄(계산된 line-height × 10)을 넘으면 접힘 클래스(`max-h-[10lh]` + 아래쪽 마스크)와 '더 보기' 버튼이 붙고, 넘지 않으면 둘 다 없다 | 순수 UT(`bubbleCollapse`: scrollHeight·line-height → 판정, `normal` line-height 폴백) · render UT(접힘/펼침 마크업) | `UserBubbleText` |
| R-03 | AT-10 / AC10 | '더 보기' → 펼침 + 라벨 '간략히 보기' + `aria-expanded="true"`. '간략히 보기' → 접힘 + '더 보기'. 접을 때 버블 상단이 스크롤 영역 위에 있으면 `scrollIntoView({block:'nearest'})` 1회, 보이면 0회 | 상태 reducer UT · 접기 후속 helper UT(가짜 요소 rect) · render UT 라벨 | `UserBubbleText` 버튼 |
| R-03 | AT-11 / AC11 | 펼침 상태는 `collapseKey` 로 저장돼 컴포넌트가 다시 마운트돼도 유지되고, 다른 키에 새지 않는다 | `bubbleExpansionStore` UT(키별 토글·재조회) | 가상화 head 재마운트 |
| R-03 | AT-12 / AC12 | 4 소비처가 고유 `collapseKey`(`message.id` · `steer:<id>` · `ask:<call.id>` · `subagent:<toolUseId>`)를 넘기고, 버블 루트에 전체 문장 `title` 이 없다 | 소비처 render UT(UserMessage·PendingSteerTurn·AskExchange 각 1 + SubAgent 원문 단언) | 각 소비처 |
| R-04 | AT-13 / AC13 | effort 메뉴의 각 `menuitemradio` 행은 라벨(+ '추천' 태그 · 체크)만 갖고 ko·en 설명 문장이 없다. 0246 '추천' 단언은 그대로 통과한다 | `effortMenu.render.test.ts` 개정: 이전 설명 10문장(ko 5·en 5) 0건 · 행마다 텍스트 노드 = 라벨(+태그) · 기존 '추천' 케이스 유지 | `Composer` → `EffortMenu` |
| R-01~R-04 | AT-14 / AC14 | 실제 앱에서 툴팁(라이트·다크, 버튼·비활성 버튼·잘린 파일명), 긴 메시지 접기(첨부 8), effort 메뉴(첨부 9), 아티팩트 다운로드 중 문구 없음을 확인한다 | 사람 실기 — `npm run dev` | 앱 실행 |
| 전체 | AT-15 / AC15 | lint·typecheck 0 오류, 관련 vitest green | §19 | 전체 |

### AC 검증 주의사항

- 기존 테스트 재사용: `ArtifactViewer.actions.test.ts` 의 `status()`(`:77-79`) 단언 9곳(`:118,123-125,156,175,199,204,213,217,221,228`)은 status 줄을 전제로 한다 — 새 계약(문구 0건)으로 바꾼다. `effortMenu.render.test.ts:39-40` 은 `.desc` 키를 참조하므로 고친다. `usageTooltip.render.test.ts` 는 색 클래스를 새 토큰으로 바꾼다 — 열람 확인.
- 사람 실기 항목: AC14만 — 실제 OS 툴팁 억제와 픽셀 색·흐림 표현은 node 환경에서 볼 수 없다. 억제 메커니즘(`title` 이동)·트리거·표면 클래스는 AC3~AC7이 기계로 잠근다.
- 0건 기준: AC1 다섯 키는 "뷰어 트리 전체 문자열"에서 센다(번역 mock이 키를 그대로 돌려준다 — `:31-34`). AC8 `<title>` 0건은 "없다"만 잠근다 — 툴팁 존재는 AC3이 잠근다.
- N회 기준(AC10): `scrollIntoView` 프로덕션 호출부는 접기 helper 1곳이다(신설).

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 뷰어 동작 문구 없음(D-001~D-003) | NEW | — |
| R-02 | R | §5 검은 툴팁(D-004~D-007) | NEW | — |
| R-03 | R | §5 버블 접기(D-008~D-012) | NEW | — |
| R-04 | R | §5 effort 설명 제거(D-013) | NEW | — |
| AT-01..AT-15 | AT | §7 | NEW | — |
| SD-01 | SD | §9 툴팁 수명(hover → 이동 → 표시 → 숨김 → 원복) | NEW | — |
| ST-01 | ST | §11 호스트 UT(document 이벤트 구동) | NEW | — |
| SD-02 | SD | §9 버블 펼침 수명(접힘 → 펼침 → 재마운트 → 접힘+스크롤) | NEW | — |
| ST-02 | ST | §11 store + helper + render UT 조합 | NEW | — |
| AR-01 | AR | §10 EP-01~EP-03 호스트 ↔ Popover ↔ 토큰 표면 | NEW | — |
| AR-02 | AR | §10 EP-07 `UserBubbleText` ↔ 4 소비처 ↔ store | NEW | — |
| IT-01·IT-02 | IT | §11 | NEW | — |
| MD-01 | MD | `tooltipTarget` 순수부(찾기·이동·원복) | NEW | — |
| MD-02 | MD | `bubbleCollapse` 순수부(판정·line-height) | NEW | — |
| MD-03 | MD | `useArtifactViewerActions` `copied` 계약 | NEW | — |
| MD-04 | MD | `EffortMenu` 행 | NEW | — |
| UT-01..UT-04 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·AT-02 | REQUIRED | 툴바 클릭 → `runAction` → `artifactApi.save`/clipboard → 상태 → `ArtifactViewer` 렌더 | AC1·AC2 UT | **required** — 0건 스윕. A1 status 줄 복원 · A2 `copied` 대신 항상 `copy` 아이콘(형제 상태 맞바꿈) | EP-08 (4) |
| VP-02 | R-02 ↔ AT-03..AT-08 | REQUIRED | `pointerover` → `findTooltipAnchor` → `claimTitle` → 타이머 → `Popover role=tooltip` → 숨김 → `releaseTitle` | AC3~AC8 UT·`rg` | **required** — T1 claim에서 `title` 미제거 · T2 release 미원복 · T3 표면을 `bg-ink text-bg` 로 되돌림 · T4 dark 스코프 재정의 | EP-01 (3) · EP-02 (3) · EP-03 (1) · EP-04 (4) · EP-05 (7) · EP-06 (1) |
| VP-03 | R-03 ↔ AT-09..AT-12 | REQUIRED | 소비처 → `UserBubbleText`(측정 → 판정 → 접힘 클래스·버튼) → 클릭 → store → 재렌더 | AC9~AC12 UT | **required** — B1 판정 기준을 10줄 → ∞ · B2 '더 보기'↔'간략히 보기' 라벨 맞바꿈 · B3 `UserMessage` 의 `collapseKey` 제거 | EP-07 (9) |
| VP-04 | R-04 ↔ AT-13 | REQUIRED | `Composer` → `EffortMenu` 행 | AC13 render | **required** — E1 설명 span 복원 | EP-09 (3) |
| VP-05 | R-01~R-04 ↔ AT-14 | REQUIRED | 앱 실행 | 사람 실기 | not selected — 실기 직접 관측 | 0 — 기계 경로는 VP-01~VP-04 |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | document `pointerover`/`pointerout`/트리거 → 호스트 상태 → 요소 속성 | 호스트 UT 시퀀스(hover→show→leave→원복) | **required** — T1·T2(VP-02) | EP-04 (4) · EP-05 (7) |
| VP-07 | SD-02 ↔ ST-02 | REQUIRED | 클릭 → store 토글 → 재마운트 조회 → 접기 → helper 스크롤 | store·helper·render UT | **required** — B3(VP-03) + B4 접기 helper가 항상 스크롤 | EP-07 ①⑥ (2) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | `App.tsx` 마운트 → 호스트 → `Popover` 표면 → 토큰 | App 원문 단언(호스트 1회 마운트) · Popover render | **required** — T3 · M-host `App.tsx` 에서 호스트 제거 | EP-01 (3) · EP-03 (1) |
| VP-09 | AR-02 ↔ IT-02 | REQUIRED | 4 소비처 props → `UserBubbleText` | 소비처 render UT | **required** — B3 | EP-07 ②~④ (4) |
| VP-10 | MD-01 ↔ UT-01 | REQUIRED | `findTooltipAnchor`·`claimTitle`·`releaseTitle` | 순수 UT 표(중첩 `title` 안쪽 우선 · 빈 `title` 무시 · `iframe` 제외 · 이동 중 요소 재진입) | not selected — 입출력 직접 관측 | EP-04 (4) |
| VP-11 | MD-02 ↔ UT-02 | REQUIRED | `bubbleOverflow` · `lineHeightPx` | 순수 UT 경계(=10줄 미접힘, 10줄+1px 접힘) | **required** — B1 | EP-07 ① (1) |
| VP-12 | MD-03 ↔ UT-03 | REQUIRED | `runAction` → `copied` | hook 경유 render UT | **required** — A2 | EP-08 ② (1) |
| VP-13 | MD-04 ↔ UT-04 | REQUIRED | `EffortMenu` | render UT | **required** — E1 | EP-09 ① (1) |

`§10 강제 지점 전수`의 N은 자리 수다. 변이 정의·자리는 §10 "등록 변이"가 정본이다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/renderer/**` 수정 · i18n 키 패리티 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| 관련 vitest | 호스트·버블·뷰어·effort·Popover·CSS | `cd app && ./node_modules/.bin/vitest run src/renderer/src/shared/ui src/renderer/src/features/chat src/renderer/src/features/settings/components/usageTooltip src/renderer/src/styles` | 이번 변경 범위 실패만 blocking |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 뷰어 status 줄은 `action` 진행 문구와 `feedback`(복사됨·저장됨·취소) 둘 다 그린다 | `ArtifactViewer.tsx:125-138` · `useArtifactViewerActions.ts:67-96` |
| `feedback` 의 다른 소비처 = 복사 아이콘 1곳 | `ArtifactViewer.tsx:92` |
| `copyBusy`·`downloadBusy` 는 뷰어에서만, `chat.artifacts.saved`·`cancelled` 는 이 hook에서만 쓴다 | `rg` → 각 1소비처(`ko.ts:638-639,668,672`) |
| 커스텀 툴팁 표면 = `Popover` tooltip 분기 1곳 · 소비 1곳 | `Popover.tsx:16,128` · `TaskProgressList.tsx:166-172` |
| 차트 툴팁은 흰 패널 표면 | `TokensPerDayChart.tsx:22-41` |
| OS `title` 툴팁 소스 | `rg -n "\btitle=\{\|\btitle=\"" app/src/renderer/src --glob '*.tsx' --glob '!*.test.*'` → 135 / 69파일(컴포넌트 prop 포함) |
| SVG `<title>` 소스 1곳, 프로덕션 호출부는 `title` 을 넘기지 않음 | `UsageCircle.tsx:35,49` · `Composer.tsx:443-447` |
| vitest `environment: 'node'` — DOM 없음. document·요소는 stub(`TweakProvider.lifecycle.test.ts` 선례) | `vitest.config.ts` |
| 앱 루트 = `App.tsx` — `RootGate` 와 `ErrorToastLayer` 가 형제. 게이트·부팅 화면도 이 아래 | `App.tsx:19-22` |
| `Popover` 는 앵커 ref 객체가 바뀔 때 다시 배치하고, 문서 mousedown·keydown에 닫힌다 | `Popover.tsx:51-97,98-110` · ref 객체 교체 선례 `TaskProgressList.tsx:60-63` |
| 사용자 버블 정책 컴포넌트 1개, 소비 4곳 · 전체 문장 `title` 3곳 | `UserBubbleText.tsx` · `UserMessage.tsx:52-57` · `PendingSteerTurn.tsx:55-61` · `AskExchange.tsx:23` · `SubAgentTileContent.tsx:252-257` |
| 가상화 head는 항목을 언마운트하고 `measureElement` 로 높이를 다시 잰다 | `TranscriptView.tsx:100-127` |
| effort 설명 = span 1곳 + 키 맵 1개 + ko·en 각 5 | `EffortMenu.tsx:41-43` · `effort.ts:13-19` · `ko.ts:957-961` · `en.ts:949-953` |
| 첨부 7: 배경 (11,11,11) · 글자 (255,255,255) · 상자 146×30px(DPR 1.25) | PIL 실측 |
| 첨부 8: 줄 간격 25px · 보이는 줄 10 · 마지막 줄 최소 명도 154 · 버튼 hover (229,229,228) on (240,240,239) | PIL 실측 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `role="tooltip"` 소비 | `rg -n 'role="tooltip"' app/src/renderer/src --glob '!*.test.*'` | 1 | TaskProgressList |
| `UserBubbleText` 소비 | `rg -n "<UserBubbleText" app/src/renderer/src` | 4 | D-009 |
| 버블 전체 문장 `title` | 위 4곳 중 `title=` | 3 | D-010 |
| 뷰어 문구 키 소비 | `rg -n "copyBusy\|downloadBusy\|chat.artifacts.saved\|chat.artifacts.cancelled" app/src/renderer/src --glob '!*.test.*' --glob '!**/resources/**'` | 4 | 뷰어 2 · hook 2 |
| effort desc 소비 | `rg -n "EFFORT_DESC_KEYS" app/src/renderer/src --glob '!*.test.*'` | 3 | 정의 1 · import 1 · 사용 1 |

### 수치 / 전칭 표현 검산

- "커스텀 툴팁 표면은 한 곳" — 반례 검색: `rg -n "pointer-events-none.*whitespace-nowrap"` → `Popover.tsx:128` 1건뿐.
- 기존 테스트 케이스 존재: `ArtifactViewer.actions.test.ts` 9 단언 · `effortMenu.render.test.ts` 2 describe 케이스 · `usageTooltip.render.test.ts:117,131` 열람 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `SD-02`, `AR-01`, `AR-02`
- 현재 책임 소유자: 툴팁 = 각 요소의 `title`(OS) + Popover 1곳. 버블 = 폭 정책만. 뷰어 = 문구 줄 소유.

```text
<button title="…"> ──hover──→ OS tooltip (white)
Popover role=tooltip → bg-ink text-bg (dark theme: light box)
UserBubbleText = whitespace/overflow-wrap only, title={full text}
ArtifactViewer → <p role=status>{busy | copied | saved | cancelled}</p>
EffortMenu row → label + tag + check / desc line
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 위 + `MD-01`~`MD-04`
- 변경 후 책임: 툴팁 = `TooltipHost`(위임) + 표면 SSOT `TOOLTIP_SURFACE`. 버블 = `UserBubbleText` 측정·접기 + `bubbleExpansionStore`. 뷰어 = 문구 없음, `copied` 플래그만.

```text
App ─┬─ RootGate
     ├─ ErrorToastLayer
     └─ TooltipHost ──document pointerover──→ findTooltipAnchor → claimTitle(title→data-orca-tooltip)
                      └─ 500ms → Popover role=tooltip (TOOLTIP_SURFACE: bg-tooltip text-tooltip-ink)
                      └─ hide trigger ×7 → releaseTitle
UserBubbleText(collapseKey) → measure(lineHeight×10) → collapsed: max-h-[10lh] + mask + [더 보기]
                             → bubbleExpansionStore.toggle(key) → [간략히 보기] → collapse → scrollIfAbove()
ArtifactViewer: toolbar only (copy icon ← copied) · body status (loading/unsupported) unchanged
EffortMenu row: label + tag + check
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 툴팁 = OS | 툴팁 = `TooltipHost` | D-005 | AR-01 / VP-08 · `TooltipHost.tsx` |
| data/control flow | 없음 | document 위임 → 속성 이동 → Popover | D-005·D-006 | SD-01 / VP-06 · 호스트 UT |
| state/contract | 뷰어 `feedback: MessageKey` | `copied: boolean` | D-001 | MD-03 / VP-12 |
| 버블 상태 | 없음 | `bubbleExpansionStore`(키 → 펼침) | D-011 | SD-02 / VP-07 |
| 표면 토큰 | `bg-ink text-bg` | `--color-tooltip*` 3종(테마 무관) | D-004·D-007 | AR-01 / VP-02 |
| test seam | — | 순수 `tooltipTarget`·`bubbleCollapse` | 검증 | MD-01·MD-02 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/ui/tooltipTarget.ts`(신규, 순수) | 앵커 찾기 · `title` 이동/원복 · 상수(500·300ms, 속성명) | 최소 요소 인터페이스 | `TooltipHost` |
| `shared/ui/TooltipHost.tsx`(신규) | document 리스너 · 타이머 · MutationObserver · Popover 렌더 | DOM 이벤트 → 툴팁 | `App.tsx` |
| `shared/ui/tooltipStyle.ts`(신규) | `TOOLTIP_SURFACE` 클래스 SSOT | — | `Popover` · `TokensPerDayChart` |
| `features/chat/lib/bubbleCollapse.ts`(신규, 순수) | 10줄 판정 · line-height 해석 · 접기 후 스크롤 판정 | 숫자/rect → bool | `UserBubbleText` |
| `features/chat/store/bubbleExpansionStore.ts`(신규) | 키별 펼침 | key ↔ bool | `UserBubbleText` |
| `features/chat/components/UserBubbleText.tsx` | 버블 표면·본문·버튼 | props → DOM | 소비 4곳 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-02·VP-08 · EP-01 | 툴팁 표면 (3자리) | `tooltipStyle.ts` | ① `Popover` tooltip 분기 ② `TooltipHost`(Popover 경유) ③ `UsageTooltip` | 렌더 | 남은 자리 = 흰/반전 툴팁 |
| VP-02 · EP-02 | 색 토큰 (3자리) | `tokens.css @theme` | `--color-tooltip: #0b0b0b` · `--color-tooltip-ink: #ffffff` · `--color-tooltip-ink-muted`(보조 줄, 예 `#a3a3a3`) | 빌드 | dark 재정의 = 다크에서 다른 색 |
| VP-08 · EP-03 | 호스트 마운트 (1자리) | `App.tsx` | `ErrorToastLayer` 옆 1회 | 앱 렌더 | 누락 = 전부 OS 툴팁 |
| MD-01 / VP-06·VP-10 · EP-04 | `title` 이동 (4자리) | `tooltipTarget.ts` | ① pointerover claim ② pointerout release ③ 숨김 트리거 release ④ hover 중 재부착 re-claim | 이벤트마다 | ①누락 = OS 툴팁 동시 표시 · ②③누락 = `title` 영구 소실 |
| SD-01 / VP-06 · EP-05 | 숨김 트리거 (7자리) | `TooltipHost` | pointerout · pointerdown · keydown · wheel · scroll(capture) · window blur · 대상 제거(MutationObserver `childList`·`subtree`) | 이벤트마다 | 누락 = 툴팁 잔류 |
| VP-02 · EP-06 | SVG title 경로 (1자리) | `UsageCircle.tsx` | `title` prop·`<title>` 제거 | 빌드 | OS 툴팁 경로 잔존 |
| AR-02 / VP-03·VP-09 · EP-07 | 버블 계약 (9자리) | `UserBubbleText` | ① 판정·접힘 클래스·버튼·store 연결 ②~⑤ 소비 4곳 `collapseKey` ⑥ 접기 후 스크롤 helper ⑦~⑨ 전체 문장 `title` 제거(UserMessage·PendingSteerTurn·SubAgent) | 렌더·클릭 | 키 누락 = 재마운트 시 접힘 복귀 · `title` 잔존 = 메시지 전체가 툴팁 |
| VP-01·VP-12 · EP-08 | 뷰어 문구 0 (4자리) | `ArtifactViewer`·hook | ① status 줄 삭제 ② `feedback`→`copied` ③ settle이 성공·취소에 문구 미반환 ④ i18n 4키 삭제(ko·en) | 렌더 | 문구 재등장 |
| VP-04·VP-13 · EP-09 | effort 설명 0 (3자리) | `EffortMenu` | ① span 삭제(행 `align` 기본값) ② `EFFORT_DESC_KEYS` 삭제 ③ ko·en `desc` 5키씩 삭제 | 렌더 | 설명 재등장 |

### 등록 변이 (선택 적대 증거 정본)

| ID | 심을 자리 | 결함 | red여야 할 oracle |
|---|---|---|---|
| A1 | `ArtifactViewer.tsx` 툴바 아래 | status 줄 복원 | AC1 UT |
| A2 | 복사 버튼 `leadingIcon` | `copied` 무시하고 항상 `copy` | AC1 아이콘 단언 |
| T1 | `claimTitle` | `title` 미제거 | AC3 UT |
| T2 | `releaseTitle` | 원복 생략 | AC4 UT |
| T3 | `Popover` tooltip 분기 | `bg-ink text-bg` 복귀 | AC6 render |
| T4 | `tokens.css [data-theme='dark']` | `--color-tooltip` 재정의 추가 | AC7 CSS UT |
| M-host | `App.tsx` | 호스트 제거 | AC3 마운트 원문 단언 |
| B1 | `bubbleOverflow` | 기준 10줄 → `Infinity` | AC9 경계 UT |
| B2 | `UserBubbleText` 버튼 라벨 | 펼침/접힘 라벨 맞바꿈 | AC10 render |
| B3 | `UserMessage.tsx` | `collapseKey` 제거 | AC12 소비처 UT |
| B4 | 접기 helper | 화면 안이어도 스크롤 | AC10 helper UT(0회 단언) |
| E1 | `EffortMenu.tsx` | 설명 span 복원 | AC13 render |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: 툴팁 표면 클래스는 `tooltipStyle.ts` 하나를 Popover·차트가 import한다. 접힘 줄 수는 `bubbleCollapse.ts` 상수 하나를 판정과 클래스(`max-h-[10lh]`) 원문 단언이 함께 본다.
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음.
- 선택적 필드: `collapseKey?` 미지정 = 로컬 상태(재마운트 시 접힘). 프로덕션 4곳은 모두 지정(EP-07 ②~⑤).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/ui/tooltipTarget.ts`(신규) | 순수부 | `TOOLTIP_ATTR='data-orca-tooltip'` · `TOOLTIP_SHOW_DELAY_MS=500` · `TOOLTIP_WARM_MS=300` · `findTooltipAnchor(el)`(부모로 올라가며 비지 않은 `title` 또는 `TOOLTIP_ATTR` 를 가진 첫 요소, `iframe` 제외, `body` 에서 멈춤) · `claimTitle(el)` · `releaseTitle(el)` | 순수 UT(가짜 요소) |
| `shared/ui/TooltipHost.tsx`(신규) | 위임 호스트 | capture 리스너(`pointerover`·`pointerout`·`pointerdown`·`keydown`·`wheel`·`scroll`) + window `blur` · 타이머 · 앵커별 ref 객체(`useMemo`) · 표시 중 MutationObserver(앵커 `attributes:['title']` + body `childList/subtree`) · `<Popover role="tooltip" placement="bottom" align="center">` | stub document UT |
| `shared/ui/tooltipStyle.ts`(신규) | 표면 SSOT | `TOOLTIP_SURFACE = 'pointer-events-none max-w-[min(28rem,calc(100vw-1rem))] whitespace-pre-line break-words rounded-r3 bg-tooltip px-2.5 py-1.5 text-caption text-tooltip-ink shadow-sm'` | 원문 단언 |
| `shared/ui/Popover.tsx` | 표면 | tooltip 분기 클래스를 `TOOLTIP_SURFACE` 로 | render UT |
| `styles/tokens.css` | 토큰 | `@theme` 에 3색(주석: 두 테마 공통, `[data-theme]` 재정의 금지 — `--color-spinner` 선례) | CSS UT |
| `App.tsx` | 마운트 | `<TooltipHost />` 를 `ErrorToastLayer` 옆에 | 원문 UT |
| `features/settings/components/TokensPerDayChart.tsx` | 차트 툴팁 | `UsageTooltip` 표면 = `TOOLTIP_SURFACE` 계열, 보조 줄 `text-tooltip-ink-muted` | `usageTooltip.render.test.ts` |
| `shared/ui/UsageCircle.tsx` | 정리 | 미사용 `title` prop·`<title>` 삭제 | `rg` |
| `features/chat/lib/bubbleCollapse.ts`(신규) | 순수부 | `USER_BUBBLE_COLLAPSED_LINES=10` · `lineHeightPx(lineHeight, fontSize)`(`normal` → 1.2×) · `bubbleOverflows({scrollHeight, lineHeightPx})` · `shouldScrollAfterCollapse(bubbleTop, viewportTop)` | 순수 UT |
| `features/chat/store/bubbleExpansionStore.ts`(신규) | 펼침 상태 | zustand `Set<string>` · `isExpanded(key)` · `toggle(key)` | UT |
| `features/chat/components/UserBubbleText.tsx` | 버블 | 루트 = 표면(`className`), 본문 div = 기존 정책 클래스 + `contentClassName` · ResizeObserver로 판정 · 접힘 시 `max-h-[10lh] overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5lh),transparent)]` · 버튼(`text-footnote`, hover `bg-fill-uncontained-hover`) `aria-expanded`·`aria-controls` · 접기 후 helper가 참이면 `scrollIntoView({block:'nearest'})` | render·helper UT |
| `transcript/UserMessage.tsx` · `transcript/PendingSteerTurn.tsx` · `transcript/AskExchange.tsx` · `rightpanel/SubAgentTileContent.tsx` | 소비 | `collapseKey` 전달 · `title` 제거(3곳) · AskExchange의 `flex flex-col gap-1` 은 `contentClassName` 으로 | 소비처 UT |
| `i18n/resources/{ko,en}.ts` | 문구 | `chat.transcript.showMore`('더 보기'/'Show more') · `showLess`('간략히 보기'/'Show less') 추가 · `artifactViewer.copyBusy/downloadBusy` · `artifacts.saved/cancelled` · `composer.effort.*.desc` 삭제 | typecheck |
| `rightpanel/ArtifactViewer.tsx` · `hooks/useArtifactViewerActions.ts` | 뷰어 | status 줄 삭제 · `feedback`→`copied` · 다운로드 settle은 실패 보고만 | actions UT |
| `composer/EffortMenu.tsx` · `composer/effort.ts` | effort | 설명 span·`align="start"` 삭제 · `EFFORT_DESC_KEYS` 삭제 | render UT |
| 테스트 개정·신규 | — | 개정: `ArtifactViewer.actions.test.ts` · `effortMenu.render.test.ts` · `usageTooltip.render.test.ts`. 신규: `shared/ui/{tooltipTarget,TooltipHost}.test.ts` · `styles/tooltipCss.test.ts`(토큰·`App.tsx` 마운트 원문) · `features/chat/lib/bubbleCollapse.test.ts` · `features/chat/store/bubbleExpansionStore.test.ts` · `features/chat/components/userBubble.render.test.ts`(소비처 포함) | — |

### 테스트 가능성

- 별도 순수 파일: `tooltipTarget.ts`(요소는 `getAttribute`·`setAttribute`·`removeAttribute`·`hasAttribute`·`parentElement`·`tagName` 만 쓰는 구조 타입) · `bubbleCollapse.ts`.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `Popover` 는 앵커 ref 객체가 바뀔 때만 다시 배치한다 — 호스트는 앵커마다 새 ref 객체를 만든다(`TaskProgressList.tsx:60-63` 선례). Popover의 mousedown·keydown 닫힘은 툴팁 숨김 트리거와 같은 방향이다.
- 순서를 관측할 훅: 호스트 UT는 stub document에 등록된 리스너를 직접 호출하고 fake timers로 500ms 경계를 본다.

## 12. End-to-end 영향

### producer → consumer

```text
any element[title] → (document event) → TooltipHost → Popover(portal body) → user
UserBubbleText(consumer props) → measure → store → render
```

- producer 기준: `title` 문자열 그대로(줄바꿈 보존).
- consumer 파생 규칙: 툴팁 문구 = 이동 시점의 값, hover 중 재부착 시 최신 값.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `TOOLTIP_ATTR` 은 hover 중에만 존재하고 떠나면 지운다 — 정본은 다시 `title`.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `title` 135자리 | 검은 툴팁으로 표시 | AC3·AC14 |
| `TaskProgressList` 툴팁 | 표면만 변경 | AC6 |
| 0259 메뉴 항목 `title`(설명·출처 2줄) | 호스트가 줄바꿈 유지로 표시 | AC3(pre-line) |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 호스트는 마운트 시 리스너 등록, 언마운트 시 해제·타이머 취소·표시 중이면 원복.
- 취소/중단: 숨김 트리거 7종.
- 종료/quit/crash/renderer-gone: 메모리 상태만 — 원복 누락이 남을 영속 대상 없음.
- retry/timeout/partial failure: 해당 없음.
- cleanup/rollback: `releaseTitle` 은 `title` 이 이미 있으면(React가 새 값을 단 경우) 덮지 않고 이동 속성만 지운다.
- **다중 저장소 쓰기**: 해당 없음 — 문서 산출의 상태 사본은 이 plan과 `INDEX.md` 두 곳이며 마무리 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 리스너: document capture 6 + window 1, 처리 = 부모 체인 걷기(DOM 깊이 상한). 표시 중 MutationObserver 2개, 숨김 시 해제.
- 버블: 소비 버블마다 ResizeObserver 1 — 가상화가 화면 밖 항목을 언마운트하므로 동시 관찰 수 ≈ 보이는 버블 수.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0242 ΔV2 D-011 status 줄은 진행·성공만, 실패는 토스트 | `useArtifactViewerActions.ts:35-36` | D-001·D-002 | 변경(줄 제거) + 실패 토스트 유지 |
| 0083 버블 오버플로 처리와 전체 `title` | `22cdb774` | D-010 | 변경 — 접기가 대체 |
| 0246 D-014 effort '추천' 태그 | 0246 plan | D-013 | 유지 |
| 새 토큰은 두 테마 스코프 전부 | `src/renderer/AGENTS.md` | EP-02 | 유지 — 테마 무관 고정색은 `@theme` 1곳(`--color-spinner` 선례, `tokens.css:87-91`) |
| 그룹 스코프 격리 | 같은 문서 | 버블 버튼 hover | 유지 — 버튼 자체 `hover:` 만 쓴다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| React가 관리하는 속성을 DOM에서 잠시 옮긴다 | React는 prop 변화 때만 속성을 쓴다 — 재부착은 AC5가 잠근다 |
| hover 중 스크린리더 설명(`title`) 부재 | 마우스 hover 동안만. 키보드 포커스 경로는 손대지 않는다(D-014) |
| `mask-image`·`lh` 단위 | Chromium 142 지원. 사람 실기 AC14로 시각 확인 |
| 0256(글자 배율)과 같은 파일(`AskExchange`·`PendingSteerTurn`·`UserMessage`) 수정 | 0256 → 0257 순서로 구현해 충돌을 한 번에 푼다(INDEX 비고) |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- §11 표의 파일 전부.
- 문서: `docs/arch/frontend/ux-domains.md` 에 툴팁 호스트·버블 접기 한 줄씩(현재 상태 서술) — 표제 위치는 구현자가 기존 절에 맞춘다.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 등 환경 제약: DB 미사용.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A gate 표.
- 사람 실기: AC14.

## READY self-review

- [x] Decision Ledger가 결정을 보존한다.
- [x] Part I만 읽어도 완료 상태가 이해된다.
- [x] "어떠한 메시지도"를 동작 문구로 한정한 해석을 D-003에 근거와 함께 적었다.
- [x] 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] AS-IS와 TO-BE가 같은 축으로 있다.
- [x] Delta 각 행이 파일·AC로 이어진다.
- [x] 사라지는 책임(버블 `title`, 뷰어 status 줄)은 삭제이며 대체(접기, 아이콘·토스트)를 적었다.
- [x] 수치·전칭·테스트 인용을 실측했다.
- [x] 각 AC가 행동 단언·검증·도달 경로를 가진다.
- [x] Baseline V · NEW node마다 REQUIRED pair.
- [x] 적대 증거는 0건 스윕·자리·표 pair만 선택했다.
- [x] 운영 gate 열거.
- [x] 사람 실기는 픽셀·OS 억제 체감(AC14)만.
- [x] "툴팁이 쓰인다"(호스트 마운트·표면)는 지우면(M-host·T3) red, 자리 계약(라벨)은 맞바꾸면(B2) red.
- [x] 신규 계약의 SSOT·강제 지점·seam이 있다.
- [x] 기존 소비처(135 `title`·TaskProgressList·차트)를 확인했다.
- [x] 게이트 명령이 하위 AGENTS와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: 뷰어 status 줄 제거 · `TooltipHost` 위임 · `UserBubbleText` 접기 · effort 설명 제거 모두 Part II 그대로.
- 이견 / 현실성 문제: `Message` 타입에 `id` 가 없다(`chatReducer.ts:224-232`) — §11의 `message.id` 키 대신 `user:${message.createdAt}` 를 쓴다(§6 #1).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-02·VP-08 | EP-01 툴팁 표면 | 3 | 3/3 | `rg -n "TOOLTIP_SURFACE" app/src/renderer/src --glob '!*.test.*'` → `Popover.tsx`·`TokensPerDayChart.tsx`·(`TooltipHost` 는 Popover 경유) | — |
| VP-02 | EP-02 색 토큰 | 3 | 3/3 | `tokens.css` `@theme` 3줄 · 다크 스코프 0(tooltipCss UT) | — |
| VP-08 | EP-03 호스트 마운트 | 1 | 1/1 | `App.tsx` `<TooltipHost />` 1회(tooltipCss UT) | — |
| VP-06·VP-10 | EP-04 title 이동 | 4 | 4/4 | `tooltipController.ts` pointerover claim · pointerout release · 트리거 release · observe re-claim(controller UT 13케이스) | — |
| VP-06 | EP-05 숨김 트리거 | 7 | 7/7 | pointerout + `HIDE_EVENTS` 4 + window blur + observe 제거 콜백 — UT `it.each` 6 + 떠남 1 | — |
| VP-02 | EP-06 SVG title | 1 | 1/1 | `UsageCircle` `title` prop 삭제 · `<title>` 스캔 0 | — |
| VP-03·VP-09 | EP-07 버블 계약 | 9 | 9/9 | ① `UserBubbleText` ②~⑤ `rg -n "collapseKey=" …/components` → 4 ⑥ `shouldScrollAfterCollapse` 경유 ⑦~⑨ `title={text\|item.text\|prompt}` 0 | — |
| VP-01·VP-12 | EP-08 뷰어 문구 0 | 4 | 4/4 | status 줄 삭제 · `copied` · settle boolean · i18n 5키 삭제(ko·en, `copied` 포함 — §6 #2) | — |
| VP-04·VP-13 | EP-09 effort 설명 0 | 3 | 3/3 | span 삭제 · `rg EFFORT_DESC_KEYS` → 0 · ko·en `desc` 10 삭제 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: `App.projects.test.ts` 의 Provider 순서 단언에 `TooltipHost` 추가 · `usageTooltip.render.test.ts` 에 검은 표면 양성 단언 추가.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `ArtifactViewer.actions` 14케이스(`expectQuiet`) | A1·A2 red |
| VP-02 | REQUIRED | SELF_PASS | tooltip UT 28 + tooltipCss 5 | T1~T4 red |
| VP-03 | REQUIRED | SELF_PASS | bubble 순수 7 + store 1 + render/원문 6 | B1·B2·B3 red |
| VP-04 | REQUIRED | SELF_PASS | effortMenu 6 | E1 red |
| VP-05 | REQUIRED | SELF_BLOCKED | 사람 실기 대기(AC14) | not selected |
| VP-06 | REQUIRED | SELF_PASS | controller 수명 UT | T1·T2 red |
| VP-07 | REQUIRED | SELF_PASS | store·helper·render | B3·B4 red |
| VP-08 | REQUIRED | SELF_PASS | App 마운트·Popover 원문 | T3·M-host red |
| VP-09 | REQUIRED | SELF_PASS | 소비처 원문·render | B3 red |
| VP-10 | REQUIRED | SELF_PASS | tooltipTarget 순수 UT 5 | not selected |
| VP-11 | REQUIRED | SELF_PASS | 경계 UT | B1 red |
| VP-12 | REQUIRED | SELF_PASS | 아이콘 단언 | A2 red |
| VP-13 | REQUIRED | SELF_PASS | 행 텍스트 단언 | E1 red |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 뷰어 툴바 아래 status 줄 복원 | A1 | 최초 | `ArtifactViewer.actions` 2 failed | 잠김 |
| 복사 아이콘이 `copied` 무시 | A2 | 최초 | 2 failed | 잠김 |
| `claimTitle` 이 title 유지 | T1 | 최초 | tooltip 3 failed | 잠김 |
| `releaseTitle` 원복 생략 | T2 | 최초 | tooltip 11 failed | 잠김 |
| Popover 표면 `bg-ink text-bg` 복귀 | T3 | 최초 | tooltipCss 1 failed | 잠김 |
| 다크 스코프 `--color-tooltip` 재정의 | T4 | 최초 | tooltipCss 1 failed | 잠김 |
| `App.tsx` 호스트 제거 | M-host | 최초 | tooltipCss 1 failed | 잠김 |
| 접기 기준 ∞ | B1 | 최초 | bubbleCollapse 1 failed | 잠김 |
| 더 보기↔간략히 보기 맞바꿈 | B2 | 최초 | bubbleCollapse 1 failed | 잠김 |
| `UserMessage` collapseKey 제거 | B3 | 최초 | userBubble 2 failed | 잠김 |
| 접기 helper 항상 스크롤 | B4 | 최초 | bubbleCollapse 1 failed | 잠김 |
| effort 설명 span 복원 | E1 | 최초 | effortMenu 2 failed | 잠김 |

- **분모 검산**: `선택 증거 12 · 인용 변이 0 · 새 oracle 0(expectQuiet·원문 스캔은 A1·M-host로 함께 셈) = 표 행 12`.
- **덮개 회귀**: 해당 없음 — 최초 라운드.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음 — `showMore`/`showLess` 는 `UserBubbleText` 버튼 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 호스트 로직을 `tooltipController.ts` 로 분리 — dispose 가 리스너·관찰·title 원복을 함께 정리(UT) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 뷰어 실패 = '실패 → 토스트' 행 · 툴팁 대상 제거 = '대상 DOM 제거' 행 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 다운로드 성공·취소는 이제 무표시(D-001 그대로) — OS 저장 창이 닫히는 것이 결과다 | 사람 실기 AC14 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 기존 `current()` 세대 확인 유지(late result 6케이스 green) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `Message` 에 `id` 없음 — plan §11·AC12의 `message.id` 키 불가 | ✅ 선조치 `user:${message.createdAt}` · 📝 plan 수정 제안: AC12 키 표를 `user:<createdAt>` 로 | `chatReducer.ts:224-232` |
| 2 | 뷰어 `artifactViewer.copied` 도 소비처가 사라졌다 | ✅ 선조치 — ko·en에서 함께 삭제(EP-08 ④ 4키 → 5키) | `rg artifactViewer.copied` 비테스트 0 |
| 3 | 호스트 로직을 `TooltipHost.tsx` 안 대신 순수 `tooltipController.ts` 로 분리 | ✅ 선조치 — node 환경에서 이벤트 수명을 테스트하려면 React 밖 seam 필요 | controller UT 13 |
| 4 | `SubAgentTaskDetail` 은 `selectedId` 가 아니라 `task` prop을 받는다 | ✅ 선조치 키 = `subagent:${selected.toolUseId}` | `SubAgentTileContent.tsx:231-245` |
| 5 | `settlement.integration.test.ts` 5건 red | ⚠️ 보고만 — better-sqlite3 ABI(0256과 동일) | 변경 전 트리 동일 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 접기 키 `user:<createdAt>`(§6 #1) · 컨트롤러 파일 분리(§6 #3).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 메모리 Set, 만료 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | `createdAt` 이 같은 두 사용자 메시지(같은 ms)가 펼침을 공유할 수 있다 — 같은 세션 같은 ms 커밋은 사실상 없음 | AC11 store UT(키 분리) |
| 재진입 | 라이브 낙관 메시지와 커밋 메시지의 `createdAt` 이 다르면 커밋 시 펼침이 접힘으로 돌아갈 수 있다 | 사람 실기 AC14에서 확인 |
| 다른 무효화 축 | 세션 재로드 후 키 동일(DB createdAt) — 메모리라 앱 재시작이면 접힘 | D-011(디스크 저장 없음)과 일치 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `shared/ui/{tooltipStyle,tooltipTarget,tooltipController}.ts`·`TooltipHost.tsx` · `features/chat/{lib/bubbleCollapse,store/bubbleExpansionStore}.ts` · 수정 `Popover`·`UsageCircle`·`App.tsx`·`tokens.css`·`TokensPerDayChart`·`UserBubbleText`·소비 4·`ArtifactViewer`·`useArtifactViewerActions`·`EffortMenu`·`effort.ts`·i18n ko/en · 테스트 신규 7·개정 5 · 문서 `ux-domains.md` |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `vitest run src/renderer src/main/infra/settings` · 변이 12건 |
| **관측한 게이트 산출** | typecheck exit 0 · lint 0 error/1 warning(기존) · vitest 296파일 2465케이스: 2460 pass · 5 red = `settlement.integration` DB ABI(변경 전 동일) |
| V-pair 자기확인 | `SELF_PASS 12 / SELF_BLOCKED 1(VP-05 실기)` |
| 강제 지점 전수 | 9행 모두 N/N |
| **AC 자기보고**(`Criteria-Met`) | AC1 expectQuiet·아이콘 · AC2 형식 미지원 본문 status 유지(`:158-176` green) · AC3~AC5 controller UT · AC6 Popover 원문·차트 render · AC7 CSS UT · AC8 `<title>` 0 · AC9·AC10 순수·경계 UT · AC11 store UT · AC12 소비처 원문·render · AC13 effortMenu · AC15 gate ✅ / AC14 실기 ⚠️ |
| **합계 검산** | `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음(최초).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: plan이 존재하지 않는 `message.id` 를 인용(§6 #1).
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI.
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | hover 중 React가 조건부 `title`을 제거하면 떠날 때 옛 값이 복원된다(제거는 mutation record 없음) — 프로덕션 조건부 `title` 3자리 | D-005 메커니즘 · AC 밖 | 옮긴 값의 보관·제거 감지 방식 재검토 | NON_BLOCKING | open |
| D2 | `TooltipHost` 실제 MutationObserver 설정이 미잠금 — Y3(`attributeFilter`)·Y4(`isConnected`) green | VP-06 어댑터 edge · plan oracle은 콜백 모사 | stub MutationObserver 어댑터 UT | NON_BLOCKING | open |
| D3 | AC12·§11 키 `message.id`가 없는 필드 — 구현 `user:<createdAt>` | AC12 문구 | 설계자가 키 표 정정 | NON_BLOCKING | open |
| D4 | pointerdown 원복 뒤 같은 요소 위 mousemove에서 OS 툴팁이 뜰 수 있다(가설) | AC4 · AC14 | AC14 실기에서 확인 | NON_BLOCKING | 실기 대기 |
