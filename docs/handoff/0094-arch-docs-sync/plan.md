# Plan — 0094-arch-docs-sync

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 비기능(문서) 작업 = Claude 직접 plan → impl → verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0094-arch-docs-sync` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | PHASES 미승격 (문서 동기화) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "`docs/ARCHTECTURE.md`(=ARCHITECTURE.md)·`docs/arch`·`app` 하위의 CLAUDE.md 를 업데이트하라" | 라이브 세션 요청 (2026-07-10) |
| 추론 의도 | (추론) "업데이트" = handoff 0077 시점(커밋 54658f6)에서 멈춘 아키텍처 문서·AGENTS.md 를 0078~0093 코드 현실에 동기화. `CLAUDE.md` 는 `@AGENTS.md` stub 이므로 실제 편집 대상은 정본 `AGENTS.md`(루트 AGENTS.md "AGENTS.md / CLAUDE.md 규약") | 루트 `@AGENTS.md` 규약 + `git log` 문서 갱신 이력 |

## Context (왜)

`docs/ARCHITECTURE.md`(인덱스), `docs/arch/{frontend,backend}/*`, `app/AGENTS.md`, `app/src/main/AGENTS.md` 는 0077 검증 커밋(54658f6, 일부 24aa2dc)에서 멈춰 있고, 이후 0078~0093 이 코드에 반영됐다(175 파일, +5,616/-1,548). 문서가 현재 코드와 어긋나면 두 에이전트(Claude/Codex)의 1차 참고서가 오도한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 문서 최종 동기 시점: ARCHITECTURE.md·app/AGENTS.md = 54658f6(0077), main/AGENTS.md = 24aa2dc | `git log --oneline -- docs/ARCHITECTURE.md app/AGENTS.md app/src/main/AGENTS.md` |
| main features 는 9 슬라이스 (scheduler 신설, 0091) | `app/src/main/features/scheduler/` · migration `0013_schedules.sql` |
| 자동 업데이트 구현 완료 (electron-updater, 0084~0086) | `app/src/main/app/updater.ts` · `app/handlers/update.ts` · `app/src/shared/update-restart.ts` |
| skills 부트 시딩 구현 (0078) | `app/src/main/features/extensions/skills/seed.ts` · `app/builtin-resources.ts` |
| skills 스캔 루트에서 `<cwd>/.claude/skills` 제거 | `app/src/main/app/bootstrap.ts:105-120` |
| 마이그레이션 13종 (0001~0013) | `app/src/main/infra/db/migrations/` |
| settings 키 16개 | `app/src/main/infra/settings-store.ts` · `docs/IPC_CONTRACT.md §2.4` |
| IPC 64 채널 / 18 도메인 (IPC_CONTRACT 는 최신) | `docs/IPC_CONTRACT.md` |
| renderer features 13 도메인 (+cost·settings·update·login·debug) | `app/src/renderer/src/features/` |
| TelemetryPanel → UsagePanel (0079), 파생 SSOT `computeUsageLimits` | `app/src/renderer/src/features/chat/components/UsagePanel.tsx` · `app/src/shared/usage/limits.ts` |
| 테마 2종(white/dark), TweaksPanel 부재(DebugPanel 흡수) | `app/src/renderer/src/features/debug/components/DebugPanel.tsx:72-77` |
| Sidebar nav 4-항목 (0083) | `app/src/renderer/src/app/shell/Sidebar.tsx:17-22` |
| StatusLine 은 features/chat 으로 이동 (0093 D13) | `app/src/renderer/src/features/chat/components/StatusLine.tsx` (커밋 930bbd6) |
| CI/CD: ci.yml(main push 게이트) + release.yml(v* 태그) + release:* 스크립트, 버전 0.1.0 | `.github/workflows/{ci,release}.yml` · `app/package.json` |
| 게이트 변화: typecheck 3-tsconfig, test = vitest + node --test scripts(4종), lint 에 ./scripts | `app/package.json` scripts · `app/scripts/` |
| playwright 미설치·zustand/electron-updater/remark-gfm/diff 채택 | `app/package.json` dependencies |
| pages/EnginePage → AgentPage, EngineView → AgentEnvironmentView, SkillsMcpView → SkillsCustomizeView | `app/src/renderer/src/pages/AgentPage.tsx` · `features/engine/components/` · `features/skills/components/` |

## 인수 기준 (Acceptance Criteria)

1. `app/AGENTS.md`: main 슬라이스 9(scheduler)·infra/app 모듈 목록·게이트 표(typecheck 3분할·test 스크립트 4종·lint scripts 포함)·scripts 4종·의존성 정책(playwright 제거, zustand·electron-updater·remark-gfm·diff 추가)·CI/CD 신설·package.json 실값 반영.
2. `app/src/main/AGENTS.md`: features 9·infra(cron·settings-migration)·shared 목록(update-*·usage·time·obj·path-basename)·app 컴포지션 루트(updater·boot-report·builtin-resources·handlers 7종)·adapters flat 구조 주석·scheduler→usage 이벤트 경로 반영.
3. `docs/arch/backend/overview.md`: 자동 업데이트 채택·9 슬라이스·부트 시퀀스(시딩/스케줄러/boot-report/settings 시드/UpdateController)·상태 표(마이그레이션 13·업데이트 ✅·키 16) 갱신.
4. `docs/arch/backend/persistence.md`: 16 키·경로 정정(`infra/settings-store.ts`·`infra/db/migrations/`)·마이그레이션 13종 표·저장 대상 표(tool_calls 제거, turn_usage/provider_limits/schedule_runs/sessions 컬럼)·provider_key 0008 정정.
5. `docs/arch/backend/runtime-ipc.md`: 64 채널/18 도메인·자동 업데이트 구현 서술·scheduler 런타임·`prepareForUpdateInstall` 반영.
6. `docs/arch/backend/adapters.md`: claude.ts 개명·skills 스캔 경로/루트/캐시 정정·시딩 파이프라인(0078) 신설·§3.2.5 경로 정정.
7. `docs/arch/backend/security.md` + `terms.md`(backend): 경로 정정·로그인/SSO 게이트·업데이트 무결성 캐비앳·tool_calls→message_parts·스캔 루트 정정.
8. `docs/arch/frontend/layers.md`: §1-1 트리 전면 갱신(13 도메인·개명 3종·shared/ui 목록·StatusLine 이동)·§1.A OverlayLayer children.
9. `docs/arch/frontend/rendering.md`: §1.9 UsagePanel 개정·라이브 reasoning StreamingMarkdown 경유(0093)·markdown 위치 정정.
10. `docs/arch/frontend/ux-domains.md` + `overview.md` + `state.md` + `dom-architecture.md` + `terms.md`(frontend): 카탈로그 개명·64 채널·2테마·신규 UX(버전 모달·삭제 확인·업데이트 UX)·신규 store 행·nav 4-항목·pendingDelta→live.text·`/agent` 정정.
11. `docs/ARCHITECTURE.md`: rendering.md 행 설명 TelemetryPanel→UsagePanel·최종 업데이트 날짜 갱신.
12. 문서가 언급하는 신규/정정 경로가 모두 실존한다 (ls/grep 대조).
13. `CLAUDE.md` stub·`docs/spec/**`·`IPC_CONTRACT.md`·`GLOSSARY.md` 는 무변경.

## 범위 / 비범위

- **범위**: 위 문서 16개 파일의 사실 정정 + 누락 서브시스템 추가. 0078 이전 pre-drift(2테마·TweaksPanel·`/agent`·markdown 위치·0062 개명·provider_key 오기)도 같이 정정.
- **비범위**: PRD/TRD/PHASES/IPC_CONTRACT/GLOSSARY 갱신, 코드 변경, `docs/guides/`, 신규 설계 결정(문서는 현재 코드·기확정 결정만 기술).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 조사 결과는 Explore 감사 3건(frontend/backend/AGENTS) + 코드 직접 대조에 근거.
- 신규 의존성: 없음 (문서 전용).

## 설계

- 각 문서의 정확한 섹션은 유지하고 stale 주장만 국소 수정 — 문서 구조(§번호)는 보존해 기존 인용 anchor 를 깨지 않는다.
- 신규 서브시스템(자동 업데이트·scheduler·skills 시딩·사용량 한도)은 해당 문서의 기존 섹션(overview §3/§4, runtime-ipc §3.1, adapters §2, persistence §1.3)에 편입 — 새 파일을 만들지 않는다.
- 한국어·표 위주·결정 중심 톤 유지 (`docs/AGENTS.md` 원칙 5).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

N/A (문서 전용). 단, 문서 간 상호 참조(ARCHITECTURE 인덱스 설명 ↔ arch 본문, overview 상태표 ↔ 각 문서 본문)의 자기모순을 남기지 않는다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 문서 대량 수정 중 새 오기 유입 | verify 에서 언급 경로 실존 grep/ls 1:1 대조 |
| §번호 변동으로 타 문서 인용 파손 | 섹션 구조 보존, 삽입은 기존 § 내부 또는 말미 |
| 감사가 놓친 drift 잔존 | 범위를 "0078~0093 + 확인된 pre-drift"로 한정 명시 — 전수 보장 아님 |

- 되돌리기 어려운 결정: 없음 (문서, git revert 가능).
- 단독 결정 금지 항목: 없음 (기확정 사실의 전사만).

## 영향 받는 파일

- `app/AGENTS.md` · `app/src/main/AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/arch/backend/{overview,persistence,runtime-ipc,adapters,security,terms}.md`
- `docs/arch/frontend/{overview,layers,rendering,ux-domains,state,dom-architecture,terms}.md`
- `docs/handoff/0094-arch-docs-sync/{plan,verify}.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/IPC_CONTRACT.md` (채널 수 SSOT — 본 작업은 인용만)
- `docs/handoff/0078~0093/*/plan.md·verify.md` (변경 사실의 출처)
- `docs/PHASES.md` (승격 이력)

## 게이트

- 코드 게이트 N/A (문서 전용). 대신: 언급 경로 실존 대조 + 수치(슬라이스/채널/마이그레이션/키) 코드 1:1 대조 + AGENTS.md 위생 스캔(키/토큰/이메일 grep).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 인용, stub→AGENTS.md 해석은 추론 표기.
- [x] 자료조사 — 모든 발견에 코드 경로/커밋 레퍼런스.
- [x] 인수 기준 — 13개 번호, 조사 근거, 검증 가능.
- [x] 의존 기술 — 신규 의존성 없음 명시.
- [x] 파생 UX — N/A + 문서 자기모순 방지 항목.
- [x] 리스크 — 오기 유입·anchor 파손·잔존 drift 완화책.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: (구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|

## [구현자 기입] 구현 체크리스트

- [ ] AC1~2 AGENTS.md 2종
- [ ] AC3~7 arch/backend 6종
- [ ] AC8~10 arch/frontend 7종
- [ ] AC11 ARCHITECTURE.md
- [ ] AC12 경로 실존 대조

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (기입 예정) |
| 실행 명령 | 경로 대조 grep/ls |
| 게이트 결과 | N/A (문서) |
| 블로커 / 역질문 | |
| 대상 커밋 | |
