import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

const AUTH_ROUTES = ["/sign-in", "/sign-up", "/verify-otp"]
const PUBLIC_ROUTES = ["/how-it-works"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(getSessionCookie(request))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  // Redirect signed-out users away from protected pages to sign-in
  if (!hasSession && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next.js internals, the auth API, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|models|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|bin|js|woff|woff2)$).*)"],
}
