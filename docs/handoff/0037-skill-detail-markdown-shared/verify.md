# Verify — 0037-skill-detail-markdown-shared

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0037-skill-detail-markdown-shared` |
| 검증자 | Claude Code |
| 일자 | 2026-06-22 |
| 대상 커밋 | `b17070f` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

> plan 의 각 인수 기준을 1:1 로 대조.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | depth3 `SkillDetail` 본문이 styled component map 으로 프리티 렌더 | ✅ | `SkillDetail.tsx:4,182` 가 공용 `Markdown`(COMPONENTS 맵 보유: `Markdown.tsx:6-76` h1~h4·p·a·ul/ol/li·blockquote·hr·table·thead·th·td·img·code) 사용. 기존 `MarkdownBody`(bare ReactMarkdown) 제거됨 |
| 2 | 코드블록 shiki 구문강조 + 복사 버튼 | ✅ | `Markdown.tsx:61-74` code → `CodeBlock`(`shared/ui/markdown/CodeBlock.tsx` shiki `createHighlighter` + `CopyIconButton`) |
| 3 | 렌더러 `shared/ui/markdown/` 승격 + chat·skills 공유, cross-feature import 0 | ✅ | `git mv` 로 `shared/ui/markdown/{Markdown,CodeBlock}.tsx` 이동(상태 R). `grep features/chat features/skills` → none. chat 7파일이 `shared/ui/markdown` import |
| 4 | `Markdown` `className` prop(미지정 시 채팅 톤 기본값) | ✅ | `Markdown.tsx:78-82`(`className?: string`)·`:88-89`(`DEFAULT_WRAPPER` 채팅 톤)·`:95`(`className ?? DEFAULT_WRAPPER`). `SkillDetail.tsx:182-185` 패널 톤(`text-ink2 leading-[1.7]`) 주입 |
| 5 | 채팅 마크다운/코드블록 회귀 0 | ✅ | 채팅 7 importer 는 동일 컴포넌트(이동만, 로직 무변경) 사용 — `AssistantMessage`·`ReasoningBlock`·`StructuredOutputCard`·`KeyValueBody`·`FileBody`·`PlanTileContent`·`StreamingMarkdown`. 게이트 test 427/427 green |
| 6 | plain-text 토글 동작 유지 | ✅ | `SkillDetail.tsx` eye/code 토글·`plain` 분기(`<pre>`) 미변경 |
| 7 | 게이트 4종 통과·경계 0·신규 의존성 0 | ✅ | 아래 게이트 재실행. lint(boundaries 포함) green, 신규 의존성 0(react-markdown/shiki 기채택) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 4종 green (test 427/427) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 충족 |
| 레이어 경계 위반 0 | ✅ | — | skills→shared·chat→shared 만, cross-feature 0 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify 한국어·템플릿 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음(해당 없음) |
| 제품 의도 부합(프리티 렌더) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기(아래) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm rebuild better-sqlite3   # Node ABI (handoff 0019 계열)
rebuilt dependencies successfully
$ npm run lint
> eslint --cache --fix ./src            # 위반 0 (boundaries 포함)
$ npm run typecheck
> typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅
$ npm test
 Test Files  60 passed (60)
      Tests  427 passed (427)
$ npm run build
✓ built in 4.17s
```

> 비고: 최초 `npm test`(설치 직후)는 `db/queries.test.ts` 11-red — `better-sqlite3` Module-did-not-self-register(`postinstall: install-app-deps` Electron ABI ↔ vitest Node ABI 충돌, handoff 0019 dual-ABI 계열). 본 변경은 렌더러 전용(`app/src/main` 무변경)이라 무관. `npm rebuild better-sqlite3`(Node ABI) 후 427/427 green.

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음 — 해당 없음. 신규 문서는 `docs/handoff/0037-*/{plan,verify}.md` (키/토큰/이메일/IP 없음).

## PHASES.md 정합성

- "페이즈 표" 에 handoff 0037 행 승격(범위 요약 + 커밋 `b17070f`). 형식은 0036 행 동형.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 7/7 충족, 게이트 4종(lint/typecheck/test 427/build) green, 레이어 경계 0, 신규 의존성 0. PHASES 승격.
- **사람 확인 대기**: depth3 스킬 상세 본문 프리티 렌더 시각 검증(헤딩 위계·리스트·표·shiki 코드강조) + 채팅 화면 회귀 시각 확인 + (요청 시) PR 머지.
