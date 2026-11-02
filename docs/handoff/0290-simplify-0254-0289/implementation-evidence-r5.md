# 0290 r5 구현 증거

D10 보완 완료, 독립 검증 대기다. 제품 코드는 바꾸지 않고 V1+ΔV1의 AC 23·pair 19·고정 187자리를 유지했다.

## 변경과 직접 관측

경로 접두는 `app/src/`다. 아래 테스트는 실제 discovery·파일 읽기·서명·지문·감시 경로를 실행하며, 시계·타이머·파일 읽기 완료 시점만 제어한다.

| 좌표 | 실행 구간 / 구별 입력 | 관측 |
|---|---|---|
| R5-01 | `main/adapters/opencode/v1/discovery-cache.poll-race.test.ts`의 `reports one edit once ...`: 재로드 읽기 전/후 × pass 전/도중/뒤 완료 × touch 유무 | 12/12 성공. 기대 통보 1·1·1·0·1·1, 후속 실제 편집 +1회·반복 poll 추가 0·반환값 `a2`. 0290 전 `46b3784`도 같은 12/12 |
| R5-02 | 같은 파일 `re-watches the dependency file a reload switched to and reports its edit through the watcher`: 기존 파일을 유지하고 두 번째 의존 파일로 재로드, 실제 `watchFile` 인자의 listener 실행 | 두 번째 파일 편집 통보 1회. X07(재감시 삭제)·Y6(첫 파일만 감시) 각각 1실패 |
| R5-03 | 같은 파일 `checks the reloaded dependencies before an unchanged overlapping pass settles`: 옛 파일 probe 보류 → 다른 파일 재로드 → 새 파일 편집 → 옛 probe 완료 | poll 정착 시 통보 1회·반복 추가 0·최신 값 반환. Y7(재검사 요청 삭제) 1실패 |
| R5-04 | `main/adapters/claude/project-reconciliation.test.ts` fixture의 cwd에 `.git` 경계 명시. 기존 `projects native plugin flag %j during external reconciliation` 실행 | 상위 `/tmp/.git`가 cwd의 설정을 가리지 않음. M107(배열 활성 항 제거) 1실패. 기존 Linux 실패 8 중 6개 해소 |

- D10 인용 Y1(`signature` 비교 → `fingerprint` 비교)은 최종 discovery 10파일 63케이스 중 R5-01의 `before-edit/during-pass/touch:true` 1실패다. 정상 코드의 poll-race는 18/18 성공했다.
- 이전 감시 테스트의 `setImmediate` 200회는 실제 fs 완료를 보장하지 않았다. `vi.waitFor`로 콜백 결과를 기다리게 바꾼 뒤, 최초 green으로 드러난 Y6·Y7을 각각 R5-02·R5-03으로 검출했다.
- R5-03은 옛 pass가 변경을 보지 못한 경우도 다룬다. 새 manifest의 파일 편집은 보류된 pass 정착 전에 재검사되며, 새 타이머를 기다리지 않는다.

## 상속 pair와 강제 지점

[r3 자리별 좌표](implementation-evidence-r3.md#상속-자리별-직접-좌표)의 O-02~O-19를 이번 전체 Vitest 실행 집합과 대조했다. VP-07 ④는 R5-01~03, VP-09 플래그 소비는 R5-04로 보강했고 나머지 production 경로는 그대로다.

- [§10 검색](scan/r5-ep-search.txt)은 기존 r4 47행과 차집합 ∅다(트리 루트 표제 제외).
- 고정 자리 합계는 `3+2+19+3+5+4+29+14+11+4+15+29+3+6+11+4+19+6=187`이다. VP-01은 자리 0인 집계이며 Windows CI를 별도로 센다.
- [정적 민감도](scan/r5-static-sensitivity.json)는 12/12 검출이다. IPC·삭제 심볼·CSS는 실제 소스에 복원해 기록 검색의 0→1을 확인했고, `partsStructured` 복원도 실제 트리에서 dead로 분류했다.

## 고장 재실행과 동치

[최종 결과](scan/r5-mutation-evidence.json) 148행 = assertion 검출 141 + 동치 3 + 정상 재현 4다. [중간 시도](scan/r5-mutation-attempts.json)는 첫 실행과 fixture·대기 보완 전후 결과를 보존한다.

| 범위 | 분모 | 관측 |
|---|---:|---|
| r4가 사용한 실행 정의 | 148 | `scan/r4-mutation-definitions.json` 141 + `verify-evidence/r4/r4-verify-axes.json` 7. ID 누락·초과·중복 차집합 ∅ |
| D10 인용 Y1 | 1(위 집합의 부분집합) | 기존 r4 못 잡음 → r5 잡음 1/63 |
| 동치 Z16 | 1(부분집합) | release에 추가 호출이 없는 기존 수명 경계 유지, 해당 집합에서 신규 assertion 실패 0 |
| 동치 Y2·Y4 | 2(부분집합) | 각각 discovery 63케이스 신규 실패 0. [형제 재현](scan/r5-equivalence-evidence.json) E/G/H/I/J도 HEAD·Y2·Y4 각각 5/5 |
| 정적 선택 증거·실패-ID oracle | 12(별도) | 12/12 검출. 실제 파일 복원 뒤 원래 바이트 복원 |

- Y2의 observer 지문은 `watch()` 시작 지문에 쓰이고 poll의 통보 판정은 내용 서명이다. Y4는 동일 서명을 다시 대입하는 경우뿐이다. 실제 두 번째 hold와 다음 편집의 통보 수가 E/G/H/I/J에서 유지됐다.
- 선택 증거 98(실행 87+정적 11) + 추가 인용·이력 58(실행 57+실패-ID 정적 1) + 새 구조 oracle 0 = 고장 156. 정상 재현 4행은 고장 수에 합산하지 않는다.
- 고장 156 = 검출 153(실행 141+정적 12) + 동치 3. 이전 잡음에서 설명 없는 green 전환 ∅, 분류되지 않은 ID ∅다. Y6·Y7은 보완 전 green과 최종 red를 모두 남겼다.

## 게이트와 환경

[기계 집계](scan/r5-gate-summary.json)가 수치의 정본이다. Linux Node 24에서 SQLite를 Node ABI로 맞췄으며, npm·node-gyp 캐시는 `/workspace` 아래에 뒀다.

| 게이트 | 관측 |
|---|---|
| typecheck | node/web/test 3구성 오류 0, 최종 테스트 수정 뒤 test 구성 재실행 오류 0 |
| eslint | 전체 1,979파일 error 0·기존 warning 2. 최종 변경 2파일 error/warning 0 |
| Vitest | baseline 895파일·8,311케이스·실패 66 → 최종 895파일·8,318케이스·성공 8,250·실패 59·skip 9. 신규 실패 ID ∅·해소 7 |
| 실패 분리 | [기준선](scan/r5-baseline-failed-ids.txt)과 [최종](scan/r5-local-failed-ids.txt) 보존. 남은 실패는 Windows 경로 fixture·상위 `/tmp/.git`·홈 디렉터리 쓰기 제약 등 변경 전 동일 ID |
| scripts / repo | 144/144, inventory generated/prose/links OK, test-budget OK, migration sync/no-copies OK(로컬 v 태그 부재로 append-only 비교 생략) |
| Windows CI | 대기 — PR #523의 이번 구현 커밋 CI를 확인한 뒤 갱신 |

초기 SQLite Electron ABI 실행의 실패는 정상 기준선으로 쓰지 않았다. Node ABI 전환 후 같은 checkout·명령·경로에서 변경 전후를 측정했고, 격리 checkout에는 테스트 2파일만 복사했다.

## 재현

```bash
cd app
npm run typecheck
./node_modules/.bin/eslint ./src ./scripts
./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json --outputFile=<report.json>
node --test scripts/*.test.mjs
node scripts/check-doc-inventory.mjs --check
node scripts/check-test-budgets.mjs
node scripts/check-migrations-appendonly.mjs
```

실행 고장 정의는 r4의 141행과 검증자 축 7행을 이어 붙인다. 기존 `verify-evidence/r2/mutate-r2.py`에 이번 무변이 실패 ID를 전달하며 최종 수정 뒤 Y1·M107·Z16·X07·Y2·Y4·Y6·Y7을 다시 실행했다. 모든 production 파일을 바이트 복원했고 최종 app diff는 테스트 2파일뿐이다.
