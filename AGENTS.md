# 저장소 루트 — 코딩 에이전트용 가이드

이 저장소는 **Orca** (검증 엔지니어용 Windows Electron 데스크톱 앱) 의 디자인 핸드오프 + 구현 작업 공간이다. 한 화면에 모든 정보를 담을 수 없으므로 디렉토리마다 별도의 `AGENTS.md` 가 있다 (각 디렉토리의 `CLAUDE.md` 는 같은 위치의 `AGENTS.md` 를 import 하는 stub — 정본은 `AGENTS.md`). 본 문서는 *어디로 가서 무엇을 읽어야 하는지* 만 안내한다.

## 디렉토리 한눈에

| 디렉토리 | 역할 | 가이드 |
|---|---|---|
| `chats/` | 사용자 의도 트랜스크립트 (Claude Design 핸드오프) — *왜* 가 산다 | `chats/AGENTS.md` |
| `docs/` | PRD, TRD, 현재 아키텍처, 결정 근거(ADR), 운영 절차 — *무엇을* / *어떻게* / *왜* 가 산다. **어느 문서를 열지는 [`docs/INDEX.md`](docs/INDEX.md)** | `docs/AGENTS.md` |
| `project/` | HTML/CSS/JS 디자인 프로토타입 아카이브 — *어떻게 보여야 하는가* | `project/AGENTS.md` |
| `app/` | Orca v1 실제 구현체 (electron-vite + React/TypeScript). 빌드·게이트·의존성 정책·보안 베이스라인. | `app/AGENTS.md` |
| `app/src/main/` | Electron **main 프로세스** 레이어 가이드 — **app 컴포지션 루트 → features 수직 슬라이스 → contracts → adapters → infra → shared** DAG, 하향 의존만 + feature 교차 import 금지 (eslint-plugin-boundaries + import/no-cycle 강제). 원격 요청은 Chromium `net.fetch` 단일 스택. | `app/src/main/AGENTS.md` |
| `app/src/renderer/` | **Renderer** 레이어 가이드 — 4-layer 의존 방향 · Tailwind 시맨틱 토큰 · 그룹 스코프 격리. | `app/src/renderer/AGENTS.md` |
| `docs/guides/` | 운영 절차서 — 릴리스 · 폐쇄망 확장 · workspace 권한 구성. *구조 서술은 `docs/arch/`, 실행 절차는 여기* | `docs/guides/AGENTS.md` |
| `docs/handoff/` | Claude Code ↔ Codex 협업 hand-off (plan/verify 문서 + 디스패치 보드) | `docs/handoff/AGENTS.md` |

## 새 세션 진입 시 읽는 순서

```text
본 문서(root AGENTS)
   ↓  수정할 영역을 정한다
그 영역의 AGENTS.md          (app/ · app/src/main/ · app/src/renderer/ · docs/ …)
   ↓
관련 current-state 문서만     (docs/INDEX.md 의 라우팅 표에서 고른다)
   ↓
코드 / 테스트 / 계약 확인
   ↓
구현 → 검증
```

**과거 정보는 필요할 때만 읽는다.** `chats/`(트랜스크립트) · `docs/archive/`(완료 이력) ·
`docs/handoff/<NNNN-slug>/`(지난 작업) · `docs/etc/`(전략·사례 연구)는 **기본 세션에서 읽지
않는다** — 결정의 근거를 거슬러 확인해야 할 때만 연다. 이들은 *증거*지 현재 규칙이 아니다.

- 결정의 *이유*를 찾는다면 먼저 [`docs/decisions/`](docs/decisions/) (ADR).
- 진행 중 작업은 [`docs/handoff/INDEX.md`](docs/handoff/INDEX.md) (디스패치 보드).

## 핵심 원칙 (모든 에이전트 공통)

1. **진실에는 순서가 있다.** 코드·타입·테스트 > 현재 아키텍처(`docs/arch/`·`IPC_CONTRACT.md`·`GLOSSARY.md`) > 현재 제품 의도(PRD/TRD) > 작업 규칙(`AGENTS.md`) > 결정 근거(`docs/decisions/`) > 과거 증거(`git log`·`docs/archive/`·`chats/`·`project/`). **과거 문서를 현재 사양처럼 쓰지 마라.**
2. **PRD §11 / TRD §15 의 Open Questions 는 미정 항목.** 에이전트가 단독으로 결정하지 마라. 사용자에게 묻는다.
3. **문서와 코드가 어긋나면 무엇이 어긋났는지 먼저 가른다.** 문서가 낡았거나 코드가 명백한 버그면 조사 후 고친다. **제품 동작·공개 계약·데이터 포맷·되돌리기 어려운 결정·유효한 두 설계 중 선택**은 사용자에게 묻는다 (판별 표는 `docs/AGENTS.md`).
4. **코드에서 셀 수 있는 수치를 문서에 적지 마라.** 채널·슬라이스·설정 키·마이그레이션 개수 등은 [`docs/generated/inventory.md`](docs/generated/inventory.md) 가 갖는다 — `app/scripts/check-doc-inventory.mjs` 가 CI 에서 강제한다.
5. **`docs/arch/` 는 현재 상태만 서술한다.** 델타 이력(`0180에서 제거`·`77 → 76`)은 changelog 지 architecture 가 아니다 — 이유는 `docs/decisions/` 의 ADR 로 링크한다.
6. **각 디렉토리의 `AGENTS.md` 가 그 디렉토리에서 더 구체적인 규칙을 갖는다.** 본 문서와 충돌 시 디렉토리별 가이드 우선.
7. **`AGENTS.md` 는 아무 데나 만들지 않는다.** *부모 규칙만으로 그 subtree 를 안전하게 수정할 수 없을 때*만 추가한다 — 독자적 의존 규칙·보안 경계·빌드/테스트 명령·반복되는 위험한 invariant 가 있을 때. 단순 인벤토리·설명 목적이면 만들지 않는다. 만들면 `@AGENTS.md` 를 import 하는 `CLAUDE.md` stub 을 함께 두고 본 표를 갱신한다.
8. **언어**: 모든 `AGENTS.md`, PRD, TRD, 전략 문서, 트랜스크립트는 **한국어**. 코드 식별자·로그·외부 라이브러리 인터페이스는 영어. UI 라벨은 한국어 (`src/shared/i18n/ko.ts`).

## 협업 워크플로우 (Claude Code ↔ Codex)

이 저장소는 두 CLI 에이전트가 분업한다 — **Claude Code = 설계(plan)·검증(verify) 문서**, **Codex = 구현**. 두 에이전트는 *분리된 환경* 에서 **git 공유 브랜치를 메시지 버스 삼아** 통신한다 (라이브 채널 없음).

- **구현 주체 분담**: *기능 구현* 은 Codex, **리팩토링·버그수정 등 비기능 작업은 Claude 가 핸드오프 문서(`<NNNN-slug>/plan.md`)를 만들어 직접 구현까지 수행**한다. 이때도 핸드오프 절차(plan → impl → verify)와 구현 커밋 trailer 형식은 동일하게 따른다.
- **진입 트리거 (구현 요청 시 find-or-create)**: 사용자 요청이 *자료조사/질문/요약* 이 아니라 **구현·작업 요청**("구현해줘"·"고쳐줘"·"추가해줘"·리팩토링·버그수정 등)이면, `INDEX.md` 에서 해당 핸드오프를 **찾고, 없으면 `max(번호)+1` 로 새로 생성(`<NNNN-slug>/plan.md`, 설계 턴부터)**한다 — 구현 요청이라도 plan(설계)을 건너뛰지 않는다. 자료조사/질문은 핸드오프 없이 바로 답한다. **예외(핸드오프 생략, `Handoff: none` 직접 커밋 허용)**: 트리비얼(오타·주석·한두 줄) 및 *핸드오프 인프라 자체* 메타 수정. **애매하면 핸드오프 생성**(설계-우선 기본값). handoff 인프라의 normative 지침/SKILL/template/AGENTS를 바꾸면 `handoff-review`의 **Tier 1(full: instruction-delta + historical regression + cross-document consistency)** 검증을 수행한다. 실행 의미·owner·gate·policy가 불변인 단순 오탈자·상대경로·링크 정정은 **Tier 2(affected instruction-delta + cross-document consistency)** 로 줄일 수 있다. **tier가 애매하면 Tier 1**이다. (분류·절차 상세는 `docs/handoff/AGENTS.md`.)
- **착수 전 항상 [`docs/handoff/INDEX.md`](docs/handoff/INDEX.md) 를 먼저 읽는다** — "지금 누구 차례인가" 의 단일 진실원(디스패치 보드).
- 흐름: Claude `plan.md`(READY) → Codex 구현 + 게이트 통과(`impl/IMPL_DONE`) → Claude `verify.md`(PASS/FAIL). FAIL 이면 verify 의 "미충족" 체크리스트로 Codex 재구현 — **단 파생 이슈가 `규범 정정 필요`(Decision·AC·§10)를 달고 있으면 Claude 의 규범 행 정정이 먼저다** (구현자는 규범 행을 고칠 수 없어 그대로 넘기면 요구가 소멸한다).
- 규칙·상태 머신·템플릿 정본은 [`docs/handoff/AGENTS.md`](docs/handoff/AGENTS.md).
- **단계별 스킬 = 절차의 정본**: `plan.md`는 [`.agents/skills/handoff-plan/`](.agents/skills/handoff-plan/), **구현 턴은 [`.agents/skills/handoff-impl/`](.agents/skills/handoff-impl/)**, `verify.md`는 [`.agents/skills/handoff-verify/`](.agents/skills/handoff-verify/), handoff 지침 자체의 개선은 [`.agents/skills/handoff-review/`](.agents/skills/handoff-review/)를 쓴다 (`.claude/skills` 는 `.agents/skills` 를 가리키는 심링크). `plan`/`impl`/`verify`는 정상 작업 중 과거 실패 사례를 읽어 즉석에서 자기 규칙을 만들거나 corpus를 직접 갱신하지 않는다. **역사적 실패 사례는 `handoff-review/references/failure-patterns.md` 진입점을 통해 review가 지침 변경 후 회귀 검증에만 사용**하며, 사례 추가/일반화 여부도 review가 결정한다. `docs/handoff/AGENTS.md` 는 협업 규칙·상태 머신·**게이트 정본**과 skill 을 읽지 못하는 환경을 위한 **구현 턴 최소 계약**을 갖는다.

## 커밋 프로토콜 (Commit Protocol)

두 에이전트는 커밋 메시지 **trailer(`Key: value`)** 로 통신한다 (`git interpret-trailers` 파싱). **관례 — 기계적 강제(템플릿·CI·훅) 없음, 두 에이전트가 준수한다.**

커밋은 **2층 2독자** 다(우선순위 랭킹 아님): **산문 본문 = 사람용**(왜를 짧은 문장 + 맥락으로, 2~3줄), **trailer 꼬리 + `Handoff:` = 기계(AI)용**(메시지 버스 + 깊이 포인터, 비타협 유지). *무엇* 은 diff 가, *깊이* 는 `Handoff:` 가 가리키는 `plan.md`/`verify.md` 가 주므로 본문에 중복하지 않는다. 같은 원칙이 handoff 산출물 전체(`plan.md`·`verify.md`·`INDEX.md` 비고)에 걸린다 — 정본은 [`docs/handoff/AGENTS.md §산출물 문장 규칙`](docs/handoff/AGENTS.md).

- 제목: `<type>(<scope>): <요약>` (type=`feat|fix|refactor|docs|test|chore`).
- 본문과 빈 줄로 분리된 마지막 문단에 trailer 를 모은다. 안 쓰는 키는 줄을 생략한다(빈 값 금지). **trailer 블록 내부에는 빈 줄을 넣지 않는다** — `Co-Authored-By`·세션 URL 도 같은 블록(빈 줄로 끊으면 앞 trailer 가 파싱에서 누락).
- **커밋한 뒤 `git log -1 --format='%(trailers:only=true)'` 로 파싱을 확인한다.** 값이 허용값이어도 파싱은 별개 축이고 빈 줄만이 원인은 아니다 — 리터럴 `\n` 이 개행으로 해석되지 않으면 본문과 trailer 가 한 줄이 되어 전부 0건이 된다.

| Key | 허용값 | 작성 주체 |
|---|---|---|
| `Agent` | `codex` \| `claude` | 둘 다 |
| `Handoff` | `docs/handoff/<NNNN-slug>/` \| `none` | 둘 다 |
| `Status` | `designed` \| `implemented` \| `partial` \| `blocked` \| `verified` | 둘 다 |
| `Criteria-Met` / `Criteria-Pending` | `3/5` / 미충족 목록 | **구현 커밋(Codex)만** |
| `Verified-By` | `pending` \| `claude:pass` \| `claude:fail` | 구현=`pending`, 검증=결과 |
| `Next-Action` | `codex` \| `claude` \| `none` | **검증 커밋(Claude)만** |
| `Refs` | `#<이슈번호>` | 둘 다(선택) |

- **설계 커밋(Claude)**: `Agent: claude` + `Status: designed`. `Criteria-*`·`Next-Action` 은 넣지 않는다 — `plan/DRAFT`·`plan/READY` 와 verify/FAIL 후 **규범 행 정정**(Decision·AC·§10)이 여기다. **구현 산출과 같은 커밋에 담지 않는다** (정본 `.agents/skills/handoff-plan/SKILL.md` 마무리).
- **구현 커밋(Codex)**: `Agent: codex` + `Status: implemented|partial|blocked` + `Criteria-*` + `Verified-By: pending`.
- **검증 커밋(Claude)**: `Agent: claude` + `Status: verified` + `Verified-By: claude:pass|claude:fail` + `Next-Action`.
- 필드 의미·예시·파싱 명령 상세는 [`docs/git-template.md`](docs/git-template.md).

## AGENTS.md / CLAUDE.md 규약

- **정본은 `AGENTS.md`.** Codex 등 표준 에이전트가 네이티브로 읽는다. 내용 편집은 항상 `AGENTS.md` 에서 한다.
- 같은 디렉토리의 **`CLAUDE.md` 는 `@AGENTS.md` 한 줄을 import 하는 stub** — Claude Code 호환용. 직접 편집하지 않는다.
- **위생 규칙**: `AGENTS.md` 에는 *프로젝트 구조·역할 매핑·코딩/테스트/빌드 규칙·수정 주의사항* 만 둔다. *비밀(키/토큰/PW)·개인정보·일회성 업무·자주 바뀌는 운영정보(버전/배포일정/담당자)·장문 코드설명서·모순 규칙* 은 넣지 않는다. 변동성 이력은 `git log` 와 `docs/archive/`, 라이브 작업 상태는 `docs/handoff/INDEX.md` 로 분리한다.
- *런타임* AGENTS.md(앱이 띄우는 에이전트 세션에 주입하는 instructions, `docs/arch/backend/standardization.md §5.4`, 코드 미도입)는 **본 dev-time AGENTS.md 와 별개 스코프** 다 — 혼동 금지.

## 별도 제품 방향 (본 저장소 내 *문서로만* 존재)

- `docs/etc/lightweight-llm-strategy.md` — 로컬 4B LLM 기반 이미지 센서 QA 시스템. **Orca 와 독립** 한 별개 제품 방향. 본 저장소에서 구현체는 없다.

## 외부 진입점과의 구분

- 루트 `README.md` — Claude Design 핸드오프 *원본 README* (영어). 처음 저장소를 받는 외부 수신자용으로 보존.
- 루트 `AGENTS.md` (본 문서) — *코딩 에이전트* 진입점 (한국어). `CLAUDE.md` 는 이를 import 하는 stub.
- 둘은 같은 사실을 다른 청중에게 설명한다 — 충돌 시 본 문서가 최신.
