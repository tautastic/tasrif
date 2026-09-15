"use client";

import { useRouter } from "next/navigation";

export default function CancelButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className="btn-secondary">
      Cancel
    </button>
  );
}
