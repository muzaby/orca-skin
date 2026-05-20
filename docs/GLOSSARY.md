# Glossary

> 이 프로젝트에서 사용하는 용어를 한 곳에 정의한다. 문서·코드·UI 라벨이 같은 개념을 다르게 부르지 않도록 한다.
> 최종 업데이트: 2026-05-20
> 관련 문서: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md), [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md), [IPC_CONTRACT.md](./IPC_CONTRACT.md), [TRD.md](./TRD.md), [PRD.md](./PRD.md)

## 1. 도메인 용어

| 용어 | 정의 | 코드상 명칭 | 진실의 기준 |
|---|---|---|---|
| **Session** | 하나의 대화 컨텍스트. `sessionId` 로 식별. **현재 (Phase 1·2)**: 어댑터가 발급 (Claude Code SDK 의 `--resume` 호환 ID). **Phase 3+**: Orca 로컬 DB 의 row 가 진실의 기준이 되며 어댑터 외부 저장 (jsonl 등) 은 단방향 동기화 소스. | `sessionId: string`, `ChatState.sessionId` | TRD §6.5 / `app/src/shared/ipc.ts` |
| **Message** | 세션 안의 단일 발화. `role: 'user' \| 'assistant'` + 본문 + (assistant 의 경우) 부착된 ToolCall 들. | `Message`, `ChatState.messages` | `app/src/renderer/src/state/chatReducer.ts` |
| **ChatEvent** | 어댑터→Renderer 정규화 스트림의 단위. 7가지 variant 의 discriminated union (`init / assistant_delta / assistant_message / tool_use / tool_result / result / error`). | `ChatEvent` | `app/src/shared/ipc.ts:37-47` (TRD §6.2 SSOT) |
| **Delta** | 어시스턴트 응답이 스트리밍되는 동안 도착하는 부분 텍스트 조각. UI 에는 `pendingDelta` 에 누적되며 DB 에는 최종 메시지만 저장 (Phase 3+). | `assistant_delta`, `ChatState.pendingDelta` | TRD §6.2 / `chatReducer.ts` |
| **Backend** | LLM 실행 백엔드의 식별자. **현재**: `'claude-code'` 단일. **Future**: `'opencode'` 등 추가 가능. | `Backend` | `app/src/shared/ipc.ts:20` |
| **SessionAdapter** | 모든 백엔드가 구현하는 공통 인터페이스 (`isInstalled / install / sendMessage`). LLM 직접 호출이 아니라 외부 CLI/SDK 의 래퍼다. | `SessionAdapter` | `app/src/main/adapters/types.ts` |
| **AdapterRegistry** | 등록된 어댑터의 설치 상태를 추적하고 활성 백엔드를 결정. | `AdapterRegistry` | `app/src/main/adapters/registry.ts` |
| **Tool Call** | 어시스턴트가 호출한 도구 1회 (Read / Write / Bash 등). `toolUseId` 로 input/result 쌍이 결합된다. | `tool_use`, `tool_result` ChatEvent | TRD §6.2 |
| **Skill** | `SKILL.md` frontmatter (name, description, argument-hint) 로 정의된 슬래시 명령. 입력창에서 `/skillname` 으로 호출. **스캔 경로는 어댑터별로 다르다** (현재는 claude-code 의 `~/.claude/skills/` + `<cwd>/.claude/skills/` 만). | `SkillInfo` | `app/src/main/skills/scan.ts` / `app/src/shared/ipc.ts:100-104` |
| **Tweaks** | 사용자 환경 설정 — `theme` / `density` / `sidebarCollapsed`. electron-store 로 영속. | `Tweaks` | `app/src/renderer/src/app/useTweaks.ts` |
| **Artifact** | 큰 산출물 — 첨부 파일, 모델이 생성한 markdown / 코드 / 이미지 등. **Phase 3+ 채택 결정**: 파일 시스템 (`<userData>/artifacts/<sessionId>/...`) 에 저장하고 DB 에는 경로·해시·크기만 보관. 현재 미구현. | (Phase 3+ 도입 예정) | BACKEND_ARCHITECTURE.md §6 |
| **Credential** | 어댑터별 자격증명 — base URL + API key 등. **Phase 3+ 채택 결정**: Electron safeStorage (OS keychain) 로 암호화 저장. 현재는 미구현 (claude-code 어댑터는 SDK 가 `~/.claude` 자격증명 자동 사용). | (Phase 3+ 도입 예정) | BACKEND_ARCHITECTURE.md §8 |
| **Project** | 프로젝트 카드 그리드 화면. **Phase 1 mockup 만** 구현 (실 데이터 없음). PRD §9 Future Scope. | `Projects.tsx` | PRD §9 |

## 2. 아키텍처 용어

| 용어 | 정의 |
|---|---|
| **Main Process** | Electron 의 Node.js 환경. BrowserWindow / IPC 핸들러 / SDK 호출 / 파일 시스템 / 설정 저장 담당. |
| **Renderer Process** | Electron 의 Chromium sandbox 환경. React UI 렌더링 담당. Node API 직접 접근 불가. |
| **Preload** | Main 과 Renderer 사이의 다리. `contextBridge.exposeInMainWorld('orca', ...)` 로 화이트리스트된 API 만 노출. |
| **IPC** | Inter-Process Communication. Main ↔ Renderer 메시지 채널. `orca:<domain>:<action>` 명명. |
| **contextBridge** | Electron API. preload 스크립트가 sandboxed renderer 에 안전하게 함수를 노출하는 도구. |
| **window.orca** | Renderer 에서 IPC 호출을 위한 단일 진입점. 노출 표면은 [IPC_CONTRACT.md](./IPC_CONTRACT.md) §2 참조. |
| **Phase 1·2·3·4** | PRD §8 의 단계별 로드맵. Phase 1 = 시각 재현, Phase 2 = IPC + 단일 어댑터 + 세션 재개, Phase 3 = 과거 대화 목록, Phase 4 = 멀티 세션. |

## 3. 사용하지 않는 용어 (혼동 방지)

다음 용어는 이 프로젝트에서 **사용하지 않는다**. 의미가 모호하거나 다른 용어와 겹친다.

- ❌ **"LLM Provider"** → **Backend** 또는 **SessionAdapter** 로 통일. Orca 는 LLM API 를 직접 호출하지 않고 외부 CLI/SDK 를 래핑한다.
- ❌ **"Conversation"** → **Session** 으로 통일.
- ❌ **"Thread"** (대화 의미) → **Session** 으로 통일.
- ❌ **"Chat"** (도메인 객체로) → **Session** 으로 통일. "Chat 화면" / "ChatPane" 처럼 *UI 영역 이름* 으로는 허용.
- ❌ **"Token"** (UI 청크 의미로) → **Delta** 로 통일. LLM token count 의미로는 사용 허용 (`inputTokens` / `outputTokens`).
- ❌ **"Capture"** — Orca 의 도메인 카탈로그에서 제외 (사용자 결정). `CapturesPlaceholder.tsx` 코드는 남아있으나 문서·논의에서는 거론하지 않는다.
- ❌ **"Provider"** (LLM 의미로) — 위 "LLM Provider" 와 동일.
