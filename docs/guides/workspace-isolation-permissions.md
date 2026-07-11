# Workspace 격리 권한 구성 가이드 (Agent SDK, 코드레벨)

> 대상: Claude Agent SDK(`@anthropic-ai/claude-agent-sdk`) 기반 앱
> 방식: **PreToolUse 훅 중심**, `settings.json` 미사용 — SDK `options` 코드로만 구성
> 언어: TypeScript
> 전제: sandbox/docker/wsl/appcontainer **없이** 작업 폴더 밖 r/w 를 막는다. OS 샌드박스 대체가 아니라 "작업 폴더 밖 실수·오작동 방지" 수준이다(§8 한계).

---

## 1. 설계 근거 (왜 이 구조인가)

요구사항은 두 가지를 **동시에** 만족해야 한다.

1. **작업 폴더(workspace) 밖 모든 경로의 r/w 차단** — 밖으로는 물어보지도 말고 즉시 거부.
2. **대화·자동진행 흐름 유지** — `plan` 모드, `AskUserQuestion`, `ExitPlanMode`, `acceptEdits` 자동승인 등 "계획 후 자동으로 작업이 넘어가는" 흐름은 그대로 동작해야 한다.

이 둘을 SDK 의 어떤 계층으로 강제하느냐가 핵심이다. 문서상 계층별 한계는 다음과 같다.

- **allow/deny 규칙만으로는 경로 격리가 불완전하다.** deny 규칙은 툴 이름 글롭(`Bash`, `mcp__*`)이나 명령 패턴(`Bash(rm *)`)만 매칭한다. "임의 경로가 작업 폴더 밖인가"를 판정하는 선언적 경로 규칙은 없다. Bash 안의 `cat /etc/passwd`, `python -c "open('/home/x')"` 같은 우회는 규칙으로 못 막는다.
- **격리를 `permissionMode: "dontAsk"` 에 매달면 안 된다.** `dontAsk` 는 실재하는 모드이고 밖 경로를 프롬프트 없이 거부해 주지만, **그 대가로 `canUseTool` 콜백을 통째로 건너뛴다.** 문서 명시: `AskUserQuestion` 과 사용자 상호작용이 필요한 MCP 도구는 보통 콜백으로 떨어지는데 *"In `dontAsk` mode both cases are denied instead, because that mode never prompts."* 즉 **`dontAsk` 를 켜면 `AskUserQuestion`·`ExitPlanMode`·위험도구 승인 카드가 전부 자동 거부**되어 요구사항 2를 깬다.
- **PreToolUse 훅은 모든 permission mode 보다 먼저, 모든 툴 호출에 강제로 실행된다.** 훅이 `deny` 를 반환하면 `bypassPermissions` 에서도 차단된다(문서: *"a hook deny applies even in `bypassPermissions` mode"*). 그래서 격리를 훅에 두면 **permissionMode 와 독립**해진다 — 어떤 모드든 밖은 훅이 먼저 자른다. 문서 권고와도 일치한다: *"For checks that must run on every tool call, use a PreToolUse hook."*

**결론:**

| 역할 | 담당 계층 |
|---|---|
| 경로 격리 실판정 (밖=차단) | **PreToolUse 훅** — 모드 독립, 항상 최우선 |
| permission mode | 앱이 필요대로 선택 (**default 권장**; `acceptEdits`·`plan` 도 안전). `dontAsk` **아님** |
| 툴 표면 축소 (선택) | `allowedTools` |
| 위험 명령 이중 차단 (선택) | `disallowedTools` (deny 규칙) |

격리는 훅이 지고, permissionMode 는 대화·자동진행 UX 를 위해 자유롭게 고른다. 이것이 요구사항 1·2 를 동시에 만족시키는 유일한 배치다.

### 1.1 권한 평가 순서

```
tool 요청
  → 1. Hooks           (PreToolUse: 여기서 경로 격리 판정 → 밖이면 deny)
  → 2. Deny rules      (disallowedTools: 위험 명령/툴 제거)
  → 3. Ask rules       (settings.json — 본 구성 미사용)
  → 4. Permission mode (default/acceptEdits/plan/bypassPermissions)
  → 5. Allow rules     (allowedTools: 허용 툴 표면)
  → 6. canUseTool      (승인 카드·AskUserQuestion·ExitPlanMode 진입점)
```

두 가지가 여기서 확정된다.

- **1단계(훅)가 최우선이라 격리는 mode 와 무관하다.** 훅이 밖 경로를 deny 하면 이후 단계는 볼 것도 없다.
- **훅이 작업 폴더 *안* 경로를 `deny` 하지 않고 통과시키면**, 판정은 4~6단계로 흘러가 permissionMode 와 `canUseTool` 이 결정한다. 이것이 승인 카드·plan·acceptEdits 가 살아있는 이유다. → **훅은 안 경로에 `allow` 를 반환하면 안 된다(§3.1).**

---

## 2. 최종 구성 (options 스켈레톤)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { makeWorkspaceGuardHook } from "./workspace-guard";

const WORKSPACE_ROOT = "/abs/path/to/workspace"; // 작업 폴더 (절대경로)
const ADDITIONAL_DIRS: string[] = [];            // 추후 주입 전까지 비움 (요구사항)

const options = {
  // permissionMode: 앱이 필요대로. dontAsk 는 쓰지 않는다 (canUseTool 을 죽여 대화형 흐름이 깨짐).
  //  - "default"     : 기본. 위험 도구는 canUseTool 로 승인 요청 (권장)
  //  - "acceptEdits" : 작업 폴더 안 파일 편집 자동 승인 (자동진행)
  //  - "plan"        : 탐색·계획만, 편집은 canUseTool 로 라우팅
  // 어느 값을 골라도 격리(밖 차단)는 훅이 보장한다.
  permissionMode: "default" as const,

  // (선택) 허용 툴 표면 축소. 안 적어도 격리는 훅이 하지만, 공격 표면을 줄이려면 유효.
  allowedTools: [
    "Read", "Glob", "Grep",
    "Write", "Edit",
    "Bash",
    "TodoWrite",
    // 대화형 흐름을 쓰면 남겨둔다:
    "AskUserQuestion", "ExitPlanMode",
  ],

  // (선택) 위험 명령 이중 차단. deny 규칙은 bypassPermissions 에서도 유효 (§6).
  disallowedTools: [
    "Bash(sudo *)",
    "Bash(rm -rf /*)",
    "Bash(curl *)", "Bash(wget *)", // 필요 시 조정
  ],

  // 추후 주입 전까지 비움. 훅과 동일 배열을 공유한다 (§5).
  additionalDirectories: ADDITIONAL_DIRS,

  // 격리의 실제 판정 — 모든 툴, 모든 모드보다 먼저.
  hooks: {
    PreToolUse: [
      // matcher 없음 = 모든 툴. additionalDirectories 와 같은 배열을 훅에도 넘긴다.
      { hooks: [makeWorkspaceGuardHook(WORKSPACE_ROOT, ADDITIONAL_DIRS)] },
    ],
  },
};

for await (const message of query({ prompt: userPrompt, options })) {
  // ...
}
```

> `permissionMode` 는 세션 중 `query(...).setPermissionMode(...)` 로 바꿔도 격리는 유지된다 — 훅이 모드보다 앞이기 때문. 모드는 UX 다이얼일 뿐이다.

---

## 3. PreToolUse 훅: 경로 격리 판정

### 3.1 판정 규칙 (핵심)

훅의 반환값은 세 종류이고, **무엇을 언제 반환하느냐가 이 구성의 성패를 가른다.**

| 반환 | 의미 | 언제 |
|---|---|---|
| `deny` | 즉시 차단 (모든 모드에서) | 경로가 작업 폴더/허용 예외 **밖** |
| **pass-through `{}`** | 판단 보류 → 이후 단계(mode·canUseTool)로 진행 | 경로가 작업 폴더 **안** 또는 read 예외, 그리고 파일 접근이 아닌 툴 |
| `allow` | 즉시 승인 (이후 mode·allow rule·canUseTool **건너뜀**) | **쓰지 않는다** — 아래 주의 |

> **왜 `allow` 를 쓰지 않나.** 문서상 훅 `allow` 는 deny·ask 규칙은 여전히 거치지만 **permission mode·allow rule·`canUseTool` 단계를 건너뛰어 즉시 승인**한다. 작업 폴더 안 경로에 `allow` 를 반환하면 위험도구 승인 카드·`acceptEdits` 판정·`plan` 의 편집 라우팅이 통째로 우회된다 → 요구사항 2(대화·자동진행 흐름 유지)가 깨진다. 그래서 **밖으로 나갈 때만 `deny`**, 안·예외는 **pass-through** 해서 하위 권한 로직이 정상 판정하게 둔다.

### 3.2 허용 경로 (read 예외) 정의

| 경로 | read | write |
|---|---|---|
| workspace (작업 폴더) + `additionalDirectories` | 허용 | 허용 |
| `~/.claude` — plugin/skill 제공 | 허용 | 차단 *(가이드 기본값 — Orca 구현은 **허용**, 아래 편차 노트)* |
| `~/.config/orca/` — plugin 제공 | 허용 | 차단 (단, 세션 cwd 가 이 하위면 cwd 는 writeRoots — 예외의 예외) |
| node/python skill 런타임 경로 (실행 특성상 read 불가피) | 허용 | 차단 |
| 그 외 모든 경로 | 차단 | 차단 |

> **최소권한 우선.** 먼저 read 예외 **없이** 돌려보고 skill/plugin 로딩이 깨질 때만 최소 경로를 추가한다. SDK 가 plugin/skill 을 내부적으로 로드해 read 권한이 불필요하면 이 예외들은 넣지 않는다(요구사항의 "무시해도 좋다").
>
> **Orca 구현 편차 (0075 r2, 사용자 결정)**: 실제 구현(`app/src/main/adapters/workspace-guard.ts` `writeExceptionRoots`)은 `~/.claude` 를 **write 허용**으로 넓혔다 — plan 모드 산출물 기록·`~/.claude/skills/<name>` 스킬 설치가 쓰기를 요구하기 때문. 본 표의 read-only 스탠스는 일반 방법론 기본값으로 보존한다.

### 3.3 툴별 경로 추출

- `Read` / `Write` / `Edit` → `tool_input.file_path`
- `Glob` / `Grep` → `tool_input.path` (검색 루트, 생략 시 cwd)
- `Bash` → `tool_input.command` (명령 문자열 정적 파싱 — best-effort, §3.5)
- 그 외(`TodoWrite`·`AskUserQuestion`·`ExitPlanMode` 등) → 파일 접근 아님 → **pass-through**

### 3.4 구현

```typescript
// workspace-guard.ts
import path from "node:path";
import os from "node:os";

type PreToolUseInput = {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
};

// read 는 허용하되 write 는 막을 경로 (skills/plugins/런타임). 최소권한 — 필요할 때만 채운다.
function readOnlyAllowRoots(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".claude"),
    path.join(home, ".config", "orca"),
    // node/python 런타임: 환경에 맞게. 예) process.execPath 상위, /usr/lib/python3.*, venv 경로
    path.dirname(process.execPath),
  ].map((p) => path.resolve(p));
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  // rel 이 ""(동일) 또는 하위이고, ".." 로 시작하지 않으며 절대경로가 아니면 내부
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function deny(reason: string) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse" as const,
      permissionDecision: "deny" as const,
      permissionDecisionReason: reason,
    },
  };
}

// 빈 객체 = 훅 판단 보류 → 이후 단계(mode·canUseTool)로 진행. **allow 를 반환하지 않는다** (§3.1).
function passThrough() {
  return {};
}

export function makeWorkspaceGuardHook(
  workspaceRoot: string,
  additionalDirs: string[] = [] // options.additionalDirectories 와 동일 배열 주입 (§5)
) {
  const WS = path.resolve(workspaceRoot);
  const extra = additionalDirs.map((d) => path.resolve(d));
  const writeRoots = [WS, ...extra];                         // write 허용
  const readRoots = [WS, ...extra, ...readOnlyAllowRoots()]; // read 허용 = write + 예외

  return async (input: PreToolUseInput) => {
    if (input.hook_event_name !== "PreToolUse") return passThrough();
    const { tool_name, tool_input } = input;

    const READ_TOOLS = ["Read", "Glob", "Grep"];
    const WRITE_TOOLS = ["Write", "Edit"];

    const rawPath =
      (tool_input.file_path as string) ?? (tool_input.path as string) ?? null;

    // --- 쓰기 계열: 경로 1개 ---
    if (WRITE_TOOLS.includes(tool_name)) {
      if (!rawPath) return deny("write 경로를 확인할 수 없음");
      const p = path.resolve(WS, rawPath); // 상대경로는 workspace 기준 해석
      if (writeRoots.some((r) => isInside(p, r))) return passThrough(); // 안 → 하위 로직이 판정
      return deny(`workspace 밖 write 차단: ${p}`);
    }

    // --- 읽기 계열: 경로 1개 ---
    if (READ_TOOLS.includes(tool_name)) {
      if (!rawPath) return passThrough(); // Glob/Grep path 생략 = cwd(=workspace) 기준
      const p = path.resolve(WS, rawPath);
      if (readRoots.some((r) => isInside(p, r))) return passThrough();
      return deny(`허용되지 않은 경로 read 차단: ${p}`);
    }

    // --- Bash: 정적 스크리닝은 SUPERSEDED (§3.5 — Orca 0075 r3 에서 제거) ---
    // Bash 격리는 코드 강제가 아니라 시스템 프롬프트 도구-사용 정책으로 유도한다.
    // (구 스케치: screenBashCommand(cmd, WS, readRoots) 판별 후 deny — §3.5 역사 보존 참조)
    if (tool_name === "Bash") {
      return passThrough(); // 위험도구라면 canUseTool 승인 카드로 진입
    }

    // 그 외 툴 (TodoWrite·AskUserQuestion·ExitPlanMode 등) = 파일 접근 아님 → 보류
    return passThrough();
  };
}
```

### 3.5 Bash 경로 스크리닝 (핵심 한계 지점)

> **SUPERSEDED (Orca 구현 0075 r3)**: 아래 정적 스크리닝은 실전 검증에서 실효가 없어(eval·변수치환
> `$HOME`·파이프·base64 우회를 못 잡고 URL `//host`·literal `~/.claude` 를 오차단) **Orca 구현에서 제거**했다.
> 대신 Bash 격리는 시스템 프롬프트 도구-사용 정책(`# Tools` — 파일 작업을 전용 툴로 라우팅 + Bash 를
> workspace 스코프로 유도, opencode `anthropic.txt` 참고)으로 옮겼다. 즉 **구조 파일툴(Read/Write/Edit/
> Glob/Grep)=훅으로 코드 강제, Bash=프롬프트로 유도**(코드 강제 불가). 본 §3.5 는 일반 참고로 보존한다.

Bash 는 임의 문자열이라 완벽한 정적 판별이 불가능하다. 전략은 **"절대경로 화이트리스트 + 상위 탈출 차단"** best-effort 다.

```typescript
function screenBashCommand(
  cmd: string,
  ws: string,
  readRoots: string[]
): { block: boolean; reason: string } {
  // 1) 절대경로 토큰: /로 시작하는 경로 조각이 readRoots 밖이면 차단
  const absPaths = cmd.match(/(?<![\w-])\/[^\s"'`|;&><]+/g) ?? [];
  for (const raw of absPaths) {
    const p = path.resolve(raw);
    if (!readRoots.some((r) => isInside(p, r))) {
      return { block: true, reason: `Bash 절대경로 접근 차단: ${p}` };
    }
  }

  // 2) 상위 탈출(../../ 로 workspace 이탈) — 상대경로는 cwd(workspace) 기준 resolve 후 검사
  const relTokens = cmd.match(/(?<![\w-])\.\.\/[^\s"'`|;&><]*/g) ?? [];
  for (const raw of relTokens) {
    const p = path.resolve(ws, raw);
    if (!readRoots.some((r) => isInside(p, r))) {
      return { block: true, reason: `Bash 상위경로 탈출 차단: ${p}` };
    }
  }

  // 3) 홈/시스템 확장 차단 (~/.claude, ~/.config/orca 예외)
  if (/(^|\s)(~[^\/\s]|~\/(?!\.claude|\.config\/orca))/.test(cmd)) {
    return { block: true, reason: "Bash 홈 디렉터리 확장 차단" };
  }

  return { block: false, reason: "" };
}
```

> **한계 명시.** 위 스크리닝은 `eval`, 변수 치환(`$HOME`), 파이프 우회, base64 디코드 실행 등을 잡지 못한다. **Bash 를 허용하는 한 정적 격리는 완전하지 않다.** 진짜 강한 격리가 필요하면 본 가이드 범위(sandbox 없음)를 벗어나 OS 레벨 격리가 필요하다(§8).

---

## 4. 모드별 격리 유지 (각 모드에서 밖으로 못 나감)

훅이 1단계라 **아래 모든 모드에서 "밖=차단"은 동일**하다. 달라지는 것은 "작업 폴더 *안*" 동작뿐이며, 그건 요구사항 2(대화·자동진행 유지)가 의도한 바다.

| permissionMode | 작업 폴더 **안** | 작업 폴더 **밖** | 대화형 흐름 |
|---|---|---|---|
| `default` (권장) | 위험도구는 `canUseTool` 승인 카드 | **훅 deny** | `AskUserQuestion`·`ExitPlanMode` 정상 (canUseTool 도달) |
| `acceptEdits` | 파일 편집 자동 승인(자동진행) | **훅 deny** (acceptEdits 도 훅보다 뒤) | 정상 |
| `plan` | 읽기 실행·편집은 `canUseTool` 로 라우팅 | **훅 deny** | `ExitPlanMode` 정상, 계획 후 자동 전환 |
| `bypassPermissions` | 프롬프트 없이 실행 | **훅 deny** (deny 는 bypass 에서도 유효) | — |

`dontAsk` 는 표에 없다 — 이 구성은 그것을 쓰지 않는다. 격리는 이미 훅이 하므로 굳이 canUseTool 을 죽이는 모드를 택할 이유가 없다.

---

## 5. `additionalDirectories` 확장 시나리오

지금은 `[]`. 추후 특정 폴더를 추가 허용할 때, **SDK 옵션과 훅에 같은 배열을 주입**한다.

```typescript
const ADDITIONAL_DIRS = ["/abs/extra/dir"]; // 단일 소스(one array)

const options = {
  additionalDirectories: ADDITIONAL_DIRS, // SDK 내장 파일툴 경로 스코프에 반영
  hooks: {
    PreToolUse: [
      { hooks: [makeWorkspaceGuardHook(WORKSPACE_ROOT, ADDITIONAL_DIRS)] }, // 훅에도 동일 반영
    ],
  },
};
```

훅은 SDK 옵션을 자동으로 읽지 않는 별도 로직이므로, **반드시 같은 배열을 인자로 넘긴다.** `makeWorkspaceGuardHook` 이 이를 `writeRoots`·`readRoots` 에 합친다(§3.4). 한 배열만 관리하면 옵션과 훅이 드리프트하지 않는다.

---

## 6. `disallowedTools` 로 보강 (deny 규칙, 선택)

훅이 놓치는 명령류를 deny 규칙으로 못박는다. deny 규칙은 훅보다 뒤(2단계)지만 **훅이 pass-through 해도 deny 규칙이 있으면 차단**된다 — 이중 안전망. `bypassPermissions` 에서도 유효.

```typescript
disallowedTools: [
  "Bash(sudo *)",
  "Bash(su *)",
  "Bash(chmod 777 *)",
  "Bash(rm -rf /*)",
  "Bash(curl *)", "Bash(wget *)",   // 외부 반출 방지 (필요 시 완화)
  "Bash(scp *)", "Bash(rsync *)",
]
```

> 주의: `disallowedTools: ["Bash"]` 처럼 **이름만** 적으면 Bash 도구 자체가 컨텍스트에서 제거된다. 위처럼 **패턴(`Bash(...)`)** 으로 적어야 Bash 는 살리고 해당 명령만 막는다.

---

## 7. 검증 체크리스트

각 모드(`default`·`acceptEdits`·`plan`)에서 아래를 실제로 돌려 확인한다.

- [ ] workspace 내 파일 Read/Write → 허용 (모드별 흐름: default=승인 카드, acceptEdits=자동, plan=라우팅)
- [ ] `/etc/passwd` Read → 차단
- [ ] workspace 밖 절대경로 Write → 차단
- [ ] `Bash: cat /etc/hosts` → (Orca 구현) 코드 차단 아님 — 프롬프트 유도 + 승인 카드 (§3.5 SUPERSEDED)
- [ ] `Bash: cat ../../secret` → 동상
- [ ] `~/.claude` 하위 Read → 허용, Write → 가이드 기본 차단 / **Orca 구현 허용** (§3.2 편차 노트)
- [ ] `~/.config/orca` 하위 Read → 허용
- [ ] **`AskUserQuestion` → 사용자에게 질문이 뜬다 (자동 거부되지 않음)**
- [ ] **`ExitPlanMode` / `plan` 모드 → 계획 제출 후 정상 진행 (자동 거부되지 않음)**
- [ ] node/python skill 실행 → 정상 동작 (깨지면 런타임 경로를 `readRoots` 에 추가)
- [ ] skill/plugin 을 read 예외 **없이** 먼저 테스트 → 동작하면 예외 제거(최소 권한)

---

## 8. 요약

| 계층 | 역할 | 구현 |
|---|---|---|
| **PreToolUse 훅** | 경로 격리 실판정 (모든 툴·모든 모드 최우선). 밖=deny, 안=pass-through | `makeWorkspaceGuardHook` |
| **permissionMode** | 대화·자동진행 UX 다이얼. `default` 권장, `dontAsk` **아님** | `permissionMode: "default"` |
| `allowedTools` | (선택) 허용 툴 표면 축소 | Read/Write/Edit/Bash/AskUserQuestion/… |
| `disallowedTools` | (선택) 위험 명령 이중 차단 | `Bash(sudo *)` 등 |
| `additionalDirectories` | 추후 확장 (지금 `[]`) | 훅과 동일 배열 공유 |

**핵심 원칙 재확인:**

1. **격리는 훅이 진다 — permissionMode 와 독립.** 훅이 1단계라 default·acceptEdits·plan·bypassPermissions 어디서든 밖은 먼저 잘린다.
2. **`dontAsk` 를 쓰지 않는다.** 그 모드는 `canUseTool` 을 죽여 `AskUserQuestion`·`ExitPlanMode`·승인 카드를 자동 거부한다 — 요구사항(대화·자동진행 유지)과 정면 충돌.
3. **훅은 안 경로에 `allow` 가 아니라 pass-through 를 반환한다.** `allow` 는 하위 승인·모드 로직을 우회하기 때문.
4. **Bash 를 허용하는 한 정적 격리는 완전하지 않다.** 본 구성은 OS 샌드박스 대체가 아니라 "작업 폴더 밖 실수·오작동 방지" 수준임을 전제로 운용한다.
