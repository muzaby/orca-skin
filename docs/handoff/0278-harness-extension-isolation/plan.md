# Claude·OpenCode 확장 전역 기본값과 프로젝트 제어 격리

## 메타

| 항목 | 값 |
|---|---|
| slug | 0278-harness-extension-isolation |
| 작성자 / 일자 | Codex / 2026-10-22 |
| 상태 | READY — D32 capability·비소급 snapshot·동시 저장의 최종 설계는 §27. 기존 verify FAIL은 구현 후 재검증 |
| V mode / 기준 / revision | Delta V / V1@256ddd24 + ΔV1@087543ed + ΔV2@81373134 / 유효 revision: V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 |
| 관련 작업 | [0277 MCP 관측](../0277-opencode-mcp-catalog/plan.md), [0275 공유 인스턴스](../0275-opencode-shared-instances/plan.md), [0276 Composer 준비](../0276-opencode-composer-preparation/plan.md) |

# Part I — Product & UX Contract

## 1. 목표

Claude와 OpenCode는 하네스의 네이티브 전역 설정을 시작 기준으로 읽고, SDK가 Orca 실행에만 격리 적용할 수 있는 항목을 제어한다. MCP·네이티브 플러그인은 현재 작업경로 단위로 제어하며 같은 경로의 세션은 구성을 공유한다. Claude 프로젝트 설정은 후속 결정 D20에 따라 네이티브 `settings.local.json`을 사용하며 MCP·플러그인 이외의 키를 보존한다. OpenCode도 D30에 따라 네이티브 프로젝트 파일을 사용하며 외부 CLI·Desktop과 공유한다. 전역 SDK 제어의 Orca 격리와 단일 서버 조건은 유지한다.

## 2. 사용자 요구 출처

2026-10-22 현재 대화의 아래 문장이 확정 정책이다. 이전 어시스턴트의 V2 임베디드 전환·커스텀 엔진 확장 제안은 채택 결정이 아니다.

> 1. Claude/opencode는 전역 (nav -> 플러그인 -> 스킬/mcp) 의 설정을 기본 설정으로 시작한다.
>
> 2. 세션 기준 orcinus-orca 제품 코드(sdk활용)에서 오버라이드를 지원할 수 있다면 지원한다. Claude는 세션레벨에서 on/off 가능. 현재 세션의우측 패널에서 제어 버튼 제공하고 있음.
>
> 3. 세션에서 지원할 수 없다면 전역 설정에서만 활성화 제어를 지원한다. 세션의 우측 패널에서는 제어 버튼(on/off)을 제공하지 않음 모니터링만 가능.
>
> 4. Sdk를 통해 전역의 설정을 지원할 수 있다. 단 claude/opencode 등의 전용 하네스의 exe에서 사용하는 세팅값과 별도로 orcinus orca의 제품내에서만 격리 설정 운영이 가능해야 한다. 이 경우 전역 설정에서 스킬, 네이티브 플러그인, mcp에 대해 on/off 버튼을 노출할 수 있다. On/off 동작에 대해 orcinus orca에서만 작동해야 한다.

같은 날짜의 후속 답변과 추가 요구를 아래에 보존한다. 전역 제어 미지원 시 버튼을 숨기는 이전 초안과 nav 색상 유지 결정은 후속 요구로 대체한다.

> 새 세션의 시작 기본값에만 반영 (권장)
>
> 전역 설정에 대해 Orcinus orca에서 전역 설정에 대해 on/off 제어가 가능하지 않으면 전역 렌더링 시(nav->플러그인->스킬/mcp), 폰트를 회색으로 표기하라. E.g., superpowers가 claude 설정에서 off더라도 orcinus orca에서 활성화가 가능하면 off+토글비고정+일반폰트. Claude 설정에서 on 인데, orcinus orca에서 활성화가 불가능하면 on+토글고정+회색폰트.
>
> 클로드 settings.local.json 저장 운영은 반대이다. Oricinus orca의 프로그램 코드 안에서만 유효해야 한다. 해당 파일의 운영은 허용된 권한을 되돌릴려면 파일에서 직접 제거하는 수밖에 없어 운영을 하고있지 않다.

## 3. Decision Ledger

| ID | 결정 / 조건 / 출처 | 상태 |
|---|---|---|
| D1 | 두 하네스의 시작 기준은 nav에서 읽는 네이티브 전역 설정 — 사용자 1·후속 SDK 제어 재확인 | ACTIVE — D22·D26, 적용 시점 D15 |
| D2 | 제품의 SDK 연동으로 해당 세션에만 적용 가능한 항목은 세션 오버라이드와 우측 패널 on/off 제공 — 사용자 2 | SUPERSEDED → D16 |
| D3 | 세션 제어 미지원이면 우측 패널에 on/off를 렌더링하지 않고 실제 상태만 관측 — 사용자 3 | SUPERSEDED → D16 |
| D4 | 전역 on/off도 하네스 외부 실행 설정과 분리된 Orca 전용 설정·실행 적용을 보장할 때만 제공 — 사용자 4. 이전 초안은 미지원 시 토글 숨김으로 해석 | SUPERSEDED → D10·D11 |
| D5 | 대상은 스킬·네이티브 플러그인·MCP. 엔진 이름만으로 제어 가능 여부를 일괄 판정하지 않음 — 사용자 2·4의 조건을 항목별로 적용 | ACTIVE |
| D6 | 세션 변경을 다른 세션·전역 기본값·외부 하네스 설정에 전파하지 않음 — 사용자 2·4의 격리 의미 | SUPERSEDED → D16·D20 |
| D7 | 작업폴더 파일 금지·Orca 영역 저장, OpenCode 단일 서버·directory instance·native 초기화 유지 — 앞선 사용자 요구 | 파일 금지는 SUPERSEDED → D20·D30. 서버·초기화 조건은 ACTIVE |
| D8 | Composer 팝업 안내 금지와 nav 스킬 색상 '현상태 유지' — 앞선 사용자 결정 | SUPERSEDED → D11·D12 |
| D9 | MCP 목록·실행 관측은 0277의 R1–R11을 유지하며 활성화 정책과 구별 — 앞선 사용자 범위 선언 | ACTIVE |
| D10 | Orca 전용 설정·실행 적용을 격리할 수 있는 항목만 전역에서 조작 가능. 외부 하네스가 off여도 Orca에서 활성화 가능하면 조작 가능한 토글 제공 — 사용자 추가 요구 1 | ACTIVE — 프로젝트 파일 공유는 Claude D20·OpenCode D30에서 별도 허용 |
| D11 | nav 스킬/MCP에서 제어 가능하면 일반 폰트·조작 가능한 토글, 불가능하면 회색 폰트·고정 토글. on/off 값은 그대로 표시하며 색상과 제어 가능성을 on/off에 종속시키지 않음 — 사용자 추가 요구 1 | ACTIVE |
| D12 | Composer 팝업에 로딩·실패 등 안내를 표시하지 않음 — D8 승계 | SUPERSEDED → D29. 에이전트 제목 우측 로딩 회전 스피너만 예외 |
| D13 | 전역 on/off 변경은 새 세션의 시작 기본값에만 적용. 기존 세션에 소급 전파하지 않음 — U1 사용자 답변 | SUPERSEDED → D15 |
| D14 | `.claude/settings.local.json`을 생성·수정하여 확장 on/off를 영속화하지 않음. Orca 제품 코드의 SDK·runtime 주입으로만 실행에 반영 — 사용자 추가 요구 2 | SUPERSEDED → D20 |
| D15 | 전역 조작은 아직 실행되지 않은 인스턴스의 기본값. 실행 중인 인스턴스에는 정책상 자원 회수 후 재생성 또는 프로그램 재시작 시 적용 — 후속 사용자 1 | ACTIVE |
| D16 | Claude·OpenCode 모두 세션별 제어를 제공하지 않고 MCP·네이티브 플러그인을 프로젝트(현재 작업경로) 단위로 제어. 같은 경로의 세션에 공유, 다른 경로·전역과 격리 — 후속 사용자 | ACTIVE — 외부 하네스와의 프로젝트 파일 공유는 D20·D30 |
| D17 | 우측 패널 타이틀의 작업경로 표시가 범위를 설명하므로 별도 범위 안내를 추가하지 않음 — 후속 사용자 | ACTIVE |
| D18 | 제거 가능하면 settings.local.json 쓰기 경로 제거, 추가 결정이 필요한 상황 보고 — 이번 사용자 | SUPERSEDED → D20. 기존 파일 삭제는 승인 내용 아님 |
| D19 | 프로젝트 선택은 DB 대신 Orca 설정 JSON에 유지하고 형식은 제안 — 당시 사용자 답변 | SUPERSEDED → Claude D20·D21, OpenCode D30. 재시작 후 유지 요구는 네이티브 저장으로 승계 |
| D20 | Claude는 `settings.local.json` 사용. MCP·플러그인 키만 편집 허용하며 Orca에도 동기화 — 사용자 정정 답변 | ACTIVE. 해당 파일을 읽는 외부 Claude와의 프로젝트 설정 공유를 허용 |
| U1 | 전역 변경의 기존 세션 적용 여부 | SUPERSEDED → D13 |
| U2 | 세션 오버라이드의 앱 재시작·이력 재개·fork 승계 규칙 | SUPERSEDED → D16·U3 |
| U3 | 프로젝트 선택을 Orca 전용 저장소에 보존할지 앱 실행 중에만 유지할지 | SUPERSEDED → D19 |
| U6 | Orca JSON의 프로젝트 선택 저장 형식 | SUPERSEDED → Claude D20·D21, OpenCode D30. 별도 Orca 형식 질문 종료 |
| U7 | 일반 MCP on/off의 네이티브 저장 위치인 `~/.claude.json` 프로젝트 MCP 상태도 허용할지 | SUPERSEDED → D21 |
| D21 | SDK 네이티브 MCP 저장 허용. 외부 프로젝트 변경은 화면 즉시·프로젝트 유휴 때 실행 적용, 재시작은 기존 자원 회수 정책 — 사용자 구현 지시 | ACTIVE — 0279 D7·D8로 구현 |

갱신 메모: 세션 제어→D16, 전역 적용 시점→D15, Claude 저장→D20·D21, nav 범위→D23으로 닫았다. 아래 초기 초안은 이력이며 유효 계약은 V1에 ΔV1·ΔV2·ΔV3·ΔV4를 순서대로 적용해 읽는다. D25의 영속 저장 해석은 사용자 승인으로 취급하지 않고 D26으로 철회한다. 동시 파일 편집 대기 요구는 D31·§22–25, 격리 불가 항목의 모니터링 결정은 D32·§26에 추가한다.

후속 사용자 원문:

> 전역 조작은 아직 실행되지 않은 인스턴스에만 기본값으로 주입가능. 실행중인 인스턴스는 인스턴스 재시작(정책에 의한 자원 회수 후), 혹은 프로그램 재시작 시에 적용되도록.
>
> 클로드는 세션별 제어 미지원. 모두 프로젝트(현재 경로) 단위로만 mcp/플러그인 제어 지원하도록 하고 우측 패널의 제어도 프로젝트 단위로 지원하도록.
>
> 우측 패널에는 타이틀 영역에서 작업 경로를 표기하고 있기때문에 간접접으로 범위를 설명하고 있다.
>
> 제거 가능하다면 제거하라. 또 결정이 필요한 상황에 대해 정리하라.
>
> 정정하겠다. Claude의 경우 Settings.local.json 사용으로 정정하겠다. 단 mcp/플러드인 키에 대해서만 편집 허용하며, orcinus orca에서도 동기화돼야 한다.

## 4. 최초 조사에서의 코드와 정책 차이 — 현재 보완은 ΔV1·ΔV2

| 대상 | 근거 | 판단 |
|---|---|---|
| Claude 프로젝트 공유 | `app/native-resource-sharing.ts`가 peer runtime마다 SDK 변경 | 공유는 유지하되 작업경로를 기준으로 정규화해야 함 |
| Claude plugin 저장 | `claude/plugin-state.ts`가 `enabledPlugins` 항목을 병합하고 다른 키 보존 | D20에 따라 유지. Orca JSON 대체·기존 파일 삭제 없음 |
| Claude MCP 저장 | SDK `toggleMcpServer`; settings 타입의 `enabledMcpjsonServers`·`disabledMcpjsonServers` | 프로젝트 `.mcp.json` 승인과 일반 MCP 실행 on/off는 다름. D21에서 SDK native 저장 허용, 실제 관측은 0279 evidence 참조 |
| Claude SDK 주입 | `native-resources.ts`의 `applyFlagSettings`·`reloadPlugins` | 내부 SDK 세션 API를 프로젝트 전체에 조정하는 구현 수단으로 사용. 제품에서 세션별 제어를 노출하지 않음 |
| OpenCode 전역 주입 | `native-storage.ts`가 서버 시작 환경에 구성 전달 | 실행 중 서버에서 새 directory가 최신 기본값을 읽는 경로 조사 필요 |
| OpenCode 공유 | 1.17.19 InstanceStore의 directory 키, MCP InstanceState | D15·D16과 범위가 맞지만 native plugin 변경 API 지원은 별도 검증 |
| 외부 설정 상속 | 두 엔진의 설정 파일·plugin 자동 탐색 | Claude의 허용 키 공유와 다른 키 보존을 구분. off의 실제 효력을 항목별로 검증 |

## 5. 동작과 표시

| 행동 | 결과 |
|---|---|
| nav 전역 on/off 변경 | 지원되는 SDK 제어 경로에만 전달. 별도 전역 선택 영속 저장은 승인되지 않았으며 기존 인스턴스에 소급하지 않음 |
| 인스턴스가 없는 경로 시작 | 최신 전역 기본값과 명시 프로젝트 선택으로 구성 |
| 기존 인스턴스에 새 세션 추가 | 해당 프로젝트의 실행 구성 공유 |
| 우측 패널 MCP·plugin 변경 | 같은 엔진·작업경로의 실행 세션에 적용하고 실제 결과 통지 |
| 다른 작업경로 | 제어값을 전파하지 않음 |
| 정책상 자원 회수 후 인스턴스 재생성 / 앱 재시작 | 최신 기본값과 명시 프로젝트 선택 적용. Claude 저장은 D20·D21, OpenCode 네이티브 저장은 D30 |

| 위치 / 제어 능력 | 토글 | 폰트·상태 |
|---|---|---|
| nav 제어 가능 | on/off 조작 가능 | 일반 폰트 |
| nav 제어 불가 | 실제 on/off를 유지한 고정 토글 | 회색 폰트 |
| 우측 패널 프로젝트 제어 가능 | 프로젝트 전체 on/off | 실제 상태. 타이틀의 경로가 범위를 설명 |
| 우측 패널 프로젝트 제어 불가 | 토글 없음 | 모니터링 |

on/off는 로드·연결 성공과 별개다. 실패한 변경을 성공으로 표시하지 않으며 부분 실패는 확인된 실제 상태로 보고한다. Composer 팝업에는 안내 문구를 추가하지 않으며, D29의 에이전트 제목 우측 로딩 스피너만 허용한다.

## 6. 범위와 구현 분리

공통 정책은 전역 기본값, 현재 경로의 MCP·native plugin 제어, 항목별 제어 능력이다. 프로젝트 파일 공유는 Claude D20·OpenCode D30이며 스킬의 전역 제어·표시 규칙은 유지한다. MCP 관측은 [0277](../0277-opencode-mcp-catalog/plan.md)에서 수행한다.

Claude 파일 쓰기 제거와 Orca JSON 대체 제안은 철회한다. [0279](../0279-claude-project-plugin-state/plan.md)는 제한된 네이티브 키 편집과 Orca 동기화를 설계한다. 기존 외부 파일 자동 삭제·자동 이관, OpenCode 커스텀 엔진 수정·V2 임베디드 도입은 승인 내용이 아니다.

## 7. 이전 Requirements / Acceptance 초안 — SUPERSEDED

| R / AC | 관측 동작 | 검증 경로 |
|---|---|---|
| R1 / AC1 | 전역 변경은 실행 중 인스턴스를 유지하고 새 인스턴스에 적용 | nav 저장 → 기존 A·새 B → 실제 구성 |
| R2 / AC2 | 같은 작업경로의 세션들이 MCP·plugin 선택 공유 | 우측 패널 → IPC → 같은 경로 A/B SDK |
| R3 / AC3 | 다른 경로·전역 및 허용하지 않은 외부 설정 키 보존 | A 조작 → C 실제 구성·파일의 비대상 키 비교 |
| R4 / AC4 | 우측 패널은 프로젝트 제어 가능 항목에만 토글 제공 | capability → UI·IPC 검증 |
| R5 / AC5 | Claude의 허용된 MCP·plugin 키만 변경하고 파일 선택과 Orca 상태를 동기화 | 비대상 키 보존·읽기·쓰기·동일 프로젝트 peer·후속 실행 |
| R6 / AC6 | nav 제어 가능성에 따른 일반/회색·조작/고정 조합 | on/off × capability 렌더 |
| R7 / AC7 | 단일 OpenCode 서버·directory 수명과 native 초기화 유지 | 서버/인스턴스 생성·자원 회수·재진입 |
| R8 / AC8 | 우측 패널 기존 경로 표시와 Composer 안내 금지 유지 | 렌더·기존 UI 회귀 |
| R9 / AC9 | 목록 조회가 실행 상태·설정·서버 수명 변경을 일으키지 않음 | 0277 조회 경로 |

ACTIVE 결정 ↔ AC 대조: D1·D15→AC1, D5→AC4·AC6, D7→AC7, D9→AC9, D10·D11→AC3·AC6, D12·D17→AC8, D16→AC2·AC3·AC4, D20→AC5. 당시 미정이던 OpenCode D19·U6는 ΔV2 D30으로 대체됐다. Claude D21은 0279에서 구현한다.

## 7-A. V 초안의 대체

이전 DRAFT의 VP1–VP5는 세션별 격리를 전제해 SUPERSEDED 처리한다. 아직 READY 기준선·선택 변이는 없었으므로 확정 증거의 유실은 없다. 새 Baseline V는 AC1–AC9의 프로젝트·인스턴스 범위로 재구성하며 Claude 부분은 0279에서 허용 키와 동기화 경계를 잠근다.

# Part II — Technical Design

## 8. AS-IS → TO-BE

| 경계 | AS-IS | TO-BE |
|---|---|---|
| Claude 상태 보관 | plugin은 settings.local.json, MCP는 SDK toggle | plugin 저장 유지. 일반 MCP 네이티브 저장은 D21로 허용 |
| 프로젝트 동기화 | project_id 또는 native Git root | 현재 작업경로의 정규화 키 |
| 초기 plugin 조립 | native catalog·provider·local 설정 | 해당 작업경로의 native local 선택과 SDK 주입값 일치 검증 |
| 전역 적용 시점 | 세션별 적용 초안 | 인스턴스 생성 시점. 실행 중인 인스턴스와 전역 revision 구분 |
| OpenCode | 시작 환경 + directory instance | 서버 하나 유지, 새 directory의 최신 구성 해석 경로 검증 |

## 9. 상태·오류·수명

실행 상태는 SDK 관측이 정본이며 저장된 on/off는 희망 구성이다. 프로젝트 변경은 기존 직렬화·generation 검사·peer 결과 통지 경로를 사용한다. 실패한 peer를 성공으로 표시하지 않으며 다른 정상 peer의 결과도 보존한다.

Claude 토글은 D20의 허용 키만 병합한다. `permissions`·`hooks`·`env`·`model` 등 비대상 키를 삭제하거나 다시 구성하지 않는다. 기존 값의 출처를 추측하여 정리·이관하지 않는다. 일반 MCP on/off를 settings.local의 승인 키로 바꿔 저장하지 않는다.

## 10. 강제 지점 조사 후보

| EP | 경계 | 구별할 입력·결과 |
|---|---|---|
| EP1 | 전역 저장·설정 해석·인스턴스 생성 | 변경 전후 기본값, 기존/새 directory |
| EP2 | 패널·IPC·scope·mutation·peer·spawn | 같은 경로의 서로 다른 프로젝트 ID, 같은 저장소의 서로 다른 경로 |
| EP3 | native 파일·SDK 옵션·reload | 허용 키 변경, 비대상 키 보존, 파일 상태와 실제 로드 상태 |
| EP4 | capability·DTO·nav·panel·main 검증 | on/off × 제어 가능성 |
| EP5 | instance owner·server profile·종료·재조회 | 기존 서버에서 새 폴더 생성, 지각 응답 |

이 표는 V1 이전 조사 후보이며 현재 분모가 아니다. 유효 검증 기준과 추가 미잠금 경계는 V1·ΔV1·ΔV2에 명시한다.

## 11. 남은 결정과 기술 검증

| ID | 분류 | 항목 |
|---|---|---|
| U6 | 결정 완료 — D30 | OpenCode 네이티브 프로젝트 파일·외부 CLI/Desktop 공유 허용. Orca JSON 제안은 대체 |
| U7 | 결정 완료 — D21 | SDK native 프로젝트 MCP 상태 저장 허용. 0279에 반영 |
| U4 | 이번 범위 밖 | 선택 삭제/reset UI는 요청·확정되지 않음. 임의 추가하지 않으며 기존 on/off 완료를 막는 질문으로 사용하지 않음 |
| U5 | SUPERSEDED → D21 | 프로젝트 전체 유휴 적용, 재시작 필요 시 기존 자원 회수 정책. 재질문하지 않음 |
| T1 | 기술 검증 | OpenCode 실행 중 서버를 유지하면서 새 directory에 최신 기본값 전달 |
| T2 | 기술 검증 | 각 MCP/plugin의 프로젝트 제어 API·reload 효과·부분 실패 |
| T3 | 기술 검증 | 스킬 off가 모델 사용·명시 slash dispatch에 미치는 범위 |
| T4 | 기술 검증 | capability·목록 상태·실행 상태의 출처·세대 정합성 |

## 12. 검증·운영 gate

정책 기록 자체는 `git diff --check`·상대 링크·dispatch 정합성을 검사한다. 코드 구현에서는 subtree 지침에 따른 lint·typecheck·관련 Vitest와 변경 경로의 파일 불변·프로젝트 공유 검증을 수행한다.

## [구현자 기입] — V1 이전 조사 이력

당시 공통 정책 전체는 미구현이었다. Claude 파일 쓰기 제거는 실행 전에 취소했으며 프로덕션 코드는 변경하지 않았다. 기존 plugin 제한 편집·후속 실행·프로젝트 peer 공유 관련 테스트의 기준선은 확인했다. MCP 저장 범위와 외부 편집의 실행 중 반영은 아직 완료로 판정하지 않는다.


# V1 확정 — 네이티브 기준값과 제어 능력

## 사용자 정정과 결정

사용자: “전역 기본값을 왜 저장하는가 전역 값을 각 하네스의 기본값으로 받아오고 sdk로 제어가능하면 제어하고 불가능하면 활성화를 고정하고 회색 표시하기로 합의하지 않았나?”

| ID | 결정 | 상태 |
|---|---|---|
| D22 | nav는 하네스 전역 설정을 기준으로 표시. 별도의 기본값 사본/extensionDefaults 저장소를 만들지 않음 | ACTIVE |
| D23 | nav 프로젝트 선택 UI를 추가하지 않음. 프로젝트 범위는 우측 패널 타이틀 경로 | ACTIVE — 0277 U1/U2·직전 제안 대체 |
| D24 | SDK로 Orca만 제어 가능한 항목에만 가변 토글. 다른 항목은 native 상태의 고정 토글·회색 글씨 | ACTIVE — D10/D11 구체화 |
| D25 | 명시 전역 선택값도 Orca JSON에 영속화한다는 구현 해석 | SUPERSEDED → D26. 사용자 승인으로 볼 수 없음; 기존 코드·보고는 구현 이력 |

U5는 D21의 유휴 적용/기존 자원 회수로 해소됐다. 네이티브 값 읽기와 Orca 선택값은 구별하며 미지정은 항상 native 값을 따른다. Claude 프로젝트 저장 위치는 D20/D21을 유지한다.

## 구현 범위와 capability

| 대상 | 전역 제어 | 프로젝트 제어 |
|---|---|---|
| Orca 소유 스킬/MCP | 기존 설정 토글 사용 | 기존 하네스 지원에 따라 표시 |
| Claude 설치 plugin | SDK inline plugin flags로 Orca만 제어 | 기존 settings.local 허용 키+SDK reload/유휴 동기화 유지 |
| Claude 스킬 | SDK skills allow-list로 제어 가능한 source만 | 개별 프로젝트 스킬 정책은 추가하지 않음 |
| Claude native MCP | SDK toggle은 네이티브 프로젝트 저장을 변경하므로 전역 격리 제어로 사용하지 않음: 고정 | SDK 지원과 cwd 격리를 함께 입증해야 함. 현재 F1 미해결, 무조건 지원으로 판정 금지 |
| OpenCode native MCP | directory SDK 제어 가능성과 시작 적용 시점을 검증. 현재 별도 전역 JSON 영속화는 D26과 불일치 | 같은 directory 상태 공유·유휴 재적용. D30·§19의 네이티브 제한 편집과 실제 SDK 효과 검증 |
| OpenCode native plugin/skill | SDK의 개별 load on/off 미지원: 고정·회색 | plugin 파일 편집은 D30 허용. 실제 on/off 가능한 항목만 제어; 범용 plugin·skill 제어를 추정하지 않음 |

OpenCode Config.update는 파일 선택·키 보존·폐기 시점이 D30을 충족한다고 입증되기 전 제어 경로에 사용하지 않는다. plugin tuple options는 plugin 자체가 해석하는 값이며 공통 disabled API로 간주하지 않는다. V1은 준비 완료 뒤 첫 메시지 전에 MCP 선택을 적용했다. ΔV2에서는 native 파일이 다음 bootstrap에 직접 반영되며, 기존 instance의 SDK 변경 효과·초기 연결 비용은 별도로 검증한다.

## V1 AC — ΔV1·ΔV2 적용 전 기준선

| AC | 관측 기준 |
|---|---|
| AC1 | nav는 global-only native 설정을 읽고 on/off × capability에 따라 가변/고정 토글과 일반/회색 글씨를 표시 |
| AC2 | Claude plugin의 global off도 Orca 선택 on으로 신규 프로젝트 인스턴스에서 활성화. 외부 global/local 파일은 전역 조작으로 변경하지 않음 |
| AC3 | SDK skills allow-list에 off 선택이 실제 반영되며 OpenCode 미지원 source는 고정 |
| AC4 | Orca 제어의 명시 선택만 JSON에 보존. native 기본값/인증/목록 복제와 DB 저장 없음 |
| AC5 | 실행 중 directory의 기본값은 유지, 새 directory/정책상 종료 뒤 재생성은 최신 선택 적용 |
| AC6 | OpenCode MCP 프로젝트 on/off는 같은 directory의 세션에 공유되고 다른 directory/외부 설정과 격리. busy 상태에서는 제어를 거부/보류 |
| AC7 | Claude 외부 프로젝트 변경의 화면 즉시·프로젝트 전체 유휴 적용, SDK native 저장·기존 자원회수 회귀 유지 |
| AC8 | native 선언과 runtime dynamic MCP를 구별. 전역에 프로젝트 실행 상태를 섞지 않고 우측 패널은 runtime 우선 |
| AC9 | 준비 전/부분 실패/종료·늦은 결과에서 목록과 제어가 거짓 성공을 표시하지 않음 |
| AC10 | nav/우측 패널 조회는 서버를 새로 만들지 않으며 composer 준비 수명·독립 agent/model 캐시를 유지 |

## Baseline V1

이 표는 앞의 AC 초안·V 초안·강제 지점 후보를 대체한다.

| Pair | 노드 | 경로·직접 oracle |
|---|---|---|
| VP1 | R1↔AT1 NEW REQUIRED | nav→toggle IPC→선택→새 instance SDK. CustomizeList/handlers/global-extension tests에서 on/off×capability와 외부파일 sentinel 확인(AC1–5) |
| VP2 | SD1↔ST1 NEW REQUIRED | directory A 두 owner→전역변경→새 B→A 최종해제→A 재생성. snapshot 및 실제 adapter tests(AC5·6) |
| VP3 | AR1↔IT1 NEW REQUIRED | shared schema/preload/API/handler/설정 store→Claude flags·OpenCode SDK. 실제 등록 handler와 SDK fixture(AC2·4·6) |
| VP4 | AR2↔IT2 NEW REQUIRED | global native reader→nav hook→rows + runtime resource→panel. 실제 임시 파일과 render harness, partial·지각 응답(AC1·8·9) |
| VP5 | MD1↔UT1 NEW REQUIRED | 명시 선택 저장·canonical cwd·merge defaults→프로젝트 선택. 임시 JSON과 native값 재조회 tests(AC4·5) |
| VP6 | MD2↔UT2 NEW REQUIRED | SDK 제어 허용/거부·global-only discovery·skill allow-list. adapter/configured-resources/adapt tests(AC2·3·6) |
| VP7 | SD0↔ST0 INHERITED REGRESSION | 0279 프로젝트 sync, 0280 준비상태, 0275 directory/server lifecycle(AC7·9·10) |

## §10 확정 강제 지점

검색 범위: `app/src/{shared,preload,main,renderer}`에서 `skillEnabled|canToggle|nativeResources|setNativeResource|readClaudePluginCatalog|nativeOpenCodeResources|createAdapterRegistry`.

| EP | 자리 목록 | N | 직접 oracle 좌표 |
|---|---|---|---|
| EP1 | 설정 schema/store, shared IPC schema, preload/API, catalog handler, bootstrap 등록 | 5 | extension-choices/extension-catalog/handlers 및 preload 테스트. 미지원 변경 거부와 저장된 실제 JSON |
| EP2 | Claude startup flags, skills allow-list, project snapshot 획득/해제 | 3 | adapter.native-plugins/adapt 및 snapshot 테스트, 원래 off plugin·A/B·재생성 |
| EP3 | OpenCode directory 선택 snapshot, 준비/첫 메시지 전 적용, live mutation, 선택 저장·reconcile | 4 | session-context/adapter/channel tests. 실제 SDK 경로와 A/B별 응답 |
| EP4 | native global reader 두 종류, catalog hook, nav skill/MCP/plugin rows, 상태 패널 capability | 5 | configured-resources + useNativeMcpCatalog + CustomizeList + native tile tests |

17자리. 포트 추가 시 양 끝의 실제 조립 값을 다르게 넣어 직접 결과를 단언한다. 타입검사/코드읽기만으로 완료 처리하지 않는다. 저장 중 오류면 토글 성공으로 표시하지 않으며 정상 항목은 유지한다.

## 기술 설계

네이티브 전역 읽기는 명시 global-only 입력으로 한다. 프로젝트 파일·현재 기본 작업폴더 fallback이 nav 전역 읽기에 섞이지 않는다. native catalog는 안전한 id/name/status/capability만 renderer로 전달한다.

V1은 기존 JSON에 명시 선택을 저장하도록 설계했으나, 전역 선택 영속화와 실제 저장 위치는 사용자 승인 없이 구현 해석으로 도입됐다. ΔV1의 D26·저장 구분표가 이를 정정한다. native 기준값·목록·인증정보 복제와 DB 저장은 계속 금지한다.

기본값 snapshot은 native instance 수명에 귀속한다. OpenCode는 directory state, Claude는 같은 cwd의 live Query owner를 묶어 새 Query가 기존 기본값을 공유한다. snapshot의 마지막 owner 해제 후에만 새 기본값을 읽는다. 프로젝트 선택은 전역 snapshot보다 우선하며 busy/epoch 검사를 유지한다.

## V1 당시 운영 gate·READY 검토 — 현재 상태는 ΔV2

관련 Vitest→node/web/test 타입→lint→Electron ABI 유지 build, 문서 inventory/link·diff/trailer. 실제 커스텀 OpenCode 바이너리/외부 사용자 환경 및 시각 검증은 실행 증거와 분리한다. ACTIVE D1/D15→AC5, D5/D10/D11/D24→AC1/2/3, D7→AC6/10, D9→AC8/9, D12/D17/D23→AC10, D16→AC6/7, D20/D21→AC7, D22/D25→AC4로 대조했다.

# ΔV1 — 최종 합의·저장 경계·검증 기준 정정

## 13. 적용 기준과 결정

기준은 main의 `256ddd24`에 있는 V1과 [기존 FAIL 보고](verify.md)다. 이번 산출은 계획 문서이며 코드·사용자 설정·실패 증거를 변경하지 않는다. 병합 여부와 제품 계약 충족 여부는 구분한다.

| ID | 최종 결정 / 출처 | 상태·대체 |
|---|---|---|
| D26 | “결국 sdk를 통한 제어로 합의하지 않았나?” — 네이티브 전역 설정을 읽고 SDK로 Orca 실행에만 격리 제어할 수 있을 때 토글 제공 | ACTIVE; D25의 별도 전역 선택 영속화 해석 철회 |
| D27 | 현재 작업경로가 같으면 공유하고 다르면 격리. SDK 저장 허용도 이 범위를 넓히는 허용이 아님 | ACTIVE; D16·D21 검증 구체화. Git root를 제품의 cwd로 재정의하지 않음 |
| D28 | 전역 변경 비소급은 기존 Query뿐 아니라 같은 cwd에 합류하는 새 세션·reload·배포 MCP에도 적용 | ACTIVE; D15의 자원 범위 명확화 |
| D29 | ‘기본 에이전트’ 항목 제거. 로딩 중 ‘에이전트’ 그룹 타이틀 우측에 회전 스피너 표시 | ACTIVE; D12 일부 대체. [0281 ΔV1](../0281-opencode-menu-cache/plan.md) 정본 |
| U6 | OpenCode 프로젝트 선택의 저장 위치·형식. 당시에는 국소 설정 대안 조사 단계 | SUPERSEDED → ΔV2 D30에서 네이티브 파일 채택·외부 공유 명시 승인 |

D29의 예외 외에 팝업의 안내·오류 문구·새로고침 항목 금지와 성공 목록 캐시를 유지한다. OpenCode 프로젝트 파일 쓰기 금지(D7)는 후속 ΔV2 D30으로 대체됐다. 저장 경로 질문을 nav 범위·세션 단위·SDK 지원 여부의 재승인 질문으로 확대하지 않는다.

## 14. 저장 계약 — 합의와 현재 구현을 구분

| 범위 | 합의된 보관·실행 경계 | 현재 사실 / 처분 |
|---|---|---|
| 네이티브 전역 기준값 | 하네스 원본에서 읽음. Orca 기본값 사본을 만들지 않음 | 전역 조작으로 외부 하네스 설정 파일을 바꾸지 않음 |
| Orca의 전역 조작 | SDK의 격리 제어 가능성이 조건. 새 전역 영속 저장소 승인 없음 | `nativeExtensionChoices` 영속화는 합의로 승격하지 않고 수정 대상으로 남김 |
| Claude 프로젝트 plugin | `<cwd>/.claude/settings.local.json`의 `enabledPlugins` 원래 식별자 | 허용 키만 병합, 다른 plugin·permissions·hooks·env·model 보존. Windows 실제 cwd와 SDK 일치 확인 |
| Claude 프로젝트 MCP | SDK 네이티브 상태 저장 허용. 승인/거부 키와 실제 연결 on/off는 구분 | 기본 `~/.claude.json`, 별도 config root가 있으면 그 위치. 저장이 다른 cwd에 전파되면 F1 실패 |
| OpenCode 프로젝트 선택 | D30: 해당 cwd의 네이티브 프로젝트 파일. 외부 CLI·Desktop과 공유 | MCP·plugin 키만 제한 편집. `projectMcpChoices`는 현 구현 이력이며 목표 저장소가 아님 |
| 기존 Orca 스킬·MCP 설정 | 기존 기능의 저장과 새 네이티브 선택 저장을 구분 | 이 문서 정정으로 기존 데이터를 삭제하거나 일괄 이관하지 않음 |

현재 구현의 실제 저장 파일은 `<userData>/orcinus-orca-settings.json`이다. Windows 설치본은 통상 `%APPDATA%/orcinus-orca/`, 개발 모드는 별도 userData를 사용한다. 앞서 제안된 `~/.config/orcinus-orca/orcinus-orca.json`은 환경 설정 소스이며 같은 파일이 아니다([영속성 정본](../../arch/backend/persistence.md)).

| 현재 필드 — 승인된 형식 아님 | 코드가 저장하는 형상 | 읽기·쓰기 책임 |
|---|---|---|
| `nativeExtensionChoices` | backend → `kind:원래 이름` → boolean. 예: `claude / plugin:superpowers@marketplace / false` | `extension-catalog.ts` → SettingsStore; adapter ExtensionControl |
| `projectMcpChoices` | 정규화 cwd → OpenCode MCP 원래 id → boolean | `extension-control.ts` → SettingsStore; OpenCodeMcpControl |
| `skillEnabled` | 기존 스킬 식별자 → boolean | 기존 skills 설정 경로. 새 native 선택 저장 승인과 혼동 금지 |

현 구현은 resolve 후 슬래시 통일·Windows 소문자화를 하며 Git root로 올리지 않는다. `true`와 `false`는 명시 선택이고 키 부재는 native/시작 기준을 상속하며, `false`를 부재로 취급하지 않는다. 형제 경로·하네스·항목·비대상 설정은 보존해야 하나, 이 형상 검사 통과만으로 저장 정책이 승인되지는 않는다.

### 작업폴더 네이티브 파일 — ΔV2 D30으로 채택

OpenCode v1.17.19는 `opencode.json(c)` 및 `.opencode/opencode.json(c)`를 native 초기화에서 읽는다. 서버 하나·directory별 instance는 유지할 수 있지만 CLI/Desktop도 같은 파일을 읽고 상위 경로 설정을 상속한다. 외부 CLI/Desktop 공유는 허용됐지만 서로 다른 중첩 cwd의 독립 제어가 자동 보장되지는 않는다. 이 차이는 §19의 필수 기술 검증이며 정책 재질문 사유가 아니다.

MCP `enabled` 설정과 범용 plugin on/off 지원은 별도로 검증한다. 이 버전의 `Config.update`는 directory의 `config.json`을 쓰고 HTTP handler는 instance 폐기를 표시하므로, 단순 메모리 patch나 기존 회수 정책을 따르는 API로 가정하지 않는다. 따라서 파일 선택·허용 키 patch와 실행 SDK 적용을 분리한다. 버전별 실제 파일 탐색·상속·폐기 효과를 확인하기 전 일반 update 호출로 대체하지 않는다.

근거: [v1.17.19 config](https://github.com/anomalyco/opencode/blob/v1.17.19/packages/opencode/src/config/config.ts), [paths](https://github.com/anomalyco/opencode/blob/v1.17.19/packages/opencode/src/config/paths.ts), [update handler](https://github.com/anomalyco/opencode/blob/v1.17.19/packages/opencode/src/server/routes/instance/httpapi/handlers/config.ts), [공식 MCP 설정](https://opencode.ai/docs/mcp-servers/). 로컬 `app/.temp/opencode`에서 `git show v1.17.19:<path>`로 대조했다.

## 15. 최종 인수 기준 — 변경·추가분

ΔV1은 V1 AC1–3·6·8–10을 유지하고 아래 기준으로 AC4·5·7을 구체화했다. 후속 ΔV2는 AC6의 외부 파일 격리 부분을 AC6N으로 대체한다. AC10의 팝업 표현만 D29를 따른다. 초기 §7의 AC 번호는 폐기된 초안이며 이 표와 혼합하지 않는다.

| ID / 대체 | 관측 기준 | 검증 경로·직접 결과 |
|---|---|---|
| AC4S / V1 AC4 대체 | native 전역 읽기·SDK 제어에 미승인 영속 저장을 추가하지 않음. Claude D20·D21 및 OpenCode D30의 프로젝트 네이티브 저장만 별도 허용 | catalog IPC→store/native 파일→SDK. 조회 전후 bytes와 실제 적용값; 현재 global 선택 저장은 미충족으로 기록 |
| AC5G / V1 AC5 구체화 | 시작한 A의 전역 기준은 모든 owner가 회수될 때까지 유지. 새 B·재생성 A는 그 시점 기준 적용 | nav 변경→실제 adapter/배포→A 기존·A 새 peer·B·A 재생성의 SDK 자원 목록 |
| AC7C / V1 AC7 구체화 | 같은 cwd 공유·다른 cwd 격리가 peer 전달, 파일 저장, watcher, 새 SDK 실행까지 성립 | A root/B child/C sibling/D 별도 repo + 같은 MCP 이름·서로 다른 선택. 파일·revision·실제 MCP 상태 대조 |
| AC11 / 추가 | Claude·OpenCode 외부 프로젝트 변경은 먼저 화면에 반영, 해당 cwd의 전체 실행이 유휴일 때 runtime 적용 | 파일 원자 rename→observer→UI→busy 승인/큐/background→idle→SDK. stale revision 폐기 |
| AC12 / 추가 | 사용자 합의·미채택 제안·구현 사실·검증 결과를 구분 | 본문 ledger↔저장 표↔AC↔INDEX. merge/CI 성공을 F1 해결 증거로 사용하지 않음 |

### G — 전역 변경 비소급 행렬

각 행을 Claude plugin·skill·Orca 배포 MCP 및 지원되는 OpenCode MCP에 적용한다. native flags만 고정한 테스트로 배포 파일의 불변을 대신 입증하지 않는다.

| 케이스 | 반드시 관측할 결과 |
|---|---|
| G1 A 생성→전역 on/off 변경→A 다음 턴 | A 실제 자원 구성 유지, 전역 변경으로 reload/dispose 호출 없음 |
| G2 A 유지→같은 cwd의 새 세션·cold resume·plugin reload | 기존 startup 기준 공유. 고정 배포 경로의 최신 파일을 재독해 소급되지 않음 |
| G3 A 유지→다른 cwd B 생성 | B 최신 기준 적용, A 구성·대화 지속 |
| G4 A 복수 owner 중 일부만 해제 | A snapshot 유지. 응답 완료·탭 전환만으로 새 기준을 잡지 않음 |
| G5 A 최종 owner 정상 회수→재생성 | 최신 기준으로 생성. OpenCode disposed 확인·남은 B 보존·최종 server 회수 |
| G6 acquire와 prepare 사이 전역 변경·늦은 callback | 해당 세대의 확정 기준 일관성. 새 세대 덮어쓰기 없음 |
| G7 프로그램 재시작 | 승인된 저장 원천으로 새 기준 구성. 미승인 JSON의 존재를 복원 계약으로 삼지 않음 |
| G8 프로젝트 명시 선택이 있는 A | 전역 변경이 프로젝트 선택을 덮지 않음. 프로젝트 변경은 별도의 유휴 적용 경로 |

### C — Claude 작업경로 격리 행렬

실제 SDK 저장 효과와 Orca reader/reconcile을 둘 다 관측한다. `shareNativeResource`의 peer 필터만 통과하거나 Git-root fallback만 제거한 결과는 완료 증거가 아니다.

| 케이스 | 반드시 관측할 결과 |
|---|---|
| C1 같은 cwd·다른 project_id·경로 표기 | 같은 프로젝트의 모든 peer가 선택 공유, Windows 경로 정규화 일관 |
| C2 A Git root→B child·C sibling·D 다른 repo | A on/off 후 B/C/D의 파일·희망 상태·실제 SDK 상태 유지 |
| C3 B를 A 변경 전부터 열어 둠 | A 파일 변경으로 B revision·SDK reconcile이 오염되지 않음; busy/idle 양쪽 확인 |
| C4 A 변경 후 B 최초 실행·resume·앱 재시작 | SDK 자체의 native 상태 읽기에서도 B 독립. reader만 고쳐 생기는 거짓 통과 금지 |
| C5 서로 같은 MCP id·반대 선택 | 양방향 on/off와 중첩 폴더 역순 시작에서 상태가 섞이지 않음 |
| C6 플러그인 및 비대상 파일 키 | 같은 cwd에만 plugin 공유. 형제 plugin·permissions·hooks·env·model sentinel 보존 |
| C7 저장/SDK 적용 중 실패·프로젝트 전환 | 부분 실패를 성공으로 표시하지 않고 다른 cwd 보존, 이전 generation 결과 폐기 |

F1의 SDK probe·반례는 [evidence](evidence/README.md)에 유지한다. SDK가 현재 cwd보다 넓게 영속화하는 문제를 해결하지 못하면 프로젝트 제어 가능으로 보고할 수 없다. 이를 이유로 제품의 프로젝트를 Git root로 바꾸거나 미승인 저장소를 추가하지 않는다.

## 16. Delta V와 기술 보완 범위

| Pair | 노드 / 상태 / requiredness | 기준·검증 경로 |
|---|---|---|
| DV1-P1 | R2↔AT2 NEW REQUIRED | AC4S·5G·7C·11·12. nav/패널→production SDK→실제 파일·새 실행→UI |
| DV1-P2 | SD2↔ST2 NEW REQUIRED | G1–G8. 실제 adapter owner→새 peer→reload/deployment→회수·재생성 |
| DV1-P3 | SD3↔ST3 NEW REQUIRED | C1–C7. SDK native persistence→reader/watcher→peer·cold start |
| DV1-P4 | AR3↔IT3 NEW REQUIRED | 전역/프로젝트 control→store·bootstrap sync→adapter. 저장 정책·cwd별 실제 인자 확인 |
| DV1-P5 | MD3↔UT3 NEW REQUIRED | 저장 shape·부재/false·경로 정규화·선택적 revision. OpenCode 저장 경로는 ΔV2-P3/P4로 대체; Claude·전역 경계는 유지 |
| V1 VP1·2·3·5·7 | INHERITED REGRESSION | 해당 AC4·5·7 증거는 위 pair로 보강. V1 저장 승인 주장은 DV1-P1/4로 대체 |
| V1 VP4·6 | INHERITED REGRESSION | native global-only·capability·목록/부분 오류·지원하지 않는 제어 거부 |

직접 oracle 계획: `app/src/main/app/handlers/extension-catalog.test.ts`의 실제 등록 handler/SettingsStore에서 미승인 저장과 외부 파일 sentinel을 관측한다. `adapter.native-plugins.test.ts`는 실제 배포 파일을 SDK fixture가 읽도록 G1–G8을 추가하고, `project-resource-sync.test.ts`는 C2–C4 및 전체 프로젝트 유휴를 다룬다. 기존 `evidence/native-isolation.test.ts`의 child cwd 반례와 `claude-cwd-probe.mjs`의 실제 SDK 결과는 반드시 재실행한다.

### §10 추가 조사·강제 경계

| 자리 | 실제 진입→관측 | 실패 의미 |
|---|---|---|
| `protocol.ts` SettingsSchema/SettingsPatchSchema → `SettingsStore.load/patch` | 저장된 실제 JSON·다른 설정 보존 | 형상 유효와 정책 승인을 혼동 |
| `extension-catalog.ts` read/set → `extension-control.ts` global/projectMcp/setProjectMcp | native 읽기·전역 SDK 전달·프로젝트 id | 미승인 global 영속화 또는 다른 cwd write |
| `ClaudeAdapter.sendMessage/openChannel` snapshot 획득·Query 조립·owner 해제 | G1–G7 실제 SDK flags/skills/MCP | 같은 cwd 새 Query가 최신 global 파일을 읽음 |
| `handlers/mcp.ts` → `ExtensionDeploymentService` → `renderClaudeHarnessPlugin` | mutable 배포 .mcp.json을 SDK fixture가 재독 | 메모리 snapshot만 통과하고 배포 MCP 소급 |
| `claude/native-resources.ts` SDK toggle/plugin reload → native 파일 | C2·C4 실제 새 SDK 시작 | SDK가 Git-root 범위로 저장 |
| `project-settings.ts` → `ClaudeProjectReconciliation` → `ProjectResourceSync` | C3·C5 watcher·idle·실제 peer 호출 | root entry 병합으로 child 재적용 |
| `bootstrap.ts` onPatch/observer 조립 → session resources IPC → panel | AC11 UI 먼저·whole-cwd idle·revision fence | 전역 변경을 프로젝트 변경으로 오인 |
| `OpenCodeMcpControl` → context prepare/release → SDK directory | G3–G6·C5 상당 OpenCode 격리 | 다른 directory 연결 제어·회수 |

자리 검색은 `rg -n 'nativeExtensionChoices|projectMcpChoices|extensionSnapshots|toggleMcpServer|readClaudeProjectSettings|deployExtensions|renderClaudeHarnessPlugin|settings.onPatch' app/src/main app/src/shared` 및 각 심볼의 호출부를 포함한다. 이 표는 확인한 경계를 고정하지만, F1 해결 경로·저장 방식 정정의 최종 운반 자리와 테스트 좌표는 아직 미잠금이다. 따라서 이번 ΔV1은 정책·인수 기준 정정까지이며 구현 READY/PASS로 표시하지 않는다.

| 축 | AS-IS | TO-BE / 후속 책임 |
|---|---|---|
| 저장 | 전역 선택과 OpenCode cwd 선택이 SettingsStore에 영속화 | 전역 영속화는 D26에 맞춰 정정. OpenCode 프로젝트 선택은 D30 네이티브 파일로 전환하며 자동 일괄 이관은 하지 않음 |
| Claude 격리 | peer key는 cwd지만 SDK 저장·reader는 Git root 영향 | C1–C7을 만족하는 SDK 경계 확인; 미지원 제어를 지원으로 표시하지 않음 |
| 전역 비소급 | flags/skills snapshot, 배포 MCP는 고정 경로 갱신 | G1–G8을 모두 입증하는 인스턴스 기준 구성·배포 수명 설계 |
| 관측·팝업 | 분산된 이전 색상·scope·spinner 문구 | 0277 scope 정정·0281 D5/D6만 현재 계약 |
| 오류·정리 | 기존 generation/idle·회수 정책 | 유지. UI 관측 때문에 spawn·dispose·자동 메시지 재전송 금지 |

## 17. 전체 요구사항 연결표

| 합의·요청 | 정본 및 현재 판정 |
|---|---|
| Superpowers 폴더 열기·원문 식별자·작성 slug 보호 | [0271](../0271-native-skill-target/plan.md) AC1–4. 색상만 본 D11·D24로 대체 |
| 엔진 추가·Composer 그룹의 컬러 로고, 이전 유사 요청 확인 | [0272](../0272-composer-plugin-brands/plan.md) AC1·5·7 |
| Claude/OpenCode 스킬 /·플러그인 @ 선택·하이라이트 | 0272 AC2–4 |
| timeout·재시도·이벤트 스트림 오류 | [0273](../0273-opencode-command-stream-errors/plan.md); 자동 재전송 금지 |
| Desktop 부팅·첫 세션·다중 경로 지연/비동기 비용 | [0274](../0274-opencode-desktop-startup/plan.md), [0275](../0275-opencode-shared-instances/plan.md). 참조 버전 1.17.19 |
| 서버 공유·directory/module import 재사용·마지막 회수 | 0275. 호환 profile에만 서버 공유, 폴더별 plugin setup/MCP 비용까지 사라진다고 주장하지 않음 |
| /agent 최소 완료·provider 독립·준비 재사용 | [0276](../0276-opencode-composer-preparation/plan.md). native bootstrap 의존성은 우회하지 않음 |
| MCP R1–R11 및 nav 전역/패널 cwd 구분 | [0277](../0277-opencode-mcp-catalog/plan.md). 선택 UI 제안 철회, 기존 정상 항목·동적 MCP·stale 격리 유지 |
| native 기준·SDK capability·회색/고정·프로젝트 제어 | 본 D10·11·15–17·22–28, AC1–3·4S·5G·6·7C |
| OpenCode 네이티브 프로젝트 파일·CLI/Desktop 공유·제한 편집 | 본 D30·§19, AC6N·13N·14K·15O·16F. U6 종료, 기술 검증 대기 |
| Claude 제한 파일 편집·SDK native 저장·외부 동기화 | [0279](../0279-claude-project-plugin-state/plan.md). F1 실패는 미해결 |
| 첫 메시지 전 우측 상태·catalog 실패/취소 | [0280](../0280-opencode-prepared-status/plan.md). 기존 준비 instance만 관측 |
| 팝업 새로고침 제거·성공 캐시·기본 에이전트 제거·제목 스피너 | [0281 ΔV1](../0281-opencode-menu-cache/plan.md). 새 표현은 구현 전 |
| CI 보완·독립 검증 | V1 r1.2 구현 보고·verify. CI 성공을 정책 PASS로 확대하지 않음 |

## 18. 정합성·운영 gate

ACTIVE 결정↔AC: D1·15·28→AC5G, D5·10·11·24·26→AC1–4S, D7→AC6·10, D9·23→AC8·9, D16·20·21·27→AC7C·11, D17→AC10, D22→AC4S, D29→0281 AC4–6, D19·U6의 저장 위치 제안은 D30→AC6N·13N·14K로 대체됐다. U4는 미요청 reset UI, U5는 해결된 유휴 적용이며 U6는 종료됐다. V1 D25·AC4의 저장 해석은 현 정책과 충돌하므로 승계하지 않는다.

문서 gate는 변경 상대 링크·문서 inventory/prose·diff·INDEX·trailer다. 후속 구현은 subtree lint/typecheck·관련 Vitest와 C/G 직접 oracle을 수행하고 실제 SDK 버전·fixture 환경을 함께 보고한다. 기존 FAIL 보고·r1 자기보고는 과거 증거로 보존하며 이번 문서 수정으로 PASS 처리하지 않는다.


### ΔV1 문서 정정의 확인 결과 (087543ed)

변경 문서 10개·상대 링크 262개를 직접 검사해 깨진 링크 0건, 저장소 소유 문서 링크 0건을 확인했다. inventory 생성물·현재 문서 수치 검사는 통과했고 전체 링크 명령의 실패는 참조 checkout(.tmp/opencode-dev, app/.temp/opencode)의 기존 링크 10건으로 분리했다. git diff --check는 통과했으며 제품 코드·기존 verify 및 실패 재현 파일은 변경하지 않았다.

# ΔV2 — OpenCode 네이티브 프로젝트 설정 채택

## 19. 확정 정책과 저장·적용 계약

기준은 `087543ed`의 V1+ΔV1이다. 이번 변경은 OpenCode 프로젝트 저장 위치·공유 범위를 확정하며, 전역 격리 제어·프로젝트 유휴 적용·cwd 격리·비소급은 유지한다. 사용자 원문:

> OpenCode도 프로젝트 설정은 네이티브 파일을 사용하라. 외부 CLI·Desktop과 공유해도 된다. MCP·플러그인 관련 키만 편집하고, 기존 유휴 적용·작업경로 격리·전역 변경 비소급 정책을 유지하도록 plan.md를 갱신하라.

| ID | 결정 | 상태·대체 |
|---|---|---|
| D30 | OpenCode 프로젝트 선택은 네이티브 파일에 저장하고 외부 CLI/Desktop과 공유. MCP·plugin 관련 키만 편집 | ACTIVE; D7의 OpenCode 파일 금지·D19의 Orca JSON 위치·U6 대체. D15·16·21·27·28 유지 |

### 파일과 허용 편집

| 경계 | 규칙 |
|---|---|
| 읽기 | 실행 버전의 네이티브 우선순위에 따라 `opencode.json`/`opencode.jsonc`와 `.opencode/opencode.json`/`.opencode/opencode.jsonc`를 읽고, 원본 파일·항목·상속 출처를 main에서 추적 |
| 쓰기 | 실제 cwd 바로 아래의 네이티브 파일만 대상. 기존 유효 파일을 우선 사용하고 없으면 `<cwd>/opencode.jsonc`에 최소 patch 생성. 여러 파일은 네이티브 우선순위와 대상 키의 효력으로 선택하며 무조건 첫 파일을 고르지 않음 |
| 상위/전역 | Git root·상위 cwd·사용자 전역 파일로 쓰기 대상을 올리지 않음. 읽기 상속과 쓰기 권한을 구별하며 심볼릭 링크/junction의 실제 쓰기 대상도 확인 |
| MCP on/off | `mcp[원래 이름].enabled`만 수정. 상속 항목은 해당 cwd에 이 값만 명시하고 command/url/env/header/token 등 정의를 복제하지 않음. 동적 MCP도 이 patch의 효력을 실제 native config hook 이후 입증해야 지원 |
| plugin | 네이티브 `plugin`의 대상 선언만 제한 편집. 다른 항목·tuple options·상대 경로 기준을 보존. 일반 `disabled` 키를 창작하거나 `plugin: []`로 상속/자동 탐색 plugin이 꺼진다고 가정하지 않음 |
| 비대상 보존 | model/provider/permission/instructions/agent/skills/mcp의 비대상 서버 및 다른 키·JSONC 주석을 유지. 전체 SDK config 응답을 파일에 덮어쓰거나 별도 plugin 자체 설정·패키지·스크립트를 수정하지 않음 |
| 저장 정본 | 프로젝트 파일이 희망 구성의 정본. `projectMcpChoices`/새 `projectExtensions`/DB를 이중 정본으로 사용하지 않음. 기존 Orca JSON을 자동으로 native 파일에 이관·우선 적용·일괄 삭제하지 않으며 다른 설정은 보존 |
| SDK와 상태 | SDK는 실제 실행 상태 조회와 지원되는 변경에 사용. 저장 완료와 연결·로드 완료를 구분하고 native 초기화 순서를 유지. 파일 허용은 SDK 미지원 항목의 on/off 지원을 뜻하지 않음 |

전역 SDK 조작의 Orca 격리 조건은 그대로다. 이번 허용을 네이티브 전역 파일 편집이나 전역 선택 JSON 영속화의 승인으로 확대하지 않는다. 우측 패널은 실제 제어가 가능한 항목에만 토글을 제공하고 미지원 항목은 관측만 한다.

### 동기화·수명·실패

1. 패널 명령은 실제 cwd·항목·capability를 확인하고 파일을 제한 편집한다. 외부 편집·생성·삭제·원자 rename도 같은 reader로 읽어 희망 구성 revision과 화면을 갱신한다. 외부 편집 감지 자체가 파일 재쓰기나 서버 시작을 유발하지 않는다.
2. 실행 적용은 같은 cwd의 모든 세션·준비 owner·큐·승인 대기·background 제출을 기존 유휴 판정에 포함한 뒤 수행한다. busy 동안 기존 실행 구성과 성공한 catalog를 유지하며, 늦은 revision/generation의 결과는 폐기한다.
3. SDK의 안전한 live 적용이 입증된 변경만 전체 cwd 유휴 시 반영한다. 재초기화가 필요한 plugin/config 변경은 pending으로 두고 기존 자원 회수 정책에 따른 directory 해제·재생성 때 적용한다. 응답 완료만으로 회수하거나 즉시 `Config.update`/dispose/서버 재시작하지 않는다.
4. 새 directory는 최신 프로젝트 파일과 해당 시작 시점의 전역 기준을 native bootstrap에서 읽는다. 기존 directory에 합류하는 새 세션·reload는 기존 전역 snapshot을 유지하며 프로젝트 차이만 적용한다. 호환 서버 공유·global SSE·agent/provider 독립 준비·마지막 instance/server 회수는 0275·0276을 유지한다.
5. 저장 전에는 최신 파일을 다시 읽고 대상 항목만 patch하며, 감지한 외부 변경과 충돌하면 재독·재검증한다. parse/쓰기/동시 편집 충돌 실패 때 원본과 기존 runtime을 유지하며 실패를 성공으로 표시하지 않는다.
6. 파일 저장 뒤 SDK 적용이 실패하면 native 파일의 희망 구성은 유지하고 실제 상태는 실패/미적용으로 보고한다. 외부 편집을 되돌리는 보상 쓰기는 하지 않는다. 재시도는 최신 revision·유휴 조건에서만 진행하며, 적용 전 앱 종료 시 다음 native 시작이 파일에서 재구성한다.

화면의 설정 on/off와 마지막 실제 연결 상태를 구분한다. 패널의 기존 오류·재시도 표면을 사용하며 composer에 안내·새로고침을 추가하지 않는다. 파일 revision 변경만으로 composer의 성공 캐시를 지우지 않고 실제 적용/instance 세대 변경을 기준으로 0276·0281의 캐시 규칙을 따른다.

### 기술 검증이 남은 경계 — 사용자 결정과 구별

| 경계 | 잠가야 할 사실·실패 판정 |
|---|---|
| 중첩 cwd | A 루트 설정은 native 탐색상 B 하위 cwd가 상속할 수 있음. A 변경 전 열린 B와 변경 후 처음 여는 B 모두 다른 작업경로 격리를 검증. B 파일에 몰래 역보정하거나 cwd를 Git root로 통합해 해결한 것으로 보지 않음 |
| 범위별 capability | 일반 파일 쓰기만으로 중첩 경로 격리가 보장되지 않음. 실제 native 메커니즘으로 보장하지 못하는 항목/범위는 제어 지원으로 판정하지 않음. 모니터링을 완료 범위에서 제외하던 해석은 후속 D32로 대체 |
| plugin 끄기/복원 | 프로젝트 선언 제거와 global·자동 탐색 plugin 비활성화는 다름. off 후 앱 재시작·on 복원까지 native 표현으로 가능한지 확인하며, 비공식 저장소에 제거한 선언을 숨겨 보관하지 않음 |
| MCP 적용 | 파일 편집 자체에 대한 native watcher의 재로드/폐기와 기존 instance의 SDK connect/disconnect·config hook 동적 MCP 효과를 실제 실행에서 확인. native가 캐시한 disabled 설정 때문에 hot enable이 안 되면 정상 회수 후 적용 |
| 우선순위/세대 | OPENCODE_CONFIG_CONTENT·custom config·plugin hook이 프로젝트 값을 덮는 경우 거짓 성공 금지. 전역 변경과 프로젝트 변경을 동시에 감지해도 최신 global이 기존 instance의 project 변경 적용에 섞여 소급되지 않아야 함 |

외부 CLI/Desktop 자체의 watcher·재로드 시점은 Orca가 제어하지 않는다. 공유된 파일을 읽은 새 외부 실행의 결과가 일치하는지 검증하며, Orca의 유휴·회수 보장은 Orca가 관리하는 인스턴스에 적용한다. 위 기술 경계와 기존 Claude F1을 해결하기 전 보드는 DRAFT를 유지한다.

## 20. ΔV2 인수·회귀 기준

| AC / 대체 | 관측 결과 | 직접 검증 |
|---|---|---|
| AC6N / V1 AC6 대체 | OpenCode 프로젝트 선택은 native 파일로 CLI/Desktop과 공유. 같은 cwd 공유·다른 cwd 격리·busy 적용 보류 유지 | A/B 동일 MCP 이름·반대값, Orca 파일 쓰기→독립 CLI/native bootstrap→실제 상태. V1의 외부 프로젝트 파일 불변 단언만 폐기 |
| AC13N / 추가 | 앱 재시작 후 native 파일에서 선택 복원. 별도 Orca JSON 선택이 native 값을 덮지 않음 | native/기존 projectMcpChoices 상충 fixture→조회·재시작·SDK 결과, store 무기록 확인 |
| AC14K / 추가 | MCP/plugin 대상 키와 해당 cwd 파일만 편집. native 우선순위·JSONC·비대상 내용 보존 | json/jsonc/.opencode 복수 파일·상대 plugin·주석·비밀 sentinel·부재/false·malformed 입력→실제 파일 diff·실행값 |
| AC15O / 추가 | 외부 편집은 UI 즉시, runtime은 전체 cwd 유휴 또는 정상 회수 후 반영. 전역 변경 비소급 | A busy/B idle·A 새 peer·큐/승인·원자 rename·새 전역값 동시 입력→SDK 호출 시점·실제 상태·G1–G8 |
| AC16F / 추가 | 저장/적용 부분 실패·전환·이전 세대 응답이 원본 또는 다른 cwd를 훼손하지 않음 | write 실패·저장 후 SDK 실패·외부 재편집·A→B·process exit→파일과 UI/runtime 상태 |

**O — OpenCode 작업경로 검증:** O1 같은 cwd/다른 project_id/Windows 경로 표기 공유; O2 A root/B child/C sibling/D 별도 repo; O3 A 변경 전부터 열린 B; O4 A 변경 후 B 최초 실행·resume·앱 재시작; O5 동일 MCP id·반대 선택·역순 시작; O6 MCP/plugin 비대상 키·상속·inline override·자동 탐색; O7 저장/SDK 실패·지각 응답이다. O2–O4는 상위 파일 상속을 실제 native 실행으로 검사하고, Orca peer 필터 테스트만으로 대체하지 않는다.

G1–G8과 Claude C1–C7은 그대로 회귀 대상이다. 전역 변경 입력은 지원되는 nav 제어와 네이티브 전역 파일의 외부 편집을 구분해 검증한다. global 파일·B/C/D 파일의 불변 단언은 유지하며, 외부 CLI/Desktop에서 변경된 A 프로젝트 설정을 읽는 결과만 새 허용으로 전환한다.

## 21. ΔV2 설계·증거 연결과 §10

| Pair | 노드 / 상태 / requiredness | 경로·예정 직접 oracle |
|---|---|---|
| DV2-P1 | R3↔AT3 NEW REQUIRED | AC6N·13N·14K·15O·16F. 실제 패널/IPC→native 파일→독립 실행→상태; 새 `evidence/opencode-project-config-probe.mjs`에 O1–O7과 외부 CLI 왕복 fixture |
| DV2-P2 | SD4↔ST4 NEW REQUIRED | native 파일/observer→ProjectResourceSync→directory SDK→회수·재생성. `project-resource-sync.test.ts`에 busy A/idle B·상충 global revision·queue/approval 사례, `session-context.test.ts`에 O3–O5·G1–G8 |
| DV2-P3 | AR4↔IT4 NEW REQUIRED | 실제 등록 mutation→제한 writer→파일 관측→project policy→runtime·panel. `adapter.test.ts`/`configured-resources.test.ts`와 신규 `project-settings.integration.test.ts`에서 실제 임시 파일·transport·서버 PID/owner 유지 단언 |
| DV2-P4 | MD4↔UT4 NEW REQUIRED | 파일 선택·JSONC patch·revision·경로 검증. 신규 `adapters/opencode/v1/project-settings.test.ts`에서 복수 파일·상속·false·malformed·외부 재편집·쓰기 실패의 bytes와 재독 결과 |
| DV1-P1/4/5 중 OpenCode 저장, V1 VP3/5의 AC4/6 | SUPERSEDED 부분만 DV2-P1/3/4로 이관 | Orca JSON 영속화/외부 프로젝트 파일 불변 oracle은 native 파일 효과·허용 키 보존으로 교체. global/Claude 증거는 유지 |
| DV1-P2/3, V1 VP1/2/4/6/7 | INHERITED REGRESSION | G/C 전수·global capability·비소급·0275 회수·0277 R1–R11 관측·0276 독립 목록·0281 캐시/제목 스피너 |

현재 쓰기 경로는 `OpenCodeMcpControl.set→ExtensionControl.setProjectMcp→SettingsStore`이며, OpenCode policy의 `files: () => []`는 native 프로젝트 편집을 관측하지 않는다. 목표는 adapter의 순수 JSONC patch/파일 선택과 파일 I/O를 분리하고, 공통 project policy를 통해 app의 기존 ProjectResourceSync로 연결하는 것이다. feature 간 직접 import·renderer 파일 쓰기를 추가하지 않는다.

| 강제 경계 | 현재/목표 자리와 관측 | 실패 의미 |
|---|---|---|
| 저장 명령 | `session-resources` mutation→`OpenCodeMcpControl.set`→신규 project writer. 실제 cwd·원래 id·capability·최신 bytes 전달 | wrong-cwd/global 쓰기·미지원 off를 성공 처리 |
| 파일 정책 | `configured-resources.ts`·신규 `project-settings.ts`의 source/patch/read/files | 상속 원본을 수정하거나 merged config 전체 저장 |
| 조립·알림 | `ProjectResourcePolicy`→`project-resource-sync.ts`→bootstrap→동일 cwd peer·panel | watcher 누락/전역 변경을 project revision으로 처리 |
| 실행 | `mcp-control.ts` prepare/reconcile→SDK directory 및 `session-context.ts` owner lifecycle | busy 적용·다른 directory 변경·회수 전 dispose |
| 기존 저장 의존 | `extension-control.ts`·SettingsSchema·bootstrap의 `projectMcpChoices` 알림/reader | native/legacy 이중 정본·기존 unrelated 설정 삭제 |
| 소비 | native resource DTO→panel, composer catalog generation/cache | 희망값을 connected로 표시·실제 변경 전 cache 파기 |
| 문서 상태 | 본 D30·저장 표·AC·관련 0277/0279·INDEX | U6 재질문·외부 공유 금지의 잔존·코드 미구현을 완료 처리 |

자리 재열거 명령: `rg -n 'projectMcpChoices|setProjectMcp|projectMcp\(|ProjectResourcePolicy|reconcileProjectResources|OpenCodeMcpControl|configuredOpenCode|settings.onPatch' app/src/main app/src/shared`. 위 표는 현재 확인한 경계와 예정 경로이며, 변경 후 호출부 전수·새 writer/read/observer 자리별 테스트명은 READY 전에 잠근다. 양 끝을 mock한 unit test로 파일→native 실행·유휴/세대 통합 증거를 대체하지 않는다.

### 정합성·운영 gate

D30→AC6N·13N·14K, D15·21·28→AC15O·G1–G8, D16·27→AC6N·O1–O7, 실패 계약→AC16F로 연결한다. D7의 수명 조건·D20/21 Claude 저장·D26 전역 SDK 제어·D29 팝업 표현은 유지하며 D19/U6의 OpenCode Orca JSON 제안만 대체한다. 제품 결정은 확정됐고 남은 것은 격리·네이티브 효력·최종 강제 지점의 기술 검증이다.

이번 문서 변경은 diff·링크·inventory/prose·보드·trailer로 검사한다. 구현 단계는 subtree gate와 위 native 파일/실행 검증을 수행해야 하며, 기존 verify FAIL과 V1 구현 보고는 아래에 그대로 보존한다.

ΔV2 문서 검사: 변경 문서 5개·상대 링크 260개와 저장소 소유 문서 링크에서 파손 0건을 확인했다. inventory/prose·diff 검사 통과; 전체 링크 명령은 무시된 외부 참조 checkout의 기존 파손 10건으로 실패했으며 이번 변경과 분리했다. D1–D30·G/C/O·R1–R11 및 U6 종료를 대조했고, 제품 코드·verify·evidence와 V1 구현 보고가 변경되지 않았음을 확인했다.

## 22. ΔV3 — 동시 네이티브 설정 편집의 대기·저장 계약

사용자 추가 요구:

> settings.local.json 등의 파일편집요청이 비동기로 동시에 요청이 올 수 있다. 이때 파일오픈 실패를 예외 토스트로 반환하는 형태로 구현한 것 같은데, 해당부분을 임계영역으로 지정해놓거 대기하는 형태로 구현하거나 가상파일(메모리)에만 적용하고 이후에 flush하는 형태로 구현하라.
>
> 해당 요구도 plan에 모두 반영해야 한다.

| ID | 결정·출처 | 상태 |
|---|---|---|
| D31 | 같은 설정 파일의 동시 변경은 임계영역에서 비동기로 기다려 처리. 정상 경합·회복 가능한 일시 잠금을 즉시 예외 토스트로 반환하지 않음 — 위 추가 요구 | ACTIVE. D20·21·30 저장 경로와 D15·16·28의 범위/적용 시점 유지 |

**채택 설계:** 파일별 비동기 대기열 안에서 최신 파일 읽기→허용 키 병합→원자적 저장을 완료한다. 같은 파일은 대기열 등록 순서로 처리하고 다른 파일은 독립 실행한다. 메모리는 대기 중인 변경 요청만 보관하며, 메모리 반영을 디스크 저장 성공으로 응답하는 write-behind 방식은 사용하지 않는다. 사용자 제시 대안 중 대기형을 선택한 구현 설계이며 별도 저장 형식·파일·전역 선택 저장을 승인한 것으로 해석하지 않는다.

### 사용자에게 보이는 동작

| 상황 | 결과 |
|---|---|
| 같은 파일에 MCP/plugin 변경 요청이 겹침 | 선행 저장 완료를 비동기로 기다린 뒤 최신 파일에 후속 변경 병합. 경합 자체로 오류·토스트를 만들지 않음 |
| 같은 키에 on→off가 연속 요청됨 | 등록된 요청을 순서대로 완료. 최종 파일은 마지막으로 성공한 요청의 값이며 요청을 몰래 병합·삭제하지 않음 |
| 다른 작업폴더의 별도 파일 수정 | A 파일 잠금 때문에 B 파일 저장이나 화면 이벤트 처리가 멈추지 않음 |
| 일시적인 파일 잠금 | 이벤트 루프를 막지 않는 제한된 재시도. 해제되면 같은 요청을 완료하며 사용자가 다시 누를 필요 없음 |
| 손상 JSON/JSONC·지속 권한 오류·저장 공간 부족 | 성공 처리하지 않음. 원본 유지·해당 요청 실패·대기열 해제 후 후속 요청을 처리. 기존 패널의 오류/재시도 경로 사용 |
| 외부 편집·저장 후 적용 대기 | 최신 파일과 확인된 runtime을 구분. 저장 경쟁을 해결했다고 busy 프로젝트에 SDK 변경을 즉시 적용하지 않음 |

Composer에는 추가 상태 문구·오류·새로고침·스피너를 만들지 않는다. D29의 에이전트 제목 우측 스피너 예외만 유지한다. 패널/IPC는 저장 Promise를 기다려야 하며, 대기 중인 요청을 별도 UI timeout으로 실패 처리한 뒤 백그라운드에서 성공시키는 경로를 만들지 않는다.

## 23. ΔV3 구현 설계와 사례 비교

### 현재 경로와 변경 범위

현재 `claude/plugin-state.ts`는 동기 read/merge/고유 임시 파일 rename을 사용한다. 같은 main 이벤트 루프의 동기 호출은 서로 끼어들지 않지만 파일 잠금 실패를 즉시 오류로 바꾸며, 외부 편집과 비동기 writer 추가에 대응하는 대기 계약은 없다. `session-resources.ts`의 프로젝트 mutation 직렬화는 runtime/cwd 단위여서 **실제 저장 파일이 같은 요청**의 임계영역을 대신하지 못한다.

| 대상 | 책임·변경 |
|---|---|
| 신규 `infra/config/file-mutation.ts` | 프로세스 내 공유 파일 대기열. canonical 파일 식별자·비동기 read/수정/commit·재시도·배수 책임. 특정 엔진/JSON 키를 알지 않음 |
| Claude `plugin-state.ts` | 허용된 `enabledPlugins` 항목만 patch하는 비동기 writer. 현재 호출부·callback을 `Promise<void>` 또는 저장 revision 반환형으로 전파 |
| Claude `native-resources.ts`·`adapter.ts` | persistence callback을 반드시 await. SDK 확인→저장→성공 경로에서 저장 실패를 누락하지 않으며 기존 SDK 복원 정책 유지. peer의 `persist=false` 경로는 같은 파일을 중복 저장하지 않음 |
| OpenCode 신규 `project-settings.ts`·`mcp-control.ts` | D30의 실제 파일 선택·JSONC 제한 patch를 같은 파일 대기열에서 수행. 파일 commit 뒤 revision 알림→기존 전체 cwd 유휴 적용 |
| Claude SDK 소유 MCP 저장 | Orca가 SDK 내부 파일 writer를 대체하지 않음. 범위가 검증된 SDK mutation 호출은 실제 native 저장 대상별 호출 대기열에 등록. SDK 내부 lock의 해제·손상 복구를 흉내 내지 않음 |
| app 조립·종료 | adapters와 종료 경로가 같은 coordinator를 사용. 정상 종료 시 신규 변경 접수를 닫고 이미 접수한 파일 변경을 drain. SDK 네트워크 대기를 파일 임계영역 안에 넣지 않음 |

기존 `infra/config/json-file.ts`의 모든 Orca 설정 쓰기를 이번 변경에서 일괄 교체하지 않는다. 이번 네이티브 확장 설정으로 이어지는 writer/callback/SDK mutation만 전수 연결한다. SDK native MCP 파일이 여러 cwd에서 공유된다고 호출 대기열을 cwd별로 쪼개지 않으며, 파일 직렬화가 F1의 **저장 의미상 범위 누출**을 해결한 것으로도 판정하지 않는다.

### 임계영역과 오류 처리

1. 대상은 adapter의 허용 파일 선택과 경로 검증을 거친 절대 경로다. 실제 파일 또는 가장 가까운 기존 부모의 realpath를 기준으로 식별하며 Windows 대소문자·경로 구분자 별칭을 합친다. 링크/부모가 바뀌면 commit 전에 경로 범위를 재검증한다. 존재하지 않는 파일 생성도 같은 식별자를 사용한다.
2. **read/parse/허용 키 patch/commit 전체**가 같은 파일의 임계영역이다. 호출 시점의 파일 사본이나 전체 설정 객체를 큐에 넣지 않는다. 대기열에는 대상 키·값 등 변경 의도만 전달하며 lock 획득 후 최신 파일을 읽는다.
3. 같은 디렉터리의 고유 임시 파일을 배타 생성하고 내용 쓰기→파일 sync→close→rename으로 교체한다. 기존 파일 모드를 보존하고 새 파일은 제한된 모드로 생성한다. 실패 시 원본을 먼저 삭제하거나 truncate하지 않는다. JSONC 주석·비대상 키·비밀 sentinel 보존은 AC14K를 따른다.
4. 원본의 bytes/revision을 commit 직전에 재확인한다. 그 사이 외부 편집을 발견하면 임시 산출을 버리고 최신 원본에 **같은 허용 키 변경만** 다시 계산한다. 재시도에서도 최초 사본 전체를 재사용하지 않는다. 파일 삭제·생성·원자 교체도 revision 변화로 취급한다.
5. `EBUSY` 및 Windows 공유 위반으로 나타날 수 있는 `EPERM`/`EACCES`는 비동기 backoff로 재시도한다. 작업의 최초 실제 I/O부터 재시도 예산 5초, 지연 50ms에서 시작해 800ms 상한으로 늘린다. 큐 대기 시간은 이 예산에 넣지 않는다. 영구 권한 오류는 예산 후 실패하며 syntax·`ENOSPC`·지원하지 않는 경로는 즉시 분류한다. `ENOENT`는 허용된 신규 파일과 사라진 부모/원본 충돌을 구별한다.
6. 예외가 나도 `finally`에서 handle·임시 파일·큐 소유권을 정리한다. 선행 Promise rejection이 다음 요청까지 전파되어 큐를 막지 않아야 한다. 완료한 빈 큐는 해제한다. 같은 임계영역에서 다시 같은 파일 큐를 기다리는 재진입은 금지한다.
7. 저장 결과는 실제 commit 이후에만 resolve한다. 자기 쓰기 watcher와 중복 알림은 revision으로 합치며, 오래 대기한 요청의 runtime 적용 직전에도 cwd·세대·전체 유휴 조건을 재검사한다. 저장 완료 뒤의 SDK 적용 실패는 저장 실패와 별개로 보고하고 외부 편집을 되돌리는 보상 쓰기는 하지 않는다.
8. 정상 종료의 drain은 파일 commit을 기다린다. 강제 종료·전원 손실까지 미완료 요청을 복구한다고 약속하지 않으며, 미완료 요청에 성공을 응답하지 않는다. rename 원자성/파일 sync는 지원 파일시스템 범위의 보장이고 모든 네트워크 파일시스템의 전원 장애 내구성과 같지 않다.

### 검토한 사례와 채택 경계

| 사례 | 이번 설계에 반영한 점 | 한계·채택 여부 |
|---|---|---|
| [npm write-file-atomic](https://github.com/npm/write-file-atomic#readme) | 같은 파일의 Promise 직렬화·다른 파일 병렬화·고유 임시 파일·sync 후 rename | 쓰기만 큐에 넣으면 lock 밖에서 읽은 사본의 lost update를 막지 못함. read/merge부터 임계영역에 포함. 패키지 신규 도입 결정은 아님 |
| [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile#readme) | 프로세스 간 협력 잠금, stale/해제/실패 후 복구를 별도 고려 | 같은 규약에 참여하지 않는 CLI/Desktop/편집기를 막지 못함. 이번에는 별도 `.lock` 파일이나 의존성을 추가하지 않음 |
| 메모리 변경 후 지연 flush | 빠른 입력을 저장 작업과 분리할 수 있음 | 공유 native 파일의 외부 편집·종료 시 미저장·거짓 성공 처리가 복잡해짐. 이 작업에서는 저장 완료를 기다리는 대기열을 채택 |

**보장 범위:** 같은 Orca main 안에서 이 coordinator를 거치는 요청의 lost update와 원본 부분 쓰기를 방지한다. 외부 프로그램과의 완전한 트랜잭션 격리는 공통 잠금 규약 없이 보장할 수 없다. 외부 변경은 optimistic revision 검사·재병합·저장 후 관측으로 대응하지만, 최종 검사와 rename 사이의 비협력 외부 쓰기까지 완전히 차단한다고 표현하지 않는다. SDK 내부 저장의 동시성도 설치 버전의 실제 동작으로 별도 검사하며 Orca writer 테스트 통과로 대체하지 않는다.

## 24. ΔV3 인수 기준과 V 연결

| AC | 관측 결과 / 프로덕션 도달 경로 | 직접 검증 |
|---|---|---|
| AC17W | 패널/IPC→동일 파일에 겹친 서로 다른 키 변경이 모두 남음. 같은 키는 등록 순서의 마지막 성공값. 정상 경합 오류 없음 | W1·W2·W3, 실제 임시 파일과 성공/실패 응답 대조 |
| AC18Q | A 파일이 잠겨도 B 파일과 이벤트 루프 진행. 일시 잠금 해제 후 A는 재입력 없이 성공. 실패한 작업 뒤에도 큐 사용 가능 | W4·W5·W6, 단계 barrier와 real I/O; Windows 별도 프로세스의 공유 금지 handle 재현 |
| AC19C | 외부 편집 탐지 시 최신 원본에 제한 patch. 손상·영구 오류는 원본을 훼손하지 않음. 저장 전 성공 응답 없음 | W7·W8·W9, bytes·비대상 sentinel·응답 시점·임시 파일 정리 |
| AC20L | 저장 대기·watcher·종료가 cwd 격리·유휴 적용·전역 비소급을 깨지 않음. 이미 접수한 파일 변경은 정상 종료에서 drain | W10·W11·W12와 C/G/O 회귀. 실제 저장 revision과 SDK 호출·종료 순서 |

W1 서로 다른 plugin/MCP 키의 동시 변경; W2 같은 키 on→off; W3 Windows 경로 별칭/부재 파일 동시 생성; W4 A 잠금 중 B 완료와 이벤트 루프 진행; W5 잠금 해제 후 원 요청 완료; W6 앞 요청 실패 뒤 다음 요청 성공; W7 대기·읽기 이후 외부의 다른 키 편집과 같은 키 충돌; W8 malformed·권한·디스크 오류; W9 rename 전 실패/저장 read-back/임시 파일 정리; W10 watcher 중복·프로젝트 busy 전환·지각 응답; W11 정상 종료 drain과 성공 응답 순서; W12 SDK 소유 파일에 겹친 호출 및 같은 cwd peer의 중복 저장 방지다. fixture는 실제 사용자 설정 대신 격리된 HOME/cwd를 쓴다.

| Pair | 노드 / requiredness | 생산 경로·직접 oracle 좌표(신설 또는 보강) |
|---|---|---|
| DV3-P1 | R4↔AT4 NEW REQUIRED | 패널 제어→등록 IPC→실제 writer→응답. `app/handlers/session-resources.test.ts: concurrent project edits wait for committed files`에 W1·2·5·9; 실제 등록 handler와 writer를 실행하고 native SDK만 fixture로 대체 |
| DV3-P2 | SD5↔ST5 NEW REQUIRED | 저장 대기→파일 revision→observer→유휴 reconcile/종료. `app/project-resource-sync.test.ts: queued writes preserve idle and generation guards`, 신규 `app/native-settings-lifecycle.test.ts: shutdown drains accepted file changes`에 W4·10·11 |
| DV3-P3 | AR5↔IT5 NEW REQUIRED | adapter callback→공유 coordinator→native 파일. `adapters/claude/native-resources.test.ts: persistence is awaited and peer updates do not rewrite`, `adapters/opencode/v1/project-settings.integration.test.ts: concurrent native patches preserve sibling keys`에 W1·3·6·7·12 |
| DV3-P4 | MD5↔UT5 NEW REQUIRED | canonical key→read/patch→retry/commit→release. 신규 `infra/config/file-mutation.test.ts`에 W2–9·11의 실제 임시 파일, controllable I/O seam·clock; 실패 phase별 bytes와 후속 요청 완료 단언 |
| DV2-P1/2/3/4, DV1-P2/3, V1 VP7 | INHERITED REGRESSION | AC6N·14K·15O·16F, C/G/O·Claude F1·유휴·비소급·네이티브 읽기/쓰기. ΔV3는 저장 의미나 capability를 대체하지 않음 |

예정 테스트 좌표는 구현 완료 증거가 아니다. 단위 테스트에서 파일 시스템 양 끝을 모두 mock하거나 queue 함수 호출 횟수만 확인해 위 인수 기준을 닫을 수 없다. Windows OS 잠금은 별도 임시 파일을 `FileShare.None`으로 연 자식 프로세스를 해제하여 재현하고 일시 `EPERM` 주입 시험과 구분한다.

## 25. ΔV3 §10 강제 지점과 완료 게이트

| 자리 | 강제 계약·oracle | 실패 의미 |
|---|---|---|
| WEP1 `session-resources.ts` mutation→adapter | DV3-P1: 동시 호출의 저장 완료/실패 결과까지 await | 저장 Promise를 놓쳐 성공 선응답·unhandled rejection |
| WEP2 `claude/adapter.ts` persistence callback | DV3-P3: 실제 writer로 Promise 전달 | void callback에 비동기 writer를 연결해 완료를 잃음 |
| WEP3 `claude/native-resources.ts` plugin set | DV3-P3: await persist 및 `persist=false` peer 무기록 | 파일 실패 은폐·같은 파일의 중복 peer 쓰기 |
| WEP4 `claude/plugin-state.ts` 파일 변경 | DV3-P3/4: 최신 파일→허용 key patch 전체를 coordinator 안에서 실행 | 큐 밖 read로 형제 키 유실 |
| WEP5 `opencode/v1/mcp-control.ts` set→project writer | DV3-P1/3: 저장 완료 revision 뒤 알림·유휴 적용 | 저장 전 적용·과거 사본/다른 경로 전달 |
| WEP6 신규 OpenCode `project-settings.ts` writer | DV3-P3/4: 실제 source 선택·JSONC 제한 patch를 같은 큐에서 실행 | 상위 파일 변경·주석/비대상 키 삭제·직렬화 우회 |
| WEP7 `claude/native-resources.ts` MCP SDK mutation | DV3-P3 및 격리 native probe: 실제 저장 대상 기준 호출 대기·scope guard | 다른 cwd가 같은 파일을 갱신할 때 경합, F1을 큐로 가림 |
| WEP8 신규 `infra/config/file-mutation.ts` | DV3-P4: canonical queue·read/patch/commit·재시도·release·drain | blocking sleep·stale 사본·원본 truncate·실패 뒤 교착 |
| WEP9 `project-resource-sync.ts` observer/reconcile | DV3-P2: revision 합치기·전체 idle·generation 재검사 | 자기 쓰기 루프·busy/이전 세대 적용 |
| WEP10 `bootstrap.ts`/실제 종료 조립 경로 | DV3-P2: 같은 coordinator 주입·신규 접수 차단→drain | 서로 다른 큐 생성·정상 종료 중 승인한 저장 유실 |

현재 자리 확인 명령: `rg -n 'persistClaudePluginState|persistPluginState|toggleMcpServer|setProjectMcp|setNativeResource|shareNativeResource|reconcileProjectResources|before-quit|will-quit' app/src/main --glob '!*.test.ts'`. 변경 후 추가되는 source 선택/파일 쓰기/종료 hook을 같은 경로에서 재열거해 위 목록과 대응시킨다. 기존 전체 handoff의 미잠금 경계를 이 표로 대체하지 않는다.

문서 gate는 D31→AC17W–20L→DV3-P1–4→WEP의 누락, D15·16·20·21·26·28·29·30과의 모순, 0279/INDEX 참조·상대 링크·diff·inventory/prose다. 구현 gate는 main subtree의 타입·lint·build와 위 UT/IT/ST/AT, 기존 C/G/O를 포함한다. 이번 추가 요구를 문서에 기록한 것과 전체 plan READY·구현 완료는 별개다. **기존 Claude F1 및 OpenCode 네이티브 효력·cwd 격리 검증을 닫기 전에는 READY로 올리지 않는다.**

ΔV3 문서 검사: 변경 문서 4개·상대 링크 258개와 저장소 소유 문서 링크에서 파손 0건. inventory/prose 및 `git diff --check` 통과. 전체 링크 명령의 실패는 무시된 외부 참조 checkout의 기존 파손 10건이며 이번 변경과 분리한다. 제품 코드·기존 verify·evidence·구현 보고는 변경하지 않았다.

## 26. ΔV4 — 엄격한 작업경로 격리와 미지원 항목의 모니터링

사용자는 native 저장의 상위 경로 상속과 충돌하는 범위를 설명받고 **“엄격한 작업경로 격리 유지, 불가능한 항목은 모니터링만”**으로 답했다. 이 답변은 D16의 범위를 Git root로 넓히거나 상속을 허용한 것이 아니다.

| ID | 결정·대체 관계 | 상태 |
|---|---|---|
| D32 | 엄격한 현재 cwd 격리 유지. SDK 실행과 native 저장의 전체 효과가 다른 cwd에 전파되지 않는다고 확인된 항목만 프로젝트 제어. 보장할 수 없는 항목은 실제 상태 모니터링만 제공 — 사용자 답변 | ACTIVE. D16 재확인. ΔV2의 ‘격리 불가 항목을 모니터링으로 제공해도 완료로 세지 않음’ 해석만 SUPERSEDED |

### 재현한 사실과 적용

| 확인 경계 | 이번 조사에서 관측한 결과 | 설계 적용 |
|---|---|---|
| 설치 Claude SDK 0.3.286 | 기존 `evidence/claude-cwd-probe.mjs` 재실행: A connected→SDK off→Git root에 disabled 저장→다른 cwd B의 최초 실행 disabled | 현재 native MCP toggle을 cwd 격리 가능으로 표시하지 않음. 조작 거부를 SDK 호출 **이전**에 강제 |
| 같은 SDK의 Windows local plugin | 로컬 plugin fixture로 A의 `settings.local.json`에 inline plugin off 저장: 새 A/reload A에서는 제거, 하위 B 최초 Query에서는 해당 plugin 유지 | MCP와 plugin의 capability를 분리. 검증한 현재 cwd local 파일·SDK flags/reload 경로는 지원 후보로 유지 |
| OpenCode 1.17.19 파일 변경 | 격리 HOME·로컬 MCP·로컬 plugin fixture에서 A 파일의 MCP false 변경 후 기존 A/B는 true 유지. 이후 처음 연 A 하위 C는 false 상속; 별도 repo D에는 A MCP가 없음 | A의 프로젝트 파일 저장도 미래의 다른 cwd에 영향. 해당 방식의 프로젝트 MCP 제어는 모니터링으로 제한 |
| OpenCode SDK MCP | 같은 서버의 A disconnect 뒤 A disabled/B connected. A connect는 복구되고 프로젝트 파일은 SDK 호출로 바뀌지 않음 | 실행 시점의 directory 격리만으로 native 영속 저장까지 지원한다고 판정하지 않음 |
| OpenCode plugin/config | A의 `plugin: []` 뒤 새 하위 C에도 전역 plugin agent가 남음. `PATCH /config`는 기존 opencode.jsonc를 보존하고 config.json을 생성 | 빈 배열을 plugin off로 쓰지 않음. safe native writer의 대체로 Config.update를 사용하지 않음 |

OpenCode 검증은 공식 npm Windows 실행 파일 1.17.19와 동일 버전 plugin 의존성을 격리 디렉터리에 미리 준비했다. LLM 요청·실사용자 파일 접근 없이 설정/agent/MCP API를 확인했다. 이 결과는 부팅 성능 측정이나 사용자 커스텀 바이너리 검증을 대신하지 않는다. 기존 Claude F1 증거는 실패 이력으로 보존하며, 수정 후에는 **불가 항목의 mutation이 막히는지** 검증한다.

### capability·저장·표시 계약

- 우측 패널은 격리 불가 항목의 토글을 제공하지 않는다. 숨긴 버튼만으로 끝내지 않고 실제 mutation/SDK 진입에서도 거부한다. 실제 on/off·연결·인증·실패 상태와 관측 기능은 유지한다.
- 네이티브 파일 사용(D20·21·30)은 **격리 가능한 제어의 저장 방식**이다. 파일 쓰기 권한이 있다는 이유로 capability를 true로 만들지 않는다. OpenCode의 현재 MCP 프로젝트 파일 writer·비활성 규약 없는 plugin writer를 기능 없는 보조 모듈로 먼저 만들지 않는다.
- D31의 파일 대기열은 현재 지원 가능한 Claude plugin writer와 이후 검증된 native writer에 적용한다. 호출이 차단된 SDK MCP와 OpenCode 파일 쓰기는 큐에 넣어 실행하지 않는다. ΔV3의 해당 writer/SDK 자리(WEP5·6·7)는 **안전한 거부와 무기록 검증**으로 대체하며, 범위 미지원도 오류를 숨긴 성공으로 반환하지 않는다.
- 지원되는 Claude plugin 제어도 실제 설치/SDK/OS·local 파일 범위에 따라 판정한다. 현재 cwd 밖에 설정을 저장하는 경로, 실제 설치를 식별할 수 없는 경우, SDK reload/setter가 없으면 모니터링만 제공한다. 다른 native MCP에 대한 제어권까지 plugin capability에서 추론하지 않는다.
- nav 전역은 기존 D10·11·26 그대로다. 외부 하네스 설정을 수정하지 않고 SDK로 Orca의 **새 인스턴스 기본값**에만 적용 가능한 항목은 일반 폰트·가변 토글, 불가 항목은 실제 상태·고정 토글·회색 폰트다. 프로젝트 제어 불가를 전역 제어 불가로 일괄 확장하지 않는다.
- 외부 파일을 읽어 발견한 native 상속 결과는 실제 관측 정보다. Orca가 다른 cwd에 보상 파일을 쓰거나 Git root를 프로젝트 공유 키로 바꾸지 않는다. 외부 편집의 UI 반영과 Orca runtime 유휴/정상 회수 적용은 유지하며, 지원하지 않는 SDK toggle을 자동 reconcile에서 우회 호출하지 않는다.

### ΔV4 인수·증거 이관

| Pair | 상태·기준 | 직접 oracle·이관 |
|---|---|---|
| DV4-P1 R5↔AT5 | NEW REQUIRED — AC21C | 우측 패널 실제 렌더→등록 IPC 직접 요청→adapter: 격리 불가 MCP/plugin은 관측되지만 토글 없음, 직접 호출은 거부. 같은 Git root A/B·별도 D의 파일 bytes·SDK 호출 무변경. `nativeResourceState.test.ts`·`session-resources.test.ts`에 unsafe resource fixture |
| DV4-P2 AR6↔IT6 | NEW REQUIRED — capability 값과 mutation 방어 | `claude/native-resources.test.ts`·`opencode/v1/adapter.test.ts`에서 실제 port를 호출해 SDK 미호출·파일 무기록 확인. `project-reconciliation.test.ts`에 읽기 전용 MCP 외부 변경→안전한 pending/restart 경로, 직접 toggle 없음 |
| DV4-P3 MD6↔UT6 | NEW REQUIRED — 지원 판정 | 실제 cwd·native 저장 대상·플랫폼·SDK 메서드·항목 출처를 구별하는 capability 테스트. 지원 plugin의 정상 reload/저장은 보존하고 격리 불가만 차단; 단순 backend 이름 일괄 false 금지 |
| DV2-P1/3/4, DV3-P1/3/4 일부 | SUPERSEDED 부분 → DV4-P1/2/3 | 격리 불가 OpenCode 항목의 ‘저장 성공/CLI 복원’ 및 Claude SDK MCP 쓰기 oracle을 ‘관측 성공/조작 거부/파일·다른 cwd 불변’으로 이관. 지원 native writer의 보존·동시성 oracle은 유지 |
| DV2-P2, DV3-P2, DV1-P2/3, V1 VP7 | INHERITED REGRESSION | 전체 cwd 유휴·정상 회수·G1–G8 비소급·목록/상태 동기화·지원 plugin 변경. C/O의 원인인 Orca 조작 경로를 실제 차단해야 하며 기존 실패 테스트를 무조건 skip하지 않음 |

AC21C는 항목별 capability에 맞는 **제어 또는 관측 제공**이다. 같은 파일 lock으로 저장 범위를 바꾼 것처럼 보이게 하거나, 성공 응답만 반환하는 무동작 제어는 실패다. 최신 원문·허용 키·전역 비소급을 보존한 채 위 oracle과 실제 강제 지점을 전체 §10에 합친 뒤 READY로 확정한다. 추가 사용자 결정은 없다; 남은 것은 코드와 테스트 경계의 기술 보완이다.

ΔV4 문서 검사: 이번 턴의 변경 문서 4개·상대 링크 259개와 저장소 소유 문서 링크에서 파손 0건, diff 검사 통과. D31의 대기·저장 계약과 D32의 제어 허용 조건을 분리해 대조했다. 네이티브 실측은 위 표에 기록했고 제품 코드·기존 verify 및 구현 완료 판정은 변경하지 않았다.

## 27. ΔV5 — READY 확정과 구현 경계 잠금

앞 절의 미잠금/조사 대기 문구는 당시 상태다. D1–D32의 유효 결정을 유지하고, 아래 설계로 D32의 capability 차단·D28의 배포 파일 비소급·D31의 대기 처리를 구현한다. 이번 재실행에서 Claude MCP root 누출, Windows local plugin의 A/B 격리, OpenCode 상위 파일 상속과 directory SDK 격리를 다시 관측했다. OpenCode 전역에서 disabled로 선언한 MCP도 directory `connect`로 connected가 되어 새 인스턴스의 전역 SDK 선택 적용 경로를 확인했다.

### 최종 구조

| 경계 | 구현·수명 계약 |
|---|---|
| 전역 선택 | `app/extension-control.ts`의 앱 수명 메모리 객체를 catalog handler와 adapter registry에 **같이** 주입. native 전역 값은 원본 reader, 명시 선택만 메모리. 기존 `nativeExtensionChoices`·`projectMcpChoices`는 읽어 적용하지 않고 새 patch 입력에서도 제외. 기존 디스크 데이터의 일괄 삭제/자동 이관 없음 |
| Claude MCP | 현재 SDK의 native persistence는 cwd 격리 불가. list는 실제 상태와 `canToggle=false`, set은 SDK 호출 전에 거부. reader는 현재 cwd의 native entry만 project override로 사용하고 Git-root fallback을 합치지 않음. 외부 MCP 정의 변경은 관측하고 필요 시 `restart-required`; 정상 회수 전 toggle/dispose 우회 없음 |
| Claude plugin | Windows 실제 cwd의 local 저장과 SDK flags/reload를 지원하는 설치만 제어. 확인되지 않은 OS 저장 범위·설치·SDK setter는 관측만. plugin writer의 callback 반환형을 Promise로 바꾸고 실제 저장까지 await. 다른 peer의 `persist=false`는 재저장하지 않음 |
| OpenCode 프로젝트 | 현재 버전에서 지원하지 않는 native 영속 제어는 모니터링. `OpenCodeMcpControl.set`과 adapter 직접 port에서도 거부, 기존 Orca JSON 프로젝트 선택은 무시. 따라서 미사용 JSONC writer를 생성하지 않음. native 파일 read/files/revision을 project policy로 연결해 외부 변경을 관측하고 재시작 필요는 정상 회수까지 보류 |
| OpenCode 전역 | acquire 시 captured global MCP 선택만 prepare에서 directory SDK에 적용. project revision 변경이 최신 global을 다시 읽지 않음. 기존 서버·SSE·native bootstrap·owner 회수 흐름 유지 |
| Claude 배포 snapshot | 신규 `infra/config/plugin-snapshots.ts`가 배포 완료 직후 생성한 불변 plugin 사본을 발행. `createClaudeDeploymentService`의 직렬 deploy 함수 안에서 사본 준비까지 await. `PluginSnapshotPort.capture(roots)`가 현재 발행 세대의 roots와 release를 반환하며 ClaudeAdapter의 cwd snapshot이 이를 보유 |
| snapshot 보호 범위 | 생성된 Orca plugin의 manifest/MCP/skill 파일은 사본. user-skills wrapper의 링크는 유지하고 활성 필터는 기존 cwd skill snapshot을 사용. 외부 설치 파일 자체의 사용자가 수행한 코드 변경은 on/off 설정 비소급 계약과 구별. `.mcp.json`의 credential 내용을 로그/설정 JSON에 저장하지 않음 |
| snapshot 회수 | 현재 발행 세대는 다음 capture를 위해 유지, 교체된 세대는 owner가 0이면 제거. 같은 cwd 새 peer/reload는 기존 사본, 새 cwd는 최신 사본. 최종 cwd owner 해제 시 lease 반환. 앱 정상 종료는 runtime 종료 후 snapshot 정리; 부분 발행 실패는 직전 세대 유지 |
| 파일 queue | `infra/config/file-mutation.ts`의 프로세스 공유 coordinator가 D31 read/merge/commit을 직렬화. 실제 파일 별칭 통일, no-follow/범위 재검사, 고유 temp·sync·rename·revision 재병합·bounded retry·실패 후 release. 같은 cwd mutation 큐와 파일 큐는 별개며 SDK await를 파일 lock 내부에 두지 않음 |
| 종료 | `before-quit`에서 신규 파일 변경 접수 중지→접수한 큐 drain→기존 runtime shutdown→snapshot 정리→실제 quit. 기존 will-quit의 DB/log 종료 순서는 보존하고 shutdown은 멱등. file 실패를 숨긴 성공 응답이나 무한 종료 대기 없음 |

`PluginSnapshotPort`는 adapter 공통 포트이며 구체 구현을 app이 주입한다. adapter→feature 역참조를 추가하지 않는다. snapshot은 실행 자원이며 사용자 선택의 새 영속 저장소가 아니다. 배포가 진행 중이어도 이미 발행된 사본을 capture하므로 반쯤 쓴 dist를 읽지 않는다. 새 발행에 실패한 배포는 성공으로 표시하지 않는다.

### 최종 §10 및 직접 oracle — 새 자리/기존 이관

아래 좌표는 구현할 테스트명이다. 기존 V의 비영향 경계는 유지하며, DRAFT에서 비어 있던 경계는 이 표가 최종 분모다. 상위 AC는 하위 자리의 실제 파일·SDK 인자·runtime/UI 관측을 합쳐 검증하고 타입 검사로 대체하지 않는다.

| 자리 | 생산 경로 / 해당 pair | 직접 oracle 좌표와 구별 입력 |
|---|---|---|
| FEP1 | protocol patch→SettingsStore / DV1-P1·4 | `extension-catalog.test.ts: native choices stay in memory` + `settings-store.test.ts: legacy extension choices are inert` — old false/new true/비대상 sentinel 및 실제 backend bytes |
| FEP2 | bootstrap→catalog/control→registry / DV1-P4 | `bootstrap.harness.test.ts`·`bootstrap.native-history.test.ts` — 동일 control 주입, 전역 조작 후 새 adapter 값·기존 capture 보존 |
| FEP3 | Claude sendMessage→cwd snapshot→query/release / DV1-P2 | `adapter.native-plugins.test.ts: deployed MCP snapshots survive new peers and reload` — 실제 임시 `.mcp.json` old/new 값과 G1–G8, SDK fixture가 전달받은 경로를 읽음 |
| FEP4 | deployment callback→publish→capture / DV1-P2·DV5-P1 | `app/harnesses/claude/extensions.test.ts: publication finishes inside serialized deployment` + `plugin-snapshots.test.ts: retained generation survives publication` — 발행 barrier·사본 내용·A/B/최종 해제 |
| FEP5 | native resource list/set→SDK/persistence / DV4-P2·3·DV3-P3 | `native-resources.test.ts: unisolated MCP writes are rejected` 및 `persistence is awaited` — 실제 set 호출·SDK 무호출·지연/실패 callback·지원 plugin 성공 |
| FEP6 | Claude project reader→reconcile / DV1-P3·DV4-P2 | `project-settings.test.ts: Git-root MCP state does not alter child revision` + `project-reconciliation.test.ts: read-only changes await resource reclamation` — A root/B child·같은 이름·외부 변경 |
| FEP7 | OpenCode context capture→prepare/set/reconcile / DV1-P2·DV4-P2 | `session-context.test.ts`·`adapter.test.ts` — G1–G8, SDK transport의 directory·connect/disconnect·set 거부 및 legacy 선택 무기록 |
| FEP8 | native OpenCode files→revision→ProjectResourceSync / DV2-P2·3 | 신규 `opencode/v1/project-settings.test.ts` + `project-resource-sync.test.ts` — 실제 A/B 파일/rename·busy/idle·restart-required·과거 세대 |
| FEP9 | plugin-state→file coordinator / DV3-P1·3·4 | `plugin-state.test.ts`·`file-mutation.test.ts` — W1–W9, 실제 파일의 형제 키·같은 키 순서·별칭·동시 생성·외부 재편집 |
| FEP10 | session handler/sharing→native setter / DV3-P1·DV4-P1 | `session-resources.test.ts`·`native-resource-sharing.test.ts` — 지연 persistence까지 응답 대기, peer 무기록, stale/unsupported 거부 |
| FEP11 | queue close→app quit→runtime/snapshot dispose / DV3-P2·DV5-P1 | 신규 `app/native-settings-lifecycle.test.ts`·`plugin-snapshots.test.ts` — 접수한 저장·close/rejection·shutdown 멱등·삭제 완료 순서 |
| FEP12 | resource DTO→nav/panel / DV4-P1·0277 DV1-P3 | `useNativeMcpCatalog.test.ts`·`CustomizeList.render.test.ts`·`nativeResourceState.test.ts` — on/off×capability, legacy 전역 선택 무시, 실제 관측·미지원 토글 부재 |

검색 입력: `rg -n 'nativeExtensionChoices|projectMcpChoices|extensionControl|persistPluginState|persistClaudePluginState|toggleMcpServer|mcpControl|extensionSnapshots|createClaudeDeploymentService|createHarnessDeploymentService|before-quit|will-quit' app/src/main app/src/shared`; observer/consumer 경계는 `rg -n 'projectResource|canToggle|nativeResources' app/src/main/app app/src/main/adapters app/src/renderer/src/features/chat app/src/renderer/src/features/skills`로 대조했다. ΔV3 WEP1–10은 FEP1–12의 해당 생산 경로에 통합하며 D32가 차단한 writer의 성공 oracle은 무기록/거부로 이관한다.

DV5-P1 **AR7↔IT7 NEW REQUIRED**는 immutable publication→capture→release/cleanup이고 FEP3·4·11에서 검증한다. DV1-P2/4, DV2-P2, DV3-P1–4, DV4-P1–3은 위 경로로 **CHANGED REQUIRED**, 나머지 유효 pair는 기존 직접 oracle의 **REGRESSION**이다. AC4S·5G·7C·11·17W–21C가 이 변경을 포함한다. 0277 관측과 0281 메뉴는 해당 plan의 AC/V/테스트를 함께 실행하며 컴포저를 위해 서버 재시작·추가 MCP barrier를 넣지 않는다.

### READY 판단

D20/30의 native 저장 허용과 D32의 격리 불가 거부를 구별했고, D26의 무승인 global 영속화를 제거하는 읽기/쓰기 경로를 고정했다. D28의 flags뿐 아니라 mutable MCP 배포 파일을 FEP3·4에서 다룬다. D31의 file queue와 D32의 mutation 거부는 각각 FEP5·7·9·10에서 관측한다. ACTIVE 결정↔최신 AC 대조에서 충돌 0이며 사용자 결정이 필요한 항목은 남아 있지 않다.

**READY는 설계·재현 경계 확정이다.** 기존 F1과 V1의 실패/자기보고는 그대로 보존하며 아래 구현 보고에서 실제 oracle 결과를 기록한 뒤에만 IMPL_DONE으로 넘긴다. 필수 gate는 관련 Vitest, node/web/test typecheck, lint, production build, 문서/inventory/diff 및 실제 Windows 잠금 해제 probe다. 외부 참조 checkout의 기존 링크 오류와 사용자 커스텀 실행 파일/실제 창 시각 인수는 별도로 보고한다.

## [구현자 기입] — V1 r1

### 1. 설계 리뷰

nav는 native 전역 파일에서 목록·기준 상태를 읽는다. 프로젝트 파일이나 기본 작업폴더를 전역 조회에 섞지 않고, 서버를 획득하지 않는 별도 IPC를 연결했다. D22에 따라 기준값 사본을 저장하지 않는다. 기존 Orca 설정 JSON에 기록하는 값은 사용자가 지원 항목의 토글을 직접 바꾼 선택뿐이다. 미지정 항목은 native 값을 다시 읽는다.

D25는 저장 수명 요구와 D22를 함께 충족하기 위한 구현 해석이다. `nativeExtensionChoices`에는 엔진·종류·원래 식별자·boolean만, `projectMcpChoices`에는 정규화 cwd별 OpenCode MCP boolean만 기록한다. Claude 프로젝트 파일은 기존 D20/D21 경로를 유지한다. 새 DB·외부 global 설정 쓰기·nav 프로젝트 선택 UI는 없다.

### 2. 강제 지점 전수·V pair 자기확인

| EP | 확인 | 실제 실행·직접 oracle |
|---|---|---|
| EP1 | 5/5 | `extension-catalog.test.ts`: 실제 등록 IPC와 SettingsStore 저장 JSON·불가 변경 거부. `preload/index.test.ts`: preload→renderer API의 정확한 인자. `bootstrap.harness.test.ts`: 실제 constructor의 서로 다른 엔진 선택 주입. `bootstrap.native-history.test.ts`: 실제 register의 catalog handler와 projectMcpChoices→sync 연결 |
| EP2 | 3/3 | `adapter.native-plugins.test.ts`: native off→Orca on SDK flags, SDK skill allow-list, 같은 cwd A/peer 보존·새 B·마지막 owner 해제 후 A 재생성. native 파일 bytes 유지 |
| EP3 | 4/4 | `session-context.test.ts`: 설치 SDK transport에서 directory별 capture·prepare·공유 owner·유휴 reconcile. `adapter.test.ts`: MCP 변경이 prompt보다 선행, 실제 live port의 generation 거부·프로젝트 저장·지연 적용 |
| EP4 | 5/5 | 양 `configured-resources.test.ts`: global-only 임시 파일. `useNativeMcpCatalog.test.ts`: 실제 hook→CustomizeList→CatalogToggle 클릭→API→행 갱신, 부분 실패·지각 응답. `CustomizeList.render.test.ts`와 native panel/state 회귀: on/off×capability 및 runtime 표시 |

전수 17/17, 잔여 0. VP1–VP6 SELF_PASS. VP7은 0279의 파일 감시·유휴 적용·peer 공유, 0280 준비 목록, 0275 directory/server 수명 테스트를 다시 실행해 SELF_PASS로 기록한다. 별도 verify 판정은 하지 않았다.

### 3. 이번 라운드 수정의 잠금

직접 행동 oracle로 native 값 변경 전후 JSON 무기록, 명시 선택 후 JSON 재생성, 외부 파일 sentinel, 프로젝트 A/B의 다른 SDK 결과를 단언한다. 캐시·부분 실패는 정상 항목을 지운 빈 성공 결과와 구분한다. 이번 plan에 선택 mutation은 없으며, 오류 표면 registry의 기존 자체 검증은 유지했다.

### 4. Product/UX 파생 검토

제어 가능성으로 글씨·토글을 결정한다. 꺼진 Claude user plugin은 일반 글씨와 가변 off 토글, 미지원 OpenCode plugin/skill 및 Claude native MCP 전역 항목은 실제 상태와 고정 회색 토글이다. 프로젝트 우측 패널은 지원 항목만 제어하며 남아 있던 세션별 제어 문구도 프로젝트별로 정정했다. plugin 부모와 그 안의 개별 skill은 별개 항목이며 개별 off API가 없는 skill에는 가변 토글을 만들지 않았다.

nav 조회 실패는 확인된 다른 엔진 항목을 보존하고 재시도를 제공한다. 없는 설정 파일은 열 수 없다. 전역 폴링과 토글 응답의 순서를 분리해 늦은 조회가 새 선택을 덮지 않는다. Composer 팝업의 안내 금지는 [0281](../0281-opencode-menu-cache/plan.md)과 함께 유지했다.

### 5. 놓친 잠재 문제·대응

| 발견 | 대응·경계 |
|---|---|
| Claude provider 옵션에 빈 enabledPlugins가 추가되는 회귀 | providerSettings 원본을 바꾸지 않고 captured plugin defaults를 별도 인자로 전달. 기존 SDK 옵션 회귀 재통과 |
| native global 변경이 같은 cwd의 후속 Query에 섞일 위험 | Query owner별 참조 수명으로 plugin flags·skills capture. 마지막 해제 후 새 capture |
| OpenCode MCP 일부 조회 실패로 정상 plugin/MCP가 사라짐 | 종류별 allSettled와 마지막 확인 목록. 실패한 MCP의 제어는 잠그며 연결 종료 시 과거 connected 제거 |
| 프로젝트 선택 저장 직후 busy peer에 실행 변경 전파 | SettingsStore 알림→ProjectResourceSync의 전체 프로젝트 유휴 판정. SDK set port는 선택을 저장하고 reconcile이 실제 변경 |
| native 초기화 비용 | OpenCode connect/disconnect는 native bootstrap 뒤다. native MCP 최초 연결 비용을 제거하지 않으며 agent/provider 조회에 새 MCP barrier를 넣지 않음 |
| 기존 Orca 소유 MCP 배포 | 기존 배포 파일 경로는 유지했다. 이번 instance capture는 새 native plugin/skill 선택과 OpenCode MCP 제어에 대한 것이며 배포 파일 전체의 버전 보관을 추가한 것은 아님 |
| 사용자 커스텀 바이너리·실제 창 | 설치 SDK/transport와 render harness 증거다. 사용자의 별도 환경에 있는 1.17.19 및 실제 두 테마 인수로 대체하지 않음 |

### 6. 구현 보고

확정 AC10/10을 코드·자동 검사 범위에서 자기확인했다. 기존 DRAFT 초안의 미확정 selector 요구를 완료로 세지 않았다.

- 정책 집중 검사 11파일 128개, 확장 검사 24파일 144개 통과.
- 넓힌 회귀 130파일 1503개 중 최초 31개 실패를 분리했다. Claude 옵션 회귀와 지원 불가 port 기대값은 수정했다. 임시 폴더 접근 실패는 workspace TEMP로 실행한 5파일 70개, SQLite ABI 차이는 Electron Node 모드 1파일 7개에서 통과했다. 옵션·오류 registry·IPC 문서 재검사 4파일 286개 통과.
- 최종 SDK·catalog·popup 집중 실행은 12파일 352개 중 테스트 i18n harness 연결 1개가 실패했고, 수정 후 해당 hook과 실제 bootstrap 등록을 포함한 2파일 11개가 통과했다. 프로덕션 실패를 숨긴 skip 없음.
- 수정 후 최종 넓힌 회귀는 105파일 1340개 전건 통과했다. SQLite native-cursor만 위 Electron 실행으로 분리했으며 나머지는 workspace TEMP를 사용했다.
- 마지막 프로젝트 범위 문구·실제 상태 패널·session resource IPC 검사는 3파일 31개 통과했다.
- node/web/test 타입 검사와 production build 통과. Electron SQLite ABI 유지. 최종 lint·문서 검사 결과는 아래 마무리 기록에 남긴다.

마무리 gate: lint 오류 0·기존 TanStack Virtual 경고 2. 생성 inventory와 prose 검사는 통과했다. 전체 링크 스캔은 무시되는 외부 참고 checkout `.tmp/opencode-dev`, `app/.temp/opencode` 안의 기존 깨진 링크 10개로 실패했고, 두 checkout만 제외한 운영 문서 링크 검사에서 0개였다. 참고 소스는 변경하지 않았다. `git diff --check` 통과. 커밋 trailer는 생성 후 파싱을 확인한다.

이는 구현자 증거이며 독립 검증 PASS가 아니다. 임시 fixture와 실제 사용자 환경을 구분한다.

### 7. Review Signals

SDK가 제공하지 않는 native plugin load/unload를 임의 config 필드로 흉내 내지 않았다. OpenCode Config.update·서버 재시작을 조회/토글 경로에 넣지 않았다. JSON에는 native 원본이나 비밀을 복제하지 않는다. 검증자는 특히 global-only reader, 동일 cwd의 소유권, 프로젝트 유휴 적용, 미지원 항목의 고정 표시를 확인하면 된다.

## [구현자 기입] — r1.2 CI 보완

1. **설계 리뷰**: CI [39720190083](https://github.com/muzaby/orca-skin/actions/runs/39720190083)의 4파일 27실패를 로컬에서 재현했다. 제품 정책·AC·V는 변경하지 않았다.
2. **강제 지점**: OpenCode queue/runtime 통합 fixture에 global SSE envelope, config/catalog 응답과 instance disposal 완료 이벤트를 반영했다. 승인 UI fixture에는 새 catalog/관찰 IPC를 연결했다. VP3·VP7 및 0281 메뉴 캐시 회귀가 대상이다.
3. **회귀 잠금**: 전역 SSE 1회 공유와 config 1회 준비를 단언한다. 메뉴 관찰 owner 등록/해제와 목록 조회를 구분해, 재진입 시 실제 목록 조회가 늘지 않는 기존 oracle을 유지했다. 입력 재전송·이전 응답 유출·승인 순서 검사는 그대로 실행했다.
4. **Product/UX**: 프로덕션 동작·라벨·로딩 표시를 변경하지 않았다. 메뉴 refresh 제거와 캐시 재사용 계약을 유지한다.
5. **잠재 문제·환경**: 전체 Electron Node 모드 실행은 fork worker 종료 지연으로 중단했다. 전체 통과 증거로 세지 않는다. 스크립트의 임시 경로 접근 제한은 workspace TEMP로 분리해 재실행했다.
6. **검사 결과**: 수정한 4파일 40테스트, 스크립트 142테스트, node/web/test 타입 검사, lint(오류 0·기존 경고 2), diff check 통과. 전체 Windows 검사는 푸시 후 CI로 확인한다. AC10/10 자기보고는 유지하며 독립 검증 PASS는 아직 아니다.
7. **Review Signals**: timeout 상향·skip·실제 런타임 mock 대체로 우회하지 않았다. SDK transport fixture를 현재 계약에 맞췄으며, 공유 SSE와 채널 generation을 별개로 검증한다.

## [검증자 기입] r1.2 파생 이슈

- **F1 / BLOCKING / VP7·AC7·D16**: Claude native MCP의 Git-root 저장이 하위의 다른 cwd로 전파된다. 설치 SDK와 실제 reader/reconcile 반례를 [verify.md](verify.md)에 보존했다. 같은 cwd 공유 필터만으로 cold-start 및 파일 감시 경유 전파를 막을 수 없다. 현재 작업경로 격리를 유지하는 수정이 필요하다.
- **미검증 경계**: Orca 배포 MCP의 고정 파일 경로와 같은 cwd의 후속 Query 합류. flags/skills snapshot 통과를 이 경계의 PASS로 확대하지 않는다.


## [구현자 기입] — ΔV5 r2 (2026-10-22)

### 1. 설계 리뷰

READY 설계를 `10f52f99`로 먼저 커밋한 뒤 구현했다. D26의 전역 SDK 선택은 프로세스 메모리이며 native 기본값을 복제하지 않는다. D32에 따라 Claude MCP와 OpenCode 프로젝트 MCP/plugin은 관측만 제공하고 직접 mutation도 거부한다. Windows Claude plugin만 실제 cwd의 local 파일과 SDK flags/reload로 제어한다. 기존 V1 구현 보고의 JSON 선택 저장·MCP 가변 토글 설명은 이 라운드의 구현 결과로 대체된다.

Claude SDK의 설치본 0.3.286과 선언 버전 0.3.296을 각각 격리된 fixture에서 실행했다. 두 버전 모두 MCP toggle은 A Git root에 저장되고 새 child B가 disabled를 읽었다. 두 버전 모두 Windows local plugin off는 A 새 Query와 A reload에만 반영되고 새 child B는 enabled였다. 따라서 MCP 제어 차단과 Windows plugin 지원을 구분했다. OpenCode 1.17.19 실측은 §26·27의 상위 파일 상속/SDK directory 연결 결과를 유지한다. LLM 요청이나 실제 사용자 MCP 설정 변경은 사용하지 않았다.

### 2. 강제 지점·V pair 자기확인

| §27 자리 | 직접 oracle·이번 관측 | pair 자기결과 |
|---|---|---|
| FEP1 | `extension-catalog.test.ts: keeps supported explicit choices only in memory / does not reactivate legacy choice bytes` — legacy 원본 보존, patch 무효, native 값 재조회, 새 control 빈 값 | DV1-P1·4·5 SELF_PASS |
| FEP2 | `bootstrap.harness.test.ts: initializes its actual adapter registry`와 `bootstrap.native-history.test.ts: registers the global catalog with process choices` — legacy false가 등록된 reader/registry 기본값을 덮지 않음 | DV1-P4 SELF_PASS |
| FEP3 | `adapter.native-plugins.test.ts: pins deployed MCP files` 및 `isolates global SDK choices` — A 기존/새 peer/재개/reload old 파일, 새 B/new A next 파일, 일부 owner 해제 후 old 유지 | DV1-P2·DV5-P1 SELF_PASS |
| FEP4 | `extensions.test.ts: finishes immutable publication inside the serialized deployment`, `bootstrap.shutdown.test.ts: deploys enabled MCP servers`, `plugin-snapshots.test.ts` — publication barrier 동안 다음 배포 대기, factory→publisher 전달, 실패 시 이전 사본 유지, retired 사본 정리 | DV5-P1 SELF_PASS |
| FEP5 | `native-resources.test.ts: rejects both MCP toggle directions / waits for durable persistence`, `adapter.live-control.test.ts` — MCP SDK 호출 0, plugin persistence 대기·롤백, peer persist=false | DV3-P3·DV4-P2·3 SELF_PASS |
| FEP6 | `project-settings.test.ts`, `project-reconciliation.test.ts`와 기존 `evidence/native-isolation.test.ts`의 child 반례 — A Git-root 변경 뒤 B revision 동일·set 호출 0, 읽기 전용 변경 restart-required | DV1-P3·DV4-P2 SELF_PASS |
| FEP7 | `session-context.test.ts: freezes global choices per directory`, `adapter.test.ts: rejects unsafe project controls` — acquire/prepare 사이 변경도 captured 값 유지, B 최신값, 최종 A 회수 후 최신값, 직접 set 거부 | DV1-P2·DV4-P2 SELF_PASS |
| FEP8 | `project-settings.test.ts: observes exact cwd MCP/plugin keys`, `project-resource-sync.test.ts` — native JSONC read, A/B revision 분리, model만 변경 시 no-op, UI desired와 실제 상태 구분, busy 보류/idle restart-required·stale 폐기 | DV2-P2·3 SELF_PASS |
| FEP9 | `file-mutation.test.ts`, `plugin-state.test.ts` — 동일 파일 별칭 FIFO·형제 키·마지막 값, 다른 파일 독립, 외부 변경 재병합, ENOSPC/잠금 실패 원본 보존·후속 요청, 실제 Windows FileShare.None 해제 후 성공 | DV3-P1·3·4 SELF_PASS |
| FEP10 | `session-resources.test.ts: serializes conflicting project requests`, `native-resource-sharing.test.ts`, `native-resources.test.ts: waits for durable persistence` — 실제 IPC 큐 순서·불가 항목 거부·peer 무기록·await 전달 | DV3-P1·DV4-P1 SELF_PASS |
| FEP11 | `native-settings-lifecycle.test.ts: defers actual before-quit events`, `bootstrap.shutdown.test.ts` 및 snapshot tests — 두 quit 입력도 한 번만 drain, 저장→runtime→사본 순서, shutdown 멱등 | DV3-P2·DV5-P1 SELF_PASS |
| FEP12 | `useNativeMcpCatalog.test.ts`, `CustomizeList.render.test.ts`, panel/store 및 `useNativeResources.test.ts` — capability별 표시, 실패/지각 응답·동적 항목·종료 관측 보존 | DV4-P1 및 0277 DV1-P3 SELF_PASS |

§27 검색식으로 새 helper와 기존 consumer를 다시 대조했다. native 선택의 production 사용 검색은 읽기 호환 `Settings`/`SettingsSchema` 선언만 남고 `setProjectMcp`·`projectMcp()`·SettingsStore의 해당 patch 경로는 0개다. `toggleMcpServer`는 resource Query 타입에만 남고 mutation/reconcile 호출은 0개다. `before-quit` 등록은 `registerNativeSettingsQuit`로 이동해 실제 등록 callback을 검사했다. FEP1–12의 생산 경로는 위 oracle에서 자기확인했으며 실제 창/사용자 커스텀 실행 파일은 아래 미확인 범위다.

V1 VP1–7와 ΔV1–5 유효 pair는 §27의 이관 기준으로 SELF_PASS(자동 검사 범위). 대체된 native writer 성공 조건을 별도 JSON 쓰기로 흉내 내지 않고 거부/무기록으로 확인했다. AC1–3·4S·5G·6N·7C·8–12·13N–16F·17W–20L·21C는 같은 범위의 자기확인이다. 독립 검증 PASS가 아니다.

### 3. 이번 수정의 잠금

기존 verify F1의 reader/reconcile 반례를 이름 필터로 그대로 재실행해 child revision과 SDK set 무호출을 확인했다. 오래된 OpenCode 프로젝트 쓰기 성공 테스트는 새 거부 정책의 생산 테스트로 이관하며 원본 과거 증거는 수정하지 않았다. 파일 테스트는 형제 값·응답 시점·동시 파일·영구 실패·실제 OS 잠금을 구별한다. 일반 경합에서 즉시 예외를 내던 동기 writer를 async queue로 바꿨으며 저장 완료 이전에는 성공 응답하지 않는다.

### 4. Product/UX 파생 검토

우측 패널은 지원 불가 MCP의 상태를 계속 표시하면서 토글을 제공하지 않는다. 전역은 항목별 SDK capability를 유지한다. Composer는 실제 agent만 표시하고 agent 로딩 중 그룹 제목 오른쪽 indicator 하나만 제공한다. MenuTitle trailing·Popover·Icon을 재사용하며 빈 메뉴의 Escape/Tab과 초점 복귀, reduced-motion class 및 성공 캐시 재사용을 검사했다. 실제 Electron 창의 두 테마 시각 인수는 미실행이다.

### 5. 잠재 문제·대응

- 네이티브 외부 프로세스는 Orca의 FIFO를 공유하지 않는다. commit 직전 bytes 비교와 재병합을 제공하지만 외부 writer와 원자 compare-and-swap을 보장하지는 않는다.
- snapshot은 실행 파일 사본이다. 정상 종료·owner 회수 때 지우며 비정상 프로세스 강제 종료의 잔여 파일 자동 청소는 이번 정상 종료 보장의 범위 밖이다. MCP 비밀은 사본 파일에만 포함되며 내용·설정 경로를 오류/목록으로 보내지 않는다.
- OpenCode plugin hook 및 native MCP 초기 연결 비용을 제거한 것이 아니다. server/instance/SSE 공유와 기존 bootstrap 순서를 유지했다.
- 기존 유휴 적용은 유지한다. 격리 불가 native 변경은 강제 dispose하지 않고 정책상 자원 회수를 기다린다.

### 6. 구현·검사 보고

- 관련 회귀: 122파일 1,177개 통과, 기존 조건부 skip 1. SQLite 1파일 7개는 설치된 Electron ABI로 별도 통과.
- 경계 확장 검사: 8파일 중 161개 통과 후 bootstrap fixture의 신규 publisher 주입 누락 1개 수정. 해당 bootstrap + 실제 quit callback 검사 2파일 9개 통과.
- 최초 넓힌 검사 실패는 정책 기대값 1개, TEMP 접근 제한 11개, SQLite ABI 7개였다. 기대값 보완과 workspace TEMP, Electron Node 모드로 원인을 분리했고 생산 코드를 timeout/skip으로 우회하지 않았다.
- node/web/test 타입 검사, lint 오류 0(기존 virtualizer 경고 2), production build 통과. 마지막 수명 callback 조립 이후 node 타입·production build도 재통과했다.
- inventory/prose·test budget·diff 검사 통과. 전체 링크 검사는 ignored 외부 참고 checkout의 기존 10개 실패이며, 두 참고 checkout만 제외한 링크 결과 `[]`이다.
- 추가 renderer 범위 검사 5파일 19개 통과. 실제 oracle 파일은 `nativeResourceState.composer.test.ts`·`nativeResourcesMenu.test.ts`·`NativeResources.test.ts`·`ChatTitleBar.native-resources.test.ts`·`NativeStatusProject.test.ts`다. 이전 표의 `nativeResourceState.test.ts` 약칭을 이 좌표로 구체화한다.
- native 실측: Claude 0.3.286/0.3.296·OpenCode 1.17.19의 격리 fixture. 사용자의 커스텀 바이너리/실제 모델 응답 지연 수치는 미측정이다.

### 7. Review Signals

새 의존성·새 사용자 선택 저장 형식 없음. 기존 legacy 데이터는 삭제하지 않고 실행에서 제외했다. 검증자는 native read-only guard, 같은 cwd 후속 Query의 사본 경로, 파일 lock 대기/실패 복구, before-quit drain을 우선 확인하면 된다. 정책 READY와 구현 자기검증을 독립 verify 결과로 혼동하지 않는다.

## [구현자 기입] — ΔV5 r2.2 CI 보완 (2026-10-22)

### 1. 설계 리뷰

CI 운영 gate의 실패를 보완하며 유효 Decision·AC·V와 생산 코드는 변경하지 않는다. [실패한 Windows CI](https://github.com/muzaby/orca-skin/actions/runs/39767523955)는 테스트 4개 실패·7,886개 통과였고 lint·typecheck·문서·예산 검사는 통과했다.

| 실패 | 재현·원인 | 보완 |
|---|---|---|
| artifact publication 검사 | plugin snapshot의 `publish`도 산출물 게시로 오인, 로컬 재현 | 정확한 `this.pluginSnapshots` 수신자만 예외. 같은 파일의 다른 publish는 계속 검출 |
| daily gate 종료 검사 | 멱등 종료의 첫 `return`보다 dispose가 앞이어야 한다는 문자열 전제, 로컬 재현 | 실제 `Bootstrap.shutdown()`에서 초기화 전/후 정리 순서·두 번 종료 시 1회 dispose 확인 |
| 파일 별칭 FIFO 검사 | 대문자 TEMP 환경에서 canonical 경로와 입력 문자열이 달라 barrier 미진입·20초 timeout 재현 | canonical 부모로 barrier 대조. 첫 요청부터 대소문자 별칭 사용, 선행 저장 실패도 즉시 전파 |
| Windows OS 잠금 검사 | CI의 15초 timeout은 확인했으나 동일 timeout은 로컬 미재현 | PowerShell encoded 명령·준비 토큰/flush·준비 전 종료/오류 진단·자식 종료 await. 실제 EBUSY 후 저장 대기/해제 확인 |
| 로컬 Work 통합 검사 2건 | 전체 회귀에서 실제 사용자 설치 plugin 경로가 기대 목록에 추가되어 실패 | 두 파일의 SDK 요청에 임시 `CLAUDE_CONFIG_DIR`를 전달. reader·builder·adapter는 실제 구현 유지, 재실행 2파일 4개 통과 |

### 2. 강제 지점·V pair 자기확인

| 이번 변경의 §27 자리·운영 gate | 직접 oracle | 남긴 곳 |
|---|---|---|
| FEP9 / DV3-P4 | `file-mutation.test.ts`의 동일 파일 별칭/형제 키/마지막 값·다른 파일 진행·외부 재병합·실제 OS 잠금, `plugin-state.test.ts`의 제한 키 저장 | native SDK 자체 쓰기는 D32 거부 정책 유지; 이번 턴 재실측 대상 아님 |
| FEP11 / DV3-P2·DV5-P1 | `bootstrap.shutdown.test.ts`의 실제 초기화 전/후 dispose와 멱등, `native-settings-lifecycle.test.ts`의 quit/drain, `plugin-snapshots.test.ts`의 사본 수명 | 독립 verify·실제 창 인수는 미수행 |
| FEP4의 publication 인접 gate | `bootstrap.artifacts.test.ts` 저장소 sweep 및 두 예외 각각과 artifact publisher가 공존하는 입력 | 파일 전체 예외 없음 |

FEP9·11의 생산 코드 변경은 없고 이번 수정은 실패 oracle과 해당 경계의 회귀에 한정한다. 이전 r2의 정책·native probe 결과를 이번 턴에서 새로 실측한 것처럼 보고하지 않는다.

### 3. 이번 수정의 잠금

| 대상 | 관측 |
|---|---|
| 실제 daily gate dispose 제거 | 초기화 전/후 2개 테스트가 호출 0회로 실패. 생산 파일 원복 후 검사 |
| publication 예외의 범위 | 실제 bootstrap의 snapshot 발행 옆에 artifact publish를 주입하면 저장소 sweep 1개 실패. 원복 후 종료/게시/일일 gate 3파일 18개 통과. 두 예외와 artifact가 공존하는 fixture도 검출 |
| Windows 별칭 barrier | 수정 전 대문자 TEMP의 20초 timeout, 수정 후 같은 환경의 경계 7파일 29개 통과 |

선택 증거 0 · 인용 변이 0 · 새 oracle 민감도 2(종료·publication) = 잠금 대상 2. 별칭 행은 직접 파일/완료 결과의 재현이며 별도 변이를 발명하지 않았다.

### 4. Product/UX 파생 검토

제품 코드·표시·설정 형식은 변경하지 않는다. 파일 대기·전역 비소급·작업경로 격리 정책을 테스트 실패에 맞춰 완화하지 않으며 기존 timeout 예산과 조건부 skip 범위도 유지한다.

### 5. 잠재 문제·대응

OS 잠금 helper는 준비 전 정상 종료(code 0)도 실패로 처리하고 stderr를 붙여 무한 준비 대기를 피한다. 이 진단은 임시 파일을 쓰는 테스트에만 존재하며 사용자 설정·토스트 경로에는 추가하지 않는다.

### 6. 구현·검사 보고

- 대문자 TEMP·`CI=true` 환경의 경계 7파일 29개, node/web/test 타입 검사, 수정 파일 lint(오류/경고 0), migration/test-budget 통과.
- 로컬 전체 Vitest: 808파일 7,891개 통과, Work의 사용자 설정 혼입 2개 실패, 기존 조건부 skip 2개. 혼입 수정 후 해당 2파일 4개 통과; 전체 로컬 재실행으로 표현하지 않는다.
- 스크립트 142개와 production `electron-vite build` 통과. Work fixture 보완 후 test 타입·대상 lint도 통과.
- inventory/prose·diff 통과. 기존 외부 참조 checkout 둘만 제외한 링크 결과 `[]`; 원격 clean checkout의 문서 gate도 통과.
- [최종 Windows CI](https://github.com/muzaby/orca-skin/actions/runs/39771749947) SUCCESS: 810파일 7,893개 통과·기존 skip 2개, scripts 142개 통과. 실패했던 파일 저장 5개·산출물 4개·일일 gate 5개와 Work 4개 모두 통과했다.
- 원격 lint 오류 0·기존 경고 2, node/web/test 타입 및 migration/doc/test-budget gate 통과. 정상 종료 후 로컬 SQLite ABI도 `npm run prebuild`로 Electron 대상에 복원했다.
- 정책 AC는 r2의 21개를 그대로 유지한다(추가/삭제 0). 이번 종료 판정은 CI 운영 gate 복구이며 독립 verify PASS를 대신하지 않는다.

### 7. Review Signals

직전 관련 테스트 집합이 인접 source-scan 두 곳을 포함하지 않아 전체 CI에서 오탐을 발견했다. 이번에는 실패 3파일과 종료·snapshot·plugin writer의 직접 회귀를 먼저 확인하고 전체 Windows 테스트/원격 gate로 확장한다. 기존 독립 검증 대기는 유지한다.

## [검증자 기입] 파생 이슈 — verify r2 (2026-10-22)

판정 정본은 [verify.md §r2](verify.md#verify-r2--fail-claude-2026-10-22) — **FAIL**. r1.2의 F1은 D32 거부로 해소 확인.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| R1 | X1 catalog에 다른 control 주입 green | FEP2 · AC2·AC5G · DV1-P4 | 실제 bootstrap에서 catalog 선택→registry 새 adapter SDK 인자 단언 | BLOCKING | open |
| R2 | X2 `await publish` 제거 green | FEP4 · AC5G · DV5-P1 | 발행 gate 전 `deployNow` 미완료 단언 | BLOCKING | open |
| R3 | A23 OpenCode plugin 선언 revision 누락·A6 stale revision emit green | FEP8 · AC15O·AC11 · DV2-P3·DV2-P2 | plugin만 바뀐 외부 편집 revision 변화·읽기 중 이벤트 주입 | BLOCKING | open |
| R4 | A15 외부 재편집 재확인 제거 green | FEP9 · AC19C · DV3-P4 | 잠금 없는 `beforeCommit` 외부 편집 케이스 | BLOCKING | open |
| R5 | P11–P13 push scope 3항 제거 green | FEP12 · AC7C · V1 VP4 | 한 항만 다른 push 거부를 항마다 단언 | BLOCKING | open |
| N3 | 증거 README 기대값이 D32 이전 서술 | repository operation | 현재 기대로 갱신 | NON_BLOCKING | open |
