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
