import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react"

import type { CanvasEdgeData } from "./canvasLayout.ts"
import { isVisible, useCanvasState } from "./canvasState.ts"
import { formatBlock, formatUsd } from "./format.ts"
import { TokenMark } from "./TokenAmount.tsx"

export type FlowCanvasEdge = Edge<CanvasEdgeData, "flow">

export function tokenColor(token: string) {
  if (token === "USDT" || token === "aEthUSDT") return "var(--color-status-success-default)"
  if (token === "USDC") return "var(--color-status-info-default)"
  if (token === "ETH" || token === "WETH") return "var(--background-color-brand-default)"
  return "var(--color-status-warning-default)"
}

function edgeTitle({ link }: CanvasEdgeData) {
  const tokens = [...link.tokens].sort((a, b) => b[1] - a[1])
  const shown = tokens.slice(0, 4).map(([token, usd]) => `${token} ${formatUsd(usd)}`)
  if (tokens.length > 4) shown.push(`${tokens.length - 4} more`)
  const count = link.transfers > 0 ? ` in ${formatBlock(link.transfers)} transfers` : ""
  return `${formatUsd(link.value)}${count}\n${shown.join(", ")}`
}

export function FlowEdge(props: EdgeProps<FlowCanvasEdge>) {
  const { id, data, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props
  const { time, focus } = useCanvasState()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  if (!data) return null

  const visible = isVisible(data.link.firstTs, time)
  const active = focus === null || (focus.has(source) && focus.has(target))
  const color = tokenColor(data.token)
  const width = 2 + 26 * Math.sqrt(data.share)
  const opacity = !visible ? 0.04 : active ? 0.45 : 0.08

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: color, strokeWidth: width, strokeOpacity: opacity, transition: "stroke-opacity 300ms" }}
      />
      {visible && active ? (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(1.5, width / 5)}
          strokeDasharray="6 18"
          strokeLinecap="round"
          className="pointer-events-none animate-[flow_1.4s_linear_infinite]"
        />
      ) : null}
      {visible && active && (data.share > 0.04 || focus !== null) ? (
        <EdgeLabelRenderer>
          <div
            title={edgeTitle(data)}
            className="rounded-6 border-muted bg-subtle text-12 nodrag nopan pointer-events-auto absolute flex items-center gap-1 border px-1.5 py-0.5 whitespace-nowrap"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <TokenMark symbol={data.token} size={14} />
            {formatUsd(data.link.value)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
