// StandardConformance — 엔진을 "표준을 얼마나 구현하는가"로 기술한다(standardization.md §5.3).
// 실재하는 값과 런타임이 실제로 읽는 필드만 둔다. 새 엔진 편입은 이 구조를 채우는 일이다.
//
// 출처 신뢰 원칙: [검증]=현재 코드/SDK 1차 출처 확인, [미확인]=구현 전 SDK 타입 확정 필요.
// 두 SDK 미설치라 일부 항목은 [미확인].

import type { Backend } from '../../../shared/ipc'

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
    // provider 별 settings 를 어댑터별로 분리 관리하는가.
    perProvider: boolean
    // 런타임 주입 메커니즘. claude = SDK flag settings(Options.settings) + settingSources
    // ['project','local'] 명시(user 배제 — 0117). 리터럴 이름은 0023 당시 표기 유지(rename 은 후속).
    mechanism: 'sdk_flag_settings_default_sources' | 'native_config_file' | 'none'
  }
}

// claude 의 구체 표준 적합도.
const claudeConformance: StandardConformance = {
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
    // sources/settings 의 provider settings 를 query options.settings 로 주입하고 settingSources
    // 는 ['project','local'] 로 명시해 user 소스를 배제한다(0117 — 0023 "생략" 결정 supersede).
    // 끊기는 ~/.claude/skills 는 dist/claude/plugins/claude 래퍼 플러그인이 보전한다.
    mechanism: 'sdk_flag_settings_default_sources'
  }
}

const CONFORMANCE: Record<Backend, StandardConformance> = {
  claude: claudeConformance
}

export function conformanceOf(engine: Backend): StandardConformance {
  return CONFORMANCE[engine]
}
