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

---

# Round 5 — 외부 리뷰가 verify를 밀어낸 구조

0188의 impl 라운드 4 초과 트리거로 수행했다.

## 발견

**0188은 impl 라운드를 4회 도는 동안 verify 턴을 한 번도 거치지 않았다.** `docs/handoff/0188-*/`에 `verify.md`가 없고, INDEX는 r1~r4 내내 `impl/IMPL_DONE · 다음 주체 = Claude(검증)`이었는데 실제 흐름은 매번 **외부 리뷰 → 재구현**이었다(r2 "외부 리뷰 반영", r3·r4 "PR #336").

사용자가 보고한 세 증상은 각각의 원인이 아니라 이 구조의 결과다.

| 증상 | 그것을 잡았어야 할 현재 지침 | 왜 안 잡혔나 |
|---|---|---|
| 계약을 주석으로만 적고 타입/테스트로 강제 안 함 | verify §3 ACTIVE Decision ↔ 구현 일관성, §6 shape+semantics | verify가 실행되지 않음 |
| 회귀 테스트가 production 경로 대신 fixture 로컬 재구현을 검증 | verify §2 배선 분리, §6 production path | verify가 실행되지 않음 + 문장이 역방향만 서술 |
| 부분 수정 — 공유 mutator의 한 호출 지점만 고침 | verify §2 "신규 레지스트리/스토어 값의 기존 소비처 전수와 부작용" | verify가 실행되지 않음 |

세 번째 증상(`expirySettled`가 rollback 좌표에서 누락)은 verify §2의 기존 불릿이 **문자 그대로 덮는다**. 새 규칙을 추가하면 B(실행 누락)에 같은 문장을 겹쳐 쓰는 것이므로 추가하지 않았다.

## 분류

- **주 원인: A. Instruction gap** — lifecycle이 "외부에서 도착한 피드백"을 표현하지 못했다. 상태 머신은 `verify/FAIL`만 재구현 진입점으로 알고, 외부 리뷰가 `IMPL_DONE`에 도착했을 때의 처리가 어디에도 없다. 지침을 정상 수행해도 막을 수 없다 — 에이전트가 외부 리뷰를 FAIL 피드백으로 읽는 것은 합리적이다.
- 두 번째 증상만 **A(narrow coverage gap)** — 기존 문장이 "유일한 호출자가 테스트면 미배선"이라는 **역방향**만 서술해, "배선은 됐는데 테스트가 production symbol을 안 부른다"를 표현하지 못했다.
- 나머지는 B로 판정하고 지침을 늘리지 않았다.

## 보완

| 대상 | 변경 | 성격 |
|---|---|---|
| `docs/handoff/AGENTS.md` §정상 라이프사이클 | **"외부 리뷰는 verify를 대체하지 않는다"** 신설 — 외부 피드백은 상태가 아니라 입력이고, 코드 검증 후 파생 이슈로 이관하며, 그것으로 돈 라운드도 다음 주체는 검증자다. 외부 피드백만으로 `verify/PASS`를 주지 않는다 | 신규(새 causal class) |
| `handoff-verify/SKILL.md §2` | 배선 판정을 **양방향**으로 REPLACE. 기존 문장은 첫 불릿으로 보존하고, 동명 로컬 재구현·타입만 차용하는 경우를 추가. 판정 질문 1개 부여 | REPLACE(더 일반적인 규칙) |

## Tier 판정

**Tier 1** — lifecycle 진입점과 owner semantics를 바꾼다.

## 세 축

| 축 | 결과 |
|---|---|
| Operational Instruction Delta | **DELETE 0.** handoff AGENTS는 순수 추가로 기존 상태표·절차·카브아웃·커밋 규약 전부 KEEP. verify §2는 기존 7개 불릿과 `0157-case.md` 링크를 그대로 두고 마지막 문장만 REPLACE — 구 규칙("유일한 호출자가 테스트면 미배선")이 첫 불릿으로 **문자 그대로 승계**되어 방어가 약화되지 않음 |
| Historical Failure Regression | P1~P37 전수 재대조 — **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 두 변경 모두 방어를 **추가**만 하고 plan/verify의 기존 방어 문장을 제거하지 않는다. P20(스토어 값 소비처 전수)과 P37(structural proxy)은 오히려 강화된다 — 전자는 verify가 실제로 실행되도록 만드는 lifecycle 규칙으로, 후자는 §2의 양방향 판정으로 |
| Cross-document Consistency | root `AGENTS.md` 협업 흐름(`plan → impl → verify`) ↔ `docs/handoff/AGENTS.md` 신설 절 ↔ `handoff-verify/SKILL.md` 마무리(라운드 3 초과 시 review) ↔ `handoff-review/SKILL.md` 실행 조건 — 네 곳이 같은 owner·같은 진입점을 말한다. 충돌 **0**. `Handoff: none` 카브아웃과 무관 |

## Reference semantic integrity

reference MOVE/REPLACE 없음. inbound `N=0`, semantic target `M=0`. 호환 경로로 읽은 `## P<number>` = **37개** 재확인.

## Round 5 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0**.
- Historical Failure Regression: **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**.
- Cross-document Consistency: **PASS**.
- 지침으로 해결할 수 없는 한계: 없음. 이번 원인은 지침 공백이었고 lifecycle 규칙으로 닫힌다.
  > **Round 6 정정 — 이 결론은 결과로 반증됐다.** r5 의 규칙 신설 이후에도 0188 은 라운드 10까지 갔다. 아래 Round 6 §발견 1 참조. 판정을 **CLOSED → PARTIAL** 로 내린다.

---

# Round 6 — 부분 수정이 라운드를 만든다

0188 의 **첫 verify 턴이 실제로 수행된 뒤**(라운드 10, `verify/PASS`) 사용자 요청으로 수행했다. 사용자가 지정한 초점은 **"10회를 도는 동안 어째서 계속 반복된 피드백이 나왔는가"** 다.

## 발견 1 (주 원인) — 같은 불변식이 다른 표면으로 다섯 라운드를 돌았다

라운드별 파생 이슈를 축으로 묶으면 반복의 정체가 드러난다. **매 라운드가 새 결함을 만든 것이 아니라, 같은 불변식의 아직 안 닫힌 지점이 순서대로 올라왔다.**

| 불변식 | 올라온 순서 (파생 이슈) | 라운드 수 |
|---|---|---|
| **자격증명 교체는 원자적이어야 한다** | D13 후보를 미리 커밋(r5) → D18 probe 후 커밋 경쟁(r6) → D19 vault 다단계 쓰기(r6) → D22 promote↔grant 저장 창(r7) → D22 재개봉 + D25 삼켜진 쓰기 오류 + D26 무조건 promote(r8) → D34 해제 후 vault 예외 split-brain(r10) | **5** |
| **만료 판정의 1회성 기준은 하나여야 한다** | D9 `snapshot()` 에만 걸림(r3) → D11 `markExpired` 가 `void`(r4) → D14 rollback 좌표 누락(r5) → D21 요청 중 만료(r6) → D27 관측 세대 미확인(r8) | **5** |
| **`await` 뒤에는 세대를 확인한다** | D18 커밋 축만(r6) → D23 성공 분기만(r7) → D23 재개봉 + D27 4지점 전면화(r8) | **3** |
| **테스트는 자기가 주장하는 production 경로에 진입한다** | D16(r5) → D24(r7) → D28(r8) → D33 `authoritative` 단언 11건 전부 결과 주입(r10) | **4** |
| **저장소 장애를 정상 상태로 오인하지 않는다** | D29 빈 맵을 권위로(r9, **r8 이 만든 회귀**) → D33 손상 top-level 을 신규 설치로(r10) | **2** |

여기서 읽어야 할 것은 세 가지다.

1. **매 라운드의 수정은 성실했고 사실이었다.** 구현 보고는 라운드마다 "지적 N건을 **전부 실측 재현한 뒤** 고쳤다" 였고 실제로 재현 테스트를 먼저 짰다. 문제는 성실성이 아니다.
2. **고친 범위가 리뷰가 지목한 지점이었다.** 리뷰는 자기가 본 표면만 말한다. 결함의 실체는 여러 지점에서 성립해야 하는 **불변식**인데, 지목된 한 지점만 닫으면 같은 불변식의 다음 지점이 다음 라운드에 올라온다.
3. **수정 자체가 새 표면을 만들었다.** D29 는 r8 의 부팅 sweep 이 만든 회귀다. 고치면서 만든 것은 리뷰가 아직 본 적이 없으므로, 그것을 검사하는 주체는 구현자 자신뿐이다.

**규칙을 Decision 으로 적는 것으로는 부족했다는 증거도 있다.** r8 은 테스트 축의 반복을 보고 **D-059**("회귀 테스트는 자기가 주장하는 production 경로에 실제로 진입했는지까지 단언한다")를 Decision Ledger 에 올렸다. 그런데 r10 에서 같은 형태가 또 나왔다(D33 — `authoritative` 단언 11건이 전부 결과 주입이라 파서에 한 번도 진입한 적이 없었다). **규칙을 세운 라운드 안에서 기존 코드에 전수 적용하지 않으면, 규칙은 다음 신규 코드에만 걸린다.**

- 분류: **A. Instruction gap — 새 causal class.** `docs/handoff/AGENTS.md §2 구현` 은 plan 을 어떻게 읽고 무엇을 선조치·보고할지만 정한다. **외부 피드백으로 도는 재구현 턴에 대한 지침이 없었다.** r5 가 신설한 절도 *외부 피드백을 무엇이라 부를지*(상태가 아니라 입력) 와 *코드로 재현하라* 까지만 정하고, **재현한 지적을 일반화해 전수 적용하라** 는 요구가 없다. 지침을 정상 수행한 결과가 곧 부분 수정이었다 — B 가 아니다.
- 왜 verify 가 이것을 잡는 유일한 방어였나: verify §2 의 "신규 레지스트리/스토어 값의 **기존 소비처 전수와 부작용**" 과 §1 의 부분 실패 검토가 정확히 이 축이다. **그 방어가 impl 쪽에는 없다.** 그래서 verify 가 한 번도 안 돌아간 것(발견 2)과 곱해져 라운드가 10까지 갔다.

### 그렇다면 plan·verify 는 잡을 수 있었나 — 축마다 다르다 (사용자 질의로 추가 조사)

산출물을 실제로 열어 확인했다. **축마다 답이 다르고, 그 차이가 남은 지침 공백을 정확히 가리킨다.**

| 축 | plan 이 잡을 수 있었나 | verify 가 잡을 수 있었나 |
|---|---|---|
| **만료/revision (5라운드)** | **이미 잡아 뒀다.** plan `§10 강제 지점` 표의 `credentialRevision` 행이 강제 지점을 **`credential commit·revoke·expiry·401/403` 네 개로 열거**했고, `실패 의미` 칸에 "같은 상태 재관측으로 증가하면 불필요 respawn" 까지 적혀 있다. D11(r4)이 바로 그 실패다 | §1·§6 로 가능하지만 **보장은 없었다** — verify SKILL 어디에도 *plan §10 표를 걷는다* 는 단계가 없다. §3 은 ACTIVE Decision, §6 은 AC 를 본다. **강제 지점 표는 Decision 도 AC 도 아니다** |
| **원자성 (5라운드)** | **plan 이 얇았다.** `§13 cleanup/rollback` 은 "재인증 실패 시 기존 grant 보존(D-009)" **목표 한 줄**이 전부다. 이 축의 실체("vault 와 grant 저장소는 원자적으로 함께 쓸 수 없다")는 r7~r8 에 외부 리뷰가 처음 말했다. **template 프롬프트가 시간 축**(생성/취소/종료/retry/cleanup)**만 묻고 저장소 축을 묻지 않는다** | **가능했다.** §1 의 "상태 변경·마이그레이션·외부 쓰기가 **실패 중 어디까지 남는가**" 가 정확히 이 질문이다. r1 직후에 한 번 물었다면 다섯 라운드가 한 번에 열렸을 것이다 |
| **테스트 진입 (4라운드)** | §11 `테스트 seam` 열은 *어디서 테스트하는가* 만 정한다 | **가능했다.** §2 의 배선 양방향 판정(r5 신설) |

여기서 **가장 값비싼 사실**: plan 은 만료/revision 축의 4지점을 **처음부터 표로 갖고 있었다.** 그것을 코드와 대조하라고 지시받은 주체가 아무도 없어서 5라운드가 걸렸다. 설계가 가장 잘 분해해 둔 산출물에 **소비자가 없었다.**

- 추가 분류: **A. Instruction gap 2건.**
  1. `handoff-verify` 에 **plan §10 강제 지점 표를 걷는 단계가 없다.** AC 는 대표 경로 하나만 단언하므로 4지점 중 1지점만 구현돼도 AC 는 통과한다 — 실제로 그렇게 통과했다.
  2. `handoff-plan` 의 lifecycle 프롬프트가 **저장소 축을 묻지 않는다.** "실패하면 보존한다" 는 목표 문장은 "어디서 죽으면 무엇이 보이는가" 에 답하지 않는데, 템플릿이 그 답을 요구하지 않는다.

## 발견 2 (증폭 요인) — Round 5 의 remedy 가 라벨 축에서만 작동했다

r5 는 `docs/handoff/AGENTS.md` 에 "외부 리뷰는 verify 를 대체하지 않는다" 를 신설하고 **"lifecycle 규칙으로 닫힌다"** 고 결론했다. 그 뒤 실제로 일어난 일:

| 축 | 결과 |
|---|---|
| 라벨 (규칙이 겨냥한 것) | **지켜졌다.** 라운드 6~10 의 보드 비고가 매번 "다음은 재구현이 아니라 `handoff-verify` 턴이다 — 외부 리뷰는 verify 를 대체하지 않는다(r5 신설 규칙)" 를 스스로 적었고, trailer 는 `Verified-By: pending` 을 유지했다. **거짓 PASS 0건**, 보드 상태는 내내 정직했다 |
| 순서 (규칙이 겨냥하지 않은 것) | **바뀌지 않았다.** 라운드 6·7·8·9·10 이 모두 외부 리뷰 → 재구현이었다. 규칙을 인용한 문장 바로 다음 라운드가 또 재구현이다 |

원인은 규칙의 **작용점**이다. r5 규칙은 *무엇을 verify 라고 부를지* 와 *무엇으로 PASS 를 줄지* 를 정한다. 사용자가 새 PR 리뷰를 건네는 순간의 **"둘 중 무엇을 먼저 하는가"** 는 그 규칙의 사정거리 밖이고, 에이전트가 재구현을 고르는 것도 사용자 지시를 따르는 합리적 해석이다.

- 분류: **C. Communication/spec mismatch.** 두 해석(리뷰 먼저 / verify 먼저)이 모두 합리적인데 사용자 의도가 특정되지 않았고, 에이전트가 확인 없이 하나를 택했다. B 가 아니다 — 규칙을 어긴 적이 없다. D 도 아니다 — 사용자가 "verify 를 건너뛰자" 고 결정한 적은 없고 선택지를 제시받은 적도 없다.
- §2 가 C 에 지정한 조치는 **사용자 질의 발동 조건 보완**이다. r5 문장을 반복하지 않는다.

**발견 1 과의 관계가 이 발견의 실제 무게다.** verify §2 의 "기존 소비처 **전수**와 부작용" 은 부분 수정을 잡는 유일한 구조적 방어인데, 그것이 10 라운드 동안 한 번도 발동하지 않았다. 즉 밀린 verify 의 비용은 "verify 만 잡을 수 있던 별개의 결함" 이 아니라 **"부분 수정이 한 라운드에 하나씩만 드러나는 상태를 계속 유지한 것"** 이다.

**실측치도 함께 남긴다.** 실제 verify 턴에서 **신규 코드 결함은 0건**이었다(게이트 재실측 · AC 25/25 · 역방향 탐색 0). 라운드 6~10 의 외부 리뷰는 결국 수렴했다 — 다섯 라운드에 나눠서. r5 가 "verify 가 잡았을 결함" 이라고 쓴 인과는 결함의 **존재**보다 **발견 속도**에 대한 것이었다고 교정한다. review 의 진단도 사후 증거로 고친다.

## 발견 3 (verify 턴에서 실측) — 검증자 자신의 게이트 실행이 검사 대상 밖이었다

verify 턴에서 실측된 두 사건.

| 사건 | 무슨 일이 일어났나 | 현재 지침의 방어 |
|---|---|---|
| **false green** | `vitest run --reporter=basic` 이 리포터 모듈 로드에 실패해 **테스트를 하나도 실행하지 않고 exit 0** 을 냈다. 출력을 읽지 않았다면 "게이트 통과" 로 기록될 수 있었다 | **없음.** §4 의 "structural proxy 를 증거로 쓰지 않는다" 는 AC·구현 증거에만 걸려 있고, template §9 는 *실행 명령* 만 요구하고 *실행 산출* 은 요구하지 않는다 |
| **트리 변형** | `npm run lint` = `eslint --cache --fix` 가 수백 파일의 줄바꿈을 정규화해 `git status` 가 오염됐다. 커밋 직전 확인이 없었다면 검증 커밋에 자기 실행분이 섞였다 | **없음.** §0 은 `plan.md` 기준선만 잠그고 코드 트리는 보지 않는다. `app/AGENTS.md` 는 lint 를 "ABI 중립 · 아무리 자주 돌려도" 라고만 설명해 **파일을 쓴다는 사실이 어디에도 없었다** |

- 분류: **A. Instruction gap** (둘 다). 현재 지침을 정상 수행해도 막지 못한다 — 정상 수행의 결과가 "명령을 적고 exit code 를 옮긴다" 이기 때문이다.
- 두 사건은 **하나의 causal class** 다: *검증자는 구현에 적용하는 의심을 자기 도구에는 적용하지 않는다.* 그래서 규칙도 하나로 묶었다.

## 보완

| 대상 | 변경 | 성격 |
|---|---|---|
| **`docs/handoff/AGENTS.md` §2 구현 — `외부 피드백을 반영하는 재구현 턴` 신설** | **주 조치.** 지적 하나를 닫을 때 ⓐ **불변식을 한 문장으로 뽑고**(문장이 지점 이름을 담고 있으면 덜 올라간 것) ⓑ 그 불변식이 성립해야 하는 **지점을 전수로 찾아 함께 닫고 개수를 보고**하며(일부만 닫았으면 남긴 곳을 적는다) ⓒ **이번 수정이 새로 만든 표면을 스스로 검사**한다. "ACTIVE Decision 으로 규칙을 적는 것은 적용을 보장하지 않는다 — 세운 라운드 안에서 기존 코드에 전수 적용한다" 를 명시 | 신규(**새 causal class** — 구현 턴에 이 축의 지침이 없었다) |
| `docs/handoff/AGENTS.md` §외부 리뷰는 verify를 대체하지 않는다 | 불릿 1개 추가 — 보드의 다음 주체가 이미 검증자인데 새 외부 피드백이 오면 **순서를 사용자에게 묻는다**. 기존 4불릿은 그대로. 실측 이력 blockquote 를 현재 사실(라운드 10 · 라벨은 지켜짐 · 결함 0)로 정정 | 신규(C 조치 = 질의 발동 조건) + 사실 정정 |
| **`handoff-verify/SKILL.md §6` — `### plan §10 강제 지점 표를 AC와 별개로 걷는다` 신설** | **주 조치 2.** `언제 강제` 칸에 열거된 지점을 **개수만큼** 코드에서 확인하고 개수를 적는다 · `실패 의미` 칸을 적대 사례로 쓴다 · 표에 없는 추가 지점도 적는다. "AC 는 대표 경로 하나만 단언하므로 부분 구현도 통과한다" 를 근거로 명시 | 신규(설계 산출물의 **소비자 부재**를 닫는다) |
| `verify.template.md §5` | 강제 지점 표 대조 표(계약/필드 · plan 이 적은 지점 · 코드에서 확인한 지점 N/M · 결과) 추가 | template 필수 필드 |
| **`handoff-plan/SKILL.md` 구현 가능성 방어선** | 기존 "누가·언제 강제하는지 적는다" 에 **"지점이 여럿이면 전부 나열한다 — 하나만 적으면 구현도 하나만 닫는다"** 추가. **다중 저장소 쓰기** 규칙 신설 — 원자적으로 함께 쓸 수 없는 저장소를 순서대로 쓰면 쓰기 지점 나열 → 지점별 실패 시 관측 상태 → 허용 불가 조합을 설계로 제거 | REPLACE(기존 규칙 정밀화) + 신규 |
| `plan.template.md §13` | Lifecycle 프롬프트에 **다중 저장소 쓰기** 항목 추가(해당 없으면 "해당 없음") | template 필수 필드 |
| `handoff-verify/SKILL.md §8` | `### 자기 게이트 실행도 §4의 대상이다` 신설 — exit code ≠ 실행 증거(관측 산출을 적는다) · 게이트의 트리 변형 확인 · 자기 명령의 잔여물. **§4 를 새 적용면으로 확장**하는 형태라 §4 본문은 건드리지 않는다 | REPLACE(기존 원칙의 적용 범위 확장) |
| `handoff-verify/verify.template.md` §9 | 필수 항목 3개 추가 — 관측한 실행 산출 · 트리 변형 여부 · 잔여물 | template 필수 필드 |
| `app/AGENTS.md` ABI 가이드 | `lint`/`format` 이 `--fix` 라 **파일을 쓴다**, `typecheck` 만 읽기 전용이라는 사실 1클로즈 추가 | 사실 보완(subtree gate SSOT) |

## Tier 판정

**Tier 1** — gate evidence semantics 변경 + template 필수 필드 추가 + 질의 발동 조건 신설. 셋 다 normative behavior 다.

## 세 축

| 축 | 결과 |
|---|---|
| **6-A Operational Instruction Delta** | **DELETE 0.** `docs/handoff/AGENTS.md §2 구현` 은 기존 5불릿과 `#### 구현 게이트의 정본` 을 **그대로 두고** 그 앞에 소절을 추가(KEEP + 추가) — 게이트 정본 규칙 무변경. §외부 리뷰 절도 기존 4불릿 KEEP + 1추가. verify SKILL 은 §0~§5·§7·§9~§11 heading·본문 무변경이고 §6·§8 은 기존 본문을 둔 채 하위 절만 추가. verify template 은 기존 항목 전부 KEEP + 추가. **plan SKILL 의 "누가·언제 강제" 규칙은 REPLACE**(문장을 유지하고 "지점이 여럿이면 전부" 를 덧붙임 — 구 규칙이 막던 것은 그대로 막는다) + 다중 저장소 규칙 신설. plan template §13 은 기존 5항목 KEEP + 1추가. `app/AGENTS.md` 는 ABI-중립 주장 유지 + 파일 쓰기 사실 병기 — **게이트 명령 자체는 하나도 바뀌지 않았다** |
| **6-B Historical Failure Regression** | P1~P37 전수 재대조 — **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 이번 변경은 방어를 추가만 하고 각 P 의 방어 지점을 **한 문장도 삭제·약화하지 않는다**. 강화 5건 — **P15**(계약 제약에 enforcement point 없음): "지점이 여럿이면 전부 나열" + **verify 가 그 표를 걷는 단계**가 생겨 표가 소비자를 얻었다. **P13**(lifecycle 미전개): 저장소 축 프롬프트 신설. **P4·P20**(소비처 전수): 설계·검증 축에만 있던 "전수" 요구가 구현 턴에도 생겼다. **P37**(structural proxy): 검증자 자신의 게이트 출력까지 확장. **P7**: subtree AGENTS 가 lint 쓰기 부작용을 명시. **신규 P38 추가**(발견 1 의 대표 evidence) — corpus 말미 append 로 P1~P37 line offset 보존(`0173/plan.md` 의 `:541-552` → P29 착지, 실측) |
| **6-C Cross-document Consistency** | root `AGENTS.md` ↔ `docs/handoff/AGENTS.md`(신설 2곳) ↔ 세 SKILL ↔ 두 template ↔ `app/AGENTS.md` ↔ `.github/workflows/ci.yml` — **충돌 0**. **owner 중복을 특히 봤다**: ① plan 이 강제 지점을 **열거**하고 → impl 이 **전수 적용**하고 → verify 가 **전수 확인**한다. 세 주체가 같은 표를 서로 다른 동사로 쓰며 한쪽이 다른 쪽을 면제하지 않는다. verify 는 impl 의 개수 보고를 증거로 받지 않는다(§4 자기보고 금지 유지) ② plan 의 다중 저장소 항목(설계 시 분해)과 verify §1 의 "실패 중 어디까지 남는가"(검증 시 재확인)도 같은 관계다. 새 질의 조항은 root 의 "사용자 지시 우선" 과 충돌하지 않는다(묻고 따르는 것이지 거부가 아니다). `Handoff: none` 카브아웃과 무관 |

## Reference semantic integrity

reference MOVE/REPLACE 없음. inbound `N=0`, semantic target `M=0`. 호환 경로로 읽은 `## P<number>` = **37개** 재확인.

## 게이트

`cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · links ok(broken 0). `.agents` 는 prose 스캔 제외이므로 이 green 을 skill 문서의 semantic integrity 증거로 쓰지 않는다(Round 3 이후 동일 한계).

## Round 6 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0**.
- Historical Failure Regression: **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**.
- Cross-document Consistency: **PASS**.
- corpus 추가: **P38 1건** — 발견 1 은 기존 P 에 없는 새 causal class 다(P4·P20 은 *설계 조사* 의 전수 누락, P38 은 *구현 턴이 외부 지적을 일반화하지 않는 것*. 주체·발동 시점이 다르다). 신설 지침의 대표 evidence 이기도 하다. 발견 2·3 은 corpus 에 넣지 않는다 — 각각 기존 lifecycle class 의 후속 교정과 P37 의 적용면 확장이다.
- 지침으로 해결할 수 없는 한계 2건:
  1. **순서 질의는 사용자의 답에 의존한다.** 사용자가 계속 "리뷰 먼저" 를 고르면 라운드는 계속 올라간다 — 정당한 사용자 결정이며 규칙이 막을 대상이 아니다. 지침이 보장하는 것은 *선택지가 보이게 하는 것* 까지다.
  2. **"불변식을 얼마나 높이 올릴 것인가" 는 판단이고 기계 검사가 없다.** 너무 낮으면 부분 수정이 남고, 너무 높으면 이번 지적과 무관한 리팩터링으로 번진다. 지침은 판정 기준 하나(문장이 지점 이름을 담고 있으면 덜 올라간 것)와 보고 의무(전수 개수 · 남긴 곳 명시)까지만 준다 — 그 뒤는 verify 가 다시 센다.

---

# Round 7 — 구현 턴에 주인을 준다 (`handoff-impl` 신설)

Round 6 이 진단한 공백을 스킬로 채운다. 사용자 요청으로 수행했다.

## 발견 — 사이클은 넷인데 스킬은 셋이었다

`plan → impl → verify` 중 **구현 턴만 스킬이 없었고**, normative 지침이 `docs/handoff/AGENTS.md §2 구현` 의 불릿 5개로만 존재했다. Round 6 이 찾은 세 가지 요구(불변식 전수 적용 · Product/UX 파생 진단 · plan 되먹임)는 전부 구현 턴의 책임인데 그것을 담을 자리가 없어 AGENTS.md 절이 계속 두꺼워지고 있었다.

- 분류: **A. Instruction gap** — owner 부재. Round 6 이 AGENTS.md 에 규칙을 넣은 것은 임시 조치였고, 이번에 정본을 제자리로 옮긴다.

## 변경

| 대상 | 변경 | 성격 |
|---|---|---|
| `.agents/skills/handoff-impl/SKILL.md` | **신규.** 0 기준선 · 1 plan 을 계약으로 · 2 강제 지점 전수 · 3 구현 중 진단 · 4 Product/UX 파생 검토 · 5 재구현 턴 불변식 · 6 되먹임 3분기 · 7 게이트 · 8 보고 + Review Signals | 신규 owner |
| `handoff-plan/plan.template.md` | `[구현자 기입]` 확장 — 강제 지점 전수 표 · Product/UX 파생 검토 표 · 대응 3분기 · 설계 대비 차이 · 관측한 게이트 산출 · Review Signals. **기존 3섹션 전부 KEEP** | template 필수 필드 |
| `docs/handoff/AGENTS.md` | 정본 표·책임 분리·디렉토리 트리를 **네 skill** 로. `§2 구현` 을 포인터 + 최소 계약으로 재구성 | MOVE + 요약 |
| root `AGENTS.md` | "단계별 스킬 = 절차의 정본" 에 impl 추가, `docs/handoff/AGENTS.md` 의 역할 서술을 현재 사실로 정정 | 사실 정정 |
| `handoff-review/SKILL.md` | 정본 관계·§5 책임 경계·실행 조건에 impl 추가. **impl↔verify 는 중복이 아니라 "닫고 다시 센다"** 를 명시 | 신규 owner 반영 |
| `handoff-verify/SKILL.md §4` | 구현자의 강제 지점 `N/M` 보고도 **자기보고** — 대조의 출발점이지 결론이 아니다 | 기존 원칙 확장 |

## Tier 판정

**Tier 1** — 신규 owner 생성 + normative 지침 MOVE + template 필수 필드. 애매하지 않다.

## 6-A Operational Instruction Delta — `docs/handoff/AGENTS.md §2` 전수

| 기존 항목 | 판정 | 근거 |
|---|---|---|
| Part I=제품 계약 / Part II=기술 가이드 | **KEEP** | 최소 계약 불릿으로 문자 그대로 남음 |
| ACTIVE Decision·AC 임의 변경 금지 | **KEEP** | 동일 |
| 구현 세부·명백한 누락은 선조치 후보고 | **KEEP** | 동일. skill §6 이 3분기로 정밀화 |
| 제품 의도·의존성·Decision·AC 는 보고만 | **KEEP** | 동일 |
| `Criteria-Met` 은 자기보고 | **KEEP** | 동일. verify §4 가 `N/M` 까지 확장 |
| `#### 외부 피드백을 반영하는 재구현 턴`(Round 6 신설) | **MOVE → skill §5** | 3단계 절차·"Decision 으로 적는 것은 적용을 보장하지 않는다"·0188 blockquote 가 **문장 단위로 승계**됨. AGENTS.md 에는 요지 1불릿 + skill 포인터를 남겨 skill 미가용 환경에서도 요구가 사라지지 않는다 |
| `#### 구현 게이트의 정본` | **KEEP (이동 금지)** | 게이트 명령·ABI·`ci.yml` scope 는 Codex 가 네이티브로 읽어야 한다. skill §7 은 **참조만** 하고 명령을 복제하지 않는다 |

**DELETE 0.** 설명 없이 사라진 gate·command·reference **0건**.

## 6-A MOVE 의 inbound semantic integrity

- old target `docs/handoff/AGENTS.md` 의 "구현 턴 지침" 을 기대한 inbound reference: **N=1** (root `AGENTS.md:59`).
- 그 소비자가 기대한 distinct semantic target: **M=2** — ① 구현 턴 절차의 소재지 ② 게이트 정본의 소재지.
- 새 상태에서 **M/M 유지**: ① root 문장이 `handoff-impl/` 을 직접 가리키도록 갱신했고 ② 게이트 정본은 `docs/handoff/AGENTS.md` 에 그대로 남아 root 문장이 "게이트 정본" 을 명시한다. **링크 resolve 만으로 PASS 하지 않고 두 의미의 착지점을 각각 확인했다.**
- 신규 inbound: `docs/handoff/AGENTS.md` 정본 표·§2·디렉토리 트리 3곳, `plan.template.md` 머리말 1곳, `handoff-review/SKILL.md` 2곳 — 전부 실재 경로.

## 6-B Historical Failure Regression

corpus 의 현재 `## P<number>` 를 전수(상한 하드코딩 없이) 대조 — **P1~P38, 38개**.

- **38 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE.** 이번 변경은 어떤 방어 문장도 삭제·약화하지 않는다(위 Delta 참조).
- **P38 이 이 스킬의 직접 근거다.** Round 6 에서 P38 의 방어는 `docs/handoff/AGENTS.md` 한 곳이었는데, 이제 skill §2·§5 가 절차로 갖고 template 이 보고를 강제한다 — **방어 지점이 1 → 3.**
- 강화 3건: **P15**(강제 지점 enforcement) — 열거(plan) → 전수 적용(impl) → 전수 확인(verify) 삼단이 완성됐다. **P26**(producer/consumer 파생 오류) — impl §4 가 *구현 시점*의 소비자 확인을 추가했다(기존엔 plan 설계 시점과 verify 검증 시점뿐). **P13**(lifecycle 미전개) — impl §3 이 다중 저장소 질문을 구현 시점에 다시 던진다.

## 6-C Cross-document Consistency

| 대조 | 결과 |
|---|---|
| root AGENTS ↔ `docs/handoff/AGENTS.md` | 네 skill 정본 서술 일치. root 가 "게이트 정본 + 최소 계약" 으로 정정됨 |
| `docs/handoff/AGENTS.md` ↔ `handoff-impl/SKILL.md` | 최소 계약 8불릿이 skill 절 번호를 인용. 명령·정책 충돌 0 |
| impl SKILL ↔ verify SKILL | **owner 중복 아님** — impl 이 닫고 verify 가 다시 센다. verify §4 가 impl 보고를 자기보고로 명시 |
| impl SKILL ↔ plan SKILL | plan 이 §10 에 지점을 *열거*하고 impl 이 *전수 적용*한다. plan 의 다중 저장소 규칙(Round 6)과 impl §3 도 설계/구현 시점 분업 |
| impl SKILL ↔ `plan.template.md` | 산출 surface 가 template 한 곳. **별도 impl template 을 만들지 않았다** — 문서 2개로 갈리면 검증자가 두 벌을 읽는다 |
| impl SKILL §7 ↔ `app/AGENTS.md` ↔ `ci.yml` | 게이트 명령을 복제하지 않고 subtree AGENTS 를 정본으로 참조. PR/CI scope 분리 유지 |
| review SKILL ↔ 완료 조건 | checklist-only normative rule 0 (본문 §5 에 impl 책임이 실재) |

**Cross-document result: PASS.**

## 회고 대조 — "이 스킬이 있었다면" (평가 루프 대체)

0188 의 실제 라운드를 새 SKILL 절에 대입했다. 사용자 합의로 subagent 평가 루프 대신 수행한다.

| 0188 파생 이슈 | 걸렸을 절 | 판정 |
|---|---|---|
| D9(r3) 만료가 `snapshot()` 에만 · D11(r4) `markExpired` 가 `void` | **§2** — plan §10 이 `commit·revoke·expiry·401/403` **4지점을 이미 열거**했다 | r3 에서 4/4 로 함께 닫혔을 것 |
| D16(r5)·D24(r7)·D28(r8)·D33(r10) 테스트가 경로 미진입 | **§3 마지막 불릿** — "가드를 지우면 실패하는지 한 번 확인" | 각 라운드에서 자체 검출 |
| D19(r6) vault 다단계 쓰기 · D22(r7) promote↔저장 창 | **§3 첫 불릿**(저장소 몇 곳) + **§6** (plan §13 에 분해 없음 → 되먹임) | 검출은 되나 **설계 수정이 필요** — Round 6 의 plan 다중 저장소 규칙과 짝이어야 완결 |
| D18(r6) 커밋 경쟁 · D29(r9) sweep 회귀 | **§5-3** — "이번 수정이 만든 새 표면" | 둘 다 직전 라운드 수정이 만든 것이라 정확히 걸린다 |
| D23(r7) superseded 가 UI 를 덮어씀 | **§4** — "늦게 도착한 응답이 화면을 되돌리지 않는가" | 검출 |
| D39(verify r1) 해제 실패가 화면에 안 뜸 | **§4 첫 불릿** — 만든 문구에 소비자가 있는가 | 검출 |
| D34(r10) durable commit 후 vault 예외 | §3(부분 실패 잔여) | 검출은 되나 원자성 축의 마지막 표면이라 §5-2 전수가 선행돼야 한다 |

**닫히지 않는 잔여**: 원자성 축은 impl 만으로 완결되지 않는다 — 구현자가 `§6` 으로 올려도 **설계가 그 분해를 받아야** 닫힌다. 그래서 Round 6 의 plan 규칙과 Round 7 의 impl 규칙은 **짝으로만 작동한다**. 이 사실을 한계로 기록한다.

## 게이트

`cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · links ok(broken 0). `.agents` 는 prose 스캔 제외이므로 skill 문서의 semantic integrity 증거로 쓰지 않는다(Round 3 이후 동일 한계).

## Round 7 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0** (KEEP 5 · MOVE 1 · KEEP-in-place 1 · DELETE 0).
- MOVE inbound semantic integrity: **N=1 · M=2 · 2/2 유지**.
- Historical Failure Regression: **38 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. P38 방어 지점 1 → 3.
- Cross-document Consistency: **PASS**.
- corpus 추가: **없음** — 이번은 새 실패가 아니라 P38 의 owner 를 만든 것이다.
- 한계: ① 원자성 같은 설계 축은 impl 되먹임 + plan 수용이 **짝으로만** 닫힌다 ② skill 을 읽지 못하는 구현 주체에게는 `docs/handoff/AGENTS.md §2` 최소 계약까지만 전달된다 — 그래서 게이트 정본을 옮기지 않았다.

## Round 7 보완 — 네 스킬 전수 재검토 (같은 세션)

신설 직후 네 SKILL 을 새 눈으로 다시 읽어 **owner 신설이 남긴 잔재**를 닫았다.

| 발견 | 판정 | 조치 |
|---|---|---|
| **trigger 충돌** — `handoff-plan` 이 "구현·리팩토링·버그수정 요청의 설계 진입점", `handoff-impl` 이 "구현·재구현 요청" 이라 **둘 다 '구현 요청' 에 걸렸다.** 실제 판별자는 *READY plan 의 존재* 인데 어느 description 도 그것을 말하지 않았다 | **A. Instruction gap** — 새 owner 를 만들면서 기존 owner 의 trigger 경계를 갱신하지 않았다 | plan: "아직 READY 인 plan 이 없으면 여기가 진입점"(+ 있으면 impl 로 넘김) · impl: "이미 READY 인 plan 을 코드로 옮기는"(+ 없으면 plan 이 먼저) · verify: "보드가 `impl/IMPL_DONE` 이고 다음 주체가 검증자면" + "외부 리뷰가 도착했어도 그것은 verify 가 아니다" |
| `handoff-review` description·본문 8곳이 **plan/verify 2스킬 시대 표현** | 사실 낡음 | 전수 갱신(`plan/impl/verify`). corpus 헤더 2줄도 같은 줄에서 치환해 **P 본문 line offset 을 보존**했다(`0173` 의 `:541-552` → P29 재확인, 실측) |
| verify `검증 순서` 블록 6번이 §6 의 신설 절(강제 지점 표 대조)을 반영하지 않음 | referential | `6. AC 1:1 검증 + plan §10 강제 지점 표 대조` |
| impl §5-3 이 §3 과 같은 검사를 다시 서술 | 중복 | §5-3 을 "§3 을 다시 돌린다" 로 바꿔 체크리스트가 두 벌이 되지 않게 함 |

**Tier 판정**: description 은 **trigger semantics** 이므로 **Tier 1**. 나머지는 referential.

- **6-A**: DELETE 0. description 은 전부 기존 문장을 유지한 채 판별 조건만 **추가**했다. 순서 블록·§5-3 은 본문 규칙 불변(가리키는 곳만 정확해짐).
- **6-B**: P1~P38 전수 **38 COVERED / 0 PARTIAL / 0 GAP**. trigger 를 좁힌 것이 아니라 **갈라 놓은 것**이라 어떤 P 의 방어도 발동 조건을 잃지 않는다. corpus line offset 보존 실측.
- **6-C**: 네 description 이 서로 배타적인 전제를 말한다 — plan(READY 없음) → impl(READY 있음) → verify(IMPL_DONE·검증자 차례) → review(지침 자체 변경·라운드 3 초과). `docs/handoff/AGENTS.md` 의 상태 머신과 같은 축이다. **충돌 0.**
- 게이트: doc-inventory exit 0.

---

# Round 8 — 자기보고에 관측값이 없었다 (0189)

사용자 요청(`/handoff-review 핸드오프189`)으로 수행했다. 0189 는 라운드 2 로 `verify/PASS` 했으므로
라운드 초과 트리거는 아니다 — 증거는 **0189 의 r1 FAIL 과 그것이 0187 r1 과 같은 형태였다는 사실**이다.

## 발견 1 (주 원인) — "닫았다"는 자기보고를 산출물에서 재현하지 않았다

| handoff | 자기보고 | 검증자 재측정 |
|---|---|---|
| 0187 r1 | `Criteria-Met: 16/16` | 13 ✅ / 2 ⚠️ / 1 ❌ |
| 0189 r1 | `Criteria-Met: 15/15` · 강제 지점 `7/7` | AC 13/15 · 강제 지점 5/7 충족 · 2 부분 |

0189 의 두 미충족(AC3 "연역" 표기 · AC12 축 3 `층` 열)은 **지침 부재가 아니었다.** 두 AC 다 `grep`
하나로 판정 가능한 문언이었고, 구현자 자신이 Review Signals 에 "지침 부재가 아니라 자기 대조에서
그 문언을 다시 읽지 않은 것" 이라고 적었다. 게이트(`check-doc-inventory`)는 초록이었다 — 그 게이트는
링크·인벤토리 수치만 보고 계약이 요구한 표기의 존재는 보지 않는다.

- 분류: **A. Instruction gap (coverage gap).** "exit code 가 아니라 **관측한 산출**을 적는다" 는 원칙은
  이미 있었지만 **발동면이 게이트 실행 하나**였다(impl §7 · verify §8). 강제 지점 전수표와 AC 자기보고는
  기억·의도로 채워도 지침을 어기지 않는다. B 가 아니다 — 정상 수행의 결과가 곧 근거 없는 ✅ 였다.
- **remedy 의 효과가 이미 실측됐다.** 0189 r2 는 스스로 전수표에 `재현 명령` 열을 만들고 모든 행을
  실행해 관측값을 적었다. 그 라운드의 자기보고는 검증자 재측정과 **일치**했다(15/15 · 23/23).
  round 8 은 그 장치를 지침으로 올린 것이지 새 규칙을 발명한 것이 아니다.

## 발견 2 — 다중 저장소 규칙의 발동 조건이 코드 전용으로 읽혔다

0189 r1 D1: 감사 결론이 `audit.md` 와 `INDEX.md` 보드 **두 곳**에 사는데 r2 개정이 앞의 것만 고쳐
보드에 **철회된 판정**이 현재형으로 남았다. 독자 흐름의 첫 칸이 보드라 독자는 철회본을 먼저 읽는다.

구현자 기록: *"§3 의 첫 질문은 코드에만 해당한다고 읽었는데, 문서 산출물에도 그대로 성립한다는 것이
이번 FAIL 로 드러났다."*

- 분류: **A. Instruction gap.** plan §6·impl §3·plan.template §13 의 예시가 전부 런타임 저장소
  (파일+키체인 · DB+외부 API)라, 문서 산출물에서는 규칙이 발동하지 않는다. 규칙을 정상 수행해도 막지 못한다.

## 발견 3 — 설계와 산출이 한 커밋이면 verify §0 이 무력화된다

0189 r1 은 `9a2980a` 가 `plan.md` 와 `audit.md` 를 함께 만들어 기준선 잠금이 diff 로 작동하지 않았다
(verify r1·r2 가 둘 다 그 사실을 적었다). r2 는 라운드가 갈려 정상 작동했다.

- 분류: **A. Instruction gap.** 어느 문서도 "plan/READY 커밋과 구현 산출 커밋을 분리하라" 를 요구하지
  않았고, verify §0 에는 **기준선이 없을 때 무엇을 적을지**가 없었다. 자기 증명 방지 장치가 조용히
  꺼진다는 것이 이 공백의 비용이다.

## 발견 4 — Round 7 MOVE 의 inbound 하나가 stale (지난 review 의 회귀)

corpus `P38` 말미가 **"구현 턴 자신의 방어"** 로 `docs/handoff/AGENTS.md §외부 피드백을 반영하는
재구현 턴` 을 가리키는데, 그 heading 은 Round 7 이 `handoff-impl/SKILL.md §5` 로 MOVE 했다.
Round 7 의 6-A 는 inbound 를 **N=1(root AGENTS.md)** 로 셌으나 **실제 N=2** 였다 — corpus 자신이
소비자였다. 같은 축으로 `handoff-review/references/failure-patterns.md`(진입점)와
`docs/handoff/AGENTS.md §handoff-review` 의 owner 목록에 **impl 이 빠진 2-skill 시대 표현**이 남아 있었다.

- 분류: **A(지난 라운드의 6-A 누락).** corpus 는 historical evidence 지만 이 문장은 *현재 방어의 소재지*를
  가리키는 포인터라 낡으면 독자를 없는 절로 보낸다.

## 발견 5~7 — 지침으로 닫지 않는 것

| 발견 | 분류 | 처리 |
|---|---|---|
| `app/node_modules` 부재로 lint/typecheck/vitest 실행 불가 — 0188 verify · 0189 impl r1 · verify r1 · impl r2 · verify r2 로 **5회** | **E. 환경 한계** | 지침 변경 없음. `app/AGENTS.md §제약 환경 게이트` 가 이미 분리 근거를 요구하고 0189 는 `app/**` 무변경이라 판정 영향 0 |
| 자기 검증 5중(0188 구현 · 0189 설계 · 구현 r1·r2 · 검증 r1·r2 전부 Claude Code) | **E. 한계** | 지침으로 못 닫는다. verify 가 메타 표에 사실로 적는 현재 관행 유지 |
| **문서 내 앵커 유효성을 어느 게이트도 보지 않는다**(`check-doc-inventory` 는 상대 *파일* 링크만) | **E. capability limitation** | 규칙 추가 안 함 — 0189 verify 가 지침 없이도 11/11 을 대조했고 실패가 발생하지 않았다. plan §4(앵커 grep)가 설계 축을 이미 덮는다. 게이트화는 스크립트 작업이며 이번 범위 밖 |

**D(사용자 변심) 0건** — 0189 는 D-001~D-009 가 전부 ACTIVE 로 유지됐고 AC 도 무변경이다. 실패 패턴으로
오염시킬 사용자 결정 변경이 없다.

## 보완 — 추가보다 교체·정밀화

| 대상 | 변경 | 성격 |
|---|---|---|
| `handoff-impl/SKILL.md §8` | **주 조치.** "닫았다고 적는 **모든 행**에 이번 턴에 재현한 관측값을 적는다 — §7 이 게이트 산출에 요구하는 것과 같은 규칙이고 적용면이 보고 전체(강제 지점 각 행 · `Criteria-Met` 각 AC · 계약이 요구한 표기)". 표식을 못 찾으면 ✅ 로 세지 않는다. 0187·0189 실측을 근거로 병기 | **REPLACE — 기존 원칙의 적용면 확장**(§7 문장은 그대로 둔다) |
| `plan.template.md` `[구현자 기입]` | 강제 지점 전수표에 **`재현 명령 / 관측` 열** 신설(0189 r2 가 만든 장치) · 구현 보고표에 **AC 자기보고 행** 신설 | template 필수 필드 |
| `docs/handoff/AGENTS.md §2` 최소 계약 | 기존 "`Criteria-Met` 은 자기보고" 불릿에 같은 요구를 이어 붙임 — skill 미가용 환경에도 전달된다 | REPLACE(불릿 수 불변) |
| `handoff-impl/SKILL.md §3` · `handoff-plan/SKILL.md` 구현 가능성 방어선 · `plan.template.md §13` | 다중 저장소 질문의 **발동 조건을 산출물 문서까지** 넓힘 — 판정·상태의 사본이 산출 문서와 `INDEX.md` 보드에 살면 두 곳 쓰기이고, plan 은 §10 강제 지점에 **사본 전부**를 적는다 | REPLACE(발동 조건 정밀화) |
| `handoff-plan/SKILL.md` 마무리 | "`plan/READY` 커밋은 구현 산출과 같은 커밋에 담지 않는다 — 설계자와 구현자가 같은 에이전트여도" + 이유(verify §0 이 diff 로만 작동) | 신규 1문장 |
| `handoff-verify/SKILL.md §0` · `verify.template.md §0` | 기준선이 diff 로 성립하지 않으면 **"확인했다" 대신 "확인할 수 없었다"** 를 적고 채점 기준 원문을 인용해 고정한다. template 에 판정 항목 1개 | REPLACE(기존 기준선 규칙의 미정의 구간을 채움) + template 필드 |
| `failure-patterns.corpus.md` P38 말미 | 현재 방어 소재지를 `handoff-impl/SKILL.md §5` 로 정정(MOVE 이력 병기) | 사실 정정 |
| `handoff-review/references/failure-patterns.md` · `docs/handoff/AGENTS.md §handoff-review` | owner 목록에 **impl** 추가(2-skill 잔재) | 사실 정정 |
| corpus | **P39 신설** — 새 causal class(주체=구현자 · 시점=보고 작성 · 증상=근거 없는 ✅)이자 §8 신설 규칙의 대표 evidence. **말미 append 로 P1~P38 line offset 보존** | corpus 추가 1건 |

**추가하지 않은 것**: 앵커 게이트 규칙(발견 7) · "자기 검증 금지" 류 규칙(E) · 0189 verify 가 남긴
비차단 파생 이슈 3건(D-A·D-B·D-C — 그 handoff 의 문서 위생이지 지침 결함이 아니다).

## Tier 판정

**Tier 1** — template 필수 필드 2건 추가 · 보고 evidence semantics 변경 · 커밋 분리라는 새 운영 규칙 ·
canonical owner 목록 정정. 애매하지 않다.

## 6-A Operational Instruction Delta

| 대상 | 기존 책임 | 판정 | 근거 |
|---|---|---|---|
| impl §7 게이트 evidence 규칙 | 게이트 산출을 exit code 대신 관측으로 | **KEEP** | 문장 무변경. §8 이 같은 규칙을 다른 적용면에 두고 §7 을 인용만 한다 |
| impl §8 보고 항목(변경 파일·실행 명령·게이트 산출·`N/M`·대상 커밋) | 보고 필수 항목 | **KEEP + 추가** | 기존 문단 그대로, 뒤에 evidence 요구를 덧붙임 |
| impl §3 첫 불릿(다중 저장소) | 코드 저장소 분해 요구 | **REPLACE** | 구 문장 전부 유지 + 문서 사본 축 추가. 구 규칙이 막던 실패(파일+키체인)는 그대로 막는다 |
| plan 구현 가능성 방어선의 다중 저장소 규칙 | 쓰기 지점 나열 → 지점별 관측 상태 → 허용 불가 조합 제거 | **REPLACE** | 동일. 문서 축은 §10 강제 지점 등록 의무로 이어진다 |
| plan.template §13 다중 저장소 항목 | 필수 프롬프트 | **KEEP + 추가** | "해당 없으면 해당 없음" 유지 |
| plan.template 강제 지점 전수표 | 4열(계약/지점/닫은 지점/남긴 곳) | **KEEP + 열 1 추가** | 기존 4열 전부 유지 |
| plan.template 구현 보고표 | 6행 | **KEEP + 행 1 추가** | 기존 행 전부 유지 |
| `docs/handoff/AGENTS.md §2` 최소 계약 8불릿 | 구현 턴 최소 계약 | **KEEP(1불릿 REPLACE)** | 불릿 수·순서 불변, `Criteria-Met` 불릿만 요구를 이어 붙임. **`#### 구현 게이트의 정본` 무변경** |
| verify §0 4불릿 | 기준선 잠금 | **KEEP + 1 추가** | 기존 4불릿 문자 그대로 |
| verify.template §0 항목 | 5항목 | **KEEP + 1 추가** | 기존 항목 전부 유지 |
| plan SKILL 마무리(INDEX 갱신·커밋 형식) | 마무리 절차 | **KEEP + 추가** | 커밋 trailer 정본(`docs/git-template.md`)을 옮기거나 복제하지 않았다 |
| corpus P38 본문 | historical evidence | **KEEP(말미 포인터만 REPLACE)** | P38 의 causal lesson·표·규칙 3개 무변경 |
| review entry point 사용 규칙 5불릿 | corpus 사용 정책 | **KEEP(1불릿 REPLACE)** | 금지 주체에 impl 을 더한 것뿐 |

**DELETE 0. 설명 없이 사라진 gate·command·reference 0건.** 게이트 명령은 한 줄도 바뀌지 않았다
(`app/AGENTS.md` 정본 · `.github/workflows/ci.yml` PR/CI scope 분리 유지).

### reference semantic integrity

- reference MOVE/REPLACE **없음**. 이번 라운드가 만진 reference 는 corpus 본문(append + 말미 1문장)과
  entry point 뿐이고 **경로 이동 0**.
- 호환 경로 `handoff-plan/references/failure-patterns.md` → corpus symlink **유지**. 그 경로로 읽은
  `## P<number>` = **39**(상한 하드코딩 없이 grep 전수).
- line-scoped inbound 재실측: `0173/plan.md` 의 `failure-patterns.md:541-552` → **여전히 P29 본문에 착지**
  (`sed -n '541,552p'` 로 확인). P39 를 **말미에 append** 했으므로 P1~P38 의 offset 이 이동하지 않는다.
- Round 7 이 놓친 inbound 를 이번에 닫았다: `docs/handoff/AGENTS.md §외부 피드백을 반영하는 재구현 턴`
  을 기대한 inbound **N=2**(root `AGENTS.md` · corpus P38), 기대한 semantic target **M=2**
  (① 재구현 턴 절차의 소재지 ② 게이트 정본의 소재지) → 현재 ① `handoff-impl/SKILL.md §5`
  ② `docs/handoff/AGENTS.md #### 구현 게이트의 정본` 으로 **2/2 유지**(문장 실물 확인).

## 6-B Historical Failure Regression

corpus 의 현재 `## P<number>` 를 전수 추출(상한 하드코딩 없음) — **P1~P39, 39개**.

- **39 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE.** 이번 변경은 어떤 P 의 방어 문장도 삭제·약화하지
  않는다(6-A 참조 — REPLACE 4건 전부 구 문장을 유지한 채 발동 조건을 넓혔다).
- 강화 5건:
  - **P37**(semantic 목표를 structural proxy 로 검증) — 지금까지 plan(AC 작성)·verify(채점)에만 방어가
    있었다. impl §8 이 **자기보고 자체**에 관측 요구를 걸어 세 번째 지점이 생겼다.
  - **P24**(구현자가 AC 재작성) — plan 커밋 분리 + verify §0 fallback 으로 기준선 잠금이 **실제로
    성립하는 조건**을 갖췄다. 지금까지는 잠금이 조용히 꺼져도 아무도 몰랐다.
  - **P15**(강제 지점 enforcement) — 열거(plan) → 전수 적용(impl) → 전수 확인(verify) 삼단에
    **각 지점의 재현 관측**이 붙었다.
  - **P13**(lifecycle 미전개) — 다중 저장소 질문이 문서 산출물까지 발동한다.
  - **P3**(숫자 stale/승계) — "이번 턴에 재현한 관측값" 요구가 보고 축에도 걸린다.
- **P39 신설.** 기존 P 로 덮이지 않는다 — P37 은 *AC 를 그렇게 쓴 설계자*, P39 는 *충족을 그렇게 보고한
  구현자*이고 발동 시점도 다르다. 0187·0189 두 handoff 재발이라 대표 evidence 조건도 만족한다.

## 6-C Cross-document Consistency

| 대조 | 결과 |
|---|---|
| root `AGENTS.md` ↔ `docs/handoff/AGENTS.md` ↔ 네 SKILL | 네 owner 서술 일치. root 의 단계별 스킬 문장 무변경(이번 변경이 owner 를 옮기지 않았다) |
| impl SKILL §8 ↔ `docs/handoff/AGENTS.md §2` 최소 계약 | 같은 요구를 같은 강도로 말한다. skill 미가용 환경도 evidence 요구를 받는다. **충돌 0** |
| impl §8 ↔ verify §4 | **면제 관계 아님** — impl 이 관측값을 붙여도 verify 는 여전히 다시 센다(`Criteria-Met`·`N/M` 을 증거로 받지 않는 §4 문장 무변경). 한쪽이 다른 쪽을 대체하지 않는다 |
| plan(§10 사본 전부 등록) ↔ impl(§3 진단·전수) ↔ verify(§6 표 대조) | 문서 사본 축에서도 열거 → 적용 → 재확인 삼단이 유지된다 |
| plan 마무리(커밋 분리) ↔ verify §0(기준선 없을 때) ↔ `docs/handoff/AGENTS.md` 라이프사이클 | 같은 축을 서로 보완한다 — 전자가 기준선을 만들고 후자가 없을 때의 정직한 표기를 정한다. 상태 머신(`plan/READY → impl/…`)과 충돌 없음 |
| template 명령 ↔ `app/AGENTS.md` ↔ `.github/workflows/ci.yml` | 게이트 명령 **무변경**. generic `npm test` 강제 없음, agent-loop/PR-CI scope 분리 유지 |
| review SKILL 완료 조건 ↔ 본문 | 이번 라운드가 완료 조건에 새 normative 요구를 넣지 않았다 — checklist-only rule **0** |
| review entry point ↔ corpus ↔ `docs/handoff/AGENTS.md` | 세 곳 모두 "정상 plan/impl/verify 는 corpus 를 읽거나 갱신하지 않는다" 로 일치(이번에 entry point·AGENTS 의 impl 누락을 정정) |
| `Handoff: none` 카브아웃 | 무관 — 이번 변경은 검증 면제를 만들지 않는다 |

**Cross-document result: PASS.**

## review 기록 정책

별도 `roundN-review.md` 를 **만들지 않았다.** 사용자는 검토를 요청했고 원문 보존을 요구하지 않았으며,
압축으로 잃는 rationale 도 없다 — 영구 결과는 위 지침 변경과 이 절이 갖는다. 기존 `round2-review.md`
1개 유지(동시 1개 규칙 준수).

## 게이트

`cd app && node scripts/check-doc-inventory.mjs --check` — generated doc ok (9 items, 76 channels) ·
prose ok · **links ok(broken 0)** · EXIT=0. `git diff --check` 출력 0.
`.agents` 는 prose 스캔에서 제외되므로 이 green 을 skill 문서 semantic integrity 의 증거로 쓰지 않는다
(Round 3 이후 동일 한계). semantic 판정은 위 6-A/6-B/6-C 의 실측이 근거다.

## Round 8 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0** — 대조 13행: 순수 KEEP 1 · KEEP+추가 7 · REPLACE 2 ·
  KEEP(내부 1항목만 REPLACE) 3 · **DELETE 0**.
- Reference semantic integrity: MOVE/REPLACE 0. 지난 라운드 누락분 **N=2 · M=2 · 2/2 복구**.
  호환 경로 `## P<number>` **39개** · `0173` line-scoped 인용 P29 착지 실측.
- Historical Failure Regression: **39 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 강화 5건.
- Cross-document Consistency: **PASS**.
- corpus 추가: **P39 1건**.
- 지침으로 해결할 수 없는 한계 3건: ① `app/node_modules` 부재(5회 반복) — 환경 ②자기 검증 겹수 —
  독립 감사자를 지침이 만들 수 없다 ③ **문서 앵커·두 산문 사본의 정합을 보는 게이트가 없다** — 이번엔
  지침(강제 지점 등록)으로 우회했으나 기계 강제는 스크립트 작업이며 별도 handoff 감이다.

---

# Round 9 — 산출물 문장 규칙과 합계 축 (0190)

2026-08-17. 사용자의 0190 review 요청 + 추가 요구("장황·AI native 문체 금지, 간결하게, 문제점은 사례와 함께").

## 발견

| ID | 발견 | 사례(관측) | 분류 |
|---|---|---|---|
| G1 | 산출물 문장 규칙이 없다. 길이·중복 상한이 커밋 본문에만 있었다 | 0190 보드 행 = 표 한 칸 **13,190자**(archive 최대 33,510자) · `plan.md` 59KB · `verify.md` 47KB. root `AGENTS.md`는 커밋 본문에만 "2~3줄" 상한을 갖는다 | **A** (+ 사용자 명시 요구) |
| G2 | 자기보고 **합계** 검산이 구현자 지침에 없다. 행 축은 P39 remedy 로 닫혔다 | 0190 r1 `16/17`→`13/17`→본문 `14/17`(verify D4). 같은 라운드의 강제 지점 25행은 재측정과 전부 일치. 0187 r1·0189 r1 도 합계 축 | **A** (coverage gap — P39 의 다른 발동 지점) |
| G3 | 합계가 사본마다 갈린다. trailer 는 고칠 수 없다 | 본문 `14/17` ↔ trailer `ddebfcf`·`8bbd595`·`c8fe300` `13/17` — 지금도 어긋난 상태 | **A** |
| G4 | READY self-review 체크박스에 관측 요구가 없다 | 0190 전 항목 `[x]` 아래에서 plan 결함 3건(AC8↔D-005 정면 모순 · AC1 두 축 혼동 · AC14 사실 오류) | **A** (P39 causal class 의 plan 표면) |
| G5 | 구현 보고의 대상 커밋 해시가 죽어 있었다 | 0190 D3 — `plan.md:496`·`:529` 의 `55cdbfe`, 실제 `8bbd595`. verify 가 잡았다 | **B** (plan §7.5 가 이미 요구) |
| G6 | DB/electron 바이너리 부재로 5스위트 상시 red, 4라운드 연속 | 0190 r1·r2 모두 실패 집합이 `app/AGENTS.md` 실측 목록과 집합 일치 — 분리 보고 규칙대로 처리됨 | **E** (지침으로 해결 불가) |

0190 의 나머지는 정상 작동이다. r1 FAIL 은 결함이 아니라 범위 미완이었고, 두 갈래를 사용자에게 올렸다(D1) — C 아님.

## 보완 — 추가보다 교체·확장

| 대상 | 변경 | 성격 |
|---|---|---|
| `docs/handoff/AGENTS.md` §산출물 문장 규칙(신설) | 판정 먼저 · 주장 한 줄에 관측 하나 · 표 한 칸 3줄/문단 3문장/INDEX 비고 5줄 · 금지 문체 · **간결함은 증거를 줄이는 근거가 아니다** | root 커밋 프로토콜(본문 2~3줄)을 나머지 산출물로 **확장** |
| root `AGENTS.md` 커밋 프로토콜 | 같은 원칙이 handoff 산출물 전체에 걸린다 + 정본 링크 | 링크만(복제 아님) |
| `docs/handoff/AGENTS.md` §2 최소 계약 · §INDEX 운영 | 합계 검산 + trailer 기입 순서 · 비고 5줄 | KEEP + 추가 |
| impl `SKILL.md` §8 | 합계 검산 4단계 · 문장 규칙 링크 · 커밋 해시 실재 확인 | KEEP + 추가 |
| plan `SKILL.md` §7 · READY | 정합성 1 에 **AC** 축 추가 · 교차검증 결과를 관측으로 · §문서 문장 규칙(조건절 원문 인용 포함) | REPLACE + 추가 |
| verify `SKILL.md` §4 · §9 · §문서 문장 규칙 | 합계/분모 재측정 + 사본 대조 · 비고 5줄 · 커밋 해시 실재 · 이전 라운드 판정 보존하되 재서술 금지 | KEEP + 추가 |
| review `SKILL.md` §7 · 완료 조건 | review 산출도 같은 규칙 — 규칙 한 문장 + 사례 한 줄 | KEEP + 추가 |
| 두 template | 상단 문장 규칙 · Ledger `ACTIVE↔AC` 대조 줄 · `합계 검산` 행 · 합계 재측정/사본 대조 · 비고·해시 항목 | 산출 surface 강제 |
| corpus | **P40 신설** — 합계 축 + 사본 갈림 | 새 발동 지점 |

G5 는 같은 문장을 반복하지 않고 **검증 명령**(`git show <hash> --oneline`)으로 바꿔 evidence 형태로 남겼다. G6 은 지침 변경 없음.

## Tier 판정

**Tier 1.** 새 normative 문장 규칙 · 보고 절차(합계·trailer 순서) · required template field 추가 → 6-A+6-B+6-C 전부 수행.

## 6-A Operational Instruction Delta

압축한 산문 5곳과 규칙 변경을 전수 대조했다. **DELETE 0.**

| 항목 | 판정 | 근거 |
|---|---|---|
| impl §책임 2문단(설계자↔구현자 수사) | KEEP | normative 문장 없음. 세 질문(저장 순서·화면·조기 반환)과 "다음 라운드가 같은 자리를 연다" 유지 |
| impl §5.3 꼬리절 | KEEP | "리뷰는 새 표면을 본 적이 없다" 유지. 수사만 축소 |
| impl §5 blockquote(0188) | KEEP | 원자성 5라운드·만료 정착 5·테스트 경로 4·표면 5목록·"성실히 수행해도" 전부 유지 |
| impl §8 blockquote(0187·0189) | REPLACE | 두 수치 유지 + 0190 추가. **0189 r2 positive control(`재현 명령` 열 → 15/15·23/23)을 압축 중 잃었다가 복구**했다 |
| handoff AGENTS §외부 리뷰 blockquote(0188) | REPLACE | 10라운드·r5 신설·라벨 준수·`Verified-By: pending`·거짓 PASS 0·r10 이후 결함 0건·"닫히지 않는 핸드오프" 유지. "라운드 6~10" 범위와 보드 인용문만 축소(normative 아님) |
| plan §7 항목 1 | REPLACE | 구 문장 유지 + AC 축 추가. 막던 실패(Decision↔본문 충돌)를 계속 막고 범위가 넓어짐 |
| 게이트 명령 정본(subtree AGENTS · ci.yml scope) | KEEP | 무변경. generic `npm test` 강제 없음 |
| INDEX lifecycle · commit trailer · archive 이동 | KEEP | 무변경. 비고 상한만 추가되고 상한은 **이번 턴에 갱신하는 행**에 한정 |
| corpus 소유권 · plan 호환 symlink | KEEP | 무변경. P40 은 **말미에 append** 하여 P1~P39 line offset 보존(0173 의 `:541-552` 인용 유지) |
| 사람 실기 경계 · 역방향 탐색 · 강제 지점 삼단 | KEEP | 무변경 |

**reference MOVE/REPLACE 0건** — 이번 라운드는 파일을 옮기거나 대체하지 않았다. inbound `N`/semantic `M/M` 재증명 불필요(corpus append 는 기존 heading 을 건드리지 않음, `^## P` **40개** 실측).

## 6-B Historical Failure Regression

corpus 의 `## P<number>` 전수 추출(상한 하드코딩 없음) — **P1~P40, 40개**. **40 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE.**

브레비티 규칙이 증거 요구를 약화할 수 있는 P 를 먼저 점검했다.

| 위험 P | causal lesson | 왜 약화되지 않는가 |
|---|---|---|
| P3·P4 | 숫자 재측정 · 전수 grep + N | 문장 규칙 5 가 관측값·전수 개수·재현 명령을 명시적 비압축 대상으로 못 박는다 |
| P2·P23·P33 | AC 측정 가능성 | AC 는 비압축 대상. plan §5 의 AC 게이트 무변경 |
| P13·P25 | lifecycle·순서 관측 | template 절 무변경. 규칙 3 은 "표로 가르거나 절을 나눈다" — 삭제가 아니다 |
| P18·P22 | 사람 실기 하치장 | verify 문장 규칙이 "못 본 것의 명시"를 비압축 대상으로 둔다 |
| P19·P36 | 앵커·외부 포트 문서 | 규칙 2 가 인용에 관측을 요구한다(강화) |
| P24 | 구현자가 AC 재작성 | **강화** — 분모 변경 기록 의무가 AC 분할에 흔적을 남긴다. verify §0 기준선 무변경 |
| P27·P32·P35 | 상한·구조 목표·총량 | 계산 결과는 관측이므로 비압축 대상 |
| P34 | "제거"를 "이동"으로 | **강화** — plan 문장 규칙에 "사용자 문장의 이유·조건절은 요약하지 않고 원문 인용" 추가 |
| P37·P39 | structural proxy · 자기보고 관측 | **강화** — P39 의 관측 요구가 plan READY 체크리스트(세 번째 표면)와 합계 축으로 확장 |

**P40 신설 근거**: P39 는 *행*에 관측이 없는 경우, P40 은 *행이 전부 맞는데* 합계·분모·사본이 갈리는 경우다. 발동 지점(표 아래 검산 줄, trailer 기입 시점)과 검사 방법(개수 세기, 사본 대조)이 다르고 0187·0189·0190 세 handoff 재발이라 대표 evidence 조건도 만족한다.

## 6-C Cross-document Consistency

| 대조 | 결과 |
|---|---|
| root `AGENTS.md` ↔ `docs/handoff/AGENTS.md` ↔ 네 SKILL | 문장 규칙의 정본은 handoff AGENTS 1곳. root·SKILL·template 은 링크 + 단계별 강조만. **복제 0** |
| handoff AGENTS 첫 문단("작성은 각 skill 정본") ↔ 신설 §산출물 문장 규칙 | 첫 문단에 "공통 문장 규칙은 본 문서" 를 명시해 owner 충돌 해소 |
| §산출물 문장 규칙 3 ↔ `INDEX.md:50`("아래 세 행의 긴 비고는 이력을 보존한다") ↔ §신규 템플릿 적용 경계 | 상한을 **이번 턴에 새로 쓰거나 갱신하는 문장**으로 한정. 기존 행 일괄 재작성 금지와 일치 |
| impl §8(합계 검산) ↔ verify §4(합계 재측정) | 면제 관계 아님 — 구현자가 검산하고 검증자가 다시 센다 |
| verify §9(비고 5줄·해시 실재) ↔ `verify.template.md` §11 | 같은 두 항목이 양쪽에 있고 문구 충돌 0 |
| plan §7·READY ↔ `plan.template.md` §3 갱신 메모·READY | 대조 결과를 적을 surface 가 template 에 실제로 있다(checklist-only rule 0) |
| review 완료 조건 ↔ 본문 §7 | 새 완료 항목이 §7 의 실행 규칙에 매핑된다 |
| template 게이트 ↔ `app/AGENTS.md` ↔ `.github/workflows/ci.yml` | 게이트 명령 무변경. scope 분리 유지 |
| `Handoff: none` 카브아웃 | 무관 — 검증 면제를 만들지 않는다. 이 라운드 자체가 Tier 1 을 수행했다 |

**Cross-document result: PASS.**

## review 기록 정책

별도 `roundN-review.md` 를 만들지 않았다 — 사용자가 원문 보존을 요구하지 않았고 압축으로 잃는 rationale 도 없다. 기존 `round2-review.md` 1개 유지(동시 1개 규칙).

## 게이트

`cd app && node scripts/check-doc-inventory.mjs --check` — generated doc ok(9 items · 76 channels) · prose ok · **links ok(broken 0)** · EXIT=0. `git diff --check` 출력 0. 새 링크 11개 전부 실물 대조(`docs/handoff/AGENTS.md` 착지). `.agents` 는 prose 스캔 제외이므로 이 green 을 semantic integrity 증거로 쓰지 않는다.

## Round 9 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0** — KEEP 7 · REPLACE 3 · **DELETE 0**. 압축 중 1건(0189 r2 positive control)을 잃었다가 같은 라운드에서 복구.
- Reference semantic integrity: MOVE/REPLACE **0건**. corpus append 로 P1~P39 line offset 보존.
- Historical Failure Regression: **40 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 강화 4건(P24·P34·P37·P39).
- Cross-document Consistency: **PASS**.
- corpus 추가: **P40 1건**.
- 지침으로 해결할 수 없는 한계: ① DB/electron 바이너리 부재(0190 4라운드 연속) — 환경 ② 문장 길이·사본 정합을 기계로 재는 게이트가 없다 — 이 라운드는 지침으로만 닫았고, 스크립트 강제는 별도 handoff 감이다 ③ 자기 검증 겹수(설계·구현·검증·review 전부 Claude).

---

# Round 10 — 0191 (라운드 4연속 동일 축)

## 발견 (주 원인) — 전수를 도구가 정의하면 `N/N` 은 언제나 성립한다

0191 은 "문서 인용이 실재한다" 를 grep 스윕으로 판정했고 매 라운드 전수 주장이 **사실이었다**(`20/20`
→ `47/47` → `211/211 · 미분류 0`). 그런데도 네 라운드가 같은 불변식에서 열렸다 — 지점 목록을 사람이
아니라 **도구가 만들었고, 도구가 못 보는 지점은 목록에 오르지 않는다.**

| 라운드 | 좁았던 층 |
|---|---|
| r1 | 추출 정규식 |
| r2 | 분류 단위(심볼 vs 사이트) |
| r3 | 실재 테스트(주석 줄) |
| r3 verify | 매칭 의미(substring) · 판정 축(버킷 vs 시제) · 토큰 형태(호출식) |

**분류 A(instruction gap).** `handoff-impl §3` 에 적대 검사가 이미 있었으나 *"내가 새로 만든 **테스트**"*
로 스코프돼 스윕에 닿지 않았다. `§8` 은 `grep 관측값` 을 증거로 명시 허용해 **눈먼 장치의 `0건` 이 그대로
증거가 됐다.** 규칙이 있었고 정상 수행했는데 실패를 막지 못했다.

부수 관측: r3 은 plan §10 에 "계측은 세 층이 각각 좁아질 수 있다" 를 **직접 써 넣은 라운드인데** 같은
라운드가 네 번째 층에서 좁았다. 층 열거는 해법이 아니다 — 새 규칙을 더하지 않고 적대 검사의 **스코프를
넓히는** 쪽으로 닫았다.

## 보완 — 추가보다 교체·확장

| 위치 | 조치 |
|---|---|
| `handoff-impl §3` | **REPLACE** — 적대 검사를 테스트 → 테스트·스윕·게이트 전반으로. "알려진 결함을 심어 실패하는지 확인". 구 문구(production 경로 진입·동명 재구현·가드 제거)는 승계 |
| `handoff-impl §8` | 정밀화 1문장 — 표식을 만든 장치를 이번 턴에 만들거나 고쳤으면 §3 적대 검사가 관측값의 전제 |
| `handoff-verify §8` | 불릿 1개 — 구현자가 이번 라운드에 만든 게이트는 검증 대상. **판정 기준을 한 단계 엄격하게 바꿔 재측정하고 차집합을 본다** |
| `handoff-plan` structural proxy | 불릿 1개 — **게이트의 완료 조건도 proxy 대상**. "전건 분류·미분류 0" 은 *분류했는가* 를 세지 *단언이 참인가* 를 세지 않는다 |
| `plan.template.md` 강제 지점 표 헤더 | 2줄 — 관측을 만든 장치의 적대 검사 결과를 함께 적는다(P39 remedy 가 쓰던 것과 같은 강제 surface) |
| `docs/handoff/AGENTS.md §2` | 최소 계약 1불릿 |

## Tier 판정

**Tier 1** — normative behavior(evidence 요건·owner 책임) 변경.

## 6-A Operational Instruction Delta

- **regression 0** — REPLACE 2 · KEEP 나머지 · **DELETE 0** · MOVE 0.
- REPLACE 승계 기계 확인: 구 문장의 semantic target **8/8 KEEP**(production 경로 진입 · 동명 로컬 재구현 ·
  의심이 닫힌다 · 닫았다 행 관측값 · §7 동일 규칙 · 강제 지점 각 행 · 산출물 표식 · ✅ 미계수).
- 일반화 초안이 "주장하는 production 경로에 실제로 진입" 을 지웠던 것을 **같은 라운드에서 6-A 가 검출해
  복구**했다.

## 6-B Historical Failure Regression

- **41 P 전수** · 변경 전 COVERED → 변경 후 **PARTIAL/GAP 0**.
- P38/P39/P40/P37 이 지목한 방어 지점 실재 확인 **8/8**(verify §2 · impl §5 · impl §8 · template 재현 명령
  열 · impl §8 합계 검산 · verify §4 · plan self-review · AGENTS §2).
- 강화 3건: **P37**(proxy 소비자에 게이트 완료 조건 추가) · **P38**(규칙 3 "고치면서 만든 것" 이 장치까지
  확장) · **P39**(관측값의 전제 명시).
- 인접하나 별개로 판정: **P30**(음성 게이트 술어가 너무 **뭉툭**해 정당한 잔존을 히트) ↔ P41(술어가 너무
  **느슨**해 결함을 못 봄) — 방향이 반대다. **P4**(대표 샘플 vs 전수 grep)는 *조사* 축이고 P41 은 *장치* 축.
- corpus 추가: **P41 1건**(새 causal class).

## 6-C Cross-document Consistency

- **PASS.** owner 분리 유지 — impl 이 자기 장치를 검사하고 verify 가 엄격화 재측정으로 다시 센다(review
  §5 "구현자가 닫고 검증자가 다시 센다" 와 정합).
- 모순 0 — impl §8(관측을 증거로) ↔ verify §4(구현자 관측을 증거로 받지 않음)는 층이 다르고, 이번 추가는
  impl 쪽 요건을 **강화**해 충돌을 늘리지 않는다.
- 게이트 명령 정본(`app/AGENTS.md`) 관련 문장 무변경 — 이번 라운드는 명령을 건드리지 않았다.
- root `AGENTS.md` 는 skill 을 절차 정본으로 가리키기만 하고 impl 계약을 재서술하지 않는다 → 갱신 불요.
- AGENTS 위생: 추가 1불릿에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md` 없음 → stub·루트 표 불요.

## review 기록 정책

`round10-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(교체 대상 아님).

## Round 10 결론

- Regression tier: **Tier 1**.
- Operational Instruction Delta: **regression 0** — REPLACE 2 · DELETE 0 · MOVE 0. 자기 검출·복구 1건.
- Reference semantic integrity: MOVE/REPLACE **0건**. corpus append 로 P1~P40 line offset 보존.
- Historical Failure Regression: **41 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 강화 3건(P37·P38·P39).
- Cross-document Consistency: **PASS**.
- corpus 추가: **P41 1건**.
- 지침으로 해결할 수 없는 한계: ① 게이트 자체의 눈을 기계로 재는 장치가 없다 — 이번에도 지침으로 닫았고,
  적대 검사를 CI 로 강제하려면 별도 handoff 가 필요하다 ② electron 바이너리 부재(0191 3라운드 연속) — 환경
  ③ 자기 검증 겹수(설계·구현·검증·review 전부 Claude) — 0191 은 여기에 **같은 세션이 구현과 계측을 함께
  만든** 형태가 겹쳤다.

---

# Round 11 — 0191 (라운드 5~6, 같은 축 6연속)

## 발견 — 적대 검사가 지적한 사람의 시야를 물려받는다

round 10 이 넣은 "고친 장치에 결함을 심어 확인" 은 **발화했다** — r4 가 죽은 `\b` 술어를(산출 47→98),
r5 가 `ChatEvent` 부분 문자열을 그 검사로 잡았다. 그런데도 두 라운드가 더 열렸다. **매 라운드가 그
라운드에서 고친 지점에만 결함을 심었기 때문이다.**

| 라운드 | 좁았던 지점 | 심어진 지점 |
|---|---|---|
| r4 | 비교 방식(경로 축) | 같음 |
| r5 | 비교 방식(심볼 축) | 같음 |
| r5 verify | **대상 집합**(`$CORPUS` 가 `*.test.ts` 를 프로덕션 실재로 셈) | 없음 |

**분류 A(instruction gap) ×3.** 세 건 모두 규칙이 있었고 정상 수행했는데 실패를 막지 못했다.

| # | 실패 | 있던 지침 | 왜 못 막았나 |
|---|---|---|---|
| I2 | 코퍼스 경계가 테스트 파일을 프로덕션으로 셈 | impl §3 적대 검사 | "알려진 결함을 **하나**" 가 고친 지점 하나로 스코프됐다 |
| I1 | plan 메타 상태줄이 갱신됐다고 적힌 채 안 바뀜 | impl §8 관측값 요구 | 적용면이 *보고의 행* 이라 **턴이 갱신한 상태 사본**에 닿지 않았다 |
| J1 | 같은 표의 형제 행 비대칭 | impl §5-2 전수 | 열거가 코드 형태(mutator·await)뿐이라 **문서의 형제 축**이 없었다 |

## 조치 — 추가 0 · REPLACE 4

| 위치 | 조치 |
|---|---|
| `handoff-impl §3` | **REPLACE** — "알려진 결함 하나" → **장치의 판정 지점을 세어 지점마다 하나씩**. 스윕의 지점 5종(대상 집합·추출·비교·실재 판정·분류 단위) 명시 + 0191 6라운드 사례 1줄 |
| `handoff-impl §5-2` | 열거 확장 — 문서면 **같은 표의 다른 행 · 형제 절 · 같은 이름을 인용하는 다른 문서** |
| `handoff-impl §8` | 적용면 확장 — **이번 턴이 갱신한 상태 사본**(plan 메타·INDEX 행)도 재확인 대상 |
| `plan.template.md` · `docs/handoff/AGENTS.md` ×2 | 위 두 규칙을 최소 계약·template 헤더에 반영 |

**corpus 추가 0** — 새 causal class 가 아니라 **P41 의 remedy 가 좁았던 것**이므로 P41 을 보강했다(P 총수 41 유지).

## Tier 판정

**Tier 1** — normative behavior(evidence 요건·적대 검사 범위) 변경.

## 6-A Operational Instruction Delta

- **regression 0** — REPLACE 4 · KEEP 나머지 · **DELETE 0** · MOVE 0.
- REPLACE 승계 기계 확인: 구 문장의 semantic target **15/15 KEEP**(production 경로 진입 · 동명 로컬
  재구현 · 타입만 빌려옴 · 추출 정규식 · 주석 줄 실재 · 침묵 · `0건` 비증거 · mutator 호출부 · 형제 연산 ·
  `await` 경로 · 강제 지점 각 행 · `Criteria-Met` 각 AC · 계약 표기 · 산출물 표식 · §3 선행 통과).
- 게이트·명령·reference 이동 0 — `app/AGENTS.md` 무변경.

## 6-B Historical Failure Regression

- **41 P 전수** · 변경 전 COVERED → 변경 후 **PARTIAL/GAP 0**.
- 직접 관련 4건의 방어 지점 실재 재확인: **P38**(impl §5, 이번에 문서 축으로 확장) · **P39**(impl §8,
  이번에 상태 사본으로 확장) · **P40**(impl §8 합계 검산 — r5 는 세 사본 일치로 통과) · **P41**(impl §3,
  이번 REPLACE 의 대상).
- 이번 라운드의 세 실패는 각각 P41(I2) · P39(I1) · P38(J1)의 재발이고, 셋 다 **기존 P 의 remedy 를
  넓히는 것으로 닫았다** — 새 P 를 만들지 않았다.

## 6-C Cross-document Consistency

- **PASS.** 새 규칙을 말하는 normative 사이트 4곳(impl §3 · template 헤더 · AGENTS §2 ×2)이 같은 문장을 쓴다.
- owner 분리 유지 — **impl 이 판정 지점마다 심고, verify 가 판정 기준을 한 단계 엄격화해 차집합을 본다**.
  두 규칙은 같은 축의 다른 수단이고 서로를 면제하지 않는다(r5 verify 가 실제로 그렇게 I2 를 잡았다).
- root `AGENTS.md` 는 impl 계약을 재서술하지 않고 skill 을 가리키기만 한다 → 갱신 불요.
- 잔존 "알려진 결함" 문자열 5건은 전부 **기록**(`regression-coverage` round 10 항목 · 0191 plan 의 r4/r5 보고)이고
  normative 사본이 아니다.
- AGENTS 위생: 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md` 없음 → stub·루트 표 불요.

## review 기록 정책

`round11-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지.

## 지침으로 해결할 수 없는 한계

- 0191 의 계측은 **plan §19 안에 인라인 셸로 산다** — 라운드마다 손으로 다시 패치된다. 스크립트 파일로
  뽑아 지점별 self-test 를 붙이는 것이 근본책이지만 그것은 별도 handoff 감이다.
- electron 바이너리 부재(r1~r5 동일 서명) — 환경.
- 자기 검증 겹수(설계·구현·검증·review 전부 Claude Code).

---

# Round 12 — 0191 (라운드 6, 축이 처음 갈렸다)

## 발견 — 재현했는데 반증할 수 없는 것을 재현했다

r6 은 여섯 라운드 만에 **계측 축이 닫힌** 라운드다. 코퍼스 엄격화 차집합 0 · 적대 검사 배터리가
검증자 재현에서도 작동 · 정정 4건 전부 코드 대조 통과. FAIL 사유는 계측이 아니라 **보고의 증거**였다.

| # | 실패 | 있던 지침 | 왜 못 막았나 | 분류 |
|---|---|---|---|---|
| L1 | `미분류 0` 을 `버킷 합 = 총계` 로 증명 — 실제 차집합 2사이트 | impl §8(모든 "닫았다" 행에 관측값) | 합계는 **관측값이 맞다**. 다만 총계에 맞춰 배분한 값이라 **반증할 수 없다** | **A** |
| M1 | 실재 판정이 줄머리만 봐 후행 주석을 코드로 셈(차집합 4, 문서 결함 0) | impl §3(판정 지점마다 심기) · verify §8(엄격화 재측정) | 지점 5의 probe 가 **쉬운 형태**(줄머리 주석)를 썼다. 어려운 형태는 verify 엄격화가 잡았다 | **지침 변경 없음** |

**M1 에 규칙을 더하지 않는다.** impl 이 심고 verify 가 엄격화해 차집합을 보는 분업이 설계대로
작동한 사례다 — "더 어려운 형태를 심어라" 는 상한이 없고, verify 의 backstop 을 impl 에 복제한다.

## 조치 — 추가 0 · REPLACE 1

| 위치 | 조치 |
|---|---|
| `handoff-impl §8` | **REPLACE** — "관측값을 적는다" 에 **완결성 주장의 관측값은 차집합**을 정밀화. `전건`·`미분류 0`·`잔여 0` 은 총계·합계로 증명되지 않는다 + 0191 r5·r6 사례 1줄 |
| `plan.template.md` 강제 지점 헤더 · `docs/handoff/AGENTS.md §2` | 같은 문장 1줄씩 |

**corpus 추가 0** — 새 causal class 가 아니라 **P39 의 remedy 가 한 층 얕았던 것**이다(P39 = 재현하지
않고 적음 → 보강 = 반증 불가능한 것을 재현함). P 총수 41 유지. **P40 과 방향이 다르다** — P40 은 합계가
틀린 경우, 여기는 합계가 맞는데 무의미한 경우다.

## Tier 판정

**Tier 1** — normative evidence 요건 변경.

## 6-A Operational Instruction Delta

- **regression 0** — REPLACE 1 · 추가 2줄 · **DELETE 0** · MOVE 0.
- 구 문장 semantic target **9/9 KEEP**(닫았다 모든 행 · 강제 지점 각 행 · `Criteria-Met` 각 AC · 계약 표기 ·
  상태 사본 · 산출물 표식 · ✅ 미계수 · §3 선행 통과 · 판정 지점마다 심기).
- 게이트·명령·reference 무변경 — `app/AGENTS.md`·`.github/` diff 0.

## 6-B Historical Failure Regression

- **41 P 전수** · 변경 전 COVERED → 변경 후 **PARTIAL/GAP 0**. 이번 변경은 evidence 요건 **추가**뿐이라
  방어 약화 경로가 없다.
- corpus 가 이름 붙여 가리키는 앵커 전수 실재 확인 — impl §2~§8 · verify §2~§9 · template 강제지점 표 ·
  `AGENTS.md §2` 전부 resolve.
- 보강 1건: **P39**(자기보고 재현 → 반증 가능한 재현).

## 6-C Cross-document Consistency

- **PASS.** 새 규칙이 normative 3사이트(impl §8 · template 헤더 · AGENTS §2)에 같은 문장으로 있다.
- owner 분리 유지 — impl 이 **차집합으로 증명**하고 verify 가 **다시 센다**(verify §4). verify §7 의
  `내역 합 = 총계` 는 P40 의 합계 축이고 이번 규칙은 membership 축이라 충돌하지 않는다.
- root `AGENTS.md` 는 evidence 계약을 재서술하지 않는다(`관측값|차집합|미분류` **0건**) → 갱신 불요.
- AGENTS 위생: 추가 1절에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md` 없음.

## review 기록 정책

`round12-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.

## 지침으로 해결할 수 없는 한계

- **0191 의 계측이 `plan §19` 안의 인라인 셸이다** — 여섯 라운드째 손으로 재패치됐다. 지점별 self-test 를
  붙인 스크립트 파일로 뽑는 것이 근본책이고 **별도 handoff 감**이다(round 11 에서 같은 기록).
- electron 바이너리 부재 — r1~r6 동일 서명. 환경.
- 자기 검증 겹수(설계·구현·검증·review 전부 Claude Code).


# Round 13 — 0194 (라운드 3, AC18 3연속 · 지점 과소계수 4연속)

## 발견 — 저작자와 채점자가 같으면 그 행은 아무도 안 본다

r3 의 두 실패는 같은 문장이다. **구현자가 규범 행을 쓰고 같은 턴에 그 행에 자기 합격을 매겼다.**

| 자리 | 구현자가 쓴 것 | 실제 | 누가 잡았나 |
|---|---|---|---|
| AC18 | "부팅 방송은 `1 + K + 1` 이다" | 첫 항이 조건부 — `probeTargets.length > 0` 일 때만 | verify r3 (`auth-resume.test.ts:750` 이 `1` 을 단언) |
| §10 신설 행 | 지점 수 `1` → `1/1` 보고 | 형제 조립 지점 셋 (`login.ts:605`·`:783`·`:840`) | verify r3 (`GrantBase` 에 필드를 심어 깨진 좌표가 하나뿐임을 실측) |

최초 작성은 `plan §5 AC 게이트` + READY self-review 를 통과하는데 **정정은 어느 게이트도 통과하지
않는다.** 한 커밋에 섞인 것이 이것을 가렸다 — r3 은 AC 정정과 구현을 `3371df2` 하나에 담았고,
verify §0 의 기준선 잠금이 이번 라운드에 작동하지 않았다.

**A (coverage gap).** `handoff-plan` 마무리에 커밋 분리 규칙이 이미 있었으나 발동 조건이
**`plan/READY` 커밋**으로만 적혀 verify/FAIL 후 정정에 걸리지 않았고, `handoff-impl` 에는 아예
없어 정정을 실제로 수행하는 구현자가 읽지 못한다. *형제 지점을 못 찾은 것 자체는 **B** —
`impl §5.2` 가 이미 전수 검색을 지시한다. 같은 문장을 반복하지 않고 evidence 요구만 더했다.*

## 조치 — 추가 0 · REPLACE 3 · 미러 2 · 어휘 1

| 사이트 | 판정 | 내용 |
|---|---|---|
| `handoff-plan/SKILL.md` 마무리 | REPLACE | 발동 조건 `plan/READY 커밋` → **`plan 의 규범 행(Decision·AC·§10)을 바꾸는 커밋`** |
| `handoff-plan/SKILL.md` §verify/FAIL 후 갱신 | REPLACE | 고쳐 쓴 AC 행은 **§5 AC 게이트 + READY self-review 의 AC 항목을 다시 통과**시킨다 |
| `handoff-impl/SKILL.md` §2 | REPLACE | 구현자가 §10 에 행을 신설하면 **지점 수도 전수 검색으로 세고 검색 명령을 적는다** |
| `handoff-impl/SKILL.md` §6 · `docs/handoff/AGENTS.md` §2 | 미러 | 승인받은 규범 행 정정은 구현과 다른 커밋 (정본은 plan SKILL) |
| root `AGENTS.md` · `docs/git-template.md` | 어휘 추가 | `Status: designed` — 설계 전용 커밋이 자기를 정확히 말한다 (사용자 선택. verify 0194 r1 §11 이 review 로 넘긴 항목) |
| `failure-patterns.corpus.md` | 신설 | **P42** — 저작자=채점자. P24(승인 없이 재작성)·P41(도구가 전수 정의)과 다른 causal class |

## Tier 판정

**Tier 1** — trigger(커밋 분리 발동 조건)·evidence(신설 행의 분모)·게이트 적용 범위(정정 AC)가
바뀐다. `Status: designed` 는 같은 커밋에 실렸으므로 함께 Tier 1 로 다룬다.

## 6-A Operational Instruction Delta

- **regression 0** — 삭제 줄 **1건**뿐이고 REPLACE 다. DELETE 0 · MOVE 0.
- 구 문장(`plan/READY 커밋은 구현 산출과…`) semantic target **4/4 KEEP** — READY 커밋 명시 ·
  verify §0 이유절 · 설계자=구현자 적용 · 0189 r1 근거. `AC를 고쳤는지` → `기준을 고쳤는지` 로
  **넓혔고** 좁히지 않았다.
- `Status` 는 기존 4값의 의미·소비자 무변경이고 값 1개 **추가**뿐이다.
- 게이트·명령·CI·`plan.template.md`·`verify.template.md`·`handoff-verify/SKILL.md` **diff 0**.

## 6-B Historical Failure Regression

- **42 P 전수**(P42 포함) · 변경 전 COVERED → 변경 후 **PARTIAL/GAP 0**. 변경이 순수 강화라
  방어 약화 경로가 없다.
- corpus 가 이름 붙여 가리키는 앵커 **12/12 resolve** — `plan §10`·`§11` 은 SKILL 이 아니라
  `plan.template.md:197`·`:207` 로 해석된다.
- `Status: designed` 는 **어휘 추가**라 6-B 방어 약화 경로가 없다 — 기존 4값을 소비하는 규칙
  (구현 커밋 판별 · 검증 커밋 판별)이 그대로다. 전수는 위와 같은 패스에서 함께 확인했다.

## 6-C Cross-document Consistency

- **PASS.** 커밋 분리 규칙 사이트 **3**(정본 `handoff-plan/SKILL.md` + 미러 `handoff-impl §6` ·
  `docs/handoff/AGENTS.md §2`). root `AGENTS.md` 는 이 규칙을 **재서술하지 않는다**(사본 0).
- `Status` 정본 **2곳이 같은 값** — `AGENTS.md:74` · `docs/git-template.md:62`. 사용 규칙도 양쪽에
  설계 커밋 줄이 있다.
- `git-template.md` 의 파싱 규칙 문장을 **두 갈래 → 세 갈래**로 고쳤다 — 값 추가가 그 문장을
  낡게 만들었고, 같은 커밋에서 닫았다.
- owner 분리 유지 — 구현자가 정정을 **제안·수행**하고, verify §0 이 **기준선이 diff 로
  성립하는지 다시 본다**. `Handoff: none` 카브아웃 무변경.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md` 없음.

## review 기록 정책

`round13-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.

## 지침으로 해결할 수 없는 한계

- **자기 검증 겹수** — 0194 는 설계·구현·검증·review 가 전부 같은 에이전트다. r3 의 두 실패는
  둘 다 "같은 턴 안에서 자기 산출을 자기가 채점" 이 원인이고, 커밋 분리는 그것을 *관측 가능하게*
  만들 뿐 없애지 못한다.
- electron 바이너리 부재 — 0194 r1~r3 동일 서명. 환경.

---

# Round 14 — 0194 (라운드 4, AC18 4연속 · 지점 과소계수 5연속)

## 발견 — 식을 이미 가진 관측 지점에서 유도하면 그 지점이 못 보는 항은 반증되지 않는다

round 13 의 규칙 셋은 r4 에서 전부 지켜졌다 — 정정이 설계 커밋(`23ac69f`)으로 갈려 verify §0 의
기준선 잠금이 작동했고, §10 신설 행은 검색 명령을 달았고, 분모 정정(`1→3`)도 실제로 닫혔다
(강제 지점 **20/20**). 그런데 같은 두 축이 다시 열렸다.

| 자리 | 쓴 것 | 실제 | 왜 정상 수행으로 못 막나 |
|---|---|---|---|
| AC18 · `auth.md §5.2` | 부팅 방송 총량 `P + K + 1` | refresh 회복 성공이 같은 `pushConnectionState` 를 2회 더 낸다(`login.ts:586`·`:587`) | 관측 지점(fake)이 프로덕션 두 호출자(`bootstrap.ts:376`·`:404`) 중 하나만 모형한다 — **못 보는 항은 그 지점에서 반증될 수 없다** |
| §10 8행 전수 강제 | `3/3` · 표 밖 `0건` | `store-parse.ts:37`·`:41`·`:52` 가 같은 `GrantBase` 를 스프레드로 조립 | 두 수의 술어가 **해법의 이름**(`compact<`)이라 고친 지점만 분모에 오른다. MV-A 결함 심기는 집합 *안*의 감도만 증명한다 |

**둘 다 A (coverage gap).** 지침은 있었고 정상 수행했으나 실패를 차단하지 못한다 — plan §5 는
관측 지점을 *적으라*고만 했고, impl §2 는 전수 검색을 *하라*고만 했다. 산문 정본에서도 같은 축이
열렸다: r4 는 "횟수를 적는 문장은 조건을 함께 적거나 숫자를 적지 않는다" 를 불변식으로 올려 사본
10건을 정리했는데, **그 불변식을 낳은 정본 문장**이 조건 빠진 총량을 같은 턴에 새로 단언했다.

*verify r3 §4 의 `.resuming` 재측정 오류(D17)는 **B** — "산출물에서 표식을 다시 찾는다" 는 이미
충분히 명확하다. 같은 문장을 반복하지 않는다. D6·D10·D18·D20 의 "보고만" 처리는 정상 동작이고,
Decision Ledger 무변경·SUPERSEDED 0 이라 **D 유형(사용자 변심) 오염 0**.*

## 조치 — 추가 0 · REPLACE 6줄 / 5규칙 사이트 · 신규 P 0

| 사이트 | 판정 | 내용 |
|---|---|---|
| `handoff-plan/SKILL.md` §5 | REPLACE | `N회`·총량 식은 **sink 의 프로덕션 호출부를 전수로 세어 항에 매핑한 뒤** 관측 지점을 적는다. 관측 지점이 일부만 모형하면 단언 범위를 그 주체가 스스로 내는 호출로 좁힌다 |
| `plan.template.md` AC 검증 주의사항 | REPLACE | `N회/순서` 필드를 `N회/총량` 으로 — **검색 명령 + 개수 → 항 매핑 · 모형하지 않는 호출부**를 필수 기입으로. 순서 기준 필드는 그대로 |
| `handoff-impl/SKILL.md` §2 | REPLACE | 전수 검색의 **술어는 불변식의 주어** — 해법의 이름이 아니다. 결함 심기는 집합 안의 감도만 증명한다 |
| `handoff-impl/SKILL.md` §5.2 | REPLACE | 전수는 **불변식을 낳은 문장 자신부터** — 사본만 고치면 그 규칙은 태어난 자리에서만 계속 깨진다 |
| `docs/handoff/AGENTS.md` §2 | 미러 | 위 두 impl 규칙의 최소 계약 1줄씩 (정본은 impl SKILL) |
| `failure-patterns.corpus.md` | 보강 | **P41 · P42 에 각각 한 블록** — 새 P 신설 0. 같은 causal class 의 재발이라 사례를 새로 쌓지 않는다 |
| `handoff-verify` | 변경 0 | verify 는 r1~r4 를 **매 라운드 잡았다**(§4 `N회` 실제 관측 주체 · §6 표 밖 지점). 작동하는 규칙을 중복하지 않는다 |

## Tier 판정

**Tier 1** — plan/impl 의 normative behavior(evidence 요구·전수 술어·전수 범위)와 template 필수
필드가 바뀐다. Tier 2 조건(실행 의미 불변)에 해당하지 않는다.

## 6-A Operational Instruction Delta

- **변경 줄 6개(SKILL 정본 3 — plan §5 1 · impl §2·§5.2 2 · 템플릿 1 · 미러 AGENTS 2) 전부 REPLACE · DELETE 0 · MOVE 0 · regression 0.** 설명 없이 사라진
  gate·command·reference **0건**. 명령·게이트·CI·`verify.template.md`·`handoff-verify/SKILL.md` **diff 0**.
- `plan/SKILL.md:147` semantic target **2/2 KEEP** — ① 관측 지점 기재 요구 ② `호출 지점 grep ≠ sink
  총호출 횟수` 문구(같은 파일 `:217` 0190 사례가 이 문구를 인용한다). 요구를 **넓혔고** 좁히지 않았다.
- `plan.template.md:111` semantic target **2/2 KEEP** — N회 관측 지점 · **순서 기준 관측 지점**(P25 방어).
- `handoff-impl/SKILL.md:65` **4/4 KEEP** · `:97` **4/4 KEEP** — 기존 문장 전문 보존 후 절 추가.
- reference/script **MOVE·REPLACE 0건** — inbound `N`/semantic `M/M` 대상 없음.

## 6-B Historical Failure Regression

- **42 P 전수** · 변경 전 COVERED → 변경 후 **PARTIAL/GAP 0 · OBSOLETE 0**.
- 변경이 닿은 방어 지점은 6줄뿐이므로 판정을 둘로 나눠 확인했다.
  - **방어 지점이 바뀐 5건** — P2(측정 가능 AC)·P25(순서 관측 지점)·P37(structural proxy)·P38
    (전수 지점)·P41/P42(전수 술어·규범 행): 위 6-A 의 semantic target 보존으로 **COVERED 유지**.
    P25 는 템플릿에서 순서 필드가 살아 있음을 diff 로 확인했다.
  - **나머지 37건** — 방어 문장이 이번 diff 에 없다(변경 줄 6개 전수 열거로 확인). 규칙 삭제·축소가
    없으므로 방어 약화 경로가 존재하지 않는다.
- 새 보강 블록이 이름으로 가리키는 앵커 **12/12 resolve** — plan §5·§마무리·§"verify/FAIL 후 plan
  갱신" · impl §2·§3·§5.2·§6·§8 · verify §0·§4·§6·§8(엄격화 재측정은 §8 하위 "자기 게이트 실행도
  §4의 대상이다") · `plan.template.md` AC 검증 주의사항.

## 6-C Cross-document Consistency

- **PASS.** 술어 규칙 사이트 **2**(정본 `handoff-impl §2` + 미러 `docs/handoff/AGENTS.md §2`),
  원본-우선 규칙 사이트 **2**(정본 `handoff-impl §5.2` + 같은 미러). root `AGENTS.md` 는 두 규칙을
  재서술하지 않는다(사본 0) — 변경 없음.
- **owner 충돌 0** — 설계가 식을 유도하고(plan §5 + template), 구현이 지점을 닫고(impl §2·§5),
  검증이 다시 센다(verify §4·§6·§7). 어느 쪽도 상대를 면제하지 않는다.
- template 이 명령을 새로 하드코딩하지 않는다 — `app/AGENTS.md` 게이트 정본·`.github/workflows/ci.yml`
  과 **scope 충돌 0**.
- `Handoff: none` 카브아웃은 검증 면제가 아니다 — 본 review 는 handoff 인프라 메타 수정이므로
  `Handoff: none` 직접 커밋이되 Tier 1 전 축을 수행했다.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.
- INDEX/commit trailer 규칙 **무변경** — 삭제 0.

## review 기록 정책

`round14-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개).

## 지침으로 해결할 수 없는 한계

- **자기 검증 겹수** — 0194 는 설계·구현·검증·review 가 전부 같은 에이전트다. 이번 두 실패도 저자가
  자기 관측 지점 안에서 자기 식을 확인한 것이 뿌리이고, 지침은 유도 경로를 바꿀 뿐 저자를 바꾸지 못한다.
- **산문 정본에는 기계 눈이 없다** — `auth.md §5.2` 같은 문장은 테스트가 직접 잠그지 못한다. 이번
  규칙은 유도 절차를 요구할 뿐이고, 최종 방어는 verify 의 재측정이다(r1~r4 전 라운드가 그 자리에서 잡혔다).
- electron 바이너리 부재 + better-sqlite3 ABI — 0194 r1~r4 · 0193 동일 서명, 차집합 양방향 0. 환경.

---

# Round 15 — 0198 (라운드 3, verify/FAIL 후 재구현 · AC4 2연속)

## 발견 — 방어는 있었는데 발동 조건이 이번 라운드 종류를 부르지 않았다

r3 은 verify r2 의 파생 이슈 D1~D10 을 전건 `closed` 로 보고했고, 그중 일곱은 실제로 닫혔다
(검증자 변이 6건 중 5건이 잡힘). 갈린 셋은 **전부 같은 형태** 다 — 지목된 지점만 닫았다.

| 파생 이슈 | 닫은 것 | 남은 것 | 왜 정상 수행으로 못 막나 |
|---|---|---|---|
| D1 (AC4) | `model-parser.ts` 의 first/last | runtime producer 는 여전히 배열 첫 항목이 default (5배열 중 3 갈림) | 행의 `대응 방향`("첫 항목 탐색으로 교체")이 인용된 AC4 보다 좁고, 그 칸의 권위가 어디에도 없다 |
| D8 (D-007) | `agent:list` 의 key 병합 | 형제 소비처 `turn-setup.ts:52` 는 concat + `find` 라 settings 행을 쓴다 | §5.2 가 형제 지점 전수를 요구하지만 §5 첫 문장이 이 라운드 종류를 부르지 않는다 |
| D10 | plan 본문 해시 `7fb771f`→`803bd50` | `INDEX.md` 대상 커밋 칸의 `fb04047` (부재 해시) | 같음 — 같은 좌표의 다른 사본 |

**A (coverage gap).** 방어는 `handoff-impl §5`(P38)에 이미 셋을 전부 덮게 적혀 있는데 **첫 문장의
발동 조건이 "외부 PR 리뷰·사용자 지적" 이었다** — P38 의 증거(0188)가 verify 턴 0회인 handoff 라
verify/FAIL 라운드가 문면에 들어간 적이 없다. 곁따르는 원인은 `대응 방향` 칸의 권위 부재다.

**두 번째 A — 보고된 설계 대비 차이가 AC 로 되돌아오지 않았다(신규 P43).** 구현은 plan 이 지정한
전용 catalog cache 를 기존 `HarnessRuntimeConfigService` cache 로 바꾸고 그 차이를 정직하게 적었다.
대체물에만 있는 `validUntil` 만료가 AC13·§10 4행을 깨는데, **보고된 차이를 AC 로 재유도하는 단계가
어느 스킬에도 없었다** — verify r2 도 그 차이를 "타당" 으로 적고 AC13 을 ⚠️ 로 넘겼다.

*B 로 판정해 지침을 늘리지 않은 것 셋: 규범 행 정정이 구현 커밋에 혼입(impl §6 에 규칙 있음) ·
`INDEX.md` 죽은 해시(impl §8 "이번 턴이 갱신한 상태 사본") · AC7 변이 미검출(impl §3 "판정 지점마다
하나씩"). Decision Ledger 무변경 · SUPERSEDED 0 이라 **D 유형 오염 0**.*

## 조치 — REPLACE 4 · 신규 줄 3 · 신규 P 1 · 보강 1

| 사이트 | 판정 | 내용 |
|---|---|---|
| `handoff-impl/SKILL.md` §5 첫 문단 | REPLACE | 발동 조건을 **지적으로 도는 모든 재구현 라운드**(verify/FAIL 파생 이슈·외부 PR 리뷰·사용자 지적)로 확대 |
| `handoff-impl/SKILL.md` §5 (신규 문단) | 추가 | 파생 이슈의 **계약은 `출처`의 AC·§10 행, `대응 방향`은 제안** — 닫힘은 제안 수행이 아니라 AC 성립 |
| `handoff-impl/SKILL.md` §6 차이 문단 | REPLACE | 차이를 적는 데서 끝내지 않고 **대체물이 갖고 원본이 갖지 않던 실패 모드**로 그 AC·§10 행을 재유도하고 어느 행을 재확인했는지 보고 |
| `handoff-verify/SKILL.md` §4 | 추가 1줄 | 보고된 차이는 **"타당" 판정으로 닫히지 않는다** — 그 모드를 만들어 AC 를 다시 단언한다 |
| `plan.template.md` 파생 이슈 | REPLACE + 주석 1줄 | `출처` 에 위반한 AC·§10 행을 함께 적게 하고 칸의 권위를 명시 |
| `docs/handoff/AGENTS.md` §2 | REPLACE 1 + 추가 1 | 위 두 impl 규칙의 최소 계약 (정본은 impl SKILL) |
| `failure-patterns.corpus.md` | 보강 + 신규 | **P38 보강 1블록**(같은 causal class 재발이라 새 P 신설 안 함) · **P43 신설**(대체 메커니즘 — 새 causal class) |
| `handoff-plan/SKILL.md` | 변경 0 | 설계 축 실패가 아니다. AC4·AC13 문면은 r1 부터 정확했고 갈린 것은 구현·검증이다 |

## Tier 판정

**Tier 1** — impl 의 발동 조건(trigger)과 evidence 요구, template 필드의 의미가 바뀐다.
Tier 2 조건(실행 의미 불변)에 해당하지 않는다.

## 6-A Operational Instruction Delta

- **변경 줄 7(REPLACE 4 · 신규 3) · DELETE 0 · MOVE 0 · regression 0.** 삭제 4줄을 전수 열거해
  전부 REPLACE 원문임을 확인했다. 설명 없이 사라진 gate·command·reference **0건**.
- 명령·게이트·CI·`verify.template.md`·`handoff-plan/SKILL.md`·`handoff-review/SKILL.md` **diff 0**.
- `handoff-impl/SKILL.md:94` semantic target **3/3 KEEP** — ① 재현으로 끝나지 않는다 ② 리뷰는 본
  표면만 말한다 ③ 한 지점만 닫으면 다음 라운드에 올라온다. 발동 조건을 **넓혔고** 좁히지 않았다.
- `handoff-impl/SKILL.md:118` **3/3 KEEP** — ① 숨기지 않는다 ② 사실·이유 기재 ③ 결과가 나아도
  차이는 차이다. 구문 "별도로 적는다" 의 *분리 기재* 요구는 `plan.template.md:364`
  `### 설계 대비 명시적 차이` 전용 절이 계속 보유한다(diff 밖).
- `docs/handoff/AGENTS.md:230` **5/5 KEEP** — 재현에서 안 멈춤 · 불변식 한 문장 · 낳은 문장부터
  전수 · 새 표면 자기검사 · Decision≠적용.
- `plan.template.md` 파생 이슈 표 **컬럼 5/5 KEEP** — `출처` 예시만 확장.
- reference/script **MOVE·REPLACE 0건** — inbound `N`/semantic `M/M` 대상 없음.

## 6-B Historical Failure Regression

- **43 P 전수**(P43 신설 포함) · 변경 전 COVERED → 변경 후 **PARTIAL/GAP 0 · OBSOLETE 0**.
- **방어 지점이 diff 에 닿은 4건** — P38(impl §5: 발동 조건 확대, 규칙 3문장 보존) · P42(impl §6 의
  *다른* 문장 "승인받은 정정은 다른 커밋" 에 의존, diff 밖 — 실재 확인) · P39·P40(verify §4 의 다른
  bullet 에 의존, 이번 diff 는 bullet 추가뿐 — "구현자가 닫고 검증자가 다시 센다"·"`N회` 는 실제
  관측 주체" 실재 확인): 전부 **COVERED 유지**.
- **나머지 38건** — 방어 문장이 이번 diff 에 없다(삭제 4줄 전수 열거로 확인). 규칙 삭제·축소가
  없으므로 방어 약화 경로가 존재하지 않는다.
- **P43 신설** — 이번 변경이 그 방어를 만든다(impl §6 · verify §4 · AGENTS §2). 기존 P 와 중복
  아님: P14 는 *참조* 구현의 커버리지 착각, 여기는 *대체* 구현의 실패 모드다.
- 새 블록이 이름으로 가리키는 앵커 **5/5 resolve** — impl §5·§6 · verify §4 ·
  `docs/handoff/AGENTS.md` `### 2. 구현 — handoff-impl` · 0198 plan §11.

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 발동 조건 **2**(정본 `handoff-impl §5` + 미러 `docs/handoff/AGENTS.md §2`) ·
  `대응 방향` 권위 **3**(위 둘 + 칸이 사는 `plan.template.md`) · 대체물 재유도 **3**(정본 impl §6 +
  미러 AGENTS §2 + 검증자 대응 `verify §4`). root `AGENTS.md` 는 셋 다 재서술하지 않는다(사본 0).
- **owner 충돌 0** — 구현자가 대체물 실패 모드로 AC 를 재유도하고(impl §6), 검증자가 그 모드를 실제로
  만들어 다시 단언한다(verify §4). 어느 쪽도 상대를 면제하지 않는다.
- 새 명령·게이트 **0** — `app/AGENTS.md` 게이트 정본·`.github/workflows/ci.yml` 과 scope 충돌 0.
- `node scripts/check-doc-inventory.mjs --check` 링크 전건 resolve · `git diff --check` 통과.
- `Handoff: none` 카브아웃은 검증 면제가 아니다 — 본 review 는 handoff 인프라 메타 수정이므로
  직접 커밋이되 Tier 1 전 축을 수행했다.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.
- INDEX/commit trailer 규칙 **무변경** — 삭제 0.

## review 기록 정책

`round15-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개).

## 지침으로 해결할 수 없는 한계

- **기준선을 diff 로 잠글 수 없었다.** r2 구현 커밋 `fb04047` 이 저장소에 없고(브랜치 재작성),
  r2 의 규범 행 정정(AC2·AC3 재작성 + AC14 신설)과 r2 `verify.md` 227줄이 **r3 구현 커밋
  `8e17aae`** 안에 있다. verify §0 의 예외 절차(원문 인용 고정)가 작동했지만, 이력을 재작성하는
  환경에서 지침은 잠금을 복구하지 못한다.
- **설계 주체 표기는 C 로 두고 지침을 바꾸지 않았다.** 0198 은 plan 작성자가 Codex 이고 설계 커밋
  두 개가 `Agent: codex`(`d479e7c`) 또는 파싱 불가 trailer(`a5f06c4`)인데, root `AGENTS.md` 의 설계
  커밋 행은 `Agent: claude` 이고 `docs/handoff/AGENTS.md §역할 분담` 은 *Claude 가 구현하는* 경우만
  다룬다. 역할 계약 변경은 사용자 결정이라 review 가 단독으로 고치지 않는다.
- **better-sqlite3 bindings 부재** — 0198 r3 검증 · 0194 · 0193 동일 서명, 차집합 양방향 0. 환경.

---

# Round 16 — 0198 (라운드 4, verify/FAIL · 게이트 자기보고 + 축 하나만 재유도)

0198 이 라운드 3 을 초과해 재구현 전에 수행했다. 직전 round 15 의 조치는 **작동했다** — r3 이 남긴
D11~D14·D16 은 전건 닫혔고 검증자 재측정에서 AC4(12배열 동일)·AC13(만료 뒤 턴 3회에 fetch 1회)이 ✅ 다.
r4 의 미충족 2건은 **새 축**이다.

## 발견 1 — 게이트 자기보고가 사실과 달랐다 (P39 재발, 표면 축)

구현 보고는 `typecheck 3구성 PASS` 였고 실제 `npm run typecheck` 는 **exit 2 · `TS2741` 7건**이다
(`e0517e0` 트리로 되돌려 실행하면 exit 0 — 회귀 주체는 r4). `cached(key)` 를 인터페이스 필수 멤버로
추가하고 `runtime-catalog.test.ts` 의 fake 7곳 중 신규 1곳만 갱신했다. vitest 는 타입을 지우고
실행하므로 테스트만 초록이었다.

- **행위 자체는 B.** impl §7 이 "게이트 결과는 exit code 가 아니라 관측한 산출 — error·warning 수" 를,
  template 필드명이 `관측한 게이트 산출`(exit code 아님) 을 이미 요구한다. 수행했으면 잡혔다.
- **그 아래 A(coverage gap)** — template 은 `[구현자 기입]` 을 **1회분 표면**으로만 규정한다. 재구현
  라운드는 새 절을 자유 형식으로 쓰고, 그때 필드 이름과 함께 그 필드가 요구하던 증거도 사라진다.

| 라운드 | 표면 | 같은 자리에 적힌 것 |
|---|---|---|
| 0198 r1 | template 표 `관측한 게이트 산출` | `lint 0 error/warning 1; typecheck 3/3` |
| 0198 r4 | 표 없는 8줄 산문 | `typecheck 3구성 PASS` |

0194 r5·0191 r5 는 같은 자유 형식에서 소절을 **모방으로** 복원했다 — 규칙이 아니라 습관이 지켰다.

## 발견 2 — 보고된 차이를 축 하나에서만 재유도했다 (P43 재발, 축 축)

round 15 가 만든 규칙("대체물이 갖고 원본이 갖지 않던 실패 모드로 AC 재유도")이 **발동했고 만료 축을
닫았다.** 축 목록이 산문 괄호(`만료·공유·재진입·다른 무효화`)라 **한 축만 적은 보고가 나머지를 조사한
것처럼 보인다.** 남은 공유 축이 다음 라운드의 결함이 됐다 — 같은 `HarnessRuntimeConfigService` cache 를
`invalidate(undefined)` 호출자 3곳이 공유하는데, 설정 CRUD(`handlers/engine.ts:38`)와 부팅
배포(`bootstrap.ts:640`)는 cache 를 비우고 catalog entry 는 남긴다. 목록에는 모델이 보이고 턴만 죽으며
Gate 재인증 전까지 회복 경로가 없다.

- **A (coverage gap).** 규칙은 있었고 정상 수행이 부분 커버리지를 허용했다.
- 곁따르는 A — impl §3 의 캐시 질문이 **한 방향**이었다. "무엇을 건너뛰는가" 는 묻고 "새로 요구하게 된
  상태를 누가 비울 수 있는가" 는 묻지 않는다. P20 의 거울면이다(그쪽은 새 값을 *읽는* 소비처, 여기는
  필요한 상태를 *지우는* 지점).

*B/F 로 판정해 지침을 늘리지 않은 것: 중복 import(D21) · `sourceRevision` 유실(D19) · key 정규화
비대칭(D20) · 가이드 drift(D22) · 변이 M3 미검출(W1, impl §3 에 규칙 있음). Decision 무변경 ·
SUPERSEDED 0 이라 **D 유형 오염 0**. INDEX 대상 커밋의 `(r4 구현)` 자리표시자는 **E** — 커밋 전에는
자기 해시가 없다. 검증자가 채우는 현행 관행(r3·r4)으로 두고 규칙을 만들지 않았다.*

## 조치 — REPLACE 4 · 신규 줄 2 · 표 1 · 보강 2 · 신규 P 0

| 사이트 | 판정 | 내용 |
|---|---|---|
| `handoff-impl/SKILL.md` §3 캐시 불릿 | REPLACE | 질문을 **양방향**으로 — 폴백 있던 읽기를 필수 전제로 바꿨으면 그 전제를 **지우는 지점을 전수로** 세고 지점마다 재충전을 확인 |
| `handoff-impl/SKILL.md` §6 차이 문단 | REPLACE | 실패 모드를 **축마다 한 줄씩**, 축마다 재확인한 AC·§10 행 또는 `해당 없음` + 근거 |
| `handoff-impl/SKILL.md` §6 사례 | 추가 | 0198 r4 — 만료 축만 재유도, 공유 축 미기재 |
| `handoff-impl/SKILL.md` §8 서두 | REPLACE | 섹션 목록을 `세 섹션` → 실제 **6개**로 정정 + **재구현 라운드도 같은 이름 필드를 다시 채운다**(해당 없으면 `해당 없음`) + 0198 사례 1줄 |
| `plan.template.md` `[구현자 기입]` 머리 | 추가 2줄 | 같은 규칙을 필드가 사는 자리에 |
| `plan.template.md` `### 설계 대비 명시적 차이` | 표 신설 | 축 4행 × `실패 모드`/`재확인한 AC·§10 행 / 관측`. 기존 불릿 KEEP |
| `docs/handoff/AGENTS.md` §2 | REPLACE 1 + 추가 1 | 위 두 impl 규칙의 최소 계약 (정본은 impl SKILL) |
| `failure-patterns.corpus.md` | 보강 2 | **P39 보강**(remedy 가 재구현 라운드에서 표면째 사라진다) · **P43 보강**(축별 부분 커버리지). 둘 다 같은 causal class 재발이라 **신규 P 0** |
| `handoff-verify/SKILL.md` | 변경 0 | 검증 축은 작동했다 — D17·D18 을 둘 다 잡았고 §8 의 "exit code 를 통과 증거로 쓰지 않는다" 가 `--reporter=basic` 0파일 실행도 걸러냈다 |
| `handoff-plan/SKILL.md` | 변경 0 | 설계 축 실패가 아니다. AC4·AC13·§10 문면은 r1 부터 정확했고 공유 cache 는 구현자의 대체 선택이다 |

## Tier 판정

**Tier 1** — evidence 요구(축별 판정)와 보고 표면 계약(재구현 라운드 필드)이 바뀐다. Tier 2 조건(실행
의미 불변)에 해당하지 않는다.

## 6-A Operational Instruction Delta

- **삭제 9줄 · 추가 51줄 · DELETE 0 · MOVE 0 · regression 0.** 삭제 9줄을 전수 열거해 **전부 REPLACE
  원문**임을 확인했다.
- **추출 자체를 한 단계 엄격하게 다시 쟀다.** 1차 추출 `git diff -U0 | grep -E '^-[^-]'` 은 `- ` 로
  시작하는 마크다운 목록 항목을 **삭제 줄에서 누락**해 7줄만 냈다. `awk` 로 다시 세어 9줄이고, 놓친
  2줄이 impl §3·AGENTS §2 의 불릿이다 — 이 review 의 핵심 사이트 둘이다.
- semantic target 실측 — impl §3 `1/1`(재검증 문장) · §6 `3/3`(숨기지 않는다·AC 재유도·차이는 차이다) ·
  §8 `5/5`(변경 파일·관측한 게이트 산출·강제 지점 `N/M`·대상 커밋·`git show <hash>`) · AGENTS §2 `1/1`.
- impl §8 의 나머지 블록 `4/4` 생존 — 합계 검산 4단계 · `✅ N · ⚠️ M · ❌ K = 총 T` · 완결성=차집합 ·
  Review Signals.
- `handoff-verify/**` · `handoff-plan/SKILL.md` · `handoff-review/SKILL.md` · root `AGENTS.md` ·
  `app/AGENTS.md` · `.github/**` **diff 0**.
- reference/script **MOVE·REPLACE 0건** — inbound `N`/semantic `M/M` 대상 없음.

## 6-B Historical Failure Regression

- **43 P 전수** · 변경 후 **COVERED 43 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · **신규 P 0**.
- 방어 지점이 diff 에 닿은 **5건**: **P39**(impl §8 + template 머리 — 재구현 라운드 필드로 **강화**) ·
  **P43**(impl §6 + AGENTS §2 + template 축 표로 **강화**) · **P40**(impl §8 합계 블록은 diff 밖, 4/4
  실재 확인) · **P42**(impl §6 의 *다른* 문장 "승인받은 정정은 다른 커밋", diff 밖 — 실재 확인) ·
  **P20**(impl §3 의 새 절이 *지우는 지점* 거울면을 추가; 기존 *읽는 소비처* 방어는 무변경).
- **나머지 38건** — 방어 문장이 삭제 9줄 어디에도 없다(전수 열거로 확인). 규칙 삭제·축소가 없으므로
  방어 약화 경로가 존재하지 않는다.
- P heading 무결성 — `P1`~`P43` 연속·중복 0. `0173/plan.md` 의 line-scoped 인용
  `failure-patterns.md:541-552` 는 **P29 본문에 그대로 착지**(실측). 이번 편집은 P39(837행 이후)·
  P43(1033행 이후)이라 541 이전 offset 무변경이다.

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 축별 재유도 **4**(정본 `impl §6` + 미러 `AGENTS §2` + 표가 사는
  `plan.template.md` + 검증자 대응 `verify §4:111`) · 재구현 라운드 필드 **3**(`impl §8` + `AGENTS §2` +
  `plan.template.md` 머리). root `AGENTS.md` 사본 **0**.
- **owner 충돌 0** — 구현자가 축마다 재유도하고(impl §6), 검증자는 그 모드를 **실제로 만들어** 다시
  단언한다(verify §4, 무변경). 어느 쪽도 상대를 면제하지 않는다.
- **`세 섹션` 잔존 사본 0** — impl §8 이 부르는 6개 이름이 `plan.template.md` 의
  `## [구현자 기입] …` heading 과 **6/6** 일치(실측). 이 불일치는 이번 라운드에 처음 측정됐다.
- 새 명령·게이트 **0** — `app/AGENTS.md` 게이트 정본·`.github/workflows/ci.yml` 과 scope 충돌 0.
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok** ·
  `git diff --check` 통과.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.
  INDEX/commit trailer 규칙 **무변경**.
- `Handoff: none` 카브아웃은 검증 면제가 아니다 — 본 review 는 handoff 인프라 메타 수정이라 직접
  커밋이되 Tier 1 전 축을 수행했다.

## review 기록 정책

`round16-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개).

## 지침으로 해결할 수 없는 한계

- **커밋 전에는 자기 해시가 없다.** INDEX `대상 커밋` 칸의 자리표시자는 구현자가 원리적으로 채울 수
  없다. 검증자가 채우는 현행 관행(0198 r3·r4)으로 두고 규칙을 만들지 않았다.
- **round 15 가 남긴 두 한계는 그대로다** — 설계 주체 표기(`Agent: codex` + `Status: designed`)는 역할
  계약이라 사용자 결정이고, better-sqlite3 bindings 부재는 환경이다. r4 검증에서도 같은 5파일·42케이스
  서명이며 차집합 양방향 0.

---

# review round 17 — 이번 라운드의 수정이 잠겼는가 · 규범 정정 요구의 주체

**발동**: 0198 impl 라운드 5(3 초과) + r5 verify 가 r4 와 같은 축의 재발을 관측.

## 분류

| # | 이슈 | 분류 | 조치 |
|---|---|---|---|
| D26~D28 | r5 수정 5곳(D18 배선 2·D20 정규화 2·key 필터 1)이 되돌려도 401케이스 전건 통과 | **A** — 어느 SKILL 에도 *내 수정이 잠겼는가* 규칙이 없다 | **P44** 신설 + 5개 사이트 |
| D31③·D29 | r4 가 요구한 §10 두 행이 라운드를 넘기며 소멸, 같은 축이 r5 에 재발 | **A** — lifecycle 에 규범 정정 단계가 없다 | **P45** 신설 + 6개 사이트 |
| D24·D25 | 부팅 무효화가 인증 fetch 를 지움 · settings 충돌로 D18 증상 재현 | **B** — impl §5("닫힘은 제안 수행이 아니라 AC 성립")가 이미 요구 | 문장 추가 없음. P43·P38 방어 유지 |
| D30 | 게이트 자기보고 `2092/44` ↔ 재측정 `2090/42` | **B** — impl §7·§8 이 이미 요구(P39) | 문장 추가 없음 |
| D31① | `176a73f` 가 규범 행 D-008 을 구현과 한 커밋에 | **B** — round 13 이 이미 게이트를 걸었고 verify §0 이 두 번 다 잡았다 | 문장 추가 없음 |

**B 5건에 문장을 더하지 않았다** — round 15·16 이 같은 축에 산문을 두 번 더했고 r5 는 같은 모양으로
실패했다. 대신 A 2건을 **template 필수 필드와 lifecycle 분기**라는 구조로 넣었다(SKILL §3).

## Tier

**Tier 1.** owner(verify/FAIL 다음 주체)·required template field·lifecycle 이 바뀐다.

## 6-A Operational Instruction Delta

- 삭제 라인 **4줄, DELETE 0건** — 전부 **REPLACE(superset)** 이고 원 의미가 추가분 안에 남는다:
  impl §8 필드 목록(6→7개 이름) · verify 마무리 FAIL 줄(**기본 구현자 명시 유지** + 예외 1) ·
  lifecycle diagram(기존 경로 보존 + 분기) · 상태표 `verify/FAIL` 행(`구현자` 유지 + 조건).
- 나머지 전 축 **KEEP** — trigger·owner·command·evidence·human/agent 경계·INDEX/commit/hygiene 무변경.
- 새 명령·게이트 **0건**. `app/AGENTS.md` ABI 규칙과 충돌 없음.
- reference/script **MOVE·REPLACE 0건** — corpus 는 **말미 append** 라 inbound line-scoped 인용
  `failure-patterns.md:541-552` 가 **P29 본문에 그대로 착지**(실측). P heading `P1~P45` 연속·중복 0.

## 6-B Historical Failure Regression

- **45 P 전수**(기존 43 + 신규 2) · 변경 후 **COVERED 45 / PARTIAL 0 / GAP 0 / OBSOLETE 0** ·
  **신규 P 2**(P44·P45).
- 규칙 **삭제·축소 0** 이므로 방어 약화 경로가 구조적으로 없다 — 43건의 방어 문장이 삭제 4줄 어디에도
  없음을 전수 확인했다.
- 방어가 **강화된 4건**: **P15**(강제 지점 요구에 주체가 생김) · **P38**(요구 소멸 경로 차단) ·
  **P41**(P44 의 분모는 자기가 정의하지 못한다 — diff 다) · **P39**(되돌림 관측이 행 단위 증거를 하나 더).
- **회귀 위험 2건을 능동 차단**: **P18·P22**(하치장) — 새 `잠금 없음` 칸이 "측정 불가" 하치장이 될 수
  있어, 검증자가 같은 되돌림을 다시 돌리고 재현되지 않는 사유는 파생 이슈가 된다고 template 에 못박았다.
  **P37**(structural proxy) — P44 는 AC 검증을 **대체하지 않는다**. 미검출을 파생 이슈로 만들 뿐
  검출을 통과 근거로 쓰지 않으며, 어느 사이트도 "잠기면 충분" 을 말하지 않는다(실측).

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — fix-lock **5**(정본 `impl §3` + 미러 `AGENTS §2` + 필수 필드
  `plan.template.md` + 검증자 대응 `verify §4` + `verify.template.md §4`) · 규범 정정 주체 **6**
  (`verify` 마무리 + `verify.template.md §13` + `plan SKILL` verify/FAIL 절 +
  `docs/handoff/AGENTS.md` diagram·상태표·본문 + `plan.template.md` 파생 이슈 상태값 +
  root `AGENTS.md` 협업 흐름).
- **owner 충돌 0** — 구현자가 되돌림을 관측하고(impl §3), 검증자가 같은 되돌림을 다시 돌린다(verify §4).
  어느 쪽도 상대를 면제하지 않는다(SKILL §5 "구현자가 닫고 검증자가 다시 센다").
- **root ↔ handoff lifecycle 불일치 1건을 닫았다** — root `AGENTS.md:57` 이 `FAIL → Codex 재구현` 을
  무조건으로 적어 새 분기와 어긋났다. 같은 조건절을 달아 6개 사이트가 한 말을 한다.
- `plan.template.md` `## [구현자 기입] …` heading **7/7** 이 impl §8 이 부르는 이름과 일치(실측).
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok** ·
  `git diff --check` 통과.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.
  INDEX/commit trailer 규칙 **무변경**.

## review 기록 정책

`round17-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개).

## 지침으로 해결할 수 없는 한계

- **B 5건은 지침이 이미 요구하던 것이다.** round 13·15·16 이 각각 게이트·축·필드를 더했고 r5 는 그
  문장들을 부분 수행했다. 남은 것은 수행 품질이고, 같은 문장을 다시 쓰는 것은 조치가 아니다.
- round 15·16 이 남긴 두 한계 그대로 — 설계 주체 표기는 사용자 결정, better-sqlite3 bindings 부재는
  환경(r5 재측정도 같은 5파일, 케이스는 42로 구현자 보고 44 와 갈림).

---

# review round 18 — 좌표는 확인할 수 있는 쪽이 적는다 · 보드 칸은 주체 하나

**발동**: 0198 impl 라운드 6(3 초과) + verify r6 FAIL + 사용자의 명시적 review 요청.

## 분류

| # | 이슈 | 분류 | 조치 |
|---|---|---|---|
| D36 | 좌표 5연속 — r2 `7fb771f`·r3 `fb04047`·r6 `d214581` 부재, r4·r5 자리표시자 | **A** — impl §8이 `git show`로 확인하라고 적고 r6은 확인했다고 적었다. 분리 환경에서 로컬 해시는 공유 브랜치 좌표가 아니므로 **정상 수행해도 실패한다** | **P47** 신설 + 소유권 이전(구현자→검증자) |
| D37 | 규범 정정(D-009 신설·AC5·AC7·AC11·§10 2행)과 구현이 한 커밋, 설계 커밋 부재 | **A** — P45 remedy는 작동해 보드가 설계자를 지목했으나 칸이 `Claude (… → 이후 Codex r6)`라 구현자가 자기 차례로 읽었다 | **P46** 신설 + 「다음 주체」 단일 표기 |
| D32~D34 | 이번 라운드 수정 5 hunk 중 3 미검출(`agent:list` 인자·cross-auth 의미·부팅 배선) | **B** — P44(round 17)가 이미 요구. 다만 신설 필드가 산문 한 줄로 접히며 3/5만 실렸다 | 문장 추가 없음. **P39 보강** — 검출을 검증자 쪽에 둔다 |
| D35 | §7 순서 기준(attach 마지막) ↔ 구현(attach 3번째), "설계 대비 차이 없음" 보고 | **F** — 0198 설계 결함이지 지침 결함이 아니다 | handoff 내 정정(`fa7ea4c`). 지침 변경 없음 |
| D38 | `auth.md:583`이 "카탈로그 목록에 넣지 않는다"로 남아 같은 파일 `:496`과 어긋남 | **F** — plan §18이 문서를 열거했고 P19·P31이 이미 방어 | 문장 추가 없음. r7 파생 이슈 |
| D39 | 주석이 옮겨간 listener를 가리킴 | **F** — 위생 | 문장 추가 없음 |

**B 1건에 문장을 더하지 않았다.** round 16·17이 같은 축에 두 번 썼고 r5·r6이 같은 모양으로 접었다.
세 번째 문장 대신 **검증자가 필드 수를 세게** 했다 — 판정이 성실성이 아니라 heading 개수로 내려간다.

## Tier

**Tier 1.** owner(좌표 기입 주체가 구현자→검증자)·evidence(재구현 라운드 필드 전수)·보드 표기 semantics가 바뀐다.

## 6-A Operational Instruction Delta

- 삭제 **5줄, DELETE 0건** — 전부 **REPLACE**이고 원 책임이 살아 있다:
  impl §8 필드 문장(7개 이름 **불변**, 좌표 의무만 이전) · impl §8 문장 규칙 줄(앞부분 불변) ·
  impl 마무리 INDEX 줄(`IMPL_DONE`·다음 주체 **유지**) · `plan.template.md` 대상 커밋 행(행 유지, 값 규칙 교체) ·
  `verify.template.md` 해시 확인 줄(`git show` → `git cat-file -t`, 같은 검사의 더 정확한 명령).
- **MOVE 1건 — 좌표 기입 책임 impl → verify.** inbound **7사이트**(handoff AGENTS §INDEX 운영·§2·§3 · impl §8 ·
  impl 마무리 · `plan.template.md` 구현 보고 · verify §9 · `verify.template.md §11`) ·
  semantic target **3/3 보존**(좌표가 INDEX에 존재한다 · 실재하는 커밋이다 · 다음 라운드 기준선을 연다).
- **좌표 사본을 2 → 1로 줄였다.** 정본은 `INDEX.md`, plan 구현 보고 행은 자리표시자다 — r6은 두 사본이 **함께** 죽었다(P40 예방).
- 새 명령 **0건**. `app/AGENTS.md` ABI 규칙과 충돌 없음(게이트 문장 무변경).
- reference/script **MOVE·REPLACE 0건**. corpus 편집은 P39 본문(878행 이후)과 말미 append — line-scoped inbound
  `failure-patterns.md:541-552`는 **P29 본문에 그대로 착지**(실측: 541행 = `## P29`). P heading **P1~P47 연속·중복 0**(실측).

## 6-B Historical Failure Regression

- **47 P 전수**(기존 45 + 신규 2) · 변경 후 **COVERED 47 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · 신규 **P46·P47**.
- **삭제 5줄 어디에도 기존 P의 방어 문장이 없다**(전수 확인). corpus의 유일한 `git show` 인용(477행)은
  verify §0 기준선 대조용이며 이번 변경이 건드리지 않았다.
- 방어가 **강화된 3건**: **P39**(검증자가 재구현 라운드 필드 수를 센다) · **P44**(`잠금` 필드의 부재가
  개수로 드러난다) · **P45**(지정된 주체가 실제로 읽힌다 — remedy의 마지막 구간).
- **회귀 위험 2건을 능동 차단**: **P22**(하치장) — 자리표시자가 "아무도 안 적는 칸"이 되지 않도록
  verify §9와 `verify.template.md §11`에 기입 의무를 두었다. **P40**(사본 갈림) — 좌표 SSOT를 INDEX 한 곳으로 명시했다.

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 좌표 소유권 **9**(handoff AGENTS §INDEX 운영·§2·§3 최소 계약 · impl §8 두 곳 ·
  impl 마무리 · `plan.template.md` 구현 보고 · verify §9 · `verify.template.md §11` 2줄) ·
  보드 단일 주체 **2**(handoff AGENTS §INDEX 운영 · `verify.template.md §11`).
- **owner 충돌 0** — 구현자는 자리표시자를 남기고 검증자가 채운다. 어느 쪽도 상대를 면제하지 않는다.
- root `AGENTS.md`는 좌표·다음 주체 규칙을 갖지 않아 **충돌 없음**(실측: `대상 커밋`·`다음 주체` 0건).
- `docs/handoff/AGENTS.md:199`의 "대상 커밋이 다른 지적"은 **외부 피드백이 가리키는 커밋**이라 다른 의미다 — KEEP.
- `plan.template.md` `## [구현자 기입] …` heading **7/7**이 impl §8이 부르는 이름과 일치(실측, 무변경).
- 새 규칙을 이번 보드에 **dogfood**했다 — 0198 행의 「다음 주체」를 `Codex` 하나로 고쳤다(직전 verify 커밋이 두 주체를 담았다).
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok** · `git diff --check` 통과.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음. commit trailer 규칙 무변경.

## review 기록 정책

`round18-review.md`를 만들지 않았다 — 압축으로 잃는 rationale이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개).

## 지침으로 해결할 수 없는 한계

- **D35·D38·D39는 F다.** 0198의 설계·문서 결함이고 지침 변경으로 예방되지 않는다 — 각각 이번 설계 턴과 r7 파생 이슈로 간다.
- **좌표 규칙은 분리 환경을 전제한다.** 한 에이전트가 설계·구현·검증을 모두 하는 환경에서는 구현자가 좌표를 적어도 무해하지만,
  규칙을 환경별로 갈라 두면 그 판정 자체가 새 실패면이 되므로 하나로 둔다.
- better-sqlite3 bindings·GUI 부재는 round 15~17과 같은 환경 한계다. 단 이번 검증 환경은 전체 vitest가 완주했다(2098케이스 · ABI red 42).

---

# review round 19 — 잠금의 분모는 diff가 아니라 인용 변이 · 커밋 메시지도 다시 읽는다

**발동**: 0198 impl 라운드 7(3 초과) + verify r7 FAIL + 같은 축(P44)의 3라운드 연속 재발.

## 분류

| # | 이슈 | 분류 | 조치 |
|---|---|---|---|
| D40 | r7이 만든 두 helper 안쪽은 잠겼으나 `bootstrap.ts` 호출부 2좌표가 열려 있다 — D33·D34가 인용한 변이가 2100케이스·typecheck exit 0을 통과 | **A** — P44 방어 5사이트가 전부 발동했고 `[구현자 기입]` 7필드도 채워졌다. **분모가 diff라서** 동작 보존 추출 라운드를 재지 못한다 | **P44 강화** — 분모를 인용 변이로 교체 + 7사이트 |
| D43 | r7 구현 커밋 본문이 리터럴 `\n` 한 줄이라 trailer 파싱 0건 | **A** — root AGENTS·git-template이 원인 하나(블록 내부 빈 줄)만 금지한다. 정상 수행해도 이 원인은 걸리지 않는다. r3 D15가 같은 증상 1회차 | **P39 강화** — 다시 읽는 산출물에 커밋 메시지 포함 + 7사이트 |
| D42 | 신규 handler 테스트의 `toEqual([])`가 총량 없이 0건만 단언 | **B** — 0198 plan §7 "AC 검증 주의사항"이 "자동 entry 제거와 사용자 entry 보존을 함께 단언"을 이미 적었고 P35도 방어한다 | 문장 추가 없음 |
| D41 | AC11이 소스 문자열 검사를 전면 배제해 합성 seam을 잠글 수단이 없다 | **F** + **E** | 0198 설계 턴이 정한다. `bootstrap.ts` 미로딩 원인은 실측(아래 한계) |
| — | §10 cache 수명 행이 무효화 4지점만 열거하고 유령을 실제로 막는 읽기 2좌표를 빼놓았다 | 관찰 | impl §2·verify §6의 "표 밖 지점" 규칙이 실제로 작동해 r7 verify가 찾았다. 1회 관측 → 규칙 추가 없음 |

**B 1건에 문장을 더하지 않았다.** A 2건은 둘 다 **기존 규칙의 분모/적용면 교체**이고 신규 P는 0이다 —
같은 causal class의 재발이라 사례를 늘리지 않는다(SKILL §7).

## Tier

**Tier 1.** 잠금 판정의 분모(evidence semantics)와 파생 이슈 `닫힘`의 정의, 커밋 후 필수 관측이 바뀐다.

## 6-A Operational Instruction Delta

- 삭제 **22줄, DELETE 0건** — 전부 **REPLACE(superset)** 이고 원 책임이 추가분 안에 남는다:
  impl §3 잠금 bullet · impl §5 파생 이슈 계약 문장 · impl §8 "닫았다" 문장 · `plan.template.md` 잠금 필드
  주석 4줄과 표 2줄 · verify §4 bullet · verify §9 trailer bullet · `verify.template.md §4` ·
  `git-template.md` 함정 heading·본문 · `docs/handoff/AGENTS.md` §2 잠금 bullet·§3 trailer 줄 ·
  corpus P39·P44 `현재 방어` 6줄.
- **초안이 3사이트 → 1사이트로 줄인 문장 1건을 복원했다** — "hunk 분모에서 아무것도 실패하지 않으면
  잠기지 않은 것"이 impl §3에만 남을 뻔해 `plan.template.md`·`verify §4`·`AGENTS §2`에 되돌렸다.
  신규 구현 라운드(인용 변이 없음)의 유일한 방어선이다.
- 나머지 전 축 **KEEP** — trigger·owner·command·gate·human/agent 경계·INDEX/좌표 규칙 무변경.
- 새 명령 **1건**(`git log -1 --format='%(trailers:only=true)'`) — 읽기 전용이고 `app/AGENTS.md` ABI 규칙과 무관.
- **신규 bullet 1건 — `AGENTS.md §3` 검증 최소 계약.** §2에만 있던 잠금 축을 §3에 대칭으로 두었다(skill 미가용 환경).
- reference/script **MOVE·REPLACE 0건**. corpus 편집은 P39(878행 이후)·P44(1101행 이후) 본문이라
  line-scoped inbound `failure-patterns.md:541-552`는 **P29 본문에 그대로 착지**(실측: 541행 = `## P29`).
  P heading **P1~P47 연속·중복 0**(실측, 신규 P 0).

## 6-B Historical Failure Regression

- **47 P 전수** · 변경 후 **COVERED 47 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · 신규 **0**.
- 편집한 사이트를 인용하는 P는 **9건**(P39~P47, 기계 추출). 나머지 38건의 방어 문장은 삭제 22줄
  어디에도 없다 — 삭제 문구 7종을 corpus 전문에서 역검색해 고아 인용 **1건**만 나왔고, 그것은 P44 자신의
  round 17 규칙 줄로 바로 아래 r7 보강이 명시적으로 교체한다.
- 방어가 **강화된 3건**: **P44**(분모를 구현자가 고를 수 없는 값으로 교체) · **P39**(다시 읽는 산출물에
  커밋 메시지 추가) · **P41**(전수 분모를 도구·자기가 정의하지 못한다는 성질이 잠금 축까지 확장).
- **corpus 내부 모순 1건을 닫았다** — P44 본문의 "분모는 diff 다"가 새 규칙과 정면으로 어긋나 round 17
  당시 상태임을 명시하고 r7 보강으로 교체됨을 표시했다.
- **회귀 위험 2건을 능동 차단**: **P22·P18**(하치장) — 새 `심은 결함`·`출처` 열이 "심을 수 없었다"의
  하치장이 되지 않도록 `잠금 없음 + 사유`와 검증자 재심기를 그대로 유지했다. **P37**(structural proxy) —
  인용 변이 검출은 AC 검증을 대체하지 않는다. 미검출이 이슈를 되돌릴 뿐 검출이 통과 근거가 아니다(실측: 어느 사이트도 "검출되면 충분"을 말하지 않는다).

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 잠금 분모 **7**(impl §3 · impl §5 · `plan.template.md` 잠금 필드 · verify §4 ·
  `verify.template.md §4` · `docs/handoff/AGENTS.md` §2·§3) · trailer 파싱 **7**(root `AGENTS.md` ·
  `git-template.md §함정` · `docs/handoff/AGENTS.md §3` · impl §8 · impl 마무리 · verify §9 · `verify.template.md §11`).
- **owner 충돌 0** — 구현자가 결함을 심고(impl §3) 검증자가 같은 결함을 다시 심는다(verify §4). 커밋 파싱도
  구현자 확인(impl 마무리) ↔ 검증자 재확인(verify §9)으로 같은 관계다. 어느 쪽도 상대를 면제하지 않는다.
- **파생 이슈 `상태` 칸의 소유자가 처음으로 명시됐다** — 이전에 어느 문서도 정하지 않았고(실측 0건),
  새 문장은 `[검증자 기입] 파생 이슈`라는 절 이름과 같은 방향이라 충돌이 없다.
- **stale 사본 0** — "고친 hunk를 하나씩 되돌"·"되돌림을 다시 돌린다"·"되돌려 실패 수"를 skills/docs 전문에서 역검색해 잔존 0건(corpus 제외).
- `plan.template.md` `## [구현자 기입] …` heading **7/7**이 impl §8이 부르는 이름과 일치(실측, 무변경).
- 새 규칙을 이번 턴에 **dogfood**했다 — verify r7이 D33·D34의 인용 변이를 다시 심어 `closed r7`을 `partial r7`로
  되돌렸고(새 verify §4가 요구하는 그 동작), 이 review의 커밋도 `%(trailers:only=true)`로 파싱을 확인한다.
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok** · `git diff --check` 통과.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음. INDEX·좌표 규칙 무변경.

## review 기록 정책

`round19-review.md`를 만들지 않았다 — 압축으로 잃는 rationale이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개). 신규 P **0** — 두 이슈 모두 기존 P의 분모·적용면 교체다.

## 지침으로 해결할 수 없는 한계

- **D41은 0198의 규범 결정이다.** `bootstrap.ts`는 `@electron-toolkit/utils/dist/index.cjs`의 CJS
  `require('electron')`이 ESM mock을 우회해 vitest가 열지 못한다(검증자 probe 실측). 합성 seam을 잠글
  수단을 음성 소스 가드로 할지 helper 병합으로 할지는 handoff의 설계 턴이 정한다 — 지침 변경 대상이 아니다.
- **인용 변이 분모는 재구현 라운드에만 있다.** 신규 구현 라운드는 인용할 변이가 없어 hunk 분모로 돌아가고,
  거기서는 round 17의 한계(구현자가 심을 자리를 고른다)가 그대로 남는다.
- better-sqlite3 bindings·GUI 부재는 round 15~18과 같은 환경 한계다. r7 검증 환경은 전체 vitest가
  완주했다(214파일 2100케이스 · ABI red 5파일 42케이스).

---

# review round 20 — 부재에 반응하는 장치는 존재를 잠그지 못한다

**발동**: 0198 impl 라운드 8(3 초과) + verify r8 FAIL + 같은 축(호출부 잠금)의 4라운드 연속 재발.

## 분류

| # | 이슈 | 분류 | 조치 |
|---|---|---|---|
| D44 | D-010의 음성 유일성 가드가 인용 변이 2건을 검출하면서도, 배선을 통째로 지우면 침묵한다 — production Auth listener 0개가 typecheck 0·eslint 0·vitest 215/215·2108/2108 green | **A** — plan §5 structural proxy 규칙이 있고 설계 턴이 그것을 스스로 점검했는데 *방향*이 뒤집혔다. 정상 수행으로 막히지 않는다 | **신규 P48** — 장치 방향 규칙 + 소거 변이 수렴 |
| D44 (곁) | §10 부팅 시퀀스 행이 소멸을 `noUnusedLocals`가 막는다고 적었고, 근거는 r7 M-J의 1단계 관측이다 | **A** — plan §5가 "차이를 §10 `실패 의미`에 적는다"만 요구하고, 그 칸이 *측정하지 않은 보호 주장*을 담는 것은 금지하지 않는다 | **P48 곁따르는 규칙** — 보호 주장은 그 턴에 측정 |
| D45 | `bootstrap.ts:372` 주석이 그 파일에 없는 `auth.subscribe`를 가리킨다 | **F** — r7 D39와 같은 축, 0198이 고친다 | 문장 추가 없음 |
| D46 | 가드 술어가 수신자 이름 `auth`에 묶인다. 오늘 차집합 0 | **관찰** — verify §8 엄격화가 실제로 작동해 r8이 쟀다 | 문장 추가 없음 |
| — | r7이 보고·round 19가 승계한 `2100케이스/42 red`가 실측 **2102/44**였다(r8이 r7 트리를 체크아웃해 재측정) | **B** — verify §7 "내역 합 = 총계"가 이미 요구한다 | 문장 추가 없음. 아래 좌표 정정만 |

**B 1건·F 1건·관찰 1건에 문장을 더하지 않았다.** A 2건은 같은 causal class라 **신규 P는 1개**다.

## Tier

**Tier 1.** "잠겼다"의 판정 기준(evidence semantics)과 §10 `실패 의미` 칸이 담을 수 있는 주장이 바뀐다.

## 6-A Operational Instruction Delta

- 삭제 **9줄, DELETE 0건** — 전부 **REPLACE(superset)** 이고 원 문장이 추가분 안에 그대로 남는다:
  impl §3 장치 적대 검사 bullet · plan §5 게이트 완료 조건 bullet · plan §5 음성 게이트 bullet ·
  verify §4 인용 변이 bullet · verify §6 `실패 의미` bullet · verify §8 엄격화 bullet ·
  `docs/handoff/AGENTS.md` §2·§3 최소 계약 2줄 · corpus P41·P44 `현재 방어`.
  꼬리 문구 9종을 편집 후 전문에서 역검색해 **9/9 잔존**(실측).
- 신규 **6줄** — plan §5 방향 규칙 bullet 1 · plan READY self-review 항목 1 · `plan.template.md §10` 측정 근거 줄 1 ·
  verify §4 소거 변이 bullet 1 · `verify.template.md` §4·§5 줄 2.
- 나머지 전 축 **KEEP** — trigger·owner·command·gate·human/agent 경계·INDEX/좌표·commit trailer 규칙 무변경.
- **새 명령 0건.** 소거 변이 수렴은 기존 게이트를 다시 돌리는 것이라 `app/AGENTS.md` ABI 규칙과 무관하다.
- reference/script **MOVE·REPLACE 0건**. corpus 편집은 P41·P44 `현재 방어` 본문과 말미 P48 추가뿐이라
  line-scoped inbound `failure-patterns.md:541-552`는 **P29 본문에 그대로 착지**(실측: 541행 = `## P29`).
  P heading **P1~P48 연속·중복 0**(실측).

## 6-B Historical Failure Regression

- **48 P 전수** · 변경 후 **COVERED 48 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · 신규 **1**(P48).
- 편집한 사이트를 인용하는 P는 **10건**(P39~P48, 기계 추출). 삭제가 0건이므로 나머지 38건의 방어 문장은 손대지 않았다.
- 방어가 **강화된 2건**: **P44**(인용 변이 전건 검출이 배선 잠금을 뜻하지 않음을 명시) ·
  **P41**(엄격화가 재는 축이 *전수*이지 *방향*이 아님을 명시 — r8이 엄격화를 정상 수행하고도 D44를 못 잡은 자리다).
- **P37과의 경계를 P48 본문에 명시**했다 — P37은 semantic 목표를 structural proxy로 검증한 경우이고, P48은
  프록시의 *방향*이 뒤집힌 경우다. 0198 설계 턴이 P37을 스스로 점검하고도 통과한 것이 그 구분의 근거다.
- **회귀 위험 2건을 능동 차단**: **P22·P18**(하치장) — `verify.template.md`의 `해당 없음`이 소거 변이 회피구가
  되지 않도록 적용 조건을 plan §5의 불변식 형태("X가 있다/쓰인다")로 못 박았고, §4의 인용 변이 분모는 독립으로 남는다.
  **P30·P35**(음성 게이트) — 새 clause는 "음성 게이트가 무엇을 못 잠그는가"만 더하고 기존 술어 규칙을 바꾸지 않는다.

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 장치 방향 **4**(plan `SKILL.md` · impl `SKILL.md` · `docs/handoff/AGENTS.md §2` · corpus P48) ·
  소거 변이 수렴 **4**(verify `SKILL.md` · `verify.template.md` · `docs/handoff/AGENTS.md §3` · corpus P48) ·
  `실패 의미` 보호 주장 **5**(plan `SKILL.md` · `plan.template.md` · verify `SKILL.md` · `verify.template.md` · corpus P48).
- **owner 충돌 0** — 설계자가 수단의 방향을 고르고(plan §5), 구현자가 X를 지우는 변이를 심고(impl §3),
  검증자가 그 변이를 수렴까지 밀어 판정한다(verify §4). 기존 결함 심기 쌍(구현자가 닫고 검증자가 다시 센다)과 같은 관계이고
  어느 쪽도 상대를 면제하지 않는다.
- **scope 충돌 0** — verify §8에 붙인 것은 규칙이 아니라 *범위 한정*이다("엄격화는 전수를 재지 방향을 재지 않는다").
  두 문장이 같은 것을 요구하지 않는다.
- **stale 사본 0** — 편집한 6문장의 구 버전 꼬리 문구를 skills/docs 전문에서 역검색해 잔존 0건(corpus 인용 제외).
- **좌표 정정 1건** — round 19의 한계 절이 r7 환경을 `214파일 2100케이스 · ABI red 5파일 42케이스`로 적었다.
  r8 검증이 r7 트리(`6934d77`)를 체크아웃해 재측정한 값은 **214파일 2102케이스 · red 44**다.
  round 19 원문은 그대로 두고 여기서 정정한다(이력은 rewrite하지 않는다).
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok** · `git diff --check` 통과.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.

## review 기록 정책

`round20-review.md`를 만들지 않았다 — 압축으로 잃는 rationale이 없고 사용자 보존 요구도 없었다.
기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개). 신규 P **1**(P48) — 기존 P로 환원되지 않는
새 causal class다(장치가 반응하는 *방향*).

## 지침으로 해결할 수 없는 한계

- **D44의 해결 수단은 0198의 규범 결정이다.** 양성 술어(helper의 export를 부르는 production 파일 ≥1)를 가드에
  더할지, `resumeAuth`를 빈 구현이 타입에서 걸리는 구조로 좁힐지는 그 handoff의 설계 턴이 정한다.
  이 review는 "그 자리가 잠기지 않았다"를 판정하는 규칙만 바꾼다.
- **`bootstrap.ts` 미로딩은 그대로다** — `@electron-toolkit/utils`의 CJS `require('electron')`이 ESM mock을
  우회한다(P29). round 19와 같은 한계다.
- **소거 변이 수렴은 정리 단계를 따라가야 한다.** 컴파일러 진단이 매 단계 달라지므로 한 번에 판정하는 명령이 없다.
  r8은 3단계였고 규모가 큰 배선이면 더 길어진다.
- r8 검증 환경은 egress가 열려 **Node ABI 전체 스위트가 완주**했다(215파일 2108케이스 전건 green).
  round 15~19가 "환경 한계"로 분리 보고하던 ABI red를 실측으로 닫은 첫 라운드다.

---

# review round 21 — 규칙이 실패보다 늦게 태어났으면 재발이 아니다

0198 이 verify r9 FAIL 뒤 재구현 전에 수행했다(라운드 3 초과 트리거). r9 는 production 변경 0 의
부분 구현(가드 테스트 1파일)이라 판정 축은 셋뿐이다.

| 이슈 | 관측 | 분류 | 조치 |
|---|---|---|---|
| D47 | 신설 양성 술어가 `startRuntimeModelCatalogAfterDeploy(` 호출에만 걸려, listener 설치 helper 를 버리는 M-Q 가 베이스라인과 동일한 게이트로 통과(verify r9 §4) | **A(당시) — 이미 닫힘** | 문장 추가 없음. 구멍을 만든 r8 설계 턴(`d8e687f`)은 round 20 규칙(P48 방향 규칙 · "실패 의미" 보호 주장 이 턴 측정) **이전**이고, 그 규칙을 정상 수행하면 이 실패를 막는다 — 불변식 X = listener 설치, M-Q 가 X 소거 변이다. 인스턴스는 r10 설계 턴(`6136057`)이 §10 4지점(분모 32)·D-010 대상 심볼 2건 명기로 닫았다 |
| D44 ① 미수행 | r9 구현 커밋의 plan hunk 는 `[구현자 기입] r9` 추가뿐 — 규범 행 무변경(verify r9 §0) | **정상 작동** | 조치 없음 — impl §6 경계 준수의 증거이고 `규범 정정 필요` → 설계 턴 경로가 r10 에서 수행됐다 |
| r9 선행 부분 구현 | 보드 다음 주체 = Claude(설계)인 상태에서 구현 커밋(`c2d99f1` · `Status: partial`) 도착 | **B** | 문장 추가 없음 — `docs/handoff/AGENTS.md §INDEX 운영` "착수 전 자기 차례 확인" 이 이미 요구한다. 지시 경위는 저장소 증거 밖이라 실패로 학습하지 않는다. 손해 관측 0 — 부분 구현이 D44 ② 코드 절반을 선행했고 verify r9 가 수용·6단계 수렴 재검출했다 |

**지침 변경 0건 — 유지 판단.** D47 은 P48 의 인스턴스로 환원된다 — P48 규칙 문면("불변식이
'X 가 있다/쓰인다'면 장치는 X 를 지웠을 때 실패해야 한다")을 r9 장치가 그대로 위반한다. 장치의
극성이 양성이어도 대상 심볼이 불변식의 주어가 아니면 같은 침묵이다(같은 causal class, 장문 사례
누적 금지). 신규 P **0** · corpus 무변경 · **tier 분류 대상 없음**(SKILL/template/AGENTS 변경 0 —
6-A/6-B/6-C 는 지침을 바꿀 때 수행한다).

- r10 재구현의 계약은 규범에 이미 있다 — §10 부팅 시퀀스 4지점·D-010 대상 심볼·인용 변이 M-Q.
  추가 지침 없이 닫힌다.
- 환경 한계는 round 20 과 같다 — `bootstrap.ts` 미로딩(P29) · AC9 두 테마 시각 확인은 사람 몫.

---

# review round 22 — Delta V 추적축 · PLAN_GAP 분리 · blocking scope 한정

**발동/모드**: 사용자가 handoff V-model 재설계를 명시적으로 검토한 뒤 적용을 지시했다. `APPLY` ·
handoff SKILL/template/AGENTS의 trigger·required field·failure semantics·lifecycle을 바꾸므로 **Tier 1**이다.

## 분류

| 관측 | 분류 | 조치 |
|---|---|---|
| 필요한 계약/강제 지점이 없는 실패와 명시 계약을 어긴 구현 실패가 모두 `verify/FAIL` 한 상태였다 | **A** — next owner가 planner/implementer로 갈리는 정보가 lifecycle에 없다 | `PLAN_GAP → RETURN_TO_PLAN`, pair/global 위반 → `FAIL`로 분리 |
| verify의 “기준 밖 결함도 찾는다”가 discovery와 blocking scope를 분리하지 않았다 | **A** — 0202 r3처럼 인접 결함을 기록하며 PASS한 판정을 규칙이 설명하지 못한다 | `BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF` disposition 신설 |
| test level·변경 영향·증거 oracle이 구현 전 하나의 추적축으로 선언되지 않았다 | **A** — AC·§10·Technical Design은 강했으나 서로의 pair/provenance가 암묵적이었다 | `R↔AT`·`SD↔ST`·`AR↔IT`·`MD↔UT`, node provenance, pair requiredness 신설 |
| V만으로 기존 전수·mutation·baseline·repo gate를 대체할 위험 | **설계 제약** | V를 공통 추적축으로만 두고 §10·production path·변이·전역 불변식을 pair evidence로 유지 |

## 6-A Operational Instruction Delta

- **DELETE 0 · MOVE 0 · reference/script 이동 0 · 새 gate 명령 0.** 네 기존 skill과 두 template의 책임은 유지했고 V 연결과 판정 상태를 REPLACE/ADD했다.
- **다섯 번째 skill 0건.** 공통 vocabulary와 lifecycle은 `docs/handoff/AGENTS.md`, 단계별 실행은 기존 네 skill이 소유한다.
- **KEEP**: Decision Ledger, Product/UX Contract, AS-IS→TO-BE, producer/consumer 전수, §10 강제 지점 전수,
  semantic-vs-structural 검증, cited-mutation/hunk fallback, 소거 변이 수렴, 기준선 잠금, gate/ABI 분리,
  INDEX·좌표·trailer·AGENTS 위생, A~F 분류와 Tier 1/2.
- **REPLACE**: 규범 정정 분기 `규범 정정 필요` → `PLAN_GAP/RETURN_TO_PLAN`; AC 단독 closeout →
  `UT→IT→ST→AT` pair closeout; 무제한 “기준 밖 결함” → 귀속 기반 disposition; 전체 상위 설계 재서술 → Delta V provenance.
- **ADD**: `NEW/CHANGED/INHERITED/SUPERSEDED`, `REQUIRED/REGRESSION/NOT_REQUIRED`,
  `PASS/PAIR_FAIL/BLOCKED_BY`, V 밖 `G-SEC/G-DATA/G-DOC/G-REPO/G-SUBTREE`, legacy read-only V 합성.
- commit trailer 값은 늘리지 않았다. `RETURN_TO_PLAN`은 기존 `Verified-By: claude:fail` +
  `Next-Action: claude`로 인코딩하고 INDEX/verify 상태가 원인을 구분한다.
- corpus는 **P45 현재 방어만 REPLACE**했다. 역사 서술과 P1~P48 번호는 보존했고 신규 P는 0이다.

## 6-B Historical Failure Regression

P heading **48/48 전수** · `COVERED 48 / PARTIAL 0 / GAP 0 / OBSOLETE 0` · 신규 P **0**.

| 범위 | V 도입 뒤에도 유지되는 방어 | 판정 |
|---|---|---|
| P1~P18 | 조사·측정 가능한 AC·test seam·lifecycle·사람 경계는 pair의 path/oracle/requiredness 앞단에 그대로 남음 | COVERED 18 |
| P19~P37 | 문서 앵커·기존 소비처·producer/consumer·외부 포트·음성 gate·semantic proxy는 AR/IT·SD/ST 및 §10·Global evidence로 유지 | COVERED 19 |
| P38~P48 | 불변식 전수·자기보고 재측정·합계/사본·기준선·대체물 실패 모드·배선 잠금·규범 정정·좌표·변이 방향을 pair closeout이 대체하지 않음 | COVERED 11 |

### 실제 handoff state replay

| anchor | 새 상태로 재생 | false PASS / FAIL inflation |
|---|---|---|
| 0191 docs-code-resync | 좁은 oracle로 AC/§10 밖 잔여를 놓친 r1·r2는 `G-DOC` 또는 명시 pair `PAIR_FAIL`; 필요한 전수 정의 누락은 병행 `PLAN_GAP` | 0 / 0 |
| 0194 auth-refresh | 명시된 영속 사슬·호출부 위반은 `PAIR_FAIL`; producer/강제 지점·AC18 기준 누락/모순은 `PLAN_GAP`, 전체 next owner는 planner | 0 / 0 |
| 0198 runtime-model-catalog | 기존 AC·§10 위반과 인용 변이 미검출은 `PAIR_FAIL`; cache 수명/검증 수단 누락은 `PLAN_GAP`; commit/INDEX drift는 `G-REPO` | 0 / 0 |
| 0202 invalidation-scope | r1 D1~D3와 r2 D4는 기존 AC·§10 pair `PAIR_FAIL`; causally dependent 상위 pair만 `BLOCKED_BY`; r3 D5·D6은 비귀속 `NON_BLOCKING/NEXT_HANDOFF`라 기존 PASS 유지 | 0 / 0 |

`BLOCKED_BY`는 root pair의 인과 종속에만 적용해 같은 원인을 네 test level의 실패로 부풀리지 않는다.
명시 계약 위반은 pair 행 누락이 있어도 `PAIR_FAIL`이므로 `PLAN_GAP`이 결함을 낮추는 회피구가 아니다.

## 6-C Cross-document Consistency

- **PASS.** root AGENTS ↔ handoff AGENTS/INDEX ↔ git template ↔ 네 SKILL ↔ 두 template ↔ P45 current defense가
  lifecycle·owner·status를 같은 의미로 사용한다. plan gap owner=planner, pair/global fail owner=implementer다.
- legacy boundary가 일치한다 — 신규 handoff는 Delta V template, 진행 중 handoff는 AC·§10·path에서 읽기 전용 V를 합성하며 형식만으로 migration/FAIL을 만들지 않는다.
- 구현 보고 heading **7/7**, P heading **P1~P48 연속·중복 0**, 새 `handoff-vmodel` 디렉토리 0.
- skill 형식 검증 **4/4 valid**(`quick_validate.py`).
- `node app/scripts/check-doc-inventory.mjs --check`: generated **9 items/79 channels** · prose ok · relative links ok.
- vocabulary/owner 정적 대조와 `git diff --check`: **PASS**. gate 명령·ABI 규칙·CI scope 변경 0.

## review 기록 정책

`round22-review.md`를 만들지 않았다. 영구 결과는 지침과 이 절에 압축했고, 기존 `round2-review.md` 1개만 유지한다.

## 남은 한계

- V는 추적 누락과 판정 범위를 줄이지만 실행자가 증거를 조작하거나 실제 gate를 실행하지 않는 capability failure를 없애지 못한다. 기존 독립 재측정·변이 검증이 계속 필요하다.
- 기존 handoff 전체를 V 형식으로 소급 변환하지 않는다. legacy 합성은 검증 시 읽기 전용이며, 실질적 설계 변경 때만 영향 Delta를 새 revision으로 올린다.

---

# review round 23 — Baseline V와 Delta V 경계 · 선택적 적대 증거

**발동/모드**: 사용자가 초안의 작은 V 개념을 다시 검토한 뒤 반영을 지시했다. `APPLY`이며
V mode·required evidence·blocking scope의 실행 의미를 바꾸므로 **Tier 1**이다.

round 22의 이력은 보존하되 다음 세 결론은 이 라운드가 대체한다: 모든 신규 plan을 Delta V로 부른 것,
모든 pair와 일반 hunk에 mutation을 요구한 것, V 밖 `G-*`를 제품 blocking 범위로 둔 것이다.

## 분류

| 관측 | 분류 | 조치 |
|---|---|---|
| 최초 V와 기존 V의 증분을 모두 Delta V로 명명했다 | **A** — 상속 기준이 없는 V도 증분처럼 보이고 작은 V의 경계가 사라진다 | 최초는 `Baseline V`, 명시 기준 V 일부 변경만 `Delta V`, 둘을 합친 것을 `유효 V`로 정의 |
| 모든 pair의 mutation과 일반 hunk fallback이 READY/PASS 조건이었다 | **A** — 새 변이가 스스로 blocking 범위를 계속 늘릴 수 있다 | 직접 oracle은 필수로 유지하고 구조 proxy·0건/전수·배선 등 민감도 위험 pair만 적대 증거를 선택 |
| `G-SEC/G-DATA/G-DOC/G-REPO/G-SUBTREE`가 V 밖에서도 제품 FAIL을 만들었다 | **A** — 정해진 V만 닫는다는 범위 고정을 우회한다 | 제품 제약은 V·Decision·AC·§10에 귀속하고 subtree/repository 검사는 현재 변경 산출물의 완료 gate로 한정 |

## 6-A Operational Instruction Delta

| 판정 | 변경 | 승계 근거 |
|---|---|---|
| KEEP | Decision Ledger·AC·§10 전수·production path·직접 oracle·기준선 잠금·INDEX/trailer·ABI/repository 검사 | V는 기존 방어의 추적축이며 해당 책임과 명령을 삭제하지 않음 |
| KEEP | `PLAN_GAP→RETURN_TO_PLAN`, `PAIR_FAIL`, `BLOCKED_BY`, provenance·requiredness, legacy read-only 합성 | 계획 누락·구현 위반·인과 종속·구 plan 호환 경계를 그대로 유지 |
| REPLACE | 신규 `Delta V V1` → `Baseline V V1`; 기준 V의 변경 경로만 `ΔV<N>` | 초안의 일반 V와 작은 증분 V를 분리하고 commit/revision 상속을 요구 |
| REPLACE | pair별 mutation·일반 hunk fallback → 선택 pair·인용 finding·새 구조·전수·배선 oracle 민감도만 재측정 | mutation은 oracle의 방향·민감도 증거이지 scope source가 아님 |
| REPLACE | V 밖 `G-*` registry → 현재 변경의 subtree/repository/message-bus gate | 변경 산출물의 완료 조건은 유지하되 관련 없는 기존 결함으로 제품 범위를 늘리지 않음 |
| DELETE | mutation 부재만으로 FAIL, 모든 hunk 자동 분모 | 직접 행동 oracle이 충분한 pair의 거짓 FAIL을 만들므로 선택적 적대 증거가 대체 |

- reference/script **MOVE 0건**, 새 gate 명령 **0건**, 다섯 번째 skill **0건**이다.
- corpus는 P41·P44·P45·P48의 `현재 방어`만 REPLACE했고 역사 사례·P 번호는 유지했다. 신규 P는 0이다.
- root/handoff AGENTS, 네 SKILL, 두 template에서 같은 mode·scope·evidence vocabulary로 기존 문장을 통합했다.

## 6-B Historical Failure Regression

P heading **48/48 전수** · `COVERED 48 / PARTIAL 0 / GAP 0 / OBSOLETE 0` · 신규 P **0**.

| 범위 | 교정 뒤 방어 | 판정 |
|---|---|---|
| P1~P40 | 조사·Decision·AC·path·강제 지점·semantic oracle·기준선·운영 gate 책임은 유지 | COVERED 40 |
| P41 | 구조 proxy·0건/전수 oracle은 적대 증거 선택 조건이라 대상 집합·추출·비교·실재·분류 단위의 눈을 확인 | COVERED |
| P42~P43 | 자기보고 독립 재측정과 합계/사본 대조는 mutation requiredness와 무관하게 유지 | COVERED 2 |
| P44 | 일반 hunk는 분모에서 빼되 pair가 선택한 배선 변이와 finding이 인용한 변이는 구현·검증이 다시 실행 | COVERED |
| P45 | 필요한 규범·pair·oracle 누락은 기준 V의 Delta V로 정정한 뒤 `plan/READY`로 복귀 | COVERED |
| P46~P47 | 저장소 좌표와 규범 정정 owner 방어는 lifecycle 변경 없이 유지 | COVERED 2 |
| P48 | “X가 쓰인다”·배선 존재 oracle은 소거 방향을 별도 입증해야 하므로 선택적이라는 말로 면제되지 않음 | COVERED |

### 실제 handoff state replay

| anchor | 교정된 상태로 재생 | false PASS / FAIL inflation |
|---|---|---|
| 0191 docs-code-resync | 명시 문서·§10 위반은 `PAIR_FAIL`; 전수 대상·추출·비교 oracle 자체가 빠진 라운드는 `PLAN_GAP`; G-DOC은 사용하지 않음 | 0 / 0 |
| 0194 auth-refresh | 명시 영속 사슬·producer·필드 위반은 `PAIR_FAIL`; 강제 지점 분모나 AC18 식이 누락·모순이면 `PLAN_GAP` | 0 / 0 |
| 0198 runtime-model-catalog | AC·§10·인용 변이 위반은 `PAIR_FAIL`; cache lifecycle·필요 oracle 누락은 `PLAN_GAP`; 이번 턴이 바꾼 commit/INDEX drift만 repository gate `FAIL` | 0 / 0 |
| 0202 invalidation-scope r1 | D3은 AC11이 같은 인스턴스 비교를 명시했는데 증거를 만들지 않아 `PAIR_FAIL`; D1·D2의 새 concurrency·컴포지션 oracle은 plan에 없어 `PLAN_GAP`; 종속 pair만 `BLOCKED_BY` | 0 / 0 |
| 0202 invalidation-scope r2~r3 | D4의 토큰 단위 oracle 확장은 `PLAN_GAP`; D5·D6은 유효 V·Decision·AC·§10 비귀속이라 `NON_BLOCKING/NEXT_HANDOFF`이고 r3 PASS 유지 | 0 / 0 |

0202의 r1·r2를 모두 구현 FAIL로 두었던 round 22 판정은 대체한다. 명시된 오른쪽 증거를 구현하지 않은 D3은
실패로 유지하지만, 검증자가 새 oracle 단위·mutation을 발명해야만 보이는 D1·D2·D4는 planner가 Delta V로 정한다.

## 6-C Cross-document Consistency

- **PASS.** root AGENTS ↔ handoff AGENTS ↔ 네 SKILL ↔ 두 template이 `Baseline V / Delta V / 유효 V`,
  change-effect level selection, 선택적 적대 증거, 현재 변경 운영 gate를 같은 owner와 상태로 사용한다.
- normative 파일의 `G-SEC/G-DATA/G-DOC/G-REPO/G-SUBTREE` ID **0건**, 일반 hunk fallback **0건**이다.
  역사 round 22의 구 표현은 이 절의 명시적 supersede 대상이며 실행 정본이 아니다.
- 구현 보고 heading **7/7**, P heading **P1~P48 연속·중복 0**, 새 `handoff-vmodel` 디렉토리 0이다.
- skill 형식 **4/4 valid**, 문서 inventory·prose·relative links, `git diff --check`를 모두 통과했다.
- gate 명령·ABI 규칙·CI scope·commit trailer 허용값 변경 0이며 새 AGENTS/CLAUDE stub은 없다.

## review 기록 정책

`round23-review.md`를 만들지 않았다. 영구 결과는 지침과 이 절에 압축했고 기존 `round2-review.md` 1개만 유지한다.

## 남은 한계

- 어떤 pair가 적대 증거를 필요로 하는지는 위험 조건으로 좁혔지만 기계적으로 완전 결정할 수 없다. 검증자는 새 변이를 scope로 쓰지 말고 필요 oracle 누락이면 `PLAN_GAP`으로 반환한다.
- V는 잘못된 oracle 실행이나 gate 미실행을 자동으로 없애지 않는다. 구현자 자기확인과 검증자 독립 재측정은 계속 필요하다.

---

# review round 24 — 존재를 잠근 장치가 자리를 잠그지는 않는다

**발동**: 0204 impl 라운드 5(3 초과) + verify r4 FAIL + 같은 축(hop 무관측)의 2라운드 연속 재발. 사용자가 "지침 적용"을 명시해 **APPLY**로 수행했다(r5 사전 review 는 `DIAGNOSE_ONLY` 였다).

## 분류

| # | 이슈 | 분류 | 조치 |
|---|---|---|---|
| D15 | AT-29 가 세 섹션 본문 문구를 각각 `toContain` 해 배선 존재는 잠갔는데, `진행 상황`↔`출력` 본문을 맞바꾸면 44파일 423케이스가 전건 통과한다. AC29·D-022 위반이 반증되지 않는다 | **A** — impl §3 배선 문장이 *"배선을 **지운** 회귀"* 라고 써 존재 축만 지시한다. r4 는 그 문장을 정확히 수행했고 자리는 열린 채였다 — 정상 수행으로 막히지 않는다 | **신규 P49** — 자리 축 방향 규칙 + 형제 맞바꿈 변이 |
| D16 | r4 구현 커밋 trailer 가 `Agent: codex` 인데 ACTIVE D-014 는 Claude 다 | **F** — 0204 r5 가 고쳤다 | 문장 추가 없음 |
| D11·D12·D13 | 0204 의 열린 NON_BLOCKING 3건 | **F/관찰** — 그 handoff 범위 | 문장 추가 없음 |

**F 3건·관찰에 문장을 더하지 않았다.** A 1건 → 신규 P **1개**.

## Tier

**Tier 1.** "잠겼다"의 판정 기준이 바뀐다 — 소거 변이 검출만으로 배선 잠금을 인정하던 evidence semantics 에 자리 축이 추가된다.

## 6-A Operational Instruction Delta

- 삭제 **0줄, DELETE 0건** — 전부 **REPLACE(superset)** 또는 신규 bullet 이고 원 문장이 그대로 남는다. 편집한 6문장의 꼬리 문구를 편집 후 전문에서 역검색해 **6/6 잔존**(실측): `그 파일이 호출문을 죽은 코드로 들고 있다` · `여분의 사본·남은 잔여물에만 반응하지 않는다` · `배선 존재를 직접 보지 못하는 oracle은 plan의 선택 증거가 필요하다` · `잔여물 진단이 0이 될 때까지` · `일반 hunk를 자동 분모로 삼지 않는다` · `무엇을 어떻게 바꿨는가`.
- 신규 **8줄** — plan §5 자리 축 bullet 1 · plan READY self-review 꼬리 1 · impl §3 문장 1 · verify §4 bullet 1 · `plan.template.md` 안내 1 + 표 열 1 · `verify.template.md §4` 줄 1 · `docs/handoff/AGENTS.md` 최소 계약 2(구현·검증).
- 나머지 전 축 **KEEP** — trigger·owner·command·gate·human/agent 경계·INDEX/좌표·commit trailer 규칙 무변경.
- **새 명령 0건.** 맞바꿈 변이는 기존 스위트를 다시 돌리는 것이라 `app/AGENTS.md` ABI 규칙과 무관하다.
- reference/script **MOVE·REPLACE 0건**. corpus 편집은 P44·P48 `현재 방어` 꼬리와 말미 P49 추가뿐이라 기존 line-scoped inbound 는 이동하지 않는다. P heading **P1~P49 연속·중복 0**(실측).

## 6-B Historical Failure Regression

- **49 P 전수** · 변경 후 **COVERED 49 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · 신규 **1**(P49).
- 삭제가 0건이므로 기존 48건의 causal defense mapping 은 구성상 보존된다. 편집한 사이트를 `현재 방어`로 인용하는 P 는 **11건**(P39~P49, 기계 추출)이고 그 11건의 방어 문장은 전부 잔존한다.
- 방어가 **강화된 2건**: **P44**(배선이 형제 슬롯을 고르는 자리면 지운 변이 검출이 잠금을 뜻하지 않음을 명시) · **P48**(방향이 한 축이 아님을 명시 — r4 가 P48 을 정상 만족하고도 D15 를 못 막은 자리다).
- **P37 과의 경계를 P49 본문에 명시**했다 — P37 은 semantic 목표를 structural proxy 로 검증한 경우, P48 은 방향이 뒤집힌 경우, P49 는 시야·방향은 맞고 **해상도가 계약보다 거친** 경우다.
- **회귀 위험 3건을 능동 차단**:
  **FAIL inflation** — 새 문장의 발동 조건을 `형제 슬롯이 서로 다른 계약을 가지면`으로 못 박았고, impl §3 의 기존 꼬리(`그 밖의 hunk와 직접 행동 oracle에는 mutation을 새로 발명하지 않으며, mutation 부재만으로 실패 범위를 늘리지 않는다`)를 그대로 남겼다. 직접 행동 oracle 로 충분한 pair 는 분모에 들어오지 않는다.
  **P22·P18(하치장)** — `verify.template.md` 의 `해당 없음 — 형제 슬롯 없음`은 기계로 판정 가능한 조건이다(형제 슬롯 존재 여부). P48 의 `해당 없음` 가드와 같은 성질이라 회피구가 되지 않는다.
  **P38(지목 지점만 닫음)** — P49 규칙문이 `분모는 형제 전수다(P38)`를 명시해 두 패턴을 연결했다. 0204 r5 가 지목 1지점이 아니라 형제 3지점을 닫은 것이 그 대표 evidence 다.
- **P41(전수를 도구가 정의)·P30·P35(음성 게이트)** 무영향 — 새 문장은 스윕 분모나 음성 술어 규칙을 건드리지 않는다.

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 자리 축 방향 **3**(plan `SKILL.md` §5 + READY self-review · corpus P49) · 형제 맞바꿈 변이 **6**(impl `SKILL.md` · verify `SKILL.md` · `plan.template.md` ×2 · `verify.template.md` · corpus P49) · 최소 계약 **2**(`docs/handoff/AGENTS.md` 구현·검증).
- **owner 충돌 0** — 설계자가 자리 축 방향을 고르고(plan §5), 구현자가 맞바꿈 변이를 심고(impl §3), 검증자가 다시 센다(verify §4). 기존 "구현자가 닫고 검증자가 다시 센다" 쌍과 같은 관계이고 어느 쪽도 상대를 면제하지 않는다.
- **발동 조건 문면 통일 1건 정정** — 초안의 impl §3 은 `배선이 형제 슬롯 중 하나를 고르는 자리면`으로 verify·AGENTS(`형제 슬롯이 서로 다른 계약을 가지면`)보다 **좁았다**. 구현자 발동 조건이 검증자보다 좁으면 검증자가 재는 것을 구현자가 안 하게 되므로 같은 문면으로 맞췄다(실측: 세 파일 4건 동일 술어).
- **scope 충돌 0** — 새 문장은 전부 기존 mutation 규칙의 *조건부 확장*이고 새 게이트·새 명령을 만들지 않는다.
- **stale 사본 0** — 편집한 6문장의 구 버전 꼬리를 skills/docs 전문에서 역검색해 잔존 0건.
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok**.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.

## review 기록 정책

`round24-review.md`를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다. 기존 `round2-review.md` 1개 유지(라운드 문서는 동시에 1개). 신규 P **1**(P49) — 기존 P 로 환원되지 않는 새 causal class 다(장치의 *해상도*).

## 남은 한계

- **형제 슬롯의 판별은 사람/에이전트의 읽기다.** "이 둘이 서로 다른 계약인가"를 기계로 세는 명령이 없다 — 0204 는 `rg "<TileSection"` 로 3지점을 셀 수 있었지만 일반 형태의 스윕은 없다.
- **맞바꿈 변이는 컴파일되는 쌍에만 심을 수 있다.** 형제 슬롯의 타입이 다르면 맞바꿈이 타입 오류로 먼저 걸리는데, 그 red 는 잠금이 아니라 P48 이 말하는 잔여물 진단일 수 있다 — 그때는 타입이 자리를 잠근 것인지 따로 판정해야 한다.
- 0204 검증 환경은 `npm ci --ignore-scripts` 라 better-sqlite3 바인딩이 없다(5파일 46케이스 red, `app/AGENTS.md` 실측 서명과 동일). round 15~19 와 같은 한계이고 round 20 처럼 완주하지 못했다.

---

# review round 24 — 0209 (라운드 5→9): 장치 교체로 시야가 좁아졌고, 분모를 claim에서 유도하지 않았다

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 장치를 교체하며 구 장치가 잡던 자리를 잃었고, 두 라운드 보고 모두 자기 장치가 잡는 것만 적었다 | 0209 r5 소스 텍스트 단언이 배선 삭제 변이를 red 로 잡았고, r6 이 그것을 fake 주입 seam 으로 바꾸자 삭제 변이·결과 폐기 변이가 모두 green | **A** — 신규 causal class(시간축). impl §3 규칙 + verify §4 이전 라운드 대조 + 양 template + corpus **P50** |
| 2 | `SELF_PASS`·`closed` 를 적으면서 그 claim 이 정하는 변이가 잠금 표에 없었다 | 0209 r6~r9 가 매 라운드 자기가 고른 변이 1줄만 적고 VP-05 등록 변이·D18 인용 변이를 네 라운드 동안 실행하지 않았다 | **A** — 규칙(impl §5·§3)은 있었으나 분모를 claim 에서 유도하는 장치가 없었다. impl §8 검산 줄 + `plan.template.md` 분모 검산. AC 축의 `합계 검산`(P40)을 변이 축으로 이식 |
| 3 | 밀린 verify 를 앞에 두고 외부 CI 보고로 세 라운드가 더 돌았다(r7·r8·r9) | 보드는 r6·r7·r8 뒤 모두 `다음 주체 = Claude` 였고 매번 묻지 않고 재구현했다 | **A** — 규칙은 있었으나 발동 조건이 너무 넓어 따를 수 없었다(자기 커밋의 red gate 까지 질문 대상). `docs/handoff/AGENTS.md` + impl §0 을 2갈래로 **narrowing** |
| 4 | testability seam 을 만들며 production 을 재배치해 등록↔반납 짝이 갈렸다 | 0209 r6 이 `supervisor.startNew(turn)` 을 콜백 안으로 옮겼고 `leaderTurn = turn` 은 밖에 남아, 확보가 reject 하면 `finally` 의 `supervisor.release` 가 실행되지 않는다 | **F**(이번 구현 결함) + **A**(그 표면을 §3 으로 다시 보게 하는 조건절 부재). impl §5.3 한 절 + `plan.template.md` Product/UX 행 |
| 5 | D18 을 인용 변이가 아닌 자기 변이로 닫았다 | 인용 변이 `executionCwd 미대입` 대신 `prepareTurnExecution` 내부 변이를 심었다 | **B** — impl §5 가 이미 명시한다(`이슈가 변이를 인용했다면 닫힘의 관측값은 그 변이가 이제 검출된다는 것`). 문장 반복 대신 #2 의 분모 검산으로 강제 |

## Tier

**Tier 1.** trigger(외부 피드백 순서 질의 분기) · evidence(잠금 표 분모 검산 · 이전 라운드 대조) · required field(잠금 표 신규 열)가 모두 normative 다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

순수 삭제 줄 **6건**, 전부 같은 자리에서 대체됐다 — 설명 없이 사라진 항목 **0건**.

| 항목 | 판정 | 근거 |
|---|---|---|
| `docs/handoff/AGENTS.md` 외부 피드백 순서 질의 | **REPLACE** | 무조건 질의 → 2갈래. 0188 이 겪은 케이스(새 결함·설계 의견)는 그대로 묻고, 라벨 방어(`impl/IMPL_DONE` 유지 · verify 밀림 명시)를 새 문면에 보존했다 |
| impl §0 같은 규칙 사본 | **REPLACE** | AGENTS 와 같은 2갈래로 동기화 |
| impl §5.3 "새 표면에 §3 다시" | **KEEP + 확장** | 원문 그대로 두고 재배치 절만 덧댔다 |
| `plan.template.md` 잠금 표 헤더 | **REPLACE** | 4열 → 5열. 기존 4열의 의미·문면 불변, `이전 라운드 결과` 추가 |
| corpus P44 `현재 방어` | **KEEP + 확장** | 기존 문장 그대로, P50 링크만 추가 |
| 명령·gate·reference 삭제 | **없음** | 삭제 6줄 중 명령·경로를 담은 줄 0건 |

- 방어 앵커 실재 재검사: `plan §5`·`§5-A`·`impl §2/3/5/6/7/8`·`verify §0/2/4/6/9`·양 template·AGENTS 2절 = **죽은 앵커 0건**. (중간에 `^## ` 만 훑어 `plan §5` 를 stale 로 오판했다 — plan SKILL 은 `# 5.` 레벨-1 번호 헤딩이다.)

## 6-B Historical Failure Regression

- **50 P 전수** · 변경 후 **COVERED 50 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · 신규 **1**(P50).
- 편집 사이트를 `현재 방어`로 인용하는 P **11건**(P39~P45·P47~P50, 기계 추출) — 인용된 방어 문장은 전부 잔존하고 삭제 0건이므로 나머지 39건의 mapping 은 구성상 보존된다.
- **P38 개별 확인**(0188 라운드 10회·verify 턴 0회). 순서 질의 narrowing 이 이 방어를 되열지 않는다 — 허용한 것은 *자기 산출물의 red gate 수정* 하나뿐이고, 그것은 lifecycle 상 라운드가 끝나지 않았다는 뜻이다. 새 결함·설계 의견은 그대로 질의 대상이고 보드 라벨 방어도 문면에 남겼다.
- 방어가 **강화된 2건**: **P44**(시간축은 P50 이 잡는다는 경계 추가) · **P40**(합계 검산의 성질을 변이 축으로 확장 — 분모를 claim 에서 유도).
- **P37·P48·P49 와의 경계를 P50 본문에 명시**했다 — P44 는 *시야 밖*, P48 은 *방향*, P49 는 *해상도*, P50 은 **시간축**(라운드 N 의 시야가 N+1 에서 좁아짐)이다.
- **회귀 위험 2건 능동 차단**: **FAIL inflation** — 분모 검산의 세 갈래를 `SELF_PASS 로 올린 pair` · `closed 로 적은 이슈` · `이번 턴에 만든 oracle` 로 한정해, 주장하지 않은 pair 는 분모에 들어오지 않는다. impl §3 의 기존 꼬리(`mutation 부재만으로 실패 범위를 늘리지 않는다`)도 그대로다. **P22(하치장)** — 덮개 회귀 판정은 `이전 라운드 red 변이 재실행`이라는 기계 관측이라 사람 실기로 넘길 자리가 없다.

## 6-C Cross-document Consistency

- **PASS.** 규칙 사이트 — 덮개 회귀 **5**(impl `SKILL.md` · verify `SKILL.md` · `plan.template.md` · `verify.template.md` · AGENTS 검증 최소 계약) · 분모 검산 **3**(impl `SKILL.md` · `plan.template.md` · AGENTS 구현 최소 계약) · 순서 질의 **2**(AGENTS · impl §0).
- **owner 충돌 0** — 구현자가 교체 전 장치의 변이를 다시 확인하고(impl §3), 검증자가 이전 라운드 결과와 나란히 재측정한다(verify §4). 기존 "구현자가 닫고 검증자가 다시 센다" 와 같은 관계다.
- **scope 충돌 0** — 새 문장은 전부 기존 mutation·보고 규칙의 조건부 확장이고 새 게이트·새 명령을 만들지 않는다. `app/AGENTS.md` 의 ABI·egress 규칙과 겹치는 면이 없다.
- **skill 미가용 환경 동기화** — AGENTS §단계별 절차 2·3 의 최소 계약에 분모 검산·덮개 회귀 문장을 미러링했다. skill 을 못 읽는 구현자·검증자도 두 규칙을 받는다.
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated ok · prose ok · **links ok**.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.

## review 기록 정책

`round24-review.md`를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다. 기존 `round2-review.md` 1개 유지. 신규 P **1**(P50) — 기존 P 로 환원되지 않는 새 causal class(시간축)다.

## 남은 한계

- **덮개 회귀 판정은 이전 라운드가 그 변이를 실제로 실행했을 때만 성립한다.** 이전 verify 가 변이를 실행하지 않았으면 비교 대상이 없고, `미실행` 은 `green` 과 구분되지만 회귀 여부는 말하지 않는다.
- **분모 검산은 claim 을 줄여서도 맞출 수 있다.** `SELF_PASS` 대신 전부 `SELF_BLOCKED` 로 적으면 분모가 0이 된다 — 그 축은 검증자의 pair closeout 이 잡고, 이 규칙이 대체하지 않는다.
- 0209 검증 환경은 Electron 바이너리가 없어 `chat-turn.continuity.test.ts` 가 0건 수집이다(r1~r9 동일). **`handleChatSend` 를 지나는 유일한 스위트**라 `send.ts` 배선은 electron 비의존 seam 없이는 이 환경에서 닫히지 않는다 — 지침으로 해결되지 않는 capability 한계다.

---

# review round 25 — 0209 (라운드 11): 구현자와 검증자가 같으면 보고된 목록의 재실행은 독립 재측정이 아니다

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 구현자↔검증자 겹침에 실행 결과가 붙어 있지 않다 — 사실만 기록되고 아무 증거도 요구되지 않는다 | 0209 r11 은 구현·검증이 같은 에이전트인 첫 라운드였고 보고된 잠금 10행은 전건 red 로 재현됐다. 결함 D29 는 보고에 **없던** 축(M-W·M-O3·M-O4 + §10 분모 독립 재열거)에서만 나왔다 | **A** — 신규 causal class. verify §책임·§4 · `verify.template.md` 메타+§4 · `docs/handoff/AGENTS.md §검증 최소 계약` · corpus **P51** |
| 2 | 분모의 술어를 코드의 라벨로 대신하면 라벨이 틀린 만큼 분모가 조용히 줄어든다 | r11 이 `mutation` 의 주어를 `readOnly: true` 플래그로 대신해 `4/4` 를 보고했고, 그 플래그를 단 8건 중 `stash push`·`commit -a`·`reset --hard` 셋이 상태를 바꾸는 명령이었다 | **A**(기존 규칙 정밀화) — impl §2 의 "술어는 불변식의 주어" 에 라벨 절 추가 · verify §6 에 표본 확인 절 · P41↔P51 상호 링크 |
| 3 | round 24 가 넣은 두 규칙이 실제로 발동했다 | r11 이 `분모 검산`(선택 증거 4 · 인용 변이 2 · 새 oracle 4 = 10행)과 `덮개 회귀 0건 대조`를 수행했고, AC 자기보고·강제 지점 자기보고가 재측정과 **0행·0군 불일치**였다(이 handoff 첫 사례) | **조치 없음** — 규칙이 목적대로 작동한 증거로만 기록 |

## Tier

**Tier 1.** evidence(자기검증 분모) · 판정 절차(라벨 술어 확인)가 normative 다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

순수 삭제 줄 **4건**, 전부 같은 자리에서 원문을 보존한 채 확장됐다 — 설명 없이 사라진 항목 **0건**.

| 항목 | 판정 | 근거 |
|---|---|---|
| impl §2 "술어는 불변식의 주어" | **KEEP + 확장** | 원문 문장 그대로 두고 라벨 절과 0209 사례만 덧댔다 |
| verify §책임 "처음 보는 남의 PR처럼" | **KEEP + 확장** | 태도 문장 유지, §4 연결 추가 |
| verify §6 `§10 별도 분모` 문단 | **KEEP + 확장** | 재열거 요구 유지, 라벨 표본 확인 추가 |
| `verify.template.md` 메타 `자기 검증 여부` | **KEEP + 확장** | 칸의 의미(동일 에이전트인가) 유지, 결과 기입 요구 추가 |
| corpus P41 `현재 방어` | **KEEP + 확장** | 기존 문장 그대로, P51 역링크만 추가 |
| 명령·gate·reference 삭제 | **없음** | 삭제 4줄에 명령·경로 0건 |

- 방어 앵커 실재 재검사: `plan §5`·`§5-A` · `impl §2/3/5/6/7/8` · `verify §책임/§0/§2/§4/§6/§9` · 양 template · AGENTS 검증계약 = **죽은 앵커 0건**.

## 6-B Historical Failure Regression

- **51 P 전수** · 변경 후 **COVERED 51 / PARTIAL 0 / GAP 0 / OBSOLETE 0** · 신규 **1**(P51).
- 편집 사이트를 `현재 방어`로 인용하는 P **13건**(P39~P51, 기계 추출) — 인용된 방어 문장이 전부 잔존하고 삭제가 0건이라 나머지 38건의 mapping 은 구성상 보존된다.
- **P41 개별 확인**(전수를 도구가 정의). 새 라벨 절이 P41 을 좁히지 않는다 — P41 은 *스윕 도구*가, P51 곁규칙은 *코드의 주석·플래그*가 분류를 정의한 경우로 서로 배타적이고 양방향 링크를 걸었다.
- **P39·P40 개별 확인**(자기보고 재현·합계 축). 자기검증 분모 규칙은 자기보고를 **더** 의심하는 방향이라 두 방어를 약화하지 않는다.
- **FAIL inflation 차단**: 새 규칙의 발동 조건을 `구현자 = 이번 라운드의 검증자` 로 못 박았다. 분리 환경(0209 r1~r10 포함 대부분)에서는 발동하지 않으므로 기존 라운드의 판정 범위가 넓어지지 않는다.
- **거짓 PASS 차단**: 축을 만들지 못한 경우의 처리를 "그 사실을 적고 PASS 로 올리지 않는다" 로 고정해, 자기검증 라운드가 기록만 남기고 통과하는 길을 막았다.

## 6-C Cross-document Consistency

- **PASS.** 자기검증 분모 규칙 **4사이트**(verify `SKILL.md` · `verify.template.md` 메타 + §4 · `docs/handoff/AGENTS.md` 검증 최소 계약 · corpus P51) · 라벨 술어 **3사이트**(impl `SKILL.md` §2 · verify `SKILL.md` §6 · corpus P41↔P51).
- **문면 통일 1건 정정** — 초안의 `verify.template.md` 가 `보고가 이름 대지 않은` 으로 조사를 빠뜨려 SKILL·AGENTS 의 `구현 보고가 이름을 대지 않은` 과 갈렸다. 세 사이트를 같은 문면으로 맞췄다(실측 1/1/1).
- **owner 충돌 0** — 구현자는 분모를 세고(impl §2), 검증자는 그 라벨을 표본으로 되짚고(verify §6), 자기검증일 때만 축을 추가한다(verify §4). 기존 "구현자가 닫고 검증자가 다시 센다" 와 같은 관계다.
- **scope 충돌 0** — 새 문장은 기존 분모·재측정 규칙의 조건부 확장이고 새 게이트·새 명령을 만들지 않는다. `app/AGENTS.md` 의 ABI·egress 규칙과 겹치지 않는다.
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated · prose · **links ok**.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.

## review 기록 정책

`round25-review.md` 를 만들지 않았다 — 압축으로 잃는 rationale 이 없고 사용자 보존 요구도 없었다. 기존 `round2-review.md` 1개 유지. 신규 P **1**(P51) — 기존 P 로 환원되지 않는 새 causal class(역할 겹침의 분모 축)다.

## 남은 한계

- **자기검증 분모 규칙은 "축을 하나 더 만들라"까지만 말한다.** 그 축이 실제로 사각을 겨냥하는지는 같은 에이전트가 판단하므로, 규칙은 사각의 존재 확률을 낮출 뿐 없애지 못한다. **분리 환경의 대체물이 아니다.**
- **라벨 표본 확인은 표본이다.** 라벨이 붙은 항목이 많으면 전수 확인이 비싸고, 규칙은 "표본으로 확인" 까지만 요구한다.
- 0209 검증 환경은 Electron 바이너리가 없어 `chat-turn.continuity.test.ts` 가 0건 수집이고(r1~r11 동일), Windows 경로 표기 검증은 CI 러너 몫이다 — 지침으로 해결되지 않는 capability 한계다.

---

# review round 26 — 0211 (라운드 4~5): "직접 oracle" 은 선언이었고, 그 선언을 검사하는 자리가 없었다

**발동/모드**: 0211 impl 라운드가 4를 초과했다(라운드 3 verify 가 지시했으나 미수행 — r4 D44).
사용자 요청은 "verify 지적사항을 보완하라"(구현)였고 지침 변경 요청이 아니다 → **`DIAGNOSE_ONLY`**.
후속 턴에서 사용자가 A 후보 적용을 명시적으로 보류하고 "기록까지" 를 지시했다. **지침 파일 변경 0건.**

## 발견 1 (주 원인) — 닫힘 증거가 게이트에 남지 않는 매체여도 규칙이 허용한다

같은 축이 **다섯 라운드 연속**이다 — r1 D1~D6("AC 가 이름 붙인 오라클이 없고 구조 스윕이 그 자리를
대신했다") → r2 D16 → r3 D22 → r3' D25~D27 → r4 D35~D40.

r4 의 차단 9행 중 **6행**이 `[구현자 기입]` 에서 **브라우저 fixture 실측**을 닫힘 증거로 인용한
지점이다. 실측값은 전부 참이었다 — 게이트에 남지 않았을 뿐이고, 그래서 r4 가 같은 지점을 green 으로
재현했다.

| 자기보고 전수 | 인용한 관측 | r4 재측정 |
|---|---|---|
| EP-53 `5/5` | "브라우저 32/24/240px 실측" — 목록에 `RightPanelTile 헤더 32px` 가 있다 | D39 · M29 **green** |
| EP-61 `2/2` (AT-87 ✅) | "7줄 입력 자동 높이 122/122px" | D40 · M50 **green** |
| EP-71 `4/4` | "브라우저 양쪽 selected border rgb(31,104,189)" | D37 · M13 **green** |
| EP-73 `4/4` | "브라우저 미싱크→조회→실패→재시도 status 4/summary 3" | D36 · M42·M43 **green** |
| EP-76 `3/3` | "실제 GitRow 브라우저에서 재열기 status=2 유지" | D35 · M41·M8 **green** |
| EP-77 `3/3` | "본문 중심 대비 텍스트 중심 x=-0.006px/y=-0.700px" | D38 · M5 **green** |

나머지 3행(D25~D27)은 브라우저 축이 아니라 팩토리 단위 테스트가 배선을 대신한 **P44 형태**다.

**A(coverage gap).** 방어 문장은 셋 다 있었고 전부 이 실패를 통과시킨다.

- `handoff-plan` — pair 에 "직접 oracle 을 둔다". **좌표를 요구하지 않는다**: ΔV7~ΔV14 의 pair 칸은
  "호출 횟수와 snapshot 값을 직접 관측한다" 처럼 *관측의 서술*이고, 그 서술은 존재하지 않는 오라클에
  대해서도 참이다.
- `handoff-impl` §8 — "산출물에서 다시 찾은 표식". `x=-0.006px` 는 **이번 턴에 실제로 관측한 값**이라
  문면을 만족한다. 규칙이 증거의 *내용*은 제약하고 *지속성*은 제약하지 않는다.
- `handoff-verify` §0 — "나머지는 직접 oracle 로 충분한 이유가 있는가". 이유는 매 revision 적혀
  있었다("직접 반환값·렌더 결과·실제 브라우저 호출 횟수 oracle 이다"). 검사할 좌표가 없다.

**새 causal class 다.** P33 은 *이름 댄* 테스트가 실재하지 않는 경우라 impl 의 "그 케이스가 실제로
존재하는지 확인" 이 발동하는데, 여기서는 아무것도 이름 대지 않아 발동할 대상이 없다. P44 는 증상이고
이것이 그 증상을 5라운드 살려 둔 원인이다.

**패치 형태(미적용)**: pair 표의 `직접 evidence oracle` 과 impl 전수 행이 **좌표**(`파일:테스트명`)를
싣게 하고, 그 좌표가 이번 변경의 게이트 실행 집합에 드는지 확인한다. 사람 실기로만 닫히는 지점은
`사람 실기로 남김` 으로 적고 `N/N` 에 세지 않는다. Tier 1.

## 발견 2 — 열린 root 위에 8 revision (직전 턴의 A 후보 ②를 내린다)

**C, 지침 변경 후보에서 제외.** ΔV7~ΔV14 **8건 전부**가 본문에 차단 유지를 적었다 — revision 단위로
잘라 대조한 **차집합이 `[]`** 다(문면은 revision 마다 다르다: ΔV14 "이번 AC 분모와 별도" · ΔV13 "차단은
유지한다" · ΔV11 "이번 요청 밖으로 유지"). 은폐 0, 사용자가 볼 수 있는 자리에 매번 공개됐다. 사용자는 매 revision 새 기능을 요청했고
에이전트가 순서를 정했다. `handoff-impl` §0 의 질의 발동 조건을 "사용자 신규 요청" 까지 넓히면 모든
사용자 요청 앞에 질문이 붙는데, 실제 비용은 verify 가 D25~D27 을 세 라운드에 걸쳐 재측정한 변이
3회뿐이다. **비용이 이득보다 크다.**

## 발견 3 — 검증자가 인용한 변이가 등가면 그 행은 정의상 닫히지 않는다

r5 가 D27 인용 변이(`chatStore` 의 `case 'turn.ended'` 절 삭제)를 심어 **green** 을 실측했고, 원인은
`chatStore.ts:644` 의 `default:` 가 같은 `dispatchTo(RECV_EVENT)` 를 하는 **등가 변이**이기 때문이다.
r5 는 규칙("인용 변이가 검출되지 않으면 그 이슈는 닫히지 않았다")을 지켜 `부분 closed` 로 남겼다 —
규칙을 지킨 결과가 영구 미해결 행이다.

**작은 A.** `handoff-verify` §4 는 *구현자가 보고한* 차이를 다루지만, **검증자 자신이 고른 변이가
등가로 밝혀졌을 때**의 처리가 없다. 패치 형태(미적용): 등가로 판정되면 verify 가 그 행의 변이를
교체하고 등가 근거를 좌표로 남긴다. Tier 1.

## 문장을 더하지 않은 것

- **자기보고 합계 불일치**(ΔV14 `EP 9/9`↔재계수 `7/9` · `✅3`↔`✅1 ⚠️2`) — **B**. impl §8 의 검산
  규칙(행·합계 별개 · `✅N·⚠️M·❌K=총T` · trailer 는 못 고치는 사본)이 이미 요구한다. 발견 1 이 닫히면
  이 합계도 함께 옳아진다 — `9/9` 가 틀린 이유가 브라우저 실측을 지점 닫힘으로 센 것이기 때문이다.
- **설계 커밋 12건이 `Agent: codex`** — 비귀속. root `AGENTS.md` 커밋 프로토콜이 "설계 커밋(Claude)" 로
  *역할* 과 *에이전트 정체* 를 묶어, codex 가 설계하면 정확한 기록이 규약 위반이 된다. 문면을 역할
  기준으로 푸는 것은 다음 APPLY 후보로만 둔다.
- **Decision drift 0** — `SUPERSEDED` **82줄(83회)** 중 표본 8건이 전부 사용자 인용 또는 명시적 대체
  관계를 갖는다. **D 유형 오염 0.**

## Tier 판정

**대상 없음.** SKILL/template/AGENTS/corpus 변경 0건이므로 6-A·6-B·6-C 를 수행하지 않는다
(round 21 선례 — 지침을 바꿀 때 수행한다). 신규 P **0** — 발견 1 은 새 causal class 이지만 §7 에 따라
**지침 변경과 함께** corpus 에 넣는다. 사례만 먼저 쌓지 않는다.

## 지침으로 해결할 수 없는 한계

- **브라우저 fixture 자체는 옳은 도구다.** 계산색·중심 정렬·실제 클릭 순서는 그것으로만 볼 수 있고,
  0211 은 그 도구로 실제 결함을 여러 번 잡았다(ΔV12 격리 ON 잔류 · ΔV11 메뉴 726.35px 넘침). 규칙이
  바꿀 수 있는 것은 "그 관측이 §10 지점을 닫는가" 뿐이지 도구의 사용 여부가 아니다.
- r5 검증 환경은 egress 가 열려 electron 바이너리까지 받았다 — r1~r4 가 분리 보고하던 ABI·electron
  한계가 **0** 이다. 라운드마다 갈리는 축이라 지침으로 고정할 수 없다.

---

# review round 27 — 0211 (라운드 6): 전수 스윕이 §10 **항목**에서 멈췄다

**발동/모드**: 라운드 6 > 3 이고 r6 verify §12·§13 이 "라운드 7 착수 전 `handoff-review`" 를 명시했다
(r5 의 면제는 라운드 6 한정). 모드 **`DIAGNOSE_ONLY`** — 사용자가 round 26 에서 "지금은 적용하지
않는다" · "기록까지" 를 정했고 이번 턴 요청은 `/handoff-impl 211`(구현)이다. **지침 파일 변경 0건.**

## 발견 1 (주 원인) — 분모의 단위가 `§10 항목`인데 불변식이 사는 자리는 그 항목 **안**에 여럿이다

r6 구현 보고는 `EP-71 (4)` 를 네 항목으로 세어 `4/4` 를 적었고, 각 항목 안의 자리 수를 세지
않았다(① cleanup · ④ reveal 2인자). 검증자가 그 안에서 blocking 2건을 찾았다(D49·D50).

**같은 멈춤이 검증자 열거에도 있다.** 이번 review 가 `activeDiffRequirementId` 를 코드에서 직접
재열거한 값은 **cleanup 8자리**다.

| 자리 | 리듀서 좌표 |
|---|---|
| 수동 범위 전환 · 명시 해제 · 범위 바뀐 요약 수신 | `SET_DIFF_COMPARISON` · `SELECT_DIFF_REQUIREMENT(id=null)` · `RECEIVE_GIT_SNAPSHOT_SUMMARY(changed)` |
| 삭제 · draft 열기 · 성공 clear | `REMOVE_DIFF_REQUIREMENT` · `SET_DIFF_REQUIREMENT_DRAFT` · `CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED` |
| cwd 초기화 **2 호출부** | `resetGitReview` @ `session.updated` cwd 변경 · @ `SET_CWD` |

r6 verify 의 D50 은 **5자리**로 셌다(4 + D51). 차집합 **3자리** — `SELECT(id=null)` ·
`RECEIVE_GIT_SNAPSHOT_SUMMARY(changed)` · cwd 두 번째 호출부.

**A(trigger gap).** `handoff-impl` §2 는 이미 "설계자가 적은 분모에 구현자가 그대로 맞추면 `N/N` 은
아무것도 말하지 않는다" 와 "그 행의 지점 수도 전수 검색으로 세고 **검색 명령을 함께 적는다**" 를
갖는다. 그런데 그 검색 명령 요구의 발동 조건이 **"plan 정정으로 §10 행이 신설되면"** 이라, r6 처럼
기존 행(EP-71)을 세는 라운드에는 걸리지 않는다. 정상 수행해도 항목 수로 닫힌다.

**패치 형태(미적용)**: 검색 명령 요구를 신설 행 → **전수표의 모든 행**으로 넓히고, 각 행이
`항목 수`가 아니라 `자리 수 + 그 수를 낸 검색 명령`을 싣게 한다. Tier 1.

## 발견 2 — 자기검증 분모가 두 라운드 연속 **유일한** blocking 원천이다 (유지)

| 라운드 | 보고 밖 축 | green | 그 라운드 blocking |
|---|---|---|---|
| r5 | 10 | 5 | D46·D47·D48 — 전부 이 축 |
| r6 | 9 | 4 | D49·D50(+D51·D52) — 전부 이 축 |

구현자 보고 분모에서 나온 blocking 은 **2라운드 연속 0건**이다. round 25 가 만든 `handoff-verify` §4
자기검증 분모 규칙이 작동하고 있다 — **변경 없이 유지**한다.

## 발견 3 — round 26 의 주 원인은 재발 0 (다만 규칙이 아니라 관행이 지켰다)

r6 구현은 프로덕션을 한 줄도 바꾸지 않고 렌더 테스트로만 닫았고, 일회성 브라우저 실측을 닫힘
증거로 쓴 자리가 **0** 이다(r5·r6 verify 가 그 축에서 낸 finding 0). round 26 은 지침을 바꾸지
않았으므로 이 개선은 **규칙이 아니라 이번 구현자의 관행**이다.

## 문장을 더하지 않은 것

- **D49**(fixture 가 `scrollOwnerRef: { current: null }` 을 넣어 인자를 죽였다) — **B**. verify §4 의
  형제 슬롯 규칙과 impl §3 의 직접 oracle 규칙이 이미 요구한다.
- **D53**(plan·verify 인용 해시 68 중 3 이 죽은 좌표) — **B**. verify §9 가 "인용된 커밋 해시가
  실재하는지 확인한다" 를 이미 갖는다.
- **D54**(`loopback-callback.test.ts` 고정 포트 45214 충돌) — **E**. 환경 한계이고 지침 대상이 아니다.
- **Decision drift 0** — r5·r6 두 라운드 Decision 변경 0건. **D 유형 오염 0.**

## Tier 판정

**대상 없음.** SKILL/template/AGENTS/corpus 변경 0건이므로 6-A·6-B·6-C 를 수행하지 않는다
(round 21·26 선례). 신규 P **0** — 발견 1 은 round 26 발견 1 의 인접 축이고, §7 에 따라 **지침 변경과
함께** corpus 에 넣는다.

## 지침으로 해결할 수 없는 한계

- **분모를 넓히면 그 분모를 세는 눈도 넓어져야 한다.** 이번 review 가 검증자 열거보다 3자리를 더
  찾았듯, 어떤 열거도 다음 열거가 더 찾을 수 있다. 규칙은 `검색 명령을 남겨 재열거를 가능하게`
  까지만 할 수 있고 열거의 완결성 자체를 보장하지 못한다.
- 검증 환경: DOM 없음(jsdom 미설치)은 r5 의 react 대역 하네스로 우회됐고, 고정 포트 충돌(D54)은
  테스트 코드 문제라 지침 밖이다.

---

# review round 28 — 0238 (라운드 3→4): 등록 변이에 자리가 없고, SUPERSEDED가 증거를 떨궜다

**발동/모드**: 0238 r3 verify FAIL로 라운드 4 > 3(`docs/handoff/AGENTS.md §handoff-review 트리거`). 사용자가 `/handoff-review 238` 후 진단 보고에 **APPLY** 를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 등록 변이에 심을 자리가 없고 분모를 §10 **항목**으로 세어, 같은 pair 경로의 다른 edge가 남는다 | VP-10 `callback 맞바꿈` — r2 독립 검증자·r3 구현자 모두 컴포넌트 안 onClick만 심음. `ProviderDetail` props 맞바꿈은 808케이스 green(D14). round 27 발견 1(0211 r6 `EP-71 (4)`)과 같은 원인의 재발 | **A** — round 27 미적용 패치 흡수. AGENTS §공통 V·절차 2·3 · plan §5-A · plan.template · impl §2·§3 · verify §0·§4 · verify.template · corpus **P52** |
| 2 | pair를 `SUPERSEDED`로 분해할 때 그 pair가 들던 AC·적대 증거의 행방을 요구하지 않는다 | ΔV1이 V1 VP-06·12의 `header를 option으로 계산` 변이를 어디에도 옮기지 않아 AC11 controller 키보드가 미잠금(D16, S5a~c green) | **A** — 신규 causal class. AGENTS §공통 V · plan §5-A · plan.template · verify §0 · verify.template · corpus **P53** |
| 3 | 좌표 규칙의 주어가 구현자뿐이다 | ΔV1 설계가 INDEX·plan 메타에 `651d9080`·`6030afae`~`2c7dad51`(전부 공유 브랜치에 없음)을 적었다(D13) | **A**(P47 범위 확장) — AGENTS §INDEX.md 운영·절차 1 · plan §5-A·마무리 · plan.template · corpus P47 보강 |
| 4 | r1·r2가 등록 변이를 production 자리에 심지 않았고(JSX가 안 읽는 상수만 잠금), 죽은 hook에 oracle을 뒀다 | r2 verify D4~D8 | **B** — impl §3·§8, P37·P44·P50이 이미 요구. 문장 추가 없음 |
| 5 | D1 `/` skill 회귀 · D2 빈 그룹 · D3 chip 경계 | 계약(V1 §5·AC12·AC25)은 명시돼 있었다 | **F** |
| 6 | ΔV1 사용자 변경 4건 | D-014~D-021 | **D** — supersede 보존 확인, 학습 대상 아님. Decision drift 0 |
| 7 | 자기검증 축이 blocking의 유일한 원천(0211 r5·r6, 0238 r3 연속) | 0238 r3 신설 축 15 중 green 7, D14는 그 축에서만 나왔다 | **유지**. 발견 1이 그 축의 "같은 결함의 다른 자리"를 독립 검증에도 걸리게 한다 |

## Tier

**Tier 1.** 분모 단위·변이 적용 자리·plan validity의 `PLAN_GAP` 조건·좌표 owner가 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

삭제 줄 **15**(`git diff -U0`), 그중 원문이 새 파일에 그대로 남은 줄 9, 문장이 바뀐 줄 6 — 전부 상위집합으로 교체.

| 항목 | 판정 | 근거 |
|---|---|---|
| impl §2 "plan 정정으로 §10 행이 신설되면 … 검색 명령" | **REPLACE** | 발동 조건 `신설 행` → `모든 행`, 단위 `항목` → `자리`. 구 규칙이 막던 0194 r3 사례를 그대로 막고 문장·사례 보존 |
| AGENTS 구현 최소 계약 "네가 행을 신설하면 …" | **REPLACE** | 위와 같은 상위집합 |
| AGENTS §INDEX 운영 "구현자는 자리표시자" | **REPLACE** | 주어 `구현자` → `설계자·구현자`, 확인 수단 `git cat-file -t` 명시. 0198 r4·r5 긍정 사례 문구는 P47 본문에 남아 있어 여기서만 줄였다 |
| plan §5-A 기준 V `commit을 고정` | **KEEP + 확장** | 고정 요구 유지, 확인 수단·자리표시자 추가 |
| plan §5-A READY 확인 문장 | **REPLACE** | 기존 항목 전부 유지 + `SUPERSEDED 이관`·`자리` 추가 |
| plan.template pair registry 예시 행 | **REPLACE** | 열 유지, `심을 자리`·`N자리` 표기 추가 |
| 그 밖 9줄(impl §3·verify §0·§4·AGENTS §공통 V·절차 1·3·템플릿) | **KEEP + 확장** | 원문 substring 잔존(기계 확인) |
| 명령·gate·reference 삭제·이동 | **없음** | 이동한 reference 0 → inbound `N`/semantic `M/M` 대상 없음 |

## 6-B Historical Failure Regression

- **53 P 전수**(P1~P51 + 신규 P52·P53) · 변경 후 **COVERED 53 / PARTIAL 0 / GAP 0 / OBSOLETE 0**.
- 편집 사이트를 `현재 방어`로 인용하는 P **15건**(P39~P53, 기계 추출). 인용된 방어 문장은 전부 잔존하거나 상위집합으로 교체돼, 나머지 38건의 mapping은 구성상 보존된다.
- **P38·P41 개별 확인**: 자리 단위 분모는 "지적 지점만 닫기"(P38)와 "도구가 정의한 전수"(P41)를 더 넓게 막는 방향이다. 검색 명령 요구가 모든 행으로 넓어져 P41의 재열거 가능성이 늘었다.
- **P44·P49·P51 개별 확인**: P44(배선 미잠금)의 `ProviderDetail` 형태를 등록 변이 자리 규칙이 잡는다. P49(형제 슬롯 맞바꿈)·P51(자기검증 축)은 문장 변경 없이 유지된다.
- **P45 개별 확인**: 새 `PLAN_GAP` 조건(SUPERSEDED 이관 누락)은 기존 RETURN_TO_PLAN 경로를 그대로 탄다 — 구현자에게 넘기지 않는다.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 판정 | 새 규칙 적용 | 방향 |
|---|---|---|---|---|
| 0238 | r2 verify | VP-10 PAIR_FAIL(root D5, M13만) | 같은 변이를 `ProviderDetail` 자리에도 심어 D14가 r2에서 나옴 → 같은 VP-10 PAIR_FAIL | 조기 검출, 판정 수 불변 |
| 0238 | r3 verify | VP-10 PAIR_FAIL(D14) · D16 NON_BLOCKING | D14 동일. D16은 AC11 문면이 controller oracle을 이미 지정해 구현자가 닫을 수 있음 → 경계 문장에 따라 gap 아님, NON_BLOCKING 유지 | inflation 0 |
| 0238 | ΔV1 plan READY | 통과 | READY 확인에 `SUPERSEDED 이관`이 걸려 VP-06·12 이관 행 없이는 READY가 아님 | 설계 턴에서 차단 |
| 0211 | r6 impl | `EP-71 4/4` | 자리 단위 + 검색 명령으로 cleanup 8자리를 셈 → D49·D50을 구현 중 발견 | 거짓 SELF_PASS 차단 |
| 0223·0232·0214·0216 등 진행 중 | 다음 verify | SUPERSEDED 행 보유 | verify §0 경계: 이 요구 전 revision은 읽기 전용 매핑 합성, 현재 판정에 필요할 때만 gap | 형식만으로 RETURN_TO_PLAN 0 |

- 자리 규칙의 범위는 **등록 변이 × 이번 변경이 닿은 자리**로 묶었다. 0238의 `ExtensionsCatalogView` 바인딩(미변경)은 대상 밖이라 D15가 NON_BLOCKING으로 남는다 — 인접 기존 코드로 blocking이 번지지 않는다.

## 6-C Cross-document Consistency

- **PASS.** 등록 변이 자리 규칙 **6사이트**(AGENTS §공통 V·검증 최소 계약 · impl §3 · verify §4 · verify.template §4 · corpus P52) · 분모 자리 단위 **6사이트**(AGENTS §공통 V·구현 최소 계약 · plan §5-A · impl §2 · plan.template 두 곳) · SUPERSEDED 이관 **6사이트**(AGENTS · plan §5-A · plan.template · verify §0 · verify.template · P53) · 좌표 **6사이트**(AGENTS §INDEX 운영·절차 1 · plan §5-A·마무리 · plan.template · P47 보강).
- **owner 충돌 0**: 설계자가 자리·이관을 적고(plan), 구현자가 자리로 세고 심으며(impl), 검증자가 다시 센다(verify). 좌표는 여전히 검증자가 기입하고 설계자·구현자는 자리표시자를 남긴다.
- **disposition 정합**: 분모에서 빠진 edge라도 path가 명시하면 `PLAN_GAP`이 아니라 pair 재측정이다(verify §0). AGENTS "명시된 계약 위반은 PAIR_FAIL" 문장과 같은 방향이다.
- **scope 충돌 0**: 새 게이트·명령 없음. `app/AGENTS.md` ABI·egress 규칙과 겹치지 않는다. root `AGENTS.md`는 skill·owner 표가 불변이라 변경 없음.
- `cd app && node scripts/check-doc-inventory.mjs --check` — generated · prose · **links ok**. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` stub 없음.

## review 기록 정책

`round28-review.md`를 만들지 않았다 — 압축으로 잃는 rationale이 없고 사용자 보존 요구도 없다. `round2-review.md` 1개 유지. 신규 P **2**(P52: round 27 발견 1과 0238 D14를 묶은 자리 단위 · P53: SUPERSEDED 증거 이관). P47은 사례 추가 없이 보강 문단만 붙였다.

## 남은 한계

- **자리 열거도 열거다.** 규칙은 자리 후보를 pair path의 edge로 넓힐 뿐 path 자체에 없는 edge는 잡지 못한다 — 그것은 plan의 path 서술 품질에 달려 있다.
- 0238 검증 환경: Electron/SDK 실기 불가(두 테마·bare `fable` alias)는 사람 몫이며 지침으로 해결되지 않는다.

---

# review round 29 — 라운드 정의를 plan → impl → verify 한 주기로 바꾼다

**발동/모드**: 사용자 지시 "라운드의 개념을 plan->impl->verify 를 1라운드로 변경하라. 사용자 요구사항 변경으로 Plan이나 impl만 여러턴을 진행하는 경우 라운드를 증가시키지 않도록". **APPLY**. 실패 교정이 아니라 사용자 결정 변경(**D**)이라 corpus에 새 P를 넣지 않는다.

## 변경

| 축 | 이전 | 이후 |
|---|---|---|
| 라운드 +1 | verify/FAIL · 외부 피드백 재구현 · red gate 수정(impl 턴마다) | verify가 FAIL·RETURN_TO_PLAN으로 끝날 때만 |
| verify 없는 plan·impl 반복 | 라운드 증가 | 같은 라운드의 턴 — impl은 `rN.k` |
| review 트리거 | impl 라운드 > 3 | 라운드 > 3 **또는** 같은 라운드의 verify 없는 impl 턴 > 3(사용자 요구 변경 턴 제외) |
| 진행 중 handoff | — | 다음 INDEX 갱신 때 라운드 칸만 다시 센다. 기존 `rN` 라벨은 고치지 않고 겹치면 순번을 잇는다 |

정본은 `docs/handoff/AGENTS.md §라운드`이고, INDEX 범례 · impl §0·Review Signals·마무리 · verify 마무리 · review SKILL 트리거 · plan SKILL · plan.template이 그 절을 참조한다.

## Tier

**Tier 1.** lifecycle의 카운트 의미와 review 트리거가 바뀐다. 6-A + 6-B + 6-C 수행.

## 6-A Operational Instruction Delta

삭제 줄 **23**(`git diff -U0`). 설명 없이 사라진 항목 **0**.

| 항목 | 판정 | 근거 |
|---|---|---|
| review 트리거 "impl 라운드 > 3" (AGENTS · review SKILL · impl §0 · verify 마무리 · template) | **REPLACE** | `라운드 > 3` + `verify 없는 impl 턴 > 3`으로 분할. 구 트리거가 잡던 0188형(verify 없이 impl 반복)은 턴 트리거가 같은 시점(4번째)에 잡는다 |
| "외부 피드백 재구현이면 라운드는 올라가고" · "red gate 수정도 라운드는 올리되" | **REPLACE** | 라운드 유지 + impl 턴 +1. 상태(`impl/IMPL_DONE`)·다음 주체(검증자)는 그대로 |
| verify 마무리 "FAIL: 라운드 +1" | **KEEP + 확장** | 정의 참조 추가, RETURN_TO_PLAN에도 +1 명시(이전엔 누락) |
| "재구현 라운드" 9곳(impl §5 제목·본문·§8 · AGENTS · verify §9 · verify.template) | **REPLACE** | `재구현 턴`. verify 없이 같은 라운드에서 도는 재구현도 불변식 전수·7필드 규칙의 대상임을 유지(P38 보강의 "모든 재구현" 의미 보존) |
| impl Review Signals "현재 라운드 수" · template 라운드 줄 | **REPLACE** | 라운드 + impl 턴 라벨 |
| 0188 사례 문구 "impl 라운드 10회" | **REPLACE** | "impl 턴 10회" — 사실 불변, 새 용어로 표기 |
| 명령·gate·reference 삭제·이동 | **없음** | impl §5 heading 문구가 바뀌었으나 inbound는 번호(`impl §5`)로만 인용 — `rg '재구현 라운드 —'` 활성 문서 0건 |

## 6-B Historical Failure Regression

- **53 P 전수** · 변경 후 **COVERED 53 / PARTIAL 0 / GAP 0 / OBSOLETE 0**. 라운드 카운트에 기대는 방어는 P38(0188)·P45·P46이다.
- **P38**: 발동 조건 "지적으로 도는 모든 재구현"은 `재구현 턴`으로 넓어졌다(같은 라운드의 외부 피드백 재구현 포함). 0188의 verify 기아는 턴 트리거가 4번째 턴에 review를 부른다 — 이전과 같은 시점.
- **P45**(PLAN_GAP 소멸): RETURN_TO_PLAN을 설계자에게 돌리는 경로 불변. 라운드 +1만 명시됐다.
- **P46**(보드 칸 두 주체): 다음 주체 규칙 불변.

### lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 이전 카운트 | 새 카운트 | review 트리거 |
|---|---|---|---|
| 0188 | impl 라운드 10 | 라운드 1 · impl 턴 10(외부 리뷰) | 턴 4번째에 발동 — 이전과 같음 |
| 0238 | 4 (V1 r1 → ΔV1 사용자 변경 r2 → FAIL → r3 → FAIL) | 3 (FAIL verify 2회) — 사용자 변경 턴 r2는 라운드 1 안 | 라운드 3 ≤ 3, 턴 ≤ 3 → 미발동. round 28 review는 이미 수행 |
| 0237 등 진행 중 | 보드 기재값 | 다음 INDEX 갱신 때 재계산 | 사용자가 준 review 면제 기록은 그대로 |

- PASS 판정은 라운드 수와 무관하다 → 거짓 PASS 0. 카운트는 줄거나 같고, verify 없는 비사용자 반복은 턴 트리거가 잡는다 → 트리거 소실 0.

## 6-C Cross-document Consistency

- **PASS.** 라운드 정의 **1 정본**(AGENTS §라운드) + 참조 **7사이트**(INDEX 범례 · AGENTS 트리거 목록·외부 리뷰 절 · impl §0 · verify 마무리 · review SKILL 트리거 · plan SKILL). 트리거 문면 5사이트(AGENTS 2 · review SKILL · impl §0 · verify 마무리 · template) 모두 "라운드 > 3 또는 verify 없는 impl 턴 > 3, 사용자 요구 변경 턴 제외"로 같다.
- `rN.k` 표기: AGENTS §라운드 · impl §0·마무리 · plan.template 두 곳 — 충돌 0. 대상 커밋 좌표 규칙(검증자 기입)과 겹치지 않는다.
- root `AGENTS.md`·`docs/git-template.md`에 라운드 규칙 없음 → 변경 불필요. trailer 키 불변.
- `cd app && node scripts/check-doc-inventory.mjs --check` links ok · `git diff --check` 출력 0.

## 남은 한계

- "사용자 요구 변경에 따른 턴"인지는 plan Decision Ledger의 `SUPERSEDED`·사용자 출처로 판정한다. 출처가 모호한 턴은 세는 쪽(트리거 쪽)으로 둔다 — 규칙 문면에는 넣지 않았다.

---

# review round 30 — 0259 (라운드 3→4): 직접 oracle 좌표 — round 26 미적용 패치의 재발

**발동/모드**: 0259 r3 verify FAIL로 라운드 4 > 3. 사용자가 `/handoff-review` 후 진단 질의에 **APPLY** 를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 직접 oracle이 관측의 서술이라 존재하지 않는 테스트가 PASS의 근거가 된다 | VP-07 plan oracle "훅 반환·트리 UT" — 훅 테스트에 `plugins` 단언 0. r1 자기확인 "훅 반환 필드(typecheck)" · r1 검증 PASS(코드 읽기 + typecheck) · r3에서 V4(필터 목록 맞바꿈)·V2(`plugins={[]}`)가 전 gate 통과(D6). round 26 발견 1(0211 브라우저 실측)과 같은 원인 | **A** — round 26 미적용 패치 흡수. AGENTS §공통 V·절차 2·3 · plan §5-A·READY · plan.template 3곳 · impl §2 · verify §6 · verify.template §5 2곳 · corpus **P54** |
| 2 | 재검증 범위 규칙의 "증거 좌표"가 정의되지 않아 좌표 없는 이전 PASS가 라운드를 넘겨 참조된다 | r2 검증이 VP-07을 "영향받지 않은 이전 PASS"로 참조 | **A** — 1과 같은 class라 통합. verify §6 재검증 문장에 "좌표 없이 난 PASS는 재판정" |
| 3 | path edge가 라운드마다 하나씩 열렸다(r1 컨트롤러 → r2 `AttachMenu` 행 표시 → r3 데이터 공급) | D1·D2 → D4 → D6 | **B** — impl §5 전수 sweep·§2 자리 단위가 이미 요구. 문장 추가 없음 — 1의 자리별 좌표가 evidence로 강제한다 |
| 4 | 자기검증 축이 blocking의 유일한 원천(r1 Z1~Z4 · r2 X5·X6 · r3 V2·V4) | 구현 보고 분모 출처 blocking 3라운드 0건 | **유지** (round 25 규칙 작동) |
| 5 | 컨트롤러를 node 환경에서 렌더할 수 없어 배선이 원문 단언에 기댄다 · Windows `.bin/vitest` shell 호출 실패 | r2·r3 | **E** — 지침 대상 아님 |
| 6 | Decision drift | D-001~D-012 변경 0 · SUPERSEDED 0 | **D 오염 0** |

## Tier

**Tier 1.** 닫힘 증거의 형식(필수 template 필드)과 재검증 참조 정책이 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

삭제 줄 **17**(`git diff -U0`) — 같은 hunk 추가 줄과 토큰 대조: **SUPERSET 10** · 구두점/삽입으로 토큰이 갈린 확장 **5**(`직접 oracle` → `자리별 직접 oracle 좌표` 3 · `참조한다.` · `포함한다**`) · **REPLACE 2**.

| 항목 | 판정 | 근거 |
|---|---|---|
| plan.template V-pair 자기확인 열 `직접 관측` | **REPLACE** → `직접 oracle 좌표` | 관측 요구를 좌표 요구로 강화. 열 이름 inbound 0(`grep` skills·AGENTS) |
| plan.template 전수표 예시 `테스트 \`…\` 케이스명` | **REPLACE** → 자리별 `파일:'테스트명'` | 같은 의미, 자리 단위 |
| plan.template 전수표 열 `재현 명령 / 관측` | **KEEP + 확장** | 상단 주석이 이 열 이름을 인용 — 이름 유지 |
| verify §6 재검증 "이전 PASS는 증거 좌표를 참조" | **KEEP + 확장** | 참조 허용 유지, 좌표 정의·재판정 조건 추가 |
| 그 밖(AGENTS·plan §5-A·READY·impl §2·verify.template) | **KEEP + 확장** | 원문 토큰 잔존 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음 |

## 6-B Historical Failure Regression

- **54 P 전수**(P1~P53 + 신규 P54) · 변경 후 **COVERED 54 / PARTIAL 0 / GAP 0 / OBSOLETE 0**. 삭제된 방어 문장 0이라 기존 mapping은 구성상 보존된다.
- **P23 개별 확인**(AC가 테스트 파일명을 지정해 이름 변경에 끊김): 좌표는 AC가 아니라 pair oracle·impl/verify 증거에 붙고, 검증자가 매 라운드 구현 보고에서 다시 찾는다. impl §1 "AC는 행동 단언이 정본" 유지 — 재개 없음.
- **P22·P18 개별 확인**: 사람 실기 자리는 좌표가 아니어서 `N/N`에 세지 않는다 — 실기 하치장(P22)을 더 막는다. 테스트 핸들 탐색(P18)은 불변.
- **P33·P37·P44·P52 개별 확인**: 이름 댄 테스트 실재(P33)를 이름 대지 않은 경우까지 넓히고, structural proxy(P37)인 typecheck를 좌표에서 제외하며, 자리(P52)마다 배선(P44) 증거를 요구한다.
- **P51 개별 확인**: 자기검증 축 규칙 불변.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 판정 | 새 규칙 적용 | 방향 |
|---|---|---|---|---|
| 0259 | r1 impl/verify | VP-07 SELF_PASS·PASS(typecheck) · VP-05·06 PAIR_FAIL(D1·D2) | VP-07 자리(훅 반환·컨트롤러 전달)에 좌표 없음 → 구현자가 세지 않거나 검증자가 PAIR_FAIL. VP-06 `AttachMenu` 행 표시 자리도 좌표 없음 → D4가 r1에서 나옴 | D4·D6 조기 검출, 3라운드 → 1라운드 |
| 0259 | r3 verify | D7(스킬 전달) NON_BLOCKING | 스킬 전달은 어느 pair path 자리에도 없다 → 좌표 요구 대상 아님, NON_BLOCKING 유지 | inflation 0 |
| 0211 | r1~r4 | 브라우저 실측으로 `N/N` 자기보고 · r4 재측정 green 6행 | 일회성 실측은 좌표 아님 → 그 자리는 닫힌 수에서 빠짐 | 거짓 SELF_PASS 차단 |
| 진행 중 plan(prose oracle) | 다음 verify | — | plan 칸의 형식은 PLAN_GAP 사유가 아님(AGENTS §신규 템플릿 적용 경계). 좌표는 impl/verify 증거에서 요구 | 형식만으로 RETURN_TO_PLAN 0 |
| 좌표 없이 난 과거 PASS | 재검증 | 참조 | 재판정 — 테스트가 실재하면 PASS 유지, 없으면 그 pair가 이미 지정한 oracle 부재라 PAIR_FAIL | 새 범위 생성 없음 |

## 6-C Cross-document Consistency

- **PASS.** 좌표 규칙 **9사이트**: AGENTS §공통 V(정의) · AGENTS 절차 2(구현 최소 계약) · 절차 3(검증) · plan §5-A·READY 2곳 · plan.template pair registry·전수표 주석·V-pair 자기확인 · impl §2 · verify §6 2문장 · verify.template §5·§10 분모 · corpus P54. 정의 문장은 AGENTS 한 곳, 나머지는 인용.
- **owner 충돌 0**: 설계자가 자리별 oracle(기존 테스트 또는 만들 테스트)을 적고, 구현자가 좌표로 닫고, 검증자가 다시 찾는다.
- **mutation 정책 충돌 0**: `not selected` pair의 mutation 면제(impl §0·§3, verify §4)는 유지 — impl §2에 "면제되는 것은 mutation이지 좌표가 아니다" 명시.
- **scope 충돌 0**: 새 명령·gate 없음. `gate:<명령>` 좌표는 기존 subtree gate를 가리킬 뿐이라 `app/AGENTS.md` ABI 규칙과 겹치지 않는다. root `AGENTS.md`는 skill·owner 표 불변이라 변경 없음.
- `node app/scripts/check-doc-inventory.mjs --check` — generated · prose · links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` 없음.

## review 기록 정책

`round30-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P54: round 26 발견 1과 0259 VP-07을 묶음).

## 남은 한계

- **좌표가 자리를 실제로 지나는지는 읽어서 판정한다.** `not selected` pair는 mutation 없이 테스트 본문을 읽어 production symbol 경유를 보는 것이 한계다 — 동명 재구현 판별(verify §2)에 기댄다.
- round 26 발견 3(검증자가 고른 변이가 등가일 때 처리)은 이번에도 미적용 — 0259 r2 X1·X2·X4 등가 판정은 verify가 근거와 함께 적어 실제 문제를 만들지 않았다.

---

# review round 31 — 0259 (라운드 4→5): 좌표 재판정 규칙의 impl 쪽 비대칭

**발동/모드**: 0259 r4 verify FAIL로 라운드 5 > 3. 사용자가 `/handoff-review` 후 진단 질의에 **APPLY** 를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | "좌표 없이 난 이전 PASS는 재판정"이 verify §6에만 있어, 구현자는 좌표 없는 `SELF_PASS`를 "유지"로 옮겨 적을 수 있다 | 0259 r4 impl 자기확인 `나머지 9 pair — r3 상태 유지`(좌표 0) · 같은 라운드 verify가 그중 VP-02·09를 재판정해 D8(H1·H3·H2b·K3·P1b 전 gate green) | **A** — impl §2 한 문장 · plan.template V-pair 자기확인 주석 · AGENTS 절차 2 · corpus **P54 확장** |
| 2 | path edge가 라운드마다 하나씩 열림(D1·D2 → D4 → D6 → D8) | VP-02 oracle "reducer UT"가 컴포넌트 edge를 분모에 넣지 않음 | **B** — round 30 plan §5-A 자리별 좌표가 새 plan부터 막는다. 문장 추가 없음 |
| 3 | 자기검증 독립 축이 4라운드 연속 blocking의 유일한 원천 | r4 H·K·P 축 | **유지** (round 25 규칙 작동) |
| 4 | 컴포넌트·컨트롤러를 node 환경에서 렌더하지 못함 | r2~r4 | **E** — 지침 대상 아님 |
| 5 | Decision drift | D-001~D-012 변경·SUPERSEDED 0 | **D 오염 0** |

## Tier

**Tier 1.** impl의 자기확인 행동(필수 template 필드의 채움 규칙)이 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

삭제 줄 **3**(`git diff -U0`) — 셋 다 같은 줄에 문장을 덧붙인 **SUPERSET**(impl §2 좌표 bullet · plan.template V-pair 자기확인 머리 · AGENTS 절차 2 bullet). corpus P54는 출처·규칙 문단 확장. 명령·gate·reference 삭제·이동 없음 — inbound `N`/semantic `M/M` 대상 없음.

## 6-B Historical Failure Regression

- **54 P 전수**(P1~P54) · 변경 후 **COVERED 54 / PARTIAL 0 / GAP 0 / OBSOLETE 0**. 순수 추가라 기존 방어 문장 삭제 0.
- 개별 확인: **P39**(자기보고 재현)·**P54**(좌표) — 유지 행에도 재현을 요구해 강화. **P50**(덮개 회귀)·**P51**(자기검증 독립 축) 불변. **P45**(규범 정정 소멸) — 재판정은 테스트 추가로 닫히므로 구현자 권한 안, PLAN_GAP 유입 0.

### V/lifecycle replay

| anchor | 라운드 | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0259 | r4 impl | 9 pair "r3 상태 유지" · verify가 D8로 FAIL | VP-02·09 EP-03 ②·`CascadeMenu` edge 좌표 0 → 구현자가 그 자리를 닫지 않은 수로 세고 r4 안에서 테스트 추가 | 라운드 1개 절감 |
| 0259 | r2·r3 impl | VP-07 "r1 SELF 상태 유지" | 좌표 없음 → r2에서 D6 노출 | D6 2라운드 조기 |
| 좌표 있는 유지 행 | 재구현 | 유지 | 좌표 인용만 — 재측정 의무 없음 | inflation 0 |
| 진행 중 plan | 다음 impl | — | 규칙은 `[구현자 기입]` 채움에만 걸림, plan 형식 migration 없음 | RETURN_TO_PLAN 0 |

## 6-C Cross-document Consistency

- **PASS.** 재판정 규칙 사이트: verify §6(검증자) ↔ impl §2(구현자, 신규) ↔ AGENTS 절차 2(신규)·3(기존) ↔ plan.template V-pair 자기확인(신규) ↔ verify.template §5(기존) ↔ corpus P54. owner 충돌 0 — 구현자가 재판정해 닫고 검증자가 다시 센다.
- 새 명령·gate 없음 → `app/AGENTS.md` ABI 규칙과 충돌 0. root `AGENTS.md` 불변.
- `node app/scripts/check-doc-inventory.mjs --check` — generated · prose · links ok. `git diff --check` 출력 0.
- AGENTS 위생: 비밀·개인정보·변동성 정보 없음. 새 `AGENTS.md`·`CLAUDE.md` 없음.

## review 기록 정책

`round31-review.md`를 만들지 않았다 — 사용자 보존 요구 없음. 신규 P 0(P54 같은 causal class 확장).

## 남은 한계

- 구현자가 유지 행의 좌표를 인용해도 그 테스트가 자리를 지나는지는 검증자가 읽어서 판정한다(round 30 한계 그대로).

---

# review round 32 — 0259 (라운드 5→6): 실재하는 좌표가 덮는 범위

**발동/모드**: 0259 r5 verify FAIL로 라운드 6 > 3. 사용자가 `/handoff-review` 후 진단 질의에 **APPLY** 를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 좌표가 실재하고 production 코드를 불러도 그 테스트가 **실행한 구간**이 정의되지 않아, 자리의 한쪽 끝만 실행한 테스트가 그 자리를 닫았다 | `attachMenuSelect.test.ts`가 `CascadeMenu`를 mock해 받은 `onSelect`를 직접 부름 · r5 `CascadeMenu.test.ts`가 `CascadeBody`로 들어가 `state.focus`만 단언 · r1~r3 VP-02 좌표가 순수 reducer UT · VP-01은 r1~r3 `BLOCKED_BY`, r4 하위 좌표 합으로 PASS — r5 D9 변이 8건 전 gate green | **A** — round 30 "좌표가 자리를 실제로 지나는지는 읽어서 판정" 한계를 판정 규칙으로 교체. AGENTS §공통 V(정의) · 절차 2·3 · plan §5-A · plan.template 전수 주석 · impl §2 · verify §6 · verify.template §5 · corpus **P55** |
| 2 | r5 구현자가 D8 대응 방향("함수가 이벤트 경로에서 불린다")을 불변식으로 삼아 출처 계약 AC6(Enter/Space 실행·최상위 Esc 닫힘·포커스 이동)을 분모에 넣지 않았다 | `[구현자 기입] (r5)` 불변식·검색 술어 = D8 메커니즘 이름 | **B** — AGENTS "파생 이슈의 계약은 `출처`… 닫힘은 그 계약의 성립"·impl §5가 이미 요구(P38). 문장 추가 없음 |
| 3 | VP-01을 r1~r3에 `BLOCKED_BY`로 둠 — 자기 path의 선택 edge는 하위 pair와 독립 판정 가능했다 | verify r1~r3 §5 | **B** — verify §6 "다른 경로에서 독립 관측할 수 있으면 실행"이 이미 요구. 1의 상위 pair edge 대응 규칙이 evidence로 강제 |
| 4 | 자기검증 독립 축이 5라운드 연속 blocking의 유일한 원천(r5: 15축 → BLOCKING 8) | r5 verify §4 | **유지** (round 25 규칙 작동) |
| 5 | renderer 테스트가 DOM 없는 node 환경(`environment: 'node'`, `include: src/**/*.test.ts`, jsdom·happy-dom·testing-library 없음)이라 컴포넌트를 mock·직접 호출로 근사한다 — 1의 이음매가 체계적으로 생기는 조건 | r1~r5 | **E** — 지침 대상 아님. DOM 테스트 환경은 신규 의존성이라 사용자 결정(NEXT_HANDOFF 후보) |
| 6 | Decision drift | D-001~D-012 ACTIVE · `7f6ed426..HEAD` plan 규범 hunk 0 | **D 오염 0** |

## Tier

**Tier 1.** 좌표 판정(닫힘의 의미)과 필수 template 필드 안내가 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

삭제 줄 **5**(`git diff -U0`, 줄 = 문단) — 추가 줄과 토큰 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| impl §2 좌표 bullet | **KEEP + 확장** | 잃은 토큰 0 — 문장 덧붙임 |
| AGENTS 절차 2 좌표 문장 | **KEEP + 확장** | 잃은 토큰 0 — "그 자리를 실행 구간 안에 둔" 삽입 |
| AGENTS 절차 3 좌표 문장 | **KEEP + 확장** | 잃은 토큰 `찾고,` → `찾아 … 읽고(§공통 V),` |
| plan §5-A 만들 테스트 표기 | **KEEP + 확장** | `(파일·관측 대상)` → `(파일·진입점·관측 대상 — …)` |
| verify §6 "production symbol로 그 자리를 지나는지 읽는다" | **REPLACE** | 실행 구간 안 판정은 구 조건(production 코드가 자리를 지남)을 포함한다 — 동명 로컬 재구현·자리에 못 닿는 테스트는 여전히 구간 밖. 규범 inbound 0(`rg 지나는지` → round 30·31 기록 2건만) |
| AGENTS §공통 V · plan.template · verify.template · corpus | **추가** | 삭제 줄 0 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음 |

## 6-B Historical Failure Regression

- **55 P 전수**(P1~P54 + 신규 P55) · 변경 후 **COVERED 55 / PARTIAL 0 / GAP 0 / OBSOLETE 0**. 유일한 REPLACE(verify §6)가 구 조건의 상위집합이라 기존 mapping은 보존된다.
- verify §6을 방어로 인용하는 P 개별 확인: **P41**(라벨 표본 확인)·**P48**("다른 게이트가 막는다" 재측정)·**P51**(독립 축) — 해당 문장 불변. **P54** — 좌표 실재 위에 덮는 범위 판정이 붙어 강화.
- 관련 P 개별 확인: **P44**(배선 미잠금) — 변이 방어에 더해 테스트를 읽는 방어가 생김. **P38**(지목 지점만 닫음) — 발견 2가 그 재발이며 방어 문장 불변. **P49**(형제 슬롯) — X9b(hover 레벨 상수 0)는 실행 구간 안이라 이 규칙으로 안 걸리고 P49·P51의 변이 축이 잡는다. **P18·P22**(실기 하치장) — 구간 밖 자리는 `남긴 곳`이지 실기가 아니고, r5 하네스가 핸들의 실재를 보였다.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0259 | r1 verify VP-02 | PASS(reducer UT) | reducer UT의 구간은 `reduceCascade`부터 — `keydown → reducer` 컴포넌트 edge는 밖 → PAIR_FAIL | D8 3라운드 조기 |
| 0259 | r1~r3 verify VP-01 | `BLOCKED_BY:VP-05/06/07` | 선택 edge는 `CascadeMenu`를 mock한 테스트 구간 밖이고 독립 판정 가능 → root PAIR_FAIL | D9 선택 4변이 4라운드 조기 |
| 0259 | r4 verify VP-01 | PASS(VP-05~10 좌표 합) | path edge별 대응에서 선택 이음매가 비어 PAIR_FAIL | 거짓 PASS 제거 |
| 0259 | r5 impl | `CascadeBody` 진입·`state.focus` 단언으로 SELF_PASS | 래퍼 `onSelect`·`onClose`·마운트 포커스·DOM 포커스가 구간 밖 → `남긴 곳` | X1b·X2·X4b·X10 r5 안에서 노출 |
| 0259 | r5 하네스 | react 훅 mock | 실행 환경 대체는 구성요소 교체가 아님 → 그 좌표의 구간 유지 | inflation 0 |
| mock한 무관 협력자 | 임의 | — | 자리의 양 끝이 아닌 구성요소 mock은 그 자리 판정과 무관 | inflation 0 |
| 진행 중 plan(성긴 path) | 다음 impl/verify | — | plan 형식 migration 없음 — 판정은 impl/verify 좌표 읽기에만 걸림 | RETURN_TO_PLAN 0 |

## 6-C Cross-document Consistency

- **PASS.** "실행 구간" 규칙 **9사이트**: AGENTS §공통 V(정의) · AGENTS 절차 2·3 · plan §5-A · plan.template 전수 주석 · impl §2 · verify §6 · verify.template §5 · corpus P55. 정의 문장은 AGENTS 한 곳, 나머지는 인용·적용. "path 구성요소" 용어 6사이트 일치.
- **owner 충돌 0**: 설계자는 만들 테스트의 진입점·관측 대상을 적고, 구현자가 구간 밖 자리를 `남긴 곳`에 적고, 검증자가 다시 읽는다.
- **mutation 정책 충돌 0**: 판정은 읽기라 `not selected` pair의 mutation 면제(impl §3·verify §4)와 겹치지 않는다.
- **scope 충돌 0**: 새 명령·gate 없음 → `app/AGENTS.md` ABI 규칙과 무관. root `AGENTS.md` skill·owner 표 불변이라 변경 없음.
- `node app/scripts/check-doc-inventory.mjs --check` — generated · prose · links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` 없음.

## review 기록 정책

`round32-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P55: 실재 좌표의 덮는 범위 — P44·P54와 다른 causal class).

## 남은 한계

- 실행 구간 안 자리라도 테스트 입력이 운반 값을 바꾸지 않으면(0259 X9b: hover 레벨 0만) 그 자리는 잠기지 않는다 — 변이 축(P49·P51)이 잡는다.
- 실행 환경 대체(react 훅 mock)가 실제 React의 effect 순서·재렌더를 다르게 매길 위험은 남는다 — DOM 테스트 환경 도입은 사용자 결정이다.

---

# review round 33 — 0262 (라운드 3→4) · 0265 (라운드 2): 운반 값 비퇴화와 강제 지점 표의 열

**발동/모드**: 0262 r3 verify FAIL로 라운드 4 > 3. 사용자가 `/handoff-review`를 인자 없이 호출해 DIAGNOSE_ONLY로 진단했고, 진단 질의에 **APPLY(변경안 1+2)** 를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 좌표가 실행 구간 안에서 자리를 실행했지만 운반 값이 빈 값이라, 그 항을 지워도 관측이 같았다 | 0265 r2 `send.harness.test.ts` 조립 인자 단언 — 하네스 지시가 빈 fixture, 지시 항 제거 변이 `src/main` 4,057 green(D-0265-3) · 0259 r5 X9b(round 32 남은 한계) | **A** — round 32 한계를 판정 규칙으로 교체. AGENTS §공통 V(정의) · 절차 2·3 · plan §5-A · plan.template · impl §2 · verify §6 · verify.template §5 · corpus **P56** |
| 2 | 재구현 턴이 강제 지점 표를 `root pair / 자리 · 새 oracle · 자기결과` 세 열로 바꿔 분모를 검증자 인용 6자리로 줄였다. 같은 EP-08의 부모 편집 배선(`AgentEnvironmentView.tsx:121-122·149`)과 `engineAdd` schema 등록이 어느 열에도 없었다 | 0262 r3 `[구현자 기입]` "분모는 r2 인용 6자리" · r3 verify I1·I2·I3·I5 green(D-0262-6) | **B** — impl §5(출처 계약)·§2(자리 = 운반 edge)·template 열이 이미 요구(P38·P52). 같은 문장은 추가하지 않고 **증거 강제**: impl §8·AGENTS 절차 2·plan.template에 "표의 열을 줄이지 않는다·`§10이 적은 지점`은 pair §10 자리 전부", verify §9·verify.template §11에 열 내용 점검 |
| 3 | r2 검증자가 r1 남긴 자리 "EngineCard 실제 클릭"을 카드 안 한 줄로만 탐침하고 대응 방향도 그만큼 좁혔다 | 0262 r2 P08c·D-0262-4 | **B** — P52 자리 규칙·verify §6 §10 재열거가 이미 요구. 문장 추가 없음 |
| 4 | V1 `SELF_BLOCKED` 14가 ΔV 20회 동안 승계됐고, ΔV1~4 REGRESSION 행이 "기존 미잠금 범위 승계"로 적혔으며, r1 verify가 V1 pair를 "못 본 것"으로 넘겼다 | 0262 plan r1~ΔV19 · r1 verify | **B** — REGRESSION은 다시 닫는다(AGENTS §공통 V)·첫 검증은 전 pair 실행(verify §6). ΔV21 내장 리뷰도 B로 판정, r2·r3이 해소 중 |
| 5 | ΔV1~ΔV21은 사용자 추가 요구 | 0262 Decision Ledger D-010~ | **D** — 오염 0 |
| 6 | 검증 환경에 OpenCode CLI 부재 | 0262·0265 r3 | **E** — native CLI 통합 skip 1, r2 실측 승계 |

## Tier

**Tier 1.** 좌표가 자리를 닫는 조건(정의)과 재구현 턴 필수 필드·verify 필드 점검의 의미가 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

삭제 줄 **12**(`git diff -U0 af0521ef` — #505 병합본, 내용은 head `37fc5c27`과 동일, 줄 = 문단) — 추가 줄과 토큰 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §공통 V | **추가** | 실행 구간 bullet 뒤 새 bullet 1. 삭제 줄 0 |
| AGENTS 절차 2 좌표 문장 · 필드 문장 · 절차 3 좌표 문장 | **KEEP + 확장** | 잃은 토큰 `둔`→`두고 … 채운` · `필드를`→`필드와 표의 열을` · `있는지`→`있고 … 채워졌는지` |
| impl §2 좌표 bullet | **KEEP + 확장** | 잃은 토큰 0 — 문장 덧붙임 |
| impl §8 필드 문장 | **KEEP + 확장** | `필드를`→`필드와 표의 열을` + 문장 덧붙임 |
| plan §5-A 만들 테스트 표기 | **KEEP + 확장** | `(파일·진입점·관측 대상 — … 않는다)`→`(파일·진입점·구별 입력·관측 대상 — … 않으며 … 준다)` |
| plan.template 필드 주석·실행 구간 주석 | **KEEP + 확장** | `필드를`→`필드와 표의 열을` · 문장 덧붙임 + 주석 1줄 추가 |
| verify §6 · §9 | **KEEP + 확장** | 잃은 토큰 0 — 문장 삽입·덧붙임 |
| verify.template §5 · §11 | **KEEP + 확장** | `0):`→`0) · …:` |
| corpus | **추가** | P56. 삭제 줄 0 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음 |

- 방어 문구 21종(`다른 게이트가 막는다`·`라벨이 참인지`·`세는 단위는 §10 항목이 아니라 자리`·`들어간 곳 앞`·`npm test`·`Tier 1`·`Handoff: none`·`BLOCKED_BY`·`SUPERSEDED`·`실행 구간` 등)의 출현 파일 집합을 변경 전후 8파일에서 대조 — 차이 **0**.

## 6-B Historical Failure Regression

- **56 P 전수**(P1~P55 + 신규 P56, 번호 결번·중복 0) · 변경 후 **COVERED 56 / PARTIAL 0 / GAP 0 / OBSOLETE 0**. 모든 변경이 KEEP + 확장 또는 추가라 기존 mapping은 보존된다.
- P1~P37: 방어 지점이 plan 조사·AC·Technical Design 등이고 이번 변경 사이트와 겹치지 않는다(round 4 baseline 매핑 그대로).
- 변경 사이트를 방어로 인용하는 P 개별 확인: **P39**(자기보고 재현, impl §8·verify §9) — 해당 문장 불변, 필드 점검이 열로 확장 · **P41**(라벨 표본, verify §6) — 문장 불변 · **P44**(배선 미잠금, plan §5-A 선택 증거) — 선택 문장 불변 · **P47**(로컬 해시, verify §9 별도 bullet) — 불변 · **P48**("다른 게이트가 막는다") — 불변 · **P52**(자리 단위) — 절차 2 문장 보존 + 열 점검으로 강화 · **P54**(좌표 형식) — 보존 · **P55**(실행 구간) — 정의 bullet 그대로, 바로 뒤에 P56 조건 추가.
- 관련 P: **P38**(지목 지점만 닫음) — 발견 2의 재발. 방어 문장 불변이고 `§10이 적은 지점` = pair §10 자리 전부가 그 분모를 표에 강제한다 · **P49**(형제 슬롯 맞바꿈) — 변이 축 유지, P56은 읽기 판정이라 mutation 정책과 겹치지 않는다.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0265 | r2 impl VP3-A | `SELF_PASS`(조립 인자 단언, 지시 빈 fixture) | 지시 항 운반 값이 빈 값 → `남긴 곳` | D-0265-3 구현 턴 안 노출, 1라운드 조기 |
| 0265 | r2 verify | `PAIR_FAIL`(검증자 재량 탐침 R2-01) | 같은 판정을 읽기로 — 탐침 없이도 도달 | 판정 불변, inflation 0 |
| 0259 | r5 X9b | green — P49 변이 축에 위임 | hover 레벨 0만 입력 → `남긴 곳` | 조기 |
| 0262 | r3 impl VP-08 | `SELF_PASS`(보완 6/6) | VP-08 행에 EP-08 전 자리 → 부모 편집 배선·IPC 등록이 `남긴 곳` → `SELF_BLOCKED` | D-0262-6 구현 턴 안 노출 |
| 0262 | r3 verify | root `PAIR_FAIL` VP-08(탐침 I1·I2·I3·I5) | 같은 root. 열 점검은 같은 분모의 증거라 별도 root로 세지 않는다 | 판정 불변 |
| 0262 | r3 Composer 좌표 | 두 하네스·서로 다른 모델명 catalog | 구별 입력 → 닫힘 유지 | inflation 0 |
| 부재 → 기본값 폴백 자리 | 0262 `defaults to Claude…` | 닫힘 | 부재 입력이 곧 구별 값 → 닫힘 유지 | inflation 0 |
| 열 이름만 다른 표 | 임의 | — | §10 자리 전부와 `남긴 곳`이 있으면 접힘 아님 | inflation 0 |
| 진행 중 plan | 다음 impl/verify | — | plan 형식 migration 없음 — 판정은 impl/verify 좌표 읽기와 [구현자 기입] 표에만 걸림 | RETURN_TO_PLAN 0 |

## 6-C Cross-document Consistency

- **PASS.** "운반 값" 규칙 **8사이트**: AGENTS §공통 V(정의) · AGENTS 절차 2·3 · plan §5-A · plan.template 전수 주석 · impl §2 · verify §6 · verify.template §5 (+ corpus P56). 정의 문장은 AGENTS 한 곳, 나머지는 인용·적용.
- "표의 열" 규칙 **6사이트**: AGENTS 절차 2 · impl §8 · plan.template 두 주석 · verify §9 · verify.template §11. impl·template는 열을 줄이지 말라고 요구하고 verify는 열이 담는 분모로 판정한다 — 구현자에게 더 엄격하고 검증 gate는 내용 기준이라 금지↔요구 충돌 0.
- **owner 충돌 0**: 설계자는 만들 테스트의 구별 입력을 적고, 구현자가 퇴화 입력 자리를 `남긴 곳`에 적고, 검증자가 다시 읽는다.
- **scope 충돌 0**: 새 명령·gate 없음 → `app/AGENTS.md` ABI 규칙과 무관. root `AGENTS.md` skill·owner 표 불변.
- `node app/scripts/check-doc-inventory.mjs --check` — generated · prose · links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` 없음.

## review 기록 정책

`round33-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P56: 구간 안 좌표의 입력 조건 — P55·P49와 다른 causal class). 발견 2는 P38 class의 재발이라 corpus를 늘리지 않았다.

## 남은 한계

- 운반 값이 구별돼도 그 값이 관측 출력에 이르지 않으면(중간에서 버려짐) 잠기지 않는다 — 관측 대상 지정(plan §5-A)과 실행 구간 규칙이 잡는다.
- renderer 테스트의 DOM 없는 node 환경은 round 32 한계 그대로다(E, 사용자 결정 대상).

---

# review round 34 — 0262 (라운드 4→5): 조립 차이로 바뀐 분기

**발동/모드**: 0262 r4 verify FAIL로 라운드 5 > 3. 사용자가 `/handoff-review`를 인자 없이 호출해 DIAGNOSE_ONLY로 진단했고, 진단 질의에 **APPLY(변경안 1)** 를 선택했다. 변경안 2(`app/AGENTS.md` Electron 바이너리 서명)는 선택하지 않았다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 테스트가 production 조립이 항상 주입하는 의존성을 빼서 같은 handler의 fallback 분기를 실행했다. fallback도 production 코드라 P55 정의("mock·stub로 바꾼 구성요소 제외")로는 구간 안으로 읽혔다 | 0262 r4 `engine.ipc.test.ts`·`misc.runtime-catalog.test.ts`·0265 EP11 — `agent:list`의 `harnessRuntime.resolve`→`cached` 변이 J2가 `src/main` 4,909 green(D-0262-7). r3의 133좌표 감사도 `vi.mock` 기준이라 놓침 | **A** — 실행 구간 정의를 정밀화. AGENTS §공통 V(정의) · impl §2 · verify §6 · plan §5-A · plan.template · verify.template §5 · corpus **P57** |
| 2 | ΔV19 EP55d 좌표가 catalog 실패 폴백과 같은 모델명만 관측 | 0262 r1~r3 ΔV19 PASS | round 33 이전의 **A** — P56 판정 기준("그 항을 지웠을 때 관측이 달라지는가")이 이미 덮고 r4 verify가 그것으로 잡았다. 변경 없음 |
| 3 | r2→r3→r4 "지목한 자리만 닫힘" 반복 | 0262 r3·r4 `[구현자 기입]` | **B 아님(해소)** — round 33의 열 강제가 r4에서 작동해 EP-08 59자리가 모두 표에 올랐다. r4의 누락은 발견 1의 다른 메커니즘 |
| 4 | 삭제 확인 문구의 이름 인자 미관측(J15) | 0262 r4 N-0262-8 | **F** — 지침 무관 |
| 5 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 뒤 electron을 import하는 16파일이 `Electron failed to install correctly`로 실패, `app/AGENTS.md`는 DB 5파일만 서술 | 0262 r4 검증 첫 실행 | **E** — verify §8이 미지 서명 분리를 요구해 방어됨. 문서 보강은 사용자 미선택 |
| 6 | 사용자 결정 변경 | 없음 | **D** 오염 0 |

## Tier

**Tier 1.** 좌표가 자리를 닫는 조건(실행 구간 정의)의 의미가 넓어진다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

기준 `d16a71e`. 삭제 줄 **6**(파일당 1, 줄 = 문단) — 추가 줄과 토큰 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §공통 V 실행 구간 bullet | **KEEP + 확장** | "덮지 않는 것" 목록에 조립 차이 분기 추가 + 사례 1줄. 잃은 토큰 0 |
| impl §2 좌표 bullet | **KEEP + 확장** | 읽을 항목에 "production 조립과 다르게 준 의존성" + 사례 1문장. 잃은 토큰 0 |
| verify §6 | **KEEP + 확장** | 조립 대조 문장 삽입. 잃은 토큰 0 |
| plan §5-A 만들 테스트 조건 | **KEEP + 확장** | "production 조립이 주입하는 의존성을 빼지 않고" 삽입. 잃은 토큰 0 |
| plan.template 전수 주석 | **KEEP + 확장** | `단언한`→`단언하거나 … 탄` — 어미만 바뀜 |
| verify.template §5 | **KEEP + 확장** | 항목 하나 삽입. 잃은 토큰 0 |
| corpus | **추가** | P57. 삭제 줄 0 |
| AGENTS 절차 2·3 | **KEEP** | §공통 V를 인용만 하므로 정의 변경이 그대로 적용 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음 |

- 방어 문구 21종(`다른 게이트가 막는다`·`라벨이 참인지`·`세는 단위는 §10 항목이 아니라 자리`·`들어간 곳 앞`·`npm test`·`Tier 1`·`Handoff: none`·`BLOCKED_BY`·`SUPERSEDED`·`실행 구간`·`운반 값`·`남긴 곳`·`좌표 없이`·`덮개 회귀`·`형제`·`차집합`·`PLAN_GAP`·`REGRESSION`·`mock`·`git cat-file`·`trailers:only`)의 출현 파일 집합을 변경 전후 8파일에서 대조 — 차이 **0**. 새 문구 `production 조립`만 6파일에 추가.

## 6-B Historical Failure Regression

- **57 P 전수**(P1~P56 + 신규 P57, 결번·중복 0) · 변경 후 **COVERED 57 / PARTIAL 0 / GAP 0 / OBSOLETE 0**.
- P1~P38: 방어 지점이 변경 6줄과 겹치지 않는다(round 4 baseline 매핑 그대로).
- 변경 파일을 방어로 인용하는 P39~P56 개별 확인: 바뀐 6줄은 잃은 토큰 0(어미 1 제외)이라 각 P의 방어 문장이 그대로 남는다. **P55**(실행 구간) — 정의 문장 불변, 덮지 않는 목록만 확장 · **P56**(운반 값) — 바로 다음 bullet 불변 · **P54**(좌표 형식) · **P52**(자리 단위) · **P41**(라벨 표본) · **P48**("다른 게이트가 막는다") · **P44**(배선 선택 증거) — 문장 불변.
- 관련 P: **P23**(분기가 한 번도 실행되지 않음) — 호출 인자 부재로 분기가 죽은 사례, P57은 조립 차이로 production 분기만 빠진 사례라 causal class가 다르다 · **P55** — mock으로 줄어든 구간, P57은 mock 없이 바뀐 분기.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0262 | r4 impl EP-08 `resolve` | `SELF_PASS`(M, `harnessRuntime` 미주입) | 조립 차이 → `남긴 곳` → `SELF_BLOCKED` | D-0262-7 구현 턴 안 노출 |
| 0262 | r3 verify 133좌표 감사 | `vi.mock` 기준으로 통과 | 조립을 `bootstrap.ts`와 대조 → 엔진·misc 테스트의 미주입 노출 | 1라운드 조기 |
| 0262 | r4 verify | root `PAIR_FAIL` VP-Δ19-05(독립 변이 J2) | 같은 root를 읽기로 도달 | 판정 불변 |
| 0265 | EP11 settings catalog env (r3 PASS) | `misc.runtime-catalog` 좌표로 닫힘 | production 분기 자리 미닫힘 | 실재 침묵(J2 green) 확인 — inflation 아님. 0265 재판정은 이 review 범위 밖 |
| 0262 | `engine.deployment…without optional runtime services` | 닫힘 | 의존성 부재 동작이 자기 계약 → 그 분기 자리로 닫힘 | inflation 0 |
| 0262 | `engine.deployment` 의 `harnessRuntime` 기록 fake | 닫힘 | 주입은 하므로 production 분기 실행. fake 출력 가정은 P55가 다룸 | inflation 0 |
| 진행 중 plan | 다음 impl/verify | — | plan 형식 migration 없음 — 판정은 좌표 읽기에만 걸림 | RETURN_TO_PLAN 0 |

## 6-C Cross-document Consistency

- **PASS.** "조립 차이" 규칙 **6사이트**: AGENTS §공통 V(정의) · impl §2 · verify §6 · plan §5-A · plan.template · verify.template §5 (+ corpus P57). AGENTS 절차 2·3은 §공통 V 인용.
- **owner 충돌 0**: 설계자는 만들 테스트에 의존성을 빼지 않도록 적고, 구현자는 조립 차이 자리를 `남긴 곳`에 적고, 검증자는 조립을 production 조립 루트와 대조한다.
- **scope 충돌 0**: 새 명령·gate 없음 → `app/AGENTS.md` ABI 규칙과 무관. root `AGENTS.md` skill·owner 표 불변.
- `node app/scripts/check-doc-inventory.mjs --check` — generated · prose · links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` 없음.

## review 기록 정책

`round34-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P57: 조립 차이로 바뀐 분기 — P55·P23과 다른 causal class).

## 남은 한계

- "항상 주입"의 판정은 조립 루트를 읽어야 한다. 조립이 조건부(배포·DEV 분기)면 그 조건마다 분기를 따로 본다.
- `app/AGENTS.md`의 Electron 바이너리 미설치 서명은 문서에 없다(E, 사용자 미선택).

---

# review round 35 — 0262 (라운드 5→6): 분모 검색의 범위

**발동/모드**: 0262 r5 verify FAIL(`b9a75f9`)로 라운드 6 > 3. 사용자가 `/handoff-review`를 인자 없이 호출해 DIAGNOSE_ONLY로 진단했고, 진단 질의에 **APPLY**를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 분모 검색의 술어는 불변식의 주어였지만 범위를 지적이 인용한 파일로 좁혀, 같은 pair의 형제 소비처가 분모 밖에 남았다 | 0262 r5 구현 — `rg 'ctx\.(harnessRuntime\|runtimeModelCatalog)'`를 `engine.ts`·`misc.ts`에만 실행. ΔV19 EP55e `resolve-turn.ts:228` merge 변이 K9 green(D-0262-8). r5 검증이 `src/main` 전체로 넓히자 차집합 5줄 | **A** — 술어 규칙이 범위를 말하지 않았다. AGENTS 절차 2 · impl §2 · plan.template · verify §6 · corpus **P58** |
| 2 | 표에 EP55e를 닫힘(I19)으로 적으며 조립을 production과 대조하지 않았다 | 0262 r5 구현 | **B** — round 34 impl §2가 이미 요구. 발견 1의 범위 규칙이 그 자리를 분모 행으로 올린다 |
| 3 | 불변식 문장에 지점 이름(`agent:list`)이 들어갔다 | 0262 r5 설계 리뷰 | **B** — impl §5.1 |
| 4 | 도달 불가 가드를 J2로 닫았다고 셌다(K7 green) | N-0262-10 | **B** — impl §3 |
| 5 | 구현·검증·review가 같은 에이전트(같은 세션) | 0262 r4~r5 | **E** — verify §4 자기 검증 규칙이 작동(K9) |
| 6 | 기본 배포 augmenter 산출이 비어 runtime config 분기가 구별되지 않음 | N-0262-9 · 0265 EP11 | **E** / NEXT_HANDOFF 후보 |
| 7 | 사용자 결정 변경 | 없음 | **D** 오염 0 |

## Tier

**Tier 1.** 강제 지점 분모를 세는 절차(검색 범위)의 의미가 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

기준 `b9a75f9`. 삭제 줄 **4**(파일당 1, 줄 = 문단) — 추가 줄과 토큰 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS 절차 2 술어 문장 | **KEEP + 확장** | 범위 문장 추가. 잃은 토큰은 조사 `으` 1(`이름으로`→`이름이나 인용 파일로`) |
| impl §2 술어 문장 | **KEEP + 확장** | 범위 문장 + 사례 1문장. 잃은 토큰 0 |
| plan.template 전수 주석 | **KEEP + 확장** | `넣는다`→`넣고, … 좁히지 않는다`. 잃은 토큰 0 |
| verify §6 | **KEEP + 확장** | 라벨 표본 문장 뒤 범위 재측정 문장 삽입. 잃은 토큰 0 |
| corpus | **추가** | P58. 삭제 줄 0 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음 |

- 방어 문구 23종(round 34의 22종 + `불변식의 주어`)의 출현 파일 집합을 변경 전후 8파일에서 대조 — 차이 **0**.

## 6-B Historical Failure Regression

- **58 P 전수**(P1~P57 + 신규 P58, 결번·중복 0) · 변경 후 **COVERED 58 / PARTIAL 0 / GAP 0 / OBSOLETE 0**.
- P1~P38: 방어 지점이 변경 4줄과 겹치지 않는다(round 4 baseline 매핑 그대로).
- 변경 파일을 방어로 인용하는 P39~P57: 바뀐 4줄은 잃은 토큰이 조사 1개뿐이라 방어 문장이 그대로 남는다. **P52**(자리 단위) — 같은 bullet의 자리 문장 불변 · **P41**(라벨 표본) — verify §6 문장 불변, 바로 뒤에 범위 재측정 삽입 · **P55·P56·P57**(실행 구간·운반 값·조립 차이) — 사이트 불변.
- 관련 P: **P38**(지목 지점만 닫음) — 같은 class의 다른 메커니즘. 표 열 강제(round 33)와 범위 규칙이 함께 분모를 지킨다 · **P52** — 술어 규칙과 같은 bullet.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0262 | r5 impl 조립 의존 분모 | `5/6`(두 파일) · EP55e `SELF_PASS` | `src/main` 범위 → `resolve-turn.ts` 5줄 포함 → EP55e merge `남긴 곳` → `SELF_BLOCKED` | D-0262-8 구현 턴 안 노출 |
| 0262 | r5 verify | root `PAIR_FAIL` VP-Δ19-05(독립 축 K9) | 같은 재측정을 규칙으로 수행 | 판정 불변 |
| 0262 | r3 impl 분모(인용 6자리 파일) | `SELF_PASS` | 범위 확장 → 부모 편집 배선 노출(round 33 열 규칙과 중첩) | 조기 |
| 범위 확장으로 나온 표 밖 지점 | 임의 | — | 현재 pair·ACTIVE Decision·AC에 귀속될 때만 `PLAN_GAP`/blocking, 아니면 별도 finding(impl §2 기존 문장) | inflation 0 |
| 진행 중 plan | 다음 impl/verify | — | plan 형식 migration 없음 — 분모 검색 절차에만 걸림 | RETURN_TO_PLAN 0 |

## 6-C Cross-document Consistency

- **PASS.** "검색 범위" 규칙 **4사이트**: AGENTS 절차 2(최소 계약) · impl §2(정본) · plan.template 주석 · verify §6(대칭 재측정) (+ corpus P58). 각 사이트에 규칙 문장 1회(`rg` 1건씩).
- **owner 충돌 0**: 구현자는 범위를 넓혀 세고, 검증자는 좁으면 넓혀 차집합을 본다. 설계자 절차는 불변.
- **scope 충돌 0**: 새 명령·gate 없음 → `app/AGENTS.md`와 무관. root `AGENTS.md` 불변.
- `node app/scripts/check-doc-inventory.mjs --check` — generated · prose · links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음. 새 `AGENTS.md`·`CLAUDE.md` 없음.

## review 기록 정책

`round35-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P58: 술어가 맞을 때 범위로 줄어드는 분모 — P38·P52와 다른 메커니즘).

## 남은 한계

- "pair path가 지나는 소스 전체"의 경계는 구현자가 정한다 — 경로가 여러 프로세스(main·preload·renderer)를 지나면 각 트리를 포함한다.
- r2~r5는 매번 다른 메커니즘으로 같은 계약의 인접 자리가 비었다. 다음 재발이 또 다른 메커니즘이면, 메커니즘별 규칙을 더하기보다 같은 계약의 형제 좌표 전체를 다시 읽는 절차로 통합하는 것을 검토한다.

---

# review round 36 — 0262 (라운드 6→7): 변이가 닫는 범위와 운반 항 열

**발동/모드**: 0262 r6 verify FAIL(`c22160d`)로 라운드 7 > 3. 사용자가 `/handoff-review`를 인자 없이 호출해 DIAGNOSE_ONLY로 진단했고, 진단 질의에 **APPLY**를 선택했다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 호출 변이(K4 `resolve`→`cached`) red로 턴 실행 구성 자리를 닫힘으로 셌다. 그 자리의 인자 항(target `harnessId`·`modelProviderId`)은 재지 않았다 | 0262 r5 verify·r6 impl → X8·X9·X11·X12 green 0/4,909(D-0262-9) | **A(일부)** — "변이 red ≠ 닫힘"은 pair·이슈 수준에만 있었다. AGENTS §공통 V · impl §2 · verify §6에 "변이는 바꾼 항만 잠근다" + corpus **P59** |
| 2 | 같은 행의 좌표가 mock 가정 출력(`native-history` stub)과 미관측 출력(I19 `model`만)이었다 | 0262 r6 EP55e 행 | **B** — P55·P56이 이미 요구. **증거 강제**: plan.template 강제 지점 표에 `운반 항 · 구별 값 · 관측` 열, verify.template §5에 운반 항별 구별·관측 |
| 3 | r2→r6 다섯 라운드 연속 "지목한 자리는 닫히고 인접 자리 하나가 빔", 메커니즘이 매번 다름 | round 35 남은 한계 | 메커니즘 규칙 대신 **행마다 답하는 표 열로 통합**(발견 2) |
| 4 | 구현·검증·review가 같은 에이전트 | r4~r6 | **E** — verify §4 자기 검증 축이 매번 결함을 잡음 |
| 5 | 실제 OpenCode CLI 부재로 R40 oracle skip | r6 §14 | **E** |
| 6 | 사용자 결정 변경 | 없음 | **D** 오염 0 |

## Tier

**Tier 1.** 변이 결과가 닫는 범위(failure semantics)와 `[구현자 기입]` 필수 표 열이 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

기준 `c22160d`. 삭제 줄 **8**(AGENTS 1 · impl 1 · verify 1 · verify.template 1 · plan.template 4 — 표 헤더·구분선·예시 행 + 주석 위치 이동) — 추가 줄과 토큰 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §공통 V 운반 값 bullet | **KEEP + 확장** | 문장·사례 1 추가. 잃은 토큰 0 |
| impl §2 · verify §6 | **KEEP + 확장** | 같은 규칙의 적용 문장 추가. 잃은 토큰 0 |
| plan.template 강제 지점 표 | **KEEP + 확장** | 열 1개 추가(6→7), 기존 열 이름·순서 불변, 안내 주석 1줄 추가. 잃은 토큰 0 |
| verify.template §5 | **KEEP + 확장** | `운반 값 입력`→`운반 항별 구별 입력·관측(…)`. 잃은 토큰 `값` 1 — 같은 줄에 `운반 값` 판정 문구 유지 |
| corpus | **추가** | P59. 삭제 줄 0 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음 |

- 방어 문구 24종(round 35의 23종 + `인용한 파일로 좁`)의 출현 파일 집합을 변경 전후 8파일에서 대조 — 차이 **0**.

## 6-B Historical Failure Regression

- **59 P 전수**(P1~P58 + 신규 P59, 결번·중복 0) · 변경 후 **COVERED 59 / PARTIAL 0 / GAP 0 / OBSOLETE 0**.
- P1~P38: 방어 지점이 변경 줄과 겹치지 않는다(round 4 baseline 매핑 그대로).
- 변경 사이트를 인용하는 P39~P58: 바뀐 줄은 잃은 토큰이 `값` 1개뿐이고 기존 문장이 그대로 남는다. **P56**(운반 값) — 정의 문장 불변, 뒤에 변이 범위 문장 · **P55**(실행 구간) — 불변 · **P49**(형제 맞바꿈) — 변이 축 유지, P59는 변이가 닫는 범위를 정할 뿐 변이를 금지하지 않는다 · **P38·P52·P58**(분모) — 열 추가로 행이 줄지 않는다(round 33 "열을 줄이지 않는다" 유지).

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0262 | r6 impl EP55e `resolve` 행 | 닫힘(K4) | 운반 항 `harnessId`·`modelProviderId`에 관측 없음 → `남긴 곳` → `SELF_BLOCKED` | D-0262-9 구현 턴 안 노출 |
| 0262 | r5 verify EP55e | 닫힘(K4) | 같은 행 미닫힘 | 1라운드 조기 |
| 0262 | r6 verify | root `PAIR_FAIL` VP-16(독립 축 X8) | 같은 root를 읽기로 도달 | 판정 불변 |
| 운반 항 없는 자리(가드·무효화 호출) | 0262 `engine.ts:53` 등 | 닫힘 | `운반 항: 없음` 또는 key 1항 + 기존 좌표 | inflation 0 |
| 진행 중 plan | 다음 impl/verify | — | plan 형식 migration 없음 — 새 열은 `[구현자 기입]` 표에만 걸림 | RETURN_TO_PLAN 0 |

## 6-C Cross-document Consistency

- **PASS.** "변이는 바꾼 항만 잠근다" **4사이트**: AGENTS §공통 V(정의) · impl §2 · verify §6 · plan.template 주석(+ verify.template §5 괄호 · corpus P59). 표 열은 plan.template 한 곳이고, impl §8 "열을 줄이지 않는다"가 그대로 적용된다.
- **owner 충돌 0**: 구현자는 열을 채우고, 검증자는 운반 항마다 다시 읽는다.
- **scope 충돌 0**: 새 명령·gate 없음 → `app/AGENTS.md` 무관. root `AGENTS.md` 불변.
- `node app/scripts/check-doc-inventory.mjs --check` — links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음.

## review 기록 정책

`round36-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P59: 변이 결과가 닫는 범위 — P55·P56을 행 증거로 강제).

## 남은 한계

- 열은 행마다 답을 요구하지만, 표에 오르지 않은 pair(이전 라운드 PASS)는 다시 읽지 않는다. r6 검증의 VP-16 재판정은 독립 축에서만 나왔다.
- 0262의 V는 V1 + ΔV21로 커서, 한 라운드에 한 자리씩 닫히는 비용이 크다. 전 pair의 좌표를 새 열 기준으로 한 번에 재판정할지는 사용자 결정 몫이다.

---

# review round 37 — 0262 (라운드 4→9): 분모 고정과 차단 기준

**발동/모드**: 0262 r8 verify FAIL(`ae2a72f`)로 라운드 9 > 3. 사용자가 원인 진단 뒤 "handoff-review 진행해서 두 가지 고쳐줘"로 **APPLY**를 명시했다 — (1) §10에 없는 운반 자리는 설계 정정(§10에 분모 고정)으로 보내고 (2) 고정 목록 밖에서 살아남은 변이는 원본 동작 결함이 아니면 `NEXT_HANDOFF`로 둔다. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 분모가 열려 있었다 — "path의 계약 운반 edge는 모두 자리" + verify §0 "구현자가 닫을 수 있으므로 그 pair의 분모로 재측정" | r6~r8 blocking 3건이 매번 VP-16의 새 자리(D-0262-9·10·11) | **A** — 지침이 FAIL로 보냈다. AGENTS §공통 V N bullet · verify §0 교체 + 설계자가 자리 검색 명령으로 목록 고정, 목록 미고정 pair의 운반 자리는 `PLAN_GAP` |
| 2 | "현재 계약 위반"이 정의되지 않아 잠금 부재(green 변이)를 위반으로 셌다 | r4~r8 blocking 5건 전부 미잠금, 원본 동작 결함 0(D-0262-11 probe: 원본 flush 정상) | **A** — §판정 범위에 자리 표 + **원본 동작 결함** 정의. verify §4·§6, impl §2 연결 |
| 3 | round 34~36이 FAIL inflation을 변경 단위로만 replay해 누적 루프를 보지 못하고 좌표 규칙을 넓혔다 | round 34~36 replay 표 "inflation 0" | **B** — review §6-B가 이미 요구. 규칙 추가 없음, 이번 replay에 r4~r8 누적 행을 둔다 |
| 4 | 구현·검증·review가 같은 에이전트 | r5~r7 | **E** — verify §4 자기 검증 축 유지 |
| 5 | 차단 기준 변경 자체 | 사용자 결정 | **D** — 실패 패턴이 아니라 provenance. 위반 정의 축소는 사용자 결정으로 기록 |

## Tier

**Tier 1.** failure semantics(무엇이 `PAIR_FAIL`·`PLAN_GAP`·`NEXT_HANDOFF`인가)와 owner(분모 열거: 구현자 → 설계자), template 필수 열이 바뀐다. 6-A + 6-B + 6-C 전부 수행.

## 6-A Operational Instruction Delta

기준 `ae2a72f`. 삭제 줄 **27**(AGENTS 6 · impl 3 · plan 4 · plan.template 6 · verify 4 · verify.template 4) — 추가 줄과 토큰 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §공통 V N bullet "운반 edge는 모두 자리" | **REPLACE** | 같은 edge를 설계자가 자리 검색 명령(술어 = 주어, 범위 = path 소스)으로 열거해 고정. 0238 사례·등록 변이 규칙 유지 |
| verify §0 "`PLAN_GAP`이 아니라 그 pair의 분모로 재측정" | **REPLACE**(역전, 사용자 결정 1) | 목록 미고정 pair의 운반 자리 · 기록된 검색 차집합 · 좁은 술어/범위 → `PLAN_GAP`. 형식만으로는 gap 금지 |
| AGENTS 판정 범위 "현재 node를 깨뜨리면 기존 pair 실패" · verify §4 "새 mutation이 현재 계약 위반이면 `PAIR_FAIL`" | **REPLACE**(사용자 결정 2) | 자리 표: 목록 자리 green → `PAIR_FAIL` · 목록 밖 원본 동작 결함 → `PAIR_FAIL`+`PLAN_GAP` · 목록 밖 잠금 부재 → `NEXT_HANDOFF` |
| verify §6 "표 밖 지점이 필수면 `PLAN_GAP`" | **REPLACE** | 자리 표와 같은 분기. 라벨 표본·범위 확장 문장은 주어만 "구현자 분모" → "자리 검색"으로 바꿔 KEEP, 결과를 §0 `PLAN_GAP`으로 연결 |
| impl §2 술어·범위·라벨 규칙 | **MOVE + KEEP** | 작성 owner는 plan §5-A, impl·verify는 다시 돌려 어긋나면 `PLAN_GAP`. 0194·0209·0238·0262 r5 사례 문장 그대로 |
| impl §2 · AGENTS §단계별 절차 2 "표에 없는 지점 → `PLAN_GAP`" | **REPLACE** | 목록 미고정 → `PLAN_GAP` · 목록 밖 원본 결함 → `PLAN_GAP`(목록 추가) · 잠금 부재 → `NEXT_HANDOFF` 후보, 멈추지 않음 |
| plan §5-A · READY · 체크리스트 · 마무리 | **KEEP + 확장** | 자리 목록 + 검색 명령 요구. 목록 gap은 그 pair를 다시 열거해 고정 |
| plan.template §10 표 · V 주석 · 구현자 주석 2줄 | **KEEP + 확장 / REPLACE** | 열 1개 추가(6→7, `언제 강제` 유지). 주석은 같은 축을 목록 기준으로 교체 |
| verify.template §0 행 · §5 분모 표 · §13 주석 | **KEEP + 확장** | 열 1개 추가(5→6, 목록 밖 원본 결함 재현 여부). 결과값에 `NEXT_HANDOFF` 추가 |
| corpus | **추가** | P60. 삭제 줄 0 |
| 명령·gate·reference 삭제·이동 | **없음** | inbound `N`/semantic `M/M` 대상 없음. 새 명령 없음 |

- 방어 문구 24종(round 36 목록)의 출현 파일 집합을 변경 전후 8파일에서 대조 — **잃은 파일 0 · 출현 수 감소 0**(초안에서 `세는 단위는 §10 항목이 아니라 자리`·`인용한 파일로 좁` 손실을 잡아 복원). 늘어난 곳: `차집합` +verify.template · `불변식의 주어` +plan SKILL·plan.template·verify SKILL.

## 6-B Historical Failure Regression

- **60 P 전수**(P1~P59 + 신규 P60, 결번·중복 0) · 변경 후 **COVERED 60 / PARTIAL 0 / GAP 0 / OBSOLETE 0**.
- 바뀐 줄이 방어 지점인 P: **P4**(전수 grep + N) — plan이 pair마다 검색 명령을 남겨 강화 · **P15**(누가/언제 강제) — `언제 강제` 유지 + 목록 열 · **P38**(지목 지점만 닫음) — impl §5 불변, 목록 gap도 pair 전체 재열거 · **P41**(술어 = 주어) — plan §5-A·impl §2·verify §0 · **P45**(규범 정정이 구현자에게 감) — 목록 gap이 설계자로 가는 경로가 늘어 강화 · **P51**(자기 검증 축·라벨) — verify §4 축 불변, 라벨 표본은 §6 · **P52**(자리 분모) — 운반 edge 열거가 설계자에게 이동, verify §0이 범위를 path 파일로 검사 · **P58**(범위 좁힘) — 같은 문구가 plan·impl·AGENTS·verify에 있다.
- P49·P53~P57·P59: 방어 문장이 바뀌지 않았다. 그 밖의 P는 방어 지점이 변경 줄과 겹치지 않는다(round 4 baseline 매핑).
- **의도한 범위 축소(사용자 결정 2)**: 고정 목록 밖 잠금 부재는 더 이상 blocking이 아니다. 행동 결함은 목록 밖에서도 blocking이고, 잠금 부재는 `NEXT_HANDOFF`로 기록돼 사라지지 않는다.

### V/lifecycle replay — 거짓 PASS·FAIL inflation

| anchor | 라운드 · finding | 변경 전 | 새 규칙 | 방향 |
|---|---|---|---|---|
| 0262 | r4 D-0262-7 `agent:list` 분기(§10 EP55d·EP-08 항목) | `PAIR_FAIL` | 목록 자리 → `PAIR_FAIL` | 불변 |
| 0262 | r5 D-0262-8 `resolve-turn` merge(EP55e `resolveTurnProvider` 모델) | `PAIR_FAIL` | 항목 안 자리면 `PAIR_FAIL`, 미열거로 읽으면 `PLAN_GAP` | PASS 경로 0 |
| 0262 | r6 D-0262-9 VP-16 target 인자(목록 없음) | `PAIR_FAIL` → 구현자 | `PLAN_GAP` → 설계자가 VP-16 목록을 한 번에 고정 | FAIL 1 → gap 1 |
| 0262 | r7 D-0262-10 · r8 D-0262-11(같은 VP-16) | `PAIR_FAIL` ×2 | r6 고정 목록 안이면 같은 라운드에 함께 닫힘, 밖이면 원본 결함 0 → `NEXT_HANDOFF` | 라운드 2 감소 |
| 0238 | r3 VP-10 `ProviderDetail` props 맞바꿈(EP-05 5곳, 검색 없음) | `PAIR_FAIL` | path가 `ProviderDetail`을 명시 → 목록 미고정 운반 자리 → `PLAN_GAP` | 거짓 PASS 0 |
| 0194 | r4 `store-parse.ts` 3리터럴(술어 `compact<`) | BLOCKING D20 | 재시작 때 필드 소실 = 원본 동작 결함 → `PAIR_FAIL`+`PLAN_GAP` | 거짓 PASS 0 |
| 0209 | r11 `readOnly: true` 거짓 라벨 3건 | BLOCKING D29 | 수정 전 코드가 상태 변경 명령을 read-only로 분류 = 원본 동작 결함 → blocking. 라벨 술어는 §0 표본 검사로 `PLAN_GAP`도 함께 | 거짓 PASS 0 |
| 0198 | r4→r5 §10 두 행 신설 요구 | 구현자로 감(round 17 이전) | `PLAN_GAP` → 설계자 | 불변(P45) |
| 진행 중 plan | 목록 없는 V1·ΔV pair | — | 형식만으로 gap 금지. 목록 밖 운반 자리를 찾았을 때만 그 pair를 고정 | migration 0 |

## 6-C Cross-document Consistency

- **PASS.** 자리 표 정본은 AGENTS §판정 범위와 운영 gate 한 곳이다. verify §4, impl §2, plan §5-A, plan.template §10 주석, verify.template §13 주석이 그 절을 링크하고, verify §6은 링크 없이 같은 분기를 적는다. `원본 동작 결함` 정의 문장은 AGENTS·impl·verify 3곳이 "변이를 심지 않은 현재 코드가 production 진입점에서 그 pair의 `실패 의미` 상태"로 같다.
- **owner**: 목록 열거·정정 = 설계자(plan §5-A·마무리), 다시 돌린 검색의 차집합 = 구현자(impl §2)·검증자(verify §0). 구현자는 목록을 고치지 않고 `PLAN_GAP`으로 올린다 — AGENTS §라이프사이클 "`PLAN_GAP`을 구현자에게 넘기지 않는다"와 충돌 0.
- **결과 전이**: 목록 밖 원본 결함 = `PAIR_FAIL`+`PLAN_GAP` → verify §11 "둘 다 기록하고 다음 주체는 planner"와 일치.
- **migration**: verify §0 "형식만으로는 `PLAN_GAP`을 만들지 않는다" = AGENTS §신규 템플릿 적용 경계 = impl §0.
- **scope**: 새 명령·gate 없음 → `app/AGENTS.md` 무관. root `AGENTS.md` 불변. `node scripts/check-doc-inventory.mjs --check`(app/) — links ok. `git diff --check` 출력 0.
- AGENTS 위생: 추가분에 비밀·개인정보·변동성 운영정보 없음.

## review 기록 정책

`round37-review.md`를 만들지 않았다 — 사용자 보존 요구 없음, 압축으로 잃는 rationale 없음. 신규 P **1**(P60: 열린 분모의 FAIL inflation — P52·P58의 반대 방향 실패).

## 남은 한계

- 목록의 질은 설계자의 검색 술어에 달려 있다. 술어가 놓친 자리의 잠금 부재는 이제 `NEXT_HANDOFF`로 간다 — 행동 결함이 아니므로 사용자 결정 2가 받아들인 비용이다.
- 0262 VP-16은 아직 목록이 없다. 새 규칙을 0262 보드에 적용하면 다음 차례는 Codex r9가 아니라 설계자의 VP-16 목록 고정이며, 보드 변경은 사용자 결정 몫이다.

---

# review round 38 — 사용자 결정: 고장 표준·재량·이력, review 3라운드 주기, verify 9회 상한

**발동/모드**: 사용자가 재발 방지 논의에서 다섯 가지를 결정했다(2026-10-19) — 고장 종류 표준화 · 구체 고장 선택은 수행 모델 재량(전수 불가 인정) · review는 3라운드마다 · verify마다 고장 이력, `못 잡음`은 목록 안팎 모두 다음 구현이 고침 · verify 9회면 종료. 질의 답: "목록 안팎 모두 고침" · "새 작업으로 넘기고 종료" · "0262 바로 적용". **APPLY**. 제품 코드 변경 0.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 반복 라운드를 끝내는 상한이 없었다 — review가 매 라운드 돌며 규칙을 늘렸다 | 0262 r4~r9 · 0188 10회 · 0209 11회 | **D** — 사용자 결정. verify 9회 상한·`verify/CLOSED` 상태, review는 3·6회째(+9회째 종료 시) |
| 2 | 고장 방식이 검증자마다 달라 지적 대상이 바뀌었다 | 0262 r6~r8 X·A·M 변이 | **D** — 표준 7종류, 자리·방식은 재량, 시도 이력 의무 |
| 3 | round 37의 목록 밖 `NEXT_HANDOFF` 분기 | round 37 | **D** — SUPERSEDED: `못 잡음`은 목록 안팎 모두 다음 구현이 고친다. 반복은 9회 상한이 끝낸다 |

## Tier

**Tier 1.** trigger(review 주기), lifecycle(`verify/CLOSED`), failure semantics(목록 밖 `못 잡음` → `BLOCKING`), template 필수 필드(고장 이력 표)가 바뀐다.

## 6-A Operational Instruction Delta

기준 `8121b48`. 삭제 줄 33 — 추가 줄과 대조.

| 항목 | 판정 | 근거 |
|---|---|---|
| review 트리거 "라운드 3 초과"(AGENTS·impl §0·verify 마무리·review 실행 조건·plan.template) | **REPLACE** | 사용자 결정 — verify 3·6회째 + 9회째 종료 시. impl 턴 3 초과 트리거 KEEP |
| 목록 밖 `원본 동작 결함`/`NEXT_HANDOFF` 분기와 정의(AGENTS·impl §2·verify §4·§6·plan §5-A·두 template) | **DELETE** | 사용자 결정 "목록 안팎 모두 고침"으로 분기가 필요 없다. `원본 동작 결함` 문자열 0건 |
| 목록 미고정 pair → `PLAN_GAP`(round 37 결정 1) | **KEEP** | 고장은 이력에 남아 다음 구현이 함께 고친다 |
| "새 mutation은 검증 범위를 정하지 않는다" | **REPLACE** | 고장 이력이 다음 라운드의 의무 범위를 정한다 |
| 변이 하한(등록·인용·이전 잡음 재실행·자기검증 축·형제 맞바꿈) | **KEEP** | 재량의 바깥 하한으로 명시. P49·P50·P51 방어 유지 |
| lifecycle·INDEX 범례·archive 규칙 | **확장** | `verify/CLOSED` 추가, CLOSED 행도 archive |
| verify.template §4 변이 표 | **REPLACE** | 고장 이력 표(ID·위치·종류·바꾼 내용·직전/이번 결과·잡은 테스트) + 검산 줄 |
| 명령·gate·reference | **없음** | inbound `N`/`M/M` 대상 없음 |

- 방어 문구 24종의 출현 파일 집합 변경 전후 차이 **0**. `PLAN_GAP` 출현 70→67은 삭제한 목록 밖 분기 3건이다.

## 6-B Historical Failure Regression

- **60 P 전수** · 변경 후 COVERED 59 / **PARTIAL 1(P60, 사용자 결정으로 수용)** / GAP 0 / OBSOLETE 0.
- **P60**(열린 분모의 FAIL 반복): 목록 밖 `못 잡음`이 다시 `BLOCKING`이라 반복 자체는 막지 않는다. 9회 상한과 3라운드 review로 끝을 정했고, 사용자가 이 교환을 택했다(D) — 회귀가 아니라 정책 교체로 기록한다.
- P49·P50·P51·P52·P58·P59: 하한·좌표 규칙 문장 불변. P45: `PLAN_GAP`을 구현자에게 넘기지 않는 규칙 불변.

### V/lifecycle replay

| anchor | round 37 | round 38 | 방향 |
|---|---|---|---|
| 0262 r6~r8 목록 밖 `못 잡음` | `PLAN_GAP` 1 → 이후 `NEXT_HANDOFF` | `BLOCKING` — 다음 구현이 고침 | 거짓 PASS 0 · FAIL 수용 |
| 0262 verify 9회째(r9, `8121b48`) | 계속 | `verify/CLOSED` — 남은 항목은 새 handoff 후보 | 종료 |
| 0188(10)·0209(11) | 매 라운드 review | review 3·6·9, 9회째 종료 | 상한 |
| 0194 r4·0209 r11 실제 결함 | `BLOCKING` | `BLOCKING` | 불변 |

## 6-C Cross-document Consistency

- **PASS.** 정본은 AGENTS §판정 범위(자리 표)·§고장 내 보기(표준·재량·이력)·§라운드(3회 주기·9회 상한)다. impl §0·§2·§3·§5, verify §4·§6·§11·마무리, plan §5-A, review 실행 조건, 두 template, INDEX 범례가 같은 문장으로 인용한다.
- `verify/CLOSED`: AGENTS 상태표·다이어그램 = verify §11·마무리 = verify.template §15 = INDEX 범례.
- `node scripts/check-doc-inventory.mjs --check`(app/) links ok · `git diff --check` 0.

## 남은 한계

- 재량 고장은 사람·세션마다 다르다. 표준 종류와 이력이 그 차이를 기록할 뿐 없애지는 않는다.
- 고장 내 보기 스크립트는 아직 저장소에 없다(세션 임시 폴더). 같은 시험을 다른 세션이 그대로 재현하려면 별도 결정이 필요하다.

---

# review round 39 — 0290 (verify 3회째 FAIL): 경쟁 결함의 형제 순서와 병합 뒤 좌표

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0290 verify 3회째 `FAIL`(r3, `97271b8`) 뒤 r4 착수 전 의무 review. 사용자 `/handoff-review 290` 후 질의에서 **APPLY** 선택(2026-11-02).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 경쟁 결함을 지적된 순서 하나로 고쳐 형제 순서에서 반대 실패가 열렸다 | 0290 r1 D1 → r2 D7(통보 0) → r3 D8(통보 2), 세 순서 모두 `a2e8464` 1회 | **A** — impl §5-2 "형제 연산·같은 `await`"는 공간 축만 셌다. 순서 분모·변경 전 기대값 규칙 추가(P61) |
| 2 | verify가 PR 브랜치에서 확인한 좌표가 rebase 병합 뒤 `main`에 없다 | 0290 r1·r2 좌표 9개 | **A** — P47 규칙의 "공유 브랜치"가 병합 대상을 정하지 않았다. `main` 조상 확인 추가(P47 보강) |
| 3 | 재로드 뒤 감시 재설정 edge(D9)가 r1부터 미잠금 | 0290 r3 X07 | **B** — 실행 구간 규칙(P55)이 이미 막는다. R3-03은 `watchFile` mock·직접 `poll()`로 그 edge 밖이었다. 지침 변경 없음 |
| 4 | CI 로그 아카이브 egress 403으로 vitest 집계 미관측 | 0290 r2·r3 | **E** — Test 단계 conclusion으로 판정, 한계 기록 유지 |

## Tier

**Tier 1.** impl·verify의 evidence 요구(순서 분모·형제 순서 재현)와 repository operation 판정 기준(좌표 = `main` 조상)이 바뀐다.

## 6-A Operational Instruction Delta

기준 `97271b8`. 바뀐 기존 줄 4개 전부 **REPLACE(강화)** — 변경 전 문장이 새 줄에 그대로 들어 있다(토큰 대조 4/4, 다른 토큰은 `-t`로 확인` → `-t` + main 조상 확인` 뿐). DELETE 0 · MOVE 0.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §INDEX 운영 좌표 규칙 | KEEP + 추가 | 새 bullet "공유 브랜치는 병합 대상 `main`" |
| AGENTS §단계별 절차 2 재구현 bullet | REPLACE | 기존 문장 + 경쟁 순서 절 |
| AGENTS §단계별 절차 3 좌표 기입 | REPLACE | `main` 조상 확인 추가 · 형제 순서 재현 bullet 신설 |
| impl §5-2 | KEEP + 추가 | 경쟁 순서 문단·사례 |
| verify §4 · §9 | KEEP + 추가 | 형제 순서 bullet · 이전 라운드 좌표 재확인 |
| verify.template §11 | REPLACE | 좌표 확인 칸에 `main` 조상 |
| 명령·gate·reference | 없음 | inbound `N`/`M/M` 대상 없음 — 이동·삭제 0 |

## 6-B Historical Failure Regression

- **61 P 전수**(P1~P61) · 변경 후 COVERED 60 / PARTIAL 1(P60, round 38 사용자 결정 유지) / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0이라 round 38에서 COVERED였던 59개는 그대로다.
- P47: 강화 — 확인 브랜치가 병합 대상이어야 한다는 조건 추가. P61: 신규, impl §5-2·verify §4가 실패 **전에** 발동한다(재구현 턴의 불변식 단계·verify의 적대 축 단계).
- P25·P55: 불변 — 순서 분모와 별개로 관측 지점·실행 구간을 판정한다.

### V/lifecycle replay

| anchor | 변경 전 | 변경 후 | 방향 |
|---|---|---|---|
| 0290 r2(`68b886b`) D7 | r3 FAIL로만 발견 | r2 구현이 순서(재로드가 편집 전/후 읽음 × 완료 도중/뒤)를 열거해 0회를 스스로 봄 | 거짓 PASS 0 |
| 0290 r3 D8 | verify 검증자 축으로 발견 | 구현 단계에서 `a2e8464` 대조로 2회를 봄 · verify 형제 순서 하한도 같은 축 | 거짓 PASS 0 |
| 0290 r3 D9 | `PAIR_FAIL` | `PAIR_FAIL`(불변) | FAIL inflation 0 |
| 0188 원자성 5라운드 | impl §5 사례 | 공간 축 규칙 그대로 | 불변 |

새 규칙은 disposition을 추가하지 않는다 — 형제 순서에서 나온 결함은 기존 자리 표로 간다.

## 6-C Cross-document Consistency

- **PASS.** 경쟁 순서: AGENTS §단계별 절차 2 = impl §5-2, AGENTS §단계별 절차 3 = verify §4. 좌표: AGENTS §INDEX 운영(정의) = §단계별 절차 3 = verify §9 = verify.template §11. plan §5-A·plan.template·root AGENTS의 "공유 브랜치"는 같은 정의를 상속한다.
- `node scripts/check-doc-inventory.mjs --check`(app/) links ok · `git diff --check` 0.

## 남은 한계

- 순서 열거의 완결성은 행위자 식별에 달려 있다 — 세 번째 행위자(다른 scope의 hold 등)를 놓치면 분모가 좁다. 변경 전 코드 대조가 기대값만 주고 분모를 주지는 않는다.

---

# review round 40 — 0292 (verify 3회째 FAIL): 규칙 분기마다 입력 · 마지막 수정 뒤 게이트

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0292 verify 3회째 `FAIL`(r3, `6fd1fc41`) 뒤 r4 착수 전 의무 review. 사용자 `/handoff-review` 후 질의에서 **APPLY** 선택(2026-11-03).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 자리 규칙이 적은 분기 중 하나에만 입력을 줘 같은 자리의 다른 분기가 미잠금 | 0292 #15 `EngineCard.tsx` — r2 V26(미지원 입력만) → r3 W03·W04(사유 없는 미지원 입력 없음) · r2 V12(단일 메시지 턴) · r1 X13 등(사유 기본값) | **A** — P56은 운반 값의 구별만 요구했다. 정상 수행해도 r3 oracle 칸(지원 행 + 3사유)은 통과했다. "분기마다 입력" 규칙을 P56 방어 자리 전부에 통합(P62) |
| 2 | 게이트를 통과시킨 뒤 다른 게이트 지적으로 파일을 고치고 재실행하지 않아 오래된 0을 보고 | 0292 r3 D15 — eslint 0 보고 ↔ 실제 error 1, Windows CI #959 Lint 실패 | **A** — impl §7·§8은 "이번 턴 관측"만 요구하고 마지막 수정과의 순서를 묻지 않았다. 순서 요구 추가(P63) |
| 3 | 구현 보고 "브랜치에 PR 없음 — CI 대기" ↔ PR #529가 r2 verify 때부터 열려 있음 | 0292 r3 | **B** — impl §8 "상태 사본을 다시 읽어 확인"이 이미 요구한다. 지침 변경 없음 |
| 4 | 전체 스위트 부하에서 `vi.waitFor` 기본 1초 테스트가 흔들림 | 0292 r3 N10 · 구현자 3건 | **E** — 환경 한계 기록, 판정은 단독·재실행으로 분리(verify §8 유지) |

- **병행 진단과의 차이.** 이 review 커밋 전에 Codex r4(`c7757e77`)가 사전 진단(DIAGNOSE_ONLY)을 남기고 #1·#2를 B(지침 KEEP)로 판정했다. 이 review는 #1을 A로 유지한다 — impl §2는 값 구별, §3은 형제 맞바꿈 변이만 요구하고 맞바꿈(사유↔일반)은 r3 3사유 케이스가 잡아 W03·W04를 막지 못했다. #2는 impl §8 "갱신된 값을 다시 읽어 확인"과 A/B 경계지만 관측 순서를 명시한 문장이 없어 시점 한 문장과 template 열 표기로 강화했다. r4 보드 상태(`impl/IN_PROGRESS`)는 그대로 둔다.

## Tier

**Tier 1.** plan oracle·impl 닫힘·verify 판정의 evidence 요구(분기 입력)와 impl 게이트 evidence 시점이 바뀐다.

## 6-A Operational Instruction Delta

기준 `6fd1fc41`. 바뀐 기존 줄 10개 전부 **REPLACE(강화)** — 변경 전 문장이 새 줄에 그대로 있고 지워진 조각은 활용 어미 4개(`준→주며`·`인→이거나`·`운…채운→채우고`·`졌→지고`)뿐이다(`SequenceMatcher` 대조 10/10). DELETE 0 · MOVE 0.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §공통 V 운반 값 규칙 | KEEP + 추가 | 분기 입력 문장 신설(설계자·구현자 책임 명시) |
| AGENTS §단계별 절차 2 강제 지점·관측값 bullet | REPLACE | 분기 입력 · 마지막 수정 뒤 게이트 |
| AGENTS §단계별 절차 3 좌표 판정 | REPLACE | 분기 입력 대조 추가 |
| plan §5-A oracle · plan.template 강제 지점 인용·구현 보고 열 | REPLACE | 분기 입력 · `마지막 수정 뒤 실행` |
| impl §2 · §7 | KEEP + 추가 | 분기 문장 · 게이트 시점 bullet |
| verify §6 · verify.template §5 | REPLACE | 분기 입력 대조 |
| 명령·gate·reference | 없음 | inbound `N`/`M/M` 대상 없음 — 이동·삭제 0 |

## 6-B Historical Failure Regression

- **63 P 전수**(P1~P63, heading 연속) · 변경 후 COVERED 62 / PARTIAL 1(P60, round 38 사용자 결정 유지) / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0이라 round 39에서 COVERED였던 60개는 그대로다.
- P56: 강화 — 값 구별에 분기 입력을 더했다. P62·P63: 신규, plan READY(oracle 칸 작성)·impl §2(자리 닫기)·impl §7(게이트 기록)에서 실패 **전에** 발동한다.
- P49(형제 슬롯 맞바꿈)·P55(실행 구간)·P59(변이 red 범위): 불변 — 분기 입력은 구간 안 좌표의 입력 조건이다.
- P60: 불변 — 새 규칙은 §10 고정 목록 자리의 규칙 칸이 이미 적은 분기에만 걸려 분모를 열지 않는다.

### V/lifecycle replay

| anchor | 변경 전 | 변경 후 | 방향 |
|---|---|---|---|
| 0292 r2 V26(`24d91a6`) | verify 재량 축으로 발견 → `PAIR_FAIL` | 구현자가 규칙 칸 분기(지원 행)에 입력을 둬 구현 단계에서 닫음 · 남으면 `PAIR_FAIL` | 거짓 PASS 0 |
| 0292 r3 W03·W04(`c5c6f39`) | verify 독립 축으로 발견 → `PAIR_FAIL` | 같은 — oracle 칸이 좁아도 구현자가 규칙 칸을 따름. `PLAN_GAP`으로 내리지 않음 | 거짓 PASS 0 · FAIL inflation 0 |
| 0292 r3 D15 | CI·verify가 사후 발견 | 구현자가 마지막 수정 뒤 eslint 재실행으로 사전 발견 | 거짓 PASS 0 |
| 0265 r2 D-0265-3(P56) | `PAIR_FAIL` | `PAIR_FAIL`(불변) | 불변 |

## 6-C Cross-document Consistency

- **PASS.** 분기 입력: AGENTS §공통 V(정의) = §단계별 절차 2 = impl §2 = plan §5-A = plan.template; §단계별 절차 3 = verify §6 = verify.template §5. 게이트 시점: AGENTS §단계별 절차 2 = impl §7 = plan.template 구현 보고. verify §8(자기 게이트)·`app/AGENTS.md` 명령은 바뀌지 않았다. root AGENTS·CI 정본 무변경.
- `node scripts/check-doc-inventory.mjs --check`(app/) links ok · `git diff --check` 0.

## 남은 한계

- 분기 열거는 규칙 칸의 서술에 달려 있다 — 설계자가 규칙 칸에 분기를 적지 않은 자리는 이 규칙이 닿지 않고, verify 재량 축이 남은 방어다.

# review round 41 — 0294 (verify 3회째 RETURN_TO_PLAN) + 사용자 결정: 독립 축 공통 하한 · 발견 분류와 확장 창 · 열거 sweep · SKILL 구조 정리

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0294 verify 3회째 `RETURN_TO_PLAN`(`949b246`) 뒤 의무 review. 같은 날 사용자가 `/skill-creator`로 "조사한 파일을 참조하여 handoff-plan·impl·verify 스킬을 업데이트하라 … 최근 모델이 최고 성능을 끌어내지 못할 부분은 과감히 제거·보완하라"를 요청 → **APPLY**(2026-11-05). 근거 문서는 대화 중 작성한 개정안 v2(scratchpad, git 미반영).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 열린 입력 집합을 판정하는 계약에서 같은 축의 확장 반례가 라운드마다 나옴 | 0294 r1~r3(트리 영향 0) | **A + D** — 열거를 넓히는 정정으로는 닫히지 않는다. 발견 분류 + 확장 창 verify 1·2회째(사용자 결정) + 검사기 설계 권고(P64) |
| 2 | 보고 밖 독립 축 하한이 구현자 = 검증자일 때만 걸림 | Codex 구현 라운드 11/28 · Claude 10/10 | **A + D** — 설계자 = 검증자라 plan의 사각은 구현자와 무관하게 공유된다. 하한을 모든 verify로(P65) |
| 3 | 유한한 이행 결함이 라운드마다 몇 개씩 발견 | 0259 r1~r5 · 0290 r1~r4 · 0262 | **A** — 발견 방법(재량 표본)에 하한이 없었다. 열거 원문 sweep(P66) |
| 4 | 0294 r3 규칙 칸 분기 13개에 UT 입력 없음 | r3 D5 | **B** — impl §2 "분기마다 입력"이 이미 있었다. 같은 문장을 더하지 않고 sweep(기계 대조)으로 evidence를 강화 |
| 5 | 0294 r3 W1·W2 판정 오류 | r3 D5 | **F** — 검증이 잡았다. 지침 변경 없음 |
| 6 | 적대 축만으로 4~9라운드를 도는 비효율 | 사용자 | **D** — round 38 "목록 안팎 모두 고침"을 창 밖 확장 후보에 한해 대체 |
| 7 | SKILL 본문이 한 줄에 규칙 여러 개 · 인라인 사례 서사 · 강조 남발 | 사용자 요청 | 구조 정리 — 규칙 문장 보존, 사례 서사는 corpus로 MOVE(ID만 남김), 결정 표 추가 |

## Tier

**Tier 1.** lifecycle(확장 창·동결·재개)·failure semantics(발견 분류)·required template field(verify 메타·분류 열·sweep 행)·evidence 하한(⑥ 공통·⑦ sweep)이 바뀐다.

## 6-A Operational Instruction Delta

기준 `949b246`. 구판 각 줄의 백틱 식별자·사례 ID를 신판(+`docs/handoff/AGENTS.md`)에서 찾는 대조로 미일치 후보 45줄(verify 14 · impl 23 · plan 5 · AGENTS 3)을 뽑아 전부 판독했다 — 사례 세부(파일명·수치·해시)·앵커 표기만 빠졌고 규칙 문장은 신판에 있다. 인라인 사례 블록 14개(impl 12 · plan 1 · verify 1)는 corpus P38~P63에 원문이 있다.

| 항목 | 판정 | 근거 |
|---|---|---|
| verify §4 "구현자 = 검증자면 보고 밖 축 ≥1" | REPLACE | ⑥ — 모든 verify(강화) |
| AGENTS §판정 "못 잡음 자리 표"(round 38) | REPLACE | 분류 표 + 창 — 창 안은 같고 창 밖 확장 후보만 후보 표(D) |
| impl §3 "직접 행동 oracle은 mutation 비의무" · 잠금 표 "그 밖 해당 없음" | REPLACE | ⑦ sweep 기본 변이(열거 항목 한정 — "일반 hunk를 자동 분모로 삼지 않는다"는 유지) |
| "직전 `못 잡음`·`동치` 전부 재실행" | REPLACE(범위) | ③ — 후보 표·`경계` 행 제외, 그 밖은 같음 |
| "이전 라운드 red 변이 재실행"(전부) | REPLACE(범위) | ④ — diff가 닿은 자리·oracle 파일의 행, 공용 설정·setup·헬퍼가 바뀌면 전부. 닿지 않은 결정적 행은 결과가 같다 |
| verify.template 메타 `자기 검증 여부` · §4 `자기검증 분모` | REPLACE | `확장 창`·`독립 축(⑥)`·`열거 sweep(⑦)`·`발견 분류`·`구현 주체·문맥` 칸 |
| plan.template §10 "목록 안팎 모두 다음 구현이 고친다" | REPLACE | 분류·창 문장 + `선언 경계`·검사기 설계 칸 |
| impl §6 되먹임 3갈래 | REPLACE(확장) | §7 분류 표 — 3갈래 유지 + 현재 결함·확장 후보·비귀속 행 |
| impl 절 번호 | MOVE | 새 §3 sweep · 진단 §3→§4 · Product/UX §4→§5 · 재구현 §5→§6 · 되먹임 §6→§7 · gate §7→§8 · 보고 §8→§9. inbound N = AGENTS 최소 계약 15 · plan.template 13 = 28 → 새 절 제목 대조 28/28 |
| 인라인 사례 서사 14블록 | MOVE | corpus P38~P63 원문 · SKILL에는 사례 ID만 |
| 사례 예시 문구(`credential commit·revoke·expiry·401/403` 등) | DELETE | 예시 — 규칙 문장 유지 |
| 신규 | — | 분류·창·동결·재개(AGENTS·verify·plan) · sweep(impl·verify·AGENTS·template) · 후보 표(INDEX·AGENTS·verify·plan) · 선언 경계·검사기 설계(plan·template) · `handoff-verify/scripts/mutate.py` |
| 명령·gate | KEEP | `app/AGENTS.md` 게이트 명령·ABI 규칙·CI 무변경 |

## 6-B Historical Failure Regression

- **66 P 전수**(P1~P63 + 신규 P64~P66, heading 연속). 변경 전 COVERED 62 / PARTIAL 1(P60) → 변경 후 **COVERED 66** / PARTIAL 0 / GAP 0 / OBSOLETE 0.
- **P60**: PARTIAL → COVERED — 열린 분모의 반복이 창 2회로 끝나고, 원본 동작 결함(현재 결함)은 창과 무관하게 막는다(round 37 규칙이 창 밖에서 되살아남).
- **P51**: COVERED 유지·강화 — ⑥이 구현 주체·세션과 무관해졌다.
- **P50**: COVERED — ④가 diff 범위로 줄었지만 장치를 교체한 라운드는 그 oracle 파일을 diff가 건드리므로 재실행 대상이다.
- P38~P41·P44·P48·P49·P52~P59·P61~P63: 규칙 문장 보존(6-A), 서사만 corpus로 이동. P62는 plan 규칙 칸↔입력 칸 1:1과 sweep 분기 입력으로 강화. P1~P37: plan 규칙 문장 보존. P45: 창 밖 확장 후보는 `PLAN_GAP`이 아니라 구현자에게 넘길 gap이 생기지 않는다.

### V/lifecycle replay

| anchor | 변경 전 | 변경 후 | 방향 |
|---|---|---|---|
| 0294 r1 D1(`426109e`) | `PLAN_GAP` | 현재 결함(트리 미배율 `AbortSignal.timeout(40_000)`) + 창 안 확장(X9) → `PLAN_GAP` | 같음 |
| 0294 r2 D2·D3(`544eb01`) | `PAIR_FAIL` + `PLAN_GAP` | 이행(D2) + 창 안 확장(D3) → `RETURN_TO_PLAN` | 같음 |
| 0294 r3 D5·D6(`949b246`) | `PAIR_FAIL` 19 + `PLAN_GAP` 7 → `RETURN_TO_PLAN` | 이행 14 `BLOCKING` + 확장 12 후보 표 → `FAIL`(판정 정정) | 거짓 PASS 0(이행 유지) |
| 0262 r6~r8 목록 밖 `못 잡음` | `BLOCKING`(round 38) | 목록 미고정이면 `PLAN_GAP` 1회 → 고정 뒤 목록 밖 잠금 공백은 창 안 `PLAN_GAP`·창 밖 후보 표, 원본 동작 결함은 `BLOCKING` | 반복 상한 2 |
| 0259 r1~r5 path edge 미잠금 | 매 라운드 `PAIR_FAIL` | 이행 — 구현자 sweep·verify 1회째 sweep이 전수로 발견 | 거짓 PASS 0 · 라운드 감소 |
| 0292 r3 W03·W04 | `PAIR_FAIL` | 이행(규칙 칸 분기) — impl sweep 분기 입력으로 사전 발견 | 같음 |
| 0275~0281 Codex r1·r2 | ⑥ 없음 | ⑥ 의무 — 창 안 확장 후보가 생기면 `RETURN_TO_PLAN` 가능 | 하한 강화(사용자 결정 비용) |
| 0209 r11 D29 | `BLOCKING` | 이행 결함 — 같음 | 같음 |

## 6-C Cross-document Consistency

- **PASS.** 발견 분류·창: AGENTS §판정(정본) = verify §11 = impl §7 = plan SKILL(무엇을 위해·verify 뒤 갱신) = root `AGENTS.md` 한 줄 = verify.template §13 = plan.template 파생 이슈. 하한 ①~⑦: AGENTS §고장 내 보기 = verify §4 표 = verify.template §4 = AGENTS §단계별 절차 2·3. sweep: impl §3 = verify §4 ⑦ = plan.template 잠금 표 = `mutate.py`. 후보 표: AGENTS §INDEX 운영 = verify 마무리 = plan 먼저 읽을 것·§4 = INDEX `## 새 handoff 후보`.
- 9회 상한·review 3·6 주기·커밋 trailer·좌표 규칙: 불변. review SKILL §5 책임 경계 문장만 갱신.
- `node scripts/check-doc-inventory.mjs --check`(app/) · `git diff --check` · 세 SKILL frontmatter YAML 파싱 3/3 — 결과는 커밋 직전 실측.

## 남은 한계

- 창 밖 확장 후보는 고치지 않는다 — 게이트가 미래 형태를 놓칠 위험은 후보 표의 승격 계기(실제 발생·사용자 요청)에 기댄다(사용자 결정).
- "원문이 덮는가"에는 해석 여지가 있다 — 해석이 필요하면 확장으로 둔다는 기본값이 부풀림을 막지만, 축소 방향 오판은 verify 메타의 분류 수 지표로만 사후에 본다.
- subagent 기반 skill eval은 돌리지 않았다 — 개정안 v2의 운영 시나리오 S1~S23 재생과 위 replay로 대신했다.

# review round 42 — handoff-review SKILL 자체(사용자 요청): v2 정합 · 판정 정정(전환) 절차 · 6-A 문장 대조 도구

**발동/모드**: 사용자 "Review 스킬도 포함하여 업데이트하라"(2026-11-05, round 41의 skill-creator 요청 후속) → **APPLY**. 대상은 review SKILL과 그것이 쓰는 6-A 도구이고, 도구로 round 41 판본을 다시 대조해 찾은 약화도 같은 라운드에서 복원했다.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | review SKILL이 v2 어휘(발견 분류·확장 창·하한 ①~⑦·후보 표)와 판정 정정 절차를 모름 | 0294 r3 정정(`3d1916d4`)이 선례만 있고 규칙 없음 | **A** — §1 verify 메타 지표 · §2 분류 대조 · §3 감사 bullet 2 · §6-C 어휘 · §8 전환 신설 |
| 2 | 6-A가 표식(백틱·사례 ID)만 대조해 표식 밖 문장의 약화를 못 봄 | round 41 판본 verify §8 "만든"(P41) · verify ② 이관 동작 · sweep "제거, 형제가 있으면 맞바꿈"(P49) | **A** — `scripts/instruction_delta.py`(표식·문장 대조, 같은 파일/다른 파일 분리) + word-diff 안내. 3건 복원 |
| 3 | 대조 pool에 corpus를 넣으면 지운 규칙이 corpus의 `→ 규칙.` 문장에 가려짐 | round 41 범위 잃음 44 → corpus pool 시 26 | **A** — corpus pool 금지(SKILL §6-A · failure-patterns.md) |
| 4 | 구 완료 조건 "AGENTS 변경 시 위생·CLAUDE stub"이 본문에 없던 체크리스트 전용 요구 | 구 review SKILL 완료 조건 | **A** — §6-C 본문으로 이동 |
| 5 | 지침 문장 원칙이 review에 없어 라운드마다 다시 판단 | 사용자 요청(최근 모델 성능) | 구조 정리 + §4 문장 원칙 표(규칙+이유 · 판정 표 · 서사는 corpus · 절제된 강조 · 절차 우선) |

## Tier

**Tier 1.** review의 evidence 요구(verify 메타·분류 대조·도구)·lifecycle(판정 정정)·verify §0 횟수 규칙이 바뀌고, round 41이 약화한 normative 문장 3건을 복원한다.

## 6-A Operational Instruction Delta

기준 `3d1916d4`. `instruction_delta.py --prose --pool docs/handoff/AGENTS.md`.

| 대상 | 후보 | 판정 |
|---|---|---|
| review SKILL(전면 재작성) | 40 → 복원 후 39(잃음 2 · 이동? 3 · 문장 29 · 문장 이동? 5) | 전부 판독. 약화 3 복원 — §1 anchor "최소" · §6-C "최소 다음을 대조" · 완료 조건 "증거는 줄이지 않음". 나머지는 표식 표기(`PARTIAL/GAP`→`PARTIAL`·`GAP`) · 목록→표 · 문장 재작성(KEEP/REPLACE) |
| verify·impl SKILL · plan.template · AGENTS · failure-patterns.md | 0 · word-diff 지운 단어 13 | 전부 강화(sweep "제거 + 맞바꿈" · "만들거나 고친") 또는 낡은 예시 정리(`P1~P37 같은` → `historical coverage(6-B)`) |
| review 절 번호 | — | MOVE — Decision drift §8→§9, 전환 §8 신설. 번호 인용 inbound N = 3(`0211 plan` §3-5 · `regression-coverage` §6·§7) → 같은 번호·같은 의미 3/3. 구 §8 인용 0 |
| round 41 판본 재대조(`949b246..516665f6`) | SKILL·AGENTS 168(잃음 44 · 이동? 5 · 문장 111 · 문장 이동? 8) + template·root 10 | round 41 기록이 판독하지 않은 134줄(SKILL·AGENTS 124 + template 10)을 판독(미판정 0, 집합 대조). 약화 3 복원 — verify §8 "만들거나 고친"·"차집합이 비어야" · verify ② "`closed`여도 상태를 되돌려 §13" · sweep 괄호 5곳 "제거 — 계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함" |
| 명령·gate | KEEP | `app/AGENTS.md` 명령·CI 무변경 |

- 같은 표식 대조를 최종 `516665f6`에 다시 돌리면 44(verify 13)이고, round 41 기록은 45(verify 14)였다.

## 6-B Historical Failure Regression

- **66 P 전수**(P1~P66, heading 연속). corpus의 `현재 방어`가 review SKILL을 가리키는 P는 0이다 — review 재작성은 P 방어 지점을 옮기지 않았다.
- round 41 판본 재판정: **P41 PARTIAL**(verify §8이 "만든" 게이트로 좁아져 고친 게이트가 빠짐 — round 41 6-B가 놓침) · **P49 PARTIAL**(sweep 괄호가 "제거 대신 맞바꿈"으로 읽히고 plan.template 주석의 "지우는 변이에 더해"가 빠짐). P44는 판정 문장이 남아 COVERED(이관 동작만 복원).
- 변경 후 **COVERED 66** / PARTIAL 0 / GAP 0 / OBSOLETE 0.

### V/lifecycle replay — §8 전환

| anchor·시나리오 | 그때 / 새 규칙 | 결과 |
|---|---|---|
| 0294 r3 정정(`3d1916d4`) | 정정 절 · verify 횟수 3 유지 · FAIL · plan·INDEX 갱신 · 별도 검증 커밋 — 새 §8과 같음 | 일치 |
| 0292 r4(round 40) | 다른 주체의 `impl/IN_PROGRESS` 불개입 — 같음 | 일치 |
| 정정 결과 막는 발견 0 | `PASS 후보` → `impl/IMPL_DONE`·검증자 → 다음 verify가 하한 확인 | 거짓 PASS 0 · 다음 주체 있음 |
| RTP↔FAIL 정정 | 라운드 칸 불변(둘 다 +1) · 다음 주체만 바뀜 · 창 밖이면 동결 유지 | 반복 0 |
| 다른 진행 중 handoff · CLOSED · DIAGNOSE_ONLY | 다음 verify부터(사용자 요청 시 정정) · 정정 없음 · 정정안만 | 막힌 상태 0 |

- replay 중 2건을 고쳤다 — 정정 대상이 "판정이 바뀌는 모든 진행 중 handoff"와 "일괄 정정 금지"로 갈렸고(→ 발동 handoff, 그 밖은 사용자 요청 시), CLOSED가 빠져 있었다.

## 6-C Cross-document Consistency

- **PASS.** 전환: review §8 = AGENTS §4·책임 분리 bullet = verify §0(정정 절은 verify 횟수에 세지 않음). 도구: review §6-A = AGENTS §4·디렉토리 구조 = `failure-patterns.md`(corpus pool 금지). sweep 괄호: AGENTS ⑦·§단계별 절차 2 = verify ⑦ = impl §3 = plan.template. 네 SKILL frontmatter description이 본문 발동 조건과 맞다(review description = §언제 하는가 + §8).
- `node scripts/check-doc-inventory.mjs --check`(app/) generated·prose·links ok · `git diff --check` 0 · 네 SKILL frontmatter YAML 파싱 4/4 · `instruction_delta.py` py_compile ok.

## 전환

- **해당 없음.** 발동 handoff가 없고(사용자 요청), 바뀐 문장은 이후 턴의 의무를 복원·명확화할 뿐 기존 판정(0294 r3 정정 `FAIL`)과 다음 주체를 바꾸지 않는다.

## 남은 한계

- 문장 대조는 한 줄 단위 포함률이다 — 여러 줄로 나뉘거나 합쳐진 규칙은 `문장`으로 과검출되고, 거의 같은 줄의 단어 하나 삭제는 word-diff로만 보인다.
- §4 문장 원칙은 판단 기준이고 기계 검사는 없다.
- §8은 선례 1건(0294 r3)과 시나리오 재생으로 만들었다 — FAIL→RTP·`PASS 후보` 실제 사례는 아직 없다. subagent 기반 skill eval은 돌리지 않았다(요청 없음).

# review round 43 — 0294 (verify 6회째 FAIL): 입력 칸이 좁을 때의 판정 · 재앵커 · diff 자리로 찾는 규칙 칸 분기

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0294 verify 6회째 `FAIL`(r6, `df2acbb`) 뒤 r7 착수 전 의무 review. 사용자 `/handoff-review` 후 질의에서 **APPLY 전체** 선택(2026-11-06).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 입력 칸이 규칙 칸보다 좁을 때를 round 40(AGENTS §공통 V · impl §2 · P62)은 "구현자가 규칙 칸을 따라 입력을 더한다 — `PAIR_FAIL`"로, round 41 판정 표(AGENTS §판정 범위 · verify §11 · impl §7)는 "plan 내부 불일치(규칙 칸↔UT 입력 칸) → `PLAN_GAP`"으로 보냈다 | 0294 r6 D12~D14 — verify는 round 40 쪽(FAIL)으로 판정 | **A** — round 41 6-C가 놓친 문서 충돌. 판정 표를 "기대 모순"으로 좁히고 좁음 규칙을 표 아래 한 문장으로 |
| 2 | 코드를 재구성해 변이 원문 줄이 잔여 경로로 남자, 원문 변이와 재앵커 변이 중 무엇이 하한인지 규칙이 없었다 — 검증자가 M53은 "옮겨 감", 같은 처지의 K2는 "인용 변이 미검출"로 다르게 판정 | 0294 r5(occ 이동 12행) · r6(의미 재앵커 16행 · K2·M53·C122·S-KD05-literal 원문 green) | **A** — 새 causal class **P67**. AGENTS §고장 내 보기에 재앵커 규칙 |
| 3 | 규칙 칸 하위 분기의 입력 누락이 설계 READY self-review("정정 칸 5개 분기마다 입력이 있다")와 구현을 지나 verify에서야 나왔다 | 0294 r6 D9↑·D12~D14(sv39·sv17·sv28·sv14) · 0294 r3(13분기) · 0292 r2·r3 | **A** — 세 번째 재발. 지침(1:1)을 정상 수행해도 긴 칸 문장의 하위 분기(`·` 항목·괄호 목록·"마다")는 읽어서 뽑으면 빠진다. 칸을 구현한 diff 자리 제거 변이 → `못 잡음`이면 칸 문장 인용으로 찾는 절차를 impl §3·verify §4·AGENTS에 |
| 4 | r6 구현 잠금 표에 ΔV6 정정 칸 sweep 행 0 · 검산 줄 합계 T 없음 · 강제 지점 표 접힘 | 0294 r6 D16 | **B** — impl §3·§9와 plan ΔV6 문장이 이미 요구. 지침 변경 없음 |
| 5 | 덮개 회귀 C035 — 구현자가 자기 r5 spec 71행만 재실행 | 0294 r6 D15 | **A**(부분) — impl §3 "구 장치가 red로 만들던 변이"의 범위가 열려 있었다. 하한 ④와 같은 범위로 고정(P50 개정) |
| 6 | 리터럴 후보 500이 게이트 임계 1000 아래라 후보 판정 유무가 관측되지 않았다 | 0294 r6 D9↑ | **B** — P56(운반 값 구별)과 AGENTS §공통 V 그대로 |
| 7 | 세션에 `app/node_modules`가 없어 verify가 `npm ci --ignore-scripts`를 했다 | verify r6 r6-9 | **E** — 기록만 |

**verify 분류 대조(§2)**: D9↑·D12~D14는 칸 문장 인용(§7-G KD05·KM10) + 입력 칸 좁음이라 새 규칙에서도 이행 `BLOCKING`이다. D15는 원문 줄(`bindingElementSources` 중첩 분기)이 "(중첩 포함)"·"바깥 패턴의 원천 멤버"를 운반해 P67로도 이행이다. K2만 갈린다 — 원문 줄(`emptyDestructuring` 리터럴 `.some`)은 열거 밖 형태(계산 키·나머지 요소 값)만 운반하고 재앵커 M63이 red라 P67에서는 확장(E1)이다 → §8 판정 정정(FAIL 유지, D9 닫힘 조건만 바뀜). 거짓 PASS·FAIL inflation 방향 왜곡 0.

## Tier

**Tier 1.** 발견 분류(좁음 → `BLOCKING` 명시) · 하한 실행 방법(재앵커 · diff 자리 변이) · impl 덮개 회귀 범위가 바뀐다.

## 6-A Operational Instruction Delta

기준 `df2acbb`. `instruction_delta.py --base df2acbb --prose`(대상 5파일, pool plan SKILL) 후보 **1** — AGENTS 원 364줄 `잃음`은 도구 오탐이다: 새 줄 = 원 줄 + 삽입문(정확 포함 True), `TOKEN` 정규식이 인접한 두 백틱 구간 사이 본문을 토큰으로 잡아 삽입문에 반응했다. word-diff 지운 단어 4 — `칸,` 3(판정 표 "규칙 칸↔UT 입력 칸," → "…의 기대 모순,") · `분기`` 1(template 출처 열 → `분기(diff 자리)`` ) 전부 REPLACE.

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS §판정 범위 이행 행 · verify §11 · impl §7 PLAN_GAP 행 "규칙 칸↔UT 입력 칸" | REPLACE | "기대 모순"으로 좁힘 — 좁음은 새 bullet(AGENTS)과 impl §7 선조치 행이 이행 `BLOCKING`으로 받는다. 막는 범위 불변(`PLAN_GAP` → `BLOCKING`, 둘 다 막음) |
| AGENTS ⑦ 행 · 최소 계약 sweep·덮개 회귀 bullet | KEEP + 추가 | 원문 그대로 포함 + diff 자리·범위 문장 |
| AGENTS §고장 내 보기 bullet 2(diff 자리 · 재앵커) | 추가 | 새 절차 |
| impl §3 bullet 2 추가 · "일반 hunk" bullet | 추가 · REPLACE | 예외(규칙 칸을 구현한 diff 자리)만 명시 — 일반 hunk 금지 유지 |
| verify §4 ⑦ bullet · 고장을 읽을 때 bullet | 추가 | — |
| `plan.template.md` 잠금 절 · `verify.template.md` ④·⑦ 줄 | REPLACE(강화) · KEEP + 추가 | 출처 열 `재앵커 — 원 ID` · 덮개 회귀 분모 |
| 명령·gate·reference·script | 없음 | 이동·삭제 0 → inbound `N`/`M/M` 대상 없음 |

DELETE 0 · MOVE 0 · 설명 없이 사라진 gate·command·reference 0.

## 6-B Historical Failure Regression

- **67 P 전수**(P1~P67, heading 연속 — `rg -c '^## P[0-9]+'` 67) · 변경 후 **COVERED 67** / PARTIAL 0 / GAP 0 / OBSOLETE 0. round 42의 COVERED 66은 방어 문장 삭제 0이라 그대로다.
- 바뀐 P: **P50** 강화(재실행 범위 = 하한 ④ · 재앵커) · **P62** 강화(분기 찾기 절차 · 판정 표 정합 — P62 규칙 "`PLAN_GAP`이 아니라 `PAIR_FAIL`"이 round 41 표와 다시 일치) · **P67** 신규. 둘 다 끝에 개정 메모.
- **P60**(열린 분모): 유지 — diff 자리 변이의 `못 잡음`은 칸 문장을 인용할 때만 이행이고 인용이 없으면 `동치`·확장이라 일반 hunk가 분모가 되지 않는다(AGENTS bullet에 0262 명시). **P41**(도구가 정의한 전수): 유지 — diff 자리 목록은 구현자가 고르지만 검증자 ⑦이 같은 방법으로 다시 센다. **P45**(구현자 권한 밖 정정 소멸): 유지 — 좁음은 규범 행 정정 없이 테스트로 닫혀 권한 문제가 없다.
- P1~P40·P42~P44·P46~P49·P51~P59·P61·P63~P66: 방어 지점 불변(plan 설계·AC·좌표·운영 절차 — 이번 변경이 닿지 않음).

| historical anchor | 변경 전(문면) | 변경 후 | 판정 |
|---|---|---|---|
| 0292 r2·r3 W03·W04(분기 입력 부재) | round 40 `PAIR_FAIL` ↔ round 41 표 `PLAN_GAP` 갈림 | 이행 `BLOCKING` · impl diff 자리 변이가 사전 발견 | 거짓 PASS 0 |
| 0294 r3 D5(13분기) | 정정 판정 `FAIL`(round 41) | 같음 | 같음 |
| 0294 r5 D10(규칙 문장끼리 기대 갈림) | `PLAN_GAP` | `PLAN_GAP`(기대 모순) | 같음 |
| 0294 r6 D12~D14 | `FAIL`(verify r6) | 같음 | 같음 |
| 0294 r6 K2 원문 green | D9 닫힘 조건(BLOCKING) | 확장 E1 + 재앵커 M63 red — D9는 sv39로 BLOCKING 유지 | FAIL 유지, 의무 축소(§8) |
| 0294 r6 C035 | 이행 D15 | 이행(원문 줄이 열거 분기 운반) | 같음 |
| 0262 r4~r8(열린 분모) | 창 안 `PLAN_GAP`·창 밖 후보 표 | 같음 — diff 자리 변이도 인용 없으면 확장 | inflation 0 |
| 0209 r5→r6(덮개 회귀) | finding | finding + 구현자 재실행 범위 고정 | 강화 |

- **시나리오 replay**: 창 안(verify 1·2회째) diff 자리 `못 잡음`이 인용 없음 → 확장 `PLAN_GAP` · 창 밖 → 후보 표(inflation 0) / 구현자가 약한 자리에 재앵커 → 검증자가 재앵커 충실성을 읽고 남은 원문 줄도 돌림(거짓 PASS 0) / plan이 동작을 없앤 변이 → 근거와 함께 닫힘(다음 주체 없는 행 0) / 9회째 CLOSED · 후보 표 승격 · 발동 handoff 판정 정정 — 변경 없음.

## 6-C Cross-document Consistency

- "규칙 칸↔UT 입력 칸" `PLAN_GAP` 문구 3곳(AGENTS 93 · verify 207 · impl 143)이 모두 "기대 모순"이고, 좁음 처리 문장(AGENTS §공통 V 79 · §판정 범위 115 · 최소 계약 367 · impl §2 73 · §3 85 · §7 142 · plan §5-A 153 · P62)이 같은 방향(구현자 입력 추가)이다.
- 재앵커(AGENTS 149·369 · impl 96 · verify 132 · plan.template 426·429 · verify.template 106)와 diff 자리(AGENTS 142·148·367 · impl 85·94 · verify 127 · plan.template 421·426 · verify.template 108)가 owner(구현자·검증자)와 범위(⑦·④)를 같게 적는다. impl 덮개 회귀 범위는 "하한 ④와 같은 범위"로 verify §4 ④ 행을 그대로 가리킨다.
- 일반 hunk 금지 문장(AGENTS 366 등록 증거 분모 · verify 126 · impl 94 · verify.template 103)은 유지되고, 예외는 "규칙 칸을 구현한 diff 자리 + 칸 문장 인용"으로 한정된다.
- root `AGENTS.md`·SKILL frontmatter description·하위 `app/AGENTS.md`·CI 정본은 이번 변경이 닿지 않는다(문구 대조 — root의 "누락·모순된 `PLAN_GAP`"은 더 구체적인 handoff AGENTS가 좁힌다). 새 `AGENTS.md` 없음.

## 남은 한계

- `instruction_delta.py`의 `TOKEN`은 인접한 백틱 구간 사이 본문을 토큰으로 잡아 삽입문에 오탐한다 — 이번엔 정확 포함 검사로 판정했다.
- diff 자리 목록 자체는 구현자가 고른다. 검증자 ⑦이 같은 방법으로 다시 세는 것이 방어다.

# review round 44 — handoff-impl(사용자 요청, 0298·0299 증거): 마지막 gate 실행 집합 · 기준선 분리 조건 · 추가·수정 테스트의 subtree 규칙

**발동/모드**: 사용자 요청 — `/handoff-plan 298` 인자 "298에서 제시한 ci 규칙 등 준수사항을 handoff-impl이 준수하도록 규칙개정"(2026-11-08). "규칙개정"이 수정 적용을 명시하므로 **APPLY**. 0298 plan D-012가 이 경로를 기록한다(설계 커밋 `d75f6c8`과 분리).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 마지막 gate를 관련 스위트로만 돌려 트리 전체 소스 가드가 실행 집합에 없었다 | 0299 r1 vitest 376/927파일 → CI run 42448898011 `no-stray-auth-subscribe` red | **A** — AGENTS "관련 비-DB/순수 테스트: `vitest run <suite>`"와 impl §8 "pair 증거와 운영 gate에서 만든다"를 정상 수행한 결과다. 마지막 gate = `ci.yml` 단계 집합(impl §8 · AGENTS §단계별 절차 2·3 · §구현 게이트의 정본 · verify §8) |
| 2 | 수정한 테스트 파일의 unit 가드 실패를 "변경 전 동일"로 기준선에 넣었다 | 0299 r1 `[test-pools]` 11건(`r1-baseline-comparison.json`) | **A** — "환경 기인 실패 분리"·"관련 없는 기존 실패"가 무엇이 환경인지 정하지 않았다. 분리 두 조건(차집합 ∅ · 환경 원인)을 AGENTS §판정 범위와 운영 gate에 한 번 정의하고 impl·verify·두 template이 가리킨다 |
| 3 | subtree 테스트 작성 규칙을 사용자가 "298 준수"를 요구한 뒤에야 적용했다 | 0299 r1.2 전수 감사 25파일 · `probeRepo` mock | **A** — impl은 subtree `AGENTS.md`를 "레이어·gate·환경"으로만 읽었다. 추가·수정 테스트 파일마다 판정 + 구현 보고 행 |
| 4 | 사용자 요구 변경 턴(r1.2~r1.4)이 `[구현자 기입]`을 보고 표 하나로 접었다 | 0298 verify r1 F3 | **B** — template 머리 주석은 같은 라운드 추가 턴을 이미 가리켰다. impl §9·AGENTS 최소 계약의 "재구현 턴"만 좁아 문구를 맞춤(P39 개정 메모) |
| 5 | 0299 r1.2가 0298 산출물(`FORCED_IO`)을 바꿔 0298 열거 원문과 어긋났다 | 0299 verify D2 → 후보 표 → 0298 ΔV5 흡수 | 지침 변경 없음 — verify 비귀속 경로가 작동 |

**verify 분류 대조(§2)**: 0299 r1의 11건은 r1.2가 닫아 0299 verify r1(FAIL — D1 문서 렌더)의 판정에 남지 않는다. 0298 verify r1 F3(이행 `BLOCKING`)은 새 문구에서도 이행이다. 거짓 PASS·FAIL inflation 방향 왜곡 0.

## Tier

**Tier 1.** gate 실행 집합과 기준선 분리(실패 의미)가 바뀌고 template 필수 행이 늘어난다.

## 6-A Operational Instruction Delta

기준 `d75f6c8`. `instruction_delta.py --base d75f6c8 --prose --pool docs/handoff/AGENTS.md`(대상 5파일) 후보 **3**(모두 `문장`) · word-diff 지운 단어 구간 16(impl 5 · verify 3 · plan.template 3 · verify.template 3 · AGENTS 2).

| 항목 | 판정 | 근거 |
|---|---|---|
| impl §8 "환경 기인 실패(ABI·egress)는 변경 관련 실패와 분리해 실패 목록과 서명을 남긴다" | REPLACE(강화) | 분리 두 조건 + "분리한 실패는 목록과 서명을 남긴다" 유지. ABI·egress는 AGENTS 정의의 환경 원인에 포함 |
| verify §8 "환경 실패를 변경 무관으로 판정하려면 실패 목록과 알려진 ABI 서명을 분리해 남긴다" | REPLACE(강화) | 같은 정의를 가리키고 실패 목록·서명 기록 유지 + 실행 집합 bullet |
| `verify.template.md §8` "ABI 전환/egress 403 등 환경 기인 실패와 변경 관련 실패 분리 근거" | REPLACE | 실행 집합 줄 + 분리 근거 줄(ABI 전환·egress 403 표기 유지) |
| `plan.template.md` `관측한 게이트 산출` "환경 기인 실패 분리 근거" | REPLACE | 행 라벨 유지(P63 방어 인용) · 분리 근거를 두 조건으로 |
| "재구현 턴도 같은 이름의 필드"(impl §9 · AGENTS 최소 계약 · template 머리 주석) | REPLACE(넓힘) | 모든 impl 턴 — 재구현·사용자 요구 변경·`rN.k` |
| AGENTS "관련 비-DB/순수 테스트" · impl "먼저 읽을 것 4" · AGENTS §3 gate 줄 | KEEP + 추가 | 코드 수정 루프 한정 표기 · 테스트 작성 규칙 · 실행 집합 |

DELETE 0 · MOVE 0 · 설명 없이 사라진 gate·command·reference 0. `npm test` 의존 없음 — 마지막 gate의 로컬 대응은 `app/AGENTS.md` 게이트 가이드의 ABI-중립 명령(파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`)을 가리켜 ABI·egress 규칙과 충돌하지 않는다.

## 6-B Historical Failure Regression

- **68 P 전수**(`rg -c '^## P[0-9]+'` 68 — P1~P67 + P68 신규) · 변경 후 **COVERED 68** / PARTIAL 0 / GAP 0 / OBSOLETE 0.
- 방법: corpus `현재 방어` 30줄 중 이번 diff가 닿은 지침을 가리키는 줄 6(P39·P40·P47·P50·P63·P68)을 대조했다. 지운 문장(위 6-A REPLACE 5종)을 방어로 인용한 P는 0 — `rg "환경 기인|ABI 서명|환경 실패|관련 비-DB"` corpus 1건은 P68 자신의 인용이다.
- 바뀐 P: **P39** 강화(필드 재기입 범위 = 모든 impl 턴, 개정 메모) · **P68** 신규. **P63** 유지 — `관측한 게이트 산출` 라벨과 "마지막 수정 뒤" 문장이 남고 실행 집합만 넓어졌다. **P7**(설계가 저장소 규칙을 읽음)은 plan 쪽 방어 그대로, impl 쪽 대응이 P68로 생겼다.
- 그 밖의 P: 방어 지점 불변(설계·AC·좌표·하한·운영 절차 — 이번 diff가 닿지 않음).

| historical anchor | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 0299 r1 부분 실행 → CI red | IMPL_DONE 뒤 외부 피드백(red gate) → r1.2 | 마지막 gate가 트리 전체 가드를 실행 → IMPL_DONE 전 발견 | 거짓 PASS 0 · 라운드 절약 |
| 0299 r1 `[test-pools]` 11건(수정 파일) | 기준선 분리 | 현재 변경의 gate 실패 — r1에서 고침 | 거짓 PASS 0 |
| 0298 verify r1 Linux 실패 29파일(Windows 경로·Electron 미설치) | 기준선 | 기준선(차집합 ∅ + 다른 OS 경로·미설치 바이너리) | inflation 0 |
| 0298 verify r1 F3 | 이행 `BLOCKING` | 같음 | 같음 |
| 0293·0291 등 Linux 전용 실패 9파일 | 기준선 | 기준선(같은 근거) | inflation 0 |

- **시나리오 replay**: 손대지 않은 파일의 규칙 가드 실패 → 비귀속(`NON_BLOCKING`) — inflation 0 / electron 미설치로 수정 파일이 import에서 실패 → 환경 원인 + 차집합 ∅이면 분리, 가드 판정은 "돌리지 못한 단계"로 CI 증거에 넘김 — 다음 주체 없는 상태 0 / 창 안·밖 확장 후보·9회 CLOSED·후보 표 승격 — 변경 없음.

## 6-C Cross-document Consistency

- 기준선 분리 정의는 `docs/handoff/AGENTS.md §판정 범위와 운영 gate` 한 곳이고, impl §8 · verify §8 · AGENTS §단계별 절차 2(최소 계약)·3 · `plan.template.md` 구현 보고 · `verify.template.md §8`이 같은 두 조건을 가리킨다.
- 마지막 gate 실행 집합(`ci.yml` 단계 전부의 로컬 대응)은 impl §8 · AGENTS 최소 계약·§구현 게이트의 정본·§3 · verify §8 · 두 template이 같은 owner(구현자가 닫고 검증자가 다시 센다)로 적는다. 명령 목록은 `app/AGENTS.md`(CI 표 · 게이트 가이드)만 갖는다 — 사본 없음.
- `app/AGENTS.md` 충돌 0: 게이트 가이드의 "`vitest run` … 순수 스위트로 판정, DB 로드 실패는 베이스라인 분리"는 새 정의의 환경 원인과 같은 방향이다. test-pools 항목의 "신호 없이 프로세스를 띄우는 파일은 `FORCED_IO`에 올린다"는 impl의 "subtree가 정한 우선순위"가 그대로 따른다 — mock 우선 문장은 0298 r2(D-013)가 더한다.
- root `AGENTS.md`·SKILL frontmatter description·`ci.yml`은 닿지 않는다(impl description "현재 변경의 운영 gate를 수행"과 본문 일치). 새 `AGENTS.md` 없음. 판정 의미가 바뀌었으나 §8 정정 대상 없음 — 0299(FAIL·다음 Codex)·0298(RETURN_TO_PLAN → ΔV5 READY)의 마지막 판정·다음 주체가 새 규칙에서 같다.

## 남은 한계

- 사용자가 "298 준수"를 요구했을 때의 판단(mock vs `FORCED_IO`)은 `app/AGENTS.md` 문장이 생길 때(0298 r2) 비로소 subtree 우선순위가 된다.
- 마지막 gate는 egress·electron 미설치 환경에서 일부 단계가 import 단계에서 실패해 규칙 가드 판정을 못 할 수 있다 — "돌리지 못한 단계"로 적고 CI가 최종 판정이다.

# review round 45 — 0324 (verify 3회째 RETURN_TO_PLAN): 여러 항을 적은 §10 자리 문장의 diff 자리 변이 · 값이 생기는 시점 변경의 기존 소비처

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0324 verify 3회째 `RETURN_TO_PLAN`(`4398a44`) 뒤 다음 재구현 전 의무 review. 사용자 `/handoff-review` 후 질의에서 "verify 3 마친 뒤 APPLY" 선택(2026-11-17).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | §10 EP-29 ③ 자리 문장의 "창 끌기 영역" 을 좌표가 표지 속성으로만 단언 — 끌기 스타일 제거가 green(V3-F1, 이행) | 0324 r3 Y9 · P62 · P59 | **A** — ⑦ 의 diff 자리 변이가 규칙 칸에 묶여, 자리 문장에만 있는 항은 자리당 변이 1개 sweep 에서 빠졌다. diff 자리 범위를 "여러 항을 적은 §10 자리 문장의 항"까지 넓힘(P62 개정) |
| 2 | `window.oo` 가 생기는 시점이 preload → `main.tsx` 로 늦어졌는데 순서에 기대는 소비처(오류 보고 연결)가 열거되지 않음 — 순서 뒤집기 green(V3-F2, 창 안 확장) | 0324 r3 Y5 · P20 | **A** — plan 규칙의 발동 조건이 "값을 새로 늘리면" 뿐이라 시점 변경에 발동하지 않았다. "시점·순서를 바꾸면"을 더함(P20 개정) |
| 3 | 옛 포트 닫기가 `ClientPort` 추상까지만 잠기고 실제 `MessagePort` 로 잇는 `wrapPort.close` 가 좌표 밖(V3-F3) | 0324 r3 Y2 · P57 | **B** — AGENTS §공통 V "production 조립이 주입하는 의존성을 테스트가 빼거나 바꾼 분기는 덮지 않는다"(0262 r4)가 이미 요구. 지침 변경 없음 |
| 4 | "포트 1개" · "노출 1회" 조건의 2개 입력 부재(V3-F4·F5) | 0324 r3 Y10~Y12 | 지침 변경 없음 — 트리에 없는 형태의 가정 입력이고, 사용자 결정 ΔV 의 창 안 확장으로 설계자가 채택/경계를 정하는 정상 경로다 |

**verify 분류 대조(§2)**: V3-F1 은 §10 자리 목록 원문 인용("창 끌기 영역")이라 이행 `BLOCKING` 이 맞다 — 새 규칙에서도 같다(구현 sweep 이 먼저 찾는다는 차이뿐). V3-F2~F5 는 인용·재현 없음 → 확장이고, §7-M(사용자 결정 ΔV) NEW·CHANGED 노드라 창 안 `PLAN_GAP` 이 맞다. 거짓 PASS · FAIL inflation 방향 왜곡 0.

## Tier

**Tier 1.** 하한 ⑦ 의 실행 범위(구현자·검증자)와 plan 설계 규칙의 발동 조건이 바뀐다.

## 6-A Operational Instruction Delta

기준 `4398a44`. `instruction_delta.py --base HEAD --prose`(대상 6파일 — AGENTS · impl · verify · plan SKILL · 두 template, pool plan SKILL) 후보 **0**. `--word-diff` 로 지운 단어 10개를 따로 봤다 — 모두 더 넓은 형태로 대체(`레지스트리·스토어` → `전역·레지스트리·스토어` · `늘리면` → `늘리거나 … 시점·순서를 바꾸면` · `분기는 그 칸을 구현한` → `분기와 여러 항을 적은 §10 자리 문장의 항은 그것을 구현한`).

| 항목 | 판정 | 근거 |
|---|---|---|
| AGENTS ⑦ 행 · §고장 내 보기 diff 자리 bullet · 최소 계약 sweep bullet | REPLACE(강화) | 규칙 칸 분기 + 자리 문장의 항. 인용 요구·일반 hunk 금지 문장 그대로 |
| impl §3 diff 자리 bullet · verify §4 ⑦ bullet | KEEP + 추가 | 원문 포함 + 한 문장 |
| `plan.template.md` 열거 sweep 인용문 · `verify.template.md` ⑦ 줄 | REPLACE(강화) | 같은 범위 확장 |
| plan SKILL 기존 소비처 bullet · verify §2 소비처 bullet · `plan.template.md` 체크리스트 | REPLACE(강화) | 발동 조건에 시점·순서 변경 추가 |
| 명령·gate·reference·script | 없음 | 이동·삭제 0 → inbound `N`/`M/M` 대상 없음 |

DELETE 0 · MOVE 0 · 설명 없이 사라진 gate·command·reference 0.

## 6-B Historical Failure Regression

- **68 P 전수**(`rg -c '^## P[0-9]+'` 68) · 변경 후 **COVERED 68** / PARTIAL 0 / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0(6-A)이라 round 44 의 COVERED 68 이 그대로다.
- 바뀐 P: **P20** 강화(발동 조건 — 시점·순서 변경) · **P62** 강화(diff 자리 범위 — §10 자리 문장의 항). 둘 다 끝에 개정 메모. 새 causal class 아님 → 새 P 없음.
- **P60**(열린 분모): 유지 — 넓힌 범위의 `못 잡음` 도 §10 자리 문장 인용을 요구하고 자리 목록은 plan 이 고정한 열거 원문이라 일반 hunk 가 분모가 되지 않는다. **P59**(호출 변이는 바꾼 항만): 유지 — 이번 확장은 그 규칙을 sweep 단계에서 항 단위로 수행하게 한다. **P41 · P66 · P67**: 유지.
- P1~P19 · P21~P58 · P61 · P63~P65 · P68: 방어 지점 불변(이번 변경이 닿지 않음).

| historical anchor | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 0324 r3 V3-F1(자리 문장 항 라벨 단언) | 검증자 ⑥ 이 발견 → 이행 `BLOCKING` | 구현자 ⑦ diff 자리 변이가 IMPL_DONE 전 발견 · 놓치면 같은 이행 | 거짓 PASS 0 |
| 0324 r3 V3-F2(설치 시점 변경) | 창 안 확장 `PLAN_GAP` | plan 조사가 소비처를 열거 → 열거 원문. 열거 안 했으면 같은 확장 | 같음 |
| 0161(P20 원 사례 — 부팅 등록) | 규칙 발동 | 같음 | 같음 |
| 0294 r6 D12~D14(규칙 칸 하위 분기) | 이행 `BLOCKING` | 같음 | 같음 |
| 0262 r4~r8(열린 분모) | 창 안 `PLAN_GAP` · 창 밖 후보 표 | 같음 — 자리 문장 인용이 없으면 확장 | inflation 0 |
| 0292 r2·r3(분기 입력 부재) | 이행 `BLOCKING` | 같음 | 같음 |

- **시나리오 replay**: 창 밖 verify 가 자리 문장 항의 `못 잡음` 을 찾음 → §10 자리 목록 인용이라 이행 `BLOCKING`(변경 전과 같은 분류 — 판정 의미 불변) / 자리 문장이 한 항만 적음 → 기존과 같다 / 구현자가 항 단위 변이를 돌려 `못 잡음` → 테스트를 더하거나 `동치` · 인용 불가면 확장 보고(다음 주체 있음) / 9회째 CLOSED · 후보 표 승격 경로 불변. 다음 주체 없는 상태 0 · 같은 축 무한 반복 0.

## 6-C Cross-document Consistency

- diff 자리 범위 문장(AGENTS 144·150·369 · impl 85 · verify 127 · `plan.template.md` 421 · `verify.template.md` 108)이 owner(구현자 sweep · 검증자 ⑦)와 범위("규칙 칸 분기와 여러 항을 적은 §10 자리 문장의 항")를 같게 적는다. 인용 요구와 일반 hunk 금지(AGENTS 150 · impl 94 · verify 126)는 그대로다.
- 기존 소비처 발동 조건(plan SKILL 181 · verify §2 86 · `plan.template.md` 체크리스트)이 같은 범위("값이 생기는 시점·순서 변경")다. impl SKILL 에는 해당 규칙이 없고 원래도 없었다(설계 책임).
- root `AGENTS.md` · SKILL frontmatter description · `app/AGENTS.md` · CI 정본은 이번 변경이 닿지 않는다. 새 `AGENTS.md` 없음 · 위생(비밀·변동성 정보) 0.

## 전환 (§8)

판정 의미(발견 분류 · disposition · 확장 창 · 하한이 막는 범위)는 바뀌지 않았다 — 넓힌 것은 하한 ⑦ 의 실행 대상이고, 자리 문장 인용 `못 잡음` 은 변경 전에도 이행이었다. 0324 verify 3 판정(RETURN_TO_PLAN — V3-F1 BLOCKING · V3-F2~F5 PLAN_GAP)은 새 규칙에서도 같아 정정 대상 없음.

## 남은 한계

- 자리 문장의 "항" 경계(괄호 목록 · `·` 항목)는 구현자가 읽어 나눈다 — 검증자 ⑦ 이 같은 방법으로 다시 세는 것이 방어다.
- 실창(Electron) 검증은 이 환경에서 불가(E) — AC22·AC23·AC52 실창은 사람 실기.

# review round 46 — 0326 (verify 3회째 RETURN_TO_PLAN): 수치 계약은 그 수치가 걸린 런타임에서 잰다

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0326 verify 3회째 `RETURN_TO_PLAN`(`f06d15ba`) 뒤 다음 재구현 전 의무 review. 사용자 `/handoff-review` 후 질의에서 "APPLY (Recommended)" 선택(2026-11-20).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | r1 D1 — 앵커 캡처 미배선 | 0326 r1 X01 | **F** — 구현 결함, verify 가 잡음. 지침 변경 없음 |
| 2 | r1 D2 · r2 D7~D15 — 좌표 부재, 이어서 좌표가 production 경로 밖·상수·로컬 재구현 | 0326 r1·r2 · P54~P57 | **B** — impl §3 "실행 구간" · §5 "production 경로에 실제로 진입" · verify §2 가 이미 요구했고 verify 가 잡았다. 지침 변경 없음 |
| 3 | r3 D16 — 복사 상한을 가짜 DOM 측정기(J9)로 정하고 실제 Chromium 보정을 기계 PASS 뒤 사람 S5 로 미뤄, 상한 2,000 의 task 가 J9 4.43ms · Chromium 579~698ms | 0326 r3 §2 · P22 · P37 | **A** — plan §5 "사람 실기는 시각·실제 외부환경에만"은 로직만 다루고, 에이전트가 띄울 수 있는 런타임의 수치 계약은 다루지 않았다. verify §7 "상한 재측정"도 같은 대리 측정기를 다시 돌리면 정상 수행으로 놓친다(r1·r2 가 그랬다). plan §5 에 수치 계약 bullet, verify §7 에 목표 런타임 재측정 문장을 더함(P22 개정) |

**verify 분류 대조(§2)**: D16 은 ACTIVE D-094(task ≤ 50ms)를 실제 입력·실제 트리로 재현한 현재 결함이고, D-088 이 판정 측정기를 J9 로 고정해 계약 정정이 필요하므로 `PLAN_GAP` 이 맞다. D17(보드·trailer 운영) 비귀속 `NON_BLOCKING` 도 맞다. 거짓 PASS · FAIL inflation 방향 왜곡 0.

## Tier

**Tier 1.** plan 의 AC·사람 실기 정책과 verify §7 의 재측정 범위가 바뀐다.

## 6-A Operational Instruction Delta

기준 `f06d15ba`. `instruction_delta.py --base f06d15ba --prose`(대상 3파일 — plan SKILL · `plan.template.md` · verify SKILL, pool `docs/handoff/AGENTS.md`) 후보 **0**. `--word-diff` 로 지운 단어 3개(`없다.`×2 · `이유`)는 모두 같은 문장을 늘린 것이다.

| 항목 | 판정 | 근거 |
|---|---|---|
| plan SKILL §5 사람 실기 bullet | KEEP + 추가 | 원문 그대로 + 수치 계약 bullet |
| plan SKILL · `plan.template.md` 체크리스트 "사람 실기로 미룬 순수 로직이 없다" | REPLACE(강화) | 원문 + 수치 계약 절 — 본문 bullet 에 매핑 |
| `plan.template.md` §7 사람 실기 항목 이유 | REPLACE(강화) | 수치 항목의 이유 칸 추가 |
| verify SKILL §7 | KEEP + 추가 | 원문 그대로 + 한 문단 |
| 명령·gate·reference·script | 없음 | 이동·삭제 0 → inbound `N`/`M/M` 대상 없음 |

DELETE 0 · MOVE 0 · 설명 없이 사라진 gate·command·reference 0.

## 6-B Historical Failure Regression

- **68 P 전수**(`rg -c '^## P[0-9]+'` 68) · 변경 후 **COVERED 68** / PARTIAL 0 / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0(6-A)이라 round 45 의 COVERED 68 이 그대로다.
- 바뀐 P: **P22** 강화(사람 실기 하치장 → 수치 계약까지). 끝에 개정 메모. 새 causal class 아님 → 새 P 없음.
- **P2**(측정 불가 AC) · **P18**(실기 불가 선언 전 핸들 탐색 — 검증자) · **P37**(structural proxy): 유지 — 새 bullet 은 P37 의 "proxy 가 목표를 대신하지 못한다"를 측정 환경에 적용하고, P18 의 검증자 방어를 §7 수치 재측정에도 건다.
- P1 · P3~P17 · P19~P21 · P23~P36 · P38~P68: 방어 지점 불변(이번 변경이 닿지 않음).

| historical anchor | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 0326 r3 D16(J9 ↔ Chromium) | 검증자 ⑥ 실측이 발견 → 현재 결함 + `PLAN_GAP` | plan READY 전 목표 런타임 실측 bullet 이 발동 · 놓치면 verify §7 이 1회째에 같은 분류로 잡음 | 거짓 PASS 0 · 발견 시점 3회째 → 설계/1회째 |
| 0162(P22 원 사례 — 로직을 사람 실기로) | 규칙 발동 | 같음 | 같음 |
| 0324 AC22·AC23·AC52(실창 Electron) | 사람 실기 — 환경 제약(E) | 같음 — 에이전트가 띄울 수 없는 런타임은 새 bullet 의 발동 밖 | inflation 0 |
| 0325 W 기준선(Windows 절대값) | 사람 실기 | 같음 — 기준 장비 절대값은 사람 몫으로 남음 | inflation 0 |

- **시나리오 replay**: 대리 측정기 상한이 목표 런타임에서 통과 → 비만 기록, 판정 불변 / 목표 런타임에서 계약 위반 → verify 현재 결함(창 무관 `BLOCKING`, 계약 정정 필요 시 `PLAN_GAP`) — 다음 주체 있음 / 목표 런타임을 띄울 수 없는 환경 → 사람 실기 이유 칸에 적고 기존 E 경로 / 9회째 CLOSED · 후보 표 승격 경로 불변. 다음 주체 없는 상태 0 · 같은 축 무한 반복 0.

## 6-C Cross-document Consistency

- plan SKILL §5 bullet · 체크리스트 · `plan.template.md` §7 이유 칸·체크리스트 · verify SKILL §7 문단이 같은 범위("에이전트가 띄울 수 있는 목표 런타임에서 잴 수 있는 수치 계약")와 같은 경계("사람 실기 = 기준 장비 절대값")를 쓴다. verify §5(핸들 탐색) · §11 현재 결함 정의와 충돌 없음.
- impl SKILL 에는 해당 규칙이 없고 원래도 없었다(설계·검증 책임). `docs/handoff/AGENTS.md` · root `AGENTS.md` · SKILL frontmatter description · `app/AGENTS.md`(Playwright·Chromium 사용은 `app/AGENTS.md` 의존성 정책과 무관 — 증거 스크립트) · CI 정본은 이번 변경이 닿지 않는다. 새 `AGENTS.md` 없음 · 위생 0.

## 전환 (§8)

판정 의미(발견 분류 · disposition · 확장 창 · 하한이 막는 범위)는 바뀌지 않았다 — 목표 런타임 계약 위반은 변경 전에도 현재 결함이었다. 0326 verify 3 판정(RETURN_TO_PLAN — D16 PLAN_GAP)은 새 규칙에서도 같아 정정 대상 없음.

## 남은 한계

- "에이전트가 띄울 수 있는가"는 환경마다 다르다(Chromium 은 이 컨테이너에 있으나 Electron 실창은 없다) — plan 이 이유 칸에 적고 verify 가 다시 시도하는 것이 방어다.
- 목표 런타임 실측도 CPU 경합에 흔들린다(0326 구현자 100블록 150~400ms ↔ 검증자 경합 없이 27~31ms) — 측정 조건을 같이 적는 것까지만 지침이 요구한다.

# review round 47 — 0326 (verify 6회째 FAIL) + 사용자 요구: 넓은 변이의 red는 그 안의 항을 잠그지 않는다 · `잡음`은 그 좌표의 실패여야 한다 · 구현 에이전트에 Gemini 추가

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0326 verify 6회째 `FAIL`(`5baf3f1`) 뒤 r7 착수 전 의무 review. 사용자 `/handoff-review` 후 질의에서 **APPLY** 선택(2026-11-22). 진행 중 사용자 추가 요구 "handoff-impl 을 수행하는 에이전트가 gemini/안티그래비티일 수 있다" — 후속 질의에서 trailer 값 `gemini` 하나 · 도구별 stub 없이 지침만 선택.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | §10 자리 `gestureRef.current = 'idle'`(rev 3 `:261`)과 S5 자리(rev 5 `:261-264` — "제스처 `idle` · 억제 해제")를 r5 구현·verify 5회째·r6 구현이 모두 블록 통째 제거 V20(`:258-263`)의 red로 닫았다. 그 줄만 지운 Y6는 IT 24/24 green(D28) | 0326 r5·r6 · P59 · P62 | **A** — P59 규칙 "변이의 red는 그 변이가 바꾼 항만 잠근다"를 글자대로 읽으면 두 항을 함께 지운 V20이 두 항을 잠근다. 정상 수행으로도 실패한다. "바꾼 항이 하나일 때만"으로 일반화하고 ⑦ 기본 변이를 "그 항목만 지우는 변이 — 넓은 등록 변이로 갈음하지 않음"으로 고정(P59 개정) |
| 2 | r6 구현 sweep에 S5 항별 변이 0 — impl §3 diff 자리 규칙이 "이번 diff가 그 칸을 구현하며 만든" 자리라, r4.1에 쓴 S5 코드는 r6 diff 밖이었다 | 0326 r6 · P62(round 45) | **A** — 앞 턴 코드에 새로 열거한 항목이면 정상 수행으로도 빠진다. diff 자리 = 그 칸·항을 구현한 코드(이번 Delta V가 새로 열거하거나 바꿨으면 앞 턴 코드 포함). verify ⑦ "이후" 범위에도 그 항목을 명시(P62 개정) |
| 3 | r5가 V2를 AT B1·C1·C2·C3 묶음으로 돌려 red로 보고 — C3 red는 B1이 남긴 `endsMounted: false` 오염, 단독은 green(verify 5회째 D18 재개) | 0326 r5 | **A** — red의 실패 이유를 읽으라는 지침이 없었다(구현자는 오염을 적고도 판정 영향 없음으로 분류). 새 causal class **P69** — `잡음`은 좌표가 그 변이 때문에 실패했을 때만, 상태를 공유하는 좌표는 하나씩 |
| 4 | ΔV3가 판정 조건 `cancelMs ≥ 1`을 빼 V2의 유일한 AT 신호가 사라졌고, r4.2는 판정기 자기 변이(V10~V13·V17·V18)만 다시 돌렸다(verify 4회째 D18) | 0326 r4.2 · P50 | **B** — impl §3 "장치를 교체·삭제했다면 구 장치가 red로 만들던 변이를 새 장치도 red로" · "자기 spec만이 아니라"가 이미 요구. verify 4회째가 잡음. 지침 변경 없음 |
| 5 | s10 좌표가 OpenCode 행이 아니라 일반 블록(D19) | 0326 r4 · P55·P57 | **B** — AGENTS §공통 V 실행 구간·production 조립 규칙. 지침 변경 없음 |
| 6 | ΔV3 자리 술어 `launchFailure`가 해법 이름이라 `:173`을 뺐다(D27) | 0326 ΔV3 설계 · P58 | **B** — plan §5-A "검색 술어는 불변식의 주어로(해법 이름 금지)". verify 5회째가 잡음. 지침 변경 없음 |
| 7 | D20~D22 · D25 · D26 — 창 안 확장 후보 채택 | 0326 verify 4·5회째 | 실패 아님 — 정상 경로. ΔV2·ΔV3 사용자 결정 변경은 **D** |
| 8 | `src/main` Windows 경로 픽스처 9파일 22건(r1~r6) | 환경 | **E** — 기록만 |
| 9 | 구현 에이전트가 Gemini(Gemini CLI·Antigravity)일 수 있다 — `Agent`·`Next-Action` 허용값 `codex|claude`, 역할 표·보드 범례·impl 진입 문장이 Codex 고정 | 사용자 요구 | 지침 변경 — trailer 값 `gemini` 추가(사용자 결정) · 역할·보드·상태 표를 "구현 에이전트(Codex·Gemini)"로 · skill 로더가 없는 도구는 `SKILL.md`를 파일로 직접 읽는다 · `python3`가 없는 환경의 하네스 실행 |

**verify 분류 대조(§2)**: D28은 S5 자리 문장 "제스처 `idle`" 인용 + 입력 칸(s9-screens "속성 null")이 자리 문장보다 좁아 이행 `BLOCKING`이 맞다 — 새 규칙에서도 같다(구현 sweep이 먼저 찾는다는 차이뿐). verify 4·5회째 D18 이행 · D27 plan 내부(`PLAN_GAP`) · D20~D22·D25·D26 창 안 확장(`PLAN_GAP`) 모두 맞다. 거짓 PASS · FAIL inflation 방향 왜곡 0.

## Tier

**Tier 1.** 하한 ⑦의 실행 방법(기본 변이 범위 · diff 자리 범위 · verify 이후 범위) · `잡음` 판정 기준 · 구현 owner와 trailer 허용값이 바뀐다.

## 6-A Operational Instruction Delta

기준 `5baf3f1`. `instruction_delta.py --base HEAD --prose`(대상 8파일 — handoff AGENTS · root AGENTS · git-template · impl · verify · plan SKILL · 두 template) 후보 **1**, INDEX 포함 실행 후보 **2**.

| 후보 | 판정 | 근거 |
|---|---|---|
| `docs/git-template.md:84` `잃음` `Next-Action: codex|claude|none` | REPLACE(확장) | `codex|gemini|claude|none` + "다음 구현자가 정해져 있으면 그 에이전트" |
| `docs/handoff/INDEX.md:25` `이동?` `handoff-review` | REPLACE(상태) | 0326 행 다음 주체 `handoff-review` → `구현 r7` — review 완료에 따른 보드 갱신 |

word-diff 지운 단어 전수(10파일): `Codex` 계열 16 → "구현 에이전트(Codex·Gemini)" REPLACE · `항만`·`인자`·`운반`·`변이로`·`자리가 운반하는 인자 항을 닫았다고 세지 않는다(0262` → 일반화 문장 REPLACE(0262 사례 유지) · `1개(제거 — 계약이`·`더함)와`·`1개(제거)를` → "그 항목만 지우는 기본 변이 1개" REPLACE · `이번 diff가`·`구현하며 만든` → "그 칸을 구현한" + 범위 문장 REPLACE · `**skill을`(읽을 수 없는 환경) → "파일조차 읽을 수 없는 환경" REPLACE(강화 — 로더 없는 도구도 `SKILL.md`를 읽는다) · `두`·`에이전트의`·`두 에이전트는` → "에이전트들" REPLACE · `같다.`·`본다.`·`…`·`범위`·`자리마다`·`항)마다` → 같은 문장 연장.

DELETE 0 · MOVE 0 · 설명 없이 사라진 gate·command·reference 0. reference·script 이동 0 → inbound `N`/`M/M` 대상 없음. 바뀐 heading 4개(root `## 협업 워크플로우` · handoff AGENTS H1 · INDEX H1 · git-template `### 구현 커밋`)의 inbound anchor `rg` 0건(`docs/archive`·`chats`·`project` 제외 범위).

## 6-B Historical Failure Regression

- **69 P 전수**(`rg -c '^## P[0-9]+'` 69 — P69 신규) · 변경 후 **COVERED 69** / PARTIAL 0 / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0(6-A)이라 round 46의 COVERED 68이 그대로다.
- 바뀐 P: **P59** 강화(블록·여러 항 변이로 일반화 · ⑦ 기본 변이 범위) · **P62** 강화(diff 자리 = 앞 턴 코드 포함) · **P69** 신규. P59·P62 끝에 개정 메모.
- **P48**(잔여물 red): 유지 — P69 규칙이 AGENTS §고장 내 보기에서 "잔여물 진단"을 전제 실패의 한 형태로 함께 적는다. **P50**(덮개 회귀): 유지 — ④ 재실행의 red도 P69 기준으로 읽힌다. **P60**(열린 분모): 유지 — 항별 기본 변이와 앞 턴 코드 diff 자리는 열거 원문(자리 문장·운반 항·규칙 칸 분기 — "계약이 적은 것만")에만 걸리고, 인용이 없으면 확장이라 일반 hunk가 분모가 되지 않는다. **P41 · P66 · P67**: 유지.
- **P46**(보드 칸 두 주체) · **P47**(로컬 해시 좌표) · **P51 · P65**(독립 축 — 구현 주체 무관): 유지 — Gemini 구현자도 같은 칸·좌표·⑥ 규칙을 따른다. 범례 `Codex`·`Gemini`는 범례이고 다음 주체 칸은 여전히 하나다.
- P1~P40 · P42~P45 · P49 · P52~P58 · P61 · P63 · P64 · P68: 방어 지점 불변(이번 변경이 닿지 않음).

| historical anchor | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 0326 r5·verify 5(V20 → §10 `:261`) | V20 red로 닫힘 — Y6 미시도 | ⑦ 기본 변이가 `:261`만 지움 → r5 sweep이 Y6 `못 잡음` → 입력 추가(구현 턴 안) | 거짓 PASS 0 · 발견 시점 verify 6 → r5 |
| 0326 r6 D28(S5 두 항) | verify 6회째 ⑥이 발견 → 이행 `BLOCKING` | r6 sweep이 앞 턴 코드 diff 자리에 항별 변이 → 놓치면 같은 이행 | 같음(분류 불변) |
| 0326 r5 D18(C3 묶음 오염) | 구현자 red 보고 → verify 5 단독 green → `PAIR_FAIL` | 구현자가 실패 이유를 읽고 단독 재실행 → IMPL_DONE 전 발견 | 거짓 PASS 0 · 라운드 1 절감 가능 |
| 0262 r6(호출 변이 → 인자 항) | 인자 항 미잠금 | 같음(일반화 문장이 포함) | 같음 |
| 0324 r3 EP-29 ③(자리 문장 항) | 이행 `BLOCKING` | 같음 | 같음 |
| 0262 r4~r8(열린 분모) | 창 안 `PLAN_GAP` · 창 밖 후보 표 | 같음 — 블록 안 비열거 문장은 항이 아님 | inflation 0 |
| 0198 r7→r8(잔여물 red) | 수렴까지 밀기 | 같음 + 전제 실패 일반 규칙 | 같음 |

- **시나리오 replay**: 창 경계(verify 2 → 3) — 항별 `못 잡음`이 자리 문장·규칙 칸 인용이면 창과 무관하게 이행, 인용 없으면 창 안 `PLAN_GAP` · 창 밖 후보 표(inflation 0) / 창 안 사용자 요구 변경 ΔV — 새로 열거한 항목은 앞 턴 코드라도 구현자 sweep·verify ⑦ "이후" 범위에 든다(다음 주체 있음) / 묶음 실행 red의 이유가 전제 실패 → 단독 재실행 결과로 판정, 단독도 red면 `잡음`(거짓 PASS 0 · inflation 0) / Gemini 구현자 → `Agent: gemini` 커밋 · 검증 커밋 `Next-Action: gemini` · INDEX 다음 주체 `Gemini` — 다음 주체 없는 상태 0 / skill 로더 없는 도구 → `SKILL.md` 직접 읽기, 파일도 못 읽으면 AGENTS 최소 계약(이번 규칙 4개 모두 포함) / 9회째 CLOSED · 후보 표 승격 · §8 정정 경로 불변. 같은 축 무한 반복 0.

## 6-C Cross-document Consistency

- 일반화 문장(블록·여러 항 변이): AGENTS §공통 V · impl §2 · verify §6 · plan §5-A · `plan.template.md` 강제 지점 인용문 · `verify.template.md §5`가 같은 범위다. "항"의 정의(운반 항 · 자리 문장의 항 · 규칙 칸 분기 — 계약이 적은 것만)는 AGENTS 한 곳에 두고 나머지는 §공통 V를 가리킨다.
- ⑦ 기본 변이 "그 항목만 지움 · 넓은 등록 변이로 갈음 없음": AGENTS ⑦ 행 · §단계별 절차 2 · impl §3 · verify ⑦ 행·bullet · 두 template — 같다. verify "이후" 범위(diff가 닿은 항목 · 이번 Delta V가 새로 열거하거나 바꾼 항목 · 직전 실패): AGENTS ⑦ 행 · §단계별 절차 3 · verify ⑦ 행 · `verify.template.md` — 같다. 구현자는 전수 그대로.
- diff 자리 앞 턴 코드: AGENTS §고장 내 보기 · §단계별 절차 2 · impl §3 · verify ⑦ bullet · `plan.template.md` — 같다. `잡음` 실패 이유: AGENTS §고장 내 보기 · §단계별 절차 2 · impl §3 · verify §4 · 두 template — 같다.
- 구현 에이전트·trailer: root AGENTS 표(`Agent`·`Next-Action`에 `gemini`) · 구현 커밋 줄 · `docs/git-template.md` 표·형식·작성 규칙 · handoff AGENTS 역할 표·상태 표·충돌 최소화 · INDEX 범례 · impl 진입·마무리 — 같은 값. verify·review SKILL은 trailer 값을 root·git-template에 위임한다(`rg` 확인).
- skill 읽기: handoff AGENTS 머리말("로더 없는 도구는 `SKILL.md`를 파일로 · 파일도 못 읽으면 최소 계약") ↔ root AGENTS "skill 을 읽지 못하는 환경을 위한 구현 턴 최소 계약" ↔ impl 진입 문장 — 충돌 없음. impl frontmatter description을 본문과 맞췄다.
- root `AGENTS.md` 위생: 비밀·일회성·변동성 정보 0(도구 이름은 역할 매핑). 새 `AGENTS.md` 0 · 도구별 stub 0(사용자 결정) → `CLAUDE.md` stub·root 표 갱신 대상 없음. `app/AGENTS.md`·`ci.yml` 명령 불변. `node scripts/check-doc-inventory.mjs --check` links·prose ok · `check-product-naming` OK.

## 전환 (§8)

판정 의미 중 하한 실행 방법과 `잡음` 기준이 바뀌었으나, 0326 verify 6회째의 판정과 다음 주체는 새 규칙에서도 같다 — D28은 이행 `BLOCKING`(Y6 green · Y7 red), V20은 등록 변이 자체로 `잡음`, V2 AT B1은 claude-code 0번 기록이 실제 신호(클립보드 = 복사 문자열)라 `잡음`, C3은 9기록 모두 `endsMounted: true`의 실제 실패라 `잡음`. 정정 대상 없음. INDEX 0326 행 다음 주체를 `handoff-review` → 구현 r7로 갱신했다. 새 sweep 규칙(항별 기본 변이)은 r7 구현 sweep부터 걸린다.

## 남은 한계

- "계약이 적은 항"의 경계(블록 안 어떤 문장이 자리 문장의 항을 구현하는가)는 구현자가 읽어 나눈다 — 검증자 ⑦이 같은 방법으로 다시 세는 것이 방어다.
- 실패 이유의 판독은 oracle 출력에 이유가 남을 때만 된다 — 이유가 없는 oracle은 좌표 단독 실행으로 판정한다.
- Gemini CLI·Antigravity의 skill 로더·기본 컨텍스트 파일 동작은 이 컨테이너에서 확인하지 않았다(E) — 지침은 도구 설정에서 `AGENTS.md`를 읽게 하고 `SKILL.md`를 직접 읽으라고만 요구한다.

# review round 48 — 0327 (verify 3회째 FAIL): ⑦ 전수 잔여의 이월과 구현자 sweep의 `S/N`

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0327 verify 3회째 `FAIL`(`650cf73d`) 뒤 r4 착수 전 의무 review. 검증자가 "`handoff-review`를 바로 진행할까요?"라고 묻자 사용자가 `/handoff-review`를 실행 → **APPLY**(2026-11-24).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | verify 1이 V1 rev 3 §10 자리(EP-1~EP-25)를 plan 좌표 부재를 이유로 부분 sweep하고 "다음 verify가 잇는다"고 적었다. verify 2는 `SELF_BLOCKED`를 이유로 돌리지 않았고, ⑦ "이후" 범위(diff · Delta V 새 항목 · 직전 실패)에 그 잔여가 없었다. verify 3에서야 L2~L4(EP-6 ② · EP-7 ① 항 제거 green)가 나왔고 L1(EP-4 ① 크기 산식)도 같은 회차에 나왔다 | 0327 verify 1~3 · P66 · P12 | **A** — P66은 1회째 전수를 요구하지만 미완으로 끝난 회차의 잔여를 누가 언제 돌리는지 정하지 않았다. 글자대로 따르면 verify 2·3의 범위에서 빠진다. ⑦ 범위에 "앞 verify가 남긴 전수 잔여"를 더하고, 잔여가 남은 verify는 PASS하지 않으며(FAIL·RETURN_TO_PLAN만 넘길 수 있음) 좌표 부재는 미룰 이유가 아니라고 적었다. 새 causal class **P70** · P66 개정 메모 |
| 2 | r3가 pair마다 `SELF_PASS`를 적었지만 V1 rev 3 원장은 pair당 1~6행이었다. 검산 `87 · 11 · 12 · 34 = 144`는 행 합계라 분모 대비가 드러나지 않았다 | 0327 r1~r3 · P40 · P41 | **A** — "sweep S는 열거 항목 수와 같아야 한다"는 2026-11-20 `plan.template.md`에만 있었고 impl SKILL·AGENTS 최소 계약에는 없었다(0327 plan은 그보다 먼저 써서 문장이 없다). impl §3·§9 · AGENTS ⑦ 행·§단계별 절차 2 · template에 `S/N`과 남긴 항목을 두고, 남긴 항목이 있는 pair는 `SELF_PASS`로 적지 않게 했다. verify §4 "다시 센다"에 `S/N`을 더했다 |
| 3 | verify 3이 r3 `[구현자 기입]` 일곱 필드를 PASS로 적었다. 강제 지점 표는 EP 단위 테스트 목록이었고 pair마다 §10 자리 `N/M`과 `남긴 곳`이 없었다 | 0327 verify 3 · P52 | **B** — verify §9 "강제 지점 표는 그 pair의 §10 자리 전부와 `남긴 곳`을 담아야 한다(0262 r3)"가 이미 요구했다. 지침 변경 없음. 판정은 FAIL이라 결과가 같고, verify 4가 §9와 새 `S/N`으로 다시 센다 |
| 4 | L1 — `requestSize`에 평균 줄 길이가 r1부터 없었다 | 0327 r1 | **F** — 계약(EP-4 ①)은 충분했다. 놓친 이유는 #1(규칙 칸 분기 입력을 1회째 전수로 보지 않음)이다 |
| 5 | Y1~Y5 — 창 밖 확장 후보 | 0327 verify 3 | 실패 아님 — 정상 경로(후보 표) |
| 6 | SQLite ABI 393 · `smoke-hosts` · AC30 Windows 실기 | 환경 | **E** — 기록만 |

**verify 분류 대조(§2)**: L1은 EP-4 ① 산식 인용 + 코드 `lengthOf` 0건이라 이행 `BLOCKING`이 맞다. L2~L4는 자리 문장 항 인용("`highlightWords` 일 때" · "old 는 added 제외" · "증감 수")이 되는 `못 잡음`이라 이행이 맞다. Y1(⑫ else 분기)은 "이면 해제"의 반대를 읽으려면 해석이 필요해 확장이 맞고, Y2~Y5도 인용할 원문이 없다. E7-D3 동치(`newLine` 유일) · V3-M18 동치(fail-closed)도 맞다. 거짓 PASS 방향 왜곡 0 · FAIL inflation 0. #3은 verify 3이 놓친 이행 결함(필드 접힘)이지만 판정에 영향이 없다.

## Tier

**Tier 1.** 하한 ⑦의 실행 범위(검증자 이후 회차) · PASS 조건 · 구현자 `SELF_PASS` 조건 · CLOSED 이관 내용이 바뀐다.

## 6-A Operational Instruction Delta

기준 `867ab06b`. `instruction_delta.py --base HEAD --prose --pool docs/handoff/AGENTS.md`(대상 6파일 — handoff AGENTS · verify · impl · review SKILL · 두 template) 후보 **0**.

word-diff 지운 단어 전수:

| 파일 | 지운 단어 | 판정 |
|---|---|---|
| verify SKILL | `` `Criteria-Met`과 `` · `` `N/M`은 `` | REPLACE(확장) — "`Criteria-Met` · 강제 지점 `N/M` · sweep `S/N`은" |
| verify SKILL | `PASS다.` | REPLACE(확장) — PASS 조건에 ⑥ 존재 · ⑦ 잔여 0을 더했다(⑥은 §4에 이미 있던 조건을 옮겨 적음) |
| verify SKILL · AGENTS §라운드 | `행을` ×2 | REPLACE(확장) — CLOSED 이관에 "⑦ 전수 잔여"를 더한 문장 연장 |
| verify template | `실패)` ×2 | REPLACE(확장) — 범위에 "앞 verify 전수 잔여" |
| AGENTS ⑦ 행 · §단계별 절차 3 | `전수,` · `항목.` | REPLACE(확장) — `S/N` 괄호 · 잔여 문장 연장 |
| impl SKILL | `남긴다.` · `적는다.` | REPLACE(확장) — sweep 결과 문장 · 검산 문장 연장 |
| review SKILL | `` 잡음` `` · `§4` | REPLACE(확장) — 지표 행에 `S/N`·전수 잔여 · verify 메타 |
| plan template | `sweep S는` · `수와` · `한다.` · `§9).` | REPLACE — "S는 N과 같아야 한다(IMPL_DONE 전 전수)"를 유지하고 `S/N` 표기 · 남긴 항목 · `SELF_PASS` 조건을 더했다 |

상태 사본: INDEX 0327 행 다음 주체 `handoff-review → codex r4` → `Codex (구현 r4)` · 0327 plan 상태 줄 — REPLACE(상태, review 완료에 따른 보드 갱신).

KEEP 외 DELETE 0 · MOVE 0 · 설명 없이 사라진 gate·command·reference 0. reference·script 이동 0 → inbound `N`/`M/M` 대상 없음. heading 변경 0.

## 6-B Historical Failure Regression

- **70 P 전수**(`rg -c '^## P[0-9]+'` 70 — P70 신규) · 변경 후 **COVERED 70** / PARTIAL 0 / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0(6-A)이라 round 47의 COVERED 69가 그대로다.
- 바뀐 P: **P66** 강화(잔여 이월 · `S/N` — 개정 메모) · **P70** 신규.
- **P12**(조사 가능한 것을 불가로 선언): 강화 — ⑦에서 "plan 좌표가 없다는 것은 미룰 이유가 아니다"가 같은 꼴을 막는다. **P39 · P40 · P41**(자기보고 재현 · 합계 · 도구가 정의한 전수): 유지·강화 — `S/N`은 합계가 아니라 분모 대비이고 남긴 항목은 차집합이다. **P52**(분모를 §10 항목으로 셈): 유지 — `N`은 "§10 자리 검색 · pair path · 규칙 칸에서 센 수"로 자리 단위다. **P60**(열린 분모): 유지 — 잔여는 ⑦ 범위(열거 원문)에서 남긴 항목만이라 일반 hunk가 분모가 되지 않는다. **P64 · P66**(창 · 전수): 잔여 sweep의 `못 잡음`도 같은 분류를 받는다 — 창 밖이면 확장은 후보 표, 인용이 되면 이행. **P65**(⑥ 구현 주체 무관): 유지 — PASS 조건에 ⑥ 존재를 함께 적었다. **P67 · P69**: 유지.
- P1~P11 · P13~P38 · P42~P51 · P53~P59 · P61~P63 · P68: 방어 지점 불변(이번 변경이 닿지 않음).

| historical anchor | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 0327 verify 1(부분 sweep · RTP) | "다음 verify가 잇는다" — 규칙 밖 메모 | 남긴 항목을 메타에 목록으로 · RTP라 이월 허용 | 다음 주체 있음 |
| 0327 verify 2(`SELF_BLOCKED` 이유로 미실행 · RTP) | 범위 밖이라 미실행 | 잔여가 ⑦ 범위 — 돌려야 함 → L2~L4가 verify 2(창 안)에서 나옴 | 발견 시점 verify 3 → 2 |
| 0327 verify 3(부분 · FAIL) | 같은 부분 sweep | FAIL이라 이월 허용 · 잔여 목록 필요 | 판정 같음(FAIL) |
| 0327 r3 `SELF_PASS`(pair당 1~6행) | 검산 행 합계만 | `S/N` < 1이면 `SELF_PASS` 불가 → `SELF_BLOCKED`·남긴 항목 | 거짓 자기 PASS 0 |
| 0259 r1~r5(P66) | 1회째 전수 | 같음(전수를 마친 회차는 잔여 0) | 같음 |
| 0262 r4~r8(P60) | 창 안 `PLAN_GAP` · 창 밖 후보 표 | 같음 — 잔여는 열거 원문 안 | inflation 0 |

- **시나리오 replay**: 1회째 부분 sweep + 다른 막는 발견 0 → PASS 불가이고 넘길 수도 없음 → 같은 verify에서 마저 돌린다(상태 없는 판정 0) / 부분 sweep + FAIL·RTP → 잔여 목록과 함께 이월, 다음 verify가 범위로 읽음(다음 주체 있음) / 창 경계를 넘은 잔여 sweep의 `못 잡음` — 인용되면 이행 `BLOCKING`, 아니면 후보 표(inflation 0) / 9회째 CLOSED에 잔여 남음 → 종료 이관 목록으로 / 구현자가 `S/N` < 1로 IMPL_DONE → 해당 pair `SELF_BLOCKED`, verify가 같은 분모를 다시 셈 / 사용자 요구 변경 ΔV · 후보 표 승격 · §8 정정 경로 불변. 같은 축 무한 반복 0.

## 6-C Cross-document Consistency

- 검증자 ⑦ 이후 범위(직전 실패 + 앞 verify 전수 잔여) · 잔여 남은 verify PASS 불가: AGENTS ⑦ 행 · §단계별 절차 3 · verify ⑦ 행·bullet · verify §11 PASS · `verify.template.md` 메타 ⑦ 행·§4 — 같다.
- 구현자 `S/N` · 남긴 항목이 있는 pair는 `SELF_PASS` 아님: AGENTS ⑦ 행 · §단계별 절차 2 · impl §3·§9 · `plan.template.md` 분모 검산 · verify §4 "다시 센다" — 같다. "S는 N과 같아야 한다(IMPL_DONE 전 전수)"는 AGENTS ⑦ 행 "구현자는 IMPL_DONE 전 전수"와 같다.
- CLOSED 종료 이관에 ⑦ 전수 잔여: AGENTS §라운드 · verify §11 · `verify.template.md` — 같다. AGENTS §INDEX.md 운영(후보 표 1행)은 내용 목록을 적지 않아 충돌 없음.
- root `AGENTS.md`·`docs/git-template.md`: ⑦·`SELF_PASS`를 다루지 않음(`rg` 0건) — 갱신 대상 없음. SKILL frontmatter description: verify("열거 항목 sweep") · impl("열거 항목 sweep으로 자기 잠금") — 본문과 충돌 없음. 새 `AGENTS.md` 0 · `app/AGENTS.md`·`ci.yml` 명령 불변. `node scripts/check-doc-inventory.mjs --check` ok · `check-product-naming` OK.

## 전환 (§8)

0327 verify 3회째의 판정과 다음 주체는 새 규칙에서도 같다 — L1~L4는 이행 `BLOCKING`, Y1~Y5는 창 밖 후보 표, ⑦ 잔여가 있지만 FAIL이라 이월할 수 있다. 정정 절은 쓰지 않았다. verify 3 메타는 잔여를 EP 단위로 적었다. verify 4는 V1 rev 3 §10 자리 전체에서 v3가 돌린 47건([`v3-mutations.spec.jsonl`](../../../../docs/handoff/0327-worker-protocol-visible-views/evidence/v3-mutations.spec.jsonl)의 `E*` 행)을 뺀 나머지를 잔여로 읽는다. INDEX 0327 행 다음 주체를 `handoff-review` → 구현 r4(Codex)로 갱신했다. r4 구현은 V1 rev 3 §10 자리 sweep을 `S/N`으로 적는다.

## 남은 한계

- 열거 항목 수 `N`은 구현자가 §10 자리 검색 · pair path · 규칙 칸에서 센다. 검증자가 같은 분모를 다시 세는 것이 방어다(P41).
- 큰 V(자리 약 176)에서 한 verify 안에 전수를 마치는 비용은 지침으로 줄지 않는다. 잔여 이월은 비용을 회차로 나누되 PASS 전에는 0이어야 한다.

# review round 49 — 0329 (verify 3회째 FAIL) + 사용자 요구: 운반 줄 분류의 도구화 · review 효과 측정 · 크기 예산

**발동/모드**: `docs/handoff/AGENTS.md §라운드` — 0329 verify 3회째 `FAIL`(`c270a31f`) 뒤 r4 착수 전 의무 review. 사용자 지시 "제안관점으로 핸드오프 리뷰를 실행하라" + "더불어 핸드오프 리뷰 스킬 또한 개선하라" → **APPLY**(2026-11-25). 제안 관점 = 조항 덧붙이기 대신 통합·크기 예산·도구화, 결과 지표 측정.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | ΔV5 EP7 ⑥′이 검색 출력 9줄 중 운반 줄 `AboveInput.tsx:11·13·14`·`chatReducer.ts:560`을 "import·타입·주석"으로 뺐다 | 0329 ΔV5 · P52 · P60 | **B** — plan §10 bullet이 "운반 edge 전수"를 요구했다. 같은 지침의 B가 0262 r4~r8 이후 반복이라 문장 대신 도구로 옮겼다: `site_census.mjs`(AST 분류 · 미분류 0 · 제외 줄 사유). 새 P71 · P52 개정 메모 |
| 2 | verify 3 §0이 같은 검색을 다시 돌리고 "운반 줄은 목록과 같다"고 적었다. EP6 ⑦′ 출력에도 목록 밖 운반 줄 4개가 있었다 | 0329 verify 3 · P51 | **B** — verify §0 규칙이 있었다. 쓰는 쪽·세는 쪽이 같은 모델이라 사각이 같다 → #1과 같은 도구로 impl §2·verify §0이 다시 센다 |
| 3 | verify 3이 D19를 path edge 이행으로만 분류하고 목록 불일치(`PLAN_GAP`)를 놓쳤다 | 0329 verify 3 | 분류 왜곡 — 거짓 PASS 방향 아님(FAIL ↔ RETURN_TO_PLAN). §8 정정 |
| 4 | 지침이 3개월 동안 140,003 → 186,116 bytes · 사례 인용 52 → 117로 늘고, 10/12 이후 지침 커밋 19개 중 17개가 +60~136/−3~31줄이었다. review가 자기 효과를 재는 절차가 없었다 | 사용자 질의(2026-11-25) · round 30~48 | **A** — review SKILL §1에 `review_metrics.py` 효과 지표 · §4 크기 예산 · §3 반복 B는 도구로 · §7 기록에 효과 지표 |
| 5 | review SKILL "언제 하는가"가 AGENTS §handoff-review 트리거와 거의 같은 목록이었다 | review SKILL | 통합 — AGENTS를 정본으로, SKILL은 요약 한 문장. AGENTS 트리거에 script·root 규칙·skill 신설·정본 이동을 옮겼다 |
| 6 | NX1(`aria-busy`) — 창 밖 확장 | 0329 verify 3 | 실패 아님 — 후보 표 |
| 7 | AC10 Windows 실기 · 4코어 변이 비용(2시간 한도 1회 초과) | 환경 | **E** — 기록만 |

**verify 분류 대조(§2)**: D19의 `못 잡음`은 §24-C path edge 인용이 되므로 이행이 맞다. 다만 같은 사실이 검색 출력 ↔ §10 목록 불일치(plan 내부 불일치)이기도 해 `PLAN_GAP`이 함께 있어야 했다 → RETURN_TO_PLAN. NX1은 인용에 해석이 필요해 확장이 맞다. 거짓 PASS 0 · FAIL inflation 0(판정 방향은 FAIL → RETURN_TO_PLAN, 둘 다 막음).

## Tier

**Tier 1.** §10 자리 목록의 고정·재계수 evidence(도구 미분류 0 · 제외 줄 사유) · review의 증거·기록 의무 · 크기 예산이 바뀐다.

## 6-A Operational Instruction Delta

기준 `c270a31f`. `instruction_delta.py --base c270a31f --prose --pool docs/handoff/AGENTS.md`(대상 5파일 — plan·impl·verify·review SKILL · `plan.template.md`) 후보 **11**(잃음 5 · 이동? 1 · 문장 4 · 문장 이동? 1).

| 후보 | 판정 | 근거 |
|---|---|---|
| plan:182 `main.tsx`·`window.oo` · impl:90 `0327 r3` 서사 · verify:129 `:258-263` · verify:138 `endsMounted` | MOVE | 사례 서사 괄호만 사례 ID로 줄였다. 괄호 밖 문장은 기계 대조로 차이 0(바뀐 15줄 전부). 서사의 백틱 식별자·수치는 corpus·이 문서에 모두 있다(스크립트로 확인, 없으면 줄이지 않음 — 0265 r2 · 0198 r6 두 괄호는 유지) |
| verify:165 라벨 술어·인용 파일 범위 bullet(이동?) | REPLACE | verify §0 bullet로 합쳤다 — "라벨이면 표본이 참인지" · "지적이 인용한 파일로 좁지 않은지" · 미분류 = `PLAN_GAP`을 모두 담는다. 0209 r11·0262 r5는 plan·impl에 남는다 |
| review:23~28 발동 조건 목록(문장·잃음·문장 이동?) | MOVE | `docs/handoff/AGENTS.md §handoff-review 트리거`가 정본 — 사용자 요청 · 메타 수정(script·root 규칙·skill 신설·정본 이동을 이번에 옮김) · 반복 · drift · 검증 한계 · verify 3·6회째와 9회째 CLOSED(§라운드의 1→2→3→review 순서 포함) · impl 턴 3 초과가 모두 있다. SKILL에는 요약 한 문장과 "정상 단일 PASS마다 하지 않는다"를 남겼다 |

word-diff 지운 단어(사례 괄호 제외): "목록과의 차집합을"(impl·verify·AGENTS ×4·template) → "미분류(차집합)" REPLACE(같은 뜻 + 도구) · "차집합이"·"전체인지"(verify §0) → "미분류가"·"전체인지(지적이 인용한 파일로 좁지 않은지)" REPLACE · "고정한다(0262 r4~r8에서 … 됐다)"(verify §0 · AGENTS) → 이유를 문장으로 올리고 사례 ID만 괄호 REPLACE · "SKILL/template/AGENTS 변경."(AGENTS 트리거) → 확장 REPLACE · "교체·통합하고,"(review description) → 확장 REPLACE.

DELETE 0 · 설명 없이 사라진 gate·command·reference 0. reference·script 이동 0(새 script 2개 · 새 test 1개 추가만) → inbound `N`/`M/M` 대상 없음. heading 변경 0.

## 6-B Historical Failure Regression

- **71 P 전수**(`rg -c '^## P[0-9]+'` 71 — P71 신규) · 변경 후 **COVERED 71** / PARTIAL 0 / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0(6-A — 바뀐 줄은 괄호 밖 차이 0이거나 같은 뜻 확장)이라 round 48의 COVERED 70이 그대로다.
- 바뀐 P: **P52**(분모 단위) · **P60**(열린 분모) 강화 — 목록을 고정할 때 운반 줄이 도구로 정해져 목록 밖 운반 줄이 READY 전에 나온다. **P71** 신규.
- **P41**(도구가 정의한 전수): 유지 — `site_census.mjs`는 검색 출력 줄만 분류한다. 술어가 불변식의 주어인지 · 범위가 path 소스 전체인지는 여전히 사람이 보고(verify §0), value가 아닌 운반 줄 오분류 방향의 위험은 AST로 줄였고 비-TS 파일은 `unparsed`로 미분류에 넣는다. **P51**: 강화 — 같은 모델의 분류 사각을 도구가 대신한다. **P58 · 0209 r11**(범위 · 라벨 술어): 유지 — verify §0 bullet로 합쳤다. **P55 · P56 · P59**(좌표 범위 · 운반 값 · 호출 변이): 유지 — 해당 AGENTS bullet은 사례 괄호만 줄였다.
- P1~P40 · P42~P50 · P53~P54 · P57 · P61~P70: 방어 지점 불변.

| historical anchor | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 0329 verify 3(D19) | FAIL — D19 이행만 | RETURN_TO_PLAN — EP7 ⑥′ 미분류 4 · EP6 ⑦′ 미분류 4(`PLAN_GAP`) + D19 이행 | 다음 주체: 구현자 → 설계자 |
| 0329 ΔV5 설계 | 눈으로 "import·타입·주석" | 미분류 4·4로 READY 불가 → 그 턴에 목록 고정 | 발견 시점 verify 3 → 설계 턴 |
| 0262 r4~r8(P60) | 창 안 `PLAN_GAP`으로 목록 고정 | 같음 + 고정 시 도구 미분류 0 | inflation 0 |
| 0262 r5(P58) · 0209 r11 | 범위·라벨 수동 확인 | 같음(§0 bullet 하나로) | 같음 |

- **시나리오 replay**: 설계자가 미분류 0으로 READY → 구현자·검증자 재계수 같음(다음 주체 있음) / verify가 미분류 > 0을 찾음 → `PLAN_GAP` → 설계자, 동결 뒤면 출처 "plan 내부 정합"으로 허용 / 도구가 운반하지 않는 줄을 value로 냄(초기값 등) → 사유 붙은 제외 줄 한 줄로 닫힘, 라운드 아님(inflation 0) / 크기 예산을 못 지키는 새 causal class → 이유 기록 뒤 진행(교착 0) / 반복 B에 도구가 불가능 → capability limitation 기록(기존 경로). 같은 축 무한 반복 0.

## 6-C Cross-document Consistency

- 운반 줄 분류·미분류 0·제외 줄 사유: plan §10 bullet · impl §2 · verify §0 · AGENTS §공통 V(강제 지점 `N`) · §단계별 절차 2(최소 계약)·3 · `plan.template.md` §10 표 열·불변식 문단·잠금 절 · `verify.template.md` §0 행 — 같다. 도구 경로는 AGENTS 디렉토리 구조에 적었다.
- review 발동 조건: AGENTS §handoff-review 트리거(정본) = review SKILL 요약 = review frontmatter description — 같다. root `AGENTS.md`는 Tier 규칙과 3·6회째 review만 언급(충돌 없음).
- review 효과 지표·크기 예산: review SKILL §1·§4·§7·완료 조건·종료 보고 — 완료 조건 항목은 본문 §1·§4·§7에 매핑된다.
- 새 `AGENTS.md` 0 · `app/AGENTS.md`·`ci.yml` 명령 불변(도구는 `app/node_modules/typescript`를 읽기만 함). `node --test .agents/skills/handoff-verify/scripts/site_census.test.mjs` 3/3 · `check-doc-inventory --check` ok · `check-product-naming` OK.

## 효과 지표 (`review_metrics.py`)

| 구간(review round) | verify 커밋 | FAIL·RTP 비율 |
|---|---|---|
| 19~29 | 111 | 46% |
| 30~37 | 31 | 61% |
| 38 | 52 | 46% |
| 39~43 | 26 | 69% |
| 44 | 46 | 46% |
| 45~48 | 30 | 83% |

- 핵심 지침 bytes `c270a31f` 186,116 → 이번 라운드 185,054(−1,062, 새 규칙 포함) · 사례 인용 117 → 116. 2026-09-01 기준 140,003 · 52.
- 이번 이슈 A 1 · B 2(둘 다 같은 지침의 반복 B → 도구화).
- 해석: 구간마다 handoff 규모가 달라 지침 효과를 분리하지 못한다. round 50부터 같은 표를 이어 붙여, 이번 도구화 뒤 "기존 규칙의 적용 실패(B)"가 줄었는지와 구간 FAIL 비율을 본다.

## 전환 (§8)

0329 verify 3회째를 RETURN_TO_PLAN으로 정정한다 — `site_census.mjs`로 다시 가른 EP7 ⑥′ · EP6 ⑦′ 목록 불일치가 `PLAN_GAP`이다. 정정 절은 0329 `verify.md` 끝 `# verify 3 판정 정정 — review round 49`(별도 검증 커밋).

## 남은 한계

- 도구는 검색이 돌려준 줄만 가른다. 검색 술어·범위가 틀리면 미분류 0도 틀린다(P41) — 그 확인은 사람 몫이다.
- 구간 지표는 handoff 규모·종류를 통제하지 않는다. "효과 있음"을 말하려면 여러 라운드의 추세가 필요하다.
- `--emit-mutants` oracle을 `… | tail`로 끝내면 종료 코드가 늘 0이라 모든 변이가 green으로 나온다 — 이 라운드의 첫 실행 9개가 그랬고 재실행으로 바로잡았다. 도구 머리 주석에 적었다.

# review round 50 — 사용자 피드백(PR #654): verify가 리뷰 필요 여부를 보고 · 발견 원장 F(N) · site_census 실패 구별

**발동/모드**: 사용자가 붙여 준 피드백 "PR #654의 최신 HEAD를 기준으로 `handoff-review`와 `handoff-verify`의 역할을 보완하라"(2026-11-25) → **APPLY**. 기준 `4f5c1620`(PR #654 head와 같음).

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | review 발동이 의무 트리거(3·6·9회째)에만 묶여, verify가 본 지침 신호(앞 기록이 `검사 완료`였던 범위의 누락)가 review 질문으로 넘어가지 않았다 | 0329 verify 3 · 피드백 | **A** — verify §Review Signals에 `리뷰 필요 여부(필수·권고·불필요) · 근거 · 검토할 질문`, 종료 보고 한 줄. verify는 review를 호출하지 않고 A~F를 가르지 않는다. 권고는 사용자가 열지 정한다(AGENTS 트리거) |
| 2 | "실패 건수"의 정의가 없어 증감을 원인으로 읽었다 — 대화에서 F를 R+G+L+P+E로 나누고 "구현 결함 0"을 도출했다 | round 49 뒤 대화 · 피드백 | **A** — F(N) = 판정 시점 열린 `BLOCKING`·`PLAN_GAP` 고유 ID 수(verify §11 발견 원장). 출처는 겹칠 수 있어 분해를 강제하지 않는다. review의 효과 기준을 "더 일찍 잡혔는가 · 독립 축 · ⑦ 잔여"로 바꾸고 구간 FAIL 비율은 맥락으로 내렸다 |
| 3 | `site_census.mjs`가 검색 실패(없는 경로)를 빈 출력으로 받아 `미분류 0`·종료 0을 냈다 | 피드백 · round 49 도구 | **A**(도구 결함) — 종료 코드 0 정상 · 1 불일치(미분류·목록만) · 2 검색 실패 · 3 0줄인데 예상 자리. 테스트 5/5 |

**verify 분류 대조(§2)**: 판정 의미(분류·disposition·창·하한)는 바뀌지 않는다 — 리뷰 필요 여부는 판정과 별개 항목이다. 0329 verify 3 정정의 판정·다음 주체는 그대로다.

## Tier

**Tier 1.** verify의 기록·보고 의무(원장·리뷰 필요 여부)와 review의 증거·효과 기준이 바뀐다.

## 6-A Operational Instruction Delta

기준 `4f5c1620`. `instruction_delta.py --prose`(대상 plan·impl·verify·review SKILL · `verify.template.md` · AGENTS — 두 번 돌려 서로 pool) 후보 **23**.

| 후보 | 판정 | 근거 |
|---|---|---|
| impl:159 `no-stray-auth-subscribe` · impl:163 `[test-pools]` 외 사례 괄호 11곳(plan 1 · impl 7 · verify 3) | MOVE | 60~89바이트 사례 서사 괄호를 ID로 줄였다. 괄호 밖 문장 차이 0(기계 대조), 서사의 표식은 corpus·이 문서에 있다. `[test-pools]`는 AGENTS §판정 범위에 남는다 |
| verify:256 CLOSED 줄의 "같은 시점에 review" | REPLACE | 마무리 라운드 bullet "(CLOSED는 같은 시점에 그 handoff를 대상으로)"로 합침. "(사용자 요구 변경 턴 제외)"는 되돌려 유지 |
| review:63 효과 지표 행 · review:308 종료 보고 | REPLACE | 세 행(리뷰 필요 여부 질문 · F(N) · 효과 기준)으로. "효과가 없으면 같은 축의 다음 변경은 도구·순서·필드로"는 유지 |
| template:279 "(3·6회째 PASS가 아니면 … review)" | REPLACE | `리뷰 필요 여부` 줄로 |
| AGENTS:166 0190 · AGENTS:339 0188 서사 | MOVE | 한 줄 요지만 남김 — 원문 수치(13,190자 · 33,510자 · 10회 · r10)는 이 문서에 있다 |
| AGENTS:278 round 문서 정책 | MOVE | `handoff-review` §7이 정본(보존 사유 · 동시에 1개 · 실제 출처) — AGENTS는 참조 |
| AGENTS:402~415 §단계별 절차 3의 14줄 | MOVE | verify SKILL에 같은 규칙: 기준선 §0 · diff §1 · Product/UX §3 · 좌표 §6 · gate §8 · 대상 커밋 §9 · 인용 변이·덮개 회귀·형제 순서·독립 축·⑦ 잔여·소거 잔여물 §4 · 9회째 §11 · Review Signals(15개 구절 `grep -c` 각 1 이상). 검증자는 skill을 읽으므로 최소 계약이 필요 없다(§단계별 절차 2 구현 최소 계약은 유지) |

word-diff 지운 단어: 위 MOVE·REPLACE 범위 밖 0. DELETE 0 · 설명 없이 사라진 gate·command·reference 0. reference·script 이동 0(새 표·종료 코드만) → inbound `N`/`M/M` 대상 없음. `failure-patterns.md`에 "§단계별 절차 3 → verify SKILL 같은 규칙" 대응 한 줄.

## 6-B Historical Failure Regression

- **71 P 전수** · 변경 후 **COVERED 71** / PARTIAL 0 / GAP 0 / OBSOLETE 0. `현재 방어`에 §단계별 절차 3을 적은 P 14개(P47 · P52~P56 · P60 · P62 · P63 · P65 · P66 · P68 · P70 · P71)는 모두 verify SKILL 또는 AGENTS 본문 절을 함께 적어 방어가 남는다.
- 강화: **P41**(도구가 정의한 전수) — 검색 실패·빈 검색·낡은 목록이 `미분류 0`으로 보이지 않는다. **P66 · P70**(⑦ 전수·잔여) — 원장 `직전 기록`이 `명시 이월`과 `검사 완료`를 갈라 늦은 발견의 출처가 기록된다. **P71** — 같은 이유.

| replay | 리뷰 필요 여부(새 규칙) | 실제 review | 판정 |
|---|---|---|---|
| 0329 verify 1(FAIL · 첫 회차) | 불필요 | 없음 | 같음 |
| 0329 verify 2(RTP · D10~D18 `명시 이월` · G1 `확인 불가`) | 불필요(이월 범위 · 검사 완료 기록 없음) | 없음 | 같음 — inflation 0 |
| 0329 verify 3 정정(F 3 · G2·G3 `검사 완료`) | 필수(3회째 비PASS) + 권고 신호 2 | round 49 | 같음 |
| 0327 verify 3(L2~L4 `명시 이월`) | 필수 | round 48 | 같음 |

- 집계 재생: `review_metrics.py --handoff 0329` → `(0329, 1) F 9 · (0329, 2) F 11 · (0329, 3 정정 round 49) F 3` — 회차 3개, 정정이 원 판정(F 1)을 대체했다.
- **시나리오 replay**: 창 안 FAIL 단독 → 불필요(review 남발 0) / `검사 완료` 범위의 늦은 발견 → 권고 → 사용자 결정, 판정·다음 주체는 그대로(교착 0) / verify 없는 impl 턴 > 3 → AGENTS 트리거로 필수(verify 없이 작동) / 9회째 CLOSED → 필수 / 판정 정정 → 정정 원장이 같은 회차를 대체, verify 횟수 불변. verify가 review를 호출하거나 A~F를 가르는 경로 0.

## 6-C Cross-document Consistency

- 리뷰 필요 여부: verify SKILL §Review Signals(정의) = `verify.template.md` 메타·§14·§15 = AGENTS §handoff-review 트리거(필수 = 의무 항목 · 권고 = 사용자 결정) = review SKILL §1(출발 질문) — 같다. verify description에 보고 의무를 적었다.
- 발견 원장: verify SKILL §11 = template §13 원장 표 = review §1·§8(정정 원장) = `review_metrics.py` 파서(`### 발견 원장 — verify N[ 정정(round K)]`) — 같다.
- `site_census.mjs` 종료 코드: 스크립트 머리 주석 = 테스트 5개. 지침은 "미분류"만 말하고 종료 코드를 재서술하지 않는다.
- root `AGENTS.md` 충돌 없음 · `app/AGENTS.md`·`ci.yml` 불변 · `check-doc-inventory --check` ok · `check-product-naming` OK.

## 효과 지표

- 핵심 지침 bytes `4f5c1620` 185,054 → 184,291(−763, 새 의무 포함). 사례 인용 116 → 116.
- 이번 이슈 A 3 · B 0.
- 효과 확인 기준(다음 라운드): 리뷰 필요 여부가 `권고`로 올린 질문이 review에서 지침 변경으로 이어졌는지 · `검사 완료` 범위의 늦은 발견이 다음 적용 대상에서 줄었는지.

## 전환 (§8)

판정 의미 불변 — 정정 대상 없음. 0329 verify.md에 회차별 발견 원장을 재구성해 붙였다(별도 검증 커밋, 판정 불변).

## 남은 한계

- 원장의 `직전 기록`은 앞 기록의 문장을 사람이 읽어 고른다. 앞 회차가 범위를 모호하게 적으면 `확인 불가`가 늘고 권고 신호가 약해진다.
- `권고`는 사용자 결정이라 응답이 없으면 review가 열리지 않는다 — 다음 verify의 리뷰 필요 여부가 같은 신호를 다시 낸다.

# review round 51 — 사용자 피드백: review 판단 절차 정리 · review_metrics 집계 단위 · instruction_delta 입력 검증

**발동/모드**: 사용자가 붙여 준 보완점 "핸드오프 리뷰 스킬 및 스크립트에 대한 보완점이다"(2026-11-25) → **APPLY**. 기준 `73928c67`.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | review가 F 증감을 원인으로 읽을 여지 — 증가·감소·등락별 대조 절차가 없었다 | round 49·50 뒤 대화 | **A** — §1 표에 추세별 대조(증가: 신규·계속·재개와 직전 기록 / 감소: 실제 종결·분류 이동과 검사 범위·⑦ 잔여 / 등락: 재개·다른 ID의 같은 위반·순차 이월). 증감은 발동·귀속 근거가 아님 |
| 2 | "같은 지침의 B가 두 번째" 판단에 연결 근거 요구가 없었다 | round 49 §3 | **A** — 이전 사례 · 당시 지침 문장(커밋) · 해야 했던 행동 · 이번 증거를 잇고, 못 이으면 보류 |
| 3 | 효과 판정에 적용 기회 확인이 없었다 · §8 정정의 증거 종류와 범위가 모호했다 · §0과 완료 조건이 모드를 구별하지 않았다 | round 50 §7·§8 | **A** — §7 `적용 기회 없음 / 앞 단계에서 검출 / 같은 단계에서 재발 / 증거 부족` · §8 발동 당시 사실 / 재분류 / 새 실행 구별, 같은 회차 정정 = 재분류+확인 실행, 소급 금지 · §0·완료 조건·종료 보고를 공통/APPLY 변경 시로 |
| 4 | `review_metrics.py` — 날짜로 구간을 나눠 같은 날 round 49·50이 0회·5회 · 정정·원장 재구성 커밋을 verify로 셈 · `# Round N`·중복 round 24 미처리 · 판정 불명 미구별 · 원장 형식 오류를 0건으로 · 잘못된 `--size-at`을 0 bytes로 | 재현(`73928c67`) | **A**(도구 결함) — 커밋 순서 구간 · 회차 규칙(사이에 설계·구현 커밋이 있을 때만 새 회차) · ID 전이 · 오류 보고. 테스트 |
| 5 | `instruction_delta.py` — 잘못된 `--base` → "신규 파일·후보 0" · 잘못된 `--head` → "잃음 122" · 없는 `--pool` → "후보 0", 모두 종료 0 · `--strict`가 `--strict-old` 안에서 보존으로 셈 | 재현 | **A**(도구 결함) — 입력 검증(종료 2) · 토큰 단위 대조 · `--pset` |

## Tier

**Tier 1.** review의 증거·판단·종료 조건과 두 도구의 판정 의미가 바뀐다.

## 6-A Operational Instruction Delta

기준 `73928c67`. 고친 `instruction_delta.py --prose`(대상 plan·impl·review SKILL + AGENTS를 두 번) 후보 **22**(review SKILL만, 잃음 2 · 문장 19 · 문장 이동? 1). plan·impl·AGENTS 후보 0.

| 후보 | 판정 | 근거 |
|---|---|---|
| review:3 description | REPLACE | 로드 신호(3·6·9회째 · 리뷰 필수·권고 · impl 턴 > 3 · 반복 · drift · 사용자 요청 · 메타 수정)는 유지, 절차 세부는 본문 |
| review:23 발동 조건 요약 | MOVE | AGENTS §handoff-review 트리거가 정본(횟수·예외·권고) |
| review:46 APPLY 행 | REPLACE | "실제로 바꾸면" 조건부. "git 동기화"는 "커밋·push"로 유지 |
| review:64 `python3 …review_metrics.py` 경로 · review:65 효과 행 | REPLACE · MOVE | 경로는 F 증가 행에 유지. 효과 판정은 §7 적용 기회 분류로 이동(“같은 단계 재발이면 도구·순서·필드”도 이동) |
| review:287~297 완료 조건 11줄 | REPLACE | 공통 5 + APPLY 변경 시 4로 통합. 압축 중 빠졌던 "Tier 2면 6-B 생략 근거" · "작은 수정은 지운 단어" · "INDEX·trailer 운영 규칙" · "plan/impl/verify가 corpus를 읽거나 고치게 하지 않음" · "push"를 되돌렸다. 나머지 세부(§4 문장 원칙 · 6-C 위생)는 본문 절에 있다 |
| review:290 `과 semantic` | REPLACE | "`N`과 semantic `M/M`" → "`N`/`M/M`" — 백틱 경계 표기 |
| review:305~311 종료 보고 7줄 | REPLACE | 모든 모드 / APPLY 변경 시 두 줄. 항목 유지 |

사례 괄호 4곳(plan 2 · impl 1 · AGENTS 1, 50~59바이트)은 ID로 줄였다 — 괄호 밖 차이 0, 표식은 corpus·이 문서에 있다. DELETE 0 · 설명 없이 사라진 gate·command·reference 0.

## 6-B Historical Failure Regression

- `instruction_delta.py --base 73928c67 --pset …corpus.md` → P 변경 전 71 · 변경 후 71 · 삭제·추가·중복·번호 변경 없음.
- **71 P 전수** · **COVERED 71** / PARTIAL 0 / GAP 0 / OBSOLETE 0. 방어 문장 삭제 0.
- 강화: **P39 · P40**(자기보고·합계) — `review_metrics.py`가 회차·구간 배정 합계를 대조한다(`배정 합계 447 = 회차 447`). **P41**(도구가 정의한 전수) — 두 도구가 입력 오류를 정상 결과로 내지 않는다. **P51**(같은 에이전트의 재실행) — "두 번째 B"에 당시 문장·커밋 연결 요구.

| replay(실데이터 `73928c67` + 이번 변경) | 수정 전 | 수정 후 |
|---|---|---|
| 0329 F | (0329, 1·2·3) 9 · 11 · 3 — 정정 전 F 1은 출력 없음 | 9 · 11 · 3, 3회째 이력 `원 F 1 → 정정 49 F 3`. 전이 1→2 실제 종결 9 · 2→3 실제 종결 11 · 계속 열림 0 |
| 0329 verify 회차(커밋) | 구간 표에 verify 커밋 5개(정정·재구성 포함) | 3회 — `--list 48`: verify 3 `c270a31f` · 같은 회차 갱신 `4f5c1620`, `73928c67` |
| round 49 · 50 구간 | 0 · 5(날짜 구간) | 0 · 0(커밋 순서). 0329 verify 1~3은 round 49 커밋보다 앞서 round 48 구간 |
| `# Round 4~16` · round 24 둘 | 미처리 · 날짜 하나 | 4~16 각 구간 · `24`(`24585af6`)와 `24b`(`56609af7`) |
| 전체 | — | verify 회차 447(handoff 276) · 판정 불명 4(FAIL% 분자·분모 제외) · 배정 합계 447 · verify.md 298 · 원장 보유 1 · 원장 없음 297 |

- **시나리오 replay(테스트 16개)**: 빈 원장 뒤 신규(0 → 1) · 같은 F 수열 1→0→1에서 재개와 신규 구별 · 분류 이동 · 정정 이력 · 표 끝에서 읽기 멈춤 · 오타·충돌 중복·같은 정정 번호 상충·표 없는 원장 → 오류(0건 아님, 종료 1) · 회차 누락 보고 · 같은 날 review와 번호 중복 구간 · 판정 불명 제외 · 정정이 회차를 늘리지 않음 · `--size-at` 잘못된 ref(종료 2)와 그 시점에 없던 파일 구별 · `instruction_delta` 잘못된 base·head·pool·대상·map(종료 2) · 실제 신규 파일·후보 0 성공 · `--strict` ↔ `--strict-old` · 한글 조사 경계 · `--pset` 삭제·추가·중복·번호 변경. 같은 테스트를 `73928c67` 스크립트에 돌리면 14/16 실패(대조 사례 2개만 통과).

## 6-C Cross-document Consistency

- review §0 = 완료 조건 = 종료 보고(공통 / APPLY 변경 시) — 같다. 발동·횟수·예외·권고 = AGENTS §handoff-review 트리거(정본) ↔ review "언제 하는가"(참조) ↔ description(요약) — 충돌 없음.
- §6-B 1단계 `--pset` ↔ `instruction_delta.py` 사용법 ↔ `failure-patterns.md` 진입점 — 같다. AGENTS 디렉터리 구조에 두 스크립트 역할과 테스트 파일.
- verify SKILL·template의 원장 형식 ↔ `review_metrics.py` 검증 값(disposition·직전 상태 `— / 열림 / closed 보고 / 닫힘`·이번 결과·직전 기록·증거) — 같다. `닫힘` 직전 상태는 재개 행 표기용으로 파서가 받는다.
- `check-doc-inventory --check` ok · `check-product-naming` OK · `site_census.test.mjs` 5/5 · `test_review_scripts.py` 16/16.

## 효과 지표

- 앞 라운드 변경의 적용 기회: round 49(`site_census`) · round 50(리뷰 필요 여부·원장) — 그 뒤 verify 회차 0 → **적용 기회 없음**(효과 판정 보류).
- 핵심 지침 bytes `73928c67` 184,291 → 184,273(−18, 새 절차 포함). 사례 인용 116 → 116.
- 이번 이슈 A 5 · B 0.

## 전환 (§8)

판정 의미(분류·disposition·창·하한) 불변 — 정정 대상 없음.

## 남은 한계(과거 자료로 복원할 수 없는 범위)

- F(N)과 ID 전이: 원장이 있는 verify.md 1개(0329)만. 나머지 297개는 원장 형식 전 기록이라 복원하지 않는다(재구성은 그 handoff의 기록을 사람이 읽어야 한다).
- verify 회차: `Handoff`·`Status`·`Verified-By` trailer가 있는 커밋만 센다(첫 trailer 커밋 2026-06-09). trailer 없는 옛 verify와, 한 handoff의 설계·구현 커밋 없이 이어진 별개 verify(예: 외부 요청으로 같은 코드를 다시 검증)는 같은 회차로 합쳐진다.
- 판정 불명 4회는 `Verified-By`가 비었거나 `pending`인 verify 커밋이다 — 판정을 복원하지 않고 비율에서 뺀다.
- 구간: 절을 들인 커밋을 `git log -S`로 찾는다. 같은 접두가 지워졌다 다시 들어온 이력이 있으면 배정이 어긋날 수 있다(현재 이력에는 `구간 복원 불가` 0).

# review round 52 — 사용자 피드백: 실패 회차가 집계에서 사라지거나 불완전한 원장이 개선으로 보이지 않게

**발동/모드**: 사용자가 붙여 준 피드백 "다음은 보완점에 대한 피드백이다"(2026-11-25) → **APPLY**. 기준 `f4268eb1`.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | `Handoff:`가 여럿인 커밋을 첫 값만 읽어 0263 `RETURN_TO_PLAN → PASS`·0264 `FAIL → PASS`가 각각 1회 PASS로 축약됐다 | `ce7aa102` · `7be5d723`(0262~0265 공동 구현 커밋) | **A**(도구) — trailer마다 반영 |
| 2 | 부모·트리가 같은 두 커밋(`7141791e` · `1e8e0486`, 0294 r5)을 두 회차로 세어 r7이 r8로 나왔다 | 0294 | **A**(도구) — (handoff, 부모, 트리, 종류)가 같으면 한 커밋. 트리만 같고 부모가 다르면 별개 재검증 |
| 3 | 명시 기록과 커밋 추론의 충돌을 드러내지 않았다 · 판정 순서를 pass/fail로만 냈다 | 0263·0264·0294 | **A** — verify.md 명시 회차(H1 `# rN 검증`·`# 라운드 N`·`# verify N회째` 등의 최댓값)와 대조, 불일치는 `복원 불가`와 근거·구간 FAIL%에서 제외. 판정은 회차에서 판정을 밝힌 가장 최근 커밋 제목 |
| 4 | 원장 — 빈 ID·`BLOCKING_typo` 통과 · 직전에 열린 ID가 사라져도 F를 냄 · 잘못된 최신 정정을 버리고 원 판정을 유효로 씀 · 확인 불가 전이를 0으로 | 피드백 재현 | **A**(도구) — 엄격 disposition 정규식, 누락·잘못된 정정은 `판정 불가`(종료 1), 직전 상태를 직전 원장과 대조, 확인 불가 전이는 `-` |
| 5 | `instruction_delta` — 2글자 백틱 옵션(`-q`→`-v`) 미대조 · `--pset` 단독의 `--pool`·`--map` 무시 · Git 판본의 디렉터리를 텍스트로 읽음 | 피드백 재현 | **A**(도구) — TOKEN 2글자부터 · 조합 거부(종료 2) · blob 아닌 대상 거부 |
| 6 | review frontmatter가 "권고를 보고했을 때" 로드 — 권고는 사용자 수락이 필요하다 · 직전 상태 `닫힘`이 SKILL·template에 없었다 | 지침 정합 | **A** — frontmatter "사용자가 권고를 수락했을 때(verify는 이 스킬을 부르지 않는다)" · `closed 보고`(구현자 보고) ↔ `닫힘`(verify 종결 확인) |

**verify 분류 대조(§2)**: 판정 의미 불변 — 정정 대상 없음.

## Tier

**Tier 1.** 집계 도구의 판정 의미(회차·F·오류)와 verify 원장 값 정의가 바뀐다.

## 6-A Operational Instruction Delta

기준 `f4268eb1`. `instruction_delta.py --prose`(review·verify SKILL · `verify.template.md`, pool AGENTS) 후보 **2**.

| 후보 | 판정 | 근거 |
|---|---|---|
| review:177 word-diff 전체 명령 | MOVE | `instruction_delta.py` 머리말 "잡지 못하는 것"에 같은 명령. SKILL은 그 명령을 가리킨다 |
| verify:248 `—`(이번에 처음) | REPLACE | `—`(직전에 안 열림) — 파서가 직전 원장과 대조할 수 있는 정의. `닫힘` 추가 |

word-diff 지운 단어: review description의 절차 요약(본문 §0~§8에 있음) · verify `closed 보고` 설명의 표현. DELETE 0.

## 6-B Historical Failure Regression

- `--pset`(기준 `f4268eb1`): P 71 → 71, 삭제·추가·중복·번호 변경 없음. **COVERED 71**.
- 강화: **P39 · P40**(합계·자기보고) — 회차 합계 검산에 더해 handoff별 회차·판정 순서와 명시 기록을 대조한다. **P41**(도구가 정의한 전수) — 불완전한 원장이 F로 나오지 않는다.

| handoff | 원문 근거 | 수정 전(`f4268eb1`) | 수정 후 |
|---|---|---|---|
| 0263 | `c6d745c5` "r1 검증 RETURN_TO_PLAN" → 구현 `ce7aa102`·`7be5d723`(Handoff 4개) → `80fcaaa2` "r2 검증 PASS" · verify.md `# r2 검증` | 1회 `claude:pass` | 2회 `RETURN_TO_PLAN → PASS` · 명시 일치 |
| 0264 | `c37553b3` "r1 검증 FAIL" → 같은 공동 구현 커밋 → `bec4cc2b` "r2 검증 PASS" · `# r2 검증` | 1회 `claude:pass` | 2회 `FAIL → PASS` · 명시 일치 |
| 0294 | `7141791e`·`1e8e0486` 부모 `aac291f3`·트리 `f518cc71` 같음 · verify.md `# r2`~`# r7` | 8회 | 7회 `RTP → RTP → FAIL → RTP → RTP → FAIL → PASS` · 같은 변경 `1e8e0486` · 명시 일치 |
| 0329 | 원장 4개(verify 1·2·3·3 정정 49) · `## 판정 — verify 3회째` | 3회 · F 9 → 11 → 3 | 3회 `FAIL → RTP → RTP` · F 9 → 11 → 3 · 이력 `원 F 1 → 정정 49 F 3` |
| 전체 | — | verify 회차 447(handoff 276) | 450(handoff 278) · 판정 불명 4 · 복원 불가 handoff 7(회차 29) · 배정 합계 450 |
| round 24 · 49·50 | 절을 들인 커밋 | 24·24b · 49·50 각 0 | 같음 — 24(`24585af6`)·24b(`56609af7`) · 49·50·51 각 0 |

- **시나리오 replay(테스트 30개 = 기존 16 + 신규 14)**: 여러 Handoff 커밋 · 부모·트리 같은 중복(병합) · 트리만 같은 별개 재검증 · 명시 기록 충돌 → `복원 불가` · 빈 ID · `BLOCKING_typo` · `NEXT_HANDOFF(확장)` 허용 · 누락 ID → `판정 불가`(종료 1)와 다음 회차 전이 `-` · 잘못된 최신 정정 → 이력 보존·`판정 불가` · 근거 없는 `닫힘` · 유효한 빈 원장 F 0 · `--handoff` 범위 · `-q`→`-v` · `--pset`+`--pool`/`--map` 거부 · Git·작업 트리 디렉터리 거부 · 삭제 파일 정상 비교. 같은 테스트를 `f4268eb1` 스크립트에 돌리면 19개 실패(신규 재현 사례 전부 포함).

## 6-C Cross-document Consistency

- 직전 상태 값: verify SKILL §11 원장 표 = `verify.template.md` 원장 표 = `review_metrics.py` PREV·대조 규칙 = 테스트 — `—` · `열림` · `closed 보고` · `닫힘` 같다.
- 리뷰 필요 여부: review frontmatter("필수 · 사용자가 수락한 권고 · verify는 부르지 않음") = AGENTS §handoff-review 트리거 = verify SKILL §Review Signals — 같다.
- `check-doc-inventory --check` ok · `check-product-naming` OK · `site_census.test.mjs` 5/5 · `test_review_scripts.py` 30/30.

## 효과 지표

- 앞 라운드(49·50·51) 변경의 적용 기회: 그 뒤 verify 회차 0 → **적용 기회 없음**.
- 핵심 지침 bytes `f4268eb1` 184,273 → 184,264(−9). 이번 이슈 A 6 · B 0.

## 전환 (§8)

판정 의미 불변 — 정정 대상 없음.

## 남은 한계(과거 자료로 복원할 수 없는 범위)

- 명시 기록과 충돌해 `복원 불가`인 handoff 7개: 0157(커밋 1 ↔ 명시 2) · 0198(8 ↔ 10) · 0209(8 ↔ 13) · 0223(1 ↔ 2) · 0237(4 ↔ 7) · 0238(3 ↔ 4) · 0249(4 ↔ 3). trailer 없던 verify 커밋, 명시 번호가 impl 라운드를 따른 기록, 재개 뒤 번호를 다시 쓴 기록 중 무엇인지는 각 verify.md를 사람이 읽어야 가른다.
- 명시 회차가 없는 verify.md(H1 회차 표기 없음)는 커밋 추론만 쓴다(`명시 없음`) — 대조로 오류를 잡지 못한다.
- fail 종류(FAIL·RETURN_TO_PLAN)는 제목에 판정어가 없고 `Next-Action`이 구현자가 아니면 `FAIL·RTP`로 남는다.
- F(N)·전이는 원장 보유 1개(0329)만. 나머지 297개는 원장 형식 전 기록이다.

# review round 53 — 사용자 요청: 회차별 판정 대조 · 미종결 ID 추적 · 원장 구분선 검증

**발동/모드**: 사용자 요청 "PR #654의 최신 원격 HEAD를 기준으로 handoff-review의 review_metrics.py와 회귀 테스트를 보완하라"(2026-11-25) → **APPLY**. 기준 `300e4cbd`(PR #654 head와 같음). verify의 역할(리뷰 필요 여부·근거·질문 보고만)은 바꾸지 않았다.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 회차 수만 대조하고 회차별 판정은 대조하지 않아 같은 회차 정정·종료가 사라졌다 · 커밋 제목에 판정어가 없으면 fail 종류를 몰랐다 · 문서 안 판정이 엇갈려도 `일치` | 0262 9회째(`# r9 종료` `판정: **CLOSED**`) · 0327 1·2회째(`## 판정 (verify N회째)` `**RETURN_TO_PLAN**`) · 0322 1회째(메타 PASS ↔ 결론 RETURN_TO_PLAN) | **A**(도구) — verify.md 회차 절·정정 절을 읽어 원판정⇒유효 판정, 회차별 `일치 / 충돌 / 특정 불가`. 회차 수 패턴을 회차 절 패턴과 하나로. 충돌 handoff는 `복원 불가`로 구간 FAIL%에서 제외 |
| 2 | 직전 회차가 판정 불가·누락이면 그 뒤 원장의 누락을 검사하지 못해 빈 원장이 F 0으로 나왔다 · 종결 뒤 재개한 ID의 직전 상태를 옛 종결로 대조했다 | 피드백 재현 | **A**(도구) — 마지막으로 확인된 미종결 ID를 들고 가 다시 나타날 때까지 F·이력을 `판정 불가`, ID별 최신 상태와 직전 상태 대조 |
| 3 | 구분선을 `-`·`:`만 보고 칸 수를 보지 않았다 | 피드백 재현 | **A**(도구) — 구분선 6칸 `:?-{3,}:?`. 손상·부재는 형식 오류·판정 불가 |

## Tier

**Tier 1(도구 판정 의미).** 지침 문장 변경 0 — 핵심 지침 bytes 불변(184,264). 6-A 대상 지침 파일 없음.

## 6-B Historical Failure Regression

- `--pset`(기준 `300e4cbd`): P 71 → 71, 변화 없음. **COVERED 71**. 강화: **P39·P40**(회차·판정 순서를 문서와 회차별 대조) · **P41**(불완전한 원장이 수렴으로 보이지 않음).

| handoff | 원문 근거 | 수정 전(`300e4cbd`) | 수정 후 |
|---|---|---|---|
| 0262 | `# r9 검증` `\| 상태 \| **FAIL**` · `# r9 종료` `판정: **CLOSED**` · 커밋 `108429de`·`88f76e97` | 9회, 9회째 `FAIL`, 대조 `일치` | 9회째 `FAIL⇒CLOSED` · 회차 수 일치 · 회차별 일치 |
| 0327 | `## 판정 (verify 1회째)`·`(2회째)` 아래 `**RETURN_TO_PLAN**` · 커밋 "설계 반환"(판정어 없음) | `FAIL·RTP → FAIL·RTP → …` · `명시 없음` | `RETURN_TO_PLAN → RETURN_TO_PLAN → FAIL → FAIL → PASS` · 일치 · 일치 |
| 0322 | 1회째 절 메타 `**PASS(기계 범위)**`(“r2 판정은 라운드 2절”) ↔ 결론 `**RETURN_TO_PLAN**` | `일치` | 1회째 `특정 불가(문서 안 판정 혼재)` |
| 0263 · 0264 | round 52 근거 | `RTP → PASS` · `FAIL → PASS` | 같음 · 회차별 일치 |
| 0294 | round 52 근거 + `# r3 판정 정정` | 7회 | 7회 · 3회째 `RETURN_TO_PLAN⇒FAIL` · 회차별 일치 · 같은 변경 `1e8e0486` |
| 0329 | 원장 4개 · `## 판정 — verify 3회째` · `**정정 판정: RETURN_TO_PLAN.**` | 3회 · F 9→11→3 | `FAIL → RETURN_TO_PLAN → FAIL⇒RETURN_TO_PLAN` · F 9→11→3 · 이력 `원 F 1 → 정정 49 F 3` |
| 전체 | — | 복원 불가 7 | 회차 450(handoff 278) · 판정 불명 4 · 회차 수 대조 일치 54 · 명시 없음 211 · 복원 불가 13 · 회차별 일치 301 · 특정 불가 40 · 충돌 0(실데이터) |
| round 24 · 49~52 | 절을 들인 커밋 | 24·24b · 각 0 | 같음 |

- 회차 수 복원 불가가 7 → 13인 것은 `## 라운드 N`·`## Verify 라운드 N`·`## 메타 (rN)` 절을 명시 회차로 읽게 된 결과다 — 0046(라운드 2·4·5 ↔ 커밋 1) · 0049 · 0073 · 0101 · 0201 · 0211(커밋 8 ↔ 문서 7). 모두 문서와 trailer 커밋이 실제로 어긋난다.
- **시나리오 replay(테스트 38개 = 기존 30 + 신규 8)**: 종료 정정 `FAIL⇒CLOSED` · 판정어 없는 커밋 + 문서 `**RETURN_TO_PLAN**` · 커밋 fail ↔ 문서 PASS 충돌 · 문서 안 판정 혼재 · 판정 없는 회차 · 미종결 ID가 빠진 뒤 빈 원장 2개 `판정 불가` → 종결 확인 회차부터 재개 · 종결→재개→잘못된 `닫힘` · 구분선 `|---|---|`·구분선 없음. 같은 테스트를 `300e4cbd` 스크립트에 돌리면 11개 실패(신규 8개 전부).

## 6-C Cross-document Consistency

- `review_metrics.py` 머리말(회차 수·회차별 판정 대조, 미종결 추적, 구분선) = 동작 = 테스트. verify SKILL §11 원장 정의(직전 상태 값)와 충돌 없음 — 최신 상태 대조는 정의의 적용이다. 지침 문서 변경 0.
- `test_review_scripts.py` 38/38 · `site_census.test.mjs` 5/5.

## 효과 지표

- 앞 라운드(49~52) 변경의 적용 기회: 그 뒤 verify 회차 0 → **적용 기회 없음**. 이번 이슈 A 3 · B 0.

## 남은 한계

- 판정 줄 형식은 표본에서 모은 7가지다. 그 밖의 표기는 `특정 불가`로 남는다(40회차) — 일치로 세지 않는다.
- 회차 절 기준점이 없는 문서(명시 없음 211 handoff)는 커밋이 1회일 때만 첫 절과 대조한다.
- `## rN-N. 이전 판정 정정`처럼 회차 번호가 다른 절 안의 정정은 읽지 않는다.
- 원장 형식이 잘못된 회차에 적힌 ID는 상태 추적에 쓰지 않는다 — 그 회차에 새로 열린 ID가 뒤에서 사라지면 잡지 못한다.

# review round 54 — 사용자 피드백: 잘못된 원장의 미종결 축소 · 템플릿 판정 읽기 · 회차 판정 단일 출처

**발동/모드**: 사용자 피드백 "PR #654의 최신 HEAD에서 review_metrics.py와 회귀 테스트를 다음 세 항목에 맞춰 보완하라"(2026-11-25) → **APPLY**. 기준 `ac6614d9`(round 53 · PR #654 원격 head). verify(리뷰 필요 여부 보고)와 review(원인 판단)의 역할은 바꾸지 않았다.

## 분류

| # | 발견 | 사례 | 조치 |
|---|---|---|---|
| 1 | 직전 상태가 어긋난 행(열린 D1을 `닫힘`으로 적어 닫음)이 D1의 마지막 확인 상태를 덮어써, 다음 빈 원장이 F 0·이력 `원 F 0`이 됐다 · 구분선 뒤 빈 줄로 떨어진 행을 빈 원장으로 읽었다 | 피드백 재현(1 → 판정 불가 → 0) | **A**(도구) — 어긋난 행은 상태를 갱신하지 않고 이력에도 같은 규칙. 떨어진 행은 형식 오류 |
| 2 | 템플릿 그대로 쓴 판정(`\| 상태 \| FAIL \|`·`- 상태: FAIL`, 굵게 없음)과 `# Verify N회째`·`## Verify N회째 — PASS` 제목을 읽지 못했다 | 0326 7회 · 0328 2회 `명시 없음` | **A**(도구) — 판정 줄·회차 제목 패턴 추가. 같은 회차에 다른 판정이 적히면 `혼재`로 `특정 불가` |
| 3 | `--list`는 커밋 판정만, 요약은 원판정⇒유효를 내 같은 회차가 달랐다 · 리베이스 사본 사슬이 회차를 하나 더 셌다 | 0262 9회째 `FAIL` ↔ `FAIL⇒CLOSED` · 0295 | **A**(도구) — `--list`가 요약과 같은 값·회차별 대조를 낸다. 같은 변경 = 제목·트리·부모 트리(내용 불변 커밋은 부모 SHA까지) |

## Tier

**Tier 1(도구 판정 의미).** 지침 문장 변경 0 — 핵심 지침 bytes 불변(184,264). 6-A 대상 지침 파일 없음.

## 6-B Historical Failure Regression

- `--pset`(기준 `ac6614d9`): P 71 → 71, 변화 없음. **COVERED 71**. 강화: **P39·P40**(템플릿·제목 판정을 회차별 대조) · **P41**(잘못된 원장이 미종결을 줄이지 못함).

| handoff | 원문 근거 | 수정 전(`ac6614d9`) | 수정 후 |
|---|---|---|---|
| 0262 | `# r9 종료` `판정: **CLOSED**` · 커밋 `108429de`·`88f76e97` | 요약 `FAIL⇒CLOSED` ↔ `--list 37` `FAIL` | 둘 다 `FAIL⇒CLOSED · 일치` |
| 0326 | `# Verify 2회째 (r2)`~`7회째 (r7)` · 각 메타 `\| 상태 \| **…** \|` | 7회 · `명시 없음` · 회차별 대조 안 함 | `FAIL → FAIL → RTP → RTP → RTP → FAIL → PASS` · 일치 · 일치 |
| 0327 | round 53 근거 | `RTP → RTP → FAIL → FAIL → PASS` · 일치 | 같음 |
| 0328 | `## Verify 2회째 — PASS (기계 범위)` · `## Verify 1회째 — RETURN_TO_PLAN` | 2회 · `명시 없음` | `RETURN_TO_PLAN → PASS` · 일치 · 일치 |
| 0329 | 원장 4개 · `**정정 판정: RETURN_TO_PLAN.**` | F 9→11→3 | `FAIL → RTP → FAIL⇒RTP` · F 9→11→3 · 이력 `원 F 1 → 정정 49 F 3` |
| 0263 · 0264 · 0294 | round 52·53 근거 | `RTP → PASS` · `FAIL → PASS` · 7회 | 같음 · 0294 같은 변경 `1e8e0486` |
| 0295 | 설계 `12b500d9`→구현 `d43ca43f`→검증 `df435c3d`와 트리가 같은 사본 `91fb6713`→`1dd32572`→`63d698b0`(부모 SHA만 다름) | 2회 `PASS → PASS` | 1회 `PASS` · 같은 변경 `63d698b0` |
| 전체 | — | 회차 450(handoff 278) · 회차 수 일치 54 · 명시 없음 211 · 복원 불가 13 · 회차별 일치 301 · 특정 불가 40 | 회차 **449**(handoff 278) · 판정 불명 4 · 회차 수 일치 56 · 명시 없음 209 · 복원 불가 13 · 회차별 일치 325 · 특정 불가 26 · 충돌 0 |
| round 24 · 49~53 | 절을 들인 커밋 | 24 7 · 24b 2 · 각 0 | 같음 |

- **450 → 449 재현**: `git checkout --detach ac6614d9 && python3 .agents/skills/handoff-review/scripts/review_metrics.py | head -1`(git 2.43.0 · Python 3) → `450(handoff 278)`. 차이 1회는 0295의 리베이스 사본 사슬이다. 피드백이 같은 SHA에서 얻은 **277 handoff는 이 환경에서 재현하지 못했다** — CRLF 체크아웃을 흉내 내도 같고, git 2.43과 2.50의 `trailer.c` 구분자 판정도 같다. 회차가 하나뿐이고 trailer 블록에 `Key: value`가 아닌 줄(끝의 세션 URL)이 섞인 handoff는 0023(`0ef2291a`) 하나라, 그 블록을 trailer로 읽지 않는 환경이면 정확히 회차 1·handoff 1이 빠진다. 두 환경의 `--rounds` 출력을 diff하면 어긋난 회차가 바로 나온다.
- 메타 표의 `| 라운드 | N |`을 회차 수로 세면 복원 불가가 13 → 30이 된다. 늘어난 17개는 덮어쓴 문서의 낡은 값(0060: 메타 1 ↔ 커밋 4)·plan 라운드(0188: 메타 10 ↔ 커밋 1)라 회차 수로 쓰지 않는다. 회차 하나짜리 템플릿 문서는 `명시 없음 · 일치`로 대조된다.
- **시나리오 replay(테스트 46개 = 기존 38 + 신규 8)**: 어긋난 `닫힘` 행 뒤 빈 원장이 F·이력 모두 `판정 불가`, 유효한 종결이 나온 회차부터 재개 · 빈 줄로 떨어진 행 ↔ 실제 빈 원장 · 템플릿 판정(굵게 없음) · 템플릿 메타와 결론의 판정 혼재 · 대문자 `Verify N회째` 제목과 제목 속 판정 · `--list`와 요약이 같은 판정 · 리베이스 사본 사슬 1회 · 낡은 메타 라운드는 회차 수가 아님 · `--rounds`. 같은 테스트를 `ac6614d9` 스크립트에 돌리면 10개 실패(바뀐 출력 형식 2 포함).

## 6-C Cross-document Consistency

- `review_metrics.py` 머리말(템플릿 판정 줄 · 메타 라운드 제외 · 어긋난 행 · 떨어진 행 · `--list`·`--rounds`) = 동작 = 테스트. verify SKILL §11 원장 정의·verify 템플릿 메타와 충돌 없음. 지침 문서 변경 0.
- `test_review_scripts.py` 46/46 · `site_census.test.mjs` 5/5.

## 효과 지표

- 앞 라운드(49~53) 변경의 적용 기회: 그 뒤 verify 회차 0 → **적용 기회 없음**. 이번 이슈 A 3 · B 0.

## 남은 한계

- 277 handoff 환경 차이는 원인을 확정하지 못했다(위 재현 기록).
- 회차 제목이 없는 여러 회차 문서(명시 없음 209 handoff)는 회차별 판정을 대조하지 않는다.
- 특정 불가 26회차는 판정 줄이 알려진 형식이 아니거나 한 절에 다른 판정이 함께 적힌 경우다 — 일치로 세지 않는다.
