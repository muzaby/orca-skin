# 0226 리팩토링 및 공통 버튼 — Delta V5

READY · 작성 Codex · 2026-09-10 · 기준 `c02610ba`의 V1~V4. 기존 동작은 [plan.md](plan.md)의 ACTIVE 결정이 정본이다. 사용자 요청에 따라 같은 0226에서 r4를 진행한다.

## 결정과 범위

| 결정 | 출처 / 결과 |
|---|---|
| D-28 ACTIVE | “리팩토링…모듈화, 재사용, 간소화” — 반복되는 카탈로그 조작과 패널 조립을 공유하고 UI·비동기 액션·파일 작업의 책임을 분리한다. |
| D-29 ACTIVE | “비슷한, 같은 버튼은 아이콘을 통일…구글 메테리얼 svg” — 같은 역할은 공통 버튼과 Material Symbols Outlined SVG를 사용한다. 패널 펼치기/복원/닫기의 표시 라벨도 공통화한다. 대상 이름이 필요한 접근성 이름은 보존한다. |

동작 보존 리팩토링이 기본이며 D-29의 아이콘·버튼 문구만 표시 변경이다. 새 의존성·DB migration·IPC 스키마·출력 수집 정책·인증 및 HTML 격리 변경은 없다. 최근 대화 복구, 프로젝트 경로·고정·자동 펼침, 출력과 아티팩트 구분, 메모 독립 표시를 유지한다.

검토한 대안: 범용 store/패널 프레임워크는 서로 다른 요청·route 수명과 권한 정책을 억지로 합친다. 파일을 크기만으로 자르는 방식은 중복을 줄이지 못한다. 실제 중복 조작을 공유하고 한 파일에 섞인 책임만 분리하는 안을 선택한다.

## AS-IS → TO-BE

| 현재 근거 | 변경 / 소유자 |
|---|---|
| ProjectsScreen·ArtifactsView·CustomizeTabs가 같은 tab ARIA/방향키/스타일 반복, 앞의 두 화면이 검색 초점/Escape 반복 | shared `CatalogTabs` 및 작은 카탈로그 검색 hook/UI. 필터·총계·생성·삭제·선택 데이터는 feature에 유지 |
| CustomizeList는 그룹을 만든 직후 rows를 flatMap. 그룹 제목·빈 그룹 모델은 표시되지 않음 | skills 내부 순수 `catalogOrder`로 최종 순서만 반환. 스킬 source의 동률/연속성, 활성 MCP 우선, provider kind 순서 유지 |
| ArtifactCard는 단일 카드·세션 구독 묶음·오류 메시지 매핑 혼재, viewer가 오류 하나 때문에 UI 파일 import | `ArtifactCard`/`ArtifactCards`, `lib/artifactFeedback`로 분리. import edge를 실제 책임에 연결하고 호환 배럴은 만들지 않음 |
| ArtifactViewer copy/download가 busy·피드백·현재 요청 확인을 반복 | `useArtifactViewerActions(selection)`에서 단일 실행 잠금과 요청 수명 처리. UI는 액션 상태·명령을 소비 |
| RightPanel이 separator·열/행 애니메이션·타일 조립·viewer host 수명 모두 포함 | 같은 feature의 `PanelResizeSeparators`, `RightPanelColumn`, 순수 `rightPanelViewport`로 분리. column/tile key와 평탄한 자식 배열 유지 |
| 패널 확장 버튼 4곳이 같은 icon과 다른 문구를 반복 | shared `PanelExpandButton`/`PanelCloseButton`, 공통 i18n 라벨. viewer·extension·task/plan·Code diff에 적용. compact/small 크기와 기존 data marker 유지 |
| 출력 카드의 탐색기 열기는 folder, diff 파일 열기는 arrowNE | 같은 파일 reveal 동작에 Material `file_open` 적용. 디렉터리를 여는 folder와 외부 링크를 여는 north_east는 역할에 맞게 유지 |
| TextExtractor.extract는 실제 첨부 경로에서 미사용, NUL/BOM 처리가 실제 경로에도 존재 | 클래스·옛 전체 파일 읽기 제거. 제한 읽기 후 현재 첨부 디코딩 한 경로만 유지 |
| artifact IPC 등록 파일에 내보내기 경로 검증·동명 파일 저장·안전 교체가 섞임 | 같은 artifact feature의 `export-files`로 이동. IPC는 sender·dialog·ID 재검사·DTO 조립만 담당 |

Material 원본은 [Google 저장소](https://github.com/google/material-design-icons)의 `symbols/web/<glyph>/materialsymbolsoutlined/<glyph>_24px.svg`를 확인한다. 펼치기=`open_in_full`, 복원=`close_fullscreen`, 닫기=`close`, 더보기=`more_vert`, 고정=`push_pin`, 파일 탐색=`file_open`, 복사=`content_copy`, 다운로드=`download`, 재조회=`refresh`, 미리보기=`visibility`, 코드=`code`를 기존 `Icon` SVG 진입점에서 재사용한다. 자체 그린 확대/복원 경로는 공식 원본으로 교체하고 실제 렌더로 확인한다.

## 인수 기준과 Delta V

| AC / R·AT | 사용자 관측 / 직접 oracle |
|---|---|
| AC32 / R32·AT32 NEW | 같은 역할의 패널 버튼이 같은 SVG·표시 라벨을 갖고 펼치기→host 전체→복원→닫기, 파일 열기 메뉴가 기존 동작을 실행한다. 실제 버튼 DOM/콜백·native 화면 |
| AC33 / R33·AT33 NEW | 카탈로그 두/세 탭, 방향키/Home/End, 검색 열기/Escape/초점, 필터·총계·생성/고정 후 초점이 동일하게 동작한다. 최종 행 순서와 native 사용자 흐름 |
| AC34 / R34·AT34 NEW | 출력 단일/묶음 카드와 뷰어 복사/저장·취소/오류·닫기/전환 후 지각 완료 무시가 유지된다. 기존 수명 테스트와 deferred 액션 |
| AC35 / R35·AT35 NEW | 첨부 BOM/NUL·Temp 사본·상한/원본 보존 및 artifact 내보내기 동명 충돌/하드링크/실패 정리가 실제 production 경로에서 유지된다. 실파일 테스트 |

| EP | 강제 지점 / N | 실패 의미 |
|---|---|---|
| EP22 | viewer·extension·task/plan tile·diff header 확장/닫기 / 4 | 같은 역할 문구/자원이 달라지거나 props 전달·복원 소실 |
| EP23 | project·artifact·plugin 탭 및 project/artifact 검색 / 5 | ARIA 연결·방향키·Escape/초점·총계 소실 |
| EP24 | skill·MCP·provider 순서 / 3 | 동률 source가 섞이거나 입력을 mutate |
| EP25 | 단일 카드·세션 묶음·viewer copy·viewer save / 4 | 다른 선택 결과가 남거나 저장 대상·상태 구분 소실 |
| EP26 | 첨부 실제 decode·export 목적지·동명 저장·안전 교체 / 4 | 우회 읽기·원본 변경·중간 실패 잔여 |
| EP27 | 출력 카드 reveal·diff 파일 reveal / 2 | 같은 파일 작업의 잘못된 아이콘 또는 경로 콜백 변경 |

| Pair | 노드 / requiredness | 경로 / oracle |
|---|---|---|
| VP61~64 | NEW R32~35↔AT32~35 / REQUIRED | 각 AC 직접 동작, EP22~27 해당 지점 |
| VP65 | NEW AR8↔IT8 / REQUIRED | 세 카탈로그→공통 controls→기존 필터/선택, 카드/viewer→feature hook/lib, IPC→export-files; 실제 소비 경로 테스트 |
| VP66 | NEW MD10↔UT10 / REQUIRED | 최종 catalog 순서·viewer 액션의 중복 잠금/요청 소유권·첨부 decode; 순서/지각 Promise/실파일 oracle |
| VP67 | INHERITED R9·R31↔AT9·AT31 / REGRESSION | 분리된 열/타일→공통 pane→resize/전체 확대/원폭/스크롤/초안 유지 |
| VP68 | INHERITED R3~8·R10~11↔해당 AT / REGRESSION | 출력 선택·소유권·preview 격리·save-all·기존 카드와 늦은 결과 |
| VP69 | INHERITED R19~30↔해당 AT / REGRESSION | nav/프로젝트/cwd/최근·카탈로그 순서·총계·플러그인 상세/모달·초점 |

선택 적대 증거: 없음. 행 순서·실행된 콜백·지각 Promise·실파일·실제 화면으로 직접 검증한다. 분리 파일 수/호출문 수로 동작을 대신 증명하지 않는다. 이번 비영향인 DB migration·스케줄 프로토콜·런타임 admission은 기준 V를 승계하고 전면 재검증은 NOT_REQUIRED다.

## 구현 작업 목록

- [ ] 카탈로그: 기존 행동 테스트 baseline → 공유 tabs/search → 최종 순서 helper → 영향 테스트/native.
- [ ] 출력/패널: 카드·피드백·액션 hook·열 조립 분리 → 기존 imports 직접 갱신 → 수명/폭 회귀.
- [ ] Main: 실제 normalizeAttachments로 BOM/NUL 사례 이동 → 죽은 추출기 제거 → export-files 분리 → 실파일·IPC 회귀.
- [ ] 버튼: 기존 렌더 테스트에 동일 역할 기대값 → 공식 SVG 및 공통 panel controls → 모든 EP22/27 소비처 대조.
- [ ] 통합: 코드 리뷰 → main/web/test 타입, 변경 소스 ESLint/Prettier, 영향 Vitest, Electron native, build, doc inventory/test budget/whitespace → 문서·INDEX·커밋·푸시.

## 운영 / READY 검토

기존 공유 브랜치에서 이어간다는 사용자 맥락에 따라 현재 checkout을 사용한다. 4-layer/feature DAG, OS Temp SSOT, 각 파일 읽기의 서로 다른 검증 정책을 유지한다. UI 리팩토링 baseline은 기존 r3 native fixture를 재사용하고 새 r4 결과를 별도로 기록한다. 테스트 파일명은 계약이 아니며 행동 단언을 이동한 뒤 다시 실행한다.

`handoff-review`는 r4 진입에 따른 DIAGNOSE_ONLY: 사용자 후속 레이아웃/경로 정정은 D(결정 변경), 이번 아이콘 일관성은 F(공유 구현 누락)로 본다. 현재 renderer 가이드의 공통 UI·기존 §15의 재사용 계약이 충분하므로 SKILL/AGENTS를 수정하거나 과거 corpus를 추가하지 않는다. 독립 verify pending을 자기확인 PASS로 바꾸지 않는다.

READY self-review: D-28/29→AC32~35→VP61~69→EP22~27의 경로를 대조했다. 외부 계약이나 제품 정책 선택 없이 현재 동작을 유지하는 구현 경계가 확정되었다.
