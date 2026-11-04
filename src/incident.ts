import { addressBook, transactions, transfers } from "./data.ts"
import { formatAmount, formatUsd } from "./format.ts"
import { labelFor } from "./roles.ts"
import { freezeTargets, isFreeze } from "./trace.ts"
import type { Role, Transfer } from "./types.ts"

export type FlowKind = "binance" | "attacker" | "hop" | "frozen" | "held" | "unlabelled" | "defi"

export interface FlowNodeSpec {
  id: string
  label: string
  column: number
  kind: FlowKind
  address?: string
}

export interface FlowLinkSpec {
  source: string
  target: string
  value: number
  transfers: number
  tokens: Map<string, number>
}

export interface Holding {
  token: string
  amount: number
  usd: number
}

export interface Balance {
  address: string
  usd: number
  holdings: Array<Holding>
}

export interface Moment {
  ts: string
  title: string
  detail: string
  hash: string
  freeze: boolean
}

export interface Incident {
  taken: number
  frozen: number
  frozenWallets: number
  unpricedTokens: number
  window: { fromTs: string; toTs: string } | null
  flow: { nodes: Array<FlowNodeSpec>; links: Array<FlowLinkSpec> }
  unfrozen: Array<Balance>
  moments: Array<Moment>
}

const EXIT_ROLES = new Set<Role>(["exchange", "issuer", "bridge"])
const HOP_ROLES = new Set<Role>(["attacker", "intermediary"])
const MAX_HOPS = 6
const SIGNIFICANT = 1_000_000

const SINKS = {
  frozen: { id: "frozen", label: "Frozen by Tether", column: 3, kind: "frozen" },
  held: { id: "held", label: "Still in traced wallets", column: 3, kind: "held" },
  unlabelled: { id: "unlabelled", label: "Sent to unlabelled addresses", column: 3, kind: "unlabelled" },
  defi: { id: "defi", label: "Swapped or deposited (DEXs, Aave)", column: 3, kind: "defi" },
} satisfies Record<string, FlowNodeSpec>

const roleOf = (address: string) => addressBook.get(address)?.role
const isExit = (address: string) => EXIT_ROLES.has(roleOf(address)!)
const isBinance = (address: string) => roleOf(address) === "binance"
const usdOf = (t: Transfer) => Number(t.amount_usd ?? 0)
const byTime = (a: Transfer, b: Transfer) => a.block_num - b.block_num || a.ts.localeCompare(b.ts)

function describe(t: Transfer) {
  return `${labelFor(t.from)} sends ${formatAmount(Number(t.amount))} ${t.token} to ${labelFor(t.to)}`
}

function reachable() {
  const outgoing = Map.groupBy(transfers, (t) => t.from)
  const seen = new Set([...addressBook.values()].filter((a) => a.role === "binance").map((a) => a.address))
  const queue = [...seen]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (isExit(current) || !addressBook.has(current)) continue
    for (const t of outgoing.get(current) ?? []) {
      if (seen.has(t.to)) continue
      seen.add(t.to)
      queue.push(t.to)
    }
  }
  return seen
}

function balances(scope: Array<Transfer>) {
  const result = new Map<string, Map<string, Holding>>()
  const add = (address: string, t: Transfer, sign: number) => {
    const tokens = result.get(address) ?? new Map<string, Holding>()
    const holding = tokens.get(t.token) ?? { token: t.token, amount: 0, usd: 0 }
    holding.amount += sign * Number(t.amount)
    holding.usd += sign * usdOf(t)
    tokens.set(t.token, holding)
    result.set(address, tokens)
  }
  for (const t of scope) {
    add(t.from, t, -1)
    add(t.to, t, 1)
  }
  return result
}

export function buildIncident(): Incident {
  const reach = reachable()
  const scope = transfers.filter((t) => reach.has(t.from) && reach.has(t.to)).sort(byTime)
  const outOfBinance = scope.filter((t) => isBinance(t.from) && !isBinance(t.to))
  const taken = outOfBinance.reduce((sum, t) => sum + usdOf(t), 0)
  const unpricedTokens = new Set(outOfBinance.filter((t) => !t.amount_usd).map((t) => t.token)).size

  const freezes = transactions.filter(isFreeze).sort((a, b) => a.block_num - b.block_num)
  const frozenSet = new Set(freezes.flatMap(freezeTargets).filter((address) => !isBinance(address)))

  const held = balances(scope)
  const frozenUsdt = (address: string) =>
    frozenSet.has(address) ? Math.max(0, held.get(address)?.get("USDT")?.usd ?? 0) : 0
  const openHoldings = (address: string) =>
    [...(held.get(address)?.values() ?? [])]
      .filter((h) => h.usd > 0 && !(h.token === "USDT" && frozenSet.has(address)))
      .sort((a, b) => b.usd - a.usd)

  let frozen = 0
  for (const address of frozenSet) frozen += frozenUsdt(address)

  const unfrozen = [...reach]
    .filter((address) => HOP_ROLES.has(roleOf(address)!))
    .map((address) => {
      const holdings = openHoldings(address)
      return { address, holdings, usd: holdings.reduce((sum, h) => sum + h.usd, 0) }
    })
    .filter((b) => b.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 6)

  const firstHop = new Set(outOfBinance.map((t) => t.to).filter((address) => !isExit(address)))
  const hops = [...reach].filter((address) => !firstHop.has(address) && HOP_ROLES.has(roleOf(address)!))
  const throughput = new Map<string, number>()
  for (const t of scope) {
    if (hops.includes(t.to)) throughput.set(t.to, (throughput.get(t.to) ?? 0) + usdOf(t))
  }
  for (const address of hops) {
    throughput.set(address, (throughput.get(address) ?? 0) + frozenUsdt(address))
  }
  const namedHops = new Set(hops.sort((a, b) => (throughput.get(b) ?? 0) - (throughput.get(a) ?? 0)).slice(0, MAX_HOPS))

  const nodes = new Map<string, FlowNodeSpec>()
  const nodeFor = (address: string): FlowNodeSpec | null => {
    if (isBinance(address)) return { id: address, label: labelFor(address), column: 0, kind: "binance", address }
    if (firstHop.has(address)) return { id: address, label: labelFor(address), column: 1, kind: "attacker", address }
    if (namedHops.has(address)) return { id: address, label: labelFor(address), column: 2, kind: "hop", address }
    if (hops.includes(address))
      return { id: "other-hops", label: `${hops.length - namedHops.size} other hop wallets`, column: 2, kind: "hop" }
    if (isExit(address)) return SINKS.defi
    if (!addressBook.has(address)) return SINKS.unlabelled
    return null
  }

  const links = new Map<string, FlowLinkSpec>()
  const link = (source: FlowNodeSpec, target: FlowNodeSpec, value: number, token: string, transfers: number) => {
    if (value <= 0 || source.column >= target.column) return
    nodes.set(source.id, source)
    nodes.set(target.id, target)
    const key = `${source.id}>${target.id}`
    const current = links.get(key) ?? {
      source: source.id,
      target: target.id,
      value: 0,
      transfers: 0,
      tokens: new Map(),
    }
    current.value += value
    current.transfers += transfers
    current.tokens.set(token, (current.tokens.get(token) ?? 0) + value)
    links.set(key, current)
  }

  const isSink = (node: FlowNodeSpec | null) => node === SINKS.unlabelled || node === SINKS.defi
  const swapReturn = new Map<string, number>()
  for (const t of scope) {
    if (!isSink(nodeFor(t.from))) continue
    const key = `${t.tx_hash}:${t.to}`
    swapReturn.set(key, (swapReturn.get(key) ?? 0) + usdOf(t))
  }

  for (const t of scope) {
    const source = nodeFor(t.from)
    const target = nodeFor(t.to)
    if (!source || !target) continue
    let value = usdOf(t)
    if (isSink(target)) {
      const key = `${t.tx_hash}:${t.from}`
      const returned = swapReturn.get(key) ?? 0
      const netted = Math.min(value, returned)
      swapReturn.set(key, returned - netted)
      value -= netted
    }
    link(source, target, value, t.token, 1)
  }
  for (const address of [...firstHop, ...hops]) {
    const source = nodeFor(address)!
    link(source, SINKS.frozen, frozenUsdt(address), "USDT", 0)
    const net = [...(held.get(address)?.values() ?? [])].reduce((sum, h) => sum + h.usd, 0) - frozenUsdt(address)
    const holdings = openHoldings(address)
    const positive = holdings.reduce((sum, h) => sum + h.usd, 0)
    if (net <= 0 || positive <= 0) continue
    for (const holding of holdings) link(source, SINKS.held, (holding.usd / positive) * net, holding.token, 0)
  }

  for (const column of [1, 2]) {
    for (const node of nodes.values()) {
      if (node.column !== column) continue
      const into = [...links.values()].filter((l) => l.target === node.id).reduce((sum, l) => sum + l.value, 0)
      const out = [...links.values()].filter((l) => l.source === node.id && l.target !== SINKS.frozen.id)
      const frozenOut = links.get(`${node.id}>${SINKS.frozen.id}`)?.value ?? 0
      const total = out.reduce((sum, l) => sum + l.value, 0)
      const room = Math.max(0, into - frozenOut)
      if (total <= room) continue
      const scale = room / total
      for (const l of out) {
        l.value *= scale
        for (const [token, usd] of l.tokens) l.tokens.set(token, usd * scale)
      }
    }
  }

  const minimum = taken * 0.002
  const keptLinks = [...links.values()].filter((l) => l.value >= minimum)
  const used = new Set(keptLinks.flatMap((l) => [l.source, l.target]))

  const moments: Array<Moment> = []
  const drain = outOfBinance[0]
  if (drain) {
    moments.push({ ts: drain.ts, title: "Drain starts", detail: describe(drain), hash: drain.tx_hash, freeze: false })
  }
  const largest = outOfBinance.reduce<Transfer | undefined>(
    (top, t) => (!top || usdOf(t) > usdOf(top) ? t : top),
    undefined,
  )
  if (largest && largest.tx_hash !== drain?.tx_hash) {
    moments.push({
      ts: largest.ts,
      title: "Largest single withdrawal",
      detail: `${describe(largest)}, about ${formatUsd(usdOf(largest))}`,
      hash: largest.tx_hash,
      freeze: false,
    })
  }
  const split = scope.find((t) => firstHop.has(t.from) && hops.includes(t.to) && usdOf(t) >= SIGNIFICANT)
  if (split) {
    moments.push({
      ts: split.ts,
      title: "Funds split into hop wallets",
      detail: describe(split),
      hash: split.tx_hash,
      freeze: false,
    })
  }
  const swap = scope.find((t) => !isBinance(t.from) && isExit(t.to) && usdOf(t) >= SIGNIFICANT)
  if (swap) {
    moments.push({
      ts: swap.ts,
      title: "First swap or deposit",
      detail: describe(swap),
      hash: swap.tx_hash,
      freeze: false,
    })
  }
  const attackerFreezes = freezes.filter((tx) => freezeTargets(tx).some((address) => frozenSet.has(address)))
  const firstFreeze = attackerFreezes[0]
  const lastFreeze = attackerFreezes.at(-1)
  if (firstFreeze && lastFreeze) {
    const minutes = Math.round((Date.parse(lastFreeze.ts) - Date.parse(firstFreeze.ts)) / 60_000)
    moments.push({
      ts: firstFreeze.ts,
      title: "Tether starts freezing",
      detail: `${frozenSet.size} attacker wallets blacklisted within ${minutes} minutes, locking ${formatUsd(frozen)} USDT`,
      hash: firstFreeze.hash,
      freeze: true,
    })
  }
  const last = scope.findLast((t) => HOP_ROLES.has(roleOf(t.from)!) && usdOf(t) >= SIGNIFICANT)
  if (last) {
    moments.push({
      ts: last.ts,
      title: "Last traced movement",
      detail: describe(last),
      hash: last.tx_hash,
      freeze: false,
    })
  }
  moments.sort((a, b) => a.ts.localeCompare(b.ts))

  return {
    taken,
    frozen,
    frozenWallets: frozenSet.size,
    unpricedTokens,
    window: drain && last ? { fromTs: drain.ts, toTs: last.ts } : null,
    flow: { nodes: [...nodes.values()].filter((n) => used.has(n.id)), links: keptLinks },
    unfrozen,
    moments,
  }
}

export const incident = buildIncident()
