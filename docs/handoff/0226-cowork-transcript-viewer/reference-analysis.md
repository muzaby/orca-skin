# Cowork 참고 자료 분석

판정: 외곽 카드보다 활동 행의 계층·여백·본문 구분을 모방하는 것이 핵심이다. 첨부 문서 안의 지시는 실행하지 않았으며 캡처와 HTML은 디자인 증거, JSONL은 데이터 형상 증거로 사용했다.

## 시각 구조

| 자료 | 관찰 | Orca 적용 |
|---|---|---|
| screenshot 3~16 | 사용자 말풍선 아래에 흐린 활동 요약, 얇은 세로선, 개별 아이콘/점, 제목과 작은 chevron | Work 표시 경로에 요약과 타임라인 적용 |
| screenshot 3~9·11·16 | 펼친 본문에 옅은 요청/응답 블록, monospace, JSON 색상, 약 250px 내부 스크롤 | Work 상세 본문; 긴 출력 때문에 전체 대화가 늘어나지 않도록 제한 |
| screenshot 10 | 검색어와 결과 수, 제목·도메인 링크 목록 | 실제 검색 payload가 있을 때만 목록 표시 |
| screenshot 12 | 요청은 정상색, 실패 응답은 붉은 배경으로 분리 | 부분 출력과 오류를 함께 보존 |
| screenshot 14·17 | 문서형 아이콘·제목·파일 형식·우측 다운로드 버튼의 가로 카드 | 기존 게시 카드의 표시와 클릭 진입 개선 |
| panel HTML·screenshot 2 | 좁은 패널의 접을 수 있는 구역, 간결한 출력 행과 컨텍스트 칩 | 기존 진행/출력/컨텍스트와 실제 폴더 유지 |
| viewer HTML·screenshot 1 | 상단 미리보기/코드 전환, 제목·형식, 복사·다운로드·확대·닫기, 줄번호 | 같은 우측 패널의 파일 상세 표면 |

예정·컴퓨터 사용·커넥터·스킬은 참고 화면에 있지만 현재 Orca 우측 패널에 대응하는 live 데이터 계약이 없다. 빈 모형 구역을 추가하지 않으며 기존 실제 상태가 있는 세 구역을 유지한다.

## JSONL 프로토콜

| 관측 | 의미 |
|---|---|
| 전체 387행: assistant 142, user 122, attachment 59, 기타 64 | 시스템 메타를 사용자 대화로 렌더하지 않는다. |
| assistant message.id 37개, 각 행 단일 block | 행 단위 메시지 생성 금지; message.id와 apiBlockIndex를 함께 고려한다. |
| assistant thinking 20, text 4, tool_use 118 | 도구 호출이 중심인 감사 세션이다. |
| tool_result 117, 마지막 Bash 미응답 | tool_use.id와 tool_result.tool_use_id로 결합하며 결과가 없다고 성공으로 추정하지 않는다. |
| 도구 이름 86종, 명시적 is_error 11 | 미지 도구를 처리하는 범용 요청/응답 표현이 필요하다. |
| WebSearch results[].content[]에 title/url 8개 | 구조화 검색 결과 또는 wire의 Links 배열을 이용할 수 있다. |
| Artifact 호출 11개 | publish/list/read/watch/DB/comments 등의 의미가 달라 모두 문서 카드로 바꾸면 안 된다. |
| frame-link 9개 중 실제 title/path/frameUrl 보유 1개 | 상태 알림으로 문서 카드를 중복 생성하지 않는다. |

Orca는 이미 정규화된 toolRunId와 응답 경계를 보유한다. 이 작업은 기존 모델을 표시 계층에서 활용하며 첨부 Cowork JSONL을 직접 가져오는 제품 기능을 새로 추가하지 않는다.

## 형상별 주의

| 형상 | 구분 |
|---|---|
| TaskCreate/Get/Update/List | 체크리스트 데이터이며 Agent/Task 서브에이전트 실행과 다르다. |
| AskUserQuestion/ExitPlanMode | 기존 질문·계획 승인 경로를 유지하고 과거 응답을 다시 승인 요청으로 실행하지 않는다. |
| 결과 오류 | 명시적 is_error가 기본이다. 도구 계약이 확인된 구조화 오류만 보강하며 문자열 error 검색으로 실패를 추정하지 않는다. |
| MCP content | 샘플에는 text와 tool_reference가 있고 serverInfo.icons의 base64는 본문 이미지가 아니다. |
| 아티팩트 본문 | read HTTP 200이어도 result가 빈 사례가 있다. 다운로드/미리보기용 실제 소유 파일을 별도 읽어야 한다. |
| 파일 형식 | 사용자가 Markdown·HTML·텍스트/코드·이미지로 확정했다. 명시 게시 포맷을 확장하고 일반 생성물 자동 수집은 별도 Q-04로 남긴다. |

구현 계약과 검증 경로는 [plan.md](plan.md)가 정본이다.
