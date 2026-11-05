// GET /api/stream: server-sent events with new transfers and freezes as Amp streams them (AMPD-29).
//
// One hub per server runs the two streaming queries in data/queries/ (stream-transfers.sql and
// stream-freezes.sql), whatever the number of open tabs, so staging only ever sees two streams.
// The hub starts with the first client and stops a minute after the last one leaves. After every
// microbatch it saves the stream's cursor to .amp-stream/cursors.json, so a restart resumes
// where it stopped instead of reading from the start block again.
//
// Each SSE message is one JSON StreamEvent (src/stream.ts) in `data:`, with no event name, so
// EventSource.onmessage gets them all. A new client first gets the last 500 events this server
// has seen; add ?replay=0 to skip them.
//
// Env: AMP_QUERY_URL and AMP_CONTROLLER_JWT (from .env), AMP_STREAM_FROM_BLOCK for the first
// block of a fresh stream (default 26322291, the first block after the fixtures).
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"

import type { Connect, Plugin } from "vite"

import type { StreamEvent, StreamName } from "../src/stream.ts"
import {
  credentials,
  cursorBefore,
  DEFAULT_FROM_BLOCK,
  errorMessage,
  type Microbatch,
  type Range,
  runStream,
  streamSql,
  toFreeze,
  toTransfer,
} from "./stream-core.ts"

const STREAMS: Record<StreamName, { file: string; toEvents: (rows: Microbatch["rows"]) => Array<StreamEvent> }> = {
  transfers: { file: "stream-transfers.sql", toEvents: (rows) => rows.map(toTransfer) },
  freezes: { file: "stream-freezes.sql", toEvents: (rows) => rows.map(toFreeze) },
}
const REPLAY = 500
const IDLE_STOP_MS = 60_000
const PING_MS = 15_000

const cursorDir = new URL("../.amp-stream/", import.meta.url)
const cursorFile = new URL("cursors.json", cursorDir)
type Saved = Partial<Record<StreamName, { sql: string; ranges: Array<Range> }>>

function loadCursors(): Saved {
  try {
    return JSON.parse(readFileSync(cursorFile, "utf8")) as Saved
  } catch {
    return {}
  }
}

// The cursor belongs to the SQL text: if the query file changes, the stream starts fresh.
function sqlKey(file: string) {
  const text = readFileSync(new URL(`../data/queries/${file}`, import.meta.url), "utf8")
  return createHash("sha256").update(text).digest("hex").slice(0, 16)
}

const now = () => new Date().toISOString()

class Hub {
  private clients = new Set<ServerResponse>()
  private buffer: Array<{ id: number; event: StreamEvent }> = []
  private nextId = 1
  private running = new Map<StreamName, { stop: () => void }>()
  private idleTimer: NodeJS.Timeout | undefined
  private cursors = loadCursors()

  add(res: ServerResponse, replay: boolean) {
    clearTimeout(this.idleTimer)
    this.clients.add(res)
    if (replay) for (const { id, event } of this.buffer) write(res, id, event)
    const creds = credentials()
    if (!creds) {
      write(res, 0, {
        kind: "error",
        stream: null,
        message: "No Amp credentials. Set AMP_QUERY_URL and AMP_CONTROLLER_JWT in amp-poc/.env and restart pnpm dev.",
        ts: now(),
      })
      return
    }
    for (const name of Object.keys(STREAMS) as Array<StreamName>) {
      if (!this.running.has(name)) this.start(name, creds)
    }
  }

  remove(res: ServerResponse) {
    this.clients.delete(res)
    if (this.clients.size > 0) return
    this.idleTimer = setTimeout(() => {
      for (const r of this.running.values()) r.stop()
      this.running.clear()
    }, IDLE_STOP_MS)
  }

  private emit(event: StreamEvent) {
    const id = this.nextId++
    this.buffer.push({ id, event })
    if (this.buffer.length > REPLAY) this.buffer.splice(0, this.buffer.length - REPLAY)
    for (const res of this.clients) write(res, id, event)
  }

  private start(name: StreamName, creds: { url: string; token: string }) {
    let stopped = false
    let iterator: AsyncGenerator<Microbatch> | undefined
    this.running.set(name, {
      stop: () => {
        stopped = true
        void iterator?.return(undefined)
      },
    })
    const { file, toEvents } = STREAMS[name]
    const key = sqlKey(file)
    const fromBlock = Number(process.env.AMP_STREAM_FROM_BLOCK || DEFAULT_FROM_BLOCK)

    const loop = async () => {
      let backoff = 5_000
      while (!stopped) {
        const saved = this.cursors[name]
        try {
          const resume = saved?.sql === key ? saved.ranges : await cursorBefore(fromBlock, creds)
          iterator = runStream(streamSql(file, fromBlock), { ...creds, resume })
          for await (const mb of iterator) {
            backoff = 5_000
            if (mb.reorgFrom !== null) {
              const from = mb.reorgFrom
              this.buffer = this.buffer.filter(
                ({ event }) =>
                  !(event.kind === (name === "transfers" ? "transfer" : "freeze") && event.block_num >= from),
              )
              this.emit({ kind: "reorg", stream: name, block_num: from, ts: now() })
            }
            for (const event of toEvents(mb.rows)) this.emit(event)
            const end = Math.max(...mb.ranges.map((r) => r.numbers.end))
            this.emit({ kind: "progress", stream: name, block_num: end, ts: now(), rows: mb.rows.length })
            this.cursors[name] = { sql: key, ranges: mb.ranges }
            mkdirSync(cursorDir, { recursive: true })
            writeFileSync(cursorFile, JSON.stringify(this.cursors, null, 2) + "\n")
            if (stopped) break
          }
        } catch (error) {
          if (stopped) break
          this.emit({ kind: "error", stream: name, message: `Amp stream failed: ${errorMessage(error)}`, ts: now() })
        }
        if (stopped) break
        // The stream ended or failed: reconnect from the saved cursor.
        await new Promise((r) => setTimeout(r, backoff))
        backoff = Math.min(backoff * 2, 60_000)
      }
    }
    void loop()
  }
}

function write(res: ServerResponse, id: number, event: StreamEvent) {
  res.write(`${id ? `id: ${id}\n` : ""}data: ${JSON.stringify(event)}\n\n`)
}

const hub = new Hub()

function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost")
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  })
  res.write("retry: 5000\n\n")
  const ping = setInterval(() => res.write(": ping\n\n"), PING_MS)
  hub.add(res, url.searchParams.get("replay") !== "0")
  req.on("close", () => {
    clearInterval(ping)
    hub.remove(res)
  })
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  if (!req.url?.startsWith("/api/stream")) return next()
  if (req.method !== "GET") {
    res.statusCode = 405
    return res.end("Use GET")
  }
  handle(req, res)
}

export function ampStream(): Plugin {
  return {
    name: "incident-tracer-amp-stream",
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
