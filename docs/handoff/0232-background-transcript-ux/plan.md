# Plan — 0232-background-transcript-ux

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex |
| 일자 | 2026-09-13 |
| 상태 | READY |
| V mode / 기준 / revision | Baseline V / none / V1 |
| 유효 V | V1 + ΔV1 — 패널 상단 일괄 제어·중복 도구 제목 제거를 포함한다. 0230·0231 런타임 계약은 유지한다. |

# Part I — Product & UX Contract

## 1. Context / 목표

변경한다. Work 중간 노트는 도구 타임라인 안에서 읽고, 자동 수신은 대화 버블 없이 처리하며, Code 백그라운드 작업은 카드에서 열고 중단한다. Spark 상태 줄은 작업 수를 파란 클릭 대상으로 제공한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | Work 노트를 도구 그룹 내부에 표시 | 사용자 피드백·첨부 이미지 `codex-clipboard-d8eccf0b-ce0c-4021-bdd8-93a4b4e35866.png` |
| 명시 요구 | Work/Code 자동 수신 버블 비표시, 내부 처리 유지 | 사용자 `<task-notification>` 예시 |
| 명시 요구 | Code 백그라운드 카드·클릭 도구 UI·중단·경과 시간 | 사용자 피드백 |
| 명시 요구 | `Distilling… · 입력 대기 1건 · 백그라운드 작업 1건 (4m 43s)`; 작업 수 파란색·hover 버튼 | 추가 피드백 |
| 해석 | 작업 수 클릭은 기존 모드별 백그라운드 패널로 이동. 도구 사이 텍스트를 노트로 분류 | 기존 패널 액션·응답 경계·첨부 순서 |

## 3. Decision Ledger

| ID | 결정 | 출처/조건 | 상태 | 대체 관계 |
|---|---|---|---|---|
| D-01 | 도구 사이 중간 텍스트를 노트로 그룹에 넣고 도구·노트 개수 표시 | 사용자 이미지; 도입·최종 답변은 바깥 유지 | ACTIVE | D-00 대체 |
| D-00 | 모든 Work 중간 텍스트를 그룹 밖에 표시 | 기존 `workActivity`·rendering 문서 | SUPERSEDED | D-01 |
| D-02 | 출처가 자동 수신인 user 메시지는 버블·복사 액션·시간 행을 만들지 않음. 원본 보존 | 사용자; 직접 입력한 태그는 보존 | ACTIVE | — |
| D-03 | Code 작업 카드는 기존 Explorer/Agent 모양, 선택 상세는 도구 호출 UI | 사용자; canonical 상태와 output 보존 기능 유지 | ACTIVE | 0231의 일반 메타데이터 목록 표현 대체 |
| D-04 | 실제 taskId/generation에 연결된 중단 버튼, 실행 시간 표시 | 사용자; 미확인·실패는 기존 재시도 상태 유지 | ACTIVE | — |
| D-05 | Spark 배경 작업 수는 제품 파랑·hover/focus 버튼이며 패널 열기 | 사용자; 다른 대기 사실·경과 시간 유지 | ACTIVE | — |
| D-06 | Temp `orcinus-orca`, Bash+PowerShell, 문서 작성자 Codex, PR 생성 | 앞선 사용자 결정 | ACTIVE | 변경 없음 |
| D-07 | 패널에 새로고침·모든 실행 중단 버튼을 배치하지 않음 | 미리보기 확인 후 사용자 추가 피드백 | ACTIVE | 기존 패널의 두 제어 표시 대체 |
| D-08 | 선택 상세의 도구 호출 제목 행을 렌더하지 않음. 패널 제목/뒤로가기·도구 본문은 유지 | 사용자 예시 `실행 중실행 중로그 파서 조사 >` | ACTIVE | D-03의 상세 표시 보완 |
| D-09 | 상세의 결과 기다리기·대기 취소 UI를 제거 | 사용자 추가 피드백; 실제 작업 중단은 유지 | ACTIVE | 기존 대기 전용 UI 대체 |

### 갱신 메모

D-01~05는 새 UI 결정이고 D-06은 유지한다. ACTIVE↔AC 대조: D-01=AC1~2, D-02=AC3~4, D-03~04=AC5~6, D-05=AC7~8. D-06은 기존 구현 유지 및 작업 산출 절차다.

## 4. 요구 비판적 검토

| 질문 | 판정 / 근거 |
|---|---|
| 원인 | 확인. `workActivity.finish`는 text에서 flush하고 `ActivityDisclosure`는 tools만 렌더한다. |
| 자동 입력 출처 | 확인. `claude-map.receivedOrigin`→`input.received`→text origin이 이력까지 보존된다. |
| 작은 해법 | renderer 투영·상세 표시·기존 패널 액션 재사용. SDK/DB 마이그레이션 불필요. |
| 충돌 | 사용자 명시 변경으로 D-00을 대체. 원본 스펙은 비교 자료이며 작업 지시가 아니다. |

사용자에게 올릴 미결 결정 없음. 모델이 요청에 따라 출력 도구를 선택하는 동작은 기존 도구 능력을 유지한다.

## 5. 동작 / 사용자 흐름

| 시작 / 이벤트 | 처리 | 표시 |
|---|---|---|
| Work 도구→노트→도구 | 같은 응답 경계 안에서 순서대로 그룹화 | 헤더 도구/노트 수, 펼치면 세로 타임라인 |
| 도입·결론 / 질문·오류 | 본문과 보호된 별도 구간 유지 | 최종 답변이 접힌 그룹에 숨지 않음 |
| 자동 입력 live / reload | 이력·내부 처리 유지, 사용자 턴 투영 제외 | 버블·빈 교환·복사/시간 행 없음 |
| Code 카드 선택 | canonical task와 호출을 식별, 기존 tool UI로 상세 표시 | 제목·상태·경과 시간, 도구 인자/결과·하위 호출 |
| 중단 요청 / 실패 | 실제 id에 기존 IPC, 중복 요청 중 비활성 | 요청 상태 및 실패/미확인 재시도 |
| 상태 줄 작업 수 클릭 | 모드별 기존 패널 활성/노출 | Code=subagent, Work=task |

빈 목록·로딩·연결 불명·중단 실패는 현재 안내를 보존한다. 키보드 Enter/Space와 focus-visible을 제공하고 두 테마의 기존 시맨틱 파랑을 쓴다. 세션 이동 시 현재 세션에만 작용한다.

## 6. 범위 / 비범위

범위: renderer 투영·카드/상세·상태 줄·관련 테스트·현재 아키텍처 문서. 비범위: SDK 업그레이드, raw 이벤트 제거, 실행 소유권/중단 계약 변경, 새 자동 출력 모니터 정책, 새 의존성.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 / production 경로 |
|---|---|---|---|
| R-01 | AT-01 / AC1 | Work 도구 사이 노트가 같은 그룹의 순서 있는 타임라인에 있고 개수가 맞음 | projector UT + disclosure interaction: messages→project→WorkActivity |
| R-01 | AT-02 / AC2 | 접힘에도 도입·최종 답변/질문·오류는 보이며 live/late result가 노트를 잃지 않음 | 기존 경계·identity UT/렌더 회귀 |
| R-02 | AT-03 / AC3 | 자동 수신 live/reload는 Work/Code 버블·메타·빈 교환을 만들지 않음 | input.received/LOAD_SESSION→groupExchanges→Transcript 테스트 |
| R-02 | AT-04 / AC4 | 사용자 직접 태그 입력·정상 어시스턴트 결과 및 원본 origin은 유지 | 음성/양성 메시지 조합·reducer replay 단언 |
| R-03 | AT-05 / AC5 | Code 작업을 Agent 같은 카드에서 선택하면 도구 호출 상세로 열림 | canonical panel 렌더/interaction; linked/unlinked 호출 모두 |
| R-03 | AT-06 / AC6 | 실행 카드의 경과 시간과 중단, 실패/미확인 재시도는 실제 작업 식별자로 동작 | fake clock + mock IPC interaction; terminal stop 금지 |
| R-04 | AT-07 / AC7 | 상태·입력 대기·배경 작업·시간 순서, 작업 수는 파랑·hover/focus 버튼 | StatusLine 렌더/시각; 0개·overflow·준비 단계 회귀 |
| R-04 | AT-08 / AC8 | 작업 수 클릭 시 현재 모드 패널이 열리고 이미 열린 패널은 유지 | PendingAssistantStatus→chatActions→모드별 패널 integration |

## 7-A. V / Trace Matrix

Baseline V1. 노드 등록: R-01~04와 AT-01~08은 §7 NEW, MD-01(노트/자동수신 투영)↔UT-01, AR-01(원본에서 화면/패널 경계)↔IT-01, SD-01(수신·reload·중단·세션 경계)↔ST-01은 NEW다. 검증 노드의 직접 증거는 아래 표다.

| Pair | left ↔ right | requiredness | production path / 직접 oracle | 적대 증거 | §10 지점 |
|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01,02 | REQUIRED | 메시지→projector→disclosure; 펼친 DOM 자식 순서·접힌 최종 답변 | not selected — DOM 위치 직접 관측 | EP-01 (2) |
| VP-02 | R-02 ↔ AT-03,04 | REQUIRED | live/reload→turns→transcript; 자동/직접 입력과 원본 비교 | not selected — 결과 직접 관측 | EP-02 (2) |
| VP-03 | R-03 ↔ AT-05,06 | REQUIRED | canonical state→카드→상세/stop IPC; 호출 id·상태·시간 | not selected — interaction 직접 관측 | EP-03 (2) |
| VP-04 | R-04 ↔ AT-07,08 | REQUIRED | activity→StatusLine→panel action; 순서·색·클릭 결과 | not selected — 렌더/interaction 직접 관측 | EP-04 (2) |
| VP-05 | MD-01 ↔ UT-01 | REQUIRED | 경계/원본 메시지→투영; 노트 순서·identity·origin 구분 | not selected — 순수 출력 직접 관측 | EP-01,02 (4) |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | store→PendingAssistantStatus/canonical→패널·IPC; 현재 세션/id 일치 | not selected — 주입 경계 직접 관측 | EP-03,04 (4) |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | received/reload/terminal→화면→stop; 저장 필드 보존·전이 및 직접 입력 보존 | not selected — 전이 직접 관측 | EP-02,03 (4) |

| 운영 gate | 명령 / 이유 | 실패 범위 |
|---|---|---|
| renderer | `npm run lint`, `npm run typecheck`, 관련 비DB Vitest | 이번 변경 정적·동작 회귀 |
| build | `npm run build` | Electron/main/preload/renderer 산출 |
| repository/message bus | inventory·링크 검사, `git diff --check`, trailer 파싱 | 새 문서·현재 변경·핸드오프 상태 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

`workActivity.ts`/`WorkActivity.tsx`가 노트 위치를 소유한다. `turns.ts`의 groupTurns/groupExchanges가 Work/Code transcript 공통 진입점이다. `CanonicalBackgroundContent`가 0231 상태를 렌더하고 `SubAgentTileContent`에 기존 카드/선택 상세 표현이 남아 있다.

전수 조사: `rg -n '<StatusLine|PendingAssistantStatus' app/src/renderer/src/features/chat/components --glob '*.tsx'`의 StatusLine 직접 소비자는 PendingAssistant와 SubAgentTileContent다. 전자는 모드 공통 주 상태 줄, 후자는 개별 Agent 진행 표시다. `rg -n 'groupTurns|groupExchanges|UserMessage'`로 공통 투영과 개별 소비처를 확인한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

| 비교 축 | AS-IS | TO-BE / Delta |
|---|---|---|
| Work | tools만 그룹, text는 flush | tools 사이 text를 노트로 포함; projector+disclosure(AC1~2) |
| 자동 수신 | origin user도 사용자 턴/버블 | 원본 불변, 투영에서 제외; turns(AC3~4) |
| Code 패널 | canonical 범용 메타/출력 목록 | 같은 canonical 상태에 기존 Agent 카드와 도구 상세(AC5~6) |
| Spark | facts 문자열 join | 배경 fact는 파란 버튼, 패널 callback(AC7~8) |

기존 SDK→journal→background store와 stop/output IPC는 유지한다. 사라지는 책임은 원시 자동 입력의 사용자 버블 표시이며 내부 처리와 저장 책임은 이동하지 않는다.

## 10. 계약 / 타입 / 강제 지점

| 지점 | 계약 / SSOT | 언제 강제 / 전수 | 실패 의미 |
|---|---|---|---|
| EP-01 | 노트 위치·순서 / workActivity | projector, disclosure (2) | 그룹 분리 또는 노트 유실 |
| EP-02 | 자동 입력 표시 / text.origin | groupTurns 공통 투영, live/reload 원본 유지 경계 (2) | 버블 노출 또는 사용자 입력/내부 이력 손실 |
| EP-03 | 상태·선택·중단 / background store | canonical 카드/상세, stop IPC callback (2) | 상세 미연결 또는 다른 작업 중단 |
| EP-04 | 상태 줄 / activity facts·panel policy | StatusLine, PendingAssistantStatus callback (2) | 배경 수 누락·비클릭·잘못된 모드 패널 |

origin 미지정은 기존 직접 입력과 같이 보존한다. 중단 가능 여부는 기존 generation/connection/terminal 판정을 재사용한다. 원문 태그로 출처를 추정하지 않는다.

## 11. 구현 설계

| 파일/모듈 | 책임 / 테스트 seam |
|---|---|
| workActivity·WorkActivity·관련 테스트 | tools/text 순서, noteCount, rail; 순수 투영+React interaction |
| turns·관련 transcript/reducer 테스트 | origin user만 skip, 원본 index/key 보존; live와 LOAD_SESSION |
| CanonicalBackgroundContent 및 보조 카드/상세 | 기존 tool-call UI 재사용, 실제 task 식별자 stop, elapsed; IPC fake |
| StatusLine·PendingAssistant·activityLabel | facts 개별 렌더, background 항상 접근 가능, 기존 패널 열기; 렌더/클릭 |
| i18n resources | Work 노트 개수 번역; 기존 배경/큐 번역 재사용 |

## 12. End-to-end 영향

SDK→normalize→history/reducer는 그대로 두고 transcript 투영만 바꾼다. activity snapshot→StatusLine→모드별 기존 panel action을 연결한다. 부팅·등록 변경 없음.

## 13. Lifecycle / 오류 / 정리

노트 그룹 key와 메시지 index를 유지한다. 패널 선택은 세션 경계를 넘지 않고, 완료 시간은 멈추며 실행 시간만 갱신한다. 중단 실패와 unconfirmed는 재시도 가능한 기존 UI 상태로 남긴다. 다중 저장소 쓰기 없음; plan과 INDEX 상태는 같은 커밋으로 갱신한다.

## 14. 성능 / 상한 / 최적화

투영은 메시지/segment 선형 순회와 기존 캐시를 유지한다. 경과 시간은 기존 1초 훅, 원시 payload 자동 읽기·추가 폴링 없음. 상태 fact 수는 기존 상한에서 배경 작업 항목이 접힌 합계에 묻히지 않게 선택한다.

## 15. 외부 구현 포트 / 문서 계약

외부 계약 변경 없음. 기존 output 읽기/보존 API는 유지하며 모델의 도구 선택 정책을 새로 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 규칙 | 판정 |
|---|---|
| Work 모든 본문 상시 노출 / rendering.md | D-01로 중간 노트만 변경 |
| 0231 canonical 상태·실제 중단·출력 보존 | 유지; 표현만 변경 |
| renderer DAG·시맨틱 토큰·group scope | 유지 |
| 계획/구현 문서 작성 주체 | 사용자 지시대로 Codex |

## 17. 리스크 / 트레이드오프

도구 뒤 마지막 텍스트를 노트로 오인하지 않도록 최종 본문을 보존한다. 호출 id 없는 작업도 카드와 상태/중단을 표시하며 상세는 알려진 정보 범위로 제공한다. 신규 의존성과 되돌리기 어려운 결정 없음.

## 18. 영향 받는 파일 / 문서

§11 파일과 `docs/arch/frontend/rendering.md`, 필요 시 `docs/arch/backend/background-tasks.md`, 본 plan 및 INDEX. 전체 경로 목록은 구현 diff가 정본이다.

## 19. 게이트

`app/AGENTS.md` 및 renderer 가이드 적용. DB를 바꾸지 않으므로 Vitest 직접 실행(`--maxWorkers=4`)으로 Electron ABI를 유지한다. lint/typecheck/build 및 관련 테스트 후 독립 코드 검토하고 요청된 PR을 생성한다. 실제 화면 확인 여부는 구현 보고에 증거와 한계를 구분한다.

## READY self-review

- [x] 사용자 결정·이전 유지 범위·대체 관계를 보존했다.
- [x] Product/UX→AC→V pair→강제 지점→구현 경로가 연결된다.
- [x] AS-IS/TO-BE, 기존 소비처, 오류/세션 경계, 직접 검증 수단을 명시했다.
- [x] 원본 이력/실행 권한을 바꾸지 않고 renderer 책임에 한정한다.
- [x] subtree ABI·게이트와 계획/구현 별도 커밋 규약을 적용한다.

## ΔV1 — 패널 제어와 반복 제목 제거

작성자 Codex. READY. 기준 V1은 `39d2439f`; 현재 브라우저 화면을 본 사용자가 D-07·D-08을 명시했다. 기존 실행 API와 개별 카드 중단은 유지한다.

| R / AT / AC | provenance | 추가 동작 / production 경로 / 직접 oracle |
|---|---|---|
| R-05 / AT-09 / AC9 | NEW | canonical 패널에 새로고침·일괄 중단·결과 기다리기·대기 취소 UI가 없고 각 실행 카드의 개별 중단은 있다. 렌더·클릭 테스트. |
| R-06 / AT-10 / AC10 | NEW | 카드→선택 상세에서 호출 제목/상태 확장 행이 없고 도구 본문/child·상단 back는 남는다. 기본 transcript ToolCard 제목은 유지된다. 렌더·interaction 테스트. |
| MD-02 / UT-02 | NEW | ToolCard의 제목 없는 본문 표현은 opt-in이며 기본 사용처의 확장 UX를 바꾸지 않음. 두 경우 DOM 직접 비교. |
| AR-01 / IT-01 | CHANGED | canonical 선택 상세→ToolCard 본문 표현의 배선을 추가하고 기존 VP-06의 세션/식별자 경계를 유지. |

| Pair | left ↔ right | requiredness | 경로 / oracle | §10 추가 지점 / 적대 증거 |
|---|---|---|---|---|
| VP-Δ01 | R-05 ↔ AT-09 | REQUIRED | canonical 목록→개별 stop; 버튼 집합과 실제 개별 payload | EP-Δ01 목록 toolbar (1); not selected — 직접 DOM |
| VP-Δ02 | R-06 ↔ AT-10 | REQUIRED | 선택 상세→도구 본문; 제목 부재와 본문·back 양성 단언 | EP-Δ02 상세/ToolCard (2); not selected — 직접 DOM/클릭 |
| VP-Δ03 | MD-02 ↔ UT-02 | REQUIRED | ToolCard opt-in/default; body/header 슬롯의 실제 렌더 | EP-Δ02 (2); not selected — 자리 직접 관측 |
| VP-Δ04 | AR-01 ↔ IT-01 | REQUIRED | 선택 카드→상세/back/stop; 기존 VP-06 경로와 제목 옵션 전달 | EP-03,04,Δ02 (6); not selected — interaction |

AS-IS: canonical 목록 toolbar에 refresh/stopAll, 상세 ToolCard에 status/title 확장 행과 결과 대기 UI. TO-BE: toolbar·대기 전용 UI 제거, 기존 stopAll API는 남고 선택 상세만 제목 없는 본문으로 표시한다. 파일: `CanonicalBackgroundContent`, `ToolCard`, 관련 render/interaction 테스트. 기본 ToolCard 및 개별 중단은 회귀 대상으로 기존 VP-03/06을 재실행한다.

§10 유효 강제 지점은 기존 8지점 + EP-Δ01(1) + EP-Δ02(2)다. EP-Δ01은 canonical 패널 목록과 상세의 제어 집합을 함께 검사한다. 운영 gate는 §19를 유지한다. 기존 AC1~8 + AC9~10 = 총 10개이며 ACTIVE↔AC 대조는 D-07·D-09=AC9, D-08=AC10으로 충돌 없다.
