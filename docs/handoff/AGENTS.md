# docs/handoff/ — Claude Code ↔ Codex 협업 가이드

이 디렉토리는 두 CLI 에이전트의 **hand-off 채널**이다. 역할은 고정이다:

| 에이전트 | 역할 | 산출물 |
|---|---|---|
| **Claude Code** | 설계 + 검증 (+ 비기능 구현) | `plan.md` (설계) · `verify.md` (검증) · 리팩토링/버그수정 코드 |
| **Codex** | 기능 구현 | 코드 (`app/**`) + `plan.md` 의 "구현 보고" 섹션 기입 |

> **구현 주체 분담 규칙**: *기능 구현* 은 Codex 담당. **리팩토링·버그수정 등 비기능 작업은 Claude 가 핸드오프 문서를 만들어 직접 구현까지 수행**한다 — 이 경우 아래 라이프사이클의 plan → impl → verify 를 Claude 가 순차 수행하며, 구현 커밋 trailer 는 `Agent: claude` + `Status: implemented` + `Criteria-*` + `Verified-By: pending` 으로 작성한다(형식은 [`../git-template.md`](../git-template.md)).

두 에이전트는 **분리된 환경**에서 동작하며 라이브 채널이 없다. **git 공유 브랜치가 유일한 메시지 버스**다 — 작업 전 `git pull`, 작업 후 `git push`. 단일 브랜치 순차 진행.

## 제일 먼저 읽을 것: INDEX.md

[`INDEX.md`](INDEX.md) 가 **"지금 누구 차례인가"의 단일 진실원**(디스패치 보드)이다. 두 에이전트 모두:

1. 착수 전 `git pull` → `INDEX.md` 에서 자기 차례 작업을 확인한다.
2. 작업을 끝내면 `INDEX.md` 의 해당 행을 갱신하고 `git push` 한다.

## 디렉토리 구조

```
docs/handoff/
├── AGENTS.md (+ CLAUDE.md stub)   # 본 문서 — 규칙·상태 머신
├── INDEX.md                        # 디스패치 보드
├── _templates/
│   ├── plan.template.md            # Claude 가 plan 작성 시 복사
│   └── verify.template.md          # Claude 가 verify 작성 시 복사
└── <NNNN-slug>/                    # 작업 단위 1개 (= PHASES 1행 / PR 1개)
    ├── plan.md
    └── verify.md
```

- `<NNNN-slug>` = 4자리 zero-pad 일련번호 + 케밥 slug. 예: `0001-handoff-bootstrap`.
- 일련번호는 `INDEX.md` 의 마지막 행 다음 번호.

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

라운드가 **3을 초과**하면 Claude 가 `INDEX.md` 비고에 에스컬레이션을 표기하고 사용자에게 질의한다 (무한 루프 방지).

## 단계별 절차

### 1. 설계 (Claude Code)
- `git pull` → `_templates/plan.template.md` 를 `<NNNN-slug>/plan.md` 로 복사해 작성.
- **인수 기준을 번호로** 적는다 (verify 가 1:1 로 대조). 재사용할 기존 함수·파일 경로, 참고 문서(TRD §·arch·IPC_CONTRACT)를 명시.
- `INDEX.md` 행 추가: `plan/READY`, 다음=Codex. `docs/PHASES.md` "현재 작업 중" 은 보드 링크만 유지.
- commit `docs(handoff): <slug> 설계` → `git push`.

### 2. 구현 (Codex)
- `git pull` → `INDEX.md` 에서 자기 차례 확인 → `plan.md` + `docs/` 정독.
- 구현 후 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.
- `plan.md` 의 "구현 보고/체크리스트" 섹션 기입 (변경 파일·실행 명령·게이트 결과·블로커).
- `INDEX.md` 갱신: `impl/IMPL_DONE`, 다음=Claude, 대상 커밋 hash 기재.
- commit `feat|fix|refactor(scope): …` (한국어) + **구현 커밋 trailer**(`Agent: codex`·`Status`·`Criteria-Met`·`Verified-By: pending` …) → `git push`.

### 3. 검증 (Claude Code)
- `git pull` → `_templates/verify.template.md` 를 `<NNNN-slug>/verify.md` 로 복사해 작성.
- **요구사항 충족 매트릭스**(증거 첨부) + **검증 책임 분리표(사람/에이전트)** + 게이트 재실행 + 위생 검토 + PHASES 정합.
- **PASS**: `INDEX.md` `verify/PASS` → `docs/PHASES.md` 표 행 승격(PR#/커밋) → (사용자 요청 시) PR.
- **FAIL**: verify "미충족 요구사항" 체크리스트 작성 → `INDEX.md` `verify/FAIL`, 다음=Codex, 라운드 +1.
- commit `docs(handoff): <slug> 검증 (PASS|FAIL r<N>)` + **검증 커밋 trailer**(`Agent: claude`·`Status: verified`·`Verified-By: claude:pass|claude:fail`·`Next-Action` …) → `git push`.

## 충돌 최소화 (단일 브랜치)

파일 도메인을 분리한다:

- **Claude** → `docs/handoff/**` + `docs/PHASES.md` (문서)
- **Codex** → `app/**` (코드)
- `plan.md` 는 공유하지만 Codex 는 **"구현 보고/체크리스트" 섹션만** 추가한다 (섹션 분리로 충돌 회피).

## 검증 책임 분리 (사람 vs 에이전트)

검증은 *기계적으로 판정 가능한 것*(에이전트)과 *가치판단·승인*(사람)을 나눈다. 매 `verify.md` 에 책임표를 포함한다.

| 항목 | 에이전트(Claude) | 사람(사용자) |
|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`) | 이견 시 중재 |
| 레이어 경계(eslint-boundaries) | ✅ 위반 0 | — |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — |
| AGENTS.md 위생(키/토큰/이메일/IP 스캔) | ✅ grep 보고 | ✅ 맥락 최종 판단 |
| import stub(`@AGENTS.md`) 해석 | ✅ | — |
| PHASES.md 형식·PR#/커밋 | ✅ | — |
| 제품 의도 부합(PRD/트랜스크립트) | ✖ 보조 의견 | ✅ 결정 |
| PRD §11 / TRD §15 Open Questions | ✖ 단독 결정 금지 | ✅ 결정 |
| UI/UX 시각 검증 | ✖ | ✅ |
| 신규 의존성 승인 | ✖ 제안 | ✅ |
| 문서↔코드 모순(설계변경 vs 버그) | ✖ 옵션 제시 | ✅ 결정 |
| PR 머지 승인 | ✖ | ✅ |

## 커밋·git 규약

- 커밋: `<type>(<scope>): <한국어 메시지>` — Claude 는 주로 `docs(handoff)`, Codex 는 `feat/fix/refactor`.
- **trailer 규약**(`Agent`/`Status`/`Verified-By`/`Next-Action` 등 `Key: value`): 정본은 root [`../../AGENTS.md`](../../AGENTS.md) "커밋 프로토콜", 상세·예시·파싱은 [`../git-template.md`](../git-template.md). 여기서 재서술하지 않는다.
- push: `git push -u origin <branch>` (네트워크 실패 시 2/4/8/16s 백오프, 최대 4회).
- PR 은 사용자가 명시적으로 요청할 때만 생성한다.
