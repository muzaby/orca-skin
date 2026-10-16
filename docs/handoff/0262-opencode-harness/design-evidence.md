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

## 실행 중인 Orca 시각 관측 (2026-10-14, r1.9 후속)

부분 확인. 사용자 요청에 따라 Windows Computer Use의 `@oai/sky`로 실행 중인 `Orcinus orca` Electron 창을 직접 조작했다. 1280×696 캡처에서 화이트·다크, Inter·보통 텍스트·보통 대화 너비를 확인했으며 앱을 재시작하거나 fixture를 주입하지 않았다.

| 대상 / 조작 | 직접 관측 | 판정 범위 |
|---|---|---|
| 새 대화 → OpenCode | 로고 → composer → 작업 폴더 순서, 두 테마의 표면·경계·전송 버튼 표시 | 현재 창 크기에서 잘림·겹침 없음 |
| 모델 메뉴 → sonnet → Big Pickle | CLAUDE / OPENCODE 엔진별 그룹, 제자리 슬라이스 전환, 같은 검증용 초안 유지 | 입력 보존 확인; 첨부 업로드는 수행하지 않음 |
| 추가 메뉴·에이전트 메뉴 | `파일 또는 사진 추가`, 기본 에이전트·build·plan 표시 | OpenCode 화면에 작업/코드 전환 제어 없음; build/plan은 OpenCode 에이전트 선택 |
| 작업 폴더 선택 → Git 저장소 | composer 아래 저장소명·현재 브랜치·워크트리 행, 브랜치 검색/스크롤 메뉴 표시 | 브랜치 변경·워크트리 생성 없이 표시만 확인; 비-Git 폴더에서는 브랜치 행이 사라짐 |
| 검증용 대화 전송 | 사용자 버블과 격자 스피너의 `응답 준비 중…` → `에러: 스트림 오류` | 스피너 진입·종료와 오류 표면 확인; 정상 스트리밍 미확인 |
| 생성된 세션 → 모델 메뉴 | OPENCODE 엔진 모델만 표시 | 생성 후 Claude 하네스 전환 항목 없음 |
| 기존 OpenCode 응답 | 사고 과정은 접기 버튼 없는 muted 본문, 답변은 별도 일반 본문 | 화이트·다크에서 기존 확정 응답 확인 |
| 기존 Claude transcript와 비교 | 두 하네스의 본문·상하단 배경이 시각적으로 이어지고 composer 외형은 구분됨 | CSS 계산값·색상 계측 결과로 확대하지 않음 |
| 우측 패널 메뉴 | `검토 → 변경사항`, `세션 → 계획` 표시 | Claude 전용 타일 항목 노출 없음 |
| 변경사항·계획 동시 열기 | 우측 상하 타일과 축소된 transcript/composer 배치, 빈 상태 표시 | 두 테마에서 잘림·겹침 없음; 실제 diff/계획 내용 미확인 |

### 발견 및 미확인

| ID | 관측 / 재현 | 영향 / 다음 확인 |
|---|---|---|
| CUA-01 | 새 OpenCode 대화, 기본 에이전트·Big Pickle에서 도구 없는 짧은 인사 요청 1회. 23:32 KST 사용자 턴 후 정상 답변 없이 `OpenCode 실행 중 오류가 발생했습니다. 모델과 서버 설정을 확인한 뒤 다시 시도해 주세요.` 표시 | 실제 응답 경로 실패. 실행 중 프로세스의 코드 버전·서버·제공자 원인은 이번 시각 검사로 확정하지 않음 |
| CUA-02 | 같은 세션에서 우측 `세션 → 계획`을 열면 `Claude 가 탐색하며 계획을 세우면 여기에 표시됩니다.` 표시. 화이트·다크 동일 | OpenCode 화면에 Claude 전용 안내가 남음. `PlanTileContent.tsx`가 공통 `chat.rightpanel.planEmptyDesc`를 사용하고 ko/en 리소스 모두 Claude를 고정한 것을 읽기로 확인 |
| CUA-03 | CUA-01로 정상 응답이 생성되지 않음 | OpenCode 탐색 그룹·셸 출력·파일 diff·task 카드·원본 입력 펼침·정상 스트리밍·내용이 있는 우측 패널은 실앱 시각 미확인. 기존 자동 테스트 결과로 대체하지 않음 |

검증용 요청은 “시각 검증용 대화입니다. 도구는 호출하지 말고, 한 문장 인사와 짧은 목록 두 항목을 한국어로 답해 주세요.”였다. 이 대화 한 개를 남겼으며 기존 대화에는 전송하지 않았다. 작업 종료 시 원래 화이트 테마·작업 폴더·OpenCode 세션 및 스크롤 위치로 복원했다.

AC11 최종 사용자 시각 인수와 독립 verify는 대기 상태를 유지한다. 이번 기록은 실행 앱의 제한된 시각 관측이며 전체 handoff의 PASS나 제품 코드 수정 보고가 아니다.

## 오류 수정 후 실앱 관측 (2026-10-15, r1.10)

부분 확인 — Windows Computer Use로 실제 Orca Electron 앱을 조작했다. 외부 무료 모델의 거절과 로컬 테스트 공급자의 성공 경로를 구분한다. 코드 반영을 위해 개발 앱을 재시작했으며, 임시 공급자·Git 폴더·서버는 커밋 대상에서 제외한다.

| 대상 | 관측 | 증거 범위 |
|---|---|---|
| CUA-01 원인 | Orca 소유 OpenCode 서버 로그의 2026-10-14 14:32:42 UTC 요청: `opencode/big-pickle`, HTTP 403, `FreeTierError`, 무료 모델의 OpenCode 외부 앱 사용 거절 | SSE 구독·연결 실패로 오인하지 않는다. 공급자 원문·헤더·요청 내용은 문서에 복제하지 않음 |
| CUA-01 수정 후 | 같은 검증 세션에 도구 없는 인사 요청 → 격자 스피너 → `에러: 권한 거부`와 무료 모델 사용 정책·다른 공급자 설정 안내 → 입력 가능 상태 | 실제 공급자의 403을 정확히 표시. 공급자 정책 자체를 변경하거나 우회하지 않음 |
| CUA-02 수정 후 | OpenCode 계획 패널: `OpenCode가 탐색하며 계획을 세우면 여기에 표시됩니다.` | 화이트 테마의 실제 패널. Claude 회귀는 실제 컴포넌트 렌더 테스트 |
| 정상 스트리밍 | `cua-local-test` 엔진의 `LOCAL TEST — synthetic` 선택, 로컬 OpenAI 호환 fixture → 설치된 OpenCode CLI → SDK → Orca. 본문과 목록 두 항목이 순차 표시되고 스피너 종료 | 외부 모델 성공으로 확대하지 않음. IPC·reducer에 합성 이벤트를 직접 주입하지 않았고 앱 Mock 모드는 꺼짐 |
| 도구 카드 | 같은 세션에서 native `read` 호출. 읽기 카드의 실행 중 표시·파일 경로·스피너·승인 카드. 개발 리로드 후 중단된 카드 펼침에서 중단 결과와 원본 입력 접기 표시 | 읽기/편집 승인 완료 및 성공 카드 본문은 미확인. 승인 버튼은 조작하지 않음 |
| 승인 문구 | 추가로 발견한 `Claude가 Read…`를 수정한 뒤 재요청: `OpenCode가 Read 실행 권한을 요청합니다` | 대기 중 실제 승인 카드에서 확인. 이전 승인은 개발 리로드 후 중단하여 새 요청과 구분 |
| 우측 diff | 독립 Git fixture에 직접 만든 합성 커밋을 새로고침. `sample.md +2 -0` → 파일 펼침 → 줄 번호 1~5와 초록 추가 행·긴 행 줄바꿈 표시 | 실제 Git 커밋 간 diff 표시 확인. OpenCode 편집 완료가 만든 diff라고 주장하지 않음 |

임시 Git 저장소는 `.tmp/0262-cua-app-workspace`, 로컬 HTTP fixture는 `.tmp/0262-provider.mjs`이며 외부 네트워크·기존 공급자 키를 사용하지 않는다. diff 패널은 현재 제품 계약상 커밋 간 차이만 표시하므로 미커밋 테스트 변경은 커밋 후 새로고침했다. 테스트 데이터는 기존 작업 파일과 분리했다.

CUA-01의 오류 안내 누락과 CUA-02는 수정했다. 실공급자 정상 응답은 허용된 공급자 선택 회신을 기다리며, 완료된 읽기/편집 카드와 편집 결과의 연속 경로는 사용자의 파일 접근 승인 후 재검증해야 한다. AC11·독립 verify는 완료로 승격하지 않는다.

### r1.10 후속 — 사용자 승인 후 실모델·완료 카드 관측

2026-10-15 사용자 회신으로 기존 HF 엔진 인증 재사용과 로컬 테스트의 읽기·편집 승인 완료를 확인했다. 아래는 앞 절의 대기 항목을 보완하는 Computer Use 직접 관측이며, 제품 코드 변경이나 독립 verify가 아니다.

| 대상 / 조작 | 직접 관측 | 판정 범위 |
|---|---|---|
| 로컬 공급자 읽기 카드 펼침 | native `read` 결과에 `sample.md`의 줄 번호와 `# Before`, 테스트 본문 표시 | 실제 OpenCode CLI 도구 완료. 공급자 응답 생성은 로컬 fixture |
| 로컬 공급자 편집 카드 펼침 | `Edit applied successfully.`, 인라인 diff `+1 −1`, 붉은 `# Before`와 초록 `# After`, 원본 도구 입력 접기 표시 | 승인 → 파일 편집 → 완료 카드 경로 확인. 디스크 파일도 `# After`로 일치 |
| 우측 변경사항 새로고침 | 편집 결과를 격리 저장소에 커밋한 뒤 `sample.md +3 −1`과 제목 교체 표시 | 기존 합성 추가 행과 OpenCode 편집을 합친 커밋 간 diff. 미커밋 diff 지원으로 확대하지 않음 |
| OpenCode HF 엔진 연결 | 사용자 승인한 기존 HF 토큰·모델을 별도 `opencode/hf/settings.json`에 구성. 엔진 목록과 모델 메뉴에 `Granite 4.2 3B (HF / DeepInfra)` 표시 | Claude HF 설정 보존. 키·설정 원문은 저장소와 검증 기록에서 제외 |
| HF 실제 정상 응답 | 도구 없는 한국어 인사 요청 → 격자 스피너 → 사고 과정과 한국어 답변 → 스피너 종료·입력 가능 | `hf/ibm-granite/granite-4.2-3b:deepinfra`의 실제 외부 응답. 로컬 fixture와 다른 새 세션 |

HF 연결은 [HF 공식 OpenAI 호환 엔드포인트](https://huggingface.co/docs/inference-providers/index)와 [OpenCode 공급자 설정](https://opencode.ai/docs/providers/)을 확인해 `@ai-sdk/openai-compatible` 및 `https://router.huggingface.co/v1`을 사용했다. 인증 값은 로컬 파일 간 변환에서만 취급했고 도구 출력·문서에 노출하지 않았다.

디스크에 추가한 엔진은 실행 중 목록 캐시 때문에 모델 새로고침만으로 나타나지 않았다. 기존 로컬 테스트 엔진의 설정을 그대로 저장해 설정 목록을 무효화한 뒤 HF 엔진을 확인했다. 앱 재시작이나 제품 코드 수정은 수행하지 않았다.

추가 HF 도구 요청(`sample.md` 읽기 후 `# After` → `# HF Verified`)은 native `read` 호출과 `OpenCode가 Read 실행 권한을 요청합니다`까지 관측한 뒤 승인 대기로 남겼다. 이후 사용자가 이번 실모델 도구 검증 생략을 선택했다. 대기 요청 정리를 위해 같은 대화를 다시 열었을 때 이미 읽기·편집 결과와 `업데이트 완료: # HF Verified로 변경됨.`이 표시되고 중단 버튼 없이 전송 비활성 상태였다. 중단할 실행은 없었으며 추가 호출·카드 펼침·diff 재검증은 하지 않았다. 이 완료 이력을 전체 HF 도구 시각 검증 통과로 승격하지 않는다. AC11 최종 시각 인수와 독립 verify는 대기다.

## 사용자 제공 데스크톱 소스 이식 (2026-10-15, r1.11)

적용 — `.tmp/opencode-dev`의 desktop → app timeline → session-ui 경로를 읽고 OpenCode 전용 React 화면에 이식했다. 소스 package 버전은 2.0.29다. 별도 Git metadata가 없어 upstream commit은 확인하지 않았으며, 부모 Orca HEAD를 원본 revision으로 사용하지 않는다. 실행 SDK/CLI의 1.x 계약은 그대로다.

| 원본 경로 (참조 폴더 기준) | 적용 |
|---|---|
| `packages/app/src/session/timeline/message-timeline.tsx`, `packages/session-ui/src/components/{basic-tool,message-part}.tsx/css` | 28px 도구 행, 13px 제목/보조 텍스트, 탐색 그룹, 셸 명령/결과 분리, 파일 헤더와 diff, Q&A |
| `packages/app/src/composer/editor/editor.tsx/css` | radius 12px, 입력 60~180px, toolbar 44px, 제어/전송 28px, 좁은 폭 가로 스크롤 |
| `packages/app/src/session/requests/session-question-dock.tsx`, `session-permission-dock.tsx` | 질문 진행 표시·radio/checkbox·직접 입력·접기·명시적 다음/제출, 승인 세 동작 |
| `packages/ui/src/theme/themes/oc-2.json`, `packages/ui/src/icons/catalog.ts` | OpenCode 전용 light/dark 의미 토큰과 glyph. 공통 transcript canvas 토큰 유지 |
| `LICENSE` | MIT 저작권 고지를 배포 resources의 `OPENCODE-LICENSE.txt`에 포함 |

원본 식별용 SHA-256: `oc-2.json` = `B117300614F0FAF0D05C0894AF7EE4AFB4906F1C50F028FB8E39DD647120E3BA`, `session-question-dock.tsx` = `1605B13945A3C83DCDCDE5E55F975D24B4C2BA3EF941AD53263F51F3023E6A2D`, `message-part.css` = `2F1EC823E12E79F9899C0A5C79C1FC083C1459E3D6ADEE9C01254438C2470C67`.

### 시각 관측 범위

부분 확인 — Windows Computer Use는 새 창 목록으로 다시 연결한 뒤에도 `foreground window did not report a process id` 오류로 실제 앱의 화면을 얻지 못했다. 내장 브라우저의 로컬 미리보기에서 실제 production React 컴포넌트와 CSS를 조작했다. preview의 입력·도구 결과는 합성 fixture이며 실제 모델·IPC 검증으로 확대하지 않는다.

| 조작 | 관측 |
|---|---|
| light / 720px 본문 | 탐색 그룹, 셸 명령/결과, 파일 +1/−1과 diff, 질문 dock의 위계·간격 확인 |
| dark / 360px 본문 | 질문·직접 입력·footer·승인 세 버튼과 composer 표시. 전송 버튼과 toolbar 겹침 없음 |
| 실제 DOM 계산값 | 기존 dark canvas `rgb(38, 38, 36)`, composer `rgb(36, 36, 36)`·폭 360px·radius 12px, toolbar 44px, 전송 28×28px |
| 질문 선택 → 다음 → 다중 선택·직접 입력 → 제출 | 첫 답 `현재 작업 공간`, 두 번째 답 `[타입 검사, 테스트, 문서 검사]`로 조립됨 |
| 원본과 치수 대조 | Orca root rem이 14.5px이므로 OpenCode의 핵심 치수를 명시적 px로 보정. 선택 표시도 원본의 고정 blue accent로 보정 |

후속 preview에서 에이전트·변형 합성 칩을 실제 `OpenCodeAgentControl`·`OpenCodeVariantControl`로 교체했다. dark 360px와 light 720px에서 메뉴를 열고 `build`·`high`를 선택해 trigger 값에 반영됨을 확인했다. 메뉴의 실제 배경은 dark `rgb(22, 22, 22)` / light `rgb(255, 255, 255)`, radius 8px·padding 4px였다. 모델 라벨은 합성 칩이다. 기본값·초점/키보드 배선은 `Controls.interaction.test.ts`에서도 확인했다. 실앱 시각 관측으로 확대하지 않는다. 임시 미리보기는 소스 트리에서 제거하여 `.tmp`에 보관했고 브라우저 탭을 닫았다. 다운로드 소스·미리보기는 커밋하지 않는다. AC11 최종 사용자 인수와 독립 verify는 대기다.

## Claude GUI 복원 (2026-10-15 r1.13)

Computer Use의 내장 브라우저에서 실제 ChatTile·ChatTitleBar·RightPanel·AgentEnvironmentView·EngineFormModal과 production CSS/store를 조작했다. native API는 메모리 fixture이며 실제 엔진·파일·서버 설정을 변경하지 않았다. 새 실모델 호출이나 네이티브 Electron 검증으로 확대하지 않는다.

| 조작 | 관측 |
|---|---|
| Claude Code 타이틀 메뉴 | 타일 표시 아래 계획→백그라운드 작업→변경사항. 추가 그룹 제목 없음. 계획 열기/기존 닫기 정상 |
| Claude Work 메뉴/작업 열기 | 작업 항목만 표시. 진행 상황·출력·컨텍스트의 기존 작업 패널 유지 |
| Claude 밝은/어두운 테마 | 원래 composer·도구 행·사용자 버블 표시. 마지막 사용자 본문 글자색 light rgb(26,26,24), dark rgb(240,239,234) |
| 엔진 페이지 | 우측 엔진 추가만 표시. claude/OpenCode 카드 공존, 새로고침 없음 |
| 카탈로그 loading=true → Claude 편집 | 편집 버튼 활성. 고정 claude/provider chip, 하네스 select 없음. 유효 provider 입력 후 저장 활성 |
| 새 엔진 → OpenCode 선택, OpenCode 편집 | 새 엔진의 선택·opencode.json 불러오기 유지. 편집의 하네스 select는 비활성 |
| OpenCode 타일 메뉴·작업→변경 사항→닫기 | 평면 지원 메뉴 유지. 기존 패널 위 상세를 열고 닫으면 작업 요약 복귀. 도구 diff 유지 |

첫 Work 전환의 permission stub 반환 누락은 fixture를 수정한 후 다시 관측했다. 제품 변경은 없다. 스크린샷은 로컬 `.tmp/0262-v9-claude-menu.jpg`, `0262-v9-work-menu.jpg`, `0262-v9-claude-dark-menu.jpg`, `0262-v9-engines.jpg`, `0262-v9-claude-edit.jpg`에 보관했다. 임시 renderer 파일·서버·탭은 정리했다. 사용자 최종 인수와 독립 verify는 대기다.

## Desktop 직접 조작과 Todo 호출 (2026-10-15 설계 델타)

실제 OpenCode Windows 창을 Computer Use로 조작했다. 처음에는 접근성 tree와 화면 캡처가 불일치해 입력을 멈췄고, 사용자가 OpenCode를 앞으로 전환한 뒤 일치하는 화면에서 재개했다. 제품 구현·Orca 검증 완료가 아니라 ΔV11~13의 참조 관측이다.

| 식별 | 근거 |
|---|---|
| 실행 desktop | 반환된 OpenCode.exe 창을 선택. 설치 `resources/app.asar`의 package.json을 읽어 `@opencode-ai/desktop`, version1.19.0 확인 |
| 제공 아카이브 | `.tmp/opencode-dev/package.json`2.0.29, 별도.git 없음. 부모 Orca SHA를 upstream으로 사용하지 않음 |
| 소스 식별 | `package.json` SHA256 `A0D3F21A366EEA08DA3BEAEE0D54944D79DF5E750B79CC5AF31AC9AEFFD51094`; `timeline/virtualizer.tsx` `9F6259529CA6AAF9C3C8FA071722D6DE27E1E93ED7DD47F876EA1FD92BDF7C1B` |
| 추가 식별 | `timeline/interaction.ts` SHA256 `51F75313A299EF00750A554913E130F3C2C502B3425127D764A00C7FC03BDC48`; message-part.css 해시는 앞 절과 동일 |

### 직접 관측

| ID / 조작 | 관측 | 한계 |
|---|---|---|
| CUA-OC-REQ / 기존 활성 도구 테스트 세션 | 하단 권한 설명·패턴·거부/항상 허용/한 번만 허용 dock이 입력기를 대체. 스크롤 중 같은 하단 자리 유지 | 한 장 상태를 관측. 복수 승인 FIFO는 사용자 명시 계약이며 이번 native 실기에서 동시3건을 만들지는 않음 |
| CUA-OC-SCROLL-1 / 본문 드래그 | 두 줄 본문 선택과 긴 대화의3~5단계 블록 역방향 선택에서 선택 강조가 본문·블록 간 유지 | 실제 selection range나 streaming중측정 간섭을 자동 계측한 결과는 아님 |
| CUA-OC-SCROLL-2 / 탐색·셸 펼침 | 탐색 완료 아래 Glob/Grep/읽기 행이 전개. 셸은 명령과 monospace 결과가 별도 영역으로 나타남 | 기존 읽기·셸 결과를 펼친 관측이며 새 셸 명령을 요청하지 않음 |
| CUA-OC-SCROLL-3 / 스크롤바 상하 드래그 | 과거 사용자/도구 내용과 최신 본문 사이 이동, 상단 제목·하단 요청 dock 또는 composer는 위치 유지. 긴 검증 대화의 처음 메시지까지 다시 표시 | 펼친 탐색 그룹 자체 sticky의 경계 이동은 화면 길이 한계로 별도 실측하지 않음. 해당 규칙은 원본 CSS 근거 |
| CUA-OC-TODO-1 / 새 세션 첫 호출 | ‘UI 검증용 할 일 항목 생성’에서 todowrite3항목 요청. ‘할 일 목록 업데이트’ 권한 카드가 composer를 대체. 사용자가 항상 허용을 직접 선택한 뒤 ‘생성 완료’와 입력기 복귀 | 첫 전개 모션은 승인 후 응답이 끝나 놓침 |
| CUA-OC-TODO-2 / 진행→긴 본문→전체 완료 요청 | 약9초 뒤60개 검증 문장·전체 완료 및 Todo 카드 부재 | 중간 카드를 놓쳤으므로 전개를 관측했다고 주장하지 않음 |
| CUA-OC-TODO-3 /6단계 별도 갱신 요청 | 진행 중 ‘6개의 할 일 중3개 완료’, 완료3행 취소선·체크, 진행중 행·대기행이 composer 바로 위에 표시. 다음 관측에서 전체 완료 본문과 카드 부재, transcript 가용 영역 확대 | 카드의 전개 상태→제거 상태를 직접 관측. 0.3초 모션의 연속 프레임·실측 시간은 확보하지 않음 |
| CUA-OC-QUESTION / 실제 question 호출·선택·제출 | ‘검증할 표시 형태를 선택하세요’ 질문과 두 선택지·직접 입력·닫기/제출이 하단 입력기를 대체. ‘접힌 Todo’를 선택해 제출한 뒤 transcript에 답변 결과가 남고 composer 복귀 | 단일 질문만 호출. 제출 직후 접근성 tree와 화면 갱신 시점이 달랐으므로 다음 관측의 결과·입력기 존재까지 확인. 복수 요청의 통합 FIFO는 원본 관측이 아닌 사용자 확정 요구 |
| CUA-OC-TODO-4 /8단계 갱신 중 접기 클릭 | 펼친 8개 목록의 우측 접기를 클릭. composer 바로 위 한 줄에 완료수와 대표 항목, 펼치기 화살표가 남음. 갱신 중에도 접힌 상태를 유지하며 화면은 5/8·‘카운트’를 표시. 전체 완료 후 카드 부재 | 같은 관측의 접근성 tree는 4/8·‘스크롤’, 화면은 다음 갱신 5/8이었다. 재펼침 클릭 시도 때 이미 완료 전환해 재펼침 성공은 주장하지 않음 |

Todo·Question 검증은 사용자가 승인한 기존 모델로 실제 요청했다. 요청 내용은 검증용 항목과 본문뿐이며 파일·셸·네트워크 도구를 사용하지 않도록 지정했다. 검증 세션을 남기고 사용자가 직접 설정한 권한을 임의로 되돌리지 않는다.

### 소스 근거와 이식 경계

transcript 참조 경로는 제공 아카이브의 `desktop/src/renderer/desktop-app.tsx`→`app/src/session/timeline/{message-timeline,virtualizer,interaction}`→`session-ui/src/timeline/session-timeline-row.tsx`다. `virtualizer.tsx`는 pointer-held 위 이동과 텍스트 선택을 추종 해제 의도로 구분하고 실제 바닥 도착에서 재추종한다. `message-part.css`는 펼친 탐색 헤더의 sticky와 내부 파일 헤더 offset을 정의한다.

Todo의 전개/퇴장은 제공2.0.29에 없는 기능이므로 공식1.19.0의 [state](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-composer-state.ts)·[region controller](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-composer-region-controller.ts)·[dock](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-todo-dock.tsx)를 별도 사용한다. 높이×진행률·composer overlap36px, spring visualDuration0.3/bounce0와 close400ms는 소스 값이다. 전체 completed/cancelled와 !live 정리는 구분하며 이식 시 퇴장 snapshot·새 턴의 stale 방지를 함께 잠근다.

원본1.19.0 [composer region](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/pages/session/composer/session-composer-region.tsx)은 질문·승인을 독립 선택해 동시에 각각 한 장을 표시할 수 있다. Orca는 사용자 결정에 따라 종류를 합친 도착 순서로 한 장만 표시한다. 현재 요청을 소비할 때까지 뒤 요청은 화면·접근성 트리에 렌더하지 않고, 입력기 위 스택이나 카드 가장자리 미리보기도 두지 않는다.

확정 요구의 예외는 유지한다: Claude GUI 불변, transcript canvas 및 사용자 버블 배경/글자색 유지, 실행 API는1.x. 실제 Orca의 구현 후 두 테마·streaming중드래그·긴 파일/탐색 sticky·Todo 애니메이션 검증은 새 AC의 완료 조건이며 이번 원본 관측으로 대체하지 않는다.

## Orca 요청·스크롤·Todo 구현 관측 (2026-10-15, r1.15)

Computer Use로 `app/scripts/fixtures/opencode-ui/`의 실제 ChatTile·Composer·transcript·store·reducer·CSS를 조작했다. native IPC만 메모리 대역이며 실제 Electron 창이나 외부 모델을 실행한 검증은 아니다. 참조 OpenCode desktop 관측과 이번 Orca 구현 관측을 구분한다.

| ID / 조작 | 실제 관측 |
|---|---|
| CUA-OC-REQ / 질문→승인→질문 | 현재 요청 한 장만 입력 자리에 표시됐다. 질문 제출 후 승인, 거부 후 다음 질문, 건너뛰기 후 입력으로 돌아왔다. 뒤 요청·편집기·Todo는 대기 중 DOM에 없었다. |
| CUA-OC-REQ / 승인→질문→질문 | 세션 허용 후 질문이 나타나고 질문 둘을 순서대로 소비했다. 실제 응답 IPC의 ID·allow/deny·scope·updatedInput과 화면 순서가 일치했다. |
| CUA-OC-REQ / 복원 | `보존할 초안`과 첨부 `sample.md`, 접힌 Todo 요약이 마지막 요청 후 복원됐다. 첨부 선택과 승인 응답은 메모리 대역 데이터에 한정했다. |
| CUA-OC-SCROLL / 긴 대화·선택 | 교환 60개의 scrollHeight 25515px에서 화면 주변 8행만 mount됐다. 실제 본문 드래그로 선택한 문자열을 3페이지 위·아래 이동 후에도 유지했다. |
| CUA-OC-SCROLL / 새 출력 | 과거를 읽는 동안 출력 추가 후 `user:5:2:text`의 상대 위치 −26.2125px와 scrollTop1662.4px를 유지했다. 맨 아래에서는 높이2652→2684px에 맞춰 scrollTop2298.4→2330.4px로 추종했다. |
| CUA-OC-SCROLL / 선택과 추종 | 본문 문장 전체를 선택한 채 맨 아래로 이동한 뒤 외부 제어로 출력을 추가해도 선택 문자열을 유지하며 바닥을 추종했다. |
| CUA-OC-SCROLL / 펼침·접기 | 화면 좌표로 탐색 카드를 직접 클릭해 펼치고 접었다. scrollTop120px, `user:1:0:text`의 상대 위치 −4.8125px가 두 조작 모두 같았다. |
| CUA-OC-SCROLL / 크기 변경 | 너비450px·글자14.5px로 변경 후 같은 행의 상대 위치 −4.8125px를 유지했다. 높이2208→2245px에 따라 scrollTop120→123.2px로 보정됐다. |
| CUA-OC-SCROLL / 세션 복귀 | A는 scrollTop1181.6px, B는0px로 구분했다. A의 비활성 출력 수신은 현재 화면 위치를 바꾸지 않았다. A/B 왕복 후 각 위치·탐색 펼침을 복원했으며 상대 위치 차이는0.025px였다. |
| CUA-OC-TODO / 진행·접힘 | 3항목 중1개 완료 목록과 대표 항목의 한 줄 요약을 전환했다. 펼친 카드 실제 높이175.6px, 하단 겹침 −36px를 관측했다. 세션 왕복 후 접힘을 유지했다. |
| CUA-OC-TODO / 완료·가림 | 혼합 요청 중 Todo가 숨고 마지막 요청 후 접힌 상태로 돌아왔다. 전체 완료3/3 표시 후 카드가 사라졌고 새 진행 목록에서 다시 나타났다. |
| CUA-OC-COLOR / 두 테마 | OpenCode와 Claude 사용자 버블의 computed 배경/글자색이 일치했다. 밝은 테마는 rgb(244,244,243)/rgb(26,26,24), 어두운 테마는 rgb(48,48,46)/rgb(240,239,234)였다. transcript 배경 변경은 없다. |

Todo의400ms 대기·300ms 퇴장과 아래 방향 translate는 직접 렌더·가짜 시계 검사로 확인했다. 브라우저에서는 전개·접힘·완료·제거 상태를 관측했으며 연속 프레임의 모션 시간을 실측했다고 주장하지 않는다.

탐색 카드의 locator 자동 클릭은 클릭 전 화면을 스크롤하여 위치가 움직이는 것처럼 보였다. 실제 화면 좌표 클릭으로 다시 검사한 결과 펼침·접기 모두 동일 앵커를 유지했다. 임시 진단 DOM 속성은 제거했다. 입력 controller 재마운트, 짧은 내부 출력의 wheel 전파, 선택된 live 행의 완료 전환, 외부 pointerup에 의한 불필요한 unpin은 구현 중 보완하고 직접 회귀 검사를 추가했다.

사용자 최종 시각 인수(AC11)와 독립 verify는 별도 대기로 유지한다.

추가 통합 관측: 과거의 `user:1:0:text`를 읽는 동안 Todo 전개→접기→Question 대체로 viewport 높이가354→207→303→142px로 변했다. 모든 단계의 scrollTop120px와 해당 행의 상대 위치 −1.6125px가 같았다. dock 높이 변경도 현재 읽기 앵커를 보존했다.


## 동일 세션의 desktop 대조와 Orca 보완 (2026-10-16, ΔV17)

Computer Use로 실행 중인 OpenCode와 Orca의 같은 native 대화를 직접 스크롤하고 도구를 펼쳤다. 설치 앱의 package.json은1.19.0이며, 설치 renderer의 기본 reasoning 설정과 tool registry·CSS도 읽었다. 제공 `.tmp/opencode-dev`는2.0.29이므로 현재 화면의 기본값을 대신하는 근거로 사용하지 않았다. 추출 자료는 ignored 임시 경로에만 두었다.

| 관측 | 수정 전 차이 / 수정 후 실제 동작 |
|---|---|
| CUA-17-01 / 추론·본문 | OpenCode는 영어 reasoning을 숨기고 한국어 응답과 도구를 순서대로 표시했다. Orca의 중간 추론 전문을 숨긴 뒤 동일 본문 순서를 확인했다. 문단·inline code·강조·heading은 OpenCode 전용 스타일로 조정했다. |
| CUA-17-02 / 파일 | OpenCode의 작성·편집은 기본 파일명 행과 편집 증감이었다. Orca도 기본 접힘으로 바꿨다. 편집 행 클릭 후 실제 `v1` 삭제·`v2 (edited)` 추가와 +1/−1을 확인했다. 원본 desktop에서는 파일 헤더까지만 관측했으므로 desktop의 diff 본문까지 보았다고 주장하지 않는다. |
| CUA-17-03 / 탐색·셸 | Orca 탐색 요약을 눌러 `Glob pattern=*.txt`, `Grep pattern=audit include=*.md`, `읽기 SKILL.md limit=5`가 들여써진 목록을 확인했다. 셸을 눌러 명령과 수신 출력, 원본 도구 입력 disclosure를 확인했다. |
| CUA-17-04 / 질문 | desktop에는 완료 질문과 `정리 (Recommended)` 답변이 있었다. Orca는 native metadata의 positional answers를 읽지 못해 비어 있었다. v1 decoder 보완 후 같은 답변이 나타났고, 헤더 클릭으로 접기·재펼침했다. |
| CUA-17-05 / 웹·task | 웹 가져오기는 URL과 외부 링크 표시, task는 Explore와 설명 pill로 표시했다. Orca의 pill을 눌러 기존 하위 에이전트 상세와 결과를 열고 닫았다. 실제 외부 링크 탐색·새 모델 실행은 하지 않았다. |

이번 직접 대조는 밝은 테마의 기존 완료 세션이다. 이전 두 테마 색상 관측은 위 r1.15에 있으며 이번에는 canvas·사용자 버블·테마 토큰을 수정하지 않았다. 라이브 추론 단독 수신의 진행 표시와 가상화 후 접힘 상태는 production renderer interaction 테스트로 확인했다. 새 실모델 호출이나 권한 승인은 없었다.
