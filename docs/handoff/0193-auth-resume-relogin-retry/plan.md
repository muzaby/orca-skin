# Plan — 0193-auth-resume-relogin-retry

## 메타

| 항목 | 값 |
|---|---|
| slug | `0193-auth-resume-relogin-retry` |
| 작성자 | Claude Code |
| 일자 | 2026-08-20 |
| 매핑 | — |
| 상태 | READY → IMPL_DONE (r1) → verify FAIL (r1) → IMPL_DONE (r2) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: gate 가 열린 뒤 나머지 Auth 의 복원 probe 가 실패하면 그 연결은 강등된 채 남고, 회복 경로가 **사용자의 수동 재연결 하나뿐**이다.
- 완료 후 달라지는 것: 그 실패가 **자동 재로그인 시도**로 이어진다. 성공하면 사용자가 아무것도 하지 않아도 연결과 Plugin 도구가 되살아난다.
- 성공을 사용자 관점에서 한 문장으로: gate 로그인을 마치면 사내 서비스 연결이 저절로 따라 붙는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "gate 로그인 후 인증 선언에서 probe 시도 중 실패 시 재로그인 시도하도록 수정. 최대 3회까지. 로그인 시도는 methods에서 첫번째로." | 라이브 세션 2026-08-20 |
| 명시 결정 | 대상 지점·횟수 의미·중단 조건·동시성·입력형 처리 4문항 응답 | 라이브 세션 2026-08-20 (§3 D-001·D-002·D-004·D-005·D-006) |
| 추론 의도 | 없음 — 네 갈래 모두 사용자에게 물어 닫았다 | — |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 대상은 **gate 통과 후 나머지(비-gate) Auth 의 복원 probe** 하나다 | gate 자신의 복원 probe 도, 로그인 흐름 내부 probe 도 아니다 | 사용자 선택 | ACTIVE | — |
| D-002 | 재로그인 시도는 Auth 당 **최대 3회** | 로그인이 내부에 probe 를 포함하므로 총 probe 는 최대 4회 | 사용자 선택 | ACTIVE | — |
| D-003 | 로그인은 `methods` 의 **첫 번째** 방식으로 한다 | 사용자 원문 "로그인 시도는 methods에서 첫번째로" | 사용자 원문 | ACTIVE | — |
| D-004 | `probe_failed` 가 아닌 결과는 남은 횟수와 무관하게 **즉시 중단** | 사용자가 창을 닫았는데 창을 다시 열지 않는다 | 사용자 선택 | ACTIVE | — |
| D-005 | probe 는 **병렬** 유지, 재로그인은 **순차** | 로그인 창이 동시에 여러 개 뜨지 않게 | 사용자 선택 | ACTIVE | — |
| D-006 | `methods[0]` 가 입력형(`api-key`·`password`·`pat`)이면 **시도하지 않는다** | 입력 없는 `begin` 은 네트워크를 타지 않고 전역 `input-required` step 만 만든다 | 사용자 선택 | ACTIVE | — |
| D-007 | 기존 결정 "복원된 grant 는 통과 근거가 아니다 / 별도 검증 경로를 만들지 마라"(2026-08-11)를 **유지**한다 | 재로그인은 별도 검증 경로가 아니라 **평소 로그인과 같은 경로**(`login.begin`)를 다시 부르는 것이다 | `features/gate/index.ts:43-51` | ACTIVE | — |

### 갱신 메모

- 이번 턴 신규: D-001 ~ D-007. 이전 handoff 에서 승계한 ACTIVE 결정 변경 없음.
- 변경된 결정: 없음.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. `D-002`("최대 3회") ↔ `AC2`("4번째 호출이 없다") 일치 · `D-004`("즉시 중단") ↔ `AC4` 일치 · `D-005`("재로그인 순차") ↔ `AC6` 일치 · `D-006`("시도하지 않는다") ↔ `AC5`("`login` 을 한 번도 부르지 않는다") 일치 · `D-001`("나머지 Auth 만") ↔ `AC7`·`AC8`(gate 경로·재시도 0건 경로 불변) 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | probe 실패는 `markExpired` 로 끝나고(`features/auth/login.ts:329`) 요청 정책이 막아 스스로 회복하지 못한다 — 회복은 재인증뿐이라고 `app/auth-resume.ts:9-11` 이 이미 적어 두었다 |
| 이미 기존 코드가 충족하는가 | 아니오 | `resumeRemainingOnce`(`app/auth-resume.ts:59-74`)는 `Promise.all` 뒤 `pushConnectionState()` 로 끝난다. 재시도 코드 0줄 |
| 더 작은 해법이 있는가 | 없다 | probe 만 다시 부르는 것으로는 회복되지 않는다 — 쿠키가 죽은 것이므로 새 로그인이 필요하다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | `docs/arch/backend/auth.md §5.2` 의 `1 + K` 서술이 `app/auth-resume.test.ts:213-247` 의 단언과 일치함을 확인 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 없음 | D-007 참조 |

- 사용자에게 올릴 결정: 없음 (5문항 모두 이번 세션에서 닫았다).
- 코드 조사로 닫은 사실: 입력형이 `input-required` 를 즉시 내는 것(`login.ts:568-576`) · step 이 전역 단일 값인 것(`app/connection-views.ts:95`) · `probe_failed` 가 OAuth·브라우저 세션에서만 나오는 것(`shared/ipc.ts:1304-1306`) · `login.begin(id, undefined)` 이 `methods[0]` 인 것(`login.ts:371-374`).

## 5. 동작 / 사용자 흐름

```text
gate 로그인 완료(또는 부팅 복원으로 gate 가 이미 열림)
  → 나머지 Auth 를 병렬 probe
    → 성공: 연결 유지, 도구 그대로            (기존과 동일)
    ↘ 실패로 expired 강등
        → 자동 완주 가능한 방식이면 재로그인을 순차로 최대 3회
            → done: 연결·도구 복구, 사용자 조작 0
            ↘ 취소/창 닫기/미지원/code-required: 즉시 중단 — 강등 상태로 남는다
            ↘ 3회 모두 probe 실패: 강등 상태로 남는다 (기존과 동일한 결말)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 복원 probe 실패 → `expired`, `methods[0]`=`browser-session` | 재로그인 시도 (창이 열린다) | SSO 가 살아 있으면 창이 깜빡이고 닫힌 뒤 연결이 되살아난다 |
| 복원 probe 실패 → `expired`, `methods[0]`=입력형 | 아무 시도도 하지 않는다 | 지금과 같다 — 설정 화면에서 수동 재연결 |
| 재로그인 중 사용자가 창을 닫음 (`cancelled`) | 그 Auth 의 재시도를 그 자리에서 중단 | 창이 다시 뜨지 않는다 |
| 재로그인 직전 사용자가 [연결 해제] (`none`) | 시도하지 않는다 | 끊은 연결이 되살아나지 않는다 |
| 재로그인 직전 사용자가 로그인을 시작 (`valid`) | 시도하지 않는다 | 사용자의 로그인이 새 attempt 로 덮이지 않는다 |

### 파생 UX / 엣지케이스

- retry: Auth 당 최대 3회, Auth 사이는 순차. 창이 동시에 두 개 뜨지 않는다.
- concurrency: probe 는 지금처럼 병렬이라 타임아웃이 Auth 수만큼 직렬로 쌓이지 않는다.
- 외부환경/폐쇄망: 망에 못 나가면 재로그인도 실패한다 — 3회 소진 후 지금과 같은 강등 상태로 끝난다.
- 부팅 지연: `bootstrap.ts:403` 이 `void authResume.run()` 이라 재시도가 부팅을 막지 않는다.

## 6. 범위 / 비범위

- **범위**: `app/src/main/app/auth-resume.ts` 의 나머지-Auth 복원 경로에 재로그인 재시도를 넣는다. 진단 로그 배선. `docs/arch/backend/auth.md §5.2` 갱신.
- **비범위**: gate Auth 자신의 복원 probe(D-001) · 로그인 흐름 내부 probe 실패(D-001) · 입력형 자동 재로그인(D-006) · `AuthRuntime`/`LoginService`/`AuthDefinition` 계약 변경 · 백오프/지수 대기 · 로그인 창 `show:false` 화.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 재시도 간 백오프 | 아니오 — 내부 상수 하나 | 필요해지면 후속 |
| 로그인 창 타임아웃 단축(현재 5분) | 아니오 — `infra/browser-session.ts` 상수 | 후속 (§14 참조) |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | 나머지 Auth 의 복원 probe 가 실패해 `expired` 로 강등되면 자동 로그인을 시도한다 | 단위 — fake `AuthRuntime.login` 이 그 authId 로 호출된다 | `bootstrap.ts:394` → `resumeRemainingOnce` → `auth.login` |
| AC2 | 재로그인은 Auth 당 최대 3회다. 3회 모두 `probe_failed` 면 **4번째 호출이 없다** | 단위 — `login` 호출 횟수 = 3 | 같음 |
| AC3 | 로그인이 `done` 을 돌려주면 그 자리에서 멈추고 그 Auth 는 `verified` 가 된다 | 단위 — 호출 1회 + `snapshot().verified === true` | 같음 |
| AC4 | `probe_failed` 가 아닌 결과(`cancelled`·`unsupported`·`code-required`·`input-required`)는 즉시 중단한다 | 단위 — 각 결과마다 `login` 호출 1회 | 같음 |
| AC5 | `methods[0]` 가 입력형이거나 `methods` 가 비면 `login` 을 **한 번도** 부르지 않는다 | 단위 — 호출 0회 (`api-key`·`password`·`pat`·빈 배열 4케이스) | 같음 |
| AC6 | probe 는 병렬을 유지하고 재로그인은 순차다 — 두 Auth 가 함께 실패해도 첫 로그인이 끝난 뒤 두 번째가 시작된다 | 단위 — 진입/이탈 순서 로그가 `enter:a,enter:b,exit:a,exit:b,login:a…,login:b…` | 같음 |
| AC7 | 재로그인 직전 상태가 `expired` 가 아니면 시도하지 않는다 — `none`(해제)·`valid`(사용자 로그인 진행 중) | 단위 — 시도 사이에 상태를 바꾸고 이후 `login` 호출 0회 | 같음 |
| AC8 | 재시도가 0건인 부팅의 방송 횟수는 `1 + K` 로 불변이다 | 단위 — `app/auth-resume.test.ts:213-247` 두 케이스가 수정 없이 통과 | 같음 |
| AC9 | gate Auth 의 복원 probe 가 실패해도 재로그인을 시도하지 않는다 (D-001) | 단위 — gate 만 실패시키고 `login` 호출 0회 | `resumeRemainingOnce` 밖 |
| AC10 | 시도 시작과 결과가 주입된 `logger` 로 나간다 (authId·attempt·결과) | 단위 — logger 호출 인자 | `bootstrap.ts` 가 `getLogger().child('auth')` 를 주입 |
| AC11 | `docs/arch/backend/auth.md §5.2` 가 재로그인 단계와 방송 상한 변화를 서술한다 | 문서 대조 — §5.2 본문에 재시도 단계·`1 + K` 조건이 있다 | 문서 |

### AC 검증 주의사항

- 기존 테스트 재사용: `app/auth-resume.test.ts` 의 `방송 상한 1 + K` describe 2케이스(`:214`·`:231`)가 실재함을 확인했다. `definition()` 헬퍼가 `methods: []`(`:23`)라 D-006 게이트에서 전부 걸러져 **기존 9케이스는 수정 없이 통과해야 한다** — 이것이 AC8 의 관측 지점이다.
- 사람 실기 항목: 없다. `auth-resume.ts` 는 electron 을 물지 않아 순서·횟수·중단이 전부 순수 단위 대상이다.
- N회 기준의 관측 지점: **fake `AuthRuntime.login` 의 호출 횟수**다. 호출 지점 grep 이 아니다.
- 순서 기준의 관측 지점: fake 가 `enter:`/`exit:`/`login:` 을 한 배열에 적는다 — 기존 fake 의 관측 방식(`:83`·`:108`)을 그대로 잇는다.
- 부정형 AC(`AC5`·`AC7`·`AC9`)는 "호출 0회" 만으로 목적을 표현하지 않는다 — 각각 짝이 되는 정상 동작 AC(AC1·AC3)가 같은 파일에 있다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 나머지 Auth 의 probe 는 `Promise.all` 뒤 `pushConnectionState()` 로 끝난다 — 재시도 0줄 | `app/src/main/app/auth-resume.ts:59-74` |
| probe 실패는 `markExpired` 를 지나 `expiresAt=now` → `settleExpired` 로 `expired` 가 된다 | `features/auth/login.ts:329` · `features/auth/store.ts:378-396` |
| `login.begin(id, undefined)` 은 `definition.methods[0]` 를 고른다 | `features/auth/login.ts:371-374` |
| 입력형은 입력 없이 부르면 네트워크를 타지 않고 `input-required` 를 emit 한다 | `features/auth/login.ts:568-576` |
| `AuthStep` 은 전역 단일 값으로 renderer 에 실린다 | `features/auth/login.ts:157` · `app/connection-views.ts:95` |
| `probe_failed` 는 OAuth·브라우저 세션에서만 나온다 (입력형은 `input-required` 로 되돌아간다) | `shared/ipc.ts:1304-1306` · `features/auth/login.ts:779` |
| 로그인 창은 실제로 보이는 창이다 (`show:false` 아님) · 기본 타임아웃 300,000ms | `infra/browser-session.ts:182-192` · `:36` · `:196` |
| 부팅은 재시도를 기다리지 않는다 | `app/bootstrap.ts:403` `void authResume.run()` |
| `resumeRemainingOnce` 의 1회성은 `remainingResume ??=` 가 보장한다 | `app/auth-resume.ts:76` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `createAuthResume` 호출부 | `rg "createAuthResume" src --glob '!*.test.ts'` | 1 | `bootstrap.ts:394` — deps 추가 시 고칠 곳이 한 곳 |
| `AuthRuntime.resume` 호출부 | `rg "\.resume\(" src/main --glob '!*.test.ts'` | 2 | `auth-resume.ts:70`(나머지) · `:81`(gate). 변경 대상은 전자 하나 |
| `AuthRuntime.login` 호출부 | `rg "\.login\(" src/main --glob '!*.test.ts'` | 2 | `handlers/providers.ts:53`(IPC) · `login.ts:648`(SessionAuthenticator, 다른 메서드). 이번에 3번째가 생긴다 |
| `AuthMethod` union 멤버 | `rg "kind: '(api-key\|password\|pat\|oauth\|browser-session)'" contracts/auth.ts` | 5 | 방식 게이트가 5종 전수를 다뤄야 한다 — 시도 2종(`oauth`·`browser-session`) / 비시도 3종(입력형) |
| `ProviderStepInfo` 멤버 | `shared/ipc.ts:1280-1294` | 5 | 루프 종료 판정이 5종 전수를 다뤄야 한다 — 계속 1종(`failed`+`probe_failed`) / 성공 1종(`done`) / 중단 3종(`input-required`·`code-required`·`resuming`) + `failed` 의 나머지 7 사유 |
| `ProviderFailureReason` 멤버 | `shared/ipc.ts:1296-1306` | 8 | `probe_failed` 하나만 재시도 대상 |

### 수치 / 전칭 표현 검산

- 재측정 수치: `AuthMethod` 5 · `ProviderStepInfo` 5 · `ProviderFailureReason` 8 · 기존 `auth-resume.test.ts` describe 4개 / 케이스 9개(순서 5 · 방송 2 · 늦은 gate 2 · `gateOpen` 3 → 순서 5 + 방송 2 + 늦은 gate 2 + gateOpen 3 = **12케이스**).
- 내역 합 = 총계: 12 = 5+2+2+3. ✅
- "유일한/항상" 반례 검색: "probe 실패 → 항상 `expired`" 는 `markExpired`(`store.ts:378`)가 `settleExpired` 를 무조건 호출하므로 참. 단 **grant 가 없으면** `markExpired` 가 강등할 것이 없다 — 그 경우는 후보 필터(`auth-resume.ts:65` `status === 'valid'`)에서 이미 제외된다.
- 문서 앵커 확인: `docs/arch/backend/auth.md` 의 `### 5.2 부팅 복원 순서` 가 실재한다(같은 파일 내 `1 + K` 서술 포함).
- 기존 테스트 케이스 존재 확인: `describe('createAuthResume — 방송 상한 1 + K (0187 D2 승계)')` 의 2케이스가 실재한다(`:213`·`:214`·`:231`).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 현재 책임 소유자: `app/auth-resume.ts` 가 "gate 먼저 · 나머지 병렬 · 방송 합치기" 를 갖는다. 인증 lifecycle 은 `features/auth` 가 갖는다.
- entry → flow → consumer: `bootstrap.run()` → `authResume.run()` / `onGateChange` → `resumeRemainingOnce` → `auth.resume(id)` ×N 병렬 → `LoginService.resume` → `probeOk` → 실패 시 `store.markExpired` → `onSnapshot('expired')` → bootstrap 구독자 → `pushConnectionState` + Plugin 도구 회수.
- 오류/정리 경로: 실패는 강등으로 끝난다. 재시도 경로가 없다.
- 직접 원인: 강등 후 요청 정책이 요청을 막아 **스스로 회복할 수 없다**(회복은 재인증뿐).

```text
bootstrap → authResume.run() → resumeRemainingOnce
  → Promise.all(auth.resume ×N)
  → pushConnectionState()            ← 끝. 실패한 것은 expired 로 남는다
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 책임 소유자: **그대로** `app/auth-resume.ts` 다. "복원 실패를 어떻게 회복하는가" 는 gate 순서와 같은 층의 제품 정책이고, `LoginService` 는 여전히 "Auth 하나를 확인/로그인한다" 만 안다.
- entry → flow → consumer: 위와 같되, `Promise.all` + `pushConnectionState()` **뒤에** 강등된 Auth 만 모아 순차 재로그인 루프를 돈다. 로그인은 기존 `AuthRuntime.login` 을 그대로 부른다.
- 오류/취소 경로: `probe_failed` 만 다음 시도로 잇고 나머지는 중단. 상태가 `expired` 가 아니게 되면 그 자리에서 그만둔다.
- 유지하는 메커니즘: 후보 필터 · `Promise.all` 병렬 · `emitVerifiedChange:false` 배치 · `remainingResume ??=` 1회성 · attempt fence(`LoginService` 가 소유).
- 신설: 재시도 루프 + 방식 게이트 + 진단 로그. **제거하는 메커니즘 없음.**

```text
bootstrap → authResume.run() → resumeRemainingOnce
  → Promise.all(auth.resume ×N)
  → pushConnectionState()                       ← 불변 (1 + K)
  → for (강등된 Auth) 순차:                      ← 신설
       방식 게이트 → 최대 3회 auth.login(id)
  → 시도가 1건이라도 있었으면 pushConnectionState() 1회 추가
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `auth-resume.ts` = 순서·병렬·방송 | + 복원 실패의 회복 정책 | 회복 정책도 제품 정책이라 인증 코어로 내리지 않는다 | `auth-resume.ts` · AC1 |
| control flow | probe 후 종료 | probe 후 순차 재로그인 루프 | D-001·D-005 | `auth-resume.ts` · AC2·AC6 |
| state/contract | `ResumeAuthDeps` 4필드 | + `logger?` (선택) | 폐쇄망 진단 | `auth-resume.ts` · `bootstrap.ts` · AC10 |
| error/lifecycle | 실패 = 강등으로 종료 | `probe_failed` 만 재시도, 그 외 중단 | D-004 | AC4 |
| 방송 | `1 + K` | 재시도 0건이면 `1 + K` 불변, 있으면 `+1` + 로그인이 만든 change | 회복을 소비자에게 알려야 한다 | AC8 · `auth.md §5.2` · AC11 |
| test seam/관측점 | `enter:`/`exit:` 로그 + `broadcast` 호출 수 | + `login:` 로그 + `login` 호출 수 | 순서·횟수를 사람 실기로 미루지 않는다 | `auth-resume.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/auth-resume.ts` | 복원 순서 · 병렬성 · 방송 합치기 · **회복 재시도 정책** | `ResumeAuthDeps` → `AuthResumeHandle` | `app/bootstrap.ts:394` (유일) |
| `features/auth/login.ts` | Auth 하나의 확인·로그인 | `authId`(+method) → `AuthStep` | `runtime.ts` 를 통해 |
| `app/bootstrap.ts` | deps 주입 · 구독 · 방송 | — | — |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| 재시도 상한 3 | `auth-resume.ts` 의 모듈 상수 1개 | 재시도 루프 | 루프 조건 | 4회 이상 시도하면 창이 한 번 더 뜬다 |
| 시도 가능 방식 = `oauth`·`browser-session` | `auth-resume.ts` 의 방식 판정 1곳 | 루프 진입 전 | Auth 마다 1회 | 입력형이면 낯선 입력 폼이 전역 방송된다 |
| 재시도 전제 = 직전 snapshot 이 `expired` | `auth-resume.ts` | **매 시도 직전** | 시도마다 | 해제한 연결이 되살아나거나 사용자의 로그인이 덮인다 |
| 계속 조건 = `failed` + `probe_failed` | `auth-resume.ts` | 매 시도 결과 | 시도마다 | 취소했는데 창이 다시 뜬다 |
| `methods[0]` 선택 | `features/auth/login.ts:371-374` (기존) | `LoginService.run` | 로그인마다 | 두 곳이 각자 방식을 고르면 게이트와 실제 실행이 갈린다 |

- 같은 규칙이 여러 레이어에 있는가: **방식 선택만 두 곳에서 읽는다** — 게이트는 `definition.methods[0].kind` 를 보고, 실행은 `login.begin(id, undefined)` 가 같은 `methods[0]` 를 고른다. **kind 를 인자로 넘기지 않는다** — 넘기면 `find(kind)` 라는 두 번째 선택 규칙이 생긴다. 이 사실을 코드 주석에 남긴다.
- 선택적 필드 의미: `ResumeAuthDeps.logger` 미주입 = 로그 없음(동작 동일). `undefined` 가 fail-open 을 만들지 않는다 — 로그는 진단 전용이다.
- 외부 SDK 경계: 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/app/auth-resume.ts` | 복원 순서 + 회복 재시도 | `resumeRemainingOnce` 뒤에 순차 재로그인 루프 · 방식 게이트 · `logger?` deps | 순수 단위 (electron 미의존) |
| `app/src/main/app/auth-resume.test.ts` | 검증 | fake `AuthRuntime.login` 구현 + 신규 케이스(AC1~AC10) | 순수 단위 |
| `app/src/main/app/bootstrap.ts` | 배선 | `createAuthResume({... logger})` 1필드 | 기존 배선 테스트 |
| `docs/arch/backend/auth.md` | 현재 상태 서술 | §5.2 에 재시도 단계·방송 상한 조건 | 문서 대조 |

설계 스케치(형태만 — 구현자가 파일 관례에 맞춘다):

```ts
const MAX_RELOGIN_ATTEMPTS = 3
// 사용자 입력 없이 완주할 수 있는 방식만 자동으로 다시 시도한다. 입력형은 입력 없이 begin 하면
// 네트워크를 타지 않고 전역 input-required step 만 남긴다(login.ts).
const AUTO_RELOGIN_KINDS = new Set<AuthMethodKind>(['browser-session', 'oauth'])
```

- 후보 수집: 병렬 probe 가 끝난 뒤 `candidates` 를 다시 훑어 `tryBind(id)?.snapshot().status === 'expired'` 인 것만 모은다.
- 순차 루프: `for … of` + `await` (D-005). `Promise.all` 을 쓰지 않는다.
- 시도 루프: 매 시도 직전에 snapshot 을 다시 읽어 `expired` 를 재확인한다.
- 종료 판정: `step.kind === 'done'` → return · `step.kind === 'failed' && step.reason === 'probe_failed'` → continue · 그 외 → return.
- 마지막 push: 시도가 1건이라도 있었으면 `pushConnectionState()` 를 한 번 더 부른다.

### 테스트 가능성

- electron/DB 의존부 분리: **불필요** — `auth-resume.ts` 는 이미 순수 모듈이고 이 작업은 그 성질을 유지한다(파일 헤더 `:22-23` 이 요구하는 성질).
- 기존 메커니즘 재사용 적합성: fake `AuthRuntime`(`auth-resume.test.ts:36-117`)의 `login` 은 현재 `Promise.reject('not used')` 다 — 이것을 상태 기반 구현으로 바꾸되 **기존 케이스가 `login` 을 부르지 않는다는 사실은 유지**된다(`definition()` 이 `methods: []`).
- 순서 관측: 기존 `log` 배열에 `login:<id>:<attempt>` 를 같은 방식으로 적는다.

## 12. End-to-end 영향

### producer → consumer

```text
LoginService(로그인 성공) → store.put(verified=true, revision+1)
  → emitSnapshot('credential-committed', credentialChanged:true)
  → bootstrap 구독자 → pushConnectionState + plugin.sync() + harnessRuntime.invalidateForAuth
```

- producer 기준: 재로그인의 성공은 **기존 수동 로그인과 완전히 같은 이벤트**를 낸다 — 소비자가 새 분기를 배우지 않는다.
- consumer 파생 규칙: 변경 없음.
- 파생 합성값이 정본을 우회하는가: 아니다 — 재시도 판정이 읽는 `status`/`verified` 는 `AuthStore` 가 정본이다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:367` 구독자(plugin sync · harness invalidate) | 재로그인 성공 1건당 `credential-committed` 1회 추가 — 도구 재sync 가 **의도된 결과**다 | AC3 |
| `app/connection-views.ts:95` (전역 step) | 자동 완주 방식만 시도하므로 낯선 입력 폼이 생기지 않는다 | AC5 |
| `features/gate/index.ts` gate 판정 | 대상이 비-gate Auth 라 gate 상태는 바뀌지 않는다 | AC9 |
| `docs/arch/backend/auth.md §5.2` | 방송 상한 서술이 조건부가 된다 | AC11 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `resumeRemainingOnce` 안. `remainingResume ??=` 가 재시도까지 **1회성**으로 묶는다 — `onGateChange` 가 여러 번 와도 재시도가 다시 돌지 않는다.
- 취소/중단: `probe_failed` 외 전부 중단(D-004). 상태가 `expired` 가 아니게 되면 중단.
- 종료/quit: 재시도 중 앱이 종료되면 남은 시도는 그대로 사라진다 — 다음 부팅이 같은 경로를 처음부터 돈다. 중간 상태가 디스크에 남지 않는다(재시도 카운터는 메모리 지역 변수).
- retry/timeout: 로그인 창 타임아웃은 `SessionRunner` → `cancelled` 로 접히므로 재시도가 중단된다(D-004).
- **다중 저장소 쓰기**: 이 작업이 새로 만드는 쓰기는 없다 — 로그인의 vault/grant 2단 쓰기는 `settleGrant`(`login.ts:458-512`)가 이미 "새 키에 쓰고 grant 저장이 곧 커밋" 으로 닫아 두었고 여기서 바꾸지 않는다. **문서 사본**: 이 handoff 의 판정은 `plan.md`(본문)와 `docs/handoff/INDEX.md` 두 곳에 산다 — 상태·다음 주체를 **두 곳 모두** 같은 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수의 `원천 상한 × 배치 상한`: 나머지 Auth **N** × 재시도 **3** = 최대 `3N` 로그인 시도, 각 로그인은 내부 probe 1회 → probe 총 상한 `N × 4`.
- 시간 상한 (r2 정정 — 구 서술 `3 × 5분`): **창 타임아웃은 3회 연속 날 수 없다** — `SessionRunner` 가 그것을 `cancelled` 로 접어(`runner.ts:54-61`) D-004 로 그 자리에서 중단하므로 타임아웃은 그 Auth 의 **마지막** 시도다. 그래서 Auth 1건당 최악은 `정상 종료 2회 + 타임아웃 1회(5분) + probe 15초 ×3`(`login.ts:64`)이고, 정상 종료 시도의 소요는 상수가 아니라 사용자 조작 시간이다. 사용자 개입 없이 완주하는 SSO 라면 `3 × (리다이렉트 왕복 + 15초)` 수준이다. **부팅은 막히지 않는다**(`bootstrap.ts:403` `void`) — 지연되는 것은 §11 의 마지막 추가 push 뿐이고, 성공한 probe 들의 상태는 재시도 **전** push(`1 + K`)로 이미 화면에 도달해 있다.
- 캐시/호출 축소로 잃는 부수 효과: 없음 — 이 작업은 호출을 늘리는 쪽이다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 배포가 구현할 port/schema 를 만들지 않는다. `AuthDefinition` 은 그대로다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "복원된 grant 는 통과 근거가 아니다 · 별도 검증 경로를 만들지 마라"(2026-08-11) | `features/gate/index.ts:43-51` | §3 D-007 | **유지** — 재로그인은 평소 로그인과 같은 경로다 |
| "게이트가 먼저" 순서 규칙 | `app/auth-resume.ts:8-14` | §9 TO-BE | 유지 — 재시도는 gate 통과 후에만 돈다 |
| 방송 상한 `1 + K` (0187 D2) | `app/auth-resume.ts:16-20` · `auth.md §5.2` | §9 Delta 방송 행 · AC8 | **조건부로 변경** — 재시도 0건이면 불변, 있으면 회복 이벤트만큼 늘어난다 |
| "인증 코어는 제품 정책을 모른다"(0188) | `app/auth-resume.ts:3-6` | §9 TO-BE 책임 소유자 | 유지 — 재시도 정책을 `LoginService` 로 내리지 않는다 |
| main 레이어 DAG (app → 전부) | `app/src/main/AGENTS.md` | §11 변경 파일 | 유지 — app 레이어 안에서 끝난다 |
| `auth-resume.ts` 는 electron 을 물지 않는다 | `app/auth-resume.ts:22-23` | §11 테스트 가능성 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| SSO 가 죽어 있으면 사용자가 요청하지 않은 로그인 창이 뜬다 | D-004(취소 즉시 중단) + D-005(순차, 창 1개) + D-006(입력형 제외). 사용자가 이 트레이드오프를 알고 선택했다 |
| 최악 `N × 15분` 동안 재시도 루프가 산다 | 부팅을 막지 않고, 성공 상태는 재시도 전 push 로 이미 나갔다(§14) |
| 시도 직전 사용자 조작과의 경쟁 | 매 시도 직전 snapshot 재확인 + `LoginService` 의 attempt fence(`login.ts:135`)가 커밋 축을 이미 막는다 |
| `oauth` + `loopback` 이 OS 기본 브라우저를 연다 | 자동 완주 가능한 방식이라 D-006 대상에 포함. `manual` 은 `code-required` 로 1회 만에 중단된다 |

- 되돌리기 어려운 결정: 없다 — 계약 변경이 없고 되돌리면 루프만 사라진다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/app/auth-resume.ts`
- `app/src/main/app/auth-resume.test.ts`
- `app/src/main/app/bootstrap.ts`
- `docs/arch/backend/auth.md` (§5.2)
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md §레이어 DAG`.
- ABI/네트워크 제약: 이번 변경은 DB 를 타지 않는다. `npm test` 를 쓰지 않는다.
- 기본 정적 게이트: `npm run lint` + `npm run typecheck` (ABI 중립).
- 관련 테스트: `./node_modules/.bin/vitest run src/main/app/auth-resume.test.ts` (pretest 우회 — 비-DB 스위트).
- 사람 실기: 없음.

## [구현자 기입] 구현 노트 (r1 — 2026-08-20)

### 설계 리뷰 — plan 을 계약으로 수행한 결과

plan 의 Decision·AC·Technical Design 은 코드로 그대로 옮겨졌다. §11 의 스케치와 실제 구현의
차이는 없다. 아래 두 건만 plan 이 못 본 것이라 **선조치 후 보고**한다.

| # | 발견 | 처리 | 근거 |
|---|---|---|---|
| I1 | **`auth.login()` 은 던질 수 있다.** `resume` 에는 "부팅 경로라 던지지 않는다" 계약이 있지만(`features/auth/login.ts:285`) `login` 에는 없다 — 그 아래에 **주입 포트를 try 밖에서 부르는 자리**가 있다(`features/auth/oauth-runner.ts:95` `states.issue` · `:130` `listen`). *(r2 정정: 구 서술의 `SessionRunner.login` → `sessions.acquire` 예시는 도달 불가 — `runner.ts:48-51` 이 `acquire` 직전에 `register` 를 부른다.)* | **선조치** — `auth-resume.ts:120-131` 에서 catch 해 `cancelled` 와 같은 취급으로 중단하고 `auth.resume.relogin.threw` 로 남긴다 | 부팅은 `void authResume.run()`(`app/bootstrap.ts:404`)이라 방치하면 unhandled rejection 이 되고 **남은 후보의 재로그인과 마지막 방송이 통째로 사라진다** |
| I2 | **plan §14 의 worst case 가 과대했다.** "Auth 1건당 3 × 5분" 은 창 타임아웃이 3회 연속 일어나는 것을 전제하는데, 창 타임아웃은 `SessionRunner` 에서 `cancelled` 로 접히므로(`runner.ts:59-62`) **1회에서 중단된다**(D-004) | **plan 수정 제안** — §14 시간 상한을 "Auth 당 창 타임아웃 1회 + probe 왕복 최대 3회" 로 정정 | 3회 연속 시도가 가능한 것은 창이 정상으로 닫히고 probe 만 실패하는 경우뿐이다 |

I1 은 plan §13 Lifecycle 의 항목이었어야 한다 — plan 은 `resume` 의 무예외 성질만 인용하고
`login` 의 예외 성질을 확인하지 않았다. Part I 상태 전이표에도 이 행이 없다.

### 강제 지점 — plan §10 전수 `5/5`

| 계약 | 닫은 지점 | 이번 턴 관측 |
|---|---|---|
| 재시도 상한 3 | `auth-resume.ts:47` 상수 · `:109` 루프 조건 | `M1`(상한 4) 심어 `최대 3회까지만 시도한다` 실패 확인 |
| 시도 가능 방식 = `oauth`·`browser-session` | `auth-resume.ts:53-64` `autoReloginable` · `:147` 루프 진입 전 | `M2a`(kind 판정 제거) → 4건 실패 · `M2b`(빈 methods 통과) → 2건 실패 |
| 재시도 전제 = 직전 snapshot 이 `expired` | `auth-resume.ts:111` — **매 시도 직전**(루프 안) | `M3`(1회차만 확인) 심어 `none`·`valid` 2건 실패 확인 |
| 계속 조건 = `failed` + `probe_failed` | `auth-resume.ts:139` | `M4`(done 만 중단) 심어 `cancelled`·`input-required`·`code-required` 3건 실패 확인 |
| `methods[0]` 선택 (기존 SSOT) | `features/auth/login.ts:371-374` — **변경 없음** | `auth-resume.ts:122` (r2 정정 — 구 `:133`) 가 kind 를 넘기지 않는다(`deps.auth.login(definition.id)`) — 선택 규칙이 한 벌로 유지된다 |

plan §10 밖이지만 같은 성질의 지점 2곳도 함께 닫았다: 순차 실행(`:147-151`, `M5` 로 검출) ·
조건부 마지막 방송(`:152`, `M6` 로 검출).

### 검사 장치의 적대 검증 — 판정 지점 `9/9`

이번 턴에 만든 테스트가 결함을 실제로 볼 수 있는지, **지점마다 하나씩** 결함을 심어 확인했다.
전부 그 지점을 지키는 테스트가 실패했다(다른 테스트가 대신 잡은 경우 없음).

| 심은 결함 | 실패한 테스트 |
|---|---|
| `M1` 상한 3 → 4 | `확인 실패가 이어지면 최대 3회까지만 시도한다 — 4번째는 없다` |
| `M2a` 방식 kind 판정 제거 | 입력형 3케이스 + `입력형 뒤에 browser-session 이 있어도…` |
| `M2b` 빈 `methods` 통과 | `methods 가 비면 로그인을 부르지 않는다` · `실패 K 건은 즉시 방송된다 — 총 1 + K` |
| `M3` `expired` 재확인을 1회차로 축소 | `시도 사이에 상태가 none/valid 가 되면…` 2건 |
| `M4` 계속 조건을 `done` 아님으로 확대 | `cancelled`·`input-required`·`code-required` 3건 |
| `M5` 순차 → `Promise.all` | `재로그인은 순차다 — 첫 로그인이 끝나야 두 번째가 시작된다` |
| `M6` 마지막 방송을 무조건화 | 기존 `1 + K` 2케이스 (`전부 성공하면…` · `실패 K 건은…`) |
| `M7` gate 도 재로그인 대상에 포함 | `gate Auth 의 복원 실패는 재로그인하지 않는다` |
| `M8` `login` try/catch 제거 | `로그인이 던져도 그 Auth 만 멈추고…` |

`M6` 이 **기존 테스트**를 실패시킨 것이 AC8 의 관측 지점이다 — 재시도 0건 경로의 방송 상한이
실제로 고정돼 있음을 뜻한다.

### Product/UX 파생 검토

- 새 사용자 대면 문자열 0개 — 이번 turn 이 만든 문자열은 전부 진단 로그다(`auth.resume.relogin.*`).
- 재로그인 실패의 화면 결말은 **기존 강등 상태 그대로**다 — Part I 흐름도의 마지막 가지와 같다.
- `login` 이 던지는 경로(I1)는 Part I 상태 전이표에 행이 없다 → 설계자 확인 대상.
- 늦게 도착한 응답: `demoted()` 확인과 `login()` 진입 사이의 경쟁은 plan §17 이 이미 accepted 로
  적었다 — 변경 없음.

### 구현 보고

| 축 | 값 |
|---|---|
| 변경 파일 | `app/src/main/app/auth-resume.ts`(+103) · `auth-resume.test.ts`(+368) · `bootstrap.ts`(+3/-1) · `docs/arch/backend/auth.md`(+19/-2) |
| 신규 의존성 | 0 |
| 계약 변경 | `ResumeAuthDeps.logger?` 추가 1건 (`auth-resume.ts:75`). `AuthRuntime`·`LoginService`·`AuthDefinition` 무변경 |
| 테스트 | `auth-resume.test.ts` **12 → 32 케이스** |

**게이트 (이번 턴 실측)**

| 명령 | 산출 |
|---|---|
| `npm run typecheck` | node·web·test **3/3** 통과, error 0 |
| `npm run lint` | **0 error / 1 warning** — warning 은 `renderer/.../useTranscriptVirtualizer.ts:22`(0102 베이스라인, 이번 변경과 무관). `--fix` 후 트리 변화 0(수정 파일 3개 그대로) |
| `./node_modules/.bin/vitest run` | **1,959/1,959 케이스 통과** · 파일 203/204 |
| `./node_modules/.bin/vitest run src/main/app/auth-resume.test.ts` | **32/32** |
| `node --test "scripts/*.test.mjs"` | **49/49** |
| `node scripts/check-doc-inventory.mjs --check` | 차이 0 — 링크 전건 해석 |

**환경 기인 실패 1파일**: `src/main/app/chat-turn.continuity.test.ts` 가 **0건 수집**으로 실패한다
— `Electron failed to install correctly`. egress 제약으로 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
로 설치했기 때문이고(`app/AGENTS.md §제약 환경 게이트 가이드`), 변경과 무관하다. DB 로드 스위트
4개는 `npm rebuild better-sqlite3`(Node ABI) 후 전부 green 이다.

**AC 자기보고**

| AC | 판정 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | `probe 가 실패해 강등되면 methods[0] 방식으로 다시 로그인한다` — `login:wiki:1` 1건 |
| AC2 | ✅ | `최대 3회까지만 시도한다` — `['login:wiki:1','login:wiki:2','login:wiki:3']`, `M1` 검출 |
| AC3 | ✅ | `로그인이 성공하면 그 자리에서 멈추고…` — 호출 1건 + snapshot `{status:'valid',verified:true}` |
| AC4 | ✅ | `it.each` 3케이스(`cancelled`·`input-required`·`code-required`) 각 `login:wiki:1` 1건, `M4` 검출 |
| AC5 | ✅ | 입력형 3 + 빈 `methods` 1 + `pat` 뒤 `browser-session` 1 = **5케이스** 모두 호출 0건 |
| AC6 | ✅ | 첫 flush 로그 `['enter:a','enter:b','exit:a','exit:b','login:a:1']` — b 로그인 미시작, `M5` 검출 |
| AC7 | ✅ | `none`·`valid` 2케이스 각 `login:wiki:1` 1건에서 멈춤, `M3` 검출 |
| AC8 | ✅ | 기존 `1 + K` describe 2케이스가 **무수정 통과**(`toHaveBeenCalledTimes(1)`·`(3)`), `M6` 검출 |
| AC9 | ✅ | `gate Auth 의 복원 실패는 재로그인하지 않는다` — 호출 0건, `M7` 검출 |
| AC10 | ✅ | `logger.mock.calls` 4건 정확 일치(start/result ×2) + `relogin.threw` 인자 일치 |
| AC11 | ✅ | `docs/arch/backend/auth.md §5.2` — 흐름도에 재로그인 단계 1줄 + 규칙 4행 표 + 방송 상한 조건 |

검산: ✅ 11 · ⚠️ 0 · ❌ 0 = **총 11** (plan §7 의 AC 총수 11, 분모 변경 없음).

## [구현자 기입] 구현 노트 (r2 — 2026-08-20, verify FAIL r1 대응)

프로덕션 동작은 **한 줄도 바꾸지 않았다** — `auth-resume.ts` 의 diff 는 주석 5줄 교체뿐이다(D4).
이번 라운드가 바꾼 것은 **검사 장치의 시야**와 인용의 정확성이다.

### 닫은 항목 — D1~D5 전건

| # | 판정 | 이번 턴 관측 |
|---|---|---|
| D1 | ✅ | `auth-resume.test.ts:582` 에 `toHaveBeenCalledTimes(1)` — r1 을 통과하던 결함(N3)이 이제 이 케이스를 실패시킨다 |
| D2 | ✅ | `it.each` 4결말(`:447`) — `unsupported 는 남은 횟수와…` 케이스가 실재하고 33/33 통과 |
| D3 | ✅ | INDEX 0193 비고 **4문장 / 373자**(`e17621a` 가 교체) — 이번 라운드 갱신본도 5문장 이내로 유지 |
| D4 | ✅ **3/3** | `auth-resume.ts:114-118` · `auth-resume.test.ts:620-622` · 위 I1 행 — 세 곳 모두 `oauth-runner` 근거로 교체 |
| D5 | ✅ **2/2** | §14 시간 상한 재서술 · 강제 지점 표 좌표 `:133` → `:122` |

**D3 은 이번 라운드가 고친 것이 아니다** — 검증 턴의 보드 갱신(`e17621a`)이 이미 교체했다. 이번
턴의 몫은 상태를 되돌리지 않는 것이고, 갱신 후 다시 세어 확인했다.

### 지적을 불변식으로 올려 전수 적용

| 지적 | 승격한 불변식 | 성립해야 하는 지점 | 결과 |
|---|---|---|---|
| D1 (`attempted` 한 지점) | **시도 여부로 갈리는 방송은, 시도가 0건일 수 있는 모든 경로에서 횟수를 단언한다** | P1 후보 0건 조기 반환(`:163`) · P2 방식 게이트 탈락(`:148`) · P3 강등 아님(`:111`) · P4 시도≥1(`:152`) | **4/4** — P1·P2·P3 신설, P4 는 기존(`test:638`·`:657`) |
| D4 (주석 2곳) | **인용한 근거는 코드에서 도달 가능해야 한다** | 코드 주석 · 테스트 주석 · plan I1 행 | **3/3** — verify 가 센 2곳보다 1곳 많다 |

P1·P3 는 r1 에 방송 단언이 아예 없었다. verify 가 지적한 것은 **P3 하나**고, 같은 불변식을 전수로
걸으며 **P1 을 추가로 찾았다**(아래 차집합).

### 검사 장치의 적대 검증 — 차집합으로 센다

이번에 만든 단언이 무엇을 **새로** 잡는지 보려고, 같은 결함을 r1 테스트 파일에도 심어 대조했다.

| 심은 결함 | r2 에서 실패한 테스트 | r1 테스트에서는 |
|---|---|---|
| N1 후보 0건 조기 반환 제거 | `probe 가 없거나 grant 가 없는 Auth 는 묻지 않는다` | **32/32 통과 — 못 봤다** |
| N2 마지막 방송 무조건화 | 6건 — 기존 2 + 신규 단언이 만든 4건 | 2건 검출 |
| N3 `attempted` 를 `demoted` 확인 앞으로 (= verify V6) | `강등되지 않은 Auth 는 시도 대상이 아니다` | **32/32 통과 — 못 봤다** |
| N4 계속 조건에서 reason 절 제거 | `cancelled` · `unsupported` | 1건 검출 |

**차집합 = 2**(N1·N3). r1 의 "적대 검증 9/9 · 전부 검출" 은 **총계였고 차집합이 아니었다** — 심은
9건이 전부 잡혔다는 사실은 심지 않은 지점에 대해 아무것도 말하지 않는다. 이번 표는 반대로
"r1 이 못 보던 것 2건"을 직접 뺀 값이다.

### Product/UX 파생 검토

- 새 사용자 대면 문자열 0개 · 프로덕션 분기 변경 0건 — 화면에 도달하는 것이 달라지지 않는다.
- verify 의 O1(전역 step 경쟁) · O2(D-006 근거) · O3(`gateOpen` 재확인)은 **제품 결정**이라 손대지
  않았다. 결정이 필요한 자리로 `[검증자 기입]` 에 남아 있다.

### 구현 보고

| 축 | 값 |
|---|---|
| 변경 파일 | `auth-resume.test.ts`(+18/-4) · `auth-resume.ts`(+4/-4, **전부 주석**) · `plan.md` · `INDEX.md` |
| 신규 의존성 | 0 |
| 계약 변경 | 없음 |
| 대상 커밋 | `9a04b03` (`git show` 로 실재 확인) |
| 테스트 | `auth-resume.test.ts` **32 → 33 케이스** · 신규 방송 단언 **3곳**(`:293`·`:487`·`:582`, diff 로 확인) — 기존 4곳(`:334`·`:351`·`:638`·`:657`)은 그대로 |

**게이트 (이번 턴 실측)**

| 명령 | 관측한 산출 |
|---|---|
| `npm run typecheck` | node·web·test **3/3**, error 0 |
| `npm run lint` | **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 0102 베이스라인). `--fix` 후 두 수정 파일 diff 0 |
| `./node_modules/.bin/vitest run` | **1,960 케이스 통과** · 파일 203/204 |
| `./node_modules/.bin/vitest run src/main/app/auth-resume.test.ts` | **33/33** |
| `node --test "scripts/*.test.mjs"` | **49/49** (suites 7) |
| `node scripts/check-doc-inventory.mjs --check` | 차이 0 · 링크 전건 해석 |

**환경 기인 실패 1파일**: `app/chat-turn.continuity.test.ts` 가 `Electron failed to install correctly`
로 0건 수집 — r1 과 같은 서명이고 변경 무관(`app/AGENTS.md §제약 환경 게이트 가이드`).

**AC 재검산**: AC 문장·분모는 r1 에서 바뀌지 않았다(§7 행 수를 다시 세어 **11**). 이번 라운드는
AC4·AC8 의 **관측 범위**만 넓혔다. 검산: ✅ 11 · ⚠️ 0 · ❌ 0 = **총 11**.

### Review Signals — 사실만

- 같은 축인가: **예**. `attempted`/방송 상한은 AC8 이 이미 다루던 축이다.
- 막았어야 할 지침: plan §7 AC8 의 검증 수단 칸이 관측 지점을 "기존 2케이스 무수정 통과" 로
  **한 곳으로 지정**했고, 그 한 곳이 `methods: []` 경로만 덮었다.
- 사용자 결정 변경 근거: 없음.
- 반복되는 환경 한계: electron 미설치(`chat-turn.continuity` 0건 수집) — r1 과 동일.
- 현재 라운드: **2**.

## [검증자 기입] 파생 이슈 (r1 — FAIL, 2026-08-20)

판정 원문과 관측은 [`verify.md`](verify.md). 여기에는 다음 라운드가 닫을 항목만 둔다.

- [x] **D1 — `attempted` 판정 지점에 눈이 없다.** `attempted = true` 를 `demoted()` 확인 앞으로 옮기는 결함(verify §4 V6)이 32케이스를 전부 통과한다. AC8 의 `1 + K` 관측이 `methods: []` 경로에만 걸려 있어, 배포의 정상 형상(`browser-session` 이 `methods[0]` + probe 성공)에서 방송 횟수가 잠기지 않는다. `auth-resume.test.ts:569` 뒤 `expect(broadcast).toHaveBeenCalledTimes(1)` 한 줄이면 닫힌다(현재 코드 통과·V6 검출 실측). **함께 "적대 검증 9/9 전부 검출" 보고를 차집합 기준으로 다시 적는다.**
- [x] **D2 — AC4 의 4결말 중 `unsupported` 가 단언되지 않는다.** `it.each` 배열에 `'unsupported'` 를 넣는다 — `stepOf` 의 `default` 분기가 그대로 받는다. 분기 자체는 V4 로 잠긴 것을 확인했다.
- [x] **D3 — INDEX 0193 행 비고가 7문장 / 560자다.** `docs/handoff/AGENTS.md §산출물 문장 규칙 3` 의 5줄 상한을 넘는다(0192 선례 `77229ac`). 게이트 실측·I1/I2 상세는 이 문서가 갖는다.
- [x] **D4 — I1 의 근거 예시가 코드와 어긋난다.** `SessionRunner.login` 은 `acquire` 직전에 `register` 를 부르므로(`runner.ts:48-52`) "미등록 group raw throw" 는 그 경로에서 도달 불가다. `auth-resume.ts:114-118` 주석과 `auth-resume.test.ts:607-608` 주석에서 그 예시를 뺀다 — **방어 catch 자체는 타당하므로 유지**한다.
- [x] **D5 — plan 정정 2건.** §14 시간 상한을 "Auth 당 창 타임아웃 최대 1회(≈5분) 또는 정상 종료 ×3 + probe 15초 ×3" 으로(I2 수용, 타임아웃 3연속은 불가) · 위 강제 지점 표의 `auth-resume.ts:133` → `:122`.

### r2 판정 — PASS · 남은 관측 (verify r2 §10)

r1 파생 이슈 D1~D5 는 위에서 전건 닫혔다(검증자 재측정 완료). 아래는 **PASS 를 막지 않는** 잔여
관측이라 다음 작업의 후보로만 둔다.

- [ ] **W1** — `attempted` 가 후보 간 OR 누적임을 단언하는 케이스가 없다(혼합 순서 1건이면 닫힌다).
- [ ] **W2** — `cancelled` 로 끝난 시도도 마지막 방송을 낳는다는 단언이 없다.
- [ ] **W3** — "batch push 가 재로그인보다 **먼저**" 를 관측하지 않는다 — `auth-resume.ts:169-170` 과 §14 가 명시한 순서인데 뒤집어도 33케이스가 전부 통과한다.
- [ ] **O4** — §14 정정이 벽시계 상한 수치를 지웠다. 구조 서술은 옳으므로 `≈15분` 한 절만 되살린다.
- [ ] **O5** — `auth-resume.test.ts:56` 주석의 `5종` 이 아래 6개 멤버와 어긋난다.

### 사용자 결정이 필요한 관찰 (파생 이슈 아님)

- **O1** — 재로그인의 `emit` 이 전역 `AuthStep` 을 사용자 조작 없이 덮는다. 소비자가 `providerId` 로 걸러 낯선 폼이 뜨지는 않지만, 다른 provider 의 진행 중 입력 폼이 사라질 수 있다.
- **O2** — D-006 의 근거 문장("전역 입력 폼이 뜬다")은 소비자 필터를 감안하면 과장이다. **결정 자체는 유지**하고 근거만 기록한다.
- **O3** — `reloginDemoted` 는 `gateOpen` 을 다시 보지 않는다. probe batch 와 재로그인 사이에 게이트가 닫히면 게이트 화면 뒤에서 로그인 창이 열린다.
