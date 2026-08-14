# PR #333 handoff-review 개편 비판 검토 — 2라운드

- 일자: 2026-08-14
- 대상: PR #333 `refactor(handoff): review 스킬과 다중 턴 설계 지침 추가`
- 목적: 1라운드 검토 원문을 보존하고, 저장소 실물 대조 결과와 2라운드 보완 내용을 한 문서에 남긴다.

# 1. 1라운드 검토 원문

> 아래는 사용자에게 전달된 외부 검토 원문이다. 표현상 과장/오류가 있는 부분도 **원문 그대로** 보존하고, 다음 절에서 별도로 판정한다.

---

검토를 마쳤다. 사용자 결정대로 **수정은 하지 않고 보고만** 한다. 전체 근거는 `/root/.claude/plans/root-claude-uploads-8cb57df3-258a-50ea-inherited-seahorse.md` 에 남겼다.

## 1. 첨부에서 사용자가 원한 것

기록은 "무엇을 만들었나" 지만 그 밑의 요구는 넷이다.

| 요구 | 수단 |
|---|---|
| R1 여러 턴 확정 결정의 소실·재해석 차단 | Decision Ledger (ACTIVE/SUPERSEDED/OPEN + provenance) |
| R2 **사용자 변심**과 **에이전트 수행 실패**를 구분 | review 의 A~F 분류, D 는 학습 금지 |
| R3 기술 설계가 제품 동작을 암묵적으로 바꾸지 못하게 | plan 을 Part I / Part II 2층으로 |
| R4 사례만 쌓이고 지침은 안 고쳐지는 구조 차단 | failure-patterns 를 review 소유 corpus 로 격하 |

핵심은 **R2** 다. 기존 체계에 대응물이 아예 없던 축이고, 62KB 로 부푼 corpus 를 보면 R4 도 실증된 문제다.

## 2. 총평 — 방향은 옳고, 착지에 구멍

되돌릴 것은 없다. 문제는 **새 지침을 넣은 만큼 기존 운영 지식을 소리 없이 지웠고, 그 삭제를 잡을 게이트가 이번 개편엔 없었다**는 것이다.

## 3. 하드한 모순 6건

**F1 · 루트 `AGENTS.md:59` 가 개편 전 사실을 말한다** — "새 실패를 발견하면 `handoff-plan/references/failure-patterns.md` 에 더한다". 새 체계가 **명시적으로 금지한 행동**이고, `handoff-review` 는 목록에 없다. 루트 AGENTS.md 는 모든 세션의 진입점이라 R4 가 진입점에서 무효화된다.

**F2 · `failure-patterns.md:1-14` 헤더가 자기를 지침집이라 선언** — "SKILL 관문에서 막히면 원문을 읽어라", "이 파일이 저장소의 설계 실패 축적 지점이다". `handoff-review/SKILL.md:21` 이 이 모순을 **알면서 각주로 덮었다**("역사적 안내가 남아 있을 수 있다"). 8줄 고치면 될 일을 orca 규칙 1·5 위반으로 남겼다.

**F3 · verify 게이트가 `app/AGENTS.md` 와 충돌 (실환경 파손)** — `verify.template.md:110` 이 `npm test` 를 게이트로 제시한다. `app/AGENTS.md:124-126` 은 정반대다: `npm test` 는 `pretest` 로 ABI 를 Node 로 뒤집고, egress 차단 환경에선 그 다음 build 가 403 으로 깨진다. 구 verify SKILL §4 는 이걸 실패 서명까지 담아 정확히 경고했는데 **개편이 지웠고**, 새 SKILL 은 `app/AGENTS.md` 링크조차 없다. 이번 개편의 가장 실질적인 회귀다.

**F4 · 삭제된 검증 장치 3종이 승계처 없음** — `검증 책임 분리 정본 표`(13행), `위생 검토(AGENTS.md 변경 시)`, `INDEX 보드 정합성`. 특히 위생 검토 삭제는 **이번 개편 자체가 그 부재를 실증한다** — AGENTS.md 3개를 고치며 루트를 놓친 F1 이 정확히 그 섹션이 잡던 누락이다.

**F5 · `docs/handoff/AGENTS.md` 에서 구현 게이트 명령이 통째로 사라졌고**, 카브아웃의 `애매하면 핸드오프 생성` tie-breaker 도 삭제됐다. 루트엔 남아 있어 두 문서가 갈리는데, 규칙 6 상 **느슨한 쪽이 우선**한다. 개편 커밋 자신이 그 카브아웃으로 절차를 건너뛴 점을 보면 이해충돌 소지가 있다.

**F6 · 고아** — `handoff-verify/references/0157-case.md` 는 전수 grep 상 **어디서도 참조되지 않는다**. `scan-surface.sh` 3종 출력의 오탐 판정 기준이 거기에만 남았는데 링크가 끊겼다.

## 4. 방법론 비판 — regression gate 가 자기 삭제를 못 잡는다

자기 채점 **COVERED 37 / PARTIAL 0 / GAP 0**.

- corpus 자신이 자기 검증 편향을 반복 경고하고(0117·0123), 0168 은 **16기준 전부 통과 + scan-surface 무반응 상태에서** 두 번째 패스로만 결함이 나온 사례다. 같은 에이전트의 만점 자기 채점은 그 자체로 신호다.
- 더 중요한 것: **F3·F4·F5 는 P 코퍼스에 원리적으로 안 잡힌다.** corpus 는 *설계 실패* 사례집이고 삭제된 건 *운영 지침*이다. "SKILL 변경 → P 전수 대조" 는 추가·약화는 봐도 **삭제는 못 본다**. 아이러니하게 `d88b33d` 가 plan.template 에 넣은 **AS-IS → TO-BE Delta** 가 바로 그 장치인데, 개편 자체는 `Handoff: none` 으로 그 절차를 안 밟았다.

## 5. 부수 확인

- `check-doc-inventory` CI **통과** — `PROSE_EXCLUDED` 가 `.agents` prefix 를 통째로 제외한다(`check-doc-inventory.mjs:236`). 실행 결과 diff 0.
- 커밋 `c96a1cb` 의 `Agent: chatgpt` 는 `docs/git-template.md:60` 허용값(`codex|claude`) 위반.
- 진행 중 9건은 전부 구식 포맷(Part I·Ledger 없음). **신규부터 적용** 결정이므로 남은 일은 `docs/handoff/AGENTS.md` 에 경계 한 줄 명시뿐이다.

## 6. 유지할 것

Decision Ledger(P10·P34 방어), 사용자 변심 비학습, Part I/II 분리, verify §0 **기준선 고정**(P24 를 절차로 차단 — 기존에 없던 방어), plan SKILL 이 오히려 24.8KB→16.5KB 로 줄어든 것("추가보다 교체" 원칙을 실제로 지킴), 그리고 AS-IS→TO-BE Delta 표.

---

권고 조치 8건은 우선순위·대상 파일·검증 방법까지 계획 파일에 정리해 뒀다. 1~3번(루트 AGENTS.md · corpus 헤더 · ABI 게이트)이 다음 세션의 행동을 실제로 틀리게 만드는 것들이라 먼저다. 실행을 원하면 말해 달라 — 전부 `Handoff: none` 카브아웃 범위의 문서 수정이다.

---

# 2. 2라운드 비판적 판정

전체 결론은 **채택**이다. PR #333의 방향을 되돌릴 이유는 없지만 1라운드 상태 그대로 merge할 수는 없었다. 다만 F1~F6의 표현을 그대로 새 규칙 여섯 개로 승격하지 않고, 실제 원인을 더 일반적인 지침 변경 회귀 문제로 묶었다.

| 항목 | 2라운드 판정 | 설명 |
|---|---|---|
| F1 root AGENTS stale | **유효 / High** | 실제 진입점이 옛 corpus 소유권을 지시했다. 단 하위 `docs/handoff/AGENTS.md`를 읽은 경우 더 구체적 규칙이 우선하므로 “새 체계 전체 무효”까지는 과장이다. |
| F2 corpus 헤더 stale | **유효 / High** | historical corpus 본문을 보존하는 것과 옛 실행 명령을 현재 헤더에 남기는 것은 별개다. 현재 정책 entrypoint와 역사 본문을 분리해야 한다. |
| F3 ABI gate | **유효 / Critical** | 새 verify SKILL에 환경 실패 일반론은 남아 있었지만, 안전한 구체 명령과 `app/AGENTS.md` 연결이 사라지고 template이 generic `npm test`를 제시했다. 실환경 회귀다. |
| F4 검증 장치 삭제 | **대체로 유효 / High** | 사람-vs-agent 원칙은 압축 승계됐지만 위생/INDEX 등 실행 가능한 체크가 소실됐다. |
| F5 gate/tie-breaker | **부분 유효 / Medium~High** | tie-breaker 소실은 맞다. 그러나 root 규칙 6은 “느슨한 쪽”이 아니라 **더 구체적 하위 AGENTS 우선**이다. 구현 gate는 handoff 문서에 복제하기보다 target subtree AGENTS를 SSOT로 두는 편이 낫다. |
| F6 0157-case 고아 | **유효 / Medium** | 규칙 자체는 SKILL에 남아 있어 즉시 기능 파손은 아니지만, 왜 그 역방향 검사가 존재하는지 보여주는 evidence 연결이 끊겼다. |

## 핵심 방법론 결함

1라운드의 `P1~P37 = 37/37 COVERED`는 거짓 수치는 아니지만 **Historical Failure Regression만 측정**했다. 이를 “전체 skill 회귀 없음”처럼 사용한 것이 잘못이다.

지침 리팩터링에는 다음 세 축이 독립적으로 필요하다.

```text
A. Operational Instruction Delta
   변경 전 실행 책임/명령/게이트/reference
       → KEEP / MOVE / REPLACE / DELETE

B. Historical Failure Regression
   failure-patterns P*
       → causal lesson
       → COVERED / PARTIAL / GAP / OBSOLETE

C. Cross-document Consistency
   root AGENTS
       ↕ docs/handoff AGENTS
       ↕ plan/verify/review SKILL
       ↕ templates
       ↕ references/scripts
       ↕ target subtree AGENTS
```

A는 **삭제 회귀**, B는 **과거 실패 재발**, C는 **정본 간 모순/고아**를 잡는다. 어느 하나도 다른 검사를 대체하지 않는다.

# 3. 2라운드 적용 내용

## F1 — root AGENTS 정합화

- `handoff-review`를 handoff 지침 개선 정본으로 root 진입점에 추가했다.
- plan/verify가 정상 실행 중 failure corpus를 직접 갱신하지 않는다고 명시했다.
- handoff 인프라 메타 수정은 `Handoff: none`을 사용할 수 있지만 **review 3축 회귀 검증은 생략할 수 없도록** 했다.

## F2 — corpus 정책과 역사 본문 분리

기존 62KB 본문을 삭제하지 않는다.

```text
failure-patterns.md
  = 현재 정책을 설명하는 작은 review entrypoint

failure-patterns.corpus.md
  = 기존 P1~P37 원문 historical evidence
```

따라서 과거 사례는 보존하면서 옛 “plan이 직접 읽고 새 실패를 append” 명령은 현재 정본에서 제거된다.

## F3 — ABI-safe gate 복구

plan/verify template이 더 이상 모든 app 작업에 `npm test`를 기본 명령으로 지정하지 않는다.

- **명령 정본 = 수정 subtree의 가장 구체적인 `AGENTS.md`**.
- `app/**`라면 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`를 먼저 읽는다.
- 현재 app 기본: `npm run lint && npm run typecheck`.
- 비-DB/순수 suite: `./node_modules/.bin/vitest run <suite>` 등 direct runner.
- `npm test`: DB 동작 자체가 필요할 때만 의도적으로 실행.
- Node ABI 전환 후 dev/build Electron rebuild와 egress 403 위험을 verify SKILL에 다시 명시했다.

이렇게 하면 app 규칙이 미래에 바뀌어도 template의 복제 문장이 정본을 덮어쓰지 않는다.

## F4 — 검증 운영 체크 복구

`handoff-verify/SKILL.md`와 `verify.template.md`에 다음을 다시 1급 검증 대상으로 둔다.

- agent vs human 책임 분리.
- AGENTS 위생 및 부모/자식 규칙 충돌.
- 새 AGENTS의 CLAUDE stub/root 표 필요 여부.
- INDEX 상태/다음 주체/commit/archive 정합성.
- commit trailer 허용값.
- 이동/삭제 reference/script의 소비자.

## F5 — 카브아웃과 gate 소유권 명확화

- `애매하면 handoff 생성`을 복구했다.
- meta `Handoff: none`은 자기참조를 피하기 위한 **문서 생성 카브아웃**일 뿐 review 면제가 아니라고 명시했다.
- 구현 gate 명령은 `docs/handoff/AGENTS.md`가 자체 복제하지 않고 target subtree AGENTS를 SSOT로 사용한다.

## F6 — 0157 case 연결 복구

`handoff-verify`의 역방향 탐색 절과 verify template이 `references/0157-case.md`를 대표 evidence로 직접 가리킨다.

# 4. 신규 템플릿 적용 경계

진행 중 legacy handoff를 형식 때문에 일괄 재작성하지 않는다.

- 신규 handoff → Part I/II + Decision Ledger + Technical Design AS-IS/TO-BE 사용.
- 기존 plan을 제품 결정/기술 설계 때문에 실질적으로 다시 쓰는 경우 → 새 구조로 승격 가능.
- verify/FAIL 파생 이슈만 추가하는 경우 → 기존 plan 상단을 형식 때문에 재작성하지 않음.

# 5. 회귀 결과

| 축 | 결과 |
|---|---|
| Operational Instruction Delta | F1~F6 **6/6 CLOSED** |
| Historical Failure Regression | P1~P37 **37 COVERED / 0 PARTIAL / 0 GAP / 0 OBSOLETE** |
| Cross-document Consistency | root/handoff/SKILL/template/reference/target AGENTS **PASS** |

`check-doc-inventory`는 `.agents`를 스캔에서 제외하므로 이 판정의 증거로 사용하지 않는다.

# 6. 남긴 한계와 의도적 비조치

- `c96a1cb`의 `Agent: chatgpt`는 기존 공개 커밋의 규약 위반으로 남아 있다. 이를 고치기 위해 PR branch history를 force-rewrite하지 않는다. **2라운드 이후 새 커밋부터 `Agent: claude`를 사용**한다.
- historical corpus 자체의 오래된 서술은 evidence로 보존한다. 현재 정책은 entrypoint/SKILL/AGENTS가 우선한다.
- 1라운드에서 유효했던 Decision Ledger, 사용자 변심 비학습, Product/UX→Technical Design, plan 기준선 고정, AS-IS→TO-BE Delta는 그대로 유지한다.

# 7. 최종 판정

PR #333의 방향은 유지한다. 2라운드에서 보완한 핵심은 F1~F6을 사례별 체크리스트로 늘리는 것이 아니라 다음 일반 불변식이다.

> **handoff 지침을 변경할 때는 과거 실패사례 coverage뿐 아니라, 변경 전 운영지식이 TO-BE에서 어디로 승계됐는지와 모든 정본의 명령이 서로 일치하는지를 함께 증명해야 한다.**

이 불변식이 지켜져야 `handoff-review`가 “사례를 더 쌓는 장치”가 아니라 실제로 plan/verify 지침을 지속적으로 개선하는 메타 스킬이 된다.
