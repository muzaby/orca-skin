# 5. 특장점

전형적인 "from-scratch 에이전트"(단일 파일 while 루프 + provider SDK 직호출 + JSON 파싱)와
비교했을 때, opencode 가 의도적으로/특이하게 잘 만든 지점들. 각 항목은 코드 앵커를 동반한다.

## 5.1 LLM 경계의 이중 런타임 (네이티브 우선 + AI SDK 폴백)

대부분의 자작 에이전트는 provider SDK 하나에 묶인다. opencode 는 **자체 wire 프로토콜
구현(`@opencode-ai/llm`, 11종 프로바이더)을 기본 경로**로 두고, 그게 못 받는 케이스만 Vercel
AI SDK 로 폴백한다. 두 런타임을 **동일한 `LLMEvent` 스트림**으로 통일한 어댑터 시임이 핵심.

- 근거: `session/llm.ts:227-281` — 네이티브 지원 판정 후 `supported` 면 네이티브 스트림,
  아니면 `streamText` 폴백. `:368-382` 에서 두 경로를 같은 스트림 타입으로 수렴.
- 왜 중요한가: 프로바이더별 최신 기능(Anthropic messages, OpenAI responses 등)을 SDK 업스트림
  업데이트를 기다리지 않고 직접 제어하면서도, 미지원 프로바이더는 SDK 로 커버한다. **제어력과
  커버리지를 동시에** 얻는 드문 설계.

## 5.2 종료 로직의 프로바이더 보정 (`hasToolCalls`)

루프 종료 판정이 단순히 `finish === "stop"` 이 아니다.

- 근거: `session/prompt.ts:1156-1168`.
  ```ts
  // Some providers return "stop" even when the assistant message contains
  // tool calls. ...
  const hasToolCalls = lastAssistantMsg?.parts.some(
    (part) => part.type === "tool" && !part.metadata?.providerExecuted && !isOrphanedInterruptedTool(part),
  ) ?? false
  ```
- 왜 중요한가: 프로바이더가 툴콜을 담고도 `stop` 을 주는 흔한 버그를 흡수한다. 이런 보정이
  종료 조건에 박혀 있다는 것 자체가 "실제 운영에서 데인 흔적"이며, 자작 에이전트가 가장 자주
  틀리는 부분(루프가 너무 일찍 끝나 툴 결과가 모델에 안 돌아감)을 정확히 막는다.

## 5.3 둠 루프(무한 동일 툴콜) 감지

모델이 같은 인자로 같은 툴을 반복 호출하는 무한 루프를 런타임이 감지한다.

- 근거: `session/processor.ts:35`(`DOOM_LOOP_THRESHOLD = 3`), `:522-546`. 최근 3개 파트가
  전부 같은 툴·같은 입력이면 `permission.ask({ permission: "doom_loop", ... })` 로 **사용자에게
  개입을 요청**한다.
- 왜 중요한가: 토큰/비용을 태우는 전형적 실패 모드를 자동 종료가 아니라 "사람에게 물어보기"로
  처리 — 자율성과 안전의 균형.

## 5.4 권한 게이트가 Deferred 로 툴 실행을 블록

승인이 필요한 동작은 **이펙트 레벨에서 멈춘다**. 폴링이나 별도 상태머신이 아니라 `Deferred`
하나로 깔끔하게.

- 근거: `permission/index.ts:109-117` — `Deferred.make()` → pending 등록 → 이벤트 발행 →
  `Deferred.await`. `reply`(`:120-178`)가 `once/always/reject` 로 해소하고, `always` 는 동일
  패턴의 다른 대기들까지 일괄 승인(`:164-177`).
- 왜 중요한가: 비동기 사용자 승인을 군더더기 없이 동기 흐름처럼 다룬다. `always` 일괄 승인,
  reject 시 같은 세션의 다른 pending 도 함께 거부하는 등 UX 디테일까지 모델링됨.

## 5.5 3단 컨텍스트 관리: 오버플로 → 요약 압축 → 프루닝

컨텍스트 한도를 단순 truncate 가 아니라 세 전략으로 다룬다.

- 근거: `session/compaction.ts` — `isOverflow`(`:178`), `select`+`splitTurn`(요약 시 최근 turn
  을 토큰 예산 안에서 보존, `:198-249`), `prune`(`PRUNE_PROTECT=40,000` 토큰 보호 후 오래된
  툴 출력 비우기, `:251-`). 루프가 오버플로를 감지하면 자동 압축 작업을 큐잉
  (`prompt.ts:1214-1221`).
- 왜 중요한가: "최근 대화는 원문 보존 + 오래된 건 요약 + 거대한 툴 출력은 선택적 제거"라는
  현실적인 메모리 전략. 장기 세션에서 품질 저하를 최소화한다.

## 5.6 모델별 적응(툴 셋·프롬프트)

같은 에이전트라도 모델에 따라 다른 툴과 프롬프트를 쓴다.

- 근거: 툴 — `registry.ts:273-276` (GPT 계열은 `apply_patch`, 그 외 `edit`/`write`).
  프롬프트 — `session/prompt/` 디렉터리에 `anthropic.txt`, `gpt.txt`, `gemini.txt`,
  `codex.txt`, `kimi.txt`, `beast.txt` 등 모델 패밀리별 시스템 프롬프트가 분리돼 있다.
- 왜 중요한가: 모델마다 잘 듣는 편집 방식/지시 스타일이 다르다는 실전 지식을 코드/리소스로
  내재화. 단일 프롬프트로 모든 모델을 미는 자작 에이전트와 결정적으로 다른 성숙도.

## 5.7 Effect 기반 일관된 동시성·자원·인터럽트 모델

전 모듈이 Effect 위에 있어 취소/인터럽트/자원정리/재시도가 통일된다.

- 근거: 인터럽트 시 미완 assistant 마무리 `finalizeInterruptedAssistant`
  (`prompt.ts:1256-1264`, `:1272`/`:1375`에서 `onInterrupt`); 재시도 정책
  `SessionRetry.policy`(`processor.ts:994-1025`); 세션당 단일 실행 `ensureRunning`
  (`run-state.ts`); 네이티브 툴 동시 실행 `FiberSet`(`native-runtime.ts:106-133`).
- 왜 중요한가: 에이전트는 본질적으로 "오래 도는 + 중간에 취소되는 + 실패하면 재시도하는"
  워크로드다. 이를 ad-hoc try/catch 가 아니라 이펙트 시스템으로 일관되게 처리해 자원 누수와
  좀비 fiber 를 구조적으로 막는다.

## 5.8 멀티에이전트가 데이터 주도(메시지 파트)로 표현됨

서브에이전트 위임이 별도 오케스트레이터 클래스가 아니라 메시지에 박힌 `subtask` 파트로
표현되고, 같은 루프가 이를 분기 처리한다.

- 근거: `prompt.ts:1195-1200`(`tasks.pop()` → `handleSubtask`), `:239` `handleSubtask`,
  `agent/subagent-permissions.ts`(서브에이전트 권한 파생).
- 왜 중요한가: 오케스트레이션 상태가 전부 영속 메시지에 들어가므로, 재시작/복구 시 토폴로지가
  메시지에서 그대로 재구성된다. 별도 오케스트레이션 상태를 따로 영속화할 필요가 없다.
