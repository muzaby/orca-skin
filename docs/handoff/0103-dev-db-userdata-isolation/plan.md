# Plan — 0103-dev-db-userdata-isolation

> 비기능(dev 데이터 격리) = Claude 직접 구현. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0103-dev-db-userdata-isolation` |
| 작성자 | Claude Code |
| 일자 | 2026-07-14 |
| 매핑 | (PR 미요청) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "dev에서 사용하는 db를 구분하고 싶다 … 실제 sqlite 로 개발하는 데스크톱 앱의 경우 정책을 어떻게 하나" | 라이브 세션 요청 |
| 사용자 결정 | ① 격리 수준 = **userData 디렉토리 분리**(파일명 suffix 아님) ② 판정 신호 = **`import.meta.env.DEV`** | AskUserQuestion 응답(본 세션) |
| 추론 의도 | 개발 중 마이그레이션/데이터 변경이 실제 설치본 데이터를 오염시키지 않도록 완전 격리하려는 것으로 해석 | (추론) |

## Context (왜)

dev(`npm run dev`)와 prod가 동일한 `<userData>/orca.db`를 공유한다. `userData`는 `app.getName()`
(dev·prod 모두 `orca`)에서 파생돼 같은 폴더로 해석되기 때문. 개발 중의 스키마 마이그레이션·데이터
변경이 실제 설치본 데이터를 오염시킬 위험이 있다. dev 세션을 prod와 완전히 분리된 저장소로 격리한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| DB 경로는 `<userData>/orca.db` 단일 출처, dev/prod 분기 없음 | `app/src/main/infra/db/index.ts:14-15` |
| userData는 `app.getPath('userData')` 한 곳에서만 소비, 하위는 이를 경유 | `app/src/main/infra/db/index.ts:14` |
| 이 저장소는 "정확히 npm run dev" 게이트에 `import.meta.env.DEV`를 씀(dead-code 제거). `is.dev`는 "미패키징 전체"라 부정확 | `docs/handoff/0003-debug-panel-mock-adapter/plan.md:29`, `app/src/main/app/handlers/misc.ts:298`, `bootstrap.ts:294` |
| 경로 헬퍼 SSOT + 동반 단위 테스트 관례 존재 | `app/src/main/infra/config/paths.ts`, `paths.test.ts` |
| 마이그레이션 백업 파일명은 리터럴 `orca.db.backup...`(경로 파생 아님) — 디렉토리 분리 방식에선 폴더 격리로 충돌 없어 무수정 | `app/src/main/infra/db/migrate.ts:118-123`, `migrate.test.ts:131` |
| 업계 관행: 앱 데이터 디렉토리 자체를 환경별 분리(VSCode `code-oss-dev` 등). SQLite는 `-wal`/`-shm`·백업·secret-store 등 형제 상태가 있어 파일명만 나누면 격리가 샘 | (일반 관행) |

## 인수 기준 (Acceptance Criteria)

1. `import.meta.env.DEV`일 때 `index.ts`가 `app.whenReady()` 이전에 `userData`를 `<appData>/orca-dev`로 리디렉션한다.
2. prod 번들(`npm run build` 산출 `out/main/index.js`)에는 `orca-dev`/`setPath` 분기가 남지 않는다(dead-code 제거).
3. `devUserDataDir(appDataDir)` 순수 헬퍼가 `paths.ts`에 있고 `<appData>/orca-dev`를 반환한다.
4. `devUserDataDir` 단위 테스트가 추가되고 통과한다.
5. `db/index.ts`·`migrate.ts`·`migrate.test.ts`는 무수정(디렉토리 분리 방식의 이점).
6. `app/AGENTS.md` DB 정책에 dev 격리 정책 한 문장이 반영된다.
7. 게이트 4종(lint/typecheck/test) 통과.

## 범위 / 비범위

- **범위**: dev userData 리디렉션 + 순수 헬퍼 + 테스트 + 문서.
- **비범위**: staging/test 등 다중 환경(env var 방식), 기존 dev 데이터 자동 이전, `setName` 기반 앱 식별 변경.

## 의존 기술 / 전제

- Electron `app.setPath('userData', …)`(ready 이전 호출 필수)·`app.getPath('appData')`.
- electron-vite의 main `import.meta.env.DEV` 정적 치환(prod dead-code 제거).
- 신규 의존성 없음.

## 설계

- `paths.ts`에 순수 헬퍼 `devUserDataDir(appDataDir)` 추가(게이트는 index.ts 인라인 유지 → dead-code 제거 보존).
- `index.ts` 모듈 스코프에서 `if (import.meta.env.DEV) app.setPath('userData', devUserDataDir(app.getPath('appData')))`.
- `setName` 대신 `setPath('userData')` — 데이터 경로만 외과적으로 이동, 앱 이름/AppUserModelId(`index.ts` `com.orca.app`) 불변.
- 레이어: index.ts=app 컴포지션 루트(infra import 허용), paths.ts=infra. 경계 준수.

## 파생 UX / 엣지케이스

- 기존 dev 데이터가 있었다면 `orca-dev` 폴더는 비어서 시작 → dev 첫 실행 시 마이그레이션 전체 재적용(정상). 수동 이전은 사용자 몫.
- prod 무영향(분기 dead-code 제거).

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| `setPath('userData')`를 ready 이후 호출하면 무효 | index.ts 모듈 스코프(=whenReady 이전)에 배치 |
| dev 폴더 격리로 기존 dev DB가 안 보임 | 의도된 동작. Context/문서에 명시, 필요 시 수동 복사 안내 |

## 영향 받는 파일

- `app/src/main/index.ts` (리디렉션 배선)
- `app/src/main/infra/config/paths.ts` (`devUserDataDir`)
- `app/src/main/infra/config/paths.test.ts` (테스트)
- `app/AGENTS.md` (DB 정책 문장)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `devUserDataDir` 순수 함수 단위 테스트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 + AskUserQuestion 결정 인용, 추론은 표기.
- [x] 자료조사 — 발견마다 `파일:라인`/핸드오프 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — Electron API·vite 치환 식별, 신규 의존성 0.
- [x] 파생 UX — dev 폴더 신규 시작·prod 무영향.
- [x] 리스크 — ready 타이밍·격리 트레이드오프 명시.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 디렉토리 분리 방식이 `migrate.ts` 백업 리터럴 수정을 회피해 blast radius가 작다. `setPath('userData')`가 `setName`보다 외과적.
- 이견 / 우려: 없음. secret-store 등 형제 상태도 userData 경유이므로 자동 격리됨을 확인.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `import.meta.env.DEV` 블록이 module-scope 최상단이라 `app` 최초 사용 시점 문제 없는지 | ✅ 확인 — `app`은 import 완료, whenReady 이전 setPath 유효 | Electron 문서(ready 이전 요구) |

## [구현자 기입] 구현 체크리스트

- [x] `devUserDataDir` 헬퍼 추가
- [x] index.ts 리디렉션 배선(DEV 게이트)
- [x] paths.test.ts 테스트 추가
- [x] app/AGENTS.md DB 정책 문장

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/index.ts` · `app/src/main/infra/config/paths.ts` · `app/src/main/infra/config/paths.test.ts` · `app/AGENTS.md` |
| 실행 명령 | `npm run lint` / `typecheck` / `vitest run` |
| 게이트 결과 | lint 0 errors(경고 1=0102 TanStack 수용) ✅ · typecheck 3종 0 ✅ · vitest 810/842(32 red=better-sqlite3 네이티브 ABI egress-403 환경 제한, 6파일 전부 DB 로드·본 변경 무관·0099/0100 동일 베이스라인) · `paths.test.ts` 14/14 green ✅ |
| 블로커 / 역질문 | 없음. 인수 #2(prod dead-code)·plan 검증 #2/#3(dev 실행·build 산출)은 electron 바이너리 403 로 이 환경에서 실기 불가 → 네트워크 완전환경/사람 실기 대기(0019·0102 선례). `import.meta.env.DEV` 정적 치환은 vite 보장. |
| 대상 커밋 | `9640438` |
