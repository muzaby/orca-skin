# Verify — 0292-deep-optimization

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **RETURN_TO_PLAN (V1+ΔV1 r1)** — PLAN_GAP 2(D10·D11) · PAIR_FAIL 6(VP-02·03·04·05·08·10) · 고장 못 잡음 21 |
| 검증자 | Claude Code (구현자 Codex와 다른 에이전트) |
| 일자 | 2026-11-02 |
| 대상 커밋/range | `a2b5ca3..c9d212b` — PR #525 `codex-0292-deep-optimization`. `c9d212b`는 `git cat-file -t` = commit, `origin/main` 미병합(브랜치 좌표 — 병합 뒤 `main` 해시로 교정) |
| 구현 전 plan 기준 | `a2b5ca3`의 `plan.md` = V1 `64047af` + ΔV1 `3c50653`(둘 다 `origin/main` 조상) |
| V mode / 유효 V | `Delta V` / `0292:V1@64047af + ΔV1@3c50653` |
| 라운드 | 1 (이 handoff의 verify 1회째) |
| 상태 | RETURN_TO_PLAN |
| 자기 검증 여부 | 아니오 — 설계 Claude(다른 세션) · 구현 Codex · 검증 Claude. 보고에 없는 독립 축 58건을 따로 심었다(§4) |

## 0. 기준선 / plan 변경 확인

✅ 기준선이 diff로 성립한다 — 설계 커밋(`64047af`·`3c50653`)과 구현 커밋(`c9d212b`)이 분리돼 있다.

- 구현 커밋의 `plan.md` 삭제 22행은 메타 `상태` 1행과 `[구현자 기입]` 자리표시자뿐이다(`git diff a2b5ca3 c9d212b -- …/plan.md | grep '^-[^-]'`). Decision·Part I·AC·V·§10 변경 0.
- 채점 기준은 `a2b5ca3`의 plan이다 — ΔV1 절이 대체한 V1 행(D-005·D-008·AC2~AC6·EP-02·EP-04·EP-05 #1-8·#15·EP-03 #1)은 대체 행으로 읽었다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | V1 `64047af`·ΔV1 `3c50653` 둘 다 `main` 조상. ΔV1이 대체 행과 대체 Decision(D-014·D-015)을 명시 |
| NEW/CHANGED ↔ 같은 레벨 REQUIRED pair | 유효 | VP-01~VP-11 전부 REQUIRED(UT 4 · IT 3 · ST 1 · AT 3) |
| `SUPERSEDED` 이관 | 유효 | V1 VP-02·VP-04 변이 4종 → EP-02′·EP-04′ 등록 변이로 이관, 폐기 0 |
| §10 자리 목록·검색 재실행 | **PLAN_GAP 1 (D10)** | 기준선 worktree `a2b5ca3`에서 `scan/sites.sh` 19개 N이 설계 N과 같고 HEAD 출력은 `evidence/r1-final-sites.txt`와 정렬 비교 동일. 단 VP-04 검색은 `registry.ts` 한정·해법 이름 술어라 ΔV1 VP-04 path의 방송 → preload → 가용성 store 파일을 덮지 않는다 |
| 선택 적대 증거 | 유효 | 등록 29종(R* 25 · 번들 B* 4) — 전부 이유와 자리가 있다 |
| 현재 변경 운영 gate | 유효 | §7-A 운영 gate 표 9종 |
| Decision 범위 | **PLAN_GAP 1 (D11)** | 폴백 중 모델 메뉴의 명시 Claude 선택이 `lastBackend`를 기록하는지 D-007·AC7·EP-03 어디에도 없다 |

- root PLAN_GAP: D10 → VP-04(·VP-03 입력) · D11 → VP-03/AC7.

## 1. Product & UX / ACTIVE Decision

⚠️ 코드 경로는 Part I·ACTIVE Decision과 일치한다. 다만 §13 못 잡음 자리는 테스트가 잠그지 않는다.

| Decision / 요구 | production path(HEAD) | 판정 |
|---|---|---|
| D-014 부팅 안 동시 확인 | 시작 `bootstrap.ts:471-476`(첫 await `:609` 전) → 합류 `:865` → `finish()` | 충족 · 시작 위치 미잠금(X03) |
| D-015 재확인·변화 시 방송 | 경로 설정 `bootstrap.ts:717-724`→`settings-reactions.ts:34-43` · recheck `misc.ts:42-45` · focus `bootstrap.ts:918`→`registry.ts:79-93` → 변화 비교 `registry.ts:51-52` → `bootstrap.ts:910-917` → `send.ts:26-28` → `preload/index.ts:190-201` → `harnessAvailabilityStore.ts:15-29` | 충족 · 배선·`failed`·identity·채널·store 미잠금 |
| D-006 비노출·비활성·백그라운드 미시작 | Notice `ChatTile.tsx:65-74,162-163` · 추가 메뉴 `AgentEnvironmentView.tsx:101-107` · 웜업 `bootstrap.ts:898-908` · Host `harness-host.ts:16,27-28` · 감시 `bootstrap.ts:1076-1080` · 준비 `composer-catalog.ts:16-17` | 충족 · 재확인 클릭·사유 값·전환 무효화 미잠금 |
| D-007 Claude 시작·`lastBackend` 미기록 | 재시드 `chatStore.ts:187-219` · 시드 `:221-229` · 자동 폴백 미기록 `:1893-1904` | 자동 폴백 충족 · 명시 선택 범위 미정(D11) |
| D-009 raw 분리 | writer `native-sync.ts:122-126` → `session.ts:69` 분리 → `loadSession` · lazy `native-sync.ts:34-38` | 충족 |
| D-004·D-013 번들 | `electron.vite.config.ts:36` · `UsageTab.tsx:19-21,167` · `syntax.ts:20-43` · `package*.json` diff 0 | 충족 |
| D-012 `HostHarnessPort` 형상 | `harness-host.ts:12-21` `{installed, version?}` | 충족 |
| D-003 회귀 0 | vitest 실패 ID 차집합 ∅ · Windows CI green(§9) | 충족(미잠금 자리 제외) |

## 2. 구현 결과 비판적 검토 — AC 전에

⚠️ 동작 결함은 찾지 못했다. 드러난 것은 설계 drift 1건(N2)과 근거 없는 주장 1건(X05)이다.

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 유지 | OpenCode `installed()`는 모든 실패를 `missing`·`failed`로 흡수(`server.ts:178-205`). 부팅 확인 거절은 합류에서 다시 던진다(`bootstrap.ts:865`, 테스트 `rethrows a failed concurrent installation check…`) |
| false success | 유지 | 버전 확인 실패 promise는 캐시에서 내린다(`server.ts:151-158`) — "다시 확인"이 실제로 재실행 |
| 부분 실패·rollback | 유지 | raw 분리는 UPDATE 1문 + `raw_json IS NULL` 가드(`native-history-queries.ts:80-83`), X48(가드 제거) 잡음 6 |
| A 대신 B 구현 | **drift** | registry가 `adapters/common`에서 하네스 이름을 분기한다(`registry.ts:40` `backend === 'claude'`) — plan §16 "구체 하네스 비의존"·EP-04′ 주석 "Claude는 필드 없이 `usable:true`"와 다른 방식(N2) |
| 최적화가 잃은 관측 | 유지 | 상시 타이머 제거 뒤 대기 재시도는 500ms timeout으로 남는다(X19·X20·X45·X46 잡음) |
| 출력·요청 상한 | 유지 | focus 재확인은 `missing`·`failed`에서만 동기 stat, 프로세스 없음(`registry.ts:79-93`) |
| 구현자 주장 vs 증거 | **근거 없음** | Product/UX 파생 검토 5행 "availability generation이 오래된 결과를 버린다"를 잠그는 테스트가 없다 — X05 못 잡음(D10) |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh a2b5ca3..c9d212b   # 53 파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export `useHarnessAvailable` | 죽은 코드 | 참조 0(`harnessAvailabilityStore.ts:30`) — N3 |
| 테스트 전용 `projectTimeline` · `agentStore.dispose` | production 호출 0 | 테스트만 호출(`projection.ts:61` · `agentStore.ts`의 `dispose`) — N3 |
| `explicitHarness` 옵션 | production 호출 0 | 모델 메뉴 `onPick`(`Composer.tsx:435-441`)은 넘기지 않는다 — DRAFT의 "명시 기록" 단언은 production이 가지 않는 경로(D11) |
| 동일 규칙 중복 | drift | `copyable`(`projection.ts:126-130`)이 `turnCopyText` 빈 문자열 판정(`turns.ts:99-104`·`parts.ts:56-60`)을 재구현, `parentToolRunId: ''`에서 갈린다(D8) · runtime 행 가용성 게이트가 `agent:list` 게이트와 이중(X57·X65 동치, N5) |
| 신규 등록값의 기존 소비처 | 무영향 | `BackendListResult` 기존 키 유지(INSTALL) · `AgentEnvironment.unavailable` 가산 |
| producer ↔ consumer 소비처 차집합 | ∅ | main `usable`·`availability(`·`settled(` 소비 13자리, renderer `.supported` 4·가용성 store 6자리 — 전부 EP 목록 자리 또는 그 배선(`git grep` @`c9d212b`) |
| 형제 정책 비대칭 | 없음 | scan 3절 0 |

## 4. 기존 테스트 / semantic 검증 확인

- 구현자 좌표 45개(`[구현자 기입]` 별칭 표)가 HEAD 전체 실행 JSON에 실재하고 전부 green이다(파일·케이스명 대조 스크립트, 누락 0).
- 선택 적대 증거 재측정: 등록 29 · 구현자 새 oracle 8 · 독립 축 58 = **95**. 등록 29·새 oracle 8은 전부 잡음.
- 자리 미지정 등록 변이: 해당 없음 — VP-05 "소비자별 게이트 제거"는 #6·#7·#9·#11·#12·#15 여섯 자리에 각각 심었다.
- 이전 라운드 대조: 해당 없음(1회째).
- 실행 방식: 각 고장을 심고 `vitest related <파일> --run`(Electron Node 모드) 뒤 원문 복구, `git diff --quiet` 확인. related에서 새 실패 0인 25건은 **전체 스위트에 조합으로 다시 심어** 확인했다 — 조합 A 19건·조합 B 6건, 둘 다 908파일·8398케이스 중 실패 23 = 기준선 ID와 동일, 새 실패 0.
- 재실행 도구: [`verify-evidence/r1/mutations.json`](verify-evidence/r1/mutations.json)(95건 정의·결과) · [`mutate.mjs`](verify-evidence/r1/mutate.mjs)(`node …/mutate.mjs X03 [--full]`, `ORCA_VITEST`로 실행기 지정).
- `N회` 관측 주체: AC3′ = 주입 `readVersion` 호출 수(`server.test.ts` 'coalesces version checks across install…') · registry probe 수(JOIN) · 투영 spy(MEMO head 1/tail 6).
- 순서 관측: LOAD는 `mock.invocationCallOrder`(분리 → `get`) · BOOT는 boot report 단계와 `finish` spy.
- 형제 슬롯 맞바꿈: R03b(하네스) · X22(head↔tail) · X33·X42·X43(채널) — X33만 못 잡음.

**고장 이력** — 95건 = 잡음 70 · 동치 4 · 못 잡음 21. 동치 4건은 코드 근거와 전체 스위트(조합 B) 무음으로 판정했다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 동치 근거 | 귀속 |
|---|---|---|---|---|---|---|
| R02a | `main/app/bootstrap.ts:476` | 뒤집기 | 합류 대신 시작 직후 `await installation`(순차 대기) | 잡음 · 1 | `bootstrap.opencode-warmup.test.ts` | VP-02 등록 #1 |
| R02b | `main/app/bootstrap.ts:865` | 제거 | `finish()` 앞 `await installation` 삭제 | 잡음 · 2 | `bootstrap.opencode-warmup.test.ts` | VP-02 등록 #2 |
| R03a | `renderer/features/chat/store/chatStore.ts:226` | 제거 | 시드 폴백 삭제 → `backend ?? claude` | 잡음 · 4 | `steps.availability.test.ts` | VP-03 등록 #1 |
| R03b | `renderer/features/chat/components/ChatTile.tsx:66` | 맞바꿈 | 가용성 조회 하네스 claude↔opencode | 잡음 · 1 | `ChatTile.harness.test.ts` | VP-03 등록 #4 |
| R03c | `renderer/features/engine/common/components/AgentEnvironmentView.tsx:101` | 뒤집기 | 추가 항목 `disabled` 조건 반전 | 잡음 · 4 | `AgentEnvironmentView.crud.test.ts` | VP-03 등록 #9 |
| R04a | `main/adapters/common/registry.ts:90` | 제거 | focus identity 비교 삭제 | 잡음 · 1 | `registry.availability.test.ts` | VP-04 등록 #3 |
| R04b | `main/adapters/common/registry.ts:51` | 제거 | 변화 비교 삭제(매번 통지) | 잡음 · 3 | `bootstrap.opencode-warmup.test.ts` | VP-04 등록 #1 |
| R05-6 | `main/app/harness-host.ts:16` | 호출 대체 | Host `installed`가 `adapter.isInstalled()` 직접 호출 | 잡음 · 2 | `harness-host.test.ts` | VP-05 등록 #6 |
| R05-7 | `main/app/harnesses/opencode/warmup.ts:41` | 제거 | 웜업 `installed` 게이트 삭제 | 잡음 · 2 | `warmup.test.ts` | VP-05 등록 #7 |
| R05-9 | `main/app/handlers/misc.ts:51` | 제거 | agent:list usable 필터·행 게이트 삭제 | 잡음 · 1 | `misc.runtime-catalog.test.ts` | VP-05 등록 #9 |
| R05-11 | `main/features/harnesses/common/runtime-catalog.ts:130` | 고정값 | runtime 행 `supported: true` | 잡음 · 1 | `runtime-catalog.test.ts` | VP-05 등록 #11 |
| R05-12 | `main/app/composer-catalog.ts:16` | 제거 | 컴포저 준비 unavailable 게이트 삭제 | 잡음 · 1 | `composer-preparation-service.test.ts` | VP-05 등록 #12 |
| R05-15 | `main/app/bootstrap.ts:1077` | 제거 | 전역 감시 usable 조건 삭제 | 잡음 · 1 | `bootstrap.native-history.test.ts` | VP-05 등록 #15 |
| R06a | `main/features/history/native-sync.ts:125` | 호출 대체 | payload에 raw 재합류(`JSON.stringify(result.snapshot)`) | 잡음 · 5 | `native-session.test.ts` | VP-06 등록 #9 |
| R06b | `main/app/handlers/session.ts:69` | 뒤집기 | load 뒤 분리 | 잡음 · 1 | `session.load.test.ts` | VP-06 등록 #12 |
| R08a | `renderer/features/chat/harnesses/opencode/transcript/Timeline.tsx:39` | 제거 | head `useMemo` 삭제 | 잡음 · 1 | `Timeline.memo.test.ts` | VP-08 등록 #5 |
| R08b | `renderer/features/chat/harnesses/opencode/transcript/projection.ts:3` | 호출 대체 | meta 투영 중 `turnCopyText` 즉시 계산 | 잡음 · 2 | `Timeline.memo.test.ts` | VP-08 등록 #2 |
| R09-1 | `main/app/project-resource-sync.ts:55` | 호출 대체 | 500ms 상시 interval 복원 | 잡음 · 2 | `project-resource-sync.test.ts` | VP-09 등록 #1 |
| R09-2 | `main/app/harnesses/opencode/mcp-reconcile.ts:13` | 호출 대체 | 500ms 상시 interval 복원 | 잡음 · 1 | `mcp-reconcile.timer.test.ts` | VP-09 등록 #2 |
| R09-3 | `main/infra/log/file-transport.ts:56` | 호출 대체 | 상시 flush interval 복원 | 잡음 · 1 | `file-transport.test.ts` | VP-09 등록 #3 |
| R09-5a | `main/app/bootstrap.ts:1144` | 제거 | activity → `projectResourceSync.activityChanged` 삭제 | 잡음 · 1 | `bootstrap.native-history.test.ts` | VP-09 등록 #5 |
| R09-5b | `main/app/bootstrap.ts:1145` | 제거 | activity → adapter `resourceActivityChanged` 삭제 | 잡음 · 1 | `bootstrap.native-history.test.ts` | VP-09 등록 #5 |
| R09-6 | `main/app/bootstrap.ts:1120` | 제거 | lease → `leasesChanged` 삭제 | 잡음 · 1 | `bootstrap.native-history.test.ts` | VP-09 등록 #6 |
| R11a | `main/adapters/claude/project-settings.ts:127` | 호출 대체 | `canonicalJson` → `JSON.stringify` | 잡음 · 1 | `canonical-consumers.test.ts` | VP-11 등록 #1 |
| R11b | `main/adapters/claude/background.ts:39` | 호출 대체 | `canonicalJson` → `JSON.stringify` | 잡음 · 1 | `canonical-consumers.test.ts` | VP-11 등록 #2 |
| N01 | `main/app/bootstrap.ts:918` | 제거 | focus 리스너 등록 삭제 | 잡음 · 1 | `bootstrap.opencode-warmup.test.ts` | 구현자 새 oracle |
| N02 | `main/app/bootstrap.ts:912` | 제거 | 가용성 방송 삭제 | 잡음 · 1 | `bootstrap.opencode-warmup.test.ts` | 구현자 새 oracle |
| N03 | `main/app/bootstrap.ts:914` | 제거 | 리스너의 웜업 재개 삭제 | 잡음 · 1 | `bootstrap.opencode-warmup.test.ts` | 구현자 새 oracle |
| N04 | `renderer/shared/stores/agentStore.ts:93` | 제거 | agentStore 가용성 구독 삭제 | 잡음 · 1 | `agentStore.test.ts` | 구현자 새 oracle |
| N05 | `main/adapters/claude/sdk.ts:8` | 제거 | loader memo(`??=` → `=`) | 잡음 · 1 | `sdk.test.ts` | 구현자 새 oracle |
| N06 | `main/adapters/claude/native-history.ts:217` | 뒤집기 | raw를 append 판정 전에 즉시 읽기 | 잡음 · 1 | `native-history.test.ts` | 구현자 새 oracle |
| N07 | `renderer/app/boot/steps.ts:104` | 뒤집기 | `backend` 단계를 landing 뒤로 | 잡음 · 1 | `steps.availability.test.ts` | 구현자 새 oracle |
| N08 | `main/adapters/common/registry.ts:40` | 제거 | Claude 강제 usable 삭제 | 잡음 · 2 | `registry.availability.test.ts` | 구현자 새 oracle |
| X01 | `renderer/features/chat/harnesses/opencode/transcript/projection.ts:126` | 고정값 | `copyable: true ||` | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-08 #2 |
| X02 | `renderer/features/chat/providers/ChatProvider.tsx:12` | 제거 | store → `applyHarnessAvailability` 구독 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #2·#3 |
| X03 | `main/app/bootstrap.ts:471` | 뒤집기 | 확인 시작을 첫 await(`:609`) 뒤 `workspace` 앞으로 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-02′ #1 |
| X04 | `main/adapters/common/registry.ts:83` | 제거 | focus 대상에서 `failed` 제외 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-04′ #3 |
| X05 | `renderer/shared/stores/harnessAvailabilityStore.ts:28` | 제거 | 초기 목록 seed의 generation fence 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — 목록 밖(VP-04 path) |
| X06 | `main/infra/db/native-history-queries.ts:81` | 호출 대체 | `->` → `json_extract` | 잡음 · 2 | `native-history.db.test.ts` | 재량 — EP-06 #8 |
| X07 | `main/features/history/native-sync.ts:35` | 제거 | legacy 내장 raw 분기 삭제 | 동치 | legacy 행은 raw_json IS NULL이라 raw()가 undefined → 유일 소비자 claude/native-history.ts:217이 `?? previous.snapshot.raw`로 같은 값을 쓴다 | 재량 — EP-06 #10 |
| X08 | `main/adapters/claude/native-history.ts:217` | 제거 | lazy `previous.raw()` 무시 | 잡음 · 1 | `native-history.test.ts` | 재량 — EP-06 #14 |
| X10 | `main/app/settings-reactions.ts:40` | 고정값 | 경로 비교 `true` | 잡음 · 1 | `settings-reactions.test.ts` | 재량 — EP-04′ #5 |
| X12 | `renderer/features/chat/components/HarnessUnavailableNotice.tsx:29` | 다른 값 | Notice 재확인 대상 `claude` | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #4 |
| X13 | `renderer/features/engine/common/components/EngineCard.tsx:38` | 고정값 | EngineCard 사유 `missing` 고정 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #8 |
| X14 | `renderer/features/chat/components/ChatTile.tsx:74` | 제거 | ChatTile `!inflight` 보호 삭제 | 잡음 · 1 | `ChatTile.harness.test.ts` | 재량 — EP-03 #4 |
| X15 | `renderer/features/chat/components/ChatTile.tsx:74` | 제거 | ChatTile pending 요청 보호 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #4 |
| X16 | `renderer/features/chat/store/chatStore.ts:197` | 제거 | 재시드 대상에서 저장 세션 제외 조건 삭제 | 잡음 · 1 | `chatStore.availability.test.ts` | 재량 — EP-03 #2 |
| X17 | `renderer/features/chat/store/chatStore.ts:1896` | 제거 | 자동 폴백 시 lastBackend 미기록 조건 삭제 | 잡음 · 1 | `chatStore.availability.test.ts` | 재량 — EP-03 #2(D-007) |
| X19 | `main/app/project-resource-sync.ts:143` | 고정값 | 대기 적용 재시도 무장 `false` | 잡음 · 2 | `bootstrap.native-history.test.ts` | 재량 — EP-09 #1 |
| X20 | `main/app/harnesses/opencode/mcp-reconcile.ts:61` | 고정값 | dirty 재시도 무장 `false` | 잡음 · 1 | `mcp-reconcile.timer.test.ts` | 재량 — EP-09 #2 |
| X21 | `main/adapters/common/registry.ts:33` | 제거 | refresh 합류 삭제 | 잡음 · 1 | `registry.availability.test.ts` | 재량 — EP-02′ #3 |
| X22 | `renderer/features/chat/harnesses/opencode/transcript/Timeline.tsx:52` | 맞바꿈 | rows 연결 head↔tail | 잡음 · 1 | `TranscriptView.harness.test.ts` | 재량 — EP-08 #6~#8 |
| X23 | `renderer/features/chat/harnesses/opencode/transcript/projection.ts:49` | 제거 | tail 투영의 직전 행 seed 삭제 | 잡음 · 2 | `projection.golden.test.ts` | 재량 — EP-08 #1 |
| X24 | `renderer/features/settings/components/UsageTab.tsx:170` | 다른 값 | fallback 높이 120px | 잡음 · 1 | `UsageTab.chart.test.ts` | 재량 — EP-07 #2 |
| X25 | `renderer/shared/ui/markdown/syntax.ts:35` | 제거 | markdown 문법 import 삭제 | 잡음 · 1 | `syntax.test.ts` | 재량 — EP-07 #4 |
| X26 | `main/adapters/claude/sdk.ts:41` | 제거 | warm 경로 직접 반환 삭제 | 잡음 · 54 | `bootstrap.native-history.test.ts` | 재량 — EP-10 #2 |
| X27 | `main/adapters/claude/sdk.ts:14` | 제거 | import 실패 시 `pending` 해제 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-10 #1 |
| X29 | `main/app/harness-host.ts:27` | 제거 | Host 모델 조회 usable 게이트 삭제 | 잡음 · 1 | `harness-host.test.ts` | 재량 — EP-05 #13 |
| X30 | `main/features/harnesses/common/runtime-catalog.ts:165` | 제거 | runtime 행 `unavailable` 삭제 | 잡음 · 1 | `runtime-catalog.test.ts` | 재량 — EP-05 #11 |
| X31 | `main/app/handlers/misc.ts:43` | 제거 | recheck 핸들러 refresh 삭제 | 잡음 · 1 | `misc-split.test.ts` | 재량 — EP-04′ #5 |
| X33 | `main/infra/ipc/send.ts:27` | 맞바꿈 | 방송 채널 → `extensionsChanged` | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — 목록 밖(VP-04 path) |
| X35 | `main/app/bootstrap.ts:914` | 제거 | 리스너의 `composerPreparation.invalidate()` 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-05 #14 |
| X36 | `main/app/bootstrap.ts:915` | 뒤집기 | 리스너 `updateOpenCodeGlobalWatch(ctx, true)` | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-05′ #15 |
| X38 | `main/app/handlers/session.ts:69` | 제거 | `session:load`의 분리 호출 삭제 | 잡음 · 1 | `session.load.test.ts` | 재량 — EP-06 #12 |
| X40 | `main/adapters/opencode/v1/server.ts:194` | 고정값 | `usable = true`(미지원 버전도 사용 가능) | 잡음 · 1 | `server.test.ts` | 재량 — EP-05′ #1-4 |
| X41 | `main/adapters/opencode/v1/server.ts:172` | 고정값 | OpenCode `executableIdentity` 상수 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-04′ #3 |
| X42 | `preload/index.ts:196` | 맞바꿈 | preload 구독 채널 → recheck | 잡음 · 1 | `harness.test.ts` | 재량 — EP-05′ #8(AC5′) |
| X43 | `preload/index.ts:192` | 맞바꿈 | preload invoke 채널 → backendList | 잡음 · 1 | `harness.test.ts` | 재량 — EP-04′ #5 |
| X45 | `main/infra/log/file-transport.ts:65` | 고정값 | 버퍼 쓰기 시 flush 무장 `false` | 잡음 · 1 | `file-transport.test.ts` | 재량 — EP-09 #3 |
| X46 | `main/adapters/opencode/v1/mcp-control.ts:189` | 다른 값 | 제출 대기 상한 500 → 60000ms | 잡음 · 3 | `adapter.startup.test.ts` | 재량 — EP-09 #4 |
| X47 | `main/infra/db/native-history-queries.ts:204` | 고정값 | `raw_json` 항상 `null` | 잡음 · 9 | `native-session.test.ts` | 재량 — EP-06 #3-4 |
| X48 | `main/infra/db/native-history-queries.ts:83` | 제거 | `raw_json IS NULL` 가드 삭제 | 잡음 · 6 | `native-history.db.test.ts` | 재량 — EP-06 #8 |
| X50 | `main/app/bootstrap.ts:907` | 고정값 | 웜업 `installed` 배선 `true` | 동치 | prepare가 warmup.ts:45 allowed()로 같은 registry usable(bootstrap.ts:902)을 다시 보고 그 전에 attempt를 소비하지 않는다 — X51(그 항 제거)은 잡음 | 재량 — EP-05′ #7 |
| X51 | `main/app/bootstrap.ts:902` | 제거 | 웜업 `allowed`의 usable 항 삭제 | 잡음 · 1 | `bootstrap.opencode-warmup.test.ts` | 재량 — EP-05 #14 |
| X52 | `main/adapters/opencode/v1/mcp-control.ts:50` | 제거 | activity 신호의 waiter 깨우기 삭제 | 잡음 · 1 | `mcp-control.test.ts` | 재량 — EP-09 #4 |
| X53 | `main/app/bootstrap.ts:1315` | 제거 | 부팅 `updateOpenCodeGlobalWatch(ctx, true)` 삭제 | 잡음 · 2 | `bootstrap.native-history.test.ts` | 재량 — EP-05′ #15 |
| X54 | `main/app/bootstrap.ts:721` | 제거 | settings 반응의 `recheckOpenCode` 본문 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-04′ #5 |
| X55 | `main/app/bootstrap.ts:722` | 다른 값 | settings 반응 재확인 대상 `claude` | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-04′ #5 |
| X56 | `renderer/features/chat/components/HarnessUnavailableNotice.tsx:29` | 제거 | Notice 재확인 호출 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #4 |
| X57 | `main/app/bootstrap.ts:683` | 제거 | runtime catalog `availability` 주입 삭제 | 동치 | agent:list가 merged 행 전부를 registry 상태로 다시 게이트한다(misc.ts:59-61) · resolve-turn defaultProvider는 supported를 읽지 않는다 | 재량 — EP-05 #11 |
| X59 | `main/app/bootstrap.ts:720` | 제거 | 초기 `openCodeExecutablePath` 주입 삭제 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-04′ #5 |
| X60 | `renderer/features/backend/store/backendStore.ts:33` | 제거 | initBackend seed 삭제 | 잡음 · 1 | `steps.availability.test.ts` | 재량 — EP-03 #1 |
| X61 | `renderer/features/chat/store/chatStore.ts:188` | 고정값 | 재시드 조기 return `true` | 잡음 · 1 | `chatStore.availability.test.ts` | 재량 — EP-03 #2 |
| X62 | `renderer/features/engine/common/components/AgentEnvironmentView.tsx:105` | 고정값 | 추가 메뉴 사유 툴팁 `missing` 고정 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #9 |
| X63 | `renderer/features/chat/components/HarnessUnavailableNotice.tsx:21` | 고정값 | Notice 사유 문구 `missing` 고정 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-03 #4 |
| X64 | `main/app/handlers/misc.ts:61` | 고정값 | agent:list `unavailable` `missing` 고정 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — EP-05 #9 |
| X65 | `main/features/harnesses/common/runtime-catalog.ts:165` | 고정값 | runtime 행 `unavailable` `missing` 고정 | 동치 | agent:list가 unavailable을 registry 사유로 덮어쓴다(misc.ts:61) | 재량 — EP-05 #11 |
| X66 | `main/adapters/common/registry.ts:46` | 고정값 | registry 사유 `missing` 고정 | 잡음 · 3 | `registry.availability.test.ts` | 재량 — EP-05′ #1-4 |
| X67 | `main/adapters/opencode/v1/server.ts:203` | 다른 값 | 버전 확인 실패 사유 `failed` → `missing` | 잡음 · 1 | `server.test.ts` | 재량 — EP-05′ #1-4 |
| X68 | `renderer/shared/stores/harnessAvailabilityStore.ts:20` | 제거 | renderer store push 적용 무시 | **못 잡음** | 전체 스위트(조합 A·B) 새 실패 0 | 재량 — 목록 밖(VP-04 path) |
| X70 | `main/app/handlers/misc.ts:109` | 제거 | 설치 스트림 뒤 refresh 삭제 | 잡음 · 1 | `misc-split.test.ts` | 재량 — EP-02′ #4 |
| B07a | `electron.vite.config.ts:36` | 제거 | renderer `minify` 삭제 | 잡음 | gate:bundle — minified false · recharts 0 · shiki 0 · 자산 21 · SDK require 0 | VP-07 등록 #1 |
| B07b | `renderer/features/settings/components/UsageTab.tsx:19` | 호출 대체 | `TokensPerDayChart` 정적 import 복원 | 잡음 | gate:bundle — minified true · recharts 363005 · shiki 0 · 자산 20 · SDK require 0 | VP-07 등록 #2 |
| B07c | `renderer/shared/ui/markdown/syntax.ts:1` | 호출 대체 | `from 'shiki'` 정적 값 import 복원 | 잡음 | gate:bundle — minified true · recharts 0 · shiki 174154 · 자산 279 · SDK require 0 | VP-07 등록 #4 |
| B10 | `main/adapters/claude/adapter.ts:1` | 호출 대체 | SDK `query` 정적 값 import 복원 | 잡음 | gate:bundle — minified true · recharts 0 · shiki 0 · 자산 21 · SDK require 1 | VP-10 등록 #2 |

- 검산: 95 = 잡음 70(vitest 66 + 번들 4) · 동치 4(X07·X50·X57·X65) · 못 잡음 21. `못 잡음` 21건은 §13 D1~D10으로 이관한다.
- 소거 변이 잔여물: vitest는 타입·lint를 보지 않으므로 잔여물 red가 판정에 섞이지 않았다.

## 5. V-pair closeout — `UT → IT → ST → AT`

❌ REQUIRED 11 중 PASS 5 · PAIR_FAIL 6 · BLOCKED 0. PLAN_GAP 2.

| Pair | left ↔ right / 레벨 | 결과 | 직접 oracle 좌표 · 적대 증거 | §10 전수 |
|---|---|---|---|---|
| VP-11 | MD-04 ↔ UT-04 / UT | PASS | CANON·DEDUPE · R11a·R11b 잡음 | 2/2 |
| VP-10 | MD-03 ↔ UT-03 / UT | **PAIR_FAIL** | SDK·TOOLS·MAP·PREFETCH·gate:bundle · B10·N05·X26 잡음 / **X27 못 잡음**(#1 재시도) | 4/5 |
| VP-09 | MD-02 ↔ UT-02 / UT | PASS | TIMER·MCP·LOG·ADMIT·SIGNALS · R09 6종·X19·X20·X45·X46·X52 잡음 | 6/6 |
| VP-08 | MD-01 ↔ UT-01 / UT | **PAIR_FAIL** | GOLD·MEMO·COPY·INDEX · R08a·R08b·X22·X23 잡음 / **X01 못 잡음**(#2 `copyable`) | 7/8 |
| VP-07 | AR-02 ↔ IT-02 / IT | PASS | gate:bundle·CHART·SYNTAX · B07a·b·c·X24·X25 잡음 | 4/4 |
| VP-06 | AR-03 ↔ IT-03 / IT | PASS | RAW·WRITE·LOAD·APPEND·OCARCHIVE·RECOVER · R06a·b·N06·X06·X08·X38·X47·X48 잡음 · X07 동치 | 16/16 |
| VP-05 | AR-01 ↔ IT-01 / IT | **PAIR_FAIL** | CLAUDE·HOST·WARM·ROWS·CACHE·PREP·RESUME·WATCH · R05 6종·N08·X29·X30·X40·X42·X51·X53·X66·X67 잡음 · X50·X57·X65 동치 / **X64**(#9)·**X35**(#14)·**X36**(#15) 못 잡음 | 12/15 |
| VP-04 | SD-01 ↔ ST-01 / ST | **PAIR_FAIL** + PLAN_GAP | JOIN·FOCUS·PATH·BOOT·INSTALL · R04a·b·N01·X10·X21·X31·X43 잡음 / **X04·X41**(#3)·**X54·X55·X59**(#5) 못 잡음 · path 미등재 X33·X68·X05(D10) | 3/5 |
| VP-03 | R-03 ↔ AT-03 / AT | **PAIR_FAIL** + PLAN_GAP | SEED·DRAFT·NOTICE·MENU·SELECT·COMPOSER·CARD·ADD·AGENT · R03a·b·c·N04·N07·X14·X16·X17·X60·X61 잡음 / **X02**(#2·#3)·**X12·X56·X15·X63**(#4)·**X13**(#8)·**X62**(#9) 못 잡음 · D11 | 5/10 |
| VP-02 | R-02 ↔ AT-02 / AT | **PAIR_FAIL** | BOOT·JOIN·INSTALL · R02a·R02b·X21·X70 잡음 / **X03 못 잡음**(#1 시작 위치) | 3/4 |
| VP-01 | R-01 ↔ AT-01 / AT | PASS | gate:vitest 차집합·typecheck·eslint·scripts·migration·docs·CI(§9) | 0 — 집계 |

- root `PAIR_FAIL` 6은 서로 다른 미잠금 자리라 종속(`BLOCKED_BY`)이 없다.
- 좌표의 실행 구간: DRAFT는 `applyHarnessAvailability()`를 직접 불러 store → 재시드 구독(`ChatProvider.tsx:12`)이 구간 밖 · NOTICE는 정적 렌더라 "다시 확인" 클릭(`HarnessUnavailableNotice.tsx:26-38`)이 구간 밖 · RESUME은 `updateOpenCodeGlobalWatch`를 mock해 인자 `initial=false`가 구간 밖 · PATH는 `registerSettingsReactions` 단위라 bootstrap 배선(`bootstrap.ts:717-724`)이 구간 밖.
- 운반 값이 기본값뿐인 좌표: CARD·ADD·NOTICE·ROWS의 사유가 전부 `missing` = registry 기본 사유(`registry.ts:63-70`)·renderer store 초기값(`harnessAvailabilityStore.ts:7`) — X13·X62·X63·X64.

### AT / AC 세부와 합계

표기: ✅ 동작 충족 + 잠금 · ⚠️ 동작은 코드로 확인했으나 §13 못 잡음·PLAN_GAP이 남음 · ❌ 동작 미충족.

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ✅ | §9 gate 전부 · Windows CI run 41528070017 |
| AC2′ | ⚠️ | BOOT · R02a·R02b 잡음 / X03 시작 위치 미잠금(D1) |
| AC3′ | ✅ | `server.test.ts` 'coalesces version checks across install…' readVersion 1 · JOIN · HOST(probe 0) · WARM |
| AC4′ | ⚠️ | FOCUS·PATH·JOIN·BOOT / X04·X41·X54·X55·X59(D5·D6) · D10 |
| AC5′ | ⚠️ | INSTALL·`preload/harness.test.ts` / 방송 채널 X33(D10) |
| AC6′ | ⚠️ | ROWS·CACHE·AGENT / 사유 X64(D7) |
| AC7 | ⚠️ | SEED·DRAFT·NOTICE·MENU·SELECT·COMPOSER / X02·X12·X15·X56·X63(D2·D3) · X68·X05(D10) · D11 |
| AC8 | ⚠️ | ADD·CARD / X13·X62(D4) |
| AC9 | ⚠️ | HOST·WARM·PREP·WATCH·RESUME / X35·X36(D7) |
| AC10 | ✅ | 진입 1,283,482B · `entryMinified:true` · B07a red |
| AC11 | ✅ | recharts 0B · CHART · B07b red(363,005B) · X24 잡음 |
| AC12 | ✅ | shiki 0B · 자산 21 · SYNTAX(11×2) · B07c red · `package*.json` diff 0 |
| AC13 | ⚠️ | GOLD·MEMO·COPY / X01(D8) |
| AC14 | ✅ | INDEX·`Timeline.selection.test.ts` · X22 잡음 |
| AC15 | ✅ | RAW·WRITE · R06a·X47 잡음 |
| AC16 | ✅ | RAW(changes 1→0)·LOAD · R06b·X38·X48 잡음 |
| AC17 | ✅ | APPEND·OCARCHIVE·RECOVER · N06·X08 잡음 |
| AC18 | ✅ | TIMER · R09-1·X19 잡음 |
| AC19 | ✅ | MCP·ADMIT · R09-2·X20·X46·X52 잡음 |
| AC20 | ✅ | LOG · R09-3·X45 잡음 |
| AC21 | ⚠️ | SDK·PREFETCH·require 0 · B10·N05·X26 잡음 / X27(D9) |
| AC22 | ✅ | CANON·DEDUPE · R11a·R11b 잡음 |
| AC23 | ✅ | `check-doc-inventory --check` ok · IPC 2채널·`unavailableReason`·`raw_json`·Notice·스택 복원 문서 확인 |

- **합계 재측정**: `✅ 14 · ⚠️ 9 · ❌ 0 = 23`. 자기보고 `✅ 22 · ⚠️ 1`과 갈린다 — AC1은 Windows CI 확인으로 ✅, AC2′·4′·5′·6′·7·8·9·13·21 9건은 못 잡음·PLAN_GAP으로 ⚠️.
- **합계 사본 대조**: 구현 본문 22/23 = trailer `Criteria-Met: 22/23` = INDEX 비고 22/23 — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | §10 자리 목록 | 재측정 · 좌표 | 목록 밖 발견 · 고장 ID | 결과 |
|---|---|---|---|---|
| VP-02 | EP-02′ (4) | S02b 1 · S02a 6(목표 3과 다름 — 추가 3은 EP-04′ #3·#5 자리, N4) | #1 X03 | PAIR_FAIL |
| VP-03 | EP-03 (10) | S03 9 + agentStore 구독 1 = 10, 차집합 ∅ | #2·#3 X02 · #4 X12·X56·X15·X63 · #8 X13 · #9 X62 | PAIR_FAIL |
| VP-04 | EP-04′ (5) | 규칙 5 = 테스트 5 | #3 X04·X41 · #5 X54·X55·X59 · path 미등재 X33·X68·X05 | PAIR_FAIL + PLAN_GAP |
| VP-05 | EP-05′ (9) + V1 #9~#14 (6) | S05a 6·S05d 0·소비 13자리 차집합 ∅ | #9 X64 · #14 X35 · #15 X36 | PAIR_FAIL |
| VP-06 | EP-06 (16) | S06a 5·S06b 11·S06c `0034` | — | PASS |
| VP-07 | EP-07 (4) | S07a 1·S07b 1·S07c 0 · gate:bundle | — | PASS |
| VP-08 | EP-08 (8) | S08 4(`findIndex` 0·`turnCopyText(` 1 = 복사 시점) | #2 X01 | PAIR_FAIL |
| VP-09 | EP-09 (6) | S09a 1(scheduler)·S09b 0 | — | PASS |
| VP-10 | EP-10 (5) | S10a 0·S10b 4(실제 `import()` 1, 나머지 `typeof import`) · require 0 | #1 X27 | PAIR_FAIL |
| VP-11 | EP-11 (2) | S11 0 | — | PASS |

- 닫힌 자리: 75 중 **62** — 못 잡음이 남은 13자리(EP-02′ #1 · EP-03 #2·#3·#4·#8·#9 · EP-04′ #3·#5 · EP-05 #9·#14 · EP-05′ #15 · EP-08 #2 · EP-10 #1)를 뺀 값.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| typecheck | PASS | 3구성 `error TS` 0 |
| eslint(무수정) | PASS | 0 error · 2 warning(`Timeline.tsx:57`·`useTranscriptVirtualizer.ts:22`) = 기준선 2(`Timeline.tsx:49`·`useTranscriptVirtualizer.ts:22`)와 같은 규칙 |
| vitest 차집합 | PASS | §9 |
| scripts · migration · docs · budget | PASS | 144/144 · sync ok(append-only는 CI) · generated/prose/links ok · 16 suites ok |
| bundle | PASS | 1,283,482B · 압축 · recharts 0 · shiki 0 · 자산 21 · SDK require 0 |
| CI | PASS | run 41528070017 `c9d212b` success |
| message-bus | PASS | `c9d212b` trailer 6키 파싱 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `HostHarnessPort.installed` | `{installed, version?}` 유지(`harness-host.ts:12-21`) · typecheck | unsupported도 `installed:true`(HOST) · 모델 조회만 차단(X29 잡음) | PASS |
| `orca:backend:list` | 기존 키 ⊆ 새 키(INSTALL) | Claude `usable:true`·OpenCode 사유(registry 테스트 3사유) | PASS |
| `orca:harness:availability`·`recheck` | preload 채널(X42·X43 잡음) | main 방송 채널은 미잠금(X33, D10) | ⚠️ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 번들: 기준선 `a2b5ca3` 진입 3,891,470B·recharts 794,450·shiki 340,624·자산 277·SDK require 1 → HEAD 1,283,482B·0·0·21·0.
- main `setInterval`: 기준선 4(S09a) → HEAD 1(scheduler).
- vitest: 기준선 896파일·8334케이스(pass 8302·fail 23) → HEAD 908파일·8398케이스(pass 8366·fail 23·skip 9). 실패 ID 양방향 차집합 ∅. 구현자 기록(`r1-final-electron-failed-ids.txt`·`r1-baseline-electron-failed-ids.txt`)과 ID 동일.
- 자리 수 합: 4+10+5+15+16+4+8+6+5+2 = 75 = 구현자 표 75행.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| 부팅 체감 | 동시 시작·합류(BOOT) | Windows 설치본 부팅 화면 종료 시점(plan §19 ①) |
| 미설치 화면 | 시드·Notice·메뉴·추가 비활성 로직 | OpenCode 미설치 PC 랜딩·모델 메뉴·엔진 추가·기존 세션 1회, Notice white/dark(§19 ②) |
| 설치 뒤 복귀 | registry focus·방송 함수 | 실제 설치 뒤 창 포커스로 노출 복귀(§19 ③) — renderer store 반영은 D10 잠금 뒤 기계 검증 가능 |

## 9. 게이트 재실행

- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall이 Electron ABI 재빌드 성공) 뒤 `node node_modules/electron/install.js`로 Electron 바이너리를 받아 DB 스위트까지 Electron Node 모드로 실행했다.
- vitest: `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs run --reporter=json` — HEAD 908파일·8398케이스·pass 8366·fail 23. 기준선은 `a2b5ca3` worktree(같은 `node_modules` 연결)에서 같은 명령.
- 기준선 실패 23(10파일)은 Windows 경로 `C:/…` fixture·Linux 플러그인 제어·`libffmpeg.so` git shim — 양쪽 동일 ID라 변경 무관.
- Windows CI(`c9d212b`, run 41528070017): Test Files 905 passed·3 skipped(908) · Tests 8395 passed·3 skipped(8398) · lint 0 error·2 warning · typecheck · migration "append-only ok since v0.3.1" · doc inventory · test budget 16.
- 게이트가 작업 트리를 바꿨는가: 없음 — eslint는 `--fix` 없이 실행, `check-doc-inventory --check`·빌드 출력은 scratchpad. 실행 뒤 `git status` 깨끗.
- 잔여물: 기준선 worktree와 번들 출력은 scratchpad에만 있다. 저장소에 남긴 것은 `verify-evidence/r1/` 두 파일뿐이다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/vitest/CI/번들 | 에이전트 실행 — PASS |
| AC ↔ production path | 에이전트 대조 — ⚠️ 9 |
| D-007 명시 선택 범위(D11) | **사람 결정** — 설계자가 질의 |
| 시각·실제 설치본 | 사람 실기 — §8 |

## 11. Repository operation checks

- AGENTS.md 변경 없음.
- INDEX: 0292 행 `impl/IMPL_DONE` → 이번 커밋에서 `verify/RETURN_TO_PLAN`·다음 주체 Claude(설계)·라운드 2·좌표 기입(`3c50653` ΔV1 · `c9d212b` r1 브랜치 좌표). 비고 5줄 이내. 다른 행은 손대지 않았다.
- 인용 해시: `64047af`·`3c50653`·`a2b5ca3` = commit·`main` 조상 · `c9d212b` = commit·`main` 미병합 · plan 메타 `0eb7dc2`는 얕은 clone에 없지만 GitHub에 실재(0290 r1 verify 커밋 — 설계 측정 HEAD).
- `[구현자 기입]` 7필드 전부 존재(설계 리뷰·강제 지점 전수 75행+남긴 곳 열·잠금 37행·Product/UX·잠재 문제·구현 보고·Review Signals). `놓친 잠재 문제` 번호가 6 → 8 → 7 순서다(형식만).
- trailer: `Agent: codex`·`Status: partial`·`Criteria-Met: 22/23`·`Verified-By: pending` — 허용값, 6키 파싱.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| SQL `->`로 JSON 원형 보존 | 타당 — X06(`json_extract`) 잡음 2 | 없음 |
| warm Query 직접 반환·cold만 proxy | 타당 — X26 잡음 54 | 없음 |
| settings patch 키는 top-level `harnesses` | 타당 — X10 잡음 | 배선은 D6 |
| head memo가 inflight를 읽지 않음 | 타당 — R08a 잡음 | 없음 |
| SYNTAX `tokenizeTimeLimit:0` | 타당 — 제품 기본 제한 불변, X25 잡음 | 없음 |
| 놓친 잠재 #6 구버전 DB 설명 | 확인 — `migrate.ts:167-168`이 거절 | N1 |
| Claude CLI 판정 차단 선조치 | 동작 타당 · 방식은 하네스 이름 분기 | N2 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | 확인 시작 위치(첫 await 전) 미잠금 — X03 | VP-02 · EP-02′ #1 · AC2′ | BLOCKING (PAIR_FAIL) | 구현 |
| D2 | store 변화 → 빈 칸 재시드 구독 미잠금 — X02 | VP-03 · EP-03 #2·#3 · AC7 | BLOCKING (PAIR_FAIL) | 구현 |
| D3 | Notice "다시 확인" 클릭 → `recheck(backend)`, pending 요청 보호, 사유 문구 미잠금 — X12·X56·X15·X63 | VP-03 · EP-03 #4 · AC7 | BLOCKING (PAIR_FAIL) | 구현 |
| D4 | EngineCard 배지·추가 메뉴 툴팁의 사유가 기본값 `missing`으로만 검증 — X13·X62 | VP-03 · EP-03 #8·#9 · AC8 | BLOCKING (PAIR_FAIL) | 구현 |
| D5 | `failed` 포커스 재확인과 OpenCode identity 생산자 미잠금 — X04·X41 | VP-04 · EP-04′ #3 · AC4′ | BLOCKING (PAIR_FAIL) | 구현 |
| D6 | bootstrap의 경로 변경 재확인 배선(호출·harness id·초기 경로) 미잠금 — X54·X55·X59 | VP-04 · EP-04′ #5 · AC4′ | BLOCKING (PAIR_FAIL) | 구현 |
| D7 | `agent:list` 사유 항, 리스너의 준비 무효화·늦은 활성화 인자 미잠금 — X64·X35·X36 | VP-05 · EP-05 #9·#14 · EP-05′ #15 · AC6′·AC9 | BLOCKING (PAIR_FAIL) | 구현 |
| D8 | meta `copyable` 미잠금(GOLD가 버리고 비교) + `turnCopyText` 판정 재구현 drift — X01 | VP-08 · EP-08 #2 · AC13 | BLOCKING (PAIR_FAIL) | 구현 |
| D9 | SDK import 실패 뒤 재시도(`pending` 해제) 미잠금 — X27 | VP-10 · EP-10 #1 · AC21 | BLOCKING (PAIR_FAIL) | 구현 |
| D10 | VP-04 목록이 path의 방송 채널·preload 뒤 renderer store 적용·초기 목록 fence를 담지 않고 검색 범위가 `registry.ts` 한정 — X33·X68·X05 못 잡음 | VP-04(·VP-03 입력) · AC4′·AC5′·AC7 | **PLAN_GAP** | 설계 → 구현 |
| D11 | D-007 범위 미정 — 폴백 중 모델 메뉴의 명시 Claude 선택이 `lastBackend`를 기록하는가. production은 기록하지 않고 테스트의 기록 경로(`explicitHarness:true`)는 production 호출자 0 | VP-03 · D-007·D-003 · AC7 | **PLAN_GAP** | 설계(사용자 질의) |
| N1 | plan §17 "구버전 앱이 같은 DB를 열어도 읽기가 깨지지 않는다"가 기존 `DbSchemaTooNewError` 거절(`migrate.ts:167-168`)과 다르다 | 비귀속 | NON_BLOCKING | 설계 정정 |
| N2 | `adapters/common/registry.ts:40`이 `backend === 'claude'`로 분기 — plan §16·`src/main/AGENTS.md`의 공통 계층 원칙과 다르다(lint 미검출, 동작은 CLAUDE·N08로 잠김) | 비귀속 | NON_BLOCKING | 구현 시 adapter `usable` 또는 `?? true`로 정리 권장 |
| N3 | 죽은 export `useHarnessAvailable` · production 호출 0인 `projectTimeline`·`agentStore.dispose` | 비귀속 | NON_BLOCKING | 정리 후보 |
| N4 | ΔV1 §10 VP-02 목표 "S02a 3 / 3"이 EP-04′ #3·#5 신규 호출자와 맞지 않는다(HEAD 6) | plan 수치 | NON_BLOCKING | D10 정정 때 함께 |
| N5 | runtime 행 가용성 게이트가 `agent:list` 게이트와 이중이다 — X57·X65 동치 | 비귀속 | NON_BLOCKING | 기록 |

> plan `[검증자 기입] 파생 이슈`로 이관했다. PLAN_GAP이 있어 다음 주체는 설계자이고, BLOCKING D1~D9과 D10의 고장(X33·X68·X05)은 정정된 plan으로 다음 구현이 잠근다.

## 14. Review Signals — 사실만

- 최초 라운드. 반복 증상 없음.
- plan oracle 예시가 사유 기본값(`missing`)만 지정했다(EP-03 #8) — 구현 테스트 4곳이 같은 기본값만 썼다.
- plan EP-03 #4 oracle은 "다시 확인 클릭 시 `harness:recheck` 1회"를 적었지만 구현 좌표(NOTICE)는 클릭하지 않는다.
- 좌표가 production 조립 배선을 실행 구간 밖에 두는 형태가 세 pair에서 반복됐다 — PATH(단위 등록)·RESUME(감시 갱신 mock)·DRAFT(재시드 함수 직접 호출).
- 환경: 얕은 clone이라 로컬 migration append-only는 태그 부재로 건너뛰었고 CI가 판정했다. Electron 바이너리는 수동 설치 뒤 DB 스위트까지 실행했다.

## 15. 결론

- 상태: **RETURN_TO_PLAN** — verify 1회째(review 트리거 아님).
- pair: PASS 5(VP-01·06·07·09·11) · PAIR_FAIL 6(VP-02·03·04·05·08·10) · BLOCKED 0.
- PLAN_GAP: D10(VP-04 목록·검색 범위) · D11(D-007 명시 선택 범위).
- AC: ✅ 14 · ⚠️ 9 · ❌ 0 = 23. 동작 결함은 없고, 남은 것은 미잠금 자리와 계약 공백이다.
- 운영 gate: 전부 PASS(Windows CI 포함).
- 다음: 설계자가 ΔV2로 D10 목록·D11 결정을 고정 → 구현자가 D1~D9·D10 고장 21건을 잠근다 → 다음 verify는 이 이력의 못 잡음 21·동치 4를 전부 다시 실행한다.
