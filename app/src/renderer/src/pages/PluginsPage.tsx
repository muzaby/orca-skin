import { ExtensionsCatalogView } from '../features/skills'

export function PluginsPage({ builtinMcp }: { builtinMcp?: React.ReactNode }): React.JSX.Element {
  return <ExtensionsCatalogView builtinMcp={builtinMcp} />
}
