"use client";

import Link from "next/link";
import { useIsAdmin } from "~/hooks/useIsAdmin";

const NAV_LINK_CLASS_NAME = "text-blue-700 hover:underline";

const AdminNav = () => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <Link href="/auth/login" className={NAV_LINK_CLASS_NAME}>
        Login
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center divide-x divide-gray-300">
      <Link href="/admin/entries" className={`${NAV_LINK_CLASS_NAME} pr-3`}>
        Entries
      </Link>
      <Link href="/admin/new-entry" className={`${NAV_LINK_CLASS_NAME} px-3`}>
        Add Entry
      </Link>
      <form action="/api/auth/logout" method="POST" className="pl-3">
        <button type="submit" className={`${NAV_LINK_CLASS_NAME} cursor-pointer`}>
          Logout
        </button>
      </form>
    </div>
  );
};

export default AdminNav;
