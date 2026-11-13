# 0317 넓은 감사 1단계 — 4버킷의 읽지 않은 대형 파일 11개

> 기준 커밋 `1168b67`. 계약 정본은 [plan.md](plan.md)다. 표는 [`data/audit.json`](data/audit.json)을 [`scan/check.mjs`](scan/check.mjs)가 렌더한 생성 블록이고 손으로 고치지 않는다.

## 진행표

| 단계 | 내용 | 상태 |
|---|---|---|
| P1 | 검사기 · UT · 대상 11파일 · 단위 뼈대(98) | 완료 |
| P2 | F01~F04 판정 (main · opencode) | 대기 |
| P3 | F05~F11 판정 (renderer) | 대기 |
| P4 | 전제·조건 근거 · 문서 완성 | 대기 |

## 1. 판정에 넣을 값

<!-- gen:ruling -->
| 항목 | 값 | 근거 |
|---|---|---|
| 판정 | 0305 계열 종료 | 통과 후보 감량 합 0줄 < 30줄 |
| 통과 후보 P | 0건 · 0줄 | 없음 |
| 걸린 후보 | 0건 | 없음 |
| 전체 후보 합(민감도) | 0줄 | i18n 미사용 키를 뺀 후보 0건 |
| i18n 미사용 키(문턱 밖 별도 집계) | 후보 0건 · 키 0개 · 0줄 | 없음 |

승인 목록(`remove` 유형 — 사용자 승인 뒤에만 제거한다):

| 후보 | 무엇을 지우는가 | 통과 여부 |
|---|---|---|
<!-- /gen:ruling -->

## 2. 구간 판정

<!-- gen:areas -->
| 구간 | 범위 | X1 | X2 | X3 | X4 | X5 | X6 | X7 | X8 | L1 | L5 | L6 | 판정 근거 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | `adapter.ts` 1-399 (399줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F02 | `discovery-cache.ts` 1-315 (315줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F03 | `mcp-control.ts` 1-335 (335줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F04 | `server.ts` 1-485 (485줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F05 | `QuestionCard.tsx` 1-325 (325줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F06 | `CanonicalBackgroundContent.tsx` 1-410 (410줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F07 | `LegacySubAgentTile.tsx` 1-346 (346줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F08 | `GitContextBar.tsx` 1-328 (328줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F09 | `en.ts` 1-1425 (1425줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F10 | `ko.ts` 1-1434 (1434줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| F11 | `CascadeMenu.tsx` 1-343 (343줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
<!-- /gen:areas -->

## 3. 후보

<!-- gen:candidates -->
| 후보 | 구간 | 렌즈 | 유형 | 되풀이되는 것 | 자리 | 보존 동작 | 남기는 구조 | 감량(prod) | 핫패스 | 통과 |
|---|---|---|---|---|---|---|---|---|---|---|
<!-- /gen:candidates -->

## 4. 전제·조건 근거

<!-- gen:premises -->
| 후보 | 경쟁 가드 | 형태 잠금 | AGENTS 채택 규칙 | UI | 성능 | 동적 키 접두사와 겹치지 않는다 |
|---|---|---|---|---|---|---|
<!-- /gen:premises -->

## 5. 판정 단위

<!-- gen:units -->
| 구간 | 단위 | L6 | 근거 |
|---|---|---|---|
| F01 | `reportMcpFailure` | (대기) |  |
| F01 | `agentSpawnEnv` | (대기) |  |
| F01 | `describe` | (대기) |  |
| F01 | `executableIdentity` | (대기) |  |
| F01 | `isInstalled` | (대기) |  |
| F01 | `listProviderModels` | (대기) |  |
| F01 | `extensionsChanged` | (대기) |  |
| F01 | `restartRevision` | (대기) |  |
| F01 | `resourceActivityChanged` | (대기) |  |
| F01 | `configureResourceActivity` | (대기) |  |
| F01 | `reconcileConnections` | (대기) |  |
| F01 | `close` | (대기) |  |
| F01 | `client` | (대기) |  |
| F01 | `complete` | (대기) |  |
| F01 | `recoverSession` | (대기) |  |
| F01 | `sendMessage` | (대기) |  |
| F01 | `readHistory` | (대기) |  |
| F01 | `classifyError` | (대기) |  |
| F01 | `reportDisposeFailure` | (대기) |  |
| F01 | `reportError` | (대기) |  |
| F02 | `probe` | (대기) |  |
| F02 | `context` | (대기) |  |
| F02 | `hash` | (대기) |  |
| F02 | `probes` | (대기) |  |
| F02 | `dependency` | (대기) |  |
| F02 | `discoveryReadFile` | (대기) |  |
| F02 | `discoveryRealpath` | (대기) |  |
| F02 | `discoveryStat` | (대기) |  |
| F02 | `key` | (대기) |  |
| F02 | `valid` | (대기) |  |
| F02 | `invalidate` | (대기) |  |
| F02 | `hold` | (대기) |  |
| F02 | `watch` | (대기) |  |
| F02 | `poll` | (대기) |  |
| F02 | `prune` | (대기) |  |
| F02 | `openCodeDiscovery` | (대기) |  |
| F03 | `resourceActivityChanged` | (대기) |  |
| F03 | `waitForActivity` | (대기) |  |
| F03 | `connected` | (대기) |  |
| F03 | `activate` | (대기) |  |
| F03 | `observeActivity` | (대기) |  |
| F03 | `safe` | (대기) |  |
| F03 | `resource` | (대기) |  |
| F03 | `connect` | (대기) |  |
| F03 | `read` | (대기) |  |
| F03 | `reconcileChoices` | (대기) |  |
| F03 | `waitBounded` | (대기) |  |
| F03 | `reconcile` | (대기) |  |
| F03 | `choices` | (대기) |  |
| F03 | `pending` | (대기) |  |
| F03 | `preview` | (대기) |  |
| F03 | `status` | (대기) |  |
| F03 | `apply` | (대기) |  |
| F03 | `applyChoices` | (대기) |  |
| F04 | `CLI_VERSION` | (대기) |  |
| F04 | `CLI_TIMEOUT_MS` | (대기) |  |
| F04 | `CLI_MAX_BUFFER` | (대기) |  |
| F04 | `CLI_STDERR_LINE_LIMIT` | (대기) |  |
| F04 | `isSupportedOpenCodeCliVersion` | (대기) |  |
| F04 | `runOpenCodeCli` | (대기) |  |
| F04 | `lastStderrLine` | (대기) |  |
| F04 | `resolveOpenCodeExecutable` | (대기) |  |
| F04 | `executable` | (대기) |  |
| F04 | `readVersion` | (대기) |  |
| F04 | `probeVersion` | (대기) |  |
| F04 | `executableIdentity` | (대기) |  |
| F04 | `installed` | (대기) |  |
| F04 | `acquire` | (대기) |  |
| F04 | `retireAll` | (대기) |  |
| F04 | `terminate` | (대기) |  |
| F04 | `start` | (대기) |  |
| F04 | `assertCliVersion` | (대기) |  |
| F04 | `listModels` | (대기) |  |
| F04 | `databasePath` | (대기) |  |
| F04 | `readDatabasePath` | (대기) |  |
| F04 | `close` | (대기) |  |
| F05 | `answerFor` | (대기) |  |
| F05 | `AskUserQuestionCard` | (대기) |  |
| F05 | `useEffect` | (대기) |  |
| F06 | `CanonicalBackgroundContent` | (대기) |  |
| F06 | `useEffect` | (대기) |  |
| F06 | `BackgroundTaskCard` | (대기) |  |
| F06 | `BackgroundCallCard` | (대기) |  |
| F06 | `CanonicalBackgroundDetail` | (대기) |  |
| F07 | `stopErrorText` | (대기) |  |
| F07 | `LegacySubAgentHeader` | (대기) |  |
| F07 | `LegacySubAgentContent` | (대기) |  |
| F07 | `SubAgentTaskList` | (대기) |  |
| F08 | `ComparisonMenu` | (대기) |  |
| F08 | `ViewMenu` | (대기) |  |
| F08 | `GitContextBar` | (대기) |  |
| F10 | `ko` | (대기) |  |
| F11 | `CascadeMenu` | (대기) |  |
| F11 | `HANDLED_KEYS` | (대기) |  |
| F11 | `CascadeBody` | (대기) |  |
| F11 | `useEffect` | (대기) |  |
| F11 | `CascadePanel` | (대기) |  |
| F11 | `useLayoutEffect` | (대기) |  |
<!-- /gen:units -->
