# Plan — OpenCode 하네스와 전용 UI

## 메타

| 항목 | 값 |
|---|---|
| slug | `0262-opencode-harness` |
| 작성자 | Codex — 사용자 구현 요청에 따른 설계·구현 |
| 일자 | 2026-10-13 |
| 선행 근거 | 0214 SDK 연구. 연구 완료 상태를 제품 구현 완료로 해석하지 않는다. |
| 상태 | READY |
| V mode | Baseline V |
| 기준 V | none — 0214는 SDK 조사이며 이번 제품 계약을 갖지 않는다. |
| 이번 V revision / 유효 V | V1 / V1 |

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
