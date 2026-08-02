import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { buildFullBackupJson } from "@/lib/services/export.service";

// GET /api/export/backup/json
// Full-fidelity, machine-restorable snapshot of the ENTIRE database — see
// buildFullBackupJson() for why this, and only this, counts as a backup.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, content, contentType } = await buildFullBackupJson(
    session.user?.email ?? null
  );

  // The Reports page shows "last backed up" from settings, which the builder
  // just stamped.
  revalidatePath("/reports");

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
