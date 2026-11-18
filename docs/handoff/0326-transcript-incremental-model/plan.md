# Plan — 0326-transcript-incremental-model

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력: [0325 plan §6-C B 행 · §6-D](../0325-ui-responsiveness-followup/plan.md) · 0325 첨부 [`input/0324-agent-requests.ko.md`](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md)(요청서 — 본문의 `T02`~`T25`) · [`input/0324-audit.ko.md`](../0325-ui-responsiveness-followup/input/0324-audit.ko.md)(감사) · PR #635 사용자 코멘트 3건([종합 리뷰](https://github.com/muzaby/orca-skin/pull/635#issuecomment-6979343374) · [턴 단위 이력 로딩](https://github.com/muzaby/orca-skin/pull/635#issuecomment-6981397529) · [세 화면 뷰포트 통합](https://github.com/muzaby/orca-skin/pull/635#issuecomment-6981973229)).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0326-transcript-incremental-model` |
| 작성자 | Claude Code |
| 일자 | 2026-11-18 |
| 매핑 | 0325 후속 단계 B — 요청서 T02·T03·T04 잔여·T05·T06 잔여·T07·T11·T12 잔여·T16·T17·T18·T25 · 감사 memo 설계 항목 · 단계 E 와의 앞삽입 계약 |
| 상태 | READY (V1 rev 2) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0325·0324 노드는 INHERITED REGRESSION 으로만 참조(`0325:V1 rev 4 + ΔV1` — 설계 `5923d9a`·`211afa7`, 브랜치 `ccr-da0cf78b-aemqjb` · `0324:V1 rev 4.9@22a6d06`) |
| 이번 V revision | `V1 rev 2` — PR #635 사용자 코멘트 3건 반영(구현 전 규범 정정이라 Delta V 가 아니다). rev 1 = `db0b611`. 설계 커밋 좌표 `(V1 rev 1·2 — 검증자 기입)` |
| 유효 V | `V1 rev 2` |
| 구현 착수 조건 | 0325 기계 verify PASS 커밋을 받아 §18 영향 파일과 AC 를 다시 대조한 뒤(D-050). 이 plan 의 AS-IS 는 0325 r1 구현 `52b5272` 다 |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 확정 이벤트 한 건마다 창이 화면 밖 이력 전체를 다시 읽는다 — 10,000 exchange 에서 Work 결과 19.5ms · OpenCode head 재투영 36.8ms(행 40,996개 전부 새 객체) · OpenCode 패널 21.0ms(§8 M1). 메시지에 번호가 없어 다시 열기·앞삽입에서 같은 메시지를 알아보는 기준이 자리·시각뿐이다. 세 화면(Claude Code · Claude Work · OpenCode)이 서로 다른 가상화·스크롤 보정을 쓰고, Claude 는 마지막 exchange 를 통째로 마운트한다(§8 F2·F19·F26).
- **완료 후 달라지는 것**: 메시지마다 에이전트 호스트가 붙인 번호가 있고 창·DB 가 같은 번호를 쓴다. 세 화면은 하나의 공통 뷰포트로 표시 블록을 가상화한다 — 현재 답변이든 과거 답변이든 보이는 블록만 마운트하고, 블록 key 는 메시지 번호와 part·도구 호출 id 라 앞삽입·그룹 재편·다시 열기에서 바뀌지 않는다. store 는 변경 종류(끝 추가·한 메시지 교체·삭제·앞삽입·전체 교체)를 알리고, 블록 모델·패널 색인은 변경 기록이 지목한 메시지만 읽는다. 이전 턴을 앞에 붙여도 읽던 문장은 같은 화면 높이에 남는다.
- **기록이 끊기면 전체**: 변경 기록은 64개까지 보관한다. 소비자가 그보다 오래 갱신하지 않았거나 전체 교체(첫 로드·다시 열기)면 그 소비자는 전체를 한 번 다시 만든다(D-031·D-032).
- **보장하지 않는 것**: 블록 목록 청크 배열 복사(B2)·첫 로드와 전체 교체의 전체 투영(B1 — 페이지는 단계 E)·loose list·긴 문단 꼬리 파싱(B9 — 단계 C 워커)·T17·T18 이주(B12 — W 판정).
- **한 문장**: 긴 세션에서 답변·타이핑·스크롤이 겹쳐도 창의 일은 바뀐 메시지와 보이는 블록에 묶이고, 다시 열거나 이전 턴을 앞에 붙여도 읽던 자리·펼친 카드·선택이 그대로다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 325에서 지정했던 새 핸드오프 후보를 이어서 진행한다(핸드오프 325 후속)" | 턴 1 |
| 명시 요구 | 후속 단계 = "B (Recommended)" · 분할 = "B 전체 하나로" · 메시지 번호 = "D. 에이전트 부여 (Recommended)"("Agent process가 번호를 붙이면 안되는건가?") | 턴 1 질의 답 |
| 명시 요구 | "플랜 변경 요청 및 보완점 코멘트 추가됐다. 검토하고 반영하라" | 턴 4 |
| 명시 요구(코멘트 1) | "0326 V1 · db0b611 · Plan 판정: 수정 후 READY. 0325 단계 B를 하나로 묶고 agent가 메시지 번호를 발급하는 결정은 유지할 수 있습니다" — 11행(§8 V1~V11) | PR #635 종합 리뷰 |
| 명시 요구(코멘트 2) | "기존 세션을 열면 가장 최근 대화 한 턴을 먼저 표시하고 스크롤을 맨 아래에 둡니다 … 0326 단계 B: D-027·AC10·B3에 반복 앞삽입 시나리오를 반영합니다 … 이미 1턴을 읽은 경우와 100턴을 읽은 경우에 각각 1턴을 앞에 붙여 기존 메시지 방문 수·새 행 할당 수·프레임 누락을 비교합니다" | PR #635 턴 단위 이력 로딩 |
| 명시 요구(코멘트 3) | "0326에서 세 화면이 동일한 TanStack Virtual 기반 뷰포트를 실제로 사용하도록 설계를 변경해 주십시오" · 공통 경로와 소유권 · 구현 순서 · 완료 기준 5행 | PR #635 뷰포트 통합 |
| 추론 의도 | 단계 E(세션 페이지 조회·당김·스피너)는 E 가 구현하고, 0326 은 앞삽입 소비 경로를 고정 입력으로 잠근다 — 코멘트 2·3 이 둘을 나눠 적었다 | 설계자 — D-044·D-048 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0326 은 0325 후속 단계 B 다 — §6-C B 행의 대응 T 전부와 감사 memo 설계 항목 | "B (Recommended)" | 턴 1 질의 답 | ACTIVE | — |
| D-002 | B 를 나누지 않고 한 handoff 로 둔다 — AC 25 상한을 넘는다(§7 AC1~AC34) | "B 전체 하나로" | 턴 1 질의 답 | ACTIVE | — |
| D-003 | 이번 산출은 plan(READY)까지다. 구현 착수는 0325 verify PASS 뒤다 | B 가 0325 와 같은 파일을 바꾼다 | 설계자 · 턴 1 질의 본문 | ACTIVE | D-050 보완 |
| D-004 | 메시지 번호는 에이전트 호스트가 붙인다. 이벤트와 함께 창·데이터 호스트에 가고, 데이터 호스트가 저장하며, 세션 로드는 그 번호를 돌려준다 | "D. 에이전트 부여" | 턴 1 질의 답 · 코멘트 1 "유지할 수 있습니다" | ACTIVE | — |
| D-005 | 번호 접두 7(`a`·`u`·`m`·`n`·`x`·`r`·`c`) | — | 설계자 | SUPERSEDED | D-028 — 받은 입력 uuid 와 요청 id 가 같은 문자열이면 `u:` 에서 겹친다(§8 V4) |
| D-006 | 번호가 바뀌면 새 메시지 | — | 설계자 | SUPERSEDED | D-029 — 늦은 A→B→A·재커밋에서 마지막 행만 보면 행·버블이 겹친다(§8 V4) |
| D-007 | 원본 투영 번호 = 묶인 로컬 행 중 가장 앞 행의 안 쓴 번호 | — | 설계자 | SUPERSEDED | D-030 — 앞삽입으로 "처음 처리한 원본" 이 바뀌면 번호가 옮겨 가고 i4·EP-3 이 서로 다르게 읽힌다(§8 V5) |
| D-008 | 공개 계약 변경 — 창 이벤트 8종 `messageKey` · `message.committed.messageKey` · 피어 `turn.commitUser` 배치·`turn.askAnswers` 묶음 `messageKey` · `LoadedMessage.id`(필수) · 마이그레이션 `0036_message_key.sql`(nullable 열 + 부분 유일 색인) | D-004 의 비용 | 턴 1 질의 답 · 설계자 | ACTIVE | — |
| D-009 | 변경 기록 = 배열 키 side-table `{ base, from }` | — | 설계자 | SUPERSEDED | D-031 — 값이 base 배열을 강하게 잡아 최신 배열 하나가 조상 전부를 살린다(§8 V1) |
| D-010 | 방문 = 메시지 `parts` 읽기 · 할당 = 새 블록·행·도메인 출력 · 배열 복사 제외 | — | 설계자 | SUPERSEDED | D-032 — "첫 변경 이후" 가 아니라 "변경 기록이 지목한 범위" 로 센다(§8 V2) |
| D-011 | 패널 색인 = 첫 변경 이후 접미 철회·재적용 | — | 설계자 | SUPERSEDED | D-033 — 과거 한 칸 교체가 뒤 이력 전부를 읽고, 같은 메시지의 무관 변경이 revision 을 올린다(§8 V2·V3) |
| D-012 | OpenCode 행 key = exchange 첫 메시지 번호 + 종류별 순번 | — | 설계자 | SUPERSEDED | D-034 |
| D-013 | Claude exchange·turn `id` = 첫 메시지 번호, React key 로 사용 | — | 설계자 | SUPERSEDED | D-034 — 이전 user 앞삽입·선두 assistant 앞 질문 복원에서 첫 메시지가 바뀐다(§8 V5) |
| D-014 | `Exchange`·`AssistantTurn` memo 를 참조 비교로 | 감사 memo 표 | 감사 | SUPERSEDED | D-035 — 블록 단위 렌더로 바뀐다 |
| D-015 | 분절 캐시 — 마지막 segment 이전 segment 는 이전 객체 | — | 감사 | SUPERSEDED | D-036 — 뒤 결과가 앞 tools segment 를 바꾼다(s3)와 모순(§8 V6) |
| D-016 | delta — 같은 세션·같은 종류 연속 delta 를 한 번에 반영. 생성 중 세션 키는 현행 유지(1,000 세션 0.148ms — 0325 D-043) | — | 요청서 T02 · 0325 D-043 | ACTIVE | — |
| D-017 | 마지막 exchange 블록 > 200 이면 앞 블록만 가상화, head 가 되면 해제 | — | 설계자 | SUPERSEDED | D-037 — head 가 되는 순간 5,000 블록을 다시 마운트한다(§8 V7) · 코멘트 3 "AC22/t6을 교체합니다" |
| D-018 | 펼침 상태 store(세션 삭제 시 지움) | — | 감사 | SUPERSEDED | D-038 — 지우는 사용자 흐름을 정하라(§8 V8) |
| D-019 | 접은 본문은 `transitionend` 뒤 해제 | — | 요청서 T12 | SUPERSEDED | D-039 — 종료 이벤트가 안 오면 본문이 남는다(§8 V8) |
| D-020 | OpenCode 긴 선택 300 초과 축소 · 복사 순간 `flushSync` | — | 요청서 T06 | SUPERSEDED | D-040 — 세 화면 공통 · 실패 시 기존 동작 조건 · 키보드 확장(§8 V7) |
| D-021 | 버블 측정 캐시 키 = `textContent` 해시·`clientWidth`·배율 | — | 요청서 T16 | SUPERSEDED | D-041 — 해시·`clientWidth` 도 읽기이고 같은 값이어도 높이가 달라질 수 있다(§8 V8) |
| D-022 | 열린 펜스 꼬리는 remark 없이 코드 블록 | — | 요청서 T07 | SUPERSEDED | D-042 — `advanceStableBlocks` 가 미완료 꼬리를 매 delta 다시 스캔한다(§8 V9) |
| D-023 | T07 워커 파서·T12 워커 요약·T05·T11 의 W 는 단계 C 의 공통 워커 요청 규약 뒤다. B 는 R 증분으로 같은 목표(무관 방문 0)를 닫는다 | 요청서 "공통 워커 요청 규약은 워커 담당자가 소유한다" | 요청서 · 0325 §6-A | ACTIVE (사용자 거부 가능) | — |
| D-024 | T17·T18 은 측정 우선 — 코드를 바꾸지 않고 측정 입력·실창 시나리오(§19 S8·S9)를 더한다. 판정은 W(0325 D-025) | 0325 D-019 | 0325 D-019 · D-025 · 코멘트 1 "추가 차단 의견이 없습니다" | ACTIVE | — |
| D-025 | 측정 스크립트 J1~J8 | — | 설계자 | SUPERSEDED | D-043 — 초회 구성·정상 증분·캐시 적중을 나눠라(§8 V10) |
| D-026 | 0325 D-004(0324 D-007·D-008·D-009·D-011·D-012·D-014·D-045 승계) · D-015 · D-021 · D-022 · D-030 · D-033 · D-034 · D-035 · D-043 을 따른다. 0325 D-023·D-025 는 OPEN 이고 이 handoff 는 기대지 않는다 | 0325 §3 ACTIVE | 0325 plan §3 | ACTIVE | — |
| D-027 | 앞삽입은 기록 0(전체) · 기존 번호·key 유지 · 객체 새로 | — | 설계자 | SUPERSEDED | D-044 — 반복 앞삽입 시나리오(코멘트 2·3) |
| D-028 | 번호 접두 8 — `a:`(에이전트 assistant) · `u:`(큐 요청 id 사용자 커밋) · `i:`(받은 입력 — `i:<uuid>` · uuid 없으면 `i:n:<원본 id>` · 둘 다 없으면 `i:g:<새 uuid>`) · `m:`(번호 없는 로컬 행) · `n:`(번호를 받지 못한 원본 메시지) · `x:`(복구 보관본) · `r:`(창이 이벤트 번호 없이 만든 메시지) · `c:`(하위 작업 대화 합성). 고아 메시지는 행 번호 + `#o`. 세션 안에서 유일하다 | "재시도 commit, 같은 세션에서 늦은 A → B → A 키, 수신 uuid와 요청 id의 동일 문자열을 구분하십시오" | 코멘트 1 | ACTIVE | D-005 대체 |
| D-029 | 번호는 메시지를 가리킨다 — writer 는 (세션, 번호) 행이 있으면 그 행에 붙이고(현재 행이 아니어도) 없으면 새 행을 만든다. 창 reducer 도 그 번호의 메시지가 있으면 그 메시지에, 없으면 끝에 새 메시지를 둔다. 같은 번호의 사용자 재커밋은 기존 행 id 를 돌려주고 행을 만들지 않는다. 같은 번호에 역할이 다르면(접두 위반) 저장 실패다. 번호 없는 이벤트는 지금 경계다 | "부분 UNIQUE 위반을 곧바로 저장 실패로 처리하거나 마지막 행만 보고 새 메시지를 만들면 재전달 시 행·버블을 중복시키거나 저장을 중단할 수 있습니다. 허용 순서와 동일 이벤트 재생/실제 충돌의 처리를 정하고 DB·창을 함께 단언하십시오" | 코멘트 1 | ACTIVE | D-006 대체 |
| D-030 | 원본 투영 번호 — 로컬 행의 번호는 그 행에 묶인 원본 중 **가장 뒤(최신)** 원본이 갖는다. 나머지 원본과 묶인 행이 없는 원본은 `n:<원본 id>`, 묶인 행에 번호가 없으면 그 행의 가장 뒤 원본이 `m:<DB id>` 다. 앞삽입은 더 앞의 원본만 더하므로 소유가 옮겨 가지 않는다 | "페이지 앞삽입으로 '처음 처리한 원본'이 바뀌면 기존 메시지의 소유 번호가 옮겨갑니다" · i4·EP-3 두 읽기 | 코멘트 1 · 설계자 | ACTIVE | D-007 대체 |
| D-031 | 변경 기록 — reducer 가 `messages` 를 바꿀 때마다 `ChatState.transcriptChanges`(세션별)에 종류별 항목 1개를 남긴다: `append{ids}` · `replace{id, partsFrom}` · `remove{ids}` · `prepend{ids}` · `reset`. 항목은 번호·숫자만 담고 배열을 잡지 않는다. 보관은 최근 `TRANSCRIPT_CHANGE_LOG_MAX = 64` 개, `revision` 은 단조 증가다. fork·새 세션은 빈 기록, 세션 엔트리를 지우면 기록도 사라진다 | "보유 이력을 실제로 제한하고 다중 소비자·fork·세션 제거까지 검사하십시오" · "store는 세션별로 끝 추가, 특정 메시지/part 교체, 삭제, 앞삽입, 전체 교체를 구분해 알립니다" | 코멘트 1·3 | ACTIVE | D-009 대체 |
| D-032 | 방문·할당은 변경 종류별로 센다 — `append` 는 추가된 메시지(+그룹 경계에 필요한 직전 메시지 1), `replace` 는 그 메시지의 `partsFrom` 이후 part(+늦은 결과가 가리키는 원래 호출 1), `remove` 는 지운 메시지, `prepend` 는 추가된 메시지(+경계에 필요한 직후 메시지 1), `reset`·기록 끊김은 전체. 방문 = 메시지 `parts` 읽기와 part 필드 읽기, 할당 = 새 블록·행·도메인 출력 객체. 블록 목록 청크 배열 복사는 세지 않는다(B2) | "첫 변경 위치와 변경 범위는 다릅니다 … append·과거 한 칸 수정·삭제·그룹 경계 변경·앞삽입을 분리하고 실제 방문/할당을 따로 단언하십시오. 64단계 초과 fallback도 §1에 반영하십시오" | 코멘트 1 | ACTIVE | D-010 대체 |
| D-033 | 패널 색인 — 변경 항목마다 그 메시지의 기여만 갱신한다(`replace` 는 `partsFrom` 이후 part 의 기여만 더하고, 앞 part 가 바뀐 `replace` 는 그 메시지 기여를 다시 계산). 도메인 revision 은 그 도메인 키의 값이 실제로 달라질 때만 오른다(같은 값 재적용 = 불변). 자식 대화·하위 작업 상세는 부모 toolRunId 마다 revision 이 따로다. 뷰는 불변 스냅샷이다 — 이전에 받은 뷰는 뒤 갱신에도 값·참조가 같다. 같은 키의 기여 순서는 메시지 순번(끝 추가는 증가, 앞삽입은 감소)으로 정한다 | "같은 메시지에 TaskCreate 기여가 있고 text만 추가될 때 … 변하지 않은 도메인까지 revision을 올릴 수 있습니다. 부모 A·B의 child 뷰도 독립성이 필요합니다. B15의 예전 lookup이 새 Map 값을 보는 정책은 render 시점의 snapshot을 깨뜨립니다" | 코멘트 1 | ACTIVE | D-011 대체 |
| D-034 | 블록 key = 메시지 번호 + 논리 part·도구 호출 id — user `<id>:user` · text/reasoning/error/compact `<id>:<kind>:<그 메시지 안 같은 종류 part 순번>` · 도구 `<toolRunId>`(Work 활동 묶음 = 첫 도구 `<toolRunId>:activity`) · 턴 메타·산출물 `<턴 첫 assistant 메시지 id>:meta`·`:artifacts` · live `live:<세션 키>`. OpenCode 의 메시지를 가로지르는 text 병합 segment 는 첫 part 의 메시지 번호·순번을 쓴다. 그룹(exchange·turn) 경계는 블록 key 에 들어가지 않는다 | "위치·시각·현재 exchange의 첫 메시지에만 의존하는 key는 앞삽입이나 그룹 재편 때 바뀝니다. 안정 메시지 ID와 논리적 part·도구 호출 ID를 사용하고, 그룹 경계와 개별 블록의 생명주기를 분리합니다" | 코멘트 3 | ACTIVE | D-012·D-013 대체 |
| D-035 | 블록 렌더 컴포넌트 memo 는 블록 객체 참조로 비교한다 — 블록 모델은 내용이 같은 블록을 같은 객체로 돌려준다 | 감사 memo 표 "이전 행의 참조를 유지하면 얕은 비교로 충분" · 코멘트 3 "메모이제이션은 이 변경 범위를 확정한 뒤 적용" | 감사 · 코멘트 3 | ACTIVE | D-014 대체 |
| D-036 | 분절 캐시 — 같은 번호 메시지의 parts 가 앞을 유지한 채 늘면 마지막 segment 시작부터 다시 자른다. 뒤 `tool_result` 가 가리키는 앞 호출은 그 ToolCall 과 그것이 든 segment 만 새 객체고 형제 호출·다른 segment 는 이전 참조다. 앞 part 가 바뀌면 전체를 다시 자른다. 결과는 `messageSegments` 와 같고 `reconcileSegments` 는 지운다 | "바뀐 호출·포함 segment만 예외, 형제 참조 유지로 좁히십시오" | 코멘트 1 · 감사 | ACTIVE | D-015 대체 |
| D-037 | 공통 뷰포트 — 세 화면(Claude Code · Claude Work · OpenCode)의 Timeline 은 하나의 `TranscriptViewport` 로 표시 블록 전체를 가상화한다. 현재/과거 exchange 구분 없이 같은 블록 key·측정 캐시를 쓴다. 예약 공간·대기 표시·steer·오류 배너는 뷰포트의 꼬리 자리(비가상)에 하네스가 그리고, fork 는 마지막 assistant 턴 메타 블록에 있다 | "세 화면이 동일한 TanStack Virtual 기반 뷰포트를 실제로 사용 … 기존 '200 초과 tail의 앞만 가상화하고 head가 되면 해제' 규칙은 교체합니다. 현재/과거 전환만으로 key·측정 캐시가 바뀌거나 한 exchange 안의 DOM을 전부 마운트하지 않게 합니다" | 코멘트 3 | ACTIVE | D-017 대체 |
| D-038 | 펼침·포커스의 논리 상태는 세션 키 + 블록 key 로 store 에 둔다. 세션 엔트리를 버리는 다섯 흐름(다른 세션 첫 로드 취소 · 세션 없음 · 캐시 없는 로드 실패 · 외부 변경 무효화 · 목록에서 삭제 — 모두 `dropSession`)에서 지우고, 세션 전환·다시 열기(DB 교체)·원본 동기화에서는 남긴다. 전체 교체에서 지금 블록에 없는 key 는 버린다. 앱 재시작은 메모리라 사라진다 | "cache invalidation과 영구 세션 삭제가 펼침 상태를 함께 지워야 하는지 사용자 흐름별로 결정하십시오" — 지우는 다섯은 모두 다음 진입이 DB 에서 새로 읽는 흐름이다(§8 F27) | 코멘트 1·3 · 설계자 | ACTIVE (사용자 거부 가능 — 외부 변경 무효화에서 남기려면 별도 결정) | D-018 대체 |
| D-039 | 접은 본문 해제의 종료 조건 — 닫힌 뒤 `transitionend`(grid 행) · `transitioncancel` · 시한(전환 시간 + 100ms 타이머) 중 먼저 오는 것에 본문을 언마운트한다. 동작 줄이기면 즉시, 종료 전 다시 열면 남긴다. 어느 경로에서도 닫힘 뒤 본문이 남지 않는다 | "전환 종료 이벤트 미발생/취소·빠른 재열기에 본문이 계속 남지 않도록 종료 조건을 검증하십시오" | 코멘트 1 · 요청서 T12 | ACTIVE | D-019 대체 |
| D-040 | 선택 보존(세 화면 공통) — 선택 범위 블록 ≤ `SELECTION_MOUNT_MAX_BLOCKS = 300` 이면 범위 전체 마운트. 300 초과 ≤ `SELECTION_COPY_SYNC_MAX_BLOCKS = 2,000` 이면 양 끝·가시·앵커만 마운트하고, 복사 이벤트 안에서 범위 전체를 `flushSync` 로 마운트해 기본 복사가 읽게 한 뒤 다음 프레임에 되돌린다. 2,000 초과이거나 Shift 로 선택 확장을 시작하면 범위 전체를 마운트한다(지금 OpenCode 동작) | "기본 복사 결과·양방향 부분 선택·연속 Shift 선택·대규모 범위의 복사 지연과 DOM peak를 확인하고, 실패 시 기존 동작을 유지할 조건을 정하십시오" | 코멘트 1·3 · 요청서 T06 | ACTIVE (사용자 거부 가능 — 300·2,000 은 W 실측 뒤 조정) | D-020 대체 |
| D-041 | 버블 측정 — 공유 `ResizeObserver` 하나, 통지는 다음 프레임에 모아 읽고(버블당 ≤ 1) 읽기가 끝난 뒤 쓴다. 무효화 입력은 DOM 을 읽지 않고 얻는다 — 본문 prop 참조 · RO 통지의 `contentBoxSize` 폭 · 글자 배율 설정값 · 글꼴 토큰 버전. 넷이 같으면 그 버블은 읽기 0(`getComputedStyle`·`scrollHeight`·`getBoundingClientRect`·`clientWidth`·`offsetHeight`). 줄 높이는 (배율, 글꼴 버전)마다 전역 1회 | "같은 textContent·폭·배율이어도 자식 줄 배치·폰트 변화로 높이가 달라질 수 있고, hash·clientWidth 자체도 읽기입니다. 실제 무효화 입력 및 '읽기 0' 대상 API를 정하십시오" | 코멘트 1 · 요청서 T16 | ACTIVE | D-021 대체 |
| D-042 | Markdown 꼬리 — 꼬리 스캐너 상태(마지막 완결 줄 위치 · 펜스 열림 문자·길이·들여쓰기)를 delta 사이에 이어 새 완결 줄만 스캔한다. 꼬리가 닫히지 않은 펜스 하나뿐이면 remark 없이 같은 DOM 의 코드 블록으로 그린다. 펜스 판정은 CommonMark 규칙(백틱 펜스 info 의 백틱 금지 · 닫힘 줄 뒤 공백 외 문자 금지 · 들여쓰기 0~3 · CRLF)을 따르고 기존 파서와 차등 대조한다 | "열린 펜스에서 remark를 생략해도 advanceStableBlocks는 미완료 꼬리를 다시 split/scan합니다 … 100k 입력을 여러 delta로 보내 누적 스캔/렌더 비용을 측정하십시오" | 코멘트 1 · 요청서 T07 | ACTIVE | D-022 대체 |
| D-043 | 측정 스크립트 J1~J9 — 각 입력을 초회 구성 · 정상 증분 · 캐시 적중 세 갈래로 잰다 | "J1~J8에서 초회 구성·정상 증분·캐시 hit를 분리" | 코멘트 1 | ACTIVE | D-025 대체 |
| D-044 | 반복 앞삽입 — `PREPEND_HISTORY{messages}` reducer 동작이 `prepend{ids}` 를 기록한다. 블록 모델은 새 블록과 실제로 달라진 경계 블록만 만들고, 뷰포트는 삽입 전 읽던 블록의 (key, 화면 상단으로부터 픽셀 거리)를 기록해 측정이 끝난 뒤에도 같은 문장을 같은 높이에 둔다. 앵커 블록이 분할·병합되면 그 메시지 번호의 블록과 본문 위치로 찾는다. 하단을 보고 있을 때만 live 출력을 따라간다. 0326 은 생산자(조회) 없이 고정 입력으로 세 화면에서 "최신 턴 → 하단 배치 → 이전 한 턴 앞삽입" 을 재생한다 | "D-027·AC10·B3에 반복 앞삽입 시나리오를 반영합니다 … 1턴을 읽은 경우와 100턴을 읽은 경우에 각각 1턴을 앞에 붙여" · "0326에서 고정 입력으로 E 연동을 검증합니다" | 코멘트 2·3 | ACTIVE | D-027 대체 |
| D-045 | 스크롤 쓰기 주체는 공통 뷰포트 하나다 — `scrollTop` 쓰기·앵커 보정·하단 추적·TanStack 크기 변화 보정 설정을 뷰포트가 소유한다. OpenCode `ScrollController` 의 앵커 캡처·복원과 Claude `useScrollAnchor` 의 전송 앵커·pin 은 뷰포트 안 정책으로 옮긴다 | "OpenCode의 기존 보정기와 TanStack이 같은 높이 변경을 연속 보정하지 않도록 쓰기 주체를 한 곳으로 모읍니다" | 코멘트 3 | ACTIVE | — |
| D-046 | 하네스 블록 생성기 계약 — 스냅샷 `{ revision, count, keyAt(i), blockAt(i), indexOf(key) }` 와 하네스 `renderBlock(block)`. 스냅샷은 불변이고(지난 스냅샷의 값·참조 유지) delta 마다 전체 블록 배열을 만들지 않는다. 블록 목록은 64칸 청크의 영속 목록이다 | "구현 형태의 예는 블록 수, 위치로 안정 key/블록을 읽는 함수, key로 위치를 찾는 함수, 하네스별 블록 렌더 함수입니다. 매 delta마다 전체 블록 배열을 flatten해 넘기지 않도록 합니다 … React에 이미 반환한 스냅샷은 이후 갱신에도 같은 값을 보여야 합니다" | 코멘트 3 | ACTIVE | — |
| D-047 | live delta 는 그 본문 리프만 갱신한다(블록 모델·뷰포트 일 0). live 블록의 출현·완료·삭제는 구조 변경이다. 과거 도구 결과 하나는 원래 호출 블록과 그 결과에 기대는 패널 뷰만 바꾼다 | "이미 표시된 text에 대한 일반 delta는 해당 본문 리프만 갱신합니다. 새 블록 출현·완료·삭제는 블록 목록의 구조 변경으로 취급합니다" | 코멘트 3 · 0325 D-015 | ACTIVE | — |
| D-048 | 단계 E 인계 — 턴 단위 이력 로딩의 조회(최신 한 턴·이전 커서·이력 끝·거대 본문 인출), 세션별 요청 상태·같은 커서 중복 방지·live 병합, 상단 당김·스피너·짧은 최신 턴의 위 방향 입력·연쇄 조회 금지·실패 재시도·세션 전환 뒤 늦은 응답 격리는 E 가 한다. 0326 §6-E 표가 인계 항목이고 0325 D-023 에 연결한다 | 코멘트 2 표 "단계 E" 행 · 코멘트 3 §1 "단계 E의 data·renderer" | 코멘트 2·3 | ACTIVE | — |
| D-049 | AC33(Windows) 기록 — 칸은 값 · `N/A(이전 빌드: 사유)` · `미완료(새 빌드: 사유)` 셋 중 하나다. 이전 빌드의 예상된 실패만 N/A 이고, 새 빌드 필수 경로의 실패는 미완료로 AC33 을 닫지 않는다. 실측은 기계 verify PASS 뒤다 | "'값 또는 N/A'는 새 빌드 필수 경로 실패를 완료 처리할 수 있으므로 예상된 이전 실패와 새 빌드 미완료를 구별하십시오" · "새 빌드의 필수 측정 실패는 미완료로 기록합니다" | 코멘트 1·3 | ACTIVE | 0325 D-042 보완 |
| D-050 | 착수 전 재대조 — 0325 기계 verify PASS 커밋을 받아 §18 영향 파일의 diff 와 AC1~AC34 의 전제(§8 F 행)를 다시 확인하고 달라진 행을 [구현자 기입] 설계 리뷰에 적는다 | "0325 기계 PASS 기준 커밋을 받아 영향 파일과 0326 AC를 재대조한 뒤 착수한다는 조건을 유지하십시오" | 코멘트 1 | ACTIVE | D-003 보완 |
| D-051 | PR #635 의 제목·본문을 0326 단계 B 로 고친다 | "PR 제목·본문·handoff 경로가 0325 단계 A이고 실제 계획은 0326 B입니다" | 코멘트 1 | ACTIVE | — |

### 갱신 메모

- rev 1(턴 1): D-001~D-027.
- rev 2(턴 4 — PR #635 코멘트 3건): 추가 D-028~D-051. 대체 D-005→D-028 · D-006→D-029 · D-007→D-030 · D-009→D-031 · D-010→D-032 · D-011→D-033 · D-012·D-013→D-034 · D-014→D-035 · D-015→D-036 · D-017→D-037 · D-018→D-038 · D-019→D-039 · D-020→D-040 · D-021→D-041 · D-022→D-042 · D-025→D-043 · D-027→D-044. 지적은 코드·계산으로 확인한 뒤 반영했다(§8 V1~V11).
- 유지: D-001~D-004 · D-008 · D-016 · D-023 · D-024 · D-026. 코멘트 1 "0325 단계 B를 하나로 묶고 agent가 메시지 번호를 발급하는 결정은 유지할 수 있습니다" — D-002·D-004 그대로.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-004·D-008·D-028·D-029·D-030 ↔ AC1~AC6 · D-031 ↔ AC7 · D-032 ↔ AC8·AC10·AC21·AC29 의 방문 정의 · D-033 ↔ AC29·AC30 · D-034 ↔ AC9·AC22 · D-035 ↔ AC10·AC14 · D-036 ↔ AC13 · D-037·D-045 ↔ AC15~AC19 · D-044 ↔ AC20~AC23 · D-046 ↔ AC10·AC11 · D-047 ↔ AC12·AC14 · D-038 ↔ AC24 · D-039 ↔ AC25 · D-040 ↔ AC26 · D-041 ↔ AC27 · D-042 ↔ AC28 · D-016 ↔ AC31 · D-043 ↔ AC32 · D-049 ↔ AC33 · D-026 ↔ AC34 · D-023·D-024·D-048 ↔ §6 비범위·§6-E · D-003·D-050 ↔ 메타 · D-051 ↔ PR. AC6(같은 인스턴스) 과 AC24(재마운트 뒤 상태 복원)를 다른 단언으로 나눴다 — 코멘트 1 "AC6의 인스턴스와 AC23의 재마운트 후 상태 보존은 구별해야 합니다".

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 확정 이벤트 한 건 비용이 이력 길이에 비례함을 실제 함수로 쟀다 | §8 M1 |
| 이미 충족됐는가 | 일부 — Claude 그룹 참조 유지·OpenCode live 리프는 0325 가 닫았다. 가상화는 두 하네스가 따로 갖고 단위가 다르다(Claude exchange · OpenCode 행) | 0325 AC4·AC7 · §8 F2·F26 |
| 더 작은 해법이 있는가 | rev 1 은 하네스별 개선이었다. 코멘트 3 이 공통 뷰포트를 요구했고 그 편이 스크롤 쓰기 주체·선택·앞삽입 앵커를 한 번에 닫는다 | 코멘트 3 · D-045 |
| 선행 자료와 코드가 맞는가 | 정정 1 — 늦은 도구 결과는 이미 렌더 시 toolRunId 짝짓기로 원래 카드에 붙는다. 남은 일은 그 비용과 블록 단위 갱신이다 | `chatReducer.ts:1091-1100` |
| 기존 결정과 충돌하는가 | 해소 3 — 0102 "가상 head + 비가상 tail" 은 D-037 이 대체한다(예약 공간·대기는 뷰포트 꼬리 자리). 0008 예약 앵커 계약은 계산된 꼬리 간격으로 지킨다(AC17). 0325 D-019 는 D-024 로 따른다 | `Timeline.tsx:47-50` · `useScrollAnchor.ts:5-12` |
| 긴 선택을 모델 원문으로 복사하면 되는가 | 안 된다 — 블록 본문은 Markdown 원문이고 브라우저 복사는 렌더 텍스트다. 복사 순간에 범위를 마운트한다(D-040) | `opencode/transcript/Timeline.tsx:64-75` |
| 0326 이 턴 단위 조회까지 하는가 | 아니다 — 조회·커서·당김·스피너는 E(D-048). 0326 은 앞삽입 소비 경로(블록 모델·앵커)를 고정 입력으로 잠근다 | 코멘트 2 표 · 코멘트 3 §2 |

- 사용자에게 올릴 결정: 없음 — 코멘트가 정한 방향을 따랐다. "사용자 거부 가능": D-023·D-038·D-040.
- 코드 조사로 닫은 사실: §8 표 전부.

## 5. 동작 / 사용자 흐름

```text
에이전트 호스트: 이벤트 → 번호(새 메시지면 새 번호) ─┬→ 데이터 호스트: (세션, 번호) 행에 저장
                                                      └→ 창 reducer: 그 번호의 메시지(없으면 끝에 새 메시지)
창 store: messages + transcriptChanges(append · replace · remove · prepend · reset)
   → 하네스 블록 모델(Claude Code · Claude Work · OpenCode): 기록이 지목한 메시지의 블록만 새로 → 불변 스냅샷
   → 패널 색인: 그 메시지의 기여만 → 값이 바뀐 도메인만 revision
   → 공통 뷰포트(TanStack): 보이는 블록 + overscan + 선택·앵커만 마운트 · 앞삽입 앵커 보존 · 하단 추적
live delta: 본문 리프만
```

### 상태와 전이

| 상태 | 진입 | 표시 / 동작 | 종료 |
|---|---|---|---|
| 확정 이벤트 반영 | 도구 시작·결과·텍스트 완료·응답 경계·압축·하위 작업 | 그 메시지의 블록(+늦은 결과의 원래 호출 블록)만 다시 그림 | 다음 이벤트 |
| 사용자 발화 커밋 | 낙관 표시 또는 echo · 재커밋 | 같은 번호 — 다시 그리지 않음 · 재커밋은 행·버블 추가 없음 | — |
| 다시 열기(캐시) | 세션 전환 후 복귀 · 원본 동기화 | 전체 교체지만 번호가 같은 블록은 같은 key·같은 DOM 노드 | 다음 로드 |
| 새 질문 전송 | 마지막 답변이 과거가 됨 | 같은 블록·같은 측정 · 마운트 수 변화 없음 · 새 턴에 예약 공간·fork | — |
| 이전 턴 앞삽입(고정 입력 — 조회는 E) | `PREPEND_HISTORY` | 위에 붙고 읽던 문장 높이 유지 · 하단을 보던 중이면 하단 유지 | — |
| 긴 선택 | 선택 범위 > 300 블록 | 양 끝·가시·앵커만 마운트 · 복사 순간 전체 · Shift 확장 시작 또는 > 2,000 이면 전체 | 선택 해제 |
| 도구 카드 닫힘 | 연 카드를 닫음 | 종료 조건(D-039) 뒤 본문 언마운트 | 다시 엶 |

### 파생 UX / 엣지케이스

- 라이브에서 번호 없이 창이 만든 메시지(턴 끝 대기 텍스트 커밋 · fork 경계선)와 연속 실행 도착 메시지는 재로드에서 DB 번호로 바뀌어 그 메시지의 블록만 새 key 가 된다(B5).
- 원본 동기화가 라이브 메시지 하나를 원본 여럿으로 나누면 가장 뒤 원본이 라이브 번호를 잇는다(D-030) — 앞 원본의 블록은 새 key 다(B6).
- writer 만 만드는 `error` part 는 그 턴의 현재 번호 행에 붙는다(창은 배너). 재로드에서 그 메시지에 error 블록이 하나 늘 뿐 메시지 번호는 같다(B7).
- Claude live 본문(PendingAssistant)은 완료 시 확정 text 블록으로 바뀌며 key 가 달라진다 — 지금 Claude 동작과 같다(B14). OpenCode 는 0325 대로 같은 key 다.

## 6. 범위 / 비범위

- **범위**: WU-1~WU-14. 공개 계약 변경은 D-008 다섯 가지와 renderer 내부 reducer 동작 `PREPEND_HISTORY` 하나다.
- **비범위**: 단계 C(워커 규약 — D-023) · 단계 D · 단계 E(조회·커서·당김·스피너 — D-048 · §6-E) · W 판정(T17·T18 — D-024).

| WU | 요청 ID | 내용 | 런타임 소유자(위치) | AC |
|---|---|---|---|---|
| WU-1 | T03 선행 · B/E 공유 | 메시지 번호 — 발급 · 번호 대상 저장 · 로드 규칙 · 창 사용 | agent(송신기·조정자) · data(writer·reader·마이그레이션) · R(reducer) | AC1~AC6 |
| WU-2 | T03 | 종류별 변경 기록 · `PREPEND_HISTORY` | R(reducer·`changeLog`) | AC7 |
| WU-3 | T03 | 번호·순번 색인과 reducer/store 조회 | R(`messageOrder`) | AC8 |
| WU-4 | T04 · T05 · T06 head · 설계 항목 | 하네스 블록 모델 3종 · 블록 key · 불변 스냅샷 · 분절 캐시 · 늦은 결과 · live 리프 | R(`blockList` · `claudeBlocks` · `openCodeBlocks` · `segmentCache`) | AC9~AC14 |
| WU-5 | T04 잔여 · T06 잔여 · B10 | 공통 뷰포트 · 세 진입점 연결 · 단일 스크롤 쓰기 · 예약 공간·꼬리 자리 · 하단 배치 | R(`TranscriptViewport` · 두 Timeline · 두 ScrollController) | AC15~AC19 |
| WU-6 | 코멘트 2·3 · B/E 공유 | 반복 앞삽입 · 앵커 보존 · 고정 입력 재생 | R(뷰포트 앵커 · 블록 모델) | AC20~AC23 |
| WU-7 | 감사 · T12 일부 | 펼침·포커스 상태 store | R(`disclosureStore`) | AC24 |
| WU-8 | T12 잔여 · B15 | 접은 본문 해제 종료 조건 | R(Claude 도구 카드 블록) | AC25 |
| WU-9 | T06 잔여 · B5 | 선택 보존 정책(세 화면) | R(뷰포트 범위) | AC26 |
| WU-10 | T16 | 사용자 버블 측정 일괄 | R(`bubbleMeasure`) | AC27 |
| WU-11 | T07(R) | 꼬리 스캐너 상태 · 열린 펜스 | R(`markdownBlocks` · StreamingMarkdown) | AC28 |
| WU-12 | T11 · T25 | 패널 색인 · 소비자 전환 | R(`transcriptIndex` · 소비자 10파일) | AC29·AC30 |
| WU-13 | T02 | 같은 종류 delta 묶음 | R(`receiveDeltaBatch`) | AC31 |
| WU-14 | Windows 비교 · T17·T18 측정 | J1~J9 · S1~S9 · E 인계 | 개발 도구 · 사람 | AC32·AC33 |

| 요청 ID | 0326 처리 | 남는 것 |
|---|---|---|
| T02 | WU-13 · 생성 중 세션 키 현행 유지(D-016) | — |
| T03 | WU-1·WU-2·WU-3 | — |
| T04 잔여 | WU-4(그룹 증분 → 블록 모델) · WU-5(전체 블록 가상화) | — |
| T05 | WU-4(Work 블록 · 늦은 결과) · WU-5(보이는 블록만) | W 이주(D-023) |
| T06 잔여 | WU-4(head) · WU-9(선택) | — |
| T07 | WU-11 | loose list·긴 문단 꼬리(B9 — C) |
| T11 · T25 | WU-12 | W 이주(D-023) |
| T12 잔여 | WU-7·WU-8 | 요약·미리보기 W(D-023) |
| T16 | WU-10 | 실창(AC33 S5) |
| T17·T18 | 측정만(D-024 · S8·S9) | 이주 판정(W) |
| 감사 memo 설계 항목 | 비교자(D-035) · `reconcileSegments`(D-036) · Work 캐시(WU-4 늦은 결과 · WU-12 색인) · OpenCode memo 테스트 확장(AC10·AC14) | — |

### 6-E. 단계 E 인계 (D-048 — 0325 D-023 "이전 페이지 UX" 에 연결)

이 표는 E 의 입력 계약이다. 0326 verify 가 판정하는 열거 원문이 아니다. 0326 이 고정하는 소비 경로는 AC20~AC23 이다.

| 항목 | 소유자 | E 의 완료 기준(코멘트 2·3 원문 요지) |
|---|---|---|
| 최신 한 턴 · 이전 커서 · 이력 끝 · 거대 본문 인출 | data | 첫 화면 전에 읽고 전송·조립하는 양을 측정해 전체 이력을 먼저 처리하는 경로를 검출 |
| 세션별 요청 상태 · 같은 커서 중복 방지 · live 병합 | renderer store | 한 요청 진행 중 반복 스크롤로 같은 턴 중복 요청 0 · 이전 턴 조회 중 도착한 live 이벤트 병합 |
| 상단 당김 · 그 자리 스피너 · 이력 끝에서 종료 | 공통 뷰포트(0326 모듈의 확장) | 도착 턴을 위에 붙이고 스피너를 닫는다 — 순서 10 → 9 → 8 조회, 화면 8 → 9 → 10 |
| 짧은 최신 턴 | 공통 뷰포트 | 스크롤 영역이 없어도 위 방향 휠·트랙패드로 시작 · 상단이 보인다는 이유로 연쇄 조회 0 |
| 실패 · 재시도 · 세션 전환 | store · 뷰포트 | 실패 시 스피너 닫고 읽던 위치에서 같은 턴 재시도 · 세션 전환 뒤 늦은 응답은 현재 화면에 붙지 않음 |
| 조회 단위 · 마운트 단위 | data · 뷰포트 | 조회 = 사용자 발화 + 이어지는 응답·도구 결과 한 묶음 · 마운트 = 표시 블록(D-034) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 같은 턴 이벤트 열을 흘리면 창 목록과 저장 뒤 재로드 목록이 각각 고정 기대 리터럴과 같다(번호·role·part type 열). 열 = 사용자 발화 → reasoning → text → 도구 시작·결과 → 중간 steer 커밋 → 도구 → `telemetry` → 사용자 커밋 없는 연속 턴 text → 늦은 하위 작업 통지 → 같은 배치 재커밋 → 앞 번호 A 의 늦은 이벤트(B 뒤) → `error`. 두 기대의 차이는 재로드 쪽 `error` part 하나뿐이다(B7) | ST-01: 공유 고정 입력 `src/shared/message-identity.testfixture.ts` — main: 실제 송신기·receiver·writer·reader · renderer: reducer | 버스 → `onTurnEvent`(번호) → 피어 → writer → `loadSession` ‖ `relay` → reducer |
| R-01 | AT-01 / AC2 | 로드 메시지마다 세션 안 유일 번호 — 번호 행 = 그 번호 · 번호 없는 행 = `m:<id>` · 로컬 행이 원본 여럿에 묶이면 가장 뒤 원본이 행 번호, 나머지와 묶이지 않은 원본은 `n:<원본 id>` · 고아 = 행 번호 `#o` · 보관본 = 저장 번호 또는 `x:<순번>`. 원본 앞에 원본이 더해져도(앞삽입) 기존 메시지의 번호가 같다 | UT-02: `native-projection.test.ts`·`reader.test.ts` i1~i8 | `loadSession` → `localMessages`·`projectNativeHistory`·`recoveryArchive` |
| R-01 | AT-01 / AC3 | 송신기는 part 를 만드는 8종에 턴의 현재 번호(없으면 `a:<uuid>`)를 붙이고 사용자 커밋·`telemetry`·턴 끝에서 비운다. 질문 답 도구 완료(버스 밖)도 같은 번호. 사용자 커밋 번호 — 큐 배치 `u:<ids[0]>` · 받은 입력 `i:<uuid>` / `i:n:<원본 id>` / `i:g:<새 uuid>` — 요청 id 와 받은 uuid 가 같은 문자열이어도 번호가 다르다 | UT-01: `persistence-sender.test.ts` k1~k8 · `turn-coordinator.test.ts` k9~k11 | 버스 → `onTurnEvent`·`relay` · `flushAskAnswers` · `commitConsumed`·`input.received` |
| R-01 | AT-01 / AC4 | writer — (세션, 번호) 행이 있으면 그 행에 part 를 붙인다(현재 행이 아니어도 — 늦은 A). 없으면 현재 행 마감 뒤 새 행. 같은 번호 사용자 재커밋은 기존 행 id 를 돌려주고 행·part 를 더하지 않는다. 번호 행의 역할이 이벤트와 다르면 저장 실패. 번호 없는 이벤트는 지금 경계. 마이그레이션은 nullable 열·부분 유일 색인이고 옛 DB 가 열린다 | UT-04: `writer.test.ts` w1~w7 · `migrate.test.ts` w8 | `persistEvent` → `ensureAssistantMessage(…, key)` → `findMessageByKey`/`appendMessage` |
| R-01 | AT-01 / AC5 | 창 reducer — 이벤트 번호의 메시지가 있으면 그 메시지에(마지막이 아니어도), 없으면 끝에 그 번호로 새 메시지. 같은 번호 사용자 echo·재커밋은 무변경. 번호 없는 이벤트·창 합성은 지금 규칙(마지막 assistant 에 붙임 / 새 메시지면 `r:`). 로드는 `LoadedMessage.id` 그대로 | UT-03: `chatReducer.messageId.test.ts` r1~r9 | `RECV_EVENT` → `appendAssistantPart(messages, part, key)` · `APPEND_COMMITTED_USER_MESSAGE` · `LOAD_SESSION` |
| R-01 | AT-01 / AC6 | 캐시 세션을 다시 열어 같은 번호의 이력이 오면(전체 교체) 화면에 남은 블록은 같은 key·같은 DOM 노드다 — 열린 Claude 도구 카드는 언마운트 없이 열린 채다(같은 인스턴스). 세 화면 각각 | IT-01: `TranscriptViewport.reopen.test.ts` — 실제 store `loadSession`(가짜 `sessionApi`) + fake DOM 하네스 · 노드 동일성 | `loadSession` → `LOAD_SESSION(preserveLocalState)` → 블록 모델 `reset` → 뷰포트 |
| R-02 | AT-02 / AC7 | reducer 가 `messages` 를 바꾸는 모든 자리는 종류가 맞는 기록 1개를 남긴다(`append{ids}` · `replace{id, partsFrom}` · `remove{ids}` · `prepend{ids}` · `reset`). 기록은 배열을 잡지 않고 최근 64개만 남는다 — 1,000번 끝 추가 뒤 세션이 붙든 것은 지금 배열 하나와 기록 64개다. 소비자 셋(블록 모델·패널 색인·순번 색인)이 각자 마지막 revision 으로 따라오고, 64 를 넘게 밀리면 `reset` 으로 본다. fork 는 빈 기록 · 세션 엔트리 삭제는 기록과 함께 사라진다 | UT-05: `changeLog.test.ts` l1~l8 · 쓰기 자리 sweep `chatReducer.changeLog.test.ts`(자리마다 종류·ids·`partsFrom` 단언) | reducer 쓰기 도우미 → `recordChange` → `ChatState.transcriptChanges` |
| R-02 | AT-02 / AC8 | 산출물 소유·커밋 멱등·미확정 버블 회수·완료 통지 멱등·완료 작업 호출 탐색·번호로 메시지 찾기는 번호·순번 색인으로 한다 — 10,000 메시지에서 index 1 메시지의 산출물 한 건 교체·끝 결과 추가 각각에서 관계없는 메시지 `parts` 읽기 0. 위치는 순번으로 얻고, 중간 삭제 뒤 첫 위치 조회만 다시 센다 | IT-02: `chatReducer.messageIndex.test.ts`·`chatStore.cancelled.test.ts` — parts getter 계수 | reducer 6 자리 · store 2 자리 → `messageOrder` |
| R-03 | AT-03 / AC9 | 블록 key 는 D-034 규칙이다 — 같은 메시지 집합이면 그룹 문맥과 무관하게 같은 key 집합이다. 끝 추가 · 연속 user 턴 앞에 이전 user 앞삽입 · 선두 assistant 앞에 질문 복원 · 다시 열기에서 기존 블록 key 가 바뀌지 않고, 한 스냅샷 안 key 는 유일하다(세 화면 각각) | UT-06: `blockKeys.test.ts` y1~y8 | 세 블록 모델 → `keyAt` |
| R-03 | AT-03 / AC10 | 블록 모델은 변경 종류마다 D-032 범위만 읽고 만든다 — `append` 1 메시지: 새 블록 = 그 메시지 블록(+그룹 경계로 바뀐 메타 블록 ≤ 1) · `replace{partsFrom}`: 그 메시지의 `partsFrom` 이후 블록(+늦은 결과의 원래 호출 블록) · `remove`: 그 블록 제거 · `prepend` k 메시지: 새 블록 + 경계 블록 ≤ 2 · `reset`: 전체. 나머지 블록은 같은 객체. 매 단계 스냅샷 블록 열은 전체 구성과 같다(무작위 변경 열 property). 10,000 메시지에서 각 종류의 방문·할당 수를 단언한다 | UT-07: `claudeBlocks.test.ts`(code·work)·`openCodeBlocks.test.ts` z1~z7 + property | 세 블록 모델 `advance(messages, changes)` |
| R-03 | AT-03 / AC11 | 스냅샷은 불변이다 — 갱신 뒤에도 지난 스냅샷의 `count`·`keyAt`·`blockAt`·`indexOf` 값과 블록 참조가 같다 | UT-08: `blockList.test.ts` u1~u5 | `blockList` → 스냅샷 |
| R-03 | AT-03 / AC12 | 늦은 도구 결과 한 건 — 그 호출의 블록(Claude 도구 블록 · Work 활동 묶음 · OpenCode 도구 행)만 새 객체, 형제·다른 블록은 같은 참조. 그 결과에 기대는 패널 뷰만 revision 이 오른다(AC29) | UT-07 z4 · IT-03: 세 화면 렌더 계수 | reducer `tool.call.completed` → 기록 `replace` → 블록 모델 → 뷰포트 |
| R-03 | AT-03 / AC13 | 분절 캐시 — 같은 번호 메시지의 parts 가 앞을 유지한 채 늘면 마지막 segment 시작부터 다시 자른다. 뒤 `tool_result` 가 가리키는 앞 호출은 그 ToolCall 과 그것이 든 segment 만 새 객체고 형제 호출·다른 segment 는 같은 참조다. 앞 part 가 바뀌면 전체를 다시 자른다. 결과 ≡ `messageSegments`. `reconcileSegments` production 0 | UT-09: `segmentCache.test.ts` s1~s6 + property | 블록 모델 → `segmentsFor` |
| R-03 | AT-03 / AC14 | 구조 변화 없는 text·reasoning delta 는 세 화면에서 블록 모델·뷰포트 일 0 — 과거 메시지 `parts` 읽기 0 · 블록 재생성 0 · 무관 블록 렌더 0. live 블록의 출현·완료는 구조 변경 1회다 | IT-04: `TranscriptViewport.live.test.ts` — 세 화면 · parts getter · 렌더 계수 | `receiveDeltaBatch` → live 리프(Claude `PendingAssistant` · OpenCode live 행) |
| R-04 | AT-04 / AC15 | 세 진입점(Claude Code · Claude Work · OpenCode Timeline)은 같은 `TranscriptViewport` 를 쓴다. `scrollTop` 쓰기는 뷰포트 모듈 한 곳뿐이고, OpenCode `ScrollController` 와 Claude `useScrollAnchor` 는 뷰포트 정책을 고르는 얇은 설정이 된다(독립 보정 없음) | IT-05: `registry.viewport.test.ts` — 세 진입점 렌더 → 뷰포트 표지 1 · §10 EP-10 음성 검색 | `transcriptHarness(backend).Timeline` → `TranscriptViewport` |
| R-04 | AT-04 / AC16 | 같은 가시 범위·overscan 에서 마운트 블록 수는 블록 총수와 무관하다 — 5,000 블록 답변 뒤 새 질문을 보내도 이전 답변의 마운트 수가 5,000 으로 뛰지 않는다. 그 전환에서 화면에 남은 블록의 key·측정 캐시·읽던 위치·카드 펼침·선택이 같고 fork 는 새 턴 메타 블록으로 간다 | ST-02: `TranscriptViewport.transition.test.ts`(virtualizer 가시 범위 고정 · 측정 캐시 조회) | Claude Timeline → 블록 모델 → 뷰포트 |
| R-04 | AT-04 / AC17 | Claude 예약 앵커(0008) — 전송하면 마지막 user 블록이 미드라인에 오도록 꼬리 간격 = max(0, 0.5 × 뷰포트 높이 − 마지막 user 블록부터 끝까지의 측정 높이). 답이 그 간격을 채우는 동안 전체 높이는 같고 스크롤이 멈춘다. 하단에 붙어 있고 생성 중일 때만 하단을 따라가고, 위로 올리면 따라가지 않는다 | UT-10: `viewport/pin.test.ts`·`reserve.test.ts` p1~p6 · IT-06: Claude 렌더 | 뷰포트 꼬리 자리 · pin 정책 |
| R-04 | AT-04 / AC18 | OpenCode 현행 스크롤 동작 — 세션별 위치 저장·복원 · 프레임당 한 번 위치 캡처 · 맨 아래로 버튼 · 보존 선택 위 외부 클릭 뒤 따라가기 — 이 뷰포트 위에서 그대로다 | REGRESSION VP-36 좌표(뷰포트로 옮긴 같은 단언) | OpenCode Timeline → 뷰포트 |
| R-04 | AT-04 / AC19 | 세션 진입 배치 — 처음 여는 세션은 세 화면 모두 하단. 다시 들어온 세션은 하네스 정책 그대로 — Claude 는 하단(`useScrollAnchor.ts:109-132` 현행), OpenCode 는 저장 앵커(하단 고정이면 하단, `ScrollController.tsx:104` 현행) | UT-10 p7·p8 · IT-06 | 뷰포트 `entryPolicy` |
| R-05 | AT-05 / AC20 | 앞삽입 앵커 — 삽입 전 읽던 블록의 (key, 상단 픽셀 거리)를 기록하고 측정이 끝난 뒤 같은 블록이 같은 거리(±1px)에 있다. 앵커 블록이 사라지거나 나뉘면 같은 메시지 번호의 블록과 본문 위치로 찾는다. 하단에 붙어 있었으면 하단에 남고, 위에서 읽는 중 live 출력이 와도 끌려가지 않는다 | UT-11: `viewport/anchor.test.ts` a1~a6 | 뷰포트 앵커 캡처 → 기록 `prepend` → 복원 |
| R-05 | AT-05 / AC21 | 앞삽입 비용은 이미 읽은 길이와 무관하다 — 1턴 읽음·100턴 읽음 각각에 1턴을 앞에 붙이면 기존 블록 재생성 = 경계 블록 ≤ 2 · 관계없는 메시지 `parts` 읽기 0 이 두 경우 같다(청크 복사 제외 — B2) | UT-07 z6 · ST-03 계수 | `PREPEND_HISTORY` → 블록 모델 |
| R-05 | AT-05 / AC22 | 앞삽입이 그룹 경계를 바꾸는 입력(연속 user 턴 앞 이전 user · 선두 assistant 앞 질문 복원)에서도 기존 메시지 번호·블록 key·선택·펼침·앵커가 그대로다 | ST-03 g-case 2종 | 같다 |
| R-05 | AT-05 / AC23 | 고정 입력 재생 — 세 화면에서 "최신 한 턴 로드 → 하단 배치 → 이전 한 턴 앞삽입 3회" 를 돌리면 화면 순서는 8 → 9 → 10 턴(조회 10 → 9 → 8)이고, 매 삽입 뒤 앵커·key·선택·펼침이 AC20~AC22 대로다 | ST-03: `TranscriptViewport.prepend.test.ts` — 실제 store `PREPEND_HISTORY` | `chatActions` → reducer → 블록 모델 → 뷰포트 |
| R-06 | AT-06 / AC24 | 펼침·포커스 논리 상태는 세션 키 + 블록 key 로 store 에 있다 — 가상화로 언마운트됐다 재마운트되면 복원된다(AC6 의 같은 인스턴스와 다른 단언). `dropSession` 다섯 흐름에서 지워지고, 전환·다시 열기·원본 동기화에서 남고, 전체 교체에서 지금 블록에 없는 key 는 버린다 | IT-07: `disclosureStore.test.ts` · 블록 재마운트 테스트 · 흐름 표 d1~d8 | 블록 컴포넌트 → `useDisclosure(key)` |
| R-06 | AT-06 / AC25 | 닫은 Claude 도구 카드의 본문은 `transitionend` · `transitioncancel` · 시한(전환 시간 + 100ms) 중 먼저 오는 것에 언마운트된다. 동작 줄이기는 즉시, 종료 전 다시 열면 남는다. 어느 경로에서도 닫힘 뒤 본문이 남지 않고 복사 결과는 같다 | IT-08: Claude `ToolCard.interaction.test.ts` e1~e6(가짜 타이머·`matchMedia`) | Claude 도구 블록 |
| R-07 | AT-07 / AC26 | 선택 보존(세 화면) — 범위 ≤ 300 블록 전체 마운트 · 300 초과 ≤ 2,000 은 양 끝·가시·앵커만 마운트하고 복사 핸들러 안에서 범위를 동기 마운트해 클립보드 문자열이 전체 마운트 기준과 같다(정방향·역방향 · 양 끝 부분 선택) · 2,000 초과 또는 Shift 확장 시작은 전체 마운트. 복사 순간 최대 마운트 수·핸들러 시간을 기록한다 | IT-09: `TranscriptViewport.selection.test.ts` c1~c7 | 뷰포트 `rangeExtractor` · `onCopy` · `onKeyDown` |
| R-08 | AT-08 / AC27 | 사용자 버블 — 같은 프레임 통지 N 개는 다음 프레임에 한 번 읽는다(버블당 ≤ 1) · 쓰기는 읽기 뒤. 무효화 입력 넷(본문 prop · RO 폭 · 배율 · 글꼴 버전)이 같은 버블은 `getComputedStyle`·`scrollHeight`·`getBoundingClientRect`·`clientWidth`·`offsetHeight` 호출 0 · 줄 높이는 (배율, 글꼴 버전)마다 1회 | UT-12: `bubbleMeasure.test.ts` m1~m6 | `UserBubbleText` → `useBubbleOverflow` |
| R-09 | AT-09 / AC28 | Markdown 꼬리 — delta 마다 새 완결 줄만 스캔한다(누적 스캔 문자 = 입력 길이). 닫히지 않은 펜스 꼬리는 remark 없이 그리고 DOM 이 `Markdown` 경로와 같다. 펜스 판정 차등 사례(백틱 info 안 백틱 · 닫힘 뒤 문자 · 들여쓰기 3/4 · CRLF · 펜스 줄이 delta 사이에서 나뉨)가 기존 파서와 같다 | UT-13: `markdownBlocks.test.ts` f1~f10 · renderToString 대조 | `StreamingMarkdown` → `advanceStableBlocks` |
| R-10 | AT-10 / AC29 | 패널 색인 — `replace{partsFrom}` 은 새 part 의 기여만 더한다. 도메인 revision 은 값이 달라질 때만 오른다(TaskCreate 결과가 든 메시지에 text 만 더해도 작업 보드 revision 불변). 부모 A 상세는 B 의 자식 이벤트에 revision·렌더 0. 뷰는 불변 스냅샷. 뷰 9종 ≡ 현행 함수(무작위 변경 열 property · 교차 세션 2) | UT-14: `transcriptIndex.test.ts` x1~x12 + property | store → `transcriptIndexFor` |
| R-10 | AT-10 / AC30 | 패널·행 소비자 10파일은 색인 뷰를 읽는다 — 현행 9함수 production 호출 0 · 무관 이벤트에 소비자 렌더 0 · 바뀐 Bash 호출만 프로세스 행 새 객체 | IT-10: `panelConsumers.test.ts` · `InlineSubagentDetail.test.ts` · §10 EP-14 검색 | 소비자 → `useTranscriptView` |
| R-11 | AT-11 / AC31 | 한 묶음의 같은 세션·같은 종류 연속 delta 는 문자열 결합 1회·세션 항목 교체 1회. 다른 종류·세션이 끼면 끊긴다. 결과 live·BEGIN_TURN·라우팅은 지금과 같다 | UT-15: `chatStore.deltaBatch.test.ts` b1~b6 | coalescer → `receiveDeltaBatch` |
| R-12 | AT-12 / AC32 | 측정 스크립트가 J1~J9 를 결정적으로 만들고 입력마다 초회 구성·정상 증분·캐시 적중을 따로 잰다(0325 규약 — 예열 1 · 9회 중앙값·최대) | UT-16: `measure-ui-inputs.test.mjs` j1~j4 | `node scripts/measure-ui-inputs.mjs --src <트리>` |
| R-12 | AT-12 / AC33 | 사람 실기 — 기계 verify PASS 뒤 §19 S1~S9 를 같은 Windows 장비에서 0326 직전·0326 빌드로 기록한다. 칸은 값 · `N/A(이전 빌드: 사유)` · `미완료(새 빌드: 사유)`. 미완료가 하나라도 있으면 AC33 은 닫히지 않는다. T17·T18 은 S8·S9 측정만 하고 W 인계 좌표를 남긴다 | 사람 실기 — §19 | 설치본 · 진단 빌드 · `measure-ui-inputs.mjs` |
| R-0325-02·R-0325-03·R-0324-05·AR-PERSIST·AR-OC-SEL | AT(REGRESSION) / AC34 | REGRESSION — 0325 AC4~AC10·AC20·AC21 · 0324 AC15~AC17·D-045 · 저장 경로 기존 테스트가 통과한다. 예외는 §7-A VP-37 표의 "주체가 바뀐 테스트" 다 — 그 단언은 표의 새 좌표로 옮기고, 0325 p2 의 key 변화 기대는 AC9(key 유지)로 바뀐다 | §7-A VP-32~VP-37 | 같다 |

### AC 검증 주의사항

- 사람 실기 항목: AC33 하나 — 실제 Chromium 레이아웃·스크롤·선택·paint 와 Windows 프레임이 관측 대상이다. 마운트 수·방문·할당·렌더·key 동일성·앵커 계산은 AC1~AC32 가 fake DOM 하네스와 가짜 virtualizer 측정으로 기계 검증한다. AC33 은 기계 verify PASS 뒤 수행한다(코멘트 1·3).
- 방문·할당 단위(D-032): 방문 = 메시지 `parts` getter 와 part 객체 필드 읽기(Proxy 계수) · 할당 = 새 블록·행·도메인 출력 객체(참조 비교 계수). 블록 목록 청크 배열 복사는 세지 않는다(B2).
- 같은 결과 대조: AC10·AC13·AC29 는 매 단계 전체 계산(전체 블록 구성 · `messageSegments` · 현행 9함수 사본)과 `toEqual` 한다.
- AC 수 34 는 handoff-plan §5 의 25 상한을 넘는다 — D-002.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 구현 V 가 없어 `Baseline V` 다. 0325·0324 의 노드는 INHERITED REGRESSION 으로만 참조한다.
- 기준 V 상속 근거: 없음. 0325 노드 출처는 `0325:V1 rev 4 + ΔV1`(설계 `5923d9a`·`211afa7` · r1 구현 `52b5272`, 브랜치 `ccr-da0cf78b-aemqjb`). ΔV1 은 §10 검색 명령만 고쳐 AC·자리·oracle 이 같다.
- `SUPERSEDED` pair 증거 이관: rev 1 의 pair 는 구현 전이라 이관할 실행 증거가 없다. rev 1 VP 의 단언 중 rev 2 에 남는 것은 아래 pair 의 입력 기호(k·w·i·r·l·s·f·b·j)로 옮겼다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 / AT-01 | R / AT | §7 AC1~AC6 — 메시지 번호 | NEW | — |
| SD-01 | SD | 같은 이벤트 열의 라이브 목록 = 재로드 목록(재커밋·늦은 A·error 포함) | NEW | — |
| AR-01 | AR | §10 EP-1 — 발급 → 피어 저장·창 중계 | NEW | — |
| MD-01 | MD | §10 EP-1 — 발급·비움·사용자 번호 규칙 | NEW | — |
| MD-02 | MD | §10 EP-3 — 로드 번호 규칙 | NEW | — |
| MD-03 | MD | §10 EP-4 — 창 reducer 번호 대상 | NEW | — |
| MD-04 | MD | §10 EP-2 — writer 번호 대상·재커밋·마이그레이션 | NEW | — |
| AR-02 | AR | §10 EP-4 ⑪ — 다시 열기 같은 인스턴스 | NEW | — |
| R-02 / AT-02 | R / AT | §7 AC7·AC8 | NEW | — |
| MD-05 | MD | §10 EP-5 — 종류별 변경 기록 | NEW | — |
| MD-06 | MD | §10 EP-6 ①② — 번호·순번 색인 | NEW | — |
| AR-03 | AR | §10 EP-6 ③~⑩ — reducer·store 조회 | NEW | — |
| R-03 / AT-03 | R / AT | §7 AC9~AC14 | NEW | — |
| MD-07 | MD | §10 EP-7 — 블록 key | NEW | — |
| MD-08 | MD | §10 EP-8 ①② — 영속 블록 목록·스냅샷 | NEW | — |
| MD-09 | MD | §10 EP-8 ③~⑧ — 하네스 블록 모델 3종 증분 | NEW | — |
| AR-04 | AR | §10 EP-8 ⑨ — 늦은 결과 → 원래 블록 → 렌더 | NEW | — |
| MD-10 | MD | §10 EP-9 — 분절 캐시 | NEW | — |
| AR-05 | AR | §10 EP-8 ⑩ — live 리프 | NEW | — |
| R-04 / AT-04 | R / AT | §7 AC15~AC19 | NEW | — |
| AR-06 | AR | §10 EP-10 — 세 진입점 · 단일 스크롤 쓰기 | NEW | — |
| SD-02 | SD | 현재 → 과거 전환(새 질문 전송)의 블록·측정·상태 수명 | NEW | — |
| MD-11 | MD | §10 EP-11 — pin·예약 간격·진입 배치 정책 | NEW | — |
| AR-07 | AR | §10 EP-11 ⑥⑦ — Claude 꼬리 자리·fork | NEW | — |
| R-05 / AT-05 | R / AT | §7 AC20~AC23 | NEW | — |
| MD-12 | MD | §10 EP-12 ①~④ — 앞삽입 앵커 | NEW | — |
| SD-03 | SD | 반복 앞삽입 재생(세 화면 · 1턴/100턴) | NEW | — |
| R-06 / AT-06 | R / AT | §7 AC24·AC25 | NEW | — |
| MD-13 | MD | §10 EP-15 — 펼침·포커스 store | NEW | — |
| AR-08 | AR | §10 EP-16 — 접은 본문 해제 | NEW | — |
| R-07 / AT-07 | R / AT | §7 AC26 | NEW | — |
| AR-09 | AR | §10 EP-17 — 선택 보존·복사 | NEW | — |
| R-08 / AT-08 | R / AT | §7 AC27 | NEW | — |
| MD-14 | MD | §10 EP-18 — 버블 측정 | NEW | — |
| R-09 / AT-09 | R / AT | §7 AC28 | NEW | — |
| MD-15 | MD | §10 EP-19 — 꼬리 스캐너·펜스 | NEW | — |
| R-10 / AT-10 | R / AT | §7 AC29·AC30 | NEW | — |
| MD-16 | MD | §10 EP-13 — 패널 색인 | NEW | — |
| AR-10 | AR | §10 EP-14 — 소비자 전환 | NEW | — |
| R-11 / AT-11 | R / AT | §7 AC31 | NEW | — |
| MD-17 | MD | §10 EP-20 — delta 묶음 | NEW | — |
| R-12 / AT-12 | R / AT | §7 AC32·AC33 | NEW | — |
| MD-18 | MD | §10 EP-21 — J1~J9 | NEW | — |
| R-0325-02 | R | 0325 AC4~AC6·AC20·AC21 | INHERITED | 0325:V1 rev 4 R-02 |
| R-0325-03 | R | 0325 AC7~AC10 | INHERITED | 0325:V1 rev 4 R-03 |
| R-0324-05 | R | 0324 AC15~AC17 · D-045 | INHERITED | 0324:V1 rev 4.9 R-05 |
| AR-PERSIST | AR | 저장 경로(응답 경계·질문 답·백그라운드 기록·원본 이력·사용자 커밋 순서) | INHERITED | 기존 테스트 — 상속 V 없음 |
| AR-OC-SEL | AR | OpenCode 선택 보존·스크롤 캡처 | INHERITED | 0325 AR-OC-SEL |

### Pair registry

규칙 칸 분기 기호(k·w·i·r·l·q·y·z·u·s·p·a·d·e·c·m·f·x·b·j)는 §10 규칙 칸 표의 같은 기호와 1:1 이다. "fake DOM 하네스" = `renderer/src/shared/ui/renderHarness.testfixture.ts`. 가상 범위는 `@tanstack/react-virtual` 을 mock 하지 않고 스크롤 요소 크기·`measureElement` 값을 주입해 정한다(가짜 측정).

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 발급 → 저장 → 로드 → 창 → 다시 열기 | edge 마다 VP-02~VP-08 | not selected | EP-1~EP-4 공유 |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | 버스 → `onTurnEvent` → 피어 → receiver → writer → `loadSession` ‖ `relay` → reducer | 신규 `main/app/message-identity.integration.test.ts:'라이브 번호 열과 재로드 목록이 고정 입력의 기대와 같다'`(실제 sender·receiver·writer·reader, DB) · 신규 `renderer/.../reducer/chatReducer.messageIdentity.test.ts:'같은 번호 열을 reducer 에 넣으면 고정 입력의 기대 목록이다'` — 열은 §7 AC1 의 12단계 | required — 송신기 `telemetry` 비움 제거(연속 턴 text 가 앞 메시지로 → red) · writer 를 "마지막 행만 보고 새 행" 으로 되돌림(늦은 A 가 새 행 → 행 수 red) · reducer 를 "번호 무시 마지막 assistant" 로 되돌림(red) | EP-1 ⑥ · EP-2 ③ · EP-4 ② (3) |
| VP-03 | AR-01 ↔ IT-01a | REQUIRED | 버스 3 송출 → `onTurnEvent` → `relay` 큐 → 창 · `flushAskAnswers` | 신규 `persistence-sender.test.ts:'part 를 만드는 8종에 같은 번호를 붙여 저장과 화면에 같이 보낸다'` · `:'확인을 기다리는 산출물 이벤트 뒤 줄 선 중계도 번호를 싣는다'` · `:'질문 답의 도구 완료는 화면 이벤트와 답 묶음에 같은 번호를 싣는다'` | required — relay 사본 변이 · 질문 답 번호 제거 변이 | EP-1 ③④⑤ (3) |
| VP-04 | MD-01 ↔ UT-01 | REQUIRED | 발급 상태 → 8종 → 비움 3 · 사용자 번호 3 | `persistence-sender.test.ts` k1~k8 · `turn-coordinator.test.ts` k9~k11(결정적 `newId`) | required — k5·k6·k7 비움 각각 제거 · k9 `ids[0]`↔`ids.at(-1)` 맞바꿈 · k11 `i:` 를 `u:` 로 바꾸는 변이(같은 문자열 입력 → 번호 같아짐 red) | EP-1 ①~⑪ (11) |
| VP-05 | MD-02 ↔ UT-02 | REQUIRED | `loadParts` → `localMessages`·`projectNativeHistory`·`recoveryArchive` → id | `native-projection.test.ts`·`reader.test.ts` i1~i8 + 유일성 단언 | required — i4 "가장 뒤" 를 "가장 앞" 으로 바꾸는 변이(i8 앞삽입 입력에서 번호 이동 → red) · i5 `#o` 제거(중복 → red) | EP-3 ①~⑦ (7) |
| VP-06 | MD-04 ↔ UT-04 | REQUIRED | 8 case → `ensureAssistantMessage(…, key)` → `findMessageByKey` / `appendMessage` · `commitUserMessage` | `writer.test.ts` w1~w7 · `migrate.test.ts` w8 | required — w3 "번호 행 찾기" 제거(늦은 A 새 행 → UNIQUE 실패 red) · w5 재커밋 멱등 제거(행 2 → red) | EP-2 ①~⑨ (9) |
| VP-07 | MD-03 ↔ UT-03 | REQUIRED | `RECV_EVENT` 7 · `COMMIT_PENDING_TEXT` · 커밋 · 로드 · fork · 자식 대화 → `Message.id` | `chatReducer.messageId.test.ts` r1~r9 | required — r3 번호 위치 조회 제거(늦은 A 가 새 메시지 → red) | EP-4 ①~⑩ (10) |
| VP-08 | AR-02 ↔ IT-01 | REQUIRED | `loadSession` → `LOAD_SESSION` → 블록 모델 `reset` → 뷰포트 | 신규 `TranscriptViewport.reopen.test.ts:'reopening a cached session keeps block keys and DOM nodes on all three screens'` | required — `LOAD_SESSION` 이 `r:` 새 번호를 쓰는 변이(노드 동일 red) | EP-4 ⑥⑪ (2) |
| VP-09 | R-02 ↔ AT-02 | REQUIRED | reducer 쓰기 → 기록 → 소비자 · 조회 → 색인 | VP-10~VP-12 | not selected | EP-5·EP-6 공유 |
| VP-10 | MD-05 ↔ UT-05 | REQUIRED | 쓰기 도우미 → `recordChange` → `transcriptChanges` → `changesSince` | `lib/transcript/changeLog.test.ts` l1~l8 · 신규 `chatReducer.changeLog.test.ts:'every messages write records one change of the right kind'`(EP-5 ③ 자리마다) | required — l3 상한 제거(1,000 추가 뒤 기록 수 red) · EP-5 ③ 한 자리 종류를 `reset` 으로 바꾸는 변이(그 자리 사례 red) · `partsFrom` 고정 0 변이(ⓑ 사례 red) | EP-5 ①② · ③ⓐ~ⓗ · ④ (11) |
| VP-11 | MD-06 ↔ UT-17 | REQUIRED | 기록 → `messageOrder` 순번 갱신 → 위치·번호 조회 | 신규 `lib/transcript/messageOrder.test.ts` q1~q6 | required — q4 앞삽입 순번 감소 대신 재번호 변이(10,000 순번 재기록 계수 red) | EP-6 ①② (2) |
| VP-12 | AR-03 ↔ IT-02 | REQUIRED | reducer 6 자리 · store 2 자리 → 색인 | 신규 `chatReducer.messageIndex.test.ts` — 10,000 메시지 · index 1 산출물 교체 · 끝 결과 · 자리마다 1 · parts getter 0 · 신규 `chatStore.cancelled.test.ts:'recovers uncommitted bubbles by id without scanning history'` | required — EP-6 ③ `findIndex` 복귀(getter red) · ⑥ 멱등 제거(이중 버블 red) · ⑧ `some` 복귀(getter red) | EP-6 ③~⑩ (8) |
| VP-13 | R-03 ↔ AT-03 | REQUIRED | 기록 → 블록 모델 → 스냅샷 → 뷰포트 | VP-14~VP-19 | not selected | EP-7~EP-9 공유 |
| VP-14 | MD-07 ↔ UT-06 | REQUIRED | 메시지 → 블록 key 함수 | 신규 `lib/transcript/blockKeys.test.ts` y1~y8(세 화면 생성기 각각) | required — y3 text 순번을 segment 전체 순번으로 바꾸는 변이(reasoning 삽입 입력 red) · y6 메타 key 를 마지막 메시지 번호로 맞바꾸는 변이(끝 추가 입력 red) | EP-7 ①~⑧ (8) |
| VP-15 | MD-08 ↔ UT-08 | REQUIRED | `blockList` 갱신 → 스냅샷 | 신규 `lib/transcript/blockList.test.ts` u1~u5 | required — u2 청크 제자리 수정 변이(지난 스냅샷 값 red) | EP-8 ①② (2) |
| VP-16 | MD-09 ↔ UT-07 | REQUIRED | `advance(messages, changes)` → 종류별 처리 → 경계 블록 → 스냅샷 | 신규 `harnesses/claude/transcript/claudeBlocks.test.ts`(code·work) · `harnesses/opencode/transcript/openCodeBlocks.test.ts` z1~z7 + property(시드 고정 500 열 × 40 단계 — 기록 종류 5 무작위 · 단계마다 블록 열 `toEqual` 전체 구성 · 방문·할당 = D-032 범위) | required — z2 `replace` 를 메시지 전체 재구성으로 바꾸는 변이(할당 red) · z5 경계 블록 갱신 제거(property red) · z3 `remove` 무시 변이(property red) | EP-8 ③~⑧ (6) |
| VP-17 | AR-04 ↔ IT-03 | REQUIRED | reducer `tool.call.completed` → `replace` → 원래 호출 블록 → 뷰포트 → 블록 컴포넌트 | 신규 `TranscriptViewport.lateResult.test.ts:'a late tool result re-renders only the original call block on each screen'` — 세 화면 · 렌더 계수 | required — 결과를 지금 메시지 블록에 붙이는 변이(원래 카드 결과 없음 → red) | EP-8 ⑨ (1) |
| VP-18 | MD-10 ↔ UT-09 | REQUIRED | `segmentsFor(message)` → 접두 확인 → 재분절 | 신규 `lib/segmentCache.test.ts` s1~s6 + property(2,000 열) | required — s3 "앞 segment 전부 이전 객체" 변이(결과 미반영 red) · s4 접두 확인 제거(red) | EP-9 ①~④ (4) |
| VP-19 | AR-05 ↔ IT-04 | REQUIRED | delta → live 리프 · 구조 전이 | 신규 `TranscriptViewport.live.test.ts` — 세 화면 · 구조 불변 delta(과거 10,000 메시지)에서 parts getter 0 · 블록 모델 `advance` 0 · 무관 블록 렌더 0 · live 블록 출현·완료 전이 1회 | required — 뷰포트가 live 값을 구독하는 변이(블록 렌더 red) | EP-8 ⑩ (1) |
| VP-20 | R-04 ↔ AT-04 | REQUIRED | 진입점 → 뷰포트 → 범위 → 마운트 | VP-21~VP-24 | not selected | EP-10·EP-11 공유 |
| VP-21 | AR-06 ↔ IT-05 | REQUIRED | `transcriptHarness(backend).Timeline` → `TranscriptViewport` → `writeScrollTop` | 신규 `harnesses/registries/transcript.viewport.test.ts:'every transcript entry point renders through the shared viewport'`(Claude Code·Claude Work·OpenCode 각 1) · §10 EP-10 음성 검색 | required — 한 진입점이 자체 virtualizer 를 쓰는 변이(표지 red) · OpenCode 보정기에 `scrollTop` 쓰기를 되돌리는 변이(검색 red) | EP-10 ①~⑧ (8) |
| VP-22 | SD-02 ↔ ST-02 | REQUIRED | 전송 → 블록 모델 `append` → 메타·fork 이동 → 뷰포트 | 신규 `TranscriptViewport.transition.test.ts:'sending after a 5,000-block answer keeps mounted count, keys, measurements, expansion and selection'` | required — 이전 답변을 별도 영역으로 옮기는 변이(측정 캐시 key 변경 → red) | EP-10 ④ · EP-11 ⑦ (2) |
| VP-23 | MD-11 ↔ UT-10 | REQUIRED | pin·예약 간격·진입 배치 순수 함수 | 신규 `lib/transcript/viewport/{pin,reserve,entry}.test.ts` p1~p8 | required — p3 간격 식의 0.5 를 1 로 바꾸는 변이(red) · p7 Claude 진입을 복원으로 맞바꾸는 변이(red) | EP-11 ①~⑤ (5) |
| VP-24 | AR-07 ↔ IT-06 | REQUIRED | Claude Timeline → 꼬리 자리(간격·대기·steer·오류) · 메타 블록 fork | 신규 `harnesses/claude/transcript/Timeline.viewport.test.ts` — 전송 뒤 간격 높이 · 대기 표시 위치 · steer 복원 콜백(현행 `Exchange.compare.test.ts` 단언 이관) · fork 가 마지막 assistant 턴 메타에만 | required — fork 를 모든 메타에 두는 변이(red) | EP-11 ⑥⑦ (2) |
| VP-25 | R-05 ↔ AT-05 | REQUIRED | 앵커 캡처 → `PREPEND_HISTORY` → 블록 → 측정 → 복원 | VP-26·VP-27 | not selected | EP-12 공유 |
| VP-26 | MD-12 ↔ UT-11 | REQUIRED | 앵커 기록 → 삽입 높이 반영 → 측정 정정 → `writeScrollTop` | 신규 `lib/transcript/viewport/anchor.test.ts` a1~a6 | required — 측정 정정 단계 제거(a3 ±1px red) · a5 메시지 번호 대체 제거(red) | EP-12 ①~④ (4) |
| VP-27 | SD-03 ↔ ST-03 | REQUIRED | 고정 입력 → `chatActions.prependHistory` → reducer → 기록 → 블록 모델 → 뷰포트(세 화면) | 신규 `TranscriptViewport.prepend.test.ts:'replays latest turn, bottom placement and three single-turn prepends on each screen'` · `:'prepending one turn costs the same after 1 and 100 loaded turns'` · `:'prepends that move group boundaries keep ids, keys, selection, expansion and anchor'` | required — `PREPEND_HISTORY` 를 `reset` 으로 기록하는 변이(1/100턴 비교 red) | EP-12 ⑤⑥ (2) |
| VP-28 | R-06 ↔ AT-06 · MD-13 ↔ IT-07 · AR-08 ↔ IT-08 | REQUIRED | 블록 → `useDisclosure` → store · 닫힘 → 종료 조건 → 언마운트 | `store/disclosureStore.test.ts` d1~d8 · `TranscriptViewport.disclosure.test.ts:'restores expansion and focus after virtualization remount'` · Claude `ToolCard.interaction.test.ts` e1~e6 | required — d4 `dropSession` 정리 제거(red) · e3 시한 제거(이벤트 없는 입력 red) | EP-15 ①~⑥ · EP-16 ①~④ (10) |
| VP-29 | R-07 ↔ AT-07 · AR-09 ↔ IT-09 | REQUIRED | 선택 → `rangeExtractor` · `onCopy` · `onKeyDown` | `TranscriptViewport.selection.test.ts` c1~c7(세 화면 중 Claude·OpenCode 각각) | required — c3 동기 마운트 제거(클립보드 문자열 red) · c6 Shift 전환 제거(red) | EP-17 ①~④ (4) |
| VP-30 | R-08 ↔ AT-08 · MD-14 ↔ UT-12 | REQUIRED | RO 통지 → 대기 → rAF → 읽기 → 쓰기 | `lib/bubbleMeasure.test.ts` m1~m6 · `UserBubbleText.measure.test.ts` | required — m3 읽기·쓰기 교차 변이 · m5 무효화 입력에서 폭 제거 변이 | EP-18 ①~⑤ (5) |
| VP-31 | R-09 ↔ AT-09 · MD-15 ↔ UT-13 | REQUIRED | `StreamingMarkdown` → `advanceStableBlocks`(스캐너 상태) → `openFenceTail` | `markdownBlocks.test.ts` f1~f10 · `StreamingMarkdown.fence.test.ts`(renderToString 대조 · remark spy 0) | required — f8 스캐너 상태 무시(누적 스캔 문자 red) · f4 백틱 info 허용 변이(red) | EP-19 ①~④ (4) |
| VP-32 | R-10 ↔ AT-10 · MD-16 ↔ UT-14 | REQUIRED | 기록 → `transcriptIndexFor` → 기여 → revision → 뷰 | `lib/transcriptIndex.test.ts` x1~x12 + property(500 열 × 40 단계 · 교차 세션) | required — x10 값 비교 제거(같은 메시지 text 추가에 작업 보드 revision 오름 → red) · x11 부모별 revision 을 하나로 합치는 변이(red) · x12 뷰 제자리 수정 변이(지난 뷰 값 red) | EP-13 ①~⑥ (6) |
| VP-33 | AR-10 ↔ IT-10 | REQUIRED | 소비자 10파일 → `useTranscriptView` | `InlineSubagentDetail.test.ts` · `rightpanel/panelConsumers.test.ts` · §10 EP-14 검색 | required — 한 소비자를 현행 함수로 되돌리는 변이(계수·검색 red) | EP-14 ①~③ (3) |
| VP-34 | R-11 ↔ AT-11 · MD-17 ↔ UT-15 | REQUIRED | coalescer → `receiveDeltaBatch` | `store/chatStore.deltaBatch.test.ts` b1~b6 | required — b3 종류 비교 제거(red) | EP-20 ①~④ (4) |
| VP-35 | R-12 ↔ AT-12 · MD-18 ↔ UT-16 | REQUIRED | J1~J9 → 세 갈래 요약 · 사람 §19 | `scripts/measure-ui-inputs.test.mjs` j1~j4 · 사람 실기 | not selected — 직접 값 단언 | EP-21 (3) |
| VP-36 | R-0325-02 ↔ AT · AR-OC-SEL ↔ IT | REGRESSION | 0325 OpenCode live·선택·스크롤 경로 — 이제 뷰포트 위 | `chatStore.liveSelectors.test.ts` describe `'live 유무·본문 선택자 (0325 VP-07 자리 2·3)'` · describe `'reasoning presence is updated per chunk (0325 VP-32 · EP-2b)'` · `Timeline.selection.test.ts:'keeps selected live content on completion, then resolves complete Markdown when selection clears'` · `:'keeps the same row component when a live row becomes the committed row of the same key'` · `Timeline.memo.test.ts:'re-renders only the live leaf for presence-preserving deltas once the live row exists, at every history size (%i past, %i current)'` · `ScrollController.interaction.test.ts:'captures the latest scroll once per frame and cancels the queued capture on unmount'` · `:'keeps jump-to-bottom pinned when an external click releases over a retained selection, then follows output'` | not selected | 0 — 자리는 EP-8·EP-10·EP-17 이 소유 |
| VP-37 | R-0325-03 ↔ AT | REGRESSION | 0325 Claude 그룹화·steer 콜백 — 주체가 바뀐 테스트 포함 | 그대로 통과: `ChatTile.workLifetime.test.ts:'passes a stable steer-restore callback per active session and rebinds it on switch'` · `workToolResults.test.ts` 의 결과 귀속 단언 7(→ 블록 모델 입력으로 옮겨 같은 기대). 주체가 바뀐 테스트 → 새 좌표: `Exchange.compare.test.ts:'re-renders when only the steer-restore callback changes'` → VP-24 · `Timeline.grouper.test.ts` 3 케이스 → VP-16 z1·z2 · `turns.test.ts` describe `'createExchangeGrouper'` → VP-16 property(그룹 메타 ≡ `groupExchanges`) · `Timeline.memo.test.ts:'projects the committed head once and the live tail once per presence change without computing copy text'` · `'re-projects once per presence transition with string-projection keys and keeps surviving row nodes — $name'` → VP-16 z7 · VP-14 y3(p2 는 key 유지로 기대가 바뀐다 — D-034) | not selected | 0 — EP-7·EP-8 공유 |
| VP-38 | R-0324-05 ↔ AT · AR-PERSIST ↔ IT | REGRESSION | 0324 조각 조립·진행 중 캐시 · 저장 경로 | `main/app/data-host/session-load.test.ts` describe `'세션 본문은 조각으로 가고 조립 결과는 \`loadSession\` 과 같다 (AC15)'` · `chatStore.native-history.test.ts:'finishes the loading state without replacing live data that arrived during a cold load'` · `writer.test.ts`·`writer.ask.test.ts`·`writer.background.test.ts`·`writer.native-history.test.ts`·`writer.received.test.ts`·`writer.artifacts.test.ts` · `response-boundary.integration.test.ts` · `persistence-receiver.test.ts`·`persistence-sender.test.ts` 기존 케이스 | not selected | 0 — 자리는 EP-1~EP-3 이 소유 |

- 묶은 행의 pair 는 왼쪽 노드 순서대로 `a`·`b`·`c` 로 부른다(VP-28a R-06 · VP-28b MD-13 · VP-28c AR-08 등). 같은 행의 pair 는 좌표·§10 분모를 공유하고 판정은 따로 낸다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 로컬 확인 전부 | `app/**` 소스·테스트·마이그레이션·스크립트를 바꾼다 | `app/AGENTS.md` "로컬 확인" 전부 · lint · typecheck · 파일 필터 없는 vitest · `node --test scripts/*.test.mjs` · 빌드 + 두 스모크 | 이번 변경이 만든 실패 · 추가·수정 테스트 파일의 규칙 가드 위반 |
| DB 스위트 | 마이그레이션·writer·reader | io 풀 스위트 — 제약 환경은 `npm rebuild better-sqlite3`(Node ABI) 뒤, 불가하면 CI 결과 | 같다 |
| 문서 계약 | 이벤트·로드 응답·DB 열·transcript 구조가 바뀐다 | `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md §2` · `docs/arch/backend/persistence.md` · `docs/arch/frontend/rendering.md` · `docs/arch/frontend/design-components.md`(뷰포트 행) · `check-doc-inventory --check` | 같다 |
| 개발 메뉴 제외 | 진단 빌드 전용 `window.__ooDev`(§19)를 새로 둔다 | `VITE_OO_DIAGNOSTIC` 없이 `npx electron-vite build` 뒤 `rg -c "__ooDev" out/renderer` → 0 · 진단 빌드에서는 ≥ 1 | 같다 |
| 커밋 trailer 파싱 | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 같다 |
# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 재현·측정 (이번 세션, Linux · Node v22.23.5 · esbuild 로 실제 소스 함수를 번들해 호출 · 1회 예열 뒤 9회 중앙값 / 최대)

입력: exchange 마다 user(text) + assistant(text · Bash 호출 · 결과), 10번째마다 Task 호출 + 자식 Read + 결과. 확정 이벤트 = 마지막 assistant 에 part 하나(reducer `appendAssistantPart` 와 같은 꼴). 측정 스크립트는 scratchpad 에 두었고 커밋하지 않는다 — 같은 입력은 WU-14 의 J1~J9 가 커밋된 스크립트로 다시 만든다.

| ID | 대상 | 1,000 exchange | 10,000 exchange | 100,000 exchange | 의미 |
|---|---|---|---|---|---|
| M1a | 참조 배열 `slice` | 0.002 / 0.005 ms | 0.085 / 0.716 | 0.960 / 5.157 | D-010 경계 B2 |
| M1b | Claude grouper(0325 증분) | 0.112 / 0.176 | 0.498 / 2.686 | 5.104 / 9.375 | 첫 변경 참조 비교 n 회(0325 B8) |
| M1c | Work 결과 선택기 | 2.155 / 4.276 | **19.456** / 28.796 | **343.5** / 624.6 | 전 exchange·메시지 순회(0325 B9) |
| M1d | OpenCode head 재투영 | 4.005 / 7.565 · 행 4,096 · 같은 참조 0 | **36.84** / 71.71 · 행 40,996 · 같은 참조 0 | — | 확정 이벤트마다 전부 새 행(0325 B6) |
| M1e | 작업 보드 `taskBoardFromMessages` | 0.426 / 0.531 | 5.029 / 6.963 | 116.9 / 136.6 | 새 배열 = 캐시 무효 |
| M1f | 하위 작업 요약 `subagentTasksFromMessages` | 0.889 / 1.714 | 5.506 / 7.387 | 151.5 / 186.9 | 같다 |
| M1g | 배경 패널 결과 `transcriptResultsByToolUseId` | 0.184 / 0.245 | 4.120 / 6.093 | 96.86 / 363.1 | 같다 |
| M1h | 배경 모델 `persistedBackgroundModels` | 0.204 / 0.731 | 0.444 / 0.479 | 9.034 / 9.990 | 같다 |
| M1i | OpenCode 패널 `sessionPanelModel` | 1.945 / 5.811 | **20.97** / 83.02 | **405.2** / 551.3 | 전 part 평탄화 + 출력 문자열화 |
| M1j | 완료 통지 설명 `subagentTaskDescription`(행마다) | 0.202 / 0.318 | 0.267 / 0.331 | 5.930 / 8.808 | 캐시 없음 × 표시 행 수 |
| M1k | reducer `output.captured` 소유 탐색 | 0.096 / 0.248 | 0.491 / 0.565 | 9.190 / 11.68 | `findIndex` 전체 |

| ID | 대상 | 값 | 의미 |
|---|---|---|---|
| M2 | 생성 중 세션 키 `generatingSessionKeys` | 세션 10: 0.002 · 100: 0.011 · 1,000: 0.148 ms | D-016 현행 유지 근거 |
| M3 | Markdown 꼬리 렌더(실제 react-markdown + remark-gfm, `renderToString`) | 열린 펜스 20,000자 5.35 / 13.93 · 100,000자 27.54 / 50.14 · 긴 문단 20,000자 9.06 / 19.51 · 100,000자 62.96 / 87.97 · loose list 20,000자 **84.33** / 141.3 · 100,000자 **451.5** / 558.5 · `advanceStableBlocks`(+1자) 0.07~0.27 ms | D-022(펜스) · B9(목록·문단 — C) |
| M4 | parts 접두 참조 비교 · parts 배열 복사 | 1,000: 0.033 · 0.012 ms · 10,000: 0.210 · 0.072 · 100,000: 0.276 · 1.041 | 분절 캐시 접두 확인(B4) — reducer 가 이미 parts 를 복사한다 |
| M5 | 바깥 `Map` 복사(`new Map(m)`, exchange 수 칸) | 1,000: 0.125 / 0.963 · 10,000: 1.792 / 2.275 · 100,000: 15.31 / 26.37 ms | 바깥 맵 통째 복사는 쓰지 않는다 — 블록·뷰 스냅샷은 64칸 청크 영속 목록(EP-8 ① · M6) |
| M6 | 영속 블록 목록 스냅샷 — 64칸 청크 참조 배열 복사 | 블록 5,000(청크 79): 0.4 / 2.5 µs · 100,000(1,563): 5.2 / 15.1 µs · 1,000,000(15,625): 11.1 / 1,095.5 µs | B2 — 갱신마다 청크 배열 하나를 복사한다 |

### 발견 / 제약 (코드)

| ID | 발견 | 근거 |
|---|---|---|
| F1 | 창 `Message` 와 공개 `LoadedMessage` 에 번호가 없다 — 필드는 role·createdAt·parts·incomplete(·`clientId` 라이브 전용) | `chatReducer.ts:227-235` · `shared/ipc.ts:1612-1617` |
| F2 | 행 key — Claude exchange = 배열 색인 `startIndex`, OpenCode = `role:createdAt[:occurrence:n]` | `claude/transcript/Timeline.tsx:92`·`:120` · `useTranscriptVirtualizer.ts:27` · `opencode/transcript/projection.ts:46-52` |
| F3 | 턴 이벤트는 에이전트 호스트가 데이터 호스트와 창에 함께 보내고 창은 저장을 기다리지 않는다. 버스 구독 순서 = 저장 송신(critical) → 제목 → 중계, 둘이 같은 `ev` 객체를 받는다 | `execution-model.md:47-49` · `agent-host/bootstrap.ts:510-514` |
| F4 | 버스 송출 자리는 셋이다 — 조정자 `emit` · 정착 `emitTurn` · 종료 `emit` | `rg -n "emit\('turn.event'" src/main --glob '*.ts' --glob '!*.test.ts'` → 3 (`turn-coordinator.ts:107` · `chat-turn/index.ts:50` · `agent-host/bootstrap.ts:852`) |
| F5 | 질문 답의 도구 완료는 버스를 타지 않는다 — 송신기가 창에 직접 보내고 피어에는 `turn.askAnswers` 로 보낸다 | `persistence-sender.ts:168-205` |
| F6 | DB 번호는 데이터 호스트가 저장할 때 만든다. 사용자 커밋 번호는 `message.committed.messageId` 로 창에 오지만 창이 읽지 않는다. assistant 번호는 창에 오지 않는다 | `writer.ts:94-121`·`:191-199` · `turn-coordinator.ts:185-201` · `chatStore.ts:862-875` |
| F7 | assistant 메시지 시각은 writer `Date.now()` 와 reducer `Date.now()` 가 따로 찍는다 | `writer.ts:197` · `chatReducer.ts:796` |
| F8 | writer 가 part 를 만드는 case 는 8종(`ensureAssistantMessage` 호출), reducer 가 part 를 붙이는 case 는 7종 + 로컬 1(`COMMIT_PENDING_TEXT`). 차이는 `error`(writer 만 part) | `rg -n "ensureAssistantMessage\(turn" src/main/features/history/writer.ts` → 9 = 정의 1 + 호출 8 · `rg -n "appendAssistantPart\(state" src/renderer/src/features/chat/reducer/chatReducer.ts` → 8 |
| F9 | writer 경계는 사용자 커밋·`telemetry`·턴 끝에서 마감, reducer 경계는 "마지막이 user 면 새 메시지" 다 | `writer.ts:148`·`:182-186`·`:515-519` · `chatReducer.ts:793-801` |
| F10 | 창이 Message 객체 리터럴을 만드는 자리는 다섯이다 — 새 assistant · 커밋 user · 로드 · fork 경계선 · 자식 대화 합성 | `rg -n "role: '(assistant|user)'( as const)?,\|role: m\.role" src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` → 7 = 5 + `turns.ts` Turn 리터럴 2 |
| F11 | 사용자 커밋 경로는 둘 — 큐 배치(`commitConsumed`, 배치 `ids`) · 받은 입력(`input.received`, `ids: []`) | `turn-coordinator.ts:177-203` · `:368-389` |
| F12 | 원본 투영은 로컬 행 하나를 원본 메시지 여럿에 묶을 수 있다(`localTargets: Map<행, 원본 색인[]>`). 복구 보관본은 번호 없는 `LoadedMessage[]` JSON 이다 | `native-projection.ts:51-61` · `native-recovery.ts:20-22` · `reader.ts:86` |
| F13 | `NativeHistoryMessage extends LoadedMessage { id: string }` — 어댑터의 원본 id 다 | `adapters/common/native-history.ts:18-22` |
| F14 | reducer 의 전체 탐색 — 산출물 소유 `findIndex` 2 · 커밋 멱등 `some` 1 · 미확정 버블 `filter` 1 · 완료 작업 역탐색 1. store 의 `message.cancelled` 버블 `filter` 1 · `hasCommittedClientId` `some` 1 | `chatReducer.ts:941-961`·`:1043`·`:1107`·`:2159` · `chatStore.ts:482-486`·`:907-913` |
| F15 | Work 선택기는 매 호출 전 exchange·turn·메시지를 돌며(파싱은 메시지 WeakMap) 소유 맵을 다시 만든다 | `workToolResults.ts:38-71` |
| F16 | 바뀐 메시지는 `messageSegments(parts 전체)` 뒤 `reconcileSegments` 로 참조를 복원한다(Claude 공통 · Work 투영) | `AssistantMessage.tsx:31-33` · `workActivity.ts` import |
| F17 | `messages` 를 구독하는 컴포넌트·훅 11곳, 전체 파생 함수 9종의 정의·호출 26줄(14파일) | `rg -n "\(s\) => s\.messages\)\|\(state\) => state\.messages\)" src/renderer/src --glob '!*.test.*'` → 11 · §10 EP-11 ⑧ 검색 → 26 |
| F18 | 작업 보드 캐시는 모듈 전역 1칸이라 세션·타일이 같은 칸을 덮는다 | `taskBoard.ts:100-109` |
| F19 | Claude 마지막 exchange 는 항상 비가상 tail 로 전부 마운트되고 그 안의 메시지·segment key 는 색인이다 | `Timeline.tsx:47-50`·`:110-128` · `AssistantTurn.tsx:52-54` · `AssistantMessage.tsx:39-41` |
| F20 | Claude 도구 카드 펼침은 컴포넌트 `useState` 이고 한 번 연 본문은 닫아도 남는다. OpenCode 는 행 key 로 된 `TimelineDisclosureContext` 를 쓴다 | `ToolCard.tsx:71-74`·`:150` · `opencode/transcript/Timeline.tsx:97` |
| F21 | OpenCode 보존 선택은 양 끝 사이 모든 색인을 가상화 범위에 넣는다 | `opencode/transcript/Timeline.tsx:64-75` |
| F22 | 사용자 버블은 버블마다 `ResizeObserver` · `getComputedStyle` · `scrollHeight` 를 layout effect 안에서 읽고 바로 상태를 쓴다 | `UserBubbleText.tsx:52-67` |
| F23 | 스트리밍 꼬리는 매 delta `<Markdown source={tail}>` 로 다시 파싱된다. 꼬리는 열린 펜스·loose list 에서 나뉘지 않는다 | `StreamingMarkdown.tsx:22-37` · `markdownBlocks.ts:5-11` |
| F24 | 경과 시간은 카드마다 `setInterval(1000)` 이고 계획 승인 카드는 계획 Markdown 을 버튼과 같은 렌더에서 그린다 — T17·T18 은 바꾸지 않는다(D-024) | `shared/ui/elapsed.ts:28-31` · `ApprovalCard.tsx:160-165` |
| F25 | delta 반영은 이벤트마다 세션 탐색·문자열 결합·항목 spread 다(묶음당 `sessions` 복사 1) | `chatStore.ts:550-573` |

### 전수 조사 (`app/` 기준 · AS-IS)

| ID | 대상 | 검색/방법 | N | 의미 |
|---|---|---|---:|---|
| S1 | 버스 송출 | `rg -n "emit\('turn.event'" src/main --glob '*.ts' --glob '!*.test.ts'` | 3 | F4 |
| S2 | writer part 생성 case | `rg -n "ensureAssistantMessage\(turn" src/main/features/history/writer.ts` | 9 | 정의 1 + 호출 8 — EP-2 ④ 분모 8 |
| S3 | reducer part 붙이기 | `rg -n "appendAssistantPart\(state" src/renderer/src/features/chat/reducer/chatReducer.ts` | 8 | EP-4 ③④ 분모(7 이벤트 + `COMMIT_PENDING_TEXT`) |
| S4 | 창 Message 리터럴 | F10 명령 | 5 | EP-4 ⑤~⑧ 분모 |
| S5 | 전체 파생 함수 정의·호출 | `rg -n "subagentTasksFromMessages\(\|childMessageForParentToolRunId\(\|subagentTaskDescription\(\|taskBoardForMessages\(\|taskBoardFromMessages\(\|transcriptResultsByToolUseId\(\|persistedBackgroundModels\(\|sessionPanelModel\(\|createTaskContextSourceSelector\b" src/renderer/src --glob '!*.test.*'` | 26 | 14파일 — EP-11 ⑦⑧ |
| S6 | `messages` 구독 | F17 명령 | 11 | `ChatTile` 1(Transcript 로 전달) · `ProjectLandingPage` 1(`length` 만 — 무관) · 파생 소비자 9 |
| S7 | `startIndex` 사용(테스트 제외) | `rg -n "startIndex" src/renderer/src --glob '!*.test.*' --glob '!*.json'` | 26 | turns 15 · Claude Timeline 4 · Exchange 2 · virtualizer 2 · Work 1 · `useAttachments` 2(무관 — 첨부 색인) |
| S8 | reducer `messages` 쓰기 | `rg -n "^\s+messages[,:]\|let messages = \|const messages = \|messages = append" src/renderer/src/features/chat/reducer/chatReducer.ts` | 21 | 형 선언·초기값 5 + 쓰기 16줄 = EP-5 ③ 7 자리 |
| S9 | 저장 경로 기존 테스트 | `ls src/main/features/history/writer*.test.ts src/main/app/data-host/persistence-receiver.test.ts src/main/app/agent-host/persistence-sender.test.ts src/main/app/response-boundary.integration.test.ts` | 9 | VP-35 |


### 추가 발견 (rev 2)

| ID | 발견 | 근거 |
|---|---|---|
| F26 | 가상화가 하네스마다 다르다 — Claude 는 과거 exchange 만 TanStack 으로 가상화하고 크기 변화 보정은 TanStack 기본값, OpenCode 는 행을 가상화하고 TanStack 보정을 끈 뒤 자기 보정기가 쓴다 | `claude/transcript/Timeline.tsx:47-50` · `useTranscriptVirtualizer.ts:20-30` · `opencode/transcript/Timeline.tsx:93` · `ScrollController.tsx:40-66` |
| F27 | 세션 엔트리를 버리는 `dropSession` 호출은 다섯 흐름이다 — 다른 세션 첫 로드 취소 · 세션 없음 · 캐시 없는 로드 실패 · 외부 변경 무효화 · 삭제 | `rg -n "dropSession\(" src/renderer/src --glob '!*.test.*'` → 정의 1 + 호출 5(`chatStore.ts:1836`·`:1853`·`:1872`·`:1925`·`:1931`) |
| F28 | Work 활동 노드 key 는 메시지 색인 기반이다 | `workActivity.ts:68`(`${prefix}${position}`) · `:79`(`${index}:boundary:${offset}`) |
| F29 | 세션에 다시 들어올 때 Claude 는 하단, OpenCode 는 저장 위치(하단 고정이면 하단)다 | `useScrollAnchor.ts:109-132` · `opencode/transcript/ScrollController.tsx:104` |
| F30 | Claude 스크롤 앵커에는 테스트가 없고 OpenCode 보정기에는 있다 | `ls harnesses/claude/transcript/*.test.*` 9파일에 scroll 없음 · `ScrollController.interaction.test.ts` 2 케이스 |
| F31 | 스트리밍 꼬리 분할은 매 호출 `source.slice(consumed)` 전체를 다시 스캔한다 — 열린 펜스·loose list 에서 consumed 가 멈춰 delta 마다 꼬리 전체 | `markdownBlocks.ts:97-98` |
| F32 | 0325 grouper 의 재그룹 시작은 `min(첫 변경, 첫 비재사용 exchange 시작)` 이라 끝 추가에서도 마지막 exchange 시작부터 읽는다 | `turns.ts:156-157` |

### PR #635 리뷰 지적 검증 (rev 2 · 코드·계산으로 확인)

| ID | 지적(요지) | 확인 | 반영 |
|---|---|---|---|
| V1 | 변경 기록 값이 base 배열을 잡아 조상 전부가 산다 — 1,000 append 에 1,001 버전·500,500 슬롯 | 재현 — rev 1 EP-5 ① `WeakMap<Message[], { base; from }>` · 길이 0~1,000 배열 슬롯 합 = 1,000·1,001/2 = 500,500 | D-031 · AC7 |
| V2 | 첫 변경 위치 ≠ 변경 범위 — index 1 교체가 뒤 전부를 읽고 끝 append 도 마지막 exchange 시작부터 읽는다 | 재현 — rev 1 EP-6 ①~④·EP-11 ② "접미만 다시 세운다" · F32 | D-032 · AC8·AC10·AC21·AC29 · §1 |
| V3 | 같은 메시지 무관 변경의 revision · 부모별 child 독립 · lookup snapshot | 재현 — rev 1 EP-11 ②③(위치 단위 철회·재적용) · rev 1 B15("스냅샷이 아니다") | D-033 · D-046 · AC11·AC29 |
| V4 | 재커밋 · 늦은 A→B→A · uuid=요청 id · UNIQUE 를 저장 실패로 · error part | 재현 — rev 1 EP-2 ③(현재 번호와 다르면 새 행 → 늦은 A 가 같은 번호 두 번째 행 → 유일 색인 위반) · rev 1 §13(위반 = 저장 실패) · `u:` 공유 · `writer.ts:469-471`(error 는 현재 행) | D-028 · D-029 · AC1·AC3~AC5 · B7 |
| V5 | i4 와 EP-3 의 두 읽기 · 앞삽입으로 소유 이동 · 첫 메시지 기반 exchange id 변경 | 재현 — rev 1 i4("둘째는 `n:`") ↔ EP-3 ③("아직 안 쓴 번호 → 없으면 `m:`") · 처리 순서가 "가장 작은 DB id 부터" 라 앞 원본이 더해지면 바뀐다 | D-030 · D-034 · AC2·AC9·AC22 |
| V6 | s3 와 "마지막 이전 segment 전부 같은 객체" 모순 | 재현 — rev 1 AC13 문장 | D-036 · AC13 |
| V7 | t6 head 전환 재마운트 · 복사·키보드·대규모 범위 | 재현 — rev 1 t6 · B13 | D-037 · D-040 · AC16·AC26 |
| V8 | 펼침 정리 흐름 · 전환 종료 미발생 · 측정 무효화 입력과 읽기 | 재현 — rev 1 EP-14 ⑤ · EP-15 ①(`transitionend` 만) · EP-17 ④(`textContent`·`clientWidth`) | D-038 · D-039 · D-041 · AC24·AC25·AC27 |
| V9 | 열린 펜스여도 `advanceStableBlocks` 가 꼬리를 다시 스캔 | 재현 — F31 | D-042 · AC28 · J7 |
| V10 | AC15↔AC30 불일치 · AC29 N/A · J 세 갈래 · S 고정 | 재현 — rev 1 AC30 "그대로 통과" ↔ VP-32 p2 예외 · rev 1 AC29 "값 또는 N/A" | AC34 · D-049 · D-043 · §19 |
| V11 | PR 제목·본문이 0325 단계 A | 확인 — PR #635 제목 "docs(handoff): 0325 plan — 0324 감사 후속 단계 A 설계(READY)" | D-051 |

### 수치 / 전칭 표현 검산

- S8 21 = 형 선언·초기값 5 + 쓰기 16줄 — rev 2 의 기록 자리는 EP-5 ③ⓐ~ⓗ 8(도우미 3 + 인라인 4 + `PREPEND_HISTORY` 1). store 의 `messages` 쓰기는 fork 초안 1(`chatStore.ts:1618` — 새 세션이라 빈 기록).
- S7 26 = 15 + 4 + 2 + 2 + 1 + 2. S1 3(`--glob '*.ts'`). F10 7 = Message 리터럴 5 + Turn 리터럴 2. F27 6 = 정의 1 + 호출 5.
- "세 진입점": `harnesses/registries/transcript.tsx` 의 Timeline 2(`ClaudeTranscriptView` — code·work 두 투영 · `OpenCodeTimeline`).
- 기존 테스트 이름은 `rg -n "^\s*(describe|it)\("` 와 `it.each` 제목 줄로 확인했다 — VP-36~VP-38 인용 전부.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
에이전트 호스트  어댑터 이벤트 → bus → 송신기(피어) → 중계(창)          번호 없음
데이터 호스트    writer: 사용자 커밋·telemetry·턴 끝 = 경계 → DB id(창 모름)
창 store        messages 새 배열(무엇이 바뀌었는지 알리지 않음)
Claude          grouper(참조 비교 n · 마지막 exchange 시작부터) → Work 선택기(전체) → head exchange 가상화(startIndex key)
                + 마지막 exchange 전부 마운트 · useScrollAnchor(CSS 예약 + RO 하단 추적) · TanStack 기본 크기 보정
OpenCode        projectTimelineHead(전체 · occurrence) → 행 가상화(role:createdAt key) · ScrollController(앵커 캡처·복원, TanStack 보정 끔)
패널·보드       9 함수 × 새 배열마다 전체 접기
```

### TO-BE

```text
에이전트 호스트  bus → 송신기: 8종에 현재 번호 · 비움 3 · 질문 답 · 사용자 u:/i: ──┬→ 피어 → writer: (세션, 번호) 행에 붙임 · 없으면 새 행
                                                                               └→ 창 reducer: 번호의 메시지 · 없으면 끝에 새 메시지
창 store        messages + transcriptChanges(lineage · revision · 최근 64 개 append/replace/remove/prepend/reset)
                ├─ messageOrder(lineage) — 번호 → 순번·위치 · toolRunId·응답·통지 → 소유 번호            (reducer·store 조회)
                ├─ 하네스 블록 모델(lineage) — Claude Code · Claude Work · OpenCode → 영속 블록 목록 → 불변 스냅샷
                └─ transcriptIndex(lineage) — 도메인 9 · 값 비교 revision · 부모별 revision → 불변 뷰 → useTranscriptView
공통 뷰포트     TanStack 1 인스턴스 · key = 블록 key · 측정 캐시(key) · 범위(가시 + overscan + 선택 + 앵커)
                · 단일 scrollTop 쓰기 · 앵커 캡처/복원(앞삽입) · pin/하단 추적 · 꼬리 자리(예약 간격·대기·steer·오류·맨 아래로)
                · 진입 배치(Claude 하단 · OpenCode 저장 앵커) · 펼침·포커스 = disclosureStore(세션 + 블록 key)
live delta      리프(Claude PendingAssistant · OpenCode live 행)만
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 메시지 경계 둘 · 스크롤 보정 하네스마다 · 가상화 단위 다름 | 번호가 메시지 정본 · 뷰포트가 스크롤 쓰기·가상화 단일 소유 · 하네스는 블록 생성·렌더 | D-029 · D-037 · D-045 · D-046 | VP-02 · VP-21 |
| data/control flow | 새 배열마다 전체 재투영 | 기록 종류별로 지목된 메시지만 | D-031 · D-032 · D-033 | VP-10 · VP-16 · VP-32 |
| state/contract | 번호 없음 · key = 색인·시각·첫 메시지 | 번호(이벤트·로드·DB) · key = 번호 + part·도구 id · 스냅샷 불변 | D-004 · D-034 · D-046 | VP-05~VP-08 · VP-14 · VP-15 |
| error/lifecycle | 다시 열기·head 전환·가상화로 상태 소실 · 앞삽입 없음 | 같은 key·같은 측정 · 펼침 store · 앞삽입 앵커 | D-037 · D-038 · D-044 | VP-08 · VP-22 · VP-27 · VP-28 |
| test seam/관측점 | 시간·호출 수 | parts getter · 할당 계수 · 가짜 측정 virtualizer · 공유 고정 입력 · 앞삽입 재생 · property | D-032 | 각 UT·IT·ST |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/message-id.ts`(신규) | 번호 접두 8 · 생성 함수 · `PART_EVENT_TYPES` | 원천 id → 번호 | 송신기 · 조정자 · writer · reader · reducer · store · `parts.ts` |
| `src/shared/message-identity.testfixture.ts`(신규) | 종단 고정 입력 | — | main·renderer ST |
| `main/app/agent-host/persistence-sender.ts` · `features/chat/turn-coordinator.ts` | 발급 · 사용자 번호 | 턴 이벤트 → 번호 붙은 이벤트 | 버스 · 조정자 |
| `main/features/history/writer.ts` · `infra/db/*` · `migrations/0036_message_key.sql` | 번호 대상 저장 · 재커밋 멱등 | 이벤트 → 행 | receiver |
| `main/features/history/{native-projection,reader,native-recovery}.ts` | 로드 번호 | 행·원본·보관본 → 번호 | `loadSession` |
| `renderer/.../lib/transcript/changeLog.ts`(신규) | 기록 종류 · 고리 64 · `changesSince` | 쓰기 → 기록 | reducer · 소비자 |
| `renderer/.../lib/transcript/messageOrder.ts`(신규) | 번호·순번·소유 색인 | 기록 → 조회 | reducer · store |
| `renderer/.../lib/transcript/{blockList,blockKeys}.ts`(신규) | 영속 블록 목록 · key 규칙 | 블록 → 스냅샷 | 블록 모델 |
| `harnesses/claude/transcript/claudeBlocks.ts`(신규) · `harnesses/opencode/transcript/openCodeBlocks.ts`(신규) | 하네스 블록 생성기(code·work · OpenCode) · 그룹 메타 | messages + 기록 → 스냅샷 | 각 Timeline |
| `renderer/.../lib/segmentCache.ts`(신규) | 분절 캐시 | 메시지 → segment | 블록 생성기 |
| `renderer/.../components/transcript/TranscriptViewport.tsx`(신규) · `lib/transcript/viewport/{range,anchor,pin,reserve,entry}.ts`(신규) | 공통 뷰포트 · 순수 정책 | 스냅샷 + 정책 → DOM | 세 Timeline |
| `renderer/.../lib/transcriptIndex.ts`(신규) | 패널 색인 · 뷰 | 기록 → 뷰 | `useTranscriptView` |
| `renderer/.../store/disclosureStore.ts`(신규) | 펼침·포커스 | key → 상태 | 블록 컴포넌트 |
| `renderer/.../lib/bubbleMeasure.ts`(신규) | 버블 측정 일괄 | 요소 → 넘침 | `UserBubbleText` |
| `renderer/.../lib/markdownBlocks.ts` · `components/markdown/StreamingMarkdown.tsx` | 꼬리 스캐너 · 열린 펜스 | 소스 → 블록 | StreamingMarkdown |

## 10. 계약 / 타입 / 강제 지점

검색 명령은 `app/` 에서 돌린다. "출력과 차집합 0"은 출력의 모든 줄이 목록의 어떤 자리에 속하고 자리마다 줄이 1개 이상이라는 뜻이다. 번호 접두·생성 함수의 정본은 `src/shared/message-id.ts` 하나다. 창의 세 색인(순번·블록 모델·패널)은 세션 계보 토큰(`transcriptChanges.lineage` — fork·새 대화마다 새 객체)을 키로 한 `WeakMap` 에 살고 배열을 잡지 않는다 — 세션 엔트리가 지워지면 토큰과 함께 사라진다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| **EP-1** · AR-01·MD-01 / VP-03·VP-04 | 8종에 턴의 현재 번호 · 비움 3 · 사용자 번호 | `message-id.ts` · `persistence-sender.ts` · `turn-coordinator.ts` | 에이전트 호스트 | 자리 11 — ① `message-id.ts` 접두 8 · 생성 함수(`assistantMessageId`·`userMessageId`·`receivedMessageId`·`localRowMessageId`·`nativeOnlyMessageId`·`orphanMessageId`·`archivedMessageId`·`rendererMessageId`·`childMessageId`) · `PART_EVENT_TYPES` ② 송신기 `TurnState.messageKey` · 주입 `newId`(조립이 `crypto.randomUUID` — 기본값 없음) ③ `onTurnEvent` — 8종이면 `ev.messageKey = state.messageKey ??= assistantMessageId(newId())` 를 피어 송신 전에 ④ `relay`(큐 포함)는 같은 `ev` 객체 ⑤ `flushAskAnswers` — 창 `tool.call.completed` 와 `turn.askAnswers` 묶음에 같은 번호 ⑥ `telemetry` → 피어 송신 뒤 비움 ⑦ `commitUserMessage` → 요청 전 비움 · 배치 `messageKey` 를 피어로 ⑧ `finalizeTurn` → 상태 삭제 ⑨ 조정자 `commitConsumed` → `userMessageId(batch.ids[0])` 를 커밋 배치와 `message.committed` 에 ⑩ 조정자 `input.received` → `receivedMessageId(ev.uuid, ev.nativeMessageId, newId)` 를 같은 두 곳에 ⑪ 형 — `ipc.ts` 8종 `messageKey?` · `message.committed.messageKey` · `peer-protocol.ts` `turn.commitUser`·`turn.askAnswers` `messageKey` | `rg -n "messageKey\|PART_EVENT_TYPES\|assistantMessageId\|userMessageId\|receivedMessageId" src/main/app/agent-host src/main/features/chat src/shared/message-id.ts src/shared/ipc.ts src/shared/peer-protocol.ts --glob '!*.test.ts'` → ①~⑪ 차집합 0 · 음성 ``rg -n '`(a\|u\|i\|m\|n\|x\|r\|c):\$\{' src --glob '!*.test.*' --glob '!*.testfixture.*' --glob '!src/shared/message-id.ts'`` · `rg -n "'(a\|u\|i\|m\|n\|x\|r\|c):' \+" src --glob '!*.test.*' --glob '!src/shared/message-id.ts'` → 둘 다 0(AS-IS 0) | ③ 이 빠지면 두 곳이 다른 메시지를 만든다. ⑥⑦⑧ 하나가 빠지면 다음 턴 답이 앞 메시지에 붙는다(VP-02). ⑩ 이 `u:` 면 같은 문자열 입력에서 번호가 겹친다(k11) |
| **EP-2** · MD-04 / VP-06 | 번호 행에 붙임 · 재커밋 멱등 · 역할 불일치 실패 | `writer.ts` · `infra/db/{queries,types}.ts` · `0036_message_key.sql` | 데이터 호스트 | 자리 9 — ① `0036_message_key.sql` — `ALTER TABLE messages ADD COLUMN message_key TEXT` · `CREATE UNIQUE INDEX idx_messages_session_key ON messages(session_id, message_key) WHERE message_key IS NOT NULL` ② `MessageInsert.messageKey?` · `appendMessage` 가 열에 쓴다 ③ `findMessageByKey(sessionId, key)` → `{ id, role }` ④ `ensureAssistantMessage(turn, sessionId, key?)` — 번호 행이 있고 role 이 assistant 면 그 행(현재 행이 아니면 text 가 붙을 때 그 행 content 를 바로 갱신 — FTS), role 이 다르면 throw(저장 실패), 없으면 현재 행 마감 뒤 새 행 · 번호 없음은 현행 ⑤ 8 case 가 `ev.messageKey` 를 ④ 에 ⑥ `commitUserMessage` — 번호 행이 있으면 그 id 를 돌려주고 끝(행·part·미리보기 갱신 0), 없으면 현행 + 번호 저장 ⑦ 질문 답 저장이 묶음 번호를 ④ 에 ⑧ `TurnContext.currentAssistantMessageKey?` · receiver 초기값 · `finalizeTurn` 이 비움 ⑨ `loadParts` SELECT `m.message_key` → `LoadedPartRow.message_key` | `rg -n "message_key\|messageKey\|findMessageByKey\|currentAssistantMessageKey" src/main/features/history src/main/infra/db src/main/app/data-host src/main/contracts --glob '!*.test.ts'` → ①~⑨ 차집합 0 · `rg -n "ensureAssistantMessage\(turn, turn\.dbSessionId" src/main/features/history/writer.ts` → 8줄 모두 세 번째 인자 | ③④ 없이 마지막 행만 보면 늦은 A 가 같은 번호 두 번째 행을 만들려다 유일 색인에 막혀 턴이 실패한다(w3). ⑥ 이 없으면 재전달이 사용자 행을 겹친다(w5) |
| **EP-3** · MD-02 / VP-05 | 로드 번호 규칙(D-030) · 유일 | `native-projection.ts` · `reader.ts` · `native-recovery.ts` · `ipc.ts` | 데이터 호스트 | 자리 7 — ① `LoadedMessage.id: string` ② `localMessages` → `row.message_key ?? localRowMessageId(row.message_id)` ③ `projectNativeHistory` — 로컬 행마다 묶인 원본 중 가장 뒤 원본에 그 행 번호(②의 값). 한 원본이 두 행의 가장 뒤 원본이면 DB id 가 작은 행 ④ 번호를 받지 못한 원본 → `nativeOnlyMessageId(원본 id)` ⑤ 고아 메시지 → `orphanMessageId(②의 값)`(= 값 + `#o`) ⑥ frontier 뒤 로컬 메시지 → ② ⑦ `recoveryArchive` → `message.id ?? archivedMessageId(순번)` | `rg -n "localRowMessageId\|nativeOnlyMessageId\|orphanMessageId\|archivedMessageId\|message_key" src/main/features/history --glob '!*.test.ts'` → ②~⑦ · `rg -n "interface LoadedMessage" -A 7 src/shared/ipc.ts` → `id: string` 1 | ③ 이 "가장 앞" 이면 앞삽입으로 소유가 옮겨 간다(i8). ⑤ 가 없으면 고아와 투영 메시지 번호가 겹친다 |
| **EP-4** · MD-03·AR-02 / VP-07·VP-08 | 창 메시지 번호 · 번호의 메시지에 붙임 | `chatReducer.ts` · `chatStore.ts` · `parts.ts` | 창 | 자리 11 — ① `Message.id: string` ② `appendAssistantPart(messages, part, key?)` — 번호가 있고 그 메시지가 있으면(`messagePosition`) 그 메시지에, 번호가 있고 없으면 끝에 `id = key` 새 메시지, 번호 없음은 마지막 assistant / `rendererMessageId()` ③ 7 이벤트 case 가 `ev.messageKey` ④ `COMMIT_PENDING_TEXT` 번호 없음 ⑤ `APPEND_COMMITTED_USER_MESSAGE` — `id = action.messageKey ?? (clientId ? userMessageId(clientId) : rendererMessageId())` · 그 번호가 이미 있으면 무변경 ⑥ `LOAD_SESSION` `id: m.id` ⑦ fork 경계선 `rendererMessageId()` ⑧ `deriveChildMessage` → `childMessageId(parent)` ⑨ 낙관 전송이 ⑤ 를 거친다 ⑩ store `message.committed` → `messageKey` 전달 ⑪ 다시 열기 — 블록 key 가 번호에서 나온다(EP-7 과 같은 자리를 다시 열기 입력으로 관측) | `rg -n "rendererMessageId\|userMessageId\|childMessageId\|messageKey\|role: '(assistant\|user)'( as const)?," src/renderer/src/features/chat --glob '!*.test.*' --glob '!*.testfixture.*'` → ①~⑩ | ② 가 마지막만 보면 늦은 A 가 새 메시지를 만든다(r3). ⑤ 가 낙관·echo 에 다른 번호를 주면 확정 순간 다시 마운트된다 |
| **EP-5** · MD-05 / VP-10 | 종류별 변경 기록 · 고리 64 · 배열 비보유 | `lib/transcript/changeLog.ts` | reducer | 자리 11 — ① `TranscriptChange` = `append{ids}` \| `replace{id, partsFrom}` \| `remove{ids}` \| `prepend{ids}` \| `reset` · `recordChange(log, change)` — 새 고리(≤ `TRANSCRIPT_CHANGE_LOG_MAX = 64`) · `revision + 1` ② `changesSince(log, revision)` → 항목 열 또는 `reset`(밀림 > 64 · 다른 lineage) ③ reducer 기록 자리 8 — ⓐ `appendAssistantPart`(붙임 `replace{id, partsFrom: 이전 길이}` · 새 `append`) ⓑ `appendOwnedArtifact`(`replace{소유, 이전 길이}`) ⓒ `correctPlanToolInput`(`replace{id, partIndex}`) ⓓ `APPEND_COMMITTED_USER_MESSAGE`(`append`) ⓔ `DROP_UNCOMMITTED_USER`(`remove`) ⓕ `LOAD_SESSION` 보존 갈래(`reset`) ⓖ `LOAD_SESSION` 전체 갈래(`reset`) ⓗ `PREPEND_HISTORY`(`prepend`) ④ `ChatState.transcriptChanges = { lineage, revision, log }` — 초기값·`NEW_CHAT`·fork 초안은 새 `lineage` | `rg -n "recordChange\(\|changesSince\(\|TRANSCRIPT_CHANGE_LOG_MAX\|transcriptChanges" src/renderer/src/features/chat --glob '!*.test.*'` → ①~④ + 소비자 호출(EP-6·EP-8·EP-13) · S8 명령 → 쓰기 16줄 + `PREPEND_HISTORY` 1 이 ⓐ~ⓗ 안 | 한 자리가 기록을 빠뜨리거나 종류를 틀리면 소비자가 바뀐 메시지를 놓친다 — 자리마다 sweep 사례(VP-10). 기록이 배열을 잡으면 V1 의 보유가 돌아온다(l3·l7) |
| **EP-6** · MD-06·AR-03 / VP-11·VP-12 | 번호·순번 색인과 조회 | `lib/transcript/messageOrder.ts` | reducer · store | 자리 10 — ① `messageOrderFor(state)` — lineage 키 색인을 `changesSince` 로 갱신. 순번은 끝 추가 +1 · 앞삽입 −1, 삭제는 빼고 위치 표를 더럽힘(다음 위치 조회에서 한 번 다시 셈) ② `messagePosition`·`toolCallOwner`·`responseOwner`·`noticeOwner` — `replace{partsFrom}` 은 새 part 만 읽어 갱신 ③ reducer `output.captured` 소유(`:1043`) ④ `tool.call.completed` 영수증 소유(`:1107`) ⑤ `appendOwnedArtifact` 복사 + 한 칸 교체(`:851`) ⑥ `APPEND_COMMITTED_USER_MESSAGE` 멱등(`:926`) ⑦ `DROP_UNCOMMITTED_USER` 위치(`:959`) ⑧ `subagent.task` 통지 멱등(`:1292`) ⑨ `markCompletedAgentTask`(`:2159`) ⑩ store `message.cancelled`(`:908`)·`hasCommittedClientId`(`:485`) | `rg -n "messages( \?\? \[\])?\)?\.(some\|filter\|findIndex\|find\|every\|flatMap\|map)\(\|findToolCallPart\(" src/renderer/src/features/chat/reducer/chatReducer.ts src/renderer/src/features/chat/store/chatStore.ts` → AS-IS 11 · TO-BE 2(`LOAD_SESSION` 의 `map` — B1 · 이어하기 자격의 사용자 수 `filter` — 사용자 동작 1회) · `rg -n "messageOrderFor\|messagePosition(\|toolCallOwner(\|responseOwner(\|noticeOwner(" <같은 두 파일>` → ③~⑩ | 전체 탐색이 남으면 그 이벤트가 이력 길이에 비례한다(M1k · AC8 index 1 입력) |
| **EP-7** · MD-07 / VP-14 | 블록 key 규칙(D-034) | `lib/transcript/blockKeys.ts` | 블록 생성기 | 자리 8 — ① key 함수 — `userBlockKey(id)` · `partBlockKey(id, kind, ordinal)` · `toolBlockKey(toolRunId)` · `activityBlockKey(firstToolRunId)` · `turnMetaKey(firstAssistantId)` · `turnArtifactsKey(firstAssistantId)` · `liveBlockKey(sessionKey)` ② Claude code 생성기 ③ Claude work 생성기 — work 투영 노드 key 를 ① 로(F28 색인 key 제거) ④ OpenCode 생성기 — 메시지를 가로지르는 text 병합 segment 는 첫 part 의 메시지 번호·순번 ⑤ 종류별 순번 = 그 메시지 안 같은 종류 part 의 순서(부모 있는 part 제외) ⑥ 메타·산출물 = 턴 첫 assistant 메시지 번호 ⑦ live = 세션 키 ⑧ 스냅샷 key 유일(생성기 단언 — 중복이면 throw) | `rg -n "BlockKey\|turnMetaKey\|turnArtifactsKey\|liveBlockKey" src/renderer/src/features/chat --glob '!*.test.*'` → ①~⑧ · 음성 `rg -n "occurrence\|startIndex\}\|:\$\{index\}:\|\$\{prefix\}\$\{position\}" src/renderer/src/features/chat/harnesses src/renderer/src/features/chat/lib/workActivity.ts --glob '!*.test.*'` → 0 | key 가 위치·시각·첫 메시지에 기대면 앞삽입·그룹 재편에서 바뀌어 다시 마운트된다(y4·y5) |
| **EP-8** · MD-08·MD-09·AR-04·AR-05 / VP-15~VP-17·VP-19 | 영속 블록 목록 · 불변 스냅샷 · 종류별 증분 · 늦은 결과 · live 리프 | `lib/transcript/blockList.ts` · `claudeBlocks.ts` · `openCodeBlocks.ts` | 블록 생성기 | 자리 10 — ① `blockList` — 64칸 청크, 범위 삽입·교체·삭제는 닿은 청크만 새로 · 스냅샷 `{ revision, count, keyAt, blockAt, indexOf }` · `indexOf` 는 key → 청크 표 ② 스냅샷 불변 — 청크를 제자리에서 고치지 않는다 ③ Claude code `advance(messages, changes)` ④ Claude work `advance` ⑤ OpenCode `advance` ⑥ 그룹 메타 — 턴·exchange 경계를 블록 속성(위 간격 · 메타 자리 · 예약 대상 = 마지막 user 블록 · fork = 마지막 assistant 메타)으로 두고 경계가 바뀐 블록만 새 객체 ⑦ `prepend` — 새 블록 + 경계 블록 ≤ 2 ⑧ `reset` — 전체 구성 ⑨ 늦은 결과 — `tool_result` 의 toolRunId → 원래 호출 블록(`toolCallOwner` → 블록 key)만 새 객체 ⑩ live — 생성기는 live 유무만 보고(구조), 본문은 리프가 store 에서 읽는다 | `rg -n "createBlockList\|advance\(\|liveBlockKey\|toolCallOwner\(" src/renderer/src/features/chat/lib/transcript src/renderer/src/features/chat/harnesses/claude/transcript/claudeBlocks.ts src/renderer/src/features/chat/harnesses/opencode/transcript/openCodeBlocks.ts --glob '!*.test.*'` → ①~⑩ · 음성 `rg -n "projectTimelineHead\(\|groupExchanges\(\|createExchangeGrouper\(\|createWorkToolResultSelector\(" src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` → 0(전체 구성은 `reset` 과 테스트 oracle 만 — `blockOracle.testfixture.ts`) | ⑥⑦ 이 빠지면 앞삽입·끝 추가에서 간격·메타가 낡는다(property). ② 를 어기면 React 가 받은 스냅샷 값이 바뀐다(u2). ⑨ 가 지금 메시지에 붙이면 원래 카드가 결과를 못 받는다 |
| **EP-9** · MD-10 / VP-18 | 분절 캐시(D-036) | `lib/segmentCache.ts` | 블록 생성기 | 자리 4 — ① `segmentsFor(message, partsFrom?)` — 같은 번호 이전 결과가 있고 접두가 같으면 마지막 segment 시작부터 재분절 · 새 `tool_result` 가 가리키는 앞 호출은 그 ToolCall·그 segment 만 새 객체 · 접두가 다르면 전체 · 결과 맵은 새 결과만 더함 ② Claude code 생성기 ③ Claude work 투영(`createWorkProjector`) ④ `reconcileSegments` 와 `parts.reconcile.test.ts` 삭제 | `rg -n "segmentsFor\|createSegmentCache\|reconcileSegments" src/renderer/src --glob '!*.test.*'` → `reconcileSegments` 0 · 나머지 ①②③ | ① 이 앞 segment 를 다시 만들지 않으면 앞 카드가 "실행 중" 에 머문다(s3) |
| **EP-10** · AR-06 / VP-21·VP-22 | 세 진입점 · 단일 스크롤 쓰기 · 단일 virtualizer | `components/transcript/TranscriptViewport.tsx` | 공통 뷰포트 | 자리 8 — ① `TranscriptViewport` — `useVirtualizer`(count·`getItemKey = keyAt`·`estimateSize` = key 측정 캐시·`measureElement`·`rangeExtractor` EP-17·overscan 6) ② `writeScrollTop` — `scrollTop` 쓰기 유일 자리 ③ 크기 변화 보정 — `shouldAdjustScrollPositionOnItemSizeChange` 는 뷰포트가 앵커 정책으로 정한다(하네스가 끄거나 켜지 않는다) ④ Claude Timeline(code·work)이 ① 을 쓴다 ⑤ OpenCode Timeline 이 ① 을 쓴다 ⑥ `ClaudeScrollController`·`useScrollAnchor` → 뷰포트 정책 설정만(직접 쓰기 0) ⑦ `OpenCodeScrollController` → 같은 꼴(캡처·복원은 뷰포트 `anchor`) ⑧ `UserBubbleText` 접기 뒤 보이기 → 뷰포트 문맥 `reveal(element)` | 세 명령 — `rg -n "useVirtualizer\(" src/renderer/src/features/chat --glob '!*.test.*'` → 1(①) · `rg -n "scrollTop\s*=\|\.scrollTo\(\|scrollIntoView\(" src/renderer/src/features/chat --glob '!*.test.*'` → 뷰포트 모듈 줄만(②) · `rg -n "TranscriptViewport" src/renderer/src/features/chat/harnesses --glob '!*.test.*'` → ④⑤ | 두 보정 주체가 남으면 같은 높이 변화를 두 번 고친다(코멘트 3). 한 진입점이 자체 virtualizer 면 그 화면만 head 전환 재마운트가 남는다 |
| **EP-11** · MD-11·AR-07 / VP-23·VP-24 | pin · 예약 간격 · 전송 앵커 · 진입 배치 · 꼬리 자리 · fork | `lib/transcript/viewport/{pin,reserve,entry}.ts` · Claude Timeline | 공통 뷰포트 · Claude | 자리 7 — ① pin — 하단 판정(Claude 24px · OpenCode `isTimelineBottom` 현행 값 — 하네스 설정) · 사용자가 올리면 해제 ② 예약 간격(Claude) = max(0, 0.5 × 뷰포트 높이 − (전체 높이 − 마지막 user 블록 시작)) — virtualizer 측정값으로 계산(DOM 읽기 없음) ③ 전송 앵커(Claude) — `sendCount` 가 바뀐 커밋에서 하단으로 smooth 1회 ④ 진입 배치 — 처음 여는 세션 하단 · 다시 들어온 세션 Claude 하단 · OpenCode 저장 앵커(하단 고정이면 하단) ⑤ 하단 추적 — pin 이고(Claude 는 생성 중일 때만) 전체 높이가 늘면 하단 ⑥ 꼬리 자리 — 대기 표시·steer·오류 배너·맨 아래로 버튼을 하네스가 그린다(비가상) ⑦ fork — 마지막 assistant 턴 메타 블록 속성 | `rg -n "reserveGap\|pinPolicy\|entryPolicy\|footer\|forkable" src/renderer/src/features/chat/lib/transcript/viewport src/renderer/src/features/chat/components/transcript src/renderer/src/features/chat/harnesses/claude/transcript --glob '!*.test.*'` → ①~⑦ | ② 식이 틀리면 0008 앵커(답이 예약 공간을 채우는 동안 스크롤 정지)가 깨진다(p3). ④ 를 한 정책으로 합치면 한 하네스의 현행 복귀 동작이 바뀐다(p7·p8) |
| **EP-12** · MD-12·SD-03 / VP-26·VP-27 | 앞삽입 앵커 · `PREPEND_HISTORY` | `lib/transcript/viewport/anchor.ts` · reducer | 공통 뷰포트 · reducer | 자리 6 — ① 캡처 — 스냅샷 변경이 `prepend` 면 적용 전 첫 가시 블록의 (key, 메시지 번호, 상단 픽셀 거리) ② 1차 보정 — 같은 layout effect 에서 삽입 블록 추정 높이 합만큼 `writeScrollTop` ③ 측정 정정 — 삽입 블록이 측정되면 앵커 블록 실제 위치와 기록 거리의 차만큼 다시 ④ 대체 — 앵커 key 가 없으면 같은 메시지 번호의 첫 블록, 그것도 없으면 다음 블록 ⑤ `PREPEND_HISTORY{ messages }` 동작 + `chatActions.prependHistory(sessionKey, messages)`(생산자는 E — 0326 은 고정 입력 테스트가 부른다) ⑥ pin 이면 앵커 없이 하단 유지 | `rg -n "captureAnchor\|restoreAnchor\|PREPEND_HISTORY\|prependHistory" src/renderer/src/features/chat --glob '!*.test.*'` → ①~⑥ | ③ 이 없으면 추정과 실측 차만큼 읽던 문장이 밀린다(a3). ⑥ 이 없으면 하단을 보던 사용자가 위로 끌려간다 |
| **EP-13** · MD-16 / VP-32 | 패널 색인(D-033) | `lib/transcriptIndex.ts` | 창 | 자리 6 — ① `transcriptIndexFor(state)` — lineage 키 · `changesSince` ② 기여 갱신 — `replace{partsFrom}` 은 새 part 만 · `partsFrom` 이 기존 part 를 덮으면 그 메시지 기여 재계산 · `remove` 철회 · `prepend` 추가 ③ revision — 도메인 키의 값이 달라질 때만(같은 값 = 불변) ④ 부모별 revision — `childMessage`·`subagentTasks` 의 부모 toolRunId 마다 ⑤ 뷰 — 불변(지난 뷰 값·참조 유지) · revision 같으면 같은 객체 ⑥ 같은 키 기여 순서 = 메시지 순번(EP-6 ①) | `rg -n "transcriptIndexFor\|domainRevision\|parentRevision" src/renderer/src/features/chat/lib/transcriptIndex.ts` → ①~⑥ | ③ 이 없으면 같은 메시지의 text 추가가 작업 보드를 다시 그린다(x10). ④ 가 없으면 부모 A 상세가 B 이벤트에 렌더된다(x11) |
| **EP-14** · AR-10 / VP-33 | 소비자 전환 | `store/chatStore.ts` 훅 · 소비자 10파일 | 창 | 자리 3 — ① `useTranscriptView(domain, arg?)` ② 소비자 10파일(`useTaskBoard` · `useTaskContext` · OpenCode `tiles.tsx`·`AgentViews.tsx` · Claude `CanonicalBackgroundContent` · `LegacySubAgentTile` · `AgentTaskRow` · `SubagentNoticeRow` · `InlineSubagentDetail` · `ProjectLandingPage` 제외 — `length` 만) ③ 현행 9함수 production 삭제 → `transcriptIndex.legacy.testfixture.ts` 사본 · `taskBoard.ts` 모듈 1칸 캐시 삭제 | 음성 S5 명령 + `--glob '!*.testfixture.*'` → 0 · 양성 `rg -n "useTranscriptView\(" src/renderer/src --glob '!*.test.*'` → ② 파일마다 ≥ 1 | 한 소비자가 남으면 그 화면은 M1 비용 그대로다 |
| **EP-15** · MD-13 / VP-28 | 펼침·포커스 store(D-038) | `store/disclosureStore.ts` | 블록 컴포넌트 | 자리 6 — ① `useDisclosure(blockKey, initial)` · `setDisclosure` — 세션 키별 ② Claude 도구 블록 `open` ③ `AgentTaskRow` `expanded` ④ Work 활동 묶음 펼침 ⑤ 포커스 — 포커스된 블록 key 를 기억하고 재마운트 때 그 요소에 돌려준다 ⑥ 정리 — `dropSession` 이 그 세션 칸을 지움 · `reset` 뒤 지금 스냅샷에 없는 key 를 버림 | `rg -n "useDisclosure\|setDisclosure\|clearDisclosures\|pruneDisclosures\|focusedBlockKey" src/renderer/src/features/chat --glob '!*.test.*'` → ①~⑥ | ②~④ 가 `useState` 면 가상화·다시 열기에서 펼침이 사라진다 |
| **EP-16** · AR-08 / VP-28 | 접은 본문 해제 종료 조건(D-039) | Claude `ToolCard.tsx` | Claude 도구 블록 | 자리 4 — ① `onTransitionEnd`(grid 행) ② `onTransitionCancel` ③ 시한 — 닫을 때 `setTimeout(전환 시간 + 100)` · 다시 열면 취소 ④ `prefers-reduced-motion: reduce` 면 즉시 · 종료 전 다시 열면 남김 | `rg -n "onTransitionEnd\|onTransitionCancel\|BODY_RELEASE_GRACE_MS\|prefers-reduced-motion\|wasOpened" src/renderer/src/features/chat/harnesses/claude/transcript/ToolCard.tsx` → `wasOpened` 0 · 나머지 ①~④ | ①만 있으면 이벤트가 안 오는 경로(숨은 탭·중단)에서 본문이 남는다(e3) |
| **EP-17** · AR-09 / VP-29 | 선택 보존(D-040) | `lib/transcript/viewport/range.ts` · 뷰포트 | 공통 뷰포트 | 자리 4 — ① 범위 — 선택 블록 수 ≤ 300 전체 · ≤ 2,000 양 끝·기본 범위·앵커 · > 2,000 전체 ② `onCopy` — 축소 상태면 `flushSync` 로 범위 마운트 → 기본 복사 → 다음 프레임 복귀(`try/finally`) ③ `onKeyDown` — Shift 와 방향·Home/End·PageUp/Down 으로 확장을 시작하면 그 선택 동안 전체 ④ 선택 → 블록 key 범위 캡처(세 화면 — OpenCode 현행 `retained` 를 뷰포트로) | `rg -n "SELECTION_MOUNT_MAX_BLOCKS\|SELECTION_COPY_SYNC_MAX_BLOCKS\|onCopy\|flushSync\|onKeyDown\|retainedSelection" src/renderer/src/features/chat/lib/transcript/viewport src/renderer/src/features/chat/components/transcript --glob '!*.test.*'` → ①~④ | ② 가 비동기면 복사에 중간 블록이 빠진다(c3). ③ 이 없으면 키보드 확장이 마운트된 블록 사이만 움직인다 |
| **EP-18** · MD-14 / VP-30 | 버블 측정(D-041) | `lib/bubbleMeasure.ts` · `UserBubbleText.tsx` | 공통 transcript | 자리 5 — ① 공유 RO ② 통지 → 대기 + rAF 1 ③ 읽기 단계 → 쓰기 단계 ④ 무효화 입력 — 본문 prop 참조 · RO `contentBoxSize` 폭 · 배율 설정값 · 글꼴 토큰 버전(넷이 같으면 읽기 0) ⑤ 줄 높이 — (배율, 글꼴 버전)마다 전역 1회 | `rg -n "new ResizeObserver\|getComputedStyle\|scrollHeight\|useBubbleOverflow\|lineHeightFor" src/renderer/src/features/chat/lib/bubbleMeasure.ts src/renderer/src/features/chat/harnesses/common/transcript/UserBubbleText.tsx` → `UserBubbleText.tsx` 의 `new ResizeObserver`·`getComputedStyle` 0 · 나머지 ①~⑤ | ③ 을 섞으면 버블마다 강제 레이아웃이다(m3). ④ 에서 폭이 빠지면 판정이 낡는다 |
| **EP-19** · MD-15 / VP-31 | 꼬리 스캐너 · 열린 펜스(D-042) | `lib/markdownBlocks.ts` · `StreamingMarkdown.tsx` | StreamingMarkdown | 자리 4 — ① 캐시에 스캐너 상태(마지막 완결 줄 끝 · 펜스 문자·길이·들여쓰기 · 빈 줄 런)를 둔다 ② 새 완결 줄만 스캔(`splitStableBlocks` 를 꼬리 전체로 다시 부르지 않음) ③ `openFenceTail(tail, state)` — CommonMark: 백틱 펜스 info 에 백틱 금지 · 닫힘 줄은 같은 문자 같은 길이 이상 + 공백만 · 들여쓰기 0~3 · `\r\n` ④ `StreamingFence` — 같은 `CodeBlock`·typography·스트리밍 문맥 | `rg -n "scanState\|openFenceTail\|StreamingFence" src/renderer/src --glob '!*.test.*'` → ①~④ | ② 가 없으면 열린 펜스·loose list 에서 delta 마다 꼬리 전체를 스캔한다(F31 · f8) |
| **EP-20** · MD-17 / VP-34 | delta 묶음 | `chatStore.ts` `receiveDeltaBatch` | 창 | 자리 4 — ① (세션 키, 종류) 연속 run ② run 마다 `join('')` 1회 ③ run 마다 항목 교체 1회 ④ `shouldBeginTurn` 은 run 첫 이벤트 | `rg -n "receiveDeltaBatch\|shouldBeginTurn\|join\(''\)" src/renderer/src/features/chat/store/chatStore.ts` → ①~④ | ① 이 종류를 안 보면 text·reasoning 이 섞인다(b3) |
| **EP-21** · MD-18 / VP-35 | J1~J9 · 세 갈래 | `scripts/measure-ui-inputs.mjs` | 사람·`node --test` | 자리 3 — ① 입력 J1~J9(§19 표) ② 결정성 ③ 입력마다 초회 구성·정상 증분·캐시 적중 세 갈래 요약(0325 규약) | `rg -n "J[1-9]\|coldBuild\|incremental\|cacheHit" scripts/measure-ui-inputs.mjs` → ①~③ | 세 갈래가 섞이면 첫 구성 비용이 증분 비용으로 보인다 |

**규칙 칸 분기 — UT 입력 칸과 1:1**

| 기호 | 규칙 | UT 입력(§7-A) |
|---|---|---|
| k1 | 8종 각각의 첫 이벤트 → 새 `a:` · 같은 턴 다음 8종 → 같은 번호 | VP-04 k1 |
| k2 | 8종이 아닌 이벤트(`message.delta`·`telemetry`·`session.updated`·`permission.requested`·`output.captured`)에는 붙이지 않는다 | VP-04 k2 |
| k3 | 두 턴은 따로 번호 | VP-04 k3 |
| k4 | 확인 대기 산출물 이벤트·줄 선 중계도 같은 번호 | VP-04 k4 |
| k5 | `commitUserMessage` 뒤 → 새 번호 | VP-04 k5 |
| k6 | `telemetry` 뒤 → 새 번호 | VP-04 k6 |
| k7 | `finalizeTurn` 뒤 → 새 상태·새 번호 | VP-04 k7 |
| k8 | 질문 답 — 창 이벤트와 묶음에 현재 번호(없으면 새로) | VP-04 k8 |
| k9 | 큐 배치 → `u:<ids[0]>`(id 2개) · 커밋 배치와 `message.committed` 같은 값 | VP-04 k9 |
| k10 | 받은 입력 → `i:<uuid>` · `i:n:<원본 id>` · `i:g:<새 uuid>` 세 입력 | VP-04 k10 |
| k11 | 요청 id 와 받은 uuid 가 같은 문자열 `x` → `u:x` ≠ `i:x` | VP-04 k11 |
| w1 | 번호 없는 이벤트 열 → 지금 행 구성 | VP-06 w1 |
| w2 | 번호가 처음이면 현재 행 마감 뒤 새 행 | VP-06 w2 |
| w3 | 늦은 A(B 뒤) → A 행에 붙음 · 행 수 불변 · A 행 content 갱신 · 현재 행은 B | VP-06 w3 |
| w4 | 8 case 각각 번호 저장 | VP-06 w4 |
| w5 | 같은 번호 사용자 재커밋 → 같은 id · 행·part·미리보기 갱신 0 | VP-06 w5 |
| w6 | 번호 행의 role 이 이벤트와 다름 → 저장 실패(throw) | VP-06 w6 |
| w7 | 질문 답 결과가 그 번호 행에 | VP-06 w7 |
| w8 | 마이그레이션 — 옛 행 null · 같은 세션 같은 번호 거부 · 다른 세션 허용 · null 여러 개 허용 · 0035 DB 에서 열림 | VP-06 w8 |
| i1 | 번호 있는 로컬 행 → 그 번호 | VP-05 i1 |
| i2 | 번호 없는 로컬 행 → `m:<id>` | VP-05 i2 |
| i3 | 묶인 행 없는 원본 → `n:<원본 id>` | VP-05 i3 |
| i4 | 행 하나가 원본 셋에 묶임 → 가장 뒤 원본이 행 번호 · 앞 둘 `n:` | VP-05 i4 |
| i5 | 고아 → `값#o` | VP-05 i5 |
| i6 | 보관본 — 번호 있으면 그것, 없으면 `x:<순번>` | VP-05 i6 |
| i7 | 한 원본이 두 행의 가장 뒤 원본 → DB id 가 작은 행 번호 | VP-05 i7 |
| i8 | 원본 목록 앞에 원본을 더해도(앞삽입) 기존 메시지 번호 같음 · 모든 결과 유일 | VP-05 i8 |
| r1 | 같은 번호 연속 → 같은 메시지 | VP-07 r1 |
| r2 | 마지막이 assistant 인데 새 번호 → 끝에 새 메시지 | VP-07 r2 |
| r3 | 늦은 A(B 메시지 뒤) → A 메시지에 붙음 · 메시지 수 불변 | VP-07 r3 |
| r4 | 마지막이 user → 번호로 새 메시지 | VP-07 r4 |
| r5 | 번호 없는 `COMMIT_PENDING_TEXT` — 마지막 assistant / 마지막 user 면 `r:` | VP-07 r5 |
| r6 | 낙관 `u:<clientId>` → echo 무변경 | VP-07 r6 |
| r7 | 같은 번호 재커밋 echo → 무변경 | VP-07 r7 |
| r8 | `LOAD_SESSION` id 보존 · fork `r:` · 자식 `c:` | VP-07 r8 |
| r9 | 붙임은 그 메시지만 교체(앞 객체 같은 참조) | VP-07 r9 |
| l1 | 쓰기 1 → 항목 1 · revision +1 | VP-10 l1 |
| l2 | 소비자가 3 revision 뒤 → 항목 3 | VP-10 l2 |
| l3 | 1,000번 추가 → 고리 64 · 65번째 이전 revision 의 `changesSince` = `reset` | VP-10 l3 |
| l4 | 다른 lineage 의 revision → `reset` | VP-10 l4 |
| l5 | fork 초안 → 새 lineage · revision 0 | VP-10 l5 |
| l6 | 소비자 셋이 서로 다른 revision 에서 따라옴 | VP-10 l6 |
| l7 | 기록 항목에 배열·메시지 객체 없음(항목 값 = 문자열·숫자만 — 구조 단언) · 세션 엔트리 삭제 뒤 lineage 의 `WeakMap` 칸이 사라짐(`FinalizationRegistry` 없이 — 색인 접근자가 lineage 토큰만 키로 쓰는지 코드 구조 단언과 함께) | VP-10 l7 |
| l8 | 쓰기 자리 ⓐ~ⓗ 각각의 종류·ids·`partsFrom` | VP-10 sweep |
| q1 | 끝 추가 → 순번 +1 · 위치 = 순번 − 첫 순번 | VP-11 q1 |
| q2 | `replace{partsFrom}` → 새 part 만 읽어 소유 갱신 | VP-11 q2 |
| q3 | index 1 산출물 교체(10,000) → 관계없는 메시지 읽기 0 | VP-11 q3 |
| q4 | 앞삽입 k → 순번 −1…−k · 기존 순번 재기록 0 | VP-11 q4 |
| q5 | 중간 삭제 → 다음 위치 조회에서 한 번 다시 셈 · 이후 조회는 셈 0 | VP-11 q5 |
| q6 | `reset` → 전체 다시 | VP-11 q6 |
| y1 | 끝 추가에서 기존 key 불변 | VP-14 y1 |
| y2 | 같은 메시지 집합이면 그룹 문맥과 무관하게 같은 key 집합 | VP-14 y2 |
| y3 | 같은 메시지에 reasoning 이 text 앞에 처음 생겨도 text key 불변 | VP-14 y3 |
| y4 | 연속 user 턴 앞에 이전 user 앞삽입 → 기존 key 불변 | VP-14 y4 |
| y5 | 선두 assistant 앞에 질문 복원 → 기존 key 불변 | VP-14 y5 |
| y6 | 턴에 assistant 메시지 추가 → 메타 key 불변(첫 assistant 번호) | VP-14 y6 |
| y7 | 다시 열기(같은 번호 새 객체) → key 불변 | VP-14 y7 |
| y8 | 한 스냅샷 key 유일 · 중복 입력이면 throw | VP-14 y8 |
| z1 | `append` 1 메시지 → 새 블록 = 그 메시지 블록 + 메타 ≤ 1 · 방문 = 그 메시지 + 직전 1 | VP-16 z1 |
| z2 | `replace{partsFrom}` → 그 메시지의 `partsFrom` 이후 블록만 · 방문 = 그 part | VP-16 z2 |
| z3 | `remove` → 그 블록 제거 · 경계 블록 갱신 | VP-16 z3 |
| z4 | 늦은 결과 → 원래 호출 블록만 새 객체 | VP-16 z4 |
| z5 | 경계가 바뀌는 `append`(새 user) → 앞 턴 메타·간격 블록만 새 객체 | VP-16 z5 |
| z6 | `prepend` 1 턴 — 읽은 1턴·100턴에서 새 블록 + 경계 ≤ 2 · 방문 같음 | VP-16 z6 |
| z7 | live 유무 전이(OpenCode p1~p3 · Claude live 블록 출현·완료) → 구조 1회 · key 는 D-034 | VP-16 z7 |
| u1 | 삽입 뒤 지난 스냅샷 `count`·`keyAt`·`blockAt` 같음 | VP-15 u1 |
| u2 | 교체 뒤 지난 스냅샷 블록 참조 같음 | VP-15 u2 |
| u3 | 앞삽입 뒤 `indexOf` 가 새 위치 · 지난 스냅샷은 옛 위치 | VP-15 u3 |
| u4 | 청크 경계를 걸친 범위 교체 | VP-15 u4 |
| u5 | 갱신이 닿지 않은 청크는 지난 스냅샷과 같은 참조 | VP-15 u5 |
| s1 | 같은 parts → 같은 segment 배열 | VP-18 s1 |
| s2 | text 덧붙임 → 마지막 text segment 만 새 객체 | VP-18 s2 |
| s3 | 뒤 `tool_result` → 그 ToolCall·그 segment 만 새 객체 · 형제 호출·다른 segment 같은 참조 | VP-18 s3 |
| s4 | 앞 part 교체 → 전체 재분절 · 결과 ≡ | VP-18 s4 |
| s5 | 부모 있는 part 건너뜀 | VP-18 s5 |
| s6 | 다른 번호 메시지 → 캐시 칸 섞이지 않음 | VP-18 s6 |
| p1 | 하단 24px 안 → pin · 올리면 해제 | VP-23 p1 |
| p2 | pin + 생성 중 + 높이 증가 → 하단(Claude) · pin + 높이 증가 → 하단(OpenCode) | VP-23 p2 |
| p3 | 예약 간격 = max(0, 0.5·H − (전체 − 마지막 user 시작)) · 채우는 동안 전체 높이 같음 | VP-23 p3 |
| p4 | 간격 0 이 되면 추가 높이만큼 전체 증가 | VP-23 p4 |
| p5 | 전송(`sendCount` 변화) → 하단 smooth 1회 | VP-23 p5 |
| p6 | pin 해제 상태의 높이 증가 → 위치 유지 | VP-23 p6 |
| p7 | 진입 — Claude: 처음·복귀 하단 | VP-23 p7 |
| p8 | 진입 — OpenCode: 처음 하단 · 복귀 저장 앵커 · 하단 고정이면 하단 | VP-23 p8 |
| a1 | 앞삽입 → 앵커 블록 거리 유지(추정 높이) | VP-26 a1 |
| a2 | 추정 ≠ 측정 → 정정 뒤 ±1px | VP-26 a2 |
| a3 | 측정이 두 프레임에 나뉘어 와도 최종 ±1px | VP-26 a3 |
| a4 | pin 상태 앞삽입 → 하단 유지 | VP-26 a4 |
| a5 | 앵커 블록 key 가 사라짐 → 같은 메시지 번호의 첫 블록 | VP-26 a5 |
| a6 | 앵커 정정 중 live 출력(위에서 읽는 중) → 끌려가지 않음 | VP-26 a6 |
| d1~d5 | `dropSession` 다섯 흐름 각각 → 그 세션 칸 지움 | VP-28 d1~d5 |
| d6 | 세션 전환 → 남음 | VP-28 d6 |
| d7 | 다시 열기·원본 동기화(`reset`) → 남음 · 없는 key 버림 | VP-28 d7 |
| d8 | 가상화 언마운트·재마운트 → 펼침·포커스 복원 | VP-28 d8 |
| e1 | 닫음 → `transitionend` → 언마운트 | VP-28 e1 |
| e2 | 닫음 → `transitioncancel` → 언마운트 | VP-28 e2 |
| e3 | 닫음 → 이벤트 없음 → 시한 → 언마운트 | VP-28 e3 |
| e4 | 동작 줄이기 → 즉시 | VP-28 e4 |
| e5 | 종료 전 다시 엶 → 남음 · 시한 취소 | VP-28 e5 |
| e6 | 언마운트 뒤 복사 결과 같음 | VP-28 e6 |
| c1 | 선택 300 → 전체 마운트 | VP-29 c1 |
| c2 | 선택 301 → 양 끝·가시·앵커 | VP-29 c2 |
| c3 | 축소 상태 복사 → 핸들러 안 마운트 = 범위 전체 · 클립보드 = 전체 마운트 기준(정방향) | VP-29 c3 |
| c4 | 역방향 선택 · 양 끝 부분 선택 → 같음 | VP-29 c4 |
| c5 | 다음 프레임 복귀 · 핸들러가 던져도 복귀 | VP-29 c5 |
| c6 | Shift+↓ 확장 시작 → 전체 마운트 | VP-29 c6 |
| c7 | 선택 2,001 → 전체 마운트 | VP-29 c7 |
| m1 | 같은 프레임 3 버블 → 읽기 각 1 · rAF 1 | VP-30 m1 |
| m2 | 다른 프레임 → 프레임마다 | VP-30 m2 |
| m3 | 순서 로그 `R,R,R,W,W,W` | VP-30 m3 |
| m4 | 무효화 입력 같음 → 읽기 API 호출 0 | VP-30 m4 |
| m5 | 폭만 바뀜 · 배율만 바뀜 · 글꼴 버전만 바뀜 · 본문만 바뀜 → 각각 다시 읽음 | VP-30 m5 |
| m6 | 줄 높이 — (배율, 글꼴 버전) 같으면 `getComputedStyle` 1회 공유 | VP-30 m6 |
| f1 | 열린 백틱 펜스 + info → 값 | VP-31 f1 |
| f2 | `~~~~` 열림 + `~~~` 줄 → 닫힘 아님 → 값 | VP-31 f2 |
| f3 | 닫힘 줄 → `null` | VP-31 f3 |
| f4 | 백틱 info 안 백틱(```` ```a`b ````) → 펜스 아님 → `null` | VP-31 f4 |
| f5 | 닫힘 후보 뒤 문자(```` ```x ````) → 닫힘 아님 → 값 | VP-31 f5 |
| f6 | 들여쓰기 3 → 값 · 4 → `null` | VP-31 f6 |
| f7 | `\r\n` 줄끝 → `\n` 과 같은 판정 | VP-31 f7 |
| f8 | 100,000자를 50자 delta 2,000개로 → 누적 스캔 문자 = 100,000(±줄 1) | VP-31 f8 |
| f9 | 펜스 줄이 delta 사이에서 나뉨(`` `` `` + `` `ts\n ``) → 같은 판정 | VP-31 f9 |
| f10 | f1~f9 의 DOM = `Markdown` 경로 DOM | VP-31 f10 |
| x1~x9 | 도메인 9종 각각 무작위 열 단계마다 `toEqual` 현행 함수 | VP-32 x1~x9 |
| x10 | TaskCreate 결과 든 메시지 + text 추가 → 작업 보드 revision·뷰 참조 불변 · 도메인 × 이벤트 36칸 표 | VP-32 x10 |
| x11 | 부모 A·B — B 의 자식 이벤트에 A revision 불변 | VP-32 x11 |
| x12 | 갱신 뒤 지난 뷰 값·참조 같음 · 교차 세션 2개가 섞이지 않음 | VP-32 x12 |
| b1 | 같은 세션 text delta 3 → 결합 1 · 항목 교체 1 | VP-34 b1 |
| b2 | 같은 세션 text 2 · reasoning 2 · text 1 → run 3 | VP-34 b2 |
| b3 | 종류가 바뀌면 끊긴다 — text 뒤 reasoning 이 text 에 붙지 않는다 | VP-34 b3 |
| b4 | 세션 A·B 교차 → run 4 · 각 세션 결과 = 현행 | VP-34 b4 |
| b5 | 첫 delta 가 턴을 연다 → BEGIN_TURN 1회 | VP-34 b5 |
| b6 | 부모 있는 delta 섞임 → 건너뜀 · run 이 그 지점에서 끊기지 않는다 | VP-34 b6 |
| j1 | J1~J9 크기 = §19 표 | VP-35 j1 |
| j2 | 같은 인자 → 같은 산출 | VP-35 j2 |
| j3 | 입력마다 초회·증분·적중 세 행 | VP-35 j3 |
| j4 | 없는 함수 `N/A(함수 없음)` · 던짐 `N/A(실패: …)` | VP-35 j4 |

- 자리 목록은 검색 출력과 차집합 0 이어야 한다. verify 발견은 이행 결함·현재 결함·확장 후보로 갈리고, 열거 원문에 없는 확장 후보는 verify 1·2회째에만 판정을 막는다.
- **선언 경계**(측정 근거와 함께):
  - B1 — `reset`(첫 로드·다시 열기·원본 동기화)은 세 색인이 전부 다시 만든다. 페이지는 단계 E.
  - B2 — 갱신마다 블록 목록 청크 배열 하나를 복사한다 — 100,000 블록 5.2µs(§8 M6). reducer `messages` 배열 복사도 남는다 — 20,000 메시지 0.085ms(M1a).
  - B3 — (rev 1 의 "앞삽입 = 전체 재그룹" 은 D-044 로 없어졌다.)
  - B4 — 분절 캐시의 parts 접두 참조 비교는 O(part 수) — 10,000 part 0.21ms(M4). part 필드 읽기는 0.
  - B5 — `r:` 메시지(대기 텍스트 커밋·fork 경계선)와 연속 실행 도착 메시지는 재로드에서 DB 번호로 바뀌어 그 블록만 새 key 다.
  - B6 — 원본 동기화가 라이브 메시지를 원본 여럿으로 나누면 앞 원본의 블록은 새 key 다(D-030 · i4).
  - B7 — writer 만 만드는 `error` part 는 같은 번호 메시지에 붙는다. 재로드에서 그 메시지에 error 블록이 하나 는다(번호 불변).
  - B8 — 소비자가 64 revision 넘게 밀리면 그 소비자는 `reset` 으로 전체를 다시 만든다(l3).
  - B9 — loose list·긴 문단 꼬리는 매 delta 파싱한다 — loose list 20,000자 84.33ms · 긴 문단 20,000자 9.06ms(M3). 워커는 단계 C.
  - B10 — 도메인 revision 이 오른 이벤트에서 그 뷰는 도메인 항목 수에 비례해 다시 만든다(메시지 방문 0) — J5 가 잰다.
  - B11 — 블록 하나가 아주 큰 경우(한 text 블록 100,000자)는 그 블록 안을 나누지 않는다 — 한 DOM 블록이다.
  - B12 — T17·T18 은 바꾸지 않는다(`ApprovalCard.tsx:160-165` · `elapsed.ts:28-31`).
  - B13 — 선택 2,000 블록 초과·Shift 확장 중에는 범위 전체를 마운트한다(지금 OpenCode 동작).
  - B14 — Claude live 본문은 완료 때 확정 text 블록으로 key 가 바뀌어 그 안의 선택이 풀린다(지금 동작).
  - B15 — 한 원본이 두 로컬 행의 가장 뒤 원본이면 DB id 가 큰 행의 번호는 로드에 나타나지 않는다(i7).
- 열린 입력 집합을 판정하는 산출물: 해당 없음.
- 같은 규칙이 여러 레이어에 있다면: 번호는 `message-id.ts` 한 곳(main·renderer 공유) · 변경 종류·고리는 `changeLog.ts` · 블록 key 는 `blockKeys.ts` · 스크롤 쓰기는 `TranscriptViewport` · 펜스 판정은 `markdownBlocks.ts` 의 `FENCE_RE` 를 스캐너·`openFenceTail` 이 함께 쓴다.
- 선택적 필드의 의미: 이벤트 `messageKey?` 없음 = 번호 없는 이벤트(창 `r:` · writer 현행 경계). `LoadedMessage.id`·`Message.id` 는 필수.
- 외부 SDK 경계: 해당 없음. TanStack Virtual 은 이미 채택(`app/AGENTS.md` 의존성 정책 — `^3.14.6`)이라 새 의존성이 아니다.

## 11. 구현 설계

구현 순서는 코멘트 3 §2 를 따른다 — ① 번호·기록·블록 조회 계약(WU-1~WU-4) → ② 확정 이벤트와 live 분리(WU-4 ⑨⑩) → ③ 두 Timeline 을 공통 뷰포트에 연결(WU-5) → ④ 앞삽입·고정 입력 재생(WU-6) → ⑤ 상태·선택·측정·꼬리·패널·delta(WU-7~WU-13) → ⑥ 측정 스크립트(WU-14). 메모는 ① 뒤에 적용한다(D-035).

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `src/shared/message-id.ts`(신규) · `src/shared/ipc.ts` · `src/shared/peer-protocol.ts` | 번호 정본 · 형 | 접두 8 · 생성 함수 · `PART_EVENT_TYPES` · 이벤트·로드·피어 필드 | 순수 · `typecheck` |
| `src/shared/message-identity.testfixture.ts`(신규) | 종단 고정 입력 | 12 단계 열 · 결정적 `newId` · 기대 목록 2(라이브 · 재로드) | main·renderer ST |
| `main/app/agent-host/{persistence-sender,bootstrap}.ts` · `data-host/persistence-stream.testfixture.ts` · `features/chat/turn-coordinator.ts` | 발급 | EP-1 | 기존 가짜 `link`·`send` |
| `main/contracts/turn.ts` · `infra/db/migrations/0036_message_key.sql` · `infra/db/{queries,types}.ts` · `features/history/writer.ts` · `app/data-host/persistence-receiver.ts` | 저장 | EP-2 | DB 스위트 |
| `main/features/history/{native-projection,reader,native-recovery}.ts` | 로드 번호 | EP-3 | 순수(`native-projection.test.ts`) |
| `main/app/message-identity.integration.test.ts`(신규) | ST(main) | 실제 sender·receiver·writer·reader | io 풀 |
| `renderer/.../reducer/chatReducer.ts` · `store/chatStore.ts` | 번호 · 기록 · 조회 · `PREPEND_HISTORY` · delta | EP-4·EP-5·EP-6·EP-12 ⑤·EP-20 | reducer 순수 · 실제 store |
| `renderer/.../lib/transcript/{changeLog,messageOrder,blockList,blockKeys}.ts`(신규) | 계약 모듈 | EP-5·EP-6·EP-7·EP-8 ①② | 순수 |
| `renderer/.../harnesses/claude/transcript/claudeBlocks.ts`(신규) · `harnesses/opencode/transcript/openCodeBlocks.ts`(신규) · `lib/workActivity.ts` · `lib/blockOracle.testfixture.ts`(신규 — 전체 구성 oracle) | 블록 생성기 | EP-8 ③~⑩ · F28 key 교체 | property |
| `renderer/.../lib/segmentCache.ts`(신규) · `lib/parts.ts` | 분절 | EP-9 · `reconcileSegments`·`parts.reconcile.test.ts` 삭제 | property |
| `renderer/.../components/transcript/TranscriptViewport.tsx`(신규) · `lib/transcript/viewport/{range,anchor,pin,reserve,entry}.ts`(신규) | 공통 뷰포트 | EP-10·EP-11·EP-12 ①~④⑥·EP-17 | 순수 정책 · fake DOM + 가짜 측정 |
| `renderer/.../harnesses/claude/transcript/{Timeline,ScrollController,useScrollAnchor,AssistantTurn,Exchange,AssistantMessage,WorkActivity,ToolCard}.tsx|ts` · `hooks/useTranscriptVirtualizer.ts`(삭제) | Claude 블록 렌더 | `Exchange`·`AssistantTurn` 은 블록 렌더 함수로 분해 · head/tail 분리 삭제 · 꼬리 자리 | `Timeline.viewport.test.ts` |
| `renderer/.../harnesses/opencode/transcript/{Timeline,ScrollController,projection,scrollPolicy}.tsx|ts` | OpenCode 블록 렌더 | 행 투영 → 블록 생성기 · 보정기 → 뷰포트 정책 | 기존 OpenCode 테스트 이관 |
| `renderer/.../lib/transcriptIndex.ts`(신규) · `lib/transcriptIndex.legacy.testfixture.ts`(신규) · 소비자 10파일 · `lib/{taskBoard,canonicalBackground,taskContext}.ts` · `opencode/rightpanel/model.ts` · `lib/workToolResults.ts`(삭제 — 늦은 결과는 블록 모델, 결과 조회는 색인) | 패널 색인 | EP-13·EP-14 | property · 렌더 계수 |
| `renderer/.../store/disclosureStore.ts`(신규) · Claude `ToolCard.tsx` · `AgentTaskRow.tsx` · `WorkActivity.tsx` | 펼침·포커스·본문 해제 | EP-15·EP-16 | 가짜 타이머·`matchMedia` |
| `renderer/.../lib/bubbleMeasure.ts`(신규) · `UserBubbleText.tsx` | 측정 일괄 | EP-18 | 가짜 RO·rAF |
| `renderer/.../lib/markdownBlocks.ts` · `components/markdown/StreamingMarkdown.tsx` | 꼬리 | EP-19 | renderToString 대조 |
| `app/scripts/measure-ui-inputs.mjs` · `.test.mjs` | J1~J9 | EP-21 | `node --test` |
| `renderer/.../features/chat/dev/transcriptFixtures.ts`(신규) | 고정 입력 생성기 · 진단 빌드 개발 메뉴 | `loadFixture`·`appendFixtureTurn`·`prependFixtureTurn` — 기계 테스트와 S3·S4·S5 가 같은 생성기를 쓴다 · `VITE_OO_DIAGNOSTIC=1` 에서만 `window.__ooDev` 노출 | 순수(생성기) · 개발 메뉴 제외 gate |
| 문서 — `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md` · `docs/arch/backend/persistence.md` · `docs/arch/frontend/rendering.md` · `docs/arch/frontend/design-components.md` | 계약 서술 | 이벤트 `messageKey` · `LoadedMessage.id` · `messages.message_key` · 공통 뷰포트·블록 모델·앞삽입 앵커 · 카탈로그의 `TranscriptViewport` 행 | `check-doc-inventory --check` |

### 테스트 가능성

- 가상 범위는 `@tanstack/react-virtual` 을 그대로 쓰고 스크롤 요소의 `clientHeight`·`scrollTop` 과 `measureElement` 반환값을 주입해 정한다(가짜 측정 — fake DOM 하네스가 rAF·layout effect 를 흉내 낸다). 마운트 수 = `data-block-key` 요소 수.
- "방문" 은 메시지 `parts` getter·part Proxy 계수, "할당" 은 블록 객체 참조 비교 계수다(D-032).
- main 쪽 DB oracle(VP-02 main · VP-06)은 io 풀이다 — 제약 환경은 `npm rebuild better-sqlite3`(Node ABI), 불가하면 서명을 적고 CI 결과를 증거로 둔다(`app/AGENTS.md`).
- 공유 고정 입력은 `src/shared/` 에 두어 main·renderer 가 같은 리터럴을 읽는다.

## 12. End-to-end 영향

### producer → consumer

| 값 | producer | 정규화 / 상태 | consumer |
|---|---|---|---|
| 이벤트 `messageKey` | 송신기 `onTurnEvent`·`flushAskAnswers` | 같은 `ev` 객체 | writer · reducer |
| `message.committed.messageKey` | 조정자 2경로 | — | store → reducer |
| `messages.message_key` | writer | DB 열(부분 유일) | `loadParts` → reader |
| `LoadedMessage.id` | reader | 조각 전송(필드 하나) | `LOAD_SESSION` |
| `transcriptChanges` | reducer 8 자리 | `ChatState` · 고리 64 · lineage | 순번 색인 · 블록 모델 3 · 패널 색인 |
| 블록 스냅샷 | 블록 생성기 3 | 영속 목록 · 불변 | `TranscriptViewport` → 하네스 `renderBlock` |
| 도메인 뷰 | 패널 색인 | revision · 불변 | 소비자 10파일 |
| `PREPEND_HISTORY` | (0326) 고정 입력 테스트 · (E) 이전 턴 조회 | `prepend` 기록 | 블록 모델 · 뷰포트 앵커 |

### 부팅/등록/초기화 변경 시 기존 소비처

| 바뀐 것 | 기존 소비처 전수 | 영향 |
|---|---|---|
| `createPersistenceSender` 필수 `newId` | 정의 1 · `agent-host/bootstrap.ts:236` · `persistence-stream.testfixture.ts:58` | 둘 다 넘긴다 — 빠지면 `typecheck` |
| `TurnContext.currentAssistantMessageKey?` | 초기화 `persistence-receiver.ts:45` · `chat-turn/turn-context.ts:52` · 테스트 리터럴 21파일 | 선택 필드라 리터럴 그대로 |
| `LoadedMessage.id` 필수 | 생산 3함수(EP-3) · `NativeHistoryMessage extends LoadedMessage`(이미 `id` = 원본 id) | 어댑터 출력은 원본 id 그대로 · 투영이 앱 번호로 바꿔 낸다 |
| `Message.id` 필수 | 창 리터럴 5(F10) · 테스트 리터럴(구현자가 센다) | `typecheck:web` |
| `ChatState.transcriptChanges` | `initialChatState` · `NEW_CHAT` · fork 초안(`continuityDraftSession`) · 테스트 상태 리터럴 | 필수 필드 — 리터럴은 `typecheck` 가 잡고, fork·새 대화는 새 lineage 를 만든다(l5) |
| 트랜스크립트 레지스트리 | `harnesses/registries/transcript.tsx` Timeline 2 · ScrollController 2 | 레지스트리 형은 그대로 · 구현만 뷰포트로(EP-10 ④~⑦) |

## 13. Lifecycle / 오류 / 정리

| 상황 | 동작 |
|---|---|
| 데이터 호스트 저장 실패 | 현행 — 턴 오류. 창은 그 번호로 그렸고 재로드에 그 행이 없다(번호가 사라질 뿐 겹치지 않는다) |
| 같은 번호 재커밋(재전달) | 기존 행 id 반환 · 행 0 · 창 무변경(w5·r7) |
| 늦은 이벤트(A → B → A) | A 행·A 메시지에 붙음(w3·r3) |
| 번호 역할 불일치 | 저장 실패 — 접두 위반은 코드 결함이라 숨기지 않는다(w6) |
| 세션 엔트리 삭제·fork | lineage 토큰이 바뀌거나 사라져 세 색인 칸이 함께 사라진다 · 펼침 칸은 `dropSession` 이 지운다(l5·l7·d1~d5) |
| 소비자 밀림 > 64 | 그 소비자만 `reset`(B8) |
| 긴 선택 복사 | 동기 마운트 → 다음 프레임 복귀(`try/finally`) |
| 닫힘 전환 중 언마운트 | 본문 해제 예약이 컴포넌트와 함께 사라진다 · 재마운트는 store 의 닫힘 상태로 본문 없이 |
| 앞삽입 중 live 출력 | pin 이면 하단, 아니면 앵커 유지(a4·a6) |

## 14. 성능 / 상한 / 최적화

| 경로 | AS-IS(§8) | TO-BE 한 이벤트 비용 | 근거 |
|---|---|---|---|
| Claude 그룹·Work | grouper 0.498ms · Work 19.5ms @10,000 | O(변경 메시지 part) + 경계 블록 ≤ 2 + 청크 복사 | EP-8 · B2 |
| OpenCode head | 36.8ms @10,000 | 같다 | EP-8 |
| 패널·보드 9종 | 0.4~21ms @10,000 | O(변경 메시지 part) + 값이 바뀐 도메인만 O(항목) | EP-13 · B10 |
| reducer 조회 | 0.49ms @10,000 | O(변경 메시지 part) | EP-6 |
| 마운트 DOM | Claude 마지막 exchange 전부 · OpenCode 긴 선택 전부 | 가시 + overscan 6 + 선택(≤ 300 / 축소) + 앵커 | EP-10 · EP-17 |
| 열린 펜스 꼬리 | 5.35ms @20,000자 · delta 마다 꼬리 전체 스캔 | 파싱 0 · 스캔 = 새 줄 | EP-19 |
| 앞삽입 1 턴 | (없음) | O(새 턴 part) + 경계 ≤ 2 — 읽은 길이와 무관 | EP-8 ⑦ · AC21 |
| worst-case | — | `reset` 은 전체 1회(B1) · 64 초과 밀림은 그 소비자 전체 1회(B8) | — |

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 플러그인·외부 구현자 포트를 바꾸지 않는다. 어댑터는 번호를 만들지 않는다. 문서 계약은 §11 마지막 행이다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 관계 | 본문 근거 |
|---|---|---|
| 0325 D-030·D-033(증분 그룹화·파생 메시지 캐시) | 대체 — 블록 모델이 그룹 메타를 소유하고 grouper 는 oracle(`groupExchanges`)로 남는다. 불변식(결과 ≡ 전체 · 무관 참조 유지)은 VP-16 property 가 잇는다 | VP-37 |
| 0325 D-015·D-034·D-035(OpenCode live 리프·유무 전이·조각 유무) | 유지 · p2 의 key 변화는 D-034(종류별 순번)로 없어진다 | VP-36 · y3 |
| 0325 D-018("Work 선택기·`reconcileSegments`·OpenCode head 증분 … 0325 에서 바꾸지 않는다") | 완료 — 단계 B 에서 바꾼다 | EP-8·EP-9·EP-13 |
| 0325 D-019(T17·T18 측정 우선) | 유지 | D-024 |
| 0325 D-023(이전 페이지 UX OPEN) | 연결 — 코멘트 2 시나리오를 §6-E 로 넘긴다 | D-048 |
| 0102 "가상 head + 비가상 tail" | 대체 — 전체 블록 가상화 + 꼬리 자리 | D-037 |
| 0008 예약 공간 앵커(`rendering.md §1.8`) | 유지 — 계산된 꼬리 간격으로(전체 높이 불변 · 하단 smooth 1회) | AC17 · EP-11 ②③ |
| 0324 D-011·D-045 | 유지 | VP-38 |
| `execution-model.md` "턴 이벤트에 순번은 없다" | 유지 — 번호는 메시지 단위다 | EP-1 |
| `main/AGENTS.md` 버스 구독 순서 | 유지 — 도장은 첫 구독자 안 | EP-1 ③④ |
| `app/AGENTS.md` 마이그레이션 append-only · 의존성 정책 | 새 파일 `0036` · TanStack 은 채택 목록 안 | EP-2 ① · §10 |
| `native-projection.ts:30` "identity 를 텍스트·시각으로 추론하지 않는다" | 유지 — 바인딩·행 번호·원본 순서로만 | EP-3 ③ |
| renderer `AGENTS.md` 디자인 계약 | `TranscriptViewport` 는 새 공통 컴포넌트 — 카탈로그 행 추가 · 시각 변화 없음(같은 블록 UI) | §11 문서 |

## 17. 리스크 / 트레이드오프

| 리스크 | 영향 | 대응 |
|---|---|---|
| 세 화면 렌더 구조 교체 | 스크롤·선택·앵커 회귀 | 단일 쓰기 주체(D-045) · 기존 OpenCode 테스트 이관(VP-36) · Claude 0008 계약을 새 테스트로 고정(AC17 — F30) · 실창 S1~S7 |
| writer 경계 변경 | 재로드 묶음 차이 | 번호 없는 열은 현행(w1) · 종단 동치(VP-02) · 기존 저장 테스트(VP-38) |
| 기록 누락·종류 오류 | 화면이 낡음 | 쓰기 자리 sweep(VP-10) · 모든 소비자 property(≡ 전체) |
| 앞삽입 측정 정정 | 한두 프레임 흔들림 | 1차 추정 + 측정 정정(a1~a3) · 실창 S6 |
| 복사 순간 대량 마운트 | 복사 지연 | 300 < n ≤ 2,000 에서만 · 최대 마운트·시간을 J9·S5 에 기록 |
| AC 34(상한 초과) | verify 범위가 넓다 | D-002 · pair 가 WU 단위로 독립 |

## 18. 영향 받는 파일 / 문서

§11 표가 정본이다. D-050 에 따라 구현 착수 전 0325 기계 PASS 커밋과 이 표의 파일을 diff 로 대조하고, F 행(§8)의 줄 번호가 바뀌었으면 [구현자 기입] 설계 리뷰에 적는다.

## 19. 게이트

| 단계 | 명령 (`app/`) | 비고 |
|---|---|---|
| 루프 | `npm run lint && npm run typecheck` · 관련 스위트 `./node_modules/.bin/vitest run <파일>` | ABI 중립 |
| 마지막(IMPL_DONE 전) | `app/AGENTS.md` "로컬 확인" 전부 + 파일 필터 없는 vitest + `node --test scripts/*.test.mjs` + `npx electron-vite build && node scripts/smoke-hosts.mjs && node scripts/smoke-preload.mjs out/preload` | DB 스위트는 §11 |
| 문서 | `node scripts/check-doc-inventory.mjs --check` | §11 문서 |

### 사람 실기 — AC33 (Windows · 기계 verify PASS 뒤)

0325 §19 규약을 그대로 쓴다 — 장비(같은 장비·주사율·배율·전원 · 창 최대화) · 빌드 2종 × 커밋 2개(설치본 `build:win` · 진단 빌드 = 같은 커밋 production 모드·React profiling 번들·비압축·DevTools 허용·배포 안 함) · 반복(직전 → 0326 교차 3회씩, 실행마다 복원부터) · 페인트 기준(Event Timing `duration`) · 지표 정의(누락·연속 누락 = Frames 트랙 · commit = Profiler · layout = trace `Layout` · `perf.stall`) · 표본(한글 200자 · 휠 10초). 차이는 둘이다 — 칸은 값 · `N/A(이전 빌드: 사유)` · `미완료(새 빌드: 사유)`(D-049), 그리고 재현 입력.

**재현 입력(고정)** — 실제 세션은 0325 §19 처럼 복원한 사용자 세션 중 가장 긴 것(메시지·블록 수 기록). 앱 경로로 만들기 어려운 입력은 진단 빌드에만 있는 개발 메뉴 `window.__ooDev`(`features/chat/dev/transcriptFixtures.ts` — 빌드 상수 `VITE_OO_DIAGNOSTIC=1` 일 때만 묶임, DB 에 쓰지 않고 store 에만 넣는다)로 만든다: `loadFixture('long-claude' | 'long-work' | 'long-opencode')`(100 턴 × 도구 10) · `loadFixture('answer-5000')`(5,000 블록 답변 1) · `appendFixtureTurn()`(새 질문 + 짧은 답 — 전송 전환 재현) · `prependFixtureTurn()`(`PREPEND_HISTORY` 1 턴). 같은 생성기가 기계 테스트의 고정 입력이다(같은 입력 — 코멘트 3 "기계 PASS 이후 Windows 실창에서는 같은 fixture에서").

| ID | 시나리오 | 하네스 | 재현 입력 | 조작 | 기록 |
|---|---|---|---|---|---|
| S1 | 긴 세션 스트리밍 중 타이핑·휠 | Claude Code · Claude Work · OpenCode 각 1 | 가장 긴 실제 세션 + 프롬프트 P1(0325) | 전송 → 스트리밍 중 한글 200자 → 휠 10초 | 입력→paint p95·최대 · 누락·연속 누락 · commit · layout · `perf.stall` |
| S2 | 다시 열기 | 세 화면 | 같은 세션 | 마지막 답변 카드 2개 펼침 → 다른 세션 → 복귀 · 원본 동기화 한 번 더 | 펼침·선택·위치 유지(전·후) |
| S3 | 5,000 블록 답변 뒤 새 질문 | Claude Code · Claude Work | `answer-5000` → `appendFixtureTurn()` | 전환 → 위로 끝까지 → 아래로 | 전환 프레임 commit·layout · 마운트 DOM 최대 · 누락 · fork 위치 |
| S4 | 이전 턴 앞삽입 | 세 화면 | `long-*` 를 마지막 1턴·100턴만 남긴 상태 → `prependFixtureTurn()` 3회 | 읽던 문장 높이 · 삽입 프레임 | 앵커 오차(px) · 삽입 프레임 commit·layout · 누락 |
| S5 | 긴 선택 복사 | Claude Code · OpenCode | `long-*` | 400·1,500·2,500 블록 선택 → 복사 → 메모장 비교 · Shift+↓ 10회 | 복사 동일 · 복사 시간·최대 DOM · 키보드 범위 |
| S6 | 사용자 버블 | 세 화면 | 가장 긴 실제 세션 | 글자 배율 3단계 · 패널 폭 드래그 · 긴 발화 접기/펼치기 · 위로 읽는 중 새 답변 | layout 합 · 하단 끌림 없음 |
| S7 | 긴 코드 스트리밍 | Claude Code | 100,000자 코드 응답 프롬프트 | 전송 → 완료까지 | 프레임 시간 · 완료 전후 모양 |
| S8 | T17(측정만) | Claude Work | 긴 계획(20,000자) 승인 대기 | 카드 표시 | 표시 commit 시간 → W 인계 좌표 `0326 §19 S8` |
| S9 | T18(측정만) | Claude Code | 하위 작업 10·50 동시 | 실행 중 30초 | paint·스크립트 시간·타이머 수 → W 인계 좌표 `0326 §19 S9` |

| J | 함수 재측정(`measure-ui-inputs.mjs` — 입력마다 초회 · 증분 · 적중) | 옛 트리 / 새 트리 |
|---|---|---|
| J1 | 10,000 exchange 끝 part 1 — Claude 블록(옛: grouper + Work 선택기) | 같은 입력 |
| J2 | 같은 입력 — OpenCode 블록(옛: head 투영) | 같다 |
| J3 | index 1 산출물 교체 — reducer 조회·블록 | 옛: 현행 |
| J4 | 같은 입력 — 패널 9종(옛: 현행 함수 · 새: 색인) | 같다 |
| J5 | 작업 보드 항목 100·1,000 — TaskUpdate 결과 1 | B10 |
| J6 | 한 메시지 10,000 part 에 part 1 — 분절 | 옛: `messageSegments`+`reconcileSegments` |
| J7 | 꼬리 — 100,000자를 50자 delta 2,000개(열린 펜스 · loose list · 긴 문단) 누적 스캔·렌더 | 새: 스캐너 상태 |
| J8 | 앞삽입 1 턴 — 읽은 1·100 턴 | 옛: N/A(함수 없음) |
| J9 | 선택 복사 동기 마운트 400·1,500 블록(가짜 DOM) — 블록 렌더 시간 | 같다 |

- 실기 결과는 0326 verify 에 붙이고, T17·T18 수치는 W(0325 D-025) 로 넘긴다.
- 개발 메뉴는 설치본에 없어야 한다 — §7-A gate "개발 메뉴 제외" 행.

## READY self-review

- [x] Decision Ledger — rev 1 결정 27 중 17 대체(새 ID 와 대체 근거 §8 V 행), 유지 10 · 사용자 결정(D-001·D-002·D-004)과 코멘트 결정(D-028~D-051) ACTIVE.
- [x] Part I 만으로 완료 상태가 읽힌다 — §1 · §5 상태 표 · §6-E.
- [x] 조건절 보존 — 코멘트 원문을 결정 이유 칸에 인용했다(예: D-029 "허용 순서와 동일 이벤트 재생/실제 충돌의 처리를 정하고").
- [x] Product/UX → AC → Technical Design — §6 WU 표의 AC 열 · §11 순서.
- [x] AS-IS·TO-BE 같은 축 — §9.
- [x] 사라진 책임 — `reconcileSegments`·`workToolResults`·`useTranscriptVirtualizer`·`createExchangeGrouper`(production)·현행 9함수(테스트 사본)·작업 보드 1칸 캐시·head/tail 분리·OpenCode 보정기의 직접 쓰기 — 각 EP 의 음성 검색.
- [x] 수치·전칭 실측 — §8 M1~M6 · 테스트 이름은 실제 `it`·`it.each` 제목으로 다시 확인했다(rev 1 의 계획상 이름 3건을 실제 이름으로 고침).
- [x] AC 마다 행동 단언·검증 수단·경로 — §7 34행.
- [x] Baseline V · NEW node 마다 같은 레벨 REQUIRED pair(R 12·SD 3·AR 10·MD 18) · 영향받은 INHERITED 는 REGRESSION(VP-36~VP-38, 주체가 바뀐 테스트는 VP-37 이관표).
- [x] pair 마다 경로·§10 분모·좌표 · 선택 적대 증거는 0/전수·참조·순서 단언 pair 에 등록.
- [x] 규칙 칸 분기 ↔ UT 입력 — §10 규칙 표 기호와 VP 입력이 같다.
- [x] 선언 경계 — B1~B15(B3 은 rev 2 에서 없어짐을 남김) · 수치 경계는 §8 측정 인용.
- [x] INDEX 후보 표 겹침 — `childMessageForParentToolRunId`(0316 승격 완료) · `sessionBusy`(0319 승격 완료).
- [x] 운영 gate — §7-A gate 4행.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC33 은 레이아웃·paint·프레임만, 실측은 기계 PASS 뒤.
- [x] structural proxy 단독 없음 — "방문 0" 은 "결과 ≡ 전체" 와 짝(AC10·AC13·AC29).
- [x] 부팅/등록 변경 소비처 — §12 표.
- [x] one-way door — 마이그레이션·공개 필드(D-008) · 블록 key 규칙(D-034 — E 와 공유).
- [x] 게이트 = `app/AGENTS.md` 현행.
- [x] `ACTIVE 결정 ↔ AC` 대조 — §3 갱신 메모.
- [x] 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

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
> 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개는 oracle 종류와 무관하게 돌린다(impl §3 sweep). 그 밖의 직접 oracle에는 mutation을 더 발명하지 않는다.
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §9).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 다시 돌린 출력과 목록의 차집합을 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표, 자리 규칙이 적은 분기 중 입력이 없는 분기가 있는 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §9).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾼 변이의 red로 인자 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 분류(impl §7): 목록 미고정 → PLAN_GAP · 현재 결함 → 선조치 또는 PLAN_GAP · 확장 후보 → 확장 창이 열려 있으면 PLAN_GAP 가능, 닫혔으면 보고 · 비귀속 → 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 분류가 이행·현재 결함이거나 설계자가 채택한 확장 행은 이번 턴에 닫는다. 후보 표로 간 행과 `경계` 행은 제외

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> **열거 sweep**: 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개(제거 — 계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함)를
> 심어 red인지 본다(impl §3, 하네스 `.agents/skills/handoff-verify/scripts/mutate.py`). 그 위에 pair가 선택한 적대 증거·
> 파생 이슈의 인용 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도를 심는다. 규칙 칸 분기와 여러 항을 적은
> §10 자리 문장의 항은 그것을 구현한 diff 자리(조건·조기 반환·후보를 합치는 항)마다 제거 변이를 심어 찾는다. 그 밖의 hunk에는 mutation을
> 새로 발명하지 않는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `sweep — §10 자리 / path edge / 규칙 칸 분기(diff 자리)` / `재앵커 — 원 ID` / `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 테스트 추가** / 동치 — 근거·확인 실행 |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K · sweep S = 표 행 T` — sweep S는 열거 항목 수와 같아야 한다. 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §9).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 분모는 직전 verify 고장 이력의 `잡음` 행 중 하한 ④와 같은 범위이고, 원문이 옮겨 갔으면 재앵커한 행이다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

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
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §7).

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
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | `ci.yml` 단계 전부의 로컬 대응(파일 필터 없는 테스트) — 테스트 N파일 / M케이스 · error·warning 수 · 돌리지 못한 단계와 이유 · 기준선 분리 근거(변경 전 실패 집합과 차집합 ∅ + 환경 원인, `docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only`로 뽑은 테스트 파일 N · 규칙별 위반 0(app: 시간 예산·호스트 격리·풀 분류) · 그 파일들의 규칙 가드 실패 0 — 테스트를 건드리지 않았으면 `해당 없음` |
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
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
