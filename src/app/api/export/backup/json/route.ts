import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { recordBackupTaken } from "@/lib/services/settings.service";

// GET /api/export/backup/json
// Full-fidelity, machine-restorable snapshot of the ENTIRE database.
// Unlike the CSV export (human-readable, one-way), this preserves primary keys,
// foreign keys, decimals and timestamps so it can be re-imported via
// `npm run db:restore <file.json>` to reconstruct the database exactly.
//
// Prisma Decimal serializes to a numeric string and DateTime to an ISO string
// through JSON.stringify, so no lossy float conversion happens here.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ordered parent-before-child so a naive sequential restore satisfies FKs.
  const [users, settings, customers, dailyMilkEntries, bills, payments] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.settings.findMany(),
      prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.dailyMilkEntry.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.bill.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  const snapshot = {
    meta: {
      app: "dairy-billing",
      backupVersion: 1,
      migration: "0_init",
      generatedAt: new Date().toISOString(),
      generatedBy: session.user?.email ?? null,
      counts: {
        users: users.length,
        settings: settings.length,
        customers: customers.length,
        dailyMilkEntries: dailyMilkEntries.length,
        bills: bills.length,
        payments: payments.length,
      },
    },
    // Order matters for restore: parents first.
    data: { users, settings, customers, dailyMilkEntries, bills, payments },
  };

  const json = JSON.stringify(snapshot, null, 2);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  // Stamp the backup only once the snapshot actually serialized — otherwise a
  // failed export would still report "backed up just now". Never let this break
  // the download itself: the file in the user's hands is the real backup.
  try {
    await recordBackupTaken();
    revalidatePath("/reports");
  } catch (e) {
    console.error("Could not record lastBackupAt:", e);
  }

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dairy-backup-full-${stamp}.json"`,
    },
  });
}
