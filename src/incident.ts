import { addressBook, transfers } from "./data.ts"
import type { Details } from "./details.ts"
import { formatAmount, formatUsd } from "./format.ts"
import {
  freezeTotals,
  frozenAddresses,
  frozenByAddress,
  frozenTokensAt,
  frozenUsdByToken,
  takeover,
} from "./freezes.ts"
import { labelFor } from "./roles.ts"
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
  firstTs: string
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
  addresses: Array<string>
  focus: string | null
  open: Details
}

export interface Incident {
  taken: number
  frozen: number
  frozenWallets: number
  frozenOnCanvas: number
  unpricedTokens: number
  window: { fromTs: string; toTs: string } | null
  flow: { columns: Array<string>; nodes: Array<FlowNodeSpec>; links: Array<FlowLinkSpec> }
  unfrozen: Array<Balance>
  moments: Array<Moment>
  nodeIdFor: (address: string) => string | null
}

const EXIT_ROLES = new Set<Role>(["exchange", "issuer", "bridge"])
const HOP_ROLES = new Set<Role>(["attacker", "intermediary"])
const MAX_HOP = 7
const SIGNIFICANT = 1_000_000
const OWN_NODE = 5_000_000

const roleOf = (address: string) => addressBook.get(address)?.role
const isExit = (address: string) => EXIT_ROLES.has(roleOf(address)!)
const isBinance = (address: string) => roleOf(address) === "binance"
const usdOf = (t: Transfer) => Number(t.amount_usd ?? 0)
const byTime = (a: Transfer, b: Transfer) => a.block_num - b.block_num || a.ts.localeCompare(b.ts)

function describe(t: Transfer) {
  return `${formatAmount(Number(t.amount))} ${t.token} to ${labelFor(t.to)}`
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

function hopLevels(scope: Array<Transfer>) {
  const isWallet = (address: string) => isBinance(address) || HOP_ROLES.has(roleOf(address)!)
  const next = new Map<string, Set<string>>()
  for (const t of scope) {
    if (t.from === t.to || !isWallet(t.from) || !HOP_ROLES.has(roleOf(t.to)!)) continue
    next.set(t.from, (next.get(t.from) ?? new Set()).add(t.to))
  }
  const state = new Map<string, "open" | "done">()
  const order: Array<string> = []
  const forward = new Map<string, Array<string>>()
  const visit = (address: string) => {
    state.set(address, "open")
    const kept: Array<string> = []
    for (const target of next.get(address) ?? []) {
      if (state.get(target) === "open") continue
      kept.push(target)
      if (!state.has(target)) visit(target)
    }
    forward.set(address, kept)
    state.set(address, "done")
    order.push(address)
  }
  const roots = [...addressBook.values()].filter((a) => a.role === "binance").map((a) => a.address)
  for (const root of roots) if (!state.has(root)) visit(root)
  const level = new Map(roots.map((root) => [root, 0]))
  for (const address of order.reverse()) {
    const from = level.get(address) ?? 0
    for (const target of forward.get(address) ?? []) {
      level.set(target, Math.min(MAX_HOP, Math.max(level.get(target) ?? 0, from + 1)))
    }
  }
  return level
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

  const attackerFrozen = frozenAddresses.filter((f) => !f.binance)
  const held = balances(scope)
  const frozenUsd = (address: string) => (isBinance(address) ? 0 : (frozenByAddress.get(address)?.usd ?? 0))
  const openHoldings = (address: string) => {
    const frozenTokens = frozenTokensAt(address)
    return [...(held.get(address)?.values() ?? [])]
      .filter((h) => h.usd > 0 && !frozenTokens.has(h.token))
      .sort((a, b) => b.usd - a.usd)
  }

  const frozen = freezeTotals.usd

  const unfrozen = [...reach]
    .filter((address) => HOP_ROLES.has(roleOf(address)!))
    .map((address) => {
      const holdings = openHoldings(address)
      return { address, holdings, usd: holdings.reduce((sum, h) => sum + h.usd, 0) }
    })
    .filter((b) => b.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 6)

  const levels = hopLevels(scope)
  const wallets = [...reach].filter((address) => HOP_ROLES.has(roleOf(address)!) && levels.has(address))
  const lastHop = Math.max(1, ...wallets.map((address) => levels.get(address)!))
  const sinkColumn = lastHop + 1
  const sink = (id: string, label: string, kind: FlowKind, address?: string): FlowNodeSpec =>
    address ? { id, label, column: sinkColumn, kind, address } : { id, label, column: sinkColumn, kind }
  const SINKS = {
    frozen: sink("frozen", "Frozen by issuers", "frozen"),
    held: sink("held", "Still in the attacker's wallets", "held"),
  }

  const unlabelledInflow = new Map<string, number>()
  for (const t of scope) {
    if (addressBook.has(t.to) || !levels.has(t.from)) continue
    unlabelledInflow.set(t.to, (unlabelledInflow.get(t.to) ?? 0) + usdOf(t))
  }
  const smallUnlabelled = [...unlabelledInflow].filter(([, usd]) => usd < OWN_NODE).length
  const restSink = sink(
    "unlabelled",
    `${smallUnlabelled} unlabelled addresses under ${formatUsd(OWN_NODE)}`,
    "unlabelled",
  )

  const nodes = new Map<string, FlowNodeSpec>()
  const nodeFor = (address: string): FlowNodeSpec | null => {
    const label = labelFor(address)
    if (isBinance(address)) return { id: address, label, column: 0, kind: "binance", address }
    if (levels.has(address) && HOP_ROLES.has(roleOf(address)!)) {
      const kind = roleOf(address) === "attacker" ? "attacker" : "hop"
      return { id: address, label, column: levels.get(address)!, kind, address }
    }
    if (isExit(address)) return sink(address, label, "defi", address)
    if (!addressBook.has(address)) {
      return (unlabelledInflow.get(address) ?? 0) >= OWN_NODE ? sink(address, label, "unlabelled", address) : restSink
    }
    return null
  }

  const links = new Map<string, FlowLinkSpec>()
  const link = (
    source: FlowNodeSpec,
    target: FlowNodeSpec,
    value: number,
    token: string,
    transfers: number,
    ts: string,
  ) => {
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
      firstTs: ts,
    }
    if (ts < current.firstTs) current.firstTs = ts
    current.value += value
    current.transfers += transfers
    current.tokens.set(token, (current.tokens.get(token) ?? 0) + value)
    links.set(key, current)
  }

  const isSink = (node: FlowNodeSpec | null) => node?.kind === "unlabelled" || node?.kind === "defi"
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
    link(source, target, value, t.token, 1, t.ts)
  }
  const lastSeen = new Map<string, string>()
  for (const t of scope) lastSeen.set(t.to, t.ts)
  const freezeLink = (source: FlowNodeSpec, address: string) => {
    const ts = frozenByAddress.get(address)?.firstTs ?? ""
    for (const [token, usd] of frozenUsdByToken(address)) link(source, SINKS.frozen, usd, token, 0, ts)
  }
  for (const address of wallets) {
    const source = nodeFor(address)!
    freezeLink(source, address)
    const net = [...(held.get(address)?.values() ?? [])].reduce((sum, h) => sum + h.usd, 0) - frozenUsd(address)
    const holdings = openHoldings(address)
    const positive = holdings.reduce((sum, h) => sum + h.usd, 0)
    if (net <= 0 || positive <= 0) continue
    for (const holding of holdings)
      link(source, SINKS.held, (holding.usd / positive) * net, holding.token, 0, lastSeen.get(address) ?? "")
  }

  for (const f of attackerFrozen) {
    if (wallets.includes(f.address) || f.usd <= 0) continue
    const column = Math.min(lastHop, Math.max(1, f.hop))
    freezeLink({ id: f.address, label: labelFor(f.address), column, kind: "hop", address: f.address }, f.address)
  }

  for (let column = 1; column < sinkColumn; column += 1) {
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
  const moment = (
    ts: string,
    title: string,
    detail: string,
    hash: string,
    open: Details,
    extra: Partial<Pick<Moment, "freeze" | "addresses" | "focus">> = {},
  ) => moments.push({ ts, title, detail, hash, open, freeze: false, addresses: [], focus: null, ...extra })
  const onCanvas = (address: string) => {
    const id = used.has(address) ? address : nodeFor(address.toLowerCase())?.id
    return id && used.has(id) ? id : null
  }
  const txMoment = (title: string, detail: string, t: Transfer) => {
    const from = onCanvas(t.from)
    const to = onCanvas(t.to)
    const addresses = [from, to].filter((id) => id !== null)
    moment(t.ts, title, detail, t.tx_hash, { kind: "tx", hash: t.tx_hash }, { addresses, focus: to ?? from })
  }

  if (takeover) {
    const { grant, revoke } = takeover
    moment(
      grant.ts,
      "Attacker takes over Binance 14",
      `${takeover.count} EIP-7702 authorizations from ${labelFor(grant.from)}`,
      grant.tx_hash,
      { kind: "delegation" },
      { addresses: [grant.to, grant.from, grant.delegate], focus: grant.to },
    )
    moment(
      revoke.ts,
      "Binance revokes the delegation",
      "Delegation reset to the zero address",
      revoke.tx_hash,
      { kind: "delegation" },
      { addresses: [revoke.from], focus: revoke.from },
    )
  }
  const drain = outOfBinance[0]
  if (drain) txMoment("Drain starts", describe(drain), drain)
  const largest = outOfBinance.reduce<Transfer | undefined>(
    (top, t) => (!top || usdOf(t) > usdOf(top) ? t : top),
    undefined,
  )
  if (largest && largest.tx_hash !== drain?.tx_hash) {
    txMoment("Largest single withdrawal", describe(largest), largest)
  }
  const split = scope.find(
    (t) =>
      levels.get(t.from) === 1 &&
      (levels.get(t.to) ?? 0) >= 2 &&
      HOP_ROLES.has(roleOf(t.to)!) &&
      usdOf(t) >= SIGNIFICANT,
  )
  if (split) txMoment("Funds split into intermediary wallets", describe(split), split)
  const swap = scope.find((t) => !isBinance(t.from) && isExit(t.to) && usdOf(t) >= SIGNIFICANT)
  if (swap) txMoment("First swap or deposit", describe(swap), swap)

  const rows = attackerFrozen.flatMap((f) => f.tokens.map((t) => ({ ...t, address: f.address })))
  const tether = rows.filter((r) => r.issuer === "Tether").sort((a, b) => a.ts.localeCompare(b.ts))
  if (tether[0]) {
    const blacklisted = [...new Set(tether.map((r) => r.address))]
    const minutes = Math.round((Date.parse(tether.at(-1)!.ts) - Date.parse(tether[0].ts)) / 60_000)
    moment(
      tether[0].ts,
      "Tether starts freezing",
      `${blacklisted.length} wallets in ${minutes} minutes`,
      tether[0].tx,
      { kind: "frozen" },
      { freeze: true, addresses: blacklisted, focus: SINKS.frozen.id },
    )
  }
  const circle = rows.filter((r) => r.issuer === "Circle").sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0))[0]
  if (circle?.amount) {
    moment(
      circle.ts,
      `Circle freezes ${formatAmount(circle.amount)} USDC`,
      `At ${labelFor(circle.address)}`,
      circle.tx,
      { kind: "address", address: circle.address },
      { freeze: true, addresses: [circle.address], focus: circle.address },
    )
  }
  const found = attackerFrozen
    .filter((f) => f.unreported !== null && f.unreported !== "weak")
    .sort((a, b) => b.usd - a.usd)[0]
  const foundToken = found?.tokens.toSorted((a, b) => (b.usd ?? 0) - (a.usd ?? 0))[0]
  if (found && foundToken?.amount) {
    moment(
      foundToken.ts,
      "A freeze not in public reports",
      `${formatAmount(foundToken.amount)} ${foundToken.token} at ${labelFor(found.address)}, ${found.path.length} hops from Binance`,
      foundToken.tx,
      { kind: "address", address: found.address },
      { freeze: true, addresses: [found.address, ...found.path.map((p) => p.from)], focus: found.address },
    )
  }
  const widest = attackerFrozen.toSorted((a, b) => b.tokens.length - a.tokens.length)[0]
  if (widest && widest.tokens.length > 2) {
    const latest = widest.tokens.at(-1)!
    const issuers = new Set(widest.tokens.map((t) => t.issuer)).size
    moment(
      latest.ts,
      `Main wallet frozen in ${widest.tokens.length} tokens`,
      `${widest.tokens.map((t) => t.token).join(", ")} by ${issuers} issuers`,
      latest.tx,
      { kind: "address", address: widest.address },
      { freeze: true, addresses: [widest.address], focus: widest.address },
    )
  }
  const last = scope.findLast((t) => HOP_ROLES.has(roleOf(t.from)!) && usdOf(t) >= SIGNIFICANT)
  if (last) txMoment("Last traced movement", describe(last), last)
  moments.sort((a, b) => a.ts.localeCompare(b.ts))

  return {
    taken,
    frozen,
    frozenWallets: freezeTotals.attackerAddresses,
    frozenOnCanvas: keptLinks.filter((l) => l.target === SINKS.frozen.id).reduce((sum, l) => sum + l.value, 0),
    unpricedTokens,
    window: drain && last ? { fromTs: drain.ts, toTs: last.ts } : null,
    flow: {
      columns: Array.from({ length: sinkColumn + 1 }, (_, column) =>
        column === 0 ? "Binance wallets" : column === sinkColumn ? "Where it is now" : `Hop ${column}`,
      ),
      nodes: [...nodes.values()].filter((n) => used.has(n.id)),
      links: keptLinks,
    },
    unfrozen,
    moments,
    nodeIdFor: onCanvas,
  }
}

export const incident = buildIncident()
