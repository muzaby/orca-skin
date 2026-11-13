# Plan — 0317-wide-bloat-audit-stage1

## 메타

| 항목 | 값 |
|---|---|
| slug | `0317-wide-bloat-audit-stage1` |
| 작성자 | Claude Code |
| 일자 | 2026-11-13 |
| 매핑 | 사용자 `/handoff-plan` — 0315 AC10 결정에 따른 넓은 감사 1단계. 감사만 하고 구현은 하지 않는다 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0315의 V를 상속하지 않는다. 0315에서 가져오는 것은 방법·스키마·검사 규칙의 본문이다(§8·§11) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 기준 커밋 | `1168b67` (`git cat-file -t` = commit · `git merge-base --is-ancestor 1168b67 origin/main` 성공 — `origin/main` HEAD) |

## 0. 작성 경로

- 판정: 조사는 설계자가 직접 했다. 서브·백그라운드 에이전트는 쓰지 않았다(D-010).
- 이 plan은 감사 수행 지시서다. `app/**`·`.github/**` 변경은 이번 handoff 전체에 없다(AC8).
- 아래에서 `…` = `docs/handoff/0317-wide-bloat-audit-stage1`, `H/` = `app/src/renderer/src/features/chat/harnesses/`, `O/` = `app/src/main/adapters/opencode/v1/`, `S/` = `app/src/renderer/src/shared/`.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0315 중단 규칙이 `넓은 감사 연다`(G4)를 냈고, 사용자가 1단계 범위와 종료 조건을 정했다(`0315 verify.md §13`). 그 1단계가 아직 수행되지 않았다.
- 0305 계열(0305~0316)을 계속할지 끝낼지가 이 감사의 결과에 걸려 있다.
- 완료 후 달라지는 것: 사용자가 **명령으로 고정한 대상 파일 11개의 범주·렌즈 판정 · 단위별 L6 판정 · 전제 근거가 붙은 후보 목록 · 통과 후보 감량 합**이 든 감사 문서 한 편을 받는다.
- 성공 한 문장: **verify가 감사 문서의 값만으로 "0305 계열 종료"와 "다음 단계를 사용자에게 올림" 중 하나를 판정할 수 있다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "이어서 0315  ac10 결정에 따른 넓운 감사 1단계 handoff를 만들어 plan을 작성하라." | 턴 1 |
| 명시 요구 | "대상은 chat/harnesses•adapters/opencode•chat-turn•renderer/shared의 prod 300줄 이상 파일 중 0305•0315 읽지 않은 것이다." | 턴 1 |
| 명시 요구 | "대상 파일 목록은 명령으로 뽑아 고정하라." | 턴 1 |
| 명시 요구 | "방법•필수 칸(전체 3칸•Ui•성능)•범주 x8•렌즈 L6은 0315와 같다." | 턴 1 |
| 명시 요구 | "감사만 하고 구현은 하지 않는다." | 턴 1 |
| 명시 요구 | "Verify:에서 판정해라: 통과 후보 감량 합이 30줄 미만이면 0305 계열 종료, 30줄 이상이면 다음단계를 사용자레게 올린다." | 턴 1 |
| 승계 결정 | "1단계는 덜 읽은 4버킷(chat/harnessses•adapters/opencode•app/cchat-turn•renderer/shared)의 prod 300줄 이상 파일만 대상으로 하고" | `0315 verify.md §13` |
| 추론 의도 | "전체 3칸"은 0315의 전제 3칸(`raceGuard`·`formLock`·`agentsRule`)이다 | 0315 D-005 — "필수 칸"이 붙은 3칸은 그것뿐이다 |
| 추론 의도 | "읽지 않은 것"은 파일 단위다 — 0305·0315의 읽은 파일 기록에 이름이 없는 파일(D-003) | 요구 문장의 "파일 중 … 읽지 않은 것" · 기록 자리는 §8 |
| 추론 의도 | "0305 계열 종료"면 통과 후보도 구현 handoff로 만들지 않고 감사 문서에 기록으로 남긴다(D-008) | "종료"와 "다음단계를 … 올린다"가 두 갈래의 전부다 |
| 추론 의도 | "통과 후보"는 0315 D-008의 정의다 | `0315 verify.md §13` "0315 D-008 통과 정의 승계" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0317은 넓은 감사 1단계만 한다. 제품·CI 코드를 바꾸지 않는다 | "감사만 하고 구현은 하지 않는다." | 턴 1 | ACTIVE | — |
| D-002 | 대상 후보는 4버킷(`H/` · `app/src/main/adapters/opencode/` · `app/src/main/app/chat-turn/` · `S/`)의 prod `.ts`·`.tsx` 중 기준 커밋에서 300줄 이상인 파일이다 | "…의 prod 300줄 이상 파일 중 …" | 턴 1 · `0315 verify.md §13` | ACTIVE | — |
| D-003 | 대상에서 빼는 "읽은 파일"은 0305 `data/deep.json`·`data/reviews.json`의 `read` 배열과 0315 `scan/check.mjs` `AREAS`의 파일이다. 일부 구간만 읽힌 파일도 읽은 파일로 본다 | 설계자 해석 — 두 감사가 읽은 파일을 기계로 읽을 수 있게 남긴 자리가 이 셋뿐이다(§8) | §2 추론 행 | ACTIVE | — |
| D-004 | 대상 목록은 명령 출력으로 고정한다. 목록은 §8의 11파일이고 검사 K11이 유도 결과와 양방향으로 대조한다 | "대상 파일 목록은 명령으로 뽑아 고정하라." | 턴 1 | ACTIVE | — |
| D-005 | 방법은 0315와 같다 — 과잉 범주 X1~X8 · 렌즈 L1·L4·L5·L6(주 렌즈 L6) · 후보 필수 12칸 · 전제 3칸 · 조건 2칸(UI·성능) · 판정 단위 추출 규칙 | "방법•필수 칸(전체 3칸•Ui•성능)•범주 x8•렌즈 L6은 0315와 같다." | 턴 1 | ACTIVE | — |
| D-006 | 테스트 · script · CI · SDK 층 mock은 감사 대상이 아니다. 후보의 자리로 올리지 않는다 | 0315 D-006 승계(방법 동일) · INDEX 후보 표 0314 행 "0305 계열 제외" | 0315 plan §3 | ACTIVE | — |
| D-007 | 통과 후보 = 전제 3칸이 모두 `clear`이고 UI `safe` · 성능 `equal_or_better`이며 감량이 1줄 이상인 후보 | 0315 D-008 승계 | `0315 verify.md §13` | ACTIVE | — |
| D-008 | 판정은 verify가 한다. 통과 후보의 `saving.prod` 합이 30 미만(통과 후보 0건 포함)이면 `0305 계열 종료`, 30 이상이면 `다음 단계 사용자 결정`이다. 종료면 통과 후보를 구현 handoff로 만들지 않는다 | "통과 후보 감량 합이 30줄 미만이면 0305 계열 종료, 30줄 이상이면 다음단계를 사용자레게 올린다." | 턴 1 | ACTIVE | — |
| D-009 | 30줄 이상일 때 verify는 2단계·구현 handoff를 스스로 열지 않는다. 통과 후보·합·승인 목록을 사용자에게 올리고 멈춘다 | "다음단계를 사용자레게 올린다" | 턴 1 | ACTIVE | — |
| D-010 | 서브·백그라운드 에이전트를 쓰지 않는다 | 0305 D-006 · 0315 D-011 승계 — 같은 계열 감사 | 0315 plan §3 | ACTIVE | — |
| D-011 | 구현(감사 수행) 주체는 Claude다 | 비기능 작업은 Claude가 직접 수행 | root `AGENTS.md` 협업 워크플로우 | ACTIVE | — |
| D-012 | `remove` 유형 후보는 사용자 승인 목록에 올린다. 감사가 제거를 결정하지 않는다 | 0315 D-014 승계 | 0315 plan §3 | ACTIVE | — |
| D-013 | 0305 `C-NN`·0315 `B-NN`으로 이미 오른 형태는 다시 후보로 올리지 않는다. 구간 근거 칸에 그 ID와 종결 상태를 적는다 | 설계자 해석 — 같은 형태를 두 번 세면 감량 합이 부풀고, 닫힌 후보는 닫은 Decision이 `agentsRule`을 막는다 | `0314 ledger.md` | ACTIVE | — |
| D-014 | `agentsRule`의 근거 범위에 0305 계열 handoff(0305~0316)의 ACTIVE Decision과 `0314 ledger.md`를 더한다 | 0315 verify 발견 1 "후속 감사가 이 범위를 쓰면 plan에서 정한다" | `0315 verify.md §10` | ACTIVE | — |
| D-015 | 핫패스 = 스트림 이벤트마다 다시 실행되는 자리 — 대상 파일에서는 `messages` 구독을 가진 컴포넌트 3개다(§10 EP-07). 판정(D-008)에는 쓰지 않고 성능 칸의 근거 의무에만 쓴다 | 0315 D-009를 대상 파일에 옮긴 설계자 해석 | §8 | ACTIVE | — |

### 갱신 메모

- 턴 1에서 추가된 결정: D-001~D-015 (신규 handoff).
- OPEN: 없음.
- 0315에서 승계하지 않은 결정: 0315 D-015(두 축 중단 규칙)와 D-002(6구간). 판정은 D-008이, 대상은 D-002~D-004가 대신한다.
- `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-001 ↔ AC8 · D-002·D-003·D-004 ↔ AC12 · D-005 ↔ AC1~AC5 · D-006 ↔ AC6 · D-007·D-008 ↔ AC7 · D-009 ↔ AC10 · D-012 ↔ AC3(`approval`) · D-013·D-014 ↔ §9 방법(선언 경계 2 — 감사자 판단) · D-015 ↔ AC3(`hotEntry`) · D-010·D-011 ↔ §19.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 0315가 핫패스 L6 통과 후보 4건을 냈고(`0315 verify.md §7`) 같은 렌즈로 본 적 없는 대형 파일이 4버킷에 남아 있다 |
| "0305·0315가 읽지 않은"을 기계로 가를 수 있는가 | 가를 수 있다 — 기록 자리 3곳 | 0305 `deep.json`·`reviews.json`의 `read` 합집합 51파일 · 0315 `AREAS` 5파일(§8) |
| 일부만 읽힌 파일이 빠지는 것이 요구에 맞는가 | 요구 문장대로 파일 단위로 둔다(D-003) | 빠지는 7파일 중 4파일이 부분 열람이다 — `channel.ts` 1-374 · `ComposerInputController.tsx` 1-355 · `FileDiffSection.tsx` 511-915 개요 · `ipc.ts` 110줄(`0305 deep.json` 근거 칸). 선언 경계 8 |
| `chat-turn` 버킷에서 대상이 0건인 것이 맞는가 | 맞다 | 300줄 이상 2파일(`send.ts` 769 · `resolve-turn.ts` 319)이 모두 `reviews.json` `read`에 있다 |
| i18n 리소스 2파일(`en.ts`·`ko.ts`)을 대상에 두는가 | 둔다 — 규칙의 출력이다 | 손으로 빼면 "명령으로 고정"(D-004)이 깨진다. 판정은 감사가 낸다 |
| 이미 기존 코드가 충족하는가 | 해당 없음 | 산출은 문서다 |
| 더 작은 해법이 있는가 | 검사기 없이 표만 쓰는 방법은 채택하지 않았다 | 0315와 같은 이유 — 필수 칸·단위 전수는 눈으로 세면 빠진다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 | `0315 verify.md §13`의 참고 실측 6·6·2·4를 기준 커밋에서 다시 세어 같은 값을 얻었다(§8) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 없음 | 0314 D-008(0305 산출 불변)과 맞는다 — 0317은 자기 디렉토리에만 쓴다 |

- 사용자에게 올릴 결정: 없음. D-003(파일 단위)·D-008(종료면 구현 없음)은 요구 문장의 직접 해석이라 진행하고 최종 보고에 적는다.
- 코드 조사로 닫은 사실: 대상 11파일 · 판정 단위 98개 · 읽은 파일 기록 자리.

## 5. 동작 / 사용자 흐름

```text
[impl 턴: 11파일을 전부 읽는다]
  → [파일마다 X1~X8 · L1 · L5 · L6 판정] → [판정 단위마다 L6 판정]
  → [후보마다 자리 · 보존 동작 · 감량 · 전제 3칸 · 조건 2칸]
  → [검사 green · audit.md 렌더]
  → [verify: 통과 후보 근거 재현 → 감량 합 판정]
  ↘ [합 < 30: 0305 계열 종료] / [합 ≥ 30: 사용자에게 올림]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 감사 완료 · 통과 후보 0 | verify가 `0305 계열 종료`를 적는다 | 후속 handoff 없음 |
| 통과 후보 있음 · 감량 합 30 미만 | verify가 `0305 계열 종료`를 적는다 | 후속 handoff 없음 — 통과 후보는 `audit.md`에 기록으로 남는다 |
| 통과 후보 감량 합 30 이상 | verify가 `다음 단계 사용자 결정`을 적고 통과 후보·합·승인 목록을 올린다 | 사용자가 다음 단계(구현·2단계 감사) 여부를 정한다 |
| 검사 red | 다음 단계로 넘어가지 않는다 | 감사 미완 — INDEX가 `impl/IN_PROGRESS` |

### 파생 UX / 엣지케이스

- 후보 0건: 유효한 결과다. 구간·단위 판정은 그대로 전부 남는다.
- 통과하지 못한 후보: 목록에 남고 걸린 전제를 보인다. 삭제하지 않는다.
- 종료 판정의 민감도: verify가 전체 후보(통과 여부 무관)의 감량 합을 함께 적는다 — 막힌 후보가 통과로 뒤집혀도 30을 넘지 않는지 사용자가 본다.
- 후속 handoff 생성: 이번 handoff가 만들지 않는다(D-009).

## 6. 범위 / 비범위

- **범위**: 대상 11파일 감사 · 감사 데이터와 검사기 · `audit.md` · INDEX 갱신.
- **비범위**: `app/**`·`.github/**` 변경 · 후보 구현 · 0305·0315 산출 수정 · 테스트·script·CI·SDK 층 mock의 과잉 판정(D-006) · 대상 11파일 밖의 감사 · 2단계 범위 설계.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 후보 구현 | 아니오 | 합 30 이상일 때 사용자 결정 |
| 부분 열람 4파일의 나머지 구간 | 아니오 | 선언 경계 8 — 사용자가 다음 단계에서 정한다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 11구간 각각이 X1~X8 · L1 · L5 · L6의 11칸 판정(후보 ID 목록 또는 `none`)과 근거를 가진다 | 검사 K1: 구간 집합 ≠ F01~F11 · 칸 누락 · 근거 빈 값이면 red | 기준 커밋의 11파일 → `audit.json` `areas` → 검사 |
| R-01 | AC2 | 11구간의 판정 단위 전부가 L6 판정(후보 ID 목록 또는 `none`)과 근거를 가진다 | 검사 K2: 기준 커밋에서 추출한 단위 집합과 `units` 집합의 양방향 차집합 = ∅ · 판정·근거 누락이면 red | `git show 1168b67:<파일>` → `extractUnits()` → `units` → 검사 |
| R-02 | AC3 | 후보 행은 필수 12칸을 모두 가진다(§10 EP-03) | 검사 K3·K4·K8·K9: 칸 누락·빈 값·미지 enum·미지 키 · 자리 미실재 · L6인데 자리 2 미만 · 구간 안 자리 0 · `remove`인데 승인 표시 없음이면 red | `candidates` → 검사 |
| R-02 | AC4 | 후보마다 전제 3칸이 판정(`clear`/`blocks`)과 근거(명령+N 또는 `파일:줄`)를 가진다 | 검사 K5: 칸 3개 중 하나라도 없거나 판정이 enum 밖이거나 근거가 빈 값이면 red | `candidates[].premises` → 검사 |
| R-02 | AC5 | 후보마다 조건 2칸(UI·성능)의 판정과 근거, 보존하는 동작(`preserve`)과 구조(`keepStructure`)가 있다 | 검사 K6: 칸 누락·enum 밖·빈 근거면 red | `candidates[].conditions` → 검사 |
| R-02 | AC6 | 어떤 후보의 자리도 테스트·script·CI·SDK 층 mock 파일이 아니다 | 검사 K4: 자리가 EP-08 제외 패턴 5개 중 하나에 걸리면 red | `candidates[].sites` → 검사 |
| R-02 | AC11 | 구간 칸·단위 판정이 가리키는 후보가 실재하고 구간·렌즈·범주가 서로 맞으며, 모든 후보가 구간 칸 1곳 이상에서(L6 후보는 단위 1곳 이상에서도) 가리켜진다 | 검사 K7: 유령 ID · 구간 불일치 · 렌즈·범주 불일치 · 고아 후보면 red | `areas`·`units` ↔ `candidates` → 검사 |
| R-03 | AC7 | 판정이 감사 데이터의 함수로 나온다 — `ruling(candidates)`가 통과 후보 `P` · 감량 합 · 판정(`0305 계열 종료` / `다음 단계 사용자 결정`)을 낸다 | UT-03: EP-06 갈래 3개마다 입력 1건 이상 → 기대 판정 · verify가 통과 후보 전부의 근거를 재현한 뒤 `--ruling` 출력을 `verify.md`에 적는다 | `candidates` → `ruling()` → `audit.md` `ruling` 블록 → verify |
| R-03 | AC10 | 사용자가 판정을 확인한다 — 종료면 종료 확인, 30 이상이면 다음 단계 결정 | 사람 — `audit.md`·`verify.md` 열람 | `verify.md` → 사용자 |
| R-04 | AC8 | 감사는 제품·CI 코드를 바꾸지 않는다 | `git diff --stat 1168b67..HEAD -- app .github` 출력 0줄 | git |
| R-05 | AC9 | `audit.md`의 생성 블록은 `audit.json`을 렌더한 결과와 같다 | 검사 K10: 생성 블록 ≠ 렌더 결과 · 필수 블록 누락이면 red | `audit.json` → `render()` → `audit.md` |
| R-06 | AC12 | 감사 구간의 파일 집합이 EP-10 규칙으로 기준 커밋에서 유도한 대상 집합과 같다 | 검사 K11: 유도 집합과 `AREAS` 파일 집합의 양방향 차집합 ≠ ∅이면 red · `--targets` 출력이 §8 표 11행과 같다 | 기준 커밋 트리 + 0305·0315 읽은 파일 기록 → `deriveTargets()` → `AREAS` 대조 |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음. 검사기와 그 테스트는 0315 것을 복사해 이번에 고친다(§11).
- 사람 실기 항목: AC10 하나. 판정 계산(AC7)과 대상 유도(AC12)는 순수 함수 UT로 내렸다.
- 총량/0건 기준: AC2·AC12의 "전부"·"같다"는 양방향 차집합으로 본다. AC8의 0줄은 부재 단언이라 대상 경로를 `app`·`.github`로 고정했다.
- structural proxy: AC1·AC2·AC4의 검사는 판정·근거의 **존재**만 잠근다. 판정의 옳고 그름은 verify의 재현(VP-02·VP-03)과 선언 경계 2가 다룬다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 신규 handoff이고 상속할 V가 없다. 0315의 V1 rev.2는 대상 6구간과 두 축 판정에 묶여 있어 일부 변경(Delta)으로 표현되지 않는다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1·AC2 구간·단위 판정 전수 | NEW | — |
| R-02 | R | §7 AC3~AC6·AC11 후보·전제·조건·대상 제외·연결 | NEW | — |
| R-03 | R | §7 AC7·AC10 감량 합 판정 | NEW | — |
| R-04 | R | §7 AC8 무변경 | NEW | — |
| R-05 | R | §7 AC9 문서 = 데이터 | NEW | — |
| R-06 | R | §7 AC12 대상 목록 = 명령 출력 | NEW | — |
| AT-01~AT-06 | AT | 위 R의 검증 수단 | NEW | — |
| AR-01 | AR | §9 `audit.json` → 렌더 → `audit.md` 사본 경계 | NEW | — |
| IT-01 | IT | 검사 K10 | NEW | — |
| MD-01 | MD | §10 EP-02 `extractUnits()` 추출 규칙 | NEW | — |
| MD-02 | MD | §10 EP-05 `check()` 규칙 K1~K11 | NEW | — |
| MD-03 | MD | §10 EP-06 `ruling()` 갈래 3 | NEW | — |
| MD-04 | MD | §10 EP-10 `deriveTargets()` 규칙 7 | NEW | — |
| UT-01~UT-04 | UT | `scan/check.test.mjs` | NEW | — |

SD 레벨은 두지 않는다 — end-to-end 상태·수명주기를 가진 실행 시스템이 없다(산출이 문서와 일회 실행 검사기다).

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 기준 커밋 11파일 → `extractUnits` → `audit.json` `areas`·`units` → K1·K2 | `gate:node …/scan/check.mjs --check` | required — 전수 주장. 변이: 구간 판정 칸 1개 삭제 · 단위 1행 삭제 · 없는 단위 1행 추가 → red | EP-01(121칸) · EP-02(98단위) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 감사 판단 → `candidates` → K3~K9 | 같은 gate | required — 구조 proxy. 변이: 전제 칸 1개 삭제 · 자리를 테스트 파일로 교체 · 유령 후보 ID 지목 → red. 검증자가 **통과 후보 전부**와 통과하지 못한 후보 최대 3건의 전제 근거 명령을 재실행해 N 일치를 본다 | EP-03(12칸) · EP-04(3칸) · EP-08(5패턴) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `candidates` → `ruling()` → `audit.md` `ruling` 블록 → `verify.md` 판정 | `scan/check.test.mjs` UT-03 · `gate:node …/scan/check.mjs --ruling` · 사람(AC10) | required — 판정이 데이터에 민감한지. 변이: 통과 후보 1건의 전제 1칸을 `blocks`로 뒤집기 → `P`·합 변화. 검증자가 L6 `none` 단위 5개의 짝 검색을 재실행한다 | EP-06(갈래 3 · 경계 2) · EP-07(3심볼) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 작업 트리 → `git diff` | `gate:git diff --stat 1168b67..HEAD -- app .github` | not selected — 직접 관측 | 0 — 부재 단언이라 강제 자리 없음 |
| VP-05 | R-05 ↔ AT-05 · AR-01 ↔ IT-01 | REQUIRED | `audit.json` → `render()` → `audit.md` 생성 블록 | `gate:node …/scan/check.mjs --check`(K10) | required — 변이: 생성 블록 문자 1개 수정 · 블록 1개 삭제 → red | EP-09(사본 3곳) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 기준 커밋 트리 · 읽은 파일 기록 3곳 → `deriveTargets()` → `AREAS` 대조(K11) | `gate:node …/scan/check.mjs --check`(K11) · `gate:node …/scan/check.mjs --targets` | required — 전수 주장. 변이: `AREAS`에서 1파일 삭제 · `AREAS`에 대상 아닌 파일 1개 추가 → red | EP-10(11파일 · 규칙 7) |
| VP-07 | MD-01 ↔ UT-01 | REQUIRED | 파일 본문·구간 → `extractUnits()` → 단위 집합 | `scan/check.test.mjs` — EP-02 패턴 P1~P5 각각 1입력 + U6·U7 각각 1입력 | not selected — 행동 oracle | EP-02 패턴 5 + 규칙 2 |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | fixture 데이터 → `check()` → 위반 목록 | `scan/check.test.mjs` — K1~K11의 red 조건마다 1입력 + 전부 유효한 green 1 | not selected — 행동 oracle | EP-05(조건 42) |
| VP-09 | MD-03 ↔ UT-03 | REQUIRED | 후보 배열 → `ruling()` → 판정 | `scan/check.test.mjs` — EP-06 갈래마다 입력(표의 UT 입력 칸) | not selected — 행동 oracle | EP-06(갈래 3 · 경계 2) |
| VP-10 | MD-04 ↔ UT-04 | REQUIRED | 파일 목록·줄 수·읽은 집합 → `deriveTargets()` → 대상 집합 | `scan/check.test.mjs` — EP-10 규칙 T1~T7 각각 입력(표의 UT 입력 칸) | not selected — 행동 oracle | EP-10 규칙 7 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| 감사 검사 | 산출물의 완결성 | `node …/scan/check.mjs --check` | 이번 산출물 |
| 검사기 자체 테스트 | 검사 규칙·추출·판정·대상 유도의 민감도 | `node --test docs/handoff/0317-wide-bloat-audit-stage1/scan/*.test.mjs` | 이번 산출물 |
| 문서 가드 | `INDEX.md`는 링크 검사 대상이다 | `cd app && node scripts/check-doc-inventory.mjs --check` — 기준선에서 `links ok` 관측(이번 턴) | 이번 변경이 깬 링크만 |
| trailer 파싱 | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 이번 커밋 |
| 무변경 | D-001 | AC8 명령 | `app`·`.github` |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 0305가 읽은 파일을 기계로 읽을 수 있게 남긴 자리는 `data/deep.json`·`data/reviews.json`의 `reviews[].read` 배열이다 | 두 파일의 키 = `bucket`/`scenario` · `read` · `verdicts`. 합집합 51파일(이번 턴 집계) |
| 0315가 읽은 파일은 `scan/check.mjs` `AREAS`의 5파일이다 | `AREAS.map(a => a.file)` 중복 제거 → `chatReducer.ts` · `chatStore.ts` · `session-context.ts` · `auth/store.ts` · `map.ts` |
| 0305 `traces.json`·`candidates.json`에만 이름이 있는 파일은 읽은 기록이 아니다 | `O/adapter.ts`는 `traces.json` 단계 1행(`sendMessage`)뿐 · `H/claude/composer/QuestionCard.tsx`는 C-35 자리 1건뿐 — 두 파일 모두 어느 `read` 배열에도 없다 |
| C-35(질문 응답 UI 상태 로직 2벌)는 닫혔다 | `0314 ledger.md:51` `CLOSED` — 0314 D-004. D-013에 따라 다시 올리지 않는다 |
| `en.ts`는 `typeof ko` 선언으로 `ko.ts`와 키 패리티를 컴파일 타임에 강제한다 | `S/i18n/resources/en.ts:2-3` 주석 · `:6` `import type { ko }` |
| 대상 파일에서 스트림 이벤트마다 바뀌는 `messages`를 구독하는 자리는 3곳이다 | `git grep -n 's\.messages' 1168b67 -- <11파일>` → `CanonicalBackgroundContent.tsx:61` · `LegacySubAgentTile.tsx:80·120` |
| main 대상 4파일에는 스트림 이벤트 소비 루프가 없다 | `git show 1168b67:<파일> \| grep -n 'for await\|yield'` → `adapter.ts:88`(`install` 생성기 — 설치 안내 1회) 1건, 나머지 0 |
| 0316이 대상 파일 하나를 고쳤다 | `git diff --stat c1af29f 1168b67 -- <11파일>` → `LegacySubAgentTile.tsx` 1파일(+1 −5). 기준 커밋은 그 뒤다 |
| INDEX 후보 표의 0262 행이 `adapters/opencode`와 겹친다 | `0262 plan.md:4017` 종료 이관 목록. 승격 조건이 "사용자 요청"이라 범위에 넣지 않고 `formLock` 근거를 채울 때 입력으로 읽는다 |
| 0305 범주 X1~X7 정의 | `docs/handoff/0305-code-bloat-audit/plan.md:323-329` |

### 전수 조사 — 대상 파일과 판정 단위

유도 명령(기준 커밋 `1168b67`, 저장소 루트에서):

```bash
B=1168b67
for d in app/src/renderer/src/features/chat/harnesses app/src/main/adapters/opencode \
         app/src/main/app/chat-turn app/src/renderer/src/shared; do
  git ls-tree -r --name-only $B -- $d | grep -E '\.tsx?$' \
    | grep -vE '\.test\.|\.testfixture\.|\.d\.ts$' \
    | while read f; do n=$(git show $B:$f | wc -l); [ $n -ge 300 ] && echo "$n $f"; done
done | sort -k2 > big.txt          # 18행
# read.txt = 0305 deep.json·reviews.json 의 reviews[].read 합집합(51행) + 0315 AREAS 파일(5행)
awk '{print $2}' big.txt | grep -vxF -f read.txt   # 11행
```

| 단계 | 대상 | 검색 | N | 의미 |
|---|---|---|---:|---|
| 300줄 이상 | 4버킷 prod `.ts`·`.tsx` | 위 명령 `big.txt` | 18 | harnesses 6 · opencode 6 · chat-turn 2 · shared 4 — `0315 verify.md §13` 참고 실측과 같다 |
| 읽은 파일 제외 | `big.txt` ∩ 읽은 기록 | `grep -xF -f read.txt` | 7 | `channel.ts` · `session-context.ts` · `resolve-turn.ts` · `send.ts` · `ComposerInputController.tsx` · `FileDiffSection.tsx` · `ipc.ts` |
| 대상 | 차집합 | 마지막 줄 | 11 | 아래 표 |

| 구간 | 파일 | 줄 수 | 판정 단위 수 | 핫패스(D-015) |
|---|---|---:|---:|---|
| F01 | `O/adapter.ts` | 399 | 20 | 아니오 |
| F02 | `O/discovery-cache.ts` | 315 | 16 | 아니오 |
| F03 | `O/mcp-control.ts` | 335 | 18 | 아니오 |
| F04 | `O/server.ts` | 485 | 22 | 아니오 |
| F05 | `H/claude/composer/QuestionCard.tsx` | 325 | 3 | 아니오 |
| F06 | `H/claude/rightpanel/CanonicalBackgroundContent.tsx` | 410 | 5 | 예 |
| F07 | `H/claude/rightpanel/LegacySubAgentTile.tsx` | 346 | 4 | 예 |
| F08 | `H/common/rightpanel/GitContextBar.tsx` | 328 | 3 | 아니오 |
| F09 | `S/i18n/resources/en.ts` | 1,425 | 0 | 아니오 |
| F10 | `S/i18n/resources/ko.ts` | 1,434 | 1 | 아니오 |
| F11 | `S/ui/CascadeMenu.tsx` | 343 | 6 | 아니오 |

구간은 파일 전체다(1줄~마지막 줄). 구간 ID는 경로 사전순이다.

### 수치 / 전칭 표현 검산

- 줄 수 합: 399 + 315 + 335 + 485 + 325 + 410 + 346 + 328 + 1,425 + 1,434 + 343 = 6,145. 버킷별 대상 수 4(opencode) + 4(harnesses) + 0(chat-turn) + 3(shared) = 11.
- 단위 수 합: 20 + 16 + 18 + 22 + 3 + 5 + 4 + 3 + 0 + 1 + 6 = 98. 0315 `check.mjs`의 `extractUnits()`를 `git show 1168b67:<파일>` 전체 범위에 돌려 셌다.
- 18 − 7 = 11. 제외 7파일은 전부 `big.txt`에 있고 대상 11파일은 읽은 기록 56행 어디에도 없다(`grep -xF` 양방향).
- F09 단위 0: `export const en: typeof ko = {`가 P5(`const (\w+) = `)에 걸리지 않는다. 구간 11칸 판정이 덮는다(선언 경계 4).
- "3곳"·"1건" 검산: §8 표의 `git grep` 두 명령 출력 그대로다.
- 문서 앵커: `docs/handoff/AGENTS.md` `### 판정 범위와 운영 gate` · `## INDEX.md 운영` 실재(이번 턴 열람).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조

- 관련 V node: AR-01.
- 현재 책임 소유자: 대상 11파일의 과잉 판정은 없다. 0305 `deep.json`의 4버킷 행은 다른 파일을 읽고 낸 버킷 판정이고 범주는 X1~X7이다.
- 현재 흐름: 0315 `audit.json` → `ruling()` G4 → `0315 verify.md §13` 사용자 결정 → INDEX 후보 표 행.
- 구조적 제약: 0315 검사기는 구간 6개·기준 커밋·핫패스 심볼·두 축 판정을 상수로 갖는다(`0315 scan/check.mjs:9-66`).

```text
0315 audit.json → ruling() G4 → 사용자 결정(1단계 범위·종료 조건) → (미수행)
```

### TO-BE — 감사 산출 구조

- 관련 V node: AR-01 · MD-01~MD-04.
- 변경 후 책임 소유자: 11파일의 X1~X8·L1·L5·L6 판정과 전제 근거는 `…/data/audit.json`이 갖는다. 대상 목록은 `…/scan/check.mjs`의 `AREAS`가 갖고 `deriveTargets()`가 대조한다.
- 변경 후 흐름: 기준 커밋 11파일 → 감사자 판단 → `audit.json` → `check()` · `render()` · `ruling()` → `audit.md` → verify 판정 → 사용자.
- 변경 후 오류 경로: 검사 red면 단계가 끝나지 않는다. 전제가 걸린 후보는 `blocks`로 남아 합에서 빠진다.
- 유지하는 메커니즘: 0315의 "JSON 정본 → 생성 블록 렌더 → 바이트 비교". 0315 검사기는 import하지 않고 복사해 고친다(§11) — handoff 디렉토리는 제자리 보존 대상이라 서로 의존하지 않는다.

```text
git show 1168b67:<11파일> → (감사자) → data/audit.json
  → scan/check.mjs {deriveTargets · extractUnits · check · render · ruling}
  → audit.md 생성 블록 → verify.md 판정 → 종료 또는 사용자 결정
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS (0315) | TO-BE (0317) | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 대상 | 손으로 정한 6구간(줄 범위) | 명령으로 유도한 11파일(전체) | D-002~D-004 | R-06 / VP-06·VP-10 · K11 |
| 방법·스키마 | X1~X8 · L1·L4·L5·L6 · 12칸 · 전제 3 · 조건 2 | 같음 | D-005 | R-01·R-02 / VP-01·VP-02 |
| 판정 | 두 축(구현 건수 · 넓은 감사) | 감량 합 한 축(종료 / 사용자 결정) | D-008 | R-03 / VP-03·VP-09 |
| 핫패스 심볼 | 이벤트 변환·반영 진입 6개 | `messages` 구독 컴포넌트 3개 | D-015 | EP-07 |
| `agentsRule` 범위 | AGENTS · `docs/arch` · `docs/decisions` | 그 범위 + 0305 계열 handoff Decision · `0314 ledger.md` | D-014 | §9 전제 표 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `…/data/audit.json` | 감사 판단의 정본 | 사람 작성 | 검사 · 렌더 |
| `…/scan/check.mjs` | 대상 유도 · 단위 추출 · 검사 · 렌더 · 판정 | `audit.json` + `facts` → 위반 목록 / 생성 블록 / 판정 | 감사자 · 검증자 |
| `…/audit.md` | 사용자가 읽는 문서 | 해설 + 생성 블록 | 사용자 · verify |

### 감사 방법 — 렌즈와 범주

| 렌즈 | 묻는 것 | 방법(분모) | 후보 유형 |
|---|---|---|---|
| L1 미도달 | 구간 안에 호출·도달 경로가 없는 코드가 있는가 | 판정 단위 98개 — 단위마다 non-test 호출부를 `rg`로 센다 | `remove` |
| L4 경로 과잉 | 구간이 그 조작에 필요한 것보다 많은 요소를 쓰는가 | 구간 11개 × 범주 X1~X8 | `restructure` · `remove` |
| L5 하네스 중복 | Claude·OpenCode 병렬 구현이 같은 일을 두 번 하는가 | 하네스 디렉토리 아래 7구간(F01~F07) — 반대 하네스의 같은 역할 파일을 찾아 쌍 또는 "짝 없음"을 근거 칸에 적는다 | `merge` |
| **L6 판정·조립 중복(주 렌즈)** | 같은 판정·조립이 한 파일 안 또는 main↔renderer에 두 번 이상 있는가 | 판정 단위 98개 — 단위마다 (가) 같은 파일 (나) 반대 프로세스에서 짝을 찾는다 | `merge` |

- L5의 반대 하네스: F01~F04는 `app/src/main/adapters/claude/` · F05~F07은 `H/opencode/`. F08(`common/`)과 F09~F11(`shared/`)은 하네스 공용이라 L5 칸은 `none`이고 근거에 "하네스 공용"을 적는다.
- L6의 짝 찾기: 단위가 내리는 판정(조건식의 주어·비교 값)과 조립(만드는 객체의 필드 집합)을 한 문장으로 적고 그 주어·필드 이름으로 `rg`를 돌린다. 범위는 (가) 그 파일 전체 (나) renderer 단위면 `app/src/main` + `app/src/shared`, main 단위면 `app/src/renderer/src` + `app/src/shared`다. 근거 칸에는 **실제로 돌린** 명령과 N을 적는다 — 하한은 단위 이름 검색이다(0315 verify 발견 2).
- F09·F10(i18n 리소스): 두 파일의 키 구조 중복은 `typeof ko`가 강제하는 번역 패리티다. L6 후보로 올리려면 한 언어 안에서 같은 문구·같은 조립이 되풀이되는 자리를 근거로 댄다.
- 이미 오른 형태(D-013): 0305 `C-NN`·0315 `B-NN`과 같은 자리·같은 중복이면 후보로 올리지 않고 구간 근거에 `C-35(CLOSED, 0314 D-004)`처럼 적는다.

과잉 범주 X1~X7은 0305 정의를 그대로 쓴다(`0305 plan.md:323-329`). X8은 0315 정의다:

| # | 범주 | 후보가 되는 형태 |
|---|---|---|
| X8 | 한 함수·파일에 물린 책임 | 한 함수가 서로 다른 관측 결과를 내는 일을 둘 이상 하고, 그 때문에 같은 판정·조립이 함수 안에서 되풀이되는 것 · 한 파일의 모듈 전역 상태를 무관한 책임 둘 이상이 함께 쓰는 것 |

X8은 책임을 가르는 것만으로 줄이 늘면 후보가 아니다(`saving.prod` ≥ 1이 필수, K8). 모듈 경계를 없애는 방향의 후보는 `keepStructure` 칸에 무엇을 남기는지 적는다.

전제 3칸의 판정 기준(0315와 같고 `agentsRule` 범위만 D-014로 넓다):

| 칸 | 묻는 것 | `blocks`인 경우 | 근거로 적는 것 |
|---|---|---|---|
| `raceGuard` | 두 자리 사이에 비동기 경계(`await` · IPC 왕복 · 타이머·코얼레서·rAF · React 렌더 경계)가 끼어 있고 뒤 자리가 그 사이 상태 변화를 다시 확인하는가 | 그렇다 — 뒤 판정은 중복이 아니라 재확인이다 | 두 자리 사이의 경계 `파일:줄` 또는 "경계 없음"을 보인 `rg` 명령+N |
| `formLock` | 그 형태(두 자리의 존재·호출 순서·시그니처)를 잠그는 테스트·가드가 있는가 | 그렇다 — 합치려면 테스트·가드를 바꿔야 한다(D-006으로 대상 밖) | 자리의 심볼을 참조하는 `*.test.*` · `app/eslint.config.mjs` · `app/scripts/*.mjs`에 대한 `rg` 명령+N과 형태를 잠그는 케이스의 `파일:테스트명` |
| `agentsRule` | 채택 규칙·결정이 그 형태를 정했는가 | 그렇다 — 바꾸려면 채택 결정을 바꿔야 한다 | `AGENTS.md`(root · `app/` · `app/src/main/` · `app/src/renderer/`) · `docs/arch/**` · `docs/decisions/**` · `docs/handoff/03{05..16}-*/plan.md` Decision Ledger · `0314 ledger.md`에 대한 `rg` 명령+N과 해당 문장의 `파일:줄` |

동작만 잠그는 테스트(결과 단언)는 `formLock`의 `blocks`가 아니다 — 회귀 그물이므로 조건 칸 `ui`의 근거로 적는다.

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 / VP-01 | 구간 → 범주·렌즈 판정 | `check.mjs` `AREAS` | 검사 K1 | 구간 11 × 칸 11 = 121칸 | §8 대상 표 11행 × 아래 칸 목록 11 | 판정 없이 넘어간 범주·렌즈 |
| EP-02 / VP-01·VP-07 | 구간 → 판정 단위 | `check.mjs` `extractUnits()` | 검사 K2 · UT-01 | 단위 98개(§8 표의 구간별 수) · 추출 패턴 5 + 규칙 2 | `node …/scan/check.mjs --units \| wc -l` → 98 | L6 짝을 찾지 않고 넘어간 판정·조립 |
| EP-03 / VP-02 | 후보 필수 칸 | `audit.json` 스키마 | 검사 K3·K4·K8·K9 | 칸 12 × 후보 수 | 아래 칸 목록 12 | 근거 없는 후보가 합에 든다 |
| EP-04 / VP-02 | 전제 확인 칸 | 같은 스키마 | 검사 K5 | 칸 3 × 후보 수 | 아래 칸 목록 3 | 전제를 확인하지 않은 후보가 통과로 세어짐 |
| EP-05 / VP-08 | 검사 규칙 | `check.mjs` `check()` | UT-02 | 규칙 K1~K11의 red 조건 42개(아래) | 아래 규칙 표의 조건 수 합 | 검사가 green인데 표가 불완전 |
| EP-06 / VP-03·VP-09 | 감량 합 판정 | `check.mjs` `ruling()` | UT-03 · verify | 갈래 3 + 경계 입력 2(아래) | 아래 갈래 표 3행 | 데이터와 다른 판정 — 계열이 잘못 끝나거나 잘못 이어짐 |
| EP-07 / VP-03 | 핫패스 진입 심볼 | `check.mjs` `HOT_ENTRIES` | 검사 K8 | 심볼 3: `CanonicalBackgroundContent` · `LegacySubAgentHeader` · `LegacySubAgentContent` | `git grep -n 's\.messages' 1168b67 -- <11파일>` → 3줄(`:61` · `:80` · `:120`), 각 줄을 품은 함수 정의 `:58` · `:75` · `:116` | 성능 근거 없이 핫패스 후보가 통과 |
| EP-08 / VP-02 | 대상 제외 | `check.mjs` `EXCLUDED` | 검사 K4 | 패턴 5(아래) | 아래 패턴 목록 5 | D-006 대상 밖 파일이 후보로 오름 |
| EP-09 / VP-05 | 판정 사본 일치 | `audit.json` | 검사 K10 · verify | 사본 3곳: `audit.md` 생성 블록 · `verify.md` 판정 절 · `INDEX.md` 비고 | `rg -c '^<!-- gen:' …/audit.md` → 5 · `verify.md`는 `--ruling` 출력 인용 · INDEX 0317 행 | 문서와 데이터가 다른 말을 함 |
| EP-10 / VP-06·VP-10 | 대상 목록 유도 | `check.mjs` `deriveTargets()` | 검사 K11 · UT-04 | 대상 11파일(§8 표) · 규칙 7(아래) | `node …/scan/check.mjs --targets` → §8 표와 같은 11행 | 읽은 파일을 다시 감사하거나 대상 파일을 빠뜨림 |

**EP-01 칸 목록**: `X1` `X2` `X3` `X4` `X5` `X6` `X7` `X8` `L1` `L5` `L6`. 값은 후보 ID 배열 또는 문자열 `"none"`. L4 판정은 X1~X8 칸이 갖는다.

**EP-02 추출 규칙** (0315와 같다 · 규칙 칸 ↔ UT-01 입력 1:1). 구간의 줄마다 위에서부터 첫 일치만 쓴다. 캡처 1이 단위 이름이다.

| # | 패턴(JS 정규식) | UT-01 입력 |
|---|---|---|
| P1 | `^(?:export )?(?:async )?function (\w+)` | `export function CascadeMenu(props) {` → `CascadeMenu` |
| P2 | `^  (?:(?:private\|public\|static\|readonly) )*(?:async )?(?!if\b\|for\b\|while\b\|switch\b\|return\b\|constructor\b)(\w+)\(` | `  async reconcile(signal) {` → `reconcile` · `  if (x) {` → 단위 아님 |
| P3 | `^\s+case '([^']+)':` | `      case 'connected':` → `connected` |
| P4 | `^  if \(msg\.type === '(\w+)'` | `  if (msg.type === 'result') {` → `result` |
| P5 | `^(?:export )?const (\w+) = ` | `const HANDLED_KEYS = new Set([` → `HANDLED_KEYS` · `export const en: typeof ko = {` → 단위 아님 |
| U6 | 구간 줄 범위 밖의 줄은 보지 않는다 | 범위 밖에 `function x(` 1줄 → 단위 0 |
| U7 | 한 구간 안에서 같은 이름은 첫 등장 1개만 단위다 | `  useEffect(` 2줄 → 단위 1 |

- 단위는 `구간 ID + 이름`으로 식별한다. P2는 2칸 들여쓴 호출식(`useEffect(` 등)도 잡는다 — 그 이름도 단위로 두고 근거 칸에 그 호출들이 하는 일을 적는다(분모는 이 규칙의 출력이다).
- 본문은 작업 트리가 아니라 `git show 1168b67:<파일>`에서 읽는다.

**EP-03 후보 필수 칸** (0315와 같다): `id`(`W-NN`) · `area`(F01~F11) · `lens`(L1·L4·L5·L6) · `type`(`merge`·`restructure`·`remove`) · `sites`(`파일:줄` 배열) · `duplicate` · `preserve` · `keepStructure` · `saving`(`{prod, basis}` — `prod`는 1 이상 정수) · `hotEntry`(EP-07 심볼 또는 `null`) · `premises`(EP-04) · `conditions`(`{ui:{verdict,evidence}, perf:{verdict,evidence}}`). 조건부 필수: `excess`(X1~X8 배열) — `lens=L4`면 1개 이상. 선택 칸: `approval`(`required`/`none`) — `type=remove`면 `required`가 필수다.

- enum: `premises.*.verdict` = `clear`·`blocks` · `conditions.ui.verdict` = `safe`·`risk` · `conditions.perf.verdict` = `equal_or_better`·`worse`·`unknown`.
- `saving.prod`는 non-test 제품 코드 줄 수다. 한 후보가 여러 구간에 걸치면 `area`는 자리가 가장 많은 구간이고 감량은 한 번만 센다.
- `hotEntry`가 `null`이 아니면 `conditions.perf.evidence`에 그 컴포넌트의 렌더에서 자리까지의 호출 사슬과 렌더당 호출·할당 수 변화를 적는다.

**EP-04 전제 칸**: `premises.raceGuard` · `premises.formLock` · `premises.agentsRule` — 각각 `{verdict, evidence}`. 판정 기준은 §9 표다.

**EP-05 검사 규칙** (규칙 칸 ↔ UT-02 red 입력 1:1, 전부 유효한 입력 1건은 green). K1~K10은 0315와 같고 구간 집합만 F01~F11이다.

| # | red 조건 | 조건 수 | UT-02 입력 |
|---|---|---:|---|
| K1 | 구간 집합 ≠ {F01…F11} / 11칸 중 판정 없는 칸 / 판정 값이 배열도 `"none"`도 아님 / `basis` 빈 값 | 4 | 구간 1개 삭제 · `X8` 칸 삭제 · 값 `"x"` · `basis: ""` |
| K2 | 추출 단위가 `units`에 없음 / `units`에 추출되지 않은 단위 / 같은 단위 2행 / `l6` 판정 없음·값 형식 오류 / `basis` 빈 값 | 5 | 단위 1행 삭제 · 유령 단위 추가 · 행 복제 · `l6` 삭제 · `basis: ""` |
| K3 | 후보 필수 칸 누락 또는 빈 값 / 미지 키 / 미지 enum(`area`·`lens`·`type`) / `id` 중복 | 4 | 12칸 각각 제거(12입력) · 키 `x` 추가 · `type: "x"` · 같은 `id` 2건 |
| K4 | 자리 형식이 `파일:줄`이 아님 / 파일이 기준 커밋에 없음 / 줄이 파일 길이 초과 / `lens=L6`인데 자리 2 미만 / 후보 구간 범위 안의 자리 0 / 자리가 EP-08 패턴에 걸림 | 6 | 여섯 조건 각각 1입력(EP-08은 패턴 5개 각각 1입력) |
| K5 | 전제 칸 3개 중 누락 / `verdict` enum 밖 / `evidence` 빈 값 | 3 | 칸 3개 각각 제거(3입력) · `verdict: "ok"` · `evidence: ""` |
| K6 | 조건 칸 `ui`·`perf` 누락 / `verdict` enum 밖 / `evidence` 빈 값 | 3 | 칸 2개 각각 제거 · `verdict: "x"` · `evidence: ""` |
| K7 | 구간·단위 칸의 후보 ID 미실재 / 지목한 후보의 `area` 불일치 / 구간 칸의 범주·렌즈와 후보의 `excess`·`lens` 불일치 / 단위 `l6`이 `lens≠L6` 후보를 지목 / 어느 구간 칸에도 없는 후보 / 어느 단위에도 없는 L6 후보 | 6 | 여섯 조건 각각 1입력 |
| K8 | `saving.prod`가 1 이상 정수가 아님 / `saving.basis` 빈 값 / `hotEntry`가 EP-07 심볼도 `null`도 아님 / `lens=L4`인데 `excess` 없음·X1~X8 밖 | 4 | `prod: 0` · `prod: 1.5` · `basis: ""` · `hotEntry: "send"` · `excess: []` · `excess: ["X9"]` |
| K9 | `type=remove`인데 `approval≠required` / 승인 블록과 `remove` 집합 불일치 | 2 | `approval` 삭제 · 승인 블록에서 1행 삭제 |
| K10 | `audit.md` 생성 블록 ≠ 렌더 결과 / 필수 블록 5개 중 누락 / 최상위 미지 키 | 3 | 문자 1개 수정 · 블록 삭제 · 최상위 키 `x` 추가 |
| K11 | 유도 대상인데 `AREAS`에 없는 파일 / `AREAS`에 있는데 유도 대상이 아닌 파일 | 2 | `facts`에 대상 조건을 만족하는 파일 1개 추가 · `AREAS` 파일 1개를 `facts`의 읽은 집합에 추가 |

조건 수 합 = 4 + 5 + 4 + 6 + 3 + 3 + 6 + 4 + 2 + 3 + 2 = 42 = EP-05 분모.

**EP-06 감량 합 판정** (D-007·D-008 · 규칙 칸 ↔ UT-03 입력 1:1). 통과 후보 `P` = 전제 3칸 모두 `clear` ∧ `ui=safe` ∧ `perf=equal_or_better`. `sum` = `P`의 `saving.prod` 합(`P` = ∅이면 0). `LIMIT` = 30.

| # | 조건 | 판정 | UT-03 입력 |
|---|---|---|---|
| R1 | `P` = ∅ | `0305 계열 종료` (`sum` 0) | 후보 0건 · 후보 2건 모두 전제 1칸 `blocks`(각 40줄) · 후보 1건 `perf=unknown` 50줄 · 후보 1건 `ui=risk` 50줄 |
| R2 | `P` ≠ ∅ ∧ `sum` < 30 | `0305 계열 종료` | 통과 2건(20줄 · 9줄, `sum` 29) · 통과 1건 5줄 + 막힌 1건 100줄(`sum` 5) |
| R3 | `sum` ≥ 30 | `다음 단계 사용자 결정` | 통과 2건(15줄 · 15줄, `sum` 30 — 각각은 30 미만) · 통과 1건 30줄 · 통과 1건 31줄 + 막힌 1건 1줄 |

- 경계 입력 2: `sum` 29는 종료, 30은 사용자 결정이다(R2·R3 입력이 양쪽을 갖는다). 합으로 판정하므로 "각 후보가 30 미만"인 입력(15 + 15)이 R3에 든다 — 0315의 후보별 소형 판정과 다르다.
- `ruling()`은 `{verdict, sum, limit, P, blocked, total}`을 낸다 — `P`는 통과 후보 ID와 각 `saving.prod`, `blocked`는 통과하지 못한 후보 ID와 걸린 칸, `total`은 전체 후보의 `saving.prod` 합(민감도 표시용)이다. 판정은 저장하지 않고 렌더 때 계산한다.
- `hotEntry`·`lens`는 판정에 쓰지 않는다(D-015).

**EP-07 핫패스 심볼**: 위 표의 3개. 대상 파일의 다른 컴포넌트·main 4파일의 함수는 `hotEntry: null`이다.

**EP-08 제외 패턴** (0315와 같다 · 자리 경로에 대해 하나라도 일치하면 red): `\.test\.[cm]?[jt]sx?$` · `\.testfixture\.` · `^app/scripts/` · `^\.github/` · `^app/src/main/adapters/claude/mock`.

**EP-09 생성 블록 5개**: `areas`(구간 × 11칸 + 근거) · `units`(구간별 단위 · L6 판정 · 근거) · `candidates`(필수 칸 + 통과 여부) · `premises`(후보 × 전제 3칸 · 조건 2칸) · `ruling`(판정 · `sum` · `P` · `total` · 승인 목록).

**EP-10 대상 유도 규칙** (D-002·D-003 · 규칙 칸 ↔ UT-04 입력 1:1). `deriveTargets({files, read})` — `files`는 `[{path, lines}]`(기준 커밋 트리 전체), `read`는 읽은 파일 경로 집합이다. 파일이 T1~T6을 모두 통과하면 대상이다.

| # | 규칙 | UT-04 입력 |
|---|---|---|
| T1 | 경로가 4버킷 접두사 중 하나로 시작한다 — `app/src/renderer/src/features/chat/harnesses/` · `app/src/main/adapters/opencode/` · `app/src/main/app/chat-turn/` · `app/src/renderer/src/shared/` | 버킷마다 통과 1입력(4) · `app/src/main/adapters/claude/x.ts` 400줄 → 제외 · `app/src/renderer/src/shared-x/y.ts` 400줄 → 제외 |
| T2 | 확장자가 `.ts` 또는 `.tsx`다 | `…/shared/a.tsx` 통과 · `…/shared/a.css` 400줄 → 제외 |
| T3 | 경로가 `\.test\.` · `\.testfixture\.` · `\.d\.ts$`에 걸리지 않는다 | 세 패턴 각각 400줄 1입력 → 제외 |
| T4 | `lines` ≥ 300 (`lines` = 본문의 개행 수, `wc -l`과 같다) | 299 → 제외 · 300 → 대상 |
| T5 | 경로가 `read`에 없다 | `read`에 든 400줄 파일 → 제외 · 같은 이름의 다른 디렉토리 파일은 대상 |
| T6 | 출력은 경로 사전순이고 중복이 없다 | 역순 입력 2파일 → 사전순 출력 |
| T7 | `read` = 0305 `deep.json`·`reviews.json`의 `reviews[].read` 합집합 ∪ `READ_0315`(5파일 상수) — CLI 껍질이 모은다 | `collectRead({deep, reviews, extra})`: 두 JSON에 1파일씩 + `extra` 1파일 → 3파일 · 두 JSON에 같은 파일 → 1파일 |

- `READ_0315`는 0315 `check.mjs`를 import하지 않고 5경로를 상수로 옮긴다(§8 표 2행). 옮긴 값은 UT-04가 `0315 scan/check.mjs` 본문의 `AREAS` 파일과 차집합 0임을 `node --test`에서 본다.
- 줄 수와 파일 목록은 `git ls-tree -r --name-only 1168b67` · `git show 1168b67:<파일>`에서 얻는다.

**공통**

- 자리 목록과 검색 출력의 차집합은 0이어야 한다. `--units` 출력이 98이 아니거나 구간별 수가 §8 표와 다르거나 `--targets` 출력이 §8 표 11행과 다르면 `PLAN_GAP`이다.
- 열린 입력 집합: 검사 입력은 이 plan이 정한 JSON 스키마다. 모르는 키·enum은 K3·K10으로 red(fail-closed). `deriveTargets`는 규칙 T1~T5를 모두 통과한 파일만 대상으로 낸다(모르는 형태는 대상이 아니다) — 놓친 대상은 K11이 아니라 T1~T4의 규칙 문장으로 닫는다(선언 경계 8).
- 같은 규칙의 공유: 추출 패턴·제외 패턴·핫패스 심볼·버킷 접두사는 `…/scan/check.mjs` 한 곳에만 둔다.
- 선택적 칸: `approval` 미지정은 `type≠remove`일 때만 `none`으로 읽고, `remove`에서 미지정이면 K9 red.

**선언 경계** (verify는 이 안의 반례를 판정에 쓰지 않는다. 1~7은 0315와 같다):

1. 감사 후보는 하한이다. 렌즈가 찾지 못한 중복은 결함이 아니다 — L6의 짝 찾기는 단위마다 적은 `rg` 명령의 범위까지다.
2. 범주·렌즈 판정과 전제·조건 판정, D-013의 "이미 오른 형태" 판정은 감사자의 판단이다. 검사는 판정·근거의 존재와 연결만 본다 — 옳고 그름은 verify의 재현(VP-02: 통과 후보 전부 + 그 밖 최대 3건 · VP-03: `none` 단위 5개)으로만 본다.
3. `saving.prod`는 추정이다. 검사는 형식과 하한(1)만 본다. verify는 `sum`이 25~34이면 통과 후보 전부의 `basis`를 다시 센다.
4. 판정 단위는 EP-02 규칙의 출력이다. 규칙이 잡지 못하는 형태(중첩 화살표 함수 · 3칸 이상 들여쓴 메서드 · 객체 리터럴 메서드 · 타입 주석이 붙은 `const`)는 단위가 아니고, 그것을 품은 바깥 단위나 구간 11칸 판정이 덮는다. F09는 단위 0이다.
5. 구간 밖 코드는 L5·L6 짝으로만 나타난다. 구간 밖 자리만으로 된 후보는 없다(K4).
6. `perf` 판정은 호출 수·할당 수·렌더 수의 정적 비교다. 실행 시간은 재지 않는다 — 측정이 필요한 후보는 `unknown`으로 두어 통과에서 뺀다.
7. `formLock`의 "형태를 잠그는가"는 감사자가 테스트 본문을 읽고 내린다. 검사는 근거 문자열의 존재만 본다.
8. "읽은 파일"은 D-003의 기록 3곳에 이름이 있는 파일이다. 일부 구간만 읽힌 4파일(`channel.ts` · `ComposerInputController.tsx` · `FileDiffSection.tsx` · `ipc.ts`)의 나머지 구간과, 기록 없이 실제로는 읽혔을 수 있는 파일은 다루지 않는다.
9. 대상은 기준 커밋 `1168b67`의 줄 수로 고정한다. 그 뒤 `main`에서 300줄을 넘거나 밑돈 파일은 다루지 않는다.

## 11. 구현 설계

| 신규 파일 | 책임 | 내용 | 테스트 seam |
|---|---|---|---|
| `…/scan/check.mjs` | 대상 유도·추출·검사·렌더·판정 | 0315 `scan/check.mjs`를 복사해 아래 차이만 고친다. 순수 함수 `deriveTargets` · `collectRead` · `extractUnits` · `check` · `render` · `ruling` + CLI 껍질(`--check`·`--write`·`--units`·`--ruling`·`--targets`) | 여섯 함수 단위 |
| `…/scan/check.test.mjs` | UT-01~UT-04 | 0315 테스트를 복사해 UT-03을 EP-06 갈래 3으로 바꾸고 K11·UT-04를 더한다 | `node --test` |
| `…/data/audit.json` | 감사 정본 | `{base, progress, areas[], units[], candidates[]}` | 검사 |
| `…/audit.md` | 사용자 문서 | 진행표 · 요약 · 생성 블록 5 · 재현 방법 | 검사 K10 |

0315 `check.mjs` 대비 차이(이 목록 밖의 변경은 구현 보고에 적는다):

| # | 자리 | 0315 | 0317 |
|---|---|---|---|
| 1 | `BASE` | `c1af29f` | `1168b67` |
| 2 | `AREAS` | A1~A6(줄 범위) | F01~F11(파일 전체 — `ranges: [[1, 줄 수]]`) |
| 3 | `HOT_ENTRIES` | 6심볼 | EP-07의 3심볼 |
| 4 | `ruling()` · `ruling` 블록 렌더 | 두 축 · `bundles` · `H` | EP-06 — `verdict` · `sum` · `P` · `blocked` · `total` |
| 5 | 후보 `id` 접두 | `B-` | `W-` |
| 6 | 신규 | — | `BUCKETS` · `READ_0315` · `deriveTargets()` · `collectRead()` · K11 · `--targets` |

스키마(0315와 같다): `areas[] = {id, verdicts{X1..X8,L1,L5,L6}, basis}` · `units[] = {area, name, l6, basis}` · `candidates[]` = EP-03.

감사 단계(단계가 끝날 때마다 검사 green 확인 후 커밋·push — 세션이 끊겨도 이어받는다):

| 단계 | 산출 | 내용 |
|---|---|---|
| P1 | `scan/check.mjs` · 테스트 · `units` 뼈대 | 검사기와 UT. `--targets` 11행 · `--units` 98을 확인. `audit.md` 진행표 |
| P2 | F01~F04 판정 | main 4파일 1,534줄 — 전부 읽고 구간 11칸 · 단위 L6 · 후보. L5 짝은 `adapters/claude/` |
| P3 | F05~F11 판정 | renderer 7파일 4,611줄 — 같은 방식. main↔renderer L6 짝은 여기서 닫는다 |
| P4 | 전제·조건 근거 · `audit.md` 완성 | 후보마다 전제 3칸·조건 2칸의 명령을 실행해 근거를 채우고 렌더 |

### 테스트 가능성

- 순수 파일: 여섯 함수는 `git`·파일 시스템을 받지 않는다. CLI 껍질이 `facts`(`{fileAt(path) → 본문 또는 null, files[], read}`)를 모아 넘긴다.
- 의존성: Node 내장 모듈만 쓴다. `app/node_modules` 없이 돈다.
- 미완성 단계: `progress`(`P1`…`P4`)가 완료를 선언하기 전의 빈 판정은 "대기"로 보고하고, 선언 뒤에는 red다(0315와 같다). K11은 P1부터 대기 없이 red다.

## 12. End-to-end 영향

```text
(감사자) data/audit.json → check.mjs render·ruling → audit.md → verify.md 판정 → 사용자
```

- producer 기준: JSON이 정본이다. 통과 여부·합·판정은 저장하지 않고 렌더 때 계산한다.
- consumer 파생 규칙: 후속 문서는 후보를 `0317 W-NN`으로 인용한다.
- 부팅/등록 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: impl 턴이 P1부터. `audit.md` 머리에 기준 커밋과 진행표를 둔다.
- 중단/재개: 단계마다 커밋·push. 다음 세션은 진행표와 `progress`를 읽고 이어간다.
- 부분 실패: 단계 검사가 red면 다음 단계로 넘어가지 않는다.
- 다중 저장소 쓰기: 판정 사본은 `audit.json` → `audit.md` 생성 블록 → `verify.md` 판정 절 → `INDEX.md` 비고다. 앞 둘은 K10이 잠근다. `verify.md`는 `--ruling` 출력을 그대로 인용하고 `INDEX.md` 비고에는 판정 문자열 하나와 링크만 둔다.
- 종료 판정 뒤 정리(verify 턴): INDEX 후보 표의 0315 "넓은 감사 1단계" 행에 결과를 적는다. `0305 계열 종료`면 0305 계열 보드 행(0305~0316)의 남은 사람 실기는 그대로 둔다 — 종료는 새 감량 handoff를 열지 않는다는 뜻이다.

## 14. 성능 / 상한 / 최적화

- 새 CI 부하: 0. 산출은 `docs/handoff/` 아래라 `ci.yml` paths 필터와 `npm test`의 `scripts/*.test.mjs` glob에 들지 않는다.
- 구조적 목표: 이번 handoff에는 줄 수 감축 목표가 없다.
- 읽는 양: 11파일 6,145줄 전부 + L5·L6 짝 검색으로 닿는 구간 밖 자리. 그중 2,859줄이 i18n 리소스다. 구간을 줄여 읽지 않는다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 넓은 감사 1단계 범위·종료 조건 | `0315 verify.md §13` | D-002·D-008 · §5 상태 표 | 유지 — "다음 단계 여부를 다시 사용자에게 올린다"가 D-009다 |
| 0305 `audit.md`·`data/*.json` 불변 | 0314 D-008 | §6 비범위 · EP-10 T7(읽기만) | 유지 |
| 0315 산출 불변 | `docs/handoff/INDEX.md` 머리말 "제자리 보존" | §9 TO-BE "import하지 않고 복사" | 유지 |
| 서브·백그라운드 에이전트 금지 | 0305 D-006 · 0315 D-011 | §0 · D-010 · §19 | 유지(승계) |
| 후보 표 0314 "SDK 메시지 층 mock" 행은 0305 계열에서 제외 | `INDEX.md` 후보 표 | D-006 · EP-08 5번째 패턴 | 유지 |
| C-35 종결 | `0314 ledger.md:51` | D-013 · §8 | 유지 — 다시 올리지 않는다 |
| 대상 커밋 좌표는 검증자가 기입 | `docs/handoff/AGENTS.md §INDEX.md 운영` | 메타 기준 커밋(확인한 해시만) · INDEX 자리표시자 | 유지 |
| 코드에서 셀 수 있는 수치를 문서에 적지 마라 | root `AGENTS.md` 원칙 4 | §8 줄·단위 수 | 유지 — 그 규칙의 대상은 current-state 문서이고 handoff 번호 디렉토리는 검사 밖이다. 수치는 기준 커밋에 고정된 감사 분모다 |
| 설계 커밋과 구현 산출을 한 커밋에 담지 않는다 | `handoff-plan/SKILL.md` 마무리 | §11 P1 이후는 별도 커밋 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 감량 추정이 30줄 경계에서 계열 종료를 뒤집는다 | 선언 경계 3 — `sum` 25~34면 verify가 통과 후보 전부의 `basis`를 다시 센다. `total`을 함께 보인다 |
| 감사자가 전제를 낙관해 통과 후보를 부풀린다 | VP-02 — verify가 통과 후보 **전부**의 전제 근거 명령을 재실행한다 |
| 감사자가 전제를 비관해 합을 30 밑으로 눌러 계열을 끝낸다 | verify가 통과하지 못한 후보 최대 3건을 재현하고(VP-02) `total`이 30 이상이면 막힌 후보의 걸린 칸을 `verify.md`에 전부 적는다 |
| i18n 2파일이 읽는 양의 절반을 차지한다 | 대상에서 빼지 않는다(D-004). 단위가 1개라 판정 칸은 22칸 + 1단위다 |
| 부분 열람 4파일의 나머지가 감사 밖에 남는다 | 선언 경계 8 — 최종 보고에 적어 사용자가 다음 단계에서 정한다 |
| P2 패턴이 `useEffect` 같은 호출식을 단위로 잡는다 | 분모를 좁히지 않고 근거 칸에 그 호출들이 하는 일을 적는다(EP-02) |

- 되돌리기 어려운 결정: 없음 — 산출이 자기 디렉토리의 문서와 스크립트다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `docs/handoff/0317-wide-bloat-audit-stage1/{plan.md,audit.md,data/audit.json,scan/check.mjs,scan/check.test.mjs}`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `docs/handoff/AGENTS.md`. `app/**`는 수정하지 않으므로 `app` lint·typecheck·test는 gate가 아니다.
- 환경 제약: 없음 — Node 내장 모듈과 `git`만 쓴다.
- 기본 gate: §7-A 운영 gate 표의 5개.
- D-010: impl·verify 턴도 서브·백그라운드 에이전트를 쓰지 않는다.
- 사람 실기: AC10.

## READY self-review

- [x] Decision Ledger — ACTIVE 15 · OPEN 0 · SUPERSEDED 0.
- [x] Part I만으로 완료 상태를 설명한다 — §1 성공 한 문장 · §5 상태 표.
- [x] 조건절·이유절을 원문으로 인용했다 — §2·§3의 따옴표 문장. 오기("전체 3칸")는 추론 행에 적었다.
- [x] 사용자 결정과 코드 사실을 구분했다 — 설계자 해석 4건(D-003·D-013·D-014·D-015)은 출처 칸에 표시했다.
- [x] 수치·전칭·앵커 실측 — §8 검산 절(18 · 7 · 11 · 6,145 · 98 · 51 · 5).
- [x] 저장소 규칙·후보 표 겹침 확인 — §8의 0262 행 · §16.
- [x] 각 AC가 동작 기준·검증 수단·경로를 가진다 — §7 12행.
- [x] Baseline V — §7-A.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair — R-01~06 ↔ VP-01~06 · AR-01 ↔ VP-05 · MD-01~04 ↔ VP-07~10.
- [x] INHERITED node 없음.
- [x] 각 pair의 경로·분모·oracle 좌표 — Pair registry · §10.
- [x] 규칙 칸 ↔ UT 입력 칸 — EP-02 7행 · EP-05 11행(조건 42) · EP-06 3행 + 경계 2 · EP-10 7행.
- [x] 선언 경계 9건 · 열린 입력은 fail-closed(K3·K10) · 대상 유도는 규칙 통과만 대상.
- [x] 운영 gate 5개 — 문서 가드는 이번 턴 기준선에서 `links ok` 관측.
- [x] 사람 실기로 미룬 순수 로직 없음 — 판정은 UT-03, 대상 유도는 UT-04.
- [x] structural proxy — AC 주의사항 4번째 줄과 VP-02·VP-03의 재현 의무로 보완.
- [x] 방향 일치 — K2·K11은 양방향 차집합 · K7은 고아 후보와 유령 ID 양쪽에 red.
- [x] 정책 파라미터 — `sum`(통과 후보 prod 줄 합 · 정수) `< 30` · 판정 enum 2값.
- [x] 참조 구현 coverage — 0315 `check.mjs` 대비 차이 6행(§11). K1~K10·EP-02·EP-03·EP-04·EP-08은 그대로다.
- [x] 신규 모듈의 강제 지점·seam — §11.
- [x] producer/consumer — §12.
- [x] 상한 — 읽는 양 6,145줄 · CI 부하 0.
- [x] 본문 교차검증 — §3 갱신 메모의 대조 줄. EP-05 분모는 Pair registry·§10 표·규칙 표 합계 세 곳 모두 42, 단위 98과 대상 11은 §8 표·§10·Pair registry에서 같다.
- [x] 문장 규칙 — 판정 먼저 · 표 위주.

---

## [구현자 기입]

(impl 턴에서 채운다 — 필드는 `plan.template.md`의 `[구현자 기입]` 7절)

## [검증자 기입] 파생 이슈

(verify 턴에서 채운다)
