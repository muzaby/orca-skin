# OpenCode MCP 목록과 실행 상태 동기화

## 메타

| 항목 | 값 |
|---|---|
| slug | 0277-opencode-mcp-catalog |
| 작성자 | Codex |
| 일자 | 2026-10-21 |
| 상태 | DRAFT — UI 결정 및 기존 인스턴스 전용 조회 경계 확정 전 |
| V mode / 기준 / revision | Baseline V / 없음 / V1 초안 |

# Part I — Product & UX Contract

## 1. 목표

nav → 플러그인 → MCP에서 전역 또는 명시한 작업폴더의 설정 선언과 실제 실행 상태를 함께 확인한다. native 플러그인이 추가한 MCP도 포함하며 목록 조회 때문에 OpenCode 서버나 directory 인스턴스를 시작·재초기화하지 않는다.

## 2. 사용자 요구

이번 사용자 메시지의 R1–R11과 인수 기준이 요구 출처다. 아래 조건을 그대로 유지한다.

> “플러그인이 동적으로 추가한 MCP도 포함하며, 목록 표시를 위해 서버 재시작을 요구하지 않는다.”
>
> “조회 범위는 화면에 명확히 표시해야 하며, 기본 작업폴더를 숨겨서 사용하는 현재 방식은 해소한다.”
>
> “이번 범위는 MCP 목록·상태의 조회와 동기화다. 에이전트 목록 오버라이딩 표시와 MCP 설치·삭제·활성화 정책 변경은 별도 요구사항으로 관리한다.”

이전의 팝업 상태 안내 금지는 OpenCode composer 선택 메뉴에 대한 결정이다. 이번 nav MCP 페이지에는 사용자가 R7에서 요청한 조회·오류·부분 실패 상태를 적용하며 composer 결정은 변경하지 않는다.

2026-10-22 사용자가 두 하네스의 Orca 전역 기본값·프로젝트 단위 제어·외부 실행 설정 격리 정책을 확정했다. 활성화 정책의 정본은 [0278](../0278-harness-extension-isolation/plan.md)이며, 본 작업은 그 기본값·capability를 관측 계약에 연결한다. 전역 설정 관리 위치와 프로젝트별 실행 상태 조회 UI는 구별하며 U1/U2가 모두 해소된 것으로 처리하지 않는다.

## 3. Decision Ledger

| ID | 결정 / 출처 | 상태 |
|---|---|---|
| D1 | 전역 설정과 실제 작업폴더의 설정·실행 상태를 구별한다. 숨겨진 cwd fallback 금지 — R1 | ACTIVE |
| D2 | 서버 없이 설정 선언을 표시하고 실제 기존 인스턴스에서만 실행 상태를 읽는다 — R2·R3·R9 | ACTIVE |
| D3 | 동적 MCP를 포함하고 plugin 자체와 MCP 항목을 구별한다. 알려지지 않은 제공 plugin 이름은 추정하지 않는다 — R4 | ACTIVE |
| D4 | 동일 범위의 동명 MCP를 하나로 병합하며 runtime 상태 우선. 다른 폴더는 격리 — R5 | ACTIVE |
| D5 | 페이지 진입·범위 변경·준비 완료·상태 변경·수동 새로고침으로 갱신 — R6 | ACTIVE |
| D6 | 조회 상태·MCP 상태·부분 실패를 구별하고 실패를 빈 성공으로 바꾸지 않음 — R7 | ACTIVE |
| D7 | 종료한 세대의 연결됨 표시 제거, 늦은 응답 폐기 — R8·R10 | ACTIVE |
| D8 | 파일 근거가 있는 항목만 파일 열기 제공. 경로·인증·토큰은 목록/오류에 노출하지 않음 — R11 | ACTIVE |
| D9 | 설치·삭제·활성화 정책과 composer agent 표시는 범위 밖 — 사용자 범위 문장 | ACTIVE |
| U1 | 조회 범위 UI: 상단 전역/프로젝트 선택 + 현재 범위 표시(권장), 또는 현재 대화 폴더 추종 | OPEN — 질문 전달 |
| U2 | 같은 폴더의 복수 실행 설정: MCP 한 행 아래 엔진별 상태(권장), 또는 조회 엔진 선택 | OPEN — 질문 전달 |

U2가 필요한 근거: 서버 pool은 executable/config/env identity별로 분리된다. 같은 cwd·MCP 이름이어도 다른 서버에 연결될 수 있어 연결 상태 하나를 임의 선택하면 R5의 실제 상태 의미가 깨진다.

## 4. 비판적 검토

| 쟁점 | 조사 결과 / 설계 방향 |
|---|---|
| 현재 nav 목록 | `useNativeMcpCatalog`는 `{cwd:null,projectId:null}` draft 조회를 mount에서만 수행. rejected 결과를 빈 배열로 치환한다 |
| 실행 상태 누락 | draft IPC는 configured resources와 commands만 읽는다. session 조회에 있는 live merge 경로로 진입하지 않는다 |
| 파일 없는 행 클릭 | `CustomizeList`의 native MCP 행은 모두 설정 파일 열기로 연결되어 있다. runtime-only 행에는 capability가 필요하다 |
| native 동적 목록 | 1.17.19 `MCP.status`는 `cfg.mcp`와 `state.config`를 병합한다. `MCP.add` 항목도 조회 가능하다 |
| 상태 이벤트 한계 | native schema에는 tools changed/browser open failed 이벤트가 있다. add/connect/disconnect에 공통 상태 변경 publish가 없어 이벤트만으로 전체 상태 동기화를 보장할 수 없다 |
| 조회의 부작용 | native InstanceContext middleware가 `store.load(directory)`를 호출한다. 실행 중 서버 URL만 알고 `/mcp`를 호출하면 없는 directory 초기화가 발생할 수 있다 |
| 서버 소유권 | 기존 `acquire`는 부재 시 spawn하며 owner를 늘린다. nav 조회에 사용하지 않는다. 관측 구독이 서버를 계속 살려 두어서도 안 된다 |

## 5. 사용자 흐름과 상태

```text
MCP 페이지 진입 → 명시 범위 결정 → 파일 선언 읽기
                            └→ 준비된 기존 실행 인스턴스가 있으면 MCP 상태 읽기
파일/실행 결과 각각 반영 → 같은 범위·이름으로 병합 → 상태와 출처 표시
범위 전환/종료 → 기존 요청 무효화 → 새 범위 또는 설정만 남은 상태
```

권장 UI는 MCP 목록 위의 범위 선택과 새로고침이다. 최초 범위는 전역이며 프로젝트 선택 시 해당 프로젝트의 실제 cwd를 확인해 표시하는 안이다. 프로젝트 밖 대화·worktree의 실제 폴더도 조회 대상에서 빠지지 않도록 선택 목록/폴더 선택 방식을 U1 답변과 함께 확정한다.

| 상황 | 관측 결과 |
|---|---|
| 전역 | 전역 설정 선언만 표시. 특정 폴더 runtime 상태를 전역 연결 상태로 승격하지 않음 |
| 프로젝트 | 전역에서 상속된 선언과 프로젝트 선언을 구별하고 해당 실제 cwd의 runtime을 병합 |
| 최초 조회 | 조회 중을 표시하며 먼저 성공한 파일/실행 결과부터 반영 |
| 재조회 | 확인된 행을 유지하며 중복 요청 합류. 부분 실패는 해당 출처와 재시도 수단 표시 |
| 파일 성공·runtime 부재 | 설정됨/비활성. 실행 중이 아님을 실패로 표시하지 않음 |
| 파일 실패·runtime 성공 | runtime 행 유지, 설정 조회 부분 실패 표시 |
| runtime 실패 | 마지막 성공 결과를 보존하되 현재 연결을 확인한 것으로 표현하지 않음. 마지막 확인 정보임을 표시 |
| native 종료 | 설정 행은 설정됨/비활성으로 복귀. runtime-only 현재 행은 제거하는 안. 과거 연결됨을 현재 배지로 유지하지 않음 |
| 성공한 빈 결과 | 해당 출처의 이전 항목을 제거. 다른 출처의 정상 항목은 유지 |
| 다른 범위/세대의 늦은 응답 | 현재 목록에 적용하지 않음 |

`조회 중`은 조회 상태, `설정됨/연결됨/비활성/인증 필요/실패`는 MCP 상태다. `부분 실패`와 `마지막 확인`은 최신성 정보로 분리해 불가능한 단일 enum 조합을 만들지 않는다. R11의 설정 파일 경로 비노출과 실제 작업폴더 범위 표시는 다른 대상으로 구별한다.

## 6. 범위

OpenCode MCP의 조회·병합·현재 상태·갱신·수명·범위 UI와 안전한 파일 열기 capability가 범위다. 본 작업에서 토글 정책을 독자적으로 변경하지 않으며 공통 활성화·격리는 [0278](../0278-harness-extension-isolation/plan.md)의 결정을 따른다. 동적 MCP를 표시하려고 plugin 코드를 별도 import하거나 설치하지 않는다.

## 7. R ↔ AT / 인수 기준

| 요구 | AT / AC | 관측할 동작 / 직접 oracle 후보 |
|---|---|---|
| R1 | AT1 / AC1 | 전역에 프로젝트 선언 미포함, A 조회에 실제 A cwd 전달, 숨겨진 default cwd 사용 안 함. scope UI→IPC→파일 reader/기존 client 통합 |
| R2 | AT2 / AC2 | 서버 없는 global/A 설정의 enabled/disabled 선언이 설정됨/비활성으로 표시. 임시 JSONC 파일 fixture→실제 reader→row |
| R3 | AT3 / AC3 | 기존 A 인스턴스의 MCP 상태를 파일 목록과 병합. prepare/spawn/dispose sink를 실패시키는 대조 조건에서도 조회 성공 |
| R4 | AT4 / AC4 | config hook 및 runtime MCP.add의 파일 미선언 MCP 표시. plugin 자체가 MCP 행에 섞이지 않음. 실제 CLI fixture + SDK 통합 |
| R5 | AT5 / AC5 | configured/live 동명은 하나, runtime 우선. A connected/B failed가 섞이지 않음. 복수 profile 표현은 U2 확정 필요 |
| R6 | AT6 / AC6 | 페이지 먼저 열기→서버/instance 준비 후 자동 반영. 상태 변경·범위 변경·수동 새로고침에 갱신. 중복 요청 합류 |
| R7 | AT7 / AC7 | 파일 오류·runtime 오류·양쪽 오류·부분 성공·빈 성공을 구별. 기존 항목 유지·부분 실패·재시도 표시 |
| R8 | AT8 / AC8 | 마지막 실행 owner 종료/프로세스 exit에서 connected 제거. 관측 화면이 서버 수명을 연장하지 않음 |
| R9 | AT9 / AC9 | nav 진입/새로고침/A→B 동안 진행 대화가 정상 완료. 새 서버·새 instance·MCP connect/disconnect mutation 없음 |
| R10 | AT10 / AC10 | 느린 A 결과/B 진입, old server 응답/new server 결과 역순에서 현재 scope/generation만 반영 |
| R11 | AT11 / AC11 | 동적 항목은 파일 열기 없음. 선언 파일 삭제/교체 시 main 재검증. 응답·오류에 fixture credential/path가 포함되지 않음 |

위 표는 사용자 인수 의미를 보존한 초안이다. U1/U2와 T1을 확정하기 전에는 구현 가능한 READY로 판정하지 않는다.

## 7-A. Baseline V 초안

노드: R1–R11/AT1–AT11 NEW. SD1/ST1(관측 수명) NEW, AR1/IT1(IPC→파일·runtime 조립) NEW, AR2/IT2(목록 UI/구독) NEW, MD1/UT1(병합/상태) NEW, MD2/UT2(scope/generation/요청 합류) NEW. SD0/ST0(기존 OpenCode 세션·composer 소유권)은 현재 구현에서 INHERITED.

| pair | 노드 / requiredness | 경로와 직접 검증 후보 |
|---|---|---|
| VP1 | R1–R11↔AT1–AT11 REQUIRED | 사용자 scope→실제 IPC 조립→reader/SDK→페이지, §7 각 구별 입력 |
| VP2 | SD1↔ST1 REQUIRED | 이미 준비된 native directory→nav 구독→MCP 요청→마지막 owner 종료. 신규 adapter MCP observation 통합 |
| VP3 | AR1↔IT1 REQUIRED | bootstrap 등록→전용 query/event/release IPC→main 범위 해석→adapter/file reader. Electron IPC 경계만 대역 |
| VP4 | AR2↔IT2 REQUIRED | 실제 preload/renderer API→hook→CustomizeList. 두 범위·부분 실패·동적 capability·키보드 검사 |
| VP5 | MD1↔UT1 REQUIRED | 선언/실행 snapshot→merge→status/provenance/capability. 임시 파일과 서로 다른 fixture 값 |
| VP6 | MD2↔UT2 REQUIRED | subscribe/query epoch→늦은 응답/종료/dirty event→부분별 cache. 지연 promise와 fake timer |
| VP7 | SD0↔ST0 REGRESSION | `adapter.startup.test.ts`의 draft 준비/첫 입력, `instance-lifecycle.test.ts`의 마지막 owner 정리, `session-context.test.ts`의 공유 SSE·폴더 격리 |

직접 oracle의 최종 파일·테스트 이름·입출력 경계와 §10 자리별 매핑은 U1/U2/T1 해소 후 고정한다. 새 structural proxy oracle은 선택하지 않는다. AC9의 부재 주장은 실제 spawn/instance-acquire/mutation sink를 관측하는 통합 경로와 진행 대화 정상 완료를 함께 단언해야 한다.

# Part II — Technical Design

## 8. 현재 코드와 native 근거

| 대상 | 확인한 코드 / 의미 |
|---|---|
| `skills/hooks/useNativeMcpCatalog.ts` | mount-only Promise.allSettled, null cwd/projectId, 실패→빈 배열 |
| `app/handlers/session-resources.ts` | draft는 파일/commands 조회. live 병합은 sessionId 경로에 있음 |
| `app/bootstrap.ts` | draft callback에서 `cwd ?? ctx.getCwd(projectId)` fallback |
| `opencode/v1/configured-resources.ts` | JSONC 파일 읽기·선언 파일 map 존재. MCP 읽기에 plugin 설치/skill 탐색도 결합되어 있음 |
| `opencode/v1/native-resources.ts` | `/mcp`와 `/config`를 Promise.all. MCP 전용 조회는 config/plugin 탐색과 분리 가능 |
| `opencode/v1/session-context.ts`, `instance-lifecycle.ts` | 소유 generation·directory·abort 존재. `touched`는 요청 시작 표식이므로 준비 완료 증거가 아님 |
| `opencode/v1/server.ts` | `acquire`는 부재 시 spawn. nav용 existing-only 관측 포트 없음 |
| `CustomizeList.tsx` | 모든 native MCP 행 클릭은 파일 열기, runtime 상태 배지 없음 |
| native v1.17.19 `packages/opencode/src/mcp/index.ts` | `status`가 cfg.mcp/state.config를 열거. `add`가 state.config에 저장. 최초 status의 InstanceState 초기화는 MCP 연결을 시작할 수 있음 |
| native v1.17.19 `packages/schema/src/mcp-event.ts` | tools changed/browser open failed 정의. 공통 status changed 이벤트를 가정하면 안 됨 |
| native v1.17.19 `packages/app/src/context/server-sync.tsx` | MCP query key는 server scope+directory. `loadMcpQuery`는 sdk.mcp.status 사용 |
| native v1.17.19 `.../middleware/instance-context.ts` | 요청에 대해 InstanceStore.load(directory) 수행. 조회도 bootstrap 가능 |

native 근거는 `app/.temp/opencode`의 HEAD가 아닌 `git show v1.17.19:<path>`로 확인했다. 현재 파일 discovery의 전역/프로젝트 순서·환경변수 처리 전체를 native와 동일하다고 가정하지 않는다.

## 9. 목표 구조

- **파일 reader**: MCP 선언만 읽는 경로를 분리한다. global/project 범위를 명시적으로 입력받고 파일별 결과·오류·출처를 반환한다. 설정 오류 하나로 다른 정상 파일 목록을 지우지 않는다. 실제 file path와 raw config는 main에만 둔다.
- **실행 observer**: 기존 adapter/session-context에 준비 완료가 확인된 directory의 안전한 관측 handle과 invalidation 구독을 제공한다. nav가 일반 acquire/prepare/ready를 호출하지 않는다. active owner가 사라지면 조회를 취소하고 연결 상태를 무효화한다.
- **main 조립**: 선언과 runtime을 독립 비동기 조회하고 scope/profile/generation별로 병합한다. config/get·commands·agents·plugin import는 MCP 상태 조회의 선행 조건으로 추가하지 않는다.
- **transport**: nav 전용 typed query/watch/release 경로를 검토한다. 기존 session-nativeResources의 토글·composer 계약을 확장 목적 없이 바꾸지 않는다. 응답은 안전한 이름·상태·출처·capability·최신성만 포함한다.
- **renderer**: scope 전환마다 request epoch를 교체한다. scope별 마지막 정상 결과를 유지하고 현재 화면 구독이 없는 polling은 중단한다. 새로고침과 자동 갱신은 동일 flight에 합류한다.

## 10. 강제 지점 후보와 조사 잔여

| EP | 준비 시 전수 열거할 자리 | 직접 oracle 방향 |
|---|---|---|
| EP1 범위 | scope 선택; preload/query schema; main scope resolve; file reader; runtime handle lookup; 파일 열기 재검증 | 서로 다른 전역/A/B 파일과 실제 SDK directory 인자·열기 capability |
| EP2 관측 수명 | adapter 등록; directory 준비 완료; SSE 상태 힌트; directory closing; server exit; app shutdown | 페이지 선진입 후 prepare, owner 종료, 프로세스 exit에 따른 상태 전이와 정상 대화 |
| EP3 병합 | 파일별 선언; inline 실행 설정 출처; runtime 상태; 부분 오류; empty; 종료 | 동명/서로 다른 status/일부 파일 parse 실패/동적 항목 fixture |
| EP4 동기화 | page entry; scope change; ready; event; poll; manual; hide/unmount; window gone | dirty-event coalesce·요청 역전·late reject·poll 중단 |
| EP5 표시/보안 | 목록 행; 상태/부분 오류; 새로고침; 파일 열기 capability; main 오류 DTO | 실제 renderer와 preload/handler, credential sentinel·없는 경로 open 금지 |

이 목록은 후보이며 분모 잠금 전이다. 검색 진입점은 `rg 'useNativeMcpCatalog|nativeMcp' app/src/renderer/src/features/skills`, `rg 'nativeResources|configuredMcpFile' app/src/main/app`, `rg 'acquire|release|disposed|close|fetchScoped' app/src/main/adapters/opencode/v1`이다. 신규 포트 배선과 기존 소비처 전수를 확인한 뒤 자리별 테스트 좌표 및 개수를 확정한다.

## 11. 비동기·재조회·오류 설계안

1. 초기 file/runtime 조회는 서로 기다리지 않는다. 동일 scope·profile·generation의 runtime 요청은 하나의 진행 요청으로 공유한다.
2. native tools changed 및 Orca가 관측한 준비/종료 이벤트에서 dirty 처리한다. 조회 중 dirty가 생기면 완료 뒤 한 번 재조회하여 중간 변경을 놓치지 않는다.
3. 공통 상태 이벤트가 없는 native 버전을 보완하려면 **보이는 MCP 페이지 + 준비된 instance**에만 제한된 polling을 둔다. 10초 주기, 실패 시 최대 60초로 backoff하는 안이며 READY 전 native 비용 실측과 함께 확정한다. 페이지 focus·수동 새로고침은 즉시 요청을 병합한다.
4. runtime 조회 예산 만료는 그 요청만 실패 처리한다. 다른 scope/세션·서버에 cancel/dispose를 전파하지 않는다. 초기 native MCP 연결 대기가 긴 경우 file 목록을 먼저 표시한다.
5. watcher는 실행 owner가 아니다. 마지막 실행/준비 owner가 종료되면 polling·진행 HTTP를 멈추며 native 종료를 가로막지 않는다.
6. 기존 generation이 종료되거나 교체되면 관측된 연결 상태를 제거한다. 조회 실패만으로 종료를 추정하지 않으며 마지막 확인 정보와 부분 실패를 표시한다.

## 12. READY 전 닫을 항목

| ID | 남은 결정/증거 | 처리 |
|---|---|---|
| U1 | 프로젝트/실제 작업폴더 선택 방식 및 프로젝트 밖 폴더 접근 | 사용자 선택 대기 |
| U2 | 동일 폴더 복수 runtime profile 상태 표현 | 사용자 선택 대기 |
| T1 | native instance 없는 상태에서 `/mcp`가 초기화할 수 있음. 준비 완료·closing·external dispose 경합을 existing-only 경계로 막을 수 있는지 | 실제 CLI로 미준비/준비/종료 경합 probe. 보장 불가한 native 제약은 숨기지 않고 요구 보완 여부 확인 |
| T2 | 상태 이벤트 누락 및 poll 간격/요청 예산 | native dynamic add/disconnect·느린 MCP로 관측. 이벤트 우선+bounded polling의 비용 확인 |
| T3 | 전역 파일 집합·프로젝트 상속·실효 env/engine inline config의 출처 규칙 | native Config의 실제 탐색/우선순위와 현재 reader 대조, 파일별 partial 계약 확정 |

## 13. 검증과 운영 gate

구현 시 lint·node/web/test typecheck·관련 Vitest·Electron ABI 유지 build·문서 inventory/links·git diff/trailer를 수행한다. 실제 CLI 1.17.19에서 config hook/runtime add MCP, A/B 동명 상태, 페이지 선진입 후 준비, 마지막 owner 종료, 지속 대화를 포함한 probe가 필요하다. UI는 두 테마·좁은 폭·키보드 범위 선택/새로고침을 확인한다.

현재 턴은 코드와 native source 조사만 수행했다. 테스트 통과나 성능 개선을 주장하지 않는다. 수정 문서는 이 plan과 dispatch INDEX이며 두 곳 모두 plan/DRAFT로 유지한다.

## 14. 정합성·다음 단계

ACTIVE D1→AC1, D2→AC2/3/9, D3→AC4, D4→AC5, D5→AC6, D6→AC7, D7→AC8/10, D8→AC11, D9→§6을 대조했다. 사용자 요구를 반대로 바꾼 행은 없으며 U1/U2/T1–T3 미확정 사항을 ACTIVE 결정처럼 적용하지 않는다. UI 답변과 실행 경계 실증 뒤 V/§10을 확정하고 READY로 전환한다.

## [구현자 기입]

미착수. 사용자 초안 검토·설계 단계다.
