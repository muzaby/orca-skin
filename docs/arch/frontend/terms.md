# Frontend 용어 해설 (사람용)

> 이 문서의 독자: **사람** (신규 합류자·팀 동료) — AI agent 용 정본 문서가 아니다.
> 관련 문서: [../../GLOSSARY.md](../../GLOSSARY.md) (용어 정본/SSOT), [overview.md](./overview.md), [layers.md](./layers.md), [dom-architecture.md](./dom-architecture.md), [state.md](./state.md), [rendering.md](./rendering.md), [ux-domains.md](./ux-domains.md)
> 진실의 기준: **정의는 GLOSSARY.md / 해당 arch 문서가 정본.** 본 문서는 처음 보는 사람을 위한 쉬운 해설일 뿐, 충돌 시 정본 우선.

이 문서는 코드·아키텍처 문서에 나오는 *요소 이름* 을 처음 보는 사람을 위해 평이한 한국어로 풀어준다. 정확한 한 줄 정의·코드 심볼·진실의 기준은 GLOSSARY.md(및 링크된 arch 절)에 있으니, "정본" 칸을 따라가면 된다. 본 문서는 새 정의를 만들지 않는다.

> 비유 한 줄: **Frame** 은 건물 골조, **Slot** 은 골조 안에 정해진 빈 방, **Tile** 은 방에 들어가는 가구, **Screen** 은 가구 위에 펼쳐 놓은 내용물이라고 보면 된다.

## 1. 셸·레이아웃 (앱 바깥 틀)

| 이름 | 쉬운 설명 | 화면 어디서 보이나 | 정본 |
|---|---|---|---|
| **Frame** | 앱 전체를 감싸는 가장 바깥 골조. 모든 슬롯의 부모. | 창 전체 (`app-frame-root`) | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **Header** | 창 맨 위 OS 헤더 줄. 좌측에 5-버튼 툴바(메뉴·사이드바접기·검색·뒤로·앞으로), 우측에 창 컨트롤. | 최상단 가로 줄 | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) · [dom-architecture.md §1](./dom-architecture.md) |
| **Sidebar** | 왼쪽 접이식 패널. 위에서부터 브랜드 로고 → 내비 → 세션 목록 → 푸터. 폭은 드래그로 조절. | 화면 좌측 | [dom-architecture.md §1](./dom-architecture.md) |
| **Slot** | 마크업 트리에서 *정해진 자리*. `app-frame-*` 클래스로 식별. 빈 방 개념. | (보이지 않는 구조) | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **Tile** | 가로로 늘어선 콘텐츠 단위. 채팅 Tile, 계획 Tile 등. Tile 안의 *내용물* 이 Screen. | 본문 영역의 각 칸 | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **PlanTile** | 계획(plan) 모드일 때 채팅 Tile 오른쪽에 분리선으로 붙는 계획 전용 Tile. 헤더 `panelR` 로 토글. | 채팅 우측 분할 칸 | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **Overlay / Modal / Debug** | 본문 위에 겹쳐 뜨는 3개 z-층. Overlay=모달 뒤 어두운 막, Modal=팝업 본체, Debug=떠 있는 개발용 UI. | 팝업이 뜰 때 | [dom-architecture.md §1](./dom-architecture.md) |
| **WinControls** | 최소화·최대화·닫기 버튼. macOS 에선 OS 신호등이 그려 숨김. | 헤더 우측 | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |

## 2. 4-layer 구조 (코드 디렉토리 책임)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **`app/`** | 셸을 *조립* 하는 층. Header·Sidebar·레이아웃·라우터를 끼워 맞춘다. | [layers.md §1](./layers.md) |
| **`pages/`** | 라우트별 진입점. **조립만** 하고 비즈니스 로직은 두지 않는다. | [layers.md §1](./layers.md) |
| **`features/<도메인>/`** | 실제 기능이 사는 곳 (chat·sessions·projects·backend·engine·skills 등). 화면·훅·컴포넌트가 도메인별로 모임. | [layers.md §1](./layers.md) |
| **`shared/`** | 도메인과 무관한 범용 도구 (ui·hooks·api·config·theme·navigation). | [layers.md §1](./layers.md) |

> ESLint boundaries 가 역방향·교차 import 를 막는다. 한 feature 가 다른 feature 를 직접 import 하면 빌드에서 막힌다.

## 3. 라우팅 (어떤 화면을 보여줄지)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Router** | URL 경로 → 페이지 매핑. `app://` 커스텀 스킴 + react-router BrowserRouter. | [overview.md §2](./overview.md) |
| **BootRedirector** | 앱이 처음 뜰 때 `/` 를 마지막 세션(`/chat/<id>`) 또는 새 대화(`/new`)로 돌려보내는 로직. | [overview.md §2](./overview.md) |
| **useChatRouteSync** | URL 과 채팅 상태(ChatState)를 양방향으로 맞춰주는 훅. | [state.md §1](./state.md) |

## 4. 채팅 화면 요소

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **ChatTile** | 대화가 그려지는 메인 화면. 메시지 목록 + 스트리밍 + 입력창을 품는다. | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **Composer** | 맨 아래 입력창. 여러 줄 입력 + 칩 툴바 + 자동완성. | [GLOSSARY §1 (Skill)](../../GLOSSARY.md#1-도메인-용어) |
| **Transcript** | 메시지들이 위로 쌓이는 목록 영역. | [rendering.md §1](./rendering.md) |
| **ToolCard** | 어시스턴트가 부른 도구 1회를 카드로 표시 (입력/결과 토글). | [rendering.md §1](./rendering.md) |
| **Markdown / CodeBlock** | 답변 마크다운 렌더링 + 코드 블록 문법 하이라이팅(shiki). | [rendering.md §1](./rendering.md) |
| **SkillAutocomplete / FileAutocomplete** | 입력창에서 `/`(스킬) · `@`(파일) 칠 때 뜨는 자동완성. | [ux-domains.md §1](./ux-domains.md) |

## 5. 상태 (데이터가 흐르는 방식)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **ChatState** | 현재 대화의 상태 묶음 (sessionId·messages·inflight — chatStore 의 `sessions[key].session`). | [state.md §1](./state.md) |
| **useChat / chatReducer** | 채팅 상태를 바꾸는 훅 + 순수 reducer (메시지 전송·이벤트 수신·새 대화 등). | [state.md §1](./state.md) |
| **Delta** | 답변이 스트리밍될 때 도착하는 *부분 텍스트 조각*. chatStore 의 `live.text`(구 pendingDelta)에 누적되다 완성되면 메시지로 확정. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |
| **Tweaks** | 사용자 환경 설정 (테마·밀도·사이드바). electron-store 로 저장. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |

## 6. 화면 카탈로그 (Screen)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Screen** | Tile 의 *내용물* 인 도메인 화면(개념). 구 `screens/` 디렉토리·`registry.ts` 는 PR #29 로 해체 — 지금은 `pages/*Page.tsx` 가 `features/<domain>/` 뷰를 조립한다. | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **라우트 화면** | `/chat`(대화) · `/new`(새 대화) · `/projects`(프로젝트) · `/agent`(엔진/모델 설정). | [ux-domains.md §3](./ux-domains.md) |
| **SearchModal** | 헤더 검색 버튼으로 여는 대화 전문검색(FTS5) 모달. | [ux-domains.md §3](./ux-domains.md) |
| **AuthExpiredModal / InstallerDialog** | 인증 만료 안내 모달 / CLI 설치 진행 로그 다이얼로그. | [ux-domains.md §1](./ux-domains.md) |

## 7. DOM 마커 (마크업에 붙는 표식)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **`app-frame-*`** | *스타일이 아니라 구조* 를 식별하는 클래스. 슬롯 위치를 가리킨다. | [dom-architecture.md §1](./dom-architecture.md) |
| **`data-behavior`** | JS 동작 표시 (드래그 영역·리사이즈·닫힘 가능·상호작용). | [dom-architecture.md §1](./dom-architecture.md) |
| **`data-state`** | 지금 상태 (펼침/접힘·보임/숨김·활성/비활성). | [dom-architecture.md §1](./dom-architecture.md) |
| **`data-context`** | 부가 메타 (sidebar·tile·modal·overlay·session·floating). | [dom-architecture.md §1](./dom-architecture.md) |
| **`data-theme` / `data-platform`** | CSS 변수 테마 범위 / OS 종류(darwin·win32·linux). | [dom-architecture.md §1](./dom-architecture.md) |

> 사용하지 않는 어휘: **Pane**(→ Tile/Screen), **Titlebar**(셸 헤더 의미 → Header), **Provider/Conversation/Thread**. 자세한 금지 목록은 [GLOSSARY §3](../../GLOSSARY.md#3-사용하지-않는-용어-혼동-방지).
