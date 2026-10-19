# Plan — Renderer 디자인 가이드

## 메타

| 항목 | 값 |
|---|---|
| slug | `0266-renderer-design-guidelines` |
| 작성자 | Codex — 설계·구현 역할을 순차 수행 |
| 일자 | 2026-10-19 |
| 상태 | plan/READY |
| V mode / 기준 / revision | Baseline V / none / V1 |

# Part I — Product & UX Contract

## 1. Context / 목표

AI가 renderer 컴포넌트를 추가할 때 현재 제품의 테마와 공통 UI를 재사용할 수 있게 한다.
테마 정본, 컴포넌트별 선택 기준, 작업 전후 확인 절차를 저장소 진입점에서 찾을 수 있어야 한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 | main 브랜치로 변경 | 현재 사용자 요청 |
| 명시 | 제품의 모든 컴포넌트에 디자인 테마·가이드라인 작성 | 현재 사용자 요청 |
| 명시 | “ai 가 제품 컴포넌트 추가 시 일관적인 디자인을 유지하기 위함이다” | 현재 사용자 요청 |
| 명시 | renderer 제작 시 가이드 참조·준수 | 현재 사용자 요청 |
| 해석 | 현재 UI를 근거로 문서화하고 기존 테마 경계를 보존 | 토큰·하네스 코드 조사 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 |
|---|---|---|---|---|---|
| D-001 | main에서 작업 | 사용자 브랜치 지정 | 사용자 | ACTIVE | — |
| D-002 | 모든 renderer TSX를 컴포넌트 카탈로그에 연결 | AI가 추가·변경 시 참조할 선례 제공 | 사용자·조사 | ACTIVE | — |
| D-003 | 테마·상태·상호작용·재사용·검토 절차 문서화 | 일관적인 디자인 유지 | 사용자 | ACTIVE | — |
| D-004 | root/app/renderer 진입점과 docs 라우팅에 가이드 연결 | renderer 제작 시 참조·준수 | 사용자 | ACTIVE | — |

갱신 메모: 신규 D-001~004. ACTIVE 결정 ↔ AC 대조: D-001↔AC1, D-002↔AC3, D-003↔AC2·AC4, D-004↔AC4, 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 기존 충족 여부 | 부분 충족 | renderer AGENTS에 토큰·레이어 규칙은 있지만 컴포넌트 선택·시각 기준 카탈로그가 없음 |
| 더 작은 해법 | 기존 토큰과 UI의 문서화 | 런타임 UI·토큰·새 의존성 변경 불필요 |
| 기존 결정 충돌 | 없음 | Orca 공통·OpenCode 전용·카메라 stage 경계를 보존 |

사용자 결정이 필요한 신규 제품 동작 없음.

## 5. 동작 / 사용자 흐름

`root 또는 app AGENTS → renderer AGENTS → 디자인 시스템 → 컴포넌트 카탈로그 → 구현·검토`.
새 컴포넌트는 기존 패턴을 선택하고 테마·입력·상태·폭 변화 기준을 적용한다.
기존 코드와 가이드 차이는 문서 드리프트와 제품 변경을 구분해 처리한다.

상태 전이·취소·재시도·멀티세션은 가이드의 설계·검토 항목이며 이번 변경으로 실행 동작을 바꾸지 않는다.

## 6. 범위 / 비범위

- 범위: 디자인 시스템, 현재 TSX 카탈로그, renderer 제작 절차, 진입점 라우팅.
- 비범위: UI 재디자인, 토큰 값·IPC·저장 포맷·라이브러리 변경, 접근성 전면 수정.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | main이 origin/main을 추적 | `git branch --show-current`·upstream 확인 | Git 작업 트리 |
| R-02 | AT-02 / AC2 | 테마·타입·간격·컨트롤·상태·접근성·하네스 경계의 근거와 선택 기준 제공 | 원본 코드와 표 대조·문서 링크 게이트 | 디자인 시스템 → 토큰·공통 UI |
| R-03 | AT-03 / AC3 | 테스트 제외 renderer TSX 각각이 카탈로그의 경로·규칙에 연결 | `work/check-design-docs.py`의 소스/문서 집합 차집합 | 카탈로그 → 소스 |
| R-04 | AT-04 / AC4 | AI 진입점에서 읽기·재사용·완료 검토·신규 행 갱신을 지시 | `work/check-design-docs.py` 진입점 단언 + 절차 내용 대조 | root/app/renderer AGENTS·docs INDEX → 가이드 |

## 7-A. V / Trace Matrix

V1은 문서 기반 R↔AT만 필요하다. 런타임 시스템·배선·알고리즘 변경이 없어 SD·AR·MD 레벨은 생성하지 않는다.

| Node | 레벨 | 계약 | provenance | 기준 |
|---|---|---|---|---|
| R-01~04 | R | §7 해당 요구 | NEW | 없음 |
| AT-01~04 | AT | §7 해당 인수 증거 | NEW | 없음 |

| Pair | left ↔ right | requiredness | path | 직접 oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | Git → main → upstream | `gate:git branch --show-current`·upstream | not selected — 직접 Git 관측 | EP-01 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 가이드 → 토큰·공통 UI | `gate:cd app && node scripts/check-doc-inventory.mjs --check` + 코드 대조 | not selected — 문서 의미는 직접 대조 | EP-02 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 소스 집합 → 카탈로그 행 | `gate:python work/check-design-docs.py` | TSX 행 제거·가짜 경로 추가 시 red | EP-03 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | AGENTS·INDEX → 가이드 | `gate:python work/check-design-docs.py` | 진입점 링크 제거 시 각 자리 red | EP-04 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 | 근거 |
|---|---|
| Tailwind v4 white/dark 토큰과 OpenCode 별도 토큰 | `styles/tokens.css` |
| primary는 중립 반전, danger는 rust | `shared/ui/Button.tsx` |
| 입력·메뉴·카탈로그·뷰어 공통 프리미티브 | `shared/ui/` |
| 하네스 전환·입력 controller·패널 수명 계약 | `docs/arch/frontend/rendering.md` |

전수 조사: `rg --files app/src/renderer/src -g '*.tsx'`에서 `.test*` 제외. 수치 정본은 코드이며 합계는 가이드 본문에 적지 않는다.

## 9. Architecture — AS-IS → TO-BE

| 축 | AS-IS | TO-BE / Delta |
|---|---|---|
| 테마 | tokens.css·공통 UI에서 개별 확인 | 디자인 시스템에서 역할을 고른 뒤 같은 코드 참조 |
| 컴포넌트 | 파일명·소스 검색 | 파일별 규칙·테마 스코프 카탈로그 |
| 작업 지침 | AGENTS의 토큰·경계 규칙 | 같은 지침에 필수 읽기·재사용·완료 검토 추가 |
| 실행 구조 | 기존 renderer | 유지 |

## 10. 계약 / 타입 / 강제 지점

| EP / pair | 불변식 | 언제 강제 — 고정 자리 목록 | 자리 검색 | 실패 의미 |
|---|---|---|---|---|
| EP-01 / VP-01 | main 추적 | 현재 branch·upstream | `git status -sb` | 다른 브랜치에서 작업 |
| EP-02 / VP-02 | 디자인 역할과 근거 | 디자인 시스템 본문 | `rg '^##' docs/arch/frontend/design-system.md` | 잘못된 테마·컴포넌트 선택 안내 |
| EP-03 / VP-03 | 소스마다 규칙 제공 | 카탈로그 각 TSX 행 — §8 소스 집합으로 고정 | §8 명령 | 누락·오래된 경로 |
| EP-04 / VP-04 | 가이드 진입 | root AGENTS·app AGENTS·renderer AGENTS·docs INDEX | 해당 파일의 디자인 링크 검색 | 진입점에서 가이드를 찾지 못함 |

## 11. 모듈·구현 순서

디자인 시스템 → 카탈로그 → AGENTS·INDEX 연결 → 링크·차집합·게이트 확인.
`work/check-design-docs.py`는 이번 문서의 일회성 검증 도구이며 제품·CI 코드가 아니다.

## 12. Lifecycle / Cleanup

런타임 영향 없음. 새 TSX를 만들거나 이동할 때 카탈로그 행을 함께 갱신하도록 명시한다.

## 13. 저장 / 호환성

문서만 변경. plan 상태·INDEX는 같은 구현 커밋에 동기화한다.

## 14. 성능 / 상한

해당 없음 — 런타임 변경 없음.

## 15. 외부 구현 포트

해당 없음. 예시는 기존 Button·Modal·번역 API를 사용한다.

## 16. 기존 결정·규칙과의 관계

한국어 문서, 시맨틱 토큰, 양 테마, 4-layer, 이름 있는 group, 동적 style, CLAUDE import stub 규칙을 유지한다.
handoff 프로토콜·템플릿·skill은 변경하지 않는다.

## 17. 리스크 / 트레이드오프

문서가 실제 코드와 갈라질 위험은 코드 링크·카탈로그 갱신 의무로 줄인다.
가이드 준수는 AI 작업·리뷰 계약이며 UI 전역 자동 검증을 새로 도입하는 작업은 아니다.

## 18. 영향 받는 파일 / 문서

`docs/arch/frontend/design-system.md`, `design-components.md`, root/app/renderer AGENTS, `docs/INDEX.md`, 본 plan·handoff INDEX.

## 19. 게이트

- 문서: `cd app && node scripts/check-doc-inventory.mjs --check`로 생성물·수치 산문·상대 링크를 함께 검사한다.
- 변경 subtree: `cd app && npm run lint && npm run typecheck`.
- 직접 증거: `python work/check-design-docs.py`; 등록 음성 대조는 메모리 사본에서 수행한다.
- 사람 실기: 해당 없음 — UI 미변경.

## READY self-review

Decision↔AC 충돌 0. 본문의 AS-IS/TO-BE·AC·pair·§10이 같은 문서 경로를 가리킨다.
선택된 적대 증거는 카탈로그 누락·허위 행·진입점 누락에 한정한다.
기존 토큰·컴포넌트와 다른 새로운 제품 정책은 정하지 않는다.

설계 정정: 실제 CLI의 cwd는 app이며 개별 링크/수치 flag 없이 `--check`가 검사를 함께 수행함을 소스 `runCli`에서 확인했다. 검증 범위는 유지하고 실행 명령만 정정했다.
