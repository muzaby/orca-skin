# Verify — 0177-docs-agents-sync

## 메타

| 항목 | 값 |
|---|---|
| slug | `0177-docs-agents-sync` |
| 검증자 | Claude Code |
| 일자 | 2026-08-05 |
| 대상 커밋 | `dbc16ff` (설계 `e9d6800`) + 본 검증 턴의 정정 커밋 |
| 라운드 | 1 |
| 상태 | **PASS (r1)** — 단, §구현 결과 비판적 검토에서 **부정확한 승계 주장 1건을 잡아 이 턴에 정정**했다 |
| 자기 검증 여부 | **예 — 설계·구현·검증 전부 Claude 동일 세션.** 교차 검증이 없으므로 §0·§역방향 탐색을 강하게 적용했고, 실제로 그 두 절에서만 결함이 나왔다(매트릭스 대조에서는 0건 — 자기 기준을 자기가 대조하면 통과가 기본값이라는 증거) |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

> `git diff e9d6800..dbc16ff` 를 남의 PR 처럼 통독. 문서 전용이라 "실환경 실패" 를 **문서 소비자(에이전트)가 이 문장을 근거로 잘못 행동하는 경로**로 번역해 읽었다.

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **문서의 실패 = 거짓 근거 제공.** 에이전트가 이 문장을 읽고 잘못 설계하는 경로를 찾았다. **1건 발견** → 아래 D1 | `docs/arch/backend/security.md` §1.8 |
| **잘못된 성공(false success)** 이 가능한 경로 | **가능했고, 실제로 하나 있었다.** grep 게이트 3종(AC1·3·5)이 **0건이면 통과**인데, 술어가 뭉툭해 *이력 표기까지* 히트시킨다. 이 상태로 "0건 만들기" 를 쫓았다면 **개정 이력을 지워서** 게이트를 통과시켰을 것이다 — 게이트를 만족시키려 문서를 손상시키는 전형적 false success. 구현자가 술어를 좁히고 이력을 남긴 판단이 옳다(plan §놓친 문제 1·2) | `docs/TRD.md:7` · `docs/PHASES.md:157` 잔존 확인 |
| 되돌릴 수 있는가 | **전부 가능.** 마이그레이션·스키마·외부 상태 변경 0. 신규 파일 2개(`docs/guides/{AGENTS,CLAUDE}.md`)도 삭제로 원복. `git revert dbc16ff` 한 번이면 끝난다 | `git diff --name-only HEAD~2..HEAD` = `.md` 25건, 그 외 **0건** |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **대체로 했다.** 다만 **헤더가 하지 않은 일을 했다고 적은 곳 1건** — `runtime-ipc.md` 헤더에 "`contracts/` 9모듈 등재" 라 썼는데 실제 인벤토리는 `overview.md` §3 에 넣었다. 문서 자신에 대한 거짓 서술이라 이 턴에 정정했다 | `docs/arch/backend/runtime-ipc.md:4` — `grep -c "contracts/"` = 3(전부 기존 본문 인용, 신규 인벤토리 없음) |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘지 않았다.** 선조치 9건은 전부 "구현 세부·놓친 엣지케이스·명백한 누락" 범주다. **경계에 가장 가까운 것은 #1~4(AC 술어 정정)** 인데, *인수 기준의 요구 내용*은 그대로 두고 *측정 술어*만 좁혔으며 **AC18·AC19 는 자기모순이라 좁히지 않으면 AC13 을 지킬 수 없었다**(관문 2 규칙 4 위반이 설계에 있었다). 판정: **정당한 선조치**. 진짜 판단이 필요한 1건(#10 provider-runtime 로드맵)은 올바르게 `⚠️ 보고만` 으로 남겼다 | plan §[구현자 기입] 놓친 문제 #1~4·#10 |

### 발견 (인수 기준 어디에도 걸리지 않음) — 이 턴에 정정

| # | 결함 | 왜 위험한가 | 조치 |
|---|---|---|---|
| **D1** | **`security.md §1.8` 이 "`net-fetch.ts` 가 `electron` 을 무는 **유일한** 네트워크 파일" 이라고 썼다 — 거짓.** 실측: `net-fetch.ts`(`net.fetch`) · `net-request.ts`(`net.request`) · `browser-session-store.ts`(`Session.fetch`) **3개**가 electron 을 문다. 이 문장은 `app/src/main/AGENTS.md` 에서 **그대로 승계**한 것이고, plan 관문 1 이 "선행 문서의 주장을 승계하지 않는다" 고 못 박았는데도 승계했다 | 이 문장을 읽은 에이전트가 "electron 은 `net-fetch.ts` 만 무니 나머지는 테스트에서 import 해도 된다" 고 판단하면 **테스트가 즉시 죽는다**(P29 — `vitest.config.ts` 에 electron alias 없음). 정확한 규칙은 *다른 것* 이다: **전역 `fetch(` 호출**이 `net-fetch.ts` 에만 허용된다(가드가 강제하는 것도 이것) | ✅ **정정** — `security.md` §1.8 표를 두 행으로 분리(전역 `fetch(` 허용 파일 1개 ↔ Chromium 스택 파일 3개)하고, **승계 원본인 `app/src/main/AGENTS.md`·`app/AGENTS.md`·`arch/backend/overview.md`(트리 주석·§4 행)까지 함께 고쳤다** — 원본을 안 고치면 다음 동기화가 같은 거짓을 다시 퍼뜨린다 |
| **D2** | `runtime-ipc.md` 헤더가 하지 않은 작업("`contracts/` 9모듈 등재")을 했다고 서술 | 헤더는 *무엇이 갱신됐나* 를 판단하는 1차 신호다. 거짓이면 다음 동기화가 그 절을 건너뛴다 | ✅ **정정** — 실제 위치(`overview.md` §3)를 가리키도록 수정 |

## 역방향 탐색 (매트릭스 전 선행)

> `scan-surface.sh` 는 **코드 심볼 도구라 이번 변경(문서 100%)에는 적용 대상이 없다**. 대신 같은 *발상*(선언된 표면을 먼저 뽑고 사용/근거를 역추적)을 문서에 맞게 옮겨 3종을 돌렸다.

| 후보 | 판정 | 근거 |
|---|---|---|
| **문서가 새로 주장한 코드 사실 → 코드에서 역검증** (승계 금지 규칙 재적용) | **1건 결함(D1) · 나머지 정상** | `BrokerDeps.fetchImpl`(`broker.ts:71,108,729`) · `createSender(fetchImpl)`(`authenticated-fetch.ts:105`) · `ExternalUsageService.fetchImpl`(`external-usage-service.ts:23,63,69`) **전부 실재** / `no-node-fetch.test.ts` 가 실제로 `ALLOWED={net-fetch.ts}` 로 전역 `fetch(` 0건을 고정하고 **자기 정규식의 오탐·미탐까지 테스트**(측정력 0 방지) / `usage-source.ts:1` 헤더가 "PluginHost → `UsageSourcePort` 어댑터 (0176)" 로 문서 서술과 일치 / `DEFAULT_UPDATE_CHECK = {enabled:true, intervalHours:6}` 로 persistence 표 `{true, 6}` 일치 / `bootstrap.ts:481-483` 이 `setProviderEnv` 제거 근거를 보존 |
| **신규 추가한 경로 인용 → `ls` 존재 확인** | **정상 (미존재 2건은 의도적)** | 신규 인용 91개 중 `contracts/sso.ts`·`features/sso/modules/` 2건만 미존재인데, 이 둘은 **"0157 이 지운 두 경로 (되살리지 말 것)"** 인용문 안에서 *없다는 사실 자체* 를 기록한 것이다 — `ls app/src/main/features/sso` = 없음으로 확인 |
| **문서 전수 상대링크 → 대상 해석** | **정상 (정정 후)** | 코어 `docs/` 파손 **22 → 0**. 잔존 히트 1건은 `0177/plan.md` 안에서 *파손 패턴을 백틱으로 인용* 한 것(검사기가 code span 을 안 벗김) — 오탐. 범위 밖 잔존 6건은 `docs/etc/study/**`(비범위) + handoff `0031`(과거 문서) |
| **plan 이 "N곳" 이라 적은 수치 → 재grep** | **전부 일치** | 아래 §게이트 재실행의 독립 재측정 표 |
| **형제 비대칭** (같은 성격의 문서가 다른 규칙을 따르나) | **1건 발견 → 의도된 차이로 판정** | `docs/arch/`·`docs/etc/` 에는 `AGENTS.md` 가 없는데 `docs/guides/` 에만 신설했다. 근거: 상위 `docs/AGENTS.md` 가 `arch/`·`etc/` 는 **파일 단위로 전수 인덱싱**하지만 `guides/` 는 **인덱싱 자체가 빠져 있었다**(grep 0건). 즉 비대칭의 원인은 "정보가 어디에도 없었다" 이고 신설이 그것을 메운다 |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §설계리뷰 — "설계 방향은 맞았으나 **AC 술어 3개가 뭉툭했다**" | **타당.** 확인해보니 AC18 은 `app/src/main/AGENTS.md`(AC13 의 명시 대상)를 금지해 **자기 AC 끼리 모순**이었고, AC4·AC19 는 각각 개명 이력·편집이 허용된 진입점까지 금지했다. 셋 다 관문 2 규칙 4(AC 간 모순)·관문 4(문서 정합)에서 걸렸어야 했다 | 매트릭스에서 **정정된 술어로 판정**하고, 원 술어의 결함을 §자기 리뷰에 패턴으로 축적 |
| 선조치 #1·#2 (이력 표기 보존) | **타당.** 이력을 지우는 것이 게이트 통과의 유일한 길이 되면 게이트가 문서를 망친다 | 매트릭스 AC1·3·4·5 에 반영 |
| 선조치 #3·#4 (AC18/19 술어 정정) | **타당하고 불가피.** 원 술어로는 사용자 요구("모든 경로의 AGENTS.md")를 이행할 수 없었다 | 매트릭스에 반영 |
| 선조치 #5~#9 (spec 진입점 거짓·상대링크 22건·security 삭제 경로·의존성 5종·소실 hash 7건) | **전부 타당한 선조치.** 다섯 다 "명백한 누락/거짓" 범주이고 제품 의도·의존성·인수 기준을 바꾸지 않았다. **#9 가 특히 값졌다** — INDEX 의 hash 7개가 리베이스로 소실됐는데 그대로 PHASES 에 옮겼다면 *추적 불가능한 이력* 을 새로 만들 뻔했다 | 매트릭스 AC14·AC17 에 반영 |
| 선조치 ⚠️ #10 (`provider-runtime.md`/`standardization.md` 로드맵 재평가 미수행) | **경계 판정 정확.** P0/P1 전수 대조는 사실 정합이 아니라 설계 판단이므로 구현자가 단독 결정할 사안이 아니다. "낡은 *대기* 표기를 그대로 둔다"(확인 없는 *완료* 표기보다 보수적) 도 옳은 기본값 | **파생 이슈 D3 으로 이관** — 후속 핸드오프 제안. 사용자 결정 대기 |

## 요구사항 충족 매트릭스

> 문서 전용이라 "테스트" = **재현 가능한 명령**(grep/`ls`/`git diff`)이다. 인용 수치는 전부 이 검증 턴에서 **독립 재측정**했다(구현 보고의 `Criteria-Met: 19/19` 은 증거로 쓰지 않았다).

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 채널 총계 언급이 전부 86·23 도메인 | ✅ | `rg '6[0-9]\|7[0-9]\|8[0-5] 채널' docs --glob '!docs/{handoff,etc,spec}/**'` → 잔존 **1건 = `TRD.md:7` 의 명시적 이력**("직전 0095 = 17 키·64 채널"). 현재 상태 서술 히트 **0건** |
| 2 | 도메인 분포 일치 + 내역 합 = 86 | ✅ | `docs/AGENTS.md:15` ↔ `IPC_CONTRACT.md:28` 항목별 대조 일치. 검산 `8+7+7+7+6+6+6+6+5+5+4+3+2+2+2+2+2+1+1+1+1+1+1 = 86` = 코드 실측 86 |
| 3 | settings 20 키 + 신규 2키 카탈로그 등재 | ✅ | 3중 정합 — 코드 `SettingsSchema` **20** = `persistence.md §1.2` 표 **20행** = `IPC_CONTRACT §2.4 interface Settings` **20**. `connectorInstances`·`pluginAddEnabled` 양쪽 문서에 실재 |
| 4 | `authBypass` 로 정정 (`ssoBypass` 는 이력만) | ✅ | 현재 상태 서술 3곳(`TRD.md:334`·`security.md:143`·`frontend/overview.md:92`) 전부 `authBypass`. 잔존 `ssoBypass` 히트는 전부 **개명 이력 표기**(`구 ssoBypass`·`ssoBypass`→`authBypass`) + PHASES 0072 과거 행 |
| 5 | 마이그레이션 16종 + `0014`~`0016` 행 | ✅ | `ls migrations/*.sql` = **16**. `persistence.md` 표에 `0014_provider_usage_report_cache`·`0015_pinned`·`0016_turn_model_context_window` 3행 실재. 잔존 "13종" 히트는 PHASES 의 **0094 과거 행** 1건뿐 |
| 6 | `connectors` 슬라이스 등재 + main 11 슬라이스 전수 | ✅ | `rg -c 'connectors' arch/backend/overview.md` = **3**(트리·§4 행·설명). `ls app/src/main/features` = **11** ↔ `app/AGENTS.md` 나열 11 = `main/AGENTS.md` 나열 11 |
| 7 | 네트워크 스택 규칙이 `security.md` 에 절로 존재 + 강제 지점 명시 | ✅ **(D1 정정 후)** | `security.md §1.8` — `rg -c 'net-fetch\|netFetch'` = 3+. 강제 지점 `no-node-fetch.test.ts`·`net-response.test.ts` 명시. **초판은 "유일한 electron 파일" 이 거짓이었고 이 턴에 3파일로 정정**(D1) |
| 8 | `infra/auth`·`infra/log`·`contracts` 9모듈 인벤토리 등재 | ✅ | `security.md §1.9`(auth 모듈 표) · `overview.md` 트리(`infra/log/` 7모듈 · `contracts/` 9모듈). `ls contracts/*.ts` 비-test = **9** 일치 |
| 9 | `guides/` 3파일이 `docs/AGENTS.md` 인벤토리에 행으로 | ✅ | `rg -c 'guides/' docs/AGENTS.md` = **4**(3행 + 위치 규약). `ls docs/guides/*.md` 비-AGENTS = 3, 1:1 대응 |
| 10 | `docs/guides/{AGENTS,CLAUDE}.md` 신설 + root 표 등재 | ✅ | 두 파일 존재. `CLAUDE.md` = 기존 stub 과 **바이트 동일**(주석 1줄 + `@AGENTS.md`). root `AGENTS.md` "디렉토리 한눈에" 에 `docs/guides/` 행 실재 |
| 11 | `AGENTS.md` 전수 대조 + 무수정도 기록 | ✅ | plan §구현 보고에 **수정 5건 + 무변경 판정 11건**이 대조 항목과 함께 기재. `git diff --name-only` 의 AGENTS.md 목록(5건)이 그 표의 "수정" 행과 정확히 일치 |
| 12 | `app/AGENTS.md` main 모듈 표가 실측 일치 | ✅ | `handlers/` **10**(`ls` 비-test) = 문서 10종 나열 / `contracts/` **9** = 문서 9 / `infra/` 에 `auth`·`log` 포함 확인 |
| 13 | `app/src/main/AGENTS.md` 레이어 매핑 실측 일치 | ✅ | 같은 3항목 + `app/` 컴포지션 루트에 `auth-restore`·`chat-turn-continuation`·`updater-feed`·`usage-source` 포함(`ls app/src/main/app/` 대조) |
| 14 | PHASES 현재 상태 + PASS 9건 승격 | ✅ | `rg '마이그레이션 \*\*16종\*\*' PHASES.md` = 1. 승격 9 slug 각 1행 실재(`0159`·`0160`·`0162`·`0163`·`0168`·`0169`·`0170`·`0171`·`0176`). **INDEX 의 PASS 집합과 정확히 일치**(0161=FAIL, 0164~0167·0172~0175=IMPL_DONE → 미승격, 사유가 표 아래 명시). 기재 hash 는 `git cat-file -t` 로 실존 확인(소실된 0159 는 그 사실을 행에 명시) |
| 15 | 이미 현행인 문서의 본문 무변경 | ✅ | `git diff -- arch/frontend/dom-architecture.md arch/frontend/rendering.md` = **0줄**. `GLOSSARY.md` diff = 헤더 + `Tweaks` 키 수 2줄만(§1 표제어 삭제·개명 0). `IPC_CONTRACT.md` diff = 헤더 + §2.4 키 2행 + 중복 링크 1줄 (§2 카탈로그 무변경) |
| 16 | 갱신 문서의 헤더가 `2026-08-05 (handoff 0177 …)` | ✅ | `rg -c '최종 업데이트: 2026-08-05 \(handoff 0177'` = **11개 파일** = 헤더 관례를 가진 변경 문서 전수. TRD 는 관례가 달라 메타 표 "문서 버전" 행을 갱신 |
| 17 | 신규 추가 인용 경로 전수 실존 | ✅ | 91개 추출 → `ls` 확인. 미존재 2건은 **"지워진 경로" 를 지워졌다고 적은 것**(§역방향 탐색). 추가로 상대링크 전수 검사 22→**0** |
| 18 | 코드 무변경 | ✅ | `git diff --name-only HEAD~2..HEAD \| grep -v '\.md$'` = **0건**. 25개 변경 파일 전부 `.md` |
| 19 | 원문 미러·연구 문서 무변경 | ✅ | `docs/spec/**` 에서 진입점(`AGENTS.md`) 제외 **0건** — 원문 미러 정책(`docs/spec/AGENTS.md` "편집 원칙": *진입점 문서는 편집 가능*) 준수. `docs/etc/**` **0건** |

**충족: 19/19** — 단 AC7 은 **초판이 거짓 주장을 담고 있었고 이 검증 턴에서 정정한 뒤** ✅ 다(D1). 정정 전이라면 ❌ 였다.

## 검증 책임 분리 (사람 vs 에이전트) — 정본 표

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✖ **실행 불가** | — | **N/A + 실행 불가 병기** — 아래 §게이트 참조. 코드 무변경(AC18)이 게이트를 대신한다 |
| 인수 기준 ↔ 문서 1:1 대조 | ✅ 재현 가능한 명령 | 이견 시 중재 | 19/19 |
| 수치 3중 정합 (헤더=내역합=코드실측) | ✅ 독립 재측정 | — | IPC 86·settings 20·migration 16 전부 일치 |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | 상대링크 파손 22→0, 한국어 유지 |
| AGENTS.md 위생(키/토큰/이메일/IP) 스캔 | ✅ grep 보고 | ✅ 맥락 최종 판단 | **0건** (유일 히트 `@AGENTS.md` = import stub 오탐) |
| import stub(`@AGENTS.md`) 해석 | ✅ | — | `AGENTS.md` 16 ↔ `CLAUDE.md` 16, **디렉토리 집합 완전 일치**, 16개 전부 `@AGENTS.md` 포함 |
| PHASES.md 형식·커밋 | ✅ | — | 9행 형식 일치, hash `git cat-file` 실존 확인 |
| **문서 서술의 *해석* 이 옳은가** (존재 확인 ≠ 정확성) | ✖ 부분 — 코드 대조 가능한 것만 | ✅ 최종 | D1 은 코드 대조로 잡혔지만, **서술 뉘앙스는 사람 몫** |
| `provider-runtime.md`/`standardization.md` 로드맵 재평가 | ✖ 단독 결정 금지 (설계 판단) | ✅ 결정 | **D3 — 사람 결정 대기** |
| PHASES 승격 범위(미검증 8건) | ✖ 규칙대로 PASS 만 | ✅ 전량 승격 원하면 지시 | 규칙 준수, 사유 명시 |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 없음 — PR 미생성 |

## 게이트 재실행 결과

**코드 게이트는 이 환경에서 실행 불가 — 그리고 이번 변경에는 판정 대상이 없다.** 둘을 구분해 적는다.

```
$ ls app/node_modules | wc -l
0
$ cd app && npm run lint
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'eslint' imported from …/eslint.config.mjs
$ cd app && npm run typecheck
error TS2688: Cannot find type definition file for 'electron-vite/node'.
tsconfig.node.json(2,14): error TS6053: File '@electron-toolkit/tsconfig/tsconfig.node.json' not found.
```

- **원인은 코드가 아니라 `node_modules` 부재**다(better-sqlite3 ABI 베이스라인과는 **다른** 실패 — 서명이 `ERR_MODULE_NOT_FOUND`/`TS6053` 이지 `Could not locate the bindings file`/`403` 이 아니다).
- **판정 대상이 0이므로 설치하지 않았다.** `git diff --name-only HEAD~2..HEAD | grep -v '\.md$'` = **0건** — lint/typecheck 를 돌려도 *이번 변경과 무관한 베이스라인*만 재확인된다. 선례 0094·0095 verify 가 동일하게 "코드 게이트 N/A — 문서 전용·`app/src` 무변경" 으로 판정했다.
- **정직한 한계**: 따라서 "게이트 green" 을 주장하지 않는다. 주장하는 것은 **"게이트가 볼 파일이 하나도 안 바뀌었다"** 이고, 그 근거는 위 `git diff` 다.

### 독립 재측정 (구현 보고 미신뢰)

| 대상 | 검증 턴 실측 | 문서 기재 | 일치 |
|---|---|---|---|
| IPC 채널 | 86 | 86 | ✅ |
| IPC 도메인 | 23 | 23 | ✅ |
| settings 키 (코드 / persistence 표 / IPC_CONTRACT) | 20 / 20 / 20 | 20 | ✅ |
| DB 마이그레이션 | 16 | 16 | ✅ |
| main feature 슬라이스 | 11 | 11 | ✅ |
| renderer feature | 13 | 13 | ✅ |
| `app/handlers/` | 10 | 10 | ✅ |
| `contracts/` | 9 | 9 | ✅ |
| `AGENTS.md` / `CLAUDE.md` | 16 / 16 (디렉토리 집합 동일) | 16 | ✅ |

## 위생 검토 (AGENTS.md 변경 시)

- **키/토큰/이메일/IP 패턴 스캔**: `git diff HEAD~2..HEAD` 의 추가 라인에 대해 `api_key|secret|token|password` + 이메일 + IPv4 + `sk-`/`ghp_` 정규식 → **0건**(유일 히트 `@AGENTS.md` 는 import stub 이 이메일 정규식에 걸린 오탐).
- **변동성/일회성 정보 혼입**: 신규 `docs/guides/AGENTS.md` 는 작성 규칙 §4 로 **"핸드오프 번호는 출처 표기로만, 변동성 이력은 PHASES, 라이브 상태는 INDEX"** 를 스스로 명시했다 — root 위생 규칙 준수. `docs/handoff/AGENTS.md` 에 추가한 "Codex 부재 시" 문단은 *반복 관측된 운영 규칙* 이지 일회성 업무가 아니다(0160·0162·0163·0176 4회).
- **장문 코드설명서 혼입**: 없음. 신규 절(`security.md §1.8·§1.9`)은 표 + 규칙이고 코드 인용 0줄.

## PHASES.md 정합성

- **형식**: 기존 3열(`제목(handoff slug)` / 내용 / 상태) 유지. 9행 전부 `| **… (handoff \`NNNN-slug\`)** | … | **완료 (커밋 \`hash\`)** |`.
- **커밋 기재**: `git cat-file -t` 로 전수 확인. INDEX 기재 hash 7개가 **저장소에 없어**(리베이스 소실) `git log --grep="Handoff: docs/handoff/<NNNN>"` 로 실존 hash 재조회 — `0159` 만 초기 구현 hash 가 완전 소실이라 **그 사실을 행에 명시**했다(0159 verify r1 이 겪은 문제의 재발 방지).
- **승격 범위**: INDEX 의 `verify/PASS` 집합과 1:1. 미승격 9건(0161 FAIL + 8건 IMPL_DONE)은 표 아래 주석으로 **사유와 함께** 기록.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계 — 실패 3건, 전부 관문 2·4 에서 잡혔어야 했다.**
  1. **AC 가 자기 산출물을 금지했다** (AC18 `app/src` 무변경 ↔ AC13 `app/src/main/AGENTS.md` 갱신). 체크리스트의 "자기 산출물이 자기 AC 를 위반하지 않는지" 항목에 ✅ 를 채우고도 **실제로 짝지어보지 않았다** — 0148 과 같은 형태의 반복.
  2. **"0건 grep" 을 완료 판정으로 쓸 때 *이력 표기* 를 배제하지 않았다.** 음성 게이트는 편리하지만, 술어가 뭉툭하면 **게이트를 만족시키려 문서를 손상시키는** 유인이 생긴다. → **신규 패턴 P30**.
  3. **정책이 예외를 명시한 곳을 통째로 금지했다** (AC19 가 `docs/spec/**` 무변경을 요구했으나 `docs/spec/AGENTS.md` 는 "진입점 문서는 편집 가능" 을 명시). 관문 4-2("채택 결정은 문서에만 있지 않다")를 *편집 금지 정책* 에도 적용했어야 했다.
- **구현 단계 — 선조치 경계는 지켰으나 승계 금지 규칙을 어겼다.** plan 관문 1 이 "선행 문서의 주장을 승계하지 않는다" 를 못 박았는데도, `app/src/main/AGENTS.md` 의 "유일한 네트워크 파일" 을 **코드 확인 없이 `security.md` 정본으로 승격**했다(D1). **정본으로 올리는 문장일수록 승계 위험이 크다** — 가이드의 오류는 그 디렉토리에 머물지만 정본의 오류는 전 문서로 퍼진다. → **신규 패턴 P31**.
- **검증 단계 — 이번 verify 가 못 본 것 (정직하게)**:
  - **코드 게이트를 돌리지 못했다.** 근거는 "판정 대상 0" 이라는 *추론* 이고, `git diff` 가 그것을 뒷받침하지만 lint/typecheck 실측은 아니다(0084 선례와 같은 형태의 한계).
  - **문서 서술의 *정확성* 을 전수 검증하지 않았다.** 검증한 것은 ⓐ 수치 ⓑ 경로 실존 ⓒ 이번에 새로 주장한 코드 사실이다. **기존 본문의 해석이 지금도 옳은지는 스팟 스캔**이다(0094 와 동일 한계 — "전수 drift 보장은 불가"). D1 은 *내가 새로 쓴* 문장이라 잡혔다; 안 건드린 절에 같은 종류의 거짓이 남아 있을 수 있다.
  - **`docs/etc/**` 를 통째로 비범위로 뒀다.** `etc/study/orca/auth-plugin-platform-requirements-ko.md` 는 인증 플랫폼 설계의 1차 출처로 계속 인용되는데 0157 이후 갱신 여부를 보지 않았다.
  - **`provider-runtime.md`(569줄, 헤더 2026-06-04)·`standardization.md` 의 "잔여 항목 설계 대기" 를 판정하지 않았다** — D3.
  - **사람만 판정 가능한 것**: 이 문서들이 *읽기 좋아졌는지*, `guides/` 경계 규칙("구조는 arch, 절차는 guides")이 실무에서 유용한지.

> 신규 패턴 **P30**("음성 grep 게이트가 이력 표기를 배제하지 않으면, 게이트 통과가 문서 손상을 유인한다") · **P31**("가이드 문서의 주장을 정본으로 승격할 때 승계 금지가 가장 자주 깨진다 — 정본의 오류는 전 문서로 퍼진다")를 `.agents/skills/handoff-plan/references/failure-patterns.md` 에 추가한다.

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 19/19. 단 AC7 은 **이 검증 턴에서 D1 을 정정한 뒤** 충족이다.
- PHASES 승격: 본 작업은 **문서 동기화** 라 PHASES 행을 스스로 추가한다(0094·0095 선례).
- **사람 결정 대기 2건**: D3(로드맵 재평가 후속 핸드오프 여부) · PHASES 미검증 8건 전량 승격 여부.
