import { landingFrame } from '../../components/landingFrame'
import { chipGroupSurface } from '../common/composer/chipSurface'
import { transcriptTypography } from '../common/transcript/typography'
import type { HarnessSurfaces } from '../contracts'
export const surfaces = {
  transcriptRoot: '',
  message: `${transcriptTypography.message} text-ink`,
  directory: 'gap-g3 rounded-r7 border border-transparent bg-transparent px-1 py-1',
  pathWidth: '',
  cwd: {
    variant: 'outlined',
    chipVariant: 'segment',
    showChevron: false,
    trailingDivider: true,
    contextRow: landingFrame.contextRow,
    chipGroup: chipGroupSurface
  }
} satisfies HarnessSurfaces
