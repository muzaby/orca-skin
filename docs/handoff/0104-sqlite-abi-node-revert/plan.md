# Plan — 0104-sqlite-abi-node-revert

> 비기능(버그수정 + 가이드) = Claude 직접 구현. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.
> 원류 스레드: `0103-dev-db-userdata-isolation`(sqlite dev-db/ABI 클러스터). 동일 브랜치 후속.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0104-sqlite-abi-node-revert` |
| 작성자 | Claude Code |
| 일자 | 2026-07-14 |
| 매핑 | (PR 미요청) · 원류 0103 |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "npm install 이후 npm run dev 시 sqlite가 node 버전에서 안바뀐다. 핸드오프에서 이어서 하되 문제 분석하라" | 라이브 세션 |
| 명시 요구 ② | "에이전트가 코드 수정 시 lint/tsc/format 을 자주 쓰는데 이후 빌드가 ABI 때문에 실패한다. 고려하여 검토하라" | 라이브 세션 |

## Context (왜)

`npm install` 후 `npm run dev` 시 better-sqlite3 가 Electron ABI 로 안 바뀌고 Node ABI 에 고착 →
Electron 이 Node-ABI 바이너리를 로드하다 `NODE_MODULE_VERSION` 불일치로 실패. `predev` 가 도는데도
전환이 안 되는 게 핵심 증상.

## 문제 분석 (Root Cause)

`scripts/ensure-sqlite-abi.mjs` 의 **electron 판정이 마커 메타데이터만 보고 실제 바이너리 ABI 를
확인하지 않는다**(binary-blind). node 판정은 실제 로드 프로브를 쓰는데 electron 은 안 써 비대칭.

- `needsRebuild` (`ensure-sqlite-abi.mjs:115-121`): node = `!loadBetterSqlite`, electron = `!markerMatches`만.
- `computeFingerprint` (`:66-78`) 필드 중 **어느 것도 `.node` 가 어떤 ABI 로 빌드됐는지 인코딩하지 않는다**
  (`nodeModulesVersion` 은 스크립트를 돌리는 plain Node 값이라 node·electron 실행에서 동일).
- 재현: ① dev 성공 → 마커 `{target:electron}`·바이너리 Electron. ② `npm install` → better-sqlite3 의
  prebuild-install 재실행이 **바이너리를 Node-ABI 로 되돌림**, 마커는 그대로 electron. ③ postinstall
  electron → `markerMatches(electron,electron)=true` → **fast-path skip**. ④ predev 도 skip → Electron
  이 Node-ABI 로드 실패.
- 증거: 기존 테스트 `ensure-sqlite-abi.test.mjs:47` 이 이 binary-blind fast-path 를 그대로 인코딩.
  스크래치 재현: 마커=electron 상태에서 old `markerMatches` = `true`(= skip) 확인.

## 인수 기준 (Acceptance Criteria)

1. electron `needsRebuild` 이 `loadBetterSqlite(cwd)` 프로브를 겸한다 — Node-ABI 바이너리(=plain Node
   로드 성공)면 마커가 매치해도 rebuild.
2. `ensureSqliteAbi` electron fast-path 이 node 와 대칭으로 `needsRebuild` 경유.
3. 회귀 테스트: 마커=electron + `loadBetterSqlite:()=>true` → `install-app-deps` 1회(rebuilt).
4. 기존 electron 테스트는 `loadBetterSqlite` 주입으로 hermetic 유지, 기대값 불변.
5. Electron-ABI 정상 상태(로드 실패)에선 fast-path skip 유지(불필요 rebuild 없음).
6. `app/AGENTS.md` 에 "어떤 명령이 ABI 를 뒤집는가"(lint/tsc/format=중립, test/install/dev/build=flip)
   + `npm test`→build 순서가 마찰의 실체 + ABI-안뒤집는 테스트 실행법 가이드 추가.
7. 게이트: lint(scripts 포함) + typecheck + `node --test scripts/ensure-sqlite-abi.test.mjs` green.

## 설계

- electron `needsRebuild`: `loadBetterSqlite(cwd) || !markerMatches(readMarker, computeFingerprint)`.
  기존 주입형 `loadBetterSqlite` 재사용(테스트 가능). 마커는 electronVersion/lockfile 드리프트 감지용 유지.
- `ensureSqliteAbi` electron 분기를 `!needsRebuild(...)` 로 교체.

## 가정 / 리스크

- Node ABI ≠ Electron ABI(Node22 v127 vs Electron39 ≈ v133) 전제. 우연 일치 시 OR 프로브가 불필요
  rebuild 루프를 낼 수 있으나 핀된 버전에서 불가 → 수용·주석.
- 제약(egress 403) 환경에선 electron-builder 실제 rebuild 불가 — 로직은 hermetic 단위테스트로 증명,
  실기는 CI/사람 몫(app/AGENTS.md ABI 가이드 일관).

## 영향 받는 파일

- `app/scripts/ensure-sqlite-abi.mjs` (버그 수정)
- `app/scripts/ensure-sqlite-abi.test.mjs` (회귀 테스트 + hermetic 주입)
- `app/AGENTS.md` (게이트↔ABI 가이드 확장)

## 게이트

- `npm run lint` + `npm run typecheck` + `node --test scripts/ensure-sqlite-abi.test.mjs`.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요구 2건 인용.
- [x] 자료조사 — `파일:라인` + 스크래치 재현 근거.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 기존 주입형 프로브 재사용, 신규 의존성 0.
- [x] 리스크 — ABI 동일 가정·egress 실기 한계 명시.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의: load-probe 재사용이 최소·견고. `.node` 해시 방식보다 경로 후보 처리 부담이 없다.
- 확인: Electron-ABI 바이너리는 plain Node 로드가 실패하므로 정상 시 프로브=false → fast-path 보존
  (불필요 rebuild 없음). node 타겟이 이미 동일 프로브를 써 전례 있음.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 사용자 ②(lint/tsc/format→build 실패) 는 실제로 ABI-중립이라 원인이 아님 | ✅ package.json 훅 전수로 검증(ABI-flip 4개=post/pre install·dev·build·test / 중립 3개=lint·typecheck·format) → AGENTS.md 로 인과관계 교정 | `package.json` scripts |

## [구현자 기입] 구현 체크리스트

- [x] electron `needsRebuild` load-probe 추가
- [x] `ensureSqliteAbi` electron 분기 needsRebuild 경유
- [x] 회귀 테스트 + 기존 electron 테스트 hermetic 주입
- [x] app/AGENTS.md 게이트↔ABI 가이드

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/ensure-sqlite-abi.mjs` · `app/scripts/ensure-sqlite-abi.test.mjs` · `app/AGENTS.md` |
| 실행 명령 | `node --test scripts/ensure-sqlite-abi.test.mjs` · `npm run lint` · `npm run typecheck` |
| 게이트 결과 | ensure-sqlite-abi 7/7 green · lint 0 errors(경고 1=0102 TanStack) · typecheck 3종 0 ✅ |
| 블로커 / 역질문 | 없음. 실제 electron ABI 전환 실기는 egress 403 로 이 환경 불가 → CI(windows-latest)/사람 실기 대기. |
| 대상 커밋 | `a9bf02b` |
