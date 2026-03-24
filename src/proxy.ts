import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep admin entry out of frontweb.
  if (
    pathname.startsWith("/admin") ||
    pathname === "/mine/my-emojis" ||
    pathname === "/profile/my-collections"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/mine/favorites/emojis";
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/explore") ||
    pathname.startsWith("/creators") ||
    pathname.startsWith("/upload")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/mine/my-emojis",
    "/profile/my-collections",
    "/explore/:path*",
    "/creators/:path*",
    "/upload/:path*",
  ],
};
