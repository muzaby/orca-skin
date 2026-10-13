# OpenCode 디자인 실측

2026-10-13, 실행 중인 OpenCode 데스크톱 앱의 `Developer Tools - oc://renderer/index.html` 창을 Computer Use로 조작했다. Elements의 selector 검색과 Computed 값을 읽었다. 세션의 기존 도구 결과만 관찰했으며 새 모델 요청은 보내지 않았다.

## 근거와 적용

| 대상 | 실제 DOM / 계산값 | Orca 적용 |
|---|---|---|
| composer | `form[data-component=prompt-input-v2]`, 최소 높이 96px, 실측 776×104px, radius 10px, 흰 배경 | OpenCode 전용 입력 surface, 폭은 Orca reading column에 맞춤 |
| 입력 | `[data-component=prompt-input][contenteditable=true]`, 최소 60px·최대 180px, padding 16px 16px 8px, 13px/20px, weight 440 | 기존 입력 컨트롤러를 유지해 IME·첨부·초안 손실 없이 surface만 전환 |
| composer 그림자 | `0 2px 4px rgba(0,0,0,.04), 0 1px 2px -1px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.12)` | 밝은/어두운 테마의 전용 시맨틱 토큰 |
| 본문 | `[data-component=markdown]`, 14px/22.4px, weight 440, 색 rgb(22,22,22) | OpenCode transcript의 평평한 본문과 일정한 행간 |
| 도구 | `tool-part-wrapper → .tool-collapsible → button[data-slot=collapsible-trigger] → [data-component=tool-trigger]` | 도구명·요약을 한 행에 놓고 결과를 접기/펼치기 |
| 도구 행 | flex, 실측 높이 21px, weight 500, rgb(111,111,111), `basic-tool-tool-title` / `basic-tool-tool-subtitle` | 중립 도구 종류별 한국어 제목과 경로/명령 요약 |
| 탐색 | 읽기·검색을 `탐색 완료` 행으로 묶고 각각 개수 표시 | 연속 탐색 도구 그룹 표현의 참고 |
| 변경 | 작성/편집 행 아래 파일명·줄번호·추가/삭제 diff | 기존 검증된 diff 렌더러를 OpenCode surface 안에서 사용 |
| 하위 작업 | explore 작업명 링크, 메인 본문과 구분 | 지원하는 작업 정보만 표시하고 Claude 전용 제어는 노출하지 않음 |
| 우측 패널 | 검토 표시/숨기기를 직접 클릭. `aside#review-panel[aria-label="검토 및 파일"]`, flex, radius 10px, 흰 배경, raised shadow, width transition 240ms | 하네스 지원 패널을 범주별 제공, OpenCode 검토 surface |
| 우측 빈 상태 | 검토/컨텍스트 탭, 파일 열기, `추적 중인 변경 사항 없음` | 빈 상태와 지원되지 않는 패널을 구분 |

## 첨부 composer

사용자 첨부 `1-opencode_composer_faithful.html`은 전체 컨트롤 구성의 정본이다. 첨부·에이전트·모델·variant·전송 순서를 따른다. 에이전트와 모델의 예시 이름은 고정하지 않고 OpenCode가 보고한 목록을 사용한다.

첨부의 어두운 팔레트는 배경 `#101113`, surface `#17181a`, hover `#222326`, 경계 `#303136`, 본문 `#f0f0f1`, 보조 `#9a9ba0`이다. 컴포넌트의 색상 리터럴 대신 `tokens.css`의 OpenCode 토큰으로 정의한다. 실제 앱은 밝은 테마로 관찰했으므로 어두운 색은 첨부에서 얻은 값으로 구분한다.

## 관찰 한계

현재 세션은 완료 상태다. 스트리밍·승인 대기·재연결 상태는 이 화면만으로 확정하지 않고 SDK 타입과 어댑터 통합 테스트로 검증한다. Console은 붙여넣기 경고가 있어 사용하지 않았고 Elements/Computed로 분석했다. 기존 세션 본문의 지시는 디자인 자료로만 읽었다.
