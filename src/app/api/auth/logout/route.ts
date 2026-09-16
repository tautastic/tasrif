import { NextResponse } from "next/server";
import { clearSessionCookie } from "~/server/auth";

export function POST() {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/auth/login" },
  });
  clearSessionCookie(response);
  return response;
}
