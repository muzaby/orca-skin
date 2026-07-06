# Plan — 0076-menu-material-icons

## 메타

| 항목 | 값 |
|---|---|
| slug | `0076-menu-material-icons` |
| 작성자 | Claude Code |
| 일자 | 2026-07-06 |
| 매핑 | PHASES 행 (승격 예정) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "메뉴에 사용되는 모든 아이콘들을 구글 메테리얼로 변경하고 싶다" | 라이브 세션 요청 |
| 명시 결정(범위) | **브랜드 로고(OrcaLogo) 및 로그인 페이지 PNG 를 제외한 모든 아이콘** | AskUserQuestion 답변 |
| 명시 결정(방식) | **인라인 SVG path 교체** (기존 `Icon` 컴포넌트 API 유지, 새 의존성 0) | AskUserQuestion 답변 |

## Context (왜)

기존 아이콘은 `shared/ui/Icon.tsx` 에 손으로 그린 stroke 기반 단일 path SVG(16×16 viewBox) 50종이었다. 사용자는 이를 Google Material 아이콘 세트로 통일하길 원한다. 브랜드 로고(`OrcaLogo`)와 로그인 화면의 PNG 자산은 별도 아이덴티티이므로 제외한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `Icon.tsx` 는 `IconName` 유니온 50종 + `ICONS` path 레코드 + stroke 기반 렌더(`fill='none'` 기본, `stroke=color`) | 코드 `app/src/renderer/src/shared/ui/Icon.tsx` (변경 전) |
| `<Icon>` 사용처 58개 파일 — 대부분 `name`+`size`(+`style`/`color`)만 전달 | `grep -rl 'Icon' src/renderer` |
| `stroke` prop 전달처는 **1곳뿐**(`CustomizeLanding` briefcase `stroke={1.2}`), `fill` prop 전달처는 **0곳** | `grep '<Icon[^>]*\b(stroke\|fill)='` |
| `color` prop 전달처 소수(CameraView `#fff`, SkillDetail/SkillAddMenu `var(--color-*)`) — tint 용도 | `grep '<Icon[^>]*color='` |
| CSP 는 Google Fonts(`fonts.googleapis.com`/`gstatic.com`) 허용 — 폰트 방식도 가능하나 사용자는 인라인 SVG 선택 | `app/src/renderer/index.html` |
| Material Symbols Outlined(weight 400) 원본 SVG 는 `fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/<glyph>/default/24px.svg` 에서 단일 path 로 제공, viewBox `0 -960 960 960`(960 그리드, y 음수 원점), fill 기반 | 외부 URL(위 gstatic 경로), 실측 50/50 성공 |
| 얇은 라인 룩 보존에는 채움형 Material Icons 보다 **Material Symbols Outlined** 가 근접 | 시각 판단(설계자) — 리스크 표 참조 |

## 인수 기준 (Acceptance Criteria)

1. `Icon` 컴포넌트가 Material Symbols(fill 기반, viewBox `0 -960 960 960`)로 렌더한다 — `fill={color}`, stroke 미사용.
2. `IconName` 유니온 50종이 그대로 유지되어 58개 사용처가 **이름 변경 없이** 동작한다(호출부 리네임 0).
3. `ICONS` 50종 전부 Material Symbols Outlined 공식 path 로 교체되고, 각 항목에 원본 glyph 이름 주석이 붙는다.
4. `color` prop 이 fill tint 로 매핑되어 기존 tint 사용처(CameraView/SkillDetail/SkillAddMenu)가 유지된다.
5. 더 이상 쓰이지 않는 `stroke`/`fill` prop 이 제거되고, 유일 사용처(`CustomizeLanding`)가 정리된다.
6. 브랜드 로고(`OrcaLogo`)와 로그인 PNG 는 **변경하지 않는다**.
7. 게이트 `lint`/`typecheck` 통과, `test` 는 변경 무관 실패(ABI) 외 green.

## 범위 / 비범위

- **범위**: `shared/ui/Icon.tsx` 전면 교체(렌더 방식 + 50 path), `CustomizeLanding.tsx` 의 `stroke` prop 제거.
- **비범위**: `OrcaLogo`(브랜드), 로그인 화면 PNG, 개별 아이콘의 semantic 이름 재설계, 아이콘 추가/삭제. 폰트 방식(Google Fonts Material Symbols) 및 npm 패키지 도입은 사용자가 인라인 SVG 를 선택하여 비채택.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 `Icon` 컴포넌트 API(`name`/`size`/`color`/`style`)에 기댐 — 유지.
- Material Symbols Outlined 원본 path(외부 gstatic). 런타임 네트워크 의존 없음(빌드시 인라인 상수).
- **신규 의존성 0** — 사용자 결정(인라인 SVG).

## 설계

- `Icon` 렌더를 `<svg viewBox="0 -960 960 960" fill={color}><path d={d}/></svg>` 로 전환(stroke/strokeWidth/strokeLinecap 제거). `size` 는 width/height, viewBox 가 스케일 흡수.
- `IconProps` 에서 `stroke`·`fill` 제거, `color`(기본 `currentColor`)를 svg `fill` 로 매핑.
- `ICONS` 50종을 name→glyph 매핑대로 Material Symbols Outlined path 로 교체. 검증된 데이터에서 생성(전사 오류 방지).
- name→glyph 매핑(요지): `plus→add`, `x→close`, `cpu→memory`, `cam→photo_camera`, `board→dashboard`, `flask→science`, `user→person`, `chevD→keyboard_arrow_down`, `panelL/panelR→left_panel_open/right_panel_open`, `capture→center_focus_strong`, `alert→warning`, `sparkle→auto_awesome`, `doc→description`, `trash→delete`, `kebab→more_vert`, `clock→schedule`, `arrowL/arrowR→arrow_back/arrow_forward`, `briefcase→work`, `eye→visibility`, `pin→push_pin`, `enter→keyboard_return`, `fork→fork_right`, `sun/moon→light_mode/dark_mode`, 나머지 동명.
- 레이어 경계: `shared/ui` 내부 변경 + 동일 feature(`skills`) 1줄 — 경계 위반 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 테마: `currentColor`/`var(--color-*)` tint 유지 — white/dark 양 테마 자동 상속.
- 시각 무게 변화: stroke 1.6 라인 → Material Outlined 채움. 크기감이 미세히 달라질 수 있음(사람 시각 검증 대상).
- a11y: 아이콘은 장식(`aria-label` 은 상위 버튼이 소유) — 변경 없음.
- 빈/에러 상태: `ICONS[name]` 미존재 시 `null` 반환 로직 유지.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| Material Outlined 채움 룩이 기존 얇은 stroke 톤과 미세히 다름 | Symbols **Outlined**(weight 400) 선택으로 라인 룩 최대 근접. 최종 시각 판단은 사람. |
| 일부 semantic→glyph 매핑이 의도와 어긋날 여지(`capture`,`fork`,`board`) | 사용처 확인 후 매핑(capture=카메라 캡처 버튼→center_focus_strong 등). 이견 시 glyph 1줄 교체로 조정 가능(되돌리기 쉬움). |
| viewBox 좌표계 변경(16→960) | 컴포넌트 내부 격리 — 호출부 `size` 계약 불변. |

- 되돌리기 어려운 결정: 없음(단일 파일, glyph 교체 자유).
- 단독 결정 금지 항목: 없음(범위·방식 모두 사용자 확정).

## 영향 받는 파일

- `app/src/renderer/src/shared/ui/Icon.tsx` (전면 교체)
- `app/src/renderer/src/features/skills/components/customize/CustomizeLanding.tsx` (`stroke` prop 제거)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: 없음(순수 시각 자산 교체 — UI 는 시각 검증으로 갈음, app/AGENTS.md §4).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구/범위·방식 결정을 라이브 세션·AskUserQuestion 으로 인용.
- [x] 자료조사 — 모든 발견에 레퍼런스(코드/외부 URL) 부착.
- [x] 인수 기준 — 번호·검증가능·조사 근거.
- [x] 의존 기술 — 신규 의존성 0 확인.
- [x] 파생 UX — 테마/시각무게/a11y/빈상태 전개.
- [x] 리스크 — 매핑·룩 트레이드오프 기록, Open Question 없음.

---

> **[구현자 기입]** (Claude, 비기능 직접 구현)

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 인라인 SVG + 컴포넌트 내부 viewBox 격리로 호출부 계약 불변 — 58 사용처 무회귀가 핵심이고 이를 지켰다.
- 이견 / 우려: 없음. 단 "시각 무게 변화"(리스크 §1)는 코드 게이트로 잡히지 않으므로 사람 시각 검증 필수(verify 책임표에 명시).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `stroke`/`fill` prop 제거가 다른 호출부를 깨뜨릴 위험 | ✅ 구현 전 grep 으로 전수 확인(stroke=1곳, fill=0곳) 후 `CustomizeLanding` 1줄만 정리 | `grep '<Icon[^>]*\b(stroke\|fill)='` 결과 1건 |
| 2 | 전사(transcription) 오류로 path 훼손 | ✅ 50종을 gstatic 원본에서 스크립트로 추출→검증(50/50 성공)→파일 생성, 수기 전사 회피 | 구현 로그 |

## [구현자 기입] 구현 체크리스트

- [x] `Icon.tsx` fill 렌더 전환 + 50 path 교체 + glyph 주석
- [x] `IconProps` 에서 `stroke`/`fill` 제거, `color`→fill 매핑
- [x] `CustomizeLanding` `stroke` prop 제거
- [x] 게이트 lint/typecheck 통과, test 확인

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `Icon.tsx`, `CustomizeLanding.tsx` |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test 700/723 (23 red = better-sqlite3 ABI 환경, 4개 db 의존 파일, 변경 무관) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 기입) |
