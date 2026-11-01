#!/usr/bin/env bash
# §10 자리 검색 명령 재실행 — 인자: 트리 루트 (app/ 와 docs/ 를 포함)
set -u
R="$1"
cd "$R" || exit 1
G=(--glob '!*.test.*' --glob '!*.testfixture.*')
c() { # label, then command; prints count of output lines
  local label="$1"; shift
  local n
  n=$("$@" 2>/dev/null | wc -l)
  printf '%-48s %s\n' "$label" "$n"
}
echo "### tree: $R"
c "VP02 setInterval skills"            rg -n 'setInterval\(' app/src/renderer/src/features/skills
c "VP02 onExtensionsChanged"           rg -n 'onExtensionsChanged' app/src/renderer app/src/preload
c "VP03 legacy files (-l)"             rg -ln 'LegacyStorageMigration|legacy-storage-migration|legacy-resources|legacy-schema|LEGACY_SCHEMA|inspectLegacyResources' app/src
c "VP04 orphan chain (G)"              rg -n 'setNativeResource|nativePluginDirectory|SetNativeResource\b|OpenNativePlugin\b|SetNativeResourceSchema|OpenNativePluginSchema|sessionSetNativeResource|sessionOpenNativePlugin|shareNativeResource|openNativePlugin|open-native-plugin|set-native-resource|configuredPluginDirectory|configuredMcpFile|draftPluginDirectory|configuredClaudePluginDirectory|configuredClaudeMcpFile|configuredOpenCodeMcpFile' app/src "${G[@]}"
c "VP04 orphan chain (incl tests)"     rg -n 'setNativeResource|nativePluginDirectory|SetNativeResource\b|OpenNativePlugin\b|SetNativeResourceSchema|OpenNativePluginSchema|sessionSetNativeResource|sessionOpenNativePlugin|shareNativeResource|openNativePlugin|open-native-plugin|set-native-resource|configuredPluginDirectory|configuredMcpFile|draftPluginDirectory|configuredClaudePluginDirectory|configuredClaudeMcpFile|configuredOpenCodeMcpFile' app/src
c "VP04 docs"                          rg -n 'open-native-plugin|set-native-resource' docs/IPC_CONTRACT.md docs/generated/inventory.md
c "VP05 old composer assembly"         rg -n 'registerComposerCatalog\b|prepareComposerCatalog\b' app/src
c "VP06 old app files"                 bash -c 'ls app/src/main/app/{opencode-warmup,opencode-mcp-reconcile,opencode-global-watch,prepared-mcp-resources,claude-processes}.ts 2>/dev/null'
c "VP07 watchFile( main G"             rg -n '\bwatchFile\(' app/src/main "${G[@]}"
c "VP07 setInterval discovery-cache"   rg -n 'setInterval\(' app/src/main/adapters/opencode/v1/discovery-cache.ts
c "VP08 dead symbols"                  rg -n '\b(ClaudeMcp|HarnessSubmitButton|AssistantSegment|claudePlansDirectory|openCodeComposerCatalog|openCodeNativeResources|isBubbleExpanded|partsStructured|columnIndexOfTile|isRightPanelTileId|SIDEBAR_DEFAULT_WIDTH|UpdateCheckResultSchema|DEFAULT_SCHEDULER_SETTINGS|BackendStatus)\b' app/src app/scripts
c "VP08 dead symbols (!harnesses)"     rg -n '\b(ClaudeMcp|HarnessSubmitButton|AssistantSegment|claudePlansDirectory|openCodeComposerCatalog|openCodeNativeResources|isBubbleExpanded|partsStructured|columnIndexOfTile|isRightPanelTileId|SIDEBAR_DEFAULT_WIDTH|UpdateCheckResultSchema|DEFAULT_SCHEDULER_SETTINGS|BackendStatus)\b' app/src app/scripts --glob '!**/harnesses/**'
c "VP08 css tokens"                    rg -n 'oc-bubble|oc-background' app/src/renderer/src/styles/tokens.css
c "VP08 policy/prepare"                rg -n 'export const agentSessionPolicy|async prepare\(\): Promise<void>' app/src/shared/agent-session-policy.ts app/src/main/adapters/opencode/v1/mcp-control.ts
c "VP09 BOM+JSON.parse claude"         bash -c "rg -n 'uFEFF' app/src/main/adapters/claude --glob '!*.test.*' --glob '!*.testfixture.*' | grep 'JSON.parse'"
c "VP09 BOM any main (G)"              rg -n 'uFEFF' app/src/main "${G[@]}"
c "VP09 git join main/adapters"        rg -n "join\(current, '.git'\)" app/src/main/adapters "${G[@]}"
c "VP09 git join main all"             rg -n "'\.git'" app/src/main "${G[@]}"
c "VP09 flag rule"                     rg -n '=== true \|\| Array\.isArray\(' app/src/main "${G[@]}"
c "VP09 spec rule"                     rg -n "typeof (entry|source) === 'string' \? (entry|source) : (entry|source)\[0\]" app/src/main/adapters
c "VP09 re-export/alias"               rg -n "export \{ pluginPathKey|const pathKey = pluginPathKey" app/src/main/adapters/claude
c "VP10 body cancel session-context"   rg -n 'response.body\?\.cancel\(\)' app/src/main/adapters/opencode/v1/session-context.ts
c "VP10 sourceId === adapter"          rg -n 'plugin.identity.sourceId ===' app/src/main/adapters/opencode/v1/adapter.ts
c "VP10 dispose.failed"                rg -n "opencode.instance.dispose.failed" app/src/main "${G[@]}"
c "VP10 'directory', bootstrap"        rg -n "'directory'," app/src/main/app/bootstrap.ts app/src/main/app/native-resource-sharing.ts
c "VP10 project_id guard"              rg -n 'current.project_id !== session.project_id' app/src/main/app "${G[@]}"
c "VP10 sameSessionBinding"            rg -n 'sameSessionBinding' app/src/main "${G[@]}"
c "VP11 sync fs plugin-catalog"        rg -n 'readFileSync|readdirSync|statSync' app/src/main/adapters/claude/plugin-catalog.ts
c "VP12 <ClaudeLogo|<OpenCodeLogo"     rg -n '<ClaudeLogo|<OpenCodeLogo' app/src/renderer/src "${G[@]}"
c "VP12 label ternary"                 rg -n "=== 'opencode' \? 'OpenCode' : 'Claude'|=== 'claude' \? 'Claude' :" app/src "${G[@]}"
c "VP12 shim/PlanTile files"           bash -c 'ls app/src/renderer/src/features/chat/harnesses/{claude,opencode}/Logo.tsx app/src/renderer/src/features/chat/harnesses/registries/brand.tsx app/src/renderer/src/features/chat/harnesses/{claude,opencode}/rightpanel/PlanTile.tsx 2>/dev/null'
c "VP13 CwdPanel openCode branch"      rg -n 'openCode \?|openCode &&|!openCode|harnessSurfaces\(openCode\)' app/src/renderer/src/features/chat/components/CwdPanel.tsx
c "VP13 openCodeLanding (G)"           rg -n 'openCodeLanding' app/src/renderer/src "${G[@]}"
c "VP13 store/reducer literal"         rg -n "backend === 'opencode'|landingBackend === 'opencode'|backend === 'claude'" app/src/renderer/src/features/chat/store/chatStore.ts app/src/renderer/src/features/chat/reducer/chatReducer.ts
c "VP14 capture() ScrollController"    rg -n 'capture\(\)' app/src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx
c "VP15 prepare count (-c)"            bash -c "rg -o '\.prepare\(' app/src/main/infra/db/native-history-queries.ts"
c "VP18 canonical( main"               rg -n "function canonical(ize)?\(" app/src/main
c "VP18 canonicalJson def"             rg -n "function canonicalJson" app/src
c "VP18 disabled variant"              rg -n "disabled (===|!==) true" app/src/main/adapters/opencode "${G[@]}"
c "VP18 isRecord def"                  rg -n "function isRecord" app/src "${G[@]}"
c "VP18 execFile(executable (count)"   bash -c "rg -U --count-matches 'execFile\(\s*executable' app/src/main/adapters/opencode/v1/server.ts | head -1 | xargs -I{} sh -c 'seq 1 {}'"
c "VP18 optional guards"               rg -n "if \(!this\.servers\.listModels\)|servers\.retireAll\?\.\(" app/src/main/adapters/opencode/v1/adapter.ts
c "VP18 .message ?? null"              rg -n "\.message \?\? null" app/src/main/app "${G[@]}"
c "VP18 connections.has(authId)"       rg -n "connections\.has\(authId\)" app/src/main/features/auth/runtime.ts
c "VP18 deps.connection ??"            rg -n "deps\.connection \?\?" app/src/main/features/auth/login-free.ts
c "VP18 orcaGroupFirst"                rg -n "orcaGroupFirst" app/src/renderer/src "${G[@]}"
c "EP08#29 docs moved paths"           rg -n 'opencode-warmup|opencode-mcp-reconcile|opencode-global-watch|prepared-mcp-resources|claude-processes' docs/arch docs/INDEX.md
