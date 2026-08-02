import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomersCsv } from "@/lib/services/export.service";

// GET /api/export/customers?period=all|YYYY-MM
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = request.nextUrl.searchParams.get("period") || "all";
  const { filename, content, contentType } = await buildCustomersCsv(period);

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
