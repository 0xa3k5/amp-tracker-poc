import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react"

import type { CanvasEdgeData } from "./canvasLayout.ts"
import { isRecent, isVisible, useCanvasState } from "./canvasState.ts"
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
  const { time, focus, selected, live } = useCanvasState()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  if (!data) return null
  if (data.live) return live ? <LiveEdge id={id} path={path} data={data} x={labelX} y={labelY} /> : null

  const visible = isVisible(data.link.firstTs, time)
  const active = focus === null || (focus.has(source) && focus.has(target))
  const touched = selected !== null && (source === selected || target === selected)
  const moving = visible && (touched || isRecent(data.link.firstTs, time))
  const color = tokenColor(data.token)
  const width = 1 + 7 * Math.sqrt(data.share)
  const opacity = !visible ? 0.03 : touched ? 0.7 : active ? 0.3 : 0.06

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: color, strokeWidth: width, strokeOpacity: opacity, transition: "stroke-opacity 300ms" }}
      />
      {moving ? (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.9}
          strokeDasharray="2 22"
          strokeLinecap="round"
          className="pointer-events-none animate-[flow_1.4s_linear_infinite]"
        />
      ) : null}
      {visible && (touched || (focus === null && data.share > 0.15)) ? (
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

function LiveEdge({ id, path, data, x, y }: { id: string; path: string; data: CanvasEdgeData; x: number; y: number }) {
  const { focus } = useCanvasState()
  const active = focus === null || (focus.has(data.link.source) && focus.has(data.link.target))
  const color = "var(--border-color-brand-default)"
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: 1.5 + 4 * Math.sqrt(data.share),
          strokeOpacity: active ? 0.6 : 0.08,
          transition: "stroke-opacity 300ms",
        }}
      />
      {active ? (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.9}
          strokeDasharray="2 22"
          strokeLinecap="round"
          className="pointer-events-none animate-[flow_1.4s_linear_infinite]"
        />
      ) : null}
      {active ? (
        <EdgeLabelRenderer>
          <div
            title={edgeTitle(data)}
            className="rounded-6 border-brand-default bg-subtle text-12 nodrag nopan pointer-events-auto absolute flex items-center gap-1 border px-1.5 py-0.5 whitespace-nowrap"
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
          >
            <TokenMark symbol={data.token} size={14} />
            New · {data.link.value > 0 ? formatUsd(data.link.value) : data.token}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
