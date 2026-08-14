# Handoff skill regression coverage baseline — round 4

> 2026-08-14 PR #333의 3~4라운드 회귀 대조 기록.
> 이 파일은 실행 지침이 아니다. 실행 정본은 `handoff-plan/SKILL.md`, `handoff-verify/SKILL.md`, `handoff-review/SKILL.md`, `docs/handoff/AGENTS.md`다.

## 회귀 판정은 tier + 세 축이다

- **Tier 1 — Full regression**: trigger/owner/command/gate/template contract/failure semantics/canonical ownership 등 normative semantics가 바뀌면 A+B+C 전부 수행한다.
- **Tier 2 — Referential/mechanical correction**: 실행 의미·owner·gate·policy가 불변인 typo/path/link 정정은 affected A + C만 수행하고 B 생략 근거를 남긴다.
- **애매하면 Tier 1**이다.

세 축:

1. **Operational Instruction Delta** — 변경 전 SKILL/template/AGENTS/reference/script가 제공하던 실행 책임을 `KEEP / MOVE / REPLACE / DELETE`로 승계한다. reference MOVE/REPLACE는 inbound reference와 소비자가 기대한 semantic target 보존까지 본다.
2. **Historical Failure Regression** — Tier 1에서 `failure-patterns.corpus.md`의 현재 모든 `## P<number>`를 `COVERED / PARTIAL / GAP / OBSOLETE`로 대조한다.
3. **Cross-document Consistency** — root AGENTS ↔ handoff AGENTS ↔ 세 SKILL ↔ templates ↔ references/scripts ↔ 하위 AGENTS ↔ 관련 CI/자동화 정본 간 명령·owner·scope·경로 충돌을 검사한다.

**P coverage 만점은 전체 회귀 없음의 증거가 아니다.** 1라운드는 P1~P37만 대조해 운영지침 삭제(F3~F5)를 잡지 못했고, 2라운드는 reference 존재성은 확인했지만 inbound semantic integrity(N1)를 놓쳤다.

## Historical Failure Regression — P1~P37

이번 라운드는 `handoff-review`의 normative semantics를 변경하므로 **Tier 1**로 수행했다. plan/verify의 방어 지침을 삭제·약화하지 않았고 기존 P1~P37의 causal defense mapping은 유지된다.

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

**Historical 결과: COVERED 37 / PARTIAL 0 / GAP 0 / OBSOLETE 0.**

## Operational Instruction Delta — 2라운드 F1~F6

| ID | 1라운드에서 드러난 회귀 | 승계/보완 | 판정 |
|---|---|---|---|
| F1 | root `AGENTS.md`가 실패를 plan corpus에 직접 추가하라고 지시 | root를 새 3-skill 소유권으로 갱신, plan/verify 직접 corpus 갱신 금지 | CLOSED |
| F2 | `failure-patterns.md` 헤더가 자신을 실행 지침/축적 지점으로 선언 | review entrypoint를 정책 페이지로 분리하고 historical corpus를 별도 보존 | CLOSED — round3에서 corpus 자체의 옛 명령 노출도 제거 |
| F3 | plan/verify template generic `npm test`가 app ABI 안전 규칙과 충돌 | target subtree AGENTS를 agent-loop gate SSOT로 사용 | CLOSED |
| F4 | 검증 책임표·AGENTS 위생·INDEX 정합성 운영 체크 소실 | verify에 사람-vs-agent, AGENTS hygiene, INDEX, trailer/reference checks 복구 | CLOSED |
| F5 | handoff AGENTS에서 구현 gate와 tie-breaker 소실 | `애매하면 handoff` 복구, target subtree AGENTS SSOT | CLOSED |
| F6 | `handoff-verify/references/0157-case.md` 고아 | verify 역방향 탐색에서 대표 evidence로 직접 링크 | CLOSED |

## Round 3 — N1~N4 및 유지정책

| ID | 판정/원인 | 보완 | 결과 |
|---|---|---|---|
| N1 | **A. Instruction gap** — 기존 reference 검사는 소비자 존재/outbound 연결은 봤지만 inbound consumer가 기대한 의미 보존을 요구하지 않았다 | 6-A/6-C를 semantic integrity로 정밀화. 호환 symlink를 historical corpus로 돌리고 corpus 헤더에서 옛 실행 명령 제거 + current SSOT 부인 | CLOSED |
| N2 | 3축 무조건 강제가 trivial referential fix까지 full historical 재검증하게 함 | Tier 1(full A+B+C) / Tier 2(affected A+C)로 분리, **애매하면 Tier 1** | CLOSED |
| N3 | byte/줄 수 자체는 결함 아님. 실제 위험은 checklist-only normative rule | 완료 조건이 본문 규칙에 매핑되고 checklist만의 새 규칙이 없는지 확인하도록 변경 | WATCH — 현재 divergence 0 |
| N4 | agent-local gate와 PR/CI gate의 scope가 주석에서 모호 | `.github/workflows/ci.yml`을 **PR/CI 통합 게이트 정본**으로 명시, agent loop는 subtree AGENTS 정본 | CLOSED |
| R1 | round별 문서 자동 누적 시 R4를 다른 파일에서 재현할 위험 | round report 기본 미생성. 영구 결과는 지침 + 이 파일에 압축 | PARTIAL — 생성 조건이 실제 provenance를 표현하지 못해 Round 4에서 마감 |

### N1 reference semantic-integrity evidence

호환 경로: `.agents/skills/handoff-plan/references/failure-patterns.md` → `../../handoff-review/references/failure-patterns.corpus.md`.

외부 검토에서 식별된 legacy inbound 인용은 8곳이다. 대표 실물 대조:

- `0173/plan.md` — `failure-patterns.md:541-552`, **P29** 기대.
- `0158/verify.md` — **P12** 기대.
- `0159/plan.md` — **P19** 기대.
- `0177/verify.md` — **P30·P31** 기대.
- `0165/verify.md` — 당시 신규 패턴(현재 **P23**) 축적 맥락.
- `0186/plan.md`, `0186/verify.md` — **P36** 기대. 과거 문서의 “SSOT” 표현은 historical 기록이며 current SSOT가 아님을 corpus 헤더가 무력화한다.
- `0185/plan.md` — 호환 경로 자체를 절차 reference로 열거.

Distinct named P semantic targets는 `P12`, `P19`, `P23`, `P29`, `P30`, `P31`, `P36` **7/7**이며 historical corpus에 해당 `## P<number>` 본문을 유지한다. `0173`의 line-scoped citation이 있으므로 corpus 헤더 교체는 **기존 헤더와 같은 줄 수를 유지**해 P 본문의 line offset을 보존한다.

**중요**: 링크가 resolve하거나 파일이 존재한다는 사실만으로 PASS하지 않는다. heading/line contract를 요구한 소비자는 실제 heading/line 의미가 새 target에서 유지되는지를 증명해야 한다.

## Cross-document Consistency — round 3

| 대조 | 결과 |
|---|---|
| root AGENTS ↔ docs/handoff AGENTS ↔ review SKILL | Tier 1/2와 `애매하면 Tier 1`, `Handoff:none ≠ 검증 면제` 일치 |
| review SKILL ↔ completion checklist | 모든 완료 항목이 본문 §2~§7에 매핑, checklist-only normative rule 0 |
| plan compatibility symlink ↔ historical corpus | 과거 P/라인 소비자는 corpus에 직접 착지, historical header는 current SSOT 아님을 명시 |
| review entrypoint ↔ corpus | entrypoint=current policy routing, corpus=historical evidence 역할 분리 |
| reference inbound expectations ↔ corpus | named P semantic target 7/7 유지; legacy 8곳 소비 목적 보존 |
| app AGENTS ↔ ci.yml ↔ handoff guidance | agent-local/closed-network gate와 PR/CI integration gate scope 분리 |
| round2-review.md ↔ review 기록 정책 | review 판단으로 보존한 rationale 스냅샷. 보존 사유를 문서 첫머리에 명시, 동시 1개 유지, 실행 정본 아님 |

**Cross-document result: PASS.**

## 부수 확인 / 한계

- `app/scripts/check-doc-inventory.mjs`가 `.agents`를 `PROSE_EXCLUDED`로 제외하고 historical handoff 링크도 일부 skip하므로 그 CI green은 skill/reference semantic integrity의 증거로 사용하지 않는다.
- 1라운드 커밋 `c96a1cb`의 `Agent: chatgpt`는 당시 규약 위반이다. 공개 이력을 force-rewrite하지 않고 역사적 위반으로 유지한다.
- 진행 중 legacy handoff는 형식 때문에 일괄 변환하지 않는다. 새 Part I/II + Ledger 구조는 신규 handoff부터 적용하고, 기존 plan을 실질적으로 재설계할 때만 승격한다.
- historical handoff의 “Pxx가 SSOT” 같은 문장은 당시 기록이라 개작하지 않는다. corpus 헤더에서 현재 정본이 SKILL임을 명시한다.

## Round 3 결론

- Regression tier: **Tier 1** — review의 normative semantics 변경.
- Operational Instruction Delta: **regression 0**.
- Historical Failure Regression: **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**.
- Reference semantic integrity: legacy inbound **8곳**, named P targets **7/7 유지**.
- Cross-document Consistency: **PASS**.

---

# Round 4 — round 문서 보존 규칙 정합화

3라운드 검토에서 남은 결함 1건을 닫는다.

## 발견

`round2-review.md`의 provenance가 두 곳에서 **"사용자가 원문 보존을 명시 요청한 감사 산출물"** 로 기술됐으나, 실제로는 **review 판단으로 생성한 문서**다. 사용자는 검토만 요청했고 산출물 보존을 요구한 적이 없다. 동시에 3라운드가 새로 세운 정책은 "사용자가 명시적으로 요구한 경우에만" 별도 round 문서를 만든다고 규정했으므로, **정책과 실물이 서로를 부정**했다 — 정책대로면 이 파일은 존재하면 안 되고, 파일을 남기려면 사실이 아닌 출처를 적어야 한다.

- 분류: **A. Instruction gap** — 정책이 review 자신의 정당한 보존 판단을 표현할 수 없어서, 규칙을 지키려면 출처를 왜곡해야 하는 구조였다.
- 이 형태는 R4(사례 누적 금지)를 corpus 밖 디렉토리에서 재현할 위험도 함께 갖는다.

## 보완

| 대상 | 변경 |
|---|---|
| `handoff-review/SKILL.md §7` | round 문서 생성 조건에 **review 판단 + 첫머리 보존 사유 명시** 추가. **동시 1개 유지** 규칙 신설. 출처를 사실대로 적으라는 문장 추가 |
| `docs/handoff/AGENTS.md` | 같은 규칙으로 동기화. 트리 주석을 사실에 맞게 정정 |
| `round2-review.md` | 첫머리에 실제 보존 사유(사용자 요청 아님 · review 판단 · 1개 유지 · 실행 정본 아님) 기재 |
| 본 파일 cross-document 행 | 허위 provenance 표기 정정 |

## Tier 판정

**Tier 1** — round 문서 생성 조건과 보존 상한은 normative policy다.

## 세 축

| 축 | 결과 |
|---|---|
| Operational Instruction Delta | KEEP 전부. DELETE 0. 3라운드가 세운 "기본 미생성 · 실행 정본 아님" 은 유지하고 생성 조건만 REPLACE(더 정확한 일반 규칙) + 보존 상한 신설 | 
| Historical Failure Regression | P1~P37 전수 재대조 — **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 이번 변경은 plan/verify의 어떤 방어 지침도 건드리지 않고 review 기록 정책만 바꾼다 |
| Cross-document Consistency | `SKILL.md §7` ↔ `docs/handoff/AGENTS.md` 트리·정책 문단 ↔ `round2-review.md` 첫머리 ↔ 본 파일 — 네 곳의 생성 조건·보존 상한·provenance 서술 일치. 충돌 0 |

## Reference semantic integrity

reference MOVE/REPLACE 없음. inbound `N=0`, semantic target `M=0`. 3라운드가 세운 호환 경로(`handoff-plan/references/failure-patterns.md` → historical corpus)는 재검증만 수행했다.

- 호환 경로로 읽은 `## P<number>` = **37개**.
- legacy 인용이 기대하는 named target `P12·P19·P23·P29·P30·P31·P36` = **7/7 실재**.
- `0173`의 line-scoped 인용 `failure-patterns.md:541-552` = **P29 본문에 그대로 착지**(실측).

## 게이트

`cd app && node scripts/check-doc-inventory.mjs --check` — generated doc ok · prose ok · **links ok(broken 0)**. `.agents` 는 prose 스캔에서 제외되고 historical handoff 링크는 skip되므로, 위 semantic integrity 판정의 증거로는 사용하지 않는다.

## Round 4 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0**.
- Historical Failure Regression: **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**.
- Cross-document Consistency: **PASS**.
