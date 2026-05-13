# Claude Code CLI 실행 스펙 (외부 공식 문서 미러 + Orca 채택 표기)

> **본 문서의 위치**
> 이 문서는 Claude Code 공식 *"프로그래밍 방식으로 실행하기"* 문서를 **저장소 로컬 미러**로 옮긴 것이다. PRD/TRD/architecture 가 Claude Code CLI 의 동작·플래그·이벤트를 인용할 때 단일 출처(SSOT) 역할을 한다.
>
> - **원문 출처**: `https://code.claude.com/docs/ko/headless` (한국어판) — Anthropic 공식 문서
> - **동기화 책임**: 원문이 갱신되면 본 미러를 사람이 수동 갱신해야 한다. 자동 동기화는 없다.
> - **편집 규칙**: 외부 사실(플래그·이벤트 스키마)은 원문을 따른다. 본 문서가 *추가* 하는 것은 **Orca v1 채택 박스** 뿐이다.
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

---

## 1. 기본 사용법 (`claude -p`)

`-p` (또는 `--print`) 플래그를 추가하면 비대화형으로 실행된다. 모든 [CLI 옵션](https://code.claude.com/docs/ko/cli-reference)이 `-p` 와 함께 작동한다.

```bash
claude -p "What does the auth module do?"
```

주요 동반 플래그:

- `--continue` — 마지막 대화 이어가기
- `--resume <sessionId>` — 특정 세션 이어가기
- `--allowedTools` — 도구 자동 승인
- `--output-format` — 구조화 출력
- `--append-system-prompt` — 시스템 프롬프트 추가

✅ **Orca v1 채택** — ClaudeCodeAdapter 가 매 턴 `claude -p "<text>" --output-format stream-json [--resume <id>]` 형식으로 `child_process.spawn` 한다 (`TRD.md §7.1`, `architecture.md §5.4`). 입력은 `-p` 인자로 전달하고, `cwd` 는 spawn 옵션에 둔다.

---

## 2. 베어 모드 (`--bare`)

`--bare` 를 추가하면 hooks, skills, plugins, MCP 서버, 자동 메모리, `CLAUDE.md` 자동 검색을 건너뛴다. 시작 시간 단축이 목적이며, CI/스크립트의 *재현성* 을 보장한다.

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

✅ **Orca v1 채택** — `stream-json` 만 사용한다. ClaudeCodeAdapter 는 stdout 을 NDJSON 으로 라인 단위 파싱하여 `ChatEvent` 로 정규화한다 (`TRD.md §6.2`, `architecture.md §5.4`). `text`/`json` 단발 모드는 첫 토큰 지연이 길어 챗 UX 와 맞지 않는다.

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

부분 라인 처리: spawn stdout 은 chunk 경계가 임의이므로 라인 버퍼를 유지하다가 `\n` 만나면 파싱한다 (`architecture.md §5.4`).

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

| 모드 | 동작 |
|---|---|
| `dontAsk` | `permissions.allow` 규칙이나 [읽기 전용 명령 집합](https://code.claude.com/docs/ko/permissions#read-only-commands)에 없는 모든 항목을 거부. 잠긴 CI 실행용 |
| `acceptEdits` | 파일 쓰기를 프롬프트 없이 허용. `mkdir`·`touch`·`mv`·`cp` 등 일반 파일 시스템 명령 자동 승인. 다른 셸 명령·네트워크 요청은 여전히 `--allowedTools` 또는 `permissions.allow` 가 필요 |

```bash
claude -p "Apply the lint fixes" --permission-mode acceptEdits
```

### 5.3 사용자 호출 skills 와의 차이

> 공식: `/commit` 같은 사용자 호출 [skills](https://code.claude.com/docs/ko/skills) 및 [기본 제공 명령](https://code.claude.com/docs/ko/commands)은 대화형 모드에서만 사용 가능하다. `-p` 모드에서는 *수행하려는 작업을 자연어로 설명* 한다.

**Phase 1 결정 (2026-05-13)**: **무지정** 으로 진행 — `--allowedTools` / `--permission-mode` 플래그 없이 CLI 기본 권한 프롬프트에 위임한다. 사전승인·`acceptEdits` 등의 후보는 future work 로 남긴다 (TRD §10 anchor). 결정 시 본 절을 갱신하고 TRD §7.1 명령 라인에 플래그를 추가한다.

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

근거: `docs/llm-chat-desktop-strategy.md §6.2~6.3`, `docs/TRD.md §7.1` (줄 282~294), `docs/architecture.md §5.4`.

❌ `--continue` 미사용 — Orca 는 단일 세션 이외에 *이전 세션 자동 이어가기* 시나리오가 없다 (Phase 3 에서 명시적 세션 선택 UI 도입 예정).

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

❌ **Orca v1 미사용** — Phase 1 은 CLI spawn + stdout NDJSON 파싱이 가장 단순하고, *어댑터 인터페이스 (TRD §7.3)* 가 opencode 백엔드와 동등하게 추상화되어 있어 SDK 도입 이득이 작다. Phase 3+ 에서 *세션 메모리 직접 조작* 또는 *툴 승인 콜백 UX* 가 필요해지면 SDK 전환 검토 anchor (TRD §10).

---

## 11. Orca v1 채택 요약

| 영역 | Orca v1 결정 |
|---|---|
| 진입 경로 | CLI (`claude -p`) — `child_process.spawn` |
| 출력 포맷 | `--output-format stream-json` (필수) |
| 토큰 스트리밍 | `--verbose --include-partial-messages` (Phase 1 적용) |
| 세션 재개 | `--resume <sessionId>` — 2턴 이상에서 |
| 세션 ID 발급 | 첫 `system/init` 이벤트의 `session_id` |
| 베어 모드 | 미사용 (`~/.claude` 환경 활용) |
| 도구 권한 | **미지정** (Phase 1) — `--allowedTools` / `--permission-mode` 미사용. CLI 기본 권한 프롬프트에 위임. 사전승인/`acceptEdits` 는 future work (TRD §10 anchor) |
| 시스템 프롬프트 | 미사용 (Skills 단계 재검토) |
| 구조화 출력 | 미사용 |
| Agent SDK | 미사용 (Phase 3+ anchor) |
| 인증 만료 감지 | stdout/stderr 의 `401` / `OAuth` / `expired` 패턴 매칭 |
| 환경변수 | PATH (npm 글로벌 bin), HOME, `CLAUDE_*` (필요 시) |
| `cwd` | `app.getPath('home')` — 사용자 홈 디렉토리. 프로젝트별 cwd 선택 UI 는 future work |

---

## 12. Open Questions (요약)

다음 항목은 본 문서가 *결정* 하지 않는다. PRD §11 의 OQ 와 미러링된다.

| ID | 항목 | 본 문서 위치 |
|---|---|---|
| **OQ9** (신규) | 도구 권한 정책 — `--allowedTools` / `--permission-mode` / `--bare` 의 MVP 기본값 | §5.3 |
| (Skills 단계) | 시스템 프롬프트 페르소나 | §6 |
| (Phase 3+) | Agent SDK 전환 트리거 | §10 |

---

## 13. References

| 출처 | 용도 |
|---|---|
| 원문: `code.claude.com/docs/ko/programmatic` | 본 문서의 1차 소스 |
| `docs/TRD.md` §7.1 | ClaudeCodeAdapter 외부 계약 (spec 의 적용 결과) |
| `docs/architecture.md` §5.4 | ClaudeCodeAdapter 내부 구현 (파서·버퍼·환경변수) |
| `docs/llm-chat-desktop-strategy.md` §6 | one-shot + `--resume` 채택의 전략적 근거 |
| `docs/PRD.md` §7, §11 | 백엔드 선택 결정 및 OQ |
