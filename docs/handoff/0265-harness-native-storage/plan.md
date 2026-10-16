# Plan — 하네스 native 저장 경로와 Orca 보관 정책

## 메타

| 항목 | 값 |
|---|---|
| slug | `0265-harness-native-storage` |
| 작성자 / 일자 | Codex / 2026-10-16 |
| 상태 | impl/IMPL_DONE — r2.1 CI 재실패 보완·Windows 전체 게이트 통과, 독립 재검증 대기 |
| V mode / revision | Delta V / V1 + ΔV1~3 |
| 기준 V | V1@공유 브랜치 `8c94b449485771d5ea588e62e38c8cfbedc74e3b`. OpenCode 구체 커서는 0262 ΔV16, 의존 경계 회귀는 0264 |
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
| D02 | Orca 대화 DB와 검색·앱 메타데이터 보관은 유지. 원본 실행 컨텍스트를 DB 전문 재전송으로 대체하지 않음 | PARTIALLY SUPERSEDED / ΔV2 D14·D15와 ΔV3 D17: 명시 전송의 확인된 missing만 복구 예외. unavailable·인증·경로 충돌 및 화면 로딩에는 유지 |
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
| native 저장소 없음 / 접근 실패 | 보관 기록 유지. 화면 로딩은 자동 복구하지 않는다. 명시 전송의 missing은 ΔV2/3 복구, unavailable·인증·경로 충돌은 실행 차단 |
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
| R05 / AT05 / AC5 | 보관 기록 유지. 화면 로딩은 실행0, 명시 전송에서 unavailable·인증·경로 충돌은 실행0. missing 전송만 AC16~19로 대체 | native missing/error fixture → session load/send. ΔV2/3 예외 외 send/prompt 호출0 |
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

ΔV2 D13~16 및 ΔV3 D17~18이 아래 V1의 missing 전송 차단·DB 재전송 금지를 부분 대체한다. 단순 재열기와 unavailable·인증·경로 충돌에는 자동 재생성·재전송을 하지 않는다.

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

## [구현자 기입] 설계 리뷰

> r1 구현 보고. 정본 §10의 EP10~13 추가 후 분모는 50자리다. 구현자의 자기보고는 독립 검증을 대체하지 않는다. 최종 재검증 근거와 초기 실패의 분류는 아래 G11~G13에 기록했다.

- 동의 / 그대로 진행: D01~07을 유지했다. native 원본은 하네스별 구현이 읽고, Orca의 원래 보관 행과 부가 기록은 보존한다. 모델·엔진 등의 실행 오버라이드는 유지하며 목록 제거는 native·worktree 삭제와 분리했다.
- 이견 / 현실성 문제: §8의 외부 실행 판정은 닫힌 응답과 읽기 중 revision 안정성을 확인한다. OS 전역 잠금은 아니며, 중단된 세션은 명시 입력으로 같은 ID를 재개할 수 있다. §9의 예정 테스트 파일 일부는 기존 테스트 옆으로 배치했다(아래 명시적 차이).
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 영수증·catalog·background·bootstrap 전달 edge의 누락 후보 11자리는 설계자가 EP10~13으로 먼저 반영했다. 원본 식별자 없는 fork 부가 기록에 추정 매핑을 만들지 않는다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래 `M/`은 `app/src/main/`, `R/`은 `app/src/renderer/src/`다. 좌표의 콜론 뒤는 실제 테스트 이름이다. 실행 묶음 G01~G10은 구현 보고에 적었다.

| 좌표 | 직접 oracle |
|---|---|
| O01 | `M/app/native-history.test.ts:uses stored %s backend, actual cwd and the execution configuration` — Claude/OpenCode 각각 실제 registry·factory에서 조회 인자 관측 |
| O02 | `M/features/history/native-sync.test.ts:does not close or read a live session`, `discards a result after %s without replacing the archive` — read 전 및 change/hide/start 이후 guard |
| O03 | `M/features/history/native-history.db.test.ts:rolls back snapshot, frontier, native rows and FTS when a write fails after partial insertion`, `rejects a stale transaction version and a late read after a local write` |
| O04 | `M/features/history/native-history.db.test.ts:atomically stores the snapshot, local frontier and searchable native text without replacing local rows`, `replaces repeated native IDs and their old FTS content without accumulating duplicate messages`, `preserves live rows after the frontier and absorbs them once in the next complete native snapshot` |
| O05 | `M/adapters/claude/map.received.test.ts:carries native message IDs on assistant parts and compact markers independently of tool IDs`, `does not classify a human-authored reminder as a received input`, `tool results are preserved without producing a received message` |
| O06 | `M/adapters/opencode/v1/adapter.persistent.test.ts:subscribes once before initial and subsequent prompts`; `M/adapters/opencode/v1/native-input.test.ts:preserves native synthetic parts and rejects own text, ignored and foreign inputs`; `M/adapters/opencode/v1/native-history.test.ts:preserves native IDs, response grouping, normalized tools, question answers and immutable source data` |
| O07 | `M/features/chat/turn-coordinator.test.ts:carries native IDs separately from queue UUIDs for matched echoes and automatic input`; `M/features/history/writer.native-history.test.ts:binds native user and multiple assistant records to their local rows, excluding child IDs` |
| O08 | `M/features/history/native-projection.test.ts:matches sidecars by IDs, keeps every merged attachment, preserves orphan sidecars and live tail`, `enriches matching tool identities without replacing native output and retains child calls`, `restores question answers and plan corrections using exact tool IDs` |
| O09 | `M/app/handlers/session.delete.native-history.test.ts:keeps native, worktree and output files when runtime cleanup fails: %s`; `M/features/history/native-history.db.test.ts:hides every discovery path while retaining snapshot, source rows, usage, artifacts, journal and worktree` |
| O10 | `R/features/chat/store/chatStore.native-history.test.ts:keeps the cached screen during IPC and refreshes history without resetting model or panel state`, `accepts only the newest request for the same session`, `rejects a snapshot even before an already received delta reaches its animation frame` |
| O11 | `R/features/chat/store/chatStore.native-history.test.ts:retains the cached history and reports an IPC failure, then allows a later retry`, `shows the retained archive and reports native %s`, `does not toast for busy, but surfaces a ready snapshot with unassigned archive metadata` |
| O12 | `M/adapters/claude/native-paths.test.ts:imports settings and permits plan writes at the same custom native root`; `M/app/harnesses/claude/extensions.native-paths.test.ts:reads skill content from the configured native directory without copying or modifying it`; `M/adapters/claude/adapter.extra-dirs.test.ts:uses the execution environment native root for the actual workspace guard` |
| O13 | `M/adapters/claude/adapter.native-history.test.ts:reads the same native session through the production adapter without submitting a prompt`, `resumes the read native ID and cwd with runtime overrides and default native persistence` |
| O14 | `M/app/native-history.test.ts:does not close or replace an occupied session: %j`, `protects a lease even if the projected activity is idle`, `closes the real idle runtime and delivers the next input through a fresh same-ID resume`, `checks native %s before cold resume with the same prepared input` |
| O15 | `M/adapters/claude/native-history.test.ts:returns busy for stable unfinished inputs and a partially written last line`; `M/adapters/claude/native-history-map.test.ts:honors a persisted requires-action marker after a completed assistant`; `M/adapters/opencode/v1/native-history.test.ts:defers a stable but incomplete native response`, `defers a %s tool even when the message has a stop marker` |
| O16 | `M/adapters/claude/input-receipts.test.ts:uses merged and later changed response UUIDs to confirm each submitted input once`, `matches pending hook with an unattributed user wire instead of recording twice` |
| O17 | `M/app/chat-turn/resolve-turn.runtime-catalog.test.ts:passes the prepared native environment to catalog and execution unchanged`; `M/app/handlers/misc.runtime-catalog.test.ts:loads native OpenCode models and preserves other harness rows when its catalog fails` |
| O18 | `M/features/chat/background-controller.test.ts:disposes delivery while preserving archived output only when requested: %s`; `M/app/bootstrap.native-history.test.ts:preserves background snapshots while disposing the same session runtime and activity` |
| O19 | `M/app/bootstrap.native-history.test.ts:forwards context and all native refresh runtime callbacks from the actual bootstrap registration` — 실제 `Bootstrap.register`가 생성한 콜백을 실행하여 ctx·세션 ID·반환값·handler 연결 관측 |
| O20 | `M/app/handlers/session.load.test.ts:imports terminal user, assistant and tool messages and reopens twice without duplication`, `returns the last snapshot with a %s warning instead of an empty session`, `does not reopen or query a hidden session` |
| O21 | `M/adapters/claude/native-history-map.test.ts:restores automatic meta input and compact metadata while excluding abandoned branches`, `uses SDK %s compaction rewiring`, `retains an image-only user identity for attachment sidecars`, `preserves queued metadata with explicit origin=%s` |
| O22 | `M/adapters/claude/native-history.test.ts:distinguishes an absent original from permission failures`, `does not read a different cwd or substitute an invalid ID`, `does not replace a snapshot if its revision changes at read boundary %s` |
| O23 | `M/app/harnesses/opencode/native-storage.integration.test.ts:creates, migrates and reopens the same native ID with a terminal followup and unchanged native config` — 실제 1.x CLI·SDK·production migrator, 로컬 합성 모델 사용 |

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 남긴 곳 |
|---|---|---|---|---|---|
| VP02/06 | EP01 조회 실행 구성 | adapter 포트·app config·저장 backend (3) | 3/3 | G03의 O01: 하네스별 read 호출 인자·미선택 adapter 호출0; 경계 gate G10/G11 | — |
| VP09/10 | EP02 지각 snapshot 폐기 | read 전·read 후·transaction (3) | 3/3 | 전/후 O02(G04); transaction O03(G02) | — |
| VP08/10 | EP03 snapshot/FTS/표시 | snapshot+frontier·FTS·reader projection (3) | 3/3 | O04(G02): 원래 행 불변, 검색 교체·중복0, live tail 흡수 | — |
| VP13 | EP04 native ID 운반 | echo·received·assistant 정규화·sink·writer (5) | 5/5 | 하네스 입력·응답 O05/O06(G01/G08); sink/writer O07(G04) | — |
| VP11 | EP05 부가 기록 | tool·user·unmapped·live tail (4) | 4/4 | tool O08 두 번째/세 번째; user/unmapped/tail O08 첫 번째(G04), 실제 DB O04(G02) | — |
| VP04 | EP06 목록 제외 | handler·hide SQL·전체/프로젝트 목록·검색·getSessionById (6) | 6/6 | handler O09 첫 번째(G06), 나머지 O09 두 번째(G02): 실제 파일·보관 행 유지 및 숨김 | — |
| VP05/08/09 | EP07 재열기 UI | cache·요청세대·live 경합·오류 보관·경고 소비 (5) | 5/5 | 처음 세 자리 O10; 오류/경고 O11(G05), IPC O20(G02/G06) | — |
| VP01/03/12 | EP08 Claude native root | settings·skills·plan·guard·reader·resume (6) | 6/6 | settings/plan/guard O12(G01), 실제 skill 파일 O12(G03), reader/resume O13(G01) | — |
| VP09 | EP09 외부·내부 실행 수명 | quiescent·runtime 폐기·다음 resume·native 완료 snapshot (4) | 4/4 | 앞 세 자리 O14(G03), 양 하네스 완료 판정 O15(G01/G08) | OS 전역 잠금은 계약 밖 |
| VP13 | EP10 수신 영수증 | response·reconcile (2) | 2/2 | O16(G01): 실제 SDK UUID 유지, wire→received 변환의 native ID 유지 | — |
| VP02 | EP11 catalog env | turn·settings catalog (2) | 2/2 | O17(G03/G07): 준비 env와 native root를 두 호출에서 관측 | — |
| VP04 | EP12 출력 보존 | controller dispose·bootstrap callback (2) | 2/2 | O18(G06/G07) 및 실제 파일 O09(G06): preserve=true인 제거는 snapshot 삭제0 | — |
| VP02/09 | EP13 refresh 부팅 배선 | ctx·hasSession·discardRuntime·activity·handler 연결 (5) | 5/5 | O19(G07): 실제 register→각 callback 실행, 인자·반환값·연결 함수 동일성 | — |

자리 검산: 기존 `3+3+3+5+4+6+5+6+4=39`, 추가 `2+2+2+5=11`, 합계 `50/50`. OpenCode 내부 env/이관 자리는 0262에 남겨 중복 합산하지 않았다. 이 수치는 위 직접 oracle가 실행한 자리의 자기보고이며 전체 gate 완료 수가 아니다.

전수 조사 명령은 아래와 같다. 결과를 메서드별 호출부와 대조하여 EP10~13을 추가했으며, 검색 결과 총계만으로 미분류 0을 주장하지 않는다.

```powershell
rg -n 'nativeMessageId|user_message_uuid|input\.echo|input\.received' app/src/main/adapters app/src/main/features/chat app/src/main/features/history -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
rg -n 'catalog\(|preserveOutputSnapshots|onSessionDisposed|discardRuntime|refreshHistory|readHistory' app/src/main/app app/src/main/features -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
rg -n 'hidden_at|hideSession|listSessions|listProjectSessions|searchMessages|getSessionById' app/src/main/infra/db app/src/main/app/handlers/session.ts
rg -n 'CLAUDE_CONFIG_DIR|claudeNativePaths|claudePlansDirectory|resolveGuardRoots|harnessSkillRoots' app/src/main -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
```

- §10에 없는데 같은 불변식이 필요했던 지점: 영수증 2·catalog 2·출력 보존 2·부팅 refresh 5를 planner에게 보고했고 EP10~13으로 규범 정정했다. 제품 계약은 유지했다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP01 | REQUIRED | SELF_PASS | O13 + O23: 같은 ID/cwd 조회·resume, CLI followup 재수입 | not selected — 직접 SDK/CLI 결과 |
| VP02 | REQUIRED | SELF_PASS | O01/O13/O17/O19/O23: 설정 인자·준비 env 전달, native 설정 바이트 불변 | not selected — 실제 callback/파일 관측 |
| VP03 | REQUIRED | SELF_PASS | O12: custom root에서 실제 settings·skill 읽기와 plan·guard 판정 | not selected — 실제 소비처 결과 |
| VP04 | REQUIRED | SELF_PASS | O09/O18: 목록·검색·load 숨김, native/worktree/출력·보관 행 유지 | not selected — 실제 DB/파일/콜백 결과 |
| VP05 | REQUIRED | SELF_PASS | O02/O11/O20/O22 + O14 cold resume: 실패시 보관 화면·경고·재시도, prompt 재구성 없음 | not selected — 오류/deferred 호출 관측 |
| VP06 | REQUIRED | SELF_PASS | O01/O13 및 OpenCode `native-history.test.ts:wires the registered adapter to the installed SDK for read-only native requests with the selected environment`, 경계 lint·회귀 G08/G10/G11 | not selected — 실제 adapter 배선·경계 gate |
| VP07 | REQUIRED | SELF_PASS | O23 및 0262 migration integration: 실제 legacy source→native 이관·재개, 충돌/실패 원본 유지 | not selected — 실제 임시 SQLite/CLI 관측 |
| VP08 | REQUIRED | SELF_PASS | O04/O10/O20/O23: 외부 user/assistant/tool 반영, 두 번 load 중복0, 다음 입력 동일 ID | not selected — DB/IPC/store/CLI 결과 |
| VP09 | REQUIRED | SELF_PASS | O02/O10/O11/O14/O15/O19: idle 폐기→cold resume, busy/live/late 오류 보관 | not selected — 실제 runtime 및 deferred 응답 |
| VP10 | REQUIRED | SELF_PASS | O03/O04/O20: native port→실제 SQLite transaction→reader→DTO | not selected — commit/rollback·FTS 결과 |
| VP11 | REQUIRED | SELF_PASS | O08 및 O04: ID exact join·child/orphan·live tail, 원본 불변 | not selected — 표시 parts 직접 비교 |
| VP12 | REQUIRED | SELF_PASS | O13/O15/O21/O22: 실제 SDK chain 선택·compact/meta·branch·오류·revision | not selected — raw fixture와 SDK 출력 |
| VP13 | REQUIRED | SELF_PASS | O05/O06/O07/O16: 하네스 native UUID→coordinator→writer, child ID 배제 | not selected — 이벤트/저장 인자 |

REQUIRED 검산: `SELF_PASS 13 / SELF_BLOCKED 0 = 13`. §9 회귀 범위의 0262 지속 채널/승인/도구는 G08에서, 0232 DEV 자동 피드·0264 하네스 경계·reader/usage/artifact FK·0230/0231 권한은 G01/G05 및 G10~G12에서 확인했다. 초기 실패와 재검증의 대응은 아래에 기록했고 기존 회귀 스위트를 REQUIRED pair 수에 합산하지 않았다.

## [구현자 기입] 이번 라운드 수정의 잠금

해당 없음 — 직접 oracle. native 파일·SQL transaction·projection 출력·IPC/store 상태·SDK/CLI·실제 Bootstrap 콜백을 실행했다. 새 source scan/AST 정적 배선 proxy를 만들지 않았다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|

- **분모 검산**: 선택 증거 0 · 인용 변이 0 · 새 구조적 proxy oracle 0 = 잠금 표 행 0. 직접 행동 테스트 증가는 이 분모에 넣지 않는다.
- **덮개 회귀**: 첫 구현 라운드이며 이전 verify의 red 장치를 교체·삭제한 사례가 없다. 기존 하네스 경계 회귀의 선택 증거는 해당 회귀 정본을 유지한다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | `nativeSync`의 missing/unavailable/migration-required·orphan 안내를 store의 기존 오류 보고 경로가 소비한다. busy는 토스트를 만들지 않는다(O11). | G05/G11 renderer 회귀 확인 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | bootstrap runtime·activity 수명은 유지하고 refresh callback을 주입했다. O18/O19가 실제 register의 객체·callback을 실행한다. | 정리 후 native/출력 유지 O09 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 원본 부재·접근 실패는 보관 화면 유지, 실행 중은 갱신 보류, 제거 중 지각 응답은 폐기 상태에 대응한다. | O02/O11/O20 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | native 실패와 orphan 부가 기록은 안내하고 cached body는 유지한다. 후속 재열기에서 재시도한다. | O11 직접 오류 consumer 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 요청세대·live mutation·낙관 입력 이후 snapshot을 적용하지 않는다. 다른 세션 선택과 lastSessionId를 덮지 않는다. | O10 및 store의 optimistic send/다른 세션 케이스 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 입력 wire mapper 밖 response/reconcile에서 native ID가 소실될 수 있음 | 선조치 및 설계 EP10 반영 | O16의 UUID/중복 receipt 결과 |
| 2 | catalog 조회가 준비 env 없이 별도 native root 서버를 만들 수 있음 | 선조치 및 EP11 반영 | O17의 turn/settings 실제 인자 |
| 3 | 목록 제거의 background 정리가 보관 output 파일까지 삭제할 수 있음 | 선조치 및 EP12 반영 | O09 실제 파일 바이트, O18 실제 callback |
| 4 | refresh 안쪽 테스트만으로 실제 bootstrap의 runtime callback 연결을 검증할 수 없음 | EP13 반영 후 실제 Bootstrap.register 행동 테스트 추가 | O19의 ctx·3콜백·handler 연결 |
| 5 | SDK 조회가 meta/queued 입력을 필터링하거나 compaction·분기를 전체 시간순으로 섞을 수 있음 | 조회용 복제본에서만 meta 필터 해제 후 UUID로 raw 메타 결합, current chain 선택 | O21. 실제 query에는 memory sessionStore를 넣지 않음(O13) |
| 6 | raw 읽기 뒤 SDK chain 선택 중 파일이 바뀌면 서로 다른 revision이 섞임 | 선택 후 원본 signature 재확인, 바뀌면 busy | O22의 read boundary 3/4 |
| 7 | native 질문 call에 결과 part가 없으면 Orca에 저장한 답변·교정이 누락될 수 있음 | exact tool ID에만 부가 결과 보충 | O08의 question/plan 결과 케이스 |
| 8 | fork가 native UUID를 바꾸면 원래 세션의 매핑 복사는 잘못된 sidecar 연결이 됨 | 추정 복사하지 않음. 원본 보관 및 unmapped sidecar 표시 정책 유지 | SDK의 ID 재작성 확인, O08/O21의 distinct ID·orphan 결과 |
| 9 | OpenCode migration marker 순서·기존 target 행 관계·부분 자원 이관이 false success를 만들 수 있음 | 0262 소유 구현에서 intent 순서·관계 검사·원본 불변·재시도 보강. 미지원 snapshot worktree는 명시 미완료로 분류 | 0262 migration integration 및 O23. 이 보고에 이관 내부 분모를 중복 합산하지 않음 |

### 설계 대비 명시적 차이

- §9 예정 `infra/db/native-history.test.ts`는 실제 `features/history/native-history.db.test.ts`, `session.native-history.test.ts`는 기존 `handlers/session.load.test.ts`, `writer.received.test.ts`의 신규 native ID 검증은 `writer.native-history.test.ts`에 배치했다. 기능 경계와 직접 행동 oracle는 유지했다.
- Bootstrap 검증은 source proxy를 추가하지 않고 기존 테스트와 같은 실제 prototype 메서드 호출 방식으로 구현했다. 외부 IPC 등록 직전에 멈추고 생성된 실제 콜백을 실행한다.
- native snapshot·원래 Orca 행의 보존 방식 및 사용자 결과는 §8과 동일하다. 실제모델 전송 없이 CLI fixture의 로컬 합성 모델을 사용했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 테스트 배치 변경은 새로운 runtime cache/TTL을 도입하지 않음 | 해당 없음. 기존 조회 전후 revision 검사 O22 유지 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 새 저장 공유 방식 없음. 기존 외부 CLI와 Orca의 원본 공유는 계약 자체 | AC5/8·EP02/09: O02/O03/O15/O23 |
| 재진입 | 파일명 변경은 동작을 바꾸지 않음. 실제 callback fixture가 일회성 등록만 확인하는 한계는 별도 store/runtime 테스트로 확인 | AC4/8·EP07/09/13: O10/O14/O19 |
| 다른 무효화 축 | 신규 무효화 축 없음. 삭제·live 시작·로컬 write·원본 revision 변화는 각각 실행 | AC4/5/8·EP02/06/07: O02/O03/O09/O10/O22 |

## [구현자 기입] 구현 보고

| 실행 | 명령 / 범위 | 관측한 산출 |
|---|---|---|
| G01 | Claude adapter/mapper/input-receipts/native paths/history·기존 권한 회귀 Vitest 실행 | 53파일 715케이스 통과. 이후 camelCase native metadata 보강 mapper 13케이스 별도 통과 |
| G02 | `node .tmp/0265-native-db-tests.cjs` — Electron Node로 native-history DB·queries·migration·session load | 4파일 64케이스 통과. SQLite 로드 ABI 140 유지 |
| G03 | `node node_modules/vitest/vitest.mjs run src/main/app/native-history.test.ts src/main/app/harnesses/claude/extensions.native-paths.test.ts src/main/app/chat-turn/resolve-turn.runtime-catalog.test.ts` (app cwd) | 3파일 27케이스 통과. 실제 idle runtime 폐기→fresh same-ID resume 포함 |
| G04 | common native-sync/projection/writer·turn-coordinator 관련 Vitest 묶음 | 담당 실행 기록 5파일 94케이스 통과. 각 자리 좌표 O02/O07/O08 |
| G05 | renderer native-history store 및 관련 회귀 Vitest | 신규 store 17케이스, 관련 30파일 283케이스 통과. 두 결과는 중복 포함이므로 더하지 않음 |
| G06 | `node .tmp/0265-session-remove-tests.cjs` — 실제 handler/DB/파일·delete·background·load | 4파일 31케이스 통과. 원본 JSONL·worktree·출력 snapshot 바이트 및 DB journal/parts/binding 유지 |
| G07 | `node node_modules/vitest/vitest.mjs run src/main/app/bootstrap.native-history.test.ts src/main/app/handlers/misc.runtime-catalog.test.ts --pool=threads --maxWorkers=1` (app cwd) | 2파일 4케이스 통과. Bootstrap 2개와 settings catalog 2개 |
| G08 | OpenCode adapter/persistent/map/input/server/native-history/native-storage 및 no-node-fetch 관련 Vitest | 최종 16파일 129케이스 통과. fixture의 fetch 주입 수정 포함 |
| G09 | `app/harnesses/opencode/native-storage.testfixture.ts` 실제 CLI fixture와 integration wrapper | 최종 1파일 1케이스 통과(102.17초). native ID·터미널 followup·restart·legacy 이관 재개·custom XDG/DB·native config 불변·보조 세션 정리. 로컬 모델 8호출, 외부0 |
| G10 | `npm run typecheck`; 변경 파일 readonly ESLint (app cwd) | node/web/test 3구성 통과. 변경 TS/TSX 91파일 ESLint 0 error/0 warning |
| G11 | 전체 Node Vitest 및 실패한 변경 회귀 재실행 | 최초 743파일: 통과699·실패43·skip1; 7,297케이스: 통과6,929·실패281·skip87. 실패281=ABI269+strict native ID 기대값11+fetch guard1. 변경 회귀12개는 수정 후 통과 |
| G12 | ABI 영향을 받은 39파일을 설치 Electron Node의 새 프로세스로 분할 실행 | 377케이스 통과. 초기 ABI 실패/전처리 skip 파일 집합과 재실행 파일 집합의 차집합0. 대량 실행의 `0xC0000409`는 격리 실행으로 해소; 앱 구조·성능 코드 변경 없음 |
| G13 | build·문서 inventory/prose/링크·스크립트 gate | 최종 build 통과(renderer 23.45초), 기존 mixed-import warning1. 문서 검사 `current:true, links:[], prose:[]`. scripts142 중 sandbox EPERM8은 관련 ensure-sqlite-abi13 재실행 통과 |

G02/G06의 `.tmp` 실행기는 검증 중 생성한 로컬 보조 파일이며 커밋 대상이 아니다. 재현 시 같은 네 테스트 파일을 설치된 Electron의 `ELECTRON_RUN_AS_NODE=1` 환경에서 Vitest `--pool=threads --maxWorkers=2`로 실행한다. G01/G04/G05/G08~G13은 담당자의 이번 라운드 실제 실행 보고를 합쳤다. 초기 전체 실행을 단일 green 실행으로 바꾸어 기록하지 않았으며, 실패 원인별 재실행으로 확인했다. 실행 묶음끼리 중복된 파일·케이스 수를 합산하지 않았다.

| 항목 | 내용 |
|---|---|
| 변경 파일 | common native-history 포트·app native-history/resolve-turn/handlers/bootstrap; history sync/projection/reader/writer·DB query/migration; Claude native path/history/map/receipt 및 소비처; OpenCode 1.x native storage/history/migration; renderer chatStore/reducer 및 동반 테스트 |
| 실행 명령 | G01~G13. 전체 Node 실행 뒤 ABI 파일은 Electron 새 프로세스로 분할하고 변경 회귀는 해당 직접 테스트에서 재실행 |
| **관측한 게이트 산출** | 초기 실패281의 원인별 재검증 완료(G08/G11/G12). typecheck3·변경 lint·build·문서/스크립트 gate 통과. build의 기존 mixed-import warning1 |
| 환경 기인 실패 분리 | ABI269와 전처리 skip은 G12에서 확인. scripts EPERM8은 허용 환경에서 해당13케이스 재실행 통과. ABI 재설치·사용자 DB 조작 없음. 무시된 `.tmp/opencode-dev` 링크5는 배포 문서 밖 |
| V-pair 자기확인 | REQUIRED `SELF_PASS 13 / SELF_BLOCKED 0`; 회귀 근거는 G01/G05/G08/G10~G12 |
| 강제 지점 전수 | EP01~13 `50/50` 직접 행동 oracle. 이전 분모39에 추가 전달 edge11 반영 |
| **AC 자기보고** (`Criteria-Met`) | 아래 AC 표의 `8/8`. 구현자 자기확인 완료; 독립 검증은 후속 단계 |
| **합계 검산** | `✅ 8 · ⚠️ 0 · ❌ 0 = 총 8`. AC 분모 변경 없음; EP 자리 분모만39→50 |
| 블로커 / 역질문 | 없음. `no-node-fetch`가 지적한 CLI fixture의 전송 경계는 test-only fetch 주입으로 수정하고 G08/G09 재실행 통과 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | O13의 native persistence·동일 resume ID/cwd; O23의 실제 OpenCode CLI same-ID followup·재조회 |
| AC2 | ✅ | O01/O13/O17/O19 실행 env/model 전달; O23 global/project native config 바이트 불변 |
| AC3 | ✅ | O12의 실제 custom-root settings/skill·plan/guard, O13의 reader/query 동일 root |
| AC4 | ✅ | O09 실제 native/worktree/출력·보관 행 유지, 목록/검색/load 숨김; O18 actual bootstrap 옵션 |
| AC5 | ✅ | O02/O11/O20/O22 원본 오류 보관·경고·재시도; O14 cold resume 실패 차단·busy 동일 ID 허용 |
| AC6 | ✅ | O01/O13 및 OpenCode SDK 배선 직접 테스트, G08/G10/G11 하네스 의존·전송 경계 회귀 통과 |
| AC7 | ✅ | O23 실제 legacy CLI DB의 production migration→CLI 재개·source export 불변, 0262 충돌/롤백 fixture |
| AC8 | ✅ | O04/O08/O10/O20 native IDs·sidecar·live tail·두 번 재열기; O23 외부 CLI 추가 내용 및 O14 fresh resume |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 이 핸드오프의 첫 구현 라운드다. 외부 재열기와 목록 제거에서 원본·보관 자료를 보존하는 동일 계약을 carrier edge까지 적용했다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: D01/02/04/06 및 AC2/4/8은 있었지만 초기 §10에 영수증·catalog·background·bootstrap 전달 11자리가 개별 열거되지 않았다. 구현 조사 뒤 planner가 EP10~13을 추가했고 각 실제 호출부 테스트를 실행했다.
- 반복해서 부딪히는 환경 한계: Node/Electron better-sqlite3 ABI가 달라 DB 테스트를 설치 Electron으로 실행했다. sandbox의 fixture 경로 EPERM은 별도 재실행으로 구별했으며 사용자 DB·실제 세션은 조작하지 않았다.
- 현재 라운드·impl 턴: `r1`. 구현자 자기확인과 운영 gate를 완료했다. 독립 verify는 수행하지 않았으며 INDEX의 검증 좌표를 선점하지 않았다.

## ΔV1 — DB 우선 표시와 세션별 lazy 이력 갱신 (2026-10-16, READY)

### Part I — 추가 Product & UX Contract

사용자 요구는 “nav에서 세션항목 클릭시 transcript 로딩은 1차적으로 db에서 불러와 렌더링”, “로딩 후 레이지 로딩으로 추가 대화가 오갔는지 jsonl을 확인”, “모든 세션은 jsonl에서 어디까지 불러왔는지 offset을 확인할 수 있는 장치”, “세션 렌더링시(대화재개×) 위 순서대로 수행”이다. 재시작 뒤 OpenCode 세션이 Claude composer로 바뀌고 입력 검증 오류로 재개되지 않는 증상도 함께 접수했다.

기준 V1은 공유 브랜치의 위 메타 커밋에서 확인했다(`git cat-file -t`=commit, 원격 추적 브랜치 ancestor 검사 성공). 사용자 요구 변경 턴이며 기존 독립 검증을 수행한 것으로 기록하지 않는다.

| Decision | 결정·조건 | 상태 / 대체 관계 |
|---|---|---|
| D08 | nav 선택과 앱 부팅 복원은 Orca DB의 transcript·세션 backend를 먼저 표시한다. native 조회·서버 시작·catalog 응답을 첫 표시의 선행조건으로 삼지 않는다 | ACTIVE / V1 §8의 `sessionLoad` 안에서 native refresh를 기다리던 순서만 SUPERSEDED |
| D09 | 첫 DB 표시 후 별도 lazy 조회로 외부 추가 대화를 확인하고 발견하면 같은 세션을 갱신한다. 명시적 사용자 전송 없이 모델 prompt/resume·자동 피드 재생을 시작하지 않는다 | ACTIVE / D06 보완. 원본 SSOT와 Orca 보관 정책은 유지 |
| D10 | 알려진 각 세션마다 마지막으로 성공 반영한 원본 읽기 위치를 영속 추적한다. 실패·부분 기록·경합에서는 확정 위치를 앞당기지 않는다 | ACTIVE / 새 요구. 미조회 세션은 `미조회`로 구별하며 읽었다고 추정하지 않음 |
| D11 | 로딩 중 기본 모델 선택·패널 변경 때문에 정상 DB 응답을 버리지 않는다. 저장 backend가 composer/transcript/패널과 다음 전송의 하네스를 결정한다 | ACTIVE / 0262 D-002의 복원 경합 보완. 새 세션 기본 하네스 D-006과 구별 |
| D12 | 기존 native 형식을 유지한다. Claude JSONL 바이트 offset과 OpenCode SQLite 변경 위치를 공통 읽기 커서로 추상화한다 | ACTIVE / 사용자의 후속 “수정하라” 및 기존 원본 SSOT 결정. OQ1 종결 |

OQ1 종결: 기존 native 형식 유지 정책과 후속 구현 지시에 따라 형식별 커서를 사용한다. 별도 JSONL을 생성하거나 원본 포맷을 바꾸지 않는다.

| 상황 | 사용자에게 보이는 결과 |
|---|---|
| nav 선택 / 재시작의 cold load | DB 읽기만으로 본문·저장 하네스 표시. 그때까지 전송·자동 모델 확정 보류 |
| DB 표시 완료 | 로딩 차단 해제. 화면이 commit된 뒤 lazy 확인 시작; 본문을 비우거나 다시 전체 로딩 상태로 만들지 않음 |
| 기존 메모리 cache 존재 | 기존 화면은 유지하되 DB 재조회 후 lazy 순서 적용. 패널·초안·스크롤 등 표시 상태는 유지 |
| native 추가 없음 | 본문 재구성·LLM 전송 없이 현재 표시 유지; 동일 커서로 완료 |
| native 추가 있음 | 원본 ID로 반영하여 중복 방지. DB 보관과 커서를 함께 확정한 결과만 화면에 적용 |
| native 접근 실패 / 미완료 응답 / 이관 보류 | DB 본문·저장 backend 유지. 기존 안전한 오류 안내 또는 busy 보류 |
| lazy 중 전송·라이브 수신·다른 세션 선택·목록 제거 | stale 결과가 현재 대화·하네스·새 입력을 덮지 않음. 다음 진입에서 재확인 |
| native 파일 축소·교체·같은 크기 수정 | 이전 offset을 무조건 seek하지 않음. 검증된 전체 재수입 또는 명시 실패; 원본 무변경 |

범위는 알려진 세션의 표시·읽기 위치·복원이다. 전역 native 세션 발견, 상시 polling/watch, 원본 포맷 변환, terminal 실행 강제 종료는 추가하지 않는다. 원본 형식별 커서를 사용하는 아래 기술안을 적용한다.

| AC / R↔AT | 관측 기준 | 도달 경로 / 직접 oracle 예정 |
|---|---|---|
| AC9 / R09↔AT09 NEW | native reader가 지연되거나 실패해도 DB 본문과 backend가 먼저 표시되고 loading이 해제된다 | `handlers/session.load.test.ts`: 실제 등록 load 핸들러, 지연 native 훅 호출0과 DB 결과. `chatStore.native-history.test.ts`: DB 응답 적용 후 프레임 경계 전/후 refresh 호출순서 |
| AC10 / R10↔AT10 NEW | DB 첫 화면 이후 추가 대화를 lazy로 반영하고, 표시 동작으로 모델 요청을 만들지 않는다 | 실제 load→refresh 핸들러/DB와 store 테스트: 외부 fixture 추가, 같은 ID, prompt/send0, 두 번 열어 중복0 |
| AC11 / R11↔AT11 NEW | 세션별 성공 읽기 위치를 재시작 후 조회할 수 있다. cursor 미존재·정상·실패 보류가 구분되고 snapshot·검색·cursor가 원자적으로 저장된다 | 실제 SQLite `native-history.db.test.ts`: 세션 두 개의 cursor, 재개방, 중간 SQL 실패·경합에서 이전 값 유지 |
| AC12 / R12↔AT12 NEW | JSONL 추가분·부분 UTF-8/JSON 행·교체·축소·in-place 변경을 처리하고 확정 전 offset을 앞당기지 않는다 | Claude native reader의 임시 파일: bytes 기준 확인, 읽은 구간 관측, 실패/완료 재시도, 기존 current-chain 선택 |
| AC13 / R13↔AT13 NEW | 재시작·nav 진입의 기본 모델 hydration이나 패널 변경 중에도 저장 하네스가 복원된다. 명시 전송은 그 하네스/ID로 재개된다 | 공통 store/reducer와 0262 ΔV16: 실제 deferred load 동안 모델 선택→DB 반환→composer/다음 send 인자 |
| AC14 / R14↔AT14 NEW | 늦은 lazy 결과는 live 입력·대화 제거·새 조회를 덮지 않고 오류가 DB 본문을 지우지 않는다 | store deferred refresh + main refresh/DB CAS 테스트. UI 변경만 있는 경우 정상 결과는 허용 |

기존 AC5의 보관/오류, AC8의 외부 이력 반영은 유지하며 그 도달 순서를 AC9/10이 구체화한다. 기존 AC1~4·6/7은 변경하지 않는다. 새로운 AC는 6개이며 기존 8개 자기보고와 합쳐 구현 완료로 세지 않는다.

### Part II — 조사와 구현안

| 대상 / 검색 | 실측 | 의미 |
|---|---|---|
| `handlers/session.ts`의 `sessionLoad`, `refreshHistory` | load 핸들러 1곳이 `await refreshHistory` 후 DB reader 호출 | native 초기화가 첫 DB 표시를 지연 |
| `chatStore.ts`의 `sessionLoads`, `request.entry` | 조회 1곳이 엔트리 객체의 동일성까지 검사 | 본문과 무관한 모델/패널 변경도 DB 응답을 폐기 |
| `Composer.tsx` hydration effect / reducer `SET_MODEL` | loading guard 없음; backend=null인 잠긴 세션에 모델의 backend 지정 가능 | cold load 중 Claude 기본값이 먼저 들어갈 수 있음 |
| `writer.ts`→`queries.ts`→`reader.ts`→`LOAD_SESSION` | insert/SELECT/DTO 모두 backend를 운반 | backend 저장 칼럼 누락으로 단정할 근거 없음 |
| `.tmp/native-load-repro.test.ts`에서 실제 store 진입 | 대조군 1통과, hydration 개입 1실패: 기대 opencode / 실제 claude | 응답 폐기 뒤 `loadingSession=false`가 되어 오류 상태가 확정됨. 사용자 DB 수정 없음 |
| native reader 두 구현 | Claude 전체 JSONL read+revision; OpenCode SDK 전체 messages 2회+revision | 기존 `local_frontier`는 Orca message 행 ID이며 native byte offset이 아님 |

조사 명령은 `rg -n 'sessionLoads|request.entry|loadingSession|SET_MODEL' app/src/renderer/src/features/chat`, `rg -n 'refreshHistory|sessionLoad|readHistory|nativeHistory' app/src/main/app app/src/main/features/history`, `rg -n 'backend|insertSession' app/src/main/features/history/writer.ts app/src/main/infra/db/queries.ts app/src/main/features/history/reader.ts`다. 실제 store 재현은 `.tmp/native-load-repro.config.mjs`로 실행했고 임시 자료는 커밋하지 않는다.

**공통 흐름**

```text
nav / boot restore → session.load(DB만) → LOAD_SESSION(저장 backend/본문)
  → React commit 및 다음 paint 경계 → session.refresh(읽기 전용 native 확인)
  → unchanged / busy / 오류: 현재 화면 유지
  → updated: snapshot+cursor+FTS DB transaction → 동일 조회 세대의 transcript 갱신
명시 send → 기존 admission/native 존재 확인/resume (표시 경로와 별개)
```

1. `sessionLoad`는 DB reader·현재 activity만 반환한다. 유효한 세션의 보관 파트가 0개면 backend가 있는 빈 본문을 반환하고, 없는/숨긴 세션만 null이다. native read·catalog·server·runtime 폐기는 첫 IPC에 넣지 않는다.
2. 별도 `sessionRefresh` IPC를 추가한다. request는 sessionId, result는 `updated + LoadedSession` / `unchanged` / `busy` / `missing|unavailable|migration-required + message`의 union이다. main이 저장 backend/config/cwd와 기존 활동 guard를 사용하며 renderer가 원본 경로·offset을 임의 지정하지 못한다.
3. preload·renderer API·IPC 문서·inventory를 함께 배선한다. store는 DB 적용 후 두 rAF 경계(중간 paint 허용)에서 lazy 확인을 예약하고, 다른 세션으로 이동·삭제되면 미시작 작업을 취소한다. 이미 시작된 read의 안전한 보관은 main guard가 판단하되 다른 세션 UI에 응답을 적용하지 않는다.
4. 요청 token과 본문/live 세대를 구별한다. 모델·패널 변경으로 엔트리 객체가 교체되어도 정상 DB 응답을 폐기하지 않는다. 수신 이벤트(rAF 대기 포함), 낙관 전송, 삭제·새 조회는 stale 판정에 계속 포함한다.
5. cold load 중 자동 모델 hydration·SET_MODEL·send를 보류한다. DB 수신 뒤 backend와 agentKind는 저장값으로 복원하고, 캐시 보존 분기에서도 원본 정체성을 제외하지 않는다. 기존 세션에 호환 모델이 없으면 안내/미선택 상태를 유지하며 다른 하네스로 폴백하지 않는다.

**읽기 커서 — 확정안**

- 공통 `NativeHistoryCursor`는 version·sourceKey·revision과 opaque adapter checkpoint를 갖는다. concrete byte/sequence 해석은 각 하네스 안에 두고, 공통 코드는 JSON envelope의 유효성만 검증한다. resume query와 cursor 조회를 같은 동작으로 취급하지 않는다.
- read 포트는 이전 snapshot/cursor를 main DB에서 받아 `unchanged` 또는 안정된 `snapshot + cursor`를 돌려준다. 기존 cursor 없는 보관 자료는 lazy 최초 확인에서 전체 읽기로 초기화한다. `nativeSessionError` 등 기존 소비처도 새 결과 의미를 명시적으로 처리한다.
- append-only 신규 migration으로 snapshot 테이블에 nullable `cursor_json`을 추가한다(기존 migration 수정 금지). snapshot·raw·local frontier·FTS·cursor는 같은 Orca DB transaction에서 확정한다. native는 읽기 전용이고 원본과 Orca 사이 dual-write를 만들지 않는다.
- DB의 세션별 cursor 조회는 `미조회` 또는 마지막 성공 source/revision/checkpoint/syncedAt을 반환한다. 화면의 새 버튼을 요구사항으로 추가하지 않는다. 검증·진단에서 cursor를 확인할 수 있고, 경로·raw 본문·자격증명은 renderer DTO에 싣지 않는다.
- 동일 revision은 no-op로 돌려 불필요한 FTS 교체와 화면 재구성을 생략한다. read 후 live/제거/DB 변경 guard와 transaction CAS를 통과하지 못하면 cursor도 그대로다. 출처가 바뀌면 기존 보관을 유지하고 이관 필요 상태로 분리한다.

**Claude JSONL 경계 — 확정안**

`claude/`의 reader/helper만 JSONL을 해석한다. checkpoint는 파일 identity(dev/ino 및 경로 hash), 성공한 UTF-8 byte offset, prefix digest, 완결 행/원본 UUID 정보다. 확정 byte offset은 정상적으로 파싱·현재 chain 선택·완료 판정을 거쳐 DB에 반영한 마지막 경계이며 문자열 길이로 계산하지 않는다.

변경 없는 stat+identity는 빠르게 확인한다. append 후보는 기존 prefix를 검증한 뒤 저장 raw에 tail을 결합하여 SDK current-chain 선택을 다시 수행한다. 앞부분 수정·축소·교체 시 잘못된 seek 대신 검증된 전체 재수입을 수행하고, 쓰기 중·부분 마지막 행·미완료 응답은 기존 cursor를 유지한다.

prefix 검증은 데이터 보존을 위한 읽기이며 tail만 읽는다고 과장하지 않는다. 기존 원본 128MiB 상한 안에서 처리하고, 변경된 파일의 worst case는 prefix 검증+전체 재수입이다. 최대 크기·한글 UTF-8 경계·동일 길이 교체·앞부분 수정 후 append를 파일 fixture로 확인한다.

### Delta V와 자리별 oracle

R09~14/AT09~14는 NEW다. SD-Δ1/AR-Δ1/MD-Δ1~3도 NEW이며 아래 REQUIRED pair를 갖는다. V1 R05/R08·SD01·AR01·MD02의 보관/동기화/실행 보호 계약은 INHERITED이며 VP05/08/09/10/12를 아래 REGRESSION으로 연결한다. D08이 대체하는 첫 표시 순서와 새 cursor 의미는 이번 NEW node가 소유하고, 그 외 기준 V의 비영향 계약은 유지한다.

| pair | 분류 / 경로 | §10 자리 / 직접 oracle 예정 |
|---|---|---|
| VP-Δ1-01 R09↔AT09 | REQUIRED / nav→DB→첫 화면→lazy 시작 | EP14a/b/c/d. 실제 등록 handler와 store+rAF 테스트, native 지연 상태에서 첫 DB 표시 |
| VP-Δ1-02 R10↔AT10 | REQUIRED / refresh→native→DB→같은 화면 | EP15a/b/c/d. handler/DB 통합+store: 외부 내용 추가·prompt0·중복0 |
| VP-Δ1-03 R11↔AT11 | REQUIRED / cursor read→DB commit→재시작 조회 | EP16a/b/c. 실제 SQLite cursor 저장·rollback·재개방 |
| VP-Δ1-04 R12↔AT12 | REQUIRED / JSONL checkpoint→tail/재수입 | EP17a/b/c/d. 임시 JSONL 읽기 구간·byte offset·최종 parts 관측 |
| VP-Δ1-05 R13↔AT13 | REQUIRED / cold load→composer 선택→same-ID send | EP18a/b/c/d. 0262 ΔV16의 실제 store/reducer/send 회귀 |
| VP-Δ1-06 R14↔AT14 | REQUIRED / lazy 응답→세대 판정→화면 | EP19a/b/c. deferred store/DB: UI-only 변경 허용·live/제거/새 요청 폐기 |
| VP-Δ1-07 SD-Δ1↔ST-Δ1 | REQUIRED / nav/boot→2단 로딩→오류/재시작 | EP14~19. 실제 handler+SQLite 및 renderer-store 경계를 각각 실행하고 DTO를 연결; 양 끝을 함께 mock하지 않음 |
| VP-Δ1-08 AR-Δ1↔IT-Δ1 | REQUIRED / preload/API/handler/native port | EP14a·EP15a/b. 실제 IPC 계약/등록과 두 adapter 결과, 독립 하네스 경계 lint |
| VP-Δ1-09 MD-Δ1↔UT-Δ1 | REQUIRED / checkpoint→조건부 교체 | EP16/17. 실제 reader·SQL transaction의 완료/실패 경계 |
| VP-Δ1-10 MD-Δ2↔UT-Δ2 | REQUIRED / load token·본문세대→accept/discard | EP19. store deferred API, 모델·패널·live·send 각각 비교 |
| VP-Δ1-11 MD-Δ3↔UT-Δ3 | REQUIRED / 저장 backend→hydrate/전송 guard | EP18. 실제 reducer·store 모델 선택/전송 인자 |
| VP-Δ1-R1 | REGRESSION / V1 VP04/05/08/09/10/12/13 | 기존 delete.native-history·native-sync/projection/writer·Claude map·OpenCode native-history 회귀. 원본/부가 기록/실행 보호 유지 |

| EP / 전수 자리 | 실패 의미 | 직접 oracle 진입·관측 |
|---|---|---|
| EP14a load handler, b preload/API, c DB 적용, d paint 후 예약 (4) | native 대기로 첫 화면 지연 또는 DB보다 먼저 refresh | `session.load.test.ts` 등록콜백; preload 계약; store 순서/rAF; 정상 DB body/backend |
| EP15a refresh handler, b native port, c DB commit, d renderer 적용 (4) | 조회 결과가 보관/화면에 안 오거나 prompt 유발 | 신규 refresh handler/실제 DB 테스트 + store, 두 adapter fixture에서 query/send0 |
| EP16a cursor 조회, b snapshot/FTS 동시 commit, c 기존 cursor 없는 자료 (3) | 위치만 진전·재시작 유실·기존 자료 읽기 불가 | `native-history.db.test.ts` real SQLite 재개방/SQL 실패 |
| EP17a stat/identity, b prefix/tail byte read, c parse/current-chain, d 완료 snapshot (4) | UTF-8 절단·rewrite 누락·partial을 성공 표시 | `claude/native-history.test.ts` 임시 파일 교체/부분행/분기/완료/재시도 |
| EP18a composer hydration, b SET_MODEL, c DB identity 복원, d send admission (4) | 로딩 중 Claude 선택 고착·다른 하네스 전송 | 공통 store/reducer 및 0262 ΔV16 실제 Composer effect·send payload |
| EP19a 조회 token, b live/낙관본문 세대, c leave/drop/재진입 (3) | UI 변경을 stale로 오인하거나 늦은 응답이 새 입력 덮음 | store deferred API·coalescer rAF 및 기존 main CAS |

신규/변경 강제 자리 `4+4+3+4+4+3=22`. 기준 50자리와 겹치는 load/guard 지점은 더해 전수 합계로 보고하지 않는다. 모든 oracle은 직접 행동 검증을 예정하며 새 구조적 proxy·전수 스캔 oracle은 도입하지 않아 선택 mutation은 not selected다. 구현 시 실제로 등록한 테스트명과 각 실행 구간을 보고해야 한다.

### 운영 gate / READY 판정

main/renderer AGENTS의 하향 의존과 하네스별 구현 경계를 유지한다. typecheck 3구성, readonly lint, 관련 handler/store/adapter/실제 SQLite 회귀, migration append-only·sync, preload/IPC 계약, error registry, inventory/링크, build를 수행한다. 현재 Electron SQLite ABI를 재설치로 바꾸지 않는다.

최종 대조: D08→AC9, D09→AC10, D10→AC11/12, D11→AC13/14가 연결된다. V1 native 원본·목록 제거·모델 오버라이드 결정은 유지하며, 원본 조회 선행 순서만 명시 대체한다. D12를 확정했다. OpenCode sequence 단독 비교 대신 session/message/part projection digest를 함께 검증하여 update/delete/revert를 포괄한다. 이번 Delta는 READY이며 구현·독립 검증은 아직 완료되지 않았다.

### [검증자 기입] 파생 이슈 — 사용자 보고의 구현 전 재현

| ID | 출처 / 계약 | 재현한 관측 | 판정 / 다음 처리 |
|---|---|---|---|
| EXT-01 | 사용자 재시작 보고 / 0262 D-002, 본 ΔV1 D11·AC13 | 실제 store의 deferred load 중 `setModel(claude)` 호출 후 OpenCode DB 응답이 버려짐. 2케이스 중 대조군 통과·해당 케이스 실패 | 재현된 결함. 공통 로딩 token·hydration/전송 guard를 수정하고 영구 회귀로 옮길 것. 독립 verify 판정은 아님 |


## [구현자 기입] 설계 리뷰 — ΔV1 r1.2

DB 첫 표시와 native 조회를 `session.load`/`session.refresh`로 나눴다. 조회 중 entry 객체가 바뀌었다는 이유로 DB 응답을 폐기하던 EXT-01은 본문/live 참조와 조회 token으로 좁히고, loading 중 모델 hydration·SET_MODEL·send를 보류하여 수정했다.

Part II 차이: Claude stat만으로 unchanged를 단정하지 않고 bounded bytes digest를 검증한다. 동일 길이 in-place 수정과 타임스탬프 복원을 놓치지 않기 위한 선택이다. 확정 prefix는 검증 후 raw record를 재사용하고 tail만 JSON 파싱한다. 파일 전체 byte 읽기는 남으므로 append-only I/O 최적화를 주장하지 않는다. 만료: 시간 TTL 없음. 공유: 세션별 영속 cursor이며 설정/출처 변경은 sourceKey 검사. 재진입: token/CAS 검사. 다른 무효화: rewrite/truncate/replace/부분 UTF-8 시험으로 AC12·EP17 재확인. 제품 계약·필수 pair 변경 없음.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 — ΔV1 r1.2

아래 좌표의 경로 접두사는 `app/src/`다. 테스트가 실제 실행한 구간만 자리로 센다.

| Oracle | 파일:테스트명 / 관측 |
|---|---|
| L1 | `main/app/handlers/session.load.test.ts:returns DB body and backend without starting the slow native reader` — native 훅0, DB body/backend 반환 뒤 refresh 명시 호출1 |
| L2 | `preload/index.test.ts:wires DB load and lazy refresh as separate calls with the same stored session ID` — renderer wrapper→실제 preload의 두 채널·ID·반환 확인 |
| L3 | `renderer/src/features/chat/store/chatStore.native-history.test.ts:paints the DB body first, then lazily applies native additions without sending` — DB body→첫 rAF refresh0→다음 frame refresh1→native body; chat.send0 |
| L4 | `main/app/handlers/session.load.test.ts:imports terminal user, assistant and tool messages and reopens twice without duplication` — 실제 load/refresh 등록 callback·SQLite·DTO·검색·보관 원행 확인 |
| L5 | `main/features/history/native-history.db.test.ts:commits the OpenCode reader result and checkpoint through the common transaction` — v1 reader→공통 sync→실제 SQL→DTO, 재조회 unchanged |
| L6 | 같은 파일 `stores per-session cursors atomically, restores them through a new query owner, and preserves them on failure` + `persists the committed cursor after closing and reopening a file database` + `upgrades a cursorless archive on its first native read` — source/revision/checkpoint 영속·SQL 실패 rollback·구자료 초기화 |
| L7 | `main/adapters/claude/native-history.test.ts:commits UTF-8 byte checkpoints, reuses complete prefixes and defers partial appends` + `invalidates stale JSONL offsets after %s` — byte 경계·부분 입력 busy·완성 후 추가 반영·동일 길이 rewrite/축소/교체/prefix 수정 |
| L8 | 같은 파일 `returns busy for stable unfinished inputs and a partially written last line`, `rejects oversized originals before allocating their content`; `native-history-map.test.ts:restores automatic meta input and compact metadata while excluding abandoned branches` — 불완전/상한/current chain 보존 |
| L9 | `renderer/src/features/chat/components/Composer.approvalQueue.test.ts:does not hydrate a Claude model before an OpenCode session finishes loading` — 실제 Composer effect+store, DB 전 null 유지·복원 후 OpenCode DOM |
| L10 | `renderer/src/features/chat/store/chatStore.native-history.test.ts:restores OpenCode after cold-load hydration attempts and sends with its saved identity` + `restores stored identity even when a cached entry contains an incompatible composer` — SET_MODEL/send 보류·backend 복원·동일 ID/backend/provider 전송 |
| L11 | 같은 파일 `accepts only the newest request for the same session`, `rejects late lazy results after %s`, `allows model-only UI updates while native refresh is pending`, `cancels an unstarted lazy check on navigation` — 최신 요청·live/send/remove/leave/new-load·UI-only 구분 |
| L12 | 같은 파일 `keeps DB body and backend when lazy native access fails`; `main/features/history/native-history.db.test.ts:rejects a stale transaction version and a late read after a local write` — 실패/경합 기존 화면·커서 유지 |

| 자리 | 자기확인 / 직접 좌표 |
|---|---|
| EP14a/b/c/d | 4/4 — L1 / L2 / L3 / L3 |
| EP15a/b/c/d | 4/4 — L4 / L5 및 Claude `adapter.native-history.test.ts:reads the same native session through the production adapter without submitting a prompt` / L5·L6 / L3 |
| EP16a/b/c | 3/3 — L6 cursor 조회·재개방 / L6 SQL rollback / L6 cursorless 초기화 |
| EP17a/b/c/d | 4/4 — L7 rewrite/identity / L7 UTF-8 bytes / L7·L8 파싱/current chain / L8 완료 판정 |
| EP18a/b/c/d | 4/4 — L9 / L10 loading SET_MODEL / L10 저장 identity / L10 send payload |
| EP19a/b/c | 3/3 — L11 newest request / L11 live·send / L11 leave·drop·재진입 |

전수 검색: `rg -n 'sessionLoads|loadingSession|LOAD_SESSION|SET_MODEL|sessionApi.load|sessionApi.refresh' app/src/renderer`, `rg -n 'sessionLoad|sessionRefresh|readHistory|nativeHistory|cursor_json' app/src/main app/src/preload app/src/shared`. 읽기 경로, model hydration, 저장 identity와 송신 자리의 실제 caller를 대조했다. 합계는 이번 신규/변경 자리 22/22이며 기존 V1 50자리를 다시 더하지 않는다.

| pair | 자기판정 | 근거 |
|---|---|---|
| VP-Δ1-01 | SELF_PASS | L1~L3 |
| VP-Δ1-02 | SELF_PASS | L3~L5 |
| VP-Δ1-03 | SELF_PASS | L6 |
| VP-Δ1-04 | SELF_PASS | L7~L8 |
| VP-Δ1-05 | SELF_PASS | L9~L10 |
| VP-Δ1-06 | SELF_PASS | L11~L12 |
| VP-Δ1-07 | SELF_PASS | L1~L12, main/renderer 경계 실행 |
| VP-Δ1-08 | SELF_PASS | L2·L4·L5, 하네스 의존 lint |
| VP-Δ1-09 | SELF_PASS | L6~L8 |
| VP-Δ1-10 | SELF_PASS | L11 |
| VP-Δ1-11 | SELF_PASS | L9~L10 |
| VP-Δ1-R1 | SELF_PASS | native-sync/projection/writer/delete/Claude map/OpenCode history/실 CLI 회귀 |

REQUIRED 11 + REGRESSION 1 = SELF_PASS 12, SELF_BLOCKED 0. 독립 verify 판정이 아니다.

## [구현자 기입] 이번 라운드 수정의 잠금 — ΔV1 r1.2

제품 pair는 not selected — 직접 oracle. EXT-01의 deferred hydration 재현을 L9/L10으로 옮겼다. 등록된 제품 변이는 없다. 기존 error report registry에 lazy catch의 `chat.session-refresh.failed` 슬롯을 추가했고, registry의 보고 제거·형제 event 맞바꿈 검사가 통과했다. 기존 스캔 장치를 삭제하거나 범위를 줄이지 않았다.

## [구현자 기입] Product/UX 파생 검토 — ΔV1 r1.2

DB 표시 후 native 실패는 본문을 비우지 않고 기존 오류 UI로 알린다(L12). busy/unchanged는 안내를 반복하지 않는다. 세션 이동 전 예약된 lazy 작업은 실행하지 않고 이미 진행한 결과도 다른 화면을 덮지 않는다(L11). 새 UI 버튼이나 하네스별 시각 스타일 변경은 없다. 저장 backend 복원은 cached 분기에도 적용했다(L10).

## [구현자 기입] 놓친 잠재 문제 + 대응 — ΔV1 r1.2

- EXT-01 closed: UI 상태 변경이 DB 응답의 stale 근거가 되던 결함을 actual store/Composer 테스트로 재현 후 수정했다.
- 초기 레지스트리 회귀는 새 lazy catch 등록 및 분리된 로그 event로 해결했다. registry의 동일 event 맞바꿈은 등가 변이였으므로 gate를 약화하는 대신 load/refresh 실패의 운영 로그를 구별했다.
- 새 OpenCode→DB 연결 fixture에서 필수 SDK tokens/messageID가 누락되어 실패했다. fixture를 실제 필드로 보완했고 production mapper를 완화하지 않았다. SDK type import도 v1 경계 밖에서 직접 참조하지 않도록 정정했다.
- Electron ABI 테스트는 실패 목록이 있어도 exit 0을 돌려주는 경우를 관측했다. 판정은 출력의 failed/pass 수로 확인했다. 의존성·ABI 변경 없음.
- native 원본이 계속 변경되는 동안 갱신은 busy로 보류한다. 상시 polling은 범위 밖이며 다음 재열기에 다시 확인한다.

## [구현자 기입] 구현 보고 — ΔV1 r1.2

| AC | 자기판정 / 직접 관측 |
|---|---|
| AC9 | ✅ L1~L3: native 지연과 독립적으로 DB body/backend 먼저 표시 |
| AC10 | ✅ L3~L5: lazy 추가분·tool 반영, 재열기 중복 없음, 화면 진입 모델 요청0 |
| AC11 | ✅ L6: cursorless 구별, 영속 재개방, snapshot/FTS/cursor rollback |
| AC12 | ✅ L7~L8: UTF-8 byte offset, 부분 입력 보류, rewrite/축소/교체/current chain |
| AC13 | ✅ L9~L10: default Claude hydration에도 OpenCode 복원·동일 ID/backend 전송 |
| AC14 | ✅ L11~L12: 지각 native 결과가 live/전송/제거/재진입을 덮지 않음 |

검산: 이번 추가 AC ✅6 · ⚠️0 · ❌0 = 6. V1의 8/8과 이전 사람 인수·독립 검증 상태는 별도다.

관측한 gate 산출:
- 관련 Node 회귀 61파일857케이스 통과. 이후 cached identity 케이스를 추가한 store 단독 1파일28케이스 통과(중복 합산 안 함).
- actual Composer/preload/main native 회귀 3파일46케이스 통과; main native/projection/adapter/send/registry 묶음의 renderer registry 외 9파일111케이스 통과. 레지스트리는 위 61파일 실행에서 수정 후 통과.
- 실제 SQLite: handler/DB/migration 3파일35케이스, cursor/DB 2파일20케이스, reader/writer/delete/worktree/file factory 5파일10케이스 통과. 마지막 OpenCode reader→DB 연결을 포함한 DB 단독 1파일14케이스 통과. 실행 집합은 중첩되며 합산하지 않는다.
- 실제 OpenCode 1.19 CLI: native 생성→독립 CLI 후속→Orca 조회→재시작→cursor unchanged, legacy 이관·custom DB·native 설정 불변 통과(1파일1케이스, 최종 67.47초). localhost 합성 모델만 사용, read 구간 모델 호출0.
- node/web/test typecheck 통과. production build(main/preload/renderer) 통과; 기존 SubAgentTaskDetail의 정적/동적 import 혼용 경고는 유지.
- 변경 TS/TSX readonly lint에서 SDK import 경계 오류를 수정했고 최종 33파일 오류0·경고0을 확인했다. migration sync/append-only·test budget·inventory/prose/links·diff check 통과. gate script 70케이스 통과.

문서와 IPC inventory는 새 refresh 계약·cursor migration을 반영했다. 사용자 다운로드·첨부, package/lockfile은 수정/커밋 대상에서 제외했다. 독립 verify와 앱을 재시작한 실제 화면 인수는 수행한 것으로 주장하지 않는다.

## [구현자 기입] Review Signals — ΔV1 r1.2

이전 라운드의 native 보관 불변식은 유지하고 사용자 요구로 DB 선표시 순서를 바꿨다. 기존 entry 동일성 검사는 모델 hydration도 stale로 간주했지만 기존 native 재열기 테스트는 이미 backend가 있는 cached 상태만 다뤘다. 이번에는 cold loading과 actual Composer effect를 함께 잠갔다. 환경 제약은 Electron SQLite ABI 및 설치 CLI 접근 권한이며 임시 native root와 localhost 모델로 검증했다. 현재 r1.2, 다음 주체 Claude 독립 verify.

## Delta V2 — 원본 보관 만료와 대화 복구

상태: plan/READY. 사용자 요구로 원본 누락 시 재개를 차단하던 V1 계약과 ΔV1 lazy 오류 표시를 대체한다. DB 선표시와 native SSOT·원본 보존은 유지한다.

### Decision / Product & UX

D13 ACTIVE: DB 표시 후 보조 native 조회의 missing/unavailable/예외는 기존 transcript를 그대로 유지한다. 이 단계 실패는 세션 열기 오류로 표시하지 않는다. DB 자체 읽기 실패는 기존 오류 처리다.
D14 ACTIVE: 명시 전송 시 native missing을 확인하면 보관 대화로 복구한다. unavailable/인증/경로 충돌은 missing으로 단정하지 않는다. Claude SDK는 fresh query의 sessionId(UUID)를 지원하므로 기존 ID로 재생성한다. OpenCode 1.x 공개 create는 사용자 지정 ID를 받지 않으므로 새 native ID를 발급받아 영속 binding을 교체한다. Orca 내부 DB key는 관계/프로젝트/메시지 보존을 위해 유지하며, 실제 하네스 읽기·실행은 교체된 native ID만 사용한다.
D15 ACTIVE: 복구 첫 턴의 모델 입력은 Orca 보관 대화(역할·텍스트·도구 기록을 포함하는 데이터) + 새 입력이다. live/DB/재열기 사용자 버블에는 새 입력만 보인다. 이전 대화는 원래 순서대로 보존한다. recovery prefix를 시스템 명령으로 승격하지 않는다.
D16 ACTIVE: binding·보관 경계·첫 입력 영수증을 DB에 영속한다. 원본/DB는 분산 transaction이 아니므로 create 성공 후 DB 실패는 빈 native 세션만 남을 수 있다. DB 보관은 지우지 않는다. 전송 전 실패는 재시도 가능하고 수신 확인 후 같은 context를 다음 턴에 반복하지 않는다. 다시 원본이 사라지면 누적 보관 전체로 재복구한다. 읽기·전송 경합/삭제 가드는 기존을 따른다.

### Technical Design

공통 adapters 계약에 복구 준비 capability와 첫 턴 context를 추가한다. 구현은 claude/ 및 opencode/v1/에 둔다. 공통 native binding은 원본 ID와 Orca ID의 대응만 소유하며 원본 DB schema를 편집하지 않는다. 별도 append-only migration으로 recovery archive·native ID·최초 echo 식별자를 저장한다. reader는 보관 prefix와 현재 native snapshot을 결합하고 receipt로 확정된 첫 user 메시지의 visible text만 복원한다. 새 snapshot/cursor는 새 native ID에 귀속하며 오래된 offset은 재사용하지 않는다.

| AC / pair | requiredness / §10 강제 자리 | 직접 oracle / 실패 의미 |
|---|---|---|
| AC15 / VP2-1 R15↔AT15·MD2-1↔UT2-1 | REQUIRED / lazy status·catch (2) | store DB 유지+report0, DB 첫 로딩 에러는 유지 |
| AC16 / VP2-2 R16↔AT16·AR2-2↔IT2-2 | REQUIRED / cold resume 판정·Claude fresh ID·OpenCode create·native ID binding (4) | 두 adapter/resolve 경로 fixture, missing만 복구·unavailable 차단·재시작 ID 유지 |
| AC17 / VP2-3 R17↔AT17·SD2-3↔ST2-3 | REQUIRED / archive 조립·첫 prompt·echo·writer·native 재열기 (5) | 실제 DB/adapter/store 경계: 과거+새 입력 모델 수신, 새 버블에 과거0, 과거 transcript 보존 |
| AC18 / VP2-4 R18↔AT18·MD2-4↔UT2-4 | REQUIRED / 준비 실패·receipt 정착·재시작·재복구·lazy cursor (5) | create/commit/echo 경계·SQLite 재개방·두 번 만료·오래된 cursor 재사용0 |
| VP2-R | REGRESSION / DB 선표시·live 가드·Claude/OpenCode native 읽기 | 기존 native sync/projection/readers·load/store·send 회귀 |

새 자리16. 선택 mutation은 not selected(직접 oracle). 운영 gate: main/renderer 의존 lint·typecheck·관련 tests·SQLite·migration sync/append-only·inventory/IPC 문서·build. 자동 원본 삭제·사용자 전역 설정 편집은 도입하지 않는다. 기존 독립 verify와 사람 인수 대기 보존.


## [구현자 기입] 설계 리뷰 — ΔV2 (r1 기록 필드 복원)

DB 선표시 뒤 lazy 조회의 실패는 조용히 소비하고 보관 transcript를 유지한다. 명시 재개에서는 missing만 복구하며 네트워크/권한/이관 상태는 새 세션 생성의 근거로 삼지 않는다. Claude fresh sessionId와 OpenCode create를 하네스별 adapter로 분리하고 native binding·보관 prefix·첫 입력 영수증을 append-only migration으로 영속했다. 원래 Orca key와 외래키 관계는 유지한다.

첫 모델 입력에는 보관 대화와 새 입력이 포함되지만 echo/DB/native 재조회에는 새 사용자 텍스트만 보인다. 기존 prefix의 검색 인덱스를 유지하고 새 snapshot은 이전 cursor를 이어받지 않는다. 첫 입력 수신을 native ID로 확정한 뒤 후속 턴에는 prefix를 제거한다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 — ΔV2

| pair / 자리 | 직접 oracle 좌표 / 결과 |
|---|---|
| VP2-1 lazy status·catch (2) | `chatStore.native-history.test.ts`의 missing/unavailable/reject 보관 유지·오류 보고 0 및 DB 최초 load 실패 처리 — SELF_PASS |
| VP2-2 cold resume·Claude fresh·OpenCode create·binding (4) | `native-session.test.ts:carries cold-resume recovery through provider resolution while keeping the visible input unchanged`; `claude/adapter.fork.test.ts:recreates an expired conversation with the original UUID and hides archived context in its receipt`; `opencode/v1/adapter.persistent.test.ts:creates a replacement native session without trying to reuse an expired server identity`; `native-session.test.ts:persists a replacement across restart and settles its receipt through the real history writer` — SELF_PASS |
| VP2-3 archive·첫 prompt·echo·writer·재열기 (5) | `native-session.test.ts:replaces only a confirmed missing native identity…` / `keeps the recovery prefix out of native reload…`; `send.agent-profile.test.ts:routes a saved OpenCode session…(recovery:true)` 실제 send→TurnRequest→runtime 배선·onPrompt 저장; 두 adapter 복구 prompt/echo 검사; 실제 writer 재시작 case와 `app/native-history.test.ts:reads the replacement identity and masks its recovery input before refreshing the Orca snapshot` — SELF_PASS |
| VP2-4 실패·receipt·재시작·재복구·cursor (5) | `native-session.test.ts:retains the archive when native creation fails or a concurrent write invalidates preparation`; 재시작 receipt case·두 번 만료 case(이전 snapshot/cursor 없음); `continuation.test.ts` listen/flush의 native ID 승계와 복구 prefix 제거; 기존 native-history.db cursor 원자 저장/경합 회귀 — SELF_PASS |
| VP2-R | Claude JSONL/OpenCode native reader·native projection/sync·app routing·DB 선표시·live 가드·store/reducer/전송 회귀 — SELF_PASS |

전수 검색: `rg -n 'readHistory|sessionId|nativeSessionId|recovery|input.echo|commitUserMessage' app/src/main/app/chat-turn app/src/main/app/native-history.ts app/src/main/adapters app/src/main/features/history app/src/main/infra/db/native-history-queries.ts`; `rg -n 'refresh|nativeSync|loadSession' app/src/renderer/src/features/chat/store`. ΔV2 자리 16/16 자기확인, AC15~18 4/4. 선택 mutation not selected. 단위 helper에 머무르지 않고 resolve→send→adapter 및 reader/writer/SQLite 경계를 각각 실행했다.

## [구현자 기입] 이번 라운드 수정의 잠금 — ΔV2

당시 선택 mutation은 not selected였고 위 직접 oracle을 사용했다. 이 기록은 r1 자기보고이며 verify가 지적한 미관측 자리를 닫았다는 뜻이 아니다. r2 잠금과 재판정은 아래 별도 보고를 따른다.

## [구현자 기입] Product/UX 파생 검토 — ΔV2

복구 전문은 모델에만 전달하고 새 사용자 버블은 새 입력만 표시한다. native 자료를 사용자 승인 없이 삭제하지 않는다.

## [구현자 기입] 놓친 잠재 문제 + 대응 — ΔV2

복구 상한과 기존 D02/AC5 대체 표시를 누락했다. ΔV3 사용자 결정으로 보완한다. 아래 로컬 gate 보고와 별개로 원격 Windows CI #773~#779의 native-history 3케이스는 실패했으며 r2 수정 대상이다.

## [구현자 기입] 구현 보고 — ΔV2

0262 ΔV20과 동일한 관련 369파일 회귀 및 수정된 test mock 재검증 집합을 사용했다. DB 검사는 Electron ABI 140의 임시 SQLite에서 migration·실제 파일 close/reopen·FTS·외래키 보존·복구 실패 경합을 확인했다. 전체 readonly ESLint 오류 0(기존 경고 6), node/web/test 타입 검사·production build·scripts142·migration/inventory/test-budget 통과. 사용자 다운로드의 기존 링크 오류는 제외 범위를 명시해 별도 판정했다. 로그는 0262 ΔV20 보고와 `.tmp/current-db-tests*.log`를 참조한다.

## [구현자 기입] Review Signals — ΔV2

native create 성공 후 Orca DB 경합 시 빈 원본 세션이 남을 수 있는 분산 경계는 D16대로 유지한다. 원본/사용자 전역 설정을 삭제하거나 덮지 않는다. 실제 사용자 원본을 지워 복구하는 실험은 하지 않았다. 모델 전송 내용·visible 버블·재시작은 fixture/native 프로토콜 및 임시 DB로 검증했으며, 실모델 복구의 실제 응답 내용은 이번 턴에서 검증하지 않았다. 기존 독립 verify와 사람 인수는 여전히 대기다.

## ΔV3 — 복구 입력 상한과 이전 계약의 대체 범위 (READY)

### Decision / Product & UX

D17 ACTIVE: 사용자 답변 “전송을 중단하고 안내 — 보관 대화 유지”. 복구 첫 입력(보관 전체+새 입력)이 컨텍스트 예산을 넘으면 생략·요약 없이 전송 전에 중단한다. native create, binding 교체, receipt 저장을 하지 않으며 기존 DB와 작성한 입력을 유지한다. 이미 빈 replacement가 생성된 재시도에서도 같은 검사를 적용한다.

D18 ACTIVE: D14·D15가 V1 D02·AC5·§3/§8의 금지에서 대체하는 범위는 명시 전송 시 확인된 missing뿐이다. 원본 접근 실패 일반, 화면 표시, 원본 삭제 정책은 유지한다. app/AGENTS도 이 구별을 따른다.

### Technical Design / §10

공통 복구 admission은 하네스 모듈이 제공한 context window를 소비한다. OpenCode는 선택된 provider/model의 `limit.context`를 재사용하고 부재·비정상은 200k, Claude는 명시 1m 모델 표시 외 200k를 쓴다. tokenizer API 호출 없이 보수적으로 실제 복구 prompt의 UTF-8 바이트 수를 입력 토큰 상한으로 계산하고 window의 80%까지만 허용한다. 나머지는 하네스 시스템·도구 정의 및 출력 여유다. 정규화된 첨부·추가 지시도 계산에 포함한다. 정확한 공급자 토큰 수를 안다는 주장은 하지 않는다. 안내는 ‘안전한 입력 한도 초과’로 표시한다.

| AC / pair | requiredness / 강제 자리 | 직접 oracle / 실패 의미 |
|---|---|---|
| AC19 / VP3-A R19↔AT19·AR3↔IT3 | REQUIRED / 신규 missing 준비·미수신 replacement 재시도·resolve 모델/입력 배선 (3) | `native-session.test.ts`: 임시 SQLite와 실제 resolve, 초과 시 recoverSession/DB binding/receipt/신규 메시지0, 경계 이내 전체 입력 보존, 재시도도 동일 |
| VP3-M MD3↔UT3 | REQUIRED / bytes+새 입력+첨부·context 모듈 정책 (2) | 복구 budget unit/registry test: 한글·경계·작은 모델·fallback·Claude/OpenCode 등록 함수 호출 |
| VP3-R | REGRESSION / VP2-1~4·VP05·VP10·VP12 | 기존 native-session/send/adapter/history/store + Windows canonical path 실패 주입 실제 도달 |

선택 mutation not selected — 직접 oracle. G-0265-1/2 규범 누락을 해소한다. native reader의 Windows 실패 주입은 fixture의 realpath와 동일 경로를 비교하고 실제 주입 횟수를 단언한다. CLI fixture는 PWD를 상속하지 않는다. 운영 gate는 app/AGENTS 및 기존 관련 gate, 원격 Windows CI 결과를 별도로 기록한다.

## [검증자 기입] 파생 이슈 — r1 검증

r1(V1+ΔV1+ΔV2) 독립 검증 = **RETURN_TO_PLAN**. 판정 원문은 [`verify.md`](verify.md).

| # | 이슈 | 출처 | disposition | 대응 방향 |
|---|---|---|---|---|
| G-0265-1 | 복구 첫 prompt의 보관 대화에 상한·초과 시 동작이 없다(`native-recovery.ts archivePrompt` 전체 직렬화) | D15·AC17·AC18 | PLAN_GAP | 상한과 초과 시 표시·영수증 의미를 사용자와 결정해 Delta V로 확정 |
| G-0265-2 | D14·D15가 V1 D02·§8·AC5와 모순, SUPERSEDED 표시 없음. `app/AGENTS.md:86` 반대 규칙 유지 | Decision Ledger | PLAN_GAP | 대체 범위(missing만) 명시, AGENTS 정정 |
| D-0265-1 | `adapters/claude/native-history.test.ts` O22 3케이스가 Windows PR CI #773~#779에서 red. mock이 realpath 경로를 잡지 못함 | VP12 / PR CI | BLOCKING | mock 경로 정규화 후 CI green 확인 |
| D-0265-2 | `[구현자 기입] ΔV2` 필드 접힘 | 재구현 턴 7필드 계약 | BLOCKING | 7필드 재기입 |
| N-0265-1~4 | CLI fixture `PWD` 미격리 · 중복 가드 전용 oracle 없음 · CI red 미보고 · 메타 V mode | — | NON_BLOCKING | verify §8 |

## [구현자 기입] 설계 리뷰 — ΔV3 r2

사용자는 전체 대화가 한도를 넘으면 전송 중단·보관 유지를 선택했다. ΔV3 D17/18을 별도 설계 커밋한 뒤 구현했다. 확인된 missing만 복구하며 화면 표시·unavailable·인증·충돌은 재생성 근거로 쓰지 않는다. 상한은 정확한 tokenizer 측정이 아닌 보수적 UTF-8 예산이다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 — ΔV3 r2

| 자리 | 직접 oracle | 자기결과 |
|---|---|---|
| missing 준비·빈 replacement 재시도 (2) | `native-session.test.ts:rejects oversized recovery before creation and preserves the archive and receipt on retry`: 실제 SQLite 보관/receipt 동일·생성0 | SELF_PASS |
| 모델·입력 배선 (1) | `uses the selected engine model context limit before creating a replacement` 작은/큰 모델 양방향; `passes new input and additional context through resolve before native recovery`; `send.harness.test.ts` 실제 조립 인자 | SELF_PASS |
| byte 상한·context 정책 (2) | `bounds the complete UTF-8 recovery prompt including new text and attachments`; `registry.test.ts:uses each harness context policy through the registered module` | SELF_PASS |
| VP12 / VP05 CI 실패 자리 | `native-history.test.ts` permission1·revision 경계2에서 realpath 비교와 실제 주입 발생 단언. 로컬14케이스와 원격 전체 CI 통과 | SELF_PASS |
| VP2-1~4·VP3-R | native-session11·adapter 복구·history/db/store·continuation 기존 직접 좌표와 실제 native CLI 회귀 | SELF_PASS(기계) |

검색: `rg -n 'prepareNativeSession|archivePrompt|recoverSession|recoveryHistory|recoveryContextWindow' app/src/main`. 새5/5자리, ΔV2 기존16자리 관련 회귀. native CLI fixture는 PWD를 제거하고 실제 잘못된 PWD 상속 환경에서 실행했다.

## [구현자 기입] 이번 라운드 수정의 잠금 — ΔV3 r2

선택 변이0 · 인용 변이0 · 신규 구조 proxy0 = 표 대상0. 새 tests는 실제 budget 결과/DB 부작용을 직접 검사한다. Windows 원래 실패 주입이 무효가 되는 것을 막기 위해 denied와 lstat 호출 횟수를 함께 단언한다. CLI는 1.19.0 실제 바이너리와 합성 localhost 모델이다.

## [구현자 기입] Product/UX 파생 검토 — ΔV3 r2

과거를 조용히 자르거나 요약하지 않고 사용자에게 안전한 입력 한도 초과를 알린다. 허용되는 경우 모델은 보관 전체+새 입력을 받고 버블은 새 입력만 유지한다. 차단 시 native create·binding 변경·receipt 저장·새 DB 메시지는0이다. 더 큰 컨텍스트 모델 또는 새 대화를 안내한다.

## [구현자 기입] 놓친 잠재 문제 + 대응 — ΔV3 r2

상한이 SDK tokenizer와 동일하다고 주장하지 않는다. unknown은200k, 입력에80%를 할당하며 나머지는 하네스 instruction/tool/output 여유다. N-0265-2 중복 가드 전용 oracle은 비차단 유지. D-0265-2 기존 보고7필드 복원, N3 로컬/원격 결과 구분, N4 ΔV3 메타 갱신. D-0265-1은 원격 Windows run38926046458 전체 통과로 구현자 해소 보고하며 독립 판정은 검증자에게 넘긴다.

## [구현자 기입] 구현 보고 — ΔV3 r2

이번 AC15~19: DB 보관·missing 복구·표시 분리·영수증·상한 차단 ✅5. 검산 ✅5 · ⚠️0 · ❌0 = 5(기존4+새1). 앞선 Windows CI #773~#779 실패와 최신 verify head의 같은3실패는 사실로 보존한다. 최신 verify head에는 별도 artifact 재개방 timeout1건도 있었다. 이번 push의 결과는 0262 공통 게이트 표에 기록한다.

## [구현자 기입] Review Signals — ΔV3 r2

실패 주입 fixture가 canonical 경로를 사용하지 않아 Windows/심볼릭 경로에서 주입 자체를 건너뛰었다. production reader 정책을 느슨하게 바꾸지 않고 테스트가 실제 실패를 주입했는지 확인했다. 저장 상한의 제품 선택은 사용자에게 확인했고 기본 저장 경로·전역 설정은 건드리지 않았다.

## [구현자 기입] 설계 리뷰 — r2.1 CI 재실패

run38927521805의 native cursor 준비와 migration 재개방 timeout은 현재 산출물의 CI gate 실패다. 0262 r2.1 공통 보고에 원인·적용 범위를 기록한다. V·사용자 정책 변경은 없다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 — r2.1

native-cursor의 무변경 probe7케이스, native-session 복구11케이스, native-history.db의 동기화·offset·재개방 oracle을 실제 파일/SQLite로 재실행했다. native seed1자리와 Orca recovery file2자리·history 재개방1자리의 fixture를 보완했다. 직접 결과 SELF_PASS이며 원격 전체 gate는 별도 확인한다.

## [구현자 기입] 이번 라운드 수정의 잠금 — r2.1

선택 증거0 · 인용 변이0 · 새 proxy0 = 대상0. production reader/복구 코드를 바꾸지 않았다. 기존 DELETE mode·파일 바이트 동일성·binding/receipt·FTS 단언을 유지했다.

## [구현자 기입] Product/UX 파생 검토 — r2.1

원본 읽기 전용과 DB 보관 정책은 불변이다. 원본 DB를 운영 Orca PRAGMA로 바꾸지 않고 seed transaction만 묶는다. 보관 대화나 실제 native 자원에는 접근하지 않았다.

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2.1

초기화 throw 시 db.close가 건너뛰는 native fixture를 finally로 정리했다. 최초 설정과 재개방의 내구성 설정 차이를 함께 제거했다. 전체 조사와 유지한 예외는 0262 r2.1 표를 참조한다.

## [구현자 기입] 구현 보고 — r2.1

공통 회귀13파일114케이스 통과. AC15~19의 보관·missing 복구·입력 표시 분리·영수증·상한 차단을 native-session/history 결과로 재확인했다. 검산 ✅5 · ⚠️0 · ❌0 = 5. 이번 합계는 0262의 사용량 영속1을 더해6/6이며 이전 전체 AC의 인수 수와 합산하지 않는다. 원격 run38983034999에서 전체7402테스트·scripts142 통과, 상세 gate는 0262 r2.1 표를 참조한다.

## [구현자 기입] Review Signals — r2.1

verify 이후 두 번째 구현 턴(r2.1)이다. 기존 실패 경로3곳 정정과 이번 원격 fixture 초기화 timeout을 구분한다. 독립 검증과 기존 시각 인수는 별도로 남긴다.
