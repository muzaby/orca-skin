# Plan — 0101-markdown-pretty

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: 의도 → 조사 → 설계 → 리스크.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0101-markdown-pretty` |
| 작성자 | Claude Code |
| 일자 | 2026-07-14 |
| 매핑 | PHASES 행 (승격 시) / PR (있으면) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "markdown 이 예쁘게(pretty), 그리고 많이 지원되는 것도 중요하다" · "markdown 렌더링(pretty) 우선 진행" | 라이브 세션 요청 (cdesktop 벤치마킹 후속) |
| 명시 결정 | markdown 범위 = **무의존 폴리시만** (Mermaid/KaTeX 제외) | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | "예쁨"=표시 미감, "많이 지원"=표준 markdown/GFM 커버리지 정확도. react-markdown 교체가 아니라 기존 `COMPONENTS` 맵 보강으로 해석 (추론) | 벤치마킹 분석 결과 |

## Context (왜)

cdesktop 벤치마킹에서, Orca transcript는 코드블록 미감(shiki)·스트리밍 최적화는 앞서지만 **표준 markdown 표시 커버리지에 구멍**이 있음이 드러났다. `remark-gfm`은 태스크리스트·표 정렬·취소선을 **이미 파싱**하는데, `Markdown.tsx`의 `COMPONENTS` 맵이 대응 렌더/스타일을 빠뜨려 브라우저 기본으로 떨어지거나(정렬은 아예 드롭) 미감이 떨어진다. 무의존으로 표시만 보강하면 커버리지·정확도·미감이 즉시 오른다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `COMPONENTS` 맵에 `h1~h4`만 정의 — `h5`/`h6` 미정의(브라우저 기본 렌더). `del`(취소선) 미정의. `input`(태스크리스트 체크박스) 미정의. | `app/src/renderer/src/shared/ui/markdown/Markdown.tsx:18-88` |
| `th`/`td`가 `{children}`만 받아 `style`(remark-gfm `text-align`)·`align`을 드롭 → GFM 셀 정렬 미반영 | `Markdown.tsx:59-64` |
| remark-gfm은 이미 적용됨 (`remarkPlugins={[remarkGfm]}`) — 태스크리스트/표/취소선/autolink 파싱됨 | `Markdown.tsx:108` |
| 참조 구현: cdesktop `MarkdownPreview`는 `th/td`에 `{...props}` 전달로 정렬 유지 + `input[type=checkbox]` 핸들러(readOnly 체크박스) | cdesktop `packages/web-core/src/shared/components/MarkdownPreview.tsx:126-208` |
| 스타일 규칙: 새 CSS 파일 금지, Tailwind arbitrary util·시맨틱 토큰만 | `@app/AGENTS.md` 스타일링 |
| 기존 타입 스케일: h1=18px, h2=16px, h3=14.5px, h4=13.5px, 본문 leading-1.65 | `Markdown.tsx:19-30,98` |

## 인수 기준 (Acceptance Criteria)

1. 태스크리스트(`- [ ]` / `- [x]`)가 **disabled 체크박스**로 렌더되고, 해당 `li`의 리스트 마커가 제거된다.
2. GFM 표의 컬럼 정렬(`:---` / `:---:` / `---:`)이 셀(`th`/`td`)에 반영된다.
3. `h5`·`h6`가 기존 타입 스케일과 일관된 톤으로, `~~취소선~~`(`del`)이 시맨틱 토큰 색으로 렌더된다.
4. 기존 렌더(문단·리스트·블록쿼트·코드블록(shiki)·링크·표·이미지 data:차단 플레이스홀더)에 시각 회귀가 없다.
5. 신규 의존성 0. `cd app && npm run lint && npm run typecheck && npm test` 통과.

## 범위 / 비범위

- **범위**: `Markdown.tsx`의 `COMPONENTS` 맵 보강(무의존 표시 폴리시).
- **비범위**: Mermaid·KaTeX(신규 의존성·CSP 검토 — 향후), react-markdown 교체(PRD §11 Open Question — 무관, react-markdown 유지), 코드블록/스트리밍(`CodeBlock`·`StreamingMarkdown`·`splitStableBlocks` 무변경), raw HTML(보안상 의도적 미지원 유지).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 채택: `react-markdown` + `remark-gfm`(이미 설치). 추가 플러그인 없음.
- 전제: remark-gfm의 태스크리스트 출력이 `<li class="task-list-item"><input type="checkbox" disabled>` 구조(표준 동작).
- **신규 의존성**: 없음.

## 설계

- `Markdown.tsx`의 `COMPONENTS`에 항목 추가·수정:
  - `h5`/`h6`: h4(13.5px) 아래로 12.5px/12px + `font-semibold`/`font-medium`, 상하 마진 축소로 스케일 연장.
  - `del`: `<del className="text-ink3 line-through">` (시맨틱 토큰).
  - `input`: `type==='checkbox'`면 `<input type="checkbox" checked={...} disabled className="...">` (읽기전용) — 그 외 타입은 안전 렌더/무시.
  - `li`: `className`에 `task-list-item` 포함 시 `list-none -ml-…`로 마커 제거·정렬 보정(현행 `my-0.5` 톤 유지). remark-gfm이 붙이는 클래스로 분기.
  - `th`/`td`: props에 `style`(그리고 `align`)을 받아 전달 — remark-gfm이 넣는 `text-align`을 보존. 기존 클래스는 유지.
- **재사용**: 기존 `COMPONENTS` 패턴·`BlockedImagePlaceholder`·시맨틱 토큰 그대로. `CodeBlock`(shiki) 경로 무변경.
- 레이어: `shared/ui/markdown` 내부 변경만 — 경계 무영향.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 테마: white/dark 두 스코프 모두 시맨틱 토큰이라 자동 대응(raw hex 금지).
- 체크박스 상호작용: **읽기 전용**(disabled) — 대화 표시용이라 토글 없음(클릭 무반응 의도).
- 중첩 태스크리스트: 중첩 `ul`/`ol` 안의 task item도 마커 제거 일관 적용.
- 빈/부분 표: 스트리밍 중 미완 표 행은 기존과 동일(react-markdown 파싱에 위임).
- a11y: disabled 체크박스에 접근성 라벨은 인접 텍스트가 담당(추가 aria 불요).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `li` 마커 제거 로직이 일반 리스트에 오적용 | remark-gfm의 `task-list-item` 클래스 존재로만 분기(일반 li 무영향) |
| `th/td`에 `style` 전달 시 임의 인라인 스타일 유입 | remark-gfm은 `text-align`만 생성(사용자 raw HTML은 비지원이라 경로 없음) → 안전 |
| 간격 조정이 기존 시각 회귀 유발 | 마진 변경 최소화, 인수 기준 4로 회귀 육안 검증 |

- 되돌리기 어려운 결정: 없음(표시 전용, 단일 파일).
- 단독 결정 금지 항목: 없음(무의존·범위 확정).

## 영향 받는 파일

- `app/src/renderer/src/shared/ui/markdown/Markdown.tsx` (유일 수정)

## 참고 문서

- `docs/arch/frontend/rendering.md` (markdown 렌더 톤)
- `@app/AGENTS.md` 스타일링(새 CSS 금지·시맨틱 토큰)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: UI 표시 폴리시라 단위 테스트 대상 아님(순수 변환기 없음) — 시각 검증으로 갈음(app/AGENTS.md 원칙 4).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구/결정을 라이브 세션 출처로 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`·외부 참조 부착.
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 신규 의존성 0 명시.
- [x] 파생 UX — 테마/체크박스 읽기전용/중첩/a11y 펼침.
- [x] 리스크 — 오적용·스타일 유입 완화책, Open Question 없음.

---

## [구현자 기입] 구현 보고 (Claude, 비기능)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/renderer/src/shared/ui/markdown/Markdown.tsx` (유일) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npx vitest run src/renderer` |
| 게이트 결과 | lint ✅ 0 · typecheck 3종 ✅ 0 · renderer 243/243 ✅ (better-sqlite3 DB 테스트는 환경 ABI-403 베이스라인이라 미실행 — 본 변경 무관·순수 UI) |
| 구현 요약 | `h5`/`h6`(12.5/12px 톤 연장)·`del`(취소선)·`input[checkbox]`(disabled readOnly, accent-rust)·`li`(task-list-item → list-none)·`th/td`(style 전달로 GFM 정렬 보존) 추가. 신규 의존성 0, CodeBlock/StreamingMarkdown 무변경. |
| 블로커 / 역질문 | 없음 |

> 시각 검증(테마 2종·태스크리스트·정렬표·취소선·h5/h6 육안)은 사람 확인 대기(책임 분리표).
