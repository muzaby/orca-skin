# ADR-002 — main 은 feature 수직 슬라이스로 가르고, 교차 import 를 금지한다

## 문제

Electron main 프로세스는 SDK 호출·IPC·DB·보안이 한곳에 모이는 자리다. 레이어를 기술 종류로만
가르면(`services/`·`utils/`·`models/`) 한 기능을 고치려고 네 디렉토리를 오가게 되고, 모듈이
서로를 자유롭게 부르면서 순환 의존이 자란다.

renderer 는 이미 4-layer(`app`/`pages`/`features`/`shared`)를 ESLint 로 강제하고 있었는데
main 에는 대응하는 경계가 없었다.

## 검토한 선택지

| 안 | 내용 | 판단 |
|---|---|---|
| A. 기술 레이어(services/utils/models) | 종류별로 가른다 | 기각 — 한 기능이 모든 디렉토리에 흩어진다 |
| B. 전면 ports & adapters | 모든 경계를 포트로 추상화 | 기각 — 대부분의 경계에 구현이 하나뿐이라 추상화 비용만 남는다 |
| C. **feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app 컴포지션 루트** | 도메인별로 세로로 가르고, 실제로 교체 가능한 곳(`SessionAdapter`)에만 포트를 둔다 | **채택** |

## 선택

하향 한 방향만 허용하는 DAG:

```text
app        → 전부                                                  (컴포지션 루트)
features/<X>/ → 같은 feature · contracts · adapters · infra · shared  (수직 슬라이스)
contracts  → contracts · adapters · infra · shared
adapters   → adapters · adapter-impl · infra · shared
infra      → infra · shared
shared     → shared 내부만
```

**feature 끼리는 직접 import 하지 않는다.** 교차가 필요하면 셋 중 하나로 푼다 —
① 공유 *타입*을 `contracts/` 로 승격 ② **구조적 포트**로 결합 절단(소비 측이 필요한 메서드만
인라인 인터페이스로 받는다) ③ 컴포지션 루트가 concrete 를 **주입**.

## 포기한 것

- **편의로서의 직접 참조.** 다른 슬라이스의 함수 하나를 쓰려 해도 위 세 경로 중 하나를 타야 한다.
- **완전한 교체 가능성.** `adapters` 밖에는 포트를 두지 않으므로, 나중에 다른 구현이 필요해지면
  그 지점에서 포트를 새로 판다(rule of three).

## 생긴 invariant

- **하향 의존만.** 상위·교차 참조는 `npm run lint` **error** 다
  (`eslint-plugin-boundaries` v6 `boundaries/dependencies`).
- **같은 레이어 내부 순환도 빌드 에러** (`import/no-cycle`).
- **`src/main` 최상위는 `{app, contracts, adapters, features, infra}` + `index.ts`·`env.d.ts` 뿐.**
  어디에도 안 맞는 새 디렉토리는 boundaries "no element" error 가 난다.
- **구체 엔진명 리터럴**(`'claude'` 등)은 `adapters`·`features/extensions`·
  `features/providers/declarations/`·컴포지션 루트 안에만. 코어·오케스트레이션은 백엔드 중립.
- **누구도 `app` 을 의존하지 않는다.**

## 관련

작업 규칙(정본): [`app/src/main/AGENTS.md`](../../app/src/main/AGENTS.md) ·
강제 설정: `app/eslint.config.mjs` 의 `src/main/**`·`src/shared/**` 블록 ·
renderer 대응 규칙: [`app/src/renderer/AGENTS.md`](../../app/src/renderer/AGENTS.md)
