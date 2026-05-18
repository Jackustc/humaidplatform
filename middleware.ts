import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the login page and login API through without a check
  if (pathname === "/humaidadmin2026/login" || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  // Protect everything under /humaidadmin2026
  if (pathname.startsWith("/humaidadmin2026")) {
    const token = req.cookies.get("humaid_admin_token")?.value;
    const secret = process.env.ADMIN_SECRET;

    if (!token || !secret || token !== secret) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/humaidadmin2026/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/humaidadmin2026/:path*"],
};
