# Plan — 0324-execution-contexts-ui-responsiveness

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0324-execution-contexts-ui-responsiveness` |
| 작성자 | Claude Code |
| 일자 | 2026-11-16 |
| 매핑 | 없음 |
| 상태 | DRAFT |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` rev 4 **DRAFT** — §7-F: 실행과 상태의 분리(B, D-034~D-037). OPEN 4건(O-1~O-4) 사용자 결정 대기, AC·V·§10 미확정. rev 3.3 은 §7-E 에서 창 쪽 호스트 포트 클라이언트의 규칙을 정했다(AC·pair 변경 0, r1.6 `PLAN_GAP`). rev 3.2 는 §7-C 의 열린 항목 둘(수명 이벤트 원천 · 포트 연결의 신뢰 판정)을 §7-D 에서 닫았다(AC·pair 변경 0, EP-9 자리 4 → 5). rev 3.1 은 r1.4 가 올린 전송 계층 자리 5건을 §7-C 에서 정정했다(AC·pair 변경 0). rev 3 은 턴 13 에 D-033 을 확정했다(규범 행 변경 0) — r1 구현 중 `PLAN_GAP` 3건을 §7-B 에서 정정했다(턴 11 사용자 결정). rev 2 는 구현 전 사용자 요구 변경(턴 6~9)으로 다시 썼다. rev 1 은 커밋 `docs(handoff): 0324 실행 주체 역할·워커·UI 반응성 plan` |
| 유효 V | `V1` |
| 입력 자료 | 사용자 첨부 "VS Code의 main·renderer·워커와 화면 갱신 경로" 개정 2 · [`vscode-comparison-and-proposal.md`](../../etc/study/main-renderer-roles/vscode-comparison-and-proposal.md) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 입력 크기에 비례하는 계산과 읽기가 UI를 맡는 두 스레드(renderer 메인 스레드, main 프로세스)에서 한 번에 돈다 — 구문 강조 1,000줄이 renderer를 약 1초, part 1만 개 세션 로드가 main을 약 150ms 막는다(§8 실측).
- 완료 후 달라지는 것: main 은 창·OS·수명 감독만 하는 셸이 되고, 턴·세션·DB 쓰기는 에이전트 호스트 프로세스가, 세션 본문 읽기는 데이터 호스트 프로세스가, 구문 강조·diff 계산은 renderer 계산 워커가 맡는다. 남은 멈춤은 `perf.stall` 기록으로 드러난다.
- 성공을 사용자 관점에서 한 문장으로: 큰 코드·큰 diff·큰 세션을 여는 동안에도 스크롤·입력·창 조작이 끊기지 않고, 늦는 결과는 로딩 표시나 강조 없는 원문으로 먼저 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "패널확장보다 renderer 업데이트 방법(인프라)을 우선 고쳐야겠다는 결론이다." | 라이브 세션 2026-11-16 턴 1 |
| 명시 요구 | "첨부 vscode의 사례를 검토하고 main과 renderer의 역할을 재정의하라." | 턴 1 |
| 명시 요구 | "추가적인 워커 (스레드/프로세스)를 어떻게 운영할지 검토하고 제안하라. Orcinus orca의 수준에 맞춰 검토할 것." | 턴 1 |
| 명시 요구 | "구조적으로 앱 버벅임이 없애야 함. (로딩표시 제외). 앱 조작 시 버벅임 없어야 함" | 턴 1 |
| 명시 요구 | 반응성 수치: "리눅스 top half 혹은 vscode 기준등 범용적인 기준을 확인하고 제안하라" | 턴 2 답 1 |
| 명시 요구 | 범위: "한 handoff에 전부" — 선택지 문구는 "역할 규칙·계측·renderer 워커·main 데이터 프로세스·세션 로드 조각 전달까지 0324 하나에 담는다" | 턴 2 답 2 |
| 명시 요구 | main 쪽 워커: "별도 프로세스 + 직접 포트" — `utilityProcess` 가 읽기 전용 DB 연결을 갖고 결과는 `MessagePort` 로 renderer 에 바로 간다 | 턴 2 답 3 |
| 명시 요구 | "원자적으로 풀어낼 수 없다면 … handlechatsend를 dosendchathandle(비동기/스레드)에 넘기고 실패처리나 메시지를 기다리는 형태로 가야하는 것 아닌지?" | 턴 6 |
| 명시 요구 | "Main은 수명 관리라 훅을 포함할 거고, 훅에서 db쓰기같은게 발생하면 또 유틸리치프로세스에 이야와면 되는것 아닌지?" | 턴 7-1 |
| 명시 요구 | "시큐리티의 경우는 업데이트를 해도 좋다. 단 이 방안이 일반적으로 허용된다면. 아니면 스레드로 전개하면 문제 해결아닌가?" | 턴 7-2 |
| 명시 요구 | "현재의 계약에서만 생각하지 말 것. 완성된 형태를 기준하라. 그리고 완성된 형태가 일반적으로 논의되는 구조인지릉 검토할 것" | 턴 7-3 |
| 명시 요구 | "하네스 프로세스는 hook으로 상태를 알릴 수 있지 않은지?" | 턴 7-4 |
| 명시 요구 | "(에이전트=adapter)프로세스가 죽으면 시그널에 의 해 main 이 받고 세션 종료(에러알림/예외처리)하고 상태를 변경하면 된다" | 턴 8-1 |
| 명시 요구 | "git/shell 등은 도구 프로세스가 소유하면 안되나? 무엇이 문제인지?" | 턴 9-1 |
| 명시 요구 | "고아 하네스가 에이전트 호스트 자식이라면 고아하네스 종료 후 세션 중단으로 예외처리할 것." | 턴 9-2 |
| 명시 요구 | "설계관점에서 범용적인 대응을 따른다." · "하나의 핸드오프로" | 턴 9-3·9-4 |
| 명시 요구 | "각 프로세스 호출, 렌더러 업데이트 요구 등의 경로를 문서화하고 (AGENTS.md 등) 이를 준수할 것을 강력하게 제한할 것. 타 에이전트가 구현하다가 해당 역할을 담당하는 프로세스/경로에 요청하지 않고 헤당 코드블럭에서 직접 호출하는 일이 앖도록" | 턴 10 |
| 추론 의도 | 턴 9-1 의 "도구 프로세스가 소유"는 "git·셸을 누가 띄우고 감시하는가"의 답으로 읽는다 — 프로세스는 자신을 띄울 수 없으므로 띄우는 쪽을 정해야 한다 → D-023 | 턴 8 답의 "소유자 미정" ↔ 턴 9-1 |
| 추론 의도 | "(로딩표시 제외)"는 "결과가 늦어 로딩 표시가 뜨는 것은 버벅임으로 세지 않는다"로 읽는다. 로딩 표시가 떠 있는 동안에도 조작은 반응해야 한다 | 턴 1 문장의 괄호 위치 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이 작업이 0323(패널 확장)보다 먼저다 | "패널확장보다 renderer 업데이트 방법(인프라)을 우선" | 턴 1 | ACTIVE | 0323 D-015 와 같은 결정 |
| D-002 | 앱 조작 시 버벅임이 구조적으로 없어야 한다. 로딩 표시는 버벅임이 아니다 | "구조적으로 앱 버벅임이 없애야 함. (로딩표시 제외)" | 턴 1 | ACTIVE | — |
| D-003 | main·renderer 역할을 VS Code 사례 기준으로 재정의한다 | "첨부 vscode의 사례를 검토하고 … 재정의하라" | 턴 1 | ACTIVE | — |
| D-004 | 추가 워커(스레드/프로세스)의 운영 방식을 정한다. 규모는 Orcinus orca 수준에 맞춘다 | "Orcinus orca의 수준에 맞춰 검토할 것" | 턴 1 | ACTIVE | — |
| D-005 | 역할 규칙·계측·renderer 워커·main 데이터 프로세스·세션 로드 조각 전달을 이 handoff 하나에 담는다 | "한 handoff에 전부" | 턴 2 | SUPERSEDED | D-022 |
| D-006 | 대량 읽기는 `utilityProcess`(데이터 호스트)가 읽기 전용 연결로 하고 결과는 `MessagePort` 로 renderer 에 직접 간다 | "별도 프로세스 + 직접 포트" | 턴 2 | SUPERSEDED | D-037 (턴 16 — "별도 프로세스 + 직접 포트"는 유지, 읽기 전용 연결만 바뀜) |
| D-007 | 반응성 예산: UI 스레드의 한 작업은 **50ms** 를 넘지 않는다. **160ms** 이상은 심각으로 기록한다. UI 스레드에 남는 반복 작업은 **5ms** 마다 양보한다 | "범용적인 기준을 확인하고 제안하라" — 근거는 §4-A | 턴 2 + 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-008 | 입력 크기에 상한이 없는 계산·읽기는 UI 스레드에 두지 않는다. UI 스레드에 남기려면 입력 상한을 상수로 두고 그 상한에서의 비용을 잰다 | D-002 를 기계가 검사할 수 있는 규칙으로 옮긴 것 | 설계자 | ACTIVE | — |
| D-009 | 워커·호스트가 실패하면 강조 없는 원문 또는 오류 표시로 남는다. UI 스레드에서 같은 계산을 대신 돌리는 대체 경로를 두지 않는다 | 첨부 문서 사례 C 의 fallback — "fallback에서는 renderer가 계산을 수행한다" | 턴 1 첨부 + 설계자 | ACTIVE | 연구 문서 §5.2 "main 의 기존 경로로 한 번 대체"를 대체 |
| D-010 | 턴 스트림(SDK 메시지 해석·정규화·저장·전달)은 main 에 둔다. 세션 호스트 프로세스는 만들지 않는다 | DB 단건 쓰기 0.064ms(§8) | 설계자 | SUPERSEDED | D-015·D-016 |
| D-011 | 세션 본문은 조각으로 받아 **한 번에** 화면에 반영한다. 앞부분부터 보이는 점진 표시는 하지 않는다 | 점진 표시는 스크롤 위치·미완료 표시의 제품 동작을 바꾼다 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-012 | 구문 강조는 **32,000자** 이하 코드에만 적용한다. 지금 상한은 200,000자다 | 강조 결과를 DOM 에 넣는 일은 UI 스레드에 남고 1,000줄(35,696자)에서 26ms 다(§8) | 설계자 | ACTIVE (사용자 거부 가능 — 화면 동작 변경) | — |
| D-013 | 계측 결과는 기존 로컬 로그(JSONL)에만 남긴다. 외부 전송과 새 화면은 만들지 않는다 | 텔레메트리는 PRD §11 미정 항목이다 | 설계자 | ACTIVE | — |
| D-015 | 설계는 현재 계약이 아니라 완성된 형태를 기준으로 한다. 완성된 형태는 일반적으로 논의되는 구조여야 한다 | "현재의 계약에서만 생각하지 말 것. 완성된 형태를 기준하라" — 검토 결과 §4-B | 턴 7-3 | ACTIVE | D-010 대체 |
| D-016 | 턴 실행부(어댑터·SDK 호출·세션 런타임·정규화·게이트 훅 반환)는 **에이전트 호스트** 프로세스가 갖는다. 핸들러를 짧게 쪼갤 수 없으면 실행 위치를 옮긴다 | "원자적으로 풀어낼 수 없다면 … 넘기고 실패처리나 메시지를 기다리는 형태" | 턴 6 | ACTIVE | D-010 대체 |
| D-017 | main 은 수명 관리와 수명 상태 통지의 수신을 갖는다. 그 처리에서 생기는 DB 쓰기 같은 일은 호스트에 넘긴다 | "Main은 수명 관리라 훅을 포함할 거고 … 유틸리치프로세스에 이야와면" | 턴 7-1 | ACTIVE | — |
| D-018 | 비밀의 봉인·해제는 main 만 하고, 풀린 값은 에이전트 호스트에 전달할 수 있다. `security.md` 를 갱신한다 | "업데이트를 해도 좋다. 단 이 방안이 일반적으로 허용된다면" — 허용 판정 §4-B | 턴 7-2 | ACTIVE | — |
| D-019 | main 안의 `worker_threads` 는 쓰지 않는다 | Electron 문서: 스레드에서 Electron 모듈을 못 쓰고 네이티브 모듈이 위험하다. renderer 로 직접 가는 포트를 줄 수 없다(§4-B) | 턴 7-2 + 설계자 | ACTIVE | — |
| D-020 | 호스트·하네스의 상태는 수명 이벤트로 main 에 알린다. 프로세스가 죽으면 종료 신호를 받은 쪽이 세션을 오류로 끝내고 상태를 바꾼다 | "hook으로 상태를 알릴 수 있지 않은지" · "시그널에 의 해 main 이 받고 세션 종료(에러알림/예외처리)" | 턴 7-4·8-1 | ACTIVE | — |
| D-021 | 에이전트 호스트가 죽으면 남은 하네스를 종료한 뒤 그 세션들을 중단으로 처리한다 | "고아하네스 종료 후 세션 중단으로 예외처리할 것" | 턴 9-2 | ACTIVE | — |
| D-022 | 완성된 형태 전체를 이 handoff 하나에 담는다 | "하나의 핸드오프로" | 턴 9-4 | ACTIVE | D-005 대체. 설계자 권고(세 단계)는 기각됐다 |
| D-023 | git·셸 같은 도구 프로세스는 에이전트 호스트가 띄운다 | 띄우는 코드(`infra/git`·`infra/shell`)가 호스트로 가고, VS Code 도 git 을 확장 호스트에서 띄운다 | 턴 9-1 + 설계자 | ACTIVE | — |
| D-024 | 설계에서 갈리는 곳은 범용적인 대응을 따른다 | "설계관점에서 범용적인 대응을 따른다" | 턴 9-3 | ACTIVE | — |
| D-025 | DB 쓰기 주체는 **에이전트 호스트** 하나다. 데이터 호스트는 읽기 전용이다 | 쓰기 호출 287곳(§8)이 동기 API 를 쓴다 — 쓰기를 다른 프로세스에 두면 전부 비동기 요청이 된다. 쓰는 코드와 쓰기 연결을 같은 프로세스에 두는 것이 단일 쓰기 주체의 범용형이다 | 설계자(D-024 적용) | SUPERSEDED | D-035 (턴 16 B 채택) |
| D-026 | 포트는 preload 가 갖는다. renderer 코드가 쓰는 `window.oo` API 는 바뀌지 않는다 | 포트를 페이지의 메인 월드에 내주지 않는다. renderer 변경을 전송 계층에 가둔다 | 설계자 | ACTIVE | — |
| D-027 | 이번에 만드는 수명 이벤트는 다섯 가지다(턴 시작·턴 종료·승인 대기·세션 종료·하네스 종료). 하네스 훅의 등록 계약은 0323 이 이 위에 만든다 | 0323 D-001·D-002 가 그 계약의 범위다 | 설계자 | ACTIVE | — |
| D-028 | 프로세스 사이 호출과 화면 갱신의 경로를 문서(`AGENTS.md` 포함)에 적고, 경로를 건너뛴 직접 호출을 기계로 막는다 | "이를 준수할 것을 강력하게 제한할 것 … 직접 호출하는 일이 앖도록" | 턴 10 | ACTIVE | — |
| D-014 | diff 줄 계산은 두 입력의 줄 수 합이 **400** 이하면 UI 스레드에서, 넘으면 워커에서 한다. 넘는 입력의 도구 카드 머리 증감 수는 표시하지 않는다 | 작은 diff 마다 로딩 표시가 깜빡이지 않게 한다. 2,546줄·절반 변경이 415ms 다(§8) | 설계자 | ACTIVE (사용자 거부 가능 — 화면 동작 변경) | — |
| D-029 | 창 위치처럼 main(셸)이 쓰는 상태는 main 이 소유한다. 설정 파일은 에이전트 호스트만 연다 | "창위치 같은 개념들은 main이 가져야 하는게 마땅한것으로 보인다" — 두 프로세스가 같은 파일을 열면 서로의 쓰기를 덮는다(§7-B 조사) | 턴 11 | ACTIVE | — |
| D-030 | 턴 시작의 비동기 읽기는 어댑터의 **준비 단계**에서 하고, 판정 → spawn 은 지금처럼 동기로 둔다 | "준비 단계 추가" — `sendMessage` 를 비동기로 바꾸는 안과 범위 제외 안을 두고 고른 답 | 턴 11 | ACTIVE | — |
| D-031 | 호스트가 여는 `electron-store` 파일은 주입받은 `userData` 절대 경로(`cwd`)로만 연다. `cwd` 없는 생성은 가드가 막는다 | utility 프로세스 형상에서 `cwd` 없이 열면 예외 없이 다른 디렉토리에 쓴다(§7-B 조사) | 설계자(D-024 적용) | ACTIVE | — |
| D-032 | main 이 필요한 설정값은 UI 언어 하나다. 호스트가 알리고 main 은 자기 상태 파일에 사본을 둔다 | 트레이 라벨은 호스트가 뜨기 전에도 마지막 언어로 보여야 한다. 수명 이벤트 다섯 가지(D-027)와 별개 메시지다 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-033 | 설정 파일(설정·비밀·인증)은 에이전트 호스트가 단독으로 열고 쓴다. main 은 창 위치와 UI 언어 사본만 자기 셸 상태 파일에 둔다 — D-029·D-031·D-032 를 그대로 유지한다 | 턴 12 의 "제안하라"에 설계자가 낸 안이다: 설정을 읽는 자리(`rg -c "settings\.(getAll\|patch\|onPatch)\("` 합 35 / 10파일)가 호스트로 가는 코드에 있고 모두 동기 읽기라, main 이 소유하면 전부 프로세스 간 요청이나 사본 캐시가 된다. main 이 쓰는 값은 창 위치와 트레이 언어 둘이다(§7-B 조사 "셸에 남는 코드의 설정 접근" 4줄). 사용자는 이 제안을 받은 뒤 "이어서 진행하라"·"계속"이라고 했다 — 명시 거부가 없어 채택으로 읽었고, 거부하면 EP-13·EP-14·AC36·AC38 을 다시 연다 | 턴 12 + 설계자 제안 + 턴 13 | SUPERSEDED | D-036 (턴 16 B 채택) |
| D-034 | 에이전트 호스트는 **실행 호스트**다 — SDK·CLI 호출 · 하네스·git·셸 프로세스 · 세션 런타임(lease·승인·백그라운드 작업) · 턴 정규화·버스 · 제목 생성을 갖는다. DB·설정·비밀·인증 파일은 갖지 않는다 | "에이전트 호스트는 sdk cli 실행 전용이 아니었는지?" · VS Code 비교(확장 호스트는 실행만 하고 앱 상태를 갖지 않는다) 뒤 "b로 진행하라" | 턴 14~16 | ACTIVE | §11 단계 4 의 "`Bootstrap` 이 호스트에서 뜬다"를 대체. D-016 은 유지 |
| D-035 | DB 의 유일한 소유자(연결·쓰기·마이그레이션·복구)는 **데이터 호스트**다 | 같은 출처. D-025 의 비용 근거를 다시 셌다 — 실행 쪽 코드의 DB 호출은 33곳이고 242곳은 데이터 호스트 안에서 동기로 남는다(§7-F 조사) | 턴 16 + 설계자 | ACTIVE | D-025 대체 |
| D-036 | 설정·비밀·인증 파일은 데이터 호스트가 단독으로 열고 쓴다. 에이전트 호스트는 설정의 읽기 전용 사본을 받는다. main 은 창 위치와 UI 언어 사본만 갖는다(D-029·D-032 유지) | 같은 출처 — 앱 상태는 상태 호스트에 둔다 | 턴 16 + 설계자 | ACTIVE | D-033 대체 |
| D-037 | 데이터 호스트는 앱 시작 때 뜬다. 큰 세션 본문은 데이터 호스트 → renderer 포트로 직접 간다 | DB 소유자라 첫 요청까지 미룰 수 없다. D-006 의 "별도 프로세스 + 직접 포트"는 유지되고 "읽기 전용 연결"만 바뀐다 | 턴 16 + 설계자 | ACTIVE | D-006 대체 |
| O-1 | 인증(로그인 흐름·토큰 갱신·인증 요청·게이트)의 자리 | 데이터 호스트(앱 상태와 함께) 또는 에이전트 호스트(VS Code 처럼 실행 쪽) — §7-F OPEN 표 | 설계자 질의 | OPEN | — |
| O-2 | 턴 이벤트 저장이 실패했을 때 | 비동기 저장 뒤 실패면 턴을 오류로 끝냄 또는 저장 확인 뒤 화면 중계 | 설계자 질의 | OPEN | — |
| O-3 | 데이터 호스트의 비밀 해제 방식 | 기동 때 한 번 풀어 두고 못 푼 것은 깨어날 때 다시 시도 또는 읽을 때마다 셸에 요청 | 설계자 질의 | OPEN | — |
| O-4 | 데이터 호스트가 턴 도중 죽었을 때 진행 중 턴 | 즉시 오류로 끝냄 또는 다시 뜰 때까지 저장을 쌓아 두고 이어 저장 | 설계자 질의 | OPEN | — |

### 갱신 메모

- 턴 14~16(rev 4 DRAFT): 사용자가 에이전트 호스트의 역할을 다시 물었고(턴 14 "에이전트 호스트는 sdk cli 실행 전용이 아니었는지?"), VS Code 사례와 비교한 뒤(턴 15 "이것과 비교하면 어떤 형태가 적절한지?" · "B에 비해 a의 장점은?") B 를 골랐다(턴 16 "b로 진행하라. 상세 설정을 다시 확인하자"). D-006·D-025·D-033 → D-037·D-035·D-036, D-034 신규, OPEN 4건(O-1~O-4). 확정 전이라 AC·V·§10 은 아직 바뀌지 않았다 — 바뀔 행은 §7-F "바뀌는 AC" 표.
- rev 4 DRAFT `ACTIVE 결정 ↔ AC` 대조: 충돌 4 — D-035 ↔ AC30("DB 를 쓰기로 여는 프로세스는 에이전트 호스트") · D-037 ↔ AC18("첫 요청에 뜬다")·AC20("읽기 전용") · D-036 ↔ AC37(호스트 = 에이전트 호스트로 읽힘). 모두 §7-F 확정 때 대체할 AC 다. 그 사이 구현은 멈춘다.

- 턴 13: D-033 을 OPEN → ACTIVE 로 닫았다. 내용은 D-029 의 유지라 AC·V pair·§10 행은 바뀌지 않았다 — OPEN 0.

- rev 3(턴 11)에서 새로 추가된 결정: D-029·D-030(사용자) · D-031·D-032(설계자). 기존 ACTIVE 결정은 모두 유지된다 — D-027 의 "다섯 가지"는 수명 이벤트의 수이고 D-032 의 언어 알림은 수명 이벤트가 아니다.
- rev 3 `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-029 ↔ AC36 · D-030 ↔ AC21′ · D-031 ↔ AC37 · D-032 ↔ AC38 · D-026(`window.oo` 형상 불변) ↔ AC36(설정 스키마의 `windowBounds` 키를 지우지 않는다 — B12).

- 이번 턴에서 새로 추가된 결정: D-015~D-027 (rev 2) · D-028 (턴 10). D-001~D-014 는 rev 1.
- 변경된 결정: D-005 → D-022 ("하나의 핸드오프로"의 범위가 완성된 형태 전체로 넓어졌다) · D-010 → D-015·D-016 (사용자가 완성된 형태를 기준으로 지시).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001~D-004 · D-006~D-009 · D-011~D-014.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ AC8·AC15·AC22·AC24(조작 반응) · D-006 ↔ AC15·AC18 · D-007 ↔ AC5·AC6·AC7(50/160 상수) · D-008 ↔ AC2·AC3·AC4 · D-009 ↔ AC12·AC18 · D-011 ↔ AC16 · D-012 ↔ AC8 · D-013 ↔ AC5 · D-014 ↔ AC10 · D-016 ↔ AC24·AC25 · D-017·D-020·D-027 ↔ AC28 · D-018 ↔ AC27 · D-019 ↔ AC26(스레드 미사용은 가드 규칙 (f)) · D-021 ↔ AC29 · D-022 ↔ AC1~AC35 · D-023 ↔ AC26 · D-025 ↔ AC30 · D-026 ↔ AC24 · D-028 ↔ AC34·AC35.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 멈춤의 원인은 "어디서 도는가"다 — `CodeBlock.tsx:65` 의 `codeToHtml` 이 renderer 메인 스레드에서 1,000줄에 약 1초(§8) |
| 이미 기존 코드가 충족하는가 | 일부 — 전제 정정 | "주니어 수준" 전제와 달리 스트리밍 표시는 이미 프레임에 묶인다(`chatStore.ts:995` rAF 코얼레서, `rendering.md` §1.2). 없는 것은 워커·계측·배치 규칙이다(`rg 'new Worker\(\|utilityProcess\|monitorEventLoopDelay' app/src` → 주석 1건) |
| 더 작은 해법이 있는가 | 부분 채택 | DOM 삽입 비용은 상한으로 막는다(D-012). 세션 로드를 main 안에서 나눠 읽는 안은 기각 — 같은 연결의 반복 조회 중 쓰기가 막힌다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 2건 정정 | 연구 문서의 "전부 미측정"은 §8 실측으로 대체. "DB 쓰기를 그대로 둔다"는 0.064ms 로 확인. "턴 정규화는 이벤트당 가볍다"는 미측정이라 D-010 에 조건을 달았다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 계약 변경 2건 | `oo:session:load`·`oo:session:refresh` 응답에서 세션 본문이 빠진다 — `IPC_CONTRACT.md` 를 같이 고친다(D-006 의 귀결) |

- 사용자에게 올릴 결정: 없음. D-007·D-011·D-012·D-014·D-025 는 설계자 제안이라 거부할 수 있다.
- 코드 조사로 닫은 사실: §8.

### 4-A. D-007 의 근거 — 범용 기준

| 기준 | 수치 | 출처(이번 턴에 원문 확인) | Orcinus orca 에 옮긴 것 |
|---|---|---|---|
| W3C Long Tasks | 한 작업 50ms 초과가 "long task". 입력 응답 100ms 목표(RAIL)에서 나온 값 | `w3c/longtasks` README — "Long-task threshold is 50ms" | 한 작업 상한 50ms |
| Linux softirq(bottom half) | 한 번에 2ms 또는 10회 재시작까지 돌고 남은 일은 `ksoftirqd` 스레드로 넘긴다 | `kernel/softirq.c` — `MAX_SOFTIRQ_TIME msecs_to_jiffies(2)` · `MAX_SOFTIRQ_RESTART 10` | 짧게 처리하고 남으면 넘긴다(D-008) |
| React scheduler | 5ms 마다 브라우저에 양보한다 | `SchedulerFeatureFlags.js` — `frameYieldMs = 5` | UI 스레드 반복 작업의 양보 간격 5ms |
| VS Code 배경 토큰화 | 1~2ms 조각으로 돌고 idle callback 에 다시 예약한다 | `textModelTokens.ts` — "try to yield every 1-2ms" | 같은 원칙 |
| VS Code 느린 작업 감지 | `longtask` 관측값이 기준 PC 에서 약 160ms(`perfBaseline * 10`) 이상이면 프로파일을 뜬다 | `rendererAutoProfiler.ts` · `timerService.ts` | 심각 기록 기준 160ms |

`w3c.github.io`·`web.dev` 는 이 세션의 네트워크 허용 목록 밖이라 열지 못했다 — W3C 수치는 같은 명세의 GitHub 저장소 README 로 확인했다.

### 4-B. D-015 의 검토 — 완성된 형태가 일반적인 구조인가

판정: 일반적이다. "권한을 쥔 얇은 셸 + 서비스 프로세스 + UI"는 아래 넷에 공통인 형태다.

| 사례 | 같은 모양 | 출처 |
|---|---|---|
| Chromium | 브라우저 프로세스가 권한·수명을 쥐고 기능은 서비스·유틸리티 프로세스에 둔다 | 첨부 분석 §1 실행 주체 표 |
| VS Code | main 이 확장 호스트·shared process·파일 감시 프로세스를 띄우고 포트만 넘긴다. "main은 시작·연결·종료·비정상 종료 처리를 맡고, 정상 확장 프로토콜 데이터를 매번 main JS가 중계하지 않는다" | 첨부 분석 §3 |
| Electron | `utilityProcess` 는 "child process with Node.js and Message ports enabled". MessagePort 튜토리얼은 worker process·reply streams 를 사용 사례로 들고 "without the performance overhead of relaying via the main process" 라고 적는다 | `electron/electron` `docs/api/utility-process.md` · `docs/tutorial/message-ports.md` |
| 비밀 전달 | VS Code 는 봉인·해제를 main 이 하고 풀린 값을 확장 호스트에 전달한다. Orcinus orca 도 이미 실행 값을 하네스 자식 프로세스의 환경으로 넘긴다 | `security.md` §1.4-b |

| 검토한 대안 | 판정 | 근거 |
|---|---|---|
| main 안의 `worker_threads` | 기각(D-019) | "none of Electron's built-in modules can be used in a multi-threaded environment" · 네이티브 모듈은 "crashes and memory corruptions" — `docs/tutorial/multithreading.md`. 이 문서는 Web Worker 기준이라 main 의 `worker_threads` 에 그대로 적용되는지는 확인하지 못했다 |
| 무거운 조각만 데이터 호스트로 | 기각 | 새로 생기는 무거운 조각을 매번 찾아야 한다. 턴 준비 경로에서 이미 네 곳을 놓쳤다(§8) |
| 쓰기 주체를 데이터 호스트에 | 기각(D-025) | 쓰기 호출 287곳이 비동기 요청으로 바뀐다 |
| 호스트의 네트워크 요청 | 가능 | `net` 은 Main·Utility 둘 다에서 쓴다. `net.fetch` 는 기본 세션에서 나간다 — `docs/api/net.md`. 파티션 세션이 필요한 요청은 main 의 셸 서비스가 한다 |

## 5. 동작 / 사용자 흐름

```text
[코드 블록·diff·세션을 연다]
  → 원문 또는 로딩 표시가 즉시 보인다 (조작은 계속 반응)
  → 워커/호스트가 결과를 보낸다
  → 화면에 반영된다 (강조·diff 표·세션 본문)
  ↘ 내용이 바뀌었거나 닫혔다 → 늦은 결과는 버린다
  ↘ 워커/호스트 실패 → 원문 유지 또는 기존 오류 표시, UI 스레드 대체 계산 없음
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 32,000자 이하 코드 블록이 화면에 놓임 | 워커에 강조 요청, 같은 내용이 캐시에 있으면 바로 반영 | 원문 → 색상(지금과 같은 순서) |
| 32,000자 초과 코드 블록 | 강조 요청 없음 | 원문 그대로 |
| 줄 수 합 400 이하 diff | UI 스레드에서 줄 계산 | 지금과 같다 |
| 줄 수 합 400 초과 diff | 워커에 줄 계산 요청 | 본문 자리에 로딩 표시 → diff 표. 머리의 증감 수는 없다 |
| 강조 요청 중 내용 변경·언마운트 | 요청 취소, 늦은 응답 폐기 | 새 내용의 원문 |
| 워커 생성 실패·오류 | 오류 1회 기록, 연속 3회 실패하면 창이 닫힐 때까지 요청하지 않음 | 원문 그대로 |
| 세션 클릭 | main 이 활동 상태만 돌려주고 본문은 호스트가 조각으로 보냄 | 기존 세션 로딩 표시 → 본문 |
| 세션 로드 중 다른 세션 클릭 | 앞 요청 취소, 남은 조각 미전송 | 새 세션의 로딩 표시 |
| 호스트 비정상 종료 | 진행 중 요청 실패, 다음 요청에서 다시 띄움 | 기존 "대화 열기 실패" 오류 표시 |
| UI 스레드가 50ms 이상 멈춤 | `perf.stall` 로그 1건 | 화면 변화 없음 |
| 메시지 전송 | preload 가 에이전트 호스트 포트로 보낸다. main 은 이 요청을 처리하지 않는다 | 지금과 같다 — 내 메시지가 즉시 보이고 응답이 스트리밍된다 |
| 에이전트 호스트 비정상 종료 | main 이 남은 하네스를 끝내고 모든 창에 알린다. 진행 중이던 세션은 중단으로 처리된다 | 진행 중 세션에 오류 알림, 입력창은 다시 쓸 수 있다. 다음 전송에서 호스트가 다시 뜬다 |
| 하네스 비정상 종료 | 에이전트 호스트가 그 세션만 오류로 끝내고 수명 이벤트를 보낸다 | 그 세션에 기존 오류 표시 |
| 앱 시작 | main 이 창을 띄우고 에이전트 호스트를 띄운다. 호스트가 DB 마이그레이션을 한다 | 기존 부팅 화면 → 본 화면. 호스트 기동 실패는 부팅 오류 화면 |
| 앱 종료 | main 이 호스트에 종료를 요청하고 3초 안에 안 끝나면 강제 종료한다 | 지금과 같다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 강조 대기는 원문, 큰 diff 대기는 로딩 표시, 세션 대기는 기존 `loadingSession` 표시를 쓴다. 새 문구는 큰 diff 로딩 1종뿐이다(`ko.ts`).
- cancel / retry / close / restart: 취소는 요청 번호 폐기다. 세션 로드 실패의 재시도는 지금처럼 다시 여는 것이다. 창이 닫히면 워커가 끝나고, 앱이 끝나면 main 이 호스트를 내린다.
- concurrency / multi-session: 계산 워커는 창마다 1, 에이전트 호스트와 데이터 호스트는 앱에 1 씩이다. 창마다 호스트별 포트를 하나씩 갖는다. 한 에이전트 호스트 안에서 세션끼리 서로를 늦출 수는 있지만 창 조작은 막지 않는다.
- keyboard / a11y / theme: 테마가 바뀌면 캐시 키가 달라져 다시 요청한다. 큰 diff 로딩 표시는 `role="status"` 를 갖는다.
- 외부환경/오프라인/폐쇄망: 새 네트워크 요청과 새 의존성이 없다.

## 6. 범위 / 비범위

- **범위**: 실행 주체 계약 문서와 가드 · 경로 표와 직접 호출 금지 가드(D-028) · `perf.stall` 계측 · renderer 계산 워커(구문 강조·diff 토큰·diff 줄) · 에이전트 호스트 프로세스(지금의 main 로직 전체 이주, main 은 셸) · 데이터 호스트 프로세스와 세션 로드/갱신 이주 · 수명 이벤트 다섯 가지 · 호스트·하네스 종료 처리 · 턴 시작의 동기 플러그인 카탈로그 읽기 제거.
- **비범위**: 하네스 훅의 등록 계약과 우측 패널 확장(0323, D-027) · 세션·하네스별로 에이전트 호스트를 여럿 두는 것 · 세션 본문의 점진 표시(D-011) · Markdown 변환의 워커 이주 · 긴 코드의 줄 가상화 · 검색·사용량 집계의 호스트 이주 · 델타 송신 묶기 · 계측 화면과 외부 전송(D-013) · 0323 의 훅·패널.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 검색·사용량 집계의 호스트 이주 | 아니오 — 호스트 프로토콜에 서비스 종류를 더하면 된다 | `perf.stall` 이 보이면 후속 |
| 에이전트 호스트를 여럿으로 | 아니오 — 창·호스트 사이 계약이 포트 단위라 호스트 수와 무관하다 | 스트리밍끼리의 지연이 `perf.stall`(`thread:'agent-host'`)에 보이면 후속 |
| Markdown 변환(3.3만 자 50~95ms) | 아니오 | §10 선언 경계 B1, 후속 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 실행 주체 7종의 맡는 일·금지·예산·워커 운영이 한 문서에 있고 main·renderer 가이드가 그 규칙을 갖는다 | `node scripts/check-doc-inventory.mjs --check` green · 문서의 금지 행마다 강제 수단(AC2~AC4 가드 이름 또는 "강제 없음")이 적혀 있음을 검증자가 대조 | `docs/INDEX.md` → `docs/arch/execution-model.md` → `app/src/{main,renderer}/AGENTS.md` · `security.md` §1.4-b |
| R-02 | AT-02 / AC2 | `src/main` 에 등록되지 않은 Node 동기 API 이름(`fs`·`child_process` 의 `*Sync`)을 쓰면 가드가 실패한다. 등록 개수가 실제보다 많아도 적어도 실패한다 | `scripts/check-ui-thread.test.mjs` — 미등록 추가 → exit 1 · 등록 초과 → exit 1 · 등록 일치 → exit 0 | `ci.yml` 가드 단계 · `npm test` |
| R-02 | AT-03 / AC3 | renderer 에서 허용 경로 밖 모듈이 `shiki`·`shiki/*`·`diff` 의 값을 import 하면 가드가 실패한다. `import type` 은 통과한다 | 같은 테스트 — 값 import → exit 1 · type import → exit 0 · 허용 경로의 값 import → exit 0 | 같다 |
| R-02 | AT-04 / AC4 | `features/history/reader` 의 `loadSession` 을 등록된 자리 밖에서 import 하면 가드가 실패한다 | 같은 테스트 — 미등록 import → exit 1 | 같다 |
| R-03 | AT-05 / AC5 | main 과 에이전트 호스트의 이벤트 루프가 50ms 이상 멈추면 `perf.stall` 이 `thread:'main'`/`'agent-host'`·`durationMs`·`severity` 로 남는다. 160ms 이상이면 `severity:'severe'` 다. 한 관측 창에 1건만 남는다 | `infra/perf/stall-monitor.test.ts` — 지연 표본 49/50/159/160 → 기록 없음/`long`/`long`/`severe` · 한 창에 표본 3개 → 기록 1건(최댓값) | 셸 시작·호스트 시작 → `monitorEventLoopDelay` → 로거 |
| R-03 | AT-06 / AC6 | 요청 핸들러(셸의 IPC·호스트의 포트 요청)의 동기 구간이 50ms 이상이면 채널 이름과 함께 `perf.stall` 이 남는다. `handle`·`handlePlain`·`on` 모두 그렇고, `handle.ts` 밖에서 `ipcMain` 에 직접 등록하는 자리는 없다 | `infra/ipc/handle.test.ts` — 주입한 시계로 60ms 걸리는 핸들러 → 채널 이름이 실린 기록 1건, 세 등록 함수 각각 · 가드 규칙 (d) — `handle.ts` 밖의 `ipcMain` 등록 → exit 1 | renderer invoke → `handle()` → 핸들러 |
| R-03 | AT-07 / AC7 | renderer 메인 스레드의 50ms 이상 작업이 `thread:'renderer'` 로 같은 형식에 남는다. 1초에 1건을 넘지 않는다 | `shared/perf/longTaskReporter.test.ts` — long task 항목 5개를 1초 안에 주입 → emit 1건(`count:5`, 최댓값) | `main.tsx` → `PerformanceObserver('longtask')` → `oo:log:emit` |
| R-04 | AT-08 / AC8 | 코드 블록 강조는 워커 응답 전에는 원문, 응답 후에는 색상이다. 32,000자 초과 코드는 요청하지 않는다 | `CodeBlock.render.test.ts` — 가짜 계산 클라이언트 응답 전 `<pre>` 원문 · 응답 후 응답 HTML · 32,001자 → 요청 0회 | `Markdown` → `CodeBlock` → `computeClient` → 워커 |
| R-04 | AT-09 / AC9 | diff 구문 토큰이 워커에서 계산돼 줄에 붙는다 | `useDiffSyntax` 테스트 — 가짜 클라이언트가 준 토큰이 old/new 축별로 해당 줄에 매핑 | `FileDiffSection` → `useDiffSyntax` → `computeClient` |
| R-04 | AT-10 / AC10 | 줄 수 합 400 이하 diff 는 같은 렌더에서 결과가 나오고, 401 이상은 워커 결과가 올 때까지 로딩 상태다. 401 이상의 머리 증감 수는 없다 | `shared/compute/inline.test.ts` — 400 → 결과 · 401 → `null` · `toolMeta` 테스트 — 401 → 증감 수 없음 | `DiffBody`·`filePresentation`·`toolMeta` → `diffLinesWithinCap` / 워커 |
| R-04 | AT-11 / AC11 | 취소한 요청의 늦은 응답은 반영되지 않는다. 대기 중 취소된 요청은 워커에 보내지 않는다. 실행 중 요청이 취소되고 대기 요청이 있으면 워커를 새로 만든다 | `shared/compute/client.test.ts` — 가짜 워커로 세 경우 각각: resolve 0회 / postMessage 0회 / `terminate` 1회 + 새 워커에 대기 요청 전송 | `CodeBlock` 언마운트 → `computeClient.cancel` |
| R-04 | AT-12 / AC12 | 워커가 실패하면 요청은 실패로 끝나고 소비자는 원문을 유지한다. UI 스레드는 `shiki` 를 부르지 않는다. 연속 3회 실패 뒤에는 워커를 만들지 않는다 | `client.test.ts` — 생성 실패/`error` 이벤트 → reject + 오류 로그 1건 · 4번째 요청 → 워커 생성 0회 · AC3 가드가 UI 스레드의 `shiki` 값 import 를 막음 | `computeClient` → `Worker` 생성 |
| R-04 | AT-13 / AC13 | 대기 요청은 입력 길이가 짧은 것부터 나간다 | `client.test.ts` — 길이 9000·10·500 순으로 넣음 → 전송 순서 10·500·9000 | 같다 |
| R-04 | AT-14 / AC14 | 같은 `(종류, 내용, 언어, 테마)` 재요청은 워커에 가지 않는다. 캐시는 결과 문자 수 합 4,000,000 을 넘으면 오래된 것부터 버린다 | `client.test.ts` — 같은 요청 2회 → 전송 1회 · 상한 초과 삽입 → 가장 오래 안 쓴 항목 재요청 시 전송 발생 | 가상 스크롤 재마운트 → `CodeBlock` |
| R-05 | AT-15 / AC15 | 세션을 열면 본문이 호스트 → renderer 포트로 오고, 조립한 결과는 지금의 `loadSession` 결과와 같다 | `app/data-host/session-load.test.ts`(io) — 같은 DB 픽스처에서 `loadSession()` 결과와 `조각 전송 → 조립` 결과가 `toEqual`(native 이력 있는 세션·없는 세션·없는 id) | 사이드바 클릭 → `chatStore.loadSession` → `sessionApi.load` → 호스트 |
| R-05 | AT-16 / AC16 | 한 조각은 part 500개를 넘지 않는다. part 가 500개를 넘는 메시지 하나는 혼자 한 조각이다. renderer 는 마지막 조각 뒤에 한 번만 스토어에 반영한다 | `shared/data-host-chunks.test.ts` — 1,200 part → 조각별 part 수 ≤ 500 · 700 part 메시지 → 단독 조각 · `chatStore` 테스트 — 조각 3개 수신 동안 `LOAD_SESSION` 0회, 끝에 1회 | 같다 |
| R-05 | AT-17 / AC17 | 진행 중 로드가 취소되면 호스트는 다음 조각부터 보내지 않고, renderer 는 그 요청의 늦은 조각을 버린다 | `session-load.test.ts` — 조각 1 뒤 취소 → 조각 2 미전송 · `dataHostClient.test.ts` — 취소한 요청 번호의 조각 → 조립 결과 없음, 다른 요청 정상 | 세션 A 로드 중 세션 B 클릭 |
| R-05 | AT-18 / AC18 | 데이터 호스트는 첫 요청에 뜬다. 비정상 종료하면 진행 중 요청이 실패하고 다음 요청에서 다시 뜬다. 앱 종료 때 에이전트 호스트보다 먼저 내려간다. 다른 프로세스가 대신 읽지 않는다 | `app/shell/host-supervisor.test.ts` — 가짜 프로세스로: 요청 전 fork 0회 · exit 이벤트 → 종료 통지 1회 · 다음 connect → fork 2회째 · `shutdown()` 호출 순서 기록 | 셸 → `HostSupervisor`(데이터 호스트) |
| R-05 | AT-19 / AC19 | 세션 갱신도 본문을 호스트에서 받는다. `oo:session:load`·`oo:session:refresh` 의 응답(에이전트 호스트가 답한다)에는 메시지 배열이 없다 | `handlers/session.load.test.ts` — 두 채널 응답에 `messages` 키 없음 · `activity` 는 있음 · `compactLegacyRaw` 가 응답 전에 1회 호출 | `chatStore` 의 `refresh()` → `sessionApi.refresh` → 호스트 |
| R-05 | AT-20 / AC20 | 호스트는 DB 를 읽기 전용으로 연다. 호스트 요청은 스키마 검증을 통과해야 처리된다 | `session-load.test.ts`(io) — 호스트 연결로 쓰기 실행 → `SQLITE_READONLY` · 형식이 틀린 요청 → `error` 응답, 조회 0회 | 호스트 `entry.ts` |
| R-06 | AT-21 / AC21 — **SUPERSEDED → AC21′ (§7-B)** | 턴을 시작할 때 플러그인 카탈로그를 비동기로 읽는다. 결과는 지금과 같다 | `adapters/claude` 기존 카탈로그 테스트를 비동기 진입점으로 — 같은 픽스처에서 같은 카탈로그 · AC2 가드에서 `plugin-catalog.ts` 등록 0 | `chat:send` → `adapter.ts` 턴 셋업 |
| R-07 | AT-22 / AC22 | Windows 실기 8개 시나리오에서 main·renderer 의 `perf.stall` 이 0건이다. 선언 경계(B1·B2·B8)의 경로에서 난 기록은 경계로 적는다 | 사람 실기 — §19 시나리오를 수행하고 로그에서 `perf.stall` 을 센다 | 설치본 또는 `npm run dev` |
| R-07 | AT-23 / AC23 | 패키징한 앱에서 계산 워커와 두 호스트가 실제로 뜬다 — 코드 블록에 색이 입혀지고, 세션이 열리고, 메시지를 보내면 응답이 온다 | 사람 실기 — `build:win` 산출물에서 강조 1회·세션 열기 1회·전송 1회, 로그에 워커·호스트 오류 0건 | NSIS 설치본 |
| R-09 | AT-34 / AC34 | 일의 종류마다 "누구에게 어떤 경로로 요청하는가"가 경로 표 한 곳에 있고, root·`app`·`main`·`renderer` 의 `AGENTS.md` 가 그 표와 "직접 호출 금지"를 갖는다. 표의 각 경로에는 그것을 강제하는 가드 규칙 이름이 붙어 있다 | `scripts/check-ui-thread.test.mjs` — 가드의 규칙 id 전부가 `docs/arch/execution-model.md` 경로 표에 나온다(차집합 0) · 표의 규칙 id 가 가드에 없으면 실패 · 네 `AGENTS.md` 가 그 문서를 링크 | 에이전트의 진입 순서 `AGENTS.md` → `execution-model.md` |
| R-09 | AT-35 / AC35 | 경로를 건너뛴 직접 호출 다섯 가지가 가드에서 실패한다 — 창 통지 API 를 전송 모듈 밖에서 호출 · renderer 가 `shared/api` 밖에서 `window.oo` 접근 · renderer 가 계산 클라이언트 밖에서 `Worker` 생성 · 등록 밖 파일의 프로세스 기동(`child_process`·`utilityProcess`) · 등록 밖 파일의 DB 연결(`better-sqlite3` 값 import). 실패 메시지는 써야 할 경로와 문서 절을 알려 준다 | 같은 테스트 — 규칙 (g)~(k) 각각 위반 픽스처 → exit 1 과 메시지에 경로 이름·`execution-model.md` 포함 · 허용 파일 → exit 0 · 실제 트리 → exit 0 | `ci.yml` 가드 단계 |
| R-08 | AT-24 / AC24 | 모든 요청 채널은 셸 또는 에이전트 호스트 중 정확히 한 곳이 처리한다. 호스트 채널의 요청은 preload → 호스트 포트로 가고 main JS 를 지나지 않는다. `window.oo` 의 형상은 그대로다 | `shared/channel-owner.ts` 가 `Record<keyof typeof CHANNELS, 'shell' \| 'host'>` 라 빠진 채널은 typecheck 실패 · `preload/index.test.ts` — 호스트 채널 호출 → 포트 전송 1회·`ipcRenderer.invoke` 0회, 셸 채널은 반대 · 기존 `index.d.ts` 타입 불변 | `window.oo.chat.send` → preload → 포트 → 호스트 `handle()` |
| R-08 | AT-25 / AC25 | 턴 이벤트를 포함한 호스트발 통지는 호스트 → 창 포트로 직접 간다. 창이 사라지면 그 창으로의 전송은 조용히 버려진다 | `infra/ipc/send.test.ts` — 가짜 클라이언트 2개에 `sendChatEvent`·`broadcast` → 소유 창만/전부 수신 · 닫힌 클라이언트 → 예외 없음, 전송 0 | `bus 'turn.event'` → relay → `ClientRef.send` → preload 구독자 |
| R-08 | AT-26 / AC26 | 셸(`src/main/index.ts` 에서 닿는 모듈)은 `features`·`adapters`·`infra/db`·`better-sqlite3`·`worker_threads` 를 import 하지 않는다. 호스트 쪽 모듈은 `electron` 의 값 import 를 셸 서비스 어댑터 밖에서 하지 않는다 | 가드 규칙 (e)·(f) — 위반 픽스처 → exit 1, 실제 트리 → exit 0 | `ci.yml` 가드 단계 |
| R-08 | AT-27 / AC27 | 호스트는 권한 있는 작업을 셸 서비스로만 한다 — 비밀 봉인·해제 · 대화상자 · 외부 열기 · 알림 · 창 포커스 · 전원 이벤트 · 파티션 세션 요청 · 업데이트 제어. 요청은 스키마 검증을 통과해야 처리된다 | `app/shell/services.test.ts` — 서비스 8종 각각: 올바른 요청 → 가짜 Electron 호출 1회와 응답 · 형식이 틀린 요청 → 오류 응답, 호출 0 | 호스트 `infra/config/crypto.ts` → 셸 서비스 포트 → `safeStorage` |
| R-08 | AT-28 / AC28 | 에이전트 호스트는 수명 이벤트 다섯 가지를 main 에 보낸다. 업데이트 재시작 게이트와 트레이 종료 판정은 그 이벤트로 만든 상태만 본다 | `app/shell/lifecycle-state.test.ts` — 이벤트 열(턴 시작 2·종료 1) → 활성 턴 1 · 승인 대기 → 대기 표시 · 하네스 종료 → 그 세션 비활성 · 기존 재시작 게이트 테스트가 이 상태로 green | 호스트 버스 → 수명 통지 → 셸 `LifecycleState` → `updater`·`tray-residency` |
| R-08 | AT-29 / AC29 | 에이전트 호스트가 비정상 종료하면 main 은 그 호스트를 부모로 둔 프로세스를 모두 끝내고, 창에 종료를 알리고, 수명 상태를 비운다. renderer 는 진행 중이던 세션을 중단으로 표시하고 입력을 받는다. 다음 요청에서 호스트가 다시 뜬다 | `app/shell/host-supervisor.test.ts` — 가짜 프로세스 목록(자식 2·무관 1) + exit → 자식 2만 kill, 통지 1회, 다음 connect → fork 2회째 · `chatStore` 테스트 — 종료 통지 → busy 세션이 오류 메시지 1건과 함께 idle | `utilityProcess` `exit` → `HostSupervisor` |
| R-08 | AT-30 / AC30 | DB 를 쓰기로 여는 프로세스는 에이전트 호스트 하나다. 마이그레이션도 호스트가 한다. 호스트가 죽은 뒤 다시 뜨면 끊긴 도구 호출과 미완료 메시지가 지금의 복구 규칙으로 정리된다 | 가드 규칙 (e)(셸의 `better-sqlite3` 0) · AC20(데이터 호스트 읽기 전용) · 기존 `features/chat/recovery` 테스트 — 턴 중간에 끊긴 DB 픽스처 → 재기동 뒤 `recoverSessionHistory` 가 정리 | 호스트 `entry.ts` → `initDb` |
| R-08 | AT-31 / AC31 | 창은 에이전트 호스트가 준비된 뒤에 본 화면으로 넘어간다. 기동 실패는 부팅 오류로 보인다 | `app/shell/boot.test.ts` — 호스트 `ready` 전 `bootWhenReady` 미해결 · `ready` 뒤 해결 · 기동 실패 → reject 와 부팅 보고 1건 | `index.ts` → `HostSupervisor.start` → `oo:boot:when-ready` |
| R-08 | AT-32 / AC32 | 앱 종료 때 main 은 에이전트 호스트에 종료를 요청하고, 호스트는 예약 작업 → 스케줄러 → DB 닫기 순으로 정리한다. 3초 안에 끝나지 않으면 main 이 강제 종료한다 | `host-supervisor.test.ts` — 종료 요청 → 정상 종료 시 kill 0회 · 3초 무응답(가짜 시계) → kill 1회 · 호스트 `shutdown` 호출 순서 기록 | `will-quit` → `HostSupervisor.shutdown` |
| R-08 | AT-33 / AC33 | 에이전트 호스트가 다시 뜨면 열려 있던 창은 새 포트를 받고 세션 목록과 활성 세션을 다시 읽는다 | `preload/index.test.ts` — 두 번째 포트 수신 → 이후 요청이 새 포트로 감 · `chatStore` 테스트 — 재연결 통지 → 목록 재조회 1회·활성 세션 `loadSession` 1회 | `HostSupervisor` 재기동 → 창 포트 재전달 |

### AC 검증 주의사항

- 기존 테스트 재사용: `CodeBlock.render.test.ts`·`handle.test.ts`·`session.load.test.ts` 는 실재한다(`ls` 확인). 새 단언은 이 파일들에 더한다.
- 사람 실기 항목: AC22·AC23 은 실제 Chromium 프레임과 Electron 프로세스 생성·종료가 관측 대상이다. 고아 하네스 종료(AC29)의 실제 OS 동작도 실기 시나리오 8 이 본다. 이 저장소의 에이전트 환경은 Electron 바이너리를 받지 못한다(`app/AGENTS.md` 제약 환경). 순수 로직은 AC5~AC20 으로 내렸다.
- N회/총량 기준: AC5·AC7 의 "1건"은 관측 창 하나의 기록 수다. sink 는 로거 하나이고 호출부는 모니터 1곳·리포터 1곳이다.
- 총량/0건 기준: AC22 의 0건은 §10 선언 경계 B1·B2·B8 의 경로를 뺀 수다. 경계 경로의 기록은 실기 보고에 따로 적는다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 로 분해한 pair 의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-09 | R | §7 | NEW | — |
| AT-01~AT-35 | AT | §7 | NEW | — |
| SD-01 | SD | 계산 요청 수명주기 — §5·§13 | NEW | — |
| SD-02 | SD | 세션 로드 수명주기(티켓 → 포트 → 조각 → 반영 / 취소 / 호스트 종료) — §5·§13 | NEW | — |
| SD-04 | SD | 에이전트 호스트 수명주기(기동 → 준비 → 창 연결 → 비정상 종료·고아 정리 → 재기동 → 종료) — §5·§13 | NEW | — |
| AR-06 | AR | 채널 소유 표와 preload 전송 선택 — §10 EP-8 | NEW | — |
| AR-07 | AR | 호스트 쪽 창 참조(`ClientRef`)와 통지 전송 — §10 EP-9 | CHANGED | `infra/ipc/send.ts` 의 `WebContents` 전송 |
| AR-08 | AR | 셸 서비스 계약 — §10 EP-10 | NEW | — |
| AR-09 | AR | 수명 이벤트 계약 — §10 EP-11 | NEW | — |
| AR-10 | AR | 셸·호스트 import 경계 — §10 EP-1 (e)(f) | NEW | — |
| MD-06 | MD | 수명 상태 축약(`LifecycleState`) — §11 | NEW | — |
| MD-07 | MD | 고아 프로세스 선별 — §11 | NEW | — |
| SD-05 | SD | 턴 이벤트 파이프라인 구독 순서(usage → history → title → relay) | INHERITED | `features/chat/turn-coordinator.test.ts` |
| SD-06 | SD | 업데이트 재시작 게이트·트레이 상주 판정 | INHERITED | `shared/update-restart.ts` 테스트 · 0322 plan |
| AR-01 | AR | 계산 클라이언트 ↔ 워커 메시지 계약 — §10 EP-3 | NEW | — |
| AR-02 | AR | main 감독자 ↔ 호스트 ↔ renderer 클라이언트 계약 — §10 EP-5·EP-6 | NEW | — |
| AR-03 | AR | IPC 등록 함수의 계측 경계 — §10 EP-2 | NEW | — |
| AR-04 | AR | 가드가 보는 소스 집합과 등록 표 — §10 EP-1 | NEW | — |
| AR-05 | AR | 세션 로드 응답 계약(`SessionLoadTicket`) — §10 EP-4 | CHANGED | `shared/ipc.ts` 의 `LoadedSession`·`RefreshSessionResult` |
| MD-01 | MD | 계산 대기열(순서·취소·교체·캐시·실패 차단) — §11 | NEW | — |
| MD-02 | MD | 조각 분할과 조립 — §11 | NEW | — |
| MD-03 | MD | 멈춤 판정(50/160, 창당 1건) — §11 | NEW | — |
| MD-04 | MD | 가드 판정(이름 집합·등록 개수·import 종류) — §11 | NEW | — |
| MD-05 | MD | 상한 판정(`diffLinesWithinCap`·강조 32,000자) — §11 | NEW | — |
| SD-03 | SD | 세션 로드 중 라이브 이벤트 보호(`isCurrent`·`liveChanged`) | INHERITED | `chatStore.ts:1782~1790` · `chatStore.native-history.test.ts` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `docs/INDEX.md` → `execution-model.md` → 두 `AGENTS.md` | `gate:node scripts/check-doc-inventory.mjs --check` | not selected — 문서 대조 | 0 + 문서 산출 |
| VP-02 | R-02 ↔ AT-02~04 | REQUIRED | 소스 트리 → `check-ui-thread.mjs` → exit code → `ci.yml` | 신규 `scripts/check-ui-thread.test.mjs` — 규칙 11종 × 분기(§10 EP-1 규칙 칸) | required — 0건 가드라 눈이 있는지 확인. 변이: 등록 표에서 1행 삭제 → red | EP-1 (11) |
| VP-03 | R-03 ↔ AT-05~07 | REQUIRED | 멈춤 → 모니터/등록 함수/리포터 → 로거 | AC5·AC6·AC7 의 세 테스트 파일 | not selected — 값 단언 | EP-2 (7) |
| VP-04 | R-04 ↔ AT-08~14 | REQUIRED | 컴포넌트 → 훅 → `computeClient` → 워커 → 응답 → 상태 | AC8~AC14 의 테스트 | not selected — 행동 단언 | EP-3 (9) |
| VP-05 | R-05 ↔ AT-15~20 | REQUIRED | 클릭 → `sessionApi.load` → 에이전트 호스트 티켓 → 데이터 호스트 → 조각 → 조립 → `LOAD_SESSION` | AC15~AC20 의 테스트 | not selected — 동치·값 단언 | EP-4 (3) · EP-5 (2) · EP-6 (5) |
| VP-06 | R-06 ↔ AT-21 | REQUIRED | **rev 3 에서 §7-B 의 VP-06′ 로 대체** | — | — | EP-7′ (3) |
| VP-07 | R-07 ↔ AT-22·23 | REQUIRED | 실제 앱 | 사람 실기 §19 | not selected | 0 + 실기 |
| VP-08 | SD-01 ↔ ST-01 | REQUIRED | 요청 → 대기 → 전송 → 응답/취소/실패 → 소비자 상태 | `client.test.ts` — 수명주기 전이 6종(전송·응답·대기 취소·실행 취소·실패·차단) | not selected | EP-3 과 공유 |
| VP-09 | SD-02 ↔ ST-02 | REQUIRED | 티켓 → 포트 → begin → chunk* → end / cancel / exit | `session-load.test.ts` + `dataHostClient.test.ts` + `host-supervisor.test.ts` | not selected | EP-5·EP-6 과 공유 |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | `client.ts` ↔ `compute.worker.ts` 메시지 | 신규 `shared/compute/worker/handler.test.ts` — 요청 3종을 실제 처리 함수에 넣어 응답 형식을 `client` 의 파서로 읽음 | not selected | EP-3 (종류 3) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | `dataHostClient` ↔ `session-load` 서비스 메시지 | `session-load.test.ts` — 서비스가 낸 메시지를 `dataHostClient` 조립기에 그대로 넣음 | not selected | EP-6 (5) |
| VP-12 | AR-03 ↔ IT-03 | REQUIRED | `ipcMain.handle` 등록 → 계측 → 핸들러 | `handle.test.ts` — 세 등록 함수 | required — 등록 함수 하나만 계측해도 대표 테스트는 통과. 변이: `handlePlain` 의 계측 제거 → red | EP-2 (7) |
| VP-13 | AR-04 ↔ IT-04 | REQUIRED | 실제 트리 → 가드 | `gate:node scripts/check-ui-thread.mjs` 를 실제 트리에 실행 → exit 0 | not selected | EP-1 (11) |
| VP-14 | AR-05 ↔ IT-05 | REQUIRED | `handlers/session.ts` → preload → `shared/api/ipc.ts` | `session.load.test.ts` + `preload/index.test.ts` | not selected | EP-4 (3) |
| VP-15 | MD-01 ↔ UT-01 | REQUIRED | `client.ts` 내부 | `client.test.ts` | not selected | EP-3 과 공유 |
| VP-16 | MD-02 ↔ UT-02 | REQUIRED | `data-host-chunks.ts` | `data-host-chunks.test.ts` — 규칙 칸 분기 4종(§10 EP-6) | not selected | EP-6 과 공유 |
| VP-17 | MD-03 ↔ UT-03 | REQUIRED | `stall-monitor.ts` | `stall-monitor.test.ts` — 49/50/159/160 | not selected | EP-2 과 공유 |
| VP-18 | MD-04 ↔ UT-04 | REQUIRED | `check-ui-thread.mjs` | `check-ui-thread.test.mjs` | VP-02 와 같다 | EP-1 과 공유 |
| VP-19 | MD-05 ↔ UT-05 | REQUIRED | `inline.ts` · `CodeBlock.tsx` | `inline.test.ts` — 400/401 · `CodeBlock.render.test.ts` — 32,000/32,001 | not selected | EP-3 과 공유 |
| VP-21 (EP-10 은 §7-B 의 EP-10′) | R-08 ↔ AT-24~33 | REQUIRED | 창 → preload → 호스트 포트 → 핸들러 → 버스 → 창 포트 / 셸 서비스 / 수명 통지 | AC24~AC33 의 테스트 | required — 채널 소유 표가 한쪽으로 쏠려도 대표 테스트는 통과. 변이: 호스트 채널 1개를 `'shell'` 로 → `preload/index.test.ts` red | EP-8 (3) · EP-9 (4) · EP-10 (8) · EP-11 (5) |
| VP-32 | R-09 ↔ AT-34·35 | REQUIRED | 문서 경로 표 ↔ 가드 규칙 표 ↔ 실제 트리 | `check-ui-thread.test.mjs` — 규칙 (g)~(k) 분기(§10 EP-1 규칙 칸) + 문서 대조 케이스 | required — 0건 가드. 변이: 규칙 (h) 의 허용 경로를 `src/renderer/src/**` 로 넓힘 → 위반 픽스처 케이스 red | EP-1 (11) |
| VP-22 | SD-04 ↔ ST-04 | REQUIRED | fork → ready → connect → exit → 고아 정리 → 통지 → 재 fork → shutdown | `host-supervisor.test.ts` — 전이 7종 | not selected | EP-12 (4) |
| VP-23 | AR-06 ↔ IT-06 | REQUIRED | `CHANNELS` → `channel-owner.ts` → preload `invoke` 선택 → 셸 `handle` / 호스트 `handle` | `gate:npm run typecheck`(표의 전수) + `preload/index.test.ts` + 신규 `channel-registration.test.ts` — 표의 소유자와 실제 등록 프로세스의 차집합 0 | not selected | EP-8 (3) |
| VP-24 | AR-07 ↔ IT-07 | REQUIRED | `sendChatEvent`·`broadcast*` → `ClientRef.send` → preload 구독 분배 | `send.test.ts` + `preload/index.test.ts` | not selected | EP-9 (4) |
| VP-25 | AR-08 ↔ IT-08 | REQUIRED | 호스트 어댑터 → 셸 서비스 포트 → Electron API | `services.test.ts` — 호스트 쪽 클라이언트와 셸 쪽 서버를 한 채널로 묶어 8종 왕복 | not selected | EP-10 (8) |
| VP-26 | AR-09 ↔ IT-09 | REQUIRED | 호스트 버스·종료 감시 → 수명 통지 → `LifecycleState` → 소비자 | `lifecycle-state.test.ts` + 호스트 쪽 `lifecycle-emitter.test.ts` — 정규화 이벤트 열 → 수명 이벤트 열 | not selected | EP-11 (5) |
| VP-27 | AR-10 ↔ IT-10 | REQUIRED | 실제 트리 → 가드 (e)(f) | `gate:node scripts/check-ui-thread.mjs` | VP-02 와 같다 | EP-1 (11) |
| VP-28 | MD-06 ↔ UT-06 | REQUIRED | `lifecycle-state.ts` | `lifecycle-state.test.ts` — §10 EP-11 규칙 칸 분기 | not selected | EP-11 과 공유 |
| VP-29 | MD-07 ↔ UT-07 | REQUIRED | `orphans.ts` | `orphans.test.ts` — 부모 일치·불일치·손자·빈 목록 | not selected | EP-12 와 공유 |
| VP-30 | SD-05 ↔ ST-05 | REGRESSION | 호스트로 옮긴 뒤의 `turn.event` 구독 순서 | 기존 `turn-coordinator.test.ts` 순서 회귀 케이스 | not selected | 0 + 기존 보호 재사용 |
| VP-31 | SD-06 ↔ ST-06 | REGRESSION | 수명 상태 → 재시작 게이트·트레이 종료 판정 | 기존 `update-restart` 테스트 · `tray-residency` 테스트 — 입력원만 `LifecycleState` 로 | not selected | 0 + 기존 보호 재사용 |
| VP-20 | SD-03 ↔ ST-03 | REGRESSION | 로드 대기 중 라이브 이벤트 → `liveChanged` → 로드 결과 폐기 | 기존 `chatStore.native-history.test.ts` · `chatStore.listen.test.ts` — 전송 수단만 바뀐 뒤에도 green | not selected | 0 + 기존 보호 재사용 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app` subtree | `app/**` 를 고친다 | `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` | 이번 변경이 만든 실패만 |
| 가드 스크립트 | 테스트와 스크립트를 더한다 | `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · 신규 `check-ui-thread` | 같다 |
| 문서 | `docs/arch`·`IPC_CONTRACT.md`·`docs/INDEX.md` 를 고친다 | `check-doc-inventory --check` | 같다 |
| message-bus | handoff 산출 | 커밋 trailer 파싱 확인 · `INDEX.md` 행 | 같다 |

## 7-B. V1 rev 3 정정 — `PLAN_GAP` 3건 (턴 11)

r1·r1.2 구현 턴이 올린 `PLAN_GAP` 세 건의 규범 행이다. 이 절이 가리키는 구 행(AC21 · VP-06 · EP-7 · EP-10 의 분모 · §11 단계 6)은 이 절로 대체되고, 나머지 행은 rev 2 그대로다.

### 조사

| 대상 | 검색 / 방법 | N | 의미 |
|---|---|---:|---|
| 카탈로그 결과의 동기 소비 자리 | `rg -n "nativePlugins\|nativePluginFlags" app/src/main/adapters/claude/adapter.ts` | 4곳 | `:617` flags · `:671-684` query 옵션 · `:835` `claudeNativeResources` · `:850` `ClaudeProjectReconciliation` — 채널 조립이 동기라 읽기를 조립 앞으로 빼야 한다 |
| 어댑터 spawn 호출부 | `rg -n "\.sendMessage\(" app/src/main --glob '!*.test.*' --glob '!*.testfixture.*'` | 1 | `features/sessions/session-runtime.ts:496` — 준비 단계를 부를 유일한 자리 |
| `plugin-catalog.ts` 의 동기 API | `rg -n "Sync\(" app/src/main/adapters/claude/plugin-catalog.ts` | 4 | `:112` `claudeInstallationExists` · `:122`·`:124` `pluginFiles` · `:310` 동기 카탈로그 |
| `claudeInstallationExists` 소비처 | `rg -n "claudeInstallationExists" app/src/main --glob '!*.test.*'` | 3줄 | 정의 1 · 동기 카탈로그 1 · `configured-resources.ts:133` 1 |
| `electron-store` 생성 자리 | `rg -n "new Store<" app/src/main --glob '!*.test.*'` | 3 | `infra/settings-store.ts:42` · `infra/config/secret-store.ts:12` · `features/auth/store-file.ts:60` |
| utility 형상에서 `electron-store@8.2.0` | `electron` 을 `{ net }` 로 바꿔 끼운 Node 프로브 | 3케이스 | `cwd`+버전 → 그 디렉토리 · `cwd` 만 → 그 디렉토리 · 둘 다 없음 → 예외 없이 `~/.config/electron-store-nodejs/` |
| 셸에 남는 코드의 설정 접근 | `rg -n "settings\.(getAll\|patch\|onPatch)\b\|deps\.settings\." app/src/main/index.ts app/src/main/app/tray-residency.ts` | 4 | `index.ts:160`(창 위치 읽기)·`:202`(저장) · `tray-residency.ts:73`(언어)·`:85`(변경 구독) |
| `windowBounds` 의 소비자 | `rg -n "windowBounds" app/src --glob '!*.test.*'` | 5줄 | 타입 1 · 스키마 2 · `index.ts` 2 — renderer 소비 0 |
| Electron 값 import 파일(재실행) | §8 과 같은 `rg -l … -P` | 18 | rev 2 의 17 + `app/error-report-sink.ts`(`webContents`) |

### Requirements / Acceptance — rev 3

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-06 | AT-21′ / AC21′ | 새 채널을 띄우는 턴은 어댑터의 준비 단계에서 플러그인 카탈로그를 비동기로 읽은 뒤 판정하고 띄운다. 카탈로그 결과는 지금과 같다. 준비가 실패하거나 준비 중 취소되면 띄우지 않는다 | `session-runtime` 테스트 — EP-7′ 규칙 칸 6분기 · `adapters/claude` 카탈로그 테스트를 비동기 진입점으로(같은 픽스처에서 같은 카탈로그) · 가드 (a) 에서 `plugin-catalog.ts` 등록 0 | `chat:send` → `SessionRuntime` 스폰 경로 → `adapter.prepareTurn` → `sendMessage` |
| R-10 | AT-36 / AC36 | 창 위치는 main 의 셸 상태 파일에 저장되고 다음 실행에서 복원된다. main 은 설정 파일을 쓰지 않는다. 셸 상태 파일이 없는 첫 실행은 기존 설정 파일의 창 위치와 언어를 이어받는다 | `app/shell/shell-state.test.ts` — EP-14 규칙 칸 5분기 · 가드 (e) — 셸 그래프에 `infra/settings-store` 값 import 0 | `index.ts` `createWindow` → `ShellState` |
| R-10 | AT-37 / AC37 | 호스트가 여는 설정·비밀·인증 파일은 주입받은 `userData` 경로 아래에 있다. `cwd` 없이 `electron-store` 를 만드는 코드는 가드에서 실패한다 | 세 스토어 각각의 테스트 — 임시 디렉토리를 `cwd` 로 주고 쓴 뒤 그 디렉토리의 파일 이름을 단언 · 가드 (l) 분기 4종 | 호스트 `entry.ts` 의 fork 인자 → `Bootstrap` → 세 스토어 |
| R-10 | AT-38 / AC38 | 트레이 메뉴 라벨은 호스트가 알린 UI 언어를 따른다. 호스트가 뜨기 전에는 마지막으로 알려진 언어다 | `shell-state.test.ts` — 언어 알림 → 저장값과 구독자 호출 · 기존 `tray-residency` 테스트(입력원만 `ShellState`) · `lifecycle-emitter.test.ts` — `uiLocale` 패치 → 알림 1건, 다른 키 패치 → 0건 | 호스트 `SettingsStore.onPatch` → 셸 알림 → `ShellState` → `tray-residency` |

AC 총수는 35 → **38** 이다(AC21 은 AC21′ 로 대체, AC36·37·38 추가).

### Node · Pair — rev 3

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-10 · AT-36~38 | R · AT | 위 표 | NEW | — |
| AR-11 | AR | 어댑터 준비 단계 포트(`prepareTurn`) — EP-7′ | NEW | — |
| AR-12 | AR | 영속 파일의 소유 프로세스와 경로 주입 — EP-13·EP-14 | NEW | — |
| MD-08 | MD | 셸 상태의 읽기·이관·사본 갱신 — EP-14 규칙 칸 | NEW | — |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-06′ | R-06 ↔ AT-21′ | REQUIRED | `chat:send` → `SessionRuntime` 스폰 → `prepareTurn` → 판정 → `sendMessage` → `openChannel` | 자리 1: 신규 `session-runtime.prepare.test.ts`(가짜 어댑터, 6분기) · 자리 2: `plugin-catalog.test.ts` 비동기 진입점 · 자리 3: `adapter.native-plugins.test.ts` — 준비 결과의 플러그인이 query 옵션에 실림(픽스처 플러그인 ≥ 1, 빈 카탈로그와 구별) | required — 준비 결과를 버리고 빈 카탈로그로 조립해도 스폰은 성공한다. 변이: `openChannel` 이 준비 결과 대신 빈 카탈로그를 씀 → 자리 3 red | EP-7′ (3) |
| VP-33 | R-10 ↔ AT-36~38 | REQUIRED | `createWindow` ↔ `ShellState` ↔ 파일 / 호스트 `onPatch` → 알림 → `ShellState` → 트레이 | AC36~AC38 의 테스트 | not selected — 값 단언 | EP-13 (3) · EP-14 (6) |
| VP-34 | AR-11 ↔ IT-11 | REQUIRED | `SessionRuntime` ↔ `SessionAdapter.prepareTurn` ↔ `TurnRequest.prepared` | `session-runtime.prepare.test.ts` — 준비가 돌려준 값이 `sendMessage` 인자의 `prepared` 로 그대로 간다(식별 가능한 객체) | not selected | EP-7′ 과 공유 |
| VP-35 | AR-12 ↔ IT-12 | REQUIRED | fork 인자 `userData` → `Bootstrap` → 세 스토어 생성 · 실제 트리 → 가드 (l) | 세 스토어 테스트 + `gate:node scripts/check-ui-thread.mjs` | required — 0건 가드. 변이: `secret-store.ts` 의 `cwd` 전달 제거 → 가드 (l) red | EP-13 (3) |
| VP-36 | MD-08 ↔ UT-08 | REQUIRED | `shell-state.ts` | `shell-state.test.ts` — EP-14 규칙 칸 | not selected | EP-14 와 공유 |

### 강제 지점 — rev 3

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-11 / VP-06′·34 **EP-7′** | 스폰 전 비동기 읽기는 준비 단계에서 한다 | `adapters/common/types.ts` 의 `prepareTurn` | `SessionRuntime` · Claude 어댑터 | 3자리 — `session-runtime.ts` 스폰 경로의 `prepareTurn` 호출(판정 앞) · Claude 어댑터 `prepareTurn` 의 비동기 카탈로그 읽기 · `openChannel` 의 준비 결과 소비 | 구현 뒤 `rg -n "prepareTurn\|\.prepared\b" app/src/main --glob '!*.test.*'` | 턴 시작마다 디렉토리 순회가 호스트의 스트림을 막는다 / 준비 결과가 버려져 플러그인 없이 뜬다 |
| AR-08 / VP-21·25 **EP-10′** | 권한 작업은 셸 서비스로만 | `shared/host-protocol.ts` | 호스트·셸 | 8자리 — rev 2 EP-10 과 같다. 분모만 정정한다: Electron 값 import **18파일** = 셸 전용 1(`index.ts`) + 전송 3(`infra/ipc/{handle,send}.ts`·`app/error-report-sink.ts` — EP-9) + 호스트 허용 1(`infra/net/net-fetch.ts`) + 서비스 어댑터 13 | §8 의 `rg -l … -P` → 18, 네 묶음의 합 18, 미배정 0 | 호스트가 없는 API 를 불러 기동 중 죽는다 |
| AR-12 / VP-33·35 **EP-13** | 호스트의 영속 파일은 주입된 `userData` 아래 | 호스트 `entry.ts` 의 fork 인자 | 호스트 | 3자리 — `infra/settings-store.ts:42` · `infra/config/secret-store.ts:12` · `features/auth/store-file.ts:60` | `rg -n "new Store<" app/src/main --glob '!*.test.*'` → 구현 뒤 4(셸 상태 1 포함), 모두 `cwd` 있음 | 설정·비밀·인증이 예외 없이 다른 디렉토리에 새로 생긴다 — 사용자는 로그아웃·설정 초기화로 본다 |
| AR-12 / VP-33·36 **EP-14** | 셸이 쓰는 상태는 셸 상태 파일 하나다 | `app/shell/shell-state.ts` | 셸 · 호스트(언어 알림) | 6자리 — `index.ts` 창 위치 읽기 · 닫을 때 저장 · 트레이의 언어 읽기 · 트레이의 변경 구독 · 호스트 `ready` 페이로드의 `uiLocale` · 호스트 `onPatch` 의 언어 알림 | 구현 뒤 `rg -n "shellState\.\|shell\.mirror" app/src/main --glob '!*.test.*'` | 두 프로세스가 같은 파일을 덮어쓴다 / 트레이가 옛 언어로 남는다 |

**EP-7′ 규칙 칸** (`session-runtime.prepare.test.ts` 입력 — 분기마다 1개):

| 분기 | 기대 |
|---|---|
| 준비 성공 → 판정 통과 | `sendMessage` 1회, 인자의 `prepared` 가 준비 반환값과 같은 객체 |
| 준비 성공 → `canSubmitInitial()` 가 false | `sendMessage` 0회 · `rollbackInitialSubmission` 1회 · `submission_stale:before-spawn` |
| 준비 reject | `sendMessage` 0회 · `rollbackInitialSubmission` 1회 · 같은 오류가 호출자에게 전파 · `engine.spawn.started` 로그 0건 |
| 준비 중 취소(런타임 취소·dispose) | `sendMessage` 0회 · `rollbackInitialSubmission` 1회 · 준비에 넘긴 `AbortSignal` 이 abort |
| `prepareTurn` 이 없는 어댑터 | 지금과 같다 — `sendMessage` 1회, `prepared` 없음 |
| 살아 있는 채널의 `pushTurn` 경로 | `prepareTurn` 0회 |

- Claude 어댑터의 `openChannel` 은 `prepared` 가 없으면 던진다 — 동기 읽기로 대신하지 않는다(D-009 와 같은 원칙).
- 판정(`canSubmitInitial`)과 `sendMessage` 사이에는 지금처럼 `await` 가 없다. 준비와 판정 사이에 바뀐 상태는 판정이 본다.
- `claudeInstallationExists` 는 남은 소비처 `configured-resources.ts` 로 옮기고 가드 (a) 등록 표에 `{ count: 1, class: 'single-file' }` 로 올린다 — `plugin-catalog.ts` 의 등록은 0 이다.

**EP-14 규칙 칸** (`shell-state.test.ts` 입력):

| 분기 | 기대 |
|---|---|
| 셸 상태 파일에 창 위치 있음 | 그 값을 돌려준다. 기존 설정 파일을 읽지 않는다 |
| 셸 상태 파일 없음 · 기존 설정 파일에 `windowBounds`·`uiLocale` 있음 | 두 값을 이어받아 셸 상태 파일에 쓴다. 설정 파일은 바뀌지 않는다(바이트 동일) |
| 둘 다 없음 · 설정 파일이 JSON 이 아님 | 창 위치 `null` · 언어 기본값. 예외 없음 |
| 창 위치 저장 | 셸 상태 파일의 `windowBounds` 만 바뀐다 |
| 언어 알림(같은 값 / 다른 값) | 같은 값 → 쓰기 0·구독자 0 · 다른 값 → 저장 1·구독자 1 |

**가드 규칙 (l)** — EP-1 의 규칙은 11 → 12종이고 경로 표에 행이 하나 는다:

| 규칙 | 분기 | 기대 |
|---|---|---|
| (l) 영속 파일 | 등록 4파일(`infra/settings-store.ts`·`infra/config/secret-store.ts`·`features/auth/store-file.ts`·`app/shell/shell-state.ts`) 밖의 `electron-store` 값 import | exit 1 |
| (l) | 등록 파일의 `new Store({ …, cwd })` — 인자가 객체 리터럴이고 `cwd` 속성이 있다 | exit 0 |
| (l) | 등록 파일의 `new Store({ … })` — `cwd` 없음 | exit 1 |
| (l) | 인자가 객체 리터럴이 아니거나 스프레드만 있다 | exit 1 (fail-closed) |

| 하려는 일 | 요청하는 곳 | 경로 | 직접 하면 걸리는 규칙 |
|---|---|---|---|
| 설정·비밀·인증을 파일에 둔다 | 에이전트 호스트의 세 스토어(창 상태는 셸의 `ShellState`) | 주입받은 `userData` 를 `cwd` 로 | (l) |

**선언 경계** (rev 3 추가):

- B12 — 설정 스키마의 `windowBounds` 키는 남는다: 호스트는 읽지도 쓰지도 않고 값은 이관 시점에 멈춘다. 스키마에서 지우는 일은 `settings-migration` 변경이라 이 handoff 밖이다.
- B13 — 준비 단계와 스폰 사이에 디스크의 플러그인 설정이 바뀌면 그 턴은 준비 시점의 카탈로그로 뜬다. 지금도 스폰 뒤의 변경은 `ClaudeProjectReconciliation` 이 맡는다.
- B14 — 셸 상태 파일의 언어 사본은 호스트가 알리기 전까지 옛 값이다(다른 경로로 설정 파일이 바뀐 경우). 호스트 `ready` 가 바로잡는다.

### 구현 설계 — rev 3

| 단계 | 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|---|
| 6′ | `adapters/common/{types,turn}.ts` | 준비 단계 포트 | `SessionAdapter.prepareTurn?(req, signal): Promise<unknown>` · `TurnRequest.prepared?: unknown` | typecheck |
| 6′ | `features/sessions/session-runtime.ts` | 준비 → 판정 → 스폰 | 스폰 경로에서 `canSubmitInitial` 앞에 `await adapter.prepareTurn?.(…)`. 취소는 준비에 넘긴 `AbortSignal` 로 전달하고, 끝난 뒤 취소 상태면 롤백하고 던진다 | 신규 `session-runtime.prepare.test.ts`(가짜 어댑터) |
| 6′ | `adapters/claude/{adapter,plugin-catalog,configured-resources}.ts` | 비동기 카탈로그 | `prepareTurn` 이 `readClaudePluginCatalogAsync` 를 부른다. `openChannel` 은 `req.prepared` 를 쓴다. 동기 `readClaudePluginCatalog`·`pluginFiles` 삭제, `claudeInstallationExists` 이동 | 기존 카탈로그·native-plugins 테스트 |
| 4 | `app/shell/shell-state.ts` | 셸 상태 | 신규. `{ windowBounds, uiLocale }` 을 `<userData>/<slug>-shell-state.json` 에 둔다. 저장소(`get`/`set`)와 기존 설정 파일 읽기 함수를 주입받는 순수 코어 + `electron-store` 배선 | 순수 단위 |
| 4 | `src/main/index.ts` · `app/tray-residency.ts` | 소비 | `createWindow`·트레이가 `ShellState` 를 받는다(`tray-residency` 의 구조 포트는 그대로 만족) | 기존 테스트 |
| 4 | `infra/settings-store.ts` · `infra/config/secret-store.ts` · `features/auth/store-file.ts` · `app/bootstrap.ts` | 경로 주입 | 세 생성자가 `cwd` 를 필수 인자로 받는다. `Bootstrap` 이 fork 인자의 `userData` 를 넘긴다 | 스토어별 단위(임시 디렉토리) |
| 4 | `shared/host-protocol.ts` · `app/agent-host/lifecycle-emitter.ts` | 언어 알림 | 호스트 → 셸 메시지 `shell.mirror{ uiLocale }` 1종. `ready` 페이로드에도 싣는다 | `lifecycle-emitter.test.ts` |
| 2 | `scripts/{check-ui-thread,ui-thread-rules}.mjs` | 가드 (l) | 규칙·등록 표·안내 메시지 추가 | `node --test` |

- 저장소 분해(다중 쓰기): 창 위치 이관은 셸 상태 파일 **하나**에만 쓴다. 설정 파일은 읽기만 하므로 중간에 죽어도 다음 실행이 같은 이관을 다시 한다 — 허용할 수 없는 조합이 없다.
- 부팅 순서: 셸 상태 파일은 창 생성 전에 연다(작은 JSON 1개, 가드 (a) 의 `boot` 등록). 호스트의 준비를 기다리지 않는다.

### READY self-review — rev 3 (관측)

- 사용자 결정 복원: D-029 는 원문을 그대로 인용했고 "창 위치 같은 개념"을 셸이 실제로 쓰는 값 둘(`windowBounds`·`uiLocale` 사본)로 한정했다 — 근거는 조사 표의 "셸에 남는 코드의 설정 접근" 4줄.
- 분모 재열거: EP-7′ 3 · EP-13 3 · EP-14 6 · EP-10′ 8(파일 18 = 1+3+1+13). 검색 명령은 표의 그 칸.
- 규칙 칸 ↔ 입력 칸: EP-7′ 6분기 ↔ `session-runtime.prepare.test.ts` 6케이스 · EP-14 5분기 ↔ `shell-state.test.ts` 5케이스 · (l) 4분기 ↔ `check-ui-thread.test.mjs` 4케이스.
- NEW node ↔ REQUIRED pair: R-10 ↔ VP-33 · AR-11 ↔ VP-34 · AR-12 ↔ VP-35 · MD-08 ↔ VP-36. 대체된 VP-06 의 증거(카탈로그 동치 테스트 · 가드 등록 0)는 VP-06′ 자리 2 와 AC21′ 에 그대로 있다.
- 기존 규칙과의 관계: `app/AGENTS.md` 의 "`electron-store` 는 채택된 의존성" — 새 의존성 0. `security.md` §1.4-b — 비밀 파일의 위치는 그대로 `userData` 다.
- 사람 실기: 추가 없음. 창 위치 복원의 실제 화면은 기존 AC23 실기 시나리오가 앱을 두 번 띄울 때 본다.

## 7-C. V1 rev 3.1 정정 — 전송 계층의 자리 (r1.4 `PLAN_GAP`)

r1.4 구현 턴이 올린 규범 행 차이 다섯 건이다. 이 절이 가리키는 구 행(EP-1 의 (d)·(g)·(l) 허용 파일 · EP-9 의 SSOT · EP-10′ 의 묶음)은 이 절로 대체되고, AC·pair·나머지 행은 rev 3 그대로다.

### 조사

| 대상 | 검색 / 방법 | N | 의미 |
|---|---|---:|---|
| `infra` 가 `contracts` 를 import 할 수 있는가 | `app/src/main/AGENTS.md` 레이어 DAG | 불가 | `infra/ipc/{handle,send}.ts` 가 창 참조 타입을 쓰므로 정의는 infra 에 있어야 한다 |
| 호스트에서 닿는 `infra/ipc/handle.ts` 의 `electron` 값 import | 가드 (f) 규칙 칸 — 등록 밖 `electron` 값 import 는 exit 1 | 1 | `handle.ts` 가 `ipcMain` 을 물면 호스트 그래프가 (f) 에 걸린다 — `ipcMain` 은 셸 전용 파일로 가야 한다 |
| Electron 값 import 파일(여러 줄 import 포함) | `rg -l "^import (?!type).*from 'electron'" -P app/src/main --glob '!*.test.*'` → 16 · 여러 줄 import 1(`infra/ipc/electron-transport.ts`) | 17 | 한 줄 정규식은 여러 줄 import 를 놓친다 — 분모는 가드 (f) 의 AST 목록(`--list`)이 정본이다 |
| `electron-store` 를 무는 파일 | `rg -l "from 'electron-store'" app/src/main --glob '!*.test.*'` | 4 | 셸 상태의 배선은 `app/shell/shell-state-file.ts` 다(r1.3 — `shell-state.ts` 는 판정만 갖고 vitest 가 import 한다) |
| 창 수명 이벤트를 쓰는 자리 | `rg -n "onClosed\(" app/src/main --glob '!*.test.*' --glob '!*.testfixture.*' --glob '!infra/ipc/*'` | 5 | `chat-turn/send.ts` 2 · `handlers/composer-catalog.ts` 1 · `handlers/session-resources.ts` 1 · `error-report-drain.ts` 1 |

### 강제 지점 — rev 3.1

| V node / pair | 계약/필드 | SSOT | 정정 |
|---|---|---|---|
| AR-07 / VP-24 **EP-9** | 창 참조 `ClientRef`·`RequestEvent` | `infra/ipc/transport.ts` (`contracts/client.ts` 는 re-export) | 정의 위치만 바뀐다. 4자리는 그대로다 |
| AR-07 **EP-9** | 창 참조의 닫힘 | `ClientRef.onClosed` | 닫힘 = 창 파괴 · renderer 프로세스 종료 · 최상위 문서가 새로 읽힘. 포트 전송에서는 문서를 새로 읽으면 포트가 끊기므로 셸 전송도 같은 뜻으로 맞춘다. 닫힌 참조로의 전송은 버리고 새 문서는 새 참조를 받는다 |
| AR-04 **EP-1 (d)** | `ipcMain` 직접 등록 | `ui-thread-rules.mjs` `ALLOWED.d` | 허용 파일 = `infra/ipc/electron-transport.ts` 하나. 등록 API 는 `handle.ts` 의 `handle`·`handlePlain`·`on` 그대로이고, `handle.ts` 가 `ipcMain` 을 직접 써도 exit 1 이다 |
| AR-04 **EP-1 (g)** | 창 통지 전송 모듈 | `ALLOWED.g` | `infra/ipc/electron-transport.ts` 추가(셸의 `webContents.send`) |
| AR-04 **EP-1 (l)** | 영속 파일 등록 | `ALLOWED.l` | 등록 4파일의 넷째는 `app/shell/shell-state-file.ts` 다 |
| AR-08 **EP-10′** | Electron 값 import 파일의 묶음 | 가드 (f) `--list` | 전송 묶음 = `infra/ipc/electron-transport.ts`·`app/error-report-sink.ts`. `infra/ipc/{handle,send}.ts` 는 Electron 을 import 하지 않는다. 분모는 한 줄 `rg` 가 아니라 가드 (f) 의 목록으로 센다 |

**EP-9 규칙 칸 — 셸 전송의 창 참조** (`infra/ipc/electron-transport.test.ts` 입력):

| 분기 | 기대 |
|---|---|
| 같은 창의 두 번째 요청 | 같은 참조 · id 는 창 id |
| 창 파괴 / renderer 종료 / 최상위 문서 새로 읽힘 | 닫힘 1회 통지 · `isClosed()` true · 창에 건 리스너 0 |
| 같은 문서 안 이동 / 하위 프레임 이동 | 닫힘 아님 |
| 문서가 새로 읽힌 뒤의 요청 | 새 참조(같은 id) · 옛 참조로의 전송 0 |
| 닫힌 참조에 구독 | 즉시 호출 |
| 구독 없이 방송만 받는 창 | 창에 리스너를 달지 않는다 |

**선언 경계** (rev 3.1 추가):

- B15 — 개발 중 renderer 를 새로 읽으면(HMR 전체 새로고침·Ctrl+R) 그 창이 소유한 진행 중 턴은 취소로 끝난다. 지금까지는 턴이 계속 돌고 새 문서가 이벤트를 받았다. 패키징된 앱은 새로고침 단축키가 막혀 있다(`optimizer.watchWindowShortcuts`).
- B16 — 가드 (g) 는 `wc`·`webContents` 의 `.send(` 를 본다: `ClientRef.send(` 를 `send.ts` 밖에서 직접 부르는 것(`handlers/composer-catalog.ts`·`session-resources.ts` 의 2곳)은 잡지 못한다. 두 곳은 rev 2 이전부터 `event.sender.send` 였다.

### 열린 설계 항목 — §7-D(rev 3.2)에서 닫았다

- 수명 이벤트의 원천(EP-11): 합성 `error`·`turn.retrying`·`message.committed` 는 버스를 타지 않고 coordinator 의 `forward` sink 로 간다(`app/src/main/AGENTS.md` 단일 턴 이벤트 파이프라인). §11 "호스트 버스의 정규화 이벤트에서 만든다"만으로는 오류로 끝난 턴의 `turn.ended` 를 만들 수 없다. `lifecycle-emitter` 의 입력을 버스 구독 + 런타임 감독자(lease 해제) 중 무엇으로 할지 정해야 한다 — 그때까지 `lifecycle-emitter` 는 만들지 않는다.
- 파일 작업 요청의 신뢰 판정(`RequestEvent.trusted`): 셸 전송은 요청마다 최상위 프레임을 본다. 포트 전송에서는 셸이 포트를 넘길 때 한 번 판정해 연결에 싣는다 — 단계 4 의 호스트 포트 서버가 이 값을 받는 자리가 §10 에 없다.

## 7-D. V1 rev 3.2 정정 — 수명 이벤트의 원천 · 포트 연결의 신뢰 판정 (§7-C 열린 항목 2건)

§7-C 의 열린 설계 항목 둘을 닫는다. 이 절이 가리키는 구 행(§11 "에이전트 호스트의 규칙"의 수명 이벤트 행 · VP-26 oracle 의 입력 서술 · EP-9 의 자리 수)은 이 절로 대체되고, AC·pair 목록·나머지 행은 rev 3.1 그대로다.

### 조사

| 대상 | 검색 / 방법 | N | 의미 |
|---|---|---:|---|
| 재시작 게이트의 현재 입력 | `rg -n "deriveLeaseGateState\|allLeases\(" app/src/main --glob '!*.test.*'` | 정의 2 · 호출 2 | 게이트의 정본은 턴 이벤트가 아니라 **lease 집합**이다(`features/sessions/restart-gate.ts` 머리 주석 — 턴 교체 창에서 턴 0개로 보이던 결함의 교정) |
| lease 변화 통지 | `rg -n "subscribeLeases\(" app/src/main --glob '!*.test.*'` | 정의 1 · 구독 2 | `supervisor.subscribeLeases` — 획득·해제·승격마다 부른다. 오류·취소로 끝난 턴도 lease 해제를 지난다 |
| lease 의 세션 식별자 | `features/sessions/session-chain-lease.ts:27-28` | 2필드 | `logicalKey` 는 항상 있고 `sessionId` 는 승격 전 `null` 이다 |
| 승인 대기의 진입점 | `rg -n "approvals\.register\(" app/src/main --glob '!*.test.*'` | 1 | `app/chat-turn/approval.ts:73` → `ApprovalCoordinator.register` |
| 세션 폐기의 진입점 | `rg -n "onSessionDisposed" app/src/main/app/bootstrap.ts` | 1 | `bootstrap.ts` 의 `onSessionDisposed` 훅 |
| 하네스 스트림이 오류로 끊기는 자리 | `rg -n "private finishPump" app/src/main/features/sessions/session-runtime.ts` | 1 | `finishPump(err)` 의 `err != null` 분기 — 프레임이 있든 없든 채널이 오류로 내려간다 |
| 게이트의 나머지 필드 | `rg -n "activeDbWriteCount\|isIndexing" app/src/main --glob '!*.test.*'` | 대입 3 | `activeDbWriteCount` 는 `initDb` 백업 중에만 오른다(호스트 `ready` 전) · `isIndexing` 은 대입 0(상시 false) |
| 신뢰 판정의 소비 | `rg -n "\.trusted\b" app/src/main --glob '!*.test.*'` | 2 | `index.ts` 의 `Bootstrap((event) => event.trusted)` · `electron-transport.ts` 의 getter. 판정 함수는 `createArtifactSenderCheck`(셸의 창·URL 을 본다) |

### 결정

- **수명 이벤트는 버스가 아니라 네 원천에서 만든다.** `turn.started`·`turn.ended` 는 lease 집합의 변화, `approval.pending` 은 승인 등록, `session.ended` 는 세션 폐기 훅, `harness.exited` 는 채널의 오류 종료다. 근거: 게이트의 기존 정본이 lease 이고(위 표 1행), 합성 `error` 로 끝난 턴도 lease 해제는 반드시 지난다. 버스 구독 순서(VP-30)는 건드리지 않는다.
- **신뢰 판정은 셸이 포트를 넘길 때 한 번 하고 연결에 싣는다.** 판정에 필요한 창과 URL 은 셸에만 있다. 문서를 새로 읽으면 포트가 끊기고 새 문서는 새 연결을 받으므로(EP-9 닫힘 규칙) 연결당 1회 판정은 문서당 1회 판정과 같다.
- 셸의 게이트 상태는 `isGenerating = LifecycleState.hasActiveTurns()` 다. `activeToolCallCount` 는 0 으로 둔다 — 도구 실행은 lease 가 살아 있을 때만 있어 `canRestartForUpdate` 의 판정이 같다. `activeDbWriteCount` 는 호스트가 `ready` 전이면 1 이다. `isIndexing` 은 false 다.

### 강제 지점 — rev 3.2

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-09 / VP-21·26 **EP-11** | 수명 이벤트 5종의 원천 | `app/agent-host/lifecycle-emitter.ts` | 호스트 | 5자리(이벤트 종류별, 수는 그대로) — `turn.started`·`turn.ended`: `supervisor.subscribeLeases` 구독 · `approval.pending`: `ApprovalCoordinator.register` · `session.ended`: `onSessionDisposed` · `harness.exited`: `SessionRuntime.finishPump` 의 오류 분기 | 구현 뒤 `rg -n "lifecycle\.(leasesChanged\|approvalPending\|sessionEnded\|harnessExited)\(" app/src/main --glob '!*.test.*'` → 4줄(lease 1줄이 두 이벤트를 낸다) | 오류로 끝난 턴이 셸에 활성으로 남아 업데이트가 영영 설치되지 않는다 |
| AR-07 / VP-21·24 **EP-9** | 포트 연결의 신뢰 판정 | `shared/host-protocol.ts` 의 연결 메시지 | 셸 → 호스트 | 4 → **5자리** — 기존 4 + 호스트 포트 서버의 연결 등록(`RequestEvent.trusted` = 연결 메시지의 `trusted`) | 구현 뒤 `rg -n "trusted" app/src/main/app/agent-host app/src/main/app/shell --glob '!*.test.*'` | 하위 프레임·외부 문서의 요청이 파일 작업 핸들러에서 신뢰된 것으로 처리된다 |

**EP-11 규칙 칸 — 호스트 쪽** (`app/agent-host/lifecycle-emitter.test.ts` 입력 — 분기마다 1개. 대체: VP-26 oracle 의 "정규화 이벤트 열"):

| 분기 | 기대 |
|---|---|
| 세션의 lease 0 → 1 | `turn.started` 1건 |
| 같은 세션의 lease 가 그대로인 채 변화 통지 | 0건 |
| 세션의 lease 1 → 0 | `turn.ended` 1건 |
| 두 세션의 lease 가 섞여 변한다 | 세션별로 따로 — 한 세션의 해제가 다른 세션을 끝내지 않는다 |
| 승격(`sessionId` 가 `null` → 값) | 새 식별자로 `turn.started` 를 먼저, 옛 식별자(`logicalKey`)로 `turn.ended` 를 나중에 — 활성 수가 0 을 지나지 않는다 |
| 승인 등록 | `approval.pending` 1건(그 턴의 세션) |
| 세션 폐기 | `session.ended` 1건 |
| 채널이 오류로 종료 | `harness.exited` 1건 · 정상 종료(`err` 없음)는 0건 |
| `uiLocale` 패치 / 다른 키 패치 | 알림 1건 / 0건 (AC38, rev 3 그대로) |

**EP-9 규칙 칸 — 포트 연결** (`app/agent-host/port-server.test.ts` 입력):

| 분기 | 기대 |
|---|---|
| `trusted: true` 로 연결된 포트의 요청 | 핸들러가 받은 `event.trusted` 가 true |
| `trusted: false` 로 연결된 포트의 요청 | false. 요청 페이로드에 `trusted` 를 실어 보내도 false 다 |
| 같은 창 id 로 새 연결 | 옛 참조는 닫힘 1회 통지, 새 참조가 요청을 받는다 |
| 포트가 닫힘 | 닫힘 1회 통지 · 그 참조로의 전송 0 |
| 형식이 틀린 요청 메시지 / 등록 안 된 채널 | 오류 응답(`ok: false`), 핸들러 호출 0 |

**선언 경계** (rev 3.2 추가):

- B17 — 셸의 게이트는 도구 실행 수를 세지 않는다: lease 가 살아 있는 동안만 도구가 돌기 때문이다. lease 없이 도는 도구 실행은 지금 코드에 없다(`openToolRuns` 는 `lease.activeChild` 의 필드다 — `restart-gate.ts:22`).
- B18 — 신뢰 판정은 연결 시점의 값이다: 같은 문서 안 이동(해시 변경)으로는 다시 판정하지 않는다. 지금의 요청별 판정도 최상위 문서의 URL 을 볼 뿐이라 같은 문서 안에서는 결과가 같다.

### READY self-review — rev 3.2 (관측)

- `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-020·D-027 ↔ AC28(다섯 가지와 소비자는 그대로, 원천만 정했다) · D-017 ↔ 게이트가 셸에 남는다.
- 분모: EP-11 5(그대로) · EP-9 5(+1). 규칙 칸 ↔ 입력 칸: EP-11 호스트 쪽 9분기 ↔ `lifecycle-emitter.test.ts` · EP-9 포트 연결 5분기 ↔ `port-server.test.ts`.
- node·pair 변경 0: AR-07·AR-09 의 pair(VP-24·VP-26)는 그대로이고 oracle 파일에 `port-server.test.ts` 가 더해진다.
- 사용자 결정이 필요한 항목 0: 둘 다 내부 배선이고 사용자가 보는 결과는 Part I 그대로다.

---

## 7-E. V1 rev 3.3 정정 — 창 쪽 호스트 포트 클라이언트 (r1.6 `PLAN_GAP`)

r1.6 이 preload 전송을 만들려다 멈춘 자리다. §11 단계 4 의 preload 행은 "포트 재수신 시 교체하고 미응답 요청은 실패시킨다"만 적고, 포트를 실어 오는 채널 · 첫 포트 전의 요청 · 호스트가 죽은 뒤의 요청 · 재기동을 부르는 신호를 정하지 않았다. 이 절이 그 넷을 정한다. AC·pair 목록은 rev 3.2 그대로다.

### 조사

| 대상 | 검색 / 방법 | N | 의미 |
|---|---|---:|---|
| 에이전트 호스트용 채널 | `rg -n "agentHost\|agent-host" app/src/shared/ipc.ts` | 0 | §11 이 이름만 적은 `oo:agent-host:exited`·`:ready` 가 `CHANNELS` 에 없다. 재기동을 부르는 preload → 셸 신호도 없다 |
| 감독자의 재기동 진입점 | `app/shell/host-supervisor.ts` 의 `ensureRunning` · `attach` | 2 | 비정상 종료 뒤에는 자동으로 띄우지 않는다 — 누군가 불러야 한다 |
| 감독자의 창 통지 | `SupervisedClient.notify('ready' \| 'exited')` | 2 | 준비 통지는 언제나 새 포트 직후다(`becomeReady` · `attach`) |
| preload 의 호스트 채널 호출 | `rg -c "ipcRenderer\.(invoke\|send\|on)\(" app/src/preload/index.ts` | 다수 | 한 번에 바꿔야 한다 — 호스트 프로세스가 없는 지금 일부만 포트로 보내면 그 요청은 받는 쪽이 없다 |

### 결정

- **포트를 받는 것이 곧 준비다.** 셸은 `oo:agent-host:port`(셸 → preload, 포트는 `event.ports[0]`) 하나로 포트와 준비를 함께 알린다. 별도의 `:ready` 채널은 두지 않는다 — 감독자의 준비 통지는 언제나 새 포트 직후라 둘을 나누면 순서만 생긴다.
- **재기동은 preload 가 부른다.** 종료 통지(`oo:agent-host:exited`) 뒤 첫 호스트 채널 요청이 `oo:agent-host:connect`(preload → 셸, 단방향) 1회를 보내고 셸은 `ensureRunning` 을 부른다. 감독자가 기동 실패 상한에 닿아 있으면 셸은 바로 종료 통지를 다시 보낸다.
- **포트가 없을 때의 요청은 줄을 세운다.** 첫 포트 전(창 생성 직후)과 종료 뒤의 요청은 대기열에 넣고 다음 포트에 순서대로 보낸다. 종료 통지는 보낸 요청과 대기열을 모두 실패시킨다 — 기동이 실패해도 요청이 영원히 기다리지 않는다.
- **세 채널과 preload 배선은 호스트 진입점과 같은 단계에 넣는다.** 이 절의 규칙은 Electron 을 모르는 창 쪽 클라이언트(`preload/host-port.ts`)로 먼저 만들고, `CHANNELS`·`IPC_CONTRACT.md`·`channel-owner.ts`(셋 다 `shell`)·`preload/index.ts` 교체는 `index.ts` 축소와 함께 한다.

### 강제 지점 — rev 3.3

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-06 / VP-21·23 **EP-8** | preload 의 호스트 채널 전송 | `preload/host-port.ts` | preload | 3자리 그대로 — preload 자리의 내용을 정한다: 요청(`invoke`) · 단방향(`send`) · 통지 구독(`on`) 이 모두 이 클라이언트를 지난다 | 배선 뒤 `rg -n "hostPort\.(invoke\|send\|on)\(" app/src/preload --glob '!*.test.*'` | 호스트 채널 요청이 `ipcRenderer` 로 가 받는 쪽이 없다 |

**EP-8 규칙 칸 — 창 쪽 클라이언트** (`preload/host-port.test.ts` 입력 — 분기마다 1개):

| 분기 | 기대 |
|---|---|
| 포트가 있을 때 요청 | 그 포트로 `invoke` 1건, 응답 `ok:true` → 값으로 풀림 · `ok:false` → 그 오류 문장으로 거부 |
| 첫 포트 전의 요청 · 단방향 송신 | 보내지 않고 줄을 선다 → 포트가 오면 들어온 순서대로 보낸다. 연결 요청 0회 |
| 종료 통지 | 응답을 기다리는 요청과 대기열을 모두 거부 · 포트를 닫는다 |
| 종료 뒤 첫 요청 | 연결 요청 1회 + 대기열. 둘째 요청은 연결 요청을 더 보내지 않는다 |
| 새 포트 수신(교체) | 옛 포트에서 응답을 기다리던 요청을 거부하고 옛 포트를 닫는다 · 이후 요청은 새 포트로 |
| 옛 포트의 늦은 응답 | 무시 |
| 통지(`kind:'event'`) | 그 채널의 구독자 전부에 페이로드 전달 · 구독 해제 뒤 0 · 포트를 바꿔도 구독은 유지 |
| 형식이 틀린 메시지 · 모르는 요청 번호 | 무시 |

**선언 경계** (rev 3.3 추가):

- B19 — 대기열에 상한과 제한 시간이 없다: 대기열은 첫 포트 전과 종료 뒤에만 생기고, 둘 다 다음 포트나 다음 종료 통지(기동 실패 포함)로 비워진다.
- B20 — 종료 통지로 거부된 요청을 다시 보내지 않는다: 그 요청이 호스트에서 이미 처리됐는지 창은 알 수 없다(AC29 의 "세션 중단" 처리와 같다).

### READY self-review — rev 3.3 (관측)

- `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-016·D-026 ↔ AC24(경로 그대로, 순서와 실패만 정했다) · D-021 ↔ AC29(종료 통지가 요청을 실패시킨다) · AC33(포트 교체).
- 분모: EP-8 3(그대로). 규칙 칸 ↔ 입력 칸: 8분기 ↔ `preload/host-port.test.ts`.
- node·pair 변경 0: VP-23·VP-24 의 oracle 파일에 `preload/host-port.test.ts` 가 더해진다.
- 사용자 결정이 필요한 항목 0: 내부 배선이다. `window.oo` 형상과 사용자가 보는 결과는 Part I 그대로다.

---

## 7-F. V1 rev 4 — 실행과 상태의 분리 (B) — **DRAFT**

**판정: DRAFT.** 사용자가 B 를 골랐다(D-034~D-037). 이 절은 프로세스별 책임·채널 배치·호스트 사이 흐름·수명의 안이다. OPEN 4건(O-1~O-4)의 답을 받은 뒤 AC·V·§10 을 확정해 READY 로 올리고, 그때 아래 "대체 범위"의 구 행을 이 절로 대체한다. 확정 전까지 구현은 멈춘다.

### 조사

| 대상 | 검색 / 방법 | N | 의미 |
|---|---|---:|---|
| DB 호출 자리(§8 과 같은 술어) | `rg -o "\b(ctx\.db\|deps\.db\|this\.db\|db)\.[a-zA-Z]+(\.[a-zA-Z]+)?\(" app/src/main --glob '!*.test.*'` | 287 | §8 과 같다 |
| 그중 실행 쪽으로 가는 파일 | 같은 술어를 `app/chat-turn`·`features/chat/title-generation.ts`·`features/orchestration`·`features/worktrees`·`app/composer-catalog.ts`·`app/harnesses`·`features/extensions` 에 | 33 | B 에서 호스트 사이 요청이 되는 자리. `adapters/opencode/v1/native-cursor.ts` 3 은 opencode 자체 DB 라 뺐다 |
| 데이터 호스트에서 동기로 남는 파일 | 같은 술어를 `features/history`·`features/usage`·`features/chat/recovery.ts`·`app/handlers`·`app/native-history.ts`·`features/scheduler`·`features/plugins`·`infra/db` 에 | 242 | 저장·조회 코드는 DB 와 함께 옮겨 지금 그대로 동기다 |
| `bootstrap.ts` | 같은 술어 | 9 | 조립이 두 호스트로 나뉘며 함께 나뉜다. 33 + 3 + 242 + 9 = 287 |
| 턴 저장이 읽고 쓰는 턴 필드 | `rg -o "turn\.[a-zA-Z]+" features/history/writer.ts features/usage/tracker.ts features/chat/title-generation.ts` | 29종 | 저장 쪽만 쓰는 필드(`currentAssistantMessageId`·`assistantText`·`pendingUserText`·`responseBoundary` 등)는 데이터 호스트의 저장 상태로 옮긴다 |
| 실행 쪽과 공유하는 저장 필드 | `rg -l "\.(openToolRuns\|askPendingIds\|pendingAskAnswers)\b"` | 3필드 | `openToolRuns`(조정기·`settle`·재시작 게이트) · `askPendingIds`(조정기) · `pendingAskAnswers`(승인 흐름이 넣는다). 저장 스트림에 실어 데이터 호스트가 자기 사본을 만든다 |
| `turn.dbSessionId` 의 소비 | `rg -n "\.dbSessionId" --glob '!*.test.*' \| grep -v writer.ts` | 65 | 값은 하네스가 낸 세션 id(`ev.sessionId`, `writer.ts:313`)라 DB 가 만들지 않는다 — 실행 쪽이 같은 이벤트에서 직접 정한다 |
| 설정 읽기 | `rg -c "settings\.(getAll\|patch\|onPatch)\("` | 36 / 10파일 | 실행 쪽은 `chat-turn/send` 2·`resolve-turn` 1·`settings-reactions` 1 과 `bootstrap` 11 의 일부 — 읽기 전용 사본으로 충분하다 |
| 세션 로드 응답의 활동 상태 | `app/handlers/session.ts:74`·`:103` | 2 | 응답이 실행 쪽 활동 상태(`getActivity`)를 싣는다 — 호스트를 건너는 조합이다(F5) |
| 플러그인 도구 경로 | `features/extensions/common/mcp/bridge.ts` | 1 | 하네스는 앱이 띄운 로컬 HTTP MCP 서버에 직접 붙어 플러그인 도구를 부른다 — 그 서버가 어느 호스트에 있어도 경로가 같다 |
| 핸들러 등록 | `rg -U -o "\b(handle\|handlePlain\|on)\(\s*CHANNELS\.[a-zA-Z]+" app/src/main/app app/src/main/infra` | 135 | 아래 채널 배치 표의 출처(파일별) |

### 프로세스별 책임

| 프로세스 | 갖는 것 | 갖지 않는 것 |
|---|---|---|
| 셸 (Electron main) | 창·트레이·`app://`·자동 업데이트 · 두 호스트의 감독(기동·포트 중개·종료·재기동·고아 정리) · 셸 서비스(비밀 봉인·대화상자·외부 열기·알림·전원·파티션 세션) · 셸 상태 파일 | DB·설정 파일·턴·업무 핸들러 |
| 데이터 호스트 (utility, 상태 호스트) | DB 단독 · 설정·비밀·인증 파일 · 턴 저장(사용량 집계 → 이력 저장, 지금 순서) · 세션·프로젝트·검색·산출물·첨부·예약 작업의 저장과 핸들러 · 큰 세션 조각 전송 · 기동·재기동 때 복구 | SDK·CLI·하네스·git·셸 프로세스 |
| 에이전트 호스트 (utility, 실행 호스트) | 어댑터·SDK·하네스 프로세스 · 세션 런타임 · 턴 정규화·버스·창 중계 · 제목 생성 · git·셸 도구 프로세스(D-023) · 하네스 네이티브 자원(확장 카탈로그·세션 리소스·작성기 카탈로그·엔진 설정)·확장 배포·하네스 설치와 가용성 | DB 연결·설정/비밀/인증 파일 |
| 창 | renderer + 계산 워커(단계 3, 그대로) | — |

### 채널 배치 — 등록 파일 기준

| 묶음 | 등록 파일(채널 수) | 소유 | 근거 |
|---|---|---|---|
| 턴·런타임 | `chat-turn/index.ts`(7) · `chat-turn/background.ts`(3) | 에이전트 | 세션 런타임 |
| 하네스 | `misc.ts` 의 `backendList`·`harnessRecheck`·`agentList`·`installStart` · `engine.ts`(5) · `extension-catalog.ts`(3) · `session-resources.ts`(1) · `composer-catalog.ts`(2) | 에이전트 | 하네스 모듈·네이티브 파일 |
| git | `git.ts`(4) | 에이전트 | 도구 프로세스(D-023) |
| 세션·프로젝트·검색·첨부 | `session.ts`(8) · `project.ts`(6) · `files.ts`(7) | 데이터 | DB·첨부 범위 판정 |
| 앱 상태 | `artifacts.ts`(8) · `settings.ts`(2) · `mcp.ts`(4) · `skills.ts`(7) · `cost.ts`(4) · `scheduled-tasks.ts`(8) | 데이터 | 앱 상태 |
| 인증 | `providers.ts`(5) + 상태 통지 | O-1 | — |
| 셸 | `update.ts`(4) · `log.ts`(1) · `bootWhenReady` · `notifyShow`(셸 서비스만 부른다) | 셸 | 창·OS |
| 나머지 | `error.ts`(2) · `boot.ts`(1) · `misc.ts` 의 디버그(2) | 확정 때 | 오류 보고·부팅 보고는 프로세스마다 생긴다 — 모으는 자리를 확정 때 정한다 |

### 호스트 사이 흐름

| # | 흐름 | 방향 | 내용 |
|---|---|---|---|
| F1 | 턴 저장 스트림 | 에이전트 → 데이터(셸이 중개한 전용 포트) | `turn.begin`(턴 키·정적 필드) → `turn.event`(순번·정규화 이벤트) × n → `turn.input`(승인 답처럼 실행 쪽이 넣는 저장 입력) → `turn.end`. 데이터 호스트가 사용량 집계 → 이력 저장을 지금 순서로 돈다. 실패 처리는 O-2 |
| F2 | 턴 준비 조회 | 에이전트 → 데이터(요청·응답) | 세션·프로젝트 메타 · 연속성 입력 · MCP 해석 결과 · 자격증명(O-1·O-3). 준비 단계(D-030)라 이미 비동기 자리다. 실행 쪽 DB 호출 33곳이 F2·F4 로 바뀐다 |
| F3 | 설정 사본 | 데이터 → 에이전트 | 연결 때 전체, 이후 패치. 실행 쪽은 사본을 동기로 읽는다 |
| F4 | 실행 명령 | 데이터 → 에이전트(요청·응답) | 세션 삭제·숨김 전 런타임 폐기 · 예약 작업의 셸 명령 실행(D-023) |
| F5 | 활동 상태 | 에이전트 → 창 | 세션 로드 응답은 데이터 호스트가 본문만 준다. 창이 에이전트 호스트의 활동 상태와 합친다 |
| F6 | UI 언어 사본 | 데이터 → 셸 | 지금 에이전트 호스트가 보내는 `ready`·`shell.mirror` 를 데이터 호스트가 보낸다(D-032 유지 — 보내는 쪽만 바뀐다) |

### 수명

| 상황 | 순서 |
|---|---|
| 기동 | 셸 → 데이터 호스트(마이그레이션·복구·설정 로드 → `ready`) → 에이전트 호스트(설정 사본·준비 → `ready`) → 두 호스트 사이 포트 → 창 포트 → `bootWhenReady` 해결 |
| 종료 | 에이전트 호스트 먼저(런타임 정지 → 저장 스트림 비움) → 데이터 호스트(예약 작업 → 스케줄러 → DB 닫기). 각 3초 초과 시 강제 종료 — 구현한 `shutdownHosts`(데이터 먼저)를 뒤집는다 |
| 에이전트 호스트 비정상 종료 | 셸: 고아 정리 → 창 통지 → 수명 상태 비움. 데이터 호스트: 그 호스트의 열린 턴을 즉시 중단으로 마감한다 — 지금은 다음 기동까지 미루는 복구 규칙을 그 자리에서 돈다 |
| 데이터 호스트 비정상 종료 | 셸: 창 통지 → 재기동(기동 때 복구). 에이전트 호스트의 진행 중 턴은 O-4 |

### 바뀌는 AC — 확정 때 적용

| AC | 판정 | 바뀌는 내용 |
|---|---|---|
| AC15~AC17 | 유지 | 조각 계약은 그대로다 |
| AC18 | 대체 | 첫 요청에 뜸 → 앱 시작 때 뜸 · 종료 순서가 뒤집힘 |
| AC19 | 대체 | `oo:session:load`·`refresh` 를 데이터 호스트가 받는다 — 에이전트 호스트의 티켓을 거치지 않는다 |
| AC20 | 대체 | 읽기 전용 연결 → 데이터 호스트가 유일한 연결. 요청 스키마 검증은 유지 |
| AC24 | 변경 | 소유자 둘 → 셋. 창은 호스트마다 포트 하나 |
| AC27 | 변경 | 비밀 봉인을 요청하는 쪽이 데이터 호스트다(O-3) |
| AC29 | 변경 | + 데이터 호스트가 그 호스트의 열린 턴을 즉시 마감 |
| AC30 | 대체 | DB 소유·마이그레이션·복구 = 데이터 호스트 |
| AC31 | 변경 | 두 호스트가 준비된 뒤 본 화면 |
| AC32 | 변경 | 종료 순서 에이전트 → 데이터 |
| AC33 | 변경 | 호스트별 재연결. 데이터 호스트 재기동도 같은 규칙 |
| AC37·AC38 | 변경 | 설정·비밀·인증 파일과 언어 알림의 주체 = 데이터 호스트 |
| 신규 | — | F1 저장 스트림(순서·실패 규칙·공유 필드 사본) · F2·F4 요청 계약 · F3 설정 사본 · 데이터 호스트 비정상 종료(O-4) |

### 이미 구현한 부품의 영향

| 부품 | 영향 |
|---|---|
| 감독자(`app/shell/host-supervisor.ts`) | 두 호스트에 그대로 쓴다. `shutdownHosts` 순서를 뒤집고 호스트 사이 포트 중개를 더한다 |
| 포트 서버 · 창 쪽 포트 클라이언트 | 호스트마다 하나씩 그대로 쓴다 |
| 수명 이벤트 방출·수신 | 에이전트 호스트에 그대로. `ready`·`shell.mirror` 는 데이터 호스트로 옮긴다 |
| 셸 서비스 · 핸들러의 Electron 제거 · 호스트 환경 | 그대로 — 핸들러가 어느 호스트에 서든 같은 포트를 쓴다 |
| `Bootstrap` | 둘로 나눈다 — 확정 뒤 가장 큰 작업이다 |

### 대체 범위 (확정 때)

§3 D-006·D-025·D-033(위 Ledger) · §7 AC18·AC19·AC20·AC30 · §9 TO-BE 의 호스트 책임 행 · §10 EP-4~EP-6(티켓·데이터 호스트 포트) · §11 단계 4·5 의 호스트 배치 · §13 종료 순서. 계산 워커·멈춤 계측·가드·수명 이벤트·셸 서비스·포트 클라이언트 행은 그대로다.

### OPEN — 사용자 결정 4건

| ID | 질문 | 안 A | 안 B | 설계자 추천 |
|---|---|---|---|---|
| O-1 | 인증의 자리 | 데이터 호스트 — 인증 파일·게이트·사용량 조회·플러그인과 함께. 턴은 준비 단계에서 자격증명을 받는다 | 에이전트 호스트 — VS Code 처럼 인증 제공자를 실행 쪽에 둔다. 파일만 데이터 호스트 | A — 소비처 중 게이트·사용량 조회·플러그인이 실행이 아니다 |
| O-2 | 턴 저장 실패 | 비동기 저장 — 스트리밍 지연이 없다. 실패하면 턴을 오류로 끝낸다. 실패 직전 이벤트가 화면에 먼저 보일 수 있다 | 저장 확인 뒤 화면 중계 — 지금과 같은 보장. 이벤트마다 호스트 왕복 | A — 저장 실패는 디스크 고장 같은 드문 경우다 |
| O-3 | 비밀 해제 | 데이터 호스트 기동 때 한 번 풀어 메모리에 둔다. 키체인이 잠겨 못 푼 것은 깨어남(화면 잠금 해제)마다 다시 시도한다 | 읽을 때마다 셸에 요청 — 인증 상태 확인이 전부 비동기가 된다 | A — 지금의 "읽을 때마다 재시도"를 깨어남 재시도로 대신한다 |
| O-4 | 데이터 호스트가 턴 도중 죽음 | 진행 중 턴을 오류로 끝낸다. 재기동 뒤 복구 규칙이 정리한다 | 다시 뜰 때까지 저장을 쌓아 두고 이어 저장한다 | A — 단일 쓰기 주체 장애의 범용 대응(D-024) |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 구문 강조는 renderer 메인 스레드에서 동기로 돈다. 상한은 200,000자다 | `shared/ui/markdown/CodeBlock.tsx:46`·`:65` |
| diff 토큰도 같은 스레드에서 축마다 한 번씩 강조한다 | `features/chat/lib/diffSyntax.ts:25` |
| jsdiff 를 renderer 가 직접 부른다 | `lib/diffLines.ts:47` · `lib/toolMeta.ts:185` · `lib/unifiedDiffLines.ts:7` |
| shiki 엔진은 JS 정규식 엔진이다 — WASM 이 없어 CSP 변경 없이 워커에서 돈다 | `shared/ui/markdown/syntax.ts:39` · `index.html` CSP `script-src 'self'` |
| 세션 로드는 main 에서 모든 part 를 한 번에 읽고 한 응답으로 보낸다 | `app/handlers/session.ts:70` · `features/history/reader.ts:19` · `infra/db/queries.ts:465` |
| 세션 로드 전에 쓰기 1건(`compactLegacyRaw`)이 있다 | `app/handlers/session.ts:69` |
| 갱신 경로는 스냅샷을 DB 에 저장한 뒤 돌려준다 — 호스트가 다시 읽을 수 있다 | `features/history/native-sync.ts:123~141` |
| renderer 로드는 대기 중 라이브 이벤트가 오면 결과를 버린다 | `chatStore.ts:1782~1790` |
| 모든 invoke 채널은 `handle`·`handlePlain`, 단방향은 `on` 으로 등록된다 | `infra/ipc/handle.ts` |
| renderer → main 로그 채널이 이미 있다 | `preload/index.ts:127` `CHANNELS.logEmit` |
| 턴 시작에 플러그인 카탈로그를 동기로 읽는다. 비동기 판이 같은 파일에 있다 | `adapters/claude/adapter.ts:609` · `plugin-catalog.ts:273`·`:321` |
| `app://` 스킴은 standard·secure 로 등록돼 있고 자산은 파일로 응답한다 | `main/index.ts:134~160` |
| renderer 의 새 디렉토리는 `shared` 요소 안에 둬야 boundaries 설정을 안 고친다 | `eslint.config.mjs:69~78` |
| `electron` 을 값으로 import 하는 main 파일은 17개이고 `features`·`adapters` 에는 없다(타입 import 만) | `rg -n "from 'electron'" app/src/main --glob '!*.test.*'` |
| 턴 준비 경로에 입력 크기에 비례하는 동기 작업이 네 곳 있다 | `native-sync.ts:21`(스냅샷 `JSON.parse`) · `native-session.ts:55`(`loadSession` + 재직렬화) · `attachments.ts`(인라인 32MiB 디코드) · `adapter.ts:609`(카탈로그 순회) |
| renderer 는 전송 결과를 기다리지 않고 실패도 `error` 이벤트로 받는다 | `chatStore.ts:573` `void chatApi.send(payload).catch(…)` · `send.ts` 의 `sendChatEvent(event.sender, { type: 'error', … })` |
| 턴이 창을 `WebContents` 로 직접 든다 | `WebContents`·`IpcMainInvokeEvent` 타입을 쓰는 파일 24개(`app/chat-turn` 11) |
| 끊긴 턴의 복구 규칙이 이미 있다 | `features/chat/recovery.ts:73` `recoverSessionHistory` |
| 외부 SDK/API | shiki 1.29.2 `codeToHtml`·`codeToTokens`(패키지 타입) · Electron 39 `utilityProcess.fork`·`MessageChannelMain`(TRD 스택) · Node `perf_hooks.monitorEventLoopDelay` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| renderer 의 shiki 실행 자리 | `rg -n "codeToHtml\(\|codeToTokens\(\|getHighlighter\(" app/src/renderer/src --glob '!*.test.*'` | 5줄 / 3파일 | `CodeBlock.tsx`·`diffSyntax.ts`·`syntax.ts` |
| renderer 의 jsdiff 호출 | `rg -n "buildDiffLines\(\|jsDiffLines\(\|parsePatch\(" app/src/renderer/src --glob '!*.test.*'` | 7줄 | 정의 1 · 호출 6 |
| main 의 `loadSession` 호출 | `rg -n "loadSession\(" app/src/main --glob '!*.test.*'` | 4줄 | 정의 1 · 호출 3(`session.ts:70`·`:92`·`native-session.ts:55`) |
| main 의 Node 동기 API 이름 | Node 의 `fs`·`child_process` export 중 `Sync` 로 끝나는 이름 46개를 주석 제거 뒤 토큰으로 셈 | 125 / 25파일 | 가드의 초기 등록 분모 |
| IPC 등록 함수 | `rg -n "^export function" app/src/main/infra/ipc/handle.ts` | 3 | `handle`·`handlePlain`·`on` |
| `ipcMain` 직접 등록 | `rg -n "ipcMain\.(handle\|on\|once\|handleOnce)\(" app/src/main --glob '!*.test.*'` | 7 | `handle.ts` 3 · `index.ts` 4 |
| 계산된 이름으로 동기 API 접근 | `rg -n "\[['\"\`][^\]]*Sync" app/src/main --glob '!*.test.*'` | 2 | 둘 다 타입 인덱스 `LoadedSession['nativeSync']` — 동기 API 접근 0 |
| preload 의 전송 호출 | `rg -c "ipcRenderer\.(invoke\|on\|send)\(" app/src/preload/index.ts` | 108 | invoke 105 · on 2 · send 1 |
| 채널 상수 | `rg -c "^\s+[a-zA-Z]+: 'oo:" app/src/shared/ipc.ts` | 123 | 채널 소유 표의 분모 |
| main → 창 통지 자리 | `rg -c "broadcast\(\|wc\.send\(" app/src/main/infra/ipc/send.ts` · `rg -n "getAllWebContents" app/src/main --glob '!*.test.*'` | 17 · 3 | `send.ts` 17줄 + `bootstrap.ts:649`·`:1155` 직접 순회 2 |
| DB 호출 자리 | `rg -o "\b(ctx\.db\|deps\.db\|this\.db\|db)\.[a-zA-Z]+(\.[a-zA-Z]+)?\(" app/src/main --glob '!*.test.*'` | 287 | 전부 동기 API |
| Electron 값 import 파일 | `rg -l "^import (?!type).*from 'electron'" -P app/src/main --glob '!*.test.*'` | 17 | 셸에 남거나 셸 서비스 어댑터가 되는 파일 |
| main 소스 규모 | `find app/src/main -name '*.ts'` (테스트 제외 / 테스트) | 437 / 488 | 옮기는 대상의 크기 |
| renderer 의 `window.oo` 접근 | `rg -c "window\.oo\b" app/src/renderer/src --glob '!*.test.*'` | 133 | `shared/api` 124 · 밖 9(`features/chat` 5·`shared/logging.ts` 3·`shared/errors` 1) |
| 프로세스 기동 import | `rg -l "from '(node:)?child_process'" app/src/main --glob '!*.test.*'` | 3 | `infra/git/runner.ts`·`infra/shell/shell-runner.ts`·`adapters/opencode/v1/server.ts` |
| DB 모듈 값 import | `rg -n "^import (?!type)[^;]*from 'better-sqlite3'" -P app/src/main --glob '!*.test.*'` | 2 | `infra/db/file-database.ts`·`warm-file-sqlite.ts` |
| 워커·계측 | `rg -n 'new Worker\(\|utilityProcess\|worker_threads\|monitorEventLoopDelay\|PerformanceObserver' app/src --glob '!*.test.*'` | 1 | 주석 1건 — 실사용 0 |

### 수치 / 전칭 표현 검산

이 환경(Xeon 2.3GHz 4코어, Node 22.23, Chromium headless)에서 이번 턴에 잰 값이다. 기준 PC 의 값이 아니라 순서와 자릿수를 본다.

| 작업 | 입력 | 한 번에 걸린 시간 |
|---|---|---|
| shiki `codeToHtml`(TypeScript) | 200줄 / 1,000줄 / 2,546줄 / 200,000자 | 67ms / 약 980ms / 약 2,570ms / 약 4,950ms |
| 강조 HTML 을 DOM 에 넣고 레이아웃 | 200 / 1,000 / 2,546 / 5,092줄 | 7 / 26 / 61 / 121ms |
| 원문 `<pre>` 삽입 | 같은 입력 | 2.4 / 11 / 17 / 35ms |
| jsdiff `diffLines` | 2,546줄, 1/7 변경 / 절반 변경 | 40ms / 415ms |
| remark 변환(parse + gfm + rehype) | 5,000자 / 33,441자 | 8ms / 51~95ms |
| jsdiff `parsePatch` | 0.13MB / 1.30MB / 5.22MB | 3 / 10 / 45ms |
| 세션 part 조회 + 행별 `JSON.parse` + 직렬화 | 1,000 / 10,000 / 50,000 part | 15 / 150 / 800ms |
| SQLite 단건 쓰기(WAL, `synchronous=NORMAL`) | 1건 | 0.064ms |
| `MessagePort` 왕복 | 500 / 10,000 part | 4.5 / 49ms |
| base64 디코드 / 같은 크기 문자열 복제 | 32MiB | 30ms / 53ms |
| 읽기 전용 연결 | 쓰기 문 준비 가능 · 실행은 `SQLITE_READONLY` · WAL 커밋 행 보임 · 읽는 중 쓰기 안 막힘 | 4건 모두 관측 |
| shiki 조각 실행 | 100줄씩 `grammarState` 로 이어 붙인 토큰이 통째 실행과 같다 | 2,547줄 일치 |

- 내역 합 = 총계: 동기 API 25파일의 개수 합 125(§8 스크립트 출력).
- "유일한/항상/절대" 반례 검색: "모든 invoke 가 `handle`·`handlePlain` 을 지난다"는 틀렸다 — `rg -n "ipcMain\.(handle|on|once|handleOnce)\(" app/src/main --glob '!*.test.*'` → 7줄, `handle.ts` 3 + `index.ts` 4(`:234`·`:237`·`:241` 창 최소화·최대화·닫기, `:280` 부팅 대기). 이 4곳은 `handlePlain` 으로 옮긴다(§10 EP-2).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `rendering.md` §1.2·§1.3 · `app/AGENTS.md` "better-sqlite3 ABI · 제약 환경 게이트 가이드" · `handle.test.ts`·`CodeBlock.render.test.ts`·`session.load.test.ts` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01·SD-02·AR-05.
- 현재 책임 소유자: main 이 세션 본문 조회·조립·전송을, renderer 메인 스레드가 강조·diff 계산을 한다.
- 현재 오류/취소/정리 경로: 강조는 effect 의 `cancelled` 플래그로 늦은 결과만 버린다 — 계산 자체는 끝까지 돈다. 세션 로드는 `isCurrent()` 로 결과를 버린다.
- 문제의 직접 원인: 입력 크기에 비례하는 일이 UI 스레드의 한 작업으로 돈다.

```text
[CodeBlock mount]  → getHighlighter() → codeToHtml()            (renderer 메인 스레드, 동기)
[diff 타일]        → buildDiffLines() / codeToTokens() ×2        (renderer 메인 스레드, 동기)
[세션 클릭]        → invoke oo:session:load
                   → main: compactLegacyRaw → loadParts().all() → 조립 → 응답 1개
                   → renderer: LOAD_SESSION
[턴 시작]          → main: readClaudePluginCatalog() (readdirSync·readFileSync)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01·SD-02·SD-04·AR-01~AR-10.
- 변경 후 책임 소유자: 아래 표. 이름은 사용자와 확정한 것이다(턴 8~9).
- 변경 후 오류/취소/정리 경로: §13.
- 유지하는 기존 메커니즘: 델타 코얼레서 · `isCurrent()`/`liveChanged` 보호 · `handle()` 의 zod 검증 · `turn.event` 구독 순서 · `recoverSessionHistory` · 로거. 대체하는 메커니즘: renderer 의 직접 `shiki` 호출 · 세션 본문 응답 · `ipcMain`/`webContents` 를 통한 요청·통지 전송(호스트 채널에 한해 포트로).

| # | 실행 주체 | 종류 | 수·수명 | 띄우는 쪽 | 맡는다 | 맡지 않는다 |
|---|---|---|---|---|---|---|
| 1 | main(셸) | Electron main | 1 | OS | 창·트레이·업데이트·`app://` 응답, 셸 서비스(비밀 봉인·해제·대화상자·외부 열기·알림·파티션 세션 요청), 호스트 수명 감독, 포트 중개, 수명 상태 보유 | 턴·세션·DB·하네스·git — `features`·`adapters`·`infra/db` 를 import 하지 않는다 |
| 2 | renderer | Chromium renderer | 창마다 1 | main | UI 상태·그리기 예약·결과 반영·상한 있는 계산 | `shiki` 실행 · 상한 없는 diff 계산 |
| 3 | 계산 워커 | Web Worker | 창마다 1, 첫 요청에 생성 | renderer | 구문 강조 · diff 토큰 · diff 줄 | 상태 소유 · IPC |
| 4 | 에이전트 호스트 | `utilityProcess` | 앱에 1, 부팅 때 생성 | main | 지금의 `Bootstrap` 전체 — 요청 핸들러, 어댑터·SDK 호출, 세션 런타임, 정규화, 게이트 훅 반환, 이력 쓰기(DB 쓰기 연결), 스케줄러, 도구 프로세스 기동 | Electron 창·OS API 직접 호출 |
| 5 | 데이터 호스트 | `utilityProcess` | 앱에 1, 첫 요청에 생성 | main | 읽기 전용 연결로 세션 본문 조회·조립·조각 전송 | 쓰기 · 권한 판정 |
| 6 | 하네스 | 자식 프로세스 | 세션·하네스마다 | 에이전트 호스트(SDK 경유) | 모델 호출 · 도구 실행 | — |
| 7 | 도구 프로세스 | 자식 프로세스 | 필요할 때 | git·셸은 에이전트 호스트, MCP 서버는 하네스 | git 조회 · 예약 셸 작업 · MCP 서버 | — |

```text
[전송]      window.oo.chat.send → preload: 채널 소유 표 = host → 에이전트 호스트 포트
            → 호스트 handle() → handleChatSend (지금 코드 그대로, 호스트 안에서)
            → 어댑터 → 하네스 → 정규화 → bus 'turn.event' (usage → history → title → relay)
            → ClientRef.send → 창 포트 → preload 구독자 → ingestChatEvent → rAF
[권한 작업] 호스트 crypto/dialog/open → 셸 서비스 포트 → main: safeStorage·dialog·shell
[수명]      호스트 → main: turn.started · turn.ended · approval.pending · session.ended · harness.exited
            → LifecycleState → 업데이트 재시작 게이트 · 트레이 종료 판정
[세션 클릭] sessionApi.load → 에이전트 호스트 oo:session:load: compactLegacyRaw → { activity }
            → 데이터 호스트 포트: begin → chunk × n → end → 조립 → LOAD_SESSION 1회
[강조·diff] CodeBlock → computeClient → 계산 워커 → 응답 → setState
[호스트 사망] utilityProcess exit → main: 고아 하네스 종료 → 창 통지 → LifecycleState 비움 → 다음 요청에 재기동
[멈춤]      stall-monitor(main·에이전트 호스트) / handle() / longTaskReporter → perf.stall 로그
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 강조·diff = renderer 메인 스레드 | 계산 워커 | D-008 | AR-01 / VP-04·VP-10 · `shared/compute/**` |
| 책임/소유권 | 턴·세션·DB 쓰기·핸들러 = main | 에이전트 호스트 | D-016·D-025 | AR-06~AR-10 / VP-21~VP-27 · `app/agent-host/**`·`app/shell/**` |
| 책임/소유권 | 세션 본문 = main | 데이터 호스트 | D-006 | AR-02 / VP-05·VP-11 · `app/data-host/**` |
| data/control flow | 요청·턴 이벤트가 `ipcMain`·`webContents` 로 main JS 를 지난다 | preload ↔ 호스트 포트 직접 | D-016·D-026 | AR-06·AR-07 / VP-23·VP-24 |
| state/contract | 턴 상태를 main 이 메모리에서 직접 읽는다 | 수명 이벤트로 받은 `LifecycleState` | D-020 | AR-09 / VP-26·VP-31 |
| error/lifecycle | 프로세스 하나 — 죽으면 앱이 죽는다 | 호스트 사망 → 고아 정리 → 세션 중단 → 재기동 | D-021 | SD-04 / VP-22·VP-29 |
| data/control flow | 세션 본문이 main JS 를 지난다 | 호스트 → renderer 포트 직접 | D-006 | SD-02 / VP-09 |
| state/contract | `oo:session:load` → `LoadedSession \| null` | `SessionLoadTicket` + 호스트 메시지 | D-006 | AR-05 / VP-14 · `shared/ipc.ts`·`shared/data-host.ts` |
| error/lifecycle | 강조 계산은 취소 불가 | 대기 취소·실행 중 교체·3회 실패 차단 | D-009 | SD-01 / VP-08 |
| error/lifecycle | 호스트 없음 | 지연 기동·종료 통지·재기동·종료 순서 | D-006 | SD-02 / VP-09 · `app/shell/host-supervisor.ts` |
| test seam/관측점 | 계측 없음 | `perf.stall`(main 루프·IPC 동기 구간·renderer long task) | D-002 | MD-03·AR-03 / VP-03·VP-12 |
| test seam/관측점 | 배치 규칙이 문서에 없다 | `check-ui-thread.mjs` 가 CI 에서 강제 | D-008 | AR-04 / VP-02·VP-13 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/perf-budget.ts` | 예산 상수 SSOT — `UI_TASK_BUDGET_MS=50`·`STALL_SEVERE_MS=160` | 상수 | main·renderer·스크립트 문서 |
| `src/shared/data-host.ts` | 호스트 메시지 zod 스키마·`SESSION_CHUNK_MAX_PARTS=500`·조각 분할/조립 순수 함수 | `LoadedSession` ↔ 메시지 열 | 호스트·renderer 클라이언트 |
| `renderer shared/compute/client.ts` | 대기열·캐시·취소·워커 교체·실패 차단 | 요청 → Promise | `useHighlightedHtml`·`useDiffSyntax`·`useDiffLines` |
| `renderer shared/compute/worker/` | 워커 진입점과 처리 함수(`shiki`·`diff` 값 import 허용 구역) | 메시지 → 메시지 | `client.ts` 가 URL 로만 참조 |
| `renderer shared/compute/inline.ts` | 상한 있는 동기 diff(`diff` 값 import 허용 파일) | 문자열 → `DiffLine[] \| null` | diff 소비처 |
| `renderer shared/api/dataHost.ts` | 포트 획득·요청 번호·조립·취소 | `sessionId` → `LoadedSession \| null` | `shared/api/ipc.ts` 의 `sessionApi` |
| `renderer shared/perf/longTaskReporter.ts` | long task 묶음 보고 | 관측 항목 → `logEmit` | `main.tsx` |
| `src/shared/channel-owner.ts` | 채널별 처리 프로세스 SSOT | `CHANNELS` 키 → `'shell' \| 'host'` | preload · 등록 테스트 |
| `src/shared/host-protocol.ts` | 포트 요청·응답·통지·수명 이벤트·셸 서비스의 zod 스키마 | 메시지 | 셸 · 호스트 · preload |
| `main contracts/client.ts` | 창 참조 `ClientRef`(`id`·`send`·`isClosed`·`onClosed`) — `WebContents` 를 대신한다 | 타입 | `WebContents` 타입을 쓰던 24파일 |
| `main infra/ipc/{handle,send,transport}.ts` | 등록·통지의 전송 선택 — 셸에서는 `ipcMain`, 호스트에서는 포트 서버 | 핸들러 ↔ 메시지 | 모든 핸들러 등록부 |
| `main app/agent-host/entry.ts` | 호스트 진입점 — 포트 서버·셸 서비스 클라이언트를 만들고 `Bootstrap` 을 시작 | `parentPort` 메시지 | electron-vite main 의 입력 |
| `main app/agent-host/lifecycle-emitter.ts` | 정규화 이벤트·하네스 종료 → 수명 이벤트 | 버스 → 셸 통지 | `Bootstrap` |
| `main app/shell/host-supervisor.ts` | 두 호스트의 fork·ready·포트 중개·exit·재기동·shutdown | 창 → 포트 | `index.ts` |
| `main app/shell/services.ts` | 셸 서비스 8종의 서버 | 요청 → Electron API | `host-supervisor` |
| `main app/shell/lifecycle-state.ts` | 수명 이벤트 → 상태(활성 턴·승인 대기·세션 활동) | 이벤트 → 조회 | `updater`·`tray-residency` |
| `main app/shell/orphans.ts` | 죽은 호스트를 부모로 둔 프로세스 선별·종료(프로세스 목록 함수 주입) | pid → kill 대상 | `host-supervisor` |
| `main infra/perf/stall-monitor.ts` | 루프 지연 판정과 기록(시계·표본원 주입) | 표본 → 로그 | 셸 `index.ts` · 호스트 `entry.ts` |
| `main infra/ipc/handle.ts` | 세 등록 함수의 동기 구간 계측 | 핸들러 → 로그 | 모든 핸들러 등록부 |
| `main app/data-host/entry.ts` | 데이터 호스트 진입점 — 읽기 전용 연결·요청 검증·서비스 호출 | 포트 메시지 | electron-vite main 의 두 번째 입력 |
| `main app/data-host/session-load.ts` | `loadSession` 호출·조각 전송·조각 사이 취소 확인 | 요청 → 메시지 열 | `entry.ts` |
| `app/scripts/check-ui-thread.mjs` | 규칙 11종 판정·등록 표·안내 메시지 | 트리 → exit code | `ci.yml`·`npm test` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-04 / VP-02·13·18 **EP-1** | 실행 위치·경로 규칙 11종 | `check-ui-thread.mjs` 의 등록 표 | 가드 | 11자리 — (a) `src/main` 의 동기 API 이름 (b) renderer 의 계산 라이브러리 값 import (c) `loadSession` import (d) `ipcMain` 직접 등록 (e) 셸 import 그래프 (f) 호스트의 `electron` 값 import·`worker_threads` (g) 창 통지 API (h) `window.oo` 접근 (i) `Worker` 생성 (j) 프로세스 기동 (k) DB 연결 | `node scripts/check-ui-thread.mjs --list` → 규칙별 발견 목록 | 등록 밖 사용이 CI 를 통과한다 |
| AR-03 / VP-03·12·17 **EP-2** | 멈춤 기록 `perf.stall` | `infra/perf/stall-monitor.ts` 의 기록 함수 | 셸·호스트 | 7자리 — 등록 함수 `handle`·`handlePlain`·`on` + `index.ts:234`·`:237`·`:241`·`:280` 의 직접 등록(→ `handlePlain`) | §8 의 `ipcMain` 직접 등록 `rg` → 7 | 느린 핸들러가 채널 이름 없이 묻힌다 |
| AR-01 / VP-04·08·10·15·19 **EP-3** | UI 스레드에서 사라지는 계산 호출 | `shared/compute/client.ts` | renderer | 9자리 — `CodeBlock.tsx:57`·`:65` · `diffSyntax.ts:20`·`:25` · `DiffBody.tsx:26`·`:31`·`:36` · `filePresentation.ts:9` · `toolMeta.ts:185` | §8 전수 조사의 두 `rg` — 정의·`syntax.ts`·`unifiedDiffLines.ts:7` 을 뺀 9 | 그 자리가 UI 스레드에서 계속 계산한다 |
| AR-05 / VP-05·14 **EP-4** | 세션 본문을 요청 응답에 싣지 않는다 | `shared/ipc.ts` 의 `SessionLoadTicket` | 에이전트 호스트 | 3자리 — `session.ts:70`·`:92`·`native-session.ts:55` | `rg -n "loadSession\(" app/src/main --glob '!*.test.*'` → 정의 빼고 3 | 본문 조회가 턴 스트림과 같은 스레드에서 돈다 |
| AR-02 / VP-05·09 **EP-5** | 데이터 호스트 포트 전달 | `host-supervisor.ts` | main·preload | 2자리 — `connect` 의 두 `postMessage` · preload 의 포트 수신 | 구현 뒤 `rg -n "dataHostPort" app/src` | 포트가 한쪽에만 간다 → 요청이 영원히 대기 |
| AR-02 / VP-05·09·11·16 **EP-6** | 호스트 메시지 5종 | `shared/data-host.ts` | 호스트·renderer | 5자리 — `begin`·`chunk`·`end`·`error`·`cancel` | 구현 뒤 `rg -n "type: '(begin\|chunk\|end\|error\|cancel)'" app/src/shared/data-host.ts` | 조립 불일치·취소 무시 |
| VP-06 **EP-7** — SUPERSEDED → EP-7′ (§7-B) | 턴 시작 카탈로그는 비동기 | `plugin-catalog.ts` | main | 1자리 — `adapter.ts:609` | `rg -n "readClaudePluginCatalog\b" app/src/main --glob '!*.test.*'` | 턴 시작마다 디렉토리 순회가 호스트의 스트림을 막는다 |
| AR-06 / VP-21·23 **EP-8** | 채널마다 처리 프로세스가 하나다 | `shared/channel-owner.ts` | preload·셸·호스트 | 3자리 — preload 의 `invoke` 선택 · 셸의 등록 · 호스트의 등록 | `rg -n "channelOwner\|CHANNEL_OWNER" app/src --glob '!*.test.*'` | 요청이 받는 쪽 없는 프로세스로 가 영원히 대기한다 |
| AR-07 / VP-21·24 **EP-9** | 호스트발 통지는 `ClientRef` 로 간다 | `contracts/client.ts` | 호스트 | 4자리 — `send.ts` 의 대상 지정 전송 · 방송 · `bootstrap.ts:649`·`:1155` 의 직접 순회 2 | §8 의 통지 자리 두 `rg` | 통지가 창에 닿지 않는다 |
| AR-08 / VP-21·25 **EP-10** — 분모는 EP-10′ (§7-B) | 권한 작업은 셸 서비스로만 | `shared/host-protocol.ts` | 호스트·셸 | 8자리 — 비밀 봉인·해제(`infra/config/crypto.ts`) · 대화상자(`handlers/files.ts`·`artifacts.ts`) · 외부 열기(`shell.*` 5파일) · 알림·창 포커스(`handlers/misc.ts`) · 전원 이벤트(`bootstrap.ts`) · 파티션 세션 요청(`infra/browser-session.ts`·`net-request.ts`) · 업데이트 제어(`updater.ts`) · 경로·버전(`app.getPath`·`getVersion`) | §8 의 Electron 값 import `rg` → 17파일을 8종에 배정, 미배정 0 | 호스트가 없는 API 를 불러 기동 중 죽는다 |
| AR-09 / VP-21·26·28 **EP-11** | 수명 이벤트 5종 | `shared/host-protocol.ts` | 호스트 → 셸 | 5자리 — `turn.started`·`turn.ended`·`approval.pending`·`session.ended`·`harness.exited` | 구현 뒤 `rg -n "type: '(turn\.started\|turn\.ended\|approval\.pending\|session\.ended\|harness\.exited)'" app/src/shared/host-protocol.ts` | 재시작 게이트·트레이 판정이 낡은 상태를 본다 |
| SD-04 / VP-22·29 **EP-12** | 호스트 종료 처리 | `app/shell/host-supervisor.ts` | main | 4자리 — 에이전트 호스트 exit · 데이터 호스트 exit · 정상 shutdown · 3초 초과 강제 종료 | 구현 뒤 `rg -n "\.on\('exit'" app/src/main/app/shell` | 고아 하네스가 남거나 세션이 busy 로 굳는다 |

**EP-1 규칙 칸** (가드의 판정 — 분기마다 `check-ui-thread.test.mjs` 입력 1개):

| 규칙 | 분기 | 기대 |
|---|---|---|
| (a) 동기 API | 등록 없는 파일에 이름 추가 | exit 1 |
| (a) | 등록된 파일의 개수가 등록보다 많음 | exit 1 |
| (a) | 등록된 파일의 개수가 등록보다 적음 | exit 1 |
| (a) | 주석·문자열 안의 이름 | exit 0 |
| (a) | 테스트 파일(`*.test.ts`·`*.testfixture.ts`) | exit 0 |
| (b) 계산 라이브러리 | 허용 밖 파일의 값 import(`import { x } from 'shiki'`·`import('shiki/core')`) | exit 1 |
| (b) | 허용 밖 파일의 `import type` | exit 0 |
| (b) | `shared/compute/worker/**` 의 값 import · `shared/compute/inline.ts` 의 `diff` 값 import | exit 0 |
| (b) | `lib/unifiedDiffLines.ts` 처럼 허용 밖 파일의 `diff` 값 import | exit 1 |
| (b) | `inline.ts` 의 `shiki` 값 import | exit 1 |
| (c) `loadSession` | 등록 밖 파일의 import | exit 1 |
| (c) | 등록된 파일(`app/data-host/session-load.ts`·`app/chat-turn/native-session.ts`)의 import | exit 0 |
| (d) `ipcMain` 등록 | `infra/ipc/handle.ts` 밖의 `ipcMain.handle(`·`.on(`·`.once(`·`.handleOnce(` | exit 1 |
| (d) | `infra/ipc/handle.ts` 안의 등록 | exit 0 |
| (e) 셸 그래프 | `src/main/index.ts` 에서 값 import 로 닿는 모듈이 `src/main/features/**`·`src/main/adapters/**`·`src/main/infra/db/**`·`better-sqlite3` 에 있다 | exit 1 |
| (e) | 같은 대상을 `import type` 으로만 닿는다 | exit 0 |
| (e) | 동적 `import()` 로 닿는다 | exit 1 |
| (f) 호스트 | `src/main/app/agent-host/entry.ts`·`app/data-host/entry.ts` 에서 닿는 모듈이 등록된 셸 서비스 어댑터 밖에서 `electron` 값을 import | exit 1 |
| (f) | `src/main` 어디서든 `worker_threads`·`node:worker_threads` import | exit 1 |
| (f) | 호스트에서 쓸 수 있는 `electron` 값(`net`)을 등록된 파일(`infra/net/net-fetch.ts`)이 import | exit 0 |
| (g) 창 통지 | `src/main` 에서 `.send(` 를 `webContents`·`wc` 에 부르거나 `getAllWebContents`·포트 `postMessage` 를 쓰는 파일이 전송 모듈(`infra/ipc/{send,transport}.ts`·`app/shell/host-supervisor.ts`·두 `entry.ts`) 밖 | exit 1 |
| (g) | 전송 모듈 안 | exit 0 |
| (h) `window.oo` | `src/renderer/src/shared/api/**` 밖 파일의 `window.oo` | exit 1 |
| (h) | `shared/api/**` 안 | exit 0 |
| (i) `Worker` | `shared/compute/client.ts` 밖의 `new Worker(`·`new SharedWorker(` | exit 1 |
| (i) | `client.ts` 안 | exit 0 |
| (j) 프로세스 기동 | `child_process` import 가 등록 3파일(`infra/git/runner.ts`·`infra/shell/shell-runner.ts`·`adapters/opencode/v1/server.ts`) 밖 · `utilityProcess` 가 `app/shell/host-supervisor.ts` 밖 | exit 1 |
| (j) | 등록 파일 안 | exit 0 |
| (k) DB 연결 | `better-sqlite3` 의 값 import 가 `infra/db/{file-database,warm-file-sqlite}.ts` 밖 | exit 1 |
| (k) | 같은 모듈의 `import type` | exit 0 |
| 문서 대조 | 가드의 규칙 id 가 `execution-model.md` 경로 표에 없다 / 표의 id 가 가드에 없다 | exit 1 |

- 가드는 열린 입력 집합을 판정한다 → **fail-closed 로 설계한다.** (e)·(f)의 import 목록은 정규식이 아니라 TypeScript 의 `ts.preProcessFile` 로 뽑는다(devDependency 로 이미 있다) — 해석하지 못한 지정자(계산된 `import(x)`)는 실패다. (a)의 이름 집합은 Node 가 정한다(`Object.keys(require('node:fs'))`·`child_process` 중 `Sync` 로 끝나는 것 — 실행 시 계산). 같은 이름의 로컬 함수(`native-settings-file.ts:75` 의 `readSync`)도 걸리며, 등록하거나 이름을 바꾼다. (b)는 모듈 지정자 문자열(`'shiki'`·`'shiki/…'`·`'diff'`)이 `import type` 이 아닌 문장에 나오면 실패다 — 모르는 import 형태는 실패 쪽으로 떨어진다.
- **경로 표**(문서와 가드가 공유하는 내용 — `execution-model.md` 에 이 표를 두고 `AGENTS.md` 넷이 링크한다):

| 하려는 일 | 요청하는 곳 | 경로 | 직접 하면 걸리는 규칙 |
|---|---|---|---|
| renderer 가 데이터를 읽거나 바꾼다 | 에이전트 호스트(창·OS 는 셸) | `shared/api/*` → `window.oo` → preload → 소유 표의 포트/IPC | (h) |
| 호스트가 화면을 갱신시킨다 | renderer | `infra/ipc/send.ts` 의 통지 함수 → 창 포트 → `shared/api` 구독 → 스토어 | (g) |
| renderer 가 무거운 계산을 한다 | 계산 워커 | `shared/compute/client.ts` | (b)(i) |
| renderer 가 세션 본문을 읽는다 | 데이터 호스트 | `shared/api/dataHost.ts` | (c) |
| 호스트가 창·OS·비밀을 쓴다 | main(셸) | 셸 서비스 클라이언트 | (f) |
| main 이 턴·세션 상태를 안다 | 에이전트 호스트 | 수명 이벤트 → `LifecycleState` | (e) |
| DB 를 읽거나 쓴다 | 에이전트 호스트의 `DbQueries` | `ctx.db` 주입 | (k)(e) |
| 프로세스를 띄운다 | 등록된 기동 모듈 | `infra/git/runner`·`infra/shell/shell-runner`·하네스 어댑터·`host-supervisor` | (j) |
| 요청 핸들러를 등록한다 | `infra/ipc/handle.ts` | `handle`·`handlePlain`·`on` | (d) |
| 파일을 읽는다 | 비동기 API | `fs/promises` | (a) |

- 가드의 실패 메시지는 위 표의 "요청하는 곳"과 "경로" 칸을 그대로 출력한다 — 규칙 표 하나(`scripts/ui-thread-rules.mjs`)가 판정과 메시지의 SSOT 다.
- 등록 표는 `{ file, count, class, reason }` 이다. `class` 는 `boot`(부팅·마이그레이션 전용) · `single-file`(파일 하나의 읽기·쓰기·존재 확인) · `capped`(상한 상수 있음) · `tooling`(프로덕션 경로 아님) 넷이다. 초기 등록은 §8 의 25파일에서 `plugin-catalog.ts` 를 뺀 24파일이다.
- **EP-11 규칙 칸** (`LifecycleState` — `lifecycle-state.test.ts` 입력): `turn.started` → 그 세션 활성 · 같은 세션 `turn.ended` → 비활성 · `approval.pending` → 승인 대기 표시, 그 세션의 `turn.ended` 가 지운다 · `session.ended` → 그 세션의 모든 표시 제거 · `harness.exited` → 그 세션 비활성 + 오류 표시 · 호스트 exit → 전체 비움 · 모르는 세션의 `turn.ended` → 변화 없음.
- **EP-12 규칙 칸** (`host-supervisor.test.ts` 입력): 에이전트 호스트 비정상 exit → 고아 종료 → 통지 → 상태 비움, 순서대로 · 데이터 호스트 exit → 통지만(고아 정리 없음) · shutdown 중 exit → 통지 0 · shutdown 3초 초과 → kill 1회 · 재기동 실패 3회 연속 → 더 띄우지 않고 부팅 오류 통지.
- **EP-6 규칙 칸** (조각 분할 — `data-host-chunks.test.ts` 입력): part 합이 500 이하인 세션 → 조각 1 · 1,200 part(메시지당 10) → 조각 3, 각 ≤ 500 · part 700 인 메시지 하나 → 단독 조각 · 메시지 0개 → `begin` + `end`, 조각 0.
- **선언 경계** (측정한 것만):
  - B1 — Markdown 변환은 renderer 메인 스레드에 남는다: 33,441자에서 51~95ms(§8). 이 handoff 는 `perf.stall` 로 드러내기만 한다.
  - B2 — 강조 HTML 과 원문의 DOM 삽입은 UI 스레드에 남는다: 강조 1,000줄 26ms, 원문 5,092줄 35ms(§8). 강조는 32,000자 상한으로 막고 원문 `<pre>` 에는 상한이 없다.
  - B3 — 한 에이전트 호스트가 모든 세션의 스트림을 맡는다: 한 세션의 무거운 턴 준비(스냅샷 파싱 23MB 에서 24ms, §8)가 다른 세션의 스트리밍을 그만큼 늦춘다. 창 조작은 막지 않는다. `perf.stall`(`thread:'agent-host'`)이 기록한다.
  - B4 — `native-session.ts:55` 의 `loadSession` 은 에이전트 호스트에서 돈다: 턴 시작의 복구 경로다. 비용은 세션 로드와 같고(1만 part 150ms) B3 과 같은 영향이다.
  - B5 — `handle()` 계측은 핸들러의 첫 `await` 전 동기 구간만 잰다. 그 뒤의 멈춤은 루프 모니터가 채널 이름 없이 잡는다.
  - B6 — 조각 하나의 바이트 크기에는 상한이 없다: part 하나가 수 MB 면 그 조각의 역직렬화가 길어진다.
  - B11 — 가드 (g)~(k)는 API 이름과 import 를 본다: 허용 모듈이 내보낸 함수를 받아 엉뚱한 시점에 부르는 것(예: 컴포넌트 렌더 중 `shared/api` 호출)은 잡지 못한다. 현재 트리의 기준선은 §8 전수 조사다 — (g) 위반 2곳·(h) 위반 9곳을 이번에 옮기고 (i)(j)(k) 는 0 이다.
  - B7 — 가드 (a)는 이름 토큰을 본다: `fs['read' + 'FileSync']` 같은 계산된 접근은 잡지 못한다. 트리에 그런 형태는 0 이다(§8 전수 조사).
  - B9 — 고아 선별은 "부모 pid = 죽은 호스트 pid"로 한다: 하네스가 다시 띄운 손자 프로세스는 그 하네스를 끝낼 때 OS 의 트리 종료(`taskkill /T`)에 맡긴다. 호스트가 죽은 직후 pid 가 재사용된 무관한 프로세스를 잡을 가능성은 재지 않았다 — 선별은 호스트 exit 처리 안에서 즉시 1회만 한다.
  - B10 — 호스트가 죽는 순간 메모리에만 있던 이벤트(저장 전 델타·진행 중 도구 호출)는 사라진다. DB 는 SQLite 트랜잭션 단위로 일관되고, 끊긴 자리는 `recoverSessionHistory` 가 다음 기동에서 정리한다(D-024 — 범용 대응은 "원자적 쓰기 + 재기동 복구"다).
  - B8 — unified patch 파싱은 UI 스레드에 남는다: 1.30MB 에서 10ms(§8). `PATCH_INLINE_MAX_CHARS=1_000_000` 을 넘는 patch 는 파싱하지 않고 기존 파싱 실패 폴백(원문 표시)으로 간다.
- 같은 규칙이 여러 레이어에 있다면 SSOT: 예산 수치는 `src/shared/perf-budget.ts`, 조각 상한과 메시지 스키마는 `src/shared/data-host.ts` 한 곳이다. 강조 상한 `HIGHLIGHT_MAX_CHARS=32_000` · diff 상한 `DIFF_INLINE_MAX_LINES=400` · patch 상한 `PATCH_INLINE_MAX_CHARS=1_000_000` 은 `shared/compute/limits.ts` 한 곳이다.
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면: 해당 없음.
- 비밀의 경계(D-018): 봉인된 값만 디스크에 있고 해제는 셸 서비스가 한다. 풀린 값은 요청한 호출의 응답으로만 호스트에 가고 로그·수명 이벤트에 싣지 않는다 — `wire-log` 의 redact 규칙이 셸 서비스 메시지에도 걸린다.
- 선택적 필드의 `true/false/undefined` 의미: `SessionLoadTicket.activity` 는 지금의 `LoadedSession.activity` 와 같다 — 없으면 "활동 정보 없음"이고 소비자는 지금처럼 다룬다.
- 외부 SDK 경계의 실제 요구 타입/의미: `utilityProcess.fork(modulePath, args, { serviceName })` 의 자식은 `process.parentPort` 로 받는다(`process.type === 'utility'`). `MessagePortMain` 은 `start()` 를 불러야 메시지가 흐른다. preload 는 `ipcRenderer.on(…, (e) => e.ports[0])` 로 받은 포트를 자기 격리 월드 안에 두고 메인 월드에 넘기지 않는다(D-026). 호스트의 `net.fetch` 는 기본 세션에서 나가고 커스텀 프로토콜을 지원하지 않는다.

## 11. 구현 설계

구현 순서는 표의 단계 번호를 따른다. 단계마다 게이트를 돌리고 다음으로 간다. 단계 4 가 가장 크다 — 로직을 고치지 않고 **조립 위치와 전송만** 바꾼다(`Bootstrap` 이 호스트에서 뜨고, Electron 호출 17파일이 셸 서비스를 부른다).

| 단계 | 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|---|
| 1 | `src/shared/perf-budget.ts` | 예산 상수 | 신규 | — |
| 1 | `src/main/infra/perf/stall-monitor.ts` | 루프 멈춤 판정 | 신규. 표본원(`() => maxMs` 후 reset)·시계·로거를 주입받는 순수 코어와 `monitorEventLoopDelay({ resolution: 10 })` 를 묶는 얇은 시작 함수. 1초 창마다 최댓값 1건 | 순수 단위 |
| 1 | `src/main/infra/ipc/handle.ts` | 동기 구간 계측 | 세 등록 함수가 `fn` 호출 전후 시각 차를 재고 50ms 이상이면 `perf.stall`(`source:'ipc'`, `label: channel`). 시계 주입 가능 | 순수 단위(기존 테스트 파일) |
| 1 | `src/renderer/src/shared/perf/longTaskReporter.ts` · `main.tsx` | long task 보고 | 신규. 항목을 1초 창으로 묶어 `logEmit` 1건(`count`·`maxMs`) | 순수 단위(관측자 주입) |
| 2 | `scripts/{check-ui-thread,ui-thread-rules}.mjs` · `.test.mjs` · `ci.yml` · `package.json` test 스크립트 · `features/chat`·`shared/{logging,errors}` 의 `window.oo` 9곳 | 가드 | 신규. 규칙 (a)~(d)·(g)~(k) 와 안내 메시지. `window.oo` 9곳은 `shared/api` 함수로 옮긴다. `--list` 는 발견 목록 출력. `ci.yml` 의 테스트 예산 가드 뒤에 단계 추가 | `node --test` |
| 3 | `shared/compute/{protocol,client,limits,inline}.ts` | 계산 클라이언트 | 신규. `WorkerLike`(`postMessage`·`terminate`·`onmessage`·`onerror`) 팩토리를 주입받는다 | 순수 단위(가짜 워커) |
| 3 | `shared/compute/worker/{compute.worker,handler}.ts` | 워커 | 신규. `handler.ts` 는 요청 → 응답 순수 함수, `compute.worker.ts` 는 `self.onmessage` 배선만 | 순수 단위(`handler`) |
| 3 | `shared/ui/markdown/{CodeBlock.tsx,syntax.ts}` | 강조 소비 | `syntax.ts` 의 하이라이터 생성을 `worker/` 로 옮기고 `isLang` 등 순수 판정만 남긴다. `CodeBlock` 은 `useHighlightedHtml` 로 받는다 | 기존 렌더 테스트 |
| 3 | `features/chat/lib/{diffSyntax,diffLines,toolMeta,unifiedDiffLines}.ts` · `hooks/useDiffSyntax.ts` · 신규 `hooks/useDiffLines.ts` · `DiffBody.tsx` · `filePresentation.ts` | diff 소비 | jsdiff 호출을 `inline.ts`/워커로. 순수 함수 소비처는 상한 초과 시 `null` 을 받는다. `parsePatch` 는 `inline.ts` 의 상한 있는 함수로 옮긴다(B8) | 순수 단위 |
| 3 | `electron.vite.config.ts` | 워커 번들 | `renderer.worker.format = 'es'` | 사람 실기(AC23) |
| 4 | `src/shared/{channel-owner,host-protocol}.ts` | 채널 소유 표·포트 메시지 스키마 | 신규. 123개 채널 전부에 소유자를 적는다 — 셸은 창 조작·트레이·업데이트·부팅 대기·호스트 연결, 나머지는 호스트 | typecheck · 순수 단위 |
| 4 | `src/main/contracts/client.ts` + `WebContents` 타입을 쓰는 24파일 | 창 참조 | `WebContents`·`IpcMainInvokeEvent` 타입을 `ClientRef`·`RequestEvent` 로 바꾼다. 동작 변경 없음 | 기존 테스트(가짜 창 → 가짜 `ClientRef`) |
| 4 | `src/main/infra/ipc/{handle,send,transport}.ts` | 전송 선택 | `handle`·`handlePlain`·`on`·통지 함수가 주입된 전송(셸 = `ipcMain`/`webContents`, 호스트 = 포트 서버)을 쓴다. `bootstrap.ts:649`·`:1155` 의 직접 순회는 `send.ts` 의 방송으로 | 순수 단위(가짜 전송) |
| 4 | `src/main/app/agent-host/{entry,shell-client,lifecycle-emitter}.ts` | 호스트 조립 | 신규. `entry` 가 포트 서버·셸 서비스 클라이언트를 만들고 `Bootstrap.start()` 를 부른다. 경로·버전은 fork 인자로 받는다 | 순수 단위(`lifecycle-emitter`·`shell-client`) |
| 4 | Electron 값 import 17파일 | 셸 서비스 어댑터 | `infra/config/crypto.ts`·`handlers/{files,artifacts,skills,error,extension-catalog,misc}.ts`·`infra/browser-session.ts`·`net-request.ts`·`updater.ts`·`infra/{db,log}/index.ts`·`bootstrap.ts` 의 Electron 호출을 주입된 셸 서비스 호출로 바꾼다 | 기존 테스트 + `services.test.ts` |
| 4 | `src/main/app/shell/{host-supervisor,services,lifecycle-state,orphans,boot}.ts` · `src/main/index.ts` · `tray-residency.ts` · `updater.ts` | 셸 | 신규 + `index.ts` 축소. 창·트레이·`app://`·업데이트 UI·호스트 감독만 남는다. 재시작 게이트와 트레이 판정은 `LifecycleState` 를 본다 | 순수 단위(Electron 주입) |
| 4 | `src/preload/index.ts` | 전송 선택 | `invoke(channel)` 가 소유 표로 `ipcRenderer.invoke` 또는 호스트 포트 요청을 고른다. 통지 구독도 같다. 포트 재수신 시 교체하고 미응답 요청은 실패시킨다. `window.oo` 형상 불변 | 기존 `preload/index.test.ts` |
| 4 | `features/chat/store/chatStore.ts` · `shared/i18n/ko.ts` | 호스트 종료 반영 | 종료 통지 → busy 세션을 오류 메시지와 함께 idle 로. 재연결 통지 → 목록·활성 세션 재조회 | 기존 스토어 테스트 |
| 4 | `electron.vite.config.ts` · `scripts/check-ui-thread.mjs` | 번들·가드 | main 입력에 `agent-host` 진입점. 가드 규칙 (e)(f) 추가 | 사람 실기(AC23) · `node --test` |
| 5 | `src/shared/data-host.ts` | 메시지 계약·분할·조립 | 신규 | 순수 단위 |
| 5 | `src/main/app/data-host/{entry,session-load}.ts` | 데이터 호스트 | 신규. 감독은 단계 4 의 `host-supervisor` 가 한다. `entry` 는 DB 경로를 인자로 받는다 | io(`session-load`) |
| 5 | `electron.vite.config.ts` | 호스트 번들 | `main.build.rollupOptions.input` 에 `data-host` 진입점 추가 | 사람 실기(AC23) |
| 5 | `src/shared/ipc.ts` · `protocol.ts` · `preload/index.ts` · `renderer shared/api/{ipc,dataHost}.ts` | 응답 계약·포트 | `SessionLoadTicket` · `RefreshSessionResult.updated` 에서 `session` 제거 · `CHANNELS.dataHostConnect`·`dataHostPort`·`dataHostExited` 추가 | 기존 preload·핸들러 테스트 |
| 5 | `src/main/app/handlers/session.ts` | 핸들러 | 두 핸들러가 티켓만 돌려준다(에이전트 호스트에서 돈다) | 기존 핸들러 테스트 |
| 5 | `features/chat/store/chatStore.ts` | 취소 배선 | `loadSession`·`refresh` 가 `AbortSignal` 을 넘기고 `sessionLoads` 교체·삭제 때 abort 한다 | 기존 스토어 테스트 |
| 6 | `adapters/claude/{adapter,plugin-catalog}.ts` | 비동기 카탈로그 | **rev 3 — §7-B 의 단계 6′ 로 대체** | — |
| 7 | `docs/arch/execution-model.md` · `docs/decisions/012-execution-contexts.md` · `docs/INDEX.md` · `IPC_CONTRACT.md` · `arch/frontend/rendering.md` §1.3 · `arch/backend/{overview,runtime-ipc,security}.md` · root·`app`·`main`·`renderer` 의 `AGENTS.md` · `app/AGENTS.md` CI 표 | 문서 | 현재 상태로 갱신. 경로 표와 "직접 호출 금지 — 가드 `check-ui-thread` 가 막는다"를 넣는다. 수치는 상수 경로로 적는다 | 문서 가드 · AC34 |

### 계산 클라이언트의 규칙 (MD-01)

| 규칙 | 내용 |
|---|---|
| 동시 실행 | 워커에 나가 있는 요청은 1개다 |
| 순서 | 대기열은 입력 문자 수 오름차순, 같으면 먼저 온 것 |
| 캐시 | 키 = `종류 + 언어 + 테마 + 내용`. 결과 문자 수 합 4,000,000 초과 시 가장 오래 안 쓴 것부터 버린다 |
| 중복 | 같은 키의 요청이 대기·실행 중이면 그 Promise 를 공유한다. 공유자가 모두 취소해야 취소다 |
| 취소 | 대기 중이면 대기열에서 뺀다. 실행 중이고 대기 요청이 있으면 `terminate()` 뒤 새 워커로 대기열을 잇는다. 대기 요청이 없으면 끝나길 기다리고 결과는 캐시에만 넣는다 |
| 실패 | 생성 실패·`error`·`messageerror` → 실행 중 요청 reject, 오류 로그 1건, 워커 폐기. 연속 3회면 이후 요청을 즉시 reject 한다. 성공 응답이 오면 연속 횟수는 0 이 된다 |

### 세션 로드의 규칙 (MD-02 · SD-02)

| 단계 | 누가 | 내용 |
|---|---|---|
| 티켓 | 에이전트 호스트 `oo:session:load` | `compactLegacyRaw` → `{ activity }` 반환. 본문을 읽지 않는다 |
| 연결 | preload → main `oo:data-host:connect` | 데이터 호스트가 없으면 fork. `MessageChannelMain` 의 한쪽은 호스트에, 다른 쪽은 요청한 창의 preload 에 보낸다 |
| 요청 | renderer → 호스트 | `{ type:'session.load', requestId, sessionId }` — zod 검증 실패는 `error` |
| 응답 | 호스트 → renderer | `begin{head}` → `chunk{seq, messages}` × n → `end{messageCount}`. 세션이 없으면 `end{missing:true}` |
| 양보 | 호스트 | 조각 사이에 매크로태스크 1회를 넘겨 `cancel` 을 받는다 |
| 조립 | renderer | `seq` 가 0 부터 이어지고 메시지 수가 `messageCount` 와 같으면 `LoadedSession` 을 만든다. 어긋나면 실패 |
| 반영 | `chatStore` | 지금의 `isCurrent()` 판정 뒤 `LOAD_SESSION` 1회. 조각 수신 중에는 스토어를 건드리지 않는다 |

### 에이전트 호스트의 규칙 (SD-04 · AR-06~AR-09)

| 항목 | 규칙 |
|---|---|
| 기동 | main 이 `app.whenReady` 뒤 창 생성과 함께 fork 한다. 호스트는 DB 를 열고 마이그레이션한 뒤 `ready` 를 보낸다. 백업 진행 통지는 지금처럼 부팅 화면에 간다 |
| 창 연결 | 창마다 `MessageChannelMain` 하나 — 한쪽은 호스트(창 id 와 함께), 한쪽은 preload. 호스트는 그 포트를 `ClientRef` 로 등록하고 닫히면 지운다 |
| 요청 | `{ id, channel, payload }` → `{ id, ok, value \| error }`. 검증·정책(`reject`/`fallback`)은 지금의 `handle()` 그대로다 |
| 통지 | `{ channel, payload }`. 대상 지정은 `ClientRef`, 방송은 등록된 전부 |
| 셸 서비스 | 호스트 → main 요청 8종(§10 EP-10). 응답 전까지 호출한 코드는 기다린다 — 동기 Electron 호출이던 자리(`safeStorage`)는 비동기가 된다 |
| 수명 이벤트 | 호스트 버스의 정규화 이벤트에서 만든다 — 턴의 첫 이벤트 → `turn.started`, `telemetry`·`error`·취소 → `turn.ended`, 승인 요청 → `approval.pending`, 세션 폐기 → `session.ended`, 하네스 스트림이 종료 없이 끊김 → `harness.exited` |
| 비정상 종료 | main: 고아 종료(부모 pid 일치 → `taskkill /T /F` 또는 `kill`) → 모든 창에 `oo:agent-host:exited` → `LifecycleState` 비움. 다음 호스트 채널 요청이 재기동을 부른다 |
| 재기동 | 연속 3회 실패하면 더 띄우지 않고 부팅 오류를 알린다. 성공하면 열려 있는 창에 새 포트와 `oo:agent-host:ready` 를 보낸다 |
| 종료 | `will-quit` → 데이터 호스트 종료 → 에이전트 호스트에 `shutdown` → 예약 작업 `dispose` → `Scheduler.stopAll()` → `closeDb` → exit. 3초 초과 시 kill |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `stall-monitor.ts`(코어) · `shared/data-host.ts` · `shared/compute/client.ts` · `shared/compute/worker/handler.ts` · `host-supervisor.ts`(fork·채널·프로세스 목록·시계 주입) · `lifecycle-state.ts` · `orphans.ts` · `infra/ipc/transport.ts`. 두 호스트의 `entry.ts` 와 `compute.worker.ts` 는 배선만 갖고 단위 테스트 대상이 아니다 — AC23 이 닫는다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `logEmit` 은 단방향 `send` 라 long task 보고가 응답을 기다리지 않는다. `isCurrent()` 는 `await sessionApi.load` 의 길이와 무관하게 성립한다.
- 순서를 관측할 훅/로그/주입 경계: `shutdown()` 의 호스트 종료 → `closeDb` 순서는 주입한 가짜의 호출 기록으로 본다.
- 풀 분류: `session-load.test.ts` 는 SQLite 를 쓰므로 io, 나머지 신규 테스트는 unit 이다(`app/AGENTS.md` vitest 풀 분류).

## 12. End-to-end 영향

### producer → consumer

```text
호스트 loadSession() → 조각 메시지 → dataHost 조립 → sessionApi.load → chatStore LOAD_SESSION → transcript
워커 handler → 응답 → computeClient 캐시 → useHighlightedHtml/useDiffSyntax/useDiffLines → CodeBlock/DiffTable
```

- producer 기준: 호스트의 `LoadedSession` 은 `features/history/reader.ts` 의 `loadSession` 을 그대로 부른 값이다 — 조립 규칙의 사본을 만들지 않는다.
- consumer 파생 규칙: `chatStore` 는 조립된 `LoadedSession` 에 티켓의 `activity` 를 얹어 지금과 같은 형상을 받는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 조각은 전송 단위일 뿐 스토어에 들어가지 않는다(D-011).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `sessionApi.load` 호출부(`chatStore.ts:1792`) | 반환 형상은 그대로, 대기 시간만 달라진다 | AC15·VP-20 |
| `sessionApi.refresh` 호출부(`chatStore.ts:1840`) | `updated` 응답에 `session` 이 없다 → 호스트에서 다시 받는다 | AC19 |
| `shutdown()` 순서(`index.ts` will-quit → `closeDb`) | `closeDb` 는 에이전트 호스트 안에서 돈다. main 은 종료를 요청하고 기다린다 | AC32 |
| `turn.event` 구독 순서(`bootstrap.ts:1006~1017`) | 호스트 안에서 그대로 등록된다 | VP-30 |
| 업데이트 재시작 게이트·트레이 종료 판정 | 입력이 main 메모리의 턴 상태에서 `LifecycleState` 로 바뀐다 | AC28·VP-31 |
| `safeStorage` 를 동기로 부르던 호출부(`infra/config/crypto.ts` 소비처) | 비동기가 된다 — 호출부를 전수로 `await` 로 바꾼다. 구현자는 `rg -n "encryptString\|decryptString\|crypto\." app/src/main --glob '!*.test.*'` 로 분모를 고정해 보고한다 | AC27 |
| `window.oo` 를 쓰는 renderer 코드 전부 | 형상 불변 — 전송만 바뀐다 | AC24 |
| `ci.yml` 단계 목록과 `app/AGENTS.md` CI 표 | 가드 단계 1개 추가 | AC1 |
| `getHighlighter` 소비처 2곳 | 워커 쪽으로 옮겨져 renderer 메인 번들에서 사라진다 | AC3·AC8·AC9 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 계산 워커는 첫 계산 요청, 에이전트 호스트는 부팅, 데이터 호스트는 첫 `oo:data-host:connect` 에 만든다. 멈춤 모니터는 셸과 에이전트 호스트가 각각 시작 때 켠다.
- 취소/중단: 계산은 §11 취소 규칙. 세션 로드는 `AbortSignal` → `cancel` 메시지 → 호스트가 다음 조각부터 중단.
- 종료/quit/crash/renderer-gone: 창이 닫히면 워커가 함께 끝난다. `webContents` 가 사라지면 호스트 쪽 포트가 닫힌다. 호스트가 죽으면 main 이 `oo:data-host:exited` 를 모든 창에 보내고 클라이언트는 진행 중 요청을 reject 한 뒤 포트를 버린다.
- retry/timeout/partial failure: 호스트 요청은 30초 안에 `end`·`error` 가 없으면 실패다. 자동 재시도는 없다 — 사용자가 다시 연다.
- cleanup/rollback: 종료 순서는 §11 에이전트 호스트의 규칙 "종료" 행이다. 에이전트 호스트 비정상 종료의 처리 순서는 같은 표의 "비정상 종료" 행이다.
- **다중 저장소 쓰기**: 새 쓰기 경로가 없다 — DB 쓰기 연결은 에이전트 호스트 하나이고 쓰는 코드와 순서는 지금과 같다. 설정 파일(`orcinus-orca.json`·봉인된 비밀)도 호스트가 쓰고 main 은 쓰지 않는다. 산출 문서의 상태 사본은 이 plan 의 메타와 `INDEX.md` 행 두 곳이다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: `perf.stall` 은 main 1건/초 + 에이전트 호스트 1건/초 + renderer 창당 1건/초다. 조각은 part 500개 × 조각 수(세션 part 수 / 500)다.
- 새 요청 수의 `원천 상한 × 배치 상한`: 계산 요청은 화면에 놓인 코드 블록 수(가상 스크롤이 제한)이고 워커 동시 실행은 1 이다. 호스트 요청은 세션 열기·갱신당 1 이다.
- 구조적 목표: 해당 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과와 회귀 테스트: 강조 캐시는 테마를 키에 넣어 테마 전환 뒤 옛 색이 남지 않는다 — `client.test.ts` 에 "테마만 다른 요청은 전송된다" 케이스를 둔다.
- 메모리: 프로세스 2개(에이전트 호스트·데이터 호스트)와 창당 워커 1개가 는다. 늘어나는 양은 재지 않았다 — 실기 AC23 에서 작업 관리자 값을 함께 적는다. 워커는 shiki 문법 11종을 한 벌 더 갖는다(renderer 메인 번들에서는 빠진다).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 배포·플러그인이 구현할 포트를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| IPC 채널을 바꾸면 `IPC_CONTRACT.md` 를 같은 PR 에서 갱신 | `docs/AGENTS.md` 작성 규칙 6 | §11 단계 4·6 | 유지 — 갱신 대상에 포함 |
| `src/main` 최상위는 `{app, contracts, adapters, features, infra}` 뿐 | `app/src/main/AGENTS.md` | §9 호스트 위치 `app/data-host/` | 유지 |
| renderer 4-layer — `shared` 는 `shared` 만 의존 | `app/src/renderer/AGENTS.md` | §9 `shared/compute/**` | 유지 |
| TRD 스택 밖 패키지는 사용자 승인 | `app/AGENTS.md` 의존성 정책 | §17 | 유지 — 신규 의존성 0 |
| 보안 베이스라인(`sandbox`·`contextIsolation`) | `app/AGENTS.md` | §10 preload 포트 전달 | 유지 — 옵션 불변, 포트 전달 경로를 `security.md` 에 적는다 |
| 텔레메트리는 미정 항목 | PRD §11 | D-013 | 유지 — 로컬 로그만 |
| 편집 미리보기는 1MiB 상한으로 main 에서 동기로 읽는다(0229 E-006) | `adapters/claude/edit-preview.ts:87` | §10 EP-1 등록 `capped` | 유지 |
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | root `AGENTS.md` 원칙 4 | §11 단계 6 | 유지 — arch 문서는 상수 경로를 적는다 |
| 연구 문서 §5.2 "main 의 기존 경로로 한 번 대체" | `vscode-comparison-and-proposal.md` | D-009 | 변경 — 대체 경로는 멈춤의 원인이라 두지 않는다 |
| 0323 D-015 "역할·워커 작업 우선" | 0323 plan | D-001 | 유지 |
| 내장 서비스 credential 은 main 에 유지한다 | `app/AGENTS.md` 보안 베이스라인 · `security.md` §1.4-b | D-018 · §10 비밀의 경계 | 변경 — 사용자가 갱신을 허용했다. 봉인·해제는 main, 풀린 값은 에이전트 호스트까지 |
| 구독 등록 순서는 `app/bootstrap.ts` 한 곳이 소유한다 | `app/src/main/AGENTS.md` 단일 턴 이벤트 파이프라인 | §12 | 유지 — `Bootstrap` 이 호스트에서 뜰 뿐이다 |
| 원격 요청은 Chromium `net.fetch` 단일 스택 | ADR-003 · `app/src/main/AGENTS.md` | §4-B · §10 EP-10 | 유지 — 호스트도 `net.fetch` 를 쓰고 파티션 세션 요청은 셸 서비스가 한다 |
| Windows 창 닫기 = 트레이 상주, 종료 중 통과 | 0322 plan | AC28·VP-31 | 유지 — 판정 입력만 바뀐다. 0322 는 검증 대기 중이라 구현 순서를 §17 에 적었다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 워커·호스트의 실제 기동은 에이전트 환경에서 실행할 수 없다 | 배선 파일을 얇게 두고 로직을 주입 가능한 순수 파일에 둔다. 실기는 AC23 |
| 세션 로드가 두 번의 왕복(티켓 → 호스트)이 된다 | 작은 세션에서 수 ms 가 는다. 그 사이의 라이브 이벤트는 기존 `liveChanged` 가 막는다(VP-20) |
| 32,000자 초과 코드가 강조 없이 보인다 | D-012 — 사용자가 거부하면 줄 블록 단위 점진 반영으로 다시 설계한다 |
| 한 handoff 의 AC 가 35건이다 | D-022. §11 의 7단계 순서로 구현하고 단계마다 게이트를 돌린다. 25건 기준을 넘는 것은 사용자 결정이다 |
| 단계 4 가 main 의 조립 전체를 건드린다(소스 437파일 중 Electron 값 import 17·창 타입 24·테스트 488) | 로직을 고치지 않고 조립 위치·전송·창 타입만 바꾼다. 가드 (e)(f)가 경계를 잠근다 |
| `safeStorage` 호출이 비동기가 되며 호출부가 연쇄로 바뀐다 | §12 의 분모 고정 항목. 호출부가 예상보다 넓으면 구현자가 PLAN_GAP 으로 돌린다 |
| 0322(트레이 상주)가 검증 대기 중이고 같은 파일(`index.ts`·`tray-residency.ts`)을 고친다 | 0322 가 PASS 한 뒤 단계 4 를 시작한다. 단계 1~3 은 겹치지 않아 먼저 할 수 있다 |
| 고아 선별이 pid 재사용에 취약할 수 있다 | B9 — exit 처리 안에서 즉시 1회. 실기 시나리오 8 이 확인한다 |
| 한 에이전트 호스트가 모든 세션을 맡아 세션끼리 늦출 수 있다 | B3 — 창 조작은 막지 않는다. `perf.stall` 로 본다 |
| 실행 중 강조가 길면 뒤 요청이 기다린다 | 짧은 것 먼저 + 취소 시 워커 교체. 기다리는 동안은 원문이라 조작은 막히지 않는다 |
| 호스트가 창에서 온 요청을 직접 받는다 | 요청마다 지금의 zod 검증을 그대로 거친다. 포트는 preload 가 쥐고 페이지에 내주지 않는다(D-026) |

- 되돌리기 어려운 결정: 프로세스 구조(main 셸 + 호스트 2개) — 이후의 모든 main 코드가 이 경계를 전제로 쓰인다 · `oo:session:load`·`oo:session:refresh` 응답 형상 변경(같은 릴리스 안의 코드만 쓰므로 버전 호환 문제는 없다).
- 신규 의존성: 없음 → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{perf-budget,data-host,channel-owner,host-protocol,ipc,protocol}.ts`
- `app/src/main/infra/{perf/stall-monitor,ipc/handle}.ts` · `app/src/main/app/{bootstrap.ts,handlers/session.ts,data-host/*}` · `app/src/main/adapters/claude/{adapter,plugin-catalog}.ts`
- `app/src/main/{index.ts,contracts/client.ts,infra/ipc/{handle,send,transport}.ts,app/agent-host/*,app/shell/*,app/tray-residency.ts,app/updater.ts}` · Electron 값 import 17파일 · `WebContents` 타입 24파일(§8)
- `app/src/preload/index.ts`
- `app/src/renderer/src/{main.tsx,shared/compute/**,shared/perf/**,shared/api/{ipc,dataHost}.ts,shared/ui/markdown/{CodeBlock.tsx,syntax.ts}}`
- `app/src/renderer/src/features/chat/{lib/{diffSyntax,diffLines,toolMeta}.ts,hooks/{useDiffSyntax,useDiffLines}.ts,store/chatStore.ts}` · `DiffBody.tsx` · `filePresentation.ts` · `shared/i18n/ko.ts`
- `app/scripts/check-ui-thread.{mjs,test.mjs}` · `app/electron.vite.config.ts` · `app/package.json`(test 스크립트만) · `.github/workflows/ci.yml`
- `docs/arch/execution-model.md` · `docs/decisions/012-execution-contexts.md` · `docs/INDEX.md` · `docs/IPC_CONTRACT.md` · `docs/arch/frontend/rendering.md` · `docs/arch/backend/{overview,runtime-ipc,security}.md` · root `AGENTS.md` · `app/AGENTS.md` · `app/src/{main,renderer}/AGENTS.md` · `docs/generated/inventory.md`(재생성)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` "better-sqlite3 ABI · 제약 환경 게이트 가이드" · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md` · `docs/AGENTS.md`.
- ABI/네트워크 등 환경 제약: Electron 바이너리를 받지 못하는 환경에서는 `dev`·`build` 를 돌리지 못한다. DB 로드 스위트의 바인딩 실패는 알려진 서명으로 분리한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: 수정 루프는 `./node_modules/.bin/vitest run <suite>`. IMPL_DONE 전에는 `app/AGENTS.md` "로컬 확인"의 명령 전부와 `node scripts/check-ui-thread.mjs`.
- 사람 실기(AC22): Windows 에서 아래를 수행하고 로그의 `perf.stall` 을 센다. 각 시나리오 중 스크롤·입력·창 드래그를 함께 한다.

| # | 시나리오 | 보는 것 |
|---|---|---|
| 1 | 800줄 TypeScript 코드 블록이 있는 메시지를 연다 | 원문이 먼저 보이고 색이 뒤에 입혀진다. 그동안 스크롤이 끊기지 않는다 |
| 2 | 5,000줄 파일을 출력 뷰어로 연다 | 강조 없이 열리고 스크롤이 끊기지 않는다 |
| 3 | 2,000줄 이상 바뀐 파일의 diff 타일을 연다 | 로딩 표시 뒤 diff 표. 그동안 다른 타일을 누를 수 있다 |
| 4 | part 5,000개 이상인 세션을 여는 동안 다른 세션이 스트리밍 중이다 | 스트리밍 글자가 멈추지 않고 창을 끌 수 있다 |
| 5 | 세션 10개를 빠르게 번갈아 누른다 | 마지막에 누른 세션이 열린다. 입력창 타이핑이 끊기지 않는다 |
| 6 | 스트리밍 중에 창을 최대화·복원하고 입력창에 타이핑한다 | 끊김이 없다 |
| 7 | 앱을 다시 켠 뒤 큰 세션(native 이력 있음)에 이어서 보내고, 보낸 직후 창을 끈다 | 창이 바로 따라온다. 다른 세션의 스트리밍이 잠깐 늦을 수 있다(B3) |
| 8 | 스트리밍 중에 작업 관리자로 에이전트 호스트 프로세스를 끝낸다 | 그 세션에 오류 알림, 입력창 사용 가능, 하네스 프로세스가 남지 않는다, 다음 전송이 된다 |

- 사람 실기(AC23): `npm run build:win` 산출물을 설치해 시나리오 1·4 와 전송 1회를 수행하고, 작업 관리자의 프로세스별 메모리를 적는다.

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — D-001~D-028, SUPERSEDED 2(D-005·D-010), OPEN 0.
- [x] Part I 만 읽어도 사용자/제품 완료 상태가 이해된다 — §1·§5 상태표.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "(로딩표시 제외)"·"전부"의 해석은 §2 추론 의도에 따로 적었다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 상태표 15행 ↔ AC5~AC35.
- [x] Technical Design 에 AS-IS 와 TO-BE 가 모두 있고 같은 축으로 작성되어 있다 — §9 네 경로.
- [x] AS-IS → TO-BE Delta 의 각 변경이 구현 파일/모듈 또는 AC 에 추적 가능하다 — Delta 12행 모두 V 칸 보유.
- [x] AS-IS 에서 사라진 책임은 삭제/이동/대체 중 무엇인지 TO-BE 에 명시했다 — 강조·세션 본문·턴 실행부는 이동, 동기 카탈로그는 삭제.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8. 전칭 1건("모든 invoke 가 등록 함수를 지난다")은 반례 4로 정정했다.
- [x] 각 AC 가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 35행.
- [x] Baseline V 를 썼고 유효 V 를 재구성할 수 있다 — V1.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW/CHANGED node 에 같은 레벨 REQUIRED pair 가 있다 — R 9·SD 3·AR 10·MD 7 ↔ VP-01~VP-19·VP-21~VP-29·VP-32.
- [x] 영향받은 INHERITED node 는 REGRESSION 이다 — SD-03 ↔ VP-20 · SD-05 ↔ VP-30 · SD-06 ↔ VP-31.
- [x] 각 pair 의 경로·§10 분모·oracle 좌표가 있고 적대 증거는 VP-02·VP-12·VP-18·VP-21·VP-27·VP-32 만 선택했다.
- [x] 규칙 칸의 분기마다 UT 입력 칸에 그 분기로 가는 입력이 있다 — EP-1 31분기 · EP-6 4분기 · EP-11 7분기 · EP-12 5분기 · AC5 4표본 · AC10 2표본.
- [x] 선언 경계를 §10 에 적었다 — B1~B11. 가드는 fail-closed 다.
- [x] INDEX `## 새 handoff 후보` 표에서 겹치는 행을 확인했다 — `chatStore.ts` 를 짚는 0308 행 1건은 이미 0319 로 승격됐고 그 형태(`sessionBusy` 소비처 잠금)는 이번 변경이 만들지 않는다. 그 밖에 겹치는 행 0.
- [x] 현재 변경 산출물의 운영 gate 가 열거됐다 — §7-A 4행.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 실기는 프레임과 프로세스 기동뿐이다.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — "UI 스레드에서 강조하지 않는다"는 가드(AC3)와 행동(AC8·AC12)을 짝지었다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §9 책임표·§10.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 10행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·총량·one-way door 를 필요한 곳에서 계산했다 — §14·§17.
- [x] 게이트 명령이 대상 subtree 의 현재 `AGENTS.md` 와 충돌하지 않는다 — §19.
- [x] 본문 완성 후 Decision Ledger 와 기존 결정을 교차검증했고 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md). 필드와 표의 열은
> [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md) 의 `[구현자 기입]` 을 그대로 쓴다.

## [구현자 기입] 설계 리뷰

**r1 — 미완료(partial). 사용자 지시(2026-11-16)로 단계 1~3 에서 멈추고 다른 에이전트가 잇는다.** 단계 4·5·6·7 은 손대지 않았다.

| 항목 | 판정 | 근거 |
|---|---|---|
| EP-7 "`adapter.ts:609` 를 `await` 로" | `PLAN_GAP` — 그 경로 멈춤 | `openChannel`(`adapter.ts:497`)과 `sendMessage`(`:446`)는 동기 함수다. 호출부 `session-runtime.ts:496` 은 admission 판정 직후 동기로 spawn 한다 — `await` 를 넣을 자리(포트에 준비 단계 추가·판정과의 순서·준비 중 취소)가 계약 결정이다 |
| EP-10 "Electron 값 import 17파일을 8종에 배정, 미배정 0" | `PLAN_GAP` — 단계 4 착수 전 정정 필요 | `electron-store` 를 쓰는 3파일(`infra/settings-store.ts`·`infra/config/secret-store.ts`·`features/auth/store-file.ts`)이 분모에 없다. `node_modules/electron-store/index.js:3` 이 `require('electron').app` 으로 경로를 얻어 utility 프로세스에서 생성자가 실패한다. 검색 술어가 직접 import 만 봤다 |
| §8 "`window.oo` 밖 9곳" | 구현 세부 — 선조치 | 주석·테스트 지원 파일을 뺀 코드 자리는 6곳이다(가드 `--list` (h)). 6곳을 `shared/api` 로 옮겼다 |
| §10 "(e)(f) import 목록은 `ts.preProcessFile`" | 설계 대비 차이 | `preProcessFile` 은 `import type` 을 가르지 못한다. `ts.createSourceFile` AST 로 뽑았다 — 리터럴이 아닌 지정자·풀 수 없는 상대 경로는 실패다(fail-closed 유지) |
| §10 등록 표 class 4종 | 보고만 | 디렉토리 하나를 열거하는 2파일(`extensions/claude/scaffold.ts`·`harnesses/common/settings.ts`)에 맞는 class 가 없어 `single-file` 로 두고 reason 에 적었다 |
| `perf.stall` 로그 레벨 | 구현 세부 | `info` 로 남긴다. warn/error 는 `RepeatSuppressor`(60초 창, `infra/log/suppress.ts`)가 삼켜 AC5·AC22 의 건수를 셀 수 없다 |

**r1.2 — 코드 변경 없음. 밀린 마지막 gate 를 돌리고 `PLAN_GAP` 근거를 보강했다.** 단계 4·5·6·7 은 여전히 미착수다.

| 항목 | 판정 | 근거 |
|---|---|---|
| EP-10 `electron-store` 3파일 — r1 의 "생성자가 실패한다" | 정정 — 실패하지 않고 **다른 경로에 조용히 쓴다** | `electron` 에 `app`·`ipcMain` 이 없는 형상으로 `electron-store@8.2.0` 을 열면 `cwd` 없이는 `~/.config/electron-store-nodejs/r.json` 에, 절대 `cwd` 를 주면 그 디렉토리에 쓴다(Node 프로브 3케이스 모두 예외 0). 호스트가 `cwd` 없이 열면 설정·비밀·인증 파일이 `userData` 밖에 새로 생긴다 |
| 설정 파일의 쓰기 주체 | `PLAN_GAP` — 단계 4 착수 전 결정 필요 | 셸에 남는 코드가 `SettingsStore` 를 읽고 쓴다 — `index.ts:160`(`windowBounds` 읽기)·`:202`(`patch`) · `tray-residency.ts:73`(`uiLocale`)·`:85`(`onPatch`). `rg -c "settings\.(getAll\|patch\|onPatch)\("` 는 `src/main` 에서 합 35 / 10파일이다. `SettingsStore` 는 메모리 캐시 + 통째 쓰기(`settings-store.ts:51-53`)라 두 프로세스가 같은 파일을 열면 서로의 쓰기를 덮는다. plan 에 소유 프로세스가 없다(`grep -n "windowBounds\|SettingsStore" plan.md` → `[구현자 기입]` 밖 0줄) |
| EP-7 `await` 자리 | `PLAN_GAP` 유지 — 근거 보강 | 카탈로그 결과는 `openChannel` 의 동기 구간 4곳에서 쓰인다 — `adapter.ts:617`(flags) · `:671-684`(query 옵션, `deferClaudeQuery` 안) · `:835`(`claudeNativeResources`) · `:850`(`ClaudeProjectReconciliation`). 지연 가능한 것은 query 옵션 하나뿐이다 |

## [구현자 기입] 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-1 (11) | 규칙 (a)~(k) | 판정 11/11 구현 · 실제 트리 green 은 (a)(d)(g)(h)(i)(j)(k) 7 | `scripts/check-ui-thread.test.mjs` 규칙별 describe. 남긴 곳: (b) `lib/unifiedDiffLines.ts` 제외 전부 닫힘 → 실제 트리 위반 0 · (c) `handlers/session.ts:17`(단계 5) · (e) 셸 그래프 전체(단계 4) · (f) 호스트 진입점 없음(단계 4·5) · 문서 대조(단계 7) |
| EP-2 (7) | 등록 함수 3 + `index.ts` 직접 등록 4 | 7/7 | `infra/ipc/handle.test.ts` "동기 구간 계측" 5케이스 · `rg "ipcMain\." src/main/index.ts` → 0줄 · 가드 (d) |
| EP-3 (9) | UI 스레드 계산 호출 9 | 9/9 | `CodeBlock.compute.test.ts` · `hooks/useDiffCompute.test.ts` · `lib/toolMeta.test.ts`(401) · `opencode/transcript/filePresentation.test.ts` · 가드 (b) 실제 트리 위반 0 |
| EP-4·5·6·8~12 | — | 0 | 단계 4·5 미착수 |
| EP-7 (1) | `adapter.ts:609` | 0/1 | `PLAN_GAP`(위) |

V-pair 자기 상태: `SELF_PASS` 로 올린 pair 없음 — 열거 원문 sweep 과 등록 변이(VP-02·VP-12·VP-32)를 돌리지 않았다.

r1.2: 닫은 자리 변화 없음 — 위 표 그대로다. `SELF_PASS` 0.

## [구현자 기입] 이번 라운드 수정의 잠금

미수행. `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 0 = 표 행 0`. 잇는 구현자가 IMPL_DONE 전에 전수로 돌린다.

r1.2: 미수행 — `PLAN_GAP` 으로 `plan/DRAFT` 라 IMPL_DONE 으로 가지 않는다. `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 0 = 표 행 0`.

## [구현자 기입] Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 새 문구 `chat.toolMeta.diffLoading` | 소비자 `harnesses/common/transcript/DiffLinesStatus.tsx`(`role="status"`) → Claude `DiffBody`·opencode `ToolBody`. ko·en 둘 다 추가 |
| 큰 diff 의 줄 계산 실패(워커 실패) | Claude 는 도구 입력 원문, opencode 는 `patch ?? after` 원문을 보인다 — "아무 일도 안 일어남"이 아니다. 화면 확인은 못 했다(Electron 실행 불가) |
| 401줄 이상 diff 의 머리 증감 수 | Claude `toolDiffStat` · opencode `fileChanges` 가 `null` → 표시 없음(D-014). opencode 파일 패널 머리의 `+N −M` 은 워커 결과가 온 뒤에 나타난다 — D-014 는 "도구 카드 머리"만 말해 파일 패널 머리는 계약 밖이다(보고만) |
| 32,000자 초과 코드 | 강조 요청 없이 원문(D-012). 기존 200,000자 → 32,000자 |

r1.2: 해당 없음 — 사용자 대면 변경 0.

## [구현자 기입] 놓친 잠재 문제 + 대응

- 취소된 계산 요청의 promise 는 `ComputeCancelled` 로 reject 된다. 소비 훅 셋(`useHighlightedHtml`·`useDiffSyntax`·`useDiffLines`)이 모두 catch 한다 — 새 소비자가 catch 를 빠뜨리면 unhandled rejection 이다.
- 워커 번들(`new Worker(new URL(...), { type: 'module' })` + `renderer.worker.format = 'es'`)과 CSP `script-src 'self'` 아래의 실제 기동은 이 환경에서 확인하지 못했다 — AC23.
- 가드의 "실제 트리 exit 0"·문서 대조 3케이스는 `node:test` 의 `todo` 로 걸어 두었다(실행은 하되 스위트를 막지 않는다). 단계 4·5·7 뒤에 `todo` 를 지우고 `ci.yml` 에 가드 단계를 단다 — 지금은 `ci.yml`·`package.json` 을 고치지 않았다.
- r1.2: 설정 파일을 셸과 호스트가 함께 열면 창 위치 저장(`index.ts:202`)과 호스트의 설정 변경이 서로를 덮는다 — 위 설계 리뷰의 `PLAN_GAP`. 선조치하지 않았다(소유 프로세스는 계약 결정).

## [구현자 기입] 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 1 계측 | 구현 | `shared/perf-budget.ts` · `infra/perf/stall-monitor.ts` · `infra/ipc/handle.ts` 계측 · `renderer shared/perf/longTaskReporter.ts` · `index.ts` 직접 등록 4곳 → `handlePlain` |
| 2 가드 | 일부 | `scripts/{check-ui-thread,ui-thread-rules}.mjs` + 테스트 79(pass 76 · todo 3). `window.oo` 6곳·창 통지 직접 순회 2곳 이동. `ci.yml` 미연결 |
| 3 계산 워커 | 구현 | `renderer shared/compute/**` · 소비처 9자리 이동 · `electron.vite.config.ts` worker format |
| 4 호스트 이주 | 미착수 | EP-10 `PLAN_GAP` |
| 5 데이터 호스트 | 미착수 | — |
| 6 비동기 카탈로그 | 미착수 | EP-7 `PLAN_GAP` |
| 7 문서 | 미착수 | `execution-model.md`·ADR-012·`AGENTS.md` 넷 없음 |

AC 자기보고(검증 증거 아님): ✅ AC5·AC6·AC7·AC8·AC9·AC10·AC11·AC12·AC13·AC14 · ⚠️ AC2·AC3·AC4·AC35(판정은 있고 실제 트리·CI 연결 전) · ❌ 나머지. `✅ 10 · ⚠️ 4 · ❌ 21 = 총 35`.

gate(마지막 수정 뒤 트리에서 얻은 것만 적는다):

| gate | 관측 |
|---|---|
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | error 0 — lint 수정 직후 실행. 그 뒤 바뀐 것은 `check-ui-thread.test.mjs` 의 `todo` 표시뿐이다 |
| `node --test scripts/check-ui-thread.test.mjs` | tests 79 · pass 76 · fail 0 · todo 3 |
| `vitest run src/renderer` | 447파일 중 실패 2 — `reportSites.registry`(이후 고쳐 281 pass) · `planMode.render`(변경 전 기준선) |
| **돌리지 못한 것** | 파일 필터 없는 전체 `vitest run` 의 마지막 실행 · `node --test scripts/*.test.mjs` 전체 · 가드 4종(`check-migrations-appendonly`·`check-doc-inventory --check`·`check-product-naming`·`check-test-budgets`) — 사용자 중단. 잇는 구현자가 먼저 돌린다 |

기준선(변경 전 HEAD, better-sqlite3 Node ABI 로 재빌드): vitest 실패 29파일·22케이스 — `src/main/app/**`·`adapters/**` 28파일과 `planMode.render.test.ts`.

**r1.2 gate** — r1 이 돌리지 못한 것을 `ci.yml` 단계의 로컬 대응으로 전부 돌렸다. 트리는 r1 커밋 + lint autofix 1파일(`check-ui-thread.test.mjs` 줄바꿈)이다.

| gate | 관측 |
|---|---|
| 가드 4종 | 전부 exit 0 — `check-migrations-appendonly`(태그 없음, skip) · `check-doc-inventory --check`(links ok) · `check-product-naming`(2322파일) · `check-test-budgets`(18 real-git suites) |
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | exit 0 (node·web·test) |
| `node --test scripts/*.test.mjs` | tests 947 · pass 944 · fail 0 · todo 3 |
| `./node_modules/.bin/vitest run` (필터 없음) | 984파일 — 951 pass · 29 fail · 4 skip / 9226케이스 — 9192 pass · 22 fail |
| 기준선 대조 | r1 직전 커밋에서 같은 명령 — 974파일 중 29 fail · 22케이스. `FAIL` 줄 집합 42 대 42, `comm -13`·`comm -23` 둘 다 0줄 |
| 실패 원인 | 환경 — `Electron failed to install correctly`(바이너리 미설치) · Windows 경로 단언(`C:/work` 가 Linux 에서 상대 경로로 풀림). 이번 변경이 추가·수정한 파일의 실패 0 |
| `node scripts/check-ui-thread.mjs` | exit 1 · 231건 — 단계 4·5·7 대기분(`ci.yml` 미연결) |

테스트 소스 규칙(r1 이 추가·수정한 테스트 파일): `check-test-budgets` exit 0 · vitest 로그의 `[test-pools]` 0줄.

대상 커밋: `(r1 구현 일부 — 좌표는 INDEX)`.

## [구현자 기입] Review Signals — 사실만

- 라운드 1 · impl 턴 `r1`(미완료 중단).
- plan 의 자리 검색 술어 2건이 실제보다 좁았다 — EP-7 은 호출 함수가 동기인지 보지 않았고, EP-10 은 `electron` 직접 import 만 세어 `electron-store` 3파일이 빠졌다.
- 이 환경은 Electron 바이너리가 없어 워커·호스트 기동을 실행할 수 없다. better-sqlite3 는 `npm rebuild` 로 Node ABI 빌드가 됐다.
- impl 턴 `r1.2`(gate 만) — verify 0회. plan 의 EP-10 분모는 "Electron API 를 부르는 파일"을 셌고 "같은 파일을 두 프로세스가 여는가"는 세지 않았다.

---

## [구현자 기입] r1.3 — 단계 6′ 구현 · 단계 4 의 셸 상태·경로 주입 일부 (미완료 중단)

**판정: 미완료(partial). 사용자 지시(토큰 한계)로 멈췄다. 턴 12 의 사용자 발언(D-033 OPEN)이 EP-13·EP-14 의 전제를 다시 열었다 — 보드를 `plan/DRAFT` 로 돌린다.** 아래 일곱 필드는 r1.3 분이다.

### 설계 리뷰

| 항목 | 판정 | 근거 |
|---|---|---|
| D-033(턴 12) — 설정의 소유 프로세스 | `PLAN_GAP` — 사용자 결정 대기 | rev 3 은 "설정 파일 = 호스트, 창 위치·언어 사본 = main" 으로 갈랐다. 사용자가 그 뒤 "SDK 실행용이 아닌 설정은 main" 과 "유틸리티 프로세스가 관리" 를 함께 말하고 제안을 요구했다. 설계 턴이 안을 내고 확정받는다 |
| §7-B "`claudeInstallationExists` 를 `configured-resources.ts` 로 옮기고 등록" | 설계 대비 차이 — 선조치 | 유일한 소비 자리(`configured-resources.ts:134`)가 이미 `async` 함수 안이라 `fs/promises` 의 `stat` 로 바꿨다. 동기 호출이 없어 등록 행도 없다. 실패 모드 축: 만료·공유·재진입 해당 없음(단발 조회) · 무효화 — `E7-13` 이 잠근다 |
| §7-B "셸 상태 = `app/shell/shell-state.ts` 한 파일" | 설계 대비 차이 — 구현 세부 | 판정(`shell-state.ts`)과 `electron-store` 배선(`shell-state-file.ts`)을 갈랐다. `electron-store` 를 무는 파일은 이 환경의 vitest 가 import 하지 못한다. 가드 (l) 의 등록 파일은 `shell-state-file.ts` 가 된다 |
| §7-B "어댑터 `prepareTurn` 의 abort 확인" | 구현 세부 | 읽기 **앞**에서만 `signal.throwIfAborted()` 한다. 읽기 뒤의 취소는 런타임 `prepareSpawn` 이 본다(`E7-2`) — 같은 판정을 두 곳에 두지 않았다 |
| Claude 어댑터 테스트의 `sendMessage` 직접 호출 | 구현 세부 | 26파일의 호출을 `prepared.testfixture.ts` 의 `sendPrepared`(준비 → `sendMessage`)로 옮겼다. 동기 카탈로그를 부르던 테스트 3파일은 `readClaudePluginCatalogAsync` 로 옮겼다 |

### 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-7′ (3) | 런타임 `prepareTurn` 호출 · Claude `prepareTurn` · `openChannel` 소비 | 3/3 | 자리 1 `features/sessions/session-runtime.prepare.test.ts` 6케이스 · 자리 2 `adapters/claude/plugin-catalog.test.ts`(비동기 진입점) + `adapter.native-plugins.test.ts:"does not read the plugin catalog for a turn cancelled before preparation"` · 자리 3 `adapter.native-plugins.test.ts:"loads enabled native skills…"`·`"carries the prepared global plugin defaults…"`·`"refuses to spawn a turn that was not prepared"`. 검색 `rg -n "prepareTurn\|\.prepared\b" app/src/main --glob '!*.test.*' --glob '!*.testfixture.*'` → 타입 2 · 런타임 2 · 어댑터 2 |
| EP-13 (3) | 세 스토어의 `cwd` | 코드 3/3 · 닫은 수 **0/3** | `cwd` 를 필수 인자로 바꿨다(`settings-store.ts`·`secret-store.ts`·`store-file.ts`, `McpStore` 경유 1 포함 `new Store` 4곳 모두 `cwd`). 남긴 곳: 스토어별 "임시 디렉토리에 쓴다" 테스트 3 · 가드 (l) — 좌표가 없어 닫은 수에 세지 않는다 |
| EP-14 (6) | 창 위치 읽기·저장 · 트레이 읽기·구독 · `ready` 의 언어 · `onPatch` 알림 | 4/6 | 판정은 `app/shell/shell-state.test.ts` 7케이스(규칙 칸 5분기). `index.ts` 의 네 소비 자리는 `ShellState` 로 바꿨다. 남긴 곳: 호스트 `ready` 페이로드·`shell.mirror` 메시지(단계 4 본체) — 지금은 한 프로세스라 `index.ts` 가 `router.settings.onPatch` 로 직접 사본을 맞춘다. **`index.ts` 배선에는 테스트가 없다** |
| EP-1 (12) | 가드 (l) | 0 | 미착수. `shell-state-file.ts` 의 `readFileSync` 1건도 (a) 등록 표에 아직 없다 |
| EP-4·5·6·8~12 · EP-10′ | — | 0 | 단계 4 본체·5 미착수 |

V-pair 자기 상태: VP-06′ · VP-34 = `SELF_PASS`(아래 잠금 표). VP-33·35·36 과 나머지는 올리지 않았다.

### 이번 라운드 수정의 잠금

하네스 `mutate.py` · spec 13행. Claude 어댑터 스위트는 이 환경에서 기준선이 red(10건)라 oracle 은 "실패 테스트 집합이 기준선과 같은가"로 판정했다.

| ID | 자리 | 종류 | 결과 | 잡은 테스트 |
|---|---|---|---|---|
| E7-1 | `session-runtime.ts` 준비 호출 | 제거 | 잡음 | `session-runtime.prepare.test.ts` 4건 |
| E7-2 | 준비 뒤 취소 판정 | 제거 | 잡음 | "준비 중 취소되면…" |
| E7-3 | 실패 시 롤백 | 제거 | 잡음 | 2건 |
| E7-4 | `prepared` 전달 | 제거 | 잡음 | "준비가 돌려준 값을…" |
| E7-5 | 준비 ↔ 판정 순서 | 뒤집기 | 잡음 | 순서 단언 |
| E7-6 | 취소 신호 원천 | 다른 값 | 잡음 | "준비 중 취소되면…" |
| E7-7 **등록 변이** | `openChannel` 이 빈 카탈로그 사용 | 빈 값 | 잡음 | `adapter.native-plugins.test.ts` 9건 |
| E7-8 | 준비 가드 | 제거 | 잡음 | "refuses to spawn…" |
| E7-9 | 준비 전 abort 확인 | 제거 | 잡음 | "does not read the plugin catalog…" |
| E7-10 | `capturedDefaults` 인자 | 제거 | 잡음 | "applies current global plugin choices…" |
| E7-11 | `includeDisabled` | 뒤집기 | 잡음 | 3건 |
| E7-12 | 준비 결과의 `pluginDefaults` | 빈 값 | **못 잡음 → 테스트 추가, 재실행 못 함** | `"carries the prepared global plugin defaults…"` 를 더했고 단독 실행은 green 이다. 변이를 다시 심어 red 를 보지는 못했다(중단) |
| E7-13 | `configured-resources.ts` 디렉토리 확인 | 제거 | 잡음 | `configured-resources.test.ts:"omits installations whose directory no longer exists"` |

검산: `선택 증거 1(E7-7) · 인용 변이 0 · 새 oracle 0 · sweep 12 = 표 행 13`. 원복은 하네스가 "모든 파일 원문 그대로"로 보고했다. **EP-13·EP-14 자리에는 sweep 을 돌리지 않았다.**

### Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 준비 실패(카탈로그를 읽지 못함) | 지금까지 `sendMessage` 가 던지던 같은 오류가 한 단계 앞(`prepareSpawn`)에서 던져진다. `engine.spawn.started`·`failed` 로그는 남지 않는다 — 호출자(coordinator)의 실패 표시는 그대로다 |
| 준비 중 취소 | 새 오류 문자열 `submission_cancelled:before-spawn`. 소비자가 이 문자열을 화면에 어떻게 옮기는지는 확인하지 못했다 — `submission_stale:*` 와 같은 경로를 탄다고 가정했다(미검증) |
| 창 위치·트레이 언어 | 첫 실행에서 기존 설정 파일의 값을 이어받는다. 화면 확인은 못 했다(Electron 실행 불가) |

### 놓친 잠재 문제 + 대응

- `submission_cancelled:before-spawn` 의 소비 경로 미확인(위). 검증자가 `features/chat` 의 오류 분류에서 이 접두사를 확인해야 한다.
- 설정 스키마의 `windowBounds` 는 이제 아무도 쓰지 않는다(B12). 사용자가 D-033 을 "main 이 설정을 갖는다"로 정하면 이관이 필요 없어져 `ShellState` 의 이관 분기가 죽은 코드가 된다.
- `index.ts` 가 `router.settings.onPatch` 를 직접 구독한다 — 단계 4 에서 호스트 메시지로 바뀔 임시 배선이다. 가드 (e)(셸 그래프의 설정 스토어 import 0)는 아직 성립하지 않는다.

### 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 6′ 준비 단계 | 구현 | `adapters/common/{types,turn}.ts` · `contracts/ports.ts` · `features/sessions/session-runtime.ts`(`prepareSpawn`) · `adapters/claude/{adapter,plugin-catalog,configured-resources}.ts` · 동기 카탈로그 삭제 · 테스트 `session-runtime.prepare.test.ts` + `prepared.testfixture.ts` |
| 4 셸 상태 | 일부 | `app/shell/{shell-state,shell-state-file}.ts` + 테스트 · `index.ts` 소비 4곳 · `shared/protocol.ts` 의 `WindowBoundsSchema` export |
| 4 경로 주입 | 일부(테스트 없음) | 세 스토어와 `McpStore` 가 `userData` 를 받는다. `Bootstrap` 이 `app.getPath('userData')` 를 넘긴다 |
| 4 본체(채널 소유·`ClientRef`·셸 서비스·감독자·preload 포트) · 5 · 7 · 가드 (l) | 미착수 | — |

AC 자기보고(검증 증거 아님, 분모 38): ✅ AC5~AC14 · AC21′ = 11 · ⚠️ AC2·AC3·AC4·AC35·AC36·AC37·AC38 = 7(판정·코드는 있고 실제 트리 가드·좌표·호스트 배선 전) · ❌ 20. `✅ 11 · ⚠️ 7 · ❌ 20 = 총 38`. r1 의 분모 35 와 직접 비교하지 않는다.

gate(마지막 수정 뒤 트리):

| gate | 관측 |
|---|---|
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | error 0 |
| 관련 스위트 vitest(`adapters/claude`·`features/{sessions,extensions,auth}`·`infra`·`app/{shell,harnesses,handlers}` 외 4파일) | 239파일 — 228 pass · 9 fail / 2434케이스 — 11 fail. r1.2 기준선 실패 집합과의 차집합(`comm -13`) 0줄 |
| **돌리지 못한 것** | 파일 필터 없는 전체 `vitest run`(두 번 시도, 두 번 다 프로세스가 중간에 종료됨 — exit 137) · `node --test scripts/*.test.mjs` · 가드 4종 · 테스트 소스 규칙의 파일별 판정. **잇는 구현자가 먼저 돌린다** |

대상 커밋: `(r1.3 구현 일부 — 좌표는 INDEX)`.

### Review Signals — 사실만

- 라운드 1 · impl 턴 `r1.3`(미완료 중단) — verify 0회, 이 라운드의 impl 턴은 3이다. 다음 재구현 전 `handoff-review` 문턱(3 초과)에 닿는다 — r1.2 는 gate 전용 턴, r1.3 은 사용자 결정(턴 11)에 따른 턴이다.
- 설정 소유는 턴 11 에 한 번 정했고 턴 12 에 다시 열렸다. 구현이 그 사이에 EP-13·EP-14 일부를 만들었다.
- 이 환경에서 전체 vitest 가 r1.2 에는 끝났고(130초) r1.3 에는 두 번 exit 137 로 끊겼다.

### 잇는 사람에게 — 다음 순서

1. 설계 턴: D-033 을 사용자와 확정하고 EP-13·EP-14·AC36·AC38 을 유지 또는 대체한다.
2. 밀린 gate 전부(위 "돌리지 못한 것")와 `E7-12` 재실행.
3. EP-13 스토어별 테스트 3 · 가드 (l) · `shell-state-file.ts` 의 (a) 등록.
4. 단계 4 본체 → 5 → 7 → `ci.yml` 에 가드 연결(`check-ui-thread.test.mjs` 의 `todo` 3건 제거).

---

## [구현자 기입] r1.4 — 밀린 gate · 영속 파일 잠금 · 창 참조와 전송 계층 (미완료 중단)

**판정: 미완료(partial). 사용자 지시(2026-11-16 "더이상 작업하지 마라")로 멈췄다.** 단계 4 본체의 첫 조각(창 참조·전송 선택·채널 소유 표·수명 상태·고아 선별)까지 만들었고 프로세스 분리 자체는 시작하지 않았다 — 앱은 여전히 한 프로세스로 돈다.

### 설계 리뷰

| 항목 | 판정 | 근거 |
|---|---|---|
| EP-1 (d)·(g)·(l) 허용 파일 · EP-9 SSOT 위치 · EP-10′ 묶음 | `PLAN_GAP` — rev 3.1(§7-C)로 정정됨 | `infra` 는 `contracts` 를 import 하지 못하고, `handle.ts` 가 `ipcMain` 을 물면 호스트 그래프가 가드 (f) 에 걸린다 |
| 수명 이벤트의 원천(EP-11) | `PLAN_GAP` — 열림(§7-C "열린 설계 항목") | 합성 `error` 는 버스를 타지 않는다. `lifecycle-emitter` 는 만들지 않았다 |
| `RequestEvent.trusted` 의 포트 전송 쪽 자리 | `PLAN_GAP` — 열림(§7-C) | 셸 전송은 요청마다 판정한다. 포트 서버가 받는 자리가 §10 에 없다 |
| 테스트의 전송 설치 | 구현 세부 | `scripts/vitest-setup.mjs` 가 전송이 없으면 셸 전송을 건다(테스트가 mock 한 `electron` 사용). `ipcMain`·`webContents` 를 mock 하던 테스트 62파일을 고치지 않기 위해서다 |
| r1.3 회귀 1건 | 선조치 | `planMode.render.test.ts` 가 준비 단계 없이 `sendMessage` 를 불렀다. 이 환경에서는 Electron 미설치로 파일이 로드되지 않아 가려져 있었다 — `sendPrepared` 로 고쳤다 |

### 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-13 (3) | 세 스토어의 `cwd` | 3/3 | `infra/settings-store.cwd.test.ts` · `infra/config/secret-store.cwd.test.ts` · `features/auth/store-file.cwd.test.ts`(grant·OAuth 2케이스) + 가드 (l) 실제 트리 위반 0 |
| EP-1 (12) | 가드 (l) | 판정 1/1 | `scripts/check-ui-thread.test.mjs` "(l) 영속 파일" 10케이스. 실제 트리의 남은 위반은 (c) 1 · (e) 226 · (f) 2(진입점 없음) — 단계 4 본체·5 대기 |
| EP-9 (4) | 대상 지정 전송 · 방송 · 직접 순회 2 | 4/4 (셸 전송 한정) | `infra/ipc/send.test.ts` 10케이스 · `infra/ipc/electron-transport.test.ts` 14케이스. 남긴 곳: 호스트 포트 전송(`ClientRef` 의 포트 구현)·preload 구독 분배 |
| EP-8 (3) | preload 선택 · 셸 등록 · 호스트 등록 | 0/3 | 소유 표(`shared/channel-owner.ts`)와 테스트만 있다. 소비 자리 셋은 미착수 |
| EP-11 (5) | 수명 이벤트 5종 | 0/5 | 스키마(`shared/host-protocol.ts`)와 셸 쪽 `LifecycleState`(+테스트 9케이스)만 있다. 호스트가 내는 자리와 소비자(`updater`·`tray-residency`) 배선 없음 |
| EP-12 (4) | 호스트 종료 처리 | 0/4 | `app/shell/orphans.ts`(선별·종료, 테스트 9케이스)만 있다. `host-supervisor` 없음 |
| EP-14 (6) | 셸 상태 | 4/6 | r1.3 과 같다. `index.ts` 의 네 소비 자리는 여전히 테스트가 없다 |
| EP-4·5·6·10′ | — | 0 | 미착수 |

V-pair 자기 상태: VP-35 = `SELF_PASS`(등록 변이 E13-2g). VP-06′·VP-34 는 r1.3 그대로(`E7-12` 재실행으로 보강). 그 밖은 올리지 않았다.

### 이번 라운드 수정의 잠금

하네스 `mutate.py`. 원복은 매번 "모든 파일 원문 그대로".

| 묶음 | 행 | 결과 |
|---|---|---|
| `E7-12`(r1.3 미확인분) | 1 | 잡음 — `adapter.native-plugins.test.ts:"carries the prepared global plugin defaults…"` |
| EP-13 `E13-1`~`E13-6g`(등록 변이 `E13-2g` 포함) | 9 | 전부 잡음 — 스토어별 테스트 또는 가드 (l) |
| EP-14 `E14-1`~`E14-14` | 14 | 전부 잡음 — `shell-state.test.ts` |
| 전송 `T-1`~`T-37` | 37 | 잡음 35 · 동치 2(`T-33`·`T-35` — 닫힌 참조는 재사용되지 않아 죽은 줄이라 지웠다). `T-24`·`T-25`·`T-28` 은 처음에 못 잡아 `send.worktree.test.ts` 에 2케이스를 더하고 실패 지점 단언을 핸들러 밖으로 뺀 뒤 잡음 |
| 수명 상태 `L-1`~`L-22` · 고아 `O-1`~`O-10` · 소유 표 `C-1`~`C-4` | 36 | 전부 잡음 |

검산: `선택 증거 1(E13-2g) · 인용 변이 1(E7-12) · 새 oracle 0 · sweep 95 = 표 행 97`. VP-21 의 등록 변이(호스트 채널 1개를 `'shell'` 로 → `preload/index.test.ts` red)는 preload 가 아직 표를 쓰지 않아 돌리지 못했다 — `C-1` 은 소유 표 테스트가 잡은 것이지 그 pair 를 닫지 않는다.

### Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 개발 중 새로고침 | 창이 소유한 진행 중 턴이 취소로 끝난다(B15). 패키징된 앱은 영향 없다. 화면 확인은 못 했다 |
| 창 닫힘 뒤의 통지 | 닫힌 창으로의 전송은 예외 없이 버려진다(`send.test.ts`). 사용자에게 보이는 변화 없음 |
| 예약 프롬프트 시작 | 대상은 지금처럼 먼저 열린 창 하나다(`primaryClient`) |

### 놓친 잠재 문제 + 대응

- 기준선에서 Electron 미설치로 **로드되지 않던 테스트 파일이 변경의 회귀를 가린다.** `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent` 를 주면 `require('electron')` 이 CI 처럼 경로 문자열을 돌려줘 그 파일들이 실행된다. 이 방식으로 기준선 실패 29파일을 다시 돌려 r1.3 회귀 1건과 r1.4 의 테스트 대역 2파일(`send.agent-profile`·`send.harness`)을 찾아 고쳤다. **변경 전 커밋의 같은 방식 기준선은 끝내지 못했다**(중단) — 남은 9파일의 실패가 환경 원인인지는 확인되지 않았다.
- `handlers/misc.ts` 의 알림 포커스 판정은 셸 전송의 `contentsOf` 를 직접 쓴다 — 호스트로 옮길 때 셸 서비스(창 포커스)로 바뀌어야 하는 임시 배선이다.
- `scripts/vitest-setup.mjs` 의 기본 전송은 `vi.resetModules()` 뒤 모듈 최상위에서 핸들러를 등록하는 테스트에는 닿지 않는다. 지금 그런 테스트의 실패는 0 이다.

### 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 밀린 gate (r1.3 분) | 실행 | 아래 표 |
| 4 경로 주입 잠금 | 구현 | 스토어별 테스트 3 + `infra/electron-store.testfixture.ts` · 가드 (l) · `shell-state-file.ts` 의 (a) 등록 |
| 4 창 참조·전송 선택 | 구현(셸 전송) | `infra/ipc/{transport,electron-transport}.ts` · `contracts/client.ts` · `handle.ts`·`send.ts` 가 전송을 주입받음 · `WebContents` 타입 14파일 → `ClientRef` · 수명 리스너 5자리 → `onClosed` · `index.ts` 가 전송을 건다 |
| 4 채널 소유 표·프로토콜·수명 상태·고아 선별 | 일부(순수 모듈만) | `shared/{channel-owner,host-protocol}.ts` · `app/shell/{lifecycle-state,orphans}.ts` + 테스트 |
| 4 나머지(호스트 포트 서버·`entry`·셸 서비스 8종·Electron 어댑터 13파일·`host-supervisor`·`boot`·preload 포트·`lifecycle-emitter`·`chatStore` 종료 반영·번들 입력·가드 (e)(f) 통과) · 5 · 7 · `ci.yml` | 미착수 | — |

AC 자기보고(검증 증거 아님, 분모 38): ✅ AC5~AC14 · AC21′ · AC37 = 12 · ⚠️ AC2·AC3·AC4·AC24·AC25·AC28·AC29·AC35·AC36·AC38 = 10(판정·순수 모듈은 있고 배선 전) · ❌ 16. `✅ 12 · ⚠️ 10 · ❌ 16 = 총 38`.

gate:

| gate | 관측 |
|---|---|
| r1.3 트리 — 전체 `vitest run` | 986파일 — 953 pass · 29 fail / 22케이스 fail · 오류 1. `FAIL` 줄 42 — r1.2 기준선과 같은 수. 오류 1건(`native-resources.test.ts`)은 r1.3 이전 커밋에서도 같다 |
| r1.3 트리 — 가드 4종 · `node --test scripts/*.test.mjs` | 전부 exit 0 · tests 947 · pass 944 · todo 3 |
| 전송 조각 뒤 — 전체 `vitest run` | 989파일 — 28 fail / 24케이스. 기준선 대비 새 `FAIL` 줄 2(`planMode.render` — 위 r1.3 회귀, 고침) · 사라진 줄 2 |
| `node --test scripts/check-ui-thread.test.mjs` | tests 90 · pass 87 · todo 3 |
| **중단 시점에 돌리지 못한 것** (아래 "r1.4 마지막 트리 gate" 에서 실행) | `npm run lint`(중단 — 일부 실행됐을 수 있다) · `npm run typecheck` · 전체 `vitest run` · `node --test scripts/*.test.mjs` 전체 · 가드 4종. 마지막 전체 실행 뒤에 바뀐 것: 채널 소유 표·프로토콜·수명 상태·고아 선별(신규 파일, 개별 스위트 38케이스 green) · `planMode.render`·`send.agent-profile`·`send.harness` 테스트 수정 · 죽은 줄 2 제거. **잇는 구현자가 먼저 돌린다** |

테스트 소스 규칙의 파일별 판정: 하지 못했다(위 gate 미실행에 포함).

**r1.4 마지막 트리 gate** — 위 "돌리지 못한 것"을 중단 뒤 사용자 지시로 전부 돌렸다. 첫 실행에서 red 2건이 나와 고친 뒤 다시 돌린 값이다.

| gate | 관측 |
|---|---|
| 첫 실행의 red 2건 | `npm run typecheck` — `infra/ipc/send.test.ts:38` TS2352(캐스트) · `check-doc-inventory --check` — `docs/generated/inventory.md` stale. 캐스트를 고치고 인벤토리를 재생성했다 |
| 가드 4종 | 전부 exit 0 — `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` |
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | error 0 |
| `node --test scripts/*.test.mjs` | tests 958 · pass 955 · fail 0 · todo 3 |
| `./node_modules/.bin/vitest run` (필터 없음) | 992파일 — 961 pass · 27 fail · 4 skip / 9305케이스 — 9271 pass · 22 fail · 오류 1 |
| 기준선 대조(r1.3 트리의 같은 명령) | 새 `FAIL` 줄 0(`comm -13` 0줄) · 사라진 줄 2(`chat-turn.continuity`·`planMode.render` — 로드 실패가 풀렸다). vitest 로그의 `[test-pools]` 0줄 |
| `node scripts/check-ui-thread.mjs` | exit 1 · 230건 — (c) 1 · (e) 226 · (f) 2 · 문서 대조 1. 단계 4 본체·5·7 대기분이다(`ci.yml` 미연결) |
| 돌리지 못한 것 | `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent` 를 준 전체 실행과 변경 전 커밋의 같은 실행 대조 · 테스트 소스 규칙의 파일별 판정(예산 가드와 `[test-pools]` 0줄만 봤다) |

대상 커밋: `(r1.4 구현 일부 — 좌표는 INDEX)`.

### Review Signals — 사실만

- 라운드 1 · impl 턴 `r1.4`(미완료 중단) — verify 0회. 사용자 요구 변경 턴(r1.3)을 빼면 이 라운드의 impl 턴은 3이다.
- 자리 검색의 한 줄 정규식이 여러 줄 import 를 놓쳤다(EP-10′ 분모) — r1 의 EP-7·EP-10 과 같은 축(검색 술어가 실제보다 좁다)이다.
- Electron 미설치 환경에서 파일 단위 로드 실패가 기준선에 들어가 그 파일의 회귀를 가렸다(r1.3 → r1.4 에서 1건 발견).
- 한 턴에 단계 4 본체를 끝내지 못했다. 남은 범위는 아래 목록이다.

### 잇는 사람에게 — 다음 순서

1. 마지막 트리의 gate 전부(위 "돌리지 못한 것"). vitest 는 `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent` 를 준 실행도 함께 돌리고, 변경 전 커밋의 같은 실행과 `FAIL` 줄 집합을 뺀다.
2. 설계 턴: §7-C 의 열린 항목 둘(수명 이벤트 원천 · 포트 전송의 `trusted`)을 정한다.
3. 호스트 포트 전송: `ClientRef` 의 포트 구현과 요청 서버(`{ id, channel, payload }` → `{ id, ok, value | error }`), preload 의 소유 표 기반 전송 선택·포트 교체·통지 구독 분배(AC24·AC25·AC33, VP-21 등록 변이).
4. 셸 서비스 8종(`app/shell/services.ts` + 호스트 쪽 클라이언트)과 Electron 값 import 파일의 이주. `safeStorage` 가 비동기가 되며 `SecretStore.get`/`set` 호출부가 연쇄로 바뀐다 — §12 의 분모를 먼저 고정한다. `infra/browser-session.ts`(로그인 창·파티션 세션)는 셸에 남기고 포트를 통해 부르는 설계가 필요하다.
5. `host-supervisor`(fork·ready·포트 중개·exit·고아 정리·재기동 3회·shutdown 3초) · `boot` · `lifecycle-emitter` · `agent-host/entry` · `index.ts` 축소 · `updater`/`tray-residency` 의 입력을 `LifecycleState` 로 · `chatStore` 의 호스트 종료·재연결 반영 · `electron.vite.config.ts` 입력.
6. 단계 5(데이터 호스트·세션 로드 조각) → 단계 7(문서·`AGENTS.md` 넷·ADR-012·`IPC_CONTRACT.md`) → `check-ui-thread.test.mjs` 의 `todo` 3건 제거와 `ci.yml` 가드 단계.
7. IMPL_DONE 전: 열거 원문 sweep 전수 · 테스트 소스 규칙의 파일별 판정 · 사람 실기 AC22·AC23 안내.

## [구현자 기입] r1.5 — 밀린 대조 · 호스트 포트 서버 · 수명 이벤트의 원천과 수신 (미완료)

**판정: 미완료(partial).** rev 3.2 가 닫은 두 항목을 구현했다 — 호스트 포트 서버(요청·통지·신뢰 판정)와 수명 이벤트 방출·수신. 앱은 여전히 한 프로세스로 돌고, 호스트가 낸 알림은 같은 프로세스의 셸 수신기로 바로 간다.

### 설계 리뷰

| 항목 | 판정 | 근거 |
|---|---|---|
| 승인 대기의 세션 식별자 | 구현 세부 | 세션 확정 전 턴의 승인은 `dbSessionId` 가 null 이다 — 알리지 않는다. 그 턴은 lease 로 이미 활성이라 게이트 판정은 같다(`lifecycle-emitter.test.ts` "세션 미확정이면 보내지 않는다") |
| 채널 오류의 자리 | 구현 세부 — §7-D 조사 표보다 한 곳 많다 | 스트림 소비는 둘이다: 장수명 `finishPump` 와 턴 스코프 `consumeTurnScoped`(`rg -n "for await \(const batch of live.eventBatches" session-runtime.ts` → 2). 둘 다에 걸었다 |
| 채널 오류의 전달 수단 | 구현 세부 | 런타임 메서드가 아니라 턴 요청의 위임 콜백(`TurnRequest.onChannelFailed`)이다. 런타임은 턴을 넘어 재사용되고, 위임 콜백은 매 send·연속 턴마다 갈아 끼워진다(`FRAME_DELEGATE_KEYS`) |
| 사용자 취소 뒤의 스트림 오류 | 구현 세부 | `harness.exited` 로 알리지 않는다 — 취소는 하네스가 끊긴 것이 아니다. §7-D 규칙 칸은 "오류 종료 1건 · 정상 종료 0건"만 적는다 → 아래 확장 보고 |
| 포트 서버의 `postMessage` | 구현 세부 | 가드 (g) 의 허용 파일에 `port-server.ts` 가 없다. 포트를 `HostPort` 인터페이스로 받고 실제 `postMessage` 는 `entry.ts` 가 감싼다(미작성) — 허용 목록은 바꾸지 않았다 |

### 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-11 호스트 쪽 (5) | lease 구독 → 시작·종료 | 2/2 | `agent-host/lifecycle-emitter.test.ts` 앞 5케이스 + `bootstrap.native-history.test.ts:"lease 변화·승인 등록·세션 폐기·채널 오류를 셸에 수명 이벤트로 알린다"` |
| EP-11 | 승인 등록 | 1/1 | `features/approvals/coordinator.pending.test.ts` 2케이스 + 위 bootstrap 케이스 |
| EP-11 | 세션 폐기 | 1/1 | 위 bootstrap 케이스 |
| EP-11 | 채널 오류 | 1/1 | `session-runtime.test.ts` 5케이스(오류·정상·취소 × 두 소비 경로) · `chat-turn/turn-request.channel-failed.test.ts` · `chat-turn.runtime-tools.test.ts:"routes the actual send request channel failure…"` · 위 bootstrap 케이스 |
| EP-11 셸 쪽 | 수신 → `LifecycleState` | 수신기만 | `shell/host-link.test.ts` 4케이스. 남긴 곳: `updater`·`tray-residency` 가 아직 `LifecycleState` 를 읽지 않는다(AC28 의 뒤 절반) · `index.ts` 의 수신기 조립은 테스트가 없다 |
| EP-9 (5) | 포트 서버의 연결 등록(`trusted`) | 1/1 | `agent-host/port-server.test.ts` 10케이스(규칙 칸 5분기 전부). 남긴 곳: 셸이 포트를 넘기며 판정하는 쪽(`host-supervisor`)·preload 구독 분배 |
| EP-14 (6) | `ready` 의 `uiLocale` · `onPatch` 알림 | 방출·수신 2/2 | `lifecycle-emitter.test.ts:"uiLocale 패치만 셸에 알린다"` · `host-link.test.ts` 2케이스. 남긴 곳: `bootstrap.ts` 의 `ready` 송신과 `onPatch` 구독 자리는 테스트가 없다 · `index.ts` 네 소비 자리(r1.3 과 같다) |
| EP-8·EP-12·EP-4·5·6·10′ | — | r1.4 와 같다 | 미착수 |

자리 검색(§7-D): `rg -n "lifecycle\.(leasesChanged|approvalPending|sessionEnded|harnessExited)\(" app/src/main --glob '!*.test.*'` → 4줄(`bootstrap.ts`). 목록과의 차집합 0.

V-pair 자기 상태: 올린 것 없음. VP-26 은 호스트 쪽만 닫혔고 소비자 배선이 남아 `SELF_PASS` 가 아니다. VP-24 는 preload 쪽이 없다.

### 이번 라운드 수정의 잠금

하네스 `mutate.py`. 원복은 매번 "모든 파일 원문 그대로".

| 묶음 | 행 | 결과 |
|---|---|---|
| 포트 서버 `P-1`~`P-16`·`P-3b` | 17 | 잡음 16 · 동치 1(`P-3` — 닫힘은 한 번뿐이고 재연결은 새 참조를 넣기 전에 옛 참조를 닫아 조건이 죽은 코드였다. 조건을 지우고 `P-3b`(삭제 자체 제거)로 다시 잡음) |
| 방출기 `E-1`~`E-9` | 9 | 전부 잡음 |
| 셸 수신기 `H-1`~`H-5` | 5 | 전부 잡음 |
| Bootstrap 배선 `B-1`~`B-5`(맞바꿈 `B-5` 포함) | 5 | 전부 잡음 — `bootstrap.native-history.test.ts` |
| 런타임 `R-1`~`R-6` | 6 | 잡음 6. `R-2`·`R-5`·`R-6` 은 처음에 못 잡아 정상 종료·취소 케이스 3개를 더한 뒤 잡음 |
| 턴 요청 `T-1`·`T-2` · 승인 `C-1`·`C-2` · send 전달 `S-1` | 5 | 잡음 5. `S-1` 은 처음에 못 잡아 `chat-turn.runtime-tools.test.ts` 에 1케이스를 더한 뒤 잡음 |

검산: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 47 = 표 행 47`. VP-21 의 등록 변이는 preload 가 아직 소유 표를 쓰지 않아 이번에도 돌리지 못했다.

### Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 사용자가 보는 변화 | 없음. 수명 상태는 아직 어떤 판정도 바꾸지 않는다(소비자 미배선) |
| 트레이 언어 | 사본 갱신이 `index.ts` 의 직접 구독에서 호스트 알림 경유로 바뀌었다. 구독은 `start()` 의 첫 `await` 앞에서 건다 — 부팅이 실패해도 언어 변경은 따라간다 |
| 형식이 틀린 호스트 메시지 | 버리고 `shell.host-message.invalid` 경고 1건. 화면 변화 없음 |

### 놓친 잠재 문제 + 대응

- `bootstrap.ts` 가 `app/agent-host/lifecycle-emitter` 를 import 한다. 지금은 한 프로세스라 문제가 없지만 방출기의 자리는 호스트 조립(`Bootstrap`) 안이 맞다 — `entry.ts` 가 생기면 `toShell` 만 포트 송신으로 바뀐다.
- Bootstrap 을 생성자 없이 만드는 테스트(`Object.create(Bootstrap.prototype)`)가 있어 방출기를 지연 생성으로 두고 `toShell` 을 선택 호출로 불렀다. production 조립은 항상 생성자를 지난다.
- 확장 보고(확장 창 열림 — verify 0회): §7-D EP-11 규칙 칸에 "사용자 취소 뒤의 스트림 오류 → 0건" 분기가 없다. 구현과 테스트(`session-runtime.test.ts` 2케이스)는 있다. 설계자가 규칙 칸에 올릴지 정한다 — 이 턴은 멈추지 않았다.

### 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 밀린 대조(r1.4 분) | 실행 | 아래 gate 표 첫 행 |
| 4 포트 프로토콜 | 구현 | `shared/host-protocol.ts` — 창↔호스트 요청·응답·통지, 셸→호스트(`client.connect`·`shutdown`·`update.prepare-install`) |
| 4 호스트 포트 서버 | 구현 | `app/agent-host/port-server.ts` + 테스트 10 |
| 4 수명 이벤트 방출·수신 | 구현(소비자 제외) | `app/agent-host/lifecycle-emitter.ts` · `app/shell/host-link.ts` · `Bootstrap` 의 네 원천 배선 · `TurnRequest.onChannelFailed` · `ApprovalCoordinator` 생성자 인자 · `index.ts` 가 수신기를 건다 |
| 4 나머지(`entry`·셸 서비스 8종·Electron 어댑터 이주·`host-supervisor`·`boot`·preload 포트·`updater`/트레이 입력 교체·`chatStore`·번들 입력·가드 (e)(f)) · 5 · 7 · `ci.yml` | 미착수 | — |

AC 자기보고(검증 증거 아님, 분모 38): r1.4 와 같다 — `✅ 12 · ⚠️ 10 · ❌ 16 = 총 38`. AC25·AC28 은 ⚠️ 그대로다(호스트 쪽 절반이 늘었다).

**r1.5 마지막 트리 gate** — 이 환경은 `better-sqlite3` 를 Node ABI 로 빌드해 DB 스위트도 돈다(r1.4 까지는 미빌드). `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent` 를 준 실행이 CI 처럼 Electron import 파일을 로드한다.

| gate | 관측 |
|---|---|
| 밀린 대조(r1.4 트리 ↔ 0324 이전 커밋 `bbb3953~1`, CI 흉내 방식) | 992파일 9 fail / 22케이스 ↔ 974파일 9 fail / 22케이스. 실패 파일 집합의 차집합 0줄(양방향 `comm`) — r1~r1.4 가 만든 실패는 없다 |
| 첫 실행의 red | `npm run lint` error 5(추가한 테스트 4파일의 반환 타입·`require-yield`) · `typecheck` 1(`chat-turn.runtime-tools.test.ts` 대역 타입) · CI 흉내 vitest 의 새 `FAIL` 1(`product-identity.test.ts` — 진입점 생성자 형태를 글자로 단언). 셋 다 고쳤다 |
| 가드 4종 | 전부 exit 0 |
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | error 0 |
| `node --test scripts/*.test.mjs` | tests 958 · pass 955 · fail 0 · todo 3 |
| `vitest run` (CI 흉내 방식, 필터 없음) | 997파일 — 10 fail / 23케이스 · 오류 1. 기준선 9파일 대비 새 `FAIL` 1(위 `product-identity` — 고친 뒤 그 파일 40케이스 green), 나머지 9파일은 기준선과 같다. `[test-pools]` 0줄 |
| `vitest run` (일반 방식) | 997파일 — 28 fail / 23케이스 · 오류 1. CI 흉내 방식에 없는 18파일은 Electron 미설치로 로드되지 않는 파일이다(서명 `Electron failed to install correctly`) |
| 고친 뒤 재실행 | `product-identity.test.ts` 40 pass · `typecheck` error 0 · 예산·제품 이름 가드 exit 0. **전체 vitest 는 이 수정 뒤 다시 돌리지 않았다** — 수정은 테스트 파일 한 줄(정규식)이다 |
| `node scripts/check-ui-thread.mjs` | exit 1 · 230건(r1.4 와 같은 수) — 단계 4 본체·5·7 대기분, `ci.yml` 미연결 |

기준선 9파일(변경 전에도 같은 실패, 이번 턴이 손대지 않은 파일): `adapters/claude/{adapter.native-plugins,native-resources,project-reconciliation}` · `adapters/opencode/v1/adapter{,.instances,.persistent}` · `app/{composer-catalog,composer-preparation-service}` · `app/handlers/session-resources.claude-assembly`. 원인은 확인하지 않았다 — 환경 원인이라는 근거가 없어 비귀속 기존 실패로만 적는다.

테스트 소스 규칙의 파일별 판정(추가·수정 10파일 — `port-server`·`lifecycle-emitter`·`host-link`·`turn-request.channel-failed`·`coordinator.pending`·`session-runtime`·`bootstrap.harness`·`bootstrap.native-history`·`chat-turn.runtime-tools`·`product-identity`): 시간 예산 — `check-test-budgets` exit 0, 새 타이머 값 0 · 호스트 격리 — 홈·env 접근 추가 0 · 풀 분류 — 전체 실행의 `[test-pools]` 0줄.

대상 커밋: `(r1.5 구현 일부 — 좌표는 INDEX)`.

### Review Signals — 사실만

- 라운드 1 · impl 턴 `r1.5`(미완료) — verify 0회. 사용자 요구 변경 턴(r1.3)을 빼면 이 라운드의 impl 턴은 4다 — 다음 구현 턴 전에 `handoff-review` 조건(3 초과)에 해당한다.
- 자리 조사가 한 곳 적었다(스트림 소비 경로 2 중 1) — r1·r1.4 의 "검색 술어가 실제보다 좁다"와 같은 축이다. 이번에는 테스트가 red 로 드러냈다.
- 테스트 대역이 production 클래스의 새 메서드를 갖지 않아 3번 구조를 바꿨다(런타임 메서드 → 위임 콜백, 승인 구독 → 생성자 인자, 필드 → 지연 생성).
- Electron 미설치로 로드되지 않는 파일이 변이 판정을 가렸다(`S-1` 의 첫 red 는 로드 실패였다) — r1.4 와 같은 환경 한계다.

### 잇는 사람에게 — 다음 순서

1. `handoff-review`(impl 턴 3 초과) 뒤에 잇는다.
2. `app/shell/host-supervisor.ts`(fork·ready·`client.connect` 와 신뢰 판정·exit·고아 정리·재기동 3회·shutdown 3초) + `boot.ts` — 순수 모듈과 테스트부터.
3. preload 의 소유 표 기반 전송 선택·포트 교체·통지 분배(AC24·AC25·AC33, VP-21 등록 변이).
4. 셸 서비스 8종과 Electron 값 import 파일 이주 → `agent-host/entry.ts` → `index.ts` 축소 · `updater`/트레이의 입력을 `LifecycleState` 로 · `chatStore` 반영 · 번들 입력.
5. 단계 5 → 단계 7 → 가드 `todo` 3건 제거와 `ci.yml` 연결 → 열거 원문 sweep 전수 · 사람 실기 AC22·AC23 안내.

---

## [구현자 기입] r1.6 — 호스트 감독자 · 고아의 OS 목록 · 창 쪽 포트 클라이언트 (미완료)

**판정: 미완료(partial).** 감독자 순수 모듈, 고아를 고르는 OS 프로세스 목록·트리 종료, rev 3.3 의 창 쪽 포트 클라이언트를 만들었다. 셋 다 아직 배선 전이라 앱은 한 프로세스로 돈다. 사용자 지시(2026-11-16 "무시하고 이어서 작업")로 `handoff-review` 없이 이었다.

### 설계 리뷰

| 항목 | 판정 | 근거 |
|---|---|---|
| preload 전송의 채널·대기 규칙 부재 | `PLAN_GAP` → rev 3.3(§7-E)으로 닫음 | `rg -n "agentHost\|agent-host" app/src/shared/ipc.ts` → 0. 포트 전달·재기동 신호·첫 포트 전 요청이 정해져 있지 않았다. 설계 커밋을 따로 했다 |
| 비정상 종료 처리 중의 기동 요청 | 구현 세부 | 고아 정리(`await`) 사이에 fork 하면 새 포트가 옛 종료 통지보다 먼저 간다. `exiting` 단계를 두고 요청을 처리 뒤로 미뤘다(`host-supervisor.test.ts` "정리하는 사이에 온 기동 요청은 종료 통지가 끝난 뒤에 fork 한다") |
| 기동 실패 횟수의 기준 | 구현 세부 | §11 "연속 3회 실패"를 준비 메시지 전 exit 로 셌다. 준비 성공이 0 으로 되돌린다 |
| 프로세스 목록의 자리 | 구현 세부 | 가드 (j) 가 `child_process` 를 3파일로 막는다. `shell-runner.ts` 의 `runShellCommand` 로 `ps`·CIM 을 돌리고 해석은 순수 `process-table.ts` 로 뗐다 — 가드 목록은 바꾸지 않았다 |
| `HostToClientSchema` | 현재 결함 — 선조치 | r1.5 의 판별 유니온에 `result` 가 둘이라 zod v4 가 첫 해석에서 던진다(`Duplicate discriminator value "result"`). 해석하는 곳이 이번에 처음 생겨 드러났다. 유니온으로 바꿨다 |

### 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-12 (4) | 에이전트 호스트 exit · 데이터 호스트 exit · 정상 shutdown · 3초 초과 강제 종료 | 감독자 모듈 4/4 | `app/shell/host-supervisor.test.ts`: "에이전트 호스트 exit → 자식만 끝내고 → 창에 알리고 → 상태를 비운다, 순서대로" · "데이터 호스트 exit 는 창에 알리기만 한다" · "종료 요청 뒤 제때 끝나면 kill 하지 않고 창에 알리지 않는다" · "제한 시간 안에 끝나지 않으면 한 번 kill 한다". 남긴 곳: `utilityProcess` 의 `exit` 를 감독자에 잇는 셸 배선 — `rg -n "\.on\('exit'" app/src/main/app/shell` → 0줄(배선 전) |
| EP-12 규칙 칸 "재기동 실패 3회" | 분기 | 1/1 | 같은 파일 "준비 전에 3번 연속 죽으면…" · "준비에 성공하면 연속 실패 수가 0 이 된다" · "준비된 뒤의 비정상 종료는 연속 실패 수를 늘리지 않는다" |
| EP-12 의 고아 종료(OS 쪽) | 목록·트리 종료 | 2/2 | `infra/shell/process-table.test.ts` 3 · `shell-runner.process-list.test.ts` 7 · `shell-runner.win32.test.ts` "killPidTree — win32" 3 |
| EP-8 preload 자리 (rev 3.3 규칙 칸 8분기) | 창 쪽 클라이언트 | 모듈 8/8 | `preload/host-port.test.ts` 18케이스 — 분기마다 입력 1 이상. 남긴 곳: `preload/index.ts` 가 아직 이 클라이언트를 쓰지 않는다(배선 검색 `rg -n "hostPort\.(invoke\|send\|on)\(" app/src/preload --glob '!*.test.*'` → 0줄) |
| EP-11·EP-9·EP-14 | — | r1.5 와 같다 | 이번 턴 변경 없음 |
| EP-4·5·6·10′ | — | 미착수 | — |

V-pair 자기 상태: 올린 것 없음. VP-22 는 감독자 모듈만 닫혔고 셸 배선이 없어 `SELF_PASS` 가 아니다. VP-23·VP-24 는 preload 배선이 없다.

### 이번 라운드 수정의 잠금

하네스 `mutate.py`. 원복은 매번 "모든 파일 원문 그대로".

| 묶음 | 행 | 결과 |
|---|---|---|
| 감독자 `S-1`~`S-40` | 40 | 잡음 40. `S-9`(실패 판정 고정)·`S-24`(준비 재수신)·`S-27`(기동 중 연결)·`S-39`·`S-40`(상한 값)은 처음에 못 잡아 4케이스를 더한 뒤 잡음 |
| 프로세스 목록 `K-1`~`K-18`·`K-4b` | 19 | 잡음 18 · 동치 1(`K-4` — CRLF 의 `\r` 은 줄 끝 `\s*` 가 받아 `split` 정규식이 죽은 항이었다. `split('\n')` 로 줄이고 `K-4b`(줄 끝 `\s*` 제거)로 다시 잡음). `K-9` 는 오류 문장을 단언하도록 고친 뒤 잡음. `K-15` 는 prettier 줄바꿈으로 재앵커 |
| 포트 클라이언트 `C-0`~`C-34`(`C-10` 제외) | 34 | 잡음 29 · 동치 3 · 제거 2. 동치 `C-13`·`C-18r`·`C-34` — 이미 끝난 요청 항목을 지도에서 지우는 줄들이다. 번호는 다시 쓰지 않고 그 포트의 응답은 교체·종료 뒤 무시되므로(`C-9` 잡음) 관측이 같고 메모리만 다르다. 제거 `C-19`·`C-20` — `attachPort` 의 `exited`·`connectRequested` 초기화는 포트가 있는 동안 읽히지 않아 지웠다. `C-25` 는 1케이스를 더한 뒤 잡음. `C-0` 은 이번 결함의 역변이(판별 유니온 복귀) — 잡음 |

`C-10` 은 동작을 바꾸지 않는 대조 줄이라 표에서 뺐다. 검산: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 93 = 표 행 93`.

### Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 사용자가 보는 변화 | 없음. 세 모듈 모두 배선 전이다 |
| 호스트 종료 중 요청의 실패 문장 | `HOST_EXITED_ERROR`·`HOST_REPLACED_ERROR` 는 개발자용이다. 화면 문구는 `chatStore` 의 종료 통지 처리(AC29)가 정한다 — 배선 때 오류 문장이 화면에 그대로 나가지 않는지 본다 |
| 기동 실패 상한 뒤의 요청 | rev 3.3: 셸이 종료 통지를 다시 보내 대기를 실패시킨다. 셸 쪽 응답은 배선 단계 몫이다 |

### 놓친 잠재 문제 + 대응

- 고아 선별의 프로세스 목록은 `runShellCommand` 를 거친다 — Windows 에서 PowerShell 기동이 느리면 종료 통지가 그만큼 늦다. 제한 시간은 호출자가 정한다(배선 때 정할 값). 실패하면 `reapOrphans` 가 기록하고 통지는 그대로 간다.
- POSIX `killPidTree` 는 그룹 종료가 실패하면 그 프로세스만 끝낸다 — 그룹 대표가 아닌 하네스의 손자는 남을 수 있다(B9 의 "손자는 OS 트리 종료에 맡긴다"는 Windows `taskkill /T` 기준이다). 출시 대상은 Windows 다.
- 감독자의 `attach` 는 같은 창 id 로 다시 부르면 덮어쓴다. 셸이 문서 재로드마다 `attach` 를 다시 부르는 설계면 포트가 새로 가고, 호스트 포트 서버가 옛 참조를 닫는다(r1.5 `P-` 행).

### 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 4 감독자 | 구현(순수 모듈) | `app/shell/host-supervisor.ts` + 테스트 29 |
| 4 고아 OS 쪽 | 구현 | `infra/shell/process-table.ts` · `shell-runner.ts` 의 `listProcesses`·`killPidTree` + 테스트 13 |
| 4 창 쪽 포트 클라이언트 | 구현(순수 모듈) | `preload/host-port.ts` + 테스트 18 · `shared/host-protocol.ts` 결함 수정 |
| 4 나머지(`boot.ts`·셸 배선·세 채널·preload 교체·셸 서비스 8종·`entry`·`index.ts` 축소·`updater`/트레이 입력·`chatStore`·번들 입력·가드 (e)(f)) · 5 · 7 · `ci.yml` | 미착수 | — |

AC 자기보고(검증 증거 아님, 분모 38): AC18·AC32 가 ❌ → ⚠️(감독자 모듈은 있고 배선 전). `✅ 12 · ⚠️ 12 · ❌ 14 = 총 38`.

**r1.6 마지막 트리 gate** — 새 컨테이너라 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 뒤 `npm rebuild better-sqlite3`(Node ABI)로 DB 스위트까지 돌렸다. vitest 는 `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent` 를 준 CI 흉내 방식이다.

| gate | 관측 |
|---|---|
| 첫 실행의 red | `check-test-budgets` 1건(추가한 테스트의 `timeoutMs: 1234`) — 고쳤다. lint·typecheck 는 첫 실행부터 0 error |
| 가드 4종 | 전부 exit 0 (`check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets`) |
| `npm run lint` | 0 error · 3 warning(기존 `useVirtualizer` 등) |
| `npm run typecheck` | `error TS` 0줄 |
| `node --test scripts/*.test.mjs` | tests 958 · pass 955 · fail 0 · todo 3 |
| `vitest run` (CI 흉내 방식, 필터 없음) | 1001파일 — 9 fail / 22케이스 · 오류 1 · 988 pass. 실패 파일 집합 ↔ r1.5 기준선 9파일의 차집합 0줄(양방향 `comm -3`) · `[test-pools]` 0줄. r1.5 가 재실행하지 않았던 `product-identity.test.ts` 는 green |
| `node scripts/check-ui-thread.mjs` | exit 1 · 230건(r1.5 와 같은 수, 이번 턴 파일 0건) — 단계 4 본체·5·7 대기분, `ci.yml` 미연결 |

기준선 9파일은 r1.5 표와 같다(`adapters/claude/{adapter.native-plugins,native-resources,project-reconciliation}` · `adapters/opencode/v1/adapter{,.instances,.persistent}` · `app/{composer-catalog,composer-preparation-service}` · `app/handlers/session-resources.claude-assembly`). 이번 턴도 원인은 확인하지 않았고 비귀속 기존 실패로 적는다.

테스트 소스 규칙의 파일별 판정(추가·수정 5파일 — `host-supervisor`·`process-table`·`shell-runner.process-list`·`shell-runner.win32`·`host-port`): 시간 예산 — `check-test-budgets` exit 0(첫 실행에서 `timeoutMs: 1234` 1건이 걸려 1초 미만 데이터 값으로 고쳤다) · 호스트 격리 — 홈·env 접근 추가 0 · 풀 분류 — 전체 실행의 `[test-pools]` 줄 수는 위 표.

대상 커밋: `(r1.6 구현 일부 — 좌표는 INDEX)`.

### Review Signals — 사실만

- 라운드 1 · impl 턴 `r1.6`(미완료) — verify 0회. `handoff-review` 조건(같은 라운드 impl 턴 3 초과)에 해당하지만 사용자 지시로 건너뛰었다.
- 설계가 이름만 적고 정하지 않은 계약을 구현 턴이 먼저 만났다(포트 채널·대기 규칙) — r1.4·r1.5 의 열린 설계 항목과 같은 축이다.
- 앞 턴이 만든 스키마의 결함을 소비자가 생긴 턴에서야 찾았다 — 송신만 하는 쪽의 테스트는 수신 스키마를 해석하지 않았다.

### 잇는 사람에게 — 다음 순서

1. 셸 배선: `utilityProcess` 를 `HostProcess` 로 감싸는 어댑터(가드 (j) 허용 파일 = `host-supervisor.ts`) · `boot.ts` · 세 채널(`CHANNELS`·`channel-owner`·`IPC_CONTRACT.md`) · 기동 실패 상한 뒤의 `connect` 응답.
2. preload 교체 — 호스트 채널의 `ipcRenderer` 호출을 `host-port` 로(AC24·AC33, VP-21 등록 변이). 호스트 진입점과 같은 단계에 넣는다(§7-E 결정 4).
3. 셸 서비스 8종 · Electron 값 import 파일 이주 → `agent-host/entry.ts` → `index.ts` 축소 · `updater`/트레이 입력 · `chatStore` 반영 · 번들 입력.
4. 단계 5 → 단계 7 → 가드 `todo` 3건 제거와 `ci.yml` 연결 → 열거 원문 sweep 전수 · 사람 실기 AC22·AC23 안내.

---

## [구현자 기입] r1.7 — 셸 서비스 표·서버·클라이언트 · 핸들러 6파일 이주 (미완료)

**판정: 미완료(partial).** 셸 서비스 경로(표·셸 서버·호스트 클라이언트·한 프로세스 연결)를 만들고, 외부 열기·대화상자·알림을 부르던 핸들러 6파일을 그 포트로 옮겼다. 한 프로세스인 동안은 같은 검증을 거쳐 그 자리에서 셸 구현을 부르므로 동작은 같다.

### 설계 리뷰

| 항목 | 판정 | 근거 |
|---|---|---|
| 셸 서비스의 메서드 목록 | 구현 세부 | §10 EP-10 은 8종의 범주와 파일 배정만 적는다. 범주 안의 메서드는 이주 대상 파일이 실제로 부르는 API 로 정했다 — `shared/shell-services.ts` 10개(비밀 3 · 대화상자 2 · 외부 열기 4 · 알림 1)와 셸 → 호스트 `wake` |
| 포트의 자리 | 구현 세부 | `infra/shell-services.ts` 의 `setShellServices`/`shellServices()` — 전송 선택(`infra/ipc/transport.ts`)과 같은 모양이다. 셸은 `connectShellServicesInProcess`, 호스트 진입점은 `shell-client` 를 넣는다 |
| 대화상자의 부모 창 | 구현 세부 — 동작 보존 | 지금 코드는 부모 없이 띄운다. `clientId: null` 로 같게 두었다(`artifacts.test.ts` 가 `null` 을 단언) |
| 셸이 넘기는 옵션 | 구현 세부 | 셸은 인자를 스키마로 해석한 값만 Electron 에 넘긴다 — 선언 밖 키는 버려진다(`services.test.ts` "셸 구현에는 스키마가 정한 키만 간다") |
| 비밀 봉인의 비동기 전환(AC27) | 미착수 — 다음 조각 | `SecretStore.get` 의 동기 소비가 `vault`·`AuthStore`·MCP `resolver`(턴 조립의 동기 `resolveMcpConfig`)까지 닿는다. §12 의 "호출부 전수 `await`" 를 한 조각으로 다룬다 |
| `contentsOf` | 제거 | 소비처가 `misc.ts` 하나였고 이주로 0 이 됐다. 그 테스트의 닫힘 단언은 "닫힌 뒤 새 참조"로 바꿨다 |

### 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-10′ (8) | 비밀 봉인·해제 | 경로만 | `services.test.ts` 왕복. 남긴 곳: `infra/config/crypto.ts` 가 아직 `safeStorage` 를 직접 부른다 |
| EP-10′ | 대화상자 | 1/1 | `files.openPath.test.ts` "선택 대화상자 — 셸 서비스로 창 없이 띄운다" 3 · `artifacts.test.ts`(`clientId: null` 단언) |
| EP-10′ | 외부 열기(`shell.*` 5파일) | 5파일 중 5 | `error.test.ts` · `skills.test.ts` · `extension-catalog.test.ts`(MCP 케이스 추가) · `files.contextDirectory.test.ts`·`files.openPath.test.ts` · `artifacts.test.ts`. 남긴 곳: `bootstrap.ts` 의 `shell.openExternal`·`shell.trashItem`(Bootstrap 조각) |
| EP-10′ | 알림·창 포커스 | 1/1 | `misc-split.test.ts` "알림은 보낸 창의 id 와 함께 셸 서비스로 간다" |
| EP-10′ | 전원 이벤트 | 경로만 | `services.test.ts` "wake 는 구독자 전부에…". 남긴 곳: `bootstrap.ts` 의 `powerMonitor` 구독 |
| EP-10′ | 파티션 세션 요청 · 업데이트 제어 · 경로·버전 | 0 | 미착수 |
| EP-12 · EP-8 · EP-11 · EP-9 · EP-14 | — | r1.6 과 같다 | — |

Electron 값 import 남은 파일(`rg -l` 한 줄 + 여러 줄 import): 셸 3(`index.ts`·`app/shell/electron-services.ts`·`infra/ipc/electron-transport.ts`) · 호스트 허용 1(`infra/net/net-fetch.ts`) · 이주 대상 8(`app/bootstrap.ts`·`app/error-report-sink.ts`·`app/updater.ts`·`infra/browser-session.ts`·`infra/config/crypto.ts`·`infra/db/index.ts`·`infra/log/index.ts`·`infra/net/net-request.ts`). 이번 턴에 빠진 파일 6(`handlers/{artifacts,error,extension-catalog,files,misc,skills}.ts`).

V-pair 자기 상태: 올린 것 없음. VP-25 는 범주 8 중 3 만 이주됐다.

### 이번 라운드 수정의 잠금

하네스 `mutate.py`. 원복은 매번 "모든 파일 원문 그대로".

| 묶음 | 행 | 결과 |
|---|---|---|
| 셸 서버 `V-1`~`V-12` · 클라이언트 `L-1`~`L-16` · 수신 분기 `H-6`·`H-7` | 30 | 잡음 28 · 동치 2. `V-3`(검증 전 인자 전달)·`H-7`(배열 아닌 인자)은 1케이스씩 더한 뒤 잡음. 동치 `L-8`·`L-15` — 이미 끝난 호출 항목을 지우는 줄이라 관측이 같고 메모리만 다르다 |
| 핸들러 이주 `M-*`(형제 서비스 맞바꿈 · `clientId` 값 · 알림 인자 맞바꿈) | 23 | 잡음 23. `M-files-showOpen-0/1`·`M-files-client-0/1`·`M-ext-*` 6행은 처음에 기준선 실패 1건만 red 였다(`session-resources.claude-assembly`) — 대화상자 3케이스와 MCP 열기 1케이스를 더하고 기준선 파일을 뺀 oracle 로 다시 잡음 |
| 한 프로세스 연결·포트 선택 `I-1`~`I-5` | 5 | 잡음 5 |

검산: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 58 = 표 행 58`.

### Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 사용자가 보는 변화 | 없음 — 같은 Electron 호출을 같은 인자로 부른다 |
| 빈 경로 열기 | 셸 서비스의 경로 인자가 빈 문자열이면 거부한다. 이주한 자리는 모두 앞에서 실재 경로를 확인한 뒤라 지금 경로로는 생기지 않는다 |
| 셸 구현 오류 | 지금처럼 핸들러가 거부한다. 문장 앞에 오류 이름이 붙는다(`Error: …`) — renderer 는 지금도 `Error invoking remote method …` 접두를 받으므로 화면 문구는 그대로다 |

### 놓친 잠재 문제 + 대응

- 이번 턴에 기준선 실패 파일이 oracle 실행 집합 안에 있어 변이 판정이 가려졌다. 이후 sweep 은 기준선 9파일을 뺀 oracle 로 돌린다.
- 같은 세션에서 `git checkout` 으로 작업 중 파일 하나를 되돌렸다가 다시 적용했다(`extension-catalog.ts`). 최종 diff 와 테스트로 확인했다.

### 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 4 셸 서비스 경로 | 구현 | `shared/shell-services.ts` · `shared/host-protocol.ts`(`service.call`·`service.result`·`wake`) · `app/shell/{services,electron-services}.ts` · `app/agent-host/shell-client.ts` · `infra/shell-services.ts` + 테스트 17 |
| 4 핸들러 이주 | 6파일 | 위 표 |
| 4 나머지(비밀 봉인 비동기 전환 · `bootstrap.ts` 의 외부 열기·전원 · 파티션 세션 · 경로·버전 fork 인자 · 셸 배선 · preload 교체 · `entry` · `index.ts` 축소 · `chatStore`) · 5 · 7 | 미착수 | — |

AC 자기보고(검증 증거 아님, 분모 38): r1.6 과 같다 — `✅ 12 · ⚠️ 12 · ❌ 14 = 총 38`. AC27 은 ❌ 그대로다(비밀 봉인 미이주).

**r1.7 마지막 트리 gate** — vitest 는 `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent` 를 준 CI 흉내 방식, DB 스위트 포함(Node ABI).

| gate | 관측 |
|---|---|
| 첫 실행의 red | 전체 vitest 의 새 `FAIL` 1(`app/skill-catalog.test.ts` — 이주한 `skillsShowInFolder` 가 셸 서비스를 정하지 않은 채 불렸다: `셸 서비스가 정해지지 않았다`). 테스트에 가짜 포트를 넣어 고쳤다 |
| 가드 4종 | 전부 exit 0 |
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | `error TS` 0줄 |
| `node --test scripts/*.test.mjs` | tests 958 · pass 955 · fail 0 · todo 3 |
| `vitest run` (CI 흉내, 필터 없음, 고친 뒤 재실행) | 1003파일 — 9 fail / 22케이스 · 오류 1 · 990 pass. 실패 파일 집합 ↔ 기준선 9파일의 차집합 0줄(양방향 `comm -3`) · `[test-pools]` 0줄 |
| `node scripts/check-ui-thread.mjs` | exit 1 · 230건(같은 수 — 가드 (f) 는 호스트 진입점이 없어 아직 그래프를 세지 않는다) |

테스트 소스 규칙의 파일별 판정(추가·수정 13파일 — `skill-catalog.test.ts` 포함): 시간 예산 — `check-test-budgets` exit 0 · 호스트 격리 — 홈·env 접근 추가 0 · 풀 분류 — 위 표의 `[test-pools]` 줄 수.

대상 커밋: `(r1.7 구현 일부 — 좌표는 INDEX)`.

### Review Signals — 사실만

- 라운드 1 · impl 턴 `r1.7`(미완료) — verify 0회.
- 변이 판정이 기준선 실패에 가려졌다 — r1.5 의 Electron 미설치 로드 실패와 같은 축(oracle 실행 집합에 무관한 red 가 섞임)이다.

### 잇는 사람에게 — 다음 순서

1. 비밀 봉인 비동기 전환(AC27) — `rg -n "encryptString|decryptString|crypto\." app/src/main --glob '!*.test.*'` 로 분모를 고정하고 `SecretStore` → `vault` → `AuthStore`·MCP `resolver` 를 전수 `await` 로.
2. `bootstrap.ts` 의 `shell.*`·`powerMonitor` → 셸 서비스 · 경로·버전을 fork 인자로(`infra/db`·`infra/log`·`updater`).
3. 파티션 세션 요청(`browser-session`·`net-request`).
4. 셸 배선 · 세 채널 · preload 교체 · `entry` · `index.ts` 축소 · `chatStore` → 단계 5 → 7.

---

## [구현자 기입] r1.8 — Bootstrap·DB·로그의 경로·버전·외부 열기·깨어남 이주 (미완료)

**판정: 미완료(partial).** `bootstrap.ts`·`infra/db`·`infra/log` 가 Electron 을 import 하지 않게 됐다. 경로·버전은 호스트 환경 값으로, 외부 열기·휴지통·깨어남 신호는 셸 서비스로 간다. 비밀 봉인(AC27)은 설계 선택이 남아 멈췄다 — 아래 설계 리뷰 첫 행.

### 설계 리뷰

| 항목 | 판정 | 근거 |
|---|---|---|
| 비밀 봉인의 비동기 전환 | 사용자 결정 대기 — 두 설계가 모두 유효하다 | §12 는 "호출부를 전수 `await`" 라 적지만, 동기 소비가 `AuthStore.status()`·`secret()`(`features/auth/{runtime,login,authenticated-request,secret-access}.ts` 11곳)과 턴 조립의 동기 MCP `resolver` 까지 닿는다. 대안은 호스트 기동 때 한 번 풀어 메모리에 두는 것이다(D-018 "풀린 값은 호스트에 전달할 수 있다"). 키체인이 잠긴 채 뜨면 재시작 전까지 못 푸는 차이가 있다 |
| 경로·버전의 자리 | 구현 세부 | `infra/host-environment.ts` 의 `setHostEnvironment`/`hostEnvironment()`. 셸은 로그를 열기 전에 Electron 값으로 정하고, 호스트 진입점은 fork 인자로 정한다(§11 단계 4) |
| 깨어남 신호의 원인 | 구현 세부 — 동작 보존 | Bootstrap 의 구독이 둘이다: 일일 게이트는 절전 해제·화면 잠금 해제·창 포커스, 하네스 재확인은 창 포커스만. `wake` 에 원인(`resume`·`unlock-screen`·`window-focus`)을 실었다 |
| `app.getPath('desktop')` 의 시점 | 구현 세부 — 실기 확인 대상 | 전에는 `whenReady` 뒤에 읽었고 이제 모듈 스코프(`initLog` 앞)에서 읽는다. Electron 의 `getPath` 는 준비 전에도 쓸 수 있다고 보았고 이 환경에서는 확인하지 못했다 |
| `process.resourcesPath` | 남김 — 호스트 진입점 때 확인 | `workProfilePluginPath` 가 그대로 읽는다. utility 프로세스에서도 같은 값인지는 진입점 단계에서 본다 |

### 강제 지점 전수 (§10 대조)

| EP | §10 자리 | 닫은 수 | 좌표 / 남긴 곳 |
|---|---|---|---|
| EP-10′ 경로·버전 | `app.getPath`·`getVersion`·`isPackaged`·`getAppPath` 소비 | 호스트 쪽 3파일 | `app/bootstrap.host-boundary.test.ts` "경로·버전은 호스트 환경에서 읽는다" 7 · `bootstrap.harness.test.ts`(`dataDirectory`) · `builtin-resources.test.ts` · `infra/log/index.test.ts`(로그의 앱 버전). 남긴 곳: `app/updater.ts`(셸 소유 — 업데이트 제어 범주) |
| EP-10′ 외부 열기 | `bootstrap.ts` 의 `shell.openExternal`·`shell.trashItem` | 2/2 | `bootstrap.host-boundary.test.ts` "외부 열기는 셸 서비스로 간다" |
| EP-10′ 전원 이벤트 | `powerMonitor`·`browser-window-focus` 구독 2곳 | 2/2 | `daily-gate.wiring.test.ts`(구독·셸의 원인 3종) · `bootstrap.opencode-warmup.test.ts`(창 포커스만 재확인 · 종료 뒤 0) |
| EP-10′ 비밀 봉인·해제 · 파티션 세션 · 업데이트 제어 | — | 0 | 비밀은 위 결정 대기 · 나머지 미착수 |
| EP-12 · EP-8 · EP-11 · EP-9 · EP-14 | — | r1.7 과 같다 | — |

Electron 값 import 남은 파일: 셸 3(`index.ts`·`app/shell/electron-services.ts`·`infra/ipc/electron-transport.ts`) · 호스트 허용 1(`infra/net/net-fetch.ts`) · 이주 대상 5(`app/error-report-sink.ts`·`app/updater.ts`·`infra/browser-session.ts`·`infra/config/crypto.ts`·`infra/net/net-request.ts`). 이번 턴에 빠진 파일 3(`app/bootstrap.ts`·`infra/db/index.ts`·`infra/log/index.ts` — `bootstrap.host-boundary.test.ts` "호스트 조립은 Electron 을 import 하지 않는다").

V-pair 자기 상태: 올린 것 없음.

### 이번 라운드 수정의 잠금

하네스 `mutate.py`. oracle 은 기준선 9파일을 뺀 실행 집합이다. 원복은 매번 "모든 파일 원문 그대로".

| 묶음 | 행 | 결과 |
|---|---|---|
| 호스트 환경·셸 서비스 배선 `E-1`~`E-18`·`E-20`·`E-21` | 20 | 잡음 20. `E-2`·`E-5`~`E-9`·`E-14`·`E-15`·`E-20` 9행은 처음에 green 이었다 — 대표 테스트가 그 자리를 대역으로 막았다. `bootstrap.host-boundary.test.ts` 를 더해 잡음. `E-21` 은 그 뒤 더한 행(셸의 `desktop` 값) |

`E-19` 는 원문이 맞지 않아 돌지 않았고 표에서 뺐다(같은 자리는 `host-environment.test.ts` "정하기 전에는 던진다"가 본다). 검산: `선택 증거 0 · 인용 변이 0 · 새 oracle 1 · sweep 19 = 표 행 20`.

### Product/UX 파생 검토

| 항목 | 관측 |
|---|---|
| 사용자가 보는 변화 | 없음 — 같은 값·같은 Electron 호출이다 |
| 창 포커스 재확인 | 절전 해제·화면 잠금 해제에서는 지금처럼 돌지 않는다(`bootstrap.opencode-warmup.test.ts`) |

### 놓친 잠재 문제 + 대응

- 구조적 oracle(글자 고정)은 같은 뜻의 다른 표기로 바꾸면 red 가 난다 — 리팩토링 때 이 테스트를 함께 고쳐야 한다. 행동으로 관측할 방법(대역 없는 조립)은 호스트 진입점 단계의 IT 가 맡는다.
- `bootstrap.artifacts.test.ts` 의 쓰지 않는 `shell.trashItem` 대역을 지웠다.

### 구현 보고

| 단계 | 상태 | 산출 |
|---|---|---|
| 4 경로·버전 | 구현 | `infra/host-environment.ts` + `.testfixture.ts` + 테스트 2 · `index.ts` 가 로그 전에 정한다 · `bootstrap.ts`·`infra/db`·`infra/log` 이주 |
| 4 외부 열기·깨어남 | 구현 | `bootstrap.ts` 의 `openExternal`·`trashItem`·`subscribeWake`·하네스 재확인 · `wake` 원인 · 셸이 원인 3종을 낸다 |
| 4 비밀 봉인 | 결정 대기 | 위 설계 리뷰 |
| 4 나머지 · 5 · 7 | 미착수 | r1.7 과 같다 |

AC 자기보고(검증 증거 아님, 분모 38): r1.7 과 같다 — `✅ 12 · ⚠️ 12 · ❌ 14 = 총 38`.

**r1.8 마지막 트리 gate** — vitest 는 CI 흉내 방식, DB 스위트 포함.

| gate | 관측 |
|---|---|
| 첫 실행의 red | `typecheck` 1(`shell-services.test.ts` 의 포트 대역에 `onWake` 없음) · vitest 새 `FAIL` 6파일(`bootstrap.{harness,native-history,opencode-warmup}` — 호스트 환경·셸 서비스 미설정 · `builtin-resources`·`daily-gate.wiring` — 옛 배선의 글자 단언 · `infra/log/index` — 호스트 환경 미설정). 모두 고쳤다 |
| 가드 4종 | 전부 exit 0 |
| `npm run lint` | 0 error · 3 warning(기존) |
| `npm run typecheck` | `error TS` 0줄 |
| `node --test scripts/*.test.mjs` | tests 958 · pass 955 · fail 0 · todo 3 |
| `vitest run` (CI 흉내, 필터 없음) | 1005파일 — 9 fail / 22케이스 · 오류 1 · 992 pass. 실패 파일 ↔ 기준선 9파일 차집합 0줄 · `[test-pools]` 0줄 |
| `node scripts/check-ui-thread.mjs` | exit 1 · 230건(같은 수) |

테스트 소스 규칙의 파일별 판정(추가·수정 11파일): 시간 예산 — `check-test-budgets` exit 0 · 호스트 격리 — 홈·env 접근 추가 0 · 풀 분류 — `[test-pools]` 0줄.

대상 커밋: `(r1.8 구현 일부 — 좌표는 INDEX)`.

### Review Signals — 사실만

- 라운드 1 · impl 턴 `r1.8`(미완료) — verify 0회.
- §12 의 영향 행("호출부 전수 `await`")이 소비처 수를 세지 않아 구현 턴이 설계 선택을 만났다 — r1 의 EP-7·EP-10 "검색 술어가 실제보다 좁다"와 같은 축이다.
- 컴포지션 루트의 대역이 이주한 자리를 가렸다(변이 9건 green) — r1.7 의 기준선 실패 가림과 다른 원인, 같은 증상(oracle 이 그 자리를 보지 못함)이다.

### 잇는 사람에게 — 다음 순서

1. 비밀 봉인 — 사용자 결정(전수 `await` / 기동 때 한 번 풀어 메모리에 둠)에 따라 `SecretStore`·`vault`·`AuthStore`·MCP `resolver`.
2. 파티션 세션 요청(`browser-session`·`net-request`) · `error-report-sink` · 업데이트 제어의 셸 이동.
3. 셸 배선 · 세 채널 · preload 교체 · `entry` · `index.ts` 축소 · `chatStore` → 단계 5 → 7.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
