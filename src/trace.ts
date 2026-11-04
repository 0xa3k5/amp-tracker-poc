import { addressBook, FREEZE_EVENTS, transactions, transfers } from "./data.ts"
import type { Transaction, Transfer } from "./types.ts"

export interface FlowEdge {
  from: string
  to: string
  usd: number
  tokens: Map<string, number>
}

export interface Trace {
  root: string
  transfers: Array<Transfer>
  transactions: Array<Transaction>
  addresses: Array<string>
  edges: Array<FlowEdge>
  frozen: Set<string>
  ethMoved: number
  usdtMoved: number
  hops: number
  blockRange: { from: number; to: number; fromTs: string; toTs: string } | null
}

const ETH_TOKENS = new Set(["ETH", "WETH"])
const EXITS = new Set(["exchange", "bridge", "issuer"])

function isExit(address: string) {
  const role = addressBook.get(address)?.role
  return role !== undefined && EXITS.has(role)
}

export function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

export function isAddress(value: string) {
  return /^0x[0-9a-f]{40}$/.test(value)
}

export function freezeTargets(tx: Transaction) {
  return tx.events
    .filter((event) => FREEZE_EVENTS.has(event.name))
    .map((event) => event.args._user ?? event.args._blackListedUser)
    .filter((address): address is string => address !== undefined)
}

export function touches(tx: Transaction, txTransfers: Array<Transfer>, address: string) {
  if (tx.from === address || tx.to === address) return true
  if (txTransfers.some((t) => t.from === address || t.to === address)) return true
  return tx.events.some((event) => Object.values(event.args).includes(address))
}

export function buildTrace(root: string): Trace {
  const outgoing = new Map<string, Array<string>>()
  for (const t of transfers) {
    const list = outgoing.get(t.from) ?? []
    list.push(t.to)
    outgoing.set(t.from, list)
  }

  const depth = new Map([[root, 0]])
  const queue = [root]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current !== root && isExit(current)) continue
    for (const next of outgoing.get(current) ?? []) {
      if (depth.has(next)) continue
      depth.set(next, depth.get(current)! + 1)
      queue.push(next)
    }
  }

  const expanded = (address: string) => depth.has(address) && (address === root || !isExit(address))
  const traced = transfers.filter((t) => {
    if (expanded(t.from)) return true
    if (!expanded(t.to)) return false
    return isExit(t.from) || addressBook.get(t.from)?.role === "binance"
  })
  const hashes = new Set(traced.map((t) => t.tx_hash))
  const traceTxs = transactions
    .filter((tx) => hashes.has(tx.hash) || expanded(tx.from) || freezeTargets(tx).some((address) => expanded(address)))
    .sort((a, b) => a.block_num - b.block_num || a.ts.localeCompare(b.ts))

  const addressSet = new Set<string>()
  const edgeMap = new Map<string, FlowEdge>()
  let ethMoved = 0
  let usdtMoved = 0
  for (const t of traced) {
    addressSet.add(t.from)
    addressSet.add(t.to)
    const key = `${t.from}>${t.to}`
    const edge = edgeMap.get(key) ?? { from: t.from, to: t.to, usd: 0, tokens: new Map() }
    edge.usd += Number(t.amount_usd ?? 0)
    edge.tokens.set(t.token, (edge.tokens.get(t.token) ?? 0) + Number(t.amount))
    edgeMap.set(key, edge)
    if (addressBook.get(t.from)?.role === "binance") {
      if (ETH_TOKENS.has(t.token)) ethMoved += Number(t.amount)
      if (t.token === "USDT") usdtMoved += Number(t.amount)
    }
  }

  const frozen = new Set(traceTxs.flatMap(freezeTargets))
  const first = traceTxs[0]
  const last = traceTxs.at(-1)

  return {
    root,
    transfers: traced,
    transactions: traceTxs,
    addresses: [...addressSet],
    edges: [...edgeMap.values()],
    frozen,
    ethMoved,
    usdtMoved,
    hops: Math.max(0, ...depth.values()),
    blockRange: first && last ? { from: first.block_num, to: last.block_num, fromTs: first.ts, toTs: last.ts } : null,
  }
}
