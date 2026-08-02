import Constants from "expo-constants";

/**
 * Build-time configuration.
 *
 * The API base URL is the app's single piece of configuration. It is validated
 * here at startup rather than at the first request, so a mis-built APK fails
 * with a message that says what is wrong instead of a stream of network errors
 * the farmer cannot interpret.
 */

function readApiUrl(): string {
  // EXPO_PUBLIC_* is inlined by the bundler; the `extra` copy is the fallback
  // for a build where only app.config.ts saw the variable.
  const raw =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
    "";

  return raw.trim().replace(/\/+$/, "");
}

const API_URL = readApiUrl();

/** True for hosts that are unambiguously a developer's own machine. */
function isLocalHost(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
}

export interface EnvProblem {
  title: string;
  detail: string;
}

/**
 * What is wrong with this build's configuration, or null if it is usable.
 *
 * Plain HTTP is permitted only for a LAN address during development. Shipping
 * an APK that talks to a public host over HTTP would put the dairy's login and
 * every customer's data on the wire in clear text, so that combination is
 * refused outright rather than warned about.
 */
export function describeEnvProblem(): EnvProblem | null {
  if (!API_URL) {
    return {
      title: "Server address missing",
      detail:
        "This build has no EXPO_PUBLIC_API_URL. Rebuild the APK with the address of your Dairy Billing site.",
    };
  }

  if (!/^https?:\/\//.test(API_URL)) {
    return {
      title: "Server address is invalid",
      detail: `"${API_URL}" is not a web address. It must start with https://`,
    };
  }

  if (API_URL.startsWith("http://") && !isLocalHost(API_URL)) {
    return {
      title: "Insecure server address",
      detail:
        "This build points at a public address over plain HTTP, which would send your password and customer data unencrypted. Rebuild using https://",
    };
  }

  return null;
}

export const env = {
  apiUrl: API_URL,
  /** Whether this build talks to a development machine on the local network. */
  isLocal: isLocalHost(API_URL),
} as const;
