# Orca — Product Requirements Document (v1)

> Claude Code / opencode CLI 를 백엔드로 활용하는 검증 엔지니어용 데스크톱 LLM 어시스턴트

| 항목 | 값 |
|---|---|
| 제품명 (코드네임) | **Orca** |
| 문서 버전 | v1 (MVP 정의) |
| 1차 소스 | `docs/llm-chat-desktop-strategy.md` |
| 2차 소스 | `project/` 프로토타입 (Variation A · "Claude Desktop classic"), `chats/chat1.md` |
| 작성 의도 | 무엇을 만들고 무엇을 만들지 *않는지* 를 합의된 결정에 한해 정리. 새 결정은 만들지 않으며, 미정 항목은 §11 Open Questions 로 모은다. |

---

## 1. Overview & Vision

Orca 는 호스트에 이미 설치된 **Claude Code** 또는 **opencode** CLI 를 백엔드 엔진으로 활용해, 데스크톱 GUI 에서 LLM 과 대화할 수 있게 해주는 Electron 앱이다. LLM/컨텍스트/세션 로직은 CLI 에 완전 위임하고, 앱 자체는 **어댑터 + UI** 만 직접 구현한다.

장기적으로는 한국어 사용 **이미지 센서 검증 엔지니어** 의 워크플로 (라이브 카메라 → 캡처 → AI 분석 → 메트릭) 를 한 화면에서 다루는 것을 지향하지만, **v1 의 본문은 채팅 + 세션 재개 코어** 로 한정하고 도메인 화면은 §9 Future Scope 로 분리한다.

핵심 한 줄: *"GUI 가 들고 있는 컨텍스트 관리 코드는 0줄이다."* (전략 §12)

---

## 2. Goals

| # | 목표 | 출처 |
|---|---|---|
| G1 | Claude Code 와 opencode 두 CLI 를 모두 지원하며, 각 CLI 가 제공하는 공식 메커니즘을 그대로 이용한다. | 전략 §1.1 |
| G2 | 직접 구현 영역을 **어댑터 + UI** 로 최소화한다. | 전략 §1.2 |
| G3 | 한 활성 대화 안에서 **컨텍스트가 유지** 되어야 한다 (LLM 이 이전 턴들을 기억). | 전략 §4 |
| G4 | CLI 가 미설치인 호스트에서도 앱이 **설치를 안내·시도** 한다. | 전략 §1.2, §10 |
| G5 | 단일 세션 → 재시작 재개 → 과거 목록 → 멀티 세션 으로 **단계적 확장** 이 가능한 구조. | 전략 §11 |

---

## 3. Non-goals

| # | 비-목표 | 이유 |
|---|---|---|
| NG1 | LLM/컨텍스트/세션 영속화를 GUI 가 직접 관리. | CLI 에 완전 위임 (전략 §8.3). |
| NG2 | 멀티 세션 동시 실행 (여러 대화를 한 번에 진행). | v1 비대상, Phase 4 검토 (전략 §11). |
| NG3 | CLI 자체를 앱에 번들. | 호스트 설치 가정, 부재 시 가이드 (전략 §1.2). |
| NG4 | 자체 모델 호스팅 / 프롬프트 로직. | CLI 가 담당 (전략 §1.1). |
| NG5 | 하드웨어 보드 직접 제어, Captures 파이프라인, Skills/MCP 카탈로그. | v1 비대상 — §9 Future Scope. |

---

## 4. Target Users / Persona

| 페르소나 | 설명 | 단서 |
|---|---|---|
| **P1. 검증 엔지니어 (1차)** | 한국어 사용. 이미지 센서 / 카메라 모듈 QA. 노출·게인 튜닝, 저조도 SNR, MTF/SFR, Bayer 채널 분석 등이 일상. | 프로토타입 도메인 텍스트 (`OV-9282`, `IMX-415`, "G2 채널", "차량용 캠"), `chats/chat1.md`. |
| **P2. CLI 사용 개발자 (2차)** | Claude Code / opencode 를 이미 쓰는 개발자. 터미널 대신 GUI 로 같은 세션을 이어가고 싶음. | 전략 §1.2 운영 가정. |

v1 의 기능 표면은 P2 만으로도 충분히 커버 가능하다. P1 의 도메인 워크플로(카메라/캡처/메트릭) 는 §9 Future Scope.

---

## 5. Operating Assumptions

전략 §1.2 의 가정을 그대로 채택한다.

| 항목 | 내용 |
|---|---|
| 백엔드 CLI 위치 | 호스트(사용자 PC)에 설치되어 있다고 가정 |
| CLI 부재 시 | 앱이 설치를 안내·시도, 실패 시 수동 명령 안내 |
| 지원 CLI | Claude Code, opencode (둘 다) |
| 직접 구현 범위 | 어댑터 + UI 만, LLM/컨텍스트 로직은 CLI 에 완전 위임 |

---

## 6. MVP Scope (v1.0)

### 6.1 Functional Requirements

| ID | 요구사항 | 상세 |
|---|---|---|
| F1 | **Chat 입력/스트리밍** | 멀티라인 composer, 전송 → 응답이 토큰 단위 스트리밍으로 점진적으로 그려진다. |
| F2 | **마크다운 렌더링** | 본문 마크다운 + 코드 블록 syntax highlighting. (권장 라이브러리는 §11 OQ.) |
| F3 | **도구 호출 표시** | LLM 이 도구를 부르면 카드(이름·인자·상태·소요시간)로 인라인 표시. (CLI 이벤트 정규화로 충분.) |
| F4 | **단일 활성 대화 컨텍스트 유지** | 같은 `sessionId` 를 매 턴 CLI 에 전달해 이전 턴 메시지/도구 호출 결과가 컨텍스트 윈도우에 누적된다. |
| F5 | **새 대화** | "새 대화" 버튼 → `sessionId = null` 리셋. 다음 메시지 전송 시 새 ID 발급. |
| F6 | **백엔드 선택** | Claude Code 와 opencode 가 모두 설치된 경우 선택. 한 개만 설치된 경우 자동 선택. |
| F7 | **CLI 설치 자동화** | 둘 다 미설치 시 다이얼로그 → `npm install -g @anthropic-ai/claude-code` / `curl -fsSL https://opencode.ai/install \| bash` 를 사용자가 선택해 시도. |
| F8 | **설치 실패 폴백** | 자동 설치 실패 시 수동 명령을 화면에 표시. Node.js 미설치 / 글로벌 npm 권한 부족 케이스 OS 별 안내. |
| F9 | **인증 만료 처리** | Claude Code OAuth 토큰 만료(401) 감지 시 사용자에게 `claude /login` 안내. (전략 §6.5) |
| F10 | **Tweaks 패널** | 테마 팔레트(Classic/Dark/Cool), 밀도(조밀/보통/넓게), 사이드바 접기. CSS 커스텀 프로퍼티로 적용. (프로토타입에 정의됨.) |

### 6.2 Non-functional Requirements

| ID | 요구사항 | 상세 |
|---|---|---|
| N1 | 플랫폼 | macOS / Windows / Linux. Electron 다중 빌드. |
| N2 | i18n | 한국어 1차. 일부 기술 라벨/터미널 출력은 영어 그대로. |
| N3 | 접근성 | 키보드 내비게이션, 다크모드 지원 (Tweaks 경유). |
| N4 | 데이터 위치 | 세션 본체는 CLI 저장소 (`~/.claude/projects/<cwd>/<id>.jsonl`, `~/.local/share/opencode/`). 앱 자체는 메모리에 `sessionId` 만 보유. |
| N5 | 응답 지연 가이드 | 첫 토큰까지의 지연 / 시작 시간 SLA — §11 OQ. |
| N6 | 보안 | OAuth/API 키 자체 저장 없음. CLI 가 처리. |

---

## 7. Architecture & Tech Stack

### 7.1 Stack (전략 §2.1)

| 계층 | 채택 기술 | 비고 |
|---|---|---|
| 데스크톱 셸 | **Electron** | Anthropic Claude Desktop 도 동일 채택 |
| 빌드/스캐폴딩 | **`@quick-start/electron` (react-ts 템플릿)** | electron-vite (Vite 기반) |
| 언어 | **TypeScript** | CLI JSON 메시지 타입 안정성 |
| UI 프레임워크 | **React 권장** (확정 §11 OQ) | 메시지 스트리밍·마크다운 렌더링에 적합 |
| 마크다운 렌더링 | **react-markdown + remark-gfm + shiki** 확정 (§11 OQ2, Phase A) | LLM 응답 렌더링. GFM + 코드 블록 syntax highlighting (11개 언어) |
| 스타일링 | **Tailwind CSS** | TRD §4 채택. 디자인 토큰은 §10 CSS 커스텀 프로퍼티 그대로, 컴포넌트 클래스만 Tailwind 유틸리티 |

### 7.2 CLI 연결 패턴 (전략 §3)

| 패턴 | 방식 | v1 채택 |
|---|---|---|
| 1. 터미널 에뮬레이션 (`node-pty` + `xterm.js`) | CLI 화면을 그대로 띄움 | ✗ 메시지 단위 가공 어려움 |
| **2. 구조화 I/O (`stream-json` / HTTP API)** | **JSON 송수신** | ✓ **메인** |
| 3. 세션 파일 동기화 | CLI 세션 파일 읽기 | △ Phase 3 보조 (과거 목록) |

### 7.3 Adapter Interface (전략 §8.2)

```typescript
export type Backend = 'claude-code' | 'opencode';

export interface ChatEvent {
  type: 'init' | 'assistant_delta' | 'assistant_message'
      | 'tool_use' | 'tool_result' | 'result' | 'error';
  sessionId: string;
  data: unknown;
}

export interface SessionAdapter {
  isInstalled(): Promise<boolean>;
  install(): Promise<void>;
  sendMessage(
    sessionId: string | null,   // null = new session
    text: string,
    cwd: string,
  ): AsyncIterable<ChatEvent>;
  listSessions?(): Promise<SessionInfo[]>;  // Phase 3+
  loadSession?(id: string): Promise<ChatEvent[]>;
}
```

Renderer (UI) → Electron IPC → Common Interface → `ClaudeCodeAdapter` 또는 `OpencodeAdapter` → CLI/서버.

### 7.4 Claude Code vs opencode 책임 분리 (전략 §5.1, §8.3)

| 항목 | Claude Code | opencode |
|---|---|---|
| 프로세스 모델 | One-shot: 매 턴 새 프로세스 | Long-running server: 한 번 띄워 유지 |
| 컨텍스트 보관 위치 | `~/.claude/projects/<cwd>/<session-id>.jsonl` | 서버 메모리 + SQLite (`~/.local/share/opencode/`) |
| 세션 ID 발급 시점 | 첫 `claude -p` 응답의 `system/init` 이벤트 | `POST /session` 응답 |
| 이어가기 | `claude -p "..." --resume <id>` | 같은 `session_id` 로 HTTP 재호출 |
| GUI 호출 방식 | `child_process.spawn` 매 턴 | HTTP 클라이언트 (SDK) |
| 스트리밍 | stdout NDJSON | HTTP SSE/스트림 |
| GUI 보유 상태 | `sessionId` 문자열 1개 | `sessionId` + 서버 핸들 |
| **GUI 의 컨텍스트 관리 코드** | **0 줄** | **0 줄** |

> Claude Code CLI 의 플래그·NDJSON 이벤트 스키마·세션 관리 상세는 [`claude-code-spec.md`](./claude-code-spec.md) 참조 (단일 출처).

### 7.5 활성 대화 시나리오 (전략 §9.1)

| 시점 | `sessionId` 상태 | 동작 |
|---|---|---|
| "새 대화" 버튼 | `null` | 초기화 |
| 1번째 메시지 전송 | `null` → 발급됨 | resume 옵션 없이 호출, 응답 첫 이벤트에서 ID 받아 저장 |
| 2번째 메시지 전송 | 보존 | 같은 ID 로 재호출 → CLI/서버가 컨텍스트 복원 |
| 3번째 이후 | 보존 | 동일 |
| "새 대화" 다시 | `null` 리셋 | 다음 메시지부터 새 세션 |

---

## 8. Phased Roadmap

각 단계는 이전 단계의 `sessionId` 추적 로직을 그대로 재사용하므로 누적 비용이 낮다 (전략 §11).

| 단계 | 기능 | 구현 위치 |
|---|---|---|
| **Phase 1 (MVP)** | 단일 활성 대화 컨텍스트 유지 | `sessionId` 메모리 변수 1개 |
| Phase 2 | 앱 재시작 후 마지막 대화 재개 | `electron-store` 로 `sessionId` 영속화 |
| Phase 3 | 사이드바에 과거 대화 목록 | `listSessions()` (Claude Code: jsonl 스캔 / opencode: `client.session.list()`) |
| Phase 4 | 멀티 세션 전환 모드 | 활성 세션 전환 UI |

---

## 9. Future Scope (post-v1)

프로토타입(`project/`)이 보여주는 도메인 워크플로. v1 비대상이지만 아키텍처가 이를 *막지 않도록* 설계해야 한다.

| 영역 | 무엇 | 프로토타입 참조 |
|---|---|---|
| **Projects** | 프로젝트 단위 워크스페이스, 엔진/모델/스킬 스코프, 활성 프로젝트 표시 | `project/variations/v1-screens.jsx` (Projects 카드 그리드), 프로토타입 사이드바 "프로젝트" 섹션 |
| **Engine & Model 레지스트리** | 멀티 엔진 (Claude Code / opencode / 로컬 llama.cpp / 커스텀 OpenAI 호환) 상태 + 모델 선택, 세션 중 모델 스위치 (`⌘⇧M`) | `project/variations/v1-screens.jsx` (Engine & Model 패널) |
| **Skills** | 도메인 스킬 카탈로그 (bayer-analysis, mtf-sfr, capture-batch, flat-field, color-checker), 토글 활성화 | `project/variations/v1-screens.jsx` (Skills/MCP 좌측) |
| **MCP 서버** | MCP 서버 등록·연결 상태·도구 수, 권한 패널 (보드 제어, 워크스페이스 FS, 네트워크) | 동 우측 |
| **Captures** | 캡처 리스트(248개) → 상세(Bayer 뷰어 + AI 분석 + 품질 메트릭 + 채널 히스토그램 + EXIF) | `project/variations/v1-screens.jsx` (Captures 분할 페인) |
| **하드웨어 통합** | 카메라 라이브뷰 (Bayer/RGB/R/G1/G2/B 탭), 노출/아날로그 게인/디지털 게인 슬라이더, 캡처+시퀀스 버튼, 보드 연결 상태 (`COM7 · OV-9282`), 라이브 텔레메트리 (FPS, 온도) | `project/electron/index.html`, `project/variations/v1-shell.jsx` (V1CameraPane) |
| **Bayer 디버그 모드** | R/G1/G2/B 채널 분리 + RGB 디코딩 뷰 (row-noise, 채널 imbalance 분석용) | 동 |
| **품질 메트릭** | SNR, ΔG1−G2, Sharpness, DR, ΔE, MTF50 (tone: ok/warn/bad) | 동 |
| **로컬 워크스페이스** | `~/orca/projects/{name}/captures/`, `skills/`, `.mcp.json`, `sessions.db` | 프로토타입 도메인 단서 |

§9 항목들은 *언제* 구현할지 본 문서에서 약속하지 않는다.

---

## 10. Design System

프로토타입(Variation A · "Claude Desktop classic") 의 토큰을 v1 의 기본값으로 채택한다.

### 10.1 Palette (Classic)

| 토큰 | 값 | 역할 |
|---|---|---|
| `bg` | `#fbf9f4` | 메인 배경 (cream) |
| `sidebar` | `#f3eee3` | 좌측 사이드바 (light tan) |
| `panel` | `#ffffff` | 카드/입력/패널 |
| `border` | `#ebe3d0` | 보조 라인 |
| `borderStrong` | `#ddd2b6` | 강조 라인 |
| `ink` | `#29261b` | 본문 텍스트 |
| `ink2` | `#6b6452` | 보조 텍스트 |
| `ink3` | `#a8a092` | 라벨/힌트 |
| `rust` | `#c96442` | 액센트 (Claude 브랜드) |
| `rustSoft` | `#f4dcc9` | 액센트 배경 |

다른 팔레트(Dark, Cool) 는 Tweaks 패널에서 선택. CSS 커스텀 프로퍼티 오버라이드.

### 10.2 Typography

| 폰트 | 사용처 |
|---|---|
| **Source Serif 4** | 화면 제목, 강조 헤더 (`var(--serif)`, 17–28px, weight 600, letter-spacing -0.3 ~ -0.6) |
| **Inter** | UI 본문 (`var(--sans)`, 13px 기본) |
| **JetBrains Mono** | 코드, 상태 라벨, 기술 수치 (`var(--mono)`, 10.5–12.5px) |

### 10.3 Tweaks 적용 메커니즘

| 컨트롤 | 영향 |
|---|---|
| 테마 팔레트 (Classic/Dark/Cool) | `<html data-theme="classic\|dark\|cool">` 속성 갱신 → `tokens.css` 의 `[data-theme]` 스코프가 Tailwind `@theme` 토큰 변수를 override. 트리 remount 불요. |
| 밀도 (조밀/보통/넓게) | 베이스 `font-size` 11.5 / 13 / 14.5px. em/rem 의존 spacing 이 함께 변한다. |
| 사이드바 접기 | 사이드바 너비 248 ↔ 56 px 토글. |

→ **인라인 스타일에 색을 하드코딩하지 말 것.** 모든 시각 변환은 토큰/커스텀 프로퍼티 경유.

---

## 11. Open Questions

| # | 질문 | 비고 |
|---|---|---|
| OQ1 | UI 프레임워크는 React 로 확정하는가? 버전(18/19)? | 전략은 "권장" 수준. |
| ~~OQ2~~ | ~~마크다운/하이라이트 라이브러리는 react-markdown + shiki 로 확정?~~ | **확정** (2026-05-14, Phase A `feat-pretty-ui`): react-markdown@^9 + remark-gfm@^4 + shiki@^1. TRD §2 갱신. |
| OQ3 | 패키징/배포 (electron-builder target, macOS notarization, Windows code signing, 자동 업데이트 채널)? | 전략 비커버. |
| OQ4 | 텔레메트리/에러 리포팅 정책? 옵트인? | 전략 비커버. |
| OQ5 | 라이센스 (오픈/상용)? | 전략 비커버. |
| OQ6 | 시작 시간 / 첫 토큰 지연 SLA 수치? | N5 와 연결. |
| OQ7 | 두 CLI 가 모두 설치된 경우 기본 백엔드 선택 정책 (사용자 명시 / 마지막 사용 / Claude Code 우선)? | F6 보강. |
| OQ8 | "새 대화" 시 직전 세션을 Phase 3 목록에 어떻게 노출할지? | Phase 2/3 진입 시 결정. |
| OQ9 | Claude Code 도구 권한 정책 — `--allowedTools` / `--permission-mode` / `--bare` 의 MVP 기본값? | [`claude-code-spec.md`](./claude-code-spec.md) §5 참조. 후보: 미지정 / Read+Edit+Bash 사전승인 / `acceptEdits`. |

---

## 12. References

| 출처 | 용도 |
|---|---|
| `docs/llm-chat-desktop-strategy.md` | 백엔드 / 어댑터 / 세션 / 설치 (§§2–11 핵심 입력) |
| `docs/claude-code-spec.md` | Claude Code CLI 공식 스펙 미러 (§7.2~7.4, OQ9 의 참조점) |
| `chats/chat1.md` | 디자인 의도 트랜스크립트 (§4 페르소나, §10 디자인 톤) |
| `project/electron/index.html` | 핸드오프 본 시안 — §9 Future Scope 시각 기준 |
| `project/variations/v1-shell.jsx` | Variation A 셸 구조, V1CameraPane (§9 하드웨어) |
| `project/variations/v1-screens.jsx` | 5 스크린 레이아웃 (§9 Projects/Engine/Skills/Captures) |
| `project/shared/atoms.jsx`, `project/styles/tokens.css` | 디자인 토큰 (§10) |
| `project/tweaks-panel.jsx` | Tweaks 컨트롤 사양 (§10.3) |
| 루트 `README.md` | 핸드오프 원칙 (트랜스크립트 우선, 픽셀 퍼펙트 재현은 타깃 기술에서) |
