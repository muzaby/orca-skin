import { Icon } from './Icon'

export function ArcSpinner(): React.JSX.Element {
  return (
    <Icon name="spinner" size={12} className="text-ink3 animate-spin motion-reduce:animate-none" />
  )
}
