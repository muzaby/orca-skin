---
name: handoff-review
description: handoff-plan 및 handoff-verify의 지침 자체를 리뷰하고 개선할 때 쓴다. 반복 라운드, 여러 턴의 결정 drift, 동일 실수 재발, 사용자의 명시적 handoff 프로세스 리뷰 요청이 있을 때 실패 원인을 분류하고 SKILL 지침을 수정한 뒤 failure-patterns 전체로 회귀 검증한다.
---

# handoff-review — handoff 시스템의 지침을 개선하는 메타 리뷰

## 목적

이 스킬은 특정 plan이나 verify를 한 번 더 검사하는 세 번째 체크리스트가 아니다. handoff 과정에서 반복된 실패·결정 drift·소통 실패의 원인을 찾아 `handoff-plan` / `handoff-verify`의 **지침 자체**를 개선한다.

정본 관계:

- `handoff-plan/SKILL.md` — 현재 설계 에이전트가 따라야 할 규칙.
- `handoff-verify/SKILL.md` — 현재 검증 에이전트가 따라야 할 규칙.
- [`references/failure-patterns.md`](references/failure-patterns.md) — historical regression corpus. 실행 지침의 정본이 아니다.
- 이 스킬 — 실패 증거를 일반화해 SKILL을 수정하고 변경 후 corpus로 회귀를 확인한다.

**사례를 한 줄 더 쌓는 것으로 리뷰를 끝내지 않는다.** 주 산출물은 SKILL/템플릿/공통 지침의 실제 개선이다.

> `failure-patterns.md` 본문 상단에는 이 스킬 도입 전의 “plan이 직접 읽고 verify가 직접 갱신한다”는 역사적 안내가 남아 있을 수 있다. **현재 소유권/실행 규칙은 이 SKILL과 `docs/handoff/AGENTS.md`가 우선한다.** 회귀 검증에서는 corpus의 `## P<number>` 사례와 causal lesson을 증거로 읽는다.

## 실행 조건

- 사용자가 handoff 스킬/지침 개선을 명시적으로 요청한다.
- 하나의 handoff에서 같거나 유사한 실패가 반복된다.
- 여러 handoff에서 동일 설계/검증 실수가 재발한다.
- 긴 대화의 확정 결정이 plan에서 소실·변형되는 decision drift가 관찰된다.
- verify가 같은 한계를 반복해서 사람 실기/환경 제약으로 넘긴다.
- impl 라운드가 3을 초과한다.

정상 단일 PASS마다 자동 실행하지 않는다.

## 1. 증거 수집

관련 plan/verify의 모든 라운드, 구현자 코멘트·diff·테스트, 여러 턴의 사용자 결정, 현재 plan/verify SKILL과 template, `docs/handoff/AGENTS.md`를 읽는다. 최신 턴만 보고 이전 합의를 재구성하지 않는다.

## 2. 실패 분류

| 분류 | 판정 | 기본 조치 |
|---|---|---|
| A. Instruction gap | 필요한 행동이 현재 SKILL에 없거나 모호함 | SKILL/template 수정 후보 |
| B. Execution/capability failure | 명확한 지침과 gate가 있었는데 수행하지 않음 | 같은 규칙 중복 추가 금지. evidence/gate 강화 가능성만 검토 |
| C. Communication/spec mismatch | 두 해석이 합리적이고 사용자 의도가 충분히 특정되지 않음 | 사용자 질의 발동 조건 보완 |
| D. User decision change | 사용자가 후속 턴에서 의도적으로 결정 변경 | 실패로 학습하지 않음. supersede만 보존 |
| E. Evidence/environment limitation | 필요한 1차 증거·실행 환경이 실제로 없음 | 검증 경계/대리 검증/사람 책임 명확화 |
| F. Implementation defect | 설계 지침은 충분하고 구현만 잘못됨 | plan skill 변경 금지. verify가 잡는지 확인 |

사용자가 이미 구체적으로 결정했는데 몇 턴 뒤 에이전트가 다른 안을 채택했다면 B다. 처음부터 여러 제품적 선택지가 가능했는데 확인 없이 택했다면 C다. 사용자가 명시적으로 바꿨다면 D다. 조건절·이유절이 대안을 지정했는데 배경으로 읽은 경우는 현재 지침 존재 여부에 따라 A/B로 판정한다.

## 3. 현재 지침의 결함을 찾는다

각 A/B/C/E 이슈마다:

1. 이 실패를 막으려던 현재 지침이 이미 있는가.
2. 있다면 어느 heading/문장인가.
3. 그 지침을 정상 수행했어도 실패 가능한가.
4. 가능하다면 발동 조건·증거 요구·순서·책임 경계 중 무엇이 부족한가.
5. 지침이 없으면 가장 일반적인 형태로 어디에 추가해야 하는가.

이미 명확한 규칙이 있는데 놓친 B 유형은 같은 문장을 더 추가하지 않는다. 체크가 아니라 evidence를 남기게 할 수 있는지, 실행 순서를 바꿀지, template 필수 필드로 강제할지, 흩어진 규칙을 통합할지만 본다. 그것도 불가능하면 capability limitation으로 기록한다.

## 4. 지침 패치 원칙

추가보다 **교체·통합**을 우선한다.

1. 기존 지침을 더 정확한 일반 규칙으로 교체.
2. 같은 causal class를 다루는 규칙 통합.
3. 발동 조건·판정 증거 강화.
4. 정말 새로운 causal class일 때만 새 규칙 추가.

사례 ID 자체를 실행 규칙으로 만들지 않는다. 사용자 변심을 모델 실패 패턴으로 축적하지 않는다.

## 5. 책임 경계

`handoff-plan`에는 현재 요구 비판, Decision Ledger, Product/UX Contract, 코드 조사·기술 설계, 검증 가능한 AC, READY 정합성 검사를 남긴다.

`handoff-verify`에는 현재 구현 비판, 역방향 탐색, Product/UX ↔ end-to-end 검증, 구현자가 AC를 바꿔 자기 증명했는지 확인, 기계 검증/사람 실기 경계를 남긴다.

`handoff-review`가 실패 원인 분류, 반복 실수 일반화, SKILL 자체 수정, failure-patterns 유지 정책과 regression coverage를 맡는다. plan/verify가 매 작업마다 failure-patterns를 갱신하거나 자기 SKILL을 수정하지 않는다.

## 6. failure-patterns 회귀 검증 — SKILL 변경 필수 gate

**SKILL을 바꾼 뒤에만** [`references/failure-patterns.md`](references/failure-patterns.md)를 전수 읽는다.

1. 모든 `## P<number>` heading을 전수 추출한다. 번호 상한을 하드코딩하지 않는다.
2. 각 패턴의 causal lesson을 한 문장으로 요약한다.
3. 변경 전/후 SKILL의 방어 지점을 찾는다.
4. 각 패턴을 `COVERED / PARTIAL / GAP / OBSOLETE`로 판정한다.
5. `PARTIAL/GAP`은 SKILL을 다시 수정하거나 수정하지 않는 근거를 남긴다.
6. 변경 전 COVERED였는데 변경 후 PARTIAL/GAP이면 회귀 실패다.

`COVERED`는 키워드 일치가 아니다. 실제 실패가 일어나기 **전에** 발동하는 실행 가능한 절차여야 한다. 예를 들어 기존 결정을 확인한다는 문장만으로 decision drift를 막았다고 보지 않는다. 과거 실패가 본문 후반에서 앞선 결정을 뒤집은 사례라면, 본문 완성 후 교차검증하도록 순서를 강제해야 COVERED다.

## 7. failure-patterns 갱신 정책

이 파일은 지침집이 아니라 회귀 코퍼스다. 새 이슈는 기존 P에 없는 새로운 causal class이거나 새 지침의 대표 evidence일 때만 추가한다. 동일 causal class의 재발은 장문 사례를 계속 쌓지 않고 필요하면 재발 한 줄 정도로 충분하다.

사례를 추가했다면 같은 review에서 해당 lesson의 SKILL 승격 여부를 판단하고 전체 regression을 다시 수행한다. 사례 추가만 하고 SKILL unchanged인 경우는 B/D/F/E 등 변경이 부적절한 근거가 있어야 한다.

## 8. Decision drift 리뷰

`사용자 결정 시점 → 당시 plan/Decision Ledger → 후속 turn → 최종 Product/UX Contract → Technical Design/AC` 순으로 추적한다.

- 사용자가 바꾸지 않았는데 사라짐: B, 또는 Ledger 지침이 없었다면 A.
- 사용자 변경 명시: D. 기존 결정을 SUPERSEDED 처리했는지만 본다.
- 해석 충돌이 있었는데 질문 없이 진행: C. 질문 발동 조건을 개선한다.

과거 대화 전체를 plan에 복사하지 않고 결정 단위와 provenance만 보존한다.

## 완료 조건

- [ ] 이슈마다 A~F 분류와 근거가 있다.
- [ ] skill gap과 모델 실행 실패를 구분했다.
- [ ] 사용자 결정 변경을 실패 패턴으로 오염시키지 않았다.
- [ ] 사례 누적이 아니라 SKILL 지침의 변경/유지 판단을 했다.
- [ ] 새 규칙보다 기존 규칙 통합·교체를 먼저 검토했다.
- [ ] plan/verify의 현재 작업 비판 책임을 review로 빼앗지 않았다.
- [ ] failure-patterns의 모든 현재 P heading을 전수 대조했다.
- [ ] 각 P에 COVERED/PARTIAL/GAP/OBSOLETE와 방어 지침 근거가 있다.
- [ ] 변경 전 대비 coverage 회귀가 0건이다.
- [ ] 정상 plan/verify는 failure-patterns를 매번 읽거나 직접 갱신하지 않는다.

## 종료 보고

어떤 causal class를 발견했는지, plan/verify의 어떤 지침을 왜 바꿨는지, failure-patterns regression 결과, skill 변경으로 해결할 수 없는 capability/환경 한계를 보고한다.
