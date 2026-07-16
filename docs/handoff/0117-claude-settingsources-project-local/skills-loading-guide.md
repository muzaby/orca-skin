# 가이드: settingSources에서 "user"를 제외하면서 `~/.claude/skills`를 로드하는 방법

> 독자: 이 프로젝트를 구현하는 AI 에이전트
> 환경: Windows(네이티브) + Electron + Claude Agent SDK (구 claude-code-sdk)
> 작성 기준일: 2026-07

---

## 1. 문제 정의

이 앱은 Claude Agent SDK를 통해 여러 LLM provider를 지원하는 채팅앱이며, provider별 전용 `settings.json`을 로드해야 한다. 그러나 SDK의 `settingSources`가 `"user"`를 포함하면 최종 사용자 머신의 `~/.claude/settings.json`이 함께 로드되어 provider 전용 설정과 충돌한다. 이를 피하기 위해 다음과 같이 설정한다.

```typescript
settingSources: ["project", "local"]
```

이때 부작용이 발생한다. **SDK의 skill 탐색 경로는 settingSources에 하드와이어링되어 있어서, `"user"` 소스를 제외하면 `~/.claude/skills`(사용자 레벨 skill)가 탐색 대상에서 완전히 빠진다.** SDK에는 skill 디렉토리 경로만 별도로 지정하는 옵션이 존재하지 않는다.

## 2. 반드시 전제해야 할 SDK의 동작 사실

구현 전에 아래 사실을 전제로 삼아라. 추측으로 대체하지 말 것.

`settingSources`와 skill 탐색의 매핑은 고정이다. `"project"`는 `<cwd>/.claude/skills/`, `"local"`은 프로젝트 로컬 설정, `"user"`는 `~/.claude/` 계층(settings.json, CLAUDE.md, skills 포함)을 로드한다. skill만 골라서 로드하는 세분화 옵션은 없다.

`settingSources` 외에 skill을 세션에 넣는 유일한 공식 경로는 `plugins` 옵션이다. `plugins`는 `{ type: "local", path: "<플러그인 루트>" }` 형태만 받으며, 플러그인 루트에는 `.claude-plugin/plugin.json` 매니페스트가 필수이고 skill은 `skills/<이름>/SKILL.md` 구조여야 한다.

`skills` 옵션은 경로가 아니라 **필터**다. 이미 발견된(discovered) skill 중 어떤 것을 세션에서 쓸지 제어한다(`"all"` | 이름 배열 | `[]`). 발견 자체는 `settingSources` 또는 `plugins`가 담당한다.

plugins로 로드된 skill은 `플러그인이름:skill이름`으로 네임스페이스가 붙는다. 모델이 description 기반으로 자율 호출하는 데는 영향이 없으나, skill을 이름으로 명시 호출하거나 `skills` 필터에 이름을 넣을 때는 네임스페이스를 고려해야 한다.

`tools`/`allowedTools`를 명시적으로 지정하는 경우 `"Skill"` 툴을 목록에 포함해야 모델이 skill을 호출할 수 있다.

## 3. 해법 아키텍처 (권장안)

**얇은 래퍼 플러그인 패턴**을 사용한다. `~/.claude/skills`를 skills 디렉토리로 가리키는 최소 구조의 플러그인을 앱이 시작 시점에 자동 생성하고, 이를 `plugins` 옵션으로 주입한다.

```text
%USERPROFILE%\.claude\user-skills-plugin\
├── .claude-plugin\
│   └── plugin.json          ← {"name": "user-skills", "version": "1.0.0"}
└── skills\                  ← 정션(Junction) → %USERPROFILE%\.claude\skills
```

핵심 설계 포인트는 다음 세 가지다.

첫째, Windows에서는 심볼릭 링크 대신 **디렉토리 정션(Junction)** 을 사용한다. 심볼릭 링크(`mklink /D`, `SymbolicLink`)는 관리자 권한 또는 개발자 모드가 필요해 최종 사용자 배포 앱에서 전제할 수 없지만, 정션은 일반 권한으로 생성 가능하고 파일시스템 수준에서 투명하다. Node의 `fs.symlinkSync(target, path, "junction")`이 이를 지원하며, macOS/Linux에서는 세 번째 인자가 무시되고 일반 심링크로 동작하므로 크로스 플랫폼 코드가 하나로 유지된다.

둘째, 플러그인 생성은 **Electron main 프로세스**에서 수행한다. SDK 자체도 자식 프로세스를 spawn하고 파일시스템을 스캔하므로 main(또는 utility) 프로세스에서 실행해야 하며, renderer에서 필요하면 IPC로 감싼다.

셋째, provider별 설정은 `"user"` 소스 없이 앱이 완전히 통제하는 채널로 공급한다. 구체적으로 (a) provider별 작업 디렉토리에 `.claude/settings.json`을 앱이 직접 기록하고 `cwd`를 그 디렉토리로 지정하거나(→ `"project"` 소스로 로드됨), (b) base URL·인증 토큰류는 SDK `options`의 `env` 등 옵션 필드로 직접 전달한다. 두 방식 모두 사용자 머신의 `~/.claude/settings.json`과 무관하게 동작한다.

## 4. 구현

### 4.1 래퍼 플러그인 자동 생성 (main 프로세스)

```typescript
import { existsSync, mkdirSync, writeFileSync, symlinkSync, rmSync, lstatSync, readlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * 대상 skill 디렉토리를 가리키는 래퍼 플러그인을 보장(idempotent).
 * 대상이 없으면 null을 반환하고 아무것도 만들지 않는다.
 */
function ensureSkillsPlugin(name: string, skillsTarget: string): string | null {
  if (!existsSync(skillsTarget)) return null;

  const root = join(homedir(), ".claude", `${name}-plugin`);
  const manifestDir = join(root, ".claude-plugin");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "plugin.json"),
    JSON.stringify({ name, version: "1.0.0" })
  );

  const skillsLink = join(root, "skills");

  // 깨진 링크 또는 잘못된 대상을 가리키는 링크는 재생성
  if (existsSync(skillsLink) || isBrokenLink(skillsLink)) {
    if (isLinkTo(skillsLink, skillsTarget)) return root; // 이미 올바름
    rmSync(skillsLink, { recursive: false, force: true });
  }

  // Windows: 정션(관리자 권한 불필요) / macOS·Linux: 심링크
  symlinkSync(skillsTarget, skillsLink, "junction");
  return root;
}

function isBrokenLink(p: string): boolean {
  try { lstatSync(p); return !existsSync(p); } catch { return false; }
}

function isLinkTo(p: string, target: string): boolean {
  try { return readlinkSync(p) === target; } catch { return false; }
}
```

### 4.2 query 옵션 조립

```typescript
const pluginPaths = [
  // 사용자 레벨 Claude skill
  ensureSkillsPlugin("user-skills", join(homedir(), ".claude", "skills")),
  // (선택) OpenCode 전역 skill — 네이티브 Windows 기준 경로
  ensureSkillsPlugin("opencode-skills", join(homedir(), ".config", "opencode", "skills")),
].filter((p): p is string => p !== null);

const options = {
  cwd: providerWorkspaceDir,               // provider별 .claude/settings.json이 있는 디렉토리
  settingSources: ["project", "local"],    // "user" 제외 → provider 설정 충돌 차단
  plugins: pluginPaths.map((path) => ({ type: "local" as const, path })),
  // tools/allowedTools를 명시하는 경우 "Skill"을 반드시 포함할 것
};
```

### 4.3 로딩 검증 (필수)

플러그인 로드 결과는 세션의 **system init 메시지**로 확인한다. 앱 로직에 다음 검증을 내장하라. 개발 모드에서 정상이어도 배포 빌드에서 깨질 수 있는 지점이므로 로그를 남기는 것이 중요하다.

```typescript
for await (const message of query({ prompt, options })) {
  if (message.type === "system" && message.subtype === "init") {
    // 1) plugins 배열에 래퍼 플러그인이 있는지
    // 2) skills 목록에 기대한 skill이 (네임스페이스 포함하여) 있는지
    // 3) plugin_errors가 비어 있는지 — 비어있지 않으면 경고 로그
  }
  // ...
}
```

## 5. Windows + Electron 특유의 주의사항

**asar 패키징.** SDK는 내부적으로 CLI를 자식 프로세스로 실행하는데, asar 아카이브 내부 파일은 spawn할 수 없다. electron-builder 기준 `asarUnpack`에 `@anthropic-ai/claude-agent-sdk`(및 실행에 필요한 의존물)를 추가해 실제 파일시스템으로 풀어라. 그래도 spawn이 실패하면 SDK 옵션의 실행 파일 경로 지정 옵션(`pathToClaudeCodeExecutable` 계열)으로 `app.asar.unpacked` 하위 경로를 명시한다. **반드시 배포 빌드로 1회 이상 검증할 것.**

**최종 사용자 머신 방어.** 배포 앱에서는 `~/.claude/skills`가 존재하지 않는 것이 정상이다. 4.1처럼 대상 부재 시 조용히 스킵하고, 정션 생성 실패(권한, 볼륨 이슈)도 앱 크래시가 아닌 graceful degradation(스킬 없이 동작)으로 처리하라.

**정션 무효화.** 사용자가 `~/.claude/skills`를 삭제하면 정션이 깨진다. 4.1의 재생성 로직이 이를 처리하지만, 세션 시작마다 `ensureSkillsPlugin`을 호출하는 것을 전제로 한다.

**WSL 혼동 금지.** 이 가이드의 경로는 네이티브 Windows(`C:\Users\<이름>\...`) 기준이다. 사용자가 skill을 WSL 환경에 설치한 경우 해당 경로는 WSL 파일시스템 안에 있으므로 이 방식으로 접근하지 않는다.

**frontmatter 호환성.** 타 도구(OpenCode 등)에서 온 SKILL.md에 비표준 frontmatter 필드가 있을 수 있다. SDK가 이를 어떻게 처리하는지는 문서화되어 있지 않으므로, init 메시지에서 해당 skill 인식 여부를 확인하고 문제 시 비표준 필드를 제거한다.

## 6. 정션이 동작하지 않을 경우의 폴백

정션 경유 skill 로딩은 일반적으로 동작할 것으로 기대되지만 SDK 문서에 명시적으로 보장된 사항은 아니다. init 메시지 검증에서 skill이 인식되지 않으면, 링크 대신 **복사 동기화**로 전환한다.

```typescript
import { cpSync } from "fs";
// symlinkSync(...) 대신:
cpSync(skillsTarget, skillsLink, { recursive: true });
// 세션 시작 시마다 재복사하여 원본 변경을 반영 (skill 디렉토리는 보통 소용량)
```

## 7. 검토했으나 채택하지 않은 대안

**`"user"`를 포함하고 충돌 키만 오버라이드.** `settingSources: ["user", "project", "local"]`을 유지하되 provider 설정과 충돌하는 항목(env, model 등)을 SDK 옵션 레벨에서 명시 오버라이드하는 방식. 단순해 보이지만, 최종 사용자의 `~/.claude/settings.json` 내용을 예측할 수 없어 어떤 키가 충돌할지 사전에 열거 불가능하다. 배포 앱에서는 사용자 설정을 아예 로드하지 않는 격리(현재 방침)가 결정론적이므로 이쪽을 유지한다.

**skill을 project 소스로 복사.** provider 작업 디렉토리의 `.claude/skills/`에 사용자 skill을 복사해 `"project"` 소스로 로드하는 방식. 네임스페이스가 붙지 않는 장점이 있으나, provider별 디렉토리마다 중복 복사·동기화가 필요해 관리 비용이 크다. 단일 래퍼 플러그인이 더 단순하다.

## 8. 구현 완료 체크리스트

1. `settingSources: ["project", "local"]` 상태에서 provider 전용 settings가 적용되는가 (사용자 머신에 상충하는 `~/.claude/settings.json`을 만들어 놓고 테스트).
2. init 메시지의 skills 목록에 `user-skills:*` 네임스페이스로 사용자 skill이 나타나는가.
3. `plugin_errors`가 비어 있는가.
4. `~/.claude/skills`가 없는 클린 머신에서 앱이 오류 없이 기동하는가.
5. 배포 빌드(asar 패키징 후)에서 1~4가 동일하게 통과하는가.
6. `~/.claude/skills` 삭제 → 재생성 시나리오에서 정션이 자동 복구되는가.
