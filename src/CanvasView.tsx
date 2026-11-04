import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { useEDS } from "@edgeandnode/eds-react/hooks"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react"

import { canvasLayout } from "./canvasLayout.ts"
import { CanvasStateContext } from "./canvasState.ts"
import { CanvasSummary } from "./CanvasSummary.tsx"
import { useOpenDetails } from "./details.ts"
import { FlowEdge, type FlowCanvasEdge } from "./FlowEdge.tsx"
import type { Incident } from "./incident.ts"
import { Scrubber } from "./Scrubber.tsx"
import { STEPS, timeScale } from "./timeScale.ts"
import { WalletNode, type WalletCanvasNode } from "./WalletNode.tsx"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = { wallet: WalletNode }
const EDGE_TYPES: EdgeTypes = { flow: FlowEdge }

const FLOW_STYLE = {
  "--xy-background-color": "var(--background-color-canvas)",
  "--xy-controls-button-background-color": "var(--background-color-subtle)",
  "--xy-controls-button-background-color-hover": "var(--background-color-elevated)",
  "--xy-controls-button-color": "var(--text-color-muted)",
  "--xy-controls-button-color-hover": "var(--text-color-default)",
  "--xy-controls-button-border-color": "var(--border-color-muted)",
  "--xy-minimap-background-color": "var(--background-color-subtle)",
  "--xy-minimap-mask-background-color": "var(--background-color-backdrop)",
  "--xy-node-border-radius": "8px",
} as CSSProperties

const MINIMAP_FILL: Record<string, string> = {
  binance: "var(--color-status-warning-default)",
  attacker: "var(--color-status-error-default)",
  frozen: "var(--color-status-info-default)",
}

export function CanvasView({ incident }: { incident: Incident }) {
  const open = useOpenDetails()
  const { activeTheme } = useEDS()
  const layout = useMemo(() => canvasLayout(incident), [incident])
  const nodes = useMemo<Array<WalletCanvasNode>>(
    () => layout.nodes.map((node) => ({ ...node, type: "wallet" })),
    [layout],
  )
  const edges = useMemo<Array<FlowCanvasEdge>>(() => layout.edges.map((edge) => ({ ...edge, type: "flow" })), [layout])

  const scale = useMemo(() => {
    const times = layout.edges
      .map((edge) => edge.data.link.firstTs)
      .filter(Boolean)
      .sort()
    return timeScale(times[0] ?? incident.window?.fromTs ?? "", incident.window?.toTs ?? times.at(-1) ?? "")
  }, [layout, incident])

  const [step, setStep] = useState(STEPS)
  const onStepChange = useCallback((next: number) => setStep(next), [])
  const time = scale.toTime(step)

  const [selected, setSelected] = useState<string | null>(null)
  const focus = useMemo(() => {
    if (!selected) return null
    const set = new Set([selected])
    for (const edge of layout.edges) {
      if (edge.source === selected) set.add(edge.target)
      if (edge.target === selected) set.add(edge.source)
    }
    return set
  }, [layout, selected])

  const state = useMemo(() => ({ time, focus, selected }), [time, focus, selected])

  return (
    <CanvasStateContext value={state}>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          defaultNodes={nodes}
          defaultEdges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          colorMode={activeTheme}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.1}
          nodesConnectable={false}
          edgesFocusable={false}
          onNodeClick={(_event, node) => {
            setSelected(node.id === selected ? null : node.id)
            if (node.data.address) open({ kind: "address", address: node.data.address })
          }}
          onPaneClick={() => setSelected(null)}
          proOptions={{ hideAttribution: true }}
          style={FLOW_STYLE}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-color-default)" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            position="top-right"
            pannable
            zoomable
            nodeColor={(node) => MINIMAP_FILL[String(node.data.kind)] ?? "var(--background-color-strong)"}
          />
          <Panel position="top-left">
            <CanvasSummary incident={incident} edges={edges} time={time} />
          </Panel>
          <Panel position="bottom-center">
            <Scrubber scale={scale} step={step} moments={incident.moments} onStepChange={onStepChange} />
          </Panel>
        </ReactFlow>
      </div>
    </CanvasStateContext>
  )
}
