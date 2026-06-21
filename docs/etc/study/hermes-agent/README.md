# Hermes Agent ☤ — 아키텍처 분석 (챕터별)

> 분석 대상: Nous Research의 Hermes Agent (이 저장소, `main` 브랜치).
> 분석 방식: 코드 직접 추적(grep/파일 읽기). 추정한 부분은 "코드에서 확인 안 됨"으로 명시.
> 우선 추적한 파일: `agent/conversation_loop.py`(에이전트 루프), `run_agent.py`(`AIAgent` 클래스),
> `agent/transports/*`(LLM 경계), `tools/registry.py` + `model_tools.py`(툴 계층),
> `agent/turn_finalizer.py` + `agent/background_review.py`(자가개선 루프), `hermes_state.py`(영속성).
> `cli.py`(639KB), `run_agent.py`(243KB), `hermes_state.py`(206KB)는 거대 단일 파일이라
> 함수 단위로 grep해 해당 구간만 읽었다.

## 목차

| # | 챕터 | 파일 |
|---|---|---|
| 1 | 개요 | [01-개요.md](01-개요.md) |
| 2 | 전체 아키텍처 | [02-전체-아키텍처.md](02-전체-아키텍처.md) |
| 3 | 콜스택 · 실행 흐름 | [03-콜스택-실행흐름.md](03-콜스택-실행흐름.md) |
| 4 | 핵심 모듈 | [04-핵심-모듈.md](04-핵심-모듈.md) |
| 5 | 특장점 | [05-특장점.md](05-특장점.md) |
| 6 | 구현 디테일 | [06-구현-디테일.md](06-구현-디테일.md) |
| 7 | 큰 그림: 비전과 그 필요조건의 구현 | [07-큰그림-비전과-필요조건.md](07-큰그림-비전과-필요조건.md) |
| 8 | 종합 평가 | [08-종합평가.md](08-종합평가.md) |
| 9 | (집중 분석) 비용·토큰 계산 모듈 | [09-비용토큰-계산-모듈.md](09-비용토큰-계산-모듈.md) |
| 10 | (집중 분석) 컨텍스트 윈도우 추적·현황 모듈 | [10-컨텍스트윈도우-추적-현황.md](10-컨텍스트윈도우-추적-현황.md) |
| 11 | 비전별 핵심 모듈 분류 | [11-비전별-핵심모듈-분류.md](11-비전별-핵심모듈-분류.md) |
| 11-부록 | 메모리·압축 메커니즘 (심화) | [11-부록-메모리와-압축-메커니즘.md](11-부록-메모리와-압축-메커니즘.md) |

## 30초 요약

- **무엇인가**: Nous Research의 "자가개선 AI 에이전트". 프레임워크 없이(LangChain 등 0건) `openai`/
  `anthropic`/`boto3` SDK를 직접 호출하는 from-scratch 루프.
- **루프**: `agent/conversation_loop.py::run_conversation`의 `while api_call_count < max_iterations
  && budget.remaining > 0` 루프. tool_calls 있으면 디스패치 후 `continue`, 없으면 final_response 후 `break`.
- **LLM 경계**: 단일 호출이 아니라 `ProviderTransport` Strategy 계층(api_mode별 어댑터).
- **차별점**: 턴 종료 후 **에이전트를 포크한 데몬 스레드**가 스킬/메모리를 갱신하는 자가개선 루프
  ("본 대화 캐시는 절대 건드리지 않음"). FTS5 세션 검색, git 체크포인트, 멀티 프로바이더 추상화.
