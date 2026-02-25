import { prisma } from "@/lib/db";
import { Settings } from "@prisma/client";

export async function getSettings(): Promise<Settings> {
  let settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        id: "default",
        farmName: "My Dairy Farm",
        globalPricePerLiter: 60.0,
        billingCycleType: "MONTHLY",
        entryMode: "SPLIT",
      },
    });
  }
  return settings;
}

export async function updateSettings(data: Partial<Omit<Settings, "id" | "createdAt" | "updatedAt">>) {
  return prisma.settings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      farmName: "My Dairy Farm",
      globalPricePerLiter: 60.0,
      billingCycleType: "MONTHLY",
      entryMode: "SPLIT",
      ...data,
    },
    update: data,
  });
}
