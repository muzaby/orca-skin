# Orca Skin Windows SRT Integration Plan

## 1. 목표

`orca-skin`은 Windows 네이티브 환경을 타겟으로 하며, WSL 및 Docker를 사용하지 않는다.

목표는 Anthropic `sandbox-runtime`(SRT)의 Windows 지원을 이용하여 Claude Agent SDK 및 그 하위 실행 프로세스를 OS 수준에서 격리하는 것이다.

핵심 목표는 다음과 같다.

- Electron Main 프로세스는 기존 사용자 권한으로 유지
- Claude Agent SDK의 `query()` 실행 영역을 별도 프로세스로 분리
- 해당 프로세스를 SRT sandbox 내부에서 실행
- Claude Code가 실행하는 PowerShell, cmd, git, node, python, MCP 등의 child process도 동일 sandbox 경계에 포함
- 기존 `workspace-guard`, permission 처리, UI approval 로직은 최대한 유지
- Vault, DB, 사용자 credential 등 trusted 자원은 sandbox 외부에 유지
- Main ↔ agent-host 간 통신은 JSON RPC/IPC 형태로 제한

---

## 2. 목표 아키텍처

```text
┌──────────────────────────────────────────────┐
│ Orca Electron Main                          │
│                                              │
│ Trusted 영역                                │
│                                              │
│ - SessionManager                             │
│ - PermissionManager                          │
│ - WorkspaceGuard 정책                       │
│ - Prompt / Options builder                  │
│ - DB                                         │
│ - Vault / credential                        │
│ - UI approval                               │
│ - SandboxController                         │
└──────────────────────┬───────────────────────┘
                       │
                       │ JSON RPC / IPC
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ SRT sandbox                                  │
│                                              │
│ agent-host                                   │
│                                              │
│ - Claude Agent SDK                           │
│ - query()                                    │
│ - SDK callback proxy                        │
│ - message forwarding                        │
│                                              │
│      └─ Claude Code                          │
│          ├─ PowerShell / cmd                 │
│          ├─ git                              │
│          ├─ node                             │
│          ├─ python                           │
│          └─ MCP child processes              │
└──────────────────────────────────────────────┘
```

---

## 3. 핵심 원칙

### 3.1 SRT가 `query()`를 호출하는 것이 아니다

SRT는 JavaScript 함수 실행 계층이 아니라 **프로세스 실행 계층**이다.

```text
Orca Main
   │
   │ SRT를 통해 프로세스 실행
   ▼
agent-host
   │
   └─ query(...)
```

즉:

```text
SRT
 └─ agent-host
      └─ query()
```

구조로 본다.

`query()`는 반드시 SRT 내부에서 실행되는 `agent-host` 코드가 호출한다.

---

### 3.2 기존 query 준비 로직을 전부 agent-host로 이동하지 않는다

현재 Orca에서 `query()` 호출 전에 수행하는 로직이 많더라도, 모두 agent-host로 옮기지 않는다.

다음은 Main에 유지한다.

- session 상태 관리
- workspace 설정 결정
- model 결정
- permission mode 결정
- system prompt 생성
- prompt 조립
- DB 조회
- 사용자 설정 조회
- Vault 접근
- UI approval
- allowed tools 계산
- 기타 순수 데이터 조립

Main에서 최종적으로 **직렬화 가능한 DTO**를 생성하여 agent-host로 전달한다.

예:

```ts
interface AgentQueryRequest {
  requestId: string;
  sessionId: string;

  prompt: string;
  cwd: string;

  model?: string;
  permissionMode?: string;
  systemPrompt?: string;

  maxTurns?: number;
  allowedTools?: string[];

  env?: Record<string, string>;
}
```

---

## 4. agent-host로 이동해야 하는 것

프로세스 경계를 넘을 수 없는 함수형 객체는 agent-host에 존재해야 한다.

대표적으로:

```ts
query({
  prompt,
  options: {
    canUseTool,
    hooks,
    spawnClaudeCodeProcess,
  },
});
```

다음 항목은 함수이므로 JSON으로 전달할 수 없다.

- `canUseTool`
- `hooks`
- 기타 SDK callback
- `spawnClaudeCodeProcess`와 같은 함수형 옵션
- in-process handler

따라서 agent-host 내부에서 callback을 생성한다.

단, **실제 비즈니스 로직까지 agent-host로 이동시키지는 않는다.**

---

## 5. Callback Proxy 패턴

agent-host의 callback은 가능한 한 얇게 만든다.

### agent-host

```ts
const options = {
  cwd: request.cwd,
  model: request.model,
  systemPrompt: request.systemPrompt,
  permissionMode: request.permissionMode,

  canUseTool: async (toolName, input, context) => {
    return rpc.request("canUseTool", {
      requestId: request.requestId,
      sessionId: request.sessionId,
      toolName,
      input,
      context,
    });
  },

  hooks: {
    PreToolUse: [
      async (input, toolUseId, context) => {
        return rpc.request("hook:PreToolUse", {
          requestId: request.requestId,
          sessionId: request.sessionId,
          input,
          toolUseId,
          context,
        });
      },
    ],
  },
};
```

### Electron Main

```ts
rpc.handle("canUseTool", async (req) => {
  return permissionManager.canUseTool(req);
});

rpc.handle("hook:PreToolUse", async (req) => {
  return workspaceGuard.handle(req);
});
```

이 구조를 통해 기존 PermissionManager와 WorkspaceGuard를 유지할 수 있다.

---

## 6. 기존 로직 배치 기준

| 기능 | Electron Main | agent-host |
|---|:---:|:---:|
| session 관리 | O | |
| DB | O | |
| Vault | O | |
| UI approval | O | |
| prompt 생성 | O | |
| system prompt 생성 | O | |
| model 결정 | O | |
| cwd 결정 | O | |
| permission mode 결정 | O | |
| allowedTools 계산 | O | |
| query DTO 생성 | O | |
| `query()` 호출 | | O |
| SDK message iteration | | O |
| `hooks` 함수 객체 | | O |
| `canUseTool` 함수 객체 | | O |
| 실제 permission 판단 | O | |
| 실제 workspace 정책 판단 | O | |
| Claude Code 실행 | | O |
| PowerShell/cmd/bash-equivalent | | O |
| git/node/python | | O |
| MCP child process | | O |

---

## 7. SRT 실행 구조

### 권장 흐름

```text
Orca Electron Main
        │
        │ SandboxManager.wrapWithSandboxArgv(...)
        ▼
srt-win.exe
        │
        │ Restricted Windows environment
        ▼
agent-host
        │
        └─ query(...)
             │
             └─ Claude Code
                  ├─ PowerShell
                  ├─ cmd
                  ├─ git
                  ├─ node
                  ├─ python
                  └─ MCP
```

Electron 전체를 sandbox 안에 넣지 않는다.

---

## 8. SandboxController

Electron Main에 sandbox lifecycle을 담당하는 계층을 추가한다.

예:

```text
src/main/sandbox/
  SandboxController.ts
  SandboxConfig.ts
  SandboxProcess.ts
```

책임:

- SRT 초기화
- Windows SRT 설치 여부 검사
- agent-host 실행
- workspace별 sandbox config 생성
- agent-host 종료
- 비정상 종료 감지
- IPC transport 연결
- 로그 수집

개념적 인터페이스:

```ts
interface SandboxController {
  initialize(): Promise<void>;

  startAgentHost(options: {
    workspacePath: string;
  }): Promise<AgentHostConnection>;

  stopAgentHost(sessionId: string): Promise<void>;

  dispose(): Promise<void>;
}
```

---

## 9. AgentHost

가능하면 agent-host는 별도 비즈니스 계층이 아니라 **SDK execution boundary**로만 사용한다.

예:

```text
src/agent-host/
  index.ts
  AgentQueryRunner.ts
  RpcTransport.ts
  callbacks/
    CanUseToolProxy.ts
    HookProxy.ts
```

책임:

1. Main으로부터 `AgentQueryRequest` 수신
2. Claude SDK options 생성
3. callback proxy 연결
4. `query()` 호출
5. SDK message를 Main으로 전달
6. cancel / abort 처리
7. 프로세스 종료 처리

---

## 10. AgentHost가 갖지 않아야 할 것

다음 로직을 agent-host 안으로 이동시키지 않는다.

- DB repository
- 사용자 설정 repository
- Vault
- auth token 저장소
- Electron window
- dialog
- workspace 정책의 원본 구현
- permission 정책의 원본 구현
- business domain state

agent-host가 compromise되더라도 이 데이터들에 직접 접근하지 못하도록 하는 것이 목적이다.

---

## 11. IPC / RPC 프로토콜

Main과 agent-host 사이에서는 JSON 직렬화 가능한 메시지만 사용한다.

### Main → AgentHost

```text
query:start
query:abort
query:dispose
```

### AgentHost → Main

```text
query:message
query:error
query:complete

permission:request
hook:preToolUse
hook:postToolUse
```

### 예시

```ts
type RpcMessage =
  | {
      type: "query:start";
      request: AgentQueryRequest;
    }
  | {
      type: "query:abort";
      requestId: string;
    }
  | {
      type: "query:message";
      requestId: string;
      message: unknown;
    };
```

---

## 12. Timeout / Deadlock 처리

callback이 Main의 응답을 기다리는 구조이므로 timeout이 필요하다.

예:

```ts
await rpc.request(
  "canUseTool",
  payload,
  {
    timeoutMs: 30_000,
  },
);
```

Main 프로세스가 죽거나 IPC가 끊기면 기본 동작은 **deny**로 한다.

```text
IPC failure
      ↓
permission callback failure
      ↓
DENY
```

보안 관련 callback에서 fail-open을 사용하지 않는다.

---

## 13. Secret 관리

SRT 내부 프로세스에 실제 사용자 홈 디렉터리 전체를 노출하지 않는다.

특히 다음 디렉터리를 그대로 `allowRead` 하지 않는 방향을 우선한다.

```text
%USERPROFILE%\.ssh
%USERPROFILE%\.aws
%USERPROFILE%\.claude
기타 credential 저장소
```

권장 구조:

```text
Orca Main
  │
  ├─ Vault
  ├─ Auth
  └─ Secret storage
       │
       │ 최소 필요 정보만 전달
       ▼
agent-host
```

필요한 credential만 제한된 env 또는 IPC를 통해 전달한다.

---

## 14. Environment sanitization

Main의 전체 `process.env`를 sandbox에 그대로 전달하지 않는다.

금지:

```ts
env: {
  ...process.env,
}
```

권장:

```ts
const env = {
  PATH: sandboxPath,
  TEMP: sandboxTemp,
  TMP: sandboxTemp,

  // 명시적으로 필요한 값만 추가
};
```

민감 환경변수의 의도치 않은 전달을 막는다.

---

## 15. Workspace isolation

기본 write policy:

```text
allowWrite:
  <current workspace>
  <sandbox temp>
```

기본 deny 방향:

```text
user profile
Orca application data
Vault
SSH keys
cloud credential
기타 workspace 외부 데이터
```

다만 Windows SRT의 filesystem 구현 특성상 NTFS ACL 상태에 따라 workspace 밖 write confinement가 완전하지 않을 수 있으므로, 기존 `workspace-guard`를 제거하지 않는다.

---

## 16. Defense in Depth

최종 보안 구조는 다음 세 계층으로 구성한다.

### Layer 1 — Orca WorkspaceGuard

```text
PreToolUse
    ↓
workspace path 정책 검사
```

빠른 논리적 차단.

### Layer 2 — Orca PermissionManager

```text
Tool request
    ↓
permission 정책
    ↓
필요시 사용자 승인
```

사용자 의도 기반 차단.

### Layer 3 — SRT

```text
process
filesystem
network
child process
```

OS 수준 enforcement.

---

## 17. Network policy

기본 정책은 allowlist 기반으로 한다.

예:

```ts
network: {
  allowedDomains: [
    "api.anthropic.com",
  ],
  strictAllowlist: true,
}
```

GitHub 기능 등이 필요할 경우 필요한 도메인만 추가한다.

예:

```text
github.com
api.github.com
*.githubusercontent.com
```

전체 인터넷 허용을 기본값으로 하지 않는다.

---

## 18. SRT binary 관리

`srt-win.exe`는 workspace 내부에 두지 않는다.

권장 위치:

```text
<orca-install-dir>/runtime/srt/
```

또는 사용자 수정이 어려운 애플리케이션 관리 디렉터리.

workspace가 writable인 상태에서 sandbox 실행 binary까지 workspace에 둘 경우 신뢰 경계가 무너질 수 있다.

---

## 19. agent-host 패키징 방식

### 옵션 A — 별도 executable

```text
orca.exe
agent-host.exe
srt-win.exe
```

장점:

- 보안 경계가 명확
- 프로세스 역할 구분이 쉬움

단점:

- 배포 artifact 증가

---

### 옵션 B — 동일 Orca executable의 child mode

```text
orca.exe
```

정상 실행:

```text
orca.exe
→ Electron
```

agent host 실행:

```text
orca.exe --agent-host
→ UI 없이 Agent SDK host
```

장점:

- 별도 binary 최소화
- 패키징 단순화 가능

검증할 사항:

- Electron runtime의 sandbox 계정 실행 호환성
- 필요한 Node integration
- startup overhead
- Electron 관련 불필요 권한/모듈 로딩 여부

초기 구현에서는 별도 Node/agent-host entrypoint가 더 단순할 수 있다.

---

## 20. 단계별 구현 계획

### Phase 1 — Query Boundary 추출

목표:

SRT 없이 먼저 `query()`를 별도 agent-host 프로세스로 분리한다.

작업:

1. 현재 `query()` 호출 위치 식별
2. query 입력 DTO 정의
3. callback 목록 정리
4. agent-host 프로세스 생성
5. Main ↔ agent-host RPC 구현
6. query message forwarding 구현
7. abort 구현
8. 기존 기능 regression 확인

완료 조건:

```text
Electron Main
  ↓ IPC
agent-host
  ↓
query()
```

가 정상 작동한다.

---

### Phase 2 — Callback Proxy

작업:

- `canUseTool` proxy
- `PreToolUse` proxy
- 필요한 기타 hook proxy
- user approval round-trip
- timeout
- IPC failure → deny

완료 조건:

기존 permission 및 workspace 정책을 agent-host 내부로 복사하지 않고도 정상 동작한다.

---

### Phase 3 — SRT 적용

작업:

1. `@anthropic-ai/sandbox-runtime` 통합
2. Windows install/provision flow
3. `SandboxController` 구현
4. `wrapWithSandboxArgv()` 기반 agent-host 실행
5. `shell: false`
6. workspace filesystem policy
7. network allowlist
8. child process containment 검증

완료 조건:

agent-host 및 Claude가 생성한 child process가 sandbox 권한으로 실행된다.

---

### Phase 4 — Secret 분리

작업:

- 사용자 profile 의존성 조사
- `.claude` credential 의존성 확인
- Main Vault → agent-host 전달 전략 구현
- env sanitization
- credential exposure 테스트

완료 조건:

sandboxed process가 실제 사용자 credential 파일을 직접 읽지 않아도 query가 정상 동작한다.

---

### Phase 5 — Hardening

테스트 대상:

```text
PowerShell
cmd.exe
node
python
git
MCP
nested child process
```

공격성 테스트:

```text
workspace 밖 파일 read
workspace 밖 파일 write
사용자 홈 접근
SSH key 접근
environment secret 접근
허용되지 않은 network domain 접근
child process를 통한 sandbox 탈출
```

---

## 21. 반드시 검증할 테스트 케이스

### Filesystem

```powershell
Get-Content C:\Users\<real-user>\.ssh\id_rsa
```

→ 실패해야 함.

```powershell
Set-Content C:\Users\<real-user>\Desktop\test.txt hello
```

→ 정책상 실패해야 함.

```powershell
Set-Content <workspace>\test.txt hello
```

→ 성공해야 함.

---

### Python

```powershell
python -c "open(r'C:\Users\<real-user>\secret.txt').read()"
```

→ 실패해야 함.

---

### Node

```powershell
node -e "require('fs').readFileSync('C:\\Users\\...\\secret.txt')"
```

→ 실패해야 함.

---

### Network

```powershell
curl https://not-allowed.example.com
```

→ 실패해야 함.

허용된 API endpoint:

```powershell
curl https://api.anthropic.com
```

→ 네트워크 정책상 접근 가능해야 함.

---

### Child process

Claude → PowerShell → Node → Python 형태의 중첩 child에서도 sandbox 제한이 유지되어야 한다.

---

## 22. 다중 Workspace 주의점

Windows SRT의 ACL 모델이 동일한 sandbox SID를 사용한다면 여러 workspace sandbox가 동시에 실행될 때 workspace 간 접근 가능성이 없는지 검증해야 한다.

예:

```text
Workspace A
  agent-host A

Workspace B
  agent-host B
```

확인 사항:

```text
A가 B를 읽을 수 있는가?
A가 B를 쓸 수 있는가?
B가 A를 읽을 수 있는가?
B가 A를 쓸 수 있는가?
```

초기 버전에서 보장이 어렵다면:

```text
동시에 하나의 active sandbox workspace
```

정책으로 제한하는 것도 고려한다.

---

## 23. 하지 않을 것

초기 구현에서는 다음을 피한다.

### Electron Main 전체를 sandbox 안에 넣기

이유:

- DB/Vault/UI까지 신뢰 경계 안으로 들어감
- filesystem/network 권한 설계가 복잡해짐
- 공격 표면 증가

### 기존 WorkspaceGuard 제거

SRT Windows는 아직 완전한 filesystem confinement로 가정하지 않는다.

### query preparation 전체를 agent-host로 이전

불필요한 architecture churn을 만든다.

### Main의 모든 environment 전달

secret leakage 위험이 있다.

---

## 24. 최종 목표 상태

```text
                   TRUSTED
┌─────────────────────────────────────┐
│ Orca Main                           │
│                                     │
│ Session                             │
│ DB                                  │
│ Vault                               │
│ Workspace policy                    │
│ Permission policy                   │
│ UI approval                         │
│ Query request builder               │
└──────────────────┬──────────────────┘
                   │
                   │ Strict JSON RPC
                   ▼
                  SRT
┌─────────────────────────────────────┐
│ UNTRUSTED EXECUTION                 │
│                                     │
│ agent-host                          │
│   └─ query()                        │
│       └─ Claude Code                │
│           ├─ PowerShell             │
│           ├─ cmd                    │
│           ├─ git                    │
│           ├─ node                   │
│           ├─ python                 │
│           └─ MCP                    │
└─────────────────────────────────────┘
```

핵심 설계 원칙:

> Orca의 기존 business logic은 가능한 한 Main에 유지하고,
> Claude Agent SDK의 실제 실행 경계만 별도 agent-host로 추출한 뒤,
> 해당 프로세스 전체를 SRT 안에서 실행한다.

---

## 25. 우선 구현 순서

가장 안전한 순서는 다음과 같다.

```text
1. query() 호출부만 agent-host로 분리
2. Main ↔ agent-host RPC 안정화
3. callback proxy 구현
4. 기존 기능 regression 테스트
5. SRT를 agent-host 실행 wrapper로 추가
6. filesystem/network policy 적용
7. credential/env 분리
8. 공격성 sandbox 테스트
9. 다중 workspace 격리 검증
```

SRT부터 바로 붙이기보다는 **프로세스 경계를 먼저 분리한 다음 SRT를 적용**하는 편이 디버깅과 회귀 테스트 측면에서 안전하다.
