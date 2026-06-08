# Plan — 0001-handoff-bootstrap

> 협업 인프라 자체를 첫 hand-off 작업으로 드라이런한다. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0001-handoff-bootstrap` |
| 작성자 | Claude Code |
| 일자 | 2026-06-08 |
| 매핑 | PHASES "현재 작업 중" → 완료 시 표 승격 |
| 상태 | READY (부트스트랩이므로 Claude 단독 수행) |

## Context (왜)

Claude Code(설계/검증)와 Codex(구현)가 **분리된 환경 + git 공유 브랜치**로 협업하는 체계가 없었다. 이 작업은 그 체계를 구성한다: AGENTS.md 표준화, hand-off 채널(plan/verify/INDEX), 검증의 사람/에이전트 분리.

## 인수 기준 (Acceptance Criteria)

1. 저장소의 모든 `CLAUDE.md`(8개)가 같은 위치 `AGENTS.md` 로 정본 이전되고, `CLAUDE.md` 는 `@AGENTS.md` 한 줄 import stub 이다.
2. 저장소 가이드 간 교차참조(`…/CLAUDE.md` 링크)가 `…/AGENTS.md` 로 갱신된다. (외부 SDK 기능으로서의 "CLAUDE.md" 언급은 보존.)
3. root/app AGENTS.md 의 변동성 페이즈 표·장문 체인지로그가 제거되고 `docs/PHASES.md` 링크로 대체된다 (위생 규칙).
4. `docs/handoff/` 에 `AGENTS.md`(+stub) · `INDEX.md` · `_templates/{plan,verify}.template.md` 가 존재한다.
5. `INDEX.md` 가 단계×상태 머신을 표현하고 본 작업 행을 담는다.
6. `docs/PHASES.md` 에 "현재 작업 중" 섹션이 추가되어 `handoff/INDEX.md` 를 링크한다.
7. 게이트(`cd app && npm run lint && npm run typecheck && npm test`)가 문서-only 변경으로 회귀 없이 통과한다.
8. AGENTS.md 군에 비밀(키/토큰/PW)·개인정보(이메일/전화/IP) 패턴이 없다.

## 범위 / 비범위

- **범위**: 문서/프로세스 인프라. 한국어·표 중심.
- **비범위**: 앱 코드 변경, CI 워크플로우 신설, 런타임 AGENTS.md 주입(standardization.md §5.4 — 별개 스코프).

## 설계

- `git mv` 로 8개 CLAUDE.md → AGENTS.md (히스토리 보존) + 동명 stub 생성.
- root AGENTS.md: 디렉토리 지도 + 독서 순서 + 핵심 원칙 + 협업 워크플로우 + AGENTS.md/CLAUDE.md 규약만 유지.
- 재사용: 기존 `docs/PHASES.md`(이력 SSOT), `app/package.json` 게이트 스크립트, `app/eslint.config.mjs` boundaries.

## 영향 받는 파일

- 8× `AGENTS.md` + 8× `CLAUDE.md` stub (root, docs, app, chats, project, docs/spec, docs/spec/claude, docs/spec/claude/agent-sdk)
- 교차참조: `docs/TRD.md`, `docs/PHASES.md`, `docs/claude-code-spec.md`, `docs/arch/{backend/overview,frontend/layers,frontend/overview,frontend/rendering}.md`
- 신설: `docs/handoff/**`

## 참고 문서

- `docs/AGENTS.md` (독서 순서·위치 규약), `docs/PHASES.md`, `docs/arch/backend/standardization.md §5.4` (런타임 AGENTS.md 스코프 구분)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` — 문서-only 회귀 0.

---

## [Codex 기입] 구현 체크리스트

- 부트스트랩이므로 Claude 단독 수행. 이후 실작업부터 Codex 가 이 칸을 사용한다.

## [Codex 기입] 구현 보고

- 해당 없음 (부트스트랩). 검증 결과는 [`verify.md`](verify.md).
