import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAppRoute = pathname.startsWith("/app");
  const isSuperRoute = pathname.startsWith("/super");

  if (!isAppRoute && !isSuperRoute) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Platform Super Admin is a distinct console from any hotel's operational
  // app -- neither role is allowed into the other's routes.
  if (isSuperRoute && !session.user.isSuperAdmin) {
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  }
  if (isAppRoute && session.user.isSuperAdmin) {
    return NextResponse.redirect(new URL("/super", req.nextUrl.origin));
  }
  if (isAppRoute && !session.user.hotelId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/super/:path*"],
};
