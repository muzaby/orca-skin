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
| `handoff-verify/SKILL.md §8` | `### 자기 게이트 실행도 §4의 대상이다` 신설 — exit code ≠ 실행 증거(관측 산출을 적는다) · 게이트의 트리 변형 확인 · 자기 명령의 잔여물. **§4 를 새 적용면으로 확장**하는 형태라 §4 본문은 건드리지 않는다 | REPLACE(기존 원칙의 적용 범위 확장) |
| `handoff-verify/verify.template.md` §9 | 필수 항목 3개 추가 — 관측한 실행 산출 · 트리 변형 여부 · 잔여물 | template 필수 필드 |
| `app/AGENTS.md` ABI 가이드 | `lint`/`format` 이 `--fix` 라 **파일을 쓴다**, `typecheck` 만 읽기 전용이라는 사실 1클로즈 추가 | 사실 보완(subtree gate SSOT) |

## Tier 판정

**Tier 1** — gate evidence semantics 변경 + template 필수 필드 추가 + 질의 발동 조건 신설. 셋 다 normative behavior 다.

## 세 축

| 축 | 결과 |
|---|---|
| **6-A Operational Instruction Delta** | **DELETE 0.** `docs/handoff/AGENTS.md §2 구현` 은 기존 5불릿과 `#### 구현 게이트의 정본` 을 **그대로 두고** 그 앞에 소절을 추가했다(KEEP + 추가) — 게이트 정본 규칙(subtree AGENTS)은 무변경. §외부 리뷰 절도 기존 4불릿 KEEP + 1추가. verify SKILL 은 §0~§7·§9~§11 heading·본문 무변경, §8 은 기존 5불릿·하위 AGENTS 우선 규칙을 둔 채 하위 절만 추가. template §9 는 기존 3항목 KEEP + 3항목 추가. `app/AGENTS.md` 는 ABI-중립 주장을 유지하고(참이다) 파일 쓰기 사실만 병기 — **게이트 명령 자체는 하나도 바뀌지 않았다** |
| **6-B Historical Failure Regression** | P1~P37 전수 재대조 — **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE**. 이번 변경은 방어를 추가만 하고 각 P 의 방어 지점(plan 조사·AC 규칙, verify §2 역방향·§4 proxy·§6 매트릭스)을 **한 문장도 삭제·약화하지 않는다**. 강화 3건 — **P4·P20**(대표 샘플만 보고 소비처 누락 / 등록값 소비처 누락): 지금까지 *설계·검증* 축에만 있던 "전수" 요구가 **구현 턴에도** 생겼다. **P37**(structural proxy): "실제 관측 주체에서 센다" 가 검증자 자신의 게이트 출력까지 적용된다. **P7**(저장소 기존 규칙 미독): subtree AGENTS 가 lint 의 쓰기 부작용을 명시한다. **신규 P38 추가**(발견 1 의 대표 evidence) — corpus 말미에 append 해 P1~P37 의 line offset 을 보존했다(`0173/plan.md` 의 `:541-552` → P29 착지 유지, 실측) |
| **6-C Cross-document Consistency** | root `AGENTS.md`(플로우·정본 위임) ↔ `docs/handoff/AGENTS.md`(신설 2곳) ↔ 세 SKILL ↔ `verify.template.md §9` ↔ `app/AGENTS.md` ↔ `.github/workflows/ci.yml` — **충돌 0**. **owner 중복 여부를 특히 봤다**: 새 impl 규칙(전수 적용 + 개수 보고)과 verify §2(전수 **확인**)는 같은 축의 **서로 다른 주체**다 — 구현자가 닫고 검증자가 다시 센다. 한쪽이 다른 쪽을 면제하지 않으며, verify 는 impl 의 개수 보고를 증거로 받지 않는다(§4 자기보고 금지 유지). 새 질의 조항은 root 의 "사용자 지시 우선" 과 충돌하지 않는다(묻고 따르는 것이지 거부가 아니다). `Handoff: none` 카브아웃과 무관 |

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
