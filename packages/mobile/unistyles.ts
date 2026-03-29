import { StyleSheet } from "react-native-unistyles";

/**
 * Kaartje Design Tokens (Mobile)
 *
 * Aligned with the web design system.
 * Dark, minimal palette inspired by postcards.
 */

export const theme = {
  colors: {
    // Backgrounds
    night: "#0a0a0c",
    surface: "#141418",
    elevated: "#1e1e24",

    // Borders
    border: "#2a2a32",
    borderSubtle: "#1e1e24",

    // Ink (text)
    ink: "#ede6db",
    inkFaded: "#9b9489",
    inkLight: "#6b655c",

    // Accents
    stamp: "#c45a3c",
    stampHover: "#d4785e",
    postmark: "#a08c6a",
    airmail: "#4a7fb5",

    // Postcard
    postcardBack: "#f0ebe3",
    postcardText: "#3a3632",
    postcardDivider: "#c4bdb3",
    postcardPlaceholder: "#b0a99e",

    // Semantic
    success: "#5a9a6b",
    warning: "#c49a3c",
    error: "#c45a3c",
  },
  space: (v: number) => v * 4,
  fonts: {
    sans: "DMSans-Regular",
    sansMedium: "DMSans-Medium",
    sansSemiBold: "DMSans-SemiBold",
    sansBold: "DMSans-Bold",
    sansItalic: "DMSans-Italic",
    serif: "DMSerifDisplay-Regular",
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
} as const;

const breakpoints = {
  xs: 0,
  sm: 390,
  md: 500,
  lg: 800,
} as const;

type AppThemes = {
  dark: typeof theme;
};

type AppBreakpoints = typeof breakpoints;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  settings: {
    initialTheme: "dark",
  },
  themes: {
    dark: theme,
  },
  breakpoints,
});
