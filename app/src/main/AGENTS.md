# `src/main/` — Main 프로세스 레이어 가이드 (코딩 에이전트용)

Electron **main 프로세스**(SDK 호출·IPC·DB·보안이 모이는 곳)의 모듈 레이어 규칙. renderer 4-layer 처럼 **하향 의존만 허용**하고 상위 참조를 금지한다 — `eslint-plugin-boundaries` + `import/no-cycle` 로 빌드 시 강제(`app/eslint.config.mjs` 의 `src/main/**`·`src/shared/**` 블록). 위반은 `npm run lint` error.

> 정본 우선: 채널 계약은 [`../../../docs/IPC_CONTRACT.md`](../../../docs/IPC_CONTRACT.md), 범용 정규화 계층은 [`../../../docs/arch/backend/provider-runtime.md`](../../../docs/arch/backend/provider-runtime.md). 본 문서는 *레이어 방향* 규칙만 담는다.

## 레이어 DAG (하향 의존만)

```
L3 ipc        →  L2 adapters · L1 domain · L0 shared        (컴포지션 루트/오케스트레이션)
L2 adapters   →  L1 domain · L0 shared                      (SessionAdapter 구현 + 어댑터 오케스트레이션)
L1 domain     →  L1 domain(동일 레이어) · L0 shared          (도메인/인프라 — 순환은 no-cycle 가 차단)
L0 shared     →  L0 shared                                  (순수 타입/상수/스키마 — 내부 의존 0)
```

**누구도 ipc(L3)를 의존하지 않는다.** 상위 참조(예: domain → ipc, adapters → ipc, shared → main)는 error.

## 레이어 ↔ 디렉토리 매핑

| 레이어 | 디렉토리 | 책임 | 의존 허용 |
|---|---|---|---|
| **L0 shared** | `src/shared/` (`ipc.ts`·`protocol.ts`·`permission-mode.ts`) | 순수 타입·상수·zod 스키마. 런타임 의존 0. | shared |
| **L1 domain/infra** | `src/main/{db,config,settings,usage,cost,mcp,runtime-errors,runtime-events,capabilities,extensions,deploy,skills,ask,files,title,lifecycle,prompts}` | DB·설정·MCP·런타임·정규화 조각 등. 어댑터/IPC 비의존. | domain(동일 레이어) · shared |
| **L2 adapters** | `src/main/{adapters,installer}` | `SessionAdapter` 구현(claude·mock) + 어댑터 오케스트레이션(`installer` 는 `AdapterRegistry` 사용). | adapters · domain · shared |
| **L3 ipc** | `src/main/ipc/**` (router·handlers·chat) | IPC 라우팅·zod 검증·턴 오케스트레이션·persist. 컴포지션 루트. | ipc · adapters · domain · shared |
| **컴포지션 루트** | `src/main/index.ts` | 부팅 배선. 하위 전부 의존 허용(구체 엔진명 리터럴 허용 — 1회성 배선). | 전부 |

> `boundaries/elements` 의 분류 순서는 specific→catch-all(`ipc`·`adapters`·`installer` 가 `src/main/*` 보다 먼저). 새 디렉토리는 기본적으로 L1 domain(`src/main/*`)으로 분류된다 — 어댑터/IPC 성격이면 elements 에 명시 추가.
> `src/main/orchestration/` 는 0061 에서 제거됐다. Future handoff/fork/continuity 같은 진짜 오케스트레이션 모듈을 재도입할 때는 기본적으로 L1 domain 으로 두고, IPC 라우팅이나 어댑터 구현을 직접 담는 경우에만 boundaries elements 를 별도 조정한다.

## 두 가지 강제 규칙

1. **`boundaries/dependencies`** — 위 DAG 의 하향 방향만 허용(상위 참조 error). *레이어 방향* 만 본다.
2. **`import/no-cycle`** — 같은 레이어 내부 순환(예: L1 `config↔mcp`, 0011 버그 클래스)까지 빌드 에러로 차단. boundaries 가 못 보는 동일-레이어 순환의 안전망. (TS 파서를 `import/parsers` 로 등록해야 의존 `.ts` 를 따라간다 — config 참고.)

## 작업 규칙

- **상위를 참조하고 싶으면 의존을 뒤집어라.** 콜백/인터페이스 주입(컴포지션 루트가 배선)으로 방향을 하향으로 유지한다. 예: `Installer` 는 `AdapterRegistry`(L2)를 생성자 주입받는다(L2 내부).
- **같은 레이어 순환이 필요해 보이면** 공통 조각을 더 낮은 레이어(또는 별도 모듈)로 추출한다 — `import/no-cycle` 가 강제.
- **구체 provider/engine 리터럴**(`'claude'` 등)은 `adapters`·`capabilities`·`deploy`(레지스트리)·컴포지션 루트(`ipc/router.ts`·`index.ts`) 안에만. 코어·오케스트레이션은 백엔드 중립(handoff 0016).
- 모듈이 4책임 이상으로 비대해지면(junk-drawer) 응집 단위로 분해한다(0017 D2: `provider-settings.ts` → `provider-registry`·`model-resolve`·`env-merge`·서비스). 외부 import 가 많으면 배럴 re-export 로 무회귀 분해.
