import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminPassword, setSessionCookie } from "~/server/auth";
import { getRateLimitStatus, registerFailedAttempt, registerSuccessfulAttempt } from "~/server/auth/rate-limit";

const loginBodySchema = z.object({ password: z.string().min(1) });

const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",").at(0)?.trim();
  if (forwardedFor) {
    return forwardedFor;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimitStatus = getRateLimitStatus(clientIp);

  if (rateLimitStatus.limited) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimitStatus.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = loginBodySchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  const { password } = parsedBody.data;

  if (!isAdminPassword(password)) {
    registerFailedAttempt(clientIp);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  registerSuccessfulAttempt(clientIp);

  const response = NextResponse.json({ success: true });
  await setSessionCookie(response);
  return response;
}
