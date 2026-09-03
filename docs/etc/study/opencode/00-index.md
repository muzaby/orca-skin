# opencode — 아키텍처 분석 (Index)

`packages/opencode` 의 자체 구현 AI 코딩 에이전트를 코드 기반으로 분석한 보고서입니다.
프레임워크가 아니라 **직접 구현한 에이전트 루프**를 중심으로, 콜스택·핵심 모듈·특장점·구현
디테일, 그리고 운영체제론 관점의 큰 그림까지 챕터별로 나누어 정리했습니다.

분석 범위(우선순위 경로)는 다음과 같습니다. 거대 파일은 전체를 읽지 않고 핵심 함수만
grep으로 찾아 해당 구간을 정독했으며, 어떤 파일에 집중했는지 각 챕터에 명시했습니다.

- `packages/opencode/src/session/prompt.ts` — 에이전트 루프(`runLoop`)
- `packages/opencode/src/session/processor.ts` — LLM 스트림 처리 / 툴 디스패치
- `packages/opencode/src/session/llm.ts` + `session/llm/*` — LLM 경계(네이티브/AI SDK 이중 런타임)
- `packages/opencode/src/tool/*` — 툴 정의·레지스트리
- `packages/opencode/src/session/compaction.ts` — 컨텍스트 압축/프루닝
- `packages/opencode/src/permission/index.ts` — 권한 게이트
- `packages/llm/src/*` — 네이티브 프로바이더 프로토콜 패키지

## 목차

| 챕터 | 파일 | 내용 |
|---|---|---|
| 연구 가이드 | [orca-migration-guide.md](orca-migration-guide.md) | Orca 현 경계와 OpenCode SDK 전환 시의 adapter·event·DB·rollout 연구. **현재 제품 계약이 아님** |
| 1 | [01-overview.md](01-overview.md) | 개요 · 기술 스택 · 구현 형태 |
| 2 | [02-architecture.md](02-architecture.md) | 전체 아키텍처 · 컴포넌트 다이어그램 · 멀티에이전트 토폴로지 |
| 3 | [03-callstack.md](03-callstack.md) | 콜스택 · 실행 흐름 · 종료 조건 · 시퀀스 다이어그램 |
| 4 | [04-core-modules.md](04-core-modules.md) | 핵심 모듈별 책임·입출력·의존성 |
| 5 | [05-strengths.md](05-strengths.md) | 특장점 (코드 근거 포함) |
| 6 | [06-implementation.md](06-implementation.md) | 구현 디테일 · 자료구조 · 패턴 |
| 7 | [07-big-picture.md](07-big-picture.md) | 큰 그림: 비전과 그 필요조건의 구현 (OS 관점) |
| 8 | [08-evaluation.md](08-evaluation.md) | 종합 평가 · 트레이드오프 · 분석 한계 |
| 9 | [09-cost-token-module.md](09-cost-token-module.md) | 비용(토큰) 계산 모듈 단독 분석 · 단가 출처(models.dev) · 클로드 호출 비용 환산 예시 |
| 10 | [10-context-window-tracking.md](10-context-window-tracking.md) | 컨텍스트 윈도우 추적·현황 모듈 단독 분석 · 임계 판정/트리거 · 클로드 호출 현황 환산 예시 |
| 11 | [11-vision-and-modules.md](11-vision-and-modules.md) | 비전과 추구하는 바 요약 · 비전 축별 핵심 모듈 분류(A~E) |
| 11a | [11a-robustness.md](11a-robustness.md) | (11장 보조) 견고성 심화 — 실패 모드별 전용 방어 + Effect 토대 |
| 12 | [system_prompt_injection_analysis_ko.md](system_prompt_injection_analysis_ko.md) | 시스템 프롬프트 주입 전체 분석 — 주입 종류·조립/병합·포맷·캐시 breakpoint |
| 13 | [auth-broker-analysis-ko.md](auth-broker-analysis-ko.md) | 인증 저장소·AuthHook·OAuth callback·런타임 주입·플러그인 신뢰 경계 |

## 한 줄 요약

opencode 는 **클라이언트/서버 구조의 자체 구현 코딩 에이전트**다. Vercel `ai` SDK 를
스트리밍/툴콜 프로토콜의 *폴백* 으로만 쓰고, 그 위/아래의 거의 모든 것 — 에이전트 루프,
프롬프트 조립, 툴, 권한, 컨텍스트 압축, 세션 영속화, 그리고 **자체 LLM 프로바이더 프로토콜
패키지(`@opencode-ai/llm`)** 까지 — 을 Effect(함수형 TS) 위에서 직접 구현했다.
