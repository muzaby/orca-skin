# Plan — 0088-ci-trigger-versioning

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 0087 릴리스 파이프라인의 후속 조정.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0088-ci-trigger-versioning` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | PHASES Phase 3++ (0087 후속) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① CI 트리거를 **main 브랜치 push** 로 변경 ② 버전 올리는 방식 제안 → `npm version` 채택, `orca` 버전은 0.1.0 에서 시작 ③ **bump 도입** (문서화만이 아니라 실제 도구로 도입) | 라이브 세션 요청 (2026-07-10): "ci 트리거를 main 브랜치 push 로 변경 / 버전 어떻게 올릴지 제안하라" → AskUserQuestion 답변("main push 자동실행", "npm version (orca) … 0.1.0 에서 시작") → "bump 도입하라" |
| 추론 의도 | "main push 자동실행" = `push(main)` 자동 + `workflow_dispatch` 수동 버튼 유지, `pull_request` 제거 (추론 — 로컬 게이트가 커밋 전 이미 돌아 브랜치 CI 불요). "bump 도입" = `npm version` 을 감싼 `release:*` npm 스크립트를 package.json 에 추가해 일급 도구화 (추론 — 실 태그 생성=실 릴리스라 숫자 bump 실행은 사용자 몫) | 답변 조합 해석 |

## Context (왜)

0087 이 릴리스 파이프라인을 구성했으나 사용자가 두 조정을 요청했다: (1) `ci.yml` 트리거가 `push(main)`+`pull_request`+`workflow_dispatch` 로 넓은데 브랜치/PR CI 를 걷어내 main push 자동 실행으로 좁힌다(로컬 게이트가 안전망). (2) 버전 올리는 방식을 `npm version` 기반 `release:*` 스크립트로 프로젝트에 도입해 표준화하고, release.yml 의 `v*` 태그 트리거·`validate-release-version.mjs` 와 정합시킨다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 현재 `ci.yml` 은 `push(main, paths)`+`pull_request(paths)`+`workflow_dispatch` 3트리거 | `.github/workflows/ci.yml` `on:` 블록 (0087, 커밋 `fb72b1e`) |
| release.yml 트리거는 `v*` 태그 + dispatch — ci.yml 과 독립(영향 없음) | `.github/workflows/release.yml` `on:` |
| 태그↔package.json 일치·strict semver 를 빌드 전에 강제 → `npm version` 이 항상 통과시킴 | `app/scripts/validate-release-version.mjs` (0087) |
| `npm version <bump>` 은 package.json+package-lock.json bump·커밋·태그(`v` 접두 기본)를 한 번에 생성하며 clean 트리를 요구 | npm 문서 (https://docs.npmjs.com/cli/commands/npm-version) |
| 태그 접두 `v` 기본값(`tag-version-prefix`)이 release.yml `tags: ['v*']`·`^v\d+\.\d+\.\d+$` 정규식과 일치 | `.github/workflows/release.yml` · `validate-release-version.mjs` |
| 현재 릴리스 운영 문서는 수동 편집(package.json + `npm install --package-lock-only` + 수동 태그) 기술 | `docs/guides/release-operations.md` §릴리스 절차 |
| 버전 0.1.0 은 0087 에서 반영됨 (단일 진실원) | `app/package.json:3` |
| downgrade 금지 — electron-updater `allowDowngrade` 기본 false + DB `DB_SCHEMA_TOO_NEW` 가드 | 0084/0085 · `app/src/main/infra/db/migrate.ts` |

## 인수 기준 (Acceptance Criteria)

1. `ci.yml` 이 `push(main)` + `workflow_dispatch` 만 트리거하고 `pull_request` 는 없다 (js-yaml 파스 OK, `paths`/`concurrency`/job 스텝 불변).
2. `app/package.json` `scripts` 에 `release:patch`·`release:minor`·`release:major`(각 `npm version <bump> -m "chore(release): v%s"`)가 도입됐고, `version` 은 `0.1.0` 그대로다.
3. `docs/guides/release-operations.md` 의 릴리스 절차가 `npm run release:*` 기반이고, 상시 게이트 행 트리거 설명이 갱신되며, SemVer 정책(pre-1.0) 소절이 추가됐다.
4. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.

## 범위 / 비범위

- **범위**: 인수 기준 1~4 (ci.yml 트리거 축소 + release:* 스크립트 도입 + 문서 갱신 + 핸드오프 산출물).
- **비범위**: 실제 버전 숫자 bump/태그 생성(=실 릴리스, 사용자 몫). 0087 의 plan/verify.md 수정(당시 shipped 기록). release.yml 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: `npm version`(npm 내장), 0087 의 `validate-release-version.mjs`·release.yml 트리거. 신규 의존성 0.
- 전제: 버전 커밋 전 워킹트리 clean(= `npm version` 안전 가드) — 문서에 명시.

## 설계

- `ci.yml` `on:` 에서 `pull_request:` 블록만 삭제, 상단 코멘트의 PR 문구 정리.
- `app/package.json` `scripts` 에 `release:*` 3종 추가(`ensure-sqlite-abi`·기존 스크립트 관례와 동일 위치). 소스/레이어 변경 0.
- `release-operations.md` — §구조 표 게이트 행 + §릴리스 절차 1~2단계 + 신규 §버전 정책.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- `npm version` 은 dirty 트리에서 실패 → 버전 커밋 전 다른 변경을 먼저 커밋(문서 주의).
- `pull_request` 제거 시 브랜치/PR 단계 CI 미실행 → 로컬 게이트 + main 안전망으로 대체.
- UI/테마/a11y: N/A.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 브랜치 CI 소실(PR 트리거 제거) | 로컬 게이트 필수 관례 + main push 최종 게이트. 되돌리려면 `pull_request:` 블록 복원 |
| `npm version` clean-트리 요구로 릴리스 직전 마찰 | 문서에 "먼저 커밋 후 release:*" 명시 |

- 되돌리기 어려운 결정: 없음.
- Open Question: 없음(전부 사용자 확정).

## 영향 받는 파일

- `.github/workflows/ci.yml`
- `app/package.json`
- `docs/guides/release-operations.md`
- `docs/handoff/0088-ci-trigger-versioning/{plan,verify}.md` · `docs/handoff/INDEX.md` · `docs/PHASES.md`

## 참고 문서

- `docs/handoff/0087-cicd-release-pipeline/plan.md` (파이프라인 원본)
- `docs/git-template.md` (커밋 trailer)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 없음(설정/문서 변경 — release:* 스크립트는 `npm version` 위임, 실행=실 릴리스라 자동 테스트 부적합).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(3건)를 라이브 세션 인용으로, 추론(트리거 구성·bump 도입 형태)을 추론으로 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일`·웹 URL) 부착.
- [x] 인수 기준 — 4개 번호 매김, 검증 가능.
- [x] 의존 기술 — 신규 의존성 0 확인, clean-트리 전제 식별.
- [x] 파생 UX — dirty 트리·브랜치 CI 소실 엣지케이스(UI 계열 N/A).
- [x] 리스크 — 트레이드오프 2건 완화책과 함께, Open Question 없음.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접 구현).
