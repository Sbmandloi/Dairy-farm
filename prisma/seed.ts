import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

// Load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@dairy.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        passwordHash,
      },
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Create default settings
  const existingSettings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        id: "default",
        farmName: "My Dairy Farm",
        farmAddress: "Village Road, District",
        farmPhone: "+91 9000000000",
        globalPricePerLiter: 60.0,
        billingCycleType: "MONTHLY",
        entryMode: "SPLIT",
      },
    });
    console.log("Created default settings");
  } else {
    console.log("Settings already exist");
  }

  // Create sample customers
  const sampleCustomers = [
    { name: "Ramesh Patel", phoneNumber: "+919876543210", address: "123 Main St", pricePerLiter: null },
    { name: "Suresh Kumar", phoneNumber: "+919876543211", address: "456 Farm Lane", pricePerLiter: 55.0 },
    { name: "Priya Sharma", phoneNumber: "+919876543212", address: "789 Village Road", pricePerLiter: null },
  ];

  for (const customer of sampleCustomers) {
    const exists = await prisma.customer.findFirst({ where: { phoneNumber: customer.phoneNumber } });
    if (!exists) {
      await prisma.customer.create({
        data: {
          ...customer,
          startDate: new Date("2025-01-01"),
        },
      });
      console.log(`Created customer: ${customer.name}`);
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
