export const composerAppearance = {
  shell:
    'relative rounded-[10px] border border-oc-border bg-oc-surface text-oc-ink shadow-oc-raised',
  prompt: (): string => 'min-h-[60px] px-4 pb-2 pt-4',
  controls: 'app-frame-composer-controls flex min-h-12 items-center gap-1 px-2 pb-1 pr-12',
  controlsEnd: 'flex min-w-0 items-center gap-1',
  typography:
    'block w-full p-0 text-[13px] leading-5 font-sans whitespace-pre-wrap break-words [scrollbar-gutter:stable]',
  textarea: 'max-h-[180px] min-h-9 text-oc-ink caret-oc-ink placeholder:text-oc-muted'
}
