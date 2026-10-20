// Official Mark: anomalyco/opencode v1.19.0, packages/ui/src/components/logo.tsx.
// MIT; copyright (c) 2025 opencode. See resources/OPENCODE-LICENSE.txt.
export function OpenCodeLogo({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" fill="none" aria-hidden="true" className={className}>
      <path d="M12 16H4V8H12V16Z" fill="currentColor" opacity="0.35" />
      <path d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="currentColor" />
    </svg>
  )
}
