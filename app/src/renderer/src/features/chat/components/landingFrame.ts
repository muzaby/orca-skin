// Claude's original empty landing geometry (rem follows the app font size).
export const landingFrame = {
  root: 'flex min-h-0 min-w-0 flex-1 bg-bg',
  align: 'flex min-w-0 flex-1 items-center justify-center px-4',
  column: 'w-full max-w-[720px]',
  hero: 'mb-4 flex min-h-[calc(6.25rem+48px)] flex-col justify-end',
  // One outlined chip row: h-7 + py-1 + border; plus the stack gap and pt-3.
  contextRow: 'min-h-[calc(2.25rem+2px)]',
  openCodeComposer: 'h-[calc(9.25rem+22px)] pb-[18px] pt-[calc(3.5rem+2px)]'
} as const
