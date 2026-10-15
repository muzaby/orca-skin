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
