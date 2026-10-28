import type { ComposerCatalogScope } from '../../../../../../../shared/composer-catalog'
import type { NativeComposerCatalog } from '../../../../../../../shared/native-resources'

// Display-only seed. Directory validation always supplies the authoritative result.
const models = new Map<string, NativeComposerCatalog['models']>()
const key = (scope: ComposerCatalogScope): string =>
  JSON.stringify([scope.backend, scope.providerKey])
export const composerModelStore = {
  clear(): void {
    models.clear()
  },
  get(scope: ComposerCatalogScope): NativeComposerCatalog['models'] | undefined {
    return models.get(key(scope))
  },
  accept(scope: ComposerCatalogScope, value: NativeComposerCatalog['models']): void {
    models.set(key(scope), value)
  }
}
