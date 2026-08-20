# Verify — 0194-auth-refresh-and-resume-window

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
