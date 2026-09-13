import { redirect } from "next/navigation";
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
