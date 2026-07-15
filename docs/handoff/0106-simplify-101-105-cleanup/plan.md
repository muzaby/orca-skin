# Plan — 0106-simplify-101-105-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0106-simplify-101-105-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-15 |
| 매핑 | PHASES Phase 4 행 (0101~0105 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 범위: 핸드오프 101~105` — 0101~0105 가 도입한 `app/` 코드 변경을 4관점(재사용·단순화·효율·altitude)으로 리뷰하고 발견을 적용 | 라이브 세션 요청 (2026-07-15, `/simplify → 101~105 까지 리팩토링하라`) |
| 추론 의도 | /simplify 는 동작 보존 품질 정리 — 표시 동작·IPC 계약·기능·타입 시그니처는 불변이어야 한다 (추론: /simplify 스킬 정의 + 0092/0093/0100 선례) | `docs/handoff/{0092,0093,0100}-*/plan.md` |

## Context (왜)

0101~0105 범위(`474cc56..HEAD`, `app/` 18 파일 · +565/-44)를 4관점으로 리뷰한 결과, 전반적으로 매우
깨끗한 diff 였다 — 순수 헬퍼는 주입 가능하게 잘 분해됐고(테스트 동반), 0102 는 이미 개별 /simplify 1회
(`3f1c13d`)를 거쳤으며, `ensure-sqlite-abi.mjs` 는 오히려 `ensureSqliteAbi` 가 `markerMatches` 재구현
대신 `needsRebuild` 를 재사용하도록 개선된 상태였다. dedup 후 적용 대상은 **0105(claude executable) 신규
코드의 소규모 중복 2건**뿐이다: (F1) 실행경로 옵션 삼항 스프레드가 두 query options 에 바이트 동일 중복,
(F2) 플랫폼별 실행파일명(`claude`/`claude.exe`) 판정이 3곳에 분산.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `...(claudeExecutable ? { pathToClaudeCodeExecutable: claudeExecutable } : {})` 삼항 스프레드가 runCompletion·sendMessage options 두 곳에 바이트 동일 중복 | `app/src/main/adapters/claude.ts` (구 239·343행 부근, `complete`·`sendMessage` options 리터럴) |
| `platform === 'win32' ? 'claude.exe' : 'claude'` 바이너리명 판정이 `findOnPath`·`officialInstallPath` 2곳 중복, `bundledCandidates` 의 `ext`(`.exe`) 도 같은 분기 | `app/src/main/adapters/claude-executable.ts:30,45,52` |
| `findOnPath` 의 수동 `;`/`:` 구분자는 `path.delimiter`(호스트 고정) 대신 platform 파라미터로 크로스플랫폼 테스트를 가능케 함 — 의도된 설계, 유지 | `app/src/main/adapters/claude-executable.test.ts` (`findOnPath` win/posix 케이스) |
| `toUnpackedPath`(asar 리맵)는 기존 헬퍼 없음 — `builtin-resources` 는 extraResources 경로로 별개 메커니즘 | `app/src/main/app/builtin-resources.ts` (grep asar 0) |
| TranscriptView head/tail 분할은 `3f1c13d` 에서 파생값 중복 가드 이미 제거됨 | 커밋 `3f1c13d refactor(chat): transcript head/tail 파생값 중복 가드 제거 (/simplify 0102)` |
| 0092/0093/0100 선례: /simplify 정리 = Claude 직접 plan→impl→verify, 설계 변경 수반 항목은 스킵+기록 | `docs/handoff/{0092,0093,0100}-*/plan.md`·INDEX |

## 인수 기준 (Acceptance Criteria)

1. **F1** — `claude.ts` 에 파생 옵션 상수 `claudeExecutableOption`(모듈 스코프, `claudeExecutable` 직후 1회)이 생기고, runCompletion·sendMessage 두 options 의 삼항 스프레드가 `...claudeExecutableOption` 으로 치환된다. `pathToClaudeCodeExecutable` 삼항이 options 리터럴 내부에 잔존 grep 0. 런타임 방출 키/값 무변경.
2. **F2** — `claude-executable.ts` 에 순수 헬퍼 `claudeBinName(platform)` 이 추가되고 `findOnPath`·`officialInstallPath`·`bundledCandidates` 3곳이 이를 사용한다. `'claude.exe' : 'claude'` 삼항이 이 헬퍼 밖에 잔존 grep 0. export 시그니처·반환값 무변경 → `claude-executable.test.ts` 무수정 green.
3. **게이트 green** — `npm run lint`(boundaries 포함) 0 error · `npm run typecheck` 3종 0 · 영향 스위트(`src/main/adapters` 224/`ensure-sqlite-abi` 7) green. 신규 의존성 0 · IPC 무변경 · 타입 시그니처 무변경.

## 범위 / 비범위

- **범위**: 위 인수 1~3(F1·F2). 리뷰 스킵 판정의 기록.
- **비범위**:
  - `toUnpackedPath`·`isCodeBlock`·`devUserDataDir` 등 순수 신규 헬퍼 — 재사용 대상 없음, 클린. 변경 없음.
  - TranscriptView head/tail — 이미 개별 /simplify 완료(`3f1c13d`). 변경 없음.
  - 효율 관점 발견 0 — 변경 없음.
  - `dev`/`build`/패키징 실기 — egress 차단·비-Windows 환경 불가, CI/사람 몫(0105 선례).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 편집: `adapters/claude.ts`·`adapters/claude-executable.ts`. 새 파일·새 export·새 의존성 0.
- 전제: 두 리팩토링 모두 순수 구조 이동(같은 값·같은 시그니처) — 관찰 가능한 동작·타입 무변경.
- **신규 의존성**: 없음.

## 설계

- **F1**: `const claudeExecutable = resolveClaudeExecutable()` 직후 모듈 스코프에
  `const claudeExecutableOption = claudeExecutable ? { pathToClaudeCodeExecutable: claudeExecutable } : {}`
  를 두고, 두 options 객체에서 `...claudeExecutableOption` 을 스프레드. 삼항이 1곳(상수 정의)으로 수렴.
- **F2**: `claude-executable.ts` 에 파일-로컬 순수 헬퍼
  `function claudeBinName(platform: NodeJS.Platform): string { return platform === 'win32' ? 'claude.exe' : 'claude' }`
  를 `toUnpackedPath` 뒤에 두고, `findOnPath`·`officialInstallPath` 의 `name` 계산과 `bundledCandidates`
  의 서브패스(`${pkg}/${claudeBinName(platform)}`)에서 재사용. `ext` 지역변수 소멸.
- 레이어 경계: 둘 다 `adapters` 레이어 내부 편집. import 방향·boundaries 무변경.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- N/A — 순수 내부 리팩토링. UI·상태·IPC·타입 표면 무변경(런타임 방출값 동일).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| F2 헬퍼 치환이 `bundledCandidates` 서브패스 문자열을 미묘히 바꿀 가능성 | 기존 테스트(`resolveBundledExecutable` win/linux-musl 케이스)가 최종 경로 문자열을 고정 단언 → 무수정 green 으로 기계 검증 |

- 되돌리기 어려운 결정: 없음 (내부 구조 이동, 시그니처·동작·IPC·DB 무변경).
- **단독 결정 금지 항목**: 없음.

## 영향 받는 파일

- `app/src/main/adapters/claude.ts`
- `app/src/main/adapters/claude-executable.ts`

## 참고 문서

- `docs/handoff/{0092,0093,0100}-*/plan.md` — /simplify 정리 선례 (스킵 판정 관례 포함)
- `app/src/main/AGENTS.md` — adapters 레이어 경계
- `docs/handoff/0105-native-binary-executable-resolve/plan.md` — 리뷰 대상 코드의 원 설계

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck`(ABI-중립) + 영향 스위트 직접 실행(`./node_modules/.bin/vitest run src/main/adapters`·`node --test scripts/ensure-sqlite-abi.test.mjs`).
- 신규 테스트: 불필요 — 순수 dedup 이라 기존 스위트가 회귀 가드(무수정 green 이 곧 동작 보존 증거).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·커밋·핸드오프 문서)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다(grep 0·무수정 green).
- [x] 의존 기술 — 신규 의존성 0·시그니처 무변경을 확인했다.
- [x] 파생 UX — 순수 내부 리팩토링이라 N/A 로 표기했다.
- [x] 리스크 — F2 문자열 변동 리스크와 기존 테스트 고정 완화책을 적었다.

---

> **[구현자 기입]** 본 건은 비기능 = Claude 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 §F1·§F2 전부. 두 항목 모두 관찰 가능한 동작·타입 표면을 건드리지 않는 순수 구조 이동이라, 기존 테스트 스위트(무수정)가 그대로 회귀 가드가 된다 — 신규 테스트 불요 판단에 동의.
- 이견 / 우려: 없음. 발견 규모가 작아(2건) 커밋 분할 없이 단일 구현 커밋으로 통합.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| — | 없음 | — | 4관점 리뷰 결과 잔여 dedup 은 F1·F2 뿐, 설계 밖 잠재 문제 미발견 |

## [구현자 기입] 구현 체크리스트

- [x] F1 — `claudeExecutableOption` 모듈 상수 + 두 options 스프레드 치환
- [x] F2 — `claudeBinName` 헬퍼 + `findOnPath`·`officialInstallPath`·`bundledCandidates` 재사용(`ext` 제거)
- [x] 게이트 + 영향 스위트 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/adapters/claude.ts` · `app/src/main/adapters/claude-executable.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run src/main/adapters` / `node --test scripts/ensure-sqlite-abi.test.mjs` |
| 게이트 결과 | lint ✅ 0 error(경고 1 = 0102 TanStack↔React Compiler, 무관) / typecheck 3종 ✅ 0 / adapters vitest ✅ 224/224(21파일) / ensure-sqlite-abi ✅ 7/7. DB 로드 스위트는 better-sqlite3 ABI egress-403 베이스라인(변경 무관). |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `<impl-hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | 없음 | — | — | — |
