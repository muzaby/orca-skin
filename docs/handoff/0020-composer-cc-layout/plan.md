# Plan — 0020-composer-cc-layout

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목   | 값                        |
| ------ | ------------------------- |
| slug   | `0020-composer-cc-layout` |
| 작성자 | Claude Code               |
| 일자   | 2026-06-15                |
| 매핑   | PHASES "현재 작업 중"     |
| 상태   | DRAFT → READY             |

## Context (왜)

오르카 채팅 composer(메시지 입력 영역)를 **Claude Code 데스크톱 앱 레이아웃**으로 정렬한다. 현재는 textarea 아래 **단일 컨트롤 행**에 모든 칩(권한모드·모델·첨부·현재프레임·Skill)이 좌측, 백엔드 라벨·도넛·전송 버튼이 우측에 몰려 있다.

사용자 결정(질의 완료):

- 전송 버튼을 **프롬프트 입력과 같은 줄**로 끌어올리고, 하단 컨트롤 행 우측을 `모델 · 작업량 · 도넛` 순으로 재배치.
- 좌측 하단은 `권한모드 + "+"` 만 남기고, 기존 `첨부·현재프레임·Skill` 은 **`+` 메뉴 안으로** 이동.
- **작업량(effort)은 기능까지 구현** — `low|medium|high|xhigh|max` 선택을 어댑터→SDK `Options.effort` 로 전달(per-turn).
- 입력 영역·버튼 디자인을 Claude Code 톤으로.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. 전송/중단 버튼이 textarea 와 **같은 첫 행** 우측에 inline 으로 표시된다(별도 footer 행이 아님).
2. 하단 footer **우측**에 `모델 칩 · 작업량 칩 · 도넛 usage` 가 **이 순서**로 표시된다.
3. 하단 footer **좌측**에는 `권한모드 칩` 과 `+` 버튼만 남는다(기존 첨부/현재프레임/Skill 칩은 footer 에서 사라진다).
4. `+` 버튼 클릭 시 메뉴에 `첨부`(비활성)·`현재 프레임`(비활성)·`Skill` 항목이 있고, `Skill` 선택 시 기존 스킬 선택 UI(`SkillsMenu`)가 열린다.
5. 여러 줄 입력 시 입력 영역이 **위로** 자라며(패널이 하단 고정이라 위로 성장), 상한 도달 후 내부 스크롤된다. 상한은 현행 160px 보다 크다.
6. 작업량 칩으로 `낮음/중간/높음/매우 높음/최대`(= `low/medium/high/xhigh/max`)를 선택할 수 있고, 기본값은 **높음(high)**.
7. 작업량 선택값이 `orca:chat:send` payload → `TurnRequest` → 어댑터 → SDK `Options.effort` 로 전달된다(per-turn). mock 어댑터/main 로그로 확인 가능.
8. 입력 영역·전송 버튼 디자인이 Claude Code 톤(원형 전송 버튼·정렬)으로 조정된다.
9. 게이트 4종(lint/typecheck/test/build) 통과, 레이어 경계(eslint-boundaries) 위반 0, 신규 의존성 0.

## 범위 / 비범위

- **범위**: composer 레이아웃 재배열(전송 inline·우측 모델/작업량/도넛·좌측 권한모드/`+`) + effort 컨트롤 풀스택 배선 + `+` 통합 메뉴 + autogrow 상한 확대 + 전송버튼 스타일.
- **비범위**: 첨부·현재프레임 실제 기능(비활성 유지), effort **라이브 전환**(SDK `Query` 에 `setEffort` 없음 — per-turn 만 지원), effort 의 DB/settings **영속**(우선 생략, 세션 상태로만 유지·기본 high).

## 설계

### 레이아웃 — `features/chat/components/Composer.tsx:331~456`

```
prompt 패널 (epitaxy-prompt)
 ├─ Row 1 (flex items-end gap-2)
 │    ├─ HighlightedTextarea  (flex-1 min-w-0)
 │    └─ Send/Cancel 버튼      (shrink-0, self-end)
 └─ Row 2 footer (flex items-center)
      ├─ 좌: 권한모드 칩  +  "+" 칩
      └─ 우(ml-auto): 모델 칩 · 작업량 칩 · 도넛 usage 버튼
```

- 전송/중단 버튼 JSX(`Composer.tsx:431-453`)를 footer 우측 `<span>` 에서 꺼내 **Row 1** textarea 옆으로 이동(self-end 로 하단 정렬).
- 도넛 버튼+팝오버(`Composer.tsx:393-430`)는 footer 우측 끝으로.
- 백엔드 라벨(`backendLabel`, `:392`) 표기는 제거(CC 미존재) — 필요 시 도넛 `title` 로 흡수.
- 전송 버튼: 기존 `Button variant="primary" iconOnly leadingIcon="send"` 유지하되 CC 톤(원형 `rounded-full` 또는 `rounded-r5`, size 조정).

### 작업량(effort) 배선 — `model` 흐름을 그대로 미러

SDK 가 `Options.effort?: 'low'|'medium'|'high'|'xhigh'|'max'` 를 직접 지원(`docs/spec/claude/agent-sdk/typescript.md:450`). `model` 이 흐르는 경로(renderer state → `chatApi.send` payload → `SendChatMessageSchema` → `send.ts` → `TurnRequest` → `claude-code.ts` query opts)를 복제한다.

1. **shared 타입** `app/src/shared/ipc.ts`: `EffortLevel = 'low'|'medium'|'high'|'xhigh'|'max'` (L0 — main/renderer 공용, boundaries 통과).
2. **IPC 스키마** `app/src/shared/protocol.ts:24` `SendChatMessageSchema` 에 `effort: z.enum([...]).optional()`.
3. **renderer store** `features/chat/store/chatStore.ts`:
   - state `effort: EffortLevel`(기본 `'high'`).
   - `setEffort` 액션 함수(`:333` `setModel` 미러) + `chatActions` export(`:403-419`).
   - `send()` payload(`:227-234`)에 `effort: cur.effort` 추가.
4. **reducer** `features/chat/reducer/chatReducer.ts`:
   - state shape(`:39-42`)·init 상수(`:90-93`)에 `effort` 추가.
   - `SET_EFFORT` 액션 타입(`:115-120`) + 케이스(`:377` `SET_MODEL` 옆): `return { ...state, effort: action.effort }`.
5. **TurnRequest** `app/src/main/extensions/types.ts:48`: `effort?: EffortLevel`(`model?` 옆).
6. **main send** `app/src/main/ipc/chat/send.ts:248-259`: `adapter.sendMessage({ …, effort: parsed.data.effort })`.
7. **어댑터** `app/src/main/adapters/claude-code.ts:203-257`: `effort` 디스트럭처 + query options 에 `...(effort ? { effort } : {})`(`model` `:256` 패턴). live-set 불필요.

### 신규 컴포넌트 — `features/chat/components/composer/`

- **EffortMenu.tsx** (`ModeMenu.tsx` 미러): 5단계 라디오 메뉴. 한국어 라벨 `EFFORT_LABELS = { low:'낮음', medium:'중간', high:'높음', xhigh:'매우 높음', max:'최대' }`(`MODE_LABELS` 패턴).
- **AttachMenu.tsx** (`+` 버튼 popover): `첨부`(disabled)·`현재 프레임`(disabled)·`Skill` 3항목. `Skill` 클릭 시 AttachMenu 닫고 기존 `SkillsMenu`(`Composer.tsx:483-485`) 오픈(anchor=`+` 버튼).
- 작업량 칩·`+` 칩은 기존 `ComposerChip`(`composer/ComposerChip.tsx`) 재사용. 작업량 아이콘 `sparkle`, `+` 아이콘 `plus`.
- 기존 첨부/현재프레임/Skill 칩 3개(`Composer.tsx:380-389`) 제거.

### autogrow (인수 5)

`composer/HighlightedTextarea.tsx:155,193` 의 mirror+textarea `max-h-40`(160px) → `max-h-56`(224px), **두 곳 동일하게**. 위로 성장은 패널 하단 고정으로 이미 성립(상한만 확대).

### 레이어 경계

`EffortLevel` 은 L0 `shared/` 에 둬 main·renderer 양쪽이 하향 import. 신규 컴포넌트는 `features/chat/` 내부 — boundaries 위반 없음.

## 영향 받는 파일

- shared: `app/src/shared/ipc.ts`, `app/src/shared/protocol.ts`
- renderer: `app/src/renderer/src/features/chat/store/chatStore.ts`, `.../reducer/chatReducer.ts`, `.../components/Composer.tsx`, `.../components/composer/HighlightedTextarea.tsx`, 신규 `.../components/composer/EffortMenu.tsx`·`.../components/composer/AttachMenu.tsx`
- main: `app/src/main/extensions/types.ts`, `app/src/main/ipc/chat/send.ts`, `app/src/main/adapters/claude-code.ts`
- docs: `docs/IPC_CONTRACT.md` (`orca:chat:send` payload 에 `effort` 추가)

## 참고 문서

- `docs/spec/claude/agent-sdk/typescript.md` — `Options.effort`(`:450`), `ThinkingConfig`(`:587`)
- `docs/IPC_CONTRACT.md` — chat send payload(§6 변경 절차, **반드시 동시 갱신**)
- `docs/arch/frontend/dom-architecture.md` — `app-frame-composer-*` 마커 체계

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (+ `npm run build`).
- 신규 테스트 요구:
  - `chatReducer` `SET_EFFORT` 케이스 (`reducer/chatReducer.parts.test.ts` 패턴).
  - `SendChatMessageSchema` 의 `effort` 파싱(유효/무효 값).
  - (가능 시) claude-code 어댑터 `effort` → query options 매핑.

---

## [Codex 기입] 구현 체크리스트

- [x] shared `EffortLevel` + `SendChatMessageSchema.effort`
- [x] renderer store/reducer `effort` state·`SET_EFFORT`·`setEffort`·send payload
- [x] main `TurnRequest.effort` · `send.ts` 전달 · `claude-code.ts` query option
- [x] Composer 레이아웃 재배열(전송 inline · 우측 모델/작업량/도넛 · 좌측 권한모드/`+`)
- [x] 신규 `EffortMenu.tsx` · `AttachMenu.tsx` + 칩 정리
- [x] `HighlightedTextarea` max-h 확대
- [x] `IPC_CONTRACT.md` 갱신
- [x] 신규 테스트 3종
- [x] 게이트 4종 통과

## [Codex 기입] 구현 보고

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 변경 파일       | `app/src/shared/ipc.ts`, `app/src/shared/protocol.ts`, `app/src/renderer/src/features/chat/store/chatStore.ts`, `app/src/renderer/src/features/chat/reducer/chatReducer.ts`, `app/src/renderer/src/features/chat/components/Composer.tsx`, `app/src/renderer/src/features/chat/components/composer/{AttachMenu.tsx,EffortMenu.tsx,effort.ts,HighlightedTextarea.tsx}`, `app/src/main/extensions/types.ts`, `app/src/main/ipc/chat/send.ts`, `app/src/main/adapters/claude-code.ts`, 테스트 3종, `docs/IPC_CONTRACT.md` |
| 실행 명령       | `npm rebuild better-sqlite3` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 게이트 결과     | lint PASS / typecheck PASS / test 381 PASS / build PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 블로커 / 역질문 | 없음. `npm test` 전 better-sqlite3 가 Electron ABI 로 남아 있어 Node ABI 재빌드 후 전체 green 확인.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 대상 커밋       | `97f4c52`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
