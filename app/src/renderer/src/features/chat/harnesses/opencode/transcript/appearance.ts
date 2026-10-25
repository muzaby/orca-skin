import { transcriptTypography } from '../../common/transcript/typography'
export const transcriptAppearance = {
  userWidth: 'max-w-[min(82%,64ch)]',
  userBubble: `rounded-[10px] bg-bubble-user px-[12px] py-[8px] ${transcriptTypography.userBubble} text-ink`,
  pendingBubble: `rounded-[8px] bg-oc-layer-2 px-[12px] py-[8px] ${transcriptTypography.pendingBubble} text-oc-ink`,
  meta: 'text-oc-muted opacity-0 transition-opacity duration-200 group-hover/msg:opacity-100 focus-within:opacity-100'
}
