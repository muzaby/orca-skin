# 0333 · 플러그인과 MCP의 하네스별 전역 선택을 다음 입력부터 적용한다

| 항목 | 값 |
| --- | --- |
| 상태 | plan / **READY** · 다음 담당 Codex · V1 + ΔV1 · r1 Windows 설치본 인수 실행계획 (§19-A) |
| 설계 | Codex · 사용자 요청에 따른 새 핸드오프 |
| 기준 트리 | `ccr-59ce68d5-h1xutf`의 `28f79eaf` |
| 추적 | V1 설계 `8fb06d6d` → ΔV1. PR #656의 0333 리뷰 다섯 항목을 §7·§8–11에 반영했다. [리뷰 원문](https://github.com/muzaby/orca-skin/pull/656#issuecomment-7193458574) |

## Part I — Product & UX Contract

### 1–2. 목표와 요구 출처

nav → **플러그인**의 **플러그인**·**MCP** 탭에서 한 번 바꾼 선택을 해당 하네스의 모든 Orca 세션이 공유한다. 사용자는 실행 중인 응답을 끝까지 받고, 같은 대화의 다음 입력이나 다른 폴더에서 연 새 대화의 첫 입력부터 선택한 도구와 명령을 쓸 수 있다.

사용자 인수 기준은 “모델이 실제로 받는 도구·명령과 호출 가능 여부”다. “SDK로 제어할 수 없는 항목은 실제 ON/OFF 상태를 보여 주되 토글을 회색으로 고정한다.” 적용 대상은 아래 §8의 여덟 행이다.

### 3. 결정 원장

| ID | 상태 | 결정과 근거 | 인수 |
| --- | --- | --- | --- |
| D1 | ACTIVE · 사용자 | “작업경로가 달라도 같은 전역 선택을 따른다.” 같은 하네스·같은 항목의 명시 선택이 cwd의 ON/OFF 기본값보다 우선한다. | AC1·3·4 |
| D2 | ACTIVE · ΔV1 | Claude는 화면의 응답과 해당 Query가 소유한 작업·호출의 결과 전달이 끝난 뒤에만 선택을 적용한다. OpenCode는 해당 연결을 공유하는 작업의 완료를 기다린다. | AC2·3 |
| D3 | ACTIVE · ΔV1 | 항목이 실제 제공하는 기능으로 ON → OFF → ON을 판정한다. 명령·훅·번들 MCP를 함께 제공하는 플러그인은 세 기능이 모두 전환되어야 한다. | AC1·5 |
| D4 | ACTIVE · 사용자 | Claude 대화 ID·이력을 지킨다. OpenCode의 MCP 선호 변경으로 서버 PID·세션 ID를 바꾸거나 작업경로 인스턴스를 폐기하지 않는다. | AC2·3·6 |
| D5 | ACTIVE · ΔV1 | 고정 SDK로 같은 대화·진행 중 작업을 보존하며 다음 입력(새 세션은 첫 입력)에 적용할 수 있어야 토글을 활성화한다. 내장 MCP의 실제 연결에는 인증과 선택이 모두 필요하다. | AC5·6·7 |
| D6 | ACTIVE · ΔV1 | Claude·OpenCode 양쪽에서 Orca가 하네스 네이티브 플러그인의 **버전 선택·고정·복사·보관·복원**을 하는 경로는 0건이어야 한다. 0278 세대와 cwd 보유를 제거하고 Orca 배포 플러그인·사용자 스킬을 계속 제공한다. | AC8 |
| D7 | ACTIVE · 설계 선택 | 지원되는 서버의 명시 ON 연결이 지연·실패하면 그 서버를 멘션하지 않은 일반 메시지도 보류한다. 입력·첨부를 보존하고 재시도 또는 해당 서버 OFF 후 전송을 제공한다. | AC9 |

0278의 **명시 선택보다 프로젝트 우선·cwd별 이전 배포 유지**는 D1·D6으로, 0283의 **토글 시 확인 후 모든 Claude 프로세스 종료**는 D2·D4로 대체한다. ACTIVE 결정과 AC를 대조했으며 일곱 결정 모두 위 표의 행동 단언에 대응한다.

### 4–6. 사용자 흐름과 범위

| 시점 | 화면과 대화에서 관측할 결과 |
| --- | --- |
| 클릭 → 저장 | 해당 하네스와 항목을 표시한다. 영속 저장을 확인한 뒤 모든 창에 선택을 알린다. 저장 실패 시 기존 값과 응답을 보존하고 해당 행에 실패·재시도를 표시한다. |
| 저장 → 적용 대기 | 선택은 ON/OFF로 표시하고, 기존 응답이 쓰는 실제 상태가 다르면 “다음 입력에 적용”을 함께 표시한다. 세션마다 상태가 다르면 각각의 관측 또는 적용 대기 수를 보여 준다. |
| 새 입력 → 전송 | 해당 입력을 SDK에 넘기기 직전 최신 선택을 확인한다. 입력에 연결된 도구 상태가 확정되면 한 번 전송한다. 빠른 OFF→ON은 대기 중에도 마지막으로 저장한 값으로 재판정한다. |
| ON 대기·실패 | 연결 중에는 입력 내용·첨부를 보존하고 취소할 수 있다. SDK 시간 초과, 연결 실패, 해제 확인 실패 시 **모델 전송 0회**다. 행 및 입력 영역에 원인과 재시도를 표시한다. 취소한 입력은 뒤늦은 연결 성공으로 보내지 않는다. |
| 읽기 전용 | SDK로 안전하게 제어할 수 없는 이유를 표시한다. 실행이 확인됐으면 회색 ON/OFF, 설정만 있으면 “설정됨·실행 미확인”이다. 특정 세션의 미등록·출처 불명은 그 세션에 표시한다. 다른 세션의 지원 판정과 전역 선호는 보존한다. |
| 내장 인증 | 미인증인 내장 서버는 실제 OFF·“인증 필요”로 표시하고 일반 입력을 허용한다. 인증 실패·만료 또는 일시적 연결 실패는 지원되는 행의 적용 상태로 표시하며 토글로 OFF를 선택할 수 있다. 첫 인증·재인증 뒤에도 저장된 OFF를 지킨다. 인증 철회는 기존 인증 계층이 즉시 집행한다. |

플러그인 **설치·삭제**, 인증·권한 정책 변경, 모델 제공자 설정 변경은 이 작업의 범위 밖이다. 번들 서버를 개별로 끈 뒤 부모 플러그인을 OFF→ON해도 자식의 명시 OFF는 보존한다. 부모 OFF 동안에는 자식의 명령·도구를 실행할 수 없다.

### 7. 인수 조건

아래 항목은 구현·검증 턴에서 수행한다. 각 관측에 하네스·항목 출처·입력 UUID·세션 ID를 붙이고 요청에서 도구 이름과 호출 결과만 발췌한다.

| ID | 입력과 관측 | 통과 조건 |
| --- | --- | --- |
| AC1 | 지원되는 §8 각 행에서 같은 대화로 **ON → OFF → ON** 세 턴을 보낸다. 실제 SDK/CLI의 모델 요청을 로컬 endpoint에서 수신한다. 명령·훅 전용 플러그인은 AC5의 기능별 표식을 함께 채집한다. | 도구 제공 시 첫째·셋째 요청의 스키마와 호출 결과가 확인되고 둘째는 스키마 부재·강제 호출 시 핸들러 0회다. 대조군 도구는 계속 호출된다. 명령·훅 전용은 세 턴 모두 해당 기능의 1·0·1 실행으로 판정한다. |
| AC2 | 각 하네스에서 폴더 A에 S1·S2, 폴더 B에 S3를 연다. S1과 S3의 다단계 응답을 도구 호출 직전에 멈춰 토글하고 S2에 새 입력을 넣는다. 이전 응답의 후속 모델 요청·도구 결과·종료 이벤트까지 수집한다. | 두 응답 모두 기존 도구로 완주한다. S1·S2·S3 각각의 다음 사용자 입력은 최신 상태다. OpenCode S2는 A의 응답이 끝날 때까지 대기하고 B는 A와 독립적으로 진행한다. Claude S2는 S1과 독립적으로 진행한다. Claude는 S1의 답변 종료 뒤에도 서브에이전트 또는 MCP 호출이 남는 두 경우에 §11 T2의 순서와 정확히 한 번 전송을 만족한다. |
| AC3 | S1을 유지한 채 같은 cwd에 S4, 다른 cwd에 S5를 열어 첫 입력을 보낸다. 앱·데이터 호스트를 정상 재시작한 뒤 기존 대화 재개와 새 대화를 반복한다. | 첫 요청부터 마지막으로 저장한 값이 적용된다. Claude의 Orca ID·native ID 및 이전 대화 표식이 유지되고 사용자 입력 중복·이력 누락·새 대화 생성이 없다. |
| AC4 | A와 B의 프로젝트 기본값을 반대로 놓고 전역 OFF/ON, 미지정, 다른 하네스에만 같은 이름이 있는 경우를 시험한다. OpenCode는 동일 서버의 서로 다른 기본값과 서로 다른 서버가 같은 이름 `docs`를 쓰는 경우(§11 T3)를 각각 시험한다. 두 창의 동시 저장·쓰기 실패·재접속도 포함한다. | 같은 서버는 양쪽 cwd에 같은 명시값을 적용한다. 다른 서버를 가리키거나 출처가 불확실한 cwd에서는 동명 서버 제어 0회이며 제한 사유가 보인다. 미지정 항목은 기존 기본값을 따른다. 형제 항목·하네스와 직접 편집한 무관 키는 보존된다. 재시작 후 기능 재현과 실제 저장 바이트가 일치한다. |
| AC5 | Claude에서 ① 명령 전용 ② 훅 전용 ③ 번들 MCP 전용 ④ 명령·훅·번들 복합 플러그인을 시험한다. manifest 이름 생략·SDK 식별 가능, 이름 충돌·식별 불가, 부모/자식 반대값, 미로드 MCP와 Git-root 저장을 포함한다. | ON/OFF/ON 각 턴의 명령은 고유 본문 실행, 훅은 같은 이벤트당 실행 횟수 1/0/1, MCP는 모델 요청과 호출 결과(AC1)로 판정한다. 복합 플러그인의 OFF에서는 명령 목록·모델 안내·훅·번들 도구가 함께 사라진다. 식별 불가 항목은 사유를 표시하고 타 설치 제어 0회다. |
| AC6 | OpenCode의 등록된 네이티브·내장·외장 MCP 각각에서 AC1·2를 실행한다. 열린 세션에 없던 내장(첫 인증)·외장(MCP 탭에서 추가)도 §11 T4의 지원·제한 양쪽 경로로 시험한다. PID·session ID와 dispose API·이벤트를 채집한다. | 변경 구간 전후 PID·각 session ID가 같고 **토글로 인한 작업경로 인스턴스 dispose 0회**다. 등록된 내장은 valid+ON에서만 호출된다. 뒤늦게 생긴 서버도 안전한 SDK 경로가 있으면 같은 대화의 다음 입력으로 호출하고, 없으면 그 세션의 실제 상태·제한 사유와 새 세션 첫 입력을 확인한다. `read`·`bash`의 기존 세션 권한과 승인 흐름은 유지된다. |
| AC7 | 회색 ON/OFF 두 입력을 목록 및 같은 항목의 상세에 렌더하고 클릭·키보드·직접 IPC를 시험한다. 설치만 발견한 경우와 선택 ON·실제 실패를 추가한다. | 읽기 전용 상태를 구별할 수 있고 조작으로 저장·SDK 변경 0회다. 설정 발견·실패를 연결 성공으로 표시하지 않는다. 지원 불가 사유와 세션별 제한이 보인다. 지원되는 행의 일시적 인증·연결 실패에는 재시도 또는 OFF가 가능하다. |
| AC8 | 깨끗한 Windows 사용자 데이터와 이전 `generation-*` 잔존 데이터로 각각 부팅한다. 부팅·토글·재배포·재시작·배포 실패와 복구 후 SDK 경로를 수집한다. 두 하네스의 자체 설치 업데이트 전후를 §11 T5로 비교한다. | 새 세대 생성·옛 cwd 참조 및 두 하네스 네이티브 플러그인의 Orca 버전 관리 경로는 각각 0건이다. 업그레이드 전 잔존 사본만 정리하고 설치 원본·레지스트리·링크 대상을 보존한다. 하네스 자체 업데이트 뒤 새 설치를 인식한다. 첫 유효 배포 및 재배포 후 Claude에서 `claude:<fixture-skill>`을 실행하고 인증된 내장 및 외장 도구의 서로 다른 결과를 받는다. |
| AC9 | 명시 ON 연결을 기존 2초보다 늦게 성공시키거나 실패시킨다. 같은 cwd 동시 입력, 대기 중 OFF, OFF 해제 실패, 사용자 취소·재시도를 시험한다. | 대기·실패 중 모델 요청 0회. 성공 뒤 최신 선택으로 한 번만 전송한다. 일반 메시지도 실패 시 초안·첨부가 유지된다. 재시도 성공 또는 해당 서버 OFF 확인 후 기존 입력 1회 전송, 취소 후 전송 0회다. 실제 상태와 행 표시가 일치한다. |

### 7-A. V 추적

ΔV1은 V1의 같은 ID를 아래 표로 대체한다. R1·SD1·AR2·MD1은 CHANGED / REQUIRED, 전역 저장·통지의 AR1은 INHERITED / REGRESSION이다. §10의 자리별 관측에 §11 T1–T5의 입력·판정을 결합한다.

| Pair | 제품 경로 | §10 · 직접 증거 |
| --- | --- | --- |
| R1 ↔ AT1 | nav → 하네스·출처별 행 → 모델 요청 → 실제 도구 결과/명령 본문 | E1·E3·E4·E5, AC1·5·7. §11 T1·T3·T4와 §19의 모델 요청·명령·훅 실측 |
| SD1 ↔ ST1 | 저장 완료 → 기존 응답 종료 → 대기 입력·새 입력 → 재개/재시작 | E2–E5, AC2–4·6·9. T2·T4의 A/A/B 순서 로그·실제 세션 이력·PID |
| AR1 ↔ IT1 | 창 → agent host → data host 영속 쓰기 → 사본/창 통지 → 입력 허가 | E1·E2·E5, AC4·7·9. 실제 peer 처리 및 설정 재개방 |
| AR2 ↔ IT2 | 부팅·재배포 → dist → SDK local roots 및 runtime MCP → 명령/도구 | E3·E6, AC5·8. T1·T5의 하네스 설치·dist·AppData 및 SDK 옵션·I/O |
| MD1 ↔ UT1 | 출처별 키·부모/인증·프로젝트 기본값 → 유효 선택 → 모델 제출 허가 | E2–E5, AC1·4–6·9. T1–T4의 식별 가능/불가·미등록·잔여 작업과 AC9의 늦은 성공·실패 |

## Part II — Technical Design

### 8. 하네스별 현재 GUI와 목표 SDK 경로

현재 nav는 `ExtensionsCatalogView → CustomizeList`에서 `providers` 탭에 Orca 제공자 카드와 네이티브 플러그인을, `mcp` 탭에 사용자 서버와 네이티브 MCP를 조합한다. `useNativeMcpCatalog`는 전역 설정을 조회하며 현재 대화의 Query를 소유하지 않는다. 표에서 **등록**은 해당 Query 또는 OpenCode 서버·directory에 같은 출처의 SDK 이름이 있음을 확인했다는 뜻이다. 네이티브·Orca 내장·사용자 외장은 각각 이 조건을 판정한다. 등록을 확인한 Claude 서버는 정확한 이름으로 `toggleMcpServer → mcpServerStatus`, OpenCode 서버는 해당 directory에서 `mcp.connect/disconnect → mcp.status` 순으로 확인한다.

| 하네스 · 대상 | 현재 GUI / 데이터 | SDK 제어와 적용 시점 | 변경할 코드 |
| --- | --- | --- | --- |
| Claude · 설치 네이티브 플러그인 전체 | 플러그인 탭. 전역 user scope이며 manifest 이름이 있는 설치만 조작 가능하다. managed 등은 고정. 현재 저장 시 busy 확인 후 Claude 전체를 닫는다. | 설치 키와 SDK 관측으로 대상을 유일하게 식별하고 제어할 수 있으면 manifest 이름이 없어도 활성이다. 선택 변경 시 Query 소유 작업이 끝난 뒤 다음 입력 직전에 최신 옵션으로 native ID를 resume한다. OFF 루트는 주입 대상에서 빼고 marketplace 중복 로드도 막는다. 새 세션은 첫 Query부터 적용한다. | `configured-resources.ts`, `plugin-catalog.ts`, Claude `adapter.ts`, `respawn-inputs.ts`, `extension-catalog.ts`, `processes.ts` |
| Claude · 하네스가 읽은 네이티브 MCP | MCP 탭. 전역 설정·플러그인 선언으로 열거하고 현재는 회색. 실제 Query 목록과 일치하지 않을 수 있다. | 등록된 이름은 유휴 Query에서 `toggleMcpServer(name, enabled)` 후 `mcpServerStatus()` 확인. 첫 입력도 같은 검사를 거친다. 미로드·프로젝트에 기록되는 경우는 §9.2. | Claude `configured-resources.ts`, `native-resources.ts`, `project-reconciliation.ts`, `adapter.ts` |
| Claude · Orca 내장 MCP와 도구 | 플러그인 탭의 Orca 카드/상세에 인증과 제공 도구가 나온다. 내장 서버용 하네스별 선택은 없다. Query 목록에서는 직접 주입된 서버가 필터된다. | 인증과 선택으로 `RuntimeToolSnapshot`을 하네스에 투영한다. `createSdkMcpServer → options.mcpServers`로 등록한 이름을 유휴 경계에서 제어한다. 고정 SDK가 in-process 서버 전환을 지원하지 않으면 같은 ID로 resume하고 주입 목록을 다시 구성한다. | `app/managed-mcp.ts`, `deployment/plugins.ts`, Claude `runtime-tools.ts`·`adapter.ts`, `ProviderDetail.tsx` |
| Claude · 사용자가 추가한 외장 MCP | MCP 탭 Orca 행·상세 토글이 공통 `mcpEnabled[name]`을 수정하고 재배포한다. 현재 Claude dist의 Orca 플러그인에는 enabled 서버만 들어간다. | 번들에 등록됐으면 실제 `plugin:orcinus-orca:<name>`으로 유휴 Query에서 토글한다. 빠진 서버의 ON은 해당 세션을 resume해 Orca가 해석한 외장 정의를 `options.mcpServers`에 주입한다. 출처별로 한 번만 등록하고 실제 SDK ID를 확인한다. | `handlers/mcp.ts`, `mcp/store.ts`, Claude `extensions.ts`·`adapter.ts`, `useMcpServers.ts` |
| OpenCode · 설치 네이티브 플러그인 전체 | 플러그인 탭. 전역 config의 선언을 installed/configured·회색 ON으로 표시하는 경로가 있다. | 안전한 live 전체 토글 API가 없다. 실제 활성/비활성 근거를 표시하고 스위치를 고정한다. 서버 재시작이나 directory 인스턴스 재생성으로 토글을 흉내 내지 않는다. | OpenCode v1 `configured-resources.ts`·`native-resources.ts`, `CustomizeList.tsx`·`CatalogToggle.tsx`, 전역 IPC capability 검사 |
| OpenCode · 하네스가 읽은 네이티브 MCP | MCP 탭의 전역 선언은 현재 토글 가능하다. 런타임의 프로젝트 관측은 읽기 전용이며 프로젝트 값이 전역 선택을 덮을 수 있다. | 전역 행과 directory의 유효 정의가 같은 서버임을 확인한 SDK 이름에만 `mcp.connect/disconnect({directory,name})`를 적용한다. 같은 서버·directory의 실행 중 응답이 모두 끝난 후, 다음 제출 전까지 status를 확인한다. | OpenCode v1 `configured-resources.ts`·`mcp-control.ts`·`session-context.ts`·`channel.ts`, `harnesses/opencode/mcp-reconcile.ts` |
| OpenCode · Orca 내장 MCP와 도구 | Orca 카드의 인증·도구 목록. 등록된 bridge alias는 런타임에서 Orca 출처로 표시되고 비활성 항목은 필터된다. 독립 사용자 선택이 없다. | 등록 alias에 **인증 valid AND 사용자 ON**이면 connect, 그 밖에는 disconnect한다. 열린 뒤 첫 인증으로 alias가 생기는 경우는 §11 T4로 판정한다. `read`·`bash`는 OpenCode 자체 도구이고 `session.create`의 permission 및 승인 흐름에 속한다. | `app/managed-mcp.ts`, OpenCode v1 `managed-mcp.ts`·`adapter.ts`의 `active/choices`·`mcp-control.ts`, 카탈로그 카드 |
| OpenCode · 사용자가 추가한 외장 MCP | MCP 탭 공통 토글. 등록 정의와 선택을 나누어 alias에 `enabled:false`를 주입한 후 연결한다. | 기존 사용자 정의를 재사용해 해당 하네스 선택으로 alias를 connect/disconnect한다. 순수 토글은 연결 revision만 바꾸고 서버 실행 옵션·정의 revision은 유지한다. 세션을 연 뒤 추가한 정의는 T4로 판정한다. 등록된 서버에는 네이티브 MCP와 같은 유휴 경계를 적용한다. | `mcp/store.ts`, `mcp/managed-source.ts`, OpenCode v1 `managed-mcp.ts`·`adapter.ts`·`mcp-control.ts`, `McpDetail.tsx` |

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

전역 카탈로그는 현재 `manifest.name`을 검사하고, 실행 카탈로그는 이름이 없으면 `basename(root)`를 사용한다. 구현 시 설치 키 및 현재 `installPath`를 SDK init의 실제 plugin 경로·이름과 대조한다. 옵션으로 한 설치만 제외·복원할 수 있고 정책이 허용하면 활성화한다. 이름 유무나 basename 추측만으로 판정하지 않는다. 아직 실행 관측이 없으면 확인 전 상태를 표시하고, 설치가 갱신되면 기존 경로에 대한 판정을 무효화한다. [전역 카탈로그](../../../app/src/main/adapters/claude/configured-resources.ts) · [설치 해석](../../../app/src/main/adapters/claude/plugin-catalog.ts) · [Query 관측](../../../app/src/main/adapters/claude/native-resources.ts)

1. 전역 저장 핸들러에서 0283의 `prepare → plan → confirm → close(targets)` 및 확인 대화상자를 제거한다. 앱 종료·사용자 취소·명시적 세션 폐기의 기존 경로는 각각의 소유자가 계속 집행한다.
2. 사용자 입력을 실제로 보낼 때 세션이 적용한 선택과 최신 선택을 비교한다. 첫 턴·재개·warm `pushTurn`·이전 응답 뒤 큐에 보관한 **다음 사용자 입력**에 같은 검사를 둔다. 기존 응답의 자동 도구 루프·승인·잔여 출력은 원래 선택으로 끝낸다. 현재 초기 입력은 `createSessionInputStream(initialInputs)`에서 바로 소비될 수 있어, 새 Query도 첫 사용자 메시지를 보류한 채 제어 채널부터 준비할 수 있어야 한다.
3. 플러그인 구성이 달라졌으면 **그 Query가 소유한 마지막 작업 결과가 기존 세션에 전달된 뒤** 채널을 교체한다. 같은 경계를 MCP 해제에도 적용한다. 화면의 답변 종료 뒤 남은 서브에이전트, 실행 중인 MCP 호출, 결과 전달·드레인을 Query 단위로 추적한다. 대기 중인 새 사용자 입력 자체는 잔여 작업 수에서 제외한다. 완료 통지 때 소유 상태와 최신 선택을 다시 확인하고, 적용·제출 사이에 작업이 끼어들지 않도록 입력을 한 번만 인계한다. `query({prompt, options:{resume: nativeSessionId, cwd, plugins, settings, …}})`로 기존 대화를 열고 최신 roots·`<name>@inline`·명령/스킬 범위를 조립한다. 설치 키 중복 주입과 프로젝트 설정의 역전을 막는다. Orca ID↔native ID 매핑, 대기 입력 UUID·첨부를 승계한다. 재개 실패는 해당 입력 오류로 돌려주며 빈 대화·fork로 대체하지 않는다. 명시 선택에 변화가 없으면 warm Query를 재사용한다.
4. 단일 MCP에서는 Query의 `mcpServerStatus()`를 출처·정확한 SDK 이름으로 대조한다. 등록된 서버만 `toggleMcpServer` 후 상태를 재조회한다. 단순 플러그인 reload로 번들 MCP가 잔류한 사례는 사용자 보고다. 이번 설계의 입력 없는 local plugin 탐침에서는 명령 제거만 관측했고 번들 MCP의 최초 연결은 관측하지 못했다. 구현 판정은 AC5의 **사전 연결 및 호출 성공 → OFF → 복구**로 한다. `setMcpServers({})`도 SDK 타입 계약상 플러그인 소유 서버를 일괄 제거하지 않는다.
5. 전역 목록에만 있는 MCP는 설정 출처와 소유자를 확인한다. 하네스가 승인하여 읽을 수 있는 동일한 전역 정의라면 다음 Query 옵션에 명시적으로 포함하는 경로를 시험하고 실제 로드·호출 후 제어 가능으로 분류한다. 프로젝트 승인·정책상 로드 불가하거나 동일 이름의 다른 서버만 있으면 회색·미로드 사유를 표시한다. 일단 지원으로 받아들인 ON을 특정 세션에서 실현하지 못하면 실패를 드러내고 그 입력을 보존한다. 부모 OFF로 인한 미로드는 의도된 OFF다.
6. SDK가 OFF를 `.claude.json`의 Git 루트에 쓸 수 있다. 격리된 홈과 Git 루트 A/하위 B에서 이번 세션에 0278 탐침을 재실행한 결과는 `initialA=connected, afterA=disabled, disabledSavedAt=["A Git root"], firstB=disabled`였다. 앱 선택은 data host가 소유하며 새 Query/재개 시 반드시 자기 cwd의 실측과 대조한다. 파일 감시기는 SDK 자기 쓰기를 전역 선택으로 역수입하거나 실행 중인 형제 Query를 재시작하지 않는다. 같은 루트의 SDK 쓰기를 순서화하고 관련 없는 프로젝트 키를 통째로 복원하지 않는다. [탐침](../0278-harness-extension-isolation/evidence/claude-cwd-probe.mjs)

#### 9.3 OpenCode의 공유 연결

`OpenCodeMcpControl`은 서버 인스턴스·정규화한 directory별 연결을 공유한다. 현재 `choices()`는 defaults → global → project → managed 순이며, `submit()`은 일반 ON 연결을 최대 2초 기다린 뒤 실패/미완료 상태로도 제출할 수 있다. `activate()`와 조회 재시도에서도 연결을 시작할 수 있다. [제어와 제출 경로](../../../app/src/main/adapters/opencode/v1/mcp-control.ts) · [directory 활동 판정](../../../app/src/main/app/harnesses/opencode/mcp-reconcile.ts)

* **동명 서버의 출처.** 현재 `configured-resources.ts`의 `servers.set(id,…)`와 `declarations.set(id,file)`은 나중 선언으로 이전 출처를 덮는다. nav의 전역 선언과 각 directory의 유효 정의를 함께 해석하고, 정의의 출처·전송 방식·실행 대상(주소 또는 실행 파일·인자와 실행 환경)을 내부에서 대조한다. 같은 선언의 ON/OFF만 재정의하면 같은 서버다. 유효 정의가 다른 대상을 가리키거나 동일성을 입증할 수 없으면 해당 directory에 그 전역 행의 connect/disconnect를 보내지 않는다. 초기 `adapter.client`의 전역 이름 기반 `enabled:false` 설정, 활성화·조회 재시도에도 이 검사를 적용해 동명 프로젝트 서버의 최초 상태를 보존한다. 설정·자격증명은 renderer나 진단에 내보내지 않는다. [선언 탐색](../../../app/src/main/adapters/opencode/v1/configured-resources.ts)
* **세션이 열린 뒤 등록.** 현재 인증·외장 정의, 해당 directory의 실제 등록 이름·출처와 bridge lease를 다시 읽는다. SDK `1.18.27`의 `mcp.add`는 후보 경로다. 같은 서버·세션에서 안전하게 등록하고 결과를 확인할 수 있을 때만 사용한다. 적용 경로가 없으면 열린 세션에 “이 세션에 미등록” 사유와 실제 상태를 표시하고, 전역 선호는 보존해 새 세션 첫 입력에서 다시 판정한다. 등록을 위해 자동 재시작하거나 인스턴스를 폐기하지 않는다. 지원되는 서버의 일시적 연결 실패는 D7로 처리한다.

* 활성 채널·승인 대기·응답 소유 백그라운드 작업을 포함해 **그 연결을 쓰는 모든 응답**이 끝날 때까지 선택으로 인한 connect와 disconnect를 보류한다. 같은 서버의 다른 directory는 별도로 진행한다. 새 입력 대기자를 실행 중인 응답으로 세어 서로 영원히 기다리게 하지 않는다.
* 기존 directory 직렬화에 상태 적용과 제출 예약을 함께 둔다. 준비·메뉴 조회·타이머 reconcile·재시도·첫 prompt·후속 prompt/command 모두 같은 안전 판정을 통과한다. SDK 제출과 해당 응답의 점유 등록 사이에 다른 연결 변경이 끼어들지 않게 한다. 신규 설정이 없는 평상시 입력은 기존 동시성 규칙을 따른다.
* 실제 ID에 대해 OFF는 pending ON을 정리한 뒤 disconnect 및 status를 확인한다. ON은 연결이 확인될 때까지 해당 선택을 요구하는 입력을 보류한다. 실패하면 저장한 선택과 오류를 함께 표시한다. 늦은 connect, 선택 재변경, 동일 값 재시도 때 최신 revision과 status를 다시 확인한 뒤 입력을 한 번만 전달한다.
* `projectManagedMcp`의 `enabled:false` 등록, 기존 alias·bridge·권한 검사를 재사용한다. 등록된 내장/외장 서버의 토글은 `definitionRevision`이나 실행 프로필을 바꾸지 않는다. OFF라고 등록/인증 정보를 삭제하거나 auth를 revoke하면 다른 하네스와 진행 중 호출까지 끊긴다. 인증 철회는 별도 사건이다. [등록 프로젝션](../../../app/src/main/adapters/opencode/v1/managed-mcp.ts) · [revision 생성](../../../app/src/main/features/extensions/common/mcp/managed-source.ts)
* 현재 `createManagedMcpSource`는 미인증 내장을 plugin 목록에서 빼고 `mapMcpResources`의 호출자는 미활성 alias도 걸러낸다. nav의 내장 행은 배포 선언에서 유지하고 실행 상태만 인증·연결에서 읽는다. 인증 만료 후 재인증해도 이미 저장한 OFF를 잃지 않는지 확인한다.

#### 9.4 0278의 복사 경로와 제거 범위

| 소유자 | 현재 생성·소비 경로 | 구현 후 SDK가 읽을 곳 |
| --- | --- | --- |
| 사용자가 설치한 Claude 플러그인 | `<Claude config>/plugins/installed_plugins.json`의 적용 가능한 `installPath`를 `plugin-catalog.ts`가 해석한다. `adaptPlugins(…, nativePlugins.roots)`의 두 번째 인자로 들어간다. | 활성 설치의 **원래 절대 installPath**. 설치 디렉터리·registry를 이동·복사·삭제하지 않는다. |
| OpenCode 네이티브 플러그인 | `global-plugins.ts`에서 하네스의 유효 선언을 읽고, `plugin-installation.ts`에서 file 경로 또는 OpenCode 패키지 캐시의 메타데이터를 조회한다. | SDK가 해석한 원래 플러그인 선언·현재 설치를 따른다. Orca의 캐시 경로 조회는 읽기 전용이다. Orca가 버전을 골라 설정에 쓰거나 SDK에 옛 spec을 재주입하는 경로는 제거한다. |
| Orca 조립 플러그인 | `deploy('claude') → renderClaudeHarnessPlugin`이 `~/.config/orcinus-orca/dist/claude/plugins/orcinus-orca`에 manifest·Orca 스킬·해석한 `.mcp.json` 등을 만든다. Windows에서도 `ooConfigDir()`는 사용자 홈 아래다. | **해당 dist 디렉터리**를 SDK `options.plugins[{type:'local',path}]`에 전달한다. Jira 같은 runtime 내장 서버는 별도 `options.mcpServers`에서 주입된다. |
| 사용자 스킬 래퍼 | `renderClaudeUserSkillsPlugin`이 같은 dist의 `plugins/claude`에 manifest와 `skills` 링크를 만든다. 링크는 설정된 Claude 스킬 원본(기본 `~/.claude/skills`)을 가리키는 Windows 정션/POSIX 심링크다. | **dist의 래퍼 루트**. SDK가 링크를 통해 원본을 읽고 `claude:<스킬>` 네임스페이스를 유지한다. 원본이 없으면 래퍼를 생략한다. |
| 0278 AppData 실행 사본 | agent host가 `hostEnvironment().userData/runtime-plugins`에 `PluginSnapshots`를 만든다. 프로덕션 Windows 경로는 `%APPDATA%/orcinus-orca/runtime-plugins/generation-*`다. | **제거**. SDK 옵션에 세대 경로가 들어가는 경우 0건. 별도 Work 프로필 등 publication 목록 밖의 유효 루트는 기존 경로로 통과시킨다. |

현재 호출 순서는 다음과 같다.

1. 첫 settings 사본·MCP/스킬 CRUD → `ExtensionDeploymentService.deployNow/ensureDeployed` → Claude 배포 성공·검증 → `publish(claudePluginRoots())`. 그 배열은 표의 **dist 루트 두 개**다. [배포 조립](../../../app/src/main/app/harnesses/claude/extensions.ts) · [배포기](../../../app/src/main/features/extensions/claude/deployer.ts)
2. `publish`는 `mkdtemp('generation-')` 후 manifest가 있는 루트를 순서대로 `<generation>/0`·`1`에 재귀 복사한다. 링크를 따라가지 않는다. 등록되지 않은 다른 루트를 `capture`하면 원래 경로로 통과한다. [사본 소유자](../../../app/src/main/infra/config/plugin-snapshots.ts)
3. `ClaudeAdapter.sendMessage → extensionSnapshots.get(pluginPathKey(cwd)) → capture`가 변환된 roots와 스킬 목록을 첫 소유자 기준으로 묶는다. 같은 cwd의 다음 Query도 이를 재사용한다. 재배포 후 이전 세대는 마지막 참조 해제 또는 종료 drain까지 남는다. [어댑터](../../../app/src/main/adapters/claude/adapter.ts)

**네이티브 버전 관리의 경계.** Claude의 registry와 OpenCode의 버전 포함 spec·패키지 캐시는 하네스 소유다. Orca가 영속화할 수 있는 값은 플러그인 사용 선호이며, 실행할 버전·과거 installPath는 저장하지 않는다. 하네스가 설치를 갱신하면 다음 탐색·안전한 로드에서 현재 설치를 다시 읽는다. 아래 dist 게시·복구 및 구 세대 정리는 Orca가 조립한 두 산출물에 한정한다. [OpenCode 설치 메타데이터 조회](../../../app/src/main/adapters/opencode/v1/plugin-installation.ts)

**제거 순서.** deploy 완료 → publish 콜백, agent host 생성·주입·종료 정리, 공용 `PluginSnapshotPort/Lease`, Claude adapter의 cwd 맵·참조계수를 한 변경으로 걷어 낸다. 검증된 dist roots와 최신 스킬 목록을 직접 쓰고, 세션은 적용한 선택/배포 revision만 기억한다. 순수 토글에서 전체 dist를 재생성하지 않는다.

정의·스킬 편집에 따른 재배포는 쓰기 직렬화와 마지막 정상 배포를 보전한다. 현재 배포기는 dist를 `.bak`으로 옮긴 뒤 새로 쓰므로 SDK가 빈/반쪽 디렉터리를 열 수 있다. 새 내용을 임시 위치에서 검증한 뒤 동일한 dist 경로에 게시하고, 게시 중 새 Query의 초기화는 기다리게 한다. 실행 중 응답이 기존 파일을 읽을 수 있는 구조 변경은 그 읽기가 끝난 뒤 게시한다. 실패 시 정상본 복구 또는 해당 입력 보류를 검증하고, 기존 `.bak`의 MCP 비밀 스크럽과 파일 접근 제한을 보존한다.

업그레이드 첫 부팅에서 이전 실행 소유자가 없는 것을 확인한 뒤 **앱 전용 `runtime-plugins` 직계 `generation-*`** 잔존물만 정리한다. 링크 대상을 따라가지 않고 잠긴 파일은 다음 안전한 기동에서 재시도한다. 정리 전용 코드는 디렉터리를 만들지 않는다. `installPath`, dist, 스킬 원본, 별도 프로필·다른 userData는 정리 대상에서 제외한다.

### 10. 계약을 강제할 자리

검색식은 저장소 루트에서 `rg -n '<식>' app/src -g '!*.test*'`로 실행한다. 각 행의 화살표는 구현·검증에서 실제 운반 값을 관측할 자리다.

| 자리 · 검색식 | 진입점 → 강제 지점 | 직접 oracle과 구별 입력 |
| --- | --- | --- |
| E1 · `extensionSetEnabled\|mcpUpdate\|canToggle\|managedSource` | 목록·상세 → 하네스/출처별 IPC → 검증된 항목 및 capability → 각 창의 선택·관측 상태 | `useNativeMcpCatalog.test.ts`·`ExtensionsCatalogView.interaction.test.ts`와 등록 handler. 고정 ON/OFF, 미로드, pending/실패, 이름 충돌, 지각 응답, 직접 요청. T1·T3·T4에서 세션별 사유와 제어 가능 여부를 함께 관측 |
| E2 · `nativeExtensionChoices\|mcpEnabled\|settings.write` | data host 항목 병합 → 저장소 → agent mirror/재접속 → 다음 입력의 선택 | `extension-control.test.ts` 단위와 `data-host/agent-link.test.ts`의 실제 쓰기·사본 통합 확장. 동시 형제 쓰기, legacy false, ENOSPC, 재시작·지연 통지 |
| E3 · `initialInputs\|pushTurn\|resume:\|toggleMcpServer\|enabledPlugins` | Claude 새/기존 Query의 roots·flags 결정 → 초기/후속 사용자 입력 → SDK 요청·명령/도구 | `adapter.native-plugins.test.ts`·`native-resources.test.ts` + §19 Claude 실환경. 반대 프로젝트 값, 미등록, ON/OFF/ON, 부모 OFF·자식 ON, 중복 설치 이름, 재개 실패. T1·T2에서 init의 설치 경로, 훅 실행 횟수, 잔여 작업의 결과 전달과 입력 UUID를 관측 |
| E4 · `mcp\.connect\|mcp\.disconnect\|reconcileChoices\|submitPrepared\|definitionRevision` | OpenCode 정의/alias → directory의 활동·연결·status → 첫/후속 prompt 및 command | `mcp-connection.test.ts`·`session-context.test.ts` + §19 실제 CLI. busy·동시 입장, 느린 성공·실패·뒤늦은 연결, cwd A/B, PID·dispose. T3·T4의 유효 선언 출처와 SDK 제어 목적지를 관측 |
| E5 · `runtimeTools\|credentialRevision\|authorized\(\)\|managedMcpReferences\|configurationPending` | 인증+선택 → 하네스별 도구 등록/연결 → composer·nav의 실제 상태 → 호출 승인·핸들러 | `managed-mcp-projection.test.ts`·`managed-mcp.cli.integration.test.ts`와 Claude `runtime-tools.boundary.test.ts`. 인증×선택 네 칸, 첫 인증·복구, 열린 뒤 외장 추가, 동명 출처, 서버별 호출 표식(T3·T4) |
| E6 · `pluginRoots\|runtime-plugins\|generation-\|installPath\|ensureDeployed` | 부팅·CRUD 배포 → dist 두 루트/원본 설치 → SDK 경로 → 정리 | `harnesses/claude/extensions.test.ts`·`managed-mcp-claude-regression.test.ts` 확장. 정상·빈 래퍼·잠긴 구 사본·게시 실패·재시작, 파일 생성 이벤트와 실제 스킬/서버 실행. T5에서 하네스별 자체 업데이트·원본 쓰기·과거 버전 복원 시도를 관측 |

ΔV1 추가 자리 검색은 E3에서 `observePlugins|backgroundTaskCount|residualCount|responding`, E4·E5에서 `declarations\.set|servers\.set|mcp\.status|projectManagedMcp|authorized\(\)`, E6에서 `installed_plugins|installPath|pluginSpec|openCodePluginInstallation|pluginRoots|runtime-plugins|generation-`를 사용한다. E6은 `app/src`와 `app/scripts`에서 검색해 플러그인 입력이 도달하는 파일/설정 쓰기, 프로세스 실행, SDK 옵션 구성까지 추적한다. 각 경로를 하네스 메타데이터 읽기, Orca 소유 dist 배포, 옛 사본 정리, 네이티브 버전 관리로 분류한다. 마지막 분류 0건과 T5의 새 설치 인식을 함께 판정한다.

**실패 판정.** SDK 제어 호출이 resolve해도 해당 입력이 낡은 도구를 받거나 실제 OFF 호출이 성공하면 실패다. 선언된 프로젝트 승인·기업 정책을 우회해 다른 cwd의 동명 서버를 등록하는 것도 실패다. 원래 설치·승인 범위가 다른 프로젝트 전용 정의, 일반 CLI에서 별도로 실행 중인 대화, 실제 사용자의 외부 서비스 가용성은 전역 Orca 세션 인수의 분모 밖이다.

### 11. 교체할 테스트와 유지할 테스트

파일명은 기준 트리의 현행 테스트다. 0278 설계 문서에 남은 과거 테스트명을 그대로 복원하지 않는다.

| 처리 | 기존 파일·케이스 | 변경 후 잠글 행동 |
| --- | --- | --- |
| 교체 | Claude [adapter.native-plugins.test.ts](../../../app/src/main/adapters/claude/adapter.native-plugins.test.ts)의 `pins deployed MCP files for same-cwd peers …`, `applies current global plugin choices … while live queries keep theirs` | 진행 중인 응답과 해당 Query의 잔여 작업이 옛 상태로 완주하고 결과를 전달한다. A의 새 peer, 기존 peer의 다음 입력, B의 첫 입력 모두 최신 선택이다. 마지막 소유자가 닫힐 필요가 없다. |
| 교체 | [plugin-snapshots.test.ts](../../../app/src/main/infra/config/plugin-snapshots.test.ts)의 세대 pin/reclaim과 [extensions.test.ts](../../../app/src/main/app/harnesses/claude/extensions.test.ts)의 immutable publication. [managed-mcp-claude-regression.test.ts](../../../app/src/main/app/managed-mcp-claude-regression.test.ts)의 publish callback 단언 | 구 사본 단위를 제거한다. production 배포기·adapter에 실제 임시 홈을 주어 SDK가 읽은 dist/설치 경로 및 내용, 재배포 직렬화·실패 복구·AppData 생성 0회를 단언한다. |
| 교체 | [extension-catalog.test.ts](../../../app/src/main/app/handlers/extension-catalog.test.ts)의 `saves and closes … busy check`, `rejects confirmed: false …`, in-memory-only 기대와 [processes.test.ts](../../../app/src/main/app/harnesses/claude/processes.test.ts)의 세션/lease 일괄 폐기 | 실제 토글 handler → 내구 저장, busy/idle 어느 쪽도 close·abort·discard 0회. 응답 후 다음 입력에서만 해당 Query를 resume한다. 저장 실패 후 재시도 및 형제 키 보존을 검증한다. |
| 교체 | [useNativeMcpCatalog.test.ts](../../../app/src/renderer/src/features/skills/hooks/useNativeMcpCatalog.test.ts)·[ExtensionsCatalogView.interaction.test.ts](../../../app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.interaction.test.ts)의 busy 종료 확인, 취소, 확인 중 잠금 및 단/복수 대화상자 | 진행 중에도 한 번 클릭해 저장하고 “다음 입력에 적용”을 표시한다. 저장 직렬화·다른 하네스 조작·실패 재시도는 유지한다. transport fixture의 구 `confirm` 응답도 교체한다. |
| 분리·교체 | Claude [native-resources.test.ts](../../../app/src/main/adapters/claude/native-resources.test.ts)의 `rejects both MCP toggle directions …`, [configured-resources.test.ts](../../../app/src/main/adapters/claude/configured-resources.test.ts)의 `below project selections`; OpenCode [mcp-control.test.ts](../../../app/src/main/adapters/opencode/v1/mcp-control.test.ts)의 `preserves project overrides` | nav의 지원되는 **전역** 선택은 양방향 제어하고 프로젝트 반대값보다 우선한다. 미지정 기본값·미지원 직접 요청 및 별도 프로젝트 UI의 안전 제한은 각각 유지한다. |
| 분리·교체 | OpenCode [mcp-connection.test.ts](../../../app/src/main/adapters/opencode/v1/mcp-connection.test.ts)의 `admits submissions within the bound`, `… but not connect failure` | 명시 ON 미완료·실패 시 요청 0회. 늦은 ON보다 새로운 OFF 우선, 취소 및 OFF 실패 시 보류를 보존한다. 동일 directory에서 준비·조회에 의한 선행 connect도 잡는다. |
| 유지·확장 | [session-context.test.ts](../../../app/src/main/adapters/opencode/v1/session-context.test.ts)의 `reconciles current global choices for idle directory peers …`, [mcp-reconcile.test.ts](../../../app/src/main/app/harnesses/opencode/mcp-reconcile.test.ts), [instance-retention.test.ts](../../../app/src/main/adapters/opencode/v1/instance-retention.test.ts) | directory별 이벤트/캐시·사용 중 보호, 정상 종료·LRU 회수는 유지한다. 토글 시 PID·session ID 동일 및 dispose 0회를 별도 관측한다. |
| 유지·확장 | Claude [adapter.native-history.test.ts](../../../app/src/main/adapters/claude/adapter.native-history.test.ts), [plugin-state.test.ts](../../../app/src/main/adapters/claude/plugin-state.test.ts), [runtime-tools.boundary.test.ts](../../../app/src/main/adapters/claude/runtime-tools.boundary.test.ts), [deployer.test.ts](../../../app/src/main/features/extensions/claude/deployer.test.ts) | native ID/cwd·대화 이력, 기존 파일 편집의 형제 키/링크 보호, 세션별 호출 context, dist 스킬 래퍼·비밀 스크럽을 유지한다. 토글 시 파일 감시의 자기 쓰기 반례를 추가한다. |
| 유지·확장 | [extension-control.test.ts](../../../app/src/main/app/extension-control.test.ts), [settings-store.test.ts](../../../app/src/main/infra/settings-store.test.ts), [discard.test.ts](../../../app/src/main/app/chat-turn/discard.test.ts), [native-settings-lifecycle.test.ts](../../../app/src/main/app/native-settings-lifecycle.test.ts) | 미지정 native 기본값, 일반 patch 차단, 관련 없는 설정·명시적 폐기·앱 종료 시 저장 drain은 유지한다. data host 재시작을 거치는 전용 쓰기, 사용자 취소와 토글의 분리를 추가한다. |

#### PR #656에서 추가한 검증 사례

| 사례 · 담당 / 좌표 | 재현 입력 | 통과 관측 |
| --- | --- | --- |
| T1 · Claude 카탈로그·어댑터 / `configured-resources.test.ts`, `adapter.native-plugins.test.ts`, §19 실제 SDK | 이름 없는 manifest를 SDK가 유일한 설치 경로로 로드하는 fixture와 식별 모호·관리 정책 제한인 fixture를 대조한다. AC5의 네 종류를 각각 같은 대화에서 세 턴 실행한다. | 식별 가능한 설치만 활성이다. 명령은 고유 본문, 훅은 동일한 이벤트의 턴별 표식 **1·0·1**, 번들 MCP는 스키마와 호출 결과를 남긴다. 복합 fixture의 OFF는 세 기능 모두 0이며 형제 플러그인은 계속 실행된다. |
| T2 · Claude 세션 수명 / [runtime-entry.test.ts](../../../app/src/main/app/chat-turn/runtime-entry.test.ts)·[adapter.background.test.ts](../../../app/src/main/adapters/claude/adapter.background.test.ts) | 화면에 답변 종료를 보낸 뒤 서브에이전트 결과 또는 MCP 호출 결과를 각각 멈춘다. 플러그인 변경 또는 해당 MCP OFF를 저장하고 S1에 새 입력을 넣는다. 무관한 S2에도 입력한다. | 잔여 작업 중 S1의 Query close·MCP 해제·새 입력 전송은 0회, S2는 진행한다. **기존 결과가 S1 이력에 한 번 도착 → 적용 → 같은 native ID로 새 입력 UUID 한 번 제출** 순서다. 변경이 없으면 Query 재생성 0회다. |
| T3 · OpenCode 네이티브 MCP / [configured-resources.test.ts](../../../app/src/main/adapters/opencode/v1/configured-resources.test.ts)·`mcp-control.test.ts`·§19 CLI | 전역 `docs`는 G, A의 프로젝트 `docs`는 P를 반환한다. B는 G의 ON/OFF 기본값만 덮는다. 별도로 출처 판별이 불가능한 입력을 준다. | 전역 OFF/ON에서 B의 G만 사라졌다 돌아온다. A의 P는 제어 요청 0회이고 이전과 같은 호출 결과를 반환한다. 모호한 경우도 SDK 호출 0회이며 해당 세션에 사유가 보인다. |
| T4 · OpenCode 등록·인증 / `managed-mcp-projection.test.ts`·`session-context.test.ts`·`managed-mcp.cli.integration.test.ts` | 세션을 미인증으로 연 뒤 첫 인증(기존 선택 OFF/ON)하는 경우와, 세션을 연 뒤 MCP 탭에서 외장을 추가하고 ON하는 경우를 나눠 시험한다. 안전한 등록 경로 유무 및 이미 등록된 서버의 일시적 실패를 따로 준다. | 저장 OFF면 인증 후에도 연결 0회다. 안전하게 적용되면 같은 PID·세션의 다음 요청에서 해당 도구를 호출하고 해제 후 부재를 확인한다. 경로가 없으면 기존 세션의 제한·실제 상태, 새 세션 첫 요청의 모델 도구와 호출 결과를 확인한다. 영구적인 세션 제한을 연결 재시도로 무한 대기시키지 않는다. 양쪽 모두 자동 재시작·dispose 0회다. |
| T5 · 배포·두 어댑터 / `adapter.native-plugins.test.ts`·[plugin-installation.test.ts](../../../app/src/main/adapters/opencode/v1/plugin-installation.test.ts)·§19 Windows | V1 원본·레지스트리(Claude) 또는 선언·패키지 캐시(OpenCode)의 파일/내용을 기록한다. Orca 토글·재시작 전후 비교 뒤 하네스 측 fixture만 V2로 갱신한다. V1·V2에는 서로 다른 명령/기능 표식을 둔다. OpenCode의 고정 플러그인 행을 클릭한 경우와 제어 가능한 MCP를 토글한 경우 모두 원본을 비교한다. | Orca 동작 중 원본·레지스트리/설정 쓰기 0회, 앱 소유 위치에 네이티브 버전 사본 0개다. 새로고침·하네스 정상 로드에서 V2 경로·표식이 보이고 다음 기동에도 V1 복원 0회다. 네이티브 읽기와 Orca dist·래퍼의 생성 및 기능은 각각 확인한다. |

### 12–18. 구현 순서와 회귀 경계

1. **저장·GUI** — 출처/하네스별 안정 키, 구 설정 승계, 전용 data write와 통지, 선택·관측·capability 표현을 연결한다. `shared/native-resources.ts`, `shared/protocol.ts`, 호스트 배선, 목록·상세·번역·transport와 [IPC 계약](../../IPC_CONTRACT.md)을 같은 변경에서 맞춘다.
2. **Claude** — Query 입력을 열기 전 검사, 플러그인 변경의 세션별 resume, MCP 실제 ID 대조를 연결한다. `runtime-entry.ts`·`respawn-inputs.ts`·`continuation.ts`와 `session-runtime.ts`의 cold/warm 양쪽을 다룬다. 진행 중 응답/held 입력을 폐기하던 전역 종료 배선은 제거한다.
3. **OpenCode** — 선택과 정의의 revision을 분리하고 등록·출처가 확인된 서버를 공유 연결 경계에서 조정하고, 열린 뒤 추가된 서버는 T4의 두 경로로 판정한다. 준비 화면의 조회·재시도와 실제 입력을 같은 상태 판정에 연결한다. 선택 불변 시 연결을 다시 열지 않고 같은 서버·directory·revision의 중복 연결 시도는 합친다.
4. **배포** — §9.4의 생성자·소비자·참조를 함께 제거한다. 부팅/CRUD, Work 프로필 루트, 링크 부재, Windows 게시 실패를 확인한다. 위 단계와 함께 [하네스 현재 구조](../../arch/backend/adapters.md)의 해당 동작을 구현 시점에 갱신한다.

### 19. 구현·검증 게이트

* **실제 모델 경계** — Claude는 고정 SDK와 동봉 CLI를 격리된 홈에서 실행하고 로컬 Anthropic 호환 endpoint에서 요청을 받는다. OpenCode는 [기존 CLI 통합 테스트](../../../app/src/main/app/managed-mcp.cli.integration.test.ts)의 로컬 모델·MCP 서버와 실제 permission 응답을 재사용한다. ON 요청은 고유 인자를 가진 도구 호출을 반환하고, OFF 요청은 같은 이름을 요구해 핸들러 미실행과 불가 결과를 확인한다. 명령은 CLI 명령 목록, 호출 시 주입된 고유 본문, 부모 OFF에서 실행 불가를 함께 검사한다. 훅 전용 플러그인은 정해진 SDK 훅 이벤트를 턴마다 한 번 발생시켜 독립적인 실행 기록을 읽는다. 지연 로드되는 도구는 정상 탐색 후 보이는 스키마와 실제 호출까지 수집한다.
* **동시성·재시작** — AC2의 테스트는 시간 추측 대신 응답·도구·연결 완료를 각각 해제할 수 있는 fixture를 사용한다. 실행 중 토글과 답변 종료 후 토글 각각에서 기존 작업 결과 전달이 설정 적용보다 앞서고, 적용이 대기 입력 제출보다 앞서는지 확인한다. 입력 UUID별 제출 횟수, PID·ID·dispose 및 재시작 전후 영속값을 기록한다. OpenCode가 시작되지 않아 기존 CLI 테스트가 skip된 실행은 AC1·6의 증거로 채점할 수 없다.
* **Windows 배포·UI** — 설치본에서 두 탭의 실제 클릭으로 AC1–3·7–9를 반복한다. SDK roots와 파일 생성 이벤트를 수집해 `generation-*`가 생겼다가 삭제되는 경우도 잡는다. Jira fixture의 실제 결과와 사용자 스킬 본문 표식을 기록한다. 반례로 OFF root 재주입, `choices` 병합 순서 역전, 미완료 연결에서 SDK 제출, 토글 직후 전체 close를 각각 심으면 대응 AC가 실패해야 한다.
* **운영 게이트** — 구현 시 [CI 정본](../../../.github/workflows/ci.yml)의 가드·lint·typecheck·테스트·host/preload smoke를 수행하고 실환경 실행/skip을 구분한다. 이 설계 턴의 검증 범위는 기준 트리의 코드·테스트 좌표, 경로·문서 링크, §9.2의 SDK 관측이다. 모델 세 턴, Windows 설치본, PID·이력 인수는 구현 후 증거로 채운다.

### 19-A. Windows 설치본 인수 수행계획 — AC8 잔여 증거

**현재 판정.** `98381394`의 r1 자기보고는 8/9다. §7 AC8, §11 T5와 §19의 설치본 게이트를 다음 Codex가 실행할 수 있도록 관측 절차를 정했다. D1~D7, AC1~9, V-pair, §10의 E1~E6 및 §19의 분모를 그대로 사용한다. 이번 계획 턴에 실행한 Windows 인수는 0건이다.

| 기존에 통과한 경계 | 확인한 사실 | 설치본에서 채울 증거 |
| --- | --- | --- |
| Linux의 배포기·정리기·양 어댑터와 실제 CLI | 구 사본·링크 보존, 검증/rename 실패 후 복구, 새 Claude Query가 현재 roots 읽기, OpenCode 설치 메타데이터 V1→V2·오래된 spec 미주입. 하네스별 ON/OFF/ON와 A/A/B는 로컬 모델/도구 핸들러까지 실행 | Windows의 파일 잠금·junction·짧게 생성 후 삭제되는 사본을 포함한 연속 파일 I/O, 설치 앱과 네이티브 하네스가 읽은 실제 경로 |
| Node worker_threads에서 실제 data/agent 호스트 번들을 재기동(`isPackaged:false`) | 기존 Claude/OpenCode native ID·이력, 새 세션의 첫 입력을 관측했다. Claude는 첫 배포 및 재배포 후 `/claude:restart-proof`의 V1·V2 본문을 모델 요청에서 읽었다 | NSIS로 설치한 셸의 두 탭을 조작하고 셸·두 호스트를 실제로 종료·재기동한 결과. 첫 유효 배포와 재배포 **각각에서** 사용자 스킬, 인증된 내장 Jira, 외장 MCP의 서로 다른 결과 |
| 고정 SDK fixture와 렌더 테스트 | Jira 런타임 도구/외장 정의와 각 핸들러, 읽기 전용 목록·상세 및 IPC 거부 | 설치본의 인증 모듈 → 실제 Jira 핸들러 → 시험 Jira HTTP 응답, 외장 핸들러 로그, SDK/CLI 모델 요청 및 UI를 같은 입력에 연결 |

원본과 실행 형태는 [두 호스트 기동](../../../app/scripts/smoke-host-pair.mjs), [Claude 재시작](../../../app/scripts/smoke-claude-extension-restart.mjs), [OpenCode 재시작](../../../app/scripts/smoke-extension-restart.mjs), [인증된 도구를 주입하는 CLI 시험](../../../app/src/main/app/managed-mcp.cli.integration.test.ts)에서 확인할 수 있다.

#### 설치본과 시험 장비 준비

1. 시험할 커밋·배포 구성을 먼저 기록한다. 기본 소스의 `AUTH_DEFINITIONS`와 `createPluginBindings()`는 비어 있다. 기본 NSIS에서는 설치·일반 플러그인·외장 MCP까지 시험할 수 있다. 인증된 내장 Jira에는 실제 배포 fork의 조립 또는 **검토된 인수 전용 배포 구성**으로 빌드한 설치본을 사용한다. 후자의 경우 같은 제품 경로에서 `bindForPlugin` → `jiraTools` → `createPluginBinding`을 사용하고 인증 probe와 읽기 전용 이슈 조회를 시험 Jira에 연결한다. 기준 SHA, 구성 차이·해시, 설치본 해시, 실제 인증 상태를 남긴다. Jira 이름을 외장 도구에 붙이거나 Vitest mock으로 반환한 결과는 이 칸을 채우지 못한다. 해당 구성을 확보할 수 없으면 독립적인 나머지 칸을 실행하고 Jira 칸은 미실행으로 남긴다. [인증 선언](../../../app/src/main/app/deployment/auth-definitions.ts) · [플러그인 조립](../../../app/src/main/app/deployment/plugins.ts) · [Jira 도구](../../../app/src/main/features/plugins/jira/tools.ts)
2. Windows에서 해당 SHA의 `app/`에서 Node 22로 `npm ci`, `npm run build:win -- --publish never`, `node scripts/validate-dist.mjs`를 실행한다. 또는 해당 ref의 Release workflow 비태그 `workflow_dispatch` dry-run 산출물에서 `*-setup.exe`, `latest.yml`, blockmap을 받는다. run URL·head SHA·installer 해시를 대조하고 NSIS를 실제로 설치한 뒤 **설치 경로의 `orcinus-orca.exe`**를 실행한다. 기본판은 패키지 0.3.1, lock 기준 Electron 39.8.10, builder 26.15.3, better-sqlite3 12.11.1, Claude Agent SDK 0.3.296, OpenCode SDK 1.18.27이다. Claude는 설치 리소스의 asar-unpacked 플랫폼 CLI 실제 경로를, OpenCode는 앱에 지정한 절대 경로 또는 PATH에서 해결한 Windows `opencode.exe --version` 1.18.27과 해시를 기록한다. `ORCINUS_ORCA_TEST_OPENCODE_EXE`는 시험 스크립트의 입력이다. [빌드 명령](../../../app/package.json) · [NSIS·언팩 설정](../../../app/electron-builder.yml) · [버전 잠금](../../../app/package-lock.json) · [OpenCode 실행 파일 해석](../../../app/src/main/adapters/opencode/v1/server.ts)
3. 쓰기 가능한 NTFS의 격리된 Windows 계정 또는 VM 스냅숏을 준비한다. 앱의 단일 인스턴스가 해당 프로필에 속하는지 확인한다. 실제 Electron userData(기본 `%APPDATA%\orcinus-orca`)와 `%USERPROFILE%\.config\orcinus-orca`의 sources/dist는 서로 다르다. cwd A·B, 활성 Claude 설정 루트(`CLAUDE_CONFIG_DIR` 또는 `~/.claude`)의 `plugins/installed_plugins.json`, 각 installPath의 manifest·실제 skills 대상, OpenCode 유효 설정과 `<XDG_CACHE_HOME 또는 ~/.cache>/opencode/packages/<spec>/node_modules/<name>`, 외부 junction 대상과 별도 프로필 sentinel을 식별한다. Work 프로필의 기존 유효 루트는 그대로 허용한다. 테스트 데이터와 해시를 fixture로 저장하고 실사용 계정의 설정·자격증명은 격리한다. [경로 정본](../../../app/src/main/infra/config/paths.ts) · [제품 부팅](../../../app/src/main/index.ts)
4. 각 입력에 고유 표식을 붙일 로컬 모델 endpoint와 외장 HTTP MCP, 인증이 valid인 읽기 전용 Jira 시험 이슈를 준비한다. 모델 endpoint는 받은 스키마 및 스킬 본문을 기록하고 지정된 도구만 요청한다. Jira 이슈 요약과 외장 도구 결과는 서로 다른 표식으로 응답한다. 시험 UUID·서버별 요청/응답·정확한 호출 횟수를 기록한다. 승인·정책·로그인 흐름은 해당 설치본 조립을 따른다. 설치·데스크톱 조작·도구 실행·자격증명 사용 권한과 Win32 추적 권한을 해당 환경에서 확인한다. 권한이 있는 CI 운영자는 dry-run과 artifact 다운로드를 할 수 있다. CI 기본 gate는 windows-latest의 단위 시험과 Node 호스트/preload smoke이며 release dry-run도 NSIS 생성·검증까지만 한다. Windows GUI runner에서 실제 설치와 아래 조작을 수행하거나 동일 artifact를 시험 장비로 옮긴다. 릴리스 태그나 외부 게시 작업은 필요하지 않다. [CI](../../../.github/workflows/ci.yml) · [Release](../../../.github/workflows/release.yml)

#### 원인과 결과를 연결하는 관측

- **실행 전부터 파일 이벤트를 수집한다.** 깨끗한 프로필에는 `runtime-plugins`조차 없을 수 있으므로 이미 존재하는 상위 디렉터리에서 Win32 `ReadDirectoryChangesW` 또는 이를 쓰는 `FileSystemWatcher`를 하위 트리 포함으로 시작한다. create·rename(이전/새 경로)·delete·write를 종료 후까지 보관한다. 구 사본, 원본·registry/설정, 설치 cache, 앱 dist·스테이징·백업, 각 링크의 실제 대상은 구분한다. 준비 완료 후 앱 밖의 별도 대조 폴더에서 파일을 생성→이름 변경→삭제해 수집기를 검산한다. 동작 주체는 process tree의 PID·시각 및 Process Monitor/ETW 파일 이벤트로 대조한다. 경로 전용 watcher는 PID를 주지 않는다. ProcMon의 기존 디렉터리 열기(Open)와 신규 생성(Create), 기존 세대 삭제와 해당 이름으로의 신규 rename을 구별한다. 하네스 자체 업데이트 PID의 쓰기는 표시한 갱신 구간에서만 분리한다. Win32 버퍼 넘침·추적 공백·시계 불일치가 있으면 그 구간의 ‘0건’은 미판정이다. 마지막 디렉터리 목록이나 감시기 시작 전 SDK 호출만으로 생성 0회를 확정하지 않는다.
- **네이티브 갱신과 Orca 배포를 구분한다.** Claude registry/manifest/`installPath`와 OpenCode의 현재 plugin spec·package 메타데이터는 하네스 소유다. 선택 스위치는 `nativeExtensionChoices[backend]`의 해당 값만 바꾸고 다음 입력에서 적용된다. Orca의 Claude dist는 부팅/첫 요구 또는 스킬 작성·업로드·삭제, 외장 MCP 정의 추가·수정·삭제 등 실제 정의 변경으로 게시한다. 배포 완료 로그·마커 `.orcinus-orca-deploy.json`·매니페스트·기능 결과로 원인을 확인한다. `.claude-staging-*`와 `claude.bak`은 같은 볼륨에서의 정상 게시 경로다. `dist/claude/plugins/orcinus-orca`와 `dist/claude/plugins/claude`의 사용자 skills junction은 역할이 다르다. 링크 대상의 SKILL.md만 바꿔 읽힌 본문은 dist 재배포의 증거가 아니다. [배포 트리거](../../../app/src/main/app/handlers/mcp.ts) · [스킬 작업](../../../app/src/main/app/handlers/skills.ts) · [배포기](../../../app/src/main/features/extensions/claude/deployer.ts) · [사용자 스킬 래퍼](../../../app/src/main/features/extensions/claude/user-skills.ts)
- **실제 SDK 입력을 수집한다.** 설치 셸·agent/data·Claude CLI·OpenCode 서버 PID와 실행 경로, cwd, app/native session ID, 입력 UUID, 저장/이전 응답 종료/다음 요청 순서, SDK에 들어간 roots 또는 설치 CLI의 동등한 초기화 경로와 하네스가 연 파일을 기록한다. 표면에 없는 값은 기존 SDK init/CLI 요청 또는 설치본용 읽기 전용 진단으로 계측한다. 계측을 추가했다면 원본 대비 차이와 해당 artifact를 표시한다. 파일 I/O만 보고 SDK 옵션이나 display name만 보고 실제 도구 호출을 추정하지 않는다. 창은 설치 앱에 연결한 접근성/UI 자동화 또는 실제 클릭으로 조작한다. 개발 Electron·`win-unpacked`·직접 IPC 호출은 각각 보조 증거로 구분한다.

#### 실행표

| 순서 | 설치본에서 하는 조작 | 판정에 남길 증거 |
| --- | --- | --- |
| 1. 깨끗한 첫 부팅·첫 유효 배포 | V1 표식의 하네스 설치, 사용자 `<fixture-skill>/SKILL.md`와 시험 MCP 정의를 준비한 뒤 앱을 처음 시작한다. 실제 배포 완료를 확인하고 Claude 채팅에서 `/claude:<fixture-skill>`을 실행해 valid+ON 내장 Jira와 ON 외장 도구를 연속 호출한다. | 새 세대·옛 cwd 사본 참조 0회. SDK가 실제 설치 원본과 현재 dist/wrapper를 읽는다. 명령 목록·V1 스킬 본문/인자·Jira 이슈 결과·외장 결과 및 각 호출 UUID를 첫 모델 요청/이력에서 대조한다. skills 대상이 없는 분리 프로필에서는 빈 wrapper가 정상 루트로 선택되지 않는지 확인한다. |
| 2. 이전 설치 잔존물로 업그레이드 | 별도의 초기 스냅숏에 `<userData>/runtime-plugins/generation-old`, 앱 밖을 가리키는 직계 generation junction, 일반 형제·다른 프로필·대상의 sentinel을 넣는다. 잠긴 구 사본은 별도 케이스로 둔다. 설치 앱으로 부팅하고 잠금을 푼 다음 안전한 재기동을 한다. | 부팅에서 구 직계 항목과 링크 자체만 정리하고 대상 파일·별도 프로필·원본 registry 해시가 보존된다. 잠긴 항목의 재시도와 이후 부재를 이벤트·최종 해시로 확인한다. 일시 생성 후 삭제도 새 generation 이벤트로 센다. [구 사본 정리기](../../../app/src/main/infra/config/legacy-plugin-copies.ts) |
| 3. 실제 두 탭·응답 경계 | 하네스를 명시해 플러그인·MCP 탭에서 목록/상세를 클릭한다. Claude는 식별 가능한 사용자 설치 플러그인 및 지원 MCP, OpenCode는 출처가 확인된 전역 네이티브·내장·외장 MCP로 §7 AC1–3의 ON→OFF→ON, A/A/B, 같은/다른 cwd의 첫 입력을 실행한다. §11 T1의 명령·훅·번들·복합과 T2의 잔여 작업, T3/T4의 동명·뒤늦은 등록은 기존 해당 행의 판정을 따른다. | 각 실행 중 응답은 구 기능으로 완료, 해당 다음 입력 UUID별 한 번 제출. ON 실제 호출·OFF 강제 호출 0·양성 대조군 호출. Claude native ID와 이력 유지. OpenCode 선택 변경 구간 PID·각 native ID 유지 및 directory dispose 0건. 선택만 바꾼 구간에 배포 마커 재게시·네이티브 원본 쓰기·세대 생성 0회. OpenCode 설치 플러그인 및 모호한/정책상 고정 행은 §7 AC7의 비활성 표시·조작 거부·저장 0으로 분리한다. §7 AC9 지연·실패·OFF·취소·재시도는 설정 반영 전에 전송 0, 원문·첨부 및 실제 수신 UUID를 비교한다. |
| 4. 실제 재배포와 하네스 자체 업데이트 | 사용자 스킬 본문에 V2를 넣고 앱에서 시험 외장 MCP 정의 또는 Orca 스킬 원본을 수정해 배포를 실제로 일으킨다. 같은 Claude 대화의 첫 안전한 다음 입력에서 사용자 스킬과 Jira·외장 호출을 다시 한다. 이와 시간을 나눠 **하네스 측에서만** Claude 설치/registry를 V2로, OpenCode는 native spec·package를 V2로 정상 갱신한다. 옛 cwd와 새 cwd에서 카탈로그 다시 읽기·다음 정상 로드를 비교한다. | 성공 마커와 현재 dist, 스킬 V2 본문/인자, 첫 단계와 구별되는 Jira·외장 결과를 각각 수집한다. 갱신 주체의 쓰기와 Orca 읽기를 분리한다. Claude 현재 installPath·기능 표식, OpenCode V2 설치 경로·메타데이터와 정상 하네스 로드 뒤 실제 V2 기능의 고유 출력, provider의 낡은 plugin spec 재주입 0, 원본 V1 복원 0. OpenCode 네이티브 플러그인의 hot toggle을 가정하지 않는다. [OpenCode 설치 조회](../../../app/src/main/adapters/opencode/v1/plugin-installation.ts) · [런타임 설정](../../../app/src/main/adapters/opencode/v1/native-storage.ts) |
| 5. 배포 실패·복구 | 정상본의 해시와 실행 표식을 저장한다. 열린 응답 중 정의를 바꾸어 읽기 종료까지 게시가 대기하는지 본다. 별도 시도에서 NTFS의 현재 dist 디렉터리를 delete 공유 없는 Win32 핸들로 잡아 rename 실패를 유도한다. 실제 공유 위반을 확인한 뒤 핸들을 해제하고 같은 배포를 다시 요청한다. | 구 응답 결과 전달 → 새 게시/SDK 입력의 순서, 실패 이벤트·정상본 경로/해시 보존 또는 입력 보류, 반쪽 staging root SDK 유입 0. 복구 후 정상 게시·현재 스킬/도구 실행·세대 0을 확인한다. 성공 백업의 MCP 비밀 스크럽은 파일 유무로 기록한다. 잠금 주입이 동작하지 않았다면 재현 성공으로 세지 않는다. |
| 6. 완전 종료·재시작 | 설정과 기존 대화의 표식을 보존한 채 앱·agent·data 호스트가 종료된 것을 확인하고 같은 설치 실행 파일과 프로필로 재기동한다. 기존 대화와 같은/다른 cwd의 새 대화를 열고 첫 입력을 보낸다. | 재시작 전후 native session ID/과거 사용자 입력·도구 결과와 각 UUID 1회를 대조한다. 저장 선택, V2, 현재 dist·별도 원본·링크 대상이 유지되고 옛 cwd 사본·V1 복원이 없다. 프로세스 재기동과 선택만 바꿀 때의 PID 불변 구간을 나누어 기록한다. |

**결과 제출.** 실행자는 설치본 SHA-256와 기준/ref·배포 구성, Windows 버전·실행 파일 경로·실제 CLI 버전, 깨끗한/업그레이드 프로필별 시작·끝 해시와 junction 대상, 파일 이벤트·연속성 대조, GUI 동작 시각·PID/세션별 모델/도구 표식을 한 실행표로 연결한다. 인증 값·원문 설정·토큰은 제거한다. 각 행은 AC8 배포/파일 증거와 §19가 요구한 AC1~3·7~9의 설치 창 회귀를 구분해 판정한다. 일부 설치본 시나리오가 통과해도 실행하지 않은 다른 AC 행은 남는다. 실제 실패는 위반 동작과 원본을, 권한/제품 binding/CLI/설치 장비 부재·테스트 skip·추적 누락은 미실행/미판정과 이유를 남긴다. 다른 프로필에서 통과한 값을 빈 칸에 이식하지 않는다. 기존 `windows-observe.mjs`와 `windows-verdict.mjs`는 0330 렌더 성능 trace 판독기다. 이 절의 Win32 파일 사건이나 Jira·SDK 인수 결과를 생성하지 않는다. [관측기](../../../app/scripts/windows-observe.mjs) · [판독기](../../../app/scripts/windows-verdict.mjs)

**READY 대조.** 기존 결정 D6↔AC8, D1~5·D7↔§19 설치본 회귀(AC1~3·7~9), AR2↔IT2/E3·E6의 정상·잠금·복구·T5 입력을 확인했다. 이번 추가는 기존 V1+ΔV1의 증거 수집·작업 계획이다. 새 Decision·AC·V-pair와 구조 변경은 없다. 다음 담당은 Codex이며 Windows 설치본 증거가 채워지면 r1 자기보고와 별도로 재판정한다.

### READY 대조

리뷰의 다섯 보완 항목은 §11의 T1–T5에 대응한다. D7의 일반 메시지 보류·재시도·OFF 후 전송은 AC9에 남겼다.

§8의 2개 하네스 × 4개 대상이 AC1·5–7에, 저장·응답 경계와 세대 사본 제거가 AC2–4·8–9에 각각 대응한다. §11의 실제 테스트명은 기준 트리에서 확인했다. §9.2의 입력 없는 SDK 탐침과 §19의 모델 요청 인수는 서로 다른 관측이다.

## [구현자 기입] 설계 리뷰

r1은 D1–D7을 적용했다. 영속 선호의 식별자는 하네스·종류·출처이며, 실행 상태의 식별자는 세션과 실제 SDK 항목이다. 이름만 같은 OpenCode 프로젝트 서버나 인증 전 내장 서버는 연결 대상에서 제외한다. 설치·삭제와 자격증명 관리는 기존 소유자에게 맡긴다.

## [구현자 기입] 강제 지점 전수

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 ↔ AT1 | 선택에서 모델·기능까지 | E1·E3·E4·E5 | 두 하네스 실제 CLI, React 목록·상세 및 등록 IPC | `claude-input.cli.integration.test.ts` 7가지와 `managed-mcp.cli.integration.test.ts` | 명령 본문, 훅 파일, 서버별 핸들러, OFF 강제 호출 | 설치본 클릭에서 실제 모델까지 연결하는 Windows 인수 |
| SD1 ↔ ST1 | 응답 연속성과 새 입력 | E2·E3·E4·E5 | 잔여 작업, directory 활동, cold/warm 입장 | `post-turn.schedules.test.ts`의 background/mcp 두 경우. OpenCode `session-context.test.ts`의 A/A/B | B 후속 입력이 A 해제 전 진행, A 응답 결과 뒤 다음 UUID | Windows 설치본의 셸에서 재시작 |
| AR1 ↔ IT1 | 영속 저장과 통지 | E1·E2·E5 | 창 IPC·agent/data 실제 peer·디스크 재개방 | `extension-control.test.ts`가 파일에 형제 하네스와 외부 편집을 남기고 revision 3 확인. 쓰기 실패 후에도 3 유지 | 같은 이름의 native/builtin/user 키, 세션별 actual·pending | Windows 두 실제 창 + 재접속, 세부 분기 변이 |
| AR2 ↔ IT2 | 배포와 SDK root | E3·E6 | 원본 재조회, dist 게시와 복구, 구 사본 정리 | `adapter.native-plugins.test.ts`의 current installation, `plugin-installation.test.ts`, `deployer.test.ts`의 EBUSY | V1→V2 설치 메타데이터, 원본/링크 보존, 유효 dist 유지 | Windows 설치본 파일 이벤트·첫 배포/재배포의 사용자 스킬 실행 |
| MD1 ↔ UT1 | 유효 선호와 제출 허가 | E2·E3·E4·E5 | 부모·인증·출처 판정, 취소·실패·재시도 | `mcp-control.test.ts`, `mcp-connection.test.ts`, `managed-connections.test.ts`, `managed-mcp-projection.test.ts`, `adapter.native-plugins.test.ts` | SDK status와 실제 전송 횟수. 연결 실패·취소 중 0, 성공 후 1 | 규칙 칸의 모든 조기 반환·합성 항에 대한 개별 제거 변이 |

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
| --- | --- | --- | --- | --- |
| R1 ↔ AT1 | REQUIRED | SELF_BLOCKED | 실제 SDK 두 종과 React 카탈로그 | OFF root 재주입 검출. Windows 미실행 |
| SD1 ↔ ST1 | REQUIRED | SELF_BLOCKED | SessionRuntime 스케줄·OpenCode directory 입장 | 조기 모델 제출 검출. 두 호스트 재시작과 실제 CLI 재개 확인, 개별 분기 sweep 대기 |
| AR1 ↔ IT1 | REGRESSION | SELF_BLOCKED | `extension-control.test.ts` 파일·peer loopback | 형제 항목 소거 검출. 전체 분기 sweep 대기 |
| AR2 ↔ IT2 | REQUIRED | SELF_BLOCKED | deploy/legacy-cleanup 및 양 어댑터 설치 경계 | 응답 보유 중 게시 검출. Windows 설치본 대기 |
| MD1 ↔ UT1 | REQUIRED | SELF_BLOCKED | 연결 상태 기반 submit·네이티브 출처 구분 | 우선순위 역전 검출. 나머지 개별 분기 sweep 대기 |

## [구현자 기입] 이번 라운드 수정의 잠금

아래 좌표는 격리된 소스에서 변이를 넣고 실제로 실패를 관측한 결과다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
| --- | --- | --- | --- | --- |
| 꺼진 네이티브 설치 root도 Query에 추가 | §19 · E3 | 최초 | `adapter.native-plugins.test.ts` OFF root 부재 1건 | 잠김 |
| 프로젝트 기본값을 전역 명시 선택보다 먼저 채택 | §19 · E4 | 최초 | `mcp-control.test.ts` A의 disabled-default connect 1건 | 잠김 |
| 명시 ON 등록이 pending인 동안 submit 허용 | §19 · E4 | 최초 | `mcp-connection.test.ts` ordinary input SDK send 1건 | 잠김 |
| 선택 변경 통지에서 모든 runtime.close 실행 | §19 · E1/E3 | 최초 | `host-assemblies.order.test.ts` 기존 런타임 보존 1건 | 잠김 |
| data host가 하네스 맵 전체를 덮어씀 | E2 · 항목 병합 | 최초 | `extension-control.test.ts` 같은 하네스 형제 키 상실 1건 | 잠김 |
| active dist reader를 무시하고 게시 | E6 · 배포 경계 | 최초 | `extension-deployment-service.test.ts` 두 응답 종료 전 publish가 2회 1건 | 잠김 |
| 실제 상태로 선호 스위치를 그림 | E1 · 선택/관측 | 최초 | `ExtensionsCatalogView.interaction.test.ts` pending 중 aria-checked 불일치 1건 | 잠김 |
| Claude 최초 OFF에서 초기 연결이 끝나기 전에 disconnect | E3 · cold submit | 최초 | `adapter.native-plugins.test.ts`의 startup connection에서 SDK가 뒤늦게 connected를 반환해 1건 실패 | 잠김 |
| 취소한 입력의 원래 첨부 복구를 생략 | E5 · composer | 최초 | `chatStore.cancelled.test.ts` 경로·인라인 첨부 수거 실패 1건 | 잠김 |

§19 지정 변이 4/4 · 추가 단일 자리 변이 5건 = 표 9행이다. §10의 E1–E6 여섯 분류에는 모두 직접 관측이 있다. §10 검색어 27개 전체에 대한 개별 변이·pair path edge·규칙 칸 분기까지의 sweep은 미완이다. 특히 재접속 통지, 정책 제한, 세션별 미등록, 준비/메뉴/재시도 진입, 인증 철회, 배포 복원 각각을 제거한 결과가 남았다. 첫 구현이므로 이전 verify의 red 이력은 없다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
| --- | --- | --- |
| 문구·상태를 어디에서 읽는가 | 목록·상세에 저장한 선택, 실제 상태, 대기 수, 제한 사유를 표시한다. 상세에는 세션별 관측을 표시한다. | 한국어·영어 번역과 공통 스위치 사용 |
| 취소·실패가 사용자에게 보이는가 | 새 입력의 원문·경로 첨부·붙여넣기 첨부가 작성창으로 돌아온다. 저장 실패와 연결 실패는 행에서 해당 선택을 재시도할 수 있다. | 원래 선택을 보존한 재시도와 렌더러의 `message.cancelled` 경로 확인 |
| 늦은 응답이 도착하면 어떻게 되는가 | 하네스별 쓰기·읽기 순번이 이전 응답을 무시한다. 서버 대기 중 최신 선택과 취소 신호를 재확인한다. | `useNativeMcpCatalog.test.ts`와 `mcp-connection.test.ts` |
| 정리·부분 실패는 어느 상태에 해당하는가 | §4–6의 ON 대기·실패에 대응한다. 배포 읽기 권한은 턴 체인의 finally에서 반환한다. | 재배포가 기다리는 동안 다른 응답의 결과 수신 유지 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
| --- | --- | --- | --- |
| 1 | SDK의 첫 MCP 목록이 빈 배열이어서 연결이 끝나기 전에 전송될 수 있음 | 입력 직전의 실제 등록·status 확인과 취소/변경 재확인 | Claude 실제 native·builtin·external 세 종류, OpenCode 느린 연결 |
| 2 | 사용자 소유 원본 업데이트 뒤 기존 cwd가 이전 root를 붙들 수 있음 | 각 새 Query가 현행 설치·dist를 읽고 성공한 배포 revision을 다음 입력에서 확인 | T5 두 하네스 테스트 |
| 3 | Windows 파일 잠금 중 원래 dist 손실 | 같은 볼륨의 비공개 임시 경로에서 렌더링·검증 후 교체하고 실패하면 복구 | `deployer.test.ts`의 첫 rename 실패와 마지막 정상 파일 |
| 4 | 특정 세션의 연결 실패·출처 불명이 다른 세션의 권한으로 잘못 전파됨 | 관측을 세션별로 유지하고 영속 쓰기 권한은 출처가 일치하는 전역 행에서 판정 | `extension-catalog.test.ts`, T3·T4 |
| 5 | 실제 Claude CLI의 첫 status가 pending인 동안 끄면 disabled 응답 뒤 초기 연결이 도구를 다시 게시할 수 있음 | 최초 OFF는 같은 출처의 초기 연결 종료 뒤 해제하고 SDK 상태를 다시 확인 | 이전 번들에서 첫 OFF 요청에 native MCP 노출, 수정 뒤 동일/다른 cwd 첫 모델 요청에서 부재 |

### 설계 대비 명시적 차이

배포는 같은 파일시스템의 임시 디렉터리 및 rename을 사용한다. 만료 축은 성공한 배포 revision, 공유 축은 현재 Claude 턴 체인의 읽기 권한 두 개와 대기 게시, 재진입 축은 게시 중 들어온 세 번째 Query의 대기, 다른 무효화 축은 설치 소유 하네스의 V1→V2 갱신으로 확인했다. 세대 디렉터리의 생성자·서비스·세션 pin은 제거했다. `legacy-plugin-copies.ts`는 구 세대 정리에만 사용한다.

## [구현자 기입] 구현 보고

| AC | 자기 판정 | 이번 턴의 관측 |
| --- | --- | --- |
| AC1 | ✅ | Claude의 명령·훅·번들·복합·native·builtin·external 7종과 OpenCode CLI의 native G·내장 Jira·외장 HTTP가 같은 native 대화에서 ON/OFF/ON을 수행했다. 고유 결과, OFF 강제 호출의 핸들러 0회와 대조군을 확인했다. |
| AC2 | ✅ | Claude의 잔여 서브에이전트/MCP 결과 뒤 새 입력 1회, OpenCode A/A/B의 directory별 대기/독립성은 제어 가능한 SDK 경계에서 확인했다. OpenCode 실제 CLI에서도 S1/S3의 기존 도구 호출, A가 점유된 동안 B의 OFF 적용, 해제 전 S2 모델 요청 0회를 확인했다. Claude 실제 CLI에서도 S1·S3의 모델 응답을 도구 호출 전에 멈춘 채 S2가 OFF로 완주했고 S1·S3의 이전 핸들러 결과 뒤 각 후속 입력이 OFF임을 확인했다. 세 native ID가 유지됐다. |
| AC3 | ✅ | 실제 data/agent host와 창 포트로 ON→OFF를 저장하고 두 호스트를 순서대로 종료·재기동했다. 양 CLI 모두 기존 세션에 과거 사용자 입력과 MCP 결과가 남았고 같은/다른 cwd 새 세션의 첫 요청은 OFF였다. native 세션 ID와 각 입력 한 번을 대조했다. |
| AC4 | ✅ | 실 peer 쓰기 세 건 후 revision 3과 형제 키가 남고 디스크 실패 시 그대로였다. OpenCode G를 OFF한 채 다른 폴더에서 같은 이름의 P 핸들러만 호출했고 P에 connect/disconnect가 없었다. |
| AC5 | ✅ | 기능별 CLI 4종의 명령 본문·훅·MCP 고유 결과를 확인했다. nameless·충돌·미등록은 adapter fixture가 구별한다. 실제 Git-root 탐침에서 A connected→disabled, 같은 Git root B 첫 관측 disabled를 확인했다. |
| AC6 | ✅ | 고정 OpenCode CLI에서 선택 전환·외장 추가·내장 첫 인증 후에도 PID와 세션 경로가 같고 선택으로 인한 dispose가 0회였다. permission 응답과 실제 핸들러를 확인했다. 세 동시 세션의 이전/후속 요청과 외부 P/G도 CLI에서 확인했고 SDK 등록 불가·충돌은 별도 fixture로 확인했다. |
| AC7 | ✅ | 목록·상세의 고정 ON/OFF 스위치를 클릭하거나 키보드로 활성화해도 write가 없었고, 등록 IPC에 직접 금지된 종류·대상을 보내면 거부했다. 별도 세션 두 개가 서로 다른 실제 상태 및 pending 수를 반환했다. |
| AC8 | ⚠️ | Linux에서 구 사본 정리·링크 보존, V1→V2 원본 재조회, 배포 실패 복구를 확인했다. 실제 Claude 호스트에서 첫 부팅과 재배포 뒤 `/claude:restart-proof`의 V1/V2 본문을 모델 요청으로 확인했다. Windows 설치본의 파일 이벤트와 Jira 연속 호출 검증은 남았다. |
| AC9 | ✅ | 늦은 ON, 대기 중 OFF, 실패·해제 실패·취소는 SDK 전송을 보류했다. 성공 뒤 한 차례 제출했고 취소 UUID는 제출하지 않았다. React store가 원문과 경로/인라인 첨부를 복원했다. |

**✅ 8 · ⚠️ 1 · ❌ 0 = 총 9.**

| 항목 | 결과 |
| --- | --- |
| 변경 경로 | 전용 data write·카탈로그와 창 통지, Claude/OpenCode 입력 경계, deployer·레거시 정리, 작성창·목록·상세, SDK/CLI/IPC/React 테스트, 현재 구조 문서 |
| 기능 실행 | 저장·목록·배포·복구 12파일 179케이스, OpenCode 어댑터 8파일 42케이스, Claude 어댑터 4파일 58케이스, 후속 준비·T5·AC9 2파일 20케이스. 실제 Claude CLI·React 3파일 28케이스, 후속 읽기 전용 클릭·키보드 2파일 23케이스, 호스트 조립 23케이스도 통과했다. 각기 별도 실행으로 일부 겹친다. |
| 실제 CLI | Claude Agent SDK 0.3.296 동봉 CLI와 OpenCode 1.18.27 Linux 실행 파일 / 격리된 홈 / 로컬 모델·MCP endpoint. OpenCode 실측 파일 1/1, 243.53초. A/A/B 추가 후 같은 파일 1/1, 251.10초. Claude 실제 CLI는 A/A/B 포함 1파일 8/8, 316.85초. OpenCode의 대조군 선택을 명시한 재실행도 1/1, 450.21초. |
| 재시작 실행 | `node scripts/smoke-claude-extension-restart.mjs out/main`과 `ORCINUS_ORCA_TEST_OPENCODE_EXE=<1.18.27 실행 파일> node scripts/smoke-extension-restart.mjs out/main`이 실제 창 포트·두 호스트·SQLite·CLI를 연결했다. Claude는 8턴, OpenCode는 6턴이다. |
| 운영 게이트 | 마이그레이션 39+2개, 목록 주체 3개, v0.3.1 이후 append-only. 문서 인벤토리 9항목·127채널과 링크, 제품 표기, process boundary, 실-git 18스위트 예산 가드 통과. electron-vite 빌드와 data→agent 호스트·preload smoke 통과. 500 kB chunk 경고 발생. |
| 추가·수정 테스트 | 최초 구현 커밋의 변경·삭제 테스트/fixture는 42개. 후속 Windows fixture의 Linux 경로 및 공개 transport 검사는 해당 테스트 좌표에서 재실행했다. CLI는 io 풀, 임시 홈·로컬 서버를 쓰며 실제 Git·시간 예산은 저장소 가드로 확인했다. |
| 블로커 / 재검증 | Linux에서 로컬 CI 단계가 모두 통과했다. 전체 Vitest는 10,965개 통과·예상 실패 1개·건너뜀 11개·예기치 않은 실패 0개였고, Node 스크립트 테스트는 1,178/1,178이었다. lint 오류 0·경고 15, 세 타입 검사, 가드 5종, 앱 빌드와 두 호스트·preload 기동을 확인했다. AC8의 Windows 설치본 파일 이벤트·배포·실제 도구 인수는 남아 있다. |
| V / 대상 커밋 | SELF_PASS 0 / SELF_BLOCKED 5. §10 분류별 구현 6/6. (r1 구현 — 좌표는 INDEX) |

### 통합 회귀 확인

전역 선택과 별개인 런타임 도구의 배포 버전이 바뀌면 유휴 영속 채널을 다음 수신 전에 다시 띄운다. 기존 채널에 서브에이전트 결과가 대기 중이면 그 채널에서 결과를 먼저 소비한다. `chat-turn.runtime-tools.test.ts`, 관리형 MCP 정책, 턴 종료 후 스케줄링을 함께 실행해 47/47을 확인했다. OpenCode의 새 세션은 MCP 입장 확인 뒤 생성된다. 시작·런타임 순서 시험은 시간 배율 6에서 23/23, 기본 배율에서 시작 시험 15/15였다. 전송 취소는 원문 및 첨부를 복원하고 Work 질문 인용은 현재 초안에 덧붙인다. 취소·행 재선택 경로를 포함해 첫 전체 실행에서 실패한 18개 파일을 함께 다시 검사해 125/125 통과했다.

## [구현자 기입] Review Signals

r1 첫 구현이다. 실제 Claude SDK는 시작 직후 빈 MCP status를 반환할 수 있고, OpenCode SDK의 서버 이름은 서로 다른 프로젝트 선언에서 같을 수 있다. D1·D2·D5·D7에서 정한 실제 상태와 입력 제출 경계에서 두 경우를 재현했다. Linux 실측과 Windows 설치본에서만 재현할 수 있는 작업을 구분했다.


**검증자 기록** — 기준 커밋·V pair 판정·실제 CLI/Windows 증거·파생 이슈를 검증 턴에 기입한다.
