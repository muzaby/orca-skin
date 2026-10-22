# Claude·OpenCode 확장 전역 기본값과 프로젝트 제어 격리

## 메타

| 항목 | 값 |
|---|---|
| slug | 0278-harness-extension-isolation |
| 작성자 / 일자 | Codex / 2026-10-22 |
| 상태 | DRAFT — Claude settings.local.json 제한 편집 허용으로 정정. 일반 MCP의 네이티브 상태 저장 범위 확인 중 |
| V mode / 기준 / revision | Baseline V / 없음 / V1 초안 |
| 관련 작업 | [0277 MCP 관측](../0277-opencode-mcp-catalog/plan.md), [0275 공유 인스턴스](../0275-opencode-shared-instances/plan.md), [0276 Composer 준비](../0276-opencode-composer-preparation/plan.md) |

# Part I — Product & UX Contract

## 1. 목표

Claude와 OpenCode는 Orca 전역 확장 설정을 새 인스턴스의 시작 기본값으로 사용한다. MCP·네이티브 플러그인은 현재 작업경로 단위로 제어하며 같은 경로의 세션은 구성을 공유한다. Claude 프로젝트 설정은 후속 결정 D20에 따라 네이티브 `settings.local.json`을 사용하며 MCP·플러그인 이외의 키를 보존한다. OpenCode의 Orca 전용 설정·단일 서버 조건은 유지한다.

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
| D1 | 두 하네스의 시작 기본값은 nav 전역 확장 설정 — 사용자 1 | ACTIVE — 적용 시점은 D15 |
| D2 | 제품의 SDK 연동으로 해당 세션에만 적용 가능한 항목은 세션 오버라이드와 우측 패널 on/off 제공 — 사용자 2 | SUPERSEDED → D16 |
| D3 | 세션 제어 미지원이면 우측 패널에 on/off를 렌더링하지 않고 실제 상태만 관측 — 사용자 3 | SUPERSEDED → D16 |
| D4 | 전역 on/off도 하네스 외부 실행 설정과 분리된 Orca 전용 설정·실행 적용을 보장할 때만 제공 — 사용자 4. 이전 초안은 미지원 시 토글 숨김으로 해석 | SUPERSEDED → D10·D11 |
| D5 | 대상은 스킬·네이티브 플러그인·MCP. 엔진 이름만으로 제어 가능 여부를 일괄 판정하지 않음 — 사용자 2·4의 조건을 항목별로 적용 | ACTIVE |
| D6 | 세션 변경을 다른 세션·전역 기본값·외부 하네스 설정에 전파하지 않음 — 사용자 2·4의 격리 의미 | SUPERSEDED → D16·D20 |
| D7 | 작업폴더에 설정 파일을 생성하지 않고 Orca 설정 영역을 사용. OpenCode 단일 서버·작업폴더별 인스턴스·native 초기화 흐름 유지 — 앞선 사용자 요구 | ACTIVE — Claude 프로젝트 파일 금지는 D20으로 대체 |
| D8 | Composer 팝업 안내 금지와 nav 스킬 색상 '현상태 유지' — 앞선 사용자 결정 | SUPERSEDED → D11·D12 |
| D9 | MCP 목록·실행 관측은 0277의 R1–R11을 유지하며 활성화 정책과 구별 — 앞선 사용자 범위 선언 | ACTIVE |
| D10 | Orca 전용 설정·실행 적용을 격리할 수 있는 항목만 전역에서 조작 가능. 외부 하네스가 off여도 Orca에서 활성화 가능하면 조작 가능한 토글 제공 — 사용자 추가 요구 1 | ACTIVE — Claude 프로젝트 제어의 네이티브 파일 공유는 D20 예외 |
| D11 | nav 스킬/MCP에서 제어 가능하면 일반 폰트·조작 가능한 토글, 불가능하면 회색 폰트·고정 토글. on/off 값은 그대로 표시하며 색상과 제어 가능성을 on/off에 종속시키지 않음 — 사용자 추가 요구 1 | ACTIVE |
| D12 | Composer 팝업에 로딩·실패 등 안내를 표시하지 않음 — D8의 변경되지 않은 부분 승계 | ACTIVE |
| D13 | 전역 on/off 변경은 새 세션의 시작 기본값에만 적용. 기존 세션에 소급 전파하지 않음 — U1 사용자 답변 | SUPERSEDED → D15 |
| D14 | `.claude/settings.local.json`을 생성·수정하여 확장 on/off를 영속화하지 않음. Orca 제품 코드의 SDK·runtime 주입으로만 실행에 반영 — 사용자 추가 요구 2 | SUPERSEDED → D20 |
| D15 | 전역 조작은 아직 실행되지 않은 인스턴스의 기본값. 실행 중인 인스턴스에는 정책상 자원 회수 후 재생성 또는 프로그램 재시작 시 적용 — 후속 사용자 1 | ACTIVE |
| D16 | Claude·OpenCode 모두 세션별 제어를 제공하지 않고 MCP·네이티브 플러그인을 프로젝트(현재 작업경로) 단위로 제어. 같은 경로의 세션에 공유, 다른 경로·전역과 격리 — 후속 사용자 | ACTIVE — 외부 Claude와의 파일 공유는 D20 |
| D17 | 우측 패널 타이틀의 작업경로 표시가 범위를 설명하므로 별도 범위 안내를 추가하지 않음 — 후속 사용자 | ACTIVE |
| D18 | 제거 가능하면 settings.local.json 쓰기 경로 제거, 추가 결정이 필요한 상황 보고 — 이번 사용자 | SUPERSEDED → D20. 기존 파일 삭제는 승인 내용 아님 |
| D19 | 프로젝트 MCP·plugin 선택은 Orca 설정 JSON에 유지. DB는 사용하지 않고 저장 형식은 제안 — 이번 사용자 답변 | ACTIVE — Claude 저장 위치는 D20으로 대체. OpenCode 형식 미확정 |
| D20 | Claude는 `settings.local.json` 사용. MCP·플러그인 키만 편집 허용하며 Orca에도 동기화 — 사용자 정정 답변 | ACTIVE. 해당 파일을 읽는 외부 Claude와의 프로젝트 설정 공유를 허용 |
| U1 | 전역 변경의 기존 세션 적용 여부 | SUPERSEDED → D13 |
| U2 | 세션 오버라이드의 앱 재시작·이력 재개·fork 승계 규칙 | SUPERSEDED → D16·U3 |
| U3 | 프로젝트 선택을 Orca 전용 저장소에 보존할지 앱 실행 중에만 유지할지 | SUPERSEDED → D19 |
| U6 | Orca JSON의 프로젝트 선택 저장 형식 | Claude 제안은 SUPERSEDED → D20. OpenCode 형식은 OPEN |
| U7 | 일반 MCP on/off의 네이티브 저장 위치인 `~/.claude.json` 프로젝트 MCP 상태도 허용할지 | SUPERSEDED → D21 |
| D21 | SDK 네이티브 MCP 저장 허용. 외부 프로젝트 변경은 화면 즉시·프로젝트 유휴 때 실행 적용, 재시작은 기존 자원 회수 정책 — 사용자 구현 지시 | ACTIVE — 0279 D7·D8로 구현 |

갱신 메모: D2·D3·D6→D16, D13→D15, U2→D16·U3으로 대체했다. D4→D10·D11, D8→D11·D12의 이력은 유지한다. 0277의 실행 상태 관측 범위 UI는 별도이며, 본 문서의 기존 AC·V·기술 초안은 아래 후속 설계 정정으로 대체한다.

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

## 4. 현재 코드와 정책 차이

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
| nav 전역 on/off 변경 | 기본값 저장. 실행 중 인스턴스에는 소급하지 않음 |
| 인스턴스가 없는 경로 시작 | 최신 전역 기본값과 명시 프로젝트 선택으로 구성 |
| 기존 인스턴스에 새 세션 추가 | 해당 프로젝트의 실행 구성 공유 |
| 우측 패널 MCP·plugin 변경 | 같은 엔진·작업경로의 실행 세션에 적용하고 실제 결과 통지 |
| 다른 작업경로 | 제어값을 전파하지 않음 |
| 정책상 자원 회수 후 인스턴스 재생성 / 앱 재시작 | 최신 기본값과 명시 프로젝트 선택 적용. Claude 저장은 D20·D21, OpenCode 형식은 U6 |

| 위치 / 제어 능력 | 토글 | 폰트·상태 |
|---|---|---|
| nav 제어 가능 | on/off 조작 가능 | 일반 폰트 |
| nav 제어 불가 | 실제 on/off를 유지한 고정 토글 | 회색 폰트 |
| 우측 패널 프로젝트 제어 가능 | 프로젝트 전체 on/off | 실제 상태. 타이틀의 경로가 범위를 설명 |
| 우측 패널 프로젝트 제어 불가 | 토글 없음 | 모니터링 |

on/off는 로드·연결 성공과 별개다. 실패한 변경을 성공으로 표시하지 않으며 부분 실패는 확인된 실제 상태로 보고한다. Composer 팝업에는 안내 문구·스피너를 추가하지 않는다.

## 6. 범위와 구현 분리

공통 정책은 전역 기본값, 현재 경로의 MCP·native plugin 제어, 항목별 제어 능력이다. Claude 프로젝트 설정 공유는 D20의 예외이며 스킬의 전역 제어·표시 규칙은 유지한다. MCP 관측은 [0277](../0277-opencode-mcp-catalog/plan.md)에서 수행한다.

Claude 파일 쓰기 제거와 Orca JSON 대체 제안은 철회한다. [0279](../0279-claude-project-plugin-state/plan.md)는 제한된 네이티브 키 편집과 Orca 동기화를 설계한다. 기존 외부 파일 자동 삭제·자동 이관, OpenCode 커스텀 엔진 수정·V2 임베디드 도입은 승인 내용이 아니다.

## 7. Requirements / Acceptance 초안

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

ACTIVE 결정 ↔ AC 대조: D1·D15→AC1, D5→AC4·AC6, D7→AC7, D9→AC9, D10·D11→AC3·AC6, D12·D17→AC8, D16→AC2·AC3·AC4, D20→AC5. OpenCode D19·U6는 확정 뒤 기술 설계에 반영한다. Claude D21은 0279에서 구현한다.

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

공통 작업의 전수 자리·oracle은 아직 미잠금이므로 DRAFT다. Claude의 제한 편집·동기화는 0279에서 구체화한다.

## 11. 남은 결정과 기술 검증

| ID | 분류 | 항목 |
|---|---|---|
| U6 | 사용자 결정 | OpenCode Orca JSON 저장 형식 미확정. Claude에 제안한 저장 형식은 D20으로 철회 |
| U7 | 결정 완료 — D21 | SDK native 프로젝트 MCP 상태 저장 허용. 0279에 반영 |
| U4 | 사용자 결정 | 프로젝트 선택을 전역 기본값으로 되돌리는 조작 위치·방식 |
| U5 | 사용자 결정 | 재초기화가 필요한 프로젝트 제어를 즉시 실행할지 유휴·자원 회수까지 보류할지 |
| T1 | 기술 검증 | OpenCode 실행 중 서버를 유지하면서 새 directory에 최신 기본값 전달 |
| T2 | 기술 검증 | 각 MCP/plugin의 프로젝트 제어 API·reload 효과·부분 실패 |
| T3 | 기술 검증 | 스킬 off가 모델 사용·명시 slash dispatch에 미치는 범위 |
| T4 | 기술 검증 | capability·목록 상태·실행 상태의 출처·세대 정합성 |

## 12. 검증·운영 gate

정책 기록 자체는 `git diff --check`·상대 링크·dispatch 정합성을 검사한다. 코드 구현에서는 subtree 지침에 따른 lint·typecheck·관련 Vitest와 변경 경로의 파일 불변·프로젝트 공유 검증을 수행한다.

## [구현자 기입]

공통 정책 전체는 미구현이다. Claude 파일 쓰기 제거는 실행 전에 취소했으며 프로덕션 코드는 변경하지 않았다. 기존 plugin 제한 편집·후속 실행·프로젝트 peer 공유 관련 테스트의 기준선은 확인했다. MCP 저장 범위와 외부 편집의 실행 중 반영은 아직 완료로 판정하지 않는다.
