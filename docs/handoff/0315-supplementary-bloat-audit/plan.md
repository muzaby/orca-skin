# Plan — 0315-supplementary-bloat-audit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0315-supplementary-bloat-audit` |
| 작성자 | Claude Code |
| 일자 | 2026-11-12 |
| 매핑 | 사용자 `/handoff-plan` — 0305 감사가 판정하지 않은 영역의 보완 감사. 감사만 하고 구현은 하지 않는다 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0305의 V를 상속하지 않는다. 0305에서 가져오는 것은 과잉 범주·렌즈 어휘뿐이다(§8) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 기준 커밋 | `c1af29f` (`git cat-file -t` = commit · `git merge-base --is-ancestor c1af29f origin/main` 성공) |

## 0. 작성 경로

- 판정: 조사는 설계자가 직접 했다. 서브·백그라운드 에이전트는 쓰지 않았다(D-011).
- 이 plan은 감사 수행 지시서다. `app/**`·`.github/**` 변경은 이번 handoff 전체에 없다(AC8).
- 아래에서 `…` = `docs/handoff/0315-supplementary-bloat-audit`, `R/` = `app/src/renderer/src/features/chat/`, `M/` = `app/src/main/`.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0305 감사는 대상 5곳을 과잉 범주 X1~X7로만 봤고 일부는 본문을 읽지 않았다(§4). 한 파일 안 또는 main↔renderer에 같은 판정·조립이 두 벌 있는지는 0305의 렌즈에 없었다.
- 0305 계열 후보 39건 중 16건이 구현 없이 Decision으로 닫혔다(`0314 ledger.md` 합계 줄). 닫힌 이유는 경쟁 가드·잠금 테스트·채택 규칙이었고, 후보를 올릴 때 확인하지 않아 후속 handoff가 설계 턴을 쓰고서야 드러났다.
- 완료 후 달라지는 것: 사용자가 **대상 6구간의 범주·렌즈 판정 · 판정 단위별 L6 판정 · 전제 확인 근거가 붙은 후보 목록 · 중단 규칙에 넣을 값**이 든 감사 문서 한 편을 받는다.
- 성공 한 문장: **verify가 감사 문서의 값만으로 중단 규칙(종료 / 구현 1건 / 구현 묶음 + 넓은 감사)을 판정할 수 있다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "0305 감사가 읽지 못한 영역의 보완감사 handoff를 만들어 plan을 작성하라" | 턴 1 |
| 명시 요구 | "대상은 chatReducer의 RECV_EVEVT•LOAD_SESSION 본문, chatStore 이벤트 라우팅, adapters/opencode/vq/session-context.ts, features/auth/store.ts, adapters/claudr/map.ts다" | 턴 1 |
| 명시 요구 | "0305 과잉 범주에 x8(한 함수•파일에 물린 책임)을, 렌즈에 L6(같은 판정•조립이 한 파일 안 또는 main<->renderer에 두 번 이상)을 더해라" | 턴 1 |
| 명시 요구 | "후보마다 세 가지 전제 확인 근거를 필수 칸으로 붙여라: 사이에 낀 await 경쟁 가드, 그 형태를 잠그는 테스트•가드, agents 채택 규칙" | 턴 1 |
| 명시 요구 | "감사만 하고 두현은 하지 앙ㅎ는다. 테스트• script•ci•sdk 층 mock 대상이 아니다" | 턴 1 |
| 명시 요구 | "조건은 ui 회귀 금지, 성능 최소 동등, 구조적 중복을 하나로 얻는 감량. 그러나 구조적 구현/모듈화는 최대한 보존. 이는 막무가내 코드 제거를 지향하지 않는다." | 턴 1 |
| 명시 요구 | "Verify 에서 중단 규칙을 판정해라: 통과 후보 0건이면 종료. 모듀 소형(감량 30줄 미만)이면 구현 1건, 핫패스에서 구조적 중복이 나오면 구현 묶음과 넓은 감사를 연다" | 턴 1 |
| 추론 의도 | 경로 표기 `vq` → `v1`, `claudr` → `claude`, `두현` → 구현. 실재 경로는 `M/adapters/opencode/v1/session-context.ts` · `M/adapters/claude/map.ts`뿐이다 | `git ls-files app/src \| grep session-context` → `v1/` 2건(본체·테스트) |
| 추론 의도 | "이벤트 라우팅"은 `ingestChatEvent` 진입부터 reducer dispatch까지의 함수 묶음이다(§8 구간 A3) | `chatStore.ts:349·543·698·998` |
| 추론 의도 | "통과 후보"는 세 전제가 모두 걸리지 않고 조건(UI·성능)을 만족하는 후보다(D-008) | 요구 문장의 "전제 확인" + "조건은" |
| 추론 의도 | "핫패스"는 스트림 이벤트·SDK 메시지 1건마다 실행되는 경로다(D-009) | 대상 5곳 중 4곳이 이벤트 변환·반영 경로 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0315는 보완 감사만 한다. 제품·CI 코드를 바꾸지 않는다 | "감사만 하고 두현은 하지 앙ㅎ는다" | 턴 1 | ACTIVE | — |
| D-002 | 감사 대상은 §8의 6구간(A1~A6)이다. 구간 밖 코드는 L6의 짝을 찾을 때만 읽는다 | "대상은 chatReducer의 RECV_EVEVT•LOAD_SESSION 본문, chatStore 이벤트 라우팅, …" | 턴 1 | ACTIVE | — |
| D-003 | 과잉 범주는 0305의 X1~X7에 X8(한 함수·파일에 물린 책임)을 더한 8개다 | "0305 과잉 범주에 x8(한 함수•파일에 물린 책임)을 … 더해라" | 턴 1 | ACTIVE | — |
| D-004 | 렌즈는 0305의 L1·L4·L5에 L6(같은 판정·조립이 한 파일 안 또는 main↔renderer에 두 번 이상)을 더한 4개다 | "렌즈에 L6(…)을 더해라" | 턴 1 | ACTIVE | — |
| D-005 | 후보마다 전제 확인 근거 3칸이 필수다 — 사이에 낀 await 경쟁 가드 · 그 형태를 잠그는 테스트·가드 · AGENTS 채택 규칙 | "후보마다 세 가지 전제 확인 근거를 필수 칸으로 붙여라" | 턴 1 | ACTIVE | — |
| D-006 | 테스트 · script · CI · SDK 층 mock은 감사 대상이 아니다. 후보의 자리로 올리지 않는다 | "테스트• script•ci•sdk 층 mock 대상이 아니다" · INDEX 후보 표 0314 행 "0305 계열 제외" | 턴 1 | ACTIVE | — |
| D-007 | 후보의 조건은 UI 회귀 금지 · 성능 최소 동등 · 구조적 중복을 하나로 합쳐 얻는 감량이다. 구조적 구현·모듈화는 최대한 보존한다 | "그러나 구조적 구현/모듈화는 최대한 보존. 이는 막무가내 코드 제거를 지향하지 않는다." | 턴 1 | ACTIVE | — |
| D-008 | 통과 후보 = 전제 3칸이 모두 `clear`이고 UI `safe` · 성능 `equal_or_better`이며 감량이 1줄 이상인 후보 | 설계자 해석 — "전제 확인"과 "조건은"을 통과의 정의로 묶었다 | §2 추론 행 | ACTIVE | — |
| D-009 | 핫패스 = §10 EP-07의 진입 심볼 6개에서 닿는 자리. 스트림 이벤트·SDK 메시지 1건마다 실행된다 | 설계자 해석 | §2 추론 행 | ACTIVE | — |
| D-010 | 중단 규칙은 verify가 판정한다. 통과 후보 0건 → 종료 · 통과 후보가 모두 30줄 미만 → 구현 1건 · 핫패스에서 구조적 중복(L6) 통과 후보가 나옴 → 구현 묶음 + 넓은 감사 | "Verify 에서 중단 규칙을 판정해라: …" | 턴 1 | ACTIVE | — |
| D-011 | 서브·백그라운드 에이전트를 쓰지 않는다 | 0305 D-006 "토큰이 금장 소모되어 에이전트 작업이 중단, 컨텍스트를 소실한다" — 같은 계열 감사라 승계 | 0305 plan §3 | ACTIVE | — |
| D-012 | 사용자가 정하지 않은 두 조합은 verify가 자동 판정하지 않고 `사용자 결정`으로 올린다 — (가) 핫패스 L6 통과 후보가 있는데 통과 후보가 모두 30줄 미만 (나) 핫패스 L6 통과 후보가 없는데 30줄 이상 통과 후보가 있음 | 요구 문장의 세 갈래가 이 두 조합을 덮지 않는다 | 턴 1 문장 대조 | OPEN | 사용자 답으로 닫는다 |
| D-013 | 구현(감사 수행) 주체는 Claude다 | 비기능 작업은 Claude가 직접 수행 | root `AGENTS.md` 협업 워크플로우 | ACTIVE | — |
| D-014 | `remove` 유형 후보는 사용자 승인 목록에 올린다. 감사가 제거를 결정하지 않는다 | "막무가내 코드 제거를 지향하지 않는다" · 0305 D-005 승계 | 턴 1 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014 (신규 handoff).
- 변경된 결정: 없음.
- OPEN: D-012. 감사 수행을 막지 않는다 — 두 조합에서 규칙이 `사용자 결정`을 내도록 fail-closed로 설계했다(§10 EP-06).
- `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-001 ↔ AC8 · D-002 ↔ AC1·AC2 · D-003·D-004 ↔ AC1·AC2 · D-005 ↔ AC4 · D-006 ↔ AC6 · D-007·D-008 ↔ AC5 · D-009 ↔ AC3(`hotEntry`) · D-010·D-012 ↔ AC7 · D-014 ↔ AC3(`approval`) · D-011·D-013 ↔ §19.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 0305 닫힘 16건의 이유가 전제 3칸과 같은 축이다 — 예: C-22 "8조건 유효성 검사"는 0309 D-010이 닫았다(`0314 ledger.md` 표 A) |
| "0305가 읽지 못한 영역"이 사실인가 | 전제 정정 — 일부는 읽었다 | `0305 deep.json`: `chatStore.ts` "파일 전부 읽음" · `chatReducer.ts` "`LOAD_SESSION` 1444-1605" 읽음 · `map.ts` "개요 + 373-470 + 470-900 제어 흐름". 읽지 않은 것은 `RECV_EVENT` 본문 · `session-context.ts` · `features/auth/store.ts`(auth 버킷은 `login.ts`만)다 |
| 정정 뒤에도 6구간이 대상인가 | 타당 — 그대로 둔다 | 읽은 구간도 X8·L6으로 판정한 적이 없다(0305 범주는 X1~X7, 렌즈는 L1·L4·L5 — `0305 plan.md:315-329`). 사용자가 대상을 명시했다(D-002) |
| 이미 기존 코드가 충족하는가 | 해당 없음 | 산출은 문서다 |
| 더 작은 해법이 있는가 | 검사기 없이 표만 쓰는 방법은 채택하지 않았다 | "필수 칸"(D-005)과 판정 단위 전수는 사람이 눈으로 세면 빠진다. 0305가 같은 이유로 검사기를 뒀다(`0305 plan.md` EP-06) |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 | 구간 줄 번호·단위 수를 기준 커밋에서 다시 셌다(§8) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 없음 | 0314 D-008(0305 `audit.md`·`data/*.json` 불변)과 맞는다 — 0315는 자기 디렉토리에만 쓴다 |

- 사용자에게 올릴 결정: D-012(두 조합의 처리). 감사 수행과 병행한다.
- 코드 조사로 닫은 사실: 경로 오기 2건 · 0305가 실제로 읽은 범위 · 6구간의 줄 범위와 판정 단위 수.

## 5. 동작 / 사용자 흐름

```text
[impl 턴: 6구간을 전부 읽는다]
  → [구간마다 X1~X8 · L1 · L5 · L6 판정] → [판정 단위마다 L6 판정]
  → [후보마다 자리 · 보존 동작 · 감량 · 전제 3칸 · 조건 2칸]
  → [검사 green · audit.md 렌더]
  → [verify: 통과 후보의 근거 재현 → 중단 규칙 판정]
  ↘ [사용자: 판정과 후보를 보고 다음 handoff 여부 결정]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 감사 완료 · 통과 후보 0 | verify가 `종료`를 적는다 | 후속 handoff 없음 |
| 통과 후보가 모두 30줄 미만 · 핫패스 L6 통과 후보 없음 | verify가 `구현 1건`을 적는다 | 통과 후보 전부를 담는 구현 handoff 1개의 근거 |
| 핫패스 L6 통과 후보가 있고 30줄 이상 통과 후보가 있음 | verify가 `구현 묶음 + 넓은 감사`를 적는다 | 구현 handoff 묶음과 범위를 넓힌 감사 handoff의 근거 |
| D-012의 두 조합 | verify가 `사용자 결정`을 적고 해당 값을 보인다 | 사용자가 갈래를 고른다 |
| 검사 red | 다음 단계로 넘어가지 않는다 | 감사 미완 — INDEX가 `impl/IN_PROGRESS` |

### 파생 UX / 엣지케이스

- 후보 0건: 유효한 결과다. 구간·단위 판정은 그대로 전부 남는다.
- 통과하지 못한 후보: 목록에 남고 걸린 전제를 보인다. 삭제하지 않는다.
- 후속 handoff 생성: 이번 handoff가 만들지 않는다. verify 판정 뒤 사용자 확인(AC10)을 거쳐 다음 설계 턴이 find-or-create 한다.

## 6. 범위 / 비범위

- **범위**: 6구간 감사 · 감사 데이터와 검사기 · `audit.md` · INDEX 갱신.
- **비범위**: `app/**`·`.github/**` 변경 · 후보 구현 · 0305 `audit.md`·`data/*.json` 수정 · 테스트·script·CI·SDK 층 mock의 과잉 판정(D-006) · 6구간 밖의 감사.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 후보 구현 | 아니오 | 중단 규칙 판정 뒤 후속 handoff |
| 6구간 밖 감사 | 아니오 | 중단 규칙이 `넓은 감사`를 낼 때만 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 6구간 각각이 X1~X8 · L1 · L5 · L6의 11칸 판정(후보 ID 목록 또는 `none`)과 근거를 가진다 | 검사 K1: 구간 집합 ≠ A1~A6 · 칸 누락 · 근거 빈 값이면 red | 기준 커밋의 6구간 → `audit.json` `areas` → 검사 |
| R-01 | AC2 | 6구간의 판정 단위 전부가 L6 판정(후보 ID 목록 또는 `none`)과 근거를 가진다 | 검사 K2: 기준 커밋에서 추출한 단위 집합과 `units` 집합의 양방향 차집합 = ∅ · 판정·근거 누락이면 red | `git show c1af29f:<파일>` → `extractUnits()` → `audit.json` `units` → 검사 |
| R-02 | AC3 | 후보 행은 필수 12칸을 모두 가진다(§10 EP-03) | 검사 K3·K4·K8·K9: 칸 누락·빈 값·미지 enum·미지 키 · 자리 미실재 · L6인데 자리 2 미만 · 구간 안 자리 0 · `remove`인데 승인 표시 없음이면 red | `audit.json` `candidates` → 검사 |
| R-02 | AC4 | 후보마다 전제 3칸(`raceGuard`·`formLock`·`agentsRule`)이 판정(`clear`/`blocks`)과 근거(명령+N 또는 `파일:줄`)를 가진다 | 검사 K5: 칸 3개 중 하나라도 없거나 판정이 enum 밖이거나 근거가 빈 값이면 red | `candidates[].premises` → 검사 |
| R-02 | AC5 | 후보마다 조건 2칸(UI·성능)의 판정과 근거, 보존하는 동작(`preserve`)과 보존하는 구조(`keepStructure`)가 있다 | 검사 K6: 칸 누락·enum 밖·빈 근거면 red | `candidates[].conditions` → 검사 |
| R-02 | AC6 | 어떤 후보의 자리도 테스트·script·CI·SDK 층 mock 파일이 아니다 | 검사 K4: 자리가 EP-08 제외 패턴 5개 중 하나에 걸리면 red | `candidates[].sites` → 검사 |
| R-02 | AC11 | 구간 판정 칸·단위 판정이 가리키는 후보가 실재하고 구간·렌즈·범주가 서로 맞으며, 모든 후보가 구간 칸 1곳 이상에서(L6 후보는 단위 1곳 이상에서도) 가리켜진다 | 검사 K7: 유령 ID · 구간 불일치 · 렌즈·범주 불일치 · 고아 후보면 red | `areas`·`units` ↔ `candidates` → 검사 |
| R-03 | AC7 | 중단 규칙 판정이 감사 데이터의 함수로 나온다 — `ruling(candidates)`가 EP-06의 다섯 갈래 중 하나를 낸다 | UT-03: 갈래마다 그 갈래로 가는 입력 1건 이상 → 기대 판정 · verify가 통과 후보 전부의 근거를 재현한 뒤 `--ruling` 출력을 `verify.md`에 적는다 | `candidates` → `ruling()` → `audit.md` `ruling` 블록 → verify |
| R-03 | AC10 | 사용자가 판정과 후보(승인 목록 포함)를 보고 다음 handoff 여부를 정한다 | 사람 — `audit.md` 열람 후 결정 | `audit.md` → 사용자 |
| R-04 | AC8 | 감사는 제품·CI 코드를 바꾸지 않는다 | `git diff --stat c1af29f..HEAD -- app .github` 출력 0줄 | git |
| R-05 | AC9 | `audit.md`의 생성 블록은 `audit.json`을 렌더한 결과와 같다 | 검사 K10: 생성 블록 ≠ 렌더 결과 · 필수 블록 누락이면 red | `audit.json` → `render()` → `audit.md` |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음. 검사기와 그 테스트는 이번에 만든다.
- 사람 실기 항목: AC10 하나. 판정 계산(AC7)은 순수 함수 UT로 내렸다.
- 총량/0건 기준: AC2의 "전부"는 양방향 차집합으로 본다(총계 일치가 아니다). AC8의 0줄은 부재 단언이라 대상 경로를 `app`·`.github`로 고정했다.
- structural proxy: AC1·AC2·AC4의 검사는 판정·근거의 **존재**만 잠근다. 판정의 옳고 그름은 verify의 표본 재현(VP-02·VP-03)과 선언 경계 2가 다룬다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 신규 handoff이고 상속할 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1·AC2 구간·단위 판정 전수 | NEW | — |
| R-02 | R | §7 AC3~AC6·AC11 후보·전제·조건·대상 제외·연결 | NEW | — |
| R-03 | R | §7 AC7·AC10 중단 규칙 판정 | NEW | — |
| R-04 | R | §7 AC8 무변경 | NEW | — |
| R-05 | R | §7 AC9 문서 = 데이터 | NEW | — |
| AT-01~AT-05 | AT | 위 R의 검증 수단 | NEW | — |
| AR-01 | AR | §9 `audit.json` → 렌더 → `audit.md` 사본 경계 | NEW | — |
| IT-01 | IT | 검사 K10 | NEW | — |
| MD-01 | MD | §10 EP-02 `extractUnits()` 추출 규칙 | NEW | — |
| MD-02 | MD | §10 EP-05 `check()` 규칙 K1~K10 | NEW | — |
| MD-03 | MD | §10 EP-06 `ruling()` 다섯 갈래 | NEW | — |
| UT-01~UT-03 | UT | `scan/check.test.mjs` | NEW | — |

SD 레벨은 두지 않는다 — end-to-end 상태·수명주기를 가진 실행 시스템이 없다(산출이 문서와 일회 실행 검사기다).

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 기준 커밋 6구간 → `extractUnits` → `audit.json` `areas`·`units` → K1·K2 | `gate:node …/scan/check.mjs --check` | required — 전수 주장. 변이: 구간 판정 칸 1개 삭제 · 단위 1행 삭제 · 없는 단위 1행 추가 → red | EP-01(66칸) · EP-02(136단위) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 감사 판단 → `candidates` → K3~K9 | 같은 gate | required — 구조 proxy. 변이: 전제 칸 1개 삭제 · 자리를 테스트 파일로 교체 · 유령 후보 ID 지목 → red. 검증자가 **통과 후보 전부**와 통과하지 못한 후보 최대 3건의 전제 근거 명령을 재실행해 N 일치를 본다 | EP-03(12칸) · EP-04(3칸) · EP-08(5패턴) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `candidates` → `ruling()` → `audit.md` `ruling` 블록 → `verify.md` 판정 | `scan/check.test.mjs` UT-03 · `gate:node …/scan/check.mjs --ruling` · 사람(AC10) | required — 판정이 데이터에 민감한지. 변이: 통과 후보 1건의 전제 1칸을 `blocks`로 뒤집기 → 판정 입력(통과 수) 변화. 검증자가 L6 `none` 단위 5개의 짝 검색을 재실행한다 | EP-06(5갈래) · EP-07(6심볼) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 작업 트리 → `git diff` | `gate:git diff --stat c1af29f..HEAD -- app .github` | not selected — 직접 관측 | 0 — 부재 단언이라 강제 자리 없음 |
| VP-05 | R-05 ↔ AT-05 · AR-01 ↔ IT-01 | REQUIRED | `audit.json` → `render()` → `audit.md` 생성 블록 | `gate:node …/scan/check.mjs --check`(K10) | required — 변이: 생성 블록 문자 1개 수정 · 블록 1개 삭제 → red | EP-09(사본 3곳) |
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | 파일 본문·구간 → `extractUnits()` → 단위 집합 | `scan/check.test.mjs` — EP-02 패턴 P1~P5 각각 1입력 + 구간 밖 줄 1입력 + 같은 이름 중복 1입력 | not selected — 행동 oracle | EP-02 패턴 5 + 규칙 2 |
| VP-07 | MD-02 ↔ UT-02 | REQUIRED | fixture 데이터 → `check()` → 위반 목록 | `scan/check.test.mjs` — K1~K10의 red 조건마다 1입력 + 전부 유효한 green 1 | not selected — 행동 oracle | EP-05(조건 40) |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | 후보 배열 → `ruling()` → 판정 | `scan/check.test.mjs` — EP-06 갈래마다 입력(표의 UT 입력 칸) | not selected — 행동 oracle | EP-06(5갈래 · 경계 2) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| 감사 검사 | 산출물의 완결성 | `node …/scan/check.mjs --check` | 이번 산출물 |
| 검사기 자체 테스트 | 검사 규칙·추출·판정의 민감도 | `node --test docs/handoff/0315-supplementary-bloat-audit/scan/*.test.mjs` | 이번 산출물 |
| 문서 가드 | `INDEX.md`는 링크 검사 대상이다(`check-doc-inventory.mjs` `isHistoricalHandoff` — 번호 디렉토리 안 문서는 제외) | `cd app && node scripts/check-doc-inventory.mjs --check` — 기준선에서 `links ok` 관측 | 이번 변경이 깬 링크만 |
| trailer 파싱 | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 이번 커밋 |
| 무변경 | D-001 | AC8 명령 | `app`·`.github` |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 0305 범주는 X1~X7, 렌즈는 L1·L4·L5다. X8·L6은 없다 | `docs/handoff/0305-code-bloat-audit/plan.md:315-329` |
| 0305가 `RECV_EVENT` 본문을 읽지 않았다 | `0305 deep.json` `renderer/features/chat/reducer` 근거: "상태·액션 정의 270-770, `LOAD_SESSION` 1444-1605, case 목록" |
| 0305가 `session-context.ts`를 읽지 않았다 | 같은 파일 `main/adapters/opencode` 근거: "`session-context.ts`·`server.ts` 는 읽지 않았다" |
| 0305가 `features/auth/store.ts`를 읽지 않았다 | 같은 파일 `main/features/auth`의 `read` = `login.ts` 1개 |
| 0305가 `map.ts`에 후보를 올리지 않은 이유는 "외부 프로토콜 변환"이다 | 같은 파일 `main/adapters/claude` 근거 |
| 대상 구간 중 `await`가 있는 곳은 `session-context.ts`뿐이다 | `grep -c await` → `session-context.ts` 10 · `map.ts` 0 · `auth/store.ts` 0 · `chatStore.ts` 349~1010줄 0 |
| renderer 이벤트 진입은 `chatApi.onEvent(ingestChatEvent)` 한 곳이다 | `chatStore.ts:2249` |
| `RECV_EVENT`를 dispatch하는 non-test 파일은 3개다 | `grep -rln "RECV_EVENT" renderer/src`(test 제외) → `chatReducer.ts` · `chatStore.ts` · `lib/parts.ts` |
| INDEX 후보 표의 0308 행이 `chatStore.ts`와 겹친다 — `sessionBusy` 소비처 3곳에 잠금 테스트가 없다 | `docs/handoff/INDEX.md` `## 새 handoff 후보` 0308 행 |
| 0308 행은 이번 범위로 승격하지 않는다 | 그 행의 대상은 테스트 부재이고 테스트는 감사 대상이 아니다(D-006). 전제 2칸(`formLock`)을 채울 때 입력으로 읽는다 |

### 전수 조사 — 감사 구간과 판정 단위

구간은 기준 커밋 `c1af29f`의 줄 번호로 고정한다.

| 구간 | 파일 | 줄 범위 | 줄 수 | 판정 단위 수 | 핫패스(D-009) |
|---|---|---|---:|---:|---|
| A1 | `R/reducer/chatReducer.ts` | 961-1329 (`RECV_EVENT`) | 369 | 20 | 예 |
| A2 | `R/reducer/chatReducer.ts` | 1454-1596 (`LOAD_SESSION`) | 143 | 1 | 아니오 |
| A3 | `R/store/chatStore.ts` | 349-380 · 470-644 · 698-1010 | 520 | 33 | 예 |
| A4 | `M/adapters/opencode/v1/session-context.ts` | 1-567 | 567 | 25 | 일부(`offer`·`startEvents`) |
| A5 | `M/features/auth/store.ts` | 1-517 | 517 | 25 | 아니오 |
| A6 | `M/adapters/claude/map.ts` | 1-1019 | 1,019 | 32 | 예 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 줄 수 합 369 + 143 + 520 + 567 + 517 + 1,019 = 3,135. 단위 수 합 20 + 1 + 33 + 25 + 25 + 32 = 136. 둘 다 이번 세션에서 EP-02 규칙을 옮긴 일회용 스크립트로 `git show c1af29f:<파일>`에 대해 셌다.
- 파일 전체 줄 수: `chatReducer.ts` 2,212 · `chatStore.ts` 2,475 · `session-context.ts` 567 · `auth/store.ts` 517 · `map.ts` 1,019 (`wc -l`).
- "뿐이다" 검산: `await` 분포는 위 `grep -c` 4건으로 확인했다. 이벤트 진입 한 곳은 `grep -n "chatApi.onEvent" chatStore.ts` → `:2249` 1건이다.
- 문서 앵커: `docs/handoff/AGENTS.md` `§판정 범위와 운영 gate` · `§INDEX.md 운영` 실재(`grep -n "^### 판정 범위와 운영 gate\|^## INDEX.md 운영"` → 2건).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조

- 관련 V node: AR-01.
- 현재 책임 소유자: 6구간의 과잉 판정은 0305 `data/deep.json` 4행(reducer · store · adapters/claude · adapters/opencode)과 auth 1행이 갖는다. 판정 단위는 버킷이고 범주는 X1~X7이다.
- 현재 흐름: 0305 `data/*.json` → `audit-check.mjs` 렌더 → 0305 `audit.md` → 0307~0314 plan의 입력.
- 현재 오류/정리 경로: 후보의 전제(경쟁 가드·잠금·채택 규칙)는 후속 handoff의 plan 조사에서 처음 확인된다.
- 구조적 제약: 후보 스키마에 전제 칸이 없고, 한 파일 안·프로세스 간 중복을 묻는 렌즈가 없다.

```text
0305 data/*.json → 0305 audit.md → 후속 plan 조사(여기서 전제가 처음 드러남) → Decision 종결 16건
```

### TO-BE — 감사 산출 구조

- 관련 V node: AR-01 · MD-01~MD-03.
- 변경 후 책임 소유자: 6구간의 X8·L6 판정과 전제 근거는 `…/data/audit.json`이 갖는다. 0305 산출은 그대로 둔다.
- 변경 후 흐름: 기준 커밋 6구간 → 감사자 판단 → `audit.json` → `check()` · `render()` · `ruling()` → `audit.md` → verify 판정 → 사용자.
- 변경 후 오류 경로: 검사 red면 단계가 끝나지 않는다. 전제가 걸린 후보는 `blocks`로 남아 통과 후보에서 빠진다.
- 유지하는 메커니즘: 0305의 "JSON 정본 → 생성 블록 렌더 → 바이트 비교" 방식. 대체하는 것: 없음(0305 검사기를 import하지 않는다 — 스키마가 다르다).

```text
git show c1af29f:<6구간> → (감사자) → data/audit.json → scan/check.mjs {extractUnits · check · render · ruling}
  → audit.md 생성 블록 → verify.md 판정 → 사용자 결정
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 버킷 단위 X1~X7 판정(0305) | 구간 단위 X1~X8·L1·L5·L6 + 단위별 L6 판정(0315) | D-003·D-004 | R-01 / VP-01 · `audit.json` `areas`·`units` |
| data/control flow | 후보 → 후속 plan에서 전제 확인 | 후보에 전제 3칸 필수 | D-005 | R-02 / VP-02 · K5 |
| state/contract | 후보 9칸 | 후보 12칸 + 전제 3칸 | D-005·D-007 | EP-03·EP-04 |
| error/lifecycle | 후속 분할안(`split.json`) | 중단 규칙 판정(`ruling()`) | D-010 | R-03 / VP-03·VP-08 |
| test seam/관측점 | 0305 `audit-check.test.mjs` | `…/scan/check.test.mjs`(신규) | 스키마가 다름 | MD-01~03 / VP-06~08 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `…/data/audit.json` | 감사 판단의 정본 | 사람 작성 | 검사 · 렌더 |
| `…/scan/check.mjs` | 단위 추출 · 검사 · 렌더 · 판정 | `audit.json` + `facts` → 위반 목록 / 생성 블록 / 판정 | 감사자 · 검증자 |
| `…/audit.md` | 사용자가 읽는 문서 | 해설 + 생성 블록 | 사용자 · verify |

### 감사 방법 — 렌즈와 범주

| 렌즈 | 묻는 것 | 방법(분모) | 후보 유형 |
|---|---|---|---|
| L1 미도달 | 구간 안에 호출·도달 경로가 없는 코드가 있는가 | 구간의 판정 단위 136개 — 단위마다 non-test 호출부를 `rg`로 센다 | `remove` |
| L4 경로 과잉 | 구간이 그 조작에 필요한 것보다 많은 요소를 쓰는가 | 구간 6개 × 범주 X1~X8 | `restructure` · `remove` |
| L5 하네스 중복 | Claude·OpenCode 병렬 구현이 같은 일을 두 번 하는가 | A6(`map.ts`) ↔ A4(`session-context.ts`)와 그 호출자 쌍 | `merge` |
| **L6 판정·조립 중복(주 렌즈)** | 같은 판정·조립이 한 파일 안 또는 main↔renderer에 두 번 이상 있는가 | 판정 단위 136개 — 단위마다 (가) 같은 파일 (나) 반대 프로세스에서 짝을 찾는다 | `merge` |

L6의 짝 찾기: 단위가 내리는 판정(조건식의 주어·비교 값)과 조립(만드는 객체의 필드 집합)을 한 문장으로 적고, 그 주어·필드 이름으로 `rg`를 돌린다. 범위는 (가) 그 파일 전체 (나) renderer 단위면 `app/src/main` + `app/src/shared`, main 단위면 `app/src/renderer/src` + `app/src/shared`다. `none`이면 근거 칸에 그 명령과 N을 적는다.

과잉 범주 X1~X7은 0305 정의를 그대로 쓴다(`0305 plan.md:323-329`). 추가 범주:

| # | 범주 | 후보가 되는 형태 |
|---|---|---|
| X8 | 한 함수·파일에 물린 책임 | 한 함수가 서로 다른 관측 결과를 내는 일을 둘 이상 하고, 그 때문에 같은 판정·조립이 함수 안에서 되풀이되는 것 · 한 파일의 모듈 전역 상태를 무관한 책임 둘 이상이 함께 쓰는 것 |

X8은 D-007의 한계 안에서만 후보가 된다 — 책임을 가르는 것만으로 줄이 늘면 후보가 아니다(`saving.prod` ≥ 1이 필수, K8). 모듈 경계를 없애는 방향의 후보는 `keepStructure` 칸에 무엇을 남기는지 적는다.

전제 3칸의 판정 기준(D-005):

| 칸 | 묻는 것 | `blocks`인 경우 | 근거로 적는 것 |
|---|---|---|---|
| `raceGuard` | 두 자리 사이에 비동기 경계(`await` · IPC 왕복 · 타이머·코얼레서·rAF)가 끼어 있고 뒤 자리가 그 사이 상태 변화를 다시 확인하는가 | 그렇다 — 뒤 판정은 중복이 아니라 재확인이다 | 두 자리 사이의 경계 `파일:줄` 또는 "경계 없음"을 보인 `rg` 명령+N |
| `formLock` | 그 형태(두 자리의 존재·호출 순서·시그니처)를 잠그는 테스트·가드가 있는가 | 그렇다 — 합치려면 테스트·가드를 바꿔야 한다(D-006으로 대상 밖) | 자리의 심볼을 참조하는 `*.test.*` · `app/eslint.config.mjs` · `app/scripts/*.mjs`에 대한 `rg` 명령+N과 형태를 잠그는 케이스의 `파일:테스트명` |
| `agentsRule` | AGENTS 문서·`docs/arch/`·`docs/decisions/`가 그 형태를 채택 규칙으로 정했는가 | 그렇다 — 바꾸려면 채택 결정을 바꿔야 한다 | `AGENTS.md`(root · `app/` · `app/src/main/` · `app/src/renderer/`) · `docs/arch/**` · `docs/decisions/**`에 대한 `rg` 명령+N과 해당 문장의 `파일:줄` |

동작만 잠그는 테스트(결과 단언)는 `formLock`의 `blocks`가 아니다 — 회귀 그물이므로 조건 칸 `ui`의 근거로 적는다.

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 / VP-01 | 구간 → 범주·렌즈 판정 | `check.mjs` `AREAS` | 검사 K1 | 구간 6 × 칸 11(`X1`~`X8`·`L1`·`L5`·`L6`) = 66칸 | §8 구간 표 6행 × 아래 칸 목록 11 | 판정 없이 넘어간 범주·렌즈 |
| EP-02 / VP-01·VP-06 | 구간 → 판정 단위 | `check.mjs` `extractUnits()` | 검사 K2 · UT-01 | 단위 136개(A1 20 · A2 1 · A3 33 · A4 25 · A5 25 · A6 32) · 추출 패턴 5 + 규칙 2 | `node …/scan/check.mjs --units \| wc -l` → 136 (추출 규칙은 아래) | L6 짝을 찾지 않고 넘어간 판정·조립 |
| EP-03 / VP-02 | 후보 필수 칸 | `audit.json` 스키마 | 검사 K3·K4·K8·K9 | 칸 12 × 후보 수 | 아래 칸 목록 12 | 후속 handoff가 근거 없이 착수 |
| EP-04 / VP-02 | 전제 확인 칸 | 같은 스키마 | 검사 K5 | 칸 3(`raceGuard`·`formLock`·`agentsRule`) × 후보 수 | 아래 칸 목록 3 | 전제를 확인하지 않은 후보가 통과로 세어짐 |
| EP-05 / VP-07 | 검사 규칙 | `check.mjs` `check()` | UT-02 | 규칙 K1~K10의 red 조건 40개(아래) | 아래 규칙 표의 조건 수 합 | 검사가 green인데 표가 불완전 |
| EP-06 / VP-03·VP-08 | 중단 규칙 | `check.mjs` `ruling()` | UT-03 · verify | 갈래 5(아래) | 아래 갈래 표 5행 | 데이터와 다른 판정 |
| EP-07 / VP-03 | 핫패스 진입 심볼 | `check.mjs` `HOT_ENTRIES` | 검사 K8 | 심볼 6: `ingestChatEvent` · `receive` · `receiveDeltaBatch` · `claudeToNormalized` · `offer` · `startEvents` | `git show c1af29f:<파일> \| grep -n "<심볼>"` — 6개 모두 정의 줄 1건 이상(`chatStore.ts:998·698·543` · `map.ts:373` · `session-context.ts:290·347`) | 콜드 경로 후보가 핫패스로 세어져 넓은 감사가 열림 |
| EP-08 / VP-02 | 대상 제외 | `check.mjs` `EXCLUDED` | 검사 K4 | 패턴 5(아래) | 아래 패턴 목록 5 | D-006 대상 밖 파일이 후보로 오름 |
| EP-09 / VP-05 | 판정 사본 일치 | `audit.json` | 검사 K10 · verify | 사본 3곳: `audit.md` 생성 블록 · `verify.md` 판정 절 · `INDEX.md` 비고 | `rg -c '^<!-- gen:' …/audit.md` → 5(여는 표식) · `verify.md`는 `--ruling` 출력 인용 · INDEX 0315 행 | 문서와 데이터가 다른 말을 함 |

**EP-01 칸 목록**: `X1` `X2` `X3` `X4` `X5` `X6` `X7` `X8` `L1` `L5` `L6`. 값은 후보 ID 배열 또는 문자열 `"none"`. L4 판정은 X1~X8 칸이 갖는다(별도 `L4` 칸 없음).

**EP-02 추출 규칙** (규칙 칸 ↔ UT-01 입력 1:1). 구간의 줄마다 위에서부터 첫 일치만 쓴다. 캡처 1이 단위 이름이다.

| # | 패턴(JS 정규식) | UT-01 입력 |
|---|---|---|
| P1 | `^(?:export )?(?:async )?function (\w+)` | `export function receive(ev) {` → `receive` |
| P2 | `^  (?:(?:private\|public\|static\|readonly) )*(?:async )?(?!if\b\|for\b\|while\b\|switch\b\|return\b\|constructor\b)(\w+)\(` | `  private async connectEvents(signal) {` → `connectEvents` · `  if (x) {` → 단위 아님 |
| P3 | `^\s+case '([^']+)':` | `      case 'turn.ended':` → `turn.ended` |
| P4 | `^  if \(msg\.type === '(\w+)'` | `  if (msg.type === 'result') {` → `result` |
| P5 | `^(?:export )?const (\w+) = ` | `const coalescer = createEventCoalescer(` → `coalescer` |
| U6 | 구간 줄 범위 밖의 줄은 보지 않는다 | 범위 밖에 `function x(` 1줄 → 단위 0 |
| U7 | 한 구간 안에서 같은 이름은 첫 등장 1개만 단위다 | 같은 이름 `case` 2줄 → 단위 1 |

- 단위는 `구간 ID + 이름`으로 식별한다. P2는 인터페이스 멤버 선언과 2칸 들여쓴 호출식도 잡는다 — 그 이름도 단위로 두고 구현 자리를 근거 칸에 적는다(추출을 좁히지 않는다 — 분모는 이 규칙의 출력이다).
- 본문은 작업 트리가 아니라 `git show c1af29f:<파일>`에서 읽는다. `main`이 움직여도 분모가 바뀌지 않는다.

**EP-03 후보 필수 칸**: `id`(`B-NN`) · `area`(A1~A6) · `lens`(L1·L4·L5·L6) · `type`(`merge`·`restructure`·`remove`) · `sites`(`파일:줄` 배열) · `duplicate`(무엇이 되풀이되는가 한 문장 — L1이면 무엇이 닿지 않는가) · `preserve`(보존할 관측 동작) · `keepStructure`(남기는 모듈·함수 경계) · `saving`(`{prod, basis}` — `prod`는 1 이상 정수) · `hotEntry`(EP-07 심볼 또는 `null`) · `premises`(EP-04) · `conditions`(`{ui:{verdict,evidence}, perf:{verdict,evidence}}`). 조건부 필수: `excess`(X1~X8 배열) — `lens=L4`면 1개 이상. 선택 칸: `approval`(`required`/`none`) — `type=remove`면 `required`가 필수다.

- enum: `premises.*.verdict` = `clear`·`blocks` · `conditions.ui.verdict` = `safe`·`risk` · `conditions.perf.verdict` = `equal_or_better`·`worse`·`unknown`.
- `saving.prod`는 non-test 제품 코드 줄 수다. 테스트 줄 수는 세지 않는다(D-006).
- `hotEntry`가 `null`이 아니면 `conditions.perf.evidence`에 그 진입 심볼에서 자리까지의 호출 사슬을 적는다.

**EP-04 전제 칸**: `premises.raceGuard` · `premises.formLock` · `premises.agentsRule` — 각각 `{verdict, evidence}`. 판정 기준은 §9 표다.

**EP-05 검사 규칙** (규칙 칸 ↔ UT-02 red 입력 1:1, 전부 유효한 입력 1건은 green):

| # | red 조건 | 조건 수 | UT-02 입력 |
|---|---|---:|---|
| K1 | 구간 집합 ≠ {A1…A6} / 11칸 중 판정 없는 칸 / 판정 값이 배열도 `"none"`도 아님 / `basis` 빈 값 | 4 | 구간 1개 삭제 · `X8` 칸 삭제 · 값 `"x"` · `basis: ""` |
| K2 | 추출 단위가 `units`에 없음 / `units`에 추출되지 않은 단위 / 같은 단위 2행 / `l6` 판정 없음·값 형식 오류 / `basis` 빈 값 | 5 | 단위 1행 삭제 · 유령 단위 추가 · 행 복제 · `l6` 삭제 · `basis: ""` |
| K3 | 후보 필수 칸 누락 또는 빈 값 / 미지 키 / 미지 enum(`area`·`lens`·`type`) / `id` 중복 | 4 | 12칸 각각 제거(12입력) · 키 `x` 추가 · `type: "x"` · 같은 `id` 2건 |
| K4 | 자리 형식이 `파일:줄`이 아님 / 파일이 기준 커밋에 없음 / 줄이 파일 길이 초과 / `lens=L6`인데 자리 2 미만 / 후보 구간 범위 안의 자리 0 / 자리가 EP-08 패턴에 걸림 | 6 | 여섯 조건 각각 1입력(EP-08은 패턴 5개 각각 1입력) |
| K5 | 전제 칸 3개 중 누락 / `verdict` enum 밖 / `evidence` 빈 값 | 3 | 칸 3개 각각 제거(3입력) · `verdict: "ok"` · `evidence: ""` |
| K6 | 조건 칸 `ui`·`perf` 누락 / `verdict` enum 밖 / `evidence` 빈 값 | 3 | 칸 2개 각각 제거 · `verdict: "x"` · `evidence: ""` |
| K7 | 구간·단위 칸의 후보 ID 미실재 / 지목한 후보의 `area` 불일치 / 구간 칸의 범주·렌즈와 후보의 `excess`·`lens` 불일치 / 단위 `l6`이 `lens≠L6` 후보를 지목 / 어느 구간 칸에도 없는 후보 / 어느 단위에도 없는 L6 후보 | 6 | 여섯 조건 각각 1입력 |
| K8 | `saving.prod`가 1 이상 정수가 아님 / `saving.basis` 빈 값 / `hotEntry`가 EP-07 심볼도 `null`도 아님 / `lens=L4`인데 `excess` 없음·X1~X8 밖 | 4 | `prod: 0` · `prod: 1.5` · `basis: ""` · `hotEntry: "send"` · `excess: []` · `excess: ["X9"]` |
| K9 | `type=remove`인데 `approval≠required` / 승인 블록과 `remove` 집합 불일치 | 2 | `approval` 삭제 · 승인 블록에서 1행 삭제 |
| K10 | `audit.md` 생성 블록 ≠ 렌더 결과 / 필수 블록 5개 중 누락 / 최상위 미지 키 | 3 | 문자 1개 수정 · 블록 삭제 · 최상위 키 `x` 추가 |

조건 수 합 = 4 + 5 + 4 + 6 + 3 + 3 + 6 + 4 + 2 + 3 = 40 = EP-05 분모.

**EP-06 중단 규칙** (규칙 칸 ↔ UT-03 입력 1:1). 통과 후보 `P` = 전제 3칸 모두 `clear` ∧ `ui=safe` ∧ `perf=equal_or_better`(D-008). `H` = `P` 중 `lens=L6` ∧ `hotEntry≠null`. `소형` = `saving.prod < 30`.

| # | 조건 | 판정 | UT-03 입력 |
|---|---|---|---|
| G1 | `P` = ∅ | `종료` | 후보 0건 · 후보 2건 모두 전제 1칸 `blocks` · 후보 1건 `perf=unknown` |
| G2 | `P` ≠ ∅ ∧ `H` = ∅ ∧ `P` 전부 소형 | `구현 1건` | 통과 2건(29줄 · 5줄), 핫패스 아님 |
| G3 | `H` ≠ ∅ ∧ `P`에 소형 아닌 후보 있음 | `구현 묶음 + 넓은 감사` | 통과 2건: L6·`hotEntry=receive`·30줄 + 콜드 5줄 |
| G4 | `H` ≠ ∅ ∧ `P` 전부 소형 | `사용자 결정`(D-012 가) | 통과 1건: L6·`hotEntry=receive`·29줄 |
| G5 | `P` ≠ ∅ ∧ `H` = ∅ ∧ `P`에 소형 아닌 후보 있음 | `사용자 결정`(D-012 나) | 통과 1건: L4·`hotEntry=null`·30줄 · 통과 1건: L4·`hotEntry=receive`·40줄(L6 아님 → `H` 아님) |

- 경계 입력 2: 29줄은 소형, 30줄은 소형이 아니다(G2·G3 입력이 양쪽을 갖는다).
- `ruling()`은 판정과 함께 `P`·`H`의 후보 ID, 각 후보의 `saving.prod`를 낸다. 판정은 저장하지 않고 렌더 때 계산한다.
- D-012가 닫히면 G4·G5의 판정 문자열만 바뀐다 — 설계 턴이 이 표와 UT 입력을 함께 고친다.

**EP-08 제외 패턴** (자리 경로에 대해, 하나라도 일치하면 red): `\.test\.[cm]?[jt]sx?$` · `\.testfixture\.` · `^app/scripts/` · `^\.github/` · `^app/src/main/adapters/claude/mock`.

**EP-09 생성 블록 5개**: `areas`(구간 × 11칸 + 근거) · `units`(구간별 단위 · L6 판정 · 근거) · `candidates`(필수 칸 + 통과 여부) · `premises`(후보 × 전제 3칸 · 조건 2칸의 판정과 근거) · `ruling`(판정 · `P` · `H` · 승인 목록).

- 자리 목록과 검색 출력의 차집합은 0이어야 한다. 구현자가 만든 `--units` 출력이 136이 아니거나 구간별 수가 §8 표와 다르면 `PLAN_GAP`이다.
- 열린 입력 집합: 검사 입력은 이 plan이 정한 JSON 스키마다. 모르는 키·enum은 K3·K10으로 red(fail-closed). `extractUnits`의 입력(TypeScript 소스)은 열린 집합이지만 판정이 아니라 분모 고정이 목적이고, 본문을 기준 커밋으로 고정해 닫는다.
- 같은 규칙의 공유: 추출 패턴·제외 패턴·핫패스 심볼은 `check.mjs` 한 곳에만 둔다. 0305 `audit-check.mjs`와 `app/scripts/*`를 import하지 않는다.
- 선택적 칸: `approval` 미지정은 `type≠remove`일 때만 `none`으로 읽고, `remove`에서 미지정이면 K9 red(fail-closed).
- 외부 SDK 경계: 해당 없음.

**선언 경계** (verify는 이 안의 반례를 판정에 쓰지 않는다):

1. 감사 후보는 하한이다. 렌즈가 찾지 못한 중복은 결함이 아니다 — L6의 짝 찾기는 단위마다 적은 `rg` 명령의 범위까지다.
2. 범주·렌즈 판정과 전제·조건 판정은 감사자의 판단이다. 검사는 판정·근거의 존재와 연결만 본다 — 옳고 그름은 verify의 표본 재현(VP-02: 통과 후보 전부 + 그 밖 최대 3건 · VP-03: `none` 단위 5개)으로만 본다.
3. `saving.prod`는 추정이다. 검사는 형식과 하한(1)만 본다. 중단 규칙의 30줄 경계는 이 추정값에 걸린다 — verify는 25~34줄 구간의 통과 후보에 한해 `basis`를 다시 센다.
4. 판정 단위는 EP-02 규칙의 출력이다. 규칙이 잡지 못하는 형태(중첩 화살표 함수 · 3칸 이상 들여쓴 메서드 · 객체 리터럴 메서드)는 단위가 아니고, 그것을 품은 바깥 단위의 판정이 덮는다.
5. 구간 밖 코드는 L6 짝으로만 나타난다. 구간 밖 자리만으로 된 후보는 없다(K4).
6. `perf` 판정은 호출 수·할당 수의 정적 비교다. 실행 시간은 재지 않는다 — 측정이 필요한 후보는 `unknown`으로 두어 통과에서 뺀다.
7. `formLock`의 "형태를 잠그는가"는 감사자가 테스트 본문을 읽고 내린다. 검사는 근거 문자열의 존재만 본다.

## 11. 구현 설계

| 신규 파일 | 책임 | 내용 | 테스트 seam |
|---|---|---|---|
| `…/scan/check.mjs` | 추출·검사·렌더·판정 | 순수 함수 `extractUnits(text, ranges)` · `check(data, facts)` · `render(data, facts)` · `ruling(candidates)` + CLI 껍질(`--check`·`--write`·`--units`·`--ruling`) | 네 함수 단위 |
| `…/scan/check.test.mjs` | UT-01~UT-03 | EP-02 7입력 · EP-05 조건마다 red + green 1 · EP-06 갈래 5 | `node --test` |
| `…/data/audit.json` | 감사 정본 | `{base, progress, areas[], units[], candidates[]}` | 검사 |
| `…/audit.md` | 사용자 문서 | 진행표 · 요약 · 생성 블록 5 · 재현 방법 | 검사 K10 |

스키마: `areas[] = {id, verdicts{X1..X8,L1,L5,L6}, basis}` · `units[] = {area, name, l6, basis}` · `candidates[]` = EP-03.

감사 단계(단계가 끝날 때마다 검사 green 확인 후 커밋·push — 세션이 끊겨도 이어받는다):

| 단계 | 산출 | 내용 |
|---|---|---|
| P1 | `scan/check.mjs` · 테스트 · `units` 뼈대 | 검사기와 UT. `--units`가 136을 내는지 확인. `audit.md` 진행표 |
| P2 | A1·A2·A3 판정 | renderer 구간 — 전부 읽고 구간 11칸 · 단위 L6 · 후보 |
| P3 | A4·A5·A6 판정 | main 구간 — 같은 방식. L5(A6 ↔ A4)와 main↔renderer L6 짝은 여기서 닫는다 |
| P4 | 전제·조건 근거 · `audit.md` 완성 | 후보마다 전제 3칸·조건 2칸의 명령을 실행해 근거를 채우고 렌더 |

### 테스트 가능성

- 순수 파일: 네 함수는 `git`·파일 시스템을 받지 않는다. CLI 껍질이 `facts`(`{fileAt(path) → 본문 또는 null}` — `git show`)를 모아 넘긴다.
- 의존성: Node 내장 모듈만 쓴다. `app/node_modules` 없이 돈다.
- 미완성 단계: P1~P3 동안 판정이 비어 있는 구간·단위는 진행표가 완료를 선언하기 전까지 "대기"로 보고한다. 완료 선언 뒤에는 red다 — 대기 모드는 `audit.json` `progress`(`P1`…`P4` 완료 여부)로 정한다. 최상위 허용 키는 `base`·`progress`·`areas`·`units`·`candidates` 5개다(K10).

## 12. End-to-end 영향

```text
(감사자) data/audit.json → check.mjs render·ruling → audit.md → verify.md 판정 → 사용자 → (다음 설계 턴의 입력)
```

- producer 기준: JSON이 정본이다. 통과 여부·판정·합계는 저장하지 않고 렌더 때 계산한다.
- consumer 파생 규칙: 후속 handoff는 후보를 `0315 B-NN`으로 인용한다.
- 부팅/등록 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: impl 턴이 P1부터. `audit.md` 머리에 기준 커밋과 진행표를 둔다.
- 중단/재개: 단계마다 커밋·push. 다음 세션은 진행표와 `progress`를 읽고 이어간다.
- 부분 실패: 단계 검사가 red면 다음 단계로 넘어가지 않는다.
- 다중 저장소 쓰기: 판정 사본은 `audit.json` → `audit.md` 생성 블록 → `verify.md` 판정 절 → `INDEX.md` 비고다. 앞 둘은 K10이 잠근다. `verify.md`는 `--ruling` 출력을 그대로 인용하고, `INDEX.md` 비고에는 판정 문자열 하나와 링크만 둔다(수치를 옮기지 않는다).

## 14. 성능 / 상한 / 최적화

- 새 CI 부하: 0. 산출은 `docs/handoff/` 아래라 `ci.yml` paths 필터와 `npm test`의 `scripts/*.test.mjs` glob에 들지 않는다.
- 구조적 목표: 이번 handoff에는 줄 수 감축 목표가 없다.
- 읽는 양: 6구간 3,135줄 전부 + L6 짝 검색으로 닿는 구간 밖 자리. 구간을 줄여 읽지 않는다(AC1·AC2의 판정은 전부 읽은 것을 전제한다).

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0305 `audit.md`·`data/*.json` 불변 | 0314 D-008 | §6 비범위 · §9 TO-BE "0305 산출은 그대로 둔다" | 유지 |
| 서브·백그라운드 에이전트 금지 | 0305 D-006 | §0 · D-011 · §19 | 유지(승계) |
| CI·테스트 인프라를 감량 대상으로 보지 않는다 | 0305 D-011 | D-006 · EP-08 | 유지 |
| 후보 표 0314 "SDK 메시지 층 mock" 행은 0305 계열에서 제외 | `INDEX.md` 후보 표(2026-11-12 사용자 결정) | D-006 · EP-08 5번째 패턴 | 유지 |
| 대상 커밋 좌표는 검증자가 기입 | `docs/handoff/AGENTS.md §INDEX.md 운영` | 메타 기준 커밋(확인한 해시만) · INDEX 자리표시자 | 유지 |
| 코드에서 셀 수 있는 수치를 문서에 적지 마라 | root `AGENTS.md` 원칙 4 | §8 줄·단위 수 | 유지 — 그 규칙의 대상은 current-state 문서이고 handoff 번호 디렉토리는 검사 밖이다(`check-doc-inventory.mjs` `isHistoricalHandoff`). 수치는 기준 커밋에 고정된 감사 분모다 |
| 설계 커밋과 구현 산출을 한 커밋에 담지 않는다 | `handoff-plan/SKILL.md` 마무리 | §11 P1 이후는 별도 커밋 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 감량 추정이 30줄 경계에서 판정을 뒤집는다 | 선언 경계 3 — verify가 25~34줄 통과 후보의 `basis`를 다시 센다 |
| 감사자가 전제를 낙관해 통과 후보를 부풀린다 | VP-02 — verify가 통과 후보 **전부**의 전제 근거 명령을 재실행한다 |
| P2 패턴이 인터페이스 멤버·호출식을 단위로 잡아 분모에 잡음이 낀다 | 분모를 좁히지 않고 근거 칸에 구현 자리를 적는다(EP-02). 놓치는 쪽보다 넘치는 쪽이 싸다 |
| D-012가 열린 채 verify에 닿는다 | G4·G5가 `사용자 결정`을 낸다(fail-closed). 자동으로 구현이나 넓은 감사를 열지 않는다 |
| `main`이 움직여 줄 번호가 어긋난다 | 본문·자리 검증을 `git show c1af29f:`로 고정 |

- 되돌리기 어려운 결정: 없음 — 산출이 자기 디렉토리의 문서와 스크립트다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `docs/handoff/0315-supplementary-bloat-audit/{plan.md,audit.md,data/audit.json,scan/check.mjs,scan/check.test.mjs}`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `docs/handoff/AGENTS.md`. `app/**`는 수정하지 않으므로 `app` lint·typecheck·test는 gate가 아니다.
- 환경 제약: 없음 — Node 내장 모듈과 `git`만 쓴다.
- 기본 gate: §7-A 운영 gate 표의 5개.
- D-011: impl·verify 턴도 서브·백그라운드 에이전트를 쓰지 않는다.
- 사람 실기: AC10.

## READY self-review

- [x] Decision Ledger — ACTIVE 13 · OPEN 1(D-012) · SUPERSEDED 0.
- [x] Part I만으로 완료 상태를 설명한다 — §1 성공 한 문장 · §5 상태 표.
- [x] 조건절·이유절을 원문으로 인용했다 — §2·§3의 따옴표 문장. 오기 3건은 추론 행에 실재 경로와 함께 적었다.
- [x] 사용자 결정과 코드 사실을 구분했다 — 사용자: D-012 · 조사: §4 전제 정정.
- [x] 수치·전칭·앵커 실측 — §8 검산 절.
- [x] 저장소 규칙·후보 표 겹침 확인 — §8의 0308 행 · §16.
- [x] 각 AC가 동작 기준·검증 수단·경로를 가진다 — §7 11행.
- [x] Baseline V — §7-A.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair — R-01~05 ↔ VP-01~05 · AR-01 ↔ VP-05 · MD-01~03 ↔ VP-06~08.
- [x] INHERITED node 없음.
- [x] 각 pair의 경로·분모·oracle 좌표 — Pair registry · §10.
- [x] 규칙 칸 ↔ UT 입력 칸 — EP-02 7행 · EP-05 10행(조건 40) · EP-06 5행.
- [x] 선언 경계 7건 · 열린 입력은 fail-closed(K3·K10).
- [x] 운영 gate 5개 — 문서 가드는 기준선에서 `links ok` 관측.
- [x] 사람 실기로 미룬 순수 로직 없음 — 중단 규칙은 UT-03.
- [x] structural proxy — AC 주의사항 4번째 줄과 VP-02·VP-03의 재현 의무로 보완.
- [x] 방향 일치 — K2는 단위를 지우면 red(양방향 차집합) · K7은 고아 후보와 유령 ID 양쪽에 red.
- [x] 정책 파라미터 — 30줄 경계는 `saving.prod < 30`(prod 줄 · 정수) · 판정은 5갈래 enum.
- [x] 참조 구현 coverage — 0305 범주 X1~X7을 인용하고 X8을 더했다. 렌즈 4개 전부 방법·분모가 있다.
- [x] 신규 모듈의 강제 지점·seam — §11.
- [x] producer/consumer — §12.
- [x] 상한 — 읽는 양 3,135줄 · CI 부하 0.
- [x] 본문 교차검증 — §3 갱신 메모의 대조 줄. EP-05 분모는 Pair registry·§10 표·규칙 표 합계 세 곳 모두 40이다.
- [x] 문장 규칙 — 판정 먼저 · 표 위주.

---

## [구현자 기입] 설계 리뷰

(impl 턴에서 채운다 — 필드는 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md) `[구현자 기입]` 전부)

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
