---
name: handoff-review
description: handoff-plan·handoff-impl·handoff-verify의 지침 **자체**를 리뷰하고 개선할 때 쓴다. 특정 작업의 설계나 구현을 검사하는 스킬이 아니다. 반복 라운드(impl 라운드 3 초과), 여러 턴의 결정 drift, 동일 실수 재발, 사용자의 명시적 handoff 프로세스 리뷰 요청, 또는 handoff SKILL/template/AGENTS를 바꾸거나 새 handoff 스킬을 만드는 메타 수정이면 로드한다. 실패 원인을 A~F로 분류하고 기존 운영지침 승계·historical failure regression·cross-document consistency를 검증한다.
---

# handoff-review — handoff 시스템의 지침을 개선하는 메타 리뷰

## 목적

이 스킬은 특정 plan·구현·verify를 한 번 더 검사하는 네 번째 체크리스트가 아니다. handoff 과정에서 반복된 실패·결정 drift·소통 실패의 원인을 찾아 `handoff-plan` / `handoff-impl` / `handoff-verify`의 **지침 자체**를 개선한다.

정본 관계:

- `handoff-plan/SKILL.md` — 현재 설계 에이전트가 따라야 할 규칙.
- `handoff-impl/SKILL.md` — 현재 구현 에이전트가 따라야 할 규칙.
- `handoff-verify/SKILL.md` — 현재 검증 에이전트가 따라야 할 규칙.
- `docs/handoff/AGENTS.md` — 협업·상태 머신·게이트 정본과 skill 미가용 환경의 구현 턴 최소 계약.
- [`references/failure-patterns.md`](references/failure-patterns.md) — historical regression corpus의 **진입점**. 실행 지침의 정본이 아니다.
- 이 스킬 — 실패 증거를 일반화해 지침을 수정하고, 지침 변경 자체가 기존 운영 계약과 과거 실패 방어선을 깨지 않았는지 검증한다.

**사례를 한 줄 더 쌓는 것으로 리뷰를 끝내지 않는다.** 주 산출물은 SKILL/template/AGENTS/공통 지침의 실제 개선이다.

## 실행 조건

- 사용자가 handoff 스킬/지침 개선을 명시적으로 요청한다.
- handoff `SKILL.md`(plan·impl·verify·review 넷 중 하나), template, `docs/handoff/AGENTS.md`, root `AGENTS.md`의 handoff 규칙을 바꾸는 메타 수정이다. **skill을 새로 만들거나 정본을 다른 문서로 옮기는 것도 여기 해당한다.**
- 하나의 handoff에서 같거나 유사한 실패가 반복된다.
- 여러 handoff에서 동일 설계/검증 실수가 재발한다.
- 긴 대화의 확정 결정이 plan에서 소실·변형되는 decision drift가 관찰된다.
- verify가 같은 한계를 반복해서 사람 실기/환경 제약으로 넘긴다.
- impl 라운드가 3을 초과한다.

정상 단일 PASS마다 자동 실행하지 않는다.

## 1. 증거 수집

관련 plan/verify의 모든 라운드, `[구현자 기입]`과 diff·테스트, 여러 턴의 사용자 결정, 현재/변경 전 plan·impl·verify SKILL과 template, root 및 `docs/handoff/AGENTS.md`, 관련 하위 `AGENTS.md`, references/scripts를 읽는다. 최신 턴이나 변경 후 파일만 보고 이전 계약을 재구성하지 않는다.

**지침 리팩터링에서는 변경 전 파일도 1급 증거다.** `git diff <before>..<after>`로 삭제·이동·대체된 문장을 먼저 추출한다.

## 2. 실패 분류

| 분류 | 판정 | 기본 조치 |
|---|---|---|
| A. Instruction gap | 필요한 행동이 현재 SKILL에 없거나 모호함. 지침이 있어도 정상 수행만으로 실패를 막을 수 없으면 포함 | 기존 지침의 coverage 정밀화 또는 SKILL/template/AGENTS 수정 후보 |
| B. Execution/capability failure | 충분히 명확한 지침과 gate를 정상 수행했다면 실패를 막았어야 하나 수행하지 않음 | 같은 규칙 중복 추가 금지. evidence/gate 강화 가능성만 검토 |
| C. Communication/spec mismatch | 두 해석이 합리적이고 사용자 의도가 충분히 특정되지 않음 | 사용자 질의 발동 조건 보완 |
| D. User decision change | 사용자가 후속 턴에서 의도적으로 결정 변경 | 실패로 학습하지 않음. supersede만 보존 |
| E. Evidence/environment limitation | 필요한 1차 증거·실행 환경이 실제로 없음 | 검증 경계/대리 검증/사람 책임 명확화 |
| F. Implementation defect | 설계 지침은 충분하고 구현만 잘못됨 | plan skill 변경 금지. verify가 잡는지 확인 |

사용자가 이미 구체적으로 결정했는데 몇 턴 뒤 에이전트가 다른 안을 채택했다면 B다. 처음부터 여러 제품적 선택지가 가능했는데 확인 없이 택했다면 C다. 사용자가 명시적으로 바꿨다면 D다. 조건절·이유절이 대안을 지정했는데 배경으로 읽은 경우는 현재 지침 존재 여부와 **그 지침을 정상 수행했을 때 실제로 실패를 차단하는지**에 따라 A/B로 판정한다.

## 3. 현재 지침의 결함을 찾는다

각 A/B/C/E 이슈마다:

1. 이 실패를 막으려던 현재 지침이 이미 있는가.
2. 있다면 어느 heading/문장인가.
3. 그 지침을 정상 수행했어도 실패 가능한가.
4. 가능하다면 **A(coverage gap)** 로 보고 발동 조건·증거 요구·순서·책임 경계 중 무엇이 부족한가.
5. 지침이 충분했는데 실제 수행만 누락됐다면 **B** 로 보고 같은 문장을 반복하지 않는다.
6. 지침이 없으면 가장 일반적인 형태로 어디에 추가해야 하는가.

B 유형은 같은 문장을 더 추가하지 않는다. 체크가 아니라 evidence를 남기게 할 수 있는지, 실행 순서를 바꿀지, template 필수 필드로 강제할지, 흩어진 규칙을 통합할지만 본다. 그것도 불가능하면 capability limitation으로 기록한다.

## 4. 지침 패치 원칙

추가보다 **교체·통합**을 우선한다.

1. 기존 지침을 더 정확한 일반 규칙으로 교체.
2. 같은 causal class를 다루는 규칙 통합.
3. 발동 조건·판정 증거 강화.
4. 정말 새로운 causal class일 때만 새 규칙 추가.

사례 ID 자체를 실행 규칙으로 만들지 않는다. 사용자 변심을 모델 실패 패턴으로 축적하지 않는다.

## 5. 책임 경계

`handoff-plan`에는 현재 요구 비판, Decision Ledger, Product/UX Contract, 코드 조사·Technical Design(AS-IS/TO-BE), 검증 가능한 AC, READY 정합성 검사를 남긴다.

`handoff-impl`에는 plan을 계약으로 수행하기, 강제 지점 전수 적용, 구현 중에만 보이는 결함과 Product/UX 파생 문제 진단, 지적을 불변식으로 올려 전수 적용하기, plan 되먹임 3분기 판정을 남긴다.

`handoff-verify`에는 현재 구현 비판, 역방향 탐색, Product/UX ↔ end-to-end 검증, 구현자가 AC를 바꿔 자기 증명했는지 확인, 기계 검증/사람 실기 경계를 남긴다.

`handoff-review`가 실패 원인 분류, 반복 실수 일반화, SKILL/template/AGENTS 자체 수정, failure corpus 유지 정책과 **지침 변경 회귀 검증**을 맡는다. plan/impl/verify가 매 작업마다 failure corpus를 갱신하거나 자기 SKILL을 수정하지 않는다.

impl과 verify가 같은 축(강제 지점 전수·부분 실패·production 경로)을 본다는 사실은 중복이 아니다 — **구현자가 닫고 검증자가 다시 센다.** 한쪽이 다른 쪽을 면제하면 그 축은 아무도 보지 않게 된다.

# 6. 지침 변경 회귀 검증 — 변경 의미에 비례한다

지침/참조를 바꿀 때 먼저 변경을 Tier 1 또는 Tier 2로 분류한다. **애매하면 Tier 1**이다. Tier 2를 검증 회피구로 사용하지 않는다.

### Tier 1 — Full regression

다음 중 하나라도 바뀌면 **6-A + 6-B + 6-C를 모두 수행**한다.

- trigger / owner / responsibility
- command / gate / failure semantics
- required template field / lifecycle / Decision·AC policy
- corpus·reference의 canonical ownership 또는 소비자가 따라야 할 의미
- 그 밖에 plan/impl/verify/review의 normative behavior를 바꾸는 변경

### Tier 2 — Referential / mechanical correction

다음을 **모두** 만족하는 typo·오탈자·상대경로·링크 target 같은 수정만 해당한다.

- 실행 의미, owner, gate, normative policy가 변하지 않는다.
- historical failure defense를 약화하지 않는 이유를 한 문장으로 설명할 수 있다.
- 변경이 가리키는 대상/링크의 의미만 바로잡는다.

Tier 2는 **영향 받은 6-A Operational Delta + 6-C Cross-document Consistency를 수행**한다. 6-B 전수 대조는 생략할 수 있지만, 생략 이유를 regression 기록에 남긴다.

## 6-A. Operational Instruction Delta — 기존 운영지식의 삭제를 잡는다

변경 전 SKILL/template/AGENTS/reference/script와 변경 후 구조를 diff하여 **기존의 실행 가능한 책임**을 전수 추출한다. 단순 문구가 아니라 다음 축을 본다.

- trigger / 언제 실행되는가
- owner / 누가 수행하는가
- command / 실제 실행 명령과 환경 제약
- evidence / 무엇을 남겨야 통과인가
- human vs agent responsibility
- lifecycle / INDEX / commit / hygiene 같은 운영 절차
- reference/script 연결, **그 소비자와 소비자가 기대하는 의미**

각 항목을 다음 중 하나로 판정한다.

| 판정 | 의미 | 완료 조건 |
|---|---|---|
| KEEP | 같은 위치에서 유지 | 의미와 발동 조건이 약화되지 않음 |
| MOVE | 다른 정본으로 이동 | 새 위치와 소비 경로, inbound expectation의 보존이 명시됨 |
| REPLACE | 더 일반적/강한 규칙으로 대체 | 구 규칙이 막던 실패를 새 규칙도 막음 |
| DELETE | 의도적으로 제거 | 왜 더 이상 필요 없는지 근거가 있음 |

**설명 없이 사라진 항목은 regression이다.** 특히 `npm test` 같은 명령은 문자열 존재가 아니라 하위 `AGENTS.md`의 ABI/네트워크 제약과 충돌하는지까지 본다.

reference/script를 MOVE/REPLACE하면 존재성만 보지 않는다.

1. old path의 inbound reference를 전수 세고 `N`을 남긴다.
2. inbound가 기대하는 distinct semantic target(heading/anchor, named rule·pattern, line-scoped contract, example/schema/script behavior)을 `M`개로 정리한다.
3. 새 target에서 각 semantic target이 유지됨을 **M/M evidence**로 보인다. heading/anchor는 `rg`, symbol은 `rg`/parser, contract는 문장·타입·테스트 등 해당 의미에 맞는 증거를 사용한다.
4. 링크가 resolve하거나 파일이 존재한다는 사실만으로 semantic integrity를 PASS하지 않는다.

## 6-B. Historical Failure Regression — 기존 실패사례가 다시 열리지 않는지 본다

Tier 1에서 Operational delta를 닫은 **뒤에** [`references/failure-patterns.md`](references/failure-patterns.md)의 안내에 따라 historical corpus의 모든 `## P<number>`를 전수 읽는다.

1. 모든 P heading을 전수 추출한다. 번호 상한을 하드코딩하지 않는다.
2. 각 패턴의 causal lesson을 한 문장으로 요약한다.
3. 변경 전/후 지침의 방어 지점을 찾는다.
4. `COVERED / PARTIAL / GAP / OBSOLETE`로 판정한다.
5. `PARTIAL/GAP`은 지침을 다시 수정하거나 수정하지 않는 근거를 남긴다.
6. 변경 전 COVERED였는데 변경 후 PARTIAL/GAP이면 회귀 실패다.

`COVERED`는 키워드 일치가 아니다. 실제 실패가 일어나기 **전에** 발동하는 실행 가능한 절차여야 한다.

## 6-C. Cross-document Consistency — 정본끼리 서로 다른 명령을 하지 않는지 본다

최소 다음을 서로 대조한다.

```text
root AGENTS.md
  ↕
docs/handoff/AGENTS.md
  ↕
handoff-plan / handoff-impl / handoff-verify / handoff-review SKILL.md
  ↕
plan.template.md / verify.template.md
  ↕
references / scripts
  ↕
실제 수정 subtree의 AGENTS.md / 관련 CI·자동화 정본
```

반드시 확인한다.

- 같은 행위를 서로 다른 owner에게 맡기지 않는가.
- 한 문서는 금지하고 다른 문서는 요구하지 않는가.
- template 명령이 더 구체적인 하위 `AGENTS.md`의 안전 규칙과 충돌하지 않는가.
- root 진입점이 새 skill/소유권을 알고 있는가.
- 이동한 reference/script의 **inbound reference N건이 새 target에서 기대한 semantic target M/M을 유지하는가.**
- `Handoff: none` 카브아웃이 검증 면제를 뜻하지 않는가.

`app/**`를 에이전트 작업 루프에서 검증할 때 빌드/테스트 명령의 정본은 `app/AGENTS.md`다. PR/CI 통합 게이트의 정본은 `.github/workflows/ci.yml`이며 두 scope를 혼동하지 않는다. generic template이 더 구체적인 subtree 안전 규칙을 덮어쓰면 regression이다.

## 7. failure corpus / review 기록 정책

`references/failure-patterns.md`는 현재 정책을 설명하는 **진입점**이고, historical 사례 본문은 그 문서가 가리키는 corpus에 둔다. plan/impl/verify는 이를 직접 갱신하지 않는다.

새 이슈는 기존 P에 없는 새로운 causal class이거나 새 지침의 대표 evidence일 때만 corpus에 추가한다. 동일 causal class의 재발은 장문 사례를 계속 쌓지 않는다.

**round별 review 보고서는 기본 영구 산출물이 아니다.** 영구 결과는 지침 변경과 `regression-coverage.md`의 현재 baseline/변경 요약에 압축한다. 별도 `roundN-review.md`는 **사용자가 감사·원문 보존을 요구했거나, review가 압축으로 잃는 rationale이 있다고 판단해 보존 사유를 문서 첫머리에 적을 때만** 만든다. 그 문서는 실행 정본이 아니다.

round 문서는 **동시에 1개만 유지한다.** 다음 라운드가 새로 만들면 이전 것을 교체하고, 지침으로 승격된 내용은 SKILL/`regression-coverage.md`에만 남긴다. 라운드마다 파일이 늘어나면 corpus에서 몰아낸 사례 누적을 이 디렉토리에서 재현하는 것이다.

**보존 사유는 실제 출처를 적는다.** 사용자가 요구하지 않았는데 "사용자 요청" 으로 적으면 그 자체가 자기 정당화 기록이다.

사례 추가 여부와 별개로, **지침 자체의 변경/유지 판단이 review의 주 산출물**이어야 한다. 지침 리팩터링 과정에서 발생한 운영지식 삭제는 design-failure P를 억지로 늘리지 말고 Operational Instruction Delta 기록으로 남길 수 있다.

**review가 쓰는 지침 문장과 기록도 [`docs/handoff/AGENTS.md §산출물 문장 규칙`](../../../docs/handoff/AGENTS.md)을 따른다.** 지침이 스스로 어기는 규칙은 지켜지지 않는다.

- 새로 쓰는 규칙은 **한 문장 규칙 + 한 줄 사례**다. 교훈조 서사로 규칙을 대신하지 않는다.
- `regression-coverage.md`의 라운드 기록은 `발견 → 사례 → 조치`를 표나 3문장 이내로 적는다.
- 압축 대상은 서술이다. tier 판정·세 축 결과·inbound `N`/semantic `M/M` evidence·P 전수 판정은 줄이지 않는다.

## 8. Decision drift 리뷰

`사용자 결정 시점 → 당시 plan/Decision Ledger → 후속 turn → 최종 Product/UX Contract → Technical Design/AC` 순으로 추적한다.

- 사용자가 바꾸지 않았는데 사라짐: B, 또는 Ledger 지침이 없었거나 정상 수행해도 막을 수 없었다면 A.
- 사용자 변경 명시: D. 기존 결정을 SUPERSEDED 처리했는지만 본다.
- 해석 충돌이 있었는데 질문 없이 진행: C. 질문 발동 조건을 개선한다.

과거 대화 전체를 plan에 복사하지 않고 결정 단위와 provenance만 보존한다.

## 완료 조건

- [ ] 이슈마다 A~F 분류와 근거가 있고, A(coverage gap)와 B(실행 누락)를 구분했다.
- [ ] 사용자 결정 변경을 실패 패턴으로 오염시키지 않았다.
- [ ] 사례 누적이 아니라 SKILL/template/AGENTS 지침의 변경/유지 판단을 했다.
- [ ] 새 규칙보다 기존 규칙 통합·교체를 먼저 검토했다.
- [ ] plan/impl/verify의 현재 작업 비판 책임을 review로 빼앗지 않았다.
- [ ] 변경을 Tier 1/2로 분류했고 애매하면 Tier 1을 적용했다.
- [ ] 선택한 tier가 요구하는 Operational Delta / Historical Regression / Cross-document 검사를 수행했다.
- [ ] DELETE에는 제거 근거가 있고, 설명 없이 사라진 gate/command/reference가 0개다.
- [ ] MOVE/REPLACE reference는 inbound `N`과 semantic target `M/M` 증거가 있다.
- [ ] Tier 1이면 failure corpus의 모든 현재 P heading을 전수 대조하고 historical coverage 회귀가 0건이다.
- [ ] Tier 2에서 historical 전수를 생략했다면 normative 의미 불변 근거를 기록했다.
- [ ] root AGENTS ↔ handoff AGENTS ↔ SKILL ↔ template ↔ references/scripts ↔ 하위 AGENTS/관련 CI 정본의 명령·scope 충돌이 0건이다.
- [ ] AGENTS 변경 시 위생·부모/자식 규칙 충돌·필요한 CLAUDE stub을 확인했다.
- [ ] INDEX/commit trailer 등 협업 운영 규칙이 의도치 않게 삭제되지 않았다.
- [ ] completion item은 본문의 실행 규칙에 매핑되고, 체크리스트에만 존재하는 새 normative 요구가 없다.
- [ ] 정상 plan/impl/verify는 failure corpus를 매번 읽거나 직접 갱신하지 않는다.
- [ ] 새로 쓴 지침 문장이 §산출물 문장 규칙을 지킨다 — 규칙 한 문장 + 사례 한 줄, 서술 압축이 증거를 지우지 않음.

## 종료 보고

다음을 분리해서 보고한다.

- causal class와 지침 변경 이유.
- 선택한 regression tier와 근거.
- Operational Instruction Delta 결과(KEEP/MOVE/REPLACE/DELETE 및 regression 0 여부).
- Tier 1이면 historical failure regression 결과, Tier 2면 생략 근거.
- cross-document consistency 및 reference semantic-integrity 결과.
- skill 변경으로 해결할 수 없는 capability/환경 한계.
