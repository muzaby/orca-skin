# Plan — 0006-composer-status-line

> Claude Code 설계. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0006-composer-status-line` |
| 작성자 | Claude Code |
| 일자 | 2026-06-10 |
| 매핑 | PHASES 행 (verify PASS 시 승격) / PR (미정) |
| 상태 | DRAFT → READY |

## Context (왜)

채팅 composer 바로 위에 뜨는 **단일 상태 알림 줄**(Tier1 pill) + 클릭 시 펼쳐지는 **Tier2 팝오버**를 만든다. 목적은 컨텍스트 포화 위험을 **AI 비기너가 숫자 노출 없이** 인지하고, 한 번의 행동(요약 / 새 대화)으로 대응하게 하는 **앰비언트 알림**이다.

현재 앱에는 이 기능의 **상위 신호·액션 대부분이 미구현**이다:

- 세션 누적 컨텍스트 사용량은 renderer 에 노출되지 않는다. 턴 단위 `lastTelemetry`(`features/chat/reducer/chatReducer.ts`, 턴 종료마다 갱신 + 세션 로드 시 DB 최신 행 복원)만 존재한다.
- compact(요약) 실동작 미구현. `useChat().newChat`(`features/chat/hooks/useChat.ts`)은 존재하나 "핵심 요약 승계"는 미구현.
- 단, **오늘 사용 비용은 이미 구현됨** — `useCost()`(`features/cost/providers/costContext.ts`) → `summary.day.totalCostUsd` (0002-cost-token-tracking, PASS).

따라서 이 핸드오프(0006)는 **순수 presentational UI 셸**로 한정한다 — Tier1 pill + Tier2 팝오버를 **타입드 view-model prop** 으로 구동한다. 상태 판정 신호(safe/warn/danger 산출 로직)·compact 실동작·요약 승계는 **후속 핸드오프**로 분리한다.

> **스펙 원문 부재 주의**: 원 기획이 인용한 스펙 원문(req.md·05 문서)은 저장소 전 브랜치·히스토리에 없다. 그래서 카피(문구)는 본 plan 의 [§카피 표](#카피-표-ssot--이-표가-인수기준-6-의-대조-기준)를 **SSOT** 로 삼는다 — Codex 는 이 표를 1자 단위로 그대로 옮긴다. 최종 카피 검수는 사용자 시각 검증 단계에서 한다.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. **`state==='safe'` 일 때 컴포넌트가 `null` 을 반환한다** (DOM 부재 — `display:none` 아님). 팝오버 토글 트리거도 무시된다(가드).
2. **`state==='warn'`** 에서 pip(색 점)·강조가 **호박색**(`--color-warn` 토큰)으로, **`state==='danger'`** 에서 **점토색**(`--color-bad` 토큰)으로 나타난다. raw hex 금지(시맨틱 토큰/Tailwind 유틸).
3. **pill 클릭 → composer 위로 Tier2 팝오버가 열린다.** 재클릭 / 바깥 클릭 / `Esc` 로 닫힌다. (기존 `shared/ui/Popover.tsx` `placement="top"` 재사용 — click-outside·Esc·portal 내장. **신규 click-outside 훅 금지.**)
4. **`warn`**: 팝오버에 **"대화 가볍게 요약하기"(추천/primary)** + **"정리하고 새 대화 시작"(보조)** 둘 다 보인다.
5. **`danger`**: 팝오버에 **"요약하기" 버튼이 없고**, **"정리하고 새 대화 시작"이 추천(primary)** 으로 보인다.
6. **한 줄 문구·팝오버 카피가 본 plan §카피 표와 정확히 일치**한다. **기술용어 0개** (토큰/컨텍스트/세션/모델/압축/위험/초과/실패 등 노출 금지).
7. **팝오버 하단에 예상치 disclaimer 가 항상 표시**된다.
8. **색 외 문구로도 상태 구분**(색맹 대응). pill 은 `<button>` 이고 `aria-expanded`/`aria-haspopup` 를 설정한다.
9. **콜백 배선**:
   - "정리하고 새 대화 시작" → `useChat().newChat` **실배선**.
   - "오늘 비용" 줄 → `useCost()` → `summary.day.totalCostUsd` **실배선** (summary 미로드(`null`) 시 비용 줄만 생략, 나머지는 표시).
   - "요약하기" → `onCompact` 콜백 호출 (핸들러는 **미구현 스텁**: `console.warn` + `// TODO(후속 핸드오프): compact 실동작` 주석. prop 미주입 시 no-op).
10. **게이트 통과** + **view-model 매핑 순수함수 단위테스트** 동반 (vitest): `safe→null` / `warn→recommend='compact'·둘 노출` / `danger→recommend='newchat'·compact 숨김`. 레이어 경계(eslint-boundaries) 위반 0.

## 범위 / 비범위

- **범위**: Tier1 pill + Tier2 팝오버 presentational 컴포넌트 + 타입드 view-model + 카피 데이터 + Composer 통합 + 새대화/비용 실배선 + 요약 스텁 + view-model 매핑 순수함수 단위테스트.
- **비범위 (후속 핸드오프)**: 상태 판정 로직(safe/warn/danger 산출 — 정식 신호), 세션별 누적 토큰 renderer 노출, compact 실동작, 핸드오프 요약 승계, Tier3 드로어.

## 설계

### 접근

신규 컴포넌트는 **타입드 view-model prop** 으로만 구동되는 순수 presentational 셸이다. 상태 판정은 이 핸드오프에서 정식 구현하지 않고, Composer 가 기존 신호로 **임시 근사**해 view-model 을 합성한다(아래 §임시 상태 근사). 임시 로직에는 후속 교체용 `// TODO` 주석을 단다.

### view-model 데이터 계약 (이름 예시 — Codex 가 `features/chat` 컨벤션에 맞춰 확정)

```ts
type ConvStatus = 'safe' | 'warn' | 'danger'

interface StatusLineModel {
  state: ConvStatus
  recommend: 'compact' | 'newchat'   // primary 강조 대상
  showCompact: boolean               // = state !== 'danger'
  labels: {
    length: string                   // "긴 편이에요" / "아주 길어요"
    usage: string                    // "보통보다 조금 많아요" / "많은 편이에요"
    costToday?: string               // "약 $7.80" (상위에서 포맷; 미가용 시 생략)
  }
}
```

view-model → (문구/`showCompact`/`recommend`) 매핑은 **순수 함수**로 분리해 단위 테스트한다(인수기준 10). UI 자체는 시각 검증으로 갈음한다(`app/AGENTS.md` 원칙 4).

### 컴포넌트 (재사용 우선)

- **신규** `features/chat/components/composer/ConversationStatusLine.tsx` — pill `<button>`. `state==='safe'` 면 `return null`. pip(색 점) + 한 줄 문구 + "자세히" 보조 라벨. hover 마이크로 인터랙션은 Tailwind `transition`/`hover:-translate-y-px` 등.
  > **이름 충돌 주의**: `shared/ui/StatusLine.tsx`(턴 경과시간 표시)가 이미 있다. 신규 파일은 반드시 **`ConversationStatusLine`** 로 명명한다.
- **신규** `features/chat/components/composer/StatusPopover.tsx` — 팝오버 **콘텐츠**(제목/설명/정보 3줄/버튼/disclaimer). `ModeMenu.tsx` 콘텐츠 패턴(`features/chat/components/composer/ModeMenu.tsx`) 을 따른다.
- **재사용** `shared/ui/Popover.tsx`(`placement="top"`, pill 의 `anchorRef`) — click-outside·Esc·portal 내장.
- **신규** `features/chat/components/composer/statusCopy.ts` — 카피 상수(아래 §카피 표). `modes.ts` 의 데이터-객체 패턴을 따른다(앱에 i18n 프레임워크 없음 — 한국어 하드코딩).

### 카피 표 (SSOT — 이 표가 인수기준 6 의 대조 기준)

| 위치 | warn | danger |
|---|---|---|
| Tier1 한 줄 | `대화가 꽤 길어졌어요` | `대화가 아주 길어졌어요 — 정리가 필요해요` |
| Tier1 보조 라벨 | `자세히` | `자세히` |
| 팝오버 제목 | `대화가 길어지고 있어요` | `대화가 아주 길어요` |
| 팝오버 설명 | `이대로 계속해도 되지만, 가볍게 정리하면 더 매끄럽게 이어갈 수 있어요.` | `지금은 정리하고 새로 시작하는 편이 좋아요. 지금까지 내용은 그대로 남아요.` |
| 정보줄 — 대화 길이 | `긴 편이에요` | `아주 길어요` |
| 정보줄 — 오늘 사용량 | `보통보다 조금 많아요` | `많은 편이에요` |
| 정보줄 — 오늘 비용 | `약 $7.80` (useCost 실데이터로 치환) | 동일 |
| 버튼(요약) | `대화 가볍게 요약하기` (primary) | (숨김) |
| 버튼(새 대화) | `정리하고 새 대화 시작` (보조) | `정리하고 새 대화 시작` (primary) |
| disclaimer | `표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.` | 동일 |

> 정보줄 라벨 접두("대화 길이", "오늘 사용량", "오늘 비용")는 비기술 표현이면 Codex 재량으로 다듬을 수 있으나, 위 **값 문구는 그대로** 쓴다.

### Composer 통합 지점

`features/chat/components/Composer.tsx`:

- **삽입 위치**: `app-frame-composer`(현재 `Composer.tsx:217` 부근) 내부, `ReadingColumn`(L230 부근) **위**. composer surface 위에 가운데 정렬, 상대 -y 배치.
- **팝오버 토글**: pill `anchorRef` → `<Popover placement="top">`. 기존 `telemetryOpen`/`modeMenuOpen` 토글 패턴(`Composer.tsx:305-332`, `362-373` 부근)을 복제한다.
  > **공존 주의**: Composer 에는 이미 컨텍스트 도넛 + `TelemetryPanel` 팝오버(숫자 지향, L296-332 부근)가 있다. 본 기능은 **비기너용 앰비언트 알림**으로 그와 **공존**한다 — 도넛/TelemetryPanel 을 대체하거나 제거하지 않는다.
- **view-model 합성**: 아래 §임시 상태 근사 참조. `onNewChat → chat.newChat`, `onCompact → 스텁`, `labels.costToday → useCost().summary?.day.totalCostUsd` 포맷.

### 임시 상태 근사 (후속 교체 — TODO 주석 필수)

정식 상태 판정은 비범위다. 이 핸드오프에서는 Composer 가 다음으로 `state` 를 임시 근사한다:

- 사용량 비율 = `contextTokens(lastTelemetry) / contextWindowFor(model)` (헬퍼: `features/chat/lib/contextWindow.ts` — `contextWindowFor`, `nearCompaction` 재사용 검토).
- 임계는 **상수**로 둔다(예: warn ≥ 0.6, danger 는 `nearCompaction()` 또는 ≥ 0.85). 정확한 값은 Codex 재량 + 후속 교체 대상.
- `lastTelemetry` 미존재(새 대화 직후)면 `safe`.
- **반드시** `// TODO(후속 핸드오프): 정식 상태 판정 신호로 교체 — 현재는 임시 근사` 주석을 단다.

### 스타일 토큰 (이미 존재 — 신규 추가 불필요)

- `--color-warn`(#c79431, 호박) / `--color-bad`(#b54a3a, 점토) — `styles/tokens.css`, 3 테마(classic/dark/cool) 대응 확인됨. Tailwind `text-warn`/`bg-warn`/`text-bad` 사용. raw hex 금지.

### 레이어 경계

신규 파일 전부 `features/chat/` 내부 → `shared/`(Popover)와 동일 feature 내부(useChat) + `features/cost`(useCost) 만 의존. cross-feature(`features/cost`) 접근은 **pages/app 에서 props 주입** 또는 `useCost` 가 Provider 기반 Context hook 이므로 Composer 직접 호출 가능 여부를 boundaries 규칙으로 확인하고, 위반 시 **상위(pages/app)에서 `costToday` 문자열을 props 로 주입**한다. (boundaries 위반 0 가 인수기준.)

## 영향 받는 파일

- **신규** `app/src/renderer/src/features/chat/components/composer/ConversationStatusLine.tsx`
- **신규** `app/src/renderer/src/features/chat/components/composer/StatusPopover.tsx`
- **신규** `app/src/renderer/src/features/chat/components/composer/statusCopy.ts`
- **신규** view-model 매핑 순수함수 + `*.test.ts` (위치: `features/chat/lib/` 또는 composer 하위 — Codex 컨벤션)
- **수정** `app/src/renderer/src/features/chat/components/Composer.tsx` (pill 삽입 + 팝오버 토글 + view-model 합성)
- (boundaries 회피 필요 시) `pages/` 또는 `app/` 에서 `costToday` props 주입

> IPC 변경 없음 → `docs/IPC_CONTRACT.md` 갱신 불필요.

## 참고 문서

- `docs/arch/frontend/dom-architecture.md` §3.3 (`app-frame-composer*` 마커)
- `docs/arch/frontend/layers.md` (4-layer 경계 — features→shared/동일 feature)
- `docs/arch/backend/provider-runtime.md §8` (Telemetry — 정식 상태 신호가 P1 미구현인 근거)
- 재사용 코드: `shared/ui/Popover.tsx`, `features/chat/components/composer/ModeMenu.tsx`·`modes.ts`, `features/chat/hooks/useChat.ts`(`newChat`), `features/cost/providers/costContext.ts`(`useCost`), `features/chat/lib/contextWindow.ts`

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: view-model 매핑 순수함수(safe→null / warn→compact 추천·둘 노출 / danger→newchat 추천·compact 숨김). UI 시각 검증은 사용자.

---

## [Codex 기입] 구현 체크리스트

- [ ] `ConversationStatusLine.tsx` (pill, safe→null, aria 속성)
- [ ] `StatusPopover.tsx` (제목/설명/정보 3줄/버튼/disclaimer)
- [ ] `statusCopy.ts` (카피 표 1:1)
- [ ] view-model 매핑 순수함수 + 단위테스트
- [ ] `Composer.tsx` 통합 (삽입 위치 + Popover 토글 + view-model 합성 + 임시 근사 TODO)
- [ ] `newChat` / `useCost` 실배선, `onCompact` 스텁
- [ ] 게이트 3종 통과 + boundaries 위반 0

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ⬜ / typecheck ⬜ / test ⬜ (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
