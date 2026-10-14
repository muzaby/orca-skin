# Plan — OpenCode 하네스와 전용 UI

## 메타

| 항목 | 값 |
|---|---|
| slug | `0262-opencode-harness` |
| 작성자 | Codex — 사용자 구현 요청에 따른 설계·구현 |
| 일자 | 2026-10-13 |
| 선행 근거 | 0214 SDK 연구. 연구 완료 상태를 제품 구현 완료로 해석하지 않는다. |
| 상태 | READY |
| V mode | Delta V — 기준 V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 |
| 기준 V | none — 0214는 SDK 조사이며 이번 제품 계약을 갖지 않는다. |
| 이번 V revision / 유효 V | ΔV4 / V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 |

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

갱신 메모: 기존 결정 전부 유지. ACTIVE 결정 ↔ AC 충돌 없음. 미정 제품 결정 없음.

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
