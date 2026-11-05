import { useReactFlow, type Edge, type Node } from "@xyflow/react"

import type { CanvasEdgeData, CanvasNodeData } from "./canvasLayout.ts"
import { isVisible } from "./canvasState.ts"
import { tokenColor } from "./FlowEdge.tsx"
import { formatUsd } from "./format.ts"
import { DATASET_NAME, freezeTotals } from "./freezes.ts"
import type { Incident } from "./incident.ts"
import { SourceLabel } from "./SourceLabel.tsx"
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
  const kindOf = new Map(incident.flow.nodes.map((node) => [node.id, node.kind]))
  let taken = 0
  let frozen = 0
  for (const link of incident.flow.links) {
    if (!isVisible(link.firstTs, time)) continue
    if (kindOf.get(link.source) === "binance") taken += link.value
    if (kindOf.get(link.target) === "frozen") frozen += link.value
  }
  const share = incident.taken > 0 ? frozen / incident.taken : 0

  const largest = (kind: string) =>
    nodes.filter((node) => node.data.kind === kind).sort((a, b) => b.data.value - a.data.value)[0]
  const landed = largest("attacker")
  const stopped = largest("frozen")
  const away = largest("held")
  const steps = [
    landed && { node: landed, title: "Where it landed", detail: `${formatUsd(landed.data.value)} goes to one wallet` },
    stopped && {
      node: stopped,
      title: "What issuers froze",
      detail: `${formatUsd(stopped.data.value)} across ${freezeTotals.issuers} issuers`,
    },
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
          {taken > 0 ? `${formatUsd(taken)} left Binance.` : "Nothing has left Binance yet."}{" "}
          {frozen > 0 ? `Issuers froze ${formatUsd(frozen)}.` : taken > 0 ? "No freezes yet." : null}
        </p>
        <p className="text-12 text-muted flex flex-wrap items-center gap-2">
          Ethereum, hack window
          <SourceLabel source="amp" detail="Transfers out of the Binance wallets" />
          <SourceLabel source="dataset" detail={`Freeze events and amounts from ${DATASET_NAME}`} />
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
