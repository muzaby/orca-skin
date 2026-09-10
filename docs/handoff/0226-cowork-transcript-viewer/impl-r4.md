# 구현 보고 — 리팩토링과 Material 버튼 통일

Delta V5의 AC32~35를 구현하고 자기검증했다. 같은 화면 조작을 공통화하고 카드 UI·세션 구독·비동기 액션·파일 내보내기의 책임을 분리했다. 기존 제품 동작과 IPC·DB·OS 임시 폴더 정책을 유지한다. 독립 verify는 pending이다.

## 설계 리뷰

D-28/29의 범위에서 `CatalogTabs`·`CatalogSearch`·`PanelControls`를 shared에 두고 카탈로그 순서·선택 데이터·뷰어 요청 수명은 각 feature에 남겼다. 카드 오류를 가져오기 위해 UI 파일을 import하던 경로는 `artifactFeedback`으로 옮겼다. `RightPanelColumn`의 안정된 열/타일 key와 평탄한 자식 배열을 유지했다.

Main은 사용되지 않는 `TextExtractor`를 제거하고 실제 제한 읽기 이후의 BOM/NUL 처리를 검사한다. 내보내기 목적지 검증·동명 저장·원본을 덮어쓰지 않는 교체는 `features/artifacts/export-files.ts`로 이동했다. 정책이 다른 첨부 디코딩과 아티팩트 미리보기 읽기를 합치지 않았다. 추가 PLAN_GAP은 발견하지 않았다.

## 강제 지점 전수와 V-pair 자기확인

| AC | 자기 판정 | 이번 턴 직접 관측 |
|---|---|---|
| AC32 | ✅ SELF_PASS | 공통 Material 펼치기/복원·닫기, 타일 대상 ARIA. GitContextBar 렌더 18개 및 Code native 20개. 출력 카드·diff의 file_open과 실제 reveal 인자 관측 |
| AC33 | ✅ SELF_PASS | 최종 순서 7개, project native 153개·plugin native 107개. 탭 방향키/Home/End·검색 Escape·초점·총계·고정/생성 흐름 |
| AC34 | ✅ SELF_PASS | viewer 액션 14개와 카드 구독 수명, panel native 128개. 복사/저장 성공·오류·취소·중복 잠금·선택/닫기 후 지각 완료 |
| AC35 | ✅ SELF_PASS | 첨부 실제 normalizeAttachments와 기존 파일/IPC 영향 검사 37개. BOM/NUL·상한·원본 보존·동명 충돌·하드링크·실패 정리 |

검산: ✅ 4 · ⚠️ 0 · ❌ 0 = Delta V5의 AC32~35 총 4. `Criteria-Met: 4/4`는 이번 델타의 자기보고이며 이전 V1~V4의 독립 판정을 합산하지 않는다.

| EP | 확인 지점 | 관측 / 남긴 지점 |
|---|---|---|
| EP22 4/4 | ArtifactViewer·ExtensionDetailPane·RightPanelTile(task/plan)·GitContextBar | 각 native의 확대→전체 host→원폭 복원·닫기. 렌더에서 named ARIA 확인 / 없음 |
| EP23 5/5 | project/artifact/plugin 탭, project/artifact 검색 | project/plugin native에서 실제 키보드·검색어 필터·닫기 후 초점 확인 / 없음 |
| EP24 3/3 | skill·MCP·provider 순서 | catalogOrder의 source 동률·연속성·활성 우선·kind 순서·입력 불변 검사 / 없음 |
| EP25 4/4 | 단일 카드·세션 묶음·viewer copy·viewer save | 카드 메뉴 콜백·구독 해제·동시 클릭·deferred 완료·native 피드백 / 없음 |
| EP26 4/4 | 첨부 decode·export 목적지·동명 저장·안전 교체 | actual normalizeAttachments와 handler→export-files 실파일 검사 / 없음 |
| EP27 2/2 | ArtifactCard reveal·FileDiffSection reveal | native의 공식 file_open path 및 각각 publication ID / 절대 파일 경로+reveal mode / 없음 |

지점 탐색은 `rg 'onToggleExpand|viewer:expand|extension-detail:expand|data-diff-expand-panel|mode: .reveal.|onAction\(artifact, .reveal.\)' app/src/renderer/src/features`와 카탈로그 tablist/search 진입점에서 시행했다. EP22~27에 열거된 22지점을 위 행동 관측에 대조했다.

| V-pair | 자기 판정 / 직접 증거 |
|---|---|
| VP61 / R32↔AT32 | SELF_PASS — 공통 버튼 렌더와 Code/panel/plugin native의 동작·SVG |
| VP62 / R33↔AT33 | SELF_PASS — project/plugin native의 검색·탭·초점·필터 |
| VP63 / R34↔AT34 | SELF_PASS — 카드·뷰어 수명 검사와 panel native |
| VP64 / R35↔AT35 | SELF_PASS — 실제 첨부·내보내기 파일/IPC 검사 |
| VP65 / AR8↔IT8 | SELF_PASS — 실제 페이지→shared controls, viewer→hook, IPC→export-files 소비 경로 |
| VP66 / MD10↔UT10 | SELF_PASS — 최종 순서·지각 Promise·실제 첨부 decode |
| VP67 / REGRESSION | SELF_PASS — Code/panel native의 동일 DOM·원폭·가로/세로 스크롤·Composer 초안 |
| VP68 / REGRESSION | SELF_PASS — 카드/선택/저장·HTML 격리·Markdown/코드/이미지·실파일 검사 |
| VP69 / REGRESSION | SELF_PASS — project/plugin native의 nav·경로·고정·최근·지침·상세 전환/모달 |

## 이번 라운드 수정의 잠금

선택 적대 증거 0 · 인용 변이 0 · 새 구조적 proxy oracle 0 = 변이 표 0행. 해당 없음 — 직접 oracle을 사용한다.

공통 버튼 변경 전에 공식 SVG·공통 문구 기대값으로 GitContextBar 렌더 검사를 실행해 2건 red를 확인했고 구현 후 18개가 통과했다. 순서/뷰어의 동작 보존 사례는 기존 구현에서 먼저 실행한 뒤 동일 단언을 새 모듈에 연결했다. 삭제한 그룹 내부모델 검사는 최종 행 순서 검사로 대체했으며 source 동률/연속성도 포함한다.

## Product/UX 파생 검토

공통 버튼 리뷰에서 타일 대상명이 접근성 이름에서 빠진 회귀를 발견했다. `targetLabel`을 받아 공통 툴팁과 별도로 계획·작업을 식별하도록 수정했고 독립 재리뷰와 타일 렌더 검사를 통과했다. 닫기 ref·data marker·compact/small 크기를 보존하고 케밥 tooltip은 공통 더 보기로 맞췄다.

기존 Work 타일 검사 하나가 과거의 “확대 제거”를 기대했다. 변경 전 이미 실패함을 확인하고 현재 ACTIVE 확대 계약에 맞게 수정했다. 실제 Work/Code 확대는 native에서 각각 확인했다. 새 사용자 경고나 승인 단계를 추가하지 않았다.

## 놓친 잠재 문제와 대응

뷰어 공통 executor 초안의 중첩 await가 완료 피드백 시점을 바꿔 기존 검사 3건이 실패했다. 실제 작업 Promise를 한 번 기다린 뒤 현재 요청에만 피드백을 적용하도록 정리했고 14개 액션 검사가 통과했다. CatalogSearch의 refs 객체 전체 전달은 lint가 ref 접근으로 판단해, props 경계에서 필드를 구조분해했다. 규칙 우회는 추가하지 않았다.

Main export 함수는 본문을 그대로 이동했고 실제 소비 경로를 재검사했다. renderer만 검토한 동료 리뷰에서 접근성 수정 외 추가 Critical/Important는 발견되지 않았다. 기존 제품 계약이 바뀌거나 남은 차단 항목은 없다.

## 구현 보고와 게이트

| 게이트 | 관측한 산출 |
|---|---|
| 최종 통합 Vitest | 20파일 130/130, exit 0. Main 첨부/내보내기, 카드/뷰어/패널, 카탈로그/route/i18n 포함 |
| 추가 영향 검사 | panel 11파일 55/55, catalog 6파일 27/27, Main 4파일 37/37. 통합 검사와 중복되므로 합산하지 않음 |
| 타입 | node·web·test 모두 exit 0. 최종 공통 i18n/버튼 변경 후 web/test 재확인 |
| ESLint / Prettier | 변경된 존재하는 app/src 소스 전체 exit 0 / All matched files use Prettier code style |
| Electron build | main/preload/renderer 빌드 exit 0. 기존 SubAgentTileContent 정적·동적 import 경고 유지 |
| 문서/테스트 운영 | doc inventory 및 상대 링크, real-git test budget, diff whitespace 통과 |

| 실제 Electron | 결과와 증거 |
|---|---|
| 프로젝트·nav·검색 | [153/153](evidence/r4-project-native-result.json), [소스 manifest](evidence/r4-project-native-manifest.json) |
| 플러그인 상세 | [107/107](evidence/r4-plugin-panel-result.json), [소스 manifest](evidence/r4-plugin-panel-manifest.json) |
| 출력 카드·뷰어·Work 패널 | [128/128](evidence/r4-panel-native.json), [소스 manifest](evidence/r4-panel-manifest.json) |
| Code 변경사항 | [20/20](evidence/r4-code-panel-native-result.json), [소스 manifest](evidence/r4-code-panel-native-manifest.json) |

Native 합계 408개 관측 통과. 각 fixture의 runtime/console/외부 HTTP 요청은 0이며 production 모듈과 CSS의 SHA를 기록했다. 숨긴 Electron·임시 userData·모의 IPC를 사용했고 사용자 DB·클립보드·저장소 파일을 조작하지 않았다. 실제 provider/클라우드 크론 재실행과 DB migration은 비영향 범위다. native는 레이아웃·상호작용 검증이며 독립 handoff verify를 대체하지 않는다.

대표 화면: [Code 확대](evidence/r4-code-panel-native-expanded.png). 프로젝트·플러그인·뷰어의 넓은/좁은 화면과 white/dark·HTML·코드·이미지 캡처를 직접 확인했다.

## Review Signals

현재 r4. 이번 요청은 리팩토링과 아이콘 일관성이며 이전 제품 결정을 추가 변경하지 않았다. D-29에 있던 대상명 보존은 공통화 초안에서 빠졌고 리뷰에서 회복했다. native 환경 제약을 사용자 실기로 넘기지 않았으며 ABI를 전환하지 않았다. handoff 지침·SKILL 변경은 없고 기존 r1~r3의 독립 verify pending을 승계한다.
