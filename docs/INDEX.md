# docs/ — 라우팅 표

> **이 문서는 사실을 서술하지 않는다 — 어디로 갈지만 알려준다.** 사실을 여기 옮겨 적으면 정본과
> 갈라진다. 각 문서의 내용 요약이 필요하면 그 문서를 열어라.

## 작업 → 먼저 읽을 문서

| 하려는 일 | 먼저 읽을 문서 |
|---|---|
| **무엇을** 만드는지 (제품 정의) | [`PRD.md`](PRD.md) |
| **어떤 기술로** 만드는지 (기능·스택·API 사양) | [`TRD.md`](TRD.md) |
| **아키텍처 문서 전체 지도** (backend/frontend 파일 맵) | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 부트 시퀀스 · main 프로세스 구조 | [`arch/backend/overview.md`](arch/backend/overview.md) |
| 세션 런타임 · 동시성 · IPC 핸들러 구조 | [`arch/backend/runtime-ipc.md`](arch/backend/runtime-ipc.md) |
| chat turn · 어댑터 호출 · SDK→NormalizedEvent 정규화 | [`arch/backend/adapters.md`](arch/backend/adapters.md) |
| 턴 이벤트 정규화 계층 (NormalizedEvent · 권한 브리지) | [`arch/backend/provider-runtime.md`](arch/backend/provider-runtime.md) |
| **인증 provider** (로그인 게이트 · LLM 자격증명 · 사내 서비스) | [`arch/backend/auth.md`](arch/backend/auth.md) |
| Electron 보안 경계 · 자격증명 · 원격 전송 스택 | [`arch/backend/security.md`](arch/backend/security.md) |
| DB · 영속성 · FTS5 | [`arch/backend/persistence.md`](arch/backend/persistence.md) |
| 확장 배포 (MCP · SKILL.md · AGENTS.md 표준) | [`arch/backend/standardization.md`](arch/backend/standardization.md) |
| 시스템 프롬프트 · 정책 append | [`arch/backend/system-prompt.md`](arch/backend/system-prompt.md) |
| 로깅 | [`arch/backend/observability.md`](arch/backend/observability.md) |
| renderer 범위 · 스택 · 구현 상태 | [`arch/frontend/overview.md`](arch/frontend/overview.md) |
| renderer 4-layer · 디렉토리 책임 | [`arch/frontend/layers.md`](arch/frontend/layers.md) |
| renderer 상태 관리 (Zustand · 멀티세션) | [`arch/frontend/state.md`](arch/frontend/state.md) |
| 렌더링 (ToolRendererRegistry · 스트리밍 · UsagePanel) | [`arch/frontend/rendering.md`](arch/frontend/rendering.md) |
| UX 패턴 · 도메인 화면 카탈로그 | [`arch/frontend/ux-domains.md`](arch/frontend/ux-domains.md) |
| DOM 마커 체계 · z-stack · custom titlebar | [`arch/frontend/dom-architecture.md`](arch/frontend/dom-architecture.md) |
| **IPC 채널 계약** (추가·변경 포함) | [`IPC_CONTRACT.md`](IPC_CONTRACT.md) |
| **릴리스** 실행·롤백 | [`guides/release-operations.md`](guides/release-operations.md) |
| **폐쇄망 확장·로그인 게이트 추가** ("플러그인 추가" 요청 포함) | [`guides/closed-network-extensions.md`](guides/closed-network-extensions.md) |
| 도구 권한 · 작업 디렉토리 스코프 | [`guides/workspace-isolation-permissions.md`](guides/workspace-isolation-permissions.md) |
| **용어** 정의 | [`GLOSSARY.md`](GLOSSARY.md) · 쉬운 해설은 [`arch/frontend/terms.md`](arch/frontend/terms.md) · [`arch/backend/terms.md`](arch/backend/terms.md) |
| **왜 이 구조인가** (결정 근거) | [`decisions/`](decisions/) — ADR |
| 커밋 trailer 작성·파싱 | [`git-template.md`](git-template.md) |
| 코드에서 센 **수치** (채널·슬라이스·키·마이그레이션 수) | [`generated/inventory.md`](generated/inventory.md) — 생성물, 직접 편집 금지 |

## 계층 (무엇이 진실인가)

가장 위가 이긴다. 아래로 갈수록 *과거* 이고, 과거는 현재 규칙이 아니다.

| 계층 | 위치 |
|---|---|
| **실행 가능한 진실** | 코드 · 타입 · zod 스키마 · 테스트 |
| **현재 아키텍처** | [`arch/`](arch/) · [`IPC_CONTRACT.md`](IPC_CONTRACT.md) · [`GLOSSARY.md`](GLOSSARY.md) |
| **현재 제품 의도** | [`PRD.md`](PRD.md) · [`TRD.md`](TRD.md) |
| **작업 규칙** | 각 디렉토리의 `AGENTS.md` |
| **결정 근거** | [`decisions/`](decisions/) |
| **진행 중 작업** | [`handoff/INDEX.md`](handoff/INDEX.md) (보드) + `handoff/<NNNN-slug>/` |
| **과거 증거** | `git log` · [`archive/`](archive/) · `handoff/<NNNN-slug>/` · [`etc/`](etc/) · `chats/` |

## Evidence — 필요할 때만 읽는다

기본 세션에서 읽지 않는다. 근거를 거슬러 확인해야 할 때만 연다.

| 디렉토리 | 무엇 |
|---|---|
| [`decisions/`](decisions/) | ADR — 왜 그렇게 결정했나 |
| [`archive/`](archive/) | 완료된 페이즈·핸드오프 이력 (완료 이력의 정본은 `git log`) |
| [`etc/`](etc/) | 전략 문서 · 라이프사이클/오케스트레이션 일반론 · 외부 프로젝트 사례 연구(`study/`) |
| [`spec/`](spec/) | 외부 공식 문서 **원문 미러** — 편집 금지 ([`claude-code-spec.md`](claude-code-spec.md) 가 라우터) |
| `chats/` | 사용자 의도 트랜스크립트 (transcript ≠ 현재 요구·아키텍처·코딩 규칙) |
| `project/` | 디자인 프로토타입 아카이브 (시각 기준) |

> ⚠️ **`etc/study/orca/` 는 폐기됐다** — 요구명세 3건이 정정됐고 그 구현은 전면 제거됐다
> (사용자 지시 2026-08-10). **근거로 인용하지 않는다.**

> ⚠️ **`etc/lightweight-llm-strategy.md` 는 Orca 와 무관한 별도 제품 방향**이다 (로컬 4B LLM
> 이미지 센서 QA). 이 저장소에 구현체가 없다.

## 문서를 새로 둘 때

| 성격 | 위치 |
|---|---|
| 시스템이 **어떻게 구성돼 있는가** (서술) | `arch/` |
| 사람이 **무엇을 어떤 순서로 하는가** (지시) | `guides/` |
| **왜 그렇게 결정했나** | `decisions/` (ADR) |
| 코드 편집 시 지켜야 할 **작업 계약** | 해당 디렉토리의 `AGENTS.md` |
| 한 번 쓰고 끝나는 작업 지시 | `handoff/<NNNN-slug>/plan.md` |
| 코드에서 셀 수 있는 **수치** | 어디에도 쓰지 않는다 — `generated/inventory.md` 를 링크한다 |

작성 규약(한국어·표 위주·사실 복제 금지)은 [`AGENTS.md`](AGENTS.md).
