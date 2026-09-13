import type { ReactNode } from "react";
import { requireAdmin } from "~/server/auth/guard";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
