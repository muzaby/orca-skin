# Verify — 0019-test-abi-green

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(테스트/빌드 인프라) 작업 — Claude 직접 구현의 **검증 라운드**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0019-test-abi-green` |
| 검증자 | Claude Code |
| 일자 | 2026-07-09 |
| 대상 커밋 | `555fbb5` (chore(test): better-sqlite3 ABI 게이트 자동화) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요약 (plan 이 stale 하다 — 현재 코드 환경 기준 검증)

plan 은 **2026-06-14 초기 개발환경**에서 작성됐고(`377/377` tests · Node 24 ABI 137 · `src/main/db/queries.test.ts`), 구현 커밋 `555fbb5` 는 **2026-07-10** 에 0086 까지 진행된 현재 코드 위에 올라갔다(브랜치 HEAD). 그 사이 main 이 feature 슬라이스로 분해(`db/` → `infra/db/`)되고 테스트 수가 784 규모로 늘었으며 런타임이 Node 22(ABI 127)로 바뀌었다. 따라서 **plan 의 숫자·경로가 아니라 현재 코드 환경을 기준으로** 인수 기준을 대조한다(사용자 지시 + 구현자 `[구현자 기입] 현재 커밋 기준 보정`).

핵심 결과: 0019 가 겨냥한 **"영구 red 9건(=`db/queries.test.ts` ABI 불일치)"이 자가치유 `pretest` 훅으로 해소**됐다. 신선한 트리 상태(`node_modules` 미빌드)에서 `npm test` 한 번으로 `ensure-sqlite-abi.mjs node` 가 로드 실패를 감지→`npm rebuild better-sqlite3`→DB 테스트가 **수동 rebuild 없이 green** 이 됐다.

### 환경 제약 (전면 공개)

본 검증 샌드박스는 **egress 정책상 Electron 바이너리 다운로드(github releases)가 403 차단**된다. 그래서:
- `npm install` 을 온전히 못 돌려 `--ignore-scripts`+`ELECTRON_SKIP_BINARY_DOWNLOAD=1` 로 JS 의존만 설치하고, `pretest` 자가치유가 native better-sqlite3 를 Node ABI 로 빌드하도록 했다.
- `electron` 을 **transitive import** 하는 테스트 스위트 3개(`chat-turn.continuity`·`chat-turn.runtime-resilience`·`history/writer`)는 `Electron failed to install correctly` 로 로드 실패한다 — **0019 와 무관**(0019 diff 는 `src/**` 무변경, 세 스위트는 부모 커밋에도 존재).
- **`npm run dev`/`npm run build` 및 순서-무관 스모크(인수 2·6-build)는 Electron 바이너리가 없어 본 샌드박스에서 실행 불가.** 해당 경로의 로직(electron-ABI ensure)은 단위 테스트 + `--check` 불일치 검출로 대리 검증했다(아래 매트릭스 참조). 실제 electron-vite build/dev 실기는 **사람 확인 대기**.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 방향 동의(dual-ABI 제거 대신 진입점별 자기-ABI 보장) | 타당 | 매트릭스 #3 근거 |
| `377/377` 숫자 stale, 현재 `vitest 784 + node:test 6` | 타당(확인) | 위 "요약" — 현재 환경 기준 대조로 대체 |
| Electron fast-path 를 단순 marker 가 아닌 **fingerprint**(electron/better-sqlite3 ver·Node ABI·lockfile hash) | 타당·설계보강 | 매트릭스 #3·#5 근거(marker 실측 첨부) |
| `build:mac`/`build:linux` 를 공통 `build` 로 정렬(prebuild ABI·typecheck 우회 제거) | 타당·회귀예방 | 매트릭스 #2 근거(코드 확인) |
| lint 대상 `./scripts` 확장 + ESM override | 타당 | 매트릭스 #6(lint green) |
| ✅ `require()` 만으론 ABI mismatch 미검출 → 별도 프로세스 `new Database(':memory:')` probe | 타당(핵심) | `ensure-sqlite-abi.mjs:44-49` 확인 |
| ✅ `--check` 사이드이펙트 분리 / ✅ fake runner seam / ✅ test↔build 역방향 | 타당 | 매트릭스 #5·#3 근거 |

## 요구사항 충족 매트릭스

> plan 숫자(377)는 stale — 현재 환경 실측으로 대조. 증거는 본 검증 세션 실행 출력.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 테스트 게이트 정직 green — 신선 트리에서 **수동 rebuild 없이** DB 테스트가 실제 better-sqlite3 로 green | ✅ (핵심) | `pretest` → `[sqlite-abi] node: rebuilt` (로드 실패 감지 후 자동 `npm rebuild`) → `vitest` **773 passed**. `infra/db/{queries,migrate}` + `settings-migration` **27/27 green**(실제 `:memory:`). 0019 의 "영구 9-red" 해소. ⚠️ electron transitive 3스위트(11 tests)는 바이너리 403 로 로드불가 — 0019 무관(환경). |
| 2 | dev/build 무회귀 — 수동 rebuild 없이 Electron ABI 산출물 정상 | ⏳ 사람 | **본 샌드박스 실행 불가**(Electron 바이너리 403). 코드: `predev`/`prebuild`/`build:{mac,linux}` 모두 `ensure-sqlite-abi.mjs electron` 경유(`package.json`), electron-ABI ensure 로직은 단위 테스트로 검증(#3·#5). 실기 = 사람 확인 대기. |
| 3 | 각 진입점 자기-ABI 보장(멱등·고속) | ✅ | `pretest`=node(probe)·`predev`/`prebuild`/`postinstall`=electron(marker) 배선 확인. 재실행 `[sqlite-abi] node: already ok` **0.098s**(rebuild 없음, 멱등 fast-path). 단위: `electron target fast-paths when fingerprint marker matches`. |
| 4 | 단일 진실원 | ✅ | 전 로직 `app/scripts/ensure-sqlite-abi.mjs` 1곳. `postinstall` 을 `install-app-deps` → `ensure-sqlite-abi.mjs electron`(내부적으로 동일 `electron-builder install-app-deps` 호출)로 **통일**(plan 인수4 "택1" 의 통일 옵션 선택). |
| 5 | 회귀 가드(`--check` 종료코드) | ✅ | `node --check` → exit 0 "checked"(사이드이펙트 0). `electron --check`(marker=node 상태) → **exit 1 "check failed"**(rebuild 안 함) — wrong-ABI 조용히 통과 경로 차단. `bogus` → usage 에러 exit 1. `node:test` **6/6**. |
| 6 | 게이트 통과 + 순서무관 스모크 | ✅ 부분 / ⏳ build | `npm run lint`(+`./scripts`) **exit 0**, `npm run typecheck`(node/web/test) **exit 0**, `node:test` **6/6**, vitest **773 passed**(전술 electron 3스위트 환경 제외). **build 게이트·test↔build 양방향 스모크는 Electron 바이너리 403 로 실행 불가** → 사람 확인 대기. |
| 7 | 문서 — `app/AGENTS.md` dual-ABI 노트 + `docs/PHASES.md` 승격 | ✅ | `app/AGENTS.md` "빌드/실행" 표·"DB·캐시 정책" 에 `ensure-sqlite-abi.mjs` 진입점 보장 노트 반영(구현 커밋). `docs/PHASES.md` 행 승격 = **본 verify 라운드**. IPC/스키마/renderer 무변경 → IPC_CONTRACT 무관. |

**판정**: 인수 5/7 완전 충족(1·3·4·5·7), 2·6 은 **Electron 바이너리 egress 차단이라는 환경 제약**으로 본 샌드박스 미실행 — 로직은 단위/`--check`로 대리 검증됨. 0019 의 **핵심 목표(정직-green 자가치유 ABI 게이트)는 실측 달성**. 남은 electron path 실기는 검증 책임 분리표상 **사람 확인 대기**로 이관 → **PASS**.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck | ✅ 실행 | — | 둘 다 exit 0 |
| 게이트 test(vitest+node:test) | ✅ 실행 | — | 773 + 6/6 green(electron 3스위트 환경 제외) |
| 게이트 build / test↔build 스모크 | ✖ 실행불가(env) | ✅ 실기 | **사람 확인 대기**(Electron 바이너리 403) |
| dev/build electron ABI 실기(인수 2) | ✖ | ✅ | **사람 확인 대기** |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거 | 이견 시 중재 | 매트릭스 |
| 레이어 경계 위반 0 | ✅ | — | scripts/·package.json 만(main/renderer 무변경, boundaries 영향 0) |
| 문서 형식/링크/한국어 | ✅ | — | AGENTS.md·PHASES 갱신 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 혼입 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm test        # pretest 자가치유 후
> pretest: node scripts/ensure-sqlite-abi.mjs node
rebuilt dependencies successfully
[sqlite-abi] node: rebuilt
> vitest run
 Test Files  3 failed | 101 passed (104)   # 3 failed = electron 바이너리 403(transitive), 0019 무관
      Tests  773 passed (773)

$ npx vitest run src/main/infra/db/ src/main/infra/settings-migration.test.ts
 Test Files  3 passed (3)   Tests  27 passed (27)   # 0019 핵심(better-sqlite3 :memory:) — 정직 green

$ node --test scripts/ensure-sqlite-abi.test.mjs
 # tests 6  # pass 6  # fail 0

$ npm run lint        # → exit 0 (eslint ./src ./scripts)
$ npm run typecheck   # → exit 0 (node + web + test)

# 멱등·회귀가드 실측
$ node scripts/ensure-sqlite-abi.mjs node          → [sqlite-abi] node: already ok   (0.098s)
$ node scripts/ensure-sqlite-abi.mjs node --check   → exit 0  (checked, no side effect)
$ node scripts/ensure-sqlite-abi.mjs electron --check → exit 1  (mismatch detected, no rebuild)
$ node scripts/ensure-sqlite-abi.mjs bogus          → exit 1  (usage error)
```

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: `app/AGENTS.md` 변경분(빌드/실행 표 + DB·캐시 노트)에 비밀·개인정보 혼입 **0**.
- 변동성/일회성/장문 코드설명서 혼입: 없음 — dual-ABI 진입점 보장은 영속 작업 규칙(적절).

## PHASES.md 정합성

- 형식/커밋 기재: `0019-test-abi-green` 행을 페이즈 표(0018↔0020 사이)에 **완료 (커밋 `555fbb5`)** 로 승격.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 이 초기 환경(377·Node 24·`db/queries.test.ts`)에 고정돼 stale 했다. 구현자가 현재 커밋 기준으로 보정했으나, plan 을 "환경-불변 인수(숫자 대신 '정직 green·수동 rebuild 0·멱등')"로 썼다면 stale 이 안 됐다. 교훈: 인프라 게이트 plan 은 절대 숫자 대신 **불변식**으로 인수를 표현.
- **구현 단계**: fingerprint(단순 marker → 버전/lockfile 해시)·`build:{mac,linux}` 정렬은 plan 을 넘어선 타당한 선조치. `postinstall` 통일도 인수4 를 잘 만족. 흠결 없음.
- **검증 단계**: 본 verify 가 **Electron 바이너리 egress 차단으로 dev/build 실기(인수 2·6-build)를 실행하지 못했다** — 이는 검증의 최대 공백. electron-ABI ensure 는 단위 테스트·`--check`로 대리 검증했으나 실제 electron-builder 재빌드 경로는 미실행. 네트워크 완전 환경에서의 build 스모크는 사람/후속에 맡긴다.

## 결론 / 다음 단계

- **상태: PASS** — 0019 의 핵심 목표(자가치유 ABI 게이트 → DB 테스트 정직 green, 수동 rebuild 0)를 현재 코드 환경에서 실측 달성. 인수 1·3·4·5·7 완전 충족, 2·6 은 환경 제약(Electron 바이너리 403)으로 대리 검증 + 사람 확인 대기.
- `docs/PHASES.md` 승격, `INDEX.md` `verify/PASS`.
- **사람 확인 대기**: 네트워크 완전 환경에서 (a) `npm install` 온전 실행(electron 바이너리 포함) 후 `npm test` 784 green, (b) `npm run dev`/`npm run build` electron ABI 무회귀, (c) `npm test && npm run build` ↔ `npm run build && npm test` 순서-무관 스모크.
