import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "@/api/types";

/**
 * Where the session lives on the device.
 *
 * Tokens go in the Android Keystore via expo-secure-store, never in
 * AsyncStorage: AsyncStorage is a plaintext file inside the app sandbox, which
 * is readable on a rooted or backed-up device. The cached user profile is not
 * a credential, but it is kept alongside the tokens for simplicity — one place
 * to clear on sign-out means there is no way to half-forget a session.
 */

const ACCESS_KEY = "dairy.accessToken";
const REFRESH_KEY = "dairy.refreshToken";
const USER_KEY = "dairy.user";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

/**
 * Read the stored session, or null if there isn't a complete one.
 *
 * A partial write (say, the process was killed mid-save) is treated as no
 * session at all rather than a half-usable one — the app then shows the login
 * screen, which is recoverable, instead of looping on failed refreshes.
 */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const [accessToken, refreshToken, rawUser] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);

    if (!accessToken || !refreshToken || !rawUser) return null;

    const user = JSON.parse(rawUser) as AuthUser;
    if (!user?.id || !user?.email) return null;

    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

/** Replace only the tokens, keeping the cached profile — used after a refresh. */
export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
