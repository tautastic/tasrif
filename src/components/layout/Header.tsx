import Link from "next/link";
import EntrySearchForm from "~/components/entry/EntrySearchForm";

interface HeaderProps {
  isAdmin: boolean;
}

const Header = ({ isAdmin }: HeaderProps) => {
  return (
    <header className="border-b border-gray-300 pb-3 mb-4 md:mb-6">
      <div className="flex flex-col gap-3 md:justify-start md:flex-row md:items-center md:gap-4">
        <h1 className="shrink-0 text-center text-3xl font-bold md:text-left">
          <Link href="/" className="text-blue-700 hover:text-blue-900 no-underline">
            Tasrif
          </Link>
        </h1>
        <nav className="flex shrink-0 flex-wrap items-center justify-evenly gap-2 text-sm md:justify-end md:gap-4">
          {isAdmin ? (
            <>
              <Link href="/admin/new-entry" className="text-blue-600 hover:underline">
                Add Entry
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="text-blue-600 hover:underline hover:cursor-pointer">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Login
            </Link>
          )}
        </nav>
        <div className="w-full md:max-w-md md:ml-auto md:flex-1 md:min-w-0">
          <EntrySearchForm />
        </div>
      </div>
    </header>
  );
};

export default Header;
