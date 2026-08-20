# Verify — 0193-auth-resume-relogin-retry

## 메타

| 항목 | 값 |
|---|---|
| slug | `0193-auth-resume-relogin-retry` |
| 검증자 | Claude Code |
| 일자 | 2026-08-20 |
| 대상 커밋/range | `f54e826..13d9b05` (+ `f4316b9` INDEX 해시 채움) |
| 구현 전 plan 기준 | `f54e826` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증 모두 Claude — 그래서 기준선(§0)과 적대 뮤테이션(§4)을 구현자와 **다른 지점·다른 강도**로 다시 심었다 |

**한 줄 판정**: 프로덕션 동작은 옳고 AC 11/11 · 강제 지점 5/5 는 재측정으로 성립하지만, **검사 장치에 판정 지점 하나가 비어 있고**(D1) 보드 비고가 상한을 넘어(D3) FAIL 이다.

## 0. 기준선 / plan 변경 확인

- 기준선이 diff 로 성립하는가: **예**. 설계 커밋 `f54e826`(plan +342줄) 과 구현 커밋 `13d9b05` 이 갈려 있다.
- 구현 커밋의 `plan.md` diff: **2곳뿐** — 메타 `상태` 행(`READY` → `READY → IMPL_DONE (r1)`) + `[구현자 기입]` 채움(+101줄).
- Decision Ledger 변경: **없음** (D-001~D-007 원문 그대로).
- Product/UX Contract(§1~§7) 변경: **없음** — AC1~AC11 문장 무변경, 분모 11 유지.
- 채점에 사용할 원 기준: `f54e826` 의 §3 Decision Ledger · §7 AC · §10 강제 지점 표.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 나머지 Auth 만 | gate 자신은 대상 아님 | `bootstrap.ts:394` 이 `remainingAuthDefinitions(...)` 만 넘긴다 · `reloginDemoted(candidates)` 는 `resumeRemainingOnce` 안에서만 불린다(`auth-resume.ts:172`) |
| D-002 최대 3회 | 4번째 호출 없음 | `MAX_RELOGIN_ATTEMPTS`(`:47`) → 루프 조건(`:109`) |
| D-003 `methods[0]` | 게이트와 실행이 같은 방식을 본다 | 게이트 `:62`, 실행은 인자 없이 `login(id)`(`:122`) → `login.ts:371-374` 이 `methods[0]` 선택 |
| D-004 `probe_failed` 만 계속 | 취소·대기 결말은 즉시 중단 | `:139` |
| D-005 probe 병렬 · 재로그인 순차 | 창이 한 번에 하나 | `Promise.all`(`:164`) 후 `for…of` + `await`(`:147-150`) |
| D-006 입력형 제외 | 입력 폼을 만들지 않는다 | `AUTO_RELOGIN_KINDS`(`:53-56`) + `:148` |
| D-007 별도 검증 경로 없음 | 평소 로그인과 같은 경로 | `deps.auth.login` 하나만 부른다 — `probe`/`markVerified` 를 직접 만지지 않는다 |

### end-to-end 흐름 — 실제 코드로 따라간 결과

```text
gate 통과 → resumeRemainingOnce → Promise.all(auth.resume ×N) → pushConnectionState()
  → reloginDemoted: autoReloginable → demoted() → auth.login(id)
      → LoginService.run → runSession/runOAuth → absorb → settleGrant
          → probeOk(definition, candidate)
              → AuthenticatedRequester: grantStatus = candidate ? 'valid' : store.status
              → checkOutboundRequest 통과 (expired 여도 candidate 면 valid)
          → 성공: store.put → verified=true · revision+1 → onSnapshot('credential-committed')
              → bootstrap 구독자 → pushConnectionState + plugin.sync + harness invalidate
          → 실패: {kind:'rejected'} — **아무것도 쓰지 않는다** → status 는 expired 로 남는다
  → 시도가 있었으면 pushConnectionState() 1회
```

**두 지점이 이 기능의 성립 조건이고 둘 다 코드로 확인했다.**

- `authenticated-request.ts:131` — `grantStatus: candidate ? 'valid' : this.deps.store.status(authId)`. 이 우회가 없으면 `policy.ts:69` 가 `expired` 를 막아 재로그인의 내부 probe 가 **항상** 실패하고 기능 전체가 무동작이 된다.
- `login.ts:472-475` — `probeOk` 실패는 `{kind:'rejected'}` 로 끝나고 store 를 손대지 않는다. 그래서 2·3회차의 `demoted()` 재확인이 통과한다(fake 의 "성공만 상태를 바꾼다" 가 프로덕션과 같다).

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | ✅ | 망 불통이면 probe 15초(`login.ts:64`) ×3 후 강등 유지 — 기존 결말과 같다 |
| false success 가능성 | ✅ 없음 | `done` 판정은 `settleGrant` 의 probe 통과 뒤에만 나온다(`login.ts:511`) |
| partial failure 잔여 | ✅ 없음 | 이 작업이 만드는 쓰기 0건. 재시도 카운터는 지역 변수 |
| A 아닌 B 를 구현했는가 | ✅ | Part I 흐름도 5분기와 코드 분기가 1:1 |
| 증상만 지웠는가 | ✅ | 강등 상태 자체를 회복 시도한다 |
| worst-case 상한 | ⚠️ | plan §14 의 "Auth 당 3 × 5분" 은 과대 — §7 참조(D5) |
| `run()` 무예외 계약 유지 | ✅ | `login` throw 를 `:123-130` 이 접는다. 테스트 `:611-619` 가 `resolves.toBeUndefined()` 로 단언 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh f54e826..13d9b05
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공란 |
| `gateOpen` 프로덕션 참조 0 | **오탐** | 같은 파일 `:182`·`:186` 이 부른다 — 스크립트는 타 파일만 센다. 0188 부터의 기존 표면 |
| 타입 전용 export 2건 | 정상 | `ResumeAuthDeps` 는 `bootstrap.ts:394` 의 인자 타입 |
| 형제 정책 비대칭 | 없음 | 스크립트 3 공란 |
| 신규 값의 기존 소비처 | 무영향 | `logger?` 는 선택 필드 — 미주입 경로(테스트 12케이스)가 그대로 통과 |
| producer ↔ consumer 파생 | 일치 | 재로그인 성공은 수동 로그인과 **같은** `credential-committed` 를 낸다 — 소비자 분기 추가 0 |
| 동일 규칙 중복 구현 | 의도된 이중 읽기 | 방식 선택은 `methods[0]` 하나를 게이트(`:62`)와 실행(`login.ts:374`)이 각각 읽는다. kind 를 인자로 넘기지 않아 `find(kind)` 라는 두 번째 규칙을 만들지 않았다(`:121` 주석) |

### 기준 밖 관찰 — 프로덕션 표면 (수정 아닌 보고)

- **O1. 사용자 조작 없이 전역 `AuthStep` 이 덮인다.** 재로그인의 `emit`(`login.ts:794-796`)은 성공 시 `step=null`, 실패 시 `failed` 를 전역에 쓴다. 소비자는 `providerId` 로 거르므로(`ProviderDetail.tsx:44`·`GateLogin.tsx:42`) **낯선 폼이 뜨지는 않지만**, 다른 provider 의 진행 중 입력 폼이 재로그인 완료 시점에 사라질 수 있다. 부팅 재로그인 창은 최대 5분(`browser-session.ts:36`)이라 겹칠 여지가 있다.
- **O2. D-006 의 근거 문장은 소비자 필터를 감안하면 과장이다.** "전역 `input-required` 폼이 뜬다" 가 아니라 "그 Auth 의 상세를 연 사용자에게만 보인다" 가 맞다. **결정 자체(입력형 제외)는 사용자 것이라 유지**하고 근거만 기록한다.
- **O3. `reloginDemoted` 는 `gateOpen` 을 다시 보지 않는다.** probe batch 와 재로그인 사이에 게이트가 닫히면 게이트 화면 뒤에서 로그인 창이 열린다. 발생 조건이 좁아 이번 라운드의 결함으로 세지 않는다.

## 4. 검사 장치 재검증 — 구현자와 다른 뮤테이션 9건

구현자의 `M1~M8` 을 재현하지 않고 **판정 기준을 한 단계 좁혀** 직접 심었다(전부 실행 후 `git checkout` 복원, 트리 변화 0).

| # | 심은 결함 | 결과 |
|---|---|---|
| V1 | 상한 3 → **2**(구현자는 4로 올렸다) | ✅ 검출 1건 |
| V2 | `demoted`: `=== 'expired'` → `!== 'none'` | ✅ 검출 2건 |
| V3 | `AUTO_RELOGIN_KINDS` 에 `'pat'` 추가 | ✅ 검출 2건 |
| V4 | 계속 조건에서 **reason 절만** 제거 | ✅ 검출 1건(`cancelled`) |
| V5 | `methods[0]` → `methods.some(...)` | ✅ 검출 1건 |
| **V6** | `attempted = true` 를 `demoted()` 확인 **앞**으로 | ❌ **32/32 통과 — 검출 0** |
| V7 | 마지막 방송을 Auth 마다 1회로 분산 | ✅ 검출 1건 |
| V8 | throw 후 `return` → `continue` | ✅ 검출 1건 |
| V9 | 순차 `await` 제거(fire-and-forget) | ✅ 검출 3건 |

**차집합 = V6 하나.** 구현 보고의 "적대 검증 9/9 · 판정 지점마다 결함을 심어 **전부 검출**" 은 성립하지 않는다 — 완결성 주장의 관측값은 총계가 아니라 차집합이고, 그 차집합이 비지 않았다.

### V6 이 왜 실제 구멍인가

`attempted` 는 마지막 추가 방송의 **유일한** 판정자다. "시도 0건이면 방송 0건" 은 두 경로로 성립해야 한다.

1. `autoReloginable` 에서 걸러진 후보 → 기존 12케이스가 잠근다(`definition()` 이 `methods: []`).
2. **루프에 들어갔지만 `demoted()` 가 false 인 후보** → **잠그는 단언이 없다**.

2번이 배포의 정상 부팅 형상이다 — `browser-session` 을 `methods[0]` 로 쓰는 나머지 Auth 의 probe 가 성공한 경우. 그 경우를 세우는 케이스는 이미 있으나(`auth-resume.test.ts:560` "강등되지 않은 Auth 는 시도 대상이 아니다") **로그인 횟수만 단언하고 방송 횟수를 단언하지 않는다**. 그래서 AC8 의 `1 + K` 는 실제 배포 형상에서 열려 있다.

**수정과 그 효과를 실측했다**: `:569` 뒤에 `expect(broadcast).toHaveBeenCalledTimes(1)` 한 줄을 넣으면 현재 코드에서 32/32 통과, V6 을 심으면 그 케이스가 실패한다.

## 5. 요구사항 충족 매트릭스

| # | 결과 | 이번 턴에 재현한 관측 |
|---|---|---|
| AC1 | ✅ | 케이스 10 — `loginsOf(log,'wiki') === ['login:wiki:1']` |
| AC2 | ✅ | 케이스 12 — `['1','2','3']`, V1(상한 축소)로도 검출 |
| AC3 | ✅ | 케이스 11 — 호출 1 + `{status:'valid',verified:true}`. 프로덕션은 `store.put`(`store.ts:248-252`)이 `verified=true` 를 세운다 |
| AC4 | ⚠️ | 케이스 13~15 — plan 이 이름 붙인 **4결말 중 3개**만 단언(`unsupported` 없음). 분기는 V4 로 잠긴 것을 확인 → D2 |
| AC5 | ✅ | 케이스 17~21 — 입력형 3 + 빈 `methods` 1 + `pat`→`browser-session` 1 = 5케이스 호출 0 |
| AC6 | ✅ | 케이스 22 — 첫 flush 로그 `['enter:a','enter:b','exit:a','exit:b','login:a:1']`, V9 로 검출 |
| AC7 | ✅ | 케이스 23·24 — `none`·`valid` 각 1회에서 중단, V2 로 검출 |
| AC8 | ⚠️ | 기존 2케이스(`:312`·`:329`) 무수정 통과 — **plan 이 지정한 관측 지점은 충족**. 그러나 그 지점이 `methods:[]` 경로뿐이라 V6 이 통과한다 → D1 |
| AC9 | ✅ | 케이스 26 — gate 만 강등시키고 호출 0 |
| AC10 | ✅ | 케이스 27 — `logger.mock.calls` 4건 `toEqual` 정확 일치. 배선은 `bootstrap.ts:399`(형제 `:357`·`:274` 와 같은 패턴) |
| AC11 | ✅ | `auth.md:367-380` — 흐름도 1줄 + 규칙 4행 표 + 조건부 상한 문장. `1 + K` 타 서술(`:306`)과 모순 없음 |

- **합계 재측정**: ✅ 9 · ⚠️ 2 · ❌ 0 = **총 11**. 분모 11(plan §7 직접 셈), 분모 변경 없음.
- **합계 사본 대조**: 본문 11 ↔ 커밋 `Criteria-Met: 11/11` ↔ INDEX 비고 "AC 11/11" — **세 사본 일치**. 다만 검증 판정은 **9 ✅ + 2 ⚠️** 다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약 | plan 이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 재시도 상한 3 | 루프 조건 (1) | `:109` | ✅ 1/1 |
| 시도 가능 방식 2종 | Auth 마다 1회 (1) | `:148`(판정은 `:61-64`) | ✅ 1/1 |
| 전제 = 직전 `expired` | **시도마다** (3) | `:111` 이 루프 **안**이라 attempt 1·2·3 전부 | ✅ 3/3 |
| 계속 조건 `failed`+`probe_failed` | 시도 결과마다 (3) | `:139` 동일 | ✅ 3/3 |
| `methods[0]` 선택 SSOT | 로그인마다 (기존) | `:122` 가 kind 를 넘기지 않는다 — `login.ts:374` 단일 규칙 유지 | ✅ |

- 표에 없는데 같은 불변식이 필요한 지점: **1곳 — `attempted` 판정**(§4 V6). 순차 실행·조건부 방송은 구현자가 표 밖 2곳으로 이미 닫았고 V7·V9 로 검출된다.

## 6. 외부 포트 / 문서 계약

해당 없음 — 배포가 구현할 port/schema 신설 0건, `AuthDefinition` 무변경. `ResumeAuthDeps.logger?` 는 컴포지션 루트 1곳(`bootstrap.ts:394`)만 쓰는 내부 계약이다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- `AuthMethod` **5**종(`contracts/auth.ts:155-164`) · `ProviderStepInfo` **5**종 · `ProviderFailureReason` **8**종(`shared/ipc.ts:1280-1306`) — plan §8 수치와 일치.
- 테스트 케이스 **32** = 기존 12 + 신규 20(`--reporter=verbose` 로 이름 전수 열거). 내역 합 = 총계 ✅.
- 0건 기준: AC5·AC7·AC9 의 "호출 0회" 는 짝이 되는 정상 동작 케이스(AC1·AC3)가 같은 파일에 있어 vacuous 하지 않다.
- **시간 상한 — plan §14 는 과대하다(구현자 I2 수용, 단 문장은 다듬어야 한다)**. 창 타임아웃은 `openLoginWindow` 거부 → `failure('cancelled')`(`runner.ts:54-61`)라 **타임아웃이 3회 연속 날 수는 없다**(D-004 로 1회에서 중단). 3회를 소진하는 경로는 창이 매번 정상 종료되고 probe(15초)만 실패하는 경우다. 정확한 서술은 "Auth 당 창 타임아웃은 최대 1회(≈5분) 또는 정상 종료 ×3 + probe 15초 ×3" → D5.
- 요청 fan-out: `3N` 로그인 · probe `≤4N` — plan §14 와 일치, 무제한 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 순서·횟수·중단·방송 | 32케이스 + 뮤테이션 9건 | 없음 — `auth-resume.ts` 는 electron 미의존 |
| 실제 SSO 재로그인 창 | 없음 | **있음** — 사내망에서 창이 뜨고 닫힌 뒤 연결이 살아나는지(egress 차단 환경에서 불가) |
| 전역 step 경쟁(O1) | 없음 | **있음** — 재로그인 중 다른 provider 입력 폼을 열어 두고 관찰 |

## 9. 게이트 재실행

- 적용 정본: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`. `npm test` 를 쓰지 않았다.

| 명령 | **관측한 실행 산출**(exit code 아님) |
|---|---|
| `npm run typecheck` | node·web·test **3/3**, error 0 |
| `npm run lint` | **0 error / 1 warning** — `useTranscriptVirtualizer.ts:22`(0102 베이스라인) |
| `./node_modules/.bin/vitest run` | **1,959 케이스 통과** · 파일 **203/204** |
| `./node_modules/.bin/vitest run src/main/app/auth-resume.test.ts` | **32/32** |
| `node --test "scripts/*.test.mjs"` | **49/49** (suites 7) |
| `node scripts/check-doc-inventory.mjs --check` | 차이 0 · 링크 전건 해석 |

- 환경 기인 실패 **1파일**: `app/chat-turn.continuity.test.ts` 가 `Electron failed to install correctly` 로 **0건 수집**. `app/AGENTS.md` 의 알려진 서명이고 변경 무관 — 구현자 보고와 같은 결과다.
- **게이트가 작업 트리를 바꿨는가**: **아니오**. `lint`(`--fix`) 실행 전후 `git status --porcelain` 공란.
- **검증 중 실행한 명령의 잔여물**: 없음. 뮤테이션 9건 + 제안 단언 실험 후 `git checkout` 복원, 최종 트리 공란.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 — §9 |
| AC ↔ production path | 에이전트 1:1 대조 — §5 |
| 레이어/계약 | `boundaries` lint 0 error — `app/infra/errors`·`shared/obj` import 는 app→infra·shared 하향 |
| 제품 의도(O1·O2·O3) | **사람 결정** — 보고만 한다 |
| 사내망 실기 | **사람** — §8 |

## 11. Repository operation checks

### AGENTS.md 위생

해당 없음 — 이번 라운드는 `AGENTS.md` 를 건드리지 않았다.

### INDEX 보드 정합성

- 단계/상태/다음 주체/대상 커밋: ✅ `impl`·`IMPL_DONE (r1)`·`Claude(검증)`·`13d9b05` 모두 실제와 일치.
- **비고 5줄 이내: ❌ 위반 — 7문장 / 560자.** 0192 는 6문장에서 5문장으로 줄인 선례가 있다(`77229ac`). 최근 행 비교: 0192 = 333자/4문장 · 0191 = 245자/3문장 → D3.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer: ✅ `13d9b05` = `Agent: claude` · `Status: implemented` · `Criteria-Met: 11/11` · `Verified-By: pending`, `Next-Action` 없음 — `docs/git-template.md` 구현 커밋 규칙과 일치. 설계 커밋 `f54e826` 의 `Status: implemented` 는 0191·0192 설계 커밋과 같은 관례다.
- 인용 해시 실재: ✅ `13d9b05`(INDEX 대상 커밋) 실재.
- **인용 좌표**: ❌ 1건 — `[구현자 기입]` 의 "`auth-resume.ts:133` 이 kind 를 넘기지 않는다" 는 실제 **`:122`** 다(`:133` 은 logger 인자). 나머지 좌표(`:47`·`:109`·`:111`·`:139`·`:147-152`·`bootstrap.ts:404`)는 실재 → D5.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| **I1 선조치** — `login` throw 를 catch | **타당**. `run()` 은 무예외 계약(`:89`)이고 호출부는 `void`(`bootstrap.ts:404`) — 흘리면 남은 후보와 마지막 방송이 사라진다. 테스트 케이스 28 이 이를 잠근다 | 유지 |
| I1 의 **근거 예시** | **부정확**. `SessionRunner.login` 은 `acquire` **직전에** `register` 를 부르므로(`runner.ts:48-52`) "미등록 group raw throw"(`browser-session.ts:96-98`)는 그 경로에서 도달 불가. `oauth-runner.begin` 의 `states.issue`·`listen` 이 try 밖인 것이 더 나은 근거다 | D4 — 주석 2곳 정정 |
| **I2 plan 수정 제안** — §14 과대 | **타당**(§7 재계산). 다만 "1회에서 중단" 은 *타임아웃* 에 한정된 서술이라 3회 소진 경로를 함께 적어야 한다 | D5 — plan §14 갱신 |
| 선조치/보고 경계 | ✅ 준수 — I1 은 구현 세부라 선조치, I2 는 plan 문장이라 제안에서 멈췄다 | — |

## 13. 파생 이슈 (FAIL)

- [ ] **D1** — `attempted` 판정 지점을 잠그는 단언이 없다(§4 V6). `auth-resume.test.ts:569` 뒤에 `expect(broadcast).toHaveBeenCalledTimes(1)` 을 넣는다(현재 코드 통과·V6 검출 실측). 함께 **"적대 검증 9/9 전부 검출" 보고를 차집합 기준으로 다시 적는다.**
- [ ] **D2** — AC4 가 이름 붙인 4결말 중 `unsupported` 가 단언되지 않는다. `it.each` 배열에 `'unsupported'` 를 넣는다(`stepOf` 의 `default` 분기가 그대로 받는다).
- [ ] **D3** — INDEX 0193 행 비고를 **5문장 이내**로 줄인다(현재 7문장/560자). 게이트 실측·I1/I2 상세는 `plan.md` 가 갖는다.
- [ ] **D4** — I1 근거 정정: `auth-resume.ts:114-118` 주석과 `auth-resume.test.ts:607-608` 주석에서 "`sessions.acquire` 미등록 group raw throw" 예시를 뺀다(그 경로는 `register` 가 선행한다).
- [ ] **D5** — plan 정정 2건: §14 시간 상한을 "창 타임아웃 최대 1회(≈5분) 또는 정상 종료 ×3 + probe 15초 ×3" 로 · `[구현자 기입]` 강제 지점 표의 `auth-resume.ts:133` → `:122`.

> O1·O2·O3(§3)은 **제품 결정 영역**이라 파생 이슈로 올리지 않는다 — 사용자가 볼 자리에 사실만 남긴다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 라운드 1 이므로 없음. 다만 **완결성 주장(`9/9 전부 검출`)이 차집합으로 검증되지 않은 형태**는 0187 r1·0189 r1·0190 r1 과 같은 축이다.
- 관련 plan 지침/AC 존재: AC8 은 관측 지점을 "기존 2케이스 무수정 통과" 로 **지정**했고 구현자는 그대로 따랐다 — 지침 위반이 아니라 **지침이 지정한 관측 지점이 좁았다**.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: electron 바이너리 미설치로 `chat-turn.continuity` 0건 수집 · 사내망 SSO 실기 불가(§8).

## 15. 결론

- 상태: **FAIL** (r1) — 다음 주체 = **Claude(재구현)**.
- Product/UX 및 ACTIVE Decision: **충족**. D-001~D-007 이 코드와 1:1 이고, 재로그인이 프로덕션에서 실제로 성립하는 두 조건(candidate 정책 우회 · 실패 시 무기록)을 코드로 확인했다.
- AC: **✅ 9 · ⚠️ 2 · ❌ 0 / 11**. ⚠️ 둘은 관측 범위 부족이지 동작 결함이 아니다.
- 강제 지점: **5/5**(전제·계속 조건은 지점 3회씩 전수 확인) + 표 밖 1곳 미봉(D1).
- 기준 밖 결함: 프로덕션 결함 0건. 관찰 3건(O1·O2·O3)은 제품 결정으로 올린다.
- repository operation: **비고 상한 위반 1건**(D3).
- 남은 사람 확인: 사내망 SSO 실기 · O1 의 전역 step 경쟁 수용 여부.
