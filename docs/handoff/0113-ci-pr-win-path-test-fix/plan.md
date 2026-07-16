# Plan — 0113-ci-pr-win-path-test-fix

> 비기능(버그수정 + CI) = Claude 가 plan→impl→verify 직접 수행. 정본 규칙 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0113-ci-pr-win-path-test-fix` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | PR (신규) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① "github ci에서 에러발생. claude-executable.test.ts 에서 발생 중" — CI 실패를 고쳐라. ② "ci는 모든 pr에서 동작하도록" — 모든 PR 에서 CI 실행. | 라이브 세션 요청 |
| 명시 결정 | PR 트리거 paths 필터는 **유지**(기존 push 와 동일 `app/**`·`.github/workflows/**`). | 라이브 세션 AskUserQuestion 응답("paths 필터 유지") |

## Context (왜)

`ci.yml`(windows-latest)이 main push 에서 연속 실패(run 29472762423 등). 실패는
`app/src/main/adapters/claude-executable.test.ts` 의 4개 테스트. POSIX 문자열(`/opt/bin/claude`)을
기대값에 하드코딩했는데 피검 코드는 `node:path` `join`(호스트 시맨틱)을 쓴다 — Windows 러너에선
`join` 이 백슬래시 경로를 만들어 mock `exists`(POSIX 비교)가 매치 실패 → `undefined` 반환 → 단언
실패. 로컬(리눅스/맥)은 `join` 이 POSIX 라 통과 = "로컬 green / CI red". 소스는 프로덕션에서 옳다
(Windows 앱은 win32 경로가 맞다) — 버그는 테스트 기대값 구성 방식에 국한.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 실패 4건: line 32·56·143·153, 모두 `expected undefined to be '<posix path>'` | CI run 29472762423 job `gate` 로그 |
| `join` 은 호스트 OS 시맨틱(win 러너=백슬래시). 같은 파일 win32 테스트는 `const target = join(...)` 로 호스트-일관하게 계산해 이미 안전 | `app/src/main/adapters/claude-executable.test.ts:36`(주석), `:37-40`·`:60-62` |
| `findOnPath`/`officialInstallPath` 는 내부에서 `join(dir, claudeBinName(platform))` 호출 | `app/src/main/adapters/claude-executable.ts:38`·`:50` |
| `resolveClaudeExecutable()` 는 인자 없이 `process.platform` 을 타므로 러너에서 win32(`claude.exe`) | `claude-executable.ts:83-85`·`:24-26` |
| 현행 트리거는 main push(paths)+dispatch 뿐 — 0088 "PR CI 없음" 결정 | `.github/workflows/ci.yml:1-13`, `app/AGENTS.md` CI 표 |

## 인수 기준 (Acceptance Criteria)

1. `claude-executable.test.ts` 의 POSIX 테스트 4건이 **호스트-독립**으로 재작성돼 리눅스·Windows 양쪽에서 통과한다(win32 테스트와 동일한 `join(...)` 계산 패턴).
2. `claude-executable.ts`(소스)는 **무변경**.
3. `ci.yml` 에 `pull_request` 트리거 추가, paths 필터는 push 와 동일(`app/**`·`.github/workflows/**`). 헤더 주석 갱신.
4. `app/AGENTS.md` CI 표의 트리거·0088 문구를 PR CI 추가에 맞게 갱신.
5. 로컬 게이트 lint ✅ / typecheck ✅ / 대상 vitest 스위트 green.

## 범위 / 비범위

- **범위**: 테스트 기대값 호스트-독립화 + PR 트리거 추가 + 관련 문서 정합.
- **비범위**: 다른 테스트 파일·소스 로직 변경, CI 스텝/러너/paths 필터 정책 변경(사용자 확정대로 유지).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용(`node:path` `join`). **신규 의존성 0.**
- 전제: 실제 CI(windows-latest)는 egress 가 열려 better-sqlite3 정상 rebuild → 전체 게이트 실행. 제약 환경(egress 차단)에선 DB 스위트 로드 불가라 비-DB 대상 스위트로 로컬 검증.

## 설계

- **테스트**: POSIX 테스트 기대값을 `const target = join(...)` 로 계산해 `exists`/단언에 재사용. 우선순위 블록은 `const bin = process.platform === 'win32' ? 'claude.exe' : 'claude'` 를 두고 `join('/opt/bin', bin)`·`join('/home/u','.local','bin', bin)` 로 기대 경로 계산. 이미 파일에 존재하는 win32 테스트 패턴을 그대로 확장(재사용).
- **CI**: `on.pull_request.paths` 를 push 와 동일하게 추가. `concurrency.group: ci-${{ github.ref }}` 는 PR 별 자연 분리라 무변경.
- 레이어 경계: 테스트/워크플로/문서만 — main DAG 영향 0.

## 파생 UX / 엣지케이스

- `path: '/opt/bin'` 단일 엔트리라 `;`/`:` 어느 분리자에서도 안전(유지). N/A 그 외 UX.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| Windows 실패를 로컬(리눅스)로 재현 불가 → 회귀 확인이 어려움 | `path.win32` 시뮬레이션으로 4건 PASS 사전확인 + 최종 판정은 PR 의 windows-latest CI green |
| 0088 결정(PR CI 없음)을 뒤집음 | 사용자 명시 요청 → 결정 확정. 문서(ci.yml 주석·app/AGENTS.md)에 supersede 명기 |

## 영향 받는 파일

- `app/src/main/adapters/claude-executable.test.ts`
- `.github/workflows/ci.yml`
- `app/AGENTS.md`
- `docs/handoff/0113-*/{plan,verify}.md`, `docs/handoff/INDEX.md`

## 참고 문서

- `app/AGENTS.md` "CI / 릴리스" 표, `app/src/main/AGENTS.md`(레이어)
- IPC 변경 없음 → `IPC_CONTRACT.md` 무관.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`(제약 환경은 대상 vitest 스위트 + lint + typecheck 로 대리, DB 스위트/electron 은 CI/사람 몫).
- 신규 테스트: 신규 없음(기존 테스트 호스트-독립화).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구·명시 결정을 라이브 세션 출처로 인용.
- [x] 자료조사 — 발견마다 `파일:라인`·CI run 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 0 명기.
- [x] 파생 UX — 해당 엣지(분리자)만, 나머지 N/A.
- [x] 리스크 — Windows 재현 불가·0088 supersede 를 완화책과 함께.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 소스 무변경·테스트 기대값만 호스트-독립화가 최소·정답 패턴(win32 테스트가 선례). CI PR 트리거는 push 와 대칭이라 리스크 낮음.
- 이견 / 우려: 없음. 단 "우선순위 블록"은 `process.platform` 을 mock 하지 않으므로 `bin` 을 런타임 platform 에서 파생해야 러너별로 옳다(설계대로 반영).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 리눅스에서 Windows 회귀를 재현 못함 | ✅ `path.win32` 로 4건 로직 시뮬레이션해 PASS 확인(구현) | 최종 권위는 windows CI |

## [구현자 기입] 구현 체크리스트

- [x] POSIX 테스트 4건 `join(...)` 계산값으로 전환.
- [x] `ci.yml` `pull_request` 트리거(paths 유지) + 헤더 주석.
- [x] `app/AGENTS.md` CI 표 갱신.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `claude-executable.test.ts` · `.github/workflows/ci.yml` · `app/AGENTS.md` · handoff(plan/verify/INDEX) |
| 실행 명령 | `vitest run …/claude-executable.test.ts` / `npm run lint` / `npm run typecheck` / `path.win32` 시뮬레이션 |
| 게이트 결과 | 대상 스위트 17/17 ✅ · lint 0 error ✅ · typecheck 3/3 ✅ · win32 시뮬 4/4 PASS |
| 블로커 / 역질문 | 없음 (전체 `npm test`·windows 실기는 egress 열린 CI 몫) |
| 대상 커밋 | `<impl-hash>` (push 후 INDEX 기재) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

(없음 — verify PASS 예정)
