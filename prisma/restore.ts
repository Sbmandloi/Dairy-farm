/**
 * Restore the database from a full JSON backup produced by
 * GET /api/export/backup/json  (downloaded as dairy-backup-full-*.json).
 *
 * Usage:
 *   npm run db:restore -- ./dairy-backup-full-2026-07-15-10-30-00.json
 *   npm run db:restore -- ./backup.json --force     # wipe existing data first
 *
 * Safety:
 *   - Refuses to run if the target DB already has data, unless --force is given.
 *   - With --force it deletes all rows (child-first) then re-inserts everything
 *     (parent-first) inside a single transaction, so a mid-restore failure rolls
 *     back and leaves the DB untouched.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const file = args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error("Usage: npm run db:restore -- <backup.json> [--force]");
    process.exit(1);
  }

  const raw = readFileSync(path.resolve(process.cwd(), file), "utf-8");
  const snapshot = JSON.parse(raw);

  if (snapshot?.meta?.app !== "dairy-billing") {
    throw new Error("This file is not a dairy-billing backup (meta.app mismatch).");
  }

  const { users, settings, customers, dailyMilkEntries, bills, payments } =
    snapshot.data;

  console.log(`Backup generated: ${snapshot.meta.generatedAt}`);
  console.log("Records:", snapshot.meta.counts);

  // Guard against clobbering a populated database.
  const existing =
    (await prisma.customer.count()) +
    (await prisma.bill.count()) +
    (await prisma.dailyMilkEntry.count());
  if (existing > 0 && !force) {
    throw new Error(
      `Target database already contains data (${existing} core rows). ` +
        `Re-run with --force to wipe and restore.`
    );
  }

  await prisma.$transaction(async (tx) => {
    if (force) {
      // Child-first delete to respect foreign keys.
      await tx.payment.deleteMany();
      await tx.bill.deleteMany();
      await tx.dailyMilkEntry.deleteMany();
      await tx.customer.deleteMany();
      await tx.settings.deleteMany();
      await tx.user.deleteMany();
    }

    // Parent-first insert. createMany accepts ISO strings for DateTime and
    // numeric strings for Decimal, so parsed JSON goes in as-is.
    if (users?.length) await tx.user.createMany({ data: users });
    if (settings?.length) await tx.settings.createMany({ data: settings });
    if (customers?.length) await tx.customer.createMany({ data: customers });
    if (dailyMilkEntries?.length)
      await tx.dailyMilkEntry.createMany({ data: dailyMilkEntries });
    if (bills?.length) await tx.bill.createMany({ data: bills });
    if (payments?.length) await tx.payment.createMany({ data: payments });
  });

  console.log("Restore complete.");
}

main()
  .catch((e) => {
    console.error("Restore failed:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
