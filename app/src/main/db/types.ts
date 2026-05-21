// Row shapes that mirror the SQL schema (snake_case) plus insert DTOs that the
// rest of main code consumes (camelCase). Kept narrow on purpose — wide row
// types would leak into renderer via IPC and force a second mapping anyway.

import type { Backend } from '../../shared/ipc'

export type MessageRole = 'user' | 'assistant'
export type ToolCallStatus = 'pending' | 'ok' | 'error' | 'cancelled'

export interface SessionRow {
  id: string
  backend: Backend
  title: string | null
  created_at: number
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
}

export interface SessionListRow {
  id: string
  backend: Backend
  title: string | null
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
}

export interface ProjectRow {
  id: string
  name: string
  instructions: string
  created_at: number
  updated_at: number
}

export interface ProjectInsert {
  id: string
  name: string
  instructions: string
  createdAt: number
}

export interface MessageRow {
  id: number
  session_id: string
  role: MessageRole
  content: string
  created_at: number
  idx: number
}

export interface ToolCallRow {
  id: number
  message_id: number
  tool_use_id: string
  name: string
  input_json: string
  result_json: string | null
  status: ToolCallStatus
}

export interface SessionInsert {
  id: string
  backend: Backend
  title: string | null
  projectId: string | null
  createdAt: number
}

export interface MessageInsert {
  sessionId: string
  role: MessageRole
  content: string
  createdAt: number
}

export interface ToolCallInsert {
  messageId: number
  toolUseId: string
  name: string
  inputJson: string
}
