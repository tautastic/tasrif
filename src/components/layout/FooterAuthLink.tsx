"use client";

import Link from "next/link";
import { useAdminStatus } from "~/hooks/useIsAdmin";

const linkClassName = "text-gray-600 hover:text-gray-900 hover:underline";

const FooterAuthLink = () => {
  const { isAdmin } = useAdminStatus();

  if (isAdmin === null) {
    return (
      <span className="invisible" aria-hidden="true">
        Login
      </span>
    );
  }

  if (!isAdmin) {
    return (
      <Link href="/auth/login" className={linkClassName}>
        Login
      </Link>
    );
  }

  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className={`${linkClassName} cursor-pointer`}>
        Logout
      </button>
    </form>
  );
};

export default FooterAuthLink;
