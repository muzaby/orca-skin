# Frontend Architecture — State Management (상태관리·Zustand·멀티세션)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [../backend/provider-runtime.md](../backend/provider-runtime.md), [rendering.md](./rendering.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 상태 관리

> **현재 (Phase 3++ / 0013)**: **Zustand 전환 + 멀티세션 외피 완료.** chat 은 `features/chat/store/chatStore.ts` 의 `sessions: Record<key, { session, live }>` + `activeKey` 외피(키 = sessionId, 새 채팅 = `NEW_CHAT_KEY` 슬롯 → `session.updated` 시 승격 — main TurnRegistry 와 대칭). Backend/Sessions/Projects/Cost 의 Context 4종도 feature 별 Zustand store 로 흡수(Provider 는 bootstrap-only). Tweaks/Skills/Agents 훅은 잔존(소규모 — 후속 검토).
> **채택된 결정(이행 완료)**: 단일 root 대신 **feature 별 store + chat 의 sessions Record** 로 수렴 — `chatReducer` 는 세션-단위 순수 함수로 유지하고 **store 가 `ev.sessionId` 키 라우팅을 담당**한다(reducer 테스트·불변식 보존, "액션에 sessionId 인자" 안의 대체 — 사용자 결정 2026-06-11, handoff 0013). 동시 스트리밍 *UX*(사이드바 배지·탭)는 후속 기능.

### 1.1 상태 분류

| 상태 종류 | 위치 | 영속화 | 예시 |
|---|---|---|---|
| 채팅 세션 상태 (커밋) | `features/chat/store/chatStore.ts` 의 `sessions[key].session` — 변경은 순수 `chatReducer` 경유(스토어가 키 라우팅) | **Phase 3 부터**: 로컬 SQLite 영속화 (../backend/persistence.md). 메모리 캐시 + DB SSOT 병행. | sessionId, messages, inflight, permissionMode |
| 채팅 스트리밍 라이브 버퍼 | `chatStore` 의 엔트리별 `live` 슬라이스 (transient — 턴 종료 시 리셋, 비활성 엔트리도 백그라운드 누적) | — | live.text(구 pendingDelta), live.reasoning |
| Tweaks (theme/density/sidebar/한도) | `shared/hooks/useTweaks` + electron-store | ✅ `orca:settings:get` / `set` | theme, density, sidebarCollapsed, **sidebarWidth** (180–480, default 248 — Phase 3+), **spendingLimitUsd**(0079) |
| 백엔드 설치 상태 | `features/backend/store/backendStore`(Zustand, 0013) | — | list, active, installerOpen |
| 세션/프로젝트 목록 | `features/{sessions,projects}/store/*Store`(Zustand, 0013) | — | list, loading |
| 사용량 미러 | `shared/stores/usageStore`(Zustand, 0186) | — | Main 이 완성한 `UsageLimitsView` 의 사본 — `global` + `providers[key]` + `providerUpdatedAt[key]` (전역 쪽 타임스탬프는 두지 않는다 — 전역 화면에 "마지막 업데이트" 표시가 없다). **주/월을 여기서 파생하지 않는다**(계산은 main 소유). 갱신은 `orca:cost:usageEvent` delta push 뿐이고, `boundary` scope 가 오면 provider 사본을 통째로 버린다(기간이 넘어가 전부 어제 기준이므로). `features/chat`(도넛)·`features/settings`(사용량 탭) 둘이 읽으므로 어느 feature 에도 둘 수 없다 — renderer boundaries 가 feature 교차를 막는다 |
| 업데이트 상태 | `features/update/store/updateStore`(Zustand, 0085/0086) | — | state(UpdateState), dialogOpen, actionError, dummyMode(dev) |
| 설정 모달 상태 | `features/settings/store/settingsModalStore`(Zustand, 0079~0081) | — | open, tab(`'general' \| 'usage' \| 'provider:<key>'` — 도넛 `>` → provider 탭 라우팅) |
| Skills 카탈로그 | `shared/hooks/useSkills` useState 캐시 | — | SkillInfo[] (부팅 1회 스캔) |
| Agents/provider 목록 | `shared/stores/agentStore`(Zustand, 0021) | — | agents, refresh — EngineCard·Composer/ModelMenu 싱크 |
| 자동완성 상태 | `ComposerInputController`의 deferred snapshot + `useSkillAutocomplete / useFileAutocomplete` | — | open, query, activeIndex, expected revision |
| 입력창 상태 | 항상 mount되는 `ComposerInputController` 로컬 `DraftSnapshot` | — | revision, text, selectionStart/End, composing |
| UI 인터랙션 (hover/focus/모달) | 컴포넌트 로컬 `useState` | — | DebugPanel 펼침 여부 |

### 1.2 chat store 구조 (실제 정의 요약)

`app/src/renderer/src/features/chat/store/chatStore.ts` + `reducer/chatReducer.ts` (필드 전수는 코드가 정본):

```typescript
interface ChatStoreState {
  sessions: Record<string, SessionEntry> // 키 = sessionId · 새 채팅 = NEW_CHAT_KEY('__new__')
  activeKey: string                      // 화면이 보여주는 엔트리 — selector 는 활성만 구독
}
interface SessionEntry {
  session: ChatState // 커밋 상태 — 변경은 전부 순수 chatReducer (store 가 키 라우팅 dispatch)
  live: LiveTurnState // 스트리밍 transient — { text, reasoning }. 델타는 reducer 에 닿지 않음
}
```

- **키 라우팅 (0013)**: IPC 이벤트는 `ev.sessionId` 로 해당 엔트리에 라우팅 — 비활성 세션의 턴이 백그라운드 누적되고 활성 UI 를 깨우지 않는다. sessionId 없는 이벤트는 활성 폴백, 미지 sessionId(엔트리 삭제 후 늦은 도착)는 폐기. `session.updated` 가 `NEW_CHAT_KEY` 엔트리를 sessionId 키로 승격(활성이면 activeKey 추종 — `useChatRouteSync` 방향 2 의 URL 승격 트리거).
- **구 `sessionCache`(snapshot Map) 폐기** — sessions Record 가 캐시를 흡수: 본 적 있는 세션 재진입은 IPC 없이 `activeKey` 전환. LRU cap 은 Future Scope.
- 스트리밍 델타 누적(구 `pendingDelta`/`pendingReasoning`)은 **reducer 에서 제거** — 엔트리별 `live` 슬라이스가 소유하고, `message.completed`(완성본 페이로드)·`telemetry`(잔여분 `COMMIT_PENDING_TEXT` 폴백) 시 parts 로 커밋된다.
- 컴포넌트 접근은 selector 훅(`useChatSession`/`useLiveText`/`useLiveReasoning` — 활성 엔트리 구독)과 안정 액션 묶음 `chatActions`, imperative read 는 `getActiveChatSession()` — `UseChat` 객체 전달/Context 전파 모델 폐기.
- 코얼레서는 단일 FIFO(세션 간 순서도 보존)이며 delta window를 `DeltaEvent[]`로 넘긴다. store는 batch 전체를 단일 `setState` transaction으로 반영해 flush당 notification을 1회로 제한한다. 세션 전환 시 dispose 하지 않는다(키 라우팅이 스테일 오염 방지).

#### 1.2.1 Git 패치와 댓글 범위

`gitSnapshot`과 `gitSnapshotRequest`는 세션 엔트리 안에서 현재 비교 범위와 조회 세대를 관리한다. 패치의 Git 비교 좌표와 요청 형식은 [IPC Git 계약](../../IPC_CONTRACT.md#26-b-git-컴포저-브랜치-칩)이 정본이다.

| 경계 | 현재 동작 | 구현 위치 |
|---|---|---|
| 새 대화 브랜치·워크트리 | 현재 cwd의 Git 저장소 확인 후 브랜치와 워크트리 체크박스를 함께 표시한다. 미확인·실패·비저장소에서는 묶음 전체를 숨긴다. 체크박스와 라벨 전체를 눌러 선택하며, 다른 작업 경로를 고르면 이전 격리 선택을 해제한다. | `components/CwdPanel.tsx`·`composer/BranchChip.tsx`·`composer/WorktreeToggle.tsx`, `chatReducer.ts`의 `SET_CWD` |
| composer diff 진입 | 현재 세션 요약이 없으면 변경량 버튼을 숨기고 저장소·브랜치·행 닫기를 유지한다. 요약이 준비되면 실제 0/0을 포함한 합계로 버튼을 표시한다. | `components/composer/GitRow.tsx`·`gitRowState.ts` |
| composer 저장소·브랜치 메뉴 | 저장소 이름은 GitHub 저장소 열기, 브랜치 이름은 복사·GitHub 브랜치 열기를 제공한다. 메뉴는 한 곳만 열리며 세션/cwd 또는 표시 이름/URL이 바뀌면 닫힌다. 원격 URL 없음과 분리 헤드는 해당 동작을 비활성으로 표시한다. URL 계약은 IPC 정본을 따른다. | `components/composer/GitRow.tsx`·`GitIdentityMenus.tsx` |
| 패치 조회·재사용 | 열린 변경사항 타일의 `useGitPatch`가 조회를 소유한다. 세션 키·저장소 좌표·요약 세대·비교 범위를 요청 키로 묶고 같은 키의 진행 중 조회를 중복 실행하지 않는다. 현재 범위의 패치만 보관하므로 같은 좌표·세대·범위에서 타일을 다시 열면 재사용한다. | `features/chat/hooks/useGitPatch.ts` |
| 비교 범위 변경 | 다른 범위를 고르면 패치와 작성 중 댓글을 즉시 비운다. 같은 범위를 다시 고르는 것은 상태를 바꾸지 않는다. | `chatReducer.ts`의 `SET_DIFF_COMPARISON` |
| 조회 세대 변경 | 새 좌표 또는 새 세대가 시작되면 기존 패치와 작성 중 댓글을 무효화한다. 같은 좌표·세대의 시작 알림은 멱등이다. | `chatReducer.ts`의 `BEGIN_GIT_SNAPSHOT_QUERY` |
| 늦은 응답 | 훅의 cleanup과 reducer의 좌표·세대·범위 검사가 지난 요청을 폐기한다. 같은 세대의 요약이 패치보다 늦게 도착해도 현재 범위가 유지되면 먼저 받은 패치를 보존한다. 요약에서 선택 커밋이 사라져 범위가 조정되면 패치와 작성 중 댓글을 비운다. | `useGitPatch.ts`, `chatReducer.ts`의 `RECEIVE_GIT_PATCH`·`RECEIVE_GIT_SNAPSHOT_SUMMARY` |
| 보관 중 댓글 | `DiffRequirementItem.commitSha`가 작성 범위를 기억하며 생략은 전체 모드다. 작성 기준은 실제 `patch.base`다. 같은 범위의 새 패치에만 재anchor하고 해당 범위의 줄에만 마커를 표시한다. 다른 범위로 이동해도 보관 중 항목과 anchor는 유지한다. UI wrapper와 wire anchor의 경계는 IPC 계약을 따른다. | `components/rightpanel/DiffTileContent.tsx`·`diffRequirements.ts`, `chatReducer.ts` |

요약 조회 세대는 renderer 모듈 수명의 단조 증가 번호다. 화면을 나갔다 돌아와 query owner가 다시 만들어져도 저장된 패치의 세대 번호를 재사용하지 않는다. 각 owner는 자신의 최신 요청만 수신한다.

### 1.3 Anti-pattern (하지 말 것)

- ❌ **입력창 텍스트를 전역 store 에 두기** — 매 키 입력마다 전역 리렌더 발생. draft snapshot은 persistent input controller의 로컬 state로 두고, shell·transcript에는 올리지 않는다.
- ❌ **컴포넌트에서 `window.orca` 직접 호출** — `features/<domain>/hooks/use*.ts` (Tweaks 는 `shared/hooks/useTweaks.ts`) 안에서만 IPC 호출. Zustand 전환 후에도 IPC 호출은 store action 안에 머무르며 컴포넌트는 selector / action 만 사용한다.
- ❌ **`features/` hook 에서 `window.orca.*` 직접 호출** — `shared/api/ipc.ts` 타입드 래퍼 (PR #29 에서 도입) 를 경유한다. 직접 호출은 ESLint 위반은 아니지만 테스트 진입점 / IPC 계약 변경 추적성을 망가뜨린다.
- ❌ **`useEffect` 안에서 store→다른 store 갱신** — 무한 루프 위험. reducer 의 단일 액션으로 묶을 것.
- ❌ **`messages` 배열을 mutate** — reducer 는 `.slice()` 후 새 배열 반환 (`chatReducer.ts` 패턴).
- ❌ **Tailwind 클래스에 raw hex 색상** — 시맨틱 토큰 (`bg-bg`, `text-ink`, `border-border`) 우선. 새 색이 필요하면 `tokens.css` 의 `@theme` 에 추가하고 세 테마 스코프 모두 채움.

### 1.4 Zustand 전환 (채택 결정)

> **확정 사항 (사용자 결정)**:
> 1. **단일 root store + `sessions: Record<sessionId, SessionState>` 슬라이스** 패턴 채택. `Map<sessionId, store>` factory 패턴은 폐기.
> 2. ~~도입 시점은 Phase 4 멀티세션 진입과 동시 / Phase 3 사전 마이그레이션 금지~~ → **개정 (2026-06-11, 0008)**: 스트리밍 렌더 파이프라인 재설계가 selector 구독을 요구해 **chat 스코프만 선행 도입**. 현 외피는 단일 세션(`session`+`live`)이며, Phase 4 에서 `sessions: Record<sessionId, …>` 외피 변경(+`ChatEvent.sessionId` 라우팅)과 전역 슬라이스(Tweaks/Backend/Skills) 흡수를 수행한다 — 액션이 "활성 세션 1개" 단위로 캡슐화돼 있어 기계적 치환.

#### 4.4.1 도입의 핵심 명분 — selector 기반 구독

Context + useReducer 도 외피 (`sessions: Record<sessionId, ChatState>`) 변경만으로 *동작* 은 한다. 도입 명분은 **선택적 리렌더**:

- Phase 4 동시 스트리밍 시, 비활성 세션의 델타 누적(구 `pendingDelta`)이 16ms 간격으로 갱신된다. 단일 Context 모델은 모든 consumer 를 리렌더 → 활성 세션 UI 의 입력 응답성 저하.
- Zustand 의 `useChatStore((s) => s.sessions[activeId].messages)` selector 만으로 해결. Context split / `useContextSelector` 서드파티 패치 의존을 피한다.

#### 4.4.2 store 외부 접근 활용

`useChatStore.getState().recv(ev)` 로 IPC `chat:event` 핸들러가 **React 트리 밖에서 직접 dispatch** 가능. `webContents.send('orca:chat:event', ev)` 는 ordered+lossless 1채널이므로, renderer 의 1개 핸들러가 `ev.data.sessionId` 로 라우팅해 해당 세션 슬라이스만 갱신한다.

#### 4.4.3 store 슬라이스 분리

| 슬라이스 | 위치 | 필드 |
|---|---|---|
| **세션별** | `sessions[key]: SessionEntry` | `session`(`ChatState`) / `live` / `subagentMeta` / `pendingSteer` |
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

- ✅ **(0008 완료)** `features/chat/store/chatStore.ts` 도입 — 단, reducer 를 폐기하지 않고 **순수 `chatReducer` 를 store 액션이 래핑**한다(테스트 자산·불변식 보존). Phase 4 에 `sessionId` 인자 추가.
- ✅ **(0008 완료)** 구 `useChat.ts` 의 useReducer/Context 패턴 → `useChatSession(selector)`/`chatActions` 로 교체 (`UseChat` 객체·`useChatContext` 폐기, `ChatProvider` 는 부트스트랩 effect 전용).
- ✅ **(0008 완료)** IPC onEvent 핸들러 → 코얼레서 → store `receive(ev)` 외부 dispatch.
- ✅ **(0013 완료)** Backend/Sessions/Projects/Cost Context → feature 별 Zustand store 흡수(Provider 는 bootstrap-only). 잔여: `shared/hooks/useTweaks` · `useSkills` · `useAgents` (소규모 — 후속 검토).
- `app/AppLayout.tsx` 의 props drilling (현 `pinnedSlot` / `sessionsSlot` / `footerSlot` — `app/hooks/useSidebarSlots.tsx`) 은 store 직접 구독으로 단순화 가능 — 단, `shared/ui/` 의 presentational 규칙 (layers.md §1.1) 은 유지.

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

> **현재 상태 (0011+0013)**: **멀티세션 외피 완료.** main 은 `SessionRuntimeRegistry`(`features/sessions/session-registry.ts`, sessionId 키 — 서로 다른 세션의 동시 턴 허용), renderer 는 `sessions: Record` store. 비활성 세션 턴이 백그라운드 누적된다. 남은 것은 *UX*(사이드바 배지·세션 탭·스크롤 위치 기억 등 §2.1 일부)뿐.

### 2.1 Phase 4 확장점

`docs/ARCHITECTURE.md` 가 다루던 Phase 4 anchor 를 이 절에 흡수:

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
