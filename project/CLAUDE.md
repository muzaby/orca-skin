# project/ — 코딩 에이전트용 가이드

프로토타입 자산 루트. **빌드 스텝 없음** (브라우저 내 Babel 트랜스파일). 픽셀 퍼펙트 *재현* 대상이지, 그대로 가져갈 production 코드가 아니다.

## 진입점

| 파일 | 역할 |
|---|---|
| `electron/index.html` | **본 시안.** 핸드오프 시 사용자가 열고 있던 파일. Variation A 가 Electron + Windows 11 컨텍스트에 박혀있다. 새 기능을 구현할 때의 기준점. |
| `index.html` | 디자인 캔버스(피그마 류 메타 도구). v1/v2/v3 variation 을 한 화면에 비교 용도로 띄운다. **프로덕션 시안 아님.** |

## 변형 정책

| 디렉토리/파일 | 상태 | 다룰 때 |
|---|---|---|
| `variations/v1-shell.jsx`, `v1-screens.jsx` | **채택 (A · Claude Desktop classic)** | 모든 디자인 변경은 여기서 일어난다 |
| `variations/v2-shell.jsx` | 폐기 (B · 엔지니어링-덴스) | 캔버스 비교용으로만 보존. 새 기능 추가 금지 |
| `variations/v3-shell.jsx` | 폐기 (C · 모던-하이브리드) | 캔버스 비교용으로만 보존. 새 기능 추가 금지 |

## 공유 자산

| 경로 | 무엇 |
|---|---|
| `shared/atoms.jsx` | 재사용 컴포넌트 (V1.* 아이콘, 버튼, 패널). 모든 variation 이 import. |
| `styles/tokens.css` | CSS 커스텀 프로퍼티 토큰 (cream/ink/rust/moss/indigo/rose/slate 팔레트, Source Serif 4 / Inter / JetBrains Mono 폰트). |
| `styles.css` | 전역 스타일 + 다크모드 오버라이드. |
| `tweaks-panel.jsx` | Tweaks UI. **Tweaks 값은 CSS 커스텀 프로퍼티로 주입되어 시각 변환을 만든다.** |
| `design-canvas.jsx` | 캔버스 셸 (아트보드 드래그/풀스크린/상태 영속). |
| `.design-canvas.state.json` | 캔버스 섹션·라벨 영속 (전이 UI 상태). 수동 편집 금지. |
| `electron/electron-mockup.jsx` | Electron renderer 구조·코드 샘플 참고용 mockup. |
| `electron/architecture.html` | IPC 채널, 프로세스 모델 레퍼런스. |

## 기술 스택

- **React 18 UMD + Babel standalone**, `<script type="text/babel" src="*.jsx">` 로 직접 로드.
- **번들러 없음. `package.json` 없음. 빌드 스텝 없음.**
- 폰트는 Google Fonts CDN.
- 다크모드는 CSS 커스텀 프로퍼티 오버라이드 (`--cream-0` → `#1c1a16`, `--ink-900` → `#f0eadd` 등).

## 컨벤션

1. **새 컴포넌트도 같은 패턴으로 추가** — `.jsx` 를 `<script type="text/babel">` 로 로드. 별도 빌드/번들러 도입은 사용자에게 먼저 확인.
2. **Tweaks 적용은 항상 CSS 커스텀 프로퍼티 경유.** 인라인 스타일에 다크모드 색을 하드코딩하지 말 것 — Tweaks 가 깨진다.
3. **픽셀 퍼펙트 재현은 *타깃 기술* (React/Vue/Native/...) 에서 한다.** 이 prototype 의 내부 구조를 그대로 가져가지 말 것 (루트 `README.md` 의 원칙과 동일).
4. **`.design-canvas.state.json` 은 손대지 말 것** — 캔버스 UI 가 자동 갱신한다.

## 위치 규약

- 프로토타입 종속 메모/스케치는 `project/` 안에.
- 저장소 전반의 아키텍처/엔진 전략 문서는 `docs/` 로 (참조: `docs/CLAUDE.md`).
- 사용자 의도 트랜스크립트는 `chats/` 로 (참조: `chats/CLAUDE.md`).
