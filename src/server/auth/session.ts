import { createHmac, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { env } from "~/server/env";
import { sessionRevocations } from "./revocation";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const signingKey = createHmac("sha256", env.AUTH_SECRET).update(env.AUTH_PASSWORD).digest();

export interface SessionClaims {
  id: string;
  expiresAtSeconds: number;
}

export const createSessionToken = (): Promise<string> =>
  new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey);

export const readSessionToken = async (token: string): Promise<SessionClaims | null> => {
  try {
    const { payload } = await jwtVerify(token, signingKey, { algorithms: ["HS256"] });
    if (payload.role !== "admin" || typeof payload.jti !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return { id: payload.jti, expiresAtSeconds: payload.exp };
  } catch {
    return null;
  }
};

export const verifySessionToken = async (token: string): Promise<boolean> => {
  const claims = await readSessionToken(token);
  return claims !== null && !sessionRevocations.isRevoked(claims.id);
};

export const revokeSessionToken = async (token: string): Promise<void> => {
  const claims = await readSessionToken(token);
  if (claims) {
    sessionRevocations.revoke(claims.id, claims.expiresAtSeconds);
  }
};
