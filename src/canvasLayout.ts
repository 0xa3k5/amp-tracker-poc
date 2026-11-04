import type { FlowKind, FlowLinkSpec, Incident } from "./incident.ts"

export const CARD_WIDTH = 248
export const CARD_HEIGHT = 92
const COLUMN_GAP = 160
const ROW_GAP = 28

export interface CanvasNodeData {
  [key: string]: unknown
  id: string
  label: string
  kind: FlowKind
  address: string | undefined
  value: number
  firstTs: string
}

export interface CanvasEdgeData {
  [key: string]: unknown
  link: FlowLinkSpec
  token: string
  share: number
}

export function canvasLayout(incident: Incident) {
  const { nodes, links } = incident.flow
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
  const columns = Map.groupBy(nodes, (node) => node.column)
  const tallest = Math.max(...[...columns.values()].map((column) => column.length))
  const positions = new Map<string, { x: number; y: number }>()
  for (const [column, members] of columns) {
    const sorted = members.toSorted((a, b) => value(b.id) - value(a.id))
    const offset = ((tallest - sorted.length) * (CARD_HEIGHT + ROW_GAP)) / 2
    sorted.forEach((node, index) => {
      positions.set(node.id, { x: column * (CARD_WIDTH + COLUMN_GAP), y: offset + index * (CARD_HEIGHT + ROW_GAP) })
    })
  }

  const total = Math.max(1, ...links.map((link) => link.value))
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: {
        id: node.id,
        label: node.label,
        kind: node.kind,
        address: node.address,
        value: value(node.id),
        firstTs: first.get(node.id) ?? "",
      } satisfies CanvasNodeData,
    })),
    edges: links.map((link) => ({
      id: `${link.source}>${link.target}`,
      source: link.source,
      target: link.target,
      data: {
        link,
        token: [...link.tokens].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
        share: link.value / total,
      } satisfies CanvasEdgeData,
    })),
  }
}
