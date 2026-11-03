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

---

# r2 재검증 (2026-11-03)

> r1 본문(위)은 그대로 둔다. 재현 자료는 [`verify-evidence/r2/`](verify-evidence/r2/) — 고장 정의·결과([`mutations.json`](verify-evidence/r2/mutations.json)), 기준선 차감 러너([`mutate.mjs`](verify-evidence/r2/mutate.mjs)), HEAD 실패 ID([`head-failed-ids.txt`](verify-evidence/r2/head-failed-ids.txt)), 재현 테스트 2개([`repro/`](verify-evidence/r2/repro/)).

## r2 메타

| 항목 | 값 |
|---|---|
| 판정 | **RETURN_TO_PLAN (ΔV3 r2)** — PLAN_GAP 1(D14) · PAIR_FAIL 2(VP-03·VP-08) · 고장 못 잡음 2 |
| 검증자 | Claude Code |
| 일자 | 2026-11-03 |
| 대상 커밋/range | `c958f83..24d91a6` — r2 구현 `981056f`(코드·테스트·증거) · `24d91a6`(문서만, app 트리 = `981056f`). PR #525 브랜치 좌표, `origin/main` 미병합 |
| 구현 전 plan 기준 | `c958f83`(ΔV3 설계 — app 트리 = r1 `c9d212b`, `git diff --stat c9d212b c958f83 -- app` 0줄) |
| V mode / 유효 V | `Delta V` / `V1@64047af + ΔV1@3c50653 + ΔV2@cc75cf8 + ΔV3@c958f83` |
| 라운드 | 2 (이 handoff의 verify 2회째) |
| 상태 | RETURN_TO_PLAN |
| 자기 검증 여부 | 아니오 — 설계 Claude(다른 세션) · 구현 Codex · 검증 Claude. 보고에 없는 축 34건(V01~V34)과 재현 2건(경합 형제 순서·부팅 `backend` 단계 실패)을 r2-4에 넣었다 |

## r2-0. 기준선 / plan 변경 확인

- **판정: 기준선 성립, 규범 변경 0.** 설계 커밋 `cc75cf8`(ΔV2)·`c958f83`(ΔV3)와 구현 커밋 `981056f`·`24d91a6`이 분리돼 있다.
- 구현 커밋의 plan diff는 hunk 2개뿐이다 — 메타 `상태` 1행(`@@ -8`)과 `[구현자 기입] … (r2)` 절 신설(`@@ -1316`). 삭제 행은 메타 1행 + `24d91a6`이 고친 자기 r2 행 9개뿐이다.
- Decision·Part I·AC·V node/pair·§10 변경 0. 채점 기준은 `c958f83`의 V1+ΔV1+ΔV2+ΔV3 규범 행 원문이다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | ΔV2·ΔV3가 대체 행·대체 Decision(D-019·D-020 ← D-007·D-016·D-017)과 사용자 출처([D11-3])를 명시 |
| NEW/CHANGED ↔ 같은 레벨 REQUIRED pair | 유효 | CHANGED VP-03·04·05 · oracle 정정 VP-02·08·10 · INHERITED VP-01·06·07·09·11 — 전부 REQUIRED |
| `SUPERSEDED` 이관 | 유효 | U1→U9 · U2→U7 · X17 폐기 근거(ΔV3) · N08→U3·U4(ΔV2 D-018) · EP-03·EP-04′ 등록 변이 → EP-03″·EP-03‴·EP-04″ |
| §10 자리 목록(기록 검색 재실행 차집합) | 유효 | `c958f83`에서 S04′ 45·S03′ 32·S05e 1·S03″ 39 = plan N. HEAD는 S04′ 45(줄 이동만)·S05e 0(목표)·S03″ 37 — 줄 수 차이는 아래 |
| S03″ 39 → 37 | 유효(목록 차집합 0) | #2 `:225` 소멸(허용) · #3 2줄이 1줄로 합침 · #5 기록 2줄이 helper(`:1869-1870`)로 이동. helper 호출 줄 `:222`·`:1905`와 초안 제외 `:1902`는 술어에 안 잡힌다 — 독립 재열거로 목록 밖 운반 자리 0(N6) |
| 선택 적대 증거 | 유효 | 등록 r1 이력 95 + ΔV2 U3·U4 + ΔV3 U5~U9 — 자리·종류 명시 |
| 현재 변경 운영 gate | 유효 | §7-A 운영 gate 9종 |
| 부팅 `backend` 단계 실패 시 마지막 백엔드 기록 | **PLAN_GAP (D14)** | 가용성을 못 읽은 부팅도 store 기본값(`missing`)으로 자동 전환을 `lastBackend`에 쓴다 — D-019 "사용 불가로 인한"·D-003 중 어느 쪽인지 plan에 없다(r2-2) |

- 독립 재열거(S03″ 술어 보완): renderer `lastBackend` 참조 = `steps.ts:68`(#1) · `chatStore.ts:1870`(helper) · 주석 `:945`. `rememberLandingBackend` = `:188`(#3) · `:222`(#2) · `:1905`(#5) · 정의 `:1868`. `landingBackend` 줄 전부 #2·#3·#5·#18·#19 안 — 19항목 목록 밖 0.
- 기록 검색 출력은 구현자 증거(`evidence/r2-sites-dv{2,3}-{entry,final}.txt`)와 4건 모두 동일. V1·ΔV1 검색 19개 HEAD N = `evidence/r1-final-sites.txt` 그대로.
- root PLAN_GAP: D14 → VP-03 · AC7″.

## r2-1. Product & UX / ACTIVE Decision

| Decision / 요구 | production path(HEAD) | 판정 |
|---|---|---|
| D-019 마지막 백엔드 — 자동 전환·모델 선택 모두 기록 | 부팅 `steps.ts:68` → `seedLandingBackend` `chatStore.ts:221-223` · 전환 `ChatProvider.tsx:12` → `applyHarnessAvailability` `:186-188` · 선택 `Composer.tsx:435` → `setModel` `:1899-1905` → helper `:1868-1878` → `settingsApi.set` | 충족 · 부팅에서 가용성을 못 읽은 경우는 계약 공백(D14) |
| D-019 복귀 뒤 유지 | usable이면 조기 return(`:187`) · 다음 부팅 `seedLandingBackend('claude')` | 충족(DRAFT·U8 잡음) |
| D-020 이어가기 제외 | `setModel` 판정의 `!sessionId`(`:1901`)·`!isContinuityDraft`(`:1902`) | 충족(U7·V06 잡음) |
| D-018 registry 이름 비분기 | `registry.ts:39` `info.usable ?? info.installed` · Claude 두 반환 `usable:true`(`claude/adapter.ts:377,379`) | 충족(S05e 0 · U3·U4a·U4b·V13 잡음) |
| D-006 비노출·비활성·백그라운드 미시작 | r1 경로 그대로 + Notice 클릭·대기 보호·사유 운반 | 충족 · 단 엔진 카드 배지 조건(`EngineCard.tsx:34`) 미잠금(D12) |
| D-014·D-015 부팅 동시 확인·재확인 3트리거·방송 | r1 경로 + `send.ts:26-27` · preload · `harnessAvailabilityStore.ts:15-28` | 충족(EP-04″ 16/16) |
| D-003 회귀 0 | vitest 실패 ID 차집합 ∅ · Windows CI green | 충족 · 단 copy 버튼 판정의 메시지 집계(D13)·부팅 실패 경로 설정 변경(D14) |

```text
OpenCode 사용 불가 ─┬ 부팅: backend 단계(initBackend: 구독 → backend:list → seed) → seedLandingBackend(lastBackend)
                   │        └ backend 단계 실패(optional)면 store 기본값 missing 그대로 → claude 기록(D14)
                   └ 실행 중: push → harnessAvailabilityStore → ChatProvider 구독 → applyHarnessAvailability → claude 기록 1
새 대화·프로젝트 랜딩 모델 선택 → setModel(세션 없음 ∧ 이어가기 아님 ∧ reducer 수용) → rememberLandingBackend(선택 하네스)
```

## r2-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | **계약 공백(D14)** | `backend` 단계는 `mandatory:false`(`steps.ts:104`)라 실패해도 부팅이 진행되고 store는 기본값 opencode `missing`(`harnessAvailabilityStore.ts:5-8`)이다. 재현: `c958f83` 쓰기 `[]` → `24d91a6` 쓰기 `[{lastBackend:'claude'}]`([`repro/steps.degraded.test.ts`](verify-evidence/r2/repro/steps.degraded.test.ts)) |
| false success | 없음 | 기록 실패는 `chat.harness-preference.save-failed`로 보고(helper `:1870-1877`, r1과 같은 사건명) |
| partial failure·rollback | 유지 | 메모리 갱신 → 비동기 설정 쓰기 순서는 r1과 같다. 설정 쓰기 실패 시 메모리만 바뀐다(r1 동일) |
| A 대신 B 구현 | 없음 | helper 1벌·호출자 3곳은 ΔV3 구현 지시 그대로. 재시드·부팅 시드의 `isContinuityDraft` 추가 항은 `agentKindLocked:true` 초안(`chatStore.ts:1525`)과 겹치는 방어 항이다(N8) |
| 증상만 제거 | 없음 | `copyable`이 `partsText`와 같은 술어(`isMainTextPart`, `parts.ts:56-60`)에서 파생 — r1 D8의 `parentToolRunId:''` 갈림 해소 |
| 최적화가 잃은 관측 | 해당 없음 | r2는 성능 장치를 바꾸지 않았다(production 6파일: registry·claude adapter·parts·projection·chatStore·가용성 store) |
| 출력·요청 상한 | 유지 | 설정 쓰기는 결정 1건당 1회 — 같은 상태 재방송·재호출 0(DRAFT·DRAFTSEED) |
| 구현자 주장 vs 증거 | 일치 | 좌표 62별칭·67패턴 전부 HEAD 실행 JSON에 실재·통과. r1 이력·plan 등록 행의 결과가 구현자 보고(`evidence/r2-mutations.json`)와 같다(못 잡음 0·동치 4) |

## r2-3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh c958f83..24d91a6   # 6 파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export `isMainTextPart`·`applyHarnessAvailabilitySnapshot` | 정상 | 같은 파일 안에서만 쓰인다(`parts.ts:63,68` · `harnessAvailabilityStore.ts:20,28`) — `export`만 불필요 |
| 테스트 전용 `projectTimeline`·`agentStore.dispose` 등 | 기존 | 8건 전부 `c958f83`에 이미 있음 — r1 N3 잔여(`useHarnessAvailable`은 삭제됨) |
| 형제 정책 비대칭 | 없음 | scan 3절 0 |
| 신규 공유 helper `rememberLandingBackend` | 정상 | 호출자 3곳(`:188`·`:222`·`:1905`) = ΔV3 #2·#3·#5. 공유 축: V05(메모리 갱신 삭제)·V14(쓰기 값 고정) 잡음 |
| producer ↔ consumer | 정상 | renderer `lastBackend` 소비 = 부팅 1곳 · main 소비 = 웜업 `warmup.ts:28`(ΔV3가 의도로 판정) |
| 동일 규칙 중복 | 해소 | `copyable` ↔ `turnCopyText` 술어 1벌(D8 해소) |

## r2-4. 기존 테스트 / semantic 검증

- 구현자 좌표 62별칭·67패턴이 HEAD 전체 실행 JSON에 전부 실재하고 통과한다(파일·케이스명 대조, 누락 0·비통과 0).
- 선택 적대 증거 재측정: r1 이력 92(재실행 의무 못 잡음 21·동치 4 포함, X17·N08은 plan이 폐기) + 코드 재표현 R03a 1 + plan 등록 8(U3·U4a·U4b·U5~U9) + 독립 축 34(V01~V34) = **135**. 일반 hunk 자동 확장 0.
- 자리 미지정 등록 변이: U4 → Claude 두 반환 자리(U4a 성공·U4b 실패)에 각각 · r1 VP-05 "소비자별 게이트 제거" → 6자리(R05-6·7·9·11·12·15) 그대로.
- **이전 라운드 대조**: r1 잡음 67 → 잡음 67(덮개 회귀 0) · r1 못 잡음 21 → 잡음 21 · r1 동치 4 → 동치 4.
- 경쟁 형제 순서(D10/X05 경합): 구현자 순서(목록 대기 중 push 2회) 밖 3순서 — S1 목록 먼저·push 나중 · S2 다른 하네스 push만 · S3 대기 중 push 뒤 목록 이후 push — `c958f83`·`24d91a6` 둘 다 3/3 같은 결과([`repro/harnessAvailability.sibling.test.ts`](verify-evidence/r2/repro/harnessAvailability.sibling.test.ts)).
- 자기검증 분모: 해당 없음(구현자 Codex ≠ 검증자). 독립 축 34건은 재량으로 넣었다 — r2 신규 항(`isContinuityDraft` 2곳·helper·`hasPartsText`)과 §10 목록에서 r1이 심지 않은 자리(EP-03‴ #10~#16·#18·#19, EP-04″ #3·#4·#6·#7·#8·#12·#13·#16).
- 실행 방식: 각 고장을 심고 `mutate.mjs <id>`(항목 `suite` 테스트 파일, Electron Node 모드) → 새 실패 0이면 `--related` → 그래도 0이면 `--full`(조합 E = X07·X50·X57·X65 · 조합 V = V01·V07·V09·V12·V16·V26, 둘 다 913파일·8434케이스 새 실패 0) → 못 잡음 후보 V12·V26은 단독 `--full`로 다시 0. 매 실행 뒤 `git status --porcelain -- app` 깨끗.
- 형제 슬롯 맞바꿈: R03b(하네스) · X33·X42·X43(채널) · V19(재확인 대상) · V14(helper 쓰기 값 `claude` 고정 — plan이 제안한 #5 고정값) — 전부 잡음.
- `N회` 관측 주체: `settingsApi.set({lastBackend})` 호출 수(SEED `toHaveBeenCalledExactlyOnceWith` · DRAFT·DRAFTSEED `preferenceWrites()` 길이) · 버전 확인 = 주입 `readVersion`·probe spy.
- 소거 변이 잔여물: vitest는 타입·lint를 보지 않는다 — 잔여물 red가 판정에 섞이지 않았다.

**고장 이력** — 135건 = 잡음 125 · 동치 8 · 못 잡음 2. 범위 `suite`는 항목의 테스트 파일, `related`는 `vitest related`, `full`은 전체 스위트다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 결과 | 이번 결과 | 잡은 테스트 / 동치 근거 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| R02a | `main/app/bootstrap.ts:476` | 뒤집기 | 합류 대신 시작 직후 `await installation`(순차 대기) | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | VP-02 등록 #1 |
| R02b | `main/app/bootstrap.ts:865` | 제거 | `finish()` 앞 `await installation` 삭제 | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 2 | VP-02 등록 #2 |
| R03b | `renderer/src/features/chat/components/ChatTile.tsx:66` | 맞바꿈 | 가용성 조회 하네스 claude↔opencode | suite | 잡음 | 잡음 | `ChatTile.harness.test.ts` · 1 | VP-03 등록 #4 |
| R03c | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:101` | 뒤집기 | 추가 항목 `disabled` 조건 반전 | suite | 잡음 | 잡음 | `AgentEnvironmentView.crud.test.ts` · 6 | VP-03 등록 #9 |
| R04a | `main/adapters/common/registry.ts:89` | 제거 | focus identity 비교 삭제 | suite | 잡음 | 잡음 | `registry.availability.test.ts` · 2 | VP-04 등록 #3 |
| R04b | `main/adapters/common/registry.ts:50` | 제거 | 변화 비교 삭제(매번 통지) | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 3 | VP-04 등록 #1 |
| R05-6 | `main/app/harness-host.ts:16` | 호출 대체 | Host `installed`가 `adapter.isInstalled()` 직접 호출 | suite | 잡음 | 잡음 | `harness-host.test.ts` · 2 | VP-05 등록 #6 |
| R05-7 | `main/app/harnesses/opencode/warmup.ts:41` | 제거 | 웜업 `installed` 게이트 삭제 | suite | 잡음 | 잡음 | `warmup.test.ts` · 2 | VP-05 등록 #7 |
| R05-9 | `main/app/handlers/misc.ts:51` | 제거 | agent:list usable 필터·행 게이트 삭제 | suite | 잡음 | 잡음 | `misc.runtime-catalog.test.ts` · 3 | VP-05 등록 #9 |
| R05-11 | `main/features/harnesses/common/runtime-catalog.ts:130` | 고정값 | runtime 행 `supported: true` | suite | 잡음 | 잡음 | `runtime-catalog.test.ts` · 1 | VP-05 등록 #11 |
| R05-12 | `main/app/composer-catalog.ts:16` | 제거 | 컴포저 준비 unavailable 게이트 삭제 | suite | 잡음 | 잡음 | `composer-preparation-service.test.ts` · 1 | VP-05 등록 #12 |
| R05-15 | `main/app/bootstrap.ts:1077` | 제거 | 전역 감시 usable 조건 삭제 | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 1 | VP-05 등록 #15 |
| R06a | `main/features/history/native-sync.ts:125` | 호출 대체 | payload에 raw 재합류(`JSON.stringify(result.snapshot)`) | suite | 잡음 | 잡음 | `native-session.test.ts` · 4 | VP-06 등록 #9 |
| R06b | `main/app/handlers/session.ts:69` | 뒤집기 | load 뒤 분리 | suite | 잡음 | 잡음 | `session.load.test.ts` · 1 | VP-06 등록 #12 |
| R08a | `renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx:39` | 제거 | head `useMemo` 삭제 | suite | 잡음 | 잡음 | `Timeline.memo.test.ts` · 1 | VP-08 등록 #5 |
| R08b | `renderer/src/features/chat/harnesses/opencode/transcript/projection.ts:8` | 호출 대체 | meta 투영 중 `turnCopyText` 즉시 계산 | suite | 잡음 | 잡음 | `Timeline.memo.test.ts` · 2 | VP-08 등록 #2 |
| R09-1 | `main/app/project-resource-sync.ts:55` | 호출 대체 | 500ms 상시 interval 복원 | suite | 잡음 | 잡음 | `project-resource-sync.test.ts` · 2 | VP-09 등록 #1 |
| R09-2 | `main/app/harnesses/opencode/mcp-reconcile.ts:13` | 호출 대체 | 500ms 상시 interval 복원 | suite | 잡음 | 잡음 | `mcp-reconcile.timer.test.ts` · 1 | VP-09 등록 #2 |
| R09-3 | `main/infra/log/file-transport.ts:56` | 호출 대체 | 상시 flush interval 복원 | suite | 잡음 | 잡음 | `file-transport.test.ts` · 1 | VP-09 등록 #3 |
| R09-5a | `main/app/bootstrap.ts:1144` | 제거 | activity → `projectResourceSync.activityChanged` 삭제 | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 1 | VP-09 등록 #5 |
| R09-5b | `main/app/bootstrap.ts:1145` | 제거 | activity → adapter `resourceActivityChanged` 삭제 | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 1 | VP-09 등록 #5 |
| R09-6 | `main/app/bootstrap.ts:1120` | 제거 | lease → `leasesChanged` 삭제 | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 1 | VP-09 등록 #6 |
| R11a | `main/adapters/claude/project-settings.ts:127` | 호출 대체 | `canonicalJson` → `JSON.stringify` | suite | 잡음 | 잡음 | `canonical-consumers.test.ts` · 1 | VP-11 등록 #1 |
| R11b | `main/adapters/claude/background.ts:39` | 호출 대체 | `canonicalJson` → `JSON.stringify` | suite | 잡음 | 잡음 | `canonical-consumers.test.ts` · 1 | VP-11 등록 #2 |
| N01 | `main/app/bootstrap.ts:918` | 제거 | focus 리스너 등록 삭제 | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 구현자 새 oracle |
| N02 | `main/app/bootstrap.ts:912` | 제거 | 가용성 방송 삭제 | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 구현자 새 oracle |
| N03 | `main/app/bootstrap.ts:914` | 제거 | 리스너의 웜업 재개 삭제 | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 구현자 새 oracle |
| N04 | `renderer/src/shared/stores/agentStore.ts:93` | 제거 | agentStore 가용성 구독 삭제 | suite | 잡음 | 잡음 | `agentStore.test.ts` · 1 | 구현자 새 oracle |
| N05 | `main/adapters/claude/sdk.ts:8` | 제거 | loader memo(`??=` → `=`) | suite | 잡음 | 잡음 | `sdk.test.ts` · 1 | 구현자 새 oracle |
| N06 | `main/adapters/claude/native-history.ts:217` | 뒤집기 | raw를 append 판정 전에 즉시 읽기 | suite | 잡음 | 잡음 | `native-history.test.ts` · 1 | 구현자 새 oracle |
| N07 | `renderer/src/app/boot/steps.ts:104` | 뒤집기 | `backend` 단계를 landing 뒤로 | suite | 잡음 | 잡음 | `steps.availability.test.ts` · 1 | 구현자 새 oracle |
| X01 | `renderer/src/features/chat/harnesses/opencode/transcript/projection.ts:131` | 고정값 | `copyable: true \|\|` | suite | 못 잡음 | 잡음 | `Timeline.memo.test.ts` · 3 | 재량 — EP-08 #2 |
| X02 | `renderer/src/features/chat/providers/ChatProvider.tsx:12` | 제거 | store → `applyHarnessAvailability` 구독 삭제 | suite | 못 잡음 | 잡음 | `ChatProvider.availability.test.ts` · 1 | 재량 — EP-03 #2·#3 |
| X03 | `main/app/bootstrap.ts:471` | 뒤집기 | 확인 시작을 첫 await(`:609`) 뒤 `workspace` 앞으로 | suite | 못 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-02′ #1 |
| X04 | `main/adapters/common/registry.ts:82` | 제거 | focus 대상에서 `failed` 제외 | suite | 못 잡음 | 잡음 | `registry.availability.test.ts` · 1 | 재량 — EP-04′ #3 |
| X05 | `renderer/src/shared/stores/harnessAvailabilityStore.ts:28` | 제거 | 초기 목록 seed의 generation fence 삭제 | suite | 못 잡음 | 잡음 | `harnessAvailability.test.ts` · 1 | 재량 — 목록 밖(VP-04 path) |
| X06 | `main/infra/db/native-history-queries.ts:81` | 호출 대체 | `->` → `json_extract` | suite | 잡음 | 잡음 | `native-history.db.test.ts` · 2 | 재량 — EP-06 #8 |
| X07 | `main/features/history/native-sync.ts:35` | 제거 | legacy 내장 raw 분기 삭제 | suite→related→full | 동치 | 동치 | r1 근거 유지 — legacy 행 `raw()` undefined → `claude/native-history.ts:217`이 `?? previous.snapshot.raw`로 같은 값 | 재량 — EP-06 #10 |
| X08 | `main/adapters/claude/native-history.ts:217` | 제거 | lazy `previous.raw()` 무시 | suite | 잡음 | 잡음 | `native-history.test.ts` · 1 | 재량 — EP-06 #14 |
| X10 | `main/app/settings-reactions.ts:40` | 고정값 | 경로 비교 `true` | suite | 잡음 | 잡음 | `settings-reactions.test.ts` · 1 | 재량 — EP-04′ #5 |
| X12 | `renderer/src/features/chat/components/HarnessUnavailableNotice.tsx:29` | 다른 값 | Notice 재확인 대상 `claude` | suite | 못 잡음 | 잡음 | `HarnessUnavailableNotice.test.ts` · 2 | 재량 — EP-03 #4 |
| X13 | `renderer/src/features/engine/common/components/EngineCard.tsx:38` | 고정값 | EngineCard 사유 `missing` 고정 | suite | 못 잡음 | 잡음 | `EngineCard.render.test.ts` · 2 | 재량 — EP-03 #8 |
| X14 | `renderer/src/features/chat/components/ChatTile.tsx:74` | 제거 | ChatTile `!inflight` 보호 삭제 | suite | 잡음 | 잡음 | `ChatTile.harness.test.ts` · 1 | 재량 — EP-03 #4 |
| X15 | `renderer/src/features/chat/components/ChatTile.tsx:74` | 제거 | ChatTile pending 요청 보호 삭제 | suite | 못 잡음 | 잡음 | `ChatTile.harness.test.ts` · 3 | 재량 — EP-03 #4 |
| X16 | `renderer/src/features/chat/store/chatStore.ts:193` | 제거 | 재시드 대상에서 저장 세션 제외 조건 삭제 | suite | 잡음 | 잡음 | `chatStore.availability.test.ts` · 1 | 재량 — EP-03 #2 |
| X19 | `main/app/project-resource-sync.ts:143` | 고정값 | 대기 적용 재시도 무장 `false` | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 2 | 재량 — EP-09 #1 |
| X20 | `main/app/harnesses/opencode/mcp-reconcile.ts:61` | 고정값 | dirty 재시도 무장 `false` | suite | 잡음 | 잡음 | `mcp-reconcile.timer.test.ts` · 1 | 재량 — EP-09 #2 |
| X21 | `main/adapters/common/registry.ts:33` | 제거 | refresh 합류 삭제 | suite | 잡음 | 잡음 | `registry.availability.test.ts` · 1 | 재량 — EP-02′ #3 |
| X22 | `renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx:52` | 맞바꿈 | rows 연결 head↔tail | suite | 잡음 | 잡음 | `TranscriptView.harness.test.ts` · 1 | 재량 — EP-08 #6~#8 |
| X23 | `renderer/src/features/chat/harnesses/opencode/transcript/projection.ts:54` | 제거 | tail 투영의 직전 행 seed 삭제 | suite | 잡음 | 잡음 | `projection.golden.test.ts` · 2 | 재량 — EP-08 #1 |
| X24 | `renderer/src/features/settings/components/UsageTab.tsx:170` | 다른 값 | fallback 높이 120px | suite | 잡음 | 잡음 | `UsageTab.chart.test.ts` · 1 | 재량 — EP-07 #2 |
| X25 | `renderer/src/shared/ui/markdown/syntax.ts:35` | 제거 | markdown 문법 import 삭제 | suite | 잡음 | 잡음 | `syntax.test.ts` · 1 | 재량 — EP-07 #4 |
| X26 | `main/adapters/claude/sdk.ts:41` | 제거 | warm 경로 직접 반환 삭제 | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 3 | 재량 — EP-10 #2 |
| X27 | `main/adapters/claude/sdk.ts:14` | 제거 | import 실패 시 `pending` 해제 삭제 | suite | 못 잡음 | 잡음 | `sdk.test.ts` · 1 | 재량 — EP-10 #1 |
| X29 | `main/app/harness-host.ts:27` | 제거 | Host 모델 조회 usable 게이트 삭제 | suite | 잡음 | 잡음 | `harness-host.test.ts` · 1 | 재량 — EP-05 #13 |
| X30 | `main/features/harnesses/common/runtime-catalog.ts:165` | 제거 | runtime 행 `unavailable` 삭제 | suite | 잡음 | 잡음 | `runtime-catalog.test.ts` · 1 | 재량 — EP-05 #11 |
| X31 | `main/app/handlers/misc.ts:43` | 제거 | recheck 핸들러 refresh 삭제 | suite | 잡음 | 잡음 | `misc-split.test.ts` · 1 | 재량 — EP-04′ #5 |
| X33 | `main/infra/ipc/send.ts:27` | 맞바꿈 | 방송 채널 → `extensionsChanged` | suite | 못 잡음 | 잡음 | `send.availability.test.ts` · 1 | 재량 — 목록 밖(VP-04 path) |
| X35 | `main/app/bootstrap.ts:914` | 제거 | 리스너의 `composerPreparation.invalidate()` 삭제 | suite | 못 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-05 #14 |
| X36 | `main/app/bootstrap.ts:915` | 뒤집기 | 리스너 `updateOpenCodeGlobalWatch(ctx, true)` | suite | 못 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-05′ #15 |
| X38 | `main/app/handlers/session.ts:69` | 제거 | `session:load`의 분리 호출 삭제 | suite | 잡음 | 잡음 | `session.load.test.ts` · 1 | 재량 — EP-06 #12 |
| X40 | `main/adapters/opencode/v1/server.ts:194` | 고정값 | `usable = true`(미지원 버전도 사용 가능) | suite | 잡음 | 잡음 | `server.test.ts` · 1 | 재량 — EP-05′ #1-4 |
| X41 | `main/adapters/opencode/v1/server.ts:172` | 고정값 | OpenCode `executableIdentity` 상수 | suite | 못 잡음 | 잡음 | `server.test.ts` · 1 | 재량 — EP-04′ #3 |
| X42 | `preload/index.ts:196` | 맞바꿈 | preload 구독 채널 → recheck | suite | 잡음 | 잡음 | `harness.test.ts` · 1 | 재량 — EP-05′ #8(AC5′) |
| X43 | `preload/index.ts:192` | 맞바꿈 | preload invoke 채널 → backendList | suite | 잡음 | 잡음 | `harness.test.ts` · 1 | 재량 — EP-04′ #5 |
| X45 | `main/infra/log/file-transport.ts:65` | 고정값 | 버퍼 쓰기 시 flush 무장 `false` | suite | 잡음 | 잡음 | `file-transport.test.ts` · 1 | 재량 — EP-09 #3 |
| X46 | `main/adapters/opencode/v1/mcp-control.ts:189` | 다른 값 | 제출 대기 상한 500 → 60000ms | suite | 잡음 | 잡음 | `adapter.startup.test.ts` · 3 | 재량 — EP-09 #4 |
| X47 | `main/infra/db/native-history-queries.ts:204` | 고정값 | `raw_json` 항상 `null` | suite | 잡음 | 잡음 | `native-session.test.ts` · 9 | 재량 — EP-06 #3-4 |
| X48 | `main/infra/db/native-history-queries.ts:83` | 제거 | `raw_json IS NULL` 가드 삭제 | suite | 잡음 | 잡음 | `native-history.db.test.ts` · 6 | 재량 — EP-06 #8 |
| X50 | `main/app/bootstrap.ts:907` | 고정값 | 웜업 `installed` 배선 `true` | suite→related→full | 동치 | 동치 | r1 근거 유지 — prepare가 `warmup.ts:45` `allowed()`로 `bootstrap.ts:902` usable을 다시 본다 | 재량 — EP-05′ #7 |
| X51 | `main/app/bootstrap.ts:902` | 제거 | 웜업 `allowed`의 usable 항 삭제 | suite | 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-05 #14 |
| X52 | `main/adapters/opencode/v1/mcp-control.ts:50` | 제거 | activity 신호의 waiter 깨우기 삭제 | suite | 잡음 | 잡음 | `mcp-control.test.ts` · 1 | 재량 — EP-09 #4 |
| X53 | `main/app/bootstrap.ts:1315` | 제거 | 부팅 `updateOpenCodeGlobalWatch(ctx, true)` 삭제 | suite | 잡음 | 잡음 | `bootstrap.native-history.test.ts` · 2 | 재량 — EP-05′ #15 |
| X54 | `main/app/bootstrap.ts:721` | 제거 | settings 반응의 `recheckOpenCode` 본문 삭제 | suite | 못 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-04′ #5 |
| X55 | `main/app/bootstrap.ts:722` | 다른 값 | settings 반응 재확인 대상 `claude` | suite | 못 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-04′ #5 |
| X56 | `renderer/src/features/chat/components/HarnessUnavailableNotice.tsx:29` | 제거 | Notice 재확인 호출 삭제 | suite | 못 잡음 | 잡음 | `HarnessUnavailableNotice.test.ts` · 2 | 재량 — EP-03 #4 |
| X57 | `main/app/bootstrap.ts:683` | 제거 | runtime catalog `availability` 주입 삭제 | suite→related→full | 동치 | 동치 | r1 근거 유지 — `misc.ts:59-61`이 merged 행을 registry 상태로 재게이트 | 재량 — EP-05 #11 |
| X59 | `main/app/bootstrap.ts:720` | 제거 | 초기 `openCodeExecutablePath` 주입 삭제 | suite | 못 잡음 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-04′ #5 |
| X60 | `renderer/src/features/backend/store/backendStore.ts:33` | 제거 | initBackend seed 삭제 | suite | 잡음 | 잡음 | `steps.availability.test.ts` · 1 | 재량 — EP-03 #1 |
| X61 | `renderer/src/features/chat/store/chatStore.ts:187` | 고정값 | 재시드 조기 return `true` | suite | 잡음 | 잡음 | `chatStore.availability.test.ts` · 1 | 재량 — EP-03 #2 |
| X62 | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:105` | 고정값 | 추가 메뉴 사유 툴팁 `missing` 고정 | suite | 못 잡음 | 잡음 | `AgentEnvironmentView.interaction.test.ts` · 2 | 재량 — EP-03 #9 |
| X63 | `renderer/src/features/chat/components/HarnessUnavailableNotice.tsx:21` | 고정값 | Notice 사유 문구 `missing` 고정 | suite | 못 잡음 | 잡음 | `HarnessUnavailableNotice.test.ts` · 2 | 재량 — EP-03 #4 |
| X64 | `main/app/handlers/misc.ts:61` | 고정값 | agent:list `unavailable` `missing` 고정 | suite | 못 잡음 | 잡음 | `misc.runtime-catalog.test.ts` · 2 | 재량 — EP-05 #9 |
| X65 | `main/features/harnesses/common/runtime-catalog.ts:165` | 고정값 | runtime 행 `unavailable` `missing` 고정 | suite→related→full | 동치 | 동치 | r1 근거 유지 — `misc.ts:61`이 runtime 행 사유를 registry 사유로 덮는다 | 재량 — EP-05 #11 |
| X66 | `main/adapters/common/registry.ts:45` | 고정값 | registry 사유 `missing` 고정 | suite | 잡음 | 잡음 | `registry.availability.test.ts` · 3 | 재량 — EP-05′ #1-4 |
| X67 | `main/adapters/opencode/v1/server.ts:203` | 다른 값 | 버전 확인 실패 사유 `failed` → `missing` | suite | 잡음 | 잡음 | `server.test.ts` · 1 | 재량 — EP-05′ #1-4 |
| X68 | `renderer/src/shared/stores/harnessAvailabilityStore.ts:20` | 제거 | renderer store push 적용 무시 | suite | 못 잡음 | 잡음 | `harnessAvailability.test.ts` · 1 | 재량 — 목록 밖(VP-04 path) |
| X70 | `main/app/handlers/misc.ts:109` | 제거 | 설치 스트림 뒤 refresh 삭제 | suite | 잡음 | 잡음 | `misc-split.test.ts` · 1 | 재량 — EP-02′ #4 |
| B07a | `app/electron.vite.config.ts:36` | 제거 | renderer `minify` 삭제 | bundle | 잡음 | 잡음 | gate:bundle — minified false · 2,701,477B · recharts 0 · shiki 0 · 자산 21 · SDK require 0 | VP-07 등록 #1 |
| B07b | `renderer/src/features/settings/components/UsageTab.tsx:19` | 호출 대체 | `TokensPerDayChart` 정적 import 복원 | bundle | 잡음 | 잡음 | gate:bundle — minified true · 1,653,247B · recharts 363,005 · shiki 0 · 자산 20 · SDK require 0 | VP-07 등록 #2 |
| B07c | `renderer/src/shared/ui/markdown/syntax.ts:1` | 호출 대체 | `from 'shiki'` 정적 값 import 복원 | bundle | 잡음 | 잡음 | gate:bundle — minified true · 1,467,994B · recharts 0 · shiki 174,154 · 자산 279 · SDK require 0 | VP-07 등록 #4 |
| B10 | `main/adapters/claude/adapter.ts:1` | 호출 대체 | SDK `query` 정적 값 import 복원 | bundle | 잡음 | 잡음 | gate:bundle — minified true · 1,283,424B · recharts 0 · shiki 0 · 자산 21 · SDK require 1 | VP-10 등록 #2 |
| R03a | `renderer/src/features/chat/store/chatStore.ts:221` | 제거 | 시드 폴백 삭제 → `landingBackend = backend ?? claude` | suite | 잡음 | 잡음 | `steps.availability.test.ts` · 4 | VP-03 등록(EP-03‴ #2) |
| U3 | `main/adapters/common/registry.ts:39` | 다른 값 | `backend === 'claude' \|\|` 분기 복원 | suite | 신규 | 잡음 | `registry.availability.test.ts` · 1 | VP-05 등록 U3(EP-05″ #16) |
| U4a | `main/adapters/claude/adapter.ts:377` | 제거 | 성공 반환의 `usable: true` 삭제 | suite | 신규 | 잡음 | `adapter.availability.test.ts` · 1 | VP-05 등록 U4(EP-05″ #17) |
| U4b | `main/adapters/claude/adapter.ts:379` | 제거 | 실패 반환의 `usable: true` 삭제 | suite | 신규 | 잡음 | `adapter.availability.test.ts` · 1 | VP-05 등록 U4(EP-05″ #17) |
| U5 | `renderer/src/features/chat/store/chatStore.ts:222` | 제거 | `seedLandingBackend` 사용 불가 분기의 기록 호출 삭제(메모리만 claude) | suite | 신규 | 잡음 | `steps.availability.test.ts` · 4 | VP-03 등록 U5(EP-03‴ #2) |
| U6 | `renderer/src/features/chat/store/chatStore.ts:188` | 제거 | `applyHarnessAvailability` 전환 분기의 기록 호출 삭제 | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 1 | VP-03 등록 U6(EP-03‴ #3) |
| U7 | `renderer/src/features/chat/store/chatStore.ts:1902` | 제거 | `setModel` 기록 판정의 이어가기 초안 제외 항 삭제 | suite | 신규 | 잡음 | `Composer.selection.test.ts` · 3 | VP-03 등록 U7(EP-03‴ #5) |
| U8 | `renderer/src/features/chat/store/chatStore.ts:187` | 다른 값 | usable이면 `landingBackend = 'opencode'`로 되돌린 뒤 return | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 1 | VP-03 등록 U8(EP-03‴ #3) |
| U9 | `renderer/src/features/chat/components/Composer.tsx:435` | 제거 | 모델 메뉴 `onPick`의 `setModel(…)` 호출 삭제(메뉴 닫기만) | suite | 신규 | 잡음 | `Composer.selection.test.ts` · 2 | VP-03 등록 U9(EP-03‴ #6) |
| V01 | `renderer/src/features/chat/providers/ChatProvider.tsx:11` | 제거 | 마운트 시 `applyHarnessAvailability()` 1회 호출 삭제 | suite→related→full | 신규 | 동치 | `App.tsx:20` 1회 마운트 effect가 비동기 부팅(`steps.ts:86` 첫 await)보다 먼저 — 그때 `landingBackend`=claude·초안은 claude뿐(`chatStore.ts:183`·`:306`) | 재량 — EP-03‴ #4 (`:11`) |
| V02 | `renderer/src/features/chat/components/Composer.tsx:335` | 다른 값 | 메뉴 노출 조건 `agents.some(supported)` → `agents.length > 0` | suite→related | 신규 | 잡음 | `composerMount.render.test.ts` · 1 | 재량 — EP-03‴ #14 (`:335`) |
| V03 | `renderer/src/features/chat/components/Landing.tsx:27` | 제거 | 랜딩의 `<Composer …/>` 삭제 | related | 신규 | 잡음 | `NewChatLandingPage.harness.test.ts` · 19 | 재량 — EP-03‴ #10 (`:27`) |
| V04 | `renderer/src/pages/ProjectLandingPage.tsx:112` | 제거 | 프로젝트 랜딩의 `<Composer …/>` 삭제 | suite | 신규 | 잡음 | `ProjectLandingPage.project-picker.test.ts` · 7 | 재량 — EP-03‴ #11 (`:112`) |
| V05 | `renderer/src/features/chat/store/chatStore.ts:1869` | 제거 | `rememberLandingBackend`의 메모리 갱신(`landingBackend = backend`) 삭제 | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 2 | 재량 — EP-03‴ #2·#3·#5 공유 helper |
| V06 | `renderer/src/features/chat/store/chatStore.ts:1901` | 제거 | `setModel` 기록 판정의 `!selected.sessionId` 항 삭제 | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 1 | 재량 — EP-03‴ #5 (형제 항) |
| V07 | `renderer/src/features/chat/store/chatStore.ts:1903` | 제거 | `setModel` 기록 판정의 `selected !== beforeSession` 항 삭제 | suite→related→full | 신규 | 동치 | 기록 대상(세션 없음·비이어가기)에서 SET_MODEL이 같은 객체를 내는 거부 분기(`chatReducer.ts:1623-1631`)는 UI 호출로 생기지 않는다(`Composer.tsx:432`·`:137-139`) | 재량 — EP-03‴ #5 (형제 항) |
| V08 | `renderer/src/features/chat/store/chatStore.ts:195` | 제거 | 재시드 제외 목록의 `isContinuityDraft(entry)` 삭제(r2 신규 항) | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 1 | 재량 — EP-03‴ #3 |
| V09 | `renderer/src/features/chat/store/chatStore.ts:229` | 제거 | 부팅 시드 대상의 `!isContinuityDraft(entry)` 삭제(r2 신규 항) | suite→related→full | 신규 | 동치 | 부팅 1회 호출(`steps.ts:68`) 시점에 이어가기 초안 없음 + 초안은 `agentKindLocked:true`(`chatStore.ts:1525`) | 재량 — EP-03‴ #2 |
| V10 | `renderer/src/features/chat/store/chatStore.ts:222` | 다른 값 | 시드 폴백 기록 값 `claude` → 받은 `backend` | suite | 신규 | 잡음 | `steps.availability.test.ts` · 4 | 재량 — EP-03‴ #2 |
| V11 | `renderer/src/features/chat/lib/parts.ts:63` | 다른 값 | `hasPartsText`의 공백 판정 `trim()` 삭제 | suite | 신규 | 잡음 | `Timeline.memo.test.ts` · 2 | 재량 — EP-08 #2 (r2 술어) |
| V12 | `renderer/src/features/chat/harnesses/opencode/transcript/projection.ts:131` | 뒤집기 | `copyable` 판정 `some` → `every` | suite→related→full | 신규 | **못 잡음** | 전체 913파일·8434케이스 새 실패 0(단독 실행) | 재량 — EP-08 #2 |
| V13 | `main/adapters/common/registry.ts:39` | 뒤집기 | `info.usable ?? info.installed` → `info.installed ?? info.usable` | suite | 신규 | 잡음 | `registry.availability.test.ts` · 2 | 재량 — EP-05″ #16 |
| V14 | `renderer/src/features/chat/store/chatStore.ts:1870` | 고정값 | helper 설정 쓰기 값을 `claude` 고정(메모리는 선택값) | suite | 신규 | 잡음 | `Composer.selection.test.ts` · 2 | 재량 — EP-03‴ #5 형제 맞바꿈(plan 제안) |
| V15 | `main/infra/ipc/send.ts:63` | 제거 | 공용 `broadcast`의 파괴된 webContents 제외 삭제 | suite | 신규 | 잡음 | `send.availability.test.ts` · 1 | 재량 — 목록 밖(EP-04″ #10 공용 helper) |
| V16 | `main/adapters/common/registry.ts:96` | 제거 | `onAvailabilityChange` 해제 함수가 listener를 지우지 않음 | suite→related→full | 신규 | 동치 | shutdown이 `stopped=true` 뒤 해제하고 리스너가 `bootstrap.ts:911`에서 반환, 이어 `registry.close()`(:981)가 비운다 | 재량 — EP-04″ #7 |
| V17 | `main/app/bootstrap.ts:969` | 제거 | shutdown의 focus 리스너 해제 삭제 | suite | 신규 | 잡음 | `bootstrap.opencode-warmup.test.ts` · 1 | 재량 — EP-04″ #4 (`:969`) |
| V18 | `preload/index.ts:198` | 제거 | preload 가용성 구독 해제의 `removeListener` 삭제 | suite | 신규 | 잡음 | `harness.test.ts` · 1 | 재량 — EP-04″ #12 (`:198`) |
| V19 | `renderer/src/shared/api/ipc.ts:157` | 다른 값 | `harnessApi.recheck`가 요청 하네스 대신 `claude` 전달 | suite | 신규 | 잡음 | `HarnessUnavailableNotice.test.ts` · 2 | 재량 — EP-04″ #13 (`:157`) |
| V20 | `renderer/src/features/chat/components/HarnessUnavailableNotice.tsx:25` | 제거 | "다시 확인" 응답 전 `disabled={busy}` 삭제 | suite | 신규 | 잡음 | `HarnessUnavailableNotice.test.ts` · 2 | 재량 — EP-04″ #16 |
| V21 | `renderer/src/app/boot/steps.ts:68` | 빈 값 | 부팅 시드 인자 `settings.lastBackend` → `null` | suite | 신규 | 잡음 | `steps.availability.test.ts` · 4 | 재량 — EP-03‴ #1 |
| V22 | `renderer/src/features/chat/components/composer/modelSelection.ts:27` | 제거 | 기본 모델 선택의 `!agent.supported` 항 삭제 | suite | 신규 | 잡음 | `Composer.selection.test.ts` · 2 | 재량 — EP-03‴ #13 |
| V23 | `renderer/src/features/chat/components/composer/ModelMenu.tsx:31` | 제거 | 모델 메뉴 행 필터의 `agent.supported` 항 삭제 | suite | 신규 | 잡음 | `Composer.harness.test.ts` · 1 | 재량 — EP-03‴ #12 |
| V24 | `renderer/src/features/chat/store/chatStore.ts:291` | 고정값 | `freshEntry` backend를 `claude` 고정 | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 6 | 재량 — EP-03‴ #19 |
| V25 | `renderer/src/features/chat/store/chatStore.ts:183` | 다른 값 | 마지막 백엔드 초기값 `claude` → `opencode` | suite | 신규 | 잡음 | `chatStore.availability.test.ts` · 1 | 재량 — EP-03‴ #18 |
| V26 | `renderer/src/features/engine/common/components/EngineCard.tsx:34` | 고정값 | 사유 배지 노출 조건 `!agent.supported` → `true` | suite→related→full | 신규 | **못 잡음** | 전체 913파일·8434케이스 새 실패 0(단독 실행) | 재량 — EP-03‴ #15 (`:34`) |
| V27 | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:96` | 제거 | 추가 메뉴 하네스 목록에서 OpenCode 제외 | suite | 신규 | 잡음 | `AgentEnvironmentView.interaction.test.ts` · 4 | 재량 — EP-03‴ #16 (`:96`) |
| V28 | `main/adapters/opencode/v1/server.ts:172` | 다른 값 | OpenCode identity를 경로만(stat 항 제거) | suite | 신규 | 잡음 | `server.test.ts` · 1 | 재량 — EP-04″ #8 |
| V29 | `main/adapters/common/registry.ts:82` | 다른 값 | focus 대상에 `unsupported` 추가 | suite | 신규 | 잡음 | `registry.availability.test.ts` · 1 | 재량 — EP-04″ #6 |
| V30 | `renderer/src/features/chat/components/ChatTile.tsx:71` | 제거 | 안내 보호 조건의 `pendingToolApprovals` 항 삭제 | suite | 신규 | 잡음 | `ChatTile.harness.test.ts` · 1 | 재량 — EP-03‴ #7 (형제 항) |
| V31 | `renderer/src/features/chat/lib/parts.ts:59` | 제거 | `isMainTextPart`의 child 제외 항 삭제(partsText 공유) | suite | 신규 | 잡음 | `Timeline.memo.test.ts` · 2 | 재량 — EP-08 #2 (공유 술어) |
| V32 | `main/app/handlers/misc.ts:44` | 다른 값 | 수동 재확인 응답을 `claude` 상태로 | suite | 신규 | 잡음 | `misc-split.test.ts` · 1 | 재량 — EP-04″ #3 |
| V33 | `renderer/src/features/chat/store/chatStore.ts:187` | 뒤집기 | 재시드 조기 return 조건 반전 | suite | 신규 | 잡음 | `ChatProvider.availability.test.ts` · 2 | 재량 — EP-03‴ #3 |
| V34 | `renderer/src/features/chat/store/chatStore.ts:221` | 뒤집기 | 시드 폴백 조건의 usable 판정 반전 | suite | 신규 | 잡음 | `steps.availability.test.ts` · 8 | 재량 — EP-03‴ #2 |

- 검산: 135 = 잡음 125(r1 이력 88 · R03a 1 · plan 등록 8 · 독립 28) · 동치 8(r1 이력 4 · 독립 4) · 못 잡음 2(독립 V12·V26). 폐기 2(X17·N08)는 plan ΔV3·ΔV2 근거로 재실행하지 않았다(`mutations.json` `retired`).
- `못 잡음` 2건은 r2-13 D12·D13으로 이관한다 — 둘 다 §10 고정 목록 자리라 그 pair의 `PAIR_FAIL`이다.
- 동치 8건의 확인 실행: r1 이력 4건은 조합 E 전체 스위트 새 실패 0(코드 무변경 — r1 근거 유지), 독립 4건은 조합 V 전체 스위트 새 실패 0.

## r2-5. V-pair closeout — `UT → IT → ST → AT`

❌ REQUIRED 11 중 PASS 9 · PAIR_FAIL 2 · BLOCKED 0. PLAN_GAP 1.

| Pair | left ↔ right / 레벨 | 결과 | 직접 oracle 좌표 · 적대 증거 | §10 전수 |
|---|---|---|---|---|
| VP-11 | MD-04 ↔ UT-04 / UT | PASS | CANON·DEDUPE · R11a·R11b 잡음 | 2/2 |
| VP-10 | MD-03 ↔ UT-03 / UT | PASS | SDK·SDKRETRY·TOOLS·MAP·PREFETCH·gate:bundle · X27·N05·X26·B10 잡음 | 5/5 |
| VP-09 | MD-02 ↔ UT-02 / UT | PASS | TIMER·MCP·LOG·ADMIT·SIGNALS · R09 6종·X19·X20·X45·X46·X52 잡음 | 6/6 |
| VP-08 | MD-01 ↔ UT-01 / UT | **PAIR_FAIL** | GOLD·COPYSEM·MEMO·COPY·INDEX · R08a·R08b·X01·X22·X23·V11·V31 잡음 / **V12 못 잡음**(#2 메시지 집계) | 7/8 |
| VP-07 | AR-02 ↔ IT-02 / IT | PASS | gate:bundle·CHART·SYNTAX · B07a·b·c·X24·X25 잡음 | 4/4 |
| VP-06 | AR-03 ↔ IT-03 / IT | PASS | RAW·WRITE·LOAD·APPEND·OCARCHIVE·RECOVER · R06a·b·N06·X06·X08·X38·X47·X48 잡음 · X07 동치 | 16/16 |
| VP-05 | AR-01 ↔ IT-01 / IT | PASS | CLAUDE·PORT·HOST·WARM·ROWS·CACHE·PREP·RESUME·WATCH · R05 6종·U3·U4a·U4b·V13·X29·X30·X35·X36·X40·X51·X53·X64·X66·X67 잡음 · X50·X57·X65 동치 | 17/17 |
| VP-04 | SD-01 ↔ ST-01 / ST | PASS | PATH·BOOTPATH·INSTALL·BOOT·JOIN·FAILEDFOCUS·RESUME·IDENTITY·FANOUT·PRELOAD·STORE·RECHECK · R04a·b·N01·N02·X04·X05·X10·X12·X21·X31·X33·X41~X43·X54~X56·X59·X60·X68·V15·V17~V20·V28·V29·V32 잡음 · V16 동치 | 16/16 |
| VP-03 | R-03 ↔ AT-03 / AT | **PAIR_FAIL** + PLAN_GAP | SEED·DRAFTSEED·DRAFT·PROVIDER·PREFERENCE·MENUPICK·PENDING·NOTICE·RECHECK·MENU·SELECT·COMPOSER·CARD·ADD·AGENT·INITIAL·FRESH + 실제로 닫는 좌표 3(아래) · R03a·b·c·N04·N07·U5~U9·X02·X13~X16·X61~X63·V02~V06·V08·V10·V14·V21~V25·V27·V30·V33·V34 잡음 · V01·V07·V09 동치 / **V26 못 잡음**(#15 `:34`) · D14 | 18/19 |
| VP-02 | R-02 ↔ AT-02 / AT | PASS | BOOT·JOIN·INSTALL · R02a·R02b·X03·X21·X70 잡음 | 4/4 |
| VP-01 | R-01 ↔ AT-01 / AT | PASS | gate:vitest 차집합·typecheck·eslint·scripts·migration·docs·budget·CI(r2-9) | 0 — 집계 |

- root `PAIR_FAIL` 2는 서로 다른 미잠금 자리라 종속(`BLOCKED_BY`)이 없다. D14는 VP-03 path의 부팅 실패 상태라 같은 pair에 함께 둔다.
- 이번 라운드 실행 범위: 재검증이지만 r1 PAIR_FAIL 6 + ΔV3 CHANGED VP-03 + 운영 gate에 더해 r1 PASS 5(VP-01·06·07·09·11)도 좌표 실재를 확인하고 r1 잡음 고장을 재실행했다 — 덮개 회귀 0.
- 좌표의 실행 구간 — plan 좌표가 자리를 실행하지 않아 다른 좌표가 닫은 곳: EP-03‴ #10 `Landing.tsx:27`·#11 `ProjectLandingPage.tsx:112`는 DRAFT(store 단위)의 구간 밖이고 `NewChatLandingPage.harness.test.ts`(V03 잡음 19)·`ProjectLandingPage.project-picker.test.ts`(V04 잡음 7)가 닫는다 · #14 `Composer.tsx:335`는 COMPOSER 입력에 늘 지원 행이 있어 조건을 가르지 못하고 `composerMount.render.test.ts` "마운트가 실제로 칩까지 도달했다"(V02 잡음)가 닫는다.
- 운반 값이 한쪽 분기뿐인 좌표: EP-03‴ #15 CARD·ADD 입력은 전부 `supported:false`(V26) · EP-08 #2 GOLD 3 fixture·COPYSEM·Timeline 버튼 케이스의 assistant 턴은 전부 단일 메시지(V12).
- DRAFT의 fork·handoff fixture는 `agentKindLocked:false`인 비production 형상이다 — V08(재시드 제외 `isContinuityDraft` 삭제) 잡음은 그 fixture에 기댄다(N8).

### AT / AC 세부와 합계

표기: ✅ 동작 충족 + 잠금 · ⚠️ 동작은 확인했으나 못 잡음·PLAN_GAP이 남음 · ❌ 동작 미충족.

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ✅ | r2-9 gate 전부 · Windows CI run 41570894158(`981056f`) success |
| AC2′ | ✅ | BOOT · R02a·R02b·X03 잡음(D1 해소) |
| AC3′ | ✅ | JOIN · `server.test.ts` 'coalesces version checks across install…' · HOST·WARM |
| AC4″ | ✅ | EP-04″ 16/16 · X04·X41·X54·X55·X59·X33·X68·X05·X12·X56 잡음(D5·D6·D10 해소) |
| AC5″ | ✅ | INSTALL·FANOUT·PRELOAD·STORE · X33·X42·X43·V15·V18 잡음 |
| AC6′ | ✅ | ROWS·CACHE·AGENT·PORT·CLAUDE · X64·U3·U4a·U4b 잡음(D7 일부·N2 해소) |
| AC7″ | ⚠️ | SEED·DRAFTSEED·DRAFT·PROVIDER·PREFERENCE·MENUPICK·PENDING·RECHECK·INITIAL·FRESH · U5~U9 잡음 / 부팅 `backend` 단계 실패 경로 계약 공백(D14) |
| AC8 | ⚠️ | CARD·ADD · X13·X62·R03c·V27 잡음 / 지원 카드 배지 부재 미잠금(V26 → D12) |
| AC9 | ✅ | HOST·WARM·PREP·WATCH·RESUME · X35·X36 잡음(D7 해소) |
| AC10 | ✅ | 진입 1,283,424B · `entryMinified:true` · B07a red(2,701,477B·false) |
| AC11 | ✅ | recharts 0B · CHART · B07b red(363,005B) · X24 잡음 |
| AC12 | ✅ | shiki 0B · 자산 21 · SYNTAX · B07c red(174,154B·자산 279) · `package*.json` diff 0 |
| AC13 | ⚠️ | GOLD·COPYSEM·MEMO·COPY · X01·V11·V31 잡음(D8 해소) / 메시지 집계 미잠금(V12 → D13) |
| AC14 | ✅ | INDEX·`Timeline.selection.test.ts` · X22 잡음 |
| AC15 | ✅ | RAW·WRITE · R06a·X47 잡음 |
| AC16 | ✅ | RAW·LOAD · R06b·X38·X48 잡음 |
| AC17 | ✅ | APPEND·OCARCHIVE·RECOVER · N06·X08 잡음 |
| AC18 | ✅ | TIMER · R09-1·X19 잡음 |
| AC19 | ✅ | MCP·ADMIT · R09-2·X20·X46·X52 잡음 |
| AC20 | ✅ | LOG · R09-3·X45 잡음 |
| AC21 | ✅ | SDK·SDKRETRY·PREFETCH·require 0 · X27·N05·X26·B10 잡음(D9 해소) |
| AC22 | ✅ | CANON·DEDUPE · R11a·R11b 잡음 |
| AC23 | ✅ | `check-doc-inventory --check` ok · `docs/arch/backend/adapters.md`(D-018)·`docs/arch/frontend/state.md`(D-019·D-020) 갱신 |

- **합계 재측정**: `✅ 20 · ⚠️ 3 · ❌ 0 = 23`. 자기보고 `✅ 23`과 갈린다 — AC7″·AC8·AC13이 D14·D12·D13으로 ⚠️.
- **합계 사본 대조**: 구현 본문 23/23 = `24d91a6` trailer `Criteria-Met: 23/23` = INDEX 비고 23/23 — 일치(`981056f` trailer `22/23`+`Criteria-Pending: AC1 Windows CI`는 CI 전 사본이며 `24d91a6`이 갱신).

### pair별 plan §10 강제 지점 분모

| Pair | §10 자리 목록 | 재측정 · 좌표 | 목록 밖 발견 · 고장 ID | 결과 |
|---|---|---|---|---|
| VP-02 | EP-02′ (4) | S02a 6·S02b 1(r1과 같음) · #1 BOOT 직후 단언 | — | PASS |
| VP-03 | EP-03‴ (19) | S03″ 37 — 목록 차집합 0(r2-0 독립 재열거) | #15 V26 못 잡음 · 부팅 실패 경로 D14 | PAIR_FAIL + PLAN_GAP |
| VP-04 | EP-04″ (16) | S04′ 45 = 38 + VP-02 2 + VP-05 5(줄 이동만) | `send.ts:63` 공용 helper V15 잡음 | PASS |
| VP-05 | EP-05″ (17) | S05a 6·S05d 0·S05e 0 | — | PASS |
| VP-06 | EP-06 (16) | S06a 5·S06b 11·S06c `0034` | — | PASS |
| VP-07 | EP-07 (4) | S07a 1·S07b 1·S07c 0 · gate:bundle | — | PASS |
| VP-08 | EP-08 (8) | S08 4 | #2 V12 못 잡음 | PAIR_FAIL |
| VP-09 | EP-09 (6) | S09a 1·S09b 0 | — | PASS |
| VP-10 | EP-10 (5) | S10a 0·S10b 4 · require 0 | — | PASS |
| VP-11 | EP-11 (2) | S11 0 | — | PASS |

- 닫힌 자리: 97 중 **95** — EP-03‴ #15·EP-08 #2를 뺀 값. 검산 4+19+16+17+16+4+8+6+5+2 = 97 = 구현자 표 97행(양방향 차집합 0, 구현자 대조와 같음).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| typecheck | PASS | 3구성 `error TS` 0(1분17초) |
| eslint(무수정) | PASS | 1,999파일 0 error · 2 warning(`Timeline.tsx:57`·`useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`) = r1 HEAD와 같은 2건 |
| vitest 차집합 | PASS | HEAD 913파일·8434케이스(pass 8402·fail 23·skip 9) vs 기준선 `c958f83` 908파일·8398케이스(8366·23·9) — 실패 ID 양방향 차집합 ∅ |
| scripts · migration · docs · budget | PASS | 144/144(16 suites) · sync ok 34+1(append-only는 태그 없는 얕은 clone이라 건너뜀 — CI가 판정) · 9 items·117 channels·prose·links ok · 16 suites ok |
| bundle | PASS | 1,283,424B · 압축 · recharts 0 · shiki 0 · 자산 21 · SDK require 0 |
| CI | PASS | run 41570894158(#951) `981056f` — migration·docs·budget·lint·typecheck·test 단계 전부 success. `24d91a6`은 docs만(app diff 0) |
| message-bus | PASS | `981056f`·`24d91a6` trailer 6키·5키 파싱 |

## r2-6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `HostHarnessPort.installed` | r2 diff 밖(`harness-host.ts` 무변경) · typecheck | HOST · R05-6·X29 잡음 | PASS |
| `orca:backend:list` | 기존 키 ⊆ 새 키(INSTALL) | Claude `usable:true` 두 경로(CLAUDE) · OpenCode 3사유(ROWS·registry) | PASS |
| `orca:harness:availability`·`recheck` | preload 채널(X42·X43 잡음) | main 방송 채널·대상(FANOUT · X33·V15 잡음) | PASS — r1 ⚠️ 해소 |

## r2-7. 숫자 / 음성 기준 / 상한 재측정

- vitest: 기준선 `c958f83` 908파일·8398케이스 → HEAD 913파일·8434케이스(+5파일·+36케이스). 실패 23은 양쪽 같은 ID이고 r1 `evidence/r1-final-electron-failed-ids.txt` 23과도 같다(Windows 경로 fixture·Linux 플러그인 제어·git shim).
- 자리 수: S04′ 45→45 · S05e 1→0 · S03″ 39→37(목록 차집합 0) · 분모 97 = 구현자 표 97.
- 고장: 135 = 125 + 8 + 2. AC: ✅ 20 · ⚠️ 3 · ❌ 0 = 23.
- 번들: 진입 1,283,424B(기준 3,891,098B) · 자산 21(기준 277) — r1 HEAD 1,283,482B에서 r2 renderer 변경분만큼 −58B.
- 0건 기준: S05e 0 · S05d 0 · SDK require 0 — 각각 PORT·HOST·gate:bundle 양성과 짝(U3·R05-6·B10 잡음).

## r2-8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| 부팅 체감 | 동시 시작·합류(BOOT·X03) | Windows 설치본 부팅 화면 종료 시점(plan §19 ①) |
| 미설치 화면 | 시드·재시드·Notice 클릭·대기 보호·사유 문구·추가 비활성 | OpenCode 미설치 PC 랜딩·모델 메뉴·엔진 추가·기존 세션 1회, Notice white/dark(§19 ②) |
| 설치 뒤 복귀 | registry focus·방송·preload·store 반영(STORE·FANOUT·RECHECK) | 실제 설치 뒤 창 포커스로 노출 복귀(§19 ③) — 새 대화가 Claude로 남는 것까지(D-019) |

## r2-9. 게이트 재실행

- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(exit 0, postinstall Electron ABI) 뒤 `node node_modules/electron/install.js`(exit 0). DB 스위트까지 Electron Node 모드로 실행했다.
- vitest: `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs run --maxWorkers=3 --reporter=json` — HEAD 3분22초·913파일·8434케이스, 기준선 `c958f83` worktree(같은 `node_modules` 연결) 3분12초·908파일·8398케이스. 실패 ID는 0290 `scan/vitest-failed-ids.mjs`로 뽑아 경로 접두를 맞춘 뒤 `comm`으로 비교했다.
- 정적: `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts -f json`(무수정) · `node --test scripts/*.test.mjs` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-test-budgets.mjs` · `electron-vite build --sourcemap --outDir <scratchpad>` + `scan/bundle-measure.mjs`.
- Windows CI: GitHub API로 run 41570894158의 job `gate`(windows-latest) 전 단계 success · `head_sha` `981056f` 확인. 로그 꼬리 `# tests 144 · # pass 144 · # fail 0`.
- 게이트가 작업 트리를 바꿨는가: 없음 — eslint `--fix` 미사용, doc-inventory는 `--check`만, 빌드 출력은 scratchpad. 실행 뒤 `git status`는 `verify-evidence/r2/`만.
- 잔여물: 기준선 worktree·번들 출력·고장 보고 JSON은 scratchpad에만 있다. 재현 테스트 2개는 실행 때만 `app/src/renderer/src/app/boot/`에 복사하고 지웠다.

## r2-10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/vitest/CI/번들 | 에이전트 실행 — PASS |
| AC ↔ production path | 에이전트 대조 — ⚠️ 3 |
| 부팅에서 가용성을 못 읽었을 때 마지막 백엔드를 기록할지(D14) | **설계자 → 필요하면 사용자 결정** — D-019 "자의든 타의든"의 범위 |
| 시각·실제 설치본 | 사람 실기 — r2-8 |

## r2-11. Repository operation checks

- AGENTS.md 변경 없음. 문서 변경은 `docs/arch/backend/adapters.md`·`docs/arch/frontend/state.md` 각 1문단 — 현재 상태 서술·수치 없음(doc-inventory prose ok).
- INDEX: 0292 행 `impl/IMPL_DONE (r2)`·다음 Claude(검증)·라운드 2·좌표 자리표시자 — 실제 상태와 일치. 이번 커밋에서 `verify/RETURN_TO_PLAN`·다음 Claude(설계)·라운드 3·좌표 기입으로 갱신. 비고 5줄 이내. 다른 행은 손대지 않았다.
- 인용 해시: `64047af`·`feaca09`·`3c50653`·`a2b5ca3` = commit·`origin/main` 조상 · `c9d212b`·`ceae905`·`cc75cf8`·`c958f83`·`981056f`·`24d91a6` = commit·PR #525 브랜치(미병합) · plan 메타의 `104034e`(r1 verify)·`7f3b156`(ΔV2)은 GitHub에 실재하지만 PR 브랜치 조상이 아니다 — 같은 트리의 브랜치 사본이 `ceae905`·`cc75cf8`(`git diff` 0)이다(N7) · `0eb7dc2`는 얕은 clone에 없음(r1과 같음).
- `[구현자 기입] (r2)` 7필드 전부 존재 — 설계 리뷰 · 강제 지점 전수(97행 + `남긴 곳` 열) · 잠금(106행 표) · Product/UX · 잠재 문제 7행 · 구현 보고 · Review Signals. 강제 지점 표는 pair §10 자리 전부(97)를 담는다.
- trailer: `981056f` `Agent: codex`·`Status: partial`·`Criteria-Met: 22/23`·`Criteria-Pending`·`Verified-By: pending` · `24d91a6` `Status: implemented`·`Criteria-Met: 23/23` — 허용값, 파싱 6키·5키.

## r2-12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| D-019 기록 3경로를 helper 1벌로 접음 | 타당 — ΔV3 구현 지시 그대로. 공유 축 V05·V14 잡음 | S03″ 술어 보완 제안(N6) |
| helper를 `setModel` 앞에 둬 오류 site 순번 보존 | 확인 — `reportSites` 계열 전체 스위트 green | 없음 |
| 실제 SettingsStore·bootstrap 리스너·Composer·preload facade·provider로 좌표 정정 | 타당 — X54·X55·X59·X35·X36·X02·U9·X68 잡음 | 없음 |
| T1을 golden 동치만으로는 못 잡아 Timeline 버튼 좌표로 보강 | 타당 — V31(child 제외 항 삭제)도 같은 좌표가 잡는다 | 없음 |
| 재시드·부팅 시드에 `isContinuityDraft` 추가 | 방어 항 — production 이어가기 초안은 이미 `agentKindLocked`. V09 동치·V08은 비production fixture로 잡음 | N8 |
| 놓친 잠재 #6 환경 실패 60건 | 확인 — 이 환경은 23건이고 양쪽 차집합 0. 환경별 실패 수가 다를 뿐이다 | 없음 |

## r2-13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D12 | 엔진 카드 배지 노출 조건(`EngineCard.tsx:34` `!agent.supported`)이 잠기지 않는다 — `true`로 바꿔 지원 카드에 "지원하지 않는 어댑터" 배지를 붙여도(V26) 전체 스위트 green. CARD·ADD 입력이 전부 `supported:false` | VP-03 · EP-03‴ #15 · AC8 · D-003 | BLOCKING (PAIR_FAIL) | 구현 |
| D13 | meta `copyable`의 메시지 집계가 잠기지 않는다 — `some`→`every`(V12)가 전체 스위트 green. GOLD·COPYSEM·Timeline 버튼 fixture의 assistant 턴이 전부 단일 메시지이고, `groupTurns`(`turns.ts:42-43`)가 묶는 도구 단계 + 답변 턴에서 복사 버튼이 사라진다 | VP-08 · EP-08 #2 · AC13 · D-003 | BLOCKING (PAIR_FAIL) | 구현 |
| D14 | 부팅 `backend` 단계가 실패(optional)하면 가용성을 읽지 못한 채 store 기본값 `missing`으로 `seedLandingBackend`가 `lastBackend:'claude'`를 영속한다 — `c958f83` 쓰기 0 → `24d91a6` 쓰기 1(repro). D-019의 "사용 불가로 인한 자동 전환"에 미확인 상태가 드는지 plan에 없다 | VP-03 · D-019·D-003·D-006 · AC7″ · EP-03‴ #1·#2 | **PLAN_GAP** | 설계(필요하면 사용자 질의) |
| N6 | S03″ 술어가 helper 호출 줄(`:222`·`:1905`)과 초안 제외 줄(`:1902`)을 잡지 않는다 — 독립 재열거로 목록 밖 0 | plan 검색 | NON_BLOCKING | 다음 revision에서 `rememberLandingBackend\(`·`isContinuityDraft\(` 술어 추가 |
| N7 | plan 메타의 `104034e`·`7f3b156`이 PR 브랜치 조상이 아닌 같은 트리 사본이다(브랜치 = `ceae905`·`cc75cf8`) | plan 메타 | NON_BLOCKING | 좌표 정본은 INDEX — 메타 정정 |
| N8 | 재시드·부팅 시드의 `isContinuityDraft` 항은 `agentKindLocked`와 겹치는 방어 항이고, DRAFT의 fork·handoff fixture는 production에 없는 잠기지 않은 이어가기 초안이다 | 비귀속 | NON_BLOCKING | 기록 |
| N9 | COPYSEM 케이스명 "empty child id is main text"가 단언한 의미(`parentToolRunId:''`는 본문 아님 — Timeline 버튼 0)와 반대다 | 테스트 이름 | NON_BLOCKING | 이름 정정 후보 |

- r1 파생 이슈 상태: D1~D9 closed(X03·X02·X12·X56·X15·X63·X13·X62·X04·X41·X54·X55·X59·X64·X35·X36·X01·X27 전부 잡음) · D10 closed(ΔV2 EP-04″ + X33·X68·X05 잡음) · D11 closed(ΔV2 D-016·D-017 → ΔV3 D-019·D-020, U7·U9 잡음) · N1 closed(plan §17 ΔV2 정정) · N2 closed(D-018 · S05e 0 · U3 잡음) · N3 일부(`useHarnessAvailable` 삭제, `projectTimeline`·`agentStore.dispose` 테스트 전용 잔여) · N4 closed(ΔV2가 S02a 목표를 S04′로 대체) · N5 open(X57·X65 동치 재확인).

> plan `[검증자 기입] 파생 이슈`로 이관했다. PLAN_GAP이 있어 다음 주체는 설계자다. 설계자가 D14를 ΔV4로 정하면, 다음 구현이 D12·D13과 D14를 잠근다.

## r2-14. Review Signals — 사실만

- 이전 라운드와 유사 증상: 좌표의 운반 값이 한쪽 분기뿐인 형태가 반복됐다 — r1 사유 기본값 `missing`(X13·X62·X63·X64) · r2 `supported:false`만 주는 CARD(V26)·단일 메시지 턴만 있는 GOLD(V12).
- 관련 plan 지침: ΔV2 EP-08 #2 oracle은 공백·child fixture를 요구했고 다중 메시지 턴은 적지 않았다. EP-03″ #15 oracle은 사유 3종을 요구했고 지원 행 분기는 적지 않았다.
- 사용자 결정 변경: ΔV3(2026-11-03, D-019·D-020) — 실패가 아니다. D14는 그 변경이 기존 부팅 실패 경로와 만나며 생겼다.
- 반복된 검증 환경 한계: 얕은 clone이라 로컬 migration append-only 건너뜀(CI 판정) · Electron 바이너리 수동 설치 · plan 메타 커밋이 PR 브랜치 밖 같은 트리 사본.

## r2-15. 결론

- 상태: **RETURN_TO_PLAN** — verify 2회째(3·6·9회째 아님 — review 트리거 아님).
- pair: PASS 9(VP-01·02·04·05·06·07·09·10·11) · PAIR_FAIL 2(VP-03·VP-08) · BLOCKED 0.
- PLAN_GAP: D14(부팅 `backend` 단계 실패 시 마지막 백엔드 기록) → VP-03 · AC7″.
- r1 파생 이슈: D1~D11 전부 closed — r1 못 잡음 21건이 전부 잡음이 됐다.
- AC: ✅ 20 · ⚠️ 3(AC7″·AC8·AC13) · ❌ 0 = 23.
- 운영 gate: 전부 PASS(Windows CI 포함).
- 다음: 설계자가 D14를 ΔV4로 정한다(필요하면 사용자 질의). 이어 구현자가 D12·D13·D14를 잠근다. 다음 verify는 이 이력의 못 잡음 2·동치 8을 다시 실행한다.
