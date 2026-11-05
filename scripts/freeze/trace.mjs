// Follows ERC-20 transfers outward from the three Binance hot wallets, hop by hop,
// inside blocks 26300743 to 26322290, using only Amp. Writes the reached graph to
// scripts/freeze/out/trace.json and the per-query timings to scripts/freeze/out/trace-metrics.json.
//
// Rules, applied at every hop:
// 1. Only Transfer logs with a non-zero value. This drops zero-value address-poisoning spam.
// 2. Only transfers at or after the block where the sender was first reached.
//    Funds cannot leave before they arrive.
// 3. Only tokens with at least MIN_TOKEN_SENDERS distinct senders in the window.
//    Lookalike tokens that fake a Transfer "from" a Binance wallet have few real senders.
// 4. An address that received non-zero transfers of those real tokens from more than
//    MAX_DEGREE distinct senders in the window is a hub (DEX router, pool, exchange deposit
//    or settlement contract). It is recorded but not expanded. The three seeds are exempt.
//    We count senders, not all counterparties: the attacker wallets get many spam and
//    poisoning transfers, and they pay out to many wallets on purpose.
// 5. FOCUS=issuer follows only the eight freeze-capable issuer tokens, and only transfers
//    of at least ISSUER_MIN units (10,000 for the dollar tokens, 2 for the gold tokens,
//    about $10,000 either way). Without it, every real token is followed, and the graph
//    grows past 5,000 addresses by hop 3.
// Run: node scripts/freeze/trace.mjs            (every real token, writes out/trace-all.json)
//      FOCUS=issuer node scripts/freeze/trace.mjs (issuer tokens, writes out/trace.json)
import { mkdirSync, writeFileSync } from "node:fs"

import { runSql } from "./run.mjs"

const FROM = 26300743
const TO = 26322290
const MAX_HOPS = Number(process.env.MAX_HOPS ?? 8)
const MAX_DEGREE = 50
const MIN_TOKEN_SENDERS = 50
const FOCUS = process.env.FOCUS === "issuer"
const OUT = FOCUS ? "trace" : "trace-all"
// token -> [decimals, minimum units to follow]
const ISSUER_MIN = {
  "0xdac17f958d2ee523a2206206994597c13d831ec7": [6, 10000n], // USDT
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": [6, 10000n], // USDC
  "0x8292bb45bf1ee4d140127049757c2e0ff06317ed": [18, 10000n], // RLUSD
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": [18, 10000n], // USD1
  "0xc5f0f7b66764f6ec8c8dff7ba683102295e16409": [18, 10000n], // FDUSD
  "0x6c3ea9036406852006290770bedfcaba0e23a0e8": [6, 10000n], // PYUSD
  "0x68749665ff8d2d112fa859aa293f07a622782f38": [6, 2n], // XAUt
  "0x45804880de22913dafe09f4980848ece6ecbaf78": [18, 2n], // PAXG
}
const followed = (e) => {
  if (!FOCUS) return true
  const m = ISSUER_MIN[e.token]
  return m && BigInt(e.amount_raw) >= m[1] * 10n ** BigInt(m[0])
}
const SEEDS = [
  "0x28c6c06298d514db089934071355e5743bf21d60",
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d",
  "0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055",
]
const TRANSFER = "'Transfer(address indexed from, address indexed to, uint256 value)'"
const topic = (a) => `evm_encode_hex('0x000000000000000000000000${a.slice(2)}')`
const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

const metrics = []
const tokenSenders = new Map() // token -> distinct senders in the window
async function q(name, sql) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { ms, rows } = await runSql(sql)
      metrics.push({ query: name, ms, rows: rows.length, blocks: TO - FROM + 1 })
      console.error(JSON.stringify(metrics.at(-1)))
      return rows
    } catch (e) {
      if (attempt >= 3) throw e
      console.error(`${name}: retry ${attempt}`, e?.cause?.rawMessage || e?.message)
    }
  }
}

const edgesSql = (senders) => `
SELECT block_num, evm_decode_hex(tx_hash) AS tx_hash, log_index, evm_decode_hex(address) AS token,
       evm_decode_hex(d['from']) AS sender, evm_decode_hex(d['to']) AS recipient,
       arrow_cast(d['value'], 'Utf8') AS amount_raw
FROM (
  SELECT block_num, tx_hash, log_index, address,
         evm_decode_log(topic1, topic2, topic3, data, ${TRANSFER}) AS d
  FROM "{{dataset}}".logs
  WHERE _block_num BETWEEN ${FROM} AND ${TO}
    AND topic0 = evm_topic(${TRANSFER})
    AND topic3 IS NULL
    AND topic1 IN (${senders.map(topic).join(", ")})${
      FOCUS
        ? `
    AND address IN (${Object.keys(ISSUER_MIN)
      .map((t) => `evm_encode_hex('${t}')`)
      .join(", ")})`
        : ""
    }
)
WHERE d['value'] <> '0'`

// Distinct senders per (recipient, token), for non-zero transfers into the given addresses.
const inboundSql = (addrs) => `
SELECT '0x' || substr(evm_decode_hex(topic2), 27) AS address, evm_decode_hex(address) AS token,
       count(DISTINCT topic1) AS senders
FROM "{{dataset}}".logs
WHERE _block_num BETWEEN ${FROM} AND ${TO}
  AND topic0 = evm_topic(${TRANSFER})
  AND topic3 IS NULL
  AND data <> evm_encode_hex('0x${"0".repeat(64)}')
  AND topic2 IN (${addrs.map(topic).join(", ")})
GROUP BY 1, 2`

// Exact distinct senders across the given real tokens, for addresses near the cutoff.
const exactSql = (addrs, tokens) => `
SELECT '0x' || substr(evm_decode_hex(topic2), 27) AS address, count(DISTINCT topic1) AS senders
FROM "{{dataset}}".logs
WHERE _block_num BETWEEN ${FROM} AND ${TO}
  AND topic0 = evm_topic(${TRANSFER})
  AND topic3 IS NULL
  AND data <> evm_encode_hex('0x${"0".repeat(64)}')
  AND topic2 IN (${addrs.map(topic).join(", ")})
  AND address IN (${tokens.map((t) => `evm_encode_hex('${t}')`).join(", ")})
GROUP BY 1`

// One window-wide query lists every token with at least MIN_TOKEN_SENDERS distinct senders.
// Any token not on the list counts as a lookalike or spam token.
const realTokensSql = `
SELECT evm_decode_hex(address) AS token, count(DISTINCT topic1) AS senders
FROM "{{dataset}}".logs
WHERE _block_num BETWEEN ${FROM} AND ${TO}
  AND topic0 = evm_topic(${TRANSFER})
  AND topic3 IS NULL
GROUP BY 1
HAVING count(DISTINCT topic1) >= ${MIN_TOKEN_SENDERS}`
for (const r of await q("trace-real-tokens", realTokensSql)) tokenSenders.set(r.token, Number(r.senders))
const isReal = (t) => (tokenSenders.get(t) ?? 0) >= MIN_TOKEN_SENDERS

// In-degree per address over real tokens. Summing per-token counts gives an upper bound
// and the largest single-token count a lower bound; only addresses between them get an
// exact query.
async function inDegree(addrs, hop) {
  const rows = []
  for (const [i, part] of chunk(addrs, 100).entries())
    rows.push(...(await q(`trace-hop${hop}-inbound-${i}`, inboundSql(part))))
  const lo = new Map(),
    hi = new Map(),
    toks = new Map()
  for (const r of rows) {
    if (!isReal(r.token)) continue
    const n = Number(r.senders)
    lo.set(r.address, Math.max(lo.get(r.address) ?? 0, n))
    hi.set(r.address, (hi.get(r.address) ?? 0) + n)
    toks.set(r.address, [...(toks.get(r.address) ?? []), r.token])
  }
  const degree = new Map(addrs.map((a) => [a, hi.get(a) ?? 0]))
  const unsure = addrs.filter((a) => (lo.get(a) ?? 0) <= MAX_DEGREE && (hi.get(a) ?? 0) > MAX_DEGREE)
  for (const [i, part] of chunk(unsure, 50).entries()) {
    const tokens = [...new Set(part.flatMap((a) => toks.get(a)))]
    for (const r of await q(`trace-hop${hop}-exact-${i}`, exactSql(part, tokens)))
      degree.set(r.address, Number(r.senders))
  }
  return degree
}

const nodes = new Map() // address -> { hop, arrival_block, degree, hub, parent_edge }
for (const s of SEEDS) nodes.set(s, { hop: 0, arrival_block: FROM, degree: null, hub: false, parent: null })
const edges = []
let frontier = [...SEEDS]
function save(hopsDone, seconds) {
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true })
  writeFileSync(
    new URL(`./out/${OUT}.json`, import.meta.url),
    JSON.stringify(
      {
        rules: { FROM, TO, MAX_HOPS, MAX_DEGREE, MIN_TOKEN_SENDERS, FOCUS: FOCUS ? "issuer" : "all" },
        hopsDone,
        seconds,
        seeds: SEEDS,
        nodes: Object.fromEntries(nodes),
        edges,
        realTokens: tokenSenders.size,
      },
      null,
      1,
    ),
  )
  writeFileSync(new URL(`./out/${OUT}-metrics.json`, import.meta.url), JSON.stringify(metrics, null, 2))
}
const t0 = performance.now()

for (let hop = 1; hop <= MAX_HOPS && frontier.length; hop++) {
  let raw = []
  for (const [i, part] of chunk(frontier, 200).entries())
    raw.push(...(await q(`trace-hop${hop}-edges-${i}`, edgesSql(part))))
  raw = raw.filter((e) => Number(e.block_num) >= nodes.get(e.sender).arrival_block)

  const kept = raw.filter((e) => isReal(e.token) && followed(e))

  const fresh = new Map() // recipient -> earliest edge
  for (const e of kept.sort(
    (a, b) => Number(a.block_num) - Number(b.block_num) || Number(a.log_index) - Number(b.log_index),
  )) {
    edges.push({ hop, ...e })
    if (!nodes.has(e.recipient) && !fresh.has(e.recipient)) fresh.set(e.recipient, e)
  }
  const degree = await inDegree([...fresh.keys()], hop)

  frontier = []
  for (const [addr, e] of fresh) {
    const d = degree.get(addr) ?? 0
    const hub = d > MAX_DEGREE
    nodes.set(addr, {
      hop,
      arrival_block: Number(e.block_num),
      degree: d,
      hub,
      parent: {
        from: e.sender,
        tx_hash: e.tx_hash,
        token: e.token,
        block_num: Number(e.block_num),
        amount_raw: e.amount_raw,
      },
    })
    if (!hub) frontier.push(addr)
  }
  console.error(
    `hop ${hop}: ${raw.length} transfers, ${kept.length} after token filter, ${fresh.size} new addresses, ${frontier.length} to expand, ${Math.round((performance.now() - t0) / 1000)} s`,
  )
  save(hop, Math.round((performance.now() - t0) / 1000))
}
