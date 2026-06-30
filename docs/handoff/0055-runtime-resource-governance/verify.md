# Verify — 0055-runtime-resource-governance

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §3. plan 상단(설계)·`[구현자 기입]`(구현)에 이어 본 문서가 검증이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0055-runtime-resource-governance` |
| 검증자 | Claude Code |
| 일자 | 2026-06-30 |
| 대상 커밋 | `dfe447a` (브랜치 `claude/handoff-55-verify-2t4zz3` 실 커밋; INDEX/impl 기재 `0baaea4` 는 Codex env 해시 — 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> plan `[구현자 기입]` — 설계 리뷰·놓친 잠재 문제(선조치 4건 ✅)·구현 체크리스트를 먼저 읽고 매트릭스에 반영.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §`selectVictims` capacity 의미 모호 → **idle target capacity** 로 명시(Supervisor 가 total cap − active 변환) | **타당** — plan AC2 가 "capacity"를 idle 한도로 못 박지 않아 모호. 구현이 `eviction-policy.ts:11-12` 주석 + `supervisor.ts enforceCap` `idleTargetCapacity=max(0,capacity-active)` 로 해소. 설계 의도(victim=idle only)와 일치. | 매트릭스 #1·#2 증거에 반영 |
| 선조치 #1 capacity 모호 → idle target 변환 + 주석/테스트 고정 (✅) | 타당, 코드·테스트 확인 | #2 ✅ |
| 선조치 #2 `closeEntry` 단일화 위해 `onReap` 을 entry 에 저장 (✅) | 타당 — `RuntimePoolEntry.onReap` 으로 4경로 멱등 수렴 | #5 ✅ |
| 선조치 #3 `BoundedRuntimeCapPolicy` 를 L1 정책으로 추가(기본 주입은 여전히 무제한) (✅) | **수용** — plan 비범위(cap 수치)가 아니라 *동일 production path 로 bounded seam 검증*용. 기본 주입 무제한 유지 확인(`supervisor.ts` 기본 `UnlimitedRuntimeCapPolicy`)으로 AC7(동작보존) 무해. over-cap reject/queue 결정은 여전히 0056 으로 이관(union 미포함). | #3 ✅, 동작보존 무해 확인 |
| 선조치 #4 `closeAll()` Map 순회 중 삭제 위험 → key snapshot 순회 (✅) | 타당 — `Array.from(this.idle.keys())` 로 안전 | #5 ✅ |

## 요구사항 충족 매트릭스

> plan 인수 기준 1:1 대조. 증거는 `파일:심볼` + 테스트.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | count 3종 disambiguation — cap count=Supervisor active ∪ Pool idle · **eviction victim=idle only** · active 미축출 · ConcurrencyRegistry 턴게이트와 분리 | ✅ | `supervisor.ts` 헤더 주석(0055 Resource governance 블록) + `runtime-cap-policy.ts:5-7`(active+idle=대상, 턴 count 분리 주석) + `getRuntimePopulation()`. `acquireRuntime`/`enforceCap` 가 idle 만 evict(`pool.evictToCapacity`), active 핸들 비참조 |
| 2 | `EvictionPolicy` 순수 추상화(Map 비의존·victim sessionId 키만) + LRU 기본 + 단위테스트 | ✅ | `eviction-policy.ts` — `IdleRuntimeEntry`/`EvictionPolicy.selectVictims`/`LruEvictionPolicy`(snapshot 앞=oldest, target 밖만 victim). `eviction-policy.test.ts` 3 케이스(LRU 선택·여유시 빈배열·음수 capacity=0) green. policy 는 `runtime`만 받고 Map/Timer 미참조 |
| 3 | `RuntimeCapPolicy` 주입 + union **`accept\|evict-idle` 만** + 기본 Unlimited + acquire/keepIdle hook | ✅ | `runtime-cap-policy.ts` `RuntimeCapDecision='accept'\|'evict-idle'`(reject/queue 부재) + `UnlimitedRuntimeCapPolicy`(항상 accept) + `BoundedRuntimeCapPolicy`(seam 검증용). `supervisor.ts enforceCap()` 를 `acquireRuntime`(factory 전·`reused` 시 skip)·`releaseRuntime`(keepIdle 성공 후) 에 hook |
| 4 | ConcurrencyRegistry 소유 Supervisor 이관 + `concurrency` getter + `RouterContext.concurrency` 제거(파일 미이동) | ✅ | `supervisor.ts` `concurrency` getter + 생성자 `options.concurrency ?? new ConcurrencyRegistry()` · `router.ts:206` Supervisor 에 `concurrency` 주입(이전 `ctx.concurrency` 생성 제거) · `context.ts` `concurrency` 필드 제거 · `send.ts:319` `concurrency: supervisor.concurrency` · `orchestration/concurrency.ts` 파일 미이동(결정 2 준수) |
| 5 | idempotent close 단일 helper(4경로 합류) + 경쟁 테스트 | ✅ | `runtime-pool.ts` private `closeEntry(sessionId)`(timer.clear→map.delete→close→onReap, Map 선제거 후 close). keepIdle prev 교체·timer 콜백·closeAll(key snapshot)·`evictToCapacity` 전부 경유. `runtime-pool.test.ts` "timer self-reap 과 LRU eviction 합류해도 close 1회"(`closed===1`·`onReap` 1회) green |
| 6 | `getRuntimePopulation(): {active,idle,total}` | ✅ | `supervisor.ts getRuntimePopulation()`(registry.size + pool.size). `supervisor.test.ts` "active+idle 인구만 센다"(`{active:1,idle:1,total:2}`) green |
| 7 | 게이트 OFF 동작·이벤트·DB·UX 무변경 + 게이트 green | ✅ | 기본 `UnlimitedRuntimeCapPolicy`→항상 accept·`capacity=null`→`enforceCap` early-return. OneShot(게이트 OFF)은 pool 미진입(0054)이라 cap/evict 무력. `supervisor.test.ts` "기본 cap 정책 무제한"(`closed===0`) + 게이트 결과(아래) |
| 8 | 레이어 경계(L1↔L3 하향)·`import/no-cycle` 0 | ✅ | `npm run lint`(eslint-plugin-boundaries + import/no-cycle) 위반 0. Supervisor(L1)→`orchestration/concurrency`(L1) 동일레이어 import 가 순환 미유발 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — | lint·typecheck(node+web+test)·test 588/588 로드분 green |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 | 이견 시 중재 | 8/8 충족 |
| 레이어 경계 위반 0 | ✅ | — | boundaries·no-cycle 0 |
| 문서 형식/링크/한국어 | ✅ | — | verify/INDEX 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음(해당 없음) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 동작보존(기본 무제한) 무해 |
| Open Questions(cap 수치·평가세션 cap 회계) | ✖ 단독 금지 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 해당 없음(main 내부·UX 0 변경) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| 게이트 ON 실환경 GUI 회귀 | ✖ | ✅ | 사람 확인 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm install   # ELECTRON_SKIP_BINARY_DOWNLOAD=1 (프록시가 electron 다운로드 차단)
$ npm run lint            # eslint --cache --fix ./src → 클린, 파일 변경 0 (boundaries·no-cycle 0)
$ npm run typecheck       # typecheck:node + typecheck:web + typecheck:test → 전부 통과
$ npm test                # 1차: 12 fail = db/queries.test.ts "Module did not self-register" (0019 dual-ABI)
$ npm rebuild better-sqlite3 && npm test
  Test Files  2 failed | 79 passed (81)
       Tests  588 passed (588)
```

- **588/588 로드된 테스트 green.** 신규 0055 테스트 전부 green: `eviction-policy.test.ts`(3) · `runtime-pool.test.ts` 0055 그룹(3: evictToCapacity LRU · take→re-keep recency · timer/evict 멱등) · `supervisor.test.ts` 0055 그룹(4: population · 무제한 미축출 · bounded idle-target LRU · concurrency getter).
- **환경 제약 2 suite**: `persist.test.ts`·`send.runtime-resilience.test.ts` 는 electron 바이너리 미설치로 **import 차단**("Electron failed to install correctly") — 프록시가 electron 다운로드 서버를 막아 발생(변경 무관). 0050/0053/0054 verify 가 동일 제약을 명시. 정상환경 재실행 시 9 green(588+9=**597**)이 impl 보고 `597/597` 과 정합. `send.runtime-resilience` 가 검증하는 idle/retry 헬퍼는 0055 미변경(send.ts 변경은 `concurrency` 주입 1줄, typecheck 로 커버).
- **better-sqlite3**: 0019 dual-ABI 클래스(`npm test`=Node ABI ↔ install-app-deps=Electron ABI). `npm rebuild better-sqlite3`(Node ABI) 후 12-red 해소. 코드 무관.

## 위생 검토

- AGENTS.md 변경 없음 — 키/토큰/이메일/IP 스캔 해당 없음.
- `ctx.concurrency` 잔재 0(유일 `.concurrency`=`CHANNELS.concurrencyEvent`, 무관). `RouterContext.concurrency` 완전 제거.
- 신규 의존성 0(순수 TS 정책 객체 + 기존 모듈 배선). IPC 채널 변경 0 → `IPC_CONTRACT.md` 갱신 불요.
- **잠재 회귀 조사(keepIdle prev 교체)**: 구 `if (prev.runtime !== runtime) prev.runtime.close()` 동일-인스턴스 가드를 신 `closeEntry` 수렴이 제거 → **회귀 아님**. production(`send.ts:430`)은 매 턴 `acquireRuntime`(`pool.take`)이 keepIdle 전에 키를 빼므로 `idle.has(key)`=false → closeEntry 미발화. `take`의 closed-handle 가드가 backstop. 신규 `runtime-pool.test.ts:113`(take→re-keep)이 `a.closed===0` 으로 확정.

## PHASES.md 정합성

- **승격 보류**(precedent). 형제 lifecycle P1 핸드오프 0052·0053·0054 가 INDEX `verify/PASS` 임에도 `docs/PHASES.md` 미승격(0050 다음 행이 없음) — 시리즈 일괄 승격(0056 admission 완료 후) 대기 패턴. 0055 도 동일 유지.
- 백로그: PHASES 에 0052·0053·0054·0055 4건 미승격 누적. 0056 종료 시 lifecycle P1 시리즈를 한 행(또는 4행)으로 일괄 승격 권장. INDEX 가 그 사이 단일 진실원.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: AC2 의 "capacity" 가 전체 cap 인지 idle cap 인지 plan 본문에서 모호했다(구현자 이견 §1 이 정확히 지적). plan §모듈화 표는 "capacity"만 적고 active 차감 변환을 명시 안 함 — 구현이 `idleTargetCapacity` 로 보강. 차기 설계는 정책 파라미터의 *단위*를 시그니처 주석까지 못 박을 것.
- **구현 단계**: `BoundedRuntimeCapPolicy` 선추가는 plan "기본 무제한만 출하" 와 표면상 어긋나 보이나, 기본 주입을 무제한으로 유지하고 bounded 는 동일 path seam 검증 전용으로 둬 동작보존을 깨지 않음 — 적절한 선조치. over-cap reject/queue 는 union 에 넣지 않아 0056 경계도 보존.
- **검증 단계**: electron 의존 2 suite 를 정상환경에서 직접 돌리지 못함(프록시 차단). 0055 변경(send.ts 1줄)은 typecheck + supervisor concurrency getter 테스트로 간접 커버되나, send 경로 통합 동작은 사람 실환경 검증 항목으로 남긴다. cap 정책 ON(`ORCA_PERSISTENT_RUNTIME=1` + bounded)의 실 GUI 거동(idle reap·재진입 reseed)도 미검증 — 사람 확인 대기.

## 결론 / 다음 단계

- **상태: PASS (r1).** 인수 8/8 충족, 게이트 green(588 로드분 + 2 electron suite 환경제약), 레이어 0, 신규 의존성 0, 동작보존 확인.
- INDEX `verify/PASS`, Next-Action=`none`. 0055 종료.
- 후속: 턴 admission(steer/queue/reject)은 `0056-turn-admission-steer-queue`(DRAFT, 사용자 정책 결정 대기). PHASES 승격은 lifecycle P1 시리즈 일괄(0056 후).
- **사람 확인 대기**: cap 수치(OQ1)·평가세션 cap 회계 포함 여부(OQ3) 결정 · 게이트 ON 실환경 GUI 회귀(cross-turn 재사용·idle reap·LRU 축출 후 reseed) · 정상환경 electron 게이트 재실행 · PR 머지.
