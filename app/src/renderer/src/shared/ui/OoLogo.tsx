import logo from '../../../../../resources/logo.png'
import { PRODUCT_DISPLAY_NAME } from '../../../../shared/product'

// logo.png is a square application-icon canvas. The visible mark occupies the
// centered 1023 x 776 region, so the wrapper clips that transparent padding
// while preserving the public height-based sizing contract.
export function OrcaLogo({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <span
      className={`relative inline-block aspect-[1023/776] overflow-hidden align-middle ${className}`}
      role="img"
      aria-label={PRODUCT_DISPLAY_NAME}
    >
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="pointer-events-none absolute left-[-11.29%] top-[-30.80%] h-[161.60%] w-auto max-w-none select-none [image-rendering:auto]"
      />
    </span>
  )
}
