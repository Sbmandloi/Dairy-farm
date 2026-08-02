const expoConfig = require("eslint-config-expo/flat");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

/**
 * Lint rules for the Android app.
 *
 * The Expo preset covers React, React Native and the Hooks rules. Beyond it,
 * unused code is treated as an error rather than a warning: this project was
 * built quickly across fourteen screens, and a stale import or a leftover
 * variable is exactly the kind of thing that survives into a release nobody
 * re-reads.
 */
module.exports = [
  ...expoConfig,
  {
    ignores: ["android/", "ios/", "dist/", ".expo/", "node_modules/"],
  },
  {
    // Build tooling runs in Node, not in the React Native runtime.
    files: ["scripts/**", "plugins/**", "*.config.js"],
    languageOptions: {
      globals: { Buffer: "readonly", process: "readonly", console: "readonly", require: "readonly", module: "writable", __dirname: "readonly" },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // `const { bills, ...rest } = customer` is a legitimate way to omit a
          // field, so ignore siblings of a rest element.
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Screens legitimately render conditionally on data that may be absent.
      "react/no-unescaped-entities": "off",
    },
  },
];
