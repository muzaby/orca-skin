# Verify — 0078-skills-deployment-pipeline

> Skills 배포 파이프라인 전반부(seed) 구현 검증. 앱 번들 builtin skill 을 최초 부팅/버전 업 시 `~/.config/orca/sources/skills` 로 seed 하고, 같은 부팅에서 기존 dist 배포로 이어지게 하는 스텝 + manifest 버전 관리 + electron-builder 번들.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0078-skills-deployment-pipeline` |
| 검증자 | Claude Code |
| 일자 | 2026-07-07 |
| 대상 커밋 | `9dc21d3` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 §동의 — seed=순수 파일 작업(feature), electron 경로 해석=app 격리, 부팅 순서 plan 준수 | 타당 — 코드에서 확인(`seed.ts` node:fs 전용·`builtin-resources.ts` app 레이어·부팅 순서 AC8) | 매트릭스 AC2/8/10 근거 |
| 이견 §marker 는 `sources/skills` 하위 **사용자 편집 가능** 파일 → 신뢰 입력 아님. prune 대상도 SAFE_NAME 검증 + 실제 복사된 builtin 만 marker 기록 | 타당 — plan 설계보다 강화. `seed.ts:114-119`(prune 도 `safeSkillPath`)·`seed.ts:100-109`(`managedSkills`=실복사만) | 매트릭스 AC4/6 + 위생 |
| 선조치 #1 marker traversal(`../x`) 방어 (✅ 구현) | 타당·검증됨 — `isWithinDir`/`safeSkillPath` containment, 테스트 `seed.test.ts:148`(비안전 이름 prune 안 함) | AC4/6 증거 강화 |
| 선조치 #2 manifest/marker 런타임 schema 검증(version non-empty·skills string[]) (✅ 구현) | 타당 — TS interface≠런타임 검증. `readManifest`/`readMarker` + 테스트 `seed.test.ts:126`(version:number → skipped) | AC7 확장 |
| 선조치 #3 실복사 성공한 builtin 만 marker 기록 (✅ 구현) | 타당 — 소스 부재 skill 은 marker 미기록, 테스트 `seed.test.ts:166` | AC4 오탐 방지 |
| 선조치 #4 dev/packaged 경로 → `resolveBuiltinSkillsDir()` 순수 helper + 단위 테스트 분리 (✅ 구현) | 타당·plan 대비 개선 — plan 은 bootstrap 인라인 메서드였으나 testable seam 으로 추출(AC10 이 검증 가능해짐). app 레이어 순수 함수라 경계 무위반 | AC10 증거 |

**총평**: 구현자 선조치 4건 모두 plan 설계를 *강화*하는 방향(방어적·testable)이며, 인수 기준을 축소하거나 제품 의도를 단독 변경한 항목 없음. ⚠️(사용자 결정 필요) 항목 0건.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `manifest.json` = `{version:"1.0.0", skills:[]}` | ✅ | `app/resources/builtin/skills/manifest.json:1-4` |
| 2 | `seed.ts` 가 `seedBuiltinSkills(builtinDir, skillsDir)` 노출, path 파라미터(homedir/electron 비의존) | ✅ | `seed.ts:89`(시그니처)·`node:fs`/`node:path` + `writeJsonAtomic` 만 import(`seed.ts:1-3`) |
| 3 | 최초 설치(marker 부재): 각 skill → `sources/skills/<name>` 복사 + marker 기록 | ✅ | `seed.ts:98-126`, 테스트 `seed.test.ts:44`(seeded:['demo']·marker 기록) |
| 4 | 버전 업: 덮어쓰기 + 구 marker 에만 있는 builtin prune + marker 갱신 | ✅ | `seed.ts:102-126`(rm→cp 덮어쓰기·prune 루프), 테스트 `seed.test.ts:55`(pruned:['old']) |
| 5 | 동일 버전: no-op(파일 무변경) | ✅ | `seed.ts:94-96`(early return, mkdir 전), 테스트 `seed.test.ts:80`(USER.md 보존·marker mtime 불변) |
| 6 | non-builtin 사용자 skill 보존(seed/prune 대상 아님) | ✅ | prune 은 `marker?.skills` 만 순회(`seed.ts:114`), 테스트 `seed.test.ts:94`(`mine` 보존) |
| 7 | manifest 부재/손상 → 안전 no-op, throw 안 함 | ✅ | `readManifest` null → skipped(`seed.ts:90-91`), 테스트 `seed.test.ts:110`(부재·`{broken`·version:number 3케이스) |
| 8 | 부팅 스텝 `builtin-skill-seed` 를 config-dir 이후·extension-deploy 이전 삽입, `critical:false` | ✅ | `bootstrap.ts:196-204`(순서: config-dir 188 → orca-config 193 → **seed 196** → provider-scaffold 207 → extension-deploy 218 → skill-scan 223), `critical:false` 명시 |
| 9 | `electron-builder.yml` 이 `resources/builtin` 번들(packaged `process.resourcesPath` 접근) | ✅ | `electron-builder.yml:15-17`(`extraResources: from resources/builtin to builtin`) + `:12`(`!resources/builtin/**` asar 중복 제외) |
| 10 | builtin 소스 경로 dev/packaged 양쪽 해석(`app.isPackaged` 분기) | ✅ | `builtin-resources.ts:9-13` + `bootstrap.ts:89-95`(app.isPackaged/resourcesPath/getAppPath 주입), 테스트 `builtin-resources.test.ts`(dev·packaged 2케이스) |
| 11 | `seed.test.ts` AC3~7 커버, 게이트 통과, 경계 위반 0, 신규 의존성 0 | ✅ | `seed.test.ts` 8케이스(AC3~7 + traversal·빈파이프라인·소스부재), 게이트 아래 §, boundaries lint 0, deps 0(node 표준+`writeJsonAtomic`) |

**결과: 11/11 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0·typecheck 3종 0·targeted 10/10·full 712 runnable green |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 11/11(위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | `npm run lint`(boundaries v6 포함) 0 error |
| 문서 형식/링크/한국어 | ✅ | — | verify/plan 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 변경한 AGENTS.md 없음(코드 커밋). 비밀 grep 0 |
| 제품 의도 부합(빈 파이프라인·덮어쓰기 정책) | ✖ 보조 | ✅ 결정 | 사용자 확정 2건(plan §Intent) — 코드 일치 |
| Open Questions | ✖ | ✅ | plan §리스크: Open Question 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | N/A(main 부팅 순수 파일 작업, renderer/IPC 무변경) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 → 승인 불요 |
| packaged 산출물 실물 확인 | ✖ | ✅ | 사람 확인 대기(아래 §) — electron-builder 다운로드 403 환경 제한 |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 시 |

## 게이트 재실행 결과

```
$ cd app && npm run lint            → ✅ 0 error (eslint boundaries 포함, --fix 무변경)
$ npm run typecheck                 → ✅ typecheck:node / :web / :test 3종 전부 통과
$ npx vitest run seed.test builtin-resources.test
    Test Files  2 passed (2)
         Tests  10 passed (10)   ← seed 8 + builtin-resources 2, AC3~7 + traversal/빈파이프라인/소스부재/dev·packaged
$ npm test (full)
    Test Files  6 failed | 90 passed (96)
         Tests  21 failed | 712 passed (733)
```

**전체 테스트 21 실패 = 전부 환경 제한(0078 무관), 0019 계열:**
- 6 실패 파일 = `db/queries.test.ts` · `history/writer.test.ts` · `chat-turn.continuity.test.ts` · `chat-turn.runtime-resilience.test.ts` · `orchestration/fork.test.ts`(모두 `better-sqlite3` 네이티브 바인딩 미빌드 — `Could not locate the bindings file`) + `extensions/builder.test.ts`(`Electron failed to install correctly`).
- 원인: 이 환경에서 electron 바이너리·node-gyp 헤더 다운로드가 조직 egress 정책으로 **403 차단** → `postinstall`(`install-app-deps`) 실패로 better-sqlite3 가 Node ABI 로 재빌드되지 않음. 구현자 env 는 `npm rebuild better-sqlite3` 후 **744 passed** 보고(plan §구현 보고).
- 0078 변경 파일(`seed.ts`·`builtin-resources.ts`·`bootstrap.ts`·`manifest.json`·`electron-builder.yml`)은 이 6 파일 어디에도 포함되지 않으며, 순수 fs 작업이라 DB/electron 의존 0. seed/builtin 테스트 10건은 전부 green.

## 위생 검토

- **비밀 스캔**: 변경 커밋(`9dc21d3`)에서 password/secret/token/api-key/PRIVATE 패턴 매치 0.
- **IPC**: `IPC_CONTRACT.md` 무변경 — plan 대로 신규 채널 0(부팅 스텝은 IPC 아님).
- **신규 의존성**: 0(node 표준 fs/path + 기존 `writeJsonAtomic`).
- **레이어 경계**: `seed.ts`(features/extensions/skills → infra/config/json-file, 하향 허용) · `builtin-resources.ts`(app 레이어 순수, node:path 만) · `bootstrap.ts`(app 컴포지션 루트, electron `app`/`process` 사용 격리) → lint boundaries 0.
- **커밋 trailer 위생 노트 ①**: 구현 커밋(`9dc21d3`) 본문에 실제 개행 대신 **리터럴 `\n\n`** 이 삽입돼 trailer 블록(`Agent: codex`·`Handoff:`·`Status:`·`Criteria-Met:`·`Verified-By: pending`)이 한 물리적 줄로 뭉쳐 있다 — `git interpret-trailers --parse` 가 아무 trailer 도 파싱하지 못한다(기계 메시지버스 관점 파싱 불가). 코드 정확성·AC 충족과 무관한 커밋 메시지 위생 문제이며, 이미 머지된 히스토리라 본 verify 커밋에서 소급 수정하지 않는다. 향후 구현 커밋은 trailer 를 실개행으로 분리할 것(정본 `docs/git-template.md`).

## PHASES.md 정합성

- "MCP & Skill 통합 레이어" 후속으로 `docs/PHASES.md` 완료 표에 `0078` 행 승격(커밋 `9dc21d3`). 형식(굵은 제목 + 요약 + 상태) 기존 행과 일치.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 은 seed 경로 해석을 bootstrap 인라인 메서드로 두었으나, 구현자가 testable seam(`resolveBuiltinSkillsDir`)으로 분리해 AC10 을 검증 가능하게 만들었다. plan 이 처음부터 "경로 계산 순수 분리"를 명시했다면 더 좋았을 것(경미).
- **구현 단계**: 선조치 4건이 모두 방어적 강화로 타당. 단 하나 관찰 — manifest skill 의 소스 디렉토리가 *버전 업 시* 사라지면(marker 엔 있으나 이번 복사 실패) 해당 skill 이 prune 된다(`current` 미포함). 이는 "더 이상 배송 안 하는 builtin=제거"의 자연스러운 귀결로 app-managed 의미와 일치하며, non-builtin 사용자 skill 은 영향 없어 **결함 아님**(빈 파이프라인 현 상태에선 발생 경로도 없음).
- **검증 단계**: better-sqlite3/electron 바이너리가 403 차단이라 full-suite green(744)·packaged 산출물을 이 환경에서 재현하지 못했다. 0078 은 DB/electron 비의존이라 검증 신뢰도에 영향 없으나, packaged 런타임의 `process.resourcesPath/builtin/skills` 실경로·electron-builder `extraResources` 산출은 **사람 확인 대기**로 남긴다.

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 11/11 충족, 게이트 lint 0·typecheck 3종 0·targeted 10/10·full 712 runnable green(21 red=better-sqlite3/electron 바이너리 403 환경 제한, 0078 무관·0019 계열), 레이어 경계 0, 신규 의존성·IPC 0. `docs/PHASES.md` 승격.
- **사람 확인 대기**: (1) `npm run build:{win,mac,linux}` packaged 산출물의 `<resourcesPath>/builtin/skills/` 실번들 + dev `app.getAppPath()` 실경로. (2) 실 `npm run dev` 부팅 시 `[seed]` 로그(현 빈 파이프라인이라 로그 0·marker 만 생성) → 후속 실제 skill 배송(`resources/builtin/skills/<name>/` + `manifest.skills` 등록 + version bump) 시 seed→extension-deploy→skill-scan 왕복 실기.
