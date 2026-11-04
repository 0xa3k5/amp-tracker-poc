// Turns the raw query results in this folder (raw-*.json, written by run-queries.mjs)
// into the app fixtures in data/: transactions.json, transfers.json, and new
// intermediaries in addresses.json. Run: node scripts/trace/build-fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs"

const here = (f) => new URL(`./${f}`, import.meta.url)
const data = (f) => new URL(`../../data/${f}`, import.meta.url)
const read = (u) => JSON.parse(readFileSync(u, "utf8"))
const write = (u, v) => writeFileSync(u, JSON.stringify(v, null, 2) + "\n")

const txRows = read(here("raw-attacker-transactions.json"))
const eventRows = read(here("raw-decoded-events.json"))
const transferRows = read(here("raw-token-transfers.json"))
const freezeRows = read(here("raw-usdt-freeze.json"))
const tokenMeta = read(here("token-meta.json"))
// Start from the researched list (AMPD-18) so reruns do not stack duplicates
const addresses = read(here("addresses.research.json"))

// ETH price implied on chain by the attacker's own USDT-for-ETH sales (see README.md)
const ETH_USD = Number(read(here("eth-price.json")).eth_usd)
const STABLES = new Set([
  "USDT",
  "USDC",
  "RLUSD",
  "DAI",
  "USDe",
  "USDS",
  "FDUSD",
  "USD1",
  "frxUSD",
  "GHO",
  "aEthUSDT",
  "aEthUSDC",
])
const ETH_LIKE = new Set(["ETH", "WETH", "aEthWETH", "stETH"])

const SELECTORS = {
  "0x095ea7b3": "approve",
  "0x8a179be4": "sweep",
  "0xa9059cbb": "transfer",
  "0x3593564c": "execute",
  "0x043ff9d2": "callExecute",
  "0x617ba037": "supply",
  "0xc04a8a10": "approveDelegation",
  "0xe74f7b85": "borrowETH",
  "0xe9ae5c53": "execute",
  "0x5ae401dc": "multicall",
  "0xedad400c": "swapExactIn",
  "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
  "0xb858183f": "exactInput",
  "0x791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens",
  "0xac9650d8": "multicall",
  "0x2e1a7d4d": "withdraw",
  "0xc01a8c84": "confirmTransaction",
}
const method = (selector) => (selector === "0x" ? "" : (SELECTORS[selector] ?? selector))

const iso = (ts) => ts.replace(/\.\d+Z$/, "Z")
function units(raw, decimals) {
  const v = BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const whole = v / base
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : `${whole}`
}

// Tokens the actors really used: moved inside a transaction a seed or Binance signed.
// Lookalike tokens only ever move in transactions their poisoners sign.
const actorTxs = new Set(txRows.map((t) => t.tx_hash))
const usedTokens = new Set(
  transferRows.filter((t) => actorTxs.has(t.tx_hash) && t.token_address !== "ETH").map((t) => t.token_address),
)
const asciiSymbol = (s) => typeof s === "string" && /^[A-Za-z0-9.]+$/.test(s)
const allowed = (token) => usedTokens.has(token) && asciiSymbol(tokenMeta[token]?.symbol)

function token(address) {
  if (address === "ETH") return { symbol: "ETH", decimals: 18, address: "0x0000000000000000000000000000000000000000" }
  const m = tokenMeta[address]
  return { symbol: m.symbol, decimals: m.decimals, address }
}
function usd(symbol, amount) {
  if (STABLES.has(symbol)) return Number(amount).toFixed(2)
  if (ETH_LIKE.has(symbol)) return (Number(amount) * ETH_USD).toFixed(2)
  return undefined
}

const droppedTokens = new Set()
const transfers = []
for (const t of transferRows) {
  if (t.token_address !== "ETH" && !allowed(t.token_address)) {
    droppedTokens.add(t.token_address)
    continue
  }
  const tok = token(t.token_address)
  const amount = units(t.amount_raw, tok.decimals)
  const row = {
    tx_hash: t.tx_hash,
    block_num: Number(t.block_num),
    ts: iso(t.timestamp),
    token: tok.symbol,
    token_address: tok.address,
    from: t.from_address,
    to: t.to_address,
    amount,
  }
  const u = usd(tok.symbol, amount)
  if (u !== undefined) row.amount_usd = u
  transfers.push(row)
}

const KEEP_EVENTS = new Set(["Transfer", "Deposit", "Withdrawal", "AddedBlackList"])
const eventsByTx = new Map()
let keptEvents = 0
for (const e of eventRows) {
  if (!KEEP_EVENTS.has(e.event)) continue
  if (e.event === "Transfer" && !allowed(e.contract)) continue
  const names = e.arg_names.split(",")
  const vals = [e.arg_1, e.arg_2, e.arg_3]
  const args = Object.fromEntries(names.map((n, i) => [n, vals[i]]))
  const list = eventsByTx.get(e.tx_hash) ?? []
  list.push({ name: e.event, contract: e.contract, args })
  eventsByTx.set(e.tx_hash, list)
  keptEvents++
}

const transactions = txRows.map((t) => ({
  hash: t.tx_hash,
  block_num: Number(t.block_num),
  ts: iso(t.timestamp),
  from: t.from_address,
  to: t.to_address,
  value_eth: units(t.value_wei, 18),
  method: method(t.method_selector),
  events: eventsByTx.get(t.tx_hash) ?? [],
}))

// Freeze transactions are signed by Tether's multisig owners, so they are not in the seed set
const freezeByTx = new Map()
for (const f of freezeRows) {
  const tx = freezeByTx.get(f.tx_hash) ?? {
    hash: f.tx_hash,
    block_num: Number(f.block_num),
    ts: iso(f.timestamp),
    from: f.from_address,
    to: f.to_address,
    value_eth: "0",
    method: method(f.method_selector),
    events: [],
  }
  tx.events.push({
    name: "AddedBlackList",
    contract: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    args: { _user: f.frozen_address },
  })
  freezeByTx.set(f.tx_hash, tx)
}
const txHashes = new Set(transactions.map((t) => t.hash))
for (const tx of freezeByTx.values()) if (!txHashes.has(tx.hash)) transactions.push(tx)
transactions.sort((a, b) => a.block_num - b.block_num)

// New intermediaries: hop-1 wallets that received at least $1M or 250 ETH from a seed
const known = new Set(addresses.map((a) => a.address))
const seeds = new Set(addresses.filter((a) => a.role === "attacker" || a.role === "intermediary").map((a) => a.address))
const hop1Senders = new Set(transferRows.filter((t) => String(t.hop) === "1").map((t) => t.from_address))
const received = new Map()
for (const t of transfers) {
  if (!seeds.has(t.from) || !hop1Senders.has(t.to) || known.has(t.to)) continue
  const r = received.get(t.to) ?? { usd: 0, eth: 0, from: new Set() }
  r.usd += Number(t.amount_usd ?? 0)
  if (ETH_LIKE.has(t.token)) r.eth += Number(t.amount)
  r.from.add(t.from)
  received.set(t.to, r)
}
const sent = (address) => transfers.filter((t) => t.from === address).length
const added = []
for (const [address, r] of [...received].sort((a, b) => b[1].usd - a[1].usd)) {
  if (r.usd < 1_000_000 && r.eth < 250) continue
  const from = [...r.from].map((a) => `${a.slice(0, 6)}…${a.slice(-4)}`).join(", ")
  const entry = {
    address,
    label: `Hop 1. Received about $${(r.usd / 1e6).toFixed(1)}M from ${from} and sent ${sent(address)} transfers on in the window. Counterparty only, no attribution`,
    role: "intermediary",
    source: "Amp trace",
  }
  addresses.push(entry)
  added.push(entry)
}

write(data("transactions.json"), transactions)
write(data("transfers.json"), transfers)
write(data("addresses.json"), addresses)
console.log(
  JSON.stringify(
    {
      transactions: transactions.length,
      events: keptEvents,
      transfers: transfers.length,
      droppedTokens: droppedTokens.size,
      droppedTransfers: transferRows.length - transfers.length,
      addedIntermediaries: added.map((a) => `${a.address} ${a.label}`),
    },
    null,
    1,
  ),
)
