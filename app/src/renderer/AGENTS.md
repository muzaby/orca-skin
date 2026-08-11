# `src/renderer/` — Renderer 레이어 가이드 (코딩 에이전트용)

React 렌더러의 **레이어 경계 + 스타일 규칙**. 위반하면 `npm run lint` 가 error 를 낸다(boundaries)
거나, lint 를 통과한 채로 **형제 인스턴스가 함께 반응하는 버그**가 난다(그룹 스코프).

> 정본 우선: 디렉토리 트리·슬롯 책임·`App.tsx` Provider 합성 순서는
> [`../../../docs/arch/frontend/layers.md`](../../../docs/arch/frontend/layers.md),
> DOM 마커 체계는 [`dom-architecture.md`](../../../docs/arch/frontend/dom-architecture.md),
> 상태 관리는 [`state.md`](../../../docs/arch/frontend/state.md) 가 갖는다.
> 본 문서는 *코드를 짤 때의 규칙*만 담는다.

## 4-layer DAG (하향 의존만)

```
app/          → pages · features · shared      (셸: Provider 합성 · router · AppLayout)
pages/        → features · shared              (조립만 — Context 읽기 + features 배치. 로직 0)
features/<X>/ → shared + 같은 feature 내부      (도메인 로직. 다른 feature → 차단)
shared/       → shared 내부만                  (범용 atom. 도메인 로직 0)
```

`eslint-plugin-boundaries` v6 (`boundaries/dependencies`) 가 빌드 시 강제한다.

- **feature 끼리 직접 import 하지 않는다.** cross-feature 데이터가 필요하면 역방향/타-feature
  import 대신 **`pages/` 또는 `app/` 에서 props 로 내려준다**.
- `shared/` 에 도메인 로직을 넣지 않는다 — 도메인을 아는 순간 범용이 아니다.
- `pages/` 는 조립만 한다. 로직이 생기면 그 feature 로 옮긴다.

## 스타일

- **Tailwind v4 + 시맨틱 토큰 우선** — `bg-bg` · `text-ink` · `border-border`. raw hex 를 쓰지 않는다.
- 새 토큰은 `styles/tokens.css` 의 `@theme` 에 추가하고 **두 테마 스코프 전부**에 값을 채운다
  (white = 루트 `@theme` 기본값, dark = `[data-theme='dark']`). 한쪽만 채우면 그 테마에서 깨진다.
- **인라인 `style` 은 동적 계산값에만** (드래그 좌표 · `width %` · grid template). 정적 값은
  Tailwind 클래스로.
- 새 CSS 파일·규칙을 추가하지 않는다 — Tailwind 유틸(arbitrary value 포함)로 표현한다.

### 그룹 스코프 격리 (버그 방지 핵심)

자체 hover 를 가진 컴포넌트는 익명 `group` 대신 **`group/<이름>` + `group-hover/<이름>:`** 을 쓴다.

익명 `group-hover:` 는 상위의 다른 `.group`(예: `AssistantMessage`)까지 매칭되어 **형제 인스턴스가
함께 hover** 되는 버그가 난다 — 메시지에 hover 하면 그 안의 모든 코드블럭 카피 버튼이 동시에 뜬다.

선례: `CodeBlock` = `group/codeblock` (`shared/ui/markdown/CodeBlock.tsx`) ·
`SessionRow` = `group/session` (`features/sessions/components/SessionRow.tsx`).

## 단일 파일 분해 가이드

`.tsx`/`.ts` 는 하나의 응집된 책임을 지킨다. 아래 중 하나면 분해를 **검토**한다:

1. 한 파일에 **React 컴포넌트 5개 이상**이 모이고 그중 일부가 다른 레이어/슬롯에 속할 수 있다.
2. **400줄 초과**.

단일 컴포넌트의 응집 구현(`HighlightedTextarea`·`chatReducer` 등)은 예외다. 분해할 때 새 파일은
**해당 레이어·feature 디렉토리**(`features/<X>/components|hooks/` · `shared/ui/`)에 둬 4-layer
경계를 보존한다.

> 수치(5개·400줄)는 **경고 트리거지 절대 규칙이 아니다** — 리뷰에서 "왜 한 파일에 두었는가" 를
> 물어보라는 시그널이다.

## 테스트

- reducer · 순수 변환기 · 파생 셀렉터는 단위 테스트와 함께 작성한다.
- UI 자체는 시각 검증으로 갈음한다(자동화된 시각 회귀 없음).
- 게이트: `cd app && npm run lint && npm run typecheck` (ABI 중립 — `../../AGENTS.md` §better-sqlite3 ABI).
