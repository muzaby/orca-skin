# docs/handoff/ — Claude Code ↔ Codex 협업 가이드

이 디렉토리는 두 CLI 에이전트의 **hand-off 채널**이다. 본 문서는 **협업 규칙·상태 머신·구현 턴
지침**만 담는다 — *문서를 어떻게 쓰는가* 는 스킬이 갖는다.

| 산출물 | 템플릿 + 작성 절차 (정본) |
|---|---|
| `plan.md` (설계) | [`.agents/skills/handoff-plan/`](../../.agents/skills/handoff-plan/) — `SKILL.md` + `plan.template.md` |
| `verify.md` (검증) | [`.agents/skills/handoff-verify/`](../../.agents/skills/handoff-verify/) — `SKILL.md` + `verify.template.md` |

> Claude Code 는 `.claude/skills` 심링크로 두 스킬을 자동 인식한다. **plan·verify 를 쓸 때는
> 반드시 해당 스킬을 먼저 로드한다** — 템플릿만 복사해 채우면 검증 가능성 게이트를 건너뛴다.
> 두 스킬은 **수석 엔지니어 페르소나**로 동작한다 — plan 은 *사용자 요구* 를(관문 0), verify 는
> *구현 결과* 를(§0) 실무 관점에서 **먼저 비판적으로 검토한 뒤** 본작업에 들어간다. 이는
> 구현 턴의 "설계 비판적 리뷰"(아래 §2)와 짝을 이뤄 세 단계 모두에 비판 지점을 둔다.
> 과거 verify 자기 리뷰에서 축적한 설계 실패 패턴은
> [`handoff-plan/references/failure-patterns.md`](../../.agents/skills/handoff-plan/references/failure-patterns.md).

## 역할 분담

| 에이전트 | 역할 | 산출물 |
|---|---|---|
| **Claude Code** | 설계 + 검증 (+ 비기능 구현) | `plan.md` · `verify.md` · 리팩토링/버그수정 코드 |
| **Codex** | 기능 구현 | 코드 (`app/**`) + `plan.md` 의 `[구현자 기입]` 섹션 |

> **구현 주체 분담 규칙**: *기능 구현* 은 Codex 담당. **리팩토링·버그수정 등 비기능 작업은 Claude 가 핸드오프 문서를 만들어 직접 구현까지 수행**한다 — 이 경우 plan → impl → verify 를 Claude 가 순차 수행하며, 구현 커밋 trailer 는 `Agent: claude` + `Status: implemented` + `Criteria-*` + `Verified-By: pending` 으로 작성한다(형식은 [`../git-template.md`](../git-template.md)).

두 에이전트는 **분리된 환경**에서 동작하며 라이브 채널이 없다. **git 공유 브랜치가 유일한 메시지 버스**다 — 작업 전 `git pull`, 작업 후 `git push`. 단일 브랜치 순차 진행.

> **환경에 Codex 가 없을 때 (관측된 상례 — 0160·0162·0163·0176 등)**: 기능 구현도 **사용자 지시가 있으면** Claude 가 직접 수행한다. 이때도 *절차는 낮추지 않는다* — plan(설계) → impl → verify 를 그대로 밟고, 구현 커밋 trailer 는 `Agent: claude` + `Status: implemented` + `Criteria-*` + `Verified-By: pending` 으로 쓴다. INDEX 비고에 **구현 주체 이탈**을 명시해 나중에 "왜 Codex 가 아니었나" 를 되짚을 수 있게 한다. 사용자 지시 없이 스스로 기능 구현을 가져오지는 않는다.

## 진입 트리거 + 제일 먼저 읽을 것: INDEX.md

### 진입 트리거 — 구현 요청 시 핸드오프 find-or-create

사용자 요청을 먼저 분류한다:

| 요청 유형 | 예 | 핸드오프 |
|---|---|---|
| **구현·작업 요청** | "구현해줘"·"고쳐줘"·"추가해줘"·리팩토링·버그수정 (코드/문서 변경을 만드는 요청) | **트리거 발동** (아래 find→create) |
| 자료조사·질문·요약·단순 대화 | "요약하라"·"무엇을 신경쓰나"·"어떻게 동작하나" | 불필요 — 바로 답한다 |

- **경계 휴리스틱**: *변경 산출물(코드/문서 수정)을 만들면* 구현, *답/설명만 만들면* 자료조사. 디버깅 질문("왜 안 돼?")은 답까지는 자료조사지만 **수정으로 넘어가는 순간** 트리거 발동(그 시점에 find-or-create).
- **카브아웃(핸드오프 생략)**: 트리비얼(오타·주석·한두 줄·로컬 변수명) 및 *핸드오프 인프라 자체* 메타 수정은 `Handoff: none` 직접 커밋 허용. **단 애매하면 핸드오프 생성**(설계-우선 기본값) — "트리비얼"을 회피구로 쓰지 않는다.

구현·작업 요청이면(카브아웃 제외) `git pull` 후:

1. **Find** — `INDEX.md` 에서 요청에 해당하는 기존 핸드오프 행을 찾는다. **있으면** 그 행의 단계/상태(plan·impl·verify)와 "다음 주체"에 맞춰 **이어간다**(재구현·재검증 포함).
2. **Create (없으면)** — 기존 행 중 **`max(번호)+1`** 로 `<NNNN-slug>/plan.md` 를 만들고 **설계 턴부터 진입**한다(`handoff-plan` 스킬). 구현 요청이라도 **코드로 바로 건너뛰지 않는다**.
3. **Route (분담)** — *기능 구현* → `plan/READY` 후 다음=Codex. *비기능(리팩토링·버그수정)* → Claude 가 plan→impl→verify 직접 수행.

### INDEX.md 운영

[`INDEX.md`](INDEX.md) 가 **"지금 누구 차례인가"의 단일 진실원**(디스패치 보드)이다. 두 에이전트 모두:

1. 착수 전 `git pull` → `INDEX.md` 에서 자기 차례 작업을 확인한다.
2. 작업을 끝내면 `INDEX.md` 의 해당 행을 갱신하고 `git push` 한다.

## 디렉토리 구조

```
docs/handoff/
├── AGENTS.md (+ CLAUDE.md stub)   # 본 문서 — 협업 규칙·상태 머신·구현 턴 지침
├── INDEX.md                        # 디스패치 보드
└── <NNNN-slug>/                    # 작업 단위 1개 (= PHASES 1행 / PR 1개)
    ├── plan.md
    └── verify.md
```

- `<NNNN-slug>` = 4자리 zero-pad 일련번호 + 케밥 slug. 예: `0001-handoff-bootstrap`.
- 일련번호는 `INDEX.md` 기존 행 중 `max(번호)+1` (번호가 비연속일 수 있으므로 "마지막 행"이 아니라 최대값 기준).
- 템플릿은 스킬 디렉토리에 산다(위 표) — 절차와 붙어 있어야 드리프트하지 않는다.

## 라이프사이클 (상태 머신)

```
plan/DRAFT ─(Claude 작성 완료)→ plan/READY ─(다음=Codex)
  → impl/IN_PROGRESS ─(게이트 통과)→ impl/IMPL_DONE ─(다음=Claude)
    → verify/PASS  ── 종료 → PHASES 표 승격 / (요청 시) PR
    └ verify/FAIL  ── 다음=Codex, impl 라운드 +1 → 재구현
```

| 단계/상태 | 의미 | 다음 행동 주체 |
|---|---|---|
| `plan/DRAFT` | Claude 가 plan 작성 중 | Claude |
| `plan/READY` | 설계 확정, 구현 착수 가능 | Codex |
| `impl/IN_PROGRESS` | Codex 구현 중 | Codex |
| `impl/IMPL_DONE` | 구현 + 게이트 통과, 검증 대기 | Claude |
| `verify/PASS` | 검증 통과 (종료) | — |
| `verify/FAIL` | 미충족 항목 존재 | Codex (라운드 +1) |

라운드가 **3을 초과**하면 Claude 가 `INDEX.md` 비고에 에스컬레이션을 표기하고 사용자에게 질의한다 (무한 루프 방지). 라운드가 반복되면 수정안이 아니라 **전제**를 의심한다.

## 단계별 절차

### 1. 설계 (Claude Code) — `handoff-plan` 스킬

`git pull` → 스킬을 로드해 `plan.template.md` 를 `<NNNN-slug>/plan.md` 로 복사·작성 →
`INDEX.md` 행 추가(`plan/READY`, 다음 주체) → commit `docs(handoff): <slug> 설계` → `git push`.
`docs/PHASES.md` "현재 작업 중" 은 보드 링크만 유지한다.

### 2. 구현 (Codex 기능 / Claude 비기능)

- `git pull` → `INDEX.md` 에서 자기 차례 확인 → `plan.md` + `docs/` 정독.
- 구현 후 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.
- `plan.md` 의 `[구현자 기입]` 섹션 기입 (설계 리뷰·놓친 문제·변경 파일·게이트 결과·블로커).
- `INDEX.md` 갱신: `impl/IMPL_DONE`, 다음=Claude, 대상 커밋 hash 기재.
- commit `feat|fix|refactor(scope): …` (한국어) + **구현 커밋 trailer**(`Agent`·`Status`·`Criteria-Met`·`Verified-By: pending` …) → `git push`.

> **`Criteria-Met` 은 테스트가 있는 기준만 센다.** 코드가 존재하는 것은 충족이 아니다 — 과다 보고는 verify 에서 되돌아온다.

#### 구현 시 지침

> 구현자는 설계를 *그대로 받아쓰지 않는다*. 실무 관점에서 비판적으로 읽고, 설계가 놓친 것을 plan 에 되먹인다.

- **설계 비판적 리뷰.** plan 을 실무 관점에서 검토해 현실성·구멍을 짚고 `[구현자 기입] 설계 리뷰` 에 동의/이견을 적는다(plan 섹션 인용).
- **선조치 후보고.** 설계가 다루지 못한 잠재 문제는 `[구현자 기입] 놓친 잠재 문제 + 대응` 에 적고 **대응을 구현한 뒤 보고**한다. 단 **선조치 경계**를 지킨다:
  - **선조치 가능(✅ 구현·보고)**: 구현 세부·놓친 엣지케이스·명백한 누락/버그.
  - **선조치 불가(⚠️ 보고만·결정 필요)**: Open Question(PRD §11/TRD §15)·신규 의존성·제품 의도·인수 기준(설계) 변경 → 사용자/설계자 결정.
  - **Tie-breaker**: 두 경계 중 어디인지 *의심되면* `⚠️ 보고만`(보수적 기본값). "명백한 버그"를 핑계로 설계를 단독 변경하지 않는다.

### 3. 검증 (Claude Code) — `handoff-verify` 스킬

`git pull` → 스킬을 로드해 `verify.template.md` 를 `<NNNN-slug>/verify.md` 로 복사·작성.

- **PASS**: `INDEX.md` `verify/PASS` → `docs/PHASES.md` 표 행 승격(PR#/커밋) → (사용자 요청 시) PR.
- **FAIL**: 미충족 체크리스트 작성 → **미해결 문제는 plan 의 "파생 이슈(Derived Issues)" 챕터로 이관**(구현자 코멘트 참조, 또는 사용자 결정이 필요하면 **검증자가 사용자 결정을 대리 기록** — plan.md 는 검증자가 쓴다) → `INDEX.md` `verify/FAIL`, 다음=Codex, 라운드 +1 로 구현 턴 루프백.
- commit `docs(handoff): <slug> 검증 (PASS|FAIL r<N>)` + **검증 커밋 trailer**(`Agent: claude`·`Status: verified`·`Verified-By: claude:pass|claude:fail`·`Next-Action` …) → `git push`.

**FAIL 은 정상 결과다** — 상태 머신이 FAIL → 재구현 → 재검증을 전제한다. PASS 를 목표로 삼으면 검증이 무의미해진다.

## 충돌 최소화 (단일 브랜치)

파일 도메인을 분리한다:

- **Claude** → `docs/handoff/**` + `docs/PHASES.md` (문서)
- **Codex** → `app/**` (코드)
- `plan.md` 는 공유한다 — **설계자(Claude)는 상단**, **구현자는 `[구현자 기입]` 섹션만**, **검증자(Claude)는 하단 "파생 이슈" 챕터만** 추가한다 (섹션 분리로 충돌 회피).

**검증 책임 분리(사람 vs 에이전트)의 정본 표**는 `verify.template.md` 에 있다 — 매 `verify.md` 가 그 표를 포함한다. 요지: *기계적으로 판정 가능한 것*(게이트·기준 대조·레이어 경계·문서 형식)은 에이전트, *가치판단·승인*(제품 의도·Open Question·시각 검증·신규 의존성·PR 머지)은 사람.

## 커밋·git 규약

- 커밋: `<type>(<scope>): <한국어 메시지>` — Claude 는 주로 `docs(handoff)`, Codex 는 `feat/fix/refactor`.
- **trailer 규약**(`Agent`/`Status`/`Verified-By`/`Next-Action` 등 `Key: value`): 정본은 root [`../../AGENTS.md`](../../AGENTS.md) "커밋 프로토콜", 상세·예시·파싱은 [`../git-template.md`](../git-template.md). 여기서 재서술하지 않는다.
- push: `git push -u origin <branch>` (네트워크 실패 시 2/4/8/16s 백오프, 최대 4회).
- PR 은 사용자가 명시적으로 요청할 때만 생성한다.
