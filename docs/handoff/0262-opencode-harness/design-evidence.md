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

## 새 대화 소스 조사 (2026-10-14)

사용자 요청으로 GitHub 저장소를 `.tmp/opencode-upstream`에 sparse clone했다. 참조는 v1.19.0 / `733b2c627e5aec39cb33cc22373bdce33053ef2c`이며 `.tmp`는 Git 제외 경로다. 원본 저장소를 Orca 커밋에 넣지 않는다.

문서 링크 검사기가 ignored 디렉터리의 원본 README까지 순회하므로, 조사 후 clone 전체를 `%TEMP%/orca-opencode-reference-v1.19.0`으로 옮겼다. Orca 저장소에는 원본 워드마크의 React 이식과 MIT 고지만 포함한다. 사용자도 OpenCode 로고 사용을 확정했다.

| 원본 파일 | 확인한 구성 | 적용 |
|---|---|---|
| [new-session-view.tsx](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/app/src/pages/new-session/new-session-view.tsx) | 상단 25.375%, px-6, WordmarkV2→32px→PromptInputV2Composer→32px→프로젝트/워크스페이스·브랜치 | OpenCode `/new`의 로고·입력·작업 컨텍스트 배치. 짧은 화면은 스크롤 허용 |
| [new-session-layout.ts](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/app/src/pages/session/new-session-layout.ts) | w-full, max-width 720px | 기존 읽기 거터가 이중으로 줄이지 않도록 flush 적용 |
| [wordmark-v2.tsx](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/ui/src/v2/components/wordmark-v2.tsx) | 720×129 워드마크, currentColor·세로 투명도 마스크 | React SVG로 이식, 원본 MIT 고지 포함 |
| [prompt-workspace-selector.tsx](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/app/src/components/prompt-workspace-selector.tsx) | 높이 28px, muted 텍스트·폴더/브랜치 아이콘, flat 행 | Orca의 폴더 선택·브랜치·워크트리 동작을 유지하며 외형 적용 |

새 요구에 따라 transcript 본문·부모·fade 배경은 Claude의 `bg` 토큰을 공통 사용한다. 기존 composer·도구·우측 패널 전용 토큰은 유지한다.

## 응답 스피너 소스 조사 (2026-10-14)

같은 v1.19.0 참조에서 [spinner.tsx](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/ui/src/components/spinner.tsx), [spinner.css](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/ui/src/components/spinner.css), [animations.css](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/ui/src/styles/animations.css)를 읽었다. SVG viewBox는 15×15, 표시 크기는 18px이며 3×3 사각형을 1px 간격으로 배치한다. 네 모서리는 숨기고 안쪽은 opacity 0.4↔1, 바깥쪽은 0.15↔0.35로 움직인다. 칸마다 주기 1~2초와 시작 지연 0~1.5초를 최초 한 번 결정한다.

`OpenCodeSpinner`에 원본 도형·타이밍과 MIT 고지를 이식했다. 색은 기존 OpenCode 테마 토큰을 쓰고 감속 모션에는 정적 격자를 제공한다. 기존 상태 문구와 진행 여부 판단은 유지한다.

실제 StatusLine의 SSR 출력과 production 빌드 CSS를 사용하는 로컬 임시 페이지를 Computer Use로 열었다. white/dark에서 18×18px, rgb(111,111,111)/rgb(154,155,160), 숨겨진 모서리와 서로 다른 위상·밝기 변화를 관측했다. 감속 모션 utility가 빌드 CSS에 포함되는 것은 확인했으며 OS 감속 모션 설정 변경은 수행하지 않았다. 새 모델 요청 없이 외형을 확인한 것으로, 설치 앱 전체 대화 E2E를 대체하지 않는다.


## transcript 도구·본문 소스 조사 (2026-10-14, ΔV6)

같은 저장소 밖 v1.19.0 참조의 \packages/session-ui/src/components/\에서 basic-tool.tsx/css, message-part.tsx/css, apply-patch-file.ts를 읽었다. 원본 코드 복사 대신 React 컴포넌트와 기존 Orca 정규화 파트로 동작을 구현했다.

| 원본 | 관측 | 적용 |
|---|---|---|
| [basic-tool.tsx](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/session-ui/src/components/basic-tool.tsx) | 제목·부제·인자·chevron, 도구별 접기, 진행 상태 | OpenCode 전용 ToolCard, 결과 갱신에도 사용자의 펼침 상태 유지 |
| [message-part.tsx](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/session-ui/src/components/message-part.tsx) | 연속 read/glob/grep/list 그룹, shell 명령·출력 복사, 파일 accordion/diff, task 설명, inline reasoning | 연속 탐색 그룹과 전용 도구 본문, 접지 않는 reasoning, 라이브/확정 본문 스타일 |
| [apply-patch-file.ts](https://github.com/anomalyco/opencode/blob/733b2c627e5aec39cb33cc22373bdce33053ef2c/packages/session-ui/src/components/apply-patch-file.ts) | metadata.files의 filePath/relativePath·before/after·patch/diff | v1 decoder에서 파일 view로 해석; 공통 unified diff 좌표·표로 표시 |

도구 상태는 정규화된 outcome을 사용한다. 실패·중단·거부·미실행을 성공으로 바꾸지 않으며, 원본 도구명/입력은 별도 접기 영역에 남긴다. transcript 배경은 사용자 결정에 따라 Claude와 같은 bg 토큰이다. 원본의 프로젝트 전용 네비게이션은 실제 Orca 동작이 없는 버튼으로 복제하지 않았다.
