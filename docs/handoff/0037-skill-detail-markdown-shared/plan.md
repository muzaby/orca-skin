# Plan — 0037-skill-detail-markdown-shared

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0037-skill-detail-markdown-shared` |
| 작성자 | Claude Code |
| 일자 | 2026-06-22 |
| 매핑 | PHASES "스킬 상세 마크다운 공유 렌더러" 행 / PR (요청 시) |
| 상태 | READY (Claude 직접 구현 — 비기능 버그수정) |

## Context (왜)

"스킬 & MCP" 페이지(`/skills`)는 3-depth 구조다 — depth1 좌측 레일(Skills/MCP) · depth2 목록 · **depth3 우측 상세 패널**(`SkillDetail`). depth3 스킬 상세에서 스킬 본문(SKILL.md) 마크다운이 **프리티(prose) 포맷이 아니라 밋밋하게** 렌더되어, 헤딩 위계·리스트·링크·표가 기본 HTML 로 떨어진다.

원인: `SkillDetail` 의 `MarkdownBody`(`features/skills/components/customize/SkillDetail.tsx`)가 **bare `ReactMarkdown`** 을 쓰고 `code`/`pre` 에만 인라인 스타일을 줬다. 헤딩·문단·리스트·링크·인용·표·구분선에 styled component map 이 없다. 반면 채팅 피처의 `Markdown`(`features/chat/components/markdown/Markdown.tsx`)은 `COMPONENTS: Components` 맵(h1~h4·p·a·ul/ol/li·blockquote·hr·table·img·code→`CodeBlock` shiki)으로 제대로 렌더한다. 두 렌더러의 차이가 곧 버그.

제약: ESLint `boundaries` 규칙상 `features/skills` 는 `features/chat` 를 import 할 수 없다(cross-feature 차단). 따라서 채팅 `Markdown` 을 직접 재사용 불가 → **공용 렌더러를 `shared/ui` 로 승격**해 chat·skills 양쪽이 공유한다. (사용자 확정: 승격 방식 + shiki 구문강조 유지.)

## 인수 기준 (Acceptance Criteria)

1. depth3 `SkillDetail` 의 마크다운 본문이 채팅과 동일한 styled component map(헤딩·리스트·링크·인용·표·구분선)으로 프리티 렌더된다.
2. 스킬 본문 코드블록이 채팅과 동일하게 shiki(`CodeBlock`)로 구문강조 + 복사 버튼을 제공한다.
3. 공용 렌더러(`Markdown`·`CodeBlock`)가 `shared/ui/markdown/` 으로 이동하고, chat·skills 가 모두 이를 import 한다(`features/chat` ↔ `features/skills` cross-feature import 0).
4. `Markdown` 이 본문 래퍼 클래스 override 용 선택적 `className` prop 을 받아, skills 상세 패널 톤(`text-ink2`·`leading-1.7`)을 유지한다. 미지정 시 기존 채팅 톤(`text-ink`·`leading-1.65`)이 기본값.
5. 채팅 화면(어시스턴트 메시지·추론 블록·plan 타일·툴 바디·스트리밍)의 마크다운/코드블록 렌더가 회귀 없이 동일하다.
6. plain-text 토글(eye/code 아이콘)은 기존 동작 유지.
7. 게이트 4종(lint/typecheck/test/build) 통과, 레이어 경계 위반 0, 신규 의존성 0.

## 범위 / 비범위

- **범위**: 채팅 마크다운 렌더러의 `shared/ui` 승격 + `SkillDetail` 의 본문 렌더러 교체 + chat 측 import 경로 갱신 + `className` prop 추가.
- **비범위**: `McpDetail`(마크다운 미렌더 — 변경 없음), `StreamingMarkdown`(채팅 스트리밍 전용 — `features/chat` 잔류, import 경로만 갱신), 마크다운 라이브러리 변경(react-markdown 유지).

## 설계

- **이동(승격)**: `git mv` 로 이력 보존.
  - `features/chat/components/markdown/Markdown.tsx` → `shared/ui/markdown/Markdown.tsx`
  - `features/chat/components/markdown/CodeBlock.tsx` → `shared/ui/markdown/CodeBlock.tsx`
  - 근거: `CodeBlock` 의 외부 의존은 `shared/ui/CopyIconButton`(이미 shared) 뿐, `Markdown` 의 외부 의존은 `CodeBlock` 뿐 → feature 의존 0, shared 규칙(`shared`→`shared` 내부) 위반 없음.
- **재사용**: `SkillDetail` 의 `MarkdownBody` 삭제 → 공용 `Markdown`(`shared/ui/markdown/Markdown`) 사용. 패널 톤은 `className` prop 으로 주입.
- **`className` prop**: `Markdown` 에 선택적 `className?: string` 추가, 미지정 시 상수 `DEFAULT_WRAPPER`(기존 채팅 래퍼 클래스). `memo`·0007 주석 보존.
- **레이어 경계**: skills→shared, chat→shared 만 남는다(하향 의존). cross-feature 0.
- 스타일은 시맨틱 토큰 유지(`text-ink/ink2`·`border-border`).

## 영향 받는 파일

- `app/.../shared/ui/markdown/Markdown.tsx` (이동 + `className` prop)
- `app/.../shared/ui/markdown/CodeBlock.tsx` (이동 + `CopyIconButton` 상대경로 갱신)
- `app/.../features/skills/components/customize/SkillDetail.tsx` (`MarkdownBody` 제거 → `Markdown` 사용)
- chat import 경로 갱신 7곳: `transcript/{AssistantMessage,ReasoningBlock,StructuredOutputCard}.tsx`, `transcript/tool-bodies/{KeyValueBody,FileBody}.tsx`, `rightpanel/PlanTileContent.tsx`, `markdown/StreamingMarkdown.tsx`

## 참고 문서

- `docs/arch/frontend/layers.md` (4-layer 경계 · `shared/ui`)
- `app/AGENTS.md` (boundaries · 스타일링 · 단일 파일 분해)
- IPC 변경 없음 → `IPC_CONTRACT.md` 무관

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- 신규 테스트 요구: 없음(순수 이동 + presentational 컴포넌트 시각 변경 — UI 는 시각 검증으로 갈음, `app/AGENTS.md` §4).

---

## [Claude 구현] 구현 체크리스트

- [x] `Markdown.tsx`·`CodeBlock.tsx` → `shared/ui/markdown/` `git mv`
- [x] `Markdown` 에 `className` prop + `DEFAULT_WRAPPER` 상수 추가
- [x] `CodeBlock` 의 `CopyIconButton` import 상대경로 갱신
- [x] chat import 경로 7곳 갱신
- [x] `SkillDetail` 의 `MarkdownBody` 제거 → `Markdown` + 패널 톤 `className`
- [x] 게이트 4종 통과

## [Claude 구현] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 10 (이동 2 · SkillDetail 1 · chat import 7) |
| 실행 명령 | `npm rebuild better-sqlite3` → `npm run lint` / `typecheck` / `test` / `build` |
| 게이트 결과 | lint ✅ / typecheck ✅(node+web+test) / test ✅ 427/427 / build ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `b17070f` |
