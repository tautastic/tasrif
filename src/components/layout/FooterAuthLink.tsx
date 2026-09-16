"use client";

import Link from "next/link";
import { useIsAdmin } from "~/hooks/useIsAdmin";

const FooterAuthLink = () => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <Link href="/auth/login" className="text-gray-400 hover:text-gray-600 hover:underline">
        Login
      </Link>
    );
  }

  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className="text-gray-400 hover:text-gray-600 hover:underline cursor-pointer">
        Logout
      </button>
    </form>
  );
};

export default FooterAuthLink;
