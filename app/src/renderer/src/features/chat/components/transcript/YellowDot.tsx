// Agentic-turn marker — the small yellow dot the Claude Code desktop UI
// places left of assistant turns that ran tools (and of approval cards).
// 6px dot, vertically centered inside a 20px grid so it aligns with the
// first line of text. Decorative → aria-hidden.
export function YellowDot({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`grid h-[20px] w-[6px] shrink-0 place-items-center ${className}`}
    >
      <span className="size-[6px] rounded-full bg-extended-yellow" />
    </span>
  )
}
