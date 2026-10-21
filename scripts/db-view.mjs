import { Client } from "pg"

const tableName = process.argv[2]
const client = new Client({ connectionString: process.env.DATABASE_URL })

async function run() {
  await client.connect()

  if (tableName) {
    console.log(`\n=== Table: "${tableName}" ===\n`)
    try {
      const res = await client.query(`SELECT * FROM "${tableName}" LIMIT 20;`)
      if (res.rows.length === 0) {
        console.log(`Table "${tableName}" is currently empty (0 rows).\n`)
      } else {
        // Truncate long JSON fields or arrays for clean display
        const cleaned = res.rows.map((r) => {
          const row = { ...r }
          for (const [k, v] of Object.entries(row)) {
            if (Array.isArray(v) && v.length > 5) {
              row[k] = `[Array(${v.length})]`
            } else if (typeof v === "object" && v !== null) {
              const str = JSON.stringify(v)
              if (str.length > 60) row[k] = str.slice(0, 57) + "..."
            }
          }
          return row
        })
        console.table(cleaned)
        console.log(`Showing up to 20 rows of ${res.rowCount} total in this query.\n`)
      }
    } catch (err) {
      console.error(`Error querying "${tableName}":`, err.message)
    }
    await client.end()
    return
  }

  console.log(`\n======================================================`)
  console.log(`  PrepSensei Database Tables Overview`)
  console.log(`======================================================\n`)

  const tablesRes = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
  )

  const overview = []
  for (const row of tablesRes.rows) {
    const t = row.table_name
    const countRes = await client.query(`SELECT count(*) FROM "${t}";`)
    const colRes = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position;`,
      [t]
    )
    const columns = colRes.rows.map((c) => c.column_name).join(", ")
    overview.push({
      Table: t,
      Rows: Number(countRes.rows[0].count),
      Columns: columns.length > 50 ? columns.slice(0, 47) + "..." : columns,
    })
  }

  console.table(overview)
  console.log(`Tip: View rows for a specific table by running:`)
  console.log(`  pnpm run db:view <table_name>`)
  console.log(`  e.g. pnpm run db:view user`)
  console.log(`       pnpm run db:view face_registration`)
  console.log(`       pnpm run db:view interview_face_analysis\n`)

  await client.end()
}

run().catch((err) => {
  console.error("Database connection error:", err.message)
  process.exit(1)
})
