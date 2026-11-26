# 0333 · 플러그인과 MCP의 하네스별 전역 선택을 다음 입력부터 적용한다

| 항목 | 값 |
| --- | --- |
| 상태 | plan / **READY** · 라운드 1 · 2026-11-26 |
| 설계 | Codex · 사용자 요청에 따른 새 핸드오프 |
| 기준 트리 | `ccr-59ce68d5-h1xutf`의 `28f79eaf` |
| 추적 | Baseline V · V1. 0278·0283의 대상 동작을 대체하는 새 제품 요구다. |

## Part I — Product & UX Contract

### 1–2. 목표와 요구 출처

nav → **플러그인**의 **플러그인**·**MCP** 탭에서 한 번 바꾼 선택을 해당 하네스의 모든 Orca 세션이 공유한다. 사용자는 실행 중인 응답을 끝까지 받고, 같은 대화의 다음 입력이나 다른 폴더에서 연 새 대화의 첫 입력부터 선택한 도구와 명령을 쓸 수 있다.

사용자 인수 기준은 “모델이 실제로 받는 도구·명령과 호출 가능 여부”다. “SDK로 제어할 수 없는 항목은 실제 ON/OFF 상태를 보여 주되 토글을 회색으로 고정한다.” 적용 대상은 아래 §8의 여덟 행이다.

### 3. 결정 원장

| ID | 상태 | 결정과 근거 | 인수 |
| --- | --- | --- | --- |
| D1 | ACTIVE · 사용자 | “작업경로가 달라도 같은 전역 선택을 따른다.” 같은 하네스·같은 항목의 명시 선택이 cwd의 ON/OFF 기본값보다 우선한다. | AC1·3·4 |
| D2 | ACTIVE · 사용자 | “진행 중인 응답은 끝까지 유지하고, 기존 세션은 각각 다음 사용자 입력부터, 새 세션은 첫 입력부터” 적용한다. | AC2·3 |
| D3 | ACTIVE · 사용자 | 한 서버를 끄면 그 도구가 사라진다. 플러그인 전체를 끄면 명령과 번들 MCP가 함께 사라진다. 다시 켠 같은 대화에서 실제 호출에 성공한다. | AC1·5 |
| D4 | ACTIVE · 사용자 | Claude 대화 ID·이력을 지킨다. OpenCode의 MCP 선호 변경으로 서버 PID·세션 ID를 바꾸거나 작업경로 인스턴스를 폐기하지 않는다. | AC2·3·6 |
| D5 | ACTIVE · 사용자 | OpenCode 내장은 유효한 인증과 사용자 ON 선택을 모두 요구한다. SDK가 지원하지 않는 제어는 실제 상태를 담은 회색 스위치로 제공한다. | AC5·6·7 |
| D6 | ACTIVE · 사용자 | 0278의 AppData 세대 생성과 cwd의 옛 사본 보유를 없애고 Orca 내장 도구와 사용자 스킬을 계속 제공한다. | AC8 |
| D7 | ACTIVE · 설계 선택 | 사용자가 켜기로 한 서버의 연결이 늦으면 입력을 대기시킨다. 실패하면 입력을 보존하여 재시도하거나 해당 항목을 끈 뒤 보낼 수 있게 한다. | AC9 |

0278의 **명시 선택보다 프로젝트 우선·cwd별 이전 배포 유지**는 D1·D6으로, 0283의 **토글 시 확인 후 모든 Claude 프로세스 종료**는 D2·D4로 대체한다. ACTIVE 결정과 AC를 대조했으며 일곱 결정 모두 위 표의 행동 단언에 대응한다.

### 4–6. 사용자 흐름과 범위

| 시점 | 화면과 대화에서 관측할 결과 |
| --- | --- |
| 클릭 → 저장 | 해당 하네스와 항목을 표시한다. 영속 저장을 확인한 뒤 모든 창에 선택을 알린다. 저장 실패 시 기존 값과 응답을 보존하고 해당 행에 실패·재시도를 표시한다. |
| 저장 → 적용 대기 | 선택은 ON/OFF로 표시하고, 기존 응답이 쓰는 실제 상태가 다르면 “다음 입력에 적용”을 함께 표시한다. 세션마다 상태가 다르면 각각의 관측 또는 적용 대기 수를 보여 준다. |
| 새 입력 → 전송 | 해당 입력을 SDK에 넘기기 직전 최신 선택을 확인한다. 입력에 연결된 도구 상태가 확정되면 한 번 전송한다. 빠른 OFF→ON은 대기 중에도 마지막으로 저장한 값으로 재판정한다. |
| ON 대기·실패 | 연결 중에는 입력 내용·첨부를 보존하고 취소할 수 있다. SDK 시간 초과, 연결 실패, 해제 확인 실패 시 **모델 전송 0회**다. 행 및 입력 영역에 원인과 재시도를 표시한다. 취소한 입력은 뒤늦은 연결 성공으로 보내지 않는다. |
| 읽기 전용 | 확인된 ON은 회색 ON, 확인된 OFF는 회색 OFF다. 설치·설정만 발견했거나 조회가 실패하면 “설정됨·실행 미확인” 또는 “상태 확인 실패”를 표시한다. 실행 증거를 얻으면 실제 값으로 갱신한다. |
| 내장 인증 | 선택 ON이더라도 미인증이면 실제 OFF·“인증 필요”다. 미인증 도구를 노출하지 않고 일반 입력은 진행한다. 인증 복구 후에도 선택이 OFF면 연결하지 않는다. 인증 철회는 기존 인증 계층이 즉시 집행한다. |

플러그인 **설치·삭제**, 인증·권한 정책 변경, 모델 제공자 설정 변경은 이 작업의 범위 밖이다. 번들 서버를 개별로 끈 뒤 부모 플러그인을 OFF→ON해도 자식의 명시 OFF는 보존한다. 부모 OFF 동안에는 자식의 명령·도구를 실행할 수 없다.

### 7. 인수 조건

아래 항목은 구현·검증 턴에서 수행한다. 각 관측에 하네스·항목 출처·입력 UUID·세션 ID를 붙이고 요청에서 도구 이름과 호출 결과만 발췌한다.

| ID | 입력과 관측 | 통과 조건 |
| --- | --- | --- |
| AC1 | 제어 가능한 §8의 각 행에 대해 같은 대화에서 **ON → OFF → ON**으로 세 번 전송한다. 실제 SDK/CLI가 송신한 모델 요청을 로컬 모델 endpoint에서 수신하고, 구별되는 도구를 호출시킨다. | 첫째·셋째 턴에 스키마가 있으며 새 호출 표식이 실제 fixture의 도구 결과로 돌아온다. 둘째 턴에는 스키마가 없고 같은 이름의 호출을 시도해도 핸들러 실행 0회다. 대조군 서버는 세 턴 모두 호출된다. |
| AC2 | 각 하네스에서 폴더 A에 S1·S2, 폴더 B에 S3를 연다. S1과 S3의 다단계 응답을 도구 호출 직전에 멈춰 토글하고 S2에 새 입력을 넣는다. 이전 응답의 후속 모델 요청·도구 결과·종료 이벤트까지 수집한다. | 두 응답 모두 기존 도구로 완주한다. S1·S2·S3 각각의 다음 사용자 입력은 최신 상태다. OpenCode S2는 A의 응답이 끝날 때까지 대기하고 B는 A와 독립적으로 진행한다. Claude S2는 S1의 완료를 전역적으로 기다릴 필요가 없다. |
| AC3 | S1을 유지한 채 같은 cwd에 S4, 다른 cwd에 S5를 열어 첫 입력을 보낸다. 앱·데이터 호스트를 정상 재시작한 뒤 기존 대화 재개와 새 대화를 반복한다. | 첫 요청부터 마지막으로 저장한 값이 적용된다. Claude의 Orca ID·native ID 및 이전 대화 표식이 유지되고 사용자 입력 중복·이력 누락·새 대화 생성이 없다. |
| AC4 | A와 B의 프로젝트 기본값을 반대로 놓고 전역 OFF/ON, 미지정, 다른 하네스에만 같은 이름이 있는 경우를 시험한다. 두 창의 서로 다른 항목 저장 및 쓰기 실패·재접속도 포함한다. | 명시값은 양쪽 cwd에 동일하고 미지정 항목은 기존 기본값을 따른다. 형제 항목·하네스와 직접 편집한 무관 키는 보존된다. 재시작 후 기능 재현과 실제 저장 바이트가 일치한다. |
| AC5 | Claude 설치 플러그인에 고유 슬래시 명령과 번들 MCP를 함께 넣는다. 부모·자식 충돌, 같은 이름의 다른 출처, 전역 목록에만 있는 MCP, SDK의 Git-root 저장을 각각 시험한다. | 부모 OFF에서 `supportedCommands()`·명령 실행 및 모델 요청의 명령/스킬 안내와 번들 도구가 함께 빠진다. ON에서 명령의 본문 표식과 도구 결과가 돌아온다. 미로드 서버의 성공 오표시, 타 출처 오조작이 없다. |
| AC6 | OpenCode의 등록된 네이티브·내장·외장 MCP 각각에서 AC1·2를 실행한다. 서버 시작 시 PID와 session ID를 채집하고 인스턴스 dispose API·이벤트를 기록한다. | 변경 구간 전후 PID·각 session ID가 같고 **토글로 인한 작업경로 인스턴스 dispose 0회**다. 인증 valid/invalid × 선택 ON/OFF의 네 경우 중 valid+ON만 내장 도구가 호출된다. `read`·`bash`의 기존 세션 권한과 승인 흐름은 유지된다. |
| AC7 | 회색 ON/OFF 두 입력을 목록 및 같은 항목의 상세에 렌더하고 클릭·키보드·직접 IPC를 시험한다. 설치만 발견한 경우와 선택 ON·실제 실패를 추가한다. | 읽기 전용 상태를 구별할 수 있고 조작으로 저장·SDK 변경 0회다. 설정 발견·실패를 연결 성공으로 표시하지 않는다. 제어 가능한 행은 저장·적용·오류 상태를 구별한다. |
| AC8 | 깨끗한 Windows 사용자 데이터와 이전 `generation-*` 잔존 데이터로 각각 부팅한다. 스킬·MCP 재배포, 재시작, 배포 지연·실패와 복구 후 SDK가 실제로 연 경로를 수집한다. | 새 세대 디렉터리 생성 0회, 옛 cwd 배포 참조 0건. 설치 원본·스킬 링크 대상은 보존된다. 첫 유효 배포 및 재배포 후 Claude에서 `claude:<fixture-skill>`을 실행하고 인증된 내장 및 외장 도구의 서로 다른 결과를 받는다. |
| AC9 | 명시 ON 연결을 기존 2초보다 늦게 성공시키거나 실패시킨다. 같은 cwd 동시 입력, 대기 중 OFF, OFF 해제 실패, 사용자 취소·재시도를 시험한다. | 대기·실패 중 모델 요청 0회. 성공 뒤 최신 선택으로 한 번만 전송한다. 취소 후 0회, 재시도 후 중복 0회이며 실제 상태와 행 표시가 일치한다. |

### 7-A. V 추적

모든 행은 V1의 NEW / REQUIRED pair다. §10의 E는 값을 운반하는 자리이며, 해당 행의 검색식과 직접 관측을 함께 사용한다.

| Pair | 제품 경로 | §10 · 직접 증거 |
| --- | --- | --- |
| R1 ↔ AT1 | nav → 하네스·출처별 행 → 모델 요청 → 실제 도구 결과/명령 본문 | E1·E3·E4·E5, AC1·5·7. §19의 같은 대화 실기와 로컬 endpoint |
| SD1 ↔ ST1 | 저장 완료 → 기존 응답 종료 → 대기 입력·새 입력 → 재개/재시작 | E2–E5, AC2–4·6·9. A/A/B 순서 로그·실제 세션 이력·PID |
| AR1 ↔ IT1 | 창 → agent host → data host 영속 쓰기 → 사본/창 통지 → 입력 허가 | E1·E2·E5, AC4·7·9. 실제 peer 처리 및 설정 재개방 |
| AR2 ↔ IT2 | 부팅·재배포 → dist → SDK local roots 및 runtime MCP → 명령/도구 | E3·E6, AC5·8. 임시 홈의 설치·dist·AppData 세 트리와 SDK 옵션·I/O |
| MD1 ↔ UT1 | 출처별 키·부모/인증·프로젝트 기본값 → 유효 선택 → 모델 제출 허가 | E2–E5, AC1·4–6·9. 반대값·미지정·늦은 성공·실패를 넣는 §11 테스트 |

## Part II — Technical Design

### 8. 하네스별 현재 GUI와 목표 SDK 경로

현재 nav는 `ExtensionsCatalogView → CustomizeList`에서 `providers` 탭에 Orca 제공자 카드와 네이티브 플러그인을, `mcp` 탭에 사용자 서버와 네이티브 MCP를 조합한다. `useNativeMcpCatalog`는 전역 설정을 조회하며 현재 대화의 Query를 소유하지 않는다. 표에서 **등록**은 해당 Query 또는 OpenCode 서버·directory가 실제로 알고 있는 SDK 이름을 확인했다는 뜻이다.

| 하네스 · 대상 | 현재 GUI / 데이터 | SDK 제어와 적용 시점 | 변경할 코드 |
| --- | --- | --- | --- |
| Claude · 설치 네이티브 플러그인 전체 | 플러그인 탭. 전역 user scope이며 manifest 이름이 있는 설치만 조작 가능하다. managed 등은 고정. 현재 저장 시 busy 확인 후 Claude 전체를 닫는다. | 해당 세션의 다음 입력 직전에 최신 local roots·inline flag·skills로 Query를 다시 열고 native ID로 resume한다. OFF 루트는 주입 대상에서 빼고 marketplace 중복 로드도 막는다. 새 세션은 첫 Query부터 적용한다. | `configured-resources.ts`, `plugin-catalog.ts`, Claude `adapter.ts`, `respawn-inputs.ts`, `extension-catalog.ts`, `processes.ts` |
| Claude · 하네스가 읽은 네이티브 MCP | MCP 탭. 전역 설정·플러그인 선언으로 열거하고 현재는 회색. 실제 Query 목록과 일치하지 않을 수 있다. | 등록된 이름은 유휴 Query에서 `toggleMcpServer(name, enabled)` 후 `mcpServerStatus()` 확인. 첫 입력도 같은 검사를 거친다. 미로드·프로젝트에 기록되는 경우는 §9.2. | Claude `configured-resources.ts`, `native-resources.ts`, `project-reconciliation.ts`, `adapter.ts` |
| Claude · Orca 내장 MCP와 도구 | 플러그인 탭의 Orca 카드/상세에 인증과 제공 도구가 나온다. 내장 서버용 하네스별 선택은 없다. Query 목록에서는 직접 주입된 서버가 필터된다. | 인증과 선택으로 `RuntimeToolSnapshot`을 하네스에 투영한다. `createSdkMcpServer → options.mcpServers`로 등록한 이름을 유휴 경계에서 제어한다. 고정 SDK가 in-process 서버 전환을 지원하지 않으면 같은 ID로 resume하고 주입 목록을 다시 구성한다. | `app/managed-mcp.ts`, `deployment/plugins.ts`, Claude `runtime-tools.ts`·`adapter.ts`, `ProviderDetail.tsx` |
| Claude · 사용자가 추가한 외장 MCP | MCP 탭 Orca 행·상세 토글이 공통 `mcpEnabled[name]`을 수정하고 재배포한다. 현재 Claude dist의 Orca 플러그인에는 enabled 서버만 들어간다. | 번들에 등록됐으면 실제 `plugin:orcinus-orca:<name>`으로 유휴 Query에서 토글한다. 빠진 서버의 ON은 해당 세션을 resume해 Orca가 해석한 외장 정의를 `options.mcpServers`에 주입한다. 출처별로 한 번만 등록하고 실제 SDK ID를 확인한다. | `handlers/mcp.ts`, `mcp/store.ts`, Claude `extensions.ts`·`adapter.ts`, `useMcpServers.ts` |
| OpenCode · 설치 네이티브 플러그인 전체 | 플러그인 탭. 전역 config의 선언을 installed/configured·회색 ON으로 표시하는 경로가 있다. | 안전한 live 전체 토글 API가 없다. 실제 활성/비활성 근거를 표시하고 스위치를 고정한다. 서버 재시작이나 directory 인스턴스 재생성으로 토글을 흉내 내지 않는다. | OpenCode v1 `configured-resources.ts`·`native-resources.ts`, `CustomizeList.tsx`·`CatalogToggle.tsx`, 전역 IPC capability 검사 |
| OpenCode · 하네스가 읽은 네이티브 MCP | MCP 탭의 전역 선언은 현재 토글 가능하다. 런타임의 프로젝트 관측은 읽기 전용이며 프로젝트 값이 전역 선택을 덮을 수 있다. | 등록된 SDK 이름에 `mcp.connect/disconnect({directory,name})`를 적용한다. 같은 서버·directory의 실행 중 응답이 모두 끝난 후, 다음 제출 전까지 status를 확인한다. | OpenCode v1 `configured-resources.ts`·`mcp-control.ts`·`session-context.ts`·`channel.ts`, `harnesses/opencode/mcp-reconcile.ts` |
| OpenCode · Orca 내장 MCP와 도구 | Orca 카드의 인증·도구 목록. 등록된 bridge alias는 런타임에서 Orca 출처로 표시되고 비활성 항목은 필터된다. 독립 사용자 선택이 없다. | 등록 alias에 **인증 valid AND 사용자 ON**이면 connect, 그 밖에는 disconnect한다. 동일한 directory 안전 경계를 사용한다. `read`·`bash`는 OpenCode 자체 도구이고 `session.create`의 permission 및 승인 흐름에 속한다. | `app/managed-mcp.ts`, OpenCode v1 `managed-mcp.ts`·`adapter.ts`의 `active/choices`·`mcp-control.ts`, 카탈로그 카드 |
| OpenCode · 사용자가 추가한 외장 MCP | MCP 탭 공통 토글. 등록 정의와 선택을 나누어 alias에 `enabled:false`를 주입한 후 연결한다. | 기존 사용자 정의를 재사용해 해당 하네스 선택으로 alias를 connect/disconnect한다. 순수 토글은 연결 revision만 바꾸고 서버 실행 옵션·정의 revision은 유지한다. 적용 시점은 네이티브 MCP와 같다. | `mcp/store.ts`, `mcp/managed-source.ts`, OpenCode v1 `managed-mcp.ts`·`adapter.ts`·`mcp-control.ts`, `McpDetail.tsx` |

고정 패키지는 Claude SDK `0.3.296`, OpenCode SDK `1.18.27`이다. 현재 트리의 기본 `createPluginBindings()`는 빈 배열을 반환한다. 내장 Jira 인수에는 실제 Jira 도구 구현을 조립한 테스트 배포와 fixture 인증을 사용한다. [패키지 고정값](../../../app/package.json) · [기존 실제 CLI 인수 fixture](../../../app/src/main/app/managed-mcp.cli.integration.test.ts)

### 9. 데이터와 실행 경로

#### 9.1 전역 선택을 영속화하는 곳

현재 `extensionSetEnabled → extensionControl.setGlobal`은 메모리를 갱신한다. agent host 배선은 `void mirror.patch({ nativeExtensionChoices })`를 호출하고 data host는 일반 `SettingsStore.patch`로 받는다. `SettingsPatchSchema`는 이 키를 받지 않으며 전용 `setNativeExtensionChoices`는 저장해도 `onPatch`를 발행하지 않는다. 현재 메모리/주입 저장소 단위 테스트만으로 재시작을 보증할 수 없다. [agent host](../../../app/src/main/app/agent-host/bootstrap.ts) · [data host](../../../app/src/main/app/data-host/agent-link.ts) · [설정 저장소](../../../app/src/main/infra/settings-store.ts)

* data host의 기존 전용 저장 경로에 **하네스·출처·항목 하나**를 쓰는 연산을 연결한다. 최종 정본에 병합·저장한 뒤 변경 키와 확정 revision을 통지하고 응답한다. 쓰기 실패 시 이전 정본과 revision을 유지한다. 일반 설정 patch의 허용 범위는 유지한다.
* 기존 `nativeExtensionChoices[backend]`의 네이티브 `plugin:<설치 키>`·`mcp:<SDK id>`를 읽는다. 내장·사용자 서버는 출처와 안정적인 sourceId를 포함한 별도 키로 식별한다. hash·표시명·번역된 제목·OpenCode 실행 alias는 영속 키로 쓰지 않는다. 같은 이름의 네이티브/내장/외장을 구분한다.
* 외장 정의·비밀은 `McpStore` 하나가 소유한다. 구버전 `mcpEnabled`는 하네스별 명시값이 없는 외장 항목의 초기 선호로 읽는다. 이후 하네스별 토글은 다른 하네스의 값과 등록 정의를 보존한다. 이름 변경·삭제 시 해당 출처의 선택을 함께 이동·정리한다. 구 `projectMcpChoices`는 승계하지 않는다.
* GUI는 선택과 실제 상태를 분리해 같은 항목의 목록·상세가 같은 관측을 읽게 한다. 내장 서버와 외장 정의에는 하네스별 스위치를 제공하고 인증 동작과 사용자 선택을 독립시킨다. 여러 Query의 상태가 갈리면 마지막 응답 한 건으로 전역 연결 완료를 표시하지 않는다.
* 회색 행은 Claude의 실제 로드 목록·서버 status, OpenCode의 유효 config·서버 status·플러그인의 실행 관측에서 값을 얻는다. OpenCode의 현재 파일 검색이 선언마다 설정하는 `enabled:true`만으로 실행 ON을 판정하지 않는다. 목록을 열기 위한 숨은 Query 생성, 서버 재시작, 인스턴스 dispose는 필요하지 않다.

#### 9.2 Claude 입력 경계와 SDK 한계

1. 전역 저장 핸들러에서 0283의 `prepare → plan → confirm → close(targets)` 및 확인 대화상자를 제거한다. 앱 종료·사용자 취소·명시적 세션 폐기의 기존 경로는 각각의 소유자가 계속 집행한다.
2. 사용자 입력을 실제로 보낼 때 세션이 적용한 선택과 최신 선택을 비교한다. 첫 턴·재개·warm `pushTurn`·이전 응답 뒤 큐에 보관한 **다음 사용자 입력**에 같은 검사를 둔다. 기존 응답의 자동 도구 루프·승인·잔여 출력은 원래 선택으로 끝낸다. 현재 초기 입력은 `createSessionInputStream(initialInputs)`에서 바로 소비될 수 있어, 새 Query도 첫 사용자 메시지를 보류한 채 제어 채널부터 준비할 수 있어야 한다.
3. 플러그인 구성이 달라졌으면 해당 세션의 끝난 채널만 정리한다. `query({prompt, options:{resume: nativeSessionId, cwd, plugins, settings, …}})`로 기존 대화를 열고 최신 roots·`<name>@inline`·명령/스킬 범위를 조립한다. 설치 키 중복 주입과 프로젝트 설정의 역전을 막는다. Orca ID↔native ID 매핑, 대기 입력 UUID·첨부를 승계한다. 재개 실패는 해당 입력 오류로 돌려주며 빈 대화·fork로 대체하지 않는다. 명시 선택에 변화가 없으면 warm Query를 재사용한다.
4. 단일 MCP에서는 Query의 `mcpServerStatus()`를 출처·정확한 SDK 이름으로 대조한다. 등록된 서버만 `toggleMcpServer` 후 상태를 재조회한다. 단순 플러그인 reload로 번들 MCP가 잔류한 사례는 사용자 보고다. 이번 설계의 입력 없는 local plugin 탐침에서는 명령 제거만 관측했고 번들 MCP의 최초 연결은 관측하지 못했다. 구현 판정은 AC5의 **사전 연결 및 호출 성공 → OFF → 복구**로 한다. `setMcpServers({})`도 SDK 타입 계약상 플러그인 소유 서버를 일괄 제거하지 않는다.
5. 전역 목록에만 있는 MCP는 설정 출처와 소유자를 확인한다. 하네스가 승인하여 읽을 수 있는 동일한 전역 정의라면 다음 Query 옵션에 명시적으로 포함하는 경로를 시험하고 실제 로드·호출 후 제어 가능으로 분류한다. 프로젝트 승인·정책상 로드 불가하거나 동일 이름의 다른 서버만 있으면 회색·미로드 사유를 표시한다. 일단 지원으로 받아들인 ON을 특정 세션에서 실현하지 못하면 실패를 드러내고 그 입력을 보존한다. 부모 OFF로 인한 미로드는 의도된 OFF다.
6. SDK가 OFF를 `.claude.json`의 Git 루트에 쓸 수 있다. 격리된 홈과 Git 루트 A/하위 B에서 이번 세션에 0278 탐침을 재실행한 결과는 `initialA=connected, afterA=disabled, disabledSavedAt=["A Git root"], firstB=disabled`였다. 앱 선택은 data host가 소유하며 새 Query/재개 시 반드시 자기 cwd의 실측과 대조한다. 파일 감시기는 SDK 자기 쓰기를 전역 선택으로 역수입하거나 실행 중인 형제 Query를 재시작하지 않는다. 같은 루트의 SDK 쓰기를 순서화하고 관련 없는 프로젝트 키를 통째로 복원하지 않는다. [탐침](../0278-harness-extension-isolation/evidence/claude-cwd-probe.mjs)

#### 9.3 OpenCode의 공유 연결

`OpenCodeMcpControl`은 서버 인스턴스·정규화한 directory별 연결을 공유한다. 현재 `choices()`는 defaults → global → project → managed 순이며, `submit()`은 일반 ON 연결을 최대 2초 기다린 뒤 실패/미완료 상태로도 제출할 수 있다. `activate()`와 조회 재시도에서도 연결을 시작할 수 있다. [제어와 제출 경로](../../../app/src/main/adapters/opencode/v1/mcp-control.ts) · [directory 활동 판정](../../../app/src/main/app/harnesses/opencode/mcp-reconcile.ts)

* 활성 채널·승인 대기·응답 소유 백그라운드 작업을 포함해 **그 연결을 쓰는 모든 응답**이 끝날 때까지 선택으로 인한 connect와 disconnect를 보류한다. 같은 서버의 다른 directory는 별도로 진행한다. 새 입력 대기자를 실행 중인 응답으로 세어 서로 영원히 기다리게 하지 않는다.
* 기존 directory 직렬화에 상태 적용과 제출 예약을 함께 둔다. 준비·메뉴 조회·타이머 reconcile·재시도·첫 prompt·후속 prompt/command 모두 같은 안전 판정을 통과한다. SDK 제출과 해당 응답의 점유 등록 사이에 다른 연결 변경이 끼어들지 않게 한다. 신규 설정이 없는 평상시 입력은 기존 동시성 규칙을 따른다.
* 실제 ID에 대해 OFF는 pending ON을 정리한 뒤 disconnect 및 status를 확인한다. ON은 연결이 확인될 때까지 해당 선택을 요구하는 입력을 보류한다. 실패하면 저장한 선택과 오류를 함께 표시한다. 늦은 connect, 선택 재변경, 동일 값 재시도 때 최신 revision과 status를 다시 확인한 뒤 입력을 한 번만 전달한다.
* `projectManagedMcp`의 `enabled:false` 등록, 기존 alias·bridge·권한 검사를 재사용한다. 등록된 내장/외장 서버의 토글은 `definitionRevision`이나 실행 프로필을 바꾸지 않는다. OFF라고 등록/인증 정보를 삭제하거나 auth를 revoke하면 다른 하네스와 진행 중 호출까지 끊긴다. 인증 철회는 별도 사건이다. [등록 프로젝션](../../../app/src/main/adapters/opencode/v1/managed-mcp.ts) · [revision 생성](../../../app/src/main/features/extensions/common/mcp/managed-source.ts)
* 현재 `createManagedMcpSource`는 미인증 내장을 plugin 목록에서 빼고 `mapMcpResources`의 호출자는 미활성 alias도 걸러낸다. nav의 내장 행은 배포 선언에서 유지하고 실행 상태만 인증·연결에서 읽는다. 인증 만료 후 재인증해도 이미 저장한 OFF를 잃지 않는지 확인한다.

#### 9.4 0278의 복사 경로와 제거 범위

| 소유자 | 현재 생성·소비 경로 | 구현 후 SDK가 읽을 곳 |
| --- | --- | --- |
| 사용자가 설치한 Claude 플러그인 | `<Claude config>/plugins/installed_plugins.json`의 적용 가능한 `installPath`를 `plugin-catalog.ts`가 해석한다. `adaptPlugins(…, nativePlugins.roots)`의 두 번째 인자로 들어간다. | 활성 설치의 **원래 절대 installPath**. 설치 디렉터리·registry를 이동·복사·삭제하지 않는다. |
| Orca 조립 플러그인 | `deploy('claude') → renderClaudeHarnessPlugin`이 `~/.config/orcinus-orca/dist/claude/plugins/orcinus-orca`에 manifest·Orca 스킬·해석한 `.mcp.json` 등을 만든다. Windows에서도 `ooConfigDir()`는 사용자 홈 아래다. | **해당 dist 디렉터리**를 SDK `options.plugins[{type:'local',path}]`에 전달한다. Jira 같은 runtime 내장 서버는 별도 `options.mcpServers`에서 주입된다. |
| 사용자 스킬 래퍼 | `renderClaudeUserSkillsPlugin`이 같은 dist의 `plugins/claude`에 manifest와 `skills` 링크를 만든다. 링크는 설정된 Claude 스킬 원본(기본 `~/.claude/skills`)을 가리키는 Windows 정션/POSIX 심링크다. | **dist의 래퍼 루트**. SDK가 링크를 통해 원본을 읽고 `claude:<스킬>` 네임스페이스를 유지한다. 원본이 없으면 래퍼를 생략한다. |
| 0278 AppData 실행 사본 | agent host가 `hostEnvironment().userData/runtime-plugins`에 `PluginSnapshots`를 만든다. 프로덕션 Windows 경로는 `%APPDATA%/orcinus-orca/runtime-plugins/generation-*`다. | **제거**. SDK 옵션에 세대 경로가 들어가는 경우 0건. 별도 Work 프로필 등 publication 목록 밖의 유효 루트는 기존 경로로 통과시킨다. |

현재 호출 순서는 다음과 같다.

1. 첫 settings 사본·MCP/스킬 CRUD → `ExtensionDeploymentService.deployNow/ensureDeployed` → Claude 배포 성공·검증 → `publish(claudePluginRoots())`. 그 배열은 표의 **dist 루트 두 개**다. [배포 조립](../../../app/src/main/app/harnesses/claude/extensions.ts) · [배포기](../../../app/src/main/features/extensions/claude/deployer.ts)
2. `publish`는 `mkdtemp('generation-')` 후 manifest가 있는 루트를 순서대로 `<generation>/0`·`1`에 재귀 복사한다. 링크를 따라가지 않는다. 등록되지 않은 다른 루트를 `capture`하면 원래 경로로 통과한다. [사본 소유자](../../../app/src/main/infra/config/plugin-snapshots.ts)
3. `ClaudeAdapter.sendMessage → extensionSnapshots.get(pluginPathKey(cwd)) → capture`가 변환된 roots와 스킬 목록을 첫 소유자 기준으로 묶는다. 같은 cwd의 다음 Query도 이를 재사용한다. 재배포 후 이전 세대는 마지막 참조 해제 또는 종료 drain까지 남는다. [어댑터](../../../app/src/main/adapters/claude/adapter.ts)

**제거 순서.** deploy 완료 → publish 콜백, agent host 생성·주입·종료 정리, 공용 `PluginSnapshotPort/Lease`, Claude adapter의 cwd 맵·참조계수를 한 변경으로 걷어 낸다. 검증된 dist roots와 최신 스킬 목록을 직접 쓰고, 세션은 적용한 선택/배포 revision만 기억한다. 순수 토글에서 전체 dist를 재생성하지 않는다.

정의·스킬 편집에 따른 재배포는 쓰기 직렬화와 마지막 정상 배포를 보전한다. 현재 배포기는 dist를 `.bak`으로 옮긴 뒤 새로 쓰므로 SDK가 빈/반쪽 디렉터리를 열 수 있다. 새 내용을 임시 위치에서 검증한 뒤 동일한 dist 경로에 게시하고, 게시 중 새 Query의 초기화는 기다리게 한다. 실행 중 응답이 기존 파일을 읽을 수 있는 구조 변경은 그 읽기가 끝난 뒤 게시한다. 실패 시 정상본 복구 또는 해당 입력 보류를 검증하고, 기존 `.bak`의 MCP 비밀 스크럽과 파일 접근 제한을 보존한다.

업그레이드 첫 부팅에서 이전 실행 소유자가 없는 것을 확인한 뒤 **앱 전용 `runtime-plugins` 직계 `generation-*`** 잔존물만 정리한다. 링크 대상을 따라가지 않고 잠긴 파일은 다음 안전한 기동에서 재시도한다. 정리 전용 코드는 디렉터리를 만들지 않는다. `installPath`, dist, 스킬 원본, 별도 프로필·다른 userData는 정리 대상에서 제외한다.

### 10. 계약을 강제할 자리

검색식은 저장소 루트에서 `rg -n '<식>' app/src -g '!*.test*'`로 실행한다. 각 행의 화살표는 구현·검증에서 실제 운반 값을 관측할 자리다.

| 자리 · 검색식 | 진입점 → 강제 지점 | 직접 oracle과 구별 입력 |
| --- | --- | --- |
| E1 · `extensionSetEnabled\|mcpUpdate\|canToggle\|managedSource` | 목록·상세 → 하네스/출처별 IPC → 검증된 항목 및 capability → 각 창의 선택·관측 상태 | `useNativeMcpCatalog.test.ts`·`ExtensionsCatalogView.interaction.test.ts`와 등록 handler. 고정 ON/OFF, 미로드, pending/실패, 이름 충돌, 지각 응답, 직접 요청 |
| E2 · `nativeExtensionChoices\|mcpEnabled\|settings.write` | data host 항목 병합 → 저장소 → agent mirror/재접속 → 다음 입력의 선택 | `extension-control.test.ts` 단위와 `data-host/agent-link.test.ts`의 실제 쓰기·사본 통합 확장. 동시 형제 쓰기, legacy false, ENOSPC, 재시작·지연 통지 |
| E3 · `initialInputs\|pushTurn\|resume:\|toggleMcpServer\|enabledPlugins` | Claude 새/기존 Query의 roots·flags 결정 → 초기/후속 사용자 입력 → SDK 요청·명령/도구 | `adapter.native-plugins.test.ts`·`native-resources.test.ts` + §19 Claude 실환경. 반대 프로젝트 값, 미등록, ON/OFF/ON, 부모 OFF·자식 ON, 중복 설치 이름, 재개 실패 |
| E4 · `mcp\.connect\|mcp\.disconnect\|reconcileChoices\|submitPrepared\|definitionRevision` | OpenCode 정의/alias → directory의 활동·연결·status → 첫/후속 prompt 및 command | `mcp-connection.test.ts`·`session-context.test.ts` + §19 실제 CLI. busy·동시 입장, 느린 성공·실패·뒤늦은 연결, cwd A/B, PID·dispose |
| E5 · `runtimeTools\|credentialRevision\|authorized\(\)\|managedMcpReferences\|configurationPending` | 인증+선택 → 하네스별 도구 등록/연결 → composer·nav의 실제 상태 → 호출 승인·핸들러 | `managed-mcp-projection.test.ts`·`managed-mcp.cli.integration.test.ts`와 Claude `runtime-tools.boundary.test.ts`. 인증×선택 네 칸, 인증 복구, 동명 출처, 서버별 호출 표식 |
| E6 · `pluginRoots\|runtime-plugins\|generation-\|installPath\|ensureDeployed` | 부팅·CRUD 배포 → dist 두 루트/원본 설치 → SDK 경로 → 정리 | `harnesses/claude/extensions.test.ts`·`managed-mcp-claude-regression.test.ts` 확장. 정상·빈 래퍼·잠긴 구 사본·게시 실패·재시작, 파일 생성 이벤트와 실제 스킬/서버 실행 |

**실패 판정.** SDK 제어 호출이 resolve해도 해당 입력이 낡은 도구를 받거나 실제 OFF 호출이 성공하면 실패다. 선언된 프로젝트 승인·기업 정책을 우회해 다른 cwd의 동명 서버를 등록하는 것도 실패다. 원래 설치·승인 범위가 다른 프로젝트 전용 정의, 일반 CLI에서 별도로 실행 중인 대화, 실제 사용자의 외부 서비스 가용성은 전역 Orca 세션 인수의 분모 밖이다.

### 11. 교체할 테스트와 유지할 테스트

파일명은 기준 트리의 현행 테스트다. 0278 설계 문서에 남은 과거 테스트명을 그대로 복원하지 않는다.

| 처리 | 기존 파일·케이스 | 변경 후 잠글 행동 |
| --- | --- | --- |
| 교체 | Claude [adapter.native-plugins.test.ts](../../../app/src/main/adapters/claude/adapter.native-plugins.test.ts)의 `pins deployed MCP files for same-cwd peers …`, `applies current global plugin choices … while live queries keep theirs` | 진행 중인 응답만 옛 상태로 완주한다. A의 새 peer, 기존 peer의 다음 입력, B의 첫 입력 모두 최신 선택이다. 마지막 소유자가 닫힐 필요가 없다. |
| 교체 | [plugin-snapshots.test.ts](../../../app/src/main/infra/config/plugin-snapshots.test.ts)의 세대 pin/reclaim과 [extensions.test.ts](../../../app/src/main/app/harnesses/claude/extensions.test.ts)의 immutable publication. [managed-mcp-claude-regression.test.ts](../../../app/src/main/app/managed-mcp-claude-regression.test.ts)의 publish callback 단언 | 구 사본 단위를 제거한다. production 배포기·adapter에 실제 임시 홈을 주어 SDK가 읽은 dist/설치 경로 및 내용, 재배포 직렬화·실패 복구·AppData 생성 0회를 단언한다. |
| 교체 | [extension-catalog.test.ts](../../../app/src/main/app/handlers/extension-catalog.test.ts)의 `saves and closes … busy check`, `rejects confirmed: false …`, in-memory-only 기대와 [processes.test.ts](../../../app/src/main/app/harnesses/claude/processes.test.ts)의 세션/lease 일괄 폐기 | 실제 토글 handler → 내구 저장, busy/idle 어느 쪽도 close·abort·discard 0회. 응답 후 다음 입력에서만 해당 Query를 resume한다. 저장 실패 후 재시도 및 형제 키 보존을 검증한다. |
| 교체 | [useNativeMcpCatalog.test.ts](../../../app/src/renderer/src/features/skills/hooks/useNativeMcpCatalog.test.ts)·[ExtensionsCatalogView.interaction.test.ts](../../../app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.interaction.test.ts)의 busy 종료 확인, 취소, 확인 중 잠금 및 단/복수 대화상자 | 진행 중에도 한 번 클릭해 저장하고 “다음 입력에 적용”을 표시한다. 저장 직렬화·다른 하네스 조작·실패 재시도는 유지한다. transport fixture의 구 `confirm` 응답도 교체한다. |
| 분리·교체 | Claude [native-resources.test.ts](../../../app/src/main/adapters/claude/native-resources.test.ts)의 `rejects both MCP toggle directions …`, [configured-resources.test.ts](../../../app/src/main/adapters/claude/configured-resources.test.ts)의 `below project selections`; OpenCode [mcp-control.test.ts](../../../app/src/main/adapters/opencode/v1/mcp-control.test.ts)의 `preserves project overrides` | nav의 지원되는 **전역** 선택은 양방향 제어하고 프로젝트 반대값보다 우선한다. 미지정 기본값·미지원 직접 요청 및 별도 프로젝트 UI의 안전 제한은 각각 유지한다. |
| 분리·교체 | OpenCode [mcp-connection.test.ts](../../../app/src/main/adapters/opencode/v1/mcp-connection.test.ts)의 `admits submissions within the bound`, `… but not connect failure` | 명시 ON 미완료·실패 시 요청 0회. 늦은 ON보다 새로운 OFF 우선, 취소 및 OFF 실패 시 보류를 보존한다. 동일 directory에서 준비·조회에 의한 선행 connect도 잡는다. |
| 유지·확장 | [session-context.test.ts](../../../app/src/main/adapters/opencode/v1/session-context.test.ts)의 `reconciles current global choices for idle directory peers …`, [mcp-reconcile.test.ts](../../../app/src/main/app/harnesses/opencode/mcp-reconcile.test.ts), [instance-retention.test.ts](../../../app/src/main/adapters/opencode/v1/instance-retention.test.ts) | directory별 이벤트/캐시·사용 중 보호, 정상 종료·LRU 회수는 유지한다. 토글 시 PID·session ID 동일 및 dispose 0회를 별도 관측한다. |
| 유지·확장 | Claude [adapter.native-history.test.ts](../../../app/src/main/adapters/claude/adapter.native-history.test.ts), [plugin-state.test.ts](../../../app/src/main/adapters/claude/plugin-state.test.ts), [runtime-tools.boundary.test.ts](../../../app/src/main/adapters/claude/runtime-tools.boundary.test.ts), [deployer.test.ts](../../../app/src/main/features/extensions/claude/deployer.test.ts) | native ID/cwd·대화 이력, 기존 파일 편집의 형제 키/링크 보호, 세션별 호출 context, dist 스킬 래퍼·비밀 스크럽을 유지한다. 토글 시 파일 감시의 자기 쓰기 반례를 추가한다. |
| 유지·확장 | [extension-control.test.ts](../../../app/src/main/app/extension-control.test.ts), [settings-store.test.ts](../../../app/src/main/infra/settings-store.test.ts), [discard.test.ts](../../../app/src/main/app/chat-turn/discard.test.ts), [native-settings-lifecycle.test.ts](../../../app/src/main/app/native-settings-lifecycle.test.ts) | 미지정 native 기본값, 일반 patch 차단, 관련 없는 설정·명시적 폐기·앱 종료 시 저장 drain은 유지한다. data host 재시작을 거치는 전용 쓰기, 사용자 취소와 토글의 분리를 추가한다. |

### 12–18. 구현 순서와 회귀 경계

1. **저장·GUI** — 출처/하네스별 안정 키, 구 설정 승계, 전용 data write와 통지, 선택·관측·capability 표현을 연결한다. `shared/native-resources.ts`, `shared/protocol.ts`, 호스트 배선, 목록·상세·번역·transport와 [IPC 계약](../../IPC_CONTRACT.md)을 같은 변경에서 맞춘다.
2. **Claude** — Query 입력을 열기 전 검사, 플러그인 변경의 세션별 resume, MCP 실제 ID 대조를 연결한다. `runtime-entry.ts`·`respawn-inputs.ts`·`continuation.ts`와 `session-runtime.ts`의 cold/warm 양쪽을 다룬다. 진행 중 응답/held 입력을 폐기하던 전역 종료 배선은 제거한다.
3. **OpenCode** — 선택과 정의의 revision을 분리하고 등록된 서버만 공유 연결 경계에서 조정한다. 준비 화면의 조회·재시도와 실제 입력을 같은 상태 판정에 연결한다. 선택 불변 시 연결을 다시 열지 않고 같은 서버·directory·revision의 중복 연결 시도는 합친다.
4. **배포** — §9.4의 생성자·소비자·참조를 함께 제거한다. 부팅/CRUD, Work 프로필 루트, 링크 부재, Windows 게시 실패를 확인한다. 위 단계와 함께 [하네스 현재 구조](../../arch/backend/adapters.md)의 해당 동작을 구현 시점에 갱신한다.

### 19. 구현·검증 게이트

* **실제 모델 경계** — Claude는 고정 SDK와 동봉 CLI를 격리된 홈에서 실행하고 로컬 Anthropic 호환 endpoint에서 요청을 받는다. OpenCode는 [기존 CLI 통합 테스트](../../../app/src/main/app/managed-mcp.cli.integration.test.ts)의 로컬 모델·MCP 서버와 실제 permission 응답을 재사용한다. ON 요청은 고유 인자를 가진 도구 호출을 반환하고, OFF 요청은 같은 이름을 요구해 핸들러 미실행과 불가 결과를 확인한다. 명령은 CLI 명령 목록, 호출 시 주입된 고유 본문, 부모 OFF에서 실행 불가를 함께 검사한다. 지연 로드되는 도구는 정상 탐색 후 보이는 스키마와 실제 호출까지 수집한다.
* **동시성·재시작** — AC2의 테스트는 시간 추측 대신 응답·도구·연결 완료를 각각 해제할 수 있는 fixture를 사용한다. “토글 저장 → 기존 후속 도구 성공 → 기존 응답 종료 → 적용 → SDK 제출”의 순서, 사용자 입력 횟수, PID·ID·dispose 및 재시작 전후 영속값을 기록한다. OpenCode가 시작되지 않아 기존 CLI 테스트가 skip된 실행은 AC1·6의 증거로 채점할 수 없다.
* **Windows 배포·UI** — 설치본에서 두 탭의 실제 클릭으로 AC1–3·7–9를 반복한다. SDK roots와 파일 생성 이벤트를 수집해 `generation-*`가 생겼다가 삭제되는 경우도 잡는다. Jira fixture의 실제 결과와 사용자 스킬 본문 표식을 기록한다. 반례로 OFF root 재주입, `choices` 병합 순서 역전, 미완료 연결에서 SDK 제출, 토글 직후 전체 close를 각각 심으면 대응 AC가 실패해야 한다.
* **운영 게이트** — 구현 시 [CI 정본](../../../.github/workflows/ci.yml)의 가드·lint·typecheck·테스트·host/preload smoke를 수행하고 실환경 실행/skip을 구분한다. 이 설계 턴의 검증 범위는 기준 트리의 코드·테스트 좌표, 경로·문서 링크, §9.2의 SDK 관측이다. 모델 세 턴, Windows 설치본, PID·이력 인수는 구현 후 증거로 채운다.

### READY 대조

§8의 2개 하네스 × 4개 대상이 AC1·5–7에, 저장·응답 경계와 세대 사본 제거가 AC2–4·8–9에 각각 대응한다. §11의 실제 테스트명은 기준 트리에서 확인했다. §9.2의 입력 없는 SDK 탐침과 §19의 모델 요청 인수는 서로 다른 관측이다.

**구현자 기록** — WU별 변경·§10 자리별 테스트 및 결과·설계 차이·미검증 항목을 구현 턴에 기입한다.

**검증자 기록** — 기준 커밋·V pair 판정·실제 CLI/Windows 증거·파생 이슈를 검증 턴에 기입한다.
