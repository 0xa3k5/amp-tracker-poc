import type { IncomingMessage, ServerResponse } from "node:http"

import type { Connect, Plugin } from "vite"

export interface QueryRequest {
  sql: string
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

const handler: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url !== "/api/query") return next()
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" })
  readJson(req)
    .then((body) => {
      const { sql } = body as Partial<QueryRequest>
      if (typeof sql !== "string" || sql.trim() === "") return send(res, 400, { error: "Body needs a `sql` string" })
      if (!process.env.AMP_QUERY_URL) {
        return send(res, 501, {
          error: "Live Amp queries are not wired yet. Set AMP_QUERY_URL once the endpoint is known.",
        })
      }
      return send(res, 501, { error: "Live Amp client not implemented yet" })
    })
    .catch(() => send(res, 400, { error: "Body must be JSON" }))
}

export function ampQuery(): Plugin {
  return {
    name: "incident-tracer-amp-query",
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
