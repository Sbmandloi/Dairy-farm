import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(data: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("A user with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  });
}

export async function deleteUser(id: string) {
  const count = await prisma.user.count();
  if (count <= 1) throw new Error("Cannot delete the last user account");
  return prisma.user.delete({ where: { id } });
}
