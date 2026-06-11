/**
 * Background themes for creator public pages (twiinn.ai/@handle).
 * Shared by the editor (swatches) and the public page (rendering).
 */

export interface PublicTheme {
  key: string;
  label: string;
  /** CSS background value */
  background: string;
  /** Dark themes flip text/card colors on the public page */
  dark: boolean;
}

export const PUBLIC_THEMES: Record<string, PublicTheme> = {
  clean: {
    key: 'clean',
    label: 'Clean',
    background: '#F8FAFC',
    dark: false,
  },
  lavender: {
    key: 'lavender',
    label: 'Lavender',
    background: 'linear-gradient(170deg, #F3EDFF 0%, #FAF7FF 45%, #F8FAFC 100%)',
    dark: false,
  },
  sunset: {
    key: 'sunset',
    label: 'Sunset',
    background: 'linear-gradient(170deg, #FFEDE8 0%, #FFF0F6 50%, #F8FAFC 100%)',
    dark: false,
  },
  ocean: {
    key: 'ocean',
    label: 'Ocean',
    background: 'linear-gradient(170deg, #E6F7FF 0%, #F0F9FF 50%, #F8FAFC 100%)',
    dark: false,
  },
  mint: {
    key: 'mint',
    label: 'Mint',
    background: 'linear-gradient(170deg, #E9FBEF 0%, #F3FDF6 50%, #F8FAFC 100%)',
    dark: false,
  },
  midnight: {
    key: 'midnight',
    label: 'Midnight',
    background: 'linear-gradient(180deg, #0F0F23 0%, #1A1A3E 100%)',
    dark: true,
  },
  royal: {
    key: 'royal',
    label: 'Royal',
    background: 'linear-gradient(180deg, #1E1145 0%, #0F0F23 85%)',
    dark: true,
  },
  noir: {
    key: 'noir',
    label: 'Noir',
    background: '#0A0A14',
    dark: true,
  },
};

export const THEME_KEYS = Object.keys(PUBLIC_THEMES) as [string, ...string[]];

export const DEFAULT_THEME = PUBLIC_THEMES.clean;

export function getTheme(key: string | null | undefined): PublicTheme {
  return (key && PUBLIC_THEMES[key]) || DEFAULT_THEME;
}
