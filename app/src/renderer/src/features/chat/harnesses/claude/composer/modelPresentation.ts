import type { ModelPresentation } from '../../types'

export const modelPresentation: ModelPresentation = {
  selection: ({ provider, providerKey, modelFamily }) => {
    const left = provider ?? providerKey
    return modelFamily ? `${left}/${modelFamily}` : left
  },
  menu: ({ identity }) => identity
}
