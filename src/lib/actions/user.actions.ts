"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createUser, deleteUser } from "@/lib/services/user.service";
import { ActionResult } from "@/types";

export async function createUserAction(data: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ id: string; name: string; email: string }>> {
  try {
    if (!data.name.trim() || !data.email.trim() || !data.password) {
      return { success: false, error: "All fields are required" };
    }
    if (data.password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    const user = await createUser(data);
    revalidatePath("/settings");
    return { success: true, data: { id: user.id, name: user.name, email: user.email } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create user" };
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (session?.user?.id === userId) {
      return { success: false, error: "You cannot delete your own account" };
    }
    await deleteUser(userId);
    revalidatePath("/settings");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete user" };
  }
}
