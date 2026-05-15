# Orca — Architecture Document (v1)

> Electron 기반 Orca 앱이 **어떻게 구성되어 있고, 입력이 어느 경로로 흘러서 응답이 되는가** 를 설명한다. 기능 정의·API 스키마·데이터 모델은 `docs/TRD.md` 참조.

| 항목 | 값 |
|---|---|
| 문서 버전 | v1 (MVP 구현) |
| 입력 | `docs/TRD.md` (기능·스택), `app/CLAUDE.md` (모듈 레이아웃 운영 규칙), `project/electron/` (시각 기준) |
| 출력 대상 | 코드 작성 에이전트 / 코드 리뷰어 |
| 범위 | Phase 1 정적 구조 + 동적 흐름. Phase 2~4 확장점은 §11 anchor |

> **현 구현 상태 (2026-05-15)**
> Phase 1 시각 재현 + Phase 2 채팅 IPC 까지 완료. **§5.4 (ClaudeCodeAdapter 영구 stdin 세션) 와 §7 시퀀스 #1~#4 는 Phase 2.5 *목표 사양*** — 현재 코드는 Phase 2 의 매 턴 spawn / `--resume` 모델 (Legacy 박스) 로 동작한다. `OpencodeAdapter` (§5.5) 와 Settings store (§5.7) 는 **예약 사양** 으로 읽을 것. preload 가 실제 노출하는 채널은 TRD §5.2 의 "Phase 2 활성 6채널" 만 — `backend:select` / `settings:get` / `settings:set` 은 미노출 (`docs/TRD.md` §17 참조).

---

## 1. 문서의 목적과 범위

본 문서는 Orca 시스템의 **물리적 구조** (프로세스·모듈·의존성) 와 **데이터 흐름** (시퀀스·라이프사이클) 을 다룬다.

무엇을 기능으로 제공하고 어떤 API를 쓰는지는 `docs/TRD.md` 에서 정의하므로, 여기서는 언급하지 않는다. 구조가 변하더라도 TRD의 기능·API는 유지되어야 한다.

---

## 2. Process Model (electron-vite 3-process)

### 프로세스 구성

```
┌─────────────────────────────────────────────────────────────────┐
│  ELECTRON APP                                                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ RENDERER PROCESS (Chromium sandbox)                       │  │
│  │  entry: src/renderer/src/main.tsx (React)                 │  │
│  │  ├─ App (루트)                                             │  │
│  │  ├─ ChatShell (사이드바 + 메시지 + 컴포저)               │  │
│  │  ├─ MessageList (메시지 렌더링)                           │  │
│  │  ├─ TweaksPanel (테마/밀도/사이드바)                      │  │
│  │  └─ React Context reducer (ChatState)                    │  │
│  │                                                            │  │
│  │  IPC 진입점: window.orca.* (contextBridge 경유)            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                      ↕ ipcRenderer.invoke / on                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ PRELOAD SCRIPT (Node + browser bridge)                    │  │
│  │  entry: src/preload/index.ts                              │  │
│  │  contextBridge.exposeInMainWorld('orca', {...})          │  │
│  │  → window.orca.chat.* / backend.* / install.* / ...      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                      ↕ ipcMain.handle / on                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ MAIN PROCESS (Node.js · privileged)                       │  │
│  │  entry: src/main/index.ts                                 │  │
│  │  ├─ IpcRouter (채널 라우팅 + zod 검증)                    │  │
│  │  ├─ AdapterRegistry (두 어댑터 관리)                      │  │
│  │  │   ├─ ClaudeCodeAdapter (spawn + NDJSON)              │  │
│  │  │   └─ OpencodeAdapter (serve + SDK)                   │  │
│  │  ├─ Installer (CLI 설치 자동화)                          │  │
│  │  └─ Settings (Phase 1: in-memory, Phase 2+: store)      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                      ↕ child_process / HTTP                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↕
           HOST CLI: `claude` / `opencode` (사용자 PC)
```

### 프로세스 책임표

| 프로세스 | 런타임 | Entry 경로 | Vite sub-config | 책임 |
|---|---|---|---|---|
| **Renderer** | Chromium sandbox | `src/renderer/src/main.tsx` | `renderer` | React UI, 사용자 입력 수집, IPC 호출, 응답 표시 |
| **Preload** | Node + browser bridge | `src/preload/index.ts` | `preload` | `window.orca.*` 화이트리스트 노출, contextBridge 중개 |
| **Main** | Node.js (Electron `app`) | `src/main/index.ts` | `main` | 모든 특권 작업 (IPC 라우팅, 어댑터 관리, 파일 I/O, CLI spawn, 설치 자동화) |

### 보안 베이스라인 (BrowserWindow 옵션)

| 설정 | 값 | 근거 |
|---|---|---|
| `contextIsolation` | `true` | Renderer와 Preload를 격리, 전역 객체 분리 |
| `nodeIntegration` | `false` | Renderer가 Node API 직접 접근 금지 |
| `sandbox` | `true` | Renderer 프로세스 샌드박스화 (OS 레벨) |
| `webSecurity` | `true` | 기본값 유지 (CORS, 외부 리소스 제한) |
| **Preload whitelist** | `contextBridge.exposeInMainWorld('orca', {...})` | 명시된 IPC API만 노출 (NodeJS require 등 제외) |
| **외부 콘텐츠 로드** | 금지 | 마크다운은 react-markdown의 XSS sanitize 의존 |
| **API 키 저장** | 앱은 미저장 | OAuth/API 키는 CLI가 관리 (디스크 암호화는 OS에 위임) |

---

## 3. Preload Bridge (contextBridge)

### Namespace 매핑

**Phase 2 활성 (preload 화이트리스트 — 6채널):**

```
window.orca.chat.send(...)              ──► ipcRenderer.invoke('orca:chat:send', ...)
window.orca.chat.onEvent(cb)            ◄── ipcRenderer.on('orca:chat:event', cb)
window.orca.chat.cancel(...)            ──► ipcRenderer.invoke('orca:chat:cancel', ...)
window.orca.backend.list()              ──► ipcRenderer.invoke('orca:backend:list')
window.orca.install.start(...)          ──► ipcRenderer.invoke('orca:install:start', ...)
window.orca.install.onStatus(cb)        ◄── ipcRenderer.on('orca:install:status', cb)
```

**예약 (사용처 도입 PR 에서 재노출 — TRD §17):**

```
window.orca.backend.select(...)         — 단일 백엔드라 호출자 없음
window.orca.settings.get/set(...)       — Phase 2+ electron-store 영속화 도입 시
```

### Preload 구현 원칙

- `src/preload/index.ts` 에서 `contextBridge.exposeInMainWorld('orca', api)` 호출
- `api` 객체는 정확히 위 namespace 포함, 그 외는 노출 금지
- NodeJS require, fs, process 등 일절 노출 금지
- Renderer에서 `window.orca` 로만 IPC 접근 가능 (ipcRenderer 직접 import 불가)

### 타입 정의

**renderer 측** (Phase 2 활성 — preload `OrcaApi` 정의는 `src/preload/index.ts`):
```typescript
declare global {
  interface Window {
    orca: {
      chat: {
        send(req: { sessionId: string | null; text: string }): Promise<void>;
        onEvent(handler: (ev: ChatEvent) => void): () => void;
        cancel(sessionId: string): Promise<void>;
      };
      backend: {
        list(): Promise<{ backends: Backend[]; active?: Backend }>;
        // select(backend): Promise<void>           — 예약. 단일 백엔드라 미노출
      };
      install: {
        start(backend: Backend): Promise<void>;
        onStatus(handler: (st: InstallStatus) => void): () => void;
      };
      // settings: { get, set }                    — 예약. Phase 2+ electron-store 도입 시 재노출
    };
  }
}
```

자세한 API 시그니처는 TRD §5.3 참조.

---

## 4. Module Layout (디렉토리 트리)

electron-vite 3-config 환경의 정확한 모듈 디렉토리. 빌드 시 각 sub-config가 별도 번들 생성.

```
app/
├── electron.vite.config.ts           ← main/preload/renderer 3 sub-config 정의
├── electron-builder.yml              ← 패키징 설정
├── tsconfig.json                     ← project references (node + web 분리)
├── tsconfig.node.json                ← main + preload (Node.js target)
├── tsconfig.web.json                 ← renderer (DOM target)
├── package.json
│
└── src/
    │
    ├── main/                         ← Node.js 진입점
    │   ├── index.ts                  ├─ Electron app 부트
    │   │                             ├─ BrowserWindow 생성
    │   │                             ├─ IpcRouter 초기화
    │   │                             ├─ AdapterRegistry 초기화
    │   │                             └─ 라이프사이클 관리
    │   │
    │   ├── ipc/
    │   │   └── router.ts             ├─ ipcMain.handle('orca:*', ...) 등록
    │   │                             ├─ zod 입력 검증
    │   │                             ├─ Adapter 디스패치
    │   │                             └─ 응답/스트림 webContents.send
    │   │
    │   ├── adapters/
    │   │   ├── types.ts              ├─ Backend 타입
    │   │   │                         ├─ ChatEvent 정의
    │   │   │                         ├─ SessionAdapter 인터페이스
    │   │   │
    │   │   ├── registry.ts           ├─ AdapterRegistry 클래스
    │   │   │                         ├─ isInstalled() 병렬 호출
    │   │   │                         └─ active 백엔드 결정
    │   │   │
    │   │   ├── claude-code.ts        ├─ ClaudeCodeAdapter 구현
    │   │   │                         ├─ spawn('claude', ...) 관리
    │   │   │                         ├─ stdout NDJSON 파싱
    │   │   │                         └─ sessionId 추출
    │   │   │
    │   │   └── opencode.ts           ├─ OpencodeAdapter 구현
    │   │                             ├─ spawn('opencode serve') 관리
    │   │                             ├─ SDK @opencode-ai/sdk 호출
    │   │                             └─ SSE 정규화
    │   │
    │   ├── installer/
    │   │   └── index.ts              ├─ CLI 설치 자동화
    │   │                             ├─ Node.js/npm/curl 의존성 점검
    │   │                             ├─ 설치 명령 실행
    │   │                             └─ 라인 단위 상태 이벤트
    │   │
    │   └── settings/
    │       └── store.ts              ├─ 설정 저장/로드
    │                                 ├─ Phase 1: in-memory Map
    │                                 └─ Phase 2+: electron-store
    │
    ├── preload/                      ← Electron preload script
    │   ├── index.ts                  ├─ contextBridge.exposeInMainWorld
    │   │                             └─ window.orca API 정의
    │   │
    │   └── index.d.ts                └─ 타입 선언 (renderer가 import 가능)
    │
    ├── renderer/
    │   ├── index.html                ← React 앱 마운트 포인트 (CSP + Google Fonts link)
    │   │
    │   └── src/
    │       ├── main.tsx              ├─ React entrypoint (createRoot) + 글로벌 CSS import
    │       │
    │       ├── App.tsx               ├─ 루트 셸
    │       │                         ├─ Tweaks state (theme/density/sidebarCollapsed)
    │       │                         ├─ V1 팔레트 mutation + key bump 로 트리 remount
    │       │                         └─ 화면 라우팅 (chat/projects/engine/skills/captures)
    │       │
    │       ├── styles/
    │       │   ├── tokens.css        ├─ CSS 변수 토큰 (cream/ink/rust 팔레트, 폰트)
    │       │   └── app.css           └─ 글로벌 셸 (.desktop / .taskbar / .app-window)
    │       │
    │       ├── components/atoms/    ← mockup 공용 atoms (Phase 1)
    │       │   ├── Icon.tsx              ├─ SVG path 아이콘 (32종)
    │       │   ├── WinControls.tsx       ├─ 최소화/최대화/닫기
    │       │   ├── Avatar.tsx            ├─ 사용자/Claude/opencode 아바타
    │       │   ├── Status.tsx            ├─ 색점 + 라벨
    │       │   ├── BayerPattern.tsx      ├─ 카메라 뷰포트 (Bayer 패턴 시뮬레이션)
    │       │   └── Histogram.tsx         └─ RGB 히스토그램 SVG
    │       │
    │       └── app/                  ← Phase 1 화면 컴포넌트 (mockup 1:1 재현)
    │           ├── theme.ts          ├─ THEME_PALETTES / DENSITY_FONT / V1 가변 팔레트
    │           ├── screens.ts        ├─ 화면 ID·라벨·breadcrumb 카탈로그
    │           ├── useTweaks.ts      ├─ Tweaks state hook (in-memory)
    │           │
    │           ├── Frame.tsx         ├─ V1Frame — app-frame 컨테이너
    │           ├── Titlebar.tsx      ├─ Orca 브랜드 + breadcrumb + WinControls
    │           ├── Sidebar.tsx       ├─ 새 대화·메뉴·프로젝트·최근 대화·엔진 footer
    │           │                     │   (collapsed/expanded 두 분기)
    │           │
    │           ├── ChatPane.tsx      ├─ 메시지·툴콜·테이블·Composer
    │           ├── CameraPane.tsx    ├─ Bayer 뷰포트·히스토그램·슬라이더·메트릭·캡처 버튼
    │           ├── Projects.tsx      ├─ 프로젝트 카드 그리드
    │           ├── EngineSettings.tsx├─ 엔진/모델 카드 리스트
    │           ├── SkillsMcp.tsx     ├─ Skills/MCP/권한 패널
    │           │
    │           ├── CapturesPlaceholder.tsx├─ 캡처 화면 placeholder (Future Scope)
    │           │
    │           └── TweaksPanel.tsx   └─ Tweaks UI 셸 + TweakSection/Radio/Toggle
    │
    │       (Phase 2 추가 예정: Composer/MessageList/ToolCallCard/Markdown/state.ts —
    │        IPC 채널 + 어댑터와 함께 도입)
    │
    └── shared/                       ← 메인 ↔ 렌더러 공유
        ├── protocol.ts               ├─ zod 스키마 정의
        │                             ├─ SendChatMessage, ChatEvent, InstallStatus 등
        │                             └─ IPC 메시지 검증 규칙
        │
        └── i18n/
            └── ko.ts                 ├─ 한국어 라벨
                                      ├─ UI 텍스트 전체
                                      └─ 에러 메시지
```

### 모듈 간 import 규약

- **Renderer** → `shared` (타입·i18n) 만. `main` 절대 import 금지.
- **Main** → `shared` (타입·protocol) 만. `renderer` 절대 import 금지.
- **Preload** → `shared` (타입만) 또는 standalone. NodeJS require 사용 가능.
- **Shared** → 모듈 간 의존성 없음 (양쪽이 안전하게 import 가능).

---

## 5. Main Process Internals

### 전체 구조 다이어그램

```
IpcRouter (메인 엔트리)
  ├─ (모든 orca:* 채널 등록)
  │
  ├─ orca:chat:send ──► AdapterRegistry.active.sendMessage
  │                    ↓ (AsyncIterable<ChatEvent> 반환)
  │                    ► webContents.send('orca:chat:event', ev)
  │
  ├─ orca:backend:list ──► AdapterRegistry.list()
  │
  ├─ orca:backend:select ──► AdapterRegistry.select(backend)
  │
  ├─ orca:install:start ──► Installer.start(backend)
  │                        ↓ (라인 단위 진행)
  │                        ► webContents.send('orca:install:status', st)
  │
  └─ orca:settings:* ──► Settings.get / set
```

### 5.1 IpcRouter

**역할**:
- 모든 `orca:*` 채널 `ipcMain.handle` 등록
- 요청 페이로드 zod 검증 (`protocol.ts` 스키마)
- 어댑터 / 설치자 / 설정 저장소로 디스패치
- 응답 또는 스트림을 렌더러로 회신

**구현**:
```typescript
// src/main/ipc/router.ts
ipcMain.handle('orca:chat:send', async (event, req) => {
  const validated = SendChatMessageSchema.parse(req);
  const adapter = registry.getActive();
  for await (const ev of adapter.sendMessage(...)) {
    event.sender.send('orca:chat:event', ev);
  }
});
```

### 5.2 AdapterRegistry

**책임**:
- 시작 시 두 어댑터 `isInstalled()` **병렬** 호출 → 설치 상태 매트릭스 생성
- 활성 백엔드 결정 (자동 / 사용자 선택 / OQ7)
- `getActive()` → 현재 어댑터 반환
- `list()` → 설치 상태 배열 반환

**라이프사이클**:
```
앱 부트 ──► AdapterRegistry() ──► isInstalled() 병렬
                                   ├─ ClaudeCodeAdapter.isInstalled()
                                   └─ OpencodeAdapter.isInstalled()
                                   
결과: { 'claude-code': true, 'opencode': false } 등

활성 백엔드 결정:
  - 둘 다 true: Renderer 선택지 또는 OQ7
  - 한쪽 true: 자동 선택
  - 둘 다 false: 인스톨러 트리거

활성 어댑터 → registry.active 또는 registry.getActive()
```

### 5.3 SessionAdapter 공통 인터페이스

```typescript
interface SessionAdapter {
  isInstalled(): Promise<boolean>;
  
  install(): Promise<void>;  // 설치 실행, 예외 발생 시 실패
  
  sendMessage(
    sessionId: string | null,   // null = 새 세션
    text: string,               // 사용자 입력
    cwd: string,                // 작업 디렉토리
  ): AsyncIterable<ChatEvent>;  // 이벤트 스트림
  
  // Phase 3+ (선택적)
  listSessions?(): Promise<SessionInfo[]>;
  loadSession?(id: string): Promise<ChatEvent[]>;
}
```

어댑터는 이 인터페이스 구현 → 내부 구현 방식은 자유 (spawn vs HTTP vs 다른 방식).

### 5.4 ClaudeCodeAdapter 내부 구현 (Phase 2.5 — 영구 stdin 세션)

> 본 절은 어댑터의 *내부 구조*(상태 머신·파서·버퍼·환경변수 전달)만 다룬다. CLI 외부 인터페이스(플래그·NDJSON 이벤트 스키마·세션 재개) 는 [`claude-code-spec.md`](./claude-code-spec.md) 가 단일 출처. 정규화된 `ChatEvent` 매핑 표는 spec §4 끝의 채택 박스 참조.

**상태 머신**:

```
                     sendMessage(sid=null, text)   ← lazy: 첫 user 메시지가 트리거
                                │
                                ▼
   [ no child ]  ─── spawn (lazy) ───►  [ spawning ]
        ▲                                       │
        │                                       │ first system/init 이벤트
        │                                       │ (session_id → lastSessionId)
        │                                       ▼
        │                            [ ready (idle 타이머 ON, 5min) ]
        │                                   │   ▲
        │                       stdin write │   │ result 이벤트 (정상 답변 완료)
        │                       (idle 타이머 │   │ → idle 타이머 RESET 후 ON
        │                        OFF / 정지) │   │
        │                                   ▼   │
        │                       [ in-turn (idle 타이머 OFF) ]
        │                                   │     ※ 여기 5분이 지나도 회수 안 함
        │                                   │       (긴 응답·도구 호출은 idle 이 아님)
        │ idle timeout (5min, ready 상태에서만)
        │ → child.stdin.end() → grace 2s → SIGTERM
        ├──────── child crash / stderr 401 ──────┤
        ▼                                        │
   [ no child + lastSessionId 보존 ] ◄── kill ───┘
        │
        │ sendMessage(sid=<saved>, text)   ← lazy 재개: 다음 user 메시지가 트리거
        ▼
   spawn (with `--resume <sid>`) → [ spawning ] (위 흐름 반복)
```

핵심:
- **child 는 일시적, sessionId 는 영속적**. ChatSession 자체는 sessionId 1개로 정의되고 child 는 spawning/ready/in-turn 사이를 오가며 idle/crash 시 폐기·재생성된다.
- **idle 타이머는 `[ready]` 상태에서만 동작**. `[in-turn]` 동안에는 OFF — 어시스턴트가 5분 넘게 스트리밍·도구 호출을 해도 자원 회수 대상이 아니다. 회수는 *정상 답변 완료(`result` 이벤트) 이후* 사용자 응답이 5분간 없을 때만.
- **lazy 의 의미**: 세션이 만들어졌거나 앱이 막 켜졌다는 사실만으로는 spawn 하지 않는다. 사용자가 *그 세션에서 첫 user 메시지를 실제로 보내는 순간* 에 spawn — 첫 spawn 과 idle 후 재spawn 이 같은 코드 경로(lazy)를 공유.

**spawn args** (Phase 2.5 — 세션당 1회, lazy):
```
[binPath, '-p',
 '--input-format', 'stream-json',
 '--output-format', 'stream-json',
 '--verbose',
 '--include-partial-messages',
 ...(lastSessionId ? ['--resume', lastSessionId] : [])]
```
- 사용자 텍스트는 argv 에 *없다*. 매 턴 stdin 에 NDJSON 한 줄 write.
- `--resume` 은 fallback (idle 회수 후 재개 / crash recovery / 재로그인) 일 때만 추가.

**stdin write (매 턴)**:
```typescript
child.stdin.write(JSON.stringify({
  type: 'user',
  message: { role: 'user', content: [{ type: 'text', text }] }
}) + '\n')
```

**stdio 정책**:
- `stdio: ['pipe', 'pipe', 'pipe']`. stdin 도 pipe — child 가 살아있는 동안 stdin 을 닫지 않는다 (Phase 2 의 `'ignore'` 에서 변경). EOF 는 idle 회수 / 세션 종료 시점에만 보낸다.

**Idle 타이머**:
- `IDLE_TIMEOUT_MS = 5 * 60 * 1000`.
- `result` 이벤트 수신 직후 `setTimeout(reclaim, IDLE_TIMEOUT_MS)`.
- stdin write 직전 `clearTimeout` 으로 타이머 정지 — `in-turn` 동안 OFF.
- 만료 시: `child.stdin.end()` → 2초 grace timer → 미종료면 `child.kill('SIGTERM')` → child 폐기 + `lastSessionId` 보존.

**Windows 분기 — `.cmd` shim 회피** (Phase 2 와 동일, 변경 없음):
- POSIX: `which claude` → 절대경로 그대로 spawn (`shell: false`).
- Windows: `npm prefix -g` 결과 하위에서 `claude.exe` 를 재귀 검색 → 절대경로 spawn (`shell: false`). `.cmd` shim 을 우회하는 이유는 cmd 인자 파서가 `\n` 을 만난 뒤 *나머지 argv 까지 truncate* 하기 때문 — Phase 2.5 에서는 user 텍스트가 argv 에 없으므로 멀티라인 truncation 위험은 사라졌지만, 절대경로 / `shell: false` 정책은 **보안 이유로 유지** (셸 메타문자 인젝션 표면 제거).

**`install()` 의 npm spawn 만 예외**:
- Windows 에서 `npm.cmd` shim 만 존재해 `shell: IS_WIN` 유지. 인자가 정적이고 special chars 없으므로 truncation 위험 없음.

**stdout NDJSON 파싱**:
- 영구 child 의 stdout 을 라인 단위 분할 (Phase 2 와 동일한 `drainLines` / `normalizeLine` 재사용).
- 부분 라인은 버퍼에 보관, 다음 chunk와 합쳐서 파싱.
- 한 child 의 stdout 위에서 여러 턴이 순차로 흐르므로 `result` 이벤트마다 *현재 턴 listener 만* 해제하고 child 는 살려둔다.
- 파싱 실패 라인 → `error / protocol.parse` 이벤트.

**sessionId 추출**:
- 첫 spawn 의 첫 stdout 이벤트 (`system` / `init` 타입)에서 `session_id` 필드 추출.
- `ChatEvent { type: 'init', sessionId: <extracted> }` 로 정규화.
- Renderer 는 변수에 저장. 어댑터도 `lastSessionId` 갱신 — child 가 죽어도 보존.

**인증 만료 감지**:
- stdout/stderr 전체 스트림에서 `401` / `OAuth` / `expired` 패턴 매칭.
- 감지 시 `error / auth.expired` 이벤트 발행 + child 종료 (좀비 잔존 방지). `lastSessionId` 는 보존 → 재로그인 후 다음 메시지에 lazy 재spawn + `--resume`.

**환경변수 전달**:
- spawn의 `env` 옵션에 사용자 PATH·HOME 포함.
- CLI가 `~/.claude/projects/<cwd>/` 에 jsonl 저장 → fallback 재spawn 시 `--resume <lastSessionId>` 로 복원.

> **Legacy (Phase 2)**: 매 턴 새 spawn + `-p <text>` argv + `stdio: ['ignore', 'pipe', 'pipe']` 모델은 §5.4 의 Legacy 박스로 보존되며 *crash recovery / 단발성 도구 호출* 용으로만 사용한다. 완전 제거는 Phase 2.5 안정화 이후 별도 결정.

### 5.5 OpencodeAdapter 내부 구현 *(예약 사양 — Phase 1/2 미구현)*

**서버 라이프사이클**:
```
앱 부트 (opencode 활성)
  ├─ spawn('opencode serve --port 0')
  ├─ stdout 첫 라인: 'Listening on http://127.0.0.1:<port>' 파싱
  ├─ 5초 타임아웃: GET /health 확인
  │
  ├─ (정상 → 준비 완료)
  │
  └─ 앱 종료
     ├─ child.kill('SIGTERM')
     ├─ 5초 대기
     └─ (여전히 살아있으면) child.kill('SIGKILL')
```

비정상 종료 (exit code ≠ 0) 시 **1회 재시작 시도**, 이후 사용자 에러.

**SDK 호출**:
```typescript
import { OpencodeClient } from '@opencode-ai/sdk';
const client = new OpencodeClient({ 
  baseURL: `http://127.0.0.1:${port}` 
});

// 새 세션 (또는 sessionId=null)
const { id } = await client.session.create({ cwd });

// 메시지 전송 + 스트림
for await (const ev of client.session.send({ id, text, stream: true })) {
  yield normalize(ev);  // ChatEvent로 매핑
}
```

**SSE→ChatEvent 정규화**:
- opencode의 SSE 이벤트 타입 → ChatEvent 타입 1:1 매핑
- 필드명·형태 다를 수 있음 → adapter가 책임져서 정규화

### 5.6 Installer 모듈

**IPC 도메인**: `orca:install:*`

**프로세스**:
```
사용자 IPC orca:install:start
  ↓
Installer.start(backend)
  ├─ 의존성 점검 (Node.js/npm/curl 등)
  ├─ 설치 명령 선택 (npm vs curl)
  ├─ child_process.spawn 실행
  ├─ 라인 단위 stdout 읽기
  ├─ webContents.send('orca:install:status', { ... })
  └─ exit → 완료/실패
```

각 라인은 진행률 또는 상태 업데이트 (예: "Installing...", "Done!", "Error: ...").

### 5.7 Settings 모듈

**Phase 1**: in-memory Map (메모리만, 앱 종료 시 소실)

**Phase 2+**: `electron-store` 로 교체 (저장소 경로: `~/Library/Application Support/orca/` 등)

**인터페이스 동일 유지**:
```typescript
interface Settings {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}
```

키 카탈로그: `theme`, `density`, `sidebarCollapsed`, `lastBackend`, `lastSessionId` (Phase 2+), ...

---

## 6. Renderer Process Internals

### 6.1 상태 컨테이너

**위치**: 리듀서 `src/renderer/src/state/chatReducer.ts` + 구독 훅 `src/renderer/src/state/useChat.ts`

**구조**:
```typescript
// ChatContext
const [state, dispatch] = useReducer(chatReducer, initialState);
// state: ChatState { sessionId, backend, messages, pendingDelta, inflight, error }
```

**액션**:
- `SEND_USER_MESSAGE(text)` → message 배열 추가, `inflight = true`
- `RECV_EVENT(ev)` → 이벤트 타입별 상태 갱신 (delta 누적, message 완성, error 표시)
- `NEW_CHAT` → sessionId 초기화, messages 비우기
- `CANCEL_CHAT` → inflight 해제

### 6.2 IPC 구독 패턴

**App.tsx mount**:
```typescript
useEffect(() => {
  // 1회 구독
  const unsubscribe = window.orca.chat.onEvent((ev) => {
    dispatch({ type: 'RECV_EVENT', payload: ev });
  });
  return unsubscribe;  // cleanup
}, []);
```

Renderer는 `onEvent` 핸들러를 **1번만** 등록. Main이 모든 `orca:chat:event` 를 이 핸들러로 전달.

### 6.3 스트리밍 렌더링 메커니즘

**흐름**:
```
1. 사용자 입력 → Composer → dispatch(SEND_USER_MESSAGE)
2. window.orca.chat.send(...) invoke (비동기)
3. Main: spawn('claude', ...) / opencode SDK 호출
4. 첫 stdout/SSE line:
   ├─ 'init' 이벤트 → RECV_EVENT 액션
   ├─ sessionId 저장
   └─ Renderer 업데이트

5. 이어서 'assistant_delta' 스트림:
   ├─ 각 라인 → RECV_EVENT
   ├─ pendingDelta += data.text
   ├─ debounce 16ms (60Hz 리렌더)
   └─ 화면에 토큰 누적 표시

6. 마지막 'assistant_message':
   ├─ RECV_EVENT
   ├─ pendingDelta → 최종 message로 교체
   └─ 완성 상태로 전환

7. 'result' 또는 'error':
   ├─ RECV_EVENT
   ├─ inflight = false
   └─ 입력 다시 활성화
```

**debounce 16ms**: 빈번한 리렌더를 피하기 위해 delta 누적은 진행하지만 UI 업데이트는 16ms 마다만 실행.

### 6.4 Tweaks 적용 흐름

**App.tsx** (useTweaks hook + useEffect):
```typescript
const [t, setTweak] = useTweaks<Tweaks>(TWEAK_DEFAULTS);

// 테마 → <html data-theme="classic|dark|cool"> 갱신
useEffect(() => {
  document.documentElement.dataset.theme = t.theme;
}, [t.theme]);

// 밀도 → root font-size (rem 기반 Tailwind spacing 이 함께 cascade)
useEffect(() => {
  document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px';
}, [t.density]);
```

**Cascade**: `data-theme` 속성 변경 → `tokens.css` 의 `[data-theme="dark"] { --color-bg: ...; ... }` 스코프가 활성화 → Tailwind utility 가 재해석된 CSS 변수값을 즉시 반영. 트리 remount 불요.

### 6.5 Tailwind v4 + 디자인 토큰 통합

Tailwind CSS v4 는 `tailwind.config.js` 없이 **CSS-first** 로 동작한다. 토큰은 `styles/tokens.css` 의 `@theme` 블록에서 선언하고, 테마 스코프는 `[data-theme]` 선택자로 override 한다.

**styles/tokens.css** (발췌):
```css
@theme {
  /* 기본값 (classic) — Tailwind utility 생성의 원천 */
  --color-bg: #fbf9f4;
  --color-sidebar: #f3eee3;
  --color-ink: #29261b;
  --color-ink2: #6b6452;
  --color-rust: #c96442;
  /* ... */
}

[data-theme="dark"] {
  --color-bg: #1c1a16;
  --color-sidebar: #161410;
  --color-ink: #f0eadd;
  /* ... */
}

[data-theme="cool"] {
  /* ... */
}
```

**컴포넌트**:
```tsx
<div className="bg-bg text-ink px-4 py-2 rounded">
  {/* bg-bg → --color-bg → data-theme 스코프에 따라 동적 변환 */}
</div>
```

---

## 7. Data Flow (Sequence Diagrams)

### 시퀀스 #1: 메시지 전송 1턴 (sessionId 미발급, lazy spawn)

```
사용자 입력 (Composer)
  │
  ├─ "hello"
  │
  ▼
Composer → dispatch(SEND_USER_MESSAGE("hello"))
  │
  ├─ message 배열 추가: [{ role: 'user', content: 'hello' }]
  ├─ inflight = true
  │
  ▼
Composer [전송] 버튼 클릭
  │
  ├─ window.orca.chat.send({ sessionId: null, text: "hello" })
  │
  ▼ (IPC 경계)
  │
  ▼
ipcMain.handle('orca:chat:send', async (event, req) => {
  const validated = SendChatMessageSchema.parse(req);
  const adapter = registry.getActive();

  for await (const ev of adapter.sendMessage(null, "hello", cwd)) {
    event.sender.send('orca:chat:event', ev);
  }
})
  │
  ├─ ClaudeCodeAdapter.sendMessage(null, "hello", cwd)
  │   ├─ child 가 null → lazy spawn:
  │   │   spawn('claude', [
  │   │     '-p',
  │   │     '--input-format',  'stream-json',
  │   │     '--output-format', 'stream-json',
  │   │     '--verbose',
  │   │     '--include-partial-messages'
  │   │   ])  ※ user 텍스트는 argv 에 없음. lastSessionId 도 null 이라 --resume 없음
  │   │
  │   ├─ stdin write:
  │   │   {"type":"user","message":{"role":"user","content":[{"type":"text","text":"hello"}]}}\n
  │   │
  │   ├─ stdout 라인 1: { "type": "system", "session_id": "sess_123" }
  │   │   ├─ parse → normalize
  │   │   ├─ lastSessionId = 'sess_123' (어댑터 보유)
  │   │   └─ yield ChatEvent { type: 'init', sessionId: 'sess_123' }
  │   │
  │   ├─ stdout 라인 2: { "type": "assistant_delta", "text": "I " }
  │   │   └─ yield ChatEvent { type: 'assistant_delta', text: 'I ' }
  │   │
  │   ├─ ... (이어서 delta 스트림)
  │   │
  │   └─ stdout 라인 N: { "type": "result", ... }
  │       ├─ yield ChatEvent { type: 'result' }
  │       ├─ idle 타이머 START (5min, ready 상태)
  │       └─ child 는 살아있는 채로 다음 user write 대기
  │
  └─ event.sender.send('orca:chat:event', ...)  (각 ev 마다)

  ▼ (IPC 경계)
  │
  ▼
Renderer: window.orca.chat.onEvent(cb)
  │
  ├─ ev1: { type: 'init', sessionId: 'sess_123' }
  │   ├─ dispatch(RECV_EVENT(ev1))
  │   └─ state.sessionId = 'sess_123'
  │
  ├─ ev2..N-1: assistant_delta
  │   └─ pendingDelta 누적 + 16ms debounce 리렌더
  │
  └─ evN: { type: 'result' }
      ├─ dispatch(RECV_EVENT(evN))
      ├─ inflight = false
      └─ [전송] 버튼 다시 활성화
```

### 시퀀스 #2: 메시지 전송 2턴 (살아있는 child 의 stdin 재사용 — spawn 없음)

```
(시퀀스 #1 직후. sessionId = 'sess_123', 어댑터 child 살아있음, idle 타이머 ON)

사용자 입력: "what's next?"
  │
  ├─ window.orca.chat.send({ sessionId: 'sess_123', text: "what's next?" })
  │
  ▼ (IPC)
  │
  ▼
ClaudeCodeAdapter.sendMessage('sess_123', "what's next?", cwd)
  │
  ├─ child 살아있음 → spawn 없음. --resume 도 없음.
  │
  ├─ idle 타이머 STOP (clearTimeout — in-turn 진입)
  │
  ├─ stdin write:
  │   {"type":"user","message":{"role":"user","content":[{"type":"text","text":"what's next?"}]}}\n
  │
  ├─ stdout: { type: 'assistant_delta', text: "Building on " }
  │   └─ yield
  │
  ├─ ... (이어서 response)
  │
  └─ stdout 라인 N: { type: 'result' }
      ├─ yield ChatEvent { type: 'result' }
      └─ idle 타이머 RESTART (5min)

Renderer:
  │
  ├─ state.sessionId 유지: 'sess_123'
  ├─ message 배열에 새 회차 추가
  └─ pendingDelta 누적 + 리렌더
```

### 시퀀스 #3: idle timeout 회수 (5분 ready)

```
(시퀀스 #2 result 직후. child 는 ready, idle 타이머 5min 카운트 시작)

  T+0:00   result 이벤트 도착, idle 타이머 START (5min)
            child 는 살아있음 (ready 상태)

  T+...    사용자가 다른 작업 중. user write 없음.
            ※ in-turn 진입 시 (다음 메시지 전송 시) 타이머는 즉시 STOP — 회수 안 함.

  T+5:00   idle 타이머 만료
  │
  ├─ child.stdin.end()         ← EOF 전달, CLI 가 jsonl flush 후 자연 종료 유도
  │
  ├─ setTimeout(2000, () => { ... })  grace 2s 대기
  │
  └─ (2s 후 child 가 아직 살아있으면)
      child.kill('SIGTERM')
      │
      ├─ child = null
      ├─ idleTimer = null
      └─ lastSessionId = 'sess_123' 보존  ← 어댑터 메모리에 남음

  ※ Renderer 상태에는 변화 없음. UX 상 idle 회수는 *사용자에게 보이지 않음*.
    다음 user 메시지가 오면 시퀀스 #4 로 lazy 재spawn.
```

### 시퀀스 #4: idle 후 재개 / crash recovery / 재로그인 (lazy 재spawn + --resume)

```
(시퀀스 #3 직후 또는 child crash / 401 후. child 는 null, lastSessionId = 'sess_123')

사용자 입력: "give me more details"
  │
  ├─ window.orca.chat.send({ sessionId: 'sess_123', text: "give me more details" })
  │
  ▼ (IPC)
  │
  ▼
ClaudeCodeAdapter.sendMessage('sess_123', "give me more details", cwd)
  │
  ├─ child 가 null → lazy 재spawn:
  │   spawn('claude', [
  │     '-p',
  │     '--input-format',  'stream-json',
  │     '--output-format', 'stream-json',
  │     '--verbose',
  │     '--include-partial-messages',
  │     '--resume', 'sess_123'        ← lastSessionId 가 있으므로 추가
  │   ])
  │   │
  │   └─ CLI 가 ~/.claude/projects/<cwd>/sess_123.jsonl 읽기 → 이전 컨텍스트 복원
  │
  ├─ stdin write:
  │   {"type":"user","message":{"role":"user","content":[{"type":"text","text":"give me more details"}]}}\n
  │
  ├─ stdout: { "type": "system", "session_id": "sess_123" }   ← 같은 ID
  │   ├─ lastSessionId 갱신 (동일 값)
  │   └─ yield ChatEvent { type: 'init', sessionId: 'sess_123' }
  │
  ├─ stdout: assistant_delta 스트림
  │
  └─ stdout: result → idle 타이머 START (5min) → child ready

Renderer:
  │
  └─ idle/crash 여부 *무관* 하게 동일 UX. 단, 첫 토큰 지연은 시퀀스 #1 과 같은 SLA (lazy spawn 비용 포함).
```

### 시퀀스 #5: 인스톨러 흐름

```
앱 부트 → AdapterRegistry.isInstalled() 병렬 호출
  │
  ├─ ClaudeCodeAdapter.isInstalled(): false
  ├─ OpencodeAdapter.isInstalled(): false
  │
  ├─ (둘 다 false)
  │
  ▼
Renderer: AdapterRegistry.list() 호출
  │
  ├─ window.orca.backend.list()
  │   └─ { backends: [], active: null }
  │
  ├─ Renderer UI: 인스톨러 다이얼로그 표시
  │   ├─ "claudecode 와 opencode 모두 미설치됨"
  │   ├─ [npm으로 설치] / [curl로 설치] 라디오
  │   └─ [시작]
  │
  ▼
사용자 선택: npm 선택 후 [시작]
  │
  ├─ window.orca.install.start('claude-code')
  │
  ▼ (IPC)
  │
  ▼
Installer.start('claude-code')
  │
  ├─ 의존성 점검
  │   ├─ which node / npm -v
  │   └─ (성공)
  │
  ├─ spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'])
  │
  ├─ stdout 라인별:
  │   ├─ "added X packages"
  │   ├─ ...
  │   └─ "" (공백)
  │
  ├─ 각 라인마다:
  │   └─ event.sender.send('orca:install:status', { step: '...', progress: 50 })
  │
  └─ exit code 0 (성공)
      └─ event.sender.send('orca:install:status', { step: 'complete' })

Renderer: window.orca.install.onStatus(cb)
  │
  ├─ st1: { step: 'added X packages', progress: 50 }
  │   └─ 프로그레스바 업데이트 + 로그 표시
  │
  ├─ st2: { step: 'complete' }
  │   ├─ 진행률 100%
  │   ├─ 로그: "✓ 설치 완료!"
  │   └─ [새 대화] 버튼 표시
  │
  └─ (사용자 [새 대화] 클릭)
     ├─ AdapterRegistry.isInstalled() 재확인
     ├─ ClaudeCodeAdapter.isInstalled(): true (이제 설치됨)
     ├─ 자동 선택
     └─ 일반 채팅 모드로 복귀
```

### 시퀀스 #6: 백엔드 자동 선택 (부트)

```
앱 부트 (main/index.ts)
  │
  ├─ new AdapterRegistry()
  │   ├─ ClaudeCodeAdapter().isInstalled() ────┐
  │   └─ OpencodeAdapter().isInstalled() ───┐  │
  │                                          │  │
  │        병렬 실행 (Promise.all)         │  │
  │                                          ▼  ▼
  │     결과: { 'claude-code': true, 'opencode': false }
  │
  ├─ if (1개만 true) → registry.active = 'claude-code'
  ├─ if (둘 다 true) → Renderer에 선택지 제시 (또는 OQ7 기본값)
  ├─ if (둘 다 false) → 인스톨러 대기
  │
  ▼
BrowserWindow 생성 → Renderer mount
  │
  ├─ useEffect(() => {
  │   window.orca.backend.list()
  │     .then(res => dispatch(SET_BACKEND, res.active))
  │ })
  │
  ├─ 응답: { backends: ['claude-code'], active: 'claude-code' }
  │
  ├─ state.backend = 'claude-code'
  │
  └─ UI: "Claude Code 준비 완료" 표시
```

---

## 8. Lifecycle & Boot Sequence

### 앱 부트 순서

```
1. Electron app.whenReady()
   └─ main/index.ts 실행

2. AdapterRegistry 초기화
   ├─ isInstalled() 병렬 호출
   └─ 활성 백엔드 결정 (자동 / OQ7)

3. IpcRouter 초기화
   └─ 모든 orca:* 채널 ipcMain.handle 등록

4. BrowserWindow 생성
   ├─ preload 로드
   ├─ contextBridge.exposeInMainWorld('orca', {...})
   └─ renderer HTML 로드 (HMR dev server 또는 asar)

5. React mount (main.tsx → createRoot)
   ├─ App 컴포넌트 렌더
   ├─ ChatContext 초기화
   └─ useEffect: window.orca.backend.list() 호출

6. Renderer → Main: orca:backend:list invoke
   └─ 응답: 설치 상태 + 활성 백엔드

7. Renderer UI 업데이트
   └─ 채팅 준비 완료
```

### 앱 종료 순서

```
사용자 [닫기] 또는 Cmd+Q
  │
  ▼
app.on('window-all-closed')
  │
  ├─ (opencode 활성) child.kill('SIGTERM')
  │   ├─ 5초 대기
  │   └─ (응답 없으면) child.kill('SIGKILL')
  │
  ├─ (ClaudeCode, Phase 2.5) 살아있는 모든 세션 child 에 대해
  │   ├─ idleTimer clearTimeout
  │   ├─ child.stdin.end()  → grace 2s
  │   └─ (응답 없으면) child.kill('SIGTERM')
  │
  └─ app.quit()
     └─ main 프로세스 종료
```

---

## 9. Dependency Graph

### 모듈 간 import 방향

```
Renderer → shared (타입, i18n)
  ↑
  (import 금지) main
  
Main → shared (타입, protocol)
  ↓
  adapters (types 포함)
  ├─ ClaudeCodeAdapter
  └─ OpencodeAdapter
  
Preload → shared (타입)
```

### 외부 패키지 사용처

| 패키지 | 모듈 | 역할 |
|---|---|---|
| `@electron-toolkit/preload` | preload | contextBridge 유틸 |
| `@electron-toolkit/utils` | main | 경로 유틸 |
| `electron` | main | app, BrowserWindow, ipcMain |
| `react` | renderer | JSX, hooks |
| `react-markdown` | renderer/Markdown | 마크다운 렌더 |
| `shiki` | renderer/Markdown | 코드 블록 syntax highlighting |
| `@opencode-ai/sdk` | main/adapters/opencode | opencode HTTP 클라이언트 |
| `zod` | main/ipc | IPC 메시지 검증 + adapters (에러 검증) |
| `electron-store` | main/settings (Phase 2+) | 설정 영속화 |

---

## 10. Build Pipeline (electron-vite 3-config)

### dev 모드

```
npm run dev
  │
  ├─ Vite dev server 시작 (renderer HMR)
  │   └─ localhost:5173 (또는 할당 포트)
  │
  ├─ TypeScript watch: src/main/** → dist/main/
  │   └─ main 변경 시 electron 재시작
  │
  ├─ TypeScript watch: src/preload/** → dist/preload/
  │   └─ preload 변경 시 electron 재시작
  │
  └─ electron 시작
     ├─ preload: dist/preload/index.js
     ├─ main: dist/main/index.js
     └─ renderer: http://localhost:5173 (HMR 경유)
```

**dev 특징**: HMR 활성 (renderer 수정 시 새로고침), 자동 재시작.

### build 모드

```
npm run build
  │
  ├─ 병렬 실행:
  │   ├─ tsc (typecheck: node + web 분리)
  │   ├─ Vite build (renderer)
  │   │   └─ out/renderer/ (번들링·최적화)
  │   ├─ Vite build (main)
  │   │   └─ out/main/ (번들링)
  │   └─ Vite build (preload)
  │       └─ out/preload/ (번들링)
  │
  ├─ 결과: out/ 디렉토리 완성
  │   ├─ out/main/index.js
  │   ├─ out/preload/index.js
  │   └─ out/renderer/ (assets + index.html)
  │
  └─ (npm run build:win 등에서)
     └─ electron-builder
        ├─ out/ + resources/ → 패키징
        └─ dist/ (NSIS .exe 등)
```

### typecheck 분리

```
tsconfig.json
  ├─ tsconfig.node.json (main + preload)
  │   └─ target: ES2020, module: commonjs
  │
  └─ tsconfig.web.json (renderer)
      └─ target: ES2022, module: esnext, jsx: react-jsx
```

분리 이유: 두 환경이 다른 module 형식·target을 사용 (Node vs browser).

---

## 11. Phase 2~4 Architecture Anchors

본문 (Phase 1) 을 막지 않는 확장 지점 만. 자세한 기능은 TRD §10.

### 11.1 Phase 2: 재시작 재개

**확장점**:
- Settings.store 에 `lastSessionId` 키 추가
- 앱 부트 시 `Settings.get('lastSessionId')` 읽기
- Renderer 초기 상태에 주입: `{ sessionId: lastSessionId, ... }`
- 다음 전송 시 `--resume <lastSessionId>` / same session HTTP 호출

**구현 위치**:
- `src/main/settings/store.ts` (phase 2에 electron-store 도입)
- `src/renderer/src/state/chatReducer.ts` + `state/useChat.ts` (초기 상태 초기화)

### 11.2 Phase 3: 과거 대화 목록

**확장점**:
- `SessionAdapter.listSessions?()` 옵셔널 메서드 활성화
- Renderer: Sidebar에 새 "세션 목록" 섹션
- 클릭 시 `loadSession(id)` → ChatEvent[] 배열 로드 → 메시지 복원

**구현 위치**:
- `src/main/adapters/claude-code.ts` (jsonl 디렉토리 스캔)
- `src/main/adapters/opencode.ts` (SDK 호출)
- `src/renderer/src/app/Sidebar.tsx` (세션 리스트 UI)

### 11.3 Phase 4: 멀티 세션 (동시 대화)

**확장점**:
- Renderer `ChatState` 외피만 변경: `{ sessions: Record<sessionId, ChatState> }`
- 내부 reducer 로직은 "세션 1개 단위" 로 캡슐화되므로 그대로 재사용 가능
- Sidebar: 세션 탭 표시 + 활성 세션 전환

**구현 위치**:
- `src/renderer/src/state/chatReducer.ts` (ChatState 타입 + reducer 리팩터)
- `src/renderer/src/app/Sidebar.tsx` (세션 탭 UI)

---

## 12. Future Work / Out-of-Scope

본문 밖. **anchor 수준만**.

- **(anchor) 시스템 트레이** — Main에 `src/main/tray/index.ts` 추가 예정. 백그라운드 실행 / 빠른 캡처 등.
- **(anchor) electron-updater + GitHub Releases** — 자동 업데이트 채널, 배포 인프라 (OQ3).
- **(anchor) Auto-update** — OQ3.
- **(anchor) 하드웨어 (BoardAdapter)** — `src/main/adapters/board.ts` + native module (`orca-board.node`) + libusb 종속성. Phase 2~3.
- **(anchor) OpenAI Compatible 백엔드** — 3번째 `SessionAdapter` 구현체. Registry 가 N개로 확장.
- **(anchor) Skills / MCP / Captures / Projects** — 별도 도메인 모듈 + 추가 IPC 채널. Phase 3+.

---

## 13. References

- `docs/TRD.md` — 기능 정의, API 스펙, 데이터 모델 (단일 출처)
- `docs/claude-code-spec.md` — Claude Code CLI 외부 계약 (§5.4 가 인용)
- `app/CLAUDE.md` — 모듈 레이아웃·보안 베이스라인 운영 규칙
- `project/electron/architecture.html`, `electron-mockup.jsx` — 시각 기준 프로토타입 (production 아님)
