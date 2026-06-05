# Frontend Architecture — UX & Domains (UX 패턴·ApprovalCard·도메인·IPC 호출)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (FRONTEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [rendering.md](./rendering.md), [../backend/provider-runtime.md](../backend/provider-runtime.md), [../../IPC_CONTRACT.md](../../IPC_CONTRACT.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. UX 패턴

### 1.1 키보드 단축키

| 단축키 | 동작 | 구현 위치 |
|---|---|---|
| `/` | Composer 에서 Skill 자동완성 dropdown 트리거 | `SkillAutocomplete.tsx` |
| `@` | Composer 에서 파일 경로 자동완성 트리거 | `FileAutocomplete.tsx` |
| ↑ / ↓ | 자동완성 dropdown 내 navigate | 동일 |
| Tab / Enter | 자동완성 항목 선택 | 동일 |
| Esc | 자동완성 dismiss / 스트리밍 취소 | TBD (스트리밍 취소는 명시적 키 미정) |
| Enter | 메시지 전송 | `features/chat/components/ChatTile.tsx` Composer |
| Shift + Enter | 줄바꿈 | 동일 |

> 그 외 단축키 (Cmd/Ctrl+N 새 대화 등) 는 **현재 미구현**. PRD §11 OQ 추가 후보.

### 1.2 입력창 (Composer)

`features/chat/components/ChatTile.tsx` 의 Composer 섹션 + `features/chat/components/composer/` 부속:

- 멀티라인 textarea + 자동 높이 조절
- 3-chip 행: 첨부 / 현재 프레임 / Skill 선택 (`Popover` 기반 picker)
- `/skillname` 토큰을 **활성 스킬일 때만** 파란 chip 으로 mirror overlay 강조 (`HighlightedTextarea.tsx`, `knownSkillNames: ReadonlySet<string>`)
- `@filepath` 자동완성: 디렉토리 단계별 진입, quoted/plain 자동 감지, 공백 시 자동 wrapping
- 전송 후 입력창 비우기, 포커스 유지

### 1.3 로딩 / 에러 / 네트워크 상태

| 상태 | UI 표시 | 위치 |
|---|---|---|
| 요청 대기 | StatusLine "Thinking... (Ns · ~Mtokens)" | `shared/ui/StatusLine.tsx` |
| 스트리밍 중 | StatusLine + 응답 메시지에 누적 텍스트 | `features/chat/components/ChatTile.tsx` |
| 에러 (`recoverable: true`) | 메시지 영역에 에러 카드 | `features/chat/reducer/chatReducer.ts` 의 `state.error` |
| 에러 (`auth.expired`) | AuthExpiredModal (`claude /login` 안내) — `#app-frame-modal` 슬롯, backdrop 은 `#app-frame-overlay` 가 담당 (dom-architecture.md.5) | `features/backend/components/AuthExpiredModal.tsx` |
| CLI 설치 진행 | InstallerDialog (라인별 로그 + 수동 명령 복사) — 동일하게 `#app-frame-modal` + `#app-frame-overlay` backdrop | `features/backend/components/InstallerDialog.tsx` |
| 네트워크 단절 | TBD (전역 배너 미구현) | — |

### 1.4 접근성

- 모든 인터랙티브 요소 키보드 접근 가능 (Composer / Sidebar / TweaksPanel)
- 다크/라이트/쿨 3 테마 — `data-theme` 속성 기반
- ARIA 레이블 / 스크린리더 지원: 현재 부분 적용 (TBD — 체계적 audit 필요)

### 1.5 Sidebar Resize (Phase 3+)

- 드래그 영역: `aside.app-frame-sidebar` 우측 1px hairline (`app-frame-resize-handle`) — aside 의 자식이라 collapse 시 함께 사라진다.
- **2단 분리** (PR #30):
  - 일반 메커니즘 → `shared/hooks/useDragResize` (`getOrigin` / `min` / `max` / `disabled` / `onChange` 옵션. sidebar 라는 도메인을 모르며 tile separator 등에도 재사용 가능).
  - 도메인 특정 설정·적용 → `app/Sidebar.tsx` (`SIDEBAR_MIN/MAX/DEFAULT_WIDTH` 상수, `asideRef`, `setTweak('sidebarWidth', n)` onChange).
- 영속화: `Settings.sidebarWidth: number` (180–480, default 248). `shared/hooks/useTweaks` 가 부팅 시 hydrate + flush.
- collapsed 상태: handle 의 `data-state="hidden"` + `pointer-events-none`. 폭은 `w-14` (56px) 고정. `useDragResize` 의 `disabled: collapsed` 옵션으로 mousedown 무반응.
- 명명: aside 내부는 `resize-handle`, tile 사이는 `separator` 로 구분 (dom-architecture.md.4).

### 1.6 ApprovalCard 일반화 (설계 확정 / 구현 대기)

> **상태**: 📐 설계 확정 · 구현 대기. 정본 타입(`permission.requested`/`ApprovalResolution`/`NormalizedPermissionMode`)은 [../backend/provider-runtime.md](../backend/provider-runtime.md) §3 가 소유.

**① 설명.** 현재 plan 전용인 승인 UI 를 **모든 agent tool `permission.requested`** 를 받는 일반 ApprovalCard 로 확장한다. 카드는 `origin`(agent/app) · `risk` · `provider` 배지를 표시하고, 사용자 결정을 `ApprovalResolution` 2분기로 회신한다.

**② 예시.** Bash `rm -rf …` 승인 카드에서 (a) 인자를 고쳐 승인 → `allow{updatedInput}`, (b) "이 세션 동안 Read 자동 허용" 토글 → `allow{updatedPermissions}`, (c) 거부 + 에이전트 중단 → `deny{interrupt:true}`. **OpenCode 세션이면** `updatedInput`/`updatedPermissions` 가 boolean 으로 downcast 되어 손실됨을 카드에 배지로 명시(../backend/provider-runtime.md §3 손실표).

**③ 현재 코드 갭.** 스테이지 C2 (`2d4ab8f`) 로 `PlanApprovalCard` → `features/chat/components/ApprovalCard.tsx` 일반화 — `permission.requested` 의 `action.kind` 분기(plan_review 구현). `AskUserQuestionCard.tsx`(명확화 질문)는 별도 유지. **잔여 갭**: `tool_approval` 게이트는 seam(main 의 `makeCanUseTool` 이 Ask/Plan 외 전부 자동 allow 하므로 surface 되는 이벤트 없음, ../backend/provider-runtime.md §3 ③) · `pendingApprovals` 큐 미통합 · PermissionModeController(6종 런타임 전환) 미연동(현재 Composer `ModeMenu` 가 per-turn 2종 plan/acceptEdits 만).

**④ 연동.** `permission.requested` 이벤트 → reducer 가 `pendingApprovals` 큐에 적재 → ApprovalCard 가 Composer 입력창을 대체(현 `PlanApprovalCard` 패턴 재사용) → 결정은 PermissionBridge(../backend/provider-runtime.md §3)로 회신. 렌더링은 ToolRendererRegistry 의 `'approval'` kind(rendering.md §1.6).

---


## 2. 도메인 카탈로그 (Orca 고유)

`shared/navigation/routes.ts` 의 path 카탈로그 + Tweaks 패널을 화면 단위로 정리.

| ID / 컴포넌트 | 화면 라벨 | breadcrumb | Sidebar nav | Phase 상태 | 비고 |
|---|---|---|---|---|---|
| `chat` (`features/chat/components/ChatTile.tsx`) | 01 채팅 | (없음) | ✅ '새 대화' | **✅ Phase 1·2 활성** | 실 IPC 연결됨. Composer 자동완성·ToolCard·Markdown·CodeBlock 모두 구현. |
| `projects` (`features/projects/components/ProjectsScreen.tsx`) | 02 프로젝트 | 프로젝트 | ✅ '프로젝트' | **✅ Phase 3 활성** | 카드 그리드 + 생성 다이얼로그. ProjectDetail 은 `pages/ProjectLandingPage.tsx` 단일 파일. |
| `routines` (placeholder, 라우트 미정의) | 자동화 | — | ✅ '자동화' | **⏳ Phase 3++ 신설** | nav 항목만 추가, 라우트는 미정의 — `router.tsx` catch-all 이 `/new` 로 흡수. 후속 PR 에서 `pages/RoutinesPage.tsx` + 라우트 등록. |
| `engine` (`features/engine/components/EngineView.tsx`) | 03 엔진 & 모델 | 설정 · 엔진 & 모델 | ❌ (URL 직접 진입) | 🚧 Phase 1 mockup | nav 에서 빠짐 (Phase 3++ 재구성). 라우트 `/engine` 는 살아 있음. |
| `skills` (`features/skills/components/SkillsMcpView.tsx`) | 04 Skills / MCP | 설정 · Skills & MCP | ✅ 'Skills & MCP' | **✅ Phase 3++ MCP 활성** | nav 4번째 항목으로 노출. **MCP 섹션 실 연동** (`useMcpServers` + `orca:mcp:*` + `AddMcpServerModal` 추가/편집/토글/삭제, 전역 적용). Skills(좌측)·권한 섹션은 여전히 mockup. |
| (Tweaks Panel) `shared/ui/TweaksPanel.tsx` | (플로팅 패널 — `#app-frame-debug` 슬롯) | — | — | **✅ Phase 2+ 영속** | theme / density / sidebarCollapsed / sidebarWidth — electron-store 동기화. |
| (SearchModal) `app/SearchModal.tsx` | (모달 — `#app-frame-modal` 슬롯) | — | — | **✅ Phase 3++ 활성** | FTS5 대화 검색. Header 검색 버튼 → `searchOpen` lift → OverlayLayer conditional mount. |

> **CameraView** 와 **CapturesView** 는 `features/camera/` · `features/captures/` 에 존재하지만 도메인 카탈로그에서 제외 (GLOSSARY §3 사용자 결정). Sidebar nav 에도 없음.
>
> **Sidebar nav 재구성 (Phase 3++)**: nav 노출은 4-항목 (새 대화·프로젝트·자동화·Skills & MCP). engine/captures 는 *라우트가 살아 있으나 nav 미노출* — URL 직접 진입 또는 향후 nav 복귀 가능. (skills 는 MCP 지원 도입과 함께 nav 복귀.)

### 2.1 Future Scope 도메인의 IPC 연결 시점

- **Projects**: Phase 3+ 로컬 DB 도입 (../backend/persistence.md) 과 함께. 세션을 프로젝트별로 그룹화하는 메타데이터.
- **EngineSettings**: Phase 3+ 어댑터별 자격증명 저장 (../backend/security.md) 과 함께. base URL + API key 입력 UI.
- **SkillsMcp — MCP 서버**: ✅ Phase 3++ 구현 완료 — `orca:mcp:*` CRUD + `McpStore`(safeStorage) + `handleChatSend` 가 `query().options.mcpServers`+`allowedTools` 주입 (전역). 권한 섹션 + Skills 좌측 토글 + `options.permissionMode`/`canUseTool` 는 Phase 4+ (PRD OQ9 미정).

---


## 3. IPC 호출 (Renderer → Main)

### 3.1 호출 규칙

- 직접 `window.orca.*` 호출은 **금지**. 모두 `shared/api/ipc.ts` 의 타입드 래퍼 (`chatApi`/`backendApi`/`installApi`/`settingsApi`/`skillApi`/`fileApi`/`sessionApi`/`projectApi`/`windowApi`) 를 경유한다.
- 래퍼 호출은 `features/<domain>/hooks/use*.ts` 안에 캡슐화. 컴포넌트가 직접 호출 금지.
- 모든 IPC 호출은 타입이 있어야 한다 (채널 정의는 [IPC_CONTRACT.md](./IPC_CONTRACT.md) 참조).
- 에러는 throw 로 전달 (Main 측에서 직렬화된 `{ code, message, recoverable }` 객체).

### 3.2 스트리밍 응답 수신

`useChat()` 의 패턴 (`features/chat/hooks/useChat.ts` — `shared/api/ipc.ts` 의 `chatApi.onEvent` 경유):

```typescript
import { chatApi } from '../../../shared/api/ipc'

useEffect(() => {
  // 1회 구독
  const unsubscribe = chatApi.onEvent((ev) => {
    dispatch({ type: 'RECV_EVENT', payload: ev })
  })
  return unsubscribe  // cleanup 필수
}, [])
```

- main→renderer 의 `orca:chat:event` 채널은 ordered + lossless (Electron `webContents.send` 가 V8 microtask queue 위에서 보장).
- Renderer 가 일시적으로 늦어도 microtask queue 에 안전히 쌓임.
- 컴포넌트 언마운트 시 unsubscribe **필수**.

### 3.3 취소

```typescript
import { chatApi } from '../../../shared/api/ipc'
chatApi.cancel(sessionId)  // → window.orca.chat.cancel(sessionId) → ipcRenderer.invoke('orca:chat:cancel', ...)
```

Main 이 `AbortSignal` 을 SDK `query()` 에 전파 → 현재 inflight 만 중단. 진행 중이던 도구 호출은 SDK 가 정리.

### 3.4 채널 전체 목록

[IPC_CONTRACT.md](./IPC_CONTRACT.md) §2 참조. 현재 **총 31 채널** (정확 수치는 IPC_CONTRACT 가 SSOT — chat 3 · backend 1 · install 2 · settings 2 · skills 1 · files 1 · session 5 · project 5 · window 3 · search 1 · mcp 4 · runtime 3).

---

