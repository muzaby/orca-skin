# Plan — OpenCode 실행 수명과 Composer

## 메타

| 항목 | 값 |
|---|---|
| slug | 0268-opencode-runtime-composer |
| 작성자 | Codex — 사용자 직접 구현 요청에 따른 설계·구현 |
| 일자 | 2026-10-20 |
| 상태 | READY |
| V mode / 기준 / revision | Baseline V / 없음 / V1 |
| 기준 코드 | `830df4bb` — 원격 `codex-harness-entry-menu` 리베이스 완료 |

# Part I — Product & UX Contract

## 1. 목표

OpenCode의 세션 시작에서 중복 작업을 줄이고, Claude와 같은 런타임 LRU에 실제 서버 자원을 연결한다.
상태 패널·파일·링크 열기와 플러그인 에이전트 선택이 실제 실행 상태에 맞게 동작하게 한다.
0267의 기존 메뉴 요구는 유지하며 이번 새로운 실행 수명·파일 동작은 별도 핸드오프로 추적한다.

## 2. 요구 출처

2026-10-20 라이브 사용자 요청:

- “원격브랜치의 커밋으로 리베이스하라.”
- “opencode 세션 동작시 opencode의 윈도우즈 알림(토스트) disable” — 발신 앱은 **OpenCode**로 확인.
- “opencode 세션에서 상태 패널을 활성화 시 기존 작업 패널 공간 위에 열려야 한다. 변경 사항 패널 동작을 참고하라.”
- “nav -> 플러그인 -> mcp 탭에서 그룹간 간격 마진을 스킬 탭과 똑같이 구현하라. 또한 로고 표시도 컬러로 변경하라”
- “opencode 세션 시작시 병목이 의심된다”, “LRU 정책에 의해 자원 회수가 되는지 점검하고 claude와 똑같이 자원회수 정책을 가지도록 하라.”
- “opencode 데스크톱에서 세션을 만드는것 처럼 병목이 없어야 한다.”
- “transcript에 출력되는 산출물 카드 및 컨텍스트에서 나열되는 항목들에 대해 제품 내부적으로 포맷 지원을 하지 않는 경우 디폴트로 해당 파일의 위치로 탐색기를 실행하라.”
- “transcript에서 출력되는 링크, http(s) 등에 대해 os 기본 브라우저로 실행하도록 한다.”
- “opencode의 경우 네이티브 플러그인에 의해 에이전트 추가되거나 변경될 수 있다. (추론레벨이 없어지기도?) 해당 부분도 컴포저에서 지원하라”

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 상태 |
|---|---|---|---|
| D1 | 실행 세션은 공통 RuntimeSupervisor/RuntimePool LRU를 사용한다. | active는 축출하지 않고 idle 세션을 재사용한다. | ACTIVE |
| D2 | 같은 실행 구성·환경·cwd의 서버는 참조 소유권으로 공유한다. 마지막 소유자 해제 시 자원을 회수한다. | 다른 살아 있는 세션을 종료하지 않는다. 일시 조회는 finally에서 해제한다. | ACTIVE |
| D3 | Orca headless 서버는 Desktop 기본 포트와 격리한다. 사용자 Desktop 전역 설정은 변경하지 않는다. | CLI 1.19의 port=0은 4096을 먼저 사용한다. 토스트 원인 여부는 실측과 구분해 보고한다. | ACTIVE |
| D4 | OpenCode 상태는 작업 패널 위 상세로 열며 닫기·Esc·확대·크기·초점 복귀는 기존 상세 호스트를 따른다. | Claude 상태 타일과 Code 전용 조건은 유지한다. | ACTIVE |
| D5 | MCP 출처 그룹은 스킬의 SourceHeading 간격과 브랜드 색을 공유한다. | 첫 그룹과 후속 그룹 간격을 구별한다. | ACTIVE |
| D6 | 미지원 산출물은 검증된 publication 위치를, 미지원 컨텍스트 파일은 승인된 실제 파일 위치를 연다. | 존재/범위 검증 유지. 지원 파일의 기존 열기 동작 유지. | ACTIVE |
| D7 | HTTP(S)는 OS 기본 브라우저에 위임한다. | 새 창과 같은 창 탐색 모두 앱 문서를 교체하지 않는다. | ACTIVE |
| D8 | 실행 중 OpenCode의 공개 SDK 에이전트·모델 variant 목록을 Composer의 정본으로 사용한다. | 플러그인이 추가/변경한 primary/all만 표시하며 hidden/subagent 제외. 빈 variant는 선택기를 숨기고 이전 variant를 보내지 않는다. | ACTIVE |
| D9 | 같은 살아 있는 generation의 목록은 세션 이동에도 유지하고 재개 후 갱신한다. | 조회 실패는 성공한 같은 generation 목록을 보존한다. 다른 generation에 live 권한을 넘기지 않는다. | ACTIVE |

갱신 메모: 모든 결정은 이번 사용자 요청 또는 기존 보존 계약에 근거한다. ACTIVE 결정 ↔ 아래 AC 대조: 충돌 0.

## 4. 비판적 검토

서버 map에는 closeAll만 있고 채널 close가 서버를 해제하지 않는다.
`installed`·server start마다 `--version`, history마다 `db path`와 서버 acquire가 반복된다.
토스트를 직접 발신하는 Orca/OpenCode adapter 코드는 발견되지 않았다. 공식 CLI의 기본 포트 선택과 Desktop 연결 충돌은 가능한 원인이며 Windows 실측 없이 해결 완료라고 단정하지 않는다.

## 5. 사용자 흐름

| 입력 | 결과 | 실패·전환 |
|---|---|---|
| OpenCode 전송/재개 | 같은 살아 있는 서버·채널 재사용, 최신 에이전트/variant 반영 | 종료된 generation 재개 시 새 목록 |
| LRU 축출 | 해당 채널 소유권 해제, 다른 소유자가 없으면 서버 종료 | 공유 active 세션 유지 |
| 상태 메뉴 | 작업 영역 위 상세 표시 | 닫으면 작업 영역 복원, 추가 타일 없음 |
| 미지원 파일 클릭 | Explorer에서 파일 선택 | missing/권한 실패는 기존 오류 보고 |
| HTTP(S) 클릭 | 기본 브라우저 열기 | 앱 내 외부 페이지 로드 차단 |

테마·키보드·폭·모션은 기존 primitive를 재사용한다. 세션 이동은 draft/스크롤/기존 메뉴 cache를 변경하지 않는다.

## 6. 범위

범위는 요청된 OpenCode runtime/Composer, 상태 상세, MCP 그룹, 파일·링크 열기다.
전역 OpenCode Desktop 설정·프로세스 종료, 모델 서비스 SLA 보장, 임의 플러그인의 OS 알림 차단, 신규 의존성은 포함하지 않는다.
실제 Desktop 대조와 Windows 토스트 억제는 측정 가능한 증거가 없으면 미확인으로 남긴다.

## 7. Acceptance

| R / AT / AC | 행동 기준 | 검증 수단 / 도달 경로 |
|---|---|---|
| R1 / AT1 / AC1 | 공통 LRU가 OpenCode 채널을 닫으면 소유 서버도 회수되며 공유 세션은 유지된다. | adapter→channel→server lease + RuntimePool 통합 |
| R2 / AT2 / AC2 | 중복 version/db path 조회를 병합·재사용하고 실패·실행 파일 변경 뒤 재시도한다. | server 시험 및 실제 CLI 시간 측정 |
| R3 / AT3 / AC3 | Orca 서버는 명시적인 별도 loopback 포트를 사용한다. | spawn 인자·실제 listener 검증 |
| R3 / AT4 / AC4 | Orca OpenCode 세션으로 OpenCode Windows 토스트가 발생하지 않는다. | 실제 Windows/OpenCode Desktop 관측, 증거 없으면 미확인 |
| R4 / AT5 / AC5 | 상태 메뉴가 작업 폭의 상세를 열고 닫기/확대/세션 이동이 기존 상세와 같다. | chat action→OpenCodeRightPanel→TilePanel 행동 테스트 |
| R5 / AT6 / AC6 | MCP 첫/후속 그룹 간격이 스킬과 같고 브랜드 색이 적용된다. | CustomizeList 렌더·테마 시각 확인 |
| R6 / AT7 / AC7 | 미지원 artifact는 reveal API, context는 Explorer로 이어진다. 지원 파일과 missing 검증은 유지된다. | artifact store·files handler 행동 테스트 |
| R7 / AT8 / AC8 | HTTP(S) 새 창/같은 창 링크는 shell.openExternal에 전달되고 앱 탐색은 막힌다. | navigation 이벤트 포트 행동 테스트 |
| R8 / AT9 / AC9 | 실행 후 추가/변경된 primary/all agent가 Composer에 나타나며 선택값이 다음 prompt에 전달된다. | SDK fixture→NativeResources→Composer + adapter 요청 |
| R8 / AT10 / AC10 | runtime variant가 빈 경우 컨트롤과 이전 variant를 제거하며, 새 generation/실패/세션 이동에서 목록이 올바르게 갱신·보존된다. | catalog·cache·control 행동 테스트 |

### 7-A. V trace

Baseline V1. R1~R8/AT1~AT10은 위 AC 행이 정본이다.
SD1/ST1=세션 수명·조회, SD2/ST2=패널·파일·링크·Composer 흐름.
AR1/IT1=서버 소유권, AR2/IT2=SDK 안전 DTO/cache, MD1/UT1=조회·표시·열기 판정.
각 node는 NEW이며 아래 pair가 같은 레벨에서 직접 결과를 관측한다.

| Pair | left ↔ right | requiredness | production path / oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|
| VP1 | R1,R2 ↔ AT1,AT2 | REQUIRED | supervisor→channel→server; server/adapter/runtime lifecycle tests | not selected — close/spawn/조회 횟수 직접 관측 | EP1,EP2 |
| VP2 | R3 ↔ AT3,AT4 | REQUIRED | serve spawn→listener→Desktop; server tests + Windows 관측 | not selected — 실제 listener/알림 관측 | EP2 |
| VP3 | R4,R5 ↔ AT5,AT6 | REQUIRED | titlebar→store→detail / CustomizeList→SourceHeading; panel interaction/render | not selected — props/행동/DOM | EP3,EP4 |
| VP4 | R6,R7 ↔ AT7,AT8 | REQUIRED | card→store→artifact reveal / context→file handler / webContents→shell; store·handler·navigation tests | not selected — 실제 sink 호출 | EP5,EP6 |
| VP5 | R8 ↔ AT9,AT10 | REQUIRED | SDK agents/providers→DTO→cache→Composer→prompt; catalog/cache/control/channel tests | not selected — 값과 제거 직접 관측 | EP7 |
| VP6 | SD1 ↔ ST1 | REQUIRED | adapter transient/read/send lifecycle tests + CLI smoke | not selected — 통합 실행 | EP1,EP2 |
| VP7 | SD2 ↔ ST2 | REQUIRED | panel 상세·파일 열기·Composer 통합 및 Chromium 표시 | not selected — 사용자 진입 행동 | EP3~EP7 |
| VP8 | AR1 ↔ IT1 | REQUIRED | RuntimePool→SessionRuntime→adapter close→server release | not selected — LRU로 실제 kill 관측 | EP1 |
| VP9 | AR2 ↔ IT2 | REQUIRED | native resources transport→cache→composer / prompt | not selected — 구별되는 agent/variant 값 | EP7 |
| VP10 | MD1 ↔ UT1 | REQUIRED | version/cache/format/link/catalog 순수·포트 테스트 | not selected — 반환값/side effect 직접 관측 | EP2,EP5~EP7 |

운영 gate: 관련 Vitest(pretest 우회), lint, typecheck 3종, build, harness boundary, 문서 inventory/link, renderer catalog, commit trailer 파싱.
기존 ignored `.tmp` 링크 실패는 변경 산출물과 구분한다.

# Part II — Technical Design

## 8. Research

| 대상 / 검색 | 현재 관측 | 의미 |
|---|---|---|
| `rg 'this.client' adapters/opencode/v1/adapter.ts` | complete/recover/send/readHistory | 모든 서버 사용자를 수명 소유권에 연결 |
| `server.ts` acquire/start/databasePath/close | 공유 map + 반복 execFile | metadata 캐시와 lease 필요 |
| `supervisor.ts` releaseRuntime / runtime-pool.ts closeEntry | 공통 idle LRU→runtime.close | 새 LRU 정책 복제 금지 |
| `Panel.tsx` detail / navigation.ts | diff/source/subagent/process 상세 | nativeStatus도 같은 상세 |
| `artifactViewerStore.ts` unsupported-format | 뷰어 허용 | reveal로 변경 |
| `context-file.ts` extension set | office/pdf 외부 실행 | 내부 미지원은 reveal |
| `index.ts` setWindowOpenHandler | 모든 URL openExternal, 같은 창 미처리 | HTTP(S) 이벤트 정책 추출 |
| SDK types.gen.d.ts Agent/Model | mode,hidden,model,variant,variants | 안전 DTO만 전달, prompt/options/credentials 제외 |

공식 근거: [CLI serve](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/cli/cmd/serve.ts),
[server port 선택](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/server/server.ts).

## 9. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 소유권 | acquire 후 앱 종료까지만 보존 | 연결별 멱등 release; 채널 close/finally 및 일시 작업 finally에 연결 |
| 조회 | 버전·DB subprocess 반복 | 실행 파일 identity 기반 버전 cache, 살아 있는 서버 generation DB cache, 동시 조회 병합 |
| listener | port=0→4096 우선 | OS 임시 loopback 포트 할당→명시 port |
| UI | 상태 별도 타일 | OpenCode detail overlay, task base 유지 |
| 파일 | 미지원 viewer / office default app | 기존 검증 후 reveal |
| 링크 | 새 창 처리만 | HTTP(S) 새 창/같은 창 정책 |
| Composer | 설정 파일 build/plan·variants | runtime agents/providers에서 DTO 추출, 같은 generation cache 및 유효값 정리 |

레이어는 기존 DAG를 유지한다. metadata와 lease는 OpenCode adapter 내부, window routing은 main infra의 주입 가능한 포트, renderer 상태는 기존 feature store/hook이 소유한다.
프로세스 종료는 자신이 spawn한 child에만 적용하며 Windows에서는 그 child PID의 tree를 정리한다.

## 10. 강제 지점

| ID | 계약 | 자리 목록 | 검색 / 실패 의미 |
|---|---|---|---|
| EP1 | 서버 소유권 | adapter complete, recoverSession, sendMessage, readHistory; channel run/close; server acquire/release/close; RuntimePool closeEntry | `rg 'client\\(|close\\(|acquire\\(' app/src/main/adapters/opencode app/src/main/features/sessions/runtime-pool.ts`; 누수·공유 세션 종료 |
| EP2 | 시작·metadata | server installed/readVersion/start/databasePath | `rg 'readVersion|databasePath|spawnProcess' app/src/main/adapters/opencode`; 반복 subprocess·4096 점유 |
| EP3 | 상태 상세 | chatStore toggle/setActive/remove; ChatTitleBar active; OpenCode Panel/navigation; layout 기존 상태 정규화 | `rg 'nativeStatus|panelReveal|toggleRightPanelTile' app/src/renderer/src/features/chat`; 추가 타일·닫기/복귀 실패 |
| EP4 | 출처 그룹 | CustomizeList nativeMcp/Orca group; SourceHeading | `rg 'SourceHeading' app/src/renderer/src/features/skills`; 간격/색 불일치 |
| EP5 | 미지원 파일 | artifact open/retry; context opensWithDefaultApp; filesOpenContextFile sink | `rg 'unsupported-format|opensWithDefaultApp|filesOpenContextFile' app/src/main app/src/renderer/src/features/chat/store`; 빈 viewer·기본앱 실행 |
| EP6 | 외부 링크 | main window popup/navigation registration; Markdown anchor | `rg 'setWindowOpenHandler|will-navigate|target=\"_blank\"' app/src/main/index.ts app/src/renderer/src/shared/ui/markdown`; 외부 페이지 앱 내 로드 |
| EP7 | native Composer | channel nativeResources; SDK catalog mapper; main resources merge; renderer observed; OpenCode Controls/Module; prompt submit | `rg 'nativeResources|commands|modelVariant|harnessAgent' app/src/main/adapters/opencode app/src/main/app/handlers/session-resources.ts app/src/renderer/src/features/chat/harnesses/opencode app/src/renderer/src/features/chat/lib/nativeResourceState.ts`; stale agent/variant 송신 |

## 11. 구현·시험

기존 server/adapter/panel/store/handler 시험에 실제 소유권·호출 인자·표시 결과를 추가한다.
SDK 네트워크는 주입된 fetch 포트, Electron은 순수 navigation 등록 포트로 분리한다.
실제 CLI smoke는 임시 폴더·loopback만 사용하며 유료 모델 호출 없이 cold/warm acquire와 release를 측정한다.

## 12. End-to-end·호환

NativeResources에 optional composer DTO를 추가한다. 구버전·Claude에는 없으며 기존 메뉴는 유지된다.
성공한 빈 배열은 권위 있는 제거이며 실패(undefined)와 구분한다.
DB/native 설정 파일·사용자 Desktop 알림 설정은 변경하지 않는다.

## 13. READY review

현재 사용자 조건과 ACTIVE 결정/AC를 대조했고 충돌은 없다.
기존 LRU·detail·artifact reveal 포트가 확인되었으며 명시적으로 바뀌는 동작만 기록했다.
토스트 실기와 Desktop 대비 속도는 별도 관측이 필요하며 추측을 완료 증거로 쓰지 않는다.

## [구현자 기입]

### 설계 리뷰

부분 구현이다. AC4의 Windows 토스트 비활성화는 완료하지 못했다. 나머지 AC의 행동 시험은 통과했다.
사용자는 토스트 시점을 “답변·작업이 끝났을 때”, 적용 범위를 “Orcinus orca에서는”으로 명확히 했다.
확인한 `notifications.agent`는 OpenCode Desktop UI의 전역 설정이며 headless CLI 설정이 아니다.
Orca 실행에만 적용할 수 있는 공개 스위치는 확인되지 않았다. 지원하지 않는 설정 키를 넣거나 Desktop 전역 파일을 변경하지 않았다.

§3 D1·D2의 공통 LRU와 참조 소유권, D4의 기존 상세 호스트, D8·D9의 live 목록 계약에 동의한다.
§4의 포트 충돌 가설을 토스트 원인으로 확정할 증거는 없다. 별도 포트 적용과 알림 차단 완료를 구분한다.
ACTIVE 결정 변경·신규 의존성·PLAN_GAP은 없다. AC4 미해결과 운영 관측 한계는 유지한다.

### 강제 지점 전수 (§10 대조)

아래 좌표의 경로는 `app/src/` 기준이다. `v1/`은 `main/adapters/opencode/v1/`이다.
§10의 검색을 실행해 테스트를 제외한 호출부와 대조했다. `client()` 호출자는 complete/recover/send/readHistory이며
release는 일시 요청의 finally와 채널 run의 finally에 연결했다. 창 이벤트 구현은 `main/infra/external-navigation.ts`로 이동했다.
이는 §10 EP6의 등록 경로 내부 추출이다. `main/index.ts`의 호출 배선과 Markdown 진입은 아래 미잠금 지점으로 남긴다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령/관측·oracle | 운반항·구별값·관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP1·VP6·VP8 | EP1 서버 소유권 | complete/recover/send/readHistory, channel run/close, server acquire/release/close, RuntimePool closeEntry — 10곳 | 10/10 | `v1/adapter.test.ts`: `starts the turn, completion and recovery…`, `rejects a failed auxiliary response…`, `releases the history connection…`; `v1/server.test.ts`: `releases only the last owner…`, `isolates server configurations…`; `main/app/chat-turn/opencode-runtime.test.ts`: `reuses a live OpenCode process…` | 일시 요청 release 3회, 404·503 뒤 각각 1회, 공유 소유자 유지·마지막 해제 kill·LRU kill 관측 | 실제 임의 MCP 자식 트리까지 종료되는 Windows 실기는 별도 |
| VP1·VP2·VP6·VP10 | EP2 시작/metadata | installed/readVersion/start/databasePath — 4곳 | 4/4 | `v1/server.test.ts`: `coalesces version checks…`, `invalidates the version cache…`, `retries after replacing…`, `coalesces concurrent startup…`; `v1/server.database-path.test.ts`: `reads the database path…` | version 병합 1회, 실행 파일 교체 2회; DB 성공 cache 1회→삭제/실패/재시도 총 3회; spawn `--port=49123` | AT4 토스트 관측/차단은 미완료 |
| VP3·VP7 | EP3 상태 상세 | store toggle/setActive/remove, titlebar active, Panel/navigation, layout — 7곳 | 7/7 | `renderer/src/features/chat/store/chatStore.panelTiles.test.ts`: `opens status over the task…`; `components/ChatTitleBar.render.test.ts`: `런타임 타일 제목과…`; `harnesses/opencode/rightpanel/Panel.interaction.test.ts`: `opens native status…`; `lib/rightPanelLayout.test.ts`: `removes legacy OpenCode status…` | task 단일 열, detail nativeStatus, 닫은 뒤 원래 작업 영역, legacy status 제거·열 id 유지 | 설치본의 전체 다중 모니터/배율 실기는 미실행 |
| VP3·VP7 | EP4 출처 그룹 | nativeMcp/Orca group/SourceHeading — 3곳 | 3/3 | `renderer/src/features/skills/components/customize/CustomizeList.render.test.ts`: `labels native plugin skills…` | 첫 그룹 pt-5, 후속 pt-8, Claude text-spinner·OpenCode text-oc-ink | 없음 |
| VP4·VP7·VP10 | EP5 미지원 파일 | artifact open/retry, context 판정, file handler sink — 4곳 | 4/4 | `renderer/src/features/chat/store/artifactViewerStore.test.ts`: `reveals unsupported formats…`, `reveals an unsupported retry…`; `main/app/handlers/context-file.test.ts`; `files.contextDirectory.test.ts`: 파일 열기 매개변수 사례 | unsupported→reveal, 기존 viewer 유지, 늦은 응답 무시; 승인된 실제 경로만 Explorer sink | 실제 Explorer 창을 여는 설치본 실기 미실행 |
| VP4·VP7·VP10 | EP6 링크 | main window popup/navigation 등록, Markdown anchor — 3곳 | 0/3 | `main/infra/external-navigation.test.ts`: `sends HTTP(S) popup and same-frame navigation…`은 추출된 등록 함수 안의 이벤트→shell 두 경로만 직접 관측 | http/https는 정확한 URL 전달·탐색 취소, 다른 scheme 거부 | main/index 호출 배선 2곳과 실제 Markdown 클릭 1곳은 직접 oracle 없음. helper 통과로 이 3곳을 닫았다고 세지 않음 |
| VP5·VP7·VP9·VP10 | EP7 native Composer | channel resources, SDK mapper, main merge, renderer observed, Controls/Module, prompt — 7곳 | 7/7 | `v1/composer-catalog.test.ts`; `v1/adapter.persistent.test.ts`: `passes a live plugin agent…`, `discards menu metadata…`; `main/app/handlers/session-resources.test.ts`: `retains live observations…`; `renderer/src/features/chat/lib/nativeResourceState.composer.test.ts`; `harnesses/opencode/composer/Module.integration.test.ts`, `Controls.interaction.test.ts` | plugin-review/deep→plugin-revised/빈 variants, IPC/cache 전달, 이전 선택 제거·다음 prompt 검증; 닫힌 채널의 늦은 목록은 disconnected | 없음 |

직접 oracle로 닫은 자리 **35/38**. 차집합은 EP6의 위 3곳이다. Windows 토스트는 이 합계와 별개의 AC4 미완료다.
원본 검색 결과가 넓게 잡은 테스트·타 하네스 항목은 production 자리로 세지 않았다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP1 | REQUIRED | SELF_PASS | EP1·EP2의 server/adapter/runtime tests | not selected — 횟수·kill 직접 관측 |
| VP2 | REQUIRED | SELF_BLOCKED | EP2 spawn 시험·실제 CLI smoke는 통과 | not selected — Windows 토스트 억제 증거 없음 |
| VP3 | REQUIRED | SELF_PASS | EP3·EP4의 store/Panel/CustomizeList tests | not selected — DOM·행동 관측 |
| VP4 | REQUIRED | SELF_BLOCKED | EP5 tests와 navigation helper test 통과 | not selected — EP6 진입 3자리 미잠금 |
| VP5 | REQUIRED | SELF_PASS | EP7 catalog/cache/Controls/channel tests | not selected — 구별값 전달·제거 관측 |
| VP6 | REQUIRED | SELF_PASS | EP1 adapter tests·CLI smoke | not selected — 수명·실제 서버 종료 관측 |
| VP7 | REQUIRED | SELF_BLOCKED | Panel/Module 통합·Chromium 확인 통과 | not selected — EP6 진입 3자리 미잠금 |
| VP8 | REQUIRED | SELF_PASS | `main/app/chat-turn/opencode-runtime.test.ts:reuses a live OpenCode process…` | not selected — 공통 RuntimePool 축출→kill |
| VP9 | REQUIRED | SELF_PASS | EP7 main IPC cache·Module integration·persistent channel | not selected — plugin-review/deep 전달 |
| VP10 | REQUIRED | SELF_BLOCKED | EP2·EP5·EP7 및 navigation helper의 단위 시험 통과 | not selected — 연결된 EP6 자리의 전수 완료는 주장하지 않음 |

### 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 | V1의 모든 pair가 not selected | 최초 | 직접 행동 oracle만 추가 | mutation 미선택 |

분모 검산: 선택 증거 0 · 인용 변이 0 · 새 구조/proxy oracle 0 = 변이 행 0.
위 표는 해당 없음 표기이며 선택된 변이 행으로 세지 않는다. 이전 verify의 red/green 이력은 없다.

### Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태 소비자가 있는가 | 추가 사용자 토스트 없음. runtime 목록 실패는 기존 성공 cache 유지 | 종료 generation으로 권한 이전 금지 |
| seam 재배치가 cleanup 변수를 끊는가 | adapter client lease는 외부 finally가 참조. 실패 completion과 history HTTP 오류에서도 release 관측 | 없음 |
| 실패 경로가 Part I에 있는가 | metadata 실패·새 generation·파일 missing은 §5·D9의 기존 실패/전환 | 새 상태 없음 |
| 아무 일도 안 일어난 것처럼 보이는가 | 미지원 파일은 reveal. 파일 실패는 기존 오류 UI. 외부 브라우저 기동 실패는 기존과 같이 UI 통지 없음 | 브라우저 실패 안내는 범위 밖으로 기록 |
| 늦은 응답이 화면을 되돌리는가 | artifact 요청 id, cache generation 및 channel close 이후 검사로 차단 | 닫힌 채널 metadata regression 추가 |

### 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기존 pool은 LRU가 채널을 닫아도 child가 남음 | ✅ lease 및 마지막 소유자 tree 종료 | RuntimePool 통합 kill 시험 |
| 2 | 초기 live catalog를 기다리면 기본 prompt까지 지연 | ✅ 선택 agent/variant가 있을 때만 제한 시간 내 catalog를 기다림 | `adapter.persistent.test.ts:does not wait for menu metadata…` |
| 3 | fallback 목록으로 live 선택값을 먼저 지울 수 있음 | ✅ authoritative 성공 후에만 값 제거 | Controls interaction·Module integration |
| 4 | nativeResources await 뒤 이미 닫힌 채널을 connected로 반환할 수 있음 | ✅ 종료 재검사 | `discards menu metadata that finishes after the channel closes` |
| 5 | 임시 포트 예약 해제와 CLI bind 사이 경쟁 | ⚠️ 보고만. bind 실패는 시작 오류로 반환하며 항목 제거 후 재시도 가능 | server startup 실패/재시도 시험; 경쟁 창 자체를 없애지는 않음 |
| 6 | Desktop 완료 알림은 headless CLI의 설정이 아님 | ⚠️ AC4 미완료. Desktop `notifications.agent` 전역값 변경 안 함 | [관측 기록](evidence/validation.md)의 토스트 항목 |
| 7 | Desktop과 동일한 cold 성능이라는 근거 없음 | ⚠️ 실제 CLI만 측정. host 부하에 따라 cold 4.1~11.5초 | 같은 기록의 시간표; Desktop 대비 실험 없음 |

설계 대비 메커니즘 대체는 없다. private port의 예약 경쟁과 catalog의 조건부 대기는 구현 세부다.

| 축 | 추가 실패 가능성 | 재확인한 AC·§10 / 관측 |
|---|---|---|
| 만료 | executable 교체·DB 파일 삭제 후 cache가 남을 수 있음 | AC2·EP2: identity 변경/파일 삭제 뒤 재조회 |
| 공유 | 다른 세션 release가 공용 서버를 종료할 수 있음 | AC1·EP1: 마지막 owner만 kill, 늦은 release는 새 서버 유지 |
| 재진입 | 한 번 실패한 promise를 계속 재사용할 수 있음 | AC2·EP2: version/start/db 실패 이후 재시도 |
| 다른 무효화 축 | 새 generation 또는 종료 중 응답으로 이전 catalog가 부활할 수 있음 | AC10·EP7: renderer generation·channel close regression |

### 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | OpenCode server/adapter/channel/catalog, main 파일·링크 포트, renderer 상태 상세·Composer·출처 그룹, 해당 테스트 및 현재 아키텍처/IPC 문서 |
| 실행 명령·산출 | [검증 기록](evidence/validation.md). 35파일 353시험 통과 후 마지막 수명/IPC 수정 3파일 55시험 재검증. 패널 추가 시험 별도 기재 |
| V-pair 자기확인 | SELF_PASS 6 / SELF_BLOCKED 4 |
| 강제 지점 전수 | 35/38, EP6 진입 3자리 미잠금 |
| 블로커 / 역질문 | Orca 실행에만 적용되는 토스트 스위치 미확인. Desktop 전역 변경은 실행하지 않음 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | 공통 RuntimePool idle 축출이 실제 adapter/channel을 통해 fake owned child kill, 공유 owner 유지 |
| AC2 | ✅ | version/DB 횟수·재시도 시험 및 실제 CLI cold/warm 측정 |
| AC3 | ✅ | 명시 port spawn 단언, 실제 CLI 임시 포트의 health 성공 |
| AC4 | ⚠️ | 토스트 비활성화 설정 미구현, 실제 완료 알림 억제 미확인 |
| AC5 | ✅ | 상태 상세의 task 폭·닫기·Esc/초점 복귀 관측; 확대/resize는 같은 상세 호스트 시험 |
| AC6 | ✅ | 그룹 간격·색 DOM 시험과 light/dark Chromium 관측 |
| AC7 | ✅ | unsupported artifact/context의 reveal sink, missing·권한·늦은 응답 시험 |
| AC8 | ✅ | 등록 helper의 HTTP(S) popup/navigation→shell 호출 및 탐색 취소 시험. EP6 조립 진입 증거의 한계는 위에 별도 기록 |
| AC9 | ✅ | SDK agent DTO→IPC/cache→Composer와 선택값→실제 SDK prompt payload를 각각 관측 |
| AC10 | ✅ | 빈 variants 숨김·선택 제거, 같은 generation 실패 보존·새 generation 차단·재마운트 유지 시험 |

합계 검산: **✅ 9 · ⚠️ 1 · ❌ 0 = 총 10**. `Criteria-Met: 9/10`, `Status: partial`.
이는 자기보고이며 독립 검증 PASS 또는 미잠금 지점의 완료 선언이 아니다.

### Review Signals — 사실만

- 최초 r1 구현이며 이전 verify 지적은 없다.
- plan AC4는 실제 알림 관측을 요구한다. 공개 설정 스위치를 확인하지 못해 완료 판정을 하지 않았다.
- Electron fork worker가 종료되는 환경에서는 기존 ABI를 유지한 thread pool로 재검증했다. ABI 재설치는 하지 않았다.
- raw 문서 링크 gate는 ignored `.tmp/opencode-dev`의 기존 링크 5개에서 실패한다. workspace 문서 링크에는 해당 실패가 없다.
- 라운드/impl 턴: r1. 다음은 독립 검증이며 미해결 AC4와 EP6 증거 범위를 함께 전달한다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **FAIL**. 고장 ID는 그 문서 §4 고장 이력이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | H1 주 창 외부 링크 등록 호출 삭제 green | EP6 registration · AC8 · VP4 | 창 조립 등록을 electron 비의존 경계로 떼어 단언 | BLOCKING | open |
| D2 | H2 Markdown `target="_blank"` 삭제 green | EP6 anchor · AC8 · VP4 | Markdown 링크의 `target`·`rel` 단언 | BLOCKING | open |
| P1 | AC4 OpenCode Windows 토스트 미발생 미확인 | VP2 · AC4 | 실제 Windows 관측(사람) | 사람 실기 | open |
| T1 | D2 서버 참조 소유권이 0275 D13–D15·D20으로 뒤집힘 | D2 · AC1 일부 · EP1 서버 9자리 · VP1·VP6·VP8 일부 | 0275 verify §0-1이 판정 | PLAN_GAP → 0275 이관 | transferred |
