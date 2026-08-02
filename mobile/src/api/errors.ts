/**
 * One error type for everything the API layer can fail with, so screens have a
 * single thing to catch and a single message to show.
 *
 * The distinction that matters to the UI is not the HTTP status but what the
 * user should do next: retry, fix their input, sign in again, or check their
 * connection. `kind` encodes exactly that.
 */
export type ApiErrorKind =
  | "network" // the request never reached the server
  | "timeout" // it reached the server but took too long
  | "unauthorized" // the session is gone
  | "validation" // the input was rejected; fieldErrors is populated
  | "business" // the server refused for a domain reason, with a real message
  | "server" // 5xx
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    kind: ApiErrorKind,
    status: number | null = null,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Whether retrying the identical request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "server";
  }
}

/**
 * A message safe and useful to put in front of the farmer.
 *
 * Business and validation errors are shown verbatim — the services write them
 * for a human ("Amount is more than the ₹420.00 outstanding"), and rewording
 * them would destroy the instruction they carry. Everything else gets plain
 * language instead of a status code.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return "No connection. Check your internet and try again.";
      case "timeout":
        return "The server took too long to respond. Please try again.";
      case "unauthorized":
        return "Your session has expired. Please sign in again.";
      case "server":
        return "Something went wrong on the server. Please try again in a moment.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
