# 핸드오프 0324 실행 위치 감사

**판정**　백엔드의 셸·실행·저장 분리는 구현됐다. 창의 계산 분리는 일부 구현됐다. 특히 대화 이력의 크기, 도구 출력의 길이, diff 문자 수에 비례하는 작업이 UI 스레드에 남는다.

## 범위와 판정 기준

기준선은 verify가 지정한 구현 직전 `9692a27`, 현재는 `main@ee8ac817`이다. 공개 IPC 키 전체를 양쪽에서 추출하고, 새 소유권 표와 두 호스트 조립부, 셸 진입점, renderer 전송층, 워커의 요청 처리기를 대조했다. 아래 기능 목록은 공개 IPC 전 항목, 내부 피어 계약, 화면 기능 디렉터리를 기준으로 한다. 한 채널이 여러 프로세스를 이용할 수 있다. 채널 소유자는 요청의 수신자 또는 통지의 발신자다. 모든 화면 조작의 동적 프로파일이나 개별 함수의 실행 비용을 측정한 목록은 아니다.

0324의 D-008은 UI 계산에 입력 상한과 그 상한에서의 비용 측정을 요구한다. D-057의 5ms 양보는 여러 태스크로 직접 나누는 루프에 적용된다. 한 번에 끝나는 reducer나 React의 useMemo 안에서 수행한 연산까지 자동으로 중단시키지는 않는다. 창에서 입력·포커스·선택·스크롤·가시 행 배치·DOM 반영은 정상 책임이다.

## 기능군별 As-is → 현재 → 목표

| 기능 | 구현 전 | 현재 담당과 경계 | 판정 및 목표 |
|---|---|---|---|
| 창·트레이·단일 인스턴스·URL·알림·업데이트·종료 | main | 셸. 호스트 기동·재시작·종료, 포트 인계, 수명 추적 추가 | 의도 충족. app:// 자산 판정의 existsSync와 레거시 설정 동기 읽기는 별도 셸 비용 |
| DB 열기·마이그레이션·복구·설정·비밀·인증·게이트 | main | data가 앱 DB와 설정 정본을 소유. OS 봉인·해제, 브라우저 세션 등은 셸 서비스 사용 | 이주. 셸 소유 창 위치·언어 사본, agent 설정 사본은 의도된 예외 |
| 턴 송신·steer·대기열·중지·승인·권한·백그라운드·하위 에이전트·동시성·제목 | main + renderer | agent가 실행·정규화·수명 관리, data가 저장, renderer가 delta·활동·도구 상태와 표시 모델 갱신 | 실행 이주. 표시를 위한 대량 상태 변환 잔류 |
| Claude·OpenCode·엔진·모델·하네스·설치·확장·컴포저 카탈로그 | main + renderer | agent가 실행·검출·배포·목록 요청, data가 설정·관리형 MCP·스킬 정본, renderer가 메뉴 병합·검색·편집 | 호스트 분리. 큰 카탈로그의 표시용 병합·검색 후보 |
| Git·worktree·브랜치·체크아웃·패치·코드 리뷰 | main + renderer | agent가 git 실행·작업 트리 관리, data가 세션 메타 저장, renderer가 표시 옵션·선택·diff 모델 변환 | 부분. 표시 모델 계산을 worker로, 선택과 스크롤은 창에 |
| 프로젝트·세션 목록·생성·이름·고정·제거·디렉터리·본문 검색 | main + renderer | data가 영속 질의. UI가 탐색 구조·고정·날짜 정렬과 목록 투영 | 저장 이주. 큰 목록은 정렬된 페이지 수신 |
| 세션 열기·재접속·새로고침·원본 복구 | main + renderer | data가 읽고 agent가 필요 시 원본 이력·활동 제공. renderer가 조각 조립·과거 상태 보정·타임라인 구성 | 전송만 조각화. 아래 재현과 개선안 참조 |
| 첨부 선택·경로 열기·읽기·드롭·붙여넣기·썸네일 | main + renderer | data가 파일 채널 처리, OS 대화상자는 셸. renderer가 File 입력 수집·미리보기·이미지 축소·인코딩 | 파일 접근 이주. 썸네일은 worker 후보 |
| 산출물 발견·카탈로그·고정·미리보기·저장·휴지통 | main + renderer | data가 저장·카탈로그, agent가 턴 이벤트로 참조 연계, renderer가 로컬 목록 검색·뷰어 표시 | 저장 이주. 증가 가능한 목록 검색은 data 후보 |
| 예약·트리거·이력·즉시 실행·프롬프트 | main + renderer | data가 스케줄·이력 관리, 셸 명령은 agent에 위임. 창이 프롬프트 시작 통지·폼·상태 표시 담당 | 역할 분리. 요일 선택처럼 입력이 작은 파생은 유지 |
| 공급자 로그인·연결·갱신·철회·사용량·한도·통계 | main + renderer | data가 인증·사용량 계산·갱신·통지, 필요 시 agent에서 모델/설치 조회. 창은 사용자 입력·차트·사용량 표시 | 호스트 분리 |
| 오류·부팅 보고·로그·디버그·성능 | main + renderer | data가 오류·부팅 보고, 셸이 renderer 로그와 부팅 대기, agent가 mock 제어. 창은 long task 관측 | 역할 분리. 느린 함수 식별에는 구간 계측 필요 |
| 채팅 Markdown·코드·도구 출력·diff·타임라인 | renderer | 코드 강조·diff 토큰·큰 줄 diff만 worker. 나머지 본문 처리와 행 계산은 창 | 부분. 입력 크기가 증가하는 표현 변환부터 이주 |
| 진입·탐색·설정 화면·테마·다국어·캡처 화면 | renderer | UI 상태·DOM·접근성·폼·탐색은 창. CapturesView는 Future Scope 안내 화면 | 유지. 캡처 처리 엔진의 구현으로 집계하지 않음 |

## Transcript 설계 진단 — 이벤트 하나가 무효화하는 범위

**판정**　Claude의 순수 텍스트 스트리밍은 이미 좋은 구조를 갖고 있다. 라이브 텍스트와 추론을 각 리프가 직접 구독한다. 가장 큰 설계 부채는 확정 메시지 추가·도구 결과 반영 때 과거 표시 모델까지 다시 만들고, 그다음에 같은 내용인지 비교하는 경로다. OpenCode는 활성 exchange 내부의 확정 부분까지 delta마다 다시 투영한다. 가상화가 줄여 주는 DOM 수와 가상화 전에 사용하는 CPU·메모리를 독립적으로 봐야 한다.

### 이벤트별로 어디까지 다시 일하는가

| 계기 | Claude의 현재 작업 | OpenCode의 현재 작업 | 권장 경계 |
|---|---|---|---|
| 텍스트·reasoning delta | store의 live와 확정 messages가 분리되어 있다. PendingAssistant의 LiveText·LiveReasoning가 각 값을 구독한다. 확정 messages가 그대로인 순수 delta는 과거 exchange를 재그룹화하지 않는다. 미완성 Markdown 꼬리의 파싱과 stable 블록 목록의 React element 생성은 남는다. | Timeline이 두 값을 구독한다. head 메모는 적중하지만 현재 exchange의 확정 parts까지 flatMap한 뒤 segment·도구 그룹·artifact 행을 다시 계산한다. reasoning 행을 숨기는 정책에서도 reasoning 변경이 이 경로에 들어간다. 전체 head를 새 rows 배열에 펼쳐 넣는다. | 두 하네스 모두 live 본문 리프만 구독한다. 최초 행 출현이나 종류 변경에만 행 인덱스를 바꾸고 행 개수가 같을 때는 해당 행 내용만 갱신한다. 숨긴 reasoning은 표시 행에 영향을 줄 때만 발행한다. |
| 확정 메시지 추가·도구 결과 하나 도착 | messages 참조 변경 → groupTurns/groupExchanges가 전체 이력을 다시 순회한다. Work는 WeakMap으로 기존 parts 파싱을 생략하지만 호출 소유자와 결과 Map을 다시 조립한다. Code의 변경된 AssistantMessage는 messageSegments로 parts 전체를 투영한 다음 reconcileSegments로 이전 참조를 복원한다. | messages 참조 변경 → head 그룹·과거 행·키 인덱스를 재생성한다. 그 뒤 가시 행을 고른다. | agent의 이벤트가 가리키는 message/tool ID로 수정할 행을 찾는다. 변경된 그룹과 인접 경계만 새로 만들고 나머지 행의 객체 참조와 ID를 보존한다. 늦은 결과는 과거 소유 행에 적용한다. |
| 열기·과거 이력 추가·세션 전환 | 전체 조립·변환 후 exchange 단위 가상화. 마지막 exchange는 전체 마운트한다. 시작 index 키는 뒤에 추가할 때 안정적이지만 앞 페이지 삽입 시 이동한다. | 과거 행은 가상화하고 세션별 측정·선택 상태가 있다. 사용자 역할·시각·중복 순번 기반 키는 동일 시각의 이전 페이지가 추가될 때 안정성 검증이 필요하다. 긴 선택 구간은 화면 밖 행을 마운트한다. | data는 안정적인 메시지 식별자·페이지 커서를 제공한다. R은 행 ID와 스크롤 오프셋을 보존한다. 키 설계에는 낙관적 발화의 확정, 중복 시각, 이전 페이지 추가, 자동 피드 토글을 포함한다. |
| 긴 단일 턴·도구 카드 펼침·텍스트 완료 | exchange 단위 가상화라 가시 exchange 하나가 매우 크면 내부 DOM이 증가한다. 접었던 도구 본문이 계속 마운트될 수 있다. 완료 시 단일 Markdown으로 전환해 블록 간 참조를 바로잡는다. | 행 가상화는 유리하지만 단일 큰 본문이나 출력 행의 내부 크기는 별도다. 큰 행의 줄바꿈·높이 변화·선택 복원은 실제 창 비용이다. | 가상화 단위를 메시지 블록·도구 카드에 맞춘다. 큰 단일 출력은 내부 페이지를 사용한다. 블록 간 Markdown 의미는 완료 시 검증하고 필요한 블록만 교체한다. 복사·포커스·접힘 상태는 DOM 수명과 독립적으로 보존한다. |

### memo별 판단

| 구현 | 진단과 조치 |
|---|---|
| LiveText / LiveReasoning, 불변 message의 AssistantMessage, 확정 Markdown 블록 | **유지.** 원본 참조가 그대로인 입력을 다시 파싱하는 일을 실제로 막는다. rAF delta 배치와 분리된 live slice도 유지할 가치가 있다. React가 리프 업데이트를 격리하는 것과 store 자체의 이벤트 처리 비용은 별도다. |
| Exchange / AssistantTurn 사용자 정의 비교자 | **증분 모델 도입 후 단순화.** 새로 만든 turn을 비교하려고 내부 message 참조를 순회한다. 가상화 덕분에 화면 밖 모든 행이 React 비교를 받는 것은 아니지만 그 전에 전체 그룹 생성은 끝난 상태다. 이전 행의 참조를 유지하면 얕은 비교로 충분해진다. |
| reconcileSegments / Work 결과 캐시 | **이주 중에는 보존.** 변경되지 않은 카드의 참조와 도구의 최신 결과 귀속을 지킨다. 다만 이미 새 segment를 만들고 대조하거나 모든 exchange의 결과 관계를 수집하는 비용이 남는다. toolRunId → 소유 행 색인과 증분 갱신을 검증한 뒤 대체한다. |
| TranscriptView의 얕은 비교 / Exchange의 함수 prop | **비교 계약 수정 대상.** ChatTile의 렌더 콜백이 실행될 때 onRestoreSteerDraft 람다가 새로 만들어져 상위 얕은 비교가 빗나갈 수 있다. 반대로 Exchange 사용자 비교자는 이 함수를 비교하지 않는다. 함수는 activeKey를 캡처하므로 의존성을 맞춰 참조를 안정화하고 비교에 포함한다. 실제 오복원은 재현하지 않았다. |
| OpenCode head 메모 / Timeline.memo.test | **적중 범위는 유지하고 테스트 범위를 확장.** 기존 테스트는 live 갱신 때 head 1회·tail 6회와 복사 문자열 계산 생략을 확인한다. 가상화기는 mock이며 가시 행은 빈 배열이다. tail 내부에서 방문한 확정 메시지 수, head 배열 복사, 실제 DOM commit과 paint는 이 테스트의 측정 대상 밖이다. |

### 실제 소스 함수로 확인한 무효화 범위

Linux Node 24에서 기준 커밋의 TypeScript를 변환해 실제 groupExchanges, exchangeEquals, projectTimelineHead/Tail을 호출했다. 각 exchange는 짧은 사용자·assistant 텍스트 한 쌍이다. 실행 시간이나 FPS 추정 대신 입력 크기에 따라 늘어난 작업 수를 기록했다.

| 합성 입력 | 관측값 | 의미 |
|---|---|---|
| 과거 포함 100 / 1,000 / 10,000 exchange에서 마지막 assistant 메시지 하나 추가 | 기존과 내용 비교가 같으나 새 객체인 과거 exchange **99 / 999 / 9,999개** | React가 나중에 렌더를 생략해도 그룹 생성과 할당은 이미 발생했다. 이 숫자는 DOM 갱신 횟수가 아니다. |
| 같은 규모에서 OpenCode head를 고정하고 live text만 변경 | head.rows 길이 **297 / 2,997 / 29,997**. Timeline은 tail이 달라질 때 이 참조들을 새 배열에 복사한다. | head 투영을 메모해도 배열 결합 비용은 이력 길이에 비례한다. 기존 행 객체 자체는 유지된다. |
| 현재 OpenCode exchange의 확정 assistant 메시지 10 / 100 / 1,000개 뒤 text delta 한 번 | projectTimelineTail 내부에서 확정 assistant의 parts getter를 **10 / 100 / 1,000회** 읽음 | 과거 세션이 짧아도 현재 사용자 요청 하나가 길면 delta당 작업량이 커진다. |

### 권장 이주 순서와 합격 조건

1. **live 업데이트를 독립시킨다.** 먼저 OpenCode의 live 본문 구독을 리프로 옮기고 head와 tail을 인덱스로 접근한다. 기준은 가시 행 수와 현재 블록을 고정한 채 과거 이력을 늘려도 delta 한 번에 읽는 과거 parts와 복사하는 head 행이 각각 0인 것이다. Claude 리프 구독을 비교 기준으로 쓸 수 있다.
2. **확정 transcript를 증분 갱신한다.** data는 이력과 안정 식별자, agent는 순서 있는 실행 이벤트를 소유한다. 창의 표시 모델은 세션별 행 순서·행 ID·toolRunId 색인을 유지한다. 작은 단건 변경은 renderer에서 처리하고 대량 페이지의 초기 투영·Markdown 파싱은 필요 시 Worker에 맡긴다. Claude와 OpenCode가 각자의 그룹 표현을 유지할 수 있다. 한 도구 결과 갱신 시 영향을 받지 않는 과거 행의 참조가 유지되고, 이전 페이지 추가 뒤에도 기존 펼침·선택·스크롤 앵커가 따라오는지 검사한다.
3. **화면 비용을 실제 보이는 블록 수에 묶는다.** 긴 단일 턴과 대형 코드·출력을 독립 블록으로 가상화한다. Windows production 빌드에서 같은 화면을 유지하고 과거 이력 길이, 현재 턴 길이, 출력 블록 크기를 각각 늘린다. 모델 생성 시간·방문 행 수, React commit·마운트 DOM 수, 입력→paint·연속 누락 프레임을 함께 기록한다. 구조 변경 후에도 비용을 줄이는 memo만 남긴다.

근거 코드 · [Claude 그룹화·비교](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/turns.ts) · [라이브 리프](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/PendingAssistant.tsx) · [Work 소유 관계 재조립](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/workToolResults.ts) · [메시지 segment 재조정](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/transcript/AssistantMessage.tsx) · [OpenCode 행 투영](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/projection.ts) · [OpenCode 구독·행 결합](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx) · [기존 memo 테스트](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.memo.test.ts) · [Work의 부품 재사용 테스트](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/workActivity.performance.test.ts) · [콜백 생성](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/ChatTile.tsx#L146) · [비교자](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/Exchange.tsx) · [React memo 공식 레퍼런스](https://react.dev/reference/react/memo)

## 화면에서 체감하는 지연과 책임 소재

평가 단위는 **이미 보이는 텍스트·카드·커서·스크롤이 다음 프레임에도 제때 갱신되는가**다. 세션 열기·Git 조회 중에도 스크롤과 타이핑이 원활하면 대기 시간으로 기록한다. 응답이 도착하는 순간 입력이나 화면이 멎으면 수신·계산·React commit·layout·paint를 구분해 기록한다. 60Hz 화면의 한 주기는 약 16.7ms다. 50ms long task가 한 번도 없어도 연속으로 프레임을 놓칠 수 있다.

아래 표에서 **main**은 창과 OS 권한을 맡는 Electron 셸, **agent**는 실행 및 이벤트 정규화 호스트, **data**는 앱 DB와 영속 자료의 소유자다. **R**은 해당 창의 renderer UI 스레드, **W**는 창 전용 계산 Web Worker다. DOM과 React 표시는 R이 소유한다. 브라우저 layout·paint·합성·이미지 처리는 Chromium 내부에서 분담하므로 renderer의 JS 실행 시간과 별도로 본다. 각 행에는 현재 실제 분담과 변경 후 소유자를 명시했다. ‘우선’은 코드와 입력 규모에 따른 측정 순서다. ‘조건부’는 입력 상한·캐시·낮은 빈도 등의 완화가 있는 경로다.

### Transcript에서 화면 갱신을 놓칠 수 있는 경로

| 동작 · 판단 | 현재 소유자와 지연이 생기는 지점 | 목표 소유자와 보존할 동작 | 코드 |
|---|---|---|---|
| 과거 세션 열기·새로고침·호스트 재연결 · 실패 재현 | data가 저장 이력을 읽고 분할한다. 복구가 필요하면 agent가 원본 이력을 제공한다. R의 전송층이 모든 조각을 모아 펼쳐 넣고 reducer가 메시지 전체를 변환·보정한다. 첫 가시 행 이전 비용이며, 빈 parts 메시지 20만 건에서는 재조립 자체가 실패했다. | data가 최신 페이지·커서·복구 스냅샷을 제공하고 R이 페이지와 live tail을 연결한다. 단기에는 메시지 수·바이트 상한 및 안전한 조립. 취소·세션 전환·진행 중 턴 우선권 유지. | [data-host.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/shared/data-host.ts) · [chatReducer.ts L1473](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/reducer/chatReducer.ts#L1473) |
| 텍스트·reasoning 수신, 다중 세션 동시 생성 · 우선 | agent가 정규화 이벤트를 보낸다. R은 rAF에 모아 한 번에 store에 쓰지만 각 delta의 세션을 찾아 문자열을 누적한다. 도구·완료 등 비델타 도착 시 선행 버퍼를 즉시 비운다. 숨은 세션도 같은 FIFO를 쓴다. 생성 중 세션 키 구독자는 sessions 변경 시 탐색·정렬한다. | agent가 순서를 보존한 세션별 묶음을 제공하거나 R이 연속된 같은 종류의 delta만 병합한다. 세션별 활성 상태 인덱스를 유지하고 이벤트 순서·승인 지연·백그라운드 복귀를 검증한다. | [eventCoalescer.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/eventCoalescer.ts) · [chatStore.ts L547](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/store/chatStore.ts#L547) · [chatStore.ts L706](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/store/chatStore.ts#L706) |
| 도구 시작·완료·늦은 결과·steer 복원 · 우선 | agent가 실행·취소를 판정하고 data가 이력을 저장한다. R reducer 일부 분기가 원래 메시지·part를 검색하고 배열을 복제한다. steer 복원도 메시지를 필터링해 초안 텍스트를 조립한다. 연속 완료 시 여러 번 수행될 수 있다. | R에 메시지 ID·toolUseId 인덱스를 두거나 W가 변경 메시지를 식별한다. 이전 메시지에 도착한 결과와 거부·취소 상태를 같은 카드에 반영한다. | [chatReducer.ts L798](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/reducer/chatReducer.ts#L798) · [chatStore.ts L896](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/store/chatStore.ts#L896) |
| Claude 공통, 이력 그룹화와 마지막 exchange · 우선 | R이 messages 또는 자동 피드 옵션 변경 시 전체 목록에서 turn/exchange를 다시 구성한다. 이전 exchange는 가상화하지만 마지막 exchange는 항상 마운트하고 내부 턴을 순회한다. 순수 텍스트 delta 때 messages 참조는 유지된다. | W 또는 증분 인덱스가 변경된 exchange만 제공한다. 단일 exchange가 긴 경우 그 내부도 블록 단위로 가상화한다. 현재 턴 고정·fork·선택 유지. | [Timeline.tsx L36](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx#L36) · [Exchange.tsx L52](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/Exchange.tsx#L52) |
| Claude Work 활동·작업 묶음 · 우선 | R이 message parts를 도구 결과와 결합하고 활동·그룹·행으로 변환한다. 기존 객체 재사용은 있으나 큰 턴의 새 결과, 대량 그룹 펼침은 계산 및 DOM 수를 증가시킨다. | W에서 변경된 tool ID에 해당하는 활동만 갱신하고 R은 보이는 그룹과 행만 마운트한다. | [workActivity.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/workActivity.ts) · [WorkActivity.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/WorkActivity.tsx) |
| OpenCode 행 생성·연속 선택 · 우선 | R이 확정 head를 메모하고 live tail 변경 때 두 배열을 다시 펼쳐 rows를 만든다. 선택 보존 양 끝 사이의 모든 인덱스를 가상화 범위에 추가하고 중복 제거·정렬한다. 먼 두 행을 드래그해 선택하면 화면 밖 행도 마운트될 수 있다. | R이 head와 tail을 복사 없이 인덱싱하고 W는 확정 행 모델을 증분 제공한다. 긴 선택은 논리 범위를 보존하고 복사·키보드 선택·드래그를 검증한 뒤 DOM 범위를 줄인다. | [Timeline.tsx L52](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx#L52) |
| 답변·추론 스트림과 완료 전환 · 우선 | 양 하네스 모두 Markdown 표시 계산은 R이다. 확정 블록을 재사용하지만 열린 펜스·긴 문단·목록은 미확정 꼬리로 남아 반복 스캔·파싱된다. 완료 후 전문 Markdown을 그릴 때 비용이 다시 발생한다. Claude reasoning은 조각을 join한다. | W가 파서 상태와 블록 ID를 유지하고 R은 변경 블록을 교체한다. 완료 전후 목록 번호·펜스·표·링크·텍스트 선택이 같아야 한다. | [markdownBlocks.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/markdownBlocks.ts) · [ReasoningBlock.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/ReasoningBlock.tsx) · [Text.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/Text.tsx) |
| 코드 블록·테마 변경·행 번호 · 우선 | W가 32,000자 이하의 지원 언어를 강조한다. R은 먼저 plain pre로 표시하고 응답 HTML을 삽입한다. 큰 원문도 표시하며 행 번호 모드에서는 R이 전체 split·번호 배열·join을 수행한다. 여러 블록이 함께 마운트되면 결과 반영이 겹칠 수 있다. | W가 보이는 줄의 토큰을 제공하고 R이 가시 행 번호와 DOM만 구성한다. 스트리밍 중 강조 생략·원문 복사·테마 전환 유지. | [CodeBlock.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/markdown/CodeBlock.tsx) |
| 포트 수신·세션 조각 검증 · 조건부 | main이 연결한 전용 포트에서 agent/data가 보낸 메시지를 R이 받고 외피를 검증한다. 세션 조각은 R의 전용 수신기가 다시 스키마를 확인한다. 조각이 크거나 몰리면 입력과 같은 이벤트 루프에서 처리된다. | data가 조각 크기와 전송량을 제한하고 R은 검증·취소 의미를 유지한다. 수신·검증·조립 시간을 나눠 잰다. | [host-port.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/api/transport/host-port.ts#L100) · [session-load.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/api/transport/session-load.ts#L44) |
| 접힌 도구 카드의 변경 줄 수 · 우선 | Claude R이 카드 머리의 Write/Edit/MultiEdit 통계를 만든다. MultiEdit은 개별 수정마다 동기 diff를 부른다. 각 수정이 400줄 이내여도 수정 개수 합산 비용은 카드 한 번에 집중될 수 있다. | W가 통계와 본문 모델을 함께 계산하거나 agent가 이미 가진 통계를 제공한다. R은 헤더부터 표시한다. | [toolMeta.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/toolMeta.ts#L184) · [inline.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/inline.ts) |
| 하위 에이전트 대화 펼침 · 우선 | agent가 자식 실행·이벤트를, data가 이력을, R이 부모 toolRunId로 자식 대화를 찾아 표시한다. 상세는 지연 로드되지만 열린 상세가 messages를 구독하고 task와 자식 메시지를 찾아 transcript를 재사용한다. 여러 상세를 열고 부모 턴을 진행하면 비용이 겹칠 수 있다. | W 또는 증분 인덱스가 부모 ID별 자식 목록을 제공한다. R이 펼침 시 가시 자식 블록을 구독하고 접으면 해제한다. | [InlineSubagentDetail.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/transcript/InlineSubagentDetail.tsx#L26) · [parts.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/parts.ts) |
| 도구 카드와 출력 복사 · 우선 | Claude R은 본문 마운트 때 copyText를 미리 계산한다. 한 번 연 카드는 접어도 본문이 남는다. Work 출력은 JSON 판별·들여쓰기된 문자열 생성 등 문자열 변환이 있다. OpenCode R은 파일·todo를 투영하고 shell 출력은 높이가 제한된 pre에 전체 문자열을 넣는다. | W가 요약·미리보기를 만들고 원문은 요청 시 로드한다. 복사 문자열 생성은 클릭 시점으로 옮기고 접힘 애니메이션 뒤 무거운 본문을 해제한다. 전체 복사 보존. | [ToolCard.tsx L173](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/ToolCard.tsx#L173) · [workToolPresentation.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/workToolPresentation.ts) · [ToolBody.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/ToolBody.tsx) |
| 턴 메타·복사 · 조건부 | Claude assistant와 공통 user turn은 R이 렌더 중 복사 대상 메시지의 text를 모아 trim·join한다. OpenCode의 일부 행은 콜백으로 지연한다. 매우 긴 답변은 복사하지 않아도 비용이 생긴다. | R은 클릭 시 계산하거나 이미 구성한 본문을 재사용한다. 선택 복사와 전체 턴 복사 구분 유지. | [turns.ts L99](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/turns.ts#L99) · [AssistantTurn.tsx L59](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/AssistantTurn.tsx#L59) · [UserTurn.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/transcript/UserTurn.tsx) |
| 인라인 Edit·MultiEdit·patch · 우선 | agent가 도구 이벤트를 보낸다. R이 입력 줄 수를 검사하고 합계 400줄 이하는 동기 diff, 초과는 W가 계산한다. 긴 한 줄은 문자 수 상한이 없다. unified patch 원문 경로는 100만 자까지 R에서 파싱한다. 최종 DiffTable은 전달받은 줄들을 map한다. | 문자 수를 먼저 검사하고 W가 파싱·차이·토큰·행 투영을 맡는다. R은 가시 행만 그리며 펼침·구문 색과 원문 접근을 보존한다. | [inline.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/inline.ts) · [limits.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/limits.ts) · [DiffTable.tsx L55](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/transcript/DiffTable.tsx#L55) |
| 워커 왕복 · 조건부 | W가 계산한다. R은 본문을 포함하는 키 생성, postMessage, 결과 수신, 결과 줄 또는 토큰을 순회해 캐시 크기 집계를 수행한다. W 처리 대기는 결과 표시 지연이고 R의 송수신·후처리는 프레임 지연 후보다. | W가 크기·변경 범위를 함께 반환하고 R은 세션 revision·문서 ID로 조회한다. 화면 밖 요청 취소 및 오래된 응답 폐기 유지. | [client.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/client.ts) · [protocol.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/protocol.ts) |
| 스크롤 고정·폰트 배율·긴 사용자 발화 접기 · 우선 | R이 가상 행 높이, scrollHeight, DOM rect와 computed style을 읽고 스크롤을 보정한다. 사용자 버블은 접어도 전체 children을 두고 높이를 실측한다. 글자 배율·패널 폭·스트리밍이 동시에 바뀌면 재줄바꿈·측정이 겹친다. | DOM 측정과 앵커는 R에 유지한다. 프레임별 읽기/쓰기 일괄 처리, 가시 블록 제한, 폭별 높이 캐시를 검토한다. 사용자가 위로 읽는 중 강제 하단 이동은 금지한다. | [UserBubbleText.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/transcript/UserBubbleText.tsx) · [useScrollAnchor.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/useScrollAnchor.ts) · [ScrollController.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx) |
| 승인·질문·계획 검토 · 조건부 | agent가 요청의 생성·응답을 소유하고 data가 세션 이력을 저장한다. R은 대기열과 키보드·버튼 상태를 관리하며 긴 계획 Markdown과 의견 목록을 마운트한다. 요청 도착과 스트리밍 flush가 인접할 수 있다. | 우선 R이 승인 버튼과 질문을 표시한다. 긴 본문 모델은 W가 준비하고 R에서 지연 표시한다. 승인 순서·초점·결과 귀속을 보존한다. | [ApprovalCard.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/ApprovalCard.tsx) · [eventCoalescer.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/eventCoalescer.ts) |
| 실행 중 표시·경과 시간·펼침 애니메이션 · 조건부 | R의 경과 시간 구독은 타이머로 표시를 갱신한다. spark는 CSS 애니메이션이고 running 텍스트에는 shine이 있다. 많은 동시 카드, grid 높이 전환, 본문 갱신이 겹칠 때 paint·layout 비용이 의심된다. 개별 스피너의 병목은 미확인이다. | R·Chromium이 표시를 유지한다. 화면 밖 타이머·애니메이션을 중지하고 가시 개수별 paint와 합성 트랙을 비교한다. | [elapsed.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/elapsed.ts) · [app.css L154](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/styles/app.css#L154) · [ToolCard.tsx L173](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/ToolCard.tsx#L173) |

### 컴포저·우측 패널·그 밖의 화면에서 의심되는 경로

| 동작 · 판단 | 현재 소유자와 지연이 생기는 지점 | 목표 소유자와 보존할 동작 | 코드 |
|---|---|---|---|
| 컴포저 긴 초안·IME·붙여넣기 · 함수 측정 | R의 native textarea가 입력하고 deferred 장식이 초안 전체에 정규식 탐색·정렬·span 생성을 한다. 지연 렌더에도 한 번 시작한 동기 함수는 R을 점유한다. 40만 자 합성 입력 측정은 아래 표 참조. | R이 원문·selection·IME를 즉시 반영한다. 큰 초안은 장식 생략 또는 W가 변경 구간 토큰만 반환하고 R이 가시 장식만 만든다. | [ComposerDecorationLayer.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/composer/ComposerDecorationLayer.tsx) · [composerDecoration.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/composer/composerDecoration.ts) |
| 멘션·슬래시 명령·모델·플러그인 메뉴 · 조건부 | agent가 하네스 native 자원을, data가 관리 목록 및 파일 질의를, R이 카탈로그 합성·이름 Set·후보 필터·앵커 위치를 소유한다. 파일 후보는 최대 8개를 표시해도 필터는 slice 이전이다. | 목록 소유 호스트가 prefix·개수 제한 질의를 수행한다. R은 캐시된 작은 결과를 열고 키보드·포커스·팝오버 위치를 유지한다. | [ComposerInputController.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/composer/ComposerInputController.tsx) · [mentionAutocomplete.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/mentionAutocomplete.ts) · [composerSkills.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/composerSkills.ts) |
| 첨부 선택·드롭·붙여넣기·전송 · 우선 | main은 파일 선택 대화상자, data는 경로 읽기, R은 클립보드 FileReader 결과와 base64 문자열·미리보기·동시 첨부 준비를 담당한다. 전송용 이미지도 소스에서 다시 준비하며 DOM canvas에서 축소·동기 JPEG 인코딩한다. | W에 이미지 축소·인코딩을 요청하고 동시 작업 수와 픽셀 수를 제한한다. R은 input·이미지 표시만 담당하고 전송본·드래프트 revision을 유지한다. | [useAttachments.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/hooks/useAttachments.ts) · [imageThumb.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/imageThumb.ts) |
| Git 리뷰 본문·좌우 보기·문맥 펼침 · 함수 측정 | agent가 Git 실행·패치 파싱과 전송 상한을 소유한다. R이 patch 줄 변환, 공백 옵션, hunk, 좌우 짝, 줄별 requirement 검색, 위쪽 펼침 후 위치 보정을 담당한다. W는 구문 토큰 등을 맡는다. 기본 접힘과 문맥 축약이 있어도 한 파일 전체가 추가 줄이면 열린 파일의 모든 변경 줄이 표시 대상이다. | W가 hunk·좌우 행·주석 위치 인덱스를 만들고 R은 가시 창만 그린다. DOM 앵커와 키보드·리뷰 요구사항 선택은 R에 둔다. | [FileDiffSection.tsx L241](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel/FileDiffSection.tsx#L241) · [diffSyntax.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/diffSyntax.ts) · [git-diff-parse.ts L212](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/infra/git/git-diff-parse.ts#L212) |
| Git 변경 파일 트리·커밋 전환 · 조건부 | agent가 비교 범위와 변경 파일을 제공한다. R은 경로를 디렉터리 트리로 조립·압축하고 접힘 상태로 평탄화하며 파일 섹션을 만든다. patch 참조가 같으면 sections 메모가 재사용된다. 호스트 파일 상한 200개로 위험은 본문보다 작다. | R에서 현 상한의 비용을 확인한다. 더 큰 비용이 나오면 W가 패치 세대별 트리 인덱스를 제공하고 R은 펼침·이동만 갱신한다. | [changedFileTree.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/changedFileTree.ts) · [DiffReview.tsx L93](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel/DiffReview.tsx#L93) · [git-diff-parse.ts L18](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/infra/git/git-diff-parse.ts#L18) |
| 계획서 선택·댓글 오버레이 · 우선 | R이 Range.toString으로 오프셋을 계산하고 TreeWalker로 각 댓글의 시작·끝 노드를 찾는다. 레이아웃 변경 시 ResizeObserver에서 댓글별 rect를 다시 구해 오버레이를 그린다. 긴 계획과 많은 주석에서 패널 폭 드래그가 직접적인 재생 조건이다. | R이 텍스트 노드 오프셋 인덱스를 본문 revision별로 캐시하고 가시 댓글만 프레임당 한 번 측정한다. W로 DOM 측정을 옮길 수 없으므로 좌표·선택 복원을 R에 둔다. | [planCommentDom.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/planCommentDom.ts) · [PlanCommentOverlay.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel/PlanCommentOverlay.tsx) |
| Task·하위 에이전트·백그라운드 상태 · 우선 | agent가 실제 실행·중단을, data가 저장 이력을, R이 작업 보드 표시를 소유한다. messages 배열 참조가 바뀌면 Task 보드는 전체 messages/parts를 접어 정렬한다. Claude 배경 패널은 실행/완료 그룹을 다시 분류한다. OpenCode 패널은 전체 메시지 parts를 평탄화하고 Bash 호출을 추출한다. 객체 출력을 stringify하고 제어문자를 제거한 뒤 65,536자로 자른다. | agent가 현재 실행 상태를, data가 복원 스냅샷을, W 또는 증분 selector가 표시 행을 제공한다. R은 변경 행과 가시 상세만 반영한다. 취소 대기와 최종 상태를 보존한다. | [taskBoard.ts L100](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/taskBoard.ts#L100) · [CanonicalBackgroundContent.tsx L90](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx#L90) · [model.ts L54](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/model.ts#L54) |
| 패널·사이드바 경계 드래그 · 우선 | R의 useDragResize가 mousemove마다 onChange를 호출한다. 우측 열/행은 chat store에 폭·비율을 쓰고, transcript 줄바꿈·가상행 실측·계획 댓글 rect가 연쇄 갱신될 수 있다. | R이 프레임별 최신 좌표 한 건만 반영하고 최종 폭을 커밋한다. drag 중 부차적 측정은 배치하고 종료 뒤 앵커와 주석을 맞춘다. | [useDragResize.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/hooks/useDragResize.ts) · [PanelResizeSeparators.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel/PanelResizeSeparators.tsx) · [TilePanel.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel/TilePanel.tsx) |
| 산출물 미리보기·탭 전환 · 우선 | data가 파일 검증·preview 응답, W가 조건부 코드 강조, R이 Markdown·원문·줄 번호를 만든다. HTML은 iframe srcDoc, 이미지는 img를 통해 Chromium이 파싱·배치·표시한다. 코드/미리보기 전환 때 본문 경로가 바뀐다. | data가 크기·형식을 제공한다. W가 Markdown/코드 가시 모델을 만들고 R은 첫 화면부터 표시한다. HTML 격리·이미지 실패 처리·전체 다운로드 유지. | [ArtifactPreviewContent.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel/ArtifactPreviewContent.tsx) · [CodeBlock.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/markdown/CodeBlock.tsx) |
| 프로젝트·세션·고정 목록·산출물 카탈로그 · 조건부 | data가 DB 목록을 제공한다. R이 검색·정렬·섹션 투영·행 map을 맡는다. 타이핑·고정 변경·탐색에 비용이 집중될 수 있다. 세션 본문 검색은 별도로 debounce와 결과 30건 상한이 있고 R은 스니펫 강조만 수행한다. | data가 정렬·필터링된 페이지와 변경 ID를 제공한다. R은 가시 행·검색 선택·스니펫 표시를 담당한다. | [navSections.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/lib/navSections.ts) · [SearchModal.tsx L21](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/components/SearchModal.tsx#L21) · [ProjectsScreen.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/projects/components/ProjectsScreen.tsx) · [ArtifactsView.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/artifacts/components/ArtifactsView.tsx) |
| 스킬·MCP·공급자·엔진 설정 편집 · 조건부 | data가 관리 설정을, agent가 하네스 native 목록·모델 조회와 배포를, R이 카탈로그 필터·정렬·행 생성·custom provider JSON 파싱을 담당한다. 많은 리소스 또는 큰 JSON을 붙여넣을 때 해당 화면과 대화가 같은 UI 스레드를 쓴다. | 소유 호스트가 정렬된 조회 결과를 제공하고 큰 JSON 검증은 W 또는 저장 소유자가 담당한다. 폼 상태와 작은 선택 목록은 R에 둔다. | [CustomizeList.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx) · [customProvider.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/harnesses/opencode/v1/customProvider.ts) · [EngineModelList.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/common/components/EngineModelList.tsx) |
| 예약 목록·이력·출력 · 조건부 | data가 예약·이력, agent가 예약 shell 실행, R이 목록 필터·행 생성·상세 출력 pre를 맡는다. 목록이 많거나 큰 결과를 펼칠 때 DOM 비용이 생긴다. | data에서 페이지·출력 발췌를 제공하고 R은 현재 화면만 표시한다. 작은 요일 폼·실행 버튼은 R에 둔다. | [SchedulesScreen.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/schedules/components/SchedulesScreen.tsx) · [RunHistory.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/schedules/components/RunHistory.tsx) |
| 사용량·비용 차트 · 조건부 | data가 통계 질의를, R이 기간별 일자 채우기·주간 합계·차트 데이터 변환·차트 마운트를 담당한다. 파생값은 memo이며 일자 채우기 상한과 지연 로딩이 있다. 기간 전환·첫 마운트가 측정 지점이다. | 현 상한에서 R commit과 차트 paint를 먼저 잰다. 계산이 초과하면 data가 선택 기간 집계를 제공하고 R에는 축·포인터·그리기를 둔다. | [UsageTab.tsx L119](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings/components/UsageTab.tsx#L119) · [TokensPerDayChart.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings/components/TokensPerDayChart.tsx) |
| Claude 설치 진행 로그 · 조건부 | agent가 설치 상태를 보낸다. R은 로그마다 이전 문자열에 덧붙이고 DOM 반영 뒤 scrollHeight를 읽어 맨 아래로 이동한다. 출력 폭주 시 채팅과 같은 창의 프레임에 영향을 줄 수 있다. | agent가 출력 이벤트를 묶고 R은 최근 행만 그린다. 전체 로그는 별개로 보존하고 사용자가 위로 읽는 중 자동 이동을 제어한다. | [InstallerDialog.tsx L29](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/backend/harnesses/claude/components/InstallerDialog.tsx#L29) |
| 공통 팝오버·텍스트 입력·화면 전환과 테마 · 조건부 | R이 위치 측정·포커스·폼 높이·스타일을, Chromium이 layout·paint를 맡는다. AutoGrowTextarea는 값 변경에 높이 쓰기와 scrollHeight 읽기를 한다. 테마 변경 시 마운트된 코드 블록의 강조 결과도 바뀐다. 긴 계획 입력·다중 코드 블록·팝오버를 겹쳐 측정한다. | DOM 작업은 R에 유지하고 가시 컴포넌트만 측정한다. 동시 재강조·DOM 교체 횟수 제한은 W 클라이언트와 R이 담당한다. | [AutoGrowTextarea.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/AutoGrowTextarea.tsx) · [Popover.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/Popover.tsx) · [CodeBlock.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/markdown/CodeBlock.tsx) |

### 호스트 소유 기능 중 추가로 구별할 경로

| 기능 | 현재 소유와 화면상 해석 |
|---|---|
| 부팅·종료·업데이트·알림·창 제어 | main이 BrowserWindow·트레이·OS 알림·업데이트와 호스트 감독을 소유한다. data가 DB 복구·설정 준비를 하고 R이 대기·오류·진행 화면을 그린다. 셸의 동기 자산 확인은 응답을 늦출 수 있어 별도로 추적한다. 다운로드 소요시간이나 data 준비 대기만으로 기존 창의 프레임 손실을 판정할 수 없다. |
| 로그인 게이트·인증·공급자 연결 | data가 인증 상태·게이트와 갱신을, main이 OS 봉인·브라우저 세션 등 권한 작업을, R이 입력·모달·라우팅을 소유한다. agent의 모델·설치 조회는 필요할 때 별도 요청한다. 게이트 표시는 화면 전환 비용, 인증 서버 대기는 요청 지연으로 기록한다. |
| 디버그·오류·캡처 | agent가 mock 제어, data가 오류·부팅 보고, main이 창 로그 수신, R이 toast·debug UI와 long-task 관측을 담당한다. CapturesView는 안내 화면이다. 고정 버튼이나 안내 화면 자체에서 입력량에 비례하는 별도 병목 근거는 찾지 못했다. |

### 재현 결과와 완료 기준

| 입력과 실행 경로 | 관측값 | 판정 |
|---|---|---|
| 빈 parts 메시지 20만 개로 실제 세션 분할·조립 함수 실행 | 조각 1개. 배열에 spread로 추가하는 단계에서 RangeError | 앞선 감사에서 재현한 기능 실패. 제품 사용 빈도는 미측정 |
| 한 파일에 추가 줄 50,000개. 실제 patchLinesToDiffLines → buildDiffHunks(context=3) | 50,000개 표시 행 생성. 9회 중앙값 **44.3ms**, 범위 **24.9–57.9ms** | agent의 파일당 허용 상한 이내. R이 호출하는 두 순수 함수의 비용. 토큰화·요구사항 대응·React·DOM 비용은 제외 |
| 초안에 `/build @file.ts `를 25,000회 반복하고 두 토큰 모두 인식. 실제 tokenizeComposerDecoration | 400,000자 → 장식 조각 100,000개. 9회 중앙값 **52.6ms**, 범위 **17.8–67.5ms** | 긴 붙여넣기의 합성 부하. DOM 생성 전 결과. 일반적인 초안 크기에서의 빈도·지연은 미측정 |

두 시간 측정은 Linux Node 24.22.1에서 입력을 미리 준비하고 1회 예열한 뒤 같은 프로세스에서 9회씩 수행했다. GC를 강제하지 않았다. Windows Electron의 FPS로 환산할 수 없다. 현재 증거로는 세션 조립 실패를 확정할 수 있고, diff와 입력 장식은 순수 계산 비용을 확인할 수 있다. 나머지 행은 코드로 식별한 후보이며 실제 창에서의 버벅임 여부는 미검증이다.

**실창 검증 제안**　Windows 패키징 앱에서 같은 뷰포트와 배율로 일반 크기와 경계 입력을 비교한다. 스트리밍 중 타이핑·휠 스크롤을 계속하면서 diff/도구 카드를 열고, 긴 선택·패널 드래그·세션 전환을 각각 겹쳐 재생한다. 프레임별 간격과 누락 비율, 입력→다음 paint의 p95/최대, React commit, style/layout/paint를 기록한다. 별도 타임스탬프로 agent 발행, data 응답, R 수신, W 요청·응답, R 커밋을 연결하면 호스트 대기와 실제 화면 정지를 구분할 수 있다. 고정된 가시 행 수에서 과거 이력만 늘려도 결과가 악화되는지 확인한다. 누락 프레임·연속 누락·입력 지연의 허용치는 대상 하드웨어와 주사율을 정한 뒤 합의해야 한다.

## 남은 경로와 이주 방법

| 우선도·경로 | 코드에서 확인한 작업 | 권장 변경과 보존할 동작 |
|---|---|---|
| 최우선 · 세션 열기 | data가 전체 세션을 읽은 뒤 part 수로 분할. renderer 전송층이 조각 검사·누적 후 전체 배열 재조립. LOAD_SESSION이 모든 메시지를 map하고 미완료·오래된 도구 상태를 보정 | 단기에는 메시지 수와 전송 크기 상한도 적용하고 spread를 제거한다. 큰 단일 메시지는 별도 본문 단위로 인출한다. 장기에는 data가 최신 페이지·커서·복구된 스냅샷을 제공하고 창은 보이는 페이지와 라이브 tail만 유지한다. 진행 중 세션 우선권, 취소, 늦은 응답 폐기, 스냅샷의 원자적 교체를 보존한다 |
| 높음 · 대화 타임라인 | Claude는 groupExchanges·작업 결과 인덱스를 만든 뒤 이전 교환을 가상화한다. OpenCode는 head/tail을 투영하고 다시 합친 뒤 가시 행을 고른다. useMemo로 같은 메시지 참조에서는 head 재계산을 피한다 | 세션·revision·표시 옵션별로 worker가 행 인덱스를 유지하고 변경 행을 반환한다. 선택·접힘·실측 높이·스크롤 고정은 창에 둔다. 화면 밖 메시지 수가 늘어도 DOM 앞 단계의 비용이 증가하는지 측정한다 |
| 높음 · 스트리밍 Markdown과 도구 출력 | 확정 블록 재사용은 구현됐다. 미확정 꼬리는 다시 분할·파싱하고 완료 본문은 ReactMarkdown/GFM으로 처리한다. workToolPayload는 텍스트 언어 판별에도 JSON.parse, 객체 출력에 pretty stringify를 사용한다 | worker에서 블록 단위 표시 모델·도구 요약을 생성한다. 긴 열린 펜스·공백 없는 문단·큰 JSON은 미리보기와 펼치기로 분리한다. 링크·외부 이미지 표시 정책과 기존 React 컴포넌트는 유지한다 |
| 높음 · diff | 400줄 **합계** 안은 useMemo에서 jsdiff. 판정부터 두 입력을 개행 검색한다. 한 줄 파일의 문자 수에는 이 가드가 상한을 주지 않는다. unified patch는 100만 문자까지 동기 parsePatch. 두 축 텍스트 조립, 토큰 결과를 줄에 대조, 공백 무시·좌우 병렬 행 구성도 창 | 문자 수를 먼저 O(1) 검사하고 줄 수는 상한 초과 즉시 중단. worker에 patch 파싱·양축 파생·표시 옵션 계산까지 통합한다. git에서 이미 파싱한 줄은 재사용한다. 행 번호·리뷰 앵커·실패 시 원문 표시를 보존한다 |
| 중간 · 워커 왕복 | renderer가 입력 전문으로 캐시 키를 만들고 결과 전체를 순회해 캐시 크기를 계산한다. 단일 최신 결과가 한도를 넘을 때도 캐시에 남을 수 있다 | 원본 revision·옵션으로 키를 구성하고 결과 크기를 worker에서 함께 계산한다. 과대 결과는 캐시 생략, 가시 행·변경 범위만 회신 |
| 중간 · 첨부 이미지 | 드롭·붙여넣기는 FileReader 사용. 썸네일은 DOM canvas.drawImage·toDataURL을 호출하며 실패 시 원본 data URL을 반환한다. 비동기 파일 읽기와 동기 인코딩의 비용이 다르다 | File/Blob을 worker에 전달해 ImageBitmap·OffscreenCanvas로 축소·인코딩. 크기 제한·실패 시 제한된 미리보기, 원본 첨부 전송 의미 보존 |
| 입력 규모에 따라 · 검색·탐색·메뉴·JSON 설정 | 산출물 카탈로그 문자열 검색, 프로젝트/세션 탐색 정렬, 스킬·MCP 목록 정렬, 컴포저 메뉴 병합, 엔진 설정 JSON 파싱·검증이 창에 남는다 | DB 소유 대규모 목록은 data에서 검색·정렬·페이지화. 창 전용 조합은 worker 또는 측정된 상한. 소수 고정 탭·요일·UI 선택까지 옮길 필요는 없다 |
| 셸 잔류 | 자산 요청마다 후보 파일 existsSync, 셸 상태 부재/불량 시 이전 설정 파일 동기 읽기·파싱, 창 위치 저장 및 종료·치명 오류 로그 flush | 상시 자산 경로는 비동기화·자산 인덱스 사용을 검토한다. 과거 설정 승계는 빈도와 파일 크기를 별도 측정하고 종료 flush와 구분한다 |

**확인된 실패**　Node 24.22.1에서 현재 소스의 splitSessionMessages와 assembleSession을 직접 호출했다. parts가 빈 합성 메시지 200,000개는 한 조각이 되었고 messages.push(...chunk.messages)에서 RangeError가 발생했다. part 합계만 제한하므로 입력이 조각의 메시지 수를 제한하지 못한다. Windows 제품 세션에서 관측한 장애 빈도는 미측정이다.

**검증 결과**　현재 트리의 check-ui-thread 통과, 해당 가드 테스트 118/118 통과. 가드는 금지 import·직접 호출·등록 경계를 검사한다. 등록된 채널 수와 워커 진입점만으로 일반 배열 순회·문자열 파싱의 비용은 검증되지 않는다. 기존 verify는 AC 50개 기계 통과, AC22·AC23·AC52′ 실창 3개 대기다. 이번 감사에서 패키징 앱·전체 테스트·Windows 프레임 측정은 수행하지 않았다.

**완료 판정 방법**　고정된 Windows 설치본에서 긴 이력 열기·전환 취소, 긴 미완성 Markdown 스트림, 긴 단일 행 diff와 대형 patch, 대용량 이미지 붙여넣기를 재생한다. renderer의 요청 수신→상태 반영→첫 가시 행 paint 구간, React commit, 장기 태스크와 입력 지연을 함께 기록한다. 같은 가시 행 수에서 전체 이력·본문 크기만 증가시켜 50ms 초과와 160ms 이상 심각 구간을 확인한다. 실제 정지 원인을 워커 대기, UI 계산, DOM/layout으로 구분한다.

## 소스 근거

- [execution-model.md](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/docs/arch/execution-model.md) · docs/arch
- [plan.md](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/docs/handoff/0324-execution-contexts-ui-responsiveness/plan.md) · docs/handoff/0324-execution-contexts-ui-responsiveness
- [verify.md](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/docs/handoff/0324-execution-contexts-ui-responsiveness/verify.md) · docs/handoff/0324-execution-contexts-ui-responsiveness
- [index.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/index.ts) · app/src/main
- [bootstrap.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/app/data-host/bootstrap.ts) · app/src/main/app/data-host
- [bootstrap.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/app/agent-host/bootstrap.ts) · app/src/main/app/agent-host
- [session-load.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/app/data-host/session-load.ts) · app/src/main/app/data-host
- [data-host.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/shared/data-host.ts) · app/src/shared
- [session-load.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/api/transport/session-load.ts) · app/src/renderer/src/shared/api/transport
- [chatReducer.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/reducer/chatReducer.ts) · app/src/renderer/src/features/chat/reducer
- [Timeline.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx) · app/src/renderer/src/features/chat/harnesses/claude/transcript
- [Timeline.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx) · app/src/renderer/src/features/chat/harnesses/opencode/transcript
- [StreamingMarkdown.tsx](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/markdown/StreamingMarkdown.tsx) · app/src/renderer/src/features/chat/components/markdown
- [markdownBlocks.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/markdownBlocks.ts) · app/src/renderer/src/features/chat/lib
- [workToolPresentation.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/workToolPresentation.ts) · app/src/renderer/src/features/chat/lib
- [inline.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/inline.ts) · app/src/renderer/src/shared/compute
- [limits.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/limits.ts) · app/src/renderer/src/shared/compute
- [handler.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/worker/handler.ts) · app/src/renderer/src/shared/compute/worker
- [diffSyntax.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/diffSyntax.ts) · app/src/renderer/src/features/chat/lib
- [diffDisplay.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/diffDisplay.ts) · app/src/renderer/src/features/chat/lib
- [client.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/client.ts) · app/src/renderer/src/shared/compute
- [protocol.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/protocol.ts) · app/src/renderer/src/shared/compute
- [imageThumb.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib/imageThumb.ts) · app/src/renderer/src/features/chat/lib
- [artifactCatalogStore.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/artifacts/store/artifactCatalogStore.ts) · app/src/renderer/src/features/artifacts/store

## 공개 기능 계약 전수표

[ipc.ts](https://github.com/muzaby/orca-skin/blob/9692a27f0ddc466dd501bb2cd66b2a00a6e73f67/app/src/shared/ipc.ts) (구현 전) · [channel-owner.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/shared/channel-owner.ts) (현재)

| 기능 키 | 채널 | 구현 전 백엔드 | 현재 담당 | 전송 |
|---|---|---|---|---|
| `chatSend` | `oo:chat:send` | main | agent | 창 전용 포트 |
| `chatSteerCancel` | `oo:chat:steerCancel` | main | agent | 창 전용 포트 |
| `chatSteerSendNow` | `oo:chat:steerSendNow` | main | agent | 창 전용 포트 |
| `chatEvent` | `oo:chat:event` | main | agent | 창 전용 포트 |
| `chatBackgroundState` | `oo:chat:backgroundState` | main | agent | 창 전용 포트 |
| `chatBackgroundEvent` | `oo:chat:backgroundEvent` | main | agent | 창 전용 포트 |
| `chatStopBackgroundTask` | `oo:chat:stopBackgroundTask` | main | agent | 창 전용 포트 |
| `chatPromoteBackgroundTask` | `oo:chat:promoteBackgroundTask` | main | agent | 창 전용 포트 |
| `chatCancel` | `oo:chat:cancel` | main | agent | 창 전용 포트 |
| `chatStopSubagent` | `oo:chat:stopSubagent` | main | agent | 창 전용 포트 |
| `chatBackgroundSubagent` | `oo:chat:backgroundSubagent` | main | agent | 창 전용 포트 |
| `chatDiscardSession` | `oo:chat:discardSession` | main | agent | 창 전용 포트 |
| `backendList` | `oo:backend:list` | main | agent | 창 전용 포트 |
| `harnessAvailability` | `oo:harness:availability` | main | agent | 창 전용 포트 |
| `harnessRecheck` | `oo:harness:recheck` | main | agent | 창 전용 포트 |
| `agentList` | `oo:agent:list` | main | agent | 창 전용 포트 |
| `installStart` | `oo:install:start` | main | agent | 창 전용 포트 |
| `installStatus` | `oo:install:status` | main | agent | 창 전용 포트 |
| `gitSnapshot` | `oo:git:snapshot` | main | agent | 창 전용 포트 |
| `gitBranches` | `oo:git:branches` | main | agent | 창 전용 포트 |
| `gitCheckout` | `oo:git:checkout` | main | agent | 창 전용 포트 |
| `gitDiffPatch` | `oo:git:diffPatch` | main | agent | 창 전용 포트 |
| `sessionNativeResources` | `oo:session:native-resources` | main | agent | 창 전용 포트 |
| `extensionCatalog` | `oo:extensions:catalog` | main | agent | 창 전용 포트 |
| `extensionsChanged` | `oo:extensions:changed` | main | agent | 창 전용 포트 |
| `extensionOpenCodePluginsChanged` | `oo:extensions:opencode-plugins-changed` | main | agent | 창 전용 포트 |
| `extensionSetEnabled` | `oo:extensions:setEnabled` | main | agent | 창 전용 포트 |
| `extensionOpen` | `oo:extensions:open` | main | agent | 창 전용 포트 |
| `composerCatalog` | `oo:composer:catalog` | main | agent | 창 전용 포트 |
| `composerCatalogRelease` | `oo:composer:catalog-release` | main | agent | 창 전용 포트 |
| `composerCatalogInvalidated` | `oo:composer:catalog-invalidated` | main | agent | 창 전용 포트 |
| `sessionNativeResourcesChanged` | `oo:session:native-resources-changed` | main | agent | 창 전용 포트 |
| `sessionTitleEvent` | `oo:session:titleEvent` | main | agent | 창 전용 포트 |
| `concurrencyEvent` | `oo:concurrency:event` | main | agent | 창 전용 포트 |
| `permissionRespond` | `oo:permission:respond` | main | agent | 창 전용 포트 |
| `permissionSetMode` | `oo:permission:setMode` | main | agent | 창 전용 포트 |
| `debugGetMock` | `oo:debug:getMock` | main | agent | 창 전용 포트 |
| `debugSetMock` | `oo:debug:setMock` | main | agent | 창 전용 포트 |
| `engineAdd` | `oo:engine:add` | main | agent | 창 전용 포트 |
| `engineUpdate` | `oo:engine:update` | main | agent | 창 전용 포트 |
| `engineDelete` | `oo:engine:delete` | main | agent | 창 전용 포트 |
| `engineRead` | `oo:engine:read` | main | agent | 창 전용 포트 |
| `engineImportUserSettings` | `oo:engine:importUserSettings` | main | agent | 창 전용 포트 |
| `errorReportEvent` | `oo:error:reportEvent` | main | data | 창 전용 포트 |
| `errorDrain` | `oo:error:drain` | main | data | 창 전용 포트 |
| `errorRevealLog` | `oo:error:revealLog` | main | data | 창 전용 포트 |
| `bootReport` | `oo:boot:report` | main | data | 창 전용 포트 |
| `settingsGet` | `oo:settings:get` | main | data | 창 전용 포트 |
| `settingsSet` | `oo:settings:set` | main | data | 창 전용 포트 |
| `skillsList` | `oo:skills:list` | main | data | 창 전용 포트 |
| `skillsAuthor` | `oo:skills:author` | main | data | 창 전용 포트 |
| `skillsUpload` | `oo:skills:upload` | main | data | 창 전용 포트 |
| `skillsSetEnabled` | `oo:skills:setEnabled` | main | data | 창 전용 포트 |
| `skillsOpen` | `oo:skills:open` | main | data | 창 전용 포트 |
| `skillsShowInFolder` | `oo:skills:showInFolder` | main | data | 창 전용 포트 |
| `skillsRemove` | `oo:skills:remove` | main | data | 창 전용 포트 |
| `filesList` | `oo:files:list` | main | data | 창 전용 포트 |
| `filesPickAttachments` | `oo:files:pickAttachments` | main | data | 창 전용 포트 |
| `filesPickDirectory` | `oo:files:pickDirectory` | main | data | 창 전용 포트 |
| `filesOpenPath` | `oo:files:openPath` | main | data | 창 전용 포트 |
| `filesOpenContextFile` | `oo:files:openContextFile` | main | data | 창 전용 포트 |
| `filesReadAttachment` | `oo:files:readAttachment` | main | data | 창 전용 포트 |
| `artifactList` | `oo:artifact:list` | main | data | 창 전용 포트 |
| `artifactCatalog` | `oo:artifact:catalog` | main | data | 창 전용 포트 |
| `artifactSetPinned` | `oo:artifact:setPinned` | main | data | 창 전용 포트 |
| `artifactStatus` | `oo:artifact:status` | main | data | 창 전용 포트 |
| `artifactPreview` | `oo:artifact:preview` | main | data | 창 전용 포트 |
| `artifactSave` | `oo:artifact:save` | main | data | 창 전용 포트 |
| `artifactReveal` | `oo:artifact:reveal` | main | data | 창 전용 포트 |
| `artifactTrash` | `oo:artifact:trash` | main | data | 창 전용 포트 |
| `sessionCwd` | `oo:session:cwd` | main | data | 창 전용 포트 |
| `sessionList` | `oo:session:list` | main | data | 창 전용 포트 |
| `sessionLoad` | `oo:session:load` | main | data | 창 전용 포트 |
| `sessionRefresh` | `oo:session:refresh` | main | data | 창 전용 포트 |
| `sessionLoadChunk` | `oo:session:load-chunk` | 신규 | data | 창 전용 포트 |
| `sessionLoadCancel` | `oo:session:load-cancel` | 신규 | data | 창 전용 포트 |
| `sessionDelete` | `oo:session:delete` | main | data | 창 전용 포트 |
| `sessionRename` | `oo:session:rename` | main | data | 창 전용 포트 |
| `sessionSetPinned` | `oo:session:setPinned` | main | data | 창 전용 포트 |
| `managedMcpChanged` | `oo:extensions:managed-mcp-changed` | main | data | 창 전용 포트 |
| `sessionAddDirectory` | `oo:session:addDirectory` | main | data | 창 전용 포트 |
| `projectList` | `oo:project:list` | main | data | 창 전용 포트 |
| `projectCreate` | `oo:project:create` | main | data | 창 전용 포트 |
| `projectUpdate` | `oo:project:update` | main | data | 창 전용 포트 |
| `projectDelete` | `oo:project:delete` | main | data | 창 전용 포트 |
| `projectSetPinned` | `oo:project:setPinned` | main | data | 창 전용 포트 |
| `projectListSessions` | `oo:project:listSessions` | main | data | 창 전용 포트 |
| `scheduleList` | `oo:schedule:list` | main | data | 창 전용 포트 |
| `scheduleCreate` | `oo:schedule:create` | main | data | 창 전용 포트 |
| `scheduleUpdate` | `oo:schedule:update` | main | data | 창 전용 포트 |
| `scheduleDelete` | `oo:schedule:delete` | main | data | 창 전용 포트 |
| `scheduleSetEnabled` | `oo:schedule:setEnabled` | main | data | 창 전용 포트 |
| `scheduleRunNow` | `oo:schedule:runNow` | main | data | 창 전용 포트 |
| `scheduleListRuns` | `oo:schedule:listRuns` | main | data | 창 전용 포트 |
| `schedulePromptReport` | `oo:schedule:promptReport` | main | data | 창 전용 포트 |
| `scheduleChanged` | `oo:schedule:changed` | main | data | 창 전용 포트 |
| `schedulePromptStart` | `oo:schedule:promptStart` | main | data | 창 전용 포트 |
| `searchMessages` | `oo:search:messages` | main | data | 창 전용 포트 |
| `mcpList` | `oo:mcp:list` | main | data | 창 전용 포트 |
| `mcpAdd` | `oo:mcp:add` | main | data | 창 전용 포트 |
| `mcpUpdate` | `oo:mcp:update` | main | data | 창 전용 포트 |
| `mcpDelete` | `oo:mcp:delete` | main | data | 창 전용 포트 |
| `costUsage` | `oo:cost:usage` | main | data | 창 전용 포트 |
| `costUsageEvent` | `oo:cost:usageEvent` | main | data | 창 전용 포트 |
| `costSetProviderLimit` | `oo:cost:setProviderLimit` | main | data | 창 전용 포트 |
| `costRefreshUsage` | `oo:cost:refreshUsage` | main | data | 창 전용 포트 |
| `costUsageStats` | `oo:cost:usageStats` | main | data | 창 전용 포트 |
| `providerLogin` | `oo:provider:login` | main | data | 창 전용 포트 |
| `providerContinue` | `oo:provider:continue` | main | data | 창 전용 포트 |
| `providerReauth` | `oo:provider:reauth` | main | data | 창 전용 포트 |
| `providerRevoke` | `oo:provider:revoke` | main | data | 창 전용 포트 |
| `providerConnect` | `oo:provider:connect` | main | data | 창 전용 포트 |
| `providerState` | `oo:provider:state` | main | data | 창 전용 포트 |
| `bootWhenReady` | `oo:boot:whenReady` | main | shell | 셸 IPC |
| `windowMinimize` | `oo:window:minimize` | main | shell | 셸 IPC |
| `windowMaximize` | `oo:window:maximize` | main | shell | 셸 IPC |
| `windowClose` | `oo:window:close` | main | shell | 셸 IPC |
| `notifyShow` | `oo:notify:show` | main | shell | 셸 IPC |
| `updateState` | `oo:update:state` | main | shell | 셸 IPC |
| `updateCheck` | `oo:update:check` | main | shell | 셸 IPC |
| `updateDownload` | `oo:update:download` | main | shell | 셸 IPC |
| `updateQuitAndInstall` | `oo:update:quitAndInstall` | main | shell | 셸 IPC |
| `updateStateEvent` | `oo:update:stateEvent` | main | shell | 셸 IPC |
| `updateProgressEvent` | `oo:update:progressEvent` | main | shell | 셸 IPC |
| `logEmit` | `oo:log:emit` | main | shell | 셸 IPC |

## 호스트 간 내부 작업

| 실행 경계 | 등록된 작업 |
|---|---|
| 피어 메시지 [peer-protocol.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/shared/peer-protocol.ts) | `turn.begin`, `turn.event`, `turn.artifactEvent`, `turn.askAnswers`, `turn.commitUser`, `turn.end`, `provider.event`, `provider.forget`, `turn.persistFailed`, `data.query`, `settings.snapshot`, `settings.patch`, `settings.write`, `agent.call`, `data.write`, `report.error`, `report.boot`, `harness.availability`, `tools.snapshot`, `mcp.snapshot`, `auth.state`, `chat.relay` |
| data 조회·쓰기 [data-ops.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/app/data-host/data-ops.ts) | `getSessionById`, `getProject`, `workspacePaths`, `getProjectContextForSession`, `getTitleSource`, `getManagedWorktreeBySession`, `nativeRecovery`, `nativeObserve`, `nativeHistoryPrevious`, `nativeHistoryRaw`, `loadSessionArchive`, `backgroundEvents`, `sessionAgentKind`, `sessionBaseline`, `sessionBackend`, `harnessEnvironments`, `harnessRuntimeConfig`, `harnessIsReadOnly`, `harnessAppEnv`, `skills`, `runtimeToolCall`, `managedMcpAcquire`, `captureOutput`, `mcpResolution`, `updateSessionProviderKey`, `ensurePathProject`, `updateSessionTitleAuto`, `insertManagedWorktree`, `deleteManagedWorktree`, `updateSessionCwd`, `nativePrepareRecovery`, `nativeAcceptRecovery`, `nativeRecoveryPrompt`, `recoverSessionHistory`, `runtimeToolCancel`, `managedMcpRelease`, `extensionsDeployed`, `harnessSettingsChanged` |
| agent 호출 [agent-ops.ts](https://github.com/muzaby/orca-skin/blob/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/main/app/agent-host/agent-ops.ts) | `sessionActivity`, `discardSession`, `readNativeHistory`, `runShell`, `cancelShell`, `sessionBusy`, `harnessInstalled`, `harnessListModels`, `deployExtensions` |

## Renderer 기능별 소스 색인

기준 커밋에 있는 제품 TypeScript 모듈을 디렉터리별로 나열했다. 테스트·fixture·선언 파일은 제외했다. 이 색인은 상세 구현을 찾아가기 위한 것으로, 개별 파일의 병목 여부를 판정하지 않는다.

- **[app/src/renderer/src](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src)**　App.tsx, main.tsx

- **[app](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/app)**　AppLayout.tsx, BootFailureFrame.tsx, BootRedirector.tsx, BridgeMissingScreen.tsx, ErrorToastLayer.tsx, FullFrameShell.tsx, GateFrame.tsx, Header.tsx, OverlayLayer.tsx, RootGate.tsx, Sidebar.tsx, SidebarUserButton.tsx, WinControls.tsx, errorToastTarget.ts, navItems.ts, rootElement.ts, rootFrame.ts, router.tsx

- **[app/boot](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/app/boot)**　BootScreen.tsx, bootStore.ts, steps.ts

- **[app/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/app/hooks)**　useArtifactCatalogViewer.tsx, useChatRouteSync.ts, useChatSessionsSync.ts, useCompletionNotifier.ts, useProjectCatalogSync.ts, useProjectDeletion.ts, useScheduledPromptRelay.ts, useSessionCompletion.ts, useSessionHandlers.ts, useSidebarSlots.tsx

- **[features/artifacts](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/artifacts)**　index.ts

- **[features/artifacts/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/artifacts/components)**　ArtifactCatalogRow.tsx, ArtifactsView.tsx

- **[features/artifacts/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/artifacts/store)**　artifactCatalogStore.ts

- **[features/backend](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/backend)**　index.ts

- **[features/backend/harnesses/claude/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/backend/harnesses/claude/components)**　AuthExpiredModal.tsx, InstallerDialog.tsx

- **[features/backend/providers](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/backend/providers)**　BackendProvider.tsx

- **[features/backend/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/backend/store)**　backendStore.ts

- **[features/captures](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/captures)**　index.ts

- **[features/captures/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/captures/components)**　CapturesView.tsx

- **[features/chat](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat)**　format.ts, index.ts

- **[features/chat/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components)**　AgentModeToggle.tsx, ApprovalCard.tsx, ArtifactCard.tsx, AutomaticFeedDebugSection.tsx, ChatTile.tsx, ChatTitleBar.tsx, ChatView.tsx, Composer.tsx, CwdButton.tsx, CwdPanel.tsx, ExecutionSettingsPicker.tsx, HarnessUnavailableNotice.tsx, Landing.tsx, LandingHeader.tsx, LandingProjectPicker.tsx, Notice.tsx, ProjectMenuPanel.tsx, ProjectPickerChip.tsx, StatusLine.tsx, UsagePanel.tsx, landingFrame.ts

- **[features/chat/components/composer](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/composer)**　GitRow.tsx, ModelMenu.tsx, modelSelection.ts

- **[features/chat/components/markdown](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/markdown)**　StreamingMarkdown.tsx

- **[features/chat/components/rightpanel](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/rightpanel)**　RightPanel.tsx, tileRegistry.ts

- **[features/chat/components/transcript](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/components/transcript)**　AssistantMessage.tsx, HarnessScrollController.tsx, LineageBanner.tsx, PendingAssistantStatus.tsx, TranscriptView.tsx

- **[features/chat/harnesses](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses)**　catalog.ts, contracts.ts, modelPresentation.ts, presentation.ts, types.ts

- **[features/chat/harnesses/claude](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude)**　Spinner.tsx, presentation.ts, rightPanel.ts, surfaces.ts

- **[features/chat/harnesses/claude/composer](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/composer)**　Controls.tsx, ConversationStatus.tsx, ConversationStatusLine.tsx, EffortMenu.tsx, ModeMenu.tsx, Module.tsx, QuestionCard.tsx, Requests.tsx, StatusPopover.tsx, SubmitButton.tsx, ToolApproval.tsx, appearance.ts, approval.ts, effort.ts, modelPresentation.ts, modes.ts, statusCopy.ts, statusViewModel.ts

- **[features/chat/harnesses/claude/landing](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/landing)**　presentation.ts

- **[features/chat/harnesses/claude/rightpanel](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/rightpanel)**　CanonicalBackgroundContent.tsx, LegacySubAgentTile.tsx, Panel.tsx, SubAgentTileContent.tsx, TaskTileContent.tsx, tileRegistry.ts

- **[features/chat/harnesses/claude/transcript](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript)**　AskExchange.tsx, AssistantSegment.tsx, AssistantTurn.tsx, ErrorCard.tsx, Exchange.tsx, PendingAssistant.tsx, ReasoningBlock.tsx, ScrollController.tsx, Timeline.tsx, ToolCard.tsx, ToolGroup.tsx, WorkActivity.tsx, WorkToolBody.tsx, WorkToolTimeline.tsx, appearance.ts, registry.ts, useScrollAnchor.ts

- **[features/chat/harnesses/claude/transcript/tool-bodies](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies)**　AgentTaskBody.tsx, AskBody.tsx, BashBody.tsx, DiffBody.tsx, FileBody.tsx, KeyValueBody.tsx, TaskToolBody.tsx

- **[features/chat/harnesses/common/composer](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/composer)**　AnchoredDropdown.tsx, AttachMenu.tsx, AttachmentChip.tsx, AttachmentThumb.tsx, AttachmentTray.tsx, AutocompleteSectionHeader.tsx, BranchChip.tsx, BranchMenu.tsx, BranchSwitchActions.tsx, BranchSwitchDialog.tsx, CheckoutErrorBody.tsx, ComposerChip.tsx, ComposerDecorationLayer.tsx, ComposerInputController.tsx, ComposerInputSurface.tsx, ExtraDirChip.tsx, GitIdentityMenu.tsx, GitIdentityMenus.tsx, MentionAutocomplete.tsx, RequirementTray.tsx, SkillAutocomplete.tsx, WorktreeToggle.tsx, autocompleteKeys.ts, branchChipState.ts, chipSurface.ts, composerAttachMenu.ts, composerDecoration.ts, composerPanel.ts, composerScrollProjection.ts, composerSubmit.ts, draftSnapshot.ts, gitIdentityMenuActions.ts, gitRowState.ts, toolApproval.ts, useGitIdentityRemote.ts, useGitSnapshot.ts

- **[features/chat/harnesses/common/rightpanel](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/rightpanel)**　ArtifactPreviewContent.tsx, ArtifactViewer.tsx, BackgroundCard.tsx, BackgroundModelLabel.tsx, BackgroundTaskGroup.tsx, ChangedNavigationSidebar.tsx, DiffReview.tsx, DiffTileContent.tsx, FileDiffSection.tsx, GitContextBar.tsx, PanelResizeSeparators.tsx, PlanCommentOverlay.tsx, PlanCommentPopover.tsx, PlanTileContent.tsx, RightPanelColumn.tsx, RightPanelTile.tsx, SubAgentTaskDetail.tsx, TaskContextContent.tsx, TaskOutputContent.tsx, TaskPanelContent.tsx, TaskProgressList.tsx, TaskScheduleContent.tsx, TaskStatusIcon.tsx, TaskTileSections.tsx, TilePanel.tsx, WorkTaskProgress.tsx, diffComparison.ts, diffRequirements.ts, diffViewMenuItems.ts, panelFocus.ts, sessionChangesData.ts

- **[features/chat/harnesses/common/transcript](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/common/transcript)**　AgentTaskRow.tsx, ArtifactCards.tsx, AssistantMessage.tsx, CompactBoundaryMarker.tsx, DiffLinesStatus.tsx, DiffTable.tsx, ForegroundShellActions.tsx, ForkBoundaryMarker.tsx, InlineSubagentDetail.tsx, MessageMeta.tsx, PendingSteerTurn.tsx, StatusLine.tsx, SubagentNoticeRow.tsx, TranscriptActionRow.tsx, TranscriptRuntime.ts, TurnErrorBanner.tsx, UserBubbleText.tsx, UserDiffRequirements.tsx, UserMessage.tsx, UserTurn.tsx, diffSyntaxText.tsx, pendingSteerControls.ts, scrollTypes.ts, typography.ts

- **[features/chat/harnesses/opencode](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode)**　Icon.tsx, Spinner.tsx, Wordmark.tsx, presentation.ts, rightPanel.ts, surfaces.ts, toolPresentation.ts, toolPresentation.types.ts

- **[features/chat/harnesses/opencode/composer](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/composer)**　AboveInput.tsx, Chip.tsx, Controls.tsx, DockPrompt.tsx, Module.tsx, PermissionDock.tsx, QuestionDock.tsx, QuestionOption.tsx, RequestDock.tsx, SubmitButton.tsx, TodoDock.tsx, ToolApproval.tsx, agentSelection.ts, appearance.ts, approval.ts, composerAgentStore.ts, composerCatalogState.ts, composerModelStore.ts, inputIntent.ts, modelPresentation.ts, requestQueue.ts, todoState.ts, useComposerCatalog.ts

- **[features/chat/harnesses/opencode/landing](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/landing)**　Brand.tsx, presentation.ts

- **[features/chat/harnesses/opencode/rightpanel](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/rightpanel)**　AgentViews.tsx, Panel.tsx, Sources.tsx, chrome.tsx, model.ts, navigation.ts, tileRegistry.ts, tiles.tsx

- **[features/chat/harnesses/opencode/transcript](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/transcript)**　AskExchange.tsx, AssistantSegment.tsx, ScrollController.tsx, Text.tsx, Timeline.tsx, ToolBody.tsx, ToolCard.tsx, ToolGroup.tsx, appearance.ts, diffAppearance.ts, filePresentation.ts, projection.ts, scrollContext.ts, scrollPolicy.ts, toolGrouping.ts, viewState.ts

- **[features/chat/harnesses/opencode/v1](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/opencode/v1)**　toolPresentation.ts

- **[features/chat/harnesses/registries](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/harnesses/registries)**　assistant.tsx, composer.ts, landing.ts, rightpanel.ts, status.ts, transcript.tsx

- **[features/chat/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/hooks)**　useArtifactViewerActions.ts, useAttachments.ts, useColumnSlideOnReflow.ts, useDiffLines.ts, useDiffSyntax.ts, useDirectoryPicker.ts, useGitPatch.ts, useLandingProjectPicker.ts, useMentionAutocomplete.ts, useNativeResources.ts, usePlanCommentSelection.ts, useSessionOutputs.ts, useSkillAutocomplete.ts, useTaskBoard.ts, useTaskContext.ts, useTranscriptVirtualizer.ts, useUsageForTelemetryProvider.ts

- **[features/chat/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/lib)**　activityLabel.ts, agentPresentation.ts, artifactFeedback.ts, artifactIssueReport.ts, artifactOperationIssues.ts, ask.ts, attachMenuModel.ts, backgroundPresentation.ts, bubbleCollapse.ts, canonicalBackground.ts, changedFileTree.ts, composerDraft.ts, composerPromotion.ts, composerSkills.ts, composerToken.ts, concurrencyNotice.ts, contextWindow.ts, diffDisplay.ts, diffHunks.ts, diffLines.ts, diffPatchLines.ts, diffRequirementScroll.ts, diffSyntax.ts, diffViewport.ts, errorLabels.ts, eventCoalescer.ts, executionSettings.ts, fileSectionScroll.ts, gitPatchCache.ts, imageThumb.ts, landingProjectOptions.ts, lang.ts, markdownBlocks.ts, mentionAutocomplete.ts, nativeResourceState.ts, parts.ts, planCommentDom.ts, planComments.ts, pluginMention.ts, projectMenuItems.ts, repoPath.ts, responseProgress.ts, rightPanelLayout.ts, rightPanelTiles.ts, rightPanelViewport.ts, sendAdmission.ts, skillGroups.ts, taskBoard.ts, taskContext.ts, telemetry.ts, toolMeta.ts, turns.ts, unifiedDiffLines.ts, workActivity.ts, workToolPresentation.ts, workToolResults.ts, worktreeDisplay.ts

- **[features/chat/providers](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/providers)**　ChatProvider.tsx

- **[features/chat/reducer](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/reducer)**　chatReducer.ts

- **[features/chat/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/chat/store)**　artifactStore.ts, artifactViewerStore.ts, automaticFeedDebug.ts, backgroundStore.ts, bubbleExpansionStore.ts, chatStore.ts

- **[features/cost](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/cost)**　index.ts

- **[features/cost/providers](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/cost/providers)**　CostProvider.tsx

- **[features/debug](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/debug)**　index.ts

- **[features/debug/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/debug/components)**　DebugPanel.tsx

- **[features/debug/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/debug/hooks)**　useDebugMock.ts

- **[features/engine](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine)**　index.ts

- **[features/engine/common/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/common/components)**　AgentEnvironmentView.tsx, EngineCard.tsx, EngineFormModal.tsx, EngineModelList.tsx

- **[features/engine/common/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/common/hooks)**　useEngines.ts

- **[features/engine/common/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/common/lib)**　providerCatalog.ts

- **[features/engine/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/components)**　AgentEnvironmentView.tsx, EngineCard.tsx, EngineFormModal.tsx

- **[features/engine/harnesses](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/harnesses)**　configuration.ts, types.ts

- **[features/engine/harnesses/claude](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/harnesses/claude)**　configuration.ts, providerCatalog.ts

- **[features/engine/harnesses/opencode](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/harnesses/opencode)**　ProviderForm.tsx, index.ts, providerForm.types.ts

- **[features/engine/harnesses/opencode/v1](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/engine/harnesses/opencode/v1)**　configuration.ts, customProvider.ts

- **[features/projects](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/projects)**　index.ts

- **[features/projects/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/projects/components)**　CreateProjectModal.tsx, EditInstructionsModal.tsx, ProjectCatalogRow.tsx, ProjectInfoHero.tsx, ProjectInstructionsCard.tsx, ProjectInstructionsSidebar.tsx, ProjectLandingHeader.tsx, ProjectsScreen.tsx, ProjectsView.tsx, SidebarCard.tsx

- **[features/projects/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/projects/store)**　projectsStore.ts

- **[features/providers](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/providers)**　index.ts

- **[features/providers/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/providers/components)**　GateLogin.tsx, ProviderDebugSection.tsx

- **[features/providers/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/providers/hooks)**　useProviderGate.ts, useProviderPrincipal.ts

- **[features/providers/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/providers/lib)**　principal.ts

- **[features/providers/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/providers/store)**　bypassStore.ts

- **[features/schedules](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/schedules)**　index.ts

- **[features/schedules/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/schedules/components)**　RunHistory.tsx, ScheduleDetail.tsx, ScheduleRow.tsx, ScheduleTaskModal.tsx, SchedulesScreen.tsx, SchedulesView.tsx, TriggerFields.tsx

- **[features/schedules/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/schedules/lib)**　runError.ts, scheduleForm.ts, taskActions.ts, triggerLabel.ts

- **[features/schedules/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/schedules/store)**　schedulesStore.ts

- **[features/sessions](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions)**　index.ts

- **[features/sessions/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/components)**　PinnedProjectsSection.tsx, PinnedSection.tsx, ProjectSessionsPanel.tsx, SearchModal.tsx, SessionList.tsx, SessionRow.tsx

- **[features/sessions/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/hooks)**　useNavSections.ts, useProjectSessions.ts

- **[features/sessions/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/lib)**　navIconState.ts, navSections.ts, projectMembership.ts, sessionPlacement.ts

- **[features/sessions/providers](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/providers)**　SessionsProvider.tsx

- **[features/sessions/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/sessions/store)**　projectNavStore.ts, sessionsStore.ts

- **[features/settings](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings)**　index.ts

- **[features/settings/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings/components)**　GeneralTab.tsx, ProviderUsageTab.tsx, SettingsModal.tsx, TokensPerDayChart.tsx, UsageLimitViews.tsx, UsageTab.tsx, parts.tsx

- **[features/settings/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings/hooks)**　useUpdateCheckSetting.ts, useUsageStats.ts

- **[features/settings/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings/lib)**　usageFormat.ts

- **[features/settings/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/settings/store)**　settingsModalStore.ts

- **[features/skills](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills)**　index.ts

- **[features/skills/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills/components)**　AddMcpServerModal.tsx

- **[features/skills/components/customize](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills/components/customize)**　CatalogToggle.tsx, CustomMcpModal.tsx, CustomizeList.tsx, CustomizeTabs.tsx, ExtensionDetailPane.tsx, ExtensionsCatalogModal.tsx, ExtensionsCatalogView.tsx, McpDetail.tsx, ProviderAuthActions.tsx, ProviderDetail.tsx, SkillAddMenu.tsx, SkillAuthorModal.tsx, SkillDetail.tsx, SkillUploadModal.tsx, SourceHeading.tsx, providerAuthActionModel.ts

- **[features/skills/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills/hooks)**　useCustomizeSkills.ts, useMcpServers.ts, useNativeMcpCatalog.ts, useProviders.ts

- **[features/skills/lib](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills/lib)**　catalogOrder.ts, catalogRows.ts, catalogSelection.ts, pluginPresentation.ts, providerPresentation.ts, providerRows.ts

- **[features/skills/store](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/skills/store)**　extensionsModalStore.ts

- **[features/update](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/update)**　index.ts

- **[features/update/components](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/update/components)**　UpdateDebugSection.tsx, UpdateDialog.tsx

- **[features/update/providers](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/features/update/providers)**　UpdateProvider.tsx

- **[pages](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/pages)**　AgentPage.tsx, ArtifactsPage.tsx, CapturesPage.tsx, ChatPage.tsx, NewChatLandingPage.tsx, PluginsPage.tsx, ProjectLandingPage.tsx, ProjectsPage.tsx, SchedulesPage.tsx, useSessionActions.ts

- **[shared](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared)**　logging.ts

- **[shared/api](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/api)**　bridge.ts, ipc.ts

- **[shared/api/transport](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/api/transport)**　host-port.ts, install.ts, oo.ts, session-load.ts

- **[shared/compute](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute)**　client.ts, diffModel.ts, inline.ts, limits.ts, protocol.ts, useHighlightedHtml.ts

- **[shared/compute/worker](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/compute/worker)**　compute.worker.ts, handler.ts, highlighter.ts

- **[shared/config](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/config)**　providerAuth.ts, theme.ts

- **[shared/errors](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/errors)**　errorToastModel.ts, errorToastStore.ts, globalHandlers.ts, index.ts, mainErrorBridge.ts, reportError.ts

- **[shared/hooks](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/hooks)**　sidePaneResize.ts, useAgents.ts, useCatalogSearch.ts, useDragResize.ts, useEscToClose.ts, useReducedMotion.ts, useSkills.ts

- **[shared/i18n](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/i18n)**　datetime.ts, index.ts

- **[shared/i18n/resources](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/i18n/resources)**　en.ts, ko.ts

- **[shared/navigation](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/navigation)**　index.ts, routes.ts

- **[shared/perf](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/perf)**　longTaskReporter.ts

- **[shared/stores](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/stores)**　agentStore.ts, harnessAvailabilityStore.ts, usageStore.ts

- **[shared/theme](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/theme)**　TweakProvider.tsx, index.ts

- **[shared/ui](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui)**　ArcSpinner.tsx, AuthKindChoices.tsx, AutoGrowTextarea.tsx, Button.tsx, CascadeMenu.tsx, CatalogListRow.tsx, CatalogSearch.tsx, CatalogTabs.tsx, ClaudeLogo.tsx, ConfirmDialogHost.tsx, CopyIconButton.tsx, DetailSidePane.tsx, ErrorToastHost.tsx, FloatingPanel.tsx, HarnessLogo.tsx, Icon.tsx, KebabButton.tsx, MenuChip.tsx, MenuItem.tsx, Meter.tsx, Modal.tsx, OoLogo.tsx, OpenCodeLogo.tsx, OpenCodeWordmark.tsx, PanelControls.tsx, Popover.tsx, Rail.tsx, ReadingColumn.tsx, RenameInput.tsx, ResizableSidePane.tsx, SidebarSection.tsx, SparkSpinner.tsx, Status.tsx, Toggle.tsx, TooltipHost.tsx, UsageCircle.tsx, cascadeMenuState.ts, confirmDialogStore.ts, elapsed.ts, mock.ts, popoverPosition.ts, sparkTracks.ts, tooltipController.ts, tooltipStyle.ts, tooltipTarget.ts, usageTone.ts

- **[shared/ui/markdown](https://github.com/muzaby/orca-skin/tree/ee8ac8173c83a97114a9dc8bd257ba770a7dc368/app/src/renderer/src/shared/ui/markdown)**　CodeBlock.tsx, Markdown.tsx, isCodeBlock.ts, streamingContext.ts, syntax.ts, themeStore.ts, typography.ts
