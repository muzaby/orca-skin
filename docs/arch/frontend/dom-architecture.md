# Frontend Architecture — DOM Architecture (마커 체계·z-stack·titlebar)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-07-10 (handoff 0094 — 테마 2종·modal/debug 슬롯 children 동기화)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [layers.md](./layers.md), [ux-domains.md](./ux-domains.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. DOM Architecture Specification (Phase 3+)

> **채택 결정 (2026-05-26)**: 렌더러 전체에 구조 식별 클래스 + 행동/상태 메타 속성을 부여하는 마크업 컨벤션. 외부 도구(테스트·접근성·디버깅 인스펙터·디자인 시스템 분리)가 DOM 만으로 셸 구조와 인터랙션 상태를 읽을 수 있게 한다. 단일 PR (`claude/charming-galileo-7lAqY`, 커밋 `45e129f` + 정정 `acf1295`) 로 일괄 적용 완료.

### 1.1 속성 체계 — 역할 분리

| 속성                          | 역할                         | 예시                                                                                                                               |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `class="app-frame-*"`         | 구조 식별 — _이게 뭐다_      | `app-frame-sidebar`, `app-frame-tile`, `app-frame-composer-input`                                                                  |
| `class="<tailwind>"`          | 스타일링 — _이렇게 생겼다_   | `flex flex-col w-56 bg-sidebar`                                                                                                    |
| `data-behavior="..."`         | JS 행동 — _이걸 할 수 있다_  | `drag-region`, `no-drag`, `resizable`, `collapsible`, `virtualizable`, `interactive`, `focus-trap`, `dismissible`, `action:{name}` |
| `data-state="..."`            | 현재 상태 — _지금 이 상태다_ | `expanded`/`collapsed`, `visible`/`hidden`                                                                                         |
| `data-axis`, `data-context`   | 메타 설정 — _이런 조건이다_  | `vertical`/`horizontal`, `sidebar`/`tile`/`modal`/`overlay`/`debug`                                                                |
| `data-theme`, `data-platform` | 루트 환경 — `<html>` 에만    | `white`/`dark`, `darwin`/`win32`/`linux`                                                                                  |

**원칙**: 두 속성은 **공존**한다. `app-frame-*` 클래스는 마커이며 시각 스타일은 같은 element 의 Tailwind 유틸이 계속 진실. 마커 부여로 인한 시각 회귀는 없어야 한다.

### 1.2 DOM 골격 트리

```
html[data-theme][data-platform]
└── #root
    └── .app-frame-root                                  (flex column, 셸 컨테이너)
        ├── header.app-frame-header                       (drag 2-layer)
        │   ├── div[data-behavior="drag-region"]         (absolute inset-0)
        │   ├── .app-frame-header-left  [no-drag]        (5-버튼 툴바: menu · panelL · search · arrowL · arrowR)
        │   ├── .app-frame-header-center                 (drag 유지)
        │   └── .app-frame-header-right [no-drag]
        │       └── .app-frame-window-controls           (Win/Linux 만, macOS 는 null)
        │
        └── .app-frame-grid                               (1×1 CSS grid, z-stack)
            ├── .app-frame-body                z=0       (Sidebar + Main 가로 배치)
            │   ├── aside.app-frame-sidebar
            │   │   [data-behavior="collapsible resizable"]
            │   │   [data-state="expanded|collapsed"]
            │   │   ├── .app-frame-sidebar-body
            │   │   │   ├── .app-frame-sidebar-brand    (🐋 + "Orca" 브랜드 로고)
            │   │   │   ├── nav.app-frame-sidebar-nav   (4-항목: 새 대화 · 프로젝트 · 엔진 & 모델 · Skills & MCP; 자동화는 Future Scope 로 nav 미노출)
            │   │   │   ├── .app-frame-sidebar-sessions
            │   │   │   └── .app-frame-sidebar-footer
            │   │   └── .app-frame-resize-handle          (aside 자식 — collapse 시 함께 사라짐)
            │   │
            │   └── main(.app-frame-pane-host)
            │       └── .app-frame-pane-row
            │           └── .app-frame-tile [data-behavior="resizable"]
            │               ├── .app-frame-titlebar
            │               ├── .app-frame-transcript [data-behavior="virtualizable"]
            │               └── .app-frame-composer
            │                   ├── .app-frame-composer-input [data-behavior="interactive"]
            │                   └── .app-frame-composer-controls
            │                       └── .app-frame-composer-repo  [data-behavior="dismissible"]
            │
            ├── #app-frame-overlay   z=-10 ↔ 10           (modal backdrop: blur + dim + pointer block)
            ├── #app-frame-modal     z=-20 ↔ 20           (focus-trap 컨테이너 — InstallerDialog · AuthExpiredModal · SearchModal · UpdateDialog · ConfirmDialogHost)
            └── #app-frame-debug     z=30                 (DebugPanel 등 개발 보조 floating UI)
```

footer 는 두지 않음 — Orca 는 정보 분산 배치 (모델/사용량 → composer 하단, 브랜치/상태 → titlebar, 계정 → sidebar footer).

> 추가로 sidebar `sessions` 슬롯 내부의 각 행은 `.app-frame-session-row` + `data-context="session"` + `data-state="active|inactive"` + `data-behavior="interactive selectable"` (rename 모드에서는 `interactive renaming`) 를 부여한다. `data-session-id` 가 함께 부착되어 외부 도구가 행을 식별할 수 있다.
>
> `body` 외부에 **portal 로 떠 있는 floating UI** (Popover · SkillAutocomplete · FileAutocomplete) 는 `document.body` 자식으로 mount 되며, 자기 element 에 `.app-frame-floating` + `data-context="floating"` + `data-behavior="dismissible"` 를 부여한다. 별도의 z-stack 슬롯은 사용하지 않으며 `z-50` Tailwind 유틸로 어디서나 상위에 뜨도록 한다. 마운트 위치가 body 직속인 이유는 (a) 부모 grid cell 의 overflow clip 회피, (b) modal/debug 슬롯 z 와 무관하게 anchor 기준 절대 위치가 보장되기 때문.

### 1.3 Drag 2-layer 패턴

Electron `frame: false` 윈도우에서 드래그 영역을 정의할 때 동일하게 적용:

```
container (relative)
├── drag-layer (absolute inset-0, style={{ WebkitAppRegion: 'drag' }})
└── content-layer (relative z-[1])   ← 클릭 가능
```

inline 클래스 `[-webkit-app-region:drag]` 대신 `style={{ WebkitAppRegion: 'drag' }}` 로 명시 — 의미 명확 + TS 타입 안정.

### 1.4 Sidebar 캡슐화

resize-handle 은 `aside` 형제가 아니라 **자식**으로 둔다.

| 위치       | 이름                       | 이유                                                                                                                                                                             |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| aside 내부 | `app-frame-resize-handle`  | sidebar 에 소속된 조작 장치. collapse 시 함께 사라진다.                                                                                                                          |
| tile 사이  | `app-frame-tile-separator` | 독립적인 두 tile 사이의 분리선. **구현됨** — plan 모드 검토용 우측 계획 타일(`PlanTile`)을 채팅 tile 과 분할. `useDragResize({ invert: true })` 로 우측 도킹 폭 조절(280–640px). |

같은 역할이지만 소속 관계가 다르므로 이름을 구분한다.

### 1.5 Overlay / Modal / Debug 슬롯 규칙

`#app-frame-overlay` 는 **modal backdrop 전용**이며, modal 활성 시에만 떠올라야 한다. visibility 토글은 **z 부호 반전**으로 한다.

| 슬롯                 | 평소 z      | modal 활성 시 z | 역할                                                                                                                 | children                                      |
| -------------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `#app-frame-overlay` | `-10`       | `10`            | backdrop (`bg-black/40 backdrop-blur-sm`). 평소엔 body 뒤로 깔려 보이지도 클릭도 안 됨.                              | 없음 — 순수 layer                             |
| `#app-frame-modal`   | `-20`       | `20`            | focus-trap 컨테이너. 모달들은 동시에 열리지 않으므로 conditional render 로 1개만 노출.                              | `<InstallerDialog>` · `<AuthExpiredModal>` · `<SearchModal>` · `<UpdateDialog>`(0085) · `<ConfirmDialogHost>`(0083) |
| `#app-frame-debug`   | `30` (상시) | `30` (상시)     | DebugPanel 등 개발 보조 floating UI. modal 상태와 무관. wrapper `pointer-events-none` + 자식 `pointer-events-auto`. | `<DebugPanel>`(dev 전용, Tweaks 컨트롤 포함) 등 |

규칙:

- overlay 와 modal 의 z 부호는 **항상 동시에** 반전 (modal 발생 ↔ 부재).
- `data-state="visible|hidden"` 마커는 보존하되, **실제 visibility 는 z 가 결정**.
- DOM 은 항상 마운트된 상태 — z 부호 반전만으로 토글.
- backdrop 시각 (blur + dim) 은 overlay element 의 stable 스타일 — z 가 음수일 때는 어차피 안 보이므로 별도 토글 불요.
- modal 컴포넌트들은 자체 `fixed inset-0 bg-black/40` backdrop 을 갖지 않는다 — backdrop 은 `#app-frame-overlay` 가 단독으로 담당. panel 만 `grid place-items-center` 로 중앙 배치.

### 1.6 data-\* 마커 카탈로그 (현재 사용)

| 위치                                                                   | 속성                                                          | 값                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<html>`                                                               | `data-theme` / `data-platform`                                | `white\|dark` / `darwin\|win32\|linux`                                  |
| header drag-layer                                                      | `data-behavior`                                               | `drag-region`                                                                   |
| header content-layer · 좌 · 우                                         | `data-behavior`                                               | `no-drag`                                                                       |
| WinControls 각 버튼                                                    | `data-behavior`                                               | `action:window-minimize\|window-maximize\|window-close`                         |
| `aside.app-frame-sidebar`                                              | `data-behavior` / `data-state`                                | `collapsible resizable` / `expanded\|collapsed`                                 |
| `.app-frame-resize-handle`                                             | `data-behavior` / `data-axis` / `data-context` / `data-state` | `resizable` / `vertical` / `sidebar` / `visible\|hidden`                        |
| `.app-frame-tile`                                                      | `data-behavior`                                               | `resizable`                                                                     |
| `.app-frame-transcript`                                                | `data-behavior`                                               | `virtualizable`                                                                 |
| `.app-frame-composer-repo`                                             | `data-behavior`                                               | `dismissible`                                                                   |
| `.app-frame-composer-input`                                            | `data-behavior`                                               | `interactive`                                                                   |
| 스크롤 하단 버튼 (있을 때)                                             | `data-behavior`                                               | `action:scroll-bottom`                                                          |
| composer send/cancel 버튼                                              | `data-behavior`                                               | `action:send` / `action:cancel-turn`                                            |
| `.app-frame-session-row`                                               | `data-context` / `data-state` / `data-behavior`               | `session` / `active\|inactive` / `interactive selectable\|interactive renaming` |
| `.app-frame-floating` (Popover / SkillAutocomplete / FileAutocomplete) | `data-context` / `data-behavior`                              | `floating` / `dismissible`                                                      |
| `.app-frame-search-modal` (SearchModal 패널)                           | `data-context` / `data-behavior`                              | `modal` / `focus-trap`                                                          |
| `#app-frame-overlay`                                                   | `data-state` / `data-context`                                 | `visible\|hidden` / `overlay`                                                   |
| `#app-frame-modal`                                                     | `data-behavior` / `data-state` / `data-context`               | `focus-trap blocks-interaction` / `visible\|hidden` / `modal`                   |
| `#app-frame-debug`                                                     | `data-context`                                                | `debug`                                                                         |

### 1.7 마커 전용 원칙

새 클래스/속성은 **기존 Tailwind 유틸과 공존**한다. 기존 유틸을 교체하지 않는다. 새 CSS 파일/규칙은 추가하지 않는다 (grid 1×1 z-stack 도 Tailwind arbitrary value `grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]` 로). 시각 회귀 0 을 목표.

새 컴포넌트 추가 시:

1. 가이드라인의 트리 위치에 맞는 `app-frame-*` 클래스 부여.
2. 인터랙션이 있으면 `data-behavior` / `data-state` 도 함께.
3. 시각 스타일은 Tailwind 유틸로 — 마커가 스타일을 대신하지 않는다.

---

## Mock UI marker (0010)

아직 동작하지 않는 장식 UI 는 `disabled` 또는 `aria-disabled`, `data-state="mock"`, 빗금 배경을 함께 적용한다. 공용 빗금 배경은 renderer shared UI 상수(`MOCK_HATCH_BG`)를 재사용한다.
