# Claude Code CLI 실행 스펙 (`spec/claude/` 라우터 + Orca 채택 표기)

> **역할 변경 (2026-06-04, docs 재구성)**: 본 문서는 1차적으로 **`docs/spec/claude/` 원문 미러로 가는 라우터**다 — 원문은 아래 "1차 원본" 링크가 SSOT. CLI/SDK 권한 매핑·정규화 같은 **Orca 합성 설계**는 [`arch/backend/provider-runtime.md`](./arch/backend/provider-runtime.md)(권한 정규화)·[`arch/backend/adapters.md`](./arch/backend/adapters.md)(SDK 채택)로 이관됐다. 본 문서의 **§ 번호(§3·§4·§5·§7·§13)는 하위 호환을 위해 보존**한다(PRD/TRD·`app/src/main/features/extensions/skills/scan.ts §5.3` 가 인용). 새 인용은 위 arch 문서를 우선한다.

> **본 문서의 위치**
> 이 문서는 Claude Code 공식 한국어 문서의 **해설 미러** 이다. 원문은 본 저장소의 `docs/spec/claude/` 에 *원문 그대로* 보관되며, 본 문서는 그 원문을 *Orca 관점* 으로 정리하고 채택 표기를 덧붙인다. PRD/TRD/architecture 가 Claude Code CLI 의 동작·플래그·이벤트를 인용할 때 본 문서가 단일 출처(SSOT) 역할을 한다.
>
> - **1차 원본 (저장소 로컬 원문 미러)**:
>   - `docs/spec/claude/headless.md` — 프로그래밍 방식 실행 (구 "헤드리스 모드")
>   - `docs/spec/claude/cli-reference.md` — 전체 CLI 명령·플래그 참조
> - **원격 원문**: `https://code.claude.com/docs/ko/headless`, `https://code.claude.com/docs/ko/cli-reference`
> - **동기화 책임**: 원문이 갱신되면 (1) `docs/spec/claude/*.md` 를 *통째로 덮어쓰기* 한 뒤 (2) 본 문서를 미러와 정합화한다. 사람이 수동, 자동 동기화 없음. 미러 정책은 `docs/spec/AGENTS.md` 참조.
> - **편집 규칙**: 외부 사실(플래그·이벤트 스키마)은 원문 미러를 따른다. 본 문서가 *추가* 하는 것은 **Orca v1 채택 박스**, 정리표, 절 번호 안정성 뿐이다.
> - **절 번호 안정**: PRD/TRD/architecture 가 본 문서를 §번호 로 인용한다. 절 번호 (§3·§4·§5·§7·§13) 는 함부로 재번호하지 않는다. 새 사실은 끝(§14)에 흡수하거나 기존 절의 하위 절로 둔다.
> - **각주 표기 범례**: 각 섹션 말미에 다음 중 하나가 있다.
>   - ✅ **Orca v1 채택** — Phase 1 MVP 가 사용 (사용 방식·근거)
>   - ❌ **Orca v1 미사용** — MVP 범위 밖 (이유)
>   - ⏳ **Open Question** — Phase 1 정책 미정 (PRD §11 / TRD §7.1 와 미러링)

---

## 0. 개요

Claude Code 는 [Agent SDK](https://code.claude.com/docs/ko/agent-sdk/overview)와 동일한 도구·에이전트 루프·컨텍스트 관리 위에서 동작한다. 다음 세 가지 진입 경로가 있다.

| 진입 경로 | 호출 방식 | Orca 사용 여부 |
|---|---|---|
| **CLI** (`claude -p`) | `child_process.spawn` 으로 매 턴 새 프로세스 | ✅ Phase 1 채택 (TRD §7.1) |
| **Python SDK** (`claude-agent-sdk`) | Python 프로세스 임베드 | ❌ 미사용 (§10) |
| **TypeScript SDK** (`@anthropic-ai/claude-agent-sdk`) | Node 프로세스 임베드 | ❌ 미사용 — 향후 검토 anchor (§10) |

> CLI 는 이전에 "헤드리스 모드" 로 불렸다. `-p` 플래그 및 모든 CLI 옵션은 동일하게 작동한다.

> **요금 / 크레딧 정책 변경 (원문 Note)**: 2026-06-15 부 Agent SDK 와 `claude -p` 사용량은 구독 플랜의 *대화형 사용량 한도와 분리된* 월간 Agent SDK 크레딧에서 차감된다. Orca 는 사용자 머신의 구독·API 키 환경을 그대로 활용하므로 — 정책 결정 권한은 사용자에게 있다 — 본 문서가 Orca 측에서 따로 다루지 않는다. 다만 *비용/한도 도달* 시 stdout/stderr 에 별도 패턴이 나올 수 있어 §4.3 의 `api_retry` (`error: rate_limit` / `billing_error`) 와 함께 다룬다.

---

## 1. 기본 사용법 (`claude -p`)

`-p` (또는 `--print`) 플래그를 추가하면 비대화형으로 실행된다. 모든 [CLI 옵션](https://code.claude.com/docs/ko/cli-reference)이 `-p` 와 함께 작동한다.

```bash
claude -p "What does the auth module do?"
```

주요 동반 플래그 (원문 분류):

- `--continue` / `-c` — 마지막 대화 이어가기 (§7.1)
- `--resume <id>` / `-r` — 특정 세션 (ID 또는 이름) 이어가기 (§7.2)
- `--allowedTools` / `--disallowedTools` / `--tools` — 도구 권한·가시성 (§5)
- `--output-format` / `--input-format` — 구조화 출력 / 입력 (§3, §9)
- `--append-system-prompt` / `--append-system-prompt-file` / `--system-prompt` / `--system-prompt-file` — 시스템 프롬프트 (§6)
- `--bare` — 시작 시간 단축 (§2)

`-p` 와 함께 쓰는 모든 플래그의 정식 분류는 `docs/spec/claude/cli-reference.md` 가 SSOT. 본 문서는 *Orca 관점에서 의미가 있는 플래그* 만 다룬다 (§14 카탈로그 참조).

✅ **Orca v1 채택** — ClaudeCodeAdapter 가 매 턴 `claude -p "<text>" --output-format stream-json --verbose --include-partial-messages [--resume <id>]` 형식으로 `child_process.spawn` 한다 (`TRD.md §7.1`, `arch/backend/adapters.md §1`). 입력은 `-p` 인자로 전달하고, `cwd` 는 spawn 옵션에 둔다.

---

## 2. 베어 모드 (`--bare`)

`--bare` 를 추가하면 hooks, skills, plugins, MCP 서버, 자동 메모리, `CLAUDE.md` 자동 검색을 건너뛴다. 시작 시간 단축이 목적이며, CI/스크립트의 *재현성* 을 보장한다. 내부적으로 환경변수 `CLAUDE_CODE_SIMPLE` 을 세팅한다 (`cli-reference.md` 의 `--bare` 행).

베어 모드에서 Claude 는 **Bash, 파일 읽기, 파일 편집** 도구에만 접근한다. 추가 컨텍스트는 다음 플래그로 명시 전달한다.

| 로드할 항목 | 플래그 |
|---|---|
| 시스템 프롬프트 추가 | `--append-system-prompt`, `--append-system-prompt-file` |
| 설정 | `--settings <file-or-json>` |
| MCP 서버 | `--mcp-config <file-or-json>` |
| 사용자 정의 에이전트 | `--agents <json>` |
| 플러그인 | `--plugin-dir <path>`, `--plugin-url <url>` |

베어 모드는 OAuth/키체인 읽기를 건너뛴다. 인증은 `ANTHROPIC_API_KEY` 또는 `--settings` 의 `apiKeyHelper` 에서 가져온다. Bedrock/Vertex/Foundry 는 공급자 자격증명을 사용한다.

> 공식: `--bare` 는 SDK/스크립트 호출에 권장되며 향후 릴리스에서 `-p` 의 기본값이 될 예정이다.

⏳ **Open Question** — Phase 1 MVP 에서는 **미사용**. Orca 는 사용자 머신의 `~/.claude` 환경(로그인 토큰, 프로젝트 메모리, MCP 서버) 을 그대로 활용해야 하므로 베어 모드를 켜면 안 된다. 향후 *고정 컨텍스트* 가 필요한 자동 검증 시나리오에서 도입 검토 (PRD §11 신규 OQ 와 연결).

---

## 3. 출력 포맷 (`--output-format`)

`--output-format` 으로 응답 형식을 제어한다.

| 값 | 설명 |
|---|---|
| `text` (기본값) | 일반 텍스트 |
| `json` | 결과·세션 ID·메타데이터가 포함된 단일 JSON 객체 |
| `stream-json` | 줄 구분 JSON (NDJSON) — 실시간 스트리밍 |

`--output-format json` 응답에는 `total_cost_usd` 와 모델별 비용 분해가 포함되어, 스크립트가 호출당 지출을 추적할 수 있다.

특정 스키마 준수가 필요하면 `--output-format json` + `--json-schema <JSONSchema>` 를 사용한다. 응답은 `structured_output` 필드에 들어간다.

```bash
claude -p "Extract main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

⛔ **Orca 비적용** — 본 절은 CLI 서브프로세스 실행에만 해당한다. Orca 는 CLI 를 띄우지 않고 SDK `query()` 를 인프로세스로 호출하므로 `--output-format` 을 넘기지 않는다(`rg stream-json app/src` = 0건). 스트리밍은 `query()` 의 async iterator 로 받고 정규화는 [`arch/backend/adapters.md`](./arch/backend/adapters.md)·[`arch/backend/provider-runtime.md`](./arch/backend/provider-runtime.md) 가 정본이다. 단발 모드를 쓰지 않는 이유(첫 토큰 지연)는 그대로 유효하다.

❌ `--json-schema` 미사용 — Phase 1 은 자유 텍스트 챗 응답이 목표.

---

## 4. 응답 스트리밍 / NDJSON 이벤트 스키마

`--output-format stream-json` 을 `--verbose` 및 `--include-partial-messages` 와 함께 쓰면 생성되는 토큰을 수신한다. 각 줄은 이벤트를 나타내는 JSON 객체다.

```bash
claude -p "Explain recursion" \
  --output-format stream-json --verbose --include-partial-messages
```

### 4.1 `system/init` — 세션 메타데이터

스트림의 첫 이벤트로, 모델·도구·MCP 서버·플러그인을 보고한다. (단, `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` 이 설정된 경우 `plugin_install` 이벤트가 먼저 온다.)

| 필드 | 유형 | 설명 |
|---|---|---|
| `plugins` | 배열 | 성공적으로 로드된 플러그인 (각 `name`, `path`) |
| `plugin_errors` | 배열 | 로드 시간 오류 (각 `plugin`, `type`, `message`). 영향받는 플러그인은 강등되어 `plugins` 에서 제외. 오류 없을 때 키 생략 |
| `session_id` | 문자열 | 본 세션의 식별자 |

### 4.2 `stream_event` — 토큰 델타

`--include-partial-messages` 가 켜진 경우 `text_delta` 이벤트가 토큰 단위로 흘러나온다. jq 로 추출하는 일반 패턴:

```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

### 4.3 `system/api_retry` — 재시도 이벤트

API 요청이 재시도 가능한 오류로 실패하면 Claude Code 가 재시도 직전에 발행한다.

| 필드 | 유형 | 설명 |
|---|---|---|
| `type` | `"system"` | 메시지 유형 |
| `subtype` | `"api_retry"` | 재시도 이벤트 식별 |
| `attempt` | 정수 | 현재 시도 번호 (1부터) |
| `max_retries` | 정수 | 허용된 총 재시도 횟수 |
| `retry_delay_ms` | 정수 | 다음 시도까지 ms |
| `error_status` | 정수 또는 null | HTTP 상태 코드. 연결 오류면 `null` |
| `error` | 문자열 | `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown` 중 하나 |
| `uuid` | 문자열 | 고유 이벤트 식별자 |
| `session_id` | 문자열 | 소속 세션 |

### 4.4 `system/plugin_install` — 플러그인 설치 이벤트

`CLAUDE_CODE_SYNC_PLUGIN_INSTALL` 이 설정된 경우 첫 턴 전에 발행된다.

| 필드 | 유형 | 설명 |
|---|---|---|
| `type` | `"system"` | 메시지 유형 |
| `subtype` | `"plugin_install"` | 식별자 |
| `status` | `started` / `installed` / `failed` / `completed` | `started`·`completed` 가 전체 설치를 괄호; `installed`·`failed` 는 개별 마켓플레이스 |
| `name` | 문자열, optional | 마켓플레이스 이름 (`installed`·`failed`) |
| `error` | 문자열, optional | 실패 메시지 (`failed`) |
| `uuid` | 문자열 | 고유 이벤트 식별자 |
| `session_id` | 문자열 | 소속 세션 |

✅ **Orca v1 채택** — 위 네 이벤트 모두 ClaudeCodeAdapter 의 1차 파싱 대상이다. 다음과 같이 `ChatEvent` 로 정규화한다 (`TRD.md §6.2` 참조).

| Claude Code 이벤트 | 정규화 후 `ChatEvent.type` | 비고 |
|---|---|---|
| `system/init` | `init` | `session_id` 를 캡처하여 Renderer 로 전달 (§7) |
| `stream_event` (`text_delta`) | `assistant_delta` | UI 가 누적 표시 |
| `assistant` 완성 메시지 | `assistant_message` | 완성본으로 교체 |
| `tool_use` / `tool_result` | 동명 타입 | F3 도구 호출 표시 |
| `system/api_retry` | `error` 또는 별도 표시 | Phase 1: 사용자 알림 노출 방식 미정 |
| `system/plugin_install` | (전달하지 않음) | Phase 1: 플러그인 시스템 사용 안 함 |
| `result` | `result` | 턴 종료 신호 (TRD §5.4) |

부분 라인 처리: spawn stdout 은 chunk 경계가 임의이므로 라인 버퍼를 유지하다가 `\n` 만나면 파싱한다 (`arch/backend/adapters.md §1.5`). *Phase 3 SDK 마이그레이션 후엔 라인 버퍼 직접 처리 없이 SDK 의 SDKMessage union 으로 대체됨.*

---

## 5. 도구 자동 승인 (`--allowedTools` / `--permission-mode`)

### 5.1 `--allowedTools`

특정 도구를 권한 프롬프트 없이 허용한다.

```bash
claude -p "Run the test suite and fix any failures" \
  --allowedTools "Bash,Read,Edit"
```

[권한 규칙 구문](https://code.claude.com/docs/ko/settings#permission-rule-syntax)을 사용한다. 뒤의 ` *` 는 접두사 일치를 활성화한다.

- `Bash(git diff *)` — `git diff` 로 시작하는 모든 명령 허용. **공백이 중요하다.**
- `Bash(git diff*)` — `git diff-index` 같은 명령까지 의도치 않게 매치된다.

### 5.2 `--permission-mode` (세션 단위 베이스라인)

`cli-reference.md` 기준 6개 모드를 받는다 (`default`·`acceptEdits`·`plan`·`auto`·`dontAsk`·`bypassPermissions`).

| 모드 | 동작 |
|---|---|
| `default` | 명시되지 않을 때의 기본값. 설정 파일의 `defaultMode` 적용 |
| `acceptEdits` | 파일 쓰기를 프롬프트 없이 허용. `mkdir`·`touch`·`mv`·`cp` 등 일반 파일 시스템 명령 자동 승인. 다른 셸 명령·네트워크 요청은 여전히 `--allowedTools` 또는 `permissions.allow` 가 필요 |
| `plan` | 계획 모드 — 변경 사항을 *제안* 하고 도구는 실행하지 않음 |
| `auto` | 자동 모드 — 분류기 규칙으로 도구 호출을 자동 승인/거부 (구 `--enable-auto-mode`; 기본 분류기는 `claude auto-mode defaults`) |
| `dontAsk` | `permissions.allow` 규칙이나 [읽기 전용 명령 집합](https://code.claude.com/docs/ko/permissions#read-only-commands)에 없는 모든 항목을 *거부*. 잠긴 CI 실행용 |
| `bypassPermissions` | 모든 권한 프롬프트 우회. `--dangerously-skip-permissions` 와 동일 |

```bash
claude -p "Apply the lint fixes" --permission-mode acceptEdits
```

### 5.3 사용자 호출 skills 와의 차이

> 공식: `/commit` 같은 사용자 호출 [skills](https://code.claude.com/docs/ko/skills) 및 [기본 제공 명령](https://code.claude.com/docs/ko/commands)은 대화형 모드에서만 사용 가능하다. `-p` 모드에서는 *수행하려는 작업을 자연어로 설명* 한다.

### 5.4 도구 가시성 / 비활성화

| 플래그 | 의미 | 모델 컨텍스트 노출 |
|---|---|---|
| `--allowedTools "<list>"` | 권한 프롬프트 *없이* 허용할 도구 (패턴 매칭 가능) | O |
| `--disallowedTools "<list>"` | 모델 컨텍스트에서 *제거* — 호출 불가 | X |
| `--tools "<list>" \| "default" \| ""` | 모델이 *볼 수 있는* 기본 제공 도구의 화이트리스트. `""` 는 모두 비활성화, `"default"` 는 모두 사용 | 명시한 것만 |

`--disallowedTools` 와 `--tools` 는 모델이 *해당 도구를 인지하지도 못하게* 한다. `--allowedTools` 는 인지하되 *프롬프트 없이* 쓰게 할 뿐이다.

### 5.5 권한 우회 (`--dangerously-skip-permissions` 계열)

| 플래그 | 의미 |
|---|---|
| `--dangerously-skip-permissions` | `--permission-mode bypassPermissions` 와 동일. 모든 권한 프롬프트 건너뜀 |
| `--allow-dangerously-skip-permissions` | Shift+Tab 모드 사이클에 `bypassPermissions` 를 *옵션* 으로 추가. 시작은 다른 모드로 |

❌ **Orca v1 미사용** — 양쪽 모두 사용 안 함. 데스크톱 챗 UX 의 안전 마진을 유지한다.

### 5.6 Orca 채택 (OQ9)

⏳ **Open Question (PRD §11 OQ9 — 부분 진전)** — 도구 승인 오버레이(`canUseTool` RISKY_TOOLS 게이트, handoff 0022)와 workspace guard(PreToolUse hook·permissionMode, handoff 0075)는 **구현됨**. 미정으로 남은 것은 *기본 정책값*(사전승인 범위·`acceptEdits` 기본 여부). 원 후보(역사 보존):
1. **무지정** (현재) — 모든 도구 호출에 사용자 권한 프롬프트. UX 마찰 큼.
2. `--allowedTools "Read,Edit,Bash"` 등 *읽기·기본 편집* 만 사전 승인.
3. `--permission-mode acceptEdits` 로 편집 자동 승인, 네트워크/임의 Bash 는 프롬프트.
4. `--permission-mode dontAsk` (CI 모드) — 데스크톱 챗에는 부적합.

후보 (future work):
1. `--allowedTools "Read,Edit,Bash"` 등 *읽기·기본 편집* 만 사전 승인.
2. `--permission-mode acceptEdits` 로 편집 자동 승인, 네트워크/임의 Bash 는 프롬프트.
3. `--permission-mode dontAsk` (CI 모드) — 데스크톱 챗에는 부적합.

---

## 6. 시스템 프롬프트

| 플래그 | 효과 |
|---|---|
| `--append-system-prompt "<text>"` | Claude Code 기본 시스템 프롬프트 *유지* 후 뒤에 지침 추가 |
| `--append-system-prompt-file <path>` | 같은 효과, 파일 경로 입력 |
| `--system-prompt "<text>"` | 기본 프롬프트를 *완전히 교체* |
| `--system-prompt-file <path>` | 같은 효과, 파일 경로 입력 |

`--system-prompt` 와 `--system-prompt-file` 은 상호 배타. `--append-*` 는 위 둘 중 하나와 결합 가능.

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

자세한 옵션은 공식 [시스템 프롬프트 플래그](https://code.claude.com/docs/ko/cli-reference#system-prompt-flags) 참조.

⏳ **Open Question** — Phase 1 MVP 는 **미사용**. Orca 가 *어떤 페르소나* 의 검증 엔지니어 비서가 되어야 하는지는 Skills 단계(Phase 3+)에서 결정한다. 결정 시 본 절 갱신 + TRD §7.1 에 적용 플래그 명시.

---

## 7. 대화 계속하기 (`--continue` / `--resume`)

### 7.1 `--continue`

가장 최근 대화를 이어간다.

```bash
claude -p "Review this codebase for performance issues"
claude -p "Now focus on the database queries" --continue
```

### 7.2 `--resume <sessionId>`

특정 세션 ID 로 이어간다.

```bash
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

세션 컨텍스트는 Claude Code 가 `~/.claude/projects/<cwd>/<session-id>.jsonl` 에 보관한다.

✅ **Orca v1 채택** — `--resume <sessionId>` 를 사용한다. 동작:

1. 첫 턴: `claude -p "<text>" --output-format stream-json` (resume 없음)
2. ClaudeCodeAdapter 가 첫 `system/init` 이벤트에서 `session_id` 추출 → `ChatEvent { type: 'init', sessionId }` 로 Renderer 에 전달
3. Renderer 는 `sessionId` 변수 1개만 메모리에 보유
4. 2턴부터: `claude -p "<text>" --output-format stream-json --resume <sessionId>`

근거: `docs/etc/llm-chat-desktop-strategy.md §6.2~6.3`, `docs/TRD.md §7.1`, `docs/arch/backend/adapters.md §1`.

❌ `--continue` 미사용 — Orca 는 단일 세션 이외에 *이전 세션 자동 이어가기* 시나리오가 없다 (Phase 3 에서 명시적 세션 선택 UI 도입 예정).

### 7.3 `--fork-session` (재개 시 새 세션 ID)

`--resume` / `--continue` 와 함께 쓰면, 원본 세션을 *덮어쓰지 않고* 새 세션 ID 를 발급해 분기한다.

```bash
claude --resume <id> --fork-session -p "..."
```

❌ **Orca v1 미사용** — Phase 1 은 단일 세션. Phase 3 *"이 대화 가지고 갈래" / 분기* UI 후보 anchor.

### 7.4 `--session-id <UUID>` (호출자가 ID 지정)

`claude` 가 새 세션을 만들 때 ID 를 *호출자가 사전 지정* 한다. UUID v4 형식.

```bash
claude --session-id "550e8400-e29b-41d4-a716-446655440000" -p "..."
```

⏳ **Open Question** — Orca 가 세션 ID 를 어디서 얻을지 두 가지 선택지가 있다:

1. **현재 채택**: GUI 가 *수신* — 첫 호출은 ID 없이 spawn, `system/init` 이벤트의 `session_id` 를 받아 보유 (§7.2). 단순. 동기화 race 없음.
2. **대안**: GUI 가 *발급* — UUID v4 를 만들어 `--session-id` 로 전달, `system/init` 에서 *검증* 만. Phase 3 의 "세션 영속화·재방문" UI 에서 ID 를 사전에 알아야 할 때 매력적.

Phase 1 은 (1) 을 유지. Phase 3 진입 시 재검토 — 본 항목을 §12 Open Questions 에 등록.

### 7.5 `--name` / `-n` 과 `--no-session-persistence`

| 플래그 | 의미 |
|---|---|
| `--name <text>` / `-n` | 세션의 *표시 이름* 을 설정. `claude --resume <name>` 으로 이름으로 재개 가능. 세션 중 `/rename` 으로 변경 |
| `--no-session-persistence` | 세션을 디스크에 저장하지 않음. 재개 불가. *인쇄 모드 한정*. 환경변수 `CLAUDE_CODE_SKIP_PROMPT_HISTORY` 와 동일 효과 |

❌ **Orca v1 미사용** — Phase 1 은 *직전 한 세션* 만 다룬다. Phase 3 (세션 목록 UI) 진입 시 `--name` 검토. `--no-session-persistence` 는 *시크릿 모드* anchor 로 보관.

---

## 8. 데이터 파이프 / 빌드 통합 (참고)

stdin 으로 데이터를 흘려넣을 수 있다.

```bash
cat build-error.txt | claude -p 'concisely explain the root cause' > output.txt
```

`package.json` 에 린터로 등록한 예:

```json
{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"you are a typo linter...\""
  }
}
```

> 공식: Claude Code v2.1.128 부터 파이프된 stdin 은 10MB 로 제한된다. 초과 시 0 이 아닌 상태로 종료. 더 큰 입력은 파일에 쓰고 프롬프트에서 경로를 참조한다.

❌ **Orca v1 미사용** — 챗 UI 가 입력 채널이므로 stdin 파이프는 쓰지 않는다. ClaudeCodeAdapter 는 `-p <text>` 로만 사용자 입력을 전달한다.

---

## 9. 구조화된 출력 (`--json-schema`)

```bash
claude -p "Summarize this project" --output-format json | jq -r '.result'

claude -p "Extract function names" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}}}' \
  | jq '.structured_output'
```

❌ **Orca v1 미사용** — MVP 는 자유 텍스트 챗. 향후 Skills (Phase 3+) 에서 구조화 응답이 필요하면 본 절 재검토.

---

## 10. Agent SDK (Python / TypeScript)

CLI (`claude -p`) 외에 [Python](https://code.claude.com/docs/ko/agent-sdk/python) 및 [TypeScript](https://code.claude.com/docs/ko/agent-sdk/typescript) 패키지가 있다. 콜백 기반 도구 승인, 메시지 객체 직접 조작, 실시간 응답 스트리밍에 대한 프로그래밍 제어가 필요할 때 사용한다.

✅ **Orca v1 채택** (Phase 3 마이그레이션, 2026-05-18) — TypeScript SDK `@anthropic-ai/claude-agent-sdk` 의 `query()` 함수를 진입점으로 사용. CLI spawn (§1, §3) 의 기능은 SDK `Options` 와 1:1 대응 (예: `--resume <id>` ↔ `options.resume`, `--include-partial-messages` ↔ `options.includePartialMessages`, `--output-format stream-json` 은 SDK 의 SDKMessage union 으로 대체됨). SDK API 시그니처·`Options` 필드 명세는 [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md) 원문 미러가 단일 출처. SDKMessage → ChatEvent 매핑·내부 구현 패턴·MVP 채택 범위는 [`arch/backend/adapters.md` §1](./arch/backend/adapters.md) 참조.

Phase 3 가 사용하는 기능은 *최소* — `query()` + `options.includePartialMessages` + `options.resume` + `options.cwd`. 고급 기능 (`permissionMode` / `canUseTool` / `hooks` / `createSdkMcpServer` / custom tools / external `mcpServers` / `forkSession` / `startup()` / `AsyncIterable<SDKUserMessage>` 스트리밍 입력) 은 ⏳ Phase 4+ anchor.

---

## 11. Orca v1 채택 요약

| 영역 | Orca v1 결정 |
|---|---|
| 진입 경로 | **SDK `query()`** — `@anthropic-ai/claude-agent-sdk` (Phase 3 채택, 2026-05-18). CLI `claude -p` + `child_process.spawn` 은 폐기 예정 |
| 출력 포맷 | SDKMessage union (`SDKSystemMessage` / `SDKAssistantMessage` / `SDKPartialAssistantMessage` / `SDKResultMessage`) — CLI 의 `--output-format stream-json` 대체 |
| 토큰 스트리밍 | `options.includePartialMessages: true` — CLI 의 `--verbose --include-partial-messages` 대체 |
| 세션 재개 | `options.resume: sessionId` — CLI 의 `--resume <sessionId>` 와 1:1 대응. 2턴 이상에서 |
| 세션 ID 발급 | 첫 `SDKSystemMessage(subtype: 'init')` 의 `session_id` (수신). 사전 발급 (`options.sessionId` 또는 CLI `--session-id`) 은 OQ — §7.4 |
| 세션 분기 | `--fork-session` 미사용 — Phase 3 *대화 분기* UI anchor |
| 세션 이름 | `--name` / `-n` 미사용 — Phase 3 (세션 목록) anchor |
| 세션 저장 비활성화 | `--no-session-persistence` 미사용 — *시크릿 모드* anchor |
| 베어 모드 | 미사용 (`~/.claude` 환경 활용) |
| 도구 권한 | **OQ9 부분 진전** — 승인 오버레이(0022)·workspace guard(0075) 구현, 기본 정책값만 미정. 권한 우회(`--dangerously-skip-permissions`) 는 미사용 확정 |
| 시스템 프롬프트 | 미사용 (Skills 단계 재검토) — `--system-prompt`, `--system-prompt-file`, `--append-*` 모두 |
| 구조화 출력 | 미사용 (`--json-schema`) |
| 모델 선택 | ✅ **채택 (0010)** — SDK `options.model` per-turn 전달 (Composer ModelMenu, `SendChatMessage.modelFamily`). 미지정 시 사용자 `~/.claude` 설정 폴백 |
| 노력 수준 | ✅ **채택 (0020)** — SDK `options.effort`(low~max, 기본 high) per-turn 전달 (EffortMenu) |
| 디버그 출력 | `--debug` / `--debug-file` — Phase 1 미사용, 개발자 빌드에서 옵션화 anchor |
| 턴/비용 제한 | `--max-turns` / `--max-budget-usd` — Phase 1 미사용, Phase 3 *Skills 안전장치* 후보 |
| 작업 디렉토리 | `--add-dir` 미사용 — spawn 의 `cwd` 만 사용 |
| Hook 가시성 | SDK `options.hooks` (PreToolUse/PostToolUse/Stop/...) — Phase 4 anchor (도구 권한 정책 OQ9 결정 후) |
| Agent SDK | ✅ **채택 (Phase 3)** — TypeScript SDK `query()` + 최소 옵션 (`resume`, `includePartialMessages`, `cwd`). `arch/backend/adapters.md §1` SSOT |
| 인증 만료 감지 | SDK 가 throw 하는 에러 메시지/코드에서 `401` / `OAuth` / `expired` 패턴 매칭 (CLI 의 stdout/stderr 패턴 매칭 대체) |
| 환경변수 | HOME (`~/.claude` 자격증명), `CLAUDE_*` (필요 시). PATH 의존성 (npm 글로벌 bin) 폐기 — SDK 가 `optionalDependencies` 로 platform binary 자동 처리 |
| `cwd` | `options.cwd` 로 전달 — `app.getPath('home')` 기본. 프로젝트별 cwd 선택 UI 는 future work |

---

## 12. Open Questions (요약)

다음 항목은 본 문서가 *결정* 하지 않는다. PRD §11 의 OQ 와 미러링된다.

| ID | 항목 | 본 문서 위치 |
|---|---|---|
| **OQ9** | 도구 권한 정책 — SDK `permissionMode` / `canUseTool` / `disallowedTools` 의 MVP 기본값. (CLI 표현: `--allowedTools` / `--permission-mode` / `--bare`) | §5.6 |
| **OQ10** | 어댑터 `tool_use.name` / `tool_use.input` 정규화 — claude vs opencode 도구명 차이 해소. 후보: (a) raw 전달 + Renderer 매핑 (b) 어댑터 공통 vocabulary 정규화 (c) raw + 패턴 매칭. PRD §11 OQ10 진실 원천 — opencode 어댑터 활성화 PR 에서 결정 | (본 spec 범위 밖) |
| (신규) | 세션 ID *발급 vs 수신* — SDK `options.sessionId` / CLI `--session-id` 활용 여부 | §7.4 |
| (Skills 단계) | 시스템 프롬프트 페르소나 | §6 |
| (Phase 4+) | Agent SDK 고급 기능 — hooks / canUseTool / MCP / custom tools | §10 |

---

## 13. References

| 출처 | 용도 |
|---|---|
| `docs/spec/claude/headless.md` | 1차 원문 미러 — 프로그래밍 방식 실행. 본 문서 §0~§9 의 사실 (CLI 측면) |
| `docs/spec/claude/cli-reference.md` | 1차 원문 미러 — 전체 CLI 명령·플래그. 본 문서 §5·§7·§14 의 사실 |
| `docs/spec/claude/agent-sdk/INDEX.md` | Agent SDK 원문 미러 인덱스 (파일별 진입점) |
| `docs/spec/claude/agent-sdk/typescript.md` | `query()` / `Options` / SDKMessage 명세 단일 출처 (§10 의 사실) |
| 원격: `code.claude.com/docs/ko/headless`, `.../ko/cli-reference`, `.../ko/agent-sdk/typescript` | 위 미러들의 외부 원본 (참고용) |
| `docs/spec/AGENTS.md` | 원문 미러 디렉토리의 정책 (편집 금지·수동 동기화) |
| `docs/TRD.md` §7.1 | ClaudeCodeAdapter 외부 계약 (spec 의 적용 결과) |
| `docs/arch/backend/adapters.md` §1 | ClaudeCodeAdapter 내부 구현 + SDK 채택 범위 표 + SDKMessage→ChatEvent 매핑 |
| `docs/etc/llm-chat-desktop-strategy.md` §6 | one-shot + `--resume` 채택의 전략적 근거 (Phase 3 의 `options.resume` 도 동일 메커니즘) |
| `docs/PRD.md` §7, §11 | 백엔드 선택 결정 및 OQ |

---

## 14. Orca 관련 CLI 플래그 카탈로그 (Orca 관점 인덱스)

`cli-reference.md` 의 모든 플래그 중 *Orca 관련성이 있는 것* 만 4단계로 분류한다. 자세한 의미는 `docs/spec/claude/cli-reference.md` 가 SSOT — 본 표는 *어디를 봐야 하는지* 의 지도일 뿐이다.

> **(2026-05-18)** 본 카탈로그는 *CLI 플래그* 단위 분류이지만 Orca 는 Phase 3 부터 SDK `query()` 를 사용한다. 각 CLI 플래그는 SDK `Options` 필드와 1:1 대응 — 본 카탈로그는 *어떤 기능을 채택했는지* 의 지도로 계속 유효하다 (예: `--include-partial-messages` ↔ `options.includePartialMessages`, `--resume` ↔ `options.resume`, `--allowedTools` ↔ `options.allowedTools`). SDK 측 필드명·시그니처는 `docs/spec/claude/agent-sdk/typescript.md` 가 단일 출처.

### 14.1 ✅ Orca v1 사용 (Phase 1 MVP)

| 플래그 | 본 문서 절 |
|---|---|
| `-p` / `--print` | §1 |
| `--output-format stream-json` | §3 |
| `--verbose` (스트리밍 토큰 시) | §4 |
| `--include-partial-messages` | §4 |
| `--resume <id>` / `-r` | §7.2 |

### 14.2 ⏳ Orca 후보 (OQ / Phase 2~3 anchor)

| 플래그 | 후보 시점 | 본 문서 절 |
|---|---|---|
| `--allowedTools`, `--disallowedTools`, `--tools` | OQ9 결정 시 | §5.1, §5.4 |
| `--permission-mode acceptEdits` | OQ9 결정 시 | §5.2, §5.6 |
| `--session-id <UUID>` | 세션 ID 사전 발급 결정 시 | §7.4 |
| `--fork-session` | 대화 분기 UI | §7.3 |
| `--name <text>` / `-n` | 세션 목록 UI | §7.5 |
| `--max-turns`, `--max-budget-usd` | Skills 안전장치 | §11 |
| `--debug`, `--debug-file` | 개발자 빌드 | §11 |
| `--include-hook-events`, `--init`, `--init-only` | Hook 단계 | §11 |
| `--system-prompt-file`, `--append-system-prompt-file` | Skills 페르소나 단계 | §6 |

### 14.3 ❌ Orca v1 미사용 (의도적)

| 플래그 | 이유 | 본 문서 절 |
|---|---|---|
| `--bare` | `~/.claude` 환경 활용을 위해 | §2 |
| `--continue` / `-c` | 단일 세션 시나리오, ID 기반 재개로 충분 | §7.1 |
| `--system-prompt` (완전 교체) | Claude Code 정체성 유지 | §6 |
| `--json-schema` | 자유 텍스트 챗 | §9 |
| `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions` | 안전 마진 | §5.5 |
| `--no-session-persistence` | 영속화 가치 (재개 시 컨텍스트 복원) | §7.5 |
| `--add-dir` | spawn `cwd` 만 사용 (SDK `additionalDirectories` 는 workspace guard 0075 에서 별도 채택) | §11 |
| ~~`--model`, `--effort`~~ | **채택으로 전환** (0010/0020 — SDK options per-turn). 본 행은 역사 보존 | §11 |
| stdin 파이프 입력 | UI 가 입력 채널, `-p` 인자만 사용 | §8 |

### 14.4 ◯ Orca 무관 (CLI 자체 운영)

다음은 Claude Code CLI *자체* 의 운영용 — Orca 가 자식 프로세스로 호출하는 시나리오에서는 의미가 없다. 본 문서는 이름만 나열한다.

`claude install`, `claude update`, `claude auth login/logout/status`, `claude mcp`, `claude plugin`, `claude project purge`, `claude remote-control`, `claude setup-token`, `claude ultrareview`, `claude agents`, `claude attach`, `claude logs`, `claude stop`, `claude rm`, `claude respawn`, `claude auto-mode defaults`, `--ide`, `--chrome`, `--no-chrome`, `--teleport`, `--remote`, `--remote-control`, `--worktree`, `--tmux`, `--teammate-mode`, `--bg`, `--channels`, `--from-pr`.

이들 중 일부 (예: `claude install` 자동 설치) 는 TRD §7.1 의 *설치 탐지* 절차에서 *외부에서* 사용한다 (`npm install -g @anthropic-ai/claude-code`) — 본 카탈로그의 분류와는 무관.
