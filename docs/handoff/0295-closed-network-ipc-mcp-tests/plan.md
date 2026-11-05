# Plan — 0295-closed-network-ipc-mcp-tests

## 메타

| 항목 | 값 |
|---|---|
| slug | `0295-closed-network-ipc-mcp-tests` |
| 작성자 | Claude Code |
| 일자 | 2026-11-05 |
| 매핑 | 브랜치 `claude/closed-network-plugin-ipc-tests-1vhvbh` |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

폐쇄망 포크(배포 모듈에 사내 LLM Auth·플러그인을 채운 빌드)의 CI에서 두 테스트가 **항상** 실패한다. 완료 후에는 배포 모듈이 비었든 채워졌든, `opencode` 실행 파일이 PATH에 있든 없든 두 파일이 green(미설치면 기존 `skipIf`로 skip)이다.

| 테스트 | 증상 | 원인 (이번 턴 실측) |
|---|---|---|
| `app/src/main/app/handlers/engine.ipc.test.ts` | 파일 전체 13/13 red | `auth: {} as never` — 포크의 `createConfigApiAugmenters`가 생성 시점에 `deps.auth.bind(...)`를 부르면 `TypeError: deps.auth.bind is not a function` (F1 변이로 재현 13/13) |
| `app/src/main/app/managed-mcp.cli.integration.test.ts` | `expected [] to have a length of 6` | `read('mcp')` 전에 활성화가 없어 `mcp-control.ts:149`가 `[]` 반환 (opencode 1.18.27 설치로 재현 3/3) |

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 |
|---|---|
| 명시 요구 | "실제 폐쇄망 환경에서 프로덕션으로 출시하는데 여러 플러그인, llm 등 모든 플러그인들을 구성하고 있고 opencode.exe가 설치됐거나 설치돼지 않은 환경에서도 ci 실행이 있을 수 있다. 아것을 고려한 test가 돼야 한다" |
| 명시 요구 | "빈 객체 대신 bind, connectionValue 를 갖춘 최소 가짜로 채워야 한다. 이 테스트의 주제는 ipc 경계 검증이지 인증이 아니니, 메서드는 두되 본문은 실패시켜 조용한 네트워크 접근을 막는 편이 좋다." |
| 명시 요구 | "테스트에 그 단계를 넣는거ㅛ과 별도로 읽기가 스스로 활성ㅎ하하는 편이 맞는지 설계판단도 같이 내려라." |
| 명시 제약 | "둘 다 항상 실패하는 문제라 타임아웃이나 스킵조건, 기대값 6을 건드리는 것으로는 해결되지 않는다." |
| 해석 | 사용자가 적은 `prepared.activated()`는 실제 lease 메서드 `activate` (`adapter.ts:261`, `session-context.ts:526`)를 가리킨다. |
| 해석 (실측으로 정정) | "activate를 먼저 부르면 6건이 바로 잡힌다"는 이 호스트(Linux, opencode 1.18.27)에서 0/3이다 — 첫 `read`는 6건 모두 `pending`. 연결은 백그라운드로 정착하므로(0289 B3) 정착 대기가 함께 필요하다(D-005). |

## 3. Decision Ledger

| ID | 결정 | 근거 / 조건 | 출처 | 상태 |
|---|---|---|---|---|
| D-001 | 비기능 버그픽스 — Claude가 plan→impl→verify를 직접 수행한다. 프로덕션 코드는 바꾸지 않는다 | 두 결함 모두 테스트 조립 결함(D-004로 프로덕션 유지) | 사용자: "버그픽스이다" · root `AGENTS.md` 구현 주체 분담 | ACTIVE |
| D-002 | engine.ipc의 `auth`는 `bind`·`connectionValue`를 가진 최소 가짜다. `bind`는 성공해 **사용 거부 BoundAuth**를 돌려주고, 그 `snapshot`·`request`와 `connectionValue`는 이 테스트 밖이라는 메시지로 실패한다. 타입은 `as never` 없이 `satisfies HarnessConfigApiDeps['auth']` | `bind` 본문까지 실패시키면 포크가 생성 시점에 부르는 `bind`(가이드 §3-c `const corpAuth = deps.auth.bind(...)`)에서 다시 파일 전체가 죽는다 — 고치려는 증상 그 자체 | 사용자: "메서드는 두되 본문은 실패시켜 조용한 네트워크 접근을 막는 편이 좋다" | ACTIVE |
| D-003 | managed-mcp 테스트는 `read('mcp')` 전에 `prepared.activate?.()`를 부른다 | 프로덕션 catalog·warmup 역할이 `composer-catalog-owner.ts:124`에서 같은 단계를 수행한다 | 사용자: "prepared.activated() … 를 먼저 부르면" | ACTIVE |
| D-004 | **설계 판단: `read`는 스스로 활성화하지 않는다.** 수동 read → `[]`는 유지한다 | 0289 D19 ACTIVE "그 전에는 MCP HTTP를 보내지 않는다" · resources 역할(`PreparedMcpResources`)은 수동이어야 한다(0289 A1). read가 활성화하면 화면을 보기만 해도 MCP 연결이 열린다 | 사용자: "설계판단도 같이 내려라" · 0289 plan D19·A1 | ACTIVE |
| D-005 | 활성화 뒤에는 orca MCP가 `pending`이 아닐 때까지 `read('mcp')`를 다시 읽고, 정착한 목록에서 `connected` 6건을 단언한다 | 실측: activate만 넣으면 0/3, 정착 대기를 더하면 3/3 + egress 차단 1/1 green. 기대값 6과 `skipIf`는 그대로다 | 이번 턴 실측 · 사용자 제약 "기대값 6을 건드리는 것으로는…" | ACTIVE |
| D-006 | 기존 타임아웃 값·`skipIf(!executable)`·기대값 6을 바꾸지 않는다 | 항상 실패하는 결함이라 그 조정으로 해결되지 않는다 | 사용자 원문(§2 명시 제약) | ACTIVE |
| D-007 | 완료 조건은 네 환경 조합 — 배포 빈/채움 × opencode 설치/미설치 — 에서 두 파일이 green(미설치 managed-mcp는 skip)인 것이다 | 포크 CI가 두 조건을 모두 가질 수 있다 | 사용자: "opencode.exe가 설치됐거나 설치돼지 않은 환경에서도" | ACTIVE |

### 갱신 메모

- V1 신규. ACTIVE 결정 ↔ AC 대조: D-002→AC1·AC2·AC3, D-003·D-005→AC4, D-004→AC5, D-006→AC4(값 불변), D-007→AC1·AC4·AC6. 반대 의미의 AC 없음.

## 4. 요구 비판적 검토

| 항목 | 판정 | 관측 |
|---|---|---|
| 증상과 원인 | 일치 | engine.ipc: F1 변이(`createConfigApiAugmenters`에 `void deps.auth.bind('fork-corp-llm')`) → 13/13 `TypeError`. managed-mcp: opencode 설치 후 3/3 `expected [] … 6` |
| 이미 충족됐는가 | 아니다 | 이 저장소는 배포가 비어 13 green, opencode 없음이라 skip — 포크 조건에서만 드러난다 |
| 사용자 전제 "6건이 바로 잡힌다" | 이 호스트에서 불성립 | activate만 넣은 3회 모두 `[orca,pending]×6` → 0 connected. 호스트 속도에 따른 경쟁이라 대기 없이는 flaky다 |
| 가려진 세 번째 실패 | 환경 — 범위 밖 | 정착 대기 뒤 `cacheAsOf` 누락은 메일 도구의 `db_failed`(better-sqlite3 Node ABI 미빌드). `npm rebuild better-sqlite3` 후 2/2 green |
| read 자가 활성화 대안 | 기각(D-004) | 0289 D19·A1과 정면 충돌. 기존 잠금 `mcp-connection.test.ts:91`이 "활성화 전 read = `[]` + 요청 0"을 단언한다 |
| `connectionValue`도 실패시킬지 | 실패시킨다(D-002) | 가이드 레시피(`closed-network-extensions.md` 936~950행)는 `connectionValue`·`snapshot`을 `resolve()` 안에서만 부른다. resolve는 매핑 key(포크 corp key)에만 돌고 이 테스트 key(`claude-shared`·`opencode-shared`)에는 돌지 않는다 |

## 5. 동작 / 사용자 흐름

소비자는 CI 운영자다. `vitest run`(또는 `npm test`)에서:

1. 배포 모듈이 생성 시점에 `auth.bind(id)`를 불러도 engine.ipc 13케이스가 IPC 경계 동작만 판정한다.
2. 배포 모듈이나 이후 변경이 테스트 안에서 인증 요청·연결값 조회를 시도하면 **조용히 네트워크로 나가지 않고** 그 이름을 담은 오류로 실패한다.
3. opencode가 있으면 managed-mcp가 6개 orca MCP 연결을 확인하고 턴 3종을 실행한다. 없으면 skip이다.

### 상태와 전이

| 상태 | 결과 |
|---|---|
| orca MCP 일부가 `failed`로 정착 | 대기가 즉시 끝나고 `toHaveLength(6)`이 실패 — 타임아웃으로 위장하지 않는다 |
| 정착하지 않음(계속 `pending`) | `vi.waitFor` 한도에서 실패. 마지막 오류에 `diagnostics`를 싣는다 |

### 파생 UX / 엣지케이스

해당 없음 — 사용자 대면 화면·문구 변경 없음.

## 6. 범위 / 비범위

| 범위 | 비범위 |
|---|---|
| `engine.ipc.test.ts`의 auth 가짜 | 프로덕션 `mcp-control.ts`·`harness-runtime.ts` 변경(D-001·D-004) |
| `managed-mcp.cli.integration.test.ts`의 활성화 + 정착 대기 | 메일 캐시 `db_failed`(ABI 환경, `app/AGENTS.md` 제약 환경 가이드) |
| | 이 샌드박스의 기존 red 22파일(Electron 바이너리 부재 등 — opencode 유무 diff 0, §8) |
| | 배포 모듈 기본값("비어 있다") 고정 테스트 — `app/AGENTS.md`가 금지 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 배포가 생성 시점에 `auth.bind`를 불러도 engine.ipc 13케이스 green | 변이 F1 적용 상태 `vitest run engine.ipc.test.ts` → 13 passed (현행 픽스처는 13 red) | `createRuntimeConfigAugmenters` → `createConfigApiAugmenters` → `deps.auth.bind` |
| R-01 | AT-02 / AC2 | 테스트 안에서 인증 요청·연결값·snapshot 사용은 그 이름을 담은 오류로 실패한다 | 신규 `engine.ipc.test.ts:'refuses every auth use outside the IPC boundary'` — `bind('x')` 결과의 `request`(reject)·`snapshot`(throw), `connectionValue('x')`(throw) 각각 메시지 단언 + 변이 F3·F4 red | 같은 경로의 bound 사용 |
| R-01 | AT-03 / AC3 | auth 가짜의 형상이 `HarnessConfigApiDeps['auth']`와 어긋나면 컴파일이 실패한다 | `gate:npm run typecheck` — 변이 T1(`bind` 제거) → TS 오류 | `HarnessConfigApiDeps` 계약 |
| R-01 | AT-04 / AC4 | opencode가 있으면 managed-mcp가 정착한 6건 `connected`를 확인하고 전체 green. 기대값 6·`skipIf`·기존 타임아웃 값 불변 | PATH에 opencode 1.18.27 → `vitest run managed-mcp.cli.integration.test.ts` 1 passed + 변이 M1·M2 red + `git diff`에서 `toHaveLength(6)`·`skipIf`·`scaleMs(40_000)`·`scaledBudget({ testTimeout: 120_000, …})` 불변 | `prepareComposer` → `lease.activate` → `OpenCodeMcpControl.activate` → `client.mcp.connect`×6 → `read` |
| R-02 | AT-05 / AC5 | 활성화 전 `read`는 HTTP 없이 `[]`이다(D-004 유지) | REGRESSION `mcp-connection.test.ts:'activates directories connects desired MCPs independently and admits submissions within the bound'` green + 변이 M3 red | `mcp-control.ts:149` |
| R-01 | AT-06 / AC6 | opencode가 없으면 managed-mcp는 skip, engine.ipc는 green | PATH에서 opencode 제거 → 두 파일 `1 skipped`·`13 passed` | `resolveOpenCodeExecutable` 실패 → `skipIf` |

### AC 검증 주의사항

- 포크 조건은 이 저장소에 없으므로 F1·F2·F3·F4는 `app/src/main/app/deployment/harness-runtime.ts`에 임시로 심고 되돌리는 변이다. 기본 배포 고정 테스트를 만들지 않는다(`app/AGENTS.md`).
- M2(정착 대기 제거)는 호스트 속도에 따라 green일 수 있다 — 이 턴 측정은 red 3/3. green이면 `pending` 상태 관측 로그와 함께 `동치 아님 — 경쟁`으로 적는다.
- managed-mcp 전체 green은 better-sqlite3 Node ABI가 필요하다(메일 도구 DB). 차단 환경이면 `npm rebuild better-sqlite3` 후 측정한다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 없음.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 | R | §1·§5 — 네 환경 조합에서 두 파일 green | NEW | — |
| AT-01..04, AT-06 | AT | §7 | NEW | — |
| R-02 | R | 수동 read는 연결을 열지 않는다 | INHERITED | 0289 D19 · AC28 |
| AT-05 | AT | §7 AC5 | INHERITED | `mcp-connection.test.ts:91` |
| AR-01 | AR | engine.ipc가 bootstrap과 같은 `createRuntimeConfigAugmenters` 조립에 auth 가짜를 주입 | NEW | — |
| AR-02 | AR | managed-mcp가 프로덕션 활성화 단계를 거친 뒤 정착 상태를 읽는다 | NEW | — |
| MD-01 | MD | auth 가짜: `bind` 성공 · 나머지 사용 실패 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·04·06 | REQUIRED | CI `vitest run` → 두 파일 | AC1·AC4·AC6 명령 출력 | not selected — 하위 pair가 변이를 가진다 | 0 — 하위 pair가 자리를 갖는다 |
| VP-02 | AR-01 ↔ IT-01 | REQUIRED | `engine.ipc beforeEach` → `createRuntimeConfigAugmenters({auth})` → `createConfigApiAugmenters({auth})` → `registerEngineHandlers`/`agentList` | EP-1 → `engine.ipc.test.ts` 기존 13케이스(F1 상태) · `gate:npm run typecheck`(T1) | required — 기본 배포는 `auth`를 쓰지 않아 green이 곧 픽스처 정합을 뜻하지 않는다. F1(bind at 생성)=green · F2(contribution 채움)=green · 현행 `{}` + F1 = red | EP-1 (1자리) |
| VP-03 | MD-01 ↔ UT-01 | REQUIRED | auth 가짜 → `bind` → BoundAuth | EP-2 자리별 → 신규 `'refuses every auth use outside the IPC boundary'` | required — 거부 본문이 no-op으로 약해지는 회귀. F3(생성 시 `bind().request()`)·F4(생성 시 `connectionValue()`) red | EP-2 (4자리) |
| VP-04 | AR-02 ↔ IT-02 | REQUIRED | `prepareComposer` → `activate` → `connect`×6 → `read` 재조회 → 단언 | EP-3 → `managed-mcp.cli.integration.test.ts:'advertises and calls managed MCP through the supported CLI'`(opencode 설치) | required — M1(activate 제거) red · M2(정착 대기 제거, 단일 read) red | EP-3 (2자리) |
| VP-05 | R-02 ↔ AT-05 | REGRESSION | `read` → `mcp-control.ts:149` | `mcp-connection.test.ts:91` | required — M3(`:149`를 `this.activate()`로 바꿔 자가 활성화) red | 0 — 이번 변경은 프로덕션을 건드리지 않는다 |

### 현재 변경의 운영 gate

| Gate | 이유 | 명령 | 실패 범위 |
|---|---|---|---|
| lint · typecheck | `app/**` 테스트 수정 | `cd app && npm run lint && npm run typecheck` | 이번 diff 유발분 |
| 테스트 예산 가드 | `vi.waitFor` 옵션·시간 값 추가 | `cd app && node scripts/check-test-budgets.mjs` | 이번 diff 유발분 |
| 대상 스위트 | VP-02~05 | §19 | 이번 diff 유발분 |
| trailer 파싱 | 커밋 | `git log -1 --format='%(trailers:only=true)'` | 이번 커밋 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 | 검색 / 위치 | N | 의미 |
|---|---|---|---|
| auth 계약 | `contracts/auth.ts:518-559` · `harness-runtime.ts:53-55` | — | `HarnessConfigApiDeps.auth = Pick<AuthRuntime,'bind'\|'connectionValue'>`, `BoundAuth = {authId, snapshot(), request()}`(`auth.ts:486-490`) |
| 실제 `createRuntimeConfigAugmenters` 호출 테스트 | `rg -n "createRuntimeConfigAugmenters\(\{" app/src/main --glob '*.test.ts'` | 1 | `engine.ipc.test.ts:83`. `bootstrap.harness.test.ts:94`·`bootstrap.opencode-warmup.test.ts:122`는 factory 자체를 mock — auth를 넘기지 않음 |
| `auth: {} as never` | `rg -n "auth: \{\} as never" app/src` | 1 | 같은 자리 |
| 레시피의 `bind`/`connectionValue` 호출 시점 | `closed-network-extensions.md:636`(생성 시 `bind`) · `:945`(`resolve` 안 `connectionValue`) | 2 | 생성 시점 호출은 `bind`뿐 |
| `snapshotOf` 도달 | `runtime-catalog.ts:48`(attach) · `:186`(invalidate) | 2 | engine.ipc는 attach를 부르지 않고 `invalidate(key)`는 test key로만 필터 — F2 green 실측 |
| 활성화 호출부(프로덕션) | `rg -n "activate\?\.\(\)\|\.activate\(\)" app/src/main --glob '!*.test.ts'` | `composer-catalog-owner.ts:124` · `session-context.ts:237`(warmup) · `mcp-control.ts:183`(submit) | read 경로에는 없음 — 호출자 책임 |
| 같은 단계를 넣은 기존 테스트 | `bootstrap.native-history.test.ts:998` `oldDirectory.activate?.()` | 1 | 선례 |
| opencode 실행 파일 의존 테스트의 `read('mcp')` | `rg -ln resolveOpenCodeExecutable app/src --glob '*.test.ts'` → 2파일, 그중 `.read('mcp'` | 1 | `managed-mcp.cli.integration.test.ts:289` |

### 전수 조사 — 이 샌드박스 기준선

| 측정 | 결과 |
|---|---|
| `vitest run src/main/app` opencode 없음 | 22 files failed · 8 tests failed (Electron 바이너리 부재·`Composer directory must be absolute` 등 — 변경 전 깨끗한 트리) |
| 같은 명령 opencode 1.18.27 PATH | 23 files failed · 9 tests failed |
| 두 실패 목록 diff | managed-mcp 1건만 추가 — 나머지는 opencode 무관 기준선 |

### 수치 / 전칭 표현 검산

- "파일 전체가 죽는다": F1 상태 `Tests 13 failed (13)`, `TypeError: deps.auth.bind is not a function` 1종.
- "6건": 정착 뒤 `[orca,connected]×6` 3회 동일.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```text
engine.ipc beforeEach
  createRuntimeConfigAugmenters({ auth: {} as never, secrets: {} })
    └ createConfigApiAugmenters({ auth })      기본 배포: void deps → OK
                                               포크: deps.auth.bind(id) → TypeError → 13 red

managed-mcp CLI test
  prepareComposer → lease (activate 미호출)
  lease.read('mcp') → OpenCodeMcpControl.read → !activated → []  → 0 ≠ 6
```

### TO-BE — 변경 후 목표 구조와 동작 경로

```text
engine.ipc beforeEach
  auth = { bind: id → {authId:id, snapshot: 거부, request: 거부}, connectionValue: 거부 }
         satisfies HarnessConfigApiDeps['auth']
  createRuntimeConfigAugmenters({ auth, secrets: {} })   기본·포크 모두 생성 성공
  (테스트 안의 인증 사용은 이름 붙은 오류)

managed-mcp CLI test
  prepareComposer → lease.activate?.()                  (= composer-catalog-owner.ts:124)
  vi.waitFor: lease.read('mcp') 재조회 — orca 항목에 pending 있으면 재시도
  정착 목록에서 connected 6 단언 (값 불변)
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 근거 |
|---|---|---|---|
| auth 주입 | `{}` + `as never` | 형상 맞는 거부 가짜 + `satisfies` | D-002 / AC1~3 |
| MCP 활성화 | 없음 | read 전 `activate?.()` | D-003 / AC4 |
| 첫 read 정착 | 단일 read | pending 소멸까지 재조회 | D-005 / AC4 |
| read 자가 활성화 | 없음 | 없음(유지) | D-004 / AC5 |

### 핵심 책임 분리

활성화는 lease 호출자(catalog·warmup 역할, 전송)의 책임이고 `read`는 관측만 한다 — 테스트도 프로덕션 호출자와 같은 순서를 따른다.

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약 | SSOT | 누가 | 언제 강제 (자리 목록) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-02 | 프로덕션 조립에 넘기는 auth는 계약 형상이다 | `harness-runtime.ts:53` | 테스트 조립 | EP-1: `engine.ipc.test.ts` `createRuntimeConfigAugmenters({ auth, … })` 1자리 | `rg -n "createRuntimeConfigAugmenters\(\{" app/src/main --glob '*.test.ts'` → 1 | 포크 배포가 생성 시점에 쓰는 멤버가 없으면 파일 전체 red |
| MD-01 / VP-03 | auth 사용은 이름 붙은 실패다 | 테스트 파일 내 가짜 | 테스트 | EP-2: `bind`(성공·거부 BoundAuth 반환) · `BoundAuth.snapshot` · `BoundAuth.request` · `connectionValue` — 4자리 | `HarnessConfigApiDeps['auth']`의 멤버 + `BoundAuth` 멤버(`auth.ts:486-490`) → 4 | 약해지면 조용한 네트워크/미인증 진행 |
| AR-02 / VP-04 | 활성화 뒤 정착 상태를 단언 | `composer-catalog-owner.ts:124` | 테스트 | EP-3: (a) read 전 `activate?.()` 1자리 (b) pending 재조회 1자리 | `rg -n "\.read\('mcp'" app/src/main/app/managed-mcp.cli.integration.test.ts` → 1 (그 앞뒤가 두 자리) | (a) 없으면 `[]` (b) 없으면 경쟁으로 0~6 |

규칙 칸 ↔ 입력 칸:

| 자리 | 규칙 분기 | UT 입력 |
|---|---|---|
| EP-2 `bind` | 성공 + `authId` 보존 | `bind('fork-corp-llm').authId === 'fork-corp-llm'` |
| EP-2 `request` | reject | `await expect(bound.request({...})).rejects.toThrow(/auth\.request/)` |
| EP-2 `snapshot` | throw | `expect(() => bound.snapshot()).toThrow(/auth\.snapshot/)` |
| EP-2 `connectionValue` | throw | `expect(() => auth.connectionValue('x')).toThrow(/auth\.connectionValue/)` |
| EP-3 (b) | pending 있음 → 재조회 / 없음 → 반환 | 실제 CLI에서 첫 read가 pending 6(실측) → 재조회 경로 · 정착 뒤 반환 경로 |

- **선언 경계**: (1) 포크 배포가 **생성 시점에** `snapshot`·`request`·`connectionValue`를 부르면 engine.ipc가 이름 붙은 오류로 red다 — 의도된 동작(D-002)이며 가이드 레시피는 그렇게 하지 않는다(§8). (2) 포크가 `HarnessConfigApiDeps['auth']`에 멤버를 늘리면 AC3 typecheck가 먼저 red다. (3) managed-mcp의 메일 도구 `cacheAsOf`는 better-sqlite3 Node ABI에 의존한다 — 차단 환경 red는 환경이다(측정: rebuild 후 green 2/2).
- 열린 입력 집합 판정 산출물: 해당 없음.
- 같은 규칙의 다중 레이어 SSOT: 해당 없음.
- 외부 SDK 경계: 해당 없음 — `@opencode-ai/sdk`는 변경 없음.

## 11. 구현 설계

| 파일 | 변경 |
|---|---|
| `app/src/main/app/handlers/engine.ipc.test.ts` | 모듈 상단에 `const refused = (use: string): Error => new Error(\`engine IPC test: auth.${use} is outside the IPC boundary\`)` 와 `const authStub = { bind: (authId) => ({ authId, snapshot: () => { throw refused('snapshot') }, request: async () => { throw refused('request') } }), connectionValue: () => { throw refused('connectionValue') } } satisfies HarnessConfigApiDeps['auth']` 정의. `beforeEach`의 `{} as never`를 `authStub`으로 교체. 신규 케이스 `'refuses every auth use outside the IPC boundary'`(§10 입력 4개) |
| `app/src/main/app/managed-mcp.cli.integration.test.ts` | `prepareComposer` 직후 `prepared.activate?.()`. 기존 단일 read를 `vi.waitFor(async () => { const items = await lease.read('mcp', AbortSignal.timeout(scaleMs(40_000))); if (orca pending 존재) throw new Error(JSON.stringify(diagnostics)); return items }, { timeout: 40_000, interval: 100 })` 로 감싼다. `vi.waitFor` 옵션에는 `scaleMs`를 쓰지 않는다(setup이 배율 적용 — `app/AGENTS.md` test-time). 기존 `.catch(... diagnostics ...)`는 read 오류 경로로 유지. 정착 후 기존 `toHaveLength(6)` 그대로 |

### 테스트 가능성

- VP-04는 opencode CLI가 필요하다: `npm i opencode-ai@1.18.27`(SDK 버전과 동일, `package.json:39`)을 scratch에 설치해 PATH에 넣는다. 저장소 의존성은 추가하지 않는다.

## 12. End-to-end 영향

### producer → consumer

해당 없음 — 테스트만 바뀐다.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음.

## 13. Lifecycle / 오류 / 정리

- `vi.waitFor` 실패 시 기존 `finally`(turn close·pool close·children kill)가 그대로 돈다 — 대기는 기존 try 블록 안에 둔다.

## 14. 성능 / 상한 / 최적화

- 정착 대기 상한 40s × 배율(기존 read 신호와 같은 기준값). 실측 정착 수 초, 파일 전체 35~36s(기존 `testTimeout: 120_000` 안).

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 가이드 레시피는 바뀌지 않는다. 포크 운영자 관점의 효과는 §10 선언 경계 (1)(2).

## 16. 기존 결정·규칙과의 관계

| 결정·규칙 | 관계 |
|---|---|
| 0289 D19·A1 (수동 read 무HTTP) | 유지 — D-004, VP-05 REGRESSION |
| `app/AGENTS.md` "배포 모듈 기본 내용을 테스트로 고정하지 않는다" | 준수 — 포크 조건은 임시 변이로만 재현 |
| `app/AGENTS.md` test-time: `vi.waitFor` 옵션에 `scaleMs` 금지 | 준수 — §11 |
| `app/AGENTS.md` 전역 `fetch` 금지 | 무관 — 기존 CLI 테스트의 `fetch` 사용은 그대로 |

## 17. 리스크 / 트레이드오프

| 리스크 | 대응 |
|---|---|
| 정착 대기가 느린 호스트의 진짜 연결 실패를 늦게 보고 | `failed`는 pending이 아니므로 즉시 단언으로 떨어진다 |
| 거부 가짜가 미래 포크의 생성 시점 사용을 막음 | 이름 붙은 오류라 원인이 즉시 보인다 — 선언 경계 (1) |

## 18. 영향 받는 파일 / 문서

- `app/src/main/app/handlers/engine.ipc.test.ts`
- `app/src/main/app/managed-mcp.cli.integration.test.ts`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 환경 제약: Electron 바이너리 다운로드 불가 → 22파일 기준선 red(§8). managed-mcp 메일 도구는 `npm rebuild better-sqlite3`(Node ABI) 필요.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck && node scripts/check-test-budgets.mjs`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/app/handlers/engine.ipc.test.ts src/main/app/managed-mcp.cli.integration.test.ts src/main/adapters/opencode/v1/mcp-connection.test.ts` — opencode PATH 있음/없음 두 번.
- 최종 통합 판정: Windows CI(`.github/workflows/ci.yml`) — opencode 미설치 조합.
- 사람 실기: 포크 CI(배포 채움 × opencode 설치) 1회 — 포크 코드가 이 저장소에 없다.

## READY self-review

- Decision Ledger D-001~D-007 ACTIVE, 갱신 메모에 AC 대조 기록.
- Part I만으로 완료 상태(네 환경 조합 green) 설명 가능.
- 사용자 조건절("메서드는 두되 본문은 실패")은 D-002에서 `bind` 반환까지 실패시키지 않는 이유와 함께 보존 — `bind`가 실패하면 원 증상이 재발한다.
- 사용자 전제(즉시 6건)는 실측 0/3으로 정정하고 D-005로 기록.
- 수치(13·6·22/23·N=1/4/2) 이번 턴 재측정.
- 각 AC에 단언·명령·경로. 모든 NEW node에 같은 레벨 REQUIRED pair, INHERITED R-02는 REGRESSION.
- 규칙 칸 ↔ 입력 칸 1:1(§10 표). 선언 경계 3개 측정 근거 기재.
- INDEX 후보 표: 0262(OpenCode 하네스 CLOSED 이관, 승격 조건=사용자 요청) — 이번 범위와 형태 불일치, 승격 안 함.
- 사람 실기는 포크 CI 1회뿐(포크 코드 부재가 이유).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: D-002~D-006, §11 두 파일 변경.
- 이견 / 현실성 문제: §11·AC3의 `satisfies HarnessConfigApiDeps['auth']`는 쓰지 않았다 — `satisfies`는 메서드 시그니처를 리터럴에서 추론해 `bound.request({...})` 호출이 `TS2554: Expected 0 arguments`로 깨졌다. 같은 형상 검사를 하는 타입 주석 `const authStub: HarnessConfigApiDeps['auth']`로 바꿨다(아래 설계 대비 차이).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-02 | 조립에 넘기는 auth 형상 | EP-1 (1) | 1/1 | `rg -n "createRuntimeConfigAugmenters\(\{" app/src/main --glob '*.test.ts'` → 1건(`engine.ipc.test.ts:103`) · F1 상태 기존 13케이스+신규 = 14 passed · F1+구 `{}` = 14 failed(`TypeError: deps.auth.bind is not a function`) · `gate:tsc -p tsconfig.test.json`(T1 red TS2561) | `auth`: 형상 맞는 거부 가짜(구 값 `{}`와 F1에서 구별) → 파일 전체 결과 | — |
| VP-03 | auth 사용 거부 | EP-2 (4): bind · snapshot · request · connectionValue | 4/4 | `engine.ipc.test.ts:'refuses every auth use outside the IPC boundary'` — 자리마다 S4·S1·S2·S3 red | bind: `authId` 'fork-corp-llm' 보존 · snapshot/request/connectionValue: 각 이름 regex 단언(S5 맞바꿈 red) | — |
| VP-04 | 활성화 + 정착 대기 | EP-3 (2): (a) activate (b) pending 재조회 | 2/2 | `rg -n "\.read\('mcp'" app/src/main/app/managed-mcp.cli.integration.test.ts` → 1건 · `managed-mcp.cli.integration.test.ts:'advertises and calls managed MCP through the supported CLI'`(opencode 1.18.27) 1 passed · M1·M2 red | (a) 활성화 호출 유무 → 0 vs 6 · (b) 첫 read pending 6(실측) → 재조회 후 connected 6 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | opencode 없음: 3파일 18 passed·1 skipped · 있음: 19 passed | not selected — 하위 pair |
| VP-02 | REQUIRED | SELF_PASS | `engine.ipc.test.ts` 14케이스 | F1 green · F2 green · F1+`{}` red 14/14 |
| VP-03 | REQUIRED | SELF_PASS | `engine.ipc.test.ts:'refuses every auth use outside the IPC boundary'` | F3 red(Unhandled Rejection 14 · `auth.request is outside the IPC boundary`) · F4 red 14/14 · F5 red 14/14 |
| VP-04 | REQUIRED | SELF_PASS | `managed-mcp.cli.integration.test.ts:'advertises and calls managed MCP through the supported CLI'` | M1 red · M2 red |
| VP-05 | REGRESSION | SELF_PASS | `mcp-connection.test.ts:'activates directories connects desired MCPs independently and admits submissions within the bound'` | M3 red(1 failed · 3 passed) |

## [구현자 기입] 이번 라운드 수정의 잠금

하네스 `mutate.py`(spec 15줄), 끝난 뒤 원복 확인 메시지 "모든 파일 원문 그대로".

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `harness-runtime.ts` `createConfigApiAugmenters` — 생성 시 `bind` 호출(F1) | VP-02 선택 증거 | 최초 | 14 passed(기대 green) | 잠김 — 포크 형상 통과 |
| `harness-runtime.ts` `RUNTIME_MODEL_CONTRIBUTIONS` 채움(F2) | VP-02 선택 증거 | 최초 | 14 passed(기대 green) | 잠김 |
| F1 + `engine.ipc.test.ts` auth를 구 `{}`로 | VP-02 선택 증거(대조) | 최초 | 14 failed | 잠김 — 고친 결함이 재현됨 |
| 생성 시 `bind().request()`(F3) | VP-03 선택 증거 | 최초 | Unhandled Rejection 14 → exit 1 | 잠김 |
| 생성 시 `connectionValue()`(F4) | VP-03 선택 증거 | 최초 | 14 failed | 잠김 |
| 생성 시 `bind().snapshot()`(F5) | VP-03 선택 증거 | 최초 | 14 failed | 잠김 |
| `engine.ipc.test.ts` 가짜에서 `bind` 이름 제거(T1) | sweep — EP-1 형상 / AC3 | 최초 | `tsc -p tsconfig.test.json` TS2561 | 잠김 |
| `snapshot` 본문 → 빈 값(S1) | sweep — EP-2 snapshot | 최초 | 1 failed | 잠김 |
| `request` 본문 → 빈 값(S2) | sweep — EP-2 request | 최초 | 1 failed | 잠김 |
| `connectionValue` → `undefined`(S3) | sweep — EP-2 connectionValue | 최초 | 1 failed | 잠김 |
| `bind`가 `authId` 대신 다른 값(S4) | sweep — EP-2 bind | 최초 | 1 failed | 잠김 |
| `snapshot` 메시지 ↔ `request` 메시지 맞바꿈(S5) | sweep — EP-2 형제 맞바꿈 | 최초 | 1 failed | 잠김 |
| `engine.ipc.test.ts` auth → `{}`(E1, 기본 배포) | sweep — EP-1 제거 | 최초 | 14 passed | 동치 — 기본 배포는 `void deps`로 auth를 읽지 않는다(`harness-runtime.ts` `createConfigApiAugmenters`). 포크 형상은 F1+`{}` 행이 잠근다 |
| `prepared.activate?.()` 제거(M1) | sweep — EP-3 (a) · VP-04 선택 증거 | 최초 | 1 failed | 잠김 |
| pending 재조회 조건 제거(M2) | sweep — EP-3 (b) · VP-04 선택 증거 | 최초 | 1 failed | 잠김 |
| `mcp-control.ts:149` → `this.activate()`(M3) | VP-05 선택 증거 | 최초 | 1 failed | 잠김 |

- **분모 검산**: `선택 증거 9(F1·F2·F1+{}·F3·F4·F5·M1·M2·M3) · 인용 변이 0 · 새 oracle 1(UT-01 — 민감도는 S1~S5 행) · sweep 9(T1·S1~S5·E1·M1·M2) = 표 행 16` — M1·M2는 선택 증거와 sweep에 함께 속해 1행씩만 둔다(9 + 9 − 2 = 16).
- **덮개 회귀**: 해당 없음(첫 라운드).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 테스트 메시지뿐(소비자: CI 로그) | — |
| production 재배치 | 재배치 없음 | — |
| 실패 경로가 Part I 상태 전이표의 어느 행인가 | `failed` 정착 → "일부가 failed" 행 · 미정착 → "정착하지 않음" 행 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 포크의 조용한 인증 사용은 이름 붙은 오류로 보인다(F3~F5) | — |
| 늦은 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 정착 대기 안에서 `read` 자체가 reject하면 즉시 실패하지 않고 대기 한도까지 재시도한다(구 코드는 즉시 실패) | ✅ 선조치 안 함 — 진단은 마지막 오류의 `diagnostics`로 그대로 남고 상한은 기존 read 신호와 같은 기준값 40s | `vi.waitFor` 의미 |
| 2 | 메일 도구 `cacheAsOf`가 better-sqlite3 Node ABI에 기댄다 | ⚠️ 보고만 — §10 선언 경계 (3), 범위 밖 | `npm rebuild better-sqlite3` 전 `db_failed`, 후 green |

### 설계 대비 명시적 차이

- `satisfies HarnessConfigApiDeps['auth']` → 타입 주석 `const authStub: HarnessConfigApiDeps['auth']`. 이유: `satisfies`가 리터럴 메서드를 0-인자로 추론해 신규 UT 호출이 TS2554.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 타입 검사뿐 | — |
| 공유 | 해당 없음 | — |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 주석 타입은 잉여 속성 검사를 유지하고 누락 멤버를 막는다 | AC3 · T1 red(TS2561 `'_bind' does not exist in type 'Pick<AuthRuntime, "bind" \| "connectionValue">'`) |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/app/handlers/engine.ipc.test.ts` · `app/src/main/app/managed-mcp.cli.integration.test.ts` |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `node scripts/check-test-budgets.mjs` · `vitest run` 3파일(opencode 유/무) · egress 차단 managed-mcp · `vitest run src/main/app`(opencode 유) · `mutate.py` 15줄 |
| **관측한 게이트 산출** | typecheck error 0 · lint 0 error / 2 warning(renderer 기존 `react-hooks/incompatible-library`, 이번 diff 밖) · test-budgets "16 real-git suites ok · all budget sites scaled" · 3파일 opencode 없음 18 passed·1 skipped / 있음 19 passed · egress 차단 1 passed · `src/main/app` 22 files failed·8 tests failed — opencode 없는 변경 전 기준선 실패 목록과 diff 0줄(Electron 바이너리 부재 등 환경) |
| V-pair 자기확인 | SELF_PASS 5 / SELF_BLOCKED 0 |
| 강제 지점 전수 | 7/7 (EP-1 1 · EP-2 4 · EP-3 2) |
| **AC 자기보고** | AC1 ✅ F1 14 passed · AC2 ✅ UT + F3~F5 red · AC3 ✅ T1 TS2561 · AC4 ✅ opencode 1 passed, `toHaveLength(6)`·`skipIf`·`scaleMs(40_000)`·`testTimeout: 120_000` diff 불변 · AC5 ✅ mcp-connection green + M3 red · AC6 ✅ opencode 없음 1 skipped·engine.ipc passed |
| **합계 검산** | `✅ 6 · ⚠️ 0 · ❌ 0 = 총 6` |
| 블로커 / 역질문 | 없음. 사람 실기: 포크 CI 1회(§19) |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(첫 라운드).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: plan §11의 `satisfies` 지정이 TS 추론과 맞지 않았다 — 구현 세부로 정정.
- 반복해서 부딪히는 환경 한계: Electron 바이너리 다운로드 불가(22파일 기준선) · better-sqlite3 Node ABI.
- 현재 라운드·impl 턴: `r1`.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
