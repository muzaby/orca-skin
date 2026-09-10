# 구현 보고 — 탐색 목록과 페이지 후속 피드백

구현 완료: 사용자 후속 요구 AC19~27을 반영했다. 기존 대화 자동 프로젝트 보정은 사용자 정정으로 취소했고, DB 관계를 바꾸지 않고 최근 대화 분류를 복구했다.

| 요구 | 구현 결과 / 직접 증거 |
|---|---|
| AC19·21·24 | 프로젝트 이름 뒤에 작은 전체 경로, 고정됨↔프로젝트 이동, 최근 대화·미할당 대화·초안 복구. nav 파티션/SSR/실제 Electron 클릭 검사 |
| AC20 | 새 대화와 프로젝트 제목·Composer·목록의 실제 좌우 경계 일치. 창 폭 1400/960/720에서 Electron 치수 관측 |
| AC22 | 아티팩트 총계를 한국어 단위와 함께 표시. 기존 전체 총계 의미 유지, 렌더/native 검사 |
| AC23 | 플러그인 `/plugins` 페이지와 제목 아래 가로 스킬/MCP/연결 탭. 기존 상세·추가·인증 기능 유지, route/탭 행동 검사 |
| AC25 | 프로젝트 세로 목록과 제목 아래 cwd 메타. 검색·고정 필터·열기·생성 후 필터 초기화·고정 해제 후 초점 복구를 Electron으로 검사 |
| AC26 | Main 실제 생성 영수증→catalog/membership 조회→ID별 펼침. 기존 프로젝트·첫 로딩·중복 영수증은 수동 접기를 덮지 않음 |
| AC27 | 프로젝트·엔진 제목 설명 제거. 엔진 제목은 settings 원천만 집계하며 2 settings+1 runtime 입력에서 2개 표시 |

## 전수 적용과 V-pair 자기확인

EP13 3/3, EP14 3/3, EP15 2/2, EP16 2/2, EP17 1/1을 각각 nav 분류/행/최근 슬롯, landing/catalog/count, plugin route/tabs, 생성 발신/수신, 엔진 제목에서 확인했다. 검색은 `rg 'splitNavProjects|projectCreated|announceCreated|data-project-path|data-project-catalog|data-engine-catalog-count' app/src`로 시행했다. VP35~50은 해당 요구의 행동·렌더·실제 화면 결과로 자기확인하며 독립 verify를 대신하지 않는다.

## 검증

- nav 영향 테스트 7파일 73개, Electron-as-Node 실SQLite `project-binding` 3개 통과. 후속 SSR 테스트 재실행 3개는 중복이므로 추가 합산하지 않았다.
- 플러그인 영향 테스트 5파일 18개 통과. nav 검사와 일부 파일이 겹치므로 총계로 합산하지 않는다.
- landing·아티팩트 총계·지침·i18n·엔진 총계의 최종 Vitest는 5파일 19개 통과했다.
- 실제 Electron fixture는 [104/104 통과](evidence/r3-project-native-result.json), JS 오류·console 오류·외부 HTTP 요청 0. 새 대화와 프로젝트의 1400px 창 실내용 경계는 x=496.125, width=672로 일치한다. [manifest](evidence/r3-project-native-manifest.json)에서 검사 소스 SHA를 기록했다.
- main/web/test 타입 검사, 변경 소스 ESLint·Prettier, electron-vite build, doc inventory·test budget·diff whitespace를 통과했다. 마지막 엔진 변경 뒤 web 타입과 build를 다시 확인했다.

## 구현 중 발견과 대응

실제 화면에서 외곽 720px만 맞추면 `Composer.flush` 때문에 프로젝트 입력이 좌우 24px씩 넓어졌다. 프로젝트 전체 콘텐츠를 공통 `ReadingColumn`으로 감싸 제목·입력·목록이 새 대화의 실제 콘텐츠 경계와 일치하게 했다.

필터 중 프로젝트 생성 후 새 항목이 숨겨지는 문제는 생성 성공 뒤 전체 탭·검색 초기화로 닫았다. 고정됨 탭의 행 제거 후 키보드 초점 소실은 남은 선택 탭으로 복구한다. 두 동작 모두 native 검사로 확인했다.

자동 펼침 fixture는 초기에 `chatStore` 직접 주입만 사용해 Main 영수증 구독을 지나지 않았다. 실제 `chat.onEvent` 구독과 `projectCreated:true`를 전달하도록 fixture를 바로잡아 신규 생성·하위 조회·중복 영수증·수동 접기를 관측했다. 이 과정에서 프로덕션의 신규 생성 판정을 목록 길이나 지각 응답 추측으로 바꾸지 않았다.

## Review Signals

이번 자기확인은 Delta V3 범위다. 이전 V1/V2 독립 검증 상태를 PASS로 바꾸지 않으며 새 DB migration·기존 대화 재배정은 없다. UI 공개 문자열은 기존 i18n과 추가 프로젝트 검색 키를 사용하고 신규 의존성을 도입하지 않았다.
