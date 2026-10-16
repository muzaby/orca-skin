# Plan — 하네스 native 저장 경로와 Orca 보관 정책

## 메타

| 항목 | 값 |
|---|---|
| slug | `0265-harness-native-storage` |
| 작성자 / 일자 | Codex / 2026-10-16 |
| 상태 | plan/READY — native snapshot·sidecar·목록 제외·현재 실행 보호 계약 확정 |
| V mode / revision | Baseline V / V1 |
| 기준 V | 없음. 0262 ΔV15는 OpenCode 구체 구현, 0264는 의존 경계 회귀 기준 |
| 관련 | PR #502 · ADR-009 · 0262 · 0230 |

# Part I — Product & UX Contract

## 1. 목표와 요구 출처

Orca에서 만든 대화를 하네스 터미널에서 같은 native 세션으로 이어갈 수 있게 한다. 세션·하네스 소유 리소스는 native 저장소가 원본이고 Orca DB는 대화 저장·표시·검색용 보관 계층으로 유지한다.

| 출처 | 사용자 요구 |
|---|---|
| 최초 추가 요구 | “대화내용 저장은 우리 db에 하고 있지만, opencode를 포함하여 claude, 후에 추가될 하네스에 대해서도 ssot는 그들의 작업경로이다. 다른 리소스도 똑같다.” |
| 범위 명확화 | “Orca가 모델설정같은 것들은 끼워넣기(오버라이딩)하는게 맞고(엔진&모델 페이지 은영), 기본적인 저장경로는 그들의 경로이다.” |
| 삭제 동작 답변 | “Orca 목록에서만 제거하고 하네스 원본 보존” |
| 왕복 이어보기 답변 | “터미널에서 추가한 대화도 Orca에 반영 (권장)” 선택 |

작업 디렉터리(cwd)와 native 전역 저장 루트는 구별한다. OpenCode가 실제로 전역 DB를 쓰거나 Claude가 프로젝트별 JSONL을 쓰는 방식을 프로젝트 폴더 안의 임의 Orca DB로 바꾸는 요구가 아니다.

## 2. Decision Ledger

| ID | 결정 / 조건 | 상태 / 근거 |
|---|---|---|
| D01 | native 세션·하네스 리소스의 원본은 하네스 기본 경로. 사용자가 지정한 native 환경도 존중 | ACTIVE / 사용자 |
| D02 | Orca 대화 DB와 검색·앱 메타데이터 보관은 유지. 원본 실행 컨텍스트를 DB 전문 재전송으로 대체하지 않음 | ACTIVE / 사용자 SSOT 결정 |
| D03 | 엔진&모델과 Orca 제공 설정은 실행 오버라이드로 유지. native 설정 파일 자동 덮어쓰기·Orca sources/dist 일괄 이관 없음 | ACTIVE / 사용자 명확화 |
| D04 | 대화 제거는 Orca 목록에서만 제거. native 세션·관련 파일·작업 폴더 보존 | ACTIVE / 사용자 답변 |
| D05 | 공통 코드는 중립 계약을 받고 native 해석은 하네스 구현에서 수행. 미래 Codex 구현 자체를 이번에 추가하지 않음 | ACTIVE / 누적 구조 분리 요구·0264 |
| D06 | 터미널에서 추가한 대화를 같은 Orca 세션 재열기의 transcript에 반영. 본문 비교 대신 native ID로 중복 방지 | ACTIVE / 사용자 왕복 이어보기 답변 |
| D07 | 기존 격리 OpenCode 세션을 새 원본 경로로 연결할 때 원본을 삭제하지 않고 ID·cwd·리소스를 검증. 충돌한 native 데이터를 덮어쓰지 않음 | ACTIVE / 기존 세션 이어가기 요구의 데이터 보존 조건 |

ADR-001의 DB 단독 원본 정책은 ADR-009로 대체한다. 0264의 소유권·의존 규칙은 유지하되, 당시 리팩토링의 “저장 동작 불변”을 이번 새 기능을 금지하는 규칙으로 승계하지 않는다.

## 3. 사용자 흐름과 상태

| 시작 / 상태 | 결과 |
|---|---|
| Orca에서 새 대화 | native 규칙의 저장소에 native 세션 생성, Orca DB에도 기록 |
| 같은 실제 cwd에서 CLI로 native ID 재개 | 같은 세션 컨텍스트 사용. Orca 전용 서버 주소나 XDG 설정이 필수 조건이 되지 않음 |
| 모델·엔진 변경 | Orca 실행 오버라이드 반영. 세션 원본 경로·ID·하네스는 유지 |
| 터미널에서 이어간 뒤 Orca 재열기 | native 원본의 추가 대화를 가져오고 같은 메시지를 중복 표시하지 않음. 후속 입력도 같은 native 세션에 전달 |
| Orca 목록에서 대화 제거 | 목록/최근 세션에서 제외하고 native 세션과 실제 cwd 보존 |
| native 저장소 없음 / 접근 실패 | 보관 기록을 유지하고 원본 접근 문제를 구분. 새 native 세션 생성이나 DB 전문 재전송으로 성공을 가장하지 않음 |
| 구격리 원본과 native ID 충돌 | 기존 native 원본 무변경, 이관 미완료 표시·재시도 가능 |
| native와 Orca에서 동시에 실행 중 | 자동 이력 교체/이관 금지. 기존 admission·실행 소유권과 외부 실행 충돌 조건을 설계에서 명시 |

“제거”는 native delete API 호출을 뜻하지 않는다. 현재 `sessionDelete`가 관리 worktree를 지우는 경로도 분리해야 한다. 별도 명시 worktree 삭제 기능은 이번 목록 제거와 구별한다.

## 4. 범위와 배분

| 소유 handoff | 이번 책임 |
|---|---|
| 0262 ΔV15 | OpenCode 1.x native data/config/state/cache·DB 경로, 설정 오버라이드 유지, 동일 cwd/ID 재개, 구격리 세션·리소스 전환 |
| 0265 V1 | 공통 원본/보관 계약, Claude native root 정합, 목록 제거·작업 폴더 보존, 터미널 추가 이력의 재열기 반영 |
| 0264 | 기존 typed registry·하네스 분리·common 역방향 금지 회귀. 새 제품 동작을 리팩토링 보고에 섞지 않음 |
| 0230 / 0231 | 앱 임시 파일·background 출력 권한과의 접점 조사. 기존 승인된 임시 스코프를 자동 폐기하지 않음 |

이번 요구로 전역 native 세션을 모두 Orca 목록에 자동 발견하는 UI를 추가하지 않는다. 알려진 세션의 CLI 재개와 재반영을 다루며, 저장소 원본과 Orca만의 설정·UI·통계·게시 사본을 구별한다. 기존 Claude의 `settingSources` 상속 범위는 저장 경로와 다른 정책이므로 이번 요구만으로 바꾸지 않는다.

## 5. Acceptance — R ↔ AT

| R / AT / AC | 관측 가능한 기준 | 직접 검증 / 도달 경로 |
|---|---|---|
| R01 / AT01 / AC1 | Claude·OpenCode 세션은 native 경로에서 같은 ID/cwd로 CLI 재개 가능 | 실제 SDK/CLI 격리 fixture → native 세션 조회/재개. 단순 env 문자열 검사는 보조 |
| R02 / AT02 / AC2 | Orca 모델 오버라이드는 적용되고 native 설정 파일·기본 저장 루트는 유지 | engine/runtime → 실제 adapter spawn/query → 적용 모델과 파일 전후 비교 |
| R03 / AT03 / AC3 | 명시한 native 사용자 root에 settings import·skill/plan 경로·실행이 일치 | Claude 경로 resolver와 실제 소비처 fixture, OpenCode ΔV15 연계 |
| R04 / AT04 / AC4 | 목록 제거 후 native 세션·작업 폴더는 존재하고 재개 가능 | 실제 sessionDelete handler → DB 목록·lastSessionId·CLI 조회·worktree 존재 |
| R05 / AT05 / AC5 | 새 실행 없이 native 접근 실패를 표시하고 Orca 보관 기록은 유지 | native missing/error fixture → session load/send. send/prompt 호출0 |
| R06 / AT06 / AC6 | native 구현은 각 하네스 모듈에 있고 공통 orchestration은 중립 포트 사용 | 실제 registry 조립·두 구현 결과, 기존 경계 lint |
| R07 / AT07 / AC7 | 구격리 세션 전환이 ID/cwd 및 관련 리소스를 보존하거나 명시적 미완료로 남음 | 0262 이관 integration; 충돌·중간 실패·재실행 fixture |
| R08 / AT08 / AC8 | 터미널에서 추가한 사용자·assistant·도구 이력이 재열기에 반영되고 반복 조회 시 중복 없음 | native fixture 변경 → 실제 sessionLoad → DB 보관·LoadedSession. 이어 보내기도 같은 native ID 사용 |

# Part II — Technical Design

## 6. 현재 코드와 차이

| 조사 대상 | 현재 구현 / 변경 필요 |
|---|---|
| OpenCode server | `adapters/opencode/v1/server.ts:134–150`이 userData 하위로 cwd/XDG 네 루트를 지정. native 환경 상속으로 변경 필요 |
| native ID | `opencode/v1/channel.ts`의 create 결과를 `history/writer.ts`가 세션 ID로 기록. ID 변환이 단절 원인은 아님 |
| Claude query | `adapters/claude/adapter.ts` 실제 대화는 native persistence + resume/cwd. `persistSession:false`는 보조 complete에 한정 |
| Claude 경로 | `plan-file.ts:25`는 CLAUDE_CONFIG_DIR를 반영하지만 `settings.ts:64`, `app/harnesses/claude/extensions.ts:22`, `workspace-guard.ts:30`은 ~/.claude 고정 |
| 목록·본문 | `app/handlers/session.ts:57–66` → `features/history/reader.ts` → Orca DB. native 이력 재조회 없음 |
| 제거 | `session.ts:86–90` 관리 worktree 제거 후 Orca DB hard delete. 목록 제거와 작업 폴더 삭제 분리 필요 |
| Claude SDK 조회 | 설치 `sdk.d.ts`의 getSessionInfo/getSessionMessages/listSessions 사용 가능. programmatic session의 터미널 picker 노출은 직접 ID resume와 별도 검증 |
| 임시 리소스 | Claude `adapt.ts`는 CLAUDE_CODE_TMPDIR를 앱 tmp로 고정. 0230 D06·0231 출력 read scope와 연결되므로 영속 저장 root 수정에 섞어 삭제 금지 |

검색: `rg 'XDG_|OPENCODE_DB|CLAUDE_CONFIG_DIR|CLAUDE_CODE_TMPDIR' app/src/main`, `rg 'loadSession|deleteSession|removeManagedWorktree' app/src/main/app/handlers/session.ts`, 설치 SDK session 조회 타입. OpenCode 강제 XDG 주입은 한 spawn의 네 키, Claude custom root 불일치는 위 세 소비처에서 확인했다. READY 전 실제 env 조립·보조 호출·재시작·권한 소비 edge까지 전수표를 완성한다.

## 7. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 실행 원본 | OpenCode 전용 XDG; Claude native 저장 | 두 하네스 모두 native 원본 경로, Orca 실행 오버라이드 유지 |
| GUI 기록 | DB 단독 원본 | native 재조회 후 Orca DB 보관 갱신·transcript 반영. 과거 보관 데이터의 삭제와 native 현재 체인 선택을 구별 |
| 경로 지식 | 하네스 구현과 일부 소비처 하드코딩 | 하네스별 resolver/저장소 포트, app 조립부 주입 |
| 제거 | DB 삭제와 관리 worktree 제거 결합 | Orca 목록 제외와 실행 정리만. native 세션/실제 cwd 유지 |
| 이관 | 없음 | 버전별 이관이 원본·ID·cwd·리소스를 검증하고 마지막에 연결 전환 |

Orca DB 구조 변경은 append-only migration으로 한다. native ID를 다른 ID로 조용히 바꾸거나 native DB를 일반 공통 SQL 코드로 조작하지 않는다. native 조회가 필요한 경우 CLI/SDK 계약은 하네스 모듈 안에서만 사용한다.

## 8. 계약·저장·수명

### 공통 포트와 조립

`adapters/common/native-history.ts`는 `NativeHistoryRequest { sessionId, cwd, env?, providerSettings? }`, `NativeHistoryMessage extends LoadedMessage { id, sourceIds? }`, `NativeHistorySnapshot { sessionId, cwd, sourceKey, revision, messages, raw? }`를 정의한다. `SessionAdapter.readHistory?()`는 `{ status:'ready', snapshot }` 또는 `{ status:'missing'|'unavailable'|'busy'|'migration-required', message }`를 반환한다. `sourceKey`와 raw는 main/DB 전용이며 자격증명·전체 native 설정을 포함하지 않는다.

`app/native-history.ts`가 저장된 backend의 adapter와 기존 `resolveTurnProvider`가 만든 실행 env/settings를 연결한다. `features/history/native-sync.ts`는 구체 SDK 없이 읽기 포트·DB·활동 guard를 받는다. native 읽기에 prompt·사용량 집계·background 이벤트 재발행·원본 delete를 사용하지 않는다.

### 원본 snapshot과 Orca 사본

append-only migration으로 `sessions.hidden_at`, native snapshot/검색용 메시지와 사용자 메시지 ID 매핑을 추가한다. 기존 messages/parts·usage·artifacts·background journal은 삭제하거나 native 행으로 교체하지 않는다. 한 Orca assistant 행에 여러 native assistant가 들어가므로 DB 행 번호를 native UUID로 간주하지 않는다.

snapshot은 native 메시지 ID·순서·정규화 parts·raw·revision과 동기화 시점의 로컬 message frontier를 보관한다. 조회 전후 로컬 DB 변경 토큰과 실행 상태를 비교하고, 변하지 않은 경우에만 snapshot/검색 인덱스/frontier를 한 DB transaction으로 교체한다. transaction 실패 또는 지각 결과는 이전 snapshot을 유지한다.

표시는 `native snapshot + 정확히 연결된 Orca 부가 기록 + frontier 이후 로컬 live 행`이다. 정상 재조회가 live tail을 포함한 native 이력을 받으면 frontier를 전진시켜 같은 응답을 두 번 표시하지 않는다. 최초 재조회 전에는 기존 Orca 이력이며, native 오류에서는 마지막 정상 snapshot과 새 live 행을 계속 보여준다.

| 부가 기록 | 연결·보존 규칙 |
|---|---|
| tool 결과의 structuredOutput/nonExecution/subagentMeta, 질문 답변·계획 입력 교정 | 같은 toolRunId/parentToolRunId에 보충. native의 최신 일반 본문/result를 과거 Orca 결과로 덮지 않음 |
| child 본문·subagent_notice·도구 artifact | 실제 부모 toolRunId와 연결. background journal은 별도 보관하고 다시 이벤트로 발행하지 않음 |
| 신규 사용자 attachment/diff_requirements | input.echo/input.received의 별도 nativeMessageId→coordinator→writer 매핑. 기존 uuid는 큐/part 식별 역할을 유지 |
| assistant response_boundary/artifact | 정규화 이벤트의 nativeMessageId를 local 응답 행의 다대다 매핑에 기록. native 그룹의 sourceIds와 조인하여 응답 경계를 유지 |
| 매핑 없는 과거 attachment/diff_requirements/response_boundary/artifact | 본문·시각으로 소속을 추정하지 않음. 원래 DB 행을 보관하고 native에 연결할 수 없는 부가 part만 원래 순서로 대화 말미에 보존 |

과거 부가 part의 소속을 복원할 수 없으면 `nativeSync.message`로 이 상태를 알린다. 원래 user/assistant 본문·일반 도구 호출을 이 말미에 복제하지 않는다. 신규 사용자 매핑은 여러 Orca 입력이 하나의 native 메시지에 합쳐지는 경우도 허용하며, toolRunId는 부모 범위까지 대조한다.

native 검색 인덱스에는 native ID별 최신 본문을 저장하고 숨겨진 세션은 제외한다. 기존 검색은 snapshot이 없는 세션 및 frontier 이후 live 행에 사용하여 동일 본문을 두 저장 계층에서 중복 노출하지 않는다. 보관 이력의 사용량 원장은 그대로 두고 재조회 비용을 새 과금으로 합산하지 않는다.

### 재열기·실행·오류

`sessionLoad`는 비동기 refresh 뒤 기존 DTO를 조립하며 `LoadedSession.nativeSync?`에 ready/busy/missing/unavailable/migration-required와 안전한 표시 문구를 싣는다. native 원본 부재와 접근 오류를 구별하고 보관 기록을 null로 바꾸지 않는다. 동기화중 세션 제거·DB 변경·실행 시작이 발생하면 결과를 폐기한다.

renderer `chatStore.loadSession`은 캐시 재열기에도 IPC를 호출한다. 기존 화면을 유지한 채 갱신하고, 최신 요청만 적용하며 응답 도착 전에 live 이벤트가 바꾼 엔트리를 덮지 않는다. 오류는 기존 `chat.session-load.failed` 경로로 알리되 캐시를 삭제하지 않는다.

main 활동 guard는 lease·실행/입력 대기·승인·background 작업을 포함한다. 바쁜 세션은 native 교체를 미루며, quiescent runtime은 재열기 refresh 전에 폐기하여 다음 입력이 native 원본으로 새 resume를 하게 한다. 활동 guard와 runtime 폐기 사이 await를 두지 않으며, 활성 background를 재조회 때문에 종료하지 않는다.

외부 CLI는 Orca의 lease를 공유하지 않는다. adapter는 native의 현재 응답이 닫힌 snapshot만 반환하며 최신 user 이후 완료 assistant가 없거나 tool-use가 아직 닫히지 않았거나 읽는 동안 원본 revision이 달라지면 busy다. Claude는 현재 chain의 stop_reason, OpenCode는 마지막 assistant의 finish/time.completed 및 사용자 연결을 확인한다. 이 검사는 관측된 미완료 응답을 막으며 OS 전역 실행 잠금을 제공한다고 주장하지 않는다.

`app`의 새 runtime 준비 hook은 기존 resolveTurnProvider 결과를 사용해 resume 전에 같은 native ID/cwd의 존재를 확인하고 missing/unavailable/이관 실패를 에러로 전달한다. busy는 존재가 확인된 미완료 snapshot이므로 조회 교체만 보류하고 명시 사용자 입력의 same-ID resume를 허용한다(중단·크래시 뒤 새 입력으로 복구). 살아 있는 같은 runtime의 후속 입력과 명시 새 대화는 중복 조회하지 않으며, Orca 저장 본문으로 새 세션을 만들거나 자동 prompt하지 않는다.

### 목록 제외와 리소스 경계

`sessionDelete`는 기존 실행/승인/pending 정리 후 `hidden_at`만 기록하고 lastSessionId를 해제한다. managed worktree 제거 hook을 연결하지 않는다. 전체/프로젝트 목록·검색·session load·send 원본 조회는 숨김을 반영하며 native 데이터, 보관 DB 행, worktree 연결은 보존한다. 늦은 insertSession의 ON CONFLICT가 숨김을 해제하지 않는다.

Claude의 native root resolver는 CLAUDE_CONFIG_DIR 또는 기본 ~/.claude를 사용하고 settings import·skills·plan·workspace guard에 공유한다. native reader는 해당 프로젝트 JSONL을 먼저 읽어 ENOENT와 접근 오류를 구별하고 SDK 조회의 오류 삼킴에 의존하지 않는다. SDK chain 선택을 사용할 때는 조회에만 in-memory sessionStore를 주입하고 실제 query의 저장 경로를 바꾸지 않는다.

Claude raw current-chain의 UUID를 기준으로 자동 피드/compact metadata를 보충한다. 읽기 전용 snapshot의 선택용 메모리 복제본에서만 meta 표시 필터를 해제하고 SDK의 체인 선택 결과에 raw 메타를 결합하며, 철회·분기된 형제 체인을 전체 시간순으로 합치지 않는다. 네이티브 임시 도구 출력 경로는 기존 0230/0231의 권한·수명 정책을 유지하며 영속 프로젝트 이력·plan·skills의 원본 루트와 구별한다.

## 9. V와 직접 oracle

R01~08과 AT01~08은 §5의 AC1~8이며 모두 NEW/REQUIRED다. 아래 SD/AR/MD도 NEW이며 같은 레벨 오른쪽 node와 REQUIRED pair를 갖는다. 파일은 구현 예정 좌표이고 각 테스트는 표에 적힌 실제 진입점을 실행한다.

| pair / node | AC / production path | 직접 oracle |
|---|---|---|
| VP01 R01↔AT01 | AC1 / adapter→native create/resume | Claude native-history integration과 0262 native CLI fixture: 같은 ID/cwd 조회·resume, 모델 전송과 구분 |
| VP02 R02↔AT02 | AC2 / runtime config→native reader/query | `app/native-history.test.ts`: 실제 조립에서 선택 backend/env/settings 전달; 하네스 fixture 설정 파일 전후 비교 |
| VP03 R03↔AT03 | AC3 / Claude root→settings/skills/plan/guard | `adapters/claude/native-paths.test.ts`: custom root의 실제 각 소비처 동작 |
| VP04 R04↔AT04 | AC4 / delete handler→hide→목록/검색/load | `app/handlers/session.delete.test.ts`, `infra/db/native-history.test.ts`: native/worktree remover0, 숨김·원본 행 보존 |
| VP05 R05↔AT05 | AC5 / missing/error→cache DTO→renderer | `features/history/native-sync.test.ts`, `chatStore.native-history.test.ts`: 기존 본문 유지·경고·재시도, model 호출0 |
| VP06 R06↔AT06 | AC6 / registry→중립 readHistory→native 구현 | `app/native-history.test.ts`: 등록 adapter 둘의 결과; 하네스 경계 ESLint |
| VP07 R07↔AT07 | AC7 / 구격리 source→native target | 0262 ΔV15 migration integration: 실제 임시 SQLite/CLI 재조회·충돌·중간 실패 |
| VP08 R08↔AT08 | AC8 / 외부 메시지 추가→sessionLoad→Orca DB/화면 | `app/handlers/session.native-history.test.ts`, `chatStore.native-history.test.ts`: 두 번 재열기·native ID 중복0·동일 resume ID |
| VP09 SD01↔ST01 | AC4/5/8 / idle→재열기→live→실패→재시도/제거 | 위 handler/store integration: deferred read 중 live 시작/제거·late 응답, last-good snapshot+tail |
| VP10 AR01↔IT01 | AC5/6/8 / native port→transaction→reader→DTO | `features/history/native-sync.test.ts` + 실제 DB `infra/db/native-history.test.ts`: 양 끝을 함께 mock하지 않고 commit/rollback·검색 관측 |
| VP11 MD01↔UT01 | AC8 / native IDs+로컬 parts→표시 | `features/history/native-projection.test.ts`: 동일본문 다른ID·sidecar exact join·orphan·tail·원본 불변 |
| VP12 MD02↔UT02 | AC3/5 / raw JSONL→현재 chain/정규화 | `adapters/claude/native-history.test.ts`: compact/meta/분기/도구결과·오류 분류·append0 |
| VP13 MD03↔UT03 | AC8 / echo native ID→writer mapping | `features/chat/turn-coordinator.test.ts`, `features/history/writer.received.test.ts`: nativeMessageId 운반·큐uuid와 구별 |

회귀는 0262 지속채널/승인/도구 정규화, 0232 자동 피드 DEV 표시, 0264 하네스 의존 경계, 기존 reader/usage/artifact FK, 0230/0231 경로 권한이다. 각 직접 행동 oracle은 실제 출력·DB 행·콜백 인자를 관측하며 새 구조적 proxy를 만들지 않는다. 등록 적대 증거는 not selected이며 기존 선택된 경계 변이는 해당 하네스 회귀 범위로 유지한다.

## 10. 강제 지점과 실패 의미

| EP / 자리 | 실패 의미 | 직접 oracle |
|---|---|---|
| EP01 / adapter 포트, app config 조립, 저장 backend 선택 (3) | 조회와 실행의 root/backend 불일치 | VP02/06 app/native-history 실제 factory |
| EP02 / native read 전 guard, read 후 guard, transaction 교체 (3) | 실행/삭제 뒤 지각 snapshot 반영 | VP09/10 deferred read + 실제 DB rollback |
| EP03 / snapshot+frontier 저장, FTS 갱신, reader projection (3) | 대화 중복·live tail 소실·외부 본문 검색 불가 | VP08/10 DB 원본/검색 및 두 번 load |
| EP04 / input.echo, input.received, assistant 정규화, coordinator sink, writer mapping (5) | native message ID와 큐/part uuid 혼동 | VP13 하네스 mapper·coordinator·writer 직접 payload |
| EP05 / tool sidecar, user sidecar, unmapped sidecar, live tail (4) | 부가 기록 유실·다른 메시지에 연결 | VP11 순수 projection 출력 비교 |
| EP06 / delete handler, hide SQL, 전체목록, 프로젝트목록, 검색, getSessionById (6) | 원본 삭제·숨김 세션 재등장/실행 | VP04 handler/DB 직접 상태 |
| EP07 / cache 재조회, 요청세대, live 경합, 오류 보관, 경고 소비 (5) | 오래된 응답 덮어쓰기·오류시 캐시 삭제 | VP05/08/09 실제 store deferred IPC |
| EP08 / Claude settings, skills, plan, guard, native reader, resume (6) | custom root 일부만 적용·missing 새세션 생성 | VP01/03/12 각 실제 소비처와 SDK stub query 호출0 |
| EP09 / quiescent 판정, runtime 폐기, 다음 resume, native 완료 snapshot 판정 (4) | background 중단·터미널 추가 문맥 미반영·외부 진행 이력 교체 | VP09 app 조립·활동 snapshot·resume 요청, native reader 미완료 fixture |
| EP10 / Claude input-receipts response, reconcile (2) | echo 이외 영수증 경로에서 native ID 유실 | VP13 `adapters/claude/input-receipts.test.ts`: SDK 반환 UUID 보존 |
| EP11 / turn catalog env, settings catalog env (2) | 모델 조회 서버와 실행 서버가 서로 다른 native root를 사용 | VP02 `resolve-turn.runtime-catalog.test.ts`, `misc.runtime-catalog.test.ts`: 실제 준비 env 전달 |
| EP12 / background dispose 출력 보존, bootstrap 삭제 callback (2) | 목록 제거로 보관한 출력 파일이 지워짐 | VP04 controller·handler/DB/파일 통합·`bootstrap.native-history.test.ts` 실제 callback |
| EP13 / refresh factory ctx, hasSession, discardRuntime, activity, session handler 연결 (5) | 단위 구현은 맞지만 부팅 배선에서 guard·재조회가 누락 | VP02/09 `bootstrap.native-history.test.ts`: 실제 register와 callback 인자·반환값 |

기존 설계 39자리와 호출부 전수 조사로 구체화한 EP10~13의 11자리를 합쳐 50자리다. 추가 행은 D01/02/04/06의 기존 계약을 실행 경계까지 명시하며 제품 동작을 새로 결정하지 않는다. OpenCode 내부 env/이관 자리는 0262 소유로 중복 합산하지 않는다. current-state 문서·INDEX·설계 trailer는 별도 운영 gate이며 제품 AC에 합산하지 않는다.

## 11. 운영 gate와 READY 대조

관련 비DB Vitest·readonly ESLint·node/web/test typecheck, 설치 ABI를 유지한 migration/DB 통합 검증, native CLI 임시 fixture, build, 문서 inventory/links·diff·trailer를 수행한다. Electron용 better-sqlite3는 Electron Node 실행으로 검증하고 npm install/rebuild로 ABI를 바꾸지 않는다. 사용자 DB나 실행 중 세션 대신 fixture로 조회·실패·이관을 검증한다.

ACTIVE D01→AC1/3, D02→AC5/8, D03→AC2, D04→AC4, D05→AC6, D06→AC8, D07→AC7을 대조했다. snapshot과 원래 DB 행 보존으로 기존 FK·usage를 유지하고, 오류와 동시성의 결과를 §8/VP09/EP02에 연결했다. 0262 이관 범위와 공통 재수입 범위를 구별했으며 신규 패키지·native 전역 자동발견·실모델 전송을 추가하지 않는다.
