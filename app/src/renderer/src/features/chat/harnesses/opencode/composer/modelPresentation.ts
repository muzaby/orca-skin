import type { ModelPresentation } from '../../types'

export const modelPresentation: ModelPresentation = {
  selection: ({ modelAlias, modelFamily, providerKey }) => modelAlias ?? modelFamily ?? providerKey,
  menu: ({ alias }) => alias
}
