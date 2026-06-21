# Verify — 0032-study-agent-analyses

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0032-study-agent-analyses` |
| 검증자 | Claude Code |
| 일자 | 2026-06-21 |
| 대상 커밋 | `263f55e` (docs 추가) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `study/opencode/` 보고서 존재 | ✅ | `git ls-files docs/etc/study/opencode` → 13 파일 (`00-index.md` + 01~11·11a) |
| 2 | `study/hermes-agent/` 보고서 존재 | ✅ | `git ls-files docs/etc/study/hermes-agent` → 13 파일 (`README.md` + 01~11·11부록·11비전별) |
| 3 | 진입 인덱스 + 목차 + 한 줄 요약 | ✅ | `opencode/00-index.md`(목차 표 + "한 줄 요약"), `hermes-agent/README.md`(목차 표 + "30초 요약") |
| 4 | 코드 변경 0 (`app/**` 무수정) | ✅ | `263f55e` 변경 26 파일 전부 `docs/etc/study/` 하위 |
| 5 | `.gstack/` 미포함 | ✅ | `263f55e` diff 에 `.gstack` 부재 (스테이징 시 `docs/etc/study` 만 add) |
| 6 | 커밋 trailer 규약 준수 | ✅ | `git log -1 263f55e \| git interpret-trailers --parse` → `Agent: claude` / `Handoff: none` 파싱 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 코드 게이트 lint/typecheck/test | N/A (문서 전용) | — | 해당 없음 |
| 인수 기준 ↔ 산출물 대조 | ✅ | 이견 시 중재 | PASS (6/6) |
| 레이어 경계 위반 0 | N/A (문서) | — | 해당 없음 |
| 문서 형식/링크/한국어 | ✅ | — | 인덱스·목차·상호 링크 정상 |
| 위생 스캔(키/토큰/이메일/IP) | ✅ grep | ✅ 최종 판단 | 아래 §위생 검토 |
| 분석 내용의 사실 정확성 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 (PR #105) |

## 게이트 재실행 결과

앱 코드 게이트 N/A — 본 work-unit 은 `app/**` 무변경 문서 전용(handoff 0023 동형).
trailer 파싱 검증:

```
$ git log -1 263f55e --format=%B | git interpret-trailers --parse
Agent: claude
Handoff: none
```

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: study 보고서는 외부 OSS(opencode·hermes-agent)의 *아키텍처 해설*
  으로 비밀/개인정보 미포함. (분석 대상의 파일 경로·함수명만 인용.)
- 변동성/일회성/장문 코드설명서 혼입 여부: `docs/etc/` 는 참고 자료 구역으로 study 해설 적재가 위치 규약에 부합.

## PHASES.md 정합성

- **PHASES 승격 N/A.** study/opencode·hermes-agent 는 Orca 제품 로드맵 항목이 아니라
  `docs/etc/` 의 **레퍼런스 자료**(`lightweight-llm-strategy.md` 와 동결)다. 제품 페이즈 표에
  넣지 않고 INDEX 비고에 사유를 남긴다.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 6/6 충족. PR #105 로 제출(머지 승인은 사람).
- 사람 확인 대기: 분석 보고서 내용의 사실 정확성 · PR 머지.
