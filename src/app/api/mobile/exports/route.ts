import { NextResponse } from "next/server";
import {
  buildBackupCsv,
  buildCustomersCsv,
  buildFullBackupJson,
} from "@/lib/services/export.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/mobile/exports?kind=...
 *
 *   kind=customers&period=all|YYYY-MM     → per-customer summary CSV
 *   kind=backup-csv&type=month|week|all&value=...
 *                                          → human-readable period export
 *   kind=backup-json                       → full restorable snapshot
 *
 * The app writes the response to a file and hands it to Android's share sheet,
 * so the farmer can put a backup in Drive or WhatsApp from the phone. Files are
 * byte-identical to the web downloads — same builders, no second implementation.
 *
 * Like the PDF routes, these return the file itself rather than the JSON
 * envelope.
 */
export const GET = withAuth(async (req, session) => {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "backup-json";

  let file;
  switch (kind) {
    case "customers":
      file = await buildCustomersCsv(sp.get("period") || "all");
      break;
    case "backup-csv":
      file = await buildBackupCsv(sp.get("type") || "month", sp.get("value") || "");
      break;
    case "backup-json":
      file = await buildFullBackupJson(session.email);
      break;
    default:
      return fail(`Unknown export "${kind}"`);
  }

  return new NextResponse(file.content, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
