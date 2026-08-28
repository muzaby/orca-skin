# Verify — 0207-closed-network-custom-env

## 메타

| 항목 | 값 |
|---|---|
| slug | `0207-closed-network-custom-env` |
| 검증자 | Claude Code |
| 일자 | 2026-08-28 |
| 대상 커밋/range | `72191f6..ba7d220` (구현 커밋 `ba7d220`) |
| 구현 전 plan 기준 | `72191f6` + 설계 정정 `2b40466`·`c513e75` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `c513e75:V1` (VP-16·VP-26 은 `72191f6` 원문으로도 채점) |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 같은 에이전트다.** 완화 방향 정정(§0)은 원 기준으로 다시 채점했다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 변경했으나 **`[구현자 기입]` 블록만**이다. `ba7d220` 의 plan diff hunk 는 `@@ -535,78 +535,139 @@` 하나이고 제거된 줄은 전부 템플릿 자리표시자(`| … |`)다.
- **기준선이 diff로 성립하는가**: 예. 규범 정정 2건이 구현과 **분리된 커밋**(`2b40466`·`c513e75`)이라 §0 의 자기 증명 방지 장치가 작동한다.
- Decision Ledger 변경: D-001~D-008 원문 무변경. `갱신 메모`에 정정 provenance 2줄 추가.
- Product/UX Contract 변경: 없음. §5 상태표 8행 원문 그대로다.
- AC 변경: **AC16 1건**(`우선순위 서술 사본 4곳` → `12곳`). 기준을 **넓히는** 방향이라 자기 완화가 아니다.
- V node/pair·requiredness·§10·oracle 변경: AR-04·VP-26·EP-12 분모(정정 1), VP-16·VP-26 적대 증거와 EP-07 성격(정정 2).
- **채점에 사용할 원 기준**: 정정 1은 기준을 넓히므로 새 기준으로 채점한다. **정정 2는 실측 후 기준을 내리는 방향이라 `72191f6` 원문으로 다시 채점했다** — 원문 VP-16 "그 항을 지우는 변이로 red 확인", 원문 VP-26 "한 사본을 4층으로 되돌리는 변이를 심어 … red 인지 확인".

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 상속할 기존 V 없음. 0200 plan 에 node/pair registry 부재 확인 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | node registry 22행 · pair registry **26행**(REQUIRED 20 · REGRESSION 6) 재측정 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | REGRESSION 6건(VP-13·14·19·20·22·25)이 결정표·fast path·fingerprint·baseEnv·boundaries·secret 격리를 덮는다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 26행 모두 3칸을 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | **PLAN_GAP 1건(해소됨)** | 원문 VP-16 의 변이는 **성립할 수 없다**(§4). 정정 2가 구현 전 별도 커밋으로 해소 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | gate 4행이 이번 산출물 기준. better-sqlite3 기존 red 를 blocking 으로 올리지 않았다 |

- root PLAN_GAP과 영향 pair: **VP-16 / EP-07** — 구현 턴에 발견돼 `c513e75` 로 해소됐고 HEAD 에 남아 있지 않다. 남은 것은 결함이 아니라 **제품 결정 1건**(D1)이다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-002 모든 key | key 를 가리지 않고 주입된다 | 등록이 아니라 조립부 1지점이라 key 분기가 없다. `harness-config.ts:321` |
| D-003 하네스 직전 최상위 | augmenter 를 이긴다 | 최종 spread 마지막이 `...customEnv` (`:353`) |
| D-004 host env 스냅샷 | `process.env` 한 장 | `hostEnv: baseEnv()` — 판정·조립과 같은 closure(`:315-316`) |
| D-006 동기·순수·무능력 | credential·network 없음 | 입력이 `{target, hostEnv}` 2필드. `signal`·`auth`·`secrets` 접근이 컴파일 오류 |
| D-007 `resolved:false` | 빈 문자열 key 를 넘기지 않는다 | discriminated union — `resolved:false` 갈래에 `key` 가 없다 |
| D-008 기본 `undefined` | 무회귀 | `SPAWN_ENV_INJECTOR = undefined`; 미등록 턴은 `EMPTY_ENV` 로 기존 판정식을 그대로 탄다 |

### end-to-end 흐름 (실측)

```text
app/deployment/spawn-env.ts (SPAWN_ENV_INJECTOR)
  → turn-setup.ts:102 · :125            (조립 호출 2 = injector 인자 2)
  → prepareHarnessConfig 5층 spread     (harness-config.ts:347-354)
  → envFingerprint 1회                  (:358)
  → send.ts:292 `env: {...prepared.env}` / continuation.ts:89
  → claude.ts:263 `adaptEnv(req.env)` · :383
  → SDK query options.env → subprocess
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 계약대로 | injector 가 던지면 조립이 그대로 던진다(probe P6). 반쯤 채운 env 로 spawn 하지 않는다 |
| false success 가능성 | 없음 | 삼키는 하위 호출이 없다. 조립은 순수 동기이고 `try/catch` 를 새로 만들지 않았다 |
| partial failure/rollback | 해당 없음 | 새 저장소·외부 쓰기 0. in-memory 조립뿐 |
| Product/UX 의 A 가 아닌 B | 아니오 | §5 상태표 8행이 그대로 성립 |
| 증상만 제거하고 상태가 남았는가 | 해당 없음 | 제거한 동작이 없다 — 레이어 추가만 |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | cache·조기 반환을 만들지 않았다. `baseEnv` 는 1회로 유지(카운터 관측) |
| 출력/요청 worst-case 상한 | 증가 0 | injector 는 network 를 부르지 않는다. 폐쇄망 왕복 증가 0 |
| **새 표면의 입력 신뢰 경계** | **결함 1건** | injector 에게 넘기는 참조가 변형 가능하다 → D3 |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export `SpawnEnvTarget` | 정상 | 배포가 구현하는 **공개 계약 타입**이다. 가이드 §3-d 예제가 `target.resolved`·`harnessId` 를 쓴다 |
| 미사용 export `SpawnEnvInjector` | 정상 | `spawn-env.ts` 가 타입 주석으로, 테스트가 값으로 쓴다 |
| 테스트 전용 참조 | 없음 | `SPAWN_ENV_INJECTOR` 의 프로덕션 소비처는 `turn-setup.ts` 다 |
| 형제 정책 비대칭 | **결함 1건** | `hostEnv` 는 `Readonly<>` 인데 `target.settings` 는 아니다 → D3 |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `deployment-wiring.test.ts:409` "augmenter factory 3종은 기본 배포에서 비어 있다" 그대로 green |
| producer ↔ consumer 파생 불일치 | 없음 | `adaptEnv` 는 prepared env 를 변형 없이 싣는다. fingerprint 계산은 1지점 |
| 동일 규칙 중복 구현 | SSOT 유지 | 조립 순서의 실행 정본은 spread 하나. 나머지 11곳은 서술 사본이고 EP-12 가 전수로 센다 |
| 가이드 §1.1 파일 목록 ↔ 실제 배포 디렉토리 | 일치 | 양쪽 7파일, `spawn-env.ts` 포함 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 케이스 실제 존재: 확인. `:139`(현 `:146`) fast path · `:265`(현 `:272`) 비-1 flag · `:521`(현 `:577`) 결정표가 전부 실재하고 green.
- structural proxy 만으로 통과시킨 AC: **AC12 1건** → D2. 나머지는 최종 env 값·참조·카운터를 직접 읽는다.
- **선택된 적대 증거 재측정** — 등록 변이 7건 + 검증자 신규 5건 = 12건 중 **검출 8 · 미검출 4**. 일반 hunk 자동 확장 0.

| 변이 | 출처 | 재측정 결과 | 구현자 보고와 |
|---|---|---|---|
| M1 spread 맞바꿈 | VP-04 등록 | **red** 4케이스 | 일치 |
| M2 위임 인자 제거 | VP-09 등록 | **red** 1케이스 | 일치 |
| M3 flag 체인 custom 항 삭제 | VP-16 **원문** 등록 | **green 74/74** | 일치 |
| M3b flag 체인 형제 맞바꿈 | VP-16 방향축 | **green 74/74** | 일치 |
| M4 turn-setup 한 호출부 인자 제거 | VP-21 등록 | **red** 1케이스 | 일치 |
| M5a 사본을 옛 층수 표현으로 | VP-26 원문 등록(층수축) | **red** 스윕 0→1줄 | 일치 |
| M5b 체인 최상위 줄만 삭제 | VP-26 원문 등록(체인축) | **green** 스윕 0줄·doc gate exit 0 | 일치 |
| **P2** 한 호출부를 `customEnv: undefined` 로 | 검증자 신규 | **red** 1케이스 | — |
| **P3** 배선 없는 세 번째 호출부 추가 | 검증자 신규 | **red** 1케이스 | — |
| **M-NEW1** `buildsEnv` 에서 `hasCustomEnv` 제거 | 검증자 신규 | **red** 5케이스 | — |
| **M-NEW2** `spawnEnvTarget` 이 stripped blob 전달 | 검증자 신규 | **red** 1케이스 | — |
| **P1** AC12 반쪽의 인과 확인 | 검증자 신규 | **green** — flag 무관 키로도 hoist 발생 | — |

- 동작 보존 추출 라운드인가: 아니오 — 신규 레이어라 hunk 되돌림이 판정 근거가 되는 상황이 아니다.
- 형제 슬롯 맞바꿈 변이: 수행(M3b·M1). M1 은 red, M3b 는 green이며 그 이유는 구조적이다(§13 D1).
- **VP-16 원 기준 재채점**: 원문이 요구한 red 를 얻지 못했다. 다만 이는 구현 결함이 아니라 **원 기준이 성립 불가**라는 사실이다 — 증명은 D1.
- **VP-26 원 기준 재채점**: 층수 축은 red(M5a), 체인 축은 green(M5b). 원문이 요구한 "그 사본을 읽는 검사가 red" 는 축의 절반만 성립한다 → D2·D4.
- `N회` 기준의 실제 관측 주체: `baseEnv` 호출 카운터를 조립 안에서 증가시켜 `reads === 1` 을 직접 읽는다.
- 순서 기준의 관측 훅: 5키 경쟁 표에서 키마다 참여 레이어를 하나씩 줄여 최종값 5회를 관측한다.

### 0건 스윕의 전수성 — 판정 기준 엄격화 (§8)

구현자 스윕을 재실행하는 것은 재현이지 검증이 아니므로 **술어를 넓혀 차집합을 본다**.

| 축 | 구현자 술어 | 검증자가 넓힌 술어 | 차집합 |
|---|---|---|---|
| 층수 | `네 레이어\|네 층\|4층\|다섯…\|5층` | 한자어·수사·영문 포함(`네 ?개?의? ?(레이어\|층)`·`[45] ?개? ?(레이어\|층)`·`four[- ]layer`…) | **1건 → 무관 판정.** `docs/ARCHITECTURE.md:17` 의 `5레이어` 는 main 프로세스 DAG 로 **다른 주어**다 |
| 체인 | 좌표 12곳 육안 | 레이어 이름 2개가 `>`·`→` 로 이어진 모든 줄 | **0건** — 알려진 12사이트 밖에 체인 서술이 없다 |

**EP-12 = 12 는 넓힌 술어에서도 전수다.**

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-05·VP-04 | UT→AT | REQUIRED | **PASS** | 5키 경쟁 표 · M1 red 4케이스 | EP-01 2/2 |
| VP-01·VP-02·VP-03 | AT | REQUIRED | **PASS** | key 2종 · 좁힌 injector 의 두 key 차이 · 충돌 키 최종값 | EP-01 2/2 |
| VP-06·VP-07 | AT | REQUIRED | **PASS** | 캡처한 `hostEnv` == `BASE()` · target 4필드 · **M-NEW2 red** | EP-02 2/2 |
| VP-08·VP-24 | UT | REQUIRED | **PASS** | `@ts-expect-error` 5건 · typecheck 3구성 출력 0줄 | EP-03 1/1 |
| VP-09·VP-10 | ST | REQUIRED | **PASS** | `resolved:false` + 값 실림 + fingerprint `undefined` · M2 red | EP-04 3/3 |
| VP-11·VP-12 | UT→AT | REQUIRED | **PASS** | custom-only hoist 동시 관측 · **M-NEW1 red 5케이스** | EP-05 1/1 |
| VP-13 | IT | REGRESSION | **PASS** | 결정표 3케이스 green | EP-05 1/1 |
| VP-14·VP-15 | AT | REQUIRED/REGRESSION | **PASS** | 미등록·빈 반환 두 입력이 같은 참조 | EP-06 1/1 |
| VP-16·VP-17 | UT→AT | REQUIRED | **PASS (계약)** | AC12 두 결과를 직접 관측. **등록 변이는 성립 불가** → D1 | EP-07 1/1 |
| VP-18 | AT | REQUIRED | **PASS** | injector 값만 바꾼 두 fingerprint 상이 | EP-08 1/1 |
| VP-19 | ST | REGRESSION | **PASS** | fingerprint 스위트 green | EP-08 1/1 |
| VP-20 | UT | REGRESSION | **PASS** | `reads === 1` | EP-09 1/1 |
| VP-21 | IT | REQUIRED | **PASS** | 호출부 수 == 인자 수 · M4·**P2·P3** 전건 red | EP-04 3/3 |
| VP-22 | IT | REGRESSION | **PASS** | lint 0 error — `adapters` 가 `app` 을 물지 않는다 | EP-10 1/1 |
| VP-23 | AT | REQUIRED | **PASS** | 가이드 §3-d 본문 ↔ 테스트 본문 바이트 동일 | EP-11 1/1 |
| VP-25 | AT | REGRESSION | **PASS** | secret 격리 케이스 + injector token 케이스 green | EP-05 1/1 |
| VP-26 | IT | REQUIRED | **PASS** | 12좌표 재측정 · 넓힌 술어 차집합 0 · M5a red | EP-12 12/12 |

- root `PAIR_FAIL`: **없음**.
- 종속 `BLOCKED_BY`: 없음.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V 의 REQUIRED 20 · REGRESSION 6 **전건 실행**.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | `어느 key 든 injector 반환값이 최종 env 에 있다` — key 2종 |
| AC2 | ✅ | 대상 밖 key 의 최종 env 가 미등록 조립과 `toEqual` |
| AC3 | ✅ | 충돌 키 최종값이 injector 값 |
| AC4 | ✅ | 5키 경쟁 표 + M1 red |
| AC5 | ✅ | 캡처한 `hostEnv` == `BASE()`, 파생 env 생성 |
| AC6 | ✅ | target 4필드 + env 블록이 남은 원문 blob (M-NEW2 red) |
| AC7 | ✅ | custom-only 턴의 `settings.env === undefined` + 값 hoist |
| AC8 | ✅ | unresolved 경로 `resolved:false` + 값 + fingerprint `undefined` |
| AC9 | ✅ | 미등록 → `env === undefined`, 같은 참조 |
| AC10 | ✅ | `() => ({})` → 같은 두 관측 |
| AC11 | ✅ | injector 값만 바꾼 fingerprint 상이 |
| AC12 | ⚠️ | **결과는 관측되나 인과가 아니다.** hoist 는 flag 가 아니라 `hasCustomEnv` 가 켠다(P1) → D2 |
| AC13 | ✅ | 기본 배포 export `undefined` + 가이드 예제 typecheck |
| AC14 | ✅ | `signal`·`auth`·`secrets` 접근이 컴파일 오류 |
| AC15 | ✅ | injector token 이 `options.settings` 에 없고 원본 blob 불변 |
| AC16 | ✅ | 12좌표 + 넓힌 술어 차집합 0 + doc gate exit 0 |

- **합계 재측정**: `✅ 15 · ⚠️ 1 · ❌ 0 = 총 16`. 분모는 §7 표의 `R-` 행을 직접 세어 **16**.
- 자기보고 `16/16` 과 **1건 불일치** — AC12 를 ⚠️ 로 내린다. `PAIR_FAIL` 은 아니다(동작 기준은 관측됨).
- **합계 사본 대조**: 본문 `16/16` ↔ trailer `Criteria-Met: 16/16` ↔ INDEX `AC **16/16**` — **세 사본 일치**. 검증 재측정치만 `15✅/1⚠️` 로 갈린다.

### pair별 plan §10 강제 지점 분모

| EP | plan 분모 | 코드에서 확인 | 결과 |
|---|---|---|---|
| EP-01 | 2 | spread 1식을 resolved·위임 2경로가 공유 | 2/2 |
| EP-02 | 2 | 호출 `:321-326` · 타입 `:243`·`:262` | 2/2 |
| EP-03 | 1 | typecheck 3구성 출력 0줄 | 1/1 |
| EP-04 | 3 | turn-setup 조립 호출 **2** = injector 인자 **2** · 위임 **1** | 3/3 |
| EP-05·06 | 1·1 | `buildsEnv` `:343` | 2/2 |
| EP-07 | 1 | `explicitHostManaged` `:329-333` — 항은 있으나 관측 불가 | 1/1 |
| EP-08·09 | 1·1 | fingerprint `:358` · baseEnv closure `:315-316` | 2/2 |
| EP-10·11 | 1·1 | lint 0 error · 예제 대입 테스트 | 2/2 |
| EP-12 | 12 | 12좌표 재측정 + 넓힌 술어 차집합 0 | 12/12 |

- 합계 **27/27** — 자기보고와 일치하고 EP 분모 합(2+2+1+3+1+1+1+1+1+1+1+12)도 27이다.
- 표에 없는데 같은 불변식이 필요한 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| `npm run typecheck` | **PASS** | 3구성 출력 **0줄** |
| `npm run lint` | **PASS** | `0 errors, 1 warning` — warning 은 기존 renderer 베이스라인 |
| 대상 vitest 스위트 | **PASS** | **3파일 / 74케이스** |
| 전체 vitest | **환경 한계 분리** | 242파일 2515케이스 중 **237 / 2469 pass**; 5파일 46 red 전부 `Could not locate the bindings file … better_sqlite3.node` |
| `check-doc-inventory.mjs --check` | **PASS** | generated ok · prose ok · links ok |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `SpawnEnvInjector` (배포 구현) | 가이드 §3-d 예제를 테스트에 대입해 `typecheck:test` 통과. 본문 바이트 동일 | 빈 객체=미등록과 동일(AC10) · 던지면 턴 실패(P6) · `resolved:false`(AC8) 3의미 관측 | **PASS** |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 조립 호출부 재측정: turn-setup **2** · injector 인자 **2** · 내부 위임 **1**.
- 내역 합 = 총계: EP 분모 합 27 = 보고 27. pair 26 = REQUIRED 20 + REGRESSION 6.
- 0건 게이트의 정당한 예외 보존: 층수 스윕이 `ARCHITECTURE.md` 의 무관한 `5레이어`를 잡지 **않는다**(구현자 술어 기준). 넓힌 술어에서는 잡히나 주어가 다르다 — 예외 판정 근거를 여기 남긴다.
- 출력/요청 상한: 신규 요청 0 · 신규 출력 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 배선(`turn-setup`, electron 의존) | **소스 스윕으로 잠갔다** — 호출부 수 == 인자 수. M4·P2·P3 전건 red | 없음 |
| 실제 subprocess 에 env 도달 | 조립 → `adaptEnv` 호출부까지 코드 경로 확인 | **폐쇄망 실기 1건** — 배포가 injector 를 채우고 사내 프록시 로그에 요청이 닿는지 |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run src/main/adapters/harness-config.test.ts src/main/app/deployment` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**(exit code 아님): 위 gate 표에 파일 수·케이스 수·error/warning 수로 기록.
- `npm test` 미사용 — DB 동작을 검증할 필요가 없고 ABI 를 뒤집지 않기 위해서다(`app/AGENTS.md`).
- 환경 기인 실패 분리 근거: red 5파일이 `app/AGENTS.md` 의 실측 베이스라인 목록(`infra/db/{queries,migrate}`·`features/extensions/builder`·`features/orchestration/fork`·`app/chat-turn.continuity`)과 **정확히 일치**하고 46건 전부 bindings 서명이다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`(`--fix`) 실행 후 `git status --short` 가 비었다.
- **검증 중 실행한 명령이 남긴 잔여물**: probe 테스트 2파일을 만들었고 **삭제 완료**(`git status` 청결). `app/node_modules` 는 미추적.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 실행·산출 기록 완료 |
| AC ↔ production path | 16행 1:1 대조 완료 |
| 레이어/계약/문서 링크 | boundaries lint · doc gate 통과 |
| **제품 의도 / Open Question** | **사람 결정 — D1** |
| UI/UX 시각 품질 | 해당 없음 — renderer 변경 0 파일 |
| 신규 의존성 / PR merge | 신규 의존성 0. merge 는 사람 |

## 11. Repository operation checks

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: 구현 턴이 `impl`·`IMPL_DONE`·`Claude`(검증)로 갱신했고 실제 상태와 맞았다. 이번 검증이 `verify`·`PASS`·`사람`으로 넘긴다.
- 「다음 주체」 칸이 주체 하나: 예.
- 대상 커밋 좌표 기입: **검증자가 채운다** — `2b40466`·`c513e75`(설계 정정) · `ba7d220`(r1 구현). 세 해시 모두 `git cat-file -t` = `commit`.
- 비고 5줄 이내: 737자로 최근 행(0205 670자 · 0206 1126자) 범위 안이다. 이번 검증 비고도 같은 상한을 지킨다.
- PASS 시 archive 이동: **하지 않는다** — 다음 주체가 사람이라 미완료 작업이다(0203·0204 선례와 같다).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Status: designed|implemented` · `Criteria-Met` · `Verified-By: pending` 전부 root `AGENTS.md` 표 안이다. 설계 커밋 2건에 `Criteria-*`·`Next-Action` 이 없다 — 규약대로다.
- trailer 실제 파싱: `2b40466` **6키** · `c513e75` **6키** · `ba7d220` **8키** 반환. 끊긴 키 0.
- 인용 커밋 해시 실재: 3건 전부 확인.
- `[구현자 기입]` 7필드 전수: **7/7 존재**, 산문으로 접힌 필드 0.
- 이동/삭제한 reference: 없음.
- **`Co-Authored-By` 표기 변경**: 이번 3커밋은 `Co-Authored-By: Claude` 로, 기존 이력(`Claude Opus 5`)과 다르다. trailer 프로토콜이 파싱하는 키가 아니라 메시지 버스에 영향은 없다 → D5(기록).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 정정 1 — EP-12 분모 4→12 | **타당.** 기준을 넓히는 방향이고, 넓힌 술어 재측정에서 12가 전수임을 확인 | 새 기준으로 채점 |
| 정정 2 — VP-16 적대 증거 성립 불가 | **타당.** 증명을 독립 재구성했고 M3·M3b·P1 이 뒷받침 | 원 기준으로도 재채점 후 수용 |
| 정정 2 — VP-26 체인 축 미검출 | **타당.** M5b 로 재현 | D4 로 이관 |
| "AC12 의 강제 지점은 EP-07 이 아니라 EP-05" | **타당하고 중요하다.** P1 이 인과 부재를 독립 확인 | AC12 를 ⚠️ 로 내리고 D2 |
| `Criteria-Met: 16/16` | **증거로 받지 않음.** 재측정은 `15✅/1⚠️` | 본문 합계로 교정 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `explicitHostManaged` 의 `customEnv[FLAG]` 항이 **구조적으로 관측 불가**하다. `hostManaged` 의 소비처는 `buildsEnv` 하나(`rg` 정의 `:338`·사용 `:343`)이고 `customEnv[FLAG]` 정의됨 ⟹ `hasCustomEnv` ⟹ `buildsEnv` 참 | EP-07 / VP-16 | **NON_BLOCKING** — 정정 2 로 해소된 PLAN_GAP. 단 **제품 결정 1건이 열려 있다** | **사람**: 항을 순서 일관성 문서로 둘지, `buildsEnv` 에서 `hasCustomEnv` 를 빼 flag 를 살릴지 |
| D2 | AC12 의 서술("injector 가 host-managed flag 를 최종 판정한다")과 실제 인과가 다르다. flag 와 무관한 키로도 hoist 가 일어난다(P1) | AC12 | **NON_BLOCKING** | D1 결정과 함께 AC12 문구를 인과에 맞게 정정 |
| D3 | **injector 입력의 변형 가능성이 비대칭이다.** `hostEnv` 는 `Readonly<>` 라 대입이 컴파일 오류지만 `target.settings`(`HarnessNativeSettings = Record<string, unknown>`)는 **캐스트도 directive 도 없이 대입이 통과한다**. 그 객체는 `strippedEnvBlockCache`·`adjustedSettingsCache` 의 WeakMap 키이자 `providerSettingsChangedSinceSpawn` 참조 비교 대상이라 오염이 턴을 넘어 남는다 | 비귀속 — 현재 pair·Decision·AC·gate 어디에도 입력 불변성 계약이 없다 | **NON_BLOCKING** | planner: `settings?: Readonly<HarnessNativeSettings>` 로 `hostEnv` 와 수준을 맞춘다(§10 이 "컴파일러가 강제한다"고 적은 근거가 이 필드에서만 성립하지 않는다) |
| D4 | EP-12 **체인 축에 CI 검출기가 없다.** 체인 최상위 줄을 지우면 스윕 0건·doc gate exit 0 (M5b) | AR-04 / VP-26 | **NEXT_HANDOFF** | `check-doc-inventory.mjs` 에 체인 검사를 더할지는 새 게이트라 별도 handoff |
| D5 | 이번 3커밋의 `Co-Authored-By` 표기가 기존 이력과 다르다(`Claude` vs `Claude Opus 5`) | 비귀속 | **NON_BLOCKING** | 기록만 — trailer 프로토콜 파싱 키가 아니다 |

- **BLOCKING 0 · PLAN_GAP 0**(D1 은 구현 전 `c513e75` 로 해소).

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: r1 이라 없음.
- 관련 plan 지침/AC 의 존재 여부: 있었다 — `handoff-plan` READY self-review 가 "수치 실측"을 요구하지만 **그 수치를 만든 술어의 출처**를 묻지 않는다. 초안 EP-12 분모 4 가 여기서 나왔다.
- 등록 적대 증거 12건 중 **4건이 green** 이었다(M3·M3b·M5b·P1). 설계 시점에 예측된 것은 M3 하나이고, 예측하고도 `required` 로 남겼다.
- 사용자 결정 변경 근거: 없음. D-001~D-008 무변경.
- 반복된 검증 환경 한계: better-sqlite3 네이티브 미빌드로 DB 5스위트 상시 red — `app/AGENTS.md` 가 이미 베이스라인으로 문서화.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED 20 · REGRESSION 6 = **26 전건 PASS**. root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.
- PLAN_GAP: **없음** — VP-16 gap 은 구현 전 별도 설계 커밋으로 해소됐고 HEAD 에 남아 있지 않다.
- Product/UX 및 ACTIVE Decision 충족: D-001~D-008 전건 충족. §5 상태표 8행이 production path 로 성립.
- AC 충족: **✅ 15 · ⚠️ 1 · ❌ 0 / 16**. AC12 는 결과가 관측되나 서술한 인과가 성립하지 않는다.
- 현재 변경 운영 gate: typecheck 3구성 0줄 · lint 0 error · 대상 74케이스 · doc gate exit 0. 전체 vitest 의 46 red 는 환경 기인으로 분리.
- NON_BLOCKING / NEXT_HANDOFF: D1·D2·D3·D5 / D4.
- repository operation checks: trailer 3커밋 전건 파싱 · 좌표 3건 실재 · 7필드 전수 · INDEX 정합.
- 남은 사람 확인: **① D1 제품 결정**(flag 항을 살릴지) · **② 폐쇄망 실기**(배포가 injector 를 채워 사내 프록시에 요청이 닿는지).
- 다음 단계: 보드를 `verify/PASS`·다음 주체 **사람**으로 옮긴다. D3 는 값이 싸므로 사용자가 원하면 후속 handoff 로 즉시 처리할 수 있다.
