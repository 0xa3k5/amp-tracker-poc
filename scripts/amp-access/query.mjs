// Runs one SQL statement against Amp Flight (AMP_QUERY_URL) and prints rows + wall-clock ms.
// Usage: node query.mjs <file.sql | "SQL"> [out.json]
import "./env.mjs"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

import { ArrowFlight } from "@edgeandnode/amp"
import { layerTransportGrpc } from "@edgeandnode/amp/arrow-flight/node"
import { Effect, Layer, Redacted } from "effect"

const arg = process.argv[2]
const sql = existsSync(arg) ? readFileSync(arg, "utf8") : arg
const FlightLayer = ArrowFlight.layer.pipe(
  Layer.provide(layerTransportGrpc({ baseUrl: process.env.AMP_QUERY_URL })),
  Layer.provide(ArrowFlight.layerInterceptorToken(Redacted.make(process.env.AMP_CONTROLLER_JWT))),
)
const program = Effect.gen(function* () {
  const flight = yield* ArrowFlight.ArrowFlight
  const t0 = performance.now()
  const batches = yield* flight.query(sql, { binaryHandling: "hex", dateHandling: "iso" })
  const ms = Math.round(performance.now() - t0)
  const rows = batches.flatMap((b) => b.data)
  return { ms, rows }
})
const { ms, rows } = await Effect.runPromise(program.pipe(Effect.provide(FlightLayer))).catch((e) => {
  console.error(
    "query failed:",
    e?.cause?.rawMessage || e?.message || String(e),
    JSON.stringify(e?.cause ?? e)?.slice(0, 1500),
  )
  process.exit(1)
})
const out = JSON.stringify(rows, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
if (process.argv[3]) writeFileSync(process.argv[3], out)
else console.log(out.length > 6000 ? out.slice(0, 6000) + "\n…" : out)
console.error(JSON.stringify({ ms, rows: rows.length }))
