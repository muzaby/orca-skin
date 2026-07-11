# Verify — 0094-arch-docs-sync

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 문서 작업 — Claude 가 plan→impl→verify 순차 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0094-arch-docs-sync` |
| 검증자 | Claude Code |
| 일자 | 2026-07-10 |
| 대상 커밋 | `04aa676` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 정정 ①: settings 키 16→**17** (`SettingsSchema` 실측) | 타당 — `protocol.ts:404-439` 재확인, 17 키 | 매트릭스 #4 를 "17 키" 기준으로 대조 |
| 설계 리뷰 정정 ②: `settingsModalStore.tab` 유니온 (providerTabId 필드 아님) | 타당 — `settingsModalStore.ts:7,19-31` | state.md 표기 실측값 확인 |
| 선조치 ✅ #1: app/AGENTS.md CodeBlock 경로 오기 동반 정정 | 타당 (명백한 경로 오기 — 선조치 경계 내) | 매트릭스 #1 증거에 포함 |
| 선조치 ⚠️ #2: **IPC_CONTRACT §2.4 Settings 타입 블록 stale** (theme enum·`spendingLimitUsd`/`scheduler` 누락) | 타당 — 비범위 판단 동의(SSOT 는 §6 변경 절차 별도) | **사용자 결정 대기** — 파생 이슈 D1 로 기록 |
| 선조치 ✅ #3: frontend overview §2 스택 표 Zustand 정정 | 타당 (§3 상태표와의 자기모순 해소 — 설계 "파생 UX" 원칙과 정합) | 매트릭스 #10 증거에 포함 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `app/AGENTS.md` 갱신 | ✅ | 슬라이스 9(+scheduler)·infra `cron/errors/vars/settings-migration`·`updater/builtin-resources/handlers` 반영·게이트 표(typecheck 3분할·test 스크립트 4종·release:*)·scripts 3종 문서화·의존성 표(zustand/electron-updater/remark-gfm/diff 추가, playwright 미설치 표기)·"CI / 릴리스" 섹션 신설·package.json 실값 |
| 2 | `app/src/main/AGENTS.md` 갱신 | ✅ | features 9·infra cron/settings-migration·shared 목록(update-restart/usage/time/obj/path-basename)·app 루트 7-handler 열거·adapters flat + `adapter-impl` vestigial 주석·scheduler 주입 경로 단락 |
| 3 | backend `overview.md` | ✅ | §2 electron-updater/croner 채택 행·§3 트리(scheduler·updater·boot-report·builtin-resources·handlers boot/update·infra cron)·§3.1 부트 시퀀스(boot-report 계측·시딩·Scheduler·0090 시드·UpdateController)·§4 (마이그레이션 13·자동 업데이트 ✅·17 키 참조·시딩/scheduler/provider 한도/CI 행) |
| 4 | backend `persistence.md` | ✅ | 17 키 카탈로그(경로 `infra/settings-store.ts`)·13 마이그레이션 표·저장 대상 표(tool_calls 제거, turn_usage/provider_limits/schedule_runs/session_lineage 추가)·`infra/db/migrations/` 경로·append-only 기계 강제(0087) 주석·provider_key 절 제목 0008 정정 |
| 5 | backend `runtime-ipc.md` | ✅ | §2.1 64 채널(+boot/update/notify→ 도메인 열거)·§3.1 자동 업데이트 구현 서술(autoDownload=false·재시작 게이트·더미 토글)·§3.1-b 스케줄러 신설 |
| 6 | backend `adapters.md` | ✅ | §1.2/§1.5 `claude.ts`/`claude-map.ts` 개명·§2.1 스캔 루트(sources/skills + ~/.claude, cwd 제거)·`Bootstrap.skillsCache`·번들 시딩(0078) 단락·§3.2.5 `adapters/hooks.ts`/`features/extensions/builder.ts` |
| 7 | backend `security.md` + `terms.md` | ✅ | mcp 경로 2건 정정·§1.7 신설(SSO 게이트·ssoBypass·unsigned NSIS·sha512 검증)·terms §3 message_parts·§4 스캔 루트 |
| 8 | frontend `layers.md` §1-1 트리 | ✅ | features 13 도메인·AgentPage(+useSessionActions)·AgentEnvironmentView/SkillsCustomizeView 개명·NewChatButton 삭제 반영·shared/ui 목록(Modal/ConfirmDialogHost/RenameInput/Meter/UsageCircle/markdown 등)·StatusLine features/chat 이동·app/(RootGate/LoginFrame/SearchModal/boot/)·§1-2 TweaksPanel 각주·2테마 |
| 9 | frontend `rendering.md` | ✅ | §1.9 UsagePanel 개정(분해 행 제거→컨텍스트바+한도바+`>`·`computeUsageLimits`)·§1.2/§1.7 라이브 reasoning StreamingMarkdown(0093)·§1.3 markdown 위치 `shared/ui/markdown/` |
| 10 | frontend `ux-domains.md`+`overview.md`+`state.md`+`dom-architecture.md`+`terms.md` | ✅ | 카탈로그 개명(engine/skills/debug 행)·§3.4 64 채널·2테마·§1.3-b 신규 UX 표(0083/0085/0090)·overview §2 Zustand/§3 상태표 8행 갱신+7행 신설·state §1.1 update/settings-modal/agent store 행·dom-arch 테마/children·terms pendingDelta→live.text·screens 해체·`/agent` |
| 11 | `docs/ARCHITECTURE.md` | ✅ | rendering.md 행 설명 UsagePanel·최종 업데이트 갱신. §3 매핑표 무변경 |
| 12 | 인용 경로 실존 | ✅ | 55건 `[ -e ]` 일괄 검사 MISSING 0 + 수치 실측(마이그레이션 13·main features 9·renderer features 13·settings 17 키) |
| 13 | 무변경 확약 | ✅ | `git diff --stat`: CLAUDE.md stub·`docs/spec/**`·`IPC_CONTRACT.md`·`GLOSSARY.md`·`app/src/**` 변경 0 |

추가(범위 내 정합화): 교차 참조 3건(`provider-runtime.md` §8 표시 컴포넌트명·`adapters.md` §1.7 표·`docs/AGENTS.md` frontend 행)을 UsagePanel/현행 상태로 동반 갱신 — docs/AGENTS.md 원칙 5(영향 참조 동반 갱신).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | — | — | N/A (문서 전용, `app/src` 무변경) |
| 인수 기준 ↔ 문서 대조 | ✅ | 이견 시 중재 | 13/13 |
| 경로 실존·수치 대조 | ✅ | — | MISSING 0 |
| 문서 형식/한국어 컨벤션 | ✅ | — | 표 위주·기존 톤 유지, § 구조 보존(anchor 무파손) |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일 패턴 0 |
| 잔존 drift 전수 보장 | ✖ (범위 = 0078~0093 + 확인된 pre-drift) | ✅ 발견 시 후속 | 스팟 스캔(TelemetryPanel/53채널/TweaksPanel/classic) 잔존 0 — 단 provider-runtime.md 의 historical `claude-code.ts` 인용은 의도적 보존 |
| IPC_CONTRACT §2.4 stale 후속 | ✖ 단독 결정 금지 | ✅ 결정 | **사람 확인 대기 (D1)** |

## 게이트 재실행 결과

N/A — 문서 전용 변경(`app/src`·`app/scripts`·CI 무변경). 대신 실행한 검사:

```
$ for p in <문서 인용 경로 55건>; do [ -e "$p" ] || echo MISSING; done   # → MISSING 0
$ ls app/src/main/infra/db/migrations | wc -l                             # → 13
$ ls app/src/main/features | wc -l                                        # → 9
$ ls app/src/renderer/src/features | wc -l                                # → 13
$ git log -1 --format=%B | git interpret-trailers --parse                 # → trailer 7종 정상 파싱
```

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: 0건.
- 변동성 혼입: 핸드오프 번호 인용(0078~0093)은 *결정 출처 표기* 용도로 기존 문서 관례와 동일. 버전 수치는 caret 범위(`^6.x` 등)로 기재해 드리프트 최소화.

## PHASES.md 정합성

- 문서 동기화 작업 — PHASES 승격 대상 아님(기능/구조 변경 없음, changelog 성격은 handoff 문서 자체가 담당). INDEX.md 에 verify/PASS 반영.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 조사 위임(Explore 감사)이 settings 키 수를 16으로 오산 — 수치는 스키마 실측으로 재검증하는 관례를 세움(구현 턴에서 교정).
- 구현 단계: 문서 16개 일괄 수정이라 §번호 신설을 소절(-b·1.7) 방식으로 제한 — anchor 파손은 없으나 소절 네이밍(§3.1-b·§1.3-b)이 관례로 굳을지는 후속 관찰.
- 검증 단계: 전수 drift 보장은 불가(스팟 스캔) — provider-runtime.md·standardization.md 본문의 historical 코드 인용(`claude-code.ts`·`router.ts` 등)은 구현-상태 서사와 커밋 hash 에 묶여 있어 의도적으로 보존했다. 전면 현행화가 필요하면 별도 핸드오프.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 13/13.
- **사람 확인 대기**: ① IPC_CONTRACT §2.4 `Settings` 타입 블록 stale(D1) 후속 여부 결정 ② 문서 서술 어감·범위 검수.

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `docs/IPC_CONTRACT.md` §2.4 `Settings` 타입 블록 stale — `theme: "classic"\|"dark"\|"cool"`(실제 `white\|dark`), `spendingLimitUsd`·`scheduler` 키 누락 | 구현자 코멘트 #2 / verify r1 | IPC_CONTRACT 는 SSOT + §6 변경 절차 대상이라 본 핸드오프 비범위 — 사용자 승인 시 소규모 후속으로 §2.4 블록만 현행화 | **해결 (0095)** — 사용자가 docs/ 코어 동기화를 요청해 `0095-docs-core-sync` 가 §2.4(17 키·white/dark·SettingsPatch shape) + notify 도메인 분포 정합까지 현행화 |
