// Runs each query three times against Amp staging and records wall-clock ms (median, min, max)
// and rows in datasets/metrics.json. Usage: node datasets/bench.mjs
import { readFileSync, writeFileSync } from "node:fs"

import { runSql } from "./run.mjs"

const Q = [
  ["raw: stablecoin_freezes SQL on raw logs", "datasets/queries/raw-freezes.sql", 21548],
  ["derived: stablecoin_freezes", "datasets/queries/derived-freezes.sql", 21548],
  ["raw: USDT net flow at freeze block", "datasets/queries/raw-usdt-balance-at-freeze.sql", 21548],
  ["derived: USDT net flow at freeze block", "datasets/queries/derived-usdt-balance-at-freeze.sql", 21548],
  ["derived: legs per token (7.66M rows)", "datasets/queries/derived-balance-changes-count.sql", 21548],
]
const out = []
for (const [query, file, blocks] of Q) {
  const sql = readFileSync(file, "utf8")
  const runs = []
  let rows = 0
  for (let i = 0; i < 3; i++) {
    const r = await runSql(sql)
    runs.push(r.ms)
    rows = r.rows.length
  }
  runs.sort((a, b) => a - b)
  const m = { query, file, ms: runs[1], ms_min: runs[0], ms_max: runs[2], rows, blocks }
  console.log(JSON.stringify(m))
  out.push(m)
}
writeFileSync(new URL("./metrics.json", import.meta.url), JSON.stringify(out, null, 2) + "\n")
