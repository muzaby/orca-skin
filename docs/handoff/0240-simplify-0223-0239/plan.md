# Plan — 0240-simplify-0223-0239

## 메타

| 항목 | 값 |
|---|---|
| slug | `0240-simplify-0223-0239` |
| 작성자 | Claude Code |
| 일자 | 2026-09-24 |
| 매핑 | `/simplify handoff 223~239` |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0223~0239 구현 diff(`e520d1f6^..50cdab0e`, app 비테스트 383파일)에 중복 헬퍼·죽은 코드·파생 가능 상태·핫패스 재계산이 남았다.
- 완료 후 달라지는 것: 같은 규칙이 한 곳에만 산다. 사용자 관측 동작은 바뀌지 않는다.
- 성공 한 문장: 기존 테스트 전부가 수정 없이(죽은 코드 테스트 제외) 통과하고 중복 사본이 사라진다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 0223~0239 변경을 reuse·simplification·efficiency·altitude 관점으로 리뷰하고 고친다 | 라이브 세션 `/simplify handoff 223~239` |
| 추론 의도 | 동작 변경·대규모 구조 변경은 이번 범위가 아니다 — 추론(`/simplify` 규칙: 의도 동작을 바꾸거나 diff 밖 대수술이면 skip) | `/simplify` 지침 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 동작 보존 리팩토링만 적용한다 | `/simplify` 는 품질 개선이지 버그 수정이 아니다 | 사용자 턴 | ACTIVE | — |
| D-002 | 영속 키·저장 포맷(`backgroundJournalKey`·`backgroundEventKey`)은 건드리지 않는다 | 기존 DB 행과 dedupe 가 깨진다 | 코드 조사 | ACTIVE | — |
| D-003 | 구조 변경(altitude 1·2·5·6 등)은 후속 핸드오프 후보로만 기록한다 | 계약·다중 레이어 변경이라 별도 설계 필요 | 코드 조사 | ACTIVE | — |

### 갱신 메모

- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — AC1(기존 테스트 green)이 D-001·D-002 를 관측한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | 중복 사본은 0237 f9061f1 에서 같은 수정을 두 파일에 반복하게 만들었다 |
| 더 작은 해법 | 적용 항목을 모두 파일-로컬 또는 같은 slice/레이어 안으로 한정 | §11 |
| 기존 결정과 충돌 | 없음 | `compact` 는 전 키 요구 계약(0194 D14)이라 부분 patch 에 쓰지 않는다 — 제안 R9 skip |

- 사용자에게 올릴 결정: 없음

## 5. 동작 / 사용자 흐름

해당 없음 — 사용자·IPC·DB 관측 동작 불변.

## 6. 범위 / 비범위

- **범위**: §11 표의 14개 정리.
- **비범위**: §17 표의 skip 항목.

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 리팩토링 후 기존 단위·통합 테스트가 모두 통과한다 | `vitest run` 전체 — 환경 제약 스위트 제외 전부 green | 각 모듈의 기존 호출부 |
| R-02 | AT-02 / AC2 | 정적 게이트가 통과한다 | `npm run typecheck` · `eslint` · `check-doc-inventory --check` | — |
| R-03 | AT-03 / AC3 | 제거한 중복 사본이 남지 않는다 | `rg` 차집합: `§8 전수 조사` 의 패턴이 각 0건 | — |

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 기준 V 없음 → Baseline V.
- 변경이 시작되는 수준: MD(모듈 내부 구현). R/SD/AR 계약 불변.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 동작 보존 | NEW | — |
| AT-01 | AT | §7 기존 테스트 green | NEW | — |
| MD-01 | MD | §11 중복 제거 | NEW | — |
| UT-01 | UT | §8 `rg` 0건 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 각 모듈 기존 호출부 → 기존 테스트 | `vitest run` pass 수 == 기준선 pass 수 | not selected — 기존 테스트가 직접 행동 oracle | 0 — 새 계약 없음 |
| VP-02 | MD-01 ↔ UT-01 | REQUIRED | — | §8 패턴 `rg` 0건 | not selected — 텍스트 부재가 직접 관측 | 0 — 새 계약 없음 |

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree | `app/**` 수정 | `npm run typecheck` · `npx eslint <변경 파일>` · `vitest run` | 변경이 유발한 실패만 |
| repository | 신규 파일 1 | `node scripts/check-doc-inventory.mjs --check` · `node --test scripts/*.test.mjs` | 동일 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 동일 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| jira·mail 첨부 내보내기가 봉쇄 헬퍼 6종을 거의 그대로 복제 | `features/plugins/jira/attachment-store.ts` · `mail/attachment-export.ts` |
| `within()` 이 `isWithinDir` 와 문자 단위 동일 | `infra/background-output.ts` · `infra/config/paths.ts` |
| `listening === (activityTransport !== 'idle')` 가 모든 쓰기 지점에서 성립 | `chatReducer.ts` 초기값·`activity` 이벤트·`CANCEL_CHAT`·hydrate |
| `validFilePaths` 는 `entriesByDir` 합집합과 같다 — 디렉토리당 1회 조회·cwd 변경 시 둘 다 초기화 | `useMentionAutocomplete.ts` |
| `hasTerminalConflict`·`safeOutputText`·`backgroundResultText`·`backgroundOutputRefsForDisplay` 프로덕션 호출 0 | `rg` (0232 b7d9ce56 이후) |
| `linkOutput` 이 호출마다 SQL 4개를 prepare | `infra/db/artifact-queries.ts` |
| SDK `package.json` 을 채널 spawn 마다 동기 read | `adapters/claude.ts` `sendMessage` |
| `compact` 는 전 키 필수 — 부분 patch(`defined(patch)`)에 부적합 | `shared/obj.ts` `CompactSource` |

### 전수 조사

| 대상 | 검색/방법 | N(후) | 의미 |
|---|---|---:|---|
| 복제 봉쇄 헬퍼 | `rg "WINDOWS_RESERVED\|function inside\(" app/src/main/features/plugins/{jira,mail}` | 0 | 공통 모듈 1곳 |
| `within` 사본 | `rg "function within\(" app/src/main/infra` | 0 | `isWithinDir` 사용 |
| 도구 결과 envelope 사본 | `rg "structuredContent:" app/src/main --glob '!*.test.ts'` | 1 | `jsonToolResult` 1곳 |
| 비실행 술어 사본 | `rg "!== 'completed' && .* !== 'failed'" app/src/renderer` | 1 | `isNonExecutionOutcome` 정의부만 |
| 죽은 배경 헬퍼 | `rg "backgroundResultText\|backgroundOutputRefsForDisplay\|safeOutputText\|hasTerminalConflict" app/src` | 0 | — |

## 9. Architecture — AS-IS → TO-BE

### AS-IS

- 같은 규칙(첨부 봉쇄·경로 포함·도구 결과 envelope·비실행 판정·SDK 버전 읽기)이 호출부마다 사본으로 존재한다.

### TO-BE

- 규칙마다 SSOT 하나: `features/plugins/attachment-fs.ts` · `infra/config/paths.isWithinDir` · `adapters/runtime-tools.jsonToolResult` · `lib/parts.isNonExecutionOutcome` · `claude.ts sdkPackageVersion()`.
- 파생 가능한 상태(`validFilePaths`)는 `useMemo`, 파생식(`sessionResponding`)은 정본 필드 하나만 읽는다.

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 연결 |
|---|---|---|---|---|
| 책임/소유권 | 플러그인별 봉쇄 사본 | plugins slice 공통 모듈 | 보안 수정 1회 적용 | MD-01 / VP-02 |
| data/control flow | 불변 | 불변 | — | VP-01 |
| state/contract | `validFilePaths` 별도 state | `entriesByDir` 파생 | 수동 동기화 제거 | VP-01 |
| error/lifecycle | 오류 타입 불변(`JiraToolError`·`Error('unsafe attachment directory')`) — `unsafe` 팩토리로 주입 | 동일 | 도메인 오류 보존 | VP-01 |
| test seam | 불변 | 불변 | — | VP-01 |

## 10. 계약 / 타입 / 강제 지점

해당 없음 — 공개 계약·IPC·DB 스키마·영속 키 불변(D-002).

## 11. 구현 설계

| 파일 | 변경 |
|---|---|
| `features/plugins/attachment-fs.ts` (신규) | `safeSegment`·`sanitizeAttachmentFilename`·`ensurePlainDirectory(parent, dir, unsafe)`·`cleanupStaleStages` |
| `plugins/jira/attachment-store.ts`·`mail/attachment-export.ts`·`mail/store/index.ts` | 공통 모듈 사용 |
| `adapters/runtime-tools.ts`·`plugins/jira/result.ts`·`mail/tools.ts` | `jsonToolResult` 공유 |
| `infra/background-output.ts` | `within` → `isWithinDir` |
| `infra/net/pop3-errors.ts` | `errorMessage` 재사용 |
| `infra/config/migrate-legacy.ts` | 1회용 래퍼 `hasCriticalFailure` 인라인 |
| `infra/db/artifact-queries.ts` | `linkOutput` statement 를 생성자에서 1회 prepare |
| `adapters/claude-background.ts` | `text` → `asString`, 조건 스프레드 → `ifPresent` |
| `adapters/claude.ts` | SDK 버전 lazy memo |
| `features/chat/background-controller.ts` | `withTimeout`·`liveResidual` 헬퍼, `emit('unconfirmed')` 재사용 |
| `features/artifacts/service.ts`·`files.ts` | `cancellation()`·단일 `drop` 콜백·중복 `check()` 제거 / `UUID_RE`·`isMissing` |
| `shared/background-task.ts` | `markMembershipUnknown` |
| renderer `backgroundPresentation.ts` | 죽은 헬퍼 4개 삭제(테스트는 state 로 직접 단언) |
| renderer `chatStore.ts`·`useMentionAutocomplete.ts`·`artifactStore.ts` | 파생식 단순화·`useMemo`·성공/실패 분기 통합 |
| renderer `parts.ts`·`ToolCard`·`WorkToolTimeline`·`TaskToolBody`·`CanonicalBackgroundContent`·`canonicalBackground.ts` | `isNonExecutionOutcome`·`isAgentTaskName` 재사용, 항상 참 가드 제거 |

## 12~15.

해당 없음 — 경계·부팅·외부 포트 변경 없음. 성능: `linkOutput` prepare 4회/호출 → 0, SDK `package.json` read 1회/채널 → 1회/프로세스.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 결과 |
|---|---|---|
| feature 교차 import 금지 | `app/src/main/AGENTS.md` | 유지 — 공통 모듈은 같은 `plugins` slice |
| `compact` 전 키 요구 | `shared/obj.ts` 0194 D14 | 유지 — 부분 patch 에 쓰지 않음 |
| 0237 f9061f1 root 정규화 | 커밋 | 유지 — `ensurePlainDirectory(null, root)` 호출 보존 |

## 17. 리스크 / 트레이드오프 · Skip 목록

| 리스크 | 완화 |
|---|---|
| `isWithinDir` 가 `resolve()` 를 추가 호출 | 입력이 모두 절대 realpath 라 결과 동일 |
| `validFilePaths` 가 `entriesByDir` 변경마다 새 Set | 디렉토리 조회 1회당 1회 — 기존과 같은 빈도 |
| `artifactStore` 배치 실패 시 `lastTrashedAt` | 결과 없을 때 키를 쓰지 않아 기존 catch 경로와 동일 |

| Skip(후속 후보) | 이유 |
|---|---|
| 배경 상태에 호스트 정착 기록·transcript 인자 제거 (altitude 1) | 공유 reducer 계약 변경 |
| `settleOpenToolRuns` 통합·문자열 휴리스틱 제거 (altitude 2) | 영속 행 호환 판단 필요 |
| `stream_event` 저널링·`seenEvents` 복사 비용 (efficiency 1·2) | 영속 키·저장 포맷 변경(D-002) |
| legacy-paths 부팅 단계 조건화 (efficiency 3) | 부팅 계약 변경 |
| 캔버스 패널 projection 1회화 (efficiency 8) | transcript 키 순서가 두 갈래라 동작 판단 필요 |
| `captureOutput` 재읽기·N+1 (efficiency 4·5) | TOCTOU 방어 의도 확인 필요 |
| 메일 store 수명·cleanup (efficiency 10) | 연결 수명 정책 변경 |
| `'work'` 분기 정책표 이관 (altitude 5), hook side-channel 큐 (altitude 6) | 다중 레이어 구조 변경 |
| canonical JSON 3사본·경로 case-fold 6사본·`readStableFile` 2사본 | 영속 해시 출력·보안 경계 — 별도 설계 |
| `defined()`→`compact` | `compact` 전 키 계약 불일치 — 오탐 |
| `ArtifactCard` 날짜 포맷 | 표시 동작 변경 |
| composer `@` 토큰 단일 스캔 | 입력 동작 변경 위험 |
| 카탈로그 헤더/빈 상태 공통화 | 두 화면이 이미 다르게 동작 |

## 18. 영향 받는 파일

§11 표.

## 19. 게이트

- 적용 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 정적: `npm run typecheck` · `npx eslint <변경 파일>`.
- 테스트: `./node_modules/.bin/vitest run` — electron 바이너리 미설치 환경의 `bootstrap.*`·`chat-turn*` 8파일은 베이스라인 red 로 분리 보고.
- 사람 실기: 없음.

---

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: §11 전부.
- 이견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

해당 없음 — §10 계약 없음.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 |
|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `vitest run` 5273 passed · 3 skipped · 실패 파일 8 = electron 설치 실패(`git stash` 베이스라인 동일 red) |
| VP-02 | REQUIRED | SELF_PASS | §8 전수 조사 5패턴 재실행 → 표의 N 과 일치 |

- 커밋 좌표: (r1 구현 — 좌표는 INDEX)
- AC 검산: ✅3 / AC 총 3 (AC1 vitest · AC2 정적 게이트 · AC3 `rg` 0건).
- 게이트: typecheck PASS · eslint(변경 파일) 0 · doc-inventory ok · `node --test scripts` 120/120.

---

## [검증자 기입] 파생 이슈 (r1 verify — PASS)

판정 원문은 [`verify.md`](verify.md) §13.

| # | disposition | 요지 |
|---|---|---|
| D1 | NEXT_HANDOFF | 변경 hunk 7곳이 기존 테스트에 잠기지 않음(첨부 봉쇄·`linkOutput` boundary 등) — 테스트 보강 후보 |
| D2 | NON_BLOCKING | 파일 내부 전용 함수 2개의 불필요 export |
| D3 | NON_BLOCKING | `[구현자 기입]` 7필드 중 4필드 누락 |
