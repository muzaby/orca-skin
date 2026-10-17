export const composerAppearance = {
  shell: 'contents',
  prompt: (dragging: boolean): string =>
    `epitaxy-prompt rounded-r7 border bg-panel px-3 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-colors ${dragging ? 'border-accent ring-2 ring-accent/40' : 'border-border'}`,
  controls: 'app-frame-composer-controls flex items-center gap-1.5 px-1',
  controlsEnd: 'ml-auto flex items-center gap-g4',
  typography:
    'block w-full px-1 py-1.5 text-[13px] leading-[1.6] font-sans whitespace-pre-wrap break-words [scrollbar-gutter:stable]',
  textarea: 'max-h-56 min-h-9 text-ink caret-ink placeholder:text-ink3'
}
