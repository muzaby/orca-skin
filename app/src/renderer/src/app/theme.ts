export type ThemeId = 'classic' | 'dark' | 'cool'
export type DensityId = 'compact' | 'normal' | 'comfortable'

export interface Palette {
  bg: string
  sidebar: string
  panel: string
  border: string
  borderStrong: string
  ink: string
  ink2: string
  ink3: string
  rust: string
  rustSoft: string
}

export const THEME_PALETTES: Record<ThemeId, Palette> = {
  classic: {
    bg: '#fbf9f4',
    sidebar: '#f3eee3',
    panel: '#ffffff',
    border: '#ebe3d0',
    borderStrong: '#ddd2b6',
    ink: '#29261b',
    ink2: '#6b6452',
    ink3: '#a8a092',
    rust: '#c96442',
    rustSoft: '#f4dcc9'
  },
  dark: {
    bg: '#1c1a16',
    sidebar: '#231f1a',
    panel: '#2a2620',
    border: '#3a342a',
    borderStrong: '#4a4234',
    ink: '#f0eadd',
    ink2: '#a8a092',
    ink3: '#6b6452',
    rust: '#e07855',
    rustSoft: '#4a2214'
  },
  cool: {
    bg: '#f8fafc',
    sidebar: '#f1f5f9',
    panel: '#ffffff',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    ink: '#0f172a',
    ink2: '#475569',
    ink3: '#94a3b8',
    rust: '#2563eb',
    rustSoft: '#dbeafe'
  }
}

export const DENSITY_FONT: Record<DensityId, number> = {
  compact: 11.5,
  normal: 13,
  comfortable: 14.5
}

/** Mutable palette object — child components read from this and the App
 *  shell mutates it on theme change, then bumps a `themeKey` to remount
 *  the tree so cached inline-style colours pick up the new palette. */
export const V1: Palette = { ...THEME_PALETTES.classic }
