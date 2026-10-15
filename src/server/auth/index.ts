import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { env } from "~/server/env";
import {
  createSessionToken,
  revokeSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "./session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
} as const;

const safeEqual = (a: string, b: string): boolean => {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
};

const setSessionCookie = async (response: NextResponse): Promise<void> => {
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(), {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

const clearSessionCookie = (response: NextResponse): void => {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
};

const isAdminPassword = (password: string): boolean => safeEqual(password, env.AUTH_PASSWORD);

const isAuthenticated = async (): Promise<boolean> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : false;
};

const revokeCurrentSession = async (): Promise<void> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSessionToken(token);
  }
};

export { clearSessionCookie, isAdminPassword, isAuthenticated, revokeCurrentSession, setSessionCookie };
