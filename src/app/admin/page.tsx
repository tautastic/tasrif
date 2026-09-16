import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin/entries", label: "Entries", description: "Browse and edit dictionary entries" },
  { href: "/admin/new-entry", label: "Add Entry", description: "Create a new dictionary entry" },
  {
    href: "/admin/morph-patterns",
    label: "Patterns",
    description: "Manage morphological patterns and their overrides",
  },
] as const;

export default function AdminDashboardPage() {
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
    </div>
  );
}
