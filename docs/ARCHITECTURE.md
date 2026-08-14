# Architecture — 인덱스

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 성격: **목차/라우터만** — 실제 내용은 `arch/*` 가 소유. 여기서는 *어디로 가야 하는지* 만 안내한다.
> 관련 SSOT: [IPC_CONTRACT.md](./IPC_CONTRACT.md) (채널) · [GLOSSARY.md](./GLOSSARY.md) (용어) · [PRD.md](./PRD.md) · [TRD.md](./TRD.md)

## 1. 왜 분해했나

`BACKEND_ARCHITECTURE.md`(1028줄)·`FRONTEND_ARCHITECTURE.md`(824줄)가 Provider Runtime 정규화 계층 흡수 후 과대해져, AI agent 가 특정 영역만 빠르게 참조하기 어려웠다. 두 거대 문서를 영역별 파일로 분해하고(`arch/`), 참조는 **파일별 안정 §번호**(`<파일> §N`)로 둔다. 거대 문서가 아닌 나머지(PRD/TRD/IPC_CONTRACT/GLOSSARY)는 분해하지 않는다.

## 2. 파일 맵

### Backend (`arch/backend/`)

| 파일 | 내용 |
|---|---|
| [overview.md](./arch/backend/overview.md) | 범위·기술 스택·**프로세스 구조(main 수직 슬라이스 · contracts · infra)**·부트 시퀀스·구현 상태·참고 |
| [adapters.md](./arch/backend/adapters.md) | SessionAdapter·ClaudeAdapter 호출·ExtensionBuilder·SDKMessage→NormalizedEvent 정규화·인증 만료·SDK 채택 범위·확장 / 파일·리소스(Skills·Artifacts·로그) / **자산 변환 매트릭스 + Hook 정규화 모델**(구 ADAPTER_DESIGN_REVIEW 흡수) |
| [provider-runtime.md](./arch/backend/provider-runtime.md) | **범용 정규화 계층(정본 SSOT)** — NormalizedEvent·권한 정규화(PermissionBridge·ApprovalResolution·AppCommandPolicy·PermissionModeController)·SessionCapability·RevertManager·ErrorClassifier·AppMessagePart·Telemetry·AuthStore·AuditLog·ModelProviderConfig·매핑표·SDK 확정 절차 |
| [standardization.md](./arch/backend/standardization.md) | **배포 계층 표준화(정본 SSOT — provider-runtime.md 와 *짝*)** — standards-first 원칙·표준 택소노미(AGENTS.md·MCP·SKILL.md·hook)·표준/런타임 2계층·Engine 구체클래스(rule of three)·sources/dist+ExtensionDeployer·StandardConformance·AGENTS.md 채택 |
| [persistence.md](./arch/backend/persistence.md) | 2계층 영속성·로컬 DB·FTS5 |
| [auth.md](./arch/backend/auth.md) | **인증과 그 소비 경계 정본** — 책임 지도(Auth·Gate·Harness·Plugin·Usage)·`AuthDefinition`(소비 슬롯 없음)·`AuthMethod` 5분기(OAuth code→token 포함)·`Grant`·`AuthChange` 분류표·게이트 진리표와 이중 강제·Harness 실행 구성(augmenter·세대 fence·두 주입 채널·fingerprint)·Plugin/HarnessPlugin 구분·부팅 순서·뒤집으면 안 되는 결정 |
| [security.md](./arch/backend/security.md) | webPreferences·자격증명 모델(safeStorage)·MCP&Skill 통합 레이어·CSP·**§1.8 원격 전송 스택 단일화(Node `fetch` 금지 → Electron `net.fetch`, 0173/0174)**·**§1.9 `infra/net/` 인벤토리** |
| [runtime-ipc.md](./arch/backend/runtime-ipc.md) | 동시성 모델·IPC 핸들러 구조·시스템 통합 |
| [terms.md](./arch/backend/terms.md) | **사람용 용어 해설** — 백엔드 요소 이름을 쉬운 한국어로(정의는 GLOSSARY/arch 정본 링크). AI 정본 아님 |

### Frontend (`arch/frontend/`)

| 파일 | 내용 |
|---|---|
| [overview.md](./arch/frontend/overview.md) | 범위·기술 스택·구현 상태·참고 |
| [layers.md](./arch/frontend/layers.md) | 4-layer(app/pages/features/shared)·디렉토리 책임·ESLint boundaries·App Shell 조립 |
| [dom-architecture.md](./arch/frontend/dom-architecture.md) | `app-frame-*` 마커 체계·`data-*` 속성·z-stack·custom titlebar |
| [state.md](./arch/frontend/state.md) | 상태 관리·Zustand 전환 결정·멀티세션 anchor |
| [rendering.md](./arch/frontend/rendering.md) | 렌더링 전략·**ToolRendererRegistry**·StructuredOutput·Streaming lifecycle·UsagePanel(사용량 도넛/한도) |
| [ux-domains.md](./arch/frontend/ux-domains.md) | UX 패턴·**ApprovalCard 일반화**·도메인 카탈로그·IPC 호출 |
| [terms.md](./arch/frontend/terms.md) | **사람용 용어 해설** — 프론트엔드 요소 이름을 쉬운 한국어로(정의는 GLOSSARY/arch 정본 링크). AI 정본 아님 |

### 그 외

| 파일/디렉토리 | 역할 |
|---|---|
| [IPC_CONTRACT.md](./IPC_CONTRACT.md) · [GLOSSARY.md](./GLOSSARY.md) | SSOT (채널 / 용어) — 분해 안 함 |
| [claude-code-spec.md](./claude-code-spec.md) | `spec/claude/` 원문 미러로 가는 **라우터**(Orca 합성분은 arch/backend 로 이관됨) |
| `spec/claude/` | 외부 공식 문서 원문 미러 (편집 금지) |
| `etc/` | 전략·별도 제품 방향·외부 사례 연구 문서 (llm-chat-desktop-strategy · lightweight-llm-strategy · `study/`) |
| `guides/` | 운영 절차서 — 릴리스·폐쇄망 확장·workspace 권한 구성. 디렉토리 정책은 [guides/AGENTS.md](./guides/AGENTS.md) |

## 3. 구 §번호 → 새 파일 §번호 매핑 (옛 참조 추적용)

> 분해 전 `BACKEND §N` / `FRONTEND §N` 참조를 보던 문서·기억을 위한 변환표. 새 참조는 `<파일> §K` 를 쓴다.

**Backend** (`BACKEND_ARCHITECTURE.md` 구 §)

| 구 § | 새 |
|---|---|
| §1·§2·§3 | overview.md §1·§2·§3 |
| §4 (4.1~4.8) | adapters.md §1 (1.1~1.9) |
| §5 | runtime-ipc.md §1 |
| §6 | persistence.md §1 |
| §7 | adapters.md §2 |
| §8 (8.1~8.6) | security.md §1 (1.1~1.6) |
| §9 | runtime-ipc.md §2 |
| §10 | runtime-ipc.md §3 |
| §11 | overview.md §4 |
| §12 (12.0~12.12) | provider-runtime.md §1~§13 |
| §13 참고 | overview.md §5 |
| (구 ADAPTER_DESIGN_REVIEW §5·§6) | adapters.md §3 |

**Frontend** (`FRONTEND_ARCHITECTURE.md` 구 §)

| 구 § | 새 |
|---|---|
| §1·§2 | overview.md §1·§2 |
| §3 (3-1·3-2·3.1·3.2·3.A) | layers.md §1 |
| §3.3 | dom-architecture.md §1 |
| §4 | state.md §1 |
| §5 | state.md §2 |
| §6 (6.1~6.9) | rendering.md §1 |
| §7 | ux-domains.md §1 |
| §8 | ux-domains.md §2 |
| §9 | ux-domains.md §3 |
| §10 | overview.md §3 |
| §11 | overview.md §4 |
