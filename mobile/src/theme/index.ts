import { MD3DarkTheme, MD3LightTheme, configureFonts } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";

/**
 * Material Design 3 theme.
 *
 * The palette is derived from the web app's brand (blue-600 primary, cyan
 * secondary, amber accent) so the two products are recognisably the same
 * system — but the roles, elevation and typography are Material's, not a
 * transplant of Tailwind classes. That is the point of the rebuild: same brand,
 * native language.
 *
 * Both light and dark are defined because Android users expect the app to
 * follow the system setting, and a dairy is worked at 5am and 6pm.
 */

/** Semantic colours for domain state, kept out of the component code. */
export interface StatusPalette {
  container: string;
  onContainer: string;
}

export interface DairyColors {
  /** Milk quantities. */
  milk: StatusPalette;
  /** Money billed. */
  billed: StatusPalette;
  /** Money received. */
  paid: StatusPalette;
  /** Money still owed. */
  due: StatusPalette;
  /** Nothing owed / all settled. */
  settled: StatusPalette;
  /** Generated but not yet sent. */
  pending: StatusPalette;
  /** Partly paid. */
  partial: StatusPalette;
}

const lightDairy: DairyColors = {
  milk: { container: "#DBEAFE", onContainer: "#1E40AF" },
  billed: { container: "#EDE9FE", onContainer: "#5B21B6" },
  paid: { container: "#D1FAE5", onContainer: "#065F46" },
  due: { container: "#FFEDD5", onContainer: "#9A3412" },
  settled: { container: "#D1FAE5", onContainer: "#065F46" },
  pending: { container: "#DBEAFE", onContainer: "#1E40AF" },
  partial: { container: "#FEF3C7", onContainer: "#92400E" },
};

const darkDairy: DairyColors = {
  milk: { container: "#1E3A8A", onContainer: "#BFDBFE" },
  billed: { container: "#4C1D95", onContainer: "#DDD6FE" },
  paid: { container: "#064E3B", onContainer: "#A7F3D0" },
  due: { container: "#7C2D12", onContainer: "#FED7AA" },
  settled: { container: "#064E3B", onContainer: "#A7F3D0" },
  pending: { container: "#1E3A8A", onContainer: "#BFDBFE" },
  partial: { container: "#78350F", onContainer: "#FDE68A" },
};

/**
 * Type-scale tweak: the default MD3 body size is comfortable for reading prose,
 * but this app is mostly dense numeric tables. Tabular figures are set slightly
 * tighter and the label sizes bumped so column headers stay legible at a glance.
 */
const fontConfig = {
  labelSmall: { letterSpacing: 0.4 },
  titleMedium: { fontWeight: "600" as const },
  titleLarge: { fontWeight: "700" as const },
  headlineSmall: { fontWeight: "700" as const },
};

const lightColors = {
  ...MD3LightTheme.colors,
  primary: "#2563EB",
  onPrimary: "#FFFFFF",
  primaryContainer: "#DBEAFE",
  onPrimaryContainer: "#0B2D6B",
  secondary: "#0891B2",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#CFFAFE",
  onSecondaryContainer: "#083344",
  tertiary: "#D97706",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#FEF3C7",
  onTertiaryContainer: "#78350F",
  error: "#DC2626",
  onError: "#FFFFFF",
  errorContainer: "#FEE2E2",
  onErrorContainer: "#7F1D1D",
  background: "#F8FAFC",
  onBackground: "#0F172A",
  surface: "#FFFFFF",
  onSurface: "#0F172A",
  surfaceVariant: "#EEF2F7",
  onSurfaceVariant: "#475569",
  outline: "#CBD5E1",
  outlineVariant: "#E2E8F0",
  elevation: {
    level0: "transparent",
    level1: "#FFFFFF",
    level2: "#F8FAFC",
    level3: "#F1F5F9",
    level4: "#EEF2F7",
    level5: "#E9EEF5",
  },
};

const darkColors = {
  ...MD3DarkTheme.colors,
  primary: "#7BA7FF",
  onPrimary: "#0B2D6B",
  primaryContainer: "#1E3A8A",
  onPrimaryContainer: "#DBEAFE",
  secondary: "#67E8F9",
  onSecondary: "#083344",
  secondaryContainer: "#155E75",
  onSecondaryContainer: "#CFFAFE",
  tertiary: "#FBBF24",
  onTertiary: "#78350F",
  tertiaryContainer: "#92400E",
  onTertiaryContainer: "#FEF3C7",
  error: "#FCA5A5",
  onError: "#7F1D1D",
  errorContainer: "#991B1B",
  onErrorContainer: "#FEE2E2",
  background: "#0B1220",
  onBackground: "#E2E8F0",
  surface: "#111A2B",
  onSurface: "#E2E8F0",
  surfaceVariant: "#1E293B",
  onSurfaceVariant: "#94A3B8",
  outline: "#334155",
  outlineVariant: "#1E293B",
  elevation: {
    level0: "transparent",
    level1: "#141E30",
    level2: "#182337",
    level3: "#1C293F",
    level4: "#1E2C44",
    level5: "#22324D",
  },
};

export type AppTheme = MD3Theme & { dairy: DairyColors };

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  colors: lightColors,
  fonts: configureFonts({ config: fontConfig }),
  dairy: lightDairy,
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  colors: darkColors,
  fonts: configureFonts({ config: fontConfig }),
  dairy: darkDairy,
};

/**
 * An 8pt spacing scale. Every gap and pad in the app comes from here, which is
 * what makes the rhythm consistent across fourteen screens built over time.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Android's minimum comfortable touch target. */
export const TOUCH_TARGET = 48;
