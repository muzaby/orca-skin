# 저장소 루트 — 코딩 에이전트용 가이드

이 저장소는 **Orca** (검증 엔지니어용 Windows Electron 데스크톱 앱) 의 디자인 핸드오프 + 구현 작업 공간이다. 한 화면에 모든 정보를 담을 수 없으므로 디렉토리마다 별도의 `AGENTS.md` 가 있다 (각 디렉토리의 `CLAUDE.md` 는 같은 위치의 `AGENTS.md` 를 import 하는 stub — 정본은 `AGENTS.md`). 본 문서는 *어디로 가서 무엇을 읽어야 하는지* 만 안내한다.

## 디렉토리 한눈에

| 디렉토리 | 역할 | 가이드 |
|---|---|---|
| `chats/` | 사용자 의도 트랜스크립트 (Claude Design 핸드오프) — *왜* 가 산다 | `chats/AGENTS.md` |
| `docs/` | PRD, TRD, 아키텍처·전략 문서, 페이즈 이력 — *무엇을* / *어떻게* 가 산다 | `docs/AGENTS.md` |
| `project/` | HTML/CSS/JS 디자인 프로토타입 아카이브 — *어떻게 보여야 하는가* | `project/AGENTS.md` |
| `app/` | Orca v1 실제 구현체 (electron-vite + React/TypeScript). 4-layer Feature 아키텍처 (`app/` · `pages/` · `features/` · `shared/`, ESLint boundaries 강제). 구현 작업 규칙은 가이드, 페이즈 이력은 `docs/PHASES.md` 참조. | `app/AGENTS.md` |
| `docs/handoff/` | Claude Code ↔ Codex 협업 hand-off (plan/verify 문서 + 디스패치 보드) | `docs/handoff/AGENTS.md` |

## 새 세션 진입 시 읽는 순서

1. **`chats/`** — 트랜스크립트(현재 1개). *결정 키워드* ("A로 진행", "확정", "OK") 가 진실. 어시스턴트의 긴 제안보다 사용자의 짧은 응답이 우선.
2. **`docs/PRD.md`** — 무엇을 만들지 (Orca v1 MVP). §6 (MVP Scope), §9 (Future Scope), §11 (Open Questions) 가 핵심.
3. **`docs/TRD.md`** — 어떻게 구현할지. 코드 작업의 1차 참고서.
4. **`app/AGENTS.md`** → `app/` — 구현 디렉토리 규칙·모듈 레이아웃·의존성 정책·보안 베이스라인.
5. (필요 시) **`project/electron/index.html`** — 시각 기준 (variation A). 픽셀 퍼펙트 *재현* 대상이지 그대로 가져갈 production 코드가 아니다.
6. (필요 시) **`docs/etc/llm-chat-desktop-strategy.md`** — TRD 가 소화한 전략적 근거. TRD 결정의 *왜* 를 거슬러볼 때.

## 현재 페이즈

페이즈 상태·이력(범위·PR·커밋)은 변동성이 커서 본 문서에 두지 않는다. **정본은 [`docs/PHASES.md`](docs/PHASES.md)** (완료 이력의 최종 진실은 `git log`). 진행 중 작업은 `docs/PHASES.md` 의 "현재 작업 중" 섹션 + [`docs/handoff/INDEX.md`](docs/handoff/INDEX.md) 참조.

## 핵심 원칙 (모든 에이전트 공통)

1. **트랜스크립트 + PRD/TRD 가 진실이다.** `project/` HTML 은 *결과물* 이지 의도가 아니다. 의도는 `chats/` 와 `docs/` 에 있다.
2. **PRD §11 / TRD §15 의 Open Questions 는 미정 항목.** 에이전트가 단독으로 결정하지 마라. 사용자에게 묻는다.
3. **문서와 코드가 모순되면 사용자에게 물어라.** 둘 다 바꿔야 하는지(설계 변경) 코드만(구현 버그) 인지 결정해야 한다.
4. **각 디렉토리의 `AGENTS.md` 가 그 디렉토리에서 더 구체적인 규칙을 갖는다.** 본 문서와 충돌 시 디렉토리별 가이드 우선.
5. **새 디렉토리 추가 시 그 디렉토리에도 `AGENTS.md` (+ `@AGENTS.md` import 하는 `CLAUDE.md` stub) 를 둔다** — 본 표를 갱신.
6. **언어**: 모든 `AGENTS.md`, PRD, TRD, 전략 문서, 트랜스크립트는 **한국어**. 코드 식별자·로그·외부 라이브러리 인터페이스는 영어. UI 라벨은 한국어 (`src/shared/i18n/ko.ts`).

## 협업 워크플로우 (Claude Code ↔ Codex)

이 저장소는 두 CLI 에이전트가 분업한다 — **Claude Code = 설계(plan)·검증(verify) 문서**, **Codex = 구현**. 두 에이전트는 *분리된 환경* 에서 **git 공유 브랜치를 메시지 버스 삼아** 통신한다 (라이브 채널 없음).

- **착수 전 항상 [`docs/handoff/INDEX.md`](docs/handoff/INDEX.md) 를 먼저 읽는다** — "지금 누구 차례인가" 의 단일 진실원(디스패치 보드).
- 흐름: Claude `plan.md`(READY) → Codex 구현 + 게이트 통과(`impl/IMPL_DONE`) → Claude `verify.md`(PASS/FAIL). FAIL 이면 verify 의 "미충족" 체크리스트로 Codex 재구현.
- 규칙·상태 머신·템플릿 정본은 [`docs/handoff/AGENTS.md`](docs/handoff/AGENTS.md).

## 커밋 프로토콜 (Commit Protocol)

두 에이전트는 커밋 메시지 **trailer(`Key: value`)** 로 통신한다 (`git interpret-trailers` 파싱). **관례 — 기계적 강제(템플릿·CI·훅) 없음, 두 에이전트가 준수한다.**

- 제목: `<type>(<scope>): <요약>` (type=`feat|fix|refactor|docs|test|chore`).
- 본문과 빈 줄로 분리된 마지막 문단에 trailer 를 모은다. 안 쓰는 키는 줄을 생략한다(빈 값 금지).

| Key | 허용값 | 작성 주체 |
|---|---|---|
| `Agent` | `codex` \| `claude` | 둘 다 |
| `Handoff` | `docs/handoff/<NNNN-slug>/` \| `none` | 둘 다 |
| `Status` | `implemented` \| `partial` \| `blocked` \| `verified` | 둘 다 |
| `Criteria-Met` / `Criteria-Pending` | `3/5` / 미충족 목록 | **구현 커밋(Codex)만** |
| `Verified-By` | `pending` \| `claude:pass` \| `claude:fail` | 구현=`pending`, 검증=결과 |
| `Next-Action` | `codex` \| `claude` \| `none` | **검증 커밋(Claude)만** |
| `Refs` | `#<이슈번호>` | 둘 다(선택) |

- **구현 커밋(Codex)**: `Agent: codex` + `Status: implemented|partial|blocked` + `Criteria-*` + `Verified-By: pending`.
- **검증 커밋(Claude)**: `Agent: claude` + `Status: verified` + `Verified-By: claude:pass|claude:fail` + `Next-Action`.
- 필드 의미·예시·파싱 명령 상세는 [`docs/git-template.md`](docs/git-template.md).

## AGENTS.md / CLAUDE.md 규약

- **정본은 `AGENTS.md`.** Codex 등 표준 에이전트가 네이티브로 읽는다. 내용 편집은 항상 `AGENTS.md` 에서 한다.
- 같은 디렉토리의 **`CLAUDE.md` 는 `@AGENTS.md` 한 줄을 import 하는 stub** — Claude Code 호환용. 직접 편집하지 않는다.
- **위생 규칙**: `AGENTS.md` 에는 *프로젝트 구조·역할 매핑·코딩/테스트/빌드 규칙·수정 주의사항* 만 둔다. *비밀(키/토큰/PW)·개인정보·일회성 업무·자주 바뀌는 운영정보(버전/배포일정/담당자)·장문 코드설명서·모순 규칙* 은 넣지 않는다. 변동성 이력은 `docs/PHASES.md`, 라이브 작업 상태는 `docs/handoff/INDEX.md` 로 분리한다.
- *런타임* AGENTS.md(앱이 띄우는 에이전트 세션에 주입하는 instructions, `docs/arch/backend/standardization.md §5.4`, 코드 미도입)는 **본 dev-time AGENTS.md 와 별개 스코프** 다 — 혼동 금지.

## 별도 제품 방향 (본 저장소 내 *문서로만* 존재)

- `docs/etc/lightweight-llm-strategy.md` — 로컬 4B LLM 기반 이미지 센서 QA 시스템. **Orca 와 독립** 한 별개 제품 방향. 본 저장소에서 구현체는 없다.

## 외부 진입점과의 구분

- 루트 `README.md` — Claude Design 핸드오프 *원본 README* (영어). 처음 저장소를 받는 외부 수신자용으로 보존.
- 루트 `AGENTS.md` (본 문서) — *코딩 에이전트* 진입점 (한국어). `CLAUDE.md` 는 이를 import 하는 stub.
- 둘은 같은 사실을 다른 청중에게 설명한다 — 충돌 시 본 문서가 최신.
