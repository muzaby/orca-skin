# Verify — 0284-native-toggle-self-write

## 메타

| 항목 | 값 |
|---|---|
| slug | `0284-native-toggle-self-write` |
| 검증자 | Claude Code |
| 일자 | 2026-10-29 |
| 대상 커밋/range | `e9cc7ed..58fad40` (r1 `d70ab20`, r1.2 `58fad40`). 판정은 HEAD `81153e2` 위에서 수행 |
| 구현 전 plan 기준 | V1 `e9cc7ed` |
| V mode / 유효 V | Baseline V1 |
| 라운드 | 1 |
| 상태 | **FAIL** — VP-03 `PAIR_FAIL`(EP-3 등록 변이 M2 덮개 회귀). 그 밖 pair PASS, AC2 사람 재실기 대기 (r1 원문. 최신 판정은 [r2](#r2-검증-2026-10-29)) |
| 자기 검증 여부 | **예** — 설계·구현(r1·r1.2)·검증 모두 Claude(다른 세션). 보고에 없는 축 X1을 넣었다 |

## 0. 기준선 / 후행 정본

- 구현 커밋의 `plan.md` 변경은 메타·`[구현자 기입]`뿐이다(`e9cc7ed`는 plan 신설, `d70ab20`·`58fad40`은 구현자 기입).
- 후행 변경 2건이 EP-3(방송은 같은 key 큐 뒤) 자리를 바꿨다.

| 후행 커밋 | 변경 | EP-3 영향 |
|---|---|---|
| 0288 r1.2 `0466f5c` | watcher 성공 경로가 읽기·방송을 `deps.run` 안에서 직접 수행(`project-resource-sync.ts:186-193`) | 계약은 더 강해졌고 0288 CI3가 잠근다. 대신 `emit` 정의 변이를 잡던 watcher 좌표가 `emit`을 지나지 않게 됐다 |
| 0289 | `connectionsChanged → emit`(`:97`) 추가 | 새 `emit` 호출 자리, 잠금 테스트 없음 |

- 현재 `rg -n "this\.emit\(" project-resource-sync.ts` → 4(`:97`·`:199`·`:253`·`:256`). 개수는 §10과 같지만 구성이 다르다. 계약 자리(정의 `:273`의 `deps.run` 감싸기)는 그대로라 PLAN_GAP이 아니라 고정 자리의 잠금 상실이다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| NEW ↔ REQUIRED / INHERITED ↔ REGRESSION | 유효 | VP-01~05 REQUIRED, VP-06·07 REGRESSION |
| §10 | 유효 | EP-1~4, 검색 명령 기록. EP-3은 정의 1곳이 계약 자리 |
| 적대 증거 | 유효 | M1~M4 + r1.2 M5 |

## 1. 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 자기 저장 인정 범위 | 정상 | `project-reconciliation.ts:77` revision 일치일 때만 `next`, 외부 편집은 pending. M4 red |
| 판정 SSOT | 정상 | `appliedTo`(`project-resource-sync.ts:264`) 하나를 decorate(`:109`)·apply 필터(`:228`)가 호출 |
| 방송 직렬화 | 코드 정상 / 잠금 상실 | `emit`은 `deps.run`을 감싸지만 그 감싸기를 지워도 48케이스 green(M2) |

## 2. 고장 이력

Linux에서 Claude 플러그인 제어는 `process.platform === 'win32'` 게이트(`claude/native-resources.ts:39`)로 꺼져 해당 테스트가 기준선 red다. 파일 첫 줄에 `Object.defineProperty(process,'platform',{value:'win32'})`만 더한 미커밋 사본(`*.w32.test.ts`)이 4파일 22케이스 green이 된 뒤 그 사본으로 쟀다.

| ID | 자리 | 종류 | 바꾼 내용 | 직전 결과 | 이번 결과 | 잡은 테스트 |
|---|---|---|---|---|---|---|
| M1 | `project-resource-sync.ts:266` | 제거 | 런타임 보증 OR(맵만) | 잡음 3 | 잡음 2/11 | holds watcher broadcasts … · keeps every toggle … real watcher |
| **M2** | `project-resource-sync.ts:273` | 제거 | `emit`의 `deps.run` 감싸기 | **잡음 1** (`58fad40` 재실행에서도 red 1/10) | **못 잡음 0/48** | `project-resource-sync`·`session-resources.sync`·`claude-assembly`·`native-resource-sharing`·`session-resources`·`opencode-mcp-reconcile` 전부 green |
| M3 | `claude/adapter.ts:843` | 제거 | `acknowledge` 호출 | 잡음 1 | 잡음 2/9 | reports its own persisted plugin revision … |
| M4 | `project-reconciliation.ts:77` | 다른 값 | `next ?? folded` 무조건 대입 | 잡음 1 | 잡음 1/15 | acknowledges only its own persisted change … |
| M5 | `project-resource-sync.ts:267` | 제거 | `entry.applied.set` | 잡음 1 | 잡음 1/11 | keeps every toggle … real watcher |
| X1 | `project-resource-sync.ts:228` | 고정값 | apply 필터의 `appliedTo` 검사 | 신규 | 잡음 2/11 | retains malformed state … · holds watcher broadcasts … |

- 검산: 시도 6 = 잡음 5 · 못 잡음 1(M2) · 동치 0.
- **덮개 회귀**: M2 `red → green`. `58fad40` 워크트리에서 같은 변이가 `holds watcher broadcasts behind an in-flight project mutation` red 1/10이었고, `0466f5c` 이후 그 테스트는 `emit`을 거치지 않는 inline 경로를 실행한다.
- 자기검증 분모: 보고에 없던 축 X1(apply 필터 형제 자리) 잡음.

## 3. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-05 (UT) | PASS | M4 red |
| VP-04 (IT) | PASS | M3 red, `session-runtime` 위임 green |
| VP-03 (ST) | **PAIR_FAIL** | EP-3 계약 자리의 등록 변이 M2 못 잡음 |
| VP-07 (ST, REGRESSION) | BLOCKED_BY:VP-03 | 같은 EP-3 분모. 기존 9건(현재 10건)은 green |
| VP-01 (AT) | PASS | M1·M5·X1 red, `claude-assembly`(w32) green |
| VP-02 (AT) | PASS(기계) / AC2 사람 실기 | 스냅숏 전수 단언 green. 같은 EP-3 분모이나 선택 변이 not selected라 VP-03만 root |
| VP-06 (REGRESSION) | PASS | 인용 2케이스 green(w32) |

- AC 합계 재측정: ✅ 6 · ⚠️ 1(AC2) · ❌ 0 = 7(AC3은 현재 코드 동작으로 충족 — 결함은 잠금). trailer `6/7` 일치.

## 4. 게이트

[0289 verify §6](../0289-opencode-runtime-retention/verify.md) 같은 HEAD — typecheck·lint·inventory PASS, Windows CI success. trailer 3커밋 파싱 정상.

## 5. 파생 이슈 이관

| # | 이슈 | 출처 | 대응 방향 | 분류 |
|---|---|---|---|---|
| D1 | `emit` 정의의 큐 감싸기를 지워도 잡는 테스트가 없다(M2 덮개 회귀) | VP-03 EP-3 | `connectionsChanged`(`:97`) 또는 apply 뒤 방송(`:253`)을 in-flight mutation hold 중 broadcast 0으로 단언하는 케이스 추가 → M2 red 확인 | BLOCKING |
| D2 | AC2 Windows 실제 세션 연속 토글 재실기 | VP-02 | 사람 실기 | 사람 실기 |

## Review Signals

- 첫 verify. 덮개 회귀의 원인은 0284 자신이 아니라 후행 0288 r1.2의 정당한 재배치다 — 장치 교체 시 이전 변이 재실행이 그 handoff 범위 밖이라 놓쳤다.
- 반복 환경 한계: Claude 플러그인 제어 테스트가 win32 게이트로 Linux에서 red.

---

# r2 검증 (2026-10-29)

## 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `68e1c43..144d999` (r2 `144d999` — 테스트 1건 + plan·INDEX). production 변경 없음 |
| 구현 전 plan 기준 | V1 `e9cc7ed` (r2 커밋의 plan diff는 `[구현자 기입]`·메타·D1 상태뿐) |
| 라운드 | 2 |
| 상태 | **RETURN_TO_PLAN** — VP-03 `PAIR_FAIL`(§10 EP-3 호출 자리 3곳 못 잡음) + EP-3 자리 목록 `PLAN_GAP`. D1(M2)은 닫힘 |
| 자기 검증 여부 | **예** — r2 구현·이번 검증 모두 같은 Claude 세션. 보고에 없는 축 Z1~Z3(§10 형제 호출 자리)을 넣었고 셋 다 못 잡음 |

## 0. 기준선 / plan validity

- r2 커밋의 `plan.md` 변경은 메타 상태·`[구현자 기입] 재구현 (r2)`·D1 상태 칸뿐이다. Decision·AC·§10 변경 없음.
- **EP-3 분모는 정의 1곳이 아니라 호출 자리 목록이다.** §10 `언제 강제 (자리 목록 = 분모)` 칸이 `this.emit(` 호출 4자리를 고정하고 pair registry가 `EP-3 (4)`로 센다. r2 보고의 "정의 자리 1/1"은 분모를 바꾼 것이고 r1 verify §0의 "계약 자리(정의)" 판단도 같은 축소였다.
- **기록된 목록과 검색 출력이 갈린다** → `PLAN_GAP`.

| §10 고정 자리 | 현재 대응 | 비고 |
|---|---|---|
| `:183` refresh 성공 emit | 없음 — 0288 `0466f5c`가 `deps.run` 안 inline `broadcast`(`:193`)로 바꿈 | 술어 `this.emit(`가 더 이상 이 자리를 세지 않는다 |
| `:188` refresh 실패 | `:199` | |
| `:242` apply 성공 | `:253` | |
| `:245` apply 실패 | `:256` | |
| (목록 밖) | `:97` connectionsChanged (0289) | 검색 출력에만 있음 |

- 재실행: `rg -n "this\.emit\(" app/src/main/app/project-resource-sync.ts` → 4(`:97`·`:199`·`:253`·`:256`). 개수만 같고 구성은 목록과 차집합 2(`:183` 소멸·`:97` 신규).
- 술어도 좁다: 불변식의 주어는 "큐 밖에서 시작된 sync 방송"이고 `this.emit(`은 해법 이름이다. `this.broadcast(` 직접 호출(`:193`, 큐 안이라 정당)과 `emit` 대체 회귀를 같은 검색이 구분하지 못한다.

## 1. 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 테스트가 production 경로를 지나는가 | 예 | `project-resource-sync.test.ts:'holds connection-change broadcasts behind an in-flight project mutation'` — 실제 `ProjectResourceSync`, 같은 key 큐를 공유하는 `run` 주입, `connectionsChanged` → `emit` → `run` → `broadcast` |
| 운반 값이 구별되는가 | 예 | 큐 hold 중에만 `status: 'pending'`인 read → 큐 우회 시 pending 방송으로 관측이 갈린다 |
| production 변경 | 없음 | `git show --stat 144d999` — 테스트 1·문서 2 |
| 형제 호출 자리 | **미잠금** | `:199`·`:253`·`:256`에서 `emit`→`broadcast` 대체를 어느 테스트도 잡지 않는다(§2 Z1~Z3). 구현자도 `놓친 잠재 문제`에 적었다 |

## 2. 고장 이력

환경: r1과 같은 win32 강제 미커밋 사본 4파일(22/22 green) + plan 게이트 집합. 기준선 실패 10건(원본 4파일 `win32` 게이트)을 뺀 증분만 센다. 사본은 측정 뒤 삭제, `git status` 깨끗.

| ID | 자리 | 종류 | 바꾼 내용 | 직전 결과 | 이번 결과 | 잡은 테스트 |
|---|---|---|---|---|---|---|
| M2 | `project-resource-sync.ts:273` | 제거 | `emit`의 `deps.run` 감싸기 | **못 잡음 0/48** | **잡음** +1 | holds connection-change broadcasts … |
| M1 | `:266` | 제거 | 런타임 보증 OR | 잡음 | 잡음 +4 | holds watcher broadcasts … · applies overlapping … · never publishes … · keeps every toggle …(w32) |
| M5 | `:267` | 제거 | `entry.applied.set` | 잡음 | 잡음 +2 | never publishes … · keeps every toggle …(w32) |
| X1 | `:228` | 고정값 | apply 필터 `appliedTo` → `true` | 잡음 | 잡음 +2 | holds watcher broadcasts … · retains malformed state … |
| M3 | `claude/adapter.ts:843` | 제거 | `acknowledge` 호출 | 잡음 | 잡음 +2 | reports its own persisted plugin revision …(w32) · keeps every toggle …(w32) |
| M4 | `project-reconciliation.ts:77` | 다른 값 | `next ?? {...folded}` 무조건 대입 | 잡음 | 잡음 +2 | acknowledges only its own persisted change …(w32) |
| Y1 | `:97` | 호출 대체 | `emit` → `broadcast` | 신규(구현자) | 잡음 +1 | holds connection-change broadcasts … |
| CI3 | `:186` | 호출 대체 | watcher 읽기·방송을 `deps.run` 밖 즉시 실행 | 0288 잡음 | 잡음 +1 | holds watcher broadcasts … |
| **Z3** | `:199` | 호출 대체 | watcher 실패 `emit` → `broadcast` | 신규 | **못 잡음** +0 | — |
| **Z1** | `:253` | 호출 대체 | apply 성공 `emit` → `broadcast` | 신규 | **못 잡음** +0 | — |
| **Z2** | `:256` | 호출 대체 | apply 실패 `emit` → `broadcast` | 신규 | **못 잡음** +0 | — |

- 검산: 시도 11 = 잡음 8 · 못 잡음 3(Z1~Z3) · 동치 0.
- Z1~Z3은 동치가 아니다 — `apply`의 `await deps.run(...)`이 끝난 뒤 같은 key에 새 변경이 줄 서 있으면 직접 `broadcast`는 그 변경의 중간 상태를 읽는다(D-003 위반).
- 덮개 회귀: 0 — r1 `잡음` 5행(M1·M3·M4·M5·X1) 전부 다시 잡음.
- 재현: 행마다 대상 줄을 `바꾼 내용`대로 치환 → plan 게이트 vitest 집합 + w32 사본 실행 → 원복(검증자 로컬 스크립트, 미커밋).

## 3. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-05 (UT) | PASS | M4 잡음 |
| VP-04 (IT) | PASS | M3 잡음 · `session-runtime.test.ts` green |
| VP-03 (ST) | **PAIR_FAIL** | §10 고정 자리 `:188`(→`:199`)·`:242`(→`:253`)·`:245`(→`:256`)에 직접 oracle 좌표 없음, Z1~Z3 못 잡음. 정의(M2)·`:97`(Y1)·inline(CI3)은 잠김 |
| VP-07 (ST, REGRESSION) | BLOCKED_BY:VP-03 | 같은 EP-3 분모. 기존 케이스 green |
| VP-01 (AT) | PASS | M1·M5·X1·M3 잡음 |
| VP-02 (AT) | 기계 PASS(스냅숏 oracle) / EP-3 몫 BLOCKED_BY:VP-03 / AC2 사람 실기 | never publishes … 가 M1·M5에 red |
| VP-06 (REGRESSION) | PASS | 인용 2케이스 green(w32 사본 포함) |

- AC 재측정: ✅ 5 · ⚠️ 1(AC2 사람) · ❌ 1(AC3 — 검증 수단 "refresh·apply → emit" 중 apply 경로 미잠금, Z1·Z2) = 7. 자기보고 trailer `Criteria-Met: 6/7`과 불일치.

## 4. 게이트

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | node·web·test 3분할 exit 0 |
| lint | PASS | 0 error · 2 warning(기존 `react-hooks/incompatible-library`). 실행 뒤 트리 변경 0 |
| vitest(plan 집합) | PASS(환경 분리) | 95파일 1,166케이스: 1,153 pass · 3 skip · 10 fail — 10건 전부 `win32` 게이트 기준선, w32 사본 22/22 green |
| 문서 인벤토리 | PASS | `prose ok` · `links ok` |
| trailer | PASS | `144d999` 7키 파싱, `git cat-file -t` → commit |
| Windows CI | 미관측 | 이번 턴에 확인하지 않음 |

## 5. 파생 이슈 이관

| # | 이슈 | 출처 | 대응 방향 | 분류 |
|---|---|---|---|---|
| D1 | `emit` 정의의 큐 감싸기(M2) 미잠금 | VP-03 · r1 | r2 새 좌표가 M2 red | **closed** |
| D3 | `:199`·`:253`·`:256`의 `emit`→`broadcast` 대체(Z1~Z3)를 잡는 테스트 없음 | VP-03 EP-3 고정 자리 | 각 호출 경로(watcher 실패·apply 성공·apply 실패)를 in-flight mutation hold 중 방송 0으로 단언 | BLOCKING |
| D4 | EP-3 자리 목록이 현재 코드와 갈림(`:183` 소멸·`:97` 신규, 줄 번호 낡음)·술어가 해법 이름 | §10 EP-3 | 설계자가 불변식 주어("큐 밖 sync 방송 시작점")로 자리를 다시 열거해 고정(`:97`·`:199`·`:253`·`:256` + 큐 안 `:193`의 소유 구분) | PLAN_GAP |
| D2 | AC2 Windows 실제 세션 연속 토글 재실기 | VP-02 | 사람 실기 | 사람 실기 |

## Review Signals

- r1과 같은 EP-3 축. r1 verify가 분모를 정의 1곳으로 읽었고 r2 구현이 그 해석을 따라 "1/1"로 닫았다 — 고정 목록의 나머지 3자리는 r1부터 좌표가 없었다(r1 `[구현자 기입]` `남긴 곳`).
- §10 목록의 낡음은 후행 0288·0289가 같은 파일을 바꾼 데서 왔다.
- 반복 환경 한계: Claude 플러그인 테스트가 Linux에서 `win32` 게이트로 red.
