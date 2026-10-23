import net from "node:net"
import dns from "node:dns"

// Force IPv4-first and disable dual-stack autoselection to prevent IPv6 ENETUNREACH/ETIMEDOUT to Neon AWS
if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
  ;(net as any).setDefaultAutoSelectFamily(false)
}
if (typeof (dns as any).setDefaultResultOrder === "function") {
  ;(dns as any).setDefaultResultOrder("ipv4first")
}

import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"

declare global {
  var _betterAuthInstance: any | undefined
}

export const auth =
  globalThis._betterAuthInstance ??
  betterAuth({
    database: pool,
    secret: process.env.BETTER_AUTH_SECRET || "prep_sensei_secret_key_dev_mode_32chars_long",
    baseURL:
      process.env.BETTER_AUTH_URL ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL
        : process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NODE_ENV === "production"
              ? "https://prepsensei.elinity.in"
              : process.env.V0_RUNTIME_URL || "http://localhost:3000"),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "candidate",
          input: true,
        },
      },
    },
    trustedOrigins: async (request) => {
      const origin = request?.headers?.get("origin")
      const host = request?.headers?.get("host")
      const forwardedHost = request?.headers?.get("x-forwarded-host")
      const proto = request?.headers?.get("x-forwarded-proto") || "https"

      const dynamicOrigins: string[] = []
      if (origin) dynamicOrigins.push(origin)
      if (host) {
        dynamicOrigins.push(`https://${host}`)
        dynamicOrigins.push(`http://${host}`)
      }
      if (forwardedHost) {
        dynamicOrigins.push(`${proto}://${forwardedHost}`)
      }

      return Array.from(
        new Set([
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3003",
          "http://localhost:3004",
          "http://localhost:3005",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
          "http://127.0.0.1:3003",
          "http://127.0.0.1:3004",
          "http://127.0.0.1:3005",
          "https://prepsensei.elinity.in",
          "http://prepsensei.elinity.in",
          "https://*.elinity.in",
          "http://*.elinity.in",
          "https://*.vercel.app",
          ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
          ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
          ...dynamicOrigins,
        ]),
      )
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production" || (process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false),
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" || (process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false),
      },
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalThis._betterAuthInstance = auth
}

export type SessionUser = typeof auth.$Infer.Session.user
