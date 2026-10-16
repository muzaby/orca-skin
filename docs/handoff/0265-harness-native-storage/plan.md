# Plan — 하네스 native 저장 경로와 Orca 보관 정책

## 메타

| 항목 | 값 |
|---|---|
| slug | `0265-harness-native-storage` |
| 작성자 / 일자 | Codex / 2026-10-16 |
| 상태 | plan/DRAFT — 사용자 정책 확정·현재 코드 조사 완료. native 이력 합성·이관·리소스 경계의 기술 설계 보강 전 |
| V mode / revision | Baseline V / V1 초안 |
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

## 5. Acceptance 초안 — R ↔ AT

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

# Part II — Technical Design 조사

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

## 8. READY 전 닫을 설계 항목

| 항목 | 필요한 완료 근거 |
|---|---|
| native 이력 합성 | AC8 확정. native message/part ID 대응·현재 chain/compaction·기존 DB 합성 assistant와의 대응, 자동 feed·첨부·Orca 전용 sidecar 보존 및 transaction 경계 구체화 |
| 목록 제외 형식 | 기존 DB hard delete 대신 숨김 기록 또는 분리 인덱스의 범위, 검색·최근 목록·재시작·live tail 처리. native 원본 보존은 확정 |
| native 리소스 경계 | 영속 원본·Orca 보관/오버라이드·앱 임시 파일을 실제 생산자/소비자에 대응. 0230 권한 정책과 충돌하면 해당 delta 먼저 작성 |
| legacy 이관 | 0262의 export/import 누락 리소스와 ID 충돌, 중단·재시도·다중 저장소 commit 순서 |
| V / §10 | R/SD/AR/MD node·pair, 각 실제 edge의 강제 자리와 직접 oracle 좌표. 위 AC 초안만으로 READY 선언 금지 |
| 문서 정합 | ADR-009에 맞춰 구현 시 app AGENTS·PRD/TRD·GLOSSARY·persistence/runtime/IPC 현재 설명 갱신. 구현 전에 현재 구조를 완료형으로 바꾸지 않음 |

## 9. 예정 검증

관련 비DB Vitest·readonly ESLint·node/web/test typecheck, DB 변경 시 설치 ABI를 유지한 migration/DB 통합 검증, native CLI loopback fixture, build, 문서 inventory/links·diff·trailer를 수행한다. 모델 실제 전송 없이 저장·조회·ID 재개 계약을 우선 검증하고, 실모델 성공과 구별한다.

기존 0262의 UI·승인 FIFO·native feed/지속 채널·usage, 0264의 의존 경계, 0230/0231의 파일 가드·background 출력, Claude Work/Code를 회귀 대상으로 둔다. 기존 사용자 시각 인수 대기는 승계한다.

## 10. 설계 상태

ACTIVE D01~07은 AC1~8에 대응하며 사용자 정책 질문은 모두 닫혔다. §8의 이관·이력 합성·전수 V 기술 계약이 남아 있으므로 **DRAFT이며 코드 구현 착수 기준이 아니다**. 이 native 저장 정책 설계에서는 사용자 정책·반례·배분을 기록했으며 production 코드·사용자 DB·native 설정·실행 프로세스를 변경하지 않았다. 이전 자동 피드의 CI 테스트 보완은 0232에 별도로 기록한다.
