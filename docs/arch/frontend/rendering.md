# Frontend Architecture — Rendering (렌더링·ToolRendererRegistry·streaming)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [../backend/provider-runtime.md](../backend/provider-runtime.md), [ux-domains.md](./ux-domains.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 컴포넌트 렌더링 전략

### 하네스별 transcript

공통 `AssistantMessage`는 파트 순서와 identity를 보존하고 하네스별 `AssistantSegment`로 전달한다. Claude의 본문·reasoning·도구 카드·도구 본문 레지스트리는 `features/chat/harnesses/claude/transcript/`에 있다. OpenCode의 본문·reasoning·오류·구조화 결과·도구 카드는 `harnesses/opencode/transcript/`가 소유하며 Claude 카드 본문을 재사용하지 않는다. 입력 버블·대기 버블·메타 스타일도 각 transcript의 `appearance.ts`에서 선택한다. 질문·경계 표시·첨부·복사·diff 표·Markdown 파싱은 공통 기능이다.

OpenCode는 연속한 read/search/list만 탐색 그룹으로 묶고 셸·편집 전후의 순서를 유지한다. 파일 편집/쓰기는 파일명과 변경량을 한 줄로 표시하고 사용자가 펼친다. 탐색은 종류별 개수와 들여쓴 도구 목록을, 성공 웹 가져오기는 직접 링크를 표시한다. 완료 질문은 접을 수 있는 질문·답변으로 표시한다. 셸 출력은 명령과 결과를 복사할 수 있는 스크롤 패널, 파일 변경은 파일별 diff, 작업 행을 누르면 우측 하위 에이전트 상세를 연다. 실패·중단·거부·취소·미실행은 성공 완료와 구분한다. reasoning은 원본 이력에 보존하되 기본 transcript에서 숨기며, 라이브와 확정 텍스트는 Claude와 같은 공통 문단·코드·heading 활자와 OpenCode 색을 쓴다. transcript 배경은 두 하네스 모두 `bg-bg`다.

OpenCode native metadata는 `harnesses/opencode/v1/toolPresentation.ts`에서 중립 view로 해석하고 `toolPresentation.ts`가 현재 버전을 선택한다. 화면 컴포넌트는 이 진입점을 사용하며 버전 구현을 직접 import할 수 없다. 엔진의 native 설정 편집도 해당 feature의 `harnesses/opencode/v1/`에 둔다. 새 버전은 버전별 해석만 추가하고 정규화된 UI·store·파트 순서는 재사용할 수 있다.

### 백그라운드 작업 패널

`CanonicalBackgroundContent`는 도구 종류와 무관하게 백그라운드 증거가 있는 호출·작업을 Agent 형태의 카드로 표시하며 ambient 작업은 제외한다. Spark가 사용하는 shared `countedBackgroundTaskIds`와 과거 백그라운드 관측을 표시 근거로 읽고 끝난 백그라운드 작업은 완료 그룹에 남는다. live 현재성이 확립된 정상 상태에서 실행 중 작업 집합은 Spark 집합과 같다. 종료 통지 없이 live에서 빠진 현재 작업과 이전 연결의 미종료 작업은 원격 여부와 무관하게 완료 그룹의 `종료 확인 불가`로 표시한다. live 포함 전의 실행 영수증, 첫 live 전의 시작·재연결, live 갱신 전의 종료 통지는 일시 차이를 만들 수 있다. 포그라운드 Agent·셸과 백그라운드가 아닌 실패 호출은 목록에서 제외한다. 카드에 제목·종류·상태·경과 시간과 개별 중단을 표시하며 Explorer는 실제 child 모델을 표시한다. 관측하지 못한 모델은 추정하지 않는다. 선택 좌표는 세션과 generation/taskId이며 기존 toolUseId 선택과 분리한다.

목록은 왼쪽 접기 버튼이 있는 실행 중/완료 그룹으로 나뉜다. 성공·실패·중단·거부·취소·미실행과 종료 확인 불가 작업이 완료 그룹에 들어간다. 종료 확인 불가 카드는 마지막 관측 시각에서 경과를 멈추고 중단 버튼을 숨긴다. 이후 실제 종료 통지가 오면 같은 그룹에서 결과를 갱신하며 원본 상태에는 표시상 종료를 합성하지 않는다. 포그라운드 Agent는 인라인 행의 '열기'로 대화록 상세를 볼 수 있으며 목록으로 돌아가면 카드가 없다. 오른쪽 휴지통은 클릭 시점에 표시상 정착한 카드만 지운다. 제거한 표시 상태는 세션 왕복과 패널 재열기 동안 유지하고 앱 재시작 시 복원되는 원본 이력은 삭제하지 않는다. 클릭 뒤 새로 완료된 작업은 남긴다.

도구 결과의 `nonExecution`은 shared 분류와 renderer의 `toolRunOutcome`을 통해 표시한다. 거부·취소·미실행은 중단과 같은 중립 톤이며 실제 실패만 오류 톤이다. 라이브·재로드·Work·Code가 같은 사유를 사용하고 `reconcileSegments`는 본문이 같아도 사유 값이 바뀌면 결과 view를 교체한다. 정본 반환이 없는 패널 호출은 transcript 결과를 조인하며 목록·상세·완료 지우기·dismiss 가드에 같은 입력을 전달한다.

카드를 열면 상단 제목·뒤로가기 아래에 상세를 표시한다. Explorer/Agent는 부모 Agent 카드와 대화록 외곽 테두리 없이 대화록만 표시하고, 셸 등 다른 작업은 도구 본문을 표시한다. 다른 인라인 대화록 사용처는 기본 프레임을 유지한다. 호출 제목 행, 새로고침·일괄 중단·결과 대기 버튼은 표시하지 않는다.

카드에는 실행 결과 본문을 붙이지 않으며, 비Explorer 상세는 ToolCard 본문만 표시한다. 별도 요약·출력 파일 참조·읽기 제어는 표시하지 않는다. 출력 참조와 완료 snapshot은 내부 상태에 보존하며 중첩 대화록은 부모 도구 ID로 연결한다. 이전 이력은 기존 parts 기반 표시를 사용할 수 있다. 상태 계약은 [백그라운드 작업](../backend/background-tasks.md)을 따른다.

Code foreground Bash/PowerShell 호출 본문 하단 우측에는 제품 파랑의 백그라운드 전환 버튼이 있다. 같은 실행의 공개 task 등록을 확인한 뒤 활성화하며, 단건 SDK 전환이 성공하면 해당 세션 패널을 연다. 완료·이미 background·Work·패널 상세에서는 표시하지 않는다. 세대나 세션이 바뀐 뒤 도착한 응답은 다른 대화의 패널을 열지 않는다.

Spark 상태 줄은 상태·대기 사실·경과 시간을 표시한다. 백그라운드 작업 수는 selected 계열 파랑이며 hover/focus 때 버튼 배경을 표시하고, 클릭하면 Code의 백그라운드 패널 또는 Work의 작업 패널을 연다. 다른 대기 사실이 많아도 이 진입점은 합계 안에 숨기지 않는다.

좌측 최근 대화는 다른 탐색 그룹과 같은 접기 버튼을 사용한다. 임시·저장 대화 모두 그룹 하위에 배치하고, 최근 행에는 표시용 프로젝트 prefix를 붙이지 않는다. 실제 제목에 포함된 `/`는 그대로 표시하며 새 항목이나 화면 전환이 사용자의 접힘을 풀지 않는다.

### Work/Code 표현

Work의 예정 영역은 공급자 Stop 훅과 성공 영수증으로 마지막 확인한 세션 예약을 표시한다. 프롬프트·cron 식·반복 여부를 사용하며 실제로 제공되지 않는 다음 실행 시각을 만들지 않는다. 목록은 `chat.activity.sessionSchedules`의 세션 수명 스냅샷으로 재로드하고, 앱 재시작 시 과거 예약을 활성 상태로 복구하지 않는다. `pendingSessionWakeup`은 전체 목록 도착 전의 확인된 대기이며 ID·개수·시각 없이 예약 정보를 기다리는 상태로 표시한다. `ScheduleWakeup`은 반복 작업 대기·중단으로 표시하고 일반 cron 생성과 구분한다.

자동 수신 프롬프트의 원문·출처·format은 text 파트에 영속한다. Claude Work/Code와 OpenCode는 공통 투영으로 해당 text만 기본 숨김 처리하며, 혼합 메시지의 사용자 본문·첨부와 원본 배열·메시지 index는 보존한다. 사용자 직접 태그 입력이나 assistant·tool 결과는 이 규칙으로 숨기지 않는다. 개별 버블 복사는 표시된 부분을, 전체 대화 복사는 원본 이력을 사용한다.

DEV DebugPanel의 별도 `자동 피드 표시` 버튼은 `system-reminder`를 포함한 모든 자동 입력을 기존 사용자 버블로 표시한다. format이 없는 과거 자동 입력도 같은 방식으로 표시한다. 토글은 기본 꺼짐인 앱 메모리 상태로 세션 이동 동안 유지하며 재시작 시 초기화한다. app의 OverlayLayer가 chat의 제어 섹션을 debug 슬롯에 주입하고 production에서는 제어와 활성화 경로를 차단한다. 표시 변경은 모델 요청이나 원본 이력 변경을 일으키지 않는다.

제품 종류별 표시 값은 chat의 순수 agentPresentation 정의가 소유한다. Composer·트랜스크립트는 선택한 정책을 사용하고, 하위 도구 카드는 상세 표시 속성을 전달받는다. 우측 패널의 허용 타일·진입/배지 대상·배치는 rightPanelTiles의 명시적 정의에서 선택한다. app/page는 세션 목록에 아이콘·라벨 해석기를 주입하며 sessions는 chat을 직접 import하지 않는다.

새 대화와 프로젝트 랜딩의 `AgentModeToggle`은 양끝 꺾쇠 안에 왼쪽 Todo(작업), 슬래시, 오른쪽 Terminal(코드)을 표시한다. 회색 컨테이너 배경 없이 확대된 꺾쇠·슬래시·아이콘과 보통 두께의 큰 Hero를 사용한다. 꺾쇠와 슬래시는 같은 폰트·크기·굵기의 문자다. 모드 tooltip은 없으며 접근성 이름과 선택 상태는 Button에 제공한다. 활성 아이콘과 배경은 기존 selected 계열 파랑이며 Button·Icon·시맨틱 토큰을 사용한다. 토글 아래에 Work는 “어떤 작업을 시작할까요?”, Code는 “개발, 디버깅을 시작하세요.”를 표시한다. `agentPresentation`이 인사말과 Composer 안내 문구를 제공하며 토글로 Composer 인스턴스를 교체하지 않는다. 프로젝트 랜딩은 제목과 메뉴, 해당 경로의 Composer, 대화 목록 순서로 배치한다. 대화 행은 아티팩트 목록과 공통 `CatalogListRow`를 사용하되 제목 아래 메타를 표시하지 않는다. 지침은 상단 메뉴의 편집 대화상자에서 저장한다.

Work Composer는 GitRow를 mount하지 않아 Git 스택과 그 조회를 실행하지 않는다. 랜딩 CwdPanel의 BranchChip은 두 모드에서 유지하고 조회는 Code에서 시작한다. 조회 중 브랜치는 비활성 `-`로 표시하며 Work에서는 그룹만 숨긴다. Work 전환 중 도착한 결과와 같은 cwd의 snapshot을 유지해 Code 복귀 때 즉시 표시하고, 폴더 추가 버튼은 빈자리 없이 당겨진다. 보유 Git 선택과 폴더·첨부·입력은 유지한다. Work 권한 메뉴는 수동 승인·자동 승인·모든 승인 건너뛰기 순이고 칩도 메뉴와 동일한 수동 승인·자동 승인·모든 승인 건너뛰기 라벨을 사용한다. Code 메뉴는 기존 구성을 사용한다. 자동 승인 메뉴는 선택 카탈로그에서 확인된 비커스텀 Claude 4.6 이상에만 제공한다. claude/claudecode 접두사, Haiku·Sonnet·Opus·Fable 계열과 점/하이픈 버전 표기 및 `[1m]` 접미사를 공용 판정으로 인식하며, 미확정 카탈로그·버전 불명·커스텀 모델은 제외한다. 위험 모드의 기존 확인 절차는 유지한다.

ChatTile은 표시 정책에서 transcript의 세션별 재마운트 여부를 선택한다. TranscriptView가 같은 정의에서 선택한 정적 `transcriptPolicy`는 Exchange→AssistantTurn으로 전달되고 memo 비교에도 포함된다. 공통 본문과 도구 카드는 종류를 다시 해석하지 않고 투영·상세 표시 정책을 사용한다. Code는 기존 AssistantMessage를 사용한다. Work는 `createWorkProjector`로 원문 parts를 보존한 채 같은 응답의 도구와 그 사이 텍스트를 접을 수 있는 그룹으로 조립한다. 중간 텍스트는 노트로 세어 도구 수와 함께 헤더에 표시하고, 펼치면 도구와 같은 세로 타임라인에서 원래 순서대로 읽는다. 도입·마지막 본문은 그룹 밖에 항상 표시한다. reasoning·질문·오류·구조화 결과 등 전용 구간은 그룹을 나누며 기존 표현을 유지하고 ArtifactCards도 공통 경로를 사용한다. 표시 경계가 없는 이력은 기존 메시지 구조에 Work 도구 표시 정책을 전달한다.

Work 활동은 무테 요약에 실제 도구 호출 수를 표시한다. 펼치면 `WorkToolTimeline`이 순서대로 아이콘·세로선·접을 수 있는 행을 배치하고 `WorkToolBody`는 요청·응답·오류를 하나의 높이 제한 카드 안에 표시한다. 긴 본문은 내부 스크롤, JSON은 구문 강조, 실제 검색 결과는 제목·도메인·개수로 읽으며 원문 응답도 펼쳐 볼 수 있다. 같은 도구의 반복 호출을 합쳐 세지 않으며 미지 도구도 안전한 텍스트 상세를 제공한다.

Main의 `response_boundary` 구간을 보존하며 도구 사이 본문은 그룹 안의 노트, 마지막 본문은 그룹 밖의 답변으로 표시한다. 중단·실패·불명확한 끝은 그 상태를 표시한다. 후속 자동 응답은 별도 구간이며 늦은 도구 결과는 ID로 원래 호출에 결합해 이미 정한 마무리의 위치를 바꾸지 않는다. 완료 메시지의 part 해석을 캐시하고 접힌 활동의 본문은 mount하지 않는다.

Code는 계획 패널 상단에 ExitPlanMode 본문, 하단에 Work와 같은 작업 목록을 표시한다. 작업 클릭은 계획 패널 전체의 상세로 전환하며 Back은 문서와 목록으로 복귀한다. 계획 또는 작업만 있으면 해당 영역만, 모두 없으면 단일 빈 상태를 표시한다. 승인 본문 해소 실패는 별도 오류로 남긴다. 공통 작업 배지는 진행 중 회전을 표시하고 reduced-motion을 존중한다. 계획 패널의 높이 정책과 복사·확대·닫기는 유지한다. 독립 작업 타일은 표시하지 않는다.

Work는 랜딩에 패널을 표시하지 않는다. 첫 전송이나 처음 불러온 대화에서 작업 타일을 열고, 이후 케밥에서 켜거나 끈 선택은 세션 캐시 안에서 유지한다. 케밥의 타일 항목은 작업만 제공하며 타일 우상단에서 현재 대화 영역 전체로 확대하고 복원할 수 있다. 작업이 있으면 번호·상태·말줄임 제목이 있는 세로 목록을, 없으면 빈 상태 그림을 표시한다. 작업 클릭은 같은 타일 전체를 상세 화면으로 바꾸며 뒤로가기로 복귀한다. `TaskPanelContent`는 양 모드의 숨긴 overview를 mounted 상태로 유지하되 키보드 접근을 막아 구역 접힘·출력 더보기·폴더 선택 수명을 보존한다. 복귀 시 이전 문서·구역별 스크롤과 작업 행 초점을 복원하며 선택한 작업이 삭제되면 목록으로 돌아간다. 목록이 보일 때만 완료 알림을 읽음 처리한다. 질문 버튼은 상세 전환과 별개로 기존 입력 뒤에 작업 인용을 추가하고 포커스한다. 진행 상황·출력·컨텍스트는 개별적으로 접을 수 있다. 세션 이동 시 본문 로컬 상태는 초기화하지만 선택 작업은 기존 세션 캐시에 남고 DB에서 새로 로드할 때 초기화한다.

Work 카드 외곽은 내용 높이로 표시한다. 진행 상황·출력·컨텍스트 각각은 부모가 허용하는 패널 높이의 1/3까지만 늘어나며 남는 높이를 나눠 갖지 않는다. 초과한 본문은 영역 내부에서 스크롤하고 작업 상세에는 이 분할 상한을 적용하지 않는다.

출력 목록은 행 사이와 행의 세로 여백을 작게 배치한다. 일반 출력 파일과 명시적으로 게시한 아티팩트를 함께 표시하며 기존 저장·부재·삭제 동작을 재사용한다. 일반 파일은 확장자를 표시하고 미리보기 미지원 형식도 다운로드할 수 있다. 컨텍스트에는 세션의 실제 작업 경로와 add-dir, 성공한 파일 읽기·WebFetch·WebSearch 소스를 중복 없이 표시한다. 파일과 폴더를 열 때 Main이 해당 Work 세션의 허용 경로를 확인하고, 웹 링크는 안전한 HTTP(S) 주소만 외부 브라우저로 연다. 실패 시 항목과 오류를 남겨 재시도할 수 있다. 유휴 Work 대화는 폴더 추가를 DB에 저장하고 다음 요청부터 적용하며, 실행·준비 중에는 Main에서도 거부한다([IPC 계약](../../IPC_CONTRACT.md)). 출력의 처리 중·컨텍스트의 폴더 선택 중 문구는 표시하지 않으며 진행 중 액션의 중복 실행은 막는다. Work의 계획 승인과 서브에이전트 상세는 해당 대화 영역 안에서 확인한다.

Work 메시지 버블은 응답 경계의 ended/unknown 안내를 표시하지 않으며 원래 응답 경계 데이터는 보존한다. 예정 목록이 비어 있을 때만 확인된 반복 대기 상태를 표시한다.

Work·Code Transcript의 일반 출력과 게시 아티팩트 카드는 원래 턴의 본문 뒤에 모으고 spark/status는 카드보다 아래인 응답의 마지막에 표시한다. 순서는 사용자 메시지 → 확정/live 어시스턴트 본문 → 일반/게시 카드 → 완료 메타 또는 진행 spark/status다. 같은 턴의 일반 출력은 파일명마다 최신 `publishedAt` 버전 한 장을 처음 나타난 자리에 표시하며 게시 아티팩트와 다른 턴의 카드는 합치지 않는다. idle/background ready에서는 진행 spark를 숨긴다. 카드의 부모와 위치를 유지하여 응답 완료 때 카드 액션이 다시 mount되지 않게 한다. 일반 출력은 `output.captured`의 도구 ID 또는 Main이 확인한 응답 경계로 연결하며 영속 artifact part로 재로드한다. 소유권 근거가 없는 과거 일반 출력은 우측 출력 목록에 유지하고 메시지 소유자를 시각으로 추측하지 않는다. 두 표면은 `ArtifactCard`를 사용하며 게시 카드의 부제는 아티팩트만 표시한다. 메뉴의 보관 폴더 열기·상단 파일 메타와 작업 성공 안내는 표시하지 않고 부분 실패·접근 오류·재시도는 유지한다.

Composer에서 전송한 첨부 파일과 이미지는 컨텍스트에 원래 이름으로 표시한다. 클립보드 이미지도 같은 목록에 포함하며, 세션에 기록된 OS 임시 폴더 사본을 탐색기에서 선택해 보여준다. 같은 파일을 Read로 참조한 경우 중복을 제거하고 서로 다른 동명 첨부는 유지한다. 경로가 없는 과거 첨부도 이름을 보존하되 열기 버튼은 비활성화한다. Windows `AppData/Local/Temp/orcinus-orca/claude`와 하위의 내부 파일은 Read·첨부 출처에서 제외한다. 경로의 대소문자·구분자·점 세그먼트는 정규화하며 일반 Temp 첨부와 형제 디렉터리는 유지한다. 이 표시 규칙은 cwd/추가 경로·접근 권한·원본 대화에 영향을 주지 않는다.

좌측 상단의 아티팩트 메뉴는 `/artifacts` 화면을 연다. 타이틀 옆에는 검색·고정 탭과 무관한 전체 아티팩트 개수를 작게 표시한다. 전체·고정됨 탭은 왼쪽, 검색 버튼은 오른쪽에 배치하고 항목은 썸네일 없이 세로 목록으로 표시한다. 행 오른쪽 메뉴에서 고정/고정 해제와 삭제를 제공한다. 고정은 DB에 보존하며 삭제는 보관 사본의 OS 휴지통 이동을 사용한다. 일반 출력 파일은 이 목록에 포함하지 않는다. 항목을 열면 같은 화면 우측에 공통 파일 뷰어를 표시하며 app 계층이 목록 feature와 chat 뷰어를 합성한다.

채팅 행은 오른쪽 종류 텍스트 대신 왼쪽 Material Terminal 2 또는 Checklist 아이콘을 표시한다. 현재 열리지 않은 세션의 정상 완료와 응답 대기(도구 승인·질문·계획 승인)를 같은 굵은 파란 아이콘으로 표시하며, 실제 세션을 열면 원래 색과 굵기로 돌아간다. 표시 수명은 [상태 관리](state.md)에 따른다.

### 1.1 메시지 리스트 가상화

- **현재: 사용.** `features/chat/hooks/useTranscriptVirtualizer.ts` 가 `@tanstack/react-virtual` 로 transcript 를 가상화한다(0102). 스크롤 컨테이너는 `.app-frame-transcript[data-behavior="virtualizable"]`(dom-architecture.md §1.2).
- 교환(Exchange) 단위 wrapper 와 50% 미드라인 예약(§1.8)은 가상화 위에서 유지된다. 사용자 버블 접기 상태는 키별 메모리로 재마운트에도 보존된다(ux-domains.md §1.3-b).

### 1.2 스트리밍 렌더링 최적화 (0008 재설계)

- **델타 경로는 reducer 를 우회한다.** `features/chat/lib/eventCoalescer.ts` 가 델타(message.delta·message.reasoning.delta)를 rAF 한 틱마다 `DeltaEvent[]` 하나로 넘긴다(비-델타는 버퍼 선-flush 로 순서 보존, §1.7 Option B). `chatStore.receiveDeltaBatch` 는 배열을 event 순서대로 session별 `live`(`{text, reasoning}`)에 연결하고 **flush당 단일 Zustand `setState` transaction**으로 반영한다. `BEGIN_TURN`이 필요한 첫 활동 외에는 커밋 슬라이스(`session`) identity도 불변이다. 결과: selector 팬아웃·store notification은 프레임당 1회이고, 실제 재렌더는 live 구독 리프뿐이다 — text 델타 → `PendingAssistant` 의 `LiveText`(+ `StatusLine` 출력 토큰 근사), reasoning 델타 → `LiveReasoning`(`ReasoningBlock streaming` → `StreamingMarkdown` 경유 — 델타 프레임당 전문 재파스 없이 꼬리만 재파스, 0093). transcript(커밋 메시지)·Composer shell·호스트는 깨어나지 않는다(state.md §1.2).
- **라이브 마크다운은 꼬리 블록만 재파스** — `StreamingMarkdown` 이 누적 소스를 `lib/markdownBlocks.ts` 의 `splitStableBlocks` 로 "확정 블록들 + 꼬리"로 분할, 확정 블록은 memo 된 `<Markdown>`(string shallow)으로 고정하고 꼬리만 매 델타 unified 재파스한다(프레임당 O(전문)→O(꼬리)). 분할 경계는 보수적(펜스/loose list/들여쓰기 코드 비분할, 완결 줄 뒤만 확정 = append-stable). 코드 블록 하이라이팅(shiki)은 ToolCard 첫 오픈까지 지연(비용 회피).
- **커밋 경로는 카드 단위로 격리** — `message.completed`(완성본 text 파트 커밋)·`tool.call.*` 는 reducer 커밋으로 마지막 message identity 만 교체하고, `AssistantMessage` 가 `reconcileSegments`(lib/parts.ts) 로 직전 렌더와 대조해 내용 미변경 세그먼트/ToolCall view 의 identity 를 재사용한다 → memo 된 `ToolGroup`/`ToolCard`/`ReasoningBlock`/`Markdown` 이 shallow 로 bail — **tool.call.completed 1건 = 결과가 도착한 ToolCard 1개 재렌더**. `message.completed` 없이 끝난 턴의 잔여 live.text 는 telemetry 시점에 `COMMIT_PENDING_TEXT` 폴백으로 굳힌다(error/cancel 은 폐기 — 기존 동작 동형).

### 1.2.1 Composer 입력 긴급도 분리 (0145)

- `Composer`는 chat selector·상태 카드·저빈도 메뉴만 조율한다. `ComposerInputController`는 plan review 중에도 항상 mount된 채 `DraftSnapshot(revision/text/selection/composing)`과 attachments를 소유하므로, 키 입력은 shell을 재실행하지 않는다.
- `ComposerInputSurface`의 **controlled native textarea가 실제 글자·placeholder·caret을 직접 그린다.** 종전 transparent textarea + visible mirror 계약은 폐기했다. CSS `field-sizing: content`가 높이를 결정하고, decoration은 레이아웃 권위가 없는 `aria-hidden`/`pointer-events-none` 배경 overlay다.
- 전체 draft tokenization, skill filter, 파일 listing은 `useDeferredValue(snapshot)` 파생 채널에서 수행한다. autocomplete는 deferred revision·text·selection이 현재 snapshot과 다르거나 IME 조합 중이면 숨긴다. background-only decoration은 revision·IME 조합 중에도 마지막 완료 결과를 유지해 사라짐 없이 최신 결과로 교체한다. 자동완성 적용과 비동기 submit clear도 expected revision을 재검증해 최신 입력을 덮어쓰지 않는다.

### 1.3 마크다운 + 코드 블록

| 항목 | 구현 |
|---|---|
| Markdown 렌더러 | `shared/ui/markdown/Markdown.tsx` — react-markdown + remarkGfm. h1~h4, p, a, ul/ol, blockquote, table, code 각각 커스터마이즈. (`features/chat/components/markdown/` 에는 `StreamingMarkdown` 만 잔류) |
| 이미지 정책 | **data-uri 만 허용** (보안). 외부 URL 차단. |
| 링크 정책 | 외부 링크 클릭은 `shell.openExternal` 경유 (Main 측에서 처리). target=_blank rel=noopener noreferrer 표시. |
| 코드 블록 | `shared/ui/markdown/CodeBlock.tsx` — shiki 싱글톤 비동기 로드. 지원 언어 11종 (typescript / tsx / javascript / jsx / python / bash / json / yaml / html / css / markdown). shiki 테마 3종 (github-light / github-dark / one-light — 앱 테마 2종(white/dark)과 별개). |
| 테마 추적 | `document.documentElement.dataset.theme` 의 MutationObserver. data-theme 변경 시 코드 블록 자동 재렌더링. |
| 로딩 fallback | shiki 로드 전엔 plain `<pre>` 표시. 로드 완료 후 HTML replace. |
| 복사 버튼 | named group (`group/codeblock` + `group-hover/codeblock:opacity-100`) 으로 hover 범위 자기 자신으로 한정. (`app/AGENTS.md` 의 named group 규칙 참조.) |

### 1.4 마크다운 보안

- HTML 렌더링: react-markdown 의 기본값 (raw HTML 비활성) 유지.
- 이미지: data-uri 만 허용 (위 §1.3).
- 외부 URL 자동 차단: `will-navigate` (Main) + `setWindowOpenHandler` (Main).

### 1.5 Custom Titlebar / 윈도우 컨트롤 (Phase 3+)

- BrowserWindow: `frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition: { x: 12, y: 10 }` (`app/src/main/index.ts`).
- `data-platform` 부착: App boot effect 에서 `documentElement.dataset.platform = window.orca.platform` 1회 (preload 가 sync 노출).
- IPC: `window.orca.window.{minimize,maximize,close}()` 3개 (IPC_CONTRACT §2.8).
- macOS 분기: `WinControls` 가 `window.orca.platform === 'darwin'` 일 때 `null` 반환 — OS traffic light 가 그린다. 헤더 좌측 패딩 80px 로 traffic light 영역 회피.
- drag 영역: `[-webkit-app-region:drag]` inline 클래스 대신 `style={{ WebkitAppRegion: 'drag' }}` (dom-architecture.md.3 의 2-layer 패턴).
- **header-left 내용물 (Phase 3++)**: 액션 5-버튼 툴바 — `menu` (시스템 메뉴 popover · 자식 `종료` → `windowApi.close()`) · `panelL` (사이드바 접기 토글 · `setTweak('sidebarCollapsed', !current)`) · `search` (대화 검색 모달 열기 — `SearchModal`) · `arrowL` / `arrowR` (`navigate(-1)` / `navigate(1)` 항상 enabled, 추적 없음). 모든 버튼은 `data-behavior="no-drag"` 영역 안. 기존 brand + breadcrumb 표시는 제거 (브랜드는 Sidebar 의 `app-frame-sidebar-brand` 로 이동).

### 1.6 ToolRendererRegistry

> **상태**: ✅ 구현. `features/chat/harnesses/claude/transcript/registry.ts` 가 `RenderableKind` taxonomy 와 `ToolRendererRegistry`(`match` → `Body`)를 갖고, 미지 도구는 `generic` 으로 떨어진다. 정본 타입(`NormalizedEvent`/`AppMessagePart`)은 [../backend/provider-runtime.md](../backend/provider-runtime.md) 가 소유 — 본 절은 *렌더링 계약*만 정의(참조).

**① 설명.** 렌더러는 **이벤트 타입이 아니라 의미(semantic kind)** 로 카드를 선택한다. 같은 `tool.call.completed` 라도 결과 형태에 따라 다른 카드로 분기한다. 예: ../backend/provider-runtime.md §7 의 `file` part 가 `readType:'raw'` 면 `FilePreviewCard`, `'patch'` 면 `DiffCard`.

**② 예시.** OpenCode `file.read` → `{ type:'raw'|'patch', content }` `[검증]`. `selectFileRenderer(read) = read.type==='patch' ? 'diff' : 'file_preview'`. `find.text/files/symbols` 는 agent tool result 일 수도, app-originated direct search(../backend/provider-runtime.md §17 DirectBackendAPI)일 수도 있어 둘 다 `SearchCard` 로 가되 `origin` 배지를 표시.

**③ 현재 코드.** ✅ **표준화 완료** — `features/chat/harnesses/claude/transcript/registry.ts` 의 `RenderableKind` 가 정본 taxonomy(`terminal·file_preview·diff·search·approval·agent_task·task_list·session_graph·context_injection·structured_output·error·telemetry`) + 실용 fallback `generic` + AskUserQuestion 컴팩트 본문용 `ask`(비정본)로 정렬됐다. `match`/`resolve` 는 도구 이름이 아니라 **`ToolCall`(= tool_call+tool_result 파트 페어의 렌더 view)** 를 받아 result shape 까지 검사 가능(§1.6 "의미로 분류"). 본 레지스트리는 *도구 본문* 만 다루므로 `terminal`(Bash/PowerShell)·`file_preview`(Read)·`diff`(Write/Edit/MultiEdit)·`agent_task`(Task/Agent)·`task_list`(TaskCreate/TaskGet/TaskUpdate/TaskList — 0212)·`ask`·`generic` 만 등록한다. `search`·`agent_task`·`session_graph`·`context_injection`·`approval`(별도 `ApprovalCard`)·`telemetry`(§1.9)는 OpenCode/별도 표면 전용이라 미등록 seam. 매칭은 순수 함수라 단위 테스트 대상.

**③′ 콘텐츠 순서 보존 렌더 (AssistantMessage).** `AssistantMessage` 는 더 이상 파트를 타입별로 뭉쳐(reasoning→도구그룹→텍스트…) 고정 순서로 렌더하지 않는다. `lib/parts.ts` 의 `messageSegments(parts)` 가 parts 를 **만나는 순서대로** "연속 동종" 으로 묶은 `MessageSegment[]`(`reasoning`/`tools`/`ask`/`text`/`structured`/`error`)로 투영하고, `AssistantMessage` 는 그 배열을 순서대로 기존 컴포넌트(`ReasoningBlock`/`ToolGroup`/`AskExchange`/`Markdown`/`StructuredOutputCard`/`ErrorCard`)에 1:1 매핑한다 → 모델이 말한 "텍스트 → 도구 → 텍스트" 흐름이 화면에 그대로 보인다. 단일 도구는 `ToolGroup` 이 헤더 없이 `ToolCard` 만, 연속 병렬 도구만 그룹으로 묶는다. **sub-agent(Task/Agent)는 별도 처리 없이 `tools` 세그먼트의 일반 도구 카드로 순서 안에 끼어 렌더된다(자동 충족).** 영속된 `error`/`structured_output` 파트가 로드 세션에서 안 보이던 갭도 이 디스패치로 메웠다. 이 순서 보존의 백엔드 짝은 `claude-map` 이 assistant content 블록을 **순서 그대로 emit**(텍스트 말미 합치기 폐기, provider-runtime.md §2)하는 것이다.

**④ 인터페이스 (렌더링 계약).**

```ts
type RenderableKind =
  | 'terminal' | 'file_preview' | 'diff' | 'search'
  | 'approval' | 'agent_task' | 'task_list' | 'session_graph'
  | 'context_injection' | 'structured_output' | 'error' | 'telemetry'

interface ToolRenderer<P = unknown> {
  kind: RenderableKind
  match(input: NormalizedEvent | AppMessagePart): boolean   // 정본 타입: ../backend/provider-runtime.md §2 / ../backend/provider-runtime.md §7
  toProps(input: NormalizedEvent | AppMessagePart): P
}
interface ToolRendererRegistry { register(r: ToolRenderer): void; resolve(input: NormalizedEvent | AppMessagePart): ToolRenderer | undefined }
```

| Renderer | 대상 | 현행 대응 |
|---|---|---|
| `TerminalCard`(`terminal`) | shell/command 실행 | ✅ `BashBody` |
| `FilePreviewCard`(`file_preview`) | `file.read` `raw`, Read | ✅ `FileBody` |
| `DiffCard`(`diff`) | `file.read` `patch`, edit/write | ✅ `DiffBody` — 줄의 정본은 결과의 구조화 패치(`Edit`)이고 없으면 도구 입력 쌍으로 폴백한다. 두 경로 모두 `DiffTable` 이 그리며 파일 경로가 있으면 변경사항 패널과 같은 shiki 토큰을 얹는다 |
| `SearchCard`(`search`) | `find.*`, grep/glob | 🔴 seam (OpenCode 전용 소스) |
| `ApprovalCard`(`approval`) | `permission.requested` | ✅ `ApprovalCard`(plan_review + tool_approval, 레지스트리 밖) — ux-domains.md §1.6 |
| `AgentTaskCard`(`agent_task`) | 서브에이전트 **실행**(Task/Agent 도구) | ✅ `AgentTaskBody` |
| `TaskToolBody`(`task_list`) | 세션 **할 일 목록** 도구 4종 (TaskCreate/TaskGet/TaskUpdate/TaskList) | ✅ `TaskToolBody`(0212) — `agent_task`(서브에이전트 **실행**)와 다른 의미다: 저것은 프로세스를 띄우고 이것은 목록을 바꾼다. 이름 배열의 소유자는 `shared/task-tool.ts` 의 4종 부분집합 하나다(D-025 — 6종 전량을 쓰면 구조화 출력이 없는 `TaskOutput`·`TaskStop` 이 빈 본문을 받는다) |
| `SessionGraphCard` / `ContextInjectionCard` | `children`·`fork`·`revert` / `noReply` | 🔴 seam (OpenCode 전용) |
| `StructuredOutputCard`(`structured_output`) | `format:json_schema` 결과 | ⏳ 최소 구현(`StructuredOutputCard` — value→pretty JSON. claude 미와이어라 소스 없음) — §1.7 |
| `ErrorCard`(`error`) | error 파트 | ✅ `ErrorCard`(트랜스크립트 인라인) + `state.error` 배너(라이브 턴) |
| `UsagePanel`(`telemetry`) | usage·한도 | ✅ `UsagePanel`(컨텍스트 프로그레스바 + 주간/월간 한도 바, 0079~0082) — Composer usage 도넛 트리거 Popover, §1.9 |

### 1.7 StructuredOutput · reasoning 렌더링 (부분 구현)

**① 설명.** OpenCode `session.prompt({ format: { type:'json_schema', schema, retryCount? } })` 와 실패 시 `result.data.info.error`(`StructuredOutputError`)를 UI 상태로 정규화 `[검증]`. Claude 측 형식은 `[미확인]`(../backend/provider-runtime.md §13) — 동일 상태로 흡수 가능한지 구현 전 확인.

**③ 현재 코드 갭.** structured_output 은 최소 구현(`StructuredOutputCard`, claude 소스 없음 — §1.6). Claude reasoning 은 **라이브 스트리밍 구현됨** — `message.reasoning.delta`(claude `thinking_delta`) → live 슬라이스 `live.reasoning` 누적 → `PendingAssistant` 의 `LiveReasoning` 이 펼친 `ReasoningBlock`(`streaming` prop → `StreamingMarkdown`, 0093) 프리뷰로 표시, 완성 시 `message.reasoning` 이 영속 reasoning 파트(접이식)로 대체. 런타임이 `thinking_delta` 를 안 흘리면 완성 블록만 표시(graceful).

**④ 인터페이스.**

```ts
type StructuredOutputState =
  | { status: 'valid'; value: unknown; schema: unknown }
  | { status: 'invalid'; error: unknown; raw?: string }
  | { status: 'retrying'; attempt: number; maxRetries: number }
```

`StructuredOutputCard` 는 `valid`=트리/접기 뷰, `invalid`=raw + 검증오류, `retrying`=진행 표시.

### 1.8 Streaming lifecycle & backpressure (정규화 미착수)

**① 설명.** OpenCode SSE 와 Claude async iterator 를 단일 lifecycle 로 정규화: `open → streaming → (reconnect)* → closed`. partial 재조립 / 중복 dedup(eventId) / 순서 보장(monotonic seq) / 긴 tool 출력 버퍼링·절단.

**③ 현재 코드 갭.** 현행은 §1.2 의 rAF 코얼레서 + `message.delta` 누적만. dedup/재연결/절단 정책 없음(`orca:chat:event` 가 ordered+lossless 1채널이라 claude 단일 백엔드에선 충분).

**④ 인터페이스.**

```ts
type StreamLifecycleState = 'open' | 'streaming' | 'reconnecting' | 'closed' | 'errored'
interface StreamBufferPolicy { maxBytesPerToolRun: number; truncateStrategy: 'head'|'middle'|'tail'; preserveLastLines: number }
interface ReconnectPolicy { maxRetries: number; backoffMs: (attempt: number) => number; resumeFrom?: 'last_seq' | 'restart' }
```

- (설계) `TerminalCard` stdout/stderr 를 위 `StreamBufferPolicy.maxBytesPerToolRun` 으로 캡 → 초과 시 `truncated` props 로 "잘림" 표시. **미구현** — 현재 코드에 버퍼 상한이 없다.
- SSE 재연결 시 마지막 `seq` 까지 dedup. Claude iterator 는 재연결 개념 없음 → `resumeFrom:'restart'` + 쿼리 재실행 정책 별도.
- auto-scroll pin **구현 완료** (`hooks/useScrollAnchor.ts`, 0008 이전): 스크롤 컨테이너가 맨 아래(`scrollHeight-scrollTop-clientHeight < 24px`)에 붙어 있을 때만 스트리밍을 따라 내려간다(로그 뷰어 패턴). 사용자가 위로 스크롤하면 `pinnedRef` 해제 → 과거 대화 고정. pin 해제 상태에선 컴포저 기준 상단·가로 중앙(`Composer.tsx` 의 `absolute bottom-full left-1/2`)에 **"맨 아래로" 버튼**(`chevD` 아이콘)을 띄워 클릭 시 재-pin. 버튼 props 는 optional — transcript 가 없는 랜딩(NewChat/Project)엔 미전달. 바닥 추적은 콘텐츠 wrapper(ReadingColumn) **ResizeObserver**(`pinned && inflight` 게이트)가 수행 — idle 중 성장(ToolCard 펼침·shiki 교체)엔 no-op 으로 네이티브 scroll anchoring 과 싸우지 않는다(컨테이너는 `[overflow-anchor:none]` 으로 자체 제어).
- **새 user 메시지 50% 미드라인 앵커 — CSS 예약공간 방식 (0008 재설계, 구 JS spacer 폐기)**: transcript 를 **교환(Exchange — user 턴 + 후속 assistant 턴들, `lib/turns.ts groupExchanges`)** 단위 wrapper 로 렌더하고, 스크롤 컨테이너를 `[container-type:size]` size container 로 둔 뒤 **라이브 전송으로 생긴 마지막 교환에만 `min-h-[50cqh]`** 를 준다. 스크롤 바닥 = 교환 top 이 정확히 미드라인(cqh 는 content-box 기준이라 py-5 패딩과 수학이 맞음). 전송 시 `useScrollAnchor` 가 `scrollTo({top: scrollHeight, behavior:'smooth'})` 1회 — min-height 가 같은 커밋의 레이아웃에 이미 반영돼 측정/2단 rAF 핵이 불필요하다.
  - **fill 단계 레이아웃 JS = 0**: 답변이 예약공간 내부를 채우는 동안 `scrollHeight` 불변 → 스크롤 이벤트/측정/보정 전무, 버블은 미드라인에 정지. 예약을 초과하면 scrollHeight 가 자라며 pin-follow(RO)가 이어받는다. Composer 성장/윈도 리사이즈는 cqh 가 CSS 로 자동 추종.
  - **회수 정책 = 다음 메시지까지 유지 (사용자 결정 2026-06-11)**: 턴 완료 후 짧은 답변의 잔여 여백은 회수하지 않는다(보이는 중 제거 = 콘텐츠가 여백만큼 내려오는 움직임이 기하학적으로 불가피). 다음 전송에서 이전 교환이 "마지막"에서 벗어나며 같은 레이아웃 flush 의 새 예약+앵커 스크롤에 가려 **무점프 해제**된다.
  - **앵커 트리거 = reducer `sendCount`**(SEND 마다 단조 증가): 메시지 배열 휴리스틱(로드된 세션의 마지막 user 메시지 오탐) 없이 라이브 전송만 정확히 감지. **세션 전환 판정 = sessionId 변화 ∧ messages 교체 동시** — `session.updated` 의 null→id 발급은 messages 를 안 건드리므로 턴 중 예약이 풀리지 않고, 로드/캐시 복원/NEW_CHAT 은 예약 해제 + 즉시 바닥 점프(옛 세션 하단에 여백이 남지 않음).
  - smooth 앵커 진행 중 "맨 아래로" 버튼 깜빡임은 프로그래매틱 플래그 + `scrollend` 로 억제. 교환 wrapper 는 재부모화가 없어(경계 영원 안정) ToolCard 열림·shiki 상태가 보존된다.

### 1.9 컨텍스트 사용량 도넛/패널 (구현 완료)

**① 설명.** Composer 풋터 usage 도넛 = **마지막 턴 컨텍스트 비율**. 클릭 시 `UsagePanel` 팝오버 — 컨텍스트 창 프로그레스바 + 주간/월간 사용량 한도(②).

**② 구현.** 도넛/패널은 **`state.lastTelemetry` 단일 소스로 구동**한다(`pendingInputTokens` 폐기). 컨텍스트 사용량은 명시적 `telemetry.contextTokens`(0 포함)를 우선하며 부재 시 `input + cacheRead + cacheCreation`(**출력 제외**, `features/chat/lib/telemetry.ts`) = **`/context` 상단 분자와 같은 정의**(전체 컨텍스트 점유). 도넛 비율 = `contextTokens / contextWindowOf(telemetry)`. 분모는 CLI 보고 `contextWindow` → `modelUsage[model].contextWindow` → 모델명 기본 정책(200k, `1m` 표기 시 1M) 순으로 해석한다(`features/chat/lib/contextWindow.ts`). 패널 컴포넌트는 **`UsagePanel.tsx`**: **컨텍스트 창 프로그레스바(`Meter`, `used / window (pct%)`) + 구분선 + 주간/월간 사용량 한도 바 + 우측 `>` 버튼(설정 사용량 탭 이동)**. 구 신규입력/캐시읽기/캐시생성 분해 행은 제거됐다(0079 AC4). 한도 바는 **Main 이 완성한 `UsageLimitsView`** 를 props 로 받아 표시만 한다 — 파생은 `computeUsageLimits`(`src/shared/usage/limits.ts`)가 main 에서 한 번 수행하고 renderer 는 `shared/stores/usageStore` 로 mirror 한다(renderer 재계산 0). 기준 provider 는 **마지막 telemetry 시점**의 것이라 모델 선택만 바꿔서는 숫자가 바뀌지 않는다. `state.lastTelemetry` 없으면 컨텍스트 섹션 미표시, 사용량 뷰 미도착이면 한도 섹션 숨김.

- **컨텍스트 입력의 원천**: 정상 보고 환경에서는 마지막 메인 assistant usage를 사용한다. 이번 턴 assistant 컨텍스트 합이 0이거나 부재하면 마지막 양수 메인 `message_delta.usage`를 폴백으로 사용하며, 둘 다 컨텍스트를 보고하지 않으면 도넛을 갱신하지 않는다. 필드 병합·턴 경계·압축·핸드오프 판정과 비용 보존의 정본은 [사용량 수집](../backend/provider-runtime.md#8-telemetryservice)이다.
- **측정값 부재와 명시적인 0을 구별한다.** 모델 미호출 로컬 슬래시(`/context` 등)의 빈 telemetry는 기존 도넛을 유지한다. OpenCode 마지막 스텝이 명시적 `contextTokens: 0`을 제공하면 라이브 reducer와 main 원장 모두 반영한다. OpenCode 분모는 엔진 모델 문서의 `limit.context`이며 유효한 값이 없으면 200k다. 저장된 분자·분모는 세션 재열기에도 유지된다.
- **compaction 임박 경고**: `nearCompaction(used, window)`(`contextWindow.ts`) = `used ≥ (window - AUTOCOMPACT_BUFFER) * 0.835`. `AUTOCOMPACT_BUFFER`(~33k)는 CLI 버전·`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 에 따라 가변인 *추정값*. true 면 도넛 progress arc 가 경고색(`--color-warn`, `UsageCircle.warn` prop), title 에 "컨텍스트 한계 임박", 패널에 "곧 컨텍스트 정리(compaction)" 경고 행(추정값 캡션 포함).

**③ 세션 영속 + 비용 원장.** 턴 종료마다 `turn_usage`와 `turn_model_usage`에 사용량을 적재한다(`features/usage/tracker.ts`의 `recordTurnUsage`). 대화 목록에서 제거해도 비용 원장과 세션 연결은 보존한다. native 이력을 재조회할 때 과거 사용량을 새 과금으로 기록하지 않는다([persistence.md](../backend/persistence.md)). 세션 로드 시 최신 원장에서 `lastTelemetry`를 재구성하고(`DbQueries.usage.getLatestTurnUsage` → `usageRowToTelemetry` → `features/history/reader.ts`) `LoadedSession.lastTelemetry`로 복원한다. `BEGIN_TURN`은 이를 비우지 않아 턴 진행 중에도 컨텍스트 표시를 유지한다. 패널은 비용/지연/모델 행을 두지 않는다. 비용 원장으로 일·주·월 사용량을 집계하며 세션 비용 합계 `sessionCostUsd`는 Composer 상태 팝오버가 표시한다.

**⑤ 빈 reasoning 카드 스킵 (구현 완료).** 빈/공백 "사고 과정" 카드가 뜨던 문제 해소 — `claude-map`(빈 `thinking` emit 안 함)·`messageSegments`(빈 reasoning 파트 스킵)·`ReasoningBlock`(합친 텍스트 공백이면 `null`) 3층 가드. 라이브 경로 `PendingAssistant` 는 기존 `{pendingReasoning && …}` 로 이미 가드됨.

---

## 산출물 게시 카드

`artifact` part는 transcript의 문서 카드에 표시하고 세션 게시 목록은 작업 타일의 출력 섹션에 작은 행으로 표시한다. `ArtifactCard`는 단일 카드와 메뉴를 그리며, `ArtifactCards`가 세션 구독·파일 작업·묶음 저장을 연결한다. 표시 형상만 구분하고 게시 ID, 파일 상태와 저장·탐색기 보기·휴지통 이동·다시 확인 액션은 공유한다. 파일 없음과 접근 오류를 구분하며 파일 메타와 휴지통 이동 시각은 메뉴에 표시하지 않는다.

작업 타일은 진행 상황·출력·컨텍스트 섹션을 제공한다. 출력 접기는 카드의 파일 상태 구독을 정리하고 목록 메타 구독은 헤더 개수 갱신을 위해 유지한다. Work 작업 상세 진입은 숨긴 목록의 구독을 유지하며, 타일을 닫아도 Work Transcript가 열린 동안 일반 출력 목록 구독은 유지하고, 세션 전환·화면 unmount에서 해제한다. 컨텍스트는 작업 경로·추가 디렉터리·읽기 및 웹 소스·첨부 사본을 표시한다.

출력 행과 transcript 카드의 본문 버튼은 `artifactViewerStore`에 게시 ID와 실행 항목을 선택하고 `RightPanel`에서 `ArtifactViewer`를 연다. 기존 패널은 숨긴 채 mounted·inert로 유지하며 닫으면 접힘·스크롤·초점을 복원한다. 세션 이동·unmount·빠른 파일 전환·재시도는 요청 세대로 지각 응답을 폐기한다. Markdown/HTML은 미리보기와 코드, 텍스트/코드는 코드, 이미지는 이미지로 읽는다. 줄번호·복사·개별 다운로드·확대·닫기와 오류별 재시도를 제공한다. HTML은 Main의 순수 파서가 문서 루트의 스타일·언어 속성을 보존하며 정제하고, renderer는 previewContent만 탐색·스크립트·네트워크를 막은 sandbox iframe에 전달한다. 공통 Shiki는 JavaScript 정규식 엔진을 사용해 앱 CSP를 유지하며, 큰 코드나 구문 분석 실패는 줄번호가 있는 원문으로 표시한다.

검증된 `tool.call.completed.artifact`는 원래 toolRunId가 속한 메시지만 교체한다. 목록 갱신 이벤트는 게시 카드를 임의의 메시지에 추가하거나 패널을 자동 선택하지 않는다. 일반 출력은 이 목록의 최신 파일을 Transcript 하단에서 표시하며 원래 메시지에 이미 연결된 파일은 중복 표시하지 않는다. `artifactStore`는 mount된 세션의 알려진 ID를 대상으로 상태 조회를 병합하고 세션/파일별 요청 세대로 지각 응답을 폐기한다. transcript 묶음 저장은 해당 메시지의 게시 집합, 타일은 Main이 반환한 최신 목록을 사용한다.

제품 미리보기에서 지원하지 않는 형식은 뷰어를 만들지 않고 검증된 게시 파일의 위치를 탐색기로 연다. 다른 파일의 기존 뷰어는 유지한다. 컨텍스트 파일도 지원 형식·안전한 확장자에 해당할 때만 기본 앱으로 열고, 미지원 형식은 탐색기에서 선택한다. Transcript의 HTTP(S) 링크는 새 창과 같은 창 탐색 모두 OS 기본 브라우저로 전달한다.

`RightPanel`은 하네스별 진입점을 통해 공통 `harnesses/common/rightpanel/TilePanel.tsx`를 렌더한다. `TilePanel`은 타일 registry·행/열 배치와 범용 상세 슬롯을 제공하고 세션·뷰어·확대 수명을 조립한다. `RightPanelColumn`은 타일과 행 애니메이션, `PanelResizeSeparators`는 행/열 조절을 담당한다. overview viewport 폭은 가용 영역의 절반 이내이며 넘치는 열은 가로 스크롤한다. 뷰어는 별도 저장한 폭을 사용한다. 직접 타일을 열면 이미 열린 화면 밖 열도 보여 주고, 열 리사이즈는 스크롤된 실제 DOM 좌표를 기준으로 계산한다. 카드와 액션은 기존 시맨틱 토큰·Button·DropdownMenu·확인창·번역 리소스를 공유한다.

`useArtifactViewerActions`는 복사와 저장의 중복 실행 잠금·피드백·요청 소유권을 관리한다. 오류 문구는 `artifactFeedback`에서 해석하고 선택 전환·닫기 이후의 완료는 이전 화면을 갱신하지 않는다. 패널 펼치기·복원·닫기는 공통 `PanelControls`와 Material SVG를 사용한다. 같은 역할의 툴팁은 공통 번역을 사용하며 타일을 식별해야 하는 접근성 이름에는 대상명을 포함한다.

프로젝트·아티팩트·플러그인 목록의 탭은 `CatalogTabs`로 방향키·Home/End·ARIA 연결을 공유한다. Plugin 카탈로그는 플러그인→스킬→MCP 순서이고 첫 진입도 플러그인이다. Plugin 행은 main이 전달한 허용 Material icon과 현재 locale의 title·body를 표시하며 locale 선택은 exact→base→ko→en 순서다. 상세는 body와 분리해 source·version·GitHub·license attribution을 표시한다. catalog가 없는 Plugin은 `electrical_services`와 Auth label, Plugin이 아닌 연결은 기존 power icon과 Auth label을 사용한다. 프로젝트와 아티팩트 검색은 `CatalogSearch`와 `useCatalogSearch`로 열기·Escape·초점 복귀를 공유하며 검색어와 필터·총계는 각 feature가 소유한다. 플러그인의 최종 행 순서는 `catalogOrder`에서 정한다. 각 탭은 Orcinus orca 그룹이 맨 위이며 실제 항목이 있는 그룹만 제목과 브랜드 로고로 구분한다. 제목은 `Orcinus orca`·`Claude`·`OpenCode`이고 스킬 탭의 `~/.agents/skills`는 유지한다. 플러그인 탭의 Orca provider는 gate→llm→service 순서이며 이후 Claude→OpenCode 그룹을 둔다. Orca 로고는 높이와 자동 너비로 표시하고 Orca MCP 목록·상세는 MCP 아이콘을 사용한다. Composer도 같은 제목·로고 규칙을 사용하며 첨부 메뉴는 같은 제목을 합치고 자동완성은 연속한 같은 제목을 합친다. Composer `+` 메뉴의 스킬·플러그인 패널도 Orcinus orca 그룹을 맨 위에 두고 나머지 그룹의 상대 순서는 유지한다(`attachMenuModel.orcaGroupFirst`). 스킬 탭은 네이티브 플러그인 출처 스킬을 제외하고 Claude·OpenCode 기본 스킬·Orcinus orca 스킬·lock 등록 agents를 표시한다. 기본 경로 스킬은 일반 글씨이며 토글이 없고 Orca 스킬만 토글한다. native MCP는 양 하네스 설정을 read-only로 읽어 설정 파일 위치 열기를 제공한다.

뷰어 패널과 작업 타일은 도메인에 독립적인 공통 `ResizableSidePane`을 사용한다. Transcript와 아티팩트 화면의 뷰어 좌측 핸들은 포인터·키보드로 폭을 조절하며 iframe 위를 지나는 드래그도 유지한다. 확대는 가장 가까운 현재 pane 전체를 덮고 nav에는 영향을 주지 않는다. Code 변경사항의 `GitContextBar`도 registry 헤더 props로 같은 확대 상태를 전달받는다. 본문을 다시 mount하지 않으며 복원 시 일반 폭과 스크롤을 되돌린다. 확대한 타일을 닫으면 확대 상태도 해제한다. 세션·대상 전환, 창 초점 이탈, 취소와 unmount에서 드래그 자원을 정리한다.

## 하네스 전용 표시

새 대화의 모델 선택은 `chatReducer.SET_MODEL`에서 backend를 함께 바꾼다. OpenCode 선택은 Code를 강제하며 생성·입장 이후 backend는 잠긴다. `ComposerInputController`는 동일 인스턴스를 유지하고 테두리·컨트롤만 전환한다. OpenCode의 에이전트·variant는 실제 카탈로그에서 제공한다. Claude의 권한·effort 컨트롤은 기존 정책을 유지한다.

OpenCode가 실행된 뒤에는 같은 세션의 native resource cache에 있는 SDK 에이전트·모델 variant를 Composer 선택지로 사용한다. visible primary/all 에이전트를 표시하고 hidden/subagent는 제외한다. 성공한 목록에서 사라진 agent·variant 선택은 정리하며 variant가 없으면 선택기를 숨긴다. 연결 전에는 설정 카탈로그를 사용하고, 재개 후 연결 이벤트에서 갱신하며 살아 있는 같은 generation은 화면 이동에도 보존한다.

양 Composer의 `+` 메뉴는 스킬을 `/이름`, 플러그인 메뉴의 내장 Plugin과 연결된 native MCP를 `@id`로 삽입한다. 공백이 있는 MCP id는 `@"id with spaces"`로 보존한다. 하이라이트는 현재 후보의 정확한 id/name과 일치할 때만 표시하며, 플러그인과 파일 참조는 같은 배경색을 사용한다. native MCP의 메뉴와 하이라이트는 같은 connected·enabled 투영을 사용하고, OpenCode의 native 후보는 Orca 통합 주입 여부와 독립적이다. 하네스 plugin이 제공한 스킬·명령은 스킬 그룹의 `/이름`을 유지한다. 그룹 제목의 공식 Claude/OpenCode 마크는 해당 브랜드 색을 명시한다.

`TranscriptView`는 공유 메시지 모델을 하네스별 viewport로 보낸다. Claude는 기존 교환 단위 가상화와 `useScrollAnchor`를 사용한다. OpenCode는 `harnesses/opencode/transcript/Timeline`에서 텍스트·도구·메타를 안정된 행 key로 투영하고 행 단위로 가상화한다. 읽기 중인 행과 선택 범위를 보존하며, 세션별 위치·도구 펼침을 기억한다. 위로 스크롤하거나 텍스트를 선택하면 새 출력의 바닥 추종을 해제하고, 바닥 도달 또는 최신 이동으로 추종을 재개한다. 탐색 도구는 접기 행으로 묶고 수정 도구는 사용자가 펼칠 때 diff를 표시한다. `providerTool` 원본은 상세 disclosure에서 읽는다. 본문 배경과 사용자 버블 색상은 Claude와 공유한다.

OpenCode의 질문과 도구 승인은 도착 순서대로 같은 입력 자리를 대체한다. 현재 요청만 mount하고 해소되면 다음 요청을 표시한다. 입력 controller는 비활성 상태로 인스턴스를 유지하므로 마지막 요청 후 초안·첨부가 복원된다. Todo 진행 카드는 현재 root 턴의 성공 결과에서 파생해 composer 바로 위에 펼친 목록 또는 한 줄 요약으로 표시한다. 요청 카드가 있으면 가리고, 전체 완료나 실행 종료 시 마지막 내용을 유지한 채 아래로 퇴장한다. 일반 OpenCode transcript에서는 Todo 행을 중복 표시하지 않으며 원본 이력은 보존한다.

`components/rightpanel/tileRegistry.ts`는 하네스별 타일 본문과 헤더를 선택한다. `rightPanelTiles`의 하네스 정책은 reducer 활성화·패널 렌더링의 지원 범위를 정의하고, 선택적 `menuIds`로 타이틀 메뉴의 노출 범위를 좁힌다. 메뉴 비노출은 저장된 타일·직접 활성화·상세 패널의 지원을 변경하지 않는다.

타이틀 메뉴는 `타일 표시` 아래에 노출 항목을 정의 순서로 표시하며 범주 제목을 넣지 않는다. Claude Code는 계획·백그라운드 작업·변경사항, Claude Work와 OpenCode의 Code·Work는 작업을 표시한다. OpenCode의 전용 외형은 해당 하네스의 composer·transcript·패널에만 적용한다.

엔진·모델 페이지의 엔진 추가 dropdown은 Claude/OpenCode를 선택한 뒤 폼을 연다. 두 폼은 ‘엔진 추가’ 제목과 취소/추가하기 버튼, 모달 폭·헤더·footer 스타일을 공유한다. Claude 카드에는 adapter 이름 `claude`, Claude 엔진 편집에는 고정 adapter/provider chip을 표시한다. 폼 안의 하네스는 고정된다. OpenCode 신규 엔진은 공급자 ID·표시 이름·URL·선택 API 키와 모델/헤더 반복 행을 사용한다. 공급자 제목 옆의 불러오기는 전역 파일에서 노출 필드만 채우며 원본을 편집하지 않는다. v1 codec은 폼의 공급자와 모델만 소유하는 새 native override 문서를 생성한다. 모델 목록의 소유 범위는 [OpenCode 카탈로그 계약](../backend/adapters.md)을 따른다. 기존 엔진 편집은 JSON을 사용한다. 설정 모달은 일반·사용량·공급자별 사용량만 표시하며 하네스별 설정 탭은 제공하지 않는다. 페이지 진입은 기존 카탈로그를 재사용하며 변경 저장과 공급자 상태 갱신은 목록을 다시 조회한다. 카탈로그 조회 상태는 엔진 변경 작업의 busy와 분리해 다른 하네스 조회가 기존 편집·삭제·저장을 잠그지 않는다.

| OpenCode 타일 | 표시와 진입 |
|---|---|
| `task` | 기본 `작업` 요약 카드. 폴더 제목과 변경 사항 진입을 표시하고, 하위 에이전트·소스는 실제 자료가 있을 때, 셸 그룹은 활성 실행이 있을 때 표시한다. 카드 자체의 메뉴 버튼·별도 헤더는 없다. |
| `plan` | 지원되는 독립 타일이며 저장된 배치·기존 활성화 경로를 유지한다. 공통 계획 본문·복사와 기존 타일 헤더를 사용한다. |
| `diff`·`subagent`·`process`·`source` | 작업 요약에서 기존 패널 위의 상세로 연다. 기존 독립 타일과 같은 registry의 본문·헤더를 사용하며 diff는 Git 컨텍스트 헤더, 하위 에이전트는 목록 복귀 버튼을 유지한다. 셸 로그와 소스는 본문 안에서 스크롤한다. |

작업 요약의 변경 사항·하위 에이전트·셸 행·소스 모두 보기는 OpenCode navigation Context를 통해 상세를 연다. 공통 호스트의 표시 우선순위는 artifact 뷰어 → 상세 → 기존 타일이며 가려진 층은 mounted·hidden·inert로 유지한다. artifact를 닫으면 상세로, 상세를 닫으면 원래 타일로 돌아간다. 상세에는 추가 제목·뒤로 행 없이 기존 헤더를 사용하고, `RightPanelTile`의 닫기 override가 상세만 닫아 뒤의 같은 종류 타일을 보존한다. 타이틀 메뉴와 transcript Task 카드는 직접 타일 열기 경로를 사용한다.

소스 그룹의 활성 조건은 추가 폴더·전송된 첨부·참조 자료이며 작업 디렉터리만 있으면 그룹을 표시하지 않는다. 자료가 생긴 뒤 요약의 소스 그룹에서 폴더 추가·모두 보기를 사용한다. 소스 파일·URL 열기와 폴더 추가는 기존 컨텍스트 액션을 사용한다.

요약의 셸 목록은 `activePanelProcesses`가 기존 outcome의 `running`만 선택한다. 종료된 행과 마지막 실행 종료 후 그룹은 숨기며, 열린 상세와 전체 기록에는 최종 상태·로그를 유지한다. PR 항목은 제공하지 않는다.

OpenCode 패널의 외곽은 기존 보조 패널과 같은 `rounded-r6 border`를 사용하며, 전용 색·표면·그림자는 두 테마의 `oc-*` 토큰이 갖는다. 클릭 행의 안쪽 좌우 여백은 `PanelRow`·하위 에이전트 요약/목록·소스 URL에 일관되게 적용한다.

OpenCode 소스는 Work 컨텍스트와 같은 `useTaskContext` 훅을 사용한다. 폴더·첨부·참조 목록과 열기/추가 기능을 공유하고, `sessionContextPolicy`가 OpenCode Code와 Claude Work의 컨텍스트 기능을 허용한다. child 도구와 대화는 부모 작업에 귀속하며 셸의 완료 결과를 진행 로그보다 우선하고 제한된 후미와 잘림 안내를 표시한다. 선택·닫기·세션 캐시의 수명은 [상태 관리](state.md#우측-타일-선택)를 따른다.
