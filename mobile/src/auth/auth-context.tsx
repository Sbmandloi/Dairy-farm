import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, configureAuth } from "@/api/client";
import { ApiError } from "@/api/errors";
import type { AuthTokens, AuthUser } from "@/api/types";
import { clearSession, loadSession, saveSession, saveTokens } from "./token-store";

/**
 * Session state for the whole app.
 *
 * The tokens are held in a ref, not in state: the HTTP client reads the current
 * access token synchronously on every request, and a ref cannot be stale the
 * way a captured state value can. React state carries only what the UI renders
 * (the user and the status).
 */

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const accessToken = useRef<string | null>(null);
  const refreshToken = useRef<string | null>(null);
  /** In-flight refresh, so a burst of 401s triggers exactly one exchange. */
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const forget = useCallback(async () => {
    accessToken.current = null;
    refreshToken.current = null;
    await clearSession();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  /**
   * Exchange the refresh token for a new pair.
   *
   * Concurrent callers share one request: when several queries expire at the
   * same moment they must not each burn a refresh, and only the first result
   * should be written to storage.
   */
  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const token = refreshToken.current;
    if (!token) return null;

    refreshInFlight.current = (async () => {
      try {
        const result = await api.post<AuthTokens>(
          "/api/mobile/auth/refresh",
          { refreshToken: token },
          { anonymous: true }
        );
        accessToken.current = result.accessToken;
        refreshToken.current = result.refreshToken;
        await saveTokens(result.accessToken, result.refreshToken);
        setUser(result.user);
        return result.accessToken;
      } catch (error) {
        // A refused refresh means the session is over. A network failure does
        // NOT: dropping the tokens then would sign the farmer out every time
        // they walked out of signal.
        if (error instanceof ApiError && error.kind === "unauthorized") {
          await forget();
        }
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [forget]);

  // Wire the client to this session before anything can issue a request.
  useEffect(() => {
    configureAuth({
      getAccessToken: () => accessToken.current,
      refresh,
      onSessionExpired: () => {
        void forget();
      },
    });
  }, [refresh, forget]);

  // Restore a stored session on cold start.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (cancelled) return;

      if (!stored) {
        setStatus("unauthenticated");
        return;
      }

      accessToken.current = stored.accessToken;
      refreshToken.current = stored.refreshToken;
      setUser(stored.user);

      // Show the app immediately from the stored profile — waiting on a network
      // round trip before rendering would make every launch feel slow, and an
      // invalid token is handled by the client's 401 path anyway.
      setStatus("authenticated");

      try {
        const fresh = await api.get<AuthUser>("/api/mobile/auth/me");
        if (!cancelled) setUser(fresh);
      } catch (error) {
        // Offline is fine — keep the cached profile. Only an explicit rejection
        // ends the session, and the client has already cleared it by then.
        if (error instanceof ApiError && error.kind === "unauthorized" && !cancelled) {
          await forget();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forget]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<AuthTokens>(
      "/api/mobile/auth/login",
      { email: email.trim().toLowerCase(), password },
      { anonymous: true }
    );

    accessToken.current = result.accessToken;
    refreshToken.current = result.refreshToken;
    await saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });

    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut: forget }),
    [status, user, signIn, forget]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
