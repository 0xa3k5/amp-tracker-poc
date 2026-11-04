import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { Card } from "@edgeandnode/eds-react"
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey"

import { useOpenDetails } from "./details.ts"
import { formatBlock, formatUsd } from "./format.ts"
import type { FlowKind, FlowLinkSpec, FlowNodeSpec, Incident } from "./incident.ts"
import { SqlButton } from "./SqlButton.tsx"

type Node = SankeyNode<FlowNodeSpec, FlowLinkSpec>
type Link = SankeyLink<FlowNodeSpec, FlowLinkSpec>

const HEIGHT = 520
const LABEL_SPACE = 240

const COLUMNS = ["Binance wallets", "Attacker", "Hop wallets", "Where it is now"]

const NODE_FILL: Record<FlowKind, string> = {
  binance: "var(--color-status-warning-default)",
  attacker: "var(--color-status-error-default)",
  hop: "var(--background-color-strong)",
  frozen: "var(--color-status-info-default)",
  held: "var(--color-status-error-default)",
  unlabelled: "var(--background-color-strong)",
  defi: "var(--background-color-strong)",
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

function layout(flow: Incident["flow"], width: number) {
  return sankey<FlowNodeSpec, FlowLinkSpec>()
    .nodeId((node) => node.id)
    .nodeAlign((node) => node.column)
    .nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .nodeWidth(12)
    .nodePadding(18)
    .extent([
      [0, 28],
      [Math.max(320, width - LABEL_SPACE), HEIGHT - 8],
    ])({
    nodes: flow.nodes.map((node) => ({ ...node })),
    links: flow.links.map((link) => ({ ...link })),
  })
}

function linkTitle(link: Link) {
  const tokens = [...link.tokens].sort((a, b) => b[1] - a[1])
  const shown = tokens.slice(0, 3).map(([token, usd]) => `${token} ${formatUsd(usd)}`)
  if (tokens.length > 3) shown.push(`${tokens.length - 3} more`)
  const count = link.transfers > 0 ? `, ${formatBlock(link.transfers)} transfers` : ""
  return `${(link.source as Node).label} to ${(link.target as Node).label}\n${formatUsd(link.value)}${count}\n${shown.join(", ")}`
}

function columnX(nodes: Array<Node>, column: number) {
  return nodes.find((node) => node.column === column)?.x0
}

export function FundFlow({ incident }: { incident: Incident }) {
  const open = useOpenDetails()
  const [ref, width] = useWidth()
  const [hovered, setHovered] = useState<string | null>(null)
  const graph = useMemo(() => (width > 0 ? layout(incident.flow, width) : null), [incident, width])

  const active = (link: Link) => {
    if (!hovered) return true
    const source = link.source as Node
    const target = link.target as Node
    return source.id === hovered || target.id === hovered
  }

  return (
    <Card variant="tertiary" as="section" aria-labelledby="flow-title">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="flow-title" className="text-18 font-medium">
              Where the money went
            </h2>
            <p className="text-14 text-muted">
              Width is USD value. Click a wallet to see its balance and transactions. Swap proceeds arrive as internal
              ETH transfers that the data lacks, so a wallet that sent more than it received is scaled to what it
              received.
            </p>
          </div>
          <SqlButton query="fund-flow" />
        </div>
        <div ref={ref} className="w-full">
          {graph ? (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label="Fund flow from Binance wallets to where the money is now"
            >
              {COLUMNS.map((name, column) => {
                const x = columnX(graph.nodes, column)
                return x === undefined ? null : (
                  <text key={name} x={x} y={12} className="text-12 fill-(--text-color-muted)">
                    {name}
                  </text>
                )
              })}
              <g fill="none">
                {graph.links.map((link, index) => {
                  const target = link.target as Node
                  const frozen = target.kind === "frozen"
                  return (
                    <path
                      key={index}
                      d={sankeyLinkHorizontal()(link) ?? undefined}
                      stroke={frozen ? "var(--color-status-info-default)" : "var(--border-color-strong)"}
                      strokeOpacity={active(link) ? (frozen ? 0.55 : 0.35) : 0.08}
                      strokeWidth={Math.max(1, link.width ?? 1)}
                      className="transition-[stroke-opacity]"
                    >
                      <title>{linkTitle(link)}</title>
                    </path>
                  )
                })}
              </g>
              {graph.nodes.map((node) => {
                const x0 = node.x0 ?? 0
                const x1 = node.x1 ?? 0
                const y0 = node.y0 ?? 0
                const y1 = node.y1 ?? 0
                const sink = node.column === COLUMNS.length - 1
                const clickable = node.address !== undefined
                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={clickable ? () => open({ kind: "address", address: node.address! }) : undefined}
                    className={clickable ? "cursor-pointer" : undefined}
                  >
                    <rect
                      x={x0}
                      y={y0}
                      width={x1 - x0}
                      height={Math.max(2, y1 - y0)}
                      rx={2}
                      fill={NODE_FILL[node.kind]}
                    />
                    <text
                      x={x1 + 8}
                      y={(y0 + y1) / 2}
                      dominantBaseline="middle"
                      paintOrder="stroke"
                      stroke="var(--background-color-card-tertiary-idle)"
                      strokeWidth={4}
                      strokeLinejoin="round"
                      className={sink ? "text-14 fill-(--text-color-default)" : "text-12 fill-(--text-color-default)"}
                    >
                      <tspan className={clickable ? "underline decoration-dotted underline-offset-2" : undefined}>
                        {node.label}
                      </tspan>
                      <tspan className="fill-(--text-color-muted)"> {formatUsd(node.value ?? 0)}</tspan>
                    </text>
                  </g>
                )
              })}
            </svg>
          ) : (
            <div style={{ height: HEIGHT }} />
          )}
        </div>
      </div>
    </Card>
  )
}
