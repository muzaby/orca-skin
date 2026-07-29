# Plan — 0156-superpowers-vendoring

## 메타

| 항목 | 값 |
|---|---|
| slug | `0156-superpowers-vendoring` |
| 작성자 | Claude Code |
| 일자 | 2026-07-29 |
| 매핑 | PHASES "에이전트 도구" 행 (신규) / PR 없음 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "https://github.com/obra/superpowers 에서 제공하는 플러그인을 프로젝트에 내장하려고 한다. 내장 방법에는 플러그인 주소만 참조하게 하여 클로드코드 시작시 항상 자동 설치해도 좋고, 아예 내장해도 좋다. **타겟은 클로드코드, 코덱스 이다**" | 라이브 세션 요청 (2026-07-29) |
| 명시 요구 | 방식 = **단일 벤더링 + 로컬 마켓플레이스** (참조만/이중 벤더링 대신) | 라이브 세션 선택 |
| 명시 요구 | **핸드오프 워크플로가 상위**, superpowers 는 그 안의 도구 | 라이브 세션 선택 |
| 명시 요구 | 스킬 **14개 전부** 벤더링 | 라이브 세션 선택 |
| 선행 요구 | "superpowers 스킬 활용" — 0155 에서 이미 요청됨. 당시 미설치로 `/simplify` 대체 | `@docs/handoff/INDEX.md` 0155 행 |
| 추론 의도 | "clone 만으로 두 에이전트에 따라오는 형태" 가 목표 (추론) — 0155 에서 *수동 설치 의존이 이미 한 번 실패*했으므로, 사용자가 "내장"이라 말한 것은 저장소 커밋 형태를 뜻한다고 해석 | 위 0155 행 |

## Context (왜)

이 저장소는 두 CLI 에이전트(Claude Code = 설계·검증, Codex = 구현)가 git 브랜치를 메시지 버스 삼아 분업한다(`@docs/handoff/AGENTS.md`). superpowers 스킬 라이브러리를 **두 에이전트 모두에게 상시** 제공하는 것이 목표다.

0155 에서 사용자가 이미 "superpowers 스킬 활용"을 요청했으나 환경에 설치되어 있지 않아 `/simplify` 로 대체됐다. 즉 **세션마다 수동 설치에 기대는 방식은 이미 한 번 실패했다** — 저장소에 커밋되어 clone 만으로 따라오는 형태여야 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| superpowers = MIT, 스킬 14종 + SessionStart 부트스트랩 훅. Claude Code / Codex / Cursor / Gemini / Copilot 등 다중 하네스 지원 | https://github.com/obra/superpowers (README, LICENSE) |
| 최신 태그 `v6.2.0` = commit `3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`. 벤더링 대상 경로(`skills` `hooks` `.claude-plugin` `LICENSE`)는 `v6.2.0..main` diff 가 **비어 있음** | `git diff --stat v6.2.0 HEAD -- skills hooks .claude-plugin LICENSE` (출력 없음) |
| **Codex 는 프로젝트 단위 플러그인 자동설치 수단이 없다.** 공식 설치 경로는 Codex App/CLI 의 `/plugins` (사용자 단위 마켓플레이스 설치)뿐 | superpowers README "Codex App"/"Codex CLI" 절 |
| Codex 의 스킬 탐색 스코프: `./.agents/skills/` → `../.agents/skills/` → **`$REPO_ROOT/.agents/skills/`** → `$HOME/.agents/skills/` → `/etc/codex/skills/` → 번들. 프로젝트 스킬은 **버전 관리 대상**으로 권장됨 | https://codex.danielvaughan.com/2026/04/12/codex-cli-customisation-stack-unified-system/ · https://www.agensi.io/learn/where-are-codex-cli-skills-stored (공식 `developers.openai.com/codex/skills` 는 프록시에서 403 — 리스크 표 참조) |
| superpowers 자신도 Codex 용으로 `~/.agents/skills/superpowers/` 를 쓴다고 명시. `.agents/skills/` 는 Codex·Copilot CLI·Gemini CLI 공통 cross-runtime alias | `RELEASE-NOTES.md:616` · `skills/using-superpowers/references/gemini-tools.md:28` (upstream 클론) |
| **Codex 는 superpowers 의 SessionStart 훅을 실행하지 않는다.** `.codex-plugin/plugin.json` 이 `"hooks": {}` 로 훅 자동탐색을 *의도적으로 억제* — Codex 는 스킬을 네이티브로 노출하기 때문 | upstream `docs/porting-to-a-new-harness.md:240-243`, `:788` |
| Claude Code 프로젝트 설정은 `extraKnownMarketplaces` + `enabledPlugins` 를 지원. 마켓플레이스 소스 타입 5종: `github` · `git` · **`directory`(로컬 경로, `path` 사용)** · `hostPattern` · `settings` | https://code.claude.com/docs/en/settings#plugin-settings |
| 로컬 `directory` 소스의 상대 경로는 **저장소 main 체크아웃 기준**으로 해석된다 (worktree 에서도 동일 위치) | https://code.claude.com/docs/en/plugin-marketplaces (§"Require marketplaces for your team" 하단 Note) |
| 폴더 신뢰(trust) 수락 시 마켓플레이스 등록 + 플러그인 설치를 **프롬프트**한다. 무동의 자동설치는 신뢰 경계상 불가 | 동상, `extraKnownMarketplaces` 절 "1. Team members are prompted…" |
| 플러그인 매니페스트의 경로 필드는 **플러그인 루트 기준 `./` 로 시작해야 한다** → `../` 로 트리 밖을 가리켜 사본 1벌을 공유하는 방식은 불가 | https://code.claude.com/docs/en/plugins-reference#path-behavior-rules |
| upstream 트리는 Claude Code 마켓플레이스로 그대로 유효 | `claude plugin validate <upstream clone>` → `√ Validation passed` (이 환경, claude 2.1.220) |
| 이 저장소에는 `.claude/` · `.codex/` · 훅 · 스킬이 **전무**. 루트 `.gitignore` 는 `node_modules/` 한 줄 | 저장소 전수 탐색 |
| 저장소 규약: 새 디렉토리에는 `AGENTS.md` + `@AGENTS.md` import stub `CLAUDE.md` 를 두고 루트 표를 갱신 | `@AGENTS.md` "AGENTS.md / CLAUDE.md 규약" 5항 |
| CI 는 `paths: ['app/**', '.github/workflows/**']` 에서만 트리거 | `.github/workflows/ci.yml` |

## 인수 기준 (Acceptance Criteria)

1. `.agents/skills/` 에 스킬 **14개**(50 파일)가 upstream `v6.2.0` 과 **바이트 동일**하게 존재한다.
2. `.agents/hooks/` 3파일 + `.agents/.claude-plugin/plugin.json` + `LICENSE` 가 upstream 과 바이트 동일하다. `marketplace.json` 은 `name` 만 `superpowers-vendored` 로 다르고 나머지는 동일하다.
3. `claude plugin validate .agents --strict` 가 통과한다.
4. `.claude/settings.json` 이 `superpowers-vendored` 마켓플레이스(`directory` 소스, `./.agents`)를 선언하고 `superpowers@superpowers-vendored` 를 활성화한다.
5. Claude Code 런타임에서 마켓플레이스가 등록되고 플러그인이 enabled 로 로드된다 (`claude plugin marketplace list` / `claude plugin list`).
6. 루트 `AGENTS.md` 에 **핸드오프 우선** 조정 규칙이 명시된다 — 최소한 (a) 자료조사·질문은 스킬 호출 없이 바로 답한다, (b) 브랜치 종료·PR 은 저장소 규칙 우선, (c) 커밋은 저장소 trailer 규약, 세 가지 override 를 포함한다.
7. 신규 디렉토리 규약 충족 — `.agents/`·`.claude/` 각각 `AGENTS.md` + `CLAUDE.md` stub, 루트 "디렉토리 한눈에" 표에 2행 추가.
8. `.gitignore` 에 `.claude/settings.local.json` 이 추가된다.
9. `.agents/VENDOR.md` 가 업스트림 URL·태그·commit SHA·제외 목록·버전업 절차를 담는다.
10. `app/**` 무변경 (CI 미트리거).

## 범위 / 비범위

- **범위**: `.agents/` 벤더 트리, `.claude/` 배선, 루트 `AGENTS.md` 조정 규칙, `.gitignore`, 핸드오프 문서.
- **비범위**:
  - upstream 스킬 내용 수정 (fork 금지 — 버전업 diff 를 깨끗하게 유지).
  - Codex 런타임 실측 검증 (이 컨테이너에 `codex` CLI 없음 → verify 에서 "사용자 확인 필요" 로 분리).
  - `app/**` 코드 변경, CI 워크플로 변경.
  - 다른 하네스(Cursor·Gemini·Copilot) 지원 — 요청 타겟이 Claude Code + Codex 두 개.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 런타임 의존성 0** — npm 패키지 추가 없음. `app/package.json` 무변경. 벤더 트리는 마크다운 + 셸 스크립트뿐이다.
- 전제 1: Codex 가 `$REPO_ROOT/.agents/skills/` 를 스캔한다 (3자 문서 근거, 공식 문서 접근 불가 — 리스크 표 R3).
- 전제 2: Claude Code v2.1.195 이상 (프로젝트 `enabledPlugins` 의 설치 프롬프트 경로). 이 환경은 2.1.220.
- 전제 3: Windows 개발자 환경에서 SessionStart 훅이 bash 를 찾을 수 있다 (upstream `run-hook.cmd` 가 탐색 — 리스크 표 R2).

## 설계

### 왜 벤더링인가 (대안 기각 근거)

| 대안 | 기각 이유 |
|---|---|
| 참조만 (`extraKnownMarketplaces` → github `obra/superpowers-marketplace`) | Claude Code 는 되지만 **Codex 는 프로젝트 단위 강제 수단이 없다**. AGENTS.md 에 수동 설치 안내만 남으므로 0155 의 실패를 반복한다. |
| 이중 벤더링 (`.agents/skills/` + `.claude/skills/superpowers/`) | Claude Code 쪽이 가장 견고(`@skills-dir`, 설치·캐시 없이 제자리 로드)하나 351KB×2 와 drift 위험. 매니페스트 경로 필드가 `../` 를 금지해 심링크 없이 사본을 공유할 수 없다. |
| 서브모듈 | `clone --recursive` 의존 + Codex 가 `.agents/skills/` 경로를 못 얻음. |

**채택**: 벤더 트리 1벌을 `.agents/` 에 두고, Codex 는 `.agents/skills/` 를 네이티브 스캔, Claude Code 는 로컬 `directory` 마켓플레이스로 **같은 트리**를 플러그인으로 설치한다. 마켓플레이스 루트 == 플러그인 루트(`source: "./"`)라서 `.agents/` 하나가 두 역할을 겸한다.

### 트리 구조

```
.agents/
├── .claude-plugin/
│   ├── plugin.json        # upstream 그대로 (name: superpowers, version: 6.2.0)
│   └── marketplace.json   # name 만 superpowers-dev → superpowers-vendored
├── hooks/{hooks.json,run-hook.cmd,session-start}
├── skills/                # 14 스킬 · 50 파일 ← Codex 스캔 경로
├── LICENSE                # MIT (저작권 고지 유지 의무)
├── VENDOR.md              # 출처·핀·제외 목록·버전업 절차
├── AGENTS.md              # "벤더링 트리 — 직접 편집 금지"
└── CLAUDE.md              # @AGENTS.md stub
```

**제외**: `hooks/hooks-cursor.json`(Cursor 전용), `tests/` `docs/` `scripts/` `assets/` `.github/` `README.md` `RELEASE-NOTES.md` `package.json`, 타 하네스 dotdir(`.cursor-plugin/` `.kimi-plugin/` `.opencode/` `.pi/` `.codex-plugin/` `.agents/plugins/`), 그리고 **upstream 의 `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`** — superpowers 저장소 기여 가이드라인이라 이 저장소 컨텍스트에 유입되면 안 된다.

### Claude Code 배선

```json
{
  "extraKnownMarketplaces": {
    "superpowers-vendored": { "source": { "source": "directory", "path": "./.agents" } }
  },
  "enabledPlugins": { "superpowers@superpowers-vendored": true }
}
```

### 워크플로 조정 (루트 AGENTS.md)

superpowers 부트스트랩(`using-superpowers`)은 `<EXTREMELY_IMPORTANT>` 로 "어떤 응답보다 먼저 스킬을 호출하라"를 강제하고 brainstorming → writing-plans → subagent-driven-development → TDD 를 밀어붙인다. 이 저장소의 핸드오프 절차와 정면 충돌하므로 루트 `AGENTS.md` 에 명시적 상하관계를 적는다.

- **상위**: 핸드오프 find-or-create, plan→impl→verify, INDEX 갱신, 커밋 trailer, PR 정책.
- **하위(도구)**: 설계→`writing-plans`·`brainstorming` / 구현→`test-driven-development`·`subagent-driven-development` / 버그→`systematic-debugging` / 검증→`verification-before-completion` / 리뷰→`requesting-code-review`·`receiving-code-review`.
- **명시적 override 3종**: (a) 자료조사·질문은 핸드오프도 스킬 호출도 없이 바로 답한다. (b) 브랜치 종료·PR 은 `finishing-a-development-branch` 가 아니라 저장소 규칙(PR 은 사용자 명시 요청 시에만). (c) 커밋 메시지는 항상 저장소 trailer 규약.

Codex 는 SessionStart 훅이 없으므로 이 섹션이 `using-superpowers` 존재를 가리키는 instructions-file 보강을 겸한다 (upstream 이 말하는 Shape C).

### 재사용

- `docs/handoff/_templates/{plan,verify}.template.md` — 핸드오프 문서 골격.
- 기존 `CLAUDE.md` stub 본문(138B, 저장소 전체 동일) — 신규 디렉토리 stub 에 그대로 사용.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **첫 clone**: 폴더 신뢰 프롬프트 → 마켓플레이스 등록 프롬프트 → 플러그인 설치 프롬프트. 사용자가 거절하면 스킬 없이 동작(저장소는 정상). Codex 는 프롬프트 없이 즉시 스캔.
- **거절/미설치 상태**: Claude Code 는 스킬이 없어도 루트 `AGENTS.md` 의 조정 규칙만 읽는다 → 없는 스킬을 호출하려 시도하지 않도록 섹션에 "미설치 시 그냥 핸드오프 절차만 따른다"를 적는다.
- **worktree**: `directory` 상대 경로가 main 체크아웃으로 해석되므로 worktree 마다 재설치 불필요.
- **버전업**: 벤더 트리 교체 후 `/plugin marketplace update superpowers-vendored` 가 필요 (캐시 사본). VENDOR.md 에 기재.
- **N/A**: 로딩/에러/빈상태/테마/접근성 — 앱 UI 변경이 아니다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| # | 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|---|
| R1 | `extraKnownMarketplaces` 의 `directory` 소스가 상대 경로 `./.agents` 를 못 잡을 수 있다 | verify 에서 실측. 실패 시 절대 경로 또는 `${CLAUDE_PROJECT_DIR}` 폴백 |
| R2 | Windows 에서 SessionStart 훅(bash) 미실행 → 스킬 자동 트리거가 약해짐 | upstream `run-hook.cmd` 가 bash 를 탐색. 실패해도 스킬 자체는 로드되고, 루트 `AGENTS.md` 문구가 폴백으로 동작 |
| R3 | Codex 의 `$REPO_ROOT/.agents/skills/` 스캔 근거가 3자 문서 (openai 공식 문서가 이 환경 프록시에서 403) | verify 에 upstream 규정 수용 테스트(`Let's make a react todo list` → `brainstorming` 자동 발동) 절차를 남기고 **사용자 확인 대기**로 분리. 실패 시 `~/.agents/skills/` 사용자 단위 폴백 안내 |
| R4 | `directory` 소스는 문서상 "development only" | 벤더 트리가 고정 핀이라 실질 영향 없음. 버전업 시 `/plugin marketplace update` 필요 → VENDOR.md 기재 |
| R5 | 351KB·50 파일이 저장소에 유입 (트레이드오프) | 사용자가 "단일 벤더링" 을 선택. 이중 벤더링 대비 절반이고 upstream 트리 그대로라 버전업 diff 가 깨끗 |
| R6 | 저장소가 "기계적 강제(템플릿·CI·훅) 없음" 을 명시하는데 SessionStart 훅이 유입된다 | 훅은 *저장소의 강제 장치*가 아니라 **플러그인이 자기 스킬을 소개하는 부트스트랩**이다. 저장소 규칙 자체는 여전히 관례로만 유지된다 — AGENTS.md 조정 섹션에서 이 구분을 명시 |

- 되돌리기 어려운 결정: 없음. `.agents/` + `.claude/` 삭제로 완전 원복된다.
- **단독 결정 금지 항목**: 없음 (내장 방식·워크플로 우선순위·스킬 범위 3건 모두 사용자 확정).

## 영향 받는 파일

- `.agents/**` (신규 · 56 파일 + VENDOR/AGENTS/CLAUDE)
- `.claude/settings.json`, `.claude/AGENTS.md`, `.claude/CLAUDE.md` (신규)
- `.gitignore` (1줄 추가)
- `AGENTS.md` (루트 — 표 2행 + 신규 섹션)
- `docs/handoff/0156-superpowers-vendoring/{plan,verify}.md`, `docs/handoff/INDEX.md`, `docs/PHASES.md`
- `app/**` 무변경

## 참고 문서

- `@AGENTS.md` (루트 — 커밋 프로토콜 · AGENTS.md/CLAUDE.md 규약)
- `@docs/handoff/AGENTS.md` (진입 트리거 · 라이프사이클 · 검증 책임 분리)
- `@docs/git-template.md` (trailer 필드)

## 게이트

- `app/**` 무변경이므로 **`cd app && npm run lint/typecheck/test` 는 이 작업의 게이트가 아니다**(변경 없음 = 회귀 없음). 대신:
  - `claude plugin validate .agents --strict`
  - upstream `v6.2.0` 대비 벤더 트리 바이트 동일성 대조
  - `claude plugin marketplace list` / `claude plugin list` 런타임 확인
- 신규 테스트 요구: 없음 (앱 코드 무변경).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 원문 인용 + 3개 선택 확정 기록, 추론은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 웹 URL·upstream `파일:라인`·명령 출력 레퍼런스 첨부. 접근 불가 문서(R3)는 리스크로 분리.
- [x] 인수 기준 — 10항목 번호, 전부 명령/파일로 검증 가능.
- [x] 의존 기술 — 신규 의존성 0 명시, 전제 3건 식별 (전제 1·3 은 리스크와 연결).
- [x] 파생 UX — 첫 clone / 거절 / worktree / 버전업 엣지케이스 전개. UI 항목은 N/A 로 명시.
- [x] 리스크 — R1~R6 + 원복 용이성. Open Question 없음(3건 모두 사용자 확정).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 건은 비기능(에이전트 도구 인프라)이므로 **Claude 가 직접 구현**한다.

## [구현자 기입] 설계 리뷰 (비판적)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

## [구현자 기입] 구현 체크리스트

## [구현자 기입] 구현 보고
