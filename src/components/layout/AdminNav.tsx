"use client";

import Link from "next/link";
import { useIsAdmin } from "~/hooks/useIsAdmin";

const AdminNav = () => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return null;
  }

  return (
    <Link href="/admin" className="text-blue-700 hover:underline">
      Admin
    </Link>
  );
};

export default AdminNav;
