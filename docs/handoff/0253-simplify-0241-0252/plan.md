# Plan — 0253-simplify-0241-0252

## 메타

| 항목 | 값 |
|---|---|
| slug | `0253-simplify-0241-0252` |
| 작성자 | Claude Code |
| 일자 | 2026-10-07 |
| 매핑 | 브랜치 `claude/simplify-0241-0252` (PR 미생성 — `gh` 미인증) |
| 상태 | READY (사후 작성 — 아래 §0) |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

## 0. 절차 이탈 기록

- **판정: 구현 커밋이 plan보다 먼저 존재한다.** 사용자 `/simplify 241~252` → 구현 → "Pr 만들어라" → "핸드오프 문서도 작성하라" 순서였다.
- 구현 커밋 `a27b93ec`의 trailer는 `Handoff: none`이다. 이미 push 됐으므로 재작성하지 않고 이 plan이 사후 정본이 된다.
- 기준선 잠금(verify §0)은 이 plan 커밋을 기준으로 한다. 검증자는 구현이 plan에 맞춰진 것이 아니라 **plan이 구현을 서술한다**는 점을 감안해 §7 AC를 독립 재현으로 판정한다.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0241~0252 구현분에 중복 로직·죽은 분기가 남아, 다음 변경이 같은 규칙을 2~10곳에서 고쳐야 한다.
- 완료 후 달라지는 것: 각 규칙이 한 곳(SSOT 헬퍼)에 있고 죽은 `'steer'` 배치 경로가 사라진다.
- 성공을 한 문장으로: **사용자·IPC·DB 관측 동작은 바이트 단위로 같고, 코드만 줄어든다**(+266 / −358).

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "원격브랜치의 main으로 변경하라." · "/simplify 241~252" | 라이브 세션 턴 1 |
| 명시 요구 | "Pr 만들어라" · "핸드오프 문서도 작성하라" | 라이브 세션 턴 2·3 |
| 추론 의도 | 범위 = Handoff trailer 가 0241~0252 를 가리키는 커밋 87개의 비-테스트 소스 변경 | `/simplify` 인자 해석 |
| 추론 의도 | /simplify 정의상 **품질 정리만**, 버그 수정·동작 변경 없음 | simplify 스킬 "Quality only" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 동작을 바꾸는 정리는 적용하지 않는다 | /simplify "Skip any finding whose fix would change intended behavior" | simplify 스킬 | ACTIVE | — |
| D-002 | 공개 IPC 계약을 고아로 만드는 정리(artifact availability 제거 → `artifactStatus` 채널 무소비)는 보류 | 루트 AGENTS 원칙 3 — 공개 계약은 사용자 결정 | AGENTS.md | ACTIVE | — |
| D-003 | 대형 구조 변경(plan-mode 입력 5계층 일원화, 권한 모드 사이드채널 → 스트림 이벤트, abort 종결 이중 생산자, abort 검사 3계층)은 범위 밖 | 각각 별도 설계·핸드오프 규모 | Altitude 리뷰 | ACTIVE | — |
| D-004 | 동작 검증이 필요한 효율 개선(probe 비-repo spawn 절감, plan-file 읽기 캐시, usage 이중 스캔, `unredirectedFile` 재사용으로 보안 검사 강화)은 범위 밖 | D-001 — 관측 동작·보안 경계가 바뀔 수 있음 | Efficiency·Reuse 리뷰 | ACTIVE | — |
| D-005 | `resolveRepoRoot`·`resolveHeadRef` 는 프로덕션 호출자 0이어도 유지 | `repository.test.ts` 가 0211 AT-44 증거로 인용 | `repository.test.ts:36` | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-005 (최초 작성).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — AC1~AC9 는 모두 "동작 동일"을 단언(D-001)하고, D-002~D-004 대상 파일(`artifactStore.ts`·`probe.ts` 의 `probeRepo` 본문·`plan-file.ts`·`tracker.ts`)을 AC가 요구하지 않는다. D-005 ↔ AC2: AC2 는 래퍼 삭제를 요구하지 않음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 4관점 리뷰 31건 중 중복 지적 다수가 2개 에이전트에서 독립 재현 |
| 이미 기존 코드가 충족하는가 | 부분 — `isRecord` 는 이미 있음 | `app/src/shared/obj.ts:14` |
| 더 작은 해법이 있는가 | 각 항목을 파일 국소 헬퍼로 한정 | §11 |
| 선행 자료 대조 | `'steer'` origin 프로덕션 호출자 0 확인 | §8 전수 표 |
| 기존 결정 충돌 | 0151 AC1/AC5 의 origin 비대칭 규칙을 **제거**한다 — 0250 이 steer 생산자를 없앴으므로 규칙의 대상이 소멸 | `git grep reserveHeld main` 3건 전부 `'turn-open'` |

- 사용자에게 올릴 결정: 없음 (D-002 는 보류로 처리, 결정 요청은 PR 본문에 기재).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[사용자 입력 · 턴 · git 조회 · 오류 보고 · 권한 모드 · 사용량]
  → [정리된 헬퍼 경유]
  → [변경 전과 같은 IPC 이벤트 · DB 쓰기 · UI]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 보이는 결과 |
|---|---|---|
| 턴 프롬프트 예약 → 첫 모델 출력 | 배치 confirmed | 변경 전과 동일(origin 은 항상 turn-open 이었음) |
| 턴 프롬프트 예약 → echo | 배치 confirmed | 동일 |
| 동시 git 첫 호출 N개 | PATH 탐색 1회 공유 | 동일 결과, 탐색 횟수만 N→1 |
| git 미설치 | 매 호출 재탐색 | 동일(못 찾으면 캐시하지 않음) |

### 파생 UX / 엣지케이스

- error: 오류 토스트 dedupe 키·detail 300자 절단 규칙 동일.
- cancel: post-turn 루프의 prepare 중 abort 정착 분기 동일(continue/break).
- 그 외: 해당 없음.

## 6. 범위 / 비범위

- **범위**: §11 표의 10개 정리.
- **비범위**: D-002·D-003·D-004 항목, 테스트 전용 dead export(`useGitSnapshot.ts`), usage-row 매핑 통합.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| artifact availability 제거 | **예 — 공개 IPC 계약** | 사용자 결정 대기 (PR 본문) |
| plan-mode 입력 일원화 등 구조 변경 | 아니오 | 후속 handoff 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 큐 예약 배치는 첫 모델 출력 **또는** echo 로 확정된다(origin 인자 없음) | `pending-message-queue.test.ts` "첫 모델 출력으로도…확정"·"echo 는 배치를 확정한다" | `enqueue.ts`·`post-turn.ts` → `PendingMessageQueue.confirm` |
| R-02 | AT-02 / AC2 | HEAD oid/브랜치 이름 파생이 `probe.ts` 의 `headOid`/`headName` 한 곳에서 나온다 | `git grep -E "head\.kind (!==\|===) '(unborn\|detached)' \?" -- src/main ':!*.test.ts'` = 정의 2줄만 · `infra/git`·`worktrees`·`prepare-worktree` 테스트 green | git 스냅샷·체크아웃·worktree 준비 |
| R-03 | AT-03 / AC3 | 오류 detail 절단·dedupe 키가 main/renderer 에서 같은 함수로 계산된다 | `git grep "APP_ERROR_DETAIL_MAX - 1"` = `shared/app-error.ts` 1건 · error-report·errorToast 테스트 green | `reportError`(main/renderer) → hub → 토스트 |
| R-04 | AT-04 / AC4 | `toClaudePermissionMode`/`fromClaudePermissionMode` 가 6종 전부 서로 역함수, 미지 값은 `undefined` | `permission-mode.test.ts` green | adapter init/status → observer |
| R-05 | AT-05 / AC5 | message_delta·assistant usage 스냅샷 값이 변경 전과 같다 | `claude-map` 관련 테스트(0247) green | SDK stream → `turnUsage`/`lastAssistantUsage` |
| R-06 | AT-06 / AC6 | listen·flush 분기의 prepare/abort 정착 동작 동일 | `post-turn`·`chat-turn` 테스트 green, `deps.prepareContinuation(` 호출 1곳 | 자동 연속 턴 루프 |
| R-07 | AT-07 / AC7 | auth 선언 거부 사유·순서·메시지가 두 scheme 모두 동일 | `features/auth` 테스트 green | 부팅 `registerAuthDefinitions` |
| R-08 | AT-08 / AC8 | 동시 `gitExecutable()` 첫 호출이 같은 결과를 받고, 미발견은 캐시하지 않는다 | `infra/git` 테스트 green · 코드 리뷰 | `runGit` |
| R-09 | AT-09 / AC9 | 대기 입력 버블이 `activityForeground` 만 구독하고 표시 동일 | `pendingSteerControls.test.ts` 24건 green | transcript 렌더 |
| R-10 | AT-10 / AC10 | 전체: 변경 suite 의 실패 집합이 `main` 기준선과 같다 | 기준선/변경 후 `vitest run` FAIL 파일 집합 diff = ∅ | — |

### AC 검증 주의사항

- 기존 테스트 재사용: AC1 두 케이스는 `pending-message-queue.test.ts` 에 현존(이번 커밋에서 제목만 정정). 삭제한 케이스 1건("첫 모델 출력은 turn-open 배치만 확정한다 — steer 배치는 거부")은 제거된 규칙 자체의 테스트다.
- AC10 기준선: Windows 로컬에서 `better-sqlite3` 로드 등 기존 실패가 존재 — `app/AGENTS.md §better-sqlite3 ABI` 대로 분리 보고한다.
- 사람 실기: 없음.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 없음.
- 변경이 시작되는 수준: MD (모듈 내부 리팩토링). 프로덕션 경계(IPC·DB 스키마·이벤트)는 불변이라 AR/SD 신규 노드 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01~R-10 | R | §7 | NEW | — |
| MD-01 | MD | `PendingMessageQueue` 확정 규칙(origin 제거) | CHANGED | 0151 AC1/AC5 |
| MD-02 | MD | `headOid`/`headName` SSOT | NEW | — |
| MD-03 | MD | `clampErrorDetail`/`appErrorKey` SSOT | NEW | — |
| MD-04 | MD | 권한 모드 매핑 테이블 | CHANGED | 0249 ΔV3 |
| MD-05 | MD | `usageSnapshot` | NEW | — |
| MD-06 | MD | `prepareNext` | NEW | — |
| MD-07 | MD | auth `accept` 검증 | CHANGED | 0248 |
| MD-08 | MD | `gitExecutable` in-flight 공유 | CHANGED | 0241 |
| MD-09 | MD | `PendingSteerTurn` 구독 범위 | CHANGED | 0250 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 적대 증거 | §10 자리 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT(queue) | REQUIRED | enqueue/post-turn → reserve* → confirm | AC1 두 케이스 | not selected — 직접 결과 단언 | EP-1 (3) |
| VP-02 | MD-02 ↔ UT(git) | REQUIRED | probeRepo → head* → 소비 6파일 | AC2 grep + git 테스트 | not selected | EP-2 (10) |
| VP-03 | MD-03 ↔ UT(error) | REQUIRED | reportError → clamp → hub key / toast key | error-report·errorToastModel 테스트 | not selected | EP-3 (4) |
| VP-04 | MD-04 ↔ UT | REQUIRED | init/status → fromClaude… | permission-mode 테스트 | not selected | EP-4 (2) |
| VP-05 | MD-05 ↔ UT | REQUIRED | stream_event/assistant → usageSnapshot | claude-map 테스트 | not selected | EP-5 (2) |
| VP-06 | MD-06 ↔ UT | REQUIRED | post-turn loop → prepareNext | chat-turn 테스트 | not selected | EP-6 (2) |
| VP-07 | MD-07 ↔ UT | REQUIRED | registerAuthDefinitions → accept | registry 테스트 | not selected | EP-7 (2) |
| VP-08 | MD-08 ↔ UT | REQUIRED | runGit → gitExecutable | infra/git 테스트 | not selected | EP-8 (1) |
| VP-09 | MD-09 ↔ UT | REQUIRED | PendingSteerTurn → useChatSession | pendingSteerControls 테스트 | not selected | EP-9 (1) |
| VP-10 | R-10 ↔ AT-10 | REGRESSION | 전체 | FAIL 집합 diff = ∅ | — | 0 — 집계 pair |

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| typecheck | app 소스 변경 | `npm run typecheck:{node,web,test}` | 신규 오류만 blocking |
| lint | boundaries·import 규칙 | `npx eslint <변경 파일>` | 동일 |
| vitest | 영향 suite | `vitest run` 영향 디렉토리 + 기준선 diff | 신규 실패만 |
| trailer | 커밋 프로토콜 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 전수 조사

| 대상 | 검색 | N | 의미 |
|---|---|---:|---|
| `reserveHeld`/`reserveItem` 프로덕션 호출 (main) | `git grep -n "reserveHeld\|reserveItem" main -- 'src/**/*.ts' ':!*.test.ts'` | 3 | 전부 `'turn-open'` — `'steer'` 생산자 0 |
| HEAD 파생 삼항 (main, 비-테스트) | `git grep -nE "head\.kind (!==\|===) '(unborn\|detached)' \?"` | 10 | 6파일 복붙 |
| 같은 검색 (HEAD) | 동일 | 2 | `probe.ts` 헬퍼 정의만 |
| detail 절단식 `APP_ERROR_DETAIL_MAX - 1` (main) | `git grep` | 2 | main/renderer 사본 |
| 같은 검색 (HEAD) | 동일 | 1 | `shared/app-error.ts` |
| `deps.prepareContinuation(` (post-turn, HEAD) | `git grep` | 1 | `prepareNext` 내부 |
| `resolveRepoRoot`/`resolveHeadRef` 비-테스트 호출 | `grep -rn` | 0 | D-005 로 유지 |

### 수치 검산

- 커밋 `a27b93ec`: 30파일 +266 / −358 (`git show --stat`).

## 9. Architecture — AS-IS → TO-BE

### AS-IS

- 큐: `TrackedBatch.origin` 이 `'turn-open' | 'steer'`, `confirm(model-output)` 이 `origin === 'turn-open'` 만 확정. 생산자는 `'turn-open'` 만 전달.
- git: 6파일이 `probe.head` 에서 oid/name 을 각자 삼항으로 파생.
- 오류: main `publishErrorReport` 와 renderer `reportError` 가 절단식을, hub 와 `errorToastModel` 이 키 템플릿을 각자 보유.
- 권한 모드: 두 개의 6-case switch 가 손으로 역관계 유지.

### TO-BE

- 큐: origin 필드·인자·재스탬프 삭제. `confirm` 은 열린 배치의 uuid 일치만 본다 — 생산자 전원이 turn-open 이었으므로 결과 동일.
- git: `probe.ts` 가 `headOid`/`headName` 을 export, 6파일이 호출.
- 오류: `shared/app-error.ts` 가 `clampErrorDetail`/`appErrorKey` 를 소유(이미 `APP_ERROR_DETAIL_MAX` 소유자).
- 권한 모드: `CLAUDE_PERMISSION_MODE` 테이블(`satisfies Record<…>`)에서 정·역방향 파생.

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | V 연결 |
|---|---|---|---|
| 책임/소유권 | 규칙 사본 2~10개 | SSOT 헬퍼 1개 | MD-02·03·04·05 / VP-02~05 |
| data/control flow | post-turn 동일 블록 2벌 | `prepareNext()` 1벌 | MD-06 / VP-06 |
| state/contract | `TrackedBatch.origin` | 삭제 | MD-01 / VP-01 |
| lifecycle | git 탐색 결과만 캐시 | in-flight promise 공유, 미발견은 비움 | MD-08 / VP-08 |
| 구독 | 8필드 shallow 구독 | 1필드 selector | MD-09 / VP-09 |

## 10. 계약 / 강제 지점

| pair | 계약 | SSOT | 자리 | 실패 의미 |
|---|---|---|---|---|
| VP-01 | 예약 확정 = uuid 일치 + open 상태 | `pending-message-queue.ts` `confirm` | `enqueue.ts` 2 · `post-turn.ts` 1 | 메시지 커밋 누락/중복 |
| VP-02 | unborn→oid null · detached→name null | `probe.ts` | `repository.ts` 2 · `prepare-worktree.ts` 2 · `service.ts` 2 · `git-cli.ts` 2 · `git-diff.ts` 1 · `git-snapshot.ts` 1 | 브랜치 칩/worktree 기준 오표시 |
| VP-03 | detail ≤300자(`…` 포함) · 키 `title\0detail` | `shared/app-error.ts` | main index 1 · renderer reportError 1 · hub 1 · errorToastModel 1 | 토스트 dedupe/절단 불일치 |
| VP-04 | 6종 정·역 매핑 | `CLAUDE_PERMISSION_MODE` | to 1 · from 1 | 관측 모드 오정규화 |
| VP-05 | snake→camel usage 4필드 | `usageSnapshot` | message_delta 1 · assistant 1 | 컨텍스트 사용량 오표시 |
| VP-06 | prepare 후 abort 시 resume→continue, 아니면 break | `prepareNext` | listen 1 · flush 1 | 연속 턴 오재개 |
| VP-07 | duplicate→invalid_id→invalid_origin 순 | `accept` | login-required 1 · login-free 1 | 선언 거부 사유 변경 |
| VP-08 | 동시 호출 결과 공유, null 비캐시 | `gitExecutable` | 1 | git 설치 후 미인식 |
| VP-09 | 표시 = `activityForeground` | `useChatSession` | 1 | 버튼 표시 오판정 |

- 실패 의미에 "다른 게이트가 막는다" 없음.

## 11. 구현 설계

| 파일 | 변경 |
|---|---|
| `features/chat/pending-message-queue.ts` | `BatchOrigin`·`origin` 필드/인자·재스탬프 삭제, 주석 정정 |
| `app/chat-turn/{enqueue,post-turn}.ts` | origin 인자 제거, `prepareNext()` 추출 |
| `infra/git/probe.ts` + 6파일 | `headOid`/`headName` 추가·사용 |
| `shared/app-error.ts` + 4파일 | `clampErrorDetail`/`appErrorKey` |
| `shared/permission-mode.ts` | 매핑 테이블 |
| `adapters/claude-map.ts` | `usageSnapshot()` |
| `adapters/claude.ts` | 일본어 주석 → 한국어 |
| `features/auth/registry.ts` | `accept()` |
| `infra/git/git-executable.ts` | in-flight promise |
| `renderer/.../PendingSteerTurn.tsx` | 단일 필드 selector |
| `features/usage/breakdown.ts` · `infra/db/usage-queries.ts` | `isRecord` 재사용 · 중복 `find` 제거 |
| 테스트 6파일 | origin 인자 제거, steer 전용 케이스 1건 삭제, mock 2건 갱신 |

## 12~15. End-to-end · Lifecycle · 성능 · 외부 포트

- producer/consumer·IPC·DB 스키마 변경 없음. 외부 구현 포트 변경 없음.
- 성능: git PATH 탐색 동시 N→1, `PendingSteerTurn` 재렌더 감소. 잃는 부수 효과 없음(미발견 비캐시 유지).
- 다중 저장소 쓰기: 해당 없음(문서 사본은 plan.md + INDEX.md 2곳 — 함께 갱신).

## 16. 기존 결정·규칙과의 관계

| 기존 결정 | 출처 | 본문 문장 | 결과 |
|---|---|---|---|
| 0151 AC1/AC5 origin 비대칭 확정 | `pending-message-queue.ts` 구 주석 | §9 TO-BE 큐 | **변경** — 0250 이 steer 생산자 제거, 규칙 대상 소멸 |
| 0211 AT-44 `resolveHeadRef` | `repository.test.ts` | D-005 | 유지 |
| 0249 ΔV3 미지 모드 무시 | `permission-mode.ts` 주석 | AC4 | 유지 |
| 루트 AGENTS 언어 규약(주석 한국어) | `AGENTS.md` 원칙 8 | §11 claude.ts | 유지(위반 정정) |

## 17. 리스크

| 리스크 | 완화 |
|---|---|
| 향후 steer 생산자가 다시 필요 | git 이력(`main` 의 `BatchOrigin`)에서 복원 가능, 0151 plan 보존 |
| `gitExecutable` promise 가 reject 시 영구 캐시 | 해당 없음 — `resolveGitExecutable` 의 기본 `isFile` 이 예외를 catch 해 false 반환(`git-executable.ts:14-21`) |

## 18. 영향 파일

- 코드: 커밋 `a27b93ec` 의 30파일.
- 문서: 본 plan, `docs/handoff/INDEX.md`.

## 19. 게이트

- 적용 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 정적: `npm run typecheck:node && npm run typecheck:web && npm run typecheck:test`, 변경 파일 `eslint`.
- 테스트: 영향 디렉토리 `npx vitest run` + `main` 기준선 FAIL 집합 diff.
- 사람 실기: 없음.

## READY self-review

- Decision Ledger D-001~005 ACTIVE, OPEN 0.
- `ACTIVE 결정 ↔ AC` 충돌 0 (§3 갱신 메모).
- 모든 NEW/CHANGED MD 노드에 REQUIRED pair(VP-01~09), 전체 회귀 VP-10.
- 사람 실기로 미룬 순수 로직 없음.
