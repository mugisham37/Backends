import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  const securityHeaders = {
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.example.com wss://api.example.com;",
    "X-XSS-Protection": "1; mode=block",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  }

  // Add security headers to response
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Extract tenant from subdomain or path
  const url = request.nextUrl.clone()
  const hostname = request.headers.get("host") || ""
  const path = url.pathname

  // Check if it's a custom domain or subdomain
  const isCustomDomain = !hostname.includes("example.com") && hostname !== "localhost:3000"
  const isSubdomain = hostname.includes(".example.com") && !hostname.startsWith("www.")

  // Handle tenant identification
  if (isCustomDomain) {
    // Custom domain - set tenant from domain
    response.cookies.set("tenant", hostname, { path: "/", sameSite: "strict" })
  } else if (isSubdomain) {
    // Subdomain - extract tenant from subdomain
    const tenant = hostname.split(".")[0]
    response.cookies.set("tenant", tenant, { path: "/", sameSite: "strict" })
  } else if (path.startsWith("/t/")) {
    // Path-based tenant - extract tenant from path
    const tenant = path.split("/")[2]

    // Rewrite URL to remove tenant from path
    url.pathname = path.replace(`/t/${tenant}`, "")

    // Set tenant cookie
    response.cookies.set("tenant", tenant, { path: "/", sameSite: "strict" })

    return NextResponse.rewrite(url, { response })
  }

  // Check if user is authenticated for protected routes
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    const token = request.cookies.get("token")?.value

    if (!token) {
      // Redirect to login page
      url.pathname = "/auth/login"
      url.searchParams.set("redirect", path)
      return NextResponse.redirect(url, { response })
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
}
