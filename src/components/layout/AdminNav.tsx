"use client";

import Link from "next/link";
import { useIsAdmin } from "~/hooks/useIsAdmin";

const AdminNav = () => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return null;
  }

  return (
    <nav className="flex flex-wrap items-center text-sm" aria-label="Site">
      <Link href="/admin" className="text-blue-700 hover:underline">
        Admin
      </Link>
    </nav>
  );
};

export default AdminNav;
