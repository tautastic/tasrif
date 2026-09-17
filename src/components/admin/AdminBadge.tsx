import type { ReactNode } from "react";

const ADMIN_BADGE_COLORS = {
  gray: "bg-gray-100 text-gray-700",
  purple: "bg-purple-100 text-purple-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
} as const;

interface AdminBadgeProps {
  color?: keyof typeof ADMIN_BADGE_COLORS;
  children: ReactNode;
}

const AdminBadge = ({ color = "gray", children }: AdminBadgeProps) => (
  <span className={`inline-block px-1.5 py-0.5 text-xs whitespace-nowrap ${ADMIN_BADGE_COLORS[color]}`}>
    {children}
  </span>
);

export default AdminBadge;
