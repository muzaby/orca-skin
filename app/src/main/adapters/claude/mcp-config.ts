import type { OrcaMcpConfig, OrcaMcpServer } from '../common/mcp-config'

// Orca's persisted source already adopts the Claude mcpServers schema.
export type ClaudeMcpConfig = OrcaMcpConfig
export type ClaudeMcp = OrcaMcpServer
