# Plan — 0032-study-agent-analyses

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0032-study-agent-analyses` |
| 작성자 | Claude Code |
| 일자 | 2026-06-21 |
| 매핑 | PR #105 / PHASES 승격 N/A (레퍼런스 문서) |
| 상태 | READY (비기능 = Claude 직접 구현, 회고적 정식화) |

## Context (왜)

자체 구현(프레임워크 없는) 코딩 에이전트 두 곳 — **opencode**, **hermes-agent** — 의
아키텍처를 코드 기반으로 분석한 보고서를 Orca 작업공간에 **study 레퍼런스**로 둔다.
Orca 엔진/런타임(SessionAdapter·NormalizedEvent·컨텍스트 압축·비용/토큰 추적·권한 게이트)
설계 시 두 에이전트의 동일 관심사 구현을 비교 참고하기 위함이다.

`docs/etc/lightweight-llm-strategy.md`(별도 제품 방향)와 같은 결의 **참고 자료**이며
Orca 구현체와는 독립이다 — 제품 로드맵(PHASES) 항목이 아니라 reference 성격이다.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. `docs/etc/study/opencode/` 에 분석 보고서(인덱스 + 챕터 다수)가 존재한다.
2. `docs/etc/study/hermes-agent/` 에 분석 보고서(README + 챕터 다수)가 존재한다.
3. 각 디렉토리에 진입 인덱스(`00-index.md` / `README.md`)가 있고 챕터 목차·한 줄 요약을 포함한다.
4. 코드 변경 0 — `app/**` 무수정 (문서 전용 추가).
5. 무관한 산출물(`.gstack/`)은 커밋에 포함되지 않는다.
6. 커밋 trailer 가 규약(`docs/git-template.md`)을 따른다 (`Agent: claude`, 본문 2층 구조, `git interpret-trailers` 파싱 가능).

## 범위 / 비범위

- **범위**: `docs/etc/study/` 신규 디렉토리 추가(레퍼런스 문서) + 핸드오프 정식화.
- **비범위**: 보고서 내용 검수(분석의 사실 정확성은 사람 판단), Orca 코드/문서(TRD/arch)에 분석 결과 반영, `.gstack/` 추적.

## 설계

- 보고서는 사전 생성된 산출물을 그대로 배치(작업공간 내 study 아카이브).
- 위치 규약: `docs/etc/`(별도 제품 방향·참고 자료 구역) 하위 `study/`.
- 레이어 경계: 문서 전용 — 해당 없음.

## 영향 받는 파일

- `docs/etc/study/opencode/**` (13 파일 — `00-index.md` + 12 챕터)
- `docs/etc/study/hermes-agent/**` (13 파일 — `README.md` + 12 챕터)

## 참고 문서

- `AGENTS.md` "위치 규약" / `docs/AGENTS.md` "위치 규약"
- `docs/etc/llm-chat-desktop-strategy.md`, `docs/etc/lightweight-llm-strategy.md` (인접 etc 자료)

## 게이트

- 앱 코드 게이트 N/A (문서 전용, `app/**` 무변경) — handoff 0023 동형.
- 위생: `git diff --check`(공백) + 무관 파일(`.gstack/`) 미포함 확인.

---

## 구현 보고 (Claude 직접 구현)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `docs/etc/study/opencode/**` (13) + `docs/etc/study/hermes-agent/**` (13) = 26 파일 |
| 실행 명령 | 코드 게이트 N/A (문서) · `git interpret-trailers --parse` (trailer 검증) |
| 게이트 결과 | 앱 게이트 N/A · trailer 파싱 ✅ · `.gstack/` 미포함 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `263f55e` (docs 추가) + 본 핸드오프 정식화 커밋 |
