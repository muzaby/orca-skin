import { transcriptTypography } from '../common/transcript/typography'
import type { HarnessSurfaces } from '../contracts'
export const surfaces = {
  transcriptRoot: 'text-oc-ink',
  message: `${transcriptTypography.message} text-oc-ink`,
  directory: 'justify-center gap-[4px] text-oc-muted',
  pathWidth: 'max-w-[203px]',
  cwd: {
    variant: 'flat',
    chipVariant: 'flat',
    showChevron: true,
    trailingDivider: false,
    contextRow: '',
    chipGroup: 'inline-flex h-7 max-w-full items-center'
  }
} satisfies HarnessSurfaces
