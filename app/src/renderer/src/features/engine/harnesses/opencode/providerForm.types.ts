export interface ProviderModelRow {
  row: string
  id: string
  name: string
  originalId?: string
}
export interface ProviderHeaderRow {
  row: string
  key: string
  value: string
}
export interface ProviderDraft {
  id: string
  name: string
  baseURL: string
  apiKey: string
  models: ProviderModelRow[]
  headers: ProviderHeaderRow[]
  source?: Record<string, unknown>
  originalId?: string
}
