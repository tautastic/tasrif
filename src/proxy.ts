import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_PATH_HEADER, buildLoginPath } from "~/server/auth/login-path";
import { SESSION_COOKIE_NAME, verifySessionToken } from "~/server/auth/session";

const hasMalformedEncoding = (pathname: string): boolean => {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
};

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (hasMalformedEncoding(pathname)) {
    return new NextResponse("Bad Request", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const query = new URLSearchParams(searchParams);
  query.delete("_rsc");
  const queryString = query.toString();
  const currentPath = queryString ? `${pathname}?${queryString}` : pathname;

  if (token && (await verifySessionToken(token))) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(ADMIN_PATH_HEADER, currentPath);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirect = NextResponse.redirect(new URL(buildLoginPath(currentPath), request.url), 307);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/entry/:path*",
    "/root/:path*",
    "/lang/:path*",
    "/arabic-verb-form/:path*",
    "/appendix/:path*",
  ],
};
