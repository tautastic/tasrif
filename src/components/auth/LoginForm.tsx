"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";

const LoginForm = () => {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const message = typeof data === "object" && data !== null ? (data as { error?: unknown }).error : undefined;
        setError(typeof message === "string" ? message : "Login failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          required
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;
