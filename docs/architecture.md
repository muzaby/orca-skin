# Orca — Architecture Document (v1)

> Electron 기반 Orca 앱이 **어떻게 구성되어 있고, 입력이 어느 경로로 흘러서 응답이 되는가** 를 설명한다. 기능 정의·API 스키마·데이터 모델은 `docs/TRD.md` 참조.

| 항목 | 값 |
|---|---|
| 문서 버전 | v1 (MVP 구현) |
| 입력 | `docs/TRD.md` (기능·스택), `app/CLAUDE.md` (모듈 레이아웃 운영 규칙), `project/electron/` (시각 기준) |
| 출력 대상 | 코드 작성 에이전트 / 코드 리뷰어 |
| 범위 | Phase 1 정적 구조 + 동적 흐름. Phase 2~4 확장점은 §11 anchor |

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

```
window.orca 가 노출하는 메서드 ↔ IPC 채널 1:1 매핑

window.orca.chat.send(...)              ──► ipcRenderer.invoke('orca:chat:send', ...)
window.orca.chat.onEvent(cb)            ◄── ipcRenderer.on('orca:chat:event', cb)
window.orca.chat.cancel(...)            ──► ipcRenderer.invoke('orca:chat:cancel', ...)

window.orca.backend.list()              ──► ipcRenderer.invoke('orca:backend:list')
window.orca.backend.select(...)         ──► ipcRenderer.invoke('orca:backend:select', ...)

window.orca.install.start(...)          ──► ipcRenderer.invoke('orca:install:start', ...)
window.orca.install.onStatus(cb)        ◄── ipcRenderer.on('orca:install:status', cb)

window.orca.settings.get(...)           ──► ipcRenderer.invoke('orca:settings:get', ...)
window.orca.settings.set(...)           ──► ipcRenderer.invoke('orca:settings:set', ...)
```

### Preload 구현 원칙

- `src/preload/index.ts` 에서 `contextBridge.exposeInMainWorld('orca', api)` 호출
- `api` 객체는 정확히 위 namespace 포함, 그 외는 노출 금지
- NodeJS require, fs, process 등 일절 노출 금지
- Renderer에서 `window.orca` 로만 IPC 접근 가능 (ipcRenderer 직접 import 불가)

### 타입 정의

**renderer 측**:
```typescript
// src/renderer/src/types/orca.d.ts (또는 preload에서 import)
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
        select(backend: Backend): Promise<void>;
      };
      install: {
        start(backend: Backend): Promise<void>;
        onStatus(handler: (st: InstallStatus) => void): () => void;
      };
      settings: {
        get(key: string): Promise<unknown>;
        set(key: string, value: unknown): Promise<void>;
      };
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

### 5.4 ClaudeCodeAdapter 내부 구현

**stdout NDJSON 파싱**:
- spawn의 stdout을 라인 단위 분할
- 부분 라인은 버퍼에 보관, 다음 chunk와 합쳐서 파싱
- 파싱 실패 라인 → `error / protocol.parse` 이벤트

**sessionId 추출**:
- 첫 stdout 이벤트 (`system` 또는 `init` 타입)에서 `session_id` 필드 추출
- `ChatEvent { type: 'init', sessionId: <extracted> }` 로 정규화
- Renderer가 수신 후 변수에 저장

**인증 만료 감지**:
- stdout/stderr 전체 스트림에서 `401` / `OAuth` / `expired` 패턴 매칭
- 감지 시 `error / auth.expired` 이벤트 발행

**환경변수 전달**:
- spawn의 `env` 옵션에 사용자 PATH·HOME 포함
- CLI가 `~/.claude/projects/<cwd>/` 에 jsonl 저장 → 재개 시 복원

### 5.5 OpencodeAdapter 내부 구현

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

**위치**: `src/renderer/src/app/state.ts`

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

**TweaksPanel.tsx**:
```typescript
const [theme, setTheme] = useState('Classic');
const [density, setDensity] = useState(13);
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

const handleThemeChange = (newTheme) => {
  setTheme(newTheme);
  // CSS 변수 주입 (아래 참조)
  applyThemeCssVariables(newTheme);
};
```

**CSS 변수 주입** (ThemeProvider 역할):
```typescript
const applyThemeCssVariables = (theme: string) => {
  const root = document.documentElement;
  switch (theme) {
    case 'Classic':
      root.style.setProperty('--cream-0', '#fbf9f4');
      root.style.setProperty('--ink-900', '#29261b');
      // ... 전체 팔레트 설정
      break;
    case 'Dark':
      root.style.setProperty('--cream-0', '#1c1a16');
      root.style.setProperty('--ink-900', '#f0eadd');
      // ... dark 팔레트
      break;
  }
};
```

**Cascade**: 모든 컴포넌트의 `className` 이 CSS 변수 참조 (예: `bg-[var(--cream-0)]`) → 한 번에 전 화면 변환.

### 6.5 Tailwind + 디자인 토큰 통합

**tailwind.config.js**:
```javascript
export default {
  theme: {
    extend: {
      colors: {
        cream: {
          0: 'var(--cream-0)',    // CSS 변수 참조
          50: 'var(--cream-50)',
          // ...
        },
        ink: {
          900: 'var(--ink-900)',
          // ...
        },
      },
      fontSize: {
        sm: ['11.5px', { lineHeight: '1.4' }],
        base: ['13px', { lineHeight: '1.5' }],
        lg: ['14.5px', { lineHeight: '1.6' }],
      },
    },
  },
};
```

**컴포넌트**:
```tsx
// MessageBubble.tsx
<div className="bg-cream-0 text-ink-900 text-base px-4 py-2 rounded">
  {/* bg-cream-0 은 CSS 변수 --cream-0 참조 → Tweaks로 동적 변경 */}
</div>
```

---

## 7. Data Flow (Sequence Diagrams)

### 시퀀스 #1: 메시지 전송 1턴 (sessionId 미발급)

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
  ▼
ipcRenderer.invoke('orca:chat:send', { ... })
  │
  ▼ (IPC 경계)
  │
  ▼
ipcMain.handle('orca:chat:send', async (event, req) => {
  const validated = SendChatMessageSchema.parse(req);  // zod 검증
  const adapter = registry.getActive();
  
  for await (const ev of adapter.sendMessage(null, "hello", cwd)) {
    event.sender.send('orca:chat:event', ev);
  }
})
  │
  ├─ ClaudeCodeAdapter.sendMessage(null, "hello", cwd)
  │   ├─ spawn('claude', ['-p', 'hello', '--output-format', 'stream-json'])
  │   │
  │   ├─ stdout 라인 1: { "type": "system", "session_id": "sess_123" }
  │   │   ├─ parse → normalize
  │   │   └─ yield ChatEvent { type: 'init', sessionId: 'sess_123' }
  │   │
  │   ├─ stdout 라인 2: { "type": "assistant_delta", "text": "I " }
  │   │   ├─ parse → normalize
  │   │   └─ yield ChatEvent { type: 'assistant_delta', text: 'I ' }
  │   │
  │   ├─ stdout 라인 3: { "type": "assistant_delta", "text": "can " }
  │   │   └─ yield ChatEvent { type: 'assistant_delta', text: ' can ' }
  │   │
  │   ├─ ... (이어서 delta 스트림)
  │   │
  │   └─ stdout 라인 N: { "type": "finish", ... }
  │       └─ yield ChatEvent { type: 'result' }
  │
  ├─ event.sender.send('orca:chat:event', { type: 'init', sessionId: 'sess_123' })
  │
  ├─ event.sender.send('orca:chat:event', { type: 'assistant_delta', text: 'I ' })
  │
  ├─ event.sender.send('orca:chat:event', { type: 'assistant_delta', text: ' can ' })
  │
  └─ event.sender.send('orca:chat:event', { type: 'result' })
  
  ▼ (IPC 경계)
  │
  ▼
Renderer: window.orca.chat.onEvent(cb)
  │
  ├─ ev1: { type: 'init', sessionId: 'sess_123' }
  │   ├─ dispatch(RECV_EVENT(ev1))
  │   └─ state.sessionId = 'sess_123'
  │
  ├─ ev2: { type: 'assistant_delta', text: 'I ' }
  │   ├─ dispatch(RECV_EVENT(ev2))
  │   ├─ pendingDelta += 'I '
  │   └─ 16ms debounce 리렌더 (MessageList 업데이트)
  │
  ├─ ev3: { type: 'assistant_delta', text: ' can ' }
  │   ├─ dispatch(RECV_EVENT(ev3))
  │   ├─ pendingDelta += ' can '
  │   └─ 리렌더: "I can " 표시
  │
  └─ evN: { type: 'result' }
      ├─ dispatch(RECV_EVENT(evN))
      ├─ inflight = false
      └─ [전송] 버튼 다시 활성화
```

### 시퀀스 #2: 메시지 전송 2턴 (sessionId 재사용)

```
(이전 세션에서 sessionId = 'sess_123' 저장됨)

사용자 입력: "what's next?"
  │
  ├─ window.orca.chat.send({ sessionId: 'sess_123', text: "what's next?" })
  │
  ▼ (IPC)
  │
  ▼
ClaudeCodeAdapter.sendMessage('sess_123', "what's next?", cwd)
  │
  ├─ spawn('claude', ['-p', "what's next?", '--output-format', 'stream-json', '--resume', 'sess_123'])
  │   ├─ CLI가 ~/.claude/projects/<cwd>/sess_123.jsonl 읽기
  │   ├─ 이전 메시지들 로드 (컨텍스트 복원)
  │   └─ 새 메시지와 함께 LLM 호출
  │
  ├─ stdout: { type: 'init', session_id: 'sess_123' }
  │   └─ 같은 ID 반환 (또는 생략)
  │
  ├─ stdout: { type: 'assistant_delta', text: "Building on " }
  │   └─ yield
  │
  └─ ... (이어서 response)

Renderer:
  │
  ├─ state.sessionId 유지: 'sess_123'
  ├─ message 배열에 새 회차 추가
  └─ pendingDelta 누적 + 리렌더
```

### 시퀀스 #3: 인스톨러 흐름

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

### 시퀀스 #4: 백엔드 자동 선택 (부트)

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
  ├─ (ClaudeCode) 자식 프로세스 없음 (매 턴마다 종료)
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
- `src/renderer/src/app/state.ts` (초기 상태 초기화)

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
- `src/renderer/src/app/state.ts` (ChatState 타입 + reducer 리팩터)
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
- `app/CLAUDE.md` — 모듈 레이아웃·보안 베이스라인 운영 규칙
- `project/electron/architecture.html`, `electron-mockup.jsx` — 시각 기준 프로토타입 (production 아님)
