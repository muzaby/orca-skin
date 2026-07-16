# Plan — 0116-release-0-3-1-auto-publish

## 메타

| 항목 | 값 |
|---|---|
| slug | `0116-release-0-3-1-auto-publish` |
| 작성자 | Codex (라이브 사용자 지시로 설계·구현 연속 수행) |
| 일자 | 2026-07-16 |
| 매핑 | PHASES 행 / PR |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 이번 작업을 `v0.3.1`로 취급하고 수정·업데이트한다. | 라이브 세션 요청 |
| 추론 의도 | 앞선 분석에서 확인한 “산출물은 있으나 draft라 자동 업데이트가 감지하지 못함”을 해소한다. | 바로 이전 라이브 세션 분석 |

## Context (왜)

릴리스 workflow는 태그 실행에서도 draft GitHub Release만 만들고, electron-updater는 published release만 감지한다. 사용자가 이번 작업을 v0.3.1로 지정했으므로 버전 진실원을 올리고 태그 릴리스가 자동으로 published 상태가 되도록 배포 설정과 운영 문서를 정합화한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| tag push는 `--publish always`지만 builder `releaseType: draft` 때문에 draft로 게시된다. | `.github/workflows/release.yml:65-69`, `app/electron-builder.yml:53-57` |
| workflow_dispatch는 의도적으로 dry-run이며 artifact만 보존한다. | `.github/workflows/release.yml:71-85` |
| 제품 버전 진실원은 package.json이고 lockfile 루트 버전도 동기화해야 한다. | `docs/guides/release-operations.md:13`, `app/package.json:3`, `app/package-lock.json:3-9` |
| updater는 packaged 앱에서만 동작하며 published feed를 확인한다. | `app/src/main/app/updater.ts:112-135`, `docs/guides/release-operations.md:15` |

## 인수 기준 (Acceptance Criteria)

1. 앱 및 lockfile의 루트 버전이 `0.3.1`이다.
2. `v*` 태그 workflow가 draft가 아닌 published GitHub Release를 생성한다.
3. workflow_dispatch는 게시하지 않는 dry-run으로 유지한다.
4. 릴리스 운영 문서와 app 가이드가 자동 게시 흐름을 정확히 설명한다.
5. 릴리스 버전·산출물 검증 스크립트 테스트와 정적 게이트가 통과한다.

## 범위 / 비범위

- **범위**: 버전 메타데이터, electron-builder GitHub 게시 유형, workflow 설명, 운영 문서·가이드 정합.
- **비범위**: `v0.3.1` 태그 생성·원격 push·실 GitHub Release 실행, 코드 서명, updater UI 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 electron-builder GitHub provider와 `GH_TOKEN` 배선을 재사용한다.
- `v0.3.1` 태그는 이 커밋이 원격 기본 브랜치에 반영된 뒤 생성한다.
- 신규 의존성 없음.

## 설계

- `npm version 0.3.1 --no-git-tag-version`과 같은 결과로 package/lock 루트 버전을 동기화한다.
- `app/electron-builder.yml`의 `releaseType`을 `release`로 전환한다.
- tag workflow 명칭·주석과 `docs/guides/release-operations.md`, `app/AGENTS.md`를 자동 게시 모델로 갱신한다.
- workflow_dispatch의 `--publish never`는 보존한다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 태그 push 즉시 기존 설치본에 노출되므로 draft 수동 검수 게이트가 사라진다. 따라서 태그 전 로컬/CI 검증과 버전 단조 증가가 필수다.
- 같은 태그 재실행 시 이미 published release의 동명 자산과 충돌할 수 있으므로 버전 재사용을 금지한다.
- 렌더러·테마·a11y 변경은 없다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 태그 push가 즉시 사용자에게 공개됨 | 태그 전 수동 설치 시나리오를 수행하고 실패 버전은 새 patch로 전진 |
| v0.3.1보다 높은 설치본은 업데이트하지 않음 | SemVer 단조 증가 정책 유지 |

- 되돌리기 어려운 결정: draft 수동 게이트 제거. 이번 사용자 지시를 앞선 실패 원인의 수정 승인으로 해석한다.
- 단독 결정 금지 항목: 없음. 코드 서명 등 기존 Open Question은 비범위다.

## 영향 받는 파일

- `app/package.json`, `app/package-lock.json`, `app/electron-builder.yml`
- `.github/workflows/release.yml`
- `docs/guides/release-operations.md`, `app/AGENTS.md`
- `docs/handoff/INDEX.md`, 본 plan

## 참고 문서

- `docs/guides/release-operations.md`
- `docs/handoff/0087-cicd-release-pipeline/plan.md`

## 게이트

- `cd app && npm run lint && npm run typecheck`
- `cd app && node --test "scripts/*.test.mjs"`
- `cd app && node scripts/validate-release-version.mjs v0.3.1`

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도와 추론을 분리했다.
- [x] 모든 조사 발견에 코드·문서 레퍼런스를 붙였다.
- [x] 인수 기준을 번호화하고 검증 가능하게 작성했다.
- [x] 신규 의존성이 없음을 확인했다.
- [x] 자동 게시의 운영 엣지케이스를 반영했다.
- [x] draft 게이트 제거 리스크와 완화책을 기록했다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: published release만 updater가 감지한다는 조사와 버전·게시 설정·운영 문서 동시 변경 범위에 동의한다.
- 이견 / 우려: 실제 태그와 원격 Release 생성은 현재 코드 변경 커밋에 포함하면 안 된다. 원격 반영 뒤 운영 단계로 남긴다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기존 문서의 draft rollback 표현이 자동 게시 모델과 충돌 | ✅ published release를 draft로 되돌리는 롤백 절차는 유지하되 최초 게시 절차만 갱신 | `docs/guides/release-operations.md` |

## [구현자 기입] 구현 체크리스트

- [x] 버전 0.3.1 동기화
- [x] 태그 릴리스 자동 Publish
- [x] 운영 문서·가이드 정합
- [x] 게이트 실행

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `.github/workflows/release.yml`, `app/{package.json,package-lock.json,electron-builder.yml,AGENTS.md}`, `docs/guides/release-operations.md`, `docs/handoff/{INDEX.md,0116-*/plan.md}` |
| 실행 명령 | `npm run lint`, `npm run typecheck`, `node --test scripts/*.test.mjs`, `node scripts/validate-release-version.mjs v0.3.1`, `git diff --check` |
| 게이트 결과 | lint ✅(기존 TanStack Virtual warning 1), typecheck ✅, scripts 25/25 ✅, version check ✅, diff check ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | INDEX 대상 커밋 참조 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
