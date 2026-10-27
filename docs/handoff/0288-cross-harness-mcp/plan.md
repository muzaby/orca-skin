# Plan — 0288-cross-harness-mcp

## 메타

| 항목 | 값 |
|---|---|
| slug | `0288-cross-harness-mcp` |
| 작성자 | Codex — 사용자 지정 handoff-plan 수행 |
| 일자 / 라운드 | 2026-10-27 / r1 |
| 상태 | READY |
| V mode / 기준 V | Baseline V / none |
| 이번 revision / 유효 V | V1 / V1 |
| 설계 커밋 | (V1 설계 — 검증자 기입), 좌표 정본은 INDEX |
| 이번 턴 범위 | 계획 READY까지. 코드 구현·독립 검증은 후속 턴 |

# Part I — Product & UX Contract

## 1. Context / 목표

Orca에 등록한 내장 플러그인과 사용자 MCP를 OpenCode 세션에서 실제 호출하고 Composer에서 선택할 수 있게 한다. 등록·인증 소스는 한 벌로 유지하고, 하네스별 전달과 실제 연결 관측을 분리한다.

완료 기준은 **등록한 MCP가 현재 하네스에서 연결된 뒤 Composer에서 선택되고 모델의 실제 도구 호출이 원래 구현에 도달하는 것**이다. 현재 Claude 동작과 OpenCode native MCP는 회귀 범위다.

## 2. 사용자 의도 / 출처

> “내장 플러그인(=내장 mcp: confluence, jira, mail), nav->플러그인->mcp 탭에서 추가한 사용자 mcp가 opencode 세션에서 노출되지 읺고 있다. 구조적 구현, 노출로 다른 하네스의 composer에서 사용할 수 있도록 구현하라.”

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 내장 Confluence·Jira·Mail과 사용자 MCP를 OpenCode 세션·다른 하네스 Composer에서 사용 | 최초 사용자 메시지 |
| 명시 범위 | “계획 READY까지 작성” | 이번 턴 범위 질의 답변 |
| 명시 승인 | 공식 MCP SDK 직접 의존성과 OpenCode 자식 환경으로의 제한된 credential 전달 | 설계 초안 확인 후 “제안대로 확정” |
| 해석 | 현재 등록된 Claude·OpenCode를 구현하고 공통 계약으로 추가 하네스의 연결점을 제공 | `app/harnesses/registry.ts:mainHarnessModules` |
| 해석 경계 | 내장이라는 이름은 배포에 등록된 플러그인을 뜻함. 사내 서버 주소나 인증값을 생성하지 않음 | `deployment/plugins.ts:createPluginBindings`의 현재 빈 배열 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 |
|---|---|---|---|---|---|
| D-001 | 내장·사용자 MCP의 실제 실행과 Composer 노출을 함께 연결 | 목록만 추가하면 요구 미충족 | 사용자 원문 | ACTIVE | — |
| D-002 | 이번 턴은 계획 READY까지만 | 구현은 후속 handoff-impl | 사용자 답변 | ACTIVE | — |
| D-003 | 공식 `@modelcontextprotocol/sdk`를 직접 의존성으로 채택 | 프로토콜 수제 구현을 피함. 설치된 1.29.0을 정확히 고정, 별도 업그레이드는 범위 밖 | 사용자 승인 + 로컬 protocol probe | ACTIVE | — |
| D-004 | 사용자 MCP 실행 값·브리지 capability만 OpenCode 자식 환경으로 전달 | 내장 서비스 credential은 main에 유지. 새 평문 파일·argv·renderer·로그로 전달 금지 | 사용자 승인 | ACTIVE | — |
| D-005 | MCP 정의·인증·활성 상태는 기존 저장소가 정본 | 별도 하네스별 편집 사본을 만들지 않음 | 기존 McpStore·BoundAuth 계약 유지 | ACTIVE | — |
| D-006 | 진행 중 턴은 유지, 새 연결·다음 턴에 최신 설정 적용 | 인증 철회는 내장 새 호출에 즉시 적용. 전체 서버 강제 종료 금지 | 현재 공유 lease·턴 경계에서 도출한 설계 결정 | ACTIVE | — |
| D-007 | Composer의 MCP 능력과 스킬 능력을 분리 | OpenCode Orca 스킬·Claude full-plugin 변환은 요구 밖 | 사용자 요구의 MCP 범위 + 현재 스킬 계약 | ACTIVE | — |
| D-008 | 실행 가능한 전달 경로를 사용 가능 후보의 근거로 삼음 | OpenCode·외부 MCP는 실제 연결 확인. Claude 내장 in-process는 기존 valid binding 가용성 유지 | 현재 native 후보·Claude binding 계약 | ACTIVE | — |
| D-009 | 현재 하네스의 승인 정책 유지 | MCP 노출을 이유로 도구 전역 자동 승인·OQ9 기본값을 새로 정하지 않음 | PRD §11·기존 코드 | ACTIVE | — |
| D-010 | 공통 표준 전달, 구현은 하네스별 경계에 둠 | feature 교차 import·공통에서 구체 하네스 선택 금지 | main/renderer AGENTS | ACTIVE | — |

### 갱신 메모

신규 D-001~010, SUPERSEDED·OPEN 없음. D-003·004는 질문 전 OPEN에서 사용자 답변으로 ACTIVE가 됐다.

ACTIVE 결정 ↔ AC 대조: D-001→AC1~4, D-002→G0, D-003→AC16, D-004→AC7, D-005→AC2·12·15, D-006→AC5·6·10, D-007→AC4, D-008→AC3·11, D-009→AC13, D-010→AC14·16. 반대 의미를 요구하는 AC는 없다.

## 4. 요구 비판적 검토

| 질문 | 판정 | 관측 |
|---|---|---|
| 실제 누락인가 | 예 — source→OpenCode 전달 자체가 없음 | `enabledConfig()` production 호출 소비자는 Claude 배포뿐 |
| UI만 고치면 되는가 | 아니오 | `OpenCodeAdapter`·`channel`에 `runtimeTools` 소비 없음 |
| `includeExtensions`만 true로 하면 되는가 | 아니오 | 같은 값이 스킬·내장 후보·관리 메뉴까지 제어 |
| 기존 내장 서버를 재사용 가능한가 | 예 — handler·schema·annotations 재사용 | `RuntimeToolServer`, PluginBinding과 BoundAuth |
| registry 전체를 공개해도 되는가 | 아니오 | `artifacts/tool.ts`는 sessionId·cwd·extraDirs에 의존 |
| 기존 결정과 충돌하는가 | credential 예외 확장·직접 의존성만 승인받아 변경 | D-003·004. 저장·네트워크·하네스 소유권은 유지 |

코드 조사로 닫은 사실과 실행 가능성 실험은 §8에 있다. 사용자에게 남은 설계 결정은 없다.

## 5. 동작 / 사용자 흐름

```text
내장 플러그인 인증 / 플러그인 > MCP 추가·수정·활성화
 → 저장 완료 → 공통 source revision 갱신
 → Composer 준비 또는 다음 턴의 하네스 연결
 → 하네스가 확인한 연결 목록 → + 메뉴 / @ 후보 / 참조 강조
 → 사용자가 선택·전송 → 하네스 승인 정책 → 실제 도구 호출·결과
```

| 사건 | 적용 시점 | 사용자 관측 |
|---|---|---|
| 새 대화·프로젝트 전환 | 해당 실행 설정·cwd로 준비 | 연결 성공한 MCP가 Orca 그룹에 표시 |
| 진행 중 MCP 수정·삭제·비활성화 | 진행 중 턴 완료 후 다음 턴, 새 draft 준비는 최신 세대 | 기존 응답·초안 보존, 다음 요청은 새 목록 |
| 내장 인증 실패·로그아웃 | 새 호출 시 즉시 재검사, 진행 중 해당 호출 취소 신호 | 해당 항목은 후보에서 빠지고 인증 오류는 기존 오류 경로에 표시 |
| 단일 MCP 연결 실패 | 서버별 격리 | 나머지 MCP·채팅 사용 가능, 실패 원인은 마스킹해 오류 피드 제공 |
| 메뉴 재열기·탭 복귀 | 현재 generation 재조회 | 같은 세대의 부분 실패만 이전 관측 유지, 철회·세대 변경은 낡은 성공 폐기 |
| 앱 재시작 | 저장된 소스·인증 복원 후 새 준비 | 이전 포트·capability를 재사용하지 않음 |

목록에 상태 공·갱신 안내를 새로 추가하지 않는다. 기존 AttachMenu·MentionAutocomplete·입력 강조·오류 피드를 재사용하며, 선택은 토큰만 삽입하고 자동 전송하지 않는다.

Claude 내장 도구는 기존의 valid binding 기반 후보를 유지한다. 별도 프로세스의 연결을 확인해야 하는 OpenCode 내장·사용자 MCP와 달리, 이 경우는 in-process 실행 구현의 등록이 가용성 근거다.

## 6. 범위 / 비범위

| 범위 | 비범위 / 이유 |
|---|---|
| 등록된 Confluence·Jira·Mail의 표준 MCP 노출 | 실제 사내 서버·계정·배포 선언 생성 — 환경 정보 없음 |
| 사용자 stdio/http/sse MCP의 OpenCode 투영 | 사용자 원본 `opencode.json`·native plugin·OAuth 저장소 변경 |
| 공통 snapshot·MCP bridge·하네스 projection·가용 후보 | 새 하네스 구현, Orca 스킬/agents/hooks/full-plugin 이식 |
| 새 연결·warm 다음 턴·자동 연속 턴·동시 세션 | 실행 중 모든 세션 일괄 종료 |
| 기존 Claude·native MCP·인증·승인 회귀 | 세션 전용 Artifact 도구의 OpenCode 이식 — 별도 session-bound 실행 계약 필요 |

현재 빈 배포를 임의 서비스로 채우지 않는다. 테스트에서는 실제 세 플러그인 factory와 가짜 외부 응답을 조립하며, 사내 실환경 확인만 AC17로 분리한다.

## 7. Requirements / Acceptance — R ↔ AT

표의 O 좌표는 §11의 신규 테스트 설계다. 아직 존재하거나 통과한 테스트로 주장하지 않는다.

| R / AT | AC | 관측 가능한 동작 | 검증 수단 | production 도달 경로 |
|---|---|---|---|---|
| R-01 / AT-01 | AC1 | 인증된 세 내장 플러그인의 도구 schema·설명·결과가 OpenCode 모델 호출에 도달 | O1·O3·O4, 서로 다른 sentinel 결과 | binding→bridge→CLI MCP→모델→handler |
| R-01 / AT-01 | AC2 | stdio command/args/env, http·sse URL/headers를 보존해 호출. disabled·미해결 값은 제외 | O1·O2·O4, 세 transport 실제 fixture | MCP CRUD→snapshot→config→CLI |
| R-02 / AT-02 | AC3 | 새 대화·기존 세션에서 연결된 MCP를 + 및 @로 선택·강조하고 원래 source로 호출 | O5·O6·O4 | prepare/live→safe DTO→controller→send |
| R-02 / AT-02 | AC4 | Orca 그룹 중복 0, native 그룹 유지, MCP 노출이 Orca 스킬을 활성화하지 않음 | O6, built-in/user/native 각각 다른 이름 | capability→menu/@/highlight |
| R-03 / AT-03 | AC5 | add/update/delete/toggle·credential 회전 후 다음 사용자 턴과 자동 연속 턴이 최신 세대 사용 | O1·O7·O8 | mutation→revision→respawn→send |
| R-03 / AT-03 | AC6 | 로그아웃 후 이전 bridge handle로 새 내장 호출이 성공하지 않음, 재로그인 후 회복 | O3·O7 | Auth change→binding sync→dispatch 재검사 |
| R-04 / AT-04 | AC7 | credential 전달은 D-004 경계 안. 소스 파일·DB·로그·IPC·argv에 새 노출 없음 | O2·O3·O5·O10, 구별되는 비밀 sentinel | resolver→child env / safe DTO / diagnostics |
| R-04 / AT-04 | AC8 | 같은 표시명·native 동명·정규화 충돌에도 다른 서버를 대신 호출하지 않음 | O2·O3·O6, a-b/a_b·공백·한글·예약 alias | identity→projection→관측→선택→dispatch |
| R-01 / AT-01 | AC9 | handler 예외·isError·잘못된 반환·취소가 성공 빈 결과로 바뀌지 않음 | O3·O4 | tools/call→validation→MCP response |
| R-03 / AT-03 | AC10 | 같은 프로필의 세션들이 서버를 공유하고 A 변경·종료가 B의 진행 호출을 끊지 않음 | O7·O8, 실제 lease와 지연 호출 | profile→pool→directory lease→release |
| R-02 / AT-02 | AC11 | 등록 상태와 연결 상태를 구분. 실패/철회/늦은 응답이 사용 가능 후보를 되살리지 않음 | O5·O6·O8 | source change→cache invalidation→live observation |
| R-05 / AT-05 | AC12 | native MCP·프로젝트 설정·native 토글·설정 파일 바이트 보존 | O2·O4·O9 | native config merge→mcp control→resource view |
| R-05 / AT-05 | AC13 | Claude 기존 실행·도구 승인·readOnly 해석 및 OpenCode 승인/자동승인 설정 유지 | O9·O4 | Claude adaptRuntimeTools / OpenCode permission event |
| R-04 / AT-04 | AC14 | session-only 도구는 bridge에서 보이지 않고 application 호출에 임의 sessionId·cwd를 붙이지 않음 | O3·O9, Artifact sentinel | plugin source filter→dispatch context |
| R-05 / AT-05 | AC15 | 빈 배포·재시작·복원 실패에서 fake 내장 도구나 별도 저장 사본이 생기지 않음 | O1·O8·O10 | bootstrap→auth resume→source→shutdown |
| R-05 / AT-05 | AC16 | 배포 문서 예제가 실제 타입에 맞고 성공/미인증/재시도 의미가 구현과 일치 | O1·O10, 문서 예제 compile fixture | deployment guide→binding→source |
| R-02 / AT-02 | AC17 | 실제 Windows CLI에서 등록·선택·호출·취소 및 white/dark·키보드·좁은 pane 흐름 확인 | O4 자동 부분 + H1 실환경/시각 | 실제 앱→Composer→CLI→서비스 |

AC는 17개다. 기계 가능한 목록·상태·배선·프로토콜은 O1~O10으로 닫으며, H1은 실 서비스·시각 품질만 담당한다.

## 7-A. V / Trace Matrix

Baseline V를 새로 만든다. 다른 handoff의 PASS나 V를 상속하지 않으므로 기존 동작 회귀도 이번 Baseline의 명시 요구 R-05로 잠근다.

### Node registry

| left | right | 계약 | provenance |
|---|---|---|---|
| R-01 | AT-01 | 실제 MCP 실행·transport·결과, AC1·2·9 | 양쪽 NEW |
| R-02 | AT-02 | 가용 후보·Composer·시각, AC3·4·11·17 | 양쪽 NEW |
| R-03 | AT-03 | 변경·인증·동시성, AC5·6·10 | 양쪽 NEW |
| R-04 | AT-04 | credential·identity·실행 범위, AC7·8·14 | 양쪽 NEW |
| R-05 | AT-05 | 기존 하네스·저장·배포 계약, AC12·13·15·16 | 양쪽 NEW |
| SD-01 | ST-01 | 설정/인증→노출→실행 전체 수명 | 양쪽 NEW |
| SD-02 | ST-02 | generation·warm/연속 턴·공유 lease·종료 | 양쪽 NEW |
| SD-03 | ST-03 | 준비/실행 관측→Composer→실제 호출 | 양쪽 NEW |
| AR-01 | IT-01 | 공통 source·bridge·하네스 projection 조립 | 양쪽 NEW |
| AR-02 | IT-02 | revision 운반·IPC·safe view 경계 | 양쪽 NEW |
| AR-03 | IT-03 | 기존 Claude 및 native MCP 경계 | 양쪽 NEW |
| MD-01 | UT-01 | 활성/변수 해석·identity·충돌 판정 | 양쪽 NEW |
| MD-02 | UT-02 | schema·호출 결과·auth·취소 | 양쪽 NEW |
| MD-03 | UT-03 | capability·후보 계산·입력 행동 | 양쪽 NEW |

### Pair registry

모든 pair는 REQUIRED다. EP 집합과 숫자는 §10의 자리 목록을 가리키며, 여러 pair가 같은 자리를 공유한다.

| Pair | left ↔ right | 경로 start→edges→end | 자리별 oracle | 선택 적대 증거 | EP / 자리 수 |
|---|---|---|---|---|---|
| VP-01 | R-01↔AT-01 | CRUD/binding→snapshot→harness→실제 tool call | O1~4 | not selected — 직접 protocol 결과 | E1·E2·E3 / 24 |
| VP-02 | R-02↔AT-02 | prepare/live→safe view→메뉴/@→전송 | O4~6·H1 | M2 — source 간 혼선 | E3·E5·E6 / 31 |
| VP-03 | R-03↔AT-03 | mutation/auth→revision→다음 턴/공유 서버 | O3·O7·O8 | M1 — 한쪽 턴 축 누락 | E1·E2·E4 / 25 |
| VP-04 | R-04↔AT-04 | source identity/secret→경계→dispatch | O2·O3·O4·O5·O10 | M3 — credential/권한 배선 소거 | E1·E2·E3·E5 / 37 |
| VP-05 | R-05↔AT-05 | 기존 source→Claude/native→원래 동작 | O1·O9·O10 | not selected — 실제 행동·파일 바이트 | E1·E7 / 22 |
| VP-06 | SD-01↔ST-01 | 저장/복원→source→bridge/config→실행 | O1·O3·O4·O8 | not selected — 전체 호출 기록 | E1·E2·E3 / 24 |
| VP-07 | SD-02↔ST-02 | revision→warm/continuation→새 lease→정리 | O7·O8 | M1 | E4 / 9 |
| VP-08 | SD-03↔ST-03 | menu open→prepare/read→선택→model request | O4·O5·O6 | M2 | E3·E5·E6 / 31 |
| VP-09 | AR-01↔IT-01 | bootstrap 주입→source/bridge→adapter.client | O1·O2·O3·O4·O8 | M3 | E1·E2·E3 / 24 |
| VP-10 | AR-02↔IT-02 | source event→runtime/IPC→renderer invalidation | O5·O7·O8 | M1 | E4·E5 / 22 |
| VP-11 | AR-03↔IT-03 | 공통 resolve→Claude/plugin 및 native merge | O2·O9·O10 | not selected — 직접 observer | E7 / 11 |
| VP-12 | MD-01↔UT-01 | raw entries→resolve/identity→projection | O1·O2 | not selected — 구별 입력 exact equality | E1a·E1b·E1c·E3a / 4 |
| VP-13 | MD-02↔UT-02 | MCP request→auth/schema/handler→result | O3 | not selected — 실제 HTTP client/server | E2 / 5 |
| VP-14 | MD-03↔UT-03 | source별 후보→menu/@/decoration | O6 | M2 | E6 / 10 |

### 현재 변경의 운영 gate

| Gate | 적용 시점 / 명령 | 실패 범위 |
|---|---|---|
| G0 설계 | plan/INDEX 일치·링크·AC/EP/pair 대조, `git diff --check` | 이번 문서 |
| G1 코드 | `cd app`; `npm run lint`; `npm run typecheck` | 수정 subtree 경계·타입 |
| G2 행동 | 직접 `vitest run`으로 O1~O10와 영향 스위트 실행 | 명시 AC·자리·등록 변이 |
| G3 문서 | `node scripts/check-doc-inventory.mjs --check`, scripts 관련 tests | 문서·IPC·inventory 정합성 |
| G4 빌드/CLI | `npm run build`, O4 실제 CLI·H1 | packaging 및 외부 경계. ABI 환경 실패 별도 |
| G5 저장소 | 현재 CI·trailer 파싱·공유 브랜치 전달 | 이번 변경 산출물. 설계/구현 커밋 분리 |

# Part II — Technical Design

## 8. Research — 코드·외부 계약

아래는 2026-10-27 현재 코드의 관측이다. 현재 코드 수치의 장기 SSOT가 아니라 이번 설계의 조사 기록이다.

| 대상 / 발견 | 검색 / 관측 | 의미 |
|---|---|---|
| 사용자 MCP 소비 | `rg -l 'enabledConfig\(' app/src/main -g '*.ts' -g '!*.test.ts'` → 2파일: store 선언·Claude extensions | OpenCode 변환·전달 누락 |
| runtime snapshot 운반 | `rg -l 'runtimeTools' app/src/main -g '*.ts' -g '!*.test.ts'` → 10파일 | builder·runtime·respawn·Claude 경로, OpenCode 소비 0 |
| UI extension gate | `rg -l 'includeExtensions' app/src/renderer/src/features/chat -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'` → 7파일 | Module 2 + contracts + controller + AttachMenu + model + composerSkills |
| 현재 하네스 | `app/harnesses/registry.ts:mainHarnessModules` | Claude·OpenCode |
| 내장 배포 | `app/deployment/plugins.ts:createPluginBindings` | 기본 배열은 비어 있음. fixture 없이는 세 서비스 실행 검증 불가 |
| session-only 소비 | `features/artifacts/tool.ts`가 waitForSession/cwd/extraDirs 사용 | registry 전체 공개 금지 |
| native API | 설치 SDK `@opencode-ai/sdk` 1.18.27, `dist/v2/gen/types.gen.d.ts`의 McpLocalConfig/McpRemoteConfig | stdio→local(command 배열/environment), http·sse→remote(url/headers) |
| 기존 credential 정책 | `security.md §1.4-b`·MCP 변환 경계 | 평문 디스크 OpenCode 배포는 미채택. D-004로 env 경계만 확장 |
| 공식 MCP SDK | package-lock + 설치 package.json = 1.29.0, Claude SDK의 간접 의존 | 같은 정확 버전을 직접 선언하여 간접 의존 경로에 기대지 않음 |

외부 근거: [OpenCode MCP](https://opencode.ai/docs/mcp-servers/), [MCP transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), [공식 TS SDK](https://github.com/modelcontextprotocol/typescript-sdk). 최신 웹 예제와 설치 타입이 다르면 지원 CLI/설치 SDK 타입을 기준으로 계약 테스트한다.

**실행 가능성 실험 PASS**: 설치된 MCP SDK의 McpServer·StreamableHTTPServerTransport·Client·StreamableHTTPClientTransport와 node:http를 사용해 임시 localhost listener를 열고 닫았다. `echo({text:"distinct-sentinel-0288"})`의 결과는 text와 structuredContent 양쪽 동일, schema는 required string, readOnlyHint=true, 무인증 요청은 401이었다.

이 실험은 SDK 경계의 실행 가능성만 증명한다. 앱 배선·OpenCode CLI·Origin/Host·취소/철회는 아직 구현되지 않았으며 O3·O4에서 검증해야 한다.

기존 테스트 인용 확인: `adapters/opencode/v1/adapter.test.ts`의 “applies SDK MCP choices before the first prompt, rejects unsafe project controls and retains partial observations safely”, “auto-accepts permissions once while enabled and still asks questions”; `app/handlers/session-resources.sync.test.ts`의 “applies overlapping project toggles in order without a self-write rejection”.

## 9. Architecture / Data & Control Flow

### AS-IS

```text
McpStore → Claude toClaudeConfig → dist plugin/.mcp.json → Claude
PluginBinding.sync → RuntimeToolRegistry → ExtensionBuilder → Claude adaptRuntimeTools
OpenCode → provider settings/native config → own MCP catalog
Composer includeExtensions=false → Orca 후보·스킬 공통 차단
```

### TO-BE

```text
McpStore/resolver + PluginBinding/BoundAuth
 → ManagedMcpSource (공통 snapshot·revision·안전한 identity metadata)
 → Claude: 기존 plugin 배포 + in-process 도구
 → OpenCode: MCP config projection + main 소유 localhost MCP bridge
 → 실제 하네스 연결 관측 + source identity → safe NativeResource
 → Composer capability별 + / @ / decoration → 실제 요청

source 변경 → revision event → draft lease/cache 무효화
                         └→ 다음 턴/연속 턴 respawn 판정
auth 철회 → bridge dispatch 즉시 재검사 + 해당 진행 호출 abort
```

| 비교 축 | AS-IS | TO-BE | 구현/검증 |
|---|---|---|---|
| source 책임 | 사용자 설정 변환이 Claude 파일에 있음 | 순수 변수 해석 공통화, 하네스 shape 변환 분리 | E1·E3·E7 / O1·2·9 |
| 내장 실행 | Claude 인프로세스만 | 동일 handler를 표준 MCP bridge로 추가 제공 | E2 / O3·4 |
| 상태/수명 | runtimeTools revision만 추적 | managedMcp revision 별도 추적·source 변경 알림 | E4·E5 / O7·8 |
| 표시 | provider 인증과 native 관측이 별도 | backend의 실제 관측 + 안정 source mapping | E5·E6 / O5·6 |
| 소유권 | OpenCode 프로필별 서버·cwd별 lease | 유지. MCP 세대가 프로필 입력에 추가 | E3·E4 / O8 |
| 저장 | MCP source/secret/settings | 유지, bridge/config은 메모리 파생 | E1·E7 / O10 |

### 핵심 책임

| 레이어 | 책임 / 의존 |
|---|---|
| `adapters/common/managed-mcp.ts` (신규) | snapshot/source/lease 타입. 하네스 구현·feature import 없음 |
| `features/extensions/common/mcp/` | resolve·snapshot revision·identity·bridge. McpStore와 좁은 injected plugin source만 소비 |
| `app/managed-mcp.ts` (신규), bootstrap | PluginBinding·Auth·McpStore를 조립하고 adapter/builder에 주입, 변경 발신·종료 |
| `adapters/opencode/v1/` | native config projection·transport endpoint 소비·MCP status를 safe view로 역매핑 |
| `features/sessions` + `app/chat-turn` | 새 revision의 spawn 기록·사용자/연속 턴 비교. 구체 OpenCode 분기 없음 |
| renderer chat feature | capability별 후보·토큰·cache, 기존 화면 재사용 |

범용 PluginHost·ContributionRegistry를 만들지 않는다. 기존 배포가 반환한 PluginBinding 참조와 명시 application scope를 활용하는 좁은 MCP 노출 서비스다.

## 10. 계약 / 타입 / 강제 지점

### 계약

- `ManagedMcpSnapshot`: main 전용 `revision`, resolved 사용자 MCP map, application plugin server map, 안전한 source identity metadata. credential 포함 객체는 IPC 타입에 넣지 않는다.
- `ManagedMcpSource`: 동기 `snapshot()`, 변경 구독·명시 `refresh()`; 저장/인증 성공 후 refresh. 암호문/실행 값 fingerprint 변화로 revision을 올리고 같은 값의 반복 sync는 유지한다.
- `ManagedMcpBridge.acquire(snapshot)`: generation별 endpoint map·source mapping·idempotent release. listener 주소/토큰은 메모리만 유지하고 동일 세대의 여러 lease가 재사용한다.
- `TurnExtensions.managedMcp` 및 spawn 기록 `spawnedManagedMcpRevision`: 미주입은 기존 하네스 경로, 주입된 빈 snapshot도 유효 세대로 취급. undefined와 0을 섞지 않는다.
- `RuntimeToolDescriptor.executionScope?: 'application' | 'session'`: 미지정은 session. Confluence·Jira·Mail factory가 application 선언, registry 동등성 비교에 포함한다.
- handler 두 번째 인자는 `RuntimeToolContext | RuntimeToolApplicationContext`; 후자는 `scope:'application'`과 request signal만 제공. Artifact는 session context를 좁혀 검사하고 application 입력을 거부한다. 기존 Claude의 full context는 유지한다.
- `NativeResource`에 필요 시 안전한 `managedSource`(kind/sourceId)·`mentionId` 추가. id는 실제 runtime server key, name은 원래 표시명, origin='orca'; source가 없으면 native 원래 의미다.
- renderer capability는 `includeSkills`·`includeManagedMcp`로 분리. 두 하네스 모두 MCP=true, 기존 스킬 허용값 유지한다.
- 신규 `managedMcpChanged` event payload는 `{revision:number}`뿐. 인증값·주소·설정 payload 금지. 기존 composer lease invalidation도 함께 사용해 늦은 완료를 폐기한다.
- draft resource scope에 선택된 `providerKey`·`agentKind`를 추가해 새 대화의 모델 설정과 MCP 준비가 같은 실행 구성을 쓰게 한다. 생략된 레거시 요청은 기존 resolver 기본값을 사용하고, 저장된 세션은 DB의 backend/agent/cwd가 정본이다.

### 자리 목록

E1~E7은 그룹이고 소문자 접미가 **개별 자리**다. 현재 운반 지점과 신설할 지점을 모두 고정하며, 신규 자리의 파일 이동은 동일 책임·oracle이 유지되면 구현 보고에서 경로만 대응시킨다.

| 그룹 | 언제 강제 — 고정 자리 | 직접 oracle | 실패 의미 |
|---|---|---|---|
| E1 (11) | a `mcp/store.ts:enabledConfig`; b `store.ts:resolver`; c 신규 `mcp/resolve.ts`; d 신규 `managed-source.ts:refresh`; e `managed-source.ts:snapshot`; f `deployment/plugins.ts:sync`; g 신규 `app/managed-mcp.ts` 생성·주입; h bootstrap auth 변경 callback; i `handlers/mcp.ts:mcpAdd`; j `mcpUpdate`; k `mcpDelete` | a~g O1, h O1+O3, i~k O1+O7 | 등록·철회·회전과 실제 전달이 다름 |
| E2 (5) | a 신규 `mcp/bridge.ts` listen/auth/Host/Origin 경계; b initialize/session 생성; c tools/list; d tools/call의 현재 권한·schema·handler·취소 경계; e release/close 공통 cleanup | 각 자리 O3 | 무인증/교차 세대 호출·잘못된 성공·누수 |
| E3 (8) | a 신규 `opencode/v1/managed-mcp.ts` projection; b `adapter.ts:client`; c `native-storage.ts:nativeOpenCodeEnvironment`; d `server-profile.ts:openCodeServerProfile`; e `server.ts:start` env 전달; f `adapter.ts:prepareComposer` snapshot 선택; g `adapter.ts:sendMessage` snapshot 선택; h `channel.ts` 일반 prompt·slash command 공통 system context의 mention mapping 합성 | a O2, b~g O4+O8, c~e O2, h O4 | 준비·실행 불일치 또는 credential 누출·공유 파괴·참조 오호출 |
| E4 (9) | a `extensions/common/builder.ts:build`; b `chat-turn/runtime-entry.ts`; c `chat-turn-continuation.ts`; d `chat-turn/respawn-inputs.ts`; e `sessions/respawn-policy.ts`; f `session-runtime.ts` spawn 기록; g 같은 파일 teardown reset; h `opencode/v1/session-context.ts` lease/cache; i bootstrap shutdown | a~g O7, h·i O8 | warm/연속 턴 stale, 이웃 세션 중단·고아 listener |
| E5 (13) | a `opencode/v1/native-resources.ts` mapping; b `channel.ts:nativeResources`; c `composer-cache.ts:mcp`; d `app/composer-catalog.ts:prepareComposerCatalog`; e `handlers/composer-catalog.ts` owner invalidation; f `handlers/session-resources.ts` live read; g 같은 파일 draft/cold read; h 신규 `app/prepared-mcp-resources.ts` prepared owner; i app source event broadcast; j preload receive; k renderer IPC subscription; l `nativeResourceState` invalidation; m `composerCatalogState` invalidation | a~c O5, d~h O5+O8, i~m O5+O6 | 연결되지 않은 항목 노출·늦은 성공 부활·안전 DTO 위반 |
| E6 (10) | a Claude `composer/Module.tsx`; b OpenCode Module; c `ComposerInputController.tsx` 후보 선택; d 같은 파일 AttachMenu props; e `AttachMenu.tsx` model 인자; f `attachMenuModel.ts` 그룹/토큰; g `useMentionAutocomplete.ts` 후보 입력; h `pluginMention.ts` source merge; i `composerSkills.ts`; j `ComposerDecorationLayer.tsx` valid ID 소비 | 각 자리 O6 | 스킬 동반 활성화·그룹/토큰/강조 불일치 |
| E7 (11) | a `claude/mcp/convert.ts`; b `app/harnesses/claude/extensions.ts`; c `extensions/claude/plugin.ts` MCP 파일 쓰기; d `claude/runtime-tools.ts`; e `plugins/confluence/tools.ts` scope/signal; f `plugins/jira/tools.ts`; g `plugins/mail/tools.ts`; h `artifacts/tool.ts` context guard; i `runtime-tool-registry.ts` 동등성; j `opencode/v1/mcp-control.ts`; k `opencode/v1/channel.ts` permission 처리 | a~c O9+O10, d~i O3+O9, j·k O4+O9 | 기존 하네스·native 제어·배포 소비자 회귀 |

고정 분모는 **67자리 = 11+5+8+9+13+10+11**다. a~k처럼 합쳐 표기한 것도 접미 ID마다 별도 자리이며, 같은 파일의 서로 다른 생산/운반/소비 지점을 하나로 세지 않는다.

### 자리 검색 / 목록 대조

아래 Q1~Q5는 저장소 루트에서 실행한다. 술어는 계약 값이고 범위는 main/renderer/preload 전체 경로이며, 신규 해법 이름만 찾는 검색으로 대체하지 않는다.

```powershell
rg -n 'enabledConfig|resolver\(|runtimeTools|PluginBinding|plugin\.sync|mcp(Add|Update|Delete)|deployExtensions' app/src/main -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
rg -n 'mcp|Mcp|OPENCODE_CONFIG_CONTENT|profile\.environment|providerSettings|prepareComposer|sendMessage' app/src/main/adapters app/src/main/features/extensions app/src/main/app -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
rg -n 'revision|spawned.*Revision|buildExtensions|respawnInputs|teardownChannel|release|shutdown' app/src/main/app app/src/main/features/sessions app/src/main/adapters/opencode -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
rg -n 'NativeResource|nativeResources|nativeResourceState|composerCatalog|mcp|Mcp' app/src/shared app/src/preload app/src/renderer/src/features/chat app/src/main/app/handlers -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
rg -n 'includeExtensions|includeSkills|includeManagedMcp|pluginMention|nativePluginMentions|validPluginIds|orcaItems' app/src/renderer/src/features/chat -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
```

Q1→E1/E4a/E7, Q2→E2/E3/E5a-b/E7, Q3→E4/E2e, Q4→E5, Q5→E6. 검색 결과의 import·타입 선언·주석·fixture·native 전용 설정 읽기는 계약 값을 운반하는 실행 edge와 구별한다.
이 분류 문장의 의미는 **검색 hit 수가 자리 수가 아니라는 것**이다. 구현자는 검색 출력의 실행 edge를 위 고정 자리로 대응하고, `검색된 운반 edge - 자리 목록`과 `자리 목록 - 구현/계획된 edge` 차집합을 보고한다.

신규 타입·이벤트 선언은 위 실행 자리의 계약이며 별도 행동 자리로 세지 않는다. 목록 밖 운반 edge가 새로 필요하면 임의로 생략하지 않고 PLAN_GAP으로 정정한다.

### 등록 적대 증거

| ID | 이유 | 심을 자리 / 결함 | 검출 oracle |
|---|---|---|---|
| M1a~c | revision은 일부 경로만 연결해도 대표 테스트가 통과 | E4b 사용자 턴·E4c 연속 턴 각각 managed revision 제거; E4f spawn 저장값을 이전 값으로 고정 | O7의 세 구별 경로 |
| M2a~b | 형제 source가 같은 DTO를 운반 | E5a에서 builtin↔user source mapping 맞바꿈; E6f에서 native↔Orca 그룹 맞바꿈 | O5·O6 exact identity/parent 단언 |
| M3a~b | 조립 누락·권한 누락 민감도 | E3b에서 managed source 주입 제거; E2d에서 auth 재검사 제거 | O8 실제 조립, O3 철회 후 재호출 |

다른 pair는 직접 행동 관측을 선택하며 변이를 자동 확대하지 않는다. 변이 등록 7개이며 기존 자료의 미검증 성공을 증거로 승계하지 않는다.

## 11. 구현 설계 / oracle 좌표

아래 경로는 `app/src/` 기준이다. 모든 O는 **신규/증설 예정 좌표**이며 테스트 이름·진입점·구별 입력·관측 대상을 함께 고정한다.

| O | 파일:테스트명 | 실행 구간 / 구별 입력 / 관측 |
|---|---|---|
| O1 | `main/app/managed-mcp.test.ts:projects stored MCP and authenticated plugin bindings` | 실제 McpStore·resolver·binding·source 조립, fake 설정/봉인 저장/외부 I/O만 주입. 세 plugin factory + disabled/미해결 user를 넣고 snapshot·revision·CRUD 반환 관측 |
| O2 | `main/adapters/opencode/v1/managed-mcp.test.ts:preserves transports identities and native configuration` | 실제 resolve→projection→nativeOpenCodeEnvironment→profile. stdio args 공백·빈 문자열, 서로 다른 env/header, http/sse, 동명 native config, collision fixture; env JSON·원본 바이트·alias 역매핑 단언 |
| O3 | `main/features/extensions/common/mcp/bridge.integration.test.ts:serves only authorized application tools` | 실제 HTTP listener+공식 MCP client→server→실제 plugin factory handler. 외부 service response만 fake. 3종 결과·Zod 실패·isError·throw·철회·취소·401·Host/Origin·교차 session·release 단언 |
| O4 | `main/adapters/opencode/v1/managed-mcp.cli.integration.test.ts:advertises and calls managed MCP through the supported CLI` | 실제 OpenCode CLI+실제 bridge+stdio/http/sse fixture. 로컬 모델 protocol fixture가 일반 prompt·slash command의 mention mapping과 tools 정의를 받아 지정 도구 호출, args·결과를 외부에서 단언. native permission 거절/허용 및 취소 포함 |
| O5 | `main/app/handlers/managed-mcp-resources.test.ts:preserves source identity through prepared and live views` | 실제 adapter mapping·cache·composer/session handler를 조립하고 production dependencies 제공. 준비/실행/실패/늦은 응답·2세대 서로 다른 결과; IPC payload·선택 가능 집합·비밀 sentinel 부재 관측 |
| O6 | `renderer/src/features/chat/harnesses/common/composer/Composer.managed-mcp.test.tsx:selects only usable managed MCP without enabling skills` | 실제 controller·AttachMenu·CascadeMenu·MentionAutocomplete·decoration 조립. IPC만 fake, 키보드/클릭→삽입→강조→send 관측. native/builtin/user 서로 다른 값, 양 하네스·초안/기존세션·IME·초점 확인 |
| O7 | `main/app/chat-turn/managed-mcp-revision.test.ts:applies new revisions to user and continuation turns` | 실제 builder→runtime-entry/continuation→respawnInputs→policy→SessionRuntime. adapter 경계 sink에서 revision/call 관측, 0/undefined·연속 변경·unchanged·teardown reset 구별 |
| O8 | `main/app/managed-mcp-lifecycle.test.ts:shares generations and releases only owned resources` | bootstrap에서 추출한 실제 managed 조립 함수→adapter→pool→session-context→bridge lease. spawn/fetch 외부 I/O만 대체, 두 cwd/동일 cwd·busy/idle·renderer-gone·quit·부분 실패 후 owner/listener 관측 |
| O9 | `main/adapters/claude/managed-mcp-regression.test.ts:retains Claude execution and session scoped tools` 및 기존 native MCP 테스트 | 실제 common resolve→Claude deploy/adapt→handler, 다른 source sentinel. Artifact full context·읽기/쓰기 승인·OpenCode project choices/auto-accept 기존 case 재실행 |
| O10 | `main/app/managed-mcp-document-contract.test.ts:matches deployment recipes and secret boundaries` | 배포 예제를 타입 fixture로 import, 빈 배포/3 plugin 배포·권한 실패 실행. 파일/로그/IPC/argv spy는 외부 sink만 사용, env 제외 모든 sink 비밀 sentinel 부재와 원본 파일 바이트 단언 |
| H1 | `docs/handoff/0288-cross-harness-mcp/verify.md:Windows 실제 인수` (후속 작성) | 실제 사내 Confluence/Jira/Mail 및 사용자 MCP, Claude/OpenCode, white/dark·좁은 pane·키보드. 서비스 값이 없으면 미실기로 표시, PASS로 대체하지 않음 |

O4는 API key나 사내 서비스 없이 로컬 모델 fixture로 실행할 수 있어야 한다. 지원 CLI 경로가 없으면 환경 실패로 기록하되 O3만으로 AC1의 실제 OpenCode 도달을 PASS로 올리지 않는다.

### 구현 순서

1. 공통 변수 해석을 `mcp/resolve.ts`로 이동하고 Claude wrapper 유지; source·identity 및 scope 계약 추가.
2. narrow plugin source·revision 조립과 bridge 구현; 공식 MCP SDK 1.29.0 직접 선언·lock 갱신.
3. OpenCode projection을 공통 client acquire에 연결; server profile·lease 소유·safe mapping 확정.
4. builder/runtime/사용자 턴/연속 턴 revision 축과 변경 이벤트 연결.
5. 준비·실행 목록 통합, capability 분리, +/@/강조/전송 경로 연결.
6. O1~O10·등록 변이·build/CLI·문서 gate 후 구현 보고 작성.

Electron/DB를 import하지 않는 `resolve.ts`·`identity.ts`·`managed-mcp.ts` pure seam을 둔다. bootstrap 조립도 `app/managed-mcp.ts`로 추출해 Electron 전체를 mock한 테스트로 배선 존재를 대신하지 않는다.

## 12. End-to-end / producer와 consumer

### 첫 입력 전 준비와 실행 중 관측

현재 `NativeResourceState`는 `sessionApi.nativeResources`를 읽고, draft handler는 파일 설정만 반환한다. OpenCode의 별도 `ComposerCatalogState`에는 mcp 슬롯이 있지만 구독 시 agents/models만 읽으므로 MCP 주입만으로 첫 입력 전 메뉴가 채워지지 않는다.

`app/prepared-mcp-resources.ts`는 기존 `ComposerCatalogOwners`를 재사용하는 read-only 조립부로 만든다. `handlers/session-resources.ts`에 주입해 OpenCode draft 또는 아직 live channel이 없는 저장 세션에서 `prepareComposerCatalog`→`lease.read('mcp')`를 호출하고, 실제 연결 관측과 generation을 반환한다.

소유 키는 sender+기존 resource observer+실행 scope이고, nativeResources의 observer active=false·renderer-gone·navigation에서 lease를 반납한다. 한 번 조회만 하는 비관측 호출은 사용 가능한 장수 연결로 기록하지 않고, 연결을 유지할 observer가 있어야 prepared 결과를 후보로 제공한다.

live channel이 있으면 그 generation의 관측이 우선이다. prepared/native 관측은 provenance와 generation이 다르므로 무조건 합치지 않으며, 새 revision 발행은 해당 prepared owner를 retire하고 source에서 철회된 항목을 즉시 후보에서 제거한다.

공통 renderer는 같은 native resource API를 계속 읽으며 구체 OpenCode registry를 import하지 않는다. common controller는 하네스 capability와 관측된 MCP 후보를 `useMentionAutocomplete`·AttachMenu·강조에 함께 전달하고, OpenCode에서는 provider의 valid 상태만으로 후보를 추가하지 않는다.

### source와 소비처

| producer / 소비처 | 변경 및 회귀 |
|---|---|
| McpStore CRUD / Claude 배포·OpenCode snapshot | 기존 저장 성공 후 refresh, 동일 해석 결과 사용. AC2·5·12 |
| Auth resume/change / PluginBinding·source·Composer | valid만 활성. cached descriptor는 관리 화면에서 유지, 실행 후보는 관측과 교집합. AC6·11·15 |
| RuntimeToolRegistry / builder·Claude·respawn | session 도구 포함 원래 snapshot 유지. bridge용 목록은 binding application 교집합. AC13·14 |
| OpenCode `client` / prepareComposer·sendMessage·complete·recoverSession·readHistory | 하나의 projection/acquire 경계 사용. 보조 complete는 기존 tools/permission 제한 유지. history와 db path는 같은 native 환경 식별 유지. AC7·10·12 |
| 실제 MCP status / channel·composer-cache·session-resource IPC | safe identity mapping 한 함수 공유. 선언만으로 connected를 만들지 않음. AC3·11 |
| safe DTO / menu·@·decoration | 동일 source key로 dedup, 표시명과 runtime identity 분리. AC4·8 |

내장 기존 `@authId` 참조는 유지한다. OpenCode runtime alias가 다를 때 요청에 credential 없는 `mentionId→runtimeServerId` JSON mapping을 포함하며 사용자 라벨을 실행 지시로 해석하지 않는다.

동명 user/native 후보의 내부 키는 `{origin,kind,sourceId}`다. runtime key는 `orca_b_<digest>`·`orca_u_<digest>`의 안정 namespace로 만들고 native 키·정규화 후 도구 이름과 충돌하면 해당 managed 항목을 명시 실패시켜 덮어쓰지 않는다.

digest는 SHA-256의 앞 12자리 hex이고 source map에서 충돌을 실제 검사한다. 원래 sourceId와 도구 이름을 저장소에서 바꾸거나 조용히 잘라내지 않으며, 하네스/모델 이름 제약으로 등록할 수 없는 서버는 식별 가능한 오류를 제공한다.

Composer는 name을 표시하며 user MCP 참조는 runtime alias를 토큰 identity로 사용한다. builtin은 기존 mentionId를 유지하되 native 동명과 충돌하면 source를 구별하는 alias를 사용하고 양쪽을 중복 제거로 소실시키지 않는다.

## 13. Lifecycle / 오류 / 정리

### bridge

- bind는 `127.0.0.1:0`, app 소유 listener만. 256-bit random capability를 Authorization 헤더로 검사하고 Host allowlist·Origin 거부 정책을 JSON-RPC 처리보다 먼저 적용한다.
- initialize마다 공식 SDK stateful transport/session을 만들고 `generation+serverId+Mcp-Session-Id`에 묶는다. 임의 JSON-RPC id·현재 UI session으로 채팅 session을 추정하지 않는다.
- `tools/list`는 snapshot의 선언/schema만, `tools/call`은 현재 binding valid·server identity·application scope를 다시 검사한 뒤 Zod parse한다. descriptor/implementation 불일치는 실패다.
- request cancellation·transport close·source revoke·app shutdown을 결합한 signal을 handler에 전달한다. Confluence도 현재 invoke 체인에 그 신호를 운반하도록 보완한다.
- 반환 content의 text 형상·isError·structuredContent를 보존한다. 잘못된 반환과 예외는 마스킹된 MCP 오류로 돌리고 빈 성공으로 바꾸지 않는다.

### 세대 / OpenCode

- source mutation은 새 revision을 발행하고 새 prepare/acquire가 그 revision을 사용한다. 동일 revision의 URL·capability를 재사용해 매 세션마다 pool key가 달라지지 않게 한다.
- 진행 중 세대는 원래 owner가 끝날 때까지 유지. 인증 철회만 현재 권한 검사로 즉시 막는다. 새 사용자 턴·자동 연속 턴은 별도 managed revision 비교 후 해당 채널만 재생성한다.
- renderer 해제·창 종료·실패 중 acquire·앱 quit마다 listener/transport/서버 lease를 idempotent 반납한다. 타 세션 owner가 남아 있으면 그 generation을 닫지 않는다.
- native MCP remote는 OpenCode transport가 HTTP/SSE를 처리하며, managed 사용자 remote에는 `oauth:false`를 명시해 별도 native OAuth 흐름을 시작하지 않는다. 원래 native MCP OAuth 설정은 그대로 둔다.
- bridge의 remote fetch는 없고 내장 서비스 요청은 기존 BoundAuth→Chromium net 스택으로 유지한다. OpenCode가 수행하는 외부 MCP I/O는 하네스 소유 경계다.

### 실패 / 다중 저장소

| 실패 지점 | 관측 상태 / 복구 |
|---|---|
| source/secret/settings 저장 실패 | 기존 McpStore의 오류/보존 계약. 새 snapshot 성공으로 발행하지 않음 |
| 저장 성공 뒤 projection/배포 실패 | 저장된 source는 남음, 실행 성공으로 표시하지 않음. 다음 prepare에서 재시도 |
| main 종료 | source 영속만 남고 endpoint·토큰은 소멸. 다음 부팅 재생성 |
| 개별 server 변수 미해결·연결 실패 | 해당 항목 제외/실패. 다른 서버 목록은 유지 |
| 새 revision 준비 중 늦은 이전 성공 | revision+owner 검사로 폐기. 철회된 후보 복구 금지 |

새 영속 저장소와 DB migration은 없다. 기존 source/secret/settings 다중 쓰기의 순서를 이 작업에서 재설계하지 않으며, 배포 파일은 복구 가능한 파생물이다.

설계 상태 사본은 이 plan 메타와 INDEX 두 곳이다. G0에서 둘을 같은 커밋으로 갱신하고 불일치면 READY로 보고하지 않는다.

## 14. 성능 / 상한

기존 전역 MCP 수 제한은 새로 만들지 않는다. 활성 사용자 서버 수 U, 내장 서버 수 B, 내장 도구 수 T, OpenCode directory instance 수 D, 살아 있는 설정 세대 수 G로 측정한다.

- 도구 노출량은 기존 native 도구 + 사용자 서버가 반환한 도구 + T이며 중복 등록하지 않는다. 모델 context 비용은 그 합에 비례하므로 O4에서 실제 도구 이름 집합을 확인한다.
- generation당 listener는 app 공유 1개, endpoint는 B개, OpenCode MCP 초기 연결은 directory별 최대 U+B개다. 프로토콜 재연결은 이 초기 연결 수에 별도 기록한다.
- 같은 revision의 source·projection은 캐시하고 secret/auth 변경 시 invalidation한다. G는 살아 있는 owner가 붙은 세대 + 최신 준비 세대이며 마지막 release 시 수거한다.
- bridge request body 1 MiB, generation별 transport session 256개·동시 call 64개를 내부 자원 상한으로 둔다. 초과는 명시 오류이며 무한 대기열·조용한 일부 실행을 만들지 않는다; 정상 plugin 결과는 여기서 임의 잘라내지 않는다.
- 모델 reference mapping의 추가 길이는 source ID·alias 직렬화 길이 합 O(U+B)다. descriptor 본문·credential을 이 mapping에 중복 삽입하지 않는다.

숫자 SLA/첫 토큰 시간은 미정인 PRD OQ6을 이 계획으로 결정하지 않는다. 실 CLI 측정은 기존 공유 서버 유지·연결 반복 여부를 확인한다.

## 15. 외부 포트 / 문서 계약

`docs/guides/closed-network-extensions.md`의 플러그인 배포 예제를 application scope와 양 하네스 실행 경로에 맞춰 갱신한다. source ID·authId·서비스 주소의 소유자는 기존 배포이며 별도 OpenCode용 서비스 코드를 만들지 않는다.

O10은 예제 fixture의 실제 타입 대입과 valid/invalid/retry 동작을 검증한다. `IPC_CONTRACT.md`는 managed 변경 event·safe metadata만, `security.md`는 승인된 env 경계와 loopback capability 수명을 정본으로 갖는다.

## 16. 기존 결정·규칙과의 관계

| 기존 계약 | 본문 판정 |
|---|---|
| 표준(MCP)을 1차 추상화 / native full-plugin은 엔진별 | 유지 — §9 MCP bridge와 projection, full-plugin 이식 없음 |
| raw secret 예외 표 밖 노출 금지 | 사용자 승인으로 제한 변경 — D-004·§13, OpenCode child env만 추가 |
| 새 의존성 사용자 승인 | 충족 — D-003. 이미 설치된 정확 버전 직접 선언 |
| 기본 배포 빈 배열·auth invalid에서도 관리 설명 유지 | 유지 — §6·12 |
| main 하향 DAG·feature 교차 금지 | 유지 — §9 주입 |
| OpenCode 공유 프로필·lease | 유지 — §13·14 |
| Composer 상태 UI 제거·출처별 그룹 | 유지 — §5·7, 새 상태 공 없음 |
| Claude 승인 기본값 OQ9 | 미결정 유지 — AC13 |
| code 수치 current-state 문서 복제 금지 | 유지 — 조사 수치는 handoff 증거, 현재 inventory는 생성물 |

## 17. 리스크 / trade-off

| 리스크 | 결정 / 검증 |
|---|---|
| 로컬 MCP endpoint가 새 실행 표면 | capability+Host/Origin+generation binding, O3 실제 부정 요청 |
| OpenCode 공유 MCP는 채팅 session identity를 제공하지 않음 | application 도구만 노출, session-only는 거부. AC14 |
| CLI transport/version 차이 | 설치 SDK 타입 기준 + O4 실제 CLI, SSE fallback 직접 검증 |
| source 수정 중 일부 세션은 이전 세대 유지 | 의도한 턴 경계. 인증 철회는 즉시, 일반 설정은 다음 턴 |
| 실환경 없는 기본 배포 | factory/외부 응답 fixture로 기계 검증, 사내 연결·시각은 H1 |
| child env는 자식의 native plugin에서도 접근 가능 | D-004 승인 경계, 내장 credential은 전송하지 않음 |

## 18. 영향 파일 / 문서

실행 파일은 §10·11이 정본이다. 추가 계약 파일은 `adapters/common/{managed-mcp,runtime-tools,turn}.ts`, harness runtime options, `shared/{native-resources,ipc,protocol}.ts`, preload와 renderer IPC API다.

문서는 `docs/arch/backend/{standardization,adapters,security}.md`, `docs/IPC_CONTRACT.md`, `docs/guides/closed-network-extensions.md`, `docs/arch/frontend/design-components.md`, 필요 시 `docs/generated/inventory.md` 재생성을 포함한다. 아직 구현되지 않은 내용을 이번 설계 턴에 current-state 문서로 쓰지 않는다.

## 19. 게이트 / READY self-review

설계 턴은 G0·G3·G5만 적용한다. 구현 턴은 app/main/renderer 가이드와 현재 CI를 읽고 G1~G5 및 O1~O10·M1~M3를 실행한다.

비-DB 테스트는 직접 Vitest로 실행해 pretest의 ABI 변경을 피한다. DB/실앱 확인을 수행했다면 app 가이드의 Node/Electron ABI 순서를 기록하고, build 실패를 제품 계약 통과로 숨기지 않는다.

| 대조 | 판정 / 관측 |
|---|---|
| 요구·Ledger·AC | §3 대응표, ACTIVE 10개 중 제품/운영 대응 누락 없음 |
| AS-IS/TO-BE·소유권 | §9 동일 6축, 사라지는 책임은 공통 resolve 이동으로 명시 |
| V level·pair | R/SD/AR/MD 모두 포함, NEW left 14개에 REQUIRED 14pair |
| 자리·oracle | E1~E7 = 67자리, §10의 자리별 O 좌표와 §11 구별 입력 대조 |
| 선택 변이 | 7개, 심을 자리·직접 검출 좌표 등록. 비선택 pair 이유 명시 |
| 외부 규약 | 설치 SDK 타입과 localhost MCP 실제 probe, 앱/CLI 성공으로 과장하지 않음 |
| 기존 회귀 | AC12~16·O9~10, native/Claude source 및 승인 경계 명시 |
| 시각·순수 로직 | H1의 시각/사내 환경 외 항목은 O로 기계 검증 |
| 상태 사본 | plan READY ↔ INDEX plan/READY·다음 Codex, G0로 확인 |
| 한계 | 앱 코드 미변경, AC 구현 충족 보고·verify PASS 아님 |

### 이번 설계 턴의 검사 관측

| 검사 | 결과 / 범위 |
|---|---|
| 문서 inventory 검사 | `cd app; node scripts/check-doc-inventory.mjs --check`의 inventory·prose 검사 통과. 전체 링크 단계는 기존 ignored 외부 소스 `.tmp/opencode-dev/`·`app/.temp/opencode/`의 끊어진 링크로 실패 |
| 추적 문서 링크 재검사 | 같은 checker의 parser·제외 규칙을 Git 추적 Markdown과 새 plan에 적용: 문서 777개 입력, 링크 1,347개 확인, 끊어진 링크 0개. 새 plan은 과거 handoff 제외 규칙에서 명시 포함 |
| AC·V·자리 대조 | AC1~17·VP-01~14 중복 없음, E1~E7 합계 67, INDEX의 plan/READY·다음 Codex 일치 |
| 자리 검색 | §10 Q1~Q5 실행: 각각 55/374/166/246/57 hit, 18/57/31/21/13파일. import·선언과 실행 edge를 구분해 §10의 기존/신규 자리로 대응 |
| diff 검사 | `git diff --check` 통과. 코드 테스트는 설계 산출에 적용하지 않음 |

전체 링크 gate 통과로 보고하지 않는다. 이번 변경의 링크·inventory는 정상이며, 기존 임시 외부 소스의 링크 문제는 구현 완료 기준과 분리한다.

---

## [구현자 기입]

구현 전 [handoff-impl](../../../.agents/skills/handoff-impl/SKILL.md)을 읽고 아래 표준 필드를 채운다. 현재 모든 필드는 미착수다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: … (Part I/II의 정확한 절 인용)
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

> `§10`의 `언제 강제` 칸은 **하나의 불변식이 성립해야 하는 지점 목록**이다. 한 지점만 닫아도
> 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다.
> **각 행의 `재현 명령 / 관측`은 이번 턴에 실제로 실행한 것만 적는다** — 산출물에서 표식을 다시
> 찾지 못하면 그 행은 닫힌 것이 아니다.
> **그 관측이 구조적 proxy·0건/전수 스윕·배선 존재 oracle이고 이번 턴에 장치를 만들거나 고쳤다면,
> 등록된 결함을 심어 실패하는지 먼저 확인한다** — 눈이 없는 장치의 `0건`은 전수의 증거가 아니다.
> 직접 행동 결과를 관측하는 oracle에는 mutation을 자동 요구하지 않는다(impl §3).
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §8).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 다시 돌린 출력과 목록의 차집합을 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §8).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾼 변이의 red로 인자 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 목록이 고정되지 않은 pair면 PLAN_GAP · 고정 목록 밖은 기록 · 현재 계약 비귀속이면 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 목록 안팎 모두 이번 턴에 닫는다

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> pair가 적대 증거를 선택했거나 파생 이슈가 변이를 인용했거나 이번 턴에 구조적 proxy·0건/전수·배선 oracle을 만들었다면
> 그 결함을 심어 장치의 방향·민감도를 확인한다(impl §3). 형제 슬롯이 서로 다른 계약을 가지면
> 지우는 변이에 더해 **형제와 맞바꾸는 변이**도 심는다. 그 밖의 hunk에는 mutation을 새로 발명하지
> 않고 `해당 없음 — 직접 oracle …`을 적는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 사유** / 해당 없음 — 직접 oracle |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K = 표 행 T` — 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §8).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

> 범위 밖이라 이번에 고치지 않더라도 **적는다** — 적지 않으면 그 선택지가 존재한 적도 없게 된다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치(구현 세부) / 📝 **plan 수정 제안**(설계가 틀렸다는 증거) / ⚠️ 보고만(제품·AC·Decision·의존성) | … |

> 가운데 갈래가 구현 턴의 핵심 산출이다 — plan을 고치는 것은 설계자 책임이지만, **고쳐야
> 한다는 증거를 만드는 것은 구현자만 할 수 있다.** 무엇이 틀렸는지·코드에서 무엇을 봤는지·
> 어느 절을 어떻게 바꿔야 하는지를 함께 적는다.

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음 / …

> 차이가 있으면 **대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 한 줄씩** 적고, 그 축에서 다시 확인한
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §6).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … / 해당 없음 + 근거 | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … / 해당 없음 + 근거 | … |
| 재진입 | … / 해당 없음 + 근거 | … |
| 다른 무효화 축 | … / 해당 없음 + 근거 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | 테스트 N파일 / M케이스 · error·warning 수 · 환경 기인 실패 분리 근거 |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다. 분모가 바뀌었으면(AC 분할·추가) 그 사실을 적고 이전 라운드 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r<N> 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다. 좌표 정본은 `INDEX.md` 한 곳이고 검증자가 채운다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k` (verify 3·6회째 FAIL/RETURN_TO_PLAN 또는 verify 없는 impl 턴 3 초과면 — 사용자 요구 변경 턴 제외 — 다음 재구현 전에 `handoff-review`. verify 9회째가 PASS가 아니면 `verify/CLOSED` 종료)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 |
