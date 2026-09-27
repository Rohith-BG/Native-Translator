export const darkTheme = {
  background: '#0A0A0F',
  surface: 'rgba(255,255,255,0.05)',
  surfaceElevated: 'rgba(255,255,255,0.08)',
  surfaceBorder: 'rgba(255,255,255,0.1)',
  primary: '#6C63FF',
  primaryGlow: 'rgba(108,99,255,0.3)',
  secondary: '#00D9FF',
  success: '#00E676',
  error: '#FF5252',
  warning: '#FFB74D',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.55)',
  overlay: 'rgba(10,10,15,0.72)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  control: 12,
  card: 20,
  sheet: 24,
  pill: 999,
} as const;

export const type = {
  display: 28,
  title: 22,
  heading: 18,
  body: 16,
  label: 13,
  caption: 12,
} as const;

export const motion = {
  duration: 220,
} as const;

export type Theme = typeof darkTheme;
