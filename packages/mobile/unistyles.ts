import { StyleSheet } from 'react-native-unistyles'

const lightTheme = {
  colors: {
    background: '#ffffff',
    foreground: '#f5f5f5',
    typography: '#1a1a1a',
    tint: '#007aff',
  },
  gap: (v: number) => v * 8,
} as const

const darkTheme = {
  colors: {
    background: '#1a1a1a',
    foreground: '#2a2a2a',
    typography: '#ffffff',
    tint: '#0a84ff',
  },
  gap: (v: number) => v * 8,
} as const

const breakpoints = {
  xs: 0,
  sm: 300,
  md: 500,
  lg: 800,
} as const

type AppThemes = {
  light: typeof lightTheme
  dark: typeof darkTheme
}

type AppBreakpoints = typeof breakpoints

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  settings: {
    adaptiveThemes: true,
  },
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints,
})
