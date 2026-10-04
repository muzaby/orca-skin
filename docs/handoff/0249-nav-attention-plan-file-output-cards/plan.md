# Plan — 0249-nav-attention-plan-file-output-cards

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0249-nav-attention-plan-file-output-cards` |
| 작성자 | Claude Code |
| 일자 | 2026-10-04 |
| 매핑 | 기준 커밋 `origin/main@954e6fff` |
| 상태 | DRAFT — 구현 중 PLAN_GAP (ΔV1 규범은 보존, AC19 정정 대기) |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | V1 = `none`(신규) · ΔV1 = `0249:V1@266bdbfe`(공유 브랜치 확인). 다른 handoff 의 동작은 `INHERITED` 회귀로만 둔다 |
| 이번 V revision | `ΔV1` — 사용자 결정 변경(⑪~⑭)·진술⑮·추가 요구⑦ |
| 유효 V | `V1 + ΔV1` |
| 구현 주체 | Claude — 사용자 표현 "수정 및 버그 픽스"(root `AGENTS.md` 비기능 작업 분담) |

> **ΔV1 적용(2026-10-04)** — ③ 백그라운드 패널·④ ExitPlanMode 에 관한 V1 서술(§1·§2·§5·§6·§7·§7-A·§9~§19 의 해당 행)은 문서 끝 **§ΔV1** 이 대체한다. ⑦ 엔진&모델 개수는 ΔV1 신설이다. 유효 AC 20.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 사용자 실기에서 나온 6건이다.
  ① 로그인 프리 연결 행이 '인증 불필요'로 보인다. ② 다른 세션이 승인·질문·계획 승인을 기다려도 좌측 nav 에 아무 표시가 없다.
  ③ Code 백그라운드 패널에 Bash·PowerShell·Agent 외 도구의 호출·실패 카드가 쌓인다. ④ LiteLLM/OpenRouter custom 모델에서 `ExitPlanMode` 의 `plan`·`planFilePath` 가 비어 계획 패널이 본문을 못 보인다.
  ⑤ Work 한 턴에서 같은 파일을 여러 번 갱신하면 파일 카드가 갱신 횟수만큼 나온다. ⑥ 파일 카드가 답변과 떨어져 복사·시간 행 아래에 나온다.
- 완료 후 달라지는 것: 로그인 프리 행이 '연결됨'이다. 응답을 기다리는 비열람 세션 아이콘이 완료 표시와 같은 Orca 파랑이 되고 열면 꺼진다. 백그라운드 패널은 Bash·PowerShell·Agent 카드만 보인다. custom 모델도 계획 파일 본문과 파일명이 계획 패널에 보인다. 같은 파일 카드는 한 턴에 1장이고 답변 끝(복사·시간 행 앞)에 붙는다.
- 성공을 사용자 관점에서 한 문장으로: **기다리는 세션을 nav 에서 알아보고, 승인할 계획 본문을 모델과 무관하게 보며, 패널·카드에는 의미 있는 항목만 한 번씩 답변에 붙어 나온다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "free plugin 카탈로그에서 loginFree 표시를 '인증 불필요' 가 아닌 '연결됨' 으로 변경할 것. (i18n)" | 라이브 세션 |
| 명시 요구 ② | "도구 호출 승인 요청시 좌측 nav에 알림 표시로 갱신 (아이콘을 orca 파란색 표시)" | 라이브 세션 |
| 명시 요구 ③ | "code agent 모드에서 bash, powershell, agent 호출 외에는 백글라운드 패널에 카드 표시하지 말것. 당연히 bash, powershell, agent 호출 외 도구의 호출 실패 카드도 기록하지 말 것" | 라이브 세션 |
| 명시 요구 ④ | "litellm/openrouter 커스텀 모델 환경에서 서버사이드에서 exitplanmode 의 plan 및 planFilePath 가 제대로 전달이 안되는 현상 … exitplandmode 핸들러에서 해당 필드가 비었을 경우 폴백모드로 plan 및 planFilePath 를 채우는 작업을 하라. exitplanmode 호출 전 update 도구를 에서 ~/.claude/plans/<FILE>.md 를 확인하라." | 라이브 세션 |
| 명시 요구 ⑤ | "work agent 모드에서 한 턴에서 같은 파일이 여러번 업데이트 되는 경우에도 … file 카드에 똑같은 파일이 업데이트 된 횟수만큼 표시되는 버그 … 같은 파일이라면 한 번만 출력되도록" | 라이브 세션(턴 중 추가) |
| 명시 요구 ⑥ | "file 카드가 어시스턴트 답변 아래에 출력되고 있는데 (어시스턴트 답변과 구분), 어시스턴트 답변과 구분되지 않고 답변의 마지막에 위치하도록 하라." | 라이브 세션(턴 중 추가) |
| 명시 결정 ⑦ | 알림 범위 = "오르카 파란색 계열 . 완료 포함. 응급대기 전체" | AskUserQuestion 답변 |
| 명시 결정 ⑧ | 알림 해제 = "세션을 열면 해제" | AskUserQuestion 답변 |
| 명시 결정 ⑨ | plan 폴백 사용처 = "화면에만 표시" — 원인 진술 "Litellm측의 버그로 파싱이 제대로 안된 탓이다. Cli 가 제대로 못받게 되는 상황인것이다." | AskUserQuestion 답변(재질의) |
| 명시 결정 ⑩ | 카드 위치 변경 범위 = "work·code 공통" | AskUserQuestion 답변 |
| 추론 의도 | "응급대기" = "응답대기" 오타로 읽는다. "update 도구" = 파일을 갱신하는 `Write`·`Edit` 로 읽는다(CLI 화면 라벨이 `Edit`→"Update"; §8 F-13) | 추론 |
| 추론 의도 | 요구③ "기록하지 말 것" = 패널 **카드로 만들지 않는 것**으로 읽는다. main 의 canonical 상태는 listen 대기 판정의 근거라 남긴다(D-008) | 추론 — 사용자 관측 결과는 같다 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 로그인 프리 상태 라벨 = '연결됨'(ko)·'Connected'(en). 키 `skills.provider.status.loginFree` 는 유지하고 값만 바꾼다. 종류 '기본 제공'·인증 액션 부재는 유지 | 요구① "(i18n)". en 은 ko 대응 번역(기존 `valid`='Connected') | 요구① | ACTIVE | 0248 D-010 의 상태 라벨 부분 변경(§16) |
| D-002 | 응답 대기 요청 3종(`tool_approval`·`ask_question`·`plan_review` = `permission.requested` 전부)이 **열람 중이 아닌** 세션에 오면 nav 행 아이콘을 표시한다 | 결정⑦ "응급대기 전체" | 요구②·결정⑦ | ACTIVE | 0224 D-037 확장 |
| D-003 | 응답 대기 표시는 비열람 완료 표시와 **같은 시각**(`text-selected` + 굵은 stroke)이다 | 결정⑦ "오르카 파란색 계열 . 완료 포함" | 결정⑦ | ACTIVE | — |
| D-004 | 수명 = 완료 표시와 같다 — 열람 중 세션엔 만들지 않고, 열면 해제, 삭제 시 정리, 앱 재시작 시 복원 안 함 | 결정⑧ "세션을 열면 해제" | 결정⑧ | ACTIVE | — |
| D-005 | 두 사유를 **한 Map(세션→사유)** 에 둔다. 마지막 사유가 이긴다 | 해제 경로(열람·삭제)가 하나라야 두 사유가 갈라지지 않는다 | 설계 | ACTIVE | `unseenCompletedIds`(Set) 대체 |
| D-006 | chat→sessions 연결은 **app 계층에서만** 한다 | feature 교차 import 금지. 선례 `useSessionCompletion.ts:5` "chat의 정상 종료와 sessions의 표시 상태는 app에서만 연결한다" | 저장소 규칙 | ACTIVE | — |
| D-007 | Code 백그라운드 패널 카드 = **Bash·PowerShell·Agent(Task) 호출과 그 작업만**. 다른 도구의 호출·실패·작업은 카드가 아니다 | 요구③ 원문 | 요구③ | **SUPERSEDED → D-021 (ΔV1)** | 0231 R-19·R-20 의 패널 표시 부분 변경(§16) |
| D-008 | 요구③ "기록하지 말 것" = **패널 투영에서 제외**한다. main canonical 상태·journal 은 그대로 둔다 | canonical 상태가 listen 대기(`backgroundPending`)·Spark 개수의 근거다(§8 F-07). 지우면 대기 판정이 바뀐다 | 추론 | ACTIVE | — |
| D-009 | 패널 종류 판정 = 연결 호출의 `toolName` 우선(`Bash`·`PowerShell`→셸, `Agent`·`Task`→에이전트). 호출이 없으면 `taskType`(`local_bash`→셸, `local_agent`·`remote_agent`→에이전트). **둘 다 없으면 표시하지 않는다**. 셸의 백그라운드 증거 규칙(0232 D-16)은 유지 | 요구③ 의 "외에는" 을 엄격하게 따른다 | 요구③ | **SUPERSEDED → D-022 (ΔV1)** | — |
| D-010 | Spark 의 "백그라운드 작업 N건" 개수는 바꾸지 않는다 | 카드가 아니라 listen 대기 사유다. 요구③ 은 패널 카드다 | 범위 판단 | ACTIVE | — |
| D-011 | `ExitPlanMode` 입력의 `plan` 이 비면, **같은 턴에 메인 에이전트가 `Write`·`Edit` 로 갱신한 plans 디렉토리의 마지막 `.md`** 를 읽어 `plan`·`planFilePath` 를 채운다 | 요구④ 원문 | 요구④ | **SUPERSEDED → D-025 (ΔV1)** | 0215 §6 비범위 "`planFilePath` 로부터의 파일 읽기" 대체(§16) |
| D-012 | 본문 체인 = 입력 `plan` → 계획 파일(D-011) → 이번 턴 서술(0215) → `''`(실패 표시) | 계획 파일은 CLI 가 원래 주입하는 정본이다(§8 F-09). 서술은 근사다 | 요구④ | **SUPERSEDED → D-025 (ΔV1)** | 0215 D-001 의 3단 체인 변경(§16) |
| D-013 | 채운 값은 **Orca 표시에만** 쓴다. 승인 시 CLI 로 돌려보내는 `updatedInput` 은 원래 입력 그대로다 | 결정⑨ "화면에만 표시". 넣으면 CLI 가 자기 경로에 사본을 써서 이후 계획을 덮어 보일 수 있다(§8 F-10) | 결정⑨ | **SUPERSEDED → D-026 (ΔV1)** | — |
| D-014 | `planFilePath` 는 `PlanReviewRequest.planFilePath?` 로 renderer 에 보내고, 승인 대기 중 Plan 타일 본문 위에 `계획 파일: <파일명>`(title = 전체 경로)을 보인다. CLI 주입 경로도 같은 필드다 | 채운 값의 소비자다. CLI 승인 화면도 "Plan file: <path>" 를 보인다(§8 F-09) | 요구④·결정⑨ | **SUPERSEDED → D-027 (ΔV1)** | — |
| D-015 | 추적은 **PostToolUse 훅**(`Write\|Edit`, `agent_id` 없는 메인 에이전트, 성공 결과)으로 하고 **Stop 훅에서 비운다**(턴 범위) | 훅은 CLI 도구 실행 안에서 끝나 `ExitPlanMode` 승인 요청보다 항상 먼저다(§8 F-11). 매퍼 ctx 는 소비자 큐 지연에 진다(0215 F-27·F-28) | 설계 | ACTIVE | — |
| D-016 | 계획 파일 읽기 조건 = plans 디렉토리 내부(`~` 확장·정규화·win32 대소문자 무시) · 확장자 `.md` · 일반 파일(심볼릭 링크 제외) · 256 KiB 이하. 하나라도 어기면 파일 폴백을 건너뛴다 | 모델이 준 경로를 읽는 자리라 범위를 좁힌다 | 설계 | ACTIVE | — |
| D-017 | plans 디렉토리 = `<CLAUDE_CONFIG_DIR ?? ~/.claude>/plans`. `CLAUDE_CONFIG_DIR` 는 CLI 실효 env 조회(`envLookup`)로 읽는다. CLI `plansDirectory` 설정은 범위 밖 | 요구④ "~/.claude/plans" + CLI 기본 규칙(§8 F-14) | 요구④ | ACTIVE | — |
| D-018 | 한 턴의 일반 출력 카드(category `file`)는 **파일명이 같으면 1장** — 가장 최근 버전(`publishedAt` 최대)을 처음 나타난 자리에 둔다. 게시 아티팩트(category `artifact`·미지정)는 기존 publicationId 중복 제거만 | 요구⑤. 일반 출력은 출력 디렉토리 루트 직속만이라 한 턴에서 파일명 = 원본(§8 F-19). 자리 고정은 진행 중 카드 순서 흔들림 방지(추론) | 요구⑤ | ACTIVE | — |
| D-019 | 파일 카드는 답변 본문 바로 뒤, 완료 메타(복사·시간) **앞**이다. 진행 중은 본문 → live → 카드 → spark 를 유지한다. Work·Code 공통 | 요구⑥ + 결정⑩ | 요구⑥·결정⑩ | ACTIVE | 0226 D-36 의 "완료 메타는 본문과 카드 사이" 변경(§16) |
| D-020 | 카드 슬롯은 pending 여부와 무관하게 같은 자식 위치다 — 응답 완료 때 카드가 다시 mount 되지 않는다 | `rendering.md:53` "카드의 부모와 위치를 유지하여 응답 완료 때 카드 액션이 다시 mount되지 않게 한다" | 기존 규칙 | ACTIVE | — |
| D-021 (ΔV1) | Code 백그라운드 패널 카드 = **백그라운드 작업만** — Spark 가 세는 작업(실행 중)과 끝난 백그라운드 작업(완료). 도구 종류와 무관(Bash·PowerShell·Agent·Monitor·Workflow·MCP 작업) | 결정⑪ "Spark 백그라운드 작업 N건과 동일해야한다" · 결정⑫ | 결정⑪⑫ | ACTIVE | D-007 대체 |
| D-022 (ΔV1) | 판정 = ¬ambient ∧ (Spark 집합 소속 ∨ 백그라운드 증거) — 작업·호출 공통. 증거는 기존 셸 규칙(0232 D-16)을 모든 종류로 넓힌 7항. 포그라운드 실행·백그라운드가 아닌 호출(실패 포함)·ambient 는 카드가 아니다 | 요구③ "실패 카드도 기록하지 말 것" 과 결정⑪ 을 함께 만족하는 가장 작은 규칙 | 요구③·결정⑪ | ACTIVE | D-009 대체 |
| D-023 (ΔV1) | Spark 집합은 shared 함수 하나(`countedBackgroundTaskIds`)다 — main 의 Spark 개수와 renderer 패널이 같은 함수를 쓴다 | 식이 두 곳에 있으면 "동일" 이 갈라진다 | 설계 | ACTIVE | — |
| D-024 (ΔV1) | 포그라운드 Agent 카드는 목록에서 빠지지만, 인라인 Agent 행의 '열기'(`openSubagentTask`)는 그 Agent 대화록 상세를 연다 | canonical 패널은 legacy 선택을 무시해 '열기'가 목록만 연다(§ΔV1 Δ6 F-23) — 카드를 빼면 도달 경로가 사라진다 | 결정⑫ 파생(추론) | ACTIVE | — |
| D-025 (ΔV1) | ExitPlanMode 출처 순서 = ① 이번 턴 메인 에이전트가 갱신한 plans `.md`(마지막) ② 입력 `planFilePath`(plans `.md` 이고 읽힐 때) ③ 입력 `plan` ④ 서술 ⑤ `''`. 파일 출처(①②)가 있으면 그 파일이 `plan`·`planFilePath` 의 정답이다 | 결정⑬ "비어져있거나 잘못채워져있는 … 폴백으로 보정" | 결정⑬ | ACTIVE | D-011·D-012 대체 |
| D-026 (ΔV1) | 파일 출처로 보정한 값이 입력과 다르면 allow `updatedInput = {...입력, plan, planFilePath}` 로 CLI 에 돌려준다. 같으면 입력 그대로. 서술(④)은 CLI 로 보내지 않는다 | 결정⑭ "CLI에도 돌려줌". 서술은 계획 파일이 아니라 CLI 계획 파일에 남기지 않는다(추론) | 결정⑭ | ACTIVE | D-013 대체 |
| D-027 (ΔV1) | 계획 패널 UI 와 `PlanReviewRequest` 는 바꾸지 않는다 | 결정⑬ "그곳은 수정할 필요가 없다" | 결정⑬ | ACTIVE | D-014 대체 |
| D-028 (ΔV1) | 입력이 파일 출처와 같으면(정규화 비교) 요청 본문·CLI 응답이 기존과 같다 | 진술⑮ — Claude API·HuggingFace 는 문제가 없다 | 진술⑮ | ACTIVE | — |
| D-029 (ΔV1) | 엔진&모델 제목 옆 개수 = 화면에 그린 카드 수(`agents.length`) — settings·runtime(배포 LLM) 공통 | 요구⑦ "카드 숫자와 동기화되어야 함" | 요구⑦ | ACTIVE | 0226 D-24 변경(§ΔV1 Δ7) |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-020 (신규 handoff, 이전 ACTIVE 결정 없음).
- 변경된 결정: 없음(이 handoff 안). 다른 handoff 결정의 변경은 §16 에 둔다 — 0248 D-010(상태 라벨) · 0231 R-19/R-20(패널 표시) · 0215 D-001(체인) · 0226 D-36(메타 위치).
- 기존 ACTIVE 중 유지: 0215 D-004·D-026(경로 **추측** 금지 — 이번 폴백은 관측된 도구 경로만 쓴다) · 0215 D-031(순서 대기 축 폐기 — 매퍼 대기를 되살리지 않는다) · 0232 D-16 · 0224 D-041.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001 ↔ AC1 → 라벨만 바꾸고 종류·액션 유지를 함께 단언한다 → 일치.
  - D-002·D-003 ↔ AC2(3종 각각 · 같은 class) → 일치. D-004 ↔ AC3·AC5 → 열람 해제·열람 중 미생성·늦은 신호 무시 → 일치. D-005 ↔ AC4(마지막 사유) → 일치. D-006 ↔ AC2 의 수단이 app 구독 함수 경유 → 일치.
  - D-007·D-009 ↔ AC6(양성)·AC7(음성) → 일치. D-008 ↔ AC7 이 **패널 투영**만 단언하고 canonical 상태 삭제를 요구하지 않는다 → 일치. D-010 ↔ AC 없음 → 의도한 부재.
  - D-011·D-012 ↔ AC9·AC10 → 일치. D-013 ↔ AC12(updatedInput = 원래 입력) → 일치. D-014 ↔ AC13 → 일치. D-015 ↔ AC11(서브에이전트·이전 턴 제외)·AC14(배선) → 일치. D-016·D-017 ↔ AC11 → 일치.
  - D-018 ↔ AC15·AC16 → 일치. D-019 ↔ AC17 → 일치. D-020 ↔ AC 없음 → SSR 환경에 mount 관측 수단이 없다(0215 D-020 OPEN). §10 EP-06 `실패 의미` 에 적었다.

- **ΔV1(사용자 결정 변경·추가 요구)**: SUPERSEDED 6(D-007·D-009·D-011·D-012·D-013·D-014) — 각각 D-021·D-022·D-025·D-025·D-026·D-027 이 대체한다. 신설 D-021~D-029. D-008·D-010 은 ACTIVE 유지(Spark 개수 식은 그대로이고 패널이 그 집합에 맞춰진다).
- **`ACTIVE 결정 ↔ AC` 대조(ΔV1)**: 충돌 0.
  - D-021·D-022 ↔ AC6′(양성)·AC7′(음성, 같은 state)·AC19(등식) → 일치. D-023 ↔ AC19 의 main·renderer 두 관측 → 일치. D-024 ↔ AC20 → 일치. D-008 ↔ AC7′ 이 투영만 단언 → 일치.
  - D-025 ↔ AC9′·AC10′ → 일치. D-026 ↔ AC9′·AC10′ 의 `updatedInput` 단언 + 서술 미반환 → 일치. D-027 ↔ AC 없음 → 의도한 부재(AC13 폐기). D-028 ↔ AC21 → 일치. D-015·D-016·D-017 ↔ AC11·AC14′ → 일치.
  - D-029 ↔ AC22 → 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구④ 가 원인을 겨냥하는가 | **타당** — CLI 는 **자기 기대 경로**에 계획 파일이 있을 때만 `plan`·`planFilePath` 를 함께 싣는다. 다른 경로에 쓰거나 주입이 깨지면 둘 다 빈다 | §8 F-09 (CLI 2.1.286 `hEe`) |
| 0215 의 서술 폴백으로 이미 충족되는가 | **아니다** — 서술은 계획 파일 본문이 아니고, `planFilePath` 를 만들지 못한다 | `plan-text.ts:21-24` |
| 0215 D-004 "경로 추측 금지" 와 충돌하는가 | **충돌 없음** — 추측(slug 재현)이 아니라 **관측된** `Write`·`Edit` 경로다. 0215 비범위 "파일 읽기"만 대체한다 | 0215 plan §3 D-004·§6 |
| 매퍼 ctx 로 추적하면 되는가 | **아니다** — `can_use_tool` 은 즉시 발화하고 매퍼는 소비자 큐에서 늦게 돈다(0215 F-27·F-28). 같은 메시지의 `Write`+`ExitPlanMode` 에서 진다 | §8 F-11·F-16 |
| 요구② "도구 호출 승인"이 3종 전부인가 | **사용자 결정으로 닫음** — "응답대기 전체" | 결정⑦ |
| 요구③ 이 상태 삭제까지 요구하는가 | **아니다(추론)** — 카드 비표시로 사용자 관측은 같다. 상태를 지우면 listen 대기가 바뀐다 | §8 F-07 · D-008 |
| 요구⑤ 의 "같은 파일" 을 무엇으로 아는가 | 일반 출력은 출력 디렉토리 **루트 직속**만 캡처되고 filename = realpath basename → 한 턴에서 파일명이 곧 원본이다 | §8 F-19 |
| 요구⑥ 의 "구분" 은 무엇인가 | 완료 메타 행이 hover 전 `opacity-0` 이라 답변과 카드 사이에 빈 줄로 보인다 | §8 F-21 |
| 더 작은 해법 | ① i18n 값 2줄 ② 기존 완료 표시 경로 일반화 ③ 투영 술어 1곳 ④ 훅 1조각 + 체인 1단 ⑤ 투영 함수 1곳 ⑥ JSX 순서 1곳 — 구조 신설 없음 | §9 |

- 사용자에게 올릴 결정: **없음**(결정⑦~⑩ 으로 닫힘).
- 코드 조사로 닫은 사실: §8 F-01 ~ F-22.

## 5. 동작 / 사용자 흐름

```text
[다른 세션 S 에서 에이전트가 승인·질문·계획 승인을 요청]
  → S 를 보고 있지 않으면 nav 의 S 아이콘이 Orca 파랑(굵게)
  → S 를 열면 원래 색·굵기로 복귀(응답 전이라도)
  ↘ S 를 보고 있으면 표시하지 않는다

[custom 모델이 plan 모드에서 ~/.claude/plans/x.md 를 Write/Edit → ExitPlanMode(plan 없음)]
  → 승인 카드 + 계획 패널에 x.md 본문, 그 위에 "계획 파일: x.md"
  → 승인/거부/수정 흐름은 그대로, CLI 로 가는 응답도 그대로
  ↘ 이번 턴에 계획 파일 쓰기가 없으면 0215 서술 폴백 → 그마저 없으면 "계획 본문을 가져오지 못했습니다"

[Code 백그라운드 패널]
  → Bash·PowerShell(백그라운드)·Agent 카드만. Read 실패·Workflow·MCP 등은 카드 없음

[Work 한 턴에서 report.md 를 3번 갱신]
  → 답변 본문 끝에 report.md 카드 1장(최신 버전) → 그 아래 복사·시간 행
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 비열람 S 에 `permission.requested`(3종 중 하나) | S → `awaiting-response` | S 아이콘 Orca 파랑·굵게 |
| 열람 중 S 에 같은 요청 | 표시 없음 | 변화 없음(카드는 화면에 있다) |
| 표시된 S 를 연다 | 표시 삭제 | 원래 색·굵기. 다시 나가도 되살아나지 않음 |
| 비열람 S 가 정상 완료 | S → `completed`(마지막 사유) | 같은 파랑·굵게 |
| S 삭제 | 표시 삭제 | 행 없음 |
| `plan` 비고 이번 턴 plans `.md` 쓰기 있음 | 파일 본문·경로로 채움 | 패널 본문 + "계획 파일: <이름>" |
| `plan` 비고 쓰기 없음 / 파일 읽기 실패 | 서술 폴백 → 없으면 `''` | 0215 동작 그대로 |
| Stop(턴 종료) | 추적 셀 비움 | 다음 턴은 새 쓰기만 폴백 출처 |
| 같은 일반 출력 파일 v1→v2→v3 캡처 | 카드 1장, 최신 버전 | 카드 1장(첫 자리) |
| 응답 완료(pending→done) | 카드 슬롯 유지, 메타가 카드 뒤에 붙음 | 카드가 다시 그려지지 않음 |

### 파생 UX / 엣지케이스

- loading / empty / error: 백그라운드 패널에 표시할 카드가 0이면 기존 `background.empty` 문구. 계획 파일 읽기 실패는 조용히 다음 폴백으로 간다(별도 오류 문구 없음 — 0215 실패 표시가 마지막 단계).
- cancel / retry / close / restart: 승인 요청이 SDK 취소로 해소돼도 nav 표시는 열 때까지 남는다(결정⑧). 앱 재시작 시 nav 표시는 복원하지 않는다(D-004).
- concurrency / multi-session: 추적 셀은 **채널(세션) 스코프**다 — 세션 간 교차 없음. 서브에이전트 쓰기는 무시한다.
- keyboard / a11y / theme: 신규 문구 1개(계획 파일 캡션). 파랑은 기존 `--color-selected` 토큰이라 light/dark 모두 정의돼 있다(`tokens.css:70`·`:240`).
- 외부환경: LiteLLM/OpenRouter 실환경 확인은 사람 실기(§19, 비차단).

## 6. 범위 / 비범위

- **범위**: 로그인 프리 상태 라벨(ko·en) · nav 응답 대기 표시(완료와 통합 상태) · Code 백그라운드 패널 종류 필터 · `ExitPlanMode` 계획 파일 폴백 + 계획 파일 캡션 · 일반 출력 카드 턴 내 중복 제거 · 카드 위치(work·code) · 관련 문서 6파일 10곳(§18).
- **비범위**: canonical 백그라운드 상태·journal 변경(D-008) · Spark 백그라운드 개수(D-010) · CLI `plansDirectory` 설정·settings 이외 경로의 `CLAUDE_CONFIG_DIR`(D-017) · CLI 로 채운 plan 반환(D-013) · 게시 아티팩트(category `artifact`)의 같은 파일 재게시 합치기 · 턴을 넘는 카드 합치기 · renderer DOM 테스트 환경 도입(0215 D-020 OPEN) · nav 표시 앱 재시작 복원.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `PlanReviewRequest.planFilePath` 필드명 | **예 — main→renderer 계약** | **지금 확정**(D-014, optional) |
| nav 표시 상태 형상(`unseenAttention` Map) | 아니오 — renderer 휘발 상태(영속 없음) | 지금 확정 |
| `plansDirectory` 지원 | 아니오 — 같은 판정 함수에 디렉토리 하나 추가 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 로그인 프리 행의 상태가 목록·상세에서 '연결됨'(ko)·'Connected'(en)다. 종류 '기본 제공'·인증 액션 0개는 그대로다 | 카탈로그 값 단언(ko·en) + `CustomizeList`·`ProviderDetail` SSR 에 `>연결됨</span>` 존재·`인증 불필요` 부재·`기본 제공` 존재 | `orca:provider:list` → `providerRowMeta` → `CustomizeList`/`ProviderDetail` → `tr(statusKey)` |
| R-02 | AT-02 / AC2 | 열람 중이 아닌 세션에 `permission.requested`(tool_approval·ask_question·plan_review **각각**)가 오면 그 행 아이콘이 `data-state="awaiting-response"` 이고 완료 표시와 **같은 class**(`text-selected`·`[stroke-width:40]`)다 | 통합: `ingestChatEvent(permission.requested)` 3종 it.each → `unseenAttention.get(s)==='awaiting-response'` → `SessionRow` SSR class·data-state | `permission.requested` → `chatStore.receive` → 구독 → `sessionsActions.markAwaitingResponse` → `SessionRow` |
| R-02 | AT-03 / AC3 | 열람 중 세션의 요청은 표시를 만들지 않는다. 표시된 세션을 열면 해제되고 다시 나가도 되살아나지 않는다 | 통합: `setViewedSession('s')` 후 요청 → 표시 없음 / 표시 후 `setViewedSession('s')`→`(null)` → 표시 없음 | 동일 + `useSessionCompletion` 열람 세션 |
| R-02 | AT-04 / AC4 | 완료 표시는 그대로 동작하고(`unseen-complete`), 두 사유가 겹치면 마지막 사유가 남는다. 삭제는 표시를 지운다 | 단위: `markCompleted`→`markAwaitingResponse` 순서 → 마지막 사유 / 역순 / `remove('s')` 후 부재 / 같은 사유 반복은 state identity 불변 | `sessionsStore` |
| R-02 | AT-05 / AC5 | 미지 세션·`sessionId` 없는 요청·폴백 라우팅된 요청·구독 해제 후 요청은 표시를 만들지 않는다 | 통합: `sessionId:'unknown'`·생략·`unsubscribe()` 후 → Map 크기 0 | `chatStore.receive` 라우팅 가드 |
| R-03 | AT-06 / AC6 → **ΔV1 AC6′** | Code 백그라운드 패널이 Bash·PowerShell(백그라운드 증거 있음)·Agent·Task 호출과 그 작업을 카드로 보인다 | SSR: 네 도구 fixture → `data-background-call`/`data-background-task` 존재 | 백그라운드 이벤트 → `applyBackgroundEvent` → `projectBackgroundPanel` → `CanonicalBackgroundContent` |
| R-03 | AT-07 / AC7 → **ΔV1 AC7′** | 다른 도구의 호출(실패·`launchFailure`·`awaitingTask` 포함)과 그 작업(Workflow·Monitor·MCP·종류 미상 snapshot)은 카드·그룹 개수·선택 상세에 나타나지 않는다 | SSR: `Read` 실패 호출·`Workflow` 실패/launch 실패·`mcp__x` 작업·`taskType` 없는 snapshot 작업 → 해당 data 속성 0건 + 그룹 count 에 미포함. **양성 짝 AT-06 과 같은 state 에서** 단언 | 동일 |
| R-03 | AT-08 / AC8 → **ΔV1 AC8′** | 포그라운드로만 실행한 셸은 계속 제외되고 Agent 카드는 대화록 상세를 연다(회귀) | 기존 셸·Agent 케이스 green 유지 | 동일 |
| R-04 | AT-09 / AC9 → **ΔV1 AC9′** | 입력에 `plan` 이 없고 같은 턴에 메인 에이전트가 `Write`/`Edit` 로 plans 디렉토리 `.md` 를 갱신했으면 승인 요청의 `plan` = 파일 본문, `planFilePath` = 그 경로다 | 단위: `makeCanUseTool` 에 `getPlanFile` 주입 → `requestApproval` 인자 `request.plan`·`request.planFilePath` | CLI `can_use_tool` → `makeCanUseTool` → `requestApproval` → `permission.requested` |
| R-04 | AT-10 / AC10 → **ΔV1 AC10′** | 입력 `plan` 이 있으면 그것과 입력 `planFilePath` 가 쓰이고 파일은 읽지 않는다. 파일 폴백이 서술보다 먼저다. 셋 다 없으면 `plan=''`·`planFilePath` 부재 | 단위: 체인 표 4행(`resolvePlanReview`) + `getPlanFile` 호출 0회(입력 plan 있음) | 동일 |
| R-04 | AT-11 / AC11 | 서브에이전트(`agent_id`) 쓰기·plans 밖·`.md` 아님·`tool_response.isError`·Stop 이후(이전 턴) 쓰기는 출처가 아니다. 256 KiB 초과·심볼릭 링크·부재 파일은 건너뛴다 | 단위: 훅 콜백·판정·reader 표 | PostToolUse/Stop 훅 → 셀 → reader |
| R-04 | AT-12 / AC12 → **SUPERSEDED → AC21(ΔV1)** | 승인 응답의 `updatedInput` 은 원래 입력과 같다(채운 값 미포함) | 단위: allow 결과 `updatedInput === input`(참조)·`plan` 키 부재 | `makeCanUseTool` allow 분기 → SDK control_response |
| R-04 | AT-13 / AC13 → **SUPERSEDED — 폐기(D-027)** | 승인 대기 중 `planFilePath` 가 있으면 Plan 타일 본문 위에 `계획 파일: <파일명>`(title=전체 경로)이 보이고, 없으면 그 줄이 없다 | SSR: `pendingPlanReview.planFilePath` 시드 → `data-plan-file-path` 1건·파일명·title / 미지정 → 0건 | `permission.requested` → reducer `pendingPlanReview` → `PlanTileContent` |
| R-04 | AT-14 / AC14 → **ΔV1 AC14′** | production 어댑터가 만든 PostToolUse 훅과 `canUseTool` 이 **같은 셀**을 쓴다 — 훅에 `Write` 입력을 주면 `ExitPlanMode({})` 요청 본문이 그 파일이다. Stop 훅 뒤에는 서술/빈 값으로 돌아간다 | 통합: SDK `query` 모킹으로 `options.hooks`·`options.canUseTool` 포획, `CLAUDE_CONFIG_DIR`=임시 디렉토리, 실제 파일 | `ClaudeAdapter.sendMessage` → `query(options)` |
| R-05 | AT-15 / AC15 | 한 턴에서 같은 일반 출력 파일(category `file`, 같은 filename)의 카드가 여러 버전이어도 1장이고, 그 카드는 최신 버전(`publishedAt` 최대)이며 처음 나타난 자리다 | SSR: v1·다른 파일·v2·v3 순 parts → `data-artifact-preview` 순서·개수·publicationId | `output.captured`/`tool.call.completed` → artifact part → `partsArtifacts` → `ArtifactCards` |
| R-05 | AT-16 / AC16 | 게시 아티팩트(category `artifact`·미지정)·다른 파일명·다른 턴의 카드는 합쳐지지 않는다. '모두 저장' 대상도 같은 목록이다 | 단위 `partsArtifacts` 표 + 기존 턴별 보존 케이스 green | 동일 |
| R-06 | AT-17 / AC17 | 완료 턴: 본문 → 카드 → 완료 메타. 진행 중: 본문 → live → 카드 → spark(1개). work·code 공통 | SSR `indexOf` 순서 단언 2 kind × pending 2 상태 | `Exchange` → `AssistantTurn` |
| 전체 | AT-18 / AC18 | 게이트: lint 0 error · typecheck 3종 0 · 영향 vitest(비-DB) green · doc inventory `--check` · trailer 파싱 | 명령 산출(파일/케이스 수)을 관측값으로 기록 | §7-A 운영 gate |

### AC 검증 주의사항

- 기존 테스트 재사용(실재 확인): `useSessionCompletion.test.ts` 5케이스(`ingestChatEvent` 통합 틀) · `navSections.render.test.ts:324-` 'only the non-viewed completed icon uses selected blue' · `plan0215.render.test.ts` store 모킹 하네스 · `claude.plan-narrative.test.ts` SDK `query` 포획 하네스 · `TurnOutputCards.test.ts:80-123`. **`TurnOutputCards.test.ts:115` 'puts completed metadata before cards' 는 D-019 로 뒤집힌다** — 삭제가 아니라 순서를 반대로 단언한다.
- **뒤집히는 기존 단언(전수)**: '인증 불필요' 6줄(4파일, §8 전수) · `CanonicalBackgroundContent.render.test.ts` 의 비대상 도구 케이스 4건 — :136(라벨 검사 중 `toolName='Workflow'`) · :340(Workflow 실패 카드) · :537(작업 없는 실패 호출 카드)은 **카드 부재로 뒤집고, 각 케이스가 검사하던 다른 의미(라벨·선택 가능한 실패 카드)는 대상 도구 fixture(`Agent` launch 실패 등)로 옮긴다**. :373(`mcp__report`)은 음성 단언뿐이라 카드가 사라지면 **공허하게 green** 이 된다 — 출력 참조 은닉 의도를 `Agent`/백그라운드 `Bash` fixture 로 옮긴다. `taskType`·호출 없는 작업 fixture 를 `renderState`·`renderHeader` 로 그리는 케이스(:323·:470·:752 등)는 fixture 를 실제 형상(`taskType:'local_agent'` 또는 `Agent` 호출)으로 고친다. `BackgroundTaskCard` 를 직접 그리는 케이스(:425·:444)는 투영을 타지 않아 불변.
- 사람 실기 항목: nav 파랑의 시각 · 계획 파일 캡션 시각 · 카드 위치 시각 · LiteLLM/OpenRouter 실환경(§19). 판정 로직은 전부 테스트로 내렸다.
- N회/총량 기준: AC10 "`getPlanFile` 호출 0회" — sink 의 프로덕션 호출부는 `makeCanUseTool` ExitPlanMode 분기 1곳(신설)뿐이다. 관측 지점(주입 spy)이 그 1곳을 모형한다.
- 총량/0건 기준: AC7 은 음성이다. 제거 대상 = 종류 미상·비대상 도구, 허용 대상 = 셸·에이전트. **같은 state 에 양성(AC6) 항목을 함께 넣어** "전부 사라짐" 과 구분한다. AC5 도 같은 파일에서 양성 AC2 와 짝이다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — `INDEX.md` 에 이어갈 선행 handoff 가 없다.
- 기준 V 상속 근거: 없음. 아래 `INHERITED` 노드는 다른 handoff 의 현재 동작을 **회귀 대상으로만** 가리킨다(출처 = `origin/main@954e6fff` 의 해당 plan).
- `SUPERSEDED` 로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: R.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 … R-06 | R | §7 | NEW | — |
| AT-01 … AT-18 | AT | §7 | NEW | — |
| SD-01 | SD | §5 상태표 — 응답 대기·완료 표시 수명(표시·열람 해제·삭제·마지막 사유) | NEW | — |
| SD-02 | SD | §5·§9 — 계획 파일 추적 수명(쓰기 기록 → 승인 요청 읽기 → Stop 비움) | NEW | — |
| AR-01 | AR | §9 B — chatStore 구독 → app 계층 → sessionsStore (feature 경계) | NEW | — |
| AR-02 | AR | §9 D — 어댑터 훅 조각과 `canUseTool` 의 셀 공유 + plans 디렉토리 env 해석 | NEW | — |
| AR-03 | AR | §10 — `PlanReviewRequest.planFilePath` main→renderer 운반(broker·reducer spread) | NEW | — |
| AR-04 | AR | §9 C — `projectBackgroundPanel` 이 모든 소비처(목록·개수·선택·지우기)의 단일 투영 | NEW | — |
| MD-01 | MD | §11 — `sessionsStore` 주의 Map(`markCompleted`·`markAwaitingResponse`·열람·삭제) | NEW | — |
| MD-02 | MD | §11 — `plan-file.ts` 경로 판정·reader·훅 | NEW | — |
| MD-03 | MD | §11 — `resolvePlanReview` 체인 | NEW | — |
| MD-04 | MD | §11 — `backgroundPanelFamily` 판정 | NEW | — |
| MD-05 | MD | §11 — `partsArtifacts` 파일 단위 합치기 | NEW | — |
| R-0226-42 | R | 0226 R42 — 사용자→본문→카드→spark 1개 · 늦은 카드 원래 턴 · 이전 턴 ref 보존 | INHERITED | `docs/handoff/0226-cowork-transcript-viewer/plan.md` §18.2 (메타 위치 문장 제외 — R-06 이 대체) |
| R-0224-37 | R | 0224 D-037·D-041 — 비열람 정상 완료의 굵은 파랑, 열면 복귀 | INHERITED | `docs/handoff/0224-work-agent-layer/plan.md` D-037·D-041 |
| R-0215-01 | R | 0215 R-01 — 서술 폴백·본문 미해소 실패 표시 | INHERITED | `docs/handoff/0215-plan-panel-and-model-selection-bugs/plan.md` §7 |
| R-0232-16 | R | 0232 D-16·D-03 — 포그라운드 셸 제외 · Agent 카드 대화록 상세 | INHERITED | `docs/handoff/0232-background-transcript-ux/plan.md` §3 |
| R-0248-04 | R | 0248 R-04 — 로그인 프리 행 종류 '기본 제공'·인증 액션 0개 | INHERITED | `docs/handoff/0248-login-free-plugin-auth/plan.md` §7 (상태 라벨 제외 — R-01 이 대체) |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | ko/en 카탈로그 → `providerRowMeta.statusKey` → `CustomizeList`·`ProviderDetail` → `tr()` | SSR 텍스트 | not selected — 렌더 문자열 직접 관측 | EP-01 ①~⑤ (5) |
| VP-02 | R-02 ↔ AT-02·AT-03·AT-05 | REQUIRED | `ingestChatEvent` → `receive` 의 `permission.requested` → 구독 함수 → `markAwaitingResponse` → `unseenAttention` → `SessionRow` | Map 값 + SSR data-state/class | **required** — app effect 안의 구독 배선은 SSR 에서 실행되지 않는다(0215 D-021 선례). 변이 **M-B1**(`useSessionCompletion.ts` effect 를 완료 전용 구독으로) / **M-B2**(`chatStore.ts` `receive` 의 `permission.requested` 통지 제거) / **M-B3**(`sessionsStore.ts` `markAttention` 의 열람 중 검사 제거) | EP-02 ①②③④⑥⑧ (6) |
| VP-03 | SD-01 ↔ ST-01 (AT-03·AT-04) | REQUIRED | 요청 → 표시 → 열람 해제 → 재요청 / 완료↔대기 교차 / 삭제 | 연속 상태값 | not selected — 상태 직접 관측 | EP-02 ④⑤⑥⑦ (4) |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | chat feature export → app 구독 함수 → sessions action (교차 import 없음) | lint boundaries 0 error + VP-02 통합 green | not selected — lint 가 경계, VP-02 가 값 | EP-02 ③ (1) |
| VP-05 | MD-01 ↔ UT-01 | REQUIRED | — (순수 store) | `markCompleted`·`markAwaitingResponse`·`setViewedSession`·`remove` 결과 + identity | not selected | EP-02 ④⑤⑥⑦ (4) |
| VP-06 → ΔV1 VP-06′ | R-03 ↔ AT-06·AT-07·AT-08 | REQUIRED | 백그라운드 이벤트 → `applyBackgroundEvent` → `projectBackgroundPanel` → `CanonicalBackgroundContent` 목록·그룹 count·상세 | SSR data 속성·count 텍스트 | **required** — AC7 은 0건 단언이다. 변이 **M-C1**(`canonicalBackground.ts` `backgroundPanelFamily` 가 항상 `'agent'`) / **M-C2**(같은 파일 호출 술어를 AS-IS 로 원복) / **M-C3**(같은 파일 작업 술어를 AS-IS 로 원복) / **M-C4**(같은 함수에서 `Task` 를 비대상으로) | EP-03 ①~⑥ (6) |
| VP-07 → ΔV1 VP-07′ | MD-04 ↔ UT-02 | REQUIRED | — (순수 판정) | `toolName × taskType × 증거` 표 반환값 | not selected | EP-03 ①② (2) |
| VP-08 → ΔV1 VP-08′ | AR-04 ↔ IT-02 | REQUIRED | 같은 state 로 목록·그룹 count·선택(`kind:'call'` 숨김 호출)·`dismissCompletedBackgroundItems` | 숨김 호출 선택 → `selectedCall` 부재, count 미포함, 지우기 목록 미포함 | not selected — 투영 반환 직접 관측 | EP-03 ③~⑥ (4) |
| VP-09 → ΔV1 VP-09′ | R-04 ↔ AT-09·AT-10·AT-11·AT-12·AT-13 | REQUIRED | PostToolUse(Write\|Edit) → 셀 → `getPlanFile` → `resolvePlanReview` → `requestApproval(plan_review)` → broker spread → reducer → `PlanTileContent` | `requestApproval` 인자 + allow 결과 + SSR 캡션 | **required** — 형제 슬롯(`plan`·`planFilePath`)과 체인 순서가 서로 다른 계약이다. 변이 **M-D1**(`plan-text.ts` 서술을 파일보다 앞에) / **M-D2**(`plan-text.ts` 입력 plan 출처일 때도 `planFilePath` 를 파일 경로로) / **M-D3**(`claude.ts` allow `updatedInput` 에 채운 값 동봉) / **M-D4**(`claude.ts` request 에서 `planFilePath` 누락) | EP-04 ④⑤⑥⑨ (4) |
| VP-10 | SD-02 ↔ ST-02 (AT-11·AT-14) | REQUIRED | 쓰기 a → 쓰기 b(마지막 승) → 서브에이전트 쓰기(무시) → ExitPlanMode → Stop → ExitPlanMode | 연속 호출의 요청 본문 | **required** — 수명 경계. 변이 **M-D5**(`plan-file.ts` Stop 비움 제거) / **M-D6**(`plan-file.ts` `agent_id` 검사 제거) | EP-04 ①② (2) |
| VP-11 → ΔV1 VP-11′ | AR-02 ↔ IT-03 (AT-14) | REQUIRED | `ClaudeAdapter.sendMessage` → `mergeHooks(… makePlanFileHook …)` + `makeCanUseTool({getPlanFile})` → 같은 셀 · `contextEnv('CLAUDE_CONFIG_DIR')` | 포획한 훅·`canUseTool` 실행 결과 | **required** — 배선 존재 oracle. 변이 **M-D7**(`claude.ts` 훅 조각을 `mergeHooks` 에서 제거) / **M-D8**(`claude.ts` `canUseTool` 에 다른 셀 전달) / **M-D9**(`claude.ts` `getPlanFile` 인자 제거) | EP-04 ③ (1) |
| VP-12 | MD-02 ↔ UT-03 | REQUIRED | — (순수 판정 + fs reader) | 경로 판정 표 · reader 반환(크기·링크·부재) | not selected | EP-04 ①② (2) |
| VP-13 → ΔV1 VP-13′ | MD-03 ↔ UT-04 | REQUIRED | — (순수 체인) | 4단 표 반환 `{plan, planFilePath?}` | not selected — 순서 변이는 VP-09 M-D1 이 갖는다 | EP-04 ④ (1) |
| VP-14 (ΔV1 폐기) | AR-03 ↔ IT-04 | REQUIRED | `createApprovalRequester` spread(`approval.ts:53-54`) → `permission.requested` → reducer spread(`chatReducer.ts:1100-1103`) | 이벤트 payload·`pendingPlanReview.planFilePath` | not selected — 필드 직접 관측 | EP-04 ⑦⑧ (2) |
| VP-15 | R-05 ↔ AT-15·AT-16 | REQUIRED | artifact part → `turn.messages` → `partsArtifacts` → `ArtifactCards`(목록·'모두 저장') | SSR 카드 id·순서·개수 | **required** — 버전·자리가 형제 슬롯이다. 변이 **M-E1**(`parts.ts` 첫 버전 유지) / **M-E2**(`parts.ts` 마지막 자리에 배치) / **M-E3**(`parts.ts` category 무시 합치기) | EP-05 ①② (2) |
| VP-16 | MD-05 ↔ UT-05 | REQUIRED | — (순수) | `partsArtifacts` 표 반환 | not selected | EP-05 ① (1) |
| VP-17 | R-06 ↔ AT-17 | REQUIRED | `Exchange` → `AssistantTurn` 자식 순서 | SSR `indexOf` 순서 4조합 | not selected — 순서를 직접 관측한다(옛 순서로 되돌리면 그 단언이 red) | EP-06 ① (1) |
| VP-18 | R-0226-42 ↔ AT(0226 AT42) | REGRESSION | 동일 경로 | `TurnOutputCards.test.ts` 기존 케이스(spark 1개·턴별 보존·pending fallback) green | not selected | EP-06 ① (1) |
| VP-19 | R-0224-37 ↔ AT(0224) | REGRESSION | `turn.ended` → 구독 → `markCompleted` → `SessionRow` | `useSessionCompletion.test.ts`·`navSections.render.test.ts` 기존 의미 green(형상만 Map) | not selected | EP-02 ②⑤ (2) |
| VP-20 | R-0215-01 ↔ AT(0215 AT-01~03) | REGRESSION | 파일 폴백 없음 → 서술 → `''` 실패 표시 | `claude.canusetool.test.ts` 0215 케이스·`plan0215.render.test.ts` green | not selected | EP-04 ④ (1) |
| VP-21 → ΔV1 VP-21′ | R-0232-16 ↔ AT(0232) | REGRESSION | 셸·Agent fixture → 패널 | 기존 셸 제외·Agent 대화록 케이스 green | not selected | EP-03 ①② (2) |
| VP-22 | R-0248-04 ↔ AT(0248 AC11·AC12) | REGRESSION | 로그인 프리 → 목록·상세 | '기본 제공'·인증 액션 0개 단언 green | not selected | EP-01 ③~⑤ (3) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree `app/` | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run <영향 스위트>` | 이번 변경이 유발한 실패만 blocking |
| doc inventory | `docs/**` 6파일 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 동일 |
| message-bus | plan·INDEX·커밋 | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| F-01 '인증 불필요' 는 `skills.provider.status.loginFree` 값 1곳이고 en 은 'No sign-in required' | `ko.ts:223` · `en.ts:223` · 소비 `providerRows.ts:38` |
| F-02 nav 완료 표시 = `sessionsStore.unseenCompletedIds`(Set) → `SessionRow` 아이콘 `text-selected` + `[stroke-width:40]`, 열람 해제·삭제 정리 | `sessionsStore.ts:15`·`:160`·`:240-259` · `SessionRow.tsx:59-67` |
| F-03 chat→sessions 연결은 app 1곳, `turn.ended` 만 정확 라우팅 가드 뒤 통지 | `useSessionCompletion.ts:6-7` · `chatStore.ts:754-760` |
| F-04 `permission.requested` 는 `receive` 의 `default` 로 RECV_EVENT 만 간다. 3종 모두 이 이벤트다 | `chatStore.ts:792` · `chatReducer.ts:1077-1121` |
| F-05 `--color-selected` = `#1f68bd`(light)·`#8ec1ff`(dark) — 0224 D-037 의 "selected 파랑" | `tokens.css:70`·`:240` |
| F-06 패널 투영 SSOT = `projectBackgroundPanel`. 비셸 작업은 무조건 표시, 호출은 `failed`·`launchFailure`·`awaitingTask` 면 도구와 무관하게 표시 | `canonicalBackground.ts:162`·`:205-221` |
| F-07 canonical 상태는 **모든** tool_use/tool_result 를 호출로 기록하고 listen 대기·개수가 이 상태를 읽는다 | `claude-background.ts:279-330` · `background-task.ts:571-600` · `background-tasks.ts:193-202` |
| F-08 백그라운드 패널은 Code 전용이다 | `rightPanelTiles.ts` `RIGHT_PANEL_POLICY.work.visibleIds=['task']`·`code=['plan','subagent','diff']` |
| F-09 CLI 2.1.286(SDK 0.3.286 동봉, main 선언 버전)은 **기대 경로 파일이 있을 때만** `plan`·`planFilePath` 를 함께 주입한다 | 바이너리 `case Ud:{let g=hEe(r);return OKe(s),g!==null?{...n,...g}:n}` · `function hEe(e){let n=uw(e);Zg(n);let r=w2(e);return r!==null?{plan:r,planFilePath:n}:null}` |
| F-10 CLI 실행부는 `updatedInput` 의 주입 필드가 원본과 같으면 지우고, 다르면 `plan` 을 **자기 기대 경로에 기록**하고 tool_result 를 "(edited by user)" 로 쓴다 | 2.1.220 `call`: `c="plan"in e…;if(c!==void 0&&l)…write(l,c)` · `planWasEdited:c!==void 0` / 2.1.286 `Hft=new Map([[Ud,new Set(["plan","planFilePath"])]])`·`Failed to persist plan to` |
| F-11 CLI 도구 실행기는 비동시성 도구 실행 중 다른 도구를 시작하지 않는다 — `Write`·`Edit`(비동시성)의 PostToolUse 가 끝나야 `ExitPlanMode`(`isConcurrencySafe:true`)가 시작한다 | 2.1.286 `canExecuteTool(e){let o=this.tools.filter((n)=>n.status==="executing");return o.length===0\|\|e&&o.every((n)=>n.isConcurrencySafe)}` |
| F-12 훅 입력 `agent_id` 는 서브에이전트에서만 있다 — "Use this field (not agent_type) to distinguish subagent calls" | SDK 0.3.286 `sdk.d.ts` `BaseHookInput` |
| F-13 파일 쓰기 도구는 `Write`·`Edit` 뿐(MultiEdit 없음). CLI 는 `Edit` 를 "Update", plans 경로면 "Updated plan" 으로 표시한다 | 0.3.286 `sdk-tools.d.ts` `ToolInputSchemas` · 바이너리 `function efe(e){…startsWith(Ll()))return"Updated plan";…return"Update"}` |
| F-14 CLI plans 디렉토리 = `settings.plansDirectory`(프로젝트 루트 내부) 없으면 `<CLAUDE_CONFIG_DIR ?? ~/.claude>/plans` | 바이너리 `plansDirectory … "defaults to ~/.claude/plans/"` · 0215 F-24b |
| F-15 Orca 의 CLI 실효 env 조회 = turn env → settings env → process env | `claude-context-policy.ts:54-65` · `claude.ts:385` `contextEnv` |
| F-16 선례 — PostToolUse `Write\|Edit` 훅 · 순수 판정 + fs reader 포트 · 메인 루프 `agent_id` 스킵 · 훅 조각 병합 | `claude-output-files.ts:236-241` · `edit-preview.ts:58-104` · `claude-adapt.ts:217` · `claude-adapt.ts:283-296` |
| F-17 승인 broker 와 reducer 는 `request` 를 spread 한다 — 선택 필드가 renderer 까지 보존된다 | `approval.ts:53-54` · `chatReducer.ts:1100-1103` |
| F-18 일반 출력 캡처는 Work 전용이고 `Write`·`Edit` 마다 1회 — 바이트가 바뀌면 새 publication 이 생긴다 | `send.ts:331` · `claude-output-files.ts:201-210` · `service.ts:129-170` |
| F-19 일반 출력은 출력 디렉토리 **루트 직속**만, filename = realpath basename | `files.ts:186-196`·`:203` |
| F-20 `partsArtifacts` 는 publicationId 로만 중복 제거하고 유일 소비처는 `AssistantTurn` | `parts.ts:19-26` · `AssistantTurn.tsx:37-40` |
| F-21 `AssistantTurn` 순서 = 본문 → live → 메타 → 카드 → status. 메타는 hover 전 `opacity-0` | `AssistantTurn.tsx:43-64` · `MessageMeta.tsx:25` |
| F-22 renderer 에 `planFilePath` 소비처가 없다 | `git grep -c planFilePath -- app/src/renderer app/src/shared` → 0 |
| 외부 SDK | 로컬 `node_modules` 는 0.3.220(동봉 CLI 2.1.220)이고 `package.json` 은 0.3.286 이다. F-09~F-14 는 npm 의 0.3.286 tarball 로 재확인했다 | `app/package.json:35` · `npm pack @anthropic-ai/claude-agent-sdk-win32-x64@0.3.286` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| '인증 불필요' (handoff·archive 제외) | `git grep -c "인증 불필요" -- app/src docs` | 코드 1 · 테스트 6줄/4파일 · 문서 4 | 값 1곳 + 갱신할 단언·문서 |
| `unseenCompletedIds` | `git grep -c unseenCompletedIds -- app/src` | 프로덕션 2파일(12줄) · 테스트 4파일(12줄) | Map 전환 대상 |
| `projectBackgroundPanel(` 호출부 | `git grep -n "projectBackgroundPanel(" -- app/src/renderer` (테스트·정의 제외) | 4 | `CanonicalBackgroundContent:75` · `SubAgentTileContent:119` · `backgroundStore:67`·`:102` — 술어 변경이 전부에 전파 |
| `partsArtifacts(` 호출부 | 동일 | 1 | `AssistantTurn:38` |
| transcript `ArtifactCards` 렌더 | `git grep -n ArtifactCards -- app/src/renderer` | 1(`AssistantTurn:63`) + list 1(`TaskOutputContent:49`, 비대상) | 위치 변경 1곳 |
| renderer `permission.requested` 처리 | `git grep -n "'permission.requested'" -- app/src/renderer` (테스트 제외) | 1(`chatReducer.ts:1077`) + `chatStore.receive` default | 통지 신설 자리 1 |
| `PlanReviewRequest` 참조 | `git grep -n PlanReviewRequest -- app/src` | 정의 1 · action 1 · reducer 1 · protocol import 1 | 선택 필드 추가 영향 |

### 수치 / 전칭 표현 검산

- 재측정: 위 표는 이번 세션 `origin/main@954e6fff` 에서 다시 셌다.
- "유일한" 반례 검색: `partsArtifacts` 호출부 1 · transcript `ArtifactCards` 1 · renderer `planFilePath` 0 — 전부 grep 로 확인.
- 기존 테스트 케이스 존재: `TurnOutputCards.test.ts:115`('puts completed metadata before cards…') · `navSections.render.test.ts:324` · `useSessionCompletion.test.ts:15-67` · `claude.canusetool.test.ts:425-455`(0215 AT-01~03) · `CanonicalBackgroundContent.render.test.ts:340`·`:373`·`:537` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01·SD-02·AR-01~AR-04.
- A 라벨: `providerRowMeta` 가 `loginFree` 키를 내고 그 값이 '인증 불필요'다.
- B nav: `turn.ended` 만 app 구독을 거쳐 `markCompleted` 에 닿는다. `permission.requested` 는 reducer 로만 간다(F-03·F-04).
- C 패널: `projectBackgroundPanel` 이 비셸 작업 전부와 실패·launch 호출 전부를 카드로 올린다(F-06).
- D 계획: `ExitPlanMode` 본문 = 입력 `plan` → 서술 → `''`. 계획 파일을 보지 않고 `planFilePath` 를 버린다(`plan-text.ts:21-24`, F-22).
- E·F 카드: `partsArtifacts` 가 publicationId 로만 합치고(F-20) `AssistantTurn` 이 메타 뒤에 카드를 둔다(F-21).

```text
B: permission.requested → receive(default) → reducer           (nav 무반응)
C: canonical state → projectBackgroundPanel(비셸·실패 전부) → 카드
D: CLI can_use_tool → makeCanUseTool → resolvePlanText(input, 서술) → plan_review{plan}
E: [v1,v2,v3](publicationId 상이) → partsArtifacts → 카드 3장
F: 본문 → (meta) → 카드
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- B: `receive` 가 `permission.requested` 를 정확 라우팅 가드 뒤 통지하고, app 구독 함수가 `turn.ended`·응답 요청 둘 다 sessions 의 `unseenAttention` 에 기록한다.
- C: `projectBackgroundPanel` 의 두 술어가 `backgroundPanelFamily` 를 먼저 본다. 셸은 기존 증거 규칙을 이어 받는다.
- D: PostToolUse 훅이 셀에 경로를 적고 Stop 이 비운다. `ExitPlanMode` 는 입력 plan 이 비면 셀 파일을 읽어 `resolvePlanReview` 4단 체인에 넣고 `planFilePath` 를 request 에 싣는다. `updatedInput` 은 불변.
- E·F: `partsArtifacts` 가 category `file` 을 filename 단위로 접고, `AssistantTurn` 이 카드를 메타 앞 고정 슬롯에 둔다.

```text
B: permission.requested → receive → (가드) responseRequest 통지 → subscribeSessionAttention → markAwaitingResponse → unseenAttention → SessionRow
C: canonical state → projectBackgroundPanel(backgroundPanelFamily ∈ {shell, agent}) → 카드
D: PostToolUse(Write|Edit, main) → cell.path ; Stop → cell 비움
   can_use_tool(ExitPlanMode) → [plan 비면 readTrackedPlanFile(cell)] → resolvePlanReview → plan_review{plan, planFilePath?} → … → PlanTile 캡션
E: [v1,B,v2,v3] → partsArtifacts → [v3(자리 1), B]
F: 본문 → 카드 → (meta)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | nav 표시 = 완료 전용 Set | 완료·응답 대기 공용 Map | D-005 | MD-01 / VP-05 · `sessionsStore.ts` |
| data/control flow | `permission.requested` → reducer 만 | + 통지 → app → sessions | D-002·D-006 | AR-01 / VP-02·VP-04 · `chatStore.ts`·`useSessionCompletion.ts` |
| data/control flow | 패널 = 비셸·실패 전부 | 셸·에이전트만 | D-007·D-009 | AR-04 / VP-06·VP-08 · `canonicalBackground.ts` |
| data/control flow | 본문 3단, 파일 미사용 | 4단(파일 2순위) + 경로 | D-011·D-012 | MD-03 / VP-09·VP-13 · `plan-text.ts`·`claude.ts` |
| state/contract | `PlanReviewRequest{requestId, plan}` | + `planFilePath?` | D-014 | AR-03 / VP-14 · `shared/ipc.ts` |
| error/lifecycle | — | 셀 = 채널 스코프, Stop 마다 비움, 읽기 실패 = 다음 폴백 | D-015·D-016 | SD-02 / VP-10 · `plan-file.ts` |
| state/contract | 카드 = publicationId 단위 | category `file` 은 filename 단위(최신·첫 자리) | D-018 | MD-05 / VP-15·VP-16 · `parts.ts` |
| test seam/관측점 | 메타 → 카드 | 카드 → 메타(고정 슬롯) | D-019·D-020 | R-06 / VP-17 · `AssistantTurn.tsx` |
| 삭제/이동 | `resolvePlanText` · `unseenCompletedIds` · `subscribeSessionCompletions` | **대체**(`resolvePlanReview`·`unseenAttention`·`subscribeSessionAttention`) — 구 이름은 남기지 않는다 | 죽은 형제 분기 방지 | VP-13·VP-05·VP-02 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `renderer/features/chat/store/chatStore.ts` | 응답 요청 통지(정확 라우팅만) | `NormalizedEvent` → listener(sessionId) | app hook |
| `renderer/app/hooks/useSessionCompletion.ts` | chat 두 신호 → sessions 액션 연결 | 구독 해제 함수 | `AppLayout.tsx:32` |
| `renderer/features/sessions/store/sessionsStore.ts` | 주의 Map 수명 | 액션 → state | `SessionRow`·app hook |
| `renderer/features/chat/lib/canonicalBackground.ts` | 패널 종류 판정·투영 | state → 카드 목록 | 패널·store |
| `main/adapters/plan-file.ts`(신규) | plans 경로 판정·reader·훅 조각 | 훅 입력 → 셀, 경로 → 본문 | `claude.ts` |
| `main/adapters/plan-text.ts` | 본문 체인 | 입력·파일·서술 → `{plan, planFilePath?}` | `claude.ts` |
| `main/adapters/claude.ts` | 셀 생성·배선 | — | SDK `query` |
| `renderer/.../PlanTileContent.tsx` | 계획 파일 캡션 | `pendingPlanReview.planFilePath` | 우측 패널 |
| `renderer/features/chat/lib/parts.ts` | 카드 목록 합치기 | parts → `ArtifactRef[]` | `AssistantTurn` |
| `renderer/.../AssistantTurn.tsx` | 카드 위치 | — | `Exchange` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| R-01 / VP-01·VP-22 | `skills.provider.status.loginFree` = '연결됨'/'Connected' | `ko.ts`·`en.ts` | renderer | **EP-01** ① `ko.ts:223` 값 ② `en.ts:223` 값 ③ `providerRows.ts:38` 키 선택 ④ `CustomizeList.tsx:134` 렌더 ⑤ `ProviderDetail.tsx:63` 렌더 (5) | 한 언어만 바뀌면 언어 전환 시 옛 문구 · ③~⑤ 가 키 대신 문자열을 쓰면 카탈로그 변경이 화면에 닿지 않는다 |
| R-02·SD-01 / VP-02~VP-05·VP-19 | 주의 Map `unseenAttention: ReadonlyMap<string, 'completed' \| 'awaiting-response'>` | `sessionsStore.ts` | sessions·chat·app | **EP-02** ① `receive` 의 `permission.requested` 통지(가드: `ev.sessionId && key===ev.sessionId && entrySession?.sessionId===ev.sessionId`) ② `turn.ended` 통지(기존) ③ app 구독 함수가 두 통지를 모두 구독 ④ `markAwaitingResponse` ⑤ `markCompleted` ⑥ `setViewedSession` 해제 ⑦ `remove` 해제 ⑧ `SessionRow` 표시 (8) | ①③ 누락 = 대기 표시 없음 · ⑥⑦ 누락 = 영구 파랑 · ⑧ 가 사유별 class 를 다르게 쓰면 D-003 위반. ③ 은 effect 안이라 SSR 미실행 — M-B1 소스 단언으로 잠근다 |
| R-03 / VP-06~VP-08·VP-21 (→ ΔV1 EP-03′) | 카드 종류 ∈ {셸, 에이전트} | `backgroundPanelFamily` (`canonicalBackground.ts`) | renderer | **EP-03** ① 작업 술어 ② 호출 술어 ③ `CanonicalBackgroundContent.tsx:75` 목록·count ④ `SubAgentTileContent.tsx:119` 선택 헤더 ⑤ `backgroundStore.ts:67` 지우기 ⑥ `backgroundStore.ts:102` 지우기 후 선택 (6) | 한 술어만 고치면 그 형태(작업/호출)로 비대상이 샌다(M-C2·M-C3) · ③~⑥ 이 투영을 거치지 않고 `state.calls` 를 직접 읽으면 그 소비처에서 샌다 |
| R-04·SD-02·AR-02·AR-03 / VP-09~VP-14·VP-20 (→ ΔV1 EP-04′) | 계획 파일 폴백 + `PlanReviewRequest.planFilePath?` | `plan-file.ts`·`plan-text.ts`·`shared/ipc.ts` | main adapter·broker·renderer | **EP-04** ① PostToolUse 기록(`Write\|Edit`·`agent_id` 없음·`isError` 아님·D-016 판정) ② Stop 비움 ③ `claude.ts` 배선(훅 조각 `mergeHooks` 편입 + 같은 셀로 `getPlanFile`) ④ ExitPlanMode 분기의 `resolvePlanReview` ⑤ request `{requestId:'', plan, planFilePath?}` ⑥ allow `updatedInput: input`(불변) ⑦ broker spread(`approval.ts:53-54`, 불변) ⑧ reducer spread(`chatReducer.ts:1100-1103`, 불변) ⑨ `PlanTileContent` 캡션 (9) | ③ 누락 = 단위 green·제품 무효(0215 VP-03 과 같은 자리) · ⑥ 위반 = CLI 가 자기 경로에 사본(F-10) · ⑦⑧ 은 이번에 고치지 않지만 spread 를 명시 필드로 바꾸면 경로가 끊긴다 — VP-14 가 본다 |
| R-05 / VP-15·VP-16·VP-18 | category `file` 은 filename 당 1장(최신 `publishedAt`, 첫 자리) | `partsArtifacts` (`parts.ts`) | renderer | **EP-05** ① `partsArtifacts` ② `AssistantTurn` 의 `artifacts` 가 목록·'모두 저장' 기본값 (2) | ① 만 보면 '모두 저장' 이 옛 버전을 포함할 수 없다(같은 배열) — ② 는 배열 공유를 지키는 자리 |
| R-06 / VP-17·VP-18 | 카드 → 메타 순서, 카드 슬롯 고정 | `AssistantTurn.tsx` | renderer | **EP-06** ① 자식 목록 순서 (1) | **mount 안정(D-020)은 SSR 에서 관측할 수 없다**(DOM 없음, 0215 D-020 OPEN). 카드 요소를 조건부로 위치 이동시키는 구현은 테스트 green 으로 통과한다 — 검증자는 자식 목록에서 카드가 단일 고정 위치인지 코드로 확인한다 |

- 같은 규칙이 여러 레이어에 있는가: 가족 판정은 renderer 1곳(`canonicalBackground.ts`)만. main canonical 상태는 판정하지 않는다(D-008). plans 경로 판정은 `plan-file.ts` 1곳 — 훅과 reader 가 같은 함수를 쓴다.
- "다른 게이트가 막는다" 서술: 없음.
- 선택적 필드 의미: `planFilePath` — 부재 = 본문이 서술·빈 값이거나 출처 경로 미상, 빈 문자열은 보내지 않는다. `unseenAttention.get(id)` — `undefined` = 표시 없음.
- 외부 SDK 경계: `HookCallback` 반환은 `{}`(통과)만 쓴다 — 차단·수정 결정을 내지 않는다. `CanUseTool` 의 allow `updatedInput` 은 `input` 참조 그대로.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts` | 라벨 | `skills.provider.status.loginFree` → '연결됨'/'Connected'. `chat.rightpanel.planFile` 신설 '계획 파일: {{name}}'/'Plan file: {{name}}' | `resources.test.ts` |
| `app/src/renderer/src/features/sessions/store/sessionsStore.ts` | 주의 Map | `export type SessionAttention = 'completed' \| 'awaiting-response'` · `unseenAttention` 로 `unseenCompletedIds` 대체 · 공용 `markAttention(id, reason)`(열람 중·같은 사유면 state 반환) · `markCompleted`/`markAwaitingResponse` · `setViewedSession`·`remove` 가 Map 에서 삭제 | 단위 |
| `app/src/renderer/src/features/sessions/components/SessionRow.tsx` | 표시 | `attention = unseenAttention.get(id)`; 비활성+있음 → data-state `unseen-complete`/`awaiting-response`, **같은 class 상수** | SSR |
| `app/src/renderer/src/features/chat/store/chatStore.ts` · `features/chat/index.ts` | 통지 | `responseRequestListeners` + `export function subscribeResponseRequest(listener)` · `case 'permission.requested'`: RECV_EVENT 후 EP-02 ① 가드 통과 시 통지 · index 에서 export | 통합(`ingestChatEvent`) |
| `app/src/renderer/src/app/hooks/useSessionCompletion.ts` | 연결 | `subscribeSessionCompletions` → `subscribeSessionAttention`(두 구독 합성, 해제 함수 1개) · effect 가 그것을 쓴다 | 통합 + 소스 단언(M-B1) |
| `app/src/renderer/src/features/chat/lib/canonicalBackground.ts` | 종류 판정 | `backgroundPanelFamily(task?, call?)` 신설(D-009) · `isBackgroundPanelItemVisible` = 종류 없음 → false, 에이전트 → true, 셸 → 기존 증거 규칙 · 호출 술어의 `\|\| awaitingTask \|\| launchFailure \|\| status==='failed' \|\| isAgentTaskName` 분기 제거 | 단위 + SSR |
| `app/src/main/adapters/plan-file.ts`(신규) | 경로·읽기·훅 | `PLAN_FILE_MAX_BYTES = 256*1024` · `claudePlansDirectory(lookup, home?)` · `planFileTarget(toolName, input, plansDir, home?)` · `type PlanFileReader` + `nodePlanFileReader(max?)`(lstat: 파일·비링크·크기 → `readFile` utf8, 실패 null) · `interface PlanFileCell { path?: string }` · `makePlanFileHook(cell, plansDir)` → `{hooks:{PostToolUse:[{matcher:'Write\|Edit',hooks:[record]}], Stop:[{hooks:[reset]}]}}` · `readTrackedPlanFile(cell, read)` | 순수 단위(파일 I/O 는 임시 디렉토리) |
| `app/src/main/adapters/plan-text.ts` | 체인 | `resolvePlanText` → `resolvePlanReview(toolInput, {planFile?, narrative?}): {plan, planFilePath?}`(D-012 4단). 헤더 주석의 D-004 문단을 "추측 금지는 유지, 관측된 쓰기 경로만 읽는다(0249)" 로 갱신 | 단위 |
| `app/src/main/adapters/claude.ts` | 배선 | `CanUseToolOptions.getPlanFile?` · ExitPlanMode 분기: 입력 plan 이 비었을 때만 `await opts.getPlanFile?.()` → `resolvePlanReview` → request 에 `planFilePath` 조건부 · allow `updatedInput: input` 유지 · `sendMessage`: `plansDir = claudePlansDirectory(contextEnv)`·`planFileCell = {}`·`mergeHooks(…, makePlanFileHook(planFileCell, plansDir), …)`·`getPlanFile: () => readTrackedPlanFile(planFileCell, nodePlanFileReader())` | 단위(`makeCanUseTool`) + 통합(SDK 모킹) |
| `app/src/shared/ipc.ts` | 계약 | `PlanReviewRequest.planFilePath?: string` | typecheck |
| `app/src/renderer/src/features/chat/components/rightpanel/PlanTileContent.tsx` | 캡션 | `PlanDocument` 본문 분기에서 `pendingPlanReview?.planFilePath` 가 있으면 hint 행 다음 `data-plan-file-path`·`title=전체 경로`·`tr('chat.rightpanel.planFile',{name: basenameForDisplay(p, p)})` 한 줄 | SSR(`plan0215` 하네스) |
| `app/src/renderer/src/features/chat/lib/parts.ts` | 합치기 | `partsArtifacts`: publicationId 중복 제거 유지 + category `file` 은 filename → 자리 index 맵, 새 버전의 `publishedAt` 이 크거나 같으면 그 자리를 교체 | 단위 |
| `app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx` | 순서 | 자식 순서 `[본문, pending&&PendingAssistant, cards, !pending&&MessageMeta, pending&&status]` | SSR |

### 테스트 가능성

- electron/DB 분리: `plan-file.ts` 는 `node:fs/promises`·`node:os`·`node:path`·`infra/config/paths`(`isWithinDir`)만 쓴다 — `claude.ts`(electron 의존 import 경로)와 분리된 파일이라 단독 import 된다(선례 `edit-preview.ts`).
- 기존 메커니즘 재사용 적합성: 훅 조각 병합(`mergeHooks`)은 이벤트별 배열 concat 이라 기존 PostToolUse(출력 파일)·Stop(턴 종료) 콜백과 공존한다(`claude-adapt.ts:283-296`). 같은 matcher 의 두 콜백은 독립 실행이다.
- 순서 관측: AT-14 는 포획한 훅을 **테스트가 직접 순서대로 호출**해 ① 쓰기 → ② ExitPlanMode → ③ Stop → ④ ExitPlanMode 를 재현한다. CLI 실행기 순서(F-11) 자체는 바이너리 사실이고 실환경 실기(§19)가 본다.
- M-B1 소스 단언: `useSessionCompletion.ts` 원문에 `useEffect(subscribeSessionAttention` 이 있고 `subscribeSessionCompletions` 식별자가 없다 — 0215 D-021 의 "effect 내부는 소스 단언" 규칙을 따른다.

## 12. End-to-end 영향

### producer → consumer

```text
A: ko/en → providerRowMeta → CustomizeList·ProviderDetail
B: SDK can_use_tool → createApprovalRequester → permission.requested → chatStore.receive → listener → sessions Map → SessionRow
C: SDK stream → ClaudeBackgroundMapper → applyBackgroundEvent → backgroundStore → projectBackgroundPanel → 패널
D: SDK hook_callback(PostToolUse/Stop) → plan-file cell ; SDK can_use_tool → makeCanUseTool → broker → reducer → PlanTileContent
E/F: output.captured/tool.call.completed → artifact part → partsArtifacts → AssistantTurn → ArtifactCards
```

- producer 기준: B 의 신호는 `permission.requested` 하나(3종 공통). D 의 경로는 **성공한 메인 에이전트 쓰기**만.
- consumer 파생 규칙: nav 는 Map 값만 읽는다(사유 재계산 없음). Plan 타일은 `pendingPlanReview.planFilePath` 가 있을 때만 캡션을 낸다.
- 합성값이 정본을 우회하는가: 패널 count 는 투영 결과 길이에서만 나온다(F-06 소비처 4곳 전부 투영 경유).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| SDK `options.hooks.PostToolUse` | `Write\|Edit` 매처 콜백 1개 추가 — 도구 호출당 hook_callback 왕복 1회 증가 | AC14 · VP-18 계열 기존 출력 파일 테스트 green |
| SDK `options.hooks.Stop` | 콜백 1개 추가(즉시 `{}`) — 턴 종료 신호(0211) 불변 | 기존 `claude.turnEnd.test.ts` green |
| `projectBackgroundPanel` 소비처 4 | 비대상 항목이 목록·count·선택·지우기에서 함께 빠진다 | AC7 · VP-08 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 셀은 `sendMessage` 1회(채널)당 1개, 첫 턴 전 빈 상태.
- 취소/중단: Stop 이 오지 않는 중단 턴이면 셀이 다음 턴까지 남는다 — 그 경로는 같은 세션이 직전에 쓴 계획 파일이고 본문은 읽는 시점 값이다(허용, §17).
- 종료/crash: 셀은 클로저와 함께 소멸. nav Map 은 renderer 휘발 상태(재시작 복원 없음, D-004).
- retry/timeout/partial failure: 파일 읽기 실패·초과·링크 → 다음 폴백(서술) → `''`. 훅 콜백 예외는 삼키고 `{}` 를 돌려 턴을 막지 않는다.
- cleanup/rollback: 해당 없음(영속 쓰기 없음).
- **다중 저장소 쓰기**: 제품 코드 — 해당 없음(DB·파일 쓰기 신설 없음, `updatedInput` 불변으로 CLI 쓰기도 유발하지 않음). 산출 문서 — 판정·상태 사본은 `plan.md` 와 `INDEX.md` 두 곳이고 같은 설계 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 계획 파일 읽기 ≤ 256 KiB × `ExitPlanMode` 1회당 1 파일 = 승인 요청당 최대 256 KiB IPC 본문(서술 폴백과 같은 자리).
- 새 요청 수: PostToolUse 콜백 = `Write`·`Edit` 호출 수 × 1 · Stop 콜백 = 턴 수 × 1. 콜백은 동기 판정 후 즉시 반환(파일 I/O 없음 — 읽기는 승인 요청 때만).
- 패널 필터·카드 합치기: 항목 수 n 에 대해 O(n), 기존 투영과 같은 횟수.
- 최적화로 잃는 것: 없음.

## 15. 외부 구현 포트 / 문서 계약

- 외부 구현 포트: 해당 없음. `PlanReviewRequest` 는 main→renderer 내부 계약이고 `docs/IPC_CONTRACT.md` 가 문서 정본이다.
- shape 검증: `planFilePath?` 는 optional 이라 기존 생산자(mock 시나리오 `mock-scenarios.ts:712`)가 수정 없이 typecheck 된다.
- semantics 검증: 부재 = 캡션 없음 — AT-13 음성 케이스.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 로그인 프리 상태 '인증 불필요' | 0248 D-010 · AC11·AC12 · `docs/IPC_CONTRACT.md:458` · `arch/backend/auth.md:764` · ADR-006 | D-001 | **변경**(상태 라벨만). 종류 '기본 제공'·액션 부재는 유지 |
| 비열람 완료의 굵은 파랑, 열면 복귀 | 0224 D-037·D-041 · `arch/frontend/state.md:44` | D-002~D-005 | **유지 + 확장**(응답 대기 사유 추가, 같은 수명·시각) |
| "중간 메시지·오류·중단·삭제된 세션의 늦은 신호는 새 완료 표시를 만들지 않는다" | `arch/frontend/state.md:44` | AC5 | 유지 — 응답 대기는 별도 사유이고 늦은 신호 가드는 같다 |
| feature 교차 import 금지 | root `AGENTS.md` · `app/src/renderer/AGENTS.md` | D-006 | 유지 |
| Monitor·Workflow 결과를 canonical→UI 로 해석 | 0231 R-19·R-20 | D-007·D-008 | **변경**(Code 패널 카드 비표시). canonical 상태 해석은 유지 |
| Code 작업 카드 = 기존 Explorer/Agent 모양 · 포그라운드 셸 제외 | 0232 D-03·D-16 | D-009 | 유지(셸·에이전트에 한해) |
| 본문 3단 체인 | 0215 D-001 · `plan-text.ts` | D-012 | **변경** — 파일 폴백을 2순위로 삽입 |
| 계획 파일 경로 추측 금지 · `get_plan` 미사용 | 0215 D-004·D-026 | D-011·D-017 | 유지 — 관측된 쓰기 경로만, slug 재현 없음 |
| 비범위 "`planFilePath` 로부터의 파일 읽기" | 0215 §6 | D-011 | **변경** — 사용자 요구④ 로 대체 |
| 순서 대기 축 폐기("이상한 수정을 하지마라") | 0215 D-031 | D-015 | 유지 — 매퍼 대기(D-024)를 되살리지 않고 CLI 훅 순서를 쓴다 |
| 계획 승인 = allow 의 `updatedPermissions` 동봉 | 0150 D④ | D-013 | 유지(allow 분기 형상 불변) |
| 완료 메타는 본문과 카드 사이 | 0226 D-36 · `arch/frontend/rendering.md:53` | D-019 | **변경** — 카드 뒤 |
| 카드 부모·위치 유지(완료 시 재mount 금지) · spark 1개·마지막 | 0226 D-36 · `rendering.md:53` | D-020 | 유지 |
| 일반 출력 버전 = 바이트 변경 시 새 publication | 0223·0226 `service.ts:129-170` | D-018 | 유지 — 표시만 합친다 |
| DOM 테스트 환경 도입 여부 | 0215 D-020 (OPEN) | §10 EP-06 | 유지 OPEN — 이번 oracle 은 SSR 한정 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 엄격 종류 판정이 호출 연결 없는 미래 에이전트형 작업을 숨긴다 | 호출 `toolName` 우선 + `taskType` 대체. Agent 작업은 tool_use 가 먼저 관측돼 연결된다(F-07) |
| Spark 개수(Monitor 포함)와 패널 카드 수가 다를 수 있다 | D-010 으로 수용 — 개수는 listen 대기 사유다. 후속 후보로 기록 |
| 계획 파일 캡션이 Anthropic 모델에도 새로 보인다 | 의도(D-014). CLI 승인 화면과 같은 정보 |
| 중단 턴(Stop 없음) 뒤 다음 턴에 이전 경로가 남는다 | 같은 세션이 쓴 계획 파일, 본문은 읽는 시점 값 — 허용 |
| CLI 실행기 순서(F-11)가 바뀌면 같은 메시지 `Write`+`ExitPlanMode` 에서 놓친다 | 실환경 실기(§19) · 버전 갱신 handoff 의 확인 항목 |
| `plansDirectory`·settings 밖 `CLAUDE_CONFIG_DIR` 미지원 | 비범위(D-017). 놓치면 0215 서술 폴백으로 내려간다 |
| 모델이 준 경로를 main 이 읽는다 | plans 디렉토리·`.md`·비링크·256 KiB 로 제한(D-016) |

- 되돌리기 어려운 결정: `PlanReviewRequest.planFilePath`(optional 추가라 하위 호환).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `resources.test.ts`
- `app/src/renderer/src/features/skills/components/customize/{CustomizeList,ProviderDetail}.render.test.ts` · `features/skills/lib/providerRows.test.ts`
- `app/src/renderer/src/features/sessions/store/sessionsStore.ts` · `sessionsStore.completion.test.ts` · `sessionsStore.projectMembership.test.ts`
- `app/src/renderer/src/features/sessions/components/SessionRow.tsx` · `navSections.render.test.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts` · `features/chat/index.ts`
- `app/src/renderer/src/app/hooks/useSessionCompletion.ts` · `useSessionCompletion.test.ts`
- `app/src/renderer/src/features/chat/lib/canonicalBackground.ts` · `components/rightpanel/CanonicalBackgroundContent.render.test.ts` (+ 신규 판정 단위 테스트)
- `app/src/main/adapters/plan-file.ts`(신규) · `plan-file.test.ts`(신규) · `plan-text.ts` · `plan-text.test.ts` · `claude.ts` · `claude.canusetool.test.ts` · `claude.plan-file.test.ts`(신규, `claude.plan-narrative.test.ts` 하네스 패턴)
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/PlanTileContent.tsx` · `plan0215.render.test.ts`(또는 신규 render 테스트)
- `app/src/renderer/src/features/chat/lib/parts.ts` · `parts.test.ts` · `components/transcript/AssistantTurn.tsx` · `TurnOutputCards.test.ts`
- 문서: `docs/IPC_CONTRACT.md`(:458 라벨 · :544 `PlanReviewRequest.planFilePath?`) · `docs/arch/backend/auth.md:764` · `docs/decisions/006-login-free-auth-scheme.md:44`(라벨 + 출처 `(0249)`) · `docs/guides/closed-network-extensions.md:831` · `docs/arch/frontend/rendering.md`(:11 패널 종류 · :43 계획 파일 캡션 · :53 카드 순서·같은 파일 1장 · :59 응답 대기 아이콘) · `docs/arch/frontend/state.md:44`(주의 Map)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(어댑터 레이어) · `app/src/renderer/AGENTS.md`(feature 경계).
- 환경 제약: 로컬 `node_modules` 가 `package.json` 과 어긋나 있다(SDK 0.3.220 설치 vs 0.3.286 선언, §8). 구현 전에 의존성을 선언 버전으로 맞추고 그 사실을 보고한다. ABI 를 뒤집는 `npm test` 는 쓰지 않는다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트(비-DB): `./node_modules/.bin/vitest run src/main/adapters/plan-file.test.ts src/main/adapters/plan-text.test.ts src/main/adapters/claude.canusetool.test.ts src/main/adapters/claude.plan-file.test.ts src/main/adapters/claude.plan-narrative.test.ts src/renderer/src/features/sessions src/renderer/src/app/hooks src/renderer/src/features/chat/lib src/renderer/src/features/chat/components/rightpanel src/renderer/src/features/chat/components/transcript src/renderer/src/features/skills src/renderer/src/shared/i18n`.
- 문서: `cd app && node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(비차단): ① 다른 세션 승인 대기 시 nav 파랑 시각 ② 계획 파일 캡션 시각 ③ 카드가 답변 끝에 붙는 시각(work·code) ④ LiteLLM/OpenRouter custom 모델에서 plan 모드 → 계획 패널 본문·캡션.

---

# ΔV1 — 사용자 결정 변경·추가 요구 (2026-10-04)

> 기준 = `0249:V1@266bdbfe`(공유 브랜치 확인, 구현 0줄). **이 절이 아래 항목의 정본이다** — 위 V1 본문과 다르면 이 절을 따른다.
> 대상: ③ 백그라운드 패널 · ④ ExitPlanMode 보정 · ⑦ 엔진&모델 개수(신규). ①②⑤⑥ 은 V1 그대로다. 라운드는 1 그대로(사용자 요구 변경 턴).

## Δ1. 요구 출처 (추가)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 결정 ⑪ | "Monitor·Workflow 는 백그라운드 카드에 표시할 것. Spark 백그라운드 작업 N건과 동일해야한다" | 라이브 세션 |
| 명시 결정 ⑫ | 현재 정책을 설명한 뒤 재질의 — 포그라운드 Agent = "패널에서 뺀다" | AskUserQuestion 답변 |
| 명시 결정 ⑬ | "계획 패널 본문 위에 한줄 표시 결정을 제거하라. 그곳은 수정할 필요가 없다. 근본문제는 exitplanmode가 가지고 있어야할 plan, planfilepath 필드가 비어져있거나 잘못채워져있는 케이스가 발견되어 폴백으로 보정하는 것이다." | 라이브 세션 |
| 명시 결정 ⑭ | 잘못 채워진 경우의 보정값 = "CLI에도 돌려줌" | AskUserQuestion 답변 |
| 명시 진술 ⑮ | "Exitplanmode 이슈는 클로드 모델(api)이나 허깅페이스 모델에서는 이슈가 없다. 자체 구축한 인프라에서 이슈가 발생한 것이다." | 라이브 세션 |
| 명시 요구 ⑦ | "엔진&모델 페이지에서 deployment에서 추가된 llm 이 발생, harness-row로 추가되어 엔진&모델 항목(카드)이 새로 추가되는 경우, 페이지 상단에 표시되는 전체 항목 숫자 함께 갱신되지 않는 버그 … 카드 숫자와 동기화되어야 함." | 라이브 세션 |
| 추론 의도 | 포그라운드 Agent 카드를 빼도 인라인 행의 '열기'는 그 Agent 대화록을 열어야 한다 — 결정⑫ 의 "대화창 인라인에서만 보인다" 를 지키는 조건이다(Δ6 F-23) | 추론 |

## Δ2. Product / UX 변경

```text
[Code 백그라운드 패널]
  실행 중 = Spark 가 세는 작업(백그라운드 Bash·PowerShell·Agent·Monitor·Workflow·MCP 작업) → 개수 = Spark N
  완료    = 끝난 백그라운드 작업
  없음    = 포그라운드 Agent·포그라운드 셸·ambient 작업·백그라운드가 아닌 호출(실패 포함)
  인라인 Agent 행 '열기' → 그 Agent 대화록 상세(목록에 카드가 없어도)

[ExitPlanMode — 자체 인프라에서 plan·planFilePath 가 비거나 틀림]
  이번 턴 계획 파일(없으면 입력 planFilePath 파일)이 정답 → 요청 본문과 CLI 응답을 그 값으로 보정
  ↘ 입력이 파일과 같으면(Claude API·HuggingFace 등 정상 환경) 아무것도 바꾸지 않는다
  ↘ 계획 패널 UI 는 바꾸지 않는다

[엔진 & 모델]
  제목 옆 개수 = 화면의 카드 수(settings·배포 runtime 행 공통)
```

### 상태와 전이 (추가·변경)

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 백그라운드 작업 시작(셸·Agent·Monitor·Workflow 등) | Spark 집합에 들어감 | 실행 중 카드 1장 + Spark N +1 |
| 백그라운드 작업 종료 | Spark 집합에서 빠짐 | 카드가 완료 그룹으로, Spark N −1 |
| 포그라운드 Agent 실행 | 패널 카드 없음 | 인라인 행만. '열기' 를 누르면 대화록 상세 |
| ambient 작업 | 카드 없음 | Spark·패널 모두 미표시 |
| 백그라운드가 아닌 호출 실패(Read·MCP·Workflow 시작 실패) | 카드 없음 | 변화 없음 |
| ExitPlanMode · 입력 = 파일(정상 환경) | 그대로 | 기존과 같다(승인 결과 문구 포함) |
| ExitPlanMode · 입력이 비었거나 파일과 다름 | 파일 값으로 보정 | 패널에 파일 본문, 모델은 승인 결과로 보정된 계획을 받음("(edited by user)") |
| ExitPlanMode · 파일 출처 없음 | 입력 plan → 서술 → `''` | 0215 동작 그대로, CLI 응답 불변 |
| 배포 LLM runtime 행 추가/제거 | 카드 증감 | 제목 개수가 같은 수로 증감 |

- 일시 차이(정상 상태 등식 밖): 백그라운드 시작 직후 CLI live 목록이 오기 전의 launch 카드, 재연결 직후 첫 live 목록 전의 카드. 둘 다 다음 live 목록에서 맞춰진다.

## Δ3. Decision Ledger 변경

§3 표에 반영했다 — SUPERSEDED: D-007·D-009·D-011·D-012·D-013·D-014. 신설: D-021~D-029. ACTIVE 유지: D-008(투영 제외로 해석)·D-010(Spark 개수 식 불변).

## Δ4. Acceptance — 변경·신설·대체

| AC | provenance | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| AC6′ | CHANGED | 실행 중 그룹에 Spark 가 세는 작업이 **종류와 무관하게** 카드로 보인다(백그라운드 Bash·PowerShell·Agent·Monitor·Workflow·MCP 작업). 끝난 백그라운드 작업은 완료 그룹에 남는다 | SSR: 종류별 fixture(실제 형상 — live 목록·`isBackgrounded`·호출 mode) → data 속성·그룹 | 이벤트 → `applyBackgroundEvent` → `projectBackgroundPanel` → `CanonicalBackgroundContent` |
| AC7′ | CHANGED | 포그라운드 Agent·포그라운드 셸·ambient 작업·백그라운드가 아닌 호출(Read·MCP 실패, Workflow 시작 실패)은 카드·그룹 개수·완료 지우기 대상에 없다 | **같은 state 에 AC6′ 양성 항목과 함께** 넣고 0건 단언 | 동일 |
| AC8′ | CHANGED (회귀) | 백그라운드 Agent 카드의 대화록 상세·셸 상세의 도구 본문·개별 중단·완료 지우기는 그대로다 | 기존 케이스 green(fixture 를 백그라운드 형상으로) | 동일 |
| AC19 | NEW | **Spark 동기** — 정상 상태에서 실행 중 카드의 작업 id 집합 = `countedBackgroundTaskIds(state)` 이고 main 의 Spark 개수 = 그 길이다. 작업 하나가 끝나면(통지 + 다음 live 목록) 둘 다 1 줄고 그 카드는 완료 그룹으로 간다 | renderer: 집합 등식 · main: `BackgroundTaskTracker.count` = 같은 함수 길이(ambient·`liveKnown=false` 포함) | Spark: tracker → `session-activity-projector` → `chat.activity` → StatusLine · 패널: 위 경로 |
| AC20 | NEW | 코드 모드 인라인 Agent 행의 '열기'가 그 Agent 대화록 상세를 연다 — 포그라운드라 목록에 카드가 없어도. 목록으로 돌아가면 그 카드는 없다 | 단위: `openSubagentTask(id)` 후 backgroundStore selection = 그 호출 키 · 투영 `selectedCall` = 그 호출 · 목록 `tasks`·`calls` 에는 없음 | `AgentTaskRow`·`AgentTaskBody`·`SubagentNoticeRow` → `chatActions.openSubagentTask` → backgroundStore selection → `CanonicalBackgroundContent` 상세 |
| AC9′ | CHANGED | 입력 plan 이 비고 이번 턴 계획 파일 T 가 있으면 승인 요청 plan = T 본문이고 allow 의 `updatedInput` = `{...입력, plan: T 본문, planFilePath: T}` | 단위: `makeCanUseTool` + 주입 `getPlanFiles` | CLI `can_use_tool` → `makeCanUseTool` → `requestApproval` / control_response |
| AC10′ | CHANGED | **잘못 채워진 입력** — `planFilePath` 가 T 와 다르거나 `plan` 이 파일 본문과 다르면 T(없으면 입력 `planFilePath` 파일)로 요청과 `updatedInput` 을 보정한다. 파일 출처가 없으면 입력 plan → 서술 → `''` 이고 `updatedInput` 은 입력 그대로다(서술은 CLI 로 보내지 않는다) | 단위: 출처 표(파일 출처 T·선언·없음 × 입력 빈·틀림·맞음 × 서술 유무) | 동일 |
| AC21 | NEW (AC12 대체) | **정상 환경 불변** — 입력 plan·planFilePath 가 파일 출처와 같으면(CRLF·BOM·끝 공백 차이 무시, win32 경로 대소문자 무시) 요청 plan = 입력 plan 이고 `updatedInput === 입력`(참조) | 단위: T = 입력 · 선언 파일 = 입력 · 정규화 차이만 있음 — 3케이스 | 동일 |
| AC14′ | CHANGED | production 어댑터 — 포획한 PostToolUse 에 Write 를 넣고 `ExitPlanMode({})` 를 부르면 요청 plan = 파일 본문, allow 결과 `updatedInput` 에 plan·planFilePath 가 있다. Stop 뒤에는 서술/빈 값이고 `updatedInput` 은 입력 그대로다 | 통합(SDK `query` 모킹, `CLAUDE_CONFIG_DIR` 임시 디렉토리, 실제 파일) | `ClaudeAdapter.sendMessage` → `query(options)` |
| AC22 | NEW | 엔진&모델 제목 옆 개수 = 그려진 카드 수 — settings 2 + runtime 1 이면 '3개', runtime 행이 생기거나 없어지면 카드와 함께 변하고, 빈 목록은 '0개' | SSR: `data-engine-catalog-count` 값 = `EngineCard` 수(같은 렌더) | `providerApi.onState` → `refreshAgents` → `agentStore.agents` → `useEngines` → `AgentEnvironmentView` |
| AC12 | SUPERSEDED → AC21 | — | — | — |
| AC13 | SUPERSEDED — 폐기(D-027) | — | — | — |

- 유효 AC 분모: V1 18 − 대체 2(AC12·AC13) + 신설 4(AC19~AC22) = **20**. CHANGED 6건(AC6′·7′·8′·9′·10′·14′)은 같은 번호의 ′ 판이 V1 행을 대체한다.
- 뒤집히는 기존 단언(ΔV1 기준 전수, V1 §7 주의사항의 패널 항목을 대체):
  - `CanonicalBackgroundContent.render.test.ts` 의 `settlementState()`(:78-108, `isBackgrounded:false` 로컬 Agent)를 쓰는 케이스와 포그라운드 반환 표시 케이스(:109 등) — 포그라운드 미표시로 뒤집는다. 각 케이스가 보던 정착·라벨 의미는 백그라운드 형상 fixture 로 옮긴다.
  - :340·:537 Workflow 실패 호출 카드 → 미표시. Workflow·Monitor **작업**(백그라운드 증거 있음) 카드 단언을 새로 둔다.
  - :373(`mcp__report`) — 작업이 백그라운드 증거를 가지면 카드가 남아 출력 참조 은닉 단언이 다시 유효하다. 증거 없는 fixture 면 증거를 넣는다.
  - 증거 없는 작업 fixture(:323·:470·:752 등) → 증거를 넣는다.
  - `AgentEnvironmentView.count.test.ts` 2케이스 → 카드 수 기준('3개' · legacy 미지정 원천 포함)으로 뒤집는다.
  - V1 의 계획 캡션 테스트·필드는 만들지 않는다.

## Δ5. V / Trace Matrix — Delta

- V mode: `Baseline V`(V1) + `Delta V`(ΔV1). 기준 `0249:V1@266bdbfe`.
- `SUPERSEDED` pair 이관:
  - VP-06(AC6·7·8, 변이 M-C1~M-C4) → **VP-06′**(AC6′·7′·8′, 변이 M-C1′~M-C4′)
  - VP-07 → **VP-07′**
  - VP-09(AC9·10·11·12·13, 변이 M-D1~M-D4) → **VP-09′**(AC9′·10′·11·21; AC13 은 D-027 로 폐기; M-D1 유지 · M-D2→M-D2′ · M-D3→M-D3′(의미 반전) · M-D4→M-D4′ · M-D10 신설)
  - VP-13 → **VP-13′**
  - VP-14(필드 운반, AC13) → **폐기** — 필드를 만들지 않는다(D-027). 이관할 증거 없음.
  - VP-21 → **VP-21′**(포그라운드 Agent 부분 제외)

### Node registry (ΔV1)

| Node | 레벨 | 계약 | provenance | 기준선 / 대체 |
|---|---|---|---|---|
| R-03 | R | Δ2 패널 = 백그라운드 작업(Spark 동기) | CHANGED | V1 R-03 |
| AT-06·AT-07·AT-08 | AT | AC6′·AC7′·AC8′ | CHANGED | V1 |
| AT-19·AT-20 | AT | AC19·AC20 | NEW | — |
| SD-03 | SD | 백그라운드 작업 카드·Spark 수명(시작 → 집합·실행 중 → 종료 → 완료·감소) | NEW | — |
| AR-04 | AR | 투영 단일 소비 + 인라인 열기 선택 연결 | CHANGED | V1 AR-04 |
| AR-05 | AR | Spark 집합 SSOT(shared) — main 개수·renderer 패널 공용 | NEW | — |
| MD-04 | MD | `isBackgroundWork` 판정 | CHANGED | V1 `backgroundPanelFamily` |
| R-04 | R | Δ2 ExitPlanMode 보정(빈 값·틀린 값) + CLI 반환 | CHANGED | V1 R-04 |
| AT-09·AT-10·AT-14 | AT | AC9′·AC10′·AC14′ | CHANGED | V1 |
| AT-12 | AT | — | SUPERSEDED | → AT-21 |
| AT-13 | AT | — | SUPERSEDED | 폐기(D-027) |
| AT-21 | AT | AC21 정상 환경 불변 | NEW | — |
| AR-03 | AR | `PlanReviewRequest.planFilePath` 운반 | SUPERSEDED | 폐기(D-027) |
| MD-03 | MD | `resolvePlanReview` 보정·반환 판정 | CHANGED | V1 MD-03 |
| R-07 · AT-22 | R · AT | 엔진&모델 개수 = 카드 수 | NEW | — |
| R-0232-16 | R | 0232 D-16·D-03 | SUPERSEDED | → R-0232-16′ |
| R-0232-16′ | R | 포그라운드 셸 제외 · 백그라운드 Agent 대화록 상세 | INHERITED | `docs/handoff/0232-background-transcript-ux/plan.md` §3 |
| R-0226-27′ | R | 0226 R27 중 '제목 설명 없음 · `common.count` 단위' | INHERITED | `docs/handoff/0226-cowork-transcript-viewer/plan.md` R27(개수 기준 문장 제외 — R-07 이 대체) |
| R-01·R-02·R-05·R-06·SD-01·SD-02·AR-01·AR-02·MD-01·MD-02·MD-05 | — | V1 그대로 | INHERITED | `0249:V1@266bdbfe` |

### Pair registry (ΔV1)

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 (자리) | §10 |
|---|---|---|---|---|---|---|
| VP-06′ | R-03 ↔ AT-06·07·08 | REQUIRED | 이벤트 → reducer → `projectBackgroundPanel` → 목록·그룹 count·상세 | SSR data 속성·count | **required** — AC7′ 은 0건 단언. M-C1′(`canonicalBackground.ts` `isBackgroundWork` 가 항상 true) / M-C2′(같은 함수 ambient 검사 제거) / M-C3′(같은 함수에 '비셸 작업 무조건 표시' 분기 복원 → 포그라운드 Agent 노출) / M-C4′(같은 함수에서 call.mode 증거 제거 → Monitor·Workflow 미표시) | EP-03′ ④~⑨ (6) |
| VP-07′ | MD-04 ↔ UT | REQUIRED | — | 진리표(ambient · Spark 집합 · 증거 7항 · 포그라운드) | not selected | EP-03′ ④⑤ (2) |
| VP-08′ | AR-04 ↔ IT | REQUIRED | 같은 state 로 목록·count·선택·지우기 + `openSubagentTask` 선택 연결 | 숨긴 호출(실패 Read) 선택 불가 · 숨긴 Agent 호출은 명시 선택 시 상세 | not selected | EP-03′ ⑥~⑨ (4) + EP-08 ② (1) |
| VP-23 | R-03 ↔ AT-19 | REQUIRED | live 목록 → shared 집합 → (main) count → activity / (renderer) 실행 중 카드 | 집합 등식 + 길이 등식 + 종료 후 둘 다 −1 | **required** — 등식 주장. M-S1(`background-tasks.ts` count 를 ambient 포함으로 재구현) / M-S2(`canonicalBackground.ts` Spark 집합 항 제거 + call.mode 증거 제거) / M-S3(같은 파일 포그라운드 Agent 노출) | EP-03′ ①②④⑤⑥ (5) |
| VP-24 | SD-03 ↔ ST-03 | REQUIRED | 시작 → live 포함 → 종료 통지 → live 제외 | 단계별 그룹·count | not selected | EP-03′ ①④ (2) |
| VP-25 | AR-05 ↔ IT-05 | REQUIRED | main tracker 와 renderer 투영이 shared `countedBackgroundTaskIds` 를 호출 | 같은 fixture 에서 두 쪽 수가 같다 | not selected — 방향은 VP-23 M-S1 이 본다 | EP-03′ ①② (2) |
| VP-26 | R-03 ↔ AT-20 | REQUIRED | `AgentTaskRow` → `openSubagentTask` → backgroundStore selection → 투영 선택 → 상세 | selection 값·`selectedCall`·목록 부재 | **required** — 배선. M-B4(`chatStore.ts` `openSubagentTask` 의 선택 연결 제거) / M-B5(`canonicalBackground.ts` 선택의 Agent 예외 제거) | EP-08 ①② (2) |
| VP-09′ | R-04 ↔ AT-09·10·11·21 | REQUIRED | Write/Edit 훅 → 셀 → `getPlanFiles` → `resolvePlanReview` → 요청 plan + allow `updatedInput` | 요청 인자 + allow 결과 | **required** — 형제 슬롯(요청 plan · updatedInput plan · planFilePath)과 출처 순서. M-D1(`plan-text.ts` 서술을 파일보다 앞에) / M-D2′(같은 파일: 입력을 T 보다 앞에) / M-D3′(같은 파일: 같을 때도 새 객체 반환 → AC21 참조 단언 red) / M-D4′(같은 파일: updatedInput 에서 planFilePath 누락) / M-D10(같은 파일: 서술을 updatedInput 에 동봉) | EP-04′ ④⑤⑥⑦ (4) |
| VP-13′ | MD-03 ↔ UT | REQUIRED | — | 출처 표 반환 `{plan, updatedInput}` | not selected — 변이는 VP-09′ | EP-04′ ④ (1) |
| VP-11′ | AR-02 ↔ IT-03 | REQUIRED | `ClaudeAdapter.sendMessage` → 훅·`canUseTool` 셀 공유 → allow 결과 | 포획 실행의 요청·allow `updatedInput` | **required** — M-D7·M-D8·M-D9(V1 그대로, `claude.ts`) | EP-04′ ③ (1) |
| VP-27 | R-07 ↔ AT-22 | REQUIRED | `agentStore.agents` → `AgentEnvironmentView` 개수·카드·빈 상태 | 개수 문자열 = 카드 수 | not selected — 개수를 카드 수와 직접 비교(옛 필터면 runtime fixture 에서 red) | EP-07 ①②③ (3) |
| VP-21′ | R-0232-16′ ↔ AT(0232) | REGRESSION | 셸·백그라운드 Agent fixture → 패널 | 포그라운드 셸 제외 · 백그라운드 Agent 대화록 상세 green | not selected | EP-03′ ④ (1) |
| VP-28 | R-0226-27′ ↔ AT(0226 AT27 일부) | REGRESSION | 엔진 화면 제목 | 설명 문구 부재 · `common.count` 단위 '개' | not selected | EP-07 ① (1) |
| VP-10 · VP-12 | V1 그대로 | REQUIRED(INHERITED) | V1 | V1 | V1 | V1 |

## Δ6. Technical Design — Delta

### 조사 (추가)

| 발견 / 제약 | 근거 |
|---|---|
| F-23 canonical 패널은 legacy `selectedSubagentTaskId` 를 무시한다 — 코드 모드 인라인 Agent '열기'는 목록만 연다. 포그라운드 카드를 빼면 그 Agent 대화록에 닿는 길이 없어진다 | `SubAgentTileContent.tsx:202`(canonical 이면 `CanonicalBackgroundContent`) · `chatStore.ts:1752-1755` · `agentPresentation.ts:59`(code `inlineSubagentDetail:false`) · `AgentTaskRow.tsx:84-87` |
| F-24 Spark 개수 = live 목록 중 ambient 가 아닌 작업 수, live 미확립이면 0 | `background-tasks.ts:193-202` · `session-activity-projector.ts:216` · `activityLabel.ts:68` |
| F-25 패널 그룹 헤더가 개수를 보인다 | `BackgroundTaskGroup.tsx:38` `<span>{count}</span>` · `CanonicalBackgroundContent.tsx:126-129` |
| F-26 포그라운드 정의 = `isBackgrounded===false` ∧ live 미포함 ∧ 백그라운드 관측 없음 | `background-task.ts` `isForegroundTask` · `docs/arch/backend/background-tasks.md:15` |
| F-27 엔진 개수는 settings 원천만 센다 — 카드는 settings + runtime 병합 전체 | `AgentEnvironmentView.tsx:48-51`·`:75` · `models.ts` `mergeAgentEnvironments` · `runtime-catalog.ts:120-124`(배포 LLM = `source:'runtime'`) · 0226 D-24·AC27 |
| F-28 CLI 계획 본문 읽기 = 캐시 우선, 없으면 디스크 — 기대 경로 파일이 바뀐 직후엔 캐시 값이 주입될 수 있다 | 2.1.286 `function w2(n){let e=uw(n),i=jy().planFileCache;…let r=i.get(S(e));if(r!==void 0)return r}return Y(e)}` |
| F-29 같은 메시지 `[Write(기대 경로), ExitPlanMode]` 이면 주입은 Write **전**의 파일을 읽는다(파싱 시점 주입 · 0215 F-04) — 정상 CLI 에서도 '틀린 값' 이 생길 수 있는 경로다 | 0215 F-04 + §8 F-11 |

### AS-IS → TO-BE

| 비교 축 | AS-IS (main) | V1 계획 | TO-BE (ΔV1) | V 연결 |
|---|---|---|---|---|
| 패널 판정 | 비셸 작업 전부 + 실패·launch 호출 전부(`canonicalBackground.ts:158-221`) | 종류(Bash·PowerShell·Agent) 필터 | **¬ambient ∧ (Spark 집합 ∨ 백그라운드 증거)** — 종류 무관, 작업·호출 공통 | MD-04 / VP-07′ |
| Spark 개수 | `count()` 안의 인라인 식 | 불변 | shared `countedBackgroundTaskIds` 로 이동(의미 불변), 패널도 같은 함수 | AR-05 / VP-25 |
| 인라인 Agent 열기 | legacy 선택만 — canonical 은 목록만 열림 | 불변 | backgroundStore 선택도 걸어 상세로 직행. 투영은 명시 선택된 Agent 호출을 숨김이어도 상세로 푼다 | AR-04 / VP-26 |
| ExitPlanMode | 입력 plan → 서술 → `''`, `updatedInput` = 입력 | 빈 경우만 파일 폴백 · CLI 불변 · 캡션 | **파일 출처(T → 입력 경로)가 정답** → 요청·`updatedInput` 보정, 같으면 불변 · 캡션 없음 | MD-03 / VP-09′·VP-13′ |
| 엔진 개수 | `agents.filter(source==='settings').length` | — | `agents.length`(카드와 같은 배열) | R-07 / VP-27 |

### 구현 설계 (ΔV1 — V1 §11 의 해당 행을 대체·추가)

| 파일 | 변경 |
|---|---|
| `app/src/shared/background-task.ts` | `export function countedBackgroundTaskIds(state): string[]` — `liveKnown` 이 아니면 `[]`, 맞으면 `liveTaskIds` 중 `tasks[backgroundKey(generation ?? '', id)]?.ambient !== true`. 기존 `count()` 식과 같은 의미 |
| `app/src/main/features/chat/background-tasks.ts` | `count()` canonical 분기 = `countedBackgroundTaskIds(state).length`. legacy `bySession` 분기 불변 |
| `app/src/renderer/src/features/chat/lib/canonicalBackground.ts` | `isBackgroundPanelItemVisible` → `isBackgroundWork(state, task?, call?)`: ambient → false · 현재 세대 작업이 `countedBackgroundTaskIds` 에 있음 → true · 아니면 증거 7항(`run_in_background` 요청 · task/call `backgroundObserved` · `liveMembership` included · `isBackgrounded` true · call.mode background·remote). 작업·호출 술어 = `isBackgroundWork ∧ ¬dismissed`(V1 종류 필터·호출 OR 분기 없음). 선택 `kind:'call'` 은 보이는 호출이거나 `isAgentTaskName(call.toolName)` 인 명시 선택이면 푼다(작업은 state 원본). `backgroundCallKeyForToolUse(state, toolUseId)` 신설(현재 세대 우선) |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | `openSubagentTask(toolRunId)`: 기존 dispatch·reveal + 활성 세션 background state 에 그 호출이 있으면 `selectBackgroundItem(sessionId, {kind:'call', key})` |
| `app/src/main/adapters/plan-file.ts` | V1 + `readDeclaredPlanFile(input, plansDir, read)` — 입력 `planFilePath` 를 `planFileTarget` 과 같은 판정(D-016)으로 걸러 읽는다 |
| `app/src/main/adapters/plan-text.ts` | `resolvePlanReview(input, {tracked?, declared?, narrative?}) → {plan, updatedInput}`: 파일 = tracked ?? declared(본문 비공백). 파일이 있으면 입력과 **정규화 비교**(본문: CRLF→LF·BOM 제거·끝 공백 무시 / 경로: `path.relative(a,b)===''`) — 다르면 plan = 파일 본문·`updatedInput = {...(isRecord(input)?input:{}), plan, planFilePath}`, 같으면 plan = 입력 plan·`updatedInput = input`(참조). 파일 없으면 입력 plan → 서술 → `''` 이고 `updatedInput = input` |
| `app/src/main/adapters/claude.ts` | `CanUseToolOptions.getPlanFiles?: (input) => Promise<{tracked?, declared?}>`(V1 `getPlanFile` 대체) — ExitPlanMode 마다 호출(입력이 차 있어도). 요청 `{requestId:'', plan}`. allow = `{behavior:'allow', updatedInput: resolved.updatedInput, updatedPermissions}` |
| `app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx` | 개수 = `agents.length` |
| **V1 에서 철회(만들지 않음)** | `shared/ipc.ts` `PlanReviewRequest.planFilePath` · `PlanTileContent` 캡션 · i18n `chat.rightpanel.planFile` · `IPC_CONTRACT.md:544` 변경 · `rendering.md:43` 변경 |

### §10 강제 지점 (ΔV1 — EP-03·EP-04 대체, EP-07·EP-08 신설)

| V node / pair | 계약 | SSOT | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|
| R-03·AR-05·SD-03 / VP-06′·07′·08′·21′·23·24·25 | 패널 = 백그라운드 작업, 실행 중 = Spark 집합 | `countedBackgroundTaskIds` · `isBackgroundWork` | **EP-03′** ① `shared/background-task.ts` 집합 함수 ② `background-tasks.ts` `count` ③ `session-activity-projector.ts:216` activity 운반(불변) ④ 작업 술어 ⑤ 호출 술어 ⑥ `CanonicalBackgroundContent.tsx:75` ⑦ `SubAgentTileContent.tsx:119` ⑧ `backgroundStore.ts:67` ⑨ `backgroundStore.ts:102` (9) | ② 가 식을 따로 가지면 Spark 와 패널이 갈라진다(M-S1) · ④⑤ 하나만 고치면 그 형태로 샌다 · Δ2 의 일시 차이는 정상 상태 등식 밖이다 |
| R-04 / VP-09′·11′·13′ | 파일 출처 보정 + CLI 반환 | `plan-text.ts` · `plan-file.ts` | **EP-04′** ① PostToolUse 기록 ② Stop 비움 ③ `claude.ts` 배선 ④ `resolvePlanReview` ⑤ 요청 plan ⑥ allow `updatedInput` ⑦ 선언 경로 읽기 판정 (7) | ⑥ 이 같을 때도 새 객체면 정상 환경에서 CLI 가 "(edited by user)" 를 붙인다(AC21) · ⑦ 이 D-016 을 건너뛰면 모델이 준 임의 경로를 읽는다 |
| R-07 / VP-27·28 | 개수 = 카드 수 | `agentStore.agents` 한 배열 | **EP-07** ① 개수 `AgentEnvironmentView.tsx:48-51` ② 카드 `:75` ③ 빈 상태 `:69` (3) | ① 이 다른 필터를 쓰면 카드와 갈라진다 |
| R-03 / VP-26·08′ | 인라인 열기 → 상세 | `openSubagentTask` | **EP-08** ① `chatStore.ts` `openSubagentTask` 선택 연결 ② `projectBackgroundPanel` 선택의 Agent 예외 (2) | ① 누락 = 포그라운드 Agent 대화록 도달 불가 · ② 를 모든 호출로 넓히면 숨긴 실패 호출이 상세로 열린다 |

### Lifecycle / 오류 (ΔV1)

- ExitPlanMode: 파일 출처 읽기는 ExitPlanMode 1회당 최대 2파일(T·선언) × 256 KiB. 읽기 실패·초과·링크는 다음 출처로 간다. 쓰기는 하지 않는다 — CLI 가 `updatedInput.plan` 을 자기 기대 경로에 저장하는 것은 CLI 동작이다(§8 F-10).
- 다중 저장소 쓰기: 해당 없음(Orca 는 파일을 쓰지 않는다).

## Δ7. 기존 결정·규칙과의 관계 (ΔV1)

| 기존 결정/규칙 | 출처 | 결과 |
|---|---|---|
| Monitor·Workflow 패널 표시 | 0231 R-19·R-20 | V1 의 '변경' 판정을 철회하고 **유지**(백그라운드 작업이면 카드). Workflow 시작 실패 호출 카드만 **변경**(미표시, 요구③) |
| Code 작업 카드 = Explorer/Agent 모양 | 0232 D-03 | **변경** — 포그라운드 Agent 카드 미표시. 백그라운드 Agent 카드·대화록 상세 유지 |
| 포그라운드 셸 제외 | 0232 D-16 | **유지·일반화** — 같은 증거 규칙을 모든 종류에 적용 |
| 포그라운드 부모 반환 시 패널 표시 정착 | 0239 D-003 · `rendering.md:13` | **변경** — 포그라운드는 패널 목록에 없다(인라인 열기 상세에서만). `backgroundPending` 제외(D-005)는 유지 |
| 포그라운드 정의 · Spark 개수 식 | `background-tasks.md:15` · `background-tasks.ts:193-202` | 유지 — 식을 shared 로 옮길 뿐 의미 불변 |
| 본문 체인 | 0215 D-001 | **변경**(D-025: 파일 출처가 입력보다 앞) |
| 계획 승인 = allow 의 updatedPermissions | 0150 D④ | 유지 — allow 에 `updatedInput` 보정만 더한다 |
| 엔진 개수 = settings 원천 | 0226 D-24·AC27 | **변경**(D-029). 제목 설명 제거·단위 '개' 유지 |

## Δ8. 영향 파일·문서 (ΔV1)

- 추가: `app/src/shared/background-task.ts`(+ test) · `app/src/main/features/chat/background-tasks.ts`(+ `background-tasks.test.ts`) · `app/src/renderer/src/features/chat/store/chatStore.ts`(`openSubagentTask`, + test) · `app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx`(+ `AgentEnvironmentView.count.test.ts`).
- 철회: `app/src/shared/ipc.ts` · `PlanTileContent.tsx` · `plan0215.render.test.ts` 캡션 케이스 · i18n `chat.rightpanel.planFile`.
- 문서(ΔV1 기준 6파일): `docs/arch/frontend/rendering.md`(:11 패널 = 백그라운드 작업·Spark 동기 · :13 포그라운드 정착 문장 · :53 카드 순서·같은 파일 1장 · :59 응답 대기 아이콘) · `docs/arch/frontend/state.md:44` · `docs/arch/backend/background-tasks.md`(Spark 집합 SSOT 함수) · `docs/arch/frontend/ux-domains.md:98`(제목 개수 = 카드 수) · `docs/IPC_CONTRACT.md:458` · `docs/arch/backend/auth.md:764` · `docs/decisions/006-login-free-auth-scheme.md:44` · `docs/guides/closed-network-extensions.md:831`. V1 의 `IPC_CONTRACT.md:544`·`rendering.md:43` 변경은 철회.
- 게이트 스위트 추가: `src/shared/background-task.test.ts` · `src/main/features/chat/background-tasks.test.ts` · `src/renderer/src/features/engine` · `src/renderer/src/features/chat/store`.

## Δ9. READY self-review (ΔV1)

- [x] 사용자 결정 ⑪~⑭·진술⑮·요구⑦ 원문 인용, SUPERSEDED 6건에 대체 ID(§3).
- [x] 결정⑪ "동일해야한다" 를 정상 상태 집합 등식(AC19)으로 잠그고, 일시 차이 2종을 등식 밖으로 명시(Δ2).
- [x] 결정⑫ 의 파생 — 포그라운드 대화록 도달 경로를 AC20·EP-08 로 보존(F-23 실측).
- [x] 진술⑮ 을 정상 환경 불변 AC21(참조 동일)로 잠갔다.
- [x] SUPERSEDED pair 의 AC·변이 이관을 전부 적었다(VP-14 는 폐기 근거).
- [x] 새 pair 의 분모는 자리 단위(EP-03′ 9 · EP-04′ 7 · EP-07 3 · EP-08 2), 등록 변이는 심을 파일을 적었다.
- [x] 철회 항목(캡션·필드·문서 2곳)이 구현 목록·문서 목록에서 빠졌다(Δ6·Δ8).
- [x] 유효 AC 분모 재계산 20(Δ4).

## READY self-review

- [x] Decision Ledger 가 결정⑦~⑩ 과 요구①~⑥ 을 D-001~D-020 으로 보존한다(SUPERSEDED·OPEN 0).
- [x] Part I 만으로 6건의 완료 상태가 설명된다(§1·§5).
- [x] 조건절 원문 인용 — "외에는", "기록하지 말 것"(D-008 추론 표기), "세션을 열면 해제", "화면에만 표시", "work·code 공통".
- [x] 사용자 결정 4건은 질의로 닫았고 나머지는 코드·바이너리 조사로 닫았다(§4).
- [x] 수치·전칭(`유일한` 3건)·외부 규약(CLI 2.1.286 재확인)·기존 테스트 케이스를 이번 세션에 실측했다(§8).
- [x] 저장소 규칙: feature 교차 import 금지(D-006) · 어댑터 순수부 분리(edit-preview 선례) · doc inventory · ABI 가이드.
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로를 가진다(§7).
- [x] Baseline V, 회귀는 `INHERITED` 출처 명시(§7-A).
- [x] 모든 NEW 노드에 같은 레벨 REQUIRED pair(VP-01~VP-17), 영향받는 상위 동작 5건은 REGRESSION(VP-18~VP-22).
- [x] 적대 증거는 배선·0건·형제 슬롯 pair 에만 선택했다(VP-02·06·09·10·11·15).
- [x] 운영 gate 는 이번 변경 산출물에 한정했다.
- [x] 사람 실기로 미룬 순수 로직 없음.
- [x] structural proxy 로만 닫는 AC 없음 — M-B1 소스 단언은 VP-02 의 보조이고 값은 통합 테스트가 본다.
- [x] "X 가 쓰인다" 불변식(배선 EP-02 ③·EP-04 ③)은 X 를 지우면 red(M-B1·M-D7~D9), 형제 슬롯(plan/planFilePath·버전/자리·카드/메타)은 맞바꿈 변이(M-D1·M-D2·M-E1·M-E2·AT-17 순서)가 red.
- [x] 상호배타 상태: 주의 사유는 union 한 값(Map 값)이라 "완료이면서 대기" 조합이 없다.
- [x] 참조 구현 coverage: 출력 파일 훅·edit-preview 는 형상 선례로만 쓴다.
- [x] 신규 계약마다 SSOT·강제 지점·seam(§10·§11).
- [x] 훅 추가의 기존 소비처 확인(§12).
- [x] producer/consumer 양쪽 의미(§12).
- [x] 상한 계산(§14), one-way door(`planFilePath`) 확정(§6).
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다(`npm test` 미사용).
- [x] 본문 완성 후 Ledger·§16 교차검증, `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 문장 규칙 — 판정 먼저, 표 위주, Part I/II 사실 중복은 F-번호 인용으로 대체.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다.** 해당 없는 필드는 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1 + ΔV1의 로그인 프리·nav·계획 보정·출력 카드·엔진 개수 계약을 수행했다. 현재 사용자의 `handoff-impl 249` 지시에 따라 구현 주체는 Codex다.
- 이견 / 현실성 문제: AC19는 종료 미확인 작업을 유지하는 D-022·기존 정착 계약과 충돌한다. 정상 fixture의 등식 green을 전 상태의 등식으로 확대하지 않는다.
- ACTIVE Decision 과 충돌하는 설계 발견: **PLAN_GAP PG-01**. live가 확립된 뒤에도 현재 세대에서 제외된 미종료 작업과 이전 세대 remote 작업이 실행 중으로 남는다. 아래 반례와 사용자 질의를 기록하고 AC19 경로를 멈췄다. INDEX는 `plan/DRAFT`, 다음 주체는 planner다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·22 | 로그인 프리 상태 | EP-01 5 | 5/5: ko·en 값, providerRowMeta, 목록, 상세 | S1; 목록·상세 SSR에 연결됨·기본 제공, 인증 액션 부재 | 없음 |
| VP-02~05·19 | 완료·응답 대기 Map | EP-02 8항목 | 10/10: receive, export, 완료 구독, 요청 구독, effect, 두 action, 열람, 삭제, 아이콘 | S2; 3종 요청 Map·동일 파랑·라우팅 음성·열람/삭제·last wins 관측 | 없음 |
| VP-06′·07′·08′·21′·23~25 | 패널 투영·Spark | EP-03′ 9 | 지정 9자리·운반 세분 17슬롯 조사. **등식 계약 미닫힘** | S3; 배선·정상 fixture green. PG-01 반례는 카드 집합≠Spark | AC19/VP-23; 포함 술어·실행 중 그룹의 정책 |
| VP-09′·10·11′·12·13′·20 | 계획 파일·CLI 반환 | EP-04′ 7항목 | 8/8: 기록, Stop, hook 편입, 공유 셀 getter, resolver, request.plan, allow.updatedInput, 선언 경로 guard | S4; 실제 query 포획·파일 읽기·Stop·출처 표·참조 동일 관측 | 없음 |
| VP-15·16 | 한 턴 최신 파일 | EP-05 2 | 2/2: partsArtifacts, AssistantTurn 소비 | S5; 최신 ref·최초 위치·category 보존·saveAll 실제 인자 관측 | 없음 |
| VP-17·18 | 카드→메타 고정 슬롯 | EP-06 1 | 1/1: AssistantTurn 공통 JSX | S5; Work/Code×pending/done 4조합 순서·spark 1개 | 없음 |
| VP-27·28 | 엔진 카드 수 | EP-07 3 | 3/3: 제목 개수·카드 map·빈 상태 | S1; settings+runtime 3개·추가/제거·빈 0개, 설명 부재 | 없음 |
| VP-26·08′ | 인라인 Agent 명시 상세 | EP-08 2 | 2/2: openSubagentTask 선택, 투영의 Agent 예외 | S3; Agent/Task 목록 부재·직접 상세, Read 실패 상세 부재 | 없음 |

- 검색 명령(루트): `rg -n 'permission.requested|unseenAttention|markAttention|markCompleted|markAwaitingResponse|setViewedSession|subscribeSessionAttention' app/src/renderer/src -g '*.ts' -g '*.tsx' -g '!*.test.ts'`; `rg -n 'backgroundTaskCount|projectBackgroundPanel\(|countedBackgroundTaskIds|isBackgroundWork' app/src -g '*.ts' -g '*.tsx' -g '!*.test.ts'`; `rg -n 'planFilePath|getPlanFiles|resolvePlanText|resolvePlanReview|makePlanFileHook|readTrackedPlanFile|readDeclaredPlanFile' app/src -g '*.ts' -g '*.tsx' -g '!*.test.ts'`; `rg -n 'partsArtifacts|ArtifactCards|agents.length|agents.map|status.loginFree|statusKey' app/src/renderer/src -g '*.ts' -g '*.tsx' -g '!*.test.ts'`.
- 독립 분모: EP-02③의 구독 두 곳과 effect는 3자리, EP-04′③의 hook 편입과 getter는 2자리다. EP-03′는 ①1+②1+③3+④1+⑤1+⑥4+⑦1+⑧3+⑨2=17슬롯이다. 이 세분은 각 지정 모듈 내부이며 전체 IPC edge 개수 주장으로 확대하지 않는다.
- EP-03′ 슬롯: shared/background-task:215; main background-tasks:196; session-activity-projector:216·226·247; canonicalBackground:209·223; CanonicalBackgroundContent:75·129·134·155; SubAgentTileContent:119; backgroundStore:67·68·82·102·106. 모두 `app/src/` 아래다.
- §10에 없는데 같은 불변식이 필요했던 지점: **PG-01은 기존 포함/그룹 자리에서 상태 기준이 모순된 경우**다. 검색 파일 집합과 지정 집합을 비교한 차집합은 투영 소비 3파일(4호출)·계획 운반 3파일 모두 0행이다. partsArtifacts의 실제 transcript 소비는 AssistantTurn 1곳이며 TaskOutputContent의 별도 list는 이번 턴 범위 밖이다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | S1 카탈로그·목록·상세 SSR | not selected |
| VP-02 | REQUIRED | SELF_PASS | S2 3종 요청의 실제 ingest→Map→아이콘 | B1·B2·B3 red |
| VP-03 | REQUIRED | SELF_PASS | S2 열람 후 부재·사유 교차·삭제 | not selected |
| VP-04 | REQUIRED | SELF_PASS | S2 구독 통합 값·lint boundaries | not selected |
| VP-05 | REQUIRED | SELF_PASS | S2 store 값·동일 사유 identity | not selected |
| VP-06′ | REQUIRED | SELF_PASS | S3 배경 작업 종류별 SSR·양성/음성 같은 state | C1′~C4′ red |
| VP-07′ | REQUIRED | SELF_PASS | S3 ambient·Spark·증거 7항 진리표 | not selected |
| VP-08′ | REQUIRED | SELF_PASS | S3 목록·count·선택·dismiss 공통 투영 | not selected |
| VP-09′ | REQUIRED | SELF_PASS | S4 요청 본문·allow 입력·출처 조합 | D1·D2′·D3′·D4′·D10 red |
| VP-10 | REQUIRED | SELF_PASS | S4 마지막 Write/Edit·agent_id 무시·Stop 비움 | D5·D6 red |
| VP-11′ | REQUIRED | SELF_PASS | S4 실제 sendMessage 포획 hook/getter의 공유 셀·env 우선순위 | D7·D8·D9 red |
| VP-12 | REQUIRED | SELF_PASS | S4 경로·256KiB·링크·부재·reader 실패 표 | not selected |
| VP-13′ | REQUIRED | SELF_PASS | S4 실제 resolvePlanReview 출처·정규화·참조 표 | not selected |
| VP-15 | REQUIRED | SELF_PASS | S5 최신 파일·첫 위치·실제 saveAll | E1·E2·E3 red |
| VP-16 | REQUIRED | SELF_PASS | S5 실제 partsArtifacts 반환 | not selected |
| VP-17 | REQUIRED | SELF_PASS | S5 Work/Code×진행/완료 SSR 순서 | not selected |
| VP-18 | REGRESSION | SELF_PASS | S5 이전 턴 ref·pending fallback·spark 1개 | not selected |
| VP-19 | REGRESSION | SELF_PASS | S2 기존 정상 완료 의미·굵은 파랑 | not selected |
| VP-20 | REGRESSION | SELF_PASS | S4 서술/empty 폴백 + plan0215.render | not selected |
| VP-21′ | REGRESSION | SELF_PASS | S3 포그라운드 셸 제외·배경 Agent 상세 | not selected |
| VP-22 | REGRESSION | SELF_PASS | S1 기본 제공·인증 액션 부재 | not selected |
| VP-23 | REQUIRED | **SELF_BLOCKED** | S3 정상 fixture green이지만 PG-01 두 반례에서 등식 false | M-S1·M-S2·M-S3 red 보존, 보편 등식 증명 아님 |
| VP-24 | REQUIRED | SELF_PASS | S3 등록 시작→live→종료 통지→live 제외 단계 | not selected |
| VP-25 | REQUIRED | SELF_PASS | S3 shared 호출 배선·동일 정상 fixture의 양쪽 길이 | not selected |
| VP-26 | REQUIRED | SELF_PASS | S3 실제 openSubagentTask→선택·숨긴 Agent 상세 | B4·B5 red |
| VP-27 | REQUIRED | SELF_PASS | S1 제목 개수=실제 카드 수·runtime 변동 | not selected |
| VP-28 | REGRESSION | SELF_PASS | S1 설명 없음·common.count의 개 단위 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M-B1 effect를 완료 전용 구독으로 | VP-02 | 최초 | useSessionCompletion / 1 | red·원복 green |
| M-B2 요청 통지 제거 | VP-02 | 최초 | useSessionCompletion / 4 | red·원복 green |
| M-B3 열람 가드 제거 | VP-02 | 최초 | useSessionCompletion / 2 | red·원복 green |
| M-B4 인라인 선택 연결 제거 | VP-26 | 최초 | chatStore.background-open / 2 | red·원복 green |
| M-B5 명시 Agent 예외 제거 | VP-26 | 최초 | S3의 변이용 7파일 / 5 | red·원복 green |
| M-C1′ 모든 항목 배경 true | VP-06′ | 최초 | 같은 7파일 / 35 | red·원복 green |
| M-C2′ ambient 검사 제거 | VP-06′ | 최초 | 같은 7파일 / 10 | red·원복 green |
| M-C3′ 비셸 무조건 표시 복원 | VP-06′ | 최초 | 같은 7파일 / 24 | red·원복 green |
| M-C4′ call.mode 증거 제거 | VP-06′ | 최초 | 같은 7파일 / 4 | red·원복 green |
| M-S1 main count에 ambient 포함 | VP-23 | 최초 | 같은 7파일 / 1 | red·원복 green |
| M-S2 Spark 항·call.mode 제거 | VP-23 | 최초 | 같은 7파일 / 5 | red·원복 green |
| M-S3 포그라운드 Agent 노출 | VP-23 | 최초 | C3′와 같은 실제 변이 / 24 | red·원복 green |
| M-D1 서술을 파일보다 먼저 | VP-09′ | 최초 | S4 등록 변이 대상 / 17 | red·원복 green |
| M-D2′ 입력을 추적 파일보다 먼저 | VP-09′ | 최초 | 같은 대상 / 9 | red·원복 green |
| M-D3′ 같은 입력도 새 객체 | VP-09′ | 최초 | 같은 대상 / 9 | red·원복 green |
| M-D4′ updatedInput 경로 누락 | VP-09′ | 최초 | 같은 대상 / 16 | red·원복 green |
| M-D5 Stop 비움 제거 | VP-10 | 최초 | 같은 대상 / 3 | red·원복 green |
| M-D6 agent_id 가드 제거 | VP-10 | 최초 | 같은 대상 / 3 | red·원복 green |
| M-D7 hook merge 제거 | VP-11′ | 최초 | 같은 대상 / 3 | red·원복 green |
| M-D8 다른 셀 getter | VP-11′ | 최초 | 같은 대상 / 3 | red·원복 green |
| M-D9 getPlanFiles 배선 제거 | VP-11′ | 최초 | 같은 대상 / 5 | red·원복 green |
| M-D10 서술을 CLI 입력으로 동봉 | VP-09′ | 최초 | 같은 대상 / 5 | red·원복 green |
| M-E1 첫 파일 버전 유지 | VP-15 | 최초 | parts·TurnOutputCards·ArtifactCards.lifecycle / 6 | red·원복 green |
| M-E2 마지막 위치로 이동 | VP-15 | 최초 | 같은 3파일 / 7 | red·원복 green |
| M-E3 category 무시 합치기 | VP-15 | 최초 | 같은 3파일 / 9 | red·원복 green |

- **분모 검산**: 선택 증거 25 ID(SELF_PASS 귀속 22 + SELF_BLOCKED VP-23 귀속 3) · 인용 변이 0 · 추가 구조 oracle 0 = 표 25행. B1 소스 oracle은 이미 선택된 B1 행으로 잠갔다. C3′/S3는 같은 결함·관측을 각 등록 ID에 귀속했다. 등록 ID와 표 ID를 독립 추출하여 `Compare-Object`로 비교한 누락/추가 0행을 관측했다.
- **덮개 회귀**: 직접 행동·순서 oracle은 별도 mutation을 추가하지 않았다. 기존 render fixture의 정착·라벨·출력 ref 은닉 의미는 실제 배경 형상으로 옮겼고, Workflow 시작 실패·증거 없는 호출의 부재를 따로 잠갔다. Stop 단일 matcher 하네스는 SDK처럼 병합된 모든 콜백을 호출하도록 고쳐 기존 27케이스 의미를 보존했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 연결됨/Connected는 목록·상세 SSR, 응답 대기는 실제 SessionRow, 개수는 엔진 제목이 소비한다 | 새 계획 캡션·IPC 필드는 D-027에 따라 없음 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | hook와 getter가 같은 채널 cell, Stop이 그 cell을 비움(S4) | 새 별도 저장 상태 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 파일 읽기 실패는 다음 출처로 내려가 입력→서술→empty 기존 행(S4) | 종료 미확인 배경 상태의 그룹은 PG-01로 planner 정정 필요 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | empty 본문의 기존 계획 실패 표시·증거 없는 실패 호출의 목록 제외(S3/S4) | 실환경 custom 모델·시각은 §19 사람 실기 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 삭제/미지/폴백 세션 요청은 nav에 없음(S2). 승인 요청/반환 입력은 읽기 시점 snapshot을 공유(S4) | 이후 계획 파일 변경은 승인 대기 요청을 다시 쓰지 않음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| PG-01 | 미종료 배경 카드를 보존하면 정상 live 이후 실행 중 집합이 Spark보다 크다 | 해당 등식 경로 중지. 숨김 / 종료 미확인 별도 그룹 / 등식 예외 중 사용자 선택 대기 | 현재 `[a,b]→[b]`: Spark1·실행중2. old remote→새 세대 `[]`: Spark0·실행중1. 둘 다 실제 Mapper→reducer→projection 경로, parse errors0 |
| I-01 | stat 이후 파일 성장·부모 링크 탈출·열린 handle 누수 | bounded handle reader로 보강, 모든 성공·실패 경로 close | S4 reader 9케이스: max+1 probe 초과 null·짧은 chunk 성공·조기 반환/실패 close1 |
| I-02 | hook 추가 후 기존 테스트가 첫 Stop 콜백만 실행 | production은 기존 merge 유지, 테스트가 병합 콜백을 전부 실행 | 기존 claude.turnEnd 27케이스 green |
| I-03 | 빈 객체 폴백의 TS 추론이 plan/planFilePath 조회를 막음 | `Record<string, unknown>` 명시 타입 | 최초 node 진단2 → 타입 주석 보정 뒤 node 진단0·관련 84케이스 green |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: reader의 `lstat→readFile`을 `lstat→open→handle.stat(dev/ino)→realpath→bounded read→finally close`로 바꿨다. stat 뒤 성장해도 최대 256KiB+probe 1바이트만 읽으며 반환은 256KiB 이하다. 파일 쓰기·캐시·새 의존성은 없다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — reader snapshot에 TTL/캐시 없음 | AC11·EP-04′⑦: 매 승인 시 읽음 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | CLI가 파일을 바꾸거나 Stop이 cell을 비울 수 있음 | AC11·14′·EP-04′①②③: 성장 probe·공유 셀·Stop 관측 |
| 재진입 | 열린 handle을 반환 전에 닫아야 함 | AC11·EP-04′⑦: reader 성공·오류·조기 반환 close1 |
| 다른 무효화 축 | 조상 symlink/junction도 제외해 링크된 CLAUDE_CONFIG_DIR의 파일 출처는 폴백으로 내려감 | AC11·D-016: 실제 파일 링크·부모 junction 차단, 일반 config 경로 성공 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main 계획 어댑터/테스트, shared Spark 집합, main tracker/activity 테스트, renderer nav/배경 투영/카드/엔진/i18n 및 현재 문서 8파일. 최종 파일 목록은 diff가 정본 |
| 실행 명령 | app에서 lint·typecheck·직접 vitest(ABI 전환 없음)·doc inventory; S1~S5 아래 명령 |
| **관측한 게이트 산출**(exit code 아님) | 전체 lint 0 error·기존 Virtualizer warning1, typecheck node/web/test 진단0. 영향 vitest 249파일2031케이스 green; 뒤의 fixture 타입 보정은 해당5파일75케이스 green. doc inventory generated/prose/links 정상·diff --check 출력0 |
| V-pair 자기확인 | REQUIRED 20 SELF_PASS·1 SELF_BLOCKED, REGRESSION 6 SELF_PASS = 유효27 pair. VP-14는 폐기라 분모 밖 |
| 강제 지점 전수 | EP-01/02/04′/05/06/07/08 물리31자리 닫음. EP-03′ 지정9·운반세분17 조사, AC19 등식 미완료 |
| **AC 자기보고**(`Criteria-Met`) | **19/20**. AC19만 PLAN_GAP으로 남김. 독립 verify 결과는 아님 |
| **합계 검산** | ✅19 · ⚠️1 · ❌0 =20. 규범 AC와 보고 AC를 별도 추출해 누락/추가 0행. AC12·13은 폐기, prime 6행은 원번호 대체 |
| 블로커 / 역질문 | PG-01: Spark에 없는 미종료 작업을 숨김 / 별도 종료 미확인 그룹 / 실행중 유지+등식 예외 중 선택 필요. 첫 live 이전의 기존 일시 차이와는 다른 상태 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

### AC 자기보고 — 유효 20행

| AC | 자기결과 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | S1 ko/en Connected·연결됨, 목록·상세 기본 제공/액션 부재 |
| AC2 | ✅ | S2 tool_approval·ask_question·plan_review 3종 Map·같은 파랑 class |
| AC3 | ✅ | S2 viewed 요청 부재·열람 acknowledge 후 재출현 없음 |
| AC4 | ✅ | S2 마지막 사유·삭제·동일 사유 state identity |
| AC5 | ✅ | S2 미지·null·불일치·pending fallback·삭제·unsubscribe 요청 부재 |
| AC6′ | ✅ | S3 배경 Bash/PowerShell/Agent/Monitor/Workflow/MCP 종류별 표시·완료 보존 |
| AC7′ | ✅ | S3 양성과 함께 foreground·ambient·Read/MCP/Workflow 실패 목록/count/dismiss 부재 |
| AC8′ | ✅ | S3 배경 Agent/셸 상세·중단·완료 지우기 기존 의미 |
| AC9′ | ✅ | S4 빈 입력에서 파일 요청 본문+allow plan/path |
| AC10′ | ✅ | S4 T/선언/없음×빈/틀림/맞음×서술 18조합, 파일 없는 입력 불변 |
| AC11 | ✅ | S4 agent_id·오류·외부/비md·Stop·상한·링크·부재 판정 |
| AC14′ | ✅ | S4 실제 query 포획 hook Write→ExitPlanMode→Stop·env 우선순위 |
| AC15 | ✅ | S5 최신 publishedAt·동시각 최신입력·첫 위치 SSR |
| AC16 | ✅ | S5 artifact/legacy·다른 filename/턴 보존·실제 saveAll refs |
| AC17 | ✅ | S5 Work/Code×진행/완료 4조합 카드→meta·spark1 |
| AC18 | ✅ | lint 0 error·기존 warning1, typecheck 3구성 진단0, 영향249파일2031케이스 green, 문서3검사 정상. trailer는 커밋 직후 git log로 재확인 |
| AC19 | ⚠️ | PG-01 실제 두 반례; 정상 fixture green만 보존 |
| AC20 | ✅ | S3 실제 openSubagentTask·Agent/Task 상세·목록복귀 부재 |
| AC21 | ✅ | S4 본문 BOM/CRLF/끝 공백·win32 경로 대소문자 정규화·입력 참조 동일 |
| AC22 | ✅ | S1 settings/runtime 병합3개·추가/제거·빈0개 SSR 카드 수 비교 |

### 재현 명령 키

app에서 `.\node_modules\.bin\vitest.cmd run <아래 경로>`를 실행한다. 각 basename 뒤 `.test.ts`를 붙인다.

전체 영향 게이트의 실제 명령:

```powershell
npm run lint
npm run typecheck
.\node_modules\.bin\vitest.cmd run src/main/adapters/plan-file.test.ts src/main/adapters/plan-file.reader.test.ts src/main/adapters/plan-text.test.ts src/main/adapters/claude.canusetool.test.ts src/main/adapters/claude.plan-file.test.ts src/main/adapters/claude.plan-narrative.test.ts src/main/adapters/claude.turnEnd.test.ts src/main/adapters/claude-output-files.test.ts src/shared/background-task.test.ts src/main/features/chat/background-tasks.test.ts src/main/features/chat/session-activity-projector.test.ts src/renderer/src/features/sessions src/renderer/src/app/hooks src/renderer/src/features/chat src/renderer/src/features/skills src/renderer/src/features/engine src/renderer/src/shared/i18n
node scripts/check-doc-inventory.mjs --check
```

- 최종 상태 재조회: plan 메타 `DRAFT — 구현 중 PLAN_GAP`, INDEX `plan/DRAFT·Claude(설계 정정)`을 다시 읽어 두 사본이 일치함을 확인했다. V 규범 Decision·AC·pair·§10은 수정하지 않았다.
- 퇴역 이름/철회 필드 검색: production `unseenCompletedIds`·`subscribeSessionCompletions`·`resolvePlanText` 0행, shared/renderer `planFilePath`·계획 캡션 추가 0행. 테스트의 구 이름 음성 단언 1행은 유지했다.
- PG-01 재현 입력: 실제 `ClaudeBackgroundMapper.map` 결과를 같은 `applyBackgroundEvent` 상태에 누적한다. 현재 세대는 `system/background_tasks_changed`의 `tasks:[{task_id:'a'},{task_id:'b'}]` 뒤 `tasks:[{task_id:'b'}]`; 이전 원격은 `assistant.tool_use(Agent)`→`user.tool_result`의 `tool_use_result:{status:'remote_launched',taskId:'remote-task'}`→`system.task_started(task_type:'remote_agent',is_backgrounded:true)` 뒤 새 Mapper의 `system.background_tasks_changed(tasks:[])`다. `projectBackgroundPanel` 작업 중 `!backgroundTaskDisplay(...).settled` 집합과 shared 집합을 비교했다. 원시 이벤트 해석 오류는 두 경우 모두 0건이다.

- **S1**: `src/renderer/src/shared/i18n/resources/resources.test.ts`, `features/skills/lib/providerRows`, `features/skills/components/customize/CustomizeList.render`, `ProviderDetail.render`, `features/engine/components/AgentEnvironmentView.count`, `features/chat/lib/parts`, `features/chat/components/transcript/TurnOutputCards`, `features/chat/components/ArtifactCards.lifecycle`(renderer 경로 공통).
- **S2**: `src/renderer/src/features/sessions`, `src/renderer/src/app/hooks`, `src/renderer/src/features/chat/store/chatStore.background-open.test.ts`. 개별 nav 기준선 11파일83케이스와 전체 영향 게이트에서 관측했다.
- **S3**: `src/shared/background-task.test.ts`, `src/main/features/chat/background-tasks.test.ts`, `session-activity-projector.test.ts`; renderer `features/chat/lib/canonicalBackground.visibility`, `canonicalBackground.settlement`, `features/chat/store/backgroundStore.panel`, `chatStore.background-open`, `features/chat/components/rightpanel/CanonicalBackgroundContent.render`, `CanonicalBackgroundContent.wiring`.
- **S4**: `src/main/adapters/{plan-file,plan-file.reader,plan-text,claude.canusetool,claude.plan-file,claude.plan-narrative,claude.turnEnd,claude-output-files}.test.ts`(실행 시 8개 명시 경로로 펼침, `--maxWorkers=1`).
- **S5**: renderer `features/chat/lib/parts`, `features/chat/components/transcript/TurnOutputCards`, `features/chat/components/ArtifactCards.lifecycle`。

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 최초 구현 r1, 이전 impl/verify 없음.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: AC19의 정상 등식과 D-022의 관측 이력 보존은 각각 있으나 live에서 빠진 미종료 항목의 그룹/포함 기준이 없다. 기존 remote 정착·종료 추측 금지 테스트가 그 반례 상태를 보존한다.
- 반복해서 부딪히는 환경 한계: SSR은 effect 실행·mount 횟수를 직접 보지 않는다. app 배선은 등록 B1 변이, 카드 고정 슬롯은 실제 JSX+4조합 SSR으로 관측했다. 시각/custom 모델 실기는 §19대로 남긴다.
- 현재 라운드·impl 턴: **r1**. PLAN_GAP을 formal verify 결과로 가장하지 않았고 `impl/IMPL_DONE`으로 넘기지 않았다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
