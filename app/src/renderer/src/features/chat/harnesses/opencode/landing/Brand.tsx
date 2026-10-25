import { OpenCodeWordmark } from '../Wordmark'

export function LandingBrand({ framed = false }: { framed?: boolean }): React.JSX.Element {
  return <OpenCodeWordmark className={`h-auto w-full text-ink ${framed ? '' : 'mb-8'}`} />
}
