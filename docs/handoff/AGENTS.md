# docs/handoff/ — Claude Code ↔ Codex 협업 가이드

이 디렉토리는 두 CLI 에이전트의 handoff 채널이다. 본 문서는 **협업 규칙·상태 머신·역할 분담·review 진입 조건**을 갖는다. 산출물을 어떻게 작성·검증하는지는 각 skill이 정본이다.

| 목적 | 정본 |
|---|---|
| `plan.md` 설계 | [`.agents/skills/handoff-plan/`](../../.agents/skills/handoff-plan/) — `SKILL.md` + `plan.template.md` |
| `verify.md` 검증 | [`.agents/skills/handoff-verify/`](../../.agents/skills/handoff-verify/) — `SKILL.md` + `verify.template.md` |
| handoff 지침 자체 개선 | [`.agents/skills/handoff-review/`](../../.agents/skills/handoff-review/) — `SKILL.md` + regression references |

`.claude/skills` 심링크를 통해 skill을 인식한다. plan/verify/review를 수행할 때는 해당 skill을 먼저 로드한다.

## 세 skill의 책임 분리

### handoff-plan — 현재 설계

- 여러 턴의 사용자 합의를 **Decision Ledger**로 보존한다.
- plan 앞부분에 **Product & UX Contract**를 두어 사용자/소비자가 받는 결과를 먼저 고정한다.
- 뒷부분 Technical Design은 **AS-IS → TO-BE → Delta**로 현재와 목표 구조를 같은 축에서 대조한다.
- 코드 조사·아키텍처·데이터/제어 흐름·모듈·테스트를 구체화한다.
- 현재 요구를 비판적으로 검토한다.

### handoff-verify — 현재 구현 검증

- 구현을 독립적으로 비판한다.
- Product/UX, ACTIVE Decision, AC와 실제 production path를 대조한다.
- AC 밖 결함을 역방향으로 찾는다.
- 검증 가능한 부분을 최대한 기계 검증하고 남은 경계만 사람에게 넘긴다.
- repository operation(AGENTS/INDEX/trailer/reference)도 실제 변경 범위에 포함되면 검증한다.

### handoff-review — handoff 시스템 개선

- 반복 실패·decision drift·소통 실패의 원인을 분류한다.
- 사례 누적보다 `handoff-plan` / `handoff-verify` **지침 자체**의 통합·교체·강화를 우선한다.
- normative semantics가 바뀌는 지침 변경은 **Tier 1: Operational Instruction Delta → Historical Failure Regression → Cross-document Consistency**를 수행한다.
- 실행 의미가 불변인 단순 referential/mechanical correction은 **Tier 2: affected Operational Delta + Cross-document Consistency**로 줄일 수 있다. **애매하면 Tier 1**이다.

**중요**: plan/verify는 정상 작업 중 failure corpus를 읽으며 즉석에서 자기 규칙을 만들거나 종료 때 corpus를 직접 갱신하지 않는다. 사례의 일반화·skill 변경·corpus 유지 판단은 review 책임이다.

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

- **애매하면 handoff를 생성한다.** 카브아웃을 설계 회피구로 사용하지 않는다.
- `Handoff: none`은 **검증 면제**가 아니다.
- handoff SKILL/template/AGENTS/reference의 실행 의미·책임·gate·policy를 바꾸면 `handoff-review` **Tier 1**을 수행한다.
- 실행 의미가 불변인 typo/path/link 정정은 `handoff-review` **Tier 2**로 줄일 수 있다. Historical Failure Regression을 생략하는 이유를 기록하고 affected Operational Delta + Cross-document Consistency는 남긴다.
- **Tier가 애매하면 Tier 1**이다.

### handoff-review 트리거

- 사용자가 handoff skill/지침 개선을 명시적으로 요청.
- handoff SKILL/template/AGENTS 자체를 변경.
- 같은/유사 실패가 라운드에서 반복.
- 여러 handoff에서 동일 실수가 재발.
- 긴 대화에서 확정 결정이 최종 plan에서 사라지거나 변형.
- 같은 검증 한계를 반복해서 사람 실기로 넘김.
- impl 라운드가 **3을 초과**.

정상 단일 PASS마다 자동 review하지 않는다.

---

## 신규 템플릿 적용 경계

Part I/II, Decision Ledger, Technical Design AS-IS/TO-BE가 포함된 새 템플릿은 **신규 handoff부터 적용**한다.

- 진행 중인 기존 handoff를 형식만 맞추기 위해 일괄 마이그레이션하지 않는다.
- 기존 plan을 제품 결정·설계 변경 때문에 **실질적으로 다시 쓰는 경우**에는 새 구조로 승격할 수 있다.
- 단순 verify/FAIL 파생 이슈 추가는 기존 상단 형식을 강제로 재작성하지 않는다.

---

## INDEX.md 운영

`docs/handoff/INDEX.md`가 “지금 누구 차례인가”의 단일 진실원이다.

- 착수 전 자기 차례와 상태를 확인한다.
- 작업 종료 후 상태·다음 주체·대상 커밋을 갱신한다.
- PASS한 행은 archive history로 이동한다.
- verify는 최종 판정 전에 INDEX가 실제 상태와 맞는지 확인한다.

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
│   └── references/failure-patterns.md   # historical corpus로 향하는 호환 symlink
├── handoff-verify/
│   ├── SKILL.md
│   ├── verify.template.md
│   ├── references/0157-case.md
│   └── scripts/...
└── handoff-review/
    ├── SKILL.md
    └── references/
        ├── failure-patterns.md           # 현재 review 진입점
        ├── failure-patterns.corpus.md    # historical evidence 본문, 현재 규칙 SSOT 아님
        ├── regression-coverage.md        # 현재 regression baseline/변경 요약
        └── round2-review.md              # 1~2라운드 외부 검토 원문 스냅샷, 실행 정본 아님
```

review 라운드마다 `roundN-review.md`를 자동 생성하지 않는다. 영구 결과는 지침과 `regression-coverage.md`에 압축한다. 별도 round 문서는 사용자가 감사/원문 보존을 요구했거나 review가 보존 사유를 문서 첫머리에 적을 때만 만들고, **동시에 1개만 유지한다** — 라운드마다 쌓이면 corpus에서 몰아낸 사례 누적을 여기서 재현하는 것이다. 보존 사유에는 실제 출처를 적는다.

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

`handoff-review`는 별도 lifecycle state가 아니라 **메타 유지보수 경로**다. 라운드가 3을 초과하면 다음 재구현 전에 review를 수행해 전제/지침/소통 실패를 분리한다.

### 외부 리뷰는 verify를 대체하지 않는다

PR 리뷰·사용자가 붙여넣은 검토 결과·다른 에이전트의 지적처럼 **handoff 밖에서 도착한 피드백**은 lifecycle의 상태가 아니다. 그것은 `verify/FAIL` 이 아니라 **입력**이다.

- 외부 피드백을 받으면 지적을 **먼저 코드로 검증**하고 결과를 `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관한다. 재현되지 않는 지적은 근거와 함께 기각하고, 대상 커밋이 다른 지적은 그 사실을 적는다.
- 그 피드백으로 재구현하면 라운드는 올라가고 상태는 `impl/IMPL_DONE` 으로 돌아온다. **다음 주체는 여전히 검증자다.**
- **외부 리뷰가 지적하지 않은 표면은 아무도 보지 않았다는 뜻이다.** 외부 리뷰는 자기가 본 범위만 말하고 handoff의 AC·ACTIVE Decision·Product/UX Contract 전체를 대조하지 않는다. `handoff-verify` 의 역방향 탐색·production path 대조·AC 1:1 은 외부 리뷰로 갈음되지 않는다.
- 따라서 **외부 피드백만으로 `verify/PASS` 를 주지 않는다.** 종료하려면 verify 턴을 실제로 수행한다.

> 이 규칙이 없어서 0188 은 impl 라운드를 4회 도는 동안 verify 턴을 **한 번도** 거치지 않았다 — INDEX 는 내내 "다음 주체 = Claude(검증)" 였는데 매 라운드가 외부 리뷰 → 재구현으로 흘렀다. 그 결과 `handoff-verify` 가 이미 갖고 있던 검사(역방향 탐색의 "스토어 값의 기존 소비처 전수와 부작용", AC 의 production path 대조)가 잡았을 결함이 라운드마다 외부 리뷰의 손에 발견됐다.

---

## 단계별 절차

### 1. 설계 — handoff-plan

- find-or-create 후 관련 대화/기존 plan을 읽는다.
- 여러 턴 결정을 Decision Ledger로 복원한다.
- Part I Product & UX Contract → Part II Technical Design 순서로 작성한다.
- Technical Design은 AS-IS와 TO-BE를 같은 축으로 작성하고 Delta를 구현/AC에 연결한다.
- READY self-review 후 INDEX를 갱신한다.

설계자는 현재 요구를 비판적으로 검토하지만 failure corpus를 읽어 자기 skill을 즉석에서 보완하지 않는다.

### 2. 구현

- Part I을 제품 계약, Part II를 기술 구현 가이드로 읽는다.
- ACTIVE Decision과 AC를 임의로 변경하지 않는다.
- 구현 세부·명백한 누락/버그는 선조치 후보고 가능.
- 제품 의도·신규 의존성·Decision·AC 변경은 보고만 하고 결정권자에게 올린다.
- 구현 보고의 `Criteria-Met`은 자기보고일 뿐 verify 증거가 아니다.

#### 구현 게이트의 정본

**게이트 명령은 수정 subtree의 가장 구체적인 `AGENTS.md`가 에이전트 작업 루프의 정본이다.** 이 파일이나 template이 모든 환경에 하나의 명령을 하드코딩하지 않는다. `.github/workflows/ci.yml`은 별도의 **PR/CI 통합 게이트 정본**이다.

`app/**`를 수정한다면 `app/AGENTS.md`의 **better-sqlite3 ABI · 제약 환경 게이트 가이드**를 먼저 읽는다. 현재 기본 원칙은:

- ABI-중립 기본 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 비-DB/순수 테스트: `./node_modules/.bin/vitest run <suite>` 등 `pretest`를 우회하는 명령.
- `npm test`는 DB 동작 자체를 검증할 필요가 있을 때만 의도적으로 실행.
- `npm test` 후 Node ABI → dev/build의 Electron ABI 재빌드가 필요하고, egress 차단 환경에서는 403이 날 수 있으므로 실행 순서와 환경 실패를 분리한다.

`app/AGENTS.md`가 바뀌면 그 **현재 지침이 우선**한다.

### 3. 검증 — handoff-verify

- 구현 전 plan 기준선을 잠근다.
- AC를 보기 전에 diff와 end-to-end 경로를 독립 검토한다.
- Product/UX, ACTIVE Decision, AC를 실제 경로와 대조한다.
- target subtree `AGENTS.md`에 맞는 gate를 실행한다.
- AGENTS/INDEX/trailer/reference 변경이 있으면 repository operation checks도 수행한다.
- FAIL이면 파생 이슈를 plan 하단에 이관한다.
- 반복 실패 사실은 `Review Signals`에 남길 수 있지만 원인 분류·skill 변경은 하지 않는다.

### 4. 메타 리뷰 — handoff-review

먼저 변경 의미로 tier를 고른다. **애매하면 Tier 1**이다.

- **Tier 1 — normative semantics 변경**: Operational Instruction Delta + Historical Failure Regression + Cross-document Consistency를 모두 수행한다.
- **Tier 2 — 실행 의미 불변의 referential/mechanical correction**: affected Operational Delta + Cross-document Consistency를 수행하고 Historical Failure Regression 생략 근거를 남긴다.

reference MOVE/REPLACE는 파일 존재만 보지 않는다. old path inbound reference `N`과 소비자가 기대하는 semantic target `M`을 전수 정리하고, 새 target에서 heading/anchor·named rule·contract·example 같은 의미가 **M/M 유지됨을 구체 evidence로 증명**한다.

P1~P37 같은 historical coverage가 만점이어도 Operational Delta나 Cross-document 검사가 실패하면 review는 완료가 아니다.

---

## 여러 턴의 사용자 결정

Decision Ledger는 대화 전체 복사본이 아니라 **결정 단위 + provenance** 정본이다.

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

상세 실행 표는 `handoff-verify/verify.template.md`에 둔다. 원칙은 다음과 같다.

- 기계적으로 판정 가능한 게이트·계약·상태 로직·레이어 경계·문서 형식/위생은 에이전트가 검증한다.
- 제품 의도·Open Question·시각 품질·신규 의존성·PR 머지 승인은 사람이 결정한다.
- “UI/SDK/electron”이라는 이유만으로 순수 로직까지 사람에게 넘기지 않는다.

## 커밋·git 규약

- 커밋: `<type>(<scope>): <한국어 메시지>`.
- trailer 정본은 root `AGENTS.md`와 `docs/git-template.md`다. 허용되지 않은 `Agent` 값을 만들지 않는다.
- push는 작업 브랜치로 수행한다.
- PR은 사용자가 명시적으로 요청할 때 생성한다.
