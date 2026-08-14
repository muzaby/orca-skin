# Handoff skill regression coverage baseline — round 2

> 2026-08-14 PR #333의 2라운드 회귀 대조 기록.
> 이 파일은 실행 지침이 아니다. 실행 정본은 `handoff-plan/SKILL.md`, `handoff-verify/SKILL.md`, `handoff-review/SKILL.md`, `docs/handoff/AGENTS.md`다.

## 회귀 판정은 세 축이다

1. **Operational Instruction Delta** — 변경 전 SKILL/template/AGENTS/reference/script가 제공하던 실행 책임을 `KEEP / MOVE / REPLACE / DELETE`로 승계한다.
2. **Historical Failure Regression** — `failure-patterns.corpus.md`의 현재 모든 `## P<number>`를 `COVERED / PARTIAL / GAP / OBSOLETE`로 대조한다.
3. **Cross-document Consistency** — root AGENTS ↔ handoff AGENTS ↔ 세 SKILL ↔ templates ↔ references/scripts ↔ 하위 AGENTS 간 명령·owner·경로 충돌을 검사한다.

**P coverage 만점은 전체 회귀 없음의 증거가 아니다.** 1라운드는 P1~P37만 대조해 운영지침 삭제(F3~F5)를 잡지 못했다.

## Historical Failure Regression — P1~P37

| Pattern | causal lesson | 방어 지침 | 판정 |
|---|---|---|---|
| P1 | native 의존에서 test seam 미구체화 | plan Technical Design — 별도 import 경계 seam | COVERED |
| P2 | AC 측정 불가/목적 밖/production path 없음 | plan AC — 행동 단언 + 검증 수단 + production path | COVERED |
| P3 | 숫자 stale/승계 | plan 조사 — 재측정 + 합계 검산 | COVERED |
| P4 | 대표 샘플만 보고 소비처 누락 | plan 조사 — 전수 grep + N | COVERED |
| P5 | 전제를 실측 없이 채택 | 요구 비판/조사 — 권위 신호와 실측 | COVERED |
| P6 | 외부 규약/선택 필드 의미 미확인 | 벤더 1차 출처 + true/false/undefined | COVERED |
| P7 | lint/위생/레이어 규칙 누락 | 작업 관련 AGENTS/eslint/hygiene/migration 규칙을 설계 입력으로 읽음 | COVERED |
| P8 | 파라미터 단위·상태 타입 모호 | 단위/범위/의미 + discriminated union | COVERED |
| P9 | 선행 자료 비판 없이 수용 | 선행 자료를 코드와 재대조 | COVERED |
| P10 | 기존 결정 충돌 미탐색 | Decision Ledger + 본문 완성 후 정합성 gate | COVERED |
| P11 | AC/절 자가당착 | 같은 대상 전 절 교차검증 | COVERED |
| P12 | 조사 가능한 것을 불가 선언 | 조사 우선 + verify test handle 탐색 | COVERED |
| P13 | lifecycle/cancel/전이 미전개 | Product/UX 상태 전이 + Technical Design lifecycle | COVERED |
| P14 | 참조 구현 범위를 계약 전체로 착각 | union/enum 전수 + coverage + 재사용 형상/시점 | COVERED |
| P15 | 계약 제약 enforcement point 없음 | 누가/언제 강제 표 | COVERED |
| P16 | 유예 비용/one-way door 오판 | one-way door는 현재 결정 | COVERED |
| P17 | 같은 규칙 중복/SSOT 없음 | SSOT + 공유 강제 | COVERED |
| P18 | 실기 불가 전 테스트 핸들 미탐색 | verify in-memory/pure/composition/port fake 탐색 | COVERED |
| P19 | 실재하지 않는 문서 앵커 인용 | 앵커 grep | COVERED |
| P20 | 부팅 등록값 증가의 소비처 누락 | 등록/스토어 기존 소비처 전수 | COVERED |
| P21 | 원인 대신 로그/증상만 제거 | 증상이 가리던 상태 변화 확인 | COVERED |
| P22 | 사람 실기가 순수 로직 하치장 | pure seam 우선 | COVERED |
| P23 | AC를 테스트 파일명에 결박 | 행동 단언이 정본, 실제 분기 실행 확인 | COVERED |
| P24 | 구현자가 AC 재작성 | 구현 전 plan 기준선 고정 | COVERED |
| P25 | 순서 요구에 관측 지점 없음 | 훅/로그/주입 경계 | COVERED |
| P26 | producer는 맞지만 consumer 파생 오류 | producer/consumer end-to-end 쌍 검증 | COVERED |
| P27 | 출력/요청 worst-case 미계산 | 원천 상한 × 배치 상한 | COVERED |
| P28 | 1차 문서보다 맥락 불명 내부 관찰 우선 | 외부 API 증거 우선순위 | COVERED |
| P29 | 순수 함수가 native 파일과 같은 import graph | 별도 순수 파일 seam | COVERED |
| P30 | 음성 gate가 정당한 이력 제거 | 예외 선열거 후 술어 구성 | COVERED |
| P31 | 하위 가이드 주장을 정본 승격하며 미재검증 | 코드 재검증 + 원본 동시 수정 | COVERED |
| P32 | 코드 형태 전 구조 목표 숫자 고정 | 단계 지도 + 달성 가능성 | COVERED |
| P33 | 존재하지 않는 기존 테스트 인용 | 실제 케이스/분기 존재 확인 | COVERED |
| P34 | 제거를 이동으로 재해석 | 이유/조건 보존 + 이동≠제거 | COVERED |
| P35 | 총량 임계가 허용/제거 대상 혼합 | 형태별 분해 | COVERED |
| P36 | 외부 구현 포트 문서 drift | 문서 예제 shape + semantics | COVERED |
| P37 | semantic 목표를 structural proxy로 검증 | 적대 사례 + 실제 관측 주체 | COVERED |

**결과: COVERED 37 / PARTIAL 0 / GAP 0 / OBSOLETE 0.**

## Operational Instruction Delta — 2라운드 리뷰 F1~F6

| ID | 1라운드에서 드러난 회귀 | 승계/보완 | 판정 |
|---|---|---|---|
| F1 | root `AGENTS.md`가 실패를 plan corpus에 직접 추가하라고 지시 | root를 새 3-skill 소유권으로 갱신, plan/verify 직접 corpus 갱신 금지, meta `Handoff:none`도 review 3축 검증 강제 | COVERED |
| F2 | `failure-patterns.md` 헤더가 자신을 실행 지침/축적 지점으로 선언 | 현재 경로를 **정책 entrypoint**로 교체, 원 역사 본문은 `failure-patterns.corpus.md`로 보존하고 archival/non-normative 명시 | COVERED |
| F3 | plan/verify template의 generic `npm test`가 app ABI 안전 규칙과 충돌 | plan/verify template과 verify SKILL이 target subtree `AGENTS.md`를 gate SSOT로 사용. app은 lint+typecheck 기본, non-DB direct vitest, DB 필요 시만 npm test | COVERED |
| F4 | 검증 책임표·AGENTS 위생·INDEX 정합성 운영 체크 소실 | verify SKILL/template에 사람-vs-agent 표, AGENTS hygiene/parent-child, INDEX, trailer/reference checks 복구 | COVERED |
| F5 | handoff AGENTS에서 구현 gate와 “애매하면 handoff” tie-breaker 소실 | tie-breaker 복구. 구현 명령은 중복 하드코딩 대신 **target subtree AGENTS SSOT**로 명시. `Handoff:none`은 review 검증 면제가 아님 | COVERED |
| F6 | `handoff-verify/references/0157-case.md` 고아 | verify SKILL/template의 역방향 탐색에서 대표 evidence로 직접 링크 | COVERED |

### F5 원문 주장 중 정정

root 규칙 6은 “느슨한 쪽 우선”이 아니라 **더 구체적인 디렉토리 `AGENTS.md` 우선**이다. 따라서 2라운드 보완은 root/handoff에 app 명령을 복제하는 대신 target subtree AGENTS를 명령 SSOT로 삼는다.

**Operational 결과: 6/6 CLOSED.**

## Cross-document Consistency

| 대조 | 결과 |
|---|---|
| root AGENTS ↔ docs/handoff AGENTS | review 소유권, meta carveout, corpus 정책 일치 |
| docs/handoff AGENTS ↔ plan/verify/review SKILL | current-task plan/verify vs meta review 책임 일치 |
| plan/verify template ↔ `app/AGENTS.md` | generic `npm test` 기본값 제거, 하위 가이드 우선 |
| verify SKILL/template ↔ 0157 case/script | reference 소비 경로 복구 |
| corpus entrypoint ↔ historical corpus | 현재 정책과 과거 evidence 분리 |
| commit protocol ↔ 이번 round2 commit | 새 커밋은 `Agent: claude` 사용 예정 |

**Cross-document result: PASS.**

## 부수 확인 / 한계

- `app/scripts/check-doc-inventory.mjs`가 `.agents`를 `PROSE_EXCLUDED`로 제외하므로 그 CI green은 skill 내부 정합성 증거로 사용하지 않는다.
- 1라운드 커밋 `c96a1cb`의 `Agent: chatgpt`는 당시 규약 위반이다. **공개 이력을 force-rewrite하지 않고 역사적 위반으로 기록**하며 2라운드 이후 커밋부터 허용값을 사용한다.
- 진행 중 legacy handoff는 형식 때문에 일괄 변환하지 않는다. 새 Part I/II + Ledger 구조는 신규 handoff부터 적용하고, 기존 plan을 실질적으로 재설계할 때만 승격한다.

## 2라운드 결론

1라운드의 `37/37 COVERED`는 **Historical Failure Regression만의 결과**로 재해석한다. 2라운드부터 handoff 지침 변경 완료 조건은 다음 세 항목을 모두 만족해야 한다.

- Operational Instruction Delta: regression 0
- Historical Failure Regression: regression 0
- Cross-document Consistency: conflict/orphan 0
