import LoginForm from "~/components/auth/LoginForm";

export default async function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-10 p-6 border border-gray-300">
      <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
      <LoginForm />
    </div>
  );
}
