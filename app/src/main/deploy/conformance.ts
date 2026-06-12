// StandardConformance — 엔진을 "표준을 얼마나 구현하는가"로 기술한다(standardization.md §5.3).
// 실재하는 값과 런타임이 실제로 읽는 필드만 둔다. 새 엔진 편입은 이 구조를 채우는 일이다.
//
// 출처 신뢰 원칙: [검증]=현재 코드/SDK 1차 출처 확인, [미확인]=구현 전 SDK 타입 확정 필요.
// 두 SDK 미설치라 일부 항목은 [미확인].

import type { Backend } from '../../shared/ipc'

export interface StandardConformance {
  instructions: {
    agentsMd: 'native' | 'manual_import'
    mergePolicy: 'nearest_wins' | 'layered_memory'
  }
  tool: {
    mcp: 'native' | 'none'
    transports: ('stdio' | 'streamable_http')[]
    mcpSpecVersion: string // 스펙이 날짜 버전을 가지며 깨지는 변경이 있음
    configFormat: string // 렌더 타깃(런타임 주입 방식 포함)
  }
  skill: {
    skillMd: 'native' | 'none'
    compatibilityPaths?: string[]
  }
  hook: {
    standardized: false // 항상 false (§2 — cross-tool 표준 부재)
    executionModel: 'shell_exitcode' | 'inprocess_throw' | 'config_matcher'
  }
  settings: {
    // provider 별 settings 파일을 dist/<engine>/<provider>/ 로 분리 배포하는가 (handoff 0014).
    perProvider: boolean
    // 런타임 주입 메커니즘. claude = provider settings 를 cwd .claude/settings.local.json 으로 복사.
    mechanism: 'cwd_settings_local_file' | 'native_config_file' | 'none'
  }
}

// claude-code 의 구체 표준 적합도.
const claudeCodeConformance: StandardConformance = {
  instructions: {
    // claude 는 현재 AGENTS.md 를 네이티브로 읽지 않고 CLAUDE.md 를 읽는다 → manual_import.
    // Orca 는 instructions 를 systemPromptAppend(런타임)로 주입하므로 AGENTS.md SSOT 는
    // 사람이 편집하는 원천이되 엔진 직접 읽기는 [미확인]. (standardization.md §5.4)
    agentsMd: 'manual_import',
    mergePolicy: 'nearest_wins'
  },
  tool: {
    mcp: 'native',
    transports: ['stdio', 'streamable_http'],
    mcpSpecVersion: '2025-06-18', // [미확인] — 설치 후 SDK 가 따르는 스펙 날짜로 확정
    // claude 는 MCP 를 파일이 아니라 SDK query() options.mcpServers 로 런타임 주입한다.
    configFormat: 'claude_sdk_query_options'
  },
  skill: {
    skillMd: 'native',
    compatibilityPaths: ['.claude/skills']
  },
  hook: {
    standardized: false,
    executionModel: 'inprocess_throw' // SDK in-process canUseTool/hook 콜백
  },
  settings: {
    perProvider: true,
    // sources settings.json 원본을 query cwd 의 .claude/settings.local.json 으로 복사하고,
    // options.settings/settingSources/provider env 는 query 옵션에 주입하지 않는다.
    mechanism: 'cwd_settings_local_file'
  }
}

const CONFORMANCE: Record<Backend, StandardConformance> = {
  'claude-code': claudeCodeConformance
}

export function conformanceOf(engine: Backend): StandardConformance {
  return CONFORMANCE[engine]
}
