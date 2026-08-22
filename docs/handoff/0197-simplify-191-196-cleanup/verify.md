# Verify — 0197-simplify-191-196-cleanup (r1)

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md).

## 판정

**PASS (r1)** — AC **10✅ · 2⚠️ · 0❌ / 12**, 강제 지점 **6/8 완전 · 2/8 부분**.
⚠️ 2건과 부분 2건은 **전부 환경 한계**이며 미구현이 아니다 — posix 축은 linux(`sep === '/'`)에서
변이할 수 없고 `bootstrap.ts` 는 electron 의존이라 vitest 대상이 아니다.
기준 밖 결함 3건(W1~W3)은 전부 비차단이다.

| 항목 | 값 |
|---|---|
| 검증 범위 | `2cd8c89..HEAD` — 구현 `51a79ec` · 보고 `83e900d` |
| 검증자 | Claude Code (독립 검증) |
| 일자 | 2026-08-22 |
| 라운드 | 1 |

## §0 기준선

**성립한다.** 구현 커밋 `51a79ec` 이 `plan.md` 를 **한 줄도 건드리지 않았다**
(`git show 51a79ec --name-only | grep -c plan.md` → **0**). 설계 커밋 `2cd8c89` 이후 HEAD 까지
`plan.md` 의 AC 행·Decision 행 변경도 **0** 이다
(`git diff 2cd8c89..HEAD -- …/plan.md | grep -E "^[-+]\| AC[0-9]|^[-+]\| D-0"` → 빈 출력).
설계·구현·보고가 세 커밋으로 갈려 자기 증명 방지 장치가 작동한다.

## §6 AC 1:1 — 검증자 재측정

| # | 판정 | 검증자가 관측한 것 (자기보고와 **독립**) |
|---|---|---|
| AC1 | ✅ | `GrantBase` 에 `mutantProbe: number` 심음 → 좌표 **6건 전부** 보고: `login.ts(618,798,859)` · `store-parse.ts(50,61,75)`. 되돌린 뒤 `error TS` **0** |
| AC2 | ✅ | **선택** 필드 `mutantProbe?: number` 심음 → `runner.ts(225,39) TS2345`. 구현자가 최초에 쓴 *필수* 필드 변이는 변별력이 없다는 지적이 맞다 — 옛 `: TokenValue = { …ifPresent }` 도 필수 필드에는 깨진다 |
| AC3 | ✅ | 공유 lookup 의 fragment 폴백 제거 → `oauth.test.ts`·`runner.test.ts` **양쪽** 실패(2 failed / 50 passed). 되돌리면 **52/52**. 빈 문자열 정책이 갈래별로 유지됨이 그 52 에 포함된다 |
| AC4 | ⚠️ | 판정 3지점 중 **2개** 검증: ① `.test.ts` 제외 삭제 → 3 failed ② 재귀 삭제 → 1 failed ③ strip 항등화 → 2 failed. **posix 축은 linux 에서 심을 수 없다**(`sep === '/'`) |
| AC5 | ✅ | 구현 커밋이 `runner.test.ts` 의 전선 단언을 **한 줄도 고치지 않았다**(`git diff 2cd8c89..51a79ec` 에서 `toHaveBeenCalledWith`·`method`·`content-type` 매칭 **0줄**). whoami 단언은 `objectContaining` 이 아닌 **정확 일치** |
| AC6 | ✅ | **검증자가 직접 변이**: `bootPhase` 를 `string` 으로 되돌리고 테스트에 `'nonexistent'` 를 넣으면 **통과한다**(유일한 에러는 미사용 import `TS6133`). `BootPhase` 복원 시 `TS2322` 로 거부 |
| AC7 | ⚠️ | invoke 축 green(`providers.test.ts` 3/3). `bootstrap.ts` 구조: `resuming` 정의 1(`:368`) · 사용 2(`:370`·`:391`). **bootstrap 축 변이 불가** — `deployment-wiring.test.ts:15` 가 "electron 을 물어 vitest 대상이 아니다" 를 명시 |
| AC8 | ✅ | 옛 철자 7종 `app/src` 전수 **0건**. `valuePath` 잔존 6건은 전부 `SessionLookup`(D-008 이 유지를 요구) + D-2 설명 주석 |
| AC9 | ✅ | `SessionTokenExchange` 필수 3(`path`·`code`·`present`) · 선택 4 유지. `SessionCodeExchange` 3필드 전부 `?` 유지 |
| AC10 | ✅ | **검증자가 실제로 실행했다** — 가이드 §2-b 예제를 `SessionTokenExchange` 에 대입 → `tsc -p tsconfig.test.json` **0 error**. 옛 철자 `valuePath` 대입은 `@ts-expect-error` 가 소비됨(= 실제로 거부됨) |
| AC11 | ✅ | 새 철자 5개 양쪽 ≥1 — `urlParam` 23/8 · `bodyField` 7/3 · `extraFields` 10/4 · `accessTokenPath` 6/3 · `returnedToOrigin` 6/2 (app/src · docs/arch+guides) |
| AC12 | ✅ | 베이스라인 `202 passed (207)`·`2016 passed (2058)` → 현재 `202 passed (207)`·`2017 passed (2059)`. **실패 집합 불변**, +1 은 신규 AC2 테스트 |

**합계 검산**: ✅ **10** · ⚠️ **2** · ❌ **0** = 총 **12**. 분모 12 는 §7 표를 다시 세었다(AC1~AC12).

## §6 강제 지점 표 — AC 와 별개로 걷는다

**술어를 해법 이름(`compact<`)이 아니라 불변식의 주어로 바꿔 다시 셌다** — 0194 r4 가 그 술어
때문에 `store-parse.ts` 3리터럴을 분모에서 놓쳤던 자리다.

| 계약 | §10 지점 수 | 검증자 재측정 | 차집합 |
|---|---|---|---|
| `Grant` 조립 | 6 | `rg "kind: '(secret\|token\|session)'"` → 14 hit 중 **Grant 조립은 6** (나머지 8은 `AuthResult` union 선언 3 · `Carrier` 타입/생성 2 · `AuthResult` 반환 3) | **0** |
| `TokenValue` 조립 | 1 | in-repo 조립은 `runner.ts:225` 하나. `oauth-runner.ts:210` 은 배포가 만든 객체를 **통과**시킬 뿐 조립이 아니다 | **0** |
| URL 추출 규칙 | 1 (소비자 2) | `rg "url.hash.replace"` → **1**(`url-params.ts`). 개명 전 2 → 1 | **0** |
| 위생 스캐너 | 3 | 2 검증 · 1 불가(posix) | **1 (환경)** |
| `resuming` 일치 | 2 | 1 검증 · 1 불가(electron) | **1 (환경)** |

### 스캐너는 이번 라운드 산출물이라 **한 단계 엄격하게** 재측정했다

§8 이 요구하는 대로, 구현자가 이번에 만든 게이트를 같은 기준으로 재실행하지 않고 기준을 바꿨다.

- **대상 집합**: 스캐너의 `sourceFiles(src/main)` 결과와 `find … -name '*.ts' ! -name '*.test.ts'`
  의 **양방향 차집합이 0**, 집합 크기 >100. (임시 테스트로 측정 후 제거 — 트리 잔여 0)
- **실재 판정**: `stripCommentsAndStrings` 적용 후 **비주석 줄만** 남긴 더 엄격한 기준으로
  `features/auth` 재측정 → `.cookies` 위반 **0**. 그 `0건` 이 전수를 뜻한다.

## §2 역방향 탐색 — 기준 밖에서 찾은 것

| # | 관측 | 판정 |
|---|---|---|
| **W1** | `infra/source-scan.ts` 의 `sourceFiles`·`toPosix` 가 **export 인데 외부 소비처 0** — 둘 다 같은 파일 `scanOffenders` 안에서만 쓰인다(`rg` 로 외부 참조 0건 확인). `stripCommentsAndStrings` 는 두 가드가 자기 술어 자가검사에 쓰므로 export 가 정당하다 | **비차단**. 동작·보안 영향 0. 다만 *불필요한 표면*이라 이 handoff 의 취지와 어긋난다 — 후속에서 `scanOffenders`·`stripCommentsAndStrings` 둘만 export 로 좁힌다 |
| **W2** | 구현 커밋 `51a79ec` 의 `Criteria-Met: 11/12` 와 보고 커밋 `83e900d` 의 `10/12` 가 **갈렸다**. 정본은 **10/12**(plan 본문 합계 검산·INDEX·본 문서) | **비차단**. trailer 는 되돌릴 수 없는 사본이라 `51a79ec` 의 값은 남는다. 0190 r1(본문 `14/17` ↔ trailer `13/17`)과 **같은 축의 재발** |
| **W3** | `doc-gate.sh check` 가 시제 축에서 exit 1 — `envKey` 사이트가 baseline `:390` 인데 실제 `:438` | **비차단 · 선재**. 내 변경을 `git stash` 한 트리에서 **바이트 동일한 출력**을 확인했다. `docs/handoff/0192-*/baselines/` 는 다른 handoff 산출물이고 D-007 범위 밖 |

**미배선·죽은 코드**: W1 외 없음. 신규 export 12종의 프로덕션 참조를 전수 확인했고
`scanOffenders` 만 test-only 인데 그것은 **위생 가드 전용 헬퍼라 설계 의도대로**다.

## §3 Product/UX ↔ ACTIVE Decision

| Decision | 판정 | 관측 |
|---|---|---|
| D-001 동작 불변 | ✅ | AC5(전선 불변) · AC12(실패 집합 불변) · 제어 흐름 변경 0 |
| D-002 `refreshTokenPath` 유지 | ✅ | `rg refreshTokenPath app/src` → 계약·구현·테스트에 살아 있음. 의미 불변 |
| D-003 승격은 diff 안만 | ✅ | `asNumber`/`asString` 소비자는 `store-parse.ts` 하나. `claude-map.ts` 의 private `num` 과 인라인 10곳 미변경 |
| D-004·D-006 명명 | ✅ | 개명 11건이 전부 ⓐ모순 또는 ⓑ중의 기준에 걸린다. 취향 개명 0 |
| D-005 철자만 | ✅ | AC9 — 필드 개수·선택성 불변 |
| D-007 handoff/archive 미수정 | ✅ | `git diff --stat` 에 `docs/handoff/019[1-6]`·`docs/archive` **0 파일** |
| D-008 `SessionLookup.valuePath` 유지 | ✅ | AC8 의 잔존 6건이 그것 |

**사용자 관측 변화**: 앱 사용자 **0**. 배포자(계약 철자)·운영자(로그 키)만 달라지며, 배포자
쪽은 옛 선언이 `TS2353` 으로 **빌드에서 즉시** 깨져 조용히 실패하지 않는다.

## §8 게이트 — 검증자 실행 산출

| 게이트 | 산출 (exit code 아님) |
|---|---|
| `npm run typecheck` | 3분할 전부 `error TS` **0** |
| `./node_modules/.bin/vitest run` | `Test Files 5 failed \| 202 passed (207)` · `Tests 42 failed \| 2017 passed (2059)` |
| 환경 분리 | 5파일 42케이스 전부 `Module did not self-register: better_sqlite3.node`. `app/AGENTS.md` 예고 5파일과 **일치**, 변경 무관 |
| `check-doc-inventory.mjs --check` | 3축 ok — `generated doc ok (9 items, 76 channels)` · prose ok · links ok |
| `doc-gate.sh check` | 심볼 미분류 0·잔류 0 / 경로 미등재 0·잔류 0 / **시제 미판정 1·잔류 1 → exit 1 (W3, 선재)** |
| 트리 잔여 | `git status --short` **빈 출력** — 검증 중 만든 임시 테스트 2건 제거 완료 |

`npm run lint` 는 `--fix` 로 트리를 쓰므로 **검증자가 다시 돌리지 않았다**(자기 실행분이 채점
대상에 섞인다). 구현 턴의 관측값 `0 error · 1 warning`(미변경 파일 `useTranscriptVirtualizer.ts`,
선재)을 그대로 인용한다 — 이 축은 CI 가 재판정한다.

## §9 Repository operation checks

| 항목 | 판정 |
|---|---|
| commit trailer 허용값 | ✅ `Agent: claude` · `Status: designed\|implemented` · `Verified-By: pending` 전부 허용값. 단 W2 의 `Criteria-Met` 불일치 |
| 인용 해시 실재 | ✅ `git show 51a79ec -s` 확인 |
| `INDEX.md` 비고 5줄 | **수정함** — 구현 턴 비고가 7문장·654자로 상한을 넘어 이번 턴에 3문장으로 줄였다 |
| `AGENTS.md` 변경 | 해당 없음 (이번 diff 에 없음) |
| 레이어 경계 | ✅ lint `boundaries` 0 error — `features/auth → infra/source-scan` · `infra/net → infra/source-scan` 둘 다 허용 간선 |

## 못 본 것 (명시)

- **실제 SP 로그인 왕복** — 폐쇄망 배포 선언이 in-tree 에 없어(`AUTH_DEFINITIONS` 빈 배열)
  교환 경로의 실기는 불가능하다. 사람/실배포 몫.
- **windows 러너의 posix 축** — 이 환경에서 심을 수 없다. CI(windows-latest)가 판정한다.
- **`bootstrap.ts` 배선** — electron 의존. 구조 관측으로만 확인했다.
- **`npm run lint` 재실행** — 위 사유로 구현 턴 관측값 인용.

## Review Signals — 사실만

- **이전 라운드와 같은 축인가**: 예 2건. ① `compact` 전수 조립이 0194 r3→r4 에 이어 세 번째
  라운드에서 7번째 조립부(`TokenValue`)로 나왔다 — 술어를 해법 이름으로 세면 분모가 좁아진다는
  같은 형태다. ② `Criteria-Met` 사본 갈림(W2)이 0190 r1 과 같은 축이다.
- **막았어야 할 plan 지침·AC 가 있었는가**: ① 은 0194 §10 이 `Grant` 조립만 열거했다.
  ② 는 `handoff-impl §8` 이 "그 줄을 쓴 뒤 trailer 를 적는다" 로 이미 지시하고 있었고, 구현자가
  AC4 를 뒤늦게 ⚠️ 로 내리면서 앞 커밋 trailer 를 갱신하지 못했다.
- **사용자 결정 변경 근거**: 없음 — D-001~D-008 전부 ACTIVE 유지.
- **반복된 검증 환경 한계**: better-sqlite3 ABI(5파일 고정) · `bootstrap.ts` vitest 불가 ·
  posix 축 linux 불가. 셋 다 이전 handoff 에서도 반복 관측됐다.

## 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| W1 | `source-scan.ts` 의 `sourceFiles`·`toPosix` export 에 외부 소비처 0 | verify r1 §2 | 후속에서 export 를 `scanOffenders`·`stripCommentsAndStrings` 둘로 좁힌다 | open (비차단) |
| W2 | `51a79ec` trailer `Criteria-Met: 11/12` ↔ 정본 `10/12` | verify r1 §9 | 되돌릴 수 없다. 정본은 plan 본문·INDEX·본 문서의 **10/12** | 기록 |
| W3 | `doc-gate.sh` 시제 축 baseline 라인 드리프트(`envKey` :390→:438) | verify r1 §8 | **선재**. 0192 baseline `regen` 이 필요하나 그 handoff 소관 | open (범위 밖) |
