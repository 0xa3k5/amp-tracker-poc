import { useMemo, type CSSProperties } from "react"
import dagre from "@dagrejs/dagre"
import { Card } from "@edgeandnode/eds-react"
import { useEDS } from "@edgeandnode/eds-react/hooks"
import { cn } from "@edgeandnode/eds-react/utils"
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react"

import { addressBook } from "./data.ts"
import { FlowNode, NODE_HEIGHT, NODE_WIDTH, type AddressNode } from "./FlowNode.tsx"
import { formatAmount } from "./format.ts"
import { labelFor } from "./roles.ts"
import type { Trace } from "./trace.ts"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = { address: FlowNode }

const FLOW_STYLE = {
  "--xy-background-color": "var(--background-color-canvas)",
  "--xy-edge-stroke": "var(--border-color-elevated)",
  "--xy-edge-label-color": "var(--text-color-muted)",
  "--xy-edge-label-background-color": "var(--background-color-canvas)",
  "--xy-controls-button-background-color": "var(--background-color-subtle)",
  "--xy-controls-button-background-color-hover": "var(--background-color-elevated)",
  "--xy-controls-button-color": "var(--text-color-muted)",
  "--xy-controls-button-color-hover": "var(--text-color-default)",
  "--xy-controls-button-border-color": "var(--border-color-muted)",
} as CSSProperties

interface FlowGraphProps {
  trace: Trace
  selected: string | null
  onSelect: (address: string | null) => void
  className?: string
}

function layout(trace: Trace) {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 140 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const address of trace.addresses) graph.setNode(address, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const edge of trace.edges) graph.setEdge(edge.from, edge.to)
  dagre.layout(graph)
  return new Map(
    trace.addresses.map((address) => {
      const { x, y } = graph.node(address)
      return [address, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }]
    }),
  )
}

export function FlowGraph({ trace, selected, onSelect, className }: FlowGraphProps) {
  const { activeTheme } = useEDS()
  const positions = useMemo(() => layout(trace), [trace])

  const neighbours = useMemo(() => {
    if (!selected) return null
    const set = new Set([selected])
    for (const edge of trace.edges) {
      if (edge.from === selected) set.add(edge.to)
      if (edge.to === selected) set.add(edge.from)
    }
    return set
  }, [trace, selected])

  const nodes: Array<AddressNode> = trace.addresses.map((address) => ({
    id: address,
    type: "address",
    position: positions.get(address) ?? { x: 0, y: 0 },
    data: {
      address,
      label: labelFor(address),
      role: addressBook.get(address)?.role,
      frozen: trace.frozen.has(address),
      selected: address === selected,
      dimmed: neighbours !== null && !neighbours.has(address),
    },
  }))

  const maxUsd = Math.max(1, ...trace.edges.map((edge) => edge.usd))
  const edges: Array<Edge> = trace.edges.map((edge) => {
    const active = selected !== null && (edge.from === selected || edge.to === selected)
    const stroke = active ? "var(--border-color-brand-default)" : "var(--border-color-elevated)"
    return {
      id: `${edge.from}>${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: [...edge.tokens].map(([token, amount]) => `${formatAmount(amount)} ${token}`).join(", "),
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      style: { stroke, strokeWidth: 1 + 7 * Math.sqrt(edge.usd / maxUsd) },
      zIndex: active ? 1 : 0,
    }
  })

  return (
    <Card
      variant="tertiary"
      as="section"
      aria-label="Fund flow"
      className={cn("var-[padding=0] overflow-clip", className)}
    >
      <ReactFlow
        key={trace.root}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={activeTheme}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        onNodeClick={(_event, node) => onSelect(node.id === selected ? null : node.id)}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
        style={FLOW_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-color-default)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Card>
  )
}
