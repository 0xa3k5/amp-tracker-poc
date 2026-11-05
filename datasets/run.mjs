// Runs one SQL file (or string) against Amp Flight with {{dataset}} set to the raw Ethereum dataset,
// saves rows to an optional output JSON and prints wall-clock ms and row count to stderr.
// Usage: node datasets/run.mjs <file.sql | "SQL"> [out.json]
import "../scripts/amp-access/env.mjs"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { ArrowFlight } from "@edgeandnode/amp"
import { layerTransportGrpc } from "@edgeandnode/amp/arrow-flight/node"
import { Effect, Layer, Redacted } from "effect"

const RAW = "edgeandnode/ethereum_mainnet@0.0.2"
const FlightLayer = ArrowFlight.layer.pipe(
  Layer.provide(layerTransportGrpc({ baseUrl: process.env.AMP_QUERY_URL })),
  Layer.provide(ArrowFlight.layerInterceptorToken(Redacted.make(process.env.AMP_CONTROLLER_JWT))),
)

export async function runSql(sql) {
  sql = sql.replaceAll("{{dataset}}", RAW)
  return Effect.runPromise(
    Effect.gen(function* () {
      const flight = yield* ArrowFlight.ArrowFlight
      const t0 = performance.now()
      const batches = yield* flight.query(sql, { binaryHandling: "hex", dateHandling: "iso" })
      return { ms: Math.round(performance.now() - t0), rows: batches.flatMap((b) => b.data) }
    }).pipe(Effect.provide(FlightLayer)),
  )
}

export const toJson = (rows) => JSON.stringify(rows, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  const sql = existsSync(arg) ? readFileSync(arg, "utf8") : arg
  const { ms, rows } = await runSql(sql).catch((e) => {
    console.error("query failed:", e?.cause?.rawMessage || e?.message || String(e))
    process.exit(1)
  })
  const out = toJson(rows)
  if (process.argv[3]) writeFileSync(process.argv[3], out)
  else console.log(out.length > 6000 ? out.slice(0, 6000) + "\n…" : out)
  console.error(JSON.stringify({ ms, rows: rows.length }))
}
