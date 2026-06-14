# Plan — 0019-test-abi-green

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(테스트/빌드 인프라) 작업 — **Claude 직접 구현**.
> 0010~0018 구조 재설계 감사(plan-eng-review, 2026-06-14)의 후속: 게이트 위생 1건.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0019-test-abi-green` |
| 작성자 | Claude Code |
| 일자 | 2026-06-14 |
| 매핑 | PHASES "게이트 위생(better-sqlite3 ABI)" 행 (구조 감사 후속) |
| 상태 | READY (다음=Claude — 비기능 직접 구현) |

## Context (왜)

`npm test`(vitest) 가 **상시 9건 red** 다 — 전부 `src/main/db/queries.test.ts`. 실패 원인은 코드가 아니라 **네이티브 모듈 ABI 불일치**:

```
better-sqlite3 = 단일 컴파일 산출물(.node) · 소비자 둘 · ABI 상충
  postinstall: electron-builder install-app-deps  →  Electron 39 V8  →  NODE_MODULE_VERSION 140
  npm test:    vitest run                          →  Node 24         →  NODE_MODULE_VERSION 137
                                                         ▲ 한 산출물로 둘 다 만족 불가 ▲
```

- 에러 실측: `The module better_sqlite3.node was compiled against a different Node.js version using NODE_MODULE_VERSION 140. This version of Node.js requires NODE_MODULE_VERSION 137.`
- `postinstall` 의 `electron-builder install-app-deps` 가 설치 직후 better-sqlite3 를 **Electron ABI(140)** 로 빌드한다(= `npm run dev`/`build` 정상). 그런데 vitest 는 플레인 Node(137) 로 도는 별개 런타임이라 같은 `.node` 를 못 읽는다.
- **검증된 사실(2026-06-14)**: `npm rebuild better-sqlite3`(Node ABI 137) 후 `db/queries.test.ts` **9/9 green → 전체 377/377**. 단 이러면 better-sqlite3 가 Node ABI 로 남아 `npm run dev` 가 깨진다(역방향).

### 왜 위험인가 (감사 지적)

이 red 9건이 **9개 verify 문서(0007·0009·0010·…)에서 연속으로 "변경 무관"으로 설명되고 넘어간** 패턴이다. 영구 red 는 리뷰어를 "red 무시"로 훈련시켜 **다음 진짜 회귀를 가린다**(systems-over-heroes / failure-is-information 안티패턴). 게이트는 정직하게 green 이어야 신호가 산다.

### 설계 제약 — dual-ABI 는 없앨 수 없다

Electron 의 V8 module version 과 플레인 Node 의 그것은 본질적으로 다르고, 하나의 `.node` 가 동시에 둘을 만족할 수 없다. 따라서 목표는 "충돌 제거"가 아니라 **"각 진입점이 들어올 때 자기 ABI 를 보장"** 하는 것이다(`fetch-uv` 의 멱등 초기화 패턴과 동형 — 사람이 ABI 를 의식하지 않게).

### 검토 후 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| DB 테스트를 mock/`it.skip` | `queries.test.ts` 는 **실제 better-sqlite3 `:memory:`** 로 SQL·마이그레이션을 검증하는 게 목적 — mock 은 커버리지 소실, skip 은 정직-green 아님(사용자가 "정직한 green 복구" 채택). |
| vitest 를 Electron 런타임으로 | 테스트 러너 전면 교체 = 과한 blast radius, 플레인-Node 단위 테스트 원칙(`app/AGENTS.md` "electron 비의존")과 배치. |
| `pretest` 로 Node 빌드만 (역복구 없음) | 테스트 후 better-sqlite3 가 Node ABI 로 남아 `npm run dev` 가 조용히 깨짐 — footgun 이전. |
| CI 워크플로 신설 | **CI 없음**(`.github/workflows` 부재) — 본 핸드오프는 로컬 게이트 정직-green 까지. CI 도입은 별도 scope(아래 비범위). |

## 인수 기준 (Acceptance Criteria)

1. **테스트 게이트 정직 green**: 신선한 체크아웃에서 `cd app && npm install && npm test` 가 **수동 rebuild 없이** 377/377 green. `db/queries.test.ts` 는 실제 better-sqlite3 로 돌며(mock/skip 아님) 통과한다.
2. **dev/build 무회귀**: `npm run dev`(predev)·`npm run build`(prebuild) 가 **수동 rebuild 없이** Electron ABI(140) 산출물로 정상 동작한다 — 테스트 직후 곧장 dev 를 띄워도 깨지지 않는다.
3. **각 진입점 자기-ABI 보장(멱등·고속)**: ABI 정렬을 진입점 훅으로 자동화한다 — `pretest` = Node ABI, `predev`/`prebuild` = Electron ABI. ABI 가 이미 맞으면 **재빌드 없이 빠르게 통과**(멱등; `fetch-uv` 멱등 패턴 동형). 마커/상태로 불필요 재빌드를 피한다.
4. **단일 진실원**: ABI 보장 로직은 **한 곳**(예 `scripts/ensure-sqlite-abi.mjs <node|electron>`)에 둔다 — 각 스크립트가 중복 인라인하지 않는다. `postinstall` 은 Electron ABI(현행 `install-app-deps`) 의미를 유지하거나 동일 보장 경로로 통일한다.
5. **회귀 가드**: 보장 스크립트가 ABI 불일치를 감지하는 단위/스모크 검증(혹은 `--check` 종료코드)으로, "조용히 wrong ABI 로 남는" 경로가 없음을 보인다.
6. 게이트 통과: `npm run lint` · `npm run typecheck` · `npm test`(**377/377**) · `npm run build`. 추가로 *순서 무관* 스모크: `npm test && npm run build` 와 `npm run build && npm test` 가 둘 다 green(진입점 자기-치유 확인).
7. 문서: `app/AGENTS.md` "빌드/실행" 표 + "DB·캐시 정책" 에 dual-ABI 진입점 보장 노트, `docs/PHASES.md` 행 승격. (IPC/스키마/renderer 변경 0 → IPC_CONTRACT 무변경.)

## 범위 / 비범위

- **범위**: 인수 1~7. `app/package.json` 스크립트 훅 + `app/scripts/ensure-sqlite-abi.mjs`(신규, 멱등) + 보장 스크립트 단위/스모크 + `app/AGENTS.md`·`docs/PHASES.md` 동기화.
- **비범위**: CI 워크플로 신설(현재 부재 — 별도 scope; 단 본 작업의 `pretest` 훅이 미래 CI 를 자동 green 으로 만든다), 테스트 러너 교체, better-sqlite3 버전 변경, Drizzle/ORM, DB 스키마·queries 로직 변경(0), renderer/IPC 변경(0).

## 설계

- **멱등 보장 스크립트** `scripts/ensure-sqlite-abi.mjs <target>`:
  - `target=node`: 현재 Node 런타임에서 `better-sqlite3` 로드 시도 → 성공하면 **즉시 종료(fast path)**, 실패(ABI 에러)면 `npm rebuild better-sqlite3` 후 마커 기록.
  - `target=electron`: 마지막 빌드 타깃 마커(`<userData> 아님 — 빌드 산출물 옆 `.sqlite-abi`)가 `electron` 이면 종료, 아니면 `electron-builder install-app-deps`(현 postinstall 과 동일 도구) 후 마커 기록. (플레인 Node 에서 Electron-로드 직접 검증 불가하므로 **마커 기반 멱등** — `fetch-uv` 가 산출물 존재로 멱등 판정하는 것과 동형.)
  - 첫 컨텍스트 전환 1회만 재빌드 비용(~10–20s) 지불, 이후 통과는 즉시.
- **스크립트 배선**(`package.json`):
  - `pretest`: `node scripts/ensure-sqlite-abi.mjs node`
  - `predev`: 기존 `fetch-uv` + `node scripts/ensure-sqlite-abi.mjs electron`
  - `prebuild`(신규) 또는 `build` 선두: `node scripts/ensure-sqlite-abi.mjs electron`
  - `postinstall`: 현행 `electron-builder install-app-deps` 유지(또는 `ensure-sqlite-abi.mjs electron` 으로 통일) — 인수 4 단일 진실원에 맞춰 구현이 택1.
- **재사용**: `scripts/fetch-uv.mjs` 의 멱등 스크립트 패턴(상태/마커), `electron-builder install-app-deps`(postinstall 기존 사용), `npm rebuild`.
- **레이어 경계**: 빌드 스크립트(`scripts/`)·`package.json` 만 — main/renderer 소스 무변경, `eslint-plugin-boundaries`(0017) 영향 0.
- **gitignore**: ABI 마커 파일은 `.gitignore`(빌드 로컬 상태 — uv 바이너리와 동일 취급).

## 영향 받는 파일

- `app/package.json` — `pretest`·`predev`(확장)·`prebuild` 훅, (택1) `postinstall` 통일
- `app/scripts/ensure-sqlite-abi.mjs` (신규, 멱등 보장 + `--check`)
- `app/scripts/ensure-sqlite-abi.test.mjs` 또는 vitest 단위 (신규 — 인수 5 회귀 가드)
- `app/.gitignore` (ABI 마커)
- `app/AGENTS.md` — "빌드/실행" 표 + "DB·캐시 정책" dual-ABI 노트
- `docs/PHASES.md` — 행 승격

## 참고 문서

- `app/AGENTS.md` "빌드/실행" · "DB·캐시 정책"(better-sqlite3@12 = Electron 39 V8 ABI 호환 명시 — 본 작업이 *테스트* ABI 분리를 보강)
- `docs/PHASES.md` (uv 런타임 행 — 멱등 초기화 선례)
- IPC 변경 없음 → `docs/IPC_CONTRACT.md` 무관

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`(**377/377**) `&& npm run build`.
- 순서-무관 스모크(인수 6): `npm test && npm run build` 와 `npm run build && npm test` 양방향 green.
- 신규 테스트 요구: `ensure-sqlite-abi` 멱등/`--check` 종료코드 단위 검증(인수 5).

---

## [구현 기입] 구현 체크리스트

- [ ] `scripts/ensure-sqlite-abi.mjs` 멱등 보장(node/electron) + `--check`
- [ ] `package.json` pretest/predev/prebuild 배선 + postinstall 정합
- [ ] 보장 스크립트 단위/스모크 테스트
- [ ] `.gitignore` 마커
- [ ] `app/AGENTS.md` · `docs/PHASES.md` 동기화

## [구현 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` / `build` |
| 게이트 결과 | lint … / typecheck … / test … / build … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |
