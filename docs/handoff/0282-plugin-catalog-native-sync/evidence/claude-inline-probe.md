# Claude local plugin `@inline:false` 실측 (2026-10-23)

판정: **SDK flag가 전달되면 CLI는 비활성 plugin의 명령·스킬을 컨텍스트에 싣지 않는다.** `/context`에 off plugin이 보이는 원인은 CLI가 아니라 Orca가 off 값을 새 Query에 전달하지 못하는 경로다(plan §4·§8).

## 조건

| 항목 | 값 |
|---|---|
| SDK / CLI | `@anthropic-ai/claude-agent-sdk` 0.3.296 / 동봉 CLI 2.1.296(linux-x64) |
| 격리 | 임시 `HOME`·`CLAUDE_CONFIG_DIR`, `settingSources: ['project','local']`(Orca와 동일) |
| 네트워크 | `ANTHROPIC_BASE_URL` = loopback. 유료 모델 호출 없음 |
| plugin | `superpowers` local root(`plugins: [{type:'local'}]`), `skills/brainstorming/SKILL.md` |
| 스크립트 | [`claude-inline-probe.mjs`](claude-inline-probe.mjs) — `node claude-inline-probe.mjs <app 경로>` |

## 결과

| 케이스 | flag settings `enabledPlugins` | `skills` 허용목록 | init·supportedCommands | `getContextUsage` Skills | `reloadPlugins` plugins |
|---|---|---|---|---|---|
| inline-true | `superpowers@inline: true` | `superpowers:brainstorming` | `superpowers:brainstorming` | `superpowers:brainstorming`(source plugin) | `superpowers` 포함 |
| inline-false | `superpowers@inline: false` | `superpowers:brainstorming` | 없음 | 카테고리 없음 | `superpowers` 없음 |
| inline-false, 허용목록 없음 | `superpowers@inline: false` | (생략) | 없음 | built-in만, `superpowers` 없음 | `superpowers` 없음 |

- 허용목록에 이름이 있어도 비활성 plugin을 강제로 싣지 않는다 — SDK 문서의 "only skills whose names match … are loaded" 필터 의미와 일치(`sdk.d.ts` `skills?: string[]`).
- marketplace 키(`superpowers@market: false`)는 세 케이스 모두 같으므로 차이는 `@inline` 값에서만 나온다.
