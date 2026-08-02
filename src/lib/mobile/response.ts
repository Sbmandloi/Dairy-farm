import { NextResponse } from "next/server";
import { ActionResult } from "@/types";

/**
 * Every mobile endpoint answers in the same envelope the Server Actions already
 * use (`ActionResult<T>`), so the app's response type is literally the web
 * app's result type — one contract, not two.
 */

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json<ActionResult<T>>({ success: true, data }, { status });
}

export function fail(
  error: string,
  status = 400,
  fieldErrors?: Record<string, string[]>
): NextResponse {
  return NextResponse.json<ActionResult<never>>(
    { success: false, error, ...(fieldErrors ? { fieldErrors } : {}) },
    { status }
  );
}

export const unauthorized = () => fail("Unauthorized", 401);
export const notFound = (what = "Not found") => fail(what, 404);

/**
 * Turn a thrown error into the same message the web UI would have shown.
 *
 * The services throw human-readable, business-meaningful messages ("Amount is
 * more than the ₹420.00 outstanding") and the web surfaces them verbatim; the
 * app must do the same or the two would disagree about what went wrong.
 */
export function failFrom(error: unknown, fallback: string, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  return fail(message, status);
}
