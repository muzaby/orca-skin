# docs/handoff/ — Claude Code ↔ Codex 협업 가이드

이 디렉토리는 두 CLI 에이전트의 handoff 채널이다. 본 문서는 **협업 규칙·상태 머신·역할 분담·review 진입 조건**을 갖는다. 산출물을 어떻게 작성·검증하는지는 각 skill이 정본이고, **네 산출물에 공통으로 걸리는 문장 규칙은 본 문서 §산출물 문장 규칙**이 갖는다.

| 목적 | 정본 |
|---|---|
| `plan.md` 설계 | [`.agents/skills/handoff-plan/`](../../.agents/skills/handoff-plan/) — `SKILL.md` + `plan.template.md` |
| **구현 턴 수행** | [`.agents/skills/handoff-impl/`](../../.agents/skills/handoff-impl/) — `SKILL.md`. 산출 surface는 `plan.template.md`의 `[구현자 기입]` |
| `verify.md` 검증 | [`.agents/skills/handoff-verify/`](../../.agents/skills/handoff-verify/) — `SKILL.md` + `verify.template.md` |
| handoff 지침 자체 개선 | [`.agents/skills/handoff-review/`](../../.agents/skills/handoff-review/) — `SKILL.md` + regression references |

`.claude/skills` 심링크를 통해 skill을 인식한다. plan/impl/verify/review를 수행할 때는 해당 skill을 먼저 로드한다. **skill을 읽을 수 없는 환경이라면 본 문서의 §단계별 절차가 최소 계약이다** — 게이트 정본은 이 문서가 계속 소유한다(§구현 게이트의 정본).

## 네 skill의 책임 분리

### handoff-plan — 현재 설계

- 여러 턴의 사용자 합의를 **Decision Ledger**로 보존한다.
- plan 앞부분에 **Product & UX Contract**를 두어 사용자/소비자가 받는 결과를 먼저 고정한다.
- Product/UX에서 모듈 내부까지 **V 노드와 검증 pair**를 먼저 선언해 구현·검증의 공통 추적축을 만든다. 명시적인 기존 V를 일부 변경할 때만 Delta V를 쓴다.
- 뒷부분 Technical Design은 **AS-IS → TO-BE → Delta**로 현재와 목표 구조를 같은 축에서 대조한다.
- 코드 조사·아키텍처·데이터/제어 흐름·모듈·테스트를 구체화한다.
- 현재 요구를 비판적으로 검토한다.

### handoff-impl — 현재 구현 수행

- plan의 Decision·AC·Technical Design을 **계약으로** 수행한다.
- 유효 V의 `REQUIRED`·`REGRESSION` pair와 현재 변경에 적용되는 저장소 gate를 수행하고 pair별 자기검증을 남긴다.
- plan `§10 강제 지점` 표의 지점을 **지점 수만큼** 닫고 개수를 보고한다.
- 구현 중에만 보이는 것을 진단한다 — 다중 저장소 쓰기, 부분 실패 잔여, 새로 만든 표면.
- **Product/UX 파생 문제**를 사용자 자리에서 되짚는다(만든 문구에 소비자가 있는가, 실패가 화면에서 무엇으로 보이는가).
- 재구현 라운드에서는 지적을 **불변식으로 올려 전수 적용**한다.
- 발견을 `[구현자 기입]`으로 **plan에 되먹인다**. 처리 권한은 세 갈래(선조치 / 수정 제안 / 보고만)로 갈린다.

### handoff-verify — 현재 구현 검증

- 구현을 독립적으로 비판한다.
- Product/UX, ACTIVE Decision, AC와 실제 production path를 대조한다.
- AC 밖 결함을 역방향으로 찾되, 현재 유효 V-pair·ACTIVE Decision·기존 blocking 이슈 또는 이번 변경 산출물의 필수 gate에 귀속되는 결함만 현재 handoff를 막는다.
- 검증 가능한 부분을 최대한 기계 검증하고 남은 경계만 사람에게 넘긴다.
- repository operation(AGENTS/INDEX/trailer/reference)도 실제 변경 범위에 포함되면 검증한다.

### handoff-review — handoff 시스템 개선

- 반복 실패·decision drift·소통 실패의 원인을 분류한다.
- V 추적 규약 변경은 과거 pattern과 실제 handoff anchor를 새 상태 머신으로 replay해 거짓 PASS와 FAIL inflation을 함께 검사한다.
- 사례 누적보다 `handoff-plan` / `handoff-impl` / `handoff-verify` **지침 자체**의 통합·교체·강화를 우선한다.
- normative semantics가 바뀌는 지침 변경은 **Tier 1: Operational Instruction Delta → Historical Failure Regression → Cross-document Consistency**를 수행한다.
- 실행 의미가 불변인 단순 referential/mechanical correction은 **Tier 2: affected Operational Delta + Cross-document Consistency**로 줄일 수 있다. **애매하면 Tier 1**이다.

**중요**: plan/impl/verify는 정상 작업 중 failure corpus를 읽으며 즉석에서 자기 규칙을 만들거나 종료 때 corpus를 직접 갱신하지 않는다. 사례의 일반화·skill 변경·corpus 유지 판단은 review 책임이다.

---

## 공통 V 추적 프로토콜

V는 기존 Decision·AC·강제 지점·production-path·선택된 mutation 증거를 대체하지 않고 **어떤 설계 계약을 어떤 증거로 닫는지 연결하는 추적축**이다. 관계는 many-to-many이며 억지로 1:1로 만들지 않는다.

| 설계 노드 | 검증 노드 | 계약 범위 |
|---|---|---|
| `R` Requirement | `AT` Acceptance Test | 사용자가 관측하는 Product/UX 요구와 인수 증거 |
| `SD` System Design | `ST` System Test | end-to-end 상태·수명주기·시스템 경로와 종단 증거 |
| `AR` Architecture | `IT` Integration Test | 모듈 경계·producer/consumer·조립·계약 edge와 통합 증거 |
| `MD` Module Design | `UT` Unit Test | 모듈 불변식·알고리즘·seam과 국소 증거 |

### Baseline V · Delta V · pair

- 명시적으로 상속할 V가 없으면 plan은 이번 작업의 **Baseline V**를 만든다. 기존 V의 commit/revision을 상속해 일부만 바꿀 때만 **Delta V**를 만들며, 유효 V는 `Baseline V + 순서대로 적용된 Delta V`다.
- Delta V는 기준 V 전체를 다시 쓰지 않는 **작은 증분 V**다. 변경이 시작되는 수준부터 아래쪽의 `NEW`·`CHANGED`·`SUPERSEDED` 노드와 영향받은 `INHERITED` 회귀만 기록하며, Requirement에서 시작해 전체 층을 포함해도 기존 V에 대한 증분이라는 성질은 바뀌지 않는다.
- 노드 provenance는 `NEW` · `CHANGED` · `INHERITED` · `SUPERSEDED`다. `INHERITED`는 변경하지 않은 기준선의 출처, `SUPERSEDED`는 대체 노드를 반드시 가리킨다.
- pair requiredness는 `REQUIRED` · `REGRESSION` · `NOT_REQUIRED`다. 모든 `NEW`·`CHANGED` 왼쪽 노드는 같은 레벨의 `REQUIRED` pair가 필요하고, 변경 경로가 기존 상위 동작에 닿으면 해당 `INHERITED` 노드를 `REGRESSION` pair로 다시 닫는다.
- 필요한 레벨은 변경 효과로 고른다. 모듈 동작은 `MD↔UT`, production 경계·배선·이벤트·저장소는 `AR↔IT`, end-to-end 상태·수명주기는 `SD↔ST`, 사용자 관측 결과는 `R↔AT`가 필요하며 해당 효과를 누락하면 `PLAN_GAP`이다.
- `NOT_REQUIRED`는 Delta V에서 명시적으로 비영향을 판정한 `INHERITED` pair에만 쓰며 출처·기존 증거·비영향 근거를 적는다. 영향 없는 기준 V 전체를 복사하지 않고, 필요한 변경·회귀 행이 없는 것을 암묵적 `NOT_REQUIRED`로 읽지 않는다.
- 각 pair는 stable ID, 좌·우 노드, 레벨, `start → edges → end` production path, 강제 지점 전수 `N`, 직접 판정 oracle을 갖는다. 강제 지점이 없으면 `0 + 이유`를 적고, 음성 대조/결함 변이는 oracle의 방향·민감도를 별도로 확인해야 하는 pair에만 선택해 이유와 함께 등록한다.
- pair 실행 결과는 `PASS` · `PAIR_FAIL` · `BLOCKED_BY:<root-pair>` · `NOT_REQUIRED`다. 하위 root 실패 때문에 독립 판정할 수 없는 pair만 `BLOCKED_BY`로 두며 같은 원인을 여러 실패로 부풀리지 않는다.

### 판정 범위와 운영 gate

보안·데이터 무결성처럼 이번 요구 경로에 필요한 제약은 V node·ACTIVE Decision·AC·§10 중 하나에 귀속시킨다. 필요한 계약이 plan에서 빠졌으면 `PLAN_GAP`이며, V 밖의 포괄적인 "전역 불변식"을 새 blocking 범위로 만들지 않는다.

수정 subtree의 필수 gate와 repository/message-bus 검사는 **이번에 변경한 산출물의 완료 조건**이다. 현재 변경이 gate를 깨뜨렸거나 명시된 현재/상속 계약 위반을 드러내면 blocking이고, 관련 없는 기존 실패는 환경·기준선 한계로 분리해 현재 제품 범위를 확장하지 않는다.

검증 finding은 다음 네 disposition 중 하나다.

| disposition | 조건 | handoff 결과 |
|---|---|---|
| `BLOCKING` | 현재 유효 V-pair·ACTIVE Decision·기존 blocking 이슈 또는 이번 변경 산출물의 필수 gate 위반 | `FAIL` |
| `PLAN_GAP` | 필요한 계약·노드·pair·경로·강제 지점·oracle이 없거나 서로 모순되어 구현자가 정할 수 없음 | `RETURN_TO_PLAN` |
| `NON_BLOCKING` | 재현되지만 위 두 범주에 속하지 않는 인접 결함/개선 | 현재 PASS를 막지 않음 |
| `NEXT_HANDOFF` | 별도 설계·범위·결정이 필요한 독립 작업 | 새 handoff 후보 |

명시된 기존 계약 위반은 증거 행이 빠졌더라도 `PAIR_FAIL`이다. 동시에 계획 누락을 기록할 수 있지만 결함을 `PLAN_GAP`으로 낮추지 않는다. 반대로 구현자가 새 요구나 pair를 발명하거나 모순된 기준 중 하나를 골라야만 고칠 수 있다면 구현 실패가 아니라 `PLAN_GAP`이며 설계자가 기준 V에 새 Delta V를 적용한다.

새 mutation은 검증 범위를 정하지 않는다. 현재 node를 깨뜨린다는 증거면 기존 pair의 실패를 확인하고, 필요한 oracle/pair가 없음을 드러내면 `PLAN_GAP`, 현재 유효 V와 무관하면 `NON_BLOCKING` 또는 `NEXT_HANDOFF`다.

---

## 산출물 문장 규칙

적용 대상: `plan.md` · `verify.md` · `[구현자 기입]` · `INDEX.md` 비고 · review 산출과 handoff 지침 문서. root `AGENTS.md` 커밋 프로토콜의 "본문 2~3줄 · *무엇*은 diff가, *깊이*는 `Handoff:`가 가리키는 문서가 준다"를 나머지 산출물로 확장한 규칙이다.

1. **판정을 첫 문장에 쓴다.** PASS/FAIL/RETURN_TO_PLAN · 유지/변경 · ✅/⚠️/❌를 먼저 적고 이유를 뒤에 붙인다.
2. **주장 한 줄에 관측 하나.** `파일:줄` · `rg` 결과와 개수 · 테스트 케이스명 · 재현 명령 · 실제 출력 중 하나를 붙인다. 관측이 없는 줄은 아직 조사되지 않은 줄이다.
3. **길이 상한**: 표 한 칸 3줄 · 산문 한 문단 3문장. 넘으면 표로 가르거나 절을 나눈다. `INDEX.md` 비고는 **5줄 이내** — 상세의 정본은 `plan.md`/`verify.md`다. 이 상한은 **이번 턴에 새로 쓰거나 갱신하는 문장**에 걸린다. 기존 문서를 형식만 맞추려 일괄 재작성하지 않는다(§신규 템플릿 적용 경계와 같은 경계).
4. **쓰지 않는 것**: 같은 사실을 요약 → 재서술 → 강조로 되풀이 · 교훈조 마무리와 수사 · 근거 없는 강조 볼드 · 장식 기호(ⓐⓑ·이모지)로 만든 목록 · 결론 없는 양쪽 서술.
5. **간결함은 증거를 줄이는 근거가 아니다.** 줄이는 것은 서술이고 관측값·전수 개수·재현 명령·AC·강제 지점은 그대로 남는다. 증거를 지우는 것은 간결이 아니라 회귀다.

> 사례(0190). 보드 행 하나가 표 한 칸에 **13,190자**였고(archive 최대 33,510자) 같은 사실이 `plan.md` 59KB · `verify.md` 47KB · 커밋 본문에 다시 있었다. 사본이 길어지면 갈라진다 — 0190 r1의 `Criteria-Met`은 본문에서 `14/17`로 고쳐졌지만 커밋 trailer 3개에는 `13/17`이 남았다.

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

Part I/II, Decision Ledger, Technical Design AS-IS/TO-BE, Baseline V/Delta V가 포함된 새 템플릿은 **신규 handoff부터 적용**한다.

- 진행 중인 기존 handoff를 형식만 맞추기 위해 일괄 마이그레이션하지 않는다.
- 기존 plan을 제품 결정·설계 변경 때문에 **실질적으로 다시 쓰는 경우**에는 새 구조로 승격할 수 있다.
- 기존 plan의 구현자·검증자는 AC·§10·production path에서 읽기 전용 V 매핑을 합성하며 형식만을 이유로 `PLAN_GAP`을 만들지 않는다.
- 단순 verify/FAIL 파생 이슈나 RETURN_TO_PLAN의 Delta V 정정은 영향받은 규범 행만 갱신하고 기존 상단 전체를 강제로 재작성하지 않는다.

---

## INDEX.md 운영

`docs/handoff/INDEX.md`가 “지금 누구 차례인가”의 단일 진실원이다.

- 착수 전 자기 차례와 상태를 확인한다.
- 작업 종료 후 상태·다음 주체·대상 커밋을 갱신한다.
- **「다음 주체」 칸에는 지금 차례인 주체 하나만 적는다** — 이후 순서가 정해져 있으면 비고에 적는다. 한 칸이 두 주체를 담으면 그 칸은 "지금 누구 차례인가"에 스스로 답하지 못한다(0198 r6: `Claude (규범 행 정정 → 이후 Codex r6)` 칸에서 구현자가 자기 차례로 읽고 설계 턴까지 수행했다).
- **대상 커밋 좌표는 검증자가 기입한다.** 구현자는 `(rN 구현 — 검증자 기입)`을 남긴다 — 두 에이전트는 분리 환경이라 구현자가 확인한 로컬 해시가 공유 브랜치에 그대로 도착하지 않는다(0198: r2·r3·r6이 죽은 해시, r4·r5는 자리표시자로 남겨 검증자가 교정했다).
- **비고는 5줄 이내**로 적고 상세는 `plan.md`/`verify.md`로 링크한다(§산출물 문장 규칙 3).
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
│   ├── plan.template.md                 # `[구현자 기입]` = handoff-impl의 산출 surface
│   └── references/failure-patterns.md   # historical corpus로 향하는 호환 symlink
├── handoff-impl/
│   └── SKILL.md                         # 별도 template 없음 — plan.template.md를 채운다
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
  ├ verify/FAIL ── pair/현재 산출물 gate 위반 → 재구현 → 재검증
  └ verify/RETURN_TO_PLAN ── PLAN_GAP → plan/DRAFT → 규범 정정 → plan/READY
```

| 상태 | 의미 | 다음 주체 |
|---|---|---|
| plan/DRAFT | 설계 중 | Claude |
| plan/READY | Product/UX + Technical Design 확정 | Codex 또는 비기능이면 Claude |
| impl/IN_PROGRESS | 구현 중 | 구현자 |
| impl/IMPL_DONE | 구현 + 게이트 후 검증 대기 | Claude |
| verify/PASS | 완료 | — |
| verify/FAIL | 명시 계약 pair 또는 이번 변경 산출물의 필수 gate 미충족 | 구현자 |
| verify/RETURN_TO_PLAN | `PLAN_GAP`으로 기준선 정정 필요 | 설계자 |

**`PLAN_GAP`을 구현자에게 넘기지 않는다.** 구현자는 Decision·AC·V 노드/pair·§10을 고칠 수 없으므로(§2 최소 계약) 그대로 다음 라운드로 보내면 그 요구는 소멸한다 — 0198 r4가 §10 두 행 신설을 요구했으나 보드가 곧장 구현자로 갔고 r5에서 같은 축이 다시 열렸다. 검증자는 `verify/RETURN_TO_PLAN`과 root gap을 기록하고 INDEX 다음 주체를 설계자로 둔다. 설계자는 영향받은 Delta V와 규범 행만 새 revision으로 정정한 뒤 별도 설계 커밋으로 `plan/READY`에 돌려놓는다.

구현 중 먼저 `PLAN_GAP`을 발견하면 검증 상태를 가장하지 않는다. `impl/IMPL_DONE`으로 넘기지 않고 INDEX를 `plan/DRAFT`·다음 주체 설계자로 돌린 뒤 같은 정정 절차를 밟는다.

`handoff-review`는 별도 lifecycle state가 아니라 **메타 유지보수 경로**다. 라운드가 3을 초과하면 다음 재구현 전에 review를 수행해 전제/지침/소통 실패를 분리한다.

### 외부 리뷰는 verify를 대체하지 않는다

PR 리뷰·사용자가 붙여넣은 검토 결과·다른 에이전트의 지적처럼 **handoff 밖에서 도착한 피드백**은 lifecycle의 상태가 아니다. 그것은 `verify/FAIL` 이 아니라 **입력**이다.

- 외부 피드백을 받으면 지적을 **먼저 코드로 검증**하고 결과를 `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관한다. 재현되지 않는 지적은 근거와 함께 기각하고, 대상 커밋이 다른 지적은 그 사실을 적는다.
- 그 피드백으로 재구현하면 라운드는 올라가고 상태는 `impl/IMPL_DONE` 으로 돌아온다. **다음 주체는 여전히 검증자다.**
- **외부 리뷰가 지적하지 않은 표면은 아무도 보지 않았다는 뜻이다.** 외부 리뷰는 자기가 본 범위만 말하고 handoff의 V-pair·AC·ACTIVE Decision·Product/UX Contract 전체를 대조하지 않는다. `handoff-verify`의 역방향 탐색·production path 대조·pair closeout은 외부 리뷰로 갈음되지 않는다.
- 따라서 **외부 피드백만으로 `verify/PASS` 를 주지 않는다.** 종료하려면 verify 턴을 실제로 수행한다.
- **밀린 verify 가 있는데 외부 피드백이 또 도착하면 순서를 사용자에게 확인한다.** 보드의 다음 주체가 이미 검증자인 상태에서 새 외부 피드백이 오면 "이 피드백을 먼저 반영할지, 밀린 verify 를 먼저 수행할지" 는 **두 해석이 모두 합리적인 갈림길**이다 — 에이전트가 조용히 재구현을 고르지 말고 한 줄로 묻고 사용자의 답에 따른다. 위 규칙들은 *무엇을 verify 라고 부를지* 만 정하고 *무엇을 먼저 할지* 는 정하지 않는다.

> **사례(0188).** impl 라운드 **10회** 동안 verify 턴이 0회였다 — 보드는 내내 "다음 주체 = Claude(검증)"였고 매 라운드가 외부 리뷰 → 재구현으로 흘렀다. r5에서 신설된 위 규칙은 라벨 축에서는 지켜졌다(보드 비고와 `Verified-By: pending` 유지, 거짓 PASS 0). 라벨을 고정하는 규칙이 순서를 바꾸지 못해 순서 질의 조항이 붙었다. r10 이후 실제 verify 턴의 신규 코드 결함은 0건 — 비용은 "놓친 결함"이 아니라 "닫히지 않는 핸드오프"였다.

---

## 단계별 절차

### 1. 설계 — handoff-plan

- find-or-create 후 관련 대화/기존 plan을 읽는다.
- 여러 턴 결정을 Decision Ledger로 복원한다.
- Part I Product & UX Contract → Part II Technical Design 순서로 작성한다.
- 명시적인 기존 V가 없으면 Baseline V를, 기존 V를 일부 바꾸면 Delta V를 선언하고 `R↔AT`, `SD↔ST`, `AR↔IT`, `MD↔UT` 중 영향 수준을 고른다.
- Technical Design은 AS-IS와 TO-BE를 같은 축으로 작성하고 Delta를 구현/AC에 연결한다.
- READY self-review 후 INDEX를 갱신한다.

설계자는 현재 요구를 비판적으로 검토하지만 failure corpus를 읽어 자기 skill을 즉석에서 보완하지 않는다.

### 2. 구현 — handoff-impl

절차 정본은 [`.agents/skills/handoff-impl/SKILL.md`](../../.agents/skills/handoff-impl/) 다. 아래는 **skill을 읽지 못하는 환경에서도 지켜야 할 최소 계약**이며, 각 항목의 근거·판정 방법은 skill이 갖는다.

- Part I을 제품 계약, Part II를 기술 구현 가이드로 읽는다.
- 유효 V의 `REQUIRED`·`REGRESSION` pair와 이번 변경 산출물의 필수 gate를 작업 목록으로 만들고 pair별 자기검증을 남긴다.
- ACTIVE Decision과 AC를 임의로 변경하지 않는다.
- 필요한 V 노드/pair·경로·oracle·강제 지점이 빠졌거나 바뀌어야 하면 해당 경로를 멈추고 `PLAN_GAP`으로 설계자에게 돌린다. 같은 에이전트가 설계도 맡더라도 plan skill로 전환하고 규범 정정 커밋을 구현과 분리한다.
- 구현 세부·명백한 누락/버그는 선조치 후보고 가능.
- 제품 의도·신규 의존성·Decision·AC 변경은 보고만 하고 결정권자에게 올린다.
- 구현 보고의 `Criteria-Met`은 자기보고일 뿐 verify 증거가 아니다. **그러므로 "닫았다/충족"으로 적는 모든 행(AC·강제 지점·계약이 요구한 표기·이번 턴이 갱신한 상태 사본)에 이번 턴에 재현한 관측값을 함께 적는다** — 산출물에서 표식을 다시 찾지 못하면 ✅로 세지 않는다. **완결성 주장(`전건`·`미분류 0`·`잔여 0`)의 관측값은 총계가 아니라 차집합이다** — 합계는 총계에 맞춰 배분한 값이라 반증할 수 없다. (skill §8)
- **이번 턴에 만들거나 고친 oracle은 주장하는 production 경로에 실제로 진입해야 한다.** 구조적 proxy·0건/전수 스윕·배선 존재처럼 plan이 적대 증거를 선택한 oracle은 등록된 결함을 심어 방향·민감도를 확인하고, 직접 행동 결과를 관측하는 oracle까지 mutation을 의무화하지 않는다. (skill §3·§8)
- **등록된 적대 증거가 있으면 이번 라운드가 닫는 지점을 실제로 보는지 결함을 심어 확인한다.** 분모는 pair가 선택한 변이·닫는 파생 이슈가 인용한 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도이며, 일반 hunk를 자동 분모로 삼지 않는다. 인용 변이가 검출되지 않으면 그 이슈는 닫히지 않았고, 적대 증거를 선택하지 않은 pair는 직접 행동 oracle로 확인한다. **형제 슬롯이 서로 다른 계약을 가지면 지우는 변이에 더해 형제와 맞바꾸는 변이도 심는다** — 존재만 보는 단언은 자리를 바꾼 회귀에 침묵한다. (skill §3·§5)
- **합계는 행과 별개로 센다.** ✅ 개수와 현재 AC 총수를 세어 검산 줄을 적고, **그 줄을 쓴 뒤 커밋 trailer를 적는다** — trailer는 고칠 수 없는 사본이다. AC를 갈라 분모가 바뀌면 이전 라운드 합계와 직접 비교하지 않고 분모 변경을 적는다. (skill §8)
- **plan `§10 강제 지점` 표에 지점이 여럿이면 그 개수만큼 닫고 개수를 보고한다.** 한 지점만 닫아도 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다. 일부만 닫았으면 남긴 곳을 적는다. **네가 그 표에 행을 신설하면 지점 수도 전수 검색으로 세고 검색 명령을 적는다** — 자기가 정한 분모에 자기가 맞추면 `N/N`은 아무것도 말하지 않는다. **그 검색의 술어는 불변식의 주어로 쓴다 — 네가 쓴 해법의 이름이 아니다.** 해법 이름으로 세면 이미 고친 지점만 분모에 오르고, 결함 심기는 그 집합의 감도만 증명한다. (skill §2)
- **지적으로 도는 모든 재구현 라운드(verify/FAIL 파생 이슈·외부 PR 리뷰·사용자 지적)는 지적을 재현하는 데서 멈추지 않는다** — 불변식을 한 문장으로 올리고, 성립해야 할 지점을 **그 불변식을 낳은 문장부터** 전수로 닫고, 이번 수정이 만든 새 표면을 스스로 검사한다. **파생 이슈의 계약은 `출처`가 가리키는 V-pair·Decision·AC·§10·현재 산출물 gate이고 `대응 방향`은 제안이다** — 닫힘은 제안 수행이 아니라 그 계약의 성립이다. Decision으로 규칙을 적는 것은 적용을 보장하지 않는다. (skill §5)
- **Product/UX 파생 검토를 한다** — 만든 사용자 대면 문구·상태에 소비자가 있는가, 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가. 범위 밖이면 고치지 않더라도 파생 이슈로 적는다. (skill §4)
- 발견은 `[구현자 기입]`으로 plan에 되먹인다. 처리 권한은 **선조치 / plan 수정 제안 / 보고만** 세 갈래다. (skill §6)
- **설계 대비 차이를 보고했으면 그 차이에 기댄 AC를 대체물의 실패 모드로 다시 유도한다** — 대체물에만 있는 만료·**공유**(누가 함께 쓰고 누가 비울 수 있는가)·재진입·다른 무효화 축을 **축마다 한 줄씩** 적고, 축마다 다시 확인한 AC·§10 행 또는 `해당 없음`과 근거를 남긴다 — 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다. (skill §6)
- **재구현 라운드도 `[구현자 기입]`의 같은 이름 필드를 다시 채운다** — 라운드 표제만 바꾸고 필드를 줄이지 않으며, 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다. 산문 목록으로 갈아타면 필드 이름과 함께 그 필드가 요구하던 증거도 사라진다. (skill §8)
- **대상 커밋 좌표를 자기 환경의 해시로 적지 않는다** — 분리 환경이라 그 해시는 공유 브랜치에 그대로 도착하지 않는다. INDEX 칸은 `(rN 구현 — 검증자 기입)`, plan 구현 보고 행은 `(rN 구현 — 좌표는 INDEX)`로 남긴다 — 좌표 정본은 INDEX 한 곳이다. (skill §8)
- **승인받아 plan의 규범 행(Decision·AC·V node/pair·§10)을 고쳤다면 그 정정은 구현과 다른 커밋이다.** 한 커밋에 섞이면 verify §0의 기준선 잠금이 무력해진다 — 정본은 `handoff-plan/SKILL.md` 마무리. (skill §6)

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
- plan validity를 먼저 감사하고 `UT → IT → ST → AT` 순서로 `REQUIRED`·`REGRESSION` pair를 닫는다.
- target subtree `AGENTS.md`에 맞는 gate를 실행한다.
- AGENTS/INDEX/trailer/reference 변경이 있으면 repository operation checks도 수행한다.
- **대상 커밋 좌표를 기입한다** — 구현자가 남긴 자리표시자를 공유 브랜치의 실제 커밋으로 채우고 `git cat-file -t`로 확인한다.
- **등록된 적대 증거를 다시 센다** — 구현자 보고와 무관하게 pair가 선택한 변이·닫는 파생 이슈의 인용 변이·새 oracle의 민감도 검사를 다시 실행한다. 검출되지 않은 인용 변이가 있으면 구현자가 `closed`로 적었어도 그 이슈는 닫히지 않으며, 소거 변이는 잔여물 진단이 0이 될 때까지 밀어 그 상태의 게이트로 판정하고, 형제 슬롯이 서로 다른 계약을 가지면 두 산출을 맞바꾸는 변이까지 본다. (skill §4)
- pair/이번 변경 산출물의 필수 gate 위반은 `FAIL`, 계획 누락은 `RETURN_TO_PLAN`, 그 밖의 발견은 `NON_BLOCKING` 또는 `NEXT_HANDOFF`로 이관한다.
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
- trailer 정본은 root `AGENTS.md`와 `docs/git-template.md`다. 허용되지 않은 `Agent` 값을 만들지 않는다. **커밋 후 `git log -1 --format='%(trailers:only=true)'`로 파싱을 확인한다** — 값이 맞아도 파싱 0건이면 메시지 버스가 끊긴다.
- push는 작업 브랜치로 수행한다.
- PR은 사용자가 명시적으로 요청할 때 생성한다.
