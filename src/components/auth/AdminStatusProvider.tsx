"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminStatusContext } from "~/hooks/useIsAdmin";

const fetchIsAdmin = async (): Promise<boolean> => {
  const response = await fetch("/api/auth/status", { cache: "no-store" });
  const data = (await response.json()) as { isAdmin?: unknown };
  return data.isAdmin === true;
};

const AdminStatusProvider = ({ children }: { children: ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    const next = await fetchIsAdmin().catch(() => false);
    if (request === latestRequest.current) {
      setIsAdmin(next);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ isAdmin, refresh }), [isAdmin, refresh]);

  return <AdminStatusContext value={value}>{children}</AdminStatusContext>;
};

export default AdminStatusProvider;
