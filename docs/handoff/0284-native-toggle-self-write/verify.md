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
| 상태 | **FAIL** — VP-03 `PAIR_FAIL`(EP-3 등록 변이 M2 덮개 회귀). 그 밖 pair PASS, AC2 사람 재실기 대기 |
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
