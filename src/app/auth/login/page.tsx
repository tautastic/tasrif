import type { Metadata } from "next";
import LoginForm from "~/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border border-gray-300">
      <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
      <LoginForm next={Array.isArray(next) ? next[0] : next} />
    </div>
  );
}
