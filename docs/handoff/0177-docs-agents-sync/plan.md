# Plan — 0177-docs-agents-sync

## 메타

| 항목 | 값 |
|---|---|
| slug | `0177-docs-agents-sync` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PHASES 신규 행 (문서 동기화) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "`@./docs` 업데이트하라. 그리고 모든 경로의 agents.md 를 업데이트하라" | 라이브 세션 요청 (2026-08-05) |
| 추론 의도 | "업데이트" = **현재 코드 기준 사실 정합화(fact-sync)** 이지 문서 재작성이 아니다. 선례 0094(arch 문서 동기화)·0095(docs 코어 동기화)와 같은 성격의 작업 | 추론 — 근거: `docs/PHASES.md:157` 의 0094 행("문서 16개를 0077 시점→0078~0093 코드로 동기화"), `INDEX.md` 0095 행("docs/ 코어 문서 9종 동기화") |
| 추론 의도 | "모든 경로" = 저장소 내 `AGENTS.md` **전수**(현재 15개) + 규약상 있어야 하나 없는 곳 | 추론 — 근거: root `AGENTS.md` "AGENTS.md / CLAUDE.md 규약" §5 "새 디렉토리 추가 시 그 디렉토리에도 `AGENTS.md` (+ stub) 를 둔다" |

## Context (왜)

`docs/arch/**` 코어 문서 대부분의 마지막 동기화 지점은 **handoff 0094/0095(2026-07-10~11)** 이고, 그 시점의 코드는 0093 까지다. 이후 **0096~0176 (약 80 핸드오프)** 가 들어오면서 다음이 코드에만 존재하고 문서에는 없다:

- IPC 도메인 2종 신설(`auth` 8 · `plugin` 7)과 총계 변화 — 문서 곳곳에 `64`·`65`·`82` 채널이 혼재
- main feature 슬라이스 2종 신설(`auth-platform`·`connectors`) — arch/backend 는 여전히 9 슬라이스 기준
- `infra/auth/*`(credential vault·browser session·net-fetch)·`infra/log/*`(0123/0124) 레이어 신설
- settings 키 18 → 20, DB 마이그레이션 13 → 16
- 0173/0174 의 **"main 원격 요청은 Chromium 스택으로만"** 규칙이 `app/src/main/AGENTS.md` 에만 있고 `docs/arch/backend/**` 정본에 없다

문서가 SSOT 라고 선언해 놓고 수치가 셋씩 갈리면(0157 verify 가 이미 같은 병을 잡았다 — IPC_CONTRACT 헤더 73 / 내역 72 / 실측 74) 에이전트가 문서를 근거로 잘못된 설계를 한다. 이번 작업은 **코드를 진실로 두고 문서를 그 위로 끌어올린다**.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당** — 증상("문서가 낡음")과 원인이 일치한다. 원인은 0096 이후 기능 핸드오프들이 *자기 범위 문서만* 갱신하고(IPC_CONTRACT 는 0164 까지 따라옴) **파생 인용처를 갱신하지 않은 것**이다. 실측: `docs/AGENTS.md:15` = "82 채널 · plugin 3", `docs/TRD.md:126` = "65 채널 · 20 도메인", `docs/TRD.md:612` = "64 채널", `docs/PRD.md:289` = "65 채널", `arch/backend/runtime-ipc.md:97` = "65 채널", `arch/frontend/ux-domains.md:152` = "65 채널" ↔ **실측 86 채널 · 23 도메인**(`app/src/shared/ipc.ts`) | 위 6개 라인 직접 확인 |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **부분 충족** — `docs/IPC_CONTRACT.md`(0164 갱신, 헤더 86 = 내역 합 86 검산 통과)·`docs/GLOSSARY.md`(0157/0161 어휘 반영 — `Connector`·`Plugin`·`Auth binding` 표제어 실재)·`docs/arch/frontend/dom-architecture.md`(0121)·`rendering.md`(0145)는 **이미 현행**이다. 이들은 헤더 날짜만 손대고 본문을 건드리지 않는다 — **과잉 편집이 곧 드리프트**다. | `docs/IPC_CONTRACT.md:26-28` 검산 · `docs/GLOSSARY.md` `Connector`/`Plugin` 표제어 grep 1건씩 |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **있고, 그걸 택한다.** 문서 구조(파일 분할·§번호 체계)는 **건드리지 않는다**. 수치·인벤토리·경로 인용만 교정하고, 신규 사실은 *기존 절 안에 행을 추가*하는 방식으로 넣는다. §번호가 움직이면 PRD/TRD/AGENTS 의 anchor 인용이 전부 깨진다(`ARCHITECTURE.md:10` 이 "참조는 파일별 안정 §번호로 둔다" 고 명시). | `docs/ARCHITECTURE.md:10` |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음** — 사용자 요청에 인용 자료가 없다. 다만 **내가 승계하려는 이전 문서의 숫자가 전부 오염원**이므로, 이번 plan 의 모든 수치는 이 세션에서 코드로 재측정했다(§자료조사). 이전 핸드오프 문서의 숫자는 **한 건도 승계하지 않았다**. | §자료조사 전 행 |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** 문서 전용 작업이라 채택 결정을 바꿀 수단이 없다. 다만 문서에 *적혀 있던 결정 서술*이 코드와 어긋난 곳이 1건 있다 — `docs/TRD.md:101` 이 settings 키로 `ssoBypass` 를 적었는데 0157 이 `authBypass` 로 개명했다. 이건 결정 변경이 아니라 **문서가 놓친 개명**이므로 코드 쪽으로 정정한다. | `app/src/shared/protocol.ts:613` (`authBypass`) ↔ `docs/TRD.md:101` |

- **사용자에게 올릴 것**(단독 결정 불가): **1건** — `docs/PHASES.md` 페이즈 표 승격 범위. 표는 0158 에서 끊겨 있는데 0159~0176 중 **verify/PASS 는 9건, impl/IMPL_DONE(미검증) 은 8건**이다. AGENTS.md 상태 머신(`docs/handoff/AGENTS.md:124`)은 **"PASS 시 PHASES 표 승격"** 이라 미검증 8건은 승격 대상이 아니다. → **규칙대로 PASS 9건만 승격하고, 미검증분은 "현재 작업 중" 링크(보드)에 맡긴다**. 규칙을 따르는 것이므로 진행을 막지 않고, 사용자가 전량 승격을 원하면 후속에서 추가한다.

## 자료조사 (Research)

> **모든 수치는 2026-08-05 이 세션에서 직접 측정했다.** 승계한 숫자 0개.

### A. 실측 수치 (측정 명령 병기)

| 대상 | 실측값 | 측정 방법 | 문서의 현재 값 |
|---|---|---|---|
| IPC 채널 총계 | **86** | `grep -o "'orca:[a-zA-Z:]*'" app/src/shared/ipc.ts \| sort -u \| wc -l` | AGENTS 82 · TRD 64/65 · PRD 65 · runtime-ipc 65 · ux-domains 65 (IPC_CONTRACT 만 86 ✅) |
| IPC 도메인 수 | **23** | 위 목록의 도메인 prefix `sort -u` | 23 (일치) |
| 도메인별 분포 | auth 8 · skills 7 · session 7 · **plugin 7** · update 6 · project 6 · cost 6 · chat 6 · files 5 · engine 5 · mcp 4 · window 3 · settings 2 · permission 2 · install 2 · debug 2 · boot 2 · search 1 · notify 1 · log 1 · concurrency 1 · backend 1 · agent 1 | 위 grep 의 `uniq -c` | `docs/AGENTS.md:15` 가 `plugin 3` (0158 시점) |
| **내역 합 검산** | 8+7+7+7+6+6+6+6+5+5+4+3+2+2+2+2+2+1+1+1+1+1+1 = **86** = 총계 ✅ | 수기 검산 | — |
| settings 키 | **20** | `SettingsSchema` 최상위 키 열거 (`app/src/shared/protocol.ts:593~`) | 18 (persistence·GLOSSARY·PRD·TRD) / 16 (overview) |
| settings 신규 키 2종 | `connectorInstances`(0161) · `pluginAddEnabled`(0164) | `protocol.ts:618`·`:610` 부근 | 어느 문서에도 없음 (IPC_CONTRACT §2.4 포함) |
| DB 마이그레이션 | **16** (`0001_initial` … `0016_turn_model_context_window`) | `ls app/src/main/infra/db/migrations/` | 13 (AGENTS·PRD·TRD·overview) / 15 (PHASES) |
| 문서에 없는 마이그레이션 3종 | `0014_provider_usage_report_cache` · `0015_pinned` · `0016_turn_model_context_window` | 위 `ls` ↔ `persistence.md:68-69`(0013 에서 끊김) | — |
| main feature 슬라이스 | **11** — approvals · auth-platform · chat · connectors · extensions · history · orchestration · providers · scheduler · sessions · usage | `ls app/src/main/features/` | app/AGENTS.md 11 ✅ / `docs/AGENTS.md:14` "scheduler 9번째 슬라이스" (0091 시점 서술) |
| renderer feature 도메인 | **13** — auth · backend · camera · captures · chat · cost · debug · engine · projects · sessions · settings · skills · update | `ls app/src/renderer/src/features/` | 13 ✅ (layers.md:4) |
| main `app/handlers/` | **10** — auth · boot · engine · log · mcp · misc · plugins · project · session · update | `ls app/src/main/app/handlers/` | app/src/main/AGENTS.md:29 가 8개 (`log`·`plugins` 누락) |
| main `contracts/` | **9** — auth-plugin · bus-events · connector-plugin · connector-template · ports · session-state · turn · usage-report · usage-source | `ls app/src/main/contracts/` | app/AGENTS.md:53·main/AGENTS.md:27 이 4개 (`turn`·`bus-events`·`ports`·`session-state`) |
| main `infra/` | auth · bus · config · db · ipc · **log** + cron · errors · settings-migration · settings-store · vars | `ls app/src/main/infra/` | app/AGENTS.md:54 가 `auth`·`log` 누락 / main/AGENTS.md:25 가 `log` 누락 |
| NormalizedEvent variant | **21** | `app/src/shared/ipc.ts:747~` 최상위 union + `:1433`(`chat.activity`) | IPC_CONTRACT §3 = 21 ✅ |
| 저장소 `AGENTS.md` | **15개** | `find . -name AGENTS.md -not -path "./node_modules/*" -not -path "./.git/*"` | — |
| 저장소 `CLAUDE.md` stub | **15개** (1:1 대응) | 위와 동일 패턴 | — |

### B. 구조적 신규 사실 (코드에만 있고 `docs/arch/**` 에 없음)

| 발견 | 레퍼런스 |
|---|---|
| `features/connectors/` 슬라이스(인증된 내장 도구 실행 — registry · runtime · instance-store · instance-lifecycle · instance-id · templates). **`docs/` 전체에서 "connectors" grep 0건** | `app/src/main/features/connectors/` (10 파일) · grep `-rn "connectors" docs/ --include=*.md` = 0 |
| `infra/auth/` (credential-vault · browser-session-store · authenticated-fetch · binding-records · binding-store-file · plugin-exec · session-policy · **net-fetch** · net-request · net-response) | `app/src/main/infra/auth/` (16 파일) |
| **0173/0174 규칙: main 은 Node 전역 `fetch` 를 쓰지 않는다.** 전송은 `infra/auth/net-fetch.ts` 의 `netFetch`(Electron `net.fetch`) 하나뿐이고 소비자는 `typeof fetch` 포트로 주입받는다(기본값 금지). `redirect:'manual'` 은 Electron 에서 요청 취소를 뜻하므로 3xx 직수신은 `net-request.ts` 의 `sendOnce`. 위반은 `no-node-fetch.test.ts` 가 잡는다. **`docs/` 에 "net-fetch"/"netFetch" grep 0건** — 현재 `app/src/main/AGENTS.md:56-73` 에만 존재 | `app/src/main/infra/auth/net-fetch.ts` · `no-node-fetch.test.ts` · `app/src/main/AGENTS.md:56-73` |
| `infra/log/` (log-manager · file-transport · redact · suppress · registry · log-context · serialize-error) — 0123/0124 산출물. `arch/backend/observability.md` 는 존재하나 `infra/log` 경로를 인벤토리에 안 실음 | `app/src/main/infra/log/` (12 파일) |
| 0176 usage connector — `app/usage-source.ts`(PluginHost→`UsageSourcePort` 어댑터) + `contracts/usage-source.ts` + `features/auth-platform/modules/usage/`. **`docs/` grep 0건** | `app/src/main/app/usage-source.ts` · `app/src/main/features/auth-platform/modules/usage/AGENTS.md` |
| `app/` 컴포지션 루트 신규 모듈 3종 — `auth-restore.ts`(0170) · `chat-turn-continuation.ts` · `updater-feed.ts`(0133) | `ls app/src/main/app/` |

### C. 문서 인벤토리 누락

| 발견 | 레퍼런스 |
|---|---|
| **`docs/guides/` 가 `docs/AGENTS.md` 문서 인벤토리 표에 없다** — `grep -n "guides" docs/AGENTS.md` = **0건**. 실재 파일 3종: `release-operations.md`(0087~0089 릴리스 절차 정본) · `closed-network-extensions.md`(0130→0157 폐쇄망 확장 정본) · `workspace-isolation-permissions.md` | `ls docs/guides/` · grep 0건 |
| `docs/guides/` 에 `AGENTS.md`(+`CLAUDE.md` stub)가 없다 — root `AGENTS.md` 규약 §5 위반 | `find docs/guides -name "AGENTS.md"` = 0건 |
| 그러나 `docs/arch/`·`docs/etc/` 에도 `AGENTS.md` 가 없다 — 이 둘은 상위(`docs/AGENTS.md`)가 **파일 단위로 전수 인덱싱**하고 있어 별도 가이드가 정보를 더하지 않는다. `guides/` 만 인덱싱 자체가 빠져 있다 | `docs/AGENTS.md:11-32` (arch/etc 각 파일이 행으로 존재) |

### D. 저장소 규칙 (설계 입력)

| 규칙 | 레퍼런스 |
|---|---|
| **정본은 `AGENTS.md`, `CLAUDE.md` 는 `@AGENTS.md` 한 줄 stub — 직접 편집 금지** | root `AGENTS.md` "AGENTS.md / CLAUDE.md 규약" |
| `AGENTS.md` 위생: 프로젝트 구조·역할 매핑·코딩/테스트/빌드 규칙만. **변동성 이력은 `docs/PHASES.md`, 라이브 상태는 `docs/handoff/INDEX.md` 로 분리** | 동일 절 |
| `docs/spec/**` 는 **편집 금지**(통째 덮어쓰기로만 갱신) | `docs/spec/AGENTS.md` "두 단 구조" 표 |
| PHASES 표 승격은 **verify/PASS 시** | `docs/handoff/AGENTS.md:124` |
| `ARCHITECTURE.md` 는 **목차/라우터만** — 내용은 `arch/*` 소유, §번호 안정성 유지 | `docs/ARCHITECTURE.md:5,10` |
| 문서 언어 = 한국어, 표 위주, 결정 사항 중심 | `docs/AGENTS.md` "코딩 에이전트가 따라야 할 원칙" §5 |

## 인수 기준 (Acceptance Criteria)

> 문서 전용 작업이라 검증 수단은 **저장소 grep/실측 대조**다. 각 AC 는 verify 가 같은 명령으로 재현할 수 있다.
> `프로덕션 도달 경로` = "이 문서를 실제로 읽는 주체와 진입 경로" (문서의 프로덕션은 에이전트 세션이다).

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `docs/**`(spec·etc·handoff 제외)에서 IPC 채널 총계를 언급하는 모든 곳이 **86 채널 · 23 도메인**을 말한다 | `rg '6[0-9] 채널\|7[0-9] 채널\|8[0-5] 채널' docs --glob '!handoff/**' --glob '!etc/**' --glob '!spec/**'` = **0건** | root `AGENTS.md` → `docs/AGENTS.md` → 해당 문서 (신규 세션 진입 순서 1~4) |
| 2 | 도메인별 분포를 나열하는 곳이 실측 분포와 일치하고 **내역 합 = 86** 이다 (특히 `plugin` 7 · `auth` 8) | `docs/AGENTS.md:15` 행과 `docs/IPC_CONTRACT.md:28` 을 나란히 놓고 항목별 대조 + 합 검산 | `docs/AGENTS.md` 문서 인벤토리 표 (IPC 작업 진입점) |
| 3 | settings 키를 세는 모든 곳이 **20 키**를 말하고, 카탈로그(IPC_CONTRACT §2.4 · persistence.md §1.2)에 `connectorInstances`·`pluginAddEnabled` 행이 존재한다 | `rg '1[5-9] 키' docs --glob '!handoff/**' --glob '!etc/**'` = 0건 · `rg 'connectorInstances' docs/IPC_CONTRACT.md docs/arch/backend/persistence.md` = 각 1건 이상 | 설정 스키마 변경 시 `IPC_CONTRACT §2.4` 인용 |
| 4 | settings 키 목록에 `ssoBypass` 가 아니라 `authBypass` 가 적혀 있다 (0157 개명 반영) | `rg 'ssoBypass' docs --glob '!handoff/**'` = **0건** | `docs/TRD.md:101` 스택 표 |
| 5 | DB 마이그레이션을 세는 모든 곳이 **16종**을 말하고, `persistence.md` 마이그레이션 표에 `0014`·`0015`·`0016` 행이 존재한다 | `rg '마이그레이션 1[0-5]종' docs --glob '!handoff/**'` = 0건 · `rg '0016_turn_model_context_window' docs/arch/backend/persistence.md` = 1건 이상 | 스키마 변경 시 `persistence.md §1.3` 인용 |
| 6 | `features/connectors` 슬라이스가 `docs/arch/backend/overview.md` 구현 상태 표에 행으로 존재하고, main 11 슬라이스 전수가 나열된다 | `rg 'connectors' docs/arch/backend/overview.md` ≥ 1건 · 슬라이스 나열이 실측 11종과 1:1 | `docs/AGENTS.md` → `arch/backend/overview.md` (Main 작업 진입) |
| 7 | **"main 의 원격 요청은 Chromium 스택(`net.fetch`)으로만"** 규칙이 `docs/arch/backend/security.md` 에 절로 존재하고, `netFetch`·`net-request.ts`·`no-node-fetch.test.ts` 를 강제 지점으로 명시한다 | `rg 'net-fetch\|netFetch' docs/arch/backend/security.md` ≥ 3건 | 보안 경계 확인 시 `security.md` (app/AGENTS.md:77 이 링크) |
| 8 | `infra/auth/`·`infra/log/`·`contracts/` 9모듈이 `docs/arch/backend/overview.md` 또는 `runtime-ipc.md` 의 모듈 인벤토리에 등재된다 | `rg 'credential-vault\|infra/log\|connector-plugin' docs/arch/backend/` ≥ 각 1건 | Main 모듈 배치 판단 시 |
| 9 | `docs/guides/` 3개 파일이 `docs/AGENTS.md` 문서 인벤토리 표에 행으로 등재된다 | `rg 'guides/' docs/AGENTS.md` ≥ 3건 (파일별 1행) | `docs/AGENTS.md` 인벤토리 = docs 진입점 |
| 10 | `docs/guides/AGENTS.md` 와 `docs/guides/CLAUDE.md`(= `@AGENTS.md` 한 줄) 가 신설되고, root `AGENTS.md` "디렉토리 한눈에" 표에 행이 추가된다 | 두 파일 존재 + `cat docs/guides/CLAUDE.md` = `@AGENTS.md` · `rg 'guides' AGENTS.md` ≥ 1건 | 새 세션이 root `AGENTS.md` 표로 디렉토리를 찾는 경로 |
| 11 | 기존 `AGENTS.md` **15개 전부**를 열어 코드 실측과 대조했고, 대조 결과(수정/무수정)를 verify 가 파일별로 확인할 수 있다 | plan 의 §영향 받는 파일 표에 15개 전수 + 조치 열이 채워져 있고, `git diff --stat` 의 AGENTS.md 목록이 그 표의 "수정" 행과 일치 | 각 디렉토리 진입 시 해당 `AGENTS.md` |
| 12 | `app/AGENTS.md` 의 main 모듈 표가 실측과 일치한다 — `handlers/` 10종 · `contracts/` 9모듈 · `infra/` 에 `auth`·`log` 포함 | `docs/handoff/0177-docs-agents-sync/verify.md` 가 `ls` 출력과 표를 1:1 대조 | `app/` 에서 코드 작업 시 첫 진입 문서 |
| 13 | `app/src/main/AGENTS.md` 의 레이어↔디렉토리 매핑 표가 실측과 일치한다 (같은 3항목 + `app/` 컴포지션 루트 모듈에 `auth-restore`·`chat-turn-continuation`·`updater-feed` 포함) | 위와 동일 방식 대조 | main 프로세스 코드 작업 시 |
| 14 | `docs/PHASES.md` "현재 상태" 문단이 실측(마이그레이션 16종 · main 11 슬라이스)과 일치하고, 0159~0176 중 **verify/PASS 인 9건**이 페이즈 표에 행으로 승격된다 | `rg '마이그레이션 16종' docs/PHASES.md` = 1건 · 페이즈 표에서 `0159`~`0176` slug grep → PASS 9건 각 1행 | 과거 이력 조회 진입점 |
| 15 | 이미 현행인 문서(`IPC_CONTRACT.md` 본문 §2 카탈로그 · `GLOSSARY.md` §1 표제어 · `dom-architecture.md` · `rendering.md`)의 **본문 내용은 변경되지 않는다** — 이 문서들에 대한 변경은 §2.4 키 2행 추가(IPC_CONTRACT)와 헤더 날짜 갱신에 국한된다 | `git diff docs/arch/frontend/dom-architecture.md docs/arch/frontend/rendering.md` = 헤더 라인 외 0줄 · `git diff docs/GLOSSARY.md` 가 §1 표제어 행을 삭제/개명하지 않음 | 과잉 편집이 만드는 신규 드리프트 차단 |
| 16 | 갱신한 문서마다 "최종 업데이트" 헤더가 `2026-08-05 (handoff 0177 — …)` 로 바뀐다 (헤더 관례가 있는 문서 한정) | `rg '최종 업데이트: 2026-08-05 \(handoff 0177' docs` 가 수정된 헤더-보유 문서 수와 일치 | 문서 신선도 판단 |
| 17 | 인용한 경로가 전부 실존한다 — 이번 작업이 **새로 추가한** 모든 `파일:경로` 인용을 `ls`/`Read` 로 연다 | verify 가 신규 추가 인용을 전수 추출해 존재 확인, 누락 0건 | 에이전트가 문서의 경로를 따라갈 때 |
| 18 | `app/**` 코드가 **한 줄도 바뀌지 않는다** (문서 전용 작업) | `git diff --stat -- app/src app/package.json` = 0 파일 | 게이트 회귀 0 보장 |
| 19 | `docs/spec/**` 와 `docs/etc/**` 가 변경되지 않는다 (원문 미러 편집 금지 · 연구 문서는 시점 스냅샷) | `git diff --stat -- docs/spec docs/etc` = 0 파일 | `docs/spec/AGENTS.md` 편집 금지 정책 |

## 범위 / 비범위

- **범위**:
  - `docs/` 코어 문서 수치·인벤토리·경로 정합화 — `AGENTS.md` · `PRD.md` · `TRD.md` · `PHASES.md` · `ARCHITECTURE.md` · `GLOSSARY.md`(헤더+`Tweaks` 키 수) · `IPC_CONTRACT.md`(§2.4 키 2행) · `arch/backend/{overview,persistence,security,runtime-ipc,adapters}.md` · `arch/frontend/{layers,ux-domains,overview}.md`
  - 0157~0176 구조적 신규 사실 반영 (§자료조사 B 전 항목)
  - `docs/guides/` 인벤토리 등재 + `docs/guides/AGENTS.md`(+stub) 신설
  - `AGENTS.md` 15개 전수 대조 + 필요한 것 갱신
  - `docs/PHASES.md` 현재 상태 + PASS 9건 승격
- **비범위**:
  - `docs/spec/**` (편집 금지 정책) · `docs/etc/**` (연구·전략 문서 = 작성 시점 스냅샷, 코드 동기화 대상 아님)
  - arch 문서의 **설계 서술 재작성** — 예: `provider-runtime.md` 의 P0/P1 우선순위 재평가, `standardization.md` 의 잔여 표준 로드맵 갱신. 이건 사실 정합이 아니라 **설계 판단**이라 별도 핸드오프가 맞다
  - 코드 변경 0
  - `docs/arch/`·`docs/etc/` 용 `AGENTS.md` 신설 (§자료조사 C — 상위가 이미 파일 단위로 전수 인덱싱)

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| `provider-runtime.md`·`standardization.md` 설계 로드맵 재평가 | **아니오** — 되돌릴 수 있다. 문서 서술이고 코드/스키마/이름이 걸리지 않는다. 다만 "잔여 항목 설계 대기" 표기가 실제와 다를 수 있어, 이번엔 **그 표기를 지우지 않고 그대로 둔다**(잘못된 완료 선언보다 낡은 대기 표기가 안전) |
| 미검증(impl/IMPL_DONE) 8건의 PHASES 승격 | **아니오** — 승격은 언제든 행 추가로 된다. 오히려 지금 승격하면 **검증 안 된 것을 완료로 기록**해 되돌리기가 더 비싸다 |
| `docs/arch/`·`docs/etc/` 용 `AGENTS.md` | **아니오** — 디렉토리 신설이 아니라 가이드 추가라 언제든 가능. 이름·경로가 걸리지 않는다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 구현이 기댈 것: 없음(마크다운 편집만). 측정에 `rg`/`ls`/`git diff` 사용.
- 전제: 코드가 진실이다(`docs/AGENTS.md` 원칙 §4 — "문서와 코드가 충돌하면 사용자에게 묻는다"). 이번 충돌은 전부 **문서가 코드를 못 따라온 형태**이지 설계 변경이 아니므로 문서 쪽을 코드로 맞춘다. *설계 변경으로 보이는 충돌이 나오면 그 항목만 Open Question 으로 올린다.*
- **신규 의존성**: 없음.

## 설계

### 접근 방법 — 3 패스

1. **패스 1: 수치 교정 (기계적).** §자료조사 A 의 실측 표를 기준으로, `rg` 로 찾은 stale 문자열을 파일별로 교정한다. 대상 문자열이 확정돼 있어(AC1·3·4·5 의 grep 이 그대로 완료 판정) 판단이 개입하지 않는다.
2. **패스 2: 구조적 신규 사실 삽입.** §자료조사 B 를 **기존 절 안의 행 추가**로 넣는다. 새 §번호를 만들지 않는다(anchor 안정성). 예외 1건 — AC7 의 네트워크 스택 규칙은 `security.md` 에 **새 절**이 필요하다. `security.md` 의 마지막 절 번호 뒤에 붙여 기존 §1.1~ 를 밀지 않는다.
3. **패스 3: `AGENTS.md` 전수 대조.** 15개를 열어 §영향 받는 파일 표의 "대조 항목" 을 하나씩 코드와 맞춘다. **무수정 판정도 표에 남긴다** — verify 가 "안 봤다" 와 "보고 문제없었다" 를 구분해야 한다.

### 재사용할 기존 문서 구조

- `docs/AGENTS.md` 문서 인벤토리 표 — `guides/` 3행을 **기존 표 안에** 추가(새 표 만들지 않음)
- `docs/arch/backend/overview.md` 구현 상태 표 — `connectors` 슬라이스·`infra/log`·`infra/auth` 행 추가
- `docs/arch/backend/persistence.md` §1.2 키 카탈로그 / 마이그레이션 표 — 행 추가
- `docs/IPC_CONTRACT.md` §2.4 `Settings` 인터페이스 블록 — 키 2줄 추가
- `docs/PHASES.md` 페이즈 표 — PASS 9건 행 추가
- root `AGENTS.md` "디렉토리 한눈에" 표 — `docs/guides/` 행 추가

### 레이어 경계

문서 작업이라 코드 레이어 경계는 해당 없음. 대신 **문서 레이어 경계**를 지킨다:

| 문서 레이어 | 규칙 | 이번 작업의 준수 방법 |
|---|---|---|
| SSOT (`IPC_CONTRACT.md`·`GLOSSARY.md`) | 다른 문서가 인용. 여기만 수치를 갖는다 | 총계를 재서술하던 `runtime-ipc.md:97`·`ux-domains.md:152` 는 **수치를 지우고 SSOT 링크만 남긴다**(두 파일 모두 이미 "본 문서는 총계를 재서술하지 않는다" 고 적어놓고 수치를 적는 자가당착 상태) |
| 인덱스 (`ARCHITECTURE.md`·`docs/AGENTS.md`) | 라우팅만 | `docs/AGENTS.md:15` 의 도메인 분포는 **인덱스에 실린 수치**라 갱신 대상. 다만 이후 드리프트를 막으려 "분포 정본은 IPC_CONTRACT §2" 를 명시 |
| 정본 (`arch/**`) | 영역별 사실 | 신규 사실을 여기에 넣는다 |
| 가이드 (`AGENTS.md`) | 작업 규칙 | 사실은 정본을 링크, 규칙만 보유 |

| 신규 문서 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `docs/guides/AGENTS.md` | `guides/` 3문서의 인벤토리 + "무엇이 guides 에 들어가고 무엇이 arch 로 가는가" 경계 규칙 | 가이드 | 순수 검사 — AC10 의 파일 존재 + root 표 등재 grep. 내용 정합은 인벤토리 3행 ↔ `ls docs/guides/` 대조 |
| `docs/guides/CLAUDE.md` | `@AGENTS.md` 한 줄 stub | 가이드 | `cat` = `@AGENTS.md` 정확 일치 |

## 기존 결정·규칙과의 관계

> 본문(§설계·§파생 UX·§범위)을 다 쓴 뒤 본문을 훑으며 채웠다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **정본은 `AGENTS.md`, `CLAUDE.md` 는 stub — 직접 편집 금지** | root `AGENTS.md` "AGENTS.md / CLAUDE.md 규약" | §설계 패스 3 "15개를 열어 …", 신규 문서 표의 `docs/guides/CLAUDE.md` | **유지** — stub 은 `@AGENTS.md` 한 줄로만 신설하고, 기존 15개 stub 은 건드리지 않는다 |
| **새 디렉토리에는 `AGENTS.md` + stub 을 두고 root 표를 갱신한다** | root `AGENTS.md` 규약 §5 | AC10, §설계 "재사용할 기존 문서 구조" 의 root 표 행 추가 | **유지·적용** — `docs/guides/` 가 이 규칙의 미적용 케이스였다 |
| **`AGENTS.md` 위생 — 변동성 이력은 PHASES, 라이브 상태는 INDEX 로 분리** | root `AGENTS.md` 위생 규칙 | §설계 문서 레이어 표의 "가이드 = 사실은 정본을 링크, 규칙만 보유" | **유지** — `AGENTS.md` 에 핸드오프 번호 나열을 늘리지 않고, 구조 사실은 `arch/**` 링크로 처리 |
| **`docs/spec/**` 편집 금지** | `docs/spec/AGENTS.md` "두 단 구조" | §비범위 첫 줄, AC19 | **유지** — AC19 가 기계 검증한다 |
| **PHASES 표 승격은 verify/PASS 시** | `docs/handoff/AGENTS.md:124` | §요구 비판적 검토의 "사용자에게 올릴 것", AC14, §범위 유예 표 2행 | **유지** — 미검증 8건을 승격하지 않는 근거 |
| **`ARCHITECTURE.md` 는 라우터만 · §번호 안정성 유지** | `docs/ARCHITECTURE.md:5,10` | §설계 패스 2 "새 §번호를 만들지 않는다", 예외 1건(security.md 말미 신설) | **유지** — 예외도 기존 §번호를 밀지 않는 말미 추가라 anchor 무영향 |
| **문서 언어 = 한국어, 표 위주, 결정 중심** | `docs/AGENTS.md` 원칙 §5 | 신규 `docs/guides/AGENTS.md` 작성 | **유지** |
| **"Provider 어휘 폐기 — Backend/SessionAdapter 로 통일"** | `docs/GLOSSARY.md` §3 | §자료조사 B 의 `usage provider`·`auth provider` 표현 | **유지** — 금지된 것은 *LLM 의미의* "Provider" 다. `auth provider`·`정적 사용량 provider` 는 GLOSSARY §1 에 별도 표제어로 **이미 등록된** 어휘라 그대로 쓴다(`Auth provider` 표제어 실재 확인) |
| **`docs/arch/backend/security.md §1.4-b` 의 raw secret 노출 경계표 — 표 밖 신규 노출 금지** | `app/AGENTS.md:76` | AC7 (security.md 에 네트워크 스택 절 신설) | **유지** — 신설 절은 *전송 스택* 규칙이라 노출 경계표를 건드리지 않는다. 표에 행을 추가하지 않는다 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

문서 작업이라 런타임 UX 는 `N/A`. 대신 **문서 소비 엣지케이스**를 편다:

- **부분 갱신이 만드는 신규 모순.** 한 수치를 3곳 중 2곳만 고치면 지금보다 나빠진다(어느 쪽이 최신인지 판정 불가). → AC1·3·5 를 **총계 grep 0건**으로 잡아 "남은 한 곳"을 기계적으로 드러낸다.
- **SSOT 재서술의 재발.** `runtime-ipc.md`·`ux-domains.md` 는 "총계를 재서술하지 않는다" 고 적어놓고 재서술해 드리프트했다. 이번에 숫자만 고치면 **다음 채널 추가에서 똑같이 낡는다**. → 숫자를 **지우고** SSOT 링크만 남긴다(§설계 문서 레이어 표).
- **`AGENTS.md` 무수정 판정의 관측 불가.** 15개 중 일부는 손댈 게 없다. 아무 흔적이 없으면 verify 가 "안 봤다" 와 구분 못 한다. → §영향 받는 파일 표에 **무수정 행도 대조 항목과 함께** 남긴다(AC11).
- **stub 파일의 조용한 누락.** 새 `AGENTS.md` 를 만들고 `CLAUDE.md` 를 빠뜨리면 Claude Code 세션에서만 안 보인다(Codex 는 보임 — 비대칭 실패라 발견이 늦다). → AC10 이 두 파일을 함께 요구한다.
- **날짜 헤더가 없는 문서.** `PRD.md`·`TRD.md`·`observability.md`·`system-prompt.md` 는 "최종 업데이트" 관례가 없거나 다른 형식(TRD 는 메타 표의 "문서 버전" 행)이다. → AC16 을 "헤더 관례가 있는 문서 한정" 으로 좁히고, TRD 는 그 메타 표 행을 갱신한다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **범위가 넓어 "고쳤다" 는 착각이 쉽다** — 문서 20+개, 수치 6종 | 완료 판정을 **문장이 아니라 grep 0건**으로 둔다(AC1·3·4·5·19). 주관 판정이 남는 것은 AC6·7·8·11 뿐이고 그건 인벤토리 대조라 verify 가 `ls` 로 재현한다 |
| **과잉 편집이 새 드리프트를 만든다** — 이미 현행인 문서(IPC_CONTRACT 본문·GLOSSARY 표제어·dom-architecture·rendering)를 "업데이트" 하려다 오히려 틀리게 만들 수 있다 | AC15 를 **음성 통제**로 둔다 — 이 문서들의 본문 diff 를 0 으로 제한. "모든 docs 를 업데이트하라" 를 "모든 docs 를 *건드려라*" 로 읽지 않는다 |
| **설계 판단과 사실 정합의 경계가 흐릿하다** — 예: `provider-runtime.md` 의 "잔여 항목 설계 대기" 가 지금도 맞는지 판단하려면 P0/P1 전 항목을 코드와 대조해야 한다 | 그 경계를 §비범위로 명시하고 **표기를 그대로 둔다**. 낡은 "대기" 표기는 보수적으로 틀리지만, 확인 없는 "완료" 표기는 위험하게 틀린다 |
| **PHASES 승격 9건의 요약이 부실하면 이력이 오히려 나빠진다** | 각 행 요약은 **INDEX.md 의 해당 행 + verify.md 결론**에서만 끌어온다. 새로 해석하지 않는다 |
| `git log` 가 완료 이력의 정본이라 PHASES 갱신의 가치가 제한적 | 수용한다 — PHASES 는 `PHASES.md:3` 이 스스로 "사람이 읽는 요약" 이라고 선언한다. 요약으로서의 정확성만 맞춘다 |

- 되돌리기 어려운 결정: **없다.** 전부 마크다운이고 `git revert` 로 되돌아간다. 신규 파일 2개(`docs/guides/{AGENTS,CLAUDE}.md`)도 삭제로 원복된다.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: PHASES 승격 범위(§요구 비판적 검토 말미). **규칙대로 PASS 9건만 진행하며, 이는 작업을 막지 않는다.**

## 영향 받는 파일

### A. `docs/` 코어 (수치·사실 정합)

| 파일 | 대조/조치 항목 |
|---|---|
| `docs/AGENTS.md` | 채널 82→86·`plugin` 3→7 분포 · 18키→20키 · 마이그레이션 13→16 · "scheduler 9번째 슬라이스"→11 슬라이스 · `guides/` 3행 등재 · 분포 정본 = IPC_CONTRACT §2 명시 |
| `docs/PRD.md` | `:117` 18키/13종 → 20키/16종 · `:198` 13종→16종 · `:289` 65채널→86채널 |
| `docs/TRD.md` | 메타 표 동기화 행 · `:101` 18키+`ssoBypass`→20키+`authBypass` · `:46` 18키 · `:126` 65채널·20도메인→86·23 · `:322` 18키 · `:609` 마이그레이션 13종→16종 · `:612` 64채널 |
| `docs/PHASES.md` | 현재 상태 문단(마이그레이션 16종·main 11 슬라이스·auth 플랫폼/connector) · PASS 9건 페이즈 표 승격 |
| `docs/ARCHITECTURE.md` | 헤더 날짜 · 파일 맵의 `security.md` 설명에 네트워크 스택 규칙 추가 |
| `docs/GLOSSARY.md` | 헤더 날짜 · `Tweaks` 행의 "18 키"→"20 키". **§1 표제어 추가/개명 없음**(AC15) |
| `docs/IPC_CONTRACT.md` | §2.4 `Settings` 블록에 `connectorInstances`·`pluginAddEnabled` 2줄 · 헤더 날짜 · `:8` 중복 링크(`ARCHITECTURE.md` 2회) 정리. **§2 카탈로그 본문 무변경**(AC15) |
| `docs/arch/backend/overview.md` | `:165` 16키→20키 · `:170` 마이그레이션 13종→16종 · `connectors` 슬라이스 행 · `infra/auth`·`infra/log` 행 |
| `docs/arch/backend/persistence.md` | 18키→20키(3곳) · §1.2 카탈로그 2행 추가 · 마이그레이션 표 `0014`~`0016` 3행 · 헤더 |
| `docs/arch/backend/security.md` | **신설 절**: main 원격 요청 = Chromium 스택(`netFetch`)·포트 주입·`redirect:'manual'` 의미차·`no-node-fetch.test.ts` 강제 · `infra/auth/` 자격증명 모듈 인벤토리 · 헤더 |
| `docs/arch/backend/runtime-ipc.md` | `:97` 총계 **65 삭제**(SSOT 링크만) · `contracts/` 9모듈 등재 · 헤더 |
| `docs/arch/backend/adapters.md` | 헤더 · adapters 실측 인벤토리 대조(변경 필요 시만) |
| `docs/arch/frontend/ux-domains.md` | `:152` 총계 **65 삭제**(SSOT 링크만) · 헤더 |
| `docs/arch/frontend/layers.md` | features 13 도메인 대조(일치 시 헤더만) |
| `docs/arch/frontend/overview.md` | 헤더 · 구현 상태 대조 |

### B. 신규

| 파일 | 조치 |
|---|---|
| `docs/guides/AGENTS.md` | **신설** — 3문서 인벤토리 + guides↔arch 경계 규칙 |
| `docs/guides/CLAUDE.md` | **신설** — `@AGENTS.md` 한 줄 |

### C. `AGENTS.md` 전수 (15개) — 무수정도 기록

| # | 파일 | 대조 항목 | 예상 조치 |
|---|---|---|---|
| 1 | `AGENTS.md` (root) | 디렉토리 표에 `docs/guides/` 누락 · 협업 워크플로우 현행성 | **수정** |
| 2 | `app/AGENTS.md` | `handlers/` 8→10 · `contracts/` 4→9 · `infra/` 에 `auth`·`log` · features 11 슬라이스 서술 · 스택 표 | **수정** |
| 3 | `app/src/main/AGENTS.md` | 레이어↔디렉토리 표 3항목 · `app/` 모듈에 `auth-restore`·`chat-turn-continuation`·`updater-feed` · 네트워크 절이 `security.md` 정본을 링크하도록 | **수정** |
| 4 | `docs/AGENTS.md` | (A 참조) | **수정** |
| 5 | `docs/handoff/AGENTS.md` | 상태 머신·역할 분담·트리거 — 코드 무관, 0176 까지 규칙 변경 없음 | 대조 후 판정 |
| 6 | `docs/spec/AGENTS.md` | 벤더 표 ↔ `ls docs/spec/` | 대조 후 판정 |
| 7 | `docs/spec/claude/AGENTS.md` | 인벤토리 ↔ `ls docs/spec/claude/` | 대조 후 판정 |
| 8 | `docs/spec/claude/agent-sdk/AGENTS.md` | 인벤토리 ↔ `ls` | 대조 후 판정 |
| 9 | `chats/AGENTS.md` | 인벤토리 ↔ `ls chats/` (chat1·chat2 실재 확인함) | 대조 후 판정 |
| 10 | `project/AGENTS.md` | 버전 표 ↔ `ls project/versions/` (v1~v5 실재 확인함) | 대조 후 판정 |
| 11 | `app/src/main/features/auth-platform/modules/AGENTS.md` | 0176 갱신분 — 동봉 패키지 목록 ↔ `ls` | 대조 후 판정 |
| 12 | `.../modules/confluence/AGENTS.md` | 0164 서버 목록 규칙 | 대조 후 판정 |
| 13 | `.../modules/usage/AGENTS.md` | 0176 신설 | 대조 후 판정 |
| 14 | `.../modules/__fixtures__/AGENTS.md` | 픽스처 정책 | 대조 후 판정 |
| 15 | `app/src/main/features/providers/static/modules/AGENTS.md` | opt-in 레지스트리 정책 | 대조 후 판정 |

> 5~15 는 **직전 핸드오프(0157~0176)가 만들거나 갱신한 문서**라 현행일 가능성이 높다. "대조 후 판정" 은 열어보고 결과를 표에 남긴다는 뜻이지 건너뛴다는 뜻이 아니다.

## 참고 문서

- `docs/handoff/AGENTS.md` (상태 머신 · PHASES 승격 규칙)
- root `AGENTS.md` "AGENTS.md / CLAUDE.md 규약" (정본/stub · 위생 규칙)
- `docs/AGENTS.md` "코딩 에이전트가 따라야 할 원칙" §5·§6
- `docs/spec/AGENTS.md` (편집 금지 정책)
- 선례: `docs/handoff/0094-arch-docs-sync/` · `0095-docs-core-sync/`
- IPC 변경: **없음** (`IPC_CONTRACT.md` 는 코드 반영이 아니라 **문서 누락분 2키 보충**이라 §6 변경 절차 대상 아님 — 채널 추가/변경 0)

## 게이트

- **코드 무변경이므로 `npm run lint`/`typecheck`/`test` 는 판정 대상이 아니다** — AC18 (`git diff --stat -- app/src` = 0 파일) 이 그것을 대신 보증한다. 선례: 0094 verify("코드 게이트 N/A — 문서 전용·`app/src` 무변경"), 0095 동일.
- 문서 게이트(verify 가 실행):
  - AC1·3·4·5·19 의 `rg` 명령 = 각 0건
  - AC17 — 신규 추가 인용 경로 전수 `ls` 존재 확인
  - 수치 3중 정합: 헤더 총계 = 내역 합 = 코드 실측 (IPC 86 · settings 20 · migration 16)
- 신규 테스트 요구: 없음(문서 전용).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론 2건을 추론으로 표기했다(선례 0094/0095 근거 첨부).
- [x] 자료조사 — 모든 발견에 레퍼런스를 붙였다(측정 명령 또는 `파일:라인`).
- [x] 의존 기술 — 신규 의존성 0, 전제("코드가 진실") 명시 + 예외 처리(설계 변경형 충돌은 OQ) 기재.
- [x] 파생 UX — 문서 소비 엣지케이스 5건(부분 갱신 모순 · SSOT 재서술 재발 · 무수정 관측 불가 · stub 누락 비대칭 · 날짜 헤더 부재)을 폈다. 예시 복붙 없음.
- [x] 리스크 — 5건 + 되돌리기 난이도(전부 revert 가능) + OQ 1건 분리.

**기계적으로 확인 가능한 것:**

- [x] **요구 비판적 검토** 다섯 질문 전부 답했고, 범위를 줄이지 않았다 — "이미 현행" 판정(IPC_CONTRACT·GLOSSARY 등)은 축소가 아니라 **AC15 라는 별도 통제**로 남겼다.
- [x] 인수 기준 **`검증 수단` 칸이 비어 있지 않다** — 19개 전부 grep/`ls`/`git diff` 명령. "사람 실기" 항목 0개(문서 작업이라 기계 검증이 전량 가능).
- [x] 부정형/"불변" 기준 — AC15·18·19 가 형태상 음성이지만 **측정 가능한 양성 단언**으로 썼다(`git diff --stat` = 0 파일, `rg` = 0건). "~불변" 같은 판정 불가 서술 0개.
- [x] **AC 끼리 모순 없음** — 짝지어 훑었다. 유일한 긴장은 **AC15(본문 무변경) ↔ AC3(IPC_CONTRACT §2.4 키 추가)** 인데, AC15 가 스스로 "§2.4 키 2행 추가와 헤더 날짜에 국한" 이라고 예외를 명시해 해소된다. AC16(헤더 갱신) ↔ AC15 도 같은 예외 문구가 처리한다. **자기 산출물 검사**: 이 작업이 만드는 `docs/guides/AGENTS.md`·`CLAUDE.md` 는 AC19(spec·etc 무변경)·AC18(app 무변경) 어느 쪽에도 걸리지 않는다(`docs/guides/` 는 두 경로 밖).
- [x] 인용 수치를 **이번 세션에서 직접 측정**했다 — §자료조사 A 전 행에 측정 명령 병기, 승계 0개. **내역 합 = 총계 검산 수행**(86 ✅).
- [x] 신규 모듈(문서 2종)마다 검증 방법 기재. electron/DB 의존 없음.
- [x] 전수 조사 대상에 **N 수치** 기재 — `AGENTS.md` 15개 · `CLAUDE.md` stub 15개 · guides 3파일 · main 슬라이스 11 · renderer 도메인 13 · handlers 10 · contracts 9 · migration 16 · settings 20 · 채널 86/도메인 23 · NormalizedEvent 21.
- [x] 각 AC 에 **프로덕션 도달 경로** 기재 — 문서의 프로덕션 = 에이전트 세션의 진입 경로로 해석해 채웠다.
- [x] "사람 실기" AC 0개 — 해당 없음.
- [x] 선택적 필드 판정 없음(문서 작업) — 해당 없음.
- [x] 소비 계약의 제약 필드 없음 — 대신 **문서 레이어 경계**(§설계)를 강제 지점으로 두고, SSOT 재서술 금지를 AC1 이 강제한다.
- [x] 참조 구현 = 선례 0094/0095. 이번 대상 문서 집합(§영향 받는 파일 A·B·C)이 그 두 핸드오프 대상의 **상위집합**임을 확인했다(0094=arch 16개+app AGENTS 2개, 0095=docs 코어 9종 → 이번은 그 둘 + guides + AGENTS 15 전수).
- [x] 미룬 항목마다 **일방향 여부**에 답했다(§범위 유예 표 3행 — 전부 "아니오", 근거 병기).
- [x] **관문 4 를 본문 완성 후 돌렸다** — §기존 결정 표를 본문 훑으며 채웠고(각 행에 "본문에서 건드리는 문장" 열), 인용 경로를 `ls`/`Read` 로 열었으며, `[구현자 기입]`·`[검증자 기입]` 블록이 아래 남아 있다.
- [x] "확정돼 있다"·"채택 결정이다" 서술의 앵커 grep — `docs/GLOSSARY.md` 의 `Auth provider`·`Connector`·`Plugin` 표제어 **각 1건 실재 확인**(§기존 결정 표 마지막 행의 근거). `docs/handoff/AGENTS.md:124` PHASES 승격 규칙 **직접 열어 확인**. `docs/ARCHITECTURE.md:5,10` 라우터·§안정성 서술 **직접 열어 확인**.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 작업은 **비기능(문서) = Claude 직접 구현**.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] 패스 1 — 수치 교정 (AC1·3·4·5)
- [ ] 패스 2 — 구조적 신규 사실 (AC6·7·8)
- [ ] 패스 3 — `AGENTS.md` 15 전수 대조 + guides 신설 (AC9·10·11·12·13)
- [ ] PHASES 갱신 (AC14)
- [ ] 음성 통제 확인 (AC15·18·19)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `rg` 게이트 (코드 게이트 N/A — AC18) |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (비어 있음) | — | — | — |
