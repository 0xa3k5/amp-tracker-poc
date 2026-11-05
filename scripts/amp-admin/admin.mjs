// Guarded Amp Admin API client for the a3k5/stablecoin_forensics derived dataset (AMPD-27).
//
// Reads AMP_CONTROLLER_BASE_URL and AMP_ADMIN_JWT from amp-poc/.env via ../amp-access/env.mjs.
// The token is never printed. Only the calls listed in ALLOWED can be made, and every write
// is pinned to our own dataset. Provider endpoints are blocked outright: GET /providers
// returns provider RPC keys in plaintext.
//
// Usage:
//   node scripts/amp-admin/admin.mjs schema   <manifest.json> [--write]  # dry run on staging; --write fills schemas into the file
//   node scripts/amp-admin/admin.mjs register <manifest.json> <version>  # POST /datasets
//   node scripts/amp-admin/admin.mjs deploy   <version> <end_block|head> # POST /materialized-datasets/...
//                                         `head` deploys with no end block: the job follows the chain head
//   node scripts/amp-admin/admin.mjs status   <version>
//   node scripts/amp-admin/admin.mjs events   <version>
//   node scripts/amp-admin/admin.mjs stop     <version>
//   node scripts/amp-admin/admin.mjs dep                                 # GET the dependency's version info
import "../amp-access/env.mjs"
import { readFileSync, writeFileSync } from "node:fs"

const NS = "a3k5"
// The issue asked for `stablecoin-forensics`; dataset names must match ^[a-z_][a-z0-9_]*$, so
// the registered name is `stablecoin_forensics`. AMP_TRY_HYPHEN=1 sends the hyphenated name once
// to record the server's error.
const NAME = process.env.AMP_TRY_HYPHEN === "1" ? "stablecoin-forensics" : "stablecoin_forensics"
const DEP = { ns: "edgeandnode", name: "ethereum_mainnet", version: "0.0.2" }

const base = process.env.AMP_CONTROLLER_BASE_URL?.replace(/\/$/, "")
const token = process.env.AMP_ADMIN_JWT
if (!base || !token) {
  console.error("AMP_CONTROLLER_BASE_URL and AMP_ADMIN_JWT must be set in amp-poc/.env")
  process.exit(2)
}

const ours = `/materialized-datasets/${NS}/${NAME}/versions/`
const ALLOWED = [
  ["POST", (p) => p === "/schema"],
  ["POST", (p) => p === "/datasets"],
  ["GET", (p) => p === `/datasets/${DEP.ns}/${DEP.name}/versions/${DEP.version}`],
  ["GET", (p) => p.startsWith(`/datasets/${NS}/${NAME}/`)],
  ["POST", (p) => p.startsWith(ours) && !p.slice(ours.length).includes("/")],
  ["GET", (p) => p.startsWith(ours)],
  ["DELETE", (p) => p.startsWith(ours) && !p.slice(ours.length).includes("/")],
]

// Drop anything that looks like a credential before printing a response.
function redact(value) {
  const s = JSON.stringify(value, null, 2)
  return s
    .replace(/(https?:\/\/[^"\s]*?)(\/v\d+\/|\/)[A-Za-z0-9_-]{20,}/g, "$1$2<redacted>")
    .replace(/"(token|jwt|secret|key|api_key|apiKey|password|url|rpc_url)"\s*:\s*"[^"]*"/gi, '"$1": "<redacted>"')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<redacted-jwt>")
}

async function call(method, path, body) {
  if (/provider/i.test(path)) throw new Error(`blocked: ${path}`)
  if (!ALLOWED.some(([m, ok]) => m === method && ok(path))) throw new Error(`not allowed: ${method} ${path}`)
  const t0 = performance.now()
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const ms = Math.round(performance.now() - t0)
  const text = await res.text()
  let parsed
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text.slice(0, 2000)
  }
  console.log(redact({ request: `${method} ${path}`, status: res.status, ms, body: parsed }))
  if (!res.ok) process.exitCode = 1
  return parsed
}

const [cmd, a, b] = process.argv.slice(2)
const manifest = () => JSON.parse(readFileSync(a, "utf8"))

switch (cmd) {
  case "schema": {
    const m = manifest()
    const tables = Object.fromEntries(Object.entries(m.tables).map(([k, t]) => [k, t.input.sql]))
    const res = await call("POST", "/schema", { dependencies: m.dependencies, tables })
    if (b === "--write" && res?.schemas) {
      for (const [k, s] of Object.entries(res.schemas)) m.tables[k].schema = s
      writeFileSync(a, JSON.stringify(m, null, 2) + "\n")
      console.error(`schemas written into ${a}`)
    }
    break
  }
  case "register":
    if (!b) throw new Error("register needs <manifest.json> <version>")
    await call("POST", "/datasets", { namespace: NS, name: NAME, version: b, manifest: manifest() })
    break
  case "deploy":
    // The end block must be explicit: a number, or the word `head` for a continuous job.
    if (!a || !b) throw new Error("deploy needs <version> <end_block|head>")
    if (b !== "head" && !/^\d+$/.test(b)) throw new Error("end_block must be a block number or `head`")
    await call("POST", `${ours}${a}`, b === "head" ? {} : { end_block: String(b) })
    break
  case "status":
    await call("GET", `${ours}${a}`)
    break
  case "events":
    await call("GET", `${ours}${a}/events`)
    break
  case "stop":
    await call("DELETE", `${ours}${a}`)
    break
  case "dep":
    await call("GET", `/datasets/${DEP.ns}/${DEP.name}/versions/${DEP.version}`)
    break
  default:
    console.error("unknown command; see the header of this file")
    process.exit(2)
}
