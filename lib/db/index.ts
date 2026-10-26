import net from "node:net"
import dns from "node:dns"

// Prefer IPv4 for Neon, but keep address failover enabled. Neon pooler hostnames
// can resolve to several IPv4 endpoints and one endpoint may be temporarily cold.
if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
  ;(net as any).setDefaultAutoSelectFamily(true)
}
if (typeof (dns as any).setDefaultResultOrder === "function") {
  ;(dns as any).setDefaultResultOrder("ipv4first")
}

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const connectionString = (process.env.DATABASE_URL || "").replace("sslmode=require", "sslmode=verify-full")

declare global {
  var _prepSenseiPool: Pool | undefined
  var _prepSenseiDb: ReturnType<typeof drizzle> | undefined
}

export const pool =
  globalThis._prepSenseiPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

if (process.env.NODE_ENV !== "production") {
  globalThis._prepSenseiPool = pool
}

export const db = globalThis._prepSenseiDb ?? drizzle(pool, { schema })

if (process.env.NODE_ENV !== "production") {
  globalThis._prepSenseiDb = db
}
