# Verify — 0101-markdown-pretty

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0101-markdown-pretty` |
| 검증자 | Claude Code |
| 일자 | 2026-07-14 |
| 대상 커밋 | `58b0960` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 블로커/역질문 없음 | 타당 | — |
| DB 테스트 미실행(ABI-403 베이스라인) | 타당 — 순수 UI 변경, DB 무관 | 게이트 섹션에 baseline 명시 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 태스크리스트 → disabled 체크박스 + 마커 제거 | ✅ | `Markdown.tsx:54-59`(li task-list-item→list-none) · `:68-80`(input checkbox disabled readOnly) |
| 2 | GFM 표 컬럼 정렬 셀 반영 | ✅ | `Markdown.tsx:90-99`(th/td `style` 전달 — remark-gfm text-align 보존) |
| 3 | h5/h6·취소선 톤 렌더 | ✅ | `Markdown.tsx:31-38`(h5/h6) · `:65`(del line-through) |
| 4 | 기존 렌더 회귀 없음 | ✅ | renderer 243/243 green(markdownBlocks·parts 포함), CodeBlock/StreamingMarkdown 무변경 |
| 5 | 신규 의존성 0 · 게이트 통과 | ✅ | package.json 무변경 · lint 0 · typecheck 3종 0 · vitest 243/243 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 · typecheck 0 · renderer 243/243 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 레이어 경계 위반 0 | ✅ | — | `shared/ui/markdown` 내부만 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** (테마 2종·태스크리스트·정렬표·취소선·h5/h6 육안) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ npm run lint            → exit 0 (eslint --cache --fix ./src ./scripts)
$ npm run typecheck       → exit 0 (node/web/test 3종)
$ npx vitest run src/renderer → 29 files, 243/243 passed
```

> `npm test` 전체(main+DB)는 better-sqlite3 네이티브 ABI egress 403(환경 제한, 0098~0100 동일 베이스라인)으로 DB 스위트 미로드 — 본 변경은 renderer 순수 UI라 무관.

## PHASES.md 정합성

- 승격 시 PHASES 행 추가 예정. INDEX.md `0101` → verify/PASS 갱신.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계: 무의존 범위·엣지케이스(중첩 태스크·미지정 컬럼 좌측유지) 충분.
- 구현: 단일 파일·최소 diff. accent-rust 체크박스 색은 시각 검증에서 톤 확인 필요.
- 검증: 시각 검증을 에이전트가 대신할 수 없음(사람 대기) — 게이트+코드대조로 기계 판정 가능분은 전부 PASS.

## 결론 / 다음 단계

- 상태: **PASS**. 사람 시각 검증 대기(비차단). 다음: 0102-transcript-virtualization 구현.

---

# Verify — 라운드 2 (언어 없는 펜스 코드블록 인라인 오분류 수정)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-07-14 |
| 대상 커밋 | (impl 커밋) |
| 라운드 | 2 |
| 상태 | PASS |

## 구현자 코멘트 확인

| 코멘트 | 판단 |
|---|---|
| 블로커 없음 | 타당 |
| DB 스위트 ABI-403 미로드 | 타당 — 순수 UI/헬퍼, DB 무관 (0101 r1·0098~0102 동일 베이스라인) |

## 요구사항 충족 매트릭스 (라운드 2)

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 6 | 언어 없는 다중행 펜스 → CodeBlock(블록) | ✅ | `isCodeBlock.ts`(개행 신호) → `Markdown.tsx:110-121` `code` 가 `!isCodeBlock` 아닐 때 `<CodeBlock>` 반환 · 테스트 "언어 없는 다중행 펜스 → true"(`isCodeBlock.test.ts`) |
| 7 | 언어 펜스·인라인·들여쓰기 판정 정확(회귀 0) | ✅ | 테스트 5-케이스(언어 펜스·다중행·단일행 블록·인라인·빈문자열) · renderer 248/248 green |
| 8 | 판정 순수 함수 분리 + 단위 테스트 | ✅ | `shared/ui/markdown/isCodeBlock.ts` + `isCodeBlock.test.ts`(5 케이스) |
| 9 | 인라인 코드 배경 = border 컬러(`bg-panel`→`bg-border`) | ✅ | `Markdown.tsx:113` `border border-border bg-border` (동일 `--color-border` 토큰, 양 테마 자동) |
| 10 | 신규 의존성 0 · 게이트 통과 | ✅ | package.json 무변경 · lint 0 · typecheck 3종 0 · renderer 248/248 |

## 게이트 재실행 (라운드 2)

```
$ npm run lint            → exit 0 (경고 1 = 0102 TanStack, 무관)
$ npm run typecheck       → exit 0 (node/web/test 3종)
$ npx vitest run src/renderer → 30 files, 248/248 passed (+5 isCodeBlock)
```

## 검증 책임 분리 (라운드 2)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 0 / 0 / 248/248 |
| 인수 6~10 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 판정 로직 회귀(순수 테스트) | ✅ | — | 5 케이스 green |
| UI 시각 검증(트리 블록·인라인 배경 톤·테마 2종) | ✖ | ✅ | **사람 확인 대기** |
| PR 머지 | ✖ | ✅ | 대기 |

## 결론

- 라운드 2 상태: **PASS**. 인수 6~10 기계 판정 충족. 사람 시각 검증(언어 없는 트리 펜스가 코드블록으로 렌더 · 인라인 코드 배경 border 톤 · white/dark)은 비차단 대기.
