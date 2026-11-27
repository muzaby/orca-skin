---
name: handoff-review
description: handoff 지침(plan·impl·verify·review SKILL·template·script·AGENTS) **자체**를 진단하거나 고칠 때 쓴다 — 특정 구현을 다시 검사하는 스킬이 아니다. verify가 리뷰 필수(3·6회째 비PASS · 9회째 CLOSED)를 보고했거나 사용자가 권고를 수락했을 때(verify는 이 스킬을 부르지 않는다), verify 없는 impl 턴이 3을 넘을 때, 같은 실수가 라운드·handoff를 넘어 반복되거나 확정 결정이 drift할 때, 사용자가 handoff 프로세스 리뷰·스킬 개선을 요청할 때, 지침·도구·V 추적 규약·발견 분류를 바꾸는 메타 수정을 할 때(이미 고치는 중이어도) 로드한다. 실패 추세를 verify 이력으로 설명하고 원인을 갈라 지침·도구를 고친다.
---

# handoff-review — handoff 지침을 고치고, 고친 지침이 아무것도 잃지 않았음을 보인다

## 무엇을 위해 하는가

plan·impl·verify는 작업을 수행하고, review는 그 수행을 정하는 지침을 고친다. 반복된 실패·결정 drift·소통 실패에서 원인을 찾아 지침을 교체·통합하고, 그 변경이 기존 운영 계약과 과거 실패 방어선을 깨지 않았음을 증거로 보인다. 사례를 한 줄 더 쌓는 것으로 끝내지 않는다 — 주 산출물은 SKILL/template/AGENTS/공통 지침의 변경·유지 판단이다.

| 문서 | 정본인 것 |
|---|---|
| `handoff-plan` · `handoff-impl` · `handoff-verify`의 `SKILL.md` | 각 턴이 지금 따르는 규칙 |
| `docs/handoff/AGENTS.md` | 협업·상태 머신·발견 분류·하한·게이트, skill 미가용 환경의 구현 턴 최소 계약 |
| [`references/failure-patterns.md`](references/failure-patterns.md) | historical corpus의 진입점 — 실행 지침이 아니다 |
| [`references/regression-coverage.md`](references/regression-coverage.md) | review 라운드 기록 — 현재 regression baseline과 변경 요약 |
| [`scripts/instruction_delta.py`](scripts/instruction_delta.py) | 6-A 후보 줄 추출 |
| 이 스킬 | 실패 증거를 일반화한 지침 변경과 그 회귀 검증 |

## 언제 하는가

발동 조건·횟수·예외와 verify `권고`의 처리는 `docs/handoff/AGENTS.md §handoff-review 트리거`가 정본이다. 정상 단일 PASS마다 하지 않는다.

## 절차

```text
0. 모드와 근거        DIAGNOSE_ONLY / APPLY
1. 증거               라운드 이력 · verify 메타 · 변경 전 지침
2. 원인 분류          이슈마다 A~F, verify 발견 분류 대조
3. 지침 결함          막았어야 할 지침을 찾아 A/B를 가른다
4. 지침 수정          교체·통합 먼저, 모델이 따르는 문장으로
5. 책임 경계          plan/impl/verify의 몫을 가져오지 않는다
6. 회귀 검증          Tier → 6-A → 6-B → 6-C
7. 기록               corpus · regression-coverage
8. 전환               판정 의미가 바뀌었으면 발동 handoff의 판정 정정
9. decision drift     해당하면
10. 커밋 · 종료 보고
```

## 0. 실행 모드

| 모드 | 언제 | 하는 일 |
|---|---|---|
| `DIAGNOSE_ONLY` | 사용자가 검토·진단·수정안만 요청 | 파일을 바꾸지 않는다. 발견·근거·분류와 정확한 수정안(§8 정정안 포함) 또는 유지 판단을 보고하면 끝난다 |
| `APPLY` | 사용자가 수정·적용·진행을 명시 | 실제로 지침·도구를 바꾸면 그 Tier의 회귀 검증(§6)·기록(§7)·필요한 전환(§8)·커밋·push까지 한다. 검토 결과 바꿀 것이 없으면 유지 판단과 근거를 기록하고 끝난다 |

모드의 근거가 된 사용자 문장을 기록한다. 진단 요청을 암묵적 수정 승인으로 읽지 않고, APPLY 중에도 분석 범위 밖의 제품·코드 변경으로 넓히지 않는다.

## 1. 증거를 모은다

- 관련 plan/verify의 모든 라운드, `[구현자 기입]`과 diff·테스트, 여러 턴의 사용자 결정, 현재와 변경 전 plan·impl·verify SKILL·template, root·`docs/handoff/AGENTS.md`, 관련 하위 `AGENTS.md`, references/scripts를 읽는다. 최신 턴이나 변경 후 파일만 보고 이전 계약을 재구성하지 않는다.
- **지침 리팩터링에서는 변경 전 파일도 1급 증거다.** `git diff <before>..<after>`로 삭제·이동·대체된 문장을 먼저 뽑는다(§6-A 도구).
- V/lifecycle 변경이면 corpus만이 아니라 실제 라운드 이력을 replay한다. anchor에는 최소한 계획·oracle 실패, producer/consumer 누락, 반복 재구현, blocking 범위 분리가 각각 드러나는 handoff를 넣고, 선택 이유와 commit/range를 적는다.
- 지침이 실제로 수행됐는지는 아래 지표가 말한다.

| 지표 | 읽는 곳 | 신호 |
|---|---|---|
| 확장 창 · 발견 분류 수(이행·현재·확장·경계·비귀속) | verify.md 메타 · §13 | 분류 왜곡 — §2 끝의 대조로 확인한다 |
| 독립 축(⑥)의 축 이름·발견 | verify 메타 · Review Signals | 하한을 건너뜀(B), 또는 하한이 plan의 사각을 찌르지 못함(A) |
| 열거 sweep(⑦) 항목·`못 잡음`·`S/N`·전수 잔여 | plan `[구현자 기입]` 잠금 표 · verify 메타·§4 | 구현 sweep에서 빠진 항목이 verify 1회째 이행 결함으로 나옴 · 전수 잔여가 회차를 넘어 줄지 않음 |
| 후보 표 행 | INDEX `## 새 handoff 후보` | 같은 축이 handoff를 넘어 쌓이면 plan 설계 지침(검사기 설계·선언 경계)의 gap 후보 |
| verify의 `리뷰 필요 여부`·검토할 질문 | 발동 verify의 Review Signals | review의 출발 질문이다. 질문마다 A~F와 근거로 답하고, 질문 없이 열린 review는 발동 근거를 따로 적는다 |
| F(N) 증가 | `python3 .agents/skills/handoff-review/scripts/review_metrics.py` 원장 전이 | 신규 · 계속 열림 · 재개(verify가 종결을 확인한 뒤 다시 열림)를 나누고, 신규는 `직전 기록`(검사 완료 · 명시 이월 · 확인 불가)과 대조한다. `검사 완료`였던 범위의 늦은 발견이 그 단계 지침의 적용 실패 후보다 |
| F(N) 감소 | 같은 표 · verify 메타 | 실제 종결(verify 확인)과 분류 이동(비차단·창 밖)을 가르고, 그 회차의 검사 범위 · ⑦ 전수 잔여 · 독립 축 수행을 대조한다 — 덜 봐서 준 것은 개선이 아니다 |
| F(N) 등락 반복 | 같은 표 · 원문 | 닫힌 결함의 재개 · 다른 ID로 나타난 같은 계약 위반(원문 대조) · 서로 다른 이월 범위를 차례로 검사한 경우를 구별한다 |

증감 자체는 review 발동이나 원인 귀속의 근거가 아니다 — 위 대조로 후보를 찾고 원문으로 확인한다. 구간 FAIL 비율(판정 불명 제외)·지침 bytes는 handoff 규모를 통제하지 않아 맥락으로만 적는다.

## 2. 원인을 A~F로 가른다

| 분류 | 판정 | 기본 조치 |
|---|---|---|
| A. Instruction gap | 필요한 행동이 현재 지침에 없거나 모호함. 지침이 있어도 정상 수행만으로 실패를 막을 수 없으면 포함 | 기존 지침의 coverage 정밀화 또는 SKILL/template/AGENTS 수정 후보 |
| B. Execution/capability failure | 충분히 명확한 지침과 gate를 정상 수행했다면 막았어야 하나 수행하지 않음 | 같은 규칙 중복 추가 금지. evidence·gate 강화 가능성만 검토 |
| C. Communication/spec mismatch | 두 해석이 합리적이고 사용자 의도가 충분히 특정되지 않음 | 사용자 질의 발동 조건 보완 |
| D. User decision change | 사용자가 후속 턴에서 의도적으로 결정을 바꿈 | 실패로 학습하지 않음. supersede만 보존 |
| E. Evidence/environment limitation | 필요한 1차 증거·실행 환경이 실제로 없음 | 검증 경계·대리 검증·사람 책임 명확화 |
| F. Implementation defect | 설계 지침은 충분하고 구현만 잘못됨 | plan skill 변경 금지. verify가 잡는지 확인 |

- 사용자가 이미 구체적으로 결정했는데 몇 턴 뒤 에이전트가 다른 안을 채택했다면 B다. 처음부터 여러 제품적 선택지가 가능했는데 확인 없이 택했다면 C다. 사용자가 명시적으로 바꿨다면 D다.
- 조건절·이유절이 대안을 지정했는데 배경으로 읽은 경우는 현재 지침이 있는지와, **그 지침을 정상 수행했을 때 실제로 실패를 막는지**로 A/B를 가른다.

A~F는 지침 실패의 원인이고 lifecycle 결과를 대체하지 않는다. 기존 계약이 충분했던 B/F는 대개 이행·현재 결함(`BLOCKING`)이나 이번 변경 산출물의 필수 gate `FAIL`이고, 필요한 계약이 없었던 A/C는 `PLAN_GAP` 후보(창 밖 확장이면 후보 표), D는 supersede, E는 증거 한계·사람 경계 후보다 — 대응은 출발점이고 최종 판정은 실제 계약 증거로 한다. `BLOCKED_BY`는 root pair 실패의 인과 종속에만 쓴다.

verify가 붙인 발견 분류도 다시 대조한다. 어긴 원문을 인용할 수 있으면 이행, 아니고 실제 입력으로 재현되면 현재, 둘 다 아니거나 덮는다고 보려면 해석이 필요하면 확장이다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`). 이행·현재 결함을 확장으로 내리면 거짓 PASS, 확장을 이행으로 올리면 FAIL inflation이다 — 새 규약이 결함을 모두 `PLAN_GAP`·확장으로 낮추거나 인접 발견을 모두 `FAIL`로 올리면 분류가 아니라 판정 왜곡이다.

## 3. 그 실패를 막았어야 할 지침을 찾는다

A·B·C·E 이슈마다 순서대로 묻는다.

1. 이 실패를 막으려던 현재 지침이 있는가.
2. 있다면 어느 heading·문장인가.
3. 그 지침을 정상 수행했어도 실패할 수 있는가.
4. 그렇다면 A(coverage gap)다 — 발동 조건·증거 요구·순서·책임 경계 중 무엇이 부족한가.
5. 지침이 충분했는데 수행만 빠졌다면 B다 — 같은 문장을 반복하지 않는다.
6. 지침이 없으면 가장 일반적인 형태로 어디에 넣을지 정한다.

B에는 문장을 더하지 않는다. 체크 대신 evidence를 남기게 할지, 실행 순서를 바꿀지, template 필수 필드나 스크립트로 강제할지, 흩어진 규칙을 통합할지만 본다. **같은 지침의 B가 두 번째면(라운드·handoff 무관) 스크립트·필수 필드·실행 순서 중 하나로 옮긴다** — 같은 모델이 쓰고 다시 세면 사각이 같아 문장 강화로는 반복을 못 막는다(round 49: 운반 줄 분류 → `site_census.mjs`). 두 번째라고 쓰려면 이전 사례 · 그때 적용되던 지침 문장(그 시점 커밋) · 수행해야 했던 행동 · 이번 증거를 잇고, 같은 계약 위반인지는 원문을 대조해 정한다. 이을 수 없으면 무엇을 확인할 수 없는지 적고 귀속을 보류한다. 그것도 안 되면 capability limitation으로 기록한다.

V 프로토콜이나 판정 규약을 건드리면 다음을 함께 감사한다.

- trigger·owner·상태가 plan/impl/verify 사이에서 하나의 lifecycle을 만드는가.
- Baseline V와 Delta V가 구분되고 Delta V가 명시된 기준 V의 증분만 기록하는가.
- node provenance와 pair requiredness가 상위 문서 복사를 강제하지 않으면서 변경 영향 회귀를 고르는가.
- pair path·전수 분모·직접 oracle·선택 적대 증거가 기존 강제 지점·mutation 방어를 약화하지 않는가.
- 현재 변경 산출물의 운영 gate가 유지되면서, V 밖 포괄 규칙으로 제품 blocking 범위를 늘리지 않는가.
- `FAIL`·`RETURN_TO_PLAN`·`BLOCKED_BY`·nonblocking 분리가 거짓 PASS와 실패 부풀리기를 함께 막는가.
- 발견 분류와 확장 창: 이행·현재 결함은 창과 무관하게 막는가 · 확장 후보가 창 밖에서 blocking으로 되살아나지 않는가 · 동결 뒤 열거 항목에 출처가 붙는가 · 사용자 요구 변경 ΔV의 재개가 그 노드로 한정되는가 · 후보 표 승격이 실제 발생·사용자 요청으로 한정되는가.
- 하한 ①~⑦의 owner(구현자·검증자)와 실행 범위(전수·diff 범위·제외 행)가 AGENTS 표 · verify §4 · impl §3 · template에서 같은가.
- 규약 도입 전의 진행 중 plan/verify를 형식 migration 없이 읽을 수 있는가.

## 4. 지침을 고친다

### 무엇을 바꾸나 — 추가보다 교체·통합

1. 기존 지침을 더 정확한 일반 규칙으로 교체한다.
2. 같은 causal class를 다루는 규칙을 통합한다.
3. 발동 조건·판정 증거를 강화한다.
4. 정말 새로운 causal class일 때만 새 규칙을 더한다.

사례 ID 자체를 실행 규칙으로 만들지 않는다. 사용자 변심을 모델 실패 패턴으로 쌓지 않는다.

**라운드는 핵심 지침 5개(`review_metrics.py`가 재는 plan·impl·verify·review SKILL과 `docs/handoff/AGENTS.md`)의 바이트 합을 늘리지 않는다.** 늘어나는 변경은 같은 라운드에서 통합·사례 서사 이동으로 상쇄하고, 상쇄하지 못한 증가분은 이유와 함께 §7 기록에 적는다 — 길어진 지침은 이미 있는 규칙의 적용 실패(B)를 늘린다(round 49: 0329 D19는 기존 규칙이 덮는 자리였다).

### 어떻게 쓰나 — 지침을 읽는 것은 모델이다

| 원칙 | 이유 |
|---|---|
| 규칙 하나에 문장 하나, 그리고 왜 | 이유를 아는 모델은 규칙이 예상하지 못한 경우에도 의도대로 판단한다. 이유 없는 금지는 글자 그대로만 지켜진다 |
| 조건이 셋 이상 갈리면 판정 표 | 산문 속 분기는 읽는 순서에 따라 빠진다 |
| 사례 서사는 corpus에, 지침에는 사례 ID와 한 구절만 | 서사는 규칙보다 길어 규칙을 가리고, 모델이 사례의 표면(파일명·수치)에 맞춰 일반화한다 |
| 굵게는 놓치면 깨지는 규칙에만 | 모든 문장이 굵으면 어느 것도 굵지 않다 |
| 기억보다 절차 — 전수 열거·스크립트·차집합 | 같은 모델이 쓰고 읽으면 사각도 같다. 사각은 훈계를 더해서가 아니라 기계적 절차로 줄어든다 |
| 완료 조건에만 있는 요구를 만들지 않는다 | 체크리스트 항목은 본문 규칙에 매핑돼야 수행된다 |

문장은 [`docs/handoff/AGENTS.md §산출물 문장 규칙`](../../../docs/handoff/AGENTS.md)을 따른다 — 지침이 스스로 어기는 규칙은 지켜지지 않는다. 새 규칙은 한 문장 규칙 + 한 줄 사례이고, 교훈조 서사로 규칙을 대신하지 않는다.

## 5. 책임 경계

| skill | 남기는 책임 |
|---|---|
| `handoff-plan` | 현재 요구 비판 · Decision Ledger · Product/UX Contract · 코드 조사와 Technical Design(AS-IS/TO-BE) · 검증 가능한 AC · 선언 경계 · 확장 후보의 채택/경계 결정 · READY 정합성 검사 |
| `handoff-impl` | plan을 계약으로 수행 · 강제 지점 전수 적용 · 구현 중에만 보이는 결함과 Product/UX 파생 문제 진단 · 지적을 불변식으로 올려 전수 적용 · 열거 원문 sweep 자기점검 · 발견 분류와 처리 권한(plan 되먹임) |
| `handoff-verify` | 현재 구현 비판 · 역방향 탐색 · Product/UX ↔ end-to-end · 구현자가 AC를 바꿔 자기 증명했는지 확인 · 하한(독립 축·열거 sweep)과 발견 분류·확장 창 판정 · 기계 검증/사람 실기 경계 |
| `handoff-review` | 실패 원인 분류 · 반복 실수 일반화 · SKILL/template/AGENTS/script 수정 · failure corpus 유지 · 지침 변경 회귀 검증 · 바뀐 판정 의미의 전환 |

plan/impl/verify는 매 작업마다 failure corpus를 갱신하거나 자기 SKILL을 고치지 않는다. impl과 verify가 같은 축(강제 지점 전수·열거 sweep·부분 실패·production 경로)을 보는 것은 중복이 아니다 — **구현자가 닫고 검증자가 다시 센다.** 한쪽이 다른 쪽을 면제하면 그 축은 아무도 보지 않게 된다.

## 6. 회귀 검증 — 변경 의미에 비례한다

| Tier | 해당하는 변경 | 수행 |
|---|---|---|
| 1 Full | 하나라도: trigger·owner·responsibility · command·gate·failure semantics · 발견 분류·확장 창·하한 · required template field·lifecycle·Decision/AC policy · corpus·reference의 canonical ownership이나 소비자가 따를 의미 · 그 밖에 plan/impl/verify/review의 normative behavior | 6-A + 6-B + 6-C |
| 2 Referential | 모두: 실행 의미·owner·gate·normative policy 불변 · historical failure defense를 약화하지 않는 이유를 한 문장으로 댈 수 있음 · 가리키는 대상·링크의 의미만 바로잡음(typo·상대경로·링크 target) | 영향 받은 6-A + 6-C. 6-B를 생략한 이유를 기록 |

**애매하면 Tier 1이다.** Tier 2를 검증 회피구로 쓰지 않는다. 세 축은 서로를 대신하지 않는다 — 6-B가 만점이어도 6-A나 6-C가 실패하면 review는 끝나지 않았다.

### 6-A. Operational Instruction Delta — 기존 운영지식의 삭제를 잡는다

변경 전 SKILL/template/AGENTS/reference/script와 변경 후 구조를 diff해 **기존의 실행 가능한 책임**을 전수 추출한다. 문구가 아니라 축을 본다: trigger(언제) · owner(누가) · command(실제 명령과 환경 제약) · evidence(무엇을 남겨야 통과인가) · 사람 vs 에이전트 책임 · lifecycle·INDEX·commit·hygiene 운영 절차 · reference/script 연결과 그 소비자가 기대하는 의미.

후보 줄은 스크립트로 뽑는다. 바꾼 지침 파일을 모두 넘기면 서로의 대조 파일이 되고, `--pool`에는 규칙이 옮겨 갈 수 있는 다른 정본만 넣는다.

```bash
python3 .agents/skills/handoff-review/scripts/instruction_delta.py --base <변경 전> [--head <변경 후>] --prose \
  --pool docs/handoff/AGENTS.md <바꾼 지침 파일들>
```

| 후보 | 뜻 | 판정할 것 |
|---|---|---|
| `잃음` | 백틱 식별자·사례 ID가 어느 변경 후 문서에도 없다 | 대부분 사례 세부·앵커 표기만 빠졌다. 규칙 문장이 사라졌으면 regression |
| `이동?` · `문장 이동?` | 같은 파일에서는 사라졌고 다른 대조 파일에만 있다 | 옮겨 간 곳을 원래 문서가 가리키는가. 규칙 정본이 아닌 곳에만 남았으면 지침에서 사라진 것이다 |
| `문장` | 표식 밖 문장 내용 대부분이 변경 후의 어느 한 줄에도 없다 | 다시 쓴 문장도 걸린다 — 전면 재작성이면 후보 전부를 규칙 단위로 판정한다 |

- corpus는 `--pool`에 넣지 않는다. corpus의 `→ 규칙.` 문장이 지침에서 지운 규칙을 가린다. 사례 서사를 corpus로 옮긴 줄은 그 사례 ID로 corpus를 찾아 MOVE를 확인한다.
- 후보 0은 회귀 0이 아니다 — 조건·범위·주체 단어 하나가 빠진 약화("만들거나 고친" → "만든")는 걸리지 않으니, 작은 수정은 스크립트 머리말의 `git diff --word-diff` 명령으로 지운 단어를 본다.

각 항목을 판정한다.

| 판정 | 의미 | 완료 조건 |
|---|---|---|
| KEEP | 같은 위치에서 유지 | 의미와 발동 조건이 약화되지 않음 |
| MOVE | 다른 정본으로 이동 | 새 위치와 소비 경로, inbound expectation 보존이 명시됨 |
| REPLACE | 더 일반적·강한 규칙으로 대체 | 구 규칙이 막던 실패를 새 규칙도 막음 |
| DELETE | 의도적으로 제거 | 더 이상 필요 없는 근거가 있음 |

**설명 없이 사라진 항목은 regression이다.** `npm test` 같은 명령은 문자열이 남았는지가 아니라 하위 `AGENTS.md`의 ABI·네트워크 제약과 충돌하는지까지 본다.

reference·script를 MOVE/REPLACE하면 존재만 보지 않는다.

1. old path의 inbound reference를 전수 세어 `N`을 남긴다.
2. inbound가 기대하는 distinct semantic target(heading/anchor, named rule·pattern, line-scoped contract, example/schema/script behavior)을 `M`개로 정리한다.
3. 새 target에서 각 semantic target이 유지됨을 **M/M evidence**로 보인다 — heading/anchor는 `rg`, symbol은 `rg`/parser, contract는 문장·타입·테스트처럼 그 의미에 맞는 증거.
4. 링크가 resolve하거나 파일이 있다는 사실만으로 semantic integrity를 PASS하지 않는다.

### 6-B. Historical Failure Regression — 과거 실패가 다시 열리지 않는지 본다

Tier 1에서 6-A를 닫은 **뒤에** [`references/failure-patterns.md`](references/failure-patterns.md)의 안내대로 corpus의 모든 `## P<number>`를 읽는다.

1. 변경 전후 P 집합부터 대조한다 — `instruction_delta.py --base <변경 전> --pset .agents/skills/handoff-review/references/failure-patterns.corpus.md`가 삭제·추가·중복·번호 변경을 낸다. 의도한 폐기·이동은 근거를 기록에 남기고, 번호 상한을 하드코딩하지 않는다.
2. 각 패턴의 causal lesson을 한 문장으로 요약한다.
3. 변경 전·후 지침의 방어 지점을 찾는다.
4. `COVERED / PARTIAL / GAP / OBSOLETE`로 판정한다.
5. `PARTIAL`·`GAP`은 지침을 다시 고치거나, 고치지 않는 근거를 남긴다.
6. 변경 전 COVERED가 변경 후 PARTIAL·GAP이면 회귀 실패다.

`COVERED`는 키워드 일치가 아니다. 실제 실패가 일어나기 **전에** 발동하는 실행 가능한 절차여야 한다.

V/lifecycle·판정 규약을 바꾸면 두 가지를 더 재생한다.

- **historical replay** — 각 패턴과 선택한 실제 handoff anchor를 새 상태 머신으로 다시 판정한다. 열거 원문·기존 pair·이번 변경 산출물의 필수 gate 위반이 `PLAN_GAP`·확장·nonblocking으로 내려가 **거짓 PASS**가 생기지 않는지, 비귀속·창 밖 확장이 blocking으로 올라가 **FAIL inflation**이 생기지 않는지 본다. anchor는 라운드별 finding이 어디로 가는지(`PAIR_FAIL`·`PLAN_GAP`·`BLOCKED_BY`·`NON_BLOCKING`·`NEXT_HANDOFF`)를 변경 전·후 표로 남긴다.
- **시나리오 replay** — historical anchor는 아직 일어나지 않은 경로를 보여 주지 않는다. 새 규칙이 만드는 전이를 파생 시나리오로 재생한다: 창 경계(verify 2회째 → 3회째) · 창 안 사용자 요구 변경 ΔV · 창 밖 외부 피드백 · 구현자가 창 밖에서 찾은 확장 후보 · 9회째 CLOSED · 후보 표 승격 · 발동 handoff의 판정 정정(§8). 다음 주체가 없는 상태, 같은 축의 무한 반복, 거짓 PASS가 0인지 적는다.

### 6-C. Cross-document Consistency — 정본끼리 다른 명령을 하지 않는지 본다

최소 다음을 서로 대조한다.

```text
root AGENTS.md
  ↕
docs/handoff/AGENTS.md
  ↕
handoff-plan / handoff-impl / handoff-verify / handoff-review SKILL.md (frontmatter description 포함)
  ↕
plan.template.md / verify.template.md
  ↕
references / scripts
  ↕
실제 수정 subtree의 AGENTS.md / 관련 CI·자동화 정본
```

확인한다.

- 같은 행위를 서로 다른 owner에게 맡기지 않는가. 한 문서는 금지하고 다른 문서는 요구하지 않는가.
- 다음 어휘의 의미와 전이가 모든 문서에서 같은가: `Baseline V/Delta V/유효 V` · `NEW/CHANGED/INHERITED/SUPERSEDED` · `REQUIRED/REGRESSION/NOT_REQUIRED` · `PASS/PAIR_FAIL/BLOCKED_BY` · `BLOCKING/PLAN_GAP/NON_BLOCKING/NEXT_HANDOFF` · `FAIL/RETURN_TO_PLAN/CLOSED` · 이행 결함/현재 결함/확장 후보/경계/비귀속 · 확장 창(verify 1·2회째)·plan 동결·재개 · 하한 ①~⑦과 그 owner·범위 · 후보 표(`## 새 handoff 후보`)와 승격 계기 · 9회 상한과 review 3·6회째.
- template 명령이 더 구체적인 하위 `AGENTS.md`의 안전 규칙과 충돌하지 않는가.
- root 진입점이 새 skill·소유권을 알고 있는가. 각 SKILL의 frontmatter `description`이 본문의 발동 조건·책임과 맞는가 — description이 모델의 로드 여부를 정한다.
- 이동한 reference·script의 **inbound reference N건이 새 target에서 semantic target M/M을 유지하는가.**
- `Handoff: none` 카브아웃이 검증 면제를 뜻하지 않는가.
- `AGENTS.md`를 바꿨으면 root `AGENTS.md`의 위생 규칙(비밀·일회성·변동성 정보 금지), 부모↔자식 규칙 충돌, 새 `AGENTS.md`의 `CLAUDE.md` stub과 root 표 갱신을 확인한다.

`app/**`를 에이전트 작업 루프에서 검증할 때 빌드·테스트 명령의 정본은 `app/AGENTS.md`이고, PR/CI 통합 게이트의 정본은 `.github/workflows/ci.yml`이다 — 두 scope를 혼동하지 않는다. generic template이 더 구체적인 subtree 안전 규칙을 덮어쓰면 regression이다.

## 7. 기록한다

- `references/failure-patterns.md`는 현재 정책을 설명하는 **진입점**이고, 사례 본문은 그것이 가리키는 corpus에 둔다. plan/impl/verify는 이를 직접 갱신하지 않는다.
- corpus에는 기존 P에 없는 새 causal class이거나 새 지침의 대표 evidence일 때만 더한다. 같은 causal class의 재발은 장문 사례로 쌓지 않는다. 지침 리팩터링 중 생긴 운영지식 삭제는 design-failure P를 억지로 늘리지 말고 6-A 기록으로 남길 수 있다.
- 규칙이 바뀌어 기존 P의 규칙·현재 방어가 달라지면 그 P 끝에 개정 메모를 단다 — `> round K(날짜, 출처)이 위 규칙의 …을 대체했다 — … 정본: …`. 본문은 당시의 증거라 고치지 않는다.
- 라운드 기록은 `regression-coverage.md` 끝에 `# review round K — <대상>(<발동>): <요약>` 절로 더한다: 발동/모드 · 분류 표(`# · 발견 · 사례 · 조치`, `발견 → 사례 → 조치`는 표나 3문장 이내) · Tier · 6-A(기준 commit · 도구 후보 수 · 판정 표) · 6-B(P 전수 수 · 판정 분포 · 바뀐 P · replay 표) · 6-C · 효과 지표 · 남은 한계.
- 효과 지표: 앞 라운드 변경마다 그 뒤 handoff에 적용 기회가 있었는지 먼저 보고 `적용 기회 없음 / 앞 단계에서 검출 / 같은 단계에서 재발 / 증거 부족`으로 적는다 — 기회가 없었던 변경의 효과는 판정하지 않는다. 함께 독립 축 수행 · ⑦ 잔여 추이 · 핵심 지침 bytes 전후 · 이번 이슈의 A/B 수를 적는다. 같은 단계에서 재발했으면 같은 축의 다음 변경은 도구·순서·필드로 간다. 기록 문장도 §산출물 문장 규칙을 따른다.
- 압축 대상은 서술이다. tier 판정 · 세 축 결과 · inbound `N`/semantic `M/M` evidence · P 전수 판정은 줄이지 않는다.
- 별도 `roundN-review.md`는 기본 산출물이 아니다. 사용자가 감사·원문 보존을 요구했거나, 압축으로 잃는 rationale이 있다고 판단해 **보존 사유와 그 실제 출처를 문서 첫머리에 적을 때만** 만들며 실행 정본이 아니다 — 요구가 없었는데 "사용자 요청"으로 적으면 자기 정당화 기록이다. **동시에 1개만 유지한다** — 새로 만들면 이전 것을 교체하고, 지침으로 승격된 내용은 SKILL·`regression-coverage.md`에만 남긴다. 라운드마다 파일이 늘면 corpus에서 몰아낸 사례 누적을 이 디렉토리에서 재현하게 된다.

## 8. 전환 — 바뀐 판정 의미를 발동 handoff에 적용한다

review가 판정 의미(발견 분류·disposition·확장 창·하한이 막는 범위)를 바꾸면, review를 발동시킨 handoff — 그 마지막 verify가 이 review의 입력이다 — 의 판정이나 다음 주체가 새 규칙에서 달라지는지 보고 달라지면 정정한다(round 41: 0294 r3). 사용자가 요청하면 다른 진행 중 handoff도 같은 방식으로 정정한다. 정정은 검증자 산출물이고 `handoff-verify §11`의 분류·판정 표로 가른다.

- 정정은 새 verify가 아니다. verify 횟수(확장 창·9회 상한)와 INDEX 라운드 칸을 바꾸지 않고, 마지막 `verify.md` 끝에 `# rN 판정 정정 — review round K (날짜)` 절을 더한다. 원문은 그대로 둔다.
- 이미 있는 발견만 새 규칙으로 다시 가른다. 절에는 발동 당시 알았던 사실 · 기존 증거를 재분류한 결과 · 리뷰 중 새로 실행해 얻은 증거를 나눠 적고, 사후에 안 사실을 발동 근거로 소급하지 않는다. 같은 회차 정정은 재분류와 그것을 확인하는 실행까지다 — 새 결함 탐색이나 하한 sweep이 필요하면 새 verify가 맡는다. 그래서 **정정으로 PASS를 주지 않는다** — 막는 발견이 0이 되면 `PASS 후보`로 적고 INDEX를 `impl/IMPL_DONE`·다음 주체 검증자로 두어, 다음 verify가 현재 하한으로 확인한다.
- 절에는 정정 판정을 첫 문장에 쓰고, 묶음별 `원 판정 → 새 분류 → 근거(원문 인용·재현) → disposition` 표, 다음 구현의 의무, 후보 표 등록을 적는다.
- plan `[검증자 기입]` 파생 이슈의 상태·disposition, `### 발견 원장 — verify N 정정(round K)`, INDEX 행(상태·다음 주체·비고)을 정정에 맞추고, 창 밖 확장 후보는 `## 새 handoff 후보` 표에 올린다.
- 커밋은 review 커밋과 나눈다 — 검증 커밋 형식(`Handoff: docs/handoff/<slug>/` · `Status: verified` · `Verified-By` · `Next-Action`)이다. 섞이면 지침 변경과 판정 변경을 따로 되돌릴 수 없다.
- 다른 주체가 진행 중인 턴(INDEX `impl/IN_PROGRESS` 등)은 건드리지 않는다 — 그 턴 뒤의 verify가 새 규칙으로 판정한다(round 40). 그 밖의 진행 중 handoff는 일괄 정정하지 않고 다음 verify부터 새 규칙을 쓴다(`docs/handoff/AGENTS.md §신규 템플릿 적용 경계`). `verify/CLOSED`는 종료 상태라 정정하지 않는다.
- DIAGNOSE_ONLY면 정정안만 보고한다.

## 9. Decision drift

`사용자 결정 시점 → 당시 plan/Decision Ledger → 후속 턴 → 최종 Product/UX Contract → Technical Design/AC` 순으로 추적한다.

| 관측 | 분류 | 볼 것 |
|---|---|---|
| 사용자가 바꾸지 않았는데 사라짐 | B — Ledger 지침이 없었거나 정상 수행해도 못 막았으면 A | Ledger 보존 절차 |
| 사용자가 명시적으로 바꿈 | D | 기존 결정을 `SUPERSEDED` 처리했는지만 |
| 해석이 갈렸는데 질문 없이 진행 | C | 질문 발동 조건 |

과거 대화 전체를 plan에 복사하지 않고 결정 단위와 provenance만 보존한다.

## 마무리 — 커밋

- review 커밋: `docs(handoff-review): round K — <요약>` · trailer `Agent: claude` · `Handoff: none` · `Status: designed`. 커밋 뒤 `git log -1 --format='%(trailers:only=true)'`로 파싱을 확인한다(root `AGENTS.md` 커밋 프로토콜).
- 판정 정정은 §8의 별도 검증 커밋이다.

## 완료 조건

공통(두 모드):
- [ ] 모드와 근거 문장을 기록했고 권한 범위를 지켰다(§0).
- [ ] verify의 검토할 질문마다 답했고, 추세는 §1 대조로 설명했다 — 증감만으로 귀속하지 않았다.
- [ ] 이슈마다 A~F와 근거가 있고 A와 B를 갈랐다. "두 번째 B"는 이전 사례·당시 문장·해야 했던 행동·이번 증거를 이었거나 보류했다. 사용자 결정 변경을 실패 패턴으로 쓰지 않았다(§2·§3·§9).
- [ ] verify 발견 분류를 다시 대조해 거짓 PASS·FAIL inflation 방향의 왜곡을 적었다(§2).
- [ ] 사례 누적이 아니라 지침의 변경·유지를 판단했고 교체·통합을 먼저 검토했다. plan/impl/verify의 비판 책임을 가져오지 않았고 그들이 corpus를 읽거나 고치게 하지 않았다(§4·§5).

`APPLY`에서 지침·도구를 실제로 바꿨을 때:
- [ ] 새 문장이 §4 원칙과 §산출물 문장 규칙을 지키고, 핵심 지침 bytes가 늘었으면 상쇄했거나 이유를 적었다.
- [ ] Tier를 골랐다(애매하면 Tier 1 · Tier 2면 6-B 생략 근거). 6-A 후보 전부 판정(작은 수정은 지운 단어까지) · 설명 없이 사라진 gate·command·reference·INDEX·trailer 운영 규칙 0 · reference 이동은 `N`/`M/M`. Tier 1이면 6-B P 집합 대조와 전수 판정, 판정 규약 변경이면 replay에서 거짓 PASS·inflation·다음 주체 없는 상태 0. 6-C 충돌 0(§6).
- [ ] 판정 의미가 바뀌었으면 §8 정정을 별도 커밋으로 했거나 대상 없음을 적었다.
- [ ] `regression-coverage.md`에 라운드 기록과 효과 지표(적용 기회 분류)를 남겼다(§7).

## 종료 보고

모든 모드: 실행 모드와 근거 · verify 질문별 답 · 추세 설명 · causal class와 변경 또는 유지 판단의 근거 · skill 변경으로 해결할 수 없는 한계.

`APPLY`에서 바꿨으면 더한다: Tier와 근거 · 6-A 후보 수와 판정 · 6-B(P 집합 대조·판정 분포·replay) 또는 Tier 2 생략 근거 · 6-C · 전환 결과 · 효과 지표(적용 기회 분류 · 핵심 지침 bytes 전후).
