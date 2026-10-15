import Link from "next/link";
import { requireAdmin } from "~/server/auth/guard";
import { getNeedsAttentionCount } from "~/server/db/repository/lexical-entry";

const NEEDS_ATTENTION_HREF = `/admin/entries?${new URLSearchParams({ filter: "Needs attention" }).toString()}`;

const ADMIN_LINKS = [
  { href: "/admin/entries", label: "Entries", description: "Browse and edit dictionary entries" },
  {
    href: "/admin/morph-patterns",
    label: "Patterns",
    description: "Manage morphological patterns and their overrides",
  },
  { href: "/admin/new-entry", label: "Add Entry", description: "Create a new dictionary entry" },
] as const;

const describeNeedsAttention = (count: number) =>
  count === 0
    ? "Every entry with a pattern has its derived forms"
    : `${count} ${count === 1 ? "entry has" : "entries have"} a pattern but no derived forms. Check the root.`;

export default async function AdminDashboardPage() {
  await requireAdmin();
  const needsAttention = await getNeedsAttentionCount();

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">Admin Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block border border-gray-200 p-4 hover:border-gray-400 hover:bg-gray-50"
          >
            <div className="font-medium text-blue-700">{link.label}</div>
            <div className="mt-1 text-sm text-gray-600">{link.description}</div>
          </Link>
        ))}
      </div>
      <Link
        href={NEEDS_ATTENTION_HREF}
        className={`mt-4 block border p-4 hover:bg-gray-50 ${
          needsAttention > 0 ? "border-amber-400 bg-amber-50" : "border-gray-200"
        }`}
      >
        <div className="font-medium text-blue-700">Needs attention ({needsAttention})</div>
        <div className="mt-1 text-sm text-gray-700">{describeNeedsAttention(needsAttention)}</div>
      </Link>
    </div>
  );
}
