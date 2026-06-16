# Plan — 0022-tool-approval-overlay

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목   | 값                          |
| ------ | --------------------------- |
| slug   | `0022-tool-approval-overlay` |
| 작성자 | Claude Code                 |
| 일자   | 2026-06-16                  |
| 매핑   | PHASES "현재 작업 중"       |
| 상태   | DRAFT → READY               |

## Context (왜)

Orca 채팅 composer 에서 **도구 실행 승인**(위험 도구 Bash/Write/Edit 등)이 뜨면 현재는 `ApprovalCard` 가 **입력 패널 전체를 대체**한다(`Composer.tsx:336-338` — `pendingPlanReview || pendingToolApproval ? <ApprovalCard/> : <입력패널/>`). 승인 카드가 떠 있는 동안 프롬프트 입력 UI 자체가 화면에서 사라진다.

**Claude Code 데스크톱 앱**의 도구 승인 UX 로 정렬한다 — 승인 카드는 입력 패널 위에 뜨고, 입력 영역은 비활성 상태로 그대로 남으며, 취소(중단) 버튼만 활성이다.

사용자 결정(질의 완료):

- 도구 승인 UI 를 입력 패널 **바로 위에 별도 카드로 스택**(in-flow)한다. composer 영역은 하단 고정이라 입력행+컨트롤행은 맨 아래 핀(pin) 유지, **패널은 그 위로 쌓이며 자란다**(상향 성장).
- **각 패널은 자기 border 를 가진다**(시각적 구분). 도구 승인 카드는 자기 `border + shadow` 유지(borderless 아님). 추후 공지 등 패널도 같은 방식으로 위에 누적.
- 프롬프트 입력 UI 는 **입력을 받을 수 없는(비활성) 상태**로 트리거되고, **취소(중단) 버튼은 활성**이다.
- **이 패턴은 도구 승인(tool_approval)에만 적용.** 계획 승인(plan_review)은 *사용자 입력(수정 제안 textarea)* 으로 이어질 수 있으므로 현행 '입력 대체' 방식을 그대로 유지한다(두 분기 의도적 분리).

> **설계 근거 — 기존 `AskUserQuestionCard` 와 동일 모델.** `app-frame-composer` 컨테이너에는 border/배경이 없고(`relative pb-[18px] pt-3`), 각 카드(입력 패널·ask·승인)가 *각자* `border + shadow` 를 갖고 `ReadingColumn` 안 수직 흐름으로 스택된다. `AskUserQuestionCard`(`AskUserQuestionCard.tsx:27-29` — "입력 패널 바로 위에 in-flow 위젯으로 렌더")가 이미 이 패턴을 쓴다. 도구 승인도 자기 border 카드로 입력 패널 위에 스택한다. (검토 중 폐기된 오답 2개: ① scroll-to-bottom 의 `absolute bottom-full` 음수 상대좌표 부유 — 성격이 다른 1회성 floating 버튼, ② 단일 공유 border 안 borderless 슬롯.)

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. `pendingToolApproval` 시 **입력 패널이 사라지지 않고** 그대로 마운트된다(footer 칩/모델/작업량 배치 동일).
2. 도구 승인 본문(거부 / 세션 동안 허용 / 허용)이 입력 영역 **위에 additive** 로 표시된다(입력 대체 아님).
3. 도구 승인 카드는 **자기 `border + shadow` 를 가진 별도 카드**로 입력 패널 **바로 위에 in-flow 스택**된다(`AskUserQuestionCard` 와 동일 패턴, absolute 부유/borderless 슬롯 아님). composer 영역은 하단 고정이라 카드가 위로 자라고 입력행+컨트롤행은 맨 아래 핀 유지.
4. `pendingToolApproval` 동안 textarea 는 **입력 불가(disabled)** + 비활성 톤(플레이스홀더/캐럿 비표시, 타이핑·Enter 전송 차단).
5. `pendingToolApproval` 동안 전송 버튼 자리에 **취소(중단) 버튼이 활성**(`data-behavior="action:cancel-turn"`)으로 표시된다.
6. `Ctrl+Enter` 허용 단축키·거부·세션 동안 허용 동작과 카피는 현행 유지.
7. **계획 승인(plan_review)은 현행 '입력 대체' 방식 그대로** — 분기 분리(사용자 결정).
8. 게이트 4종(lint/typecheck/test/build) 통과, 레이어 경계(eslint-boundaries) 위반 0, 신규 의존성 0, IPC 변경 0.

## 범위 / 비범위

- **범위**: tool_approval 렌더 위치를 '입력 대체' → '입력 패널 위 별도 카드 스택(`AskUserQuestionCard` 패턴) + 입력 비활성' 으로 전환. `HighlightedTextarea` 에 `disabled` 추가. plan_review 분기 분리.
- **비범위**: plan_review 동작/위치 변경, 승인 카드 카피/버튼 구성 변경, IPC·reducer·store 로직 변경, `AskUserQuestionCard` 변경.

## 설계

### 분기 분해 — `Composer.tsx:328-338`

기존 `AskUserQuestionCard` 라인(`:328-335`) 패턴을 그대로 미러한다.

```
<ReadingColumn>
  …
  {activeAsk && <AskUserQuestionCard … />}        // 기존 additive 카드
  {pendingToolApproval && <ToolApprovalBody />}   // 신규 additive 카드 (입력 위 스택)
  {pendingPlanReview ? (
    <ApprovalCard … />                            // plan 만 입력 대체 (현행 유지)
  ) : (
    <div className="epitaxy-prompt …">            // 입력 패널 — 항상 렌더
      …
    </div>
  )}
</ReadingColumn>
```

- ternary 조건에서 `pendingToolApproval` 을 **제거** → `pendingPlanReview ? <ApprovalCard/> : <입력패널/>`. 도구 승인은 ask 라인과 입력 패널 **사이**에 별도 라인으로 분리.
- `ApprovalCard`(`hasPlanReview` 분기로 `PlanApprovalBody` 렌더)는 plan_review 전용으로 남는다 — **변경 없음**.

### `ToolApprovalBody` 그대로 재사용 — `ApprovalCard.tsx:38-101`

- 현 비공개 함수 `ToolApprovalBody` 를 **export 만 추가** 하여 Composer 가 직접 렌더.
- 현재 스타일(`app-frame-plan-approval rounded-r7 border border-t5 bg-surface-primary-elevated px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]`)이 **자기 border + shadow 카드**라 입력 위 스택에 그대로 적합 — borderless 변형 불필요.
- `YellowDot`·Ctrl+Enter 핸들러·카피·버튼(거부/세션 동안 허용/허용) 전부 유지.
- 카드 간 간격(`mt`/`mb`)은 `AskUserQuestionCard` 와 동일 수치로 맞춘다(스택 일관성).
- 파일 상단 주석(`:6-11`)의 "입력 *대체*형" 설명을 분기별(plan = 입력 대체 / tool = 입력 위 카드 스택)로 갱신.

### `HighlightedTextarea` `disabled` 추가 — `composer/HighlightedTextarea.tsx`

- props 에 `disabled?: boolean` 추가 → `<textarea disabled={disabled}>`(`:181-194`) 로 전달.
- mirror/캐럿 톤을 비활성으로(예: `text-ink3` / `opacity`, placeholder 표기 유지·캐럿 숨김).
- disabled 시 textarea 가 key/change 이벤트를 발생시키지 않아 Enter 전송·자동완성(skill/file)이 자연 차단된다.

### 입력 비활성 + 취소 버튼 — `Composer.tsx:344-387`

- textarea 에 `disabled={pendingToolApproval != null}` 전달.
- 취소(중단) 버튼: `inflight` 는 승인 대기 중 이미 true(턴이 권한 대기로 진행 중)라 기존 `inflight ? <중단버튼> : <전송버튼>`(`:362-386`) 분기에서 **중단 버튼이 이미 노출**된다. 안전을 위해 조건을 `inflight || pendingToolApproval != null` 로 확장해 명시 고정한다(`canAbort` 는 그대로 — claude 는 항상 true).

### 레이어 경계

변경은 전부 `features/chat/components/**` 내부 — boundaries 위반 없음. 신규 파일·의존성 없음, IPC/store/reducer 무변경.

## 영향 받는 파일

- renderer: `app/src/renderer/src/features/chat/components/Composer.tsx`(분기 분해·disabled/취소 배선), `.../components/ApprovalCard.tsx`(`ToolApprovalBody` export + 주석), `.../components/composer/HighlightedTextarea.tsx`(`disabled` prop)
- docs(선택): `docs/arch/frontend/` 렌더링 문서(§7.6 ApprovalCard 일반화)에 "tool 승인 = 입력 위 카드 스택(ask 패턴) / plan 승인 = 입력 대체" 분기 1줄 기록.

## 참고 문서

- `docs/arch/frontend/` 렌더링 §7.6 (ApprovalCard 일반화), `dom-architecture.md`(`app-frame-*`·`data-behavior` 마커 체계).
- 기존 패턴 참조: `features/chat/components/AskUserQuestionCard.tsx`(입력 위 in-flow 카드), `Composer.tsx:291-303`(scroll-to-bottom — *반례*, 이 기법은 쓰지 않음).
- 시각 기준: Claude Code 앱 도구 승인 — 승인 카드가 입력 위, 입력은 비활성, 취소 활성.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (+ `npm run build`).
- reducer/store/IPC 무변경 → **신규 단위 테스트 불필요**. UI 변경은 시각 검증으로 갈음(`app/AGENTS.md` §4). verify 는 시각 검증 항목을 "사람 확인 대기" 로 분리한다.

---

## [Codex 기입] 구현 체크리스트

- [x] `Composer.tsx` 분기 분해 — ternary 에서 `pendingToolApproval` 제거 + ask 라인 아래 additive `ToolApprovalBody` 라인 추가
- [x] `ApprovalCard.tsx` `ToolApprovalBody` export + 주석 갱신(분기별 설명)
- [x] `HighlightedTextarea` `disabled` prop 추가 + 비활성 톤
- [x] `Composer.tsx` 입력 disabled(`pendingToolApproval`) + 취소 버튼 조건 `inflight || pendingToolApproval` 확장
- [ ] (선택) `docs/arch/frontend/` 렌더링 문서 분기 1줄 기록
- [ ] 게이트 4종 통과(lint/typecheck/test/build) — 환경의 `node_modules` 부재/설치 중단으로 실행 불가

## [Codex 기입] 구현 보고

| 항목            | 내용            |
| --------------- | --------------- |
| 변경 파일       | `app/src/renderer/src/features/chat/components/Composer.tsx`, `app/src/renderer/src/features/chat/components/ApprovalCard.tsx`, `app/src/renderer/src/features/chat/components/composer/HighlightedTextarea.tsx` |
| 실행 명령       | `npm run lint && npm run typecheck && npm test && npm run build`; `npm install`; `npm ci --ignore-scripts`; `npm install --ignore-scripts --no-audit --no-fund --prefer-offline` |
| 게이트 결과     | `npm run lint` 실패: 초기 `node_modules` 부재로 `eslint` package/config resolution 실패. 의존성 설치 명령은 네트워크/설치 단계에서 출력 없이 장시간 대기해 중단. |
| 블로커 / 역질문 | 게이트 실행을 위한 의존성 설치 환경 확인 필요. 코드/IPC/store/reducer 변경 관련 역질문 없음. |
| 대상 커밋       | `afc7270` |

---

## Round 2 (사용자 피드백 — Claude 직접 구현)

round-1 을 사용자가 **Claude Code 데스크톱 앱**처럼 다듬는 5개 피드백. 이번 라운드는 Claude 가 직접 구현(plan → impl → verify). **항목 5 는 round-1 의 입력 비활성화를 되돌린다.**

### Round-2 인수 기준

1. 권한 요청 중 textarea **입력 가능**(비활성 아님) — round-1 `disabled` 제거. 중단 버튼은 노출 유지(`inflight`).
2. `HighlightedTextarea` 의 round-1 `disabled` prop 일습 원복 → dead-code 0.
3. 입력 패널에서 **컨트롤 라인 분리** → 별도 패널. *그 패널만* bg 투명·borderless(`app-frame-composer-controls … px-1`, 테두리/배경 없음). 입력 패널은 테두리·`bg-panel` 유지.
4. composer 를 **패널 스택**으로 — ask/도구승인/입력/컨트롤을 `flex flex-col gap-2` 로 일정 간격 수직 배치(스크린샷 기준).
5. `ToolApprovalBody` 버튼: `거부`(좌) · `세션 동안 허용`+`허용`(우 그룹). `허용` 에 `Ctrl+Enter` 라벨 없음(`kbd` 제거), Ctrl/⌘+Enter 승인 핸들러는 유지.
6. title → (보조 설명) → 요약(코드블록) → 버튼 간격 정돈(`mt-1`/`mt-2`/`mt-3`). input 에 `description` 있으면 본문에 노출(`toolDescription`).
7. 게이트 4종 통과, 레이어 경계 0, 신규 의존성 0, IPC 무변경.

### Round-2 구현 보고 (Claude)

| 항목            | 내용 |
| --------------- | ---- |
| 변경 파일       | `Composer.tsx`(패널 스택 래퍼·컨트롤 패널 분리·`disabled` 제거), `ApprovalCard.tsx`(`toolDescription` 헬퍼·본문 보조설명·버튼 재배치·`kbd` 제거·간격), `composer/HighlightedTextarea.tsx`(`disabled` prop 원복) |
| 실행 명령       | `npm install`(876 pkgs) → `npm rebuild better-sqlite3`(Node ABI) → `npm run lint`/`typecheck`/`test`/`build` + `npx prettier --write` |
| 게이트 결과     | lint ✅ · typecheck ✅(node/web/test) · **test 381/381 ✅**(better-sqlite3 Node ABI 재빌드 후 전체 green) · build ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋       | (impl 커밋 hash — push 후 기재) |
