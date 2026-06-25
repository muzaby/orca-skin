# docs/handoff/ — Claude Code ↔ Codex 협업 가이드

이 디렉토리는 두 CLI 에이전트의 **hand-off 채널**이다. 역할은 고정이다:

| 에이전트 | 역할 | 산출물 |
|---|---|---|
| **Claude Code** | 설계 + 검증 (+ 비기능 구현) | `plan.md` (설계) · `verify.md` (검증) · 리팩토링/버그수정 코드 |
| **Codex** | 기능 구현 | 코드 (`app/**`) + `plan.md` 의 "구현 보고" 섹션 기입 |

> **구현 주체 분담 규칙**: *기능 구현* 은 Codex 담당. **리팩토링·버그수정 등 비기능 작업은 Claude 가 핸드오프 문서를 만들어 직접 구현까지 수행**한다 — 이 경우 아래 라이프사이클의 plan → impl → verify 를 Claude 가 순차 수행하며, 구현 커밋 trailer 는 `Agent: claude` + `Status: implemented` + `Criteria-*` + `Verified-By: pending` 으로 작성한다(형식은 [`../git-template.md`](../git-template.md)).

두 에이전트는 **분리된 환경**에서 동작하며 라이브 채널이 없다. **git 공유 브랜치가 유일한 메시지 버스**다 — 작업 전 `git pull`, 작업 후 `git push`. 단일 브랜치 순차 진행.

## 진입 트리거 + 제일 먼저 읽을 것: INDEX.md

### 진입 트리거 — 구현 요청 시 핸드오프 find-or-create

사용자 요청을 먼저 분류한다:

| 요청 유형 | 예 | 핸드오프 |
|---|---|---|
| **구현·작업 요청** | "구현해줘"·"고쳐줘"·"추가해줘"·리팩토링·버그수정 (코드/문서 변경을 만드는 요청) | **트리거 발동** (아래 find→create) |
| 자료조사·질문·요약·단순 대화 | "요약하라"·"무엇을 신경쓰나"·"어떻게 동작하나" | 불필요 — 바로 답한다 |

구현·작업 요청이면 `git pull` 후:

1. **Find** — `INDEX.md` 에서 요청에 해당하는 기존 핸드오프 행을 찾는다. **있으면** 그 행의 단계/상태(plan·impl·verify)와 "다음 주체"에 맞춰 **이어간다**(재구현·재검증 포함).
2. **Create (없으면)** — **마지막 일련번호 +1**(아래 "디렉토리 구조" / INDEX 말미 규칙)로 `<NNNN-slug>/plan.md`(plan.template 복사)를 만들고 **설계 턴부터 진입**한다. 구현 요청이라도 **코드로 바로 건너뛰지 않는다** — §1 설계 강화 규칙(의도/조사/의존/UX/리스크 + READY 전 self-review)을 거친다.
3. **Route (분담)** — *기능 구현* → `plan/READY` 후 다음=Codex. *비기능(리팩토링·버그수정)* → Claude 가 plan→impl→verify 직접 수행.

### INDEX.md 운영

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

#### 설계 시 담아야 할 것 (단계별 지침)

> 설계 품질의 단일 책임은 Claude 다. plan 은 *인수 기준* 만이 아니라 **의도 → 조사 → 설계 → 리스크** 흐름을 담는다. 아래는 plan.template.md 의 신규 섹션과 1:1 대응한다. (강제 장치 없음 — 관례 + 5단계 self-review 자가 점검.)

- **0. 자료조사 먼저.** plan 작성 *전* 코드·문서·`chats/` 트랜스크립트를 조사한다. 결정 키워드("확정"/"A로 진행")가 의도의 진실(`chats/AGENTS.md`). 조사 결과는 plan `자료조사` 섹션에 **레퍼런스와 함께** 남긴다 — 내부 문서 `@docs/…`(절 번호 포함)·`@chats/…`, 코드 `파일:라인`, 외부는 **웹 URL** 또는 원문 미러 `@docs/spec/…`. **레퍼런스 없는 주장 금지**(추측은 리스크/Open Question 으로 분리). (새 state 아님 — 설계 턴의 첫 하위 단계.)
- **1. 사용자 의도 분리.** 명시 요구 vs 추론 의도를 plan 에서 가른다. 추론은 추론이라고 표기한다("사용자 말 ↔ 내 해석").
- **2. 의존 기술·전제 식별.** 구현이 기댈 SDK 옵션·모듈·라이브러리·전제를 적는다. **신규 의존성은 사용자 승인 대상**(단독 결정 금지, Open Question 연결).
- **3. 파생 UX·엣지케이스 열거.** 요구에서 파생되는 상태/상호작용/엣지케이스(로딩·에러·빈상태·동시성/멀티세션·테마·접근성)를 미리 펼친다.
- **4. 리스크·트레이드오프 검토.** 되돌리기 어려운 결정·완화책을 적고, Open Question(PRD §11 / TRD §15)은 사용자에게 묻는다.
- **5. READY 전 self-review.** plan 의 "설계 self-review 체크리스트" 를 모두 ✅ 로 통과한 뒤에야 `plan/READY` 로 표기한다.

### 2. 구현 (Codex)
- `git pull` → `INDEX.md` 에서 자기 차례 확인 → `plan.md` + `docs/` 정독.
- 구현 후 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.
- `plan.md` 의 `[구현자 기입]` 섹션 기입 (변경 파일·실행 명령·게이트 결과·블로커).
- `INDEX.md` 갱신: `impl/IMPL_DONE`, 다음=Claude, 대상 커밋 hash 기재.
- commit `feat|fix|refactor(scope): …` (한국어) + **구현 커밋 trailer**(`Agent: codex`·`Status`·`Criteria-Met`·`Verified-By: pending` …) → `git push`.

#### 구현 시 지침 (구현자 = Codex 기능 / Claude 비기능)

> 구현자는 설계를 *그대로 받아쓰지 않는다*. 실무 관점에서 비판적으로 읽고, 설계가 놓친 것을 plan 에 되먹인다.

- **설계 비판적 리뷰.** plan 을 실무 관점에서 검토해 현실성·구멍을 짚고 `[구현자 기입] 설계 리뷰` 에 동의/이견을 적는다(plan 섹션 인용).
- **선조치 후보고.** 설계가 다루지 못한 잠재 문제는 `[구현자 기입] 놓친 잠재 문제 + 대응` 에 적고 **대응을 구현한 뒤 보고**한다. 단 **선조치 경계**를 지킨다:
  - **선조치 가능(✅ 구현·보고)**: 구현 세부·놓친 엣지케이스·명백한 누락/버그.
  - **선조치 불가(⚠️ 보고만·결정 필요)**: Open Question(PRD §11/TRD §15)·신규 의존성·제품 의도·인수 기준(설계) 변경 → 사용자/설계자 결정(기존 "단독 결정 금지" 와 동일 경계).

### 3. 검증 (Claude Code)
- `git pull` → `_templates/verify.template.md` 를 `<NNNN-slug>/verify.md` 로 복사해 작성.
- **구현자 코멘트 확인**(매트릭스 전 선행): plan 의 `[구현자 기입]` 설계 리뷰·놓친 잠재 문제·선조치(✅/⚠️)를 먼저 읽고 매트릭스/파생 이슈에 반영.
- **요구사항 충족 매트릭스**(증거 첨부) + **검증 책임 분리표(사람/에이전트)** + 게이트 재실행 + 위생 검토 + PHASES 정합.
- **검증 자기 리뷰**(무엇이 부족했나): 설계/구현/검증 각 단계의 미흡점을 결과 요약에 메타로 적는다.
- **PASS**: `INDEX.md` `verify/PASS` → `docs/PHASES.md` 표 행 승격(PR#/커밋) → (사용자 요청 시) PR.
- **FAIL**: verify "미충족 요구사항" 체크리스트 작성 → **미해결 문제는 plan 에 "파생 이슈(Derived Issues)" 챕터를 신설**해 이관(구현자 코멘트 참조 또는 사용자 코멘트) → `INDEX.md` `verify/FAIL`, 다음=Codex, 라운드 +1 로 구현 턴 루프백.
- commit `docs(handoff): <slug> 검증 (PASS|FAIL r<N>)` + **검증 커밋 trailer**(`Agent: claude`·`Status: verified`·`Verified-By: claude:pass|claude:fail`·`Next-Action` …) → `git push`.

## 충돌 최소화 (단일 브랜치)

파일 도메인을 분리한다:

- **Claude** → `docs/handoff/**` + `docs/PHASES.md` (문서)
- **Codex** → `app/**` (코드)
- `plan.md` 는 공유한다 — **설계자(Claude)는 상단**, **구현자는 `[구현자 기입]` 섹션만**, **검증자(Claude)는 하단 "파생 이슈" 챕터만** 추가한다 (섹션 분리로 충돌 회피).

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
