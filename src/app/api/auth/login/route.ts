import { NextResponse } from "next/server";
import { isAdminPassword, setSessionCookie } from "~/server/auth";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const password = typeof body === "object" && body !== null ? (body as { password?: unknown }).password : undefined;

  if (typeof password !== "string" || password === "") {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  await setSessionCookie(response);
  return response;
}
