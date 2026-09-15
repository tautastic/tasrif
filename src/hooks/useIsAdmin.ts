"use client";

import { useEffect, useState } from "react";

export const useIsAdmin = (): boolean => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((data: { isAdmin: boolean }) => {
        if (!cancelled) {
          setIsAdmin(data.isAdmin);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
};
