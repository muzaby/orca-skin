# Plan — 0146-composer-ime-caret-guard

> 기준 브랜치: `main` (`4688b133aa7a2c92cf48917da9bebec7e77c0179`).
> 두 차례 외부 리뷰를 반영한 `r3`다. 사용자가 구현을 명시 지시했으므로 최소 수정은 착수하되,
> 실제 Windows Electron 한글 IME 검증 전에는 correctness를 PASS로 판정하지 않는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0146-composer-ime-caret-guard` |
| 작성자 | Codex (사용자 직접 요청 및 2차 리뷰 반영) |
| 일자 | 2026-07-23 |
| 매핑 | `0145-composer-input-architecture` 후속 correctness 버그수정 / PR 미정 |
| 상태 | **IMPL_DONE — 최소 composition guard 구현 완료, GUI 검증 대기** |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 한글 입력이 Composer 폭을 넘어 soft-wrap될 때 caret이 실제 글자 위치와 정렬되지 않는 문제를 검토하고, 구조 문제라면 개선안을 제시한다. | 라이브 세션 요청 |
| 명시 요구 | 두 차례 리뷰를 반영한 handoff를 작성하고 구현을 진행한다. | 라이브 세션 요청: “핸드오프 작성하고 구현 진행하라” |
| 명시 제약 | 원인 확정 전 uncontrolled·`DraftBuffer`·rAF autosize로 확대하지 않는다. H3 재현은 AC2가 아니라 별도 DOM-owned escalation으로 보낸다. | 라이브 세션의 1·2차 리뷰 및 사용자 구현 지시 |
| 이전 결정 | `0145`의 production 정량 성능은 미측정이며 PASS로 간주하지 않는다. revision guard와 submit/attachment atomic clear는 보존한다. | `@docs/handoff/0145-composer-input-architecture/plan.md`, `verify.md` |
| 추론 의도 | 정적 코드에서 확인되는 composition 중 selection-only commit과 프로그램적 selection mutation을 먼저 차단하되, 이를 root cause 확정으로 표현하지 않는다. | 현재 `ComposerInputSurface`·`ComposerInputController` 이벤트 경로 |

## Context (왜)

`0145`는 실제 glyph와 caret을 native controlled textarea로 돌려놓고 decoration·autocomplete를
deferred revision 채널로 분리했다. 하지만 현재 surface는 composition 중에도 `onSelect`,
`onKeyUp`, `onMouseUp`을 controller snapshot에 반영하고, controller의 command gate는 React
snapshot의 `composing` 값에 의존한다.

React controlled textarea는 composition 중에도 `onChange`의 `e.target.value`를 backing state에
동기 반영해야 한다. 따라서 이번 수정은 text commit을 늦추지 않고, 즉시성 `composingRef`로
selection-only update와 프로그램적 value/selection command만 차단한다.

native/CSS geometry, `field-sizing`, controlled reconcile 중 무엇이 실제 root cause인지는 이
환경에서 Windows IME로 판정할 수 없다. 이 불확실성은 verify의 사람 GUI 게이트로 남긴다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| surface는 controlled `value={snapshot.text}`를 사용하며 `onSelect`·`onKeyUp`·`onMouseUp` 모두 selection callback을 발생시킨다. | `app/src/renderer/src/features/chat/components/composer/ComposerInputSurface.tsx:67-103` |
| controller는 selection callback을 무조건 snapshot state에 올리고, keydown composition gate는 `snapshotRef.current.composing`을 사용한다. | `app/src/renderer/src/features/chat/components/composer/ComposerInputController.tsx:254-259,318-337` |
| seed/restore/autocomplete/submit-clear 후 `focus()`가 `setSelectionRange()`를 호출하므로 composition 중 프로그램적 selection mutation 가능성이 있다. | `ComposerInputController.tsx:118-139,157-210,212-227` |
| text revision은 text가 바뀔 때만 증가하고 selection-only update는 동일 revision을 유지한다. 이 계약은 보존해야 한다. | `draftSnapshot.ts:16-52`; `draftSnapshot.test.ts:12-21` |
| React controlled textarea는 `onChange`에서 DOM의 값을 backing state에 동기 갱신해야 한다. | [React `<textarea>`](https://react.dev/reference/react-dom/components/textarea) |
| classic scrollbar gutter는 content area 폭에 영향을 줄 수 있으며 `scrollbar-gutter:stable`도 overlay scrollbar에는 gutter를 만들지 않는다. sizing A/B는 속성이 아니라 실측 `clientWidth`를 통제해야 한다. | [CSS Overflow Module Level 3 §5](https://drafts.csswg.org/css-overflow-3/#scrollbar-gutter-property) |
| 실제 Windows IME geometry는 jsdom 또는 순수 reducer 테스트로 판정할 수 없다. | `@docs/handoff/0145-composer-input-architecture/verify.md` D2 |

## 진단 라우팅 r3

| 관찰 | 우선 해석 | 다음 단계 |
|---|---|---|
| H2 plain uncontrolled에서도 재현 | native/CSS/Chromium 또는 typography/scaling 경로 | CSS·font·runtime 최소 workaround 조사 |
| H2 정상, H3 최소 controlled에서 재현 | 최소 controlled 경로가 원인 범위 | AC2를 건너뛰고 DOM-owned prototype·별도 Plan 검토 |
| H2·H3 정상, H0·H1에서 재현 | 앱 handler/controller/부모 layout 경로 | event trace로 앱 고유 차이를 축소 |
| 위 조건에서 composition 중 selection-only commit 또는 programmatic mutation 확인 | 앱 event ordering 경로 | 본 handoff의 최소 composition guard |
| H0만 재현하고 H1 정상 | decoration/layout/scroll coupling | decoration 정합성 조사, UX 제거는 별도 사용자 결정 |
| 특정 harness에서 sizing on일 때만 재현 | intrinsic sizing 경로 | 동일 `clientWidth` 조건에서 sizing 대안 별도 비교 |

H0~H3의 `field-sizing` on/off 비교는 동일 `overflow-y`와
`scrollbar-gutter:stable`을 사용하고, 각 샘플의 `clientWidth`,
`offsetWidth-clientWidth`, scrollbar 발생 여부를 기록한다. `clientWidth`가 다르면 결과를
무효 처리한다.

증상 기록에는 composition 중/종료 후 지속 여부, 다음 입력·렌더·blur/refocus·resize 중 복구
시점, 일정 px 오프셋/줄별 누적/한 frame flicker 여부를 포함한다. 이는 실행 순서를 정하는
heuristic일 뿐 H0~H3를 대체하는 인과 증거가 아니다.

## 인수 기준 (Acceptance Criteria)

1. **즉시성 composition guard**
   - controlled `onChange` text는 composition 중에도 `e.target.value`로 동기 반영한다.
   - controller가 `composingRef`를 composition event stack에서 즉시 갱신한다.
   - composition 중 `onSelect`·`onKeyUp`·`onMouseUp`의 selection-only snapshot update를
     무시한다.
   - keydown, autocomplete, submit, seed/restore, accepted-submit clear와 `setSelectionRange`
     경로는 즉시 ref와 snapshot 중 하나라도 composing이면 실행하지 않거나 종료 뒤 재평가한다.

2. **기존 입력·경쟁 계약 보존**
   - text revision 단조 증가, selection-only revision 유지, stale autocomplete 거부를 보존한다.
   - async attachment view 생성 중 text 또는 attachment가 바뀌면 둘 다 clear하지 않는 기존
     atomic clear를 보존한다.
   - `/skill`, `@file`, quoted path, 방향키·Tab·Escape, paste, undo/redo, decoration,
     `field-sizing:content`를 이번 수정에서 재설계하지 않는다.
   - 신규 의존성, IPC·DB·main process 변경이 없다.

3. **검증과 원인 표현 규율**
   - composition 중 selection-only update의 stale-ref·snapshot guard를 순수 테스트로 고정한다.
   - lint, typecheck, 영향 Vitest를 통과한다.
   - 실제 Windows Electron에서 soft-wrap, composition 종료 후 지속 여부, max-height scroll,
     zoom 100%·125%·200%를 확인하기 전에는 correctness PASS 또는 root cause 확정을 기록하지
     않는다.
   - H3가 재현되면 본 guard를 반복 확장하지 않고 DOM-owned escalation을 별도 Plan으로 연다.

## 범위 / 비범위

- **범위**: `ComposerInputController`의 immediate composition ref; composition 중 selection-only
  update와 프로그램 command 차단; `draftSnapshot` 순수 guard와 테스트; handoff/INDEX 기록.
- **비범위**: uncontrolled textarea, `DraftBuffer`, rAF autosize, `field-sizing` 제거,
  decoration/Token Summary UX 변경, `contentEditable`, 신규 진단 패널 또는 신규 의존성.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- React 19 controlled textarea와 DOM composition event ordering을 유지한다.
- `snapshotRef`는 render state보다 빠른 controller snapshot이지만 composition event handler와
  같은 stack의 command 차단에는 별도 `composingRef`가 필요하다.
- `initialDraft`·`restoredDraft` effect는 composition 중 소비하지 않고 `snapshot.composing`
  종료 전이를 dependency로 사용해 다시 평가한다.
- 신규 의존성 없음.

## 설계

### Controller guard

- `composingRef`를 `ComposerInputController`에 두고 composition callback에서 state update보다
  먼저 갱신한다.
- selection callback은 순수 `updateDraftSelectionWhenIdle`을 사용해 immediate ref와 snapshot
  둘 중 하나라도 composing이면 기존 snapshot 객체를 그대로 반환한다.
- `onKeyDown`은 `composingRef`, snapshot, native event의 합집합으로 gate한다.
- autocomplete·open-skill·submit과 async submit clear는 composition 중 no-op한다.
- seed/restore는 composition 중 소비 id를 기록하지 않고 종료 뒤 effect가 재실행되게 한다.
- `focus()`는 composition 중 `setSelectionRange()`를 호출하지 않는다.

### 순수 상태 계약

`draftSnapshot.ts`에 다음 의미의 helper를 추가한다.

```ts
updateDraftSelectionWhenIdle(snapshot, immediateComposing, start, end)
```

`immediateComposing || snapshot.composing`이면 동일 객체를 반환한다. 둘 다 false이면 기존
`updateDraftSelection`을 호출해 selection을 clamp하되 text revision은 유지한다.

### 원인 격리 경계

이번 구현은 H0에만 있는 app event 경로를 축소하는 저위험 변경이다. Windows 실기에서 증상이
남으면 selection guard를 더 복잡하게 만들지 않는다. H2/H3/sizing/CSS 매트릭스를 실행해
native 또는 controlled 경로로 라우팅한다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- composition 중 Enter/Tab은 전송·autocomplete 확정에 사용하지 않는다.
- composition 중 mouse/key selection event는 무시하지만 `onChange`가 전달하는 text와 selection은
  함께 보존한다.
- composition 중 도착한 initial/restore draft는 종료 뒤 한 번만 소비한다.
- submit의 비동기 완료 전에 새 composition이 시작되면 text·attachments를 clear하지 않는다.
- composition 종료 후 일반 selection, autocomplete, submit은 기존 동작으로 복귀한다.
- 실제 IME 후보창·caret geometry·scrollbar width는 사람 GUI 검증 대상이다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| static code evidence만으로 root cause를 단정할 수 없다. | 구현을 app-specific guard로 제한하고 실제 GUI 전에는 원인/PASS를 확정하지 않는다. |
| composition 중 외부 seed/restore 적용이 늦어진다. | 소비 id를 선점하지 않고 종료 뒤 effect가 정확히 한 번 재평가한다. |
| async submit clear가 composition 시작 직후 attachments만 지울 수 있다. | composing gate를 attachment reset보다 먼저 검사한다. |
| native engine geometry 결함이면 본 수정이 증상을 해결하지 못한다. | ownership 확장을 금지하고 H0~H3·CSS/runtime 경로로 재라우팅한다. |
| sizing A/B의 scrollbar가 inline width를 바꾼다. | `scrollbar-gutter`와 실측 `clientWidth` 일치를 함께 요구한다. |

- 되돌리기 어려운 결정: 없음.
- 단독 결정 금지 항목: decoration 제거, DOM-owned 구조 승격, Chromium/runtime 변경.

## 영향 받는 파일

- `app/src/renderer/src/features/chat/components/composer/ComposerInputController.tsx`
- `app/src/renderer/src/features/chat/components/composer/draftSnapshot.ts`
- `app/src/renderer/src/features/chat/components/composer/draftSnapshot.test.ts`
- `docs/handoff/0146-composer-ime-caret-guard/plan.md`
- `docs/handoff/INDEX.md`

## 참고 문서

- `docs/handoff/0145-composer-input-architecture/plan.md`
- `docs/handoff/0145-composer-input-architecture/verify.md`
- `docs/arch/frontend/state.md §1`
- `docs/arch/frontend/rendering.md §1.2.1`
- [React `<textarea>`](https://react.dev/reference/react-dom/components/textarea)
- [CSS Overflow Module Level 3](https://drafts.csswg.org/css-overflow-3/#scrollbar-gutter-property)
- IPC 변경 없음 — `docs/IPC_CONTRACT.md` 변경 불필요.

## 게이트

- `cd app && npm run lint`
- `cd app && npm run typecheck`
- `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat/components/composer/draftSnapshot.test.ts`
- 실제 Windows Electron 한글 IME soft-wrap·scroll·zoom은 사람 검증 대기.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구와 추론을 구분하고 구현 지시를 기록했다.
- [x] 자료조사 — 현재 코드·0145 문서·공식 React/CSS 레퍼런스를 연결했다.
- [x] 인수 기준 — immediate guard, 기존 계약, 검증 규율의 세 항목으로 작성했다.
- [x] 의존 기술 — React event/ref 전제와 신규 의존성 없음을 명시했다.
- [x] 파생 UX — IME key, seed/restore, async submit, selection 복귀를 포함했다.
- [x] 리스크 — 원인 미확정, delayed seed/restore, async clear, native/sizing 경로를 분리했다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: controlled textarea의 text commit, `field-sizing:content`, revision 및
  attachment atomic-clear 계약을 유지하면서 composition 중 selection-only update와 프로그램적
  selection mutation만 막는 최소 범위에 동의했다. H3 재현 시 AC2를 반복 확장하지 않고
  DOM-owned 별도 Plan으로 escalation한다는 라우팅도 그대로 보존했다.
- 이견 / 우려: 정적 코드와 reducer 테스트는 app-specific event 경로를 제거했다는 사실만
  증명한다. 신고된 caret geometry의 실제 원인이 이 경로라는 사실은 증명하지 못하므로,
  Windows Electron 실기 전에는 correctness PASS나 root cause 확정으로 승격하지 않는다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | composition 중 `active=false`로 surface가 사라지면 `compositionend`를 받지 못해 ref/snapshot이 영구 composing으로 남을 수 있다. | controller가 inactive로 전환되면 immediate ref와 snapshot composition을 함께 종료하고, 보류된 seed/restore effect가 다음 render에서 재평가되게 했다. | `ComposerInputController` active effect |
| 2 | accepted-submit의 attachment view 생성 중 새 composition이 시작되면 기존 revision이 아직 같아 attachments만 먼저 clear될 수 있다. | `resetAttachmentsIfUnchanged`보다 앞에서 composition을 다시 검사해 text·attachments를 모두 보존한다. | `ComposerInputController.submit` async continuation |
| 3 | effect에서 새 helper를 직접 캡처하면 매 render 재실행 또는 신규 exhaustive-deps warning을 만들 수 있다. | `updateSnapshot`, `compositionActive`, `focus`를 ref 기반 stable callback으로 만들고 dependency를 모두 명시했다. | lint 신규 warning 0 |

## [구현자 기입] 구현 체크리스트

- [x] immediate composition ref와 selection-only guard
- [x] programmatic mutation·async clear guard
- [x] 순수 테스트·lint·typecheck
- [ ] 실제 Windows Electron 사람 검증 항목 보존

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `ComposerInputController.tsx`, `draftSnapshot.ts`, `draftSnapshot.test.ts`, 본 handoff와 `INDEX.md` |
| 실행 명령 | `npm run lint`; `npm run typecheck`; Composer 영향 Vitest 5파일; 전체 `vitest run`; `node --test scripts/*.test.mjs`; `git diff --check` |
| 게이트 결과 | lint 0 error(기존 TanStack compiler warning 1), node/web/test typecheck PASS, Composer 영향 5 files·15/15 tests PASS, scripts 28/28 PASS. 전체 Vitest는 140/146 files·1122/1161 tests PASS; 실패는 환경 제약 40건(`better-sqlite3` native binding 미설치 38, read-only `/root` attachment temp 1, Electron payload 미설치 1 suite)이며 변경 경로 실패는 없다. |
| 블로커 / 역질문 | 구현 블로커 없음. 실제 Windows Electron 한국어 IME에서 H0~H3, soft-wrap, max-height scroll, zoom 100/125/200% 검증은 GUI 가능한 검증자에게 이관한다. |
| 대상 커밋 | `8c997ed` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 실제 Windows Electron Korean IME geometry 미검증 | `0145` D2 / 본 신고 | H0~H3·sizing/CSS 매트릭스와 soft-wrap 실기 | open |
