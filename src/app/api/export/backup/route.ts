import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildBackupCsv } from "@/lib/services/export.service";

// GET /api/export/backup?type=month&value=YYYY-MM
// GET /api/export/backup?type=week&value=YYYY-WXX  (ISO week)
// GET /api/export/backup?type=all
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const { filename, content, contentType } = await buildBackupCsv(
    sp.get("type") || "month",
    sp.get("value") || ""
  );

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
