import type { ExpoConfig } from "expo/config";

/**
 * App configuration.
 *
 * Expressed as TypeScript rather than app.json so the API base URL can come
 * from the environment at build time: the same source tree produces a debug APK
 * pointed at a laptop and the client's APK pointed at production, with no code
 * edit and no URL committed to the repository.
 */

const BRAND = "#2563EB";

const config: ExpoConfig = {
  name: "Dairy Billing",
  slug: "dairy-billing",
  version: "1.0.0",
  orientation: "default", // the entry grids are genuinely better in landscape
  icon: "./assets/icon.png",
  scheme: "dairybilling",
  userInterfaceStyle: "automatic",

  // The splash screen is configured entirely through the expo-splash-screen
  // plugin below; the top-level `splash` key was removed in SDK 57.
  android: {
    package: "com.dairybilling.app",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
      backgroundColor: BRAND,
    },
    predictiveBackGestureEnabled: false,
    // Only INTERNET is required. The app deliberately asks for no storage,
    // camera or contacts permission — exports go through the system share
    // sheet, which needs none.
    permissions: ["android.permission.INTERNET"],
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: BRAND,
        dark: { backgroundColor: "#0B1220" },
      },
    ],
    // Signs release builds with the real keystore instead of the debug key that
    // prebuild defaults to. See README → "Release signing".
    "./plugins/with-release-signing",
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    // Read through expo-constants at runtime; see src/config/env.ts for why the
    // value is validated there rather than trusted blindly.
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
  },
};

export default config;
