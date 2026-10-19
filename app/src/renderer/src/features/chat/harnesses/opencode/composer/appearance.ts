export const composerAppearance = {
  shell:
    'group/oc-composer relative min-h-[96px] rounded-[12px] bg-oc-composer text-oc-ink shadow-oc-raised',
  prompt: (): string => 'min-h-[60px] px-[16px] pb-[8px] pt-[16px]',
  controls:
    'app-frame-composer-controls flex h-[44px] min-w-0 items-center gap-[4px] px-[8px] pr-[48px]',
  controlsEnd: 'flex h-full w-max min-w-full items-center gap-[4px]',
  typography:
    'block w-full p-0 text-[13px] font-[440] leading-[20px] font-sans whitespace-pre-wrap break-words [scrollbar-gutter:stable]',
  textarea: 'max-h-[156px] min-h-[36px] text-oc-ink caret-oc-ink placeholder:text-oc-faint'
}
