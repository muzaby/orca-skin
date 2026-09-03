# Orca — Technical Requirements Document (v1)

> `docs/PRD.md` 의 *WHAT* 을 *HOW* 로 옮기는 기술 사양. 기능·스택·API·데이터 모델을 다룬다. 시스템 구성·프로세스 모델·모듈 레이아웃·데이터 흐름 등 아키텍처 구조는 `docs/ARCHITECTURE.md` (Renderer) + `docs/ARCHITECTURE.md` (Main) + `docs/IPC_CONTRACT.md` (채널 SSOT) + `docs/GLOSSARY.md` (용어 SSOT) 4 문서 참조.

| 항목 | 값 |
|---|---|
| 문서 버전 | v1 (MVP 구현 사양). 코드에서 셀 수 있는 수치(채널·설정 키·마이그레이션)는 이 문서가 갖지 않는다 — [생성물](generated/inventory.md) 참조 |
| 입력 | `docs/PRD.md` (MVP §6, §7, §11), `docs/etc/llm-chat-desktop-strategy.md` |
| 출력 대상 | 코드 작성 에이전트 / 구현자 |
| 범위 | Phase 1 MVP 본문. Phase 2~4 / Future Scope = §10 anchor only |
| 미정 항목 처리 | PRD §11 Open Questions 는 **여기서 결정하지 않는다.** "결정 후 결정값으로 대체" 표시만 둔다. |

> **Phase 1 단일 백엔드 결정 (2026-05-13)**
> 앱은 **`claude` 단일 백엔드**로 동작한다. `@opencode-ai/sdk`는 배포 코드 분석·계약 검증을 위해 설치했으나 `OpencodeAdapter`는 미구현이며 AdapterRegistry에 등록하지 않았다. 설치 기준과 실제 API는 [OpenCode SDK 해설](opencode-sdk-spec.md), 전환 권고는 [마이그레이션 연구](etc/study/opencode/orca-migration-guide.md)를 따른다. SDK 설치는 OQ7의 기본 백엔드 결정이나 런타임 전환을 뜻하지 않는다.

> **Preload 노출 표면 축소 결정 (2026-05-13)**
> preload `window.orca` 는 **renderer 가 실제 호출하는 채널만** 노출한다 (principle of least privilege). Phase 2 활성 6채널: `chat:send`/`chat:event`/`chat:cancel`/`backend:list`/`install:start`/`install:status`. 이전 Q1 ("`backend:select` 유지") 결정은 본 정책 도입으로 **취소** — 단일 백엔드에서 사용처가 없으므로 main 핸들러까지 함께 제거했다. `settings:get`/`settings:set` 도 동일 사유로 Phase 2 범위 밖. 향후 사용처가 생기면 (멀티 백엔드 / 영속화) 한 PR 에서 preload+main+CHANNELS 를 함께 다시 등록한다. zod 스키마 (`shared/protocol.ts`) 는 main 전용이며, preload 는 zod 비종속의 `shared/ipc.ts` 만 import 한다 (`sandbox: true` 호환).

---

## 1. 문서의 목적과 범위

본 문서는 Orca v1 MVP (Phase 1) 가 **무엇을 기능으로 제공하고, 어떤 기술 스택으로 만드는가** 를 검증 가능한 형태로 정의한다.

본문은 Phase 1 만 다루며, Phase 2~4 확장 구조는 §10 의 anchor 로만 언급한다. 하드웨어·Skills·MCP·Captures·Projects 등 도메인 기능은 `docs/PRD.md` §9 Future Scope 를 참조.

시스템이 **어떻게 구성되어 있고 입력이 어디로 흘러가는가** 는 `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.md` / `docs/IPC_CONTRACT.md` 4문서에서 다룬다 (2026-05-20 이전 `architecture.md` 단일 파일에서 분할).

---

## 2. Functional Spec (Phase 1)

PRD §6.1 의 F1~F10 을 *수용 기준* 으로 구체화한다.

| ID | 요구사항 | 구현 책임 모듈 | 수용 기준 | PRD |
|---|---|---|---|---|
| F1 | **Chat 입력/스트리밍** | Composer, MessageList, useEngineStream | 전송 즉시 첫 `assistant_delta` 가 N ms 내 도착 (SLA는 OQ6), 토큰 단위 누적 표시, 마지막 `assistant_message` 로 완성본 교체 | §6.1 |
| F2 | **마크다운 렌더링** | Markdown, react-markdown + shiki | 본문 + 코드 블록 syntax highlighting, 타겟 언어: Python·JavaScript·TypeScript·Bash 등 (shiki 제공 범위), 안전성: markdown 구현체의 sanitize 기본 적용 | §6.1 |
| F3 | **도구 호출 표시** | ToolCallCard, MessageList | `tool_use` 이벤트 도착 시 카드 생성 (이름·입력 JSON 표시), 같은 `toolUseId` 의 `tool_result` 도착 시 카드에 결과·소요시간 추가, 상태 전이: pending → running → completed/failed | §6.1 |
| F4 | **단일 활성 대화 컨텍스트** | ChatState (reducer), Adapter | 같은 `sessionId` 를 매 턴 어댑터에 전달 (Claude: `options.resume` / opencode: same session HTTP call), Renderer는 `sessionId` 변수 1개만 메모리 보관, 백엔드가 이전 턴들을 복원 | §6.1 |
| F5 | **새 대화** | ChatShell ("새 대화" 버튼) | `sessionId = null` 리셋 → reducer 메시지 배열·pendingDelta 초기화, 다음 전송 시 `sendMessage(null, ...)` 호출 → 어댑터가 ID 발급 (`init` 이벤트에서 추출) | §6.1 |
| F6 | **백엔드 선택** | AdapterRegistry, BackendSelector UI | 시작 시 병렬 `isInstalled()` → (둘 다/한쪽/없음) 결과. 둘 다 설치: 사용자 선택 또는 OQ7 정책. 한쪽: 자동 선택. 없음: 인스톨러 트리거. v1에서 세션 중 전환 불가 | §6.1 |
| F7 | **CLI 설치 자동화** | Installer (IPC `orca:install:*`) | 둘 다 미설치 → 다이얼로그 (npm / curl 선택) → child_process 실행 → 라인 단위 status 스트림 → 완료/실패 표시 | §6.1 |
| F8 | **설치 실패 폴백** | Installer | 자동 실패 → 수동 명령 전체 텍스트 UI에 표시 + 복사 버튼. Node.js 미설치 (Windows: choco, macOS: brew 안내), npm 글로벌 권한 부족 (sudo / npm config 안내) | §6.1 |
| F9 | **인증 만료 처리** | ClaudeAdapter, Auth modal | Claude Code OAuth 401 감지 (stdout/stderr `"401"` / `"expired"` 패턴) → `error / auth.expired` 이벤트 → UI 모달 "`claude /login` 을 터미널에서 실행 후 새 대화" | §6.1 |
| F10 | **Tweaks 패널** | DebugPanel(dev 전용, 구 TweaksPanel), useTweaks | 테마 선택 (**white/dark 2종** — 구 Classic/Dark/Cool 3종에서 축소) + 밀도 + 사이드바 접기 토글 → `data-theme` 속성 갱신 → Tailwind `@theme` 토큰 스코프 cascade → 전 화면 반영. 선택값은 `electron-store` 영속(§6.7 키 카탈로그의 일부). 트리 remount 불요 (CSS 변수 재설정으로 충분) | §6.1 |

**Phase 4 에서 추가 구현된 기능** (F1~F10 이후 — 인수 기준 상세는 각 handoff plan/verify 가 정본):

| ID | 요구사항 | 구현 책임 모듈 | 요약 | 출처 |
|---|---|---|---|---|
| F11 | **자동 업데이트** | `app/updater.ts`(UpdateController) + `features/update/` | electron-updater — 시작 시 1회 체크, `autoDownload=false`(다운로드·설치 = 사용자 명시 액션), 재시작 게이트(`shared/update-restart.ts`), update 6채널 브로드캐스트 | 0084~0086 |
| F12 | **사용량 한도** | `features/usage`(main) + UsagePanel·설정 탭(renderer) | 월간 `spendingLimitUsd` + provider별 한도(`provider_limits`). **Main 이 `UsageLimitsView` 정본을 만들고**(`usage-compose` + `shared/usage/limits.ts`) renderer 는 `shared/stores/usageStore` 로 mirror 만 한다. 도넛 팝오버 = 컨텍스트바+주간/월간 한도 바. 원격 사용량 조회는 `UsageFetcher` 포트를 주입한 배포에서만 도는 선택 기능 | 0079~0082, 0186 |
| F13 | **주기 실행 (스케줄러)** | `features/scheduler/`(croner + interval) | job 등록·겹침 방지·`schedule_runs` 이력. 스펙 2종 — cron(벽시계 정렬) / `intervalMs`(schedule 시각 anchor, 0156). 소비처 = 주기 사용량 recompute(`scheduler.usageRecompute`, cron·설정 노출형) · 자동 업데이트 확인(`scheduler.updateCheck`, interval) · **코어 고정형 사용량 잡 2종**(`usage-boundary` 자정 cron 항상 · `usage-fetch` fetcher 주입 시에만, 0186). **기간 경계 불변식은 `usage-boundary` 가 소유한다** — `scheduler.usageRecompute`(기본 off)는 사용자가 임의 주기로 켜는 호환용이라 경계를 보장하지 않고, 둘 다 켜져 시각이 겹쳐도 각자 전역을 재계산할 뿐이라 값이 어긋나지 않는다(중복 계산일 뿐) | 0091, 0156, 0186 |
| F14 | **번들 스킬 시딩** | `features/extensions/skills/seed.ts` + `builtin-resources.ts` | 부팅 1회 번들 스킬 → `sources/skills` 시딩, manifest/marker 버전 게이트로 사용자 수정 보호 | 0078 |
| F15 | **CI/CD 릴리스** | `.github/workflows/{ci,release}.yml` + `scripts/validate-*` | main push 게이트 + `v*` 태그 → unsigned NSIS → GitHub Releases 즉시 게시(수동 dispatch 는 dry-run). §9 참조 | 0087~0089 |

**비고**: 모듈 경로·정확한 IPC 채널·컴포넌트 트리는 [ARCHITECTURE.md](./ARCHITECTURE.md) / [IPC_CONTRACT.md](./IPC_CONTRACT.md) 참조. 위 표는 *기능 정의* 에만 집중.

---

## 3. Non-functional Spec

PRD §6.2 의 N1~N6 을 구현 가능한 형태로 변환한다.

| ID | 요구사항 | 명세 |
|---|---|---|
| N1 | **플랫폼** | Windows x64 1차 지원. macOS (arm64 + x64), Linux (x64) 는 후순위. Electron 다중 빌드 (`electron-builder.yml`) |
| N2 | **i18n** | i18next 기반 리소스 번들 (`app/src/renderer/src/shared/i18n/`). UI 라벨은 한국어, 기술 용어/터미널 출력은 영어 그대로. |
| N3 | **접근성** | 키보드 단축키: 새 대화 (Ctrl+N), **전송 (Enter), 줄바꿈 (Shift+Enter)**, Tweaks 패널 (Shift+T 등, [arch/frontend/ux-domains.md](arch/frontend/ux-domains.md) §1.1 참조). 다크모드는 Tweaks 경유 (CSS 변수 override). ARIA label은 주요 UI 요소에. (전송 키 결정: 2026-05-13 — chat 류 앱 관례를 따라 Ctrl+Enter 대신 Enter 단일 키로 변경) |
| N4 | **데이터 위치** | 세션 본체: CLI 저장소 (Claude Code: `~/.claude/projects/<cwd>/<id>.jsonl`, opencode: `~/.local/share/opencode/` 등). 앱: 메모리에 `sessionId` 변수 1개만 보유. Phase 2+ `electron-store` (선택값·마지막 세션 ID 등) |
| N5 | **응답 지연 가이드** | 첫 토큰까지 지연, 시작 시간 SLA = OQ6. 목표치가 정해지면 본 섹션 갱신. |
| N6 | **보안** | 현재 (Phase 2): OAuth/API 키 미저장 (SDK 가 `~/.claude` 자동 사용). **Phase 3+ 채택 결정**: 어댑터별 base URL + API key 를 safeStorage 로 저장 ([arch/backend/security.md](arch/backend/security.md) §1.4). 마크다운 렌더링 시 XSS sanitize (react-markdown 기본). Electron contextIsolation=true, sandbox=true 적용 (상세는 [arch/backend/security.md](arch/backend/security.md)). |

---

## 4. Tech Stack (확정 vs 미정)

electron-vite 환경 기준. 표 밖 의존성 추가 시 **사용자 승인 필수**.

| 계층 | 채택 | 버전·옵션 | 확정 여부 | 비고 |
|---|---|---|---|---|
| 데스크톱 셸 | Electron | ^39 (스캐폴드 기준) | 확정 (~~OQ3~~ 대부분 해소, 0084~0089) | 패키징 = electron-builder NSIS·자동 업데이트 = electron-updater 확정. 잔여 = 코드 서명/공증 |
| 빌드 아키텍처 | electron-vite | ^5 | 확정 | main/preload/renderer 3 sub-config |
| 번들러 | Vite | ^7 | 확정 | electron-vite가 sub-config 통합 |
| 언어 | TypeScript | strict, `target: ES2022` | 확정 | 타입 안정성 |
| UI 프레임워크 | React | ^19 | 확정 (~~OQ1~~ 해소, 2026-05-20) | React Hooks + Context/reducer |
| 상태 관리 (Renderer) | Zustand — **전환 완료 (0008 chat 선행 + 0013 전면)** + 순수 `chatReducer` 래핑 | `zustand@^5` | 확정 (완료) | chat store = `sessions: Record<sessionId, { session, live }>` 멀티세션 외피 + `activeKey`. Backend/Sessions/Projects/Cost Context 도 feature별 store 로 흡수(Provider 는 bootstrap-only). selector 구독으로 델타 프레임 재렌더를 라이브 리프에 한정. 상세 [arch/frontend/state.md](arch/frontend/state.md) §1 |
| 스타일링 | Tailwind CSS | **^4** (`@tailwindcss/vite` 플러그인, CSS-first `@theme`) | 확정 (Phase 1 완료) | utility-first. `styles/tokens.css` 의 `@theme` 블록으로 시맨틱 디자인 토큰 정의 (`--color-{bg,sidebar,ink,...}`). `[data-theme]` 스코프로 **white/dark 2테마** 전환. 자세한 정책은 `app/AGENTS.md` "스타일링 정책" 참조 |
| 마크다운 렌더링 | react-markdown + remark-gfm + shiki | `^9` / `^4` / `^1` | 확정 (Phase A `feat-pretty-ui` 도입) | GFM (표·체크박스) + 코드 블록 syntax highlighting. shiki 번들은 11개 언어 (ts/js/tsx/jsx/python/bash/json/yaml/html/css/markdown) 로 제한 |
| LLM 백엔드 SDK (Claude) | `@anthropic-ai/claude-agent-sdk` | latest | 확정 (Phase 3 채택, 2026-05-18) | TypeScript SDK. 진입점 `query({ prompt, options })`. 플랫폼별 native binary 는 `optionalDependencies` 자동 처리. 최소 요구 Node.js 18+. API 명세 SSOT 는 `docs/spec/claude/agent-sdk/typescript.md` |
| HTTP (opencode) | `@opencode-ai/sdk` | 1.18.27 (exact) | 조사·계약 검증용 설치 | runtime 미채택; [기준/제약](opencode-sdk-spec.md) |
| IPC | Electron 기본 ipcRenderer/ipcMain | — | 확정 | 별도 RPC 라이브러리 금지. main→renderer 는 Electron 가 ordered + lossless 보장 — 별도 메시지큐 미도입 (멀티 세션 도입 시 §11.3 anchor) |
| IPC 보안 | `@electron-toolkit/preload` + contextBridge | ^3 | 확정 | preload 화이트리스트 |
| 입력 검증 | zod | latest | 확정 | IPC 메시지 + SDK / SSE 응답 파싱 |
| 앱 내 스케줄링 | croner | latest | **확정 (0091)** | main 프로세스 in-app cron. 앱 실행 중에만 발화하며, 첫 소비처는 사용량 recompute. |
| 라우팅 (Renderer) | react-router-dom | ^7 | 확정 | `app://` 커스텀 스킴 + BrowserRouter. [arch/frontend/overview.md](arch/frontend/overview.md) §2 |
| diff 렌더링 | diff | ^9 | 확정 | 도구 카드의 파일 편집 diff 표시 |
| transcript 가상화 (Renderer) | `@tanstack/react-virtual` | ^3 | **확정 (0102)** | 긴 세션 transcript 의 과거(확정) 교환만 가상화해 화면 밖 shiki/DOM 상주 비용 제한. 마지막(스트리밍) 교환은 비가상 tail 로 유지해 0008 예약공간 앵커 보존 ("virtualized head + unvirtualized tail"). |
| 차트 (Renderer) | recharts | ^3 | **확정 (0112, 사용자 승인)** | 설정 사용량 요약의 일별 토큰 바 차트. 선언적 React 컴포넌트 + SVG 렌더링이라 `tokens.css` 시맨틱 토큰(CSS 변수)·white/dark 테마와 직결. 색은 `--color-indigo`(사용량 지정색)만 사용. |
| 영속화 (설정) | `electron-store` | ^8 | **확정 (완료)** | theme·density·sidebar*·lastBackend·lastSessionId·windowBounds·mcp*·skillEnabled·authBypass·language·uiLocale·accountInstructions·appFont·notifyOnComplete·spendingLimitUsd·scheduler). §6.7 참조 |
| 자동 업데이트 | `electron-updater` | ^6 | **확정 (0084~0086)** | `app/updater.ts` UpdateController — autoDownload=false·사용자 게이트. [arch/backend/runtime-ipc.md](arch/backend/runtime-ipc.md) §3.1 |
| 로컬 DB (Phase 3+) | better-sqlite3 (Phase 3 MVP raw) / Drizzle 후보 (Phase 4 재검토) | — | **채택 (Phase 3+)** | 메시지·세션 메타 SSOT. 어댑터 외부 저장 (jsonl 등) 은 단방향 동기화 소스로 격하. 마이그레이션 `src/main/db/migrations/NNN_<name>.sql`. **Phase 3 MVP: raw better-sqlite3 + prepared statements (쿼리 6 개 내외, ORM 가치 작음). Drizzle 은 Phase 4 멀티 세션·artifact·권한·통계 도입 시 재검토 (2026-05-20).** 상세 [arch/backend/persistence.md](arch/backend/persistence.md) |
| 자격증명 | Electron `safeStorage` (OS keychain) | — | **부분 구현** | MCP 인증 비밀 = secret-store(`orca-secrets`) 구현 완료. 어댑터별 base URL/API key 저장은 Future. [arch/backend/security.md](arch/backend/security.md) §1.4 |
| Python 런타임 | ~~uv + python-build-standalone~~ | — | **제거됨 (0050 PR-B)** | 구 `<userData>/runtime` 격리 Python 환경·runtime IPC 채널은 main 에서 삭제. uv 규약 정책 append 도 정적 정책 체인과 함께 제거 |
| 패키징 | electron-builder | ^26 | **확정 (0087~0089)** | Windows **unsigned NSIS** + GitHub Releases **draft**(수동 Publish 게이트). 잔여 = 코드 서명/공증(macOS 포함). 정본 `docs/guides/release-operations.md` |
| 테스트 (단위) | Vitest | latest | 확정 | 어댑터·reducer·IPC zod·scheduler·usage·updater 등 (+`node --test` 스크립트 스위트 4종) |
| 테스트 (E2E) | Playwright | latest | **미도입** | TRD 채택 목록에 있었으나 devDependency 미설치 — 도입 시 사용자 승인 + 설치. §11 참조 |

**정책**: 위 표 외의 패키지 (예: date-fns, lodash, redux 등) 도입 시 먼저 사용자 확인. (`zustand` 는 채택 완료 — chat 스코프 선행 도입(0008), 전역 확장은 Phase 4.)

---

## 5. IPC API Specification

### 5.1 채널 명명 규칙

모든 IPC 채널은 `orca:<domain>:<action>` 형식.
- `domain`: 기능 영역 (chat, backend, install, settings)
- `action`: 동작 (send, event, cancel, list, select, start, status, get, set)

### 5.2 채널 카탈로그

> **SSOT 는 [`IPC_CONTRACT.md`](./IPC_CONTRACT.md) §2** — 본 표는 TRD 의 가독성용 미러. 충돌 시 IPC_CONTRACT 우선. 채널 변경 절차는 IPC_CONTRACT §6 참조.

채널 카탈로그의 SSOT 는 IPC_CONTRACT §2, 수치는 [생성물](generated/inventory.md) 다. 아래 표는 **Phase 2 코어 도메인**(chat / backend / install / settings / skills / files)의 역사적 미러만 유지한다 — 이후 추가된 도메인(session·project·window·search·mcp·engine·agent·update·cost·boot·concurrency·permission·notify·debug·log·auth·plugin)은 재서술하지 않는다(드리프트 방지).

| 채널 | 방향 | 요청 페이로드 (TS) | 응답·스트림 | zod 스키마 |
|---|---|---|---|---|
| `orca:chat:send` | R→M (invoke) | `SendChatMessage` = `{ sessionId: string \| null; text: string }` | `Promise<void>` (ack). 응답은 `orca:chat:event` 스트림 | SendChatMessage |
| `orca:chat:event` | M→R (send) | — | `NormalizedEvent` (반복) | NormalizedEvent union (IPC_CONTRACT §3) |
| `orca:chat:cancel` | R→M (invoke) | `CancelChat` = `{ sessionId: string }` | `Promise<void>` — `AbortSignal` 전파 | CancelChat |
| `orca:backend:list` | R→M (invoke) | — | `BackendListResult` = `{ backends: { id: Backend; installed: boolean; version?: string }[]; active?: Backend }` | (검증 생략) |
| `orca:install:start` | R→M (invoke) | `StartInstall` = `{ backend: Backend }` | `Promise<void>` (ack). 진행은 `orca:install:status` 스트림. 현재 claude 는 SDK `optionalDependencies` 자동 해소 → 즉시 `done: true` | StartInstall |
| `orca:install:status` | M→R (send) | — | `InstallStatus` = `{ step: string; progress?: number; log?: string; error?: string; done?: boolean }` | InstallStatus |
| `orca:settings:get` | R→M (invoke) | — | `Settings` (electron-store 전체 객체) | (검증 생략) |
| `orca:settings:set` | R→M (invoke) | `SettingsPatch` = `Partial<Settings>` | `Settings` (병합·검증된 전체 객체) | SettingsPatch |
| `orca:skills:list` | R→M (invoke) | — | `SkillInfo[]` = `{ name: string; description: string; argumentHint?: string }[]` — 부팅 1회 스캔, 핫리로드 없음 | (검증 생략) |
| `orca:files:list` | R→M (invoke) | `ListFilesRequest` = `{ cwd: string; relDir: string }` | `FileEntry[]` = `{ name: string; isDirectory: boolean }[]` — `@` 자동완성용 | ListFilesRequest |
| `orca:session:cwd` | R→M (invoke) | — | `Promise<string>` — 현재 작업 디렉토리 | (검증 생략) |

Phase 2 범위 밖 (예약 — 도입 시점에 재등록):

| 채널 | 도입 시점 | 사유 |
|---|---|---|
| `orca:backend:select` | opencode 어댑터 활성화 시 | 단일 백엔드 운영, 선택 호출자 없음 |
| `orca:message:*` (list / append / delete) | **Phase 3+** | 로컬 DB SSOT 도입과 함께 ([arch/backend/persistence.md](arch/backend/persistence.md)) |
| `orca:session:list` / `:load` / `:delete` | **Phase 3+** | `SessionAdapter.listSessions?()` / `loadSession?()` 옵셔널 메서드 노출 |
| `orca:credentials:set` / `:hasKey` | **Phase 3+** | safeStorage 자격증명 ([arch/backend/security.md](arch/backend/security.md) §1.4) |
| `orca:skills:reload` | **Future** | 핫리로드 도입 시 |

> **Phase 3+ 이후 추가 도메인** (본 표는 Phase 2 미러라 누락): 채널·도메인 전수와 개수의 SSOT 는 [IPC_CONTRACT.md](./IPC_CONTRACT.md) §2 와 [생성물 인벤토리](generated/inventory.md) 다. 구 `runtime` 채널(Python uv 런타임)은 renderer 소비처 부재로 제거됐다(handoff 0012 · IPC_CONTRACT §2.11).

### 5.3 `window.orca` API (Preload 화이트리스트)

```typescript
// src/preload/index.ts 에서 노출 (Phase 2 코어 표면 발췌 — 전수는 IPC_CONTRACT §2)
interface OrcaApi {
  chat: {
    send(req: { sessionId: string | null; text: string }): Promise<void>;
    onEvent(handler: (ev: NormalizedEvent) => void): () => void;  // unsubscribe 함수 반환
    cancel(sessionId: string): Promise<void>;
  };
  backend: {
    list(): Promise<BackendListResult>;  // { backends: { id; installed; version? }[]; active? }
  };
  install: {
    start(backend: Backend): Promise<void>;
    onStatus(handler: (st: InstallStatus) => void): () => void;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  skills: {
    list(): Promise<SkillInfo[]>;
  };
  files: {
    list(req: { cwd: string; relDir: string }): Promise<FileEntry[]>;
  };
  session: {
    cwd(): Promise<string>;
  };
}

declare global {
  interface Window {
    orca: OrcaApi;
  }
}
```

Renderer 코드는 `window.orca.*` 만으로 통신 (ipcRenderer 직접 접근 금지). `backend.select` / `credentials.*` / `message.*` / `session.list|load|delete` 는 §5.2 의 예약 표대로 도입 시점에 노출한다.

**Preload 안전 import 정책**: preload 는 `sandbox: true` 로 실행되므로 Node `require` 가 화이트리스트 (`electron`, `events`, `timers`, `url`) 로 제한된다. 따라서 preload 는 zod 가 끼어있는 `src/shared/protocol.ts` 를 **import 하지 않는다**. CHANNELS 상수와 순수 TS 타입은 별도 파일 `src/shared/ipc.ts` (zod 0 의존) 에 두고, preload + renderer 가 이 파일을 import 한다. zod 스키마는 main 측 IPC 라우터에서만 사용.

### 5.4 스트림 종료 신호

- `orca:chat:event` 스트림: `NormalizedEvent` 의 `telemetry`(구 `result`) 또는 `error` 도착 시 **턴 종료** → Renderer가 `inflight` 플래그 해제.
- `orca:install:status` 스트림: `{ step: 'complete' | 'failed' }` 도착 시 설치 프로세스 종료.

---

## 6. Data Models

TS 타입 정의의 단일 출처. 구현은 `app/src/shared/ipc.ts` (zod-free) + `app/src/shared/protocol.ts` (zod 스키마) + `app/src/main/adapters/types.ts`. 용어 정의는 [`GLOSSARY.md`](./GLOSSARY.md), IPC 채널 카탈로그는 [`IPC_CONTRACT.md`](./IPC_CONTRACT.md) §2 가 SSOT.

### 6.1 Backend (백엔드 선택)

```typescript
type Backend = 'claude';
```

### 6.2 NormalizedEvent (어댑터→Renderer 정규화 스트림)

와이어 `orca:chat:event`의 현행 타입은 [shared/ipc.ts](../app/src/shared/ipc.ts)의 `NormalizedEvent`다. Claude 원본은 [claude-map.ts](../app/src/main/adapters/claude-map.ts)가 정규화하며, 원본 SDK 타입을 renderer에 직접 전달하지 않는다.
멀티세션 이벤트는 `sessionId`로 라우팅한다. 동시성·큐는 [runtime-ipc.md](arch/backend/runtime-ipc.md), renderer 소비는 [state.md](arch/frontend/state.md)가 설명한다.

도구 이름·입력의 백엔드 간 표준화는 PRD OQ10의 미결정이다. OpenCode mapping은 [연구 가이드](etc/study/opencode/orca-migration-guide.md)의 권고이며 아직 이 와이어에 연결하지 않았다.

### 6.3 SessionAdapter (공통 인터페이스)

계약 정본은 [adapters/types.ts](../app/src/main/adapters/types.ts)의 `SessionAdapter`·`LiveTurn`·`ProviderMessageBatch`, 입력은 [adapters/turn.ts](../app/src/main/adapters/turn.ts)의 `TurnRequest`다.
`sendMessage(req)`는 `LiveTurn`을 반환하고 소비자는 `eventBatches`를 읽는다. `describe`·`complete`·`classifyError`와 제어 메서드도 새 어댑터의 이식 범위이며, 단순 HTTP prompt 연결만으로 구현이 끝나지 않는다.
현행 책임은 [adapters.md](arch/backend/adapters.md), OpenCode와의 차이는 [연구 가이드](etc/study/opencode/orca-migration-guide.md)를 참조한다.

### 6.4 SessionInfo

```typescript
interface SessionInfo {
  id: string;
  createdAt: string;      // ISO8601, 예: "2026-05-12T10:30:00Z"
  title?: string;         // CLI가 제공하는 경우만
  cwd: string;
  backend: Backend;
}
```

### 6.5 ChatState (Renderer 상태 모델)

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    toolUseId: string;
    name: string;
    input: unknown;
    result?: { output: string | unknown; isError: boolean; durationMs?: number; };
  }>;
}

interface ChatState {
  sessionId: string | null;        // 활성 세션 ID (메모리만 보관)
  backend: Backend | null;         // 활성 백엔드
  messages: Message[];             // 누적 메시지
  pendingDelta: string;            // 진행 중인 assistant_delta 누적
  inflight: boolean;               // 현재 턴 진행 중 (전송 중/응답 대기)
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

**리듀서 액션**:
- `SEND_USER_MESSAGE(text)` → message 추가, `inflight = true`
- `RECV_EVENT(ev: ChatEvent)` → ev 타입별로 상태 업데이트
- `NEW_CHAT` → `sessionId = null`, messages 초기화, `live` 슬라이스 초기화
- `CANCEL_CHAT` → `inflight = false`, 에러 표시

### 6.6 Error 코드 표

`IPC_CONTRACT.md` §4 와 1:1. 충돌 시 IPC_CONTRACT 우선.

| 코드 | 의미 | 복구 가능 | 사용자 표시 |
|---|---|---|---|
| `sdk.crashed` | SDK `query()` 내부 예외 (claude 어댑터) | yes | 새 대화 안내 |
| `sdk.spawn-failed` | SDK 가 platform binary 해소 실패 (부팅 시점) | yes | 인스톨러 다이얼로그 트리거 |
| `cli.not-installed` *(deprecated)* | 백엔드 CLI 미발견 (CLI spawn 시기) | yes | (Phase 3 SDK 마이그레이션 이후 사실상 미발생) |
| `cli.spawn-failed` *(deprecated)* | spawn 실패 / EACCES / 경로 문제 | yes | (legacy) |
| `cli.crashed` *(deprecated)* | 프로세스 비정상 종료 (exit code ≠ 0) | yes | (legacy) |
| `cli.timeout` *(deprecated)* | CLI 무응답 (타임아웃 값은 OQ6) | yes | (legacy) |
| `auth.expired` | SDK 가 401 / OAuth / expired 패턴 throw | yes | "`claude /login` 실행 후 새 대화" 모달 (AuthExpiredModal) |
| `protocol.parse` | 어댑터 정규화 실패 (예상치 못한 SDKMessage 형태) | no | 디버그 로그 + "일반 오류" 표시 |
| `internal` | 어댑터/Main 내부 버그 | no | 디버그 로그 + "문제가 발생했습니다" |

> `cli.*` 코드 그룹은 Phase 3 SDK 마이그레이션 이후 deprecated. 후속 PR 에서 정리 예정.

### 6.7 Settings 키 카탈로그

`electron-store` 로 영속화 완료. zod 정본은 `app/src/shared/protocol.ts` 의 `SettingsSchema`, 타입 카탈로그는 `IPC_CONTRACT.md` §2.4 와 1:1 (키별 상세는 [arch/backend/persistence.md](arch/backend/persistence.md) §1.2).

| 키 | 타입 | 설명 |
|---|---|---|
| `theme` | `'white' \| 'dark'` | 테마 선택 (2종 — lowercase 표준) |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | 밀도 |
| `sidebarCollapsed` / `sidebarWidth` | `boolean` / `number` | 사이드바 접음/너비 (180–480) |
| `lastBackend` | `Backend \| null` | 마지막 사용 백엔드 (OQ7) |
| `lastSessionId` | `string \| null` | 재개용 마지막 세션 ID |
| `windowBounds` | `{ x; y; width; height } \| null` | 마지막 윈도우 위치/크기 — 재시작 시 복원 |
| `mcpEnabled` / `mcpMeta` | `Record<…>` | MCP 서버 on/off + Orca 전용 메타 (mcp.json 정의와 분리) |
| `skillEnabled` | `Record<string, boolean>` | Skill on/off (부재⇒true) |
| `authBypass` | `boolean` | 인증 게이트 우회 (디버그 토글, DEV 전용) — 0157 에서 `ssoBypass` 에서 개명 |
| `language` / `accountInstructions` | `string` | 시스템 프롬프트 `# User` 헤더로 매 턴 주입 |
| `appFont` | `'sans' \| 'serif' \| 'mono'` | 앱 전체 폰트 |
| `notifyOnComplete` | `boolean` | 턴 완료 시 OS 알림 (창 비활성 한정) |
| `spendingLimitUsd` | `number \| null` | 월간 지출 한도(USD) — null=무제한, 기본 90 (0079) |
| `scheduler` | `{ usageRecompute: { enabled; cron }; updateCheck: { enabled; intervalHours: 1\|6\|12\|24 } }` | 주기 실행 설정 (0091). `updateCheck` = 자동 업데이트 확인 주기 (0156) — 기본 `{ true, 6 }`, 앱 시작 시각 anchor 간격. 시작 시 1회 확인은 이 설정과 무관하게 항상 수행 |

---


### 6.8 orca.json 전역 설정 + provider settings 트리 (Main 전용)

**orca.json (handoff 0014 에서 축소)**: `~/.config/orca/orca.json` 은 앱 자체의 전역 환경변수 파일이다. `sources/` 아래 엔진 배포 리소스가 아니며, 부팅 시 1회 로드해 main 프로세스 메모리에 캐시한다. 파일이 없으면 앱이 `{ "version": 1 }` 템플릿을 atomic write(temp+rename) 로 생성하고, 기존 파일은 덮어쓰지 않는다. 손상 JSON 또는 최상위 스키마 위반은 부팅을 막지 않고 기본값으로 동작하며 원본 파일을 보존한다.

```ts
interface OrcaConfig {
  version: 1
  env?: Record<string, string> // 앱 전역 env — 모든 어댑터 subprocess 공통 베이스. 값에 '${VAR}' 허용
}
```

구 `agents[]` 필드(0009~0010)는 **제거됐다 (클린 브레이크 — 마이그레이션 없음)**. 잔존 파일에서 `agents` 키 발견 시 부팅 경고만 내고 무시한다. 수동 이전 표:

| 구 orca.json agents[] 필드 | 새 위치 |
|---|---|
| `adapter`+`provider` (식별) | `sources/settings/<adapter>/<provider>/` **디렉토리 이름** |
| `authToken` | secret-store(`provider:${providerKey}`, 앱 UI) 또는 settings.json `env.ANTHROPIC_API_KEY`(`${VAR}` 권장) |
| `baseUrl` | settings.json `env.ANTHROPIC_BASE_URL` |
| `env` | settings.json `env` 블록 |
| `models` | `sources/settings/<adapter>/<provider>/settings.json` 의 `env` 모델 키에서 파싱 (`claude/model-parser.ts`) |

**provider settings 트리 (SSOT = sources/)**: provider 별 설정은 어댑터-네이티브 스키마 파일로 사용자가 직접 편집한다. claude 의 settings.json 스키마는 순정 Claude Code settings.json 그대로다 — Orca 전용 키 발명 없음.

```text
~/.config/orca/sources/settings/<adapter>/
└── <provider>/settings.json   # 어댑터-네이티브 스키마 (claude = Claude settings.json)
```

- **열거 SSOT 는 디렉토리 목록**(`readdir`). 모델 목록은 파생 캐시 파일 없이 각 provider 의 `settings.json` 을 열거 시점에 `claude/model-parser.ts` 로 파싱해 얻는다(settings 부재/손상 시 기본 alias 목록으로 관용 열거).
- **모델 파싱 규약**(`features/harnesses/claude/model-parser.ts`, 순수 함수): `env.ANTHROPIC_DEFAULT_{SONNET,OPUS,HAIKU}_MODEL` 키가 있으면 그 alias 만 노출(=`isCustom`), 전무하면 sonnet/opus/haiku 3개를 `model:null` 로 노출. `[1m]` 접미사는 분리해 `oneMillionContext` 로 보존하며 **모델 동일성 판정은 `(모델명, 1M)` 한 쌍**이다 — `X` 와 `X[1m]` 은 서로 다른 실행 대상이라 둘 다 노출된다. `env.ANTHROPIC_MODEL` 은 **노출 목록에도 더한다**(중복이면 추가하지 않는다); top-level `model` 은 default 선정에만 쓴다. default 는 그 명시 모델(`env.ANTHROPIC_MODEL`>`model`)·alias 폴백(sonnet→haiku→opus)을 노출 목록 안에서 평가해 **정확히 1개** 부여한다. `model:null` 항목은 SDK 가 bare alias 를 해석한다(모델명 추측 금지). 같은 규칙을 runtime 카탈로그(`runtime-catalog.ts`)가 `runtimeEnv.ANTHROPIC_MODEL` 로 공유한다.
- provider key 는 `${adapter}-${provider}`(0010 규약 유지, 디렉토리 이름 = provider, `[A-Za-z0-9_-]` 제한). 중복은 디렉토리 구조상 불가능하다.
- 최초 부팅 시 `anthropic/settings.json`(`{"env":{}}`)을 스캐폴드한다(`features/extensions/scaffold.ts`, 멱등 — 기존 파일 불가침).
- provider settings.json 은 **dist 로 배포하지 않는다** — query flag(`options.settings`)로 주입한다(아래 "런타임 주입", standardization.md §5.1 거울 예외). skill 은 `dist/<engine>/.claude/skills/`, mcp 는 `dist/<engine>/.mcp.json` 로 배포한다(설치 스테이징 — standardization.md §5.2).

**런타임 주입 (격리 해제 — 0024 구현됨 / disallowedTools 보류)**: 턴/completion 의 `query()` 는 `settingSources` 옵션을 **생략**해 SDK 기본값(`user`+`project`+`local` 전부)으로 실행한다 — 사용자 전역 `~/.claude` skill·설정을 상속한다. provider settings 는 SDK `resolveSettings`(@alpha, CLI 동일 머지 엔진)로 해석한 effective 를 flag 레이어(`options.settings`)로 주입한다(settingSources 와 직교·최우선). 격리 해제로 끌려오는 사용자 allow 규칙은 **`disallowedTools` 옵션으로 확정 차단**한다(SDK 권한 평가: hooks→deny/disallowed→ask→allow→canUseTool — disallowed 가 allow·canUseTool 보다 상위). settings.json 의 escalating `permissions.defaultMode`(bypassPermissions·acceptEdits·auto)는 무력화된다 — SDK `filterEscalatingDefaultMode` 를 부르는 것이 아니라 `adapters/claude-settings.ts` 의 `ESCALATING_MODES` 목록으로 **동등한 필터를 직접 적용**한다 — **의도된 동작**(권한은 Orca 의 canUseTool + disallowedTools 게이트가 담당). 해석·캐시는 `features/harnesses/settings.ts` 의 `HarnessSettingsService`(mtime 캐시, deploy 후 무효화), claude 종속 어휘는 `adapters/claude-settings.ts` 에 격리된다. resolveSettings 함수 부재(SDK 버전 변동) 시 flat JSON 읽기로 폴백한다. (`claude-adapt.ts` 는 0024에서 `settingSources` 를 생략하도록 정렬됐다. `disallowedTools` 는 D1 사용자 결정 전이라 보류.)

주입 채널은 settings 와 시스템 env **두 레이어**다(handoff 0028 — provider settings == `~/.claude/settings.json`):

- **settings(env 포함) → `options.settings`(flag 레이어, `--settings` 동등)에 인라인 JSON 문자열**로 넣는다. SDK 의 `Options.settings` 는 d.ts 상 `string | Settings` 지만 **런타임 transport 는 값을 직렬화 없이 CLI argv 에 그대로 push** 한다(0.3.143~0.3.175 확인). 따라서 객체를 넘기면 spawn 이 `"[object Object]"` 로 강제 변환해 settings 가 적용되지 않으므로 `JSON.stringify` 한 문자열을 넘긴다(CLI `--settings` 는 "JSON 파일 경로 또는 인라인 JSON 문자열" 을 허용 — cli-reference.md). `settingSources` 를 생략해 상속한 사용자 `~/.claude/settings.json` 위에 이 flag settings 가 얹혀 **덮어쓰므로**, provider settings 의 `env`(auth key 등)가 그 안에 함께 실려 사용자 전역 env 를 이긴다.
- **시스템 env → `options.env`(subprocess env)**: 턴 env(uv 런타임 + orca.json 앱 env 병합 결과)만 싣는다. provider env 는 settings 레이어로 흐르므로 여기엔 없다.

> **argv 노출 트레이드오프 (handoff 0028 — 0015/0018 폐기)**: `options.settings` 는 argv 로 push 되므로 env(평문 auth key 포함)가 same-user process list 에 노출된다. 이는 "앱 환경구성으로 `~/.claude/settings.json` 을 덮어쓴다"는 요구를 위해 수용한다(Claude Code `--settings` 와 동일 특성). 0015/0018 의 env↛argv 분리(`splitProviderSettings`·branded 타입 `ArgvSafeSettings`/`SubprocessEnv`·음성 타입 테스트)와 Orca 고유 `${VAR}` 확장·secret-store 토큰 주입은 제거했다(security.md §1.4). 0015/0018 문서는 historical 보존.

> **격리 해제 — handoff 0014/0015 격리모드 폐기(supersede)**: 0014/0015 가 도입한 `settingSources: []` 격리모드는 폐기한다. `settingSources` 옵션을 **생략(전 소스 로드)**하는 0005 의 원래 입장으로 되돌리되, 그로 끌려오는 사용자 allow 규칙은 `disallowedTools` 로 차단한다(deny/disallowed > allow > canUseTool). **`disallowedTools` 는 D1 사용자 결정 전이라 코드 주입 보류** — 목표 계약이고 현재 코드는 이 옵션을 넘기지 않는다(§6.8 런타임 주입·standardization.md §5.1). 목적은 사용자가 `~/.claude` 에 전역 설치한 skill·설정을 Orca 세션이 상속하게 하는 것이다. OAuth 자격증명(`~/.claude/.credentials.json`/keychain)은 settings 와 무관하게 동작한다. handoff 0014/0015 문서 자체는 historical 기록으로 보존하고 supersession 만 본 절·standardization §5.1·PHASES 에 기재한다.

**provider env 레시피** (`~/.claude/settings.json` 과 동일 — 사용자가 네이티브 env 값을 직접 작성. Orca 는 `${VAR}` 확장 안 함):

| provider | `sources/settings/claude/<provider>/settings.json` |
|---|---|
| anthropic | `{ "env": {} }` (OAuth) 또는 `{ "env": { "ANTHROPIC_API_KEY": "sk-ant-…" } }` |
| bedrock | `{ "env": { "CLAUDE_CODE_USE_BEDROCK": "1", "AWS_REGION": "us-west-2" } }` |
| vertex | `{ "env": { "CLAUDE_CODE_USE_VERTEX": "1" } }` |
| 게이트웨이 | `{ "env": { "ANTHROPIC_BASE_URL": "https://gw.example.com", "ANTHROPIC_AUTH_TOKEN": "<token>" } }` |

provider settings 의 `env` 는 `options.settings`(flag) 로 verbatim 주입되어 사용자 `~/.claude/settings.json` 의 env 를 덮어쓴다(handoff 0028). Orca 는 그 env 에 `${VAR}` 확장도 secret-store 토큰 주입도 하지 않는다(Claude 정책 그대로). 한편 orca.json 의 `env`(시스템/앱 전역 env)는 settings 가 아니라 subprocess env 베이스(`options.env`)로 병합된다(여기엔 `expandEnvRecord` 의 `${VAR}` 확장이 그대로 적용 — settings 경로와 별개).

## 7. Backend Adapters (외부 인터페이스 계약)

어댑터가 외부 CLI/SDK와 주고받는 명령·플래그·SDK 호출의 계약. *내부 구현* (SDKMessage 정규화, 서버 라이프사이클 등) 은 [arch/backend/adapters.md](arch/backend/adapters.md) 참조.

### 7.1 ClaudeAdapter

> SDK `query()` API 시그니처·`Options` 필드·SDKMessage 타입·세션 재개 메커니즘 상세는 [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md) 가 단일 출처. CLI 플래그 ↔ SDK Options 대응 표·SDKMessage→ChatEvent 매핑·MVP 채택 범위·내부 구현 패턴은 [arch/backend/adapters.md](./arch/backend/adapters.md) 참조. 본 절은 *어댑터가 외부와 어떻게 계약하는지* 만 다룬다. 권한 정책 미정(OQ9) 은 `claude-spec.md §5` 참조.

**설치 탐지**:

| 항목 | 절차 | 성공 기준 |
|---|---|---|
| 패키지 해소 | `require.resolve('@anthropic-ai/claude-agent-sdk')` | 모듈 발견 |
| Native binary | SDK 의 `optionalDependencies` (`@anthropic-ai/claude-agent-sdk-{darwin-arm64,darwin-x64,linux-x64,win32-x64}`) 가 자동 설치 | `query()` 호출이 `MODULE_NOT_FOUND` 없이 시작 |
| 수동 경로 (실패 시) | `options.pathToClaudeCodeExecutable` 로 사용자 지정 binary 경로 허용 | UI 안내는 Phase 3+ anchor |

**자동 설치**: 별도 절차 없음 — Claude Code 는 SDK 패키지의 `npm install` 시점에 platform binary 가 자동 설치된다. (CLI 글로벌 설치 `npm install -g @anthropic-ai/claude-code` 는 폐기.) 인스톨러 모듈은 **opencode 전용** 으로 축소 — §8 참조.

**메시지 전송** (매 턴):
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const msg of query({
  prompt: text,
  options: {
    resume: sessionId ?? undefined,
    includePartialMessages: true,
    cwd,
    // permissionMode / canUseTool / hooks: Phase 4 anchor (§10)
  }
})) {
  yield normalize(msg);  // 설명용 축약. 현행 SDKMessage → NormalizedEvent[] 변환은 claude-map.ts 참조
}
```

- `prompt: string`: single-shot 입력 (사용자 메시지). `AsyncIterable<SDKUserMessage>` 형태는 Phase 4 anchor (다중 이미지·실시간 중단 필요 시).
- `options.includePartialMessages: true`: `SDKPartialAssistantMessage` (text_delta) 스트리밍 — CLI 의 `--verbose --include-partial-messages` 대체.
- `options.resume`: 2턴 이상에서 조건부 — `sessionId != null` 시 첫 턴의 ID 전달. CLI `--resume <id>` 와 1:1 대응.
- `options.cwd`: 작업 디렉토리 — CLI spawn 의 `{ cwd }` 대체.

**첫 응답에서 sessionId 추출**:
- 첫 SDKMessage 가 `SDKSystemMessage(subtype: 'init')` — 그 `session_id` 필드 추출
- 현행 구현은 `session.updated` 등 `NormalizedEvent`로 정규화한다 ([claude-map.ts](../app/src/main/adapters/claude-map.ts), TRD §6.2).
- Renderer 가 받아서 `state.sessionId` 에 저장

**인증 만료 감지**:
- SDK 가 throw 하는 에러 객체의 메시지/코드에서 `401` / `OAuth` / `expired` 패턴 매칭 → `error / auth.expired`
- UI: `claude /login` 명령 카피 버튼 + 새 대화 권유 (정책은 CLI 시기와 동일)

**환경변수**:

| 변수 | 값 | 용도 |
|---|---|---|
| `HOME` | 사용자 홈 디렉토리 | SDK 가 `~/.claude` 의 OAuth/API 자격증명 자동 사용 + 세션 jsonl 저장 (`~/.claude/projects/<cwd>/`) |
| `CLAUDE_*` | (OQ에서 확정) | 필요 시만 |

PATH 의존성 (npm 글로벌 bin) 은 폐기 — SDK 의 `optionalDependencies` 가 platform binary 를 패키지 내부에서 해소한다.

### 7.2 OpencodeAdapter

**미구현.** SDK 설치와 실제 OpenCode 실행은 별개다. CLI/서버 설치·프로세스 소유권·포트·인증·재시작 정책은 후속 설계에서 확정한다.

| 항목 | 현행 근거 / 적용 상태 |
|---|---|
| 패키지 | [SDK 해설 §1](opencode-sdk-spec.md#1-조사-기준과-채택-상태)의 고정 버전; production import 없음 |
| client 호출 | `createOpencodeClient({ baseUrl, fetch })`; root/v1·v2 legacy·native의 인자와 endpoint가 다름 |
| 입력과 이벤트 | `session.prompt`와 SSE 구독은 별도 경로; native는 admission과 실행 완료도 구분 |
| 전송 | root SSE는 주입 fetch를 우회하는 제약이 있어 `/v2` 경계 검증이 필요 |
| 메시지·권한 | 실제 SDK 계약은 [해설](opencode-sdk-spec.md), Orca 정규화 권고는 [migration 연구](etc/study/opencode/orca-migration-guide.md) |
| 검증 범위 | 패키지 타입/JS와 무네트워크 client 계약 검사; 실제 서버·모델·패키징 통합은 미실행 |

### 7.3 AdapterRegistry & Backend 선택

**선택 알고리즘** (앱 부트 시):

1. 두 어댑터 `isInstalled()` **병렬 호출**
2. 결과:
   - **둘 다 설치**: Renderer에 선택지 제시 또는 OQ7 정책 (마지막 사용 / 기본값)
   - **한쪽만 설치**: 자동 선택
   - **둘 다 미설치**: 인스톨러 다이얼로그 트리거
3. 선택 후 `AdapterRegistry.active` 에 저장

**세션 중 전환**: v1 에서는 **불가능** (구조상 지원하지만 UI는 제공 안 함). Phase 2+ 검토.

---

## 8. CLI Installer (기능 사양)

사용자에게 보이는 인스톨러 다이얼로그와 프로세스.

> **(2026-05-18 갱신)** 본 인스톨러는 **opencode 전용** 으로 축소됨. Claude Code 는 SDK `@anthropic-ai/claude-agent-sdk` 의 `optionalDependencies` 가 platform binary 를 자동 처리하므로 인스톨러 대상 아님. Phase 3 단일 백엔드 (claude) 운영에서는 인스톨러 다이얼로그 자체가 트리거되지 않는다. opencode 어댑터 활성화 시점 (§10 anchor) 에 본 절이 다시 의미를 가진다.

### 8.1 다이얼로그 단계

| 단계 | 내용 | UI 요소 |
|---|---|---|
| 1. 진단 | "opencode 확인 중..." | 스피너 + 로그 |
| 2. 선택 | "opencode 를 설치할까요?" | curl / 수동 라디오 버튼 + [시작] |
| 3. 진행 | 설치 진행률 + 라인 단위 로그 | 프로그레스바 + 터미널 텍스트 |
| 4. 성공 | "설치 완료! [새 대화]" | 확인 버튼 |
| 4. 실패 | "설치 실패. [수동 명령 복사] [진단 다시]" | 수동 명령 텍스트박스 + 버튼 |

### 8.2 사전 의존성 점검

| 조건 | 검사 | 메시지 |
|---|---|---|
| curl 선택 시 | curl 존재 | `which curl` |
| Windows | PowerShell 사용 가능 여부 | (opencode 설치 스크립트 URL 확정 필요) |

### 8.3 설치 후 검증

- `isInstalled()` 재호출 → 설치 확인
- 실패 시 PATH 갱신 안내 (특히 npm): "새 터미널을 열거나 `source ~/.bashrc` 실행"

---

## 9. Build & Distribution

### 9.1 npm Scripts (electron-vite)

| 스크립트 | 목적 | 상세 |
|---|---|---|
| `npm run dev` | 개발 서버 (HMR) | Renderer Vite HMR + Main/Preload watch + electron 실행 |
| `npm run build` | 프로덕션 빌드 | `typecheck` 후 3-config 번들 (`prebuild` 가 better-sqlite3 Electron ABI 보장) |
| `npm run start` | 빌드 결과 미리보기 | electron-vite preview 모드 |
| `npm run build:win` | Windows .exe 패키징 | electron-builder NSIS |
| `npm run build:mac` | macOS .dmg 패키징 | electron-builder DMG + 서명 |
| `npm run build:linux` | Linux AppImage 패키징 | electron-builder AppImage |
| `npm run typecheck` | TypeScript 검증 | 3분할 — `tsconfig.node.json` + `tsconfig.web.json` + `tsconfig.test.json` |
| `npm run lint` | ESLint | `eslint.config.mjs` (`./src` + `./scripts`) |
| `npm run format` | Prettier | `.prettierrc.yaml` |
| `npm test` | 단위 테스트 | `pretest` Node ABI 보장 → `vitest run` + `node --test "scripts/*.test.mjs"` |
| `npm run release:{patch,minor,major}` | 릴리스 bump | `npm version <bump>` — 커밋 + `v*` 태그 원샷 (0088). 버전 수동 편집 금지 |

### 9.2 패키져 · CI/CD (0087~0089 구성)

- 설정 파일: `electron-builder.yml`. Windows: **x64 unsigned NSIS installer** (1차 타깃, SmartScreen 경고 수용).
- macOS: DMG (arm64 + x64), notarization 미도입 / Linux: AppImage — 둘 다 후순위.
- **CI** (`.github/workflows/ci.yml`): `main` push(paths `app/**`) — 마이그레이션 append-only 가드 → lint → typecheck → test (windows-latest·Node 22).
- **릴리스** (`.github/workflows/release.yml`): `v*` 태그 → 버전 검증(`validate-release-version.mjs`) → 게이트 → `build:win` → **draft** GitHub Release(installer·latest.yml·blockmap) → sha512 검증(`validate-dist.mjs`). Publish = 수동 게이트. 절차 정본 `docs/guides/release-operations.md`.
- 잔여 OQ3: **코드 서명 / macOS 공증 / staged rollout** (§10 anchor).

### 9.3 환경변수

| 변수 | 값 (dev/build) | 용도 |
|---|---|---|
| `NODE_ENV` | `"development"` / `"production"` | 빌드 최적화 |
| DevTools | dev 빌드에서만 F12로 열기 | 보안 (production 제한) |

---

## 10. Future Work / Out-of-Scope

Phase 1 MVP 범위 밖. **anchor 수준만 언급** (자세한 설계는 향후).

- **(anchor) 시스템 트레이** — UI/Main 진입점 미지정. Phase 2+ 검토.
- ~~(anchor) electron-updater + GitHub Releases~~ — **구현 완료 (0084~0089, §9.2)**. 잔여 = 코드 서명/공증/staged rollout.
- ~~(anchor) Auto-update 채널~~ — stable 단일 채널로 출발 (beta 채널 분리는 Future).
- **(anchor) 하드웨어 어댑터 (BoardAdapter)** — USB/카메라 제어. `adapters/` 에 board 어댑터를 두는 자리를 예약(파일 미생성), 네이티브 모듈 (`orca-board.node`, libusb) Phase 2~3.
- **(anchor) opencode 어댑터** — SDK는 설치됐으나 어댑터·서버 lifecycle·백엔드 선택·OpenCode MCP 변환기는 미구현이다(`Backend`=`'claude'`). [SDK 해설](opencode-sdk-spec.md)과 [마이그레이션 연구](etc/study/opencode/orca-migration-guide.md)를 후속 설계 입력으로 쓰며, OQ7/OQ10·권한·서버 소유권을 결정한 뒤 활성화한다. 기존 `toClaudeConfig`의 OpenCode 대응 변환기 목표는 유지하되 실제 SDK 설정 형상과 보안 경계는 별도 검증한다.
- **(anchor) OpenAI Compatible 백엔드** — `SessionAdapter` 인터페이스 재활용 가능. 3번째 어댑터 구현체 추가.
- **(anchor) Agent SDK 고급 기능** — `permissionMode` / `canUseTool` / `hooks` / `createSdkMcpServer` (in-process custom tools) / 외부 `mcpServers` / `forkSession` / `startup()` (사전 워밍) / `AsyncIterable<SDKUserMessage>` 스트리밍 입력. 채택 표는 [arch/backend/adapters.md](arch/backend/adapters.md) §1.7 의 ⏳ 행 참조. Phase 4+ — 도구 권한 정책(OQ9) 결정 후 진행.
- **(anchor) 어댑터 도구명 정규화 (OQ10)** — claude vs opencode 의 `tool_use.name` / `tool_use.input` 차이 해소 정책. PRD §11 OQ10 결정 후 어댑터별 매핑 표 확정.
- **(anchor) ChatEvent sessionId 확장** — Phase 4 멀티 세션 진입 시 모든 변형(`assistant_delta` / `assistant_message` / `tool_use` / `tool_result` / `result` / `error`)에 `sessionId` 필드 추가. main↔renderer IPC 는 Electron 의 ordered+lossless 보장을 그대로 활용 (별도 메시지큐 미도입). 상세 anchor 는 [arch/frontend/state.md](arch/frontend/state.md) §2.
- **(구현됨) MCP & Skill 통합 레이어** — 정규 소스 = `~/.config/orca/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`, 평문 비밀 0). 비밀은 secret-store(safeStorage, env-var 이름 키잉), enabled/description 은 settings. `${VAR}` resolver = safeStorage→process.env(미해결 시 서버 드롭). **변환기**(`toClaudeConfig`, 순수 — opencode 대칭 짝은 미구현). **확장 정규 레이어**: `~/.config/orca` 디렉토리 자체를 Claude 로컬 플러그인으로 머티리얼라이즈(`.claude-plugin/plugin.json` + 정규 소스 `skills/`·`agents/`·`commands/`) → query() 에 `plugins:[{local, path: ~/.config/orca}]`+`skills:'all'`. Skill 은 양 백엔드 공통(opencode `.claude/skills` 네이티브), Hook/full-plugin 은 백엔드 종속이라 정규화 제외. 레거시 `orca-mcp` 1회 마이그레이션. **(재정의 — 0024 코드 정렬됨 / disallowedTools 보류)** skill 로드는 plugin 컨테이너 폐기 후 `settingSources` 경로로, mcp 는 `dist/<engine>/.mcp.json` 거울로 정렬되고 agents·commands·hooks·plugin 은 engine-specific 으로 연기된다(standardization.md §5.1, adapters.md §3.1). 상세 [arch/backend/security.md](arch/backend/security.md) §1.4.
- **(anchor) Captures / Projects 확장** — PRD §9 Future Scope. 별도 IPC 도메인 + 모듈 추가.
- ~~(anchor) 멀티 세션 / 과거 대화 목록~~ — **구현 완료** (세션별 SessionRuntime + 사이드바 세션 목록 + FTS 검색 — runtime-ipc.md §1). 동시 스트리밍 *UX*(배지·탭)만 잔여.
- ~~(anchor) 재시작 재개~~ — **구현 완료** (`lastSessionId` 부트 복원 — BootRedirector).
- ~~(anchor) Zustand 전환~~ — **구현 완료 (0008/0013)** — feature별 store + chat `sessions: Record` 외피 + 외부 dispatch(`receive(ev)`). 상세 [arch/frontend/state.md](arch/frontend/state.md) §1.
- ~~(anchor) 로컬 DB (Phase 3+)~~ — **구현 완료** (better-sqlite3, `infra/db/migrations/`, DB=SSOT). 상세 [arch/backend/persistence.md](arch/backend/persistence.md).
- **(anchor) Artifact FS 저장 (Phase 3+)** — `<userData>/artifacts/<sessionId>/<uuid>.<ext>`. DB 에는 경로·해시·크기만. 클라우드 동기화 없음 (export/import 만). `GLOSSARY.md` "Artifact" / [arch/backend/persistence.md](arch/backend/persistence.md).
- **(anchor) safeStorage 자격증명** — MCP 인증 비밀은 **구현 완료**(secret-store). 어댑터별 base URL + API key 저장은 잔여. [arch/backend/security.md](arch/backend/security.md) §1.4.
- ~~(anchor) 추가 IPC 도메인 (Phase 3+/Future)~~ — `session`·`project`·`search`·`mcp`·`cost`·`update` 등 대부분 도입 완료(IPC_CONTRACT §2). 잔여 예약은 IPC_CONTRACT §2.14.
- **PRD §11 OQ** — 미정 항목은 여기서 결정하지 않음. 결정값 도착 시 본 문서 갱신. (OQ1 React 19·OQ3 패키징/자동업데이트는 해소 — PRD §11 표기 참조.)

---

## 11. Testing Strategy

### 단위 테스트 (Vitest)

- **어댑터**: `NormalizedEvent` 정규화 (`claude-map.ts` — SDKMessage→NormalizedEvent), 에러 감지 (auth.expired 패턴, SDK throw 처리)
- **Reducer**: `chatReducer` 액션별 상태 전이 정확성 (parts/ask/permission 계열 스위트)
- **IPC 검증**: zod 스키마 (SendChatMessage, Settings, InstallStatus 등 — `protocol.*.test.ts`)
- **런타임/기능 슬라이스**: scheduler(cron 검증·겹침 방지)·usage(집계/한도 파생)·updater(재시작 게이트)·boot-report 등 — 각 슬라이스 동거 `*.test.ts`
- **(구현됨) MCP 변환 파이프라인**: `expandEnv`(${VAR} 정의/미정의 드롭·다중 변수·빈 소스) + `toClaudeConfig`(구조 항등·sse 보존)·dropped 전파·빈 소스 — opencode 변환기(stdio→local·http/sse→remote)는 미구현 — `features/extensions/mcp/{expand,convert}.test.ts`. electron 비의존 순수 함수.
- **스크립트 스위트** (`node --test "scripts/*.test.mjs"`, `npm test` 가 자동 실행): ensure-sqlite-abi · check-migrations-appendonly · validate-dist · validate-release-version.

### 통합 테스트

- Mock SDK (`query()` AsyncIterable 시뮬레이션 — SDKSystemMessage / SDKPartialAssistantMessage / SDKResultMessage 순서 재현)
- Mock opencode 서버 (SSE 스트림 시뮬레이션)
- IpcRouter ↔ Adapter 흐름 (메시지 → 어댑터 → 정규화 → IPC 송신 검증)

### E2E 테스트 (Playwright on Electron — **미도입**)

Playwright 는 아직 devDependency 로 설치되지 않았다(§4). 도입 시 아래 시나리오가 1차 후보:

- 신규 대화 생성 → 메시지 입력 → 스트리밍 표시 → 완료
- 대화 1개 축적 후 새 대화 → sessionId 리셋 확인
- 설치 실패 시 수동 명령 표시 (mock CLI 설치 미지원)

현재 GUI 검증은 dev 디버그 하네스(MockAdapter 시나리오 13종 — IPC_CONTRACT §2.13) + 사람 수동 체크리스트로 갈음한다.

### 매뉴얼 체크리스트 (QA)

- Claude Code / opencode 각각 테스트 (둘 다 설치된 환경)
- 백엔드 선택 → 메시지 전송 → 응답 스트리밍 → 종료
- Tweaks 테마 변경 → 전 화면 반영 검증
- 키보드 단축키 (Ctrl+N, Enter (전송) / Shift+Enter (줄바꿈) — N3 2026-05-13 결정)
- 에러 복구 (재시도, "claude /login" 안내 등)

---

## 12. References

- `docs/PRD.md` — 제품 정의 (WHAT)
- `docs/etc/llm-chat-desktop-strategy.md` — 기술 결정 근거
- `docs/ARCHITECTURE.md` — Renderer 구조·상태 관리·도메인 화면 카탈로그
- `docs/ARCHITECTURE.md` — Main 구조·Adapter·영속성·자격증명·보안
- `docs/IPC_CONTRACT.md` — Main ↔ Renderer 채널 SSOT
- `docs/GLOSSARY.md` — 용어 단일 출처
- `docs/claude-code-spec.md` — Claude Code CLI 공식 스펙 미러 (§7.1 외부 계약의 단일 출처)
- `app/AGENTS.md` — 코드 작업 가이드
- `project/electron/` — 시각 기준 프로토타입


### 6.8.1 Agent/model 선택 (0010-agent-model-select → 0014 원천 교체)

- provider 환경은 provider key(`${adapter}-${provider}`)로 식별한다. 원천은 0014 부터 orca.json agents[] 가 아니라 **`sources/settings/<adapter>/` 디렉토리 트리**다 (§6.8) — 중복 키는 구조상 불가능.
- Composer 는 `orca:agent:list` DTO(`key`, `adapter`, `provider`, `models`, `supported`)로 `${providerKey}/${alias}` 모델 메뉴를 구성한다. `models` 항목은 `{alias, model, isCustom, oneMillionContext, isDefault}`(`AgentModelView`) 이며 settings.json 파싱 결과다. wire/state 는 표시 문자열이 아니라 `providerKey` 와 `modelFamily` 구조 필드를 사용한다. **`modelFamily` = 모델 선택 식별자 = SDK 에 넘기는 모델 문자열**(`model ?? alias` + 1M 이면 `[1m]`)이고 규칙은 `shared/model-identity.ts` 하나가 갖는다 — main(`features/harnesses/models.ts`)과 renderer(`composer/modelSelection.ts`)가 위임한다.
- 세션은 adapter(`sessions.backend`) 단위로 잠기며 같은 adapter 안에서는 provider/model family 를 턴 단위로 전환할 수 있다. `sessions.provider_key` 는 바인딩 제약이 아니라 마지막 사용 provider 기록이다. 턴 해석 폴백: payload providerKey(어댑터 일치 시) → 세션 provider_key → 기본 provider(anthropic 우선, 없으면 이름순 첫 디렉토리).
- 앱 추가 provider 의 auth token 은 secret store `provider:${provider key}` 에만 저장한다. DB/renderer/agent list DTO 는 토큰·env 를 노출하지 않는다.
