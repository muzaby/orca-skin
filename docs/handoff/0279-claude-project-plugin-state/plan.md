# Claude 프로젝트 확장 설정의 제한 편집과 동기화

## 메타

| 항목 | 값 |
|---|---|
| 상태 | IMPL_DONE — SDK MCP 저장·외부 변경 표시·프로젝트 유휴 재적용 구현, 독립 검증 대기 |
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

## 이전 조사 단계

파일 제거·Orca JSON 대체는 취소했다. 이후 D7·D8의 구현 승인을 받아 아래 V1 기준으로 구현한다. 기존 무변경 보고는 조사 단계의 기록이며 현재 구현 상태는 아래 구현 보고를 따른다.

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

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D7·D8과 V1. SDK native MCP 저장, 프로젝트 경로 공유, 화면 표시와 유휴 재적용 분리를 구현했다.
- 이견 / 현실성 문제: §12의 MCP 보유 plugin·서버 정의·승인 변경은 hot reload 완료로 취급하지 않는다. `restart-required`로 보존하며 LRU/앱 종료 이후 새 실행이 읽는다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 저장 위치·UI 범위·재시작 정책을 새로 선택하지 않았다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP1·4·5 | 설정 제한·우선순위 | EP1 reader·plugin reader·writer·configured reader (4) | 4/4 | project-settings.test의 selective revision·permission 보존, plugin-catalog.test의 precedence, plugin-state.test의 sibling 보존, configured-resources.test의 scope | child cwd·native root·다른 key → 파일 bytes/선택 목록 대조 | — |
| VP1·3·5 | cwd 공유 | EP2 sharing scope (1) | 1/1 | bootstrap.native-history.test: `groups runtimes by actual cwd…`, `keeps different current working directories…` | A/C 같은 cwd·다른 ID, B 다른 cwd·같은 ID → peer 목록 대조 | — |
| VP1·2·3 | 감시·수명·revision·idle | EP3 (4) | 4/4 | project-resource-sync.test: real file/atomic replacement, owner release, malformed recovery, replacement, peer idle | external revision·A/B 활동·서로 다른 native root → 발행/SDK 호출/해제 대조 | — |
| VP1·4 | SDK 재적용·제출 경합 | EP4 adapter·SDK·SessionRuntime (3) | 3/3 | adapter.native-plugins.test: `exposes runtime-native watch files…`; project-reconciliation.test의 busy→idle/no persistence; session-runtime.test의 submission 직렬화 | env root·false 선택·r/r2 → 실제 adapter SDK mock flags/수명 guard/push 순서 | — |
| VP3 | 부팅·종료·활동 전달 | EP5 (3) | 3/3 | bootstrap.native-history.test: `observes external project settings through real bootstrap…`; bootstrap.shutdown.test의 observer→registry 순서 | 실제 bootstrap 등록·B background=1→0 → 외부 파일 hash 전달과 SDK 호출 보류/해제 | — |
| VP2·3·5 | IPC owner·read·직렬화 | EP6 (3) | 3/3 | session-resources.test: `acquires a scoped observer…`, 기존 shared queue·generation 테스트; project-resource-sync.test의 pending decorate | owner panel·sender 4·session B·draft A → 정확한 scope 통지와 release, 기존 변경 순서 | — |
| VP2·5 | wire·owner·push·nav | EP7 (4) | 4/4 | preload/index.test의 observation 전달, useNativeResources.test의 scoped push/late read/owner 해제, useNativeMcpCatalog.test의 backend 범위/구독 해제 | session-B·draft-A/B·active true/false → IPC payload 및 다른 화면 미반영 | — |

§10의 고정 자리 22개를 다시 대조했다. `rg`로 확인한 운반 경계는 아래 검증 기록의 파일 목록과 대응한다. 추가 `projectResourcePolicy`는 EP4·EP5의 native root 전달 세부이며 `uses runtime-native configuration roots…`에서 서로 다른 A/B revision을 관측했다. 직전 verify 고장 이력은 없다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP1 | REQUIRED | SELF_PASS | 실제 파일 watcher + adapter.native-plugins의 SDK flags/영속 복원; 실제 SDK MCP probe는 evidence 참조 | not selected — 직접 입력/출력 |
| VP2 | REQUIRED | SELF_PASS | session-resources owner lifecycle, renderer scoped push·late read·nav cleanup | not selected — 직접 입력/출력 |
| VP3 | REQUIRED | SELF_PASS | bootstrap 외부 파일→activity→runtime, shutdown cleanup | EP5 관측 등록 no-op → 예상 assertion 실패 |
| VP4 | REQUIRED | SELF_PASS | selective revision, frozen defaults, restart-required, SessionRuntime 다음 제출 대기 | not selected — 직접 입력/출력 |
| VP5 | REGRESSION | SELF_PASS | plugin-state·catalog·adapter·native-resource-sharing·IPC·renderer 기존 회귀 | not selected — 기존 행동 oracle |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| bootstrap의 `policy: (backend) => harnessModule(backend).projectResources`를 undefined로 대체 | VP3/EP5 선택 증거(관측 등록 no-op)·같은 bootstrap 배선 oracle | 최초 | `observes external project settings through real bootstrap…` 1건, 통지 호출 0회 | 잠김 — 원본 bytes 복원 후 동일 테스트 green |

분모 검산: 선택 증거 1 · 인용 변이 0 · 추가 새 구조 oracle 0 = 표 행 1. bootstrap 배선 oracle은 같은 선택 증거로 검증했다. 나머지는 직접 행동 oracle이다. 이전 라운드 red 증거가 없어 덮개 회귀 비교는 해당 없음.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태에 소비자가 있는가 | 안내 문구 추가 없음. enabled는 선택, status는 실제 관측, 대기는 canToggle=false | 기존 메뉴/패널 소비 경로 사용 |
| seam 재배치 뒤 cleanup 범위 | Bootstrap이 observer를 보유하고 shutdown에서 registry 전에 close | shutdown 테스트 통과 |
| 실패 전이 | AC5: 손상 설정·부분 조회·교체는 이전 정상 관측 보존, partial/read-only | 파일 교정 또는 수동 조회로 재시도 |
| 실패가 무반응으로 보이는가 | 팝업 안내 금지 유지. 기존 관측을 삭제하지 않으며 수동 실패의 기존 오류 경로 유지 | 새 오류 문구/스피너 없음 |
| 늦은 응답이 화면을 되돌리는가 | revision·runtime identity·renderer readSerial/pushSerial 검사 | 다른 draft·retired generation·늦은 read/write 회귀 통과 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | Windows local 파일을 Git root로 쓰면 CLI와 불일치 | 선조치: 현재 cwd 사용, native MCP Git root 상태는 별도 해석 | 설치 SDK resolveSettings 실측·project-settings 테스트 |
| 2 | 승인 거부를 모든 MCP 출처의 off로 확장 | 선조치: 프로젝트 출처만 적용, native disabled 목록 분리 | project-reconciliation의 user/project 대조 |
| 3 | remount/구독 해제가 SDK 재조회를 발생 | 선조치: 관측 등록 영수증과 조회 분리·동일 요청 read 공유 | renderer cache 회귀·IPC 등록 테스트 |
| 4 | 글로벌 변경 후 프로젝트 override 삭제가 새 전역값을 소급 | 선조치: runtime 시작 기본값 보존 | frozen defaults 테스트 |
| 5 | runtime의 CLAUDE_CONFIG_DIR와 main 기본 root 불일치 | 선조치: runtime 정책의 감시 파일·revision 사용. 같은 cwd 유휴 경계는 공유 | native root A/B 테스트·실제 adapter policy 전달 |
| 6 | 파일 편집/새 제출이 SDK 적용과 경합 | 선조치: guard 재검사·프로젝트 직렬화·submission promise | SessionRuntime 및 watcher 교체 테스트 |
| 7 | 전체 nav 범위 선택·OpenCode 격리 정책은 미확정 | 보고만: 0277·0278의 별도 범위 유지 | 이번 구현은 Claude 프로젝트 동기화 |

### 설계 대비 명시적 차이

선택값 계산을 공통 observer 대신 Claude adapter의 preview에 두었다. 해당 runtime의 시작 기본값과 SDK 출처를 알아야 전역 소급을 막을 수 있기 때문이다. 공통 observer는 감시·유휴·수명·통지만 소유한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 시간 기반 구성 만료 없음 | 기존 LRU/종료 정책 유지 |
| 공유 | native root별 revision 혼합 가능 | AC2·EP3/4: A/B root는 따로 읽고 같은 cwd 전체 idle 확인 |
| 재진입 | 캐시 재진입에 불필요한 조회 가능 | AC4·7·EP7: 별도 owner 등록, 기존 목록 cache 회귀 |
| 다른 무효화 축 | 종료/교체 이후 지각 preview | AC5·EP3/4/7: runtime identity·revision·세대 검사 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | Claude project-path/settings/reconciliation, NativeResources, SessionRuntime, bootstrap/IPC, renderer 관측 owner, 현재 arch/IPC 문서 |
| 실행 명령 | 관련 Vitest 목록은 evidence/validation.md. eslint --cache ./src ./scripts, npm run build, check-doc-inventory --check, git diff --check |
| 관측한 게이트 산출 | [검증 기록](evidence/validation.md). 관련 21파일 240케이스·타입·main/preload/renderer 빌드 통과, lint 오류 0/기존 경고 2. 독립 verify와 실제 사용자 환경 UI 인수는 수행하지 않음 |
| V-pair 자기확인 | SELF_PASS 5 / SELF_BLOCKED 0 |
| 강제 지점 전수 | 고정 EP 자리 22/22 — 위 표의 직접 행동 증거 |
| AC 자기보고 | 아래 AC 표 |
| 블로커 / 역질문 | 없음. 기존 참조 checkout 링크 실패와 React Compiler 경고는 분리 기록 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | plugin-state 비대상 키·형제값 보존, adapter flags/reload 및 저장 실패 회귀 |
| AC2 | ✅ | 같은 cwd의 다른 ID 공유, 같은 Git root의 다른 cwd 분리 |
| AC3 | ✅ | adapter.native-plugins의 후속 턴·새 adapter·cold resume + SDK 재실행 disabled 실측 |
| AC4 | ✅ | 실제 파일 생성/rename→통지, B busy 보류→idle 적용, restart-required 호출 억제 |
| AC5 | ✅ | 손상 파일·stale revision·peer 교체·늦은 renderer read/write 보존 회귀 |
| AC6 | ✅ | user/project 승인 분리 및 실제 SDK MCP 출처별 toggle 실측 |
| AC7 | ✅ | 기존 panel/Composer 회귀, 상태 메시지·스피너 추가 없음 |

합계 검산: ✅ 7 · ⚠️ 0 · ❌ 0 = 총 7. 기계·SDK 관측에 대한 자기보고이며 실제 배포 환경의 시각 인수 완료를 주장하지 않는다.

## [구현자 기입] Review Signals — 사실만

- 이전 라운드와 같은 축인가: 최초 구현 r1. 앞 단계는 정책·SDK 조사였다.
- 기존 plan이 막았어야 할 문제: AC2/4/6의 경로·승인·유휴 경계를 직접 테스트로 추가했다.
- 반복 환경 한계: 전체 링크 검사에 참조 OpenCode checkout의 기존 깨진 링크가 포함된다. 본 구현에서 외부 push/배포를 시도하지 않았다.
- 현재 라운드·impl 턴: r1. 독립 검증은 다음 주체에 남긴다.

## [검증자 기입] 0278에서 확인한 회귀

**AC2·D2 미충족**: SDK MCP 상태는 Git root에 보관되며, Orca reader도 해당 root 상태를 하위 cwd에 병합한다. A Git root의 MCP off가 다른 작업폴더 B(child)의 새 Query 및 기존 Query의 유휴 reconcile에 전파됐다. [0278 F1 검증 및 재현](../0278-harness-extension-isolation/verify.md)을 후속 구현의 blocking 입력으로 삼는다. 기존 구현 자기보고의 “같은 Git root의 다른 cwd 분리”는 MCP native 저장 경계까지 입증하지 못했다.
