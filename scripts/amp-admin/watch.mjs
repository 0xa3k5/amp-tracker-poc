// Polls the materialization status of a3k5/stablecoin_forensics every 20 s and appends one
// summary line per poll to datasets/out/job-<version>.log. Stops when the job leaves RUNNING
// or after the time limit, whichever comes first. It never stops the job itself.
// Usage: node scripts/amp-admin/watch.mjs <version> [max_minutes=8]
import "../amp-access/env.mjs"
import { appendFileSync, mkdirSync } from "node:fs"

const [version, maxMin = "8"] = process.argv.slice(2)
const base = process.env.AMP_CONTROLLER_BASE_URL.replace(/\/$/, "")
const url = `${base}/materialized-datasets/a3k5/stablecoin_forensics/versions/${version}`
mkdirSync(new URL("../../datasets/out/", import.meta.url), { recursive: true })
const log = new URL(`../../datasets/out/job-${version}.log`, import.meta.url)
const deadline = Date.now() + Number(maxMin) * 60_000

while (true) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${process.env.AMP_ADMIN_JWT}` } })
  const s = await res.json()
  const m = s.materialization ?? {}
  const tables = Object.entries(m.progress?.tables ?? {})
    .map(([k, t]) => {
      const n = t.networks?.[0]
      const at = n ? `${n.current_block ?? n.end_block ?? JSON.stringify(n)}` : "-"
      return `${k}: block ${at} files ${t.files_count} bytes ${t.total_size_bytes} wm ${t.watermark_timestamp}`
    })
    .join(" | ")
  const line = `${new Date().toISOString()} ${s.status}/${m.status} ${tables}`
  console.log(line)
  appendFileSync(log, line + "\n")
  if (m.status !== "RUNNING" && m.status !== "SCHEDULED") break
  if (Date.now() > deadline) break
  await new Promise((r) => setTimeout(r, 20_000))
}
