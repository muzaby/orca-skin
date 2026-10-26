# Plan — Composer 프로젝트 선택과 OpenCode 에이전트 메뉴

## 메타

| 항목 | 값 |
|---|---|
| slug | `0287-composer-project-agent-picker` |
| 작성자 | Codex — 사용자 명시 `Handoff-plan` 요청 |
| 일자 | 2026-10-26 |
| 상태 | READY — 설계만 작성, 구현 전 |
| V mode / 기준 V | Baseline V / none |
| 이번 revision / 유효 V | V1 / V1 |
| 조사 기준 | 공유 브랜치 `main`, `528a1588` — `git pull --ff-only`: Already up to date |
| 관련 작업 | 0285의 현재 구현을 조사했으며 그 작업의 미완료 검증을 대체하지 않는다. 이번 요청은 별도 Baseline V다. |

# Part I — Product & UX Contract

## 1. Context / 목표

새 대화에서 저장된 폴더 프로젝트를 검색·선택하고, OpenCode의 선택된 에이전트를 버튼에서 바로 확인한다. 메뉴 폭과 진행 표시는 내용에 맞추며, Orca가 시작하는 OpenCode 서버는 파일 snapshot을 생성하지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 | “Opencode 서버 생성시 snapshot 옵션을 false로 설정할 것.” | 최초 요청 |
| 명시 | “기본 텍스트를 '에이전트'로 표시하지 말 것. 에이전트목록에서 항상 첫 번째 값으로 디폴트 설정할 것” | 최초 요청 |
| 명시 | “너비는 가변적이며 '에이전트 이름' + '선택됨 체크' 표시 배치를 표시할 정도로만.” | 최초 요청 |
| 명시 | “Spinner 표시를 에이전트 타이틀 바로 우측에 배치할 것.우측정렬이 아님.” / “화살표 없는 회전 스피너” | 최초 요청 |
| 명시 | 새 대화 프로젝트 버튼 → 프로젝트 검색·목록·추가 팝업. 추가 버튼 → 폴더 선택 모달. Claude에도 같은 동작. | 최초 요청 |
| 명시 | 항목 왼쪽은 Nav 프로젝트와 같은 폴더 SVG. | 최초 요청과 [참고 이미지](reference-project-picker.jpg) |
| 확정 | “현재처럼 첫 메시지 전송 시 등록” | 등록 시점 질의에 대한 사용자 답변 |
| 맥락 | “폴더 선택 자체가 프로젝트로 자동 등록되고, 프로젝트 제거 시, 각 세션은 개별 항목으로만 존재” | 후속 사용자 설명. 등록 **시점**은 바로 앞의 명시 답변을 유지한다. |
| 설계 해석 | 기본값은 미선택·선택 소멸 시 첫 유효 항목이다. 사용자가 고른 유효 항목은 재열기 때 유지한다. | ‘디폴트’와 기존 선택 기능을 함께 만족 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 |
|---|---|---|---|---|---|
| D-001 | 서버 실행 설정의 `snapshot`을 boolean `false`로 강제한다. | 설정 미지정·true에도 동일 | 최초 요청 | ACTIVE | — |
| D-002 | authoritative 목록의 첫 번째 에이전트를 실제 기본 선택값으로 저장한다. | 유효한 수동 선택은 보존. 정렬·고정 이름 추정 금지 | 최초 요청 + §2 해석 | ACTIVE | — |
| D-003 | 에이전트 메뉴는 이름·체크·표준 여백에 맞는 가변 폭이다. | viewport 상한에서만 말줄임 | 최초 요청 | ACTIVE | — |
| D-004 | 로딩 스피너는 제목 바로 뒤이며 화살표 없는 회전 원호다. | 모델 로딩과 에이전트 로딩 분리 유지 | 최초 요청 | ACTIVE | — |
| D-005 | `/new`의 프로젝트 버튼은 검색·목록·추가 팝업을 연다. | OpenCode·Claude 양쪽; 입력/컨텍스트의 기존 위치 유지 | 최초 요청 | ACTIVE | — |
| D-006 | 프로젝트 행 왼쪽은 Nav와 같은 `Icon name="folder"`다. | 이니셜 배지 대신 폴더 SVG | 최초 요청/이미지 | ACTIVE | — |
| D-007 | 추가 폴더는 현재 초안에만 적용하고 첫 전송 때 등록한다. | 폴더 모달 취소는 무변경; 즉시 create IPC 금지 | 사용자 질의 답변 | ACTIVE | — |
| D-008 | 이번 목록은 폴더 기반 프로젝트이며 제거 시 세션 분리 동작을 유지한다. | `cwd:null`인 과거 이름 전용 프로젝트는 이번 선택 목록 대상 밖; 삭제·마이그레이션하지 않음 | 사용자 후속 설명의 범위 해석 + 현재 타입 | ACTIVE | — |
| D-009 | 선택은 현재 초안의 cwd·pendingProjectId에만 적용한다. | 본문·첨부·하네스 유지; 시작된 세션과 다른 초안에 적용 금지 | 기존 랜딩 계약 보존 | ACTIVE | — |

### 갱신 메모

이번 턴에 D-001~009를 추가했다. OPEN·SUPERSEDED는 없다. `ACTIVE 결정 ↔ AC` 대조: D-001→AC1~2, D-002→AC3~5, D-003~004→AC6~7, D-005~006→AC8~10·15, D-007~009→AC11~14·16으로 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 / 근거 |
|---|---|
| 실제 원인인가 | 일치. `Controls.tsx`의 `w-[300px]`, `value || label`, `MenuTitle.trailing`의 `ml-auto`, `Icon refresh`가 각 증상을 만든다. |
| 이미 되는가 | 미충족. `CwdButton.handleClick`은 미확정 대화에서 `pickDirectory`를 바로 호출한다. |
| 기존 경로 재사용 | 프로젝트 목록은 `projectsStore`, 폴더 선택은 `fileApi.pickDirectory`, 등록은 `bindStartingProject`를 재사용한다. 신규 IPC·DB 스키마는 필요 없다. |
| snapshot 의미 | 파일 변경 복구용 OpenCode 옵션이다. Orca 이력 snapshot·DB 백업·Git diff와 다른 개념이다. SDK `Config.snapshot?: boolean`과 공식 1.x 문서가 일치한다. |
| 기존 작업과 충돌 | 0285의 마지막 cwd·공통 랜딩·초안 유지 계약을 유지한다. 프로젝트 제거 동작과 프로젝트 상세 화면은 이번 변경에 포함하지 않는다. |

사용자에게 확인한 등록 시점은 D-007로 확정했다. 과거 이름 전용 프로젝트 질의는 이번 폴더 기반 UI 범위와 구분하고 D-008에 해석을 명시했다.

## 5. 동작 / 사용자 흐름

```text
OpenCode 서버 시작 → 실행 환경에 snapshot:false → serve 실행
에이전트 목록 도착 → 유효 선택 유지 또는 첫 항목 저장 → 버튼 이름·선택 체크·전송값 일치
/new 프로젝트 버튼 → 검색 입력 + 프로젝트 행 + 구분선 + 프로젝트 추가
  기존 행 선택 → 같은 초안의 cwd/projectId 변경 → 메뉴 닫힘
  프로젝트 추가 → 폴더 선택 → 초안 cwd 변경 → 첫 전송의 기존 경로로 등록/재사용
```

| 상태/이벤트 | 동작 / 결과 |
|---|---|
| 에이전트 미선택 + 목록 ready/nonempty | 서버가 반환한 표시 가능 목록 순서의 첫 항목. 버튼·체크·store가 같은 이름이다. |
| 선택 유효 + 재조회/재열기 | 선택 유지. 첫 항목으로 사용자의 선택을 되돌리지 않는다. |
| 선택이 authoritative 목록에서 사라짐 | 첫 항목으로 대체하고 기존의 무효 에이전트 variant 초기화 의미를 유지한다. 빈 목록이면 선택을 비운다. |
| 에이전트 loading/error/empty | 알려진 선택은 loading/error에서 보존. 이름이 없으면 각각 ‘불러오는 중…’/‘불러오기 실패’/‘에이전트 없음’; 버튼 기본값으로 ‘에이전트’를 쓰지 않는다. 팝업 **제목과 접근성 이름**은 ‘에이전트’를 유지한다. |
| 프로젝트 메뉴 열기 | 검색에 초점. 목록 순서는 기존 projects catalog 순서. 현재 cwd와 같은 경로에 체크, 선택 강조. |
| 검색 | 이름·전체 경로의 공백 trim/대소문자 무시 부분 일치. 목록만 필터하며 추가 버튼은 항상 남긴다. 동일 이름의 다른 경로는 별도 행, 전체 경로는 tooltip로 구별한다. |
| 목록 loading/empty | 로딩 상태 / ‘등록된 프로젝트가 없습니다’ 또는 ‘검색 결과가 없습니다’를 구별한다. 추가 버튼은 사용 가능하다. |
| 기존 프로젝트 선택 | 해당 행의 ID·cwd를 함께 적용. 이름은 프로젝트명으로 표시하고 경로는 tooltip에 둔다. 동일 선택 재선택은 초안 컨텍스트를 지우지 않는다. |
| 폴더 추가 성공 | 이미 등록된 경로이면 그 ID를 선택. 새 경로이면 pendingProjectId를 null로 두고 폴더명 표시; 가짜 영속 행을 추가하지 않는다. |
| 폴더 추가 취소·실패·루트 거절 | 취소는 무변경. 오류는 기존 `reportError` 또는 기존 root 거절 표면. cwd·ID·lastCwd를 일부만 변경하지 않는다. |
| 선택 중 다른 초안/세션으로 이동·전송·unmount | 지각 결과 폐기. 같은 `__new__` 키로 새 초안이 생겨도 이전 선택 결과를 적용하지 않는다. |
| 닫기·키보드 | Enter/Space/ArrowDown으로 열기, 검색→행 방향키 이동, Enter/Space 선택, Escape/바깥 클릭 닫기. Escape·선택은 trigger로 복귀, Tab은 자연스럽게 다음 컨트롤로 이동. |

닫을 때 검색어를 초기화한다. 메뉴를 닫아도 native 폴더 선택 결과는 대상 초안이 여전히 유효하면 적용하며, 중복 모달은 열지 않는다. white/dark·긴 이름·좁은 창·reduced motion을 확인한다.

## 6. 범위 / 비범위

**범위**: OpenCode 서버 실행 환경, OpenCode composer 에이전트 선택/메뉴, `/new`의 양 하네스 프로젝트 메뉴, 필요한 초안 상태·문서·테스트.

**비범위**: 프로젝트 상세 랜딩의 기존 버튼, 시작된 세션의 탐색기 열기, 참조 폴더 `+`, 프로젝트 제거 정책, 과거 프로젝트 변환, OpenCode variant 메뉴의 기본값/폭 변경, 전역 spinner artwork 교체. 서버 설정은 다음 새 서버부터 적용하며 실행 중인 서버 강제 종료는 하지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 | production 경로 |
|---|---|---|---|---|
| R-S | AT-S / AC1 | 미지정·true·false 입력 모두 새 서버 spawn 환경의 snapshot이 boolean false다. | O-S1·S2: 실제 환경 JSON 파싱 | profile → manager → spawn |
| R-S | AT-S / AC2 | share 비활성·model/provider·XDG/DB 경로·인증과 서버 공유/해제 의미를 유지한다. | O-S1·S2·S3와 기존 server 테스트 | native env → profile → serve/db path |
| R-A | AT-A / AC3 | 미선택 상태에서 `[z-first,a-second]`가 도착하면 z-first가 표시·체크·store·첫 전송값이다. | O-A1·A2·A3 | catalog → controls → store → send |
| R-A | AT-A / AC4 | 수동 a-second 선택은 재열기/캐시 갱신에 유지. 소멸하면 첫 항목, 빈 목록이면 선택 없음이다. | O-A1·A2·A3 | authoritative 목록 → 선택 reconciliation |
| R-A | AT-A / AC5 | loading/error/empty에서 ‘에이전트’ 기본 표시가 없고, 모델 로딩은 에이전트 spinner를 켜지 않는다. | O-A2 + 실제 렌더 | catalog의 agents/models 독립 슬롯 |
| R-A | AT-A / AC6 | 짧은 이름 메뉴는 내용에 맞게 좁아지고, 긴 이름에서 체크가 잘리지 않는다. | O-A4 실제 Chromium 레이아웃 | Popover → 이름/체크 행 |
| R-A | AT-A / AC7 | 로딩 원호는 제목 바로 뒤에 놓이고 화살표가 없다. 회전하며 reduced motion에서는 멈춘다. | O-A4 + O-A2 SVG/제목 구조 | heading → inline spinner |
| R-P | AT-P / AC8 | 두 하네스 `/new` 버튼이 팝업을 열며, 열기만으로 폴더 모달을 호출하지 않는다. | O-P3: 양 하네스 실제 page 조립 | NewChatLandingPage → CwdPanel |
| R-P | AT-P / AC9 | 폴더 기반 목록의 이름/경로 검색·선택 체크·선택 강조와 Nav 폴더 SVG가 동작한다. | O-P1·P2·P3 | catalog props → filter → rows |
| R-P | AT-P / AC10 | 기존 행 선택이 cwd·pendingProjectId를 함께 바꾸고 초안·첨부·하네스를 보존한다. | O-P2·P3·P4 | row → action → reducer |
| R-P | AT-P / AC11 | 추가 버튼만 폴더 모달을 열고, 선택 후 첫 전송 전에는 create 호출/목록 삽입이 없다. | O-P2·P3·P4: API 호출과 목록 변화 관측 | add → native dialog → pending selection |
| R-P | AT-P / AC12 | 첫 전송은 선택된 원본 cwd·ID를 전달하고 기존 Main 경로로 프로젝트를 등록/재사용한다. | O-P4·P5·P6 | send → binding → event → catalog sync |
| R-P | AT-P / AC13 | 취소·루트 거절·다른 초안·전송·unmount 후 응답이 잘못된 cwd/ID/설정 쓰기를 만들지 않는다. | O-P2·P4 deferred promise | dialog → draft target fence |
| R-P | AT-P / AC14 | 경로 변경 시 기존 Git/참조 경로 초기화와 lastCwd 저장을 유지한다. 설정 저장 실패는 선택을 되돌리지 않고 보고한다. | O-P4 + 기존 lastCwd/reducer 테스트 | selection → SET_CWD → settings |
| R-P | AT-P / AC15 | 검색·선택·닫기·초점 복귀가 키보드로 가능하고 white/dark·좁은 폭에서 메뉴가 잘리지 않는다. | O-P2·P3·P7 | trigger → Popover → search/rows/footer |
| R-P | AT-P / AC16 | 프로젝트 제거 후 세션 본문·cwd 보존과 미분류 처리를 유지하며, 이번 선택은 삭제된 프로젝트를 다시 등록하지 않는다. | O-P1·P4·P6, 기존 삭제 동기화 테스트 | live catalog → 선택 guard / 기존 삭제 경로 |

O-*는 §11의 직접 oracle 좌표다. 시각 항목 AC6·7·15의 실제 배치/회전만 실기에 남기며 검색·선택·전송·race 로직은 기계 테스트로 닫는다.

## 7-A. V / Trace Matrix

Baseline V1을 새로 정의한다. 기존 handoff의 V를 상속하거나 대체하지 않으므로 inherited/superseded pair는 없다. 기존 경로 보존도 이번 Baseline 계약과 REQUIRED 증거에 포함한다.

### Node registry

| 좌/우 node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-S / AT-S | R / AT | AC1~2 | NEW / NEW |
| R-A / AT-A | R / AT | AC3~7 | NEW / NEW |
| R-P / AT-P | R / AT | AC8~16 | NEW / NEW |
| SD-S / ST-S | SD / ST | 서버 생성·재생성의 설정 적용 | NEW / NEW |
| SD-A / ST-A | SD / ST | 목록 도착부터 선택·전송까지 | NEW / NEW |
| SD-P / ST-P | SD / ST | 메뉴·폴더 모달·초안·첫 전송·등록 | NEW / NEW |
| AR-S / IT-S | AR / IT | 환경 builder→profile→spawn/db 경계 | NEW / NEW |
| AR-A / IT-A | AR / IT | catalog→controls→store→IPC 및 메뉴 primitive | NEW / NEW |
| AR-P / IT-P | AR / IT | projects→page→chat UI→store, 기존 Main/이벤트 | NEW / NEW |
| MD-S / UT-S | MD / UT | 환경 직렬화 우선순위 | NEW / NEW |
| MD-A / UT-A | MD / UT | authoritative 기본 선택 정책 | NEW / NEW |
| MD-P / UT-P | MD / UT | 검색·경로 동일성·대상 fence·초안 원자 갱신 | NEW / NEW |

### Pair registry

모든 pair는 REQUIRED다. 강제 자리의 정본은 §10이며 같은 자리를 여러 수준의 증거가 함께 닫는다.

| Pair | left ↔ right | production path | 직접 oracle | 선택 적대 증거 | §10 자리 |
|---|---|---|---|---|---|
| VP-01 | MD-S ↔ UT-S | config/env → nativeOpenCodeEnvironment → JSON | O-S1 | 불필요: 출력 boolean 직접 단언 | S1 (1) |
| VP-02 | AR-S ↔ IT-S | builder → profile → manager → spawn/db | O-S2·S3 | 불필요: 실제 spawn/exec env 관측 | S1~S5 (5) |
| VP-03 | SD-S ↔ ST-S | acquire → 시작/공유/해제 → 새 child | O-S2, 기존 server ownership 케이스 | 불필요: child별 옵션·생존 관측 | S1~S5 (5) |
| VP-04 | R-S ↔ AT-S | AC1~2의 서버 경로 | O-S1~S3 조합 | VP-01~03과 동일 | S1~S5 (5) |
| VP-05 | MD-A ↔ UT-A | 목록·selected·status → effective agent | O-A1 | 불필요: 순서가 뒤집힌 fixture 직접 단언 | A2 (1) |
| VP-06 | AR-A ↔ IT-A | catalog snapshot → controls → store → send; Popover 행 | O-A2·A3·A4 | M-A1: A1에서 agents/models 로딩 슬롯 맞바꿈 | A1~A10 (10) |
| VP-07 | SD-A ↔ ST-A | 비동기 목록 → 자동/수동 선택 → 신규/후속 전송 | O-A2·A3 | VP-06 선택 증거 재사용 | A1~A7 (7) |
| VP-08 | R-A ↔ AT-A | AC3~7의 선택/표시/전송 | O-A1~A4 조합 | VP-06 선택 증거 재사용 | A1~A10 (10) |
| VP-09 | MD-P ↔ UT-P | catalog/query/cwd → rows; target → 적용 허용 | O-P1·P4 | 불필요: 서로 다른 ID/경로·세대의 결과 직접 단언 | P6·P9·P10·P11 (4) |
| VP-10 | AR-P ↔ IT-P | projects store → page props → 메뉴 → chat store/IPC | O-P1~P4·P6 | M-P1/M-P2: P3/P4 각각 picker 전달 제거. 양 하네스 배선 범위 확인 | P1~P12·P15·P16 (14) |
| VP-11 | SD-P ↔ ST-P | 기존 선택/추가/취소 → 초안 → 첫 전송 → 등록 | O-P2~P6 | 직접 행동 oracle; 추가 변이 자동 요구 없음 | P1~P16 (16) |
| VP-12 | R-P ↔ AT-P | AC8~16 전체 흐름 | O-P1~P7 조합 | VP-10 선택 증거 재사용 | P1~P16 (16) |

### 현재 변경의 운영 gate

| Gate | 적용 | 명령/증거 | 실패 범위 |
|---|---|---|---|
| G-DOC | 설계·보드·이미지 | 상대 링크/ID 대조, `git diff --check`, app 디렉터리의 inventory check | 이번 문서의 링크·상태·계약 불일치 |
| G-APP | 구현 시 main/renderer/shared | `npm run lint`, `npm run typecheck`, §19 관련 테스트 | 변경 유발 실패·명시 계약 위반 |
| G-VISUAL | UI 구현 후 | O-A4·O-P7 기록 | 시각 미확인은 통과로 기록하지 않음 |
| G-BUS | 설계/구현 커밋 각각 | trailer 파싱·INDEX 상태·push | 잘못된 상태/좌표·미게시 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

아래 코드 경로는 저장소 루트 기준이다. 세부 신규 파일은 §11에서 지정한다.

| 발견 | 근거 |
|---|---|
| 실행 환경은 한 builder가 직렬화 | `app/src/main/adapters/opencode/v1/native-storage.ts:13`은 현재 `{...config, share:'disabled'}` |
| server와 db path가 같은 profile 사용 | `server-profile.ts:17`, `server.ts:130,208,317` |
| SDK는 boolean 옵션 | 설치 SDK `1.18.27`, `dist/v2/gen/types.gen.d.ts:1548`의 `Config.snapshot?: boolean` |
| 공식 의미 | [OpenCode 1.x config / Snapshot](https://docs.opencode.ai/docs/config/#snapshot), 2026-10-26 확인. 비활성화는 native 파일 복구 snapshot 생성을 멈춘다. `/v2` 문서의 복수형 옵션을 혼용하지 않는다. |
| 표시 목록은 primary/visible 순서 유지 | `composer-catalog.ts:openCodeComposerAgents`는 filter→map이며 추가 sort 없음 |
| 공통 popover에는 min-width 강제 없음 | `app/src/renderer/src/shared/ui/Popover.tsx`; 폭은 Controls가 지정 |
| 제목 trailing은 우측 끝 | `shared/ui/MenuItem.tsx:MenuTitle`의 `ml-auto` |
| Nav 폴더 아이콘 정본 | `features/sessions/components/PinnedProjectsSection.tsx:124`의 `Icon name="folder"` |
| 등록은 첫 전송 준비 뒤 | `app/src/main/app/chat-turn/project-binding.ts:bindStartingProject`, `send.ts`의 projectCreated 이벤트 |
| 프로젝트 데이터 | `features/projects/store/projectsStore.ts`, shared `Project.cwd:string|null`; Main 정규화는 `infra/config/project-path.ts` |
| 경로 비교 재사용 | `app/src/shared/extra-directories.ts:directoryIdentity`; renderer에서 Node path를 import하지 않음 |
| 초안 갱신 경로 | `chatStore.ts:setPendingCwd`, `chatReducer.ts:SET_CWD`; 폴더 변경이 Git/extraDirs를 초기화 |
| 기존 테스트 범위 한계 | `NewChatLandingPage.harness.test.ts`는 Popover/chat store를 mock, `Module.integration.test.ts`도 chat action을 mock. 이를 그대로 종단 oracle로 간주하지 않음 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| OpenCode config 직렬화 정의 | `rg -n 'OPENCODE_CONFIG_CONTENT:' app/src/main/adapters/opencode -g '!*.test.*' -g '!*.testfixture.*'` | 1 | native-storage의 실행 정책 |
| manager profile 사용 | `rg -n 'openCodeServerProfile\(' app/src/main/adapters/opencode/v1/server.ts` | 3 | key/acquire/db path; spawn 소비 별도 포함 |
| 에이전트 송신 항목 | `rg -n 'cur.harnessAgent' app/src/renderer/src/features/chat/store/chatStore.ts` | 2 | 신규·기존 세션 전송 모두 검증 |
| Composer의 컨텍스트 행 | `rg -n '<CwdPanel' app/src/renderer/src/features/chat/components/Composer.tsx` | 2 | Claude 상단·OpenCode 하단 전달 |
| CwdButton 사용 | `rg -n '<CwdButton' app/src/renderer/src -g '*.tsx'` | 2 | CwdPanel·ChatTitleBar. 시작된 세션 경로는 보존 |

기준선에서 신규 picker·resolver는 없으므로 해당 자리는 §10에 **신규 예정**으로 고정했다. 구현 후 같은 범위 검색과 목록 차집합을 기록하며 grep의 줄 수를 자리 수로 오인하지 않는다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
config → nativeOpenCodeEnvironment(share만 강제) → server profile → serve
catalog → Controls(selected 미지정 허용) → 고정 폭 메뉴 / refresh trailing
projectsStore → NewChatLandingPage(세션 표시에만 사용)
Landing → Composer → CwdPanel → CwdButton → pickDirectory → setPendingCwd
첫 send → bindStartingProject → session.updated(projectCreated) → catalog refresh
```

### TO-BE

```text
config → nativeOpenCodeEnvironment(snapshot:false, share 유지) → 기존 profile/serve
catalog → 순수 agent selection 정책 → 실제 harnessAgent → 버튼/체크/send
projectsStore → NewChatLandingPage → composerProps.landingProjects
  → Landing → Composer의 양 CwdPanel 경로 → LandingProjectPicker
  → 검색/행 선택 또는 native dialog → 대상 초안 검증 → pending ID/cwd 원자 갱신
첫 send → 기존 bindStartingProject/이벤트/catalog 경로
```

| 축 | 변경 | 유지 |
|---|---|---|
| main | env snapshot 강제 | 저장 경로·server ownership·project binding |
| renderer 조립 | page가 projects 목록/loading을 chat에 props로 전달 | feature 교차 import 금지·page 조립 전용 |
| agent | 기본 선택 정책·메뉴 폭·제목 inline spinner | catalog 캐시·무효화·variant 기본값 |
| project | `/new`에서만 새 picker; 목록 도메인 필터는 chat feature 순수 seam | 상세 페이지/기존 세션 CwdButton |

## 10. 계약 / 타입 / 강제 지점

자리 검색은 아래 Q 명령으로 시작해 해당 함수의 값 운반 edge를 대조한다. 본문의 S/A/P 목록 자체가 분모이며 선언·테스트·주석 hit는 자리로 세지 않는다. 신규 자리는 구현 전에는 0 hit가 정상이며 구현 뒤 목록과 검색 차집합이 0이어야 한다.

```powershell
# Q-S: 환경 정책의 producer와 소비자
rg -n 'snapshot|OPENCODE_CONFIG_CONTENT|nativeOpenCodeEnvironment|openCodeServerProfile|profile.environment|this.start' app/src/main/adapters/opencode -g '!*.test.*' -g '!*.testfixture.*'
# Q-A: 에이전트 값/상태와 송신
rg -n 'harnessAgent|setHarnessOptions|snapshot.agents|authoritative|agent-loading|MenuTitle|w-\[' app/src/renderer/src/features/chat/harnesses/opencode/composer app/src/renderer/src/features/chat/store app/src/renderer/src/features/chat/reducer -g '!*.test.*' -g '!*.testfixture.*'
# Q-P: 목록/선택/등록의 생산부터 소비까지
rg -n 'landingProjects|LandingProjectPicker|pendingProjectId|setPendingCwd|selectPendingProject|draftGeneration|pickDirectory|bindStartingProject|projectCreated|useProjectCatalogSync' app/src/renderer/src app/src/main/app/chat-turn -g '!*.test.*' -g '!*.testfixture.*'
```

| Node / pair | 계약·SSOT | 언제 강제 — 고정 자리 | 검색 | 실패 의미 / oracle |
|---|---|---|---|---|
| MD-S / VP-01~04 | env boolean/우선순위 | S1 native-storage 직렬화 | Q-S | true/누락/문자열 false → O-S1 |
| AR-S / VP-02~04 | 같은 최종 환경 | S2 server-profile의 env·fingerprint 산출; S3 manager acquire→start profile 전달 | Q-S | 적용 전 설정으로 키 생성·전달 손실 → O-S2 |
| AR-S / VP-02~04 | child 경계 | S4 server.start spawn env; S5 readDatabasePath exec env | Q-S | native child에서 정책 소실 → O-S2·S3 |
| AR-A / VP-06~08 | 목록/상태 전달 | A1 ModeControl의 snapshot.agents→AgentControl | Q-A | 다른 슬롯/목록 전달 → O-A2, M-A1 |
| MD-A / VP-05~08 | 첫 유효값 | A2 신규 agentSelection resolver | Q-A + 신규 파일 | 잘못된 순서/빈·오류 처리 → O-A1 |
| AR-A / VP-06~08 | 선택값 실재 | A3 AgentControl effect→setHarnessOptions; A4 메뉴 onChange→동일 action→reducer | Q-A | 라벨만 변경·수동 선택 유실 → O-A2·A3 |
| AR-A / VP-06~08 | 표시=송신 | A5 OpenCodeSelect label/check; A6 chatStore 신규 send; A7 기존 send | Q-A | 화면/선택/실제 payload 불일치 → O-A2·A3 |
| AR-A / VP-06·08 | compact/inline | A8 agent 메뉴 width; A9 이름·체크 열; A10 제목의 inline spinner | Q-A | 넓은 고정폭·체크 유실·우측 정렬·화살표 → O-A2·A4 |
| AR-P / VP-10~12 | cross-feature props | P1 NewChatLandingPage catalog→composerProps; P2 Landing→Composer | Q-P | 목록/loading 소실 → O-P3 |
| AR-P / VP-10~12 | 양 하네스 | P3 Composer 상단 CwdPanel; P4 하단 CwdPanel; P5 CwdPanel→신규 picker | Q-P | 한쪽 하네스에서 직접 dialog 회귀 → O-P3, M-P1·P2 |
| MD-P / VP-09~12 | 목록 투영 | P6 신규 landingProjectOptions의 filter/search/check | Q-P + 신규 파일 | 잘못된 행·정렬·경로 체크 → O-P1 |
| AR-P / VP-10~12 | 사용자 입력 | P7 picker 행 선택; P8 추가 버튼→native dialog | Q-P | 다른 ID/cwd·직접 create·잘못된 진입 → O-P2·P3 |
| MD-P / VP-09~12 | 비동기 대상 | P9 신규 useLandingProjectPicker의 target fence | Q-P + 신규 hook | stale 결과가 다른 초안 변경 → O-P2·P4 |
| MD-P / VP-09~12 | ID/cwd 일관성 | P10 chatStore 신규 selectPendingProject→reducer; P11 성공한 선택의 lastCwd 저장 | Q-P | 부분 적용·거절 경로 저장 → O-P4 |
| AR-P / VP-10~12 | 최초 전송 | P12 chatStore.send 신규 경로의 cwd/projectId payload | Q-P | 선택된 ID/원본 경로 손실 → O-P4 |
| SD-P / VP-11~12 | 기존 등록·확정 | P13 Main bindStartingProject; P14 send의 projectCreated/session.updated | Q-P | 즉시 등록·잘못된 project 연결 → O-P5 |
| AR-P / VP-10~12 | catalog 정본 | P15 useProjectCatalogSync→projectsActions.refresh→projectsStore | Q-P | 등록/제거 후 오래된 목록 → O-P6 |
| AR-P / VP-10~12 | popup 수명 | P16 신규 picker와 실제 Popover의 focus/close | Q-P + 신규 파일 | 접근 불가·닫힌 메뉴 이벤트·초점 유실 → O-P2·P3·P7 |

분모는 S 5 + A 10 + P 16 = **31자리**다. A3/A4의 reducer 경계와 P10의 reducer 경계는 action 호출만 mock한 테스트로 닫지 않는다. `snapshot:undefined`는 기본 활성화 가능성이 있으므로 false와 동치가 아니다.

## 11. 구현 설계

| 파일/영역 | 설계 |
|---|---|
| `main/adapters/opencode/v1/native-storage.ts` | 최종 JSON을 `{...config, share:'disabled', snapshot:false}`로 생성. 입력 객체·base env 불변. 별도 사용자 설정 파일 쓰기 없음. |
| 신규 `chat/harnesses/opencode/composer/agentSelection.ts` | 목록 순서 보존, 미선택/무효/empty/loading/error의 effective name·변경 필요 여부를 순수 계산. 유효 선택은 유지. |
| `opencode/composer/Controls.tsx` | resolver를 label/check와 실제 action에 공통 적용. agent 전용 content 폭/empty label 옵션을 Select에 주고 variant는 기존 동작 유지. |
| `shared/ui/MenuItem.tsx` | `MenuTitle`에 opt-in inline 진행 슬롯(예: `afterLabel`) 추가. 기존 leading/trailing의 배치·소비자는 유지. |
| `shared/ui/Icon.tsx` | 기존 아이콘 체계에 화살표 없는 원호 glyph 추가 후 animate-spin 사용. refresh glyph와 OpenCode의 기존 타일 spinner는 변경하지 않음. |
| `pages/NewChatLandingPage.tsx` | 기존 `useProjectsState`에서 list/loading을 읽어 `landingProjects` props로 조립만 수행. |
| `Composer.tsx`·`CwdPanel.tsx` | optional catalog props 전달. 제공된 `/new`에서만 신규 picker, 미제공이면 기존 CwdButton. 양 하네스 배치 모두 전달. |
| 신규 `chat/components/LandingProjectPicker.tsx` | Popover·MenuItem·Icon 재사용. 검색/행/구분선/추가 버튼. 콘텐츠 폭 + viewport 상한, 목록만 세로 스크롤. |
| 신규 `chat/lib/landingProjectOptions.ts` | `cwd != null` 필터, 검색, selected ID/경로 판정. `directoryIdentity` 재사용; 서로 다른 경로의 같은 이름을 합치지 않음. |
| 신규 `chat/hooks/useLandingProjectPicker.ts` | open/query/busy·native dialog·focus 복귀·cancel/race 담당. projects feature import 없음. |
| `chatStore.ts`·`chatReducer.ts` | targeted `selectPendingProject({projectId,cwd}, target)` 추가. root 검증 후 cwd·pendingProjectId 원자 적용, 성공 후 lastCwd 저장. |

`landingProjects`는 `{items: readonly Pick<Project,'id'|'name'|'cwd'>[]; loading:boolean}`이다. 기존 행은 명시 ID+cwd, 새 폴더는 현재 catalog와 경로를 대조해 ID 또는 null을 전달한다. 클릭 당시 행이 현재 catalog에서 제거됐으면 적용하지 않는다.

초안 target은 `{key,draftGeneration}`으로 고정한다. `freshEntry`마다 메모리 전용 generation을 새로 만들고 상태 patch에서는 유지한다; `/new` 선택은 해당 generation·activeKey·sessionId 없음·busy/loading 아님을 적용 직전에 재검사한다. selector의 결과가 root 거절이면 lastCwd도 저장하지 않으며, 기존 `setPendingCwd`와 새 action은 검증/성공 후 기억 갱신을 공유한다.

content 폭은 agent 전용 `w-max` + viewport 기반 max-width로 구현하고 체크 열 공간을 예약한다. 비동기 내용 변경으로 popup 크기가 달라질 때 actual panel ResizeObserver 재측정이 필요하면 `Popover`의 기존 observer에 panel 관측을 추가하고 cleanup/loop 회귀를 확인한다. 기본 위쪽 배치·가용 공간에 따른 flip을 유지하며 첨부 이미지는 내부 구성을 참조한다.

### 직접 oracle 좌표 / 테스트 가능성

아래 경로는 `app/src/` 기준이다. **신규**는 구현자가 만들 테스트의 파일·진입점·구별 입력·관측을 고정한 것으로 현재 PASS 증거가 아니다.

| Oracle | 좌표 / 입력 → 관측 |
|---|---|
| O-S1 | `main/adapters/opencode/v1/native-storage.test.ts` 기존 `preserves native storage paths while applying only runtime configuration` 확장: snapshot true/false/누락·model sentinel·base/env → 최종 JSON과 입력 불변 |
| O-S2 | `main/adapters/opencode/v1/server.test.ts` 기존 `coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child` 확장 + **신규** `forces snapshots off for every newly spawned generation`: manager.acquire→실제 profile/builder→spawn spy; 서로 다른 model/env·retire 후 새 child의 JSON |
| O-S3 | `main/adapters/opencode/v1/server.database-path.test.ts` 기존 `reads the database path through the server and CLI environment of the selected engine document` 확장: 선택 엔진 sentinel과 snapshot true → serve/db child env 모두 false |
| O-A1 | **신규** `renderer/src/features/chat/harnesses/opencode/composer/agentSelection.test.ts`: `selects first authoritative agent and retains valid explicit choice`; `[z-first,a-second]`, 빈 목록, stale 이름, loading/error → effective name/patch |
| O-A2 | `renderer/src/features/chat/harnesses/opencode/composer/Module.integration.test.ts` 확장: 실제 catalog hook·controls·Popover 실행, IPC만 대체; `defaults from catalog order and keeps title loading independent` / 기존 `uses only the agent slot for title loading when %s completes first` → 표시·체크·행 클릭·제목 glyph |
| O-A3 | **신규** `renderer/src/features/chat/harnesses/opencode/composer/Controls.selection-flow.test.ts`: 실제 chatStore/reducer·Controls 조립, native catalog/전송 IPC만 대체; `carries default and explicit agent through initial and subsequent sends` → 빈 선택·z-first·a-second를 각각 첫/후속 send payload에서 관측 |
| O-A4 | **실기** `visual-check.md:agent-menu`: white/dark, 짧은/긴 이름·선택 체크·loading/ready·창 가장자리/reduced motion. 폭은 실제 이름/체크 bounding box와 표준 padding에 맞고 제목↔spinner gap이 일정한지 기록; 실제 glyph에 화살표 없음 |
| O-P1 | **신규** `renderer/src/features/chat/lib/landingProjectOptions.test.ts`: `filters folder projects without changing order or merging names`; 다른 ID/같은 이름/다른 경로·Windows 경로 표기·null cwd·삭제/검색 → 행과 단일 체크 |
| O-P2 | **신규** `renderer/src/features/chat/components/LandingProjectPicker.test.ts`: `opens search before dialog and selects only the live draft`; 실제 picker/hook/Popover, store actions는 실제, native dialog promise만 제어 → row 적용·추가·취소·중복·focus·unmount/stale |
| O-P3 | **신규** `renderer/src/pages/NewChatLandingPage.project-picker.test.ts`: `selects folder projects in both harnesses without replacing the draft`; 실제 page/Landing/Composer/CwdPanel/picker/Popover 실행. projects/chat store를 실제로 시드하고 IPC 경계만 대체; 명명 프로젝트 B와 새 폴더 C → label/store, 초안·첨부 보존, 양 배치 위치 |
| O-P4 | **신규** `renderer/src/features/chat/store/chatStore.project-selection.test.ts`: `applies ID and cwd atomically and sends them only for its draft generation`; 실제 actions/reducer/send, external IPC spy → B ID+B cwd, 신규 C+null, root·새 __new__·busy·settings 실패. 기존 같은 디렉터리의 `chatStore.lastCwd.test.ts`도 실행 |
| O-P5 | `main/app/chat-turn/project-binding.test.ts`의 `reuses a normalized path, keeps same names at different paths and exposes cwd in DTO`, `writes project membership separately from an isolated execution cwd and preserves it on reload`; 같은 디렉터리 `send.worktree.test.ts`의 `준비 완료 전에는 context/runtime을 만들지 않고 managed cwd와 extraDirs를 runtime까지 전달한다`·`does not announce an existing path project as newly created` 실행. 부족한 edge는 **신규** 같은 디렉터리 `send.project-picker.test.ts:binds selected source project after preparation`로 보완 |
| O-P6 | `renderer/src/app/hooks/useProjectCatalogSync.test.ts` 확장: 실제 projectsActions/store refresh까지 실행하여 event→list 관측. `renderer/src/app/hooks/projectDeletionWiring.test.ts`·`renderer/src/features/chat/store/chatStore.projectDeletion.test.ts`와 O-P4 파일의 **신규** `does not select a removed project`로 삭제 경로 보호 |
| O-P7 | **실기** `visual-check.md:project-menu`: 양 하네스 white/dark·긴 이름·좁은 창·검색→선택→닫기→focus 및 실제 폴더 모달 취소/선택. 첫 전송 전후 Nav 등록 시점 기록 |

순수 resolver/목록 정책은 Electron·DB import 없는 별도 파일이다. 기존 fake DOM을 React/browser 실행 환경으로 재사용하되 Popover·action·store·reducer 등 측정 경로 구성요소는 mock하지 않는다. fake DOM은 실제 픽셀 레이아웃 증거가 아니므로 O-A4/P7을 대체하지 않는다.

## 12. End-to-end 영향

| producer → consumer | 보존/변경 |
|---|---|
| OpenCode catalog → agent state → controls → harnessAgent → send | 첫 유효 선택을 store에 반영. 이름을 표시만 하고 native 기본값에 맡기지 않음 |
| projects catalog → props → picker → draft → send → Main binding | 목록과 영속 등록은 기존 SSOT. 선택 시 프로젝트 목록 쓰기는 없음 |
| cwd 선택 → Git/extraDirs 초기화 → lastCwd | 기존 `SET_CWD` 정책 유지. 같은 행 재선택은 무변경 |
| 생성 이벤트 → useProjectCatalogSync → projectsStore/Nav | 기존 동작 유지. 전송 전 임시 폴더를 영속 프로젝트처럼 표시하지 않음 |

부팅 등록자·IPC·스키마는 추가하지 않는다. 새 draft generation은 renderer 메모리 전용이며 persisted session/DB 포맷에 넣지 않는다.

## 13. Lifecycle / 오류 / 정리

메뉴 닫기·unmount에서 이벤트/observer/초점 예약을 정리한다. 폴더 dialog는 native 취소 결과 null을 무변경으로 처리하고, 오류는 기존 오류 표면으로 보고한다. catalog의 기존 error/refresh 정책은 유지하며 프로젝트 초기 조회 실패를 이번 작업에서 새 캐시 정책으로 확장하지 않는다.

**다중 저장소 쓰기**: draft 메모리 선택 → settings.lastCwd 순서다. settings 실패/종료 시 현재 선택은 유효하고 재시작 기본 경로는 이전 값일 수 있으며 기존 saveFailed 보고를 유지한다. 프로젝트 DB 쓰기는 첫 전송 준비 뒤의 기존 transaction이며 SDK 시작 실패 시 빈 프로젝트가 남을 수 있는 현재 계약을 유지한다.

설계 상태의 사본은 이 plan 메타와 INDEX 행이다. 같은 커밋에서 READY/다음 Codex를 갱신하고, 문서 게이트로 대조한다.

## 14. 성능 / 상한 / 최적화

검색은 이미 로드된 catalog를 O(N)으로 필터하고 입력마다 IPC를 요청하지 않는다. 메뉴 열기 0회 native dialog, 명시 추가 1회만 열며 동시 중복은 차단한다. 에이전트의 전역 캐시·invalidations·서버 lease 정책은 유지한다.

snapshot 비활성으로 OpenCode native 파일 복구 snapshot의 생성 부수 효과가 사라진다. Orca의 기존 descriptor는 revert를 이미 비활성으로 서술하므로 별도 복구 UI 제거를 추가하지 않으며 이력 snapshot·Git 기능은 보존한다.

## 15. 외부 구현 포트 / 문서 계약

신규 외부 포트는 없다. SDK `Config.snapshot`의 타입은 boolean이며 문자열과 미지정을 허용된 대체로 취급하지 않는다. 서버 프로세스 실행 옵션은 테스트에서 JSON 파싱하여 의미를 확인한다.

## 16. 기존 결정·규칙과의 관계

| 기존 규칙/출처 | 본문 대조 | 결과 |
|---|---|---|
| renderer 4-layer / `app/src/renderer/AGENTS.md` | §9 page props 전달, chat→projects import 없음 | 유지 |
| 디자인 시스템 §5·7 / component catalog | §11 Popover/MenuItem/Icon, opt-in MenuTitle 슬롯 | 유지·신규 표면 행 추가 예정 |
| 현재 lastCwd 테스트·0285 현재 코드 | §10 P11·§13 실패 의미 | 유지 |
| native 저장 authority / `docs/arch/backend/persistence.md` | §6 snapshot 범위·§13 DB 등록 | 유지 |
| 프로젝트 삭제 시 본문/cwd 보존 / frontend state | AC16·§12 | 유지 |
| OpenCode 기존 서버 환경 | D-001·S1 | 사용자 요구로 snapshot 실행 정책 추가 |

## 17. 리스크 / 트레이드오프

| 리스크 | 처리 |
|---|---|
| ‘기본값’을 재열기마다 강제 초기화로 구현 | D-002·AC4로 유효 수동 선택 보존 |
| 공유 Select 변경이 variant까지 확산 | agent 옵션으로 제한, 기존 variant 동작 회귀 |
| 가변 폭이 로딩 후 화면 밖으로 이동 | 실제 panel 크기 재측정·viewport 경계 실기 |
| `__new__` 키 재사용 | 메모리 generation과 적용 직전 상태 검증 |
| 오래된 catalog 행 선택 | live 목록 확인·삭제된 ID 거절 |
| screenshot의 큰 크기 그대로 복제 | 내부 구성만 참조하고 Orca 기존 메뉴 토큰 사용 |

신규 패키지·DB migration·비가역 데이터 변환은 없다.

## 18. 영향 받는 파일 / 문서

코드/테스트의 변경 후보는 §11이다. 구현 시 `docs/arch/frontend/design-components.md`에 신규 picker와 MenuTitle 슬롯/agent 메뉴 행을, `state.md`에 초안 선택·등록 시점을, `docs/arch/backend/adapters.md`에 snapshot 실행 정책을 반영한다. IPC 변경은 없으므로 IPC_CONTRACT 규범 변경은 불필요하다.

## 19. 게이트

설계 턴은 문서만 변경하므로 G-DOC·G-BUS를 실행한다. 구현 턴은 `app/AGENTS.md`·main/renderer 하위 AGENTS의 게이트를 적용한다.

```powershell
# repository root — 설계/구현 공통
git diff --check
# app/ — 설계/구현 공통 문서 검사
Set-Location app
node scripts/check-doc-inventory.mjs --check
# app/ — 구현 후, ABI 중립
npm run lint
npm run typecheck
./node_modules/.bin/vitest run src/main/adapters/opencode/v1/native-storage.test.ts src/main/adapters/opencode/v1/server.test.ts src/main/adapters/opencode/v1/server.database-path.test.ts src/renderer/src/features/chat/harnesses/opencode/composer src/renderer/src/features/chat/components/LandingProjectPicker.test.ts src/renderer/src/features/chat/lib/landingProjectOptions.test.ts src/renderer/src/features/chat/store/chatStore.project-selection.test.ts src/renderer/src/features/chat/store/chatStore.lastCwd.test.ts src/renderer/src/features/chat/store/chatStore.harness.test.ts src/renderer/src/features/chat/reducer/chatReducer.extraDirs.test.ts src/renderer/src/features/chat/reducer/chatReducer.worktree.test.ts src/renderer/src/pages/NewChatLandingPage.harness.test.ts src/renderer/src/pages/NewChatLandingPage.project-picker.test.ts src/renderer/src/app/hooks/useProjectCatalogSync.test.ts
```

shared MenuTitle/Icon/Popover를 바꾸면 해당 shared UI 테스트도 실행한다. O-P5의 DB 실제 binding 검증은 ABI를 확인한 후 관련 suite를 별도 실행하고, 환경 실패를 제품 실패와 분리한다. 실기 O-A4/P7과 등록 변이 M-A1/M-P1/M-P2는 구현·검증 보고에서 각각 기록한다.

### 설계 턴 gate 관측

`git diff --check`와 이번 plan의 상대 링크 검사는 통과했다. Decision 9·AC 16·pair 12와 INDEX의 READY/Codex를 기계 대조했다. `check-doc-inventory --check`의 generated/prose 검사는 통과했지만, 전체 링크 검사는 Git 추적 밖 `.tmp/opencode-dev/`·`app/.temp/opencode/`의 기존 링크 오류 10건으로 실패했다; 이번 handoff 경로 오류는 없으며 임시 자료는 수정하지 않았다.

## READY self-review

- 결정 대조: §3의 D-001~009가 §7 AC1~16과 연결되며 반대 요구 0. 즉시 등록 대안은 채택하지 않았다.
- 경로 대조: §9의 양 CwdPanel 경로는 P3/P4, 송신 두 경로는 A6/A7, 설정 쓰기는 P11에 대응한다.
- V 대조: NEW 좌 node 12개에 REQUIRED pair 12개. §10 분모 S5+A10+P16=31자리이며 §11 좌표로 대응한다.
- 범위 대조: `/new`만 새 picker를 주입하므로 프로젝트 상세/확정 세션/참조 폴더 버튼의 기존 경로를 막지 않는다.
- 증거 한계: 기존 mock 테스트의 실행 구간을 명시했고 신규 flow 테스트/실기를 분리했다. 아직 구현·테스트 통과를 주장하지 않는다.
- 문서 대조: SDK boolean 타입·Nav 폴더 SVG·MenuTitle trailing·Popover 폭/측정·SET_CWD/lastCwd·Main 등록 경로를 현재 소스에서 확인했다.
- 산출물 대조: plan/INDEX의 READY·다음 Codex와 상대 링크·trailer는 마무리 게이트에서 확인한다.


---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

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
