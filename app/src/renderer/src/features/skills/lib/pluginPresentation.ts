// 기존 Plugin 이름은 외부 배포·renderer import 호환을 위한 alias다.
export { providerPresentation, resolveLocalizedProviderText } from './providerPresentation'
export type { ProviderPresentation } from './providerPresentation'

import { providerPresentation, resolveLocalizedProviderText } from './providerPresentation'

export type PluginPresentation = import('./providerPresentation').ProviderPresentation
export const resolveLocalizedPluginText = resolveLocalizedProviderText
export const pluginPresentation = providerPresentation
