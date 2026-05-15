import type { OrcaApi } from './index'

declare global {
  interface Window {
    orca: OrcaApi
  }
}
