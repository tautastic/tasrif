import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isAuthenticated } from "~/server/auth";

export const requireAdmin = async (redirectTo = "/auth/login") => {
  if (!(await isAuthenticated())) {
    redirect(redirectTo);
  }
};

export const requireAdminAction = async () => {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
};

export const requireAdminApi = async (): Promise<NextResponse | null> => {
  if (await isAuthenticated()) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
};
