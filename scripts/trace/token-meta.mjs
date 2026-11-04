// Reads symbol() and decimals() for every token in tokens.json at the latest block from a
// public, keyless RPC (PUBLIC_RPC env var, publicnode by default). 20 tokens per batch, 1 s apart.
import { readFileSync, writeFileSync } from "node:fs"
const RPC = process.env.PUBLIC_RPC ?? "https://ethereum-rpc.publicnode.com"
const BLOCK = "latest" // public nodes refuse archive calls; symbol and decimals do not change
const tokens = JSON.parse(readFileSync(new URL("./tokens.json", import.meta.url)))
const str = (h) => {
  if (!h || h === "0x") return null
  const b = Buffer.from(h.slice(2), "hex")
  if (b.length === 32) return b.toString("utf8").replace(/\0+$/, "")
  const len = Number(BigInt("0x" + b.subarray(32, 64).toString("hex")))
  return b.subarray(64, 64 + len).toString("utf8")
}
const meta = {}
for (let i = 0; i < tokens.length; i += 20) {
  const chunk = tokens.slice(i, i + 20)
  const batch = chunk.flatMap((to, j) => [
    { jsonrpc: "2.0", id: 2 * j, method: "eth_call", params: [{ to, data: "0x95d89b41" }, BLOCK] },
    { jsonrpc: "2.0", id: 2 * j + 1, method: "eth_call", params: [{ to, data: "0x313ce567" }, BLOCK] },
  ])
  const res = await (
    await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(batch) })
  ).json()
  const byId = new Map(res.map((r) => [r.id, r.result]))
  chunk.forEach((t, j) => {
    const d = byId.get(2 * j + 1)
    let symbol = null
    try {
      symbol = str(byId.get(2 * j))
    } catch {}
    meta[t] = { symbol, decimals: d && d !== "0x" ? Number(BigInt(d)) : null }
  })
  await new Promise((r) => setTimeout(r, 1000))
}
writeFileSync(new URL("./token-meta.json", import.meta.url), JSON.stringify(meta, null, 1))
console.log(Object.keys(meta).length, Object.values(meta).filter((m) => m.decimals === null).length)
