# Plan — <slug>

> 템플릿. `<NNNN-slug>/plan.md` 로 복사해 작성한다. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `<NNNN-slug>` |
| 작성자 | Claude Code |
| 일자 | YYYY-MM-DD |
| 매핑 | PHASES 행 / PR (있으면) |
| 상태 | DRAFT → READY |

## Context (왜)

이 작업이 필요한 배경 — 해결하려는 문제/요구, 의도한 결과.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목. 번호를 매긴다.

1. …
2. …
3. …

## 범위 / 비범위

- **범위**: …
- **비범위**: …

## 설계

- 접근 방법.
- **재사용할 기존 함수·유틸·파일 경로** (예: `src/main/ipc/router.ts`, `features/chat/hooks/useChat.ts`).
- 레이어 경계(`app`/`pages`/`features`/`shared`) 준수 방법.

## 영향 받는 파일

- `app/...`
- …

## 참고 문서

- `docs/TRD.md §…`
- `docs/arch/…`
- IPC 변경 시: `docs/IPC_CONTRACT.md` (§6 변경 절차 — **반드시 동시 갱신**)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: … (어댑터 정규화 / reducer / IPC 스키마 / 순수 변환기).

---

## [Codex 기입] 구현 체크리스트

- [ ] …
- [ ] …

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
