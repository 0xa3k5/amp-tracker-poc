// Runs the trace queries in data/queries/ against Amp one after another, saves each
// result to raw-<name>.json here, and writes data/metrics.json with wall-clock ms,
// rows returned and blocks in range. Credentials and AMP_DATASET come from scripts/amp-access/env.mjs.
// Run: node scripts/trace/run-queries.mjs
import "../amp-access/env.mjs"
import { readFileSync, writeFileSync } from "node:fs"

import { ArrowFlight } from "@edgeandnode/amp"
import { layerTransportGrpc } from "@edgeandnode/amp/arrow-flight/node"
import { Effect, Layer, Redacted } from "effect"

import { DEFAULT_DATASET, withDataset } from "../../src/dataset.ts"

const QUERIES = ["attacker-transactions", "decoded-events", "fund-flow", "token-transfers", "usdt-freeze"]
const BLOCKS = 26322290 - 26300743 + 1

const FlightLayer = ArrowFlight.layer.pipe(
  Layer.provide(layerTransportGrpc({ baseUrl: process.env.AMP_QUERY_URL })),
  Layer.provide(ArrowFlight.layerInterceptorToken(Redacted.make(process.env.AMP_CONTROLLER_JWT))),
)
const run = (sql) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const flight = yield* ArrowFlight.ArrowFlight
      const t0 = performance.now()
      const batches = yield* flight.query(sql, { binaryHandling: "hex", dateHandling: "iso" })
      return { ms: Math.round(performance.now() - t0), rows: batches.flatMap((b) => b.data) }
    }).pipe(Effect.provide(FlightLayer)),
  )

const metrics = []
for (const name of QUERIES) {
  const sql = withDataset(
    readFileSync(new URL(`../../data/queries/${name}.sql`, import.meta.url), "utf8"),
    process.env.AMP_DATASET || DEFAULT_DATASET,
  )
  const { ms, rows } = await run(sql)
  const json = JSON.stringify(rows, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  writeFileSync(new URL(`./raw-${name}.json`, import.meta.url), json)
  metrics.push({ query: name, ms, rows: rows.length, blocks: BLOCKS })
  console.log(JSON.stringify(metrics.at(-1)))
}
writeFileSync(new URL("../../data/metrics.json", import.meta.url), JSON.stringify(metrics, null, 2) + "\n")
