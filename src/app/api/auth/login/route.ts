import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminPassword, setSessionCookie } from "~/server/auth";
import { getClientIp } from "~/server/auth/client-ip";
import { getRateLimitStatus, registerFailedAttempt, registerSuccessfulAttempt } from "~/server/auth/rate-limit";

const loginBodySchema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const clientIp = getClientIp(request.headers);
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
