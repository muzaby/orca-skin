# Handoff failure patterns — historical regression corpus 진입점

이 파일은 **실행 지침집이 아니다.** 현재 handoff 실행 규칙의 정본은 다음이다.

- 설계: `../handoff-plan/SKILL.md`
- 검증: `../handoff-verify/SKILL.md`
- 지침 자체 개선: `../handoff-review/SKILL.md`
- 협업/상태 머신: `docs/handoff/AGENTS.md`

과거 실패의 원문과 `P<number>` 사례 본문은 [`failure-patterns.corpus.md`](failure-patterns.corpus.md)에 보존한다. 그 corpus는 **historical evidence**이며, 상단의 옛 “plan이 직접 읽고 verify가 직접 갱신한다”류 안내도 도입 당시의 기록일 뿐 현재 명령이 아니다.

## 사용 규칙

- 정상 `handoff-plan` / `handoff-verify`는 이 corpus를 매번 읽거나 직접 갱신하지 않는다.
- `handoff-review`가 SKILL/template/AGENTS 지침을 변경할 때 **Historical Failure Regression** 단계에서 현재 모든 `## P<number>`를 전수 대조한다.
- 새 실패가 나왔다고 사례부터 추가하지 않는다. 먼저 instruction gap / execution failure / communication mismatch / user decision change / evidence limitation / implementation defect를 분류하고, **지침 자체를 바꿔야 하는지** 판단한다.
- 새로운 causal class 또는 새 지침의 대표 evidence일 때만 corpus 추가를 검토한다. 같은 원인의 반복은 사례만 계속 늘리지 않는다.
- corpus를 수정했다면 같은 review에서 전체 historical regression을 다시 수행한다.

## 지침 리팩터링 주의

과거 P corpus만으로는 기존 운영지침의 삭제를 검출할 수 없다. 따라서 handoff 지침 변경은 `handoff-review/SKILL.md`의 세 축을 모두 거친다.

1. Operational Instruction Delta — 기존 책임/명령/게이트의 KEEP·MOVE·REPLACE·DELETE 승계.
2. Historical Failure Regression — 이 corpus의 P 패턴 전수 대조.
3. Cross-document Consistency — root/handoff AGENTS, SKILL, template, references/scripts, 하위 AGENTS 간 충돌 검사.
