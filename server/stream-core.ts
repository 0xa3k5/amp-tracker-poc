// Streaming queries against Amp over Arrow Flight (AMPD-29). Used by server/amp-stream.ts
// (the /api/stream route) and scripts/stream/measure.ts.
//
// Amp sends a streaming query as microbatches. Every record batch carries the block ranges it
// covers; a batch with `rangesComplete: true` closes the microbatch. Its ranges are the cursor:
// send them back as the `amp-resume` header and the stream continues at the next block.
import "../scripts/amp-access/env.mjs"
import { readFileSync } from "node:fs"

import type { Interceptor } from "@connectrpc/connect"

import { DEFAULT_DATASET, withDataset } from "../src/dataset.ts"
import type { StreamFreeze, StreamTransfer } from "../src/stream.ts"

export interface Range {
  network: string
  numbers: { start: number; end: number }
  hash: string
  prevHash?: string | undefined
}

export interface Microbatch {
  rows: Array<Record<string, unknown>>
  ranges: Array<Range>
  // performance.timeOrigin + now() when the closing batch arrived
  receivedAt: number
  // The range went back to or before the previous end block: a reorg (see query-sql-streaming.md)
  reorgFrom: number | null
}

// First block after the fixture window (26300743 to 26322290): anything from here is new.
export const DEFAULT_FROM_BLOCK = 26322291

export function streamSql(file: string, fromBlock: number) {
  const sql = readFileSync(new URL(`../data/queries/${file}`, import.meta.url), "utf8")
  return withDataset(sql, process.env.AMP_DATASET || DEFAULT_DATASET).replaceAll("{{from_block}}", String(fromBlock))
}

export function credentials() {
  const url = process.env.AMP_QUERY_URL
  const token = process.env.AMP_CONTROLLER_JWT
  return url && token ? { url, token } : null
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const cause = (error as { cause?: { rawMessage?: string; message?: string } }).cause
    if (cause?.rawMessage) return cause.rawMessage
    if (cause?.message) return cause.message
    if ("message" in error && typeof error.message === "string" && error.message) return error.message
  }
  return String(error)
}

// Amp sends a keep-alive every 30 s on an idle stream: a FlightData frame with an empty header
// and body. The SDK (amp-typescript 1b8cf83) reads the message type from the header without a
// length check and dies with "Offset is outside the bounds of the DataView". This interceptor
// drops those frames before the SDK sees them.
const dropKeepAlives: Interceptor = (next) => async (request) => {
  const response = await next(request)
  if (!response.stream) return response
  const frames = response.message as AsyncIterable<{ dataHeader?: Uint8Array }>
  async function* filtered() {
    for await (const frame of frames) if (frame.dataHeader && frame.dataHeader.length > 0) yield frame
  }
  return { ...response, message: filtered() as typeof response.message }
}

async function connect(url: string, token: string) {
  const { ArrowFlight } = await import("@edgeandnode/amp")
  const { layerTransportGrpc } = await import("@edgeandnode/amp/arrow-flight/node")
  const { Effect, Layer, Redacted } = await import("effect")
  const flightLayer = ArrowFlight.layer.pipe(
    Layer.provide(layerTransportGrpc({ baseUrl: url, interceptors: [dropKeepAlives] })),
    Layer.provide(ArrowFlight.layerInterceptorToken(Redacted.make(token))),
  )
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* ArrowFlight.ArrowFlight
    }).pipe(Effect.provide(flightLayer)),
  )
}

// A cursor that makes a fresh stream start at `fromBlock`: the number and hash of the block
// before it. A `_block_num >= N` filter is not enough. Amp skips the prefix for a single-table
// query, but stream-transfers.sql (a UNION ALL) started at block 0 and read all 24.7M blocks
// before our start block in 100,000-block microbatches.
export async function cursorBefore(fromBlock: number, options: { url: string; token: string }): Promise<Array<Range>> {
  const { Effect } = await import("effect")
  const flight = await connect(options.url, options.token)
  const block = fromBlock - 1
  const sql = `SELECT block_num, hash FROM "${process.env.AMP_DATASET || DEFAULT_DATASET}".blocks WHERE _block_num = ${block}`
  const batches = await Effect.runPromise(flight.query(sql, { binaryHandling: "hex", bigIntHandling: "string" }))
  const row = batches.flatMap((b) => b.data)[0]
  if (!row) throw new Error(`block ${block} is not in the dataset`)
  return [{ network: NETWORK, numbers: { start: block, end: block }, hash: String(row.hash) }]
}

const NETWORK = "ethereum-mainnet"

// Runs one streaming query and yields a Microbatch each time Amp closes one. Stops when the
// caller calls return() on the generator. Pass `resume` to continue from a cursor.
export async function* runStream(
  sql: string,
  options: { url: string; token: string; resume?: Array<Range> | undefined },
): AsyncGenerator<Microbatch> {
  const { Stream } = await import("effect")
  const flight = await connect(options.url, options.token)
  const stream = flight.streamQuery(sql, {
    stream: true,
    binaryHandling: "hex",
    dateHandling: "iso",
    bigIntHandling: "string",
    ...(options.resume ? { resumeWatermark: options.resume.map(toSdkRange) } : {}),
  })

  let rows: Array<Record<string, unknown>> = []
  const lastEnd = new Map<string, { end: number; hash: string }>()
  for (const r of options.resume ?? []) lastEnd.set(r.network, { end: r.numbers.end, hash: r.hash })
  let reorgFrom: number | null = null

  for await (const batch of Stream.toAsyncIterable(stream)) {
    const ranges = batch.metadata.ranges.map(fromSdkRange)
    for (const r of ranges) {
      const prev = lastEnd.get(r.network)
      if (prev && r.numbers.start <= prev.end && r.prevHash !== prev.hash) {
        reorgFrom = Math.min(reorgFrom ?? r.numbers.start, r.numbers.start)
      }
    }
    rows.push(...(batch.data as Array<Record<string, unknown>>))
    if (!batch.metadata.rangesComplete) continue
    for (const r of ranges) lastEnd.set(r.network, { end: r.numbers.end, hash: r.hash })
    yield { rows, ranges, receivedAt: performance.timeOrigin + performance.now(), reorgFrom }
    rows = []
    reorgFrom = null
  }
}

type SdkRange = {
  readonly network: string
  readonly numbers: { readonly start: number; readonly end: number }
  readonly hash: string
  readonly prevHash?: string | undefined
}
const fromSdkRange = (r: SdkRange): Range => ({
  network: r.network,
  numbers: { start: Number(r.numbers.start), end: Number(r.numbers.end) },
  hash: r.hash,
  prevHash: r.prevHash,
})
// The SDK's BlockRange uses branded types; the shape is the same.
const toSdkRange = (r: Range) => r as never

// --- Rows to events -------------------------------------------------------------------------

const tokenMeta = JSON.parse(
  readFileSync(new URL("../scripts/trace/token-meta.json", import.meta.url), "utf8"),
) as Record<string, { symbol: string; decimals: number }>
const ETH_USD = Number(
  (
    JSON.parse(readFileSync(new URL("../scripts/trace/eth-price.json", import.meta.url), "utf8")) as {
      eth_usd: number
    }
  ).eth_usd,
)
// Same lists as scripts/trace/build-fixtures.mjs
const STABLES = new Set(["USDT", "USDC", "RLUSD", "DAI", "USDe", "USDS", "FDUSD", "USD1", "frxUSD", "GHO"])
const ETH_LIKE = new Set(["ETH", "WETH", "stETH"])
const ZERO = "0x0000000000000000000000000000000000000000"

export function units(raw: string, decimals: number) {
  const v = BigInt(raw)
  const negative = v < 0n
  const abs = negative ? -v : v
  const base = 10n ** BigInt(decimals)
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${negative ? "-" : ""}${abs / base}${frac ? `.${frac}` : ""}`
}

const iso = (ts: unknown) => String(ts).replace(/\.\d+Z$/, "Z")
const str = (v: unknown) => String(v ?? "").toLowerCase()

export function toTransfer(row: Record<string, unknown>): StreamTransfer {
  const address = str(row.token_address)
  const isEth = address === "eth"
  const meta = isEth ? { symbol: "ETH", decimals: 18 } : tokenMeta[address]
  const amountRaw = String(row.amount_raw)
  const amount = meta ? units(amountRaw, meta.decimals) : amountRaw
  const event: StreamTransfer = {
    kind: "transfer",
    tx_hash: str(row.tx_hash),
    block_num: Number(row.block_num),
    ts: iso(row.timestamp),
    log_index: Number(row.log_index),
    token: meta?.symbol ?? "unknown",
    token_address: isEth ? ZERO : address,
    from: str(row.from_address),
    to: str(row.to_address),
    amount,
    amount_raw: amountRaw,
    decimals: meta?.decimals ?? null,
  }
  if (meta && STABLES.has(meta.symbol)) event.amount_usd = Number(amount).toFixed(2)
  if (meta && ETH_LIKE.has(meta.symbol)) event.amount_usd = (Number(amount) * ETH_USD).toFixed(2)
  return event
}

export function toFreeze(row: Record<string, unknown>): StreamFreeze {
  const decimals = Number(row.decimals)
  const raw = row.amount_raw
  return {
    kind: "freeze",
    block_num: Number(row.block_num),
    ts: iso(row.timestamp),
    address: str(row.account),
    token: String(row.symbol),
    token_address: str(row.token_address),
    event: String(row.event),
    action: String(row.action) as StreamFreeze["action"],
    freeze_tx: str(row.tx_hash),
    log_index: Number(row.log_index),
    amount: raw === null || raw === undefined ? null : units(String(raw), decimals),
    watched: row.watched === true,
  }
}
