import type { OoApi } from './index'

declare global {
  interface Window {
    oo: OoApi
  }
}
