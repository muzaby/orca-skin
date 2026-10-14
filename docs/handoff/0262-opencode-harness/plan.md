# Plan — OpenCode 하네스와 전용 UI

## 메타

| 항목 | 값 |
|---|---|
| slug | `0262-opencode-harness` |
| 작성자 | Codex — 사용자 구현 요청에 따른 설계·구현 |
| 일자 | 2026-10-13 |
| 선행 근거 | 0214 SDK 연구. 연구 완료 상태를 제품 구현 완료로 해석하지 않는다. |
| 상태 | IMPL_DONE — r1.10 오류 안내·하네스 문구 수정, 실공급자/도구 승인 시각 검증 잔여 |
| V mode | Delta V — 기준 V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6 |
| 기준 V | none — 0214는 SDK 조사이며 이번 제품 계약을 갖지 않는다. |
| 이번 V revision / 유효 V | ΔV6 / V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6 |

# Part I — Product & UX Contract

## 1. Context / 목표

Orca는 Claude만 실행하고 composer·모델·패널이 그 기능을 전제한다. OpenCode 모델을 고르면 같은 위치에서 전용 UI가 나타나며 실제 세션을 실행할 수 있게 한다. 기존 세션은 생성 당시 하네스로 계속 실행한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 모델 선택으로 하네스별 composer 슬라이스 전환, 하네스별 지원 패널 범주화 | 라이브 사용자 요청 |
| 명시 요구 | 생성한 세션의 하네스 변경 금지, OpenCode는 Code만 지원 | 라이브 사용자 요청 |
| 명시 요구 | OpenCode 전용 composer·transcript·우측 패널 디자인, 엔진 카드·하네스 설정 | 라이브 사용자 요청·첨부 HTML |
| 명시 결정 | Orca가 로컬 서버 자동 관리, 디자인은 OpenCode에만 적용 | 첫 비동기 질문 답변 |
| 명시 결정 | 마지막 하네스 기억, 최초 Claude. 공통 도구 정규화와 원본 보존 | OQ7/OQ10 비동기 질문 답변 |
| 명시 변경 | 브라우저 분석 취소, 실행 중인 OpenCode의 개발자 도구 사용 | 최신 사용자 지시 |
| 추론 의도 | 선택 전후 초안·첨부 보존, 지원하지 않는 제어 숨김 | 제자리 전환과 지원 패널 구분에서 도출 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 새 세션에서 모델 선택이 하네스를 선택한다 | 초안과 첨부를 유지한다 | 사용자 | ACTIVE | — |
| D-002 | 기존 세션은 저장된 backend로 라우팅한다 | UI와 IPC 모두 잠금, 전역 기본값 변경과 무관 | 사용자 | ACTIVE | — |
| D-003 | OpenCode는 Code만 지원한다 | Work에서 OpenCode 모델 선택 시 Code로 전환 | 사용자 | ACTIVE | — |
| D-004 | OpenCode 디자인은 해당 슬라이스에만 적용한다 | Claude 표시·기능 보존 | 사용자 답변 | ACTIVE | — |
| D-005 | 로컬 서버는 Orca가 시작·종료한다 | loopback 임의 포트, 소유 child만 종료, 기존 OpenCode 프로세스 재사용/종료 금지 | 사용자 답변·구현 설계 | ACTIVE | — |
| D-006 | 새 세션은 마지막 하네스, 최초 Claude | 사용 가능한 모델이 없으면 준비된 카탈로그로 폴백 | OQ7 답변 | ACTIVE | — |
| D-007 | 공통 도구 종류와 원본 이름·입력 모두 보존 | 기존 렌더러 재사용과 하네스 원문 확인 | OQ10 답변 | ACTIVE | — |
| D-008 | 설정·모델 카탈로그는 하네스 범위를 갖는다 | Claude 설정을 OpenCode에 주입하지 않는다 | 사용자·코드 경계 | ACTIVE | — |
| D-009 | native 화면을 Elements/Computed에서 조사한다 | URL 검증 또는 브라우저 재접속 요구 없음 | 사용자 | ACTIVE | 브라우저 조사 취소 |
| D-010 | OpenCode 엔진 모달에도 Claude처럼 설정 불러오기 버튼을 배치하고 연결한다 | 선택 하네스의 전역 설정을 편집기에 채우고 기존 저장으로 확정 | 2026-10-14 추가 사용자 요구 | ACTIVE | — |
| D-011 | OpenCode transcript 배경을 Claude와 동일하게 한다 | 본문·부모 배경·스크롤 fade를 함께 맞춘다 | 2026-10-14 추가 사용자 요구 | ACTIVE | V1의 transcript 전용 배경만 대체 |
| D-012 | 새 대화 화면을 OpenCode 소스에 맞춰 로고→컴포저→워크스페이스·브랜치로 배치한다 | D-004에 따라 OpenCode 슬라이스만 적용. 내려받은 참조 저장소는 커밋 제외 | 2026-10-14 추가 사용자 요구 | ACTIVE | — |
| D-013 | 새 대화의 브랜드 로고는 OpenCode를 사용한다 | 원본 워드마크 적용 | 로고 선택 비동기 답변 | ACTIVE | ΔV2의 기본 해석 확정 |
| D-014 | OpenCode 대화 중 스피너를 OpenCode 원본으로 바꾼다 | D-004에 따라 Claude 스피너는 유지 | 2026-10-14 추가 사용자 요구 | ACTIVE | 기존 공통 SparkSpinner의 OpenCode 적용만 대체 |
| D-015 | OpenCode 2.x 계열 API 사용·CLI 지원 잔재를 제거한다 | 사용자: "V2 api가 이번에 릴리즈된 opencode v2 용이 맞는가? 맞다면 모두 제거하라." SDK `/v2/client`는 v1.19.0 공식 앱의 기존 client export라 유지하고, 별도 `client.v2` API 호출/테스트와 2.x CLI 지원은 제거 | 2026-10-14 사용자 요구·공식 v1.19.0 소스 대조 | ACTIVE | 0214 native API 비교 테스트의 현행 유지 요구 대체, 과거 연구 기록은 보존 |
| D-016 | Claude/OpenCode 구현을 디렉터리로 분리하고 OpenCode의 1.x 의존 API는 `v1` 아래에 둔다 | adapter 구현·composer·엔진/모델·기타 하네스 전용 기능을 분리한다. 공통 기능은 공유하고 기존 UI·입력 수명·외부 계약을 유지한다 | 2026-10-14 사용자 추가 요구 | ACTIVE | 평면 파일 배치와 공통 컴포넌트의 전용 구현만 대체 |

| D-017 | OpenCode 공통 계약과 현재 1.x 구현을 분리해 향후 2.x 구현을 연결할 경계를 둔다 | 사용자: "opencode는 1.x, 추후 2.x도 고려하여 계층분리". 현재 2.x 실행 지원을 추가하는 요청으로 해석하지 않는다 | 2026-10-14 사용자 추가 요구 | ACTIVE | D-015/016 보완 |
| D-018 | 도구 호출·카드는 OpenCode 원본을 참고하고 transcript 출력 스타일을 하네스별로 분리한다 | 원본 v1.19.0의 탐색 묶음·셸 출력·파일 diff·reasoning을 참고한다. Claude 스타일, 공통 배경(D-011), 원본 도구 보존(D-007)은 유지 | 2026-10-14 사용자 추가 요구 | ACTIVE | ΔV5에서 공통 카드 스타일을 재사용한 OpenCode 경로만 대체 |

갱신 메모: D-017/018 추가. D-015의 2.x 미지원과 향후 계층 확장은 양립하며 D-004/011의 Claude 스타일·배경은 유지한다. ACTIVE 결정 ↔ AC22~25 대조: 충돌 0, 미정 제품 결정 없음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 기존 코드가 충족하는가 | 일부 타입만 준비됨 | `Backend='claude'`, registry에 Claude만 등록 |
| 원인과 맞는가 | 타당 | 전역 getActive 라우팅은 혼합 세션에 부적합 |
| 더 작은 해법 | 스타일 변경만으로는 부족 | 실행·설정·세션 잠금까지 요청됨 |
| 선행 연구와 대조 | SDK 설치만 완료 | 0214·설치본 v2 타입 및 SDK 계약 테스트 |
| 기존 결정 충돌 | 단일 하네스 전제 갱신 | 이번 OQ7/OQ10 사용자 답변이 전제를 대체 |

## 5. 동작 / 사용자 흐름

```text
엔진&모델 → OpenCode 설정 → 자동 서버 시작/카탈로그 로드
 → 새 대화 모델 선택 → Code + OpenCode composer
 → 전송 → 저장 backend 잠금 → 스트리밍/도구/승인 → 완료/중단
 → 세션 재열기 → 동일 하네스로 이어쓰기
```

| 시작 상태/이벤트 | 시스템 동작 | 보이는 결과 |
|---|---|---|
| 카탈로그 로딩 | 소유 서버 준비·모델 조회 | 로딩, 실패 시 오류·새로고침 |
| OpenCode 모델 선택 | 초안 유지, Code 선택, 전용 컨트롤 | 에이전트·모델·variant·첨부·전송 |
| 기존 세션 모델 메뉴 | 같은 하네스만 허용 | 다른 하네스로 전환 불가 |
| 도구/승인/질문 | 공통 이벤트와 broker로 처리 | 접기 행·질문·허용/거절 |
| 실행 중 중단 | 해당 OpenCode 세션 abort | 취소 상태, 후속 턴 가능 |
| 서버/스트림 실패 | 오류 반환, 소유 리소스 정리 | 오류 메시지·재전송 가능, 자동 프롬프트 재전송 없음 |
| 재시작 | 저장 backend와 provider로 재연결 | Orca DB 이력 유지 |
| 설정 변경 | 다음 실행 구성부터 적용 | 다른 하네스 설정 유지 |

메뉴는 키보드·Escape·포커스 복귀를 지원한다. 밝은/어두운 테마 모두 전용 토큰을 사용한다. 서버 부재·실행 파일 오류를 조용히 삼키지 않는다. 여러 세션의 cwd·provider·취소 신호를 분리한다.

## 6. 범위 / 비범위

범위: 서버 lifecycle, SDK 실행·카탈로그·승인, 하네스 선택/잠금, OpenCode composer/transcript/지원 패널, 엔진 CRUD, 하네스 설정, 관련 문서와 테스트.

비범위: 사용자 OpenCode 앱의 세션 이관, OpenCode 앱 자체 수정, Work 지원, 미지원 Claude 전용 background 제어의 가짜 구현, 자동 업데이트/CLI 다운로드. CLI는 설치된 실행 파일을 사용하고 설정에서 경로를 지정할 수 있다.

## 7. Requirements / Acceptance — R ↔ AT

| R / AT / AC | 행동 기준 | 직접 검증 | production path |
|---|---|---|---|
| R-01 / AT-01 / AC1 | 모델 선택 시 composer가 전환되고 초안·첨부를 보존한다 | composer 렌더/선택·reducer 테스트 | ModelMenu → setModel → reducer → Composer |
| R-02 / AT-02 / AC2 | 기존 세션 하네스 변경은 거부하고 저장 backend로 실행한다 | 서로 다른 두 adapter를 주입한 send 테스트 | IPC → admission → registry → adapter |
| R-03 / AT-03 / AC3 | OpenCode에서 Work 진입·전송을 막는다 | reducer·main 전송 거부 | kind 선택 → reducer / send |
| R-04 / AT-04 / AC4 | 소유 서버만 자동 실행·종료하며 실패 후 재시도 가능하다 | process factory lifecycle 테스트 | bootstrap → registry → server → shutdown |
| R-05 / AT-05 / AC5 | OpenCode 텍스트·reasoning·도구·완료를 올바른 세션에 기록한다 | 실제 SDK + HTTP/SSE fixture 통합 | SDK → mapper → eventBatches → history |
| R-06 / AT-06 / AC6 | 질문·권한 응답과 중단이 서버에 전달된다 | 승인·abort fixture 통합 | event → broker → SDK reply/abort |
| R-07 / AT-07 / AC7 | 도구 정규화와 원본이 reload 뒤에도 보존된다 | mapper·history part·reducer roundtrip | tool → normalized event → stored part → UI |
| R-08 / AT-08 / AC8 | 엔진 페이지가 OpenCode 설정과 모델을 제공한다 | settings CRUD/parser·카탈로그·폼 테스트 | engine CRUD → settings → catalog → card |
| R-09 / AT-09 / AC9 | 하네스 설정이 별도로 저장되고 실행에 적용된다 | settings merge·server options 테스트 | SettingsModal → IPC → store → adapter |
| R-10 / AT-10 / AC10 | 우측 패널에 선택 하네스 지원 범주만 나타난다 | policy·메뉴·reducer 테스트 | title menu → panel policy → panel |
| R-11 / AT-11 / AC11 | OpenCode 디자인만 바뀌고 Claude UI가 유지된다 | 실측 문서 + 렌더 비교·사람 시각 검사 | backend → composer/transcript/panel slice |
| R-12 / AT-12 / AC12 | 새 세션은 마지막 하네스를 선택하고 재열기는 저장값을 쓴다 | 부팅·draft·load 회귀 | settings → draft / DB → loaded session |

시각 검사는 폰트·간격·그림자·레이아웃을 보며 자동 테스트의 행동 단언과 구분한다. 기존 테스트 이름을 가정하지 않고 신규 테스트에서 production entry를 호출한다.

## 7-A. V / Trace Matrix

Baseline V: 아래 노드 모두 NEW. R/AT는 §7의 개별 행이 노드 정본이다.

| Node | 레벨 | 계약 |
|---|---|---|
| SD-01 / ST-01 | SD / ST | 세션 선택·전송·재열기·중단 end-to-end |
| SD-02 / ST-02 | SD / ST | 엔진/설정·카탈로그·UI slice |
| AR-01 / IT-01 | AR / IT | 주입 transport·owned server·SDK stream |
| AR-02 / IT-02 | AR / IT | immutable backend·provider config·history |
| AR-03 / IT-03 | AR / IT | renderer 상태·정책·슬라이스 조립 |
| MD-01 / UT-01 | MD / UT | mapper·catalog·settings 순수 변환 |
| MD-02 / UT-02 | MD / UT | reducer·panel policy·기본 선택 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle (신규) | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | ModelMenu → actions → reducer → Composer | `Composer.harness.test.ts`, `chatReducer.harness.test.ts`: 초안·모델 선택 유지 | not selected: 직접 렌더/상태 | EP-01 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | chat:send → DB → registry → adapter | `send.harness.test.ts`: 전역 선택과 다른 세션, 위조 backend 거부 | not selected: adapter 호출 관측 | EP-02 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | kind/model → reducer → send | `chatReducer.harness.test.ts`, `send.harness.test.ts`: Work 거부 | not selected: 직접 결과 | EP-03 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | registry → server → child/shutdown | `opencode-server.test.ts`: 동시 시작·실패·중단·shutdown | not selected: process spy | EP-04 |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | SDK → mapper → batches | `opencode.test.ts`: 응답·도구·세션 격리·단절 | not selected: 실제 SDK fixture | EP-05 |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | stream → approval → SDK | `opencode.test.ts`: 질문/허용/거절/abort 요청 | not selected: wire 관측 | EP-06 |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | mapper → history → loaded part | `opencode-map.test.ts`, `opencode-history.test.ts`: raw 보존 | not selected: 값 roundtrip | EP-07 |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | engine CRUD → catalog → UI | `opencode-settings.test.ts`, `opencode-catalog.test.ts`, `EngineFormModal.harness.test.ts` | not selected: 파일/DTO/폼 | EP-08 |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | settings → store → server | `settings-store.test.ts`, `HarnessSettingsTab.test.ts`, `opencode-server.test.ts` | not selected: 저장·실행 입력 | EP-09 |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | menu → policy → panel | `rightPanelTiles.harness.test.ts`, `chatReducer.harness.test.ts` | not selected: 메뉴·선택 결과 | EP-10 |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | backend → UI slices | `Composer.harness.test.ts`, `TranscriptView.harness.test.ts` + 시각 검사 | not selected: DOM·실측 | EP-11 |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | settings/load → draft | `chatStore.harness.test.ts`: 초기값·마지막값·재열기 | not selected: store 관측 | EP-12 |
| VP-13 | SD-01 ↔ ST-01 | REQUIRED | send → SDK → history → reducer | `send.harness.test.ts` + `opencode.test.ts` + `opencode-history.test.ts` | not selected: 경계별 직접 oracle | EP-02/05/07 |
| VP-14 | SD-02 ↔ ST-02 | REQUIRED | engine/settings → catalog → UI | VP-08/09/11 실행 집합 | not selected: 경계별 직접 oracle | EP-08/09/11 |
| VP-15 | AR-01 ↔ IT-01 | REQUIRED | server + SDK injected fetch | `opencode.test.ts`, `opencode-server.test.ts` | not selected: transport/process 직접 호출 | EP-04/05/06 |
| VP-16 | AR-02 ↔ IT-02 | REQUIRED | backend/config → send/history | `send.harness.test.ts`, `opencode-history.test.ts` | not selected: 경계 직접 관측 | EP-02/07 |
| VP-17 | AR-03 ↔ IT-03 | REQUIRED | actions → UI slice | `Composer.harness.test.ts`, `TranscriptView.harness.test.ts` | not selected: 렌더 결과 | EP-01/10/11 |
| VP-18 | MD-01 ↔ UT-01 | REQUIRED | map/catalog/settings 함수 | `opencode-map.test.ts`, `opencode-catalog.test.ts`, `opencode-settings.test.ts` | not selected: 순수 출력 | EP-05/07/08 |
| VP-19 | MD-02 ↔ UT-02 | REQUIRED | reducer/panel/default 함수 | `chatReducer.harness.test.ts`, `rightPanelTiles.harness.test.ts` | not selected: 순수 출력 | EP-03/10/12 |

운영 gate: app subtree lint·typecheck, 관련 Vitest와 회귀 suites, build, doc inventory, diff whitespace, commit trailer 파싱. 명령은 `app/AGENTS.md`를 따른다. ABI 기인 실패는 별도로 기록한다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

`Backend`·`BackendSchema`·engine CRUD는 Claude 전용이다. `send.ts`는 payload 해석 전에 registry.getActive를 읽는다. reducer session.updated도 Claude를 고정한다. SettingsStore는 scheduler만 중첩 병합한다. `HarnessSettingsService`의 모델 파서도 Claude 고정이다.

외부 근거: 설치된 `@opencode-ai/sdk@1.18.27`의 `/v2/client`·생성 타입·SSE 구현, 기존 `opencode-sdk.test.ts`, 공식 SDK/server 문서. DOM 근거는 [design-evidence.md](design-evidence.md).

전수 검색: `rg 'BackendSchema|backend:|SET_MODEL|SET_AGENT_KIND|lastBackend' app/src`, `rg 'getActive|agentList|loadClaudeProviderSettings' app/src/main`, `rg 'rightPanelTarget|rightPanelTileDefinitionsForAgent' app/src/renderer/src`. 자리 분모는 §10의 entry별 목록이며 구현 중 추가 발견 시 규범 정정을 먼저 기록한다.

## 9. Architecture — AS-IS → TO-BE

AS-IS: ModelMenu → chat state → IPC → 전역 Claude adapter → 공통 history. 엔진 settings는 Claude 파싱, 패널 정책은 AgentKind만 입력한다.

TO-BE: 하네스 capability 정본 → ModelMenu·kind·패널 정책. Draft backend를 IPC로 전달하고 기존 세션은 DB backend로 선택한다. OpenCode adapter는 주입된 Chromium fetch를 쓰는 `/v2/client`의 legacy 호환 API로 호출하고 typed `Event`를 공통 이벤트로 변환한다. `/v2` import와 native `/api` 표면을 혼용하지 않는다.

서버는 adapter 소유 풀에서 구성 fingerprint별 lazy spawn, loopback 임의 포트와 개별 인증 암호를 사용한다. 기존 OpenCode 앱 서버와 포트를 공유하지 않는다. Orca 전용 데이터 경로를 사용해 backend session ID가 재시작 후 재사용 가능하게 한다. 전송·이력은 같은 OpenCode session ID로 Orca DB에 저장한다.

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 실행 | 전역 Claude | 세션/draft별 registry route | VP-02/04/05 |
| 구성 | Claude settings/parser | harness별 loader + 실제 server catalog | VP-08/09 |
| 상태 | backend 고정 | 생성 전 선택·생성 후 불변 | VP-01/03/12 |
| 표시 | 공통 Claude UI | OpenCode slice + 공통 입력·history 재사용 | VP-10/11 |
| 정리 | Claude Query 종료 | 소유 서버 종료와 세션별 abort | VP-04/06 |

## 10. 계약 / 타입 / 강제 지점

| ID / pair | 계약·SSOT | 강제 자리 | 실패 의미 |
|---|---|---|---|
| EP-01 / VP-01 | draft 입력 보존 | ModelMenu onSelect; store SET_MODEL; ComposerInputController mount | 전환으로 입력/첨부 소실 |
| EP-02 / VP-02 | 생성 후 backend 불변 | Send schema; send adapter 선택; 기존/source/lease 비교; resolve await 후 재검증; load/reducer | 다른 하네스 실행 |
| EP-03 / VP-03 | OpenCode Code only | model 선택; kind reducer; main send 검증 | OpenCode Work 실행 |
| EP-04 / VP-04 | owned child lifecycle | binary resolve; spawn 단일화; timeout/error; shutdown | 중복/잔류 child 또는 기존 앱 종료 |
| EP-05 / VP-05 | session/turn event 격리 | subscription 시작; prompt 인정; part dedup; terminal; close | 유실/중복/타 세션 오염 |
| EP-06 / VP-06 | 승인·취소 정착 | permission reply; question reply/reject; abort; abort 중 pending 승인 | 승인 대기 고착 또는 취소 후 실행 |
| EP-07 / VP-07 | raw 원본 보존 | map started; history part; loaded part; reducer; tool view | 원문 소실 |
| EP-08 / VP-08 | harness settings/canonical key | schema; write/read/delete; parser; agent list; engine form/card | 서로의 설정 덮어씀 |
| EP-09 / VP-09 | harness 설정 격리 | schema defaults; patch merge; settings tab; adapter settings read | 저장/실행 불일치 |
| EP-10 / VP-10 | 지원 패널만 선택 가능 | tile definitions; title menu; reducer target; panel rendering | 숨겨진/미지원 제어 접근 |
| EP-11 / VP-11 | OpenCode 전용 디자인 | composer frame; transcript body/tool; right panel frame; theme tokens | Claude 디자인 변경 또는 테마 누락 |
| EP-12 / VP-12 | 마지막 하네스/세션 복원 | lastBackend 저장; draft 초기화; session.updated; LOAD_SESSION | 재시작 후 하네스 변경 |

Optional backend는 구형 caller의 기존 default 경로다. 기존 세션 요청에서 부재는 저장 backend 사용, 불일치는 거부다. 원본 tool 필드 부재는 Claude/구형 이력이며 합성하지 않는다. variant·agent는 OpenCode 목록의 실제 식별자를 사용한다.

## 11. 구현 설계

| 파일군 | 책임 / 변경 | 테스트 seam |
|---|---|---|
| `shared/harness.ts`, `ipc.ts`, `protocol.ts` | capability·DTO·검증 | 순수 계약 |
| `main/adapters/opencode*.ts` | server·catalog·mapping·실행·approval | process/fetch 주입 |
| registry/bootstrap/handlers | 등록·shutdown·engine/agent wiring | mock adapter/handlers |
| harnesses settings/models | native 설정 분리·파서 | 임시 디렉터리 |
| history + renderer reducer/store | backend·원본 tool roundtrip | 실제 mapper/writer/reducer |
| composer/transcript/rightpanel | slice 구성·지원 범주·접기 행 | renderer test harness |
| engine/settings | OpenCode 카드·하네스 설정 | 폼/저장/에러 렌더 |

## 12. End-to-end 영향

model catalog → model 선택 → SendChatMessage → adapter → NormalizedEvent → HistoryWriter → loaded session → transcript. provider settings는 server config로, agent/variant는 prompt로 전달한다. Claude의 입력 컨트롤러·승인 broker·bus 순서는 유지한다.

## 13. Lifecycle / 오류 / 정리

서버 시작은 catalog 또는 첫 turn에서 발생한다. 같은 구성의 동시 시작은 한 promise로 합치고 실패 entry는 비운다. 앱 종료는 소유 child만 종료한다. request signal은 해당 세션 prompt/stream/approval에 묶고 서버 전체를 종료하지 않는다.

SDK 성공은 입장 수락과 답변 완료를 구별한다. 스트림이 완료 전에 끊기면 오류로 정착하고 프롬프트를 자동 재전송하지 않는다. 새 provider session 생성 후 Orca DB 기록 전 실패는 고아 세션 가능성을 기록하되 기존 이력을 덮어쓰지 않는다. 설정 파일 저장 후 catalog 재조회 실패는 저장 성공과 조회 실패를 분리해 재시도한다.

## 14. 성능 / 상한

카탈로그는 구성별 캐시를 사용하고 engine 수정 시 무효화한다. 각 turn은 자신의 session 이벤트만 소비한다. stdout 시작 탐색 버퍼는 상한을 두고 raw 설정·암호를 로그에 남기지 않는다. UI 도구 원문은 펼친 경우에 표시한다.

## 15. 외부 구현 포트 / 문서 계약

OpenCode 실행 파일 경로와 native JSON config를 별도로 노출한다. model ID는 `provider/model` 식별자이며 variant 목록은 SDK 모델 데이터에서 얻는다. 사용자 설치본 CLI와 SDK 호환성은 health/catalog 및 실제 fixture로 확인하고 불일치를 오류로 안내한다.

## 16. 기존 결정·규칙

하향 DAG, Chromium fetch 주입, DB history SSOT, 두 테마 토큰, 한국어 UI, append-only migration을 유지한다. OQ7/OQ10은 이번 사용자 답변으로 닫는다. 신규 패키지 없음. 0214 연구의 native API 권고는 미검증 권고이므로 호환 API 채택과 그 의미 차이를 명시했다.

## 17. 리스크 / 트레이드오프

legacy SSE는 durable replay를 보장하지 않는다. 현재 턴 단절은 오류로 끝내고 사용자가 명시적으로 재시도한다. 미지원 share/revert/background 기능은 capability로 감춘다. 로컬 서버 health 성공만으로 모델 인증을 성공 처리하지 않는다.

## 18. 영향 문서

PRD OQ7/OQ10, TRD backend, `arch/backend/adapters.md`, `arch/frontend/rendering.md`, IPC 계약, SDK 사양의 채택 상태, generated inventory. 디자인 실측은 본 폴더의 design-evidence.md.

# ΔV1 — 엔진 모달의 하네스별 설정 불러오기 (READY)

기준: V1, 공유 브랜치 `b910bc91`의 기존 설계·r1.3 구현. 사용자 추가 요구에 따른 r1.4이며 기존 검증 대기와 D-001~009를 유지한다. 새 요구를 먼저 구현하라는 사용자 지시에 따라 설계·구현을 이어간다.

## Product / UX 추가 계약

명시 요구: “엔진추가 모달애서 opencode의 경우에도 클로드처럼 세팅 불러오기 버튼 배치하고 배선하라”. 설정 편집기 헤더의 같은 자리에 하네스별 버튼을 제공한다. 추가·편집은 같은 폼을 쓰며 불러오기는 초안만 교체하고 자동 저장하지 않는다.

| AC / R↔AT | 행동 기준 | 직접 검증 / production path |
|---|---|---|
| AC13 / R-13↔AT-13 (NEW) | OpenCode는 전역 opencode.json, Claude는 기존 settings.json을 불러온다. 부재·읽기 실패는 해당 하네스 오류를 표시하고 본문을 보존한다. 잘못된 JSON은 기존 편집기 검증으로 수정할 수 있다. | EngineFormModal.import.test.ts의 실제 클릭→API→폼 값, engine.import.test.ts의 IPC→실제 임시 파일, preload/index.test.ts의 wrapper→노출 API→invoke |
| AC14 / R-14↔AT-14 (NEW) | 불러오기 중 재클릭·저장을 막고, 하네스·공급자 전환/본문 수정/닫기 뒤 도착한 결과는 적용하지 않는다. 실패 후 재시도할 수 있다. | EngineFormModal.import.test.ts의 지연 응답·거부·재시도·닫기·재클릭 |

상태: 대기→로딩→성공/오류. 로딩은 버튼에 표시하며, 취소 동작은 늦은 응답을 무효화한다. 기존 공급자 이름은 불러오기로 바꾸지 않는다.

범위: 전역 `opencode.json`의 원문을 불러오는 기존 JSON 편집기 자동완성. 프로젝트 설정 병합·인증 저장소 이관·JSONC 변환·CLI 실행은 포함하지 않는다. 기존 Claude도 원문 읽기이며 같은 검증/저장 경로를 따른다.

## 조사 / 기술 설계

- 현재 `EngineFormModal` 버튼이 Claude 조건으로 숨겨지고 `engineImportUserSettings`는 무입력으로 Claude reader만 호출한다. `rg 'importUserSettings|engineImportUserSettings' app/src`로 폼·renderer API·preload·handler의 네 실행 자리를 확인했다.
- OpenCode 공식 [설정 문서](https://opencode.ai/docs/config/#global)는 전역 `~/.config/opencode/opencode.json`을 지정한다. main reader는 `XDG_CONFIG_HOME`이 있으면 해당 config root를 사용하고 그렇지 않으면 홈의 `.config`를 쓴다. renderer는 파일 경로를 지정할 수 없다.
- `ImportEngineUserSettingsSchema = { engine: EngineSchema }`, 구형 무입력은 Claude로 정규화한다. API/preload는 선택 engine을 전달하고 handler는 검증 후 하네스별 reader를 호출한다. 반환 DTO와 저장 포맷은 유지한다.
- OpenCode reader는 raw UTF-8 반환, 부재/읽기 실패는 `exists:false`다. 내용과 비밀은 로그에 남기지 않는다. 신규 패키지·DB 변경은 없다.
- 폼은 요청 세대 ref를 사용한다. 전환·수정·닫기·unmount가 세대를 증가시키며 완료/오류/finally 모두 현재 세대에서만 반영한다. 저장 busy 동안 불러오기도 비활성화한다.

## V / §10 증분 강제 지점

| Pair / node | requiredness | 경로 / 강제 자리 | 직접 oracle 좌표 | 적대 증거 |
|---|---|---|---|---|
| VP-20 / R-13↔AT-13 NEW | REQUIRED | EP-13a 폼 버튼→API; EP-13b wrapper→preload; EP-13c preload→invoke; EP-13d schema→handler; EP-13e reader→파일→반환; EP-13f 결과→편집기 | EngineFormModal.import.test.ts: loads selected harness into the draft; preload/index.test.ts: imports settings for the selected harness; engine.import.test.ts: reads the selected harness global file; opencode-settings.test.ts: reads raw global settings | 미선택: 값·행동 직접 관측 |
| VP-21 / R-14↔AT-14 NEW | REQUIRED | EP-14a 재클릭/저장 차단; EP-14b 전환/수정/닫기/unmount 무효화; EP-14c 성공·오류·finally 세대 검사 | EngineFormModal.import.test.ts: ignores stale results and errors; prevents duplicate imports and retries after failure | 미선택: 지연 promise 직접 관측 |
| VP-22 / SD-03↔ST-03 NEW | REQUIRED | 불러오기→편집→저장 및 전환·오류; EP-13a/f, EP-14a/b/c | EngineFormModal.import.test.ts: imports then submits without changing the provider | 미선택: 제출 payload 관측 |
| VP-23 / AR-04↔IT-04 NEW | REQUIRED | renderer→preload→검증 handler→reader; EP-13b/c/d/e | preload/index.test.ts + engine.import.test.ts | 미선택: 경계의 실제 진입 |
| VP-24 / MD-03↔UT-03 NEW | REQUIRED | 전역 경로/UTF-8/부재 및 schema; EP-13d/e | opencode-settings.test.ts + engine.import.test.ts | 미선택: 파일/반환 값 관측 |
| VP-08/14/18 (V1 INHERITED) | REGRESSION | 기존 엔진 CRUD·모델 파서·폼 고정 하네스 | settings-write.test.ts, opencode-settings.test.ts, EngineFormModal.harness.test.ts, engine.deployment.test.ts, engine.runtime-catalog.test.ts | 기존 미잠금 범위 승계; 전체 PASS로 승격하지 않음 |

실패 의미: EP-13의 하네스 값이 소실되면 Claude 설정이 OpenCode 폼에 들어가며, EP-14가 누락되면 늦은 응답이 새 초안을 덮는다. 변경 없는 V1 pair는 이번 ΔV의 실행 범위 밖이며 기존 보고의 미검증 범위도 그대로 남긴다.

운영 gate: 관련 Vitest(네 층), lint, 전체 typecheck, electron-vite build, doc inventory, diff whitespace, trailer 파싱. IPC 계약 문서를 같은 구현 커밋에서 갱신한다.

READY 대조: D-010↔AC13/14 및 D-008의 하네스 격리 충돌 0. producer/consumer 경로의 강제 자리 EP-13 6곳·EP-14 3항목을 등록했다. 기존 저장 타입·Claude raw 읽기와 신규 원문 자동완성의 의미가 일치한다.

# ΔV2 — transcript 배경과 OpenCode 새 대화 화면 (READY)

상속 기준: V1 + ΔV1, 구현 `131dd85a512ee544cad2681bbe70ec9225e50630`. 이번 변경은 사용자 추가 요구이며 독립 verify 이전의 r1.5다.

## Product / UX 추가 계약

- 명시 요구: transcript 배경은 Claude와 같게 한다. `/new`의 OpenCode 화면은 브랜드 로고 위/컴포저 중앙/워크스페이스·브랜치 아래 순서로 배치한다.
- 설계 해석: 현재 지원 CLI와 동일한 upstream v1.19.0을 기준으로 최대 폭 720px, 상단 시작 25.375%, 로고·컴포저·경로 행 간격 32px을 따른다. 짧은 창에서는 스크롤로 모든 제어에 접근한다.
- 로고는 사용자 답변(D-013)에 따라 OpenCode 원본 워드마크를 사용한다. 외부 로고 출처·MIT 고지를 보존한다.
- 기존 폴더 선택·브랜치 조회/선택·워크트리 격리·참조 경로 추가 기능은 하단 컨텍스트 행에서 유지한다. 데이터·IPC·모델 선택 정책은 변경하지 않는다.
- Claude 랜딩과 프로젝트 랜딩은 기존 배치다. 새 대화에서 하네스를 왕복해도 작성 내용·첨부가 유지되며 첫 송신 후 기존 ChatTile 경로로 전환한다.

| AC / node | 관측 가능한 기준 | 검증 수단 / 도달 경로 |
|---|---|---|
| AC15 / R-15↔AT-15 NEW | 두 하네스 transcript의 배경과 상하단 fade가 같은 앱 배경 토큰을 사용한다. 두 테마에서도 경계색이 이어진다 | ChatTile→TranscriptView 실제 렌더의 배경·fade 단언 및 두 테마 시각 확인 |
| AC16 / R-16↔AT-16 NEW | OpenCode `/new`는 원본 로고·컴포저·하단 경로/브랜치 순서와 폭·간격을 따른다. 폴더/브랜치 제어가 동작하고 하네스 전환 중 입력/첨부가 유지된다 | NewChatLandingPage.harness.test.ts의 실제 페이지→Composer→컨트롤러 렌더·전환, CwdPanel의 실제 하단 컨트롤 및 기존 branch 회귀, 시각 확인 |

## 조사 / 기술 설계

원본은 `.tmp/opencode-upstream`의 GitHub `anomalyco/opencode` v1.19.0, SHA `733b2c627e5aec39cb33cc22373bdce33053ef2c`다. `git check-ignore`로 제외를 확인했다. 소스 위치와 관측은 [design-evidence.md](design-evidence.md)에 기록한다.

- ChatTile의 부모 배경 두 자리와 fade 두 자리, TranscriptView의 배경 한 자리를 공통 `bg`로 맞춘다. 전용 본문/도구/패널 색과 전역 OpenCode 토큰은 유지한다.
- 페이지는 기존 Composer 인스턴스 앞에 로고를 조건부 배치하고 랜딩 외형만 선택한다. Composer에는 명시적인 OpenCode 랜딩 prop을 전달해 CwdPanel을 입력 뒤 슬롯에 둔다. 기존 세션에서는 이 prop을 주지 않는다.
- CwdPanel은 OpenCode 외형에서 중앙 정렬·flat 제어를 사용하고 BranchChip·CwdButton의 기존 동작을 재사용한다. non-Git/조회 중/격리 상태도 기존 정책이다.
- ColumnWrap은 flush 전환 시에도 동일한 ReadingColumn 타입을 렌더한다. ReadingColumn이 외형만 바꿔 입력 컨트롤러의 로컬 초안/첨부가 remount로 초기화되지 않게 한다.
- 새 의존성·저장 포맷·main/preload 계약 변경 없음.

## V / §10 증분 강제 지점

| Pair / node | requiredness | 경로 / 강제 자리 | 직접 oracle 좌표 | 적대 증거 |
|---|---|---|---|---|
| VP-25 / R-15↔AT-15 NEW | REQUIRED | EP-15a/b ChatTile 부모 두 곳; EP-15c/d 상하 fade; EP-15e TranscriptView 본문 | ChatTile.harness.test.ts: shares the transcript background and fades; TranscriptView.harness.test.ts: renders messages; 두 테마 화면 | 미선택: 실제 렌더 출력·시각 관측 |
| VP-26 / R-16↔AT-16 NEW | REQUIRED | EP-16a backend→페이지 배치/로고; EP-16b 페이지→Composer 랜딩 prop; EP-16c Composer→하단 CwdPanel; EP-16d CwdPanel→폴더/브랜치 제어 | NewChatLandingPage.harness.test.ts: renders the harness landing and preserves draft and attachment state; CwdPanel.harness.test.ts: selects workspace and branch from the footer | 미선택: 실제 순서·클릭 결과 관측 |
| VP-27 / SD-04↔ST-04 NEW | REQUIRED | EP-17a 하네스 전환→동일 페이지 자식; EP-17b flush→ReadingColumn; EP-17c 패널 이동→동일 입력 컨트롤러 | NewChatLandingPage.harness.test.ts: renders the harness landing and preserves draft and attachment state | 미선택: 왕복 후 사용자 입력/첨부 직접 관측 |
| VP-28 / AR-05↔IT-05 NEW | REQUIRED | EP-16b/c/d 페이지→입력/컨텍스트→기존 IPC/스토어 | 같은 페이지 테스트 및 CwdPanel.harness.test.ts; 기존 BranchChip 테스트 | 미선택: 양 끝 동시 mock 없이 production 중간 경로 실행 |
| VP-01/11 (V1 INHERITED, D-001/004) | REGRESSION | 모델 선택·공유 draft·Claude 표시 | Composer.harness.test.ts, modelSelection.test.ts, NewChatLandingPage.harness.test.ts; 기존 직접 oracle 부족 유지 | 기존 미검증 범위 승계 |

변경은 조립·외형으로 새 알고리즘/모듈 불변식이 없어 MD↔UT 신규 pair는 없다. 기존 branchChipState·격리/visibility 회귀로 기능을 확인한다. 등록 강제 자리: EP-15 5자리, EP-16 4자리, EP-17 3자리. 실패 의미는 배경 경계의 다른 색, 로고/입력/경로 순서 오류, 편집 중 remount에 의한 초안 손실이다.

운영 gate: 관련 Vitest, lint, 전체 typecheck, electron-vite build, doc inventory, diff whitespace, trailer 파싱, 참조 clone 제외 확인. UI 캡처는 실제 브라우저의 격리 fixture를 사용할 수 있으며 실제 사용자 세션/인증은 건드리지 않는다. AC11 최종 사용자 시각 인수와 독립 verify는 그대로 대기한다.

READY 대조: D-011/012↔AC15/16, D-001/004의 전환 보존·슬라이스 제한과 충돌 없음. 12개 강제 자리와 직접 oracle을 등록했다.

# ΔV3 — OpenCode 응답 스피너 (READY)

상속 기준: V1 + ΔV1 + ΔV2, 구현 `ec83eb6567c5fe326dd6dc899130df6dfc2f0f2b`. 사용자 추가 요구에 따른 r1.6이다.

## Product / UX 추가 계약

AC17 / R-17↔AT-17 (NEW): OpenCode 응답 중에는 원본의 4×4 격자 SVG 스피너(모서리 숨김, 안쪽 밝음·바깥 흐림)를 표시한다. Claude는 기존 SparkSpinner다. 빈 대화의 첫 응답·사용자 메시지 직후·어시스턴트 본문 스트리밍 경로 모두 같은 선택을 사용한다. 완료/중단 후에는 진행 스피너가 사라지며, 기존 상태 문구·접근성 안내는 유지한다. 감속 모션에서는 정적인 격자를 표시한다.

범위는 응답 진행 StatusLine의 스피너 외형이다. 사이드바/파일 로딩 표시, 도구 행 구조, 상태 문구, 진행 여부 계산은 바꾸지 않는다. 원본 출처는 기존 참조 clone의 `packages/ui/src/components/spinner.tsx`·`styles/animations.css`이며 v1.19.0 SHA는 ΔV2와 동일하다.

## 기술 설계 / §10 강제 지점과 V

- `PendingAssistantStatus`가 활성 세션 backend를 `StatusLine`에 전달한다. `StatusLine`은 기본 Claude를 유지하고 backend=opencode인 경우에만 `OpenCodeSpinner`를 렌더한다. 기존 서브에이전트 패널의 Claude 경로도 기본값을 유지한다.
- 원본 viewBox=15×15, 사각형 3×3/rx=1/간격 1, 표시 크기 18px, 밝기 0.4↔1 및 0.15↔0.35, 주기 1~2s, 시작 지연 0~1.5s를 보존한다. 모듈 초기화 때 생성한 위상은 재렌더 사이 고정이다. 새 React 타이머/프레임 상태는 없다.
- Tailwind `@theme` 애니메이션 토큰을 정의하고 `motion-reduce:animate-none` 및 정적 opacity로 감속 모션에 대응한다. 색은 currentColor와 `text-oc-muted`로 두 테마를 따른다. SVG는 aria-hidden이며 상태 줄이 안내를 소유한다. MIT 고지를 함께 보존한다.

| Pair / node | requiredness | 경로 / 강제 자리 | 직접 oracle 좌표 | 적대 증거 |
|---|---|---|---|---|
| VP-29 / R-17↔AT-17 NEW | REQUIRED | EP-18a 빈 교환 fallback→PendingAssistantStatus; EP-18b 사용자 턴→Exchange→PendingAssistantStatus; EP-18c 어시스턴트 턴→AssistantTurn→PendingAssistantStatus; EP-18d backend→StatusLine; EP-18e 하네스→SVG | TranscriptView.harness.test.ts: uses the harness spinner on each pending transcript path; StatusLine.harness.test.ts: renders the OpenCode grid with stable animation and accessible status; 브라우저 시각 확인 | 미선택: 실제 경로 렌더 및 애니메이션 관측 |
| VP-30 / AR-06↔IT-06 NEW | REQUIRED | EP-18a~e 상태→기존 transcript→진행 표시 | 위 실제 TranscriptView 렌더의 backend별 SVG 및 종료 부재 단언 | 미선택: 배선 경로 양 끝을 동시에 mock하지 않음 |
| VP-11 (V1 INHERITED, D-004) | REGRESSION | 기존 Claude 스피너·상태 표시 | statusLine.render.test.ts, StatusLine.interrupted.test.ts, statusLine.background.test.ts, typeScale.test.ts | 기존 직접 oracle 부족 유지 |

진행 lifecycle와 알고리즘은 그대로이므로 신규 SD/MD pair는 없다. EP-18은 5자리다. 실패 의미는 첫 응답에 Claude 스피너가 남거나, 완료 후 진행 표시가 남거나, reduced motion에서도 계속 점멸하는 것이다. 운영 gate는 관련 Vitest·lint·전체 typecheck·build·문서 inventory·diff·trailer·참조 clone 제외이며 기존 AC11 최종 인수는 대기한다.

READY 대조: D-014↔AC17과 D-004의 하네스 범위 일치. 기존 spinner 정본의 공통 적용은 Claude 소비자 범위로 유지한다.

# ΔV4 — OpenCode 2.x API 사용 제거와 실행 차단 (READY)

상속 기준: V1 + ΔV1~3, 공유 구현 `eb203b5a1cf163eb4f68d840b2579c23cba17ad6`. 사용자 요구 변경에 따른 r1.7이다.

## Product / UX 추가 계약

AC18 / R-18↔AT-18 (NEW): Orca의 OpenCode 경로는 기존 1.x API로 세션·응답·승인을 처리한다. 2.x native API 호출과 비교 테스트, 2.x 전용 npm CLI 탐색 및 시작 로그 허용은 제거한다. 선택한 실행 파일이 2.x 또는 판독 불가 버전이면 서버 생성과 HTTP 요청 전에 1.x 필요 오류를 표시한다. 설치 정보는 실제 `--version`을 계속 보고하며 설치와 지원 여부를 혼동하지 않는다.

`@opencode-ai/sdk@1.18.27`의 `/v2/client` export는 v1.19.0 공식 앱에서도 사용한다. `/v2` 디렉터리 이름·원본 `wordmark-v2`는 이번 제품 2.x 전용 API가 아니므로 제거하지 않는다. 외부 SDK 내부의 미사용 `client.v2` 정의를 수작업으로 지우거나 SDK를 fork하지 않으며, Orca 소유 코드의 해당 API 사용을 제거한다. 원본 연구 문서는 과거 근거로 보존하고 현재 지원 정책을 호환성 문서에 명시한다.

## 기술 설계 / §10 강제 지점과 V

- `opencode-sdk.test.ts`의 native API 비교 호출·타입·fixture를 제거하고 root client 및 현재 legacy client의 요청/SSE/에러 검증만 남긴다. 기존 `opencode.test.ts`가 `/session`, `/event`, `/session/:id/prompt_async` 실제 SDK 직렬화를 검증한다.
- `OpenCodeServerPool`은 동일 실행 파일의 `--version` reader를 설치 조회·서버 생성에서 재사용한다. `execFile`에 기존 hidden/5초 제한을 유지하고 서버 시작 직전에 1.x semver를 확인한다. 실패는 acquire entry를 제거해 재시도할 수 있다.
- 버전 조회 await 이후 shutdown을 다시 검사하여 닫힌 pool이 자식을 만들지 않게 한다. `readVersion` 포트만 테스트에서 대체하고 실제 pool/start/cleanup은 실행한다. `@opencode/cli` npm 경로와 prefix 없는 v2 시작 로그 허용은 삭제한다.
- 설치 정보 계약·공개 IPC·데이터 포맷은 유지한다. 새 패키지나 버전 변경은 없다. 1.x의 미검증 minor 호환성을 보장하는 변경이 아니며 검증 조합은 CLI 1.19.0/SDK 1.18.27이다.

| Pair / node | requiredness | 경로 / 강제 자리 | 직접 oracle | 적대 증거 |
|---|---|---|---|---|
| VP-31 / R-18↔AT-18 NEW | REQUIRED | EP-19a SDK 사용; EP-19b CLI 탐색; EP-19c 시작 전 버전 판정 | opencode.test.ts 실제 세션/stream/승인 wire; opencode-server.test.ts `rejects unsupported versions before spawning a server` 및 `does not discover the scoped CLI package` | 미선택: 실제 요청·spawn 결과 |
| VP-32 / SD-05↔ST-05 NEW | REQUIRED | EP-19d 버전 조회→shutdown→spawn; EP-19e 실패→entry 제거→재시도 | opencode-server.test.ts `does not spawn after shutdown during version probing`; `retries after replacing an unsupported executable` | 미선택: 지연 promise와 실제 pool 경로 |
| VP-33 / AR-07↔IT-07 NEW | REQUIRED | EP-19f 설치 조회→공통 version reader; EP-19g legacy 시작 로그→health | opencode-server.test.ts `reports the actual installed version`; `ignores the unprefixed startup announcement`; 기존 health/owned child lifecycle | 미선택: reader 결과·health 호출 직접 관측 |
| VP-34 / MD-05↔UT-05 NEW | REQUIRED | EP-19c 1.x/2.x/빈 값/손상 출력 판정 | opencode-server.test.ts 위 버전 table 및 `accepts supported 1.x versions` | 미선택: 테이블의 양성/음성 결과 |
| VP-04/05/06/18 (V1 INHERITED) | REGRESSION | 기존 서버·SDK·승인·정규화 | opencode-server, opencode-sdk, opencode, opencode-map, opencode-runtime, opencode-catalog 테스트 | 기존 직접 oracle 부족 유지 |

EP-19는 7자리다. 제거 대조는 OpenCode 소유 source/tests에서 `client.v2`, `V2EventSubscribeResponse`, `SessionInputAdmitted`, `InvalidRequestError` 및 native API URL 호출의 부재를 확인한다. SDK export 경로·2.x 거부 fixture·과거 문서는 허용 예외다. 음성 검색은 기존 API 실제 요청·응답 회귀와 짝지으며 새 자동 구조 검사기는 만들지 않는다.

운영 gate: 관련 Vitest, lint, 전체 typecheck, main/preload/renderer build, doc inventory, diff/trailer, 참조 clone 제외. D-015↔AC18 범위와 D-005 소유 child 정리 계약을 대조했으며 충돌 0. 기존 UI·세션 잠금·AC11 시각 인수는 이번 변경으로 승격하지 않는다.

# ΔV5 — 하네스 구현 디렉터리와 OpenCode v1 경계 (READY)

상속 기준: V1 + ΔV1~4, 공유 구현 `3e247837bc7f55943dab8e82e001c342f726aff0`. 사용자 추가 요구에 따른 r1.8이다. 런타임 제품 동작·공개 IPC·저장 형식은 유지한다.

## Product / UX 및 범위

- AC19 / R-19↔AT-19 NEW: main의 Claude/OpenCode 전용 구현을 각 디렉터리에 격리한다. OpenCode SDK import·프로토콜 매핑·CLI 시작/버전·설정 스키마/모델 해석은 `adapters/opencode/v1/`에 두고, 등록 소비자는 `adapters/opencode/index.ts`를 통해 현재 구현을 선택한다. Claude 구현은 `adapters/claude/`, 중립 포트·등록·프롬프트/도구 공통 어휘는 adapters 공통 경로를 유지한다. 실제 요청·승인·중단 및 1.x 버전 경계는 기존대로 동작한다.
- AC20 / R-20↔AT-20 NEW: renderer는 feature 내부 `harnesses/claude/`, `harnesses/opencode/`에 composer 제어/표현·transcript 표현·우측 패널 정책·엔진 설정/모델 표시·하네스 설정의 전용 구현을 둔다. 공통 입력 controller·초안/첨부·세션 store·모달 저장/가져오기 수명·정규화 도구 본문은 공유한다. OpenCode native config의 형상에 의존하는 엔진 기본값은 `opencode/v1/` 아래에 둔다. IPC 정규 DTO만 소비하는 UI·로고·스피너는 API 버전 디렉터리에 넣지 않는다.
- AC21 / R-21↔AT-21 NEW: import와 소스 기반 회귀·정본 문서의 경로를 함께 갱신한다. OpenCode SDK를 v1 밖에서 import하거나 하네스 구현끼리 참조하면 lint가 거부한다. 기존 layer DAG를 유지하고 하네스별 빈 wrapper에 구현을 복제하지 않는다.

## 기술 설계 / §10 강제 지점

| 자리 | 변경 경로 | 직접 oracle / 실패 의미 |
|---|---|---|
| EP-20a | main 등록/consumer → Claude 구현 | 이동한 Claude adapter query/설정/완료·승인 테스트, registry 테스트. 모듈 경로가 바뀌어도 실행 의미 보존 |
| EP-20b | OpenCode public entry → v1 adapter/server/settings/catalog/map | 이동한 실제 SDK HTTP/SSE·server lifecycle·settings 테스트, app/chat-turn/opencode-runtime.test.ts. v1 API 외부 누출 또는 잘못된 선택 금지 |
| EP-20c | extension 배포 및 shared Claude 기본값 → 전용 디렉터리 | harness plugin 및 settings defaults 기존 테스트. 생성 plugin·설정 값 보존 |
| EP-21a | Composer → 하네스 제어/표현 → 공통 input | Composer.harness 및 NewChatLandingPage.harness 실제 렌더/전환/초안·첨부 보존. 전용 메뉴의 잘못된 선택·입력 remount 금지 |
| EP-21b | transcript/StatusLine → 하네스 도구 그룹·스피너·표현 | TranscriptView.harness, StatusLine.harness, 기존 toolGroup 렌더. 두 하네스의 표시·진행·종료 보존 |
| EP-21c | rightPanelPolicy/Tile → 하네스 정책/표현 | rightPanelTiles.harness 및 RightPanelTile.actions 테스트. 패널 가시성·행동 보존 |
| EP-21d | 엔진 form/model → 하네스 템플릿·표시 | EngineFormModal.harness/import, EngineModelList.render, providerCatalog 테스트. 가져오기 경쟁·설정 초안·모델 이름 보존 |
| EP-21e | HarnessSettingsTab → 하네스별 필드/저장 patch | 새 HarnessSettingsTab 렌더/저장 테스트: Claude 지침만, OpenCode 실행 파일과 지침 저장. 실제 탭과 IPC 경계 관측 |
| EP-22a | SDK import → v1 경계 | 새 scripts/harness-boundary.test.mjs에서 실제 ESLint 설정을 호출: v1 밖 SDK import 거부, v1 안 허용 |
| EP-22b | Claude/OpenCode 구현 → 동일 하네스 또는 공통 코드 | 같은 테스트에서 형제 구현 import 거부·공통 import 허용; 기존 전체 lint |
| EP-22c | 이동 파일 → import/소스 기반 검사/현재 문서 | 실제 회귀·build·doc inventory. 상대 링크와 보안 예외의 정확한 새 경로 확인 |

EP-20 3자리, EP-21 5자리, EP-22 3자리. 이동 목록은 구현 전 스크립트의 명시 mapping으로 기록하고 실제 import graph와 대조한다. 단순 파일 개수는 완료 근거가 아니며 각 자리의 실행 결과를 보고한다.

| Pair / node | requiredness | 경로 | oracle / 적대 증거 |
|---|---|---|---|
| VP-35 / R-19↔AT-19 NEW | REQUIRED | EP-20a/b/c | 실제 adapter·registry·settings·plugin 기존 테스트. 행동 직접 관측; 추가 변이 미선택 |
| VP-36 / R-20↔AT-20 NEW | REQUIRED | EP-21a~e | 위 실제 renderer 테스트 및 새 설정 저장 테스트. 행동 직접 관측; 추가 변이 미선택 |
| VP-37 / AR-08↔IT-08 NEW | REQUIRED | EP-20b, EP-22a/b | 실제 ESLint import probe. 경계 규칙 제거 시 금지 import가 통과하는 red/원복 green 1회 |
| VP-38 / MD-06↔UT-06 NEW | REQUIRED | EP-21d/e | 엔진 config 및 설정 필드의 실제 입력/출력 테스트. 직접 행동 oracle |
| VP-39 / R-21↔AT-21 NEW | REQUIRED | EP-22c | lint/typecheck/build, 이동 영향 테스트, doc inventory. 경로 검사만으로 행동 통과를 대체하지 않음 |
| V1 VP-01/04/05/06/07/08/11/18, ΔV1 VP-21~24, ΔV2 VP-25~28, ΔV3 VP-29/30, ΔV4 VP-31~34 INHERITED | REGRESSION | 이번 이동이 닿은 경로 | 기존 직접 oracle을 새 경로에서 실행. 기존 SELF_BLOCKED·최종 시각 인수·독립 검증 대기 유지 |

운영 gate: 관련 Vitest(ABI 중립), lint, node/web/test typecheck, main/preload/renderer build, scripts 경계 테스트, doc inventory·diff/trailer. 새 의존성·데이터 변경·시각 재설계 없음. feature 교차 import 없이 각 feature 안에 하네스 폴더를 둔다. D-001~015와 충돌 없음. SDK가 없는 순수 UI에 API 버전 이름을 붙이지 않는 것은 공통 기능 예외의 구현 해석이다.

# ΔV6 — CI 복구·버전 경계·transcript 전용 출력 (READY)

## 제품 계약과 AC

CI 실행 [738](https://github.com/muzaby/orca-skin/actions/runs/38540170786)의 gate job은 Test에서 3파일/8케이스가 실패했다. 삭제된 source 경로 두 종류, 랜딩 mock export 누락, OpenCode 추가 문구의 제품명 상수 미사용이 원인이다. 기존 AC21의 필수 gate 위반으로 고치며 검사를 삭제하거나 실패를 skip하지 않는다.

| AC / 노드 | 관측 결과 | 경로·직접 oracle |
|---|---|---|
| AC22 / R-22↔AT-22 NEW | 보고된 CI 실패를 수정하고 수정 head의 CI gate가 통과한다 | error-report.registry·product-identity·agentModeLanding 테스트 + 원격 CI Test/전체 job |
| AC23 / R-23↔AT-23 NEW | 앱은 OpenCode의 버전 중립 생성·설정 계약만 사용하고 현재 v1 구현이 실제 세션/카탈로그/종료를 처리한다 | public factory→v1→SessionRuntime 회귀. 생성자/SDK native 타입을 앱에 노출하지 않는다 |
| AC24 / R-24↔AT-24 NEW | OpenCode 도구는 탐색 그룹, 셸 출력, 파일 diff/쓰기 카드, 작업·웹·기타 결과를 자체 스타일로 표시한다 | 실제 OpenCode ToolGroup/Card 렌더·펼침·복사·상태 테스트. 실패/중단을 성공·실행 중으로 표시하지 않음 |
| AC25 / R-25↔AT-25 NEW | 사용자/assistant 본문, reasoning, 스트리밍, 오류/구조 출력이 하네스별 표현을 선택하고 순서·입력/결과·공통 배경을 보존한다 | TranscriptView→전용 segment, PendingAssistant→전용 text/reasoning의 실제 렌더. Claude 기존 회귀와 두 테마 시각 확인 |

범위는 1.x 구현의 경계와 현재 UI다. 미래 2.x 서버/API 구현·자동 버전 전환·저장 스키마 migration·CLI 설치/업데이트는 포함하지 않는다. 실제 지원하는 1.x 데이터를 유지하며 원문 이름/입력은 펼쳐 확인할 수 있다.

도구는 running→completed/failed/aborted/rejected/cancelled/not_executed 상태를 따른다. 초기 펼침은 기존 파일 편집/쓰기 유지, 탐색 묶음은 접힘, 셸·기타는 사용자가 펼치며 완료 뒤에도 펼침 상태를 보존한다. 텍스트→도구→텍스트 순서, 복사, 접근 가능한 버튼, 배율과 두 테마를 유지한다.

## 조사·아키텍처

원본은 저장소 밖 `orca-opencode-reference-v1.19.0`, tag v1.19.0의 SHA `733b2c627e5aec39cb33cc22373bdce33053ef2c`다. `packages/session-ui/src/components/{basic-tool,message-part}.{tsx,css}`의 BasicTool·ContextToolGroup·shell/edit/write·ReasoningPartDisplay를 읽었다. 원본은 동작/배치 참고이며 Solid 컴포넌트나 SDK native 타입을 renderer에 복제하지 않는다.

| 현재 | 변경 후 책임 |
|---|---|
| public entry가 v1 class/server 타입을 그대로 재수출하고 bootstrap이 조립 | `opencode/implementation.ts` 중립 factory 계약 → `opencode/index.ts` 현재 선택 → `v1/index.ts` 내부 서버/adapter 조립. 앱은 `SessionAdapter`만 받음 |
| OpenCode 행 내부에서 공통 ToolCard의 Claude 카드/registry를 재사용 | `harnesses/opencode/transcript/`가 행·카드·본문을 소유. 정규 ToolCall→중립 표시 모델, raw native metadata 해석은 `opencode/v1/` 아래 |
| AssistantMessage/PendingAssistant가 Claude text/reasoning을 직접 렌더 | 공통은 순서·reconcile·stream 구독, `harnesses/{claude,opencode}/transcript/`는 출력 component/style. 버전 선택은 renderer OpenCode facade 한 곳 |
| 사용자 bubble의 inline backend CSS 분기 | 공통 첨부/본문 수명 + 전용 하네스 bubble/presentation 선택 |

공통 renderer 계약은 normalized MessageSegment/ToolCall을 받고 SDK를 import하지 않는다. raw metadata→파일 diff 표시 모델의 1.x 디코더만 native key를 해석한다. 다음 2.x 구현은 별도 디코더/서버 implementation을 이 중립 포트에 연결하며, 현행 1.x 파일을 공통 코드로 끌어올리지 않는다.

MessageSegment 전수는 `reasoning/tools/ask/structured/text/error/compact/fork/subagent_notice`다. OpenCode는 text·reasoning·tools·error·structured를 전용 표현으로, 질문/경계/서브에이전트 의미는 기존 동작을 보존하는 공통 원자로 렌더한다. 도구 분류는 탐색(Read/Glob/Grep/List), 셸(Bash/PowerShell), 파일(Edit/Write/MultiEdit/patch), 웹(WebFetch/WebSearch), 작업(Task/Agent), 할 일(TodoWrite), 기타로 나누고 미지 도구에도 원문 폴백을 제공한다.

## §10 강제 지점과 V

| 자리 | 실패 의미 | 직접 oracle |
|---|---|---|
| EP-23a/b/c: CI source 경로·제품명·랜딩 export | 검사 누락 또는 잘못된 제품명 | 기존 실패 3파일의 전체 케이스를 재실행, 보고된 8건 직접 재현→통과 |
| EP-24a: 앱→public factory→v1 | 잘못된 구현 생성/종료 누락 | 실제 public factory로 생성한 adapter→SessionRuntime 테스트, server lifecycle 회귀 |
| EP-24b: import 경계 | 앱/renderer가 v1 detail 직접 참조 또는 버전 형제 참조 | 실제 ESLint 금지·허용 probe; 규칙 제거 red/원복 green |
| EP-24c: native metadata→표시 모델 | 원문/patch 손실·다른 파일 표시 | v1 toolPresentation 순수 입력/출력: edit/write/patch·오류·손상/미지 입력 |
| EP-25a: ToolGroup→전용 카드 | 탐색 묶음/순서/상태 오표시 | 실제 ToolGroup의 혼합 도구·탐색 구간·상태 DOM |
| EP-25b: 카드→펼침/본문/복사 | 클릭 무반응·완료 시 닫힘·복사 불일치 | fake DOM 실제 카드 클릭/props 갱신/clipboard wrapper, shell/file/generic |
| EP-26a: committed→하네스 segment | Claude 표현이 OpenCode로 새거나 역방향 | 실제 TranscriptView에 9종 segment·양 하네스 입력, 순서·문구·마커 관측 |
| EP-26b: live→하네스 text/reasoning | 스트리밍 동안 다른 스타일, 종료 시 중복 | 실제 PendingAssistant/TranscriptView live store 및 완료 전이 |
| EP-26c: user/meta→하네스 외형 | 사용자 입력/첨부/복사 소실 | UserMessage/TranscriptView의 사용자 text·첨부·meta, 배경/배율 회귀 및 시각 확인 |

등록은 EP-23 3자리 + EP-24 3자리 + EP-25 2자리 + EP-26 3자리 = 11자리다.

| pair | requiredness | path/자리 | oracle·선택 적대 증거 |
|---|---|---|---|
| VP-40 / R-22↔AT-22 | REQUIRED | EP-23a~c→CI | 기존 테스트 직접 결과 + 원격 job. 기존 검사 감도는 유지 |
| VP-41 / AR-09↔IT-09 | REQUIRED | EP-24a/b | factory 실제 SDK 경계·ESLint probe. boundary 규칙 제거 변이만 선택 |
| VP-42 / MD-07↔UT-07 | REQUIRED | EP-24c→EP-25 | v1 decoder의 실제 입력/출력. 직접 oracle, 변이 미선택 |
| VP-43 / R-24↔AT-24 | REQUIRED | EP-25a/b | 도구 종류·실행 상태·펼침·복사 직접 oracle |
| VP-44 / R-25↔AT-25 | REQUIRED | EP-26a/b/c | committed/live/user 실제 렌더와 시각. 직접 oracle |
| VP-45 / SD-03↔ST-03 | REQUIRED | v1 message→normalized→harness transcript | 기존 mapper/history/runtime + renderer 출력의 구간별 이음매. 테스트가 mock한 구간은 닫힘에서 제외 |
| V1 VP-05/06/07/11/18, ΔV1~5의 영향 pair | REGRESSION | 기존 서버/SDK/설정·composer/랜딩/배경/스피너·경계 | 해당 기존 테스트와 전체 운영 gate. 기존 SELF_BLOCKED·최종 시각 인수는 유지 |

게이트: 전체 lint/typecheck, 실패 3파일과 변경 관련 Vitest, ABI를 보존한 전체 테스트(필요한 DB만 Electron), scripts 경계/문서/예산 검사, main/preload/renderer build, 수정 head 원격 CI. source 검사를 수정하면 그 검사가 보던 원래 실패를 다시 주입해 감도를 확인한다. 새 구조적 proxy를 발명하지 않고 직접 행동 검사를 우선한다.

READY 대조: D-004/007/011/015~018 ↔ AC22~25 충돌 0. public SessionAdapter와 정규 DTO 유지, 추가 저장소·IPC·의존성 없음. 원본과 현재 코드의 경로 및 기존 실패 테스트 케이스를 직접 읽었고, 신규 decoder/renderer oracle은 위 자리별로 구현한다.

# [구현자 기입]

## 설계 리뷰

r1 구현. ACTIVE Decision은 유지했고 신규 패키지는 추가하지 않았다. 제품 선택을 바꿔야 하는 PLAN_GAP은 발견하지 않았다. 호스트 CLI 1.19.0의 실제 실행과 SDK/CLI 분리 근거는 [runtime-compatibility.md](runtime-compatibility.md)에 기록했다.

서버는 설정 fingerprint별로 소유하며 카탈로그만 60초 캐시한다. engine 목록 새로고침은 캐시를 우회하고 설정 변경은 다른 fingerprint를 사용한다. 만료는 모델 조회만 다시 수행하고 prompt를 재전송하지 않는다. 다른 세션이 같은 서버를 공유해도 취소는 session abort이며 pool close는 앱 종료에서만 호출한다.

## 강제 지점 전수와 V-pair 자기확인

직접 oracle은 아래 테스트의 실행 구간으로 제한했다. 실제 UI 조작·코드 읽기·typecheck만 있는 자리는 자동 잠금으로 세지 않았다. 아래 숫자는 §10을 세분한 관측 자리의 자기점검이며, 전체 호출 그래프에 누락이 없다는 증명은 아니다.

검색 명령(작업 디렉터리 app):

- `rg -n 'backend|lastBackend|harnessAgent|modelVariant|providerTool|rightPanelTarget|rightPanelTileDefinitionsForAgent' src/main src/renderer/src src/shared`
- `rg -n 'acquire|spawn|kill|close|abort|permission|question|subscribe|prompt|catalog' src/main/adapters --glob 'opencode*.ts' --glob '!*.test*'`
- `rg -n 'harnesses|settingsJson|catalogError|includeExtensions|includePlugins' src/main src/renderer/src src/shared`

| EP | 직접 잠금 / 조사 자리 | 직접 oracle 좌표와 관측 | 자동 잠금을 남긴 자리 |
|---|---:|---|---|
| EP-01 | 2/4 | chatStore.harness: `defaults to Claude, remembers model selection and sends native options`; chatReducer.harness: `switches an unsent Work draft to OpenCode Code without losing context` | ModelMenu onPick 연결, 전환 전후 Controller 인스턴스·첨부 유지. CUA에서는 둘 다 관측 |
| EP-02 | 9/12 | send.harness의 저장 backend·위조 backend/provider·await 후 비교, send.agent-profile의 실제 runtime 진입, resolve-turn.agent의 session/fork/handoff 재검증, chatReducer.harness의 LOAD_SESSION/session.updated | Send schema의 harness 값 거절, send의 source/기존 lease 비교 각각을 겨냥한 직접 테스트 |
| EP-03 | 3/3 | chatReducer.harness의 SET_MODEL·SET_AGENT_KIND, send.harness의 `rejects cross-harness and Work requests`: Code 전환/Work 거부 | 없음 |
| EP-04 | 9/10 | opencode-server의 binary·동시 시작·timeout·spawn error·health 오류·구성 격리·close, registry의 `registers an injected OpenCode adapter and closes its owned server pool`, bootstrap.shutdown의 registry close | Bootstrap 생성자의 실제 adapter/pool 구성 주입. 실제 CLI smoke는 별도 관측 |
| EP-05 | 6/6 | opencode.test의 `subscribes before admission, scopes the turn and emits each completion exactly once`, `surfaces a disconnected stream…`: subscription/admission/dedup/session scope/terminal/disconnect | 없음 |
| EP-06 | 6/6 | opencode.test의 `replies to permission and question approvals once, including rejection`, `aborts the server and cancels a pending approval when interrupted`: permission allow/reject, question reply/reject, abort/pending cancel | 없음 |
| EP-07 | 5/5 | opencode-map → opencode-history의 `reloads normalized arguments and the exact provider name/input together` → chatReducer.harness raw 보존 → TranscriptView.harness 원문 disclosure | mapper/history part/loaded part/reducer/view를 각각 관측 |
| EP-08 | 7/10 | settings-write의 `keeps equal provider names in separate harness namespaces through CRUD`(write/read/update/delete), opencode-settings/catalog, misc.runtime-catalog, EngineFormModal.harness | IPC schema, engine handler CRUD 연결, EngineCard 실제 클릭. 카드·편집은 CUA 관측 |
| EP-09 | 5/6 | settings-store의 기본값/병합/재시작, HarnessSettingsTab 렌더, opencode-server의 preferences 입력, send.agent-profile의 하네스별 instructions | SettingsTab 저장 클릭→IPC는 CUA의 메모리 fixture 관측 |
| EP-10 | 7/10 | rightPanelTiles.harness의 definitions/groups/column 필터, chatReducer.harness의 toggle/set-active/open-subagent, chatStore.harness의 stale panel reveal 거부 | title menu 연결, OPEN_TASK의 OpenCode 경로, RightPanel 렌더 전달. 지원 범주는 CUA 관측 |
| EP-11 | 3/5 | Composer.harness의 하네스별 frame, TranscriptView.harness의 본문/도구 렌더 | right panel frame·두 테마 토큰은 CUA/코드 확인. 사용자 시각 인수 대기 |
| EP-12 | 5/6 | chatStore.harness의 lastBackend 저장/준비 모델 fallback, steps.harness의 부팅 restore, chatReducer.harness의 session.updated/LOAD_SESSION | freshEntry로 새 draft를 만드는 배선의 별도 직접 테스트 |

조사 자리 83 중 직접 잠금 67, 남긴 자리 16. 이 수치를 전체 경로 전수 완료 또는 독립 검증 PASS로 해석하지 않는다.

| Pair | 자기 상태 | 근거/남긴 범위 |
|---|---|---|
| VP-01 | SELF_BLOCKED | EP-01의 UI 전환 연결은 직접 조작으로 확인, 자동 이벤트 oracle 부족 |
| VP-02 | SELF_BLOCKED | EP-02의 schema/source/lease 개별 잠금 남음 |
| VP-03 | SELF_PASS | EP-03 직접 상태·send 거부 관측 |
| VP-04 | SELF_BLOCKED | pool/registry/shutdown 동작 통과, Bootstrap 생성 배선 자동 잠금 남음 |
| VP-05 | SELF_PASS | EP-05 실제 SDK HTTP/SSE fixture 통과 |
| VP-06 | SELF_PASS | EP-06 승인/거절/중단 wire 관측 |
| VP-07 | SELF_PASS | EP-07 정규화·원문 roundtrip/표시 관측 |
| VP-08 | SELF_BLOCKED | EP-08 handler/schema/card 연결 자동 잠금 남음 |
| VP-09 | SELF_BLOCKED | EP-09 설정 UI 저장→IPC 자동 잠금 남음 |
| VP-10 | SELF_BLOCKED | EP-10 메뉴/OPEN_TASK/렌더 연결 자동 잠금 남음 |
| VP-11 | SELF_BLOCKED | EP-11 두 테마 직접 조작 완료, 최종 시각 인수 대기 |
| VP-12 | SELF_BLOCKED | EP-12 freshEntry 배선 자동 잠금 남음 |
| VP-13 | SELF_BLOCKED | send→runtime, SDK, history 경계별 결과 있음; VP-02 미잠금 상속 |
| VP-14 | SELF_BLOCKED | VP-08/09/11 미잠금 상속 |
| VP-15 | SELF_BLOCKED | transport/process 동작 통과; VP-04 생성 배선 미잠금 상속 |
| VP-16 | SELF_BLOCKED | VP-02 미잠금 상속; raw history 통과 |
| VP-17 | SELF_BLOCKED | VP-01/10/11 미잠금 상속 |
| VP-18 | SELF_PASS | mapper/catalog/settings 순수 출력 및 실제 파일 CRUD 통과 |
| VP-19 | SELF_BLOCKED | reducer/policy/default 함수 관측, freshEntry 자동 잠금 남음 |

SELF_PASS 5 · SELF_BLOCKED 14 = REQUIRED 19. REGRESSION 지정 pair는 없으며 Claude 관련 기존 실행 집합을 별도로 실행했다. 위 부족분은 구현 결함 발견이나 제품 결정 변경이 아니라 직접 oracle 범위의 한계다.

## 이번 라운드 수정의 잠금

| 대상 | 민감도 관측 | 복원 |
|---|---|---|
| send의 저장 backend→adapter 배선 | 실제 runtime 진입 테스트에서 registry.get을 Claude로 고정하면 assertion 1건 실패 | 원본 바이트 복원 후 대상 1건 통과 |
| send의 하네스 instructions 주입 | 같은 테스트에서 instructions를 제거하면 assertion 1건 실패 | 원본 바이트 복원 후 대상 1건 통과 |
| reportSites의 새 T37 오류 보고 | 기존 mutation suite의 report 제거와 같은 파일의 6개 형제 event 맞바꿈 모두 검출 | 프로덕션 변경 없이 문자열 mutant 검사 |
| reportSites의 새 CONSUMED 3자리 | AgentEnvironmentView delete catch, HarnessSettingsTab load/save catch에 금지 보고를 넣으면 각각 검출 | 프로덕션 변경 없이 문자열 mutant 검사 |

선택 증거 0 · 이전 파생 이슈 인용 변이 0 · 새 oracle 계열 4 = 표 행 4. 개별 주입은 send 2 + 오류 보고 7 + CONSUMED 3 = 12. 그 밖은 해당 없음 — 직접 행동 oracle이다. 이 감도 결과로 위 SELF_BLOCKED를 SELF_PASS로 올리지 않았다.

## Product/UX 파생 검토

실제 production React 컴포넌트와 store를 임시 Electron 창에 조립하고 Computer Use로 클릭·입력했다. IPC는 메모리 fixture였으며 사용자 설정·모델 인증을 쓰지 않았다. native 원본 디자인 근거는 [design-evidence.md](design-evidence.md)다.

| 시나리오 | 관측 |
|---|---|
| OpenCode ↔ Claude 모델 선택 | 동일 초안과 readme.txt 첨부 유지, 해당 하네스 컨트롤·transcript로 제자리 변경 |
| 생성된 세션의 모델 메뉴 | 같은 하네스만 노출, Escape로 닫힘 |
| OpenCode composer | build/모델 표시명/variant, 파일 추가, 하단 전송 버튼. Claude 전용 skill/plugin 제안 제거 |
| 우측 패널 | 검토→변경사항, 세션→계획만 노출 |
| 도구 원문 | edit의 filePath/oldString/newString 보존, diff +1/-1 표시 |
| 하네스 설정 | 수정→저장 뒤 dirty 해제. 로딩/오류/재시도 UI 제공 |
| OpenCode 엔진 편집 | 하네스 변경 불가, 잘못된 JSON 입력 시 한국어 오류와 저장 비활성 |
| 밝은/어두운 테마 | composer·본문·도구·패널 토큰과 전송 버튼 대비 확인 |

직접 조작 중 발견한 공통 Button의 위치 충돌은 OpenCode 전송 버튼을 전용 요소로 바꿔 수정했다. 최종 회귀에서는 lastBackend 저장 실패가 무시되던 경로를 reportError로 바꿨고, stale 패널 reveal도 backend 정책을 통과하게 했다.

## 놓친 잠재 문제 + 대응

- 실제 인증·외부 모델을 사용하는 설치 앱 전체 E2E는 실행하지 않았다. 실제 CLI smoke는 격리된 로컬 응답 fixture로 실행했다.
- CLI 2.x는 현재 SDK의 legacy API와 호환되지 않는다. 비호환 health 응답을 명시적 오류로 처리하고 소유 child를 정리한다.
- CLI 버전을 내릴 때 새 버전이 쓴 데이터가 호환되지 않을 수 있다. 호환성 smoke는 버전별 새 데이터로 수행했으며 사용자 데이터는 수정하지 않았다.
- SSE는 durable replay가 없다. 단절 시 오류로 끝내며 prompt 자동 재전송은 없다.
- provider 세션 생성 뒤 Orca 기록 전 실패하면 provider 쪽 고아 세션 가능성이 남는다(§13 기존 리스크).
- 최종 시각 인수와 위 직접 oracle 부족분은 독립 검증에 남긴다. 알려진 게이트 실패를 정상으로 처리하지 않는다.

## 구현 보고

대상: (r1 구현 — 좌표는 INDEX). AC 자기보고는 기능 관측이며 위 자리별 자동 잠금과 구분한다.

| AC | 결과 | 이번 관측 |
|---|---|---|
| AC1 | ✅ | 실제 모델 메뉴 전환에서 초안·첨부 유지, Composer/reducer/store 테스트 |
| AC2 | ✅ | 저장 OpenCode 세션이 Claude 전역 선택과 무관하게 실제 runtime 진입, 위조 요청 거부 |
| AC3 | ✅ | 모델 선택→Code, Work reducer·main send 거부 |
| AC4 | ✅ | 동시 시작 합치기, 실패 후 재시도, 소유 child 종료와 bootstrap shutdown |
| AC5 | ✅ | 실제 SDK fixture 및 CLI 1.19.0 text/read-tool/telemetry/terminal |
| AC6 | ✅ | permission/question 응답·거절·abort/pending 승인 취소 wire |
| AC7 | ✅ | normalized/raw 입력 history→loaded part→reducer→도구 원문 |
| AC8 | ✅ | 하네스 namespace CRUD, 실제 catalog, 폼 잠금·JSON 오류, 카드 조작 |
| AC9 | ✅ | 별도 저장·재시작, server preferences와 instructions 분리 적용, UI 저장 |
| AC10 | ✅ | 패널 policy/reducer/store 거부, CUA 지원 범주 확인 |
| AC11 | ⚠️ | 두 하네스 SSR와 두 테마 CUA 확인. 최종 사용자 시각 인수 대기 |
| AC12 | ✅ | 기본 Claude·lastBackend 저장·부팅 restore·기존 세션 유지·카탈로그 fallback |

검산: ✅11 · ⚠️1 · ❌0 = AC 총 12. Criteria-Met은 11/12이며 독립 검증 결과가 아니다.

최종 실행 집합(작업 디렉터리 app):

| 게이트 | 관측 |
|---|---|
| OpenCode 및 영향 테스트 | 23파일 119케이스 통과. 명령 A |
| 부팅·종료·오류 보고 회귀 | 6파일 315케이스 통과. 명령 B |
| Chromium transport 경계 | no-node-fetch.test.ts 1파일 3케이스 통과 |
| Git/child_process 경계 | node --test scripts/git-boundary.test.mjs: 14케이스 통과 |
| 타입 검사 | npm run typecheck: node/web/test 3구성, 진단 0, exit 0 |
| 린트 | npm run lint: error 0, 기존 useTranscriptVirtualizer의 incompatible-library warning 1, exit 0 |
| 빌드 | electron-vite build: main/preload/renderer 모두 산출, exit 0 |
| 문서 | check-doc-inventory.mjs --check: generated/prose/relative links 통과 |
| 공백 | git diff --check: 오류 0 |

명령 A: `node node_modules/vitest/vitest.mjs run opencode .harness.test.ts resolve-turn.agent.test.ts send.agent-profile.test.ts settings-store.test.ts settings-write.test.ts HarnessSettingsTab.test.ts attachMenuModel.test.ts useMentionAutocomplete.test.ts modelSelection.test.ts --maxWorkers=2`

명령 B: `node node_modules/vitest/vitest.mjs run src/main/adapters/registry.test.ts src/renderer/src/app/boot/steps.harness.test.ts src/renderer/src/shared/errors/reportSites.registry.test.ts src/main/error-report.registry.test.ts src/main/app/handlers/misc.runtime-catalog.test.ts src/main/app/bootstrap.shutdown.test.ts --maxWorkers=1 --testTimeout=120000`

이전 광역 회귀는 157파일 중 156파일 통과·Composer SSR fixture 1파일 실패였다. fixture 수정 뒤 해당 Composer·패널 5케이스와 위 최종 실행 집합은 통과했다. 광역 157파일 전건 재실행 통과로 보고하지 않는다. 부팅/카탈로그 확장 실행의 나머지 11파일은 통과했고, 실패했던 오류 보고 두 파일은 명령 B로 재검증했다.

## Review Signals

### main 리베이스 검증 (2026-10-14)

통합 완료 — 원격 main의 0261까지 포함하고, 번호 충돌을 피하려 이 핸드오프를 0262로 옮겼다. OpenCode adapter/send는 리베이스 전과 동일하며, Claude adapter와 창 생성부는 main의 bypass·production DevTools 수정과 동일하다(`git diff` 각 경로 0건).

| 검사 | 관측 |
|---|---|
| 관련 회귀 | 명령 A에 `claude.executable-option.test.ts browser-session.devtools.test.ts browser-window-devtools.test.ts` 추가: 26파일 144케이스 통과 |
| 정적 검사·빌드 | typecheck node/web/test, 0261 변경 파일 ESLint, electron-vite build 통과 |
| production DevTools | `node ../docs/handoff/0261-bypass-flag-prod-devtools/check-prod-bundle.mjs`: 모든 창 생성자 `devTools:false` |
| 문서 기준값 | 구현으로 사라진 상태 표식 5곳을 `0260-docs-handoff-resync/status-marks.tsv`에서 제거 |
| 문서 검사 한계 | drift-check의 단언·커버리지 차집합 0. Windows Git Bash가 `🚧`를 찾지 못하는 기존 표식 1곳은 main의 동일 문서에서도 재현되어 기준값 유지 |

미충족 시각 인수·직접 oracle 범위와 Criteria-Met 11/12는 유지한다. 리베이스 검사는 독립 검증을 대체하지 않는다.

r1 최초 구현을 이어서 완료한 턴이다. verify/FAIL 이후 재구현은 아니다. 기존 native SDK 조사와 제품 실행·UI 검증을 구분했다. 사용자 CLI 변경에 따라 호환성 조사 범위가 늘었지만 배포 결정을 변경하지 않았다.

샌드박스의 사용자 디렉터리 lstat EPERM은 동일 명령을 승인된 실행으로 재시도해 해소했다. 오류 보고 전수 검사 첫 실행의 main 2건은 20초 시간 초과였고 단일 worker 재실행에서 통과했다. renderer 2건은 새 catch 누락/무시 경로였으며 수정 후 회귀 통과했다. ABI를 전환하는 npm test/prebuild는 실행하지 않았다.

# [구현자 기입 — r1.2 dev 부팅 복구]

## 설계 리뷰

선조치 — CommonJS main이 ESM 전용 SDK export를 `require`하는 빌드 결함을 재현했다(`ERR_PACKAGE_PATH_NOT_EXPORTED`). main 번들에 SDK를 포함하도록 수정했으며 ACTIVE Decision·AC·패키지 버전은 변경하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

운영 gate의 앱 부팅 경계가 이번 수정 대상이다. SDK 런타임 import는 `opencode.ts`의 `/v2/client`이며, mapper·catalog는 type-only import다(`rg '@opencode-ai/sdk' app/src/main`). 기존 EP-01~12 및 VP-01~19의 직접 oracle 부족분은 r1 표 그대로 남기고, 이번 부팅 관측으로 pair를 SELF_PASS로 올리지 않았다.

## 이번 라운드 수정의 잠금

해당 없음 — 실제 CommonJS 해석 오류 → 수정된 main 번들 → `npm run dev` 부팅 완료를 직접 관측했다. 선택 증거 0 · 인용 변이 0 · 새 구조적 oracle 0 = 잠금 표 행 0. 이번 관측은 자동 회귀 테스트 추가가 아니다.

## Product/UX 파생 검토

복구 확인 — 오류 상태의 개발 앱을 재시작한 뒤 `boot.sequence.completed`·`app.start.completed`와 창 `Responding=true`를 확인했다. 서버/모델 호출 및 최종 시각 인수를 새로 검증한 결과는 아니다.

## 놓친 잠재 문제 + 대응

SDK 오류 이후 로컬 SQLite 네이티브 모듈의 ABI 127/140 불일치가 나타났다. predev가 rebuilt를 출력했지만 실제 로드는 실패했으므로 `@electron/rebuild --force`로 복구하고 Electron 메모리 DB 조회로 ABI 140을 확인했다. ABI 보장 스크립트의 잘못된 성공 보고는 이번 SDK 번들 수정과 별개이며, 재현 근거를 [호환성 기록](runtime-compatibility.md)에 남겼다.

## 구현 보고

대상: (r1.2 구현 — 좌표는 INDEX). r1 AC 자기보고 ✅11 · ⚠️1 · ❌0 = 12를 유지하며 이번에는 새 AC 충족을 주장하지 않는다.

| 검사 | 관측 |
|---|---|
| 관련 회귀 | 명령 A: 22파일 112케이스 통과, 사용자 경로 lstat EPERM 1파일 7케이스 실패. 동일 실패 파일을 승인된 실행으로 재검증해 7케이스 통과 |
| 린트·형식 | 전체 lint error 0, 기존 incompatible-library warning 1; config ESLint·Prettier 통과 |
| 타입 | node/web/test 3구성 진단 0 |
| 빌드·실행 | production main/preload/renderer 산출; 실제 dev 부팅 완료 및 Electron ABI 140 메모리 DB 조회 성공 |
| 문서·공백 | doc inventory generated/prose/relative links 통과, diff whitespace 오류 0 |

## Review Signals

r1.2, 사용자 dev 부팅 실패 보고에 따른 운영 gate 복구다. 기존 build 검증은 파일 산출까지만 확인해 런타임의 ESM export 오류를 발견하지 못했다. 기존 시각 인수와 직접 oracle 부족 범위는 독립 검증에 남긴다.

# [구현자 기입 — r1.3 무응답 복구]

## 설계 리뷰

선조치 — 사용자 대화는 `chat.turn.completed` 직후 `chat.steer.orphaned`로 끝났다. SessionRuntime의 commit 뒤 어댑터가 submitting 전용 `canSubmitInitial`을 다시 검사하는 중복 소유가 원인이며, 어댑터의 검사·commit 호출을 제거했다. ACTIVE Decision·AC·데이터 포맷은 변경하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

수정 지점은 OpenCode `eventBatches`의 HTTP prompt 진입 1곳이다. `rg 'canSubmitInitial|commitInitialSubmission' app/src/main`으로 공통 런타임의 spawn·pushTurn 접수와 OpenCode 중복 호출을 대조했다. 새 직접 oracle은 `opencode-runtime.test.ts:delivers a reply after runtime admission for session %s`이며 실제 queue→buildTurnRequest→runtime→adapter→SDK를 실행한다.

신규/기존 세션과 각 후속 턴의 응답 경계는 관측했지만, HTTP/SSE는 로컬 fixture이고 상위 handleChatSend·coordinator·history·renderer는 이 테스트에 포함하지 않는다. 기존 EP-01~12 및 VP-01~19의 직접 oracle 부족분은 유지하고 이번 결과로 SELF_PASS 범위를 늘리지 않았다.

## 이번 라운드 수정의 잠금

직접 회귀 — 수정 전 새 통합 테스트 4개 중 응답 2개·HTTP 오류 1개가 실패하고 접수 철회 1개는 통과했다. 수정 후 4개 모두 통과하며 첫 턴·후속 턴의 HTTP 전송과 message.completed·turn.ended를 단언한다. 선택 증거 0 · 인용 변이 0 · 새 구조적 oracle 0 = 잠금 표 행 0; 직접 행동 oracle이다.

## Product/UX 파생 검토

복구 확인 — 실제 CLI 1.19.0과 로컬 합성 모델에서 첫 턴·후속 턴 모두 입력 echo·응답 본문·telemetry·종료를 관측했다([호환성 기록](runtime-compatibility.md)). 접수 철회는 런타임에서 provider 호출 전에 거부하고, HTTP 거부는 echo나 가짜 응답 없이 error로 반환한다.

## 놓친 잠재 문제 + 대응

기존 어댑터 단독 테스트는 commit 콜백을 항상 true로 만들어 실제 큐의 submitted 상태를 재현하지 못했다. 새 테스트는 실제 큐와 요청 조립을 연결했고, 철회 거부는 올바른 소유자인 런타임에서 검증한다. 실제 모델 인증·외부 서비스 응답과 기존 시각 인수는 이번 로컬 fixture 관측 범위 밖이다.

## 구현 보고

대상: (r1.3 구현 — 좌표는 INDEX). r1 AC 자기보고 ✅11 · ⚠️1 · ❌0 = 12를 유지하며 이번 수정으로 미확인 AC를 올리지 않는다.

| 검사 | 관측 |
|---|---|
| 회귀 | `vitest run opencode-runtime.test.ts opencode.test.ts session-runtime.test.ts pending-message-queue.test.ts --maxWorkers=2`: 4파일 139케이스 통과 |
| 타입·린트 | node/web/test 진단 0; 전체 lint error 0, 기존 incompatible-library warning 1 |
| 빌드 | electron-vite build main/preload/renderer 산출 완료 |
| 실제 CLI | 격리 데이터·로컬 합성 모델 첫 턴/후속 턴 모두 commit 1회, 응답 본문과 turn.ended 관측 |
| 문서·공백 | doc inventory generated/prose/relative links 통과, diff whitespace 오류 0 |

## Review Signals

r1.3, 사용자 무응답 보고에 따른 구현 결함 수정이다. r1 어댑터 단독 테스트와 mock 어댑터를 사용한 send 배선 테스트 사이의 실제 admission 상태 경계가 빠져 있었다. 원래의 직접 oracle 부족 보고를 독립 검증 통과로 바꾸지 않았다.

# [구현자 기입 — r1.4 설정 불러오기]

## 설계 리뷰

ΔV1 구현 완료. D-010의 버튼·배선을 기존 편집기 헤더에 적용했고, D-008의 하네스 격리를 IPC 검증과 reader 선택에 유지했다. 신규 의존성·저장 포맷 변경과 설계 대비 차이는 없다.

## 강제 지점 전수와 V-pair 자기확인

검색: `rg -n 'importUserSettings|ImportEngineUserSettingsSchema|readUserOpenCodeSettings|cancelImport|importRevision' app/src`. production의 폼·wrapper·preload·handler·reader를 추적했다.

| 강제 자리 | 직접 oracle / 관측 |
|---|---|
| EP-13a/f: 클릭→API, 결과→편집기 | EngineFormModal.import.test.ts: `loads selected harness into the draft and imports then submits without changing the provider` — 두 하네스 요청·편집기·제출 값 관측 |
| EP-13b/c: wrapper→preload→invoke | preload/index.test.ts: `imports settings for the selected harness through the renderer wrapper and exposed preload` — 실제 노출 객체·하네스 payload·반환 값 |
| EP-13d/e: 검증→handler→reader→파일 | engine.import.test.ts: `reads the selected harness global file and preserves legacy Claude callers`, `respects XDG_CONFIG_HOME without accepting renderer paths`, invalid payload 5종 — 실제 handle 검증과 임시 파일 |
| EP-14a: 재클릭·저장 차단 2자리 | EngineFormModal.import.test.ts: `prevents duplicate imports and retries after failure` — 같은 처리기 연속 클릭은 요청 1회, 로딩 중 저장 disabled |
| EP-14b: 하네스·공급자·본문·취소 버튼·모달 dismiss·unmount 6자리 | 같은 파일: `ignores stale results and errors after harness changes`, `discards responses after %s` — 지연 값이 새 초안을 덮지 않음 |
| EP-14c: 성공·오류·finally 3자리 | 같은 파일: `ignores stale results and errors after harness changes` — 옛 resolve/reject 모두 무시, 현재 요청의 로딩 유지 후 정상 적용 |

EP-13은 6자리, EP-14는 3항목을 11자리로 세분해 직접 관측했다. Modal 자체의 Escape/백드롭 처리는 기존 공용 컴포넌트 계약이며 이번 테스트는 폼에 전달한 dismiss 콜백부터 실행한다.

VP-20~24는 위 oracle로 SELF_PASS다. VP-08/14/18의 영향 회귀는 settings-write·engine.deployment·engine.runtime-catalog·opencode-settings·기존 EngineFormModal.harness 테스트에서 통과했으며 V1의 미잠금 범위를 승격하지 않는다.

## 이번 라운드 수정의 잠금

직접 행동·반환 값 oracle을 사용했다. 선택 증거 0 · 인용 변이 0 · 새 구조적 oracle 0 = 잠금 표 행 0. UI 테스트는 production 컴포넌트와 API wrapper를 실행하며 React/DOM과 IPC의 외부 경계를 모형한다.

## Product/UX 파생 검토

불러오기는 공급자 이름을 유지하며 초안만 바꾼다. 부재·읽기 실패·IPC 실패는 본문 보존과 하네스별 오류로 표시하고 재시도할 수 있다. 잘못된 JSON도 원문을 편집할 수 있고 저장은 유효해질 때까지 비활성화된다.

## 놓친 잠재 문제 + 대응

기존 Claude 불러오기도 전환·편집 뒤 지연 응답에 취약해 공통 폼에서 함께 보호했다. 실제 사용자 설정 파일 내용과 인증 저장소를 읽거나 변경하지 않았고, OS 파일 테스트는 임시 디렉터리만 사용했다. JSONC 변환·프로젝트 설정 병합·외부 인증 이관은 ΔV1 비범위다.

## 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC13 | ✅ | UI 두 하네스 호출·원문 표시·제출, 실제 IPC 검증→파일 읽기, preload payload 보존 |
| AC14 | ✅ | 로딩 재클릭·저장 차단, 전환/수정/닫기 이후 응답·오류 무효화, 실패 후 재시도 |

증분 검산: ✅2 · ⚠️0 · ❌0 = 신규 AC 2. 기존 자기보고 11/12를 승계한 누적은 ✅13 · ⚠️1 · ❌0 = AC 14이며, 독립 검증과 AC11 최종 시각 인수는 대기한다.

| 게이트 | 관측 |
|---|---|
| 엔진·IPC 회귀 | 12파일 89케이스 통과: settings-write, opencode-settings, claude-settings, engine.deployment, engine.runtime-catalog, features/engine, preload/index, engine.import |
| 오류 보고 회귀 | reportSites.registry.test.ts 1파일 225케이스 통과 |
| 타입 | 전체 node/web/test 통과. 첫 실행의 테스트 mock 타입 2건은 명시적 함수 타입으로 수정 후 재실행 |
| 린트 | 전체 error 0, 기존 useTranscriptVirtualizer warning 1. 타입 수정한 테스트의 ESLint 재검사 오류 0 |
| 빌드 | electron-vite build의 main/preload/renderer 산출 완료 |
| 문서·공백 | doc inventory generated/prose/relative links 통과; git diff --check 오류 0 |

타입 수정 뒤 폼 동작 14케이스를 재실행해 통과했다. 이 재실행은 89케이스에 중복 합산하지 않는다.

## Review Signals

r1.4는 사용자 추가 요구에 따른 ΔV1 구현이다. 설정 불러오기에서 누락됐던 하네스 선택 경계를 보완했고, 기존 V1 시각 인수·직접 oracle 부족 보고는 독립 검증에 남긴다.

# [구현자 기입 — r1.5 새 대화 화면]

## 설계 리뷰

ΔV2 구현 완료. D-011의 공통 배경과 D-012/013의 OpenCode 원본 로고·랜딩 순서를 적용했다. Claude/프로젝트 랜딩은 기존 구성이며 신규 의존성·IPC·저장 포맷 변경은 없다. 두 화면이 공통 입력 컨트롤러를 유지하도록 ColumnWrap의 조건부 컴포넌트 타입을 없앴다.

## 강제 지점 전수와 V-pair 자기확인

검색: `rg -n 'openCodeLanding|afterComposerInput|opencode-landing-context|appearance="opencode"|<ReadingColumn|bg-bg|from-bg'`를 NewChatLandingPage·Composer·CwdPanel·ChatTile·TranscriptView·ReadingColumn에 적용했다.

| 강제 자리 | 직접 oracle / 관측 |
|---|---|
| EP-15a/b/c/d/e: 부모·fade·본문 5자리 | ChatTile.harness.test.ts의 `shares the transcript background and fades for %s`가 실제 ChatTile→TranscriptView를 렌더해 공통 배경 및 fade를 관측. TranscriptView.harness.test.ts는 본문 출력도 확인 |
| EP-16a/b/c: backend→페이지→Composer→하단 컨텍스트 3자리 | NewChatLandingPage.harness.test.ts의 `renders the harness landing and preserves draft and attachment state`가 실제 페이지·컴포저·입력·경로 패널의 DOM 순서를 하네스 왕복마다 관측 |
| EP-16d: 패널→폴더/브랜치 제어 | 같은 파일의 `selects workspace and branch from the footer`: 실제 CwdButton·BranchChip·BranchMenu·WorktreeToggle 클릭, 선택 경로의 status/checkout 입력, 격리 ON의 유예와 checkout 추가 호출 없음 |
| EP-17a/b/c: 페이지 자식·flush wrapper·입력 슬롯 수명 3자리 | 같은 왕복 테스트에서 실제 textarea에 넣은 초안과 useAttachments가 수집한 파일이 유지됨 |

등록 5+4+3=12자리를 확인했다. 계획의 CwdPanel.harness.test.ts 좌표는 중복 fixture를 만들지 않고 실제 부모 경로를 포함하는 NewChatLandingPage.harness.test.ts의 동일 이름 케이스로 합쳤다. 테스트의 React/DOM·IPC·store 경계는 모형이며 page→Composer→입력/첨부·컨텍스트는 production 코드다. 실제 모델 선택의 store 변경 정책은 이번 테스트의 범위 밖이다.

VP-25~28은 위 직접 oracle과 실행 화면 관측으로 SELF_PASS다. V1 VP-01/11의 영향 회귀는 Composer.harness·modelSelection·agentModeLanding·ChatTile.workLifetime 및 기존 분기/격리 테스트에서 확인했으며 기존 직접 oracle 부족분은 유지한다.

## 이번 라운드 수정의 잠금

선택 적대 증거 0 · 인용 변이 0 · 새 소스 스캔 0 = 잠금 표 행 0. 배경은 실제 렌더의 스타일 토큰과 두 테마 화면을 함께 확인했고, 입력 보존은 사용자 입력/첨부 결과를 직접 관측했다. 기존 CwdPanel의 단일 JSX 호출 형태 검사는 실제 하네스별 앞/뒤 렌더 순서 검사로 대체했다. typeScale의 ReadingColumn 검사는 prop 추가를 허용하도록 태그 경계로 바꿨고 기존 검사 범위는 유지했다.

## Product/UX 파생 검토

실행 중인 Orca 창을 Computer Use로 조작해 새 대화의 원본 워드마크·컴포저·아래 경로 행, OpenCode/Claude 기존 대화의 같은 배경을 white/dark에서 확인했다. 새 메시지를 전송하지 않았고 테마는 원래 white로 복원했다. non-Git 경로의 조회 placeholder가 사라지고 폴더 제어가 유지되는 것도 화면에서 관측했다. 저장소 밖 참조 소스와 인증/사용자 설정 내용은 커밋에 포함하지 않는다.

## 놓친 잠재 문제 + 대응

- flush 조건으로 div↔ReadingColumn을 바꾸면 하네스 전환 때 하위 입력이 remount될 수 있었다. 동일 ReadingColumn의 외형만 바꾸고 실제 초안·첨부 왕복 회귀로 보완했다.
- 추가 typeScale 회귀에서 기존 OpenCode 도구 행의 13px 고정 크기가 transcript 배율 계약을 어기는 것을 발견했다. 기본 13px을 유지하며 배율 calc와 비례 행간으로 수정해 설정을 따르게 했다.
- 문서 검사기는 ignored clone의 README도 읽어 sparse checkout의 상대 링크를 실패로 보고했다. 검사 규칙을 바꾸지 않고 clone을 `%TEMP%/orca-opencode-reference-v1.19.0`으로 옮겼고 원본 SHA를 다시 확인했다.
- 네이티브 시각 관측은 현재 창 크기에서 수행했다. 짧은 창의 overflow는 코드에 허용했지만 여러 해상도의 자동 시각 회귀는 수행하지 않았다.

## 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC15 | ✅ | 본문·두 부모·두 fade 공통 bg, 두 하네스/두 테마 실행 화면 |
| AC16 | ✅ | OpenCode 로고→입력→경로, 원본 폭/간격, 경로·브랜치·격리 조작, 초안/첨부 보존 |

증분 ✅2 · ⚠️0 · ❌0 = 2. 누적 ✅15 · ⚠️1 · ❌0 = 16. AC11 최종 사용자 시각 인수와 독립 검증은 대기한다.

| 게이트 | 관측 |
|---|---|
| 랜딩·composer·transcript·branch 회귀 | 명령 A: 12파일 39케이스 통과 |
| 폭·텍스트 배율·기존 페이지/세션 수명 | 명령 B: 4파일 27케이스 통과. TranscriptView 3케이스는 A와 중복이며 합산하지 않음 |
| 타입 | 전체 node/web/test 통과 |
| 린트 | 전체 오류 0, 기존 useTranscriptVirtualizer warning 1. 후속 도구 행·typeScale 변경도 targeted ESLint 통과 |
| 빌드 | 도구 행 배율 수정 후 electron-vite main/preload/renderer 재빌드 통과 |
| 문서·공백·참조 소스 | doc inventory generated/prose/relative links 통과; diff whitespace 오류 0; clone은 저장소 밖이며 원본 SHA 일치 |

명령 A: `node node_modules/vitest/vitest.mjs run NewChatLandingPage.harness.test.ts CwdPanel. BranchChip. ChatTile.harness.test.ts TranscriptView.harness.test.ts Composer.harness.test.ts Composer.activity.test.ts Composer.requirements.render.test.ts modelSelection.test.ts --maxWorkers=2`

명령 B: `node node_modules/vitest/vitest.mjs run agentModeLanding.render.test.ts typeScale.test.ts ChatTile.workLifetime.test.ts TranscriptView.harness.test.ts --maxWorkers=2`

## Review Signals

r1.5는 사용자 추가 요구 ΔV2 구현이며 verify 실패 뒤 재구현이 아니다. 실제 앱 화면을 확인했고 테스트는 입력 수명과 경로/브랜치 조작에 집중했다. 기존 미검증 범위·독립 검증 대기는 유지한다.

# [구현자 기입 — r1.6 응답 스피너]

## 설계 리뷰

ΔV3 구현 완료. OpenCode 원본의 격자·밝기·주기·지연을 React/CSS로 이식하고 D-004에 따라 OpenCode 세션에 적용했다. 신규 의존성·공개 계약·진행 lifecycle 변경은 없다. PLAN_GAP은 발견하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

`rg -n 'StatusLine|PendingAssistantStatus|<PendingAssistant'`로 transcript 호출부를 확인하고, 전체 renderer의 `<StatusLine|<SparkSpinner|<OpenCodeSpinner`도 대조했다.

| 강제 자리 | 관측 |
|---|---|
| EP-18a 빈 교환 | TranscriptView→PendingAssistant→PendingAssistantStatus의 실제 렌더에 OpenCode SVG 1개 |
| EP-18b 사용자 메시지 뒤 | Exchange의 pending 분기에서 같은 SVG 1개 |
| EP-18c 어시스턴트 본문 뒤 | AssistantTurn의 별도 PendingAssistantStatus에서 같은 SVG 1개 |
| EP-18d 세션→StatusLine | actual store 시드의 backend가 PendingAssistantStatus selector를 통해 전달됨. backend를 Claude로 고정하면 OpenCode 단언 실패 |
| EP-18e StatusLine→SVG | OpenCode는 16개 rect 중 모서리 4개 숨김·중앙 4개/외곽 8개 점멸. Claude는 기존 SparkSpinner |

EP-18은 5자리다. transcript 테스트가 두 하네스×세 경로의 진행 표시와 telemetry/turn.aborted 후 제거를 확인했다. SSR의 구독 훅만 actual 활성 store 스냅샷을 읽도록 연결했으며 PendingAssistantStatus·StatusLine·SVG·reducer는 production 구현이다. 서브에이전트 패널은 기존 StatusLine 기본값을 사용한다.

VP-29/30 SELF_PASS. VP-11 영향 회귀는 기존 렌더·중단·배경 상태·Spark CSS·텍스트 배율 테스트로 통과했으며 V1의 직접 oracle 부족분과 AC11 최종 시각 인수는 유지한다.

## 이번 라운드 수정의 잠금

| 새 oracle | 주입 / 관측 / 복원 |
|---|---|
| 실제 transcript 하네스 배선 | PendingAssistantStatus의 backend prop을 Claude로 고정. OpenCode 기대 SVG 1개→실제 0개로 1 assertion red, Claude 케이스 green. bytes 원복 후 관련 전체 7파일 48케이스 green |

선택 적대 증거 0 · 인용 변이 0 · 새 배선 oracle 1 = 표 행 1. 도형·접근성·타이밍은 실제 렌더 출력의 직접 oracle이며, 추가 구조 스캔 oracle은 만들지 않았다.

## Product/UX 파생 검토

production StatusLine과 빌드 CSS를 담은 임시 페이지를 Computer Use로 열어 두 테마의 18px 격자와 다른 시점의 opacity 변화를 관측했다. CSS에서 reduced-motion 조건의 animation:none 출력도 확인했다. SVG는 장식으로 숨기고 상태 줄의 aria-live/label을 유지한다. 실제 OS 감속 모션 설정 변경과 새 모델 요청은 수행하지 않았다.

## 놓친 잠재 문제 + 대응

- AssistantTurn은 PendingAssistant의 상태 표시를 끄고 별도 상태 줄을 렌더한다. 상위 openCode prop에만 의존하지 않고 상태 줄의 세션 selector에서 하네스를 전달해 세 경로를 함께 처리했다.
- 기존 Spark CSS 색상 테스트가 같은 hex 색의 대소문자를 다르게 취급했다. production 색상은 그대로 두고 비교만 소문자로 정규화했다. 고정색 선언 수·값·테마 재정의 금지 단언은 유지했다.
- 완료 신호 turn.ended는 턴을 닫는 이벤트가 아니다. 테스트의 완료 입력을 실제 종료 경계인 telemetry로 정정했으며 production lifecycle은 수정하지 않았다.
- 원본과 같이 칸의 위상은 모듈 초기화 때 고정한다. 경과 시간 재렌더가 애니메이션을 다시 시작하지 않으며 React 프레임 타이머를 추가하지 않았다.

## 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC17 | ✅ | 두 하네스×세 진행 경로, 완료/중단 제거, SVG·aria·안정된 타이밍, 두 테마의 실제 CSS 애니메이션 |

증분 ✅1 · ⚠️0 · ❌0 = 1. 기존 15/16을 승계한 누적 ✅16 · ⚠️1 · ❌0 = 17. AC11 최종 사용자 시각 인수와 독립 검증은 대기한다.

| 게이트 | 관측 |
|---|---|
| 관련 Vitest | 7파일 48케이스 통과. 하네스 강제 변이에서 1 assertion red, 원복 후 동일 집합 green |
| 타입 | 전체 node/web/test 통과 |
| 린트 | 전체 오류 0, 기존 useTranscriptVirtualizer warning 1. 후속 테스트 수정의 targeted ESLint 오류 0 |
| 빌드 | electron-vite main/preload/renderer 통과. 기존 SubAgentTileContent 혼합 import 경고 유지 |
| 문서·공백 | inventory generated/prose/relative links 통과, diff whitespace 오류 0 |
| 참조 제외 | 원본 clone은 저장소 밖, 임시 시각 페이지는 ignored `.tmp`, 사용자 첨부는 미추적 상태 유지 |

명령: `node node_modules/vitest/vitest.mjs run StatusLine.harness.test.ts TranscriptView.harness.test.ts StatusLine.interrupted.test.ts statusLine.render.test.ts statusLine.background.test.ts sparkCss.test.ts typeScale.test.ts`.

## Review Signals

r1.6은 사용자 추가 요구 ΔV3이며 verify 실패 뒤 재구현이 아니다. 기존 스피너·상태 lifecycle을 유지하면서 하네스 선택 경계에 직접 렌더 검사를 추가했다. 감속 모션은 빌드된 조건부 CSS까지 확인했고 OS 설정을 바꾸는 실기는 남겼다. 기존 V1 미검증 범위와 독립 검증 대기는 유지한다.

# [구현자 기입 — r1.7 제품 v2 API 제거]

## 설계 리뷰

ΔV4와 D-015를 구현했다. 공식 v1.19.0 앱이 사용하는 `/v2/client` export를 유지하고 Orca의 native `client.v2` 비교 테스트 5개·전용 타입/fixture, scoped CLI 탐색, prefix 없는 시작 로그 허용을 제거했다. 실행 파일의 제품 major는 별도로 검사한다. 외부 SDK에 포함된 미사용 native 정의까지 제거했다고 주장하지 않으며 의존성 수정·fork는 없다. 근거는 [런타임 호환성 기록](runtime-compatibility.md)에 남겼다. PLAN_GAP은 발견하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

`rg -n 'OpenCodeServerPool|resolveOpenCodeExecutable|\.acquire\(|\.installed\(|readVersion|spawnProcess|listening on' app/src/main/adapters -g 'opencode*.ts' -g '!*.test.ts'`로 실행 파일 판정과 소비 경로를 세었다. 카탈로그와 턴의 acquire가 같은 pool 시작 경계를 거치고 설치 조회는 같은 reader를 사용한다. `rg -n '@opencode|/api/session|/api/event' app/src app/package.json -g '!*.test.ts' -g '!*.snap'` 및 native 호출·타입 검색에서 유지되는 SDK export와 설명 주석을 구분했다. native API 호출은 없으며 테스트의 2.x 문자열은 거부 입력이다.

아래 파일명은 `app/src/main/adapters/` 기준이다.

| 강제 자리 | 직접 oracle 좌표 / 관측 |
|---|---|
| EP-19a SDK 사용 | `opencode.test.ts:subscribes before sending, scopes the turn and leaves admission to the runtime`, `replies to permission and question approvals once, including rejection`: production SDK의 legacy 세션·prompt·stream·승인 URL/입출력 |
| EP-19b 실행 파일 탐색 | `opencode-server.test.ts:does not discover the scoped CLI package`, `resolves configured and PATH npm executable files without invoking a shell`: scoped 경로 거부와 기존 npm/PATH 경로 탐색 |
| EP-19c 서버 시작 전 버전 판정 | 같은 파일 `accepts supported 1.x versions`, `rejects unsupported versions before spawning a server`: 1.x 양성 6종, 2.x/손상 출력 음성 7종과 spawn·HTTP 0회. `opencode.test.ts:reports an unsupported CLI as a turn error before any server or HTTP request`는 실제 adapter→pool의 오류 정규화 |
| EP-19d 조회 중 종료 | `opencode-server.test.ts:does not spawn after shutdown during version probing`: 지연 조회 뒤 close된 pool의 spawn·HTTP 0회 |
| EP-19e 실패 뒤 재시도 | 같은 파일 `retries after replacing an unsupported executable`: 첫 거부 뒤 1.x로 교체하면 재조회·서버 시작 성공 |
| EP-19f 설치 버전 조회 | 같은 파일 `reports the actual installed version`: 2.x도 실제 출력·경로를 보고하고 서버는 생성하지 않음 |
| EP-19g 시작 로그→health | 같은 파일 `ignores the unprefixed startup announcement`, `coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child`: prefix 없는 로그는 health 0회·child 정리, 기존 로그는 인증 health 성공 |

EP-19 7/7자리를 직접 관측했다. VP-31~34 SELF_PASS. V1 영향 회귀 중 VP-04는 위 lifecycle 통과와 별개로 기존 bootstrap 생성 배선 oracle 부재 때문에 SELF_BLOCKED를 유지한다. VP-05/06의 영향 경로는 위 SDK/승인 테스트와 단절·abort 케이스로 SELF_PASS다. VP-18의 이번 영향 범위는 `opencode-map.test.ts:normalizes tools without changing the original name or input`, `deduplicates delta/snapshot completion and places telemetry before the turn boundary`, `opencode-catalog.test.ts:keeps provider-qualified model IDs, names, defaults and enabled variants`에서 통과했다. settings 및 나머지 V1 범위의 검증 수준은 승격하지 않는다.

## 이번 라운드 수정의 잠금

선택 적대 증거 0 · 인용 변이 0 · 새 구조/배선 존재 oracle 0 = 잠금 표 행 0. 버전 판정과 lifecycle은 실제 pool에 제어된 버전·child·transport를 주입해 행동 결과를 관측한다. 제거 검색은 조사 근거이며 자동 구조 검사기를 추가하지 않았다. 기존 legacy wire 테스트와 실제 CLI 두 턴을 함께 실행했다.

## Product/UX 파생 검토

지원하지 않는 실행 파일은 시작 대기를 반복하는 대신 1.x 실행 파일 지정 안내를 기존 `provider_connection_error` 이벤트로 전달한다. 새 adapter 테스트가 실제 pool 오류에서 이 사용자 문구까지 관측한다. 설치 카드용 조회는 설치 사실과 실제 버전을 유지한다. 이번 턴에서는 2.x 오류의 화면 표시 실기를 추가하지 않았으며 renderer의 기존 오류 경로는 변경하지 않았다.

## 놓친 잠재 문제 + 대응

- 버전 확인 await가 생기면 그 사이 종료된 pool에서 서버를 만들 수 있다. 조회 직후 shutdown을 다시 확인하고 지연 promise 테스트로 차단을 확인했다.
- 거부된 startup promise가 캐시에 남으면 CLI를 되돌려도 실패가 반복된다. 기존 entry 제거 경로를 그대로 사용하고 2.x→1.x 재시도를 직접 검증했다.
- `installed`를 지원 여부로 바꾸면 설치된 2.x의 진단 정보를 잃는다. 조회 결과는 실제 버전을 유지하고 실행 경계에서만 거부한다.
- 1.x 판정은 major 범위 제한이며 모든 minor의 호환성 보장이 아니다. 실제 검증 조합은 CLI 1.19.0 / SDK 1.18.27이고, SDK의 `/v2` export와 제품 버전을 혼동하지 않도록 주석과 호환성 기록을 남겼다.

## 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC18 | ✅ | native 비교 코드·2.x CLI 지원 제거, 1.x 실행 경계와 오류/종료/재시도, legacy SDK 회귀 및 실제 CLI 두 턴 |

증분 ✅1 · ⚠️0 · ❌0 = 1. 누적 ✅17 · ⚠️1 · ❌0 = 18. AC11 최종 사용자 시각 인수와 독립 검증, 기존 V1 직접 oracle 부족 범위는 대기한다.

| 게이트 | 관측 |
|---|---|
| 관련 Vitest | 아래 명령으로 7파일 48케이스 통과 |
| 타입 | 전체 node/web/test 통과. 마지막 adapter 오류 테스트 추가 뒤 test typecheck 재통과 |
| 린트 | 전체 오류 0, 기존 useTranscriptVirtualizer warning 1. 마지막 adapter 테스트 targeted ESLint 통과 |
| 빌드 | electron-vite main/preload/renderer 통과. 기존 SubAgentTileContent 혼합 import 경고 유지 |
| 실제 CLI | 호스트 `--version` = 1.19.0. 변경된 pool의 실제 버전 조회→CLI→SessionRuntime→로컬 합성 모델 첫 턴·후속 턴 모두 commit 1회, 응답 일치, turn.ended 관측. 별도 임시 작업 폴더·XDG 사용, 외부 모델 요청 없음, 소유 child 종료 |
| 문서·공백 | inventory generated/prose/relative links 및 diff whitespace 통과 |
| 참조 제외 | 원본 clone은 저장소 밖, smoke 소스/번들은 ignored `.tmp`, 사용자 첨부는 미추적 유지 |

명령(app 기준): `node node_modules/vitest/vitest.mjs run src/main/adapters/opencode-sdk.test.ts src/main/adapters/opencode-server.test.ts src/main/adapters/opencode.test.ts src/main/adapters/opencode-map.test.ts src/main/adapters/opencode-catalog.test.ts src/main/app/chat-turn/opencode-runtime.test.ts src/main/infra/net/no-node-fetch.test.ts --maxWorkers=2`.

## Review Signals

r1.7은 사용자 요구 ΔV4이며 verify 실패 뒤 재구현이 아니다. SDK export의 이름과 제품 버전을 공식 태그 소스에서 구분했고 제거·보존 범위를 명시했다. 새 비동기 경계의 shutdown과 재시도는 직접 행동 테스트로 닫았다. 검증 완료를 독립 verify/PASS로 승격하지 않는다.

# [구현자 기입 — r1.8 하네스 구현 디렉터리 분리]

## 설계 리뷰

ΔV5 구현 완료. main은 `adapters/claude/`와 `adapters/opencode/v1/`, renderer는 feature 내부 `harnesses/claude/`와 `harnesses/opencode/`로 전용 구현을 옮겼다. OpenCode public entry가 v1 구현을 선택한다. SDK·CLI·native 설정/모델 해석은 v1 안에 있고, 정규 DTO 기반 UI와 공통 입력·상태·저장 수명은 버전과 분리했다. 제품 동작·IPC·의존성 변경은 없다.

Claude 전용 확장 plugin·설정 기본값·모델 이름/effort 정책도 각 레이어의 Claude 디렉터리에 옮겼다. 엔진 카드와 모델 목록의 공통 DTO 렌더는 공유하며, composer의 모델 이름 표현과 엔진 native 템플릿은 전용 구현이 제공한다. PLAN_GAP은 발견하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

| 자리 | 직접 oracle 좌표 / 이번 관측 |
|---|---|
| EP-20a | `main/adapters/claude/adapter.*.test.ts`의 query·승인·완료 회귀와 `adapters/registry.test.ts:describeActive() 는 활성 백엔드(claude)의 서술자를 반환` 통과 |
| EP-20b | `adapters/opencode/v1/adapter.test.ts`의 실제 SDK HTTP/SSE·승인/중단, `server.test.ts`의 버전/수명, `app/chat-turn/opencode-runtime.test.ts`의 public entry→실제 런타임 첫 턴/후속 턴 통과 |
| EP-20c | `features/extensions/harness-plugins/claude/user-skills.test.ts:매니페스트(name=claude) + skills 링크(→ 대상)를 렌더한다`, `engine/lib/providerCatalog.test.ts`의 Claude 기본값, shared 모델 정책 회귀 통과 |
| EP-21a | `Composer.harness.test.ts`와 `NewChatLandingPage.harness.test.ts:renders the harness landing and preserves draft and attachment state` 통과. 모델 선택 라벨·메뉴는 `modelSelection.test.ts`, `modelMenu0215.render.test.ts` 재통과 |
| EP-21b | `TranscriptView.harness.test.ts`, `StatusLine.harness.test.ts`, 기존 도구 그룹·plan 렌더 테스트에서 하네스별 본문/도구/스피너와 종료 표시 통과 |
| EP-21c | `rightPanelTiles.harness.test.ts`, `RightPanelTile.actions.test.ts`에서 지원 패널 선택과 실제 타일 제어 통과 |
| EP-21d | `EngineFormModal.harness.test.ts`, `EngineFormModal.import.test.ts`, `EngineModelList.render.test.ts`, `providerCatalog.test.ts`: 설정 기본값·가져오기 경쟁·모델 표시 통과 |
| EP-21e | `HarnessSettingsTab.save.test.ts:saves only %s fields through the common tab` 두 하네스 통과. 실제 탭→전용 필드/patch→API wrapper의 저장 payload 관측 |
| EP-22a | `scripts/harness-boundary.test.mjs`: 실제 ESLint로 v1 밖 SDK import/re-export/dynamic import/require 거부, v1 안 허용 |
| EP-22b | 같은 테스트: main과 renderer의 양방향 형제 import 거부, 공통 포트·동일 하네스·public entry 허용 |
| EP-22c | 이동한 실행 테스트, 전체 lint/typecheck, main/preload/renderer build, doc inventory의 상대 링크 검사 통과. host-process 예외의 새 경로는 `git-boundary.test.mjs`에서 재검증 |

등록 EP-20 3/3 · EP-21 5/5 · EP-22 3/3 = 이번 경로 11/11. VP-35~39 SELF_PASS. 각 자리의 범위는 위 테스트가 실제 실행한 구간까지이며 bootstrap 전체 동작을 단위 테스트 결과로 확대하지 않는다.

V1 VP-01/04/08/11의 기존 SELF_BLOCKED·최종 시각 인수는 유지한다. VP-05/06/18은 이동한 SDK·server·map/catalog/settings 직접 테스트, VP-07은 history 관련 기존 테스트와 DB settlement 회귀를 확인했다. ΔV1~4는 엔진 import·랜딩·스피너·1.x 실행 경계의 위 직접 oracle로 이번 이동 영향을 확인했으며 독립 검증 결과로 승격하지 않는다.

## 이번 라운드 수정의 잠금

| 변이 자리 | 종류 | 관측 |
|---|---|---|
| SDK import 경계 규칙 off | VP-37 선택 증거 | 금지 import 검사가 assertion red, 원복 후 통과 |
| main 동일 하네스 capture 조건 제거 | VP-37 선택 증거 | 형제 import 검사가 assertion red, 원복 후 통과 |
| Composer→ClaudeModeControl 모델을 null로 고정 | 새 배선 oracle | `composerWiring.test.ts` red, 원복 후 통과 |
| ClaudeModeControl→ModeMenu 옵션을 빈 배열로 고정 | 새 배선 oracle | 같은 테스트 red, 원복 후 통과 |
| 공통 composer의 OpenCode 스킬 필터 제거 | 이동으로 수정한 기존 oracle | `composerAttachMenu.test.ts` red, 원복 후 통과 |
| 공통 첨부 메뉴의 extension 표시를 true로 고정 | 이동으로 수정한 기존 oracle | 같은 테스트 red, 원복 후 통과 |

선택 증거 2 · 인용 변이 0 · 신규/수정 배선 oracle 4 = 표 행 6. 변이마다 원본 바이트를 복원했다. 경계 규칙 테스트 17건과 위 composer 검사 포함 UI 29건이 복원 후 통과했다. 나머지는 직접 행동 oracle이며 추가 변이는 미선택이다.

## Product/UX 파생 검토

공통 input controller와 surface는 같은 위치에서 유지하고 전용 메뉴·버튼·CSS만 선택한다. 실제 하네스 왕복 렌더에서 초안과 첨부 보존을 확인했다. 설정 모달의 로딩·실패·취소·재시도·늦은 응답 처리와 세션 하네스 잠금은 기존 실행 경로를 유지한다. UI 문구·브랜드·진행 상태를 새로 바꾸지 않았다. 이번 구조 변경에서는 별도 Computer Use 시각 검사를 반복하지 않았으며 AC11 최종 인수는 남는다.

## 놓친 잠재 문제 + 대응

- 상대 경로 일괄 변환이 테스트의 `join(p, '..')`를 import로 오인한 두 literal을 발견했다. 원문과 이동본의 AST literal을 대조해 복구하고 관련 settings·plan 파일 테스트를 재실행했다. production 로직 변경은 없었다.
- 기존 소스 검사는 이전 파일명과 inline JSX를 읽었다. 실제 새 배선으로 좌표를 바꾸고 위 네 변이로 검출력을 확인했다. 랜딩 fixture의 feature barrel도 새 공통 selector를 노출하도록 갱신했다.
- 설정 저장 테스트의 가짜 DOM에는 textarea 크기 측정이 없다. 공통 AutoGrowTextarea만 단순 입력으로 모형하고 실제 하네스 필드·저장 patch·API wrapper를 실행했다. 번역 함수 identity와 fake timer를 고정해 fixture 수명 문제를 제거했다.
- 설치된 Claude SDK는 0.3.286, manifest 선언은 0.3.296이었다. 설치 identity 검사 기대값은 실제 package metadata에서 읽도록 고쳤다. 패키지 설치나 버전 변경은 하지 않았으며 이번 구조 회귀가 선언 버전의 CLI 실기까지 입증하지는 않는다.
- SQLite는 Electron ABI로 설치돼 Node Vitest에서 로드되지 않았다. ABI를 바꾸지 않고 같은 DB 스위트를 Electron 런타임으로 실행해 5건 통과했다. sandbox의 상위 경로 stat 제한은 허용된 재실행에서 해소했다.

## 구현 보고

| AC | 결과 | 이번 관측 |
|---|---|---|
| AC19 | ✅ | Claude/OpenCode 실제 구현 이동, OpenCode public entry→v1의 SDK·CLI·설정 실행 회귀 |
| AC20 | ✅ | composer·transcript·패널·엔진·설정 전용 구현 분리, 공유 입력/초안·첨부와 설정 저장 회귀 |
| AC21 | ✅ | 금지/허용 import probe, 이동한 테스트·소스 검사·현재 문서, 타입·lint·빌드 통과 |

증분 ✅3 · ⚠️0 · ❌0 = 3. 이전 r1.7의 ✅17 · ⚠️1에 합산한 누적은 ✅20 · ⚠️1 · ❌0 = AC 21이다. AC11 최종 시각 인수와 기존 V1 직접 oracle 부족·독립 검증은 남는다.

| 게이트 | 관측 |
|---|---|
| 넓은 동작 회귀 | adapter·plugin·runtime·엔진 import·chat/engine/settings·랜딩: 301파일 중 300파일/2642케이스 통과. 남은 랜딩 fixture 3케이스를 수정해 재통과 |
| 후속 UI 회귀 | 모델 표현 추출 후 6파일 29케이스 통과. 앞 행과 중복 합산하지 않음 |
| 모델 정책 회귀 | shared identity/permission/effort·main harness/context·renderer 전용 제어/engine 22파일 392케이스 통과. 일부 넓은 회귀와 중복 |
| DB 회귀 | Electron `ELECTRON_RUN_AS_NODE=1`로 settlement.integration 1파일 5케이스 통과 |
| 경계 | Node scripts의 harness-boundary·git-boundary 17케이스 통과, 위 6변이 모두 red 후 원복 green |
| 타입·린트 | 전체 node/web/test 통과. 마지막 renderer 추출 뒤 web 재통과. 전체 lint 오류 0, 기존 useTranscriptVirtualizer 경고 1 |
| 빌드 | 최종 main/preload/renderer 산출 완료. 기존 SubAgentTileContent의 혼합 import 경고 유지 |
| 문서·공백 | doc inventory generated/prose/relative links와 git diff --check 통과 |

넓은 회귀 명령(app 기준): `node node_modules/vitest/vitest.mjs run src/main/adapters src/main/features/extensions/harness-plugins src/main/app/chat-turn/opencode-runtime.test.ts src/main/app/handlers/engine.import.test.ts src/renderer/src/features/chat src/renderer/src/features/engine src/renderer/src/features/settings/components/HarnessSettingsTab src/renderer/src/pages/NewChatLandingPage.harness.test.ts --exclude '**/settlement.integration.test.ts' --maxWorkers=2`.

후속 UI 명령: `node node_modules/vitest/vitest.mjs run modelSelection.test.ts modelMenu0215.render.test.ts Composer.harness.test.ts NewChatLandingPage.harness.test.ts composerWiring.test.ts composerAttachMenu.test.ts --maxWorkers=2`.

## Review Signals

r1.8은 사용자 추가 요구 ΔV5이며 verify 실패 뒤 재구현이 아니다. 파일 이동에서 import 외의 문자열과 source-based 검사도 영향을 받는 것을 실제 실패로 확인했다. 전용 구현을 복제하지 않고 레이어 내부로 옮겼으며 입력·저장 수명을 공통 경로에 유지했다. 독립 검증·시각 인수·기존 직접 oracle 한계는 유지한다.


# [구현자 기입 — r1.9 CI 복구·버전 경계·transcript 분리]

## 설계 리뷰

ΔV6 코드 구현 완료. CI 738의 실패를 로컬에서 같은 3파일/8케이스로 재현한 뒤 수정했다. 테스트를 삭제하거나 기대 조건을 완화하지 않았다. 제품명은 PRODUCT_DISPLAY_NAME, 소스 검사 경로는 이동된 구현, 랜딩 mock은 실제 public export를 사용한다.

OpenCode public factory가 SessionAdapter를 반환하고 구체 server/adapter 조립은 v1에 둔다. renderer의 native metadata decoder도 v1에 두고, 버전 중립 view를 전용 카드에 전달한다. Claude의 카드·레지스트리·도구 본문·reasoning·오류·구조화 결과를 Claude transcript 디렉터리로 이동했다. 새 의존성·IPC·저장 포맷·2.x 실행 지원은 추가하지 않았다. PLAN_GAP은 발견하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

| 자리 | 직접 oracle / 관측 |
|---|---|
| EP-23a | main error-report.registry.test.ts의 M16 및 renderer reportSites.registry.test.ts의 AskBody 경로·원본 변이 검사 통과 |
| EP-23b | product-identity.test.ts의 제품명·plugin 경로 검사 통과 |
| EP-23c | agentModeLanding.render.test.ts의 public export 포함 랜딩 3케이스 통과 |
| EP-24a | app/chat-turn/opencode-runtime.test.ts의 public factory→SessionRuntime→실제 SDK HTTP/SSE 첫 턴/후속 턴 통과 |
| EP-24b | scripts/harness-boundary.test.mjs: 앱·중립 계약·UI의 직접 버전 접근 및 버전 간 접근 거부, public facade·동일 버전 허용 |
| EP-24c | opencode/v1/toolPresentation.test.ts: native 종류·실제 filediff·patch files·normalized history·unknown·안전 URL·ANSI·todo 해석 통과 |
| EP-25a | ToolCard.interaction.test.ts의 탐색 순서/실패 그룹, AssistantSegment.render.test.ts의 task/web/todo/unknown 본문과 중단/거부/취소/미실행 상태 통과 |
| EP-25b | ToolCard.interaction.test.ts의 pending shell 열기→완료 후 열림 유지→현재 출력 복사, Edit 사용자 접기 유지 통과 |
| EP-26a | AssistantSegment.render.test.ts의 모든 persisted segment kind 순서·비어 있지 않은 출력, reducer→reload의 실제 결과 diff/원본 입력 보존 통과 |
| EP-26b | 같은 테스트의 두 하네스 확정/라이브 text·reasoning과 기존 streaming/store 회귀 통과 |
| EP-26c | 같은 테스트의 사용자 bubble·copy/time 단일 행·OpenCode fork 숨김, TranscriptView.harness.test.ts의 공통 bg-bg·스피너/종료 경로 통과 |

이번 경로 EP-23 3/3 · EP-24 3/3 · EP-25 2/2 · EP-26 3/3 = 11/11. VP-41~45 SELF_PASS. VP-45는 mapper·history·renderer/reload의 분절된 직접 증거이며 외부 제공자 인증 E2E로 확대하지 않는다. VP-40 SELF_PASS: 최종 코드의 CI #740 gate success, Vitest 686파일/6861케이스 및 scripts 138케이스 통과를 job log에서 관측했다.

기존 V1 VP-01/04/08/11 SELF_BLOCKED와 AC11 최종 시각 인수는 유지한다. 전체 회귀의 adapter/server/map/settings·history·composer·엔진/설정·패널·스피너·배경 경로로 ΔV1~5의 이번 영향 범위를 재확인했다.

## 이번 라운드 수정의 잠금

| 변이 자리 | 종류 | 관측 |
|---|---|---|
| version-boundary off / app→v1 | VP-41 선택 증거 | 정상 금지 진단, off에서 같은 oracle red |
| version-boundary off / 중립 implementation→v1 | VP-41 선택 증거 | 정상 금지 진단, off에서 같은 oracle red |
| version-boundary off / main v1→v2 | VP-41 선택 증거 | 정상 금지 진단, off에서 같은 oracle red |
| version-boundary off / renderer ToolCard→v1 | VP-41 선택 증거 | 정상 금지 진단, off에서 같은 oracle red |
| version-boundary off / renderer v1→v2 | VP-41 선택 증거 | 정상 금지 진단, off에서 같은 oracle red |
| M16 source 경로의 reporting 삭제 | 수정한 기존 구조 oracle | error-report.registry.test.ts의 detects removal 원본 검사 재통과 |
| AskBody source 경로의 forbidden reporting 삽입 | 수정한 기존 구조 oracle | reportSites.registry.test.ts의 detects forbidden reporting 원본 검사 재통과 |

선택 증거 5 · 인용 변이 0 · 수정 구조 oracle 2 = 표 행 7. version 규칙 정상 진단 5/5, off 0/5로 검출력 상실을 관측했으며 production 파일은 변이하지 않았다. 실제 ESLint의 import/re-export/dynamic import/require/타입 import 검사도 통과했다. 나머지는 직접 출력·동작 oracle이다.

## Product/UX 파생 검토

연속 탐색만 묶어 도구 순서를 유지하고, 결과 도착이 사용자가 닫은 카드를 열지 않는다. 실패·중단·취소·거부·미실행은 완료 문구로 표시하지 않는다. 셸은 실행 중에도 펼칠 수 있고 복사는 현재 명령/출력을 사용한다. 파일 metadata는 실제 결과가 입력 예측보다 우선한다. 원본 이름/입력은 접기 영역에 보존하고, unknown은 결과나 입력을 표시한다. 사용자·대기 버블과 메타는 각 하네스 스타일을 선택하고 공통 첨부·복사·시간·큐 수명은 유지한다.

공식 v1.19.0 basic-tool/message-part/apply-patch-file 소스를 참조했다. 임시 preview는 실제 React 컴포넌트 SSR과 production CSS로 만들었지만, Edge browser connector 미연결·내장 browser attach timeout 후 Windows Computer Use도 URL 정책 확인 불가로 중단됐다. 새 화면의 시각 확인을 완료로 주장하지 않는다. 원본 clone과 preview는 커밋에 포함하지 않는다.

## 놓친 잠재 문제 + 대응

- 전체 검사에서 추가 이동한 AskBody를 읽는 renderer 오류 레지스트리의 이전 경로를 발견했다. 같은 불변식으로 새 경로를 적용하고 해당 3실패와 기존 변이 검사를 재통과시켰다.
- Windows 경로를 POSIX resolve하면 drive 앞에 cwd가 붙어 public facade를 오탐했다. native path.resolve 후 slash를 정규화하고 금지/허용 양쪽 probe를 재통과시켰다.
- 탐색 그룹 분류가 큰 도구 입력을 반복 직렬화하지 않도록 종류 해석만 별도로 호출한다. 코드 diff는 펼쳤을 때 계산하며 읽기 거터/줄 좌표는 공통 DiffTable을 사용한다.
- 전체 테스트의 Electron fork worker가 종료 지연을 반복해 이번 테스트 트리만 종료하고 threads로 재실행했다. 시간대 변경과 node 실행 파일 복제 테스트는 Electron 특성 때문에 실패했고 CI와 같은 Node에서 재통과했다. SQLite ABI는 변경하지 않았다.
- 스크립트 ABI 검사는 sandbox의 사용자 폴더 lstat EPERM으로 실패했다. 정상 파일 권한에서 같은 13케이스를 재실행해 통과했다. 제품 코드로 권한 문제를 우회하지 않았다.

## 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC22 | ✅ | 기존 CI 8실패 재현·수정 후 최종 코드의 CI #740 전체 gate success |
| AC23 | ✅ | 중립 factory/view 계약과 v1 실제 구현, public runtime·금지/허용 import·변이 검사 |
| AC24 | ✅ | 전용 탐색/셸/파일/작업/할 일/웹/unknown 본문, 상태·접기 유지·복사 직접 테스트 |
| AC25 | ✅ | 하네스별 committed/live/user/meta 출력, 모든 segment kind와 history reload 테스트 |

증분 ✅4 · ⚠️0 · ❌0 = 4. 이전 ✅20 · ⚠️1에 더한 누적은 ✅24 · ⚠️1 · ❌0 = AC 25. AC11 최종 사용자 시각 인수는 대기한다.

| 게이트 | 관측 |
|---|---|
| CI 실패 복구 + public factory | 초기 5파일 125케이스 통과, 최종 관련 경로 8파일 153케이스 통과 |
| 전체 Vitest | Electron threads 687파일 중 683파일/6848케이스 통과, 1파일/1케이스 skip. 실패 3파일/5케이스는 위 경로 수정 및 Node 재검증 3파일 248케이스로 해소 |
| 추가 본문·상태 | 후속 AssistantSegment.render 1파일 13케이스 통과. 위 집합과 중복 합산하지 않음 |
| scripts | 전체 138케이스 중 130 통과, sandbox EPERM 8건은 같은 ABI 스위트 13케이스 재실행 통과. 최종 harness-boundary 4케이스 통과 |
| 타입·lint | node/web/test 통과. 전체 lint 오류 0, 기존 useTranscriptVirtualizer 경고 1. 최종 테스트 추가 후 test typecheck 및 변경 파일 lint 재확인 |
| build | main/preload/renderer 생성 완료. 기존 SubAgentTileContent 혼합 import 경고 유지 |
| 운영 | 문서 inventory/prose/links, migration sync/append-only, test budgets, diff whitespace 통과 |
| 원격 CI | [CI #740](https://github.com/muzaby/orca-skin/actions/runs/38570022676) gate success. Windows Node 22의 npm ci→가드→lint→typecheck→test 전부 통과. Vitest 686파일/6861케이스 pass, 기존 1파일/1케이스 skip. scripts 138/138 pass, fail 0 |

## Review Signals

r1.9는 사용자 CI 실패와 추가 구조/표현 요구에 대한 ΔV6 구현 턴이다. 앞선 제한 범위 회귀가 source-path 검사와 랜딩 mock 누락을 놓쳤다. 이번에는 원격 실패를 먼저 재현하고 전체 회귀를 수행해 새로 이동한 경로의 같은 결함도 닫았다. 독립 검증·시각 인수·이전 V1 증거 한계는 유지한다.

최종 스타일 점검에서 웹 링크의 미정의 토큰을 OpenCode 본문 토큰으로 바꾸고 Markdown 행간 상속을 Tailwind arbitrary value로 명시했다. 재빌드한 CSS에서 두 utility 생성을 관측했으며 이 보정을 포함한 코드가 위 CI를 통과했다. 최종 타입·lint 확인 후 제품 코드 변경은 없다.

## [구현자 기입] r1.9 후속 실앱 시각 관측

부분 확인 — 사용자 요청으로 실행 중인 Orca를 Computer Use로 직접 조작한 결과는 [디자인 증거](design-evidence.md#실행-중인-orca-시각-관측-2026-10-14-r19-후속)에 기록했다. 두 테마의 랜딩/composer·초안 하네스 왕복·확정 본문/reasoning·배경·패널 범주/빈 상태를 확인했다.

CUA-01: 검증용 새 대화에서 스피너 뒤 스트림 오류가 재현되어 정상 스트리밍과 도구 카드·내용이 있는 패널의 실앱 검사는 미확인이다. CUA-02: OpenCode 계획 패널의 빈 상태에 Claude 고정 안내가 남아 있다. 원인 수정·전체 독립 verify를 수행한 턴이 아니므로 기존 AC 자기보고를 새 통과 판정으로 승격하지 않으며, AC11은 두 발견과 최종 인수를 남긴다.

# [구현자 기입 — r1.10 공급자 오류·하네스 문구 수정]

## 설계 리뷰

기존 V1 + ΔV1~6 범위의 버그 수정이다. 사용자가 CUA-01/02 수정·Computer Use 재검증·push를 명시했다. `opencode/big-pickle`의 실패 원인은 공급자의 HTTP 403 `FreeTierError`이며, 두 SSE 오류 경로가 원인을 일반 스트림 오류로 덮었다. SDK HTTP 실패와 보조 응답에도 같은 오류 의미가 적용되도록 정리했다. 공급자 정책 우회·새 의존성·공개 계약 변경은 없다.

## 강제 지점 전수와 V-pair 자기확인

검색: `rg -n 'message.error|session.error|classifyError|answer.data' app/src/main/adapters/opencode/v1`, `rg -n 'Claude|toolRequest|planEmptyDesc' app/src/renderer/src/features/chat/components app/src/renderer/src/shared/i18n/resources`. 아래는 이번 수정의 영향 지점 분모이며 V1 전체 분모로 바꾸지 않는다.

| 지점 / 관련 pair | 관측 좌표 | 자기확인 |
|---|---|---|
| SSE `session.error` / VP-05·18 | `v1/adapter.test.ts:explains provider free-tier rejection from session.error…` | 403 사유·비밀 제외·재전송 0·성공 종료 0 |
| SSE `message.updated.info.error` / VP-05·18 | 같은 테스트의 `message.updated` 행 | 같은 불변식 직접 관측 |
| SDK HTTP throw / VP-05·15 | 같은 테스트의 `http` 행 | SDK cause의 status/body 해석, 초기 제출 rollback 1회 |
| 보조 응답 / VP-05 영향 경로 | `v1/adapter.test.ts:rejects a failed auxiliary response and still deletes its temporary session` | 빈 성공 대신 reject, 임시 세션 DELETE 1회 |
| 계획 빈 상태 / VP-10·11·17 | `planTasks0224.render.test.ts:빈 계획 안내가 %s 세션의 하네스를 따른다` | Claude/OpenCode 실제 PlanTileContent 렌더 2행 |
| 도구 승인 제목 / VP-06·11·17 | `ApprovalCard.harness.test.ts:identifies the %s session without changing the approval` | Claude/OpenCode 실제 ToolApprovalBody 렌더 2행 |

이번 직접 오류 지점 4/4, 하네스 문구 지점 2/2. VP-05/06/18의 영향 구간은 실제 SDK transport·mapper·승인 wire 회귀로 SELF_PASS다. VP-10/11/15/17의 기존 배선 증거 부족·시각 인수 한계는 유지하며 전체 pair를 승격하지 않는다. VP-43/44의 실제 성공 도구 카드 시각 범위는 승인 대기로 SELF_BLOCKED다. 기존 VP-40~45 자기보고는 이번 실앱 부분 관측으로 독립 판정이 되지 않는다.

## 이번 라운드 수정의 잠금

해당 없음 — 오류 ingress 3종·보조 응답·두 하네스 렌더 모두 실제 production 함수/컴포넌트의 직접 출력 oracle이다. 새 구조 스윕이나 mutation을 만들지 않았다. 선택 증거 0 · 인용 변이 0 · 새 구조 oracle 0 = 표 행 0. 기존 분류의 다른 공급자 인증·403·429·컨텍스트 오류는 `errors.test.ts`에서 원문/헤더/cause가 결과에 남지 않는 값 단언으로 확인했다.

## Product/UX 파생 검토

무료 모델 거절은 다른 공급자 설정이 필요하다는 안내로 표시하며 같은 요청을 자동 재전송하지 않는다. 일반 403·401·429도 별도 안내를 갖고 오류 body/헤더를 transcript에 저장하지 않는다. Claude 계획/승인 문구는 유지한다. 실행 카드의 권한 요청이 누구에게서 왔는지 알 수 있도록 OpenCode 승인 제목도 함께 수정했다.

실앱에서 외부 무료 모델 403 안내·OpenCode 계획 문구·로컬 공급자 스트리밍 완료·실행 중/중단된 읽기 카드·실제 Git diff 표시를 관측했다. 상세와 검증 경계는 [디자인 증거](design-evidence.md#오류-수정-후-실앱-관측-2026-10-15-r110)에 있다. 외부 실모델 성공과 완료된 도구 카드 검증은 아직 아니다.

## 놓친 잠재 문제 + 대응

- 보조 `complete()`가 `info.error`를 무시해 빈 문자열을 성공 반환했다. 같은 오류 분류로 reject하고 finally 삭제는 유지했다.
- 도구 승인 카드에도 Claude 고정 제목이 남아 있어 하네스별 composer 문구 선택과 ko/en 리소스로 수정했다.
- 개발 리로드 중 대기 도구 카드가 중단 이력으로 보였다. 남은 검증 턴을 앱의 중단 버튼으로 정리하고 새 요청으로 재현했다. 개발 리로드의 승인 복원 자체는 이번 변경에서 고치거나 보장하지 않는다.
- 로컬 fixture의 성공은 외부 공급자의 사용 권한을 입증하지 않는다. 기존 HF 인증 재사용 여부를 사용자에게 물었으며 회신 없이 키를 사용하지 않았다.
- Computer Use 지침은 권한 승인 조작을 금지한다. 실제 파일 접근 승인 버튼은 사용자가 조작하도록 요청했으며, 도구 완료는 미확인으로 남겼다.

## 구현 보고

| 영향 AC | 결과 | 이번 관측 |
|---|---|---|
| AC5 | ✅ | SDK 오류 ingress·정상 텍스트/도구/세션 격리 회귀, 로컬 HTTP fixture를 거친 실앱 스트리밍 완료 |
| AC6 | ✅ | 기존 approval reply/reject/abort wire 회귀 유지. 승인 UI 동작 정책은 변경하지 않음 |
| AC10 | ✅ | 계획 문구 2하네스 실제 렌더와 OpenCode 패널 직접 조작 |
| AC11 | ⚠️ | 오류·계획·승인 문구·로컬 응답·diff는 관측. 실공급자 성공, 도구 완료와 최종 사용자 인수는 대기 |
| AC24/25 | ✅ | 기존 전용 카드/본문 자동 회귀. 실앱 도구 완료까지 확대하지 않음 |

이번 영향 ✅5 · ⚠️1 · ❌0 = 6. 나머지 AC의 이전 자기보고를 재검증한 것으로 간주하지 않는다. 누적 자기보고의 AC11 대기는 유지하며 전체 독립 verify를 선점하지 않는다.

| 게이트 | 관측 |
|---|---|
| 최종 영향 회귀 | 17파일 122케이스 통과 — OpenCode adapter/mapper/server/SDK/settings·runtime·본문/card·composer·계획/승인·패널 policy |
| 타입 | `npm run typecheck`: node/web/test 모두 통과 |
| lint | 전체 오류 0, 기존 useTranscriptVirtualizer의 incompatible-library 경고 1 |
| build | main/preload/renderer 산출 완료. 기존 SubAgentTileContent 혼합 import 경고 1 |
| 운영 | 문서 inventory/prose/links, test budgets, diff whitespace 통과. DB/마이그레이션·의존성 변경 없음 |
| CUA | 실제 403 안내·하네스 문구·로컬 스트림·실행/중단 카드·커밋 diff 확인. 승인 완료/실공급자 성공은 미확인 |

## Review Signals

r1.10은 사용자 지시의 오류·문구 수정 턴이다. 기존 테스트는 일반 오류 terminal과 auth category를 보았으나 실제 공급자의 403 의미를 보존하는지 단언하지 않았다. 이번에는 SDK 오류 ingress 3종을 같은 직접 oracle로 잠갔다. 자동 테스트와 실제 UI 검증의 경계를 구분하고, 승인/공급자 회신 대기는 성공으로 기록하지 않는다.
