import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { env } from "~/server/env";

const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const secret = new TextEncoder().encode(env.AUTH_SECRET);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

const safeEqual = (a: string, b: string): boolean => {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
};

const createSession = (): Promise<string> =>
  new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);

const verifySession = async (token: string): Promise<boolean> => {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "admin";
  } catch {
    return false;
  }
};

const setSessionCookie = async (response: NextResponse): Promise<void> => {
  response.cookies.set(COOKIE_NAME, await createSession(), {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

const clearSessionCookie = (response: NextResponse): void => {
  response.cookies.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
};

const isAdminPassword = (password: string): boolean => safeEqual(password, env.AUTH_PASSWORD);

const isAuthenticated = async (): Promise<boolean> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verifySession(token) : false;
};

export { clearSessionCookie, isAdminPassword, isAuthenticated, setSessionCookie };
