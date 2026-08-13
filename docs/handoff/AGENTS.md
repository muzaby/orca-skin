# docs/handoff/ — Claude Code ↔ Codex 협업 가이드

이 디렉토리는 두 CLI 에이전트의 handoff 채널이다. 본 문서는 **협업 규칙·상태 머신·역할 분담·review 진입 조건**만 담는다. 산출물을 어떻게 쓰고 검증하는지는 각 skill이 정본이다.

| 목적 | 정본 |
|---|---|
| `plan.md` 설계 | [`.agents/skills/handoff-plan/`](../../.agents/skills/handoff-plan/) — `SKILL.md` + `plan.template.md` |
| `verify.md` 검증 | [`.agents/skills/handoff-verify/`](../../.agents/skills/handoff-verify/) — `SKILL.md` + `verify.template.md` |
| handoff 지침 자체 개선 | [`.agents/skills/handoff-review/`](../../.agents/skills/handoff-review/) — `SKILL.md` + regression corpus |

`.claude/skills` 심링크를 통해 skill을 인식한다. plan/verify를 작성할 때는 해당 skill을 먼저 로드한다.

## 세 skill의 책임 분리

### handoff-plan — 현재 설계

- 여러 턴의 사용자 합의를 **Decision Ledger**로 보존한다.
- plan 앞부분에 **Product & UX Contract**를 두어 사용자가/소비자가 받는 결과를 먼저 고정한다.
- 뒷부분에 코드 조사·아키텍처·데이터/제어 흐름·모듈·테스트를 구체화한다.
- 현재 요구를 비판적으로 검토한다.

### handoff-verify — 현재 구현 검증

- 구현을 독립적으로 비판한다.
- Product/UX, ACTIVE Decision, AC와 실제 production path를 대조한다.
- AC 밖 결함을 역방향으로 찾는다.
- 검증할 수 없는 경계를 정직하게 사람에게 넘긴다.

### handoff-review — handoff 시스템 개선

- 반복 실패·decision drift·소통 실패의 원인을 분류한다.
- `handoff-plan` / `handoff-verify` **지침 자체**를 수정한다.
- 변경 후 `handoff-review/references/failure-patterns.md` 전체를 regression corpus로 사용해 과거 방어선이 유지되는지 검증한다.

**중요**: plan/verify는 정상 작업 중 failure corpus를 읽으며 즉석에서 자기 규칙을 만들거나, 종료 때 corpus를 직접 갱신하지 않는다. 사례의 일반화와 skill 변경은 review 책임이다.

---

## 역할 분담

| 에이전트 | 역할 | 산출물 |
|---|---|---|
| Claude Code | 설계 + 검증 + 비기능 구현 | `plan.md`, `verify.md`, 리팩토링/버그수정 코드 |
| Codex | 기능 구현 | `app/**` + `plan.md`의 `[구현자 기입]` |

기능 구현은 기본적으로 Codex가 담당한다. Codex가 없는 환경에서 사용자가 명시적으로 요청하면 Claude가 기능 구현을 맡을 수 있으나 plan → impl → verify 절차는 낮추지 않는다.

두 에이전트는 분리 환경이며 git 공유 브랜치가 메시지 버스다. 작업 전 pull, 작업 후 push를 기본으로 한다.

---

## 진입 트리거

### 구현/작업 요청

변경 산출물(코드/문서 수정)을 만들면 handoff find-or-create가 발동한다.

1. `INDEX.md`에서 기존 handoff를 찾는다.
2. 있으면 현재 단계/다음 주체에 맞춰 이어간다.
3. 없으면 `max(번호)+1`로 새 handoff를 만들고 `handoff-plan`부터 시작한다.

자료조사·설명·요약만이면 handoff가 필요 없다.

### 카브아웃

오타·주석·한두 줄 같은 trivial 변경과 **handoff 인프라 자체의 메타 수정**은 `Handoff: none`으로 직접 커밋할 수 있다. handoff skill을 고치기 위해 다시 handoff plan을 만드는 자기 참조를 피하기 위한 규칙이다.

### handoff-review 트리거

- 사용자가 handoff skill/지침 개선을 명시적으로 요청.
- 같은/유사 실패가 라운드에서 반복.
- 여러 handoff에서 동일 실수가 재발.
- 긴 대화에서 확정 결정이 최종 plan에서 사라지거나 변형.
- 같은 검증 한계를 반복해서 사람 실기로 넘김.
- impl 라운드가 **3을 초과**.

정상 단일 PASS마다 자동 review하지 않는다.

---

## INDEX.md 운영

`docs/handoff/INDEX.md`가 “지금 누구 차례인가”의 단일 진실원이다.

- 착수 전 자기 차례와 상태를 확인한다.
- 작업 종료 후 상태·다음 주체·대상 커밋을 갱신한다.
- PASS한 행은 archive history로 이동한다.

## 디렉토리 구조

```text
docs/handoff/
├── AGENTS.md
├── INDEX.md
└── <NNNN-slug>/
    ├── plan.md
    └── verify.md

.agents/skills/
├── handoff-plan/
│   ├── SKILL.md
│   ├── plan.template.md
│   └── references/failure-patterns.md   # review corpus로 향하는 호환 symlink
├── handoff-verify/
│   ├── SKILL.md
│   ├── verify.template.md
│   └── scripts/...
└── handoff-review/
    ├── SKILL.md
    └── references/
        ├── failure-patterns.md           # historical regression corpus 정본
        └── regression-coverage.md
```

---

## 정상 라이프사이클

```text
plan/DRAFT
  → plan/READY
  → impl/IN_PROGRESS
  → impl/IMPL_DONE
  → verify/PASS ── 종료
  └ verify/FAIL ── 파생 이슈 → 재구현 → 재검증
```

| 상태 | 의미 | 다음 주체 |
|---|---|---|
| plan/DRAFT | 설계 중 | Claude |
| plan/READY | Product/UX + Technical Design 확정 | Codex 또는 비기능이면 Claude |
| impl/IN_PROGRESS | 구현 중 | 구현자 |
| impl/IMPL_DONE | 구현 + 게이트 후 검증 대기 | Claude |
| verify/PASS | 완료 | — |
| verify/FAIL | 미충족 존재 | 구현자 |

`handoff-review`는 이 상태 머신의 별도 단계가 아니다. **메타 유지보수 경로**다. 단 라운드가 3을 초과하면 다음 재구현 전에 review를 수행해 전제/지침/소통 실패를 분리한다.

---

## 단계별 절차

### 1. 설계 — handoff-plan

- find-or-create 후 관련 대화/기존 plan을 읽는다.
- 여러 턴 결정을 Decision Ledger로 복원한다.
- plan 앞부분 Product & UX Contract, 뒷부분 Technical Design 순서로 작성한다.
- READY self-review를 통과한 뒤 INDEX를 갱신한다.

설계자는 요구를 비판적으로 검토하지만 과거 failure corpus를 읽어 자기 skill을 즉석에서 보완하지 않는다.

### 2. 구현

- plan의 **Part I을 제품 계약**, Part II를 기술 구현 가이드로 읽는다.
- ACTIVE Decision과 AC를 임의로 변경하지 않는다.
- 구현 세부·명백한 누락/버그는 선조치 후보고 가능.
- 제품 의도·신규 의존성·Decision·AC 변경은 보고만 하고 결정권자에게 올린다.
- 구현 보고의 `Criteria-Met`은 자기보고일 뿐 verify 증거가 아니다.

### 3. 검증 — handoff-verify

- 구현 전 plan 기준선을 잠근다.
- AC를 보기 전에 diff와 end-to-end 경로를 독립 검토한다.
- Product/UX, ACTIVE Decision, AC를 실제 경로와 대조한다.
- FAIL이면 파생 이슈를 plan 하단에 이관한다.
- 반복 실패 사실은 `Review Signals`에 남길 수 있지만 **원인 분류·skill 변경은 하지 않는다**.

### 4. 메타 리뷰 — handoff-review

- 관련 라운드와 사용자 결정 전체를 읽는다.
- 문제를 instruction gap / execution capability / communication mismatch / user decision change / evidence limitation / implementation defect로 분류한다.
- 사례 추가보다 plan/verify 지침의 통합·교체·강화를 우선한다.
- SKILL 변경 후에만 `failure-patterns.md`의 모든 현재 P heading을 전수 대조한다.
- 변경 전 COVERED였던 패턴이 변경 후 PARTIAL/GAP이면 완료하지 않는다.

---

## 여러 턴의 사용자 결정

Decision Ledger가 대화의 모든 문장을 복사하는 저장소는 아니다. **결정 단위와 provenance**를 보존한다.

- 최신 턴에 언급되지 않았다는 이유로 ACTIVE 결정을 버리지 않는다.
- 사용자가 명시적으로 바꾸면 기존 결정을 SUPERSEDED 처리한다.
- 변경인지 보완인지 불명확하고 제품 결과가 달라지면 질문한다.
- 사용자 변심은 failure pattern이 아니다.
- 요구가 이미 명확했는데 에이전트가 잊은 것은 communication mismatch로 돌리지 않는다.

---

## 충돌 최소화

- Claude → `docs/handoff/**` 및 handoff skill 문서.
- Codex → `app/**` 기능 코드.
- `plan.md`는 공유하되 설계자는 상단 Part I/II, 구현자는 `[구현자 기입]`, 검증자는 `[검증자 기입] 파생 이슈`만 수정한다.

## 검증 책임 분리

- 기계적으로 판정 가능한 게이트·계약·상태 로직·레이어 경계는 에이전트가 검증한다.
- 제품 의도·Open Question·시각 품질·신규 의존성·PR 머지 승인은 사람이 결정한다.
- “UI/SDK/electron”이라는 이유만으로 순수 로직까지 사람에게 넘기지 않는다.

## 커밋·git 규약

- 커밋: `<type>(<scope>): <한국어 메시지>`.
- trailer 정본은 root `AGENTS.md`의 커밋 프로토콜과 `docs/git-template.md`를 따른다.
- push는 작업 브랜치로 수행한다.
- PR은 사용자가 명시적으로 요청할 때 생성한다.
