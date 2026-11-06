import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react"

import type { DelegationEdgeData } from "./canvasLayout.ts"
import { useCanvasState } from "./canvasState.ts"

export type DelegationCanvasEdge = Edge<DelegationEdgeData, "delegation">

export function DelegationEdge(props: EdgeProps<DelegationCanvasEdge>) {
  const { id, data, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props
  const { time, focus } = useCanvasState()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  if (!data) return null

  const visible = time >= data.from
  const revoked = time >= data.until
  const active = focus === null || (focus.has(source) && focus.has(target))
  const opacity = !visible ? 0.05 : active ? (revoked ? 0.35 : 0.8) : 0.1

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "var(--text-color-muted)",
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
          strokeOpacity: opacity,
          transition: "stroke-opacity 300ms",
        }}
      />
      {visible && active ? (
        <EdgeLabelRenderer>
          <div
            className="rounded-6 border-muted bg-canvas text-12 text-muted nodrag nopan pointer-events-none absolute border border-dashed px-1.5 py-0.5 whitespace-nowrap"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {revoked ? `${data.label}, revoked` : data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
