export type ThemeColors = {
  background: string;
  surface: string;
  surfaceHigh: string;
  surfaceHighest: string;
  surfaceLowest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  primaryDim: string;
  primaryContainer: string;
  onPrimary: string;
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  tertiary: string;
  error: string;
  white: string;
  black: string;
};

/** App chrome — dark (default look). Glass/optical colours stay separate. */
export const darkColors: ThemeColors = {
  background: '#0b1326',
  surface: '#131b2e',
  surfaceHigh: '#222a3d',
  surfaceHighest: '#2d3449',
  surfaceLowest: '#060e20',
  onSurface: '#dae2fd',
  onSurfaceVariant: '#b9cacb',
  outline: '#849495',
  outlineVariant: '#3b494b',
  primary: '#00f0ff',
  primaryDim: '#00dbe9',
  primaryContainer: '#00f0ff',
  onPrimary: '#00363a',
  secondary: '#ffb4aa',
  secondaryContainer: '#c5020b',
  onSecondary: '#690003',
  tertiary: '#5df677',
  error: '#ffb4ab',
  white: '#ffffff',
  black: '#000000',
};

/** App chrome — light. Same brand accents; backgrounds/text only. */
export const lightColors: ThemeColors = {
  background: '#eef2f8',
  surface: '#ffffff',
  surfaceHigh: '#e4eaf4',
  surfaceHighest: '#d5ddeb',
  surfaceLowest: '#e2e8f2',
  onSurface: '#0b1326',
  onSurfaceVariant: '#4a5568',
  outline: '#7a8799',
  outlineVariant: '#c5cedc',
  primary: '#0095a8',
  primaryDim: '#00a8bc',
  primaryContainer: '#00f0ff',
  onPrimary: '#00363a',
  secondary: '#c43a32',
  secondaryContainer: '#ffb4aa',
  onSecondary: '#ffffff',
  tertiary: '#1a7a38',
  error: '#ba1a1a',
  white: '#ffffff',
  black: '#000000',
};

/** @deprecated Prefer useTheme().colors — kept as dark default for rare static imports. */
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;
