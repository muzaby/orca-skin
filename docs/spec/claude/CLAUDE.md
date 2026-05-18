# docs/spec/claude/ — Claude (Anthropic) 공식 문서 한국어 미러

이 디렉토리는 **Claude (Anthropic)** 공식 문서의 한국어 원문 미러를 보관한다. 상위 `docs/spec/CLAUDE.md` 의 미러 정책 (편집 금지·통째로 덮어쓰기) 을 그대로 따른다.

## 현재 인벤토리

| 위치 | 내용 | 원격 원문 URL | 해설 미러 / 가이드 |
|---|---|---|---|
| `headless.md` | Claude Code headless 모드 — CLI `-p` 플래그·NDJSON 출력 | [ko](https://code.claude.com/docs/ko/headless) / [en](https://code.claude.com/docs/en/headless) | `docs/claude-code-spec.md` (해설) |
| `cli-reference.md` | Claude Code CLI 플래그·명령 전체 레퍼런스 | [ko](https://code.claude.com/docs/ko/cli-reference) / [en](https://code.claude.com/docs/en/cli-reference) | `docs/claude-code-spec.md` (해설) |
| `agent-sdk/` | Claude Agent SDK 가이드 25개 (overview·sessions·hooks·typescript 등) | [ko](https://code.claude.com/docs/ko/agent-sdk/) / [en](https://code.claude.com/docs/en/agent-sdk/) | `agent-sdk/CLAUDE.md` (인덱스) |

(마지막 동기화: 2026-05-18 — `agent-sdk/`; 2026-05-14 — `headless.md`, `cli-reference.md`)

## 에이전트 작업별 진입점

작업 주제에 따라 어디부터 볼지가 다르다:

### Claude Code CLI 구현/수정
- 본 저장소가 Claude Code CLI 를 외부 백엔드로 사용한다 (TRD §9, `app/src/main/` 의 ClaudeCodeAdapter).
- **1차 참조**: `docs/claude-code-spec.md` — *해설 미러*. 절 번호 (§3·§4·§5·§7·§13) 가 PRD/TRD/architecture 의 인용 anchor.
- **원형 확인**: `headless.md`, `cli-reference.md` — 본 디렉토리의 원문 미러.

### Agent SDK 작업 (TypeScript/Python)
- **1차 진입점**: `agent-sdk/CLAUDE.md` — 25개 파일을 카테고리별로 정리, 작업 유형별 읽기 순서 안내.
- TypeScript 코드 작성: `agent-sdk/typescript.md` 가 전체 API 레퍼런스.

## 편집 원칙

- **원문 미러는 편집 금지** (`headless.md`, `cli-reference.md`, `agent-sdk/*.md`): 원격 원문 갱신 시 통째로 덮어쓴다.
- **`CLAUDE.md` 진입점 문서는 편집 가능** (본 파일, `agent-sdk/CLAUDE.md`): 인벤토리·가이드이므로 미러 정책 외.
- 상위 `docs/spec/CLAUDE.md` 의 *두 단 구조* (원문 미러 + 해설 미러) 와 *동기화 정책* 을 따른다.

## 새 Claude 제품 문서 추가 시

1. 단일 페이지 미러는 `docs/spec/claude/<page>.md` 로 직접 저장 (예: `headless.md`).
2. 다중 페이지 제품은 `docs/spec/claude/<product>/` 디렉토리로 묶고 그 안에 `CLAUDE.md` 진입점을 둔다 (예: `agent-sdk/CLAUDE.md`).
3. 본 파일의 "현재 인벤토리" 표를 갱신한다.
4. 해설 미러가 필요하면 `docs/claude-<product>-spec.md` 를 만들고 본 디렉토리의 파일을 1차 출처로 인용한다.
5. 마지막 동기화 일자도 갱신.

## 충돌 시

상위 `docs/spec/CLAUDE.md` 의 원칙: **원문 미러가 사실**. 해설 미러 (`docs/claude-code-spec.md`) 가 원문과 충돌하면 해설 미러를 수정한다.
