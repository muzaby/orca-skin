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
| 상태 | READY (ΔV3.4) — 승인 await 전 메인 턴 취소 신호 보존 |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | V1 = `none`(신규) · ΔV1 = `0249:V1@266bdbfe` · ΔV2 = `0249:ΔV1@c6e7b7e1`(모두 공유 브랜치 확인). 다른 handoff 의 동작은 `INHERITED` 회귀로만 둔다 |
| 이번 V revision | `ΔV3.4` — 승인 await 전 메인 턴 취소 신호 보존 |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV3.1 + ΔV3.2 + ΔV3.3 + ΔV3.4` |
| 구현 주체 | Codex — r1(`61c12248`)부터 사용자 지시(`[구현자 기입]` 설계 리뷰). V1 작성 시점 계획은 Claude 였다 |

> **ΔV1 적용(2026-10-04)** — ③ 백그라운드 패널·④ ExitPlanMode 에 관한 V1 서술(§1·§2·§5·§6·§7·§7-A·§9~§19 의 해당 행)은 문서 끝 **§ΔV1** 이 대체한다. ⑦ 엔진&모델 개수는 ΔV1 신설이다. 유효 AC 20.
> **ΔV2 적용(2026-10-04)** — r1 이 올린 PLAN_GAP PG-01(AC19)을 닫는다. AC19·VP-23·VP-24 와 백그라운드 표시 정착 규칙은 문서 끝 **§ΔV2** 가 정본이다. 유효 AC 21.
> **ΔV3 적용(2026-10-06)** — 문서 끝 **§ΔV3**가 계획 콜백의 보정 입력을 카드·이력까지 연결하고 Enter/Exit 실제 모드 보고를 동기화한다. 승인 시점 파일 정본·계획 패널 UI 불변은 유지한다. 유효 AC 25.

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
| D-030 (ΔV2) | 현재 세대 live 목록이 확립된 뒤 그 목록에 없고 종료 증거도 없는 백그라운드 작업, 그리고 이전 세대·`terminated` 연결의 원격 작업은 **표시만** 정착한다 — 완료 그룹 '종료 확인 불가'(`unconfirmed`), 경과는 마지막 관측에서 멈춘다. 이후 종료 증거가 오면 실제 결과로 바뀐다. canonical 기록은 바꾸지 않는다 | 결정⑯ — 실행 중 = Spark N(결정⑪)을 지키면서 종료를 합성하지 않는다(0231 D-06) | 결정⑯ | ACTIVE | 0239 D-012 확장 · 0231 원격 미정착 표시 변경(§ΔV2 Δ7) |
| D-031 (ΔV2) | 그 결과 도달 불가가 된 `excluded` 표시 상태(분기·union·라벨 맵·i18n `background.excluded`)를 삭제한다 | D-015 와 같은 규칙 — 죽은 형제 분기가 검사 장치를 침묵시킨다 | 설계 | ACTIVE | — |
| D-032 (ΔV3) | 메인 ExitPlanMode의 파일 보정 입력은 승인 action.input·CLI allow·도구 호출 args·저장 이력에 함께 적용한다. 원본의 추가 필드는 보존한다 | 사용자 2026-10-06: 정확한 데이터가 충족하지 않았을 때 폴백으로 보정된 값이 채워져야 한다 | 이번 요청 | ACTIVE | D-025·D-026 보완, 카드 새 레이아웃 없음 |
| D-033 (ΔV3·ΔV3.3) | 승인 콜백이 읽은 최신 파일이 그 호출의 정본이다. 먼저 온 started의 읽기를 콜백이 재사용하지 않는다. toolUseId와 소유 세션으로 기존/늦은 호출을 같은 값으로 보정한다. 화면의 계획 응답도 현재 미해결 요청 ID와 일치할 때만 발신·해소한다 | SDK control_request와 assistant 소비는 독립 비동기 경로다. 화면 응답의 소유권도 유지한다 | 설치 SDK sdk.mjs, 독립 X2 | ACTIVE | Stop 뒤 새 요청에 이전 파일을 재사용하지 않음 |
| D-034 (ΔV3·ΔV3.3) | child 호출에는 메인 계획 파일·서술을 주입하지 않고 메인 도구 카드·계획 모드도 바꾸지 않는다. 파일 출처가 없으면 D-025·D-026의 입력/서술 폴백을 유지하며 경로를 만들지 않는다 | 메인 파일 추적 D-015와 Product/UX child 행의 동일한 소비 경계 | 이번 진단·독립 X2 | ACTIVE | 추가 필드 삭제·파일 검색 추측 없음 |
| D-035 (ΔV3) | EnterPlanMode 입력 `{}`·출력 `message`, Exit 내부 입력 `planFilePath`·출력 `filePath`를 구별한다. 유효한 main/live SDK init/status의 실제 권한 모드를 controller·renderer에 반영한다 | CLI가 계획 모드에 들어가도 현재 앱은 status.permissionMode를 버린다 | 설치 SDK 0.3.286·CLI 2.1.286 | ACTIVE | 세션 생성 이벤트를 bus에 재발행하지 않음 |

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
- **ΔV2(PLAN_GAP PG-01 정정)**: r1(Codex)이 AC19 등식과 D-022·종료 합성 금지의 모순을 반례 2개로 올렸다. 사용자 결정⑯ 으로 D-030·D-031 신설, AC19 → AC19′ 대체, AC23 신설. SUPERSEDED Decision 0.
- **`ACTIVE 결정 ↔ AC` 대조(ΔV2)**: 충돌 0.
  - D-030 ↔ AC19′(반례 포함 등식)·AC23(완료 그룹 '종료 확인 불가'·기록 불변) → 일치. D-022 ↔ AC19′ → D-022 는 카드 *표시 여부*, D-030 은 *그룹*을 정해 충돌하지 않는다.
  - D-031 ↔ AC23 → '종료 확인 불가' 단일 라벨 → 일치. 0231 D-06 ↔ AC23 의 기록 불변 단언 → 일치.

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
| AC19 → **ΔV2 AC19′** | NEW | **Spark 동기** — 정상 상태에서 실행 중 카드의 작업 id 집합 = `countedBackgroundTaskIds(state)` 이고 main 의 Spark 개수 = 그 길이다. 작업 하나가 끝나면(통지 + 다음 live 목록) 둘 다 1 줄고 그 카드는 완료 그룹으로 간다 | renderer: 집합 등식 · main: `BackgroundTaskTracker.count` = 같은 함수 길이(ambient·`liveKnown=false` 포함) | Spark: tracker → `session-activity-projector` → `chat.activity` → StatusLine · 패널: 위 경로 |
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
| VP-23 → ΔV2 VP-23′ | R-03 ↔ AT-19 | REQUIRED | live 목록 → shared 집합 → (main) count → activity / (renderer) 실행 중 카드 | 집합 등식 + 길이 등식 + 종료 후 둘 다 −1 | **required** — 등식 주장. M-S1(`background-tasks.ts` count 를 ambient 포함으로 재구현) / M-S2(`canonicalBackground.ts` Spark 집합 항 제거 + call.mode 증거 제거) / M-S3(같은 파일 포그라운드 Agent 노출) | EP-03′ ①②④⑤⑥ (5) |
| VP-24 → ΔV2 VP-24′ | SD-03 ↔ ST-03 | REQUIRED | 시작 → live 포함 → 종료 통지 → live 제외 | 단계별 그룹·count | not selected | EP-03′ ①④ (2) |
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

---

# ΔV2 — PLAN_GAP PG-01 정정 (2026-10-04)

> 기준 = `0249:ΔV1@c6e7b7e1`. r1 구현(`61c12248`, Codex)이 AC19 경로를 멈추고 PG-01 을 올렸다(`[구현자 기입] 놓친 잠재 문제` PG-01).
> **이 절이 AC19·VP-23·VP-24 와 백그라운드 표시 정착 규칙의 정본이다.** 라운드 1 그대로 — 구현 중 PLAN_GAP 정정이라 다음 impl 턴은 `r1.2`.

## Δ1. PG-01 — 무엇이 모순이었나

| 항목 | 관측 | 근거 |
|---|---|---|
| 반례 ① | 현재 세대 live `[a,b]` → `[b]`, `a` 종료 통지 없음 → Spark 1 · 실행 중 카드 2(`a` = "실행 목록에서 제외됨 · 종료 사유 미확인") | `backgroundPresentation.ts:8`(`excluded`) · `canonicalBackground.ts:109`(`settled:false`) · `[구현자 기입]` PG-01 재현 입력 |
| 반례 ② | 이전 세대 원격 Agent 작업 + 새 프로세스 live `[]` → Spark 0 · 실행 중 카드 1 | `canonicalBackground.ts:103` `if (!remote && deadGeneration(…))` — 원격은 이전 세대여도 정착하지 않는다 |
| 모순 | AC19 "실행 중 = Spark 집합" ↔ D-022 의 관측 이력 포함 + 종료 합성 금지(0231 D-06)·원격 존속 추정 금지(0231) | 실행 중 그룹에 넣을지의 기준이 plan 에 없었다 — 구현자가 정할 수 없는 제품 정책이다 |
| 비교 | Spark 개수는 이 두 작업을 세지 않는다(live 미포함·`terminated` 이면 `liveKnown=false`) | `background-tasks.ts:193-202` · `background-task.ts` `applyBackgroundEvent` connection 분기 |

## Δ2. 결정과 Product / UX

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 결정 ⑯ | 현재 정책 설명 후 — Spark 목록에서 빠졌는데 종료 통지가 없는 작업 = "완료 그룹 '종료 확인 불가'" | AskUserQuestion 답변 |

### 상태와 전이 (추가)

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 현재 세대 live 목록에서 빠짐 + 종료 통지 없음 | **표시만** 정착 — canonical 기록은 그대로 | 완료 그룹 '종료 확인 불가', 경과 정지, 중단 버튼 없음, 완료 지우기 대상 |
| 위 상태에서 종료 통지 도착 | 기록에 실제 결과 | 같은 완료 그룹에서 완료·실패·중단 라벨로 바뀜 |
| 이전 프로세스의 원격 작업(새 live 목록에 없음) · 연결 `terminated` 의 원격 작업 | 표시만 정착 | 완료 그룹 '종료 확인 불가' |
| 이전 프로세스의 비원격 작업 | 기존 그대로(0239 D-012) | 완료 그룹 '종료 확인 불가' |
| 일시 차이(등식 밖) | ① live 포함 전 launch 카드 ② 첫 live 목록 전(시작·재연결 직후) ③ 종료 통지가 live 갱신보다 먼저 온 직후 | 다음 live 목록에서 맞춰진다 |

## Δ3. Decision Ledger 변경

§3 표에 반영 — 신설 D-030·D-031. SUPERSEDED 없음(AC19 는 Δ4 에서 대체).

## Δ4. Acceptance — 변경·신설·대체

| AC | provenance | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| AC19′ | CHANGED (AC19 대체) | **Spark 동기** — 정상 상태에서 실행 중 카드의 작업 id 집합 = `countedBackgroundTaskIds(state)` 이고 main 의 Spark 개수 = 그 길이다. **PG-01 두 반례에서도 성립한다**(① 실행 중 {b} · Spark 1 ② 실행 중 ∅ · Spark 0). 작업 종료 시 둘 다 1 줄고 카드는 완료 그룹으로 간다. Δ2 의 일시 차이 3종은 등식 밖이다 | renderer: 실제 `ClaudeBackgroundMapper.map` → `applyBackgroundEvent` 누적 state(정상·반례①②)에서 실행 중 집합 = shared 집합 · main: `BackgroundTaskTracker.count` = 같은 함수 길이 | Spark: tracker → `session-activity-projector` → `chat.activity` · 패널: `projectBackgroundPanel` + `backgroundTaskDisplay` → `CanonicalBackgroundContent` 그룹 |
| AC23 | NEW | live 목록에서 빠졌는데 종료 통지가 없는 작업과 이전 세대·`terminated` 원격 작업은 **완료 그룹 '종료 확인 불가'** 다 — 경과가 마지막 관측에서 멈추고 중단 버튼이 없고 완료 지우기로 지울 수 있다. 이후 종료 통지가 오면 같은 카드가 실제 결과 라벨이 된다. canonical 기록의 `status` 는 바뀌지 않는다 | SSR + 단위: 상태 시퀀스별 그룹·라벨·중단 버튼 부재·지우기 대상 포함 + `state.tasks[key].status` 불변 | 동일 |
| AC19 | SUPERSEDED → AC19′ | — | — | — |

- 유효 AC 분모: ΔV1 20 − 1(AC19) + 1(AC19′) + 1(AC23) = **21**.
- 뒤집히는 기존 단언(전수 — `git grep "excluded\|remote" -- '*.test.ts'` 로 찾은 3곳):
  - `canonicalBackground.settlement.test.ts:114-135` 'settles a nonremote %s task at lastSeenAt' — 원격(`remote_agent`·`mode:'remote'`)이 이전 세대·`terminated` 에서 미정착임을 단언 → `unconfirmed`·정착으로 뒤집는다. 비원격 단언은 유지.
  - 같은 파일 `:145-161` 'settles dead awaitingTask calls but preserves remote calls' — 원격 호출 미정착 단언 → 정착으로 뒤집는다.
  - `backgroundPresentation.test.ts:9-22` — `backgroundTaskStatus(...) === 'excluded'` 단언 → D-031 로 상태가 사라진다. 같은 시퀀스를 `backgroundTaskDisplay` 의 `unconfirmed`·정착과 이후 통지 반영으로 다시 단언한다.

## Δ5. V / Trace Matrix — Delta (ΔV2)

- 기준: `0249:ΔV1@c6e7b7e1`(공유 브랜치 확인). r1 구현 `61c12248`(공유 브랜치 `origin/codex-0249-nav-attention-plan-file-output-cards` 확인).
- `SUPERSEDED` pair 이관: VP-23(AC19, M-S1~M-S3) → **VP-23′**(AC19′, M-S1~M-S3 그대로 + M-S4·M-S5 신설). VP-24 → **VP-24′**(수명에 제외 → 종료 확인 불가 → 통지 단계 추가). r1 의 M-S1~M-S3 red 관측은 VP-23′ 의 같은 ID 로 승계한다.

### Node registry (ΔV2)

| Node | 레벨 | 계약 | provenance | 기준선 / 대체 |
|---|---|---|---|---|
| R-03 | R | ΔV1 R-03 + D-030 표시 정착 | CHANGED | ΔV1 R-03 |
| AT-19 | AT | — | SUPERSEDED | → AT-19′ |
| AT-19′ | AT | AC19′ | CHANGED | ΔV1 AT-19 |
| AT-23 | AT | AC23 | NEW | — |
| SD-03 | SD | 수명 = 시작 → live 포함·실행 중 → (종료 통지 \| live 제외 → 종료 확인 불가 → 통지) → 완료 | CHANGED | ΔV1 SD-03 |
| MD-07 | MD | `backgroundTaskDisplay`·`backgroundCallDisplay` 정착 규칙(D-030) + `excluded` 표시 상태 삭제(D-031) | NEW | — |
| R-0239-12 | R | 0239 D-012 — 이전 세대 비원격 작업 '종료 확인 불가' | INHERITED | `docs/handoff/0239-foreground-cancel-settlement/plan.md` D-012 |
| R-0231-06 | R | 0231 D-06 — 종료를 합성하지 않는다(기록 불변) | INHERITED | `docs/handoff/0231-background-task-conformance/plan.md` D-06 |

### Pair registry (ΔV2)

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 (자리) | §10 |
|---|---|---|---|---|---|---|
| VP-23′ | R-03 ↔ AT-19′ | REQUIRED | live 목록 → shared 집합 → (main) count / (renderer) 투영 + 표시 정착 → 실행 중 그룹 | 집합 등식(정상·반례①②) + 길이 등식 | **required** — 등식 주장. M-S1·M-S2·M-S3(ΔV1 그대로) / M-S4(`canonicalBackground.ts` `backgroundTaskDisplay` 의 live 제외 정착 제거 → 반례① red) / M-S5(같은 함수에 원격 이전 세대 예외 복원 → 반례② red) | EP-03′ ①②④⑤⑥ + EP-09 ①② (7) |
| VP-24′ | SD-03 ↔ ST-03 | REQUIRED | 시작 → live 포함 → live 제외(통지 없음) → 종료 확인 불가 → 통지 → 실제 결과 | 단계별 그룹·라벨·Spark 개수 | not selected | EP-09 ①② (2) |
| VP-29 | R-03 ↔ AT-23 | REQUIRED | 상태 → `backgroundTaskDisplay` → 카드 그룹·라벨·경과·중단 버튼·지우기 | SSR 출력 + 지우기 결과 + 기록 `status` | not selected — 직접 관측 | EP-09 ①②③④⑤⑥ (6) |
| VP-30 | MD-07 ↔ UT | REQUIRED | — | 정착 진리표(종료 증거 · `liveKnown` · membership · 세대 · `connection` · 원격 · 포그라운드 반환) + `excluded` 부재 | not selected | EP-09 ①⑥ + EP-10 (7) |
| VP-31 | R-0239-12 ↔ AT(0239) | REGRESSION | 이전 세대 비원격 → 완료 '종료 확인 불가' | 기존 비원격 단언 green(`canonicalBackground.settlement.test.ts:114` 비원격 부분) | not selected | EP-09 ① (1) |
| VP-32 | R-0231-06 ↔ AT(0231) | REGRESSION | 표시 정착이 canonical 기록을 바꾸지 않는다 | `state.tasks[key].status` 불변 · 이후 통지 반영 | not selected | EP-09 ① (1) |

## Δ6. Technical Design — Delta (ΔV2)

### AS-IS → TO-BE

| 비교 축 | AS-IS (r1) | TO-BE (ΔV2) | V 연결 |
|---|---|---|---|
| live 제외 + 미종료(현재 세대) | `excluded` 상태, `settled:false` → 실행 중 그룹 | `unconfirmed`, `settled:true`, `endedAt = task.lastSeenAt` → 완료 그룹 | MD-07 / VP-30 |
| 원격 + 이전 세대·`terminated` | 미정착(실행 중) | `unconfirmed` 정착 — 작업·작업 없는 호출 모두 | MD-07 / VP-30 |
| `excluded` 표시 상태 | `backgroundTaskStatus` 분기 · union · 라벨 맵 · i18n | 삭제(D-031) — 도달 불가 | MD-07 / VP-30 |
| 기록 | — | 불변(표시 파생만) | R-0231-06 / VP-32 |

### 구현 설계 (ΔV2)

| 파일 | 변경 |
|---|---|
| `app/src/renderer/src/features/chat/lib/canonicalBackground.ts` | `backgroundTaskDisplay` 분기 순서: ① 종료 증거(기존) ② 포그라운드 부모 반환(기존) ③ `deadGeneration` 이면 **원격 여부와 무관하게** `unconfirmed` 정착(`endedAt = task.lastSeenAt`) ④ **현재 세대 ∧ `state.liveKnown` ∧ `task.liveMembership === 'excluded'`** 이면 `unconfirmed` 정착 ⑤ 그 밖은 `backgroundTaskStatus`. `backgroundCallDisplay` 의 `call.mode !== 'remote'` 예외 제거(③과 같은 규칙). `BackgroundDisplayStatus` 에서 `'excluded'` 제거 |
| `app/src/renderer/src/features/chat/lib/backgroundPresentation.ts` | `backgroundTaskStatus` 의 `excluded` 분기·반환 타입 제거. `canStopBackgroundTask` 의 membership 검사는 유지(데이터 축) |
| `app/src/renderer/src/features/chat/components/rightpanel/CanonicalBackgroundContent.tsx` | `DISPLAY_LABEL` 의 `excluded` 행 제거(`Record` 전수 맵이라 union 과 함께 typecheck 가 강제) |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | `background.excluded` 키 제거(소비처 0이 되면) |
| 기록 쪽 | 변경 없음 — `shared/background-task.ts` `applyBackgroundEvent` 는 membership·status 를 지금처럼 기록한다 |

### §10 강제 지점 (ΔV2 — EP-09·EP-10 신설)

| V node / pair | 계약 | SSOT | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|
| R-03·SD-03·MD-07 / VP-23′·24′·29·30·31·32 | Spark 밖 미종료 → 완료 '종료 확인 불가'(표시만) | `backgroundTaskDisplay` · `backgroundCallDisplay` | **EP-09** ① `canonicalBackground.ts` `backgroundTaskDisplay` ② `CanonicalBackgroundContent.tsx:110` 그룹 분류 ③ `CanonicalBackgroundContent.tsx:197-203` 카드 라벨·경과·중단 버튼 ④ `canonicalBackground.ts:131` 지우기 가드 ⑤ `backgroundStore.ts:70` 완료 지우기 ⑥ `canonicalBackground.ts` `backgroundCallDisplay` 원격 예외 (6) | ② ~ ⑤ 중 하나가 membership·원격을 직접 읽으면 그룹·라벨·지우기가 갈라진다 · ⑥ 을 빼면 작업 없는 원격 호출이 실행 중에 남는다 |
| MD-07 / VP-30 | `excluded` 표시 상태 부재 | `BackgroundDisplayStatus` union | **EP-10** ① `backgroundPresentation.ts` 반환 타입 ② 같은 파일 분기 ③ `canonicalBackground.ts` union ④ `CanonicalBackgroundContent.tsx` 라벨 맵 ⑤ `ko.ts` 키 ⑥ `en.ts` 키 (6) | union 만 지우고 분기를 남기면 typecheck 가 잡는다 — 라벨 맵은 `Record` 전수라 남은 키도 잡힌다. i18n 키는 typecheck 밖이라 `git grep "background.excluded"` 0건으로 확인 |

## Δ7. 기존 결정·규칙과의 관계 (ΔV2)

| 기존 결정/규칙 | 출처 | 결과 |
|---|---|---|
| ACK·timeout·snapshot 제외로 종료를 합성하지 않음 | 0231 D-06 | **유지** — 기록은 바꾸지 않고 표시만 정착한다 |
| 원격 worker 의 존속·성공을 추정하지 않음 | 0231 (plan :662) · `canonicalBackground.settlement.test.ts:114`·`:145` | **변경(표시 그룹만)** — '종료 확인 불가'는 종료·성공 주장이 아니다. 이전 세대·`terminated` 원격 카드가 실행 중 대신 완료 그룹에 간다(결정⑯) |
| 이전 세대 비원격 작업 '종료 확인 불가' | 0239 D-012 | **유지·확장** — 같은 상태를 현재 세대 live 제외와 원격으로 넓힌다 |
| "실행 목록에서 제외됨 · 종료 사유 미확인" 표시 | 0231 패널 라벨(`background.excluded`) | **변경** — '종료 확인 불가'로 통일하고 상태·라벨 삭제(D-031) |
| 문서 `rendering.md:13` "종료된 비원격 프로세스의 미확인 작업이 완료 그룹에 들어간다" | `docs/arch/frontend/rendering.md` | **변경** — "live 목록에서 빠졌는데 종료 통지가 없는 작업과 이전 프로세스·종료된 연결의 작업(원격 포함)이 완료 그룹 '종료 확인 불가'에 들어간다"로 고친다 |

## Δ8. 영향 파일·문서 (ΔV2)

- 코드: `canonicalBackground.ts` · `backgroundPresentation.ts` · `CanonicalBackgroundContent.tsx` · i18n `ko.ts`·`en.ts`.
- 테스트: `canonicalBackground.settlement.test.ts`(:114·:145 뒤집기) · `backgroundPresentation.test.ts`(:9 다시 쓰기) · AC19′ 반례 재현(r1 의 PG-01 재현 입력을 테스트로 고정) · AC23 SSR.
- 문서: `docs/arch/frontend/rendering.md:13` · `docs/arch/backend/background-tasks.md:17`(표시 정착 순서에 live 제외 추가).
- 게이트: ΔV1 Δ8 과 같은 스위트.

## Δ9. READY self-review (ΔV2)

- [x] PG-01 의 두 반례를 코드 줄로 재현 근거를 적었다(Δ1 — `backgroundPresentation.ts:8`·`canonicalBackground.ts:103`·`:109`).
- [x] 제품 정책은 사용자 결정⑯ 으로 닫았다(구현자가 정하지 않음).
- [x] AC19 를 supersede 하고 AC19′ 가 반례 두 개를 직접 포함한다. 새 상태는 AC23 으로 양성 단언한다.
- [x] 뒤집히는 기존 단언 3곳을 grep 으로 전수 적었다(Δ4).
- [x] 새 §10 행의 분모는 자리 단위(EP-09 6 · EP-10 6), 등록 변이 M-S4·M-S5 는 심을 파일을 적었다.
- [x] 기록 불변(0231 D-06)을 REGRESSION pair VP-32 로 잠갔다.
- [x] 유효 AC 분모 21.

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

# [구현자 기입] r1 기록 — V1 + ΔV1

> 아래 r1의 `19/20`·PG-01·DRAFT 판정은 당시 기록이다. 현재 구현 자기보고는 뒤의 **r1.3 — CI 게이트 보완** 절이 정본이다.

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

# [구현자 기입] r1.2 — V1 + ΔV1 + ΔV2

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: 원격 ΔV2 설계 커밋을 fast-forward로 동기화하고 D-030·D-031을 구현했다. plan 메타의 READY·유효 V를 다시 읽었고 규범 Decision·AC·pair·§10은 수정하지 않았다.
- 이견 / 현실성 문제: 없음. 실제 Mapper 반례에서 현재 live 제외 작업과 이전 세대 원격 작업을 표시만 정착시켜 Spark 집합과 맞췄다(S6).
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 현재 연결을 '프로세스 종료'로 잘못 표시하는 카드 조건은 실제 세대·연결 상태로 바로잡았다(S6 음성·기존 S3 양성).

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·22 | 로그인 프리 상태 | EP-01 5 | 5/5: ko/en·row meta·목록·상세 | S1, 연결됨/Connected·기본 제공·인증 액션 부재 | 없음 |
| VP-02~05·19 | 완료·응답 대기 Map | EP-02 8 | 운반 세분 10/10 | S2, 3종 요청→같은 파랑·열람/삭제·last wins | 없음 |
| VP-06′·07′·08′·21′·23′·24′·25 | 패널 투영·Spark | EP-03′ 9 | 운반 세분 17/17 | S3+S6, 실제 Mapper 두 반례에서 실행 중 집합={b}/∅, Spark=1/0 | 없음 |
| VP-09′·10·11′·12·13′·20 | 계획 파일·CLI 반환 | EP-04′ 7 | 운반 세분 8/8 | S4, 실제 query·파일·Stop·출처 표·원본 입력 참조 | 없음 |
| VP-15·16 | 한 턴 최신 파일 | EP-05 2 | 2/2 | S5, 최신 ref·최초 위치·category 경계·실제 saveAll 인자 | 없음 |
| VP-17·18 | 카드→메타 슬롯 | EP-06 1 | 1/1 | S5, Work/Code×pending/done 순서·spark 1개 | 없음 |
| VP-27·28 | 엔진 카드 수 | EP-07 3 | 3/3 | S1, settings+runtime 3개·증감·빈 0개·설명 부재 | 없음 |
| VP-26·08′ | 인라인 Agent 상세 | EP-08 2 | 2/2 | S3, 실제 openSubagentTask 선택·Agent/Task 상세·Read 실패 선택 부재 | 없음 |
| VP-23′·24′·29·30·31·32 | 종료 확인 불가 표시 정착 | EP-09 6 | 운반 세분 17/17 | S6, 그룹·라벨·6s 고정·중단 부재·지우기·후속 통지·기록 불변 | 없음 |
| VP-30 | excluded 표시 퇴역 | EP-10 6 | 6/6 | S6 진리표·typecheck·키 검색 0건, OR-1 민감도 2건→원복 0건 | 없음 |

- 독립 분모: EP-02의 두 구독과 effect는 3자리, EP-04′의 hook 편입과 getter는 2자리다. EP-03′ 세분은 1+1+3+1+1+4+1+3+2=17이며, 각 지정 모듈 내부의 소비 의미를 센다.
- EP-09 세분: task/call 표시 함수 2 + task/call 그룹 분류 2 + TaskCard의 표시 입력·라벨·틱 중지·endedAt 계산·중단 guard·중단 버튼·연결 배지 7 + CallCard 표시 입력·라벨 2 + task/call dismiss guard 2 + task/call 완료 지우기 2=17이다. EP-10은 반환 타입·분기·display union·라벨 맵·ko 키·en 키를 각각 센 6자리다.
- 검색으로 구한 투영 소비 파일 3개와 지정 소비 파일 3개의 차집합은 0행이다. 계획 출처/소비 파일 3개와 지정 파일 집합의 차집합도 0행이며, partsArtifacts의 transcript 소비는 AssistantTurn 1곳이다.
- §10 밖의 같은 불변식: TaskCard 연결 종료 배지 조건을 현재 live 제외의 unconfirmed 상태에도 소비하는 자리로 조사했다. S6 현재 연결의 '프로세스 종료' 부재와 S3 실제 종료 배지 양성으로 닫았다.
- 퇴역 검색: 표시 관련 5파일의 excluded 잔여는 중단 판단과 표시 정착의 raw liveMembership 비교 2줄뿐이다. background.excluded 참조와 locale의 excluded 키는 각각 0건이며 raw membership은 보존했다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | S1 카탈로그·목록·상세 SSR | not selected |
| VP-02 | REQUIRED | SELF_PASS | S2 실제 3종 ingest→Map→아이콘 | B1·B2·B3 red |
| VP-03 | REQUIRED | SELF_PASS | S2 열람 acknowledge·사유 교차·삭제 | not selected |
| VP-04 | REQUIRED | SELF_PASS | S2 app 구독 값·lint boundaries 오류 0 | not selected |
| VP-05 | REQUIRED | SELF_PASS | S2 store 값·동일 사유 identity | not selected |
| VP-06′ | REQUIRED | SELF_PASS | S3 양성/음성 같은 state·종류별 카드 | C1′~C4′ red |
| VP-07′ | REQUIRED | SELF_PASS | S3 ambient·Spark·증거·foreground 진리표 | not selected |
| VP-08′ | REQUIRED | SELF_PASS | S3 목록·선택·지우기 공통 투영 | not selected |
| VP-09′ | REQUIRED | SELF_PASS | S4 요청 본문·allow 입력·출처 조합 | D1·D2′·D3′·D4′·D10 red |
| VP-10 | REQUIRED | SELF_PASS | S4 마지막 메인 쓰기·Stop 비움 | D5·D6 red |
| VP-11′ | REQUIRED | SELF_PASS | S4 query 포획·hook/getter 공유 셀·env | D7·D8·D9 red |
| VP-12 | REQUIRED | SELF_PASS | S4 경로·상한·링크·부재·reader 오류/close | not selected |
| VP-13′ | REQUIRED | SELF_PASS | S4 실제 resolver의 출처·정규화·참조 | not selected |
| VP-15 | REQUIRED | SELF_PASS | S5 최신 파일·첫 위치·실제 saveAll | E1·E2·E3 red |
| VP-16 | REQUIRED | SELF_PASS | S5 partsArtifacts 반환·category 경계 | not selected |
| VP-17 | REQUIRED | SELF_PASS | S5 Work/Code×진행/완료 순서 | not selected |
| VP-18 | REGRESSION | SELF_PASS | S5 이전 턴·pending fallback·spark 1개 | not selected |
| VP-19 | REGRESSION | SELF_PASS | S2 기존 완료 의미·같은 파랑 | not selected |
| VP-20 | REGRESSION | SELF_PASS | S4 서술/empty·plan0215.render | not selected |
| VP-21′ | REGRESSION | SELF_PASS | S3 foreground 셸 제외·배경 Agent 상세 | not selected |
| VP-22 | REGRESSION | SELF_PASS | S1 기본 제공·인증 액션 부재 | not selected |
| VP-23′ | REQUIRED | SELF_PASS | S6 실제 Mapper 정상+반례①②의 집합/길이 등식 | S1~S5 red |
| VP-24′ | REQUIRED | SELF_PASS | S6 시작→live→제외→unconfirmed→실제 통지 | not selected |
| VP-25 | REQUIRED | SELF_PASS | S3+S6 같은 상태의 shared 집합·main count·SSR | not selected |
| VP-26 | REQUIRED | SELF_PASS | S3 실제 인라인 선택→숨긴 Agent 상세 | B4·B5 red |
| VP-27 | REQUIRED | SELF_PASS | S1 제목 개수=실제 카드 수·증감 | not selected |
| VP-28 | REGRESSION | SELF_PASS | S1 설명 부재·common.count 단위 | not selected |
| VP-29 | REQUIRED | SELF_PASS | S6 unconfirmed 그룹·라벨·시간·중단·clear | not selected — 직접 oracle |
| VP-30 | REQUIRED | SELF_PASS | S6 정착 진리표 26행·call 연결 2종·키 퇴역 | not selected, 키 sweep는 OR-1 |
| VP-31 | REGRESSION | SELF_PASS | S6 기존 비원격 old/terminated 정착·시간 | not selected |
| VP-32 | REGRESSION | SELF_PASS | S6 raw running/증거 불변·늦은 실제 통지 | not selected |

- 유효 pair를 규범 registry에서 다시 추출한 결과 REQUIRED 23·REGRESSION 8이다. 보고 pair와의 누락/추가 차집합은 0행이다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | r1 red | r1.2 실패 케이스 수 / 대상 | 결과 |
|---|---|---|---|---|
| M-B1 완료 전용 effect 구독 | VP-02 | 1 | 1 / useSessionCompletion 11 | red→원복 11 green |
| M-B2 요청 listener 통지 제거 | VP-02 | 4 | 4 / 같은 11 | red→원복 11 green |
| M-B3 viewed guard 제거 | VP-02 | 2 | 2 / 같은 11 | red→원복 11 green |
| M-B4 인라인 선택 연결 제거 | VP-26 | 2 | 2 / background-open 3 | red→원복 3 green |
| M-B5 선택 Agent 예외 제거 | VP-26 | 5 | 5 / S3A 11파일175 | red→바이트 원복 |
| M-C1′ 배경 술어 항상 true | VP-06′ | 35 | 35 / S3A | red→바이트 원복 |
| M-C2′ ambient 검사 제거 | VP-06′ | 10 | 10 / S3A | red→바이트 원복 |
| M-C3′ 비셸 작업 무조건 표시 | VP-06′ | 24 | 16 / S3A | red→바이트 원복 |
| M-C4′ call.mode 증거 제거 | VP-06′ | 4 | 4 / S3A | red→바이트 원복 |
| M-S1 main count에 ambient 포함 | VP-23′ | 1 | 2 / S3A | red→바이트 원복 |
| M-S2 Spark 항·call.mode 제거 | VP-23′ | 5 | 5 / S3A | red→바이트 원복 |
| M-S3 foreground Agent 노출 | VP-23′ | 24 | 16 / C3′와 같은 관측 | 공유 red |
| M-S4 live 제외 정착 제거 | VP-23′ | 신규 | 5 / S3A, 반례① 포함 | red→바이트 원복 |
| M-S5 이전 세대 remote 예외 복원 | VP-23′ | 신규 | 7 / S3A, 반례② 포함 | red→바이트 원복 |
| M-D1 file 분기에서 서술 우선 | VP-09′ | 17 | 14 / S4 8파일153 | red→원복 153 green |
| M-D2′ 파일 판정 전 입력 반환 | VP-09′ | 9 | 12 / S4 | red→원복 153 green |
| M-D3′ 일치 입력도 새 객체 | VP-09′ | 9 | 10 / S4 | red→원복 153 green |
| M-D4′ 보정 입력 경로 제거 | VP-09′ | 16 | 18 / S4 | red→원복 153 green |
| M-D5 Stop 비움 제거 | VP-10 | 3 | 3 / S4 | red→원복 153 green |
| M-D6 agent_id guard 제거 | VP-10 | 3 | 3 / S4 | red→원복 153 green |
| M-D7 계획 hook 병합 제거 | VP-11′ | 3 | 18 / S4, 직접 배선3·매처 단언15 | red→원복 153 green |
| M-D8 tracked getter를 새 셀로 | VP-11′ | 3 | 3 / S4 | red→원복 153 green |
| M-D9 getPlanFiles 배선 제거 | VP-11′ | 5 | 5 / S4 | red→원복 153 green |
| M-D10 서술을 CLI 입력에 동봉 | VP-09′ | 5 | 4 / S4 | red→원복 153 green |
| M-E1 첫 파일 버전 유지 | VP-15 | 6 | 6 / S5 3파일44 | red→바이트 원복 |
| M-E2 마지막 파일 위치 유지 | VP-15 | 7 | 7 / S5 | red→바이트 원복 |
| M-E3 category 경계 제거 | VP-15 | 9 | 9 / S5 | red→바이트 원복 |
| OR-1 locale 퇴역 키 검색 | EP-10 / VP-30 | 신규 | ko/en 키 재삽입 시 2건 | 민감도 검출→원복 0건 |

- **분모 검산**: 선택 증거 27 ID · 파생 이슈의 추가 인용 변이 0 · 새 구조 oracle 민감도 1 = 표 28행이다. 규범 등록 ID와 잠금 표 ID의 누락/추가 차집합은 0행이며 C3′/S3는 한 실제 변이를 각각 등록 ID에 귀속했다.
- C/S/B5는 실제 생산 소스 변이 뒤 S3A를 실행했고 finally 원복 뒤 11파일175케이스 green이었다. 연결 상태 진리표를 보강한 최종 S6는 3파일47케이스 green이며 S5 담당 8파일74케이스도 원복 green이다.
- r1과 r1.2의 변이 대상/치환은 같다고 가정하지 않았다. C3′·S3·D 계열의 이전 치환 원문은 미보존이며 이번 표의 정확한 치환·실패 수를 사용한다.
- D7의 추가 15개 실패는 계획 Stop 포함 매처 수를 확인하는 helper 단언이다. 실제 종료 동작 실패로 확대하지 않았으며 직접 계획 배선 3개도 red다.
- 새 그룹·지우기·중단·배지·늦은 통지 단언은 실제 반환/SSR oracle이다. 해당 없음 — 직접 oracle이며 별도 구조 변이를 추가하지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 기존 unconfirmed 라벨을 task/call 카드와 완료 그룹이 소비(S6) | 도달 불가 excluded 문구 삭제 |
| seam 재배치 뒤 정리 코드의 스코프가 유효한가 | 표시 SSOT의 소비·지우기 스코프 유지, clear 뒤 같은 raw state 참조(S6) | 별도 상태/캐시 없음 |
| 이번 실패 경로가 Part I 어느 행인가 | D-030의 live 제외·이전 세대/terminated→완료 unconfirmed(S6) | 실제 status는 원본에 유지 |
| 실패가 화면에서 아무 일도 없는 것으로 보이는가 | 완료 그룹·종료 확인 불가·시간 고정·중단 부재(S6) | 연결 종료 배지는 실제 연결 사실로 한정 |
| 늦게 도착한 응답이 화면을 되돌리는가 | completed/failed/stopped 통지는 같은 완료 그룹의 결과만 갱신(S6 3행) | 표시로 종료 증거를 합성하지 않음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| PG-01 | Spark 밖 미종료 작업이 실행 중에 남음 | 해결 — ΔV2 규범 정정에 따라 표시 정착 | S6 실제 Mapper 반례① {b}/1, 반례② ∅/0, 해석 오류 없음 |
| I-04 | 현재 connected live 제외에도 프로세스 종료 배지 노출 | 수정 — 세대 불일치 또는 실제 terminated만 사용 | S6 현재 연결 부재·S3 실제 종료 배지 양성 |
| I-01~03 | reader·Stop helper·타입 관련 r1 문제 | 기존 대응 유지 | S4 153케이스 원복 green, 전체 게이트 진단 없음 |

### 설계 대비 명시적 차이

- 신규 대체 설계 없음. r1 bounded handle reader는 유지했으며 이번 S4의 상한·링크·실패·close 단언을 다시 관측했다.
- 표시 정착 조건을 한 분기에서 OR로 표현한 것은 D-030의 dead generation→current live 제외 순서를 합친 동등한 결과다. 두 조건의 결과가 동일하고 foreground/terminal 우선순위는 진리표가 확인한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 새 캐시/TTL 없음 | AC23·EP-09, 마지막 관측 시간 고정 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 기존 reader 셀과 Stop 수명 유지 | AC11·14′·EP-04′, S4 공유 셀/비움 |
| 재진입 | 기존 reader handle close 의무 유지 | AC11·EP-04′, S4 성공·실패·조기 반환 close |
| 다른 무효화 축 | generation·connection·liveKnown·membership 표시 파생 | AC19′·23·EP-09, S6 진리표와 실제 이벤트 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | renderer 표시 SSOT·카드·ko/en·정착/실제 Mapper 테스트, 현재 아키텍처 2문서·plan·INDEX. 파일 목록 정본은 r1.2 diff |
| 실행 명령 | 아래 전체 영향 명령 + S3A/S4/S5/S6 및 등록 변이 실행 |
| **관측한 게이트 산출**(exit code 아님) | lint 0 error·기존 Virtualizer warning1, typecheck node/web/test 진단0. 영향 vitest 250파일2064케이스 green. doc inventory generated/prose/links 정상·diff --check 출력0 |
| V-pair 자기확인 | REQUIRED 23 SELF_PASS·REGRESSION 8 SELF_PASS =31, SELF_BLOCKED 0 |
| 강제 지점 전수 | EP-01~10 유효 행은 위 표의 각 물리/운반 자리에서 닫힘. 투영·계획 파일 집합 차집합 각각 0행 |
| **AC 자기보고**(Criteria-Met) | **21/21** — 구현 자기확인이며 독립 verify 결과는 아님 |
| **합계 검산** | ✅21 · ⚠️0 · ❌0 =21. 규범 acceptance 행과 보고 AC의 누락/추가 차집합 0행 |
| 블로커 / 역질문 | 없음. 독립 handoff 검증과 §19의 시각/실환경 확인은 다음 주체의 범위 |
| 대상 커밋 | (r1.2 구현 — 좌표는 INDEX) |

### AC 자기보고 — 유효 21행

| AC | 자기결과 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | S1 ko/en Connected·연결됨, 기본 제공·인증 액션 부재 |
| AC2 | ✅ | S2 3종 요청 Map·실제 SessionRow 같은 파랑 |
| AC3 | ✅ | S2 viewed 요청 부재·열람 acknowledge |
| AC4 | ✅ | S2 last wins·삭제·같은 사유 identity |
| AC5 | ✅ | S2 미지/null/불일치/폴백/삭제/unsubscribe 음성 |
| AC6′ | ✅ | S3 배경 6종 작업 카드·완료 보존 |
| AC7′ | ✅ | S3 양성과 같은 state의 foreground/ambient/실패 음성 |
| AC8′ | ✅ | S3 배경 Agent/셸 상세·개별 중단·완료 지우기 |
| AC9′ | ✅ | S4 빈 입력의 파일 요청 본문·allow plan/path |
| AC10′ | ✅ | S4 출처/입력/서술 조합·파일 없는 입력 불변 |
| AC11 | ✅ | S4 agent_id·오류·경로·Stop·상한·링크·close |
| AC14′ | ✅ | S4 실제 query의 Write→ExitPlanMode→Stop·env |
| AC15 | ✅ | S5 최신 publishedAt·동시각·최초 위치 |
| AC16 | ✅ | S5 다른 category/파일/턴 보존·실제 saveAll refs |
| AC17 | ✅ | S5 Work/Code×진행/완료 카드→메타·spark 1개 |
| AC18 | ✅ | 전체 게이트 산출은 위 칸, 커밋 후 trailer 파싱 재확인 |
| AC19′ | ✅ | S6 실제 Mapper 정상·두 반례 집합/길이 등식 |
| AC20 | ✅ | S3 실제 인라인 선택·Agent/Task 상세·목록 부재 |
| AC21 | ✅ | S4 BOM/CRLF/끝 공백·win32 경로·원본 입력 참조 |
| AC22 | ✅ | S1 settings+runtime 3개·증감·빈 0개 |
| AC23 | ✅ | S6 unconfirmed 완료·6s 고정·중단 부재·clear·기록 불변·실제 통지 |

- **합계 검산**: ✅21 · ⚠️0 · ❌0 =21이다. AC19→19′ 대체와 AC23 추가로 r1의 분모 20에서 21로 바뀌었다.

### 재현 명령 키

r1 기록의 S1·S2·S4·S5 명령을 그대로 사용했다. S3A는 r1 S3에 backgroundPresentation.test.ts와 CanonicalBackgroundContent.spark.test.ts를 포함한 11파일이며, S6는 settlement·backgroundPresentation·spark 세 파일이다.

~~~powershell
npm run lint
npm run typecheck
.\node_modules\.bin\vitest.cmd run src/main/adapters/plan-file.test.ts src/main/adapters/plan-file.reader.test.ts src/main/adapters/plan-text.test.ts src/main/adapters/claude.canusetool.test.ts src/main/adapters/claude.plan-file.test.ts src/main/adapters/claude.plan-narrative.test.ts src/main/adapters/claude.turnEnd.test.ts src/main/adapters/claude-output-files.test.ts src/shared/background-task.test.ts src/main/features/chat/background-tasks.test.ts src/main/features/chat/session-activity-projector.test.ts src/renderer/src/features/sessions src/renderer/src/app/hooks src/renderer/src/features/chat src/renderer/src/features/skills src/renderer/src/features/engine src/renderer/src/shared/i18n --reporter=dot
node scripts/check-doc-inventory.mjs --check
~~~

- 최종 상태 재조회: plan 메타 READY(ΔV2)·유효 V1+ΔV1+ΔV2, INDEX impl/IMPL_DONE·Claude(검증). 구현 커밋 메시지는 git log의 파싱된 trailer에서 Agent/Handoff/Status/Criteria-Met/Verified-By를 재확인한다.
- 공유되지 않은 자체 커밋 좌표는 문서에 적지 않는다. INDEX의 r1.2 구현 칸은 검증자 기입 자리표시자다.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: r1 PG-01의 Spark 집합/표시 정착 축을 ΔV2로 닫았다(S6 실제 두 반례).
- 막았어야 할 plan 지침·AC가 있었는가: r1의 충돌을 planner가 D-030·31/AC19′·23으로 정정했고 이번 진리표·SSR이 그 분기를 관측한다.
- 반복 환경 한계: native ABI 전환 없이 순수 테스트를 실행했다. 한 번의 변이 프로세스 생성 error5는 소스 변경 전에 발생했고 재시도로 해결했다.
- 현재 라운드·impl 턴: **r1.2**. formal verify를 수행하지 않았으며 다음 주체는 Claude 검증자다.

---


# [구현자 기입] r1.3 — CI 게이트 보완

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: READY·유효 V1+ΔV1+ΔV2 유지. 사용자 보고는 현재 산출물의 필수 CI gate red라 기존 D-016·AC11·AC14′ 범위에서 선조치했다.
- 이견 / 현실성 문제: 없음. Decision·AC·V registry·§10 규범 행은 변경하지 않았다.
- ACTIVE Decision과 충돌하는 설계 발견: 일반 파일을 realpath 문자열 차이만으로 거부한 reader가 D-016을 위반했다. 실제 링크 속성 검사로 보정하고 상한·핸들 동일성·정리를 유지했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·22 | 로그인 프리 상태 | EP-01 5 | 5/5: ko/en·row meta·목록·상세 | S1, 연결됨/Connected·기본 제공·인증 액션 부재 | 없음 |
| VP-02~05·19 | 완료·응답 대기 Map | EP-02 8 | 운반 세분 10/10 | S2, 3종 요청→같은 파랑·열람/삭제·last wins | 없음 |
| VP-06′·07′·08′·21′·23′·24′·25 | 패널 투영·Spark | EP-03′ 9 | 운반 세분 17/17 | S3+S6, 실제 Mapper 두 반례에서 실행 중 집합={b}/∅, Spark=1/0 | 없음 |
| VP-09′·10·11′·12·13′·20 | 계획 파일·CLI 반환 | EP-04′ 7 | 운반 세분 8/8 | S4, 실제 query·파일·Stop·출처 표·원본 입력 참조 | 없음 |
| VP-15·16 | 한 턴 최신 파일 | EP-05 2 | 2/2 | S5, 최신 ref·최초 위치·category 경계·실제 saveAll 인자 | 없음 |
| VP-17·18 | 카드→메타 슬롯 | EP-06 1 | 1/1 | S5, Work/Code×pending/done 순서·spark 1개 | 없음 |
| VP-27·28 | 엔진 카드 수 | EP-07 3 | 3/3 | S1, settings+runtime 3개·증감·빈 0개·설명 부재 | 없음 |
| VP-26·08′ | 인라인 Agent 상세 | EP-08 2 | 2/2 | S3, 실제 openSubagentTask 선택·Agent/Task 상세·Read 실패 선택 부재 | 없음 |
| VP-23′·24′·29·30·31·32 | 종료 확인 불가 표시 정착 | EP-09 6 | 운반 세분 17/17 | S6, 그룹·라벨·6s 고정·중단 부재·지우기·후속 통지·기록 불변 | 없음 |
| VP-30 | excluded 표시 퇴역 | EP-10 6 | 6/6 | S6 진리표·typecheck·키 검색 0건, OR-1 민감도 2건→원복 0건 | 없음 |

- 독립 분모: EP-02의 두 구독과 effect는 3자리, EP-04′의 hook 편입과 getter는 2자리다. EP-03′ 세분은 1+1+3+1+1+4+1+3+2=17이며, 각 지정 모듈 내부의 소비 의미를 센다.
- EP-09 세분: task/call 표시 함수 2 + task/call 그룹 분류 2 + TaskCard의 표시 입력·라벨·틱 중지·endedAt 계산·중단 guard·중단 버튼·연결 배지 7 + CallCard 표시 입력·라벨 2 + task/call dismiss guard 2 + task/call 완료 지우기 2=17이다. EP-10은 반환 타입·분기·display union·라벨 맵·ko 키·en 키를 각각 센 6자리다.
- 검색으로 구한 투영 소비 파일 3개와 지정 소비 파일 3개의 차집합은 0행이다. 계획 출처/소비 파일 3개와 지정 파일 집합의 차집합도 0행이며, partsArtifacts의 transcript 소비는 AssistantTurn 1곳이다.
- §10 밖의 같은 불변식: TaskCard 연결 종료 배지 조건을 현재 live 제외의 unconfirmed 상태에도 소비하는 자리로 조사했다. S6 현재 연결의 '프로세스 종료' 부재와 S3 실제 종료 배지 양성으로 닫았다.
- 퇴역 검색: 표시 관련 5파일의 excluded 잔여는 중단 판단과 표시 정착의 raw liveMembership 비교 2줄뿐이다. background.excluded 참조와 locale의 excluded 키는 각각 0건이며 raw membership은 보존했다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | S1 카탈로그·목록·상세 SSR | not selected |
| VP-02 | REQUIRED | SELF_PASS | S2 실제 3종 ingest→Map→아이콘 | B1·B2·B3 red |
| VP-03 | REQUIRED | SELF_PASS | S2 열람 acknowledge·사유 교차·삭제 | not selected |
| VP-04 | REQUIRED | SELF_PASS | S2 app 구독 값·lint boundaries 오류 0 | not selected |
| VP-05 | REQUIRED | SELF_PASS | S2 store 값·동일 사유 identity | not selected |
| VP-06′ | REQUIRED | SELF_PASS | S3 양성/음성 같은 state·종류별 카드 | C1′~C4′ red |
| VP-07′ | REQUIRED | SELF_PASS | S3 ambient·Spark·증거·foreground 진리표 | not selected |
| VP-08′ | REQUIRED | SELF_PASS | S3 목록·선택·지우기 공통 투영 | not selected |
| VP-09′ | REQUIRED | SELF_PASS | S4 요청 본문·allow 입력·출처 조합 | D1·D2′·D3′·D4′·D10 red |
| VP-10 | REQUIRED | SELF_PASS | S4 마지막 메인 쓰기·Stop 비움 | D5·D6 red |
| VP-11′ | REQUIRED | SELF_PASS | S4 query 포획·hook/getter 공유 셀·env | D7·D8·D9 red |
| VP-12 | REQUIRED | SELF_PASS | S4 경로·상한·링크·부재·reader 오류/close | not selected |
| VP-13′ | REQUIRED | SELF_PASS | S4 실제 resolver의 출처·정규화·참조 | not selected |
| VP-15 | REQUIRED | SELF_PASS | S5 최신 파일·첫 위치·실제 saveAll | E1·E2·E3 red |
| VP-16 | REQUIRED | SELF_PASS | S5 partsArtifacts 반환·category 경계 | not selected |
| VP-17 | REQUIRED | SELF_PASS | S5 Work/Code×진행/완료 순서 | not selected |
| VP-18 | REGRESSION | SELF_PASS | S5 이전 턴·pending fallback·spark 1개 | not selected |
| VP-19 | REGRESSION | SELF_PASS | S2 기존 완료 의미·같은 파랑 | not selected |
| VP-20 | REGRESSION | SELF_PASS | S4 서술/empty·plan0215.render | not selected |
| VP-21′ | REGRESSION | SELF_PASS | S3 foreground 셸 제외·배경 Agent 상세 | not selected |
| VP-22 | REGRESSION | SELF_PASS | S1 기본 제공·인증 액션 부재 | not selected |
| VP-23′ | REQUIRED | SELF_PASS | S6 실제 Mapper 정상+반례①②의 집합/길이 등식 | S1~S5 red |
| VP-24′ | REQUIRED | SELF_PASS | S6 시작→live→제외→unconfirmed→실제 통지 | not selected |
| VP-25 | REQUIRED | SELF_PASS | S3+S6 같은 상태의 shared 집합·main count·SSR | not selected |
| VP-26 | REQUIRED | SELF_PASS | S3 실제 인라인 선택→숨긴 Agent 상세 | B4·B5 red |
| VP-27 | REQUIRED | SELF_PASS | S1 제목 개수=실제 카드 수·증감 | not selected |
| VP-28 | REGRESSION | SELF_PASS | S1 설명 부재·common.count 단위 | not selected |
| VP-29 | REQUIRED | SELF_PASS | S6 unconfirmed 그룹·라벨·시간·중단·clear | not selected — 직접 oracle |
| VP-30 | REQUIRED | SELF_PASS | S6 정착 진리표 26행·call 연결 2종·키 퇴역 | not selected, 키 sweep는 OR-1 |
| VP-31 | REGRESSION | SELF_PASS | S6 기존 비원격 old/terminated 정착·시간 | not selected |
| VP-32 | REGRESSION | SELF_PASS | S6 raw running/증거 불변·늦은 실제 통지 | not selected |

- 유효 pair를 규범 registry에서 다시 추출한 결과 REQUIRED 23·REGRESSION 8이다. 보고 pair와의 누락/추가 차집합은 0행이다.

- r1.3 재측정: 위 S1~S6의 직접 oracle을 모두 포함한 IMPACT 251파일2075케이스 green. 선택된 27 ID도 이번 턴에 다시 실행했고 결과는 다음 표다.
- 같은 불변식 전수: 공통 reader 1곳을 추적·선언 2출처가 사용한다. 파일 lstat → 열린 handle stat → 조상 전수 lstat → 현재 파일 lstat → bounded handle read → finally close를 관측했다(S4, SHORT-TEMP).
- EP/운반 분모는 r1.2와 같고 새 helper/저장소/IPC는 없다. 계획 출처 생산 검색의 파일 집합 {claude.ts, plan-file.ts, plan-text.ts}와 지정 집합 차집합은 0행이다.
- 검색 명령은 r1 전수 명령 4개를 재실행했다. 실제 merged 훅의 고정 가정 검색에서 extraDirs 2곳(Stop 개수·첫 PostToolUse)을 보정했으며 turnEnd의 2곳은 출력 기능 없는 fixture로 유효했다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 ID | 출처 | 정확한 결함 / 자리 | 이번 실패 수 / 대상 | 결과 |
|---|---|---|---|---|
| M-B1 | VP-02 | 완료 전용 effect 구독 | 1 / hook 11 | red·바이트 원복 |
| M-B2 | VP-02 | 요청 listener 통지 제거 | 4 / hook 11 | red·바이트 원복 |
| M-B3 | VP-02 | viewed guard 제거 | 2 / hook 11 | red·바이트 원복 |
| M-B4 | VP-26 | 인라인 선택 연결 제거 | 2 / background-open 3 | red·바이트 원복 |
| M-B5 | VP-26 | 선택 Agent 예외 제거 | 5 / S3A 178 | red·바이트 원복 |
| M-C1′ | VP-06′ | 배경 술어 항상 true | 35 / S3A 178 | red·바이트 원복 |
| M-C2′ | VP-06′ | ambient 검사 제거 | 10 / S3A 178 | red·바이트 원복 |
| M-C3′ | VP-06′ | 비셸 작업 무조건 표시 | 16 / S3A 178 | red·바이트 원복 |
| M-C4′ | VP-06′ | call.mode 증거 제거 | 4 / S3A 178 | red·바이트 원복 |
| M-S1 | VP-23′ | main count에 ambient 포함 | 2 / S3A 178 | red·바이트 원복 |
| M-S2 | VP-23′ | Spark 항·call.mode 제거 | 5 / S3A 178 | red·바이트 원복 |
| M-S3 | VP-23′ | 포그라운드 Agent 노출(C3′ 공유) | 16 / S3A 178 | red·바이트 원복 |
| M-S4 | VP-23′ | live 제외 정착 제거 | 6 / S3A 178 | red·바이트 원복 |
| M-S5 | VP-23′ | 이전 세대 remote 예외 복원 | 7 / S3A 178 | red·바이트 원복 |
| M-D1 | VP-09′ | 파일보다 서술 우선 | 14 / S4+extraDirs 164 | red·바이트 원복 |
| M-D2′ | VP-09′ | 파일 판정 전 입력 반환 | 12 / 같은 164 | red·바이트 원복 |
| M-D3′ | VP-09′ | 일치 입력도 새 객체 | 10 / 같은 164 | red·바이트 원복 |
| M-D4′ | VP-09′ | 보정 입력 경로 제거 | 18 / 같은 164 | red·바이트 원복 |
| M-D5 | VP-10 | Stop 비움 제거 | 3 / 같은 164 | red·바이트 원복 |
| M-D6 | VP-10 | agent_id guard 제거 | 3 / 같은 164 | red·바이트 원복 |
| M-D7 | VP-11′ | 계획 hook 병합 제거 | 18 / 같은 164 | red·바이트 원복 |
| M-D8 | VP-11′ | tracked getter를 새 셀로 | 3 / 같은 164 | red·바이트 원복 |
| M-D9 | VP-11′ | getPlanFiles 배선 제거 | 5 / 같은 164 | red·바이트 원복 |
| M-D10 | VP-09′ | 서술을 CLI 입력에 동봉 | 4 / 같은 164 | red·바이트 원복 |
| M-E1 | VP-15 | 첫 파일 버전 유지 | 6 / S5 44 | red·바이트 원복 |
| M-E2 | VP-15 | 최신 ref는 유지하고 마지막 슬롯으로 이동 | 5 / S5 44 | red·바이트 원복 |
| M-E3 | VP-15 | category 경계 제거 | 9 / S5 44 | red·바이트 원복 |
| OF-1 | 새 extraDirs 배선 oracle | claude.ts의 makeOutputFilesHook 병합 조각 제거 | 1 / extraDirs 5 | red→원복 5 green |
| OR-1 | 기존 EP-10 sweep | ko/en의 background.excluded 키 재삽입 | rg 2건→원복 0건 | 민감도 검출·바이트 원복 |

- 분모 검산: 선택 증거 27 ID · 추가 인용 변이 0 · 새 oracle 1 = 필수 28행, 기존 OR-1 재측정 1행을 더해 표 29행이다. 등록 ID와 선택 표 ID의 누락/추가 차집합은 0행이다.
- C3′와 S3는 같은 실제 변이를 공유한다. S4는 추가 진리표의 영향으로 6건, E2는 최신 ref를 보존하고 위치만 옮긴 치환에서 5건이며 과거 수치를 복사하지 않았다.
- D 계열 원복 9파일164케이스 green, 나머지 원복 20파일263케이스 green. 최종 IMPACT 251파일2075케이스도 green이며 영구 diff는 의도한 main 어댑터/테스트 4파일뿐이다.
- SHORT-TEMP와 reader의 파일/부모 링크·교체·성장·close는 실제 반환 직접 oracle이다. VP-12는 not selected이며 임의 등록 변이를 추가하지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 신규 문구·상태 없음 | 기존 계획 승인 본문이 소비한다 |
| seam 재배치 뒤 정리 코드의 스코프가 유효한가 | 열린 handle 읽기·finally close 유지(S4) | 조상/현재 파일 검사 실패도 close |
| 이번 실패 경로가 Part I 어느 행인가 | D-016 일반 파일·AC11·AC14′ 계획 본문 | SHORT-TEMP의 동일 6개 실패 재현 |
| 실패가 화면에서 아무 일도 없는 것으로 보이는가 | 기존 결함은 파일을 못 읽고 서술/빈 본문으로 내려갔다 | 파일 요청·CLI allow 결과를 다시 관측(S4) |
| 늦게 도착한 응답이 화면을 되돌리는가 | Stop 수명·세션 셀 격리 그대로(S4) | 별도 지연/재시도 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| CI-01 | realpath가 8.3 별칭을 긴 이름으로 바꾸면 일반 파일도 거부 | 수정 — 조상 링크 속성 검사·현재 파일 identity 재확인 | 짧은 TEMP에서 원본 2파일6red→수정 4파일48green |
| CI-02 | extraDirs가 Stop 2개·첫 PostToolUse를 가정 | 수정 — matcher 필터 후 전체 callback 실행 | Write·Stop 출력 캡처와 turn.ended 1회, OF-1 red |
| N-01 | 기존 ino Number가 안전정수 밖에서 반올림됨 | 보고만 — bigint 메타 강화 후보, CI 오판 원인과 별개 | 로컬 일반 파일 Number와 bigint 진단 값이 1 차이 |
| E-01 | sandbox가 사용자 폴더 lstat를 EPERM으로 차단 | 검증 환경 분리 — 승격 실행에서 정상 | 동일 3파일40green, scripts132green |

### 설계 대비 명시적 차이

- 링크 추정에 realpath 문자열 비교를 쓰지 않고 파일과 모든 조상의 실제 링크 속성을 검사한다. 짧은 이름은 비링크 일반 파일이므로 D-016의 설계 기준은 그대로다.
- 여러 fs 호출로 모든 악의적 경로 교체를 원자적으로 막는다고 주장하지 않는다. handle identity·검사 뒤 현재 파일 identity·열린 handle bounded read를 유지한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 새 캐시/TTL 없음 | AC11·EP-04′ Stop 비움 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 기존 셀·두 출처 유지 | AC11·14′, S4 실제 query 배선 |
| 재진입 | 추가 조상 lstat가 실패할 수 있음 | AC11, reader parent-stat 실패·close 단언 |
| 다른 무효화 축 | 파일/부모 링크 또는 검사 도중 파일 교체 | AC11·D-016, 실제 junction·inode/dev/link 교체 단언 |

## [구현자 기입] 구현 보고

| 항목 | 관측 |
|---|---|
| 변경 파일 | main 계획 reader와 reader/경로/extraDirs 테스트 4파일, plan·INDEX. 최종 diff가 파일 목록 정본 |
| 실행 명령 | IMPACT(앞 영향 명령 + extraDirs, maxWorkers=4), SHORT-TEMP, S4+extraDirs, S1/S2/S3A/S5, lint·typecheck·3가드·scripts |
| 관측한 게이트 산출 | IMPACT 251파일2075, scripts132 green. lint 0error·기존 warning1, typecheck node/web/test 진단0. 문서 inventory·migration·test-budget 정상 |
| V-pair 자기확인 | REQUIRED 23 SELF_PASS·REGRESSION 8 SELF_PASS =31, SELF_BLOCKED 0 |
| 강제 지점 전수 | 위 EP-01~10 자리와 계획 파일 두 출처의 공통 reader 재조회. 지정/검색 집합 차집합 0행 |
| AC 자기보고(Criteria-Met) | 21/21 — 독립 verify 판정 아님 |
| 합계 검산 | ✅21 · ⚠️0 · ❌0 =21. 유효 acceptance와 아래 보고 ID의 누락/추가 차집합 0행 |
| 블로커 / 역질문 | 없음. 원격 CI의 전체 게이트 재실행은 push 후 확인하며 독립 handoff 검증은 Claude 대기 |
| 대상 커밋 | (r1.3 구현 — 좌표는 INDEX) |

### AC 자기보고 — 유효 21행

| AC | 자기결과 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | S1 ko/en Connected·연결됨, 기본 제공·인증 액션 부재 |
| AC2 | ✅ | S2 3종 요청 Map·실제 SessionRow 같은 파랑 |
| AC3 | ✅ | S2 viewed 요청 부재·열람 acknowledge |
| AC4 | ✅ | S2 last wins·삭제·같은 사유 identity |
| AC5 | ✅ | S2 미지/null/불일치/폴백/삭제/unsubscribe 음성 |
| AC6′ | ✅ | S3 배경 6종 작업 카드·완료 보존 |
| AC7′ | ✅ | S3 양성과 같은 state의 foreground/ambient/실패 음성 |
| AC8′ | ✅ | S3 배경 Agent/셸 상세·개별 중단·완료 지우기 |
| AC9′ | ✅ | S4 빈 입력의 파일 요청 본문·allow plan/path |
| AC10′ | ✅ | S4 출처/입력/서술 조합·파일 없는 입력 불변 |
| AC11 | ✅ | S4 + SHORT-TEMP, 8.3 일반 파일·agent_id·오류·경로·Stop·상한·링크·close |
| AC14′ | ✅ | S4 실제 query의 Write→ExitPlanMode→Stop·env |
| AC15 | ✅ | S5 최신 publishedAt·동시각·최초 위치 |
| AC16 | ✅ | S5 다른 category/파일/턴 보존·실제 saveAll refs |
| AC17 | ✅ | S5 Work/Code×진행/완료 카드→메타·spark 1개 |
| AC18 | ✅ | IMPACT 251파일2075·scripts132·lint0error/1warning·typecheck3종0·문서/가드 정상, 커밋 후 trailer 재조회 |
| AC19′ | ✅ | S6 실제 Mapper 정상·두 반례 집합/길이 등식 |
| AC20 | ✅ | S3 실제 인라인 선택·Agent/Task 상세·목록 부재 |
| AC21 | ✅ | S4 BOM/CRLF/끝 공백·win32 경로·원본 입력 참조 |
| AC22 | ✅ | S1 settings+runtime 3개·증감·빈 0개 |
| AC23 | ✅ | S6 unconfirmed 완료·6s 고정·중단 부재·clear·기록 불변·실제 통지 |

- 합계 검산: ✅21 · ⚠️0 · ❌0 =21. 폐기 AC12·13 및 대체 전 AC6~10·14·19는 분모 밖이다.
- CI 원본: [run 37169511419](https://github.com/muzaby/orca-skin/actions/runs/37169511419), Test 3파일7건 실패·앞 gate 정상. 로그에 TEMP 자체는 없어 실제 짧은 TEMP를 통제 입력으로 만들어 같은 6건을 재현했다.
- 로컬 전체 Vitest는 장시간 실행 중 중단해 완료 판정에 사용하지 않았다. sandbox scripts8red는 승격 실행132green으로 분리했고 native ABI 전환은 하지 않았다.
- 최종 plan READY·V1+ΔV1+ΔV2와 INDEX impl/IMPL_DONE r1.3·Claude(검증)를 다시 읽는다. 커밋 후 git log의 Agent/Handoff/Status/Criteria-Met/Verified-By trailer를 확인한다.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 계획 파일 일반/비링크 읽기와 기존 출력 훅 배선 축이다. ΔV2 제품 상태 정착은 변경하지 않았다.
- 막았어야 할 plan 지침·AC가 있었는가: D-016·AC11은 일반 파일을 허용했지만 기존 로컬 TEMP는 긴 이름이라 realpath 오판이 드러나지 않았다. 기존 영향 명령에는 extraDirs가 빠져 있었다.
- 반복 환경 한계: 사용자 폴더 lstat sandbox EPERM은 승격 검증으로 분리했다. 로컬 전체 테스트 중단은 전체 성공으로 세지 않고 원격 CI에서 확인한다.
- 현재 라운드·impl 턴: r1.3. formal verify는 수행하지 않았으며 다음 주체는 Claude 검증자다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| CI-01 | 8.3 일반 파일 realpath 오판 | VP-12·D-016·AC11 / 필수 CI Test gate | 실제 조상 링크 검사 | BLOCKING | closed(검증자 확인): reader·영향 스위트 green — [`verify.md`](verify.md) §13 |
| CI-02 | extraDirs의 병합 훅 고정 위치·개수 | 필수 CI Test gate·출력 capture 회귀 | 전체 훅 실행의 실제 결과 관측 | BLOCKING | closed(검증자 확인): OF-1 red 6/164 |
| D1 | reader가 조상 디렉토리 링크도 거부 — 링크된 `~/.claude`·`CLAUDE_CONFIG_DIR`에서 파일 출처가 서술 폴백으로 내려감 | D-016(파일 자체만 규정) | 허용 여부 사용자 결정 후 후속 | NON_BLOCKING | open |
| D2 | `ino` Number 비교의 안전정수 밖 반올림(N-01) | 비귀속 | `bigint` stat | NON_BLOCKING | open |
| D3 | 구현자가 `[검증자 기입]` 절에 직접 기입 | `docs/handoff/AGENTS.md §충돌 최소화` | 검증자 재분류로 대체 | NON_BLOCKING | closed |
| D4 | `auth.md` 조사 오류 `` `연결됨`와 `` | 비귀속 | `과`로 정정 | NON_BLOCKING | open |
| D5 | 새 대화의 init 전 계획 승인 요청이 다른 열람 세션으로 라우팅됨 — 독립 X1 | VP-36·D-033·AC24/25; VP-35 종속 | 세션 미확정 requested/resolved의 pending draft 소유권을 보존하고 session.updated 승격에 연결 | BLOCKING | closed(r2 독립 검증): 기존 X1 기대값을 유지한 owner10건 green. 등록 변이의 pair closeout은 별도 미발행. [`verify.md`](verify.md) r2 §5 |
| D6 | 하위 계획 승인과 stale 승인 ID가 메인 모드/현재 승인 상태를 바꿈 — 독립 X2 | VP-36·D-033/AC25·D-034/AC26·ΔV3 Product/UX 하위 호출 행 | approve/revise/구조화 코멘트/reject의 현재 requestId·owner를 처리 전 확인하고 providerRequest의 child 경계를 낙관적 renderer 모드 소비까지 유지 | BLOCKING | open(r2 독립 검증): main 양성1 PASS, child1·4응답×다른/해결된 ID8 FAIL. [`verify.md`](verify.md) r2 §1 |

---

# ΔV3 — 계획 모드 콜백·핸들러와 보정 입력 종단 (2026-10-06)

## 1. Product & UX Contract / 결정 복원

사용자는 “정확한 데이터가 충족하지 않았을때 폴백으로 보정된 값”과 계획 모드에서 호출되는 콜백·핸들러의 적극적인 분석을 요구했다. D-025~027의 파일 정본·서술 폴백·계획 패널 UI 계약을 유지하면서, D-032~035로 카드·이력과 실제 모드 보고 경로를 보완한다. 새 제품 정책·새 의존성은 없다.

| 시작 / 상태 | 관측 결과 |
|---|---|
| 메인 ExitPlanMode의 입력 누락·stale 값, 허용된 계획 파일 존재 | 승인 본문, CLI allow 입력, 라이브 도구 카드와 재로드 카드가 승인 시점 파일의 `plan`·`planFilePath`를 사용한다. 알 수 있는 원래 필드도 보존한다. |
| started가 승인 요청보다 먼저 도착 | 처음 읽을 수 있는 파일로 입력을 보완하고 승인 요청에서 최신 파일을 다시 읽어 해당 호출만 교정한다. |
| 승인 요청이 started보다 먼저 도착 | 같은 턴·세션·toolUseId의 보정 입력을 보관해 늦은 started에도 적용한다. |
| 승인 뒤 Stop, 늦은 동일 호출 started / Stop 뒤 새 호출 | 옛 호출에는 검토한 입력을 유지한다. 새 호출은 비워진 파일 추적 셀로 다시 판정한다. |
| 파일 부재·빈 파일·읽기 실패 | 기존 입력·서술·빈 본문 순서를 유지하며 CLI 입력에 서술이나 가짜 경로를 만들지 않는다. |
| 하위 에이전트 호출 | 메인 계획 파일·메인 서술을 빌리지 않는다. 메인 도구 카드·계획 모드에도 영향을 주지 않는다. |
| 승인·수정 요청·거부·취소 | 검토한 보정 입력은 카드·이력에 남는다. CLI allow·권한 변경은 승인 결과에만 적용한다. |
| 메인 live SDK init/status의 permissionMode 보고 | 실제 보고된 모드를 controller와 renderer에 반영한다. 기존 session 생성·continuity·history 경로를 다시 실행하지 않는다. |

SDK 설치본 `sdk-tools.d.ts`와 CLI 2.1.286 런타임을 확인했다. Enter 입력은 `{}`, 결과는 `message`다. Exit의 모델 입력에는 deprecated `allowedPrompts`가 있으며 CLI가 내부 입력 `plan`·`planFilePath`를 주입한다. 결과는 `plan`·`filePath`다. `planfilepath`는 해당 계약의 필드명이 아니다. CLI는 실행 전에 파일을 다시 읽으므로 assistant 입력과 canUseTool 입력은 다를 수 있다. SDK control request와 iterator도 독립 진행하므로 어느 쪽이 먼저라는 가정을 금지한다. 실제 모드 보고는 `system/init`·`system/status.permissionMode`이며 telemetry 문자열을 새 SDK subtype으로 해석하지 않는다.

### Acceptance Criteria (유효 AC 25)

| ID | 동작 기준 | 검증 / 프로덕션 도달 경로 |
|---|---|---|
| AC24 | 보정된 메인 Exit 입력이 승인 action·CLI allow·라이브 카드·영속 이력·재로드 카드에 같게 전달된다. 기존 입력과 기타 필드·정상 입력 참조는 보존한다. | 실제 adapter query → approval requester → history/DB → reducer → Work/Code 카드. VP-33~35. |
| AC25 | 두 도착 순서와 파일 변경·Stop·중복 요청·다른 호출/턴/세션에서 보정 입력의 소유권·승인 시점 정본이 성립한다. 화면의 승인·수정·코멘트·거부도 현재 미해결 ID에만 발신·적용한다. | 제어 가능한 SDK iterator/control callback·실제 history writer의 순서 및 화면 네 응답 fixture. VP-33·34·36. |
| AC26 | 하위 호출에는 메인 파일·서술을 섞거나 메인 도구 카드·계획 모드를 바꾸지 않고, 파일 없는 fallback과 Enter/Exit 입력·결과 계약을 구별한다. | adapter·resolver·mapper 입력/결과 및 실제 approvePlan→controller/renderer/다음 send 직접 단언, 파일 reader 회귀. VP-09′·33·36. |
| AC27 | 실제 메인 live init/status 모드가 controller·renderer에 반영되고, 이후 send/listen의 최신 delegate·세션 수명에 맞는다. unknown·child·replay는 무시한다. | adapter report → TurnRequest port → runtime delegates → composition controller/forward-only renderer. VP-37·38. |

## 2. V 노드 / 기준선

V mode는 **Delta V**다. 기준선 V1+ΔV1+ΔV2는 공유 main `ceda5c5a`와 기존 ΔV2 설계 `f3198994`에서 확인했다(`git cat-file -t`: commit). 해당 설계와 기존 verify의 계약은 비영향 영역에서 유지한다.

| 노드 | 변화 | 계약 / 대응 pair |
|---|---|---|
| R-04 | CHANGED | D-032~034·AC24/26의 사용자 도구 입력 종단. 기존 VP-09′를 확장하며 이전 선택 변이 5개를 승계한다. |
| R-08 | NEW | D-035·AC27의 실제 모드 반영. VP-35의 카드 수용과 VP-37의 경계 검증에 연결한다. |
| SD-02 | CHANGED | 승인·started의 독립 순서, 파일 수정·Stop·턴 종료 수명. VP-36. |
| AR-02 | CHANGED | adapter → permission action → requester/history → DB/reducer의 입력 운반. VP-34. |
| AR-06 | NEW | SDK mode → callback → runtime delegate → app/renderer. VP-37. |
| MD-06 | NEW | 같은 호출의 보정 입력 식별·결합과 main/child 분리. VP-33. |
| MD-08 | NEW | SDK 권한 모드의 검증·정규화, 미지정값 처리. VP-38. |

| pair | 레벨 / requiredness | start → edges → end / 직접 oracle |
|---|---|---|
| VP-09′ | R↔AT / REQUIRED (CHANGED) | 파일/입력 → callback resolver → 승인 본문·CLI 입력. 기존 출처/참조 단언과 child 음성 대조. M-D1·D2′·D3′·D4′·D10 승계. |
| VP-33 | MD↔UT / REQUIRED | 보정 action·원본 started → 식별/결합 → 같은 호출 args. 식별 부재·다른 tool·child·같은 id의 다른 세션 음성 대조. |
| VP-34 | AR↔IT / REQUIRED | adapter callback → requester persist-before-send → writer/DB → 재로드 입력. args만 교정, 기존 순서·parent·결과·다른 세션을 직접 비교. |
| VP-35 | R↔AT / REQUIRED | 생산된 started/request → live reducer 및 저장 payload/reload → Work/Code SSR. 카드의 plan/path 값과 원래 필드, 이웃 호출을 비교. |
| VP-36 | SD↔ST / REQUIRED | iterator/control callback → hook 파일 수정·Stop → 승인 및 늦은 호출 입력. 양방향 순서·중복·새 호출·child·deny/abort 직접 단언. |
| VP-37 | AR↔IT / REQUIRED | SDK init/status → observer → TurnRequest/runtime → 실제 controller와 renderer patch. 최신 delegate와 폐기·교체 세션 음성 대조. |
| VP-38 | MD↔UT / REQUIRED | SDK mode 6종/unknown → validator → normalized 6종 또는 무시. Enter `{}`/message, Exit 결과 filePath도 별도 단언. |
| VP-10·11′·12·13′·20 | INHERITED / REGRESSION | 기존 hook·reader·resolver·narrative 경로. M-D5~9 승계, 기존 직접 oracle 유지. |
| VP-01~08′·15~19·21′~32 | INHERITED / NOT_REQUIRED | 로그인·주의 표시·배경 투영·파일 슬롯·엔진·표시 정착은 이번 입력/모드 경로에 닿지 않는다. 기준선 위와 같음. |

유효 pair 총수 37(기존 31 + 신규 6). 이번 선택은 REQUIRED 7 + REGRESSION 5 =12이며 나머지 25는 비영향이다. 기존 AC21·파일 보안·D-027·VP-20을 약화하지 않는다. 기존 VP-14는 폐기 상태 유지다. R-08의 R↔AT는 VP-35에서 카드에 전달되는 모드/입력 상태를, AR-06의 IT는 VP-37에서 controller/renderer 실제 모드를 확인한다.

## 3. Technical Design

1. `claude.ts`의 메인 Exit 시작 이벤트를 현재 파일 출처로 보완한다. canUseTool은 **그 순간** 파일을 다시 읽어 action.input에 `resolved.updatedInput`을 넣는다. 정상 입력은 기존 객체를 그대로 사용한다. child에서는 main getter를 호출하지 않는다.
2. 기존 `permission.requested`의 plan_review/action.input/providerRequest 식별을 재사용한다. shared 순수 helper에서 검증해 main toolUseId와 입력을 꺼낸다. 새 IPC/event/DB 스키마는 추가하지 않는다.
3. approval requester는 같은 요청 이벤트를 persistence에 먼저 전달한 뒤 renderer로 보낸다. history writer는 TurnContext 소유 보정 Map과 session-scoped tool_call args UPDATE로 이미 저장된 호출 및 늦게 도착한 호출을 교정한다. relay 전에 late started.args를 교정하며 renderer는 기존 call의 args만 교정한다. 세션 id가 없으면 턴 Map에 두고 세션 확정 뒤 pending 저장 경로를 이용한다. 턴 종료 뒤 해당 context와 함께 해제한다. Stop은 file 추적 셀만 비운다.
4. UPDATE는 sessionId·toolUseId·toolName으로 한정하고 args만 변경한다. parent·결과·순서와 다른 세션은 그대로 둔다. DB 실패는 기존 history critical 오류 경로로 처리하며 성공을 조용히 가장하지 않는다.
5. 실제 main/live SDK init/status.permissionMode를 검증하는 observer port를 TurnRequest에 추가한다. runtime의 frame/adapter delegate 두 경로에서 최신 callback을 참조한다. app은 유효한 현재 세션의 controller를 갱신하고 renderer에 permissionMode session.updated를 **forward-only** 보낸다. history/coordinator/session 생성 bus에는 재발행하지 않는다. init 보고는 세션 확정 순서를 보장한다.
6. Enter passthrough와 SDK 도구 결과는 보존한다. 승인은 기존 `updatedPermissions` setMode, 수정/거부/abort는 기존 deny 동작을 유지한다. D-015~017 reader 보안과 정상 입력의 reference 보존을 그대로 사용한다.

## 10. 강제 지점 / 운영 gate

| ID | 계약 | 지정 물리 자리 / 직접 oracle | 실패 의미 / 선택 적대 증거 |
|---|---|---|---|
| EP-04′ | 기존 파일 정본 | hook 편입·cell getter·resolver·reader·canUseTool 반환의 기존 자리 유지 | 승계 M-D1~10, 기존 verify에서 red였던 자리 재확인. |
| EP-11 | 보정 입력 종단 | adapter started, canUseTool action.input, requester persist-before-send, writer late started, DB scoped args update, reducer 기존 call 교정: **6자리** | 값 직접 비교. 운반 단절의 민감도 M-F1~6를 각 자리 제거로 확인. |
| EP-12 | 호출 소유권 | shared action 식별, writer 턴 Map, SQL 세션 필터, reducer tool id/name: **4자리** | 다른 호출·세션·child 음성 대조. 세션 범위 제거 M-F7로 실제 DB 교차 오염 검출. |
| EP-13 | 실제 모드 | adapter main/live report, TurnRequest app callback, runtime frame delegate, runtime adapter delegate, controller set+renderer send: **5자리** | SDK report→실제 state 직접 비교. M-F8(adapter observer 제거), M-F9~10(delegate 각각 누락) 선택. |
| EP-14 | 데이터/문서 계약 | Enter/Exit SDK 타입·결과, plan 메타·본 ΔV3·INDEX 상태: **4자리** | 실제 필드/결과와 갱신 산출 재독. 구조적 수량을 성공 근거로 대신하지 않는다. |

등록 신규 변이 10(M-F1~10)은 배선·범위 oracle의 민감도를 증명한다. 승계 변이 10(M-D1~10)은 변경 장치의 하한이다. 직접 값/순서 oracle에는 추가 변이를 임의로 늘리지 않는다. 전수 검색으로 실제 producer/consumer와 지정 자리의 차집합을 보고한다.

적용 gate: `app/AGENTS.md`의 lint·node/web/test typecheck, 선택 pair 테스트와 영향 회귀, doc-inventory·test budget·migration append-only guard, diff/trailer/공유 브랜치 확인. better-sqlite3 ABI는 바꾸지 않으며 실제 DB 검증은 설치 binary에 맞는 런타임으로 분리한다. 파일 조상 lstat sandbox EPERM은 권한 있는 실행으로 분리한다. 실 외부 모델 실행은 기계 fixture 성공과 구별해 미실행 여부를 보고한다.

## READY self-review

Decision D-032~035 ↔ AC24~27 ↔ 4개 V 수준 ↔ EP-11~14와 callback/consumer 경로를 대조했다. 계획 본문/경로의 정본은 승인 시점 파일이다. 카드·DB·모드 소비처까지 설계에 포함했고 기존 정상 입력·narrative/empty·child·Stop 계약도 판정했다. INDEX는 plan/READY·Codex로 재개한다. 설계 정정은 구현과 별도 커밋으로 전달한다.

---

# [구현자 기입] r1.4 — ΔV3 계획 모드 종단

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-032~035·ΔV3의 파일 정본·입력/결과 구분·카드/이력·실제 모드 경로를 구현했다. 현재 SDK 타입과 CLI 2.1.286의 내부 파일 주입·재읽기를 대조했다.
- 이견 / 현실성 문제: 기존 history에는 세션 미확정 started 저장 경로가 없었다. 메인 Exit 호출만 TurnContext에 보류해 세션 확정 뒤 기존 저장 경로로 배출했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 기존 ΔV2 MD-07과 새 노드의 이름 충돌은 MD-08로 별도 설계 정정했다. 제품 계약·선택 pair 수는 같다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-09′·10·11′·12·13′·20 | 계획 파일·정상 입력·fallback | EP-04′ 기존 7자리(③ 2개) | 8/8 | main adapters 테스트의 파일·hook·resolver·narrative 직접 값; D1~10 red | 없음 |
| VP-33~36 | 보정 입력 운반 | EP-11 6자리 | 6/6 | adapter started/action, approval persist→send, writer late started, scoped SQL, reducer existing part; F1~6 red | 없음 |
| VP-33·34·36 | 호출 소유권 | EP-12 4자리 | 4/4 | helper 음성·턴 Map·DB 다른 세션/이전 메시지·reducer 다른 id/tool/child 비교; F7 red | 없음 |
| VP-37·38 | 실제 모드 보고 | EP-13 5자리 | 운반 세분 6/6 | SDK observer·app callback·frame/adapter delegate·controller·renderer sink, F8~10 red | 없음 |
| VP-38·gate | SDK/문서 계약 | EP-14 4자리 | 4/4 | Enter/Exit 결과 단언, meta/ΔV3/INDEX 재독·trailer 별도 확인 | 없음 |

검색은 `tool.call.started`, `plan_review`, `ExitPlanMode`, `permission.requested`, `permissionMode`, `onPermissionModeChanged`, `updateToolCallInput`의 production producer/consumer를 대상으로 했다. 계획 input 경로의 adapter→requester→writer→SQL→reducer→parts→Work/Code 카드와 지정 경로를 직접 빼서 누락 0개를 확인했다. getter/hook·plan panel·result mapper는 기존 경로다. 포트는 `TurnRequest`가 선언하고 `buildTurnRequest` spread 및 runtime의 두 delegate가 운반한다. EP-13의 마지막 지정 항목에는 controller set과 renderer send 두 물리 sink가 있어 실제 분모는 6이다.

§10 밖의 같은 불변식: 새 TurnContext와 자동 연속 TurnContext의 fresh 상태 생산을 `turn-context.ts` whitelist에서 함께 초기화했다. 기존 SQL의 세션 범위에 currentAssistantMessageId 범위를 더해 같은 세션 이전 턴도 보호했다. 이는 현재 턴 소유권의 구현 세부이며 AC25 음성 fixture로 관측했다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-09′ | REQUIRED | SELF_PASS | 파일 정본·기타 필드·정상 참조·child 출처 격리 | D1·2′·3′·4′·10 red |
| VP-33 | REQUIRED | SELF_PASS | helper record/main/id 음성 및 같은 입력 참조 | F1·2·4·6 red |
| VP-34 | REQUIRED | SELF_PASS | requester 저장 선행·실제 SQLite args 변경·오류 전파·decoder | F3·4·5·7 red |
| VP-35 | REQUIRED | SELF_PASS | 실제 adapter→history payload→reducer→Work/Code SSR live/reload | F1·2·6 red |
| VP-36 | REQUIRED | SELF_PASS | 두 도착 순서·승인 시점 변경·Stop·중복·deny/revise/abort·새 턴 | F4 및 D5·6 red |
| VP-37 | REQUIRED | SELF_PASS | 실제 init/status→현재 controller/IPC, 초기 확정·latest send/listen·old channel | F8·9·10 red |
| VP-38 | REQUIRED | SELF_PASS | SDK 6종·unknown·child/replay 음성, Enter message/Exit filePath 구분 | 직접 oracle |
| VP-10 | REGRESSION | SELF_PASS | 메인 Write/Edit·Stop·child 쓰기 음성 | D5·6 red |
| VP-11′ | REGRESSION | SELF_PASS | query의 hook/getter 동일 셀·env | D7·8·9 red |
| VP-12 | REGRESSION | SELF_PASS | 실제 파일 상한·링크·reader 오류·close·8.3 | 직접 oracle |
| VP-13′ | REGRESSION | SELF_PASS | 파일/입력 출처·BOM/CRLF/공백·경로·참조 | 직접 oracle |
| VP-20 | REGRESSION | SELF_PASS | 파일 없는 입력→서술→empty, 기존 계획 패널 SSR | D10 red·기존 SSR |

선택 registry 12개와 위 pair 표를 비교한 누락/추가 집합은 모두 ∅다. 비영향 pair 25개는 ΔV3의 NOT_REQUIRED 상태를 유지한다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| F1 adapter started 정규화 제거 | EP-11·VP-35 | 최초 | adapter4파일91 중 1 | red·원복 |
| F2 callback action.input 원본 복귀 | EP-11·VP-34 | 최초 | 같은 91 중 4 | red·원복 |
| F3 requester persist 제거 | EP-11·VP-34 | 최초 | approval 새5 중 4 | red·원복 |
| F4 writer late args 보정 제거 | EP-11·VP-36 | 최초 | 실제 DB15 중 2 | red·원복 |
| F5 SQL args UPDATE no-op | EP-11·VP-34 | 최초 | 실제 DB15 중 5 | red·원복 |
| F6 reducer 기존 call 보정 no-op | EP-11·VP-35 | 최초 | renderer 새4 중 2 | red·원복→관련42 green |
| F7 SQL session 조건 제거 | EP-12·VP-34 | 최초 | 실제 DB15 중 1(잘못된 session/message 조합) | red·원복 |
| F8 adapter mode observer 제거 | EP-13·VP-37 | 최초 | adapter91 중 1 | red·원복 |
| F9 frame delegate mode key 누락 | EP-13·VP-37 | 최초 | runtime VP-37 2 중 2 | red·원복 |
| F10 adapter delegate mode key 누락 | EP-13·VP-37 | 최초 | runtime VP-37 2 중 2 | red·원복→2 green |
| D1 서술이 있으면 파일 사용 안 함 | VP-09′ | red | adapter91 중 9 | red·원복 |
| D2′ 파일 전 input plan 즉시 반환 | VP-09′ | red | 같은 91 중 12 | red·원복 |
| D3′ 정상 입력도 spread 객체 | VP-09′ | red | 같은 91 중 10 | red·원복 |
| D4′ 보정 planFilePath 제거 | VP-09′ | red | 같은 91 중 20 | red·원복 |
| D5 Stop cell 비움 제거 | VP-10 | red | 같은 91 중 3 | red·원복 |
| D6 child Write guard 제거 | VP-10 | red | 같은 91 중 2 | red·원복 |
| D7 계획 hook 편입 제거 | VP-11′ | red | 같은 91 중 5 | red·원복 |
| D8 tracked getter 다른 셀 | VP-11′ | red | 같은 91 중 5 | red·원복 |
| D9 callback getPlanFiles 미주입 | VP-11′ | red | 같은 91 중 9 | red·원복 |
| D10 서술을 CLI 입력에 동봉 | VP-09′·20 | red | 같은 91 중 11 | red·원복 |

분모 검산: 선택 증거 20 · 인용 변이 0 · 별도 새 oracle 0 = 표 20행. 새로운 배선 oracle의 민감도는 선택 F1~10과 같은 행이다. 승계 red 10개 중 이번 green은 0개다. 임시 변이는 각 실행의 finally에서 원본 bytes를 복원했고 최종 기준선 테스트로 대조했다. 다른 직접 행동 oracle에는 임의 변이를 등록하지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 문구·상태의 소비자가 있는가 | 신규 문구 없음; 보정 입력은 Work/Code 카드, 실제 모드는 controller/renderer가 소비 | 두 카드 SSR·실제 IPC 테스트 |
| seam 재배치 뒤 정리 코드 스코프가 유효한가 | reader handle finally 유지, map은 TurnContext와 함께 회수 | fresh/continuation 독립 map 테스트 |
| 실패 경로가 Part I 어느 행인가 | 파일 부재/실패 fallback, deny/revise/abort, 다른 owner 음성 | CLI에 가짜 path·narrative 미주입 |
| 실패가 아무 일도 안 일어난 것으로 보이는가 | 기존 broker 응답/취소 UI 유지; DB write failure는 critical 경로로 전파 | 오류 전파 fixture |
| 늦은 응답이 화면을 되돌리는가 | callback 정본으로 old call만 수정, old channel mode·다른 세션·이전 user 경계는 제외 | 두 도착순서·음성 tests |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| I-01 | 기존 writer는 세션 미확정 started를 버렸다 | ✅ 최소 보류 배열 + init 뒤 flush | 실제 DB 두 호출 순서 fixture |
| I-02 | 같은 세션 이전 턴에서 같은 tool ID 사용 가능 | ✅ SQL current message scope, renderer 현재 user 경계 | 실제 DB 이전 메시지 음성·renderer ownership |
| I-03 | child 승인/모드 결과가 메인 상태를 바꿀 수 있었다 | ✅ main getter·서술·SDK updatedPermissions 및 requester 모드 후처리 격리 | child 실제 adapter/requester 음성 |
| I-04 | 외부 실제 모델의 입력 주입 차이는 기계 fixture만으로 단정 못 함 | ⚠️ 보고만, 기존 §8 사람 실기 유지 | 실제 모델 실행/앱 시각 실기는 이번 턴 미실행 |

### 설계 대비 명시적 차이

기존 pending row 재사용이라는 가정과 달리 메인 Exit started 전용 배열을 추가했다. SQL은 generic API에 session·message·call·name·main 범위를 전달해 provider 정책을 infra literal로 넣지 않는다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 / 관측 |
|---|---|---|
| 만료 | 임의 TTL 없음; 턴 context 수명 | AC25·fresh map 독립 |
| 공유 | map/배열의 소유 context가 바뀌면 옛 입력이 섞일 수 있음 | AC25·새/continuation fixture |
| 재진입 | init flush가 같은 배열을 다시 쓰면 중복 저장 가능 | 배출 전에 배열 delete; DB 최초 순서/개수 직접 단언 |
| 다른 무효화 축 | 다른 세션 확정·Stop·child·old channel | owner guard 및 old call/새 call 분리·mode 폐기 음성 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | adapter·TurnRequest·approval/observer/send·TurnContext/fresh state·history/SQL·reducer·shared helpers와 관련 tests, 현재 provider-runtime 문서. 목록 정본은 구현 diff. |
| 실행 명령 | Vitest main adapters/history/sessions/chat-turn + shared·신규 renderer; 기존 0249 renderer 수용 테스트; ESLint src/scripts(동일 gate의 no-fix), node/web/test tsc, scripts 직접 Node, doc/budget/migration guard. |
| 관측한 게이트 산출 | main 영향109파일1248 + 추가 renderer49파일414 green(파일별 중복 제거157파일1658). scripts132 green. lint0error/기존1warning, node/web/test typecheck 진단0, inventory/budget/migration/diff 정상. 선택20변이 red 후 원복. |
| V-pair 자기확인 | SELF_PASS12 / SELF_BLOCKED0, 비영향 NOT_REQUIRED25 |
| 강제 지점 전수 | 기존8 + EP-11 6 + EP-12 4 + EP-13 6 + EP-14 4, 빠진 경로 없음 |
| AC 자기보고 | ✅25/25(기계 범위), 각 행의 이번 관측은 아래 표. 실 외부 모델·시각 실기는 기존 §8과 별도. |
| 합계 검산 | 기존 유효21 + AC24~27 신규4 =25. 폐기 AC12/13은 분모 밖. |
| 블로커 / 역질문 | 기계 범위 없음. 실제 외부 모델·시각 실기는 별도 사람 몫. |
| 대상 커밋 | (r1.4 구현 — 좌표는 INDEX 검증자 기입) |

| 유효 AC | 자기 상태 | 이번 턴의 관측 |
|---|---|---|
| AC1 | ✅ | skills 카탈로그/목록/상세의 연결됨·Connected·기본 제공 |
| AC2 | ✅ | useSessionCompletion·sessions 표시 요청3종 |
| AC3 | ✅ | 열람 해제·다시 열기·삭제 |
| AC4 | ✅ | 완료/요청 마지막 사유·동일 표시 |
| AC5 | ✅ | unknown/no-session/unsubscribe 음성 |
| AC6′ | ✅ | CanonicalBackgroundContent 양성 셸/Agent·Spark |
| AC7′ | ✅ | visibility·배경 render의 foreground/ambient/실패 음성 |
| AC8′ | ✅ | background-open·panel 개별 선택/중단/완료 지우기 |
| AC9′ | ✅ | actual query empty 입력·파일 본문·path 반환 |
| AC10′ | ✅ | 파일/입력/서술 조합·파일 없는 입력 불변 |
| AC11 | ✅ | main Write/Edit·child·Stop·경로/상한/링크/close·8.3 |
| AC14′ | ✅ | actual SDK query 포획 hook/getter·CLAUDE_CONFIG_DIR |
| AC15 | ✅ | partsArtifacts·transcript 최신 버전/최초 위치 |
| AC16 | ✅ | category/파일/턴 경계·store 저장 ref |
| AC17 | ✅ | transcript Work/Code 진행/완료 카드→메타 슬롯 |
| AC18 | ✅ | 157파일1658·scripts132·lint0error/1warning·3종tsc·문서/guard·diff; trailer는 커밋 뒤 재독 |
| AC19′ | ✅ | CanonicalBackgroundContent.spark 실제 Mapper·정착 진리표 |
| AC20 | ✅ | chatStore.background-open 인라인 선택과 main/child 상세 |
| AC21 | ✅ | resolver BOM/CRLF/끝 공백·경로·원본 입력 reference |
| AC22 | ✅ | AgentEnvironmentView.count 실제 카드 수·빈 상태 |
| AC23 | ✅ | canonical settlement·background display·미확인 시간/중단/clear·늦은 실제 통지 |
| AC24 | ✅ | actual adapter·requester·SQLite·decoder·Work/Code live/reload |
| AC25 | ✅ | 두 도착순서·파일 수정·Stop·중복·owner/turn·fresh map |
| AC26 | ✅ | child getter·서술/권한 억제, Enter message·Exit filePath·파일 없는 입력 |
| AC27 | ✅ | SDK 6종 init/status→controller/IPC·확정 순서·latest delegate·old channel 음성 |

합계 검산: ✅25 · ⚠️0 · ❌0 =25. 이전 유효21에 신규4를 더했으며 폐기 AC12/13은 포함하지 않는다. 테스트의 it.each가 같은 fullName을 갖는 경우를 합치지 않고 파일별 assertion 개수로 1658을 재검산했다. 테스트 타입의 nullable 반환 누락은 수정 후 해당7개 green·최종 test tsc 진단0으로 재확인했다. 변이 중 실행된 tsc의 unused 진단은 원복 후 정상 검사와 구별했다.

## [구현자 기입] Review Signals — 사실만

- 이번 불변식은 이전 파일 폴백 축을 action·started·history·card·mode 소비처까지 확장한다.
- 기존 EP-04′는 승인 본문/CLI 반환만 잠가 원본 도구 카드와 실제 SDK mode 보고를 보지 않았다. ΔV3가 해당 경로를 명시했다.
- Temp 조상 lstat의 sandbox EPERM은 승격 테스트로 분리했다. SQLite 실제 ABI127은 plain Node로 실행했고 Electron ABI140 실패는 알려진 환경 차이로 분리했다. ABI 전환은 하지 않았다.
- 현재 r1.4는 사용자 요구 변경 턴이다. 독립 검증 PASS를 선점하지 않으며 다음 주체는 검증자다.

---

# ΔV3.1 — 세션 확정 전 승인 소유권 보완 (2026-10-06)

## Product & UX Contract / 기준선

r1.4 독립 검증의 X1은 기존 D-033·AC24/25 위반이다. 세션 ID 발급 전에 계획 승인을 요청하고 사용자가 다른 채팅을 열면 계획이 현재 화면에 들어갔다. 기존 파일 정본·승인 시점 입력·Enter/Exit 계약과 D-001~035는 유지한다. 제품 결정 변경은 없다.

| 상태 | 관측 결과 |
|---|---|
| 새 채팅 승인 요청이 session.updated보다 먼저 도착 / 사용자는 다른 채팅 열람 | 요청은 진행 중인 pending draft에 남으며 다른 채팅의 상태·입력은 바뀌지 않는다. |
| 세션 확정 전 거부·취소 / 먼저 종료된 draft의 늦은 해결 | approvalId가 일치하는 미해결 요청 소유자만 정리한다. 일치하는 요청이 없으면 다른 draft·채팅을 바꾸지 않는다. |
| 미해결 승인 요청을 가진 draft의 세션 승격 | 계획·요청 ID·보정 입력이 실제 세션으로 이동한다. 승인 3종의 대기를 실제 sessionId로 한 번 통지해 D-002/AC2 표시가 이어진다. noid 요청 순간 nav 표시가 없다는 AC5는 유지한다. |
| 해결 후 승격 / 기존 세션·모드 patch 재방출 | 대기 통지를 만들거나 열람으로 해제한 표시를 되살리지 않는다. 실제 열람 가드는 기존 sessions store가 판단한다. |

기준은 ΔV3 설계 `68c39bdd`·식별자 정정 `b110cca6`와 구현 `963464c8`다. 모두 로컬 `git cat-file -t`로 확인한다. 원격 push는 자동 승인 검토 거부로 미실행이므로 공유 브랜치 존재를 주장하지 않는다.

## Delta V / 영향받는 규범 행

AC 수는 25, 유효 pair는 37이다. AC24/25의 기존 소유권 계약을 새 세션 draft → 실제 세션 경로에도 적용한다. ΔV3의 파일·모드·child 계약은 그대로다.

| node | 변화 | pair / 근거 |
|---|---|---|
| R-04·SD-02·AR-02·MD-06 | CHANGED | 기존 VP-33~36의 도착 순서·승인 입력 운반·소유자 식별을 승인 이벤트의 draft 수명까지 확장한다. |
| R-02·SD-01·AR-01·MD-01·R-0224-37 | INHERITED / REGRESSION | 승인 승격 통지가 기존 주의 표시·열람 해제·app 구독·순수 store·완료 표시를 소비한다. VP-02·03·04·05·19. |
| 나머지 ΔV3 선택 노드 | INHERITED / 기존 선택 유지 | 파일 resolver/reader/hook 및 실제 mode observer 경로는 기존 직접 oracle·변이로 재검증한다. |

ΔV3 선택표 중 VP-33·34·35·36의 경로에 `createApprovalRequester → ingestChatEvent → chatStore.receive → pending draft / approvalId owner → promotePendingNewChat → reducer`를 추가한다. VP-36 직접 oracle은 실제 requester와 production store를 연결해 init 전 요청·해결·화면 전환·다음 draft·승격을 관측한다. VP-35는 승격 뒤 실제 Work/Code 계획 카드와 이웃 입력이 유지되는지 확인한다.

VP-02·03·04·05·19는 기존 NOT_REQUIRED를 대체하는 REGRESSION이다. VP-02의 production path에 성공한 draft 승격 → 미해결 3종 검사 → 기존 responseRequest 구독 → 주의 Map·SessionRow SSR를 추가한다. VP-03은 해결·열람·재방출 수명, VP-04는 기존 feature/app 경계, VP-05는 store 값·identity, VP-19는 완료 표시 보존을 관측한다.

이번 선택은 REQUIRED 7 + REGRESSION 10 =17, 나머지 20은 ΔV3와 같은 비영향 근거로 NOT_REQUIRED다. 새 node·새 pair·새 IPC/data schema는 없다.

## Technical Design

1. 세션 ID 없는 permission.requested는 pendingNewChatKey를 우선 사용한다. pending draft가 없을 때의 기존 active fallback은 유지한다. assistant/started 스트림 라우팅은 확대하지 않는다.
2. 세션 ID 없는 permission.resolved는 현재 미해결 3종의 approvalId를 비교해 owner를 찾는다. owner가 없으면 no-op한다. 별도 cache/owner Map 없이 기존 승인 상태를 읽는다.
3. promotePendingNewChat의 실제 re-key 성공을 호출자에게 반환한다. 해당 최초 session.updated를 reducer에 적용한 뒤 미해결 pendingAsks·pendingPlanReview·pendingToolApprovals가 있으면 기존 responseRequestListeners에 실제 sessionId를 한 번 통지한다. 재방출·모드 patch는 승격 성공이 아니므로 통지하지 않는다. activeKey를 열람 판정으로 쓰지 않는다.
4. requester의 “승인 전에 dbSessionId가 항상 확정된다”는 주석·warn 가정을 제거하고 pre-init 경로를 명시한다. canonical input의 persist-before-send와 broker 수명은 유지한다.

## §10 강제 지점 / gate 보완

| ID | 대체 범위 / 지정 물리 자리 | 직접 oracle / 선택 적대 증거 |
|---|---|---|
| EP-12′ | ΔV3 EP-12를 대체한다. 기존 shared 식별·writer 턴 Map·SQL session filter·reducer call 식별 4자리와 renderer noid requested 라우팅·noid resolved approvalId owner 2자리: 6자리. | requester→store 실제 승인 대기 중 owner/이웃 상태, pre-init 해결, 다음 draft 보호. 기존 M-F7 + M-F11(requested를 activeKey로 원복)·M-F12(resolved를 pending/active fallback으로 원복). |
| EP-02′ | 기존 EP-02의 8자리를 유지하고 실제 draft 승격의 미해결 요청 통지 생산자 1자리를 추가한다: 9자리. | 3종별 noid순간 Map0·승격 뒤 Map/SSR·해결 전후·재방출·unsubscribe·실제 viewed gate. 기존 M-B1~3 + M-B6(승격 통지 제거). |
| EP-13′ | ΔV3의 5그룹 표기를 물리 6자리로 풀어 적는다: adapter report·TurnRequest app callback·runtime frame delegate·runtime adapter delegate·controller set·renderer send. 동작 계약은 그대로다. | 실제 모드/수명 직접 oracle, M-F8~10. |
| EP-04″ | 기존 EP-04′의 7항목을 실제 8자리로 풀어 적는다: PostToolUse record·Stop reset·hook 병합·동일 셀 getter 전달·resolver·request.plan·allow.updatedInput·declared path 판정/읽기. 동작 계약은 그대로다. | 실제 resolver/reader/hook oracle, M-D1~10. |
| EP-11·14 | ΔV3 그대로. | 등록 M-F1~10 승계. |

선택 변이는 기존 20 + 승계 M-B1~3 + 신규 M-B6·M-F11~12 =26이다. 실제 분모·제거 red·원복 green을 독립 확인한다. 새 물리 자리는 X1 소유권과 승격 통지의 운반을 보장하므로 선택했다. 적용 gate는 ΔV3의 subtree lint·typecheck·영향 테스트·doc/test budget/migration guard·diff/trailer·로컬 기준선 확인을 그대로 수행한다. real model·시각 실기와 원격 CI/공유 브랜치 전송은 기계 fixture와 구별해 미실행 여부를 기록한다.

## READY self-review

D-033/AC24·25 및 D-002/AC2·5의 기존 의미를 교차 확인했다. 새로운 제품 정책을 발명하지 않고 기존 소유자·대기 표시 계약의 빠진 전달 경로를 보완했다. 원인·직접 oracle·생산자/소비자·수명·§10 물리 자리와 변이/운영 gate를 연결했다. 기존 AC25를 완화하지 않았고 UNKNOWN/noid 순간의 nav 가드와 실제 열람 의미를 유지했다. 설계 변경과 구현 산출은 별도 커밋한다.

---

# ΔV3.2 — 취소·폐기 채널 승인 콜백 수명 보완 (2026-10-06)

**기존 소유권 계약을 유지한다.** 구현 중 실제 SessionRuntime·makeCanUseTool·requester·ApprovalBroker를 연결한 probe에서 옛 Exit의 파일 읽기 대기 → 채널 폐기 → 새 send/delegate 교체 → 옛 읽기 완료가 현재 턴의 persist/requested를 실행했다. SDK signal이 이미 abort되어 broker가 deny해도 화면·이력 쓰기는 먼저 일어났다. 별도 requester probe에서도 이미 취소된 SDK 요청이 persist/requested 이후 deny했다. 이는 D-033·AC25의 다른 턴/세션 격리와 AC26의 child 수명 경계에 적용할 구현 누락이며 새로운 제품 결정은 아니다.

기준은 ΔV3.1 로컬 설계 `0a59d198`와 r2 진행 중 조사다. AC25·26, SD-02·AR-02·MD-06 및 VP-34·36의 기존 경로를 runtime wrapper의 captured channel signal → requester의 유효 승인 signal → persist/send/register 순서까지 확장한다. 신규 AC·node·pair는 없다. 선택17·NOT_REQUIRED20은 ΔV3.1과 같다.

| 상태 | 완료 관측 / 직접 oracle |
|---|---|
| 파일 읽기 중 폐기된 채널의 늦은 main 승인 콜백 | deny하며 현재 delegate·현재 턴의 persistence·IPC surface를 호출하지 않는다. 실제 runtime 교체 + canUseTool 파일 await fixture로 다른/같은 sessionId의 새 턴을 대조한다. |
| 요청 진입 때 SDK signal 또는 main turn signal이 이미 취소됨 | persist·requested/resolved·broker register·모드 변경을 실행하지 않고 deny한다. |
| main turn 취소, SDK signal이 살아 있는 child 요청 | 기존 child 독립 수명을 보존한다. child SDK 취소만 해당 broker를 해소한다. 정상 main과 다음 채널 요청도 기존 동작이다. |

기술적으로 requestApproval wrapper는 captured channel signal과 요청 SDK signal의 aborted 값을 delegate 접근 전에 검사한다. requester는 기존 main/child 신호 합성 규칙을 사용하되 regSignal 계산·aborted 판정을 자동 허용·persist/send보다 앞에 둔다. 신호가 진입 때 살아 있고 이후 취소되는 경우는 기존 broker cancel/resolved 경로를 유지한다. main turn signal을 child 요청에 추가하지 않는다.

§10 EP-12″는 EP-12′의 6자리와 runtime requestApproval의 폐기 채널/요청 신호 검사, requester의 surface 전 유효 신호 검사 2자리를 합친 **8자리**다. VP-34·36의 직접 oracle에 옛 채널·이미 취소된 요청의 side effect 0과 live child 양성 대조를 추가한다. **M-F13**(requester의 조기 aborted 판정 제거)과 **M-F14**(runtime wrapper의 channel/SDK guard 제거)를 신규 선택한다. F14는 요청 SDK signal이 살아 있어도 폐기 채널이 현재 delegate를 호출하지 않는 실제 runtime oracle로 측정해 requester의 중복 guard에 가려지지 않게 한다.

등록 변이는 ΔV3.1의26 + F13·14 =28이다. 나머지 운영 gate·EP-02′·EP-04″·EP-11·EP-13′·EP-14는 그대로 유지한다. READY self-review에서 신규 정책이 아닌 기존 소유권·취소 계약 적용임을 확인했고 main/child 양성·음성 oracle과 실제 강제 지점 및 선택 변이를 연결했다. 구현 산출과 별도 설계 커밋으로 보존한다.

### ΔV3.2 강제 지점 추가 정정 — 자연 종료도 채널을 폐기한다

읽기 pre-audit에서 자연 iterator 종료/오류와 turn-scoped finally의 공통 retireChannel이 captured signal을 무효화하지 않는 것을 확인했다. 명시 teardown만 신호를 abort하면 같은 폐기 계약을 만족하지 못한다. 공통 retireChannel에서 이전 신호를 abort하고 새 controller로 교체하며, teardown의 중복 abort/교체는 이 공통 자리로 옮긴다. 폐기 observer·live.close 전에 신호를 무효화하고, 살아 있는 persistent 채널의 main interrupt는 기존 수명을 유지한다.

EP-12″의 8자리에 공통 retireChannel의 신호 무효화 생산자 1자리를 추가해 **9자리**로 정정한다. VP-36/37은 explicit teardown·자연 done·자연 error·turn-scoped retirement 뒤의 늦은 승인/모드 callback이 현재 delegate를 부르지 않음을 직접 관측한다. **M-F15**는 공통 retireChannel의 신호 abort/교체를 제거하여 natural retirement 대조가 red인지 검사한다. registered 변이는 **29**(26+F13~15)로 정정하며 선택17·NOT_REQUIRED20·기존 제품/AC 계약은 유지한다. 자연 폐기 생산자와 wrapper 소비자를 함께 전수에 포함하고 별도 설계 커밋으로 구현 전 보존한다.

승격 통지 제거의 신규 ID는 **M-B6**이다. 기존 ACTIVE VP-26의 M-B4(openSubagentTask 선택 연결 제거)를 보존하기 위해 ΔV3.1의 신규 명칭 충돌을 정정했다. 물리 자리·oracle·선택 분모29는 불변이다.

---

# [구현자 기입] r2 — ΔV3.1·ΔV3.2

## [구현자 기입] 설계 리뷰

기존 D-033·AC24/25의 소유권을 init 전 pending draft부터 실제 세션 승격까지 적용했다. 독립 X1의 다른 채팅 오표시를 재현한 정식 테스트의 기대값을 유지하고 수정 후 green을 확인했다. 파일 읽기 중 폐기된 채널의 늦은 콜백도 실제 runtime·adapter·requester·broker로 재현했으며 ΔV3.2의 별도 설계 후 보정했다. 새 제품 정책·IPC·DB schema·owner cache·의존성은 없다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 행 | 지정 / 확인 | 실제 생산자·소비자 / 직접 관측 |
|---|---:|---|
| EP-04″ | 8 / 8 | record·Stop·hook 병합·getter·resolver·request.plan·allow.updatedInput·declared reader; 기존 실제 adapter/reader fixture와 D1~10. |
| EP-11 | 6 / 6 | started→action.input→persist→late started→SQL→reducer; 실제 입력·payload·Work/Code SSR 및 F1~6. |
| EP-12″ | 9 / 9 | 기존 helper/turn Map/SQL/reducer 4 + noid 요청/해결 2 + requester early signal/runtime wrapper guard/common retire signal 3; 다른 owner·다음 draft·late old channel 직접 대조. |
| EP-02′ | 9 / 9 | 기존 요청·완료·app 구독·두 mark·열람·삭제·행 표시 8 + 실제 승격의 미해결 통지 1; 3종 Map/SSR, viewed/해결/재방출 음성. |
| EP-13′ | 6 / 6 | adapter→app port→frame/adapter delegate→controller/renderer; 실제 mode 및 폐기 채널의 옛 report 음성. |
| EP-14 | 4 / 4 | Enter/Exit 설치 SDK 필드·결과와 plan READY/ΔV3.2·INDEX·trailer 재독. |

검색 주어는 `permission.requested|permission.resolved|promotePendingNewChat|resolveApprovalOwner|requestApproval|regSignal|channelController|retireChannel|onPermissionModeChanged|planReviewToolInput`다. 생산자/소비자를 실제 코드와 위 지정 집합으로 대조했다. retire caller는 consumeTurnScoped finally·finishPump·teardown 세 경로이며 모두 공통 신호 무효화 자리로 들어간다. persist/send보다 앞의 취소 검사와 signal을 소비하는 runtime guard를 함께 확인했다. stream started/assistant 라우팅은 이번 owner 보정의 수정 대상이 아니다.

## [구현자 기입] 이번 라운드 수정의 잠금

최종 영향 회귀는 **178파일·1842 assertions pass, 0 fail**이다(`app/.tmp-0249-r2-regression-final.json`, testResults.length와 파일별 assertion 길이 합을 따로 확인). scripts는 JUnit testcase132·failure/error0이다. 새 owner/attention29, lifetime18 및 runtime81의 실제 값을 포함하며 중복된 스위트 실행 횟수를 합산하지 않는다.

등록29자리는 각각 생산 코드 한 자리를 제거하여 assertion red를 확인했다. F9/10과 F13~15의 분모는 필터로 **실제로 실행한 assertion**이며 skip을 성공에 넣지 않는다.

| 변이 | red 실패 / 실행 | 원복 대조 |
|---|---:|---|
| F1·F2 | 1/91 · 4/91 | 최종 원복 9파일·214 green |
| F3·F4·F5·F6·F7·F8 | 4/5 · 2/15 · 5/15 · 2/4 · 1/15 · 1/91 | 같은 영향 스위트의 최종 원복 214 green |
| F9·F10 | 각각 2/2 (각79 skip) | 최종 원복 runtime81 green 포함 |
| D1·D2′·D3′·D4′·D5 | 9/91 · 12/91 · 10/91 · 20/91 · 3/91 | 최종 원복 adapter91 green 포함 |
| D6·D7·D8·D9·D10 | 2/91 · 5/91 · 5/91 · 9/91 · 11/91 | 최종 원복 adapter91 green 포함 |
| F11·F12 | 10/10 · 2/10 | 각 bytes 동일 원복 후 같은10 green |
| B1·B2·B3·B6 | 1/19 · 4/19 · 3/19 · 4/19 | 각 bytes 동일 원복 후 같은19 green |
| F13·F14·F15 | 3/5 · 2/2 · 8/8 (각13·16·10 skip) | 각 bytes 동일 원복 후 같은 필터 green, 최종18 green |

기존20의 finally는 원본 Buffer와 byte equality를 검사했고 최종 관련9파일·214 assertions를 다시 실행해 green을 확인했다. 신규9는 자리별 red→원복→같은 필터 green을 실행했다. B6는 기존 ACTIVE B4와의 이름 충돌 정정 후 현재 ID로 재실행했다. r1.4의 수치를 재사용하지 않았으며 F8의 현재 실패 수는1/91이다. 증거는 `app/.tmp-0249-r2-mutation-results.json`, `.tmp-0249-owner-mutation-results.json`(정정 전 B4는 제외)·`.tmp-0249-owner-mutation-results-selected.json`(B6), `.tmp-0249-lifetime-mutations.results.json`, `.tmp-0249-r2-restored.json`이다.

## [구현자 기입] Product/UX 파생 검토

| 상태 | 수정 후 관측 |
|---|---|
| init 전 plan 요청, 다른 기존/새 채팅 열람 | 원래 pending draft만 승인 상태를 가지며 이웃 entry reference는 유지된다. |
| init 전 deny/SDK cancel / 다음 queued draft의 늦은 unknown 해결 | 같은 승인 ID owner만 정리하고 다른 draft retry/state identity를 보존한다. |
| request→승격→actual SID resolved | 계획/요청 ID/보정 call 입력·이웃 part가 유지되고 Work/Code SSR의 본문·경로가 같다. |
| 미해결 3종 승격 / 해결 후 승격 / mode 재방출 | 실제 세션 대기 Map·행 SSR가 한 번 이어지며 해결·열람·unsubscribe 음성은 표시를 만들지 않는다. |
| 취소·폐기된 요청 / main abort+live child SDK | 앞선 요청의 side effect 0, child는 독립 SDK 수명을 유지하며 정상 후속 send/listen을 차단하지 않는다. |

## [구현자 기입] 놓친 잠재 문제 + 대응

D5의 원인은 init 선행 가정이 아니라 control callback과 iterator의 독립 순서다. renderer owner 경로를 고쳤으며 독립 검증자의 closed 판정은 아직 받지 않았다. 해결 이벤트에 단순 pending fallback을 적용하면 다음 draft의 retry까지 바뀌므로 기존 승인 ID lookup/no-op 대체물을 사용했다.

추가 수명 probe는 파일 await 뒤 옛 wrapper가 새 delegate로 forwarding하고 이미 취소된 요청도 persist/send 뒤 deny하는 것을 관측했다. 진입 전 유효 신호 검사·captured channel guard로 보정했다. pre-audit가 찾은 natural retirement의 signal 잔존도 공통 retire 생산자로 보정했으며 explicit teardown·done·error·oneshot 및 기존 자원 회수 회귀를 확인했다. 별도 actor cache를 추가하지 않고 기존 controller 수명과 pending state를 사용했다. persistent main interrupt는 공통 retire를 호출하지 않아 살아 있는 child 수명을 유지한다.

기존 D1·D2·D4는 비영향 미해결 상태를 유지한다. 실제 외부 모델·Windows 시각 실기·remote CI는 미실행이다. push는 자동 승인 검토가 목적지 전송 권한을 이유로 거부했고, 원격 게시 없이 로컬 구현/검증을 진행했다.

## [구현자 기입] 구현 보고

선택 REQUIRED7 + REGRESSION10 =17은 자기검증 대상이며 비영향20은 기존 기준선으로 NOT_REQUIRED다. 독립 검증 PASS를 선점하지 않는다.

| AC | 기계 fixture 자기판정 / 직접 관측 |
|---|---|
| AC1 | ✅ skills 카탈로그·목록·상세의 연결됨/Connected·기본 제공·인증 액션 부재 |
| AC2 | ✅ 3종 실제 요청·승격→주의 Map·행 SSR |
| AC3 | ✅ 열람/다른 route 실제 viewed guard |
| AC4 | ✅ 완료/대기 마지막 사유·동일 사유 identity·삭제 |
| AC5 | ✅ unknown/noid 요청 순간·불일치·해결 후 승격·삭제·unsubscribe 음성 |
| AC6′ | ✅ canonical background의 셸/Agent/Monitor/Workflow/MCP 등 종류별 카드·완료 보존 |
| AC7′ | ✅ 양성과 같은 state의 foreground·ambient·실패 호출 목록/count/clear 음성 |
| AC8′ | ✅ background-open·panel의 기존 Agent/셸 상세·개별 중단·완료 지우기 |
| AC9′ | ✅ 파일 정본→request/action/CLI 입력 |
| AC10′ | ✅ 파일/입력/서술 조합·잘못된 입력 보정·파일 없는 입력 불변 |
| AC11 | ✅ reader 크기·일반/비링크·8.3·오류 |
| AC14′ | ✅ actual query의 동일 cell hook/getter·Write→Exit→Stop·CLAUDE_CONFIG_DIR |
| AC15 | ✅ partsArtifacts·transcript의 최신 publishedAt·동시각 최신 입력·첫 카드 위치 |
| AC16 | ✅ 다른 category/filename/턴 보존·store 실제 저장 refs |
| AC17 | ✅ Work/Code 진행/완료의 본문→카드→완료 메타·spark 1개 |
| AC18 | ✅ 영향178파일1842·scripts132·lint0error/기존warning1·3종tsc·문서/guard·diff·실제 trailer 파싱 |
| AC19′ | ✅ 실제 background Mapper 정상/반례의 Spark 집합·count 등식 |
| AC20 | ✅ 실제 openSubagentTask 인라인 Agent/Task 상세 선택·목록 복귀 부재 |
| AC21 | ✅ resolver BOM/CRLF/끝 공백·win32 경로 정규화·원본 입력 reference |
| AC22 | ✅ AgentEnvironmentView.count settings/runtime 병합·증감·빈0개 카드 수 |
| AC23 | ✅ unconfirmed 완료 그룹·고정 시간·중단 부재·clear·canonical 기록 불변·늦은 종료 통지 |
| AC24 | ✅ 실제 action→CLI→card/DB/reload, init 전 owner/승격 |
| AC25 | ✅ 두 순서·Stop·같은/다른 call/turn/session·FIFO·late retired callback |
| AC26 | ✅ Enter {}/message·Exit filePath·child main 파일/모드 음성·live child SDK 양성 |
| AC27 | ✅ init/status 6종→controller/renderer·latest delegate·old/child/replay 음성 |

검산: ✅25·⚠️0·❌0 =25(기계 fixture 자기판정). 외부 모델/시각 실기는 이 수로 성공을 주장하지 않는다.

| 적용 gate | 최종 실행 결과 |
|---|---|
| lint | `node node_modules/eslint/bin/eslint.js --cache ./src ./scripts` (no-fix): 0 error, 기존 `useTranscriptVirtualizer.ts:22` React compiler warning1. |
| typecheck | node·web·test 모두 exit0. 새 lifetime test의 mock 타입4건은 테스트 선언만 정정 후 test tsc·대상 eslint·lifetime18을 다시 통과했다. |
| 영향 테스트 | 실제178파일·1842 assertions pass; 변이 원복 후9파일·214 pass, 타입 정정 후lifetime18 pass. |
| scripts | JUnit testcase132·failure0·error0. |
| 문서·예산·마이그레이션·diff | doc-inventory·test-budget(실 git16검사 포함)·migration guard·`git diff --check` 모두 exit0. |
| 기준선·설계·handoff | main과 origin/main은 요청 당시 `ceda5c5a`에서 동기화0/0. ΔV3.1 `0a59d198`, ΔV3.2 `72e2d8eb`·자연 폐기 `0552d740`·신규 B6 `1576d485`는 별도 규범 커밋. INDEX는 impl/IMPL_DONE r2, 다음 검증자이며 D5는 독립 재검증 전 open. |
| 환경·외부 | installed plain Node SQLite ABI127로 실제 DB를 실행했다. Electron ABI140 재빌드·의존성 설치 없이 진행했고 real model·Windows 시각 실기·remote CI/원격 게시에는 성공 판정을 하지 않았다. |

로컬 구현 커밋은 contiguous `Agent: codex / Status: implemented / Criteria-Met: 25/25 / Verified-By: pending` trailer를 별도로 기록하고 파싱한다.

## [구현자 기입] Review Signals — 사실만

r1.4의 D5는 기존 AC25가 규정한 소유권을 requester→store edge에서 놓친 결함이다. 이번 턴은 같은 불변식의 요청·해결·승격·퇴역 callback 생산자/소비자를 함께 검사했다. 별도 pre-audit가 natural retire 생산자를 찾아 별도 설계와 실제 oracle로 보완했다. r2 formal 검증자가 자기보고 AC18~23 등의 설명 오매핑을 지적해 유효 AC와 실제178파일의 fixture에 맞춰 보고만 정정했다. 제품 결정 drift와 handoff 지침 변경은 없다. r2 첫 구현 턴이며 formal verify 전의 설계 보강은 라운드를 추가하지 않는다. 원격 게시·모델/시각 확인과 sandbox/ABI 환경 제한은 로컬 코드 gate와 구별했다.

---

# ΔV3.3 — 화면 승인 동작의 요청 소유권·child 모드 격리 (2026-10-06)

r2 독립 X2는 실제 adapter→requester→broker→IPC→chat reducer→approvePlan→다음 send를 연결했다. child 승인에서 SDK allow와 main controller는 올바르게 격리됐지만 renderer와 다음 전송의 permissionMode가 accept_edits로 바뀌었다. 다른 승인 ID와 이미 해결된 ID의 클릭도 현재 pendingPlanReview를 지우고 메인 모드를 바꾸며 respond를 보냈다. 같은 ID 검사 누락이 수정 요청·구조화 코멘트·거부의 세 형제에도 있어 네 응답 소비자를 함께 보완한다. 기존 Product/UX Contract의 “하위 호출은 메인 계획 모드에 영향을 주지 않는다”와 D-033의 소유권 위반이다. 신규 제품 결정은 없다.

기준선은 r2 생산 구현 `463019d7`, 자기보고 정정 `68f1a8c9`, r2 독립 FAIL `33c7c628`이다. AC 수25·유효 pair37·선택 REQUIRED7+REGRESSION10=17·NOT_REQUIRED20을 유지한다.

## Delta V / 영향받는 규범 행

| node / pair | 변화 | 직접 관측 |
|---|---|---|
| R-04·SD-02·AR-02·MD-06 / VP-35·36 | CHANGED | 실제 미해결 요청→화면의 approve/revise/comments/reject 네 응답 핸들러를 소유권 경로에 추가한다. 다른 ID·이미 해결됨·중복 클릭은 현재 entry·mode·승인 IPC를 바꾸지 않는다. |
| AR-02·MD-08 / VP-37·38 | INHERITED / 기존 REQUIRED 선택 유지 | 유효 main 승인만 종류별 목표 모드로 낙관 갱신하고 child 승인은 메인 renderer/controller/다음 send 모드를 보존한다. SDK init/status 경로는 그대로다. |
| 기타 선택 노드/pair | INHERITED | 기존 승인 입력·파일·수명·주의 표시 및 운영 gate를 그대로 재검증한다. |

Product/UX Contract·D-033/034를 화면 승인 소비자까지 풀어 적는다. AC25의 다른 호출 소유권은 화면 승인 ID에도 적용한다. AC26의 하위 호출 격리는 이미 규정된 메인 도구 카드·계획 모드 불변을 포함한다. API·IPC·DB schema·owner cache를 추가하지 않는다.

## Technical Design

1. 순수 currentPlanReview(requestId) helper가 현재 entry key·session·pendingPlanReview를 캡처하고 미해결 요청 ID를 비교한다. approvePlan·revisePlan·revisePlanWithComments·rejectPlan 네 핸들러는 이 helper의 유효 snapshot이 없으면 respond·resolve·mode 변경 없이 반환한다.
2. 유효한 요청만 각 핸들러의 기존 allow 또는 deny/feedback 응답을 보내고 캡처한 entry의 계획 승인을 해소한다. 빈 수정/코멘트의 기존 no-op은 유지한다. approvePlan은 child의 providerRequest.agentId가 있으면 메인 mode를 갱신하지 않는다. main은 기존 planApprovedMode(agentKind)를 적용한다.
3. SDK allow의 child updatedPermissions 부재와 main requester/controller 격리는 유지한다. 상태를 지운 뒤 provider metadata를 읽지 않는다. 별도 permission.setMode IPC도 추가하지 않는다.
4. 기존 r4 Work 승인 테스트는 실제 plan 모드 patch와 pending 요청을 입력한 뒤 승인하도록 fixture를 보강한다. 기존 allow 응답·목표 모드·추가 setMode IPC 부재의 기대값은 바꾸지 않는다. 독립 X2의 기대값은 그대로 유지한다.

## §10 강제 지점 / 변이 / gate

| ID | 지정 물리 자리 | 직접 oracle / 선택 변이 |
|---|---|---|
| EP-12‴ | 기존 EP-12″9자리 + currentPlanReview ID검사1·네 핸들러의 검사 호출4 =14자리. | 실제 X2의 네 응답별 다른 ID/이미 해결됨·중복·이웃 reference 음성 및 정상 응답 양성. 신규 M-F17은 helper의 ID 비교를 제거한다. M-F18~21은 approve/revise/comments/reject 각 한 호출의 조회 ID를 현재 pending ID로 바꿔 잘못 받은 ID를 허용하게 한다. 각각 different-id fixture의 값/IPC assertion red를 관측한다. |
| EP-13″ | 기존 EP-13′6자리 + renderer approvePlan의 main/child 모드 분기1 =7자리. | 실제 X2의 main 양성·child allow 및 controller/renderer/다음 send 비교. 신규 M-F16은 child guard를 제거해 child fixture의 mode assertion red를 관측한다. |
| EP-04″·11·02′·14 | 기존8·6·9·4자리 유지. | 설치 SDK·파일/후킹·보정 입력·주의 Map/SSR·상태/trailer 직접 대조. |

등록 변이는 기존29 + M-F16~21 =35다. F16은 child 행, F17은 different-id 네 행, F18~21은 해당 핸들러의 different-id 한 행을 필터해 실제 실행분모로 기록하고 bytes 원복 후 동일 필터 green을 대조한다. selected17 pair 및 기존29도 독립 재실행한다. subtree lint(no-fix)·node/web/test typecheck·영향 테스트·scripts·doc/test-budget/migration guard·diff/trailer·로컬 기준선 gate를 수행한다. 외부 모델·Windows 시각 실기·원격 게시/CI는 미실행을 기계 fixture와 구별한다.

## READY self-review

main/child 및 승인 ID 격리는 기존 계약을 보완하며 새 제품 정책을 결정하지 않는다. X2의 실제 연결과 main 양성·child/네 응답 소유권 음성의 baseline 실패를 대조했다. 정상 피드백 회귀 oracle을 설계하고 생산자→버튼 핸들러→mode/다음 전송 소비자를 §10과 변이에 연결했다. 규범 수정은 구현과 별도 커밋한다.


---

# ΔV3.4 — 승인 await 전 메인 턴 취소 신호 보존 (2026-10-07)

r3 구현 중 독립 phase-0 probe가 실제 SessionRuntime→makeCanUseTool→requester→broker를 연결했다. persistent main interrupt에서 채널을 살려 둔 채 옛 Exit 파일 읽기 대기→원래 턴 취소→production result(error_during_execution)로 drain 해소→같은/다른 세션의 새 send→옛 읽기 완료 순서를 주면 현재 delegate·persist·register·permission.requested가 각각1회 실행됐다(기대0). SDK signal 취소 음성과 live child 양성은 통과했다: 4건 중 PASS2·FAIL2·skip0. 설치 SDK0.3.286의 interrupt는 control request만 발신하며 SDK callback signal의 cancel-before-terminal 순서를 타입/API에서 보장하지 않는다. 실제 CLI가 위 순서를 발생시키는지는 확인하지 못했다. 앱 포트가 원래 메인 턴 소유권을 보존해야 한다는 D-033·AC25의 기존 계약을 보완한다. formal r3 검증 전 조사이며 라운드는3으로 유지한다.

## Delta V / 영향받는 규범 행

기준은 ΔV3.3 설계 `d6b9ace8`과 진행 중 r3 조사다. AC25의 다른 턴/세션 격리는 첫 승인 await 이전의 원래 메인 턴 signal에도 적용한다. D-034·AC26의 child SDK 독립 수명은 유지한다. SD-02·AR-02·MD-06 / VP-34·36은 CHANGED, VP-37·38과 나머지 선택 pair는 INHERITED다. AC25개·유효pair37·REQUIRED7+REGRESSION10=선택17·NOT_REQUIRED20을 유지한다. 외부 API·IPC·DB schema·owner cache·제품 정책 추가는 없다.

## Technical Design

1. TurnRequest와 CanUseToolOpts에 backend-neutral optional `getMainApprovalSignal?: () => AbortSignal | undefined`를 둔다. SessionRuntime.adoptDelegate(req)는 wrap 전 원래 req.signal을 scalar로 공표한다. runAttempt·runListen 공통 adoption이 초기/후속/listen/flush의 현재 signal을 갱신한다.
2. wrapRequest getter는 captured channel signal이 취소됐으면 그 신호를 우선 반환하고, 살아 있으면 마지막 adopted original signal을 반환한다. retireChannel에서 scalar를 무조건 지우지 않는다(adopt→teardown→spawn에서 새 신호를 잃지 않아야 한다). 퇴역 무효화는 기존 captured channel signal이 담당한다. signal을 FRAME_DELEGATE_KEYS에 추가하지 않는다. listen의 fresh signal이 이전 base signal로 덮이지 않아야 한다.
3. Claude 실제 query factory가 getter를 makeCanUseTool에 전달한다. requestApproval로 처리하는 AskUserQuestion·ExitPlanMode·위험/runtime 승인 경로의 main callback만 첫 await 전에 getter를1회 읽어 AbortSignal 객체를 지역 값으로 캡처하고 SDK signal과 합성한다. child는 getter를 읽지 않고 SDK signal만 사용한다. 중복 requestId(+provider generation)는 기존 Promise 재사용이며 await 후 getter를 재조회하지 않는다.
4. 유효 승인 signal이 이미 취소됐으면 파일/서술 조회·delegate·persist·register·IPC·모드 변경 전에 deny한다. 안전 도구·Agent/Task·approval callback 미주입의 기존 자동 통과 정책은 확장하지 않는다. 파일 await 후 Exit requestApproval에는 캡처한 합성 signal을 전달한다. AskUserQuestion과 위험/runtime 승인 두 호출의 신호 인자는 기존 소비 회귀로 대조한다. 기존 runtime wrapper/requester guard가 대기 중 취소를 차단한다.
5. 초기/자동 listen/flush 원 signal 생산자3곳과 runAttempt/runListen adoption2곳을 회귀 대조한다. 정상 초기/후속/listen/pre-init main, SDK 취소, 파일 대기 중 main 취소 뒤 동일/다른 새 owner, 살아 있는 child를 실제 경로로 관측한다. 이미 취소된 main은 파일/서술 getter 및 surface side effect0을 단언한다. 실제 ClaudeAdapter.query factory 배선을 별도 oracle로 잠근다.

## §10 강제 지점 / 변이 / gate

| ID | 지정 물리 자리 | 직접 oracle / 선택 변이 |
|---|---|---|
| EP-12⁗ | EP-12‴14자리 + main signal 캡처/합성·adopt original signal 공표·runtime getter·query factory 전달·entry aborted guard·Exit의 await 후 requestApproval signal 인자6 =20자리. 두 타입 정의는 운반 계약으로 별도 확인한다. | M-F22 캡처/합성을 SDK-only로 교체; M-F23 adopt signal 공표 제거; M-F24 runtime getter를 channel-only로 교체; M-F25 query factory getter 전달 제거; M-F26 entry aborted guard 제거; M-F27 Exit의 await 뒤 requestApproval signal을 SDK-only로 교체. 각 실제 값 assertion red→원본 bytes 원복→같은 필터 green을 확인한다. |
| EP-04″·11·02′·13″·14 | 기존8·6·9·7·4자리 유지. 전체 지정54자리. | 기존 파일/입력·DB/card·draft/주의·네 응답/child mode·SDK 계약·상태/trailer 직접 대조. |

등록 변이는35+F22~27=41이다. 신규6과 기존35를 독립 재실행하고 필터 skip은 실행분모와 성공에서 제외한다. 같은 생산자→포트→콜백→requestApproval 운반 edge를 포함해 §10 전수를 재검색한다. 기존 운영 gate와 외부 모델·Windows 시각 실기·원격 게시/CI 미실행 구별을 유지한다.

## READY self-review

D-033·AC25의 원래 턴 소유권을 비동기 파일 읽기 이전에 잡고 D-034·AC26의 child 독립성을 유지한다. 원래 signal 생산3→adopt2→runtime getter→실제 query factory→main 캡처→await 뒤 운반→기존 소비 guard를 연결했다. 두 음성 실패와 SDK 취소/child 양성 대조의 독립 증거를 보존하고 실제 CLI 순서의 미확인을 명시했다. 규범 수정은 구현 산출과 별도 커밋한다.

---

# [구현자 기입] r3 — ΔV3.3·ΔV3.4

## [구현자 기입] 설계 리뷰

D6의 기존 child 격리·요청 소유권 계약을 화면 네 계획 응답까지 적용했다. 승인 전에 현재 key·session·pending review를 캡처해 요청 ID를 검사하며, 하위 승인에는 메인 mode 갱신을 하지 않는다. 네 유효 응답은 기존 allow/deny/feedback 형상을 유지한다. 기존 r4 Work fixture에 실제 plan patch·pending 요청을 넣고 기존 기대값은 유지했다. 독립 X2 원래10케이스는 기대값을 바꾸지 않았고 실제 SDK deny/피드백·중복·빈 입력 양성3을 추가했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 행 | 지정 / 확인 | 실제 생산자·소비자 / 관측 |
|---|---:|---|
| EP-04″ | 8 / 8 | 파일 기록·Stop·hook·getter·resolver·request.plan·allow.updatedInput·reader, D1~10 및 실제 SDK fixture. |
| EP-11 | 6 / 6 | started·action.input·persist·late started·SQL·reducer의 보정 입력, F1~6. |
| EP-12⁗ | 20 / 20 | 기존14 owner/수명·화면 응답 자리 + original signal adoption·runtime getter·query 전달·main 캡처/합성·entry abort·Exit await 후 signal 전달6, F7·11~15·17~27 및 X1/X2/main scope. |
| EP-02′ | 9 / 9 | 기존8 주의 표시 자리 + 승격 통지1, B1~3·B6 및 3종 Map/SSR. |
| EP-13″ | 7 / 7 | 기존6 실제 SDK mode 운반 + renderer child mode분기1, F8~10·16 및 controller/renderer/다음 send. |
| EP-14 | 4 / 4 | 설치 SDK Enter/Exit 계약·plan READY/ΔV3.4·INDEX·trailer. |

불변식의 주어로 `permission.requested|permission.resolved|RESOLVE_PLAN|SET_PERMISSION_MODE|approvePlan|revisePlan|revisePlanWithComments|rejectPlan|requestApproval|retireChannel`을 검색하고 값의 생산/소비 경로를 대조했다. 네 계획 응답은 같은 ID검사를 거치며 상태 해소 뒤 출처를 다시 읽지 않는다. 지정54자리와 실제 자리 집합을 대조했다. 원 signal 생산3(initial/listen/flush)·adoption 호출2(runAttempt/runListen)와 타입 운반2를 별도 대조했다. retire signal과 original turn signal은 각각 channel/main 취소를 담당하고 child는 main getter를 읽지 않는다. 별도 owner cache·IPC·schema·의존성은 없다.

## [구현자 기입] 이번 라운드 수정의 잠금

최종 영향 회귀는 **181파일·1883 assertions pass, 0 fail/skip**이다(`app/.tmp-0249-r34-regression-final.json`, testResults.length와 파일별 assertion 길이 합을 대조). 새 main-scope19·실제 query factory1·기존 X2 기대값10+정상피드백3과 renderer 회귀를 포함한다. scripts는 제한 환경의 EPERM8을 분리하고 같은132개를 권한 제한 없이 재실행해 failure/error0을 확인했다. 실제 의존성 설치·ABI 재빌드는 수행하지 않았다.

| 등록 변이 | 강제 자리 | assertion red 실패/실행 | 동일 필터 원복 대조 |
|---|---|---:|---|
| F6 | EP-11 | 2/4 (0 skip) | 4 green / bytes동일 |
| F9 | EP-13″ | 2/2 (79 skip) | 2 green / bytes동일 |
| F10 | EP-13″ | 2/2 (79 skip) | 2 green / bytes동일 |
| F1 | EP-11 | 1/92 (0 skip) | 92 green / bytes동일 |
| F2 | EP-11 | 4/92 (0 skip) | 92 green / bytes동일 |
| F3 | EP-11 | 4/5 (0 skip) | 5 green / bytes동일 |
| F4 | EP-11 | 2/15 (0 skip) | 15 green / bytes동일 |
| F5 | EP-11 | 5/15 (0 skip) | 15 green / bytes동일 |
| F7 | EP-12⁗ | 1/15 (0 skip) | 15 green / bytes동일 |
| F8 | EP-13″ | 1/92 (0 skip) | 92 green / bytes동일 |
| D1 | EP-04″ | 9/92 (0 skip) | 92 green / bytes동일 |
| D2 | EP-04″ | 12/92 (0 skip) | 92 green / bytes동일 |
| D3 | EP-04″ | 10/92 (0 skip) | 92 green / bytes동일 |
| D4 | EP-04″ | 20/92 (0 skip) | 92 green / bytes동일 |
| D5 | EP-04″ | 3/92 (0 skip) | 92 green / bytes동일 |
| D6 | EP-04″ | 2/92 (0 skip) | 92 green / bytes동일 |
| D7 | EP-04″ | 5/92 (0 skip) | 92 green / bytes동일 |
| D8 | EP-04″ | 5/92 (0 skip) | 92 green / bytes동일 |
| D9 | EP-04″ | 9/92 (0 skip) | 92 green / bytes동일 |
| D10 | EP-04″ | 11/92 (0 skip) | 92 green / bytes동일 |
| F11 | EP-12⁗ | 10/10 (0 skip) | 10 green / bytes동일 |
| F12 | EP-12⁗ | 2/10 (0 skip) | 10 green / bytes동일 |
| B1 | EP-02′ | 1/19 (0 skip) | 19 green / bytes동일 |
| B2 | EP-02′ | 4/19 (0 skip) | 19 green / bytes동일 |
| B3 | EP-02′ | 3/19 (0 skip) | 19 green / bytes동일 |
| B6 | EP-02′ | 4/19 (0 skip) | 19 green / bytes동일 |
| F13 | EP-12⁗ | 3/5 (13 skip) | 5 green / bytes동일 |
| F14 | EP-12⁗ | 2/2 (16 skip) | 2 green / bytes동일 |
| F15 | EP-12⁗ | 8/8 (10 skip) | 8 green / bytes동일 |
| F16 | EP-13″ | 1/2 (11 skip) | 2 green / bytes동일 |
| F17 | EP-12⁗ | 4/4 (9 skip) | 4 green / bytes동일 |
| F18 | EP-12⁗ | 1/1 (12 skip) | 1 green / bytes동일 |
| F19 | EP-12⁗ | 1/1 (12 skip) | 1 green / bytes동일 |
| F20 | EP-12⁗ | 1/1 (12 skip) | 1 green / bytes동일 |
| F21 | EP-12⁗ | 1/1 (12 skip) | 1 green / bytes동일 |
| F22 | EP-12⁗ | 2/2 (17 skip) | 2 green / bytes동일 |
| F23 | EP-12⁗ | 2/2 (17 skip) | 2 green / bytes동일 |
| F24 | EP-12⁗ | 2/2 (17 skip) | 2 green / bytes동일 |
| F25 | EP-12⁗ | 1/1 (7 skip) | 1 green / bytes동일 |
| F26 | EP-12⁗ | 1/1 (18 skip) | 1 green / bytes동일 |
| F27 | EP-12⁗ | 2/2 (17 skip) | 2 green / bytes동일 |



D2·D3·D4는 등록 D2′·D3′·D4′의 러너 별칭이다. 등록41 집합과 최종 결과의 ID 집합을 양방향 차집합으로 비교해 각각0, unique41을 확인했다. 모든 행의 red exit1·실패>0·원본 Buffer equality·동일 필터 green exit0을 검사했다. 증거는 `.tmp-0249-r34-mutation-results-final.json`이며 F25 초기 생존은 최초 결과에 보존했다.

선택 증거41·별도 추가 인용 변이0·새 proxy/oracle에 따로 등록되지 않은 변이0 = 잠금 표41자리다. 기존 X1·X2의 직접 기대값을 유지하며 등록 자리마다 제거 red→원본 byte 복원→동일 필터 green을 실행했다. skip은 실행 분모에 넣지 않는다. F25의 첫 측정은 query 내부 assertion이 adapter의 오류 이벤트로 변환돼 살아남았다. 실제 소비가 끝난 테스트 경계에서 오류 이벤트0·getter3회·승인3회를 직접 검사하도록 oracle을 보강했고 같은 F25를 재측정했다. 이 보강 전 생존을 성공으로 세지 않는다. 독립 검증 PASS를 선점하지 않는다.

## [구현자 기입] Product/UX 파생 검토

| 상태 | 직접 관측 |
|---|---|
| main Work/Code 승인 | 기존 allow·목표 mode·다음 send 유지, 추가 setMode IPC 없음. |
| child 승인 | SDK allow·child updatedPermissions 부재, renderer/controller/다음 send 메인 mode 보존. |
| 다른 ID·실제 해결된 ID·중복 응답 | 네 핸들러의 현재 pending 요청·session reference·이웃 reference·mode 유지, 불필요 response0. |
| 유효 수정/코멘트/거부 | 실제 adapter/requester/broker까지 기존 deny 메시지·구조화 피드백·요청 해소·plan mode 유지. |
| 빈 수정/빈 코멘트 | 기존 미해결 요청 유지·응답0. |
| 새 draft 승격·승인 해소·channel 폐기 | 기존 X1·owner/attention·lifetime 회귀로 같은 소유자·표시·수명 보존. |
| main interrupt 중 Exit 파일 await·SDK signal live | 같은/다른 새 owner의 delegate·persist·register·requested0, 기존 원 턴 취소를 유지. |
| 정상 초기/pre-init/후속/listen/flush/내부 respawn | 현재 원 signal의 승인→취소 연결 및 child SDK 독립 수명 유지. |

## [구현자 기입] 놓친 잠재 문제 + 대응

r2의 SDK/main child guard만으로 화면 소비자의 mode 갱신을 막지 못했다. 계획 응답의 요청 ID와 출처는 RESOLVE_PLAN 전에 캡처해야 한다. 동일 불변식이 필요한 수정·코멘트·거부 형제도 함께 닫았고 각 호출의 ID 조회를 잘못 빌리는 변이로 직접 잠갔다. D6는 독립 재검증자의 closed 판정 전 open이다.

독립 phase-0의 실제 persistent main interrupt probe는 SDK cancel이 아직 없을 때 늦은 Exit 파일 await의 side effect를 관측했다. ΔV3.4로 원래 req.signal의 현재 scalar를 공표하고 main callback 첫 await 전에 한 번 캡처·합성해 Exit requestApproval까지 운반했다. 이미 취소된 승인만 파일 읽기 전에 deny하며 child와 안전 도구 자동 통과 정책은 유지한다. SDK interrupt가 로컬 controller abort를 보장하지 않는 설치 소스는 확인했으나 실제 CLI의 cancel/terminal 순서는 확인하지 못했다.

기존 D1·D2·D4 잔여는 유지하며 정책 변경으로 숨기지 않았다. 원격 게시·CI·외부 모델·Windows 시각 실기는 미실행이다. 자동 승인 검토의 push 거부는 로컬 gate와 구별한다.

## [구현자 기입] 구현 보고

선택17(REQUIRED7·REGRESSION10)은 아래 증거에 따른 SELF_PASS 자기판정이며 비영향20은 기존 기준선으로 NOT_REQUIRED다.

| pair | requiredness | 자기판정 | 실제 관측 / 잠금 |
|---|---|---|---|
| VP-02 | REGRESSION | SELF_PASS | 요청·승격→app 구독→Map·SessionRow; B1·2·3·6 |
| VP-03 | REGRESSION | SELF_PASS | 해결/열람/삭제/재방출 수명; 직접 oracle |
| VP-04 | REGRESSION | SELF_PASS | app→chat→sessions 의존 방향·실제 통합; boundaries lint·직접 oracle |
| VP-05 | REGRESSION | SELF_PASS | store 값·reference identity; 직접 oracle |
| VP-19 | REGRESSION | SELF_PASS | 완료 표시·요청과 마지막 사유·SSR; 직접 oracle |
| VP-09′ | REQUIRED | SELF_PASS | 승인 시점 파일→request/action/CLI 입력; D1·2′·3′·4′·10 |
| VP-10 | REGRESSION | SELF_PASS | main Write/Edit·Stop·child 파일 음성; D5·6 |
| VP-11′ | REGRESSION | SELF_PASS | query hook/getter 동일 셀·환경; D7·8·9 |
| VP-12 | REGRESSION | SELF_PASS | 파일 reader 일반/8.3·상한·링크·오류·close; 직접 oracle |
| VP-13′ | REGRESSION | SELF_PASS | 출처/본문/경로 정규화·정상 입력 참조; 직접 oracle |
| VP-20 | REGRESSION | SELF_PASS | 파일 없는 input→서술→empty·plan SSR; D10 |
| VP-33 | REQUIRED | SELF_PASS | 보정 입력 main/call 식별·같은 reference; F1·2·4·6 |
| VP-34 | REQUIRED | SELF_PASS | persist 선행·SQL args/owner·decoder; F3·4·5·7·13·14·22~27 |
| VP-35 | REQUIRED | SELF_PASS | 실제 live/reload Work/Code 본문·경로·이웃; F1·2·6·11·12 |
| VP-36 | REQUIRED | SELF_PASS | 순서·Stop·턴·owner·폐기/화면4응답·child; F4·11~27·D5·6 |
| VP-37 | REQUIRED | SELF_PASS | SDK mode→controller/renderer·latest/retired delegates; F8·9·10·15·16 |
| VP-38 | REQUIRED | SELF_PASS | mode6종·unknown/child/replay·Enter/Exit 키; 직접 oracle |

검산: REQUIRED7·REGRESSION10=17. 유효37−선택17=비영향20; 비영향 pair를 새 PASS로 만들지 않는다.

| AC | 기계 fixture 자기판정 / 직접 관측 |
|---|---|
| AC1 | ✅ skills 목록/상세 연결됨·Connected·기본 제공·인증 액션 부재 |
| AC2 | ✅ 3종 요청·승격→주의 Map·행 SSR |
| AC3 | ✅ 실제 viewed guard·열람 해제·재방출 음성 |
| AC4 | ✅ 완료/대기 last wins·삭제·같은 사유 identity |
| AC5 | ✅ unknown/noid 순간·불일치·해결 후 승격·unsubscribe 음성 |
| AC6′ | ✅ canonical background 종류별 카드·완료 보존 |
| AC7′ | ✅ 양성과 같은 state의 foreground·ambient·실패 목록/count/clear 음성 |
| AC8′ | ✅ background-open·panel의 상세·중단·완료 지우기 |
| AC9′ | ✅ 빈 입력의 파일 plan/path 보정·실제 query |
| AC10′ | ✅ 출처×입력×서술 조합·잘못된 입력 보정·파일 없는 입력 불변 |
| AC11 | ✅ main Write/Edit·child·Stop·크기·경로·링크·8.3·오류·close |
| AC14′ | ✅ actual query 포획 hook/getter·Write→Exit→Stop·환경 |
| AC15 | ✅ 최신 publishedAt·동시각 최신 입력·첫 카드 위치 |
| AC16 | ✅ 다른 category/filename/턴 보존·store 저장 refs |
| AC17 | ✅ Work/Code 진행/완료 본문→카드→완료 메타·spark1 |
| AC18 | ✅ 아래 lint/typecheck/영향 테스트/scripts/guards/diff·trailer 산출 |
| AC19′ | ✅ actual Mapper 정상/반례의 Spark 집합/count 등식 |
| AC20 | ✅ 실제 openSubagentTask·Agent/Task 상세 선택·목록 복귀 부재 |
| AC21 | ✅ BOM/CRLF/끝 공백·win32 경로·정상 입력 reference |
| AC22 | ✅ Engine settings/runtime 병합·증감·빈0개 카드 수 |
| AC23 | ✅ unconfirmed 완료·고정 시간·중단 부재·clear·기록 불변·늦은 통지 |
| AC24 | ✅ actual adapter/requester/SQLite/decoder·live/reload Work/Code 입력 |
| AC25 | ✅ 두 순서·Stop·같은/다른 call/turn/session·FIFO·late retired·4응답 ID·await 전 original main scope |
| AC26 | ✅ child 파일/서술·SDK권한·renderer/controller/다음 send 격리·Enter/Exit |
| AC27 | ✅ actual SDK init/status6종→controller/renderer·latest·old/child/replay 음성 |

검산: ✅25·⚠️0·❌0=유효25(자기검증 기계 범위). 외부 모델·시각 실기의 성공을 이 수로 주장하지 않는다.

| 적용 gate | 최종 실행 결과 |
|---|---|
| lint | 전체 src/scripts no-fix:0 error, 기존 useTranscriptVirtualizer.ts22 warning1. 신규 main-scope/배선 파일 별도 no-fix lint0. |
| typecheck | node·web·test 모두 exit0. 신규 fixture의 helper 반환형·spy 타입·flush createdAt을 정정 후 test tsc와 해당 lint를 다시 통과했다. production 동작/기대값 변경 없음. |
| 영향 테스트 | 181파일1883 assertions pass·fail/skip0. 새 main-scope19와 실제 query1 포함 최종8파일188 pass; 중복 실행을 합산하지 않는다. |
| scripts | 제한 환경 EPERM8 분리, 동일 JUnit testcase132 권한 제한 없이 재실행 failure/error0. |
| 문서·예산·마이그레이션·diff | doc-inventory·test-budget16 real-git·migration guard(1393 source)·diff-check exit0. |
| 기준선·설계·handoff | 요청 당시 main/origin main ceda5c5a 동기화0/0. ΔV3.3 d6b9ace8, ΔV3.4 3378c153·requestId 오표기정정 d5bb58c6 별도 설계. INDEX impl/IMPL_DONE r3·다음 독립 검증자. D6는 독립 판정 전 open. |
| 환경·외부 | plain Node SQLite ABI127의 실제 DB 포함. 의존성 설치·Electron ABI140 재빌드 없음. 실 모델·Windows 시각 실기·원격 게시/CI 미실행. SDK cancel/terminal 실제 CLI 순서 미확인. |

로컬 구현 커밋은 연속된 Agent:codex·Status:implemented·Criteria-Met:25/25·Verified-By:pending trailer를 기록하고 git log로 파싱한다.

## [구현자 기입] Review Signals — 사실만

r3 첫 구현 턴이다. r2 D6는 기존 Product/UX child 경계와 D-033/AC25 소유권이 UI 응답 소비자에 빠져 생겼다. 이번에는 네 응답 핸들러와 main/child mode 소비자를 함께 대조했다. 같은 r3 phase-0에서 발견한 persistent main interrupt 뒤 await 운반 누락은 ΔV3.4 별도 설계 후 원 signal 생산/캡처/소비 전수로 닫았다. r2에서 지적된 AC 설명 오매핑을 반복하지 않도록 유효 ID와 실제 fixture의 의미를 대응했다. 제품 결정 drift·handoff 지침 변경은 없으며 원격/시각 경계와 sandbox/ABI 실행 환경을 기계 fixture 성공과 분리했다.
