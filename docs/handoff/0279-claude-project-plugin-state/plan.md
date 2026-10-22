# Claude 프로젝트 확장 설정의 제한 편집과 동기화

## 메타

| 항목 | 값 |
|---|---|
| 상태 | READY — SDK MCP 저장 허용·외부 변경 즉시 표시·프로젝트 유휴 적용 확정 |
| 작성자 / 일자 | Codex / 2026-10-22 |
| V mode / 기준 / revision | Baseline V / 없음 / V1 |
| 정책 정본 | [0278](../0278-harness-extension-isolation/plan.md) |

# Part I — Product & UX Contract

## 1. 목표

Claude 프로젝트의 MCP·네이티브 플러그인 선택을 네이티브 설정과 Orca에 일치시킨다. 사용자가 허용한 MCP·플러그인 키만 편집하며 그 밖의 설정은 보존한다. 같은 현재 작업경로의 세션은 선택을 공유한다.

## 2. 사용자 요구와 변경 이력

> 제거 가능하다면 제거하라. 또 결정이 필요한 상황에 대해 정리하라.
>
> orca 저장소에 유지하되, db가 아닌 orcinus orcs 세팅 json에 저장. 저장 방식은 제안
>
> 정정하겠다. Claude의 경우 Settings.local.json 사용으로 정정하겠다. 단 mcp/플러드인 키에 대해서만 편집 허용하며, orcinus orca에서도 동기화돼야 한다.

마지막 답변이 Claude의 파일 제거·Orca JSON 대체 초안을 명시적으로 바꿨다. 이전 초안은 READY가 아니었으며 구현·데이터 이관을 실행하지 않았다. 이전 AC·V 초안은 아래 계약으로 대체하며 승계할 검증 완료 증거는 없다.

## 3. Decision Ledger

| ID | 결정 / 출처 | 상태 |
|---|---|---|
| D1 | 외부 settings.local.json 쓰기 제거. 기존 파일 자동 삭제·이관 없음 — 이전 제거 요청 | SUPERSEDED → D5 |
| D2 | 같은 현재 작업경로의 Claude 실행들이 선택 공유. 다른 경로·엔진은 분리 — 0278 D16 | ACTIVE |
| D3 | 프로젝트 선택을 Orca 설정 JSON에 유지, DB 사용 금지 — 이전 답변 | SUPERSEDED → D5 |
| D4 | 우측 패널 기존 경로 표시 사용, 안내 문구·Composer 상태 안내 추가 없음 — 0278 D12·D17 | ACTIVE |
| U1 | Orca JSON의 projectExtensions 저장 형식 제안 | SUPERSEDED → D5. 미승인 제안이므로 구현하지 않음 |
| D5 | Claude는 settings.local.json 사용. MCP·플러그인 키만 편집하고 Orca에도 동기화 — 최신 답변 | ACTIVE |
| D6 | 전역 변경은 새 인스턴스 생성 시 기본값. 실행 중인 인스턴스는 자원 회수·재생성 또는 앱 재시작 시 반영 — 0278 D15 | ACTIVE |
| U2 | 일반 MCP on/off를 보관하는 네이티브 ~/.claude.json 프로젝트 MCP 상태도 허용할지 | SUPERSEDED → D7 |
| D7 | SDK의 네이티브 MCP 상태 저장 허용 — 사용자 구현 지시 | ACTIVE |
| D8 | 외부 프로젝트 설정은 화면에 즉시 반영하고 실행 구성은 해당 프로젝트 유휴 때 적용. 재시작 필요 시 기존 자원 회수 정책 준수 — 사용자 구현 지시 | ACTIVE |

D5는 해당 파일을 읽는 외부 Claude와의 프로젝트 설정 공유를 허용한다. 다른 설정을 임의로 수정하거나 OpenCode의 저장 정책을 바꾸는 승인은 아니다.

## 4. 이미 되는 동작과 차이

| 경계 | 현재 코드에서 확인한 사실 | 필요한 판단·보완 |
|---|---|---|
| plugin 저장 | `plugin-state.ts`는 `enabledPlugins[원래 key]`만 병합하고 다른 키·형제 plugin·파일 모드 보존. 임시 파일 rename 사용 | 유지. 범용 settings patch API로 넓히지 않음 |
| 적용·실패 | `native-resources.ts`가 SDK flag 적용→reload→실제 목록 확인 뒤 저장. 실패 시 기존 flag 복원 시도 | 저장 성공과 로드 성공을 구분하는 기존 경로 유지 |
| 후속 실행 | `plugin-catalog.ts`와 adapter가 local 선택을 읽고 SDK inline plugin flag로 전달 | 새 실행·재개는 기존 테스트로 확인. 외부 편집 후 실행 중 flag는 별도 |
| 같은 프로젝트 실행 | `shareNativeResource`가 peer generation·capability 확인 후 적용하고 실제 결과 발행 | 파일 저장만으로 동기화가 완료됐다고 보지 않음 |
| 공유 범위 | `createNativeResourceSharing`은 project_id가 있으면 ID, 없으면 harness project root 사용 | 같은 실제 경로의 다른 ID가 분리되거나 같은 Git root의 다른 경로가 묶일 수 있음. D2에 맞춰 보완 필요 |
| local 파일 위치 | Orca plugin reader/writer는 항상 상위 Git root 사용 | 현재 Claude 공식 문서는 Windows의 primary cwd 예외를 명시. 설치된 SDK runtime과 대조해 reader/writer/scope를 일치시킬 것 |
| 외부 파일 변경 | catalog는 매번 새로 읽지만 실행 중 SDK flag는 초기/토글 시 값 유지 | 외부 편집 감지와 실제 reload 경로가 필요. 단순 목록 재조회로 적용 성공을 꾸미지 않음 |
| MCP SDK toggle | `toggleMcpServer(false)`가 격리 fixture의 native config에 `disabledMcpServers` 저장. SDK 새 실행에서도 disabled 유지 | SDK 호출 자체가 settings.local 밖에 상태 저장. 별도 Orca writer가 없다고 파일 쓰기도 없는 것은 아님 |

## 5. 허용 키와 MCP 의미

| 파일 / 키 | 의미 | 처리 |
|---|---|---|
| .claude/settings.local.json / enabledPlugins | plugin 활성 선택 | 현재 writer 유지, 원래 marketplace 식별자 보존 |
| 같은 파일 / enabledMcpjsonServers·disabledMcpjsonServers | 프로젝트 .mcp.json 서버 승인·거부 | 일반 MCP 연결 on/off와 혼용 금지 |
| 같은 파일 / enableAllProjectMcpServers | 프로젝트 MCP 일괄 승인 | 개별 toggle을 위해 임의로 켜지 않음 |
| ~/.claude.json / projects의 MCP 활성 상태 | 일반·plugin MCP 등의 opt-out 및 기본 off 내장 MCP opt-in | SDK toggle의 네이티브 저장 허용. 별도 Orca JSON writer 추가 없음 |
| permissions·hooks·env·model 및 나머지 키 | 이번 제어 범위 밖 | 값 보존. 삭제·초기화·추가 권한 저장 금지 |

공식 MCP 규약에서 일반 MCP의 `disabledMcpServers`·`enabledMcpServers`와 .mcp.json 승인 목록은 별개다. 허용되지 않는 키를 settings.local에 만들어 동작하는 것으로 표시하면 안 된다.

## 6. 동작 계약 / Acceptance 초안

| AC | 관측 가능한 결과 | 검증 경로 |
|---|---|---|
| AC1 | plugin 변경 후 해당 파일의 대상 키와 실제 SDK 목록이 일치하고 비대상 설정은 유지 | 패널→IPC→adapter→SDK reload→file read-back |
| AC2 | 같은 현재 작업경로의 세션에 선택이 공유되며 다른 경로·하네스는 영향 없음 | 서로 다른 project_id / Git 하위 경로 / 정규화 경로 fixture |
| AC3 | 새 실행·이력 재개·앱 재시작 후 명시 선택이 다시 적용 | file→catalog→SDK options, 실제 runtime 대조 |
| AC4 | 외부 프로젝트 변경은 즉시 표시하고 프로젝트 전체 유휴 때 실행에 반영. restart-required는 기존 수명까지 대기 | 파일 변경→읽기·표시→busy 보류→idle 적용→실제 상태 |
| AC5 | 파일 오류·적용 실패·peer 부분 실패를 성공으로 표시하지 않음 | 손상 파일·reload 실패·peer 교체·stale 응답 |
| AC6 | MCP 승인 설정과 실행 on/off를 구분하고 SDK 네이티브 저장 사용 | source별 toggle·설정/실행 상태 구분 |
| AC7 | 기존 경로 타이틀·Composer 안내 금지 유지 | UI 회귀 및 설정 변경 이벤트 |

전역 기본값 변경은 실행 중 runtime에 소급하지 않는다. 프로젝트 파일의 MCP/plugin 선택은 D8을 따른다. 변경 대기 중 토글은 설정 선택을, 상태는 마지막 실제 관측을 표시한다. 새로운 팝업 안내는 만들지 않는다.

# Part II — Technical Design

## 7. 경계와 구현 방향

- 파일 patch는 허용된 항목만 read/merge/write한다. 기존 파일을 없애거나 Orca JSON에 같은 선택을 중복 저장하지 않는다.
- 프로젝트 경로 해석은 reader·writer·runtime 공유에 같은 기준을 적용한다. Windows 실제 SDK 위치를 확인하며 project_id로 물리 경로를 대체하지 않는다.
- 설정의 희망 상태와 실제 SDK 로드·연결 상태를 구분한다. read-only catalog 조회가 대화 재시작이나 서버 생성을 유발해서는 안 된다.
- 파일 변경과 Orca 변경의 중복 이벤트·자기 쓰기 루프·부분 실패를 처리한다. 기존 generation 검사·project mutation 직렬화를 재사용할 수 있는지 조사한다.
- 실제 MCP 저장 범위는 U2 이후 결정하며 SDK control의 persistence는 격리된 fixture로 검증한다. 사용자 실제 설정 파일로 실험하지 않는다.

## 8. V / 강제 지점

이전 제거 초안의 AC1–AC6·VP1–VP4·EP1–EP9는 SUPERSEDED다. 미승인 데이터 포맷을 전제로 한 초안이므로 채택하지 않는다. 새로운 R↔AT·SD↔ST·AR↔IT·MD↔UT pair는 AC1–AC7과 확인된 SDK 동작을 기준으로 확정한다.

조사 대상은 plugin-state, plugin-catalog, configured-resources, adapter SDK 주입, native-resources, project 공유, IPC 직렬화·발행 경계다. 자리 전수·직접 oracle이 아직 미잠금이므로 구현을 시작하지 않는다.

## 9. 이번 기준선 확인

프로덕션 코드 변경 없이 기존 테스트를 실행했다.

- `plugin-state.test.ts`: 다른 설정·형제 plugin 보존, 손상 JSON 거부.
- `adapter.native-plugins.test.ts`: on/off의 후속 턴·새 adapter·cold resume 복원 및 provider 기본값 대조.
- `native-resources.test.ts`: 검증된 reload 이후 저장, 저장 실패 시 이전 flags·commands 복원.
- `native-resource-sharing.test.ts`, `session-resources.test.ts`: peer 적용·부분 실패·generation 검사·요청 직렬화.
- `plugin-catalog.test.ts`: 설정 우선순위와 선택.
- 위 테스트 실행: 6파일 39개 통과. 이것은 기존 경로의 기준선이며 AC2의 경로 정정·AC4 외부 편집·AC6 전체 MCP 영속화 완료 증거가 아니다.

추가 실제 SDK 관측: [MCP 저장 위치와 승인/활성 구분](evidence/mcp-storage.md). 사용자 후속 질문은 “승인/거부 자체로 on/off를 표시할 수 있지 않은가”이며 U2 허용 답변으로 해석하지 않는다. 프로젝트 `.mcp.json` 서버의 설정 선택으로는 사용할 수 있지만, 모든 MCP 출처의 실행 활성 상태를 대체하지 못한다.

## 10. 운영 gate / 남은 결정

정책 문서 변경: `git diff --check`, 변경 링크·INDEX 정합성. 프로덕션 구현 착수 후에는 app 가이드의 typecheck·lint·관련 테스트와 파일 보존·runtime 반영 검증을 수행한다.

현재 필요한 사용자 결정은 U2다. 외부 파일 감지의 구현 방식·SDK 저장 효과·Windows 파일 위치는 기술 조사로 먼저 닫는다. 새 저장 형식을 사용자 모르게 도입하지 않는다.

## 11. 외부 근거

- [Claude MCP — Disable a server without removing it](https://code.claude.com/docs/en/mcp#disable-a-server-without-removing-it): 일반 on/off의 프로젝트 상태 파일과 .mcp.json 승인 키의 구분.
- [Claude settings — local file location](https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository): Windows·primary cwd 예외와 SDK resolveSettings 위치.
- 설치된 `@anthropic-ai/claude-agent-sdk/sdk.d.ts`: Settings의 승인 키, Query의 toggleMcpServer·applyFlagSettings·reloadPlugins 계약.

## [구현자 기입]

파일 제거·Orca JSON 대체는 취소했고 프로덕션 코드를 변경하지 않았다. 최신 정책에 맞춰 기존 plugin 제한 편집을 유지한다. MCP SDK의 실제 저장 효과는 격리 환경에서 확인했으며, 저장 허용 범위와 동기화 누락은 해결 전이다.

## 12. 확정 기술 설계 / V1

사용자 최종 지시:
> 제안대로 구현하라. SDK의 네이티브 MCP 상태 저장을 허용한다. 외부 프로젝트 설정 변경은 화면에 즉시 반영하고, 실행 구성은 해당 프로젝트가 유휴 상태일 때 적용하라. 재시작이 필요하면 기존 자원 회수 정책을 따르도록 하라.

§7–8의 조사 후보를 다음 설계로 확정한다. §9는 기존 기준선으로만 사용한다. §10의 U2 확인 대기는 D7로 종료한다.

- Claude project-settings 모듈은 작업경로의 settings.json/settings.local.json/.mcp.json과 native config의 해당 프로젝트 MCP 상태만 fingerprint한다. 전역 기본값·다른 프로젝트·permissions 등 비대상 변경은 실행 갱신을 유발하지 않는다. Windows local settings는 실제 cwd, native MCP projects 키는 SDK의 Git 프로젝트 범위도 읽는다.
- Main은 실제 runtime과 renderer 관측 owner가 필요한 경로만 감시한다. 파일 생성/삭제/원자 rename을 감지하는 watchFile을 공유하고 owner 해제·window 종료·앱 종료에서 정리한다. 파일 감지는 짧은 병합 후 metadata를 재조회하며 SDK 조회마다 서버를 새로 만들지 않는다.
- NativeResources의 설정 선택과 실제 status를 분리한다. 변경 이벤트는 같은 session 또는 draft scope만 갱신한다. renderer가 버린 읽기 결과가 새 push 결과를 덮지 않게 기존 세대 검사를 유지한다.
- 유휴 판정은 같은 backend/cwd의 모든 runtime에 대해 응답·입력 큐·승인/준비·잔여 제출·백그라운드 작업·pending wakeup을 확인한다. 적용 중 새 제출은 runtime의 짧은 구성 적용 promise 뒤에서 실행하며 SDK 호출 직전에도 유휴·세대·파일 revision을 재확인한다.
- 기존 on/off는 SDK로 반영하고 외부 파일을 역으로 저장하지 않는다(plugin flag는 reload 확인 후 내부 관측 갱신). MCP toggle의 native 저장은 허용한다. 서버 정의·plugin membership처럼 hot apply로 보장하지 못하는 변경은 restart-required로 남겨 기존 LRU/종료 후 다음 spawn에 읽는다. 강제 discard·대화 중단·새 서버 생성 없음.
- 수동 제어와 외부 재적용은 프로젝트 직렬화 경계를 공유한다. 자기 저장 이벤트는 revision·현재 관측을 대조해 중복 reload하지 않는다. 손상 파일·부분 실패는 기존 정상 상태를 보존하고 실패로 표시한다.
- 동기화 대상 plugin on/off의 writer/readers는 같은 Windows cwd를 사용한다. MCP의 native 저장 범위는 SDK가 정하며 같은 Git root의 프로젝트 상태 변경은 관련 경로의 watcher가 각각 재평가한다.

### V nodes / pairs

| Pair | 노드·수준 | Requiredness / AC | 경로 / 직접 oracle |
|---|---|---|---|
| VP1 | R1–R3 ↔ AT1 (NEW) | REQUIRED / AC1·2·3·4·6 | 실제 파일→observer→idle adapter→SDK. project-resource-sync.test.ts: external change visible while busy, applied when project idle; 기존 adapter.native-plugins.test.ts 영속 복원 |
| VP2 | SD1 ↔ ST1 (NEW) | REQUIRED / AC4·5·7 | owner 등록→변경→UI push→전환·해제. session-resources.test.ts observation acquire/release; useNativeResources.test.ts scoped configuration push |
| VP3 | AR1 ↔ IT1 (NEW) | REQUIRED / AC2·4·5 | bootstrap→snapshot/watch→supervisor runtime/lease→resource mutation. project-resource-sync.test.ts actual watcher lifecycle + runtime replacement; bootstrap integration fixture |
| VP4 | MD1 ↔ UT1 (NEW) | REQUIRED / AC1·4·6 | project-settings parse→revision/desired→adapter reconciliation. project-settings.test.ts selective revisions; native-resources.test.ts idle external apply with no plugin persistence; session-runtime test concurrent send waits |
| VP5 | 기존 저장·제어 ↔ 회귀 (INHERITED, 같은 브랜치 코드 기준) | REGRESSION / AC1·3·5·7 | plugin-state·adapter.native-plugins·native-resource-sharing·session-resources·renderer nativeResourceState 기존 케이스 |

### §10 강제 지점 확정

| EP | 언제 강제 / 자리 | 실패 의미 / oracle |
|---|---|---|
| EP1 | Claude project settings reader·plugin reader·writer·configured reader (4) | 다른 경로/다른 키를 읽거나 덮음 / project-settings·plugin-state·configured-resources tests |
| EP2 | Native sharing scope (1) | project_id로 물리 경로를 잘못 묶음 / native-resource-sharing tests |
| EP3 | observer 파일 변경·owner 수명·revision 처리·idle 적용 (4) | busy 적용·지각 덮어쓰기·watch 누수 / project-resource-sync tests |
| EP4 | adapter reconcile·resource SDK mutation·SessionRuntime forwarding/submission (3) | persist loop·busy 호출·다음 제출 경합 / adapter/native-resources/session-runtime tests |
| EP5 | bootstrap 관측기 생성·종료·activity/runtime 전달 (3) | 실제 앱에서 감시/유휴 판정 누락 / bootstrap integration test |
| EP6 | IPC observation 등록/해제·read overlay·수동 mutation 직렬화 (3) | 화면 상태 불일치·중복 적용 / session-resources tests |
| EP7 | preload/API transport·renderer owner·session/draft push·nav catalog (4) | owner 해제 누락·다른 프로젝트 덮음 / preload contract·renderer nativeResources/catalog tests |

자리 검색: `rg -n 'nativeResources|NativeResourcesChanged|setNativeResource|configuredResources|nativeResourceScope' app/src/main/app app/src/main/adapters/claude app/src/main/features/sessions app/src/preload app/src/renderer/src/features/chat app/src/renderer/src/features/skills`. 변경한 각 경계는 위 oracle의 입력/출력 사이에 실제 구현을 배치한다. 선택 변이는 EP5 observer 등록 no-op 한 자리이며 bootstrap test가 무감시를 검출하는지 확인한다. 나머지는 직접 행동 oracle로 not selected.

### 운영 gate와 정합성

관련 Vitest, typecheck, lint, build, doc inventory/prose, 변경 링크 및 diff 검사. 기존 upstream 참조 checkout의 broken links는 이번 변경과 분리한다. 구현 commit과 이 설계 commit을 분리한다.

ACTIVE↔AC: D2→AC2, D4→AC7, D5→AC1·3, D6→AC4의 전역 비소급, D7→AC6, D8→AC4·5. 충돌 0. 새로운 UI 장식·스피너·설명문은 없으며 기존 토글/상태 소비 경로를 사용한다.
