import "../scripts/amp-access/env.mjs"
import { readFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"

import type { Connect, Plugin } from "vite"

import { DEFAULT_DATASET, withDataset } from "../src/dataset.ts"

export interface QueryRequest {
  name: string
}

export interface QueryResponse {
  ms: number
  rows: number
}

export function ampDataset() {
  return process.env.AMP_DATASET || DEFAULT_DATASET
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Array<Buffer> = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const cause = (error as { cause?: { rawMessage?: string; message?: string } }).cause
    if (cause?.rawMessage) return cause.rawMessage
    if (cause?.message) return cause.message
    if ("message" in error && typeof error.message === "string" && error.message) return error.message
  }
  return String(error)
}

async function runQuery(sql: string, url: string, token: string): Promise<QueryResponse> {
  const { ArrowFlight } = await import("@edgeandnode/amp")
  const { layerTransportGrpc } = await import("@edgeandnode/amp/arrow-flight/node")
  const { Effect, Layer, Redacted } = await import("effect")

  const flightLayer = ArrowFlight.layer.pipe(
    Layer.provide(layerTransportGrpc({ baseUrl: url })),
    Layer.provide(ArrowFlight.layerInterceptorToken(Redacted.make(token))),
  )
  const program = Effect.gen(function* () {
    const flight = yield* ArrowFlight.ArrowFlight
    const start = performance.now()
    const batches = yield* flight.query(sql, { binaryHandling: "hex", dateHandling: "iso" })
    const ms = Math.round(performance.now() - start)
    return { ms, rows: batches.reduce((sum, batch) => sum + batch.data.length, 0) }
  })
  return Effect.runPromise(program.pipe(Effect.provide(flightLayer)))
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  let name: unknown
  try {
    name = ((await readJson(req)) as Partial<QueryRequest>).name
  } catch {
    return send(res, 400, { error: "Body must be JSON" })
  }
  if (typeof name !== "string" || !/^[a-z0-9-]+$/.test(name)) {
    return send(res, 400, { error: "Body needs the `name` of a file in data/queries" })
  }

  let sql: string
  try {
    sql = await readFile(new URL(`../data/queries/${name}.sql`, import.meta.url), "utf8")
  } catch {
    return send(res, 404, { error: `No query named ${name} in data/queries` })
  }

  const url = process.env.AMP_QUERY_URL
  const token = process.env.AMP_CONTROLLER_JWT
  if (!url || !token) {
    return send(res, 503, {
      error: "No Amp credentials. Set AMP_QUERY_URL and AMP_CONTROLLER_JWT in amp-poc/.env and restart pnpm dev.",
    })
  }

  try {
    return send(res, 200, await runQuery(withDataset(sql, ampDataset()), url, token))
  } catch (error) {
    return send(res, 502, { error: `Amp query failed: ${errorMessage(error)}` })
  }
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url !== "/api/query") return next()
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" })
  void handle(req, res)
}

export function ampQuery(): Plugin {
  return {
    name: "incident-tracer-amp-query",
    config() {
      return { define: { __AMP_DATASET__: JSON.stringify(ampDataset()) } }
    },
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
