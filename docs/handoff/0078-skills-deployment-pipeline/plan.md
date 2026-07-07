# Plan — 0078-skills-deployment-pipeline

> Skills 배포 파이프라인 완성 — 앱에 번들된 기본 skill 을 최초 부팅/버전 업 시 `~/.config/orca/sources/skills` 로 seed 하고, electron-builder 로 번들하며, `manifest.json` 버전으로 업데이트를 관리한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0078-skills-deployment-pipeline` |
| 작성자 | Claude Code |
| 일자 | 2026-07-07 |
| 구현 주체 | **Codex** (기능 구현) |
| 매핑 | PHASES: "MCP & Skill 통합 레이어" 후속 / PR (요청 시) |
| 상태 | DRAFT → **READY** |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "앱 설치 시 혹은 최초 부팅 시 `~/.config/orca/sources/skills` 에 앱 설치파일에 번들링된 skills 를 배포" | 라이브 세션 요청 (개요/목표) |
| 명시 요구 | "기본 skills 를 `app/resources/builtin/skills` 경로 아래에 구성한다" | 라이브 세션 요청 |
| 명시 요구 | "electron-builder.yml 구성" (번들 packaging) | 라이브 세션 요청 |
| 명시 요구 | "업데이트 정책 — manifest.json 구성, 버전관리" | 라이브 세션 요청 |
| 명시 결정 ① | **번들 skill 콘텐츠 = 빈 파이프라인** (skill 0개). manifest 는 `skills: []`, 배포 코드/빌드 구성만 완성 | 라이브 세션 질의응답("빈 파이프라인만 (skill 0개)") |
| 명시 결정 ② | **업데이트 충돌 정책 = 버전 올라가면 덮어쓰기** | 라이브 세션 질의응답("버전 올라가면 덮어쓰기") |
| 추론 의도 | seed 된 skill 은 같은 부팅에서 dist plugin 으로 배포되어 즉시 사용 가능해야 한다 (파이프라인 "완성"의 자연스러운 해석 — *추론*) | 개요의 "(앱 동작시 플러그인으로 dist 경로로 구성됨)" 언급 |
| 추론 의도 | 사용자가 직접 만든 non-builtin skill 은 업데이트로 손실되면 안 된다 (SSOT 성격상 *추론*) | `paths.ts:1-19` sources/ = 사람 편집 SSOT |

## Context (왜)

Orca 는 이미 skill 파이프라인의 **후반부**를 갖고 있다: 사람이 편집하는 정규 소스 `~/.config/orca/sources/skills/<name>/SKILL.md` 를 부팅 시 `dist/<engine>/plugins/orca/skills/` (Claude Code plugin 패키지) 로 **복사·배포**하고, 런타임에 SDK `options.plugins` 로 그 dist 경로를 로드한다.

**빠진 조각 = 파이프라인의 전반부(seed)**: 앱 설치 파일에 번들된 "기본 skill" 을 `sources/skills` 로 최초 공급하는 단계가 없다. 현재:
- `app/resources/` 에는 `icon.ico`·`icon.png` 만 있다 — builtin skill 콘텐츠도, seed 로직도 없다 (`app/resources/` 트리).
- `sources/skills` 는 오직 사용자 액션(작성 `writeAuthoredSkill`·업로드 `writeUploadedSkill`)으로만 채워진다 (`skills/sources.ts:17,38`).
- 최초 부팅 seed 는 provider *settings* 에만 있고(`scaffold.ts`), skill 에는 없다 (`bootstrap.ts:188-195`).

이 작업은 그 seed 단계 + 버전 관리(manifest.json) + electron-builder 번들 설정을 추가해 파이프라인을 완성한다. 기본 skill 세트를 앱과 함께 배송하고, 앱 업데이트로 skill 세트를 갱신할 수 있게 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| config 루트는 전 OS 동일하게 `~/.config/orca` (homedir 하위, XDG/`app.getPath` 미사용). `sourcesSkillsDir()` = `~/.config/orca/sources/skills`, `distOrcaPluginSkillsDir(engine)` = `.../dist/<engine>/plugins/orca/skills` | `app/src/main/infra/config/paths.ts:28-45,128-130` |
| 배포 파이프라인 후반부 존재: `deploy(engine, opts, root)` 가 `renderClaudePluginPackage` 로 `sources/skills → dist/<engine>/plugins/orca/skills` 를 **복사**(backup-then-write, `.bak` 롤링) | `app/src/main/features/extensions/deployer.ts:106-194` · `claude-plugin-package.ts:29-59` |
| skill 스캐너는 각 root 하위 **디렉토리**만 순회하며 `<dir>/SKILL.md` frontmatter(`name`·`description`·`argument-hint`)를 읽는다 — 디렉토리가 아닌 파일은 무시 | `app/src/main/features/extensions/skills/scan.ts:52-85` |
| plugin 복사도 **디렉토리**만 대상(`entry.isDirectory()`), 파일은 스킵 | `app/src/main/features/extensions/claude-plugin-package.ts:39-46` |
| 부팅 시퀀스: `db-init → … → workspace → config-dir(ensureConfigDir) → orca-config → provider-scaffold → extension-deploy(deployNow) → skill-scan(refreshSkills)`. 각 단계는 `bootReport.step(Sync)` 로 감싸고 대부분 `critical:false`(실패해도 부팅 계속) | `app/src/main/app/bootstrap.ts:134-207` |
| 최초 부팅 seed 선례 = provider settings. `scaffoldProviderSettings(adapter, root=orcaConfigDir())` 가 **root 주입 + 멱등** 패턴으로 빈 상태에서만 템플릿 1회 생성. 이 작업의 seed 모듈이 그대로 본받을 형태 | `app/src/main/features/extensions/scaffold.ts:35-53` |
| 원자적 JSON 쓰기 공용 유틸(temp→rename). marker 파일 쓰기에 재사용 | `app/src/main/infra/config/json-file.ts:7-11` |
| dist plugin 은 SDK `options.plugins: [{type:'local', path: pluginRoot}]` 로 로드. `pluginRoot` 는 `distOrcaPluginDir('claude')` 를 `ExtensionBuilder` 에 주입 | `app/src/main/adapters/claude-adapt.ts:38-42` · `claude.ts:336` · `bootstrap.ts:158-165` |
| electron-builder 현황: `asarUnpack: resources/**`, `files` 는 **제외 목록만**(기본 include 에 `resources/` 포함), `extraResources`/`extraFiles` **없음** | `app/electron-builder.yml:5-13` |
| 런타임 리소스 경로 해석 선례 없음 — `process.resourcesPath`/`app.isPackaged`/`builtin` 참조가 `app/src` 전역에 0. `app.getPath` 는 DB(`userData`)에만 사용 | grep(`resourcesPath|isPackaged|builtin`) → `infra/db/index.ts:12` 만 |
| main 레이어 DAG: `features → contracts·adapters·infra·shared` (하향). `features/extensions` 가 `infra/config/json-file` import 는 허용. electron `app`/`process` 사용은 **app 컴포지션 루트**에 격리해야 함(feature 순수 유지) | `app/src/main/AGENTS.md` 레이어 매핑 표 |
| skill 은 폴더+`SKILL.md`(YAML frontmatter) 관례 — per-skill manifest 없음. 배포 계층 정본은 standardization.md §5(sources/dist·ExtensionDeployer) | `@docs/arch/backend/standardization.md §5.1-5.2` |
| 테스트 관례: `mkdtempSync` 로 임시 root + fs 단언(순수 함수, electron 비의존, vitest) | `app/src/main/features/extensions/deployer.test.ts:1-33` · `skills/scan.test.ts:1-21` |

## 인수 기준 (Acceptance Criteria)

1. `app/resources/builtin/skills/manifest.json` 이 `{ "version": "1.0.0", "skills": [] }` 로 존재한다.
2. 신규 순수 모듈 `app/src/main/features/extensions/skills/seed.ts` 가 `seedBuiltinSkills(builtinDir, skillsDir)` 를 노출한다 — 경로를 파라미터로 받아 homedir/electron 비의존(테스트 용이, `scaffold.ts`·`deployer.ts` 동형).
3. **최초 설치**(destination marker 부재): manifest 의 각 skill 디렉토리를 `sources/skills/<name>` 으로 복사하고 marker(`.orca-builtin.json`)를 기록한다.
4. **버전 업**(marker.version ≠ manifest.version): manifest 에 나열된 skill 을 최신본으로 **덮어쓰고**, 이전 marker 에는 있었으나 새 manifest 에 없는 builtin skill 은 **prune(삭제)** 한다. marker 를 갱신한다.
5. **동일 버전**(marker.version === manifest.version): **no-op** — 어떤 파일도 쓰거나 지우지 않는다.
6. 사용자가 만든 **non-builtin skill 디렉토리(manifest.skills 에 없는 이름)는 어떤 경우에도 보존**된다 — seed/prune 대상이 아니다.
7. bundled `manifest.json` 이 **부재하거나 손상**(JSON 파싱 실패)이면 안전하게 no-op 하고 에러를 throw 하지 않는다(부팅을 막지 않음).
8. `bootstrap.ts` 부팅 시퀀스에 `builtin-skill-seed` 스텝이 **`config-dir`(ensureConfigDir) 이후 + `extension-deploy` 이전**에 삽입되어, seed 된 skill 이 같은 부팅에서 dist 로 배포되고 이어서 `skill-scan` 에 잡힌다. 스텝은 `critical:false`.
9. `app/electron-builder.yml` 이 `resources/builtin` 을 패키지에 번들해, packaged 런타임에서 `process.resourcesPath` 기준으로 접근 가능하다.
10. builtin 소스 경로가 **dev/packaged 양쪽에서 올바르게 해석**된다 (`app.isPackaged` 분기 — packaged=`process.resourcesPath`, dev=repo `resources/`).
11. 신규 `seed.test.ts` 가 AC 3~7 을 커버한다. 게이트(`lint`/`typecheck`/`test`) 통과, main 레이어 경계 위반 0, 신규 의존성 0.

## 범위 / 비범위

- **범위**: manifest schema, seed 모듈 + 단위 테스트, 부팅 배선(스텝 1개 + 경로 해석), electron-builder 번들 설정, dev/packaged 경로 분기.
- **비범위**:
  - 실제 builtin skill 콘텐츠 저작 (사용자 결정 ① 빈 파이프라인 — 후속에 manifest.skills 등록 + `resources/builtin/skills/<name>/` 추가 + version bump).
  - dist 배포 로직 변경 (`deployer.ts`/`claude-plugin-package.ts` 그대로 재사용).
  - skill hot-reload, `.new` 병합 UX, semver 순서 비교(문자열 불일치로 충분), IPC/renderer 변경.
  - 사용자 편집 보존 정책(사용자 결정 ② 로 "덮어쓰기" 확정 — 보존 옵션은 비범위).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **기댈 기존 모듈**: `sourcesSkillsDir()`(`paths.ts:43`), `writeJsonAtomic`(`json-file.ts:7`), `bootReport.stepSync`(`bootstrap.ts`), node `fs`(`cpSync`·`rmSync`·`readFileSync`·`existsSync`).
- **electron API**: `app.isPackaged`, `app.getAppPath()`, `process.resourcesPath` — **app 컴포지션 루트(bootstrap)에서만** 사용(feature 순수 유지).
- **electron-builder**: `extraResources`(from/to 매핑) — v26 표준 필드, 신규 도구 아님.
- **전제**: manifest 는 우리가 저작하므로 skill 이름은 `[A-Za-z0-9_-]` 안전 문자. 그래도 seed 는 이름을 검증해 path traversal 을 방어한다(방어적).
- **신규 의존성**: **없음** (전부 node 표준 + 기존 유틸).

## 설계

### 1. 번들 자원 + manifest — `app/resources/builtin/skills/manifest.json`

```json
{
  "version": "1.0.0",
  "skills": []
}
```

- `version`: seed/업데이트 판정 키. **앱 릴리스 버전과 독립**한 skill-세트 버전 문자열. skill 세트를 갱신할 때 이 값을 올린다.
- `skills`: **builtin-관리 대상 skill 디렉토리명** 배열. seed/prune 은 오직 이 목록만 관리한다 → 사용자 skill 과 격리하는 핵심 장치.
- 실제 skill 배송(후속): `resources/builtin/skills/<name>/SKILL.md` 추가 + `manifest.skills` 에 `<name>` 등록 + `version` bump.

### 2. Seed 모듈 — `app/src/main/features/extensions/skills/seed.ts` (신규, 순수/testable)

`scaffold.ts` 의 "root 주입 + 멱등" 패턴을 그대로 따른다. 경로를 파라미터로 받아 homedir/electron 비의존.

```ts
import { existsSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../../../infra/config/json-file'

interface BuiltinManifest { version: string; skills: string[] }
interface BuiltinMarker { version: string; skills: string[]; at: number }

export interface SeedResult {
  seeded: string[]   // 복사한 skill 이름
  pruned: string[]   // 삭제한 (구 builtin) skill 이름
  skipped: boolean   // manifest 부재/손상 or 동일 버전 → no-op
  version: string | null
}

const MARKER = '.orca-builtin.json'
const SAFE_NAME = /^[A-Za-z0-9_-]+$/

export function seedBuiltinSkills(builtinDir: string, skillsDir: string): SeedResult
```

동작:
1. `readManifest(join(builtinDir, 'manifest.json'))` — 파일 부재/JSON 손상/`skills` 배열 아님 → `{ seeded:[], pruned:[], skipped:true, version:null }` (AC7).
2. `readMarker(join(skillsDir, MARKER))` — 부재/손상은 `null` 로 간주(안전측 재-seed). marker 는 파일이므로 scan/plugin 복사(둘 다 디렉토리만 처리)에서 자동 무시 → skill 목록 오염 0.
3. `marker && marker.version === manifest.version` → `{ skipped:true, version }` no-op (AC5).
4. 그 외(최초 or 버전 업):
   - `for name of manifest.skills`: `SAFE_NAME.test(name)` 아니면 스킵. `existsSync(join(builtinDir,name))` 확인 후 `rmSync(dest, {recursive,force})` → `cpSync(src, dest, {recursive, force})` (덮어쓰기, AC3/4). `seeded.push(name)`.
   - **prune**: `(marker?.skills ?? []).filter(n => !manifest.skills.includes(n))` → `rmSync(join(skillsDir,n), {recursive,force})`, `pruned.push(n)` (AC4). (사용자 non-builtin 은 marker.skills 에 없으므로 대상 아님 — AC6.)
   - `writeJsonAtomic(join(skillsDir, MARKER), { version: manifest.version, skills: manifest.skills, at: Date.now() })`.
   - `mkdirSync(skillsDir, {recursive})` 를 복사 전에 보장(최초 설치 시 sources/skills 미존재 가능).
5. 반환값은 부팅 로깅용.

**레이어**: `features/extensions/skills` → `infra/config/json-file` + `node:fs`/`node:path` (하향, 경계 OK — feature→infra 허용).

### 3. builtin 소스 경로 해석 — `bootstrap.ts` (app 레이어)

electron `app`/`process.resourcesPath` 는 app 컴포지션 루트에만 둔다.

```ts
private builtinSkillsDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'builtin', 'skills')
    : join(app.getAppPath(), 'resources', 'builtin', 'skills')
}
```

- packaged: `extraResources` 가 `resources/builtin` → `<resourcesPath>/builtin` 으로 복사하므로 `process.resourcesPath/builtin/skills`.
- dev: `app.getAppPath()` = electron-vite dev 의 앱 루트(`app/`), 하위 `resources/builtin/skills`.
- `paths.ts` 에는 **marker/builtin 헬퍼를 추가하지 않는다** — marker 경로는 seed.ts 내부 상수(skillsDir 하위)로 충분하고, builtin 경로는 electron 의존이라 app 레이어 소관.

### 4. 부팅 배선 — `bootstrap.ts start()`

`config-dir` 스텝(현 `bootstrap.ts:178-182`) 직후, `provider-scaffold`(188)/`extension-deploy`(199) **이전**에 삽입:

```ts
this.bootReport.stepSync(
  'builtin-skill-seed',
  { critical: false, label: '기본 스킬 seed' },
  () => {
    const r = seedBuiltinSkills(this.builtinSkillsDir(), sourcesSkillsDir())
    for (const s of r.seeded) console.log('[seed] builtin skill:', s)
    for (const p of r.pruned) console.log('[seed] prune builtin skill:', p)
  }
)
```

- `critical:false` — seed 실패가 부팅을 막지 않음(기존 config 스텝과 동일 관용).
- **순서 근거**: seed(sources 채움) → `extension-deploy`(sources→dist 복사) → `skill-scan`(스캔·캐시) 가 한 부팅에서 이어져야 새 skill 이 즉시 반영된다(AC8). `sourcesSkillsDir` import 는 이미 존재(`bootstrap.ts:25`).

### 5. 패키징 — `app/electron-builder.yml`

```yaml
extraResources:
  - from: resources/builtin
    to: builtin
```

- 결과: packaged 앱의 `<resourcesPath>/builtin/skills/...` — `builtinSkillsDir()` packaged 분기와 일치(AC9/10).
- **중복 번들 방지**: 현재 `asarUnpack: resources/**` + 기본 include 로 `resources/builtin` 이 asar(unpacked)에도 들어가 `extraResources` 와 이중이 된다. `files` 제외 목록에 `- '!resources/builtin/**'` 를 추가해 asar 쪽 중복을 뺀다. 아이콘(`resources/icon.*`)은 그대로 유지.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **번들 skill 0개(현 결정)**: `manifest.skills=[]` → seed 는 marker 만 쓰고 복사 0. 정상 no-op, 파이프라인은 완성 상태(후속 skill 추가 시 즉시 동작).
- **사용자가 builtin skill 삭제 후 동일 버전 재부팅**: AC5 no-op → 재생성 안 됨. **버전 업 시에만** 복원된다(덮어쓰기 정책의 자연스러운 귀결 — 리스크 표에 명시).
- **marker 손상(수동 편집 등)**: JSON 파싱 실패 → marker 없음으로 간주 → 전체 재-seed(안전측). 부팅은 계속.
- **최초 설치 시 `sources/skills` 미존재**: 복사 전에 `mkdirSync(skillsDir,{recursive})` 로 보장.
- **이름 검증**: manifest 는 우리가 저작하지만 `[A-Za-z0-9_-]` 외 이름은 스킵(path traversal 방어). builtin 소스에 해당 디렉토리가 없으면 조용히 스킵.
- 상태(로딩/에러/빈상태 UI)·테마·a11y·동시성: **N/A** — main 부팅 단계의 순수 파일 작업, renderer/IPC 무관.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 버전 업 시 사용자가 편집한 builtin skill 덮어쓰기 = 편집분 손실 | **사용자 결정 ② 로 확정("버전 올라가면 덮어쓰기")**. builtin=app-managed 성격. non-builtin 사용자 skill 은 marker.skills 밖이라 절대 미영향(AC6) → 영향 국소적 |
| 사용자가 삭제한 builtin skill 이 버전 업 시 되살아남 | 정책상 의도된 동작(app-managed). 동일 버전 동안은 no-op 로 삭제 유지 |
| `extraResources` + `asarUnpack: resources/**` 이중 번들 | `files` 에 `!resources/builtin/**` 제외로 해소. 미해소여도 기능은 정상(용량 중복만) |
| dev 경로 `app.getAppPath()` 가 예상과 다를 가능성 | 구현 시 `npm run dev` 로 실경로 확인(검증 절차에 포함). packaged 는 `build:unpack` 로 선택 확인 |

- 되돌리기 어려운 결정: 없음(marker/manifest 스키마는 내부용, 자유 변경).
- **Open Question**: 없음 — 두 결정(빈 파이프라인·덮어쓰기) 모두 사용자 확정.

## 영향 받는 파일

- `app/resources/builtin/skills/manifest.json` (신규)
- `app/src/main/features/extensions/skills/seed.ts` (신규)
- `app/src/main/features/extensions/skills/seed.test.ts` (신규)
- `app/src/main/app/bootstrap.ts` (스텝 추가 + `builtinSkillsDir()` 메서드 + `seedBuiltinSkills` import)
- `app/electron-builder.yml` (`extraResources` + `files` 제외 추가)

## 재사용 자산

- `writeJsonAtomic` — `app/src/main/infra/config/json-file.ts:7`
- `sourcesSkillsDir()` — `app/src/main/infra/config/paths.ts:43`
- seed 패턴 참고: `scaffold.ts:35-53` (root 주입 멱등 seed)
- 부팅 스텝 패턴: `bootstrap.ts:178-206` (`bootReport.stepSync`, `critical:false`)
- 테스트 패턴: `deployer.test.ts:1-33` · `skills/scan.test.ts:1-21` (`mkdtempSync` root + fs 단언)

## 참고 문서

- `@docs/arch/backend/standardization.md §5.1-5.2` (sources/dist·ExtensionDeployer 배포 계층 정본)
- `@docs/TRD.md §6.8` (skill→`dist/<engine>/.claude/skills`·배포 스테이징)
- IPC 변경: **없음** (IPC_CONTRACT 갱신 불요)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `seed.test.ts` — 순수 함수, `mkdtempSync` root. 커버:
  1. 최초 설치(marker 부재) → manifest skill 복사 + marker 생성 (AC3).
  2. 버전 업 → 덮어쓰기 + 구 skill prune + marker 갱신 (AC4).
  3. 동일 버전 → no-op(파일 mtime/내용 불변) (AC5).
  4. 사용자 non-builtin skill 보존 (AC6).
  5. manifest 부재/손상 → skipped no-op (AC7).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(개요/목표)·명시 결정 2건을 라이브 세션 출처로 인용, 추론 2건은 *추론* 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` 또는 `@docs/…§` 레퍼런스.
- [x] 인수 기준 — 11개 번호, 자료조사 근거, 검증 가능(fs 단언/게이트).
- [x] 의존 기술 — 기존 유틸·electron API·electron-builder 필드 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 빈 파이프라인/삭제 후 재부팅/marker 손상/최초 미존재/이름 검증 엣지케이스 전개, renderer UX 는 N/A 로 명시.
- [x] 리스크 — 덮어쓰기 트레이드오프·이중 번들을 완화책과 함께, Open Question 없음 확인.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다. 설계자(Claude)는 위쪽만, 구현자는 이 블록만 추가한다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: seed 모듈은 `features/extensions/skills` 의 순수 파일 작업으로 두고, Electron 의존 경로 해석은 app 컴포지션 루트에 격리한다. 부팅 순서는 plan 대로 `config-dir`/`orca-config` 이후, `extension-deploy` 이전에 둬 같은 부팅에서 dist 배포와 skill-scan 이 이어지게 한다.
- 이견 / 우려: marker(`.orca-builtin.json`)는 사용자 편집 가능한 `sources/skills` 아래 파일이므로 신뢰 입력으로 볼 수 없다. prune 대상 계산에서 marker skill 이름도 manifest 와 동일하게 검증하고, 실제 복사된 builtin 만 marker 에 기록하도록 구현을 강화했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | marker 의 `skills` 값이 사용자 편집 가능하므로 `../x` 같은 값이 prune 에 섞이면 `skillsDir` 밖 삭제 위험이 있다. | ✅ 구현함 — marker skill 이름도 `SAFE_NAME` 검증을 통과한 값만 사용하고, `resolve`/`relative` 기반 containment 확인을 prune/copy 경로 생성에 적용. 테스트로 marker traversal 값을 고정. | seed marker 는 `~/.config/orca/sources/skills` 하위 사용자 영역 파일. 삭제는 방어적으로 처리해야 함. |
| 2 | manifest `version` 손상(누락/비문자열) 시 업데이트 판단 키가 불명확하다. | ✅ 구현함 — manifest/marker 모두 런타임 schema 검증(`version` non-empty string, `skills` string array)을 통과하지 못하면 manifest 는 no-op, marker 는 없음으로 간주. | TypeScript interface 는 런타임 JSON 검증이 아니므로 AC7 을 version 까지 확장. |
| 3 | manifest 에 이름은 있지만 실제 bundled 디렉토리가 없는 skill 을 marker 에 기록하면 이후 사용자 디렉토리 prune 오인이 가능하다. | ✅ 구현함 — 실제 소스 디렉토리가 존재하고 복사에 성공한 skill 만 marker `skills` 에 기록. | marker 는 app-managed builtin 목록의 근거이므로 실제 관리 대상만 저장해야 함. |
| 4 | dev/packaged builtin 리소스 경로가 `app.getAppPath()`/`process.resourcesPath` 에 묶여 있어 회귀 확인이 어렵다. | ✅ 구현함 — `resolveBuiltinSkillsDir()` 순수 helper 로 분리하고 dev/packaged 단위 테스트 추가. | Electron API 호출은 app 레이어에 두되 경로 계산 자체는 testable seam 으로 분리. |

## [구현자 기입] 구현 체크리스트

- [x] `manifest.json` (`{version:"1.0.0", skills:[]}`)
- [x] `seed.ts` (`seedBuiltinSkills`)
- [x] `seed.test.ts` (AC3~7 + marker traversal/빈 파이프라인/누락 source 보강)
- [x] `bootstrap.ts` (`builtinSkillsDir()` + `builtin-skill-seed` 스텝)
- [x] `electron-builder.yml` (`extraResources` + `!resources/builtin/**`)
- [x] 게이트 lint/typecheck/test

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/resources/builtin/skills/manifest.json`, `app/src/main/features/extensions/skills/seed.ts`, `app/src/main/features/extensions/skills/seed.test.ts`, `app/src/main/app/builtin-resources.ts`, `app/src/main/app/builtin-resources.test.ts`, `app/src/main/app/bootstrap.ts`, `app/electron-builder.yml`, `docs/handoff/INDEX.md`, 본 plan |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test -- src/main/features/extensions/skills/seed.test.ts src/main/app/builtin-resources.test.ts` / `npm test` / `npm run build:unpack` |
| 게이트 결과 | lint ✅ / typecheck ✅ / targeted test 10 passed ✅ / full test 744 passed ✅ (`npm rebuild better-sqlite3` 후) / build:unpack ⚠️ electron zip 다운로드 403 으로 packaging 단계 실패(build 자체는 통과) |
| 블로커 / 역질문 | 없음. 단, packaged resource 산출물 실물 확인은 electron-builder 다운로드 403 환경 제한으로 로컬/CI 재확인 필요. |
| 대상 커밋 | 구현 커밋 참조 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

> `verify/FAIL` 시에만 검증자(Claude)가 신설.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | — | — | — | — |
