// Runs one SQL file (or string) against Amp with {{dataset}} filled in, saves rows to
// an output JSON and prints wall-clock ms and row count to stderr.
// Usage: node scripts/freeze/run.mjs <file.sql | "SQL"> [out.json]
import "../amp-access/env.mjs"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { ArrowFlight } from "@edgeandnode/amp"
import { layerTransportGrpc } from "@edgeandnode/amp/arrow-flight/node"
import { Effect, Layer, Redacted } from "effect"

import { DEFAULT_DATASET, withDataset } from "../../src/dataset.ts"

const FlightLayer = ArrowFlight.layer.pipe(
  Layer.provide(layerTransportGrpc({ baseUrl: process.env.AMP_QUERY_URL })),
  Layer.provide(ArrowFlight.layerInterceptorToken(Redacted.make(process.env.AMP_CONTROLLER_JWT))),
)

export async function runSql(sql) {
  sql = withDataset(sql, process.env.AMP_DATASET || DEFAULT_DATASET)
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
    console.error(
      "query failed:",
      e?.cause?.rawMessage || e?.message || String(e),
      JSON.stringify(e?.cause ?? e)?.slice(0, 1500),
    )
    process.exit(1)
  })
  const out = toJson(rows)
  if (process.argv[3]) writeFileSync(process.argv[3], out)
  else console.log(out.length > 8000 ? out.slice(0, 8000) + "\n…" : out)
  console.error(JSON.stringify({ ms, rows: rows.length }))
}
