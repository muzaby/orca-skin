# 저장소 루트 — 코딩 에이전트용 가이드

이 저장소는 **Orca** (검증 엔지니어용 Windows Electron 데스크톱 앱) 의 디자인 핸드오프 + 구현 작업 공간이다. 한 화면에 모든 정보를 담을 수 없으므로 디렉토리마다 별도의 `CLAUDE.md` 가 있다. 본 문서는 *어디로 가서 무엇을 읽어야 하는지* 만 안내한다.

## 디렉토리 한눈에

| 디렉토리 | 역할 | 가이드 |
|---|---|---|
| `chats/` | 사용자 의도 트랜스크립트 (Claude Design 핸드오프) — *왜* 가 산다 | `chats/CLAUDE.md` |
| `docs/` | PRD, TRD, 전략 문서 — *무엇을* / *어떻게* 가 산다 | `docs/CLAUDE.md` |
| `project/` | HTML/CSS/JS 디자인 프로토타입 (variation A 채택) — *어떻게 보여야 하는가* | `project/CLAUDE.md` |
| `app/` | Orca v1 실제 구현체 (electron-vite + React/TypeScript). Phase 3+ — 로컬 SQLite SSOT + 세션 히스토리 + DOM Architecture + `frame/` & `screens/` 슬롯 분리. | `app/CLAUDE.md` |

## 새 세션 진입 시 읽는 순서

1. **`chats/`** — 트랜스크립트(현재 1개). *결정 키워드* ("A로 진행", "확정", "OK") 가 진실. 어시스턴트의 긴 제안보다 사용자의 짧은 응답이 우선.
2. **`docs/PRD.md`** — 무엇을 만들지 (Orca v1 MVP). §6 (MVP Scope), §9 (Future Scope), §11 (Open Questions) 가 핵심.
3. **`docs/TRD.md`** — 어떻게 구현할지. 코드 작업의 1차 참고서.
4. **`app/CLAUDE.md`** → `app/` — 구현 디렉토리 규칙·모듈 레이아웃·의존성 정책·보안 베이스라인.
5. (필요 시) **`project/electron/index.html`** — 시각 기준 (variation A). 픽셀 퍼펙트 *재현* 대상이지 그대로 가져갈 production 코드가 아니다.
6. (필요 시) **`docs/llm-chat-desktop-strategy.md`** — TRD 가 소화한 전략적 근거. TRD 결정의 *왜* 를 거슬러볼 때.

## 현재 페이즈

| 단계 | 상태 |
|---|---|
| 디자인 핸드오프 (variation A 확정) | 완료 — `chats/chat1.md`, `project/electron/` |
| 제품 정의 (PRD v1) | 완료 — `docs/PRD.md` |
| 구현 사양 (TRD v1) | 완료 — `docs/TRD.md` (Tailwind CSS 결정 반영 §2, §9.5) |
| 스캐폴드 (electron-vite react-ts + Tailwind CSS) | 완료 — `app/` |
| Phase 1 (mockup 시각 재현 + Tailwind v4) | 완료 — `app/src/renderer/` |
| **Phase 2 (claude-code 단일 어댑터 + 채팅 IPC)** | **완료** — `app/src/main/`, `app/src/preload/` |
| **Phase 2+ (`electron-store` 영속화: Tweaks · lastSessionId · lastBackend · window bounds)** | **완료** — `app/src/main/settings/store.ts` |
| **Phase 2++ (Composer 스킬 UX: SKILL.md 스캔 · 3-chip 행 · picker · 인라인 자동완성)** | **완료** — `app/src/renderer/src/frame/composer/` (PR #25 이전엔 `components/composer/`), `app/src/main/skills/` |
| **Phase 3 (로컬 SQLite SSOT · 세션 히스토리 · 사이드바 비동기 lazy load + 캐시 + kebab 메뉴)** | **완료 (PR #20)** — `app/src/main/db/`, `app/src/renderer/src/state/useSessions.ts`, `useChat.ts` (캐시), `Sidebar.tsx` (kebab rename/delete) |
| **Phase 3+ (DOM Architecture: `app-frame-*` 마커 + `data-*` 체계 + Custom titlebar `frame:false` + Grid z-stack + Sidebar resize-handle + Tile structure)** | **완료** — `app/src/renderer/src/frame/`, `data-platform`/`data-context`/`data-behavior` 마커 부착, `docs/FRONTEND_ARCHITECTURE.md` §3.3 |
| **Phase 3++ (frame/ + screens/ 슬롯 분리 + 마크업 마커 보강)** | **완료 (PR #25)** — 셸 슬롯 `frame/` vs 도메인 화면 `screens/` 디렉토리 분리, 컴포넌트 rename (`Titlebar`→`Header`, `ChatPane`→`ChatTile`, `*Pane`→`*Screen`), `app-frame-composer-repo` / `app-frame-session-row` / `app-frame-floating` 마커 신설 |
| **Phase 3++ (ChatTile 분해: transcript/composer 부속을 슬롯 디렉토리로 추출)** | **완료 (PR #26)** — 구 620줄 ChatTile.tsx → 369줄. `screens/chat/{format.ts, ToolCard, MessageMeta, AssistantMessage, UserMessage, PendingAssistant}.tsx` + `frame/composer/{ComposerChip, SkillsMenu}.tsx` 추출. `app/CLAUDE.md` 원칙 9 (단일 파일 분해 가이드) 신설 |
| 후속 (CI 워크플로우·Vitest·i18n·Phase 4 Zustand+멀티세션·opencode 어댑터·캡처 실 구현·세션 휴지통 30일 보존) | Future Scope |

## 핵심 원칙 (모든 에이전트 공통)

1. **트랜스크립트 + PRD/TRD 가 진실이다.** `project/` HTML 은 *결과물* 이지 의도가 아니다. 의도는 `chats/` 와 `docs/` 에 있다.
2. **PRD §11 / TRD §15 의 Open Questions 는 미정 항목.** 에이전트가 단독으로 결정하지 마라. 사용자에게 묻는다.
3. **문서와 코드가 모순되면 사용자에게 물어라.** 둘 다 바꿔야 하는지(설계 변경) 코드만(구현 버그) 인지 결정해야 한다.
4. **각 디렉토리의 `CLAUDE.md` 가 그 디렉토리에서 더 구체적인 규칙을 갖는다.** 본 문서와 충돌 시 디렉토리별 가이드 우선.
5. **새 디렉토리 추가 시 그 디렉토리에도 `CLAUDE.md` 를 둔다** — 본 표를 갱신.
6. **언어**: 모든 `CLAUDE.md`, PRD, TRD, 전략 문서, 트랜스크립트는 **한국어**. 코드 식별자·로그·외부 라이브러리 인터페이스는 영어. UI 라벨은 한국어 (`src/shared/i18n/ko.ts`).

## 별도 제품 방향 (본 저장소 내 *문서로만* 존재)

- `docs/lightweight-llm-strategy.md` — 로컬 4B LLM 기반 이미지 센서 QA 시스템. **Orca 와 독립** 한 별개 제품 방향. 본 저장소에서 구현체는 없다.

## 외부 진입점과의 구분

- 루트 `README.md` — Claude Design 핸드오프 *원본 README* (영어). 처음 저장소를 받는 외부 수신자용으로 보존.
- 루트 `CLAUDE.md` (본 문서) — *코딩 에이전트* 진입점 (한국어).
- 둘은 같은 사실을 다른 청중에게 설명한다 — 충돌 시 본 문서가 최신.
