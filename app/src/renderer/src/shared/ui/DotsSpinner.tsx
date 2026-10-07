export function DotsSpinner({ size }: { size: 14 | 20 }): React.JSX.Element {
  const dot = `${size === 20 ? 'h-1 w-1' : 'h-[3px] w-[3px]'} rounded-full bg-current animate-dot-wave motion-reduce:animate-none`
  return (
    <span
      aria-hidden="true"
      data-spinner="dots"
      className={`inline-flex items-center justify-center ${size === 20 ? 'h-5 w-5 gap-[2px]' : 'h-[14px] w-[14px] gap-[1.5px]'}`}
    >
      <span className={`${dot} [animation-delay:0ms]`} />
      <span className={`${dot} [animation-delay:160ms]`} />
      <span className={`${dot} [animation-delay:320ms]`} />
    </span>
  )
}
