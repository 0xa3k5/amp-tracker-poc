import { takeover } from "./freezes.ts"
import type { FlowKind, FlowLinkSpec, Incident } from "./incident.ts"
import { labelFor } from "./roles.ts"

export const CARD_WIDTH = 248
export const CARD_HEIGHT = 92
export const COLUMN_GAP = 160
export const ROW_GAP = 28

export type CanvasKind = FlowKind | "operator" | "contract"

export interface CanvasNodeData {
  [key: string]: unknown
  id: string
  label: string
  kind: CanvasKind
  address: string | undefined
  value: number
  firstTs: string
  minor: boolean
  live: boolean
}

export interface CanvasEdgeData {
  [key: string]: unknown
  link: FlowLinkSpec
  token: string
  share: number
  live: boolean
}

export interface DelegationEdgeData {
  [key: string]: unknown
  label: string
  from: string
  until: string
}

export const takeoverIds = takeover ? [takeover.grant.from, takeover.grant.delegate] : []

function stack<T extends { id: string }>(
  items: Array<T>,
  x: number,
  tallest: number,
  into: Map<string, { x: number; y: number }>,
) {
  const offset = ((tallest - items.length) * (CARD_HEIGHT + ROW_GAP)) / 2
  items.forEach((item, index) => into.set(item.id, { x, y: offset + index * (CARD_HEIGHT + ROW_GAP) }))
}

export function canvasLayout(incident: Incident) {
  const { links } = incident.flow
  const into = new Map<string, number>()
  const out = new Map<string, number>()
  const first = new Map<string, string>()
  for (const link of links) {
    into.set(link.target, (into.get(link.target) ?? 0) + link.value)
    out.set(link.source, (out.get(link.source) ?? 0) + link.value)
    for (const id of [link.source, link.target]) {
      const current = first.get(id)
      if (!current || (link.firstTs && link.firstTs < current)) first.set(id, link.firstTs)
    }
  }
  const value = (id: string) => Math.max(into.get(id) ?? 0, out.get(id) ?? 0)
  const isMinor = (kind: FlowKind, id: string) =>
    kind !== "frozen" && kind !== "binance" && value(id) < incident.taken * 0.02

  const nodes = incident.flow.nodes
  const byValue = (a: { id: string }, b: { id: string }) => value(b.id) - value(a.id)
  const positions = new Map<string, { x: number; y: number }>()

  const columns = Map.groupBy(nodes, (node) => node.column)
  const tallest = Math.max(...[...columns.values()].map((column) => column.length))
  for (const [column, members] of columns) {
    stack(members.toSorted(byValue), column * (CARD_WIDTH + COLUMN_GAP), tallest, positions)
  }

  const flowNodes = nodes.map((node) => ({
    id: node.id,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      id: node.id,
      label: node.label,
      kind: node.kind,
      address: node.address,
      value: value(node.id),
      firstTs: node.kind === "binance" ? "" : (first.get(node.id) ?? ""),
      minor: isMinor(node.kind, node.id),
      live: false,
    } satisfies CanvasNodeData,
  }))

  const total = Math.max(1, ...links.map((link) => link.value))
  const flowEdges = links.map((link) => ({
    id: `${link.source}>${link.target}`,
    source: link.source,
    target: link.target,
    data: {
      link,
      token: [...link.tokens].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
      share: link.value / total,
      live: false,
    } satisfies CanvasEdgeData,
  }))

  const authority = takeover ? positions.get(takeover.grant.to) : undefined
  if (!takeover || !authority) return { nodes: flowNodes, edges: flowEdges, delegations: [] }

  const { grant, revoke } = takeover
  const x = authority.x - (CARD_WIDTH + COLUMN_GAP)
  const step = (CARD_HEIGHT + ROW_GAP) / 2
  const card = (address: string, kind: CanvasKind, label: string, y: number) => ({
    id: address,
    position: { x, y },
    data: {
      id: address,
      label,
      kind,
      address,
      value: 0,
      firstTs: grant.ts,
      minor: false,
      live: false,
    } satisfies CanvasNodeData,
  })
  const edge = (source: string, label: string) => ({
    id: `delegation:${source}`,
    source,
    target: grant.to,
    data: { label, from: grant.ts, until: revoke.ts } satisfies DelegationEdgeData,
  })

  return {
    nodes: [
      card(grant.from, "operator", labelFor(grant.from), authority.y - step),
      card(grant.delegate, "contract", "Sweeper contract", authority.y + step),
      ...flowNodes,
    ],
    edges: flowEdges,
    delegations: [
      edge(grant.from, `Sends ${takeover.count} EIP-7702 authorizations`),
      edge(grant.delegate, "Delegate"),
    ],
  }
}
