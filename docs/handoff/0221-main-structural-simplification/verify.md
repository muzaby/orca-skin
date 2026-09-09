# Verify — 0221-main-structural-simplification

## 메타

| 항목 | 값 |
|---|---|
| slug | `0221-main-structural-simplification` |
| 검증자 | Claude Code |
| 일자 | 2026-09-08 |
| 대상 커밋/range | `e18262b..eeb95e4a`(r1) · `a5f62f4..fbaac3fc`(r2) |
| 구현 전 plan 기준 | `e18262b`(V1) · `a5f62f4`(ΔV1) |
| V mode / 유효 V | Delta V / V1(`eeb95e4a`) + ΔV1 |
| 검증 기준 plan revision | `e18262b`:V1 · `a5f62f4`:ΔV1 |
| 라운드 | 1 (첫 독립 검증. 구현은 r1·r2 두 라운드) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다. 설계·구현은 Codex, 검증은 Claude Code — §4의 자기검증 분모 규칙은 적용 대상이 아니다. 그럼에도 구현 보고에 없던 적대 축 8건을 별도로 만들었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — `eeb95e4a`는 `[구현자 기입]` 추가(+98/−1, 삭제 1줄은 자리표시자 문장), `fbaac3fc`는 순수 추가(+77/−0).
- **기준선이 diff로 성립하는가**: 예. 설계(`e18262b`·`a5f62f4`)와 구현(`eeb95e4a`·`fbaac3fc`)이 서로 다른 커밋이다.
- Decision Ledger 변경: `a5f62f4`(설계 커밋)에서 D-07 추가. 사용자 정정 원문 “리팩토링 수준으로 요구한 것임”이 근거로 적혀 있다. 구현 커밋의 Ledger 변경 0.
- Product/UX Contract 변경: 구현 커밋에서 0.
- AC 변경: 구현 커밋에서 0. AC1~11은 `e18262b`, AC12~18은 `a5f62f4`가 확정했다.
- V node/pair·requiredness·§10·oracle 변경: 구현 커밋에서 0. meta 표의 `Baseline V / none / V1` → `Delta V / V1 (eeb95e4a) / ΔV1` 전환은 설계 커밋 `a5f62f4`의 −2/+2다.
- 채점에 사용할 원 기준: `e18262b`의 AC1~11·VP-01~17·EP-01~10, `a5f62f4`의 AC12~18·DP-01~14·EP-11~18.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 기준 V1의 커밋 `eeb95e4a`가 실재(`git cat-file -t` = commit). V1+ΔV1을 두 plan revision에서 재구성할 수 있다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R/AT-01~11·SD/ST-01~02·AR/IT-01~02·MD/UT-01~02 전부 VP-01~17에 pair가 있다. ΔV1의 R/AT-12~18·AR/IT-03~06·MD/UT-03~05도 DP-01~14에 있다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | ΔV1이 “V1 VP-01~17을 REGRESSION으로 재실행”을 명시했다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 17+14 pair 모두 production 경로와 EP 번호를 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 배선 존재를 보는 VP-01·07·08·09·14와 ΔV1의 EP-11·16에만 변이를 선정하고 나머지는 직접 행동 oracle로 둔 이유를 적었다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | lint·typecheck 3구성·Main 전체·문서/diff·메시지 버스를 열거했다. 관련 없는 기존 실패를 blocking으로 올리지 않았다 |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음 — 두 revision 모두 V 표를 직접 갖는다.
- root PLAN_GAP과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-01 실제 소비·호출 경로로 진단 | 파일 수가 아니라 소비처 기준 | §8 Research의 각 항목이 파일:라인 소비처를 든다 |
| D-02 기존 모듈 안에서 결집·죽은 계약 제거 | 새 플랫폼·DI·계층 0 | 신규 production 모듈은 `infra/db/usage-queries.ts`·`features/history/reader.ts` 둘뿐이고 둘 다 기존 레이어 안이다 |
| D-03 공개 IPC·DB 형식·동작·보안 정책 보존 | 회귀 0 | `shared/ipc.ts`·`shared/protocol.ts` 변경 0, 마이그레이션 추가 0(`check-migrations-appendonly` 20건 동일) |
| D-04 SRT·cowork·OpenCode 미구현 | 런타임 추가 0 | 해당 어댑터 파일 변경 0 |
| D-05 ABI·프로필 격리를 코드 실패와 구분 | 환경/코드 분리 보고 | §9에 내 실행 환경의 분리 근거를 적었다 |
| D-06 hot path 중복·동기 I/O 진단 | 실측과 추론 구분 | 모델 정규화 1회화와 수신 상한만 바꾸고 나머지는 측정 후보로 남겼다 |
| D-07 책임·모듈 경계 재편까지 수행 | r1 유지 + 재편 | ΔV1이 제출·해석·설정·모델·사용량·이력·MCP 7축을 옮겼다 |

### end-to-end 흐름

```text
renderer chat:send
  → app/chat-turn/send.ts (admission)
  → busy면 enqueue.reserveOnBusySession → pendingMessages.enqueue → message.queued
  → 신규면 resolve-turn.resolveTurnProvider → prepareHarnessConfig(SPAWN_ENV_INJECTOR)
  → runtime-entry → post-turn.coordinator.run
  → bus 'turn.event' : usage(UsageTracker.recordTurnUsage → db.usage) → history → title → relay
  → 종료 시 Bootstrap.shutdown: pendingMessages.freeze → titles.dispose → DB close
```

```text
engine add/update/delete IPC
  → refreshHarnessSettings → ctx.deployExtensions({throwOnFailure:true})
  → ExtensionDeploymentService.deployNow (직렬 큐, 실패 reject)
  → finally: harnessSettings.invalidateAll + harnessRuntime.invalidate + catalog.invalidate
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 문제 없음 | `sendOnce`가 error 리스너를 취소 판정보다 **먼저** 등록해 선취소 요청의 늦은 error도 흡수한다(`net-request.ts:76`) |
| false success 가능성 | 제거됨 | r1 이전 engine CRUD는 `deploy` 실패를 warn 후 성공 반환했다. 이제 `throwOnFailure:true`가 reject를 전달한다(`engine.ts:33`) |
| partial failure/rollback | 문제 없음 | `runSerialized`가 실패해도 `rerun` 예약은 실행하고 마지막 결과만 호출자에게 준다(`extension-deployment-service.ts:66~78`) |
| Product/UX의 A가 아닌 B를 구현했는가 | 아니다 | 이동 대상 7축을 원본과 줄 단위로 대조했다(§7) |
| 증상만 제거하고 상태 변화가 남았는가 | 아니다 | `TitleGenerator.dispose`가 controller·timeout을 함께 회수하고 `disposed` 가드가 await 이후 DB 쓰기를 막는다 |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | `useFileAutocomplete` 상당의 캐시 축소는 이번 범위 밖. catalog `ownedKeys`는 `contributions`가 `readonly` build-time 상수라 스냅샷과 원본이 갈리지 않는다 |
| 출력/요청 worst-case 상한 | 개선됨 | `sendOnce`가 선언 길이와 누적 바이트 양쪽에서 초과 즉시 `chunks.length = 0` + `request.abort()`. 초과분을 보관하지 않는다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh a5f62f4..fbaac3fc
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 항목 0건 |
| test-only 참조 10건 | **전부 정상(오탐)** | 10건 모두 **정의 파일 내부에 production 소비자**가 있다. 스크립트는 파일 간 참조만 센다 |
| ↳ `availableModelsOf`·`explicitModelOf`·`normalizeAvailableModels`·`withExplicitModel` | 정상 | `model-parser.ts:60,89,110,97`에서 자기 파일이 호출한다 |
| ↳ `listAdapters` | 정상 | `settings.ts:51` `this.adaptersCache ??= listAdapters(this.root)` |
| ↳ `primaryModelScore`·`SpawnEnvTarget`·`StaleHarnessConfigError` 등 | 정상 | 각 정의 파일 내부 사용 |
| 형제 정책 비대칭 | 없음 | 스크립트 3항 0건 |
| 삭제 모듈의 잔존 참조 | 없음 | `evictIdle`·`PluginToolContext`·`RuntimeToolContribution`·`sameParsedModel`·`available-models`를 `app/src`+`docs/arch` 전체에서 grep — 0건 |
| `settings-entries` 잔존 참조 | 이력만 | `docs/handoff/0188·0190`·`docs/etc/study/…/diagnosis.md`. 전부 과거 증거이고 현재 사양 문서가 아니다 |
| producer ↔ consumer 파생 불일치 | 없음 | 사용량 12메서드 전부 `db.usage` 또는 `UsageQueries` 주입으로 도달. `DbQueries`에 forwarding 메서드 0 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: 확인. `net-request.test.ts` 12케이스는 `sendOnce`·`netFetch`·`createSender`·`BrowserSessionStore`를 **실제로 import**하고 electron만 emitter로 대체한다 — 동명 로컬 재구현이 아니다.
- 핵심 입력/분기가 실제 실행됨: 확인. `bootstrap.shutdown.test.ts`는 `Bootstrap.prototype`의 실제 메서드를 호출한다.
- structural proxy만으로 semantic 목표를 통과시킨 AC: **1건 있다** — D6(§13). `bootstrap.shutdown.test.ts:114`의 정규식 3줄 중 `this.registerTurnEvents(ctx, bus)` 행은 삭제는 잡고 **죽은 배선은 못 잡는다**.
- **선택된 적대 증거 재측정**: 등록 변이 **12건**(M12는 두 지점이라 **13회 실행**) 재현 → **검출 13 · 미검출 0**. 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: 이전 검증 라운드 없음(첫 독립 검증). 덮개 회귀 판정 대상 0.
- **자기검증 분모**: 구현자 ≠ 검증자. 그럼에도 구현 보고에 이름이 없는 축 **14건**을 만들었다(M2b·M4b·N1·N2·N2b·N2c·N3·N4·N4b·N5·N8·N9·N10·N11) → **검출 13 · 미검출 1**(N11 → D1). 여기에 구조적 proxy 엄격화 2건(S1 미검출 → D6 · S2 검출)과 하네스 오탐 대조군 1건(N12)을 더했다.
- **변이 합계 재측정**: 표 29행 = **30회 실행**(M12a·M12b 분리) · 검출 **27** · 미검출 **3**(N11 → D1 · S1 → D6 · N12는 의미 동등 대조군이라 미검출이 정답).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — `bootstrap.ts`의 `this.titles?.dispose()` 삭제 | bootstrap.shutdown | 보고 red | **red** (1 failed / 6) | VP-07·11 등록 변이 |
| M5 — `const titles = (this.titles = …)` 소유 대입 제거 | bootstrap.shutdown | 보고 red | **red** (1 failed / 6) | EP-07 배선 oracle |
| M6 — 구독의 `titles.maybeStart(turn)` 제거 | bootstrap.shutdown | 보고 red 1 | **red** (3 failed / 6) | EP-07 배선 oracle |
| M9 — telemetry의 `ctx.cost.recordTurnUsage` 제거 | bootstrap.shutdown | 보고 red 2 | **red** (2 failed / 6) | EP-16 등록 변이 |
| M10 — `register`의 `registerTurnEvents(ctx, bus)` 호출 제거 | bootstrap.shutdown | 보고 red 1 | **red** (1 failed / 6) | ΔV1 배선 guard |
| M2 — `net-fetch.ts` manual의 `maxBytes` 전달 삭제 | net-request | 보고 red 2 | **red** (2 failed / 12) | VP-08·12 등록 변이 |
| M3 — `browser-session.ts`의 `maxBytes` 전달 삭제 | net-request | 보고 red 1 | **red** (1 failed / 12) | VP-08·12 등록 변이 |
| M4 — `deployExtensions(options)` → `deployNow()` | deploy 4스위트 | 보고 red 1 | **red** (1 failed / 38) | VP-01·14 보강 변이 |
| M11 — bootstrap `mcpConfig` 인자를 미확장 소스로 | deploy 4스위트 | 보고 red 1 | **red** (1 failed / 38) | EP-18 등록 변이 |
| M7 — `send.ts`의 `reserveOnBusySession(...)` 호출 무력화 | chat-turn 19파일 | 보고 red 1 | **red** (1 failed / 121) | EP-11 등록 변이 |
| M8 — `enqueue.ts` 공유 payload의 requirements spread 제거 | `src/main` 전체 | 보고 red 4 | **red** (4 failed / 2116) | EP-11 등록 변이 |
| M12a/M12b — `resolve-turn.ts` 두 곳의 `SPAWN_ENV_INJECTOR` 제거 | `src/main` 전체 | 보고 각 red 1 | **각 red** (1 failed / 2116) | EP-12 등록 변이 |
| **M2b** — `transport.createSender`의 `maxBytes` 전달 삭제 | net-request | 미실행 | **red** (2 failed / 12) | 검증자 추가 축 |
| **M4b** — `deployNow`가 `throwOnFailure`를 무시 | deploy 4스위트 | 미실행 | **red** (6 failed / 38) | 검증자 추가 축 |
| **N1** — `expandEnvRecord`를 r1 이전 누적-missing 로직으로 되돌림 | `src/main` 전체 | 미실행 | **red** (1 failed / 2116) | 검증자 추가 축 |
| **N2** — 상한 판정 `>` → `>=` (경계 1바이트) | net-request | 미실행 | **red** (2 failed / 12) | 검증자 추가 축 |
| **N2b** — 초과 chunk를 그대로 `chunks.push` | net-request | 미실행 | **red** (5 failed / 12) | 검증자 추가 축 |
| **N2c** — `finish`의 abort 리스너 해제 제거 | net-request | 미실행 | **red** (3 failed / 12) | 검증자 추가 축 |
| **N3** — `title-generation`의 await 이후 `disposed` 가드 제거 | `src/main` 전체 | 미실행 | **red** (1 failed / 2116) | 검증자 추가 축 |
| **N4** — busy `admittedAt`을 `Date.now()`로 (순서 계약) | chat-turn 19파일 | 미실행 | **red** (1 failed / 121) | 검증자 추가 축 |
| **N4b** — busy 예약 뒤 `listenRelease` 호출 제거 | chat-turn 19파일 | 미실행 | **red** (1 failed / 121) | 검증자 추가 축 |
| **N5** — `isReadOnly`에서 `canonicalAgentKey` 제거 | `src/main` 전체 | 미실행 | **red** (4 failed / 2116) | 검증자 추가 축 |
| **N8** — `recordTurnUsage`의 `hasContextTokens` 가드 제거 | `src/main` 전체 | 미실행 | **red** (4 failed / 2116) | 검증자 추가 축 |
| **N9** — reader의 `costUsd > 0` 조건 제거 | history·handlers | 미실행 | **red** (2 failed / 62) | 검증자 추가 축 |
| **N10** — convert의 미해결 서버 `continue` 제거 | extensions·app | 미실행 | **red** (4 failed / 396) | 검증자 추가 축 |
| **N11** — `listProviders`의 `.sort()` 제거 | `src/main` 전체 | 미실행 | **green** (2116 passed) | D1 — 잠금 없음 |
| **N12** — 의미 동등 변경(정의 할당 단언) — 하네스 오탐 점검 | infra/db | 미실행 | **green** (43 passed) | 하네스 자기 점검 |
| **S1** — `registerTurnEvents(ctx, bus)`를 텍스트만 남기고 죽은 분기로 | bootstrap.shutdown | 미실행 | **green** (6 passed) | D6 — proxy 한계 |
| **S2** — `titles.maybeStart(turn)`을 죽은 분기로 | bootstrap.shutdown | 미실행 | **red** (2 failed / 6) | 행동 oracle 있음 |

- 동작 보존 추출 라운드인가: **예**. 그래서 hunk 되돌림의 초록은 판정 근거로 쓰지 않았다 — 위 표의 변이는 전부 **계약을 깨는** 변형이지 이전 코드로의 복귀가 아니다. 이동 자체는 §7의 줄 단위 대조로 검증했다.
- 소거 변이의 잔여물 수렴: 해당 없음 — 위 변이들은 `void` 소비·분기 무력화로 미사용 진단을 남기지 않았고, 게이트 red는 전부 행동 단언에서 났다.
- 형제 슬롯 맞바꿈 변이: 해당 없음 — 이번 변경에 서로 다른 계약을 가진 형제 슬롯 쌍이 없다. 가장 가까운 축인 settings/runtime 파서는 N5·N11로 각각 눌렀다.
- `N회` 기준의 실제 관측 주체: `maxActive=1` 직렬화는 `extension-deployment-service.test.ts`가 동시 호출 수를 실제 카운터로 센다.
- 순서 기준의 관측 훅: `bootstrap.shutdown.test.ts`의 `order: string[]`가 usage → history → title → relay 순서를 실제 bus 발화로 기록한다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-15 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | `harnesses/env` + N1 red · `claude.executable-option.test.ts` | env 입력 → 키별 drop / EP-03 1/1 · EP-04 2/2 |
| VP-16 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | `session-runtime.test.ts` 회귀 · registry/pool 회귀 | retire → frame/meta / EP-06 3/3 · EP-10 잔존 0 |
| DP-12 | MD-03 ↔ UT-03 / UT | REQUIRED | PASS | M8 red 4 · N4 red | 공통 queued payload / EP-11 |
| DP-13 | MD-04 ↔ UT-04 / UT | REQUIRED | PASS | `model-parser.test.ts` · N5 red 4 | 파서 정책 차이·canonical / EP-14 |
| DP-14 | MD-05 ↔ UT-05 / UT | REQUIRED | PASS | `queries.test.ts`·`dto.test.ts` · N9 red | 같은 SQL row/기간 / EP-15~17 |
| VP-13 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | `builder.test.ts` + plugin/SDK 소비 | builder → adapter / EP-02·04 |
| VP-14 | AR-02 ↔ IT-02 / IT | REQUIRED | PASS | `handlers/context.test.ts` 타입 대조 · M4 red | bootstrap → 좁은 ctx / EP-07·09 (11/11) |
| DP-08 | AR-03 ↔ IT-03 / IT | REQUIRED | PASS | M7 red · N4b red | send 신규/취소/continuation / EP-11·12 |
| DP-09 | AR-04 ↔ IT-04 / IT | REQUIRED | PASS | `settings.test.ts`·`runtime-catalog.test.ts` | settings 직접 주입 → 모델 목록 / EP-13·14 |
| DP-10 | AR-05 ↔ IT-05 / IT | REQUIRED | PASS | M9 red 2 · M10 red | tracker/reader가 `db.usage` 사용 / EP-15~17 |
| DP-11 | AR-06 ↔ IT-06 / IT | REQUIRED | PASS | M11 red · N10 red 4 | bootstrap → toClaudeConfig → deploy / EP-18 |
| VP-11 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | M1·M5·M6 red · N3 red | send 실패 → finally, shutdown → dispose / EP-05~07 |
| VP-12 | SD-02 ↔ ST-02 / ST | REQUIRED | PASS | M4b red 6 · M2·M3 red | IPC → 배포 queue · capped 수신 / EP-01·08 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | PASS | `engine.deployment.test.ts` + service 동시/실패 | engine → deployExtensions / EP-01 3/3 |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | PASS | `builder.test.ts` 5 + runtime tool 소비 | bootstrap → builder → adapter / EP-02 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | PASS | N1 red(반복 변수 후속 키 drop) | turn setup → expandEnvRecord / EP-03 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | PASS | `claude.executable-option.test.ts` + SDK Options 타입 | complete/sendMessage / EP-04 2/2 |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | PASS | `send.worktree.test.ts` 오류 주입·idle 반납 | chat send → acquire/run → finally / EP-05 |
| VP-06 | R-06 ↔ AT-06 / AT | REQUIRED | PASS | `session-runtime.test.ts` 기존 행동 | consume/pump/teardown / EP-06 3/3 |
| VP-07 | R-07 ↔ AT-07 / AT | REQUIRED | PASS | M1·M5·M6·S2 red · N3 red | bootstrap → TitleGenerator → shutdown / EP-07 |
| VP-08 | R-08 ↔ AT-08 / AT | REQUIRED | PASS | `net-request.test.ts` 12 · M2·M3·M2b·N2·N2b·N2c red | sender/netFetch·BrowserSessionStore → sendOnce / EP-08 2/2 |
| VP-09 | R-09 ↔ AT-09 / AT | REQUIRED | PASS | handler 15개 중 `RouterContext` 전체를 받는 것 0 | bootstrap RouterContext → 좁은 ctx / EP-09 11/11 |
| VP-10 | R-10 ↔ AT-10 / AT | REQUIRED | PASS | registry/pool/supervisor·runtime config 회귀 | 기존 production 소비자 / EP-10 |
| VP-17 | R-11 ↔ AT-11 / AT | REQUIRED | PASS | N2b red(수신 중단) · builder MCP 조회 제거 | turn build / 네트워크 수신 / EP-02·08 |
| DP-01 | R-12 ↔ AT-12 / AT | REQUIRED | PASS | M7·M8·N4·N4b red | send → enqueue → queue·wire / EP-11 |
| DP-02 | R-13 ↔ AT-13 / AT | REQUIRED | PASS | M12a·M12b red · `resolve-turn.runtime-catalog.test.ts` | resolve-turn → runtime request / EP-12 |
| DP-03 | R-14 ↔ AT-14 / AT | REQUIRED | PASS | `settings.test.ts` mtime/invalidate · N11 예외(D1) | 소스 열거 → resolve → parser / EP-13·14 |
| DP-04 | R-15 ↔ AT-15 / AT | REQUIRED | PASS | §7 SQL 줄 대조 259/260 · M9·N8 red | telemetry → tracker → db.usage / EP-15·16 |
| DP-05 | R-16 ↔ AT-16 / AT | REQUIRED | PASS | `session.load.test.ts`·`reader.test.ts` · N9 red | DB → reader → sessionLoad / EP-17 |
| DP-06 | R-17 ↔ AT-17 / AT | REQUIRED | PASS | `convert.test.ts` · N10 red 4 · M11 red | MCP source → convert → deploy / EP-18 |
| DP-07 | R-18 ↔ AT-18 / AT | REQUIRED | PASS | N5 red 4 · `runtime-catalog.test.ts` | 선언 → canonical membership → default / EP-14 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: M2·M3은 VP-08과 VP-12를, M9는 DP-04와 DP-10을 함께 닫는다. 각 행에 판정 범위를 적었다.
- 이번 라운드 실행 범위: **최초 독립 검증** — V1 VP-01~17과 ΔV1 DP-01~14 전건, 그리고 현재 변경의 운영 gate 전건을 실행했다.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | engine CRUD가 배포 직렬화 공유, 실패에도 캐시 무효화 | ✅ | `refreshHarnessSettings` 호출 3곳(add/update/delete), `finally` 무효화 3종 | engine.ts:58,70,78 |
| AT-02 / AC2 | 턴 확장이 필요한 값만 전달 | ✅ | `ExtensionBuilder`에서 McpStore 인자 제거, builder 테스트 통과 | bootstrap.ts:565 |
| AT-03 / AC3 | 반복 미해결 변수의 후속 키도 제외 | ✅ | N1 되돌림에서 red | env.ts:16 |
| AT-04 / AC4 | 단발·대화 공통 옵션 유지 | ✅ | `query(` 진입 2곳 동일 조립 | claude.ts:273,361 |
| AT-05 / AC5 | 준비 실패·owner 소멸에서 listener·lease 회수 | ✅ | `send.worktree.test.ts` 오류 주입 | send.ts |
| AT-06 / AC6 | 채널 종료 3진입이 같은 retire | ✅ | `retireChannel` 호출 3곳(387·499·549) | session-runtime.ts |
| AT-07 / AC7 | 종료 후 제목 생성이 DB를 쓰지 않음 | ✅ | N3 가드 제거에서 red | title-generation.ts:75 |
| AT-08 / AC8 | 두 인증 경로가 수신 중 maxBytes 적용 | ✅ | `sendOnce` production 호출 2곳, 변이 6건 전부 red | net-request.ts:136 · browser-session.ts:131 |
| AT-09 / AC9 | 핸들러가 사용 속성만 요구 | ✅ | `ctx: RouterContext` 전체를 받는 handler 0 | handlers/*.ts |
| AT-10 / AC10 | 무동작 계약만 제거 | ✅ | `evictIdle`·`PluginToolContext`·`RuntimeToolContribution` 잔존 0 | registry·runtime-tools |
| AT-11 / AC11 | 성능 위험을 실경로·입력량으로 분류 | ✅ | 수신 중단 N2b red, 나머지는 진단 보고서 §4에 측정 후보로 기록 | diagnosis.md |
| AT-12 / AC12 | 신규·busy가 같은 적재 모듈·같은 wire | ✅ | `enqueueMessage` 단일 함수, M8 red 4 | enqueue.ts |
| AT-13 / AC13 | 해석과 발신 분리, 준비 순서 유지 | ✅ | injector 2곳 red, `turn-setup.ts` 삭제 후 잔존 import 0 | resolve-turn.ts:185,207 |
| AT-14 / AC14 | 설정 서비스가 열거·캐시 소유, 파서 정책 보존 | ✅ | `settings.ts` 이동 대조 · bootstrap의 `models:[]` 보정 제거 | settings.ts:179 · bootstrap.ts:452 |
| AT-15 / AC15 | 사용량 SQL·기록 수명이 각 소유자로 | ✅ | 삭제 259줄 중 259줄이 `usage-queries.ts`에 동일 재등장 | usage-queries.ts |
| AT-16 / AC16 | reader가 LoadedSession을 동일 복원 | ✅ | 원본 대비 수신자만 바뀐 축자 이동 · N9 red | reader.ts |
| AT-17 / AC17 | 변환이 한 모듈, 미해결 서버 전체 제외 | ✅ | `expand.ts` 삭제, N10 red 4 | convert.ts |
| AT-18 / AC18 | canonical key 1회 구성, default는 최종 목록에서 | ✅ | `ownedKeys` 생성 시 1회 · N5 red 4 | runtime-catalog.ts:61,149 |

- **합계 재측정**: `✅ 18 · ⚠️ 0 · ❌ 0 = 총 18`(AC1~11 11개 + AC12~18 7개를 직접 셈) · 자기보고 18 · **일치**.
- **합계 사본 대조**: 본문 18 ↔ 커밋 `fbaac3fc` trailer `Criteria-Met: 18/18` ↔ INDEX 비고(수치 미기재) — **갈림 없음**. r1 커밋 `eeb95e4a`의 `Criteria-Met: 11/11`도 V1 분모 11과 일치.
- pair 합계 재측정: REQUIRED **31**(VP-01~17의 17 + DP-01~14의 14) · PASS 31 · PAIR_FAIL 0 · 자기보고 31 · **일치**.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01·12 | 배포 직렬화 | EP-01 engine add/update/delete (3) | `refreshHarnessSettings` 호출 3 | **3/3** PASS |
| VP-02·13·17 | 턴 확장 전달 | EP-02 TurnExtensions·builder·bootstrap 배선 | 세 지점 모두 MCP 인자 제거 | PASS |
| VP-03·15 | env 값별 판정 | EP-03 expandEnvRecord loop (1) | 값별 `valueMissing` Set 1곳 | **1/1** PASS |
| VP-04·13·15 | SDK 공통 옵션 | EP-04 complete / sendMessage (2) | `query(` 진입 2 | **2/2** PASS |
| VP-05·11 | 정리 소유 | EP-05 준비 실패/실행 종료 (2 가지) | 바깥 finally가 listener 포함 회수 | PASS |
| VP-06·16 | 채널 retire | EP-06 consumeOneShot/pump/teardown (3) | `retireChannel` 호출 3 | **3/3** PASS |
| VP-07·11·14 | 제목 소유 | EP-07 생성/완료/dispose + shutdown | 4지점 · M1·M5·M6·S2 red | PASS |
| VP-08·12·17 | 수신 상한 | EP-08 createSender→netFetch→sendOnce, BrowserSessionStore→sendOnce (2) | production `sendOnce` 호출 2 | **2/2** PASS |
| VP-09·14 | 좁은 ctx | EP-09 RouterContext의 사용 handler 전수 | 좁힌 handler 11, 전체 ctx 0 | **11/11** PASS |
| VP-10·16 | 옛 계약 제거 | EP-10 registry/pool/runtime-tools/runtime-config 소비자 | 삭제 심볼 잔존 0 | PASS |
| DP-01·08·12 | 제출 소유 | EP-11 send 분기·enqueue·index cancel·turn-request submitted | 4지점 모두 `enqueue.ts` 경유 | PASS |
| DP-02·08 | 해석 소유 | EP-12 injector 전달 지점 (plan: “이 파일 두 곳뿐”) | `resolve-turn.ts` 2곳, 각각 red | **2/2** PASS |
| DP-03·09 | 설정 소스 | EP-13 열거·resolve·bootstrap 주입 | `models:[]` 보정 wrapper 제거 확인 | PASS |
| DP-03·07·09·13 | 모델 목록 | EP-14 settings/runtime parser 진입·catalog | `available-models.ts` 제거, 두 진입 분리 | PASS |
| DP-04·10·14 | 사용량 SQL | EP-15 DbQueries 사용량 statement/method와 소비자 | forwarding 0, 소비자 전부 `UsageQueries` | PASS |
| DP-04·10·14 | 기록 수명 | EP-16 subscriber·tracker·usage-map | 세 파일 중 둘 삭제, 기록은 tracker 소유 | PASS |
| DP-05·10·14 | 이력 조립 | EP-17 session load IPC·조립·DTO 변환 | handler는 검증+activity만 | PASS |
| DP-06·11 | MCP 변환 | EP-18 convert→expand 생산 경로·소비 | `expand.ts` 삭제, 단일 진입 | PASS |

- 표에 없는데 같은 불변식이 필요한 지점: **없음**. `listProviders`의 정렬 결정성은 §10 어느 행의 `실패 의미`에도 없다 → D1로 NON_BLOCKING 처리.
- `실패 의미`가 “다른 게이트가 막는다”고 적은 행: EP-09가 “불필요 속성 참조는 타입 오류”라고 적었다. `npm run typecheck` 3구성 진단 0으로 재측정했고, `handlers/context.test.ts`가 최소 fixture로 같은 계약을 실행한다.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| Main·shared lint | main/shared 레이어 수정 | **PASS** | `node node_modules/eslint/bin/eslint.js src scripts` → error 0 / warning 1. 유일한 warning은 `useTranscriptVirtualizer.ts:22` react-hooks/incompatible-library로 renderer의 기존 것이며 이번 변경 무관 |
| 타입 3구성 | 내부 계약·fixture 변경 | **PASS** | `npm run typecheck` node/web/test 전부 출력 0줄(진단 0) |
| 변경 행동 및 Main 회귀 | 기존 기능·오류·취소 경로 | **PASS** | `vitest run src/main` = **193파일 2,116케이스 통과, 실패 0 · skip 0** |
| 문서·diff | 현재 구조 정합 | **PASS** | `check-doc-inventory.mjs --check` = generated 9 items/82 channels·prose·상대링크 ok · `git diff --check` 오류 0 |
| 마이그레이션 append-only | DB 레이어 수정 | **PASS** | `check-migrations-appendonly.mjs` = 20 migrations, dir == imports |
| 메시지 버스 | plan/impl 분리·trailer | **PASS** | §11 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `Options`(claude query) | `typecheck:node` 진단 0 | `claude.executable-option.test.ts` 6케이스가 두 진입의 옵션을 직접 비교 | PASS |
| `SendOnceOptions.maxBytes` | `MainRequestInit = RequestInit & Pick<SendOptions,'maxBytes'>`로 표준 fetch 포트와 구조 호환 | 변이 6건이 전부 red | PASS |
| `security.md` §1.4 서술 | — | 코드·`§1.4-b` 경계표·`standardization.md` §5와 대조 | **정정이 옳다**(D2) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 사용량 SQL 이동의 축자성: `queries.ts` 삭제 260줄을 공백 정규화 후 정렬해 `usage-queries.ts`와 대조 — **차집합 1줄**이고 그것은 import 목록 말미의 `UsageSumRow,` ↔ `UsageSumRow`(콤마 유무)다. 실질 259/259 동일.
- `settings-entries.ts` 이동: 삭제 91줄 중 미재등장 11줄은 전부 주석·import·`defaultProvider`의 시그니처 줄이다. 본문 `return entries.find(...) ?? entries[0]`은 동일하고 제네릭 완화만 있다.
- Main 테스트 수: 자기보고 193파일/2,116 · 내 측정 **193파일/2,116** — 일치.
- 전체 저장소 테스트 수: 377파일/3,559. `main 193/2,116` + `preload·renderer·shared 184/1,443` = **377/3,559** — 내역 합 = 총계.
- `RouterContext` 좁히기 11: `registerXHandlers` 15개 중 `Pick`/전용 인터페이스 11 · 다른 dep 타입 3(git·providers·chat) · 인자 없음 1(log). 전체 ctx 0.
- 수신 상한 worst-case: 선언 길이가 초과면 data 리스너를 아예 달지 않고 abort. 미신고면 첫 초과 chunk에서 `chunks.length = 0` 후 abort — 보관 상한은 `maxBytes + 마지막 chunk` 1개다.
- 0건 게이트의 정당한 예외 보존: `no-node-fetch.test.ts`의 `ALLOWED = {net-fetch.ts}`는 이번 변경에서 손대지 않았고(diff 0줄) 자체 민감도 케이스를 갖는다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Chromium `net.request` 수신 상한 | electron을 EventEmitter로 대체해 선언/누적/취소/3xx/정상 12케이스 | 실제 사내 프록시·사설 CA 경유 대용량 첨부 | 사내망에서 첨부 다운로드 후 크기 초과 오류 문구 확인 |
| Electron 종료 시퀀스 | `Bootstrap.prototype`을 실제 호출해 dispose·DB close 순서 | GUI 종료 중 제목 생성 진행 상태 | 제목 생성 중 창 닫기 → 재시작 후 제목 미변경 확인 |
| better-sqlite3 Electron ABI | Node ABI로 DB 스위트 전건 실행 | Electron ABI 런타임 실기 | `npm run dev` 가능한 환경에서 부팅 후 세션 로드 |

- “electron이라 불가”로 넘긴 순수 로직은 없다. r1이 `net-request.ts`·`net-fetch.ts`의 P29(테스트 미import) 제약을 mock으로 해제했고, 그 결과가 위 12케이스다.

## 9. 게이트 재실행

```text
$ cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts   # exit 0
$ npm rebuild better-sqlite3                                          # exit 0 (Node ABI, 소스 컴파일)
$ node node_modules/electron/install.js                               # exit 0 (electron dist 확보)
$ npm run typecheck                                                   # node/web/test — 출력 0줄
$ node node_modules/eslint/bin/eslint.js src scripts                  # error 0 / warning 1
$ node node_modules/vitest/vitest.mjs run --maxWorkers=2              # 377파일 3,559케이스
$ node scripts/check-doc-inventory.mjs --check
$ node scripts/check-test-budgets.mjs
$ node scripts/check-migrations-appendonly.mjs
$ git diff --check
```

- **관측한 실행 산출**(exit code 아님): typecheck는 세 구성 모두 진단 줄 0. eslint는 `✖ 1 problem (0 errors, 1 warning)`. vitest는 `Test Files 377 passed (377)` / `Tests 3559 passed (3559)`, skip·todo 0줄. doc-inventory는 `generated doc ok (9 items, 82 channels)`·`prose ok`·`links ok`. test-budgets는 `10 real-git suites ok`. migrations는 `20 migrations, dir == migrate.ts imports`.
- `npm test`를 썼는가: **아니다**. `pretest`를 우회해 `vitest.mjs`를 직접 호출했다. better-sqlite3는 Node ABI로 이미 빌드돼 DB 스위트가 정상 실행됐다.
- ABI 전환/egress 403 등 환경 기인 실패 분리: 최초 실행에서 3파일(`bootstrap.shutdown`·`send.busy`·`chat-turn.continuity`)이 `Electron failed to install correctly`로 죽었다. 이는 내가 `--ignore-scripts`로 설치해 electron dist가 없던 탓이고, `install.js` 실행 후 같은 3파일이 9케이스 전건 통과했다. **코드 무관**.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`(`--fix`)를 쓰지 않고 `eslint.js`를 직접 호출했다. 모든 게이트 실행 후 `git status --short` 출력 0줄.
- **검증 중 실행한 명령이 남긴 잔여물**: 있었고 정리했다. 변이 하네스가 `app/src/renderer/src/features/chat/store/tmp.*` 2개를 남겨 삭제했고, 직접 관측용 임시 테스트 `__verify_gc.test.ts`(0222 검증용)도 삭제했다. 최종 `git status --short` 출력 0줄.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | PASS |
| AC ↔ production path | 18행 1:1 대조 | — | PASS |
| 레이어/계약/문서 링크 | boundaries lint·doc-inventory | — | PASS |
| AGENTS 위생/부모-자식 모순 | `app/src/main/AGENTS.md` 스캔 | — | PASS(§11) |
| 제품 의도 / Open Question | 보조 의견 | **결정** | 미해결 항목 없음 |
| UI/UX 시각 품질 | 해당 없음(main 전용) | — | — |
| 신규 의존성 / PR merge | 의존성 추가 0 확인(`package.json`·lock diff 0) | **merge 승인** | 사람 몫 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 대상: `app/src/main/AGENTS.md`(r2에서 7줄 수정).
- 키/토큰/PW/이메일/IP 등 민감 패턴: **0건**.
- 일회성·변동 운영정보·장문 구현 설명 혼입: 없음. 삭제된 `busy-reserve.ts`·`turn-setup.ts` 행을 지우고 `enqueue.ts`·`deps.ts` 책임을 갱신한 것이 전부다.
- 부모 ↔ 자식 명령 충돌: 없음. root `AGENTS.md`·`app/AGENTS.md`의 레이어 DAG 서술과 모순되지 않는다.
- 새 `AGENTS.md`: 없음 → stub·root 표 갱신 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 검증 전 `impl/IMPL_DONE (ΔV1) · Claude · eeb95e4a (r1) · r2 구현 커밋은 검증자 기입`. 실제 상태와 일치했다.
- 「다음 주체」 칸: `Claude` 하나.
- 대상 커밋 좌표 기입: r2 = **`fbaac3fc`**를 이번 검증에서 채웠다. 설계 커밋 `e18262b`(V1)·`a5f62f4`(ΔV1)도 함께 기입했다. 모두 `git cat-file -t` = commit.
- 비고 5줄 이내: 예(1줄).
- PASS 시 archive 이동: 이번 PASS로 `docs/archive/handoffs/INDEX-history.md`로 이동했다.

### Commit / reference 정합성

- trailer 허용값: `e18262b`·`a5f62f4` = `Agent: codex` + `Status: designed`, `eeb95e4a`·`fbaac3fc` = `Agent: codex` + `Status: implemented` + `Criteria-Met` + `Verified-By: pending`. 모두 root `AGENTS.md` 허용값이다.
- trailer 실제 파싱: `git log -1 --format='%(trailers:only=true)'`가 설계 커밋 **3키**, 구현 커밋 **5키**를 그대로 반환한다. 0건 없음.
- 인용된 커밋 해시 실재: `054ede9b`(기준 코드)·`eeb95e4a`(기준 V) 모두 `git cat-file -t` = commit.
- 재구현 라운드 `[구현자 기입]` 7필드: r2에 **7/7** 존재(설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals). 산문으로 접힌 필드 0.
- 이동/삭제 reference: `busy-reserve.ts`·`turn-setup.ts`·`settings-entries.ts`·`available-models.ts`·`subscriber.ts`·`usage-map.ts`·`expand.ts` 7개 삭제. 살아 있는 소비처 0(§3), 과거 handoff 문서의 언급은 이력으로 보존.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| r1: 큐의 warn/null이 엔진 reject를 삼키는 회귀를 발견해 `throwOnFailure` 추가 | **타당**. D-03(실패 의미 보존)의 구현 보완이고 새 제품 결정이 아니다. M4b(6 red)로 잠금 확인 | 유지 |
| r1: 선취소 signal에서 error 리스너 등록 순서 정정 | **타당**. N2c(3 red)로 잠금 확인 | 유지 |
| r2: `security.md`의 “평문 파일 없음” 서술을 실제 경로에 맞게 정정 | **정정이 옳다**. 같은 문서 §1.4-b 예외표 1번과 `standardization.md` §5(117행)가 이미 `.mcp.json` 평문 렌더를 서술했다 — 문서 내부 모순을 없앤 것이고 정책 변경이 아니다 | 유지 + D2 기록 |
| r2: settings fixture의 불필요한 `models` 속성 제거 | 타당. 공개 계약 변경 없음 | 유지 |
| r2: 성능 후보를 진단 보고서에 기록만 | 타당. 추정 수치를 쓰지 않았다 | 유지 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `listProviders`의 `.sort()`(결정적 기본 provider 선택)를 제거해도 `src/main` 2,116케이스 전건 green — 정렬 결정성을 잠그는 oracle이 없다 | 비귀속(§10 어느 `실패 의미`에도 없음) | **NON_BLOCKING** | DP-03 인접 | 기존 코드의 축자 이동이라 이번 라운드 회귀가 아니다. provider 2개 이상 fixture로 정렬 케이스 1개 추가 권고 |
| D2 | `docs/arch/backend/security.md` §1.4 재작성이 “디스크 평문 0” 서술을 제거하고 상세를 줄였다 | 비귀속(문서 정합) | **NON_BLOCKING** | — | 정정 자체는 옳다(§12). 세부 정본이 `standardization.md` §5로 옮겨졌으므로 그쪽이 계속 현재 상태를 갖는지 다음 라운드에 확인 |
| D3 | scan-surface의 test-only 후보 10건 | 비귀속(오탐) | **NON_BLOCKING** | — | 전부 정의 파일 내부 production 소비자 있음. 기록만 |
| D4 | `ExtensionDeploymentService`의 `inflight = null`이 `.finally` 마이크로태스크에서 실행돼, 그 창에 들어온 `deployNow`가 이미 끝난 실행에 코얼레스될 수 있다 | 비귀속(선행 존재) | **NON_BLOCKING** | VP-01·12 인접 | r1 이전과 동일 구조다. 실사용 트리거(같은 tick의 CRUD 연타)를 확인한 뒤 별도 handoff 후보 |
| D5 | `deployNow` 기본 호출이 `this.inflight.catch(() => null)`을 매번 새로 붙인다 | 비귀속 | **NON_BLOCKING** | — | 동작상 문제 없음(핸들러가 붙으므로 unhandled rejection 없음). 기록만 |
| D6 | `bootstrap.shutdown.test.ts:114`의 `this.registerTurnEvents\(ctx,\s*bus\)` 정규식은 **삭제는 잡고 죽은 배선은 못 잡는다**(S1 green). 같은 파일의 `titles.maybeStart`는 행동 oracle이 받쳐 S2에서 red | 비귀속(plan이 선정한 적대 증거 아님) | **NON_BLOCKING** | DP-10 인접 | plan ΔV1이 선정한 배선 oracle 2건(EP-11·EP-16)은 M7·M9로 행동 red를 확인했다. `register()` 진입의 행동 oracle 1개 추가 권고 |

- plan의 `[검증자 기입] 파생 이슈`로 이관했다.
- `PLAN_GAP` **0** — 결과는 `RETURN_TO_PLAN`이 아니다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음 — 독립 검증 라운드는 이번이 처음이다. r1→r2는 외부 verify FAIL이 아니라 사용자 정정(D-07)에 따른 범위 확장이다.
- 관련 plan 지침/AC의 존재 여부: D1이 건드린 정렬 결정성은 §10 `실패 의미`에 없다. D6이 건드린 `register()` 진입 배선은 ΔV1의 “새 배선 oracle” 선정 2건에 포함되지 않는다.
- 사용자 결정 변경 근거: D-07이 사용자 정정 원문을 인용해 설계 커밋에 들어왔다. 무단 변경 없음.
- 반복된 검증 환경 한계: better-sqlite3 ABI와 electron dist 확보가 이번에도 첫 실행을 막았다. 두 가지 모두 로컬에서 해소해 **환경 기인 실패 0으로 게이트를 마쳤다** — 구현자 보고의 “Electron Node 모드” 우회와 다른 경로로 같은 범위를 덮었다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **31 PASS** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-01~07 전부 충족. 공개 IPC·DB 스키마·의존성 변경 0
- AC 충족: ✅ 18 · ⚠️ 0 · ❌ 0 / 18
- 현재 변경 운영 gate: lint·typecheck 3구성·Main 193파일 2,116케이스·문서·마이그레이션·diff 전건 PASS
- NON_BLOCKING / NEXT_HANDOFF: D1~D6 6건. 어느 것도 현재 pair·ACTIVE Decision·필수 gate에 귀속되지 않는다
- repository operation checks: AGENTS 위생·INDEX·trailer 파싱·삭제 reference 전부 PASS
- 남은 사람 확인: 사내망 대용량 첨부 실기, GUI 종료 중 제목 생성 실기, Electron ABI 런타임 부팅, PR merge
- 다음 단계: INDEX 행을 archive로 이동. D1·D6의 oracle 보강은 후속 handoff 후보
