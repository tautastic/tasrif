"use client";

import Link from "next/link";
import { useIsAdmin } from "~/hooks/useIsAdmin";

const AdminNav = () => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <Link href="/auth/login" className="text-blue-600 hover:underline">
        Login
      </Link>
    );
  }

  return (
    <>
      <Link href="/admin/entries" className="text-blue-600 hover:underline">
        Entries
      </Link>
      <Link href="/admin/new-entry" className="text-blue-600 hover:underline">
        Add Entry
      </Link>
      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="text-blue-600 hover:underline hover:cursor-pointer">
          Logout
        </button>
      </form>
    </>
  );
};

export default AdminNav;
