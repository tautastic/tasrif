import { NextResponse } from "next/server";
import { isAuthenticated } from "~/server/auth";

export async function GET() {
  const isAdmin = await isAuthenticated();
  return NextResponse.json({ isAdmin });
}
