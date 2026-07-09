# Verify — 0087-cicd-release-pipeline

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0087-cicd-release-pipeline` |
| 검증자 | Claude Code |
| 일자 | 2026-07-09 |
| 대상 커밋 | `fb72b1e` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견: `node --test scripts/`(디렉토리 인자) 가 Node 22.22 에서 실패 → 인용 glob `"scripts/*.test.mjs"` 로 조정 | 타당 — 로컬 재현 확인, node 러너 자체 glob 확장이라 Windows cmd 에서도 안전 | 매트릭스 #9 증거로 채택 (설계 의도 유지, 명령 형태만 조정) |
| 선조치 ✅ #2: latest.yml `size` 문자열 → `Number()` 정규화 비교 | 타당 | 매트릭스 #7 · `validate-dist.test.mjs` 로 고정 |
| 선조치 ✅ #3: 본 컨테이너 electron postinstall 403 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 로 게이트 실행 | 타당 — 0019/0085 와 동일 환경 제약, CI 러너 무관 | 게이트 결과 해석에 반영 (아래) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | version 0.1.0 + lock 동기화 | ✅ | `app/package.json:3` = `"0.1.0"` · `package-lock.json:3,9` 동기화 (`npm install --package-lock-only`) |
| 2 | ci.yml — push(main)/PR paths 필터 + dispatch, windows-latest + Node 22 + npm 캐시, `npm ci → 마이그레이션 가드 → lint → typecheck → test` | ✅ | `.github/workflows/ci.yml` (트리거 6-17행, 러너/캐시 26-42행, 스텝 44-59행) · js-yaml 파스 OK |
| 3 | release.yml — tags `v*` + dispatch(dry-run), windows-latest, `contents: write` 단일 job | ✅ | `.github/workflows/release.yml` (트리거 12-15행, permissions 17-18행, job 24행~) |
| 4 | 버전 검증 fail-fast (태그↔package.json, strict semver, 빌드 전) | ✅ | `release.yml` "Validate version" 스텝(npm ci 이전) · `validate-release-version.mjs` · 테스트 5건 + CLI 스모크(불일치 exit 1) |
| 5 | DB 마이그레이션 검증 — (a) vitest `migrate.test.ts` 게이트 포함 (b) 동기화+append-only 가드 | ✅ | (a) `npm test` 에 포함되어 green (b) `check-migrations-appendonly.mjs`: 동기화(형식·연속번호·잉여/누락) + `v*` 태그 diff append-only(M/D/R 거부, 첫 릴리스 공지 후 스킵) · 테스트 8건 + 실저장소 스모크(`12 migrations sync ok`) |
| 6 | 태그 시 `build:win -- --publish always` → draft 에 setup.exe/latest.yml/blockmap, dispatch 시 `--publish never` | ✅ | `release.yml` 빌드 2스텝 (`if: github.ref_type == 'tag'` 분기, `GH_TOKEN`) · `electron-builder.yml:45-49` publish github/draft 유지 · **실 업로드는 사람 확인 항목** (아래 책임 분리) |
| 7 | 산출물 검증 (version/sha512 재계산/size/blockmap) + workflow artifact 상시 업로드 | ✅ | `validate-dist.mjs`(sha512 base64 재계산 대조) · 테스트 5건 · `release.yml` "Validate dist" + `upload-artifact` (`if-no-files-found: error`) |
| 8 | unsigned 유지 — 서명 설정/`CSC_*` 부재 + 명시 | ✅ | 워크플로 2종·`electron-builder.yml` 에 서명 설정 0 (`grep -ri 'csc\|certificate\|signtool' .github app/electron-builder.yml` 무일치) · `release.yml` 헤더 주석 · 운영 문서 §unsigned |
| 9 | 스크립트 3종 하우스 패턴 + `node --test` 동반, `npm test` 자동 포함 | ✅ | pure export + 얇은 CLI(`ensure-sqlite-abi.mjs` 미러) · `package.json:14` `vitest run && node --test "scripts/*.test.mjs"` · 24/24 pass |
| 10 | `docs/guides/release-operations.md` — 절차·수동 체크리스트·롤백(서버/클라이언트·`DB_SCHEMA_TOO_NEW`·백업 복원)·unsigned·트러블슈팅 | ✅ | 문서 전 섹션 존재, 0084/0085 설계와 정합(idle-gate·backup.before-* 파일명 `migrate.ts:116` 일치) |
| 11 | 게이트 통과 | ✅ | 아래 게이트 재실행 (환경 제약 3스위트 별도 해석) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck 3종 ✅ / vitest 773/773 + node --test 24/24 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 11/11 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | `app/src/**` 무변경 — boundaries 영향 0 |
| 문서 형식/링크/한국어 | ✅ | — | 확인 |
| 워크플로 YAML 구문 | ✅ | — | js-yaml 파스 2/2 OK |
| **실 러너 CI green (ci.yml)** | ✖ | ✅ | **사람 확인 대기** — 머지/PR 후 Actions 확인 |
| **release.yml dry-run + 실 NSIS 빌드·draft 업로드** | ✖ | ✅ | **사람 확인 대기** — 머지 후 dispatch → `v0.1.0` 태그 |
| **업데이트 시나리오 수동 체크리스트** | ✖ | ✅ | **사람 확인 대기** — `release-operations.md` §체크리스트 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음 (신규 npm 의존성 0, Actions 4종은 표준) |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 시 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint ✅ (eslint ./src ./scripts — 신규 .mjs 6종 포함)
typecheck ✅ (node/web/test 3종)
vitest: Tests 773 passed (773) — Test Files 101 passed, 3 failed(로드 실패)
node --test "scripts/*.test.mjs": 24 pass / 0 fail
```

- vitest 3개 스위트(`chat-turn.continuity` · `chat-turn.runtime-resilience` · `history/writer`)는 **electron 바이너리 egress 403 환경 제약**으로 로드 실패 — 0019/0085 verify 에 기록된 동일 계열, 본 변경(`app/src` 무변경)과 무관. CI windows-latest 에서는 재현되지 않는 컨테이너 한정 제약.
- CLI 스모크: `validate-release-version.mjs v0.1.0` ok / `v9.9.9` exit 1 · `check-migrations-appendonly.mjs` 실저장소 12개 sync ok + 첫 릴리스 append-only 스킵 공지.

## 위생 검토

- 키/토큰/이메일/IP 스캔: 워크플로는 `secrets.GITHUB_TOKEN` 참조만(값 없음), 신규 파일에 비밀/PII 없음.
- AGENTS.md 변경: 없음.

## PHASES.md 정합성

- `0087` 행을 Phase 3++ 표로 승격 (커밋 `fb72b1e`), "현재 작업 중"은 보드 링크 유지.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: `node --test` 디렉토리 인자의 Node 버전별 동작을 미검증한 채 설계에 적음 — 구현 턴에서 발견·조정됨.
- 구현 단계: NSIS 실빌드·draft 업로드·blockmap 생성은 linux 컨테이너에서 실기 불가 — `validate-dist.mjs` 는 fixture 단위 테스트로만 검증됨. 실 latest.yml 포맷과의 최종 대조는 머지 후 dispatch dry-run 이 수행한다.
- 검증 단계: 워크플로는 구문 파스까지만 — GitHub Actions 표현식(`github.ref_type == 'tag' && github.ref_name || ''`)의 실평가는 실 러너에서만 확인 가능. 첫 태그 릴리스에서 확인 필요.

## 결론 / 다음 단계

- 상태: **PASS** → INDEX `verify/PASS` · PHASES 승격.
- 사람 후속: ① main 머지 ② Actions 에서 release.yml `workflow_dispatch` dry-run ③ `git tag v0.1.0 && git push origin v0.1.0` → draft 자산 3종 확인 ④ `release-operations.md` 수동 체크리스트 ⑤ draft Publish.
