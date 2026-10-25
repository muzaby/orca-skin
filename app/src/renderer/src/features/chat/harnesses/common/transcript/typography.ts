import { MARKDOWN_TYPOGRAPHY } from '../../../../../shared/ui/markdown/typography'

// Shared body typography; harnesses supply their own colours and bubble geometry.
export const transcriptTypography = {
  userBubble: 'text-body',
  pendingBubble: 'text-body italic',
  message: 'leading-[1.7]',
  prose: MARKDOWN_TYPOGRAPHY
} as const
