// Adapted from OpenCode icons/catalog.ts (MIT; resources/OPENCODE-LICENSE.txt).
const glyphs = {
  'outline-square-arrow': {
    viewBox: '0 0 16 16',
    body: (
      <path
        d="M13.5555 6.66656V2.44434H9.33326M13.5555 2.44434L7.99993 7.99989M13.5555 9.33324V13.5555H2.44438V2.44435H6.66661"
        stroke="currentColor"
      />
    )
  },
  plus: {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path d="M8 2.88867V13.1109" stroke="currentColor" strokeLinejoin="round" />
        <path d="M2.88867 8H13.1109" stroke="currentColor" strokeLinejoin="round" />
      </>
    )
  },
  'chevron-down': {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path d="M5 6.5L8 9.5L11 6.5" stroke="currentColor" />
      </>
    )
  },
  check: {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path d="M3.53613 8.17857L6.39328 11.75L12.4647 4.25" stroke="currentColor" />
      </>
    )
  },
  folder: {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          d="M1.33337 2V13.3333H14.6667V4H8.66671L6.66671 2H1.33337Z"
          stroke="currentColor"
          strokeMiterlimit="10"
          strokeLinecap="square"
        />
      </>
    )
  },
  edit: {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          d="M13.5556 8.21529V13.5556H2.44446L2.44446 2.44445H7.78474M6.00002 8.16216V10H7.83786L14 3.83784L12.1622 2L6.00002 8.16216Z"
          stroke="currentColor"
        />
      </>
    )
  },
  globe: {
    viewBox: '0 0 16 16',
    body: (
      <>
        <circle cx="8" cy="8" r="6" stroke="currentColor" />
        <ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="currentColor" />
        <path d="M2 8h12" stroke="currentColor" />
      </>
    )
  },
  'magnifying-glass': {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          d="M14 14L10.3454 10.3454M6.88889 11.7778C9.58889 11.7778 11.7778 9.58889 11.7778 6.88889C11.7778 4.18889 9.58889 2 6.88889 2C4.18889 2 2 4.18889 2 6.88889C2 9.58889 4.18889 11.7778 6.88889 11.7778Z"
          stroke="currentColor"
        />
      </>
    )
  },
  'code-slash': {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.0812 2.10803L6.55974 14.0809L5.92016 13.8928L9.44161 1.91992L10.0812 2.10803ZM4.13793 4.97275L1.44666 8.00045L4.13793 11.0281L3.63966 11.471L0.554688 8.00045L3.63966 4.52984L4.13793 4.97275ZM12.3617 4.52984L15.4467 8.00045L12.3617 11.471L11.8634 11.0281L14.5547 8.00045L11.8634 4.97275L12.3617 4.52984Z"
          fill="currentColor"
        />
      </>
    )
  },
  'circle-exclamation': {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path d="M8.75 11.75H7.25V10.25H8.75V11.75Z" fill="currentColor" />
        <path d="M8.75 9.25H7.25V4.25H8.75V9.25Z" fill="currentColor" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 1C9.93286 1 11.684 1.7836 12.9502 3.0498C14.2164 4.31601 15 6.06714 15 8C15 11.866 11.866 15 8 15C6.06714 15 4.31601 14.2164 3.0498 12.9502C1.7836 11.684 1 9.93286 1 8C1 4.13401 4.13401 1 8 1ZM8 2C4.68629 2 2 4.68629 2 8C2 9.65699 2.67148 11.1559 3.75781 12.2422C4.84415 13.3285 6.34301 14 8 14C11.3137 14 14 11.3137 14 8C14 6.34301 13.3285 4.84415 12.2422 3.75781C11.1559 2.67148 9.65699 2 8 2Z"
          fill="currentColor"
        />
      </>
    )
  },
  'outline-copy': {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          d="M4.14908 11.0081H1.76282V1.51758H9.1038V2.55588M14.2225 4.99681H6.75397V14.4873H14.2225V4.99681Z"
          stroke="currentColor"
        />
      </>
    )
  },
  'outline-arrow-left': {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          d="M2.44442 7.99999H13.5555M6.22221 4.22222L2.44442 7.99999L6.22221 11.7778"
          stroke="currentColor"
        />
      </>
    )
  },
  help: {
    viewBox: '0 0 16 16',
    body: (
      <>
        <path
          d="M6.33345 6.33349V5.00015H9.66679V7.00015L8.00015 8.00015V9.66679M8.27485 11.6819H7.71897M14.4446 8.00011C14.4446 11.5593 11.5593 14.4446 8.00011 14.4446C4.44094 14.4446 1.55566 11.5593 1.55566 8.00011C1.55566 4.44094 4.44094 1.55566 8.00011 1.55566C11.5593 1.55566 14.4446 4.44094 14.4446 8.00011Z"
          stroke="currentColor"
          strokeLinecap="square"
        />
      </>
    )
  }
} as const
export type OpenCodeIconName = keyof typeof glyphs
export function OpenCodeIcon({
  name,
  size = 16,
  className = ''
}: {
  name: OpenCodeIconName
  size?: number
  className?: string
}): React.JSX.Element {
  const glyph = glyphs[name]
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={glyph.viewBox}
      fill="none"
      className={`shrink-0 ${className}`}
    >
      {glyph.body}
    </svg>
  )
}
