import type { Edge } from "@xyflow/react"

import type { CanvasEdgeData } from "./canvasLayout.ts"
import { isVisible } from "./canvasState.ts"
import { tokenColor } from "./FlowEdge.tsx"
import { formatUsd } from "./format.ts"
import type { Incident } from "./incident.ts"
import { TokenMark } from "./TokenAmount.tsx"

const LEGEND = ["USDT", "USDC", "ETH"]

export function CanvasSummary({
  incident,
  edges,
  time,
}: {
  incident: Incident
  edges: Array<Edge<CanvasEdgeData>>
  time: string
}) {
  const sourceKind = new Map(incident.flow.nodes.map((node) => [node.id, node.kind]))
  let taken = 0
  let frozen = 0
  for (const edge of edges) {
    if (!edge.data || !isVisible(edge.data.link.firstTs, time)) continue
    if (sourceKind.get(edge.source) === "binance") taken += edge.data.link.value
    if (sourceKind.get(edge.target) === "frozen") frozen += edge.data.link.value
  }
  const share = incident.taken > 0 ? frozen / incident.taken : 0

  return (
    <div className="rounded-8 border-muted bg-subtle flex w-88 flex-col gap-3 border p-4">
      <p className="text-20 font-medium text-balance">
        {formatUsd(taken)} left Binance. Tether froze {formatUsd(frozen)}.
      </p>
      <div role="img" aria-label="Share frozen" className="bg-strong flex h-2 overflow-clip rounded-full">
        <div className="bg-status-info-default h-full transition-[width]" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-12 text-muted">
        Line width is USD value, colour is the main token. Drag to pan, scroll to zoom, click a wallet for details.
      </p>
      <ul className="text-12 flex flex-wrap gap-x-3 gap-y-1">
        {LEGEND.map((token) => (
          <li key={token} className="flex items-center gap-1">
            <span className="h-1 w-3 rounded-full" style={{ background: tokenColor(token) }} />
            <TokenMark symbol={token} size={14} />
            {token}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="h-1 w-3 rounded-full" style={{ background: tokenColor("other") }} />
          Other tokens
        </li>
      </ul>
    </div>
  )
}
