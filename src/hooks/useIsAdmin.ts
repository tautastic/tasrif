"use client";

import { createContext, useContext } from "react";

export interface AdminStatus {
  isAdmin: boolean | null;
  refresh: () => Promise<void>;
}

export const AdminStatusContext = createContext<AdminStatus>({ isAdmin: null, refresh: () => Promise.resolve() });

export const useAdminStatus = (): AdminStatus => useContext(AdminStatusContext);

export const useIsAdmin = (): boolean => useAdminStatus().isAdmin === true;
