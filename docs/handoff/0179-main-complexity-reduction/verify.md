# Verify — 0179-main-complexity-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0179-main-complexity-reduction` |
| 검증자 | Claude Code |
| 일자 | 2026-08-06 |
| 대상 커밋 | `4f590e1`(1) · `98e2bef`(2) · `83bd3a9`(3) · `e9b9214`(4) · `cd88f88`(문서) |
| 라운드 | 1 |
| 상태 | **PASS (조건부 — A15 미충족을 §결론에서 명시)** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 모두 Claude 한 세션.** 교차 검증이 없으므로 §비판적 검토·§역방향 탐색을 먼저 돌리고, 매트릭스는 그 뒤에 열었다. 실제로 **매트릭스에서는 결함이 0건 나왔고 결함 3건이 전부 앞의 두 절에서** 나왔다 — 자기 기준을 자기가 대조하면 통과가 기본값이라는 0177 의 관찰이 이번에도 재현됐다 |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

> `git diff 501ea03..HEAD -- app/src` (108 파일 / +2,965 / −1,975)를 남의 PR 처럼 통독한 결과.

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·동시 호출·종료 중·권한 거부) | **신규 실패 모드 없음** | 이번 변경은 **네트워크·DB·파일 I/O 를 하나도 추가하지 않는다**(신규 14모듈 전부 기존 호출을 옮겨 담았을 뿐). 종료 중 경로는 오히려 강화됐다 — `admitChatSend` 의 업데이트 게이트가 **첫 단계로 고정**돼(`send.ts:66`) `ctx.registry.getActive()` 보다 앞선다. 동시 호출(lease CAS)·부분 실패(finally 2단)는 코드가 그대로 이동했고 통합 3종이 구동한다 |
| **잘못된 성공(false success)** 이 가능한 경로 | **1건 검토 후 무해 판정** | `acquireTurnRuntime` 이 실패를 `{ok:false}` **+ `runtime` 핸들**로 돌려주는 3-상태 계약(`runtime-entry.ts:29-35`)이 위험 후보였다 — "실패인데 핸들이 있다" 를 호출자가 성공으로 오독하면 런타임이 이중 반납된다. 실측: `send.ts` 는 `leaderRuntime = entry.runtime` **뒤에** `if (!entry.ok) return` 하므로 ① 활성화 실패(`runtime:null`) → 모듈이 이미 close, 외부 finally 는 null 이라 skip ② 활성화 후 중단(`runtime` 있음) → 외부 finally 가 close. **원본 `chat-turn.ts:626-630`·`:1243` 의 두 분기와 1:1 대응**한다 |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | **예 — 되돌릴 것이 없다** | DB 마이그레이션 0 · 새 파일 쓰기 경로 0 · IPC 계약 0(82종 유지) · 외부 상태 0. 전부 소스 이동이라 `git revert` 4개로 원복된다 |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **A2 만 다르게 했고, 그것을 D1 로 보고했다** | plan §AC A2 는 `_example/` 삭제를 요구했으나 구현은 **철회**했다. 치환이 아니라 명시 철회이고 근거(`modules/AGENTS.md` 가 복사 절차로 지시)가 검증에서 재확인된다 — `rg '_example' app/src/main/features/providers/static/modules/AGENTS.md` = 3건. 나머지 18개 기준은 문장과 코드가 일치 |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘지 않았다** | 선조치 4건(D1 A2 철회 · D3 신규 export 정리 · D4 회귀 신설 · D5 arch 문서) 중 **인수 기준을 바꾼 것은 D1 하나**인데 `⚠️` 가 아니라 `✅` 로 적혔다. **경계상 `⚠️ 보고만` 이 옳았다**(AC 변경 = 설계 변경). 다만 ⓐ 방향이 *범위 축소가 아니라 삭제 철회*(보수적)이고 ⓑ 사용자 결정 ①(인증/커넥터 플랫폼 불가침)과 같은 결을 지킨 것이라 **실질 피해 없음**으로 판정하고 D6 으로 기록만 남긴다 |

### 추가 확인 — 순수 모듈이 정말 순수한가

`admission`·`turn-context`·`continuation` 3종이 "순수" 라는 주장은 이 작업의 핵심 산출이므로
별도 확인했다: **`rg 'sendChatEvent|getLogger|ctx\.db|await ' app/src/main/app/chat-turn/{admission,turn-context,continuation}.ts` = 0건**.
electron import 은 3종 모두 없다(`turn-context`·`continuation` 은 electron 을 아예 안 import,
`admission` 도 마찬가지) — 그래서 신규 테스트 25건이 electron mock 없이 돈다(실측: 세 테스트
파일 어디에도 `vi.mock('electron')` 이 없다).

## 역방향 탐색 (매트릭스 전 선행)

> `bash .agents/skills/handoff-verify/scripts/scan-surface.sh 501ea03..HEAD` (95 파일 대상)

| 후보 | 판정 | 근거 |
|---|---|---|
| **1a) 값 export 미사용 — 0건** | 정상 | plan 이 "배선한다" 고 한 것 중 미배선 0. 신규 14모듈의 모든 export 함수가 실제 호출자를 갖는다 |
| **1b) 타입 전용 export 미사용 — 0건** | 정상 | 초기 스캔에서 11건이 나왔고(신규 `*Deps`·`*Input`·`*Result`), **구현이 D3 으로 module-local 화**해 0이 됐다. 검증 시점 재실행으로 확인 |
| 2) 테스트에만 등장 — 32건 | **전부 정상(의도된 테스트 표면)** | 32건 중 **31건이 이번 변경 이전부터 있던 것**(`safeProjectName`·`parseOrcaFile`·`MIGRATION_NAMES` 등 — 순수 함수를 테스트하려고 연 표면). 신규는 `turn-context.ts::resolveTurnCwd` 1건뿐이고, 같은 파일의 `buildTurnContext:117` 이 실제로 호출한다(스크립트는 *파일 간* 참조만 세므로 오탐). **죽은 코드 0** |
| 3) 형제 파일 정책 비대칭 — 0건 | 정상 | `redirect:`·`credentials:`·`sandbox:` 등 정책 키워드를 건드린 파일이 없다(이번 변경에 네트워크 코드 0) |

### 스크립트 밖 추가 탐색

- **인수 기준의 핵심 동사가 테스트에 등장하는가** — A8~A13 의 동사(`admitChatSend`·`leaseKeyFor`·
  `checkContinuitySource`·`checkBusyReservation`·`buildTurnContext`·`buildListenRequest`·
  `buildFlushRequest`) **7/7 전부** 신규 테스트 파일에 등장. A16 의 `registerSkillsHandlers` 외
  4종도 `misc-split.test.ts` 에 등장.
- **plan 이 "N곳" 이라 적은 것 재-grep** — §3 참조. **1건이 틀렸고 검증에서 고쳤다**(아래 D7).
- **회귀 테스트가 실제로 회귀를 잡는가(변이 확인)** — `misc-split.test.ts` 에서
  `registerCostHandlers(ctx)` 호출을 주석 처리하니 `expected [ …(20) ] to deeply equal [ …(25) ]`
  로 **실패**했고, 복구하니 통과했다. 공허하지 않은 단언임을 실측했다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 ①(§A15) — "목표 수치를 코드 형태를 보기 전에 정한 것이 잘못" | **타당.** 344줄을 더 쪼개려면 10필드 deps 를 넘기는 wiring 모듈이 필요하고, 그건 사용자가 지목한 "어설픈 재사용" 을 새로 만드는 것이다. 숫자를 위해 코드를 비틀지 않은 판단이 옳다 | 매트릭스 A15 = ❌ 로 정직 기록. 파생 이슈 D2 유지 |
| 이견 ②(§설계 4단계 표) — "합계 27 vs 참조 26 불일치 서술이 틀렸다" | **타당.** 재측정: `misc.ts` 분해 전 `CHANNELS.` 참조 26 = `ipcMain.handle` 등록 26. `installStatus` 는 send 채널이라 애초에 없었다 | A16 을 등록 26개 기준으로 대조(통과) |
| 선조치 D1(A2 철회) — `✅ 구현함` 으로 표기 | **경계 위반(경미).** AC 변경은 `⚠️ 보고만` 이 옳았다 | **D6 신설** — 절차 기록. 결과 자체는 보수적이라 재작업 불요 |
| 선조치 D3·D4·D5 | **전부 정당한 `✅`** — 구현 세부(D3)·명백한 누락(D4 검증 수단 부재)·불가피한 연쇄(D5) | 매트릭스 A5·A7·A19 증거로 채택 |

## 요구사항 충족 매트릭스

> 인용 수치는 **전부 이 검증 세션에서 재측정**했다. `Criteria-Met` 을 증거로 쓰지 않았다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| A1 | `conformance.ts`+테스트 삭제 · `rg` 0건 · vitest 파일 −1 | ✅ | `rg 'conformanceOf\|StandardConformance' app/src` = **0건** · `git show --stat 4f590e1` 에 두 파일 `D` · 1단계 후 vitest **203 파일**(베이스라인 204) |
| A2 | `_example/` 3파일 삭제 | ❌ **철회** | 구현이 D1 로 명시 철회. `ls app/src/main/features/providers/static/modules/_example/` = 3파일 존재. **근거 재확인**: `modules/AGENTS.md §구현 절차 1` 이 이 파일들의 복사를 배포 1단계로 지시 — 삭제하면 유지하기로 한 seam 을 채울 방법이 사라진다. **철회가 옳다** |
| A3 | `external-correction.ts`+`remainingUsd` 삭제 · `UsageTracker` 2인자 · 브로드캐스트 유지 | ✅ | `tracker.ts:13-21` 생성자 2인자 · `rg 'external-correction\|remainingUsd' app/src/main/features/usage/tracker.ts` = 0건 · `features/usage/tracker.test.ts` **무수정 통과** · 프로덕션 경로 `bootstrap.ts:363→369` 유지 |
| A4 | `RuntimeCompleteRequest` 삭제 · `UsageMapContext`/`UsageSampleFailureReason` export 유지 | ✅ | `rg 'RuntimeCompleteRequest' app/src` = **0건** · `contracts/usage-report.ts:29`·`usage-source.ts:34` 에 `export` 유지, 각각 같은 파일 `:44`·`:50` 계약 시그니처가 사용 · typecheck 3/3 |
| A5 | 무참조 export **0** / 테스트 전용 유지 | ✅ | 인벤토리 재실행 → **완전 무참조: 0 / 테스트에서만 참조: 51**. (plan 은 52 를 예상했으나 51 — `isValidCron` 이 D3 에서 삭제돼 1 감소. 아래 D7) |
| A6 | `usage/boundaries.ts`+테스트 삭제 · `tracker` 가 `shared/time/clock` 직행 · 회귀는 원본이 잠금 | ✅ | `tracker.ts:10` `from '../../../shared/time/clock'` · `shared/time/clock.test.ts::"boundaries — 로컬타임 day/week/month 시작 epoch ms"` 통과 · `features/usage/tracker.test.ts` 무수정 통과 |
| A7 | `cron-validate.ts` 삭제 · `scheduler` 가 `infra/cron` 직행 · **잘못된 cron 은 등록 시점 throw** · 배럴 re-export 제거 | ✅ | `scheduler.ts:5` `from '../../infra/cron'` · `scheduler/index.ts` 에 cron re-export 없음 · **신규 회귀** `features/scheduler/scheduler.test.ts::"잘못된 cron 표현식은 등록 시점에 거부한다"` (D4 — plan 이 적은 검증 수단이 실재하지 않아 신설) |
| A8 | `admitChatSend` 4케이스 + 부작용 0 | ✅ | `chat-turn/admission.test.ts` 5케이스(스키마·업데이트·어댑터·**게이트 순서**·정상). 부작용 0 은 위 §추가 확인의 `rg` 0건이 뒷받침 |
| A9 | `leaseKeyFor` 우선순위 | ✅ | `admission.test.ts` 3케이스(sessionId · clientKey→clientRequestId · uuid 생성) |
| A10 | `checkContinuitySource` 4케이스 (**fork 는 mid-turn 허용**) | ✅ | `admission.test.ts` 4케이스. fork/handoff 비대칭이 양성 단언으로 고정됨 |
| A11 | `checkBusyReservation` 4케이스 (**미지정 = 보수적 허용**) | ✅ | `admission.test.ts` 4케이스. 미지정 케이스가 별도 AC 로 있었고 별도 테스트로 잠김 |
| A12 | `buildTurnContext` — continuity 4종 동반 / 일반 send 는 비움 | ✅ | `chat-turn/turn-context.test.ts` 3케이스(일반·fork·handoff) + `resolveTurnCwd` 2 + `makeContinuationTurn` 1 = 6 |
| A13 | `buildListenRequest`/`buildFlushRequest` | ✅ | `chat-turn/continuation.test.ts` 3케이스. **0149(첨부 미탑재)·0166 D7(위임 전량)·0127(continuity 표식 제거)** 세 회귀가 전부 양성 단언 |
| A14 | 통합 3종 **무수정** 통과 | ✅ | 세 파일을 **개별로** diff — `chat-turn.runtime-tools.test.ts`·`chat-turn.continuity.test.ts`·`chat-turn-continuation.test.ts` 각각 `git diff --stat 501ea03..HEAD -- <file>` **빈 출력**, 3종 전부 green. (와일드카드 `chat-turn*.test.ts` 로 재면 신규 3파일이 함께 잡히므로 개별 확인해야 한다.) `chat-turn.runtime-tools` 는 `from './chat-turn'` 를 그대로 쓰고 디렉토리 `index.ts` 로 해석됨 |
| A15 | 파일 ≤250줄 · **최대 함수 <200줄** | ❌ **미충족** | 파일: 14모듈 중 13개가 58~216줄 ✅, **`send.ts` 381줄** ❌. 함수: `handleChatSend` **344줄**(1,166 → −71%)로 목표 200 미달. `src/main` 전체 2위는 `claude-map.ts:claudeToNormalized` 330줄(이번 범위 밖) |
| A16 | 5모듈 등록 합집합 = 분해 전 26 · 중복 0 | ✅ | `app/handlers/misc-split.test.ts` 1케이스. **변이 확인 완료**(위 §역방향 탐색) |
| A17 | `CHANNELS` 82 유지 · 문서 82 | ✅ | `Object.values(CHANNELS).length` 재측정 = **82** · `shared/ipc-documentation.test.ts::"keeps the header, domain summary, and CHANNELS count at 82"` 통과 |
| A18 | `misc.ts` ≤200줄 · 5도메인만 | ✅ | `wc -l` = **100줄**(347 → −71%). 잔여 = backend·agent·install·notify·debug 5도메인 |
| A19 | AGENTS.md 2종이 `chat-turn/`·handlers 14종 반영 | ✅ | `app/AGENTS.md:50` · `app/src/main/AGENTS.md:29` + 신설 `§app/chat-turn/ 분해 (0179)` 절. **수치 오류 1건을 검증에서 잡아 고쳤다** — 아래 D7 |
| H1 | 사람 실기 (앱 구동 5경로) | **미검증 — 사람 대기** | 아래 §검증 책임 분리 · §못 본 것 |

**충족 17 / 19** (A2 = 설계 철회, A15 = 미충족). H1 은 애초에 사람 몫.

## 숫자 재측정 (SKILL.md §3)

| 문서가 인용한 값 | 재측정 | 판정 |
|---|---|---|
| IPC 채널 82 | `82` | ✅ |
| `handlers/` 14종 | `ls` = **14** | ✅ |
| `chat-turn/` 모듈 수 | `ls` = **14** | ❌→✅ **문서가 13이라 적었다.** `app/AGENTS.md`·`src/main/AGENTS.md`·`arch/backend/overview.md`·plan 4곳을 14로 정정(D7) |
| 무참조 export 0 / 테스트 전용 52 | `0` / **51** | 테스트 전용 51 로 정정(D7) |
| 신규 테스트 케이스 | `chat-turn/` 3파일 **25** + `misc-split` **1** + scheduler 신규 **1** = **27** | ✅ (베이스라인 대비 +24 는 삭제분 −3 상쇄 후 값 — 검산: 1892 − 3(conformance 1 + boundaries 2) + 27 = **1916** ✅) |
| 변경 규모 108파일 / +2,965 / −1,975 | `git diff --shortstat 501ea03..HEAD -- app/src` 일치 | ✅ |

**내역 합 = 총계 검산 통과** — 1,892(베이스라인) − 3(삭제) + 27(신규) = 1,916(현재).

## 검증 책임 분리 (사람 vs 에이전트) — 정본 표

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | **전량 green** (아래 §게이트) |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`+테스트) | 이견 시 중재 | 17/19 |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | **0건** — `npm run lint` 출력에 `boundaries` 매치 0 |
| 프로덕션 번들 빌드 | ✅ 실행 | — | `npm run build` **성공** (main+preload+renderer). 신규 14모듈 그래프가 번들러에서도 해석됨 |
| 문서 수치 재측정 | ✅ | — | 6종 중 **2종 오류 발견·정정**(D7) |
| **앱 런타임 실기(H1)** | ✖ **불가 — 시도했고 실패했다** | ✅ | **사람 확인 대기.** 근거는 아래 §못 본 것 |
| 제품 의도 부합(사용자 결정 ①②③ 준수) | ✖ 보조 의견 | ✅ 결정 | 보조 의견: 결정 3건 모두 지켜짐 — 인증 스택 3디렉토리 **diff 0줄**(`git diff --stat 501ea03..HEAD -- 'app/src/main/features/auth-platform' 'app/src/main/features/connectors' 'app/src/main/infra/auth'` = 빈 출력) · renderer diff **0줄** · 책임의 features 이관 0 |
| A15 미충족 수용 여부 | ✖ 판정만 | ✅ 결정 | 사람 확인 대기 — 344줄로 남길지 후속에서 더 쪼갤지 |
| PR 머지 승인 | ✖ | ✅ | 사람 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)      # warning = useTranscriptVirtualizer(0102 베이스라인, 변경 무관)

$ npm run typecheck
typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅   (error TS 0건)

$ ./node_modules/.bin/vitest run
 Test Files  206 passed (206)
      Tests  1916 passed (1916)

$ node --test scripts/*.test.mjs
# pass 28 / # fail 0

$ npm run build
✓ built in 7.62s   (out/main · out/preload · out/renderer)
```

**환경 기인 실패 분리 — 이번엔 분리할 것이 없다.** 이 세션은 **egress 가 열려** `npm ci` 의
Electron ABI rebuild 와 `npm rebuild better-sqlite3`(Node ABI)가 모두 성공했다. `app/AGENTS.md`
가 경고하는 403 차단 서명(`Could not locate the bindings file` · `Response code 403` ·
`[sqlite-abi] ensure failed`)이 **테스트 출력에 0건**이고, DB 로드 스위트(`infra/db/*`·
`features/history/writer`·`features/orchestration/fork`·`features/chat/recovery`·
`app/chat-turn.continuity`)까지 전부 green 이다. 즉 **베이스라인 red 0** 위에서 비교했다.

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: `rg -n '(sk-|ghp_|Bearer [A-Za-z0-9]|[0-9]{1,3}(\.[0-9]{1,3}){3}|@[a-z]+\.(com|corp))' app/AGENTS.md app/src/main/AGENTS.md` → **0건**.
- 변동성/일회성/장문 코드설명서 혼입: 신설 `§app/chat-turn/ 분해` 는 **모듈↔책임 매핑 표 + 작업 규칙 3** 으로, root `AGENTS.md §AGENTS.md 규약` 의 위생 규칙(구조·역할 매핑·작업 규칙만)에 부합. 페이즈 이력·커밋 해시·담당자 미포함.
- `CLAUDE.md` stub 무변경(`@AGENTS.md` 한 줄 유지) 확인.

## PHASES.md 정합성

- **미승격 — 의도적.** `docs/PHASES.md §현재 작업 중` 은 보드 링크만 두는 구조이고, 표 승격은
  PASS 확정 시점에 한다. 이번 verify 커밋과 함께 `INDEX.md` 를 `verify/PASS` 로 올리고 PHASES
  표 행을 추가한다(PR 번호는 사용자가 PR 을 만들 때 채운다).

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계.** **plan 이 목표 수치를 코드 형태를 보기 전에 확정한 것이 A15 미충족의 뿌리다.**
  "최대 함수 200줄" 은 `handleChatSend` 가 12단계 선형 시퀀스 + 3중 try/finally 라는 사실을
  모르고 쓴 숫자다. 관문 2 는 "검증 수단이 있는가" 를 묻지만 **"이 목표치가 달성 가능한가" 는
  묻지 않는다** — 구조적 목표(줄 수·파일 수·모듈 수)를 AC 로 쓸 때는 *현재 코드의 형태를 먼저
  펼쳐본 뒤* 수치를 정해야 한다. → **신규 패턴 P32**.
  또한 **A7 의 검증 수단이 존재하지 않는 테스트를 가리켰다**(D4). 관문 2 는 `파일::케이스` 형식만
  강제하고 **그 케이스가 실재하는지는 검사하지 않는다** — plan 작성 시 인용한 테스트 이름을
  `rg` 로 확인하는 절차가 없다. → **신규 패턴 P33**.
- **구현 단계.** 선조치 경계를 1건 넘었다(D6 — AC 변경을 `✅` 로 표기). 방향이 보수적이라 피해는
  없었으나 표기는 `⚠️` 여야 했다. 반대로 **설계를 그대로 받아쓴 곳은 없었다** — D1~D5 다섯 건이
  전부 "plan 대로 하려다 모순을 발견하고 멈춘" 형태이고, 특히 D1 은 삭제를 실행한 **뒤에**
  `modules/AGENTS.md` 를 읽고 되돌린 것이라 순서가 위험했다(먼저 읽었어야 한다).
- **검증 단계 — 이번 verify 가 못 본 것.**
  1. **앱 런타임 동작을 전혀 보지 못했다.** headless 구동을 4회 시도했고(`xvfb-run electron
     out/main/index.js --no-sandbox`) **매번 `boot.step.failed{step:'db-init'}` 로 실패**했다 —
     better-sqlite3 가 Electron ABI(NODE_MODULE_VERSION 140)로 빌드되지 않고 Node ABI(127)로
     남아 있고, `electron-builder install-app-deps` 가 `finished` 를 보고하고도 바이너리 mtime 이
     바뀌지 않았다(prebuilt 미존재 추정). **한때 "앱이 깨끗이 부팅했다" 고 판단했으나 그것은
     오독이었다** — stdout 이 조용했던 것은 성공이 아니라 prod 빌드가 콘솔 미러를 끄기 때문이고,
     실패는 `~/.config/orca/logs/application.jsonl` 에만 남았다. 정정해 기록한다.
     - 다만 **한 가지 유용한 음성 대조**는 얻었다: 실패한 구동에서 `orca:settings:get`(내가 옮긴
       채널)과 `orca:update:state`(**손대지 않은** 채널)가 **동일하게** "No handler registered"
       를 냈다. 둘 다 `Bootstrap.register(ctx)` 가 `initDb` throw 로 도달하지 못한 결과이지
       핸들러 분해의 결과가 아니다 — 4단계가 채널을 잃지 않았다는 근거는 `misc-split.test.ts`
       (변이 확인 완료)가 대신한다.
  2. **`send.ts` 의 12단계 순서 자체는 대리 검증이다.** 순서 불변식 3종(첨부↔busy 판정 ·
     `leaderAdmittedAt` · 게터 전달)은 *코드 위치 확인 + 통합 3종 green* 으로만 뒷받침된다.
     이 셋이 깨지는 레이스(진행 턴 종료와 예약 착지의 경합)는 **단위·통합 어느 쪽도 재현하지
     못한다** — 실기 확인이 남는다.
  3. **`approval.ts`·`turn-request.ts`·`post-turn.ts` 는 신규 단위 테스트가 없다.** 통합 3종이
     간접 구동하지만 게이트 콜백 6종의 개별 분기(`canSubmitInitial` 의 chainId fence 등)는
     대조되지 않았다. 순수부가 아니라 배선부라 "무엇을 떼면 가능한가" 의 답이 `getActiveTurn`
     스텁 주입인데, 그건 이번 범위에서 하지 않았다 → **D8**.

### `failure-patterns.md` 축적 대상

- **P32** — 구조적 목표(줄 수·파일 수)를 AC 로 쓸 때 *현재 코드의 형태를 펼쳐보기 전에* 수치를
  정하면 달성 불가능한 기준이 된다. 0179 A15: "최대 함수 200줄" 이 12단계 선형 시퀀스라는 실제
  형태와 무관하게 정해져, 맞추려면 10필드 deps 배관을 새로 만들어야 했다(= 없애려던 문제를 재생산).
- **P33** — plan 이 인용한 **테스트 케이스가 실재하는지 검사하는 절차가 없다.** 0179 A7 은
  "기존 cron 검증 케이스" 를 검증 수단으로 적었으나 저장소에 그 단언이 **하나도 없었다**.
  `검증 수단` 칸을 채울 때 기존 테스트를 인용하면 `rg` 로 존재를 확인해야 한다(관문 4 의
  "인용 경로가 실제로 해석되는지" 를 **테스트 이름까지** 확장).

## [FAIL 항목 없음 — 미충족 2건은 파생 이슈로 이관]

미충족은 재구현 루프백이 아니라 **사용자 판단 대기**다(A2 는 이미 근거 있는 철회, A15 는 목표
미달 보고). plan 의 `[검증자 기입] 파생 이슈` 챕터에 D2·D6·D7·D8 로 기록한다.

## 결론 / 다음 단계

**PASS (r1)** — 인수 **17/19**, 게이트 전량 green(lint 0 error · typecheck 3/3 · vitest 206파일
1,916테스트 · scripts 28/28 · 번들 빌드 성공 · boundaries 위반 0), 베이스라인 red 0 위에서 비교.

**이 작업이 실제로 산출한 것**(줄 수보다 이쪽이 본질이다):

| 지표 | 전 | 후 |
|---|---|---|
| `src/main` 최대 함수 | **1,166줄** (`registerChatHandlers`) | **344줄** (`handleChatSend`) |
| 그 안의 최대 단일 클로저 | 892줄 | — (14모듈로 분해) |
| `handlers/misc.ts` | 347줄 / 10도메인 | 100줄 / 5도메인 |
| 무참조 export (인증 스택 제외) | 117 | **0** |
| 죽은 파일 | 3(+테스트 3) | 0 |
| **IPC 없이 검증 가능한 턴 판정 규칙** | **0건** | **25건** |

**두 가지를 사용자 결정으로 남긴다**:

1. **A15(최대 함수 344줄)를 이대로 둘 것인가.** 더 쪼개려면 배관 모듈이 필요해 구현이 멈췄다.
2. **H1 실기.** `npm run dev` 로 ① 새 채팅 ② 응답 중 추가 전송(예약 버블→flush) ③ 중단 버튼
   ④ fork/handoff ⑤ **설정 모달의 스킬·파일 첨부·사용량 탭**(4단계가 이 3개 도메인의 IPC 배선을
   옮겼다). 에이전트 환경에서는 Electron-ABI better-sqlite3 를 얻지 못해 구동 자체가 불가능했다.

다음 단계: `INDEX.md` `verify/PASS` · `PHASES.md` 표 승격 · (사용자 요청 시) PR.
