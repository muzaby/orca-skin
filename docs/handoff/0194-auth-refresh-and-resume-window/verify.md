# Verify — 0194-auth-refresh-and-resume-window

# r5 — 2026-08-21 · **PASS**

> r1~r4 판정 원문은 아래에 그대로 둔다. 이 절은 **r5 에서 달라진 것만** 적는다.

## 메타 (r5)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `ca48f59..0a56959` (구현 `c77ecd4` · 보드 `14ad93b` · 자기정정 `3c1e9b0`·`3eff24e`·`0a56959`) |
| 구현 전 plan 기준 | `ca48f59` — **이번 라운드도 diff 로 성립한다** |
| 라운드 | 5 |
| 상태 | **PASS** |
| 다음 주체 | **사람** — D21 제품 결정 |
| 자기 검증 여부 | 예 — 설계·구현·검증이 모두 Claude Code |

**한 줄 판정**: D19·D20 이 둘 다 실제로 닫혔고 **AC 24/24 ✅ · 강제 지점 23/23** 을 내 기준으로 다시
세어 일치하며 repository operation mismatch 가 없어 PASS 다. D20 이 드러낸 유실은 내가 **구현자와
다른 경로**(`markExpired` → JSON → 파서 → `status()`)로 재현했고 수정 전 파서에서 2건 실패한다.
남은 3건(W1·W2·W3)은 관측 부족이고 코드 결함 0건이라 PASS 를 막지 않는다. **D21 은 이번 수정이
만든 제품 결과**라 사람이 고른다 — 결함이 아니다.

## 0. 기준선 (r5) — 성립한다

규범 행 정정(`ca48f59`)과 구현(`c77ecd4`)이 갈렸다. §0 의 자기 증명 방지 장치가 작동한다.

- **구현 커밋의 `plan.md` diff 에 §7·§3·§10 hunk 가 0건**이다 — 메타 상태 줄과 `[구현자 기입] r5`
  절만 늘었다(`git show c77ecd4 -- …/plan.md` 의 hunk 2개).
- **Decision Ledger 무변경** — 두 커밋 모두 §3(31~56행)에 hunk 가 없다. SUPERSEDED 0.
- 설계 커밋이 고친 규범 행은 **AC18 · AC24 신설 · §10 8행 · §16 방송 상한 행** 넷이고, AC18 은
  기준을 **좁히는** 방향이다(총량 단언을 버리고 자기 push 로 범위 축소).
- **IMPL_DONE 뒤 §10 8행을 한 번 더 고쳤다**(`0a56959`, `Status: implemented`). 바뀐 것은 술어
  전수의 **관측 수치**(22 → 25 · 12 → 15)뿐이고 **지점 수 6 · SSOT · 실패 의미는 동일**하다 —
  내가 현재 트리에서 다시 세어 25 = 6/15/3/1 을 얻었다(§5 표 8행). 채점 기준은 바뀌지 않는다.
- 채점 기준은 `ca48f59` 시점의 §7 **24행**이다.

## 1~3. 구현 비판적 읽기 / 역방향 (r5)

- **프로덕션 실행 경로 변경은 `parseGrant` 한 곳뿐이다** — `store-parse.ts:43-96`. 나머지 diff 는
  테스트 2파일·`auth.md` 문면·plan 이다(`git diff --stat ca48f59..HEAD` → 6파일).
- **token 분기의 semantics 는 불변이다.** 옛 코드의 4개 조건부 스프레드와 새 `compact` 인자가 같은
  판정을 쓴다(`typeof === 'number'|'string'` → 아니면 드롭). 내 스크래치 4케이스가 secret·session·
  token 전 필드 왕복과 `principalId: ''` 보존을 단언해 통과했다.
- **secret·session 분기는 semantics 가 바뀐다 — 그것이 이번 수정이다.** `expiresAt` 을 이제 읽는다.
- **false success 가능성 — `compact` 의 `as T`**: 필수 필드(`vaultKey`·`sessionGroup`·`authKind`·
  `createdAt`)는 리터럴 앞의 가드가 이미 좁혀 런타임에 `undefined` 가 될 경로가 없다.
- **`numberOr`·`stringOr` 는 중복 구현이 아니다** — `rg "const stringOr|asString" app/src` → 이 파일
  2건뿐이고 `shared/obj.ts` 에 같은 역할의 함수가 없다.
- **`Extract<Grant, …>` 별칭 3개는 `login.ts:45-47`·`authenticated-request.ts:43-44` 의 기존 관례를
  따른다** — 새 SSOT 를 만들지 않는다(타입 별칭이라 drift 할 값이 없다).
- **scan-surface(`ca48f59..HEAD`)** — 미사용 export 0 · test-only 참조 0 · 형제 정책 비대칭 0.
- **키 순서 변경이 소비처에 닿지 않는다** — grant 비교는 참조 동일성이다(`store.ts:460`·`:467`).

## 4. 구현 보고 재측정 — 보고를 증거로 쓰지 않는다

| 보고 | 재측정 | 결과 |
|---|---|---|
| 강제 지점 `23/23` | 2+1+2+1+1+2+1+6+1+3+1+2 = **23**, 좌표 전건 실재 | ✅ 일치 |
| 술어 전수 `25건 = 6/15/3/1` | 같은 명령 → 25건. 내가 직접 분류해 조립 6 / 타입 선언 15 / `AuthResult` 3 / 요청 plan 1 | ✅ 일치·미분류 0 |
| sink 프로덕션 호출부 **4곳** | `rg -n "pushConnectionState" app/src/main --glob '!*.test.ts'` → 호출 4(`bootstrap:375`·`auth-resume:210`·`:219`·`settings-reactions:34`) + 정의/전달/타입 4 | ✅ I13 이 옳다 (r4 의 "2곳" 은 클로저를 넘기는 자리를 셌다) |
| vitest `206파일 · 2,027케이스 · 1,985/42` | 실행 관측 동일 | ✅ 일치 |
| 케이스 `+3`(store-parse 15 → 18) | 그 파일 단독 실행 **18 케이스** · `it(` 블록 8 → 11 | ✅ 합 3 |
| 관련 스위트 `55파일 / 522케이스` | `Test Files 1 failed · 54 passed (55)` · `Tests 522 passed` | ✅ 일치(1파일은 electron 부재 로드 실패) |
| 합계 사본 | 본문 `24/24` ↔ trailer `Criteria-Met: 24/24` ↔ INDEX `AC 24/24` | ✅ 세 사본 일치 |
| AC 분모 24 | `awk '/^## 7\. Acceptance/,/^### AC 검증/' plan.md \| grep -cE "^\| AC[0-9]+ \|"` → **24**(AC1~AC24 연속, 결번 0) | ✅ 일치 |

## 5. AC 재검증 — 이번 라운드가 건드린 행

| # | 결과 | 재측정 관측 |
|---|---|---|
| AC1~AC17 · AC19 · AC21~AC23 | ✅ 유지 | 관련 **55파일 522/522 green**. 실행 변경은 `parseGrant` 하나이고 token 분기 semantics 동일(§1) |
| **AC18** | ✅ | describe 가 `자기 push 는 P + 1` 로 개명됐고 3케이스 기대값 2/4/1 이 각각 `자기 push` + `resume 이 낸 change` 로 갈려 적혔다. ①은 내 변이 3건이 잠근다(§6) |
| AC20 | ✅ | `auth.md:366-378` 총량 단언 삭제 · 흐름 블록 `:358` 한 줄 · `check-doc-inventory --check` **3줄 ok**. 총량 식 전수 `rg "P \+ K \+ 1\|1 \+ K\|P \+ K"`(archive·handoff 제외) → **0건** |
| **AC24** | ✅ | 구현자 fixture 와 **다른 경로**로 재현했다 — `markExpired` → `JSON.parse(JSON.stringify())` → 파서 → `restore` → `status()` 가 secret·session 둘 다 `expired`(스크래치 2케이스). 같은 테스트가 `ca48f59` 의 파서에서 **2건 실패** |

- **합계 재측정**: `✅ 24 · ⚠️ 0 · ❌ 0 = 총 24`. 분모 24 는 위 §4 명령으로 직접 셌다.
  r4 의 23 과 직접 비교하지 않는다(AC24 신설).

### plan §10 강제 지점 표 (r5) — AC와 별개로 걷는다

| # | 계약/필드 | plan 지점 | 내가 확인한 좌표 | 결과 |
|---|---|---|---|---|
| 1 | 회복 대상 = `expired` | 2 | `auth-resume.ts:118` 루프 머리 · `:180` 회복 필터 — 둘 다 `demoted()` | 2/2 ✅ |
| 2 | refresh 가능 판정 한 곳 | 1 | `login.ts:367-379` 4판정이 한 함수 안 · `auth-resume.ts:154-170` 은 결과만 본다 | 1/1 ✅ |
| 3 | refresh 1회 · 재로그인 3회 | 2 | `refreshOnce`(`:154`) 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:50`)+루프(`:116`) | 2/2 ✅ |
| 4 | probe 통과 후에만 커밋 | 1 | `login.ts:413` `settleGrant` | 1/1 ✅ |
| 5 | 새 세대 키 2개 | 1 | `login.ts:867-876` `writeVault` | 1/1 ✅ |
| 6 | `refreshExpiresAt` 영속 | 2 | ① `login.ts:858` 쓰기 ② `store-parse.ts:78` 파싱 — 각각 변이 1건씩이 검출(§6) | 2/2 ✅ |
| 7 | 미회전 시 값 승계 | 1 | `login.ts:401` `const carried` | 1/1 ✅ |
| 8 | **grant 조립 6지점** | 6 | `login.ts:608`·`:788`·`:847` · `store-parse.ts:59`·`:70`·`:84` — VMV-1 이 **정확히 이 6좌표**를 깬다 | 6/6 ✅ |
| 9 | `compact` 인자 시그니처 | 1 | `obj.ts:48` `source: CompactSource<T>` | 1/1 ✅ |
| 10 | `resuming` 파생 | 3 | `bootstrap.ts:367` · `handlers/providers.ts:47` · `rootFrame.ts:36` | 3/3 ✅ |
| 11 | `remainingSettled` 는 `finally` | 1 | `auth-resume.ts:213` `} finally {` → `:216` — VMV-C' 가 1건 검출 | 1/1 ✅ |
| 12 | 판정·상태의 문서 사본 | 2 | `plan.md:11` · `INDEX.md:21` 둘 다 `IMPL_DONE (r5)` | 2/2 ✅ |

- **합계 23/23.** plan 기재 23 ∖ 닫힌 23 = 0 · 닫힌 23 ∖ plan 23 = 0.
- **표에 없는데 같은 불변식이 필요한 지점 — 0건.** 술어를 한 단계 넓혀 다시 확인했다:
  `Grant` 를 돌려주거나 조립하는 자리를 `: Grant`·`<Grant>`·`as Grant`·`...grant` 로 훑으면
  `parseGrant` 와 `login.ts` 조립 3곳 외에 `store.ts:382` `{ ...grant, expiresAt }` 뿐이고,
  그것은 기존 grant 를 고치는 자리라 필드를 잃을 수 없다.

## 6. 더 좁힌 기준 — 내가 심은 변이 8건

> 구현자가 이번 라운드에 만든 검사 장치(파서 3분기·`store-parse.test.ts` 3케이스·개명한 describe)는
> 그 자체가 검증 대상이다. 같은 변이를 다시 돌리는 것은 재현이므로 **기준을 좁혀** 다시 심었다.

| 변이 | 좁힌 지점 | 관측 산출 | 판정 |
|---|---|---|---|
| VMV-1 `GrantBase` 에 **필수** `zzTenant: string` | MV-1 은 선택 필드였다 | `typecheck` → 깨진 좌표 **정확히 6개**, 그 밖 0 | ✅ 분모가 전수다 |
| VMV-2 **token 갈래에만** `zzScope?` | 공유 base 가 아니라 갈래별 감도 | `login.ts:847` · `store-parse.ts:70` **2좌표** | ✅ 쓰는 쪽·읽는 쪽 짝 |
| VMV-3 **session 갈래에만** `zzJar?` | 같음 | `login.ts:788` · `store-parse.ts:84` **2좌표** | ✅ 같음 |
| VMV-4 파서 6필드를 하나씩 `undefined` 로 | MV-2·MV-3 은 2필드였다 — 나는 **전 필드**를 돌렸다 | secret.expiresAt **1** · session.expiresAt **2** · token.expiresAt **1** · refreshKey **2** · refreshExpiresAt **1** 실패 | ✅ 5/6 검출 · `principalId` 만 0 → **W1** |
| VMV-5 batch push 를 무조건으로 | MV-4 와 같은 자리 | `auth-resume.test.ts` **3 실패**(상한 describe 의 P=0 케이스 포함) | ✅ `P` 항이 잠겨 있다 |
| VMV-6 종료 push 삭제 | 구현자가 심지 않은 자리 | **12 실패** (상한 3케이스 전부 포함) | ✅ `+1` 항이 잠겨 있다 |
| VMV-7 종료 push 를 `probeTargets.length > 0` 로 | `+1` 의 **무조건성**만 | **41 실패** | ✅ |
| VMV-8 `remainingSettled` 를 `finally` 밖으로 | §10 11행 | **1 실패**(`배치가 예외로 끝나도 거둬진다`) | ✅ |

- 여덟 건 모두 원복했다. 확인: `git status --short` 빈 출력 · 전체 재실행 산출이 §8 과 같다.
- **W1 — 파서의 `principalId` 에는 런타임 눈이 없다.** `stringOr(record.principalId)` 를 통째로
  `undefined` 로 바꿔도 관련 **502 케이스가 전건 통과**한다(`rg -ln "principalId" app/src --glob '*.test.ts'`
  → `login.test.ts`·`runner.test.ts`·`connection-views.test.ts` 3파일, 파서 경로 0건).
  **코드는 옳다** — 내 스크래치가 세 갈래의 왕복을 단언해 통과했다. 빠진 것은 눈이다.
  §10 8행이 요구하는 것은 *컴파일 타임* 강제이고 그것은 VMV-1 로 성립한다.

## 7. 숫자 / 상한 재측정 (r5)

- **총량을 단언하는 문장이 저장소에 남지 않았다** — `rg "P \+ K \+ 1|1 \+ K|K \+ 1|P \+ K" docs app`
  (archive·handoff 제외) → **0건**. `방송 상한` 인용 9건은 전부 정본 포인터이거나 `강등 항 K` 서술이다.
- **AC18 ②("그 밖은 change 하나당 1회")는 프로덕션에서 참이다** — `bootstrap.ts:374-375` 의
  `auth.subscribe` 가 조건 없이 `pushConnectionState()` 를 먼저 부르고, 그 뒤에야 `credentialChanged`
  로 갈라진다. **기계 눈은 없다**(→ W3).
- **`settings-reactions.ts:34` 은 복원 창 밖이 맞다** — `registerSettingsReactions` 는 사용자의
  `authBypass` 패치에만 발화하고(`bootstrap.ts:503` 등록), 복원 중 화면은 `BootScreen` 이라 그
  토글에 손이 닿지 않는다. AC18 이 총량을 안 세므로 판정에 영향도 없다.
- **시도 상한 불변** — refresh 1 + 로그인 3 = Auth 당 `4N`. r1 계산 그대로다.
- **파서의 worst-case 는 레코드 수 선형** — 분기마다 상수 필드이고 재귀가 없다.

## 8. 게이트 재실행 (r5)

정본은 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`다. **`npm test` 를 쓰지 않았다** —
이번 변경에 DB 동작이 없다.

| 명령 | 관측한 실행 산출 |
|---|---|
| `npm run typecheck` | node·web·test **3/3** · 출력의 `error TS` 줄 **0** |
| `npm run lint` | **0 errors, 1 warning**(`useTranscriptVirtualizer.ts:22:10`, 0102 베이스라인) |
| `./node_modules/.bin/vitest run` | **206파일 / 2,027케이스** · `1,985 pass / 42 fail` |
| `./node_modules/.bin/vitest run src/main/features/auth src/main/app src/renderer/src/app src/shared` | **55파일(54 pass/1 load-fail) / 522 pass** |
| `node --test "scripts/*.test.mjs"` | `# tests 49 # pass 49 # fail 0` |
| `node scripts/check-doc-inventory.mjs --check` | `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` |

- **환경 기인 실패 분리 — 파일 집합이 `app/AGENTS.md` 의 알려진 5파일과 정확히 같다**:
  `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` ·
  `app/chat-turn.continuity`. 차집합 양방향 0.
- **서명도 확인했다** — `Could not locate the bindings file`(better-sqlite3) ·
  `Electron failed to install correctly`(continuity). 둘 다 네이티브 부재이고 변경 무관이다.
- **게이트가 작업 트리를 바꿨는가: 아니오.** `npm run lint`(`--fix`) 실행 직후 `git status --short`
  빈 출력이다.
- **검증 중 잔여물: 없음.** 스크래치 테스트 2파일(`zz-verify-scratch*.test.ts`)은 관측을 마치고
  삭제했고 최종 `git status --short` 는 비어 있다. 뮤테이션 8건도 전부 원복했다.

## 9. Repository operation checks (r5)

- **INDEX 보드** — 21행이 `impl` · `IMPL_DONE (r5)` · 다음 주체 **Claude(검증)** · 대상 커밋
  `c77ecd4` · 라운드 5 로 실제 상태와 맞다. 비고는 524자(0193 행 475자와 같은 급)로 5줄 이내다.
- **AGENTS.md 변경 0건** — 이번 range 에 `AGENTS.md` hunk 가 없다.
- **커밋 trailer** — 구현 `c77ecd4` 는 `Agent: claude` + `Status: implemented` + `Criteria-Met: 24/24`
  + `Verified-By: pending` 로 root `AGENTS.md` 표를 따른다. `Next-Action` 없음 ✅(검증 커밋 전용).
- **자기정정 3커밋**(`3c1e9b0`·`3eff24e`·`0a56959`)은 `Criteria-*` 를 붙이지 않았다 — r3 의 D16 이
  지적한 형태가 재발하지 않았다.
- **인용 해시 전건 실재** — plan 이 인용하는 10개 해시를 `git cat-file -e` 로 확인해 죽은 좌표 0건.
  r5 가 `2cb2723`(amend 전 객체)을 `ca48f59` 로 고친 것(`3c1e9b0`)이 실제로 반영돼 있다.
- **reference/script 이동·삭제 0건.**

## 10. 파생 이슈 — PASS 를 막지 않는 관측

- **W1** — 파서의 `principalId` 에 런타임 눈이 없다(§6). 케이스 1건이면 닫힌다. 코드는 옳다.
- **W2** — `auth-resume.test.ts:763` 케이스 **제목**이 폐기된 어휘를 남긴다("probe 단계 방송 상한도
  그대로다"). 같은 케이스의 본문 주석은 새 문면(`P=0·K=0` · 종료 push 1회)으로 고쳐져 있다.
- **W3** — AC18 ②는 `bootstrap.ts:374-375` 를 읽어서만 확인된다. 그 파일은 electron 을 물어
  vitest 대상이 아니고, AC 자신이 "이 describe 가 잠그는 것은 ①과 `K` 까지" 라고 범위를 적었다.
- **D21·D22** 는 `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관했다 — D21 은 **사람 결정**이다.

## 11. Review Signals (r5) — 사실만

- **이전 라운드와 같은 축인가: 아니오 — 두 축이 이번에 끊겼다.** *횟수 문면*은 D3(r3) → D11·D12(r4)
  → D19(r5) 로 5라운드 연속이었는데, 이번 라운드에 그 축의 신규 지적이 **0건**이다(총량을 고치는
  대신 버렸다). *지점 과소계수*도 0193 이후 6연속이었는데 §10 전수를 넓힌 술어로 다시 세어 **0건**이다.
- **W1 은 그 두 축이 아니다.** 분모가 좁은 것도 문면이 틀린 것도 아니고, 닫힌 지점 안의 **한 필드에
  런타임 케이스가 없는** 것이다 — D2(r1)·D9(r2)와 같은 "눈 없음" 계열이고, 그 둘은 각각
  다음 라운드에 케이스를 더해 닫혔다(D2 → r2 에서 3케이스 실패 · D9 → r3 에서 1케이스 실패).
- **관련 plan 지침의 존재**: AC18 이 "관측 지점이 모형하지 않는 호출부" 를 명시하고 §10 8행이
  "분모의 술어는 불변식의 주어" 를 명시한다 — 둘 다 review round 14(`9082583`)가 만든 조항이고
  r5 가 첫 적용이다. 이번 검증에서 그 두 조항이 **반증 시도를 통과했다**(VMV-1·VMV-4).
- **사용자 결정 변경 근거**: 없음. Decision Ledger 는 D-001~D-014 그대로이고 SUPERSEDED 0건이다.
- **반복된 검증 환경 한계**: 네이티브 바인딩 부재로 5파일 42케이스 red — r1~r4 와 같은 파일 집합.
  이 컨테이너는 `node_modules` 가 이미 설치돼 있어 r5 구현 턴과 달리 설치 단계가 없었다.
- **검증자 자신의 과거 오관측**: r4 가 sink 호출부를 2곳으로 셌다(실제 4곳, `settings-reactions.ts:34`
  누락). 판정은 바뀌지 않지만 D17 과 같은 축이다 — 이번에는 명령 산출을 그대로 옮겨 적었다.

## 12. 결론 (r5)

- 상태: **PASS**. 다음 주체 = **사람**(D21 결정) — 그 결정 전까지 보드 행을 archive 로 옮기지
  않는다(0192·0193 선례).
- Product/UX: 대기 화면·창 없는 refresh·만료 grant 회복 세 흐름이 전부 production path 로 닫혔다.
  ACTIVE Decision D-001~D-014 와 충돌 0.
- AC: **24/24 ✅**. 분모를 직접 세었고 자기보고와 일치한다.
- 강제 지점: **23/23**. 좌표를 다시 세고 8건의 변이로 감도를 확인했다.
- 기준 밖: W1·W2·W3(관측 부족) · D21(제품 결정) · D22(문서 정정). **코드 결함 0건.**
- 남은 사람 확인: **D21 하나** — 값형 연결의 만료가 재시작을 넘게 되면서 자동 회복 경로가 0이 된다.
  실기 항목은 없다(`dev`/`build` 는 egress 차단이라 CI·사람 몫이라는 기존 경계 그대로다).

---

# r4 — 2026-08-21 · **FAIL**

> r1~r3 판정 원문은 아래에 그대로 둔다. 이 절은 **r4 에서 달라진 것만** 적는다.

## 메타 (r4)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `41b7050..eaa3333` (설계 `23ac69f` · 구현 `ae882b1` · 보드 `eaa3333`) |
| 구현 전 plan 기준 | `23ac69f` — **이번 라운드는 diff 로 성립한다** |
| 라운드 | 4 |
| 상태 | **FAIL** |
| 다음 주체 | **Claude** (설계 — 규범 행 정정 1건) |
| 자기 검증 여부 | 예 — 설계·구현·검증이 모두 Claude Code |

**한 줄 판정**: D11~D16 여섯 건은 전부 실제로 닫혔고 강제 지점 20/20 도 재측정으로 일치하지만,
**AC18 과 정본 `auth.md §5.2` 가 말하는 `P + K + 1` 이 프로덕션 부팅 방송 총량이 아니다** — 0194 가
새로 만든 refresh 회복 성공 경로가 같은 `pushConnectionState` 를 2회 더 부른다(D19). AC18 문면이
코드와 어긋나는 것은 **4라운드 연속**이고, 이번에는 조건부 항 `P` 가 아니라 **회복 항**이 빠졌다.

## 0. 기준선 (r4) — 성립한다

r3 과 달리 규범 행 정정(`23ac69f`)과 구현(`ae882b1`)이 갈렸다. §0 의 자기 증명 방지 장치가 작동한다.

- **AC 변경은 설계 커밋에만 있다** — `git show ae882b1 -- …/plan.md` 의 삭제 줄 8개 중 §7 AC 행은 0건.
- **구현 커밋이 §10 에서 바꾼 것은 문면 2군데뿐** — `위 3지점 전부` → `위 행의 3지점 전부` ·
  `시그니처 1지점` → 볼드. 지점 수·SSOT·실패 의미 불변.
- **Decision Ledger 무변경** — 두 커밋 모두 §3(11~56행)에 hunk 가 없다. SUPERSEDED 0.
- 설계 커밋이 고친 AC 는 **AC18 한 행**이고 자기 이롭지 않다(2케이스 → 3케이스로 기준을 늘렸다).
- 채점 기준은 `23ac69f` 시점의 §7 23행이다.

## 1~3. 구현 비판적 읽기 / 역방향 (r4)

- **실행 경로 변경은 두 곳뿐이다** — `secretCandidate`(`login.ts:608`)·`absorb` 의 session
  case(`:788`)가 `ifPresent` 누적에서 `compact` 리터럴로 바뀌었다. 나머지 diff 는 타입·테스트·주석·문서다.
- **두 조립의 키 집합과 삽입 순서가 옛 코드와 같다** — 옛 `{kind, vaultKey, authKind, createdAt,
  ...ifPresent('principalId')}` ↔ 새 리터럴에서 `expiresAt: undefined` 만 `compact` 가 드롭한다.
  `Object.entries` 순회라 순서도 같다. grant 를 `JSON.stringify` 로 비교·해싱하는 소비처는 0건
  (`rg -n "JSON.stringify" src/main/features/auth src/main/app --glob '!*.test.ts'` → `handlers/log.ts` 1건, grant 무관).
- **false success 가능성 — `compact` 의 `as T`** 는 런타임 `null` 을 여전히 감춘다(구현 S6 와 같은 판정).
  프로덕션 호출부 3곳이 전부 리터럴이라 현재 도달 경로가 없다.
- **scan-surface(`23ac69f..eaa3333`)** — 미사용 값 export 0 · 형제 정책 비대칭 0. `CompactSource` 가
  "테스트에만 등장" 으로 잡히나 **오탐**이다: 프로덕션 참조는 같은 파일의 `compact` 시그니처(`obj.ts:48`)
  이고 `obj.test.ts` 는 이름을 주석에서만 쓴다.
- **`CompactSource` 를 export 할 필요는 없다** — 외부 소비처 0건이다. 결함이 아니라 표면 메모다.

## 4. 구현 보고 재측정 — 보고를 증거로 쓰지 않는다

| 보고 | 재측정 | 결과 |
|---|---|---|
| 강제 지점 `20/20` | 2+1+2+1+1+2+1+3+1+3+1+2 = **20**, 좌표 전건 실재 | ✅ 일치 |
| 프로덕션 `compact` 호출부 3 | `rg -n "compact<" src \| grep -v '\.test\.'` → `obj.ts:48`(정의) + `login.ts:608·788·847` | ✅ 일치 |
| `1 + K` 사본 0건 | 더 넓은 기준(`rg "방송 상한"` 전 저장소)으로 재측정 → 10건 전부 정본 인용·상대 서술 | ✅ 숫자 사본 0 |
| vitest `1,982/2,024` · 206 파일 | 실행 관측 동일 | ✅ 일치 |
| 케이스 `+13` | `obj.test.ts` **10** · `login.test.ts` 50→**52** · `auth-resume.test.ts` +1 | ✅ 합 13 |
| 합계 사본 | 본문 `23/23` ↔ trailer `Criteria-Met: 23/23` ↔ INDEX `AC 23/23` | ✅ 세 사본 일치 |
| D17(r3 검증자의 `.resuming` 오관측) | `git grep -n "\.resuming" 3371df2 -- app/src/renderer/src` → **5줄 / 4파일** | ✅ 구현자 정정이 옳다 |

- **자기보고와 갈리는 것은 AC18 한 행**이다 — 구현자 `✅ 23`, 내 채점 `✅ 22 · ⚠️ 1`. 근거는 §5·§7.

## 5. AC 재검증 — 이번 라운드가 건드린 행

| # | 결과 | 재측정 관측 |
|---|---|---|
| AC1~AC17 · AC19 · AC21~AC23 | ✅ 유지 | 관련 55파일 **519/519 green**(1파일은 ABI). 실행 변경 2곳의 semantics 동일을 §1 에서 확인 |
| **AC18** | ⚠️ | 3케이스는 실재하고 `P`·`K`·`+1` 을 각각 가른다. **문면이 프로덕션 총량과 다르다** — D19 |
| AC20 | ✅ | `auth.md:306`·`:356`·`:365-368` 갱신 · `closed-network-extensions.md §3-b`·`IPC_CONTRACT.md` 무변경이 정당(둘 다 횟수 문장이 없다, `rg -n "resuming\|상한" docs/IPC_CONTRACT.md`) · `check-doc-inventory --check` 차이 0 |

- **합계 재측정**: `✅ 22 · ⚠️ 1 · ❌ 0 = 총 23`. 분모는
  `awk '/^## 7\. Acceptance/,/^### AC 검증/' plan.md | grep -cE "^\| AC[0-9]+ \|"` → **23**.
  r3 과 분모가 같다.

### plan §10 강제 지점 표 (r4) — AC와 별개로 걷는다

| # | 계약/필드 | plan 지점 | 내가 확인한 좌표 | 결과 |
|---|---|---|---|---|
| 1 | 회복 대상 = `expired` | 2 | `auth-resume.ts:118`·`:180` 둘 다 `demoted()` | 2/2 ✅ |
| 2 | refresh 가능 판정 한 곳 | 1 | `login.ts:367-379` 4판정이 한 함수 안 | 1/1 ✅ |
| 3 | refresh 1회 · 재로그인 3회 | 2 | `refreshOnce`(`:154`) 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:50`)+루프(`:116`) | 2/2 ✅ |
| 4 | probe 통과 후에만 커밋 | 1 | `login.ts:413` `settleGrant` | 1/1 ✅ |
| 5 | 새 세대 키 2개 | 1 | `tokenCandidate.writeVault`(`:867-876`) | 1/1 ✅ |
| 6 | `refreshExpiresAt` 영속 | 2 | `login.ts:858` 쓰기 · `store-parse.ts:45` 파싱 | 2/2 ✅ |
| 7 | 미회전 시 값 승계 | 1 | `login.ts:401-411` `const carried` | 1/1 ✅ |
| 8 | grant 조립 3지점 | 3 | `login.ts:608`·`:788`·`:847` — MV-A 재현이 **3좌표**를 깬다 | 3/3 ✅ |
| 9 | `compact` 인자 시그니처 | 1 | `obj.ts:48` — MV-B·MV-K·MV-L 재현 | 1/1 ✅ |
| 10 | `resuming` 파생 | 3 | `bootstrap.ts:367`·`handlers/providers.ts:47`·`rootFrame.ts:36` | 3/3 ✅ |
| 11 | `remainingSettled` 는 `finally` | 1 | `auth-resume.ts:213` `} finally {` → `:216` | 1/1 ✅ |
| 12 | 판정·상태의 문서 사본 | 2 | `plan.md:11` · `INDEX.md:21` 둘 다 `IMPL_DONE (r4)` | 2/2 ✅ |

- **합계 20/20.** plan 기재 20 ∖ 닫힌 20 = 0 · 닫힌 20 ∖ plan 20 = 0.
- **표에 없는데 같은 불변식이 필요한 지점 — 3건 발견**(8행의 파싱 쪽). D20.

## 6. 더 좁힌 기준 — 내가 심은 변이 5건

> 구현자가 이번 라운드에 만든 게이트(`CompactSource`·`obj.test.ts`·P=0 케이스)는 그 자체가
> 검증 대상이다. 같은 변이를 다시 돌리는 것은 재현이므로, **기준을 한 단계 좁혀** 다시 심었다.

| 변이 | 좁힌 지점 | 관측 산출 | 판정 |
|---|---|---|---|
| VR1 `GrantBase` 에 `zzTenant?: string` | 구현자 MV-A 와 같은 자리 | `typecheck:node` → **3좌표**(`login.ts:608`·`788`·`847`) | ✅ D13 닫힘 |
| VR2 `vaultKey: undefined`(secret) | MV-B 와 같은 자리 | `login.ts(610,7) error TS2322` | ✅ D14 닫힘 |
| VR3 session 리터럴에서 **키 자체 삭제**(`principalId` 줄) | MV-N 은 값을 떨어뜨렸다 — 나는 키를 지웠다 | `typecheck:node` `TS2345` **+** `login.test.ts` **1 실패**(session 전체 형상) | ✅ 타입·런타임 두 눈 |
| VR4 `compact` 시그니처를 r3 판으로 복원 | MV-K | `typecheck:test` → `obj.test.ts(52,5)`·`(67,5) TS2578` | ✅ 음성 타입이 상주 감시 |
| VR5 **`push` 만 guard 밖으로**(`Promise.all` 은 남긴다) | MV-J 는 블록 전체를 무조건화했다 — 나는 `P` 항만 건드렸다 | `auth-resume.test.ts` **3 실패**, 그중 상한 describe 의 신규 P=0 케이스 | ✅ 정본이 `P` 를 증명 |

- 다섯 건 모두 원복했다. 확인: `git status --short` 빈 출력 · 전체 재실행 산출이 §8 과 같다.

## 7. 숫자 / 상한 재측정 (r4) — **AC18 이 여기서 갈린다**

**AC18·`auth.md §5.2` 가 적은 `P + K + 1` 은 프로덕션 부팅 방송 총량이 아니다.** 회복이 성공하면
같은 `pushConnectionState` 가 더 불린다 — 그것을 부르는 자리가 프로덕션에는 **둘**인데 fake 는 하나만 모형한다.

| 관측 | 근거 |
|---|---|
| `pushConnectionState` 를 부르는 프로덕션 자리는 2곳 | `bootstrap.ts:365` 에서 한 번 정의해 `:376` `auth.subscribe` 와 `:404` `createAuthResume` 에 **같은 함수**를 준다 |
| refresh 성공은 change 를 **2개** 낸다 | `settleGrant` 가 `onSnapshot('credential-committed')`(`login.ts:586`) 와 `emit({kind:'done'})`(`:587`) 를 잇달아 낸다 |
| `publish` 는 합치지 않는다 | `runtime.ts:190`(`onStep`)·`:165-177`(`emitSnapshot`) 이 각각 구독자를 부른다. 디바운스·dedupe 없음 |
| fake 는 회복 경로를 모형하지 않는다 | `auth-resume.test.ts` 의 fake `resume` 은 `broadcast()` 를 부르지만(`:168`·`:183`) `login`·`refresh` 는 부르지 않는다 |

- **실측 대신 경로 계산**: 부팅 시점 만료된 oauth Auth 1건이 refresh 로 살아나는 경우 —
  P=0 · K=0 이므로 문서상 총 **1**, 실제는 커밋 1 + step 1 + 종료 1 = **3**.
- **plan §7 주의사항의 예외 경계도 틀렸다** — "AC18 이 잠그는 것은 **회복이 로그인 창을 열지 않은
  경로**" 인데, refresh 성공이 바로 창을 열지 않으면서 상한을 넘는 경로다.
- **정본 `auth.md:365-368` 에는 예외절이 아예 없다** — r4 가 "총 `P + K + 1` 이다" 로 총량 단언을 새로 넣었다.
- 참 인 서술: probe 단계는 `P + K` · 종료 push 1회는 무조건. **회복이 change 를 내면 그만큼 더 나간다.**
- 그 밖의 상한은 불변 — 시도 상한 `4N`(refresh 1 + 로그인 3)은 r1 계산 그대로다.

## 8. 게이트 재실행 (r4)

정본은 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`. **`npm test` 미사용.**

- `npm run typecheck` — node·web·test **3/3 · error 0**(출력에 error 줄 0).
- `npm run lint` — **0 errors, 1 warning**(`useTranscriptVirtualizer.ts:22`, 0102 베이스라인).
- `./node_modules/.bin/vitest run` — **206 파일 · 2,024 케이스 · 1,982 pass / 42 fail**.
- 관련 스위트(`features/auth`·`main/app`·`renderer/src/app`·`shared`) — **55 파일 / 519 케이스 green**.
- `node --test "scripts/*.test.mjs"` — `# tests 49 # pass 49 # fail 0`.
- `check-doc-inventory --check` — `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok`.
- **환경 기인 실패 분리 — 차집합 양방향 0줄.** 실패 5파일을 `app/AGENTS.md` 의 알려진 집합과
  `comm` 으로 뺐다: 내 실패 ∖ 알려진 = 0 · 알려진 ∖ 내 실패 = 0. 서명 `Module did not
  self-register: better_sqlite3.node` · `Electron failed to install correctly`.
- **게이트가 트리를 바꿨는가 — 아니다.** `npm run lint`(`--fix`) 실행 전후 `git status --short` 가 둘 다 빈 출력.
- **검증 중 남긴 잔여물 — 없다.** 변이 5건은 전부 원복했고 백업은 스크래치 디렉토리에만 있다.

## 9. Repository operation checks (r4)

- **INDEX 정합** ✅ — `impl` · `` `IMPL_DONE` (r4) `` · 다음 주체 `Claude (검증)` · 대상 커밋
  `ae882b1` · 라운드 4 가 실제 상태와 맞다.
- **비고 길이** — 표시폭 **725칸**(r3 613 · 0193 PASS 행 385). 앞 라운드가 통과시킨 대역 안이라
  미스매치로 세지 않되, 두 라운드 연속 늘었다.
- **trailer** ✅ — `ae882b1` = `Agent: claude`·`Status: implemented`·`Criteria-Met: 23/23`·
  `Verified-By: pending`. `23ac69f` = `Status: designed`, `Criteria-*` 없음. **D16 닫힘**:
  보드 커밋 `eaa3333` 의 trailer 에 `Criteria-*` 가 없다(`git interpret-trailers --parse` 로 확인).
- **인용 해시 실재** ✅ — `23ac69f`·`ae882b1`·`193b5eb`·`3371df2`·`b9b05c4`·`7c60433`·`ee11eab`·
  `efb874e` 전건 `git rev-parse` 해석.
- **AGENTS.md 변경 0** — 이번 range 에 `AGENTS.md` hunk 가 없다.

## 10. 파생 이슈 (r4)

- [ ] **D19** — AC18·`auth.md §5.2` 의 `P + K + 1` 이 프로덕션 부팅 방송 총량이 아니다. **FAIL 사유.**
- [ ] **D20** — `store-parse.ts` 의 grant 조립 3리터럴에 §10 8행의 전수 강제가 없다. 보고만.

## 11. Review Signals (r4) — 사실만

- **동일 증상 4라운드 연속.** AC18 문면 ↔ 코드 불일치가 r1 I3 · r2 D4 · r3 D12 · r4 D19 다.
  매 라운드 **다른 항**이 빠졌다: 종료 push(r1·r2) → 조건부 항 `P`(r3) → **회복 항**(r4).
- **막았어야 할 지침이 이번에도 있었다.** r4 가 스스로 올린 불변식("횟수를 적는 문장은 조건을 함께
  적거나 정본을 가리키고 숫자를 적지 않는다")을 정본 문장이 어긴다 — "총 `P + K + 1` 이다" 는
  조건 없는 숫자다.
- **관측 지점이 프로덕션 계약을 잠그지 않는다.** AC18 이 지목한 관측 지점(fake
  `pushConnectionState` 호출 수)은 프로덕션의 두 호출자 중 하나만 센다.
- **사용자 결정 변경 근거**: 없음. Decision Ledger 무변경, SUPERSEDED 0.
- **반복된 검증 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red — r1~r3·
  0193 과 같은 서명, 차집합 양방향 0.
- 현재 라운드 **4**. `handoff-review` 는 라운드 4 진입 전에 수행됐다(round 13, `efb874e`).

## 12. 결론 (r4)

- 상태: **FAIL** — 미충족 1건(AC18 문면), 파생 2건.
- **닫힌 것**: D11(사본 3건 전수) · D12(`P` 항) · D13(조립 3지점) · D14(`compact` 값 건전성) ·
  D15(`obj.test.ts`) · D16(보드 trailer) — 여섯 건 전부 내 변이로 재확인했다.
- **강제 지점 20/20** · **게이트 전건 자기보고와 일치** · **repository operation mismatch 0**.
- **막는 것 하나**: 정본 `auth.md §5.2` 가 프로덕션에서 거짓인 총량을 단언한다. 코드는 옳고
  고칠 곳은 문장이다 — 규범 행이므로 **설계 커밋**(`handoff-plan` 마무리)으로 간다.
- 남은 사람 확인: 없음. D19 는 사실 정정이라 제품 결정이 아니다.
- 다음 단계: AC18 문면 + §7 주의사항 예외 경계 + `auth.md:365-368` 을 함께 고친다. D20 은 같은
  턴에 §10 에 행을 더할지만 정한다.

---

# r3 — 2026-08-21 · **FAIL**

> r1·r2 판정 원문은 아래에 그대로 둔다. 이 절은 **r3 에서 달라진 것만** 적는다.

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `799bc56..193b5eb` (구현 `3371df2`) |
| 구현 전 plan 기준 | **diff 로 성립하지 않는다** — §0 참조 |
| 라운드 | 3 |
| 상태 | **FAIL** |
| 다음 주체 | **`handoff-review` → 구현자** (라운드 4는 review 선행 조건) |
| 자기 검증 여부 | 예 — 설계·구현·검증이 모두 Claude Code |

**한 줄 판정**: D3·D5·D7·D8·D9 는 실제로 닫혔고 게이트 수치도 자기보고와 갈림 0이지만,
**이번 라운드가 정정한 AC18 의 문면이 여전히 코드와 어긋난다** — 저장소 안의 테스트가 그것을
반증한다(D12). AC18 이 코드와 어긋나는 것은 **3라운드 연속**이다.

## 0. 기준선 (r3) — **diff 로 성립하지 않는다**

`3371df2` **한 커밋**에 AC18·AC20·§10·§15·§16 정정과 구현이 함께 들어왔다. r1(`064c06a` →
`ee11eab`)·r2(`ddf180a` → `7c60433`)는 갈려 있었다. §0 의 자기 증명 방지 장치가 이번 라운드에는
작동하지 않으므로, 아래를 확인해 기준을 고정한 뒤 채점했다.

- **실제로 바뀐 AC 는 2행뿐**(AC18·AC20). `git show 3371df2 -- …/plan.md` 의 §7 hunk(`@@ -140,9`)에서
  AC15~AC17·AC19·AC21~AC23 은 문맥 줄로만 나온다.
- **Decision Ledger 무변경** — §3(11~56행)에 hunk 가 없다. SUPERSEDED 0.
- **AC20 은 기준을 좁혔다** — 문서를 2개에서 3개로 늘렸다(`closed-network-extensions.md §3-b` 추가).
  §10 은 지점을 15→17 로, §15·§16 은 사실을 코드에 맞췄다. 넷 다 자기 이롭지 않다.
- **자기 이로운 정정은 AC18 하나**이고 그것이 D12 로 여전히 부정확하다. 방향(정정한다)은 verify
  r1 §13 D4·r2 §10 이 이미 지시한 것과 같아 새 기준으로 받되 **문면을 고쳐야 한다**.
- 사용자 승인 원문은 저장소에 없다 — r2 의 D-014 와 같은 상황이라 같은 방식으로 기록만 한다.

## 1~3. 구현 비판적 읽기 / 역방향 (r3)

- **실행 변경은 두 곳이다**: `tokenCandidate` 조립부(`login.ts:818-856`)와 `rootFrame` 마지막
  분기(`rootFrame.ts:36`). 나머지 diff 는 주석·테스트·문서다.
- `scan-surface.sh 799bc56..193b5eb`: 미사용 값 export **0건** · 형제 정책 비대칭 **0건**.
  타입 전용 4건(`RootFrame`·`RootFrameInput`·`AuthResumeHandle`·`ResumeAuthDeps`)은 자기 파일
  시그니처용이고, 테스트 전용 2건(`gateOpen`·`LoginDeps`)은 r2 와 같은 판단이다.
- **`compact` 는 미배선이 아니다** — 프로덕션 소비처 1건(`login.ts:839`).
- **테스트가 프로덕션 계약을 잠그는가**: ✅ — 신규 4케이스가 실물 `LoginService`·`AuthStore`·
  `createVault` 를 세워 `login.refresh('wiki')`/`login.begin('wiki')` 를 부른다. 로컬 재구현 0건.
- **되살아남 없음**: `revoke()` 가 `openAttempt()` 로 세대를 올린다(`login.ts:231`). 도는 중인
  refresh 는 `superseded` → `'unsupported'` 로 접혀 커밋되지 않으므로, `previous` 가 나르는
  데이터가 늘어도 해제한 Auth 가 되살아나지 않는다.
- **기준 밖 결함 3건 — 신규**: D13(전수 강제가 3지점 중 1곳) · D14(`compact` 가 필수 필드를
  드롭) · D15(`compact` 자기 테스트 부재). 전부 §6 에서 실측했다.

## 4. 구현 보고 재측정 — 보고를 증거로 쓰지 않는다

| 보고 값 | 내 재측정 | 결과 |
|---|---|---|
| typecheck 3/3 · error 0 | `npm run typecheck` → error **0** | ✅ |
| vitest 205 파일 · 2,011 케이스 · 1,969/42 | 동일 | ✅ |
| 관련 18파일 281 green | 동일 | ✅ |
| scripts 49/49 · doc-inventory 차이 0 | 동일(`prose ok` · `links ok`) | ✅ |
| 42 red = 알려진 ABI 5파일 | **차집합 양방향 0줄** | ✅ |
| 강제 지점 17 | §10 행별 재계수 `2+1+2+1+1+2+1+1+3+1+2` = **17** | ✅ |
| `resuming` 3지점 | `connectionState(` 프로덕션 호출부 **2** + `rootFrame.ts:36` | ✅ |
| `RootGate` 의 `resuming` 읽기 1건 | `rg "\.resuming" src/renderer/src` → `RootGate.tsx:35` 1건 | ✅ |
| AC 분모 23 | 재계수 **23** | ✅ |
| `Criteria-Met: 23/23` | **불일치** — 내 채점은 `22✅ · 1⚠️ = 23` (AC18) | ❌ |

## 5. AC 재검증 — 이번 라운드가 건드린 두 행

| # | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1~AC17 · AC19 · AC21~AC23 | ✅ 유지 | 실행 변경이 조립부·프레임 분기 두 곳에 갇혀 있고 관련 **18파일 281케이스**가 전건 green |
| **AC18** | ⚠️ **문면이 코드와 어긋난다** | "부팅 방송은 `1 + K + 1` 이다" 인데 `auth-resume.test.ts:750` 이 **1** 을 단언한다 → D12 |
| AC20 | ✅ 확대된 목록으로 충족 | `auth.md §5.2` 갱신 · `closed-network-extensions.md §3-b` 에 `refresh` 갈래 · `IPC_CONTRACT.md:399` 에 `resuming` 실재 · doc-inventory 차이 0 |

- **합계 재측정**: `✅ 22 · ⚠️ 1 · ❌ 0 = 총 23`. 분모는
  `awk '/^## 7\. Acceptance/,/^### AC 검증/' | grep -cE "^\| AC[0-9]+ \|"` → **23**.
  r2 와 분모가 같다(AC 신설·분할 0).
- **자기보고와 갈림 1건** — 구현 보고는 `23/23`, 내 채점은 `22/23`. AC18 을 ✅ 로 세지 않았다.
- **AC18 의 제품 목적은 충족한다** — D-008 이 요구하는 "대기 화면이 반드시 걷힌다" 는 종료 push
  가 무조건이라 성립한다(`auth-resume.ts:213-219`). 어긋난 것은 **횟수 문면**이다.

### plan §10 강제 지점 표 (r3) — AC와 별개로 걷는다

| 계약/필드 | plan 기재 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 회복 대상 = `expired` | 2 | `auth-resume.ts:180` · `:116` | 2/2 ✅ |
| refresh 가능 판정 한 곳 | 1 | `login.ts:362-374` 4판정이 한 함수 안 | 1/1 ✅ |
| refresh 1회 · 재로그인 3회 | 2 | `refreshOnce`(`:154`) 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:50`) | 2/2 ✅ |
| probe 통과 후에만 커밋 | 1 | `login.ts:408` `settleGrant` | 1/1 ✅ |
| 새 세대 키 2개 | 1 | `tokenCandidate.writeVault`(`:859-871`) | 1/1 ✅ |
| `refreshExpiresAt` 영속 | 2 | `login.ts:850` · `store-parse.ts:45` | 2/2 ✅ |
| 미회전 시 값 승계 (D-014) | 1 | `login.ts:396-406` `carried` | 1/1 ✅ |
| **갱신 커밋 필드 규칙 (r3 신설)** | 1 | `login.ts:839-853` 조립 리터럴 | 1/1 ✅ **눈이 생겼다**(VF3) |
| `resuming` 파생 | 3 | `bootstrap.ts:367` · `handlers/providers.ts:47` · `rootFrame.ts:36` | 3/3 ✅ |
| `remainingSettled` 는 `finally` | 1 | `auth-resume.ts:213-219` | 1/1 ✅ |
| 판정·상태의 문서 사본 | 2 | `plan.md:11` · `INDEX.md:21` | 2/2 ✅ |

- **plan 기재 17 ∖ 닫힌 17 = 0** · **닫힌 17 ∖ plan 17 = 0**. 구현 보고 `17/17` 과 일치한다.
- **표에 없는데 같은 불변식이 필요한 지점 — 2건 신규**: grant 조립 **secret**(`login.ts:605`)과
  **session**(`:783`). 같은 `GrantBase` 를 쓰는데 전수 강제가 없다 → D13.

## 6. 더 좁힌 기준 — 내가 심은 변이 3건

구현이 심은 `MV1`~`MV6` 을 그대로 다시 돌리는 것은 재현이지 검증이 아니다. **구현이 주장한
성질 자체를 반대 방향에서** 찔렀다.

| 변이 | 심은 곳 | 실행 산출 | 판정 |
|---|---|---|---|
| VF1 필수 필드에 `undefined` (`vaultKey: undefined`) | `login.ts:841` | `typecheck:node` → **error 0** | ❌ **타입이 막지 못한다** → D14 |
| VF2 같은 변이의 런타임 | 같음 | `vitest run src/main/features/auth` → **7 실패**/201 | ✅ 테스트는 잡는다 |
| VF3 `GrantBase` 에 필드 추가(`zzTenant?`) | `contracts/auth.ts` | `typecheck:node` → 깨진 좌표가 **`login.ts(839,39)` 하나** | ⚠️ token 만 눈이 있다 → D13 |

- 세 건 모두 실행 후 원복하고 `git diff --stat` 빈 출력 · `typecheck:node` error 0 ·
  `vitest run src/main/features/auth` **201/201** 로 복원을 확인했다.
- **VF1+VF2 가 D14 의 실체다**: r3 는 "전수 강제를 타입에 뒀다" 고 보고했는데, 타입이 강제하는
  것은 **키의 존재**뿐이고 필수 키의 **값 건전성**은 테스트가 막고 있다. `compact` 의
  `Partial<T>` 가 필수 키에도 `undefined` 를 허용하고(`exactOptionalPropertyTypes` 미설정 —
  `tsc --showConfig` 로 확인), `compact` 는 그것을 드롭한 뒤 `as T` 로 캐스팅한다.
- **VF3 이 D13 의 실체다**: `GrantBase` 는 세 갈래가 공유하는데 깨지는 자리가 하나다.

## 7. 숫자 / 상한 재측정 (r3)

- **AC 분모 23** · **§10 지점 17 기재 / 17 실측** — 위 §5.
- **vitest 205 파일 · 2,011 케이스 · 1,969 pass / 42 fail** · 관련 18파일 **281** green
  (r2 2,005·275 → +6: `login.test.ts` +4 · `rootFrame.test.ts` +2).
- **요청 상한 `4N` 불변** — 이번 변경은 왕복을 만들지 않는다.
- **방송 총량 실측**: `(probe 후보 있으면 1, 없으면 0) + K + 1`. 세 케이스가 각각
  `:353`=2(후보 3·K=0) · `:371`=4(후보 3·K=2) · `:750`=1(후보 0·K=0) 이다 → D12.
- 0건 게이트의 정당한 예외 보존 ✅ — `refreshExpiresAt` 미선언은 여전히 "모른다 → 시도"(D-009).

## 8. 게이트 재실행 (r3)

- 적용 정본 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`. **`npm test` 미사용**.
- **관측한 실행 산출**(exit code 아님):
  - typecheck — node·web·test **3/3, error 0**.
  - vitest 전체 — **205 파일 · 2,011 케이스**, `1,969 pass / 42 fail`.
  - vitest 관련 — **18 파일 / 281 케이스 전건 green**.
  - scripts — `# tests 49 # pass 49 # fail 0`.
  - doc-inventory — `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · 차이 0.
- **`npm run lint` 은 이 턴에 돌리지 않았다** — `--fix` 라 검증 대상 파일을 쓴다. 구현자가
  "재실행 전후 `git diff` 해시 동일" 을 보고했고, 검증자가 고친 코드를 검증자가 채점하지 않기
  위해 그 항목은 **미확인으로 남긴다**.
- **환경 기인 실패 분리 — 차집합 0**: 42 red 의 5파일(`app/chat-turn.continuity` ·
  `extensions/builder` · `orchestration/fork` · `infra/db/migrate` · `infra/db/queries`)을
  `app/AGENTS.md:135` 의 알려진 집합과 실제로 뺐다. 양방향 **0줄**.
- **내 명령의 잔여물**: 변이 3건뿐이고 전부 원복했다(위 §6).

## 9. Repository operation checks (r3)

- `AGENTS.md` 변경 **0건** — range 12파일에 없다.
- **INDEX 정합** ✅ — `impl` · `` `IMPL_DONE` (r3) `` · 다음 주체 `Claude (검증)` · 대상 커밋
  `3371df2` · 라운드 3 이 실제 상태와 맞았다. 비고는 **735바이트**로 5줄 이내.
- **인용 해시 실재** ✅ — `git rev-parse --verify 3371df2` 해석.
- **상태 사본 2곳 일치** ✅ — `plan.md:11` · `INDEX.md:21`.
- **trailer** ⚠️ **1건 불일치** — 보드 커밋 `193b5eb` 에 `Criteria-Met: 23/23` 이 붙었다.
  root `AGENTS.md` 표는 `Criteria-*` 를 **구현 커밋만**으로 정한다. r2 의 같은 성격 커밋
  `b9b05c4` 는 4줄이었다 → D16.
- reference/script 이동·삭제 **0건**.

## 10. 파생 이슈 (r3)

- **D3 · D5 · D7 · D8 · D9 — 해결 확인.** 구현 보고가 아니라 코드·테스트·변이로 확인했다.
  D7 은 전체 형상 단언이 `principalId: 'kim@corp'` 승계와 옛 `expiresAt`(500) **미승계**를 둘 다
  잠근다. D9 는 짝 케이스가 신설됐다.
- **D6 · D10 · D11 — 보고만 유지.**
- 신규 **D12 · D13 · D14 · D15 · D16** 은 `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관했다.

## 11. Review Signals (r3) — 사실만

- **AC18 이 3라운드 연속 코드와 어긋났다.** r1 ❌(대리 기준) → r2 ❌(같은 기준) → r3 ⚠️(정정한
  문면이 부정확). r1 의 `[구현자 기입]`(plan.md:582)은 이미 "probe 방송 0 + 종료 push 1 = 1" 이라
  정확히 적었는데, r3 의 정정은 그 케이스를 "같은 값" 이라 적었다.
- **"지점을 적게 셌다" 가 4연속이다.** 0193 `attempted` → 0194 r1 `resuming`(I4) → r2
  `refreshExpiresAt` producer(D2) → r3 grant 조립 3지점 중 1곳(D13).
- **설계 정정과 구현이 한 커밋에 들어왔다** — r1·r2 에는 없던 일이고 §0 이 그 경우를 위해 둔
  조항을 이번에 처음 썼다.
- **반복된 검증 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red —
  r1·r2·0193 과 같은 서명.
- 현재 라운드 **3**. **다음 재구현은 라운드 4이고, `docs/handoff/AGENTS.md` 의 review 진입
  조건("impl 라운드가 3을 초과")에 해당한다.**

## 12. 결론 (r3)

- 상태: **FAIL (r3)**
- **닫힌 것**: D3(사본 삭제) · D5(셀렉터 단일 독자) · D7(필드 규칙) · D8(guide 예제) ·
  D9(짝 케이스). 전부 내 재측정·변이로 확인했다.
- **막는 것 1건**: **D12 — AC18 의 정정된 문면이 코드와 어긋난다.** 한 줄 수정이면 닫힌다.
- **기준 밖 결함 4건**: D13(전수 강제 1/3지점) · D14(`compact` 가 필수 필드를 드롭) ·
  D15(`compact` 자기 테스트 부재) · D16(보드 커밋 trailer).
- **AC**: `✅ 22 · ⚠️ 1 · ❌ 0 = 23`. 자기보고 `23/23` 과 **1건 갈림**. **강제 지점 17/17**.
- **repository operation mismatch 1건** — D16.
- **다음 단계**: **`handoff-review` 를 먼저 수행한다**(라운드 4 진입 조건). 그 뒤 구현자가
  D12 를 닫고 D13·D14·D15·D16 을 함께 처리한다.

---

# r2 — 2026-08-20 · **FAIL**

> r1 판정 원문은 아래 [`# r1`](#r1--2026-08-20--fail-원문-보존)에 그대로 둔다. 이 절은 **r2 에서 달라진 것만** 적는다.

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `ddf180a..b9b05c4` (구현 `7c60433`) |
| 구현 전 plan 기준 | `064c06a`(원 설계) · r1 판정 `ddf180a` |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 다음 주체 | **사람/설계자**(D4) + **구현자**(D3·D5·D7) |
| 자기 검증 여부 | 예 — 설계·구현·검증이 모두 Claude Code |

**한 줄 판정**: r1 의 **D1·D2 는 내 변이로 닫힌 것을 확인**했지만, **AC18 은 원 기준으로 여전히 ❌**이고 D3·D5 는 손대지 않은 채이며, **같은 축의 결함이 하나 더 살아 있다** — 갱신 커밋이 옛 grant 의 `principalId` 를 잃는다(실측). 그래서 FAIL 이다.

## 0. 기준선 (r2)

- **기준선이 diff 로 성립한다** — r1 판정 커밋 `ddf180a` 와 구현 커밋 `7c60433` 이 갈려 있다.
- **AC 원문 무변경 · 신설 3건.** `git show 7c60433 -- …/plan.md` 의 §7 hunk 는 **추가 3줄뿐**(AC21~AC23)이고 AC1~AC20 은 문맥 줄로만 나온다 — **AC18 은 한 글자도 바뀌지 않았다**. 완화·재작성 0건.
- Decision Ledger: **D-014 1건 추가 · SUPERSEDED 0.** 문면이 r1 이 올린 D1 의 선택지 ⓐ 와 일치한다.
- **다만 사용자 원문 사본이 저장소에 없어 "사용자 선택 2026-08-20" 이라는 provenance 자체는 확인 불가**다. 이 사실을 적고 D-014 를 새 기준으로 받는다 — 방향이 r1 이 제시한 ⓐ 와 같고 기존 결정을 바꾸지 않기 때문이다.
- 구현자가 고친 Part II 2곳은 **전부 r1 파생 이슈가 지시한 것**이다: §10 6행(D2 — 1→2지점, `(r2 정정)` 표식) · §10 승계 행 신설(D-014).
- **안 고친 것도 기준선이다**: §10 `resuming` 행은 여전히 `2지점`(실제 3) · §16 "방송 상한 … **유지**" 행 무변경 — 둘 다 D4 대기이고 이번 채점은 원 기준 그대로 한다.

## 1~3. 구현 비판적 읽기 / 역방향 (r2)

- **실행 변경은 `LoginService.refresh` 한 블록이 전부다** — `login.ts:392-402` 의 `carried` 상수와 `tokenCandidate(…, carried)` 인자 1개. `contracts/auth.ts` `+5` 는 전부 주석(`:172-176`)이다.
- 그래서 r1 의 §1~§3 판정은 그대로 성립하고, 이번에 새로 볼 표면은 **갱신 커밋 경로 하나**다.
- `scan-surface.sh ddf180a..b9b05c4`: 미사용 값 export **0건** · 형제 정책 비대칭 **0건** · 테스트 전용 1건(`LoginDeps` — 타입, 프로덕션 생성자 인자라 정상).
- **테스트가 프로덕션 계약을 잠그는가**: ✅ — 신규 8케이스가 실물 `LoginService`·`AuthStore`·`createVault` 를 세워 `login.refresh('wiki')` 를 부른다. 같은 형상의 로컬 재구현 0건.
- **부분 실패 잔여**: 승계는 되돌리기와 어긋나지 않는다. 금고 실패 지점을 **두 번째 쓰기(승계된 refresh)로 옮겨도** 옛 쌍이 그대로 살아남는다(§6 MV5).
- **기준 밖 결함 1건 — 신규.** 갱신 커밋이 옛 grant 의 `principalId` 를 승계하지 않는다 → **D7**. 실측: `principalId:'kim@corp'` 를 심고 회전 응답으로 `refresh()` → `AFTER REFRESH principalId = undefined`. 소비자는 `runtime.ts:141` → `connection-views.ts:74` → `ProviderDetail.tsx:93`.
- **D7 의 음의 경계 — 사이드바 신원은 영향받지 않는다.** 사이드바는 `selectGatePrincipal(state.providers)` 로 **게이트 provider 의** principal 만 읽고(`useProviderPrincipal.ts:20` → `lib/principal.ts` 의 `if (provider.kind !== 'gate') continue`), 게이트 Auth 는 D-001 로 refresh 대상이 아니다. 화면에서 사라지는 것은 설정의 연결 상세(`ProviderDetail.tsx:93`) 하나다.

## 4. 구현 보고 재측정 — 보고를 증거로 쓰지 않는다

| 보고 값 | 내 재측정 | 결과 |
|---|---|---|
| D1 닫힘 | MV2(승계 무조건화) → 회전 2케이스 실패 · MV1(만료 우선순위 뒤집기) → 1케이스 실패 | ✅ |
| D2 닫힘 | **r1 이 330/330 통과시킨 그 변이**를 다시 심으니 3케이스 실패 (§6 MV4) | ✅ |
| 강제 지점 `16/16` | §5 표에서 지점별 현재 좌표로 다시 셈 — **16** | ✅ |
| AC `22✅/1❌ = 23` | §7 행 재계수 **23** · 내 채점도 22✅/1❌ | ✅ 일치 |
| `+8` 케이스 (1,997 → 2,005) | `vitest run` → **2,005** · `login.test.ts` **46** | ✅ |
| 게이트 산출 5종 | §8 재실행에서 전부 같은 값 | ✅ |
| "게이트가 트리를 바꾸지 않았다" | 내 실행도 lint 전후 `git status --short` 둘 다 빈 출력 | ✅ |

## 5. AC 재검증 — 신규 3건 + AC18

| # | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1~AC17 · AC19 · AC20 | ✅ 유지 | 실행 변경이 `refresh` 한 블록에 갇혀 있고, 관련 **18파일 275케이스**가 이번 턴에 전건 green. r1 관측 원문은 아래 r1 §5 |
| AC18 | ❌ **미충족 유지** | 기존 2케이스가 여전히 무수정이 아니다 — `auth-resume.test.ts:353` `toHaveBeenCalledTimes(2)`(원 1) · `:371` `(4)`(원 3) |
| AC21 | ✅ | `응답에 refresh token 이 없으면 옛 값을 새 세대 키로 옮긴다` — `refreshOf`=`'old-refresh-value'` · `refreshKey`≠옛 키 · 옛 키 2개 금고에서 사라짐. `승계한 뒤에도 다시 갱신할 수 있다` — 2회차 `refreshed`, `calls`=같은 값 2회 |
| AC22 | ✅ 4케이스 | 9,999 승계 · 50,000 이 이김 · 회전이면 `undefined` · 회전+만료면 77,000. MV1 이 두 번째 케이스로 검출된다 |
| AC23 | ✅ 2케이스 | probe 거부 → 옛 access·refresh 둘 다 생존 · 금고 쓰기 실패 → 같음. **기준을 좁혀 실패 지점을 두 번째 쓰기로 옮겨도 46/46 green**(§6 MV5) |

- **합계 재측정**: `✅ 22 · ⚠️ 0 · ❌ 1 = 총 23`. 분모는 `awk '/^## 7\. Acceptance/,/^### AC 검증/' | grep -cE "^\| AC[0-9]+ \|"` → **23**. r1 의 20 과 직접 비교하지 않는다(AC21~23 신설).
- **자기보고와 갈림 0건.** r1 은 AC18 에서 ⚠️↔❌ 로 갈렸고 이번 라운드는 세 사본(본문·trailer·INDEX)과 내 채점이 모두 `22/23` 이다.

### plan §10 강제 지점 표 (r2) — AC와 별개로 걷는다

| 계약/필드 | plan 기재 | 코드에서 확인한 지점 (현재 좌표) | 결과 |
|---|---|---|---|
| 회복 대상 = 그 시점 `expired` | 2 | `auth-resume.ts:178` `continue` · `:116` 재로그인 루프 머리 | 2/2 ✅ |
| refresh 가능 판정 한 곳 | 1 | `login.ts:360-370` 4판정이 한 함수 안 | 1/1 ✅ |
| refresh 1회 · 재로그인 3회 | 2 | `refreshOnce`(`:152`) 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:48`)+루프(`:114`) | 2/2 ✅ |
| probe 통과 후에만 커밋 | 1 | `login.ts:404` `settleGrant` | 1/1 ✅ |
| 새 세대 키 2개 | 1 | `tokenCandidate.writeVault`(`:846-856`) | 1/1 ✅ |
| `refreshExpiresAt` 영속 (r2 정정 1→2) | 2 | ① 커밋 쓰기 `login.ts:835-838` ② 부팅 파싱 `store-parse.ts:45` | 2/2 ✅ **눈이 생겼다**(MV4) |
| **미회전 시 값 승계 (D-014)** | 1 | `login.ts:392-402` — `tokenCandidate` 직전 1지점 | 1/1 ✅ (MV1·MV2) |
| `resuming` 파생 | **2** (미정정) | `bootstrap.ts:367` · `handlers/providers.ts:47` · `rootFrame.ts:30` | **3/3** ✅ 지점 수는 여전히 D4 |
| `remainingSettled` 는 `finally` | 1 | `auth-resume.ts:211-214` | 1/1 ✅ |
| 판정·상태의 문서 사본 | 2 | `plan.md` 메타 · `INDEX.md` 행 둘 다 `IMPL_DONE (r2)` | 2/2 ✅ |

- **plan 기재 합계 15**(2+1+2+1+1+2+1+2+1+2) **∖ 실제 닫힌 16 = 0** · 닫힌 16 ∖ plan 15 = **1**(`connectionState` invoke — r1 I4, D4 대기). 구현 보고 `16/16` 과 일치한다.
- 표에 없는데 같은 불변식이 필요한 지점 — **1건 신규**: 갱신 커밋이 **옛 grant 의 필드를 승계하는 범위**. 표는 `refreshToken`·`refreshExpiresAt` 두 필드만 지점으로 갖고 `principalId` 는 어느 행에도 없다 → D7.
- **다만 그 범위는 "전수" 가 될 수 없다 — 필드별 규칙이다.** `expiresAt` 을 함께 승계하면 해롭다: `markExpired` 가 강등 시점에 `expiresAt` 을 **`now` 로 못 박으므로**(`store.ts:381-382`), 그 지난 값을 새 access token 에 물리면 **갱신 직후 곧바로 만료 상태로 태어난다**. 필드별 판정은 `expiresAt` = 승계 금지(응답 전용, 생략 = 새 토큰의 만료를 모른다) · `refreshToken`·`refreshExpiresAt` = 승계(D-014 가 닫음) · `principalId` = 승계(계정 신원이라 갱신으로 바뀌지 않는다). **그래서 D7 이 더할 필드는 `principalId` 하나다.**

## 6. 더 좁힌 기준 — 내가 심은 변이 5건

구현이 심은 `M16`~`M19` 를 그대로 다시 돌리는 것은 재현이지 검증이 아니다. 구현이 심지 **않은** 자리에 심고, 기준을 한 단계 좁혔다.

| 변이 | 심은 곳 | 실행 산출 | 판정 |
|---|---|---|---|
| MV1 만료 우선순위 뒤집기 (`grant ?? token`) | `login.ts:401` | `응답이 만료만 새로 주면 그 값이 이긴다` 1건 실패 (45/46) | ✅ 눈 있음 |
| MV2 승계 무조건화 (회전 무시) | `login.ts:393` | 2건 실패 — `access·refresh 둘 다 새 세대 키에` · `회전 응답은 새 값으로 갈아끼우고…` | ✅ 눈 있음 |
| MV3 `refreshKey`↔`refreshExpiresAt` 짝 조건 제거 | `login.ts:836-837` | `vitest run src/main/features/auth src/main/app` → **338/338 통과** | ❌ **눈 없음** → D9 |
| MV4 = r1 D2 변이 재현 (쓰기 4줄 제거) | `login.ts:835-838` | **3건 실패** (r1 에서는 330/330 통과였다) | ✅ D2 닫힘 |
| MV5 금고 실패를 **두 번째 쓰기**(승계된 refresh)로 이동 — 테스트 측 기준 강화 | `login.test.ts` AC23 케이스 | **46/46 통과** | ✅ 불변식이 두 쓰기 위치 모두에서 성립 |

- 다섯 건 모두 실행 후 원복하고 `git status --short` 빈 출력으로 트리 복원을 확인했다.
- **MV3 의 차집합이 비어 있지 않다**: `tokenCandidate` 주석이 "refresh 키가 없으면 그 만료도 의미가 없다 — 짝으로만 싣는다" 를 계약처럼 적었는데 그 문장을 지키는 케이스가 0건이다. 동작 결과는 바뀌지 않는다(`refreshSecret` 이 `refreshKey === undefined` 를 먼저 접는다) → D9 로 남긴다.

## 7. 숫자 / 상한 재측정 (r2)

- **AC 분모 23** · **§10 지점 15 기재 / 16 실측** — 위 §5.
- **vitest 205 파일 · 2,005 케이스 · 1,963 pass / 42 fail** · `login.test.ts` **46**(r1 38 +8) · 관련 18파일 **275** green.
- **금고 쓰기 수가 미회전 응답에서 1 → 2 로 늘었다** — 옛 값을 새 키에 옮겨 적으므로. 삭제도 짝으로 늘어(`discardKeys(previous, …)`) **보관 키 총수는 불변**이다.
- **요청 상한 `4N` 불변** — 승계는 왕복을 늘리지 않는다(refresh 1회 그대로).
- 0건 게이트의 정당한 예외 보존 ✅ — `refreshExpiresAt` 미선언은 여전히 "모른다 → 시도"(D-009).

## 8. 게이트 재실행 (r2)

- 적용 정본 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`. **`npm test` 미사용**.
- **관측한 실행 산출**(exit code 아님):
  - typecheck — node·web·test **3/3, error 0**.
  - lint — **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 0102 베이스라인).
  - vitest 전체 — **205 파일 · 2,005 케이스**, `1,963 pass / 42 fail`.
  - vitest 관련 — `features/auth`·`auth-resume`·`connection-views`·`handlers/providers`·`renderer/src/app` = **18 파일 / 275 케이스 전건 green**.
  - scripts — `# tests 49 # suites 7 # pass 49 # fail 0`.
  - doc-inventory — `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · **차이 0**.
- **환경 기인 실패 분리**: 42 red = **5파일**(`app/chat-turn.continuity` · `extensions/builder` · `orchestration/fork` · `infra/db/migrate` · `infra/db/queries`)이고 `app/AGENTS.md:135` 의 알려진 집합과 **정확히 같다**. 서명은 `Module did not self-register` · `Electron failed to install`.
- **게이트가 트리를 바꿨는가**: 아니다 — lint 전후 `git status --short` 둘 다 빈 출력.
- **내 명령의 잔여물**: 스크래치 테스트 1건(`zz-scratch-principal.test.ts`)을 만들어 D7 을 관측하고 삭제했다. 삭제 후 트리 빈 출력 확인.

## 9. Repository operation checks (r2)

- `AGENTS.md` 변경 **0건** — range 6파일(`git diff --stat ddf180a..b9b05c4`)에 없다.
- **INDEX 정합** ✅ — `impl` · `IMPL_DONE (r2)` · 다음 주체 `Claude(검증)+사람(D4)` · 대상 커밋 `7c60433` · 라운드 2 가 실제 상태와 맞았다. 비고는 **523자 / 711바이트**로 5줄 이내(0193 PASS 행 300자와 같은 자릿수).
- **trailer** ✅ — `7c60433` 6줄 · `b9b05c4` 4줄이 `git interpret-trailers --parse` 로 전부 파싱되고 값이 root `AGENTS.md` 허용값이다. 구현 커밋에만 `Criteria-*`, 둘 다 `Verified-By: pending`.
- **인용 해시 실재** ✅ — `git rev-parse` 로 `7c60433`·`b9b05c4` 둘 다 해석. plan `대상 커밋` 과 INDEX 가 같은 값이다.
- **합계 사본 3곳 일치** ✅ — 본문 `22/23` ↔ trailer `Criteria-Met: 22/23` ↔ INDEX `AC 22✅/1❌ = 23`. 0190 의 갈림 축은 이번에도 재현되지 않았다.
- reference/script 이동·삭제 **0건**.

## 10. 파생 이슈 (r2)

- **D1 · D2 — 해결 확인.** 내 변이로 닫힌 것을 재측정했다(§4·§6). `plan.md` 표의 상태 칸을 갱신했다.
- **D3 · D4 · D5 — 미해결 유지.** r2 가 손대지 않았고 코드에서 그대로 확인된다: `auth-resume.ts:20-21` 헤더가 여전히 "재로그인이 0건이면 이 상한은 그대로다" 인데 종료 push 는 `:217` 에서 무조건 나간다(같은 파일 `:215-217` 주석이 스스로 그것을 설명한다) · `bootstrap.ts:404-405` 도 종료 push 를 서술하지 않는다 · `RootGate.tsx:42` 가 `gate.resuming` 을 셀렉터 밖에서 한 번 더 읽는다.
- **D6 — 보고만 유지.**
- 신규 **D7 · D8 · D9** 는 `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관했다.

## 11. Review Signals (r2) — 사실만

- **같은 축의 재발이 같은 handoff 안에서 일어났다.** r1 D1("갱신 커밋이 옛 `refreshToken` 을 잃는다")과 이번 D7("같은 커밋이 옛 `principalId` 를 잃는다")은 같은 문장의 다른 필드다. r2 는 사용자 결정이 **이름 붙인 두 필드**(`refreshToken`·`refreshExpiresAt`)를 닫았고 `Grant` 의 나머지 필드는 세지 않았다.
- **관련 plan 지침**: §15 "semantics 검증" 이 3의미(`failed`·`unsupported`·커밋 거부)만 열거했고 r2 가 네 번째(미회전)를 더했다. "응답이 옛 grant 의 다른 필드를 말하지 않는다" 는 다섯 번째는 여전히 목록 밖이다.
- **plan §15 가 지시한 문서 중 하나가 두 라운드 모두 갱신되지 않았다** — `docs/guides/closed-network-extensions.md` §3-b(D8). AC20 이 그 파일을 이름으로 갖지 않아 AC 채점에 걸리지 않았다.
- **사용자 결정 변경 근거**: D-014 는 사용자 선택으로 기록됐고 저장소 안에 원문 사본은 없다. 기존 결정 SUPERSEDE 0건.
- **반복된 검증 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red — r1·0193 r1/r2 와 같은 서명.
- 현재 라운드 **2**. 다음 재구현이 라운드 3이고, **3을 초과하면(라운드 4) `handoff-review` 진입 조건**이다.

## 12. 결론 (r2)

- 상태: **FAIL (r2)**
- **닫힌 것**: D1(승계) · D2(쓰기 지점의 눈). 둘 다 구현 보고가 아니라 **내 변이 실행 산출**로 확인했다.
- **막는 것 5건**: AC18 ❌(원 기준) · D3(코드 헤더 drift) · **D4(사람/설계자 결정)** · D5(셀렉터 밖 읽기) · **D7(신규 — `principalId` 승계 누락)**.
- **AC**: `✅ 22 · ❌ 1 = 23`, 자기보고와 갈림 0건. **강제 지점 16/16**(plan 기재 15 + invoke 1).
- **repository operation mismatch 0** — INDEX·trailer·해시·doc-inventory·합계 사본 전건 정합.
- **남은 사람 확인**: D4 의 AC18·§16·§10 정정 승인 · 스피너 시각 품질(r1 §8 그대로).
- **다음 단계**: D4 를 사람/설계자가 정정한 뒤 구현자가 D3·D5·D7 을 닫는다. D8·D9 는 같은 라운드에 함께 처리할 수 있다.
- **D7 을 닫는 방법은 `principalId` 한 필드다** — §5 의 필드별 판정 참조. `Grant` 필드 전수 승계로 올리지 않는다(`expiresAt` 이 갱신 직후 만료를 만든다).

---

# r1 — 2026-08-20 · FAIL (원문 보존)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0194-auth-refresh-and-resume-window` |
| 검증자 | Claude Code |
| 일자 | 2026-08-20 |
| 대상 커밋/range | `064c06a..8cf85ec` (구현 `ee11eab`) |
| 구현 전 plan 기준 | `064c06a` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 예 — 설계·구현·검증이 모두 Claude Code |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립한다.** plan 커밋 `064c06a` 와 구현 커밋 `ee11eab` 가 갈려 있어 §0 의 자기 증명 방지 장치가 작동한다.
- 구현 커밋의 `plan.md` diff: 메타 `상태` 1줄(`READY → IMPL_DONE (r1)`) + `[구현자 기입]` 절 신설뿐이다(`git show ee11eab -- …/plan.md` — 변경 hunk 2개, `@@ -8,7` · `@@ -479,24`).
- **AC 변경 없음.** §7 표는 손대지 않았다 — AC18 을 "기준 정정 필요" 로 **보고만** 하고 원문을 남겼다(I3). §0 이 요구하는 처리 그대로다.
- Decision Ledger 변경: 없음. SUPERSEDED 0건.
- Product/UX Contract 변경: 없음.
- **채점에 사용한 원 기준**: `064c06a` 시점의 §3 Decision Ledger(D-001~D-013) · §5 상태 전이표 · §7 AC1~AC20 · §10 강제 지점 13.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-008 대기 화면 | 게이트 통과부터 복원 종료까지 메인 셸을 띄우지 않는다 | `auth-resume.resuming()` → `connectionState` → wire → `useProviderGate` → `rootFrame()` → `BootScreen` ✅ |
| D-009 refresh 만료 판정 | 값이 있고 지났으면 왕복 0회, 없으면 시도 | `AuthStore.refreshSecret`(`store.ts:478`) ✅ — 다만 값이 grant 에 **들어가는** 지점이 무검증(D2) |
| D-010 refresh 1회 | 루프 없이 단일 호출 | `refreshOnce`(`auth-resume.ts:151`) — 루프 부재가 곧 상한 ✅ |
| D-011 회복 대상 = `expired` 만 | `none`·`unknown` 은 건드리지 않는다 | `demoted()`(`auth-resume.ts:111`)가 진입 필터와 매 시도 직전 2지점 ✅ |
| D-012 refresh 에 `methods[0]` 게이트 없음 | 입력형이어도 refresh 는 시도 | `recoverExpired` 가 `refreshOnce` 를 `autoReloginable` **앞**에 둔다(`:180-182`) ✅ |
| D-007 복원 grant 는 통과 근거가 아니다 | refresh 결과도 `settleGrant` probe 를 통과해야 커밋 | `login.refresh` → `tokenCandidate` → `settleGrant`(`login.ts:387-388`) ✅ |

### end-to-end 흐름

```text
부팅 → bootstrap.run() → void authResume.run()
  → gate 순차 resume → gateOpen() true
  → resuming() = true  ─┬→ push 구독자(bootstrap.ts:374) → connectionState(…, true)
                        └→ invoke 핸들러(handlers/providers.ts:47) → connectionState(…, true)
  → renderer useProviderGate → rootFrame({resuming:true}) → 'waiting' → BootScreen label="resuming"
  → startRemaining(): probeTargets 병렬 → push → recoverExpired(remainingDefinitions)
       expired 마다 순차: refreshOnce(1) → 실패면 autoReloginable 이면 reloginOnce(3)
  → finally { remainingSettled = true; push }
  → rootFrame({resuming:false}) → 'app' → AppLayout
```

- **`AppLayout` 진입점은 `RootGate.tsx:55` 하나다**(`grep -rn "AppLayout" src/renderer --include=*.tsx` → 마운트 1건). 대기 화면을 우회하는 경로가 없다.

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ⚠️ **1건** | refresh 성공 응답이 새 refresh token 을 생략하면 회복 능력을 영구히 잃는다 → **D1** |
| false success 가능성 | 없음 | `refresh` 는 `settleGrant` 의 probe 를 통과해야 `'refreshed'` 다(`login.ts:388-390`). probe 거부 케이스 실측 통과 |
| partial failure/rollback | 없음 | 새 키 2개 → grant 저장이 커밋. 실패 시 `discardKeys(candidate.grant)` 로 옛 쌍이 그대로 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | §5 전이표 8행이 코드 경로와 1:1로 대응한다(§1 표) |
| 증상만 제거하고 상태가 남았는가 | 아니오 | refresh 실패는 상태를 바꾸지 않고 재로그인으로 이어진다 |
| 최적화가 잃은 재검증/취소 관측 | 없음 | `refresh` 도 `openAttempt` 로 세대를 연다 — `superseded` 는 `'unsupported'` 로 접혀 재로그인으로 넘어가지 않는다(`login.ts:386`) |
| 출력/요청 worst-case 상한 | `4N` 유지 | 나머지 Auth N × (refresh 1 + 로그인 3). refresh 는 루프가 없어 구조적으로 2회 불가 |

- **조용한 실패가 화면을 흔들지 않는다**: `refresh` 가 `settled()` 를 우회해 전역 `failed` step 을 내지 않는다(`login.ts:352-355` 주석 + 코드). 사용자가 시작하지 않은 동작이므로 의도된 선택이다.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 064c06a..8cf85ec
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | **0건** | 스크립트 1a 절 "(없음)" |
| 테스트 전용 참조 5건 | 정상 | `gateOpen`·`connectionInfo`·`ConnectionHandlerDeps`·`LoginDeps`·`createMemoryGrantPersistence` — 전부 같은 모듈 내부 사용 또는 타입·테스트 헬퍼 |
| 형제 정책 비대칭 | **0건** | 스크립트 3 절 "(없음)" |
| 신규 등록값의 기존 소비처 | 무영향 | `ProviderPlatformState` 소비처 3층 전수 확인 — `useProviders`·`useProviderPrincipal` 은 `resuming` 을 읽지 않고 읽을 이유도 없다 |
| producer ↔ consumer 파생 불일치 | **1건** | `TokenValue.refreshExpiresAt` → grant 쓰기 producer 가 무검증 → **D2** |
| 동일 규칙 중복 구현 / SSOT drift | **2건** | 모듈 헤더 주석이 거짓이 됐다 → **D3** · renderer 가 `resuming` 을 셀렉터 밖에서 한 번 더 읽는다 → **D5** |

- **테스트가 production 계약을 잠그는가**: 잠근다. `rootFrame.test.ts` 는 `./rootFrame` 에서 production `rootFrame` 을 import 하고 로컬 재구현이 없다. `providers.test.ts` 의 신규 케이스는 `vi.hoisted` 맵으로 **핸들러 본체를 잡아 invoke 결과를 단언**한다(등록 여부만 보던 이전과 다르다).

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 좌표 실재: `describe('createAuthResume — 방송 상한 1 + K (0187 D2 승계)')` 가 현재 `auth-resume.test.ts:337`, 2케이스가 `:338`·`:356`. **plan 이 적은 `:319`·`:320`·`:337` 은 이번 구현이 앞에 케이스를 넣어 밀린 값이다** — 같은 describe·같은 2케이스임을 이름으로 확인했다.
- `N회` 기준의 관측 주체: fake `AuthRuntime` 의 `refresh`·`login` 호출 로그(`log` 배열·`loginsOf`)다. grep 이 아니다 ✅
- 순서 기준의 관측 훅: `log` = `['refresh:wiki','login:wiki:1']` 배열 순서 ✅
- structural proxy 만으로 통과시킨 AC: **없음**. AC14 는 주석이 아니라 구독자 등록 순서를 `for (const recorderFirst of [true,false])` 로 실제로 뒤집어 단언한다(`:853-882`).
- **구현 보고를 증거로 쓰지 않았다** — 아래 §5·§7 의 수치는 전부 이번 턴에 다시 세거나 다시 돌린 값이다.

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 부팅 시점 `expired` 는 probe 없이 회복 대상 | ✅ | `:697` `loginsOf(log,'wiki')` = `['login:wiki:1']` | `recoverExpired` |
| AC2 | probe 후보 0건이어도 회복 패스가 돈다 | ✅ | `:721` `enter:` 0건 + wiki·jira 각 1회 로그인 | 조기 반환이 probe 블록 안으로 이동(`:198`) |
| AC3 | expired 에 `resume` 을 부르지 않는다 | ✅ | `:709` `log` 에 `enter:wiki` 없음 | probe 필터 `status==='valid'` 유지 |
| AC4 | refresh 가 재로그인보다 먼저 | ✅ | `:755` `log` = `['refresh:wiki','login:wiki:1']` | `refreshOnce` → `reloginOnce` |
| AC5 | refresh 성공이면 `login` 0회 | ✅ | `:769` `log` = `['refresh:wiki']` | `if (await refreshOnce(d)) continue` |
| AC6 | refresh 1회 · 실패면 재로그인 3회 | ✅ | `:784` `it.each(['failed','unsupported'])` — refresh 1 · login 1..3 | 루프 부재 = 상한 |
| AC7 | token+refreshKey 아니면 refresh 안 부름 | ✅ 3케이스 | `login.test.ts` `:527`(refreshKey 없음)·`:588`(session)·`:603`(browser-session token) 각 `calls` = `[]` | `login.refresh` 진입 판정 |
| AC8 | 만료면 0회 · **미선언이면 시도** | ✅ 3케이스 | `:549`(지남 0회)·`:561`(미선언 1회)·`:573`(미래 1회) | `AuthStore.refreshSecret` |
| AC9 | 선언 미구현이면 `unsupported` | ✅ | `:520` `resolves.toBe('unsupported')` | `if (!spec?.refresh)` |
| AC10 | probe 통과 후에만 커밋 | ✅ | `:506` `vaultKey` = 옛 키 · `secretOf` = `'old-access-value'` | `settleGrant` |
| AC11 | access·refresh 둘 다 새 세대 키 | ✅ | `:486` 두 키 모두 옛 키와 다르고 값이 `new-access`/`new-refresh` | `tokenCandidate.writeVault` |
| AC12 | `Grant.refreshExpiresAt` 영속·재파싱 왕복 | ✅ | `store-parse.test.ts:71`(왕복)·`:90`(숫자 아니면 그 필드만 빠짐) | `AuthStore.restore` → `parseGrant` |
| AC13 | `resuming` 이면 스피너 프레임 | ✅ | `rootFrame.test.ts` 7케이스, 그중 `복원이 진행 중이면 통과 후에도 대기한다` | `RootGate.tsx:35` |
| AC14 | `passed:true` 와 **같은 push 에** | ✅ | `:853` 두 등록 순서 모두 `seen.every(Boolean)` · `seen.length > 0` | 파생값 `resuming()` |
| AC15 | 종료 4경로 전부 false | ✅ 4/4 | `:884` 3경로(성공·회복·후보 0건) + `:903` 예외 1경로 | `finally` |
| AC16 | 게이트 미개방이면 false | ✅ | `:924` gate probe 실패 후 `resuming()` = false | `gateOpen()` 재사용 |
| AC17 | `connectionState` 가 채우고 wire 필수 필드 | ✅ | `connection-views.test.ts` 2케이스 + `providers.test.ts` invoke 케이스 + typecheck 3/3 | push·invoke **2 호출부 모두** |
| AC18 | 시도 0건 부팅의 방송이 `1 + K` 로 불변 | ❌ **미충족** | 기존 2케이스가 **무수정 통과하지 못했다** — `:338` 1→2 · `:356` 3→4 로 갱신됨 | 종료 push 가 무조건이 됐다 → **D4** |
| AC19 | gate Auth 는 refresh·재로그인 대상 아님 | ✅ | `:837`(refresh 0회) + `:606`(login 0회) | `remainingDefinitions` 만 순회 |
| AC20 | `auth.md §5.2` · `IPC_CONTRACT.md` 서술 | ✅ | `auth.md` 흐름도 3줄·규칙표 3행·대기 화면 문단 · `IPC_CONTRACT.md` `resuming` 필드 · `check-doc-inventory --check` 차이 0 | 문서 |

- **합계 재측정**: `✅ 19 · ⚠️ 0 · ❌ 1 = 총 20`. §7 의 `^| AC[0-9]+ |` 행을 직접 세어 분모 20 확인.
- 자기보고는 `✅ 19 · ⚠️ 1 = 20`. **불일치 1건** — AC18 을 ⚠️ → ❌ 로 내렸다. §0 이 요구하는 원 기준 채점이고, "기준이 틀렸다" 는 판정은 AC 충족이 아니다.
- **AC12 는 ✅ 로 둔다.** 그 AC 의 기준은 `Grant → 영속 → 재파싱` 왕복이고 그것은 잠겨 있다. `TokenValue → Grant` 쓰기는 어떤 AC 의 경계에도 없다 — **기준 밖 결함**으로 D2 에 적었다.
- **합계 사본 대조**: 본문 `19/20` ↔ trailer `Criteria-Met: 19/20` ↔ INDEX `AC 19✅/1⚠️ = 20` — **세 사본은 서로 일치한다**(0190 의 갈림 축은 재현되지 않았다). 검증자 재측정값과만 갈린다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 회복 대상 = 그 시점 `expired` | 진입 필터 · 매 시도 직전 (2) | `auth-resume.ts:180`(`continue`) · `:117`(`reloginOnce` 루프 머리) = 2/2 | ✅ |
| refresh 가능 판정 한 곳 | 진입 시 (1) | `login.ts:357-370` 4판정이 한 함수 안 = 1/1 | ✅ |
| refresh 1회 · 재로그인 3회 | 루프 조건 (2) | `refreshOnce` 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:47`) = 2/2 | ✅ |
| probe 통과 후에만 커밋 | 커밋 (1) | `login.ts:388` `settleGrant` = 1/1 | ✅ |
| 새 세대 키 2개 | 커밋 (1) | `tokenCandidate.writeVault`(`:824-833`) = 1/1 | ✅ |
| `refreshExpiresAt` 영속 | 부팅 파싱 (1) | `store-parse.ts:45` = 1/1 | ✅ 지점은 닫힘 · **표가 producer 를 못 셌다** → D2 |
| `resuming` 파생 | **2** — 조립 · `rootFrame` | 조립 push(`bootstrap.ts:367`) · 조립 invoke(`handlers/providers.ts:47`) · `rootFrame.ts:30` = **3/3** | ✅ 지점 수 정정 |
| `remainingSettled` 는 `finally` | 종료 (1) | `auth-resume.ts:210-218` = 1/1 | ✅ |
| 판정·상태의 문서 사본 | `plan.md` + `INDEX.md` (2) | 두 파일 모두 `IMPL_DONE (r1)` = 2/2 | ✅ |

- **plan 합계 13 · 실제 닫힌 지점 14**. 차집합: plan 13 ∖ 확인 14 = **0**, 확인 14 ∖ plan 13 = **1**(invoke 호출부). 구현 보고 `14/14` 와 일치한다.
- **독립 재측정으로 확인했다**: `grep -rn "connectionState(" src --include=*.ts --include=*.tsx | grep -v "\.test\."` → **2 호출부 + 정의 1**. plan §8 전수 조사가 적은 `N=1` 이 틀렸고 I1·I4 의 정정이 맞다.
- **표에 없는데 같은 불변식이 필요한 지점 — 1건 추가**: `TokenValue.refreshExpiresAt` → `Grant.refreshExpiresAt` **쓰기**(`login.ts:816-819`). §10 6행은 "직렬화는 `records()` 가 grant 를 그대로 쓰므로 자동" 이라 적었지만, grant 에 값이 **들어가는** 지점은 자동이 아니다 → D2.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `AuthMethod.oauth.refresh?(refreshToken): Promise<TokenValue>` | typecheck 3/3 · optional 이라 기존 선언 무변경 | `'failed'`(던짐) · `'unsupported'`(미구현) · 커밋 거부 3의미가 테스트로 잠김 | ⚠️ **4번째 의미 미정의** → D1 |
| `TokenValue.refreshExpiresAt?: number` | typecheck ✅ | `undefined` = "모른다 → 시도" 가 `:561` 로 잠김 | ⚠️ 쓰기 미검증 → D2 |
| `ProviderPlatformState.resuming: boolean` | 필수 필드 → typecheck 가 3층 전수 지목 | invoke·push 동일값이 각각 테스트로 잠김 | ✅ |

- **§15 가 요구한 "문서 예제를 `auth-definitions.ts` 에 채워 typecheck 후 되돌린다" 는 이번 구현에 흔적이 없다.** `AUTH_DEFINITIONS = []` 이라 세입자가 0이고, 대신 `login.test.ts` 의 `oauthWithRefresh` 가 실제 `AuthDefinition` 타입으로 `refresh` 를 구현해 같은 shape 을 typecheck 에 통과시킨다 — 등가 증거로 인정한다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- **AC 분모 20**: `awk '/^## 7\. Acceptance/,/^### AC 검증/'` + `grep -cE "^\| AC[0-9]+ \|"` → 20. AC1~AC20 연속, 결번 없음.
- **§10 지점 합계 13**: 행별 2+1+2+1+1+1+2+1+2 = 13. 내역 합 = 표기 총계 ✅.
- **`connectionState(` 호출부 2**: 위 §5 재측정. plan §8 의 `1` 은 오측이었다.
- **vitest 총 케이스 1,997**: 이번 턴 실측(`vitest run` → `Tests 42 failed | 1955 passed (1997)`). 구현 보고 `1,997` 과 총계 일치.
- **`scripts` 49/49 · suites 7**: `node --test "scripts/*.test.mjs"` → `# pass 49 # fail 0`.
- **0건 게이트의 정당한 예외**: `refreshExpiresAt` 미선언을 "만료" 로 접지 않는다(D-009). `:561` 이 그 예외를 보존한다 ✅.
- **worst-case 상한 재계산**: Auth 1건당 refresh 1 + 로그인 3 = 4회, probe 총 상한 `N × 4`. §14 계산과 일치. refresh 는 루프가 없어 상한을 코드 구조가 준다.
- **방송 총량 변화**: `1 + K` → **`1 + K + 1`**(항상). `auth.md §5.2` 는 이 값으로 갱신됐고, `auth-resume.ts:20-21` 은 갱신되지 않았다 → D3.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 대기 화면 전환 | `rootFrame()` 순수 셀렉터 7케이스 + wire 양쪽 호출부 | 스피너의 **시각 품질**(라벨 문구·전환 깜빡임) | 게이트 있는 빌드로 부팅해 메인 셸이 뜨기 전 스피너가 유지되는지 본다 |
| 재로그인 창이 스피너 위에 뜨는가 | 순서·횟수는 단위로 전건 | 실제 창 z-order | `browser-session` 나머지 Auth 를 만료시키고 부팅 |
| 실제 IdP refresh 왕복 | 3의미 contract test | 배포 선언의 실제 endpoint 동작 | `AUTH_DEFINITIONS` 에 실 선언을 채운 빌드 |

- **순수 로직을 사람에게 넘기지 않았다** — 프레임 판정을 `rootFrame.ts` 로 뗀 설계 덕에 화면 판정이 전부 단위 대상이다.

## 9. 게이트 재실행

- 적용 정본: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`. **`npm test` 를 쓰지 않았다**(DB 동작을 검증할 필요가 없다).
- 실제 실행 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**(exit code 아님):
  - typecheck — node·web·test **3/3, error 0**.
  - lint — **0 error / 1 warning**. warning 은 `useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`(0102 베이스라인, 이번 변경 무관).
  - vitest 전체 — **205 파일 · 1,997 케이스**, `1,955 pass / 42 fail`.
  - vitest 관련 스위트 — `auth-resume`·`connection-views`·`providers` handler·`features/auth`·`renderer/src/app` = **18 파일 / 267 케이스 전건 green**.
  - scripts — `# tests 49 # suites 7 # pass 49 # fail 0`.
  - doc-inventory — `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok: every relative markdown link resolves` · **차이 0**.
- **환경 기인 실패 분리**: 42 red 는 **5파일**(`app/chat-turn.continuity` · `features/extensions/builder` · `features/orchestration/fork` · `infra/db/migrate` · `infra/db/queries`)이고, `app/AGENTS.md:135` 가 적은 **알려진 5파일과 정확히 같은 집합**이다. 오류 서명은 `Module did not self-register` ×6 · `Electron failed to install` ×1 — 전부 ABI/egress 서명이고 변경 관련 실패는 0건이다. 구현 보고는 `npm rebuild better-sqlite3` 후 1,997/1,997 이라 했고, 이 환경은 그 rebuild 를 하지 않아 red 가 남았다.
- **게이트가 작업 트리를 바꿨는가**: 바꾸지 않았다. `npm run lint` 는 `--fix` 지만 실행 전후 `git status --short` 가 **둘 다 빈 출력**이다 — 검증자가 고친 코드를 검증자가 채점하는 자기 증명이 없다.
- **검증 중 실행한 명령의 잔여물**: `node_modules/`(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`)와 eslint 캐시뿐이고 둘 다 미추적 대상이 아니다. 적대 검증용 임시 파일 2건은 삭제 후 트리 clean 을 확인했다.

### 적대 검증 — 판정 기준을 한 단계 엄격하게

구현이 만든 검사 장치를 같은 기준으로 재실행하는 것은 재현이지 검증이 아니다(§8). 구현이 심지 **않은** 지점에 심었다.

| 변이 | 심은 곳 | 결과 | 판정 |
|---|---|---|---|
| `refreshExpiresAt` **쓰기** 제거 | `login.ts` `tokenCandidate` 의 `ifPresent('refreshExpiresAt', …)` 4줄 | `vitest run src/main/features/auth src/main/app` → **330/330 통과** | ❌ **눈이 없다** → D2 |
| refresh 응답에 새 refresh token 없음 | scratch 테스트로 실제 경로 실행 | `'refreshed'` 인데 `refreshKey` = `undefined` · 옛 refresh 키 vault 에서 삭제 · 2회차 refresh = `'unsupported'` | ❌ **미정의 계약** → D1 |

- 두 변이 모두 실행 후 원복하고 `git status --short` 빈 출력 + `vitest run src/main/features/auth` 189/189 green 으로 트리 복원을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | §9 ✅ |
| AC ↔ production path | 1:1 대조 + 재측정 | — | §5 — 자기보고와 2건 갈림 |
| 레이어/계약/문서 링크 | 기계 검증 | — | doc-inventory 차이 0 ✅ |
| AGENTS 위생 | 해당 없음 | — | 이번 변경에 `AGENTS.md` 수정 0건 |
| **D1 의 계약 방향** | 재현·영향 제시 | **결정** | refresh 응답이 refresh token 을 생략할 때의 의미를 정해야 한다 |
| **D4 의 AC18 정정** | 모순 제시 | **결정**(설계자) | D-008 과 AC18 중 무엇이 남는가 |
| 스피너 시각 품질 | 판정 로직은 기계 검증 | **시각 확인** | §8 |
| 신규 의존성 / PR merge | 0건 확인 | **승인** | 신규 의존성 0 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- **해당 없음** — 이번 range 에 `AGENTS.md` 변경 0건(`git show --stat ee11eab` 27 파일 중 없음).

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치 ✅ — `impl` · `IMPL_DONE (r1)` · `Claude (검증)` · `ee11eab` · 라운드 1 이 실제 상태와 맞는다.
- **비고 5줄 이내 ✅** — 행 전체가 937 바이트(한국어 약 350자)이고 상세는 `plan.md` 로 링크한다. 0190 의 13,190자 축은 재현되지 않았다.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- 구현 커밋 `ee11eab` trailer ✅ — `Agent: claude` · `Handoff` · `Status: implemented` · `Criteria-Met: 19/20` · `Criteria-Pending` · `Verified-By: pending` 이 root `AGENTS.md` 허용값을 따른다.
- 인용 커밋 해시 실재 ✅ — `git show ee11eab --oneline` 해석됨. INDEX·plan 의 대상 커밋이 같은 값이다.
- 이동/삭제한 reference·script: 0건.
- ⚠️ **관례 관찰(이번 라운드 회귀 아님)**: plan 커밋 `064c06a` 가 `Status: implemented` 를 달았다. 설계만 한 커밋이 "구현됨" 을 말한다. 0192 `e4f06c5` · 0193 `3e3f1d3` 도 같아 **기존 관례**이며, 허용값 표에 설계 단계를 뜻하는 값이 없는 것이 뿌리다 — 0194 의 결함이 아니라 `handoff-review` 대상으로 남긴다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| I1 — `connectionState(` 호출부가 1이 아니라 2, invoke 에 `resuming` 주입 | **타당 · 독립 재현됨** | 선조치 인정. grep 재측정으로 2 확인 |
| I2 — `absorbToken` 재사용 시 조용한 refresh 실패가 전역 `failed` step 을 띄운다 | **타당** | `tokenCandidate` 분리는 구현 세부이고 커밋 규칙이 여전히 한 곳이다 |
| I3 — AC18 은 성립 불가 | **타당하되 채점은 원 기준** | 원 기준으로 ❌. plan 정정은 설계자 몫 → D4 |
| I4 — §10 `resuming` 지점이 3 | **타당 · 독립 재현됨** | §10 정정 필요 → D4 와 함께 처리 |
| `MAX_REFRESH_ATTEMPTS` 상수 미생성 | **타당** | 값 1의 루프는 죽은 코드다. 루프 부재가 구조적 상한 |
| `BootScreen` 을 `label` variant 로 | **타당** | 문자열이면 `tr()` 이 화면 밖으로 샌다. 기본값 `'boot'` 로 기존 DOM 불변 |
| 놓친 문제 #1 "이번 변경이 넓히지 않았다" | **부분 부정확** | `recoverExpired` 가 `remainingDefinitions` 전체에 `demoted()` 를 부르고 후보 0건 조기 반환이 사라져 try 밖 호출 지점과 도는 부팅이 늘었다 → D6 |
| 놓친 문제 #3 handler 테스트가 본체를 안 불렀다 | **타당 · 선조치 확인** | 신규 케이스가 `handlers` 맵으로 본체를 잡아 invoke 결과를 단언한다 |

## 13. 파생 이슈

- [ ] **D1 — refresh 응답이 새 refresh token 을 주지 않으면 회복 능력을 영구히 잃는다.** RFC 6749 §6 은 AS 가 새 refresh_token 을 생략할 수 있다고 정하는데, `tokenCandidate` 는 `token.refreshToken === undefined` 면 `refreshKey` 를 만들지 않고(`login.ts:806-809`), `settleGrant` 의 `discardKeys(previous, candidate.grant)`(`:549`)가 옛 refresh 키를 vault 에서 지운다. 실측 3관측: `'refreshed'` 반환 · 새 grant `refreshKey` = `undefined` · 2회차 `refresh` = `'unsupported'`. **결과: 0194 가 만든 창 없는 회복이 첫 성공 이후 사라진다.** 되돌리기 어려운 공개 포트의 미정의 의미이므로 **해결안을 고르지 않고 결정으로 올린다** — ⓐ 새 값이 없으면 옛 `refreshKey` 를 승계할지, ⓑ 선언이 반드시 되돌려주도록 계약 문서에 못박을지.
- [ ] **D2 — `refreshExpiresAt` 쓰기 경로에 눈이 없다.** `tokenCandidate` 의 `ifPresent('refreshExpiresAt', …)` 4줄을 지우고 `vitest run src/main/features/auth src/main/app` 을 돌리면 **330/330 통과**한다. D-009 의 영속 사슬(write → persist → parse → `refreshSecret`) 중 write 만 무검증이라, 이 필드가 grant 에 영영 들어가지 않아도 게이트가 green 이다. §10 6행이 "직렬화는 자동" 이라 적어 producer 지점을 세지 않은 것이 뿌리다. 회귀 1건 + §10 행 정정이 필요하다.
- [ ] **D3 — `auth-resume.ts:20-21` 모듈 헤더가 이번 변경으로 거짓이 됐다.** "**재로그인이 0건이면 이 상한은 그대로다** — 시도가 있었을 때만 그 결과를 알리는 push 가 한 번 더 붙는다" 인데, 종료 push 는 이제 `finally` 에서 **무조건** 나간다(`:217`). `docs/arch/backend/auth.md §5.2` 는 같은 사실을 고쳤으므로 **두 사본이 갈렸다**. `bootstrap.ts:404-405` 도 종료 push 를 서술하지 않아 불완전하다.
- [ ] **D4 — AC18 과 §16 이 shipped 코드와 모순인 채로 남아 있다.** AC18 은 "기존 2케이스 무수정 통과" 를 요구하고 §16 은 "시도 0건이면 불변 — **유지**" 라 적었지만, D-008 이 요구하는 대기 화면은 `resuming:true` 를 거두는 push 없이 걷히지 않는다. **사용자 결정(D-008) > 설계자 AC(AC18)** 이므로 AC18·§16·§10 `resuming` 행(2→3)을 정정해야 한다 — 설계자 몫이고 이번 라운드에 검증자가 고치지 않는다.
- [ ] **D5 — renderer 가 `resuming` 을 셀렉터 밖에서 한 번 더 읽는다.** plan §12 는 "그것을 읽는 곳은 `rootFrame()` 하나다 … 합성을 셀렉터 한 곳에 가둔다" 인데 `RootGate.tsx:42` 가 `gate.resuming` 을 직접 보고 라벨을 고른다. 파생 결과: `bootPhase !== 'ready'` 이면서 `resuming:true` 인 조합에서 **부팅 스피너가 "연결 복원" 라벨을 단다**. 단위 테스트 없음. 영향은 sr-text·`data-screen-label` 뿐이라 경미하다.
- [ ] **D6 — unhandled rejection 노출이 넓어졌다.** `recoverExpired` 가 probe 후보가 아니라 `remainingDefinitions` **전체**에 `demoted()`(→`tryBind().snapshot()`)를 부르고 후보 0건 조기 반환도 사라져, try 밖에서 던질 수 있는 지점과 배치가 도는 부팅이 모두 늘었다. `auth-resume.test.ts:903` 이 `run()` 의 reject 를 단언하고 production 은 `bootstrap.ts:411` 의 `void authResume.run()` 이다. `finally` 덕에 대기 화면 잠김은 없다 — 구현 보고의 "이번 변경이 넓히지 않았다" 만 정정한다.

> `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관했다.

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상: 있다.** "한 값이 여러 지점에서 성립해야 하는데 설계가 지점을 적게 셌다" 가 0193 `attempted` → 0194 `resuming`(I4) → 이번 D2(`refreshExpiresAt` producer)로 3연속이다. 세 번 모두 뿌리는 §10/§8 표의 `N` 이 실측 없이 적힌 것이다.
- **관련 plan 지침/AC 존재 여부**: D1 은 §15 "semantics 검증" 이 3의미만 열거해 4번째를 못 봤다. D2 는 §10 6행이 "자동" 이라 적어 지점에서 빠졌다. D3·D5 는 §12·§16 이 규칙을 적었으나 사본 갱신 지점을 세지 않았다.
- **사용자 결정 변경 근거: 없다.** D-001~D-013 전건 ACTIVE, SUPERSEDED 0건. AC18 문제는 사용자 변심이 아니라 설계 내부 모순이다.
- **반복된 검증 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red. 0193 r1·r2 와 같은 서명이며 이번에도 변경 무관으로 분리됐다.
- 현재 라운드: **1**. 3을 넘지 않았으므로 `handoff-review` 진입 조건은 아니다.

## 15. 결론

- 상태: **FAIL (r1)**
- **Product/UX 및 ACTIVE Decision**: 핵심 흐름은 충족한다 — 대기 화면(D-008)·refresh 우선(D-010)·만료 grant 회복(D-011)·grant 기준 판정(D-012)이 전부 production path 로 도달한다. **다만 D-009 의 영속 사슬에 눈이 없고(D2), refresh 회복이 1회용이 될 수 있다(D1).**
- **AC 충족**: 검증자 재측정 `✅ 19 · ⚠️ 0 · ❌ 1 = 20`. 자기보고 `19/20` 과 AC18 1건에서 갈린다 — 판정 기호만 다르고 ✅ 개수는 같다.
- **강제 지점**: `14/14`. plan 이 적은 13 + invoke 1. 독립 재측정으로 확인했고 구현 보고와 일치한다. **표에 없던 지점 1건 추가 발견**(`refreshExpiresAt` 쓰기).
- **기준 밖 결함**: D1(중대) · D2(검사 공백) · D3(SSOT drift) · D5·D6(경미).
- **repository operation checks**: INDEX·trailer·해시·doc-inventory 전건 정합. plan 커밋의 `Status: implemented` 는 기존 관례라 이번 결함이 아니다.
- **남은 사람 확인**: D1 의 계약 방향 결정 · D4 의 AC18 정정 승인 · 스피너 시각 품질.
- **다음 단계**: 구현자(Claude)가 D2·D3·D5·D6 을 닫는다. **D1·D4 는 사용자/설계자 결정을 받은 뒤** 착수한다 — 검증자가 해결안을 고르지 않는다.
