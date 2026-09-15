"use client";

import Link from "next/link";
import { useIsAdmin } from "~/hooks/useIsAdmin";

interface AdminEditLinkProps {
  entryId: number;
}

const AdminEditLink = ({ entryId }: AdminEditLinkProps) => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return null;
  }

  return (
    <span className="text-sm ml-auto">
      <Link href={`/admin/edit-entry/${entryId}`} className="text-blue-600 hover:underline mr-3">
        Edit
      </Link>
    </span>
  );
};

export default AdminEditLink;
