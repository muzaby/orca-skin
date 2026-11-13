# Plan — 0319-background-card-doc-tables-busy-locks

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0319-background-card-doc-tables-busy-locks` |
| 작성자 | Claude Code |
| 일자 | 2026-11-13 |
| 매핑 | INDEX 후보 표 3행 승격 — 0317 독립 버그 후보(`LegacySubAgentTile.tsx:245`) · 0299 비귀속(`IPC_CONTRACT.md` 표) · 0308 독립(`sessionBusy` 소비처·`dispose` 잠금 공백) |
| 상태 | READY |
| 구현 주체 | Claude (비기능 — 버그수정·구조 감량·테스트 잠금·문서 정정) |
| V mode | `Baseline V` |
| 기준 V | `none` — 세 후보는 감사·검증의 발견이라 상속할 구현 V가 없다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 재측정 기준 | 작업 트리 = `04f3eb7`(이 설계 직전 `main` 계열 커밋). 시제작은 scratchpad worktree에서 하고 작업 트리에 남기지 않았다 |

작업은 셋이다. **W1** 백그라운드 카드 키 처리 결함 + 카드 틀 공용화 · **W2** 현재 상태 문서의 표 깨짐 · **W3** 세션 점유 가드·세션 정리의 잠금 테스트.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제:
  - W1 — 구 모델 백그라운드 타일(정본 상태가 없는 세션)의 카드 안 `백그라운드로 보내기`·`중단` 버튼에서 Enter·Space를 누르면 카드가 열리고 버튼 동작은 막힌다. 키보드로는 그 타일에서 작업을 멈추거나 옮길 수 없다. 정본 타일 카드는 이미 막고 있다.
  - W2 — 현재 상태 문서 3개의 표 8행(+ 이 설계가 고치는 후보 행 1)이 렌더에서 칸이 밀리거나 뒤 칸이 잘린다.
  - W3 — 세션 점유 판정 `sessionBusy`를 쓰는 소비처 5곳과 `dispose`의 타이머 해제 2자리가 어떤 테스트에도 잠기지 않는다. 판정을 `inflight`·`sessionResponding`으로 바꾸거나 지워도 전체 스위트가 green이다.
- 완료 후 달라지는 것: 카드 안 버튼의 키 입력은 버튼 몫이 되고 세 카드가 한 틀을 쓴다. 표가 머리 행과 같은 칸 수로 렌더된다. 7자리가 테스트에 잠긴다.
- 성공을 사용자 관점에서 한 문장으로: 키보드로 구 타일 작업을 멈출 수 있고, 화면 모양·속도는 그대로이며, 문서 표가 깨지지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "1~3 plan 작성" — 직전 답의 1(`LegacySubAgentTile` 키 처리) · 2(`IPC_CONTRACT.md` 표) · 3(0308 `sessionBusy`·`clearTimeout` 잠금) | 라이브 세션 2026-11-13 |
| 명시 요구 | "마찬가지로 구조적/모듈화 유지한 상태로 코드 경량화 진행" | 같은 턴 |
| 명시 요구 | "무작정 코드 제거 금지. Ui 회귀 금지. 성능 최소 동등 이상" | 같은 턴 |
| 추론 의도 | "마찬가지로"는 0305~0318 감량 계열의 조건을 이 세 작업에도 건다는 뜻으로 읽는다 — 고치는 자리의 되풀이는 구조 단위로 합치고, 새 사본을 만들지 않는다 | 0318 D-006·D-007 |
| 추론 의도 | 같은 결함 계열이 같은 범위에 더 있으면 함께 닫는다 — W2의 다른 현재 문서 표, W3의 다른 `sessionBusy` 소비처 | 후보 행의 대상 서술 · §8 재열거 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 대상은 세 작업이다 — W1 카드 키 결함 · W2 문서 표 · W3 잠금 테스트 | "1~3 plan 작성" | 사용자 2026-11-13 | ACTIVE | — |
| D-002 | 고치는 자리의 되풀이는 구조 단위로 합친다. 새 판정·새 사본을 만들지 않는다 | "구조적/모듈화 유지한 상태로 코드 경량화" | 사용자 2026-11-13 | ACTIVE | — |
| D-003 | 지우는 코드는 같은 동작을 공용 단위로 옮긴 것뿐이다. 표시·동작의 삭제는 0이다 | "무작정 코드 제거 금지" | 사용자 2026-11-13 | ACTIVE | — |
| D-004 | 세 카드의 마크업이 변경 전과 같다. 바뀌는 동작은 카드 안 요소에서 온 키 입력뿐이다(결함 수정) | "Ui 회귀 금지" | 사용자 2026-11-13 | ACTIVE | — |
| D-005 | 카드당 훅·효과·상태·DOM 노드·렌더당 클로저 수를 늘리지 않는다 | "성능 최소 동등 이상" | 사용자 2026-11-13 | ACTIVE | — |
| D-006 | 세 카드의 틀(role=button div·점·제목 행·키/클릭 열기)을 `harnesses/common/rightpanel/BackgroundCard.tsx` 한 컴포넌트로 합친다 | 0317 O-6 "세 카드 틀이 같다 — 셋째 자리는 키 판정이 달라 합치지 못한다"(`audit.md:59`). 키 판정을 맞추면 걸림이 없다. 선례: `TranscriptActionRow`(0149, "한쪽만 고치면 접근성이 갈라진다") · `BackgroundTaskGroup`의 위치 | 설계자 — D-002 적용 | ACTIVE | — |
| D-007 | 키 판정의 정본은 기존 `shouldActivateBackgroundCard`(`lib/canonicalBackground.ts:341`)다. 새 판정 함수를 만들지 않는다 | D-002 · 기존 UT(`CanonicalBackgroundContent.render.test.ts:966`)가 이미 잠근다 | 설계자 | ACTIVE | — |
| D-008 | `BackgroundCard`는 훅을 부르지 않는다. 접근성 이름은 호출부가 번역해 `ariaLabel`로 넘긴다 | `useI18n`은 호출마다 `useTranslation`(구독 포함)이다(`shared/i18n/index.ts:41-44`) — 틀이 부르면 카드당 훅이 는다(D-005) | 설계자 | ACTIVE | — |
| D-009 | W2 범위는 현재 상태 문서의 표 깨짐 전수다 — `docs/IPC_CONTRACT.md` 1행 · `app/AGENTS.md` 1행 · `docs/handoff/INDEX.md` 6행. 0299 후보 행 자체(같은 결함)는 이 설계 커밋이 승격하며 고친다 | 같은 결함 계열(§8 W2) | 설계자 — D-001 범위 해석 | ACTIVE | — |
| D-010 | 과거 증거 문서(`docs/archive/` · 지난 handoff `plan.md`/`verify.md` · `docs/etc/` · `chats/` · `project/`)의 표는 고치지 않는다. `docs/handoff/AGENTS.md:130`은 handoff 지침이라 `handoff-review` Tier 2 경로로 따로 다룬다 | root `AGENTS.md` 원칙 1 "과거 문서를 현재 사양처럼 쓰지 마라" · `docs/handoff/AGENTS.md §카브아웃` | 설계자 | ACTIVE | — |
| D-011 | W2의 INDEX `0187`·`0183`·`0182`·`0181` 행처럼 셀 구분자로 덧붙인 둘째 비고 칸은 비고 칸 안의 `<br>`로 합친다. 글자는 바꾸지 않는다 | 머리 행보다 많은 칸은 렌더에서 버려진다(GFM) — 이스케이프로는 못 살린다 | 설계자 | ACTIVE | — |
| D-012 | W3 범위는 `sessionBusy` 계약의 잠기지 않은 소비처 전수와 `dispose`의 해제 2자리다 — 0308 후보 4자리 + 이번 재열거로 찾은 3자리(`useChatBusy` 선택자 · `useDirectoryPicker` 현재성 · `dispose` 세션 일치) | 후보 행 "소비처 3곳"은 0308이 `chatStore.ts`만 본 결과다(§8 W3) | 설계자 — D-001 범위 해석 | ACTIVE | — |
| D-013 | W3는 테스트만 더한다 — prod 코드 diff 0 | 정의는 이미 하나다(`chatStore.ts:2280`). 고칠 동작이 없다(D-003) | 설계자 | ACTIVE | — |
| D-014 | W1 특성 테스트(틀 마크업)는 틀 공용화보다 **앞 커밋**에 넣고, 공용화 커밋은 그 테스트를 바꾸지 않는다 | 변경 전 마크업에서 뜬 기준이어야 UI 회귀(D-004)를 판정한다 | 설계자 | ACTIVE | — |
| D-015 | W2 판정 장치 `scan/tables.mjs`는 이 설계 커밋에 포함한다(구현 산출 아님) | 0318 `scan/keyset.mjs` 선례 — 기준을 구현 전에 고정한다 | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-015 (첫 설계 턴).
- 변경된 결정: 없음. D-009·D-012는 후보 행보다 범위를 넓힌다 — 같은 결함을 재열거로 더 찾았기 때문이다. 사용자가 후보 행 그대로를 원하면 ΔV로 좁힌다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0** — D-001 ↔ AC1·AC9·AC12 · D-002 ↔ AC5 · D-003 ↔ AC4·AC10 · D-004 ↔ AC3·AC4·AC20 · D-005 ↔ AC6 · D-006 ↔ AC5·AC7·AC8 · D-007 ↔ AC5 · D-008 ↔ AC6 · D-009 ↔ AC9 · D-010 ↔ §10 선언 경계 W2-B1 · D-011 ↔ AC10 · D-012 ↔ AC12~AC16 · D-013 ↔ AC17 · D-014 ↔ AC18 · D-015 ↔ AC9·AC10.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | W1 — 구 카드만 `target === currentTarget`을 보지 않는다(`LegacySubAgentTile.tsx:244-249` ↔ `canonicalBackground.ts:346`). 시제작 테스트가 그 두 입력에서만 red(§8 P-3) |
| 이미 기존 코드가 충족하는가 | W1 판정 함수는 있다 — 구 카드가 안 쓸 뿐이다. W2·W3는 아니다 | §8 P-1 · T-1 · B-2 |
| 더 작은 해법 | W1 최소 수정(구 카드가 공용 판정만 import)은 prod +3줄이고 틀 사본 3벌이 남는다. 공용 틀은 시제작 실측 +63/−65이고 틀이 1벌이 된다 — D-002에 맞는 쪽을 고른다 | §8 P-7 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 0317 O-6·O-7 성립 · 0299 D4 성립(단 같은 결함이 현재 문서에 8행 더) · 0308 x3·x4·x5·l2 성립(단 소비처가 3곳 더) | §8 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 | 0313 D-009 "구 모델 표시는 전부 남긴다" — 표시는 그대로다 · 0204 D-016 카드 디자인 복구 — 마크업 동일(AC3) |

- 사용자에게 올릴 결정: 없음. D-006(공용 틀 — 카드당 표시 컴포넌트 경계 +1, 훅·DOM·클로저 동일)과 D-009·D-012(범위 확장)는 완료 보고에서 알린다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 구 타일 카드 자신에 초점 → Enter·Space | 카드가 연다(대화록 상세) | 변경 전과 같다 |
| 구 타일 카드 안 `백그라운드로 보내기`·`중단` 버튼에 초점 → Enter·Space | 카드는 열지 않고 키의 기본 동작을 막지 않는다 → 버튼이 눌린다 | **바뀜** — 전환·중단이 요청된다. 지금은 카드가 열리고 버튼 동작이 막힌다 |
| 세 카드 클릭 · 안쪽 버튼 클릭 | 카드 클릭은 그 항목을 열고, 버튼 클릭은 버튼 동작만 한다(`stopPropagation`) | 변경 전과 같다 |
| 정본 타일 카드(작업·호출)의 키 입력 | 같은 판정 | 변경 전과 같다 |
| 다른 키(Escape·Tab 등) | 아무 일 없음 | 변경 전과 같다 |
| 문서를 GitHub·마크다운 뷰어로 연다 | 표 행이 머리 행과 같은 칸 수로 나뉜다 | 잘리던 둘째 비고와 뒤 칸이 보인다 |
| W3 | 실행 동작 변경 없음 | 없음 — 잠금만 는다 |

### 상태와 전이

| 상태 | 진입 조건 | 사용자에게 보이는 것 | 다음 상태/복구 |
|---|---|---|---|
| 카드 안 버튼 초점 | Tab 이동 | 버튼 초점 링 | Enter·Space → 버튼 동작(중단 → `중단 중…`, 전환 → 전환 버튼 사라짐) |

### 파생 UX / 엣지케이스

- a11y: 카드는 계속 `role="button"`·`tabIndex=0`·같은 접근성 이름이다. 안쪽 버튼은 자기 이름(`중단`·`… 백그라운드로 보내기`)을 그대로 갖는다.
- `onOpen`이 없는 정본 작업 카드(테스트가 단독 렌더): 카드 자신의 Enter·Space는 기본 동작을 막고 아무것도 열지 않는다 — 변경 전과 같다(`CanonicalBackgroundContent.tsx:213-218`).
- theme·긴 텍스트·좁은 pane: 클래스 문자열이 같다(AC3) — 변경 없음.
- concurrency·loading·error·cancel: 해당 없음.

## 6. 범위 / 비범위

- **범위**: W1 — `BackgroundCard.tsx` 신설, 세 카드 호출부, 카탈로그 행, 테스트 2파일 · W2 — 문서 3개 8행 · W3 — 테스트 2파일(신설 1 · 기존 1에 추가).
- **비범위**: 과거 증거 문서의 표(D-010) · `docs/handoff/AGENTS.md:130`(D-010) · `TranscriptActionRow`·`ToolCard`의 키 판정(안쪽 대화형 요소 0 — §10 W1-B3) · `sessionBusy` 소비처 중 이미 잠긴 3곳(`chatStore.ts:1105·1195·1245`) · 문서 표 CI 가드 도입.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `docs/handoff/AGENTS.md:130` 표 깨짐 | 아니오 | 완료 보고에서 `handoff-review` Tier 2 메타 수정으로 제안 |
| 문서 표 CI 가드 | 아니오 | 완료 보고에서 제안 — 새 게이트는 사용자 결정이다 |

## 7. Requirements / Acceptance — `R ↔ AT`

`<구현 전>` = 이 설계 커밋(INDEX 대상 커밋 칸이 정본).

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 세 카드 모두 — 카드 자신이 받은 Enter·Space는 그 항목을 열고 기본 동작을 1회 막는다. 카드 안 요소에서 온 Enter·Space와 다른 키는 열지 않고 막지 않는다 | §10 EP-01 S4 — 실제 렌더에서 카드 노드의 키 처리기를 5입력 × 카드 3종으로 부른다 | 구 — `SubAgentTileContent` → `LegacySubAgentContent` → `SubAgentTaskList` → 카드 · 정본 — → `CanonicalBackgroundContent` → `BackgroundTaskCard`/`BackgroundCallCard` |
| R-01 | AT-01 / AC2 | 세 카드의 클릭이 각자의 항목을 연다 — 구: `selectSubagentTask(toolUseId)` · 작업: `selectBackgroundItem(s, {kind:'task', key})` · 호출: `{kind:'call', key}` | 같은 테스트 — 클릭 처리기 호출 후 인자 대조 | 같음 |
| R-02 | AT-02 / AC3 | 세 카드의 틀 마크업(속성 순서·접근성 이름·클래스·점·제목 행·첫 본문 행 시작)이 변경 전과 바이트 단위로 같다 | §10 EP-01 특성 테스트 — `<구현 전>` 다음 커밋에서 green, 이후 파일 무변경 | 같음 |
| R-02 | AT-02 / AC4 | 카드 본문(메타 행·전환/중단 버튼·오류 문구)이 변경 전과 같다 | 기존 렌더 스위트 — `subagentWiring` · `taskSurface0212` · `rightPanelTiles` · `BackgroundModelLabel` · `nonExecution`(구) · `CanonicalBackgroundContent.render`(정본) green, 파일 필터 없는 vitest 실패 집합 − 기준선 = ∅ | 같음 |
| R-03 | AT-03 / AC5 | 틀과 키 판정이 한 곳이다 — 틀 클래스 문자열이 `BackgroundCard.tsx`에만 있고 세 카드가 그 컴포넌트를 쓴다. renderer prod의 카드 키 판정은 `shouldActivateBackgroundCard` 하나다 | `gate:` `git grep -c 'group/subagent cursor-pointer' -- app/src/renderer ':!*.test.*'` → `BackgroundCard.tsx:1` 하나 · `git grep -n '<BackgroundCard' -- app/src/renderer ':!*.test.*'` → 3 · `git grep -n -E "key === 'Enter' \|\| [a-z]+\.key === ' '" -- app/src/renderer ':!*.test.*'` → `ToolCard`·`TranscriptActionRow`·`CascadeMenu`·`canonicalBackground` 4줄(구 카드 줄 없음) | — (저장소 형태) |
| R-03 | AT-03 / AC6 | 성능이 같거나 낫다 — 틀은 훅·상태·효과 0, DOM은 같고(AC3·AC4), 세 호출부와 틀을 합쳐 화살표 함수가 늘지 않으며, 정본 카드의 제목 식 평가가 렌더당 2→1 | `gate:` `grep -cE '\buse[A-Z][A-Za-z]*\(' BackgroundCard.tsx` → 0 · `git diff <구현 전>..HEAD -- <W1 prod 3파일>`의 `^\+.*=>` 줄 수 ≤ `^-.*=>` 줄 수 · 정본 파일의 제목 식 `task.description \|\| call?.toolName` 1회 · `backgroundCallTitle(call)` 1회 | — |
| R-03 | AT-03 / AC7 | 구조가 감량된다 — W1 prod 변경 = `BackgroundCard.tsx`(신규)·`CanonicalBackgroundContent.tsx`·`LegacySubAgentTile.tsx` 3개, 세 파일 합 추가 ≤ 삭제. 새 export는 `BackgroundCard` 하나, 기존 export 시그니처 불변 | `gate:` `git diff --numstat <구현 전>..HEAD -- app/src ':!*.test.*'`(W1 커밋) · `git diff <구현 전>..HEAD -- <3파일> \| grep -E '^[+-]export '` → `+export function BackgroundCard` 1줄 | — |
| R-03 | AT-03 / AC8 | 컴포넌트 카탈로그에 `BackgroundCard` 행이 생긴다 | `gate:` `grep -c 'rightpanel/BackgroundCard.tsx' docs/arch/frontend/design-components.md` → 1 · `node scripts/check-doc-inventory.mjs --check` 링크 ok | — |
| R-04 | AT-04 / AC9 | 범위 문서 3개의 모든 표 행이 머리 행과 같은 칸 수다 | `gate:node docs/handoff/0319-…/scan/tables.mjs docs/IPC_CONTRACT.md app/AGENTS.md docs/handoff/INDEX.md` → 파일마다 `broken 0 · unknown 0`, exit 0 | 마크다운 렌더 |
| R-04 | AT-04 / AC10 | W2 커밋이 바꾼 줄은 그 직전에 깨졌던 행뿐이고, 내용 변화는 `\|` 이스케이프와 셀 구분자 → `<br>`뿐이다 | 같은 gate `--base <W2 커밋>^ --head <W2 커밋>` → 파일마다 `broken 0 · unknown 0` · `preserve … changed N · broken at base N`(같은 N — IPC 1 · app/AGENTS 1 · INDEX 6), preserve 위반 0 | 같음 |
| R-04 | AT-04 / AC11 | 문서를 읽는 가드·테스트가 그대로 통과한다 | `gate:` `node scripts/check-doc-inventory.mjs --check` · `./node_modules/.bin/vitest run src/shared/ipc-documentation.test.ts src/main/app/handlers/git.test.ts src/shared/git-diff-schema.test.ts` · `node --test scripts/check-chat-resource-surface.test.mjs scripts/check-doc-inventory.test.mjs` | — |
| R-05 | AT-05 / AC12 | `startHandoff`는 `inflight`이거나 채널이 `ready`·`listening`이면 거부하고 보내지 않는다. 셋 다 아니면 연다 | §10 EP-02 S1 | 컴포저 핸드오프 버튼 → `chatActions.startHandoff` |
| R-05 | AT-05 / AC13 | 캐시가 있는 세션을 다시 열 때, 요청 시점의 캐시 엔트리가 점유(`inflight`·`ready`·`listening`)면 불러온 기록을 적용하지 않고 지연 갱신도 하지 않는다. 점유가 아니면 적용하고 갱신한다 | §10 EP-02 S2 | 사이드바 클릭 → `chatActions.loadSession` |
| R-05 | AT-05 / AC14 | 지연 갱신은 시작 전 또는 응답 도착 때 세션이 점유면 IPC를 부르지 않거나 결과를 버린다 | §10 EP-02 S3 | `loadSession` → rAF 2회 → `refresh()` |
| R-05 | AT-05 / AC15 | `useChatBusy`는 `inflight` 또는 채널 `ready`·`listening`이면 true, 아니면 false · 폴더 고르기는 고르는 동안 세션이 점유되면 결과를 적용하지 않는다 | §10 EP-02 S4·S5 | 컴포저·헤더·폴더 선택기 → `useChatBusy` / `useDirectoryPicker.pick` |
| R-05 | AT-05 / AC16 | `dispose(sessionId)`는 그 세션의 대기 중인 중단 확인 타이머만 해제한다. 다른 세션의 타이머는 남아 15초 뒤 `unconfirmed`를 낸다 | §10 EP-03 | 세션 정리 → `BackgroundController.dispose` |
| R-05 | AT-05 / AC17 | W3는 prod 코드를 바꾸지 않는다 | `gate:` `git diff --stat <구현 전>..HEAD -- app/src/renderer/src/features/chat/store/chatStore.ts app/src/renderer/src/features/chat/hooks/useDirectoryPicker.ts app/src/main/features/chat/background-controller.ts` → 0줄 | — |
| R-06 | AT-06 / AC18 | 작업별 커밋이 갈리고, 특성 테스트가 공용화보다 먼저다. 공용화 커밋은 특성 테스트를 바꾸지 않는다 | `gate:` `git log --name-only --reverse <구현 전>..HEAD` — 첫 구현 커밋 = 특성 테스트 파일만 · 그 뒤 커밋에서 그 파일 diff 0 · W2 커밋에 `app/src` 없음 · W3 커밋에 prod 파일 없음 | — |
| R-06 | AT-06 / AC19 | 마지막 gate가 기준선과 같다 | §19 — lint error 0 · typecheck 0 · 가드 4종 ok · 파일 필터 없는 vitest 실패 파일 집합 − 기준선 = ∅ · `node --test scripts/*.test.mjs` fail 0 | — |
| R-07 | AT-07 / AC20 | 사람이 보는 화면과 키보드 흐름 — 구 타일에서 Tab으로 카드 안 `중단`·`백그라운드로 보내기`에 초점 → Enter·Space → 버튼 동작, 카드 안 열림 · 카드 자신 Enter → 상세 · 세 카드 모양(white/dark)이 전과 같음 · GitHub에서 문서 3개 표 렌더 | 사람 실기 — `npm run dev`, 정본 상태가 없는 이전 세션과 새 세션의 백그라운드 타일 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: `CanonicalBackgroundContent.render.test.ts:966 'activates only the card itself, never a nested stop control keyboard event'`(판정 UT) · `subagentWiring.render.test.ts:94 '표식이 없으면 실행 중 라벨과 전환·중단 버튼이 뜬다 — 대조'` 외 렌더 스위트 — 케이스 존재를 `grep -n "it("`로 확인했다.
- 사람 실기: AC20 하나. 키 판정·클릭 배선·마크업 동일은 테스트로 내렸다(AC1~AC3). 남는 것은 브라우저의 버튼 기본 동작과 시각이다(§10 W1-B2).
- 음성 기준은 양성과 짝이다 — AC1의 "열지 않는다"는 같은 테스트의 "카드 자신 입력은 연다"와, AC12~AC15의 "거부"는 idle 대조 입력과 함께 단언한다.
- 구조 목표(AC7): 줄 수 절대값을 계약으로 두지 않는다. 시제작 실측 +63/−65(§8 P-7)라 "합 추가 ≤ 삭제"만 건다 — 틀 머리 주석은 3줄 안팎으로 둔다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 구현 V가 없다.
- 기준 V 상속 근거: 없음. MD-01(판정 함수)은 0231 계열 코드의 기존 UT를 회귀로 다시 닫는다.
- `SUPERSEDED`로 분해한 pair: 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 | R | §7 AC1·AC2 — 카드 키·클릭 열기 | NEW | — |
| R-02 | R | §7 AC3·AC4 — 카드 표시 불변 | NEW | — |
| R-03 | R | §7 AC5~AC8 — 틀 한 곳·성능·구조·카탈로그 | NEW | — |
| R-04 | R | §7 AC9~AC11 — 문서 표 | NEW | — |
| R-05 | R | §7 AC12~AC17 — 점유 가드·정리 잠금 | NEW | — |
| R-06 | R | §7 AC18·AC19 — 커밋·게이트 | NEW | — |
| R-07 | R | §7 AC20 — 사람 | NEW | — |
| AR-01 | AR | §9·§10 EP-01 — 세 호출부 → `BackgroundCard` props → DOM·처리기 | NEW | — |
| MD-01 | MD | `shouldActivateBackgroundCard` 판정 | INHERITED | `lib/canonicalBackground.ts:341-347` · UT `CanonicalBackgroundContent.render.test.ts:966` |
| MD-02 | MD | §10 EP-02 — `sessionBusy` 소비처 5곳 | NEW(잠금) | 코드는 기존, 잠금이 새로 생긴다 |
| MD-03 | MD | §10 EP-03 — `dispose`의 타이머 해제 | NEW(잠금) | 같음 |
| MD-04 | MD | §10 EP-04 — `scan/tables.mjs` 판정 | NEW | — |
| AT-01~AT-07 · IT-01 · UT-01~UT-04 | AT·IT·UT | 아래 pair | NEW(UT-01 INHERITED) | — |

`SD` 수준은 고르지 않았다 — 수명주기·상태 전이를 바꾸지 않는다(W1은 표시 틀, W3는 prod diff 0).

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | AR-01 ↔ IT-01 | REQUIRED | 호출부(구 `SubAgentTaskList` / 정본 `BackgroundTaskCard`·`BackgroundCallCard`) → `BackgroundCard` props → div 속성·`onClick`·`onKeyDown` → `shouldActivateBackgroundCard` → `onOpen` → store 선택 함수 | EP-01 표의 자리별 좌표 | required — 형제 카드끼리 props가 맞바뀌어도 대표 경로는 통과한다. 변이는 EP-01 표 | EP-01 (자리 4 · 운반 항 17) |
| VP-02 | R-01 ↔ AT-01 | REQUIRED | AC1·AC2 경로 | VP-01 좌표 S4(키·클릭 상호작용 테스트) | not selected — VP-01과 같은 좌표 | EP-01 |
| VP-03 | R-02 ↔ AT-02 | REQUIRED | AC3·AC4 경로 | 특성 테스트(EP-01 S1~S3 마크업) + 기존 렌더 스위트 | required — 특성 테스트가 변경 전 트리에서 green이었는지(D-014)가 방향 증거다. verify가 그 커밋으로 되돌려 다시 돌린다 | EP-01 |
| VP-04 | MD-01 ↔ UT-01 | REGRESSION | 판정 함수 | `CanonicalBackgroundContent.render.test.ts:966` | not selected — 함수 불변. 구 카드가 이 경로를 새로 지나므로 회귀로 다시 닫는다 | 0 — 함수 본문 diff 0 |
| VP-05 | R-03 ↔ AT-03 | REQUIRED | 저장소 형태 | `gate:` AC5~AC8 명령 | not selected — 명령 출력이 직접 관측이다 | 0 — 형태 계약 |
| VP-06 | R-04 ↔ AT-04 | REQUIRED | 문서 → 마크다운 표 | `gate:tables.mjs` · `--base` | VP-07이 장치의 민감도를 잠근다 | EP-04 (8행) |
| VP-07 | MD-04 ↔ UT-04 | REQUIRED | `tables.mjs` 판정 | EP-04 등록 변이 G1~G7 | required — 열린 입력 집합 검사기다(fail-closed 설계) | EP-04 |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | 소비처 5곳(EP-02) | EP-02 표의 자리별 좌표 | required — 형제 판정(`sessionResponding`·`sessionListening`)과 맞바꿔도 green이던 자리다 | EP-02 (5자리) |
| VP-09 | MD-03 ↔ UT-03 | REQUIRED | `stop` ACK → 타이머 등록 → `dispose` → 해제 | EP-03 표의 좌표 | required — 해제 누락은 관측 동작이 늦게 드러난다 | EP-03 (2자리) |
| VP-10 | R-05 ↔ AT-05 | REQUIRED | AC12~AC17 경로 | VP-08·VP-09 좌표 + AC17 gate | not selected — 같은 좌표 | EP-02·EP-03 |
| VP-11 | R-06 ↔ AT-06 | REQUIRED | 저장소 이력·게이트 | `gate:` AC18·AC19 명령 | not selected | 0 — 형태 계약 |
| VP-12 | R-07 ↔ AT-07 | REQUIRED | 실제 앱 | 사람 실기(AC20) | not selected | 0 — 사람 |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 변경 | §19 | 이번 변경이 만든 실패만 blocking — 기준선 분리는 두 조건(차집합 ∅ + 환경 원인) |
| 테스트 소스 규칙 | 테스트 4파일 추가·수정 | `node scripts/check-test-budgets.mjs` · unit 풀 가드(파일 필터 없는 vitest) | 추가·수정 파일의 위반은 기준선 아님 |
| 문서 가드 | `docs/**`·`app/AGENTS.md` 변경 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 링크·수치·표기 |
| message-bus | 커밋 | `git log -1 --format='%(trailers:only=true)'` — 구현 커밋 trailer | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

시제작은 scratchpad worktree 두 개(`HEAD` 사본 · 시제작 사본, `app/node_modules` 링크)에서 했다. 작업 트리 diff는 이 설계 산출물뿐이다.

### W1 — 카드 키 처리와 틀

| # | 대상 | 검색 / 실행 | N / 관측 | 의미 |
|---|---|---|---|---|
| P-1 | 카드 키 판정 | `git grep -n -E "key === 'Enter' \|\| [a-z]+\.key === ' '" -- app/src/renderer ':!*.test.*'` | 5줄 — `LegacySubAgentTile.tsx:245` · `ToolCard.tsx:140` · `TranscriptActionRow.tsx:29` · `canonicalBackground.ts:346`(판정 함수) · `CascadeMenu.tsx:310`(메뉴 항목) | 구 카드만 대상 검사 없이 키만 본다 |
| P-2 | 구 카드 안 대화형 요소 | `grep -n -E 'leadingIcon=\|e\.stopPropagation' LegacySubAgentTile.tsx` | 버튼 2(`:301` 전환 · `:322` 중단), 둘 다 `stopPropagation`(`:308`·`:327`). `Button`은 네이티브 `<button>`(`shared/ui/Button.tsx:110`), 키 처리기 없음 | 안쪽 버튼 keydown이 카드로 올라와 `preventDefault`가 버튼 기본 동작을 막는다 |
| P-3 | 결함 재현 | 시제작 상호작용 테스트(§10 EP-01 S4 형태)를 `HEAD`에 넣어 실행 | 12케이스 중 red 2 — 구 카드의 안쪽 Enter·안쪽 Space. 정본 두 카드 10케이스 green | 결함은 구 카드에만 있다 |
| P-4 | 틀 동일 | 시제작 특성 테스트(§10 EP-01 S1~S3 형태)를 `HEAD`에서 실행 | 2/2 green — 세 카드의 틀이 바이트 단위로 같다 | 0317 O-6 성립. 공용화 기준이 된다 |
| P-5 | 틀 자리 | `git grep -n 'group/subagent cursor-pointer' -- app/src/renderer ':!*.test.*'` | 3 — `LegacySubAgentTile.tsx:253` · `CanonicalBackgroundContent.tsx:223`·`:328` | 분모 3 |
| P-6 | 같은 형태의 다른 행 | `TranscriptActionRow` 호출부(`AgentTaskRow.tsx:91-105` · `SubagentNoticeRow.tsx:57-73`)의 자식에서 `<button\|<Button\|<a \|<input` 검색 · `ToolCard.tsx:134-174` 행 자식 | 0 · 0(span만) | 같은 결함이 없다 — 비범위(W1-B3) |
| P-7 | 공용화 시제작 | 세 호출부를 `BackgroundCard`로 옮기고 prettier | 기존 2파일 +20/−65 · 신규 43줄 → 합 +63/−65 · eslint 0 · `typecheck:web` prod 오류 0 | 순감 2줄, 틀 사본 3 → 1 |
| P-8 | 시제작 oracle 민감도 | §10 EP-01 등록 변이 14종을 `mutate.py`로 | 14/14 red · 시제작 트리 rightpanel 두 디렉터리 43파일 399케이스 green | 좌표가 자리를 잠근다 |
| P-9 | 훅 비용 | `shared/i18n/index.ts:41-44` | `useI18n()` = 호출마다 `useTranslation()` | 틀이 부르면 카드당 훅이 는다 → D-008 |
| P-10 | SSR 상태 시드 | `CanonicalBackgroundContent.render.test.ts:44-65` `renderState` | `getInitialState()` 객체를 바꿔 렌더하고 되돌린다 | zustand SSR은 서버 스냅샷(초기 상태)을 읽는다 — W1·W3 렌더 테스트가 같은 방식을 쓴다 |
| P-11 | 처리기 캡처 선례 | `ForegroundShellActions.interaction.test.ts:44-67` | `react/jsx-runtime`·`jsx-dev-runtime`을 감싸 렌더 중 props를 기록하고 처리기를 직접 부른다 | 구조와 무관하게 `role="button"` 노드를 찾는다 — 공용화 전후 같은 테스트가 돈다 |
| P-12 | 카탈로그 규칙 | `design-components.md:11` · renderer `AGENTS.md` 제작 계약 6 | "신설·이동·삭제 시 같은 변경에서 해당 경로 행을 갱신" | AC8 |

### W2 — 문서 표

| # | 대상 | 검색 / 실행 | N / 관측 | 의미 |
|---|---|---|---|---|
| T-1 | 범위 문서 | `node docs/handoff/0319-…/scan/tables.mjs docs/IPC_CONTRACT.md app/AGENTS.md docs/handoff/INDEX.md` (`HEAD`) | IPC 표 32·행 156·깨짐 1(`:263` 5→7) · app/AGENTS 5·27·1(`:167` 3→5) · INDEX 2·123·7(`0187`·`0183`·`0182`·`0181`·`0161`·`0104` 행 + 0299 후보 행) | 분모 9 — 그중 0299 후보 행은 이 설계 커밋이 고친다 → 구현 분모 8 |
| T-2 | 깨짐 원인 | 행별 칸 분해 | 코드 조각 안 `\|` 미이스케이프 — IPC ×2 · app/AGENTS ×2 · INDEX `0187` ×1·`0181` ×6·`0104` ×2·후보 ×1 / 코드 조각 사이 `\|` — `0161` ×1 / 덧붙인 둘째 비고 칸 — `0187`·`0183`·`0182`·`0181` | 앞 둘은 이스케이프, 셋째는 `<br>` 병합(D-011) |
| T-3 | 저장소 전체 | 같은 판정을 추적 `.md` 821개(`docs/spec/`·`chats/`·`project/` 제외)에 | 깨진 행 259 · 105파일. 현재 상태 문서 10행(위 3개 9행 + `docs/handoff/AGENTS.md:130`) · 나머지 249행 | 249행은 과거 증거 문서(D-010) |
| T-4 | 표기 관례 | `grep -c -F` 로 역슬래시+파이프 줄 수(`docs/IPC_CONTRACT.md`) | 25 — 예 `:41` `string \| null` · `:67` `'ok'\|'warning'` | 이스케이프가 이 문서의 관례다 |
| T-5 | 문서를 읽는 코드 | `git grep -n IPC_CONTRACT -- app/src app/scripts` | 4파일 — `ipc-documentation.test.ts`(`- 도메인:` 줄) · `git.test.ts`(§2.6-b 절) · `git-diff-schema.test.ts` · `check-chat-resource-surface.test.mjs`(금지 표현 정규식) | 263행 칸을 파싱하는 코드 0 |
| T-6 | 장치 민감도 | 고친 사본 `--base HEAD` / 변이 G1~G7 | exit 0 · `preserve changed 1/1/7` / 7종 모두 red(§10 EP-04) | AC9·AC10 장치 |
| T-7 | 머리 없는 표 | 범위 3파일에서 `^\s*:?-{3,}`(구분 행이 `\|`로 시작하지 않음) | 0 | 장치의 표 인식 범위 밖 형태가 범위에 없다 |

### W3 — 점유 가드와 정리

| # | 대상 | 검색 / 실행 | N / 관측 | 의미 |
|---|---|---|---|---|
| B-1 | `sessionBusy` 소비처 | `git grep -n -E 'sessionBusy\(\|useChatSession\(sessionBusy\)' -- app/src/renderer ':!*.test.*'` | 8줄 = 소비처 7 + 정의 1 — `useDirectoryPicker.ts:47` · `chatStore.ts:1105·1195·1245·1614·1718·1754·2270` · 정의 `:2280` | 분모 후보 7 |
| B-2 | 잠금 상태 | 소비처마다 `sessionBusy(x)` → `x.inflight` / → `sessionResponding(x)`(+ 47행은 가드 제거), 오라클 `vitest run src/renderer/src/features/chat src/renderer/src/app src/renderer/src/pages`(기준 실패 5) | `1105`·`1195`·`1245` 6 failed(잡음) · `1614`·`1718`·`1754`·`2270`·`useDirectoryPicker:47` 5 failed(못 잡음) | 잠기지 않은 5자리 = 분모 |
| B-3 | `dispose` | `git grep -n -E 'clearTimeout\|stopTimers' -- app/src/main/features/chat/background-controller.ts` | `dispose` 구간 `:212-215`. 변이 `clearTimeout` 제거(l2) · 세션 일치 조건 제거(l3) → `src/main/features/chat` 335케이스 green | 0308 l2 성립 + l3 추가 |
| B-4 | 시제작 oracle | W3 시제작 테스트(§10 EP-02·EP-03 형태)를 `HEAD`에서 · 등록 변이 | 19케이스 green(S1~S4 14 · S5 4 · `dispose` 1). 변이 — `inflight`·`sessionResponding`·가드 제거·l2·l3 15/15 red · `stopTimers.delete` 제거 green · `→ sessionListening` S1~S3 green, S4 red | S1~S3 시제작에 ① 입력이 없다 — 구현자가 더한다(EP-02). `stopTimers.delete`는 관측 동작이 없다(W3-B1) |
| B-5 | 채널 값 | `shared/ipc.ts:1690` | `transport: 'idle' \| 'ready' \| 'listening'` | 점유 = `inflight` ∨ `transport ≠ idle` — `sessionResponding`과는 `ready`에서만 갈린다 |
| B-6 | 하네스 | `chatStore.testHarness.ts:39-91` `installChatStoreHarness(overrides)` · 선례 `chatStore.sessionDirectory.test.ts:65` | `activity: { …transport: 'ready' }` 시드 | 새 하네스가 필요 없다 |

### 수치 / 전칭 표현 검산

- 기준선: 파일 필터 없는 vitest on `HEAD` → 실패 68파일 · 320케이스(전부 better-sqlite3·Electron 로드 — `app/AGENTS.md` 환경 서명). 0318 verify의 기준선 기록과 같다.
- 시제작 트리 전체 실행: 실패 파일 집합 = 기준선(차집합 ∅) · 통과 +28(시제작 테스트 수와 같음). `check-test-budgets` ok · `test-pools.test.mjs` 52/52 · `check-doc-inventory --check` ok · `check-product-naming` ok.
- 내역 합: W2 구현 분모 8 = 1 + 1 + 6 · W1 운반 항 17 = 4(구) + 5(작업) + 5(호출) + 3(틀 속성 묶음 — role·tabIndex·class / 키·클릭 / data 전개). W3 분모 7 = EP-02 5 + EP-03 2.
- "유일한" 반례 검색: P-1·P-5·B-1의 전수 grep.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- W1: 세 카드가 같은 틀을 각자 쓴다. 정본 두 카드는 `shouldActivateBackgroundCard`를 부르고, 구 카드는 키만 본다. 정본 카드는 제목 식을 접근성 이름과 제목에 두 번 쓴다.
- W2: 문서 3개의 표 9행이 렌더에서 칸이 밀린다.
- W3: 가드 5곳·해제 2자리의 동작은 맞지만 테스트가 지나지 않는다.

```text
구    : SubAgentTaskList → <div role=button onKeyDown={key만}> 점·제목 + 본문
정본  : BackgroundTaskCard / BackgroundCallCard → <div role=button onKeyDown={shouldActivate…}> 점·제목 + 본문
```

### TO-BE

- W1: `BackgroundCard({ title, ariaLabel, onOpen?, children, ...data-* })`가 틀을 그린다. 세 호출부는 본문만 children으로 넘긴다. 키 판정은 `shouldActivateBackgroundCard` 하나다. 정본 카드는 `const title = …` 한 번 계산한다.
- W2: 이스케이프와 `<br>` 병합. 다른 줄은 그대로다.
- W3: 테스트 2파일. prod는 그대로다.

```text
구·정본 → <BackgroundCard title ariaLabel onOpen data-*>본문</BackgroundCard>
           → <div role=button tabIndex=0 onClick=onOpen onKeyDown={shouldActivate… → preventDefault → onOpen?.()} aria-label class {...data}> 점·제목 + children
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 틀 3벌 — 각 카드 | 틀 1벌 — `BackgroundCard`(공통 우측 패널) | D-006 | AR-01 · VP-01 · AC5 |
| control flow (키) | 구 카드는 키만 본다 | 세 카드가 같은 판정 | 결함 수정 | VP-02 · AC1 |
| data flow | 정본 제목 식 2회 | 1회(지역 상수) | 되풀이 제거 | AC6 |
| state/contract | — | 새 export `BackgroundCard` 1개. 기존 export·props 불변 | D-003 | AC7 |
| error/lifecycle | 변경 없음 | 변경 없음 | — | — |
| 문서 | 표 9행 깨짐 | 0 | W2 | VP-06 · AC9·AC10 |
| test seam | 판정 UT만 | 특성 테스트 · 상호작용 테스트 · 점유 가드 테스트 · `dispose` 테스트 | 잠금 | §11 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 호출 |
|---|---|---|---|
| `harnesses/common/rightpanel/BackgroundCard.tsx` | 카드 틀 · 키/클릭 열기 계약 | `{title, ariaLabel, onOpen?, children, data-*}` → div | 정본 두 카드 · 구 카드 |
| `lib/canonicalBackground.ts` `shouldActivateBackgroundCard` | 키 판정 | `{key, target, currentTarget}` → boolean | `BackgroundCard` |
| `harnesses/claude/rightpanel/*` | 카드 본문(메타·버튼·오류) | store 상태 → children | 오른쪽 패널 타일 |

## 10. 계약 / 타입 / 강제 지점

| V pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|
| VP-01·02·03 / EP-01 | 세 카드가 한 틀로 같은 마크업을 내고, 카드 자신이 받은 키·클릭만 그 항목을 연다 | `BackgroundCard` + `shouldActivateBackgroundCard` | S1 구 호출부 · S2 정본 작업 호출부 · S3 정본 호출 호출부 · S4 틀 — 아래 표 | 구현 뒤 `git grep -n '<BackgroundCard' -- app/src/renderer ':!*.test.*'` → 3 + `git grep -n 'group/subagent cursor-pointer' -- app/src/renderer ':!*.test.*'` → 1. 변경 전 대응은 P-5 | 안쪽 버튼이 키보드로 안 눌린다 · 카드가 다른 항목을 연다 · 모양이 바뀐다 |
| VP-08·10 / EP-02 | `sessionBusy` 소비처가 `inflight` ∨ 채널 `ready`·`listening`을 점유로 본다 | `chatStore.ts:2280` | 5자리 — 아래 표 | B-1 명령에서 잡음 자리(1105·1195·1245)를 뺀 목록 | 점유 중에 핸드오프가 열리거나, 늦은 기록·갱신이 실행 중 세션을 덮거나, 버튼이 점유를 놓친다 |
| VP-09·10 / EP-03 | `dispose(s)`가 s의 대기 타이머만 해제한다 | `background-controller.ts:210-217` | 2자리 — 아래 표 | B-3 명령의 `dispose` 구간 | 정리한 세션의 타이머가 남아 상태를 다시 읽거나, 다른 세션의 `unconfirmed`가 사라진다 |
| VP-06·07 / EP-04 | 범위 문서 표의 칸 수가 머리 행과 같고 내용이 보존된다 | `scan/tables.mjs` | 8행 — `IPC_CONTRACT.md:263` · `app/AGENTS.md:167` · INDEX `0187`·`0183`·`0182`·`0181`·`0161`·`0104` 행(설계 커밋 기준 `:110`·`:111`·`:112`·`:113`·`:124`·`:130`) | `node …/scan/tables.mjs --base <구현 전> --head <구현 전> docs/IPC_CONTRACT.md app/AGENTS.md docs/handoff/INDEX.md` → `broken` 목록 8 | 표 뒤 칸이 잘린 채 남는다 · 이스케이프하며 글자를 잃는다 |

### EP-01 — 자리 · 규칙 분기 · oracle

키 규칙(분기 5): ① 카드 자신 + Enter → 열기·막기 ② 카드 자신 + Space → 열기·막기 ③ 안쪽 요소 + Enter → 아무것도 안 함 ④ 안쪽 요소 + Space → 아무것도 안 함 ⑤ 카드 자신 + 다른 키 → 아무것도 안 함. `onOpen` 없음 분기 ⑥: 카드 자신 + Enter → 막기만 한다.
정본 작업 제목 규칙(분기 4): `description` → `call.toolName` → `taskType` → `taskId` 순으로 처음 참인 값.

| 자리 | 운반 항 | oracle 좌표 | 구별 입력 | 등록 변이 |
|---|---|---|---|---|
| S1 구 호출부 (`LegacySubAgentTile.tsx` 카드) | `title`=`task.description` · `ariaLabel` · `onOpen`=`open`(→ `selectSubagentTask(toolUseId)`) · `key` | 특성 — 신규 `harnesses/common/rightpanel/backgroundCardFrame.render.test.ts`(`SubAgentTaskList` 렌더 → 틀 접두 문자열 포함) · 상호작용 — 신규 `…/backgroundCard.interaction.test.ts`(구 카드 키 5분기 · 클릭) | 실행 중 작업 1건(전환·중단 버튼이 그려지는 입력), 제목 = 접근성 이름 문구와 다른 값 | L1 `onOpen` 제거 · L2 `title` 빈 값 |
| S2 정본 작업 호출부 (`BackgroundTaskCard`) | `title`(제목 규칙 4분기) · `ariaLabel` · `onOpen` · `data-background-task` · `data-background-generation` | 특성(제목 4분기마다 제목과 접근성 이름이 같은 값) · 상호작용(키 5분기 · 클릭 · `onOpen` 없는 단독 렌더 ⑥) | `taskId`·`generation`이 서로·호출 카드 값과 다른 문자열 · 제목 분기마다 앞 값을 비운 입력 | C1 제목 → `task.taskId` 고정 · C3 `data-background-task` → `data-background-call` · C4 `onOpen` 제거 |
| S3 정본 호출 호출부 (`BackgroundCallCard`) | `title`=`backgroundCallTitle(call)` · `ariaLabel` · `onOpen` · `data-background-call` · `data-background-generation` | 특성 · 상호작용(키 5분기 · 클릭) | 호출만 있는 작업 없음 입력(`command` 있음), `toolUseId` ≠ `generation` | C2 `data-background-call` → `call.generation` · C5 `onOpen` 제거 |
| S4 틀 (`BackgroundCard.tsx`) | `role`·`tabIndex`·`className`·점·제목 span · `onClick` · `onKeyDown`(판정 → `preventDefault` → `onOpen?.()`) · `aria-label` · `{...data}` · children | 특성(세 카드) · 상호작용(세 카드 × 키 5분기 + ⑥ · 클릭) | 위 세 자리 입력 | F1 `{...data}` 제거 · F2 `aria-label={title}` · F3 판정 → 키만 보는 식 · F4 `preventDefault` 제거 · F5 `onOpen?.()` 제거 · F6 `onClick` 제거 · F7 제목 span ↔ `ariaLabel` 맞바꿈 |

- 상호작용 테스트는 `react/jsx-runtime`·`jsx-dev-runtime`을 감싸 렌더 중 props를 기록하고 `role === 'button'` 노드의 처리기를 부른다(P-11). 처리기를 mock하지 않는다 — 실행 구간은 호출부부터 store 선택 함수까지다. 정본 선택 함수만 `vi.mock`으로 기록한다(구현 대신 인자를 관측).
- 특성 테스트는 틀 접두(`<div role="button" … class="…"[data-*]><div class="flex …"><span …></span><span …>제목</span></div><div class="mt-g1 pl-5 text-footnote`)를 문자열로 단언한다. 시간에 따라 바뀌는 본문(경과·시각)은 접두 밖이다.
- 시제작의 두 테스트(P-3·P-4·P-8)가 이 형태로 돈다. 구현자는 제목 4분기와 ⑥ 입력을 더한다.

### EP-02 — 자리 · 규칙 분기 · oracle

규칙(분기 4): 점유 = ① `inflight` ② `transport='ready'` ③ `transport='listening'` / 비점유 = ④ `inflight=false` ∧ `transport='idle'`. 자리마다 ①②③④ 입력을 둔다 — ②는 `sessionResponding`, ①은 `sessionListening`, ②③은 `inflight` 맞바꿈을 가른다.

| 자리 | 운반 값 | oracle 좌표 | 구별 입력 | 등록 변이 |
|---|---|---|---|---|
| S1 `startHandoff` 가드 (`chatStore.ts:1614`) | 점유 → 거부 | 신규 `store/chatStore.busyGuards.test.ts` — `chatActions.startHandoff()` 반환·`chat.send` 호출 | 확정 세션 · 사용자 턴 2 · `backend: 'claude'` × ①~④ | `→ src.inflight` · `→ sessionResponding(src)` · `→ sessionListening(src)` |
| S2 캐시 재진입 가드 (`:1718`) | 요청 시점 엔트리 점유 → 적용 안 함 | 같은 파일 — `loadSession` 뒤 `messages`·`refresh` 호출 수 | 캐시 엔트리 ①~④, 활성 키는 다른 세션 | 위 셋 + 가드 제거 |
| S3 현재성 판정 `current()` (`:1754`) — 두 시점 | 갱신 전·응답 뒤 점유 → 부르지 않음·버림 | 같은 파일 — 시작 전 시점: rAF 2회 뒤 `refresh` 호출 0 / 응답 뒤 시점: 대기 중 점유 → `updated` 결과 미적용 | idle로 연 뒤 각 시점에 ①~③ 전환 + ④ 대조 | 위 셋 |
| S4 `useChatBusy` (`:2270`) | 선택자 값 | 같은 파일 — SSR 탐침 컴포넌트, 초기 상태 시드(P-10) | ①~④ | `→ (s) => s.inflight` · `→ sessionResponding` · `→ sessionListening` |
| S5 폴더 선택 현재성 (`useDirectoryPicker.ts:47`) | 고르는 동안 점유 → 적용 안 함 | 신규 `hooks/useDirectoryPicker.busy.test.ts` — SSR 탐침으로 `pick`을 얻고 `window.oo.files.pickDirectory`를 대기시킨 뒤 점유 전환 → `chatActions.addSessionDirectory` 호출 수 | 확정 세션 `allowExisting=true` × 고르는 동안 ①~④ | `→ !session.inflight` · `→ sessionResponding` · `→ sessionListening` · 가드 제거 |

- S5 파일은 store를 교체하지 않는다 — `getState()`가 초기 상태 객체와 같아야 SSR 탐침(서버 스냅샷)과 `current()`(현재 상태)가 같은 세션을 본다(P-10). 그래서 S1~S4 파일과 나눈다.
- 시제작(B-4)은 S1~S5를 이 형태로 돌렸다. S1~S3에는 ① 입력이 없어 `→ sessionListening` 3종이 green이었다 — 구현자는 S1~S3에 ① 입력을 더한다.

### EP-03 — 자리 · 규칙 분기 · oracle

규칙(분기 2): 키의 세션이 `dispose` 인자와 같으면 해제 · 다르면 남김.

| 자리 | 운반 값 | oracle 좌표 | 구별 입력 | 등록 변이 |
|---|---|---|---|---|
| S1 해제 (`background-controller.ts:214` `clearTimeout`) | 타이머 | 기존 `background-controller.test.ts`에 추가 — 가짜 시계, 두 세션 ACK 뒤 `dispose('s')` → `vi.getTimerCount()` 2→1 | 세션 `s`·`t` | l2 `clearTimeout` 제거 |
| S2 세션 일치 (`:213`) | 해제 대상 | 같은 테스트 — 15초 진행 뒤 `t`는 `unconfirmed`, `s`는 `acknowledged` | 같음 | l3 조건 제거 |

### EP-04 — 장치 민감도 (`scan/tables.mjs`, 이 턴에 관측)

| # | 변이 | 종류 | 이 턴 관측 |
|---|---|---|---|
| G1 | 범위 행 하나를 안 고친다 | 제거 | `broken 1` · exit 1 |
| G2 | 깨진 행에서 글자를 지운다 | 다른 값 | `preserve … content changed beyond escaping` |
| G3 | 줄을 하나 더한다 | 다른 값 | `preserve … line count` |
| G4 | 표 뒤에 `\|`로 시작하지 않는 파이프 줄 | 모르는 형태 | `unknown … pipe line continues a table` |
| G5 | 구분 행 칸 수가 머리와 다르다 | 모르는 형태 | `unknown … delimiter cell count` |
| G6 | 인용 안의 표 | 모르는 형태 | `unknown … table inside blockquote` |
| G7 | 역슬래시 두 개 + 파이프 — 산문 줄 · 표 본문 행 각각 | 모르는 형태 | 두 자리 모두 `unknown … escaped backslash`. 처음 판은 본문 행을 건너뛰었다 — 이 턴에 고쳐 다시 관측했다 |

### 선언 경계 · 그 밖

- **W1-B1**: 특성 테스트는 틀 접두만 본다. 본문 마크업은 기존 렌더 스위트가 잡고, 본문 코드는 children으로 그대로 옮긴다(P-7 diff — 틀 줄만 빠진다).
- **W1-B2**: 브라우저가 초점 버튼에서 막히지 않은 Enter·Space를 클릭으로 바꾸는 기본 동작은 node 환경에서 관측하지 못한다 — 테스트는 "카드가 열지 않고 `preventDefault`를 부르지 않는다"까지 보고, 나머지는 AC20이다.
- **W1-B3**: `TranscriptActionRow`·`ToolCard`의 키 판정은 대상 검사가 없지만 안쪽 대화형 요소가 0이다(P-6) — 결함이 아니다.
- **W1-B4**: `backgroundCallTitle`의 안쪽 분기(`description`·`prompt`·`command`·`toolName`)는 lib 계약이고 바뀌지 않는다. S3은 입력 1개(`command`)로 운반만 본다.
- **W2-B1**: 과거 증거 문서의 깨진 표 249행과 `docs/handoff/AGENTS.md:130`(D-010) — 장치를 그 파일에 돌리지 않는다.
- **W2-B2**: 장치는 머리 행이 `|`로 시작하는 표만 표로 읽는다 — 범위 3파일에 다른 형태 0(T-7). 모르는 형태는 red다(fail-closed).
- **W3-B1**: `dispose`의 `this.stopTimers.delete(key)` 제거는 관측 동작이 없다 — 타이머는 이미 해제됐고 지도는 private이다(B-4 `동치`).
- **W3-B2**: 타이머 콜백의 `!this.disposed.has(…)`(`:139`)는 `observe`의 같은 검사(`:78`)와 겹친다 — 해제가 없어도 상태가 바뀌지 않는다. 분모 밖.
- 열린 입력 집합 판정 산출물: `tables.mjs` — 모르는 형태 red(fail-closed). 그 밖 산출물 해당 없음.
- 같은 규칙의 SSOT: 키 판정 `shouldActivateBackgroundCard` · 점유 `sessionBusy` · 틀 `BackgroundCard`. 복붙 판정 0.
- 선택적 필드: `onOpen?` — 없으면 막기만 하고 열지 않는다(⑥). `data-*`는 문자열만 받는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/harnesses/common/rightpanel/BackgroundCard.tsx` (신규) | 카드 틀 | props `{title: string; ariaLabel: string; onOpen?: () => void; children: ReactNode; [data: \`data-${string}\`]: string}`. 훅 0. 머리 주석 3줄 안팎 — role=button인 이유와 키 계약 | 특성 · 상호작용 |
| `…/claude/rightpanel/CanonicalBackgroundContent.tsx` | 정본 두 카드 | 틀 줄을 `<BackgroundCard …>`로, `const title = …` 1회. `shouldActivateBackgroundCard` import 제거 | 기존 render 테스트 |
| `…/claude/rightpanel/LegacySubAgentTile.tsx` | 구 카드 | 틀 줄(주석 2줄 포함)을 `<BackgroundCard key … onOpen={open}>`로 | 기존 렌더 스위트 |
| `…/common/rightpanel/backgroundCardFrame.render.test.ts` (신규, **첫 커밋**) | EP-01 특성 | 세 카드 렌더 → 틀 접두 포함. 정본 작업은 제목 4분기 | — |
| `…/common/rightpanel/backgroundCard.interaction.test.ts` (신규) | EP-01 상호작용 | 키 5분기 × 세 카드 · ⑥ · 클릭 | — |
| `docs/arch/frontend/design-components.md` | 카탈로그 | `## 공유 우측 패널·타일·뷰어`에 `BackgroundCard` 행(`BackgroundModelLabel` 앞) | — |
| `docs/IPC_CONTRACT.md` · `app/AGENTS.md` · `docs/handoff/INDEX.md` | W2 | T-2 원인별 이스케이프 · `<br>` 병합 | `gate:tables.mjs` |
| `…/features/chat/store/chatStore.busyGuards.test.ts` (신규) | EP-02 S1~S4 | §10 표 | — |
| `…/features/chat/hooks/useDirectoryPicker.busy.test.ts` (신규) | EP-02 S5 | §10 표 — store를 교체하지 않는 별도 파일 | — |
| `app/src/main/features/chat/background-controller.test.ts` | EP-03 | 케이스 1 추가 | — |
| `docs/handoff/0319-…/scan/tables.mjs` | VP-06 gate | 이 설계 커밋에 포함(D-015) | G1~G7 |

커밋 순서(D-014·AC18): ① W1 특성 테스트만 → ② W1 틀·호출부·상호작용 테스트·카탈로그 → ③ W2 문서 → ④ W3 테스트 → ⑤ `[구현자 기입]`·INDEX. 구현 커밋 trailer는 `Agent: claude` · `Status: implemented` · `Criteria-Met` · `Verified-By: pending`.

### 테스트 가능성

- electron/DB 의존: 없음. 렌더 테스트는 SSR, store 테스트는 기존 하네스, controller 테스트는 가짜 시계다.
- 테스트 소스 규칙: 시간 값은 가짜 시계 진행(`advanceTimersByTimeAsync(15_000)` — 같은 파일 선례 `:87`·`:243`)만 쓴다. 자식 프로세스·git·SQLite 0(unit 풀). `vi.waitFor` 옵션에 `scaleMs`를 쓰지 않는다. 시제작 트리에서 `check-test-budgets` ok · `test-pools.test.mjs` 52/52.

## 12. End-to-end 영향

```text
store 선택 함수 ← onOpen ← BackgroundCard ← 세 호출부 : 인자 불변(AC2)
마크다운 렌더 ← 문서 표                                : 칸 수만 바뀐다
sessionBusy·dispose                                     : 코드 불변, 테스트만 는다
```

- 부팅/등록/초기화 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 생성/시작·종료·취소: 변경 없음. 카드 처리기는 렌더마다 만들어진다(변경 전과 같은 수).
- 다중 저장소 쓰기: 코드 — 해당 없음. 문서 — 판정 사본이 `plan.md` `[구현자 기입]`·`verify.md`·`INDEX.md`에 산다. 수치는 plan/verify가 갖고 INDEX 비고는 요약만 둔다.

## 14. 성능 / 상한 / 최적화

| 항목 | 변경 전 (카드 1장 · 렌더 1회) | 변경 후 | 판정 |
|---|---|---|---|
| 훅 호출 | 구 0(목록이 1회) · 정본 각 카드의 기존 훅 | 같음(틀 0) | 같음 |
| DOM 노드 | 틀 4 + 본문 | 같음(AC3) | 같음 |
| 클로저 | 키 처리기 1 + 구 `open` 1 · 정본 목록의 `onOpen` 1 | 키 처리기는 틀로 옮겨 1 · 나머지 같음 | 같음 |
| 제목 계산 | 정본 작업 식 2 · `backgroundCallTitle` 2 | 각 1 | 나음 |
| 키 판정 | 구 — 키 비교 2 | 대상 비교 1 + 키 비교 ≤ 2 | 같음(비교 1회) |
| 컴포넌트 경계 | — | 카드당 표시 컴포넌트 1(훅·상태·효과 0) | 늘어남 — 제목 계산 감소와 상쇄. D-006 근거(0149 선례) |

- 새 출력·새 요청: 없음.
- 구조적 목표: W1 prod 합 +63/−65(시제작 실측). 계약은 "추가 ≤ 삭제"(AC7).

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — IPC 계약 문서는 표기만 고치고 채널·타입 의미는 그대로다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 구 모델 표시는 전부 남긴다 | 0313 D-009 | §5 — 표시 그대로, 틀만 공유 | 유지 |
| 백그라운드 카드는 `72766d2`의 디자인을 복구한다 | 0204 D-016 | AC3 — 마크업 동일 | 유지 |
| 공통은 구체 하네스를 import하지 않는다 | renderer `AGENTS.md` 4-layer | §11 — `BackgroundCard`는 `lib`만 import | 유지 |
| 자체 hover는 `group/<이름>` | renderer `AGENTS.md` 그룹 스코프 | 틀이 `group/subagent` 리터럴을 갖고 본문이 `group-hover/subagent:` 리터럴을 갖는다 | 유지 |
| 컴포넌트 신설 시 카탈로그 행 | renderer `AGENTS.md` 제작 계약 6 | AC8 | 유지 |
| 테스트는 실제 홈·호스트를 보지 않는다 · 풀 분류 | `app/AGENTS.md` | §11 테스트 소스 규칙 | 유지 |
| 과거 문서는 증거 | root `AGENTS.md` 원칙 1 | D-010 | 유지 |
| handoff 지침 수정은 review Tier | `docs/handoff/AGENTS.md §카브아웃` | D-010 | 유지(범위 밖) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 공용 틀이 모양을 바꾼다 | 특성 테스트를 변경 전 커밋에 고정(D-014) + 기존 렌더 스위트 + AC20 |
| 카드당 컴포넌트 경계 +1을 성능 저하로 본다 | §14 — 훅·DOM·클로저 같음, 제목 계산 감소. 사용자가 반대하면 최소 수정안(공용 판정 import, prod +3줄)으로 ΔV |
| jsx 캡처 테스트가 React 런타임 내부에 기댄다 | 선례(P-11)가 같은 저장소에서 돈다. 깨지면 `Capture` 트리 순회로 바꾸고 `설계 대비 명시적 차이`에 적는다 |
| W2 `<br>` 병합이 비고를 길게 만든다 | 글자 변화 0(AC10). 상한 규칙은 이번 턴에 새로 쓰는 문장에만 걸린다 |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/harnesses/common/rightpanel/{BackgroundCard.tsx, backgroundCardFrame.render.test.ts, backgroundCard.interaction.test.ts}`
- `app/src/renderer/src/features/chat/harnesses/claude/rightpanel/{CanonicalBackgroundContent.tsx, LegacySubAgentTile.tsx}`
- `app/src/renderer/src/features/chat/store/chatStore.busyGuards.test.ts` · `app/src/renderer/src/features/chat/hooks/useDirectoryPicker.busy.test.ts` · `app/src/main/features/chat/background-controller.test.ts`
- `docs/arch/frontend/design-components.md` · `docs/IPC_CONTRACT.md` · `app/AGENTS.md` · `docs/handoff/INDEX.md`
- `docs/handoff/0319-background-card-doc-tables-busy-locks/{plan.md, scan/tables.mjs}`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · renderer `AGENTS.md §테스트`.
- 환경: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. 이 턴의 환경은 네트워크가 열려 Electron ABI 재빌드까지 됐다 — 그래서 DB 로드 스위트는 node에서 실패한다(기준선 68파일).
- 구현 전 기준선: 같은 명령으로 변경 전 실패 파일 집합을 먼저 뜬다(이 턴 실측 68파일 · 320케이스).
- 수정 루프: `npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run src/renderer/src/features/chat/harnesses src/renderer/src/features/chat/store src/renderer/src/features/chat/hooks src/main/features/chat`.
- IMPL_DONE 전 마지막 gate(`app/`에서): `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` · (저장소 루트에서) `node docs/handoff/0319-…/scan/tables.mjs docs/IPC_CONTRACT.md app/AGENTS.md docs/handoff/INDEX.md`(AC9 — 작업 트리) · 같은 장치 `--base <W2 커밋>^ --head <W2 커밋>`(AC10).
- `lint`는 `--fix`라 파일을 쓴다 — 실행 뒤 `git status`로 자기 변경 밖의 수정이 없는지 본다.
- 사람 실기: AC20.

## READY self-review

- [x] Decision Ledger — D-001~D-015, 사용자 원문 3문장 인용. `ACTIVE 결정 ↔ AC 대조: 충돌 0`(§3 갱신 메모).
- [x] Part I만으로 완료 상태가 읽힌다 — §5 표 7행.
- [x] 조건절 유지 — "무작정 코드 제거 금지"를 "옮김만"(D-003)으로, "성능 최소 동등"을 항목별 표(§14)로 적었다. 늘어나는 한 항목(컴포넌트 경계)을 숨기지 않았다.
- [x] 사용자에게 물을 결정 0 — 범위 확장(D-009·D-012)과 공용 틀(D-006)은 완료 보고에서 알리고 ΔV로 되돌릴 수 있다.
- [x] AS-IS·TO-BE·Delta가 같은 축(W1 틀·키 · W2 표 · W3 잠금)이다. 사라진 책임 0.
- [x] 수치 실측 — 틀 자리 3 · 소비처 7(잡음 3) · 표 깨짐 9(구현 8) · 시제작 +63/−65 · 기준선 68/320. 인용 테스트 케이스 `grep`으로 확인.
- [x] AC 20개 모두 동작 기준·검증 수단·도달 경로를 가진다. 음성 기준은 양성 짝이 있다.
- [x] Baseline V · NEW node마다 같은 레벨 REQUIRED pair, 영향받은 INHERITED MD-01은 REGRESSION(VP-04).
- [x] pair마다 path·§10 자리·좌표. EP-01 키 6분기·제목 4분기, EP-02 점유 4분기, EP-03 2분기 ↔ 구별 입력 칸.
- [x] 선언 경계 W1-B1~B4 · W2-B1·B2 · W3-B1·B2 — 측정 근거(P-6·P-7·T-3·T-7·B-4) 또는 범위 결정(D-010).
- [x] `tables.mjs`는 fail-closed — 변이 7종 red를 이 턴에 관측.
- [x] 후보 표 겹침 — 승격 3행(0317·0299·0308) 외 겹침 0.
- [x] 운영 gate 4행 · §19가 `app/AGENTS.md` 로컬 확인 목록과 같다.
- [x] 사람 실기로 미룬 순수 로직 0 — AC20은 브라우저 기본 동작과 시각뿐.
- [x] structural proxy — AC5·AC7은 D-002·D-006의 형태 계약이고 동작은 AC1~AC4가 따로 잠근다. AC6은 성능 조건의 정적 관측 + DOM 동일.
- [x] 부팅/등록 변경 없음 · 외부 계약 없음 · one-way door 없음.
- [x] 문장 규칙 — 판정 먼저, 표 칸 3줄 이내.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md). 필드는 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md)의 `[구현자 기입]` 전부를 같은 이름으로 채운다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 / EP-01 | … | S1~S4 (4) | … | … | … | … |
| VP-08 / EP-02 | … | S1~S5 (5) | … | … | … | … |
| VP-09 / EP-03 | … | S1·S2 (2) | … | … | … | … |
| VP-06 / EP-04 | … | 8행 | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01~VP-12 | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: 해당 없음(첫 라운드)

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | … |
| **추가·수정 테스트의 subtree 규칙** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
