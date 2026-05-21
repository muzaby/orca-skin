# Orca Skin (v5) — Design Document

Orca의 데스크톱 클라이언트가 Claude Cowork의 시각 언어를 그대로 받아
`Anthropic` 톤의 따뜻한 종이 톤 위에 19개 화면으로 펼쳐진 가장 완성된 빌드입니다.
이 문서는 v5의 디자인 시스템과 화면 구성을 정리합니다.

> 폴더만 `static`으로 서빙하면 됩니다. 빌드 단계 없음, 의존성 없음 (React/Babel CDN).

---

## 0. 디자인 원칙

1. **종이 위의 도구.** UI는 데스크톱 앱이 아니라 책상에 펼친 노트처럼 보이도록.
   배경은 따뜻한 크림(`#f9f6f0`), 본문은 검정이 아닌 흙빛 잉크(`#2d2a22`).
2. **선보다 여백으로 분리.** 보더는 가능한 한 얇고 흐리게.
   구역은 색조 변화 + 여백으로 끊는다.
3. **세리프 = 사람의 말.** 헤드라인, 채팅 본문, 아티팩트 본문은 Source Serif.
   UI 라벨/메타데이터는 Inter, 코드/단축키/타임스탬프는 JetBrains Mono.
4. **녹슨 동(rust)은 한 군데씩.** `--rust` (#d97757) 는 브랜드 마크와
   "running" 상태에만 쓴다. 액션 버튼에 함부로 칠하지 않는다.
5. **승인 게이트는 카드 단위.** 권한·예약처럼 외부 부수 효과가 있는 작업은
   인라인 메시지가 아니라 별도 카드로 명시적으로 띄운다.

---

## 1. 디자인 토큰

`orca-skin/styles.css` 에 모두 모여 있습니다. 라이트/다크 두 테마.

### 색

| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--bg`        | `#f9f6f0` | `#1f1c17` | 메인 캔버스, dot-grid 호스트 |
| `--bg-2`      | `#f3eee4` | `#1a1813` | 사이드바 |
| `--paper`     | `#ffffff` | `#28241d` | 카드/모달/입력 표면 |
| `--paper-2`   | `#fbf8f1` | `#211e18` | 코드 블록, 강조 박스 |
| `--line`      | `#ebe5d6` | `#383225` | 일반 보더 |
| `--line-strong` | `#ddd5be` | `#4a4234` | 호버시 강해지는 보더 |
| `--line-soft` | `#f2ecdd` | `#2c2820` | 구분선 |
| `--hover` / `--press` | `rgba(60,50,30,.04)` / `.07` | `rgba(255,245,220,.04)` / `.07` | 인터랙션 |

### 잉크 (텍스트 5단계)

`--ink`(헤드) → `--ink-2`(본문) → `--ink-3`(보조 라벨) → `--ink-4`(아이콘/disabled) → `--ink-5`(placeholder).

### 액센트

- **`--rust` `#d97757`** — 브랜드 마크 (Sparkle 8-point asterisk), 실행 중인 도구의 스피너.
- **`--good` / `--warn` / `--bad` / `--info`** — 진행 상태 점 한 군데에만.

### 그림자 / 모서리

- `--shadow-sm` 종이 (1dp)
- `--shadow-md` 카드/팝오버 (4dp)
- `--shadow-lg` 모달/드롭업 (24dp)
- 모서리: `--r-sm:6` / `--r-md:10` / `--r-lg:14` / `--r-xl:18` / `--r-pill:999`

### 레이아웃

| 토큰 | 값 |
|---|---|
| `--titlebar-h` | 44 |
| `--sidebar-w`  | 248 |
| `--right-pane-w` | 320 |
| `--artifact-w`   | 620 |

---

## 2. 타이포그래피

| 역할 | 폰트 | 크기 | 무게 |
|---|---|---|---|
| 본문 (UI) | Inter | 13.5 / 1.45 | 400-500 |
| 강조 라벨 | Inter | 13 | 600 |
| 헤드라인 (홈/태스크 제목) | Source Serif 4, italic | 32-34 | 500-600 |
| 채팅·아티팩트 본문 | Source Serif 4 | 14 / 1.65-1.7 | 400 |
| 코드/단축키/메타 | JetBrains Mono | 11-12.5 | 400-500 |

> **이탤릭 세리프 헤드라인**은 v5의 시그니처. 화면이 종이라는 인상을 가장 강하게 준다.

---

## 3. 글로벌 구조

```
┌────────────────────────────────────────────────────────────┐
│  Titlebar (드래그 영역 + 창 컨트롤)                          │ 44
├────────────┬───────────────────────────────────┬───────────┤
│            │                                   │           │
│  Sidebar   │   Main canvas                     │  Right    │
│  248       │   - dot-grid 배경                  │  pane     │
│            │   - Composer / Chat / Settings    │  320      │
│            │                                   │  (선택)    │
└────────────┴───────────────────────────────────┴───────────┘
```

- **Right pane** 는 태스크/스케쥴-대화 화면에서만 켜진다.
- **Artifact pane** (620) 은 결과물 미리보기 시 우측을 덮어쓴다.
- **Modals** 는 메인 캔버스 위에 32% 어두운 스크림으로 띄운다.
- **AccountMenu**(드롭업) 는 사이드바 하단 + 8px 위, **LanguageSubmenu** 는 그 우측에 fly-out.

---

## 4. 컴포넌트 인벤토리

### Shell (`shell.jsx`)

- **`<Titlebar>`** — 드래그 가능. 좌측 5개 아이콘(햄버거 / 사이드바 토글 / 검색 / 뒤로 / 앞으로) + 가운데 타이틀 + 우측 Win 컨트롤.
- **`<Sidebar>`** — 6개 nav 아이템 + Recents 리스트 + 계정 풋터. `active`/`recents` 만으로 모든 상태가 결정된다.
- **`<Composer>`** — 큰 둥근 입력. `large`/`rows`/`leftChips`/`rightChips` 로 컴포지션.
- **`<Pill>`** — 작은 칩 (프로젝트 선택 / 모델 / 역할 / 메타). `ghost` 변형 있음.

### Screens (`screens.jsx`)

홈 + 작업 + 모달 + 결과 + 아티팩트 — 초기 11개 화면.
공통 빌딩 블록:

- `<ChatHeader>` — 가운데 작업 제목 + 우측 패널 토글
- `<UserMsg>` / `<ClaudeMsg>` — 사용자/Claude 메시지 행
- `<ToolBlock>` — 도구 호출. `status: done | running | pending`
- `<Bash>` — 모노 코드 블록 (bash 라벨 + 색상 토큰)
- `<ApprovalCard>` — 권한 승인 게이트
- `<RightPanel>` — 진행 상황 · 작업 폴더 · 컨텍스트 3섹션
- `<ArtifactPanel>` — 우측 풀 패널 (MD 미리보기)
- `<ModalShell>` + 4종 모달 — 새 프로젝트 / 처음부터 / 가져오기 / 기존 폴더

### Scenarios (`scenarios.jsx`)

후기 추가된 스케쥴·설정 화면 — 8개.

- `<ScheduledHeader>` / `<ScheduledInfoBar>` — Scheduled 페이지 헤더
- `<ScheduleCard>` — 예약 작업 카드 (제목 + 본문 + 일정 칩)
- `<ScheduleApprovalBlock>` — `create_scheduled_task` 승인 카드
- `<ScheduledCreatedToast>` — 생성 완료 토스트 배지
- `<AccountMenu>` / `<LanguageSubmenu>` / `<MenuRow>` — 사이드바 드롭업
- `<AppearancePicker>` — system / light / dark 세그먼티드
- `<ToggleSwitch>` — 토글 (활성/절전모드 등)
- `<SettingsField>` — `라벨 | 값` 그리드 행

### Icons (`icons.jsx`)

단일 `<Icon name size color stroke>` 컴포넌트, 60+ 아이콘.
모두 24×24 viewBox, stroke 1.6, round join/cap.
`<Sparkle>` 은 4개 타원으로 합성한 8-point asterisk.

---

## 5. 화면 카탈로그 (19)

| # | id            | 이름            | 영역      | 특이사항 |
|---|---------------|----------------|----------|---|
| 01| `home`        | 홈             | 라이트   | dot-grid + Sparkle + 제안 카드 3 |
| 02| `home-dark`   | 홈 (다크)       | 다크    | 동일 구조, 토큰만 스왑 |
| 03| `home-folder` | 폴더 드롭다운    | 라이트   | "프로젝트에서 작업" pill 앵커 |
| 04| `modal-create`| 새 프로젝트 chooser | 모달 | 3행 row-btn |
| 05| `modal-start` | 처음부터 시작     | 모달    | 이름 + 지침 + 파일 + 위치 |
| 06| `modal-import`| 프로젝트 가져오기 | 모달    | 검색 인풋 |
| 07| `modal-folder`| 기존 폴더 사용   | 모달    | 폴더 피커 |
| 08| `task-init`   | 작업 시작        | 태스크  | 30초 대기 / Bash 블록 |
| 09| `task-approval` | 승인 요청      | 태스크  | `<ApprovalCard>` Allow/Deny |
| 10| `task-result` | 결과            | 태스크  | MD 링크 + "다운로드 폴더 요약" |
| 11| `task-artifact`| 아티팩트       | 태스크  | 우측 620px MD 패널 |
| 12| `sched-empty` | 스케쥴 빈 상태   | 스케쥴  | StopwatchGlyph + 추천 2 pill |
| 13| `sched-list`  | 스케쥴 목록     | 스케쥴  | Weekday brief 카드 + 절전 모드 토글 |
| 14| `sched-chat`  | 스케쥴 대화     | 스케쥴  | `create_scheduled_task` 승인 카드 |
| 15| `sched-done`  | 스케쥴 생성됨    | 스케쥴  | "예약된 작업 생성됨" 토스트 |
| 16| `sched-detail`| 스케쥴 상세     | 스케쥴  | 지침 · 일정 · 모델 · 도구 4섹션 |
| 17| `menu-account`| 계정 드롭업     | 메뉴    | 사이드바 하단 8px 위 |
| 18| `menu-lang`   | 언어 서브메뉴   | 메뉴    | 11개 언어 fly-out |
| 19| `settings`    | 설정 페이지     | 설정    | 10탭 + 일반 본문 (프로필 / 환경설정 / 알림) |

> 화면 전환은 URL hash 기반. 새로고침해도 위치 유지.
> 하단의 검은 드롭다운 (ScreenSwitcher) 으로 19개 화면을 직접 점프.

---

## 6. 인터랙션 패턴

### 6.1 승인 게이트

권한이 필요한 작업은 메시지 인라인이 아니라 **카드** 로 분리.

```
┌─ Claude가 다음에서 Cowork하려고 합니다: ────────────┐
│ C:\Users\rlaeo\Downloads                          │
│                                                   │
│              [거부 Esc]  [허용 Enter]               │
└────────────────────────────────────────────────────┘
```

같은 패턴이 `task-approval`(폴더 권한) 과 `sched-chat`(예약 작업 생성) 에 동일하게 적용.
버튼은 항상 우측 정렬, 단축키 칩(`.kbd`) 동반.

### 6.2 진행 상황 추적

오른쪽 패널의 step 리스트는 `done` 이면:
- 동그라미 배경이 파란색(`--info`) + 체크
- 라벨에 흐린 취소선 (`text-decoration-color: var(--ink-4)`)

진행 중인 step 은 외곽선 동그라미 + 번호 + 정상 잉크.

### 6.3 작업 상태 표기

- **활성 일정 칩** — `rgba(94,158,92,.16)` 배경 + `#3a6e3a` 텍스트.
  scheduled-list 와 sched-detail 양쪽에서 동일하게 등장.
- **running 도구 블록** — `--rust` 스피너 (1.6px border-top transparent).
- **대기열 칩** — 모서리 둥근 회색 pill + 아래 화살표 아이콘.

### 6.4 빈 상태

- **Scheduled empty** — StopwatchGlyph (인라인 SVG) + 추천 두 pill(Daily brief / Weekly review).
  "More ideas" 라벨 아래 같은 두 pill 이 list 상태에도 반복 등장 → 학습 가능한 entry.

### 6.5 다크 모드 전환

`document.documentElement.dataset.theme` 만 토글. `[data-theme="dark"]` 셀렉터로
모든 토큰이 한 번에 스왑. `home-dark` 화면 활성 시 자동 적용.

---

## 7. 파일 구조

```
v5-orca-skin/
  index.html              ← React/Babel 부트스트랩 + 4개 스크립트 로드
  orca-skin/
    styles.css            ← 토큰 + 글로벌 + 유틸
    icons.jsx             ← <Icon>, <Sparkle>, <WinControls> + 60+ 패스
    shell.jsx             ← <Titlebar>, <Sidebar>, <Composer>, <Pill>
    screens.jsx           ← 홈 / 모달 / 태스크 / 아티팩트 (11 화면)
    scenarios.jsx         ← 스케쥴 / 설정 / 계정 메뉴 (8 화면)
    app.jsx               ← 화면 라우팅 + ScreenSwitcher
```

빌드 도구 없이 `<script type="text/babel">` 로 즉시 컴파일.
운영 호스팅에 부담을 줄이려면 한 번 트랜스파일해서 prod 빌드 만들면 됩니다.

---

## 8. 확장 가이드

### 새 화면 추가

1. `scenarios.jsx` (혹은 신규 파일) 에 컴포넌트 정의 + `Object.assign(window, {...})` 노출.
2. `app.jsx` `SCREENS` 배열에 `{ id, label }` 추가.
3. `App()` 의 라우팅 분기에 케이스 추가.
4. 화면이 우측 패널을 쓰면 `<RightPanel steps={...}/>` 와 `panelOpen` props 활용.

### 새 토큰 추가

- 색은 항상 `oklch`로 정의하지 말고 기존 종이톤 팔레트 안에서.
- 다크 토큰도 같이 추가 (`[data-theme="dark"]`).
- 채도 살짝 + 명도 차이로 구분 — 너무 떠 보이지 않게.

### 컴포넌트 작성 규칙

- 인라인 style 으로 작성. `styles` 라는 이름의 객체는 만들지 않음 (스코프 충돌).
- 모든 hover/transition 은 styles.css 안의 클래스(`.suggest-row` 등) 로 통합.
- 아이콘은 직접 SVG 쓰지 말고 `<Icon name="...">` 으로.
- 패스 추가 시 `icons.jsx` 의 `ICONS` 객체에만 등록.

---

## 9. 알려진 한계

1. **고정 1280×820 캔버스가 아님.** v5 는 뷰포트 100% 를 그대로 채움.
   다른 버전(v1-v4)은 데스크톱 데모를 위해 1280×820 윈도우 안에 들어 있다.
2. **다국어 i18n 분리 안 됨.** 한국어 카피가 컴포넌트에 직접 박혀 있음.
3. **Claude Code 탭** 은 시각적 슬롯만 있음 — 실제 화면은 미구현.
4. **단축키** 는 표기만 — 실제 키 바인딩은 안 걸려 있음.
5. **Tweaks 패널 미통합** — 다크/라이트 토글, 액센트 색 등 사용자 토글이 노출 안 됨.
   추후 `tweaks_panel.jsx` 로 추가 가능.

---

*Last updated: 2026-05-17*
