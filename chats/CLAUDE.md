# chats/ — 코딩 에이전트용 가이드

이 디렉토리는 **사용자 의도의 원천**이다. `project/` 의 HTML 산출물을 보기 *전에* 먼저 읽어라. 출력물은 *결과*고, 여기 있는 트랜스크립트가 *왜 그 결과가 나왔는지* 를 담는다.

## 인벤토리

| 파일 | 언어 | 형식 | 분량 | 주제 |
|---|---|---|---|---|
| `chat1.md` | 한국어 | Claude Design 핸드오프 트랜스크립트 (도구 호출 + 내러티브 요약) | ~417 줄 | 초기 Electron 데스크톱 앱 디자인 → Cowork 스타일 확장 → orca 디자인 첨부 기반 구현 지시까지 |
| `chat2.md` | 한국어 | 후속 Claude Design 핸드오프 (v5 Orca Skin 빌드아웃) | ~388 줄 | Chat/Cowork/Code 탭 제거 + 스케쥴 5 시나리오 + 설정 3 시나리오 → 19 화면 v5 완성 |

## 읽는 법

- 도구 호출은 `_[tool: name]_` 마커로 구분된다 (`snip`, `read_file`, `write_file`, `str_replace_edit`, `view_image`, `fork_verifier_agent` 등). 본문이 아니므로 의도 추출 시 무시 가능.
- 사용자 발화의 **결정 키워드**: "A로 진행", "확정", "OK", "Continue", "Apply comment" 같은 짧은 응답이 최종 결정 신호다. 어시스턴트의 긴 제안보다 이런 짧은 사용자 응답이 진실에 가깝다.
- 한국어 트랜스크립트지만 코드/UI 라벨은 영어 혼용. 도메인 용어(SNR, dark current, Bayer→RGB 등)는 그대로 사용.
- 트랜스크립트는 **시간 순서**로 누적된다. 후반의 결정이 전반의 결정을 *덮어쓴다*. chat1 전반의 "Variation A 채택" 은 chat1 후반·chat2 의 "v5 Orca Skin" 으로 이미 갱신됨에 유의.

## chat1 + chat2 통합 최종 결론

| 항목 | 결정 |
|---|---|
| 디자인 방향 | **v5 · Orca Skin (Claude Cowork 톤)** 채택. 초기 Variation A "Claude Desktop classic" 은 폐기 — `project/versions/v5-orca-skin/` 가 진실. |
| 화면 구성 | **19 화면** — 홈(라이트/다크/폴더 드롭다운) · 모달 4(새 프로젝트 chooser/처음부터/가져오기/기존 폴더) · 태스크 4(시작/승인/결과/아티팩트) · 스케쥴 5(빈/목록/대화/생성됨/상세) · 메뉴 2(계정 드롭업/언어 서브) · 설정 1 |
| 글로벌 구조 | **3-페인** — Sidebar 248 + Main + RightPanel 320 (선택), 또는 Artifact 620 (우측 덮어쓰기). Titlebar 44. v1 의 듀얼-페인(채팅+카메라)은 폐기. |
| 우측 패널 토글 | 채팅 헤더 우측에 동일 family 의 chip 버튼들 — 검색 · 하드웨어 · 아티팩트 · 설정 (chat1 후반 결정). 누른 상태로 활성 표시 (Claude artifact 토글과 동일 패턴). |
| 시각 언어 | 따뜻한 크림 종이톤(`#f9f6f0`) + 흙빛 잉크. 세리프(Source Serif 4 italic) = 사람의 말. UI 라벨 Inter, 코드 JetBrains Mono. 보더보다 여백·색조로 구역 분리. |
| 액센트 사용 | `--rust #d97757` 는 브랜드 마크(Sparkle 8-point asterisk) + running 상태에만. 액션 버튼 색칠 금지. |
| 승인 게이트 | 인라인 메시지가 아닌 **별도 카드**(`<ApprovalCard>`). 동일 패턴이 task-approval(폴더 권한) · sched-chat(`create_scheduled_task`) 양쪽에 적용. 단축키 칩 동반(Esc/Enter). |
| 다크 모드 | `document.documentElement.dataset.theme="dark"` 토글만으로 모든 토큰 스왑. `home-dark` 화면에서 자동 적용. |
| 설정 페이지 | 10-탭 풀 페이지 — 일반·외관·단축키·**엔진&모델**·Skills/MCP·시스템 프롬프트·카메라 보드·캡처·개인정보·업데이트·정보. 엔진 추가 다이얼로그(Base URL + API 키, DPAPI 마스킹, 4 유형: Claude Code/OpenCode/OpenAI-호환/로컬). |
| VOC 입력 | 타이틀바 우측 "🎤 피드백" 버튼(Ctrl+/), 슬라이드-인 패널 — 만족도·카테고리·본문·첨부·익명 토글·사내 JIRA 전송. 대안 진입점: 정보 페이지·도구 실패 시 신고·시스템 트레이. |
| 스케쥴 흐름 | 빈 상태(StopwatchGlyph + 추천 2 pill) → 목록(Weekday brief 카드 + 절전 토글) → 대화(`create_scheduled_task` 승인 카드) → "예약된 작업 생성됨" 토스트 → 상세(지침/일정/모델/도구 4섹션). |
| 셸 | Electron frameless BrowserWindow + Windows 11 mockup 컨텍스트 (v1 컨텍스트는 유지). v5 자체는 뷰포트 100% — 고정 1280×820 캔버스 아님. |
| Tweaks 패널 | v5 에서 **의도적 미통합**. DESIGN.md §9 참조 — 후속 `tweaks_panel.jsx` 추가 가능. 구 `project/tweaks-panel.jsx` 는 삭제됨. |

## 에이전트 원칙

1. **HTML 만 보고 구현하지 마라.** `project/versions/v5-orca-skin/` 산출물은 *결과물* 이다. 트랜스크립트의 *왜* 와 `DESIGN.md` 의 시스템 규칙을 확인한 뒤 구현하라.
2. **트랜스크립트와 현재 코드가 모순되면 사용자에게 물어라** — 코드만 또는 문서만 일방적으로 바꾸지 말 것. 어느 쪽이 진실인지 결정해야 한다.
3. **새 트랜스크립트가 추가되면 위 인벤토리 표를 갱신하고**, 결정이 뒤집혔다면 그 사실을 명시 (chat1 → chat2 사이의 Variation A 폐기처럼).
4. 트랜스크립트는 **요약·번역·재포맷하지 마라**. 원문 그대로 보존이 의도 추출에 가장 안전하다. (이 문서의 "통합 최종 결론" 표는 *발췌 인덱스* 일 뿐, 원문 대체가 아니다.)
