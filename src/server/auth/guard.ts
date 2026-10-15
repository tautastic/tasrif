import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isAuthenticated } from "~/server/auth";
import { ADMIN_PATH_HEADER, buildLoginPath } from "./login-path";

export const requireAdmin = async (nextPath?: string) => {
  if (await isAuthenticated()) {
    return;
  }
  redirect(buildLoginPath(nextPath ?? (await headers()).get(ADMIN_PATH_HEADER)));
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
