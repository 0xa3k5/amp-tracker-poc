import type { Edge, Node } from "@xyflow/react"

import {
  CARD_HEIGHT,
  CARD_WIDTH,
  COLUMN_GAP,
  ROW_GAP,
  type CanvasEdgeData,
  type CanvasNodeData,
} from "./canvasLayout.ts"
import { addresses, transfers } from "./data.ts"
import { freezes } from "./freezes.ts"
import type { FlowLinkSpec, Incident } from "./incident.ts"
import type { LiveEvent } from "./liveStream.ts"
import { labelFor } from "./roles.ts"
import type { StreamFreeze } from "./stream.ts"

const known = new Set([
  ...addresses.map((a) => a.address),
  ...transfers.flatMap((t) => [t.from, t.to]),
  ...freezes.map((f) => f.address),
])

export function isNeverSeen(address: string) {
  return !known.has(address)
}

const USD_PEGGED = new Set(["USDT", "USDC", "RLUSD", "USD1", "FDUSD", "PYUSD"])

export interface LiveFrozen {
  usd: number
  events: Array<StreamFreeze>
}

export interface LiveGraph {
  nodes: Array<Node<CanvasNodeData>>
  edges: Array<Edge<CanvasEdgeData>>
  touched: Set<string>
  idFor: (address: string) => string | null
  column: { x: number; y: number } | null
  frozen: LiveFrozen
}

function frozenUsd(incident: Incident, freeze: StreamFreeze) {
  const held = incident.unfrozen.find((b) => b.address === freeze.address)
  const holding = held?.holdings.find((h) => h.token === freeze.token)
  if (holding) return holding.usd
  if (freeze.action === "seize" && freeze.amount !== null && USD_PEGGED.has(freeze.token)) return Number(freeze.amount)
  return 0
}

export function liveGraph(incident: Incident, base: Array<Node<CanvasNodeData>>, events: Array<LiveEvent>): LiveGraph {
  const right = Math.max(0, ...base.map((node) => node.position.x)) + CARD_WIDTH + COLUMN_GAP
  const top = Math.min(0, ...base.map((node) => node.position.y))
  const added = new Map<string, Node<CanvasNodeData>>()
  const links = new Map<string, FlowLinkSpec>()
  const touched = new Set<string>()

  const idFor = (address: string) => {
    if (added.has(address)) return address
    return isNeverSeen(address) ? null : incident.nodeIdFor(address)
  }
  // Every streamed transfer is an outflow of a watched wallet (stream-transfers.sql), so each new
  // wallet hangs off its sender: one column to the right of the sender's live column, or in the
  // first live column when the sender is on the incident canvas.
  const columnOf = new Map<string, number>()
  const rows: Array<number> = []
  const place = (address: string, ts: string, after: string | null) => {
    const existing = idFor(address)
    if (existing) return existing
    const column = after !== null && columnOf.has(after) ? (columnOf.get(after) ?? 0) + 1 : 0
    const row = rows[column] ?? 0
    rows[column] = row + 1
    columnOf.set(address, column)
    added.set(address, {
      id: address,
      position: { x: right + column * (CARD_WIDTH + COLUMN_GAP), y: top + row * (CARD_HEIGHT + ROW_GAP) },
      data: {
        id: address,
        label: labelFor(address),
        kind: "unlabelled",
        address,
        value: 0,
        firstTs: ts,
        minor: false,
        live: true,
      },
    })
    return address
  }

  const ordered = events.toSorted((a, b) => a.block_num - b.block_num || a.log_index - b.log_index)
  for (const event of ordered) {
    // All of them, small ones included: a gas top-up is often how a new wallet joins the trail
    if (event.kind !== "transfer") continue
    const source = place(event.from, event.ts, null)
    const target = place(event.to, event.ts, source)
    if (source === target) continue
    touched.add(source).add(target)
    const usd = Number(event.amount_usd ?? 0)
    const key = `${source}>${target}`
    const link = links.get(key) ?? { source, target, value: 0, transfers: 0, firstTs: event.ts, tokens: new Map() }
    link.value += usd
    link.transfers += 1
    link.tokens.set(event.token, (link.tokens.get(event.token) ?? 0) + usd)
    links.set(key, link)
    for (const id of [source, target]) {
      const node = added.get(id)
      if (node) node.data.value += usd
    }
  }

  const watched = ordered.filter((e): e is StreamFreeze => e.kind === "freeze" && e.watched && e.action !== "unfreeze")
  for (const freeze of watched) {
    const id = idFor(freeze.address)
    if (id) touched.add(id)
  }
  const counted = new Set<string>()
  let usd = 0
  for (const freeze of watched) {
    const key = `${freeze.address}:${freeze.token}`
    if (counted.has(key)) continue
    counted.add(key)
    usd += frozenUsd(incident, freeze)
  }

  const total = Math.max(1, ...[...links.values()].map((link) => link.value))
  return {
    nodes: [...added.values()],
    edges: [...links.values()].map((link) => ({
      id: `live:${link.source}>${link.target}`,
      source: link.source,
      target: link.target,
      data: {
        link,
        token: [...link.tokens].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
        share: link.value / total,
        live: true,
      },
    })),
    touched,
    idFor,
    column: added.size > 0 ? { x: right, y: top } : null,
    frozen: { usd, events: watched },
  }
}
