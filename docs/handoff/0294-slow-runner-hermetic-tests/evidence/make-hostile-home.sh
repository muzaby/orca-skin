#!/usr/bin/env bash
# 프로덕션 호스트 모사: claude/opencode/orca 설정이 채워진 HOME 을 만든다 (읽기 전용 실험용).
set -euo pipefail
H="$1"; APP="$2"
rm -rf "$H"; mkdir -p "$H"
w(){ mkdir -p "$(dirname "$1")"; cat > "$1"; }
# --- Claude ---
w "$H/.claude/settings.json" <<'J'
{"model":"opus","env":{"ANTHROPIC_BASE_URL":"https://llm.corp.example","ANTHROPIC_MODEL":"corp-model","CLAUDE_CODE_MAX_OUTPUT_TOKENS":"64000"},
 "permissions":{"allow":["Bash(*)","Read(*)"],"deny":["WebFetch"],"defaultMode":"acceptEdits"},
 "enabledPlugins":{"corp-tools@corp-market":true,"corp-off@corp-market":false},
 "outputStyle":"Explanatory","alwaysThinkingEnabled":true,"effortLevel":"high",
 "hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"echo corp"}]}]},
 "statusLine":{"type":"command","command":"echo corp"},"apiKeyHelper":"echo sk-corp-helper"}
J
w "$H/.claude.json" <<J
{"oauthAccount":{"emailAddress":"user@corp.example","organizationName":"Corp"},
 "mcpServers":{"corp-mcp":{"type":"stdio","command":"corp-mcp","args":[]},"corp-http":{"type":"http","url":"https://mcp.corp.example"}},
 "projects":{"$APP":{"mcpServers":{"proj-mcp":{"type":"stdio","command":"proj"}},"disabledMcpServers":[]},"$(dirname "$APP")":{"mcpServers":{"root-mcp":{"type":"stdio","command":"root"}}}}}
J
w "$H/.claude/skills/corp-skill/SKILL.md" <<'J'
---
name: corp-skill
description: Corp internal skill
---
corp
J
w "$H/.claude/agents/corp-agent.md" <<'J'
---
name: corp-agent
description: corp agent
---
x
J
w "$H/.claude/commands/corp-cmd.md" <<'J'
corp command
J
w "$H/.claude/output-styles/corp.md" <<'J'
---
name: Corp
description: corp style
---
x
J
w "$H/.claude/CLAUDE.md" <<'J'
# Corp memory
J
P="$H/.claude/plugins/cache/corp-market/corp-tools/1.0.0"
w "$P/.claude-plugin/plugin.json" <<'J'
{"name":"corp-tools","version":"1.0.0","description":"corp"}
J
w "$P/skills/corp-plugin-skill/SKILL.md" <<'J'
---
name: corp-plugin-skill
description: from plugin
---
x
J
w "$P/.mcp.json" <<'J'
{"mcpServers":{"corp-plugin-mcp":{"command":"corp-plugin-mcp"}}}
J
w "$H/.claude/plugins/installed_plugins.json" <<J
{"version":2,"plugins":{"corp-tools@corp-market":[{"scope":"user","installPath":"$P","version":"1.0.0"}]}}
J
w "$H/.claude/plugins/known_marketplaces.json" <<J
{"corp-market":{"source":{"source":"git","url":"https://git.corp.example/market.git"},"installLocation":"$H/.claude/plugins/marketplaces/corp-market"}}
J
mkdir -p "$H/.claude/projects" "$H/.claude/plans"
# --- OpenCode ---
w "$H/.config/opencode/opencode.json" <<'J'
{"$schema":"https://opencode.ai/config.json","model":"corp/corp-model","small_model":"corp/corp-small",
 "provider":{"corp":{"npm":"@ai-sdk/openai-compatible","name":"Corp","options":{"baseURL":"https://llm.corp.example/v1"},"models":{"corp-model":{"name":"Corp Model"},"corp-small":{}}}},
 "plugin":["corp-opencode-plugin@1.0.0"],
 "mcp":{"corp-oc-mcp":{"type":"local","command":["corp-mcp"],"enabled":true},"corp-oc-off":{"type":"remote","url":"https://mcp.corp.example","enabled":false}},
 "agent":{"corp":{"description":"corp agent","model":"corp/corp-model"}},
 "instructions":["CORP.md"],"permission":{"edit":"allow","bash":"allow"},"share":"disabled","autoupdate":false}
J
w "$H/.config/opencode/skills/corp-oc-skill/SKILL.md" <<'J'
---
name: corp-oc-skill
description: corp opencode skill
---
x
J
w "$H/.config/opencode/agent/corp.md" <<'J'
---
description: corp
---
x
J
w "$H/.config/opencode/plugin/corp.ts" <<'J'
export const Corp = async () => ({})
J
w "$H/.cache/opencode/packages/corp-opencode-plugin@1.0.0/node_modules/corp-opencode-plugin/package.json" <<'J'
{"name":"corp-opencode-plugin","version":"1.0.0","description":"corp plugin"}
J
w "$H/.local/share/opencode/auth.json" <<'J'
{"corp":{"type":"api","key":"sk-corp"},"anthropic":{"type":"oauth","refresh":"r","access":"a","expires":4102444800000}}
J
# --- agents skills ---
w "$H/.agents/skills/corp-agents-skill/SKILL.md" <<'J'
---
name: corp-agents-skill
description: agents skill
---
x
J
# --- Orca config (사용자가 만든 모델 공급자) ---
w "$H/.config/orcinus-orca/sources/settings/claude/corp/settings.json" <<'J'
{"env":{"ANTHROPIC_BASE_URL":"https://llm.corp.example","ANTHROPIC_MODEL":"corp-model"},"model":"corp-model"}
J
w "$H/.config/orcinus-orca/sources/settings/opencode/corp/settings.json" <<'J'
{"model":"corp/corp-model"}
J
w "$H/.config/orcinus-orca/orcinus-orca.json" <<'J'
{"env":{"CORP_FLAG":"1"}}
J
echo "hostile home ready: $H"
