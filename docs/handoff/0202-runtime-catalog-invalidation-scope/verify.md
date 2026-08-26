# Verify — runtime-catalog-invalidation-scope

## 메타

| 항목 | 값 |
|---|---|
| slug | `0202-runtime-catalog-invalidation-scope` |
| 검증자 | Claude Code |
| 일자 | 2026-08-26 |
| 대상 커밋/range | `70d65c1..72255c9` |
| 구현 전 plan 기준 | `70d65c1` (설계 2턴 = `de8d15b` → `70d65c1`) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니다 — 설계 = Claude, 구현 = Codex(`Agent: codex`), 검증 = Claude |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립한다.** 설계 커밋 `70d65c1`과 구현 커밋 `72255c9`가 갈려 있고, 구현 커밋의 `plan.md` diff는 `[구현자 기입]` 6절(+62/-52줄)뿐이다.
- Decision Ledger 변경: **없음** — `git diff 70d65c1..72255c9 -- plan.md`의 hunk 시작이 `@@ -468,68` 하나이고 §3은 468줄 위다.
- Product/UX Contract 변경: **없음** — Part I(§1~§7) 무변경.
- AC 변경: **없음** — AC1~AC15 원문 그대로. 채점은 이 원문으로 한다.
- 0198 D-008의 부분 SUPERSEDED 표기는 **설계 커밋**(`de8d15b`)에 있다 — 규범 정정이 구현과 섞이지 않았다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 폭 축소 | 편집 key 하나만 무효화 | `engine.ts:46-49`가 canonical 반환 → `:56`·`:68`·`:76` 3채널 → `:38`·`:39` 2 sink |
| D-002 drop+replay 결합 | 호출자가 replay를 잊을 자리가 없다 | `runtime-catalog.ts:158-164` — `invalidate`가 `reconcile(authId, snapshotOf(authId))`를 await |
| D-003 열거 캐시 전체 유지 | add/delete가 목록에 반영 | `engine.ts:37`·`bootstrap.ts:627` 둘 다 `invalidateAll()` 유지 |
| D-004 fetch 횟수 확장 | 명시 invalidate당 1회 | `invalidate` 1회 → contribution당 `resolve` 1회(§7 재측정) |
| D-005 읽기 경로 network 0 | 턴은 cache만 | `turn-setup.ts:89` `cached(selected.key)` 불변 |
| D-006 빈 cache 미노출 | 실패는 행 소멸로 수렴 | `models.ts:105` 필터 + AC6·AC7 테스트 |
| D-008 remaining verified → 재조정 | gate가 아니어도 부팅에서 붙는다 | `auth-resume.ts:213-218` → `bootstrap.ts:407-409` → `bridge.onSnapshot` → `catalog.reconcile` |

### end-to-end 흐름 — 두 축 모두 도달한다

```text
[편집 축]  엔진&모델 저장 → orca:engine:{add,update,delete}
  → assertMutable(canonical) → {add,update,delete}HarnessSettings
  → refreshHarnessSettings(ctx, canonical) → deploy → invalidateAll
  → harnessRuntime.invalidate(canonical) → await catalog.invalidate(canonical)
  → targets 0 → entries 불변 → misc.ts:43 merge → 플러그인 행 유지 ✅

[부팅 축]  Bootstrap.start → deployExtensions
  → startRuntimeModelCatalogAfterDeploy(await invalidate → await attach → resumeAuth)
  → authResume.run() → gate resume(true) → AuthChange → bootstrap.ts:647 ✅ (불변)
  → startRemaining() → resume(false) ×P → probeTargets 재조회
  → verified && valid 만 reconcileVerified(id) → bootstrap.ts:408
  → bridge.onSnapshot → reconcile → resolve → entries → onChange ✅ (신설)
```

- 실패분은 `login.ts:354`가 내는 즉시 `expired` 한 경로로만 간다 — D-008 통지는 성공분만 담는다(AC14 테스트로 잠김).
- 회복 축(`recoverExpired`)도 이미 도달한다 — `refresh`/`relogin` 성공이 `store.put()`(`store.ts:252` `verified = true`) → `credential-committed` → `bootstrap.ts:647`. §10 표 밖의 세 번째 구멍은 없다.

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 설계대로 | replay의 `resolve` reject는 `runtime-catalog.ts:129-131` catch가 `drop`으로 접고 `invalidate`는 reject하지 않는다 |
| false success 가능성 | 없음 | `invalidate`가 replay Promise를 await하고, 세대 fence(`:114`·`:130`)가 낡은 결과의 publish를 막는다 |
| partial failure/rollback | 잔여 없음 | 메모리 캐시만 만진다. 실패는 "행 없음"으로 수렴(D-006) |
| Product/UX의 A가 아닌 B를 구현했는가 | 아니다 | D-001·D-002·D-008 모두 §9 TO-BE 블록과 1:1 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | `drop`이 `resolvedRevision`까지 지우고 replay가 같은 자리에서 다시 채운다 |
| 캐시 축소가 잃은 관측 | 있으나 대체됨 | CRUD의 전체 `harnessRuntime.invalidate`가 사라졌지만 `sourceRevision`(경로+mtime, `settings.ts:93`)이 key별로 miss를 만든다 — AC3 |
| 요청 worst-case 상한 | 늘지 않는다 | §7 재계산 |
| 재진입/경합 | 차단됨 | 연속 invalidate는 세대를 올려 이전 slot에 합류하지 않는다(`:102-110`) |
| `snapshotOf` 부작용 | 무해 | `bind().snapshot()`은 lazy-expiry(`runtime.ts:117-126`)라 `expired` change를 낼 수 있으나, 그 재진입 reconcile도 drop으로 수렴한다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 70d65c1..72255c9
```

| 후보 | 판정 | 근거 |
|---|---|---|
| `ResumeAuthDeps`·`AuthResumeHandle` 미사용 export | **정상** | 정의 파일 내부 시그니처용 타입. `bootstrap.ts:402`가 구조적으로 만족 |
| `gateOpen` test-only | **오탐** | `auth-resume.ts:239`·`:246`이 같은 파일 안에서 부른다 |
| `affectedRuntimeModelAuthIds` test-only | **오탐** | `runtime-model-startup.ts:32`가 같은 파일 안에서 부른다 |
| `invalidateRuntimeModelsForAuth` test-only | **오탐** | `runtime-model-startup.ts:49`(`createRuntimeModelAuthInvalidator`) → `bootstrap.ts:470` |
| 형제 정책 비대칭 | **0건** | 스크립트 (없음) |
| 신규 등록값의 기존 소비처 | **회귀 없음** | `snapshotOf`·`reconcileVerified` 두 필수 필드가 늘었고 소비처 전수(`bootstrap.ts:481`·`:407`, 테스트 fake 전부)가 typecheck로 닫혔다 |
| producer ↔ consumer 파생 불일치 | **없음** | 두 소비처(`misc.ts:43`·`turn-setup.ts:54`)가 같은 `merge`를 지난다 — 다만 AC11이 그 사실을 단언하지 않는다(§13 D3) |
| 동일 규칙 중복 구현 | **SSOT 유지** | `canonicalProviderKey`(adapter 인지) ↔ `canonicalAgentKey`(trim+lower). `${adapter}-${provider}` 입력에 대해 같은 결과 — `settings-entries.ts:85`의 `providerKeyOf`가 provider를 이미 lowercase로 만들어 두 축이 갈리지 않는다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 실재: `runtime-catalog.test.ts:207`(현 `:220`으로 의미 갱신됨)·`engine.runtime-catalog.test.ts:30`·`auth-resume.test.ts:346`(현 `:393` `P + 1` describe 3케이스) 전부 실재하고 green.
- 로컬 재구현 없음: 테스트가 `createRuntimeModelCatalog`·`createHarnessRuntimeConfigService`·`registerEngineHandlers`·`createAuthResume` **production 심볼**을 직접 부른다. 같은 이름의 로컬 사본은 0건.
- structural proxy만으로 통과한 AC: **없음** — AC4(인자 단언)는 AC1(행 존속, 실제 카탈로그 인스턴스)과 짝으로 있다.
- 동작 보존 추출 라운드인가: **아니오** — 동작이 바뀌는 라운드라 hunk 되돌림이 판정 근거가 된다.

### 이번 라운드 잠금 재측정 — 분모는 고친 hunk (r1이라 인용 변이 없음)

| # | 심은 변이(hunk 되돌림) | 검출 | 실패한 장치 |
|---|---|---|---|
| M-A | `engine.ts:38` `invalidate(key)` → `invalidate(undefined)` | ✅ | `engine.runtime-catalog.test.ts` **6케이스** |
| M-B | `engine.ts:39` `invalidate(key)` → `invalidate()` | ✅ | 같은 파일 **3케이스** |
| M-C | `assertMutable`이 canonical 대신 raw key 반환 | ✅ | 같은 파일 **2케이스**(add 채널은 미검출 — `providerKeyOf`가 이미 lowercase) |
| M-D | `runtime-model-startup.ts:83` `await` 제거 | ✅ | `runtime-model-startup.test.ts` **1케이스** |
| M-E | `invalidate`의 replay 2줄 제거 | ✅ | `runtime-catalog.test.ts` **4케이스** (typecheck·lint는 초록 — red가 잔여물이 아니다) |
| M-F | `inFlight` 합류가 generation 무시 | ✅ | `runtime-catalog.test.ts` **1케이스** |
| **M-G** | **`finally`의 slot 동일성 가드 → 무조건 delete** | **❌ 미검출** | **전체 스위트 2303/2303 green · typecheck 0 · eslint 0** |
| M-H | `auth-resume.ts:213-218` 통지 루프 제거 | ✅ | `auth-resume.test.ts` **1케이스** |
| M-I | `bootstrap.ts:407-409` 배선 **삭제** | ✅ | `typecheck:node` TS2345 — `reconcileVerified` 필수 필드 누락 |
| M-J | `bootstrap.ts:407-409` 배선 → **무동작 람다** | **❌ 미검출** | 전체 스위트 2303/2303 green · typecheck 0 |
| M-K | `bootstrap.ts:481` `snapshotOf` **삭제** | ✅ | `typecheck:node` TS2345 |
| M-M | 통지 루프의 `verified && valid` 필터 제거 | ✅ | `auth-resume.test.ts` **1케이스** |
| M-N | 성공 경로 세대 fence 제거(이 라운드가 옛 테스트를 대체한 자리) | ✅ | `runtime-catalog.test.ts` **2케이스** — 커버리지 회귀 없음 |

- **M-G 미검출은 §13 D1이다.** 되돌린 것이 이 라운드가 고친 hunk이고, 전체 스위트·정적 검사 어느 것도 반응하지 않는다.
- **M-G가 실제 결함을 만드는 것을 확인했다.** 임시 케이스(검증 후 삭제)로 재현 — invalidate 중 in-flight가 있는 상태에서 같은 세대 reconcile이 들어오면 가드 없이는 `resolve`가 **2회 기대에 3회**(`AssertionError: expected "vi.fn()" to be called 2 times, but got 3 times`)다. 즉 가드는 invalidate 직후 구간의 single-flight 합류(`coalesces concurrent verified events into one fetch`, `:101`)를 지키는데 그 구간을 보는 케이스가 없다.
- M-J 미검출은 **규칙 위반은 아니다**(hunk 삭제는 M-I가 typecheck로 잡는다). 다만 §10 7행이 "bootstrap 배선"을 강제 지점으로 세는데 그 지점은 *부재*만 닫혀 있고 *무동작*은 열려 있다 — §13 D2.
- `N회` 기준의 실제 관측 주체: `resolve` sink 호출 수(`runtime-catalog.test.ts:220`·`:259`), `pushConnectionState` fake 호출 수(`auth-resume.test.ts:393` describe).
- 순서 기준의 관측 훅: `startRuntimeModelCatalogAfterDeploy`의 5개 주입 인자(`runtime-model-startup.test.ts:12`) + await 정착(`:45`).

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 다른 key CRUD 뒤에도 contribution 행이 남는다(3채널) | ✅ | `engine.runtime-catalog.test.ts` `preserves a different runtime contribution after %s` ×3 — 실제 카탈로그 `list()` = `['claude-corp']`. M-A가 red | `orca:engine:*` → `refreshHarnessSettings` → `agent:list` |
| AC2 | 같은 CRUD 뒤 turn 후보 해석이 살아 있다 | ✅ | 같은 케이스의 `runtime.cached('claude-corp')`가 정의됨(실제 `createHarnessRuntimeConfigService`) | `turn-setup.ts:89` |
| AC3 | 편집한 provider 자신은 재해석된다 | ✅ | `runtime-config.test.ts:126` `settings 파일 외부 편집(mtime 변화)이 cache miss 로 이어진다`. 더해 `harnessRuntime.invalidate(canonical)`가 실제로 그 key state를 지운다 — `states`는 `entry.key`(=`providerKeyOf`, lowercase) 키라 canonical과 일치 | 다음 턴의 `resolve` |
| AC4 | 무효화 폭이 편집 key를 넘지 않는다 | ✅ | `invalidates only the canonical edited key after %s` ×3 — 두 sink 모두 `'claude-corp'` 인자 단언. 입력이 `' CLAUDE-Corp '`라 정규화도 함께 잠근다 | 위와 같음 |
| AC5 | `invalidate(key)`가 같은 호출 안에서 재조정한다 | ✅ | `replays a valid snapshot inside the same invalidation` — `resolve` 2회·`list()` 1개·`onChange` 3회. M-E가 red | `engine.ts:39`·`runtime-model-startup.ts:83` |
| AC6 | snapshot invalid면 replay가 되살리지 않는다 | ✅ | `keeps invalidated entries absent when the current snapshot is unusable` — `resolve` 1회 유지·`list()` `[]` | 로그아웃·만료 뒤 CRUD |
| AC7 | replay의 fetch 실패가 호출자에게 던져지지 않는다 | ✅ | `contains replay fetch failures...` — `resolves.toBeUndefined()` + `list()` `[]` | CRUD 중 네트워크 실패 |
| AC8 | 인자 없는 `invalidate()`도 replay한다 | ✅ | `replays every contribution during a full invalidation` — 2 owner·`resolve` 4회·행 2개 | `runtime-model-startup.ts:83` |
| AC9 | 부팅 5단계가 전부 await된 채 순서 유지 | ✅ | `runtime-model-startup.test.ts:12` 순서 배열 + `:45` await 정착. M-D가 red | `bootstrap.ts:626` |
| AC10 | `invalidate` 1회당 contribution별 `resolve` 최대 1회 | ✅ | AC5(2회 = 초기1+replay1)·AC8(4회 = 초기2+replay2) 두 케이스가 상한을 센다 | 위 두 호출자 |
| AC11 | 두 읽기 소비처가 같은 key 집합을 본다 | **⚠️** | **AC가 적은 검증 수단이 없다** — `rg "\.merge\(" src/main --glob '*.test.ts'` = **1건**(`runtime-catalog.test.ts:37`, 무필터/필터 비교 아님). 두 소비처는 각각 다른 인스턴스로만 확인되고 CRUD 뒤 상태는 어느 쪽도 단언하지 않는다 | `misc.ts:43`·`turn-setup.ts:54` |
| AC12 | remaining probe의 verified가 부팅 안에서 재조정에 도달 | ✅ | `remaining probe 성공분만 별도 재조정하고 실패분은 제외한다` — sink가 `'healthy'`로 1회. M-H가 red. **단 production 경로는 `createAuthResume` seam까지만 잠긴다**(M-J) | `authResume.run()` → bridge |
| AC13 | 복원 절차 자기 방송은 `P + 1` 불변 | ✅ | `P + 1` describe 3케이스(`:393`·`:411`·`:427`)가 수정 없이 green. 통지 sink는 `pushConnectionState`를 부르지 않는다 | `auth.md §5.2` |
| AC14 | probe 실패분은 통지에 담기지 않는다 | ✅ | 같은 케이스가 `toHaveBeenCalledOnce()` + `'healthy'`만. M-M이 red | `login.ts:354` |
| AC15 | gate 축 불변·중복 통지 없음 | ✅ | `gate 성공은 AuthChange 경로만 쓰고 remaining 재조정과 중복하지 않는다` — sink 0회 | `auth-resume.ts:239` → `bootstrap.ts:647` |

- **합계 재측정**: `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15`. 분모는 §7 표의 AC 행을 직접 세었다(AC1~AC15).
- **합계 사본 대조**: 구현자 본문 `15/15` ↔ 커밋 trailer `Criteria-Met: 15/15` ↔ INDEX 비고 `15/15` — **세 사본 일치**. 검증 결과와는 AC11 한 칸에서 갈린다(자기보고 ✅ ↔ 재측정 ⚠️).

### plan §10 강제 지점 표 — AC와 별개로 걸었다

| 계약/필드 | plan이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 무효화 폭 = canonical key | 5 | `engine.ts:56`·`:68`·`:76`(3채널) + `:38`·`:39`(2 sink) | **5/5** ✅ |
| drop과 replay는 한 동작 | 3 | `runtime-catalog.ts:158` 본체 + `engine.ts:39` + `runtime-model-startup.ts:83` | **3/3** ✅ |
| 열거 캐시 전체 무효화 유지 | 2 | `engine.ts:37`·`bootstrap.ts:627` (`rg "invalidateAll\(\)"` 5건 중 정의·주석 3 제외) | **2/2** ✅ |
| read-only 실행은 cache만 | 1 | `turn-setup.ts:89` `cached(selected.key)` | **1/1** ✅ |
| 무효화된 key는 두 UI에서 미노출 | 3 | `models.ts:105` 필터 + `misc.ts:43` + `turn-setup.ts:54` | **3/3** ✅ |
| 부팅 순서 | 2 | helper 본체 `runtime-model-startup.ts:81-85` + `bootstrap.ts:626` | **2/2** ✅ |
| `verified` 전이 → 카탈로그 재조정 | 6 | `rg "markVerified\|emitVerifiedChange" src/main --glob '!*.test.ts'` **9건** = 주석 2 + 시그니처 2 + store 정의 1 + 코드 4(`login.ts:345`·`:355`·`auth-resume.ts:210`·`:239`), 신설 2(`auth-resume.ts:213-218`·`bootstrap.ts:407-409`) | **6/6** ✅ (신설 1건은 *무동작*이 열려 있다 — D2) |

- 합계 재측정: `5+3+2+1+3+2+6 = 22` — plan 합계·구현자 보고 `22/22`와 일치.
- 표에 없는데 같은 불변식이 필요한 지점: **없음**. 불변식의 주어(`verified` 전이)로 훑으면 회복 축(`refresh`/`relogin`)이 남는데, 그쪽은 `store.put()`이 `verified`를 올리고 `credential-committed`가 `bootstrap.ts:647`에 이미 도달한다 — 표 밖 구멍이 아니다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: **없음** — 재측정 대상 0.
- 구현자가 §10 밖에서 선조치했다고 보고한 1곳(`inFlight` generation slot)은 실재하고 옳다. 다만 그 hunk의 절반이 잠기지 않았다(D1).

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RUNTIME_MODEL_CONTRIBUTIONS` (`app/deployment/harness-runtime.ts`) | 타입 불변 — `RuntimeModelContribution` 필드 무변경, `typecheck:node` green | 배포가 관측하는 의미 2건 변화(CRUD가 안 지운다 · gate가 아니어도 붙는다). 배포 코드 변경 요구 0 | ✅ |
| `docs/guides/closed-network-extensions.md` | 갱신 불요 | 두 변화 모두 배포가 *작성*하는 표면이 아니라 *관측*하는 결과 | ✅ |
| `docs/arch/backend/auth.md §5.2` | 순서 블록에 1줄 추가(`:398`) | 방송 상한 `P + 1` 문장 무변경 — `git show`로 확인 | ✅ 구현 커밋과 함께 갔다 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `catalog.invalidate` production 호출: **2** (`engine.ts:39`·`runtime-model-startup.ts:83`) — plan과 일치.
- `harnessRuntime.invalidate` production 호출: **3** (`engine.ts:38`·`bootstrap.ts:472`·`:628`) — 일치.
- `cached(` 소비처: **1** (`turn-setup.ts:89`) — 일치.
- `merge(`/`isReadOnly(` 소비처: **5행** = 인터페이스 선언 1 + `misc.ts:43` + `turn-setup.ts:54`·`:88` + `engine.ts:46`. plan의 "4"는 선언을 뺀 수로 같은 집합이다.
- **plan §8의 "`runtime.resolve(` production 호출 1건"은 좁은 술어다** — `harnessRuntime.resolve`를 부르는 `turn-setup.ts:90`이 정규식(`runtime\.resolve\(`)에 안 걸린다. 카탈로그 replay 상한(AC10)의 분모는 여전히 `runtime-catalog.ts:113` 하나라 판정은 바뀌지 않는다.
- 내역 합 = 총계: §10 22 ✅ · AC 15 ✅ (§5).
- 요청 상한: replay 1회당 `|영향받은 contribution|`회. CRUD 축 targets = 0(=`assertMutable`이 contribution key를 먼저 던진다)이라 **실사용 요청 수는 늘지 않는다**.
- 부팅 fetch 상한: `|probe 성공 remaining authId|` × `|그 authId 소유 contribution|`, `resolvedRevision` 조기 반환이 authId당 1회로 묶는다. 현재 값 0 → 증가가 곧 수정이다.
- 부팅 방송: 복원 절차 자기 push는 `P + 1` 불변(AC13 3케이스). **행이 실제로 바뀌면 `onChange` → `pushConnectionState`가 remaining 축에도 붙는다** — plan §14의 "증가 0"은 *복원 절차가 스스로 내는* 수를 말하고, 이 항은 `auth.md §5.2`가 "부팅 방송 총량은 상수가 아니다"로 열어 둔 자리다. 결함 아님.
- 0건 게이트의 정당한 예외: 해당 없음 — 이번 라운드가 만든 음성 스윕 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 편집 축 전체 | 실제 카탈로그·실제 runtime 서비스로 3채널 행 존속 | **없음** | — |
| 부팅 축 seam | `createAuthResume`의 통지 판정·필터·중복 | **없음(단 D2)** | — |
| bootstrap 컴포지션 배선 | 부재는 typecheck가 잡는다 | **없음 — 사람 실기가 아니라 기계 핸들이 남아 있다** | `infra/source-scan.ts` + `no-stray-auth-subscribe.test.ts`의 실재 가드 형태(0198 D-010 선례)로 잠글 수 있다 → D2 |

- plan §7이 "사람 실기 항목: 없음"이라 적었고 재검토 결과도 같다. D2를 사람에게 넘기지 않는다.

## 9. 게이트 재실행

- 적용한 정본: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` — 972 packages, postinstall이 better-sqlite3를 **Electron ABI**로 rebuild 성공.
- `npm run typecheck` → **3구성(node·web·test) 전부 출력 0줄**.
- `npm run lint` → `✖ 1 problem (0 errors, 1 warning)`. warning은 `useTranscriptVirtualizer.ts:22` react-compiler 기존 항목(이번 diff와 무관).
- `./node_modules/.bin/vitest run` (Electron ABI) → **227파일 / 2303케이스 · 5파일 red**. red 목록 = `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity` — `app/AGENTS.md`가 적은 **실측 5파일**과 같고 서명은 `Module did not self-register: better_sqlite3.node`다. 변경 무관.
- `npm rebuild better-sqlite3`(Node ABI) 후 재실행 → **2303/2303 케이스 green, 1파일 red**. 그 1파일은 `app/chat-turn.continuity.test.ts`로 `Error: Electron failed to install correctly` — **내가 electron 바이너리 다운로드를 건너뛴 결과**지 코드 결함이 아니다.
- `node --test scripts/*.test.mjs` → **59 pass / 0 fail**(7 suites).
- `node scripts/check-doc-inventory.mjs --check` → generated ok(9 items, 79 channels) · prose ok · links ok.
- **구현자 자기보고 `227파일/2305건`을 재측정으로 화해했다**: 2303 + `chat-turn.continuity.test.ts`의 **2케이스** = 2305. 구현자 환경은 electron 바이너리가 있었다. 수치 불일치 아님.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint`는 `--fix`라 파일을 쓰지만 실행 후 `git status --short`가 **빈 출력**이다. 검증자 실행분이 커밋에 섞이지 않았다.
- **검증 중 실행한 명령이 남긴 잔여물**: 없음. 변이 실험은 전부 `git checkout --`로 되돌렸고, 임시 케이스 파일(`__verify-tmp.test.ts`)은 삭제했다. 최종 `git status --short` 빈 출력.
- **exit code를 통과 증거로 쓰지 않았다** — 위 수치는 전부 실행 산출이다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 기록(§9) | — | 완료 |
| AC ↔ production path | 15행 1:1(§5) | — | 완료 |
| §10 강제 지점 | 22지점 재검색(§5) | — | 완료 |
| 변이 잠금 | 13변이(§4) | — | 완료 — 2건 미검출 |
| 문서 형식·링크·인벤토리 | `check-doc-inventory` | — | 완료 |
| D-007(OPEN) 표시 정책 | 판단 보조 | **결정** | 미해결 — 본 handoff는 D-007 없이 완결되므로 비차단 |
| 신규 의존성 | 0건 | — | 승인 불요 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 커밋은 `AGENTS.md`를 건드리지 않는다 — 해당 없음.

### INDEX 보드 정합성

- 상태/다음 주체: 구현 커밋이 `impl / IMPL_DONE / Claude(검증)`로 갱신했다 — 실제 상태와 일치했다. 이 커밋에서 `verify / FAIL / Codex`로 옮긴다.
- 「다음 주체」 칸: 주체 하나만 담는다 ✅.
- **대상 커밋 좌표를 검증자가 기입했다** — 자리표시자 `(r1 구현 — 검증자 기입)` → `72255c9`. `git cat-file -t 72255c9` = `commit`.
- plan 구현 보고 행은 `(r1 구현 — 좌표는 INDEX)` 자리표시자를 유지한다 ✅ (사본 1곳 원칙).
- 비고 5줄 이내 ✅.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- 구현 커밋 trailer 값이 허용값이다 — `Agent: codex` · `Handoff: docs/handoff/0202-.../` · `Status: implemented` · `Criteria-Met: 15/15` · `Verified-By: pending`.
- **실제 파싱된다** — `git log -1 --format='%(trailers:only=true)' 72255c9`가 5키를 그대로 돌려준다(0건 아님).
- 구현 커밋에 `Criteria-Pending`이 없다 — 자기보고가 15/15이므로 규약과 일치.
- 인용 커밋 해시 실재: `de8d15b`·`70d65c1`·`72255c9` 전부 `git cat-file -t` = `commit`.
- r1이라 재구현 라운드 7필드 검사는 해당 없다. 그럼에도 `[구현자 기입]` **6절이 전부 표/항목 형태로 채워졌고** 산문으로 접힌 필드는 0이다.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `inFlight`에 generation을 실었다(설계 대비 차이) | **타당 + 필요** — 단순 합류는 invalidate가 요구한 replay를 삼킨다. M-F가 그것을 재현 | 유지. 단 같은 hunk의 slot 동일성 가드가 미잠금(D1) |
| `assertMutable` 반환형을 `string`으로 (선조치 2) | **타당** — 3채널이 같은 canonical을 재사용하는 유일한 방법. M-C가 부분 검출 | 유지 |
| "공유 축 — AC8 전체 invalidate 2 owner replay green" | **부정확** — AC8 테스트의 두 contribution은 authId가 `gate`/`other-auth`로 **다르다**. 같은 owner 축은 `invalidates only the requested canonical contribution key`가 덮는다(둘 다 `gate`) | 결론은 같다(공유 축 무결). 근거 행만 교정 |
| "재진입 — stale pending 변이 테스트 red 확인" | **재현됨** (M-F) | 유지 |
| "AC 자기보고 15/15" | **14 ✅ · 1 ⚠️** — AC11의 검증 수단이 없다 | D3 |

## 13. 파생 이슈

- [ ] **D1 — `runtime-catalog.ts:132-135`의 slot 동일성 가드가 잠기지 않았다.** 이 라운드가 고친 hunk를 되돌려도(`inFlight.delete(contribution.key)` 무조건 실행) **전체 스위트 2303/2303 green · typecheck 0 · eslint 0**이다. 실제 결함은 재현된다 — invalidate가 만든 replay가 in-flight인 구간에 같은 세대 reconcile이 들어오면 가드 없이 `resolve`가 1회 더 돈다(관측: `expected "vi.fn()" to be called 2 times, but got 3 times`). 같은 owner의 형제 contribution이 그 구간에서 자기 slot을 잃는 경로도 같은 자리다. **대응 방향**: `runtime-catalog.test.ts`에 "invalidate 뒤 in-flight replay에 후속 reconcile이 합류한다"를 단언하는 케이스를 추가하고, 그 케이스가 이 hunk 되돌림에서 red가 되는 것을 보인다. 출처: SKILL §4(고친 hunk가 분모, 아무것도 실패하지 않으면 파생 이슈) · AC10 · §10 2행.
- [ ] **D2 — `bootstrap.ts:407-409`(그리고 `:481`)의 배선이 *부재*만 닫혀 있고 *무동작*은 열려 있다.** `reconcileVerified`를 `() => {}`로 바꾸면 typecheck·lint·전체 스위트가 전부 green이다(M-J). §10 7행이 이 지점을 강제 지점으로 세고 실패 의미를 "그 축의 contribution이 부팅에서 영영 안 붙는다"로 적었으므로, 삭제만 막는 잠금은 그 문장을 지키지 못한다. **대응 방향**: 0198 D-010이 만든 실재 가드 형태(`infra/source-scan.ts` + `app/no-stray-auth-subscribe.test.ts`)를 재사용해 `createAuthResume(` 인자에 `runtimeModelCatalogBridge.onSnapshot`이 실재하는지, `createRuntimeModelCatalog(` 인자에 `snapshotOf`가 실재하는지를 production 파일에서 스윕한다. 가드를 만들면 **판정 지점마다 변이를 심어** 눈이 있음을 먼저 보인다. 출처: §10 7행 · AC12 production path.
- [ ] **D3 — AC11의 검증 수단이 존재하지 않는다.** AC11은 "같은 카탈로그 인스턴스로 `merge()`(무필터)와 `merge(settings,'claude')`를 비교"라 적었으나 `rg "\.merge\(" src/main --glob '*.test.ts'`가 **1건**(`runtime-catalog.test.ts:37`, 필터 단독 케이스)뿐이다. 두 소비처는 서로 다른 인스턴스의 별개 스위트에서만 확인되고 **CRUD 뒤** 상태는 어느 쪽도 단언하지 않는다. 자기보고는 이 칸을 ✅로 셌다. **대응 방향**: `engine.runtime-catalog.test.ts`의 "preserves a different runtime contribution" 케이스에서 CRUD 뒤 같은 인스턴스로 `merge(settings)`와 `merge(settings,'claude')`의 key 집합이 같음을 단언한다. 출처: AC11.

- **규범 정정 필요 없음** — D1·D2·D3 모두 테스트·가드 추가로 닫힌다. Decision·AC·§10 문면을 고칠 필요가 없으므로 **다음 주체는 구현자**다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** 0201 r1의 FAIL 근거도 "이번 라운드가 만든 장치가 스스로를 잠그지 않는다"였고, 0198 r5·r7도 같은 축이었다. 0202 r1은 그중 **hunk 미잠금**(D1) 한 형태다.
- 관련 plan 지침/AC의 존재 여부: **있었다.** plan §7 방향 기준이 AC5·AC12에 대해 "지웠을 때 실패해야 한다"를 명시했고 그 둘은 실제로 잠겼다(M-E·M-H). 미잠금은 **plan이 지목하지 않은 선조치 hunk**(D1)와 **컴포지션 seam**(D2)에서 나왔다.
- 사용자 결정 변경 근거: **없음** — Decision Ledger 무변경.
- 반복된 검증 환경 한계: **있다.** `bootstrap.ts`가 vitest 대상이 아니라는 제약(0198 D-010)이 0202에서도 같은 자리에 미검출을 만들었다(D2). 이번 환경 자체의 한계는 electron 바이너리 미설치 1건이며 `chat-turn.continuity.test.ts` 2케이스만 못 돌렸다.
- 현재 라운드 수: 1 (다음 재구현은 r2)

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: **✅ 전건.** 편집 축·부팅 축이 모두 end-to-end로 도달하고 D-001~D-006·D-008이 production path에서 성립한다. 이번 코드에서 **재현 가능한 제품 결함은 찾지 못했다**.
- AC 충족: **✅14 · ⚠️1 · ❌0 / 15** — ⚠️는 AC11(검증 수단 부재).
- 강제 지점: **22/22** 재측정 일치. 표 밖 누락 0.
- 기준 밖 결함: **D1** — 이번 라운드가 고친 hunk 하나가 전체 스위트·정적 검사 어느 것에도 잡히지 않는다. FAIL 근거는 점수가 아니라 이 미잠금이다.
- repository operation checks: trailer 파싱 5키 · 좌표 실재 · doc-inventory green · 게이트가 트리를 바꾸지 않았다 — 미스매치 0.
- 남은 사람 확인: **없음.** D-007(OPEN)은 이 handoff의 완결 조건이 아니다.
- 다음 단계: **구현자가 D1·D2·D3를 닫고 r2로 돌아온다.** 규범 행 정정은 필요 없다.
