# Main 구조·수명주기·성능 진단

> 조사일: 2026-09-08. 현재 코드와 변경 diff를 확인한 연구 기록이다. 현재 아키텍처 정본이나 전체 검증 완료 판정이 아니다.
> 구현 계약·회귀 테스트·최종 게이트 결과는 [0221 계획](../../../handoff/0221-main-structural-simplification/plan.md)을 따른다.

## 1. 판단 기준

사용자 목표는 Main의 파편화·응집/결합·기능 중복을 개선하면서, 이후 계층 추가에 앞서 구조를 가볍게 만드는 것이다.
파일 수나 길이만으로 문제를 판정하지 않고, 실제 소비자·반복 작업·자원 소유자·실패 경로를 확인했다.
SRT, cowork 실행기, OpenCode adapter는 이번에 도입하지 않는다. 이들을 위한 범용 실행 플랫폼·DI container·정책 DSL도 만들지 않는다.

| 증거 구분 | 이 보고서에서 의미하는 것 |
|---|---|
| 코드 확인 | 현재 호출 경로, 입력 전달, 반복문, 동기 DB 조회와 정리 조건을 직접 읽음 |
| 행동 재현 | 요청 조립 실패 후 리스너 잔존 등 해당 테스트·이벤트 fixture로 확인한 결과. 세부 결과는 계획에 기록 |
| 비용 추론 | 입력량과 호출 빈도로 비용 증가 가능성을 추론. 실제 지연·최대 메모리·처리량 측정은 아님 |
| 미검증 | 실사용 대형 데이터, 실제 사내망, GUI 체감, 미래 adapter·격리 계층의 종단 호환성 |

**wall-clock 비교나 벤치마크는 수행하지 않았다.** 아래 개선은 불필요한 작업 제거와 수신·수명주기 경계를 뜻하며, 속도 향상률을 뜻하지 않는다.

## 2. 코드에 반영한 구조 개선

| 발견 | 반영한 최소 변경 | 유지한 계약·근거 |
|---|---|---|
| 엔진 설정 변경만 확장 배포 구성이 별도로 존재 | engine handler도 기존 `deployExtensions` 큐를 호출. 엔진은 실패를 reject하고 기존 MCP·스킬은 경고 후 계속하는 의미 유지 | 실패 시 설정/runtime/catalog 무효화는 `finally` 유지. [engine](../../../../app/src/main/app/handlers/engine.ts), [배포 서비스](../../../../app/src/main/features/extensions/extension-deployment-service.ts), [bootstrap](../../../../app/src/main/app/bootstrap.ts) |
| 매 턴 조립한 MCP 필드를 adapter가 소비하지 않음 | `TurnExtensions.mcp`와 builder의 MCP 조회 의존 제거 | 실제 MCP 설정은 plugin 배포가 소유. 지침·skill·plugin 경로·runtime tool snapshot 유지. [builder](../../../../app/src/main/features/extensions/builder.ts), [turn](../../../../app/src/main/adapters/turn.ts) |
| Claude 단발·대화 실행에 공통 옵션 조립 반복 | 기존 adapter 변환 파일에서 settings/source/env를 SDK 타입으로 조립 | 단발 호출과 대화의 tool/hook/plugin 차이는 유지. [claude-adapt](../../../../app/src/main/adapters/claude-adapt.ts), [claude](../../../../app/src/main/adapters/claude.ts) |
| owner listener 등록 후 요청 조립 실패가 내부 `finally`를 건너뜀 | 바깥 체인 `finally`가 owner listener를 회수 | 정상 runtime idle 반납, 준비 실패 close, turn/lease 반납 의미 유지. [send](../../../../app/src/main/app/chat-turn/send.ts) |
| one-shot 소비·pump 종료·강제 해체에 채널 자원 정리가 반복 | `SessionRuntime` 내부 `retireChannel`로 handle/token/spawn 메타 종료 결집 | frame 오류 전달, drain, backlog, 구세대 차단은 기존 경로가 소유. [session-runtime](../../../../app/src/main/features/sessions/session-runtime.ts) |
| 제목 생성이 bootstrap 지역 변수로만 존재해 앱 종료에서 취소 불가 | 생성기가 진행 controller·timer와 `dispose`를 소유하고 bootstrap이 종료 때 호출 | abort를 무시한 늦은 완료도 DB 쓰기·renderer 발신 차단. 정상 제목 생성 유지. [title-generation](../../../../app/src/main/features/chat/title-generation.ts), [bootstrap](../../../../app/src/main/app/bootstrap.ts) |
| handler에 읽지 않는 넓은 context가 전달됨 | 소비자별 `Pick`/구조적 포트로 의존 축소, 미사용 auth/gate 전달 제거 | 기존 optional runtime 구성 유지. [context](../../../../app/src/main/app/context.ts), [handlers](../../../../app/src/main/app/handlers/) |
| registry의 idle eviction 예약 API가 실제로는 no-op | 죽은 생성자 인수·`evictIdle`·역사적 no-op 테스트 제거 | 실제 LRU는 pool/supervisor가 계속 소유. [registry](../../../../app/src/main/features/sessions/session-registry.ts), [pool](../../../../app/src/main/features/sessions/runtime-pool.ts) |
| 생산·소비 없는 도구 타입과 의미가 다른 동명 runtime 타입 | 미사용 계약 제거, runtime 모델 대상 이름 구분 | 실제 runtime tool 실행·설정 조회 유지. [runtime-tools](../../../../app/src/main/adapters/runtime-tools.ts), [runtime-config](../../../../app/src/main/features/harnesses/runtime-config.ts) |

동일한 미해결 환경변수가 여러 값에 등장하면 뒤의 키가 누락 판정을 피하던 문제도 수정했다.
값별 실패 판정과 보고용 중복 제거를 분리하며, 입력 객체와 정상 환경값은 보존한다. [env](../../../../app/src/main/features/harnesses/env.ts)

## 3. 반영한 성능·자원 개선의 정확한 범위

| 경로 | 줄이거나 제한한 작업 | 주장하지 않는 것 |
|---|---|---|
| 턴 확장 조립 | 소비되지 않던 MCP 설정 조회·변환·전달 제거 | 프로젝트 지침 조회까지 없애거나 settings 신선도를 캐시로 대체한 것은 아님 |
| 인증된 본문 수신 | `createSender → netFetch → sendOnce`와 cookie session 경로가 `maxBytes`를 수신 시 적용. 초과 chunk를 보관하고 전체 `Buffer.concat`을 수행하기 전에 abort | 허용 크기 본문은 여전히 모아서 반환. 후속 `Response` 변환·본문 읽기까지 무복사로 바뀐 것은 아님 |
| 제목 생성·owner listener | 앱 종료 시 요청·timer 정리, 실패한 send 뒤 불필요한 owner callback 잔존 제거 | 일반 요청의 처리시간이 줄었다는 측정 결과는 아님 |

수신 구현과 경계 테스트: [net-request](../../../../app/src/main/infra/net/net-request.ts), [net-request.test](../../../../app/src/main/infra/net/net-request.test.ts), [transport](../../../../app/src/main/infra/net/transport.ts), [browser-session](../../../../app/src/main/infra/browser-session.ts).
수신 상한은 호출자가 `maxBytes`를 지정한 요청에 적용된다. 리다이렉트는 자동 추종하지 않으며 다음 홉의 정책 판정은 기존 호출자가 수행한다.

## 4. 후속 측정 후보 — 이번에는 변경하지 않음

| 후보·실제 경로 | 입력량으로 확인한 비용 가능성 | 측정 후 가능한 최소 변경 |
|---|---|---|
| 파일 자동완성: [useFileAutocomplete](../../../../app/src/renderer/src/features/chat/hooks/useFileAutocomplete.ts) → [files handler](../../../../app/src/main/app/handlers/files.ts) → [scan](../../../../app/src/main/features/chat/scan.ts) | effect가 `match` 객체 전체에 의존. 첫 listing 응답 전 같은 dir에서 `@s → @sr`로 입력하면 캐시가 비어 있어 재요청 가능. cleanup은 응답 적용만 막고 이미 시작한 `readdir`를 중단하지 않음. 각 요청은 직속 항목 전체를 읽고 필터·정렬 | 지연된 listing 동안 동일 cwd/dir 호출 수와 디렉토리 항목 수를 측정. 문제가 확인되면 effect 의존을 실제 경로 키로 좁히거나 컴포넌트 내 진행 요청만 공유. 전역 파일 캐시는 만들지 않음 |
| 세션 로드: [queries](../../../../app/src/main/infra/db/queries.ts)의 `loadParts().all()` → [session handler](../../../../app/src/main/app/handlers/session.ts) → [DTO](../../../../app/src/main/infra/ipc/dto.ts) | 해당 세션의 모든 part row를 배열로 받은 뒤 payload를 해석해 메시지 객체를 조립. 원본 JSON과 파싱 결과, IPC 직렬화 비용이 겹칠 수 있음. renderer 가상화는 이 Main 작업을 줄이지 않음 | part 수·payload 총량별 조회/해석 시간과 메모리 최고치를 분리 측정. 부담이 확인되면 동일 결과를 만드는 row 순회부터 검토. 페이지 로딩·공개 IPC 변경은 별도 설계 |
| 사용량: [subscriber](../../../../app/src/main/features/usage/subscriber.ts) → [tracker](../../../../app/src/main/features/usage/tracker.ts) → [기간 SUM](../../../../app/src/main/infra/db/queries.ts) | 유효한 telemetry마다 `recordAndBroadcast`가 전역 월 범위와 해당 provider 범위를 다시 집계. 월 원장 행이 늘면 집계 비용도 증가 가능. 전체 provider를 매번 순회하는 구현은 아님 | 월 범위 행 수별 SQL 시간과 이벤트 처리 지연 측정, `EXPLAIN QUERY PLAN`으로 전역/provider 쿼리 확인. 측정 없이 증분 집계 캐시·상주 집계 서비스를 추가하지 않음 |
| 모델 목록: [models](../../../../app/src/main/features/harnesses/models.ts)의 `mergeAgentEnvironments` → [runtime-catalog](../../../../app/src/main/features/harnesses/runtime-catalog.ts)의 `isReadOnly` | settings 각 행마다 contributions의 `.some()`으로 canonical key 소유 여부 확인. settings 수 S, contribution 수 C에 따라 비교가 O(S×C)로 증가 가능. runtime 목록 정렬도 별도로 수행 | 목록 조회 빈도·S·C와 비교 횟수를 먼저 확인. 규모가 커지면 동일 catalog 내부 canonical key 집합으로 membership 판정. 새 registry 계층은 불필요 |

자동완성은 **이미 완료된 listing 결과의 dir별 캐시가 있다**. 문제 후보는 캐시가 채워지기 전의 중복 요청이며, 모든 키 입력이 항상 디스크를 읽는다는 뜻이 아니다.
사용량 SQL은 day/week/month를 조건부 SUM으로 묶고 월 시작을 WHERE 하한으로 사용한다. 날짜 인덱스도 있으므로 전체 과거 원장을 무조건 스캔한다고 표현해서는 안 된다. [usage migration](../../../../app/src/main/infra/db/migrations/0006_turn_usage.sql)

## 5. 유지할 경계

| 유지 대상 | 유지하는 이유 | 변경할 경우 지켜야 할 조건 |
|---|---|---|
| bootstrap 조립 루트 | feature 교차 의존을 주입으로 끊고 부팅·구독·종료 순서를 한 곳에서 연결 | 파일 길이를 줄이려고 새 서비스 계층을 추가하지 않음. usage → history → title → relay 순서 유지 |
| 작은 순수 판정 함수 | admission·respawn·env fingerprint·LRU는 별도 입력/출력과 회귀 불변식이 있음 | 이름이 비슷하다는 이유로 서로 다른 정책을 합치지 않음 |
| auth와 gate의 책임 분리 | 연결·자격증명 수명과 앱 진입 정책은 서로 다른 소비자와 실패 의미를 가짐 | 필요 없는 context 전달은 제거하되 도메인을 합쳐 기능을 없애지 않음 |
| SessionRuntime과 RuntimePool | 이벤트 프레임/채널 상태와 idle 보관·LRU는 서로 다른 수명 | 취소 뒤 채널 재사용, 구세대 차단, active 보호 유지. idle TTL을 새로 만들지 않음 |
| Chromium 원격 스택 | OS 프록시·인증서·cookie session 적용의 기존 실행 경계 | 편의상 Node fetch로 대체하거나 adapter별 독립 전송 스택을 만들지 않음 |

현재 계층 규칙은 [Main AGENTS](../../../../app/src/main/AGENTS.md), 구조 설명은 [backend overview](../../../arch/backend/overview.md)에서 확인한다.

## 6. 후속 작업의 진입 조건

후속 성능 변경은 대형 입력에서 실제 지연이나 메모리 부담이 관측될 때 시작한다.
먼저 호출 수·입력량·조회/변환/전송 단계를 나눠 측정하고, 현재 소비자 안에서 중복 작업만 줄이는 변경을 선택한다.

| 변경 후보 | 함께 보존할 회귀 |
|---|---|
| 자동완성 진행 요청 공유 | cwd 전환, stale 응답 차단, hidden 파일·경로 선택, 취소 뒤 재진입 |
| 세션 row 순회·로딩 개선 | 메시지/part 순서, 미완료 assistant 표시, lineage·usage·worktree 복원 |
| 사용량 집계 개선 | 자정/기간 경계, provider 분리, 원격 기준선 이후 월 증분, 로컬 원장 정합성 |
| 모델 소유권 membership 개선 | canonical key 충돌, runtime cache가 비어 있어도 read-only 소유권 유지, invalidate 뒤 재조회 |

SRT·cowork·OpenCode를 실제 구현할 때는 해당 실행·권한·종료 계약을 별도 검토한다.
이번 정리가 미래 기능의 호환성을 실증한 것은 아니며, 현재 정리된 소유권 경계를 그 작업의 출발점으로 사용한다.
