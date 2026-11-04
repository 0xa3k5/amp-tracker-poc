import { useReactFlow, type Edge, type Node } from "@xyflow/react"

import type { CanvasEdgeData, CanvasNodeData } from "./canvasLayout.ts"
import { isVisible } from "./canvasState.ts"
import { tokenColor } from "./FlowEdge.tsx"
import { formatUsd } from "./format.ts"
import type { Incident } from "./incident.ts"
import { TokenMark } from "./TokenAmount.tsx"

const LEGEND = ["USDT", "USDC", "ETH"]

interface CanvasSummaryProps {
  incident: Incident
  nodes: Array<Node<CanvasNodeData>>
  edges: Array<Edge<CanvasEdgeData>>
  time: string
  selected: string | null
  onSelect: (id: string | null) => void
}

export function CanvasSummary({ incident, nodes, edges, time, selected, onSelect }: CanvasSummaryProps) {
  const flow = useReactFlow()
  const kindOf = new Map(nodes.map((node) => [node.id, node.data.kind]))
  let taken = 0
  let frozen = 0
  for (const edge of edges) {
    if (!edge.data || !isVisible(edge.data.link.firstTs, time)) continue
    if (kindOf.get(edge.source) === "binance") taken += edge.data.link.value
    if (kindOf.get(edge.target) === "frozen") frozen += edge.data.link.value
  }
  const share = incident.taken > 0 ? frozen / incident.taken : 0

  const largest = (kind: string) =>
    nodes.filter((node) => node.data.kind === kind).sort((a, b) => b.data.value - a.data.value)[0]
  const landed = largest("attacker")
  const stopped = largest("frozen")
  const away = largest("held")
  const steps = [
    landed && { node: landed, title: "Where it landed", detail: `${formatUsd(landed.data.value)} goes to one wallet` },
    stopped && { node: stopped, title: "What Tether stopped", detail: `${formatUsd(stopped.data.value)} USDT frozen` },
    away && { node: away, title: "What got away", detail: `${formatUsd(away.data.value)} not frozen` },
  ].filter((step) => !!step)

  const focusOn = (id: string) => {
    if (selected === id) {
      onSelect(null)
      void flow.fitView({ duration: 600, padding: 0.08 })
      return
    }
    onSelect(id)
    const ids = new Set([id])
    for (const edge of edges) {
      if (edge.source === id) ids.add(edge.target)
      if (edge.target === id) ids.add(edge.source)
    }
    void flow.fitView({ nodes: [...ids].map((nodeId) => ({ id: nodeId })), duration: 600, padding: 0.2 })
  }

  return (
    <div className="rounded-8 border-muted bg-subtle flex w-88 flex-col gap-4 border p-4">
      <div className="flex flex-col gap-2">
        <p className="text-20 font-medium text-balance">
          {formatUsd(taken)} left Binance. Tether froze {formatUsd(frozen)}.
        </p>
        <div role="img" aria-label="Share frozen" className="bg-strong flex h-2 overflow-clip rounded-full">
          <div className="bg-status-info-default h-full transition-[width]" style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-caption text-10 text-muted">Start here</p>
        <ol className="flex flex-col">
          {steps.map((step, index) => (
            <li key={step.node.id}>
              <button
                type="button"
                data-selected={selected === step.node.id || undefined}
                onClick={() => focusOn(step.node.id)}
                className="rounded-6 hover:bg-muted data-selected:bg-default flex w-full items-start gap-3 px-2 py-2 text-start"
              >
                <span className="border-default text-12 flex size-5 shrink-0 items-center justify-center rounded-full border">
                  {index + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-14">{step.title}</span>
                  <span className="text-12 text-muted">{step.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <ul className="text-12 text-muted flex flex-wrap gap-x-3 gap-y-1">
        {LEGEND.map((token) => (
          <li key={token} className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded-full" style={{ background: tokenColor(token) }} />
            <TokenMark symbol={token} size={12} />
            {token}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded-full" style={{ background: tokenColor("other") }} />
          Other
        </li>
      </ul>
    </div>
  )
}
