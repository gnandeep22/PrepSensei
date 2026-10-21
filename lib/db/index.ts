import net from "node:net"
import dns from "node:dns"

// Force IPv4-first and disable dual-stack autoselection to prevent IPv6 ENETUNREACH/ETIMEDOUT to Neon AWS
if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
  ;(net as any).setDefaultAutoSelectFamily(false)
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
    stream: () => {
      const s = new net.Socket()
      const origConnect = s.connect.bind(s)
      s.connect = function (port: any, host: any, cb?: any) {
        if (typeof port === "object") {
          return origConnect({ ...port, family: 4, autoSelectFamily: false }, host)
        }
        return origConnect({ port, host, family: 4, autoSelectFamily: false }, cb)
      }
      return s
    },
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
