// Runs one streaming query for a bounded time and logs every microbatch, to measure
// block-to-event latency, cursor resume and reorgs (AMPD-29).
//
// Usage: node scripts/stream/measure.ts <transfers|freezes|probe> <minutes> [from_block|resume]
//   transfers, freezes  data/queries/stream-<name>.sql
//   probe               scripts/stream/probe-blocks.sql, one row per block
//   from_block          first block for a fresh stream (default 26322291; probe needs one,
//                       or it would read every block since genesis)
//   resume              continue from the cursor saved by the last run of this stream
//
// Writes one JSON line per microbatch to scripts/stream/out/<name>.jsonl, and the cursor to
// scripts/stream/out/<name>.cursor.json. Latency is receive time minus the block timestamp of
// the newest row in the microbatch.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

import {
  credentials,
  cursorBefore,
  DEFAULT_FROM_BLOCK,
  errorMessage,
  type Range,
  runStream,
  streamSql,
} from "../../server/stream-core.ts"
import { DEFAULT_DATASET, withDataset } from "../../src/dataset.ts"

const [name = "", minutes = "5", start] = process.argv.slice(2)
if (!["transfers", "freezes", "probe"].includes(name)) {
  console.error("usage: node scripts/stream/measure.ts <transfers|freezes|probe> <minutes> [from_block|resume]")
  process.exit(2)
}
const creds = credentials()
if (!creds) {
  console.error("AMP_QUERY_URL and AMP_CONTROLLER_JWT must be set in amp-poc/.env")
  process.exit(2)
}

const out = new URL("./out/", import.meta.url)
mkdirSync(out, { recursive: true })
const log = new URL(`${name}.jsonl`, out)
const cursorFile = new URL(`${name}.cursor.json`, out)

let resume: Array<Range> | undefined
if (start === "resume") {
  if (!existsSync(cursorFile)) throw new Error(`no saved cursor in ${cursorFile.pathname}`)
  resume = JSON.parse(readFileSync(cursorFile, "utf8")) as Array<Range>
}
const fromBlock = start && start !== "resume" ? Number(start) : DEFAULT_FROM_BLOCK
if (name === "probe" && !start) throw new Error("probe needs a from_block near the head")

let sql: string
if (name === "probe") {
  const probe = readFileSync(new URL("./probe-blocks.sql", import.meta.url), "utf8")
  sql = withDataset(probe, process.env.AMP_DATASET || DEFAULT_DATASET).replaceAll("{{from_block}}", String(fromBlock))
} else {
  sql = streamSql(`stream-${name}.sql`, fromBlock)
}

const deadline = Date.now() + Number(minutes) * 60_000
const opened = Date.now()
let first = true
let batches = 0
const line = (v: unknown) => {
  const s = JSON.stringify(v)
  console.log(s)
  appendFileSync(log, s + "\n")
}
line({ event: "open", name, at: new Date(opened).toISOString(), from_block: resume ? null : fromBlock, resume })

// A fresh stream starts from the block before from_block (see cursorBefore)
resume ??= await cursorBefore(fromBlock, creds)
const iterator = runStream(sql, { ...creds, resume })
const timer = setTimeout(() => void iterator.return(undefined), Math.max(0, deadline - Date.now()))
try {
  for await (const mb of iterator) {
    batches++
    const newest = mb.rows.reduce<number | null>((max, r) => {
      const t = Date.parse(String(r.timestamp))
      return Number.isFinite(t) && (max === null || t > max) ? t : max
    }, null)
    const range = mb.ranges[0]
    line({
      event: "microbatch",
      at: new Date(mb.receivedAt).toISOString(),
      since_open_ms: Math.round(mb.receivedAt - opened),
      first,
      start: range?.numbers.start,
      end: range?.numbers.end,
      blocks: range ? range.numbers.end - range.numbers.start + 1 : 0,
      rows: mb.rows.length,
      newest_block_ts: newest === null ? null : new Date(newest).toISOString(),
      latency_ms: newest === null ? null : Math.round(mb.receivedAt - newest),
      reorg_from: mb.reorgFrom,
    })
    first = false
    writeFileSync(cursorFile, JSON.stringify(mb.ranges, null, 2) + "\n")
    if (Date.now() > deadline) break
  }
} catch (error) {
  line({ event: "error", at: new Date().toISOString(), message: errorMessage(error).slice(0, 500) })
  process.exitCode = 1
} finally {
  clearTimeout(timer)
}
line({ event: "close", at: new Date().toISOString(), batches })
process.exit()
