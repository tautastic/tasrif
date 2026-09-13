"use client";

import { useRouter } from "next/navigation";

export default function CancelButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="bg-gray-200 text-gray-800 rounded px-4 py-2 hover:bg-gray-300"
    >
      Cancel
    </button>
  );
}
