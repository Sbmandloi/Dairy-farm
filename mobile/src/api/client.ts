import { env } from "@/config/env";
import { ApiError } from "./errors";
import type { ActionResult } from "./types";

/**
 * The single HTTP client. Every request in the app goes through `request()`.
 *
 * Responsibilities, in order:
 *   1. Resolve the URL against the configured base.
 *   2. Attach the bearer token.
 *   3. Abort on timeout, so a dead connection cannot hang a screen forever.
 *   4. Retry transient failures with backoff — never a non-idempotent method.
 *   5. Refresh the session once on 401 and replay the request.
 *   6. Unwrap the ActionResult envelope into a value or a typed ApiError.
 *
 * Auth is injected rather than imported (see `configureAuth`), so this module
 * has no dependency on React or on the auth context — which keeps it testable
 * and prevents an import cycle.
 */

const DEFAULT_TIMEOUT_MS = 20_000;
/** PDF rendering and bulk WhatsApp sends are legitimately slow. */
const LONG_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

interface AuthBridge {
  getAccessToken: () => string | null;
  /** Exchange the refresh token; returns the new access token, or null if the session is dead. */
  refresh: () => Promise<string | null>;
  /** Called when the session cannot be recovered — the app should return to login. */
  onSessionExpired: () => void;
}

let auth: AuthBridge = {
  getAccessToken: () => null,
  refresh: async () => null,
  onSessionExpired: () => {},
};

export function configureAuth(bridge: AuthBridge): void {
  auth = bridge;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header — only login and refresh do this. */
  anonymous?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function url(path: string): string {
  return `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Only GET is replayed automatically. Retrying a POST that may already have
 * been applied server-side could record a payment twice — the one bug in this
 * domain that costs real money, so the client never risks it.
 */
function isIdempotent(method: string): boolean {
  return method === "GET";
}

async function rawFetch(
  path: string,
  options: RequestOptions,
  token: string | null
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Honour a caller's cancellation (screen unmounted) as well as our timeout.
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  try {
    return await fetch(url(path), {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token && !options.anonymous ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Map a transport-level throw onto our error vocabulary. */
function asTransportError(error: unknown, timedOut: boolean): ApiError {
  if (timedOut) return new ApiError("Request timed out", "timeout");
  return new ApiError(
    error instanceof Error ? error.message : "Network request failed",
    "network"
  );
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    // A proxy or tunnel returning HTML is the usual cause; the status is more
    // informative than the body here.
    throw new ApiError(
      `Unexpected response from the server (${response.status})`,
      response.status >= 500 ? "server" : "unknown",
      response.status
    );
  }

  let payload: ActionResult<T>;
  try {
    payload = (await response.json()) as ActionResult<T>;
  } catch {
    throw new ApiError("The server sent a malformed response", "unknown", response.status);
  }

  if (payload.success) return payload.data;

  // The envelope's own message is the best one available — the services write
  // these for the user, so they are shown as-is.
  if (response.status === 401) {
    throw new ApiError(payload.error, "unauthorized", 401);
  }
  if (response.status === 422 || payload.fieldErrors) {
    throw new ApiError(payload.error, "validation", response.status, payload.fieldErrors);
  }
  if (response.status >= 500) {
    throw new ApiError(payload.error, "server", response.status);
  }
  throw new ApiError(payload.error, "business", response.status);
}

/**
 * Perform a request, refreshing the session once if the token has expired.
 *
 * The refresh is deliberately attempted only once per call: if the replayed
 * request is also rejected, the session is genuinely gone and looping would
 * just delay showing the login screen.
 */
async function requestOnce<T>(path: string, options: RequestOptions): Promise<T> {
  let timedOut = false;

  const attempt = async (token: string | null): Promise<Response> => {
    try {
      return await rawFetch(path, options, token);
    } catch (error) {
      timedOut = error instanceof Error && error.name === "AbortError";
      // A caller-initiated cancel is not a failure to report.
      if (timedOut && options.signal?.aborted) throw error;
      throw asTransportError(error, timedOut);
    }
  };

  let response = await attempt(options.anonymous ? null : auth.getAccessToken());

  if (response.status === 401 && !options.anonymous) {
    const fresh = await auth.refresh();
    if (!fresh) {
      auth.onSessionExpired();
      throw new ApiError("Your session has expired. Please sign in again.", "unauthorized", 401);
    }
    response = await attempt(fresh);

    if (response.status === 401) {
      auth.onSessionExpired();
      throw new ApiError("Your session has expired. Please sign in again.", "unauthorized", 401);
    }
  }

  return parseEnvelope<T>(response);
}

/** Perform a request, retrying transient failures with exponential backoff. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await requestOnce<T>(path, options);
    } catch (error) {
      lastError = error;

      const retryable =
        error instanceof ApiError && error.isRetryable && isIdempotent(method);
      if (!retryable || attempt === MAX_RETRIES) break;

      // 400ms, then 800ms — enough to ride out a handover between cell towers
      // without making the user feel the app has frozen.
      await sleep(400 * 2 ** attempt);
    }
  }

  throw lastError;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),

  /** For endpoints that render a PDF or a full backup. */
  slow: <T>(path: string, body?: unknown, method: "GET" | "POST" = "POST") =>
    request<T>(path, { method, body, timeoutMs: LONG_TIMEOUT_MS }),
};

export const TIMEOUTS = { default: DEFAULT_TIMEOUT_MS, long: LONG_TIMEOUT_MS } as const;

/** Absolute URL plus auth header, for the file downloader. */
export function fileRequestFor(path: string): { url: string; headers: Record<string, string> } {
  const token = auth.getAccessToken();
  return {
    url: url(path),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

/** Force a token refresh before a download, since the downloader cannot retry on 401. */
export async function ensureFreshToken(): Promise<void> {
  await auth.refresh();
}
