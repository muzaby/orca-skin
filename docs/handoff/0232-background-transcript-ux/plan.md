# Plan — 0232-background-transcript-ux

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex |
| 일자 | 2026-09-13 |
| 상태 | READY — ΔV2 사용자 추가 피드백 구현 대기 |
| V mode / 기준 / revision | Baseline V / none / V1 |
| 유효 V | V1 + ΔV1 + ΔV2 — 실제 모델·간결한 카드/상세·foreground 셸 전환과 표시 범위. 0230·0231의 원본/수명/출력 보존 계약은 유지한다. |

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
| D-10 | Explorer/Agent 상세는 부모 Agent 카드를 제거하고 대화록만 표시 | 사용자 추가 피드백; 셸 작업의 도구 본문은 유지 | ACTIVE | D-03·D-08의 Agent 상세 표현 대체 |
| D-11 | Explorer 상세 대화록을 감싼 외곽 테두리를 제거 | 사용자 추가 피드백; 다른 인라인 사용처의 기본 프레임은 유지 | ACTIVE | D-10의 대화록 표현 보완 |
| D-12 | Explorer 카드에는 실제 실행 모델을 표시하고 미관측 모델은 추정하지 않음 | 사용자 첨부1·추가 요청; canonical와 legacy 목록 | ACTIVE | D-03 모델 표시 보완 |
| D-13 | 완료/실패/중단 카드 아래 결과·요약 본문을 표시하지 않음 | 사용자 첨부1; 중단 요청 실패의 짧은 안내·재시도는 유지 | ACTIVE | D-03 카드 표현 보완 |
| D-14 | 비Explorer 상세는 도구 호출 UI만 표시. 별도 결과·출력 경로·읽기 controls 제거 | 사용자 첨부2; 내부 출력 보존과 모델 도구 능력은 유지 | ACTIVE | D-08·D-10 셸 상세 표현 대체 |
| D-15 | Code 실행 중 foreground Bash/PowerShell 카드 하단 우측에 파란 백그라운드 전환 버튼 | 사용자 요청; 같은 실행을 단건 전환하며 재실행하지 않음 | ACTIVE | 신규 |
| D-16 | 시작부터 종료까지 foreground인 셸은 Code 백그라운드 패널에서 제외 | 사용자 요청; 전환된 작업은 종료 후에도 카드 유지 | ACTIVE | D-03 목록 범위 보완 |

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
| R-06 / AT-10 / AC10 | NEW | 카드→선택 상세에서 호출 제목/상태 확장 행이 없다. Explorer/Agent는 부모 카드와 외곽 테두리 없이 대화록만, 셸은 도구 본문을 표시하며 상단 back는 유지한다. 기본 transcript ToolCard 제목은 유지된다. 렌더·interaction·실제 화면 확인. |
| MD-02 / UT-02 | NEW | ToolCard의 제목 없는 본문과 InlineSubagentDetail의 프레임 없는 표현은 opt-in이며 기본 사용처의 확장 UX를 바꾸지 않음. 렌더 테스트와 두 표현의 DOM 직접 비교. |
| AR-01 / IT-01 | CHANGED | canonical 선택 상세→ToolCard 본문 표현의 배선을 추가하고 기존 VP-06의 세션/식별자 경계를 유지. |

| Pair | left ↔ right | requiredness | 경로 / oracle | §10 추가 지점 / 적대 증거 |
|---|---|---|---|---|
| VP-Δ01 | R-05 ↔ AT-09 | REQUIRED | canonical 목록→개별 stop; 버튼 집합과 실제 개별 payload | EP-Δ01 목록 toolbar (1); not selected — 직접 DOM |
| VP-Δ02 | R-06 ↔ AT-10 | REQUIRED | 선택 상세→도구 본문; 제목·외곽 테두리 부재와 본문·back 양성 단언 | EP-Δ02 상세/ToolCard/InlineSubagentDetail (3); not selected — 직접 DOM/클릭 |
| VP-Δ03 | MD-02 ↔ UT-02 | REQUIRED | ToolCard와 InlineSubagentDetail opt-in/default; body/header/frame 슬롯의 실제 렌더 | EP-Δ02 (3); not selected — 자리 직접 관측 |
| VP-Δ04 | AR-01 ↔ IT-01 | REQUIRED | 선택 카드→상세/back/stop; 기존 VP-06 경로와 제목·프레임 옵션 전달 | EP-03,04,Δ02 (7); not selected — interaction |

AS-IS: canonical 목록 toolbar에 refresh/stopAll, 상세 ToolCard에 status/title 확장 행과 결과 대기 UI. TO-BE: toolbar·대기 전용 UI 제거, 기존 stopAll API는 남고 셸 선택 상세만 제목 없는 도구 본문을 표시한다. Explorer/Agent 상세는 부모 ToolCard와 외곽 프레임 없이 InlineSubagentDetail 대화록을 표시한다. 파일: `CanonicalBackgroundContent`, `ToolCard`, `InlineSubagentDetail`, 관련 render/interaction 테스트. 기본 ToolCard·인라인 프레임 및 개별 중단은 회귀 대상으로 확인한다.

§10 유효 강제 지점은 기존 8지점 + EP-Δ01(1) + EP-Δ02(3)다. EP-Δ01은 canonical 패널 목록과 상세의 제어 집합을 함께 검사한다. 운영 gate는 §19를 유지한다. 기존 AC1~8 + AC9~10 = 총 10개이며 ACTIVE↔AC 대조는 D-07·D-09=AC9, D-08·D-10·D-11=AC10으로 충돌 없다.

## [구현자 기입] 설계 리뷰

작성자 **Codex**, 구현 r1. V1 + ΔV1을 적용했다. 사용자 미리보기 피드백인 D-07~11은 각각 구현에 앞선 설계 커밋으로 보존했다. SDK·DB 원본을 유지하고 화면 투영을 바꾸는 책임 구분에 동의한다. 미해결 PLAN_GAP은 없다.

구현 세부로 canonical 선택은 generation/taskId와 generation/toolUseId를 구분한다. 아직 task가 없는 Agent 호출도 대화록을 열며, 이후 task가 연결되어도 선택을 유지한다. 컴포넌트 밖 helper는 `lib/canonicalBackground.ts`로 옮겨 Fast Refresh의 비컴포넌트 export 경계를 지킨다. 새 캐시·소유권·만료 정책은 만들지 않았다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

| §10 | 닫은 지점 / 분모 | 관측한 소비 경로와 증거 | 남긴 곳 |
|---|---|---|---|
| EP-01 | 2/2 | workActivity projector→WorkActivity disclosure. `opens notes and their surrounding tools together in one ordered timeline`에서 노트 위치·펼침 순서 관측 | 없음 |
| EP-02 | 2/2 | groupTurns→TranscriptView와 message.committed/LOAD_SESSION. 자동 입력 버블 없이 원본 origin을 보존하는 두 모드 회귀 | 없음 |
| EP-03 | 2/2 | canonical 카드/상세→실제 stop callback. `sends the actual stop button to canonical IPC without opening the card`에서 세대/id 및 선택 보존 관측 | 없음 |
| EP-04 | 2/2 | StatusLine→PendingAssistantStatus callback. 실제 store 패널 상태로 Code/Work 전환·재클릭 멱등 관측 | 없음 |
| EP-Δ01 | 1/1 | canonical 목록·상세 제어 집합. 새로고침/일괄 중단/결과 대기 UI 부재와 실행 카드 개별 stop 양성 단언 | 없음 |
| EP-Δ02 | 3/3 | canonical 상세→ToolCard·InlineSubagentDetail. Agent는 대화록만, 셸은 제목 없는 본문; 브라우저 대화록 class=`my-2 min-h-0`, border=`0px` | 없음 |

분모 검산: `2+2+2+2+1+3=12`, 닫은 지점 12/12. 범위는 §10 책임 지점이며 호출 횟수가 아니다. `rg -n 'InlineSubagentDetail|presentation="detail-body"|<StatusLine|PendingAssistantStatus' app/src/renderer/src/features/chat`로 사용처를 대조했다. AgentTaskRow·SubagentNoticeRow는 framed 옵션을 생략하여 기존 프레임을 유지하고, canonical만 false를 전달한다.

| Pair | requiredness | 자기 상태 | 직접 관측 |
|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | Work projector·render·interaction: 노트/도구 순서와 최종 본문 |
| VP-02 | REQUIRED | SELF_PASS | turns.received·TranscriptView.received: live/reload·원본/직접 입력 |
| VP-03 | REQUIRED | SELF_PASS | canonical render/wiring: 연결 전후 상세·stop IPC·실행 시간 |
| VP-04 | REQUIRED | SELF_PASS | statusLine.background: 순서·overflow·파랑·현재 모드 패널 |
| VP-05 | REQUIRED | SELF_PASS | workActivity: 응답 경계·보호 구간·late result·identity; turns.received 원본 인덱스 |
| VP-06 | REQUIRED | SELF_PASS | 실제 JSX callback→store 선택/back/패널 및 세대별 stop payload |
| VP-07 | REQUIRED | SELF_PASS | received LOAD_SESSION·canonical terminal/unknown/retry와 generation/session 분리 |
| VP-Δ01 | REQUIRED | SELF_PASS | canonical render 버튼 집합과 실제 개별 stop callback |
| VP-Δ02 | REQUIRED | SELF_PASS | Agent 카드/반복 제목 부재, 자식 Read·back 표시; shell body 양성 |
| VP-Δ03 | REQUIRED | SELF_PASS | ToolCard 기본 row 회귀; Inline 기본 프레임 보존과 canonical border 0 DOM |
| VP-Δ04 | REQUIRED | SELF_PASS | 카드 선택→상세→header back, 연결 전후 Agent/shell 배선 |

SELF_PASS 11 · SELF_BLOCKED 0 = 총11(REQUIRED11). 선택 적대 증거는 각 pair의 `not selected`를 유지한다. 아래 결과는 구현자 자기확인이며 독립 verify PASS가 아니다.

## [구현자 기입] 이번 라운드 수정의 잠금

선택 증거 0 · 인용 변이 0 · 새 구조적 proxy/전수/배선 존재 oracle 0 = 잠금 표 행0. 해당 없음 — 렌더된 노트 순서, 실제 callback의 IPC payload, store 전이, 보존된 원본 메시지를 직접 관측한다. 소스 문자열의 존재로 행동을 대신하는 검사는 추가하지 않았다.

기존 동작에서 Work 노트 관련 3개, 자동 수신 관련 10개, Agent 부모 카드 제거 관련 3개 테스트의 RED를 확인한 뒤 구현하여 GREEN을 관측했다. D-11은 표현 옵션 변경으로 실제 브라우저 border 0과 기존 인라인 사용처 보존을 확인했다. 기존 ToolCard row 및 셸 출력 양성 회귀는 유지했다. 공식 이전 verify의 인용 변이·교체한 검증 장치는 없다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 / 관측 | 후속 |
|---|---|---|
| 문구·상태의 소비자 | 노트 수는 disclosure, background fact는 파랑 버튼으로 렌더. 두 모드 실제 패널 액션 연결 | 없음 |
| 재배치의 스코프/정리 | helper 함수만 이동. 구독·timer·finally 소유 스코프 불변 | 관련 회귀 실행 |
| 오류·재시도 | 기존 중단 실패/미확인 및 대화록 loading/retry 표시 유지. UI 제거를 중단 API 제거로 확대하지 않음 | 없음 |
| 늦은 응답 | 열린 call에 task가 붙으면 같은 선택을 유지. 종료 후 늦은 메타가 경과 시간을 늘리지 않음 | canonical 회귀 |
| 대화의 가독성 | 접힌 Work 그룹 밖 최종 답변 유지. Explorer 상세는 대화와 자식 도구 행만 표시 | 브라우저 fixture에서 확인 |
| 키보드·테마 | 중첩 stop의 Enter가 카드 선택을 유발하지 않음. light/dark selected 토큰과 hover 배경 확인 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| 문제 | 대응 / 이번 관측 |
|---|---|
| 호출만 있고 task가 늦게 생성됨 | call 선택을 지원. Agent 연결 전후 대화록, 셸 연결 후 출력 refs를 서로 다른 양성 케이스로 확인 |
| stop 버튼 키 입력이 부모 카드로 전파됨 | target/currentTarget을 구분. 실제 버튼 callback 및 Enter/Space interaction으로 확인 |
| SDK 종료 duration이 없는 작업의 시간이 계속 증가함 | 첫 terminal evidence 시각으로 고정. 이후 lastSeen이 바뀌는 회귀에서 동일 elapsed 관측 |
| Agent 부모 카드 제거와 함께 출력 데이터가 손실될 수 있음 | 상세 UI만 제거. wiring 테스트가 내부 outputRefs 보존을 단언 |
| Fast Refresh가 helper export 변경을 거부함 | 비컴포넌트 export를 lib로 이동. 초기 브라우저 HMR 지연을 관측하여 보완 |
| 전체 대화 복사는 원본 이력을 사용함 | 버블 필터와 별개인 기존 ChatTitleBar 전체 복사 동작은 유지. 자동 수신 원본 자체를 삭제하는 범위로 확대하지 않음 |

설계 대비 명시적 차이: 제품 동작은 D-01~11과 일치한다. helper 모듈 분리는 구현 세부다. 만료는 새 캐시가 없어 해당 없음, 공유 상태는 기존 session store 유지, 재진입은 기존 callback과 훅 소유 유지, 무효화는 기존 세대/세션 키를 유지한다. AC5~8·EP-03~04의 실제 상태/IPC 회귀로 확인한다.

## [구현자 기입] 구현 보고

| AC | 자기 상태 | 이번 관측 |
|---|---|---|
| AC1 | ✅ SELF_PASS | Work 도구 2개·노트 2개 헤더와 펼친 도구→노트→노트→도구 순서 |
| AC2 | ✅ SELF_PASS | 접힌 최종 답변, 보호된 질문/오류/추론, live/late result identity 회귀 |
| AC3 | ✅ SELF_PASS | Work/Code live·LOAD_SESSION 자동 수신 버블/메타·빈 exchange 부재 |
| AC4 | ✅ SELF_PASS | 직접 입력한 task-notification 태그와 어시스턴트 결과, 저장 origin 보존 |
| AC5 | ✅ SELF_PASS | 실제 카드 callback으로 call/task 선택 후 상세, 늦은 연결 및 back |
| AC6 | ✅ SELF_PASS | 실제 세대/taskId stop payload, 실패/미확인·terminal elapsed 고정 |
| AC7 | ✅ SELF_PASS | 상태→입력 대기→파랑 background 버튼→시간, 0/overflow/준비 회귀 |
| AC8 | ✅ SELF_PASS | Code=subagent·Work=task 실제 store 전이, 재클릭 활성 상태 유지 |
| AC9 | ✅ SELF_PASS | 제거 요청한 패널 제어 부재, 개별 stop 유지 및 키보드 호출 |
| AC10 | ✅ SELF_PASS | Agent 부모 카드/반복 제목/대화록 외곽 border 부재, 자식 도구·셸 body·back 유지 |

검산: ✅10 · ⚠️0 · ❌0 = 총10. V-pair 11/11, 강제 지점 12/12 자기확인. 변경 파일은 구현 diff가 정본이며 SDK/DB/외부 실행 계약을 추가 변경하지 않았다. 대상 커밋은 `(r1 구현 — 좌표는 INDEX)`이다.

### 운영 gate

| Gate | 실행 명령 / 최종 관측 |
|---|---|
| renderer 통합 회귀 | `vitest run src/renderer`와 background-task·Claude metadata/input-receipts 관련 3파일, `--maxWorkers=2` — 230파일·1679테스트 통과 |
| 마지막 변경 회귀 | canonical render/wiring·WorkActivity render/interaction·statusLine.background — 5파일·35테스트 통과. 외곽 프레임·helper 분리 이후 실행 |
| 스크립트 | `node --test scripts/*.test.mjs` — 116테스트 통과, 실패0 |
| lint | `npm run lint` — 오류0, 기존 useTranscriptVirtualizer 경고1. canonical Fast Refresh 경고는 없음 |
| typecheck | `npm run build` 내부 `typecheck:node`, `typecheck:web`, `typecheck:test` 모두 통과 |
| Electron 산출 | `npm run build` — prebuild Electron ABI 정상, main/preload/renderer 생성 완료. SubAgentTileContent의 정적·동적 import 병존에 따른 청크 분리 안내1건 |
| 문서/운영 | `check-doc-inventory.mjs --check` 인벤토리·현재 문서·상대 링크 정상; migration append-only·test-budgets 정상 |
| 화면 | 실제 컴포넌트 fixture 브라우저: 노트2개 순서, 정상 back/상세, 개별 stop, light/dark 파랑·hover, Explorer border 0px와 자식 Read 표시 |
| 저장소 | `git diff --check` 통과. 검증용 preview 파일은 제거했고 커밋 trailer는 생성 후 파싱하여 확인 |

초기 전체 실행의 종료 시간 회귀 1건은 테스트 작성과 구현이 겹친 RED였다. 수정 후 230파일·1679테스트를 다시 실행하여 통과했다. 반환 타입·미사용 import·출력 참조 fixture 타입도 정적 검사에서 수정한 뒤 최종 lint/typecheck를 재실행했다. 이력상의 실패를 처음부터 통과한 것으로 바꿔 적지 않는다. 최종 스크립트 및 테스트의 중복 범위는 합산하지 않는다.

브라우저 fixture는 IPC 경계가 fake이며 외부 SDK를 실행하지 않았다. 실제 SDK의 별도 loopback 관측은 0231 증거 문서에 있다. 독립 verify가 다음 단계이며 0231의 조건부 배포 실기 대기는 그대로 남는다.

## [구현자 기입] Review Signals

- 구현 r1. 사용자 미리보기의 추가 제품 결정은 D-07~11로 보존했으며 공식 verify 재구현은 아직 없다.
- 초기 테스트가 callback 함수만 확인하던 경계를 독립 리뷰가 지적하여 실제 JSX 이벤트→store/IPC 검사를 추가했다.
- 전체 회귀를 병렬 개발 중 실행하면 작성 중인 RED 테스트를 읽을 수 있었다. 모두 소유권을 해제한 뒤 전체 renderer 회귀를 다시 실행했다.
- Windows 부하 때문에 최종 전체 회귀는 worker 2개로 제한했고, 비DB 테스트는 Vitest 직접 실행하여 Electron ABI를 유지했다.
- 독립 코드 리뷰와 브라우저 컴포넌트 fixture 확인을 수행했다. 설치된 Electron 전체 UI·외부 모델/원격 worker 실기 및 handoff verify를 대체하지 않는다. 0231 AC19~22의 조건부 배포 검증 상태는 바꾸지 않았다.

## ΔV2 — 실제 모델과 셸 백그라운드 전환

작성자 **Codex**. 설계 READY, 기준 `4ae1cfaa`의 V1 + ΔV1. 위 구현 r1 보고는 당시의 증거이고 이번 추가 동작의 완료 판정이 아니다. 사용자 첨부 `codex-clipboard-3c27d868-ada8-468e-8f04-0e69d91cd373.png`와 `codex-clipboard-d2b50326-b0b2-4b16-b785-e325d524e186.png`는 표시 제거 범위의 근거다.

### Product / 흐름과 AC

| R / AT / AC | provenance | 관측 가능한 동작 / 직접 검증 |
|---|---|---|
| R-03 / AT-11 / AC11 | CHANGED | canonical·legacy Explorer 목록에서 실제 child message.model을 친근한 모델명으로 표시. live·완료·reload 보존, 미관측은 모델 확인 중/알 수 없음. 모델 요청값·부모 현재 모델로 추정하지 않음 |
| R-03 / AT-12 / AC12 | CHANGED | 완료/실패/중단 카드의 결과·summary·실패 receipt 본문 없음. 제목/상태/시간/도구 수·개별 중단 유지 |
| R-06 / AT-13 / AC13 | CHANGED | nonExplorer 선택 상세에는 ToolCard 본문만 있음. 별도 summary/error/output refs·파일 읽기 controls 없음. 호출 미연결은 짧은 안내만, raw task JSON을 대신 표시하지 않음 |
| R-07 / AT-14 / AC14 | NEW | Code 실행 중 foreground Bash/PowerShell ToolCard 본문 하단 우측 파란 전환 버튼. 클릭한 동일 toolUseId만 SDK 전환하고 원래 프로세스·출력/종료를 유지하며 패널에 표시 |
| R-07 / AT-15 / AC15 | NEW | foreground 셸은 실행/성공/실패/중단·reload와 직접 선택 모두에서 패널 제외. 명시 background 요청/실제 전환/관측된 background는 표시하고 종료·snapshot 제외 후에도 유지 |
| R-07 / AT-16 / AC16 | NEW | 완료·이미 background·Work에는 전환 버튼 없음. 빈 ID/이전 세대/연결 종료/중복 요청 거부. SDK false·예외·응답 지연은 짧은 오류와 재시도, 세션 이동 뒤 다른 패널을 열지 않음 |

대화록의 실제 결과는 유지한다. 제거 범위는 카드 아래 결과와 nonExplorer 상세의 ToolCard 형제 블록이다. SDK raw/journal·snapshot 및 읽기 API 자체는 유지하고 새 자동 읽기를 만들지 않는다. 기존 foreground Explorer의 패널 표시는 유지하며 foreground **셸**의 표시 범위를 바꾼다.

### Research / Technical Delta

설치 SDK `sdk.d.ts`의 `Query.backgroundTasks(toolUseId)`는 진행 중 실행을 단건 전환한다. 실제 `sdk.mjs`는 `background_tasks` control 요청에 ID를 전달하며, 동봉 CLI의 Bash·PowerShell은 동일 local_bash registry의 기존 shellCommand.background를 사용한다. CLI registry 등록 이전에는 false가 가능하므로 실패를 성공으로 표시하거나 명령을 다시 실행하지 않는다.

AS-IS: canonical이 task 전체와 failed call을 목록에 올리고, Agent 대신 toolName을 표시한다. nonExplorer ToolCard 밖에 결과와 출력 읽기 UI를 추가하며, 기존 전환 IPC는 Agent 사용자 경로만 있다. TO-BE는 아래 경계에 책임을 둔다.

| 경계 / §10 지점 | 구현 책임 / 전수 분모 |
|---|---|
| EP-Δ2-01 모델 | 공유 call.model 계약·mapper child model 정규화(2), canonical·legacy 모델 소비(2) = 4 |
| EP-Δ2-02 표시 | canonical 카드와 상세, 공통 패널 선택 투영, SubAgentTileHeader의 같은 선택 필터 = 4 |
| EP-Δ2-03 전환 | 요청 타입/스키마·preload·renderer API(3), main 등록·controller 검증(2), 기존 Runtime→SDK 단건 포트(1), ToolCard·전환 액션 컴포넌트(2) = 8 |
| EP-Δ2-04 판별 | shared reducer의 단조 backgroundObserved, 공통 셸/표시/전환 후보 predicate = 2 |

ΔV2 분모는 18이며 기존 12지점 회귀와 중복되므로 합산하지 않는다. backgroundObserved는 snapshot 포함, isBackgrounded:true, 확인된 background/remote mode에서만 누적한다. 명시적 run_in_background 요청은 pending 표시 근거일 뿐 관측 사실로 승격하지 않는다. 과거 포함 기록은 snapshot 제외·완료로 지우지 않으며 replay로 복원하되 live 연결 권한과 분리한다.

공개 호출은 `promoteBackgroundTask({sessionId,generation,toolUseId})` → 새 단건 IPC → BackgroundController → 기존 runtime.backgroundTask(toolUseId)다. controller는 현재 세대·연결·실제 실행 중 셸 call을 확인하고 중복을 막으며 SDK 응답 대기를 제한한다. true만 확인된 전환으로 기록하고, 응답 뒤 세대 교체/폐기를 다시 확인한다. 반환된 tool_result/task/snapshot이 원래 호출과 작업을 연결하며 stopTask는 실제 taskId를 계속 사용한다.

전환 가능 여부는 공개 `task_started`의 같은 generation/toolUseId·local_bash·isBackgrounded:false·실행 중 상태로 확인한다. 등록 전 버튼은 비활성이고 임의 2초 타이머로 활성화하지 않는다. SDK의 true는 단건 전환 확인이며 임의 task를 만들지 않는다. PowerShell도 실제 반환의 backgroundTaskId를 Bash와 같은 방식으로 연결한다.

모델은 child assistant의 parent_tool_use_id에 해당하는 canonical call에 실제 message.model을 저장한다. 기존 legacy 이력은 subagentMeta.model을 사용한다. JSON journal의 선택 필드와 reducer 파생만 추가하므로 SQL migration은 없다. 렌더에서 모델 도착 전에도 다른 카드 필드를 읽을 수 있으며 모델 표시를 위해 추가 SDK 호출을 하지 않는다.

### V nodes / pairs / 운영 gate

R-03·R-06은 위 기준선의 CHANGED, R-07·SD-02(전환 수명)·AR-02(단건 요청 경계)·MD-03(관측/모델 판별)와 AT-11~16·ST-02·IT-02·UT-03은 NEW다. 기존 D-01~11과 AC1~10의 이번 델타 외 동작은 유지한다.

| Pair | left ↔ right | requiredness | production 경로 / 직접 oracle | §10 |
|---|---|---|---|---|
| VP-Δ2-01 | R-03 ↔ AT-11,12 | REQUIRED | child model→mapper→journal/state→목록; 실제 모델 값·결과 본문 부재와 상태 양성 | EP-Δ2-01,02 |
| VP-Δ2-02 | R-06 ↔ AT-13 | REQUIRED | 카드 선택→상세; ToolCard 입력/결과 보존 및 형제 출력 블록 부재 | EP-Δ2-02 |
| VP-Δ2-03 | R-07 ↔ AT-14~16 | REQUIRED | 실제 버튼→IPC→runtime.backgroundTask→확인 이벤트→패널; 정확한 ID·같은 실행·실패/비대상 상태 | EP-Δ2-02~04 |
| VP-Δ2-04 | MD-03 ↔ UT-03 | REQUIRED | raw/snapshot→순수 reducer/predicate; foreground/관측/요청 구분·완료/replay·모델 보존 | EP-Δ2-01,04 |
| VP-Δ2-05 | AR-02 ↔ IT-02 | REQUIRED | preload 요청→실제 등록 handler→controller→live port; 두 ID·이전 세대·중복·false·예외 | EP-Δ2-03 |
| VP-Δ2-06 | SD-02 ↔ ST-02 | REQUIRED | foreground start→control→launch receipt→terminal/reload; 같은 작업의 전환과 foreground 종료 제외 | EP-Δ2-03,04 |

기존 VP-03·06·07·Δ01~04는 REGRESSION으로 재실행하며 나머지 기존 pair는 관련 renderer 통합 회귀로 유지한다. 모든 새 oracle은 실제 상태·DOM·IPC/SDK 결과를 직접 관측하므로 별도 구조적 mutation은 선택하지 않는다. 기존 코드 테스트를 유지하면서 새 전환·관측 동작은 RED→GREEN으로 검증한다.

운영 gate: 관련 shared/mapper/controller/preload/renderer Vitest 직접 실행, lint/typecheck/build, inventory 생성·상대 링크·IPC 문서, diff/trailer 검사. 실제 SDK 단건 전환은 로컬 loopback 증거를 확보하며 설치본/외부 배포 한계는 별도로 적는다. 사용자 요청에 따라 기존 PR #452를 갱신한다.

READY self-review: D-12~16과 AC11~16·pair6개·18책임 지점 연결을 확인했다. 요청한 기존 실행의 전환은 공개 SDK와 동봉 CLI에 존재한다. 추가 제품 결정이나 신규 의존성은 없다.
