import { NextResponse } from "next/server";
import { clearSessionCookie, revokeCurrentSession } from "~/server/auth";

export async function POST() {
  await revokeCurrentSession();
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/auth/login" },
  });
  clearSessionCookie(response);
  return response;
}
