# Verify — 0303-mail-get-and-sync-modes

**판정: `RETURN_TO_PLAN`** — 막는 이행·현재 결함 0, 모든 REQUIRED·REGRESSION pair PASS, gate green. 확장 후보 1건(E1)이 verify 1회째(창 안)라 `PLAN_GAP`이다. 설계자가 경계 선언 또는 UT 입력 채택으로 닫는다.

## 메타

| 항목 | 값 |
|---|---|
| 대상 | V1 rev.4 · r1 구현 `c774ebd` (`git cat-file -t` = commit · `merge-base --is-ancestor origin/main` 성공) |
| 확장 창 | verify **1회째**(창 안). 이전 `판정 정정` 절 없음, ΔV 없음 |
| 검증자 | Claude (구현자 Codex — 독립 축 ⑥은 구현 주체와 무관하게 수행) |
| 환경 | Linux · plain Node 22.23.4 · `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`(Node ABI). Electron 미설치 |

## 0. 기준선 / plan 변경

- 구현 커밋의 `plan.md` diff: 삭제 6줄은 `[구현자 기입]` 템플릿 제목뿐이다(`git diff c774ebd~1 c774ebd -- plan.md | grep '^-'`). AC·Decision 완화 없음.
- Plan validity: V mode·Baseline·pair 10행·§10 자리 33(EP-01 6·02 8·03 7·04 2·05 4·06 6)이 갖춰졌다. 자리 검색을 `rg -e` 로 다시 돌려 production 운반 자리와 대조했고 차집합 ∅(`getMail`·`joinsRunningSync|inFlight`·`sliceBody|mailMeta|readManifest`·`reconciled.fresh`·`isFresh(`·`name: 'mail_`=8줄).

## 1~3. diff 비판 · 역방향 · end-to-end

- `scan-surface.sh`: 미사용 값 export 0 · 테스트 전용 0 · 형제 비대칭 0. 타입 export 7개는 내부 시그니처용.
- false success 없음: `mail_get` null → `mail_not_found`+`isError`, full 중 파싱 실패는 기존 캐시 유지(저장 전 `continue`).
- 사본 drift 후보: `getMail` SQL의 `COALESCE(header_date, first_seen_at)` 는 검색 SQL 3곳과 별도 문자열이다. V06이 `getMail`만 `first_seen_at` 로 바꾸면 red — 잠겨 있다.
- tools·manager 두 flight 층: 대기 중 owner가 먼저 해제되는 순서(owner `await` 1틱 < waiter `catch→then`)라 V03(무조건 해제)은 동치.

## 4. 증거 재측정

| 항목 | 관측 |
|---|---|
| mail 16파일 | `vitest run src/main/features/plugins/mail src/main/app/deployment/mail.integration.test.ts` → **225/225** (보고와 일치) |
| 전체 vitest(파일 필터 없음) | 29 files failed · 22 tests failed (Electron 미설치·Windows 경로 계열). 변경 전 `c774ebd~1` worktree 실행과 `(파일,테스트)` 집합 **42 ↔ 42, 차집합 양방향 ∅**. mail 파일 실패 0 |
| `node --test scripts/*.test.mjs` | 827/827 |
| lint / typecheck | lint 0 error · 2 warning(기존, `react-hooks/incompatible-library`) · typecheck 3종 통과 · `git status` 변화 없음 |
| 가드 | migrations(no-copies ok, append-only는 이전 `v*` 태그 없어 생략) · doc-inventory prose/links ok · test-budgets 20 suites ok |
| 의존성·마이그레이션 | `git diff 5b4ee524 HEAD --stat -- app/package.json app/package-lock.json …/mail/migrations` → 0줄(AC20) |

## 5. V-pair closeout

| Pair | 판정 | 근거 |
|---|---|---|
| VP-01·05 | PASS | 통합 AC1·2·6·7·9 + store 테스트, V05(page에 `bodyText` 누출)·V06 red |
| VP-02·04 | PASS | A01·A02 red, 통합 AC10~14 |
| VP-03 | PASS | tools.test(순서·힌트)·V01(`idempotentHint` 제거) red |
| VP-06·08 | PASS | A03·A04 red, 4조합 UT |
| VP-07 | PASS | body-window 9분기 입력 — 단 E1 참조 |
| VP-09 | PASS | 기존 mail 14파일 포함 225 green |
| VP-10 | PASS | A05·A06 red |

AC 21/21 재계수: 행 21 · 합계 21 · 커밋 trailer `Criteria-Met: 21/21` · INDEX 비고 21/21 일치. 강제 지점 33/33 — 구현 보고 표 33행, 검색 차집합 ∅.

## 6. 고장 이력

| ID | 위치 | 종류 | 결과 | 분류 |
|---|---|---|---|---|
| S01~S61·A01~A06 (67행) | 구현 보고 spec | 제거·맞바꿈·고정값 | 구현자 spec의 oracle이 Electron 바이너리라 이 환경에서는 exit 127(가짜 red). **oracle을 `./node_modules/.bin/vitest` 로 바꿔 재실행: 65 red(exit 1) · 2 green(S12·S13)** — 보고와 일치, 원복 확인 | S12·S13 동치(slice가 끝을 clamp, B 8케이스 green) |
| V01 | `tools.ts:126` | 제거 | `idempotentHint` 제거 → red 1 | 잡음 |
| V03 | `sync-manager.ts:243` | 제거 | 무조건 해제 → green | 동치(위 §1~3 순서 근거) |
| V04 | `store/index.ts:182` | 다른 값 | `limit=10→50` → green | 동치 — `attachmentManifest` 가 `Math.min(10, limit)` 로 다시 자른다 |
| V05 | `sync-manager.ts:269` | 맞바꿈 | `{...meta}`→`{...stored}` 로 본문 전체 누출 → red 1 | 잡음 |
| V06 | `store/index.ts:356` | 다른 값 | getMail 날짜 SQL → red 1 | 잡음 |

못 잡음 0. 하네스 `모든 파일 원문 그대로` 확인.

## 7. 독립 축 ⑥ · 발견

E1 — **`sliceBody` 의 안전하지 않은 큰 정수 offset**. `Number.isSafeInteger(offset) && offset >= 0` 라 `2**53`·`1e21`·`Infinity` 는 0으로 정규화된다. 실측: `sliceBody('x'.repeat(20000), 2**53, 5)` → `offset:0, returnedChars:5, nextOffset:5` (규칙 칸 (e)는 `offset ≥ total → text:''·nextOffset:null`).

- 도달성: 도구 스키마 `z.number().int().min(0)`(zod 4.4.3)은 `2**53`·`1e21` 모두 거부(`safeParse(...).success=false`). 직접 handler 호출·`sliceBody` 호출로만 닿는다. production MCP 경로 도달 없음.
- 분류: **확장 후보**. (e)의 UT 입력은 `20000`·`99999` 뿐이고, ①은 "음수/비정수 → 0"만 적어 안전하지 않은 정수는 두 칸 사이에 열거되지 않았다. 원문이 덮는지 해석이 필요하다.
- disposition: 창 안(verify 1회째) → `PLAN_GAP`. 가장 작은 해결은 **경계 선언**(스키마가 거부하는 입력)이고, 채택하면 EP-01 ① 규칙 칸에 "안전하지 않은 정수 → 본문 밖 offset과 같이 빈 창"을 더하고 UT 입력을 추가한다.

그 밖의 독립 입력: `'a😀😀😀'` `(1,1)` → pair 전체(2자), 끝 lone high surrogate `('ab\ud83d',2,1)` → 1자·null — 규칙 칸과 일치.

## 8. 못 본 것

Windows CI · Electron 런타임 실행 · 실제 POP3 서버 대상 `full` · 폐쇄망 배포 조립(통합 테스트의 fake socket만 관측). 사람 실기 항목은 plan §READY self-review대로 없음.

## 9. Repository operation checks

- 커밋 trailer: `git log -1 --format='%(trailers:only=true)' c774ebd` → Agent/Handoff/Status/Criteria-Met/Verified-By 5키 파싱. 허용값 일치.
- INDEX 비고는 5줄 이내. 대상 커밋 좌표는 이번 검증이 `c774ebd` 로 기입한다.
- `AGENTS.md` 변경 없음. 이동·삭제된 reference 없음.
- 자기 실행 잔여물: `app/node_modules`(untracked, ignore) · `/tmp/claude-0/*.json` · `git worktree` 제거 완료.

## 13. Finding disposition / 파생 이슈

| ID | 분류 | disposition | 처리 |
|---|---|---|---|
| E1 | 확장 후보 | `PLAN_GAP` (창 안) | 설계자: 경계 선언 또는 EP-01 ①·UT 입력 채택 |

## 14. Review Signals — 사실만

- verify 1회째. 이전 라운드 증상 없음. 독립 축 ⑥ 발견 1건(확장 후보). 구현자 oracle 명령이 Electron 전용이라 plain Node 환경에서 재현하려면 명령 치환이 필요했다.

## 15. 결론

`RETURN_TO_PLAN` — 이행·현재 결함 0, E1(확장 후보 1)만 `PLAN_GAP`. 구현 코드 수정 요구는 없다. 설계자가 E1을 경계로 선언하면 구현 턴 없이 verify 2회째로 간다.
