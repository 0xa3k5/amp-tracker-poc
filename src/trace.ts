import { addressBook, FREEZE_EVENTS, transactions, transfers } from "./data.ts"
import type { Transaction, Transfer } from "./types.ts"

export interface TraceNode {
  id: string
  members: Array<string>
  group: "in" | "out" | null
}

export interface FlowEdge {
  from: string
  to: string
  usd: number
  count: number
  tokens: Map<string, { amount: number; usd: number }>
}

export interface Trace {
  root: string
  transfers: Array<Transfer>
  transactions: Array<Transaction>
  addresses: Array<string>
  nodes: Array<TraceNode>
  nodeOf: Map<string, string>
  edges: Array<FlowEdge>
  frozen: Set<string>
  freezes: Array<Transaction>
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

function isExpandable(address: string) {
  return addressBook.has(address) && !isExit(address)
}

const outgoing = Map.groupBy(transfers, (t) => t.from)

export function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

export function isAddress(value: string) {
  return /^0x[0-9a-f]{40}$/.test(value)
}

export function isFreeze(tx: Transaction) {
  return tx.events.some((event) => FREEZE_EVENTS.has(event.name))
}

export function freezeTargets(tx: Transaction) {
  return tx.events
    .filter((event) => FREEZE_EVENTS.has(event.name))
    .map((event) => event.args._user ?? event.args._blackListedUser)
    .filter((address): address is string => address !== undefined)
}

export function touches(tx: Transaction, txTransfers: Array<Transfer>, addresses: Set<string>) {
  if (addresses.has(tx.from) || addresses.has(tx.to)) return true
  if (txTransfers.some((t) => addresses.has(t.from) || addresses.has(t.to))) return true
  return tx.events.some((event) => Object.values(event.args).some((value) => addresses.has(value)))
}

function groupLeaves(traced: Array<Transfer>) {
  const neighbours = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    const set = neighbours.get(a) ?? new Set()
    set.add(b)
    neighbours.set(a, set)
  }
  for (const t of traced) {
    link(t.from, t.to)
    link(t.to, t.from)
  }

  const receivers = new Set(traced.map((t) => t.to))
  const candidates = new Map<string, Array<string>>()
  for (const [address, set] of neighbours) {
    if (addressBook.has(address) || set.size !== 1) continue
    const parent = [...set][0]!
    const key = `${receivers.has(address) ? "out" : "in"}:${parent}`
    candidates.set(key, [...(candidates.get(key) ?? []), address])
  }

  const nodeOf = new Map<string, string>()
  const nodes: Array<TraceNode> = []
  for (const [key, members] of candidates) {
    if (members.length < 2) continue
    nodes.push({ id: key, members, group: key.startsWith("out") ? "out" : "in" })
    for (const member of members) nodeOf.set(member, key)
  }
  for (const address of neighbours.keys()) {
    if (nodeOf.has(address)) continue
    nodeOf.set(address, address)
    nodes.push({ id: address, members: [address], group: null })
  }
  return { nodes, nodeOf, addresses: [...neighbours.keys()] }
}

export function buildTrace(root: string): Trace {
  const depth = new Map([[root, 0]])
  const queue = [root]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current !== root && !isExpandable(current)) continue
    for (const t of outgoing.get(current) ?? []) {
      if (depth.has(t.to)) continue
      depth.set(t.to, depth.get(current)! + 1)
      queue.push(t.to)
    }
  }

  const expanded = (address: string) => depth.has(address) && (address === root || isExpandable(address))
  const traced = transfers.filter((t) => expanded(t.from) || (expanded(t.to) && addressBook.has(t.from)))
  const hashes = new Set(traced.map((t) => t.tx_hash))
  const traceTxs = transactions
    .filter((tx) => hashes.has(tx.hash) || expanded(tx.from) || freezeTargets(tx).some((address) => depth.has(address)))
    .sort((a, b) => a.block_num - b.block_num || a.ts.localeCompare(b.ts))

  const { nodes, nodeOf, addresses } = groupLeaves(traced)

  const edgeMap = new Map<string, FlowEdge>()
  let ethMoved = 0
  let usdtMoved = 0
  for (const t of traced) {
    const from = nodeOf.get(t.from)!
    const to = nodeOf.get(t.to)!
    const key = `${from}>${to}`
    const edge = edgeMap.get(key) ?? { from, to, usd: 0, count: 0, tokens: new Map() }
    const usd = Number(t.amount_usd ?? 0)
    const token = edge.tokens.get(t.token) ?? { amount: 0, usd: 0 }
    token.amount += Number(t.amount)
    token.usd += usd
    edge.tokens.set(t.token, token)
    edge.usd += usd
    edge.count += 1
    edgeMap.set(key, edge)
    if (addressBook.get(t.from)?.role === "binance") {
      if (ETH_TOKENS.has(t.token)) ethMoved += Number(t.amount)
      if (t.token === "USDT") usdtMoved += Number(t.amount)
    }
  }

  const freezes = traceTxs.filter(isFreeze)
  const first = traceTxs[0]
  const last = traceTxs.at(-1)

  return {
    root,
    transfers: traced,
    transactions: traceTxs,
    addresses,
    nodes,
    nodeOf,
    edges: [...edgeMap.values()],
    frozen: new Set(freezes.flatMap(freezeTargets)),
    freezes,
    ethMoved,
    usdtMoved,
    hops: Math.max(0, ...depth.values()),
    blockRange: first && last ? { from: first.block_num, to: last.block_num, fromTs: first.ts, toTs: last.ts } : null,
  }
}
