import Link from "next/link";
import EntrySearchForm from "~/components/entry/EntrySearchForm";
import AdminNav from "~/components/layout/AdminNav";

const Header = () => {
  return (
    <header className="border-b border-gray-300 mb-6 pb-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/" className="shrink-0 text-3xl font-bold text-gray-900 no-underline hover:text-gray-900">
          Tasrif
        </Link>

        <nav className="flex flex-wrap items-center text-sm" aria-label="Site">
          <AdminNav />
        </nav>

        <div className="w-full sm:ml-auto sm:w-72">
          <EntrySearchForm />
        </div>
      </div>
    </header>
  );
};

export default Header;
