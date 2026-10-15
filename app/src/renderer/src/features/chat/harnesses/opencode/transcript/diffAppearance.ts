import type { DiffTableAppearance } from '../../common/transcript/DiffTable'
export const diffAppearance = {
  table:
    'text-[calc(13px*var(--transcript-text-scale,1))] leading-5 [&_pre]:text-[calc(13px*var(--transcript-text-scale,1))] [&_pre]:leading-[inherit]',
  addedRow: 'bg-oc-good-bg',
  removedRow: 'bg-oc-bad-bg',
  addedGutter: 'bg-oc-good/15',
  removedGutter: 'bg-oc-bad/15',
  muted: 'text-oc-muted',
  text: 'text-oc-ink'
} satisfies DiffTableAppearance
