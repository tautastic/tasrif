import { NextResponse } from "next/server";
import { clearSessionCookie } from "~/server/auth";

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/auth/login", request.url), 303);
  clearSessionCookie(response);
  return response;
}
