# Plan — OpenCode 하네스와 전용 UI

## 메타

| 항목 | 값 |
|---|---|
| slug | `0262-opencode-harness` |
| 작성자 | Codex — 사용자 구현 요청에 따른 설계·구현 |
| 일자 | 2026-10-13 |
| 선행 근거 | 0214 SDK 연구. 연구 완료 상태를 제품 구현 완료로 해석하지 않는다. |
| 상태 | plan/READY — ΔV16 lazy native 커서·재시작 하네스 복원 보완 설계. 원본 형식별 커서 결정 대기. ΔV15 구현/자기보고·기존 AC11 사람 인수·독립 verify 대기는 보존 |
| V mode | Delta V — 기준 V1 + ΔV1~15 + ΔV16 초안 (각 델타의 대체 범위 적용) |
| 기준 V | none — 0214는 SDK 조사이며 이번 제품 계약을 갖지 않는다. |
| 이번 V revision / 유효 V | ΔV16 초안 / 기준 ΔV15@공유 브랜치 `8c94b449485771d5ea588e62e38c8cfbedc74e3b`. 기존 구현 자기보고·AC11 미인수는 별도 보존. 확정 전에는 새 요구를 충족한 것으로 세지 않음 |

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
| 명시 변경 | OpenCode 사용자 메시지 버블의 배경·글자색을 Claude와 동일하게 변경 | 2026-10-15 추가 사용자 요구, ΔV8 |
| 명시 추가 | 질문·도구 승인은 composer를 대체하며 종류 무관 도착 순서로 현재 한 장만 표시. 실행 desktop을 직접 조작하여 transcript와 Todo 펼침/접힘·완료 후 퇴장을 반영 | 2026-10-15 현재 사용자 요구, ΔV11~13 |
| 명시 변경 | 하네스 원본 저장 경로에서 세션·리소스를 관리하고 Orca 모델 설정 오버라이드는 유지. 터미널 추가 대화는 Orca 재열기에 반영하며 Orca 목록 제거는 native 원본·작업 폴더를 보존 | 2026-10-16 추가 요구·범위/삭제/재열기 답변. 공통 정책은 0265·ADR-009, OpenCode 경로·전환은 ΔV15 |

패널 범주화 요구 중 타이틀 메뉴에 검토·세션·작업 그룹명을 표시하던 부분은 [0263 ΔV3](../0263-opencode-session-panel/plan.md)의 평면 메뉴와 `작업` 타일 계약으로 대체한다. 하네스별 지원 패널 필터는 유지하며, 메뉴·패널 상호작용의 규범 정본은 0263이다.

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

| D-019 | 사용자 제공 `.tmp/opencode-dev`의 데스크톱 transcript·도구·테마·composer·질문 렌더링을 차용한다 | transcript canvas 배경은 현재 값 유지. UI 참조는 2.0.29, 실행 API는 기존 1.x. 참조 다운로드는 커밋 제외 | 2026-10-15 사용자 추가 요구 | ACTIVE | 사용자 버블 색상 부분만 D-020으로 SUPERSEDED. 나머지 UI 참조·D-004/011/015~017 유지 |
| D-020 | OpenCode 사용자 메시지 버블의 배경·글자색은 Claude 사용자 버블과 동일하게 한다 | 두 테마의 공통 `bubble-user`·`ink` 토큰 사용. transcript canvas와 사용자 글자 크기 설정 유지 | 2026-10-15 추가 사용자 요구 | ACTIVE | D-019의 버블 색상 부분 대체. 당시 비변경 범위였던 배치·간격·반경은 후속 D-023 원본 이식으로 대체 |
| D-021 | Claude 세션 GUI는 OpenCode 도입 전 표시를 유지하고 추가된 메뉴 그룹 제목·엔진 새로고침을 제거한다 | 사용자: “수정하거나 추가된 것이 있으면 원래대로 복원하라.” 도입 전 main `0b8c1e9f`와 비교하며 명시된 OpenCode 카드·설정·신규 엔진 하네스 선택은 유지 | 2026-10-15 사용자 후속 요구 | ACTIVE | D-004 구체화. 공통 새로고침 버튼과 Claude 메뉴 그룹 표시는 대체 |
| D-022 | OpenCode 질문과 도구 승인은 종류와 관계없이 도착 순서로 composer를 대체하며 한 장씩 소비 | 현재 카드가 해소될 때까지 뒤 카드는 표시·mount하지 않는다. 순서와 요청 데이터를 보존하고 마지막 해소 후 초안·첨부 복원 | 2026-10-15 사용자: “Question 도구 또한 … composer를 덮는다”, 동시 대기는 종류 무관 도착 순서 한 장으로 확정 | ACTIVE | AC28의 질문·도구 승인 배치를 대체. Claude stack·질문 및 기존 응답 payload 유지 |
| D-023 | OpenCode transcript는 실제 desktop 조작과 원본 소스에 맞춰 행 배치·도구 펼침·스크롤/선택 동작을 이식 | “Transcript를 드래그하며 … 똑같이 렌더링하라.” Claude GUI와 canvas·사용자 버블 색상 예외는 유지 | 2026-10-15 사용자 | ACTIVE | AC26 표시·공통 exchange 가상화의 OpenCode 적용 보완. D-020의 색상 유지, 당시 비변경 범위였던 외형은 이번 원본 대조 대상 |
| D-024 | todowrite는 composer 바로 위에서 펼친 목록 또는 접힌 요약으로 표시되고 전체 수행 후 아래로 퇴장 | “접기 기능으로 composer 바로 위에 접힌 형태로도 노출될 수 있다.” 읽기 전용 진행 목록과 실제 호출 결과를 연결 | 2026-10-15 사용자 추가 지시·접기 보완 | ACTIVE | 일반 TodoWrite transcript 표시만 native처럼 숨김. 원본 호출·결과 저장 및 Claude 표시 유지 |

갱신 메모: D-017/018 추가. D-015의 2.x 미지원과 향후 계층 확장은 양립하며 D-004/011의 Claude 스타일·배경은 유지한다. ACTIVE 결정 ↔ AC22~25 대조: 충돌 0, 미정 제품 결정 없음.

ΔV8 갱신 메모: D-020↔AC29와 D-004/011/019↔AC11/15/26을 대조했다. 사용자 버블 색상만 대체하므로 Claude 표시·canvas 유지 및 나머지 데스크톱 UI 계약과 충돌 0이다.

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

비범위: OpenCode 앱 자체 수정, Work 지원, 미지원 Claude 전용 background 제어의 가짜 구현, 자동 업데이트/CLI 다운로드. CLI는 설치된 실행 파일을 사용하고 설정에서 경로를 지정할 수 있다.

V1의 “사용자 OpenCode 앱의 세션 이관” 비범위는 ΔV15 D-031의 기존 Orca 격리 세션 전환과 0265의 알려진 native 세션 재열기 범위에 한해 SUPERSEDED다. 전역 native 세션 자동 발견 UI는 이번 범위가 아니다.

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

AC10의 지원 범위 제한은 유지한다. 화면의 범주 제목과 OpenCode `작업` 타일의 노출·열림 계약은 [0263 ΔV3](../0263-opencode-session-panel/plan.md)가 대체하며, 이 문서의 VP-10/17/19·EP-10은 해당 변경의 회귀 경로로 연결한다.

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

서버는 adapter 소유 풀에서 구성 fingerprint별 lazy spawn, loopback 임의 포트와 개별 인증 암호를 사용한다. 기존 OpenCode 앱 서버와 포트를 공유하지 않는다. V1의 “Orca 전용 데이터 경로”는 ΔV15 D-029로 SUPERSEDED이며 새 계약은 native 기본 경로와 사용자 지정 native 환경을 따른다. 전송·이력은 같은 OpenCode session ID로 Orca DB에도 보관하지만 원본 권위는 [ADR-009](../../decisions/009-harness-native-storage-authority.md)를 따른다.

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

하향 DAG, Chromium fetch 주입, 두 테마 토큰, 한국어 UI, append-only migration을 유지한다. V1의 “DB history SSOT”는 ΔV15 D-029·0265·ADR-009로 SUPERSEDED이며 Orca DB 보관은 유지한다. OQ7/OQ10은 당시 사용자 답변으로 닫았고 신규 패키지 없음, 0214 native API 권고와 호환 API 채택의 구분은 유지한다.

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

# ΔV7 — 사용자 제공 데스크톱 UI 이식 (READY)

## 제품 계약·출처와 AC

사용자가 제공한 `.tmp/opencode-dev`는 package.json상 2.0.29 소스 아카이브다. 별도 `.git`이 없으므로 부모 저장소의 HEAD를 upstream revision으로 기록하지 않는다. 데스크톱은 `packages/app`의 timeline이 `packages/session-ui`를 호출한다. UI를 React로 이식하며 2.x SDK·서버 API를 도입하지 않는다. 이 추가 범위는 같은 OpenCode 화면의 연속 작업이므로 기존 handoff에 AC26~28을 더한다.

| AC / 노드 | 관측 결과 | 직접 oracle |
|---|---|---|
| AC26 / R-26↔AT-26 NEW | OpenCode의 도구 행·탐색 그룹·셸 명령/결과·파일 diff·오류·Q&A와 본문은 데스크톱의 간격·위계·oc-2 두 테마를 따른다. transcript canvas 배경은 그대로다 | 실제 renderer의 종류·상태·펼침/복사/Q&A 렌더, light/dark Computer Use |
| AC27 / R-27↔AT-27 NEW | OpenCode composer는 radius 12, 13px 본문, 44px toolbar, 28px 제어/전송 버튼을 사용한다. 좁은 폭에서 toolbar는 스크롤하며 전송과 겹치지 않는다 | 실제 composer 입력/초안/IME 회귀 및 좁은 폭 시각 확인 |
| AC28 / R-28↔AT-28 NEW | 질문은 헤더·진행 막대·radio/checkbox 선택·직접 입력·접기·뒤로/다음/제출을 가진 dock, 승인은 같은 dock의 도구 설명·거부/세션 허용/허용으로 표시한다 | 실제 질문 컴포넌트의 선택·다중/기타·이전/다음·접기·IME·Ctrl+Enter·Esc·응답 payload 및 승인 callback 전달 |

AC24/25의 도구 순서·상태·스트리밍·원본 보존은 INHERITED이며 표시만 갱신한다. 기존 Claude의 질문과 composer는 유지한다. 질문 선택은 자동 진행하지 않고 다음 버튼/제출 단축키로 진행한다. 마지막 제출은 모든 질문에 답이 있을 때만 가능하다. 접어도 답을 보존하고 새 requestId에서는 초기화한다. 기존 `answerAsk/skipAsk/approveTool`의 요청·오류·중복 방지 계약을 유지하며 UI를 위해 승인 정책을 바꾸지 않는다. 중단/실패/거절을 성공으로 꾸미지 않는다.

ΔV8 적용 후 AC26·EP-27b·VP-46 중 사용자 버블 배경·글자색은 AC29·EP-30·VP-50이 대체한다. 도구·assistant·Q&A·composer와 나머지 버블 외형은 위 계약을 유지한다.

## 조사와 기술 설계

- `packages/app/src/session/timeline/message-timeline.tsx` → `packages/session-ui/src/timeline/row`: 실제 desktop transcript 경로.
- `session-ui/src/components/{basic-tool,message-part,tool-error-card,question-prompt}.css`: tool 28px/13px, shell 명령과 결과 분리, 파일 헤더/통계, 240px 출력 스크롤, 질문 6px 옵션·10px dock.
- `app/src/composer/editor/{editor.tsx,editor.css}`: textarea 영역 60~180px, toolbar 44px와 가로 스크롤, 버튼 28px. Orca의 동일 textarea/controller와 첨부·IME 수명을 유지한다.
- `app/src/session/requests/session-{question,permission}-dock.tsx`: radio/checkbox, 직접 입력, Ctrl+Enter·Alt+Left·숫자/화살표, permission 세 동작. `form.reply` 등 2.x API는 복제하지 않는다.
- `ui/src/theme/themes/oc-2.json`: 실제 기본 테마의 v2Overrides를 해석해 OpenCode 전용 의미 토큰을 만든다. light base #fff/layer01 #fafafa/layer02 #f2f2f2/text #161616, dark base #161616/layer01 #242424/layer02 #2e2e2e/text #fafafa. 현재 공통 `bg`·transcript surface/fade 토큰은 수정하지 않는다.

전용 `harnesses/opencode/{composer,transcript}`가 외형과 질문 UI 상태를 소유한다. 공통 Composer/ToolApprovalBody는 normalized request와 기존 action만 전달한다. 질문 DTO와 v1 decoder는 그대로다. 공통 DiffTable은 의미 색상만 주입 가능하게 하여 같은 줄 파싱·syntax 계산을 사용한다. 토큰은 tokens.css의 light/dark에 추가하고 스타일은 Tailwind 유틸리티로 표현한다. OpenCode MIT notice를 앱 배포 resources에 포함한다. 새 의존성·IPC·저장 형식 변경 없음.

## §10 강제 지점과 V

| 자리 | 실패 의미 | 직접 oracle |
|---|---|---|
| EP-27a: ToolGroup/Card/Body | 상태·원문·diff·복사 손실, 셸 명령/결과 혼동 | 기존 ToolCard interaction + 셸 영역/오류 확장 DOM |
| EP-27b: assistant/user/Q&A·토큰 | Claude 스타일 누출 또는 canvas 배경 변경 | 실제 segment/Q&A 렌더 + 두 테마 CUA |
| EP-28a: Composer→input toolbar | 입력 재마운트/초안 손실·컨트롤 겹침 | ComposerInputController 기존 interaction + CUA 좁은 폭 |
| EP-29a: Composer→질문 선택 | OpenCode가 Claude 질문 화면을 사용 | 실제 Composer 분기 렌더 또는 CUA 질문 dock |
| EP-29b: 질문→answerAsk/skipAsk | 답 소실·빈 제출·IME 중 전송·잘못된 요청 | 실제 질문 state/keyboard/callback DOM test |
| EP-29c: ToolApprovalBody→dock actions | 하네스·approvalId·범위 오배선 | 실제 ToolApprovalBody→allow once/session/reject callback test |

| pair | requiredness | production path / oracle |
|---|---|---|
| VP-46 / R-26↔AT-26 | REQUIRED | EP-27a/b, 실제 도구/Q&A DOM 및 두 테마 시각 |
| VP-47 / R-27↔AT-27 | REQUIRED | EP-28a, 입력/IME 기존 회귀 및 toolbar 시각 |
| VP-48 / R-28↔AT-28 | REQUIRED | EP-29a/b/c, 실제 질문/승인 UI와 callback payload |
| VP-49 / MD-08↔UT-08 | REQUIRED | 질문 선택 상태→normalized 답, 단일/다중/기타/왕복/취소 직접 행동 |
| VP-43/44/45, V1 VP-11/18, ΔV2 배경·ΔV5 경계 | REGRESSION | 기존 도구/committed/live/composer/runtime·정규화 회귀, Claude 표시·1.x 경계 |

강제 지점은 6자리다. 직접 행동 oracle을 사용하며 선택 적대 증거는 없음. 게이트는 관련 Vitest, 전체 typecheck·readonly ESLint, build, 문서 inventory/links, 원격 CI. ABI를 변경하는 npm pretest는 피하고 DB 검증 필요 시 Electron Node 모드로 실행한다. 다운로드 소스가 doc link scanner에 들어오면 사용자 파일을 수정하지 않고 repo scope 검사와 baseline 실패를 분리 보고한다.

READY 대조: D-019와 기존 ACTIVE D-004/007/011/015~018 충돌 없음. 사용자 명시 추가 요청으로 설계→구현을 계속한다. 원본과 Orca의 경로를 읽었고 별도 제품 결정·패키지 승인은 필요하지 않다.

# ΔV8 — 사용자 메시지 버블의 Claude 공통 색상 (READY)

## 제품 계약과 출처

기준은 공유 브랜치의 `73681f8007c2ad9de2f89196095154558f7767c2`에 있는 V1+ΔV1~7이다(`git cat-file -t` 결과 `commit`). 이번 턴은 사용자가 요청한 기존 핸드오프의 설계 델타만 반영하며 코드·테스트 구현은 다음 구현 턴이다. 아래 기존 구현 보고와 AC11의 시각 인수 대기는 이전 범위의 기록으로 보존한다.

사용자 원문: “사용자 메시지 버블의 배경 및 폰트 색상이 오픈코드 데스크톱과 다르다. Claude transcript의 서용자 메시지 버블과 똑같이 변경하라.”

| AC / 노드 | 관측 결과 | 직접 oracle / production path |
|---|---|---|
| AC29 / R-29↔AT-29 NEW | OpenCode와 Claude의 사용자 메시지 버블 배경·글자색이 밝은/어두운 테마에서 각각 동일하다. 버블 본문·첨부·복사·접기와 OpenCode의 기존 배치·간격·반경·글자 크기는 유지한다 | 실제 `TranscriptView→Exchange→UserTurn→UserMessage→UserBubbleText` 렌더에서 본문 색 토큰·내용 관측, 두 테마 Computer Use에서 computed background/color 비교 |

색상 두 속성이 변경 범위다. assistant·도구 카드·Q&A·전송 대기 버블의 스타일과 transcript canvas/fade는 현재 계약을 유지한다. 우측 패널과 타이틀 메뉴의 추가 요구는 [0263 ΔV3](../0263-opencode-session-panel/plan.md)에서 소유한다.

## 조사 / AS-IS → TO-BE

| 대상 / 검색 | 관측 | 변경 책임 |
|---|---|---|
| `harnesses/{opencode,claude}/transcript/appearance.ts`의 `userBubble` | OpenCode는 `bg-oc-bubble text-oc-bubble-ink`, Claude는 `bg-bubble-user text-ink` | OpenCode의 색상 두 클래스만 Claude와 같은 공통 의미 토큰으로 교체 |
| `UserMessage.tsx`의 `transcriptAppearance(openCode).userBubble` | 공통 본문이 선택된 하네스의 외형을 `UserBubbleText`에 전달 | 기존 조립·memo·collapseKey를 유지하고 최종 버블 색상에서 판정 |
| `TranscriptView.tsx`의 Exchange 두 경로와 `Exchange.tsx`·`UserTurn.tsx` | 가상화된 이전 교환과 마지막 교환이 같은 사용자 버블에 도달 | 두 경로 모두 전용 외형의 공통 색상을 사용하도록 회귀 잠금 |
| `AssistantSegment.render.test.ts`: `selects the user bubble style while keeping one copy/time row and disabling OpenCode fork` | 기존 검사는 `bg-oc-bubble`을 기대 | 변경된 색상 기대만 갱신하고 본문·복사 수·fork 제한 단언은 유지 |

색상 값은 `styles/tokens.css`의 기존 `bubble-user`·`ink`가 정본이다. OpenCode 외형 모듈에서 Claude 구현을 직접 import하거나 두 색을 별도 hex 값으로 복제하지 않는다. 새로운 토큰·의존성·IPC·저장 형식·서버 API는 필요하지 않다.

## V / §10 증분 강제 지점

| 노드 / 기존 증거 | provenance / 대체 관계 |
|---|---|
| R-26↔AT-26 중 사용자 버블 배경·글자색 | SUPERSEDED → R-29↔AT-29. 기존 AC26·VP-46의 이 부분은 VP-50으로 이관하며 선택 적대 증거는 원래 없음 |
| R-26의 나머지 표시, R-25의 순서·수명·내용, R-11/15의 하네스 격리·canvas | INHERITED → VP-46/44/11/25의 해당 회귀 유지 |
| R-29↔AT-29 | NEW → VP-50 REQUIRED |
| AR-03↔IT-03의 하네스 외형→사용자 본문 배선 | INHERITED → VP-17 REGRESSION. 전달 구조는 그대로이며 색상 최종 소비를 추가 관측 |

| 자리 | 실패 의미 | 직접 oracle 좌표 / 관측 대상 |
|---|---|---|
| EP-30a/b: OpenCode userBubble 배경 / 글자색 두 속성 (2) | 한 속성만 공통화하거나 전용 파란 색상이 잔존 | `AssistantSegment.render.test.ts`의 기존 사용자 버블 케이스 갱신: 실제 UserMessage 산출에서 두 공통 색 클래스와 기존 본문·복사 단언 |
| EP-30c/d: TranscriptView의 이전 Exchange / 마지막 Exchange (2) | 이전 이력과 마지막 사용자 발화의 색상이 다름 | `TranscriptView.harness.test.ts` 신규 `uses Claude user bubble colors in earlier and last OpenCode exchanges`: 실제 두 교환을 렌더하고 각 사용자 본문 조상 버블의 두 토큰 관측. 가상 head가 실제 mount되도록 viewport/측정 환경을 제공 |
| EP-30e/f/g: Exchange→UserTurn / UserTurn→UserMessage / UserMessage→UserBubbleText (3) | 하네스 선택값이나 색상 외형이 최종 사용자 버블까지 전달되지 않음 | 위 신규 TranscriptView 케이스에서 세 컴포넌트를 mock하지 않고 실제 버블의 색상·기존 OpenCode 반경·본문을 관측 |

| pair | requiredness | path / 직접 oracle |
|---|---|---|
| VP-50 / R-29↔AT-29 | REQUIRED | EP-30a~g, 위 두 렌더 테스트 및 light/dark 실제 버블의 computed background/color 비교. Claude와 OpenCode는 동일 테마·같은 입력으로 비교 |
| VP-17 / AR-03↔IT-03 INHERITED | REGRESSION | TranscriptView→두 Exchange→UserTurn→UserMessage→UserBubbleText. EP-30c~g의 새 케이스로 해당 경계만 잠그며 기존 composer/panel 미잠금 범위를 통과로 바꾸지 않음 |
| VP-44/46·V1 VP-11·ΔV2 VP-25 INHERITED | REGRESSION | `AssistantSegment.render.test.ts`, `TranscriptView.harness.test.ts`, `ChatTile.harness.test.ts`, `UserMessage.requirements.test.ts`, `UserMessage.origin.test.ts`, `userBubble.render.test.ts`, `bubbleCollapse.test.ts`, `bubbleExpansionStore.test.ts`. 나머지 본문·첨부·복사·접기·배경·Claude 스타일 보존 |

강제 지점은 색상 두 속성 및 실제 전달 다섯 자리, 총 7자리다. 직접 최종 DOM과 두 테마의 computed 색상을 비교하므로 별도 mutation은 선택하지 않는다. 상태·수명주기·알고리즘·모듈 경계를 바꾸지 않아 신규 SD/AR/MD pair는 없다.

문서 턴 게이트는 변경 plan의 Decision/AC/V/§10 정합성, 링크·diff whitespace·INDEX 상태·커밋 trailer다. 다음 구현 턴은 관련 Vitest, 전체 typecheck·readonly ESLint, renderer build, 문서 inventory/links와 두 테마 Computer Use를 수행한다. 기존 실모델 도구 검증 생략 결정과 AC11 최종 시각 인수의 미완료 상태는 유지한다.

READY 대조: D-020↔AC29, R-26 색상 부분→R-29의 이관과 EP-30a~g를 연결했고 새 pair의 직접 oracle은 최종 사용자 버블을 관측한다. 기존 메뉴의 범주명 표시를 유지한다는 해석은 0263 ΔV3가 대체하며 하네스별 지원 제한은 남는다. 이번 델타에 필요한 추가 사용자 결정은 없다.

# ΔV9 — Claude GUI의 도입 전 표시 복원 (READY)

## 제품 계약과 기준선

상속 기준은 공유 브랜치 `841dff061d35a8ddf791317df1061e5463ac716e`의 V1+ΔV1~8이다. 비교 기준은 OpenCode 구현이 들어가기 전 `origin/main`과 공통 조상인 `0b8c1e9f296c06e6ca01ee8a8cd2f319c9245e3f`이며 두 객체를 `git cat-file -t`로 확인했다. 사용자가 직접 복원을 요청했으므로 설계 정정 뒤 같은 턴에서 구현하고 독립 verify는 별도로 유지한다.

사용자 원문: “Claude 세션에서 보여지는 모든 gui (transcript, 패널 등) 은 모두 opencode 도입 전과 같아야 한다. 수정하거나 추가된 것이 있으면 원래대로 복원하라.” 예시로 타이틀 케밥 메뉴의 그룹 제목과 엔진·모델 새로고침 버튼 제거를 지정했다.

| AC / 노드 | 사용자 결과 | 직접 oracle / production path |
|---|---|---|
| AC30 / R-30↔AT-30 NEW | Claude Code의 타일 메뉴는 계획→백그라운드 작업→변경사항, Work는 작업을 원래 평면 목록으로 표시. 기존 타일 표시 제목·토글·배지·헤더 유지. composer·transcript·패널의 원래 스타일 보존 | `ChatTitleBar.render.test.ts` 실제 메뉴 렌더와 CUA-CLAUDE-01; `TranscriptView.harness.test.ts` 실제 Claude/OpenCode viewport; 기존 composer/transcript/패널 회귀 |
| AC31 / R-31↔AT-31 NEW | 엔진·모델 헤더는 우측 엔진 추가만 표시하고 새로고침 버튼은 없음. Claude 카드 라벨은 claude, 편집 모달은 기존 고정 chip과 provider 표시. 다른 카탈로그 조회가 기존 Claude 편집·삭제·저장을 잠그지 않음 | 새 `AgentEnvironmentView.render.test.ts`·`EngineCard.render.test.ts` 및 `EngineFormModal.harness.test.ts`, `useEngines.test.ts`, CUA-CLAUDE-02 |

OpenCode 카드·설정·신규 엔진의 하네스 선택·설정 불러오기와 생성 세션의 하네스 잠금은 기존 명시 요구라 유지한다. 임시 상세 패널의 OpenCode 동작은 0263 ΔV4를 유지한다. 새로고침 제거를 다른 메뉴로 이동하는 것으로 대체하지 않으며, 최초 조회·저장 후 갱신·오류 표시는 기존 수명으로 처리한다.

## 조사 / 변경 책임

| 표면 | 기준선 대조 결과 | 변경 |
|---|---|---|
| ChatTitleBar | Claude만 rightPanelGroups를 렌더해 새 그룹 제목과 재정렬 발생 | 모든 하네스가 지원 tile definition의 원래 순서를 평면 렌더 |
| 엔진 페이지·카드 | 새로고침 추가, 엔진 추가의 ml-auto 이동, Claude 라벨 변경 | 새로고침 제거·원래 정렬·claude 라벨 복원 |
| Claude 엔진 편집 | 고정 chip이 disabled 하네스 select로 변경 | Claude 편집만 기존 chip 복원. 신규 선택과 OpenCode 편집은 유지 |
| useEngines | 매 진입 강제 재조회 및 catalog loading을 mutation busy와 결합 | 원래 ensureLoaded와 mutation busy로 복원. 저장 후 refreshAgents와 오류 표시는 유지 |
| TranscriptView | 모든 하네스 viewport에 bg-bg 추가 | OpenCode에만 적용. Claude는 원래 상위 ChatTile 배경을 사용 |
| composer·transcript·landing·공유 UI | 이동된 Claude 파일과 appearance/surfaces를 대조, 위 viewport 외 클래스·색상·간격 차이 없음 | 이설·공통 입력 수명과 기존 표시 유지 |
| 설정 | 기존 General/Usage 본문 차이 없음, 하네스 설정만 추가 | 명시된 하네스 설정 유지 |

`ChatTitleBar.render.test.ts`의 VISIBLE_TILE_REGISTRY 비교는 현재 실제 메뉴의 그룹 조립을 보지 못한다. 실제 ChatTitleBar가 만든 메뉴 항목을 관측하는 테스트로 보완한다. 데이터/SDK/IPC/저장 포맷이나 신규 의존성 변경은 없다.

## V / §10 증분 강제 지점

| Pair | requiredness / provenance | 경로와 직접 oracle |
|---|---|---|
| VP-51 R-30/31↔AT-30/31 | REQUIRED / NEW | 아래 EP-31~33와 CUA-CLAUDE-01/02의 실제 메뉴·페이지·폼 표시 |
| VP-52 AR-10↔IT-10 | REQUIRED / NEW | policy→ChatTitleBar→메뉴 및 useEngines→페이지→카드/폼의 기존 표시. 아래 실제 렌더 테스트 |
| VP-53 SD-07↔ST-07 | REQUIRED / NEW | 페이지 진입 ensureLoaded→캐시 사용, 저장→갱신, 외부 catalog loading→기존 mutation 조작 가능. `useEngines.test.ts`의 실제 hook 입력/결과와 CUA-CLAUDE-02 |
| VP-11/17/20/21/25/44/46/50 | REGRESSION / INHERITED | 기존 하네스 조립·엔진 CRUD/import·설정·composer/transcript 렌더. 기존 AC11 최종 사용자 인수는 이번 자기검증으로 대체하지 않음 |

| 자리 / 수 | 실패 의미 | 직접 oracle 좌표 |
|---|---|---|
| EP-31a/b / 2 | Claude Code/Work 메뉴에 그룹명이나 다른 순서 노출 | `ChatTitleBar.render.test.ts`: 실제 메뉴의 Code/Work 순서·타일 표시 제목·토글 확인; CUA-CLAUDE-01 |
| EP-32a/b/c / 3 | 새로고침 잔존·Claude 카드 이름 변경·편집 select 잔존 | `AgentEnvironmentView.render.test.ts`: 헤더 엔진 추가/정렬; `EngineCard.render.test.ts`: Claude/OpenCode 라벨; `EngineFormModal.harness.test.ts`: Claude chip/provider와 OpenCode 잠금 |
| EP-32d/e/f / 3 | 진입 강제 재조회·외부 조회로 mutation 잠김·저장 후 미갱신 | `useEngines.test.ts`: ensureLoaded 경로, catalogLoading 중 busy=false, mutation 완료 후 refreshAgents 및 오류 보존 |
| EP-33a / 1 | OpenCode 전용 viewport 스타일이 Claude에도 적용 | `TranscriptView.harness.test.ts`: 양 하네스 실제 viewport 클래스 및 공통 상위 canvas 회귀 |

증분 분모는 2+3+3+1=9자리다. 새 상태·알고리즘을 만들지 않아 신규 MD pair는 없다. 렌더된 메뉴·컨트롤·hook 결과를 직접 관측하므로 별도 구조 proxy나 mutation을 선택하지 않는다. 기존 V1 카탈로그 오류/새로고침 행의 수동 버튼 부분은 AC31로 대체하며, 서버 실패의 재전송과 자동 카탈로그 갱신은 유지한다.

CUA-CLAUDE-01은 Claude Code/Work 메뉴를 열고 순서·그룹 제목 제거·토글을 확인한 뒤 OpenCode 메뉴/요약 전환을 회귀 확인한다. CUA-CLAUDE-02는 엔진 페이지·Claude 편집 chip·신규 하네스 선택·OpenCode 카드를 확인한다. 로컬 실제 컴포넌트+native fixture 사용 시 증거 범위를 명시하고 새 실모델 호출은 하지 않는다.

게이트: 관련 Vitest, 전체 typecheck·읽기 전용 ESLint, build, 문서 inventory/links, 원격 Windows CI. READY 대조: D-004/021↔AC30/31, 기존 OpenCode 기능↔AC8/9/13/14/20은 양립한다. 0263의 기존 보고 중 Claude 범주 유지 관측은 과거 이력이며 현재 Claude 메뉴 표시 정본은 이 ΔV9다. AC 총수는29→31, 기존 AC11 인수 대기는 유지한다.

# ΔV10 — native 메시지 ID와 턴 종료 회귀 (READY)

기준은 공유 브랜치 `ce4b8496d7c99ad55164b3cb6226c51adbcf3b94`의 V1+ΔV1~9다. 사용자 보고: adapter의 랜덤 UUID가 OpenCode의 `lastUser.id < lastAssistant.id` 종료 조건을 만족하지 않아 정상 stop 뒤 같은 입력을 반복 요청한다. 기존 AC5의 정상 스트리밍·완료 계약 위반이며 제품 정책 변경이나 새 AC 추가가 아니다.

## 조사와 계약

현재 adapter는 `msg_`+UUID를 `promptAsync.messageID`에 보내고 같은 값을 activity generation과 root mapper의 parentID 필터에 사용한다. 이 값을 생략하거나 stop 수신만으로 Orca 턴을 조기 종료하면 응답 격리 또는 서버 실행 수명을 깨뜨릴 수 있으므로 기존 상관관계와 idle 종료를 유지한다.

[공식 1.18.5 앱 ID](https://github.com/anomalyco/opencode/blob/v1.18.5/packages/app/src/utils/id.ts)와 [1.19.0 ID](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/id/id.ts)는 시각×4096+동일ms counter의 하위6byte hex12와 base62 random14를 사용한다. `<` 종료 조건은 1.18.5 소스에 있고 현재 조회한 1.19.0 태그는 parentID equality라 버전별 차이를 구분한다. 설치 실행 파일은 `--version=1.19.0`을 직접 확인했으며 실제 동작은 별도 CLI 관측으로 판정한다.

| 변경 / 유지 | 구현 책임 |
|---|---|
| CHANGED MD-08↔UT-08 | `opencode/v1/message-id.ts`에 native ascending message ID 생성기를 둔다. 동일ms counter·다음ms reset·고정 prefix/길이·base62 suffix를 직접 값으로 검사한다 |
| CHANGED AR-11↔IT-11 | adapter의 생성→promptAsync wire→activity/mapper에 같은 ID 전달. 실제 SDK transport에서 native 정렬에 따른 stop/idle 수명과 현재/이전 턴 격리를 검사한다 |
| INHERITED R-05/SD-05 | 정상 stop 후 서버 내부의 불필요한 본문 모델 재요청이 없고 정상 idle→turn.ended로 끝나야 한다. tool/compaction·취소·실패 수명은 유지한다 |

SDK·CLI·renderer·DB·공개 DTO 변경은 없다. 잘못된 과거 native ID의 자동 재작성은 하지 않는다. 격리된 테스트 세션에서 정상 후속 턴과 가능한 기존 UUID 이력의 재개를 관측하고 제한이 발견되면 별도 근거로 보고한다. 사용자 인증과 외부 모델을 사용하지 않는다.

## Delta V / §10

| Pair | requiredness / provenance | 경로 · 직접 oracle |
|---|---|---|
| VP-54 MD-08↔UT-08 | REQUIRED / NEW | native ID helper→문자열. `message-id.test.ts`의 형식·시각 prefix·동일ms 순서·다음ms reset |
| VP-55 AR-11↔IT-11 | REQUIRED / NEW | adapter→실제 SDK body→SSE activity/mapper→턴 종료. `adapter.test.ts`의 native ID 순서와 현재 parentID, 순차 재개, 기존 stale/compaction 테스트 |
| VP-05/15/18 | REGRESSION / INHERITED | 관련 adapter/map/activity/runtime 오류·중단·도구·완료 회귀. 실제CLI+로컬 provider의 bounded 본문 호출 수와 idle 관측은 보조 실행 증거 |

| 자리 / 수 | 실패 의미 | oracle |
|---|---|---|
| EP-34a / 1 | UUID 또는 잘못된 timestamp/counter 때문에 native 시간순 정렬 불만족 | helper의 고정 clock 직접 값·연속 ID 순서 테스트 |
| EP-34b / 1 | helper를 만들었으나 SDK에 이전 UUID 전달 | 실제 SDK prompt body의 native 형식/정렬 및 stop/idle 응답 테스트 |
| EP-34c / 1 | wire와 mapper generation의 ID가 달라 응답 유실/오염 | 실제 adapter→activity/mapper의 현재 parentID 수락·이전 응답 무시·후속 턴 완료 테스트 |

증분3자리. VP-55는 EP-34b에 기존 UUID 생성식을 복구하는 M-ID 변이를 선택한다. 기존 fixture가 무조건 idle을 내보내 실제 native ID 계약을 놓쳤으므로 새 oracle이 원래 결함에 실패하는지 확인한다. 원래 소스를 복원한 뒤 같은 테스트가 통과해야 한다.

게이트는 관련 비DB Vitest, node/web/test typecheck, readonly ESLint, main/preload/renderer build, 문서·migration·test-budget와 원격 Windows CI다. CLI 보조 재현은 새 임시 data/workspace·loopback 합성 provider·본문2번째 호출 시 실패/중단하는 상한을 사용하고 제목 등 보조 호출을 구분한다. 기존 V 전체의 독립 검증이나 실모델 검증으로 확대하지 않는다. ACTIVE 결정과 충돌 없음, AC 총수31 및 AC11 인수 대기는 유지한다.

# ΔV11 — 질문·도구 승인 dock의 입력 대체·통합 순차 소비 (READY)

기준은 공유 브랜치 `556287e420d8bf3e1b66c894abadc954185fa307`의 V1+ΔV1~10이다(`git cat-file -t`=`commit`). 이번 턴은 요구 분배·설계이며 제품 코드 구현은 다음 턴이다. 0262의 기존 composer/승인 계약을 보완하므로 새 핸드오프를 만들지 않고, 0263 우측 패널 규범은 변경하지 않는다.

## 제품 계약 / AC

사용자 원문: “도구 승인 카드는 composer를 덮어써야 한다. 그리고 위로 스택되지 않으며, 차례대로 소비돼야 한다.” 후속 요구 “Question 도구 또한 composer 위에 쌓이는게 아닌 composer를 덮는다”와 동시 대기는 종류와 관계없이 도착 순서로 한 장씩 표시한다는 답변을 D-022에 반영한다. 현재 카드가 소비되기 전 뒤 카드의 노출·peek·오프셋·개별 선택 탭도 제공하지 않는다는 추가 확인을 따른다.

| 노드 | 동작 기준 / 직접 검증 |
|---|---|
| R-28↔AT-28 / AC28 CHANGED | OpenCode 질문·도구 승인 dock은 입력 영역을 대체한다. 질문의 선택·직접 입력·접기·제출/건너뛰기와 도구의 허용/세션 허용/거부 payload는 유지하며 Claude 배치는 바꾸지 않는다 |
| R-32↔AT-32 / AC32 NEW | 질문 Q1→승인 P1→질문 Q2와 반대 종류로 시작하는 순서를 각각 검사한다. 도착 순서의 현재 카드만 DOM·접근성 트리에 mount하고, 현재 ID 해소 후 다음 카드로 교체하며 마지막 해소 후 기존 초안·첨부와 composer를 복원한다 |

입력기·전송·첨부 조작은 질문이나 승인 표시 동안 노출하지 않는다. 입력 영역의 단일 대체 슬롯에는 현재 카드 하나만 있고 뒤 카드·빈 카드 프레임·스택 높이·peek·요청별 탭을 만들지 않는다. 뒤 요청은 데이터로만 보존하며 다른 세션의 요청을 섞지 않는다.

| 상태 / 사건 | 결과 |
|---|---|
| 빈 큐→첫 질문 또는 승인 | 입력 controller 상태를 유지한 채 표시를 숨기고 해당 종류의 dock 한 장 표시 |
| 대기 중 종류가 같은/다른 요청 도착 | 도착 순서를 뒤에 보존. 현재 질문의 선택·직접 입력·접기 상태와 현재 dock을 유지하며 뒤 요청은 mount하지 않음 |
| 질문 제출/건너뛰기, 도구 허용/세션 허용/거부 | 기존 action의 ID 해소 직후 다음 미해소 카드로 교체. 종류 우선순위나 native HTTP 성공 ACK를 기다리는 새 정책 없음 |
| 외부 permission.resolved | 해당 ID의 payload와 순서 참조만 제거. 비선두 해소는 현재 카드 유지, 마지막 해소는 입력 복원 |
| 중단/오류·새 대화/로드 | 기존 요청 수명에 맞춰 순서도 정리. child 요청을 보존하는 기존 경로에서는 살아남은 요청의 상대 순서를 보존 |
| 세션 전환 | 해당 세션의 통합 선두를 표시. 캐시 왕복 시 세션별 pending 데이터·순서를 보존하며 다른 세션의 resolved로 현재 카드가 바뀌지 않음 |

## 조사 / 기술 설계

| 대상 / 검색 | 관측 / 적용 |
|---|---|
| `Composer.tsx:153,232~249,294`의 activeAsk·pendingToolApprovals·active | 질문 선두와 전체 승인 map을 별도 렌더한다. OpenCode만 통합 선두를 단일 입력 대체 슬롯에 배치하고 두 기존 additive 경로에서는 제외 |
| `chatReducer.ts:1125~1187,1503,1613` | 질문·승인 배열은 종류 안의 순서만 보유한다. 각 배열을 이어 붙이거나 ID/시각으로 정렬해도 실제 종류 간 도착 순서를 복원할 수 없어 순서 메타데이터 추가 필요 |
| `chatStore.ts:1606~1623,1785~1804` | answerAsk/skipAsk와 승인 세 액션은 기존 IPC payload·로컬 ID 해소를 유지. main broker와 v1 reply 경로를 변경하지 않음 |
| `chatReducer.ts:587~597,1251,1260,1363,1274,1373,1384` | child 보존 helper와 새 대화/로드 reset에 순서 메타데이터 정리를 함께 배선. payload보다 먼저 지우거나 완료된 ID를 남기지 않음 |
| 원본 v1.19.0 `pages/session/composer/session-composer-{region,state}.tsx/ts`, `session-request-tree.ts` | 질문·permission을 독립 선택하여 둘 다 표시할 수 있고 blocked가 입력을 숨긴다. 통합 한 장·종류 무관 FIFO는 원본에서 추정한 규칙이 아니라 D-022 사용자 확정으로 대체 |

세션 휘발 상태에 `pendingRequestOrder: Array<{ kind: 'ask_question' | 'tool_approval'; requestId: string }>`만 추가한다. payload는 기존 `pendingAsks`·`pendingToolApprovals`가 계속 소유하며, `permission.requested`를 reducer가 처리한 순서대로 참조를 append한다. 하네스 확정 전의 draft 이벤트도 있으므로 수신 시 순서는 기록하되 이 순서로 화면을 선택하는 소비자는 OpenCode로 한정한다.

`harnesses/opencode/composer/requestQueue.ts`의 순수 selector가 순서 참조와 해당 payload를 대조해 살아 있는 첫 요청 하나를 반환한다. 입력 배열의 결합 순서·UUID 정렬·같은 ms 시각 비교로 대체하지 않으며, payload가 없는 참조는 표시하지 않는다. 로컬 RESOLVE_ASK/RESOLVE_TOOL_APPROVAL과 외부 permission.resolved는 payload와 해당 순서 참조를 함께 제거하고, child 보존·reset도 같은 소유 범위를 유지한다.

`harnesses/opencode/composer`가 단일 대체 슬롯과 종류별 dock 선택을 소유하고 공통 Composer는 normalized request·기존 callback을 전달한다. `ComposerInputController` 인스턴스는 항상 mount하고 selector의 유효 선두가 있으면 `active=false`로 두어 초안·첨부·IME 정리 수명을 재사용한다. Claude의 기존 질문·전체 승인 map·입력·중단 표시와 plan_review 수명은 그대로이며, 새 순서 필드는 IPC·DB·재시작 승인 복원 계약에 추가하지 않는다.

## V / §10

| Pair / provenance | requiredness | 경로 / 직접 oracle |
|---|---|---|
| VP-56 R-32↔AT-32 NEW, VP-48 R-28↔AT-28 CHANGED | REQUIRED | 실제 Composer에 혼합 요청→한 장 대체→응답/거절→입력 복원. `Composer.approvalQueue.test.ts: renders only the earliest mixed request in the replacement slot`, `consumes question and permission requests in arrival order` 및 CUA-OC-REQ |
| VP-57 AR-12↔IT-12 NEW | REQUIRED | 실제 store/reducer→selector→Composer→QuestionDock 또는 ToolApprovalBody/PermissionDock→실제 chatActions. 위 테스트에서 IPC만 spy하여 각 requestId·질문 답·허용 범위·거부 payload와 다음 DOM을 관측 |
| VP-58 SD-08↔ST-08 NEW | REQUIRED | 혼합 도착→응답/외부취소→다음→빈 큐 및 세션 왕복. `Composer.approvalQueue.test.ts: keeps the draft and attachments until the mixed queue is empty`, `applies external resolution only to its session and request`; 아래 reset/child 자리의 실제 reducer 테스트 연결 |
| VP-67 MD-11↔UT-11 NEW | REQUIRED | 수신 순서 append→ID별 정리→유효 선두 선택. 새 `chatReducer.request-order.test.ts`와 `requestQueue.test.ts`의 혼합 순서·시각/ID 비정렬·stale 참조·reset·child 상대 순서 직접 값 검사 |
| VP-11/49, VP-51/52 INHERITED 및 VP-48 비변경 질문 조작 | REGRESSION | `Composer.approvalQueue.test.ts: retains Claude approval and question layout`; 기존 QuestionDock 선택/접기/답변·`chatReducer.tool.test.ts`·`chatReducer.approval-lifetime.test.ts`; adapter의 `replies to permission and question approvals once, including rejection`·중단 검사 |

| 강제 자리 / 수 | 실패 의미 | 직접 oracle 좌표 (구현 예정) |
|---|---|---|
| EP-35a / 2: 질문 수신·승인 수신→순서 append | 종류별 배열을 합쳐 실제 도착 순서 역전 | `chatReducer.request-order.test.ts: records mixed requests in event arrival order`; 실제 request 이벤트 Q/P/Q 및 P/Q/P와 역순 문자열 ID |
| EP-35b / 1: 순서/payload→selector | stale 참조 표시·대기 요청 유실 | `requestQueue.test.ts: selects the earliest live request without sorting identifiers`; 살아 있는 첫 payload와 빈 큐 직접 단언 |
| EP-35c / 1: Composer→단일 대체 슬롯 | 입력 위 스택·뒤 카드 peek/탭·숨은 interactive DOM 잔존 | `Composer.approvalQueue.test.ts: renders only the earliest mixed request in the replacement slot`; input-slot 부모·dock1개·뒤 ID/내용/조작 DOM 부재·composer 편집기 부재, CUA-OC-REQ 접근성 트리 확인 |
| EP-35d / 1: controller active | 입력 remount로 초안·첨부 유실 또는 빈 큐 전에 복원 | `Composer.approvalQueue.test.ts: keeps the draft and attachments until the mixed queue is empty`; 실제 입력·첨부와 마지막 해소 후 값/파일 |
| EP-35e / 2: 질문 제출·건너뛰기→action | 답 payload 소실·건너뛰기에 allow·다른 요청 소비 | `Composer.approvalQueue.test.ts: consumes question and permission requests in arrival order`; 실제 질문 조작→answerAsk/skipAsk→allow(updatedInput)/deny IPC와 다음 카드 |
| EP-35f / 3: 도구 허용·세션 허용·거부→action | 다른 ID 해소·허용 범위 오배선 | 같은 테스트: 실제 dock 클릭→once/session/reject IPC payload, toolName/scope 및 다음 카드 |
| EP-35g / 2: RESOLVE_ASK·RESOLVE_TOOL_APPROVAL→순서 정리 | 소비한 카드 재등장·다음 종류 삭제 | `chatReducer.request-order.test.ts: removes only the locally resolved request from mixed order`; 두 action별 나머지 payload·상대 순서, 위 Composer 소비 시나리오의 다음 DOM |
| EP-35h / 1: 외부 permission.resolved→다음 표시 | 취소된 카드 잔존·비선두 취소가 현재 카드 교체 | `Composer.approvalQueue.test.ts: applies external resolution only to its session and request`; 질문/승인 선두·비선두 취소, A/B 세션 및 마지막 해소 |
| EP-35i / 3: NEW_CHAT·START_LOAD_SESSION·LOAD_SESSION | 새 대화·재로드에 이전 pending 순서 잔존 | `chatReducer.request-order.test.ts: clears request order on new chat and session loading`; 세 action 각각 기존 payload reset과 빈 순서 직접 관측 |
| EP-35j / 3: error·turn.aborted·CANCEL_CHAT→child 보존 | 남은 child 요청 유실·제거한 main 순서 잔존 | `chatReducer.request-order.test.ts: preserves surviving child requests in arrival order`; 세 경로 각각 혼합 main/child payload와 원래 상대 순서 관측 |

19자리(2+1+1+1+2+3+2+1+3+3). 기존 SSR controller 검사나 action mock만으로 이 배선을 닫지 않고, 실제 Composer·selector·질문/승인 dock·store/reducer를 실행하여 대체 슬롯·유일한 현재 카드·응답 payload·다음 화면을 함께 관측한다. 순수 순서 oracle도 종류가 교차하고 문자열 ID는 역순인 입력을 사용하므로 별도 mutation은 미선택이다.

구현 gate 실행 집합에는 위 신규 세 테스트와 기존 QuestionDock·Composer 입력/IME·도구 승인·child 수명·v1 승인/질문/중단 회귀를 포함한다. `CUA-OC-REQ`는 질문/승인 두 종류로 각각 시작하는 혼합 대기에서 현재 한 장만 보이고 뒤 카드는 접근성 트리에도 없으며, 마지막 해소 뒤 입력이 복원되는지 확인한다. 전체 운영 gate는 아래 ΔV11~13 통합 게이트를 따른다.

# ΔV12 — desktop transcript의 행·스크롤·선택 이식 (READY)

기준은 ΔV11과 같은 커밋의 AC26·D-019이며 ΔV11 입력 dock 높이 변화와 함께 검증한다. 실제 desktop의 탐색 그룹·셸 카드 펼침, 본문 선택, 스크롤바 상하 드래그를 관찰했다. 상세 범위와 미관측 항목은 [디자인 증거](design-evidence.md#desktop-직접-조작과-todo-호출-2026-10-15-설계-델타)에 둔다.

## 제품 계약 / AC

| 노드 | 동작 기준 / 검증 |
|---|---|
| R-26↔AT-26 / AC26 CHANGED | 원본의 도구/본문/턴 간격·탐색 그룹/파일 헤더·셸 명령/출력·접기·본문 위계를 적용. 기존 canvas와 사용자 버블 배경/글자색은 D-011/020대로 유지 |
| R-29↔AT-29 / AC29 CHANGED | 두 테마의 사용자 버블 배경·글자색 동등성, 본문·첨부·복사·접기와 글자 크기 설정은 유지. ΔV8의 당시 배치·간격·반경 불변 부분만 D-023의 원본 외형 이식으로 대체 |
| R-33↔AT-33 / AC33 NEW | 과거 내용을 스크롤바/휠/키보드/텍스트 선택으로 읽는 동안 새 출력·도구 높이 변화가 읽는 위치를 바닥으로 끌지 않는다. 바닥 또는 최신 이동으로 돌아오면 새 출력을 추종하고, 펼침 상태·선택·세션별 위치를 보존한다 |

사용자 버블 외형은 원본의 폭 `min(82%,64ch)`·반경10px·padding8/12px를 기준으로 대조하되 공통 색상·사용자 글자 크기 설정은 유지한다. 도구 간8px·본문 경계16px·턴24px와 원본의 하단64px 여유를 적용한다. 기존 Claude의 50cqh 예약공간과 exchange 가상화 동작은 변경하지 않는다.

## 조사 / 기술 설계

| 대상 | 원본 / 현재 차이 / 책임 |
|---|---|
| desktop 진입 | `.tmp/opencode-dev/packages/desktop/src/renderer/desktop-app.tsx`→app screen→timeline→session-ui. 아카이브2.0.29이며 별도.git 없음; 설치 desktop1.19.0과 판본 구분 |
| 가상행 | 원본 `timeline/virtualizer.tsx`·`session-ui/timeline/projection.ts`: 개별 사용자·assistant part·notice·gap. 현재 `TranscriptView.tsx`: 과거 exchange 가상화+마지막 비가상 tail |
| 스크롤 의도 | 원본 `virtualizer.tsx:715~765`·`interaction.ts`: pointer-held 위 이동/선택 unpin, 실제 바닥 도착만 repin. 현재 `useScrollAnchor.ts`: 바닥24px 이내 판정과 공통 예약공간 |
| 펼침 헤더 | 원본 `message-part.css:667~686`: 탐색 헤더 sticky 28+8px·내부 헤더 offset. 현재 `ToolGroup.tsx`: 일반 버튼·border-left 목록 |

`TranscriptView`는 하네스 dispatcher로 분리하고 Claude 본문과 `useScrollAnchor`는 기존 구현을 유지한다. OpenCode의 `transcript/{Timeline,projection,scrollPolicy}`가 normalized messages/parts와 현재 live 상태를 받아 안정된 행 키·가상화·측정·선택·추종을 소유한다. 공통 ChatTile은 scroll/jump 인터페이스만 연결하며 두 스크롤 제어기가 동시에 같은 viewport를 조작하지 않게 한다.

현재 `MessageSegment.kind`의 text/reasoning/tools/ask/structured/error/compact/fork/subagent_notice 9종을 누락 없이 투영한다. tools는 탐색 그룹·개별 도구로 세분하되 원래 text→tool→text 순서, toolUseId, raw input/result와 live→완료 행 identity를 보존한다. 가상행의 화면 밖 재마운트에도 도구 펼침은 세션별 key 상태에 남겨야 한다.

원본 geometry에서 바닥 epsilon0.5px, 최신 이동 버튼 임계는 `max(400px, viewport 높이)`다. 중첩 셸/코드 스크롤은 해당 영역이 소유하며 selection 중인 노드와 펼친 앵커를 가상화로 제거하지 않는다. 세션 변경 시 observer·rAF·pointer listener를 정리하고, dock 높이·창 폭·글자 크기 변경 시 현재 읽는 행과 상대 위치를 유지한다.

실제 browser 재현 진입점은 새 `app/scripts/fixtures/opencode-ui/{index.html,main.tsx,vite.config.ts}`로 고정한다. `app`에서 `node node_modules/vite/bin/vite.js --config scripts/fixtures/opencode-ui/vite.config.ts --host 127.0.0.1`로 실행하며 기존 React/Tailwind 플러그인과 실제 production 컴포넌트·store·CSS를 사용한다. native IPC만 메모리 대역을 연결하고 외부 모델을 호출하지 않는다. fixture는 아래 케이스 선택과 측정값(scrollTop, selection 문자열, 행 key·좌표, dock 높이)을 제공하며 Computer Use로 조작 후 관측을 기록한다. JS 순수 정책 검증은 Vitest가 담당하고 이 경로는 실제 레이아웃 검증을 담당한다.

## V / §10

| Pair / provenance | requiredness | 경로 / 직접 oracle |
|---|---|---|
| VP-59 R-33↔AT-33 NEW, VP-46 R-26↔AT-26 CHANGED | REQUIRED | 실제 OpenCode viewport의 과거 읽기/최신 복귀/도구 펼침. 새 `Timeline.browser` 검증 fixture 및 Computer Use CUA-OC-SCROLL |
| VP-50 R-29↔AT-29 CHANGED | REQUIRED | `TranscriptView.harness.test.ts`·`AssistantSegment.render.test.ts`의 OpenCode 외형 기대만 원본 치수로 갱신. 기존 본문·복사·Claude 분기 단언과 두 테마 computed background/color 동등성 유지 |
| VP-60 AR-13↔IT-13 NEW | REQUIRED | ChatTile→하네스 viewport→live/committed projection→실제 row. 새 `Timeline.render.test.ts`에서 실제 messages/store로 순서·identity·Claude 분기 관측 |
| VP-61 SD-09↔ST-09 NEW | REQUIRED | 스트리밍→사용자 드래그→resize/새 출력→최신 복귀→세션 왕복. 실제 browser fixture에서 scrollTop·선택 텍스트·visible anchor 관측 |
| VP-62 MD-09↔UT-09 NEW | REQUIRED | 새 `projection.test.ts`의9종·그룹 경계·prepend/live완료 key, `scrollPolicy.test.ts`의1px 위 이동·선택·재측정·실제 바닥 도착 |
| VP-43/44/45/51/52 INHERITED | REGRESSION | `ToolCard.interaction.test.ts`, `AssistantSegment.render.test.ts`, `TranscriptView.harness.test.ts`; 원문·질문·오류·색상·Claude GUI. 0263 요약/상세·artifact 복귀는 영향 회귀만 |

| 강제 자리 / 수 | 실패 의미 | 직접 oracle 좌표 (구현 예정) |
|---|---|---|
| EP-36a / 1: ChatTile→하네스 제어기 | Claude 변경·스크롤 제어 이중 실행 | `Timeline.render.test.ts` 실제 dispatcher + Claude 기존 viewport 회귀 |
| EP-36b / 1: message/parts→rows | 도구 순서·9종 내용·행 key 손실 | `projection.test.ts` 전종·text/tool/text·prepend·live완료 |
| EP-36c / 1: rows→가상 DOM | 화면 밖 내용 누락·선택 소멸 | `opencode-ui/main.tsx`의 `long-history-selection`: 긴 이력 양방향 드래그·selection 문자열·재진입 |
| EP-36d / 1: gesture→pin/jump | 위로 읽는 사용자를 바닥으로 당김 | `scrollPolicy.test.ts` + 같은 fixture의 `streaming-unpin-repin`: pointer·wheel·keyboard 중 scrollTop·최신 복귀 |
| EP-36e / 1: size/접기→anchor | 펼침/접기·dock 변경 때 읽는 행 점프 | 같은 fixture의 `resize-and-disclosure-anchor`: tool 펼침 전후 같은 헤더 key/좌표·dock/폭/글자 크기 변경 |
| EP-36f / 1: 행 renderer/토큰 | 잘못된 간격·sticky 겹침·배경 변경 | `Timeline.render.test.ts` 실제 행 종류·상태, CUA 두 테마/색상/헤더 대조 |
| EP-36g / 1: 세션 전환/cleanup | 다른 세션 위치·펼침·늦은 observer 오염 | 같은 fixture의 `session-switch-anchor`: A/B왕복의 행 key/좌표·펼침, 비활성 세션 갱신 후 위치 불변 |

7자리. SSR은 geometry/selection oracle이 아니며 실제 browser 경로를 별도 완료 조건으로 둔다. 순수 정책은 직접 상태값, browser는 scroll/selection/앵커 좌표를 관측하므로 구조적 proxy에 대한 별도 변이는 미선택이다.

# ΔV13 — todowrite 진행 카드와 전개·퇴장 (READY)

같은 기준 커밋의 AC26/27을 보완한다. 사용자 원문: “특히 todowrite의 경우, 컴포저 상단에 별도 카드가 슬라이딩 형태로 전개되고 모두 수행하면 아래로 슬라이딩 되며 사라진다. 이것도 직접 호출하여 수행하고 관찰하여 반영하라.” 이후 접힌 형태도 composer 바로 위에 노출하도록 명시했다. 실제 desktop 1.19.0에서 진행 카드 3/6, 접기 조작 후 한 줄 요약, 전체 완료 후 부재를 관측했다.

## 제품 계약 / AC

| 노드 | 동작 기준 / 검증 |
|---|---|
| R-34↔AT-34 / AC34 NEW | 현재 OpenCode root 턴의 성공한 TodoWrite가 composer 바로 위 읽기 전용 진행 카드를 연다. 펼침은 항목·진행상태·완료수를, 접힘은 완료수·대표 항목 한 줄·펼치기 버튼을 남긴다. 접기 자체로 카드를 없애지 않으며 같은 턴 갱신에도 접힘 선택을 유지한다. 전체 completed/cancelled 또는 실행 종료 후 아래로 퇴장하고 다음 턴·세션에 이전 카드가 다시 나타나지 않는다 |

completed는 완료수에 포함하고 cancelled는 종결·취소선으로 표시하되 완료수에 더하지 않는다. 미지 상태는 미완료다. OpenCode의 일반 todowrite transcript 행은 원본처럼 숨기되 이력 원문·입력·결과는 보존하고 Claude TodoWrite 표시를 변경하지 않는다.

| 사건 | 카드 결과 |
|---|---|
| 현재 root 턴의 성공 목록, live, 미완료 있음 | 위로 전개; live는 실행 또는 승인/질문 대기 |
| 접기 / 펼치기 | 같은 자리에서 한 줄 요약 ↔ 전체 목록. 도구 상태는 변경하지 않으며 갱신 중 접힘 선택 유지 |
| 모두 completed/cancelled | closing 시작→아래로 퇴장→제거 |
| closing 중 새 미완료 목록 | 기존 종료 타이머 취소·같은 세션 카드 재전개 |
| 빈 목록/실행 종료/세션 전환 | 종료·정리; 이전 턴/세션의 목록 재등장 금지 |
| 실패/거부된 TodoWrite, child TodoWrite | root 진행 목록을 갱신하지 않음 |
| 도구 승인 또는 Question 대기 중 | ΔV11의 단일 요청 카드가 입력 자리를 소유. Todo 상태·접힘 선택은 보존하지만 입력기나 Todo 카드와 중복 노출되지 않음. 대기열이 비고 여전히 live·미완료면 기존 접힘 상태로 복귀 |

## 원본·기술 설계

Todo의 정본 UI 근거는 공식1.19.0의 [state](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-composer-state.ts), [controller](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-composer-region-controller.ts), [dock](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-todo-dock.tsx)다. 제공2.0.29 아카이브에는 같은 TodoDock이 없으므로 그 아카이브에서 찾았다고 기록하지 않는다. [message-part.tsx](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/session-ui/src/components/message-part.tsx)의 HIDDEN_TOOLS와 실제 renderer가 todowrite를 제외한다.

| 현재 경로 | 변경 책임 |
|---|---|
| `opencode/v1/map.ts`→normalized tool_result metadata→reducer/parts→`opencode/v1/toolPresentation.ts` | 최신 성공 root TodoWrite의 metadata.todos를 우선 해석하고 성공 input만 호환 fallback. 1.x 필드 해석은 v1에 유지 |
| 현재 일반 ToolBody 목록 | `harnesses/opencode/composer/{TodoDock,todoState}`로 현재 턴·세션 범위의 표시 상태를 파생. 별도 서버·DB·IPC나 원본2.x API 도입 없음 |
| Composer/입력기 높이 | 전용 region에서 카드 실측 높이×진행률과 composer overlap36px를 조립. 기존 controller 초안/첨부 소유권은 유지 |

카드 기준은 min-height78px·header42px·radius12px·목록 max-height168px, 진행중 점·읽기 전용 체크·종결 취소선이다. 접힘에서는 목록을 숨기고 header의 완료수 옆에 대표 항목을 표시한다. 대표 항목은 첫 in_progress → 첫 pending → 마지막 completed → 첫 항목 순으로 선택하며 긴 제목은 한 줄 말줄임한다. 헤더 토글의 aria-expanded와 접근 가능한 접기/펼치기 이름을 상태에 맞춘다. 접힘 선택은 목록 내용과 별개인 세션별 UI 상태로 보존하여 갱신·요청 dock 가림·새 턴·A/B 세션 왕복에도 유지하고, 처음 보는 세션만 펼침을 기본으로 한다. 원본 `context/layout.tsx`의 `sessionView[session].todoCollapsed`와 `pages/session.tsx`의 주입 경로를 따른다. 원본 spring visualDuration0.3초/bounce0, close timer400ms와 progress0.001 종료 기준을 참고하며 기존 의존성 안에서 이식한다. 감속 모션에서는 상태 전환 결과를 즉시 표시한다.

원본은 완료와 idle 동시 도착 시 !live clear가 우선해 목록을 먼저 비울 수 있다. Orca 이식은 퇴장 중 마지막 표시 snapshot을 유지하고 완료 후 제거하여 빈 카드 깜빡임을 방지한다. 이 snapshot은 퇴장 전용이며 영속 데이터나 다음 턴의 초기 카드로 사용하지 않는다.

## V / §10

| Pair / provenance | requiredness | 경로 / 직접 oracle |
|---|---|---|
| VP-63 R-34↔AT-34 NEW | REQUIRED | 실제 TodoWrite→진행 카드→접기 요약→갱신 유지→펼치기→전체 완료→퇴장. 새 `TodoDock.render.test.ts`·CUA-OC-TODO |
| VP-64 AR-14↔IT-14 NEW | REQUIRED | v1 result→실제 reducer/parts→selector→Composer region. 새 `TodoDock.integration.test.ts`에서 normalized events부터 actual dock까지 실행 |
| VP-65 SD-10↔ST-10 NEW | REQUIRED | 부분 완료→전체 완료/idle→퇴장·재개·세션 전환. 위 integration 및 timer/browser fixture로 새 목록 오폐쇄·이전 목록 재등장 검사 |
| VP-66 MD-10↔UT-10 NEW | REQUIRED | 새 `todoState.test.ts`·v1 todo decoder 테스트: root/child·결과 우선·실패·상태4종·unknown·빈 목록·대표 항목 우선순위·세션별 접힘 유지/최초 기본값·400ms timer·감속 모션 |
| VP-43/44/45/47/56/57/61 INHERITED | REGRESSION | 일반 도구 저장·Claude TodoWrite·입력 초안·승인 대체·dock 높이 변화 중 transcript 읽기 위치 |

| 강제 자리 / 수 | 실패 의미 | 직접 oracle 좌표 (구현 예정) |
|---|---|---|
| EP-37a / 1: v1결과→목록 | 거부된 input/child/과거 턴이 root를 덮음 | v1 decoder + `TodoDock.integration.test.ts` 실제 결과·턴 교체 |
| EP-37b / 1: 목록→state | cancelled/unknown 오판·잘못된 카운트·대표 항목 오류 | `todoState.test.ts` pending/in_progress/completed/cancelled/unknown 및 요약 선택 |
| EP-37c / 1: state→Composer region | 도구 행에만 표시·승인/질문과 중복·접기 시 제거·Claude 누출 | `TodoDock.integration.test.ts` 실제 슬롯·요청 가림/복귀·접기 요약/펼치기·Claude 기존 표시 |
| EP-37d / 1: closing/timer→cleanup | 새 카드 지연 폐쇄·세션 간 누출 | `todoState.test.ts` fake timer, 세션/턴 token 및 재개 |
| EP-37e / 1: 진행률/높이→DOM | 위/아래 방향 반전·빈 snapshot·클릭 잔존 | `opencode-ui/main.tsx: todo-dock-lifecycle`에서 전개→접기→펼치기→완료의 높이·위치·제거, 감속 모션 결과 및 CUA-OC-TODO |
| EP-37f / 1: transcript 투영 | Todo 중복 표시 또는 저장 이력 삭제 | `TodoDock.integration.test.ts: keeps normalized TodoWrite history while hiding the OpenCode transcript row`의 parts 보존·OpenCode 행 부재·Claude 행 존재 |

6자리. 상태·카운트·실제 슬롯·시간·기하를 직접 관측하며 별도 변이는 미선택이다. 화면 캡처 간격으로0.3초를 실측했다고 주장하지 않는다.

## ΔV11~13 통합 게이트·READY 대조

증분 AC32~34로 총31→34이며 기존 구현 자기보고30/31은 과거 범위의 기록이다. 새 요구3건은 미구현이고 AC11 최종 사용자 시각 인수도 유지한다. AC가25건을 넘지만 모두 기존0262 composer/transcript의 같은 소비 경로를 보완하므로 델타3개로 작업 단위를 구분하고, 독립 우측 패널0263에는 규범을 복제하지 않는다.

구현 순서는 ΔV11→ΔV12→ΔV13이며 ΔV13 dock 높이 변화는 ΔV12 스크롤 회귀로 다시 검사한다. 추가 package·IPC·DB 변경 없음; 필요해지면 구현자가 PLAN_GAP으로 근거를 되먹인다. UI만참조2.x와 실행1.x 분리, Claude 불변, canvas·사용자 버블 색상 예외를 유지한다.

현재 설계 산출물 gate는 문서 generated/prose/링크·diff·Decision/AC/V/§10 교차 대조·INDEX/trailer다. 다음 구현 gate는 관련 Vitest, node/web/test typecheck, readonly ESLint, build, 문서·migration·test-budget, 원격 Windows CI와 위 실제 browser/Computer Use다. ABI를 바꾸는 npm pretest와 사용자 다운로드 파일 수정은 피한다. 다운로드 소스·일회성 미리보기는 커밋에서 제외하되 위 REQUIRED 재현 fixture는 재실행 가능한 테스트 산출물로 포함한다.

READY 대조: D-022↔AC28/32·EP35(19자리), D-023↔AC26/29/33·EP36(7자리), D-024↔AC34·EP37(6자리), 합계32자리다. 각 NEW/CHANGED 노드는 VP56~67과 기존 VP46/48/50에 연결했다. D-004/011/015~021과 색상·하네스·API 범위를 대조했고, AC29의 외형 비변경 조건만 후속 D-023으로 명시 대체했다. 우측 패널0263의 독립 완료 상태는 그대로 둔다.

설계 검사는 generated/prose·저장소 상대 링크·변경 문서의 상대 링크·`git diff --check`를 통과했다. 원본 link guard는 사용자 다운로드 `.tmp/opencode-dev` 안의 기존 링크5건만 실패했으며 사용자 소스는 수정하지 않았다. 독립 설계 대조에서 확인한 AC29 외형 범위 충돌, Todo 접힘의 세션별 보존, 재현 fixture 좌표를 위 계약에 정정했다. 이번 산출물은 문서뿐이므로 제품 테스트·빌드는 새로 실행하지 않았다.

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

이번 직접 오류 지점 4/4, 하네스 문구 지점 2/2. VP-05/06/18의 영향 구간은 실제 SDK transport·mapper·승인 wire 회귀로 SELF_PASS다. VP-10/11/15/17의 기존 배선 증거 부족·시각 인수 한계는 유지하며 전체 pair를 승격하지 않는다. 후속 CUA에서 VP-43/44의 읽기·편집 완료 카드와 diff를 직접 관측했으나 전체 도구 종류 및 AC11 최종 인수는 SELF_BLOCKED다. 기존 VP-40~45 자기보고는 이번 실앱 부분 관측으로 독립 판정이 되지 않는다.

## 이번 라운드 수정의 잠금

해당 없음 — 오류 ingress 3종·보조 응답·두 하네스 렌더 모두 실제 production 함수/컴포넌트의 직접 출력 oracle이다. 새 구조 스윕이나 mutation을 만들지 않았다. 선택 증거 0 · 인용 변이 0 · 새 구조 oracle 0 = 표 행 0. 기존 분류의 다른 공급자 인증·403·429·컨텍스트 오류는 `errors.test.ts`에서 원문/헤더/cause가 결과에 남지 않는 값 단언으로 확인했다.

## Product/UX 파생 검토

무료 모델 거절은 다른 공급자 설정이 필요하다는 안내로 표시하며 같은 요청을 자동 재전송하지 않는다. 일반 403·401·429도 별도 안내를 갖고 오류 body/헤더를 transcript에 저장하지 않는다. Claude 계획/승인 문구는 유지한다. 실행 카드의 권한 요청이 누구에게서 왔는지 알 수 있도록 OpenCode 승인 제목도 함께 수정했다.

실앱에서 외부 무료 모델 403 안내·OpenCode 계획 문구·로컬 공급자 스트리밍 완료·실행 중/중단된 읽기 카드·실제 Git diff 표시를 관측했다. 사용자 회신 후 HF 실제 정상 응답과 로컬 공급자의 읽기·편집 완료 카드, 편집 결과의 인라인/우측 diff를 추가 관측했다. 상세와 검증 경계는 [디자인 증거](design-evidence.md#r110-후속--사용자-승인-후-실모델완료-카드-관측)에 있다.

## 놓친 잠재 문제 + 대응

- 보조 `complete()`가 `info.error`를 무시해 빈 문자열을 성공 반환했다. 같은 오류 분류로 reject하고 finally 삭제는 유지했다.
- 도구 승인 카드에도 Claude 고정 제목이 남아 있어 하네스별 composer 문구 선택과 ko/en 리소스로 수정했다.
- 개발 리로드 중 대기 도구 카드가 중단 이력으로 보였다. 남은 검증 턴을 앱의 중단 버튼으로 정리하고 새 요청으로 재현했다. 개발 리로드의 승인 복원 자체는 이번 변경에서 고치거나 보장하지 않는다.
- 로컬 fixture의 성공은 외부 공급자의 사용 권한을 입증하지 않는다. 후속 사용자 승인 후 기존 HF 인증을 별도 OpenCode 엔진에 연결하고 실제 응답을 확인했다. 인증 값은 커밋·출력하지 않았다.
- Computer Use 지침은 권한 승인 조작을 금지한다. 사용자가 승인한 로컬 읽기·편집은 완료를 확인했다. HF의 추가 도구 검증은 사용자 생략 결정으로 종료했다. 정리 시 기존 요청은 이미 완료 이력이었으나 추가 시각 검증 통과로 승격하지 않는다.
- 디스크에 추가한 엔진이 목록 캐시 때문에 모델 새로고침에 나타나지 않았다. 기존 테스트 설정을 내용 변경 없이 저장한 뒤 목록 갱신을 확인했다. 이번 후속은 검증 증거 보완이며 외부 파일 변경 감지 정책을 바꾸지 않았다.

## 구현 보고

| 영향 AC | 결과 | 이번 관측 |
|---|---|---|
| AC5 | ✅ | SDK 오류 ingress·정상 텍스트/도구/세션 격리 회귀, 로컬 HTTP fixture를 거친 실앱 스트리밍 완료 |
| AC6 | ✅ | 기존 approval reply/reject/abort wire 회귀 유지. 승인 UI 동작 정책은 변경하지 않음 |
| AC10 | ✅ | 계획 문구 2하네스 실제 렌더와 OpenCode 패널 직접 조작 |
| AC11 | ⚠️ | 오류·계획·승인 문구, HF 실제 정상 응답, 로컬 공급자 읽기·편집 완료/인라인/우측 diff 관측. 최종 사용자 인수 대기 |
| AC24/25 | ✅ | 기존 전용 카드/본문 자동 회귀. 후속 실앱에서 읽기 결과·편집 성공 및 diff 확인. 다른 도구 종류까지 확대하지 않음 |

이번 영향 ✅5 · ⚠️1 · ❌0 = 6. 나머지 AC의 이전 자기보고를 재검증한 것으로 간주하지 않는다. 누적 자기보고의 AC11 대기는 유지하며 전체 독립 verify를 선점하지 않는다.

| 게이트 | 관측 |
|---|---|
| 최종 영향 회귀 | 17파일 122케이스 통과 — OpenCode adapter/mapper/server/SDK/settings·runtime·본문/card·composer·계획/승인·패널 policy |
| 타입 | `npm run typecheck`: node/web/test 모두 통과 |
| lint | 전체 오류 0, 기존 useTranscriptVirtualizer의 incompatible-library 경고 1 |
| build | main/preload/renderer 산출 완료. 기존 SubAgentTileContent 혼합 import 경고 1 |
| 운영 | 문서 inventory/prose/links, test budgets, diff whitespace 통과. DB/마이그레이션·의존성 변경 없음 |
| CUA | 실제 403 안내·하네스 문구·HF 실모델 정상 응답·로컬 공급자 읽기/편집 완료·인라인/커밋 diff 확인. 상세 범위는 디자인 증거 |
| 후속 증거 보완 | 제품 코드 변경 없음. 기존 수정/증거 커밋의 GitHub CI #743·744 success 확인. 문서 inventory/prose/links·diff whitespace 재확인 |

HF 추가 검증 생략 기록 시 inventory/prose와 whitespace는 통과했다. 전체 링크 검사는 커밋 외 `.tmp/opencode-dev` 참조 복제본의 깨진 링크 5건으로 실패했다. 변경 문서의 상대 링크와 임시 참조 폴더를 제외한 저장소 링크는 별도 검사에서 파손 0건이었다. 참조 복제본·검사기 코드는 수정하지 않았다.

## Review Signals

r1.10은 사용자 지시의 오류·문구 수정 턴이다. 기존 테스트는 일반 오류 terminal과 auth category를 보았으나 실제 공급자의 403 의미를 보존하는지 단언하지 않았다. 이번에는 SDK 오류 ingress 3종을 같은 직접 oracle로 잠갔다. 후속 사용자 회신 뒤 제품 코드 변경 없이 시각 증거를 보완했으며, 로컬 fixture·외부 HF·최종 사용자 인수 범위를 구분한다.

# [구현자 기입 — r1.11 데스크톱 UI 이식]

## 설계 리뷰

ΔV7 구현 완료. D-019에 따라 사용자 제공 2.0.29 데스크톱 소스의 UI만 이식했다. 기존 1.x runtime·정규화 DTO·응답 action을 사용한다. transcript canvas와 Claude 화면은 기존 계약을 유지하며 새 의존성·IPC·DB 변경은 없다. 원본 경로·색상·치수·관측 한계는 [디자인 증거](design-evidence.md#사용자-제공-데스크톱-소스-이식-2026-10-15-r111)에 기록했다.

## 강제 지점 전수와 V-pair 자기확인

검색: `rg -n 'OpenCodeQuestionDock|OpenCodePermissionDock|OpenCodeAskExchange|appearance="opencode"|composer-controls' app/src/renderer/src/features/chat`, `rg -n 'oc-|--color-bg:' app/src/renderer/src/styles/tokens.css`. ΔV7 §10의 6자리와 아래 6행을 대조했다. 기존 V1 전체 증거가 새로 닫힌 것으로 해석하지 않는다.

| 지점 / pair | 직접 관측 | 자기확인 |
|---|---|---|
| EP-27a / VP-46·43·44 | ToolCard interaction의 실행→완료 펼침 유지·명령/결과 복사, AssistantSegment의 종류·실패/중단/거부·diff 렌더 통과. CUA preview에서 셸/파일 diff 확인 | SELF_PASS |
| EP-27b / VP-46·45 | 실제 assistant/live/user/Q&A 렌더 및 TranscriptView의 공통 bg 회귀 통과. light/dark preview와 기존 dark canvas RGB 확인 | SELF_PASS |
| EP-28a / VP-47 | ComposerInputController 입력/초안/IME 회귀, 두 하네스 실제 composer surface, agent/variant 선택·기본값·키보드 callback 통과. 360px preview 치수 확인 | SELF_PASS |
| EP-29a / VP-48 | Composer.activity의 Claude/OpenCode 질문 dispatcher 렌더 통과 | SELF_PASS |
| EP-29b / VP-48·49 | QuestionDock의 단일/다중/기타·왕복·접기·새 request·IME·숫자/화살표·Ctrl+Enter·Esc·중복 제출 방지 통과 | SELF_PASS |
| EP-29c / VP-48 | 실제 ToolApprovalBody에서 허용/세션 허용/거부의 approvalId와 도구명 callback 전달 3행 통과 | SELF_PASS |

이번 범위는 EP-27 2/2 · EP-28 1/1 · EP-29 3/3 = 6/6. 기존 VP-11/18은 Claude 표시와 OpenCode adapter/mapper/runtime의 영향 회귀만 수행했고 V1의 기존 SELF_BLOCKED 및 AC11 인수 대기는 유지한다. 실제 모델 호출은 이번 턴에 수행하지 않았다.

## 이번 라운드 수정의 잠금

직접 행동·출력 oracle과 시각 관측을 사용했다. 기존 assertion의 select DOM은 실제 OpenCode menu trigger로 변경하고 별도 interaction에서 선택 payload·초점 복귀를 확인했다. 사용자 버블 assertion은 원본 local-session blue 표면으로 변경했다.

| 수정한 기존 구조 oracle | 적대 입력 | 관측 |
|---|---|---|
| composerAttachMenu의 '+' trigger 원문 검사 | 읽은 production source에서 메뉴 열기 onClick만 no-op으로 교체 | 동일 assertion 1실패, exit 1. 정상 원본은 통과 |

선택 적대 증거 0 · 인용 변이 0 · 수정 구조 oracle 1 = 표 행 1. 변이 테스트 복제본을 실행 후 제거했고 production 파일은 변이하지 않았다.

## Product/UX 파생 검토

질문은 선택 후 자동으로 넘어가지 않고 명시적 다음/제출을 사용한다. 선택·직접 입력은 이전/다음/접기 중 유지되고 새 request에서 초기화한다. IME 조합·키 반복은 제출하지 않는다. 에이전트/변형 메뉴는 현재 선택에 초점을 두고 화살표·Home/End·Esc·Tab을 지원한다. 원본 desktop 스타일은 OpenCode 경로와 선택적 DiffTable appearance로 한정했다.

컴포저 핵심 치수를 px로 명시하여 Orca의 root rem에 영향을 받지 않도록 했다. 좁은 폭에서는 제어 영역만 가로 스크롤하고 전송 버튼 공간을 확보한다. 공통 입력 controller는 유지하여 하네스 전환 중 초안과 IME 수명을 보존한다. 승인 범위·거부 동작은 기존 action 그대로다.

## 놓친 잠재 문제 + 대응

- 원본 2.x UI 소스를 실행 API로 혼동할 위험은 원본 버전·경로를 기록하고 v1 DTO를 그대로 사용하는 것으로 제한했다.
- 원본 아카이브에서 Git 명령은 부모 Orca SHA를 반환한다. upstream revision으로 인용하지 않고 세 원본 파일의 hash를 기록했다.
- rem 기반 치수가 실제 14.5px root에서 줄어드는 것을 preview에서 발견했다. toolbar 44px·버튼 28px·radius 12px를 재측정했다.
- 사용자 다운로드의 깨진 상대 링크 5건 때문에 전체 doc scanner는 실패한다. 사용자 파일이나 검사기를 바꾸지 않고 `.tmp`를 제외한 저장소 검사에서 broken 0을 확인했다.
- CI #746의 전체 회귀에서 공통 typeScale guard와 첨부 trigger source assertion 2실패가 드러났다. 모호한 `text-[inherit]`를 제거하고 diff에는 명시적 배율 calc를 적용했다. source assertion은 새 openCode prop을 반영하되 기존 onClick·anchor·닫기 검사를 유지하고 핸들러 제거 변이로 검출력을 확인했다. 최초 관련 회귀 집합에 두 공통 검사가 빠져 있었다.
- 네이티브 Computer Use의 창 연결 실패로 실앱 시각 재검증은 미완료다. production 컴포넌트 preview의 결과와 기존 r1.10 실제 모델 관측을 구분했다.

## 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC26 | ✅ | 실제 도구·Q&A·상태/복사 회귀, 두 테마 preview, 공통 bg 유지 |
| AC27 | ✅ | 입력/IME 회귀, 360px에서 toolbar 44px·전송 28px·radius 12px 확인, 메뉴 선택 callback |
| AC28 | ✅ | 실제 질문 선택/답 payload와 승인 dispatcher 세 action, CUA에서 다중/직접 입력 제출 |
| AC11 | ⚠️ | 기존 최종 사용자 인수 대기. 이번 실앱 연결 실패 유지; 최종 메뉴는 실제 컴포넌트 preview로 두 테마 확인 |

증분 ✅3 · ⚠️0 · ❌0 = 3. 이전 ✅24 · ⚠️1에 더한 누적은 ✅27 · ⚠️1 · ❌0 = AC 28. 이전 AC를 이번 턴에 전부 재검증한 것으로 주장하지 않는다.

| 게이트 | 관측 |
|---|---|
| 관련 Vitest | 최종 21파일 144케이스 통과: OpenCode adapter/mapper/runtime·도구/본문·질문/승인·composer/controller/store·Claude diff·i18n |
| 타입 | 최종 `npm run typecheck`의 node/web/test 모두 통과 |
| readonly ESLint | 전체 오류 0, 기존 useTranscriptVirtualizer 경고 1 |
| build | main/preload/renderer 생성 완료. 기존 SubAgentTileContent 혼합 import 경고 유지 |
| 운영 | test budgets 16 real-git suites·diff whitespace·문서 inventory/prose 통과. 원본 `.tmp` 링크 5건 실패는 기존 상태이며 제외한 저장소 링크 broken 0 |
| CI 복구 | CI #746의 위 2실패 수정 후 관련 6파일/57케이스·변경 파일 lint·재빌드 통과. 생성 CSS의 diff pre에서 `font-size: calc(13px * var(--transcript-text-scale, 1))` 확인 |
| 원격 CI | [CI #747](https://github.com/muzaby/orca-skin/actions/runs/38657371187) gate success. Windows Node 22에서 690파일/6887케이스 통과·기존 1파일/1케이스 skip. scripts 138/138, 가드·lint·node/web/test 모두 통과 |

## Review Signals

이번 라운드는 사용자 추가 요구의 ΔV7 구현이다. 원본 소스에서 실제 desktop 경로를 확인한 뒤 표현을 이식하고 interaction과 CUA preview로 보완했다. 이전 UI의 구조만 비슷하게 구현한 한계와 rem 차이를 수정했다. 실앱 시각 인수와 독립 verify의 미완료 범위는 그대로 남긴다.

최종 제품 코드의 CI #747 성공 후에는 구현 상태·검증 기록만 갱신했다. 보드의 `impl/IMPL_DONE`·다음 Claude와 메타 상태를 다시 읽었으며 독립 verify와 AC11 사용자 인수는 완료로 승격하지 않는다.

## [구현자 기입] ΔV8 — r1.12

### 설계 리뷰

D-020/AC29대로 사용자 버블의 배경·글자색만 공통 `bg-bubble-user text-ink`로 바꿨다. 반경·패딩·글자 크기·transcript canvas는 기존 하네스별 값을 유지한다. 0263 ΔV3 패널 구현과 동시 검증했으며 새 제품 결정은 없다.

### 강제 지점 전수와 V-pair 자기확인

| Pair / 자리 | 자기 결과 / 직접 관측 |
|---|---|
| VP-50 / EP-30a·b | SELF_PASS — AssistantSegment.render의 실제 사용자 버블 클래스가 공통 색상이며 하네스별 반경·크기는 유지 |
| VP-50 / EP-30c~g | SELF_PASS — TranscriptView.harness의 실제 virtualizer·Exchange·UserTurn·UserMessage·UserBubbleText를 거친 이전/마지막 발화 양 하네스 단언 |
| VP-17·44·46·11·25 영향 경로 | SELF_PASS — 관련 transcript 8파일/45케이스, 사용자 복사·fork 제한·canvas 회귀. Computer Use의 이전/마지막 발화 2테마 색상 비교 |

EP-30의 7자리를 위 두 자동 경로와 실제 DOM 색상으로 확인했다. light는 두 하네스 모두 배경 `rgb(244,244,243)`·글자 `rgb(26,26,24)`, dark는 `rgb(48,48,46)`·`rgb(240,239,234)`다. 이번 검증을 기존 V 전체의 재검증으로 확대하지 않는다.

### 이번 라운드 수정의 잠금

해당 없음 — 렌더된 값과 사용자 조작을 직접 관측했다. 선택 증거 0 · 인용 변이 0 · 새 구조 proxy/전수 배선 oracle 0 = 잠금 표 행 0.

### Product/UX 파생 검토

색상이 같아지면 하네스 전달 누락이 색상 테스트만으로 가려질 수 있다. 테스트에서 OpenCode 고유 반경·패딩·글자 크기도 함께 확인했다. 버블 전체를 Claude 외형으로 바꾸지 않았다.

### 놓친 잠재 문제 + 대응

SSR에서 이전 교환을 생략하는 문제는 실제 virtualizer에 viewport만 제공해 이전/마지막 경로를 모두 실행했다. 실제 Chromium의 두 테마 computed 색상은 `.tmp/0263-v3-visual-evidence.md`에 구분 기록했다. 명시 설계 차이 없음; 캐시·만료·공유 상태·재진입·무효화 추가 없음.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC29 | ✅ | 양 하네스·이전/마지막 교환 자동 렌더 및 Computer Use 두 테마 computed 색상 일치 |

증분 ✅1 · ⚠️0 · ❌0 = 1. 이전 자기보고에 합산한 누적은 ✅28 · ⚠️1 · ❌0 = AC29개이며 AC11 사용자 최종 시각 인수는 그대로 대기한다.

관련 8파일/45케이스, 수정 파일 ESLint·Prettier, node/web/test 타입 검사 통과. 통합 main/preload/renderer 빌드도 완료했다. 통합 패널·문서·환경 gate의 상세는 [0263 구현 보고](../0263-opencode-session-panel/plan.md)에 기록한다.

최종 제품 코드 `14d5fea0`의 [CI #752](https://github.com/muzaby/orca-skin/actions/runs/38691356449)에서 Windows Vitest 697파일/6941케이스 및 scripts138케이스가 통과했다(1파일/1케이스 skip). 문서·migration·test-budget·lint·typecheck gate도 성공했다. 사용자 시각 인수와 독립 verify 상태는 유지한다.

### Review Signals

사용자 요구 변경에 따른 r1.12이며 독립 검증 결과를 선점하지 않는다. 새 실모델 도구 호출 없이 실제 컴포넌트 preview로 색상을 검증했다. 다음 주체는 Claude 독립 검증자다.

## [구현자 기입] ΔV9 — r1.13

### 설계 리뷰

D-021/AC30·31 구현 완료. 도입 전 main과 변경 경로를 대조해 Claude 메뉴·엔진 표시·조회 수명을 복원했다. 이동된 Claude 본문·composer·패널·설정은 import/이름 변경을 구분해 비교했다. 명시된 OpenCode 카드·설정·새 엔진의 하네스 선택과 전용 UI는 유지한다. 신규 의존성·IPC·DB 변경과 설계 차이는 없다.

### 강제 지점 전수와 V-pair 자기확인

| 자리 / pair | 직접 관측 | 자기확인 |
|---|---|---|
| EP-31a/b / VP-51·52 | 실제 ChatTitleBar 렌더: Claude Code 계획→백그라운드 작업→변경사항, Work 작업. 체크·배지·개별 클릭 callback과 renderer 대응 통과. CUA에서 메뉴와 계획/작업 열기 확인 | SELF_PASS |
| EP-32a/b/c / VP-51·52 | 실제 페이지 헤더의 우측 추가 버튼 1개, Claude/OpenCode 카드 라벨, Claude chip/provider·OpenCode 편집 잠금 단언. CUA에서 새로고침 부재·실제 편집 진입 확인 | SELF_PASS |
| EP-32d/e/f / VP-53 | 실제 hook+agentStore의 최초 조회/캐시 재진입, 외부 조회 중 busy=false, add/update/remove 저장→갱신 대기 및 오류 보존 6케이스 통과. CUA loading=true 중 편집·유효 입력 저장 활성 확인 | SELF_PASS |
| EP-33a / VP-51·52 | 실제 TranscriptView와 ChatTile의 Claude Code/Work viewport·공통 상위 canvas, OpenCode 전용 bg-bg 및 이전/마지막 발화 렌더 통과 | SELF_PASS |

ΔV9의 EP-31 2자리 + EP-32 6자리 + EP-33 1자리 = 9자리. 표의 실제 production 경로와 설계의 9자리를 대조했다. 기존 VP-11/17/20/21/25/44/46/50 영향 회귀는 83파일/643케이스에서 확인했으며 V1의 남은 자동 배선 증거와 AC11 사용자 인수 전체를 새로 닫은 것으로 해석하지 않는다.

### 이번 라운드 수정의 잠금

해당 없음 — 실제 메뉴/페이지/폼 출력, 각 클릭 callback, hook/store 결과를 직접 관측했다. 기존 registry만 보던 메뉴 테스트를 실제 ChatTitleBar 렌더로 교체했다. 새 구조 proxy나 소스 0건 oracle을 추가하지 않았다. 선택 적대 증거 0 · 인용 변이 0 · 새 구조 oracle 0 = 잠금 표 행 0.

### Product/UX 파생 검토

Claude 편집에는 고정 chip을 복원하되 새 엔진 생성에는 하네스 선택을 유지한다. catalog loading과 mutation busy를 분리해 다른 하네스 조회가 기존 조작을 잠그지 않게 했다. 실제 저장 중에는 갱신 완료까지 busy를 유지한다. 새로고침 버튼을 다른 위치에 옮기지 않았다. OpenCode 요약→상세→닫기 복귀와 기존 도구 diff는 CUA 회귀에서 유지됐다.

### 놓친 잠재 문제 + 대응

- 기존 타이틀 테스트는 실제 그룹 조립 대신 별도 registry만 보아 Claude 메뉴 변경을 놓쳤다. 실제 메뉴 항목·순서·클릭을 검사하도록 바꿨다.
- 카탈로그의 전체 loading을 합친 변경은 Claude 버튼까지 비활성화했다. 원래 캐시 진입과 mutation busy를 복원하고 저장 후 강제 갱신은 유지했다.
- hook 테스트의 Zustand overload 타입 추론이 최초 전체 typecheck에서 실패했다. StateCreator/StoreApi generic으로 수정 후 hook 6케이스·전체 node/web/test를 재통과했다.
- CUA fixture의 permission.setMode 반환 누락으로 Work 전환 시 오류가 표시됐다. native stub을 실제 반환 계약으로 고친 후 정상 수동 승인·평면 메뉴를 다시 관측했다. 제품 결함으로 기록하지 않는다.
- 실제 Electron 창과 새 실모델 호출은 이번 시각 검증에 포함하지 않았다. 실제 컴포넌트·CSS·store를 사용한 메모리 native preview이며 사용자 최종 인수는 유지한다.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC30 | ✅ | Code/Work 실제 메뉴·토글/배지·viewport 렌더 회귀, CUA 평면 메뉴와 원래 계획/작업 패널 및 두 테마 표시 |
| AC31 | ✅ | 실제 엔진 페이지·카드·폼/hook 테스트, CUA 새로고침 제거·chip·조회 중 편집/저장 활성·OpenCode 선택/잠금 유지 |
| AC11 | ⚠️ | 사용자 최종 시각 인수와 독립 verify 대기 유지 |

신규 ✅2 · ⚠️0 · ❌0 = 2. 이전 자기보고 ✅28 · ⚠️1을 합산한 누적 ✅30 · ⚠️1 · ❌0 = AC31개다. AC 분모는29→31이며 이전 AC 전부를 이번 턴에 재검증한 것으로 주장하지 않는다.

| 게이트 | 관측 |
|---|---|
| 관련 Vitest | 83파일/643케이스 통과: 메뉴·composer/transcript·Claude/OpenCode 패널·엔진·하네스 설정·새 대화 |
| 타입 | 최종 npm run typecheck의 node/web/test 모두 통과 |
| readonly ESLint | 전체 오류0·기존 useTranscriptVirtualizer incompatible-library 경고1 |
| build | main/preload/renderer 생성 완료. 기존 SubAgentTileContent 혼합 import 경고 유지 |
| 운영 | migration sync/append-only·test budgets·Prettier·diff whitespace 통과. 문서 generated/prose 통과. 원본 링크 guard는 다운로드 `.tmp/opencode-dev` 내부 5건 실패, `.tmp`·첨부를 제외한 저장소 링크는 빈 배열 |
| CUA | [디자인 증거](design-evidence.md#claude-gui-복원-2026-10-15-r113). 메모리 native 실제 컴포넌트 preview, 새 실모델 호출 없음 |
| 원격 CI | 최종 제품 코드의 [Windows CI #756](https://github.com/muzaby/orca-skin/actions/runs/38709822117) success. Vitest702파일/6986케이스 및 scripts138/138 통과, 기존1파일/1케이스 skip. 문서·migration·test-budget·lint·typecheck 모두 성공 |

### Review Signals

r1.13은 사용자 복원 지시에 따른 ΔV9다. D-004의 기존 Claude 보존 의도가 있었지만 실제 메뉴를 관측하지 않는 테스트가 그룹 제목 추가를 검출하지 못했다. 이번 보고는 확인한 경로의 복원과 사용자 최종 인수를 구분한다. 다음 주체는 Claude 독립 검증자다.

CI 성공 후 후속 커밋은 결과 기록만 포함한다. plan 메타와 INDEX의 impl/IMPL_DONE·다음 Claude, 누적30/31 및 파싱된 구현 trailer를 다시 확인했다. 독립 verify와 AC11 사용자 인수는 유지한다.

## [구현자 기입] ΔV10 — r1.14

### 설계 리뷰

native ID 형식 위반을 수정했다. `message-id.ts`의 시간/counter/난수 생성값을 기존 promptAsync→activity→mapper에 그대로 전달한다. finish를 조기 종료로 바꾸거나 서버 호출을 숨기는 우회는 하지 않았다. 실제1.19.0에서는 기존 UUID 코드도 정상 종료했으므로 사용자 환경의 반복 결함이 재현됐다고 주장하지 않는다.

### 강제 지점 전수와 V-pair 자기확인

검색 `rg -n 'messageID:|promptId =|promptAsync\(|session.prompt\(' .../opencode/v1/adapter.ts`에서 사용자 지정 messageID는 streaming 입력1곳이며 보조 complete는 서버 생성 ID를 사용함을 확인했다.

| 자리 / pair | 직접 oracle / 관측 | 자기 결과 |
|---|---|---|
| EP-34a / VP-54 | message-id.test의 native lower-six-byte 고정벡터3종·동일ms 증가·다음ms reset·형식/길이 6케이스 | SELF_PASS |
| EP-34b / VP-55 | adapter.test `sends native ascending IDs and completes successive turns under the legacy stop ordering contract`: 실제 SDK body·native 벡터 비교·본문 시도 각1회·연속2턴 종료 | SELF_PASS |
| EP-34c / VP-55 | 같은 테스트에서 이전 parent의 assistant/idle 무시와 현재 parent 응답 각각1개. 기존 mapper stale/compaction 및 activity 격리 회귀 유지 | SELF_PASS |

ΔV10 EP-34a/b/c =3자리. 관련 adapter/map/activity/server·history/send 11파일77케이스와 SessionRuntime1파일81케이스, 합계12파일158케이스 통과. VP-05/15/18은 변경 영향 구간만 확인했으며 과거 V 전체의 남은 증거를 닫은 것으로 해석하지 않는다.

### 이번 라운드 수정의 잠금

| 선택 증거 | 변이 자리 | 관측과 복원 |
|---|---|---|
| M-ID / VP-55 | adapter promptId 생성 및 import를 원래 randomUUID 식으로 복원 | 실제 SDK transport 테스트가 본문 시도2≠1로 실패. 파일 바이트 원복 확인 후 같은 테스트1케이스 통과 |

선택 증거1 · 인용 변이0 · 새 구조 oracle0 = 표 행1. 이 검사는 과거1.x 종료 조건을 모형한 HTTP/SSE 계약 검사다. 실제CLI 내부 전체를 실행한 결과는 아래 별도 구분한다.

### Product/UX 파생 검토

동일 ID로 현재 턴을 식별하고 기존 stale·compaction 응답 격리를 유지한다. 취소·오류·도구·idle 수명과 UI는 변경하지 않는다. 임의 ID를 생성하는 신규 의존성 없이 OpenCode1.x 디렉터리에서 native 규칙을 사용한다. 원본 MIT 고지에 native ID 출처를 추가했다.

### 놓친 잠재 문제 + 대응

- 기존 fixture는 어떤 ID든 idle을 합성하여 native 정렬 계약을 검증하지 못했다. 새 fixture는 순서 조건이 false면 두 번째 본문 시도를 세고 스트림을 닫아 실패를 제한한다.
- 실제1.19.0은 parentID equality로 종료하므로 기존 UUID에서도 새1턴+재개2턴이 정상이다. 사용자에게 관측한 버전/실행 경로를 확인 요청했고 결과를 [실행 증거](runtime-compatibility.md#native-메시지-id-검증-2026-10-15-r114)에 구분했다.
- 잘못된 UUID가 남은1.19.0 세션도 수정 코드로2턴 재개되고 기존 기록을 보존했다. 과거 ID 자동 재작성이나 사용자 프로세스 종료는 하지 않았다.
- timestamp/counter는 공식 생성기와 같은 프로세스 내 규칙이다. 서로 다른 프로세스의 동일ms/시계 역행까지 보장하는 추가 알고리즘은 도입하지 않았다. 설계 대비 대체 메커니즘 없음.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC5 영향 구간 | ✅ | native ID wire·legacy 종료조건·stale parent 회귀. 실제1.19.0 수정 후 새2턴+기존UUID이력 재개2턴 각각 본문1회/완료1회 |
| AC11 | ⚠️ | 사용자 최종 시각 인수 및 독립 verify 대기 유지. 이번 UI 변경 없음 |

AC 추가 없음. 이전 누적 자기보고 ✅30 · ⚠️1 · ❌0 =31을 유지하며 이번 턴의 관측 범위는 ID와 종료 영향 경로다. 사용자 환경에서 보고된 무한 요청의 실재현은 아직 확인되지 않았다.

| 게이트 | 관측 |
|---|---|
| 자동 회귀 | 관련12파일158케이스 통과. M-ID red와 바이트 복원 후 동일 test green |
| 타입/build | node/web/test 모두 통과. main/preload/renderer build 완료, 기존 SubAgentTileContent 혼합 import 경고 유지 |
| readonly ESLint | 전체 오류0·기존 useTranscriptVirtualizer incompatible-library 경고1. 최종 수정 TypeScript4파일 별도 검사도 통과 |
| 형식/운영 | Prettier·migration sync/append-only·test budgets·diff whitespace 통과. 문서 generated/prose 통과. 다운로드 내부 링크5건은 기존 실패이며 임시/첨부 제외 저장소 링크 빈 배열 |
| 실제CLI |1.19.0+loopback provider, body/aux 모델 분리·본문2회 상한. 기존 코드도 정상, 수정 후 새/재개 각각2턴 정상. 생성한 테스트 프로세스 전부 종료 |
| 원격 CI | 제품 커밋 `44f1df33`의 [Windows CI #758](https://github.com/muzaby/orca-skin/actions/runs/38717654242) success. Vitest703파일/6993케이스 및 scripts138/138 통과, 기존1파일/1케이스 skip. 문서·migration·test-budget·lint·typecheck 모두 성공 |

### Review Signals

r1.14는 사용자 결함 보고에 따른 계약 보완이다. 기존 실제SDK transport 테스트도 무조건 idle을 내는 fixture 탓에 native ID 의미를 보지 못했다. 로컬CLI 버전에서 재현하지 못한 범위는 명시하고 종료 조건 호환성 수정과 구분했다. 독립 verify는 별도다.

CI 성공 후 후속 커밋은 결과 기록만 포함한다. plan/INDEX의 impl·IMPL_DONE·다음 Claude와 누적30/31은 유지한다. 구현 trailer 파싱을 확인했으며 AC11 사용자 최종 시각 인수와 독립 verify를 선점하지 않는다.

## [구현자 기입] ΔV11~13 — r1.15


### 설계 리뷰

D-022의 종류 무관 도착 순서를 세션별 요청 참조로 기록하고, OpenCode 입력 자리에는 유효한 선두 하나만 mount한다. 질문·승인 payload와 기존 해소 action은 유지한다. 입력 controller는 숨겨도 mount를 유지하여 초안·첨부가 마지막 요청 뒤 복원된다. Claude의 질문·전체 승인·입력 배치는 그대로 둔다.

D-023의 transcript는 OpenCode 전용 투영·행·스크롤 제어기로 분리했다. 실제 브라우저에서 긴 이력의 선택·가상화, 과거 읽기 중 출력, 최신 복귀, 도구 펼침, 폭·폰트 변경과 세션 왕복의 앵커를 확인했다. D-024의 Todo는 성공한 현재 root 턴 결과에서 파생하며 접힘 선택은 세션별로 보존한다. 새 턴 경계를 reducer가 기록하여 이전 Todo를 초기 카드로 재사용하지 않는다. 신규 패키지·IPC·DB 변경은 없다.

### 강제 지점 전수와 V-pair 자기확인

요청 수명의 검색 주어는 `pendingAsks|pendingToolApprovals|permission.requested|permission.resolved|RESOLVE_ASK|RESOLVE_TOOL_APPROVAL|childApprovalState`다. renderer 제품 검색에서 수신·해소는 `chatReducer.ts`, 사용자 해소는 `chatStore.ts`, 표시 소비는 `Composer.tsx` 및 OpenCode `requestQueue.ts`·`RequestDock.tsx`로 이어진다. NEW_CHAT·START_LOAD_SESSION·LOAD_SESSION의 초기화와 error·turn.aborted·CANCEL_CHAT의 child 보존을 각각 검사했다.

아래 경로는 `app/src/renderer/src/features/chat/` 기준이다. `composer/Todo*`·`composer/todoState*`는 `harnesses/opencode/composer/`, `transcript/Timeline*`·`transcript/projection*`·`transcript/scrollPolicy*`·`transcript/ScrollController*`는 `harnesses/opencode/transcript/`의 축약이다. Composer 통합은 실제 reducer·store·selector·dock·action을 실행하며 React/DOM 런타임과 native IPC만 대역이다. Timeline SSR은 초기 측정값만 공급하고 실제 dispatcher·virtualizer·행을 실행한다. 선택 수명 단위는 Text 표시 대역으로 streaming/complete 전달을 검사하며 실제 문자열 선택은 CUA가 관측한다.

| 자리 / 수 | 직접 oracle / 관측 |
|---|---|
| EP35a / 2 | `reducer/chatReducer.request-order.test.ts: records mixed requests in event arrival order, starting with %s` — Q/P/Q와 P/Q/P, 문자열 역순 ID에도 수신 순서 보존 |
| EP35b / 1 | `harnesses/opencode/composer/requestQueue.test.ts: selects the earliest live request without sorting identifiers` — stale 참조 건너뛰기·선두 payload·빈 큐 |
| EP35c / 1 | `components/Composer.approvalQueue.test.ts: renders only the earliest mixed request in the replacement slot: question first=%s` — dock 및 request ID 각각 하나, 편집기·뒤 요청 내용 부재. CUA-OC-REQ에서도 Q→P→Q/P→Q→Q 전체 소비 동안 현재 카드만 DOM에 존재 |
| EP35d / 1 | 같은 파일 `keeps the draft and attachments until the mixed queue is empty` — 실제 입력 및 drop 첨부, 중간 숨김, 마지막 해소 후 값·파일 복원 |
| EP35e / 2 | 같은 파일 `consumes question and permission requests in arrival order` — 실제 질문 선택·제출·건너뛰기와 answerAsk/skipAsk의 allow(updatedInput)/deny, 다음 카드 |
| EP35f / 3 | 같은 테스트 — 실제 허용·세션 허용·거부 버튼과 approvalId·toolName/scope·interrupt payload, 다음 카드 |
| EP35g / 2 | `reducer/chatReducer.request-order.test.ts: removes only the locally resolved request from mixed order: %j` — 두 로컬 action의 대상만 제거, 나머지 payload·상대 순서·멱등성 |
| EP35h / 1 | `components/Composer.approvalQueue.test.ts: applies external resolution only to its session and request` — 외부 선두/비선두 취소, A/B 격리·왕복, 마지막 입력 복원 |
| EP35i / 3 | `reducer/chatReducer.request-order.test.ts: clears request order on new chat and session loading: $type` — NEW_CHAT·START_LOAD_SESSION·LOAD_SESSION 각각 payload와 순서 초기화 |
| EP35j / 3 | 같은 파일 `preserves surviving child requests in arrival order: %j` — error·turn.aborted·CANCEL_CHAT 각각 살아 있는 child의 상대 순서 유지 |
| EP36a / 1 | `components/ChatTile.harness.test.ts: preserves the shared canvas and fades with the original $backend/$agentKind viewport` — 실제 ChatTile 분기와 Claude useScrollAnchor 호출1/OpenCode0. `Timeline.render.test.ts:51`의 실제 dispatcher/행, `ChatTile.composerLifetime.test.ts:74`의 하네스·draft→실세션 Composer mount1/unmount0 |
| EP36b / 1 | `transcript/projection.test.ts`의 all nine segment kinds·streaming completion/history prepend·same-timestamp exchanges — 9종 내용/순서, live→commit 및 prepend key. 실제 행은 `Timeline.render.test.ts: routes all nine segment kinds in order and renders native tool groups/file headers without Claude reserved tail` |
| EP36c / 1 | CUA-OC-SCROLL `long-history-selection`: 60 exchange, scrollHeight25515px 중8행 mount. 선택 문자열을 보존한 채3페이지 상하 왕복. `Timeline.selection.test.ts:24`는 선택 중 live→완료에서 streaming mode를 유지하고 선택 해제 후 complete mode로 전환함을 검사 |
| EP36d / 1 | `transcript/scrollPolicy.test.ts:10,17,21,28`의 nested 경계·0.5px·unpin/repin·jump 임계, `ScrollController.interaction.test.ts:35`의 외부 pointerup 뒤 pin/추종. CUA에서 unpinned offset−26.2125px/top1662.4px 유지, 최신 height/top은 각각32px 증가 |
| EP36e / 1 | CUA `resize-and-disclosure-anchor`: 실제 좌표 클릭으로 탐색 펼침/접기 시 top120px·user1 text offset−4.8125px 유지. 폭450px/font14.5px 전환 후 height2208→2245px·top120→123.199997px로 보정하면서 같은 offset 유지 |
| EP36f / 1 | `Timeline.render.test.ts`의 9종 실제 행과 `projection.test.ts`의8/16/24px 경계; CUA 두 테마에서 OpenCode/Claude 사용자 버블 background/color 완전 동등. [두 테마 computed 색상](design-evidence.md#orca-요청스크롤todo-구현-관측-2026-10-15-r115) |
| EP36g / 1 | `viewState.ts` 세션 cache·`ToolCard.interaction.test.ts` 펼침 복원과 `ScrollController.interaction.test.ts` cleanup 직접 검사. CUA A/B 왕복 앵커 offset 차0.025px, 비활성 세션 출력 시 활성 viewport 기하 변화0 |
| EP37a / 1 | `harnesses/opencode/v1/toolPresentation.test.ts: only accepts successful root todo results, preferring metadata including an empty clear`; `composer/TodoDock.integration.test.ts`의 successful root results·BEGIN_TURN boundaries·successful completion order — 결과 우선, 실패/child/과거 턴 제외, 빈 목록과 완료 순서 |
| EP37b / 1 | `composer/todoState.test.ts: counts completed only and treats unknown as unfinished`, `chooses in progress, pending, last completed, then first item for the summary` — 상태·완료수·대표 항목 |
| EP37c / 1 | `components/Composer.approvalQueue.test.ts: overlaps the live Todo dock with the input and restores its collapse after mixed requests` — normalized TodoWrite→실제 Composer, overlap -36px, 접힘 저장, 질문/승인 중 input·Todo 숨김, 마지막 소비 뒤 요약 복귀 |
| EP37d / 1 | `composer/TodoDock.render.test.ts: cancels old close timers on unfinished updates and hides/restores around requests`, `does not reuse an expired closure after switching sessions and returning`; state의 session/turn changes 검사 — 재개·세션 교체 후 옛 종료 타이머 무효화 |
| EP37e / 1 | `composer/TodoDock.render.test.ts`의 measured height/overlap·400ms/300ms·idle snapshot·reduced-motion은 가짜 시계/DOM의 직접 값 검사. CUA-OC-TODO에서175.6px 카드/overlap−36px, 접힘1/3 요약, 완료3/3 뒤 제거. 캡처 간격으로0.3초를 실측했다고 주장하지 않음 |
| EP37f / 1 | `harnesses/opencode/transcript/projection.test.ts: hides only OpenCode Todo rows without mutating raw parts or Claude projection` — 원본 parts 보존·OpenCode 행 제외·Claude 투영 유지. 계획의 TodoDock.integration 좌표에서 실제 소유자인 projection 검사로 옮김 |

EP35 19/19 + EP36 7/7 + EP37 6/6 =32/32자리 직접 관측이다. 미관측 자리 집합은 비어 있으며 EP36의 geometry/selection과 EP37e의 실제 DOM 기하는 브라우저 관측으로 닫았다. 이 수는 전체 운영 게이트나 AC11 사용자 최종 인수를 뜻하지 않는다.

| Pair | 초안 자기결과 / 근거 |
|---|---|
| VP56·변경 VP48 | SELF_PASS — 자동 혼합 FIFO·기존 질문 조작과 CUA-OC-REQ 두 시작 종류의 전체 소비·현재 한 카드·입력 복원 |
| VP57·58·67 | SELF_PASS — 실제 Composer→store/reducer→selector→dock→action, 세션 격리·draft/첨부 복원·reset/child 19자리 직접 관측 |
| VP59·61, 변경 VP46·50 | SELF_PASS — 실제 선택·가상화·읽기/추종·접기/크기·세션 왕복과 두 테마 색상을 EP36c~g 좌표로 관측 |
| VP60·62 | SELF_PASS — 실제 TranscriptView dispatcher→OpenCodeTimeline→9종 행, 투영 identity·간격·스크롤 정책 직접 검사 |
| VP63·65 | SELF_PASS — Todo 상태·타이머·실제 Composer 배선 및 CUA에서 전개/접힘·요청 가림/복귀·완료 후 제거·세션 왕복 접힘 유지 |
| VP64·66 | SELF_PASS — normalized 결과→reducer/parts→목록→실제 Composer, 상태/요약/접힘/턴 경계 직접 검사 |
| 영향 회귀 | Claude 배치=`Composer.approvalQueue.test.ts: retains Claude approval and question layout`; 질문·IME/controller·승인·child·v1 reply는 관련 회귀. 본문/결과/스피너/색상은 `TranscriptView.harness.test.ts`, `AssistantSegment.render.test.ts`와 CUA 두 테마 대조 |

### 이번 라운드 수정의 잠금

| 분류 | 이번 증거 |
|---|---|
| 직접 행동 oracle | 혼합 요청 이벤트→유일한 카드→실제 응답 payload→다음 DOM, 초안·첨부 복원, Todo 상태·타이머·접힘, 실제 Timeline9종 행·identity·selection 및 브라우저 앵커/색상 |
| 새 구조적 proxy·0건/전수·배선 존재 oracle | 없음. DOM 현재 카드 수·숨김·행 순서와 실제 dispatcher 결과는 사용자 결과 직접 관측이며 소스 문자열이나 import 존재를 대신 세지 않음 |
| 선택된 적대 증거·인용 변이 | ΔV11~13 설계는 직접 값/기하 관측으로 미선택. 이번 턴에 과거 M-ID를 다시 수행했다고 주장하지 않음 |

잠금 검산: 선택 증거0 · 인용 변이0 · 새 구조 oracle0 = 적대 검사 행0. 직접 행동 테스트를 구조적 oracle로 바꾸거나 브라우저 기하를 SSR로 대체하지 않았다.

### Product/UX 파생 검토

대기 중 새 요청이 와도 현재 질문의 선택이 유지되고 뒤 요청은 mount하지 않는다. 입력 영역 대체 동안 전송·첨부 조작과 Todo는 숨기며, 데이터는 보존한다. 외부 비선두 해소는 현재 카드에 영향을 주지 않는다. Claude의 독립 질문·승인 카드와 입력·중단 표시를 실제 렌더로 다시 검사했다.

Todo 접힘은 새 턴과 캐시 세션 왕복에서 유지하고 처음 보는 세션만 펼침으로 시작한다. 진행 목록과 UI 선호를 분리하여 이전 턴 목록의 재등장을 막는다. 실제 요청 소비 후 초안·sample.md 첨부·접힌 Todo가 함께 복귀했다. 폭·글자 크기 전환에서도 읽는 행 offset을 유지했고 두 테마의 사용자 버블 색상은 Claude와 같았다.

### 놓친 잠재 문제 + 대응

- CI #761은 공통 글자 배율 선언의 단일 소유 규칙(typeScale AC7)을 새 OpenCode 루트가 중복 선언한 것을 검출했다. TranscriptView가 하나의 선언을 소유하고 OpenCode 루트에 prop으로 전달하도록 보완했다. 기존 구조 검사는 수정하지 않았으며 실제 ChatTile→dispatcher DOM에서 Claude Code/Work와 OpenCode 모두 transcript 루트 한 곳만 배율을 받고 composer 조상에는 없는지 직접 검사했다.

- 기존 질문/승인 두 배열만으로는 종류 간 도착 순서를 복원할 수 없었다. 별도 순서 참조만 추가하고 payload 정본은 기존 배열에 유지했다. IPC·DB 형식을 늘리지 않았다.
- 실제 store를 쓰는 DOM 통합 검사에서 외부화된 Zustand React 바인딩이 테스트 React 런타임을 우회했다. Zustand vanilla store와 제품 store/actions는 유지하고 React 구독 바인딩만 테스트 런타임에 연결했다. 단순 action mock으로 대체하지 않았다.
- Todo 도입 후 SSR 회귀에서 `window` 접근이 실패했다. reduced-motion 초기 조회에 브라우저 존재 가드를 적용했고 영향 Composer 검사 4파일28케이스가 다시 통과했다.
- Todo 애니메이션은 기존 rAF의 ease-out으로 이식했다. 신규 spring 의존성 없이400ms 종료 대기·300ms 진행률·감속 모션과 타이머 무효화 계약을 직접 검사했다.
- 재실행 fixture의 settings 기본값 누락과 `pickFiles`/`pickAttachments` 계약 불일치를 수정했다. 시나리오 초기화는 새 epoch A/B 키를 사용하여 과거 viewport cache가 새 시나리오 판정을 오염시키지 않게 했다.
- 설계의 EP37c/f 테스트 좌표는 실제 소유 경로에 맞춰 Composer 통합 및 transcript projection 검사로 구체화했다. Timeline은 영속 Message ID를 추가하지 않고 role/createdAt와 동일 prefix occurrence로 key를 만든다. 서로 다른 timestamp prepend와 같은 timestamp의 서로 다른 교환은 직접 검사했다. 같은 timestamp의 완전히 동일한 과거 입력을 prepend할 때 occurrence를 완전히 복원하는 보장은 없다. 이는 식별 정보가 완전히 같은 과거 항목을 구분하지 못하는 기존 메시지 모델의 한계다. 현재 이력 로드는 전체 교체이며 정상 live append·서로 다른 과거 prepend는 보존한다. 해당 비정상 합성 입력의 identity 보장은 NON_BLOCKING 후속으로 기록하고 영속 계약을 이번에 늘리지 않는다.
- 세션 cache는 top/pin/anchor/disclosure/size를 세션 key에 귀속한다. 공유 cache 왕복, 비활성 출력, 외부 pointerup 재진입, observer cleanup, live→commit renderer 전환을 각각 단위·CUA로 관측했다. 사용자 버블 색상·font scale은 유지하고 geometry만 radius10px/max-width min(82%,64ch)로 변경했다.
- 탐색 펼침의 첫 좌표 비교는 locator.click의 자동 스크롤이 섞였다. 실제 화면 좌표 클릭으로 다시 관측하자 펼침/접기 모두 top120px·user1 text offset−4.8125px가 같았다. 자동화 도구가 만든 스크롤을 제품 앵커 결함으로 기록하지 않는다.

- NON_BLOCKING: 전용 viewport Map은 세션 삭제 후에도 ID·높이·접힘 등 메타데이터를 보관한다. 메시지 본문·DOM·observer는 보관하지 않고 삭제 내용 재노출 경로도 없다. 기존 세션 store의 캐시 정책과 함께 삭제/무효화 시 eviction을 후속 정리한다.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| 기존 AC1~31 중 AC11·26·28·29 제외 27건 | 기존 자기보고 유지 | 이번 변경이 닿은 회귀만 위 좌표로 추가 확인. 과거 유효 V 전체를 새로 검증한 뜻은 아님 |
| AC26·29 | ✅ 동작 자기확인 | OpenCode 전용 행·토큰·하네스 분기, 두 테마 색상 동등, 실제 스크롤·선택·앵커 |
| AC28 | ✅ 동작 자기확인 | 실제 질문/승인 payload·한 장 대체·Claude 배치, CUA-OC-REQ |
| AC32 NEW | ✅ 동작 자기확인 | Q→P→Q/P→Q→Q 전체 소비, 현재 한 카드·외부 해소·마지막 draft/sample.md 복원 |
| AC33 NEW | ✅ 동작 자기확인 | 60 exchange의 선택 왕복, unpin/repin 출력·resize/font·세션 앵커 측정 |
| AC34 NEW | ✅ 동작 자기확인 | 성공 root Todo·1/3 접힘·가림/복귀·3/3 완료 뒤 제거·이력 보존 |
| AC11 | ⚠️ | 사용자 최종 시각 인수와 독립 verify 대기 유지 |

분모는31→34다. 동작 자기확인 검산은 기존27 + 변경3 + 신규3 = ✅33 · ⚠️1 · ❌0 =34다. 로컬 필수 게이트 완료 후 plan/INDEX를 impl/IMPL_DONE·다음 Claude로 갱신했다. 구현 trailer는 Criteria-Met 33/34, Criteria-Pending AC11, Verified-By pending으로 남긴다.

| 게이트 | 관측한 산출 |
|---|---|
| ΔV11 및 Todo Composer 직접 회귀 | 관련11파일66케이스: 첫 실행65통과·Todo SSR1실패, SSR 가드 후 영향4파일28케이스 재통과. 나머지7파일38케이스는 첫 실행 통과 |
| Todo 상태/렌더/decoder | 담당자 최종4파일36케이스 통과. SSR 가드 후 Composer.activity/TodoDock.render 2파일10케이스 재통과. 재실행 중복 케이스를 전체 합계에 더하지 않음 |
| ΔV12 직접 회귀 | 최종 계측 제거 후 담당자 실행11파일48케이스 통과(21:47:42 시작). 실제 Timeline/selection/controller·projection/policy·도구·ChatTile/TranscriptView/AssistantSegment 회귀 |
| 전체 관련 Vitest | 직접 Vitest --maxWorkers=2: 요청·composer·Todo·reducer·우측 패널·엔진·v1 adapter 관련59파일363케이스 통과. 최종 transcript·controller·선택·Claude dispatcher·Composer 통합20파일94케이스 통과. 두 실행은 일부 중복이며 합산하지 않는다. skip/실패0. 로그 .tmp/0262-r115-tests.log 및 transcript-tests.log(로컬 증거, 미커밋). |
| node/web/test typecheck | 최종 npm run typecheck의 node/web/test 모두 exit0. 초기 새 테스트의 FakeDom viewport 인자 타입 오류를 보완한 뒤 전체 재통과. |
| readonly ESLint | 승인 소유9파일 오류0·경고0, fixture2파일 오류0·경고0. 전체는 전체 읽기 전용 검사 오류0. fixture export 경고를 보완하고 최종 변경파일 검사 오류0·TanStack useVirtualizer incompatible-library 경고1. 기존 공통 virtualizer도 같은 경고를 가진다. |
| CI 실패 보완 직접 검사 | typeScale 원형 유지·ChatTile.harness·TranscriptView.harness·Timeline.render 4파일23케이스 통과. 대상 ESLint 오류0·기존 useVirtualizer 경고1. 추가 제품 두 파일 수정 후 web 타입·build 재통과. |
| build | electron-vite 직접 build exit0: main/preload/renderer 생성 완료. 기존 SubAgentTileContent 정적/동적 import 경고 유지. ABI 변경 훅은 실행하지 않음. |
| 형식/운영 | 소유 변경 `git diff --check` 통과. generated/prose·migration sync/append-only·test budgets·변경 TypeScript Prettier 통과. 전체 링크 guard는 사용자 다운로드 .tmp/opencode-dev 내부 기존5건만 실패. 다운로드·첨부를 제외한 저장소 링크는 빈 배열로 통과했다. |
| Computer Use | 실제 fixture의 production 컴포넌트·메모리 IPC로 요청 큐/Todo/transcript 직접 조작 완료. 모델 호출 없음. 아래 측정표 및 [디자인 증거](design-evidence.md#orca-요청스크롤todo-구현-관측-2026-10-15-r115) |
| 원격 Windows CI | 최초 제품33ea3e38의 CI #761에서 타입·lint·문서·migration은 통과했으나 전체 테스트 중 typeScale AC7 한 건 실패(715파일7047케이스 통과, 기존1파일1케이스 skip). 보완5b7a64ca의 [Windows CI #762](https://github.com/muzaby/orca-skin/actions/runs/38740035320)는 success. 전체716파일7048케이스 및 scripts138/138 통과, 기존1파일1케이스 skip. 문서·migration·test-budget·lint·node/web/test 타입도 성공. |
| 상태 사본·trailer | 제품 커밋33ea3e38의 git cat-file 결과 commit, git log trailer 파싱에서 Agent/Handoff/Status/Criteria-Met33/34/Criteria-PendingAC11/Verified-Bypending 모두 확인. plan/INDEX impl/IMPL_DONE·다음 Claude 재조회 일치. |

| CUA 시나리오 | 실제 관측 |
|---|---|
| CUA-OC-REQ | Q→P→Q 및 P→Q→Q의 모든 카드 순차 소비. 한 카드만 DOM에 존재, 실제 응답 callback 확인, 마지막 뒤 초안·sample.md·접힌 Todo 복귀 |
| CUA-OC-TODO | 높이175.6px·overlap−36px, 접힘1/3 요약, 완료3/3 뒤 제거. A/B 왕복 후 접힘 선택 유지 |
| 긴 이력·선택 | 60 exchange/scrollHeight25515px에8행 mount. 선택 문자열을 유지한 채3페이지 상하 왕복 |
| 출력·최신 추종 | unpinned user5 text offset−26.2125px/top1662.4px 유지. 최신에서는 height2652→2684px와 top2298.4→2330.4px가 함께32px 증가 |
| 크기·전개 | 탐색 펼침/접기 실제 좌표 클릭 후 top120px/offset−4.8125px 유지. 폭450px/font14.5px 전환 후 height2208→2245px/top120→123.199997px, 동일 offset |
| dock 크기 | Todo 전개·접기·Question 대체로 viewport 높이354→207→303→142px가 됐으나 scrollTop120px와 user1 text offset−1.6125px를 모두 유지 |
| 세션·색상 | A/B 앵커 offset 차0.025px, 비활성 세션 출력 시 활성 기하 변화0. light/dark 각각 OpenCode/Claude 사용자 버블 배경·글자 색상 동등 |

### Review Signals

r1.15는 사용자 후속 요구로 확정한 ΔV11~13 구현 턴이다. 기존 원본의 독립 질문/승인 표시를 통합 FIFO로 바꾼 근거는 D-022 사용자 결정이며 원본의 기본 동작으로 기술하지 않는다. Todo UI는 공식1.19.0 근거를 사용하고 제공2.x 아카이브의 런타임 API를 도입하지 않았다.

자동 직접 검사는 조작 결과·payload·수명까지, CUA는 실제 geometry·selection까지 관측했다. fixture의 native IPC는 메모리 대역이므로 이 결과를 실모델 응답 검증으로 확대하지 않는다. ABI를 변경하는 npm pretest/install/rebuild는 실행하지 않았다. 운영 gate의 다운로드 내부 링크 한계는 위에 분리했다. 사용자 AC11과 독립 verify는 대기이며 자기확인을 verify/PASS로 기록하지 않는다.

CI 후속: 로컬 관련 테스트 집합에 공통 styles/typeScale 검사가 빠져 있었다. CI의 전체 검사로 확인한 단일 선언 위반을 제품 경계에서 고쳤고 기존 검사 기대값을 완화하지 않았다. 화면에 전달하는 CSS 값은 같으므로 앞선 CUA의 기하·색상 관측은 유지하며 배율 전달 경로를 직접 DOM 회귀로 추가 확인했다.

최종 후속: 제품 커밋5b7a64ca의 원격 CI 성공 후 추가 커밋은 결과 기록만 포함한다. 두 구현 커밋의 trailer에서 Agent codex·Status implemented·Criteria-Met33/34·Verified-By pending을 확인했다. plan/INDEX의 impl/IMPL_DONE·다음 Claude와 AC11 대기는 유지하며 독립 verify를 선점하지 않는다. 검증용 브라우저 탭과 생성한 Vite 서버는 종료했다.

# ΔV14 — native 시스템 피드와 지속 수신 (READY, 2026-10-16)

## Product / UX와 결정

사용자는 `system-reminder`의 실제 메시지 타입과 모델 재입력을 확인하고 Claude에도 같은 공통 속성을 적용하도록 요구한 뒤 구현을 지시했다. 분류·표시는 [0232 ΔV3](../0232-background-transcript-ux/plan.md), DEV 제어는 [0003](../0003-debug-panel-mock-adapter/plan.md)가 소유한다. 여기서는 OpenCode 1.x가 이미 모델에 보낸 입력과 그 후속 응답을 빠짐없이 수신하는 경로를 확정한다.

| Decision | 계약 / 이유 | 상태·출처 |
|---|---|---|
| D-025 | 신뢰된 native synthetic user text를 공통 origin.format으로 기록한다. 태그는 실행 지시가 아니며 서버가 소유한 모델 전달을 Orca가 반복하지 않는다. | ACTIVE / 사용자 요구·0232 공통 계약·실측 |
| D-026 | 부모 첫 idle은 응답 프레임만 끝낸다. 소유 background 작업의 완료 입력과 후속 assistant는 같은 채널에서 별도 수신 프레임으로 받는다. | ACTIVE / 누락 경로를 고치는 구현 설계 |
| D-027 | 중단·오류·연결 종료에서 자동 재전송하지 않는다. main 응답 중단은 소유 background 수신과 분리하고, 채널 폐기는 구 세대 이벤트·승인을 차단한다. | ACTIVE / 기존 runtime 계약 승계 |
| D-028 | 같은 채널의 후속 사용자 입력도 그 입력의 agent·variant·model·첨부를 사용한다. 1.x API·기존 admission·원본 보존·하네스 격리를 유지한다. | ACTIVE / 지속 수신에 따른 기존 동작 보존 |

사용자 화면은 부모 응답 완료→백그라운드 수신 대기→자동 후속 응답→완료로 전이한다. 시스템 피드 자체의 기본 숨김·DEV 표시·혼합 part 보존은 0232를 따른다. 실험 background 기능을 Orca가 새로 켜거나, OpenCode 2.x API·새 패키지·독립 프로세스 관리·새 child 중단 UI를 추가하지 않는다.

| R↔AT / AC | 완료 기준 / production 경로 |
|---|---|
| R-35↔AT-35 / AC35 NEW | native root user의 synthetic text가 원문·출처·format을 가진 수신 입력으로 한 번 기록된다. 같은 본문의 다른 part는 별도 기록하고 동일 part 재수신·수기 태그·child text는 자동 root user로 만들지 않는다. SSE→native mapper→input.received→기존 coordinator 경로를 사용한다. |
| R-36↔AT-36 / AC36 NEW | background launch 뒤 부모 첫 idle에서 응답은 끝나지만 수신은 유지된다. 서버의 완료 입력→후속 assistant→다음 idle까지 기록하며 부모 텍스트·usage를 중복 합산하지 않는다. 해당 시나리오의 client prompt는 최초 사용자 입력 한 번뿐이다. |
| R-37↔AT-37 / AC37 NEW | main Stop·연결 끊김·provider 오류·세션 채널 폐기에서 중복 prompt나 옛 승인·이벤트의 새 턴 유입이 없다. main Stop은 같은 채널의 background 수신을 보존하고, 채널 폐기는 소유 요청을 종료한다. 연결 복구는 다음 명시 입력의 새 구독으로 수행하며 지난 synthetic 입력을 재송신하지 않는다. |
| R-38↔AT-38 / AC38 NEW | 후속 입력의 agent·variant·model·첨부와 원래 queue UUID가 실제 prompt/echo에 대응한다. 두 입력은 native ascending ID가 각각 다르고, 반복 send의 SSE 구독은 채널당 한 번이며 admission 철회·HTTP 거절은 허위 응답을 만들지 않는다. |

## 조사와 변경 경계

| 대상 / 검색 | 관측 / 설계 영향 |
|---|---|
| [CLI 1.19 실행 조사](system-feed-research.md) | 기본 reminder는 모델 payload에만 있을 수 있다. 저장된 synthetic part·자동 압축·background 완료는 서버가 모델 loop에 전달하며, 실측 background는 client prompt 1회 뒤 첫 idle 이후 응답까지 발생했다. |
| `opencode/v1/map.ts` user/part·finish | user role을 기억하지만 user part를 버린다. finish는 terminal을 영구 설정하고 usage를 합산하므로, 수신 채널과 응답별 mapper를 분리해야 한다. |
| `opencode/v1/adapter.ts` subscribe·idle·interrupt | 첫 idle에서 iterator를 끝내고 interrupt도 transport를 abort한다. LiveTurn.pushTurn이 없어 runtime은 턴 단위 경로를 사용한다. |
| `opencode/v1/activity.ts` child·background.call | 부모 Task completed를 foreground/returned로 취급하고 child를 닫는다. metadata.background/jobId/sessionId로 launch와 완료 통지를 구분해야 한다. |
| `SessionRuntime` send/listen/pump + `chat-turn/post-turn.ts` | pushTurn이 있는 채널은 프레임 밖 이벤트도 unframed에 보관한다. post-turn은 canonical pending/busy/backlog가 있어야 listen을 열며, activity 구독은 표시 갱신만 한다. |
| `common/turn.ts`·runtime push 인자 | TurnContinuation에 harnessAgent/modelVariant가 없어 현재 TurnRequest 값이 후속 채널에 전달되지 않는다. 선택 optional 필드를 기존 요청과 대칭으로 추가한다. |

기준 V는 V1+ΔV1~13의 기존 구현 기준(`f7c94554c28eba7024e7a66f3a3e93355389d868`, git cat-file: commit)이다. 첫 idle의 구독 종료만 D-026으로 대체하고, ΔV10의 ascending ID·정상 stop과 오류 분류·provider 경계·Claude 계약은 유지한다. 새 AC4건으로 총34→38이며 기존 자기확인33건과 AC11 대기는 새 검증 결과에 합산하지 않는다.

## Technical Design

### native 입력과 응답별 상태

`adapters/opencode/v1` 안에 native 입력 영수증/작업 통지 해석의 순수 seam을 둔다. root session·user role·synthetic:true가 확인된 text만 `{type:'input.received', text, uuid, origin:{kind:'automatic', format}}`으로 변환하고, format은 0232의 `withReceivedInputFormat`을 호출한다. native session/message/part ID를 receipt 키로 사용하며 텍스트를 중복 키로 쓰지 않는다.

host가 보낸 user message의 일반 본문은 기존 로컬 input.echo와 화해하고 자동 입력으로 재기록하지 않는다. 같은 user message 안에 추가된 synthetic part는 별도 수신 part로 처리하여 사람 본문·첨부를 덮어쓰지 않는다. ignored:true·이전 구독 이전의 stale 메시지·다른 세션·child synthetic은 root 입력으로 발행하지 않으며, SSE에 없는 기본 reminder를 추측해서 합성하지 않는다.

채널은 소유 message/part 영수증과 child 관계를 유지하고 root 응답 mapper는 idle마다 flush·교체한다. idle 전에 본 native assistant/part는 다음 응답으로 재수용하지 않으며, 뒤에 도착한 synthetic user의 parentID를 갖는 새 assistant는 수용한다. root flush는 아직 실행 중인 background child를 finish하지 않고, child idle은 해당 child의 텍스트만 flush한다.

### 채널·작업 소유권과 기존 runtime 재사용

```text
OpenCode SSE → 채널 입력/활동 mapper → ProviderMessageBatch
  → SessionRuntime.startPump → 현재 frame 또는 unframed
  → 첫 idle: telemetry + turn.ended / frame 종료
  → canonical backgroundPending → runTurnWithContinuations.listen
  → native 완료 입력 + task 정착 → 후속 assistant → 다음 idle
```

LiveTurn은 채널 단위 providerGeneration·eventBatches·pushTurn을 제공한다. SDK event.subscribe는 첫 prompt보다 먼저 한 번 열고, 최초·후속 prompt를 같은 채널에 제출한다. pushTurn은 실제 수용 결과를 runtime에 돌려주며 원래 pending UUID의 echo를 발행한다; runtime의 canSubmitInitial→push→commit 순서를 어댑터에서 재검사하거나 앞당기지 않는다.

TurnContinuation과 SessionRuntime.runAttempt의 push 인자에 harnessAgent/modelVariant를 추가한다. OpenCode push는 next 요청의 값과 첨부를 사용하고 cwd·system append·extraDirs·settings는 기존 spawn 경계를 따른다. 후속 model 변경의 기존 respawn 판정은 유지하며 Claude는 새 optional 값을 해석할 필요가 없다.

metadata.background:true가 있는 소유 task는 native jobId(없으면 확인된 child sessionId)와 소유 parent call ID를 결합한 canonical task identity로 background.call과 연결한다. native job/child ID는 agentId 또는 metadata에 별도로 보존한다. launch receipt의 completed는 호출 반환이지 작업 종료가 아니므로 call mode=background와 task running을 유지한다. foreground task는 부모 결과에서 기존처럼 끝내며 listen을 붙잡지 않는다.

background 완료는 root synthetic text의 정확한 native task envelope와 등록된 child/job ID·terminal state(completed/error)가 일치할 때 정착한다. 이 매핑은 v1 native 프로토콜 해석이며 공통 format helper의 의미 분류나 임의 태그 재피드와 분리한다. 완료 input.received와 canonical notification을 같은 ProviderMessageBatch로 내보내어 post-turn이 작업 정착과 후속 응답 사이에서 break하지 않게 한다; child idle만으로 이 수신 대기를 해제하지 않는다.

canonical source.generation은 prompt마다 바꾸지 않고 채널에 고정하며 sequence는 모든 활동 배치에서 증가한다. 같은 child 재사용은 별도 호출 identity로 등록하고 native 완료 ID를 현재 소유 호출에 연결하여, 이전 호출의 terminalEvidence가 새 실행을 완료로 덮지 못하게 한다. 같은 완료 part는 한 번만 정착하며 전체 작업의 완료까지 post-turn listen이 이어진다. 새 host 입력은 기존 held/flush 경로를 사용한다.

설계 정정 근거: 구현 조사에서 `shared/background-task.ts`가 동일 generation/taskId의 첫 terminalEvidence를 보존하고 OpenCode native job ID가 재사용 child ID와 같음을 확인했다. native ID만 canonical key로 쓰던 초기 ΔV14 기술행은 D-026의 재사용 요구와 충돌하므로 호출 identity를 추가했다. 공통 reducer와 사용자 화면 계약은 바꾸지 않으며 VP-Δ14-06·09 및 EP39h·40c의 재사용 직접 oracle이 이 경계를 검증한다.

### 취소·실패·승인·정리

| 경계 | 동작 |
|---|---|
| 정상 root idle | 해당 응답의 text/usage/turn.ended를 한 번 발행하고 채널·다른 child·승인 수신을 유지. child 승인을 포함한 전역 Promise 집합을 기다려 root 완료를 막지 않는다. |
| main interrupt | native root session.abort만 요청하고 SSE는 유지. 현재 main 승인은 해당 turn signal로 해소하며, assistant 없이 idle이 와도 취소 tail terminal을 한 번 제공해 runtime draining을 끝낸다. 기존 background reception 정책을 바꾸지 않는다. |
| child 승인 | 확인된 소유 child 요청은 채널/child 수명에 결합하고 main turn 교체·중단 신호에 잘못 취소하지 않는다. 다음 listen 프레임의 최신 requestApproval delegate를 사용한다. |
| close/채널 교체 | 즉시 generation·approval callback을 무효화하고 iterator/transport를 정리한다. 소유 root와 알려진 child에 종료 요청을 보내되 기존 사용자 서버·무관 세션을 종료하지 않는다. 중복 close는 추가 전송하지 않는다. |
| provider 오류/SSE 종료 | 기존 retryable:false 오류와 채널 종료를 전달하고 원문/토큰을 오류로 노출하지 않는다. SSE 자동 재접속·기존 prompt 재제출을 하지 않으며, 다음 명시 send는 새 generation/구독으로 시작한다. |
| 종료 요청 실패 | 성공·stopped를 꾸미지 않는다. 기존 canonical connection 종료/불확실 상태로 남기고 정리 오류는 민감 본문 없이 기록한다. 새 개별 stopTask/backgroundTask 지원은 추가하지 않는다. |

prompt API 호출은 host가 제출을 시도한 입력당 최대 한 번이며 HTTP 거절도 그 한 번에 포함한다. native 피드 수신은 prompt 요청을 늘리지 않으며, root/child 이벤트의 원문은 기존 저장·journal 경로를 사용한다. 일반 사용자·모델 본문을 새 중복 캐시에 복제하지 않고 native ID와 필요한 현재 응답 상태만 유지한다.

## V / 직접 oracle

아래 신규 좌표는 구현할 테스트 이름이며 아직 존재하는 증거로 주장하지 않는다. `adapters/opencode/v1/native-input.test.ts`는 순수 입력/소유권 seam, 같은 디렉터리의 `adapter.persistent.test.ts`는 설치 SDK에 HTTP/SSE만 주입하는 실제 adapter, `app/chat-turn/opencode-continuation.test.ts`는 실제 adapter·SessionRuntime·BackgroundTaskTracker·runTurnWithContinuations·TurnCoordinator를 연결한다. 마지막 테스트의 DB 저장 sink/IPC transport만 메모리 대역으로 대체하고 input.received→persist/forward 호출 결과를 관측한다; 실제 DB round-trip은 0232가 소유한다.

| Pair / provenance | 필요도 / 경로·§10 | 직접 oracle |
|---|---|---|
| VP-Δ14-01 R35↔AT35 NEW | REQUIRED / SSE→영수증→입력→coordinator, EP38a~c·39g | 신규 `native-input.test.ts: preserves native synthetic parts and rejects own text, ignored and foreign inputs`; 신규 `opencode-continuation.test.ts: commits each native feed once before its provider reply` |
| VP-Δ14-02 R36↔AT36 NEW | REQUIRED / launch→첫 idle→listen→완료→응답, EP39a·d~h | 신규 `opencode-continuation.test.ts: receives the background completion after first idle without another prompt` |
| VP-Δ14-03 R37↔AT37 NEW | REQUIRED / interrupt/error/retire→다음 수신, EP40a~d | 신규 `adapter.persistent.test.ts: preserves owned reception on interrupt and retires stale channel callbacks`; 신규 `opencode-continuation.test.ts: ends a disconnected chain without replaying accepted input` |
| VP-Δ14-04 R38↔AT38 NEW | REQUIRED / 다음 request→runtime→push→SDK, EP39b·c | 신규 `opencode-runtime.test.ts: forwards changed agent and variant with attachments on the existing channel` |
| VP-Δ14-05 MD-Δ14-01↔UT-Δ14-01 NEW | REQUIRED / native ID·part→영수증, EP38a·b | 신규 `native-input.test.ts: deduplicates native part IDs but preserves equal text from different parts`; 위 provenance table |
| VP-Δ14-06 MD-Δ14-02↔UT-Δ14-02 NEW | REQUIRED / task metadata→소유권·정착, EP39h·40c | 신규 `activity.test.ts: keeps background launch pending until its owned synthetic completion`; `separates concurrent children and reused sessions across root frames` |
| VP-Δ14-07 AR-Δ14-01↔IT-Δ14-01 NEW | REQUIRED / mapper→batch→pump→tracker/listen→coordinator, EP38c·39d~g | 신규 `opencode-continuation.test.ts` 위 두 정상 시나리오 및 `retains completion received between root idle and listen registration` |
| VP-Δ14-08 AR-Δ14-02↔IT-Δ14-02 NEW | REQUIRED / request→push와 approval/retire, EP39a~c·40a~d | 신규 `adapter.persistent.test.ts: subscribes once before initial and subsequent prompts`, `keeps child approvals independent from interrupted root frames`; 위 option·disconnect 테스트 |
| VP-Δ14-09 SD-Δ14-01↔ST-Δ14-01 NEW | REQUIRED / 첫 입력→다중 자동 응답→종료/재접속, EP38a~40d | 신규 `opencode-continuation.test.ts: receives concurrent background completions and a later user turn on one subscription`; disconnect/interrupt table |
| VP-05·15·18 및 ΔV10 입력 ID 구간 INHERITED | REGRESSION / 기존 입력·오류·1.x SDK 경계 | 기존 `adapter.test.ts: sends native ascending IDs and completes successive turns under the legacy stop ordering contract`, `surfaces a disconnected stream and aborts only that session without resending the prompt`; `opencode-runtime.test.ts: delivers a reply after runtime admission for session %s` |
| 공통 runtime listen·취소 계약 INHERITED | REGRESSION / 0067·0136·0143·0250 동작 | 기존 `session-runtime.test.ts: 채널 생존 중 listen 은 push 없이 프레임을 열어 이벤트를 소비한다`, `유휴 중 쌓인 백로그(unframed)를 listen 프레임이 선합류한다`, `idle listen 취소는 다음 예약 응답을 drain하지 않고 같은 채널에서 수신한다`; `post-turn.schedules.test.ts: 예약 없이 백그라운드 작업만 기다려도 ready이며 즉시 재개한다` |

## §10 강제 지점 전수

경로 접두어는 `app/src/main/`이며 표의 신규 테스트 파일은 바로 위 oracle 설계를 따른다. 복수 edge를 한 자리로 숨기지 않고 native 수신·분류·배치·pump·tracker·listen·coordinator를 나누었다.

| 지점 / 자리 수 | production 위치 / 실패 의미 | 직접 oracle |
|---|---|---|
| EP38a / 1 | `adapters/opencode/v1/native-input.ts` native role/session/part receipt: 수기·child·stale 입력 승격 또는 중복 | native-input provenance·ID 두 테스트 |
| EP38b / 1 | 같은 seam→shared withReceivedInputFormat: 원문·kind·format 누락 | native-input `preserves native synthetic parts and rejects own text, ignored and foreign inputs`의 exact event |
| EP38c / 1 | `map.ts`/`activity.ts`→adapter batch: user part 유실·동일 host 본문 재커밋 | opencode-continuation `commits each native feed once before its provider reply`의 실제 SSE부터 commit/forward까지 |
| EP39a / 1 | `adapter.ts` 첫 구독·prompt: 구독 전 송신·구독 중복·admission 재검사 | `adapter.persistent.test.ts: subscribes once before initial and subsequent prompts`의 HTTP 순서·subscription 수 + 기존 admission 검사 |
| EP39b / 1 | `session-runtime.ts` runAttempt→pushTurn: agent/variant/options 누락 | opencode-runtime `forwards changed agent and variant with attachments on the existing channel` |
| EP39c / 1 | adapter pushTurn→SDK prompt/echo: 낡은 옵션·첨부·UUID·ID 재사용 | 같은 테스트의 HTTP body·echo 및 native ascending ID 직접 단언 |
| EP39d / 1 | adapter iterator→SessionRuntime.startPump/routeBatch: 첫 idle 채널 사망·usage 중복 | opencode-continuation `receives the background completion after first idle without another prompt`의 첫/후속 프레임·usage |
| EP39e / 1 | routeProviderEvents→onProviderEvent→BackgroundTaskTracker: generation/작업 사실 누락 | `opencode-continuation.test.ts: receives the background completion after first idle without another prompt`의 실제 canonical task/call pending·terminal 값 |
| EP39f / 1 | tracker.hasPending→post-turn decide/listen: launch를 완료로 오판·첫 idle 뒤 break | 같은 `receives the background completion after first idle without another prompt`의 첫 idle 뒤 ready·수신 상태와 후속 assistant 결과 |
| EP39g / 1 | runtime.listen→TurnCoordinator input/response sink: 수신 입력·후속 응답 순서/영속 호출 누락 | opencode-continuation `commits each native feed once before its provider reply` |
| EP39h / 1 | activity native completion→task notification+input batch: child idle 조기 정착·다른 작업 종료 | activity 소유권·동시 task 두 테스트 + opencode-continuation `retains completion received between root idle and listen registration` |
| EP40a / 1 | runtime interrupt→adapter native abort: SSE까지 폐기·취소 tail drain 고착 | `adapter.persistent.test.ts: preserves owned reception on interrupt and retires stale channel callbacks`; 신규 `opencode-continuation.test.ts: resumes reception after interrupt without retaining cancelled tail`의 실제 runtime 취소 후속 프레임 |
| EP40b / 1 | adapter close/error→runtime retireChannel: iterator/승인 누수·prompt 재전송 | opencode-continuation `ends a disconnected chain without replaying accepted input`; 신규 `adapter.persistent.test.ts: closes owned subscriptions once and reports uncertain abort failures` |
| EP40c / 1 | 채널 generation/native ID→mapper admission: 이전 응답·세션·child/usage 재수용 | activity `separates concurrent children and reused sessions across root frames`; adapter.persistent `preserves owned reception on interrupt and retires stale channel callbacks`의 구 세대 SSE table |
| EP40d / 1 | adapter approval scope→최신 runtime delegate: main 취소가 child 승인 취소·옛 frame 승인 반영 | adapter.persistent `keeps child approvals independent from interrupted root frames`; 기존 `approval.main-scope.test.ts`의 initial/followup/listen/respawn 회귀 |
| EP41a / 1 | 이 plan 메타·ΔV14 | READY/유효 V·AC 분모·구현 보고 구분이 어긋남 | gate: 대상 `git diff --check`와 READY Decision↔AC↔pair↔EP 재조회 |
| EP41b / 1 | `docs/handoff/INDEX.md` 0262 행 | plan과 보드의 단계/상태/다음 주체 불일치 | gate: plan·INDEX 상태 동시 재조회 및 설계 commit trailer 파싱 |

제품 분모는 EP38 3 + EP39 8 + EP40 4 =15자리, 문서 운영은 EP41 2자리로 별도 보고한다. 직접 이벤트·HTTP body·callback·최종 상태를 관측하므로 구조 proxy용 mutation은 선택하지 않는다. 신규 oracle은 해당 경로 양끝을 mock하지 않으며 필요한 순서 race는 지연 가능한 SSE/HTTP fixture로 재현한다.

## 운영 gate와 READY 대조

관련 비DB Vitest는 native mapper/adapter/runtime·background/post-turn·Claude callback/취소 회귀를 포함한다. 전체 node/web/test typecheck·읽기 전용 ESLint·build·error-handling inventory·문서 inventory/링크·diff를 실행하고 설치 SDK1.18.27/CLI1.19 계약을 유지한다. npm pretest/install/rebuild·새 모델 호출은 필요하지 않으며 실제 CLI 검증을 추가할 때는 격리 loopback 합성 모델만 사용한다.

ACTIVE 대조: D-025↔AC35, D-026↔AC36, D-027↔AC37, D-028↔AC38이며 D-004/015~017의 Claude·1.x 경계와 충돌하지 않는다. 공통 origin.format→저장/표시의 나머지 edge는 0232가 소유하고, 본문은 native 공급·수신 lifetime만 규정하므로 두 계획이 같은 표시 정책을 중복 소유하지 않는다. 기존 AC11 인수와 독립 verify는 유지하며 설계 READY를 구현 완료로 표시하지 않는다.

## [구현자 기입] ΔV14 — native 피드와 지속 채널 (2026-10-16)

### 1. 설계 리뷰

구현했다. `channel.ts`가 SDK SSE 수명·pushTurn·승인·중단을 소유하고 `native-input.ts`가 synthetic user의 출처·part receipt·format을 정규화한다. common runtime의 pump/listen·post-turn·history 경로를 재사용하며 background 실험 플래그를 새로 활성화하지 않는다.

### 2. 강제 지점 전수와 V-pair 자기확인

| 자리 / 수 | 직접 oracle / 관측 | 자기확인 |
|---|---|---|
| EP38a~c / 3 | `native-input.test.ts` provenance·part ID·동일 본문, `opencode-continuation.test.ts: commits each native feed once before its provider reply`: 실제 SSE→commit/forward 원문·origin | SELF_PASS |
| EP39a~c / 3 | `adapter.persistent.test.ts: subscribes once before initial and subsequent prompts`, early SSE/지연 HTTP 테스트, `opencode-runtime.test.ts: forwards changed agent and variant with attachments on the existing channel`: 구독1·prompt/echo/옵션 일치 | SELF_PASS |
| EP39d~g / 4 | `opencode-continuation.test.ts` 첫 idle 뒤 완료·프레임 사이 도착·복수 task/후속 입력: 실제 adapter→pump→controller/tracker→post-turn→coordinator의 pending/terminal·수신·commit/usage | SELF_PASS |
| EP39h / 1 | `activity.test.ts` background launch·동시/reused child, continuation의 `keeps a reused child session pending until its new task invocation completes`: 두 호출의 상태 분리 | SELF_PASS |
| EP40a~b / 2 | persistent interrupt/cleanup·continuation disconnect/interrupt/warm HTTP 거절: no replay·새 generation·취소 tail·불확실 종료 | SELF_PASS |
| EP40c~d / 2 | map의 이전 parent 새 assistant·동일 timestamp stale user, persistent child approval/main interrupt·후속 frame 승인 scope: 늦은 이벤트/승인 격리 | SELF_PASS |
| EP41a~b / 2(문서) | 현재 plan 메타·ΔV14 AC35~38·INDEX 행을 재조회하고 diff 검사·설계 commit trailer 파싱 | SELF_PASS |

제품 3+3+4+1+2+2=15/15, 문서2/2. VP-Δ14-01~09는 위 직접 oracle로 SELF_PASS이며 기존 VP-05/15/18·ΔV10 입력 ID 및 공통 runtime/post-turn/approval scope 회귀를 함께 실행했다. 최종 실행은 native-input/activity/map/adapter/persistent·OpenCode runtime/continuation·session-runtime/post-turn schedules/approval scope·error registry 11파일247테스트 통과다.

### 3. 이번 라운드 수정의 잠금

| 증거 | 실제 결과 |
|---|---|
| 재사용 작업 identity | native ID만 사용한 상태에서 두 번째 호출이 ready 대신 idle로 끝나는 통합 테스트 FAIL → native ID+parent call tuple 적용 후 PASS |
| standalone warm 실패 close | `pushTurn` catch의 close 제거 시 `adapter.persistent.test.ts`에서 두 번째 입력이 stream_closed 대신 HTTP503을 다시 요청해 FAIL → 복원 후 PASS |

선택 적대 증거0·구현 중 인용 변이2·신규 구조 proxy0=표2행. warm close 제거 변이는 실제 SessionRuntime 통합에서는 GREEN이었다. 공통 runtime의 catch가 이미 teardown하므로 이 보강을 기존 사용자 경로의 장애 수정으로 주장하지 않고 standalone LiveTurn 계약 보강으로 구분한다.

### 4. Product/UX 파생 검토

첫 부모 idle 뒤에는 같은 채널에서 소유 background를 기다리고 자동 입력·후속 assistant를 별도 프레임에 기록한다. 중단은 main 응답과 child 승인 수명을 구분하며, 다음 입력은 그 요청의 agent·variant·model·첨부를 사용한다. DEV의 system-reminder 포함 표시 정책은 0232/0003을 그대로 소비하고 OpenCode 전용 예외를 만들지 않았다.

### 5. 놓친 잠재 문제 + 대응

native child ID만 canonical key로 쓰면 공통 reducer의 terminalEvidence가 새 실행을 완료로 덮는 PLAN_GAP을 발견했다. 별도 설계 정정 후 `opencode:${JSON.stringify([nativeId,parentCallId])}`로 호출을 구분하고 native ID는 agentId에 보존했다. 공통 reducer를 변경하지 않았다.

warm HTTP 응답보다 SSE가 빠른 경우 accepted echo를 먼저 배달하도록 잠갔다. 제출 실패 때의 버퍼는 수용 여부가 불확실하므로 새 프레임으로 승격하지 않고 채널을 폐기하며, 다음 명시 입력만 새 구독을 연다. 정리 abort 실패는 원문·경로 없이 실패 개수를 `opencode.channel.abort.failed`로 보고하고 종료 성공을 합성하지 않는다.

### 6. 구현 보고

| AC | 관측 / 자기보고 |
|---|---|
| AC35 | ✅ native provenance·part 단위 중복 제거·공통 format·원문 수신, 사람/child/ignored/stale 제외 |
| AC36 | ✅ 첫 idle→자동 완료 입력→후속 응답까지 같은 채널 수신, client prompt 추가0·부모 usage 중복 없음 |
| AC37 | ✅ main interrupt·provider/stream 오류·채널 폐기·warm HTTP 실패에서 no replay와 generation/승인 격리 |
| AC38 | ✅ 후속 agent/variant/model/첨부·UUID·native ascending ID, 단일 구독·admission/HTTP 거절 검사 |

이번 추가 AC는 ✅4·⚠️0·❌0=4다. 누적은 기존33✅·AC11⚠️에 새4✅를 더한37/38이며, 기존33건을 이번에 모두 다시 검증했다고 주장하지 않는다. 최종11파일247테스트 이전에도 직접/registry9파일339테스트를 통과했고, 이후 추가 warm 경계와 공통 runtime을 포함해 재검증했다.

전체 typecheck·readonly ESLint(오류0/기존 경고6)·production build를 통과했다. 문서 inventory 수치·scope 링크·migration·test budget gate는 0232 마무리와 동일하며, error-report registry는 새 cleanup 좌표까지 검사했다. 테스트는 설치 SDK에 HTTP/SSE를 주입하고 실제 adapter/runtime/controller/tracker/projector/coordinator/post-turn/settlement를 실행했다; DB/IPC는 메모리 sink이고 실제 모델·OS 단절 타이밍 검증으로 승격하지 않는다.

### 7. Review Signals

이번은 native 수신 수명 요구의 ΔV14 구현이다. 재사용 작업 identity 충돌은 기존 terminalEvidence 불변식과의 접점에서 발견해 설계로 되먹였고, HTTP 실패의 runtime 중복 방어는 직접 변이로 구별했다. `.tmp/opencode-dev`·사용자 첨부·설치 SDK/CLI를 변경하거나 커밋하지 않았으며 독립 verify와 기존 AC11 인수 대기를 유지한다.

# ΔV15 — OpenCode native 저장 경로와 기존 격리 세션 전환

## Part I — Product & UX Contract

### 목표·근거·소유권

Orca에서 만든 OpenCode 세션을 동일한 작업 디렉터리의 일반 `opencode -s <native ID>`로 이어간다. native 저장소를 원본으로 사용하고 Orca DB에는 표시·검색·앱 메타데이터를 위한 대화 사본을 보관한다. 모델 등 Orca 실행 오버라이드는 엔진&모델 페이지에서 계속 제공한다.

사용자 원문: “대화내용 저장은 우리 db에 하고 있지만, opencode를 포함하여 claude, 후에 추가될 하네스에 대해서도 ssot는 그들의 작업경로이다. 다른 리소스도 똑같다.” 후속 답변에서 native 기본 저장 경로와 Orca 모델 설정 오버라이드를 구분했고, 목록 제거 시 원본·작업 폴더 보존 및 터미널 추가 대화의 Orca 재열기 반영을 확정했다.

공통 원본/보관 계약·Claude 경로·목록 제거·외부 추가 이력 재수입은 [0265 V1](../0265-harness-native-storage/plan.md)과 [ADR-009](../../decisions/009-harness-native-storage-authority.md)가 소유한다. 이 델타는 OpenCode 1.x 프로세스의 native 저장 환경, 기존 격리 저장소 전환, 동일 native ID/cwd의 CLI 재개를 소유한다. 전역 native 세션 자동 발견 UI나 OpenCode 2.x 지원은 추가하지 않는다.

### Decision Ledger 추가·대체

| ID | 결정 / 조건 | 상태 / 출처 | 대체·연계 |
|---|---|---|---|
| D-029 | 세션·하네스 소유 리소스는 native 기본 경로와 사용자가 지정한 native 환경을 원본으로 사용. Orca가 별도 XDG·DB 루트를 자동 주입하지 않음 | ACTIVE / 사용자 SSOT 요구·범위 명확화 | V1 §9 전용 데이터 경로·§16 DB history SSOT를 SUPERSEDED. 0265 D01/02·ADR-009 |
| D-030 | Orca 엔진&모델 설정은 실행 오버라이드로 유지하고 native 설정 파일을 자동 덮어쓰지 않음 | ACTIVE / 사용자 명확화 | D-008/010 유지. 저장 경로 공유를 이유로 engine CRUD·provider config를 제거하지 않음 |
| D-031 | 기존 Orca 격리 세션은 native ID·실제 cwd·관련 리소스를 보존하는 전환 대상. 원본 삭제·충돌한 native 데이터 덮어쓰기·DB 전문 재전송으로 새 세션 생성 금지 | ACTIVE / 기존 세션 이어가기 요구의 무손상 조건 | V1 세션 이관 비범위를 해당 기존 세션에 한해 SUPERSEDED. 미완료 전환은 성공으로 숨기지 않음 |
| D-032 | Orca 목록 제거는 native 세션·작업 폴더를 보존하고, 알려진 세션은 터미널 추가 대화를 Orca 재열기에 반영 | ACTIVE / 사용자 후속 답변 | 공통 동작·AC·재수입 정본은 0265. 본 델타는 OpenCode native 조회·전환 경계를 제공 |

갱신 대조: D-029↔AC39, D-030↔AC40, D-031↔AC41/42. D-032는 0265의 목록 제거·재열기 AC로 추적하며 이 문서에 별도 UI 정책을 복제하지 않는다. D-005의 소유 서버 자동 관리, D-015~017의 1.x·모듈 경계, D-025~028의 자동 피드·지속 채널은 유지한다.

### 흐름과 상태

| 시작 / 상태 | 사용자가 받는 결과 |
|---|---|
| 새 OpenCode 대화 | native 경로에 세션 생성, Orca에도 보관. 일반 CLI가 같은 ID와 실제 cwd로 재개 가능 |
| Orca 모델 설정 변경 | 다음 실행에 오버라이드 적용. native 세션 원본 위치·ID는 유지 |
| 기존 Orca 격리 세션 재개 | 원본 확인→전환 검증→native 경로 사용. 검증 완료 전 구격리 원본을 삭제하거나 성공 표시하지 않음 |
| native 대상 ID 충돌 / 실제 cwd 소실 | 대상 원본 보존, 전환 미완료 원인 표시. 임의 다른 cwd나 새 ID로 대체하지 않음 |
| 연결 실패 / 권한 오류 / 일부 리소스 누락 | 원본 부재와 접근 실패를 구분하고 보관 기록 유지. 입력 자동 재전송 없이 재시도 가능 |
| 전환 도중 종료·재시작 / 외부 실행과 경합 | 완료된 범위와 남은 범위를 다시 확인. 실행 중인 세션·리소스를 덮어쓰지 않음 |
| 터미널에서 추가 대화 후 Orca 재열기 | 0265의 native 재수입 경로로 표시 갱신. 이 경로의 읽기는 모델 호출을 발생시키지 않음 |

### Acceptance Criteria

| R / AT / AC | 관측 가능한 결과 | 검증 경로 / 직접 oracle 설계 |
|---|---|---|
| R-39 / AT-39 / AC39 NEW | 새 OpenCode 세션이 native 저장 경로에서 같은 ID/cwd로 CLI 재개된다. 사용자 지정 XDG·OPENCODE_DB도 native 규칙대로 적용 | Orca registry→server→SDK create→독립 CLI session 조회/재개. 신규 `opencode-native-storage.integration.test.ts: resumes the Orca-created session from native CLI roots`의 실제 CLI fixture |
| R-40 / AT-40 / AC40 NEW | native global/project 설정을 유지하면서 Orca 엔진 모델 오버라이드가 실제 실행에 적용된다. native 설정 파일은 Orca 저장/시작 때문에 덮어써지지 않는다 | engine/runtime→adapter config/env→native 서버 effective config·선택 모델·설정 파일 전후 비교. 같은 신규 integration의 `keeps engine overrides without redirecting native storage` |
| R-41 / AT-41 / AC41 NEW | 검증된 1.19 schema의 기존 격리 세션을 native ID·실제 cwd·부모/자식·대화·todo·event journal과 함께 이전하고 이어간다. 아래 자원 표에서 지원하는 snapshot·작업 폴더 참조도 보존한다. 검증 불가능한 자원은 종류와 이유를 명시한 미완료이며 source를 보존한다 | 구격리 fixture→전환→독립 native CLI/API 조회·추가 입력·snapshot 사용. 신규 `legacy-storage-migration.integration.test.ts: preserves session identity, workdir and referenced resources`; 지원 불가 자원은 같은 파일의 `reports the exact resource blocking migration without touching either original` |
| R-42 / AT-42 / AC42 NEW | 대상 충돌·접근 오류·리소스 누락·중간 종료·재실행에서 native 대상과 구격리 원본을 훼손하지 않고 미완료를 구분한다 | 같은 신규 migration integration의 충돌·중간 실패 fixture와 실제 source/target 전후 비교. prompt 호출 없이 복구 상태 관측 |

새 AC39~42는 구현·검증 대상이다. ΔV14의 누적37/38 자기보고와 기존 AC11 사람 인수 대기를 승계하되 새 AC를 그 실적으로 합산하지 않는다. 지원 범위 밖 자원을 미완료로 알리는 것은 완전 이관의 성공이 아니다. 구현 보고는 실제 이관 성공과 자원별 미완료를 분리한다.

## Part II — Technical Design

### 기준선과 확인한 사실

기준은 V1+ΔV1~14, 공유 커밋 `7c1b8bac11895d4b9388fbe9e2a979cf7d35af61`이며 `git cat-file -t` 결과는 commit이다. 사용자 결정 변경으로 생긴 같은 라운드의 설계 델타이며 이전 구현 보고를 FAIL로 재분류하지 않는다. 1.19.0 pinned 소스와 실제 설치 CLI를 대조했고, `.tmp`의 별도 home/XDG/DB/cwd fixture만 조작했다. 사용자 DB·실행 세션·외부 모델은 조작하지 않았다.

| 조사 대상 / 검색 | 확인 결과 / 설계 영향 |
|---|---|
| `bootstrap.ts:153`→`app/harnesses/opencode/module.ts:20`→`v1/server.ts:134–150`; `rg 'XDG_|dataDirectory'` | userData/opencode를 서버 cwd로 지정하고 XDG data/config/state/cache를 강제로 변경. 원인 경계는 저장 환경이며 서버 소유권과 별개 |
| `v1/channel.ts:172–188`→`features/history/writer.ts:299–320`; `rg 'session.updated|session.create'` | native create의 ID를 Orca 세션 ID로 보관. `directory:req.cwd`도 이미 전달하므로 ID 변환이 원인이 아님 |
| [1.19 global.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/core/src/global.ts)·[database.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/core/src/database/database.ts) | xdg-basedir 루트 아래 opencode 경로 사용. OPENCODE_DB가 우선하며 배포 channel별 DB 이름도 있으므로 기본 DB 파일명을 독자적으로 고정하지 않음 |
| [1.19 config.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/config/config.ts) | native global/project 설정 이후 OPENCODE_CONFIG_CONTENT를 병합. 저장 루트 상속과 Orca 실행 오버라이드 유지가 양립 |
| 실제 CLI `--version`, `--help`, `import --help`, `export --help`와 임시 export/import | 1.19.0. parent ID·message는 보존됐으나 child 1→0, parent event journal 5→0. 따라서 CLI JSON import를 무손상 이관 수단으로 채택하지 않음 |
| [1.19 import.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/cli/cmd/import.ts)·[export.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/cli/cmd/export.ts) | export는 info/messages. import는 실행 cwd의 projectID/directory/path로 다시 쓰고 동일 ID의 해당 필드를 갱신하며 message/part 충돌은 건너뜀. 무검사 반복 import는 안전한 병합이 아님 |
| [1.19 snapshot/index.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/snapshot/index.ts)·[session.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/session.ts) | snapshot Git 저장소는 data/snapshot/projectID/worktree hash에 별도 존재. parent의 children 조회는 별도이며 parent JSON만으로 자식·외부 파일·todo/permission/state·event journal 보존을 증명할 수 없음 |
| 설치 SDK `dist/v2/gen/types.gen.d.ts`의 SessionCreate/Get/Messages·SyncReplay | create는 ID 지정 입력 없음. get/messages/children 조회는 가능하지만 표준 session import/export API 없음. sync.replay는 event journal 계약으로 JSON export의 대체 API가 아님 |
| [1.19 session/sql.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/sql.ts)·[core/event.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/core/src/event.ts)와 fixture의 sqlite schema | session/message/part/todo 및 event_sequence/event가 원본 관계를 보관. 같은 구조를 검증한 v1 전용 transaction 이관은 ID·원본 JSON·journal 연속성을 유지할 수 있음 |
| 임시 SQLite merge→독립 CLI export→native server `noReply` 추가 입력 | source BEGIN IMMEDIATE와 target transaction으로 원본 행 보존, message 복사 직후 강제 오류 때 target rollback 확인. 재시도 후 native ID와 이전 message ID를 유지하며 message 1→2·parent journal 5→8. 외부 모델 호출 0이며 모델 문맥 품질 검증은 아님 |
| [1.19 tool/truncate.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/tool/truncate.ts)·[truncation-dir.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/tool/truncation-dir.ts)·[core/util/hash.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/core/src/util/hash.ts) | 잘린 출력은 data/tool-output 파일과 metadata/output 본문에 절대 경로를 함께 보관. snapshot worktree 해시는 SHA-1. 단순 파일 복사로 내장된 구경로까지 새 원본으로 바뀌지 않으므로 자원별 처리 필요 |

### AS-IS → TO-BE

| 축 | AS-IS | TO-BE / 소유 |
|---|---|---|
| 저장 환경 | userData/opencode 하위 XDG 강제 주입 | native 사용자 환경 계승. 경로 해석·환경 seam은 `adapters/opencode/v1` 소유 |
| 서버 수명 | 구성 fingerprint별 소유 child·인증·loopback | 동일 정책 유지. 다른 사용자 프로세스에 연결·종료하지 않음 |
| 실행 설정 | Orca config를 OPENCODE_CONFIG_CONTENT로 주입 | native 설정 위의 오버라이드 유지. 엔진 편집 저장은 기존 Orca 경로 유지 |
| 신규 세션 | 실제 cwd의 native ID가 격리 DB와 Orca DB에 저장 | 같은 cwd/ID가 native 기본 저장소와 Orca 보관 DB에 존재 |
| 기존 세션 | native ID가 구격리 DB에만 있을 수 있음 | 검증된 세션·리소스 전환 후 native 경로 사용. 이전 원본과 충돌 대상 보존 |
| 외부 이력·제거 | Orca DB 조회/제거가 중심 | 0265의 native 재수입·목록 제거 계약에 v1 조회/전환 구현 제공 |

공통 서비스에 OpenCode 파일 형식·SDK 타입을 노출하지 않는다. app/harnesses가 v1 구현과 0265의 중립 이력 포트를 조립한다. SQLite 연결은 기존 infra/db/file-database.ts factory로 주입하며 native schema·리소스 경로·이관 SQL은 adapters/opencode/v1 안에만 둔다. 새 DB 의존성이나 공통 서비스의 native SQL은 추가하지 않는다.

### 환경·서버·호출 계약

native-storage.ts가 process env와 요청 env를 병합한다. Orca는 XDG_DATA_HOME/CONFIG_HOME/STATE_HOME/CACHE_HOME·OPENCODE_DB·HOME/USERPROFILE을 저장 격리 목적으로 지정하지 않고 사용자 지정 값을 유지한다. OPENCODE_CONFIG_CONTENT에는 기존 Orca provider/model 오버라이드와 share 정책을 전달하며 native 설정 파일을 쓰지 않는다. upstream의 schema 주석 보완까지 Orca 설정 덮어쓰기로 오인하지 않도록 검증 fixture는 완성된 설정 파일을 사용한다.

OpenCodeServer.acquire(config?, env?, cwd?)에 cwd를 더한다. send·readHistory·complete는 실제 요청 cwd, project 없는 catalog는 OS home을 시작 cwd로 사용한다. executable·실효 env·config·정규화된 cwd를 pool fingerprint에 넣는다. native 요청의 directory도 실제 cwd를 유지한다. 인증·loopback·소유 child 종료·동시 startup 합류는 불변이다.

같은 executable/env/cwd의 CLI db path로 native DB 위치를 확인한다. 고정 인자 배열로 실행하며 shell을 통하지 않는다. native 서버가 schema를 초기화하고 이관기는 target DB를 임의 생성하지 않는다. 기존 dataDirectory는 legacy locator/이관 상태 파일에만 사용한다. 기존 layout <userData>/opencode/data/opencode의 실제 DB 후보에서 session ID를 확인하되 다중 후보·OPENCODE_DB로 인한 위치 불명은 구체적인 미완료다. source/target realpath가 같으면 이관하지 않는다. 경로·SQL은 renderer 입력으로 받지 않는다.

### Native history·재개 포트

0265의 NativeHistoryRequest { sessionId, cwd, env?, providerSettings? }와 NativeHistoryResult를 구현한다. native get 성공이면 그 ID/cwd가 원본이고 legacy를 합치지 않는다. native 404일 때만 알려진 legacy ID의 이관을 시도한다. 권한·접근·서버 오류를 missing으로 바꾸지 않는다. 이관 후 같은 native API로 다시 읽고 send 준비도 같은 존재 확인을 사용한다. Orca 보관 본문을 새 session/prompt로 재전송하지 않는다.

신규 native-history.ts가 SDK get/messages를 기존 v1 mapper/projector로 정규화해 NativeHistoryMessage { id, sourceIds?, ...LoadedMessage }를 만든다. 여러 native assistant를 묶으면 모든 원본 ID를 sourceIds에 남긴다. session/cwd/project와 message/part의 revision을 두 번 읽어 같을 때 채택한다. sourceKey는 DB 경로/cwd의 opaque digest이며 raw에 auth/config를 넣지 않는다.

완료 없는 assistant(time.completed/finish), pending/running tool, 최신 user의 대응 assistant 미완료, 두 조회 사이 revision 변경은 busy다. 자체 server status만으로 다른 CLI의 실행 상태를 알 수 있다고 가정하지 않는다. **busy는 동기화 보류이며 존재가 확인된 세션의 명시 입력 재개를 막지 않는다.** 중단된 응답도 새 사용자 입력만 같은 ID로 보내 복구한다. missing/unavailable/migration-required는 재개 차단이다. 외부 CLI의 이후 시작과 원자적 OS 전역 lock을 보장하지 않으며 native API 실행 guard를 유지한다.

input.echo/input.received의 uuid는 큐 identity이고 별도 nativeMessageId는 실제 native ID다. assistant도 native ID를 전달한다. ascending ID·지속 채널·자동 피드 origin은 유지한다. 0265가 부가 메타 join·live 교체·중복 방지를 소유한다.

### Legacy 자원 inventory와 지원 판정

실제 1.19 schema의 table/column/PK/FK allowlist를 검사한다. 관련 구조가 다르거나 알 수 없는 session 참조 table/column은 unsupported-schema다. 미검증 1.x에서도 신규 native 생성은 가능하지만 이관을 추측하지 않는다. JSON의 ID 관계·파싱 가능성을 검사하고 원본 문자열을 그대로 복사한다.

| 자원 | 지원·검사·미완료 결과 |
|---|---|
| session·message·part·todo | 요청 ID에서 부모 root까지 올라가 동일 project의 전체 descendant tree 수집. ID·parent·directory/path·timestamps·JSON·todo 순서 보존. 경로 소실·다른 project parent·순환·누락 FK는 구체적인 미완료 |
| event_sequence·event | tree aggregate의 sequence/event를 함께 복사해 seq·event ID·versioned type·JSON 보존. 비로컬 owner_id·sequence 충돌·다른 aggregate 참조는 미완료. JSON import는 사용하지 않음 |
| project·project_directory | target에 없으면 관련 행 복사. 이미 있으면 ID·실제 worktree·directory 의미가 같을 때 기존 metadata/settings를 보존하며 tree 추가. 다른 worktree·directory 의미는 충돌 |
| snapshot·step/patch/revert | 필요한 data/snapshot/<project ID>/<sha1(worktree)> Git 저장소 manifest 수집. target 없음 또는 byte 동일한 경우 copy-once/reuse. 다른 target Git 객체/index와 merge하지 않음. 누락·복사 중 변경·symlink/reparse·소실되거나 실제 worktree 밖을 가리키는 alternates는 미완료. 참조한 Git hash가 실제로 해석되는지도 확인 |
| 실제 cwd 파일·file:// 첨부 | 같은 실제 작업 폴더와 절대 경로의 파일 참조 유지·존재 확인. 파일을 native data로 이동하거나 복제하지 않음 |
| 잘린 출력·old data/state/cache/config 루트 참조 | metadata/output 본문의 구격리 절대 경로를 전수 탐지. tool-output 파일 복사만으로 내장 경로가 이전됐다고 보지 않음. 무손실 관계를 입증하지 못하면 tool-output-reference 등 종류별 미완료, 파일 없음은 missing-resource. 이런 참조 없는 일반 도구 기록은 지원 |
| workspace_id·session_input/context_epoch/session_message·remote share | 선택 tree의 비어 있지 않은 별도 workspace/queue/context·session_share/share_url은 정확한 table/resource를 표시한 미완료. 빈 상태는 지원 |
| project permission·전역 설정/인증/cache/log/bin | project permission이 없거나 target와 같으면 지원. 다른 승인 상태는 permission-conflict이며 native 권한을 바꾸지 않음. config/auth/account/credential/cache/log/bin은 세션 subtree로 복사하지 않음. native 설정·Orca 실행 오버라이드가 정본이고 세션이 구격리 전역 자원을 참조하면 해당 참조로 미완료 |

미완료는 자원 종류와 조치 가능한 이유를 표시하며 원문·키·전체 경로를 노출하지 않는다. 지원 불가 자원이 있는 세션에 plain-text export만 복사하고 성공으로 표시하지 않는다. 원본 유지와 명시 미완료를 전체 자원의 자동 이전 성공으로 보고하지 않는다.

### 두 저장소 쓰기·경합·종료 복구

source DB·target DB·리소스 파일·Orca sidecar는 하나의 transaction이 아니다. native session tree commit이 가시화 지점이며 리소스 준비 전에 session을 commit하지 않는다. migrator는 source/target별 process single-flight와 다음 순서를 소유한다.

1. 공통 활동 guard 뒤 경로·schema를 검사한다. 기존 factory의 WAL/FK/busy timeout을 사용하되 없는 source를 생성하지 않는다. source BEGIN IMMEDIATE로 writer를 막은 다음 target BEGIN IMMEDIATE를 획득한다. 실패는 busy이며 native 프로세스 종료·무한 재시도 없음. source 행은 쓰지 않는다.
2. 잠금 안에서 tree·manifest·target 충돌을 다시 수집한다. 관측된 unfinished assistant/running tool·pending input은 busy다. 같은 PK의 다른 row를 덮어쓰지 않는다. 완성된 native ID가 이미 있으면 상위 reader가 원본으로 읽으며 이관을 다시 실행하지 않는다.
3. target와 같은 volume의 전용 임시 디렉터리에 파일을 복사해 상대 경로·크기·SHA-256 manifest를 대조한다. source digest를 다시 읽어 변경을 감지한다. target snapshot이 없고 기존 다른 target session이 해당 project snapshot을 사용하지 않을 때만 rename으로 배치한다. rename 직전 target을 재확인하고 기존 디렉터리를 덮어쓰지 않는다. Windows fixture에서 기존 빈 target에도 EPERM이 발생하는 것을 확인했으며 구현 테스트가 잠근다. 동일 digest target은 재사용한다.
4. project/project_directory→session root/children→message→part/todo→event_sequence/event를 target transaction에 insert한다. FK·원본 행 equality·resource 참조를 검사하고 commit 전에 source manifest를 재확인한다. native 삭제 뒤 보존된 legacy를 재생성하지 않도록 tree의 각 ID/target digest에 pending sidecar를 먼저 기록한 후 target을 COMMIT한다. sidecar 기록 실패는 commit하지 않는다. 실패는 target ROLLBACK 및 source ROLLBACK으로 잠금만 해제하며 관측된 정상 rollback은 rolled-back으로 기록해 재시도를 허용한다.
5. target COMMIT 뒤 source 잠금을 풀고 독립 native API로 session/messages/children/todo와 필요한 snapshot을 재검증한다. 같은 ID/cwd를 common reader로 전달한다. sidecar에는 identity digest·stage만 원자적으로 저장하며 native 재조회가 완료의 권위다. committed marker가 있는데 native가 404면 missing이며 legacy를 재복사하지 않는다. pending marker와 native 404는 commit 여부를 확정할 수 없으므로 commit-state-unknown 미완료다. sidecar 실패 때문에 prompt/insert를 반복하지 않는다.

| 종료·실패 지점 | 관측·복구 |
|---|---|
| lock·임시 복사 전후 | DB row 미변경. 다음 요청에서 재수집. 자신이 만든 임시 경로만 정리 가능 |
| resource 배치 후 commit 전 | native session 없음. 배치 자원은 manifest와 남기며 다른 프로세스가 사용할 수 있어 임의 삭제하지 않음. 재실행은 byte 동일한 자원만 재사용, 다르면 resource-conflict |
| 일부 row insert 후 pending 기록 전 | SQLite rollback으로 tree 전체 미노출. 기존 target 행 불변. 자원은 앞 행의 orphan 규칙 |
| pending 기록 후 commit 전·후 종료 | native ID가 있으면 원본 조회. 없으면 commit-state-unknown 미완료로 자동 재이관하지 않음. 동일 프로세스에서 rollback 성공을 관측해 rolled-back marker를 쓴 경우만 재시도 허용 |
| commit 후 native 검증/committed sidecar 전 | 같은 native ID가 존재하므로 다시 native 조회. insert·ID 생성·본문 replay 없음. 검증 실패는 unavailable이며 source 보존 |
| committed marker 이후 native CLI에서 원본 삭제 | native 404는 missing. 보존된 legacy를 복사해 삭제를 되돌리지 않음. tree의 각 session ID에 동일 정책 적용 |
| copy 중 source 변경·다른 writer 경합 | digest/lock/PK로 busy 또는 구체적인 미완료. 외부 파일 쓰기는 DB lock만으로 멈추지 않으므로 전후 digest 검사로 관측된 변경을 검출하며 전역 FS snapshot은 주장하지 않음 |

성공 후에도 source DB·리소스를 삭제하지 않는다. 이후 native가 원본이며 옛 격리 프로세스의 추가 분기를 자동 병합하지 않는다. 이관기는 기존 프로세스를 종료하지 않는다. 이 제약은 지원 범위 안의 세션/tree/resource 실제 이전을 생략하는 근거가 아니다.

### 변경 모듈·seam

| 모듈 | 책임 |
|---|---|
| implementation.ts, v1/index.ts | cwd·legacy locator·DB factory 포트 조립 |
| v1/native-storage.ts, v1/server.ts | native env·CLI DB path·pool key·spawn cwd. catalog/complete/send/history 공유 |
| v1/native-history.ts, v1/adapter.ts, v1/channel.ts | 원본 조회·closed snapshot·ID 정규화·same-ID 확인·nativeMessageId |
| v1/legacy-storage-migration.ts 및 별도 schema/resource 순수 모듈 | schema/tree/manifest·transaction·copy/rename·복구. DB와 fs phase hook 주입; 순수부는 native DB import graph와 분리 |
| app/harnesses/opencode/module.ts | legacy 위치와 기존 infra DB factory 주입. native SQL 지식 없음 |
| 0265 common/history/app/renderer | result 보관·부가 정보 join·refresh·busy/live guard·목록 제외. 이 델타에서 정책 복제 안 함 |

### Delta V와 직접 검증

신규 테스트는 app/src/main/adapters/opencode/v1/__tests__/의 예정 좌표다. 실제 module/factory/adapter를 실행하고 외부 전송은 임시 native CLI/loopback 합성 모델로 대체한다. SQLite 통합은 설치 Electron ABI의 Electron Node 모드, 순수 Vitest는 DB import와 끊어진 seam을 사용한다. 설계 probe를 production integration PASS로 세지 않는다.

| 노드 / pair | 필요도 / production path | 직접 oracle |
|---|---|---|
| R39↔AT39 / VP-Δ15-01 NEW | REQUIRED / registry→server env/cwd→create→독립 CLI 재개 | opencode-native-storage.integration.test.ts: resumes the Orca-created session from native CLI roots — native DB·독립 export·같은 cwd/ID CLI 추가 입력. 기본/custom XDG·OPENCODE_DB·재시작 fixture |
| R40↔AT40 / VP-Δ15-02 NEW | REQUIRED / engine settings→native config→모델 | 같은 파일: keeps engine overrides without redirecting native storage — effective config·합성 endpoint 실제 model·global/project 파일 전후 bytes |
| R41↔AT41 / VP-Δ15-03 NEW | REQUIRED / legacy tree/manifest→transaction→native 재개 | legacy-storage-migration.integration.test.ts: preserves session identity, workdir and referenced resources — source 불변·ID/JSON/todo/journal/child 일치·Git 객체 읽기·재개 event seq 증가 |
| R42↔AT42 / VP-Δ15-04 NEW | REQUIRED / 충돌/실패 phase→재시작 | 같은 파일: rolls back partial rows and reuses only verified resource stages; reports the exact resource blocking migration without touching either original — source/기존 target 행·파일 digest·사유·중복 0 |
| SD-Δ15-01↔ST-Δ15-01 / VP-Δ15-05 NEW | REQUIRED / 생성/이관→종료→CLI 추가→Orca 재열기 | 위 integration과 0265 native-sync integration 연결. 독립 CLI가 같은 ID에 추가한 메시지를 snapshot으로 읽어 중복 없이 표시. 최종 표시 sink는 0265 소유 |
| AR-Δ15-01↔IT-Δ15-01 / VP-Δ15-06 NEW | REQUIRED / module→adapter→read/migrate→common result | native-history.integration.test.ts: reads native changes through the registered adapter without prompting — 실제 module/adapter/SDK/mapper의 body·ID/cwd/revision·prompt 0; 404와 접근 오류 구분 |
| MD-Δ15-01↔UT-Δ15-01 / VP-Δ15-07 NEW | REQUIRED / env/cwd→pool identity→spawn | native-storage.test.ts: preserves inherited native roots and separates runtime overrides — server startup 실제 child env/cwd·root별 pool 분리 |
| MD-Δ15-02↔UT-Δ15-02 / VP-Δ15-08 NEW | REQUIRED / schema/identity/manifest→판정 | legacy-storage-migration.test.ts: rejects conflicting identities and resumes only verified stages — schema/FK·PK·resource·탈출 링크·잘린 출력. transaction rollback은 R42 직접 통합 |
| MD-Δ15-03↔UT-Δ15-03 / VP-Δ15-09 NEW | REQUIRED / raw snapshot→closed/history ID | native-history.test.ts: defers changing or unfinished snapshots and preserves every source message identity — revision·assistant finish·tool·최신 user 연결·sourceIds/nativeMessageId. busy same-ID 새 입력은 실제 adapter 통합 |
| V1 VP-04/08/09·ΔV14 지속 채널 INHERITED | REGRESSION / 소유권·설정·prompt/승인·수신 | 기존 server.test의 isolates server configurations and only kills children returned by its spawn factory, adapter.persistent·catalog·settings·opencode-continuation |
| V1 전용 XDG assertion CHANGED | REQUIRED / server startup env | 기존 coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child의 전용 XDG assertion만 native 계승으로 대체. auth/합류/소유 child 유지. AC39/40·VP-Δ15-01/02/07로 대체 증거 이관 |

### §10 강제 지점 전수

| 자리 / 수 | 계약 edge / 실패 의미 | 직접 oracle |
|---|---|---|
| EP42a / 1 | module→v1 options: userData를 native root로 재사용 | native-storage integration registered module→독립 CLI DB 경로 |
| EP42b / 1 | env/cwd→pool key: 다른 root/cwd가 옛 서버 공유 | native-storage/server의 실제 spawn/pool 분리 |
| EP42c / 1 | pool→child: XDG 재주입·override 손실 | native-storage integration의 CLI·effective config/model·설정 bytes |
| EP42d~g / 4 | catalog→pool, complete→pool, send→pool, readHistory→pool: 한 호출만 격리 | native-storage integration에서 네 진입을 각각 실행해 실제 서버 DB·directory 관측. complete 임시 session 정리 회귀 |
| EP43a / 1 | legacy locator→schema/tree: 다른 DB/cwd·미지원 자원 | migration unit/integration 다중 후보·schema·ID/cwd·resource 사유 |
| EP43b / 1 | source lock→target lock/conflict: 원본·기존 target 훼손 | migration integration 경쟁 writer/busy·원본 equality·PK 충돌 |
| EP43c / 1 | manifest→copy/rename: 누락/다른 snapshot 성공 | migration integration Git hash·digest·기존 empty/nonempty target rename 실패·source 변경 |
| EP43d / 1 | tree/journal→transaction: 일부 성공·seq 소실 | migration integration insert phase 실패/종료→rollback·성공 후 CLI event seq |
| EP43e / 1 | commit→native 검증/sidecar: 재시작 replay·중복 | migration integration commit/sidecar 경계 종료·재실행 ID/행 수/prompt |
| EP44a / 1 | native API→mapper/snapshot: 미완료·ID 누락 | native-history tests/integration revision·busy·id/sourceIds·본문 |
| EP44b / 1 | readHistory/echo→0265: 원본/부가 join 누락 | registered native-history + 0265 native-sync의 actual result·nativeMessageId·join |
| EP44c / 1 | resume guard→same-ID prompt: 새 session/replay·busy 복구 불가 | native-history integration missing/unavailable/migration-required prompt 0·busy의 명시 입력 1개/동일 ID |
| EP45a / 1 | plan↔0265/ADR-009: 결정/소유권 drift | 문서 gate Decision↔AC↔pair↔EP·링크 재조회 |
| EP45b / 1 | plan↔INDEX·설계 commit | 문서 gate 상태 재조회·diff·설계 trailer |

제품 EP42 7 + EP43 5 + EP44 3 =15자리, 문서 EP45 2자리다. child env/API body·DB 행·file digest·native 재개를 직접 관측한다. phase 실패는 필수 실패 동작 oracle이며 추가 선택 mutation은 0이다. integration은 계약 edge의 양 끝을 함께 mock하지 않는다.

### 운영 gate와 READY 대조

현재는 설계이며 fixture 외 native DB·사용자 세션을 변경하지 않는다. 구현에서는 ABI 중립 typecheck·readonly lint·관련 비DB 회귀, Electron ABI의 DB migration integration, 임시 CLI/loopback fixture, build, error registry, 문서 inventory/links·diff·trailer를 수행한다. npm install/pretest/rebuild로 ABI를 바꾸지 않는다.

D-029→AC39, D-030→AC40, D-031→AC41/42, D-032→0265다. 미검증 자원은 구체적 미완료 조건으로 닫았고 실제 plain/tree/journal 이관·snapshot 지원·복구 경로를 확정했다. 모든 legacy 자원의 자동 이관을 주장하지 않는다. 기존 전용 경로·DB SSOT·이관 비범위의 대체 관계와 과거 구현 보고를 보존한다. ΔV15는 READY이며 구현·독립 검증과 기존 AC11 인수는 남아 있다.

## ΔV15 [구현자 기입] 설계 리뷰

D-029~032와 pending/committed marker 보완 설계를 구현했다. 새 서버는 native HOME/XDG/OPENCODE_DB를 계승하고 실제 cwd에서 실행한다. Orca provider 설정은 실행 환경의 `OPENCODE_CONFIG_CONTENT`로 유지한다. 저장 경로는 SDK 버전 문자열로 추정하지 않고 동일 실행 환경의 CLI `db path`에서 확인한다. `dataDirectory/opencode`는 이전 격리 자료를 찾는 locator로만 남겼다.

이관은 JSON export/import 대신 검증된 1.19 schema에서 session tree·message/part·todo·event journal을 transaction으로 옮긴다. 실제 CLI가 만든 격리 DB도 production migrator를 통과한 뒤 같은 ID로 terminal 입력을 이어 받았다. 미지원 schema/공유/별도 queue/context와 검증 불가 자원은 구체적인 미완료다. snapshot의 assistant worktree가 project worktree와 다르면 `snapshot-worktree`로 보류하며 다른 저장소를 성공으로 오인하지 않는다. 0265의 archive·재열기·목록 제외 계약은 중복 구현하지 않았다.

## ΔV15 [구현자 기입] 강제 지점 전수와 V-pair 자기확인

아래 `O/`는 `app/src/main/adapters/opencode/v1/`, `A/`는 `app/src/main/app/harnesses/opencode/`다. 예정 파일명을 기존 테스트 배치와 DAG에 맞춰 조정했다.

| 좌표 | 실제 직접 oracle |
|---|---|
| N1 | `A/native-storage.integration.test.ts: creates, migrates and reopens the same native ID with a terminal followup and unchanged native config` — 실제 module·CLI·SDK·합성 localhost 모델·production SQLite migrator. 기본/custom root, 재시작, catalog/complete/send/readHistory, global/project 설정 bytes, native ID, 이관 후 journal 동일성 및 CLI 추가 후 증가 |
| N2 | `O/legacy-storage-migration.integration.test.ts: preserves native rows/resources and rolls back interrupted writes without reinstalling SQLite` — 실제 infra SQLite factory/Electron ABI. parent/child/todo/journal 행 일치, source 불변, schema/cwd/다중 DB/active lock/PK 충돌, 일부 insert와 marker 실패, commit 직후 종료, native 삭제 보존, snapshot Git 객체·충돌·resource 배치 후 retry |
| N3 | `O/legacy-resources.test.ts`의 `rejects directory links and a snapshot lock before copying`, `refuses a source whose bytes changed since inventory`, `never replaces an existing empty target directory`, `retains same-workspace files and reports a missing referenced file` |
| N4 | `O/server.test.ts: separates native storage environments and working directories in the pool identity`, `coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child`; `O/native-storage.test.ts: preserves native storage paths while applying only runtime configuration`, `resolves relative XDG exactly against the spawned native working directory` |
| N5 | `O/native-history.test.ts: reads a stable native snapshot twice with the original ID and cwd and does not invoke migration`, `runs migration only after 404 and revalidates the migrated native session`, `wires the registered adapter to the installed SDK for read-only native requests with the selected environment` 및 403·초기/최종 ID/cwd·revision·busy 표 |
| N6 | 같은 파일의 `preserves native IDs, response grouping, normalized tools, question answers and immutable source data`, `keeps automatic-input provenance, skips ignored text, and preserves files, reasoning and compaction`, `retains a native user compaction marker`, `keeps partial content and completed tools when the assistant ends in a classified error` |
| N7 | `O/adapter.persistent.test.ts: subscribes once before initial and subsequent prompts`, `O/native-input.test.ts: preserves native synthetic parts and rejects own text, ignored and foreign inputs` — native ID와 queue UUID 분리 |
| C1 | 0265의 `features/history/writer.native-history.test.ts: binds native user and multiple assistant records to their local rows, excluding child IDs`, `features/history/native-history.db.test.ts: joins a user attachment only by its native ID and retains unmapped metadata without duplicate body text` — 실제 writer/DB/표시 join |
| C2 | 0265의 `app/native-history.test.ts: checks native %s before cold resume with the same prepared input`, `closes the real idle runtime and delivers the next input through a fresh same-ID resume` — native 부재·오류는 prompt 0, 존재가 증명된 busy는 명시 입력만 same ID로 재개 |

| §10 자리 | 닫은 지점 / 직접 관측 | 남긴 곳 |
|---|---|---|
| EP42a module→v1 | 1/1, N1의 실제 native DB 경로와 module 생성 | — |
| EP42b pool identity | 1/1, N4의 root/cwd별 실제 spawn 인자·pool 분리 | — |
| EP42c child env | 1/1, N1/N4의 native 경로·모델·설정 bytes | — |
| EP42d/e/f/g catalog/complete/send/readHistory | 4/4, N1에서 네 진입을 직접 실행. complete 임시 session 수 불변, CLI export·추가 메시지 관측 | — |
| EP43a locator/schema/tree | 1/1, N2의 다중 DB·schema·cwd·교차 session part 거부 | — |
| EP43b source/target lock·충돌 | 1/1, N2의 별도 connection lock·target PK·양 DB 전후 행 일치 | — |
| EP43c resource 준비·배치 | 1/1, N2의 실제 Git hash·snapshot 충돌·resource 배치 뒤 재시도, N3의 link/변경/빈 target 보존 | — |
| EP43d tree/journal transaction | 1/1, N2의 중간 insert rollback, N1의 실제 CLI 이관 journal 일치·추가 입력 후 증가 | — |
| EP43e commit/marker/native 확인 | 1/1, N2의 partial marker rollback 및 commit 이후 모호 상태, native 삭제 후 parent/child 재생성 0; N1의 native 재조회 | — |
| EP44a native snapshot/mapper | 1/1, N5/N6의 안정성·closed 판정·원본 ID/parts 보존 | — |
| EP44b 원본 ID→0265 join | 1/1, N7→C1의 실제 normalized event 및 writer/DB 기록 | — |
| EP44c guard→same-ID prompt | 1/1, N5의 404+legacy busy는 migration-required, C2의 cold resume 입력 차단/허용 | — |
| EP45a/b 문서·상태·trailer | 2/2, 문서 gate `current:true, links:[], prose:[]`; plan·INDEX의 `impl/IMPL_DONE`·검증자 대조 및 `git log -4 --format='%(trailers:only=true)'` 설계 trailer 확인 | — |

제품 자리 `7+5+3=15/15`, 문서 자리 `2/2`는 위 oracle의 자기보고다. 0265의 C1/C2를 인용하되 그 공통 분모를 다시 추가하지 않았다. 전수 검색은 `rg -n 'acquire\(|nativeOpenCodeEnvironment|XDG_|OPENCODE_DB|readHistory|nativeMessageId' app/src/main/adapters/opencode app/src/main/app/harnesses/opencode -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'`와 각 caller의 인자/반환을 대조했다. 검색 총계만으로 미분류 0을 주장하지 않는다.

VP-Δ15-01/02는 N1/N4, 03/04는 N1/N2/N3, 05는 N1과 0265 재열기 store/DB oracle, 06은 N1/N5, 07은 N4, 08은 N2/N3, 09는 N5/N6/C2로 추적하며 모두 SELF_PASS다. REQUIRED 자기확인 `9 SELF_PASS + 0 SELF_BLOCKED = 9`다. 최종 test-only fetch 주입 뒤 동일 native CLI integration도 102.17초에 통과했다. 운영 gate는 아래에 별도로 기록했고 독립 verify는 남아 있다.

## ΔV15 [구현자 기입] 이번 라운드 수정의 잠금

해당 없음 — 직접 oracle. schema를 갖춘 실제 SQLite·파일·Git 객체·CLI·SDK와 production adapter를 호출했다. phase hook은 실제 transaction/sidecar/copy 경계의 실패 후 원본과 target을 직접 관측한다. 선택 적대 증거 0 + 인용 변이 0 + 새 구조적 proxy 0 = 잠금 표 행 0이다. 기존 server 소유권/인증/1.x guard를 삭제하지 않았다.

## ΔV15 [구현자 기입] Product/UX 파생 검토

native GET 성공이 항상 우선이며 실패 중 404만 이관한다. 외부 CLI의 완료 응답을 재열기에서 보여 주지만 original snapshot을 LLM에 재전송하지 않는다. 읽기는 prompt를 호출하지 않는다. 원본 부재·접근 오류·이관 미완료는 0265의 보관 화면과 안내로 전달한다. `busy`는 native 존재 확인 뒤 갱신 보류에만 사용하고, 404 뒤 구격리 자료가 busy인 경우에는 resume를 허용하지 않는다. 지원하지 못하는 자원 때문에 세션 전체를 다른 ID로 복제하거나 성공으로 숨기지 않는다. Orca 목록 제거의 native 보존과 최종 화면 상태는 0265가 소유한다.

## ΔV15 [구현자 기입] 놓친 잠재 문제 + 대응

| 발견 | 대응 / 직접 관측 |
|---|---|
| legacy를 보존하면 native 삭제 뒤 다음 404가 원본을 되살릴 수 있음 | tree 각 ID에 pending/committed marker. committed+404는 missing, 모호 pending+404는 commit-state-unknown. N2의 parent/child 삭제 후 재생성 0 |
| 여러 marker 중 일부 기록 실패가 영구 pending을 남김 | pending 쓰기 전에 intent 기록, 관측된 rollback 후 rolled-back 저장. N2 partial marker 재시도 성공 |
| part FK만으로 session 일치가 보장되지 않음 | message/part/현재 event projection의 소속·JSON ID 검사. N2 foreign message 오염 0. 삭제된 과거 projection의 정상 event는 보존 |
| relative XDG 및 Git worktree snapshot이 native와 다를 수 있음 | native cwd 기준 resolve, 불일치 snapshot은 명시 미완료. N4/N2 직접 관측 |
| history에서 error가 부분 text/tool을 지우거나 user compaction이 누락됨 | mapper event 순서와 user part 보존을 수정. N6의 부분 응답/도구/compaction 결과 |
| 실제 CLI fixture가 stdin을 열어 두어 terminal run을 멈춤 | 테스트 helper에서 stdin 종료. 기존 Orca 서버가 살아 있는 채로 독립 CLI 추가 입력 성공; native 프로젝트 lock으로 판정하지 않음 |
| 테스트 fixture의 직접 global fetch가 production hygiene gate에 포함됨 | fixture를 명시 fetchImpl 포트로 바꾸고 integration test entry가 주입. 예외/alias 없이 no-node-fetch 회귀 통과 |

구격리 tool-output/config/cache 절대 참조, 별도 queue/context/share, snapshot worktree 불일치·충돌 등은 설계한 미완료 경로다. 원본을 유지하며 종류를 알리고, 이 범위를 무손실 자동 이전 완료로 보고하지 않는다. 같은 native DB를 동시에 수정하는 외부 프로세스에 대한 OS 전역 lock을 보장하지 않는다.

## ΔV15 [구현자 기입] 구현 보고

- 변경: native 환경/cwd·실제 DB path, readHistory/ID 운반, v1 전용 schema/resource/transaction 이관, registry의 기존 SQLite factory 주입. 공통 DB 및 renderer 정책은 0265 구현을 사용한다.
- 직접 검증: 최종 OpenCode와 no-node-fetch 전체 16파일129케이스 통과(7.14초). 실제 SQLite fixture는 9개 확인 그룹에서 source/target·marker·Git snapshot을 검증했고 resource 단위 4케이스도 포함된다. source schema는 임시 native 1.19 CLI에서 취득한 빈 table 정의이며 사용자 데이터가 아니다.
- 실제 CLI 통합: native 생성/CLI 재개/재시작/구격리 이관/journal/설정/catalog/auxiliary/custom DB 전 경로를 통과했다. 합성 localhost 모델만 사용하고 외부 모델 요청은 0이다. test-only fetch 주입 이후 마지막 단독 integration은 1파일1케이스, 102.17초에 통과했다. 재현은 앱 폴더에서 `ORCA_TEST_OPENCODE_EXE`를 검증할 설치 CLI 1.x 절대 경로로 지정한 뒤 `node node_modules/vitest/vitest.mjs run src/main/app/harnesses/opencode/native-storage.integration.test.ts --maxWorkers=1 --pool=threads`다. CLI 환경 변수가 없는 일반 CI에서는 이 외부 실행 케이스만 명시 skip하고 순수/SQLite fixture는 실행한다.
- 운영 gate: 최종 변경 TS/TSX 91파일 ESLint 0 errors/0 warnings, typecheck 3구성·build·migration·문서 gate 통과. 전체 Node 실행에서 발견한 strict native ID 기대값 11건과 global fetch 경계 1건은 수정 후 재검증했고, ABI 때문에 별도 실행한 39파일377케이스는 설치 Electron ABI에서 모두 통과했다. 상세 실행·환경 분류는 0265 구현 보고 G01~G13을 참조한다. npm install/pretest/rebuild와 사용자 DB 수정은 하지 않았다.
- AC 자기보고: AC39(native 생성/터미널 재개), AC40(실행 오버라이드/설정 불변), AC41(실제 legacy 이관·재개), AC42(실패·충돌·복구 원본 보존)는 각각 N1, N1/N4, N1/N2, N2/N3의 직접 결과로 4/4다. 제품 강제 지점 15/15 및 신규 pair 9 SELF_PASS와 구분해 집계한다. ΔV14의 37/38 자기보고와 기존 AC11 사람 인수 대기는 유지하며 과거 실적을 새 AC 증거로 재사용하지 않는다. 독립 verify는 남아 있다.

| 신규 AC | 자기보고 | 직접 관측 |
|---|---|---|
| AC39 | ✅ | N1: native 생성·독립 CLI의 같은 ID 추가 입력·재시작 후 조회 |
| AC40 | ✅ | N1/N4: 준비 env 전달과 native 설정 파일 bytes 불변 |
| AC41 | ✅ | N1/N2: 실제 legacy DB 이관 후 CLI 재개, journal seq 유지·증가 |
| AC42 | ✅ | N2/N3: 충돌·중간 실패·재시도에서 source 보존, target 중복·삭제 후 부활 방지 |

이번 ΔV15 검산: `✅ 4 · ⚠️ 0 · ❌ 0 = 총 4`. 구현 trailer의 `Criteria-Met: 4/4`는 신규 AC39~42를 가리킨다. 기준 ΔV14의 AC11 사람 인수는 별도 대기로 유지한다.

## ΔV15 [구현자 기입] Review Signals

사용자 저장 정책 변경을 받아 진행한 ΔV15 구현 턴이다. 기존 전용 XDG 결정은 최신 D-029로 대체했고, 설계 probe를 production oracle로 세지 않았다. 실제 이관을 테스트하면서 marker 일부 실패·교차 session FK·snapshot worktree·history partial error를 보완했다. 설치 Electron SQLite ABI를 유지한 채 runtime을 선택했으며 의존성 재설치는 없었다. 전체 gate와 함께 여러 CLI/tsc가 실행된 시도에서는 15초 서버 시작 제한과 buildinfo 파일 경쟁이 발생해 단독 CLI·별도 typecheck output으로 분리했다. 이는 제품 시작 제한을 없애는 근거로 쓰지 않았다. 다음 판정은 독립 verify다.

## ΔV16 — lazy 읽기 커서와 재시작 하네스 복원 (2026-10-16, READY)

### Part I — 요구 배분과 Decision

사용자는 DB transcript를 먼저 표시한 뒤 원본 추가 이력을 lazy로 가져오고 세션마다 읽은 offset을 추적하도록 요구했다. 또한 “opencode로 종료한 세션인데 composer(하네스)가 claude”이고 전송 시 “입력 검증 오류”가 발생한다고 보고했다. 공통 2단 로딩·cursor 저장·응답 경합은 [0265 ΔV1](../0265-harness-native-storage/plan.md)이 소유하며, 이 델타는 OpenCode 1.x 원본 cursor와 잠긴 세션의 복원 결과를 검증한다.

| ID | 결정 | 상태 / 관계 |
|---|---|---|
| D-033 | OpenCode 세션은 재시작/nav 진입에서도 저장된 backend로 composer·transcript·패널·다음 전송을 복원한다. 미확정 로딩 단계의 기본 Claude 선택은 세션 정체성이 아님 | ACTIVE / D-002 보완. 생성 후 하네스 변경 금지 유지 |
| D-034 | session 표시의 native 조회는 DB 첫 표시 뒤 lazy로 실행하고 prompt/resume를 만들지 않는다 | ACTIVE / 0265 D08/09 참조. OpenCode 서버 지연을 첫 표시에서 분리 |
| D-035 | native SQLite의 per-session sequence와 projection digest를 OpenCode 1.x checkpoint로 사용한다 | ACTIVE / 0265 D12와 같은 결정. 별도 JSONL 없음 |

**제품 결과**: DB가 OpenCode라고 기록한 세션은 전역 default/lastBackend 및 Claude 카탈로그의 도착 순서와 관계없이 OpenCode로 열린다. 호환 엔진이 없으면 OpenCode를 유지하며 모델 선택 불가를 알리고, Claude로 대체하지 않는다. 실제 대화 재개는 사용자의 명시적 입력 이후에만 일어난다.

| AC / node | 관측 기준 | 직접 oracle 예정 |
|---|---|---|
| AC43 / R43↔AT43 NEW | cold boot/nav의 DB 로딩 중 Claude default가 먼저 도착해도 저장 OpenCode backend가 복원되며, 다음 전송은 동일 OpenCode ID/backend로 전달된다 | 실제 store deferred load + 실제 Composer hydration + send.harness: 기존 `.tmp/native-load-repro.test.ts`의 실패 순서를 영구 회귀 테스트로 이관 |
| AC44 / R44↔AT44 NEW | OpenCode 원본의 추가 user/assistant/tool·기존 part 수정/삭제·revert를 감지하고 읽은 위치를 세션별로 확정한다. 확인 중/실패 시 cursor를 앞당기지 않는다 | 실제 native SQLite/SDK fixture: 이전 checkpoint→각 native 변경→동기화, 반복 조회 no-op·오류 rollback. 모델 prompt0 |
| AC45 / R45↔AT45 NEW | native 서버/조회가 느리거나 실패해도 DB 첫 표시와 OpenCode composer가 먼저 준비된다 | 공통 load/refresh 등록 handler + store의 지연 OpenCode read: 첫 화면 표시 후 native 호출·실패 안내, 본문/하네스 유지 |

신규 AC는 3개이고 기준 ΔV15의 4/4 자기보고 또는 AC11 사람 인수와 합산해 완료 처리하지 않는다. native 원본 경로·엔진 오버라이드·legacy 보존 이관은 계속 유지한다.

### Part II — 실측과 구현 경계

원인은 현재 `chatStore.loadSession`의 엔트리 객체 동일성 검사다. `START_LOAD_SESSION`은 backend=null로 시작하고, `Composer` hydration이 `SET_MODEL(claude)`로 객체를 바꾸면 뒤늦게 도착한 OpenCode DB 응답이 버려진다. 실제 store 재현 2케이스 중 대조군은 통과했고 hydration 개입 케이스는 `expected opencode, received claude`로 실패했다.

DB insert/SELECT/LoadedSession에는 backend가 이미 존재한다. 사용자 데이터의 backend를 추측해 일괄 UPDATE하거나 `ses_` 접두사만으로 하네스를 바꾸지 않는다. 공통 store의 조회 token·본문 세대 분리, loading 중 모델 선택/전송 보류, 저장 정체성의 authoritative 복원은 0265에서 구현한다.

**OpenCode 커서 확정안**

- 1.19 native 원본은 SQLite다. `legacy-schema.testfixture.ts`의 실제 CLI 스키마에 `event_sequence(aggregate_id, seq)`·`event(aggregate_id, seq)`·message/part projection이 존재한다. SDK의 `/v2/client` import가 저장 포맷을 JSONL로 만드는 것은 아니다.
- `opencode/v1/`만 checkpoint 형식을 해석한다. sourceKey는 실제 native DB identity, checkpoint는 검증된 per-session sequence/revision이며 공통 코드가 SQL table이나 seq 의미에 의존하지 않는다. 기존 준비 env·cwd·CLI `db path`와 같은 원본을 사용한다.
- readonly cursor probe와 SDK snapshot 사이의 sequence/revision을 앞뒤로 확인한다. 동일 위치면 messages 전문 조회·Orca snapshot/FTS 교체를 건너뛰고, 달라지면 안정된 native snapshot을 읽어 기존 mapper로 정규화한다. 원본이 쓰는 event의 축적 수를 UI 메시지 수로 간주하지 않는다.
- 읽기 checkpoint는 session별로만 비교하고 파일 mtime/WAL 크기만으로 대신하지 않는다. sequence 단독 fast path는 사용하지 않는다. readonly transaction에서 session/message/part projection 전체 digest를 함께 비교하여 part 갱신·삭제·revert를 검출한다. 지원하지 않는 schema는 SDK revision으로 안전하게 확인한다. SQL 읽기는 O(N)이지만 변경 없는 경우 SDK 전문 조회와 mapper/FTS 교체를 생략한다.
- SQLite read는 기존 infra factory를 readonly/fileMustExist로 주입하고 schema initialize·migration·쓰기 PRAGMA를 수행하지 않는 경계를 확인한다. 필요한 readonly factory 보완도 실제 원본 바이트/SQL write0 테스트로 잠근다. 하네스 버전별 SQL을 공통 infra로 이동하지 않는다.
- busy/원본 부재/다른 cwd/읽기 오류와 legacy 이관 조건은 ΔV15 계약을 유지한다. lazy 조회 자체가 session.create/prompt/resume를 호출하지 않으며, 원본 존재 확인을 위한 명시 전송 경로와 분리한다.

### Delta V / §10 강제 지점

R43~45/AT43~45, SD-Δ16/AR-Δ16/MD-Δ16은 NEW다. D-002의 기존 하네스 잠금과 ΔV15 native 조회 계약은 INHERITED/REGRESSION이며, 0265의 공통 구현 자리와 이 문서의 OpenCode adapter 자리를 중복 합산하지 않는다.

| Pair | requiredness / production path | 자리·직접 oracle 예정 |
|---|---|---|
| VP-Δ16-01 R43↔AT43 | REQUIRED / DB backend→실제 store/Composer→전송→stored adapter | 공통 EP18a~d; `chatStore.native-history.test.ts` cold load 동안 hydration, Composer hook 실행, `send.harness.test.ts` 동일 ID/backend |
| VP-Δ16-02 R44↔AT44 | REQUIRED / native checkpoint→stable read→공통 cursor commit | EP46a~e; 신규 `opencode/v1/native-cursor.test.ts`와 실제 SQLite integration, 공통 native-history DB 테스트 |
| VP-Δ16-03 R45↔AT45 | REQUIRED / DB 화면→lazy OpenCode 지연/오류 | 공통 EP14/15/19; 실제 handler와 store deferred native 응답, body/backend·호출순서 |
| VP-Δ16-04 SD-Δ16↔ST-Δ16 | REQUIRED / 재시작→DB→외부 추가→lazy→명시 재개 | OpenCode CLI synthetic fixture+공통 store/handler 연결: 각각 native ID·checkpoint·화면 DTO·prompt 호출 구분 |
| VP-Δ16-05 AR-Δ16↔IT-Δ16 | REQUIRED / 준비 native env→readonly DB/SDK→공통 포트 | EP46a/b/c/d; 실제 module 등록과 readonly 연결, SDK 인자/파일 불변 |
| VP-Δ16-06 MD-Δ16↔UT-Δ16 | REQUIRED / sequence/revision→unchanged/updated/busy | EP46b/c/d/e; append·기존 part update/delete·revert·원본 교체·부분 실패 fixture |
| VP-Δ16-R1 | REGRESSION / ΔV15 VP01~09, D-002 저장 하네스 잠금 | native-storage/history·legacy migration·send.harness 기존 직접 회귀. 재수입이 모델 입력을 재전송하지 않음 |

| 자리 | 실패 의미 | 직접 oracle |
|---|---|---|
| EP46a module→v1 native locator (1) | 모델 조회·이력 probe가 다른 native DB 사용 | 실제 module + custom env/cwd fixture의 같은 DB 경로 |
| EP46b readonly open/schema (1) | cursor 확인이 원본을 쓰거나 다른 버전 schema를 오독 | 실제 SQLite readonly connection·지원/비지원 schema·전후 바이트 |
| EP46c session checkpoint probe (1) | 다른 세션 변경을 가져오거나 part 수정/삭제를 놓침 | 실제 native mutation fixture 각각의 seq/revision 관측 |
| EP46d probe→SDK snapshot→probe (1) | 서로 다른 시점의 snapshot과 offset 결합 | read 중 변경 fixture: busy·기존 cursor 유지 |
| EP46e adapter 결과→공통 commit (1) | 읽기만 했는데 offset 저장·재시작 누락 | 공통 real DB commit/rollback와 OpenCode result를 연결 |

OpenCode 내부 신규 자리 5곳과 공통 0265의 재사용 자리는 구별한다. 직접 행동 oracle를 예정하며 구조적 proxy/새 전수 장치를 만들지 않아 선택 mutation은 not selected다.

### READY 판정과 운영 gate

D-033→AC43, D-034→AC45, D-035→AC44로 연결된다. 0265 D12의 원본 형식별 커서와 projection digest 검증을 확정하여 READY다. sequence에 모든 변이가 기록된다는 가정은 두지 않는다. 구현은 기존 native 환경·엔진 override·Claude GUI 계약을 유지하며 node/web/test typecheck·readonly lint·IPC/DB/renderer 회귀·실제 CLI fixture·문서/빌드 gate로 확인한다.
