# Verify — 0308-bloat-reduction-legacy-migration-and-output-store

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **PASS (기계 범위)** — 막는 발견 0 · `PLAN_GAP` 0. AC7·AC16은 사람 실기 대기 |
| 검증자 | Claude Code (설계자 = 구현자 = 검증자 — plan validity는 자기 설계 감사, 독립 축 ⑥으로 보완) |
| 일자 | 2026-11-11 |
| 대상 | 설계 `11a3594`(V1) · impl r1 = `b84778e`(M1) · `1b25ba7`(M2) · `b1f95ea`(M3) · `5ee2720`(보고). 전부 `git cat-file -t` = commit |
| V mode / 라운드 | Baseline V1 · 라운드 1 |
| 확장 창 | verify **1회째**(창 안). ΔV 없음 |
| 기준선 | impl 커밋이 바꾼 `plan.md`의 삭제 행은 `[구현자 기입]` 표제 7줄뿐(`git diff 11a3594 HEAD -- plan.md`) — 규범 행 변경 0 |
| 독립 축(⑥) | ① 변경 전 트리 worktree에서 vitest 전체 재실행 — 실패 집합 비교 ② `sessionBusy` 소비처 5곳(EP-07 목록 밖) 맞바꿈 ③ `dispose` 타이머 정리 제거 ④ 옛 journal 행의 실제 재생 경로(`list` → `applyBackgroundEvent`) 코드 추적 |
| 열거 sweep(⑦) | 1회째 전수 — 등록 변이 a~j · 규칙 칸 7행 · sweep k·l·m·n·o·p · 형제 맞바꿈 x1 = 변이 21행 전부 red |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 1 · 비귀속 5(재현 4 + plan 서술 1) |
| 못 본 것 | AC7·AC16 사람 실기(Electron 바이너리 없음). `origin/main`이 이 환경에 없어 좌표의 `main` 조상 여부 미확인. `bootstrap.*.test.ts` 실행 불가(전부 electron 로드 실패, 변경 전과 같음) |

## 0. plan validity

- V mode Baseline이 맞다(상속할 코드 계약 V 없음). NEW 노드마다 같은 레벨 REQUIRED pair가 있고 REGRESSION은 VP-08 하나다.
- §10 EP-01·02·03·05·06·07 검색 명령 재실행: EP-01·02·03·06 = 0줄, EP-05 = 2파일(`background-task.test.ts` 계획된 1곳 + `background.integration.test.ts` 부재 단언 1곳 — 구현자가 설계 차이로 보고), EP-07 = 9줄(유지 6 + 파생 호출 2 + 타입 1) · 필드 자리 14는 0. 차집합 ∅.
- 내부 불일치(비차단): §10 EP-05 문장 "VP-07 입력 1곳만 남는다"가 실제 2곳이다. 남은 한 곳은 AC9 통합 경로의 음성 단언이라 불변식을 약화하지 않는다 — 비귀속(plan 서술 정정은 설계자 재량).

## 2~3. diff 비판 · 역방향 탐색

- 부팅: `index.ts`가 `initLog()` → `installErrorReportSink()` 순이고 `Bootstrap` 생성자 인자 1개다(`index.ts:33-34,258`). 이관 단계 2개가 `bootstrap.ts`에서 사라졌고 `db-init`·`chat-recovery`는 `critical: true`다.
- 옛 journal 재생: `list` → `JSON.parse` → `applyBackgroundEvent`(`background-task.ts:290~`). 모르는 type은 어느 분기에도 안 걸리고 `record = next.tasks[key] ?? freshTask`를 그대로 되쓴다 — 기존 작업이면 기록 불변, 없으면 빈 기록 1개(선언 경계 1). 던지는 경로 없음.
- `BackgroundController.dispose`가 부르던 `this.state(sessionId)` 삭제(구현자 보고 #3): 호출부 `bootstrap.ts:1233`이 바로 이어 `backgroundTasks.dispose`를 부른다. 복원된 상태를 쓰는 소비자가 없다.
- `scan-surface.sh 11a3594..HEAD`: 1a·2 후보는 이번 diff가 만든 표면이 아니다(`backgroundEventKey`·`APP_ERROR_DETAIL_MAX` 등은 파일 내부 소비). 새 미배선 0.
- 문서: `arch`·`TRD`·`IPC_CONTRACT` 변경은 삭제 사실을 적지 않는 현재형 서술이다(`docs/AGENTS.md` 규칙 4 준수). `app/AGENTS.md`는 `LEGACY_PRODUCT_SLUG` 문구 2곳만 고쳤고 비밀·변동 정보 혼입 없음.

## 4. 고장 이력 (`mutate.py`, 원복 확인 "모든 파일 원문 그대로")

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| a | `paths.ts` 끝 | 제거의 역(되살림) | `legacyConfigDir` 함수 추가 | 잡음 | `product-identity.test.ts` 1 | 등록 변이 |
| b | `index.ts:33-34` | 뒤집기 | `installErrorReportSink()`를 `initLog()` 앞으로 | 잡음 | 같은 파일 1 | 등록 변이 |
| c | `bootstrap.ts:568` | 다른 값 | `db-init` `critical:false` | 잡음 | 같은 파일 1 | 등록 변이 |
| d | `bootstrap.ts:580` | 다른 값 | `chat-recovery` `critical:false` | 잡음 | 같은 파일 1 | 규칙 칸 분기 |
| d2 | `bootstrap.ts:579` | 제거 | `chat-recovery` 단계 이름 변경 | 잡음 | 같은 파일 1 | 등록 변이(재앵커) |
| e | `release-operations.md` | 제거 | `### 데이터 수동 이전` 표제 | 잡음 | 같은 파일 1 | 등록 변이 |
| f | 같은 문서 | 제거 | store 대응 1개 | 잡음 | 같은 파일 1 | 등록 변이 |
| g·g2·g3 | `chat-turn/background.ts:33·36·…` | 제거 | 중단·전환·상태 채널 등록 각각 | 잡음 | `background.channels.test.ts` 각 1 | 등록 변이 + 형제 슬롯 |
| k | `background-controller.ts:84` | 제거 | `publish` 호출 | 잡음 | `background-controller.test.ts` 2 | sweep VP-06 |
| l | 같은 파일 `:211` | 제거 | `disposed.add` | 잡음 | 같은 파일 1 | sweep VP-08 |
| p | `background-task.ts` 끝 | 다른 값 | 모르는 type에서 기록 변경 | 잡음 | `background-task.test.ts` 1 | 규칙 칸 분기 |
| h | `chatStore.ts:2286` | 맞바꿈 | `!== 'idle'` → `=== 'listening'` | 잡음 | 7 | 등록 변이 |
| i | `chatStore.ts:1206` | 제거 | 폴더 가드의 점유 항 | 잡음 | 2 | 등록 변이 · EP-07 |
| j | `chatStore.ts:2336` | 고정값 | selector `listening: false` | 잡음 | 1 | 등록 변이 · EP-07 |
| m | `chatStore.ts:1122` | 고정값 | 예약 판정 인자 `false` | 잡음 | 6 | sweep · EP-07 |
| n | `chatStore.ts:1116` | 제거 | `busy`를 `cur.inflight`로 | 잡음 | 1 | sweep · EP-07 |
| o | `chatReducer.ts:1416` | 제거 | `CANCEL_CHAT`의 transport 초기화 | 잡음 | 2 | sweep · EP-07 |
| x1 | `chatStore.ts:2290` | 맞바꿈 | `sessionBusy`가 `sessionResponding`을 씀 | 잡음 | 6 | ⑤ 형제 슬롯 |
| x2 | `chatStore.ts:1256` | 제거 | 소비처 `sessionBusy` → `inflight` | 잡음 | 1 | ⑥ |
| x3 | `chatStore.ts:1626` | 제거 | 핸드오프 가드 `sessionBusy` → `inflight` | **못 잡음** | — (2372 케이스 green) | 비귀속 |
| x4 | `chatStore.ts:1729` | 제거 | 캐시 재진입 가드 | **못 잡음** | — | 비귀속 |
| x5 | `chatStore.ts:1765` | 제거 | 현재성 가드 | **못 잡음** | — | 비귀속 |
| l2 | `background-controller.ts:215` | 제거 | `dispose`의 `clearTimeout(timer)` | **못 잡음** | — (13 green) | 비귀속 |

- **x3·x4·x5·l2 판정**: 변경 전 트리(`11a3594` worktree)에서 같은 변이를 심어 같은 결과를 얻었다 — x3·x4·x5 각 `2367 passed`, l2 `16 passed`. 이번 diff 전에도 잠겨 있지 않았고 이번 diff가 바꾼 줄이 아니라(`sessionBusy` 본문만 바뀜) 덮개 회귀가 아니다. 분류 비귀속.
- 렌더러 oracle(`src/renderer/src/features/chat`)은 `planMode.render.test.ts`의 Electron 로드 실패(변경 전과 같음) 때문에 exit 1이 항상 난다 — 위 렌더러 행의 판정은 exit이 아니라 실패 케이스 수로 했다(x3~x5는 실패 0).
- 하한 ② ③ ④: 닫는 파생 이슈 0 · 직전 이력 없음(verify 0회) · 이전 라운드 없음.

## 5. gate (이번 턴 재현)

| gate | 관측 |
|---|---|
| 가드 4종 | `append-only ok since v0.3.1` · `generated doc ok (9 items, 113 channels)` + prose·links ok · `product-naming OK — 2226파일 · 허용 7항목` · `test-budgets 19 real-git suites ok` |
| lint · typecheck | lint 0 error·2 warning(`react-hooks/incompatible-library`, 변경 무관) · typecheck 3구성 오류 0 · 실행 뒤 `git status` 변화 0 |
| vitest 전체(파일 필터 없음) | head: 942파일·8800케이스 — 29파일 실패·22케이스 실패. 변경 전(`11a3594` worktree, 같은 `node_modules`): 946파일·8839케이스 — 29파일·22케이스 실패 |
| 기준선 분리 | 실패 파일 집합 diff = ∅(29 = 29), 실패 케이스 `comm -13`(head 전용) = ∅. 서명: `Electron failed to install correctly` · `electron-store` 로드 · Windows 경로(`Composer directory must be absolute`) — 환경. `[test-pools]` 가드 실패 0 |
| `node --test "scripts/*.test.mjs"` | 868 tests · 868 pass · 0 fail |
| AC14 | `git diff --numstat 11a3594..HEAD -- app/src` — prod +27 −1025 = −998 · test +248 −1161 = −913 (구현 보고와 일치) |

## 6. V-pair closeout

| Pair | 판정 | 직접 oracle 좌표 · 확인 |
|---|---|---|
| VP-01 | PASS | `product-identity.test.ts:195·202·210` — a·b·c·d·d2 red. 테스트가 소스 텍스트를 읽는 구조적 proxy라 production 조립 대조 불요 |
| VP-02 | PASS | `error-report.registry.test.ts` 등록 전건 green · EP-02 0줄 |
| VP-03 | PASS | `git-execution.test.ts:"prepares without baseRef in four executions…"` green · EP-01 0줄 |
| VP-04 | PASS | `product-identity.test.ts:429·435` e·f red · `check-product-naming.mjs` OK · `check-product-naming.test.mjs:183` green |
| VP-05 | PASS | `background-controller.test.ts` 5건 green · `background.channels.test.ts` g·g2·g3 red |
| VP-06 | PASS | `background-controller.test.ts:33` — k red(2) |
| VP-07 | PASS | `background-task.test.ts:214` — p red. 운반 값: 완료 작업 + 모르는 type 이벤트(기본값과 구별) |
| VP-08 | PASS | `session.delete.native-history.test.ts` green · l red. 보존 파일 단언 삭제는 D-004 |
| VP-09 | PASS | `check-doc-inventory.mjs --check` OK · EP-06 0줄 |
| VP-10 | PASS | `chatStore.listen.test.ts:64`(3분기 `it.each`)·`:71` · `chatStore.sessionDirectory.test.ts` · `statusLine.waitPhase.test.ts:50` — h·i·j·m·n·o·x1·x2 red |

- 규칙 칸 7행: `sessionListening` 3분기 = `:64` 3입력(h red 7) · `reduceBackground` 아는 type = 기존 케이스 · 모르는 type = `:214`(p) · 컨트롤러 종료 처리 = `:33`(k) · 터미널 아님 = VP-05 5건. 각 분기에 구별되는 입력이 있다.
- 형제 슬롯(`sessionResponding`은 `=== 'listening'`, `sessionListening`은 `!== 'idle'`): `ready` 입력이 두 판정을 가른다(h·x1 red).

## 7. AC

✅ 14 · ⚠️ 2 · ❌ 0 = 총 16 — AC1~6·8~15 ✅(위 좌표·gate), AC7·AC16 ⚠️ 사람 실기. AC2의 `Bootstrap` 실행 부분은 `bootstrap.harness.test.ts`가 이 환경에서 실행 불가라 소스 텍스트 oracle(`:210`)과 AC16 실기에 기댄다(선언 경계 4).

## 11. Repository operation

- 구현 커밋 trailer 4개 파싱 OK(`Agent`·`Handoff`·`Status`·`Criteria-*`·`Verified-By: pending`). `Criteria-Met` 14/16이 본문·INDEX와 같다.
- `[구현자 기입]` 일곱 필드 모두 있다. 강제 지점 표는 EP-01~07 전부(81 = 19+7+6+9+18+8+14, 재계산 일치).
- INDEX 좌표를 검증자가 채웠다. `origin/main` 부재로 `main` 조상 여부는 미확인.
- 수동 이전 문서 vs 옛 `migrate-legacy.ts`: 문서는 DB 3종·store 4종·`orca.json`·내장 스킬 마커를 다룬다. 옛 코드는 추가로 `orca.db.backup.*`와 `dist/<engine>/.orca-deploy.json`·`plugins/orca`를 옮겼다. plan §5 표가 이미 이 둘을 적지 않았다 — 경계(D-013, AC7 실기에서 확인).

## 13. 파생 이슈

없음. 비귀속 4건(x3·x4·x5·l2)은 후보 표에 1행으로 올렸다.

## 14. Review Signals

- 이전 라운드와 같은 증상: 없음(1회째). 독립 축(⑥)에서 나온 발견 4건, 전부 변경 전에도 있던 잠금 공백(비귀속).
- 관련 plan 지침: VP-10 소비처가 EP-07의 `.listening` 필드 읽기만 열거하고 `sessionBusy` 호출처는 열거하지 않았다 — 구현자 sweep n이 `send` 한 곳을 더했다.
- 반복 환경 한계: Electron 바이너리 부재 29파일(변경 전과 동일).
- 사용자 결정 변경 근거: 없음.

## 15. 결론

**PASS (기계 범위).** 막는 발견 0, 변이 21행 red, 비귀속 4건은 변경 전에도 같은 결과. 남은 것: AC7(수동 이전 실기) · AC16(부팅·백그라운드 패널·입력 대기 실기) · 사용자 판단 D-012(`outputRefs` 유지)·D-013(수동 절차 형태)·앱 안 안내 부재.
