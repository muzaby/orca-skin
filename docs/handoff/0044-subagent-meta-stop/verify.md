# Verify — 0044-subagent-meta-stop

## 메타

| 항목 | 값 |
|---|---|
| slug | `0044-subagent-meta-stop` |
| 검증자 | Claude Code |
| 일자 | 2026-06-25 |
| 대상 커밋 | `1a46138`(라이브 메타+단위 중단)·`d5b9362`(중단 정착+패널)·`0bf84f9`(백그라운드화)·`3be2906`·`a674588`(개별 중단 실제 전파) — HEAD `a674588` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 모델 캡처: child `message.model` → `subagent.task(progress).model` + ctx 누산, 'Explore' 대신 모델 표시 | ✅ | `claude-map.ts:207` `if (parentToolRunId !== undefined && typeof m?.model === 'string' …)` → `accrueSubagentMeta(ctx, parentToolRunId, { model })` + `subagent.task(progress)` emit(`:210`). 테스트 "child assistant 의 message.model 을 subagent.task(progress) 로 캡처한다" |
| 2 | `modelDisplayLabel` model id → 친근 라벨, 미인식 원형 | ✅ | `lib/parts.ts:325` `modelDisplayLabel`(haiku/sonnet/opus/fable 매핑·미인식 원형). 테스트 "modelDisplayLabel 은 모델 id 를 친근한 라벨로 매핑한다" |
| 3 | `forwardSubagentText: true` → child text 가 message.completed(parentToolRunId)로, 우측 상세 답변 렌더(0043 경로 재사용) | ✅ | `adapters/claude.ts:284` `forwardSubagentText: true`. child text 경로는 0043 `childMessageForParentToolRunId` 재사용 |
| 4 | task_* 소비: `task_started/progress/notification` → `subagent.task`, tool_use_id 없거나 skip_transcript 면 드롭 | ✅ | `claude-map.ts:153~161` system task_* 분기 → `mapTaskSystem`, `:67` `if (!toolUseId || msg.skip_transcript === true) return []`, `:65` task_id 로 toolUseId 복원. 테스트 3건(started/progress/복원) |
| 5 | 라이브 시간/도구: store transient `subagentMeta`(toolUseId 키), AgentTaskRow 단일·그룹 모두 경과시간·현재도구·도구수 라이브 | ✅ | `chatStore.ts:66·151~175` transient `subagentMeta` 병합(reducer 미경유)·`:725` `useSubagentMeta`. `AgentTaskRow.tsx:42·48·54·55`(live model/elapsed/lastToolName/toolUses) |
| 6 | 영속/재로드: 부모 Task `tool.call.completed.subagentMeta` 영속 → 재로드 후 복원(subagentMeta 우선) | ✅ | `claude-map.ts:286·294` user tool_result 에 누산 meta 부착, `shared/ipc.ts:307` event·`:725` part. persist `ipc/chat/persist.ts`, 파생 `lib/parts.ts:219` `call.result?.subagentMeta` 우선. 테스트 "누산한 메타를 부모 Task tool_result 에 subagentMeta 로 영속"·"subagentTasksFromMessages 는 …subagentMeta 의 모델/시간/도구수를 쓴다" |
| 7 | 중단 버튼: running 카드 '대화록 보기' 우측 네모·라운드·채움없음(`stop`), 카드 열기와 분리, `<div role>` 재구성 | ✅ | `SubAgentTileContent.tsx:163` `role="button"` div(중첩 버튼 회피)·`:205` `leadingIcon="stop"`·`:210` `e.stopPropagation()` → `chatActions.stopSubagent`. `shared/ui/Icon.tsx` `stop` 아이콘 |
| 8 | 중단 구현: `orca:chat:stopSubagent`(sessionId,toolUseId) → main 이 toolUseId→task_id 로 `stopTask`(실패 시 backgroundTask), Task 단위 | ✅ | 채널 `shared/ipc.ts:12`·`protocol.ts:69` `StopSubagentSchema`. 핸들러 `ipc/chat/send.ts:596`(`turn.subagentTaskIds.get(req.toolUseId)` → settle), `:145~151` background 먼저 후 `stopTask`. `claude.ts:346~348` `stopTask`/`backgroundTask` 위임. `turn-registry.ts:61` `subagentTaskIds` |
| 9 | 무회귀·게이트 + 레이어 경계 0 | ✅ | lint(boundaries 0)·typecheck·test green(아래). 구체 리터럴은 adapters/ipc 내부 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | PASS (502/502 실행분) |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 | 이견 시 중재 | 9/9 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint green |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT 49→50 동기화 |
| 실환경 SDK 통합(forwardSubagentText·task_*·stopTask) | ✖ | ✅ | 사람 실환경 검증 대기 |
| UI/UX 시각 검증(라이브 메타·중단 버튼) | ✖ | ✅ | 사람 확인 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ npm run typecheck   ✅  (node + web + test)
$ npm run lint        ✅  (boundaries 위반 0)
$ npm test            Test Files 2 failed | 67 passed (69) · Tests 502 passed (502)
```

- 502/502 통과. 2 실패 파일(`persist.test.ts`·`send.runtime-resilience.test.ts`)은 electron 바이너리 미설치 import 차단(환경 제한, 변경 무관). 서브에이전트 핵심 로직은 `claude-map.test.ts`·`parts.test.ts`·`chatStore.test.ts`·`subagent-settlement.test.ts`(83 green)로 직접 커버.
- `npm rebuild better-sqlite3`(Node ABI) 후 `db/queries.test.ts` green.

## 위생 검토

- AGENTS.md 변경 없음. 문서 = `docs/IPC_CONTRACT.md`(채널 49→50·`subagent.task` 이벤트·`subagentMeta`·`stopSubagent` 행). 키/토큰/이메일/IP 0.
- `git diff --check` clean, 대상 파일 디버그 잔여 0. IPC 채널 수 코드 50 = IPC_CONTRACT "총 50 채널" 일치.
- **설계 진화 노트**: plan AC8 의 `stopTask`+백그라운드 fallback 이 라운드 내 후속 커밋(`0bf84f9` 백그라운드화·`subagent-settlement.ts` 정착·`3be2906`/`a674588` 실제 전파)으로 보강됨. `ORCA_SUBAGENT_BACKGROUND` 플래그 게이트(`claude.ts:80`)로 foreground 현행 보존. AC 범위 내 정상 보강(라운드 +1 아님).

## PHASES.md 정합성

- 페이즈 표에 "서브에이전트 메타/중단 (handoff `0044-subagent-meta-stop`)" 행 승격(커밋 `a674588`).

## 결론 / 다음 단계

- **상태: PASS** → PHASES 승격. 다음=—(종료).
- 사람 실환경 검증 대기: `forwardSubagentText` 실제 child 답변·`task_*` 라이브 메타(모델/시간/현재도구/도구수)·`stopTask` 실제 중단(foreground 직접 stop vs `backgroundTasks` fallback)·Debug `subagent_task_running`/`_multi`/`_child` 시각 검증·PR 머지.
