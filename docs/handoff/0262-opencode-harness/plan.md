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
구현 착수 전. 미해결 제품 결정 없음.

## 강제 지점 전수와 V-pair 자기확인
미실행. 실제 변경 경로와 테스트 관측으로 채운다.

## 이번 라운드 수정의 잠금
선택적 적대 증거 미선택 — 직접 행동 oracle. 신규 proxy를 추가하면 감도 검증을 별도로 기록한다.

## Product/UX 파생 검토
미실행.

## 놓친 잠재 문제 + 대응
미실행.

## 구현 보고
미착수. AC ✅0 · ⚠️12 · ❌0 = 총 12.

## Review Signals
r1 최초 구현. 기존 SDK 조사와 제품 구현을 분리했다.
