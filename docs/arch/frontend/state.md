# Frontend Architecture — State Management (상태관리·Zustand·멀티세션)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (FRONTEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [../backend/provider-runtime.md](../backend/provider-runtime.md), [rendering.md](./rendering.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 상태 관리

> **현재 (Phase 1·2)**: React Context + useReducer (외부 store 라이브러리 미사용).
> **채택된 결정**: **Zustand 로 전환**. 패턴은 **단일 root store + `sessions: Record<sessionId, SessionState>` 슬라이스** (Map factory 폐기). 도입 시점은 **Phase 4 진입 PR 과 묶음** (Phase 3 사전 마이그레이션 금지). 상세는 §1.4.

### 1.1 상태 분류

| 상태 종류 | 위치 | 영속화 | 예시 |
|---|---|---|---|
| 채팅 세션 상태 | `features/chat/hooks/useChat` 의 useReducer (`ChatState`) | **Phase 3 부터**: 로컬 SQLite 영속화 (../backend/persistence.md). 메모리 캐시 + DB SSOT 병행. | sessionId, messages, pendingDelta, inflight |
| Tweaks (theme/density/sidebar) | `shared/hooks/useTweaks` + electron-store | ✅ `orca:settings:get` / `set` | theme, density, sidebarCollapsed, **sidebarWidth** (180–480, default 248 — Phase 3+) |
| 백엔드 설치 상태 | `features/backend/hooks/useBackend` useState 캐시 | — | backends, active |
| Skills 카탈로그 | `shared/hooks/useSkills` useState 캐시 | — | SkillInfo[] (부팅 1회 스캔) |
| 자동완성 상태 | `useSkillAutocomplete / useFileAutocomplete` 의 useMemo + useState | — | open, query, activeIndex |
| 입력창 텍스트 | 컴포넌트 로컬 `useState` | — | Composer 의 draft text |
| UI 인터랙션 (hover/focus/모달) | 컴포넌트 로컬 `useState` | — | TweaksPanel 펼침 여부 |

### 1.2 `ChatState` (실제 정의)

`app/src/renderer/src/features/chat/reducer/chatReducer.ts` 의 인터페이스 그대로:

```typescript
interface ChatState {
  sessionId: string | null         // 어댑터가 발급한 세션 ID (init 이벤트)
  cwd: string | null               // 작업 디렉토리 (@ 파일 자동완성 기준)
  messages: Message[]              // user/assistant 메시지 배열
  pendingDelta: string             // 스트리밍 중 누적 텍스트
  inflight: boolean                // 요청 진행 중 플래그
  turnStartedAt: number | null     // 회차 시작 시각 (ms, StatusLine 용)
  pendingInputTokens?: number      // 마지막 result 이벤트의 inputTokens
  error?: { code: ErrorCode; message: string; recoverable: boolean }
}
```

7 `ChatAction`: `SEND_USER_MESSAGE` / `RECV_EVENT` / `NEW_CHAT` / `CANCEL_CHAT` / `CLEAR_ERROR` / `RESTORE_SESSION` / `SET_CWD`

### 1.3 Anti-pattern (하지 말 것)

- ❌ **입력창 텍스트를 전역 store 에 두기** — 매 키 입력마다 전역 리렌더 발생. Composer 의 draft 는 컴포넌트 로컬 `useState` 로.
- ❌ **컴포넌트에서 `window.orca` 직접 호출** — `features/<domain>/hooks/use*.ts` (Tweaks 는 `shared/hooks/useTweaks.ts`) 안에서만 IPC 호출. Zustand 전환 후에도 IPC 호출은 store action 안에 머무르며 컴포넌트는 selector / action 만 사용한다.
- ❌ **`features/` hook 에서 `window.orca.*` 직접 호출** — `shared/api/ipc.ts` 타입드 래퍼 (PR #29 에서 도입) 를 경유한다. 직접 호출은 ESLint 위반은 아니지만 테스트 진입점 / IPC 계약 변경 추적성을 망가뜨린다.
- ❌ **`useEffect` 안에서 store→다른 store 갱신** — 무한 루프 위험. reducer 의 단일 액션으로 묶을 것.
- ❌ **`messages` 배열을 mutate** — reducer 는 `.slice()` 후 새 배열 반환 (`chatReducer.ts` 패턴).
- ❌ **Tailwind 클래스에 raw hex 색상** — 시맨틱 토큰 (`bg-bg`, `text-ink`, `border-border`) 우선. 새 색이 필요하면 `tokens.css` 의 `@theme` 에 추가하고 세 테마 스코프 모두 채움.

### 1.4 Zustand 전환 (채택 결정)

> **확정 사항 (사용자 결정)**:
> 1. **단일 root store + `sessions: Record<sessionId, SessionState>` 슬라이스** 패턴 채택. `Map<sessionId, store>` factory 패턴은 폐기.
> 2. **도입 시점은 Phase 4 멀티세션 진입과 동시** (ChatEvent sessionId 확장 + store 외피 변경 + Zustand 도입을 한 PR 로 묶음). **Phase 3 사전 마이그레이션 금지** — Phase 3 까지는 단일 세션이라 Zustand 이득 없음.

#### 4.4.1 도입의 핵심 명분 — selector 기반 구독

Context + useReducer 도 외피 (`sessions: Record<sessionId, ChatState>`) 변경만으로 *동작* 은 한다. 도입 명분은 **선택적 리렌더**:

- Phase 4 동시 스트리밍 시, 비활성 세션의 `pendingDelta` 가 16ms 간격으로 갱신된다. 단일 Context 모델은 모든 consumer 를 리렌더 → 활성 세션 UI 의 입력 응답성 저하.
- Zustand 의 `useChatStore((s) => s.sessions[activeId].messages)` selector 만으로 해결. Context split / `useContextSelector` 서드파티 패치 의존을 피한다.

#### 4.4.2 store 외부 접근 활용

`useChatStore.getState().recv(ev)` 로 IPC `chat:event` 핸들러가 **React 트리 밖에서 직접 dispatch** 가능. `webContents.send('orca:chat:event', ev)` 는 ordered+lossless 1채널이므로, renderer 의 1개 핸들러가 `ev.data.sessionId` 로 라우팅해 해당 세션 슬라이스만 갱신한다.

#### 4.4.3 store 슬라이스 분리

| 슬라이스 | 위치 | 필드 |
|---|---|---|
| **세션별** | `sessions[sessionId]: SessionState` | `messages` / `pendingDelta` / `pendingInputTokens` / `error` |
| **전역** | root state | `activeSessionId` / `inflight` (Phase 4 에서는 세션별로 분리 검토) / `turnStartedAt` / `Tweaks` / `Backend` / `Skills` |

세션 삭제: `delete state.sessions[id]` + 해당 세션의 진행 중 `AbortController.abort()` 호출.

#### 4.4.4 대안 비교

| 옵션 | 선택적 리렌더 | 외부 dispatch | 미채택 이유 |
|---|---|---|---|
| Context + useReducer (현행) | ❌ | ❌ | 동시 스트리밍 시 활성 UI 리렌더 |
| Context split + `useContextSelector` | ✅ | ❌ | 서드파티 패치 의존 |
| **Zustand (단일 root + sessions 슬라이스)** | ✅ | ✅ | **채택** |
| Zustand store factory (`Map<sessionId, store>`) | ✅ | ✅ | 전역 공유 필드용 root store 가 또 필요 → 분산. 영속성 hydration 도 2회 |
| Jotai (`atomFamily(sessionId)`) | ✅ | △ atom 외부 접근 우회 필요 | atom 폭증 + 학습 비용 |
| TanStack Store | ✅ | ✅ | Zustand 와 동급 — 채택 이유 약함 |
| Valtio (proxy mutable) | ✅ | ✅ | mutable 패턴이 reducer 일관성과 충돌 |
| 손수 `useSyncExternalStore` | ✅ | ✅ | Zustand 가 본질적으로 이것의 얇은 wrapper — 직접 구현 이득 적음 |

#### 4.4.5 전환 시 영향 범위

- `features/chat/reducer/chatReducer.ts` → `features/chat/store/chatStore.ts` (Zustand store) 로 재작성. 기존 액션 (`SEND_USER_MESSAGE` / `RECV_EVENT` 등) 은 store 메서드로 변환 + `sessionId` 인자 추가.
- `features/chat/hooks/useChat.ts` 의 useReducer 패턴 → `useChatStore((s) => s.sessions[activeId].field)` selector 로 교체.
- IPC onEvent 핸들러 → `useChatStore.getState().recv(ev)` 로 외부 dispatch.
- `shared/hooks/useTweaks` · `features/backend/hooks/useBackend` · `shared/hooks/useSkills` 도 단계적으로 Zustand root store 의 전역 슬라이스로 흡수 (Chat 마이그레이션 후순).
- `app/AppLayout.tsx` 의 props drilling (현 `newChatSlot` / `sessionsSlot` / `footerSlot` 슬롯) 은 store 직접 구독으로 단순화 가능 — 단, `shared/ui/` 의 presentational 규칙 (layers.md §1.1) 은 유지.

#### 4.4.6 도입 PR 에서 결정할 사항 (Open Questions)

| OQ | 내용 |
|---|---|
| persist middleware vs custom subscribe | Zustand `persist` middleware 의 기본 storage 는 localStorage/AsyncStorage. Electron 에선 custom storage 어댑터 (electron-store 또는 로컬 DB IPC bridge) 필요. zod 검증 흐름과의 정합성 검토. ../backend/overview.md §4 참조. |
| devtools middleware | Redux DevTools 호환 Zustand devtools 사용 여부 — 개발 모드에서만 활성화 권장. |

### 1.5 Tweaks 적용 흐름

```
useTweaks() ──► [Tweaks, setTweak]
                  │
useEffect(theme):  ──► document.documentElement.dataset.theme = t.theme
                       (tokens.css 의 [data-theme="..."] 스코프 활성)
useEffect(density): ──► document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px'
                       (rem 기반 Tailwind spacing 자연 cascade)

부팅: window.orca.settings.get() → 초기 Tweaks 복원
변경: setTweak(key, val) → 로컬 state + window.orca.settings.set({ [key]: val })
```

`data-theme` 속성 변경만으로 모든 CSS 변수 재해석. **트리 remount 불요** (이전에 사용하던 `key={theme}` bump 제거됨).

---

## 2. 멀티세션 UI 동작 (Phase 4 anchor)

> **현재 상태 (Phase 1·2)**: **단일 활성 세션만 지원.** `ChatState.sessionId` 는 `string | null` 의 단일 값이며, `sessions: Record<sessionId, ChatState>` 같은 외피 없음.

### 2.1 Phase 4 확장점

`docs/architecture.md` 가 다루던 Phase 4 anchor 를 이 절에 흡수:

| 변경 | 위치 | 영향 범위 |
|---|---|---|
| `ChatState` 외피 변경 | `features/chat/reducer/chatReducer.ts` | `{ sessions: Record<sessionId, ChatState>; activeSessionId: sessionId }` 형태. 내부 reducer 로직은 "세션 1개 단위" 로 캡슐화되어 있어 외피 변경만으로 흡수 가능. |
| `ChatEvent.sessionId` 필드 추가 | `app/src/shared/ipc.ts` | 현재 `init` variant 만 sessionId 보유. Phase 4 진입 시 *모든 variant* (`assistant_delta` 등) 에 `sessionId: string` 필드 추가 — 동시 흐름의 출처 식별. |
| IPC 1채널 그대로 유지 | `orca:chat:event` | Electron `webContents.send` 가 V8 microtask queue 위에서 ordered + lossless 보장. 별도 메시지큐 도입 *중복 레이어* 이므로 미채택. |
| Sidebar 세션 탭 UI | `features/sessions/components/SessionList.tsx` + `app/Sidebar.tsx` 의 sessions 슬롯 | 활성 세션 전환 + 비활성 세션 배지 (스트리밍 중 표시). |
| 세션 전환 시 스크롤 위치 기억 | `features/chat/components/ChatTile.tsx` | 세션별 scrollTop 보관. |

### 2.2 동시 스트리밍 (Phase 4)

- 여러 세션이 동시에 응답을 받을 수 있다 (각 세션 독립 `AbortController` — ../backend/runtime-ipc.md §1).
- 비활성 세션도 백그라운드에서 메시지 누적 (이전 세션 전환해도 스트리밍 중단되지 않음).
- 비활성 세션에 새 응답이 도착하면 Sidebar 에 배지 (예: 굵게).

---

