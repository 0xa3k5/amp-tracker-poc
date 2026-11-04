import type { FlowKind, FlowLinkSpec, Incident } from "./incident.ts"
import { STEPS, type TimeScale } from "./timeScale.ts"

export const CARD_WIDTH = 248
export const CARD_HEIGHT = 92
const COLUMN_GAP = 160
const ROW_GAP = 28
const TIME_WIDTH = 3600

export type LayoutMode = "hops" | "time"

export interface CanvasNodeData {
  [key: string]: unknown
  id: string
  label: string
  kind: FlowKind
  address: string | undefined
  value: number
  firstTs: string
  minor: boolean
  hiddenCount: number
}

export interface CanvasEdgeData {
  [key: string]: unknown
  link: FlowLinkSpec
  token: string
  share: number
}

interface LayoutOptions {
  mode: LayoutMode
  expanded: boolean
  scale: TimeScale
}

function stack<T extends { id: string }>(
  items: Array<T>,
  x: number,
  tallest: number,
  into: Map<string, { x: number; y: number }>,
) {
  const offset = ((tallest - items.length) * (CARD_HEIGHT + ROW_GAP)) / 2
  items.forEach((item, index) => into.set(item.id, { x, y: offset + index * (CARD_HEIGHT + ROW_GAP) }))
}

export function canvasLayout(incident: Incident, { mode, expanded, scale }: LayoutOptions) {
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

  const nodes = incident.flow.nodes.filter((node) => expanded || !isMinor(node.kind, node.id))
  const shown = new Set(nodes.map((node) => node.id))
  const visibleLinks = links.filter((link) => shown.has(link.source) && shown.has(link.target))
  const hiddenCount = new Map<string, number>()
  for (const link of links) {
    if (shown.has(link.source) && !shown.has(link.target)) {
      hiddenCount.set(link.source, (hiddenCount.get(link.source) ?? 0) + 1)
    }
  }

  const sinkColumn = Math.max(...nodes.map((node) => node.column))
  const byValue = (a: { id: string }, b: { id: string }) => value(b.id) - value(a.id)
  const positions = new Map<string, { x: number; y: number }>()

  if (mode === "hops") {
    const columns = Map.groupBy(nodes, (node) => node.column)
    const tallest = Math.max(...[...columns.values()].map((column) => column.length))
    for (const [column, members] of columns) {
      stack(members.toSorted(byValue), column * (CARD_WIDTH + COLUMN_GAP), tallest, positions)
    }
  } else {
    const timeX = (id: string) => (scale.toStep(first.get(id) ?? "") / STEPS) * TIME_WIDTH
    const flowing = nodes.filter((node) => node.column !== sinkColumn).toSorted((a, b) => timeX(a.id) - timeX(b.id))
    const rowEnds: Array<number> = []
    for (const node of flowing) {
      const x = timeX(node.id)
      let row = rowEnds.findIndex((end) => end <= x)
      if (row === -1) row = rowEnds.length
      rowEnds[row] = x + CARD_WIDTH + 40
      positions.set(node.id, { x, y: row * (CARD_HEIGHT + ROW_GAP) })
    }
    const sinks = nodes.filter((node) => node.column === sinkColumn).toSorted(byValue)
    stack(sinks, Math.max(TIME_WIDTH, ...rowEnds) + COLUMN_GAP, Math.max(sinks.length, rowEnds.length), positions)
  }

  const total = Math.max(1, ...links.map((link) => link.value))
  return {
    minorCount: incident.flow.nodes.filter((node) => isMinor(node.kind, node.id)).length,
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
        minor: isMinor(node.kind, node.id),
        hiddenCount: hiddenCount.get(node.id) ?? 0,
      } satisfies CanvasNodeData,
    })),
    edges: visibleLinks.map((link) => ({
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
