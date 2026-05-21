# project/ — 코딩 에이전트용 가이드

데스크톱 클라이언트의 디자인 진화를 5개 버전으로 정리한 **버전 아카이브**.
**빌드 스텝 없음** (브라우저 내 Babel 트랜스파일). 픽셀 퍼펙트 *재현* 대상이지, 그대로 가져갈 production 코드가 아니다.

## 진입점

| 파일 | 역할 |
|---|---|
| `index.html` | **랜딩**. 5 버전을 카드로 나열. 각 카드 → `versions/<id>/index.html` 로 점프. 정적 호스팅 시 루트로 두면 곧바로 동작. |
| `versions/v5-orca-skin/DESIGN.md` | **시안 1차 참고서**. 사용자가 마지막 핸드오프 때 열고 있던 파일. 토큰/타이포/19 화면 카탈로그/인터랙션 패턴 전부 여기. 코드 작업 전 끝까지 읽어라. |
| `versions/v5-orca-skin/index.html` | **현재 시안 부트스트랩**. React 18 UMD + Babel CDN. 각 화면은 URL hash 라우팅. |

## 버전 채택 정책

| 디렉토리 | 상태 | 다룰 때 |
|---|---|---|
| `versions/v5-orca-skin/` | **현재 채택 (LATEST)** — Cowork 톤, 19 화면 완성본. 다크/폴더 드롭다운/아티팩트 패널/계정 드롭업/언어 서브메뉴/풀 설정 페이지 포함. | 모든 디자인 변경은 여기서 |
| `versions/v4-cowork/` | 폐기 — Cowork 레퍼런스 모사 첫 빌드 (홈 + 드롭다운 + 모달 4종). v5 의 직계 조상이라 패턴 비교용으로만 유용. | 새 기능 추가 금지 |
| `versions/v3-modern/` | 폐기 — 모던 하이브리드 (Linear/Vercel 절제된 시각 + 따뜻한 팔레트). | 비교용 보존 |
| `versions/v2-engineering/` | 폐기 — 엔지니어링 덴스 (3-컬럼 + 모노스페이스). | 비교용 보존 |
| `versions/v1-electron/` | 폐기 — Windows 11 데스크톱 mockup + BrowserWindow 컨텍스트. Electron 컨텍스트 자체는 v5 도 계승. | 비교용 보존 |

> 구 `electron/`, `variations/`, `shared/`, `styles/`, `design-canvas.jsx`, `tweaks-panel.jsx`, `styles.css`, `.design-canvas.state.json` 워크플로는 이번 핸드오프에서 폐기되었다. v5 아카이브 랜딩이 동일 역할(버전 비교)을 더 단순한 방식으로 대체. 필요 시 git 히스토리에서 복원.

## v5 구조 (현재 작업 대상)

```
versions/v5-orca-skin/
  DESIGN.md              ← 1차 참고서 (이 문서보다 우선)
  index.html             ← React/Babel 부트스트랩 + 4개 스크립트 로드
  orca-skin/
    styles.css           ← 토큰 + 라이트/다크 + 글로벌 + 유틸
    icons.jsx            ← <Icon>, <Sparkle>, <WinControls> + 60+ 패스
    shell.jsx            ← <Titlebar>, <Sidebar>, <Composer>, <Pill>
    screens.jsx          ← 홈 / 모달 / 태스크 / 아티팩트 (11 화면)
    scenarios.jsx        ← 스케쥴 / 설정 / 계정 메뉴 (8 화면)
    app.jsx              ← URL hash 라우팅 + ScreenSwitcher (19 화면)
```

## 자산

| 경로 | 무엇 |
|---|---|
| `uploads/` | 트랜스크립트(특히 chat2.md `view_image` 호출들)가 참조하는 캡처 모음. 20개 JPG, 한국어 파일명 보존(UTF-8). 시각 기준으로 사용. |

## 기술 스택

- **React 18 UMD + Babel standalone**, `<script type="text/babel" src="*.jsx">` 로 직접 로드.
- **번들러 없음. `package.json` 없음. 빌드 스텝 없음.**
- 폰트는 Google Fonts CDN (Source Serif 4 / Inter / JetBrains Mono).
- 다크모드는 `document.documentElement.dataset.theme = "dark"` 토글만으로 모든 토큰 스왑.

## 컨벤션 (v5)

DESIGN.md §8 발췌 — 새 컴포넌트 추가 시 반드시 준수:

1. **인라인 `style={{...}}` 작성.** `styles` 라는 이름의 객체는 만들지 말 것 (스코프 충돌).
2. **모든 hover/transition 은 `orca-skin/styles.css` 안의 클래스로 통합** (`.suggest-row` 등). 인라인에 hover 박지 말 것.
3. **아이콘은 항상 `<Icon name="...">`** 으로. 직접 SVG 쓰지 말고 `icons.jsx` 의 `ICONS` 객체에만 패스 등록.
4. **새 토큰** 은 기존 종이톤 팔레트 안에서 — `oklch` 임의 정의 금지. 다크 토큰도 같이 추가 (`[data-theme="dark"]`).
5. **새 화면 추가** 시: `scenarios.jsx` (또는 신규 파일) 에 컴포넌트 + `Object.assign(window, {...})` 노출 → `app.jsx` 의 `SCREENS` 배열에 `{ id, label }` 추가 → 라우팅 분기에 케이스 추가.
6. **승인 카드는 인라인 메시지가 아닌 별도 카드.** 외부 부수 효과(권한·예약) 작업은 `<ApprovalCard>` 패턴 그대로.
7. **`--rust`(`#d97757`) 는 브랜드 마크 + running 상태에만.** 액션 버튼에 함부로 칠하지 말 것.

## 외부 청중 vs 코딩 에이전트

- 핸드오프 번들 루트의 `orca-skin/README.md` (영어) — 외부 코딩 에이전트용 안내. "트랜스크립트 먼저 읽기 + DESIGN.md 끝까지 읽기" 절차의 원본.
- 이 `CLAUDE.md` (한국어) — 본 저장소 코딩 에이전트용 진입점. 충돌 시 본 문서가 최신.

## 위치 규약

- 프로토타입 종속 메모/스케치는 `project/` 안에.
- 저장소 전반의 아키텍처/엔진 전략 문서는 `docs/` 로 (참조: `docs/CLAUDE.md`).
- 사용자 의도 트랜스크립트는 `chats/` 로 (참조: `chats/CLAUDE.md`).
- 실제 React/Electron 구현체는 `app/` 로 (참조: `app/CLAUDE.md`). v5 디자인 토큰/19 화면을 `app/` 에 반영하는 작업은 별도 페이즈.
