export type ThemeId = 'white' | 'dark'
export type DensityId = 'compact' | 'normal' | 'comfortable'

/** Root font-size driven density. `rem`-based Tailwind spacing cascades
 *  off this value. */
export const DENSITY_FONT: Record<DensityId, number> = {
  compact: 11.5,
  normal: 13,
  comfortable: 14.5
}
