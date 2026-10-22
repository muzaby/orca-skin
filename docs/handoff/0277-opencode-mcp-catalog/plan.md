# OpenCode MCP 목록과 실행 상태 동기화

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-22 |
| 상태 | READY — 최종 관측 경계는 §8과 0278 §27, 기존 R1–R11 유지 |
| V mode / 기준 | Delta V / V1@256ddd24 + ΔV1 |
| 정책·실행 표면 | [0278](../0278-harness-extension-isolation/plan.md), [0280](../0280-opencode-prepared-status/plan.md) |

# Part I — Product & UX Contract

## 1. 목표·출처

nav MCP 페이지는 하네스 전역 선언을, 우측 패널은 타이틀에 표시된 현재 작업경로의 선언·실행 상태를 보여준다. 플러그인이 실행 중 추가한 MCP를 포함하고 목록 조회만으로 서버·인스턴스를 시작하거나 재초기화하지 않는다. 최초 요구 R1–R11의 관측 의미를 유지하되 nav 프로젝트 선택 UI 제안은 후속 사용자 정정으로 철회한다.

> “플러그인이 동적으로 추가한 MCP도 포함하며, 목록 표시를 위해 서버 재시작을 요구하지 않는다.”
>
> “조회 범위는 화면에 명확히 표시해야 하며, 기본 작업폴더를 숨겨서 사용하는 현재 방식은 해소한다.”
>
> “이번 범위는 MCP 목록·상태의 조회와 동기화다. 에이전트 목록 오버라이딩 표시와 MCP 설치·삭제·활성화 정책 변경은 별도 요구사항으로 관리한다.”

## 2. Decision Ledger

| ID | 결정 | 상태 / 후속 |
|---|---|---|
| D1 | 전역 선언과 실제 cwd의 선언·실행 상태 구별, 숨겨진 cwd fallback 금지 | ACTIVE; D10이 표면 확정 |
| D2 | 서버 없이 선언 표시. 기존 준비 인스턴스에서만 실행 상태 읽기 | ACTIVE |
| D3 | 동적 MCP 포함, plugin 자체와 MCP 구별. 모르는 제공 plugin 추정 금지 | ACTIVE |
| D4 | 같은 조회 범위·이름은 병합하고 runtime 상태 우선, 다른 cwd 상태는 격리 | ACTIVE |
| D5 | 진입·해당 작업경로 전환·준비·상태 변경·수동 새로고침에 갱신 | ACTIVE; page/panel만, composer popup에는 새로고침 없음 |
| D6 | 조회 실패·부분 실패·빈 성공을 구분하고 정상 항목 유지·재시도 제공 | ACTIVE; page/panel |
| D7 | 종료 세대의 connected 제거, 이전 scope/generation의 응답 폐기 | ACTIVE |
| D8 | 실제 선언 파일 근거가 있을 때만 열기. 설정 경로·인증·토큰을 목록/오류로 보내지 않음 | ACTIVE |
| D9 | 설치·삭제·활성화 정책과 agent 선택은 다른 plan 소유 | ACTIVE; 0278·0281 |
| U1 | nav에 전역/프로젝트 드롭다운을 제안 | SUPERSEDED → D10. 사용자에게 재질문하지 않음 |
| U2 | nav에서 같은 cwd의 복수 profile을 선택하거나 묶어 표시하는 제안 | SUPERSEDED → D10. nav는 runtime 집계 표면이 아님 |
| D10 | nav는 각 하네스 전역, 프로젝트 상태는 기존 우측 패널의 현재 cwd·실행 구성 | ACTIVE; 0278 D23 |
| D11 | 팝업 오류/안내/새로고침 금지와 에이전트 제목 스피너 예외는 0281이 소유 | ACTIVE; MCP 페이지·패널의 상태·재시도 계약과 구분 |

ACTIVE↔AC: D1/10→AC1, D2→AC2/3/9, D3→AC4, D4→AC5, D5→AC6, D6→AC7, D7→AC8/10, D8→AC11, D9/11→범위 경계다. 별도 프로젝트 선택 UI를 다시 만들지 않는다.

## 3. 동작·상태

| 표면 / 사건 | 결과 |
|---|---|
| nav 진입 | 하네스 전역 선언·native 상태·SDK capability만 읽음. 임의 작업폴더 실행 상태를 합치지 않음 |
| 우측 패널 진입·대화 경로 전환 | 실제 cwd 및 해당 실행 구성으로 선언 조회. 이미 준비된 native instance가 있으면 runtime 병합 |
| 먼저 패널 진입, 이후 OpenCode 준비 | 준비 완료를 관측해 동적 MCP 반영. 패널 자체는 준비 owner를 만들지 않음 |
| 파일 성공·runtime 부재 | 설정됨/비활성. 서버 부재는 오류가 아님 |
| 한 출처 실패 | 정상 항목 유지, 부분 실패·재시도 제공. 이전 runtime 결과는 마지막 확인 정보로만 표시 |
| 성공한 빈 결과 | 해당 출처의 이전 행 제거. 다른 정상 출처 보존 |
| 종료·서버 교체 | 이전 연결됨 제거, 선언 행은 설정됨/비활성. runtime-only 현재 행 제거 또는 마지막 확인으로 명시 |
| 늦은 응답 | backend/cwd/profile/generation/request epoch가 맞는 결과만 반영 |

조회 중은 조회 상태, 설정됨·연결됨·비활성·인증 필요·실패는 MCP 상태다. 마지막 확인 정보와 부분 실패를 현재 연결 상태로 승격하지 않는다. 프로젝트 범위 표시는 기존 패널 타이틀로 충분하며 별도 안내를 추가하지 않는다.

## 4. R1–R11 추적·인수 기준

| 원 요구 / AC | 최종 표면·동작 | 직접 검증 |
|---|---|---|
| R1 / AC1 | nav global-only, 패널 실제 cwd. 전역·프로젝트·실행 출처 구분 | 서로 다른 global/A/B 파일→등록 IPC→reader/SDK directory 인자→각 화면 |
| R2 / AC2 | 서버 없이 설정된 MCP 표시 | 임시 JSONC의 enabled/disabled 선언→실제 reader→설정됨/비활성 |
| R3 / AC3 | 패널의 기존 준비 instance 상태와 선언 병합 | 실제 기존 client 요청을 관측하며 spawn/acquire/prepare/dispose sink 무호출 |
| R4 / AC4 | config hook/runtime add의 동적 MCP 표시, plugin 행과 분리 | 실제 CLI fixture가 추가한 MCP→SDK→패널. 파일 없는 동적 항목도 포함 |
| R5 / AC5 | 같은 범위·이름 단일 행, runtime 우선. A connected/B failed 분리 | scope별 fixture·실제 query 전달·패널 전환. 같은 cwd의 다른 profile 결과를 무조건 합치지 않음 |
| R6 / AC6 | nav 진입·패널 cwd 변경·instance ready·status 변경·page/panel 수동 갱신 | 선진입→준비 push/재조회, 변경·재시도·요청 합류. popup refresh는 없음 |
| R7 / AC7 | 파일 오류/runtime 오류/양쪽 오류/부분 성공/빈 성공 구별 | 정상 항목 유지·오류·재시도 렌더. 오류를 빈 목록으로 바꾸면 실패 |
| R8 / AC8 | instance/server 종료 뒤 이전 connected 제거 | 마지막 실행 owner 종료·process exit·관측 owner cleanup |
| R9 / AC9 | 관측은 실행을 시작/재시작/변경하지 않음 | nav/패널 진입·새로고침·A→B 동안 기존 대화 정상 완료, SDK mutation·새 owner 없음 |
| R10 / AC10 | 전환·교체 후 이전 결과 폐기 | A 지연→B 응답→A 완료, 이전 server→새 generation 역순 |
| R11 / AC11 | 동적 MCP에 가짜 파일 열기 없음; 민감정보 비노출 | main file 재탐색·삭제 경합, 응답·오류 credential/path sentinel 부재 |

초기 nav 선택기 경로만 SUPERSEDED하며 R1–R11 자체를 폐기하지 않는다. MCP 상태·retry 표면은 composer 팝업 금지 규칙의 대상이 아니다. 공통 활성화 정책과 저장 방식은 0278을 따르고 본 관측 설계에서 새로 결정하지 않는다.

# Part II — Technical Design

## 5. AS-IS → TO-BE

| 경계 | 현재 구현·근거 | 목표·검증 잔여 |
|---|---|---|
| 전역 조회 | extension-catalog handler→harness globalResources→useNativeMcpCatalog | global-only·부분 오류·재시도, runtime 조회 혼입 없음 |
| 프로젝트 관측 | session-resources + prepared composer resource 경로(0280) | 실제 cwd·profile·generation으로 configured/runtime 병합. native 프로젝트 파일의 설정 선택과 현재 실행 상태 구분 |
| native 요청 | v1.17.19 middleware는 요청 시 instance load 가능 | 준비된 기존 handle만 사용하고 closing/종료 전후 검사 |
| native 상태 변화 | 모든 add/connect/disconnect에 공통 이벤트가 있다고 보장 못 함 | 기존 push·제어 완료·준비 신호와 관측 갱신을 대조; 누락 시 보이는 panel에 한정한 polling 비용 검증 |
| renderer | nav와 panel이 서로 다른 소비 경로 | 요청 epoch·정상 부분 캐시·종료 무효화·capability 일관 |

OpenCode 프로젝트 파일은 [0278 ΔV2](../0278-harness-extension-isolation/plan.md)에 따라 외부 CLI/Desktop과 공유한다. 외부 파일의 생성·편집·삭제·원자 rename은 선언 목록과 희망 상태에 먼저 반영하며, 실제 연결 상태는 SDK 관측으로만 갱신한다. 관측 자체는 파일 쓰기·서버 시작·재초기화를 하지 않으며 runtime 적용은 0278의 전체 cwd 유휴·기존 회수 정책을 따른다.

기존 5초/10초 polling 제안은 확정 사용자 정책이 아니다. 구현의 실제 event·poll 동작으로 R6을 만족하는지 먼저 확인하고, 주기·예산은 요청량과 ready 상태 비용을 측정해 기술 설계에 잠근다. 재조회가 native 초기화를 유발할 수 있는 경합은 별도 실패로 기록한다.

## 6. ΔV1 — 기존 scope UI 경로 대체

기준 V1@256ddd24의 nav scope control은 D10으로 SUPERSEDED다. 해당 AC·부분 실패·지각 응답·동적 MCP 증거는 아래 page/panel 경로로 이관하며 삭제하지 않는다. 통합 구현은 존재하지만 자리별 직접 oracle의 최종 잠금 전까지 READY로 표시하지 않는다.

| Pair | 노드 / 상태 / requiredness | 경로·예정 oracle |
|---|---|---|
| DV1-P1 | R1–R11↔AT1–AT11 CHANGED REQUIRED | nav global reader + cwd panel→SDK→행; 위 AC 구별 입력 |
| DV1-P2 | SD1↔ST1 CHANGED REQUIRED | 준비 완료→기존 client 관측→마지막 owner 종료; session-context.test.ts·instance-lifecycle.test.ts의 기존 실제 transport 경로 확장 |
| DV1-P3 | AR1/AR2↔IT1/IT2 CHANGED REQUIRED | extension-catalog / session-resources→preload→nav hook/NativeResourcesTile; 실제 handler와 renderer 테스트 |
| DV1-P4 | MD1/MD2↔UT1/UT2 INHERITED REGRESSION | configured-resources 임시 파일·부분 merge·epoch·generation·동명 격리 |
| V1 VP7 | SD0↔ST0 INHERITED REGRESSION | 0275 startup/owner 정리·0276 independent catalog·0280 첫 입력 전 상태 |

### §10 강제 경계와 oracle 연결

| 경계 | 자리 | 직접 결과 |
|---|---|---|
| 범위 전달 | shared request/schema, preload/API, extension-catalog handler, session-resources handler, native reader, existing context lookup | AC1/3/5의 서로 다른 global/A/B/profile 실제 값 |
| 수명 | ready, dirty event/재조회, closing, process exit, renderer release | AC6/8/9/10의 늦은 결과·connected 해제·기존 대화 지속 |
| 표시 | useNativeMcpCatalog→CustomizeList, prepared resources→패널 row | AC2/4/7/11의 선언/동적/부분 실패·열기 capability |
| 파일 열기 | globalResourcePath/configured file lookup→shell | 파일 존재·scope 재검증, runtime-only shell 무호출 |

검색: `rg -n 'nativeResources|configuredResources|globalResources|composerCatalog|canOpen' app/src/main/app app/src/main/adapters app/src/preload app/src/renderer/src/features/skills app/src/renderer/src/features/chat`. 최종 자리 분모·테스트명은 통합 경로 재열거로 잠근다. 코드를 읽었거나 인접 테스트가 통과했다는 사실만으로 R1–R11을 완료로 세지 않는다.

## 7. 운영 gate·남은 일

문서 변경은 relative links·inventory/prose·diff·INDEX를 검사한다. 후속 구현·검증에서는 app subtree gate와 실제 native dynamic MCP·scope 전환·ready/closing 경합을 확인한다. 외부 커스텀 바이너리·실제 창 시각 인수는 확인한 환경과 분리한다.

미확정은 관측 경계·증거·poll 기술값이며 nav 선택 UI가 아니다. 저장은 0278 ΔV2 D30의 네이티브 프로젝트 파일로 확정됐으며 U6를 재질문하지 않는다. 과거 scope 선택 제안·READY 문구는 이 ΔV1으로 대체되며 원문은 기준 commit에서 확인한다.

## 8. READY — 관측 경계 잠금

0278 §27 FEP1·2·7·8·10·12를 승계한다. 아래 자리별 실제 경로와 oracle을 DV1-P1–4 및 V1 VP7의 구현/회귀 집합으로 고정한다. 기존 §6의 ‘최종 잠금 필요’는 이 절로 대체한다.

| 자리 | 직접 oracle와 입력/결과 |
|---|---|
| global IPC→native reader→nav hook/list | `extension-catalog.test.ts`·`configured-resources.test.ts`·`useNativeMcpCatalog.test.ts`: 서버 없이 global 선언, A/B 값 제외, partial 이전 정상값 유지 |
| session/draft IPC→기존 준비 context→MCP/native plugin | `session-resources.test.ts`·`opencode/v1/adapter.test.ts`·`session-context.test.ts`: 첫 메시지 전 준비 완료, runtime-only MCP와 선언 병합, scope/generation 전환 |
| observer ready/dirty/closing→패널 | `project-resource-sync.test.ts`·`nativeResourceState.test.ts`: 실제 파일 revision, A/B 역순 결과·종료 후 connected 제거·server 생성 무호출 |
| preload/API→query scope | `preload/index.test.ts`·위 등록 IPC 테스트: 원래 cwd/session 식별자 보존 |
| source file lookup→shell | `session-resources.test.ts`·`extension-catalog.test.ts`: 실제 파일만 열기, dynamic MCP에는 shell 무호출 |

변경된 허용 capability는 0278 D32를 따른다. 관측/read와 mutation은 분리해 readonly 항목도 목록에서 제거하지 않는다. 코드·기존 테스트의 경로를 확인했으며 구현 후 위 직접 oracle로 R1–R11을 재검증한다. 이것은 독립 검증 PASS가 아니다.
