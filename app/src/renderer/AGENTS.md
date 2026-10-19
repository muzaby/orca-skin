# `src/renderer/` — Renderer 레이어 가이드 (코딩 에이전트용)

React 렌더러의 **레이어 경계 + 스타일 규칙**. 위반하면 `npm run lint` 가 error 를 낸다(boundaries)
거나, lint 를 통과한 채로 **형제 인스턴스가 함께 반응하는 버그**가 난다(그룹 스코프).

> 정본 우선: 디렉토리 트리·슬롯 책임·`App.tsx` Provider 합성 순서는
> [`../../../docs/arch/frontend/layers.md`](../../../docs/arch/frontend/layers.md),
> DOM 마커 체계는 [`dom-architecture.md`](../../../docs/arch/frontend/dom-architecture.md),
> 상태 관리는 [`state.md`](../../../docs/arch/frontend/state.md) 가 갖는다.
> 본 문서는 *코드를 짤 때의 규칙*만 담는다.

## Renderer 제작 시 필수 디자인 계약

renderer 제작·컴포넌트 추가·기존 UI 수정 전에
[디자인 시스템](../../../docs/arch/frontend/design-system.md)과
[컴포넌트 카탈로그](../../../docs/arch/frontend/design-components.md)의 해당 영역을 **읽고 준수한다**.
AI도 동일하게 적용한다. 토큰 값·props는 연결된 현재 소스에서 확인한다.

1. **역할과 범위 선택**: 공통 Orca·Claude / OpenCode 전용 chrome / 카메라 stage / 개발 패널 중 적용 범위를 정한다. 하네스별 표면을 공통 셸에 전파하지 않는다.
2. **재사용 우선**: 카탈로그에서 같은 역할의 선례를 열고 Button·MenuItem·Modal·Catalog UI·PanelControls·ReadingColumn 등 기존 primitive를 사용한다. 새 범용 UI는 shared, 도메인 UI는 해당 feature, 조립은 pages/app에 둔다.
3. **상태 설계**: 관련되는 기본·hover·focus·선택·disabled·busy·empty·error·success·펼침/닫힘을 정의한다. 키보드 경로·접근성 이름·초점 복귀·긴 텍스트·좁은 pane도 포함한다.
4. **구현**: 아래 레이어·토큰·style·group 규칙과 디자인 시스템을 지킨다. 기존 원시 색·고정 크기를 새 컴포넌트의 관례로 복사하지 않는다.
5. **완료 검토**: white/dark, 적용되는 상태, 긴 한국어/다른 locale 라벨, pane 축소·확대, 키보드 열기→선택→닫기→초점 복귀를 확인한다. 채팅은 본문 크기·읽기 폭 설정과 스트리밍·스크롤·선택·초안 보존도 확인한다.
6. **같은 변경에서 문서 갱신**: 컴포넌트 신설·이동·삭제 시 카탈로그 행을, 공통 시각 규칙 변경 시 디자인 시스템과 해당 정본을 갱신한다. 완료 보고에 재사용 항목과 검증 결과·미확인 시각 항목을 적는다.

가이드와 코드가 다르면 먼저 원인을 조사한다. 문서 드리프트는 정정하고, 새 제품 동작·전역 테마 교체는 컴포넌트 추가에 섞어 결정하지 않는다.
접근성·테마·모션 검토를 했다는 문장만으로 완료 처리하지 않는다. 실제 확인한 흐름과 관측을 남긴다.

## 4-layer DAG (하향 의존만)

하네스 전용 구현은 feature 안의 `harnesses/<하네스>/`, 공통 구현은 feature-local `common/` 또는 `harnesses/common/`에 둔다. 조립 진입점이 정책·슬롯을 주입하며 공통에서 구체 하네스/registry를 import하거나 하네스 형제를 직접 참조하지 않는다. 순수 정책과 React 표면 등록을 분리하고 입력 controller를 하네스 전환 때 다시 생성하지 않는다.

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

단일 컴포넌트의 응집 구현(`ComposerDecorationLayer`·`chatReducer` 등)은 예외다. 분해할 때 새 파일은
**해당 레이어·feature 디렉토리**(`features/<X>/components|hooks/` · `shared/ui/`)에 둬 4-layer
경계를 보존한다.

> 수치(5개·400줄)는 **경고 트리거지 절대 규칙이 아니다** — 리뷰에서 "왜 한 파일에 두었는가" 를
> 물어보라는 시그널이다.

## 테스트

- reducer · 순수 변환기 · 파생 셀렉터는 단위 테스트와 함께 작성한다.
- UI 자체는 시각 검증으로 갈음한다(자동화된 시각 회귀 없음).
- 게이트: `cd app && npm run lint && npm run typecheck` (ABI 중립 — `../../AGENTS.md` §better-sqlite3 ABI).
